// runDesk: the central orchestrator (durable Workflow component) plus the
// public queries/mutations the board uses.
//
// Pipeline-rail audit convention (web/ depends on it): actor "desk", action
// `step.<pull|guardrails|underwrite|compliance|human>.start|done`.
import { WorkflowManager, start, vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import { applicantStatus } from "./schema";
import { writeAudit } from "./audit";
import { findPersona, mockBundle } from "./crs.mock";
import { personaCodes, personaIdForCode } from "./crs.personas";
import { lenderTimeoutMs, pingClaude } from "./agents";
import { LENDER_NAMES } from "./policies";
import { costToBorrow, fcraParagraph, monthlyPayment } from "./classify";
import { evaluateHardStops } from "./rules";
import { stopLabel } from "./labels";
import { LENDERS } from "./types";
import { noticeRequired } from "./classify";
import { demoReplayOn } from "./replay";

export const workflow = new WorkflowManager(components.workflow);

const PENDING_POLL_MS = 5_000;
const PENDING_MAX_POLLS = 18; // 90 s for async (CREAO) agents; after that the run is re-done on Claude

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------
const disputeArg = v.object({ fromApplicantId: v.id("applicants"), tradelineIndex: v.number() });

export const runDeskWorkflow = workflow.define({
  args: { applicantId: v.id("applicants"), dispute: v.optional(disputeArg) },
  handler: async (step, { applicantId, dispute }): Promise<void> => {
    const applicant = await step.runQuery(internal.desk.getApplicant, { applicantId });
    await step.runMutation(internal.market.ensureSeeded, {});

    // 1. pull -------------------------------------------------------------
    await step.runMutation(internal.desk.mark, {
      applicantId,
      status: "pulling",
      action: "step.pull.start",
      note: `persona ${applicant.personaId}`,
    });
    const pulled = await step.runAction(
      internal.crs.pullBundle,
      { applicantId, personaId: applicant.personaId, dispute },
      { retry: true, name: "pullBundle" },
    );
    await step.runMutation(internal.desk.mark, {
      applicantId,
      status: null,
      action: "step.pull.done",
      note: `source=${pulled.source}; ${pulled.note}`,
    });

    // 2. guardrails (code, not prompts) ----------------------------------
    await step.runMutation(internal.desk.mark, { applicantId, status: "guardrails", action: "step.guardrails.start", note: "" });
    const guard = await step.runMutation(internal.desk.guardrails, { applicantId });
    await step.runMutation(internal.desk.mark, {
      applicantId,
      status: null,
      action: "step.guardrails.done",
      note: guard.stop ? `HARD STOP on ${guard.field}` : "passed",
    });
    if (guard.stop) {
      // The notice exists immediately; a human still signs off with desk:approveNotice.
      await step.runMutation(internal.desk.createHardStopNotice, { applicantId });
      return;
    }

    // 3. underwrite every lender in parallel -----------------------------
    await step.runMutation(internal.desk.mark, { applicantId, status: "underwriting", action: "step.underwrite.start", note: LENDERS.join(", ") });
    const results = await Promise.all(
      LENDERS.map((lender) =>
        step.runAction(internal.agents.runUnderwriter, { applicantId, lender }, { retry: true, name: `underwrite:${lender}` }),
      ),
    );
    let pending = results.filter((r) => r.status === "pending").length;
    for (let i = 0; pending > 0 && i < PENDING_MAX_POLLS; i++) {
      await step.sleep(PENDING_POLL_MS, { name: `wait-underwriters-${i}` });
      pending = await step.runAction(internal.agents.pollPending, { applicantId, role: "underwriter" }, { name: `poll-underwriters-${i}` });
    }
    if (pending > 0) {
      await step.runMutation(internal.agents.failPending, { applicantId, role: "underwriter", why: "timed out waiting for async agent" });
      await step.runAction(internal.agents.fallbackFailedRuns, { applicantId, role: "underwriter" }, { name: "fallback-underwriters" });
    }
    const summary = await step.runQuery(internal.desk.offerSummary, { applicantId });
    await step.runMutation(internal.desk.mark, {
      applicantId,
      status: null,
      action: "step.underwrite.done",
      note: `${summary.approvals} approve (${summary.counteroffers} counteroffer), ${summary.declines} decline, ${summary.failed} failed`,
    });

    // 3b. counterfactual reason test for every decline -------------------
    // Runs BEFORE compliance so the notice is built from verified reasons only.
    if (summary.declineOfferIds.length > 0) {
      await step.runMutation(internal.desk.mark, { applicantId, status: null, action: "step.verify.start", note: `${summary.declineOfferIds.length} decline(s) to test` });
      const checks = await Promise.all(
        summary.declineOfferIds.map((offerId) =>
          step.runAction(internal.verify.verifyReasons, { offerId }, { retry: true, name: `verify:${offerId}` }),
        ),
      );
      const checked = checks.reduce((a, c) => a + c.checked, 0);
      const flipped = checks.reduce((a, c) => a + c.flipped, 0);
      const unsupported = checks.reduce((a, c) => a + c.unsupported, 0);
      await step.runMutation(internal.desk.mark, {
        applicantId,
        status: null,
        action: "step.verify.done",
        note: `${checked} reasons tested: ${flipped} flipped (verified), ${unsupported} unsupported (withheld from notice)`,
      });
    }

    // 4. compliance: required for any deny or counteroffer -----------------
    if (summary.noticeRequired) {
      await step.runMutation(internal.desk.mark, { applicantId, status: "compliance", action: "step.compliance.start", note: summary.noticeBecause });
      const c = await step.runAction(internal.agents.runCompliance, { applicantId }, { retry: true, name: "compliance" });
      let cPending = c.status === "pending" ? 1 : 0;
      for (let i = 0; cPending > 0 && i < PENDING_MAX_POLLS; i++) {
        await step.sleep(PENDING_POLL_MS, { name: `wait-compliance-${i}` });
        cPending = await step.runAction(internal.agents.pollPending, { applicantId, role: "compliance" }, { name: `poll-compliance-${i}` });
      }
      if (cPending > 0) {
        await step.runMutation(internal.agents.failPending, { applicantId, role: "compliance", why: "timed out waiting for async agent" });
        await step.runAction(internal.agents.fallbackFailedRuns, { applicantId, role: "compliance" }, { name: "fallback-compliance" });
      }
      await step.runMutation(internal.desk.mark, { applicantId, status: null, action: "step.compliance.done", note: c.note });
    } else {
      await step.runMutation(internal.desk.mark, { applicantId, status: null, action: "step.compliance.skipped", note: summary.noticeBecause });
    }

    // 5. ready for the human ---------------------------------------------
    await step.runMutation(internal.desk.mark, {
      applicantId,
      status: "awaiting_human",
      action: "step.human.start",
      note: "awaiting loan officer",
    });
  },
});

export const onDeskComplete = internalMutation({
  args: { workflowId: vWorkflowId, result: vResultValidator, context: v.any() },
  handler: async (ctx, { result, context }) => {
    const applicantId = context.applicantId as Id<"applicants">;
    if (result.kind === "success") return;
    const applicant = await ctx.db.get(applicantId);
    if (!applicant) return;
    const why = result.kind === "failed" ? (result as { error?: string }).error ?? "failed" : "canceled";
    await writeAudit(ctx, { applicantId, actor: "desk", action: "desk.error", note: String(why).slice(0, 500) });
    if (applicant.status !== "hard_stop" && applicant.status !== "approved" && applicant.status !== "declined") {
      await ctx.db.patch(applicantId, { status: "awaiting_human" });
      await writeAudit(ctx, { applicantId, actor: "desk", action: "step.human.start", note: "pipeline errored; see desk.error" });
    }
  },
});

/** Kick off the workflow for an existing applicant (used by createApplicant and eval). */
export async function startDesk(
  ctx: { scheduler: any; db: any; runMutation: any },
  applicantId: Id<"applicants">,
  dispute?: { fromApplicantId: Id<"applicants">; tradelineIndex: number },
) {
  return await start(ctx as any, internal.desk.runDeskWorkflow, { applicantId, dispute }, {
    onComplete: internal.desk.onDeskComplete,
    context: { applicantId },
  });
}

// ---------------------------------------------------------------------------
// Internal steps
// ---------------------------------------------------------------------------
export const getApplicant = internalQuery({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }) => {
    const a = await ctx.db.get(applicantId);
    if (!a) throw new Error("applicant not found");
    return a;
  },
});

export const mark = internalMutation({
  args: {
    applicantId: v.id("applicants"),
    status: v.union(applicantStatus, v.null()),
    action: v.string(),
    note: v.string(),
  },
  handler: async (ctx, { applicantId, status, action, note }) => {
    if (status) {
      // Do not regress a borrower who already chose an offer back to a working status.
      const cur = await ctx.db.get(applicantId);
      const chosen = cur?.status === "awaiting_human" && cur.chosenOfferId;
      if (!(chosen && status !== "awaiting_human")) await ctx.db.patch(applicantId, { status });
    }
    await writeAudit(ctx, { applicantId, actor: "desk", action, note });
  },
});

export const guardrails = internalMutation({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }): Promise<{ stop: boolean; field: string | null }> => {
    const bundle = await ctx.db
      .query("bundles")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .order("desc")
      .first();
    if (!bundle) throw new Error("no bundle");
    const r = evaluateHardStops(bundle);
    if (!r.stop) {
      await writeAudit(ctx, { applicantId, actor: "rules", action: "rules.pass", note: "no hard-stop rule fired" });
      return { stop: false, field: null };
    }
    for (const f of r.all) {
      await writeAudit(ctx, { applicantId, actor: "rules", action: "rules.hard_stop", ref: f.field, note: f.reason });
    }
    await ctx.db.patch(applicantId, { status: "hard_stop" });
    return { stop: true, field: r.field };
  },
});

export const offerSummary = internalQuery({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }) => {
    const offers = await ctx.db
      .query("offers")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .collect();
    const done = offers.filter((o) => o.status === "done");
    const cls = done.map((o) => o.classification ?? (o.decision === "decline" ? ("deny" as const) : ("approve" as const)));
    const need = noticeRequired(cls);
    return {
      approvals: done.filter((o) => o.decision === "approve").length,
      counteroffers: cls.filter((c) => c === "counteroffer").length,
      declines: done.filter((o) => o.decision === "decline").length,
      failed: offers.filter((o) => o.status === "failed").length,
      pending: offers.filter((o) => o.status === "pending").length,
      declineOfferIds: done.filter((o) => o.decision === "decline").map((o) => o._id),
      noticeRequired: need.required,
      noticeBecause: need.because,
    };
  },
});

export const createApplicantInternal = internalMutation({
  args: {
    personaId: v.string(),
    purpose: v.string(),
    amountRequested: v.number(),
    statedIncome: v.number(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"applicants">> => {
    // eval / recordAll measure the live desk: never replay for them
    return await createAndStart(ctx, { ...args, live: true });
  },
});

async function createAndStart(
  ctx: any,
  args: {
    personaId: string;
    purpose: string;
    amountRequested: number;
    statedIncome: number;
    name?: string;
    cardCode?: string;
    replayOf?: Id<"applicants">;
    replayNote?: string;
    dispute?: { fromApplicantId: Id<"applicants">; tradelineIndex: number };
    live?: boolean;
  },
): Promise<Id<"applicants">> {
  const persona = findPersona(args.personaId);
  const name = args.name ?? persona?.name ?? args.personaId;
  const now = Date.now();
  const applicantId: Id<"applicants"> = await ctx.db.insert("applicants", {
    personaId: args.personaId,
    name,
    purpose: args.purpose,
    amountRequested: args.amountRequested,
    statedIncome: args.statedIncome,
    consentAt: now,
    status: "intake",
    createdAt: now,
    ...((args.cardCode ?? personaCodes[args.personaId]) ? { cardCode: args.cardCode ?? personaCodes[args.personaId] } : {}),
    ...(args.replayOf ? { replayOf: args.replayOf, replayNote: args.replayNote ?? "" } : {}),
  });
  await writeAudit(ctx, {
    applicantId,
    actor: "intake",
    action: args.replayOf ? "intake.replay" : "intake.submitted",
    ref: args.replayOf ? String(args.replayOf) : null,
    note: args.replayOf
      ? `replay of ${args.replayOf}: ${args.replayNote ?? ""}`
      : `${name}: $${args.amountRequested} for ${args.purpose}, stated income $${args.statedIncome}, consent recorded`,
  });
  if (!args.live && !args.dispute && demoReplayOn()) {
    // DEMO_REPLAY=1: re-create the recorded run for this persona; no live model or bureau call.
    const rec = await ctx.db.query("recordings").withIndex("by_personaId", (q: any) => q.eq("personaId", args.personaId)).order("desc").first();
    if (rec) {
      await ctx.scheduler.runAfter(0, internal.replay.playRecording, { applicantId, recordingId: rec._id });
      return applicantId;
    }
  }
  await startDesk(ctx, applicantId, args.dispute);
  return applicantId;
}

/**
 * Dispute-and-replay (design/differentiators.md #3). The applicant disputes one
 * tradeline; a linked applicant row (replayOf) re-runs the whole desk on a
 * corrected bundle so the board can diff before/after.
 */
export const disputeTradeline = mutation({
  args: { applicantId: v.id("applicants"), tradelineIndex: v.number(), note: v.optional(v.string()) },
  handler: async (ctx, { applicantId, tradelineIndex, note }): Promise<Id<"applicants">> => {
    const original = await ctx.db.get(applicantId);
    if (!original) throw new Error("applicant not found");
    // A dispute re-runs the live desk on a corrected bureau file; replay mode never goes live.
    if (demoReplayOn()) throw new Error("Disputes are paused in replay mode: this session is replaying recorded decisions. The dispute re-run is available in live mode.");
    const bundle = await ctx.db
      .query("bundles")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .order("desc")
      .first();
    if (!bundle) throw new Error("no bundle to dispute yet");
    const tl = bundle.credit.tradelines[tradelineIndex];
    if (!tl) throw new Error(`tradelineIndex ${tradelineIndex} out of range`);
    const desc = `${tl.type} ${tl.status} $${tl.balance} opened ${tl.openedAt}`;
    await writeAudit(ctx, {
      applicantId,
      actor: "applicant",
      action: "dispute.tradeline",
      ref: `credit.tradelines[${tradelineIndex}]`,
      note: `disputed ${desc}${note ? " — " + note : ""}`,
    });
    const replayId = await createAndStart(ctx, {
      personaId: original.personaId,
      purpose: original.purpose,
      amountRequested: original.amountRequested,
      statedIncome: original.statedIncome,
      name: original.name,
      replayOf: applicantId,
      replayNote: `disputed credit.tradelines[${tradelineIndex}] (${desc})`,
      dispute: { fromApplicantId: applicantId, tradelineIndex },
    });
    await writeAudit(ctx, { applicantId, actor: "desk", action: "replay.started", ref: String(replayId), note: `re-running all ${LENDERS.length} lenders on the corrected bundle` });
    return replayId;
  },
});

// ---------------------------------------------------------------------------
// Public API (web/src/hooks/useDesk.convex.ts expects these names)
// ---------------------------------------------------------------------------
const stripRaw = (b: Doc<"bundles">) => {
  const { raw: _raw, ...rest } = b;
  return rest;
};

export const createApplicant = mutation({
  args: {
    personaId: v.optional(v.string()),
    cardCode: v.optional(v.string()),
    purpose: v.optional(v.string()),
    amountRequested: v.optional(v.number()),
    statedIncome: v.optional(v.number()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"applicants">> => {
    let personaId = args.personaId;
    if (args.cardCode) {
      const fromCode = personaIdForCode(args.cardCode);
      if (!fromCode) throw new Error(`unknown card code ${args.cardCode}`);
      if (personaId && personaId !== fromCode) throw new Error("cardCode and personaId disagree");
      personaId = fromCode;
    }
    if (!personaId) throw new Error("personaId or cardCode is required");
    const persona = findPersona(personaId);
    if (!persona && (process.env.CRS_PROVIDER ?? "mock") !== "crs") {
      throw new Error(`unknown personaId ${personaId}`);
    }
    const d = persona?.defaultIntake ?? { purpose: "personal", amountRequested: 10000, statedIncome: 60000 };
    const purpose = args.purpose ?? d.purpose;
    const amountRequested = args.amountRequested ?? d.amountRequested;
    const statedIncome = args.statedIncome ?? d.statedIncome;
    if (amountRequested <= 0 || statedIncome < 0) throw new Error("amount and income must be positive");
    return await createAndStart(ctx, {
      personaId,
      purpose,
      amountRequested,
      statedIncome,
      ...(args.name ? { name: args.name } : {}),
      ...(args.cardCode ? { cardCode: args.cardCode.trim() } : {}),
    });
  },
});

export const listApplicants = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("applicants").withIndex("by_createdAt").order("desc").take(200);
  },
});

export const bundles = query({
  args: {},
  handler: async (ctx) => (await ctx.db.query("bundles").order("desc").take(200)).map(stripRaw),
});
export const offers = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("offers").order("desc").take(600),
});
export const notices = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("notices").order("desc").take(200),
});
export const decisions = query({
  args: {},
  handler: async (ctx) => await ctx.db.query("decisions").order("desc").take(200),
});
export const auditEvents = query({
  args: { limit: v.optional(v.number()), applicantId: v.optional(v.id("applicants")) },
  handler: async (ctx, { limit, applicantId }) => {
    const n = Math.min(limit ?? 500, 2000);
    if (applicantId) {
      return await ctx.db
        .query("auditEvents")
        .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
        .order("asc")
        .take(n);
    }
    return (await ctx.db.query("auditEvents").order("desc").take(n)).reverse();
  },
});

async function buildView(ctx: QueryCtx, applicantId: Id<"applicants">) {
  const applicant = await ctx.db.get(applicantId);
  if (!applicant) return null;
  const bundleDoc = await ctx.db
    .query("bundles")
    .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
    .order("desc")
    .first();
  return {
    applicant,
    bundle: bundleDoc ? stripRaw(bundleDoc) : null,
    offers: await ctx.db
      .query("offers")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .collect(),
    notice: await ctx.db
      .query("notices")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .order("desc")
      .first(),
    decision: await ctx.db
      .query("decisions")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .order("desc")
      .first(),
    auditEvents: await ctx.db
      .query("auditEvents")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .order("asc")
      .collect(),
    reasonChecks: await ctx.db
      .query("reasonChecks")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .collect(),
    replays: (await ctx.db.query("applicants").withIndex("by_replayOf", (q) => q.eq("replayOf", applicantId)).collect()).map((a) => a._id),
  };
}

export const getApplicantView = query({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }) => buildView(ctx, applicantId),
});

/** One applicant's full view, or (with no id) the most recent applicant's. */
export const board = query({
  args: { applicantId: v.optional(v.id("applicants")) },
  handler: async (ctx, { applicantId }) => {
    const id = applicantId ?? (await ctx.db.query("applicants").withIndex("by_createdAt").order("desc").first())?._id;
    if (!id) return null;
    return buildView(ctx, id);
  },
});

export const approveOffer = mutation({
  args: { applicantId: v.id("applicants"), offerId: v.id("offers"), note: v.optional(v.string()) },
  handler: async (ctx, { applicantId, offerId, note }) => {
    const applicant = await ctx.db.get(applicantId);
    if (!applicant) throw new Error("applicant not found");
    const offer = await ctx.db.get(offerId);
    if (!offer || offer.applicantId !== applicantId) throw new Error("offer does not belong to applicant");
    if (offer.status !== "done" || offer.decision !== "approve") throw new Error("only an approved offer can be accepted");
    if (applicant.status !== "awaiting_human") throw new Error(`applicant is ${applicant.status}, not awaiting_human`);
    const id = await ctx.db.insert("decisions", {
      applicantId,
      chosenOfferId: String(offerId),
      outcome: "approved",
      approvedBy: "human",
      at: Date.now(),
      note: note ?? "",
    });
    await ctx.db.patch(applicantId, { status: "approved" });
    await writeAudit(ctx, {
      applicantId,
      actor: "human",
      action: "step.human.done",
      ref: String(offerId),
      note: `approved ${offer.lender} offer: $${offer.amount} at ${offer.apr}% for ${offer.termMonths} months${note ? " — " + note : ""}`,
    });
    return id;
  },
});

/** Alias of approveOffer (task spec name). */
export const approve = mutation({
  args: { applicantId: v.id("applicants"), offerId: v.id("offers"), note: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Id<"decisions">> => {
    return await ctx.runMutation(internal.desk.approveInternal, args);
  },
});
export const approveInternal = internalMutation({
  args: { applicantId: v.id("applicants"), offerId: v.id("offers"), note: v.optional(v.string()) },
  handler: async (ctx, args): Promise<Id<"decisions">> => {
    // Same body as approveOffer; kept separate so `approve` has no self-reference.
    const applicant = await ctx.db.get(args.applicantId);
    if (!applicant) throw new Error("applicant not found");
    const offer = await ctx.db.get(args.offerId);
    if (!offer || offer.applicantId !== args.applicantId) throw new Error("offer does not belong to applicant");
    if (offer.status !== "done" || offer.decision !== "approve") throw new Error("only an approved offer can be accepted");
    if (applicant.status !== "awaiting_human") throw new Error(`applicant is ${applicant.status}, not awaiting_human`);
    const id = await ctx.db.insert("decisions", {
      applicantId: args.applicantId,
      chosenOfferId: String(args.offerId),
      outcome: "approved",
      approvedBy: "human",
      at: Date.now(),
      note: args.note ?? "",
    });
    await ctx.db.patch(args.applicantId, { status: "approved" });
    await writeAudit(ctx, {
      applicantId: args.applicantId,
      actor: "human",
      action: "step.human.done",
      ref: String(args.offerId),
      note: `approved ${offer.lender} offer: $${offer.amount} at ${offer.apr}% for ${offer.termMonths} months`,
    });
    return id;
  },
});

export const declineApplicant = mutation({
  args: { applicantId: v.id("applicants"), note: v.optional(v.string()) },
  handler: async (ctx, { applicantId, note }) => {
    const applicant = await ctx.db.get(applicantId);
    if (!applicant) throw new Error("applicant not found");
    if (applicant.status !== "awaiting_human") throw new Error(`applicant is ${applicant.status}, not awaiting_human`);
    const id = await ctx.db.insert("decisions", {
      applicantId,
      chosenOfferId: null,
      outcome: "declined",
      approvedBy: "human",
      at: Date.now(),
      note: note ?? "",
    });
    await ctx.db.patch(applicantId, { status: "declined" });
    await writeAudit(ctx, { applicantId, actor: "human", action: "step.human.done", note: `declined by loan officer${note ? " — " + note : ""}` });
    return id;
  },
});

async function cascadeDelete(ctx: MutationCtx, applicantId: Id<"applicants">) {
  for (const table of ["bundles", "offers", "notices", "decisions", "auditEvents", "agentRuns", "reasonChecks"] as const) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
  }
  await ctx.db.delete(applicantId);
}

/** Delete an applicant and every row that hangs off it (eval cleanup / demo reset). */
export const deleteApplicantCascade = internalMutation({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }) => {
    await cascadeDelete(ctx, applicantId);
  },
});

// ---------------------------------------------------------------------------
// Demo Day Kit: card codes, borrower (phone) API, operator controls, replay.
// All additions; nothing above changed shape.
// ---------------------------------------------------------------------------

/** Card code -> persona + suggested intake. Null if the code is unknown. */
export const lookupCode = query({
  args: { code: v.string() },
  handler: async (_ctx, { code }) => {
    const personaId = personaIdForCode(code);
    if (!personaId) return null;
    const p = findPersona(personaId);
    if (!p) return null;
    return {
      code: personaCodes[personaId],
      personaId,
      displayName: p.name,
      name: p.name,
      purpose: p.defaultIntake.purpose,
      amountRequested: p.defaultIntake.amountRequested,
      statedIncome: p.defaultIntake.statedIncome,
    };
  },
});

type BorrowerStatus = "checking" | "offers" | "waiting_for_underwriter" | "approved" | "declined" | "stopped";

/** Everything the phone may show. No bureau data, no scores, no reasons, no SSN. */
export const borrowerView = query({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }) => {
    const a = await ctx.db.get(applicantId);
    if (!a) return null;
    const offerRows = await ctx.db
      .query("offers")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .collect();
    const offers = offerRows
      .filter((o) => o.status === "done" && o.decision === "approve" && o.apr != null && o.amount != null && o.termMonths != null)
      .map((o) => ({
        offerId: o._id,
        lender: o.lender,
        lenderName: LENDER_NAMES[o.lender],
        apr: o.apr as number,
        monthlyPayment: o.monthlyPayment ?? monthlyPayment(o.amount as number, o.apr as number, o.termMonths as number),
        costToBorrow: o.costToBorrow ?? costToBorrow(o.amount as number, o.apr as number, o.termMonths as number),
        termMonths: o.termMonths as number,
        amount: o.amount as number,
        classification: o.classification ?? ("approve" as const),
      }))
      .sort((x, y) => x.apr - y.apr);
    const notice = await ctx.db
      .query("notices")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .order("desc")
      .first();

    let status: BorrowerStatus;
    switch (a.status) {
      case "hard_stop":
        status = "stopped";
        break;
      case "approved":
        status = "approved";
        break;
      case "declined":
        status = "declined";
        break;
      case "awaiting_human":
        status = a.chosenOfferId || offers.length === 0 ? "waiting_for_underwriter" : "offers";
        break;
      case "underwriting":
      case "compliance":
        status = offers.length > 0 ? "offers" : "checking";
        break;
      default:
        status = "checking";
    }
    return {
      applicantId,
      name: a.name,
      cardCode: a.cardCode ?? null,
      purpose: a.purpose,
      amountRequested: a.amountRequested,
      status,
      offers,
      chosenOfferId: a.chosenOfferId ?? null,
      // The notice is shown only after a human approved sending it.
      noticeText: notice?.approvedAt ? notice.text : null,
      noticeReady: !!notice && !notice.approvedAt,
      canOverride: false as const,
      overrideAttempts: a.overrideAttempts ?? 0,
      overrideResult: a.overrideResult ?? null,
    };
  },
});

/** Borrower picks an offer. Escalates to the human underwriter (status awaiting_human). */
export const chooseOffer = mutation({
  args: { applicantId: v.id("applicants"), offerId: v.id("offers") },
  handler: async (ctx, { applicantId, offerId }) => {
    const a = await ctx.db.get(applicantId);
    if (!a) throw new Error("applicant not found");
    const o = await ctx.db.get(offerId);
    if (!o || o.applicantId !== applicantId) throw new Error("offer does not belong to applicant");
    if (o.status !== "done" || o.decision !== "approve") throw new Error("that offer is not available");
    if (a.status === "approved" || a.status === "declined" || a.status === "hard_stop") throw new Error(`application is ${a.status}`);
    await ctx.db.patch(applicantId, { chosenOfferId: offerId, status: "awaiting_human" });
    await writeAudit(ctx, {
      applicantId,
      actor: "applicant",
      action: "offer.chosen",
      ref: String(offerId),
      note: `chose ${o.lender}: $${o.amount} at ${o.apr}% for ${o.termMonths} months; escalated to underwriter`,
    });
    return { ok: true as const };
  },
});

/**
 * The judge, as reviewer, tries to fund a stopped file. ALWAYS refused: a hard stop is a coded rule,
 * and no person or model can override it from this surface.
 */
export const attemptOverride = mutation({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }): Promise<{ blocked: true; reason: string }> => {
    const a = await ctx.db.get(applicantId);
    if (!a) throw new Error("applicant not found");
    const stops = (
      await ctx.db
        .query("auditEvents")
        .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
        .collect()
    ).filter((e) => e.actor === "rules" && e.action === "rules.hard_stop");
    const ref = stops[0]?.ref ?? null;
    const reason = a.status === "hard_stop" ? "Override blocked: fraud review required" : "Override blocked: no override path exists for this application";
    const attempts = (a.overrideAttempts ?? 0) + 1;
    await ctx.db.patch(applicantId, { overrideAttempts: attempts, overrideResult: reason });
    await writeAudit(ctx, {
      applicantId,
      actor: "human",
      action: "override.blocked",
      ref,
      note: `${reason}${ref ? ` (rule ${ref})` : ""}; attempt ${attempts}`,
    });
    return { blocked: true, reason };
  },
});

const BUREAU_CONTACTS =
  "Equifax 1-800-685-1111, Experian 1-888-397-3742, TransUnion 1-800-916-8800";

function hardStopNotice(name: string, amount: number, purpose: string, fields: string[], source: "crs" | "nessie" | "mock", pulledAt: number): string {
  const unique = [...new Set(fields.length ? fields : ["unknown"])];
  const reasons = unique.map((f) => `- ${stopLabel(f)}.`).join("\n");
  return [
    `Dear ${name}, we could not process your request for $${amount.toLocaleString("en-US")} (${purpose}). No lender reviewed your application.`,
    `The reason${unique.length > 1 ? "s" : ""}:\n${reasons}`,
    `If this information is wrong, for example if the file is marked in error, you can correct it: contact the credit bureau directly (${BUREAU_CONTACTS}) and dispute the item. Once it is corrected you are welcome to apply again.`,
    fcraParagraph(source, pulledAt),
    "The federal Equal Credit Opportunity Act (ECOA) prohibits creditors from discriminating against credit applicants on the basis of race, color, religion, national origin, sex, marital status, age, receipt of public assistance income, or the good-faith exercise of rights under consumer credit laws.",
  ].join("\n\n");
}

async function ensureHardStopNotice(ctx: MutationCtx, applicantId: Id<"applicants">): Promise<Doc<"notices">> {
  const existing = await ctx.db.query("notices").withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId)).order("desc").first();
  if (existing) return existing;
  const a = await ctx.db.get(applicantId);
  if (!a) throw new Error("applicant not found");
  const audits = await ctx.db.query("auditEvents").withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId)).collect();
  const fields = audits.filter((e) => e.actor === "rules" && e.action === "rules.hard_stop" && e.ref).map((e) => e.ref as string);
  const bundle = await ctx.db.query("bundles").withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId)).order("desc").first();
  const text = hardStopNotice(a.name, a.amountRequested, a.purpose, fields, bundle?.source ?? "mock", bundle?.pulledAt ?? Date.now());
  const id = await ctx.db.insert("notices", {
    applicantId,
    text,
    lendersDeclined: [],
    createdAt: Date.now(),
    required: true,
    requiredBecause: "hard stop: no lender reviewed the file",
    fcraSource: fcraParagraph(bundle?.source ?? "mock", bundle?.pulledAt ?? Date.now()),
  });
  await writeAudit(ctx, { applicantId, actor: "compliance", action: "compliance.notice", ref: String(id), note: "adverse-action notice generated at hard stop (code template, no model); awaiting human sign-off" });
  return (await ctx.db.get(id))!;
}

/** Workflow step: write the hard-stop notice as soon as the stop fires. */
export const createHardStopNotice = internalMutation({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }) => {
    await ensureHardStopNotice(ctx, applicantId);
  },
});

/**
 * Human signs off on the adverse-action notice (sets approvedAt). For a hard stop the notice already
 * exists (created by the workflow; created here if the workflow had not reached it). Sets the
 * applicant to "declined" when there is nothing left to approve.
 */
export const approveNotice = mutation({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }) => {
    const a = await ctx.db.get(applicantId);
    if (!a) throw new Error("applicant not found");
    const offerRows = await ctx.db
      .query("offers")
      .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
      .collect();
    const approvable = offerRows.some((o) => o.status === "done" && o.decision === "approve");
    const wasHardStop = a.status === "hard_stop";
    let notice = await ctx.db.query("notices").withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId)).order("desc").first();
    if (!notice) {
      if (!wasHardStop) throw new Error("no notice exists for this applicant");
      notice = await ensureHardStopNotice(ctx, applicantId);
    }
    if (!notice.approvedAt) await ctx.db.patch(notice._id, { approvedAt: Date.now() });
    await writeAudit(ctx, { applicantId, actor: "human", action: "notice.approved", ref: String(notice._id), note: "human approved sending the adverse-action notice" });

    if (wasHardStop || (a.status === "awaiting_human" && !approvable)) {
      await ctx.db.patch(applicantId, { status: "declined" });
      await ctx.db.insert("decisions", {
        applicantId,
        chosenOfferId: null,
        outcome: wasHardStop ? "hard_stop" : "declined",
        approvedBy: "human",
        at: Date.now(),
        note: "adverse-action notice approved; no offer to fund",
      });
    }
    return { ok: true as const, noticeId: notice._id };
  },
});

// ---------------------------------------------------------------------------
// Operator controls
// ---------------------------------------------------------------------------
const RESET_BATCH = 8;

async function resetBatch(ctx: MutationCtx): Promise<{ deleted: number; remaining: boolean }> {
  const rows = await ctx.db.query("applicants").take(RESET_BATCH + 1);
  const batch = rows.slice(0, RESET_BATCH);
  for (const a of batch) await cascadeDelete(ctx, a._id);
  const remaining = rows.length > RESET_BATCH;
  if (remaining) await ctx.scheduler.runAfter(0, internal.desk.resetBoardStep, {});
  return { deleted: batch.length, remaining };
}

/** Delete every applicant and its rows. Keeps evalCases, evalRuns, marketRates, secretsCache. */
export const resetBoard = mutation({
  args: {},
  handler: async (ctx) => await resetBatch(ctx),
});
export const resetBoardStep = internalMutation({
  args: {},
  handler: async (ctx) => await resetBatch(ctx),
});

/** Pre-heat before judging: one tiny Claude call plus one CRS fixture read. */
export const warmup = action({
  args: {},
  handler: async (): Promise<{ claudeMs: number | null; claudeOk: boolean; claudeError?: string; crsMs: number; crsProvider: string; totalMs: number }> => {
    const t0 = Date.now();
    const claude = await pingClaude();
    const t1 = Date.now();
    mockBundle("P01"); // fixture read (parses the persona fixture)
    const crsMs = Date.now() - t1;
    return {
      claudeMs: claude.ms,
      claudeOk: claude.ok,
      ...(claude.error ? { claudeError: claude.error } : {}),
      crsMs,
      crsProvider: process.env.CRS_PROVIDER ?? "mock",
      totalMs: Date.now() - t0,
    };
  },
});

/** UI chrome: SANDBOX label, lender timeout, build id. */
export const config = query({
  args: {},
  handler: async (ctx) => {
    const ms = lenderTimeoutMs();
    const latest = await ctx.db.query("evalRuns").withIndex("by_startedAt").order("desc").first();
    return {
      productName: process.env.PRODUCT_NAME ?? "Docket",
      sandbox: true as const,
      lenderTimeoutMs: ms,
      lenderTimeoutSeconds: Math.round(ms / 100) / 10,
      commit: process.env.GIT_SHA ?? null,
      crsProvider: process.env.CRS_PROVIDER ?? "mock",
      lenderNames: LENDER_NAMES,
      demoReplay: demoReplayOn(),
      secondOpinionEnabled: Boolean(process.env.OPENAI_API_KEY),
      latestEval: latest && latest.finishedAt ? { cases: latest.cases, agreement: latest.agreement, passed: Math.round(latest.agreement * latest.cases), startedAt: latest.startedAt } : null,
    };
  },
});

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------
const TERMINAL_STATUSES = new Set(["awaiting_human", "approved", "declined", "hard_stop"]);

async function buildRecording(ctx: QueryCtx, a: Doc<"applicants">) {
  const personaId = a.personaId;
  const t0 = a.createdAt;
  const rel = (t: number) => Math.max(0, t - t0);
  const bundle = await ctx.db.query("bundles").withIndex("by_applicantId", (q) => q.eq("applicantId", a._id)).order("desc").first();
  const offers = await ctx.db.query("offers").withIndex("by_applicantId", (q) => q.eq("applicantId", a._id)).collect();
  const notice = await ctx.db.query("notices").withIndex("by_applicantId", (q) => q.eq("applicantId", a._id)).order("desc").first();
  const checks = await ctx.db.query("reasonChecks").withIndex("by_applicantId", (q) => q.eq("applicantId", a._id)).collect();
  const audits = await ctx.db.query("auditEvents").withIndex("by_applicantId", (q) => q.eq("applicantId", a._id)).order("asc").collect();
  // Ids are dropped on purpose: a recording is self-contained and must not point at rows that reset deletes.
  const strip = <T extends { _id: unknown; _creationTime: number; applicantId: unknown }>(d: T) => {
    const { _creationTime: _c, applicantId: _a, ...rest } = d;
    return { ...rest, _id: String(d._id) };
  };
  const last = audits.length ? audits[audits.length - 1].at : a.createdAt;
  return {
    personaId,
    recordedAt: a.createdAt,
    durationMs: rel(last),
    status: a.status,
    applicant: {
      name: a.name.replace(/ \(eval\)$/, ""),
      cardCode: a.cardCode ?? personaCodes[personaId] ?? null,
      purpose: a.purpose,
      amountRequested: a.amountRequested,
      statedIncome: a.statedIncome,
    },
    bundle: bundle ? { ...(({ raw: _r, _id: _i, _creationTime: _c, applicantId: _a, ...rest }) => rest)(bundle), t: rel(bundle.pulledAt) } : null,
    offers: offers.map((o) => ({ ...strip(o), t: rel(o.createdAt) })),
    reasonChecks: checks.map((c) => ({ ...strip(c), t: rel(c.createdAt) })),
    notice: notice ? { ...strip(notice), t: rel(notice.createdAt) } : null,
    auditEvents: audits.map((e) => ({ t: rel(e.at), actor: e.actor, action: e.action, ref: e.ref, note: e.note })),
  };
}

/**
 * Full event sequence of the most recent recorded run of a persona, timestamps relative to start
 * (ms). Served from the `recordings` table (survives resetBoard); falls back to the latest
 * completed live run if none was recorded.
 */
export const recordedRun = query({
  args: { personaId: v.string() },
  handler: async (ctx, { personaId }) => {
    const rec = await ctx.db.query("recordings").withIndex("by_personaId", (q) => q.eq("personaId", personaId)).order("desc").first();
    if (rec) return rec.data as Awaited<ReturnType<typeof buildRecording>>;
    const rows = await ctx.db.query("applicants").withIndex("by_personaId", (q) => q.eq("personaId", personaId)).order("desc").take(30);
    const a = rows.find((r) => !r.replayOf && TERMINAL_STATUSES.has(r.status));
    return a ? await buildRecording(ctx, a) : null;
  },
});

/** Snapshot a finished run into `recordings` (replacing the persona's previous one). */
export const saveRecording = internalMutation({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }) => {
    const a = await ctx.db.get(applicantId);
    if (!a) return null;
    const data = await buildRecording(ctx as unknown as QueryCtx, a);
    for (const old of await ctx.db.query("recordings").withIndex("by_personaId", (q) => q.eq("personaId", a.personaId)).collect()) await ctx.db.delete(old._id);
    await ctx.db.insert("recordings", { personaId: a.personaId, recordedAt: Date.now(), data });
    return { durationMs: data.durationMs, status: data.status, events: data.auditEvents.length };
  },
});
