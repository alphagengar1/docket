#!/usr/bin/env python3
"""Build edl.json for the Docket Devpost video from the silence map, the transcripts and a hand-written cut list."""
import json, os, re, glob

V = os.path.dirname(os.path.abspath(__file__))
DL = os.path.expanduser("~/Downloads")
SS = "/Users/swrj/Downloads/Code/Projects/calhacks-13-starter/design/screenshots"

# speech span per clip from ffmpeg silencedetect
span = {}
for line in open(os.path.join(V, "silence.txt")):
    m = re.match(r"(IMG_\d+) dur=([\d.]+)(.*)", line.strip())
    if not m: continue
    b, dur, rest = m.group(1), float(m.group(2)), m.group(3)
    ev = re.findall(r"silence_(start|end): ([\d.]+)", rest)
    lead = 0.0; trail = dur
    if ev and ev[0][0] == "start" and float(ev[0][1]) < 0.05:
        lead = float(ev[1][1]) if len(ev) > 1 and ev[1][0] == "end" else 0.0
    # trailing: last silence_start whose matching end is at/near the clip end (or missing)
    starts = [float(v) for k, v in ev if k == "start"]; ends = [float(v) for k, v in ev if k == "end"]
    if starts:
        last_s = starts[-1]
        last_e = ends[-1] if len(ends) == len(starts) else dur
        if dur - last_e < 0.08 or len(ends) < len(starts):
            trail = last_s
    span[b] = (lead, trail, dur)

def src(b):
    for ext in (".mov", ".MOV"):
        p = os.path.join(DL, b + ext)
        if os.path.exists(p): return p
    raise SystemExit("missing " + b)

def whisper_ratio(b):
    """Relative boundary of the first whisper segment (0..1), for splitting two captions."""
    f = os.path.join(V, "srt", b + ".srt")
    segs = []
    for blk in open(f).read().strip().split("\n\n"):
        ls = blk.strip().split("\n")
        if len(ls) >= 3 and "-->" in ls[1]:
            a, c = ls[1].split("-->")
            def ts(s):
                h, m, r = s.strip().split(":"); sec, ms = r.split(","); return int(h) * 3600 + int(m) * 60 + int(sec) + int(ms) / 1000
            segs.append((ts(a), ts(c)))
    if len(segs) < 2: return None
    total = segs[-1][1]
    return [s[1] / total for s in segs[:-1]]

def talk(b, caps, lower=None, side=None, pre=0.22, post=0.32):
    lead, trail, dur = span[b]
    tin = max(0.0, lead - pre); tout = min(dur, trail + post)
    L = tout - tin
    # caption boundaries: whisper's relative segment ends when the count matches, else even split
    cuts = whisper_ratio(b)
    n = len(caps)
    if cuts and len(cuts) == n - 1:
        bounds = [0.0] + [0.1 + r * (L - 0.3) for r in cuts] + [L]
    else:
        bounds = [i * L / n for i in range(n)] + [L]
    captions = [{"t0": round(max(0.05, bounds[i]), 2), "t1": round(bounds[i + 1] - 0.02, 2), "text": caps[i]} for i in range(n)]
    c = {"src": src(b), "in": round(tin, 3), "out": round(tout, 3), "captions": captions}
    if lower: c["lower"] = {"t0": 0.3, "t1": min(L - 0.2, 4.3), **lower}
    if side: c["side"] = side
    return c

def cut(image, dur, text, tag):
    return {"image": image, "dur": dur, "captions": [{"t0": 0.2, "t1": dur - 0.2, "text": text}], "tags": [{"t0": 0.2, "t1": dur - 0.2, "text": tag}]}

SW = {"name": "Swaraj Adhikari", "role": "UCLA"}
MP = {"name": "Matthew Pun", "role": "UC Berkeley"}

SL = lambda n: os.path.join(V, "slides", f"s-{n:02d}.jpg")
clips = [
    {"card": "title", "dur": 2.8, "title": "A one-person credit union.", "sub": "One loan officer, a desk of agents, and every denial reason tested before it is sent.",
     "lines": ["Cal Hacks 13.0 · Swaraj Adhikari, UCLA · Matthew Pun, UC Berkeley", "Built on CRS · Convex · Claude · CREAO"]},
    talk("IMG_7824", ["1 in 4 people who applied for a loan last year were rejected.", "A record high, in a $280 billion personal-loan market."],
         side={"eyebrow": "Credit rejection rate, past 12 months", "big": "24.8%", "sub": "A record high. Roughly one in four.", "lines": ["Personal loans just hit $280 billion"]}),
    talk("IMG_7826", ["What they get back: \u201cinternal standards.\u201d Under Regulation B, that is not a legal reason."], side=SL(2)),
    talk("IMG_7827", ["Score codes, black-box models, and now AI that writes the letter and pads the list.", "Nobody checks whether the reason is true."], side=SL(4)),
    talk("IMG_7830", ["Docket tests every reason before it is sent. In our tests, 16% of AI-written reasons failed and never reached a borrower. 20 of 20 personas matched our answer key."],
         side={"eyebrow": "In our tests", "big": "16%", "sub": "of AI-written decline reasons failed the counterfactual test and never reached a borrower.", "lines": ["20 of 20 personas matched the answer key"]}),
    talk("IMG_7832", ["Powered by CRS: three bureaus, identity and fraud in one call.", "So we can test the files that break lenders.", "Deceased, frozen and synthetic identities."],
         side={"eyebrow": "Powered by CRS Credit API", "big": "3 bureaus", "bigsize": 130, "sub": "TransUnion, Equifax and Experian, plus identity and fraud, in one call.", "lines": ["Deceased files", "Frozen files", "Synthetic identities"]}),
    talk("IMG_7835", ["CREAO hosts every lender as its own agent with its own credit policy, plus a compliance agent that writes the notice."],
         side={"eyebrow": "Agents hosted on CREAO", "big": "5 + 1", "sub": "Five underwriter agents, one per lender and policy, plus a compliance agent that writes the notice.", "lines": ["Claude underwrites, a person signs"]}),
    talk("IMG_7836", ["All of it runs as one Convex workflow: retries, timeouts, a live board, a nightly eval."],
         side={"eyebrow": "Runs on Convex", "big": "1 workflow", "bigsize": 130, "sub": "Durable steps with retries and timeouts.", "lines": ["Live queries drive the phone and the board", "Nightly eval on the scheduler"]}),
    talk("IMG_7839", ["Docket: a one-person credit union. One loan officer runs a desk of agents."], side=SL(1)),
    talk("IMG_7842", ["Six layers: one soft pull, hard stops in code, five lender quotes.", "Every decline reason is verified, the notice is written from what survived, and a person signs."], side=SL(12)),
    talk("IMG_7843", ["Every applicant is a printed card. Margaret wants $38,000 for a kitchen.", "Five lenders quote her at once, on five different policies."], side=SL(5)),
    talk("IMG_7844", ["Nothing funds on its own. The agents do the work and escalate the decision to a person."], side=os.path.join(SS, "console-alloy-sheet.png")),
    talk("IMG_7846", ["Every step is in the audit log. Agents are in the seat; a human holds the pen."], side=SL(9)),
    talk("IMG_7850", ["Kayla\u2019s identity does not verify, and her CRS fraud score is 88.", "Rules in code stop her before any model sees the file. Zero lenders."], side=SL(7)),
    talk("IMG_7851", ["Even the reviewer cannot push it through, and the attempt is logged.", "She still gets a notice that tells her how to dispute it."],
         side={"eyebrow": "Override attempt", "big": "Refused", "bigsize": 130, "bigcolor": (255, 90, 31, 255), "sub": "Logged in the audit trail. The applicant still receives a notice with the dispute steps."}),
    talk("IMG_7852", ["The part nobody does: for every decline reason, change only that one fact and re-run the lender."], side=SL(8)),
    talk("IMG_7855", ["Instead of \u201cinternal standards\u201d, the borrower gets the reason that actually decided it, and knows what to fix."], side=SL(9)),
    talk("IMG_7856", ["A freeze at one bureau is not a dead end. We underwrite on the other two."],
         side={"eyebrow": "One bureau frozen", "big": "2 of 3", "bigsize": 130, "sub": "TransUnion frozen, so the file is underwritten on Equifax and Experian.", "lines": ["A flag, not a stop"]}),
    talk("IMG_7857", ["That is why we built Docket."], side=SL(13)),
    {"card": "close", "dur": 3.5, "title": "Draw a card. Ask us what breaks.", "sub": "docket-sepia-ten.vercel.app  ·  github.com/alphagengar1/docket",
     "lines": ["Swaraj Adhikari, UCLA · Matthew Pun, UC Berkeley", "Built on CRS, Convex, Claude and CREAO. A human signs every offer."]},
]
edl = {"fps": 30, "w": 1920, "h": 1080, "out": os.path.join(V, "docket-demo.mp4"), "clips": clips}
json.dump(edl, open(os.path.join(V, "edl.json"), "w"), indent=1)
total = sum((c["dur"] if "dur" in c else c["out"] - c["in"]) for c in clips)
print("clips", len(clips), "total %.1fs" % total)
for c in clips:
    if "src" in c: print(os.path.basename(c["src"]), "in=%.2f out=%.2f" % (c["in"], c["out"]))
