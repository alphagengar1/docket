// Pure scoring for the eval runner (unit-tested in eval.test.ts).
export type Expected = "approve" | "decline" | "hard_stop";
export type Got = Expected | "pending" | "error";

export type CaseObservation = {
  status: string;
  offers: Array<{ status: string; decision: "approve" | "decline" | null; reasons: Array<{ field: string }> }>;
  hardStopRefs: string[]; // auditEvents actor "rules", action "rules.hard_stop" → ref
};

export type CaseResult = {
  personaId: string;
  expected: Expected;
  got: Got;
  pass: boolean;
  why: string;
  declineReasonCounts: number[];
  offersCount: number;
};

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
  };
}

export function aggregate(results: CaseResult[]) {
  const cases = results.length;
  const agree = results.filter((r) => r.got === r.expected).length;
  const denials = results.flatMap((r) => r.declineReasonCounts);
  return {
    cases,
    agreement: cases ? agree / cases : 0,
    fraudZeroOffers: results.filter((r) => r.expected === "hard_stop").every((r) => r.offersCount === 0),
    avgReasonsPerDenial: denials.length ? denials.reduce((a, b) => a + b, 0) / denials.length : 0,
    failures: results.filter((r) => !r.pass).map((r) => ({ personaId: r.personaId, expected: r.expected, got: r.got, why: r.why })),
  };
}
