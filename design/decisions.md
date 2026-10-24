# Decisions
- 2026-10-24 00:30 Product: one-person credit union. Stack: Node/TS, Convex, React, Claude. Fresh repo.
- 2026-10-24 01:05 Database is Convex only. Apify considered as a market-rate Actor add-on, not core.
- 2026-10-24 01:10 Backend is Convex-native (actions, httpActions, Workflow component). No Express. Central runDesk workflow + stateless specialist agents. Hard stops are code.
- 2026-10-24 01:20 Local dev without an account: `CONVEX_AGENT_MODE=anonymous npx convex dev` (local backend on :3210/:3211). `convex/_generated` is committed.
- 2026-10-24 01:35 Policies live as markdown in policies/ (teammate) and are embedded into convex/policies.ts by `npm run policies:sync`; the Convex runtime cannot read files.
- 2026-10-24 01:40 Agent providers degrade: claude → stub when no ANTHROPIC_API_KEY; CRS → mock on any error unless CRS_STRICT=1. The audit log always records which one ran.
- 2026-10-24 01:45 Underwriter "temperature 0" implemented as structured outputs + Zod + effort "low" (the current Messages API rejects `temperature`).
- 2026-10-24 01:45 CREAO completion = webhook (re-fetch, never trust payload) AND a 5 s poll loop inside the workflow, so it works without a public URL.
