# Open
- CREAO eligibility (Swaraj is their workshop speaker). Decide Sat 12:30.
- CRS creds ETA. Gate Sat 11:00.
- Convex prize: $5k cash or Devpost gear?
- Product name. Candidates in design/ui-references.md: Docket, Quorum, Verdict, Sieve, Tenor.
- Apify add-on (16:00 slot, only if slice green at 12:30): public "live loan rates" Actor scraping APR ranges by credit tier; underwriters anchor offers to it; cache 1h with stale fallback. Enter Apify + Best Actor. Never scrape the applicant. Coupon APIFY_CAL_HACKS.
- (convex-agent, 01:50) Contract proposals, worked around for now: (a) `offers.provider` has no "stub" value; stub-produced offers are stored as provider "claude" with `[provider=stub]` in the matching auditEvent note — consider adding "stub" to the union. (b) Two internal tables not in contracts.md: `secretsCache` (CRS token) and `agentRuns` (CREAO run routing). Never shown in the UI. (c) Compliance output is validated as `{ text }` only; the "lendersDeclined" list on `notices` is derived from offers, not from the agent.
- (convex-agent) `ANTHROPIC_API_KEY` is not in the environment; the overnight e2e ran on the deterministic stub. Eval 20/20 agreement is stub-vs-answer-key consistency, not an LLM result, until the key is set on the deployment.
- (convex-agent) CRS endpoint paths + persona→sandbox-consumer mapping unknown until the Postman collection email; TODOs in convex/crs.ts.
