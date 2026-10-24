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
import { internalMutation, internalQuery, mutation, query, type QueryCtx } from "./_generated/server";
import { applicantStatus } from "./schema";
import { writeAudit } from "./audit";
import { findPersona } from "./crs.mock";
import { evaluateHardStops } from "./rules";
import { LENDERS } from "./types";
import { noticeRequired } from "./classify";

export const workflow = new WorkflowManager(components.workflow);

const PENDING_POLL_MS = 5_000;
const PENDING_MAX_POLLS = 48; // 4 minutes for async (CREAO) agents

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
    if (guard.stop) return;

    // 3. underwrite x3 in parallel --------------------------------------
    await step.runMutation(internal.desk.mark, { applicantId, status: "underwriting", action: "step.underwrite.start", note: "cu, fintech, prime" });
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
    if (status) await ctx.db.patch(applicantId, { status });
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
    return await createAndStart(ctx, args);
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
    replayOf?: Id<"applicants">;
    replayNote?: string;
    dispute?: { fromApplicantId: Id<"applicants">; tradelineIndex: number };
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
    await writeAudit(ctx, { applicantId, actor: "desk", action: "replay.started", ref: String(replayId), note: "re-running all three lenders on the corrected bundle" });
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
    personaId: v.string(),
    purpose: v.string(),
    amountRequested: v.number(),
    statedIncome: v.number(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"applicants">> => {
    if (!findPersona(args.personaId) && (process.env.CRS_PROVIDER ?? "mock") !== "crs") {
      throw new Error(`unknown personaId ${args.personaId}`);
    }
    if (args.amountRequested <= 0 || args.statedIncome < 0) throw new Error("amount and income must be positive");
    return await createAndStart(ctx, args);
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

/** Delete an applicant and every row that hangs off it (eval cleanup / demo reset). */
export const deleteApplicantCascade = internalMutation({
  args: { applicantId: v.id("applicants") },
  handler: async (ctx, { applicantId }) => {
    for (const table of ["bundles", "offers", "notices", "decisions", "auditEvents", "agentRuns", "reasonChecks"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
        .collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }
    await ctx.db.delete(applicantId);
  },
});
