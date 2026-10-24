# Underwriting Console: Demo Day Kit
·
## What wins at Cal Hacks 13.0
Three sponsor tracks fit this project almost exactly, and one of them pays $8,000. The Devpost submission closes at 9:00 AM PDT on Sunday, Oct 25. It needs a project image, the GitHub repo, and a video demo, because sponsors also judge from Devpost without a live table visit (Devpost).
Cal Hacks judging criteria.
| Criterion | What judges look for | How this demo earns it |
| Application | A realistic user, a clear benefit, a reason to adopt | Each persona card is a person with a need. The real-world proof section backs it. |
| Intentionality | An intuitive, engaging experience where every design choice has a purpose | The judge plays the borrower on a phone. One terminal theme runs across the cards, the phone, and the board. |
| Functionality | A smooth live demo, plus a clear video on Devpost | A live run with a replay fallback. Record the video on Saturday. |
| Creativity | Original framing, unexpected combinations | The deceased card twist. The printed deck is also the test suite. |
| Technical complexity | Command of the architecture, depth beyond basics | Three parallel lender agents, a coded hard stop, a compliance agent, and an eval over 20 personas |

Prize tracks to enter. Select every one of these when you submit.
| Track | Prize | What it rewards | Your angle |
| [Hyphenate] The Hyphenated Enterprise: Autonomous Systems for Finance | $8,000 / $5,000 / $3,000, and interviews for the top 5 | Hyphenate sells finance agents that do the work, escalate judgment calls to a person, and log every step for audit (hyphenate.ai). | Show the audit trail. Call the human approval an escalation, not a rubber stamp. |
| [CRS] Best Overall CRS Hack | $1,000 | Useful, working, hard to put down | The whole experience, live end to end |
| [CRS] Best Financial AI Agent | $500 | An agent that does real work, not a chatbot that reads JSON | Lender agents price offers. The compliance agent writes a legal notice. |
| [CRS] Best Identity / Fraud Innovation | Interview with CRS | Protection from fraud and identity theft | The deceased-file hard stop |
| [Microsoft] Built for the Real World | $3,800 and a Surface laptop each | Real-world fit (no further criteria posted) | The real-world proof section |
| Cal Hacks Best People-First Social Impact | Apple Watch SE 3 each | Impact on people | A denial letter a borrower can act on |

CRS judges use no points formula. They look at originality, usefulness, CRS at the core, a live end-to-end demo, and openness about data use. Their one rule: show the CRS sandbox working live (CRS challenge page). The CRS engineers are at the CRS booth all weekend. Ask them one question on Saturday about the deceased test file, so they remember your team.
## Build and print list
The one new build is a borrower view on a phone. Print the cards on Saturday, because the nearest print shop opens at noon on Sunday, after the 9:00 AM deadline.
Tonight (Saturday before sunrise).
- Build the borrower view: a mobile web route on the same app. It needs four screens: enter card code, offers arrive, approved, and the notice. Budget 3 to 4 hours. Fallback: show a borrower panel on the left third of the second screen.
- Move the deceased check into code if an LLM decides it today.
- Add the judge override path: an Override button on a hard stop that the system refuses.
- Build replay mode for all 20 personas.
Saturday.
- By noon: fill each card with its sandbox identity name, a story, and a loan ask. Export the print PDF from the card design.
- Between 9:00 AM and 6:00 PM: print at FedEx Office Marina, 3225 Fillmore St, San Francisco. It is the closest location to the Palace of Fine Arts. Its Sunday hours start at noon (FedEx). Order color on heavy cardstock, and ask the staff to trim on their cutter.
- Print two full decks, two spare deceased cards, and one spare clean card.
- Record the Devpost video. Use the experience script below.
- Rehearse five times with a stopwatch.
Sunday.
- Be at the venue by 8:00 AM. Check-in is required to submit.
- Submit on Devpost by 9:00 AM with the image, repo, video, and every prize track selected.
- Pack: the demo phone and its charger, HDMI and USB-C adapters, a phone hotspot, both decks.
## Setup and roles
Presenter A talks to the judges. Presenter B drives the laptop. The second screen faces the judges and shows only the board.
| Who or what | Position | Job |
| Presenter A (Pitch) | Stands beside the second screen | Talks, holds the persona deck, holds the timer, answers legal and fairness questions |
| Presenter B (Driver) | Sits at the laptop | Types the persona ID, clicks Approve, switches views, answers technical questions |
| Laptop | Faces B | Operator console: input form, Approve button, Reset button, Replay toggle |
| Second screen | Faces the judges | The board, full screen. No browser tabs, no notifications, no dock |

Demo phone: one team phone, charged, on your hotspot, with the borrower view open. A hands it to the judge. The judge holds it for the whole pitch.
Working name: the designs use UNDERWRITE as a placeholder wordmark. Replace it with your product name everywhere.
Designs: the Underwrite Persona Deck canvas holds the theme sheet, the print sheets for the card fronts and backs, both phone screens, and the hard-stop board. Every surface uses one theme: aluminum-gray ground, black ink, signal orange for the mark and the hard stop, blue for approved, wide uppercase headlines, and mono figures. The deck has 20 cards on four Letter sheets, six per sheet, with 2.5 × 3.5 in cards. That leaves four spare slots: two deceased copies, one clean backup, and one extra.
Terms used in this doc:
- Adverse-action notice (AAN): the letter a lender must send when it denies credit. It states the reasons and the applicant's rights.
- Hard stop: a coded rule that ends the application before any lender agent sees the file.
- Persona card: one printed card with one test applicant from the CRS sandbox. Each card shows a large persona ID.
- Replay: a recorded run of one persona, played back at the original speed.
Fill these placeholders before the first judge arrives:
- [Product name], [team name]
- [X/20] eval pass rate, the eval run time, and the commit hash
- [Lender 1/2/3 names] and the one-line policy of each
- [N] seconds for the lender timeout
Assumptions I made. Fix them if they are wrong:
- All persona data comes from CRS sandbox test identities. No real person's data is on screen.
- The deceased stop is a coded rule, not an LLM decision. If the compliance agent decides it today, move it into code tonight. Judges will ask.
- A human clicks Approve for every offer and every notice.
## Experience script
The judge does not watch a demo. The judge lives it: first as a borrower on a good day, then as a borrower the bureau thinks is dead, then as the human who must sign off. Every technical point rides on something the judge just did with their own hands. Research backs this: judges remember a person's experience walked through end to end more than a feature list (Builder's Guide), and a demo that stalls loses to a simpler one that runs (JetBrains).
The arc has four beats:
- A good day (0:00–1:10). The judge draws a card, becomes that person, and gets real offers on a phone.
- A bad day (1:10–1:38). The judge becomes the deceased-file persona. The board goes red. Nobody gets an offer.
- You are the human (1:38–2:15). The judge tries to override the stop, gets blocked, then sends the letter and reads it aloud.
- Proof (2:15–3:00). The deck in front of them is the test suite. Then one line on real rails.
J = the judge. A = Pitch. B = Driver.
| Time | Who | Says (or does) |
| 0:00 | A | "Nearly one in ten American adults carries a personal loan. When a lender says no, you get a letter that tells you almost nothing. For the next two minutes, you're not a judge. You're a borrower." |
| 0:12 | A | Fans the deck. "Draw a card. Read your name out loud." J reads the name. |
| 0:20 | A | Hands J the demo phone. "This is your phone now. Type the code on your card." Phone: "Hi [name]. You need $[ask] for [reason]." |
| 0:28 | B | J taps Find my offers. B points at the board. "That tap pulled your credit file from Experian through CRS. It's a soft pull, so it doesn't touch your score." Say "soft pull" only if your endpoint is the prequal one. |
| 0:40 | A | Offers stack in on the phone. "Three AI lenders, three different credit policies, all bidding for you on the same file." |
| 0:55 | A | "Pick the one you want." J taps an offer. The board shows "Escalated to underwriter." |
| 1:00 | B | "Nothing funds until a human signs. Right now that's me." B approves. The phone shows APPROVED. |
| 1:10 | A | Takes the phone back. Hands J the deceased card. "That was a good day. Here's a bad one. You're [name] now." J types the code. |
| 1:20 | A | The board goes red. The phone says "We couldn't approve your request." A: "The bureau says you're dead." Pause one second. "You just applied. So it's fraud, or the bureau got it wrong." |
| 1:30 | B | "A rule in code stopped this, not the model. No lender ever saw your file. Zero offers." |
| 1:38 | A | The phone flips to reviewer mode. "Now you're the human in the loop. Try to fund it anyway." J taps Override. |
| 1:45 | B | The board shows "Override blocked: fraud review required. Logged." B: "Every action lands in the audit log, including yours." |
| 1:55 | A | "Send the letter instead." J taps Approve notice. The notice opens on the phone. "Read the first line." J reads it. |
| 2:05 | A | "If you're alive, this letter is how you find out. It names the reason, the bureau to call, your free report, and your right to dispute." |
| 2:15 | A | Taps the deck. "This deck is our test suite. All 20 people in it run on every build." B switches the board to the eval panel. |
| 2:25 | A | "We pass [X] of 20. The ones we fail are [five words]. We show them on purpose." |
| 2:35 | B | "The CRS sandbox uses the production schema. Real lenders plug in through marketplace APIs. Agents do the work, humans make the calls, and every step is logged." |
| 2:50 | A | "We're [team]. Ask us what breaks." Stop. Leave 10 seconds of buffer. |

If the judge draws the deceased card first. Run beats 2 and 3 first. At 1:38, A says "Now a good day" and hands over the spare clean card. Beat 4 stays at 2:15.
If two judges come together. One judge is the borrower. Hand the reviewer moment (1:38) to the other judge.
Cut rules.
- If offers are not on the phone by 0:55, A says "Offers are still coming in" and goes to the bad day.
- If the clock shows 2:20 and the eval panel is not up, skip to the 2:25 line.
- Cut the 2:05 line first if the pitch runs long.
## Judge questions
Each answer is about 50 words, or 20 seconds spoken. Lead with the direct answer. Say only what is true of your build tonight. Brackets mark the facts you must fill.
1. Legal: "Is it legal for an AI to deny credit? Who is liable?" (A answers)
"The AI never makes the final call. A human approves every offer and every notice. The notice follows ECOA and FCRA: specific reasons, the bureau's contact, free-report and dispute rights. Regulation B says "internal standards" or a failed score is not a reason. So our reasons come only from bureau factor codes and policy rule IDs."
Do not cite CFPB Circular 2022-03. The CFPB withdrew it in May 2025 (NCLC). Cite Regulation B itself, 12 CFR 1002.9(b)(2), which still stands (CFPB). If a judge asks how one letter covers three lenders: Regulation B lets one third-party notice cover several creditors. It must name each creditor and show which reasons belong to which one (1002.9(g)).
2. Fairness: "How do you know it isn't biased?" (A answers)
"Twenty personas do not prove fairness. We say that plainly. The lender agents never see name, sex, race, or ZIP code. The eval fails any reason that mentions a protected attribute. Our next step is paired tests: two personas identical except one proxy field must get the same decision."
Say the ZIP line only if it is true. If ZIP goes to the agents, remove it tonight.
3. "Where are the real lenders?" (A answers)
"There are none today. The three lenders are agents with written credit policies: score cutoffs, debt-to-income limits, loan caps. The bureau data is a real sandbox response. To go live, a lender gives us its policy file and pricing grid, or we connect a lender marketplace API such as Engine by MoneyLion. The agent changes; the console stays."
If they push on licensing: a loan marketplace needs state broker or lead-generation licenses. Name that as a known cost.
4. "Why agents? Why not a rules engine?" (B answers)
"The decisions are rules. The agents do the work around the rules. They read a messy bureau file, apply a policy written in plain language, and map the result to reason codes. Hard stops like deceased are plain code. A rules engine gives you 'DENY 4.2.1'. We give the reviewer a reason they can check."
5. "What breaks?" (B answers)
"Three things. One: the LLM invents a reason. We allow only listed reason codes, and the eval fails anything else. Two: a lender agent hangs. It times out after [N] seconds and the others finish. Three: mixed files with two people's data. We flag those for the human. We do not auto-decide them."
Backup one-liners.
- "Is the credit data real?" CRS sandbox test identities. No real consumer data.
- "Soft pull or hard pull?" [Fill with the true answer.] A prequalification flow should use a soft pull.
- "What if the deceased flag is wrong?" The notice tells the applicant to dispute it with the bureau. That is the correction path. We also flag the file for fraud review.
- "Who would buy this?" [Fill: for example, small lenders and credit unions that want faster underwriting with a compliance trail.]
- "How fast is one decision?" [Median seconds from the eval run.]
- "Which model?" [Model name, temperature setting.]
## Real-world proof
Every stage of the console has a real counterpart that exists today. Use one row per question; do not recite the table.
| Point | Fact | Source |
| The market is large | Unsecured personal loan balances hit a record $281 billion in Q2 2026, up 9.6% year over year. | TransUnion Q2 2026 release |
| The hook line is true | Nearly one in ten US adults carried at least one unsecured personal loan at the end of Q2 2026. | The Financial Brand |
| The credit rail is real | The CRS sandbox uses synthetic data, but its endpoints, response formats, and schema match production. | CRS sandbox tour |
| The lender rail is real | Engine by MoneyLion runs an API that returns pre-qualified personal loan offers from its lender network. A review counts over 300 lending partners and a soft-pull prequalification. | Engine API docs, Finder |
| The notice has law behind it | Regulation B requires a written notice with specific principal reasons. "Internal standards" is not a reason. An automatic-denial factor must be named. One third-party notice may cover several creditors. | 12 CFR 1002.9 |
| The deceased stop matters | A 2012 ID Analytics study estimated that about 2.5 million deceased Americans' identities go into credit applications each year. The figure is old; say "a 2012 study." | CNN Money |
| The flag can be wrong | A Social Security deceased indicator covers the whole credit report. A living person must send Experian a notarized letter to remove it. | Experian |

What is still simulated: the three lenders are agents with written policies, no money moves, and every applicant is a sandbox identity. Say this first if a judge asks; it earns trust for everything else.
## Failure modes
The two most likely failures are slow venue wifi and LLM rate limits, because every team hits the same APIs during judging. Build replay mode tonight. If you use replay live, say so out loud. A judge who catches a fake live demo marks you down more than a judge who hears "this is a recording."
| Failure | Prevent it (before the pitch) | Recover (during the pitch) |
| Venue wifi drops or slows | Test a phone hotspot now. Set up a second hotspot on a different carrier. Record a replay of all 20 personas. | B presses the Replay hotkey. A says: "The wifi is down. This is a recording of this exact card." |
| LLM API slow or rate-limited (HTTP 429) | Use your own API key, not a shared team key. Cap output tokens. Stream every response. Send one warm-up call before each pitch. | A talks over the bureau column while offers load. At 1:10, A moves on. |
| CRS sandbox slow or down | Cache each persona's bureau response by ID. Show a small "cached" tag when the cache serves it. | B switches to the cache. A does not stop. |
| One lender agent hangs or errors | Set a [N]-second timeout per lender. Render a "No response (timeout)" card. | A points at it: "That's the timeout path. The other two lenders still finished." |
| Judge draws the deceased card first | Use the branch in the script. A carries a clean backup card. | Run the deceased card first, then the clean card. |
| Judge draws a card that fails the eval | Know which [20–X] personas fail. Decide tonight: keep them in the deck or remove them. If you remove them, say so when asked. | A says: "That's one of our known failures." B opens its eval row. |
| Judge wants to type a made-up applicant | Test free entry tonight with five edge inputs (empty fields, a name with an apostrophe, a $0 income). If any input breaks it, hide free entry. | A says: "Yes, in questions." Do it only if free entry passed your test. |
| B mistypes the persona ID | Enter by card ID with autofill. Show the name and ID on the board before the bureau call starts. | B clicks Reset and enters the ID again. |
| Old state from the previous judge | Make Reset clear every panel. B clicks Reset after every pitch. | B clicks Reset before the card goes in. |
| Second screen not detected, mirrored, or wrong size | Bring an HDMI adapter and a USB-C adapter. Save the display layout. Test at your table before judging starts. | Mirror the display. Put the board full screen. Turn the laptop toward the judges. |
| Laptop sleeps, battery dies, or a notification pops up | Plug in power. Turn off sleep. Turn on Do Not Disturb. Quit Slack, Discord, and Messages. | B dismisses it without comment. |
| Pitch runs long | A holds a visible 3:00 timer. Rehearse five times with a stopwatch. | Use the cut rules in the script. |
| Notice is wrong or misses an element | Fill the required elements from a template. Let the LLM write only the reason sentence. The eval checks every element. | A reads the checked elements, not the prose. |
| Eval numbers disagree with the live run | Show the eval run time and commit hash on the panel. Run live demos on that same commit. | B says: "LLM output varies run to run. The eval runs each persona [K] times." Say this only if true. |
| Real-looking personal data on screen | Mask SSNs to the last four digits. Put a "SANDBOX" label on the board. | No live recovery. Fix it before judging. |
| Judges cannot hear in a loud hall | A stands between the judges and the screen. Use large type. One person speaks at a time. | A steps closer and drops the 1:00 line. |
| Demo phone loses network, or the judge leaves the page | Put the phone on your hotspot. Lock rotation. Turn on Guided Access (iPhone) or screen pinning (Android) so the judge cannot leave the page. | B runs the same step from the laptop console. A says: "Let's do this one from the console." |
| Judge types the wrong card code | Use 4-character codes with no 0, O, 1, or I. Show the persona name on the phone before the pull starts. | The phone says "No card with that code." The judge types it again. |

Before each judge (60 seconds):
- B clicks Reset. The board is empty.
- B sends one warm-up call. It returns in under [N] seconds.
- B confirms the Replay hotkey works.
- The second screen shows the title card, full screen.
- A shuffles the deck. The deceased copy and the clean backup card are in A's pocket.
- A sets the timer to 3:00.
## Run sheet
The phone shows what the borrower feels. The second screen shows what the lender floor does. Both update from the same event, so a tap on the phone visibly lands on the board within a second. The laptop keeps the operator controls (Approve, Reset, Replay) out of the judges' view.
| Time | Phone (in the judge's hand) | Second screen (lender floor) | Trigger |
| 0:00–0:20 | Lock screen with the wordmark | Title: wordmark, pipeline strip, blinking cursor | Already up |
| 0:20–0:28 | Code entry, then "Hi [name]. You need $[ask] for [reason]." | Applicant header appears: name, card code, SANDBOX tag | J types the code |
| 0:28–0:40 | "Checking your offers" with a progress line | Bureau column fills: score, tradelines, utilization, inquiries, flags | J taps Find my offers |
| 0:40–0:55 | Offers arrive one at a time: lender, APR, monthly payment | Three lender columns stream their reasoning and the policy rule each one used | Automatic |
| 0:55–1:10 | "Waiting for underwriter," then APPROVED | "Escalated to underwriter," then an approval stamp with name and time | J picks; B approves |
| 1:10–1:30 | "Checking your offers" again, then "We couldn't approve your request" | Red banner: DECEASED INDICATOR, HARD STOP, rule ID. Lender columns stay dark: "Not sent." Offers: 0 | J types the deceased code |
| 1:38–1:55 | Reviewer mode: Approve notice and Override and fund | "Override blocked: fraud review required. Logged." The audit log scrolls in a side strip. | J taps Override |
| 1:55–2:15 | The notice, in plain language, with the three fix steps | Notice checklist: reason, bureau contact, free report, dispute right, ECOA notice, each ticked | J taps Approve notice |
| 2:15–3:00 | Phone back with A | Eval panel: large [X]/20, 20 rows, failures on top in red, run time and commit hash | B switches view |
| 3:00–5:00 | Phone on the table, notice still open | Eval panel by default. B opens the policy file, the reason-code list, or the audit log on demand. | B, per question |

## Sources
- Cal Hacks 13.0 on Devpost: judging criteria, prizes, deadlines
- CRS Financial Intelligence Challenge: CRS prizes, judging, sandbox
- CRS at SF Hacks 2026: sandbox setup and test cases in the Postman collection
- Hyphenate: what the finance-agent track sponsor builds
- 12 CFR 1002.9, Regulation B notifications
- NCLC on Circular 2022-03: withdrawn May 12, 2025
- The Financial Brand on TransUnion Q2 2026
- TransUnion Q2 2026 release
- CRS sandbox tour
- Engine by MoneyLion API reference and Finder review
- CNN Money on the ID Analytics study (2012)
- Experian on deceased indicators
- FedEx Office Marina
- JetBrains: notes from the judging table and Builder's Guide ch. 14