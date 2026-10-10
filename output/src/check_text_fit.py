"""Checks that the text of every text box in the deck fits inside its box.

Each paragraph is wrapped with the real font metrics (Calibri and Consolas from the
PowerPoint application bundle) at the box's width, and the height the text needs is
compared with the height the box has. Also reports boxes that leave the slide, the
slide count and whether every slide has speaker notes.

It is a check of the file, not a rendering: it covers text boxes, not chart or table text.

    ./venv/bin/python output/src/check_text_fit.py [deck.pptx]

Exit code 0 when nothing overflows, 1 otherwise.
"""

import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import ImageFont

ROOT = Path(__file__).resolve().parents[2]
DECK = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "output" / "SkillPath_Final_Presentation.pptx"
FONTS = Path("/Applications/Microsoft PowerPoint.app/Contents/Resources/DFonts")
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"
P = "{http://schemas.openxmlformats.org/presentationml/2006/main}"
EMU = 914400
SCALE = 20  # measure at 20x the point size for sub-point precision
LINE = 1.2  # single line spacing of Calibri, as a multiple of the font size
TOLERANCE = 2.0  # points

FILES = {
    ("calibri", False, False): "Calibri.ttf", ("calibri", True, False): "Calibrib.ttf",
    ("calibri", False, True): "Calibrii.ttf", ("calibri", True, True): "Calibriz.ttf",
    ("consolas", False, False): "Consola.ttf", ("consolas", True, False): "Consolab.ttf",
    ("consolas", False, True): "Consolai.ttf", ("consolas", True, True): "Consolaz.ttf",
}
_cache = {}


def font(face, size, bold, italic):
    key = (face.lower() if face.lower() in ("calibri", "consolas") else "calibri", bold, italic)
    if (key, size) not in _cache:
        _cache[(key, size)] = ImageFont.truetype(str(FONTS / FILES[key]), int(round(size * SCALE)))
    return _cache[(key, size)]


def width(text, face, size, bold, italic, spacing):
    return font(face, size, bold, italic).getlength(text) / SCALE + spacing * len(text)


def paragraph_lines(par, avail):
    """Greedy word wrap of one paragraph; returns the font size of each line."""
    words = []  # (text, width, size)
    for node in par:
        if node.tag == A + "br":
            words.append(("\n", 0, 0))
        if node.tag != A + "r":
            continue
        rpr = node.find(A + "rPr")
        size = int(rpr.get("sz", 1800)) / 100 if rpr is not None else 18
        bold = rpr is not None and rpr.get("b") == "1"
        italic = rpr is not None and rpr.get("i") == "1"
        spacing = int(rpr.get("spc", 0)) / 100 if rpr is not None else 0
        latin = rpr.find(A + "latin") if rpr is not None else None
        face = latin.get("typeface") if latin is not None else "Calibri"
        text = node.findtext(A + "t") or ""
        for piece in re.findall(r"\S+|\s+", text):
            words.append((piece, width(piece, face, size, bold, italic, spacing), size))
    lines, used, sizes = [], 0.0, []
    for text, w, size in words:
        if text == "\n":
            lines.append(max(sizes) if sizes else 0)
            used, sizes = 0.0, []
            continue
        if text.isspace():
            if sizes:
                used += w
            continue
        if sizes and used + w > avail:
            lines.append(max(sizes))
            used, sizes = 0.0, []
        used += w
        sizes.append(size)
    if sizes:
        lines.append(max(sizes))
    return lines


def check_shape(sp, slide_w, slide_h):
    off, ext = sp.find(f".//{A}xfrm/{A}off"), sp.find(f".//{A}xfrm/{A}ext")
    body = sp.find(P + "txBody")
    if off is None or ext is None:
        return None
    x, y, w, h = (int(off.get("x")) / EMU, int(off.get("y")) / EMU, int(ext.get("cx")) / EMU, int(ext.get("cy")) / EMU)
    name = sp.find(f".//{P}cNvPr").get("name")
    problems = []
    if x < -0.01 or y < -0.01 or x + w > slide_w + 0.01 or y + h > slide_h + 0.01:
        problems.append(f"leaves the slide ({x:.2f}, {y:.2f}, {w:.2f} x {h:.2f} in)")
    if body is None:
        return name, problems, ""
    bp = body.find(A + "bodyPr")
    ins = {k: int(bp.get(k, d)) / EMU * 72 for k, d in (("lIns", 91440), ("rIns", 91440), ("tIns", 45720), ("bIns", 45720))}
    need, last_gap, text = 0.0, 0.0, []
    for par in body.findall(A + "p"):
        ppr = par.find(A + "pPr")
        mar = int(ppr.get("marL", 0)) / EMU * 72 if ppr is not None else 0
        pct = ppr.find(f"{A}lnSpc/{A}spcPct") if ppr is not None else None
        after = ppr.find(f"{A}spcAft/{A}spcPts") if ppr is not None else None
        spacing = int(pct.get("val")) / 100000 if pct is not None else 1.0
        lines = paragraph_lines(par, w * 72 - ins["lIns"] - ins["rIns"] - mar)
        if not lines:
            continue
        need += sum(size * LINE * spacing for size in lines)
        last_gap = int(after.get("val")) / 100 if after is not None else 0.0
        need += last_gap
        text.append("".join(t.text or "" for t in par.iter(A + "t")))
    need -= last_gap  # space after the last paragraph does not need room
    have = h * 72 - ins["tIns"] - ins["bIns"]
    if text and need > have + TOLERANCE:
        problems.append(f"text needs {need:.0f} pt, box has {have:.0f} pt")
    return name, problems, " / ".join(text)[:70]


def main():
    z = zipfile.ZipFile(DECK)
    pres = ET.fromstring(z.read("ppt/presentation.xml"))
    size = pres.find(P + "sldSz")
    slide_w, slide_h = int(size.get("cx")) / EMU, int(size.get("cy")) / EMU
    slides = sorted((n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)), key=lambda n: int(re.findall(r"\d+", n)[0]))
    print(f"{DECK.name}: {len(slides)} slides, {slide_w:.2f} x {slide_h:.2f} in")
    failed = 0
    for i, name in enumerate(slides, 1):
        root = ET.fromstring(z.read(name))
        shapes = root.findall(f".//{P}sp")
        charts = len(root.findall(f".//{P}graphicFrame"))
        pics = len(root.findall(f".//{P}pic"))
        rels = z.read(f"ppt/slides/_rels/slide{i}.xml.rels").decode()
        notes = re.search(r'Target="\.\./notesSlides/(notesSlide\d+\.xml)"', rels)
        note_len = 0
        if notes:
            note_root = ET.fromstring(z.read(f"ppt/notesSlides/{notes.group(1)}"))
            note_len = len("".join(t.text or "" for t in note_root.iter(A + "t")).split())
        bad = []
        for sp in shapes:
            result = check_shape(sp, slide_w, slide_h)
            if result and result[1]:
                bad.append(result)
        failed += len(bad)
        print(f"slide {i:2d}: {len(shapes):3d} shapes, {pics} pictures, {charts} charts/tables, notes {note_len} words, {'OK' if not bad else f'{len(bad)} PROBLEM(S)'}")
        for shape, problems, text in bad:
            print(f"    {shape}: {'; '.join(problems)}  [{text}]")
        if note_len == 0:
            failed += 1
            print("    no speaker notes")
    print("all text fits" if not failed else f"{failed} problem(s)")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
