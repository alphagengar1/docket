# Contracts (shared; change only together). These are the Convex table shapes.

applicants  { _id, personaId: string, name: string (persona display name), purpose: string, amountRequested: number,
              statedIncome: number, consentAt: number, status: "intake"|"pulling"|"guardrails"|"underwriting"|"compliance"|"awaiting_human"|"approved"|"declined"|"hard_stop",
              createdAt: number }
bundles     { _id, applicantId, source: "crs"|"nessie"|"mock", pulledAt: number,
              credit: { fico9: number|null, vantage4: number|null, tradelines: Array<{type, balance, status, openedAt}> , inquiries6mo: number, utilization: number|null },
              identity: { verified: boolean, flags: string[] },
              fraud: { score: number|null, signals: string[] },
              flags: { deceased: boolean, frozen: boolean, bankruptcy: boolean, eviction: boolean, lienOrJudgment?: boolean },  // lienOrJudgment (optional, absent = false): >=1 unsatisfied lien or non-eviction civil judgment in BLJ public records
              raw: any }
offers      { _id, applicantId, lender: "cu"|"fintech"|"prime", provider: "claude"|"creao", status: "pending"|"done"|"failed",
              decision: "approve"|"decline"|null, apr: number|null, termMonths: number|null, amount: number|null,
              conditions: string[], reasons: Array<{ text: string, field: string }>, marketAnchor: {tier, aprLow, aprHigh}|null,
              runId: string|null, shareUrl: string|null, latencyMs: number|null, createdAt: number }
notices     { _id, applicantId, text: string, lendersDeclined: string[], createdAt: number }   // adverse-action notice
decisions   { _id, applicantId, chosenOfferId: string|null, outcome: "approved"|"declined"|"hard_stop", approvedBy: "human", at: number, note: string }
auditEvents { _id, applicantId, at: number, actor: "intake"|"desk"|"crs"|"rules"|"underwriter:cu"|"underwriter:fintech"|"underwriter:prime"|"compliance"|"human",
              action: string, ref: string|null, note: string }
evalCases   { _id, personaId, expected: "approve"|"decline"|"hard_stop", expectedReasonsIncludes: string[], expectedPerLender?: {cu,fintech,prime: "approve"|"counteroffer"|"decline"|"none"}, note: string }
evalRuns    { _id, startedAt, finishedAt: number|null, cases: number, agreement: number, fraudZeroOffers: boolean, avgReasonsPerDenial: number,
              failures: Array<{ personaId, expected, got, why }> }
marketRates { _id, tier: "excellent"|"good"|"fair"|"poor", aprLow: number, aprHigh: number, source: string, fetchedAt: number }

Underwriter agent input  { bundle: bundles-row-without-raw, policy: string (markdown), statedIncome, amountRequested, purpose, marketAnchor? }
Underwriter agent output { decision, apr, termMonths, amount, conditions[], reasons[{text, field}] }   // Zod-validated
Compliance agent input   { applicant display fields, declines: Array<{lender, reasons[]}> }
Compliance agent output  { text }   // plain-English adverse-action notice, names each reason, no legal boilerplate longer than 2 sentences

Hard-stop rules (rules.ts, deterministic): flags.deceased || flags.frozen || !identity.verified || (fraud.score != null && fraud.score >= 80) → status "hard_stop", zero offers, auditEvent with the triggering field.
