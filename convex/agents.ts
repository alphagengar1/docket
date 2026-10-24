// runAgent(role, input) with a provider switch per role.
//   AGENT_PROVIDER_UNDERWRITER = "claude" (default) | "creao" | "stub"
//   AGENT_PROVIDER_COMPLIANCE  = "claude" (default) | "creao" | "stub"
// "claude" silently degrades to "stub" when ANTHROPIC_API_KEY is unset so the
// board always has data; the audit log says which one actually ran.
//
// Underwriters: claude-haiku-5-5 (fast). Compliance: claude-sonnet-5-5.
// The spec said temperature 0; the current Messages API rejects `temperature`,
// so determinism comes from effort "low" + structured outputs + Zod validation.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { lender as lenderValidator } from "./schema";
import {
  ComplianceOutputSchema,
  ReasonSchema,
  UnderwriterOutputSchema,
  tierForScore,
  type BundleData,
  type ComplianceInput,
  type Lender,
  type MarketAnchor,
  type UnderwriterInput,
  type UnderwriterOutput,
} from "./types";
import { POLICIES, LENDER_NAMES } from "./policies";
import { advertisedApr, stubCompliance, stubUnderwrite } from "./stub";
import { classifyOffer, costToBorrow, fcraParagraph, monthlyPayment, noticeRequired } from "./classify";
import { buildComplianceInput, buildUnderwriterInput, fillName } from "./pii";

export type Role = "underwriter" | "compliance";
export type ProviderName = "claude" | "creao" | "stub";

const UNDERWRITER_MODEL = "claude-haiku-5-5";
const COMPLIANCE_MODEL = "claude-sonnet-5-5";

// Output-format schemas (no refinements; the refined contract schemas in
// types.ts run on the parsed result afterwards).
const UnderwriterFormat = z.object({
  decision: z.enum(["approve", "decline"]),
  apr: z.number().nullable(),
  termMonths: z.number().nullable(),
  amount: z.number().nullable(),
  conditions: z.array(z.string()),
  reasons: z.array(ReasonSchema),
});
const ComplianceFormat = z.object({ text: z.string() });

export function providerFor(role: Role): ProviderName {
  const raw = (
    role === "underwriter" ? process.env.AGENT_PROVIDER_UNDERWRITER : process.env.AGENT_PROVIDER_COMPLIANCE
  )?.toLowerCase();
  const chosen: ProviderName = raw === "creao" || raw === "stub" ? raw : "claude";
  if (chosen === "claude" && !process.env.ANTHROPIC_API_KEY) return "stub";
  return chosen;
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
function underwriterSystem(lender: Lender): string {
  return [
    `You are the ${LENDER_NAMES[lender]} underwriting agent on an automated lending desk. A human loan officer approves every offer; you only recommend.`,
    `Apply the policy below literally. Quote the actual numbers from the bundle in every reason. Reference bundle fields by path (credit.fico9, credit.utilization, credit.inquiries6mo, credit.vantage4, credit.tradelines, flags.bankruptcy, flags.eviction, flags.lienOrJudgment, fraud.score, fraud.signals, statedIncome, amountRequested).`,
    `Refer to credit.fico9 as the TransUnion score; never write FICO.`,
    `If the market anchor is present, keep an approval's APR inside or within one point of the band; the policy table still wins if they conflict.`,
    ``,
    `=== POLICY ===`,
    POLICIES[lender],
  ].join("\n");
}

function underwriterUser(input: UnderwriterInput): string {
  const { policy: _policy, ...rest } = input;
  return `Underwrite this application and return the JSON decision.\n\n${JSON.stringify(rest, null, 2)}`;
}

const COMPLIANCE_SYSTEM = [
  "You write adverse-action notices for an automated lending desk. Plain English, second person (refer to credit.fico9 as the TransUnion score; never write FICO), addressed to the applicant using the literal placeholder {{APPLICANT_NAME}} (the system substitutes the real name; you never see it).",
  "Each entry in `declines` is a lender response that requires notice: classification \"deny\" (declined) or \"counteroffer\" (approved on different terms; state the offered amount, APR and term and that they may accept or decline it).",
  "Name every lender and every reason listed for it, quoting the numbers. Use ONLY the reasons given; each has already been verified by a counterfactual test. Do not add, merge or soften reasons. Group by lender.",
  "Do NOT write the credit-bureau / FCRA paragraph or any legal boilerplate; the system appends the legally required text after yours.",
  "Close with one concrete sentence on what would change the outcome. No marketing. No headings. Return JSON {\"text\": ...} only.",
].join(" ");

// ---------------------------------------------------------------------------
// Claude provider
// ---------------------------------------------------------------------------
type ClaudeResult<T> = { ok: true; value: T; latencyMs: number } | { ok: false; error: string; latencyMs: number };

async function callClaudeJson<T>(opts: {
  model: string;
  system: string;
  user: string;
  format: z.ZodType<any>;
  validate: (raw: unknown) => { success: true; data: T } | { success: false; error: string };
  effort: "low" | "medium";
  maxTokens: number;
  signal?: AbortSignal;
}): Promise<ClaudeResult<T>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const started = Date.now();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.user }];
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    if (opts.signal?.aborted) return { ok: false, error: "aborted", latencyMs: Date.now() - started };
    try {
      const res = await client.messages.create(
        {
          model: opts.model,
          max_tokens: opts.maxTokens,
          system: opts.system,
          messages,
          output_config: { format: zodOutputFormat(opts.format), effort: opts.effort },
        },
        opts.signal ? { signal: opts.signal } : undefined,
      );
      if (res.stop_reason === "refusal") {
        return { ok: false, error: "model refused", latencyMs: Date.now() - started };
      }
      const text = res.content.find((b) => b.type === "text")?.text ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        lastError = `response was not JSON: ${text.slice(0, 200)}`;
        messages.push({ role: "assistant", content: text || "(empty)" });
        messages.push({ role: "user", content: `That was not valid JSON. ${lastError}. Return only the JSON object.` });
        continue;
      }
      const v = opts.validate(parsed);
      if (v.success) return { ok: true, value: v.data, latencyMs: Date.now() - started };
      lastError = v.error;
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content: `Your JSON failed validation: ${v.error}. Fix it and return only the corrected JSON object.`,
      });
    } catch (err: any) {
      // Non-retryable API errors (auth, bad request) should surface immediately.
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.BadRequestError) {
        return { ok: false, error: `${err.name}: ${err.message}`, latencyMs: Date.now() - started };
      }
      lastError = `${err?.name ?? "Error"}: ${err?.message ?? String(err)}`;
    }
  }
  return { ok: false, error: lastError || "validation failed twice", latencyMs: Date.now() - started };
}

const validateUnderwriter = (raw: unknown) => {
  const r = UnderwriterOutputSchema.safeParse(raw);
  return r.success ? ({ success: true, data: r.data } as const) : ({ success: false, error: r.error.message } as const);
};
const validateCompliance = (raw: unknown) => {
  const r = ComplianceOutputSchema.safeParse(raw);
  return r.success ? ({ success: true, data: r.data } as const) : ({ success: false, error: r.error.message } as const);
};

// ---------------------------------------------------------------------------
// CREAO provider (async: start a run, finish on webhook or poll)
// ---------------------------------------------------------------------------
const CREAO_BASE = () => (process.env.CREAO_BASE_URL ?? "https://agent.creao.ai/api/v1").replace(/\/$/, "");
// App API (the shape that worked for Cue at LA Hacks): POST {base}/apps/{appId}/runs with a per-app
// `capi_` key, GET {base}/apps/{appId}/runs/{runId}. Set CREAO_RUNS_STYLE=body to POST {base}/runs
// with appId in the body (and GET {base}/runs/{runId}) if an app is exposed that way instead.
const appPath = () => process.env.CREAO_RUNS_STYLE !== "body";
function creaoAppId(role: Role, lender: Lender | null): string {
  const id =
    role === "compliance"
      ? process.env.CREAO_COMPLIANCE_APP_ID
      : (lender ? process.env[`CREAO_APP_ID_${lender.toUpperCase()}`] : undefined) ?? process.env.CREAO_UNDERWRITER_APP_ID;
  if (!id) throw new Error(`No CREAO app id for ${role}${lender ? ":" + lender : ""} (CREAO_UNDERWRITER_APP_ID / CREAO_APP_ID_<LENDER> / CREAO_COMPLIANCE_APP_ID)`);
  return id;
}
// Per-app key first (CREAO_KEY_CU|FINTECH|PRIME, CREAO_COMPLIANCE_KEY, CREAO_UNDERWRITER_KEY), then the shared CREAO_API_KEY.
function creaoKey(role: Role, lender: Lender | null): string {
  const key =
    (role === "compliance"
      ? process.env.CREAO_COMPLIANCE_KEY
      : (lender ? process.env[`CREAO_KEY_${lender.toUpperCase()}`] : undefined) ?? process.env.CREAO_UNDERWRITER_KEY) ??
    process.env.CREAO_API_KEY;
  if (!key) throw new Error(`No CREAO key for ${role}${lender ? ":" + lender : ""} (CREAO_KEY_<LENDER> / CREAO_COMPLIANCE_KEY / CREAO_API_KEY)`);
  return key;
}
function creaoHeaders(key: string) {
  return { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json" };
}

async function creaoStart(role: Role, lender: Lender | null, inputs: unknown, idempotencyKey: string): Promise<string> {
  const appId = creaoAppId(role, lender);
  const key = creaoKey(role, lender);
  const url = appPath() ? `${CREAO_BASE()}/apps/${encodeURIComponent(appId)}/runs` : `${CREAO_BASE()}/runs`;
  const webhookUrl = process.env.CONVEX_SITE_URL ? `${process.env.CONVEX_SITE_URL}/creao/webhook` : undefined;
  const body: Record<string, unknown> = { inputs, idempotencyKey };
  if (!appPath()) body.appId = appId;
  if (webhookUrl && !/127\.0\.0\.1|localhost/.test(webhookUrl)) body.webhookUrl = webhookUrl;
  const res = await fetch(url, { method: "POST", headers: creaoHeaders(key), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`CREAO start ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json: any = await res.json();
  const runId = json?.id ?? json?.runId ?? json?.run_id;
  if (!runId) throw new Error(`CREAO start returned no run id: ${JSON.stringify(json).slice(0, 300)}`);
  return String(runId);
}

export async function creaoFetchRun(runId: string, role: Role, lender: Lender | null): Promise<{ status: string; text: string | null; error: string | null }> {
  const key = creaoKey(role, lender);
  const url = appPath()
    ? `${CREAO_BASE()}/apps/${encodeURIComponent(creaoAppId(role, lender))}/runs/${encodeURIComponent(runId)}`
    : `${CREAO_BASE()}/runs/${encodeURIComponent(runId)}`;
  const res = await fetch(url, { headers: creaoHeaders(key) });
  if (!res.ok) throw new Error(`CREAO get run ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json: any = await res.json();
  const status = String(json?.status ?? "unknown").toLowerCase();
  const text: string | null = json?.result?.chatText ?? json?.result?.text ?? (typeof json?.result === "string" ? json.result : null);
  const error = json?.error?.message ?? json?.errorCode ?? null;
  return { status, text, error: error ? String(error) : null };
}

/** Pull the last ```json block (or the first {...}) out of an agent reply. */
export function extractJson(text: string): unknown {
  const fence = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  if (fence.length) {
    const last = fence[fence.length - 1][1].trim();
    try {
      return JSON.parse(last);
    } catch {}
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
  throw new Error("no JSON object found in agent reply");
}

// ---------------------------------------------------------------------------
// Shared reads/writes
// ---------------------------------------------------------------------------
export const loadCase = internalQuery({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }) => {
    const applicant = await ctx.db.get(applicantId);
    if (!applicant) throw new Error("applicant not found");
    const bundleDoc = await ctx.db
      .query("bundles")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .order("desc")
      .first();
    if (!bundleDoc) throw new Error("bundle not pulled yet");
    const { raw: _raw, _id, _creationTime, applicantId: _a, source, pulledAt, ...bundle } = bundleDoc;
    const tier = tierForScore(bundle.credit.fico9 ?? bundle.credit.vantage4);
    const rate = await ctx.db
      .query("marketRates")
      .withIndex("by_tier", (q) => q.eq("tier", tier))
      .order("desc")
      .first();
    const marketAnchor: MarketAnchor | null = rate ? { tier, aprLow: rate.aprLow, aprHigh: rate.aprHigh } : null;
    const offers = await ctx.db
      .query("offers")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .collect();
    return { applicant, bundle: bundle as BundleData, marketAnchor, offers, source, pulledAt };
  },
});

export const insertOffer = internalMutation({
  args: {
    applicantId: v.id("applicants"),
    lender: lenderValidator,
    provider: v.union(v.literal("claude"), v.literal("creao")),
    status: v.union(v.literal("pending"), v.literal("done"), v.literal("failed")),
    output: v.union(v.any(), v.null()),
    marketAnchor: v.union(v.any(), v.null()),
    runId: v.union(v.string(), v.null()),
    latencyMs: v.union(v.number(), v.null()),
    note: v.string(),
    actualProvider: v.string(),
    advertisedApr: v.optional(v.union(v.number(), v.null())),
    failureReason: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const o = a.output as UnderwriterOutput | null;
    const applicant = await ctx.db.get(a.applicantId);
    const cls =
      a.status === "done" && o && applicant
        ? classifyOffer(o, { amountRequested: applicant.amountRequested }, a.advertisedApr ?? null)
        : null;
    const offerId = await ctx.db.insert("offers", {
      applicantId: a.applicantId,
      lender: a.lender,
      provider: a.provider,
      status: a.status,
      decision: o?.decision ?? null,
      apr: o?.apr ?? null,
      termMonths: o?.termMonths ?? null,
      amount: o?.amount ?? null,
      conditions: o?.conditions ?? [],
      reasons: o?.reasons ?? [],
      marketAnchor: a.marketAnchor,
      ...(cls ? { classification: cls.classification } : {}),
      ...(a.failureReason ? { failureReason: a.failureReason } : {}),
      ...(o?.apr != null && o.amount != null && o.termMonths != null
        ? { monthlyPayment: monthlyPayment(o.amount, o.apr, o.termMonths), costToBorrow: costToBorrow(o.amount, o.apr, o.termMonths) }
        : {}),
      runId: a.runId,
      shareUrl: null,
      latencyMs: a.latencyMs,
      createdAt: Date.now(),
    });
    await ctx.db.insert("auditEvents", {
      applicantId: a.applicantId,
      at: Date.now(),
      actor: `underwriter:${a.lender}` as const,
      action: a.status === "pending" ? "underwrite.started" : a.status === "done" ? `underwrite.${o?.decision}` : "underwrite.failed",
      ref: String(offerId),
      note: `${a.note} [provider=${a.actualProvider}]${cls ? ` classification=${cls.classification} (${cls.why})` : ""}`,
    });
    return offerId;
  },
});

export const insertAgentRun = internalMutation({
  args: {
    applicantId: v.id("applicants"),
    role: v.union(v.literal("underwriter"), v.literal("compliance")),
    lender: v.union(lenderValidator, v.null()),
    offerId: v.union(v.id("offers"), v.null()),
    runId: v.string(),
    input: v.any(),
  },
  handler: async (ctx, a) => {
    await ctx.db.insert("agentRuns", {
      ...a,
      provider: "creao",
      status: "pending",
      attempts: 0,
      startedAt: Date.now(),
      finishedAt: null,
      error: null,
    });
  },
});

export const insertNotice = internalMutation({
  args: {
    applicantId: v.id("applicants"),
    text: v.string(),
    lendersDeclined: v.array(v.string()),
    note: v.string(),
    lendersCounteroffered: v.optional(v.array(v.string())),
    required: v.optional(v.boolean()),
    requiredBecause: v.optional(v.string()),
    droppedReasons: v.optional(v.array(v.object({ lender: v.string(), field: v.string(), text: v.string() }))),
    fcraSource: v.optional(v.string()),
  },
  handler: async (ctx, a) => {
    const { note: _n, ...fields } = a;
    const id = await ctx.db.insert("notices", { ...fields, createdAt: Date.now() });
    await ctx.db.insert("auditEvents", {
      applicantId: a.applicantId,
      at: Date.now(),
      actor: "compliance",
      action: "compliance.notice",
      ref: String(id),
      note: a.note,
    });
    return id;
  },
});

export const getRunByRunId = internalQuery({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    return await ctx.db
      .query("agentRuns")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .first();
  },
});

export const pendingRuns = internalQuery({
  args: { applicantId: v.id("applicants"), role: v.union(v.literal("underwriter"), v.literal("compliance")) },
  handler: async (ctx, { applicantId, role }) => {
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .collect();
    return runs.filter((r) => r.role === role && r.status === "pending");
  },
});

/** Finish an async run: validate the agent's text, update the offer or write the notice. */
export const completeRun = internalMutation({
  args: {
    runId: v.string(),
    outcome: v.union(v.literal("completed"), v.literal("failed")),
    text: v.union(v.string(), v.null()),
    error: v.union(v.string(), v.null()),
  },
  handler: async (ctx, { runId, outcome, text, error }) => {
    const run = await ctx.db
      .query("agentRuns")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .first();
    if (!run || run.status !== "pending") return { handled: false };
    const latencyMs = Date.now() - run.startedAt;

    let failure: string | null = error;
    let parsed: unknown = null;
    if (outcome === "completed" && text) {
      try {
        parsed = extractJson(text);
      } catch (e: any) {
        failure = `agent reply had no JSON: ${e.message}`;
      }
    } else if (outcome === "completed") {
      failure = "run completed with empty result";
    }

    if (run.role === "underwriter") {
      const val = parsed ? UnderwriterOutputSchema.safeParse(parsed) : null;
      if (!failure && val && !val.success) failure = `validation: ${val.error.message}`;
      if (run.offerId) {
        if (!failure && val?.success) {
          const o = val.data;
          const applicant = await ctx.db.get(run.applicantId);
          const bundleDoc = await ctx.db
            .query("bundles")
            .withIndex("by_applicantId", (q) => q.eq("applicantId", run.applicantId))
            .order("desc")
            .first();
          const score = bundleDoc?.credit.fico9 ?? bundleDoc?.credit.vantage4 ?? null;
          const adv = run.lender ? advertisedApr(run.lender, score, bundleDoc?.credit.fico9 == null) : null;
          const cls = applicant ? classifyOffer(o, { amountRequested: applicant.amountRequested }, adv) : null;
          await ctx.db.patch(run.offerId, {
            status: "done",
            ...(cls ? { classification: cls.classification } : {}),
            decision: o.decision,
            apr: o.apr,
            termMonths: o.termMonths,
            amount: o.amount,
            conditions: o.conditions,
            reasons: o.reasons,
            ...(o.apr != null && o.amount != null && o.termMonths != null
              ? { monthlyPayment: monthlyPayment(o.amount, o.apr, o.termMonths), costToBorrow: costToBorrow(o.amount, o.apr, o.termMonths) }
              : {}),
            latencyMs,
          });
        } else {
          await ctx.db.patch(run.offerId, { status: "failed", latencyMs });
        }
      }
      await ctx.db.insert("auditEvents", {
        applicantId: run.applicantId,
        at: Date.now(),
        actor: `underwriter:${run.lender ?? "cu"}` as const,
        action: failure ? "underwrite.failed" : `underwrite.${(parsed as any)?.decision}`,
        ref: run.offerId ? String(run.offerId) : null,
        note: failure ? `${failure} [provider=creao runId=${runId}]` : `${latencyMs}ms [provider=creao runId=${runId}]`,
      });
    } else {
      const val = parsed ? ComplianceOutputSchema.safeParse(parsed) : null;
      if (!failure && val && !val.success) failure = `validation: ${val.error.message}`;
      if (!failure && val?.success) {
        const offers = await ctx.db
          .query("offers")
          .withIndex("by_applicantId", (q) => q.eq("applicantId", run.applicantId))
          .collect();
        const bundleDoc = await ctx.db
          .query("bundles")
          .withIndex("by_applicantId", (q) => q.eq("applicantId", run.applicantId))
          .order("desc")
          .first();
        const fcra = bundleDoc ? fcraParagraph(bundleDoc.source, bundleDoc.pulledAt) : "";
        const needs = offers.filter((o) => o.status === "done" && (o.classification ?? (o.decision === "decline" ? "deny" : "approve")) !== "approve");
        await ctx.db.insert("notices", {
          applicantId: run.applicantId,
          text: `${fillName(val.data.text.trim(), (await ctx.db.get(run.applicantId))?.name ?? "Applicant")}\n\n${fcra}`,
          lendersDeclined: needs.map((o) => o.lender),
          lendersCounteroffered: needs.filter((o) => o.classification === "counteroffer").map((o) => o.lender),
          required: true,
          fcraSource: fcra,
          createdAt: Date.now(),
        });
      }
      await ctx.db.insert("auditEvents", {
        applicantId: run.applicantId,
        at: Date.now(),
        actor: "compliance",
        action: failure ? "compliance.failed" : "compliance.notice",
        ref: null,
        note: failure ? `${failure} [provider=creao runId=${runId}]` : `${latencyMs}ms [provider=creao runId=${runId}]`,
      });
    }

    await ctx.db.patch(run._id, { status: failure ? "failed" : "done", finishedAt: Date.now(), error: failure });
    return { handled: true, failed: Boolean(failure) };
  },
});

/** Re-fetch a run from CREAO (webhooks are unsigned, so we never trust the payload) and complete it. */
export const verifyAndCompleteRun = internalAction({
  args: { runId: v.string() },
  handler: async (ctx, { runId }): Promise<{ status: string }> => {
    const run = await ctx.runQuery(internal.agents.getRunByRunId, { runId });
    if (!run || run.status !== "pending") return { status: run?.status ?? "unknown" };
    const r = await creaoFetchRun(runId, run.role, run.lender ?? null);
    if (r.status === "completed") {
      await ctx.runMutation(internal.agents.completeRun, { runId, outcome: "completed", text: r.text, error: null });
      return { status: "completed" };
    }
    if (r.status === "failed" || r.status === "cancelled") {
      await ctx.runMutation(internal.agents.completeRun, { runId, outcome: "failed", text: null, error: r.error ?? r.status });
      return { status: "failed" };
    }
    return { status: r.status };
  },
});

/** Poll every pending CREAO run for an applicant; returns how many are still pending. */
export const pollPending = internalAction({
  args: { applicantId: v.id("applicants"), role: v.union(v.literal("underwriter"), v.literal("compliance")) },
  handler: async (ctx, { applicantId, role }): Promise<number> => {
    const runs = await ctx.runQuery(internal.agents.pendingRuns, { applicantId, role });
    let remaining = 0;
    for (const run of runs) {
      try {
        const r = await ctx.runAction(internal.agents.verifyAndCompleteRun, { runId: run.runId });
        if (r.status !== "completed" && r.status !== "failed") remaining++;
      } catch (err: any) {
        console.warn(`poll ${run.runId}: ${err?.message ?? err}`);
        remaining++;
      }
    }
    return remaining;
  },
});

export const failPending = internalMutation({
  args: {
    applicantId: v.id("applicants"),
    role: v.union(v.literal("underwriter"), v.literal("compliance")),
    why: v.string(),
  },
  handler: async (ctx, { applicantId, role, why }) => {
    const runs = await ctx.db
      .query("agentRuns")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .collect();
    for (const run of runs) {
      if (run.role !== role || run.status !== "pending") continue;
      await ctx.db.patch(run._id, { status: "failed", finishedAt: Date.now(), error: why });
      if (run.offerId) await ctx.db.patch(run.offerId, { status: "failed" });
      await ctx.db.insert("auditEvents", {
        applicantId,
        at: Date.now(),
        actor: run.role === "underwriter" ? (`underwriter:${run.lender ?? "cu"}` as const) : "compliance",
        action: run.role === "underwriter" ? "underwrite.failed" : "compliance.failed",
        ref: run.offerId ? String(run.offerId) : null,
        note: `${why} [provider=creao runId=${run.runId}]`,
      });
    }
  },
});

// ---------------------------------------------------------------------------
// One synchronous underwriting call (claude or stub). Used by runUnderwriter and
// by verify.ts for counterfactual re-runs. CREAO is async and is not used here.
// ---------------------------------------------------------------------------
export type OnceResult = { output: UnderwriterOutput | null; latencyMs: number; note: string; actualProvider: "claude" | "stub" };

export async function underwriteOnce(lender: Lender, input: UnderwriterInput, signal?: AbortSignal): Promise<OnceResult> {
  const provider = providerFor("underwriter");
  if (provider === "claude") {
    const r = await callClaudeJson<UnderwriterOutput>({
      model: UNDERWRITER_MODEL,
      system: underwriterSystem(lender),
      user: underwriterUser(input),
      format: UnderwriterFormat,
      validate: validateUnderwriter,
      effort: "low",
      maxTokens: 4096,
      signal,
    });
    return r.ok
      ? { output: r.value, latencyMs: r.latencyMs, note: `${UNDERWRITER_MODEL} ${r.latencyMs}ms`, actualProvider: "claude" }
      : { output: null, latencyMs: r.latencyMs, note: `claude failed: ${r.error}`, actualProvider: "claude" };
  }
  const started = Date.now();
  const output = stubUnderwrite(lender, input);
  return {
    output,
    latencyMs: Date.now() - started,
    note: "deterministic stub (no ANTHROPIC_API_KEY or AGENT_PROVIDER_UNDERWRITER=stub)",
    actualProvider: "stub",
  };
}

// ---------------------------------------------------------------------------
// runAgent entry points (called as workflow steps)
// ---------------------------------------------------------------------------
/** Per-lender timeout (env LENDER_TIMEOUT_MS, default 20000). */
export function lenderTimeoutMs(): number {
  const n = Number(process.env.LENDER_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 20_000;
}

/**
 * underwriteOnce with a hard deadline. On timeout the in-flight request is aborted and
 * `timedOut` is true. LENDER_SIMULATE_HANG=<lender>[,<lender>] makes that lender hang
 * (failure injection for the demo and tests).
 */
export async function underwriteWithTimeout(
  lender: Lender,
  input: UnderwriterInput,
  timeoutMs = lenderTimeoutMs(),
): Promise<OnceResult & { timedOut: boolean }> {
  const ctl = new AbortController();
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => {
      ctl.abort();
      resolve("timeout");
    }, timeoutMs);
  });
  const hang = (process.env.LENDER_SIMULATE_HANG ?? "").split(",").map((x) => x.trim()).includes(lender);
  const work: Promise<OnceResult> = hang ? new Promise<OnceResult>(() => {}) : underwriteOnce(lender, input, ctl.signal);
  try {
    const r = await Promise.race([work, timeout]);
    if (r === "timeout") {
      return {
        output: null,
        latencyMs: Date.now() - started,
        note: `timeout after ${timeoutMs}ms${hang ? " (simulated hang)" : ""}`,
        actualProvider: providerFor("underwriter") === "claude" ? "claude" : "stub",
        timedOut: true,
      };
    }
    return { ...r, timedOut: false };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type AgentStepResult = { status: "done" | "pending" | "failed"; decision?: "approve" | "decline" | null; note: string };

export const runUnderwriter = internalAction({
  args: { applicantId: v.id("applicants"), lender: lenderValidator },
  handler: async (ctx, { applicantId, lender }): Promise<AgentStepResult> => {
    const { applicant, bundle, marketAnchor, offers } = await ctx.runQuery(internal.agents.loadCase, { applicantId });
    // Idempotent under workflow retries.
    const existing = offers.find((o: Doc<"offers">) => o.lender === lender && o.status !== "failed");
    if (existing) return { status: existing.status, decision: existing.decision, note: "already present" };

    const input: UnderwriterInput = buildUnderwriterInput(applicant, bundle, POLICIES[lender], marketAnchor);
    const provider = providerFor("underwriter");

    if (provider === "creao") {
      const offerId: Id<"offers"> = await ctx.runMutation(internal.agents.insertOffer, {
        applicantId,
        lender,
        provider: "creao",
        status: "pending",
        output: null,
        marketAnchor,
        runId: null,
        latencyMs: null,
        note: "CREAO run starting",
        actualProvider: "creao",
      });
      try {
        const runId = await creaoStart("underwriter", lender, { ...input, lender }, `${applicantId}:${lender}`);
        await ctx.runMutation(internal.agents.insertAgentRun, {
          applicantId,
          role: "underwriter",
          lender,
          offerId,
          runId,
          input,
        });
        await ctx.runMutation(internal.agents.setOfferRunId, { offerId, runId });
        return { status: "pending", note: `creao run ${runId}` };
      } catch (err: any) {
        await ctx.runMutation(internal.agents.setOfferRunId, { offerId, runId: null, fail: String(err?.message ?? err) });
        return { status: "failed", note: String(err?.message ?? err) };
      }
    }

    const once = await underwriteWithTimeout(lender, input);
    const output = once.output;
    await ctx.runMutation(internal.agents.insertOffer, {
      applicantId,
      lender,
      provider: "claude",
      status: output ? "done" : "failed",
      output,
      marketAnchor,
      runId: null,
      latencyMs: once.latencyMs,
      note: once.note,
      actualProvider: once.actualProvider,
      ...(output ? {} : { failureReason: once.timedOut ? "timeout" : "error" }),
      advertisedApr: advertisedApr(lender, bundle.credit.fico9 ?? bundle.credit.vantage4, bundle.credit.fico9 == null),
    });
    return { status: output ? "done" : "failed", decision: output?.decision ?? null, note: once.note };
  },
});

export const setOfferRunId = internalMutation({
  args: { offerId: v.id("offers"), runId: v.union(v.string(), v.null()), fail: v.optional(v.string()) },
  handler: async (ctx, { offerId, runId, fail }) => {
    await ctx.db.patch(offerId, fail ? { runId, status: "failed" } : { runId });
  },
});

export const runCompliance = internalAction({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }): Promise<AgentStepResult> => {
    const { applicant, offers, source, pulledAt } = await ctx.runQuery(internal.agents.loadCase, { applicantId });
    const done = offers.filter((o: Doc<"offers">) => o.status === "done");
    const need = noticeRequired(done.map((o: Doc<"offers">) => o.classification ?? (o.decision === "decline" ? "deny" : "approve")));
    if (!need.required) return { status: "done", note: `no notice required: ${need.because}` };

    const dropped: Array<{ lender: string; field: string; text: string }> = [];
    const declines: ComplianceInput["declines"] = [];
    for (const o of done) {
      const cls = o.classification ?? (o.decision === "decline" ? "deny" : "approve");
      if (cls === "approve") continue;
      // Only reasons whose counterfactual flipped the decision reach the notice.
      // Untested reasons (verified null/undefined) are kept; verified=false is dropped.
      let kept = o.reasons.filter((r) => r.verified !== false);
      for (const r of o.reasons) if (r.verified === false) dropped.push({ lender: o.lender, field: r.field, text: r.text });
      if (cls === "deny" && kept.length === 0) {
        // A denial notice must state reasons (ECOA). Fall back to the lender's stated reasons and say so in the audit log.
        kept = o.reasons;
        await ctx.runMutation(internal.audit.log, {
          applicantId,
          actor: "compliance",
          action: "compliance.unverified_reasons_used",
          ref: String(o._id),
          note: `${o.lender}: no reason survived the counterfactual test; notice uses the lender's stated reasons`,
        });
      }
      declines.push({
        lender: o.lender,
        classification: cls,
        offered:
          cls === "counteroffer" && o.amount != null && o.apr != null && o.termMonths != null
            ? { amount: o.amount, apr: o.apr, termMonths: o.termMonths }
            : null,
        reasons: cls === "counteroffer" ? kept.length ? kept : o.conditions.filter((c) => /instead of/i.test(c)).map((c) => ({ text: c, field: "amountRequested" })) : kept,
      });
    }

    // PII boundary: the agent sees a name placeholder, never the applicant's name.
    const input: ComplianceInput = buildComplianceInput(applicant, declines);
    const fcra = fcraParagraph(source, pulledAt);
    const lendersDeclined = declines.map((d) => d.lender);
    const lendersCounteroffered = declines.filter((d) => d.classification === "counteroffer").map((d) => d.lender);
    const common = {
      applicantId,
      lendersDeclined,
      lendersCounteroffered,
      required: true,
      requiredBecause: need.because,
      droppedReasons: dropped,
      fcraSource: fcra,
    };
    const provider = providerFor("compliance");

    if (provider === "creao") {
      try {
        const runId = await creaoStart("compliance", null, input, `${applicantId}:compliance`);
        await ctx.runMutation(internal.agents.insertAgentRun, {
          applicantId,
          role: "compliance",
          lender: null,
          offerId: null,
          runId,
          input,
        });
        return { status: "pending", note: `creao run ${runId}` };
      } catch (err: any) {
        return { status: "failed", note: String(err?.message ?? err) };
      }
    }

    if (provider === "claude") {
      const r = await callClaudeJson<{ text: string }>({
        model: COMPLIANCE_MODEL,
        system: COMPLIANCE_SYSTEM,
        user: `Write the adverse-action notice for this applicant.\n\n${JSON.stringify({ ...input, lenderNames: LENDER_NAMES }, null, 2)}`,
        format: ComplianceFormat,
        validate: validateCompliance,
        effort: "medium",
        maxTokens: 4096,
      });
      if (r.ok) {
        await ctx.runMutation(internal.agents.insertNotice, {
          ...common,
          text: `${fillName(r.value.text.trim(), applicant.name)}\n\n${fcra}`,
          note: `${COMPLIANCE_MODEL} ${r.latencyMs}ms [provider=claude] ${dropped.length} unsupported reason(s) withheld`,
        });
        return { status: "done", note: `${COMPLIANCE_MODEL} ${r.latencyMs}ms; ${dropped.length} unsupported reason(s) withheld` };
      }
      await ctx.runMutation(internal.audit.log, {
        applicantId,
        actor: "compliance",
        action: "compliance.failed",
        ref: null,
        note: `claude failed: ${r.error}; falling back to stub notice`,
      });
    }

    const out = stubCompliance(input);
    await ctx.runMutation(internal.agents.insertNotice, {
      ...common,
      text: `${fillName(out.text, applicant.name)}\n\n${fcra}`,
      note: `deterministic stub notice [provider=stub] ${dropped.length} unsupported reason(s) withheld`,
    });
    return { status: "done", note: `stub notice; ${dropped.length} unsupported reason(s) withheld` };
  },
});

/** Warm-up ping: one tiny Claude call. Returns null latency when no key is set. */
export async function pingClaude(): Promise<{ ok: boolean; ms: number | null; model: string; error?: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, ms: null, model: UNDERWRITER_MODEL, error: "no ANTHROPIC_API_KEY" };
  const started = Date.now();
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    await client.messages.create({
      model: UNDERWRITER_MODEL,
      max_tokens: 8,
      messages: [{ role: "user", content: "Reply with OK." }],
    });
    return { ok: true, ms: Date.now() - started, model: UNDERWRITER_MODEL };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - started, model: UNDERWRITER_MODEL, error: String(e?.message ?? e).slice(0, 200) };
  }
}
