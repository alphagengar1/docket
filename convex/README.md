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
| `CRS_PROVIDER` | `mock` | `mock` \| `crs`. On `crs` any failure falls back to mock with a `crs.error` audit event unless `CRS_STRICT=1`. |
| `CRS_BASE_URL` | `https://api-sandbox.stitchcredit.com/api` | |
| `CRS_USERNAME`, `CRS_PASSWORD` | unset | Login is `POST /users/login`; token cached in `secretsCache` (~50 min). A failed login is recorded and **not retried for 30 min** (repeated failures disable the sandbox account). |
| `CRS_PATH_PREQUAL`, `CRS_PATH_IDENTITY`, `CRS_PATH_FRAUD` | `TODO` | Fill from the Postman collection (or edit the constants in `crs.ts`). The client refuses to call a `TODO` path. |
| `CRS_DATA_METHOD` | `POST` | Method for the three data calls. |
| `CRS_PERSONA_MAP` | unset | JSON `{"P01": {<sandbox consumer body>}, ...}`; or fill `CRS_PERSONA_REQUESTS` in `crs.ts`. |
| `CREAO_API_KEY` | unset | Bearer for `agent.creao.ai`. |
| `CREAO_UNDERWRITER_APP_ID`, `CREAO_APP_ID_CU|FINTECH|PRIME`, `CREAO_COMPLIANCE_APP_ID` | unset | Per-lender ids override the shared underwriter id. |
| `CREAO_BASE_URL` | `https://agent.creao.ai/api/v1` | |
| `CREAO_RUNS_STYLE` | (body appId) | Set `app-path` to POST `/apps/{appId}/runs` instead of `/runs` with `appId` in the body. |
| `CONVEX_SITE_URL` | set by Convex | Used to build the webhook URL; skipped when it is localhost (the workflow polls instead). |

## Flipping providers
- Claude everywhere: set `ANTHROPIC_API_KEY`. Done.
- CREAO for compliance only (the plan if runs are slow): `AGENT_PROVIDER_COMPLIANCE=creao` + `CREAO_API_KEY` + `CREAO_COMPLIANCE_APP_ID`.
- CREAO runs are async: the offer row is inserted `pending` with `runId`; `/creao/webhook` re-fetches `GET /runs/{id}` (webhooks are unsigned) and completes it; the workflow also polls every 5 s for up to 4 min and marks leftovers `failed`.
- Live CRS: `CRS_PROVIDER=crs` + creds + the three paths + the persona map. Then check `normalizeCrsBundle()` in `crs.ts` against a real response.

## Files
| File | What |
|---|---|
| `schema.ts` | Every table in contracts.md, indexed by `applicantId`. Plus internal `secretsCache` and `agentRuns`. |
| `desk.ts` | `runDeskWorkflow` (Workflow component): pull → guardrails → 3 underwriters in parallel → compliance (only if ≥1 decline) → `awaiting_human`. Public API: `createApplicant`, `listApplicants`, `board`, `getApplicantView`, `bundles`, `offers`, `notices`, `decisions`, `auditEvents`, `approveOffer` (+ alias `approve`), `declineApplicant`. |
| `rules.ts` | Deterministic hard stops (pure). `rules.test.ts`. |
| `crs.ts`, `crs.mock.ts` | Provider switch; 20 personas P01..P20 with `defaultIntake` for the eval. |
| `agents.ts` | `runUnderwriter` / `runCompliance` steps; Claude (structured outputs + Zod, one retry), CREAO (async), stub. |
| `stub.ts` | Deterministic policies. Keep its numbers in sync with `policies/*.md`. |
| `policies.ts` | GENERATED from `policies/*.md` by `npm run policies:sync`. |
| `http.ts` | `POST /creao/webhook`, `GET /health`. |
| `eval.ts`, `evalScore.ts`, `crons.ts` | Seeds `evalCases` from `personas/map.json`, runs all personas through the real desk, writes `evalRuns`. Nightly 09:00 UTC. `eval:reseedCases` after the teammate edits the answer key. |
| `market.ts`, `personas.ts` | `market:rates` (seeded static APR bands), `personas:deck` (id, name, hint; no outcome). |

Audit convention the pipeline rail reads: actor `desk`, action `step.<pull|guardrails|underwrite|compliance|human>.start|done` (`step.compliance.skipped` when no declines).
