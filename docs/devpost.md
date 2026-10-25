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
Docket is a one-person credit union: one loan officer leading a whole lending desk of agents, where every reason in a denial letter has been tested.

You are the borrower. Draw a persona card and type its four digits on the phone. Docket makes one soft pull through the CRS Credit API sandbox: TransUnion, Equifax and Experian, plus identity, fraud and public records. Four rules in code run first. A deceased file, a freeze at every bureau, a failed identity check or a fraud score of 80 or higher ends the application before any model sees it, and an override is refused and logged.

Five lender agents then apply five written policies to the same file in parallel. The AI decides yes, no or counteroffer and must name the field behind each reason. It can't set prices: the APR comes from each policy's grid, and the borrower picks the cheapest yes.

Every denial reason is tested by changing only that field and re-running the lender. If the decision flips, the reason stays; if not, it is withheld. Code classifies each answer as offer, counteroffer or decline. The notice is written only from tested reasons, states that CRS did not make the decision, and gives the free report and the right to dispute. Dispute a tradeline and all five lenders re-run on the corrected file. Nothing funds until a person signs.

Docket also runs inside a company: your agents call a bearer-authenticated HTTP API or an MCP server with your own policies and answer key, and get one DecisionRecord per applicant.

Simulated: the five lenders are ours, no money moves, and every applicant is one of 20 CRS sandbox personas. Zero real people.

## How we built it
Six layers, one workflow: data, hard stops, five underwriters, verify, notice, human. Code decides what agents may see, agents decide inside written policies, and a person signs.

- Convex runs all six layers as one durable workflow that retries each step; one lender failing doesn't hold up the rest. Live queries drive the loan officer's console, the judges' board and the borrower's phone from the same tables. The scheduler runs the 20-applicant eval every night, plus replays if the wifi fails. HTTP endpoints serve the health check, the agent webhooks and the integration API.
- The five underwriters and the notice writer run as CREAO hosted agents, built on Claude through the Anthropic SDK. Claude also powers the desk assistant and the counterfactual re-runs behind verification.
- Each policy is the literal prompt its agent receives, with a code mirror for testing.
- Agent input is an allowlist. Name, address, ZIP, SSN, date of birth, phone, email, raw bureau data and criminal records never reach a model.

## Challenges we ran into
- The sandbox's TransUnion product returns VantageScore 4, so we call it the TransUnion score.
- A freeze at one bureau shouldn't stop a file another bureau can score, so one freeze is a flag and only a freeze at every bureau stops the file.
- Reasons that only matter together don't flip a decision one at a time, so we test pairs too.
- Writing a personal letter without giving the notice agent the applicant's name: the agent writes a placeholder and code inserts the name.

## Accomplishments that we're proud of
- 20 of 20 applicants get the right outcome, 96 of 100 lender calls match our answer key, and 82% of reasons hold up. The rest never reach a letter, and the 4 misses are answer-key loan amounts.
- No invalid answers, and zero offers to fraud or deceased files.
- Verification caught our own agents padding declines with "score meets minimum" and "fraud score below threshold". Both were true, neither was a reason, and both were withheld.
- 62 seconds from card code to the officer's queue, against 1 to 7 business days at a bank or credit union. A fraud or deceased file stops in about 5 seconds.
- The same file run three times gets the same decision and APR every time.
- About 3¢ in model calls per application (estimate).
- Hard stops and the PII boundary are code with unit tests.

## What we learned
- The riskiest decisions are the ones the AI never gets to make. Rules that must never fail belong in code.
- Testing every reason caught padding we would not have seen by reading outputs.
- Twenty personas show consistency with our own answer key, not proof of fairness.

## What's next for Docket
- Paired tests for fairness: two applicants that differ in one field must get the same answer.
- A real credit union's policy file in place of ours.
- A lender network: outside lenders plug in their own policy file, and we earn a referral fee on funded loans.

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
