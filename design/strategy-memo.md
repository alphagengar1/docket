# Cal Hacks 13.0: Prize Strategy Memo

*Event: Oct 23–25, Palace of Fine Arts, SF. Hacking runs Fri 18:00 to **Sun 09:00 PDT (hard Devpost deadline)**; edits lock 10:30. Judging Sun 10:30–12:30 at your table: 3-min pitch, 2-min Q&A, live demo. Be in the venue by 08:00. Teams 1–4. About 2,000 hackers; expect 600–800 projects (estimate). Every probability and dollar value is an estimate unless marked "confirmed".*

*Assumptions (you didn't answer the calibration questions): 2–3 freshmen, no smart glasses, Cue cannot be reused as code (Cal Hacks rule: all work during the hackathon), modest API credits.*

---


> **CREAO eligibility open question (Sat 00:50):** Swaraj is CREAO's workshop speaker this weekend, demoing Cue, which won their LA Hacks track. Ask Charis tonight whether a speaker may enter the track. Build the Underwriter/Compliance agents behind one `runAgent()` interface so they can be CREAO runs or direct Claude calls; decide at the 12:30 lunch check. Without CREAO: EV drops ~$400, demo latency risk drops, every other track unchanged.

## 1. Bottom line

**Build a "one-person credit union": a compliant lending desk run by one human and an org chart of agents.** An applicant chats with an Intake agent (consent screen, self-reported income). Your Node backend pulls live CRS sandbox data on a test persona: soft-pull prequal score, identity verification, fraud signals. A **CREAO org chart does the core work**: three Underwriter agents with different credit policies (conservative credit union, growth fintech, prime bank) each turn the bundle into an offer or a denial, and a Compliance agent writes the legally required adverse-action notice in plain English. Handoffs run over CREAO threadIds and webhooks into Convex, and judges watch offers stream onto a live exchange board. The judge picks the applicant from a printed deck of CRS persona cards.

**Why this one:**
- **CRS is the least-contested cash at the event.** No public winners anywhere, and they doubled the prize on Friday night, which is what sponsors do when under-subscribed. Their own Slack intro teased "an agentic credit exchange where AI agents represent borrowers and lenders", so you are building their roadmap.
- **CREAO is where you have an edge.** You know the API, staff know you, and "One-Person Company" is on the nose: one human runs a lending desk through an org chart of agents with scheduled runs. Ask CREAO staff at your workshop slot which sub-track has fewer entries and select that one.
- **Fintech is where the money is this year.** CRS $2k/$1k, Hyphenate finance $8k/$5k/$3k (on Devpost, not in Slack; its rules want an autonomous system filling finance-team "seats" with a human approver and planted data errors, which is this product almost verbatim), Microsoft lists finance first. Microsoft's rubric (evals, guardrails, production path, responsible design) is free once you build the eval harness across CRS's 20 personas.
- **Only APIs you know.** Claude, CREAO, Convex, plus one REST API with a Postman collection. The red-team put the probability of a working demo at about 75%, versus 40% for the version with Fetch.ai in scope.

**Expected value:** about $2,200 nominal and $1,600 risk-adjusted (estimate) now that Hyphenate fits and Convex is confirmed cash, with roughly a 60% chance of at least one prize. Realistic best case is CRS 1st + a CREAO sub-prize + a Hyphenate place, $7,000 to $12,000 plus CREAO Launchpad.

**What was dropped and why:** Fetch.ai (unknown stack, 3 to 5 min video obligation, "where are the real lenders" attack), Coinbase x402 (3 to 5 hours of SDK churn, testnet eligibility unanswered), Cartesia voice, Mana (only if everything is green at Sat 21:00). Fetch's "fun challenges" on asi1.ai are raffle-style and cost 10 minutes; do those.

**Fallback:** if CRS sandbox credentials are not in hand by **Sat 11:00** and the booth can't issue them, swap the data spine to Capital One Nessie (mock bank accounts and transactions, cashflow underwriting) and enter the Nessie track instead of CRS. Everything else survives unchanged. Do not pivot to a new product; that costs 16 hours you don't have.

---

## 2. Track scorecard

Feas. = buildable for your team (1–10). Comp. = how crowded (1 empty, 10 packed), with estimated real entrants. Uniq. = room to stand out. Cash-equivalents value hardware at ~70% retail and interviews at $0.

| Track | Prize (cash-equiv.) | Feas. | Comp. (est. real entrants) | Uniq. | Verdict |
|---|---|---|---|---|---|
| **CRS Credit API** (confirmed Slack: doubled) | $2,000 / $1,000 + 2 FDE interviews | 7 | 2 (5–15) | High | **TARGET (anchor)** |
| Fetch.ai ASI:One | $1,500 / $1,000 / $500 + 2×$250 | 5 | 7 (40–80) | Med-high | **DROPPED**: 4–6h of unfamiliar plumbing + mandatory video for ~$150 EV. Do the asi1.ai raffle challenges only |
| **CREAO** One-Person Company / AI-First Disruptor | $1,500 / $2,500 + Launchpad | 9 | One-Person 4 (10–25), Disruptor 7 (30–70) | High | **TARGET (spine)**; pick the thinner sub-track after asking staff |
| **Convex Best Use** | $5,000 cash (Hive, current); Devpost shows stale ~$1,300 gear | 8 | 6 (30–60) | Med | **TARGET** |
| **Capital One Nessie** | $300 gift card per member | 8 | 4 | Med | **FALLBACK data spine** if CRS creds fail; cheap add-on otherwise |
| **Hyphenate finance track** (Devpost only) | $8,000 / $5,000 / $3,000 + interviews | 8 (no API; framing + eval set) | 6 (40–80; specific finance-seat requirement filters most agent projects) | Med-high | **TARGET**: frame as underwriter + compliance seats at a credit union, human approver; see addendum |
| Microsoft "Built for the Real World" | Surface per member (~$700 each) + Devpost lists $3,800 | 9 (overlay) | 8 (packed, stack-agnostic) | Low | **ADD-ON**: evals, guardrails, audit log, deploy URL |
| Coinbase x402 | up to $4,000 across 2 tracks | 4 | 4 (10–25) | Med | AVOID: 3–5h, SDK churn, testnet eligibility unanswered |
| Mana | $5,000, open to every project | 7 | 7 (everyone can enter) | Low | Only if all green at Sat 21:00; a landing page is not "meaningful use" |
| Cal Hacks general (1st $3,600 + MacBook each, etc.) | large | — | 10 (all projects) | — | Enter; vertical fintech + live multi-agent demo is the archetype that places |
| Cartesia (Meta glasses ~$300 each) | ~$900 team | 5 | 5 | Med | AVOID (voice plumbing 5–8h) |
| Visa Reimagine Shopping | $5,000, 1 winner (confirmed) | 7 | 9 (80–150; no API depth lever this year) | Low | AVOID (most crowded archetype at the event) |
| Bright Data | $500 GC + $1,500 credits | 8 | 6 | Low | AVOID for this product |
| Apify | $2,000 / $1,000 / $800 / $400 / $400 + Best Actor $400 | 7 | 5 | Low | AVOID for this product (scraping is not core here) |
| Factory Droid SDK | $2,000 + credits | 5 | 3 | Med | AVOID (no free tier confirmed; remote machines not in SDK; slow live demos) |
| Atlassian Forge | AirPods Max each (~$380) | 6 | 3 | Med | AVOID unless pivoting to plan C (Jira→PR agent) |
| Figma (5 × $1,000 on Devpost) | $5,000 pool | 3 | 6 | Low | AVOID: Edu verification takes 2–3 business days; 6–7h of process slides |
| Elastic Agent Builder | $1,200 + Quest 3S / $1,436 + Bose | 5 | 3 (29 opt-ins last year) | Med | AVOID (serverless setup + new tool; thin field though, reconsider if a member has Elastic experience) |
| Bitdeer | $500 credits + mice | 9 | 4 | n/a | Swap one LLM call to Model Studio only if free credits arrive instantly |
| SpaceXSI | $400, must use Cursor | 10 | 7 | n/a | Tick the box if anyone codes in Cursor |
| ASUS / Apify merch / Greptile / Supercell | swag | 10 | — | n/a | Surveys only |

---

## 3. Recommended project: the one-person credit union

**Working name:** one or two syllables, not "Credit-anything". Suggestions: *Desk*, *Underwrite*, *Ledgr*.

**Pitch:** "A loan officer gets one lender's yes or no with no reasons. We let one person run a whole lending desk: three underwriting policies compete on your verified credit data, the legally required adverse-action notice writes itself, and you pick the applicant."

Do **not** pitch it as a marketplace. All the lender agents are yours, and "where are the real lenders?" is the question that kills the marketplace framing. "Three underwriting policies inside one desk" is honest and still shows negotiation between agents.

### Tracks and how each hard requirement is met

**CRS (Best Overall $2k / 2nd $1k / Best Financial AI Agent / Most Unexpected Use via the fraud screen)**
- Live sandbox calls at the table: soft-pull prequal (FICO 9 + VantageScore), TruValidate IDV, FraudFinder on the chosen persona. Chain all three; one pull will not win.
- Judge picks from a printed deck of persona cards: prime (three competing offers), subprime (one offer, clear reasons), fraud or deceased (hard stop, zero offers, explains why). Judge-chosen input kills the cherry-picking suspicion.
- Frame as consumer-consented, applicant-initiated. Say "FCRA" once, show the adverse-action notice and the audit log.
- Request credentials now at calhacks.crscreditapi.com; the Postman collection arrives in a separate email. **Log in once and cache the token: repeated failed logins disable the account.** CRS has no income or bank data, so income is self-reported at intake.

**CREAO (One-Person Company $1,500, or AI-First Disruptor $2,500)**
- Org chart on agent.creao.ai: Intake, three Underwriters (conservative / growth / prime policies), Compliance (adverse-action notice). Each agent is a saved role; handoffs via threadId; results via webhook into a Convex httpAction. One scheduled run (nightly eval over the 20 personas) is the One-Person Company evidence.
- Called via `POST agent.creao.ai/api/v1/runs` with `webhookUrl`. Runs take minutes, so fire the run the moment the judge picks a card and pitch the architecture while offers stream in. Keep one cached run and its share link as a backup.
- README: agent IDs + run share links. **Select the CREAO track on Devpost or you are not judged.** Remove-the-agent test passes: without the Underwriters there are no offers.
- Staff know Cue. This is visibly more: a multi-agent org chart with scheduled evals and compliance output, where Cue was iMessage plumbing.

**Convex**
- System of record: applicants, bundles, offers, negotiation turns, audit events, eval results. Webhooks land in `httpAction`s. The exchange board uses live queries so offers appear on the projector the moment they exist. Use a component (Agent or Workflow) and deploy to a public URL so it reads as depth, not "Convex as Postgres".
- Ask the booth whether the prize is $5,000 cash (Slack) or the Devpost gear (~$1,300).

**Microsoft "Built for the Real World" (free overlay, Sat afternoon)**
- Eval harness runs all 20 CRS personas: decision agreement with a rule-based baseline, zero offers to fraud/deceased/frozen personas, every denial carries at least two reasons. Pass rates in the README and on a panel in the UI.
- Guardrails: consent gate, persona allowlist, human-in-the-loop "accept offer" button, structured logs, one-paragraph transparency note, deploy URL.

**Hyphenate finance track ($8k/$5k/$3k)**: fits. Frame the submission as "seats on a credit union's finance team" with the human loan officer as approver, open the video with the deceased-persona catch, and ship the 20-persona test set with an answer key as proof of work. Details in the addendum. Keep a "custom applicant" input in case their judge hands you a scenario.

**Cal Hacks general**: vertical fintech + live multi-agent demo + judge-controlled input is the archetype that places. Enter Most Creative and Most Technically Advanced.

### Architecture

```
Intake chat (Claude) --consent + income--> Node/Express --> CRS sandbox (prequal, IDV, fraud)
                                                |
                                                v
                                   Convex (applicants, bundles, offers, turns, audit, evals)
                                        ^                     |
                 webhook (httpAction) ---+                     v
   CREAO org chart: Intake -> Underwriter x3 -> Compliance   React exchange board (live queries, projector)
```

Design rules: personas only, no real PII; consent gate before any pull; every denial carries reasons; nothing contacts a real lender; new repo created after Fri 18:00 with no Cue code.

### Demo moment (3 minutes)
1. Judge draws a persona card from the deck.
2. Enter the applicant on the laptop; the exchange board on the second screen shows the application appear.
3. Within seconds: "Identity verified, soft pull done, fraud score" with one beat on the raw CRS JSON.
4. Three "Underwriter reviewing" cards. Pitch the org chart for 60 to 90 seconds while CREAO runs; offers stream in as webhooks land.
5. Applicant agent explains why one offer beats the other two. For the fraud persona: zero offers, and the adverse-action notice.
6. Close on the eval panel: pass rates over 20 personas, and the audit log. One sentence on FCRA and consent.

---

## 4. Roles and hour-by-hour plan (Saturday)

**R1: backend, CRS, Convex.** **R2 (Swaraj): CREAO agents, prompts; offline during the CREAO workshop talk.** **R3: React board, intake chat, demo, Devpost.** With two people, R3's work splits between R1 and R2 and the eval harness becomes a stretch goal.

Agree the JSON contracts before sleeping: ApplicantBundle, Offer, Decision, AuditEvent.

| Time (Sat) | R1 | R2 | R3 | Risk |
|---|---|---|---|---|
| 00:30-01:15 | Request CRS creds, create Convex project, new repo | CREAO starter pack, redeem credits | Define JSON contracts; skim the Hyphenate doc (10 min) | |
| 01:15-07:30 | **Sleep. Pitch quality at 11 AM depends on it.** | | | |
| 07:30-08:30 | Convex schema + mutations deployed | Underwriter v0 on a hardcoded bundle, structured JSON out | React scaffold with Convex provider | |
| 08:30-10:30 | **CRS live**: prequal + IDV + fraud on 3 personas, normalize to bundle, write to Convex. Booth at 09:00 if creds missing | CREAO run via API with webhookUrl, ngrok, Convex httpAction | Exchange board subscribed to offers | **Integration risk 1** |
| 10:30-12:30 | Thin slice end-to-end: Apply, CRS, Convex, CREAO, webhook, board. One persona, one lender | same | same | **The gate. 11:00 fallback check** |
| 12:30-13:00 | Lunch. Ask Convex booth $5k vs gear; ask CREAO staff which sub-track is thinner | | | |
| 13:00-15:00 | Guardrails: fraud/deceased/frozen hard stop; audit log | Org chart: 3 Underwriters + Compliance, threadId handoffs | Intake chat (Claude) with consent + income | |
| 15:00-16:00 | continue | **CREAO workshop talk (adjust to real slot)** | continue | R2 offline |
| 16:00-18:00 | Eval harness over 20 personas (slow; start early) | Scheduled CREAO run (One-Person Company evidence) | Eval panel; deploy UI to Vercel | CRS rate limits x CREAO latency |
| 18:00-19:00 | Dinner. **Feature-freeze decision.** | | | |
| 19:00-21:00 | Demo hardening: pre-warm runs, cached fallback run + share link | Prompt polish; adverse-action letter quality | Print persona deck; pitch script v1 | |
| 21:00-23:00 | Bugs | Bugs | Devpost + README (agent IDs, run links, persona IDs, diagram, transparency note, what is real vs simulated, test set + answer key); 2-min video that opens with the deceased-persona catch. Mana only if all green | |
| 23:00-00:00 | Three timed rehearsals with a stranger as judge | | | |
| Sun 07:00 | Up. 08:00 at venue. **08:30 submit**, verify every track selection | | | |

**Fallback triggers**
- **Sat 11:00:** no CRS creds and booth can't issue them: swap data spine to Capital One Nessie, enter Nessie instead of CRS.
- **Sat 19:00:** end-to-end slice not working: freeze; one Underwriter, cached CREAO run with share link, night spent on reliability and Devpost.
- **Sat 20:00:** CREAO API down or runs over 4 min: underwrite via Claude API directly, keep CREAO for the Compliance letter only so the core-work rule still holds for one agent; drop the One-Person Company claim.

## 5. Tonight, regardless (30 minutes)
- Request CRS sandbox creds for two team emails.
- Claim CREAO credits via their Cal Hacks link (free plan is not enough). Create the Convex project; paste their hackathon setup prompt into Claude Code.
- Redeem CARTESIACALHACKS anyway (free to hold).
- asi1.ai fun challenges (Meta glasses, Beats, Kindles raffles; four more announcement rounds). ASUS survey.
- Ask in Slack: #spons-convex "$5,000 cash or the Devpost gear?"; #spons-crs "ETA on sandbox emails?".

## 6. DQ checklist (Sunday 08:30)
- Tracks selected on Devpost: CRS, CREAO (one sub-track), Convex, Hyphenate, Microsoft, Anthropic, Nessie if used, Most Creative, Most Technically Advanced. CREAO agent IDs + run share links in README.
- CRS called live at the table; personas named in README.
- New repo, no Cue code, all commits after Fri 18:00.
- Public deploy URL (Microsoft), image + repo on Devpost, every member registered on Devpost, 3-min pitch rehearsed with a timer.

---
## 7. Addendum: Devpost + Hive prize list (the Hive live site, hive.hackberkeley.org, is the current source; live.calhacks.io is last year's)

**Hyphenate "The Hyphenated Enterprise: Autonomous Systems for Finance" — $8,000 / $5,000 / $3,000 + expedited interviews for top 5. This fits the product. Enter it.**
- The ask: pick a company and one corner of its finance team (a few related "seats"), build the autonomous system you'd hire for those seats **and** the company it operates in: the software it uses, the people it answers to, the mistakes hidden in its data. No API or Hyphenate product required.
- Your framing: *Company: a small credit union. Seats: loan underwriter and compliance analyst. The human loan officer is the approver (segregation of duties: the agent recommends, a person approves). The data with planted mistakes: CRS's fraud, deceased and frozen personas.*
- Their four judging questions and your answer: (1) Real enough? Live bureau-grade sandbox data, 20-persona test set with an answer key. (2) Would you hire it? Limited access (sandbox only, consent gate), clean record of work (audit log), knows when to ask (hands the final accept to the human). (3) Something new? Competing underwriting policies plus a self-writing adverse-action notice. (4) **The moment:** the applicant whose score clears the threshold but whose identity check says deceased, caught and explained. **Open the video with that moment.**
- Submission: code, demo video opening with the moment, live demo (they may hand you their own scenario, so keep the persona deck and a "custom applicant" input), one line on the seats filled, proof it works (what's real vs simulated, test set, planted errors with answer key).
- Doc: https://docs.google.com/document/d/1u4iN8R97ILY3kfHTPKC82zdutHrGx4ze5eCAP-J92w4

**Prize conflicts resolved toward Hive (updated today):** Convex **$5,000 cash**; CREAO $2,500 / $1,500 / $1,000. CRS on Devpost still shows $1,000 / $500; Slack says doubled to $2,000 / $1,000. Treat Slack as current for CRS.

**Other prizes worth a checkbox**
- **Capital One Best Use of Nessie:** $300 gift card per member; judged on completeness, creativity, complexity. No Cal Hacks-specific doc. Mock banking API (customers, accounts, transactions, loans). Fallback data spine if CRS fails; also a cheap add-on (pull the applicant's mock account balance as the "self-reported income" check) if the slice is green by Sat 15:00.
- **Anthropic:** prize "coming soon" on Hive. Criteria: a named community (not "students"), a lived problem, one thing done well, Claude does something that matters and you know where it fails. Opt in; the intake agent and underwriting explanations are Claude. Name the community: "loan officers at small credit unions".
- **SpacetimeDB:** $2,048 / $1,024 / $512 cash, must be the core real-time backend. Conflicts with Convex. Only consider if Convex turns out to be the gear prize after all; Convex is the safer build.
- **Microsoft:** Devpost confirms 1st is a Surface per member plus talk and mentorship ($3,800 value); 2nd is talk and mentorship only.
- **Meta:** invite to a Round 2 hackathon at Menlo Park, "bringing people closer together with AI". Poor fit; skip.
- **Moss, Notability, Armadin, MLH swag tracks:** skip, except tick MLH boxes for anything you actually use (GoDaddy domain, Vultr or DigitalOcean if you host there, Auth0 if you add login).
- ASUS and Greptile have no listed prizes beyond swag.

