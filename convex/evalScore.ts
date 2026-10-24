// Pure scoring for the eval runner (unit-tested in eval.test.ts).
import { LENDERS, type Lender } from "./types.ts";
export type Expected = "approve" | "decline" | "hard_stop";
export type Got = Expected | "pending" | "error";
export type PerLenderOutcome = "approve" | "counteroffer" | "decline" | "none";
/** Per-lender answer key. Only the lenders named in the key are scored, so an older key with three lenders still works. */
export type ExpectedPerLender = Partial<Record<Lender, PerLenderOutcome>>;

export type CaseObservation = {
  status: string;
  offers: Array<{ status: string; decision: "approve" | "decline" | null; classification?: "approve" | "counteroffer" | "deny" | null; reasons: Array<{ field: string }>; lender?: string; latencyMs?: number | null }>;
  hardStopRefs: string[]; // auditEvents actor "rules", action "rules.hard_stop" → ref
  reasonChecks?: Array<{ flipped: boolean }>;
};

export type CaseResult = {
  personaId: string;
  expected: Expected;
  got: Got;
  pass: boolean;
  why: string;
  declineReasonCounts: number[];
  offersCount: number;
  checks: { total: number; flipped: number };
  latencies: Array<{ lender: string; ms: number }>;
  /** Present only when the case has an expectedPerLender key. */
  perLender?: Array<{ lender: string; expected: PerLenderOutcome; got: PerLenderOutcome; match: boolean }>;
};

/** What one lender did: none (hard stop or no finished offer), decline, counteroffer or approve. */
export function observedPerLender(o: CaseObservation, lender: string): PerLenderOutcome {
  if (o.status === "hard_stop") return "none";
  const offer = o.offers.find((x) => x.lender === lender && x.status === "done");
  if (!offer) return "none";
  if (offer.decision !== "approve") return "decline";
  return offer.classification === "counteroffer" ? "counteroffer" : "approve";
}

export function observedOutcome(o: CaseObservation): Got {
  if (o.status === "hard_stop") return "hard_stop";
  const done = o.offers.filter((x) => x.status === "done");
  if (o.offers.some((x) => x.status === "pending")) return "pending";
  if (done.some((x) => x.decision === "approve")) return "approve";
  if (done.length > 0) return "decline";
  return "error";
}

export function scoreCase(
  personaId: string,
  expected: Expected,
  expectedReasonsIncludes: string[],
  o: CaseObservation,
  expectedPerLender?: ExpectedPerLender | null,
): CaseResult {
  const got = observedOutcome(o);
  const declineReasonCounts = o.offers.filter((x) => x.status === "done" && x.decision === "decline").map((x) => x.reasons.length);
  const fields = new Set<string>([
    ...o.offers.filter((x) => x.decision === "decline").flatMap((x) => x.reasons.map((r) => r.field)),
    ...o.hardStopRefs,
  ]);
  const missing = expectedReasonsIncludes.filter((f) => !fields.has(f));
  const problems: string[] = [];
  if (got !== expected) problems.push(`expected ${expected}, got ${got}`);
  if (missing.length) problems.push(`missing reason fields: ${missing.join(", ")}`);
  if (expected === "hard_stop" && o.offers.length > 0) problems.push(`${o.offers.length} offer row(s) exist on a hard stop`);
  if (declineReasonCounts.some((n) => n < 2)) problems.push("a decline carried fewer than two reasons");
  return {
    personaId,
    expected,
    got,
    pass: problems.length === 0,
    why: problems.join("; "),
    declineReasonCounts,
    offersCount: o.offers.length,
    checks: { total: o.reasonChecks?.length ?? 0, flipped: o.reasonChecks?.filter((c) => c.flipped).length ?? 0 },
    latencies: o.offers.filter((x) => x.lender && x.latencyMs != null).map((x) => ({ lender: x.lender!, ms: x.latencyMs! })),
    perLender: expectedPerLender
      ? (Object.keys(expectedPerLender) as Lender[])
          .filter((l) => expectedPerLender[l] != null)
          .map((l) => {
            const g = observedPerLender(o, l);
            const e = expectedPerLender[l]!;
            return { lender: l, expected: e, got: g, match: g === e };
          })
      : undefined,
  };
}

export function p50(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function aggregate(results: CaseResult[]) {
  const cases = results.length;
  const agree = results.filter((r) => r.got === r.expected).length;
  const denials = results.flatMap((r) => r.declineReasonCounts);
  const total = results.reduce((a, r) => a + r.checks.total, 0);
  const flipped = results.reduce((a, r) => a + r.checks.flipped, 0);
  const lat = (lender: string) => p50(results.flatMap((r) => r.latencies.filter((l) => l.lender === lender).map((l) => l.ms)));
  const slots = results.flatMap((r) => (r.perLender ?? []).map((s) => ({ personaId: r.personaId, ...s })));
  const perLenderMatched = slots.filter((s) => s.match).length;
  return {
    perLenderAgreement: slots.length ? perLenderMatched / slots.length : null,
    perLenderMatched,
    perLenderTotal: slots.length,
    perLenderMismatches: slots.filter((s) => !s.match).map((s) => ({ personaId: s.personaId, lender: s.lender, expected: s.expected, got: s.got })),
    reasonsVerifiedPct: total ? flipped / total : 0,
    latencyP50Ms: Object.fromEntries(LENDERS.map((l) => [l, lat(l)])) as Record<string, number | null>,
    cases,
    agreement: cases ? agree / cases : 0,
    fraudZeroOffers: results.filter((r) => r.expected === "hard_stop").every((r) => r.offersCount === 0),
    avgReasonsPerDenial: denials.length ? denials.reduce((a, b) => a + b, 0) / denials.length : 0,
    failures: results.filter((r) => !r.pass).map((r) => ({ personaId: r.personaId, expected: r.expected, got: r.got, why: r.why })),
  };
}
