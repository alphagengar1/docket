# Docket

Docket is a one-person credit union. One human loan officer runs a lending desk through an org chart of agents. An applicant gives consent and states a loan purpose and income. The backend pulls CRS sandbox data (three bureaus, identity verification, fraud screen). Three underwriter agents, each with a written policy, return an offer or a decline. A compliance agent drafts the adverse-action notice. The loan officer approves. Before any notice goes out, Docket tests each decline reason by changing that one factor and re-running the lender, and it withholds any reason that does not change the decision.

## What is real vs simulated

Real:
- Credit data is a CRS sandbox response for CRS test personas. The endpoints, response formats and schema are the production ones.
- The three lender agents run Claude (`claude-haiku-5-5` for underwriters, `claude-sonnet-5-5` for compliance) against written policies in `policies/`.
- Hard stops, offer classification, the FCRA paragraph, the PII boundary and the eval are code with tests.

Simulated:
- The three lenders are ours. They are agents with written policies. Pacific Ridge Credit Union, Northstar Lending and Meridian Bank Prime are fictional names. This is not a marketplace.
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
4. Underwrite x3 in parallel (conservative credit union, growth fintech, prime bank), each with a 20 s timeout. Then reason verification runs, then the compliance agent writes the notice from verified reasons only.
5. Human: status becomes `awaiting_human`. The loan officer approves an offer or sends the notice.

Every step appends an `auditEvents` row.

## Three differentiators

1. Counterfactual reason verification (`convex/verify.ts`). Regulation B wants the principal reasons the creditor actually relied on, so we test them. We found the lender agents padded declines with filler reasons such as "score meets minimum" or "fraud score below threshold". The test withholds those from the notice.
2. Approve, counteroffer or deny (`convex/classify.ts`). Classification is computed in code from requested versus offered terms. A notice is required for a denial or an unaccepted counteroffer, and the notice carries the FCRA statement that the consumer reporting agency did not make the decision, with its name and pull date.
3. Dispute and replay (`desk:disputeTradeline`). The applicant disputes a tradeline, we re-run all three lenders on the corrected file and show which offers and notices changed.

## Eval

The test set is the 20-persona answer key in `personas/map.json`, written by the data science teammate: approve means at least one lender approves, decline means all three decline, hard stop means `rules.ts` stops it. `eval:runEval` runs all 20 through the real desk and scores them. It runs nightly (`convex/crons.ts`) and from the board.

Latest run on the cloud deployment: 20/20 agreement with the key, reasons verified 81%, p50 underwriter latency about 3 s. This shows consistency with our own key. It does not prove fairness. Twenty personas cannot.

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
   3. underwrite x3-> agents.ts   claude-haiku-5-5, parallel, 20 s timeout
      verify       -> verify.ts   counterfactual reason test
   4. compliance   -> agents.ts   claude-sonnet-5-5, notice from verified reasons
   5. ready        -> awaiting_human; Approve writes decisions
 convex/eval.ts    20 personas -> evalRuns (nightly via crons.ts)
 convex/http.ts    GET /health, POST /creao/webhook
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

## Sponsors

### CRS
- Endpoints used: `/transunion/credit-report/standard/tu-prequal-fico9`, `/equifax/credit-report/standard/efx-prequal-vantage4`, `/experian/credit-report/standard/exp-prequal-vantage4`, `/transunion/identity-manager-verification/basic`, `/fraud-finder/fraud-finder`, `/pp/fcrablj/data`.
- Personas: CRS test personas P01 to P20, including a deceased file, frozen file, no-file and thin-file cases.
- Live demo: [DEPLOY URL]. Judge draws a card and types its 4-digit code on the phone. Live pulls need `CRS_PROVIDER=crs`; say out loud which mode is on.

### Convex
- Tables: applicants, bundles, offers, notices, reasonChecks, decisions, auditEvents, evalCases, evalRuns, recordings, marketRates, plus internal agentRuns and secretsCache.
- Workflow component runs `runDeskWorkflow`. httpActions: `/health`, `/creao/webhook`. Scheduler: nightly eval cron. Live queries drive the phone and the board.
- Deployment: https://warmhearted-seahorse-595.convex.cloud (dev).

### Hyphenate
- Seats filled: underwriter (three policies) and compliance.
- Human approver: the loan officer approves every offer and sends every notice. Override is refused and logged.
- Planted errors with answer key: the deceased, frozen, no-file and fraud personas in `personas/map.json`.
- The moment: the deceased card. The board turns red, a coded rule fires, zero offers, and the notice tells the applicant how to dispute.

### Microsoft (Built for the Real World)
- Production path: eval harness (20 personas, nightly), per-lender 20 s timeout with a "No response" state, structured audit logging, guardrails (consent, hard stops, PII allowlist, human approval), replay fallback, warm-up call.
- Deploy URL: [DEPLOY URL].

### Anthropic
- Named community: loan officers at small credit unions who give a "no" with no usable reason.
- Where Claude could go wrong: inventing a reason or padding it with filler (tested and withheld), hanging or erroring (timeout, failure card), and being handed protected data (blocked by the allowlist). Claude never decides a hard stop.

### CREAO (only if entered)
Agent IDs: [INTAKE ID], [UNDERWRITER IDS x3], [COMPLIANCE ID]. Run share links: [LINKS]. Delete this section if CREAO is not entered.

## Team

Swaraj Adhikari, UCLA. Matthew Pun, UC Berkeley.

## License

[LICENSE: add a LICENSE file and name it here]
