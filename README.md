# Docket

Docket is a one-person credit union. One human loan officer runs a lending desk through an org chart of agents. An applicant gives consent and states a loan purpose and income. The backend pulls CRS sandbox data (three bureaus, identity, FraudFinder, liens and judgments). Five underwriter agents, each with a written policy, return an offer or a decline, and a compliance agent drafts the adverse-action notice. Before any notice goes out, Docket tests each decline reason by changing that one factor and re-running the lender, and it withholds any reason that does not change the decision. The loan officer approves every offer. Screens: an operator console (Instrument Tag theme) with an Alloy-style Decision Summary, a ranked decision queue, a decision sheet, editor-style rail panels and a desk assistant that summarizes the audit trail; a judge board at `#/board`; a borrower phone at `#/borrower`. Live: https://docket-sepia-ten.vercel.app
## What is real vs simulated

Real:
- Credit data is a CRS sandbox response for CRS test personas. The endpoints, response formats and schema are the production ones.
- The five lender agents run Claude (`claude-haiku-5-5` for underwriters, `claude-sonnet-5-5` for compliance) against written policies in `policies/`.
- Hard stops, offer classification, the FCRA paragraph, the PII boundary and the eval are code with tests.

Simulated:
- The five lenders are ours. They are agents with written policies. Pacific Ridge Credit Union, Northstar Lending, Meridian Bank Prime, Cascade Regional Bank and Harbor Second Chance Finance are fictional names. This is not a marketplace.
- No money moves. No real lender is contacted.
- Every applicant is one of 20 CRS test personas. There are no real people in this repo.
- A human approves every offer and every notice. Override on a hard stop is always refused and logged.
- Income is typed by the applicant, because CRS has no income data.
- The cloud deployment currently serves captured CRS sandbox responses (`CRS_PROVIDER=mock`, fixtures in `convex/fixtures/crs`). Setting `CRS_PROVIDER=crs` pulls the live sandbox (6 calls per persona, about 3 s). The pulls are the soft-pull prequalification products.
- Scores are VantageScore 4. The sandbox "fico9" product returns VantageScore 4.0, so we never claim FICO.

## How it works

One durable workflow, `runDesk` in `convex/desk.ts` (Convex Workflow component), owns the order, retries and audit trail. Specialist agents are stateless and have one job each.

1. Intake: consent screen, purpose, amount, stated income.
2. Pull: `crs.ts` calls TransUnion, Equifax and Experian prequal, identity verification, FraudFinder and public records.
3. Guardrails: `rules.ts` stops deceased files, unscorable files, failed identity and fraud score 80 or more. No lender sees a stopped file.
4. Underwrite x5 in parallel (conservative credit union, growth fintech, prime bank, regional relationship bank, second-chance subprime lender), each with a 20 s timeout. Then reason verification runs, then the compliance agent writes the notice from verified reasons only.
5. Human: status becomes `awaiting_human`. In the console the loan officer sees the Decision Summary and the ranked queue, opens the decision sheet, and approves an offer or sends the notice. The desk assistant (`convex/assistant.ts`) summarizes the audit trail on request.

Every step appends an `auditEvents` row.

## Three differentiators

1. Counterfactual reason verification (`convex/verify.ts`). Regulation B wants the principal reasons the creditor actually relied on, so we test them. We found the lender agents padded declines with filler reasons such as "score meets minimum" or "fraud score below threshold". The test withholds those from the notice.
2. Approve, counteroffer or deny (`convex/classify.ts`). Classification is computed in code from requested versus offered terms. A notice is required for a denial or an unaccepted counteroffer, and the notice carries the FCRA statement that the consumer reporting agency did not make the decision, with its name and pull date.
3. Dispute and replay (`desk:disputeTradeline`). The applicant disputes a tradeline, we re-run all five lenders on the corrected file and show which offers and notices changed.

## Eval

The test set is the 20-persona answer key in `personas/map.json`, written by the data science teammate: approve means at least one lender approves, decline means every lender declines, hard stop means `rules.ts` stops it. `eval:runEval` runs all 20 through the real desk and scores them. It runs nightly (`convex/crons.ts`) and from the board.

Latest recorded runs: 20/20 agreement with the key and 60/60 per-lender agreement on the three-lender build. [check: re-run on the five-lender build for reasons-verified and latency; CREAO runs take 23 to 33 s per lender.] This shows consistency with our own key. It does not prove fairness. Twenty personas cannot.

## Responsible design

- Hard stops are code (`convex/rules.ts`, tested), not prompts. A model cannot approve a deceased or unscorable file.
- Agent input is an allowlist projection (`convex/pii.ts`, tested by `pii.test.ts`). Name, address, ZIP, SSN, date of birth, phone, email and raw bureau blobs have no path to any agent. The notice uses `{{APPLICANT_NAME}}` and code fills it. Criminal records are not used for lending.
- Consent gate before any pull. The consent text states a soft pull that does not affect a score.
- A human approves every offer and notice. Underwriter output is schema-validated (Zod), retried once, then recorded as a failure.
- Every denial carries at least two reasons with field references.

## Architecture

```
 Judge draws a persona card
        |
        v
 web/ (Vite + React + Convex client)  -- useQuery (live) --  convex/ tables
   #/borrower  phone: code, offers, notice, approve         applicants, bundles, offers,
   #/board     second screen: pipeline, lenders, eval       notices, reasonChecks, decisions,
   console     operator: approve, reset, replay             auditEvents, evalCases, evalRuns,
        | useMutation / useAction                           recordings, marketRates
        v
 convex/desk.ts  runDesk(applicantId)  (Workflow component, durable)
   1. pullBundle   -> crs.ts      CRS sandbox (or fixtures)
   2. guardrails   -> rules.ts    deterministic hard stops
   3. underwrite x5-> agents.ts   claude-haiku-5-5, parallel, 20 s timeout
      verify       -> verify.ts   counterfactual reason test
   4. compliance   -> agents.ts   claude-sonnet-5-5, notice from verified reasons
   5. ready        -> awaiting_human; Approve writes decisions
 convex/eval.ts    20 personas -> evalRuns (nightly via crons.ts)
 convex/http.ts    GET /health, POST /creao/webhook, /api/v1/* (convex/api.ts)
```

## How to run

```sh
npm install
CONVEX_AGENT_MODE=anonymous npx convex dev     # local backend, no account
# or: npx convex login && npx convex dev       # cloud dev deployment
npm run typecheck && npm test
npm run policies:sync                          # after editing policies/*.md
cd web && npm install && npm run dev           # set VITE_CONVEX_URL from web/.env.example
```

Open `#/borrower` on a phone and `#/board` on a second screen. Set env vars with `npx convex env set NAME value`. Names only: `ANTHROPIC_API_KEY` (unset runs a deterministic stub, labeled in the audit log), `CRS_PROVIDER`, `CRS_USERNAME`, `CRS_PASSWORD`, `CRS_STRICT`, `LENDER_TIMEOUT_MS`, `GIT_SHA`, `AGENT_PROVIDER_UNDERWRITER`, `AGENT_PROVIDER_COMPLIANCE`, and the optional `CREAO_*` set. See `convex/README.md`.

**Schema-gated provider failover.** Every agent reply, from CREAO or Claude, is validated against the same Zod schema before it touches an offer or a notice. A reply that fails validation, arrives as prose, or misses the 90 s window is re-run on Claude automatically; the failed row is dropped and the audit trail records the failover. The desk never shows a failed lender or a missing notice because of a provider.

## Integrate it

Docket is a drop-in underwriting layer: a bearer-authenticated HTTP API (`/api/v1/*`) that returns one standard DecisionRecord per applicant ([schema](docs/schema/decision-record.schema.json)), an MCP server in [`mcp/`](mcp/README.md) for your own agents, and a benchmark endpoint that scores Docket against your answer key. A human still approves every offer. Start with [docs/integration.md](docs/integration.md).

## Sponsors

### CRS
- Endpoints used: `/transunion/credit-report/standard/tu-prequal-fico9`, `/equifax/credit-report/standard/efx-prequal-vantage4`, `/experian/credit-report/standard/exp-prequal-vantage4`, `/transunion/identity-manager-verification/basic`, `/fraud-finder/fraud-finder`, `/pp/fcrablj/data`.
- Personas: CRS test personas P01 to P20, including a deceased file, frozen file, no-file and thin-file cases.
- Live demo: https://docket-sepia-ten.vercel.app. Video: https://youtu.be/MmCWVIkHxjI. Judge draws a card and types its 4-digit code on the phone. Live pulls need `CRS_PROVIDER=crs`; say out loud which mode is on.

### Convex
- Tables: applicants, bundles, offers, notices, reasonChecks, decisions, auditEvents, evalCases, evalRuns, recordings, marketRates, plus internal agentRuns and secretsCache.
- Workflow component runs `runDeskWorkflow`. httpActions: `/health`, `/creao/webhook`. Scheduler: nightly eval cron. Live queries drive the phone and the board.
- Deployment: https://warmhearted-seahorse-595.convex.cloud (dev).

### Hyphenate
- Seats filled: underwriter (five policies) and compliance.
- Human approver: the loan officer approves every offer and sends every notice. Override is refused and logged.
- Planted errors with answer key: the deceased, frozen, no-file and fraud personas in `personas/map.json`.
- The moment: the deceased card. The board turns red, a coded rule fires, zero offers, and the notice tells the applicant how to dispute.

### Microsoft (Built for the Real World)
- Production path: eval harness (20 personas, nightly), per-lender 20 s timeout with a "No response" state, structured audit logging, guardrails (consent, hard stops, PII allowlist, human approval), replay fallback, warm-up call.
- Deploy URL: https://docket-sepia-ten.vercel.app.

### Anthropic
- Named community: loan officers at small credit unions who give a "no" with no usable reason.
- Where Claude could go wrong: inventing a reason or padding it with filler (tested and withheld), hanging or erroring (timeout, failure card), and being handed protected data (blocked by the allowlist). Claude never decides a hard stop.

### CREAO (only if entered)
Agent app IDs (not secret; API keys live only in the Convex env):
- Docket Underwriter: Pacific Ridge Credit Union (cu): 39632f67-c976-4496-991d-31bdbbbec47d
- Docket Underwriter: Northstar Lending (fintech): 58a80034-8506-43e9-9570-111b592ca11e
- Docket Underwriter: Meridian Bank Prime (prime): 316a0337-e75e-4391-911d-b33bf67f8a97
- Docket Underwriter: Cascade Regional Bank (regional): 5cdf5e19-8040-43ec-81f5-0ed34e643c6d
- Docket Underwriter: Harbor Second Chance Finance (subprime): dd2bfed5-49ea-476e-8fc8-b8ef24b3b585
- Docket Compliance: adverse-action notice: 11425cb9-95c8-49d9-b962-19ddba3cb70e

Run links (private chat URLs, require a logged-in CREAO session; no public share link has been created on purpose):
- Pacific Ridge Credit Union: https://agent.creao.ai/chat?threadId=fca27e15-c517-424d-8ae7-9949c39e4dc5 (approve, 26.5 s)
- Northstar Lending: https://agent.creao.ai/chat?threadId=8be644c2-3dc5-4de8-afec-bdce6b43d857 (approve, 27.5 s)
- Meridian Bank Prime: https://agent.creao.ai/chat?threadId=4c6d3041-3c4e-4c9b-b34b-1dc35339a5d2 (decline, 26.9 s)
- Cascade Regional Bank: https://agent.creao.ai/chat?threadId=7e8b1687-afd6-4c04-a5d8-a62c558fde65 (decline, 33.3 s)
- Harbor Second Chance Finance: https://agent.creao.ai/chat?threadId=4f57270a-76ee-4ed4-b7f9-a271b3db6ec7 (approve, 23.1 s)
- Compliance notice: https://agent.creao.ai/chat?threadId=a776155e-e276-4f65-a508-eb3213ff4fc1 (notice parsed, awaiting_human, 23.4 s)

## Team

Swaraj Adhikari, UCLA. Matthew Pun, UC Berkeley.

## License

MIT. See [LICENSE](LICENSE).
