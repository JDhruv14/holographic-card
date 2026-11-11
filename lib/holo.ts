// A holographic Pokémon in a Windows 98 window, drawn with WebGL2 in two passes:
// the scene (tilted window, foil art, figure, breath) goes into a texture, then a
// CRT pass draws that texture to the screen.
//
// Units are reference pixels: a 1080 x 1350 stage holding a 1000 x 1222 window.
import { WIN, ART, drawChrome, loadFonts } from './chrome.ts';
import { VERT, CRT, sceneShader } from './shaders.ts';
import type { HoloConfig } from './types.ts';

export type { HoloConfig, Palette, Vec2 } from './types.ts';

const STAGE = [1080, 1350] as const;
const REST = [537.7, 671.2] as const;  // window centre on the stage
const DEG = Math.PI / 180;
const LOOP = 4;                        // seconds: one tilt cycle and one breath

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Breath strength over one loop: calm, a blast, calm again. */
const autoPower = (t: number) => {
  const c = t % LOOP;
  return smooth(1.55, 2.25, c) * (1 - smooth(3.72, 3.98, c));
};

export interface Holo {
  /** Advance time by dt seconds and draw. Calling it stops the built-in clock. */
  step(dt: number): void;
  /** Jump to time t (stops the built-in clock). */
  seek(t: number): void;
  /** Zoom (1 = default framing) and how far to move the view toward the head, 0..1. */
  camera(zoom: number, toward?: number): void;
  destroy(): void;
}

export async function createHolo(canvas: HTMLCanvasElement, cfg: HoloConfig): Promise<Holo> {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 is not available');

  const [img] = await Promise.all([loadImage(cfg.art), loadFonts()]);
  const figPx: [number, number] = [img.naturalWidth, img.naturalHeight];
  const [fx, fy, fw] = cfg.figure.rect;
  const fh = fw * figPx[1] / figPx[0];
  const toWindow = ([x, y]: readonly number[]) =>
    [ART[0] + fx + x / figPx[0] * fw, ART[1] + fy + y / figPx[1] * fh];

  // breath geometry; a figure facing right mirrors the rise and the head turn
  const base = (cfg.breath?.angle ?? 180) * DEG;
  const side = Math.cos(base) < 0 ? 1 : -1;
  const mouth = cfg.breath ? toWindow(cfg.breath.mouth) : [0, 0];
  const head = toWindow(cfg.head.centre);
  const focus = [REST[0] - WIN[0] / 2 + head[0], REST[1] - WIN[1] / 2 + head[1]];

  /* ---------- gl ---------- */
  const program = (fs: string) => {
    const make = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, make(gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
      const name = gl.getActiveUniform(p, i)!.name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  };

  const texture = (unit: number, src: TexImageSource) => {
    gl.activeTexture(gl.TEXTURE0 + unit);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    return t;
  };

  const scene = program(sceneShader(cfg, figPx));
  const crt = program(CRT);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const textures = [texture(0, drawChrome(cfg)), texture(1, img)];

  // the scene renders into this; it lives on unit 2 so it never shares a unit with an input
  const fbo = gl.createFramebuffer();
  let fboTex: WebGLTexture | null = null;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width === w && canvas.height === h && fboTex) return;
    canvas.width = w; canvas.height = h;
    if (fboTex) gl.deleteTexture(fboTex);
    gl.activeTexture(gl.TEXTURE2);
    fboTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fboTex, 0);
  };

  /* ---------- state ---------- */
  const s = {
    t: 0, power: 0, hold: false, over: false, hover: 0,
    mx: 0, my: 0, sx: 0, sy: 0, zoom: 1, toward: 0, manual: false,
  };
  const framing = cfg.framing ?? 0.8;

  const advance = (dt: number) => {
    s.t += dt;
    const ease = (cur: number, to: number, rate: number) => cur + (to - cur) * (1 - Math.exp(-dt * rate));
    const target = s.hold ? 1 : autoPower(s.t);
    s.power = ease(s.power, target, target > s.power ? 9 : 6);
    s.hover = ease(s.hover, s.over ? 1 : 0, 5);
    s.sx = ease(s.sx, s.mx, 8);
    s.sy = ease(s.sy, s.my, 8);
  };

  // the idle wobble was fitted to the window corners of the reference clip
  const pose = (t: number) => {
    const sn = Math.sin(2 * Math.PI * t / LOOP), cs = Math.cos(2 * Math.PI * t / LOOP);
    const idle = 1 - 0.7 * s.hover;
    return {
      rx: (0.585 + (1.239 * sn - 4.771 * cs) * idle - s.sy * 14 * s.hover) * DEG,
      ry: (0.014 + (-9.882 * sn - 1.271 * cs) * idle + s.sx * 18 * s.hover) * DEG,
      rz: 0.053 * sn * DEG,
      cx: REST[0] - 2.11 * sn - 0.32 * cs,
      cy: REST[1] + 0.83 * sn - 3.58 * cs,
    };
  };

  const rotation = ({ rx, ry, rz }: { rx: number; ry: number; rz: number }) => {
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    const a = [cy, 0, sy, sx * sy, cx, -sx * cy, -cx * sy, sx, cx * cy]; // Rx * Ry
    const m = [
      cz * a[0] - sz * a[3], cz * a[1] - sz * a[4], cz * a[2] - sz * a[5],
      sz * a[0] + cz * a[3], sz * a[1] + cz * a[4], sz * a[2] + cz * a[5],
      a[6], a[7], a[8],
    ];
    return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]); // column-major
  };

  const draw = () => {
    resize();
    const w = canvas.width, h = canvas.height;
    const unit = Math.min(w / STAGE[0], h / STAGE[1]) * framing;
    const k = unit * s.zoom;
    const fxs = STAGE[0] / 2 + (focus[0] - STAGE[0] / 2) * s.toward;
    const fys = STAGE[1] / 2 + (focus[1] - STAGE[1] / 2) * s.toward;

    const { t, power } = s;
    const ps = pose(t);
    const theta = side * (-2.2 + 8.4 * power + 0.9 * Math.sin(t * 2.1) + 0.3 * power * Math.sin(t * 33)) * DEG;

    // the mouth after the head turn, then the breath leaving it
    const co = Math.cos(theta), si = Math.sin(theta);
    const piv = toWindow(cfg.head.pivot);
    const dx = mouth[0] - piv[0], dy = mouth[1] - piv[1];
    const ang = base + side * ((-3 + 9 * power) * DEG) + theta * 0.4;
    const dir = [Math.cos(ang), Math.sin(ang)];
    const gap = 58 * (1 - power) + 2 * power;
    const apex = [piv[0] + co * dx - si * dy + dir[0] * gap, piv[1] + si * dx + co * dy + dir[1] * gap];

    gl.viewport(0, 0, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.useProgram(scene.p);
    const u = scene.u;
    gl.uniform2f(u.uRes, w, h);
    gl.uniform3f(u.uStage, w / 2 - fxs * k, h / 2 - fys * k, k);
    gl.uniformMatrix3fv(u.uR, false, rotation(ps));
    gl.uniform3f(u.uCard, ps.cx, ps.cy, 0.992);
    gl.uniform2f(u.uTilt, ps.ry / (10 * DEG), ps.rx / (10 * DEG));
    gl.uniform1f(u.uT, t);
    gl.uniform1f(u.uPower, cfg.breath ? power : 0);
    gl.uniform1f(u.uTheta, theta);
    gl.uniform2f(u.uApex, apex[0], apex[1]);
    gl.uniform2f(u.uDir, dir[0], dir[1]);
    gl.uniform1i(u.uChrome, 0);
    gl.uniform1i(u.uFig, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(crt.p);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, fboTex);
    gl.uniform1i(crt.u.uScene, 2);
    gl.uniform2f(crt.u.uRes, w, h);
    gl.uniform1f(crt.u.uT, t);
    gl.uniform1f(crt.u.uUnit, unit); // CRT line size ignores zoom so the lines don't swim
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  /* ---------- input: move to tilt, press (or hold Space) to breathe ---------- */
  const point = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const k = Math.min(r.width / STAGE[0], r.height / STAGE[1]) * framing * s.zoom;
    s.mx = Math.max(-1, Math.min(1, (e.clientX - r.left - r.width / 2) / (WIN[0] * k * 0.55)));
    s.my = Math.max(-1, Math.min(1, (e.clientY - r.top - r.height / 2) / (WIN[1] * k * 0.55)));
  };
  const on = <K extends keyof WindowEventMap>(target: EventTarget, type: K, fn: (e: WindowEventMap[K]) => void) => {
    target.addEventListener(type, fn as EventListener);
    return () => target.removeEventListener(type, fn as EventListener);
  };
  const off = [
    on(canvas, 'pointermove', (e) => { s.over = true; point(e); }),
    on(canvas, 'pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      s.over = true; s.hold = true; canvas.classList.add('hold'); point(e);
    }),
    on(canvas, 'pointerup', (e) => { s.hold = false; canvas.classList.remove('hold'); if (e.pointerType !== 'mouse') s.over = false; }),
    on(canvas, 'pointercancel', () => { s.hold = false; s.over = false; canvas.classList.remove('hold'); }),
    on(canvas, 'pointerleave', () => { s.over = false; }),
    on(window, 'keydown', (e) => { if (e.code === 'Space') { s.hold = true; e.preventDefault(); } }),
    on(window, 'keyup', (e) => { if (e.code === 'Space') s.hold = false; }),
    on(window, 'blur', () => { s.hold = false; s.over = false; }),
  ];

  /* ---------- clock ---------- */
  let last = performance.now(), raf = 0;
  const frame = (now: number) => {
    if (!s.manual) advance(Math.min(0.05, (now - last) / 1000));
    last = now;
    draw();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    step(dt) { s.manual = true; advance(dt); draw(); },
    seek(t) {
      s.manual = true; s.t = 0; s.power = 0;
      for (let i = 0, n = Math.round(t * 60); i < n; i++) advance(1 / 60);
      draw();
    },
    camera(zoom, toward = 0) { s.zoom = zoom; s.toward = toward; },
    destroy() {
      cancelAnimationFrame(raf);
      off.forEach((f) => f());
      textures.forEach((t) => gl.deleteTexture(t));
      gl.deleteTexture(fboTex);
      gl.deleteFramebuffer(fbo);
    },
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}
