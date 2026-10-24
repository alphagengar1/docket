# Prompts to paste into other sessions (keep this session for build + design)

## 1. Separate Claude Code session: Amazon Bedrock + Scrabblebot hill climber

Context. I'm Swaraj, a UCLA freshman at Cal Hacks 13.0 (Palace of Fine Arts, SF; today is Sat Oct 24 2026; hackathon submissions close Sun Oct 25 09:00 PDT). I have about $10,000 in AWS credits from YC Startup School (Amazon activation credits) on my own AWS account. I want to spend some of them on Amazon Bedrock to power a hill-climbing agent that competes in SpacetimeDB's Scrabblebot tournament, a side prize at this hackathon ($1,024 / $512 / $256 cash). This is a side quest; my main project runs in a different session, so keep everything here self-contained and never ask me about the main project.

Phase 0, before anything else (15 min, research only): find the official Scrabblebot tournament rules for Cal Hacks 13.0 (search "SpacetimeDB Scrabblebot Cal Hacks", the SpacetimeDB blog post spacetimedb.com/blog/spacetime-at-calhacks, the Cal Hacks hacker guide at hive.hackberkeley.org, the #spons-spacetimedb Slack channel if I paste it). Report: what a bot is (a SpacetimeDB module? a client that connects to their server?), language options, how matches are run and scored, submission deadline and format, whether there is a leaderboard or practice server, and any rate or compute limits. Stop and show me this before building anything. If the rules are not findable, tell me exactly what to ask in their Slack channel.

Phase 1, Bedrock setup (walk me through it; I'll run commands you give me, use `! <command>` style when you want me to run something interactive):
- Verify the credits are applied and that Bedrock usage is covered by them (Billing → Credits; AWS activation credits generally cover Bedrock, but confirm on my account, and tell me how to check). Set a budget alert at $200 and $1,000 so nothing runs away.
- Pick one region with Claude on Bedrock available (us-west-2 is usually right from SF), request model access for the current Claude models (check the Bedrock console's model-access page; also list the exact Bedrock model IDs available to me, do not guess them), and set up an IAM user or role with least privilege for bedrock:InvokeModel and bedrock:InvokeModelWithResponseStream only.
- Get me to a working `aws bedrock-runtime converse` call from the CLI and from a tiny Python script using boto3, with the credentials in a profile, never in code. Show me per-token pricing for the models I enabled so I can budget.
- If Bedrock also offers a cheaper fast model that's good enough for the inner loop of a search, note it.

Phase 2, the hill climber:
- I have a prior project at /Users/swrj/Downloads/Code/Projects/climb-harness and /Users/swrj/Downloads/Code/Projects/quant-hillclimb: a harness that proposes a change, evaluates it against a scorer, keeps it if better. Read them for the pattern, then design a loop for Scrabblebot: candidate = bot strategy (heuristics and parameters, or a model-written policy), evaluation = simulated matches against a baseline or prior champion, acceptance = win rate with enough games to be significant. Use Bedrock Claude as the proposer of strategy edits and, if the rules allow, as part of the bot's decision-making within whatever latency the tournament permits.
- Start with a strong classical baseline (dictionary, move generation, leave evaluation; look at how Quackle and Macondo work) before any LLM is in the loop. A dumb bot that is fast beats a smart bot that times out.
- Keep a results ledger (CSV) and a `STATUS.md` I can read at a glance. Budget cap for this whole thing: $500 of credits unless I raise it.

Rules for you: ask before any command that creates AWS resources with ongoing cost. Never put keys in files I might commit. Keep a running cost estimate. If the tournament turns out to need a submission by a time I can't make, say so immediately.

## 2. Claude Web (research, no code): similar past projects

I'm at Cal Hacks 13.0 building a hackathon project: a live "underwriting console" where an applicant's credit bundle is pulled from a credit-bureau sandbox (CRS Credit API), three AI lender agents with different policies return offers in parallel, a compliance agent writes the adverse-action notice, and a human approves. Find 8 to 12 past hackathon projects (Devpost, GitHub, YouTube demos) from 2024 to 2026 that are close: AI underwriting, loan decisioning agents, credit-data agents, multi-agent fintech demos, "agentic lending". For each: name, link, one line on what it did, what sponsor tracks it won if any, and the one thing in its demo or write-up that we should steal or avoid. End with a short list of claims judges have heard before in this space (so we don't repeat them) and three angles none of these projects took.

## 3. Claude Web (research, no code): the 3-minute demo

Same project as above. The judging format at Cal Hacks is a 3-minute pitch plus 2 minutes of questions at our table, with judges rotating, and a live demo on a laptop plus a second screen. Our demo beat: the judge draws a persona card from a printed deck, we enter the applicant, the board shows the credit pull, three lenders stream offers in, one persona is a deceased-file hard stop with zero offers and an auto-written adverse-action notice, and we end on an eval panel showing pass rates over 20 personas. Write (a) a 3-minute script with timestamps and who says what for two presenters, (b) the five judge questions most likely to come up for a fintech agent demo (legal, fairness, "where are the real lenders", "why agents", "what breaks") with crisp 20-second answers, (c) a list of demo-day failure modes and the mitigation for each (wifi, latency, a judge picking the wrong card), and (d) what the second screen should show at each timestamp. Keep it blunt and specific.

## 4. Claude Web (research, no code): slides

Same project. Judges also see a Devpost page and sponsors may watch a video asynchronously. Give me a 6-slide outline for a 3-minute pitch (title, one line of content per slide, what visual is on it) built so slide 2 is "the moment" (the deceased-file catch), plus a 2-minute video storyboard with shot list, and the Devpost description structure (sections, word counts) that past Cal Hacks winners used. Then list the five things on a Devpost page that make a sponsor judge decide a project actually used their tool rather than mentioning it.

## Session split (Sat 10:20)

Three Claude Code sessions on this repo, each with its own lane. Paste the matching prompt as the first message of a new session opened in the repo root. Every session: never add Claude attribution to commits; show the commit message before pushing; `git pull --rebase` before every push; commit only files in your lane; one line in design/STATUS.md per finished step, prefixed with your lane name; anything you need from another lane goes in design/open.md, not into their files. Node is not on PATH in non-interactive shells: use /Users/swrj/.nvm/versions/node/v22.18.0/bin/{node,npm,npx} by absolute path. A Convex dev watcher and a Vite dev server (localhost:5173) are usually already running; check before starting another.

### Lane A: desk (this session). Backend, integration, deploy, submission
Owns: convex/, policies/, personas/, design/ (except deck/), docs/, README.md, vercel.json, root configs. Deploys to Vercel and Convex, runs the eval, owns Devpost text and the track checklist.

### Lane B: console. Paste into a new session
```
You own the operator console only: web/src/ except web/src/board/ and web/src/borrower/, plus web/src/index.css and web/src/tokens.css. Read CLAUDE.md, design/product.md, design/theme.md, design/ui-donors.md and the "Session split" section of design/prompts-for-other-sessions.md first. Do not touch convex/, board/, borrower/ or design/deck/; if you need a backend field or a token change that affects the board or phone, write it in design/open.md. Dev server: http://localhost:5173 (start with /Users/swrj/.nvm/versions/node/v22.18.0/bin/npm run dev from web/ only if nothing is listening on 5173). Typecheck with ./node_modules/.bin/tsc -b from web/. Current asks: the trace and waterfall are readable but keep tightening legibility; the ranked decision queue (web/src/components/Queue.tsx, lib/rank.ts) should feel like the primary way to work; the brand mark lives in web/src/components/Logo.tsx, use it instead of any square or emoji placeholder; no generic icons anywhere. Commit only your files, show me the commit message, pull --rebase, push.
```

### Lane C: judge screens. Paste into a new session
```
You own the judge-facing surfaces only: web/src/board/, web/src/borrower/, design/deck/ and design/canvas/. Read CLAUDE.md, design/theme.md, design/demo-day-kit.md, design/card-codes.json and the "Session split" section of design/prompts-for-other-sessions.md first. The theme is Instrument Tag (tokens under .itag in web/src/tokens.css; do not edit tokens.css or index.css, ask in design/open.md). The brand mark is web/src/components/Logo.tsx; the phone and board already use it. Do not touch convex/ or the console components. Dev server: http://localhost:5173/#/board and /#/borrower. Typecheck with ./node_modules/.bin/tsc -b from web/. Current asks: the board must be readable from 2 m (nothing under 22px), the phone flow Code → Offers → Notice must match the canvas artboards, the printed deck PDFs must match the on-screen brand. Commit only your files, show me the commit message, pull --rebase, push.
```

### Lane D: scrabblebot. Separate project at /Users/swrj/Downloads/Code/Projects/scrabblebot-climb, already has its own session.
