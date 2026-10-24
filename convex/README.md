# convex/ — the whole backend

One Convex deployment: tables (design/contracts.md), the `runDesk` durable workflow, the Claude/CREAO/stub agent layer, the CRS client, the CREAO webhook, the eval runner and its nightly cron.

## Run it

```sh
npm install
# Option A: no account, local backend (what the overnight agent used)
CONVEX_AGENT_MODE=anonymous npx convex dev
# Option B: real cloud dev deployment (public URL for the CREAO webhook, dashboard, teammate access)
npx convex login && npx convex dev
```
`npx convex dev` writes `.env.local` with `CONVEX_URL` (the web app's `VITE_CONVEX_URL`) and `CONVEX_SITE_URL` (HTTP actions, e.g. `/creao/webhook`, `/health`). Local anonymous: `http://127.0.0.1:3210` / `:3211`.

```sh
npm run typecheck        # tsc --noEmit -p convex
npm test                 # node:test — rules.test.ts (hard stops) + eval.test.ts (scoring)
npm run policies:sync    # regenerate convex/policies.ts after editing policies/*.md
npx convex run desk:createApplicant '{"personaId":"P12","purpose":"debt consolidation","amountRequested":18000,"statedIncome":82000}'
npx convex run desk:board '{}'           # most recent applicant's full view
npx convex run eval:runEval '{}'         # 20 personas → evalRuns row (add {"keep":true} to leave them on the board)
```

## Env vars (set with `npx convex env set NAME value`; none are required for the mock + stub path)

| Var | Default | Meaning |
|---|---|---|
| `ANTHROPIC_API_KEY` | unset | Enables the Claude provider. **Unset → agents run the deterministic stub** (same thresholds as policies/*.md) and every offer's audit note says `[provider=stub]`. A local `ant auth login` profile does not reach the Convex runtime; a key is required. |
| `AGENT_PROVIDER_UNDERWRITER` | `claude` | `claude` \| `creao` \| `stub`. Underwriters use `claude-haiku-5-5`, effort low. |
| `AGENT_PROVIDER_COMPLIANCE` | `claude` | `claude` \| `creao` \| `stub`. Compliance uses `claude-sonnet-5-5`, effort medium. |
| `CRS_PROVIDER` | `mock` | `mock` serves the captured CRS sandbox fixtures (`convex/crs.fixtures.ts`; synthetic generator only if a fixture is missing) \| `crs` pulls the live sandbox. On `crs` any failure falls back to the fixture with a `crs.error` audit event unless `CRS_STRICT=1`. |
| `CRS_BASE_URL` | `https://api-sandbox.stitchcredit.com/api` | |
| `CRS_USERNAME`, `CRS_PASSWORD` | unset | Login is `POST /users/login`; bearer (~1h) and refreshToken cached in `secretsCache`; refresh via `/users/refresh-token` before any re-login. A failed login is recorded and **not retried for 30 min**; a 401 on a data call clears the token and surfaces an error (never loops). **Set per deployment: re-run `convex env set CRS_USERNAME ...` / `CRS_PASSWORD ...` after `npx convex login` moves you to a cloud deployment.** |
| `CRS_PERSONA_MAP` | unset | Optional JSON override `{"P01": {tu,efx,exp,identity,fraud,blj,...}}`; defaults come from `convex/crs.personas.ts`. |
| `CRS_INCLUDE_CRIMINAL`, `CRS_INCLUDE_EVICTION`, `CRS_ALWAYS_RETRIEVE` | unset | `1` adds the CIC criminal / eviction searches (off for lending by default), or always runs the redundant credit "retrieve" step. |
| `CREAO_API_KEY` | unset | Bearer for `agent.creao.ai`. |
| `CREAO_UNDERWRITER_APP_ID`, `CREAO_APP_ID_CU|FINTECH|PRIME`, `CREAO_COMPLIANCE_APP_ID` | unset | Per-lender ids override the shared underwriter id. |
| `CREAO_BASE_URL` | `https://agent.creao.ai/api/v1` | |
| `CREAO_RUNS_STYLE` | (body appId) | Set `app-path` to POST `/apps/{appId}/runs` instead of `/runs` with `appId` in the body. |
| `CONVEX_SITE_URL` | set by Convex | Used to build the webhook URL; skipped when it is localhost (the workflow polls instead). |

## Flipping providers
- Claude everywhere: set `ANTHROPIC_API_KEY`. Done.
- CREAO for compliance only (the plan if runs are slow): `AGENT_PROVIDER_COMPLIANCE=creao` + `CREAO_API_KEY` + `CREAO_COMPLIANCE_APP_ID`.
- CREAO runs are async: the offer row is inserted `pending` with `runId`; `/creao/webhook` re-fetches `GET /runs/{id}` (webhooks are unsigned) and completes it; the workflow also polls every 5 s for up to 4 min and marks leftovers `failed`.
- Live CRS: `convex env set CRS_PROVIDER crs` (creds already set). Optionally `CRS_STRICT 1` to fail loudly instead of falling back. Flip back with `CRS_PROVIDER mock`. Refresh a fixture: `convex run crs:captureFixture '{"personaId":"P01"}'`.
  Live latency measured 2026-10-24: 6 sandbox calls per persona (TU, EFX, EXP, identity, FraudFinder, BLJ; 9 when the order response lacks a report, e.g. the deceased file), 2.1-4.4 s wall (avg 3.0 s) with 200 ms spacing; 20 personas in parallel took 45 s end-to-end including the three underwriters. Each call is 0.2-0.7 s.

## The three differentiators (design/differentiators.md)
1. **Reason verification** — `verify.ts`. For every decline, each reason's field is set to a passing value and that one lender is re-run (`underwriteOnce`); a second leave-one-out pass handles jointly sufficient reasons. Rows land in `reasonChecks`; `offers.reasons[].verified` is set; the notice only uses reasons with `verified !== false`. Runs automatically (`step.verify.*`, before compliance) and on demand via `verify:verifyReasonsNow {offerId}`. Query `verify:reasonChecks {applicantId|offerId}`; also included in `desk:getApplicantView` as `reasonChecks`.
2. **ECOA classification + FCRA** — `classify.ts`. `offers.classification` is computed in code (approve / counteroffer / deny); a notice is generated for any deny or counteroffer; the FCRA paragraph (source "CRS Credit API sandbox", pull date, "the consumer reporting agency did not make the decision") is appended in code, never by the LLM. `notices.required/requiredBecause/lendersCounteroffered/droppedReasons`.
3. **Dispute and replay** — `desk:disputeTradeline {applicantId, tradelineIndex, note?}` writes an `applicant` audit event, creates a linked applicant (`replayOf`) and re-runs the desk on a corrected bundle (mock: tradeline removed, utilization rescaled, score +5/+25; crs: re-pulled). `getApplicantView` returns `replays: Id[]` on the original.

Passing values used by the counterfactuals: fico9/vantage4 → 780, utilization → 0.10, inquiries6mo → 0, fraud.score → 5, flags.* → false, identity.verified → true, statedIncome → amountRequested/0.35 rounded up, amountRequested → max($2,500, min(requested, 30% of income, $5k)) so it also clears every policy's dollar cap. Fields without a mapping (tradelines, fraud.signals) are "untested" (verified = null).

## Files
| File | What |
|---|---|
| `schema.ts` | Every table in contracts.md, indexed by `applicantId`. Plus internal `secretsCache` and `agentRuns`. |
| `desk.ts` | `runDeskWorkflow` (Workflow component): pull → guardrails → 3 underwriters in parallel → compliance (only if ≥1 decline) → `awaiting_human`. Public API: `createApplicant`, `listApplicants`, `board`, `getApplicantView`, `bundles`, `offers`, `notices`, `decisions`, `auditEvents`, `approveOffer` (+ alias `approve`), `declineApplicant`. |
| `rules.ts` | Deterministic hard stops (pure). `rules.test.ts`. |
| `verify.ts` | Counterfactual reason test (two passes), `verifyReasonsNow` button, `reasonChecks` query. |
| `classify.ts` | approve / counteroffer / deny, notice-required rule, FCRA paragraph. `classify.test.ts`. |
| `crs.ts` | Provider switch, token cache/refresh, `pullBundle`, `captureFixture`. |
| `crs.core.ts` | Pure: sandbox product calls + `normalizeProducts` (bundle, `bureaus`, notes). Fraud score mapping: FraudFinder `risk.score` is already 0-100, high = risky, used as-is. `credit.fico9` is the TU score (sandbox TU returns VantageScore 4.0 under the fico9 product, noted per bundle); `bureaus` {tu,efx,exp:{status,score,model}} lives in `bundles.raw`. |
| `crs.personas.ts` | Real CRS test personas P01..P20 (names, labels, request bodies per product). |
| `crs.fixtures.ts`, `fixtures/crs/Pxx.json` | Normalized bundles (served by the mock) and full raw sandbox responses captured live. |
| `crs.mock.ts` | Serves the fixtures, `defaultIntake` per persona for the eval; old synthetic personas are fallback only. |
| `agents.ts` | `runUnderwriter` / `runCompliance` steps; Claude (structured outputs + Zod, one retry), CREAO (async), stub. |
| `stub.ts` | Deterministic policies. Keep its numbers in sync with `policies/*.md`. |
| `policies.ts` | GENERATED from `policies/*.md` by `npm run policies:sync`. |
| `http.ts` | `POST /creao/webhook`, `GET /health`. |
| `eval.ts`, `evalScore.ts`, `crons.ts` | Seeds `evalCases` from `personas/map.json`, runs all personas through the real desk, writes `evalRuns`. Nightly 09:00 UTC. `eval:reseedCases` after the teammate edits the answer key. |
| `market.ts`, `personas.ts` | `market:rates` (seeded static APR bands), `personas:deck` (id, name, hint; no outcome). |

Audit convention the pipeline rail reads: actor `desk`, action `step.<pull|guardrails|underwrite|verify|compliance|human>.start|done` (`step.compliance.skipped` when no notice is required). Reason-test detail: actor `underwriter:<lender>`, actions `verify.supported|unsupported|inconclusive|sanity`, ref = field. Dispute: actor `applicant`, action `dispute.tradeline`, ref `credit.tradelines[i]`.
