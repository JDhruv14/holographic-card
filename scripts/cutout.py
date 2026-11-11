# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "pillow", "scipy"]
# ///
"""Cut a Pokémon out of a card scan.

    uv run scripts/cutout.py examples/charizard/card.json

The recipe (card.json) names the scan, the art window on the card, and a few choices
the mask can't make on its own. Paths in it are relative to the recipe. Writes the
cut-out PNG and a check image of it on a dark background.

How it works: classic card art outlines the Pokémon with a thin white line. Pixels
brighter than `outline` are treated as walls, and the largest region that doesn't
touch the edge of the art window is the Pokémon. Gaps inside it (between an arm and
the body, say) are background, unless they're small or listed under `keep`. Dark
background that leaks inside can be removed by pointing at it under `drop`. All
points are in pixels of the cropped art window.

Art without a light outline (most holo foils) needs a mask instead: make one with
any background remover, the size of the cropped art window, white where the Pokémon
is, and name it under `mask`. The outline steps are then skipped.
"""
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

UP = 4            # work at 4x so the edge can be feathered smoothly
NEAR = 12.5 * UP  # how close a keep/drop point has to be to a region's centre


def centre(mask):
    y, x = ndi.center_of_mass(mask)
    return np.array([x, y])


def near(mask, points):
    c = centre(mask)
    return any(np.hypot(*(c - np.array(p) * UP)) < NEAR for p in points)


def outline_mask(im, r):
    # the white outline walls the Pokémon off from the background
    passable = im.min(2) <= r.get("outline", 205)
    lab, n = ndi.label(passable)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
    sizes = ndi.sum(passable, lab, range(1, n + 1))
    inner = [i for i in range(1, n + 1) if i not in edge]
    if not inner:
        sys.exit("nothing is enclosed by the outline; try a lower 'outline' value")
    m = lab == max(inner, key=lambda i: sizes[i - 1])
    if m.sum() < 0.05 * m.size:
        sys.exit("the outline doesn't enclose the Pokémon on this card; give the recipe a 'mask'")

    # holes that are mostly outline (white) belong to the figure
    holes, hn = ndi.label(ndi.binary_fill_holes(m) & ~m)
    for i in range(1, hn + 1):
        hole = holes == i
        if (hole & passable).sum() < 250:
            m |= hole

    # dark background that leaked inside, found before the holes are filled
    dark = (im.max(2) < 70) & m
    blobs, bn = ndi.label(ndi.binary_dilation(ndi.binary_erosion(dark, iterations=9), iterations=13) & dark)

    # remaining holes: small ones and the ones listed under keep are part of the figure
    holes, hn = ndi.label(ndi.binary_fill_holes(m) & ~m)
    for i in range(1, hn + 1):
        hole = holes == i
        if hole.sum() < 3000 or near(hole, r.get("keep", [])):
            m |= hole
    for i in range(1, bn + 1):
        blob = blobs == i
        if near(blob, r.get("drop", [])):
            m &= ~ndi.binary_dilation(blob, iterations=3)
    return m


def main(recipe_path):
    recipe_path = Path(recipe_path)
    r = json.loads(recipe_path.read_text())
    root = recipe_path.parent
    out = root / r["out"]
    out.parent.mkdir(parents=True, exist_ok=True)

    scan = out.parent / "scan.png"
    if not scan.exists():
        req = urllib.request.Request(r["image"], headers={"User-Agent": "holographic-card cutout"})
        scan.write_bytes(urllib.request.urlopen(req).read())

    x, y, w, h = r["crop"]
    art = Image.open(scan).convert("RGB").crop((x, y, x + w, y + h))
    art = art.resize((w * UP, h * UP), Image.LANCZOS)
    im = np.asarray(art).astype(np.int16)

    if "mask" in r:
        mask = Image.open(root / r["mask"]).convert("L").resize(art.size, Image.LANCZOS)
        m = np.asarray(mask) > 127
        shrink = 2
    else:
        m = outline_mask(im, r)
        shrink = 7  # pull the edge in past the white outline

    # tidy: one piece, feathered
    m = ndi.binary_opening(m, iterations=2)
    lab, n = ndi.label(m)
    m = lab == (np.argmax(ndi.sum(m, lab, range(1, n + 1))) + 1)
    m = ndi.binary_erosion(m, iterations=shrink)
    a = np.clip((ndi.gaussian_filter(m.astype(np.float32), 1.6) - 0.15) / 0.7, 0, 1)

    # push the figure's colours outward so the feathered edge doesn't pick up white
    idx = ndi.distance_transform_edt(~(a > 0.6), return_distances=False, return_indices=True)
    rgb = np.asarray(art)[idx[0], idx[1]]

    ys, xs = np.where(a > 0.01)
    x0, y0 = max(xs.min() - 8, 0), max(ys.min() - 8, 0)
    x1, y1 = xs.max() + 8, ys.max() + 8
    rgba = np.dstack([rgb, (a * 255).astype(np.uint8)])[y0:y1, x0:x1]
    cut = Image.fromarray(rgba)
    cut = cut.resize((cut.width * 3 // 4, cut.height * 3 // 4), Image.LANCZOS)
    cut.save(out, optimize=True)

    check = Image.new("RGBA", cut.size, (120, 50, 10, 255))
    check.alpha_composite(cut)
    check_path = out.with_name(out.stem + "-check.jpg")
    check.convert("RGB").resize((cut.width // 2, cut.height // 2)).save(check_path, quality=88)
    print(f"{out}  {cut.width} x {cut.height}\n{check_path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
