"""Vertical fit pass for the generated decks, plus a text-overflow estimate.

fit_slide(): measures the real height of the slide title (Arial Bold metrics via Pillow), moves the body up
to sit just under it, then stretches the body's vertical layout (positions, panel and table-row heights,
and, a little, font sizes) so it fills the slide down to the page-number line instead of leaving a band of
white space. Small shapes (chips, labels) move but keep their height; pictures keep their size.

overflow_report(): estimates how many lines each text box and table cell needs at its font size and width,
and lists any whose text would not fit its box.
"""
from pathlib import Path
from PIL import ImageFont
from pptx.util import Emu, Pt, Inches

FONTS = Path("/System/Library/Fonts/Supplemental")
_cache = {}
def _font(name, bold, pt):
    fname = {("Arial", False): "Arial.ttf", ("Arial", True): "Arial Bold.ttf",
             ("Courier New", False): "Courier New.ttf", ("Courier New", True): "Courier New Bold.ttf"}[(name if name in ("Arial", "Courier New") else "Arial", bool(bold))]
    key = (fname, round(pt * 10))
    if key not in _cache: _cache[key] = ImageFont.truetype(str(FONTS / fname), size=max(1, round(pt * 10)))
    return _cache[key]

def text_width_in(s, name, bold, pt):
    return _font(name, bold, pt).getlength(s) / 10 / 72      # font loaded at 10x for precision

def wrapped_lines(paragraph_runs, width_in):
    """paragraph_runs: list of (text, font, bold, pt). Greedy word wrap; returns (lines, max_pt)."""
    words = []
    for t, f, b, pt in paragraph_runs:
        for i, w in enumerate(t.split(" ")):
            words.append((w + " ", f, b, pt))
    if not words: return 1, (paragraph_runs[0][3] if paragraph_runs else 12)
    lines, x = 1, 0.0
    for w, f, b, pt in words:
        ww = text_width_in(w, f, b, pt)
        if x > 0 and x + ww - text_width_in(" ", f, b, pt) > width_in:
            lines += 1; x = ww
        else:
            x += ww
    return lines, max(pt for _, _, _, pt in paragraph_runs)

def _runs(paragraph, default_pt=12):
    out = []
    for r in paragraph.runs:
        pt = r.font.size.pt if r.font.size else default_pt
        out.append((r.text, r.font.name or "Arial", bool(r.font.bold), pt))
    return out

def needed_height(text_frame, width_in, spacing=1.18):
    h = 0.0
    for p in text_frame.paragraphs:
        runs = _runs(p)
        if not runs or not "".join(t for t, *_ in runs).strip():
            h += 12 / 72 * spacing; continue
        n, pt = wrapped_lines(runs, width_in)
        h += n * pt / 72 * spacing + (p.space_before.pt / 72 if p.space_before else 0) + (p.space_after.pt / 72 if p.space_after else 0)
    return h

def title_bottom(slide):
    t = next((sh for sh in slide.shapes if sh.name == "Title"), None)
    if t is None: return None
    width = Emu(t.width).inches
    n, pt = wrapped_lines(_runs(t.text_frame.paragraphs[0], 24), width)
    return Emu(t.top).inches + n * pt / 72 * 1.12

FIXED = {"Title", "PageNum", "Source"}

def _scale_fonts(sh, g):
    frames = []
    if sh.has_text_frame: frames.append(sh.text_frame)
    if sh.has_table: frames += [c.text_frame for row in sh.table.rows for c in row.cells]
    for tf in frames:
        for p in tf.paragraphs:
            for r in p.runs:
                if r.font.size: r.font.size = Pt(round(r.font.size.pt * g * 2) / 2)

def _settle(sh):
    """Grow table rows and text boxes to the height their text needs."""
    if sh.has_table:
        tbl = sh.table
        for row in tbl.rows:
            need = 0
            for ci, c in enumerate(row.cells):
                w = Emu(tbl.columns[ci].width).inches - Emu(c.margin_left).inches - Emu(c.margin_right).inches
                need = max(need, needed_height(c.text_frame, w) + Emu(c.margin_top).inches + Emu(c.margin_bottom).inches)
            if Inches(need) > row.height: row.height = Inches(need)
        sh.height = Emu(sum(r.height for r in tbl.rows))
    elif sh.has_text_frame and sh.text_frame.text.strip() and sh.shape_type != 1:   # text boxes, not panels
        tf = sh.text_frame
        w = Emu(sh.width).inches - Emu(tf.margin_left).inches - Emu(tf.margin_right).inches
        need = needed_height(tf, w) + Emu(tf.margin_top).inches + Emu(tf.margin_bottom).inches
        if Inches(need) > sh.height: sh.height = Inches(need)

def fit_slide(slide, bottom=6.95, gap=0.32, max_stretch=1.6, font_gain=0.5, max_font=1.25, stretch=True):
    tb = title_bottom(slide)
    if tb is None: return None
    body = [sh for sh in slide.shapes if sh.name not in FIXED and Emu(sh.top).inches > 0.7 and not sh.name.startswith("Takeaway")]
    take = [sh for sh in slide.shapes if sh.name.startswith("Takeaway")]
    if not body: return None
    src = next((sh for sh in slide.shapes if sh.name == "Source"), None)
    if src is not None:                       # leave room for a source footer: stop just above its text
        bottom = min(bottom, Emu(src.top + src.height).inches - 0.42)
    t0 = tb + gap
    if take:                                  # the takeaway sits at the bottom; the body fills the space above it
        panel = next(t for t in take if t.name == "Takeaway"); tt = next((t for t in take if t.name == "TakeawayText"), None)
        ph = Emu(panel.height).inches
        new_top = bottom - ph
        dy = Inches(new_top) - panel.top
        for t in take: t.top = Emu(t.top + dy)
        bottom = new_top - 0.3
    def bbox():
        return (min(Emu(sh.top).inches for sh in body), max(Emu(sh.top + sh.height).inches for sh in body))
    top, bot = bbox()
    f0 = (bottom - t0) / (bot - top)
    g = min(1 + (f0 - 1) * font_gain, max_font) if (f0 > 1.05 and stretch) else 1.0
    if g > 1:
        for sh in body:
            if Emu(sh.height).inches >= 0.45 or sh.has_table: _scale_fonts(sh, g)
    # Text that grew must not spill: settle tables and text boxes, then push anything below a grown table down.
    order = sorted(body, key=lambda s: Emu(s.top))
    for sh in order:
        before = Emu(sh.top + sh.height).inches
        _settle(sh)
        grew = Emu(sh.top + sh.height).inches - before
        if grew > 0.01:
            x0, x1 = Emu(sh.left).inches, Emu(sh.left + sh.width).inches
            for o in order:
                if o is sh: continue
                ox0, ox1 = Emu(o.left).inches, Emu(o.left + o.width).inches
                if Emu(o.top).inches >= before - 0.02 and ox0 < x1 and ox1 > x0:
                    o.top = Emu(o.top + Inches(grew))
    top, bot = bbox()
    f = max(1.0, min((bottom - t0) / (bot - top), max_stretch)) if stretch else 1.0
    _place(body, top, t0, f)
    # Columns that end early (e.g. a short left column beside a tall right one) are fitted on their own,
    # so every column reaches the takeaway instead of leaving white space under the short one.
    cols = _columns(body)
    if len(cols) > 1:
        for col in cols:
            ctop = min(Emu(sh.top).inches for sh in col); cbot = max(Emu(sh.top + sh.height).inches for sh in col)
            if bottom - cbot > 0.25 and cbot > ctop:
                fc = min((bottom - ctop) / (cbot - ctop), max_stretch)
                _place(col, ctop, ctop, fc)
    # Whatever space is still left (every column hit its cap): split it above and below the body.
    left = min(bottom - max(Emu(sh.top + sh.height).inches for sh in col) for col in cols)
    if left > 0.2:
        dy = Inches(left * 0.45)
        for sh in body: sh.top = Emu(sh.top + dy)
    top, bot = bbox()
    return round(f, 2), round(g, 2), round(bot, 2)

def _columns(shapes):
    """Group shapes into side-by-side columns by merging overlapping horizontal extents."""
    spans = sorted(((sh.left, sh.left + sh.width, sh) for sh in shapes), key=lambda t: t[0])
    cols, cur, cur_r = [], [], None
    for l, r, sh in spans:
        if cur and l < cur_r - Inches(0.05):
            cur.append(sh); cur_r = max(cur_r, r)
        else:
            if cur: cols.append(cur)
            cur, cur_r = [sh], r
    if cur: cols.append(cur)
    return cols

def _bold(sh):
    """True when the box's first run is bold (a heading), not a grey detail line."""
    for p in sh.text_frame.paragraphs:
        for r in p.runs:
            if r.text.strip(): return bool(r.font.bold)
    return False

def _ext(sh):
    y = Emu(sh.top).inches
    if sh.shape_type == 17 and sh.has_text_frame:
        tf = sh.text_frame
        w = Emu(sh.width).inches - Emu(tf.margin_left).inches - Emu(tf.margin_right).inches
        return y, y + min(Emu(sh.height).inches, needed_height(tf, w) + Emu(tf.margin_top).inches)
    return y, y + Emu(sh.height).inches

def _place(shapes, top, t0, f):
    """Map vertical positions from [top, ...] to [t0, ...] scaled by f. Each heading stays locked to the grey
    detail line under it (text boxes within 0.1 in, overlapping horizontally, move as one unit); pictures and
    chips move by their centre; panels, tables and charts stretch."""
    texts = sorted([sh for sh in shapes if sh.shape_type == 17], key=lambda s: Emu(s.top))
    group = {id(sh): sh for sh in texts}
    def root(sh):
        while group[id(sh)] is not sh: sh = group[id(sh)]
        return sh
    for i, a in enumerate(texts):
        _, a1 = _ext(a)
        for b in texts[i + 1:]:
            b0, _ = _ext(b)
            hov = min(a.left + a.width, b.left + b.width) - max(a.left, b.left)
            if hov > Inches(0.1) and -0.05 <= b0 - a1 < 0.22 and _bold(a) and not _bold(b):
                group[id(root(b))] = root(a)
    anchor = {}
    for sh in texts:
        r = root(sh); anchor[id(r)] = min(anchor.get(id(r), 99), Emu(sh.top).inches)
    for sh in shapes:
        y, h = Emu(sh.top).inches, Emu(sh.height).inches
        if sh.shape_type == 17:
            a = anchor[id(root(sh))]
            sh.top = Inches(t0 + (a - top) * f + (y - a))
        elif sh.shape_type == 13 or h < 0.45:
            sh.top = Inches(t0 + (y + h / 2 - top) * f - h / 2)
        else:
            sh.top = Inches(t0 + (y - top) * f)
            if sh.has_table:
                for row in sh.table.rows: row.height = Emu(int(row.height * f))
                sh.height = Emu(sum(r.height for r in sh.table.rows))
            else:
                sh.height = Inches(h * f)

def overflow_report(prs, tol=0.04):
    issues = []
    for i, s in enumerate(prs.slides, 1):
        for sh in s.shapes:
            if sh.has_text_frame and sh.text_frame.text.strip() and sh.name not in ("PageNum",):
                tf = sh.text_frame
                w = Emu(sh.width).inches - Emu(tf.margin_left).inches - Emu(tf.margin_right).inches
                need = needed_height(tf, w)
                have = Emu(sh.height).inches - Emu(tf.margin_top).inches - Emu(tf.margin_bottom).inches
                if not tf.word_wrap and tf.word_wrap is not None: continue
                if need > have + tol: issues.append((i, "text", tf.text[:50].replace("\n", " | "), round(need, 2), round(have, 2)))
            if sh.has_table:
                tbl = sh.table
                for ri, row in enumerate(tbl.rows):
                    for ci, c in enumerate(row.cells):
                        w = Emu(tbl.columns[ci].width).inches - Emu(c.margin_left).inches - Emu(c.margin_right).inches
                        need = needed_height(c.text_frame, w) + Emu(c.margin_top).inches + Emu(c.margin_bottom).inches
                        if need > Emu(row.height).inches + 0.25:   # rows grow to fit; flag only big growth
                            issues.append((i, f"cell r{ri}c{ci}", c.text_frame.text[:40].replace("\n", " | "), round(need, 2), round(Emu(row.height).inches, 2)))
        # body bottom vs slide bottom
        body_bot = max((Emu(sh.top + sh.height).inches for sh in s.shapes if sh.name not in ("PageNum",)), default=0)
        if body_bot > 7.25: issues.append((i, "slide", "content runs past the bottom", round(body_bot, 2), 7.25))
    return issues
