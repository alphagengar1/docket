# Handoff: Docket at Cal Hacks 13.0

Read this first if you just sat down at the laptop. Written Sat Oct 24, 10:20 AM.

## What Docket is (the pitch in four lines)
A one-person credit union. A borrower types a 4-digit card code on their phone. Docket pulls their credit file from the CRS Credit API sandbox, runs deterministic hard-stop rules, then five AI underwriters (a credit union, a fintech, a prime bank, a regional bank, a second-chance lender, each with its own written policy in `policies/`) decide in parallel. A compliance agent writes the adverse-action notice, every denial reason is verified by a counterfactual test, and a human approves every offer. Nothing goes out without a person.

## The three screens
| Screen | URL | Who looks at it |
|---|---|---|
| Operator console (dark) | https://docket-sepia-ten.vercel.app/ or http://localhost:5173/ | you, the loan officer |
| Judge board (light) | add `#/board` | judges, on the big screen |
| Borrower phone (light) | add `#/borrower` | the judge playing the borrower |

The public URL and localhost show the same live data: both talk to the cloud Convex deployment `warmhearted-seahorse-595`.

## Running the demo
1. Hand the judge a persona card from the printed deck (PDF in `design/deck/persona-deck.pdf`; codes in `design/card-codes.json`).
2. They open the phone URL and type the 4-digit code. The application starts by itself.
3. Watch the console. The waterfall fills in, five lender cards resolve, the applicant lands in the queue under "Needs your decision".
4. In the queue click **Approve best** or **Decline**, or press **A** / **X**. **N** jumps to the top of the queue. The phone updates instantly.
5. The Inspector on the right has the credit snapshot, the trace, and the notice. "Dispute" on a tradeline re-pulls and re-runs as a replay.
6. **Reset** in the top bar wipes applicants between judges. Replays of all 20 personas are kept.

Say out loud that bureau data is the CRS sandbox (`CRS_PROVIDER=mock` uses cached real sandbox pulls; `crs` does live pulls). Never say "FICO"; the sandbox score is a VantageScore, the UI says "TransUnion score".

## If something looks wrong
- Console blank or stuck: hard refresh. If still blank, check the Convex dashboard https://dashboard.convex.dev/t/swaraj-adhikari/agent for errors.
- Lender stuck on "Quoting": the lender timeout is 20 s; it will fail over and the others continue.
- Phone says code not found: the code must be one from `design/card-codes.json`; press Reset only if the board is full of junk.
- Local dev server: from `web/`, run `/Users/swrj/.nvm/versions/node/v22.18.0/bin/npm run dev`. Plain `npm` does not work in this terminal; always use that absolute path for node, npm and npx.

## Repo map
- `convex/` backend (schema, desk.ts verbs, agents, rules, verify, classify, eval, CRS client, fixtures). Deploys automatically while a `convex dev` watcher is running; otherwise `npx convex deploy` is NOT what we use, run `npx convex dev --once`.
- `web/src/` console; `web/src/board/` judge board; `web/src/borrower/` phone.
- `policies/*.md` the five lender policies (plain English, run `npm run policies:sync` after editing).
- `personas/map.json` answer key for the 20 personas, including per-lender expectations.
- `design/` product, architecture, contracts, decisions, STATUS log, deck, screenshots, prompts for other Claude sessions.
- `docs/devpost.md` the Devpost text and submission checklist; `docs/pitch-cards.md` judge Q&A.

## Checks before committing
From the repo root with the absolute npm path: `npm test` (27 tests), `npm run typecheck`; from `web/`: `./node_modules/.bin/tsc -b`.

## Rules
- Never commit `.env`, `.env.local`, or any key. They are git-ignored; keep it that way.
- No Claude attribution lines in commits or PRs.
- Repo stays private until the Devpost submission is ready, then flip it public.
- Always `git pull --rebase` before `git push`. Other Claude sessions may be committing.

## What is left (Sun Oct 25, Devpost closes 09:00 PDT, edits lock 10:30)
- Record the 3-minute demo video.
- Print the deck (FedEx Office Marina): fronts once, backs x4, cardstock, duplex long edge.
- Flip the repo public and submit on Devpost with tracks: CRS, Convex, Hyphenate, Microsoft, Anthropic, Most Creative, Most Technically Advanced, People-First. CREAO: Swaraj will handle it later, ignore it.
- Keep tightening the UI; the lane prompts for extra Claude sessions are in `design/prompts-for-other-sessions.md`.

## Talking to the Claude session on this laptop
Just type what you want in plain words. It knows the whole codebase and this plan. Ask it to explain anything in here before changing it.
