# Cal Hacks 13.0: Prize Summary and Top Ideas (one page)

*Sat Oct 24, 00:45. Hard deadline Sun 09:00 PDT on Devpost. ~2,000 hackers, est. 600–800 projects. Amounts from Hive (current) where Devpost is stale. Hardware valued at ~70% retail. Full reasoning in calhacks-13-strategy-memo.md.*

## All prizes, by cash value

| Sponsor / track | Prize | Hard requirement | Est. real entrants |
|---|---|---|---|
| Hyphenate — Autonomous Systems for Finance | **$8,000 / $5,000 / $3,000** + interviews top 5 | Autonomous system filling finance-team "seats" + the company around it; live demo; proof it works (test set, planted errors) | 40–80 |
| Visa — Reimagining Shopping | **$5,000** (1 winner) | GenAI commerce across the whole journey; chatbot alone insufficient; no APIs | 80–150 |
| Convex — Best Use | **$5,000** cash (Hive; Devpost stale) | Reactive DB + backend functions, visible live updates, a component | 30–60 |
| Mana — Best Hack built with Mana | **$5,000**, open to every project | Meaningful use while building; public mana.space link; +10 bonus if it lives in Mana | everyone can enter |
| CREAO — AI-First Disruptor / One-Person Company / Team Empowerment | **$2,500 / $1,500 / $1,000** + Launchpad | ≥1 CREAO agent does the core work; agent ID + run share link in README; select track | 30–70 / 10–25 / 10–25 |
| Apify — Best Use (5 places) + Best Actor | **$2,000 / $1,000 / $800 / $400 / $400 + $400** | Build with Apify actors / MCP | 20–40 |
| Coinbase — Best Use of x402 (2 tracks) | **$500 USDC per member per track**, up to $4,000 | Agent pays or earns via x402 + Coinbase MCP; testnet eligibility unanswered | 10–25 |
| Factory — Droid SDK | **$2,000** + $200 credits each | Embed Droid coding agent via SDK; free tier unconfirmed | 10–25 |
| CRS Credit API | **$2,000 / $1,000** (doubled Fri night) + 2 FDE interviews | Live sandbox calls (credit, identity, fraud) at demo | 5–15 |
| SpacetimeDB | **$2,048 / $1,024 / $512** | Spacetime as the core real-time backend | 10–25 |
| Fetch.ai — ASI:One | **$1,500 / $1,000 / $500** + 2×$250 | uAgent on Agentverse, Chat Protocol, workflow inside ASI:One, 3–5 min video, Submission Agent | 40–80 |
| Bright Data — Public Web Data | $1,500 / $1,000 / $500 credits + **$500 / $350 / $250** Amazon | Live scrapes essential to the product; no mocks, no login/paywall | 20–40 |
| Figma (5 × $1,000 Amazon) | **$5,000 pool** | Edu-verified team (2–3 business days), Figma Slides stage log, public files | 30–60 |
| Microsoft — Built for the Real World | Surface per member (~$3,800 value) + talk + mentorship; 2nd: talk + mentorship | Production-minded agent in finance/health/productivity; evals, guardrails, deploy | 40–80 |
| Capital One — Best Use of Nessie | **$300 gift card per member** | Use the Nessie mock banking API | 15–30 |
| Elastic — Agent Builder on Serverless | Meta Quest 3S (1st), Bose QC (2nd) | Agent Builder on a serverless instance | 10–20 |
| Cartesia — Best Use | Meta glasses (~$1,500 value, team ≤4) | Voice is core; natural, responsive | 20–40 |
| Atlassian — Best Agent / Best Security for Agents | AirPods Max per winner | Forge app on a demo site | 5–15 |
| Bitdeer AI | $500 credits + 4 mice / $200 credits + LEGO | Use Model Studio | 10–20 |
| Moss / Notability / Armadin | AirPods-tier hardware | Use their product | thin |
| SpaceXSI — Make it Legendary | Cursor keyboard per member (~$400) | Built with Cursor; Grok Bot bonus | 40+ |
| Anthropic | "Coming soon" | Named community, lived problem, Claude does something that matters | many |
| Meta — Bringing People Closer | Invite to Round 2 at Menlo Park (travel paid) | AI that strengthens human connection | many |
| Cal Hacks 1st / 2nd / 3rd Overall | $3,600 + MacBook Air each / Switch 2 each / Google eyewear each | General criteria: application, intentionality, functionality, creativity, technical complexity | all |
| Cal Hacks categories | Beginner: AirPods 4 · Most Creative: Instax · Most Technical: NuPhy keyboard · Hardware: Bambu printer · People-First: Apple Watch · Planet-First: Parks Pass · Solo: AirPods Pro 3 · Hacker's Choice: MX Master 4 | opt in | all |
| MLH (Gemini, Solana, Tiger Data, Vultr, Snowflake, GoDaddy, ElevenLabs, DigitalOcean, Auth0, MongoDB, .Tech, Commit Fellowship) | swag / small hardware | use the tool, opt in | varies |
| ASUS / Greptile / Apify merch / Supercell | swag, surveys, tournament | — | — |

No rule limits how many tracks one project enters; prizes stack (11 of 102 winners last year took 2–3).


> **CREAO eligibility open question (Sat 00:50):** Swaraj is CREAO's workshop speaker this weekend, demoing Cue, which won their LA Hacks track. Ask Charis tonight whether a speaker may enter the track. Build the Underwriter/Compliance agents behind one `runAgent()` interface so they can be CREAO runs or direct Claude calls; decide at the 12:30 lunch check. Without CREAO: EV drops ~$400, demo latency risk drops, every other track unchanged.

## Top ideas and the prizes each touches

### 1. One-person credit union (RECOMMENDED) — risk-adjusted EV ≈ $1,600
One human runs a compliant lending desk. Intake agent (Claude) takes consent + income → backend pulls live **CRS** credit, identity and fraud data on a test persona → **CREAO** org chart (3 Underwriters with different policies + Compliance agent writing the adverse-action notice) → offers stream onto a live **Convex** board → human approves. Judge picks the applicant from a persona-card deck. Eval harness over 20 personas with an answer key.
- **Touches:** CRS ($2k/$1k + interviews) · CREAO One-Person Company or Disruptor ($1.5k/$2.5k) · Convex ($5k) · Hyphenate ($8k/$5k/$3k) · Microsoft (Surfaces) · Anthropic · Nessie (optional add-on) · General, Most Creative, Most Technical.
- **Why it wins:** CRS teased "agentic credit exchange" themselves and has no prior winners; Hyphenate's rubric (finance seats, human approver, planted errors, "the moment") is this product verbatim; only APIs you already know.
- **Best case:** CRS 1st + CREAO sub-prize + Hyphenate place ≈ $7k–$12k.

### 2. Same product, Fetch.ai marketplace flavor — EV ≈ $750
Borrower uAgent negotiates with lender uAgents over Agent Chat Protocol inside ASI:One; otherwise identical.
- **Adds:** Fetch.ai ($1.5k/$1k/$500). **Costs:** 4–6h of unfamiliar plumbing + mandatory video; invites "where are the real lenders?" Dropped unless the slice is green by Sat 15:00 and a third person is idle.

### 3. Shopping concierge (Visa flavor) — EV ≈ $330
iMessage/web agent across discovery → checkout → post-purchase using live Bright Data/Apify scrapes, CREAO research agent, Convex shared cart, x402 payments.
- **Touches:** Visa ($5k) · Bright Data · Apify (5 places) · CREAO · Convex · Coinbase x402 · Microsoft.
- **Why not:** most crowded archetype at the event; no Visa API depth lever this year; scrape latency in a 3-minute pitch.

### 4. Jira-to-PR engineer with a security gate — EV ≈ $200
Forge app: Jira issue → Rovo agent → Factory Droid writes fix → PR with prompt-injection scan and revert.
- **Touches:** Atlassian (AirPods Max each) · Factory ($2k) · Microsoft · Greptile.
- **Why not:** it is the sponsors' own product; Droid runs are minutes long; Factory free tier unconfirmed.

### Add-ons to idea 1 if everything is green
- **Sat 15:00:** Nessie balance check as the income verification ($300 each).
- **Sat 21:00:** Mana landing page + stats dashboard (lottery on $5k).
- **Anytime, 10 min:** asi1.ai raffle challenges (Meta glasses, Beats, Kindles), ASUS survey, GoDaddy domain.

## Tonight (30 min)
Request CRS creds (two emails) · claim CREAO credits via Cal Hacks link · create Convex project · new repo (no Cue code) · agree JSON contracts · skim Hyphenate doc · sleep by 01:15.
Fallback: no CRS creds by Sat 11:00 → swap data spine to Capital One Nessie, keep everything else.
