# Docket

Docket is a one-person credit union. One loan officer runs a lending desk through agents, and a person signs every offer and notice. The claim: every denial reason is tested before it is sent.

## The problem

Most people who are turned down for a loan get a letter that says "Reason: internal standards." No numbers, no next step.

The law says the letter must say why. Regulation B requires the principal reasons, specific to your file. The Fair Credit Reporting Act (FCRA) requires the letter to name the bureau that supplied the data, and to say the bureau did not make the decision.

Nobody checks the reason was real. A reason is only lawful if the lender relied on it. Models pad declines with true but irrelevant facts such as "score meets minimum". Docket tests that.

## What Docket does

1. **Be the borrower.** Draw a persona card and type its four digits on the phone (`#/borrower`). Docket soft-pulls all three bureaus through the CRS Credit API sandbox. Name, address and SSN never reach a model.
2. **Five policies read one file in parallel.** Each policy in `policies/*.md` is the prompt its agent receives. Offers are ranked by total cost to borrow.
3. **A bad day stops in code.** Deceased, unscorable, failed-identity and fraud-score-80 files are stopped by `convex/rules.ts`. Override is refused.
4. **Every denial reason is tested.** Docket changes only the field behind a reason to a passing value and re-runs the lender. If the decision flips, the reason is real. If not, it is withheld.
5. **The letter is rewritten from reasons that survived, and a person signs.** The notice carries the FCRA statement and the right to dispute. The loan officer approves it. Dispute a tradeline and all five lenders re-run.

## Proof

The test set is the 20-persona answer key in `personas/map.json`. `eval:runEval` runs all 20 nightly and from the board.

Latest recorded run: 20/20 agreement with the key and 60/60 per-lender agreement, on the three-lender build. It has not yet been re-run on the five-lender build. This shows consistency with our own key. It does not prove fairness; twenty personas cannot.

## Two ways to run it

Inside a company:
- Your agents call a bearer-authenticated HTTP API (`/api/v1/*`) or an MCP server, and get one DecisionRecord per applicant with a verdict on every denial reason.
- Bring your own policies and answer key; a benchmark endpoint scores Docket against it.

On your own:
- You are the one-person desk: a phone, a board, five lenders. You sign every offer and notice.

## How it is built

| Step | Who decides | What it guarantees |
| --- | --- | --- |
| 1. Credit pull | Code | One soft pull, six CRS sandbox calls, about 3 s |
| 2. Hard stops | Code | A stopped file reaches no lender |
| 3. Five underwriters | Agents | Parallel, schema-checked JSON, 20 s timeout per lender |
| 4. Verify | Code | Each reason survives a one-field flip or is withheld |
| 5. Notice | Agent | Written from verified reasons; classification done in code |
| 6. Human | Person | Nothing funds or is sent without a signature |

A durable Convex workflow (`runDesk`) owns the order and audit trail, and live queries feed the console, board and phone. The CRS Credit API supplies bureau data. Claude `claude-haiku-5-5` underwrites and `claude-sonnet-5-5` writes the notice. CREAO hosts the six agents. Every reply, from CREAO or Claude, is validated against the same Zod schema before it touches an offer or a notice; a reply that fails, arrives as prose or misses 90 s is re-run on Claude and the failover is audited.

Simulated: the five lenders are fictional, no money moves, and every applicant is a CRS test persona. Scores are VantageScore 4.

## Sponsor tools, and what each one does here

- **CRS Credit API**: one call per applicant returns TransUnion, Equifax and Experian prequal, identity verification, FraudFinder and PitchPoint public records. The 20 test personas are its sandbox consumers, so the deceased, frozen and synthetic files are real sandbox pulls.
- **Convex**: the six steps run as one durable workflow with retries and timeouts; live queries drive the phone and the judge board; the scheduler runs the nightly eval; httpActions serve the API and the CREAO webhook.
- **Claude (Anthropic)**: claude-haiku-5-5 underwrites and re-runs the counterfactual tests; claude-sonnet-5-5 writes the adverse-action notice and powers the desk assistant.
- **CREAO**: six hosted agents, five underwriters and a compliance writer, with schema-gated failover to Claude.
- **Hyphenate**: an autonomous finance workflow where agents recommend and a person signs every offer and every notice.
- **Microsoft, built for the real world**: deterministic hard stops, a 20 s lender timeout, a PII allowlist, an audit row for every step, and a 20-persona eval against an answer key.

## Run it

```sh
npm install
CONVEX_AGENT_MODE=anonymous npx convex dev     # local backend, no account
npm run typecheck && npm test
npm run policies:sync                          # after editing policies/*.md
cd web && npm install && npm run dev           # set VITE_CONVEX_URL from web/.env.example
```

Open `#/borrower` on a phone and `#/board` on a second screen. Env vars (`npx convex env set NAME value`): `ANTHROPIC_API_KEY` (unset runs a labeled stub), `CRS_PROVIDER` (`mock` or `crs`), `CRS_USERNAME`, `CRS_PASSWORD`, `CRS_STRICT`, `LENDER_TIMEOUT_MS`, `GIT_SHA`, `AGENT_PROVIDER_UNDERWRITER`, `AGENT_PROVIDER_COMPLIANCE`, and the optional `CREAO_*` set.

## Integrate it

- HTTP API (`/api/v1/*`) returns one DecisionRecord per applicant: [schema](docs/schema/decision-record.schema.json).
- MCP server for your own agents: [`mcp/`](mcp/README.md).
- Start with [docs/integration.md](docs/integration.md).

## CREAO

App ids (not secret; API keys live only in the Convex env):
- Docket Underwriter: Pacific Ridge Credit Union (cu): 39632f67-c976-4496-991d-31bdbbbec47d
- Docket Underwriter: Northstar Lending (fintech): 58a80034-8506-43e9-9570-111b592ca11e
- Docket Underwriter: Meridian Bank Prime (prime): 316a0337-e75e-4391-911d-b33bf67f8a97
- Docket Underwriter: Cascade Regional Bank (regional): 5cdf5e19-8040-43ec-81f5-0ed34e643c6d
- Docket Underwriter: Harbor Second Chance Finance (subprime): dd2bfed5-49ea-476e-8fc8-b8ef24b3b585
- Docket Compliance: adverse-action notice: 11425cb9-95c8-49d9-b962-19ddba3cb70e

Public share links:
- Meridian Bank Prime: https://agent.creao.ai/share/e759b53f1b499eb7370979fba9f34b2f (decline, 26.9 s)
- Northstar Lending: https://agent.creao.ai/share/f3390731218147a804baa34cb3fb2bb9 (approve, 27.5 s)
- Harbor Second Chance Finance: https://agent.creao.ai/share/9a37ba50d28da0343a9d1bb83f25c31b (approve, 23.1 s)
- Cascade Regional Bank: https://agent.creao.ai/share/11e788b4ca963790c2f2d422e92156f0 (decline, 33.3 s)
- Pacific Ridge Credit Union: https://agent.creao.ai/share/56d4f68bf156887262f1577bda1b4d08 (approve, 26.5 s)
- Compliance notice: https://agent.creao.ai/share/05a0baa157ff22dea5662a58b7bbb837 (notice parsed, awaiting_human, 23.4 s)

## Links

- Live site: https://docket-sepia-ten.vercel.app
- Video: https://youtu.be/MmCWVIkHxjI
- Repo: https://github.com/alphagengar1/docket

## Team

Swaraj Adhikari, UCLA. Matthew Pun, UC Berkeley.

## License

MIT. See [LICENSE](LICENSE).
