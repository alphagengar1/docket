# Live demo: 3-minute run of show

Written Sat Oct 24 against commit `8210c95` (deployment reports `e2dafe5`, `CRS_PROVIDER=mock`, latest eval 20/20). The structure follows the research in `design/demo-day-kit.md`: the judge lives the demo with their own hands, one good day, one bad day, one moment as the human, then proof. A demo that stalls loses to a simpler one that runs, so the live run uses three personas, not five.

Timings below come from live runs on the cloud deployment today, not from guesses.

| Persona | Card | Name, ask | Phone shows offers / stop | Notice ready | Use |
|---|---|---|---|---|---|
| P01 | 9987 | Margaret Okafor, $20,000, home improvement | ~12 s, 3 offers (6.49%, 7.90%, 10.90%) | none (all approve) | Live, beat 2 |
| P13 | 9442 | Kayla Brennan, $10,000, personal | ~6 s, stopped | ~8 s | Live, beat 3 |
| P08 | 9487 | Priya Venkatesan, $15,000, debt consolidation | ~12 s, 1 offer (Northstar 15.90%) | ~28 s | Live, beat 4 (started from console) |
| P15 | 3659 | Nicole Farragut, $15,000, home improvement | ~13 s, 3 offers | none | Backup good day; Q&A on identity |
| P05 | 3239 | Ricky Dalton, $7,000, debt consolidation | phone sits on "Checking" ~34 s | ~34 s | Video only. Too slow live |

> **Judging-day rules (Cal Hacks email, Oct 25 01:23):** personal hotspots are banned and enforced, so the demo phone and laptop use the venue Wi-Fi. A locally stored demo video is required: `~/Desktop/docket-backup/docket-demo.mp4` (2:22, captions burned in). Be at the assigned table from 10:30 to 12:30 with the whole team; three judges minimum, five minutes each, live demo required. If the Wi-Fi fails, play the local video and walk the printed deck.

## Roles and positions

| Who | Where | Holds | Job |
|---|---|---|---|
| A (Pitch) | Standing beside the big screen, facing judges | The printed deck, the 3:00 timer, the spare P01 and P13 cards | Talks. Hands over cards and the phone. Answers legal, fairness, "real lenders" |
| B (Driver) | Seated at the laptop, console at `/` | The keyboard | Approves on the console, starts P08 from the console deck, switches the board, answers technical questions |
| Judge 1 | In front of A | The demo phone at `#/borrower` for the whole pitch | Types codes, picks an offer, tries the override, sends the notice |
| Big screen | Facing judges | `#/board`, full screen | Same run in large type. Keys on the board: `E` eval view, `B` board view, `R` replay |

Two judges: Judge 1 holds the phone for P01 and P08. Hand the P13 card and the reviewer moment (Override) to Judge 2.

## 60 seconds before each judge

1. B clicks **Reset** in the console top bar and confirms. Queue and board are empty.
2. B runs a warm-up (Claude round trip, last measured 0.75 s): console warm-up if wired, or `curl` `desk:warmup`. If it takes more than 3 s, plan on the slow-lender line below.
3. B checks the board shows the title card, full screen, no notifications (Do Not Disturb on, Slack and Messages quit).
4. A taps **Start over** on the phone so it shows "Type the code on your card." Phone is on the venue Wi-Fi (hotspots are banned), Guided Access on.
5. A stacks the deck: P01 on top, P13 second. The rest of the deck sits underneath so the fan looks real. A forces the top card on the first draw ("take the top one"). If the judge insists on a random draw, use the branches at the bottom.
6. A starts the timer when the judge arrives, not before.

## Run of show

J = judge. Exact words are in quotes. Stage directions are plain text.

### Beat 1. The hook (0:00 to 0:15)

| Time | Who | Says or does |
|---|---|---|
| 0:00 | A | "When a lender says no, the letter tells you almost nothing. Docket is a one-person credit union: one loan officer, a desk of AI agents, and every reason in a denial letter is tested before it goes out." |
| 0:10 | A | Fans the deck. "You're not a judge for the next two minutes. You're a borrower. Take the top card." |

### Beat 2. A good day, P01 (0:15 to 1:05)

| Time | Who | Says or does |
|---|---|---|
| 0:15 | A | Hands J the phone. "Type the four digits on your card." J types 9987. Phone: "Hi Margaret. You need $20,000 for home improvement." |
| 0:22 | A | "That's you. Tap Find my offers." J taps. Phone: "Checking your offers." |
| 0:25 | B | Points at the big screen as the waterfall fills. "That pulled your file from TransUnion, Equifax and Experian, plus identity and fraud checks. The bureau data is the CRS sandbox: these are sandbox pulls we captured, on the production schema. It's a soft pull, so your score doesn't move." |
| 0:35 | B | Hard-stop row turns green. "Before any AI sees your file, rules in code check for a deceased file, a failed identity check or a high fraud score. You passed." |
| 0:40 | A | Three lender cards resolve; offers land on the phone. "Three lenders, three written credit policies, the same file, in parallel. A credit union, a fintech and a prime bank." |
| 0:48 | A | "Pick the one you want." J taps an offer. Phone: "Waiting for underwriter." |
| 0:52 | B | If J picked Meridian Bank Prime (6.49%, the lowest), press **A**. Otherwise click the offer J picked in the Inspector and press Approve (A always approves the lowest APR, not the judge's pick). "Nothing funds until a person signs. Today that person is me." |
| 0:58 | A | Phone: APPROVED. "That's a good day." |

If offers are not on the phone by 0:50: A says "Lenders are still quoting; the others carry on," and moves to beat 3 at 1:05 anyway. B approves P01 later, in Q&A.

### Beat 3. A bad day, P13 (1:05 to 1:45)

| Time | Who | Says or does |
|---|---|---|
| 1:05 | A | Takes the P13 card from the deck. "Here's a bad day. Tap Start over and type this one." J taps Start over, types 9442, taps Find my offers. |
| 1:05 | B | At the same moment, quietly: top bar **Deck**, pick **P08**, submit the intake. (This starts beat 4 now so its notice is ready when we get there. Judges watch the phone, not the laptop.) |
| 1:15 | A | Phone: "Application stopped." Board goes red. "Kayla's identity didn't verify, and the fraud screen scored her 88 out of 100. That's a synthetic identity." |
| 1:22 | B | "A rule in code stopped this, not a model. No lender ever saw the file. Zero offers." |
| 1:28 | A | "You're the reviewer now. Flip Reviewer mode and try to fund it anyway. Tap Override." J taps Override. Phone: blocked, "A fraud review must clear this file first." |
| 1:35 | B | "Refused, and logged. Every action lands in the audit trail, including yours." |
| 1:40 | A | "Send the notice instead." J taps Send notice. The notice opens: "We can't offer you a loan right now," the two reasons, what you can do, your rights. |

Cut line if long: skip the 1:35 sentence; the phone already shows "Logged".

### Beat 4. Tested reasons, P08 (1:45 to 2:30)

This beat is on the big screen and the console, not the phone. P08 was started at 1:05, so by 1:45 it has been running about 40 s. The notice is ready at about 28 s.

| Time | Who | Says or does |
|---|---|---|
| 1:45 | B | Presses **N** to jump to Priya Venkatesan, opens the Inspector trace (if the console is in Focus mode and the reason checks are hidden, click **Detail** in the top bar first). "While you did that, a third applicant came in. Priya has a $7,400 unpaid state tax lien and a 690 score. Split decision: Northstar Lending approves at 15.9% if she shows a payment plan for the lien. The credit union and the prime bank decline." |
| 1:58 | A | "A decline letter has to give the reasons the lender actually relied on. Models pad that list. So before the letter goes out, we test every reason." |
| 2:05 | B | Points at the reason checks. Read what the screen shows, using one of these: |
| | | If a reason is marked withheld: "Pacific Ridge gave two reasons. We cleared the lien and re-ran the lender: it approves. That reason is real. We raised the score to 780: still a decline. That reason was filler, so it's withheld from the letter." |
| | | If no reason is withheld: "We change one factor at a time and re-run the lender. Every reason here flipped the decision, so every one stays in the letter." |
| | | If a lender's checks say inconclusive: "This lender would decline even with everything fixed, so a single factor can't be proven. We mark that inconclusive instead of claiming it." |
| 2:20 | A | "The letter names each lender, the reasons that passed, and says the credit bureau didn't make the decision. A person sends it." |

Today's live P08 run: Pacific Ridge's lien reason flipped (verified), its 690-score reason did not (withheld); Meridian's two checks were inconclusive. Model output varies run to run, which is why B reads the screen instead of reciting.

If P08 is still verifying at 1:45: B says "It's still testing reasons; each check is a full lender re-run," and narrates the checks as they land. At 2:20 move on regardless.

### Beat 5. Proof and close (2:30 to 3:00)

| Time | Who | Says or does |
|---|---|---|
| 2:30 | B | Presses **E** on the board for the eval view. |
| 2:32 | A | Holds up the deck. "This deck is our test suite. All 20 CRS sandbox personas run through the real desk every night. We agree with our answer key on 20 of 20, on 96 of 100 lender calls, and 82% of reasons hold up." |
| 2:42 | A | "What's simulated: the three lenders are agents with written policies, no money moves, and every person here is a sandbox persona." |
| 2:50 | A | "Agents do the work, a person makes every call, and every step is logged. We're Swaraj and Matthew. Ask us what breaks." Stop at 2:55. Five seconds of buffer. |

## Words to say and not say

- Say "the CRS sandbox" and, since the deployment runs `CRS_PROVIDER=mock`, "captured sandbox pulls". If you switch the deployment to `CRS_PROVIDER=crs` before judging, say "live sandbox pulls" instead. Never claim live if it isn't.
- Say "TransUnion score" or "VantageScore".
- Say "soft pull". The endpoints are the prequal products.
- If a lender is slow, the other lenders carry on.

## Fallbacks

| What goes wrong | What you see | Who acts | Exact words |
|---|---|---|---|
| One lender hangs | Lender card stays on "Quoting" past ~10 s | A | "That one is slow. The other lenders carry on, and a stuck reply is re-run on Claude." Keep talking; do not wait. |
| All lenders slow (rate limit) | Waterfall stuck at underwrite | A | "Every team in this building is hitting the same APIs right now." Move to the next beat on the clock. B approves the stragglers during Q&A. |
| Phone loses network or the judge leaves the page | Phone frozen or on another app | B | "Let's run this one from the console." B starts the same persona from **Deck**. Judge watches the big screen. |
| Judge types a wrong code | Phone: "No card with that code." | J | Types it again. Codes are digits 2 to 9 only. |
| Venue network drops completely | Console says disconnected, phone and board stop updating | B, then A | B clicks **Replay** in the console top bar (or presses **R** on the board). A: "The wifi just dropped. This is a recording of a run from last night." The bundled replay is persona P17 (Beatrix Oyinlola, $22,000 solar panels: two approve, one decline with a verified and a withheld reason), not the card in the judge's hand, so say "a run", not "this card". Then switch to the local screen recordings below for P13. |
| Network drops and you need the hard stop | Replay only covers P17 | B | Play the local file `~/Desktop/docket-backup/P13.mov` full screen on the big screen. A: "This is a recording of the card you're holding." |
| Board shows stale data from the last judge | Old applicants on screen | B | Reset before the next judge. Never mid-pitch. |
| Judge draws P13 first (random draw) | Bad day first | A | Run beat 3, then "Now a good day," hand over P01. Beat 4 and 5 unchanged. B starts P08 when P01's code goes in. |
| Judge draws P05 | Phone sits on "Checking" for ~34 s | A | "This one is all three lenders saying no, and every reason being tested. It takes about half a minute." Hand over P01 while it runs; come back to P05's notice in beat 4 instead of P08. |
| Judge draws any other card | Unknown outcome | A | Let it run. "Every card in this deck is one of our 20 test cases; the eval says what should happen." B reads the outcome off the board. |

Backup recordings to make before judging: screen-record P01, P13 and P08 runs (console plus board, about 40 s each) into `~/Desktop/docket-backup/`. The Devpost video shoot produces these anyway.

## Fix before judging, or plan around

These came out of today's rehearsal runs. None is in this doc's lane to fix; each has a workaround above.

1. The phone does not start by itself. After the 4-digit code it shows "Hi [name]" and a **Find my offers** button (`web/src/borrower/Borrower.tsx:177`, also in the deployed bundle). The script includes the tap.
2. Offline replay is one run, not twenty. The console **Replay** button and board **R** key play the bundled fixture `web/src/mock/fixture.ts` (P17 only). The 20 recordings live in the Convex `recordings` table, which needs the network, and no UI reads them (`desk:recordedRun` has no caller in `web/src`).
3. The Convex recordings are stale. All five demo personas were recorded at 03:35 to 03:44, before the lien flag and plain-language notices (commit `6e55938`, 09:34). The P08 recording shows Pacific Ridge approving with no lien reason; the live run declines on the lien. Re-run `eval:recordAll` before relying on any recording.
4. **A** approves the lowest APR, not the offer the judge picked (`web/src/App.tsx:131`, `web/src/lib/rank.ts:19`). The audit log then names a different lender than the phone. Workaround in beat 2.
5. P05 is not "two verified reasons each". Live and recorded runs agree: Pacific Ridge 3 verified, Northstar 2 verified, Meridian's 3 reasons inconclusive (its all-fixed test still declines), and those inconclusive reasons stay in the notice. Do not say "every reason was verified" over P05.
6. After a P05 notice is sent, the phone's notice screen says "No lender saw your request" (`Borrower.tsx`, Notice and stopped views). That is true for a hard stop and false for P05, where three lenders reviewed it. Another reason to keep P05 off the phone live.
7. Two rehearsal applicants (P08, P05) from today are sitting in the shared queue. Reset clears them.
