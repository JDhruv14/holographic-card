# Look: frame, backdrop, grade, breath, CRT

The Charizard window was matched to a reference clip colour by colour. For another
Pokémon, keep everything structural (sizes, bevels, fonts, CRT) and change only the
colours, the text and the icon.

## Frame

`palette` colours the Win98 frame. Take the hue from the Pokémon's main colour and
build the rest from it, as Charizard's do from red:

| key | role | Charizard |
|---|---|---|
| `title` | title bar gradient, saturated on the left to pale on the right | `#d90f0f` `#e0241c` `#ea7a66` `#ee907c` |
| `face` | window body and buttons: a pale tint of the hue | `#f2c2b3` |
| `light`, `outer` | highlight bevels, nearly white with a trace of the hue | `#fff4ee`, `#f3e4de` |
| `shadow`, `dark` | inner and outer shadow bevels, mid and deep | `#b07f72`, `#5c3a34` |
| `close` | close button; stays red whatever the hue | `#e1262a` |
| `ink` | menu text, status text, button glyphs | `#1b1210` |
| `status` | status bar; a cool grey, slightly off the hue, reads as a separate strip | `#cfd6cf` |

The title is `{name}.exe` in lower case. The status line is a short fragment from the
card's Pokédex text, lower case, no full stop ("spits fire that is hot enough").

The icon is 16 x 16 pixel art: one string per row, one character per pixel, `.` for
transparent, each other character mapped to a colour. Draw the Pokémon's emblem (a
flame, a drop, a leaf) with a black outline, as the flame is.

## Backdrop

A sunburst fills the art panel behind the figure, with a rainbow sheen and foil
sparkles over it. `dark` and `light` are the two ray colours; both should be the
figure's type colour, dark enough that the figure stands out (Charizard: `#541d08` and
`#a13e09`, a burnt orange). It darkens toward the panel's edges by itself. `rays` sets
the count (11).

## Figure grade

Card prints are pale. `figure.grade.gamma` (default 1.85) deepens them, and the shader
flattens the result into six cel tones. `tint` multiplies everything except whites
and pale blues, so highlights stay clean; Charizard uses a warm `#ffe69e` to get the
deep gold of the reference. Leave it white for cool-coloured Pokémon, or it turns
them muddy.

## Breath

`breath.colors` is `[core, rim, holes]`. The shape is a flame: a flat, cel-shaded cone
that ripples, gets ragged teeth as the power rises, and has dark holes punched through
it. Fire uses yellow, orange and near-black (`#f7e00a` `#ed5c08` `#170f08`).

Changing the colours is enough for fire-like effects. Water from cannons, a beam or a
gust of leaves are different shapes: write a new function next to `breath()` in
`lib/shaders.ts` with the same inputs (`uApex`, `uDir`, `uPower`, `uT`) and return
colour and alpha the same way, so it keeps its place in the alpha coverage and gets
the same CRT treatment.

`ember` is the little flame fixed to the figure (Charizard's tail tip). It uses the
breath colours. Leave it out for anything without one.

## CRT

The CRT pass is tuned to the reference; change it only when asked. It has:

- an aperture grille (vertical red, green and blue stripes, three columns per triad),
  paler on bright areas so the breath gets fine lines instead of coloured bars
- scanlines every 4 reference px, a per-line horizontal wobble, colour fringing of
  1.5 px, a four-tap bloom, flicker and grain
- a fade to pure white wherever the scene alpha is 0, so the page stays white

The lines must cover the breath as well as the window. If the breath shows dark
columns, look for a `pow()` on a value that can go negative.
