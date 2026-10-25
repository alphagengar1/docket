# Devpost submission text: Docket

## Project name
Docket

## Tagline (under 60 characters)
A one-person credit union with tested denial reasons

## Inspiration
Someone close to us applied for a loan this year. They work hard, they had built a good credit score, and the answer came back as one word: rejected. No reason they could act on, no field they could fix, nobody to ask. They still do not know why.

That is the normal experience. Personal loans owed in the U.S. are a record $281 billion, about 1 in 6 applicants are turned down, and most of the letters say "Reason: internal standards." Regulation B and the FCRA require the principal reasons, the bureau's name, and the statement that the bureau did not decide. In practice nobody checks whether the stated reasons were the real ones, and an AI asked to explain a no pads the letter with true but irrelevant facts.

We built Docket for that person: a lending desk where every denial reason is tested before the letter goes out, so the no says what actually decided it and what would change it.

## What it does
You are the borrower: draw a persona card, type its four digits, and one soft pull from the CRS Credit API sandbox returns TransUnion, Equifax and Experian data plus identity, fraud and public records. Docket is a six-layer workflow: code decides what agents may see, agents decide inside written policies, a person signs.

1. Credit pull: every lender sees the same file, with no name, address, ZIP or SSN.
2. Hard stops: deceased, all bureaus frozen, identity mismatch or fraud score 80+ end the file in code. Override is refused and logged.
3. Five underwriters: five written lender policies decide in parallel. Prices come from each policy's grid; the borrower picks the cheapest yes.
4. Verify: every denial reason is tested by changing only that field and re-running the lender. If the decision flips, the reason is kept; if not, it is withheld.
5. Notice: written only from tested reasons, with the FCRA statement and dispute rights.
6. Human: nothing funds until the loan officer signs.

Docket also works inside a company: your agents call a bearer-authenticated HTTP API or an MCP server with your own policies and answer key, and get one DecisionRecord per applicant.

Simulated: the lenders are ours, no money moves, and every applicant is one of 20 CRS test personas.

## How we built it
A durable Convex workflow runs the six layers, every step is an audit row, and live queries drive the phone, the board and the console. CREAO hosts the five underwriter agents and the compliance agent.If a lender is stuck, the others carry on. The scheduler runs the 20-applicant eval every night.

## Challenges
- The sandbox's TransUnion product returns VantageScore 4, so we label scores VantageScore.
- A freeze at one bureau should not stop a file another bureau can score, so that became a flag; only all-frozen stops.
- Jointly sufficient reasons do not flip a decision one at a time, which needed a leave-one-out pass.
- Writing a personal letter without giving the notice agent the applicant's name.

## Accomplishments
- 20/20 outcomes right, 96/100 lender calls right (the 4 misses are answer-key amounts), 85/85 valid answers, and zero offers to fraud or deceased files.
- 82% of reasons hold up; the rest never reach a letter. Our own agents padded declines with "score meets minimum", and verification withheld it.
- 62 seconds from card code to the officer, hard stops in about 5, at roughly 3 cents of model cost per application.
- Hard stops, classification and the PII boundary are code with tests.

## What we learned
Agents read the file and draft the letter; rules that must never fail belong in code. Testing the reasons found a problem we would not have seen by reading outputs. Twenty personas show consistency with our own key, not fairness.

## What's next
- Paired tests for fairness: two applicants identical except one field must get the same answer.
- A real credit union's policy file in place of ours.
- A lender network: outside lenders plug in a policy file.

## Built with
convex, convex-workflow, typescript, react, vite, zod, anthropic-claude, creao, crs-credit-api, transunion, equifax, experian, vercel, node

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
