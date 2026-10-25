#!/usr/bin/env python3
"""Assemble the Docket demo video from an EDL (edl.json) with ffmpeg + PIL overlays.

ffmpeg here has no drawtext/libass, so every caption, lower-third, tag and title card is a PNG
rendered with Pillow and composited with the overlay filter (enable=between(t,a,b)).

EDL shape:
{
  "fps": 30, "w": 1920, "h": 1080,
  "clips": [
    {"src": "/abs/IMG_7824.mov", "in": 0.3, "out": 6.8,
     "captions": [{"t0": 0.0, "t1": 3.2, "text": "Line a muted viewer needs"}],   # times relative to clip in-point
     "tags": [{"t0": 0, "t1": 2, "text": "SPED UP"}],                              # corner tag
     "lower": {"t0": 0.2, "t1": 4, "name": "Swaraj Adhikari", "role": "UCLA"}},   # lower third
    {"card": "title", "dur": 2.5, "title": "DOCKET", "sub": "A one-person credit union"}
  ]
}
Clips are portrait iPhone takes: scaled to 1080 high, centred over a blurred, darkened copy of
themselves (pillarbox). Output: out.mp4 (H.264, AAC).
"""
import json, os, subprocess, sys, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
EDL = json.load(open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "edl.json")))
W, H, FPS = EDL.get("w", 1920), EDL.get("h", 1080), EDL.get("fps", 30)
OUT = EDL.get("out", os.path.join(HERE, "out.mp4"))
TMP = os.path.join(HERE, "tmp"); os.makedirs(TMP, exist_ok=True)

INK = (20, 21, 20, 255); CREAM = (245, 245, 241, 255); ALU = (227, 228, 223, 255)
ORANGE = (255, 90, 31, 255); BLUE = (28, 70, 201, 255); WHITE = (255, 255, 255, 255)
F_DISP = lambda s: ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", s, index=1)   # Helvetica Bold
F_BODY = lambda s: ImageFont.truetype("/System/Library/Fonts/HelveticaNeue.ttc", s, index=0)
F_MONO = lambda s: ImageFont.truetype("/Users/swrj/Library/Fonts/JetBrainsMono-Bold.ttf", s)

def wrap(draw, text, font, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=font) <= maxw: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines

def caption_png(text, path):
    """Bottom-third caption: cream text on an ink bar, two lines max, sentence case."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    font = F_BODY(44); lines = wrap(d, text, font, W - 520)[:2]
    lh = 56; pad = 22; tw = max(d.textlength(l, font=font) for l in lines)
    bw, bh = int(tw + pad * 2), lh * len(lines) + pad * 2 - 8
    x0, y0 = (W - bw) // 2, H - 120 - bh
    d.rectangle([x0, y0, x0 + bw, y0 + bh], fill=(20, 21, 20, 235))
    d.rectangle([x0, y0, x0 + 8, y0 + bh], fill=ORANGE)
    for i, l in enumerate(lines):
        d.text((x0 + pad + 10, y0 + pad - 6 + i * lh), l, font=font, fill=CREAM)
    img.save(path)

def tag_png(text, path):
    """Small corner tag, top right: mono uppercase on cream."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    font = F_MONO(26); t = text.upper(); tw = d.textlength(t, font=font)
    bw, bh = int(tw + 36), 48; x0, y0 = W - 60 - bw, 60
    d.rectangle([x0, y0, x0 + bw, y0 + bh], fill=(245, 245, 241, 235)); d.rectangle([x0, y0, x0 + bw, y0 + 4], fill=ORANGE)
    d.text((x0 + 18, y0 + 9), t, font=font, fill=INK)
    img.save(path)

def lower_png(name, role, path):
    """Lower third, bottom left: name in bold, role in mono."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(img)
    f1, f2 = F_DISP(40), F_MONO(24)
    tw = max(d.textlength(name, font=f1), d.textlength(role.upper(), font=f2))
    bw, bh = int(tw + 60), 112; x0, y0 = 60, H - 120 - bh - 110
    d.rectangle([x0, y0, x0 + bw, y0 + bh], fill=(245, 245, 241, 240)); d.rectangle([x0, y0, x0 + 10, y0 + bh], fill=INK)
    d.text((x0 + 30, y0 + 16), name, font=f1, fill=INK); d.text((x0 + 30, y0 + 68), role.upper(), font=f2, fill=(86, 89, 82, 255))
    img.save(path)

def card_png(kind, spec, path):
    """Full-frame title/close card in the Instrument Tag look."""
    img = Image.new("RGBA", (W, H), ALU if kind != "close" else INK); d = ImageDraw.Draw(img)
    fg = INK if kind != "close" else CREAM
    # orange square + wordmark
    d.rectangle([120, 120, 184, 184], fill=ORANGE); d.text((210, 108), "DOCKET", font=F_DISP(78), fill=fg)
    title = spec.get("title", ""); sub = spec.get("sub", ""); lines = spec.get("lines", [])
    y = 400
    for l in wrap(d, title, F_DISP(96), W - 240): d.text((120, y), l, font=F_DISP(96), fill=fg); y += 108
    if sub:
        y += 20
        for l in wrap(d, sub, F_BODY(44), W - 240): d.text((122, y), l, font=F_BODY(44), fill=(86, 89, 82, 255) if kind != "close" else (185, 187, 179, 255)); y += 56
    yy = H - 120 - 40 * len(lines)
    d.line([120, yy - 30, W - 120, yy - 30], fill=fg, width=3)
    for l in lines: d.text((120, yy), l.upper(), font=F_MONO(26), fill=fg); yy += 40
    img.save(path)

def run(cmd):
    print("+", " ".join(cmd[:12]), "...", flush=True)
    subprocess.run(cmd, check=True)

segments = []
for i, c in enumerate(EDL["clips"]):
    seg = os.path.join(TMP, f"seg{i:02d}.mp4")
    if "card" in c:
        png = os.path.join(TMP, f"card{i:02d}.png"); card_png(c["card"], c, png)
        run(["ffmpeg", "-v", "error", "-y", "-loop", "1", "-framerate", str(FPS), "-t", str(c["dur"]), "-i", png,
             "-f", "lavfi", "-t", str(c["dur"]), "-i", "anullsrc=r=48000:cl=stereo",
             "-vf", f"format=yuv420p,fade=t=in:st=0:d=0.3,fade=t=out:st={c['dur']-0.3}:d=0.3",
             "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-r", str(FPS), "-c:a", "aac", "-shortest", seg])
        segments.append(seg); continue
    if "image" in c:
        # Product cutaway: a screenshot with a slow push-in, optional captions, silent audio.
        dur = c["dur"]; frames = int(dur * FPS)
        inputs = ["-loop", "1", "-framerate", str(FPS), "-t", f"{dur:.3f}", "-i", c["image"], "-f", "lavfi", "-t", f"{dur:.3f}", "-i", "anullsrc=r=48000:cl=stereo"]
        fc = [f"[0:v]scale={W*2}:{H*2}:force_original_aspect_ratio=increase,crop={W*2}:{H*2},zoompan=z='min(zoom+0.0006,1.10)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={W}x{H}:fps={FPS},setsar=1[v0]"]
        n = 2; last = "v0"; overlays = []
        for j, cap in enumerate(c.get("captions", [])):
            p = os.path.join(TMP, f"cap{i:02d}_{j}.png"); caption_png(cap["text"], p); overlays.append((p, cap["t0"], cap["t1"]))
        for j, tg in enumerate(c.get("tags", [])):
            p = os.path.join(TMP, f"tag{i:02d}_{j}.png"); tag_png(tg["text"], p); overlays.append((p, tg["t0"], tg["t1"]))
        for p, t0, t1 in overlays:
            inputs += ["-i", p]
            fc.append(f"[{last}][{n}:v]overlay=0:0:enable='between(t,{t0:.2f},{t1:.2f})'[v{n}]"); last = f"v{n}"; n += 1
        fc.append(f"[{last}]format=yuv420p,fade=t=in:st=0:d=0.25,fade=t=out:st={dur-0.25:.2f}:d=0.25[vout]")
        run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "1:a",
             "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-r", str(FPS), "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", "-shortest", seg])
        segments.append(seg); continue
    src, tin, tout = c["src"], c.get("in", 0.0), c["out"]; dur = tout - tin
    # overlays
    inputs = ["-ss", f"{tin:.3f}", "-t", f"{dur:.3f}", "-i", src]
    fc = ["[0:v:0]split=2[sa][sb]",
          f"[sa]scale=-2:{H}:flags=lanczos,setsar=1[fg]",
          f"[sb]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},boxblur=40:8,eq=brightness=-0.25,setsar=1[bg]",
          "[bg][fg]overlay=(W-w)/2:(H-h)/2[v0]"]
    n = 1; last = "v0"
    overlays = []
    for j, cap in enumerate(c.get("captions", [])):
        p = os.path.join(TMP, f"cap{i:02d}_{j}.png"); caption_png(cap["text"], p); overlays.append((p, cap["t0"], cap["t1"]))
    for j, tg in enumerate(c.get("tags", [])):
        p = os.path.join(TMP, f"tag{i:02d}_{j}.png"); tag_png(tg["text"], p); overlays.append((p, tg["t0"], tg["t1"]))
    if "lower" in c:
        lw = c["lower"]; p = os.path.join(TMP, f"low{i:02d}.png"); lower_png(lw["name"], lw["role"], p); overlays.append((p, lw["t0"], lw["t1"]))
    for p, t0, t1 in overlays:
        inputs += ["-i", p]
        fc.append(f"[{last}][{n}:v]overlay=0:0:enable='between(t,{t0:.2f},{t1:.2f})'[v{n}]"); last = f"v{n}"; n += 1
    fc.append(f"[{last}]format=yuv420p[vout]")
    run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(fc).replace(";;", ";"), "-map", "[vout]", "-map", "0:a:0",
         "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-r", str(FPS), "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", seg])
    segments.append(seg)

lst = os.path.join(TMP, "list.txt")
open(lst, "w").write("".join(f"file '{s}'\n" for s in segments))
run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", os.path.join(TMP, "joined.mp4")])
# loudness-normalise the voice track once at the end
run(["ffmpeg", "-v", "error", "-y", "-i", os.path.join(TMP, "joined.mp4"), "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", OUT])
print("wrote", OUT)
