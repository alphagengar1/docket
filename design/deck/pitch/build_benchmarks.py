#!/usr/bin/env python3
"""Build docket-benchmarks.pptx: five editable add-on slides (agents vs humans, agent scorecard, speed,
moat, backup methodology). Numbers come from design/deck/pitch/benchmarks.md, which records how each was
measured.

Style: glance first. Each point is one bold line you can say out loud; the small grey line under it is
the backing detail for Q&A. Sources sit in the speaker notes and on the backup slide, not on the face of
slides 1-4.

Usage: python3 design/deck/pitch/build_benchmarks.py
"""
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION
import deck_kit
from deck_kit import *

OUT = HERE / "docket-benchmarks.pptx"
B = {"bold": True}
SAY = {"bold": True, "size": 13}                 # the line you say
SAY_GO = {"bold": True, "size": 13, "color": GO}  # the line you say, Docket side
DETAIL = {"size": 10, "color": MUTE}             # the backing detail

def point(say, detail, docket=False):
    """Table cell: a bold talking point, then a small grey detail line."""
    return [[(say, SAY_GO if docket else SAY)], [(detail, DETAIL)]]

def stacked_bar(slide, x, y, w, h, parts):
    """One horizontal stacked bar; parts = [(label, seconds, hex)]. Legend carries the values."""
    data = CategoryChartData(); data.categories = [""]
    for name, v, _ in parts: data.add_series(f"{name} {v:g} s", (v,))
    gf = slide.shapes.add_chart(XL_CHART_TYPE.BAR_STACKED, Inches(x), Inches(y), Inches(w), Inches(h), data)
    ch = gf.chart
    ch.has_legend = True; ch.legend.position = XL_LEGEND_POSITION.BOTTOM; ch.legend.include_in_layout = False
    ch.legend.font.size = Pt(10); ch.legend.font.name = SANS
    ch.plots[0].gap_width = 30; ch.plots[0].overlap = 100
    for s, (_, _, color) in zip(ch.series, parts):
        s.format.fill.solid(); s.format.fill.fore_color.rgb = rgb(color)
    va = ch.value_axis; va.maximum_scale = 70; va.minimum_scale = 0; va.major_unit = 10
    va.has_major_gridlines = False; va.tick_labels.font.size = Pt(9); va.tick_labels.font.name = MONO
    va.format.line.color.rgb = rgb(HAIR)
    ch.category_axis.visible = False
    return gf

# ---------------------------------------------------------------- 1 Benchmark vs humans
s = new_slide(1, notes=(
    "SAY: the title, then read the bold lines row by row. Human side first, then ours.\n"
    "IF ASKED: Time: Bankrate, banks and credit unions take 1 to 7 business days on a personal loan; ours is 62 s from card code to the officer's queue in the latest live run, hard stops in about 5 s. "
    "Consistency: Kahneman, Sibony and Sunstein, Noise (2021): 48 underwriters at an insurance company priced the same cases a median 55% apart; executives expected 10%. It's insurance, not lending, but it's the same job: a trained person applying written guidelines to a file. We re-ran the same applicants three times and every lender gave the same decision and APR. "
    "Fatigue: University of Cambridge study of about 26,500 loan restructuring requests (ScienceDaily, May 2021). "
    "Reasons: CFPB Supervisory Highlights, Winter 2020, cited notices that failed to disclose the principal reasons. "
    "Cost: BLS median loan officer wage $36.87 an hour (May 2025); our 3 cents is an estimate from prompt sizes and list prices, 8 cents worst case."))
frame(s, "Against published human benchmarks, the agent desk is faster, repeatable and cheaper per file, and a person still signs every outcome", tracker=False)
rows = [["", "Human desk", "Docket"],
        [[("Time to decision", B)], point("1 to 7 days", "Banks and credit unions, personal loans"), point("Under a minute", "62 s from card code to the officer; hard stops in 5 s", True)],
        [[("Consistency", B)], point("Judgments drift: 55% apart on the same case", "48 underwriters pricing identical files"), point("Same file, same answer, every time", "Re-ran applicants 3 times: identical decision and APR", True)],
        [[("Fatigue", B)], point("Fewer approvals as the day wears on", "Study of ~26,500 loan requests"), point("Time of day isn't a factor", "Only the file and the policy go in", True)],
        [[("Reasons on a no", B)], point("Letters often miss the real reason", "A repeat finding in CFPB exams"), point("Every reason is tested", "82% hold up; the rest never reach the letter", True)],
        [[("Cost per file", B)], point("About 60¢ a minute of officer time", "Median loan officer wage"), point("About 3¢ per application", "Model calls, estimated", True)]]
table(s, L, 1.95, CW, [(2.2, "sans"), (4.9, "sans"), (4.9, "sans")], rows, size=12, row_h=0.74)
takeaway(s, L, 6.2, CW, [("Same judgment every time, in about a minute, and a person still signs.", B)], size=14, h=0.55)

# ---------------------------------------------------------------- 2 Scorecard
s = new_slide(2, notes=(
    "SAY: the title, then point at the two columns: every outcome right, no invalid answers, never an offer to a fraud or deceased file. Claude direct is the fast one.\n"
    "IF ASKED: Claude direct is the cloud eval of Oct 24 09:31 (20 personas, 3 lenders, claude-haiku-5-5). CREAO + fallback is the cloud eval of Oct 24 21:26 (20 personas, 5 lenders, all at once), scored against the five-lender answer key; when a CREAO reply is unusable the same lender is re-run on Claude and logged, which happened 4 times in 85. "
    "The 4 lender misses are all Harbor and come from the answer key using a different loan amount, not a wrong decision. Speed: 20 s per lender in a single live run, 58 s with 20 applications at once. "
    "Repeat runs: four full Claude evals, 80 persona runs, 78 matched; both misses were one persona before a rule change that night. The answer key is ours, so this is consistency with our policy, not proof of fairness."))
frame(s, "On seven countable numbers, both setups get 20/20 outcomes with no invalid answers; Claude direct is about 7× faster", tracker=False)
OK = {"bold": True, "size": 14, "color": GO}
rows = [["Metric", "What it means", "Claude direct · 3 lenders", "CREAO + Claude fallback · 5"],
        [[("Outcomes right", B)], [("Approve, decline or stop matches the key", DETAIL)], [("20 / 20", OK)], [("20 / 20", OK)]],
        [[("Lender calls right", B)], [("Each lender's decision matches the key", DETAIL)], [("60 / 60", OK)], [[("96 / 100", OK)], [("4 misses: answer-key amounts", DETAIL)]]],
        [[("Valid answers", B)], [("Every lender reply is usable", DETAIL)], [("51 / 51", OK)], [[("85 / 85", OK)], [("4 rescued by Claude", DETAIL)]]],
        [[("Reasons that hold up", B)], [("Fixing the cited field flips the decision", DETAIL)], [("84%", OK)], [("82%", OK)]],
        [[("Fraud files approved", B)], [("Offers to fraud, deceased or ID-fail files", DETAIL)], [("0", OK)], [("0", OK)]],
        [[("Speed per lender", B)], [("Median time to a decision", DETAIL)], [("2.7 s", OK)], [[("20 s", {"bold": True, "size": 14})], [("58 s with 20 at once", DETAIL)]]],
        [[("Cost per application", B)], [("Model calls", DETAIL)], [[("≈ 3¢", OK)], [("estimate", DETAIL)]], [("Not measured", {"size": 12, "color": MUTE})]]]
table(s, L, 1.9, CW, [(2.6, "sans"), (3.9, "sans"), (2.6, "sans"), (2.9, "sans")], rows, size=12, row_h=0.5)
takeaway(s, L, 6.3, CW, [("Every outcome right, no invalid answers, and the agent never lends to a fraud file.", B)], size=14, h=0.55)

# ---------------------------------------------------------------- 3 Speed
s = new_slide(3, notes=(
    "SAY: speed is the biggest reason. Days become about a minute, a fraud file stops in seconds, and the officer reviews instead of assembling.\n"
    "IF ASKED: 62 s is one live application on the cloud desk after the CREAO fix (Oct 24 20:58): pull 1.5 s, hard stops 1.9 s, five lenders 27.7 s, reason tests 1.8 s, notice 25.8 s. "
    "Hard stops: median of 3 cloud runs, about 5 s. Most of the minute is the agents on CREAO hosting; called directly, a Claude lender answers in 2.7 s. "
    "Under load, 20 applications at once finished in about 2.5 minutes. Human figure: Bankrate, personal loan approval timelines."))
frame(s, "Why agents over people: the borrower waits about a minute instead of 1 to 7 business days, and the officer reviews instead of assembles", tracker=False)
for k, (n, unit, lab) in enumerate([("1–7", "days", "A bank or credit union decides"), ("62", "seconds", "Docket puts a decided file in front of the officer"), ("5", "seconds", "Docket stops a fraud or deceased file")]):
    bx = L + k * 2.95; box(s, bx, 1.95, 2.75, 1.55, line=HAIR, fill=PANEL if k else None)
    text(s, bx + 0.2, 2.02, 2.5, 0.75, [[(n, {"size": 34, "bold": True, "font": MONO, "color": INK if k == 0 else GO}), ("  " + unit, {"size": 12, "color": MUTE})]])
    text(s, bx + 0.2, 2.82, 2.4, 0.6, lab, size=12, bold=True, line_spacing=1.15)
label(s, L, 3.75, 8.6, "Where the 62 seconds go")
stacked_bar(s, L - 0.1, 3.95, 8.9, 1.6, [("Credit pull", 1.5, INK), ("Hard stops", 1.9, MUTE), ("Lenders ×5", 27.7, GO), ("Reason tests", 1.8, HAIR), ("Notice", 25.8, SIGNAL)])
text(s, L, 5.7, 8.6, 0.9, [[("Most of the minute is the AI lenders and the letter.", B)], [("Called directly, a Claude lender answers in 2.7 s. Twenty applications at once finished in 2.5 minutes.", DETAIL)]], size=13, line_spacing=1.25)
x2 = L + 9.0; w2 = CW - 9.0
box(s, x2, 1.95, w2, 4.65, fill=PANEL)
label(s, x2 + 0.2, 2.08, w2 - 0.4, "What the person still does")
yy = 2.45
for head, d in [("Signs every offer and notice", "Nothing funds without a signature"), ("Handles the exceptions", "Whatever the policy sends back"), ("Owns the override", "Refused and logged on a hard stop"), ("Reviews, doesn't assemble", "The file arrives pulled, checked and priced")]:
    text(s, x2 + 0.2, yy, w2 - 0.4, 0.3, head, size=13, bold=True)
    text(s, x2 + 0.2, yy + 0.3, w2 - 0.4, 0.4, d, size=10, color=MUTE)
    yy += 0.95

# ---------------------------------------------------------------- 4 Moat
s = new_slide(4, notes=(
    "SAY: CRS gets us bureau data in days. Be honest that anyone can call CRS. The moat is what we build on top, and it grows with every file.\n"
    "IF ASKED: CRS figures are vendor-stated (crscreditapi.com and its developer guide): all three bureaus plus identity, fraud and public records in one normalized response; credentialing 'in days, instead of months'; 2,000+ companies and 40M+ pulls; sandbox mirrors production. "
    "Docket assets: five lender policies written as prompts with a code mirror (policies/), counterfactual reason tests (convex/verify.ts), a 20-persona answer key scored nightly (personas/map.json), and the audit log of every pull, decision, tested reason and refused override."))
frame(s, "Moat: CRS gets us bureau data in days; the tested decisions we build on top of it compound with every file", tracker=False)
x1, w1 = L, 5.3
box(s, x1, 1.95, w1, 4.05, fill=PANEL, line=HAIR)
label(s, x1 + 0.25, 2.08, w1, "Our head start: CRS")
yy = 2.42
for head, d in [("All three bureaus, one API", "Plus identity, fraud and public records"), ("Live in days, not months", "CRS handles bureau credentialing"), ("Sandbox matches production", "Our 20 test applicants are real response shapes"), ("Trusted at scale", "2,000+ companies, 40M+ credit pulls")]:
    text(s, x1 + 0.25, yy, w1 - 0.5, 0.3, head, size=13, bold=True)
    text(s, x1 + 0.25, yy + 0.3, w1 - 0.5, 0.35, d, size=10, color=MUTE)
    yy += 0.68
text(s, x1 + 0.25, 5.25, w1 - 0.5, 0.6, "Anyone can call CRS. Access is our head start, not our moat.", size=11, color=MUTE, anchor=MSO_ANCHOR.MIDDLE)
x2 = L + 5.7; w2 = CW - 5.7
label(s, x2, 1.95, w2, "Our moat: what only Docket has")
yy = 2.3
for i, (h, d) in enumerate([("Written lender policies", "Five policies as prompts, each with a code mirror for testing"),
                            ("Reasons tested on real bureau fields", "Padding never reaches a letter"),
                            ("An answer key scored every night", "20 applicants × 5 lenders"),
                            ("A decision record that compounds", "Every credit union that joins adds labeled decisions nobody else has")], 1):
    chip(s, x2, yy + 0.03, str(i), w=0.32, h=0.32, size=10)
    text(s, x2 + 0.48, yy, w2 - 0.48, 0.3, h, size=13, bold=True)
    text(s, x2 + 0.48, yy + 0.32, w2 - 0.48, 0.4, d, size=10, color=MUTE)
    yy += 0.92
takeaway(s, L, 6.2, CW, [("Anyone can pull a credit file. Only we have tested decisions on top of it.", B)], size=14, h=0.55)

# ---------------------------------------------------------------- 5 Backup: methodology
s = new_slide(5, notes="BACKUP for Q&A, not part of the talk. Every Docket number is from logged runs on our cloud deployment on Oct 24; every human number is a published source. The two honest weak spots: the answer key is ours, and the 55% study measured insurance underwriters, not loan officers.")
frame(s, "Backup: every Docket number comes from our own logged runs, and every human number from a published study", tracker=False,
      source="Raw numbers and how each was derived: design/deck/pitch/benchmarks.md in the repo. List prices from Anthropic's model table (claude-haiku-5-5 $0.10 / $0.50, claude-sonnet-5-5 $2 / $10 per million tokens).")
rows = [["Number", "How we got it", "Caveat"],
        [[("20/20, 96/100, 85/85, 82%", B)], "Cloud eval Oct 24 21:26: 20 personas, five CREAO lenders with Claude fallback, scored against the five-lender key", "All 20 ran at once, so its timings are slow"],
        [[("62 s, 20 s per lender", B)], "One live application on the cloud desk after the CREAO fix, Oct 24 20:58", "A single run"],
        [[("20/20, 60/60, 84%, 2.7 s", B)], "Cloud eval Oct 24 09:31: 20 personas, three Claude Haiku 5.5 lenders, scored against personas/map.json", "The answer key is ours"],
        [[("Same answer 3 times", B)], "P05 and P08 each run three times on the cloud desk; every lender's decision and APR identical", "Small sample"],
        [[("≈ 3¢ per application", B)], "≈2K input tokens per lender call, ~15 calls with reason tests, plus one Sonnet 5.5 notice, at list prices", "Estimate; 8¢ if every call hits its output cap"],
        [[("Human figures", B)], "Bankrate; Noise (2021); Cambridge via ScienceDaily (2021); CFPB Supervisory Highlights, Winter 2020; BLS (May 2025)", "Noise studied insurance underwriters, not loan officers"]]
table(s, L, 1.95, CW, [(2.7, "sans"), (6.4, "sans"), (2.9, "sans")], rows, size=12, row_h=0.56)

prs.save(OUT)
if OUT.exists():  # build_v7.py runs this script with saving switched off
    print("wrote", OUT, OUT.stat().st_size, "bytes,", len(prs.slides), "slides")
