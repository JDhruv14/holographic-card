// The Windows 98 frame, drawn once onto a 2D canvas and used as a texture.
// Coordinates are reference pixels of a 1000 x 1222 window.
import type { HoloConfig } from './types.ts';

export const WIN: [number, number] = [1000, 1222];
export const ART: [number, number, number, number] = [26, 168, 952, 978]; // x, y, w, h of the art panel inside the window

// MS Sans Serif, as converted by 98.css (MIT)
const fonts: [string, string][] = [
  ['400', new URL('./fonts/ms_sans_serif.woff2', import.meta.url).href],
  ['700', new URL('./fonts/ms_sans_serif_bold.woff2', import.meta.url).href],
];

export async function loadFonts(): Promise<void> {
  await Promise.all(fonts.map(async ([weight, url]) => {
    const face = new FontFace('W98', `url(${url})`, { weight });
    document.fonts.add(await face.load());
  }));
}

// Text sizes are measured from the original window, where the title "charizard.exe"
// spans 282 px. Other titles use the same size, so every window matches.
function fontSize(c: CanvasRenderingContext2D, weight: number, sample: string, width: number): number {
  c.font = `${weight} 100px W98`;
  return 100 * width / c.measureText(sample).width;
}

// Menu items are [label, x]; the spacing is uneven in the original, so it is kept exact.
const MENU: [string, number][] = [['File', 32], ['Edit', 135], ['View', 243], ['Help', 375]];

export function drawChrome({ title, status, menu = MENU, icon, palette: p }: HoloConfig): HTMLCanvasElement {
  const S = 2; // supersample so the frame stays crisp when the window tilts
  const cv = document.createElement('canvas');
  cv.width = WIN[0] * S; cv.height = WIN[1] * S;
  const c = cv.getContext('2d')!;
  c.scale(S, S);

  const bevel = (x: number, y: number, w: number, h: number, tl: string, br: string, t = 3) => {
    c.fillStyle = tl; c.fillRect(x, y, w, t); c.fillRect(x, y, t, h);
    c.fillStyle = br; c.fillRect(x, y + h - t, w, t); c.fillRect(x + w - t, y, t, h);
  };

  // frame
  c.fillStyle = p.face; c.fillRect(0, 0, WIN[0], WIN[1]);
  bevel(0, 0, WIN[0], WIN[1], p.outer, p.dark);
  bevel(3, 3, WIN[0] - 6, WIN[1] - 6, p.light, p.shadow);

  // title bar
  const g = c.createLinearGradient(10, 0, 990, 0);
  p.title.forEach((col, i) => g.addColorStop(i / (p.title.length - 1), col));
  c.fillStyle = g; c.fillRect(10, 10, 980, 80);

  // icon: 16 x 16 pixel art, one character per pixel, '.' is transparent
  c.fillStyle = p.iconWell; c.fillRect(20, 22, 58, 58);
  bevel(20, 22, 58, 58, p.light, p.iconEdge);
  if (icon) {
    const ip = 3.25;
    icon.pixels.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      c.fillStyle = icon.colors[ch];
      c.fillRect(23 + i * ip, 25 + j * ip, ip + 0.3, ip + 0.3);
    }));
  }

  // title
  c.fillStyle = p.titleText; c.textBaseline = 'alphabetic'; c.textAlign = 'center';
  c.font = `700 ${fontSize(c, 700, 'charizard.exe', 282)}px W98`;
  c.fillText(title, 497, 66);

  // minimise, maximise, close
  const button = (x: number, w: number, fill: string) => {
    c.fillStyle = fill; c.fillRect(x, 24, w, 54);
    bevel(x, 24, w, 54, p.light, p.dark);
    bevel(x + 3, 27, w - 6, 48, fill, p.shadow);
  };
  button(800, 56, p.face); button(856, 58, p.face); button(926, 60, p.close);
  c.fillStyle = p.ink;
  c.fillRect(816, 62, 22, 7);
  c.fillRect(871, 36, 28, 8); c.fillRect(871, 36, 4, 32);
  c.fillRect(895, 36, 4, 32); c.fillRect(871, 64, 28, 4);
  c.fillStyle = '#fff';
  for (let i = 0; i < 8; i++) { // a stepped pixel X
    c.fillRect(940 + i * 4, 35 + i * 4, 8, 4);
    c.fillRect(968 - i * 4, 35 + i * 4, 8, 4);
  }

  // menu
  c.textAlign = 'left'; c.fillStyle = p.ink;
  c.font = `400 ${fontSize(c, 400, 'Help', 79)}px W98`;
  for (const [label, x] of menu) c.fillText(label, x, 136);

  // sunken well around the art
  bevel(20, 162, 964, 990, p.wellEdge, p.light);
  bevel(23, 165, 958, 984, p.wellDark, p.wellLight);
  c.fillStyle = '#000'; c.fillRect(ART[0], ART[1], ART[2], ART[3]);

  // status bar
  c.fillStyle = p.status; c.fillRect(14, 1160, 972, 52);
  bevel(14, 1160, 972, 52, p.statusEdge, p.light);
  c.fillStyle = p.ink;
  c.font = `400 ${fontSize(c, 400, 'spits fire that is hot enough', 446)}px W98`;
  c.fillText(status, 40, 1199);
  return cv;
}
