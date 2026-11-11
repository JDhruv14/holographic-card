# Motion: the loop, the tilt, the breath, the camera

All timings come from the reference clip and are shared by every Pokémon.

## The loop

Everything repeats every 4 seconds. The window's idle wobble was fitted to the four
corners of the window as tracked through the clip: about ±10° around the vertical axis
and ±5° around the horizontal one, plus a few pixels of drift, seen through a camera
2600 reference px away. While the pointer is over the canvas, the idle wobble drops to
30% and the window turns toward the pointer instead (up to 18° sideways, 14° up and
down), easing in over about a fifth of a second.

## The breath

Left alone, the figure breathes once per loop: calm until 1.55 s, building to full
power by 2.25 s, holding, then dying away between 3.72 and 3.98 s. Pressing (pointer
down, or holding Space) drives the power to 1 for as long as it's held. Power rises
with an ease rate of 9 and falls at 6, so a press reads as a burst and a release as a
fade.

With the power, in step:

- the head turns back and up, from −2.2° at rest to +6.2° at full power, around
  `head.pivot`, with a slow sway and a fast shiver while breathing
- the breath's direction rises 9° and follows 40% of the head turn
- the gap between the mouth and the start of the breath closes from 58 px to 2 px
- the breath gets longer (600 → 760 px), wider, more ragged, and scrolls faster
  (340 → 640 px/s)

The figure also breathes all the time: a 0.6% vertical stretch at 2.4 rad/s with the
feet planted.

## Checking motion

Background and headless tabs throttle `requestAnimationFrame`, so never judge motion
from a tab you aren't looking at. Step it:

- `?t=1` freezes at 1 s (calm), `?t=3` at 3 s (full breath)
- `?debug` exposes `holo` in the console; `holo.step(1/30)` advances exactly one frame
  at 30 fps and draws it

Step through a whole blast and look at each frame at full size: the breath should
never jump, smear or show dark bars, and the head should turn without tearing at the
edge of the `head` ellipse (widen `radii` if it does).

## Camera

`holo.camera(zoom, toward)` scales the view and moves it `toward` (0 to 1) of the way
from the window's centre to the head. The default framing (`framing: 0.8`) keeps the
window at 80% of the viewport so there is white space around it.

## Recording a video

Drive the page from headless Chrome over the DevTools protocol: on each frame dispatch
the pointer events for that moment, call `holo.step(1 / fps)`, and take a screenshot;
then encode the frames with ffmpeg (`-c:v libx264 -crf 16 -pix_fmt yuv420p`). Draw the
cursor into the page so it's in the frames. What made the Charizard video work:

- square, 1080 x 1080, 30 fps, 20 seconds
- the cursor visible the whole time: it enters, sweeps across the window so the tilt
  and foil show, and presses and holds three or four times to make it breathe
- after 10 seconds, ease the camera in over 3 seconds (`camera(1.22, 0.6)`) and ease it
  back out over the last 2.5
