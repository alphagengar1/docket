# Devpost video: 3-minute shot list and voiceover

Same beats as `docs/demo-script.md`: hook, a good day, a bad day, tested reasons, proof. The video can show what the live demo can't afford to wait for (P05's 34-second run, P15's frozen file), because waits are cut in the edit. Sponsors may judge from this video alone, so every sponsor tool appears on screen at least once: CRS endpoints, Convex workflow and live queries, Claude model names, the human approval (Hyphenate), the timeout and eval (Microsoft).

Target: 2:55, about 430 spoken words at a calm pace. Record voiceover separately and lay it over screen captures.

## Capture setup

- Screen recordings at 1920x1080: console at `/`, board at `#/board`. Phone screen recording (iOS Control Center) of `#/borrower`. One handheld B-roll shot of a hand drawing a printed card and typing the code.
- Reset the console before each take. Run one warm-up call first.
- Record each persona as its own clip: P01, P13, P08, P05, P15. Keep these files; they are also the network-down backups for the live demo (`~/Desktop/docket-backup/`).
- Before recording, check which provider the deployment runs (`desk:config` → `crsProvider`). The script assumes `mock` (captured sandbox pulls). If you switch to live, change caption 3.
- Wherever a wait is cut, put a small "sped up" or "cut: 20 s" tag in the corner. Judges catch hidden edits; a labeled cut costs nothing.
- Captions: burned in, bottom third, white on black bar, one line, sentence case. Voiceover lines and captions are not identical on purpose: the caption carries the fact a muted viewer needs.

## Shot list

| # | Time | Shot | Voiceover | On-screen caption |
|---|---|---|---|---|
| 1 | 0:00–0:10 | CREAO-generated scene (prompt A below): a person at a kitchen table reads a one-line denial letter. Fallback: black, then the letter line "We were unable to approve your application at this time." Small corner label: "AI-generated scene". | "When a lender says no, the letter usually tells you almost nothing." | "Denied. Reason: internal standards." |
| 2 | 0:10–0:20 | Title card on the board: Docket wordmark, pipeline strip. | "Docket is a one-person credit union. One loan officer, a desk of AI agents, and every reason in a denial letter is tested before it goes out." | "Docket: one loan officer, a desk of agents" |
| 3 | 0:20–0:32 | B-roll: hand draws the P01 card, types 9987 on the phone. Phone: "Hi Margaret. You need $20,000 for home improvement." Tap Find my offers. | "Every applicant is a printed card. Margaret needs twenty thousand dollars for a home repair. She types her code." | "20 CRS sandbox test personas. No real people." |
| 4 | 0:32–0:45 | Console waterfall filling: pull, hard-stop rules. Zoom on the pull row. | "Docket pulls her file from TransUnion, Equifax and Experian through the CRS sandbox, with identity and fraud checks. It's a soft pull. Then rules written in code check for a deceased file, a failed identity or a high fraud score, before any model sees anything." | "CRS sandbox: 3 bureaus + identity + fraud. Captured pulls, production schema." |
| 5 | 0:45–1:00 | Split screen: three lender cards resolving on the console, offers landing on the phone. | "Three underwriter agents, each with its own written credit policy, quote in parallel: a credit union, a fintech and a prime bank. Margaret gets three offers." | "3 lenders in parallel · claude-haiku-5-5 · 20 s timeout each" |
| 6 | 1:00–1:10 | Phone: tap an offer, "Waiting for underwriter." Console: queue row, click Approve. Phone flips to APPROVED. | "She picks one. Nothing funds until a person signs off." | "A human approves every offer" |
| 7 | 1:10–1:30 | P13: card 9442 typed, phone "Application stopped", board turns red, console hard-stop row: identity unverified, fraud 88. | "Kayla's application never reaches a lender. Her identity doesn't verify and the fraud screen scores her eighty-eight out of a hundred: a synthetic identity. A rule in code stops it. Zero offers." | "Hard stop in code: identity failed, fraud score 88 ≥ 80" |
| 8 | 1:30–1:42 | Phone: Reviewer mode on, tap Override, blocked banner. Console audit trail scrolls with the override entry. | "Even the reviewer can't push it through. The override is refused and logged, and the applicant gets a notice telling her how to dispute it." | "Override refused. Every action is in the audit log." |
| 9 | 1:42–2:05 | P08: console Inspector. Northstar offer at 15.9% with the lien condition; two decline cards. Then the reason-check list. Slow zoom on one reason marked verified and one marked withheld. | "Priya has an unpaid tax lien. One lender approves on condition of a payment plan; two decline. A decline letter has to give the reasons the lender actually relied on, and models pad that list. So we test each reason: change only that factor, re-run the lender. Clear the lien and the credit union approves, so that reason stays. Raise her score and it still declines, so that reason is withheld." | "Each decline reason is re-tested. Reasons that don't change the decision are withheld." |
| 10 | 2:05–2:20 | P05: cut from code entry to the finished notice (tag "sped up"). Notice scrolls: reasons by lender, what to do next, FCRA paragraph. | "When all three say no, a compliance agent writes one notice from the reasons that held up, by lender, with the steps most likely to help and the statement that the credit bureau didn't make the decision." | "Notice drafted by claude-sonnet-5-5 from tested reasons only" |
| 11 | 2:20–2:30 | P15: console showing TransUnion frozen flag, underwriting on Equifax and Experian, three offers. | "A freeze at one bureau doesn't stop a file the other two can score." | "TransUnion frozen → underwritten on Equifax + Experian" |
| 12 | 2:30–2:45 | Board eval view (`E`): 20/20, rows, run time. Quick cut to the Convex dashboard showing the workflow and tables. | "The printed deck is our test suite. All twenty personas run through the real desk every night on Convex. We agree with our answer key on twenty of twenty, and eighty-one percent of decline reasons survive the test. That's consistency, not proof of fairness." | "Nightly eval on Convex: 20/20 vs answer key · 81% of reasons verified" |
| 13 | 2:45–2:55 | Optional CREAO-generated scene (prompt B below) behind the end text, same person, same table, now reading a letter with reasons. Fallback: board title card. Corner label: "AI-generated scene". | "The lenders are ours and no money moves. Agents do the work, a person makes every call, and every step is logged. Docket." | "Simulated: lenders, money. Real: CRS sandbox data, agents, audit trail. github.com/alphagengar1/docket" |

## CREAO video agent: opening and closing scenes

Only shots 1 and 13 are generated. Every shot that shows Docket (3 to 12) is a real screen capture: CRS asks to see the sandbox working, and generated product footage would read as a faked demo. Keep the "AI-generated scene" label on both. Budget: three tries per prompt; if neither looks right by then, use the fallbacks in the shot list.

Prompt A (shot 1, 10 s):
> 10-second cinematic clip, 16:9, natural evening light. A person in their thirties sits at a small kitchen table with an opened envelope. They unfold a single printed letter and read it. Close-up on the page: a short block of text with one bold line, "We were unable to approve your application at this time." The rest of the page is mostly blank. Cut back to their face: confused, then frustrated; they turn the page over looking for more and find nothing. Quiet, handheld, shallow depth of field, muted colors. No logos, no readable brand names, no on-screen captions.

Prompt B (shot 13, 10 s, optional):
> 10-second cinematic clip, 16:9, same kitchen table and same person as before, morning light. They read a longer printed letter with a short bulleted list near the top and nod slowly, then pick up a pen and start writing a note next to one of the bullets. Calm, hopeful, handheld, shallow depth of field, muted colors. No logos, no readable text beyond the bullet shapes, no on-screen captions.

Notes: keep the person, the table and the lighting the same across both prompts so the two scenes read as one story. If the agent renders readable letter text, check it says nothing about Docket, CRS or a real lender. Leave the letter text unreadable in prompt B; the real notice appears in shot 10.

## Recording notes per persona

- P01 (9987): offers on the phone about 12 s after the tap. Approve the offer the phone picked by clicking it in the Inspector; **A** approves the lowest APR, which may not match.
- P13 (9442): stops about 6 s after the tap. Flip Reviewer mode before tapping Override. Tap Send notice last so the notice shows.
- P08 (9487): notice ready about 28 s. Model output varies; if the take shows no withheld reason, re-run until one does, or change shot 9's last two sentences to "Every reason flipped the decision, so every one stays." Do not caption a result the take doesn't show.
- P05 (3239): about 34 s with the phone on "Checking". Shoot the console notice, not the phone: the phone's notice screen currently says "No lender saw your request", which is wrong for P05. Do not say "every reason verified" over P05; Meridian's checks come back inconclusive.
- P15 (3659): offers about 13 s. Show the frozen flag in the credit snapshot.

## Words

- Never say or caption "FICO". Say "TransUnion score" or "VantageScore".
- Say "CRS sandbox" every time bureau data appears. Say "captured" if the deployment is on `mock`.
- No team-member faces are required. If you add a closing face shot, keep it under 3 s and cut shot 11 to make room.
