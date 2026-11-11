---
name: holo-pokemon
description: Build interactive 3D holographic Pokémon (or any trading-card creature) shown inside a Windows 98 style window, drawn with WebGL2 and TypeScript — the window tilts with the pointer, the foil sparkles, the figure turns its head and breathes fire (or water, or anything else), and a CRT layer sits over everything. Use this whenever someone asks for a holographic or holo Pokémon card, a "charizard.exe" style window, a retro Win98 window with a living card inside, a tilt/foil/CRT card component, another Pokémon in this style, or to recreate a clip like this — even if they never say WebGL or Win98.
---

# Holographic Pokémon window

A WebGL2 component: a Windows 98 window floating on a white page, holding the art of a
Pokémon card with the figure cut out of it. The window wobbles on a four-second loop
and tilts toward the pointer, the foil sparkles with the tilt, and pressing makes the
figure turn its head and breathe. A CRT pass (aperture grille, scanlines, fringing,
bloom) covers the window and the breath, but never the page.

This repo ships the library (`lib/`), one finished example (`examples/charizard/`) and
a cutout tool (`scripts/cutout.py`). Read the Charizard config before writing a new
one: every number in it has a counterpart you'll need to measure.

## How people judge this work

Frame by frame, against the clip or card it came from. These were rejected in practice:

- a redrawn or generated Pokémon instead of the real card art
- anything that drifts from the reference when they asked for an exact copy: window
  proportions, colours, tilt timing, the shape and timing of the breath
- breath that scrolls too fast or smears; dark bars or stripes through it
- CRT lines removed from the breath (they want the same lines as the window), and harsh
  red/green stripes on bright areas
- the window filling the frame: leave white space around it
- a static video: show a cursor moving, tilting and pressing

## Workflow

1. **Get the art.** Use a real card scan (pokemontcg.io serves `{set}/{number}_hires.png`)
   and cut the figure out with `scripts/cutout.py`. See `references/art.md`. Look at
   the check image it writes before going on.
2. **Set up.** Copy `lib/` into the project (four dependency-free `.ts` files plus two
   fonts) and use Vite + TypeScript; `package.json`, `tsconfig.json` and
   `vite.config.ts` here show the setup.
3. **Write the config.** Copy `examples/charizard/charizard.ts` and change it piece by
   piece: title and status line, icon, frame palette, figure rect, head, backdrop,
   breath, ember. `lib/types.ts` documents every field. Measure points on the cut-out
   as described in `references/art.md`; don't guess them.
4. **Show one window and get a yes** before making more, or a video. Freeze frames with
   `?t=1` (calm) and `?t=3` (full breath) and show both.
5. **Tune the look** with `references/look.md`: frame colours from the art, a backdrop
   that suits the type, the grade, breath colours.
6. **Check the motion** with `references/motion.md`: step frames in `?debug` mode
   (`holo.step(1/30)` in the console) and look at the head turn and the breath at the
   start, peak and end of a blast.

## Rules that make it work

- **Real art, cut out.** The figure is the card's own illustration with its background
  removed. The sunburst, sparkles and sheen behind it are drawn by the shader.
- **The page is white and never changes.** Only the window and the breath are drawn;
  the CRT fades to white where nothing is (alpha marks coverage: 1 window, 0.5 breath,
  0 paper).
- **Reference pixels.** Everything is laid out on a 1080 x 1350 stage with a 1000 x 1222
  window and a 952 x 978 art panel, then scaled to the screen. Points on the figure are
  in pixels of the cut-out PNG.
- **Breath leaves the window.** It's drawn in window space after the window, so it
  overlaps the frame and spills onto the page like the original.
- **The figure faces where it breathes.** `breath.angle` 180 is left; anything pointing
  right mirrors the rise of the breath and the head turn.
- **The head turns, the body doesn't.** Only the region in `head` follows the turn; use
  `head.still` to pin a part inside it (Charizard's tail).
- **CRT size follows the base framing, not the zoom**, or the lines swim when zooming.
- **GLSL traps that caused visible bugs here:** `pow()` of a negative is NaN (black
  columns), `smoothstep()` with edge0 > edge1 is undefined, and the scene texture must
  not share a texture unit with an input (feedback loop, black screen).

## Library at a glance

| module | what it gives you |
|---|---|
| `lib/holo.ts` | `createHolo(canvas, config)` → `{ step(dt), seek(t), camera(zoom, toward), destroy() }`; pointer and Space input |
| `lib/shaders.ts` | the scene shader, generated from the config, and the CRT pass |
| `lib/chrome.ts` | the Win98 frame drawn to a canvas; `WIN`, `ART` sizes |
| `lib/types.ts` | `HoloConfig` and `Palette`, with every field explained |

`step()` and `seek()` stop the built-in clock, so frames can be stepped exactly for
checking or for recording. `camera(1.22, 0.6)` zooms in 22% and moves 60% of the way
toward the head; `camera(1, 0)` restores the default framing.
