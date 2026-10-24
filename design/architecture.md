# Architecture (v2, Sat 01:10)

## Decision: Convex is the whole backend
No Express server. Convex actions call CRS, Claude and (optionally) CREAO; Convex httpActions receive webhooks at a public URL with no ngrok; the Convex scheduler runs the nightly eval. One deploy, one URL, and every table is live on the board. This is also what Convex judges mean by depth.

```
 Judge draws a persona card
        │
        ▼
 web/ (Vite + React + Convex client)  ── useQuery (live) ──  convex/ tables
   ├─ Intake pane (chat, consent, income)                     applicants, bundles, offers,
   ├─ Pipeline rail (steps light up)                          decisions, auditEvents,
   ├─ Three lender columns (offers stream in)                 evalCases, evalRuns, marketRates
   ├─ Decision pane (reasons, adverse-action notice, Approve)
   └─ Eval panel + audit log (projector tab)
        │ useMutation / useAction
        ▼
 convex/desk.ts   runDesk(applicantId)  ← the central orchestrator (Workflow component, durable)
   1. pullBundle      → crs.ts: live sandbox (prequal, IDV, fraud)  | crs.mock.ts until creds arrive
   2. guardrails      → rules.ts: deterministic hard stops (deceased, frozen, IDV fail, fraud ≥ threshold)
   3. underwrite ×3   → agents.ts: runAgent("underwriter", {bundle, policy}) in parallel
   4. compliance      → runAgent("compliance", {bundle, declines}) → adverse-action notice
   5. ready           → status "awaiting_human"; Approve button writes decisions
   every step appends auditEvents
        │
        ▼
 convex/agents.ts  runAgent(role, input) → provider switch
   "claude": Anthropic SDK, structured JSON output (Zod), temperature 0
   "creao":  POST agent.creao.ai/api/v1/runs {appId, inputs, webhookUrl}; result lands in
             convex/http.ts /creao/webhook → offers row flips pending → done
   Same Offer shape either way. Provider is an env var per role. Decide CREAO Sat 12:30.

 convex/eval.ts   runEval(): for each evalCases row → runDesk on that persona → compare to expected
                  → evalRuns row {agreement, fraudZeroOffers, avgReasonsPerDenial, failures[]}
                  Scheduled nightly (crons.ts) and runnable from the Eval panel.
 convex/market.ts (optional, Apify add-on) scheduled action fills marketRates by tier.
```

## Why a central orchestrator plus specialists
One durable workflow owns the order, the retries and the audit trail; the specialists (underwriters, compliance) are stateless functions with one job and a fixed output shape. That is what Hyphenate means by "a system you'd hire": limited access per seat, a clean record of work, and a human at the approval step. It is also the easiest shape to demo: the pipeline rail on the board mirrors the workflow steps one to one.

## Hard rules
- Hard stops are code, not prompts. The LLM never gets to approve a deceased or frozen file.
- Underwriters return `Offer` JSON validated by Zod; a malformed response is retried once, then recorded as a failure, never shown as an offer.
- Every denial has ≥ 2 reasons drawn from the bundle, each with a field reference (`credit.fico9`, `fraud.signals[1]`).
- No real PII. Personas only. `statedIncome` is typed by the applicant, not pulled.
- A human clicks Approve. The system never finalizes a loan.

## Repo layout
```
convex/      schema.ts, desk.ts, crs.ts, crs.mock.ts, rules.ts, agents.ts, http.ts, eval.ts, crons.ts, market.ts
web/         Vite + React + TS. src/hooks/useDesk.ts is the ONLY place the UI touches Convex.
policies/    cu.md, fintech.md, prime.md  (teammate) explicit rules + prompt text
personas/    map.json: personaId → expected outcome + reasons (teammate)
eval/        notes and the answer key; the runner itself is convex/eval.ts
design/      these docs. STATUS.md is the overnight log.
```

## Ownership
Swaraj: convex/, web/, deploy, Devpost. Teammate: policies/, personas/, eval answer key, pitch + eval panel content. Shared: design/contracts.md (change together).

## Fallbacks
- No CRS creds by Sat 11:00 → `crs.ts` targets Capital One Nessie (accounts, transactions → cashflow underwriting). Nothing else changes.
- CREAO no-go → provider stays "claude"; drop the CREAO track.
- CREAO runs > 4 min → underwriters on "claude", compliance only on "creao".
- Convex outage at demo → `web/` has a recorded-run replay mode fed from a JSON fixture.
