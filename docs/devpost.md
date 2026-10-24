# Devpost submission text: Docket

## Project name
Docket

## Tagline (under 100 characters)
One loan officer runs a lending desk; every reason in the denial letter was tested.

## Inspiration
When a lender says no, the letter usually tells you almost nothing. Regulation B says the notice must give the principal reasons, and "internal standards" is not a reason. We wanted to see whether a small credit union could give a borrower an answer they can act on, with one loan officer and a team of agents doing the legwork.

## What it does
Docket is a one-person credit union. An applicant consents, states a purpose and income, and Docket pulls CRS sandbox data: three bureaus (TransUnion, Equifax, Experian) through soft-pull prequalification products, identity verification and a fraud screen. Three underwriter agents with written policies (a conservative credit union, a growth fintech, a prime bank) return offers or declines. Offers appear live on a phone and on a board. A compliance agent drafts the adverse-action notice. A human loan officer approves every offer and every notice.

Deceased, unscorable, identity-failed and high-fraud files hit a hard stop written in code. No lender sees the file, there are zero offers, and an Override attempt is refused and logged.

Three things we added:
- Reason verification. For each decline reason we change only that factor to a passing value and re-run the lender. If the decision does not change, the reason is withheld from the notice. We found the lender agents padded declines with filler reasons such as "score meets minimum".
- Approve, counteroffer or deny, classified in code, with the FCRA statement that the consumer reporting agency did not make the decision.
- Dispute and replay: dispute a tradeline and see how the offers and the notice change.

What is simulated: the lenders are ours, no money moves, and every applicant is a CRS test persona.

## How we built it
Convex is the whole backend. A durable Workflow component runs the desk: pull, guardrails, three underwriters in parallel, reason verification, compliance, human approval. httpActions receive webhooks, the scheduler runs a nightly eval, and live queries update the phone and the board. Underwriters run `claude-haiku-5-5` and compliance runs `claude-sonnet-5-5`, with structured JSON output validated by Zod. The web app is Vite and React with routes `#/borrower` for the phone and `#/board` for the second screen. Agent input is an allowlist projection, so name, address, ZIP and SSN never reach a model.

## Challenges
- Sandbox quirks: the "fico9" product returns VantageScore 4.0, so we label scores as VantageScore throughout.
- A freeze at one bureau should not stop a file that another bureau can score. We changed the rule and the policies.
- Jointly sufficient reasons do not flip a decision one at a time, so verification needed a second leave-one-out pass.
- Keeping the applicant's name out of the compliance agent while still producing a personal letter.

## Accomplishments
- 20 of 20 CRS personas agree with the answer key on the latest cloud eval; reasons verified 81%; p50 underwriter latency about 3 s.
- Hard stops, classification and the PII boundary are code with tests.
- A judge can hold the phone, draw a persona card and run the whole flow themselves.

## What we learned
Agents do the reading and the drafting, but the rules that must never fail belong in code. Testing the reasons found a problem we would not have seen by reading outputs. Twenty personas show consistency with our key, not fairness.

## What's next
- Paired tests: two personas identical except one proxy field must get the same decision.
- Connect real lender policy files or a lender marketplace API in place of our three agents (this needs the right state licenses).
- Show the applicant the notice and a dispute path in their own view.

## Built with
convex, convex-workflow, typescript, react, vite, zod, anthropic-claude, claude-haiku-5-5, claude-sonnet-5-5, crs-credit-api, transunion, equifax, experian, node

## Tracks to select on Devpost
- [ ] CRS: Best Overall CRS Hack
- [ ] CRS: Best Financial AI Agent
- [ ] CRS: Best Identity / Fraud Innovation
- [ ] Convex
- [ ] Hyphenate: The Hyphenated Enterprise
- [ ] Microsoft: Built for the Real World
- [ ] Anthropic
- [ ] Capital One Nessie: only if used (the repo has a Nessie fallback in the schema but the build does not use it; leave unchecked)
- [ ] CREAO: only if entered (CREAO is not judged unless selected)
- [ ] Most Creative
- [ ] Most Technically Advanced
- [ ] Best People-First Social Impact

## Submission requirements
- [ ] Project image
- [ ] GitHub repo link, and the repo made public (github.com/alphagengar1/docket is private until submission)
- [ ] 3-minute video demo
- [ ] Deadline: Sun Oct 25, 09:00 PDT. Edits lock at 10:30.
- [ ] Check-in at the venue (required to submit)
- [ ] Deploy URL pasted in README and Devpost: [DEPLOY URL]
