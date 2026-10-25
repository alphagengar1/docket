# Devpost submission text: Docket

## Project name
Docket

## Tagline (under 60 characters)
A one-person credit union with tested denial reasons

## Inspiration
When a lender says no, the letter usually tells you almost nothing. Regulation B says the notice must give the principal reasons, and "internal standards" is not a reason. We wanted to see whether one loan officer and a team of agents could give a borrower an answer they can act on, for the loan officers at small credit unions who currently have to send a "no" with no usable reason.

## What it does
An applicant gives consent, a loan purpose and stated income. Docket pulls CRS Credit API sandbox data: TransUnion prequal with VantageScore, Equifax and Experian prequal, identity verification, FraudFinder, and PitchPoint liens, judgments and evictions. Deterministic hard stops (deceased, unscorable, failed identity, high fraud) run first. If a file passes, five underwriter agents, each with a written policy in `policies/`, return an offer or a decline: Pacific Ridge Credit Union, Northstar Lending, Meridian Bank Prime, Cascade Regional Bank and Harbor Second Chance Finance. A compliance agent drafts the ECOA/FCRA adverse-action notice with the CRS source paragraph. A human approves every offer and every notice.

Three additions:
- Counterfactual reason verification: change one factor and re-run the lender, then a leave-one-out pass for reasons that are only sufficient together. Reasons that do not change the decision are withheld from the notice.
- Approve, counteroffer or deny is classified in code.
- Dispute and replay: dispute a tradeline and see which offers and notices change.

Docket is also an integration layer. A finance company can call it from its own agents over a bearer-authenticated HTTP API or an MCP server, plug in its own lender policies as markdown files, and get one standard DecisionRecord per applicant with a verification verdict on every denial reason. A benchmark endpoint scores Docket against the company's own answer key, so it can see where its internal tooling disagrees. A human still approves every offer.

Screens: an operator console with a decision summary, ranked decision queue, decision sheet, editor-style side rails and a desk assistant that summarizes the audit trail; a judge board at `#/board`; a borrower phone at `#/borrower`.

Simulated: the lenders are ours, no money moves, and every applicant is one of 20 CRS test personas.

## How we built it
Convex is the backend: a durable Workflow runs the desk (pull, guardrails, five underwriters in parallel, verification, compliance, human), live queries drive all three screens, httpActions take webhooks, and a cron runs the nightly eval. CREAO hosts six agents (five underwriters and compliance). Claude is the other provider: claude-haiku-5-5 for underwriters, claude-sonnet-5-5 for compliance, with Zod-validated output. Agent input is an allowlist projection, so name, address, ZIP and SSN never reach a model. The web app is Vite and React in the Instrument Tag theme.

## Challenges
- The sandbox "fico9" product returns VantageScore 4.0, so we label scores VantageScore.
- A freeze at one bureau should not stop a file another bureau can score, so the rule became a flag.
- Jointly sufficient reasons do not flip a decision one at a time, which needed the leave-one-out pass.
- Hosted CREAO runs take 23 to 33 s per lender, so we added a 20 s timeout setting and a replay of each persona.
- Keeping the applicant's name away from the compliance agent while still producing a personal letter.

## Accomplishments
- 20 of 20 personas agree with the answer key on the last cloud eval, which also scores each lender against its expected outcome. [check: re-run with five lenders for final figures]
- Agents padded some declines with filler reasons such as "score meets minimum". Verification caught and withheld them.
- Hard stops, classification and the PII boundary are code with tests.
- A judge can draw a persona card, type its code on the phone and run the flow.

## What we learned
Agents read the file and draft the letter; the rules that must never fail belong in code. Testing the reasons found a problem we would not have seen by reading outputs. Twenty personas show consistency with our own key, not fairness.

## What's next
- Paired tests: two personas identical except one proxy field must get the same decision.
- Real lender policy files in place of our five agents.
- Show the applicant the notice and a dispute path in their own view.

## Built with
convex, convex-workflow, typescript, react, vite, zod, anthropic-claude, claude-haiku-5-5, claude-sonnet-5-5, creao, crs-credit-api, transunion, equifax, experian, vercel, node

## Links
- Live: https://docket-sepia-ten.vercel.app
- Repo: https://github.com/alphagengar1/docket (private until submission)

## Submission checklist
Deadline: Sun Oct 25, 09:00 PDT. Edits lock at 10:30.

Tracks to opt into:
- [ ] CRS Credit API (overall, plus any financial-agent and identity/fraud sub-tracks Devpost lists)
- [ ] Convex: Best Use
- [ ] Hyphenate: Autonomous Systems for Finance
- [ ] Microsoft: Built for the Real World
- [ ] Anthropic
- [ ] CREAO (pick one sub-track: One-Person Company or AI-First Disruptor; not judged unless selected)
- [ ] Cal Hacks overall
- [ ] Most Creative
- [ ] Most Technically Advanced
- [ ] People-First (Social Impact)
- Not entering: Nessie (unused), Mana, Fetch.ai, Visa, Apify, Coinbase x402.

Items:
- [x] Deploy URL in README
- [ ] Flip repo public
- [ ] Upload 3-minute demo video
- [ ] Create six public CREAO run links and paste into README
- [ ] Project image: design/devpost/thumbnail.png (1280x720); cover.png is 1920x1080
- [ ] Check in at the venue


Video: https://youtu.be/MmCWVIkHxjI
