// Demo replay: with deployment env DEMO_REPLAY=1, starting an application re-creates a recorded run
// (see eval:recordAll / desk:saveRecording) row by row on the original relative schedule instead of
// calling any live model or bureau. Human actions afterwards work on the replayed rows as usual.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { writeAudit } from "./audit";

export const demoReplayOn = (): boolean => process.env.DEMO_REPLAY === "1";

// A recording longer than this is played back proportionally faster (every offset is scaled by the
// same factor, so the relative rhythm is kept) so the board reaches the human step quickly.
const REPLAY_SPAN_MS = 30_000;

const WORKING = new Set(["intake", "pulling", "guardrails", "underwriting", "compliance"]);

// audit action -> applicant status it moved the live pipeline into
const STATUS_FOR_ACTION: Record<string, Doc<"applicants">["status"]> = {
  "step.pull.start": "pulling",
  "step.guardrails.start": "guardrails",
  "step.underwrite.start": "underwriting",
  "step.compliance.start": "compliance",
  "step.human.start": "awaiting_human",
  "rules.hard_stop": "hard_stop",
};

type Rec = {
  status: string;
  durationMs: number;
  applicant: { name: string };
  bundle: any | null;
  offers: any[];
  reasonChecks: any[];
  notice: any | null;
  auditEvents: Array<{ t: number; actor: string; action: string; ref: string | null; note: string }>;
};

type Item = { t: number; kind: "bundle" | "check" | "notice" | "audit" | "finish"; i: number };
const PRIORITY = { bundle: 0, check: 1, notice: 2, audit: 3, finish: 4 } as const;

/** Deterministic, sorted list of everything to replay (pure: playTick recomputes it). */
function timeline(rec: Rec): Item[] {
  const items: Item[] = [];
  if (rec.bundle) items.push({ t: rec.bundle.t ?? 0, kind: "bundle", i: 0 });
  rec.reasonChecks.forEach((c, i) => items.push({ t: c.t ?? 0, kind: "check", i }));
  if (rec.notice) items.push({ t: rec.notice.t ?? 0, kind: "notice", i: 0 });
  rec.auditEvents.forEach((e, i) => {
    if (e.actor === "intake") return; // the live intake event was written when the applicant was created
    items.push({ t: e.t, kind: "audit", i });
  });
  const end = Math.max(rec.durationMs, ...items.map((x) => x.t));
  items.push({ t: end, kind: "finish", i: 0 });
  return items.sort((a, b) => a.t - b.t || PRIORITY[a.kind] - PRIORITY[b.kind] || a.i - b.i);
}

/** Groups items that share a recorded timestamp into [start, end) ranges. */
function groups(items: Item[]): Array<{ t: number; start: number; end: number }> {
  const out: Array<{ t: number; start: number; end: number }> = [];
  items.forEach((it, idx) => {
    const last = out[out.length - 1];
    if (last && last.t === it.t) last.end = idx + 1;
    else out.push({ t: it.t, start: idx, end: idx + 1 });
  });
  return out;
}

export const playRecording = internalMutation({
  args: { applicantId: v.id("applicants"), recordingId: v.id("recordings") },
  handler: async (ctx, { applicantId, recordingId }) => {
    const row = await ctx.db.get(recordingId);
    if (!row) return;
    const rec = row.data as Rec;
    const items = timeline(rec);
    const span = items[items.length - 1].t;
    const factor = span > REPLAY_SPAN_MS ? REPLAY_SPAN_MS / span : 1;
    for (const g of groups(items)) {
      await ctx.scheduler.runAfter(Math.round(g.t * factor), internal.replay.playTick, {
        applicantId,
        recordingId,
        start: g.start,
        end: g.end,
      });
    }
  },
});

async function ensureOffer(ctx: MutationCtx, applicantId: Id<"applicants">, recOffer: any): Promise<Id<"offers">> {
  const existing = (await ctx.db.query("offers").withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId)).collect()).find(
    (o) => o.lender === recOffer.lender,
  );
  if (existing) return existing._id;
  return await ctx.db.insert("offers", {
    applicantId,
    lender: recOffer.lender,
    provider: recOffer.provider,
    status: "pending",
    decision: null,
    apr: null,
    termMonths: null,
    amount: null,
    conditions: [],
    reasons: [],
    marketAnchor: null,
    runId: recOffer.runId ?? null,
    shareUrl: null,
    latencyMs: null,
    createdAt: Date.now(),
  });
}

/** recorded offer id -> id of the new applicant's offer for the same lender (only rows that exist yet). */
async function offerMap(ctx: MutationCtx, applicantId: Id<"applicants">, rec: Rec): Promise<Map<string, Id<"offers">>> {
  const rows = await ctx.db.query("offers").withIndex("by_applicantId", (q) => q.eq("applicantId", applicantId)).collect();
  const m = new Map<string, Id<"offers">>();
  for (const o of rec.offers) {
    const row = rows.find((r) => r.lender === o.lender);
    if (row) m.set(o._id, row._id);
  }
  return m;
}

function rewrite<T>(value: T, subs: Array<[string, string]>): T {
  if (!subs.length) return value;
  if (typeof value === "string") {
    let s: string = value;
    for (const [from, to] of subs) if (from && from !== to) s = s.split(from).join(to);
    return s as unknown as T;
  }
  if (Array.isArray(value)) return value.map((x) => rewrite(x, subs)) as unknown as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as object).map(([k, x]) => [k, rewrite(x, subs)])) as unknown as T;
  }
  return value;
}

async function finalizeOffer(ctx: MutationCtx, applicantId: Id<"applicants">, rec: Rec, recOffer: any, subs: Array<[string, string]>) {
  const id = await ensureOffer(ctx, applicantId, recOffer);
  const cur = await ctx.db.get(id);
  if (!cur || cur.status !== "pending") return;
  const o = rewrite(recOffer, subs);
  await ctx.db.patch(id, {
    status: o.status,
    decision: o.decision ?? null,
    apr: o.apr ?? null,
    termMonths: o.termMonths ?? null,
    amount: o.amount ?? null,
    conditions: o.conditions ?? [],
    // the counterfactual verdicts arrive later, with the reason checks, exactly as live
    reasons: (o.reasons ?? []).map(({ verified: _v, ...r }: any) => r),
    marketAnchor: o.marketAnchor ?? null,
    runId: o.runId ?? null,
    shareUrl: o.shareUrl ?? null,
    latencyMs: o.latencyMs ?? null,
    ...(o.classification ? { classification: o.classification } : {}),
    ...(o.failureReason ? { failureReason: o.failureReason } : {}),
    ...(o.monthlyPayment !== undefined ? { monthlyPayment: o.monthlyPayment } : {}),
    ...(o.costToBorrow !== undefined ? { costToBorrow: o.costToBorrow } : {}),
  });
}

async function setStatus(ctx: MutationCtx, applicantId: Id<"applicants">, status: Doc<"applicants">["status"]) {
  const cur = await ctx.db.get(applicantId);
  if (!cur) return;
  if (cur.status === "approved" || cur.status === "declined") return; // a human already acted
  if (cur.status === "hard_stop" && status !== "hard_stop") return;
  if (cur.status === "awaiting_human" && cur.chosenOfferId && status !== "awaiting_human") return;
  if (cur.status !== status) await ctx.db.patch(applicantId, { status });
}

export const playTick = internalMutation({
  args: { applicantId: v.id("applicants"), recordingId: v.id("recordings"), start: v.number(), end: v.number() },
  handler: async (ctx, { applicantId, recordingId, start, end }) => {
    const applicant = await ctx.db.get(applicantId);
    const row = await ctx.db.get(recordingId);
    if (!applicant || !row) return; // board was reset mid-replay
    const rec = row.data as Rec;
    const items = timeline(rec).slice(start, end);

    const lenderOf = new Map(rec.offers.map((o) => [o._id, o.lender as string]));
    let ids = await offerMap(ctx, applicantId, rec);
    const subsNow = (): Array<[string, string]> => {
      const out: Array<[string, string]> = [...ids.entries()].map(([from, to]) => [from, String(to)]);
      if (rec.applicant.name !== applicant.name) out.push([rec.applicant.name, applicant.name]);
      return out;
    };
    const refresh = async () => {
      ids = await offerMap(ctx, applicantId, rec);
    };

    for (const it of items) {
      if (it.kind === "bundle") {
        const b = rec.bundle;
        await ctx.db.insert("bundles", {
          applicantId,
          source: b.source,
          pulledAt: Date.now(),
          credit: b.credit,
          identity: b.identity,
          fraud: b.fraud,
          flags: b.flags,
          raw: { replay: true },
        });
      } else if (it.kind === "check") {
        const recOffer = rec.offers.find((o) => o._id === rec.reasonChecks[it.i].offerId);
        if (!recOffer) continue;
        const offerId = await ensureOffer(ctx, applicantId, recOffer);
        await refresh();
        const subs = subsNow();
        const c = rewrite(rec.reasonChecks[it.i], subs);
        // first verdict for a lender: reveal the verified flags on its reasons
        await ctx.db.patch(offerId, { reasons: rewrite(recOffer.reasons, subs) });
        await ctx.db.insert("reasonChecks", {
          offerId,
          applicantId,
          lender: c.lender,
          field: c.field,
          original: c.original ?? null,
          counterfactual: c.counterfactual ?? null,
          flipped: c.flipped,
          counterfactualDecision: c.counterfactualDecision,
          latencyMs: c.latencyMs,
          createdAt: Date.now(),
          ...(c.method ? { method: c.method } : {}),
          ...(c.verified !== undefined ? { verified: c.verified } : {}),
        });
      } else if (it.kind === "notice") {
        const n = rewrite(rec.notice, subsNow());
        const { _id: _i, t: _t, approvedAt: _a, createdAt: _c, ...rest } = n;
        await ctx.db.insert("notices", { applicantId, ...rest, createdAt: Date.now() });
      } else if (it.kind === "audit") {
        const e = rec.auditEvents[it.i];
        const lender = e.actor.startsWith("underwriter:") ? e.actor.slice("underwriter:".length) : null;
        const recOffer = lender && e.ref && lenderOf.get(e.ref) === lender ? rec.offers.find((o) => o._id === e.ref) : undefined;
        if (recOffer) {
          // started -> pending row (as live); a verdict -> the finished row
          if (e.action === "underwrite.started") await ensureOffer(ctx, applicantId, recOffer);
          else if (/^underwrite\.(approve|decline|failed)/.test(e.action)) {
            await refresh();
            await finalizeOffer(ctx, applicantId, rec, recOffer, subsNow());
          }
          await refresh();
        }
        const s = STATUS_FOR_ACTION[e.action];
        if (s) await setStatus(ctx, applicantId, s);
        const r = rewrite(e, subsNow());
        await writeAudit(ctx, { applicantId, actor: e.actor as Doc<"auditEvents">["actor"], action: r.action, ref: r.ref, note: r.note });
      } else {
        await refresh();
        for (const o of rec.offers) await finalizeOffer(ctx, applicantId, rec, o, subsNow());
        const final = rec.status as Doc<"applicants">["status"];
        if (final === "awaiting_human" || final === "hard_stop") await setStatus(ctx, applicantId, final);
      }
    }
  },
});
