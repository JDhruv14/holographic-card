# Art: getting the figure and measuring it

## Pick a scan

pokemontcg.io serves high-resolution scans at
`https://images.pokemontcg.io/{set}/{number}_hires.png` (734 x 1024). On the classic
card layout (Base Set and its reprints) the art window is at `[88, 131, 556, 400]`
(x, y, width, height); check it on other layouts.

Which print matters more than resolution:

- **A non-holo print or a reprint** usually draws the Pokémon with a thin light outline
  against a flat background. The cutout tool can separate it on its own. Charizard here
  is `cel25c/4_A` (Celebrations Classic Collection), not `base1/4`.
- **A holo foil** puts sparkles and texture right up against the figure with no
  outline. It needs a mask (below).

## Cut it out

Write a recipe next to the example and run it:

```json
{
  "image": "https://images.pokemontcg.io/cel25c/4_A_hires.png",
  "crop": [88, 131, 556, 400],
  "outline": 205,
  "keep": [[352, 182], [421, 306]],
  "drop": [[385, 341]],
  "out": "art/charizard.png"
}
```

```sh
npm run cutout examples/charizard/card.json
```

It writes the PNG and `charizard-check.jpg`, the cut-out on a dark brown background.
Look at the check image every time. What to look for, and the fix:

| problem | fix |
|---|---|
| a gap between limbs or wing and body is filled with background | it's a hole the tool kept because it is small; nothing to do unless it shows, then lower the 3000 px size rule in the script |
| part of the figure is missing (a pocket of skin between two lines) | add a point inside it to `keep` |
| dark background leaked inside the outline | add a point on it to `drop` |
| the tool exits saying the outline doesn't enclose the figure | lower `outline` (try 190), or give it a mask |
| a white rim around the figure | the edge is pulled in 7 px at 4x; raise it in the script if your outline is thicker |

All points are in pixels of the cropped art window (556 x 400 for the classic layout).

### With a mask

When the outline doesn't work, make a mask with any background remover (rembg, an
image editor, macOS "Copy Subject"): a grayscale PNG the size of the cropped art
window, white where the Pokémon is. Add `"mask": "art/mask.png"` to the recipe. On
holo foils these tools often take chunks of foil with the figure; paint those out by
hand and run the tool again.

## Measure the points

Every position in the config's `figure`, `head`, `breath` and `ember` is in pixels of
the cut-out PNG. Measure them; a guessed pivot makes the whole head slide. Put a grid
over the cut-out and read coordinates off it:

```sh
uv run --with pillow python -c "
from PIL import Image, ImageDraw; im = Image.open('examples/charizard/art/charizard.png').convert('RGBA')
d = ImageDraw.Draw(im)
for x in range(0, im.width, 50): d.line([(x, 0), (x, im.height)], fill=(0, 160, 255, 255) if x % 100 else (255, 0, 0, 255))
for y in range(0, im.height, 50): d.line([(0, y), (im.width, y)], fill=(0, 160, 255, 255) if y % 100 else (255, 0, 0, 255))
im.save('grid.png')"
```

Red lines are every 100 px, blue every 50. What each point is, with Charizard's values
(cut-out 1199 x 1101):

| field | what | Charizard |
|---|---|---|
| `figure.rect` | x, y and width of the figure in the 952 x 978 art panel. Keep the feet low and leave the head room to turn. | `[62, 150, 820]` |
| `head.pivot` | where the neck meets the body; the head turns around it | `[506, 597]` |
| `head.centre`, `head.radii` | an ellipse covering the head and the upper neck; everything inside turns, with a soft falloff to 1.5x the radii | `[246, 647]`, `[290, 205]` |
| `head.still` | x, y, inner and outer radius of a part inside that ellipse that must not move | the tail: `[76, 827, 90, 190]` |
| `breath.mouth` | the point the breath leaves from, in the open mouth or at a cannon's end | `[154, 625]` |
| `ember` | `at`: the base of a small flame fixed to the figure; `size`: its half-width and height | `[76, 853]`, `[84, 138]` |
| `backdrop.centre` | the sunburst's centre in the art panel, behind the head or chest | `[478, 432]` |

Then freeze the breath at its peak (`?t=3`) and check that it starts at the mouth with
the head turned.
