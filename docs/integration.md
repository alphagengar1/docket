# Integrate Docket

Docket is an underwriting layer you can drop behind your own agents: one call in, one standard record out, a human in the loop.

## What you get

- **One DecisionRecord per applicant** (`docs/schema/decision-record.schema.json`, draft 2020-12): bureau summary, every lender's decision, terms, conditions, timings, the adverse-action notice and the human decision.
- **Every denial reason carries a verification verdict.** Each reason is counterfactually tested (change that one factor, re-run the lender) and marked `verified`, `unsupported`, `untested` or `inconclusive`. Unsupported reasons stay visible but are kept out of the notice.
- **A plain-English trace** of everything that happened, as JSON events or a readable narrative.
- **The same record for humans and agents.** The console, the board and the API read the same tables.

## Three integration surfaces

1. **HTTP API**, `https://<deployment>.convex.site/api/v1/...`, header `Authorization: Bearer <DOCKET_API_KEY>`. Unset key means the API answers 503. CORS is open for GET and POST.
   `GET /applicants?status=awaiting_human`, `GET /decisions/{id}`, `GET /decisions/{id}/summary`, `GET /traces/{id}?format=json|text`, `POST /applications`, `POST /decisions/{id}/approve`, `POST /decisions/{id}/decline`, `POST /eval`.
2. **MCP server** in `mcp/` (stdio). Eight tools: `list_applicants`, `get_decision`, `get_trace`, `start_application`, `approve`, `decline`, `run_eval`, `explain`. See `mcp/README.md`.
3. **Convex functions**, if you run inside the deployment: `desk:createApplicant`, `desk:getApplicantView`, `api:decisionRecord` and the rest of `convex/`.

## Bring your own policies

`policies/*.md` are the lender brains: each file is the literal prompt an underwriter agent receives. To add a lender, write a markdown file, add a row in `LENDERS` (`convex/types.ts`) and the lender name map, then run `npm run policies:sync`. Edit a number in a policy, and the next application reflects it.

## Benchmark your tooling

`POST /api/v1/eval` runs personas through the real pipeline and scores them against an answer key. Send yours, or omit `cases` for the built-in 20.

```json
{"cases":[{"personaId":"P03","expected":"approve","expectedPerLender":{"prime":"decline","fintech":"approve"}}]}
```

You get `agreement` (overall outcome matches), `perLenderAgreement` (lender-by-lender matches, with `perLenderMismatches` naming each disagreement), `reasonsVerifiedPct` (share of tested reasons that survived the counterfactual) and `latencyP50Ms` per lender. Applicants created by an eval run are deleted afterwards. A full 20-persona run takes minutes; a single case takes about 80 seconds.

## What stays with you

- **A human approves every offer.** `approve` and `decline` require an applicant in `awaiting_human`; they record actor `human`, source `api`. Your agent should call them only on a person's instruction.
- **PII boundary.** `convex/pii.ts` allowlists what any model sees; names, contact data and SSNs never reach an agent.
- **No raw bureau payloads leave the deployment.** The record carries derived fields only (score, utilization, counts, flags), not tradelines, fraud signals or raw reports.

## Quickstart

```sh
export U=https://<deployment>.convex.site K=<DOCKET_API_KEY>
curl -s -H "Authorization: Bearer $K" "$U/api/v1/applicants?status=awaiting_human"
curl -s -X POST -H "Authorization: Bearer $K" -d '{"personaId":"P03","purpose":"debt consolidation","amountRequested":15000,"statedIncome":78000}' $U/api/v1/applications
curl -s -H "Authorization: Bearer $K" $U/api/v1/decisions/<applicantId>
curl -s -H "Authorization: Bearer $K" "$U/api/v1/traces/<applicantId>?format=text"
curl -s -H "Authorization: Bearer $K" $U/api/v1/decisions/<applicantId>/summary
curl -s -X POST -H "Authorization: Bearer $K" -d '{"lender":"fintech","note":"approved by J. Rivera"}' $U/api/v1/decisions/<applicantId>/approve
curl -s -X POST -H "Authorization: Bearer $K" -d '{"note":"applicant withdrew"}' $U/api/v1/decisions/<applicantId>/decline
curl -s -X POST -H "Authorization: Bearer $K" -d '{}' $U/api/v1/eval
```

Set the key with `npx convex env set DOCKET_API_KEY $(openssl rand -hex 24)`. Applicants are sandbox personas (P01 to P20); no money moves.
