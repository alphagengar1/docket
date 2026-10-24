// Backing functions for the public HTTP API (convex/http.ts, /api/v1/*) and the MCP server (mcp/).
// All internal: the only door is the bearer-authenticated HTTP layer.
// The DecisionRecord is built here from the same tables the console reads. It never includes
// the raw bureau payload, the fraud signals, tradelines, SSN or any contact data.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type QueryCtx } from "./_generated/server";
import { writeAudit } from "./audit";
import { monthlyPayment } from "./classify";
import { findPersona } from "./crs.mock";
import { describeIdentityFlag, fieldLabel, stopLabel } from "./labels";
import { LENDER_NAMES } from "./policies";
import { narrateTrace } from "./narrate";
import { scrubText } from "./pii";
import { applicantStatus } from "./schema";
import { LENDERS } from "./types";

const iso = (ms: number) => new Date(ms).toISOString();
const WEB_URL = () => (process.env.DOCKET_WEB_URL ?? "https://docket-sepia-ten.vercel.app").replace(/\/$/, "");

const links = (id: string) => ({ console: `${WEB_URL()}/?applicant=${id}`, board: `${WEB_URL()}/#/board` });

type BestOffer = { lender: string; apr: number; amount: number; termMonths: number };

function bestOffer(offers: Doc<"offers">[]): BestOffer | undefined {
  const ok = offers
    .filter((o) => o.status === "done" && o.decision === "approve" && o.apr != null && o.amount != null && o.termMonths != null)
    .sort((a, b) => (a.apr as number) - (b.apr as number))[0];
  return ok ? { lender: ok.lender, apr: ok.apr as number, amount: ok.amount as number, termMonths: ok.termMonths as number } : undefined;
}

export const listApplicants = internalQuery({
  args: { status: v.optional(applicantStatus), limit: v.optional(v.number()) },
  handler: async (ctx, { status, limit }) => {
    const rows = (await ctx.db.query("applicants").withIndex("by_createdAt").order("desc").take(300))
      .filter((a) => !status || a.status === status)
      .slice(0, Math.min(limit ?? 100, 200));
    const out = [];
    for (const a of rows) {
      const offers = await ctx.db.query("offers").withIndex("by_applicantId", (q) => q.eq("applicantId", a._id)).collect();
      const best = bestOffer(offers);
      out.push({
        id: String(a._id),
        personaId: a.personaId,
        name: a.name,
        purpose: a.purpose,
        amountRequested: a.amountRequested,
        status: a.status,
        createdAt: iso(a.createdAt),
        ...(best ? { bestOffer: best } : {}),
      });
    }
    return out;
  },
});

function span(events: Doc<"auditEvents">[], step: string): number | null {
  const s = events.find((e) => e.actor === "desk" && e.action === `step.${step}.start`);
  const d = [...events].reverse().find((e) => e.actor === "desk" && (e.action === `step.${step}.done` || e.action === `step.${step}.skipped`));
  return s && d ? Math.max(0, d.at - s.at) : null;
}

async function loadAll(ctx: QueryCtx, applicantId: Id<"applicants">) {
  const by = <T extends "offers" | "auditEvents" | "reasonChecks" | "notices" | "decisions" | "bundles">(t: T) =>
    ctx.db.query(t).withIndex("by_applicantId" as any, (q: any) => q.eq("applicantId", applicantId));
  return {
    bundle: (await by("bundles").order("desc").first()) as Doc<"bundles"> | null,
    offers: (await by("offers").collect()) as Doc<"offers">[],
    notice: (await by("notices").order("desc").first()) as Doc<"notices"> | null,
    decision: (await by("decisions").order("desc").first()) as Doc<"decisions"> | null,
    events: (await by("auditEvents").order("asc").collect()) as Doc<"auditEvents">[],
    checks: (await by("reasonChecks").collect()) as Doc<"reasonChecks">[],
  };
}

type Verification = "verified" | "unsupported" | "untested" | "inconclusive";

export const decisionRecord = internalQuery({
  args: { applicantId: v.string() },
  handler: async (ctx, { applicantId: raw }) => {
    const id = ctx.db.normalizeId("applicants", raw);
    const a = id ? await ctx.db.get(id) : null;
    if (!id || !a) return null;
    const { bundle, offers, notice, decision, events, checks } = await loadAll(ctx, id);

    const stopEvents = events.filter((e) => e.actor === "rules" && e.action === "rules.hard_stop");
    const hardStop = stopEvents[0] && stopEvents[0].ref
      ? { field: stopEvents[0].ref, label: stopLabel(stopEvents[0].ref), reason: scrubText(stopEvents[0].note) }
      : undefined;

    const lenders = LENDERS.flatMap((l) => {
      const o = offers.find((x) => x.lender === l);
      if (!o) return [];
      const dec = o.status === "failed" ? "failed" : o.status === "pending" ? "pending" : (o.classification ?? (o.decision === "decline" ? "deny" : "approve"));
      const approved = o.status === "done" && o.decision === "approve" && o.apr != null && o.amount != null && o.termMonths != null;
      return [
        {
          lender: l,
          name: LENDER_NAMES[l],
          policy: `policies/${l}.md`,
          decision: dec,
          classification: o.classification ?? null,
          apr: o.apr,
          termMonths: o.termMonths,
          amount: o.amount,
          monthlyPayment: approved ? (o.monthlyPayment ?? monthlyPayment(o.amount as number, o.apr as number, o.termMonths as number)) : null,
          conditions: o.conditions.map(scrubText),
          reasons: o.reasons.map((r) => {
            const f = r.field.replace(/^(bundle\.|input\.|applicant\.)/, "").replace(/\[\d+\]/g, "");
            const tested = checks.some((c) => c.lender === l && c.field === f && c.method !== "all_fixed");
            const verification: Verification = r.verified === true ? "verified" : r.verified === false ? "unsupported" : tested ? "inconclusive" : "untested";
            return { field: r.field, label: fieldLabel(r.field), text: scrubText(r.text), verification };
          }),
          latencyMs: o.latencyMs,
          provider: o.provider,
        },
      ];
    });

    const chosen = decision?.chosenOfferId ? ctx.db.normalizeId("offers", decision.chosenOfferId) : null;
    const chosenOffer = chosen ? await ctx.db.get(chosen) : null;
    const humanEvent = [...events].reverse().find((e) => e.actor === "human");
    const humanStart = events.find((e) => e.actor === "desk" && e.action === "step.human.start");
    const lastDesk = [...events].reverse().find((e) => e.actor === "desk" && e.action.startsWith("step."));
    const totalEnd = humanStart?.at ?? lastDesk?.at ?? null;

    return {
      schemaVersion: "1.0" as const,
      applicant: {
        id: String(a._id),
        personaId: a.personaId,
        name: a.name,
        purpose: scrubText(a.purpose),
        amountRequested: a.amountRequested,
        statedIncome: a.statedIncome,
        status: a.status,
        consentAt: iso(a.consentAt),
        createdAt: iso(a.createdAt),
      },
      bundle: bundle
        ? {
            credit: {
              score: bundle.credit.fico9,
              vantage4: bundle.credit.vantage4,
              utilization: bundle.credit.utilization,
              inquiries6mo: bundle.credit.inquiries6mo,
              tradelineCount: bundle.credit.tradelines.length,
            },
            identity: { verified: bundle.identity.verified, flags: bundle.identity.flags.map((f) => scrubText(describeIdentityFlag(f))) },
            fraud: { score: bundle.fraud.score },
            flags: {
              deceased: bundle.flags.deceased,
              frozen: bundle.flags.frozen,
              bankruptcy: bundle.flags.bankruptcy,
              eviction: bundle.flags.eviction,
              lienOrJudgment: bundle.flags.lienOrJudgment ?? false,
            },
          }
        : null,
      ...(hardStop ? { hardStop } : {}),
      lenders,
      ...(notice
        ? {
            notice: {
              required: notice.required ?? true,
              requiredBecause: notice.requiredBecause ?? "",
              text: notice.text,
              ...(notice.approvedAt ? { approvedAt: iso(notice.approvedAt) } : {}),
            },
          }
        : {}),
      ...(decision
        ? {
            human: {
              outcome: decision.outcome,
              chosenLender: chosenOffer?.lender ?? null,
              at: iso(decision.at),
              note: scrubText(decision.note),
              source: humanEvent?.note.includes("[source=api]") ? "api" : "console",
            },
          }
        : {}),
      timings: {
        pullMs: span(events, "pull"),
        guardrailsMs: span(events, "guardrails"),
        underwriteMs: span(events, "underwrite"),
        verifyMs: span(events, "verify"),
        complianceMs: span(events, "compliance"),
        totalMs: totalEnd ? Math.max(0, totalEnd - a.createdAt) : null,
      },
      links: links(String(a._id)),
    };
  },
});

const ACTION_LABELS: Record<string, string> = {
  "intake.submitted": "application received with consent",
  "intake.replay": "replay of an earlier application",
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
  "step.compliance.skipped": "notice not needed",
  "step.human.start": "waiting for a human decision",
  "step.human.done": "human decision recorded",
  "rules.pass": "no hard-stop rule fired",
  "rules.hard_stop": "hard stop",
  "verify.supported": "reason verified by counterfactual test",
  "verify.unsupported": "reason failed the counterfactual test and was withheld",
  "verify.inconclusive": "reason test was inconclusive",
  "verify.sanity": "sanity check with every factor fixed",
  "compliance.notice": "adverse-action notice written",
  "compliance.failed": "notice failed",
  "notice.approved": "notice approved by a human",
  "offer.chosen": "borrower chose an offer",
  "desk.error": "desk error",
  "crs.error": "bureau error",
};

export const trace = internalQuery({
  args: { applicantId: v.string() },
  handler: async (ctx, { applicantId: raw }) => {
    const id = ctx.db.normalizeId("applicants", raw);
    const a = id ? await ctx.db.get(id) : null;
    if (!id || !a) return null;
    const events = await ctx.db.query("auditEvents").withIndex("by_applicantId", (q) => q.eq("applicantId", id)).order("asc").collect();
    const { lines } = narrateTrace(events, { name: a.name, lenders: LENDER_NAMES });
    return {
      applicantName: a.name,
      status: a.status,
      narrative: lines.map((l) => `${iso(l.at).slice(11, 19)}  ${scrubText(l.text)}`).join("\n"),
      events: events.map((e) => ({
        at: iso(e.at),
        actor: e.actor,
        action: e.action,
        label: e.action === "rules.hard_stop" && e.ref ? stopLabel(e.ref) : (ACTION_LABELS[e.action] ?? e.action.replace(/[._]/g, " ")),
        ref: e.ref,
        note: scrubText(e.note).slice(0, 400),
      })),
    };
  },
});

export const createApplication = internalMutation({
  args: { personaId: v.string(), purpose: v.string(), amountRequested: v.number(), statedIncome: v.number() },
  handler: async (ctx, args): Promise<{ applicantId: string; status: string; links: { console: string; board: string } }> => {
    if (!findPersona(args.personaId) && (process.env.CRS_PROVIDER ?? "mock") !== "crs") throw new Error(`unknown personaId ${args.personaId}`);
    if (!(args.amountRequested > 0) || !(args.statedIncome >= 0)) throw new Error("amountRequested must be positive and statedIncome non-negative");
    const applicantId: Id<"applicants"> = await ctx.runMutation(internal.desk.createApplicantInternal, args);
    const a = await ctx.db.get(applicantId);
    await writeAudit(ctx, { applicantId, actor: "intake", action: "intake.source", note: "[source=api] application submitted over the HTTP API" });
    return { applicantId: String(applicantId), status: a?.status ?? "intake", links: links(String(applicantId)) };
  },
});

/** The human step over the API. Same rules as desk:approveOffer; recorded as actor "human", source "api". */
export const approve = internalMutation({
  args: { applicantId: v.string(), lender: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { applicantId: raw, lender, note }) => {
    const id = ctx.db.normalizeId("applicants", raw);
    const a = id ? await ctx.db.get(id) : null;
    if (!id || !a) throw new Error("applicant not found");
    if (a.status !== "awaiting_human") throw new Error(`applicant is ${a.status}, not awaiting_human`);
    const offer = (await ctx.db.query("offers").withIndex("by_applicantId", (q) => q.eq("applicantId", id)).collect()).find((o) => o.lender === lender);
    if (!offer) throw new Error(`no offer from ${lender}`);
    if (offer.status !== "done" || offer.decision !== "approve") throw new Error("only an approved offer can be accepted");
    await ctx.db.insert("decisions", { applicantId: id, chosenOfferId: String(offer._id), outcome: "approved", approvedBy: "human", at: Date.now(), note: note ?? "" });
    await ctx.db.patch(id, { status: "approved" });
    await writeAudit(ctx, {
      applicantId: id,
      actor: "human",
      action: "step.human.done",
      ref: String(offer._id),
      note: `[source=api] approved ${offer.lender} offer: $${offer.amount} at ${offer.apr}% for ${offer.termMonths} months${note ? " — " + note : ""}`,
    });
    return { applicantId: String(id), status: "approved", chosenLender: offer.lender };
  },
});

export const decline = internalMutation({
  args: { applicantId: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { applicantId: raw, note }) => {
    const id = ctx.db.normalizeId("applicants", raw);
    const a = id ? await ctx.db.get(id) : null;
    if (!id || !a) throw new Error("applicant not found");
    if (a.status !== "awaiting_human") throw new Error(`applicant is ${a.status}, not awaiting_human`);
    await ctx.db.insert("decisions", { applicantId: id, chosenOfferId: null, outcome: "declined", approvedBy: "human", at: Date.now(), note: note ?? "" });
    await ctx.db.patch(id, { status: "declined" });
    await writeAudit(ctx, { applicantId: id, actor: "human", action: "step.human.done", note: `[source=api] declined by loan officer${note ? " — " + note : ""}` });
    return { applicantId: String(id), status: "declined" };
  },
});
