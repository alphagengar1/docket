# Decisions
- 2026-10-24 00:30 Product: one-person credit union. Stack: Node/TS, Convex, React, Claude. Fresh repo.
- 2026-10-24 01:05 Database is Convex only. Apify considered as a market-rate Actor add-on, not core.
- 2026-10-24 01:10 Backend is Convex-native (actions, httpActions, Workflow component). No Express. Central runDesk workflow + stateless specialist agents. Hard stops are code.
- 2026-10-24 01:20 Local dev without an account: `CONVEX_AGENT_MODE=anonymous npx convex dev` (local backend on :3210/:3211). `convex/_generated` is committed.
- 2026-10-24 01:35 Policies live as markdown in policies/ (teammate) and are embedded into convex/policies.ts by `npm run policies:sync`; the Convex runtime cannot read files.
- 2026-10-24 01:40 Agent providers degrade: claude → stub when no ANTHROPIC_API_KEY; CRS → mock on any error unless CRS_STRICT=1. The audit log always records which one ran.
- 2026-10-24 01:45 Underwriter "temperature 0" implemented as structured outputs + Zod + effort "low" (the current Messages API rejects `temperature`).
- 2026-10-24 01:45 CREAO completion = webhook (re-fetch, never trust payload) AND a 5 s poll loop inside the workflow, so it works without a public URL.
- 2026-10-24 02:05 Added three differentiators (reason verification, approve/counteroffer/deny classification + FCRA statement, dispute-and-replay). Lead with reason verification. Banned claims list in design/differentiators.md.
- 2026-10-24 02:10 web: product name constant "Docket" (web/src/config.ts); every visual value lives in web/src/tokens.css; useDesk.ts is the only data module, mock-backed until morning wiring (useDesk.convex.ts).
- 2026-10-24 02:30 Reason verification runs BEFORE compliance (not after) so the notice is composed only from verified reasons; single-field flip first, leave-one-out second for jointly sufficient reasons, all-fixed sanity run gates pass 2.
- 2026-10-24 02:30 Classification and the FCRA paragraph are code, not prompt output; the compliance agent is told not to write legal boilerplate.
- 2026-10-24 02:35 Dispute replay on mock data removes the tradeline, rescales utilization by the removed card's balance share and bumps scores +5 (+25 if derogatory); on live CRS it re-pulls.
2026-10-24 crs-agent: credit.fico9 = TransUnion score even though the sandbox returns VantageScore 4.0 under tu-prequal-fico9 (noted per bundle in raw.notes); fraud.score = AtData risk.score as-is (0-100, high=risky); credit 'retrieve' step skipped because the order response already holds the report.
- 2026-10-24 03:10 Freeze at one bureau no longer hard-stops when another bureau returned a score (P15 underwrites on EFX/EXP). Criminal data is not used for lending by design (P09). Liens/judgments flag proposed for policies (P08).
