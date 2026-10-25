# Pitch cards: 3-minute script

A = Pitch, holds the deck and the timer. B = Driver at the laptop. The judge holds the phone at `#/borrower`. The second screen shows `#/board`. Before each judge: B resets, sends one warm-up call, A sets the timer to 3:00.

## Script
| Time | Who | Says or does |
|---|---|---|
| 0:00 | A | "Nearly one in ten American adults carries a personal loan. When a lender says no, the letter tells you almost nothing. For two minutes you are a borrower." |
| 0:12 | A | Fans the deck. "Draw a card. Read your name out loud." |
| 0:20 | A | Hands over the phone at #/borrower. "Type the four digits on your card." Phone: "Hi [name]. You need $[ask] for [reason]." |
| 0:28 | B | Judge taps Find my offers. "That pulled your file from all three bureaus, TransUnion, Equifax and Experian, through CRS. It is a soft pull, so it does not touch your score." |
| 0:40 | A | Offers stack in. "Five lenders, five written policies, one file. Scores are VantageScore." |
| 0:55 | A | "Pick the one you want." Board shows the escalation. The console ranks the queue, best offer first. |
| 1:00 | B | "Nothing funds until a person signs. Right now that is me." B approves. Phone shows APPROVED. |
| 1:10 | A | Hands over the deceased card. "Here is a bad day. You are [name] now." Judge types the code. |
| 1:20 | A | Board goes red. "The bureau says you are dead. You just applied, so it is fraud or the bureau is wrong." |
| 1:30 | B | "A rule in code stopped this, not the model. No lender saw your file. Zero offers." |
| 1:38 | A | Phone flips to reviewer mode. "Try to fund it anyway." Judge taps Override. |
| 1:45 | B | "Override blocked and logged. Every action lands in the audit log, including yours." |
| 1:55 | A | "Send the letter instead." Judge taps Approve notice and reads the first line. |
| 2:05 | A | "This letter names the reasons, the bureau, your free report and your right to dispute. Every reason in a decline letter was tested: we changed that one factor and the decision changed." (Cut this line first if long.) |
| 2:15 | A | Taps the deck. "This deck is our test suite." B switches the board to the eval panel. |
| 2:25 | A | "We agree with our answer key on 20 of 20, and we score each lender against its own expected outcome [check: figure on the five-lender board]. The lenders are agents with written policies, no money moves, and every person here is a sandbox test persona." |
| 2:35 | B | "The CRS sandbox uses the production schema. A real lender swaps in its own policy file. Agents do the work, humans make the calls, every step is logged." |
| 2:50 | A | "We are Swaraj and Matthew. Ask us what breaks." Stop. |

If the judge draws the deceased card first, run the 1:10 to 2:05 beats first and hand over the clean backup card at 1:38. If offers are not on the phone by 0:55, say "Offers are still coming in" and go to the bad day. If the wifi is down, press Replay and say "This is a recording of this exact card."

## Five judge answers
1. Legal (A): "Is it legal for an AI to deny credit? Who is liable?" "A human approves every offer and every notice. The notice follows ECOA and FCRA: specific reasons, the bureau named as not having made the decision, free report and dispute rights. Regulation B, 12 CFR 1002.9, says internal standards are not reasons, so ours come from bureau fields and policy rules, and we tested each one." If asked about one letter for three lenders: Regulation B allows a joint notice if it names each creditor and which reasons are whose (1002.9(g)). Do not cite CFPB Circular 2022-03; it was withdrawn in 2025.
2. Fairness (A): "How do you know it isn't biased?" "We do not know. Twenty personas do not prove fairness, and we say so. The agents never receive name, address, ZIP, SSN, date of birth, phone or email, and that is a tested allowlist. Criminal records are not used. Next step is paired tests: two personas identical except one proxy field must get the same decision."
3. Real lenders (A): "Where are the real lenders?" "There are none. The five lenders (a credit union, a fintech, a prime bank, a regional bank, a second-chance lender) are agents with written policies: score cutoffs, utilization limits, income caps, lien rules. The bureau data is a CRS sandbox response. To go live, a lender gives us its policy file and pricing grid, or we connect a marketplace API. The agent changes; the console stays. A marketplace needs licenses, and we know that."
4. Why agents (B): "Why not a rules engine?" "The hard stops are rules, and they are plain code. The agents read a messy bureau file, apply a policy written in plain language, and give reasons tied to a field. Then we test those reasons by changing the field. The underwriters and compliance run as six hosted CREAO agents, with Claude (claude-haiku-5-5 for underwriters, claude-sonnet-5-5 for compliance) as the other provider, and structured output validated by a schema."
5. What breaks (B): "Three things. The model pads or invents a reason: we re-run the lender with that factor fixed and withhold reasons that do not change the decision. [check: share of reasons verified on the latest five-lender eval; 81% was the earlier figure]. A lender hangs: it times out after 20 seconds and the other four finish. Hosted CREAO runs take about 23 to 33 s per lender. A bad bureau file: the stop rules fire in code. Fields excluded from agent input are name, address, ZIP, SSN, birth date, phone, email and raw bureau data."

Backup lines: Is the data real? CRS sandbox test identities, no real consumers. Soft or hard pull? Soft, the prequal endpoints. Median speed? Underwriter latency: about 3 s on direct Claude, 23 to 33 s per lender on CREAO [check which provider is live]. Where is the audit trail? The desk assistant summarizes it from the log. Who would buy this? Small credit unions that want a compliance record and tested reasons.

## Placeholders still open
- [check] Eval figures on the five-lender cloud deployment (agreement, per-lender agreement, reasons verified, latency)
- [check] Commit hash and run time on the board (GIT_SHA must be set on the deployment)
- [check] Whether the demo runs live CRS or captured responses (CRS_PROVIDER); say which
- [check] Whether CREAO or direct Claude is the live provider (AGENT_PROVIDER_*)
- [check] Cloud replay recordings were made with three lenders; re-run eval:recordAll
- Names on the cards: [name], [ask], [reason] come from each persona card


**Q: What happens when a hosted agent fails or stalls?**
Schema-gated provider failover. Every reply is validated against the same schema regardless of provider. If a CREAO run comes back as prose, fails validation, or misses the 90-second window, that lender or the notice is re-run on Claude, the failed row is dropped, and the audit trail says so. The judge sees the same record either way.
