# Docket

One loan officer leading a whole lending desk of agents. Docket is a one-person credit union with six layers and one workflow: code decides what agents may see, agents decide inside written policies, and a person signs. Every reason in a denial letter is tested before it is sent.

## The problem

Someone close to us applied for a loan this year with a good credit score and a steady job, and got back one word: rejected. No reason, no field to fix, nobody to ask. Docket exists so that letter says what decided it.


Personal loans owed in the U.S. are a record $281 billion, and about 1 in 6 people who apply for credit are turned down. Every one of those turn-downs needs a letter, and most letters say "Reason: internal standards." No numbers, no next step.

The law says the letter must say why. Regulation B requires the principal reasons, specific to the file, and rules out "internal standards". The Fair Credit Reporting Act (FCRA) requires the letter to name the bureau that supplied the data, say the bureau did not make the decision, and offer a free report and the right to dispute.

Nobody checks the reasons. A reason is only lawful if the lender relied on it, and asked to explain a no, an AI pads the letter with true but irrelevant facts such as "score meets minimum". Docket tests every reason.

## What Docket does

1. **Be the borrower.** Draw a persona card and type its four digits on the phone (`#/borrower`). One soft pull from the CRS Credit API sandbox returns all three bureaus plus identity, fraud and public records. Name, address, ZIP and SSN never reach a model.
2. **Hard stops end risky files in code.** Deceased, every bureau file frozen, identity mismatch, and fraud score 80 or higher are stopped by `convex/rules.ts` before any model sees the file. Override is refused and logged.
3. **Five lenders read one file in parallel.** Each policy in `policies/*.md` is the prompt its agent receives. The agent decides yes, no or counteroffer and names the field behind each reason; prices come from each policy's grid by score band. The borrower picks the cheapest yes.
4. **Every denial reason is tested.** Docket changes only the field behind a reason to a passing value and re-runs the lender. If the decision flips, the reason is kept. If not, it is withheld.
5. **The notice uses only tested reasons.** Offer, counteroffer or decline is classified in code. The notice carries the tested reasons with numbers, the FCRA statement, and the free report and dispute rights. Dispute a tradeline and all five lenders re-run.
6. **A person signs.** Nothing funds until the loan officer signs, and every click is logged with who and when.

## Proof

The test set is the 20-persona answer key in `personas/map.json`. `eval:runEval` runs all 20 applicants through the real desk, in parallel, every night and from the board.

Latest cloud eval (five CREAO lenders): 20/20 outcomes right, 96/100 lender calls right (the 4 misses are answer-key loan amounts), 85/85 lender answers valid, 82% of reasons hold up and the rest never reach a letter, and zero offers to fraud or deceased files. One live application took 62 s from card code to the officer's queue, with hard stops in about 5 s. Model cost is about 3 cents per application, an estimate from prompt sizes and list prices.

This shows consistency with our own answer key. It does not prove fairness; twenty personas cannot. Fairness is next: two applicants that differ in one field must get the same answer.

## Two ways to run it

Inside a company:
- Your agents call a bearer-authenticated HTTP API (`/api/v1/*`) or an MCP server, and get one DecisionRecord per applicant with a verdict on every denial reason.
- Bring your own policies and answer key; a benchmark endpoint scores Docket against it. A new lender is a new policy file.

On your own:
- You are the one-person desk: a phone, a board, five lenders. You sign every offer and notice.

## How it is built

Six layers, one workflow: code decides what agents may touch, agents decide inside policies, a person makes the final call.

| Layer | Who decides | What it guarantees |
| --- | --- | --- |
| 1. Credit pull | Code | One soft pull, about 3 s; every lender sees the same file with no identity in it |
| 2. Hard stops | Code | Risky files stop before any AI sees them |
| 3. Underwriters x5 | Agents | Five lenders decide in parallel on written policies; prices come from policy, not agents |
| 4. Verify | Code | Each denial reason is re-tested by flipping only that field; reasons that do not change the decision are withheld |
| 5. Notice | Agent | Written from tested reasons only; offer, counteroffer or decline is classified in code |
| 6. Human + platform | Person | Nothing funds until the loan officer signs; override is refused and logged |

A durable Convex workflow (`runDesk`) owns the order and audit trail; every step is an audit row, and live queries feed the console (the loan officer's desk), the board (the judges' live screen) and the phone (the borrower). The CRS Credit API supplies bureau data. CREAO hosts the five underwriter agents and the notice agent.

Simulated: the five lenders are fictional, no money moves, and every applicant is a CRS test persona. Scores are VantageScore 4.

## Sponsor tools, and what each one does here

- **CRS Credit API**: one soft pull per applicant returns TransUnion, Equifax and Experian data, identity verification, a fraud score and public records. The 20 test personas are its sandbox consumers, so the deceased, frozen and synthetic files are real sandbox pulls.
- **Convex**: the six layers run as one durable workflow with retries; live queries drive the console, the board and the phone; the scheduler runs the nightly 20-applicant eval; httpActions serve the API, the health check and agent webhooks.
- **Claude (Anthropic)**: powers the desk assistant and the counterfactual re-runs behind reason verification.
- **CREAO**: six hosted agents, five underwriters and a compliance writer.
- **Hyphenate**: an autonomous finance workflow where agents do the work and a person signs every offer and every notice.
- **Microsoft, built for the real world**: deterministic hard stops, a PII allowlist, an audit row for every step, and a 20-applicant eval against an answer key.

## Run it

```sh
npm install
CONVEX_AGENT_MODE=anonymous npx convex dev     # local backend, no account
npm run typecheck && npm test
npm run policies:sync                          # after editing policies/*.md
cd web && npm install && npm run dev           # set VITE_CONVEX_URL from web/.env.example
```

Open `#/borrower` on a phone and `#/board` on a second screen. Env vars (`npx convex env set NAME value`): `ANTHROPIC_API_KEY` (unset runs a labeled stub), `CRS_PROVIDER` (`mock` or `crs`), `CRS_USERNAME`, `CRS_PASSWORD`, `CRS_STRICT`, `GIT_SHA`, `AGENT_PROVIDER_UNDERWRITER`, `AGENT_PROVIDER_COMPLIANCE`, and the optional `CREAO_*` set.

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
