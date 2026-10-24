# Differentiators (from Claude Web research on 9 similar projects, Sat ~02:00)

## Claims judges have heard too often. Do not lead with these.
"Decisions in seconds, not days" · "Fully autonomous, no human in the loop" · "Agents debate like a credit committee" · "Explainable and transparent" (with no test) · "Fairer through alt data" · "Full audit trail" (table stakes) · "The LLM never does the math" (good practice, don't lead with it).

## Three angles no similar project took. Build all three; lead with #1.

### 1. Prove the reasons (counterfactual reason test)
Regulation B requires the principal reasons to be the factors the creditor actually considered. Nobody tests that. For each decline reason with a field reference: change only that field in the bundle to a passing value, re-run that lender, record whether the decision flips. A reason that does not flip the decision is flagged "unsupported" and removed from the notice before a human sees it.
- Backend: `verifyReasons(offerId)` action → `reasonChecks` rows {offerId, field, original, counterfactual, flipped: bool, latencyMs}. Run automatically after compliance; also a button.
- UI: on each decline reason, a check mark "verified" or a warning "did not flip"; notice shows only verified reasons; eval panel adds "reasons verified %".
- Pitch line: "Every reason in the letter was tested. We changed that one factor and the decision changed. That's what the law means by principal reason."

### 2. Treat the three responses as a regulated event
ECOA: adverse action = denial of the amount or terms requested, absent a counteroffer. A counteroffer is an offer on different terms. The compliance agent labels each lender response approve / counteroffer / deny (approve = terms at or better than requested; counteroffer = different amount/term/APR than requested; deny). Notice is generated for denials and for unaccepted counteroffers. The notice includes the FCRA statement that the consumer reporting agency (CRS, in our demo) did not make the decision, with the bureau name and date.
- Backend: `offers.classification: "approve"|"counteroffer"|"deny"` derived from requested vs offered terms (code, not LLM); notice template adds the FCRA paragraph naming the source bundle.
- UI: status word on the offer card becomes OFFER / COUNTEROFFER / DECLINED; notice pane shows "Notice required: yes/no, why".

### 3. Dispute and replay
Most underwriting defects come from errors in the file, not the model. The applicant disputes one tradeline; we re-pull the bundle (live from CRS, or mock with the tradeline removed), re-run all three lenders, and show a diff: which offers changed, how the notice regenerated.
- Backend: `disputeTradeline(applicantId, tradelineIndex)` → new bundle version → runDesk again as a linked "replay" → `applicants.replayOf`.
- UI: "Dispute" on a tradeline row in the credit snapshot; side-by-side before/after columns; audit log shows the dispute as an actor "applicant" event.

## Steal from the field
- Run two applicants live and show they take different paths (ClaimArbiter). Our persona deck does this.
- Preset demo cases including a prompt-injection attempt in the "purpose" free-text field; the intake agent must not let it reach the underwriters as instructions (Underwriting Copilot).
- Show the rule that fired, by name, on hard stops (Consortix).
- Show the applicant's own screen, not only the underwriter's (FairQuote): a minimal applicant view that shows the notice they would receive.
- Write-up depth: judges penalized thin descriptions. README states what is real vs simulated, and includes the eval + reason-verification numbers.

## Updated pitch line
"One person runs a lending desk. Three underwriting policies compete on live bureau data, the adverse-action notice writes itself, and every reason in that notice was tested: change the factor, the decision flips. You pick the applicant."
