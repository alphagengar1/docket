# Contracts (shared; change only together)

ApplicantBundle { personaId, consentAt, purpose, amount, statedIncome, credit: { fico9, vantage4, tradelines[] }, identity: { verified: bool, flags[] }, fraud: { score, signals[] }, pulledAt }
Offer { id, applicantId, lender: "cu"|"fintech"|"prime", decision: "approve"|"decline"|"hard_stop", apr?, termMonths?, amount?, conditions[], reasons[] (>=2 on decline), rawAgentOutput }
Decision { applicantId, chosenOfferId?, approvedBy: "human", at, notice?: string }
AuditEvent { at, actor: "intake"|"backend"|"underwriter:cu"|..., action, ref, note }
EvalCase { personaId, expected: "approve"|"decline"|"hard_stop", expectedReasonsIncludes[] }
EvalResult { runAt, cases: n, agreement: 0..1, fraudZeroOffers: bool, avgReasonsPerDenial, failures[] }
