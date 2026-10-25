#!/usr/bin/env python3
"""Build docket-deck-v4.pptx: the 12-slide pitch deck as native, editable text boxes and tables.

Glance-first style (same as build_benchmarks.py): the title is the spoken line, each point is one bold
line you can say, and the small grey line under it is the backing detail for Q&A. Sources live in the
speaker notes (notes.json plus the IF ASKED lines below), not on the face of the slides.

v4 keeps the team's wording edits from docket-deck-v3.pptx in Drive (problem title, stack title and two
stack rows, "final call" on the human slide, shorter claim on the problem slide) and uses the Oct 24
21:26 cloud eval on the eval slide. Layout helpers live in deck_kit.py.

Usage: python3 design/deck/pitch/build_native.py
"""
import json
import deck_kit
from deck_kit import *
from deck_kit import _border, _noborder

OUT = HERE / "docket-deck-v4.pptx"
NOTES = json.loads((HERE / "notes.json").read_text())["slides"]

SAY = {"bold": True, "size": 13}
SAY_GO = {"bold": True, "size": 13, "color": GO}
DETAIL = {"size": 10, "color": MUTE}
DETAIL_M = {"size": 9, "color": MUTE, "font": MONO}

def point(say, detail, docket=False, say_opts=None):
    return [[(say, say_opts or (SAY_GO if docket else SAY))], [(detail, DETAIL)]]

def stacked(slide, x, y, w, items, gap=0.62, head=13, sub=10):
    """Vertical list of bold lines with a grey detail line each. items: (head, detail)."""
    yy = y
    for h, d in items:
        text(slide, x, yy, w, 0.3, h, size=head, bold=True)
        if d: text(slide, x, yy + 0.29, w, 0.4, d, size=sub, color=MUTE, line_spacing=1.1)
        yy += gap
    return yy

IF_ASKED = {
    2: "Regulation B, 12 CFR 1002.9(b)(2): 'internal standards or policies' is not a sufficient reason. FCRA section 615(a) requires naming the consumer reporting agency, the free report and the right to dispute.",
    3: "Code: convex/desk.ts (runDesk workflow), rules.ts, verify.ts, classify.ts, pii.ts. The next six slides take one layer each.",
    4: "convex/crs.ts (live sandbox) and convex/pii.ts (allowlist projection, tested). 20 personas captured in convex/fixtures/crs. The sandbox's TransUnion product returns VantageScore 4; the UI says 'TransUnion score'. Fields: credit.fico9, utilization, inquiries6mo, vantage4, flags.frozen, identity.verified, flags.deceased, fraud.score, flags.bankruptcy, flags.eviction, flags.lienOrJudgment.",
    5: "convex/rules.ts (8 unit tests) and desk:attemptOverride. Persona P14 (deceased indicator) is the demo card.",
    6: "Policies are the literal prompt each agent receives: policies/{prime,regional,cu,fintech,subprime}.md. P18 outcome from personas/map.json. On CREAO, an unusable reply is re-run on Claude.",
    7: "convex/verify.ts and the reasonChecks table. Single-field flip first; leave-one-out for jointly sufficient reasons, gated by an all-fixed sanity run. Verification runs before the notice is written.",
    8: "convex/classify.ts; desk:disputeTradeline replays the file. The notice is written by claude-sonnet-5-5 with the applicant's name inserted by code. Replay figures on the slide are illustrative.",
    9: "convex/desk.ts, crons.ts, http.ts; web/ (Vite + React) routes #/board and #/borrower; live at docket-sepia-ten.vercel.app. Claude lender p50 about 3 s; on CREAO about 20 s per lender.",
    11: "Cloud eval Oct 24 21:26: 20 personas x 5 lenders on CREAO with Claude fallback, scored against personas/map.json. 4 lender misses are Harbor cells where the key used a different loan amount. 85/85 lender answers valid (4 via fallback). Earlier Claude-direct run (09:31, 3 lenders): 20/20, 60/60, 84%.",
}

def slide(i, hidden=False):
    n = NOTES[i - 1] + (("\nIF ASKED: " + IF_ASKED[i]) if i in IF_ASKED else "")
    return new_slide(i, hidden, notes=n)

# ---------------------------------------------------------------- 1 Cover
s = slide(1)
wordmark(s, L, 2.75, 48)
text(s, L, 3.45, 10.5, 0.7, "One loan officer leading a whole lending desk of agents.", size=28, bold=True, line_spacing=1.15)
text(s, L, 4.3, 8.2, 0.8, "A one-person credit union. Six layers, one workflow: code decides what agents may see, agents decide inside written policies, a person signs.", size=14, color=MUTE, line_spacing=1.3)
label(s, L, H - 0.72, 5, "Cal Hacks 13.0 · October 2026")
text(s, W - R - 6, H - 0.72, 6, 0.25, "SWARAJ ADHIKARI, UCLA · MATTHEW PUN, UC BERKELEY", size=9, color=MUTE, font=MONO, align=PP_ALIGN.RIGHT)

# ---------------------------------------------------------------- 2 Problem
s = slide(2)
frame(s, "When a lender says no, the letter tells the borrower NOTHING!", 0, 2)
box(s, L, 1.95, 5.7, 1.5, fill=PANEL, line=HAIR)
label(s, L + 0.25, 2.1, 5, "A typical decline letter")
text(s, L + 0.25, 2.4, 5.2, 0.95, [[("We are unable to approve your application at this time.", {})], [("Reason: ", {}), ("internal standards.", {"bold": True, "color": SIGNAL})]], size=15, line_spacing=1.3)
text(s, L, 3.7, 5.7, 0.4, "That isn't a reason, and the law says so.", size=15, bold=True)
text(s, L, 4.08, 5.7, 0.4, "Regulation B rules out \"internal standards\" as a reason for a no.", size=10, color=MUTE)
x2 = L + 6.2; w2 = CW - 6.2
label(s, x2, 1.95, w2, "What the law requires instead")
stacked(s, x2, 2.25, w2, [("The real reasons", "Specific to this file"), ("Who supplied the data", "And that they didn't make the decision"), ("A free report and the right to dispute", "")], gap=0.6)
label(s, x2, 4.15, w2, "Why it's hard")
stacked(s, x2, 4.42, w2, [("Nobody checks the reasons", "Asked to explain a no, an AI pads the letter with true but irrelevant facts")])
takeaway(s, L, 5.75, CW, [("Docket's claim: a lending desk where every reason in the letter has been tested", B)], size=14, h=0.55)

# ---------------------------------------------------------------- 3 Stack overview
s = slide(3)
frame(s, "Docket is a six-layer workflow: code decides what agents may touch, agents decide inside policies, and a person only needs a quick finalization.", 0, 3)
WHO = {"Code": (None, INK), "Agent": (GO, PAPER), "Human": (SIGNAL, INK)}
rows = [["", "Layer", "What it guarantees", "Who decides"],
        [[("1", DETAIL_M)], [("Credit pull", B)], point("Every lender sees the same file, with no identity in it", "One soft pull. No name, address, ZIP or SSN ever reaches a model."), "Code"],
        [[("2", DETAIL_M)], [("Hard stops", B)], point("Risky files stop before any AI sees them", "Deceased, unscorable, identity fail or fraud ≥ 80"), "Code"],
        [[("3", DETAIL_M)], [("Underwriters ×5", B)], point("Five lenders decide in parallel", "Five written policies. Prices come from policy instead of agents."), "Agent"],
        [[("4", DETAIL_M)], [("Verify", B)], point("Every reason is tested", "Each denial reason is re-tested by flipping only that field. Mistaken reasons that don't change the decision are withheld."), "Code"],
        [[("5", DETAIL_M)], [("Notice", B)], point("The letter uses only tested reasons", "Offer, counteroffer or decline is classified in code"), "Agent"],
        [[("6", DETAIL_M)], [("Human", B)], point("A person makes the final call", "Nothing funds until the loan officer signs. Override is refused and logged."), "Human"]]
table(s, L, 1.95, CW, [(0.45, "mono"), (2.1, "sans"), (7.95, "sans"), (1.5, "mono")], rows, size=12, row_h=0.62)
tbl = s.shapes[-1].table
for ri in range(1, 7):
    c = tbl.cell(ri, 3); fill, col = WHO[rows[ri][3]]
    r = c.text_frame.paragraphs[0].runs[0]; r.font.color.rgb = rgb(col); r.font.size = Pt(9)
    if fill: c.fill.solid(); c.fill.fore_color.rgb = rgb(fill)
    else:
        for side in ("lnL", "lnR", "lnT", "lnB"): _border(c, side, INK, 0.75)
    c.margin_left = Inches(0.08); c.vertical_anchor = MSO_ANCHOR.MIDDLE
text(s, L, 6.35, CW, 0.5, [[("Convex runs it all as one workflow.", B), ("  Every step is an audit row; the phone and the judge board update live.", DETAIL)]], size=13)

# ---------------------------------------------------------------- 4 Data
s = slide(4)
frame(s, "Layer 1: one soft pull from the CRS Credit API gives every lender the same file, and the file an agent sees has no identity in it.", 1, 4)
rows = [["What we pull", "What comes back", "Fields the policies use"],
        [[("Three bureaus", B)], [("Score, tradelines, inquiries, utilization from TransUnion, Equifax and Experian. A freeze at one bureau is a flag, not a stop.", DETAIL)], [("credit.fico9 · vantage4 · utilization · inquiries6mo · flags.frozen", DETAIL_M)]],
        [[("Identity", B)], [("Verified or not; SSN belongs to a deceased person", DETAIL)], [("identity.verified · flags.deceased", DETAIL_M)]],
        [[("Fraud screen", B)], [("Risk score 0–100 and signals", DETAIL)], [("fraud.score", DETAIL_M)]],
        [[("Public records", B)], [("Bankruptcy, eviction, unsatisfied lien or judgment", DETAIL)], [("flags.bankruptcy · eviction · lienOrJudgment", DETAIL_M)]]]
table(s, L, 1.95, 7.2, [(1.7, "sans"), (3.2, "sans"), (2.3, "sans")], rows, size=12, row_h=0.62)
x2 = L + 7.6; w2 = CW - 7.6
box(s, x2, 1.95, w2, 1.6, fill=PANEL, line=HAIR); label(s, x2 + 0.2, 2.07, w2, "Reaches the AI")
stacked(s, x2 + 0.2, 2.35, w2 - 0.4, [("Scores, flags and the loan request", "Utilization, inquiries, identity and fraud results, purpose, amount, income")], gap=0.6)
box(s, x2, 3.7, w2, 1.6, line=HAIR, dashed=True); label(s, x2 + 0.2, 3.82, w2, "Never reaches a model")
stacked(s, x2 + 0.2, 4.1, w2 - 0.4, [("Name, address, ZIP, SSN", "Also date of birth, phone, email, raw bureau data, criminal records")], gap=0.6)
takeaway(s, L, 5.75, CW, [("Same file for every lender, no identity in it, in about 3 seconds, and the borrower's score doesn't move.", B)], size=14, h=0.55)

# ---------------------------------------------------------------- 5 Hard stops
s = slide(5)
frame(s, "Layer 2: four conditions end an application in code before any model sees the file, and an override attempt is refused and logged.", 2, 5)
rows = [["Stops when", "Rule in code"],
        [point("The bureau says the applicant died", "A model can be argued with. A rule can't."), [("flags.deceased", DETAIL_M)]],
        [point("Every bureau file is frozen", "Nothing to underwrite until the freeze lifts"), [("flags.frozen + no score", DETAIL_M)]],
        [point("Identity doesn't match the file", "Possible synthetic identity; zero lenders asked"), [("identity.verified = false", DETAIL_M)]],
        [point("Fraud score is 80 or higher", "Lenders also set lower limits in their own policy"), [("fraud.score ≥ 80", DETAIL_M)]]]
table(s, L, 1.95, 6.9, [(4.6, "sans"), (2.3, "sans")], rows, size=12, row_h=0.72)
x2 = L + 7.3; w2 = CW - 7.3
box(s, x2, 1.95, w2, 3.25, fill=PANEL, line=HAIR)
box(s, x2 + 0.2, 2.15, w2 - 0.4, 0.62, fill=SIGNAL)
text(s, x2 + 0.35, 2.17, w2 - 0.7, 0.58, "Hard stop: the bureau says this person died. They just applied.", size=12, bold=True, anchor=MSO_ANCHOR.MIDDLE)
for k, (n, lab) in enumerate([("0", "Lenders contacted"), ("0", "Offers")]):
    bw = (w2 - 0.55) / 2; bx = x2 + 0.2 + k * (bw + 0.15)
    box(s, bx, 2.95, bw, 0.95, fill=PAPER, line=HAIR)
    text(s, bx + 0.15, 2.97, bw, 0.6, n, size=30, bold=True, font=MONO)
    label(s, bx + 0.15, 3.57, bw, lab, size=8)
text(s, x2 + 0.2, 4.05, w2 - 0.4, 0.35, "Override: refused and logged", size=13, bold=True)
text(s, x2 + 0.2, 4.38, w2 - 0.4, 0.6, "The judge taps Override; the desk records who, when and why, and sends the notice instead.", size=10, color=MUTE, line_spacing=1.15)
takeaway(s, L, 5.75, CW, [("The riskiest decisions are the ones the AI never gets to make.", B)], size=14, h=0.55)

# ---------------------------------------------------------------- 6 Underwriters
s = slide(6)
frame(s, "Layer 3: five lender agents apply five written policies to the same file in parallel, so one applicant gets five independent answers.", 3, 6)
no = [("Decline", {"size": 12, "color": MUTE})]
yes = lambda t: [(t, {"bold": True, "size": 12, "color": GO})]
rows = [["Lender", "Who they lend to", "Min score · max util · max loan · APR", "P18, score 650"],
        [[("Meridian Bank Prime", B)], [("The strongest files only", SAY)], [("720 · 30% · $100k · 6.49–8.49%", DETAIL_M)], no],
        [[("Cascade Regional Bank", B)], [("Clean, established files", SAY)], [("680 · 45% · $50k · 7.25–11.25%", DETAIL_M)], no],
        [[("Pacific Ridge Credit Union", B)], [("Conservative members", SAY)], [("660 · 50% · $35k · 7.90–12.90%", DETAIL_M)], no],
        [[("Northstar Lending", B)], [("Near-prime and thin files", SAY)], [("600 · 80% · $25k · 10.90–29.90%", DETAIL_M)], yes("Approve 21.90%")],
        [[("Harbor Second Chance", B)], [("People rebuilding credit", SAY)], [("560 · 90% · $20k · 23.90–35.90%", DETAIL_M)], yes("Approve 27.90%")]]
table(s, L, 1.95, CW, [(3.0, "sans"), (3.6, "sans"), (3.7, "sans"), (1.7, "sans")], rows, size=12, row_h=0.5)
text(s, L, 5.0, CW, 0.55, [[("Same applicant, five answers: three declines and two offers.", B)], [("Prices come from each policy's grid by score band, and the borrower picks the cheapest yes.", DETAIL)]], size=13, line_spacing=1.2)
takeaway(s, L, 5.9, CW, [("The AI can't set prices. It decides yes, no or counteroffer, and must name the field behind each reason.", B)], size=14, h=0.55)

# ---------------------------------------------------------------- 7 Verify
s = slide(7)
frame(s, "Layer 4: every denial reason is tested by changing only that field and re-running the lender; reasons that do not flip the decision are withheld.", 4, 7)
label(s, L, 1.95, 8, "Example · Meridian Bank Prime declines persona P17, $22,000 for solar panels")
rows = [["Reason the AI gave", "Change only that field", "Re-run the lender", "In the letter?"],
        [[("3 hard inquiries in six months", B)], [("inquiries 3 → 0", DETAIL_M)], [("Decision flips to approve", DETAIL)], [("Kept", {"bold": True, "size": 13, "color": GO})]],
        [[("TransUnion score 760", B)], [("score 760 → 780", DETAIL_M)], [("Still declined", DETAIL)], [("Withheld", {"bold": True, "size": 13, "color": MUTE})]]]
table(s, L, 2.25, 7.8, [(2.8, "sans"), (1.9, "sans"), (1.9, "sans"), (1.2, "sans")], rows, size=12, row_h=0.5)
text(s, L, 3.75, 7.8, 0.6, [[("The score was true, but it wasn't why the lender said no.", B)], [("It was already above Meridian's 720 minimum, so it can't be a principal reason.", DETAIL)]], size=13, line_spacing=1.2)
x2 = L + 8.2; w2 = CW - 8.2
label(s, x2, 1.95, w2, "How it runs")
yy = 2.25
for i, (h, d) in enumerate([("Flip one field", "Set it to a passing value and re-run the lender"), ("Test pairs too", "For reasons that only matter together"), ("Only tested reasons reach the letter", "Every verdict is stored")], 1):
    chip(s, x2, yy + 0.02, str(i), w=0.3, h=0.3, size=9)
    text(s, x2 + 0.42, yy, w2 - 0.42, 0.3, h, size=12, bold=True)
    text(s, x2 + 0.42, yy + 0.28, w2 - 0.42, 0.35, d, size=10, color=MUTE)
    yy += 0.68
box(s, x2, 4.4, w2, 1.15, fill=PANEL, line=HAIR)
text(s, x2 + 0.2, 4.5, w2 - 0.4, 0.3, "It caught our own agents padding", size=12, bold=True)
text(s, x2 + 0.2, 4.8, w2 - 0.4, 0.7, "\"Score meets minimum\" and \"fraud score below threshold\": true, but not reasons. Both withheld.", size=10, color=MUTE, line_spacing=1.15)
takeaway(s, L, 5.85, CW, [("That's what Regulation B means by a principal reason, and the test runs on every decline.", B)], size=14, h=0.55)

# ---------------------------------------------------------------- 8 Notice
s = slide(8)
frame(s, "Layer 5: the response is classified in code, and the notice is written only from verified reasons, so the borrower gets a no they can act on.", 5, 8)
label(s, L, 1.95, 6, "Classified in code · requested $30,000")
yy = 2.27
for t, fill, line, col, h, d in [("Offer", GO, GO, PAPER, "As asked, or better", "No notice needed"),
                                ("Counteroffer", None, INK, INK, "Less money or different terms", "Notice if the borrower says no"),
                                ("Declined", SIGNAL, SIGNAL, INK, "Adverse action", "Notice required")]:
    chip(s, L, yy + 0.02, t, fill=fill, line=line, color=col, size=9, w=1.55, h=0.32)
    text(s, L + 1.75, yy - 0.02, 4.4, 0.3, h, size=13, bold=True)
    text(s, L + 1.75, yy + 0.27, 4.4, 0.3, d, size=10, color=MUTE)
    yy += 0.66
label(s, L, 4.35, 6, "Every notice has")
stacked(s, L, 4.62, 6.0, [("The tested reasons, with the numbers", ""), ("\"CRS did not make this decision\"", ""), ("A free report and the right to dispute", "")], gap=0.36)
x2 = L + 6.5; w2 = CW - 6.5
label(s, x2, 1.95, w2, "Dispute one tradeline → all five lenders re-run")
g = lambda t: [(t, {"bold": True, "size": 12, "color": GO})]
m = lambda t: [(t, {"size": 12, "color": MUTE})]
rows = [["Lender", "Before", "After"],
        [[("Pacific Ridge", B)], m("Declined"), g("12.90%")], [[("Cascade Regional", B)], m("Declined"), g("11.25%")],
        [[("Northstar", B)], m("29.90%"), g("21.90%")], [[("Harbor", B)], m("31.90%"), g("27.90%")], [[("Meridian Prime", B)], m("Declined"), m("Declined")]]
table(s, x2, 2.25, w2, [(2.3, "sans"), (1.5, "sans"), (1.7, "sans")], rows, size=12, row_h=0.4)
takeaway(s, L, 5.85, CW, [("A no the borrower can act on: fix the file, and the offers change in front of them.", B)], size=14, h=0.55)

# ---------------------------------------------------------------- 9 Human + platform (and 10, hidden CREAO alternate)
def human_slide(i, hidden, title, agents):
    s = slide(i, hidden)
    frame(s, title, 6, 9)
    label(s, L, 1.95, 5, "The human seat")
    text(s, L, 2.22, 5.6, 0.35, "A person makes the final call on every file", size=14, bold=True)
    text(s, L, 2.58, 5.6, 0.6, "A ranked queue: approve the best offer, decline, or send the notice. Every click is logged with who and when.", size=10, color=MUTE, line_spacing=1.15)
    for k, (lab, d) in enumerate([("Console", "The loan officer's desk"), ("Board", "The judges' live screen"), ("Phone", "The borrower: code in, offers out")]):
        bx = L + k * 1.9; box(s, bx, 3.35, 1.75, 0.95, line=HAIR)
        text(s, bx + 0.12, 3.42, 1.55, 0.3, lab, size=12, bold=True)
        text(s, bx + 0.12, 3.72, 1.55, 0.55, d, size=10, color=MUTE, line_spacing=1.1)
    x2 = L + 6.2; w2 = CW - 6.2
    rows = [["Convex", "What it does for Docket"],
            [[("Durable workflow", B)], point("Runs all six layers in order", "Retries each step; one lender failing doesn't hold up the rest")],
            [[("Live queries", B)], point("Every screen updates at once", "Console, board and phone read the same tables")],
            [[("Scheduler", B)], point("Tests itself every night", "The 20-applicant eval, plus replays if the wifi fails")],
            [[("HTTP endpoints", B)], point("Health check and agent webhooks", "")]]
    table(s, x2, 1.95, w2, [(1.8, "sans"), (w2 - 1.8, "sans")], rows, size=12, row_h=0.62)
    label(s, x2, 5.0, 1, "Agents", size=8)
    chip_row(s, x2 + 0.75, 4.95, W - R, [(t, fill, line, col, line == HAIR) for t, fill, line, col in agents])
    takeaway(s, L, 5.85, CW, [("Agents do the work. A person makes the final call. Every step is on the record.", B)], size=14, h=0.55)
    return s
human_slide(9, False, "Layer 6: nothing funds until a person signs, and Convex keeps all six layers durable, live and logged as one workflow.",
            [("claude-haiku-5-5 · 5 underwriters", GO, GO, PAPER), ("claude-sonnet-5-5 · notice", GO, GO, PAPER), ("Anthropic SDK", None, HAIR, MUTE)])
human_slide(10, True, "Layer 6: nothing funds until a person signs, CREAO hosts the agents, and Convex keeps the six layers durable, live and logged as one workflow.",
            [("CREAO hosted agents · 5 underwriters", GO, GO, PAPER), ("CREAO hosted agent · notice", GO, GO, PAPER), ("Claude fallback for unusable replies", None, HAIR, MUTE)])

# ---------------------------------------------------------------- 11 Eval
s = slide(11)
frame(s, "The 20-applicant deck is our test suite: every outcome matches the answer key, and 96 of 100 lender calls do.", 0, 10)
tw = (7.6 - 0.3) / 3
for k, (n, d, t, lab) in enumerate([("20", "/20", "Outcomes right", "Approve, decline or stop"), ("96", "/100", "Lender calls right", "4 misses: answer-key amounts"), ("82", "%", "Reasons hold up", "The rest never reach a letter")]):
    bx = L + k * (tw + 0.15); box(s, bx, 1.95, tw, 1.75, line=HAIR)
    text(s, bx + 0.18, 2.0, tw - 0.3, 0.8, [[(n, {"size": 38, "bold": True, "font": MONO, "color": GO}), (d, {"size": 20, "font": MONO, "color": MUTE})]])
    text(s, bx + 0.18, 2.88, tw - 0.3, 0.35, t, size=13, bold=True)
    text(s, bx + 0.18, 3.22, tw - 0.3, 0.4, lab, size=10, color=MUTE)
text(s, L, 3.95, 7.6, 0.75, [[("No invalid answers, and zero offers to fraud or deceased files.", B)], [("Consistency with our own answer key, not proof of fairness.", DETAIL)]], size=13, line_spacing=1.2)
x2 = L + 8.0; w2 = CW - 8.0
label(s, x2, 1.95, w2, "How the eval runs")
stacked(s, x2, 2.25, w2, [("Every applicant, all six layers", "Through the real desk, in parallel"), ("Scored against our answer key", "Outcome, each lender, and the reasons"), ("Every night, or from a button", "On the Convex scheduler")], gap=0.66)
takeaway(s, L, 5.85, CW, [("Fairness is next: two applicants that differ in one field must get the same answer.", B)], size=14, h=0.55)

# ---------------------------------------------------------------- 12 Close
s = slide(12)
frame(s, "Draw a card and be the borrower. Then ask us what breaks.", 0, 11)
text(s, L, 2.0, 7.4, 0.9, [[("Twenty sandbox applicants, zero real people. Every card runs through all six layers live.", B)], [("Next: a real credit union's policy file in place of ours, and paired tests for fairness.", DETAIL)]], size=14, line_spacing=1.3)
text(s, L, 3.05, 7, 0.5, "docket-sepia-ten.vercel.app", size=20, font=MONO)
for k, (nm, d) in enumerate([("Swaraj Adhikari", "UCLA · Convex backend, agents, the phone, the board"), ("Matthew Pun", "UC Berkeley · Lender policies, the 20 personas, the eval answer key")]):
    bx = L + k * 3.9
    text(s, bx, 3.75, 3.7, 0.35, nm, size=14, bold=True)
    text(s, bx, 4.1, 3.6, 0.7, d, size=10, color=MUTE, line_spacing=1.2)
chip_row(s, L, 5.1, L + 7.6, [(t, None, HAIR, MUTE, True) for t in ["CRS", "Convex", "Hyphenate", "Microsoft", "Anthropic", "Most creative", "Most technically advanced", "People-first"]], h=0.26, gap=0.08)
qr = HERE / "src" / "assets" / "qr.png"
box(s, W - R - 3.0, 1.95, 3.0, 3.35, fill=PANEL, line=HAIR)
s.shapes.add_picture(str(qr), Inches(W - R - 2.85), Inches(2.1), Inches(2.7), Inches(2.7))
label(s, W - R - 3.0, 4.9, 3.0, "Scan · be the borrower", size=8)
s.shapes[-1].text_frame.paragraphs[0].alignment = PP_ALIGN.CENTER

prs.save(OUT)
if OUT.exists():  # build_v7.py runs this script with saving switched off
    print("wrote", OUT, OUT.stat().st_size, "bytes,", len(prs.slides), "slides")
