// Counterfactual reason test (design/differentiators.md #1).
// For each decline reason with a field reference: copy the underwriter input,
// set ONLY that field to a passing value, re-run the same lender, record whether
// the decision flipped. flipped=false → the reason is "unsupported": it stays on
// the offer (flagged) but never reaches the adverse-action notice.
import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { underwriteOnce } from "./agents";
import type { UnderwriterInput } from "./types";
import { POLICIES } from "./policies";
import { buildUnderwriterInput } from "./pii";

export type Counterfactual = { field: string; original: unknown; counterfactual: unknown; input: UnderwriterInput };

/** Normalize LLM field refs: "bundle.credit.fico9" → "credit.fico9", "fraud.signals[1]" → "fraud.signals". */
export function normalizeField(field: string): string {
  return field
    .trim()
    .replace(/^bundle\./, "")
    .replace(/^input\./, "")
    .replace(/\[\d+\]/g, "")
    .replace(/^applicant\./, "");
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

/**
 * Passing-value mapping per field. Values are chosen to satisfy EVERY policy in
 * policies/*.md so a flip is attributable to that field alone. Returns null for
 * fields with no sensible single-value counterfactual (tradelines, signals).
 */
export function buildCounterfactual(input: UnderwriterInput, rawField: string): Counterfactual | null {
  const field = normalizeField(rawField);
  const next = clone(input);
  const b = next.bundle;
  const set = (original: unknown, counterfactual: unknown): Counterfactual => ({ field, original, counterfactual, input: next });

  switch (field) {
    case "credit.fico9":
      b.credit.fico9 = 780;
      return set(input.bundle.credit.fico9, 780);
    case "credit.vantage4":
      b.credit.vantage4 = 780;
      return set(input.bundle.credit.vantage4, 780);
    case "credit.utilization":
      b.credit.utilization = 0.1;
      return set(input.bundle.credit.utilization, 0.1);
    case "credit.inquiries6mo":
      b.credit.inquiries6mo = 0;
      return set(input.bundle.credit.inquiries6mo, 0);
    case "fraud.score":
      b.fraud.score = 5;
      return set(input.bundle.fraud.score, 5);
    case "flags.bankruptcy":
    case "flags.eviction":
    case "flags.lienOrJudgment":
    case "flags.deceased":
    case "flags.frozen": {
      const k = field.split(".")[1] as keyof typeof b.flags;
      b.flags[k] = false;
      return set(input.bundle.flags[k] ?? false, false);
    }
    case "identity.verified":
      b.identity.verified = true;
      return set(input.bundle.identity.verified, true);
    case "statedIncome": {
      // DTI-derived: income high enough that every policy's income-percentage cap clears the request
      // (CU's 35% is the strictest). Absolute dollar caps may still bind, which is a real decline.
      const cf = Math.max(input.statedIncome, Math.ceil(input.amountRequested / 0.35 / 1000) * 1000);
      next.statedIncome = cf;
      return set(input.statedIncome, cf);
    }
    case "amountRequested": {
      // A request comfortably inside every policy's capacity for the stated income.
      const cf = Math.max(2500, Math.min(input.amountRequested, Math.floor((input.statedIncome * 0.3) / 100) * 100, 20000));
      next.amountRequested = cf;
      return set(input.amountRequested, cf);
    }
    default:
      return null;
  }
}

export const recordChecks = internalMutation({
  args: {
    offerId: v.id("offers"),
    checks: v.array(
      v.object({
        field: v.string(),
        original: v.any(),
        counterfactual: v.any(),
        flipped: v.boolean(),
        counterfactualDecision: v.union(v.literal("approve"), v.literal("decline"), v.literal("failed")),
        latencyMs: v.number(),
        note: v.string(),
        method: v.union(v.literal("single"), v.literal("leave_one_out"), v.literal("all_fixed")),
        verified: v.union(v.boolean(), v.null()),
      }),
    ),
    untested: v.array(v.string()),
  },
  handler: async (ctx, { offerId, checks, untested }) => {
    const offer = await ctx.db.get(offerId);
    if (!offer) throw new Error("offer not found");
    // Replace any earlier checks for this offer (re-runs from the button).
    const old = await ctx.db
      .query("reasonChecks")
      .withIndex("by_offerId", (q) => q.eq("offerId", offerId))
      .collect();
    for (const o of old) await ctx.db.delete(o._id);

    // Final verdict per field: a later (leave-one-out) row overrides the single-field row.
    const byField = new Map<string, boolean | null>();
    for (const c of checks) {
      if (c.method === "all_fixed") continue;
      if (c.verified === true || !byField.has(c.field) || c.method === "leave_one_out") byField.set(c.field, c.verified);
      if (c.verified === true) byField.set(c.field, true);
    }
    for (const c of checks) {
      await ctx.db.insert("reasonChecks", {
        offerId,
        applicantId: offer.applicantId,
        lender: offer.lender,
        field: c.field,
        original: c.original,
        counterfactual: c.counterfactual,
        flipped: c.flipped,
        counterfactualDecision: c.counterfactualDecision,
        latencyMs: c.latencyMs,
        createdAt: Date.now(),
        method: c.method,
        verified: c.verified,
      });
      await ctx.db.insert("auditEvents", {
        applicantId: offer.applicantId,
        at: Date.now(),
        actor: `underwriter:${offer.lender}` as const,
        action: c.method === "all_fixed" ? "verify.sanity" : c.verified === true ? "verify.supported" : c.verified === false ? "verify.unsupported" : "verify.inconclusive",
        ref: c.field,
        note: `[${c.method}] ${c.field}: ${JSON.stringify(c.original)} → ${JSON.stringify(c.counterfactual)} ⇒ ${c.counterfactualDecision} (${c.latencyMs}ms) ${c.note}`,
      });
    }
    const reasons = offer.reasons.map((r) => {
      const f = normalizeField(r.field);
      const verdict = byField.get(f);
      return { ...r, verified: verdict === undefined ? null : verdict };
    });
    await ctx.db.patch(offerId, { reasons });
    return { verified: reasons.filter((r) => r.verified === true).length, unsupported: reasons.filter((r) => r.verified === false).length, untested: untested.length };
  },
});

export type VerifyResult = { offerId: Id<"offers">; checked: number; flipped: number; unsupported: number; untested: string[] };

export const verifyReasons = internalAction({
  args: { offerId: v.id("offers") },
  handler: async (ctx, { offerId }): Promise<VerifyResult> => {
    const offer: Doc<"offers"> | null = await ctx.runQuery(internal.verify.getOffer, { offerId });
    if (!offer) throw new Error("offer not found");
    if (offer.status !== "done" || offer.decision !== "decline") {
      return { offerId, checked: 0, flipped: 0, unsupported: 0, untested: [] };
    }
    const { applicant, bundle, marketAnchor } = await ctx.runQuery(internal.agents.loadCase, { applicantId: offer.applicantId });
    const input: UnderwriterInput = buildUnderwriterInput(applicant, bundle, POLICIES[offer.lender], marketAnchor);

    const fields = [...new Set(offer.reasons.map((r) => normalizeField(r.field)))];
    const untested: string[] = [];
    const cfs: Counterfactual[] = [];
    for (const f of fields) {
      const cf = buildCounterfactual(input, f);
      if (cf) cfs.push(cf);
      else untested.push(f);
    }

    type Check = {
      field: string;
      original: unknown;
      counterfactual: unknown;
      flipped: boolean;
      counterfactualDecision: "approve" | "decline" | "failed";
      latencyMs: number;
      note: string;
      method: "single" | "leave_one_out" | "all_fixed";
      verified: boolean | null;
    };
    const run = async (inp: UnderwriterInput) => {
      const r = await underwriteOnce(offer.lender, inp);
      return { decision: r.output?.decision ?? ("failed" as const), latencyMs: r.latencyMs, note: `[provider=${r.actualProvider}]` };
    };

    // Pass 1: set ONLY this field to passing. Flip ⇒ verified.
    const pass1: Check[] = await Promise.all(
      cfs.map(async (cf) => {
        const r = await run(cf.input);
        return {
          field: cf.field,
          original: cf.original ?? null,
          counterfactual: cf.counterfactual ?? null,
          flipped: r.decision === "approve",
          counterfactualDecision: r.decision,
          latencyMs: r.latencyMs,
          note: r.note,
          method: "single",
          verified: r.decision === "failed" ? null : r.decision === "approve",
        };
      }),
    );
    const results: Check[] = [...pass1];

    // Pass 2 (jointly sufficient reasons, e.g. fico AND utilization both failing):
    // leave-one-out. First a sanity test with EVERY field passing; it must approve,
    // otherwise the lender declines for something it did not list and we stay inconclusive.
    const unflipped = pass1.filter((c) => c.verified === false);
    if (cfs.length >= 2 && unflipped.length > 0) {
      const applyAll = (base: UnderwriterInput, except: string | null) =>
        cfs.reduce((inp, other) => (other.field === except ? inp : (buildCounterfactual(inp, other.field)?.input ?? inp)), base);
      const all = await run(applyAll(input, null));
      results.push({
        field: "*",
        original: null,
        counterfactual: cfs.map((c) => c.field),
        flipped: all.decision === "approve",
        counterfactualDecision: all.decision,
        latencyMs: all.latencyMs,
        note: all.note,
        method: "all_fixed",
        verified: null,
      });
      if (all.decision === "approve") {
        const loo: Check[] = await Promise.all(
          unflipped.map(async (c) => {
            const r = await run(applyAll(input, c.field));
            return {
              field: c.field,
              original: c.original,
              counterfactual: `others fixed; ${c.field} kept at ${JSON.stringify(c.original)}`,
              flipped: r.decision === "approve",
              counterfactualDecision: r.decision,
              latencyMs: r.latencyMs,
              note: r.note,
              method: "leave_one_out",
              verified: r.decision === "failed" ? null : r.decision === "decline", // still declines ⇒ this reason is necessary
            };
          }),
        );
        results.push(...loo);
      } else {
        for (const c of unflipped) {
          results.push({ ...c, method: "leave_one_out", counterfactual: "skipped: all-fixed sanity test did not approve", verified: null, latencyMs: 0 });
        }
      }
    }

    const summary = await ctx.runMutation(internal.verify.recordChecks, { offerId, checks: results, untested });
    return { offerId, checked: cfs.length, flipped: summary.verified, unsupported: summary.unsupported, untested };
  },
});

export const getOffer = internalQuery({
  args: { offerId: v.id("offers") },
  handler: async (ctx, { offerId }) => await ctx.db.get(offerId),
});

/** Button: re-run the counterfactual test for one offer (schedules the action). */
export const verifyReasonsNow = mutation({
  args: { offerId: v.id("offers") },
  handler: async (ctx, { offerId }) => {
    const offer = await ctx.db.get(offerId);
    if (!offer) throw new Error("offer not found");
    await ctx.db.insert("auditEvents", {
      applicantId: offer.applicantId,
      at: Date.now(),
      actor: "human",
      action: "verify.requested",
      ref: String(offerId),
      note: `re-test reasons for ${offer.lender}`,
    });
    await ctx.scheduler.runAfter(0, internal.verify.verifyReasons, { offerId });
    return offerId;
  },
});

export const reasonChecks = query({
  args: { applicantId: v.optional(v.id("applicants")), offerId: v.optional(v.id("offers")) },
  handler: async (ctx, { applicantId, offerId }) => {
    if (offerId) {
      return await ctx.db
        .query("reasonChecks")
        .withIndex("by_offerId", (q) => q.eq("offerId", offerId))
        .collect();
    }
    if (applicantId) {
      return await ctx.db
        .query("reasonChecks")
        .withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId))
        .collect();
    }
    return await ctx.db.query("reasonChecks").order("desc").take(500);
  },
});
