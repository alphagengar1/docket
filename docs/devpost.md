# Devpost submission text: Docket

## Project name
Docket

## Tagline (under 60 characters)
A one-person credit union with tested denial reasons

## Inspiration
Most people who are turned down for a loan get a letter that says "Reason: internal standards." Regulation B and the FCRA say the letter must give the principal reasons and name the bureau. Nobody checks whether the reason was real. We wanted one loan officer, with agents, to send a "no" a borrower can act on, for the loan officers at small credit unions who have no usable reason to give.

## What it does
You are the borrower: draw a persona card, type its four digits, and Docket pulls your file from TransUnion, Equifax and Experian through the CRS Credit API sandbox. Five written lender policies read the same file in parallel. A bad day, such as a deceased file, stops in code before any model sees it. Every denial reason is then tested by flipping one field: if the decision flips, the reason stays; if not, it is withheld. The letter is rewritten from the reasons that survived, and a person signs.

Docket is also an integration layer. Inside a company, your agents call a bearer-authenticated HTTP API or an MCP server with your own policies and answer key, and get one DecisionRecord per applicant. On your own, you are the one-person desk.

Simulated: the lenders are ours, no money moves, and every applicant is one of 20 CRS test personas.

## How we built it
Six steps: credit pull, hard stops, five underwriters, verify, notice, human. A durable Convex workflow runs them, and live queries drive the phone, the board and the console. Claude haiku underwrites and sonnet writes the notice. CREAO hosts the six agents; every reply is checked against a Zod schema and re-run on Claude if it fails. Agent input is an allowlist, so name, address, ZIP and SSN never reach a model.

## Challenges
- The sandbox's TransUnion product returns VantageScore 4.0, so we label scores VantageScore.
- A freeze at one bureau should not stop a file another bureau can score, so that rule became a flag.
- Jointly sufficient reasons do not flip a decision one at a time, which needed a leave-one-out pass.
- Hosted CREAO runs take 23 to 33 s per lender, so we added a 20 s timeout setting and replay.
- Writing a personal letter without giving the compliance agent the applicant's name.

## Accomplishments
- 20 of 20 personas agree with the answer key on the last cloud eval. [check: re-run with five lenders for final figures]
- Agents padded some declines with filler such as "score meets minimum". Verification caught and withheld them.
- Hard stops, classification and the PII boundary are code with tests.

## What we learned
Agents read the file and draft the letter; rules that must never fail belong in code. Testing the reasons found a problem we would not have seen by reading outputs. Twenty personas show consistency with our own key, not fairness.

## What's next
- Paired tests: two personas identical except one proxy field must get the same decision.
- A real lender policy file in place of ours.
- Show the applicant the notice and a dispute path.

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
- [x] Upload 3-minute demo video
- [ ] Create six public CREAO run links and paste into README
- [ ] Project image: design/devpost/thumbnail.png (1280x720); cover.png is 1920x1080
- [ ] Check in at the venue


Video: https://youtu.be/MmCWVIkHxjI
