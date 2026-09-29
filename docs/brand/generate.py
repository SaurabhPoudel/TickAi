"""Generates the Lullist and Hushlist logo SVGs with the lettering converted to outlines."""
# Run: pip install fonttools && python3 docs/brand/generate.py  (needs npm install first, for the font)
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import os

OUT = os.path.dirname(os.path.abspath(__file__))
FONT = TTFont(os.path.join(OUT, "../../node_modules/@expo-google-fonts/bricolage-grotesque/800ExtraBold/BricolageGrotesque_800ExtraBold.ttf"))
GS, CMAP, UPM = FONT.getGlyphSet(), FONT.getBestCmap(), FONT["head"].unitsPerEm
HMTX = FONT["hmtx"]
KERN_TRACK = -0.02  # slight tightening, in em

NIGHT, NIGHTFALL, MOON, SEA, DAY, INK, VIOLET = "#121436", "#1E2154", "#F3DE8A", "#7BE0C3", "#EEF1FF", "#141538", "#4636E3"

def text_path(text, size, x0=0, baseline=0):
    """Returns (svg path d, advance width, positions of each glyph)."""
    scale = size / UPM
    x, parts, pos = x0, [], []
    for ch in text:
        g = FONT.getGlyphOrder()[0] if ord(ch) not in CMAP else CMAP[ord(ch)]
        pen = SVGPathPen(GS)
        GS[g].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        adv = HMTX[g][0] * scale
        pos.append((ch, x, adv))
        parts.append(pen.getCommands())
        x += adv + KERN_TRACK * size
    return " ".join(parts), x - x0 - KERN_TRACK * size, pos

def star(cx, cy, r, color):
    # four-point sparkle
    k = r * 0.28
    d = f"M{cx},{cy-r} Q{cx+k},{cy-k} {cx+r},{cy} Q{cx+k},{cy+k} {cx},{cy+r} Q{cx-k},{cy+k} {cx-r},{cy} Q{cx-k},{cy-k} {cx},{cy-r} Z"
    return f'<path d="{d}" fill="{color}"/>'

def crescent(cx, cy, r, color, bg_id):
    # moon = circle minus offset circle, via mask
    return (f'<mask id="{bg_id}"><rect x="{cx-r-2}" y="{cy-r-2}" width="{2*r+4}" height="{2*r+4}" fill="#fff"/>'
            f'<circle cx="{cx + r*0.42}" cy="{cy - r*0.30}" r="{r*0.80}" fill="#000"/></mask>'
            f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{color}" mask="url(#{bg_id})"/>')

# ---------- marks (drawn in a 100x100 box) ----------

def lullist_mark(moon=MOON, tick=SEA, uid="l"):
    # A crescent moon cradling a checkmark: the day's last task, closed at night.
    return crescent(47, 52, 33, moon, f"m{uid}") + \
        f'<path d="M50 47 L59 56 L77 36" fill="none" stroke="{tick}" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/>' + \
        star(78, 70, 5, moon)

def hushlist_mark(moon=MOON, line=SEA, uid="h"):
    # A to-do list going quiet: the first bullet is a moon, the lines fade out.
    out = crescent(15, 27, 12, moon, f"m{uid}")
    for i, (w, op) in enumerate([(62, 1), (48, .7), (34, .4)]):
        y = 27 + i * 26
        if i:
            out += f'<circle cx="15" cy="{y}" r="6.5" fill="{moon}" opacity="{op}"/>'
        out += f'<rect x="35" y="{y-6}" width="{w}" height="12" rx="6" fill="{line}" opacity="{op}"/>'
    return out

def icon(mark, name):
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">'
           f'<rect width="1024" height="1024" rx="228" fill="{NIGHT}"/>'
           f'<g transform="translate(112 112) scale(8)">{mark}</g></svg>')
    open(f"{OUT}/{name}-app-icon.svg", "w").write(svg)
    return svg

def wordmark(word, color, dot_color, size=120):
    # The i's dot becomes a small star.
    text = word.replace("i", "ı")
    d, width, pos = text_path(text, size, 0, size * 0.8)
    extra = ""
    for ch, x, adv in pos:
        if ch == "ı":
            extra += star(x + adv / 2, size * 0.8 - size * 0.74, size * 0.11, dot_color)
    return d, width, extra

def lockup(word, mark, name, bg, fg, dot, mark_moon, mark_tick, uid):
    size = 120
    d, w, extra = wordmark(word, fg, dot, size)
    markbox = 156
    W, H = int(markbox + 28 + w + 40), 180
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
           + (f'<rect width="{W}" height="{H}" fill="{bg}"/>' if bg else "")
           + f'<g transform="translate(20 20) scale(1.4)">{mark(mark_moon, mark_tick, uid)}</g>'
           + f'<g transform="translate({markbox + 28} 20)"><path d="{d}" fill="{fg}"/>{extra}</g></svg>')
    open(f"{OUT}/{name}.svg", "w").write(svg)

def wordonly(word, name, fg, dot):
    d, w, extra = wordmark(word, fg, dot, 120)
    W, H = int(w + 8), 130
    open(f"{OUT}/{name}.svg", "w").write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 {W} {H}" width="{W}" height="{H}"><path d="{d}" fill="{fg}"/>{extra}</svg>')

for word, mark in [("lullist", lullist_mark), ("hushlist", hushlist_mark)]:
    icon(mark(uid=word[0] + "i"), word)
    lockup(word, mark, f"{word}-logo-night", NIGHT, "#FFFFFF", MOON, MOON, SEA, word[0] + "n")
    lockup(word, mark, f"{word}-logo-day", None, INK, VIOLET, VIOLET, VIOLET, word[0] + "d")
    wordonly(word, f"{word}-wordmark", INK, VIOLET)
print(sorted(os.listdir(OUT)))
