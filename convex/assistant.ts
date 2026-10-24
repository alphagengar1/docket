// Desk assistant: explains what happened for the selected applicant (or the whole desk) in plain
// English. Read-only: it stores nothing and never decides. Everything the model sees is built here
// from the scrubbed projections in pii.ts / labels.ts; the applicant's name never reaches a prompt.
import Anthropic from "@anthropic-ai/sdk";
import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { agentBundle, scrubText } from "./pii";
import { fieldLabel, stopLabel } from "./labels";
import { LENDER_NAMES } from "./policies";
import { noticeRequired } from "./classify";

const ASSISTANT_MODEL = "claude-sonnet-5-5";

const ASSISTANT_SYSTEM = [
  "You are the assistant on a lending desk. A loan officer asks you about applicants who went through an automated pipeline: a credit-bureau pull, hard-stop rules, five lender agents, a compliance notice, and a human decision.",
  "Explain what happened, summarize the audit trail in plain English, and answer only from the context given. Never invent numbers, lenders, reasons or events; if the context does not say, say you do not know.",
  "Cite bundle fields by their plain labels (score, utilization, inquiries, fraud, identity, bankruptcy, eviction), with the number from the context.",
  "Never write the word FICO; say TransUnion score.",
  "A human approves every offer. Remind the reviewer of that when they ask what to do, and refuse to make the approve or decline decision yourself: lay out the facts and what would change the outcome, then leave the call to them.",
  "Reasons marked unverified failed a counterfactual test; say so and note they are kept out of the notice.",
  "Be concise: short paragraphs or flat bullets, no headings, no markdown tables.",
].join(" ");

const SUMMARY_QUESTION =
  "Summarize this applicant in exactly four bullets, each starting with '- ': (1) what came back from the bureau, (2) what each lender decided and why, (3) what verification withheld (reasons that failed the counterfactual test, or say none), (4) what the reviewer should do next (remind that a human approves every offer; do not decide).";

const ACTION_LABEL: Record<string, string> = {
  "step.pull.start": "bureau pull started",
  "step.pull.done": "bureau pull finished",
  "step.guardrails.start": "hard-stop rules started",
  "step.guardrails.done": "hard-stop rules finished",
  "step.underwrite.start": "lenders started",
  "step.underwrite.done": "lenders finished",
  "step.verify.start": "reason verification started",
  "step.verify.done": "reason verification finished",
  "step.compliance.start": "notice drafting started",
  "step.compliance.done": "notice drafted",
  "step.compliance.skipped": "notice skipped",
  "step.human.start": "waiting for a human",
  "step.human.done": "human decision recorded",
  "rules.pass": "no hard-stop rule fired",
  "rules.hard_stop": "hard stop",
  "compliance.notice": "notice written",
  "compliance.failed": "notice failed",
  "compliance.unverified_reasons_used": "notice used unverified reasons",
  "verify.requested": "verification requested",
  "offer.chosen": "borrower chose an offer",
  "notice.approved": "notice approved by a human",
  "override.blocked": "override blocked",
  "dispute.tradeline": "tradeline disputed",
  "replay.started": "replay started",
  "desk.error": "desk error",
  "crs.error": "bureau error",
};

type Turn = { role: "user" | "assistant"; content: string };

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Build the prompt context. Names are removed; all free text goes through scrubText. */
export const context = internalQuery({
  args: { applicantId: v.union(v.id("applicants"), v.null()) },
  handler: async (ctx, { applicantId }): Promise<{ text: string; scope: "applicant" | "desk" }> => {
    if (!applicantId) {
      const applicants = await ctx.db.query("applicants").withIndex("by_createdAt").order("desc").take(200);
      const offers = await ctx.db.query("offers").order("desc").take(600);
      const counts: Record<string, number> = {};
      for (const a of applicants) counts[a.status] = (counts[a.status] ?? 0) + 1;
      const waiting = applicants
        .filter((a) => a.status === "awaiting_human")
        .map((a) => {
          const done = offers.filter((o) => o.applicantId === a._id && o.status === "done");
          const approving = done.filter((o) => o.decision === "approve" && o.apr != null).sort((x, y) => x.apr! - y.apr!);
          return { a, approvals: approving.length, best: approving[0]?.apr ?? null };
        })
        .sort((x, y) => y.approvals - x.approvals || (x.best ?? 999) - (y.best ?? 999) || x.a.createdAt - y.a.createdAt);
      const lines = [
        `DESK OVERVIEW (${applicants.length} applicants)`,
        `Counts by status: ${Object.entries(counts).map(([k, n]) => `${k}=${n}`).join(", ") || "none"}`,
        `Waiting for a human, best first (${waiting.length}):`,
        ...waiting.slice(0, 15).map(
          (w, i) =>
            `${i + 1}. ref ${w.a._id.slice(0, 7)} · ${scrubText(w.a.purpose)} · $${w.a.amountRequested} · ${w.approvals} lender(s) approving${w.best != null ? `, best APR ${w.best}%` : ""}`,
        ),
      ];
      return { text: lines.join("\n"), scope: "desk" };
    }

    const a = await ctx.db.get(applicantId);
    if (!a) throw new Error("applicant not found");
    const strip = (s: string) => scrubText(s.split(a.name).join("the applicant"));
    const bundle = await ctx.db.query("bundles").withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId)).order("desc").first();
    const offers = await ctx.db.query("offers").withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId)).collect();
    const notice = await ctx.db.query("notices").withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId)).order("desc").first();
    const decision = await ctx.db.query("decisions").withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId)).order("desc").first();
    const events = await ctx.db.query("auditEvents").withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId)).order("asc").take(120);

    const L: string[] = [];
    L.push("APPLICANT (name withheld)");
    L.push(`status=${a.status}; purpose=${scrubText(a.purpose)}; requested=$${a.amountRequested}; stated income=$${a.statedIncome}; persona=${a.personaId}${a.replayOf ? "; this is a replay after a dispute" : ""}`);

    if (bundle) {
      const b = agentBundle(bundle);
      L.push("", "BUREAU BUNDLE (plain labels)");
      L.push(`TransUnion score (${fieldLabel("credit.fico9")})=${b.credit.fico9 ?? "n/a"}; ${fieldLabel("credit.vantage4")}=${b.credit.vantage4 ?? "n/a"}; ${fieldLabel("credit.utilization")}=${b.credit.utilization ?? "n/a"}; ${fieldLabel("credit.inquiries6mo")} (6 months)=${b.credit.inquiries6mo}`);
      L.push(`${fieldLabel("fraud.score")} score=${b.fraud.score ?? "n/a"}; fraud signals=${b.fraud.signals.join("; ") || "none"}`);
      L.push(`${fieldLabel("identity.verified")} verified=${b.identity.verified}; identity flags=${b.identity.flags.join("; ") || "none"}`);
      L.push(`flags: ${fieldLabel("flags.bankruptcy")}=${b.flags.bankruptcy}, ${fieldLabel("flags.eviction")}=${b.flags.eviction}, ${fieldLabel("flags.deceased")}=${b.flags.deceased}, ${fieldLabel("flags.frozen")}=${b.flags.frozen}, lien or judgment=${b.flags.lienOrJudgment}`);
      L.push(`tradelines (${b.credit.tradelines.length}): ${b.credit.tradelines.map((t) => `${t.type} $${t.balance} ${t.status}`).join("; ") || "none"}`);
    } else L.push("", "BUREAU BUNDLE: not pulled yet");

    L.push("", "LENDER OFFERS");
    const cls: Array<"approve" | "counteroffer" | "deny"> = [];
    for (const o of offers) {
      const name = LENDER_NAMES[o.lender] ?? o.lender;
      if (o.status !== "done") {
        L.push(`- ${name}: ${o.status}${o.failureReason ? ` (${o.failureReason})` : ""}`);
        continue;
      }
      cls.push(o.classification ?? (o.decision === "decline" ? "deny" : "approve"));
      const terms = o.decision === "approve" ? ` $${o.amount} at ${o.apr}% over ${o.termMonths} months${o.monthlyPayment ? `, $${o.monthlyPayment}/mo` : ""}` : "";
      L.push(`- ${name}: ${o.classification ?? o.decision}${terms}${o.conditions.length ? `; conditions: ${o.conditions.map(scrubText).join("; ")}` : ""}`);
      for (const r of o.reasons) {
        const ver = r.verified === true ? "verified" : r.verified === false ? "UNVERIFIED (failed counterfactual; withheld from notice)" : "not tested";
        L.push(`    reason [${fieldLabel(r.field)}] ${strip(r.text)} (${ver})`);
      }
    }
    if (offers.length === 0) L.push("- none yet");
    const need = noticeRequired(cls);
    L.push(`Adverse-action notice required by rule: ${need.required}${need.because ? ` (${need.because})` : ""}`);

    L.push("", "NOTICE");
    L.push(notice ? `${notice.approvedAt ? "approved" : "drafted, awaiting human approval"}; covers: ${notice.lendersDeclined.join(", ") || "none"}\n${clip(strip(notice.text), 1400)}` : "none written");

    L.push("", "DECISION");
    L.push(decision ? `${decision.outcome} by ${decision.approvedBy}; note: ${strip(decision.note)}` : "no human decision yet");

    L.push("", "AUDIT TRAIL (oldest first)");
    for (const e of events) {
      const label = ACTION_LABEL[e.action] ?? (e.action.startsWith("rules.") && e.ref ? stopLabel(e.ref) : e.action);
      const t = new Date(e.at).toISOString().slice(11, 19);
      L.push(`${t} ${e.actor}: ${label}${e.note ? ` - ${clip(strip(e.note), 140)}` : ""}`);
    }
    return { text: L.join("\n"), scope: "applicant" };
  },
});

type Answer = { text: string; model: string; latencyMs: number; scope: "applicant" | "desk"; stub: boolean };

async function answer(ctxText: string, scope: "applicant" | "desk", question: string, history: Turn[]): Promise<Answer> {
  const started = Date.now();
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      text: `Stub answer: ANTHROPIC_API_KEY is not set on this deployment, so the assistant cannot call Claude. The context it would have used is ${ctxText.split("\n").length} lines about the ${scope === "desk" ? "desk overview" : "selected applicant"}. A human approves every offer.`,
      model: "stub",
      latencyMs: Date.now() - started,
      scope,
      stub: true,
    };
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-10).map((h) => ({ role: h.role, content: scrubText(h.content).slice(0, 4000) })),
    { role: "user", content: `${question}` },
  ];
  // The API requires the first message to be from the user.
  while (messages.length > 1 && messages[0].role !== "user") messages.shift();
  try {
    const res = await client.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: `${ASSISTANT_SYSTEM}\n\n=== CONTEXT (read-only) ===\n${ctxText}`,
      messages,
    });
    const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
    return { text: text || `(the model returned no text; stop_reason=${res.stop_reason}, blocks=${res.content.map((b) => b.type).join(",")})`, model: ASSISTANT_MODEL, latencyMs: Date.now() - started, scope, stub: false };
  } catch (err) {
    const e = err as { name?: string; message?: string };
    return { text: `The assistant could not reach Claude (${e.name ?? "Error"}: ${e.message ?? "unknown"}).`, model: ASSISTANT_MODEL, latencyMs: Date.now() - started, scope, stub: false };
  }
}

export const ask = action({
  args: {
    applicantId: v.optional(v.union(v.id("applicants"), v.null())),
    question: v.string(),
    history: v.array(v.object({ role: v.union(v.literal("user"), v.literal("assistant")), content: v.string() })),
  },
  handler: async (ctx, { applicantId, question, history }): Promise<Answer> => {
    const c: { text: string; scope: "applicant" | "desk" } = await ctx.runQuery(internal.assistant.context, { applicantId: (applicantId ?? null) as Id<"applicants"> | null });
    return await answer(c.text, c.scope, scrubText(question).slice(0, 2000), history);
  },
});

export const summarize = action({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }): Promise<Answer> => {
    const c: { text: string; scope: "applicant" | "desk" } = await ctx.runQuery(internal.assistant.context, { applicantId });
    return await answer(c.text, c.scope, SUMMARY_QUESTION, []);
  },
});
