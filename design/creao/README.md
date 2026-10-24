# CREAO agents for Docket

Four hosted agents on agent.creao.ai. The backend starts a run per lender (and one for the notice), passes one JSON object as the run input, and reads one JSON object back from the reply. Webhook + polling are already wired; you only create the agents and set env vars.

## 1. Create four agents
| Agent name on CREAO | System prompt file (paste whole file) | Test input |
|---|---|---|
| Docket Underwriter: Pacific Ridge Credit Union | `underwriter-cu.md` | `sample-underwriter-input.json` with `"lender": "cu"` |
| Docket Underwriter: Northstar Lending | `underwriter-fintech.md` | same, `"lender": "fintech"` |
| Docket Underwriter: Meridian Bank Prime | `underwriter-prime.md` | same, `"lender": "prime"` |
| Docket Compliance: adverse-action notice | `compliance.md` | `sample-compliance-input.json` |

Settings per agent: no tools, no web search, no memory. Output is one JSON object in a ```json fence; nothing else. If the builder offers a "structured output" or "JSON mode" toggle, turn it on. Temperature low.

For each agent, copy its **app id** and generate an **app API key** (starts with `capi_`). Keep keys out of git.

## 2. Test each agent on CREAO
Run it once with the sample input. Pass criteria: reply parses as JSON; underwriters return `decision` plus either (`apr`, `termMonths`, `amount`) on approve or at least two `reasons` on decline, every reason has a `field`; compliance returns `{"text": ...}` containing `{{APPLICANT_NAME}}` and no FCRA paragraph.

## 3. Set the env on the Convex deployment
From the repo root (never paste keys into chat or files):
```
N=/Users/swrj/.nvm/versions/node/v22.18.0/bin
$N/npx convex env set CREAO_APP_ID_CU <id>        && $N/npx convex env set CREAO_KEY_CU <capi_...>
$N/npx convex env set CREAO_APP_ID_FINTECH <id>   && $N/npx convex env set CREAO_KEY_FINTECH <capi_...>
$N/npx convex env set CREAO_APP_ID_PRIME <id>     && $N/npx convex env set CREAO_KEY_PRIME <capi_...>
$N/npx convex env set CREAO_COMPLIANCE_APP_ID <id> && $N/npx convex env set CREAO_COMPLIANCE_KEY <capi_...>
```
If CREAO gives one project key instead of per-app keys, set `CREAO_API_KEY` once and skip the `CREAO_KEY_*` lines. If the app API is at a different path, `CREAO_BASE_URL` (default `https://agent.creao.ai/api/v1`) and `CREAO_RUNS_STYLE=body` are the two knobs.

## 4. Flip providers one at a time
```
$N/npx convex env set AGENT_PROVIDER_COMPLIANCE creao     # start here: one run per applicant, easy to watch
$N/npx convex run desk:createApplicant '{"personaId":"P05","purpose":"furniture","amountRequested":7000,"statedIncome":41000}'
```
Watch the audit log in the console: `compliance.notice` with `[provider=creao runId=...]` means it worked. Then:
```
$N/npx convex env set AGENT_PROVIDER_UNDERWRITER creao
$N/npx convex run desk:createApplicant '{"personaId":"P03","purpose":"auto repair","amountRequested":8000,"statedIncome":52000}'
```
Offers appear as `pending` with the run id and flip to `done` on the webhook (or the 5 s poll). A run slower than 4 minutes is marked failed and the lender card says so.

## 5. If it misbehaves
- `CREAO start 404`: set `CREAO_RUNS_STYLE=body` (or check `CREAO_BASE_URL`).
- `CREAO start 401`: wrong key for that app; keys are per app.
- Offer stuck pending then failed with "no JSON object": the agent wrote prose; re-check the output section of its prompt and JSON mode.
- Roll back instantly: `AGENT_PROVIDER_UNDERWRITER claude` and `AGENT_PROVIDER_COMPLIANCE claude`.

Counterfactual reason verification always runs on Claude (synchronous re-runs), regardless of provider. Record run share links for Devpost in README.md under "CREAO".
