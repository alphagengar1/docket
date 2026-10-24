// Nightly / on-demand eval: run every persona in personas/map.json through the
// real desk, compare to the answer key, write an evalRuns row.
import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { findPersona } from "./crs.mock";
import { aggregate, scoreCase, type CaseResult, type Expected, type ExpectedPerLender } from "./evalScore";
import map from "../personas/map.json";

const TERMINAL = new Set(["awaiting_human", "hard_stop", "approved", "declined"]);
const POLL_MS = 3_000;
const MAX_WAIT_MS = 8 * 60_000; // actions are capped at 10 minutes

export const cases = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("evalCases").collect(),
});

export const listCases = internalQuery({
  args: {},
  handler: async (ctx) => await ctx.db.query("evalCases").collect(),
});

export const runs = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("evalRuns").withIndex("by_startedAt").order("desc").take(30),
});

export const getLatestEval = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("evalRuns").withIndex("by_startedAt").order("desc").first(),
});

/** Seeds evalCases from personas/map.json when the table is empty. Idempotent. */
export const seedCases = internalMutation({
  args: { force: v.optional(v.boolean()) },
  handler: async (ctx, { force }) => {
    const existing = await ctx.db.query("evalCases").collect();
    if (existing.length && !force) return existing.length;
    for (const row of existing) await ctx.db.delete(row._id);
    for (const c of map.cases) {
      await ctx.db.insert("evalCases", {
        personaId: c.personaId,
        expected: c.expected as Expected,
        expectedReasonsIncludes: c.expectedReasonsIncludes,
        expectedPerLender: (c as { expectedPerLender?: Doc<"evalCases">["expectedPerLender"] }).expectedPerLender,
        note: c.note,
      });
    }
    return map.cases.length;
  },
});

export const beginRun = internalMutation({
  args: { cases: v.number() },
  handler: async (ctx, { cases }) =>
    await ctx.db.insert("evalRuns", {
      startedAt: Date.now(),
      finishedAt: null,
      cases,
      agreement: 0,
      fraudZeroOffers: false,
      avgReasonsPerDenial: 0,
      failures: [],
    }),
});

export const finishRun = internalMutation({
  args: {
    runId: v.id("evalRuns"),
    agreement: v.number(),
    fraudZeroOffers: v.boolean(),
    avgReasonsPerDenial: v.number(),
    failures: v.array(v.object({ personaId: v.string(), expected: v.string(), got: v.string(), why: v.string() })),
    reasonsVerifiedPct: v.number(),
    perLenderAgreement: v.optional(v.union(v.number(), v.null())),
    perLenderMatched: v.optional(v.number()),
    perLenderTotal: v.optional(v.number()),
    perLenderMismatches: v.optional(v.array(v.object({ personaId: v.string(), lender: v.string(), expected: v.string(), got: v.string() }))),
    latencyP50Ms: v.record(v.string(), v.union(v.number(), v.null())),
  },
  handler: async (ctx, { runId, ...rest }) => {
    await ctx.db.patch(runId, { ...rest, finishedAt: Date.now() });
  },
});

export const statuses = internalQuery({
  args: { ids: v.array(v.id("applicants")) },
  handler: async (ctx, { ids }) => {
    const out: Record<string, string> = {};
    for (const id of ids) out[id] = (await ctx.db.get(id))?.status ?? "missing";
    return out;
  },
});

export const observe = internalQuery({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }) => {
    const a = await ctx.db.get(applicantId);
    const offers = await ctx.db
      .query("offers")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .collect();
    const audits = await ctx.db
      .query("auditEvents")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .collect();
    const checks = await ctx.db
      .query("reasonChecks")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .collect();
    return {
      status: a?.status ?? "missing",
      offers: offers.map((o) => ({
        status: o.status,
        decision: o.decision,
        classification: o.classification ?? null,
        reasons: o.reasons.map((r) => ({ field: r.field })),
        lender: o.lender,
        latencyMs: o.latencyMs,
      })),
      hardStopRefs: audits.filter((e) => e.actor === "rules" && e.action === "rules.hard_stop" && e.ref).map((e) => e.ref as string),
      // one row per reason field: verified verdict (leave-one-out overrides single)
      reasonChecks: Object.values(
        checks
          .filter((c) => c.method !== "all_fixed")
          .reduce<Record<string, { flipped: boolean }>>((acc, c) => {
            const key = `${c.lender}:${c.field}`;
            if (c.verified === true) acc[key] = { flipped: true };
            else if (!(key in acc)) acc[key] = { flipped: false };
            return acc;
          }, {}),
      ),
    };
  },
});

export type EvalSummary = {
  runId: Id<"evalRuns">;
  cases: number;
  agreement: number;
  fraudZeroOffers: boolean;
  avgReasonsPerDenial: number;
  failures: Array<{ personaId: string; expected: string; got: string; why: string }>;
  reasonsVerifiedPct: number;
  perLenderAgreement: number | null;
  perLenderMatched: number;
  perLenderTotal: number;
  perLenderMismatches: Array<{ personaId: string; lender: string; expected: string; got: string }>;
  latencyP50Ms: Record<string, number | null>;
};

async function runEvalImpl(ctx: any, keep: boolean): Promise<EvalSummary> {
  await ctx.runMutation(internal.eval.seedCases, {});
  const evalCases: Array<{ personaId: string; expected: Expected; expectedReasonsIncludes: string[]; expectedPerLender?: ExpectedPerLender }> = await ctx.runQuery(internal.eval.listCases, {});
  const runId: Id<"evalRuns"> = await ctx.runMutation(internal.eval.beginRun, { cases: evalCases.length });

  // Start every case in parallel (each is its own durable workflow).
  const started: Array<{ personaId: string; applicantId: Id<"applicants"> }> = [];
  for (const c of evalCases) {
    const persona = findPersona(c.personaId);
    const intake = persona?.defaultIntake ?? { purpose: "eval", amountRequested: 10000, statedIncome: 60000 };
    const applicantId: Id<"applicants"> = await ctx.runMutation(internal.desk.createApplicantInternal, {
      personaId: c.personaId,
      ...intake,
      name: `${persona?.name ?? c.personaId} (eval)`,
    });
    started.push({ personaId: c.personaId, applicantId });
  }

  // Wait for all to reach a terminal status.
  const deadline = Date.now() + MAX_WAIT_MS;
  const ids = started.map((s) => s.applicantId);
  while (Date.now() < deadline) {
    const st: Record<string, string> = await ctx.runQuery(internal.eval.statuses, { ids });
    if (ids.every((id) => TERMINAL.has(st[id]))) break;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  const results: CaseResult[] = [];
  for (const s of started) {
    const c = evalCases.find((x) => x.personaId === s.personaId)!;
    const obs = await ctx.runQuery(internal.eval.observe, { applicantId: s.applicantId });
    results.push(scoreCase(c.personaId, c.expected, c.expectedReasonsIncludes, obs, c.expectedPerLender));
  }
  const agg = aggregate(results);
  await ctx.runMutation(internal.eval.finishRun, {
    runId,
    agreement: agg.agreement,
    fraudZeroOffers: agg.fraudZeroOffers,
    avgReasonsPerDenial: agg.avgReasonsPerDenial,
    failures: agg.failures,
    reasonsVerifiedPct: agg.reasonsVerifiedPct,
    perLenderAgreement: agg.perLenderAgreement,
    perLenderMatched: agg.perLenderMatched,
    perLenderTotal: agg.perLenderTotal,
    perLenderMismatches: agg.perLenderMismatches,
    latencyP50Ms: agg.latencyP50Ms,
  });

  if (!keep) {
    for (const s of started) await ctx.runMutation(internal.desk.deleteApplicantCascade, { applicantId: s.applicantId });
  }
  return { runId, ...agg };
}

/** Eval panel button. `keep: true` leaves the 20 eval applicants on the board. */
export const runEval = action({
  args: { keep: v.optional(v.boolean()) },
  handler: async (ctx, { keep }): Promise<EvalSummary> => runEvalImpl(ctx, keep ?? false),
});

/** Alias of runEval (task spec name). */
export const runEvalNow = action({
  args: { keep: v.optional(v.boolean()) },
  handler: async (ctx, { keep }): Promise<EvalSummary> => runEvalImpl(ctx, keep ?? false),
});

/** Cron target. */
export const runEvalInternal = internalAction({
  args: {},
  handler: async (ctx): Promise<EvalSummary> => runEvalImpl(ctx, false),
});

/** Reseed the answer key after the teammate edits personas/map.json (and redeploys). */
export const reseedCases = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => await ctx.runMutation(internal.eval.seedCases, { force: true }),
});

/**
 * Replay recording: run every persona ONE AT A TIME (so the recorded timings are uncontended,
 * i.e. what a live single run looks like) and snapshot each into the `recordings` table (survives resetBoard) and delete the applicant.
 *  `npx convex run eval:recordAll`. Returns per-persona wall time.
 */
export const recordAll = internalAction({
  args: { personaIds: v.optional(v.array(v.string())) },
  handler: async (ctx, { personaIds }): Promise<Array<{ personaId: string; status: string; wallMs: number }>> => {
    await ctx.runMutation(internal.eval.seedCases, {});
    const cases: Array<{ personaId: string }> = await ctx.runQuery(internal.eval.listCases, {});
    const out: Array<{ personaId: string; status: string; wallMs: number }> = [];
    for (const c of cases) {
      if (personaIds && !personaIds.includes(c.personaId)) continue;
      const persona = findPersona(c.personaId);
      const intake = persona?.defaultIntake ?? { purpose: "eval", amountRequested: 10000, statedIncome: 60000 };
      const t = Date.now();
      const applicantId: Id<"applicants"> = await ctx.runMutation(internal.desk.createApplicantInternal, {
        personaId: c.personaId,
        ...intake,
        name: persona?.name ?? c.personaId,
      });
      let status = "intake";
      while (Date.now() - t < 120_000) {
        const st: Record<string, string> = await ctx.runQuery(internal.eval.statuses, { ids: [applicantId] });
        status = st[applicantId];
        if (TERMINAL.has(status)) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      const wallMs = Date.now() - t;
      if (TERMINAL.has(status)) {
        // hard_stop is set before the notice step runs; let the workflow finish writing.
        await new Promise((r) => setTimeout(r, 2500));
        await ctx.runMutation(internal.desk.saveRecording, { applicantId });
        // Recording is self-contained; keep the board clean.
        await ctx.runMutation(internal.desk.deleteApplicantCascade, { applicantId });
      }
      out.push({ personaId: c.personaId, status, wallMs });
    }
    return out;
  },
});
