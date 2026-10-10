"""Crop and shrink the images the presentation uses.

Inputs (nothing here is redrawn or edited, only cropped and resized):
  output/assets/raw/app-*.png          screenshots saved by capture_screens.mjs
  reports/figures/02_jobrole_similarity.png   EDA figure from notebook 02

Outputs: output/assets/shot-*.jpg and output/assets/fig-similarity.png

Run from anywhere with the project venv:  ./venv/bin/python output/src/prepare_assets.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "output" / "assets"
RAW = ASSETS / "raw"

# name: (source, crop box in source pixels or None, output width in pixels)
SHOTS = {
    "shot-start": ("app-start.png", None, 1800),
    "shot-technologies": ("app-technologies.png", (840, 329, 2506, 1662), 1500),
    "shot-results": ("app-results.png", (231, 560, 2569, 2100), 1700),
    "shot-detail": ("app-role-detail.png", (231, 189, 2569, 868), 1700),
    "shot-whatif": ("app-what-if.png", (238, 224, 2562, 1267), 1700),
}


def shrink(im: Image.Image, width: int) -> Image.Image:
    if im.width <= width:
        return im
    return im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)


for name, (source, box, width) in SHOTS.items():
    im = Image.open(RAW / source).convert("RGB")
    if box:
        im = im.crop(box)
    im = shrink(im, width)
    im.save(ASSETS / f"{name}.jpg", quality=90, optimize=True)
    print(f"{name}.jpg  {im.width}x{im.height}  ratio {im.width / im.height:.3f}")

# the figure's own title is cropped off; the slide gives it a heading
fig = Image.open(ROOT / "reports" / "figures" / "02_jobrole_similarity.png").convert("RGB")
fig = shrink(fig.crop((0, 52, fig.width, fig.height)), 1500)
fig.save(ASSETS / "fig-similarity.png", optimize=True)
print(f"fig-similarity.png  {fig.width}x{fig.height}  ratio {fig.width / fig.height:.3f}")
