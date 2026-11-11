// GLSL for the two passes. The scene shader is generated per Pokémon: the numbers that
// describe the figure (where it sits, where its head turns, what it breathes) are
// baked in as constants.
import { WIN, ART } from './chrome.ts';
import type { HoloConfig } from './types.ts';

export const VERT = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;

const f = (v: number): string => (Number.isInteger(v) ? `${v}.` : `${+v.toFixed(4)}`);
const vec = (a: readonly number[]): string => `vec${a.length}(${a.map(f).join(', ')})`;
export const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const NOISE = `
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx)*.1031); q += dot(q, q.yzx + 33.33); return fract((q.x+q.y)*q.z); }
vec4 h42(vec2 p){
  vec4 q = fract(vec4(p.xyxy)*vec4(.1031,.1030,.0973,.1099));
  q += dot(q, q.wzxy + 33.33);
  return fract((q.xxyz + q.yzzw)*q.zywx);
}
float vn(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y);
}
float fbm(vec2 p){ float a = .5, s = 0.; for(int i=0;i<4;i++){ s += a*vn(p); p = p*2.03 + 17.3; a *= .5; } return s/.9375; }
float nz(vec2 p){ return smoothstep(.22, .78, fbm(p)); }
vec3 hue(float h){ return clamp(abs(fract(h + vec3(0., 2./3., 1./3.))*6. - 3.) - 1., 0., 1.); }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }`;

// cfg: the Pokémon config; figPx: natural size of the cut-out in pixels
export function sceneShader(cfg: HoloConfig, figPx: [number, number]): string {
  const { figure, head, backdrop, breath, ember } = cfg;
  const [fx, fy, fw] = figure.rect;
  const grade = { gamma: 1.85, tint: '#ffffff', ...figure.grade };
  const still = head.still ?? [0, 0, 0, 0];
  const [cCore, cRim, cDark] = (breath?.colors ?? ['#f7e00a', '#ed5c08', '#170f08']).map(rgb);

  return `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes;          // device px
uniform vec3 uStage;        // stage origin (device px, y down) + device px per reference px
uniform mat3 uR;            // window rotation
uniform vec3 uCard;         // window centre (reference px) + scale
uniform vec2 uTilt;         // normalised tilt, drives the foil
uniform float uT, uPower, uTheta;
uniform vec2 uApex, uDir;   // breath origin and direction, window coords
uniform sampler2D uChrome, uFig;

const vec2 WIN = ${vec(WIN)};
const vec4 ART = ${vec(ART)};
const vec4 FIG = ${vec([fx, fy, fw, fw * figPx[1] / figPx[0]])};   // figure rect inside the art panel
const vec2 FPX = ${vec(figPx)};                                    // cut-out size
const vec2 PIV = ${vec(head.pivot)};
const vec2 HEAD_C = ${vec(head.centre)}, HEAD_R = ${vec(head.radii)};
const vec4 STILL = ${vec(still)};                                  // a part that must not turn with the head
const vec2 SUN = ${vec(backdrop.centre)};
const float RAYS = ${f(backdrop.rays ?? 11)};
const vec3 RAY_DARK = ${vec(rgb(backdrop.dark))}, RAY_LIGHT = ${vec(rgb(backdrop.light))};
const float GAMMA = ${f(grade.gamma)};
const vec3 TINT = ${vec(rgb(grade.tint))};
const vec3 F_CORE = ${vec(cCore)}, F_RIM = ${vec(cRim)}, F_DARK = ${vec(cDark)};
const float CAM = 2600.;
${NOISE}

/* holo foil: twinkling dots and four-point stars whose colour and phase follow the tilt */
vec3 sparkles(vec2 a){
  vec3 acc = vec3(0.);
  for(int L=0; L<2; L++){
    float S = L==0 ? 44. : 118.;
    vec2 id = floor(a/S);
    for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
      vec2 cid = id + vec2(float(i), float(j));
      vec4 h = h42(cid + float(L)*37.7);
      if(h.x < (L==0 ? .3 : .12)) continue;
      vec4 k = h42(cid*1.7 + 91.3 + float(L)*11.);
      vec2 q = a - (cid + .12 + .76*h.yz)*S;
      vec2 dir = vec2(cos(k.x*6.283), sin(k.x*6.283));
      float ph = k.y*6.283 + uT*(1.3 + 2.6*k.z) + dot(uTilt, dir)*7.;
      float b = pow(.5 + .5*sin(ph), 2.5);
      float hh = fract(k.w + dot(uTilt, vec2(.45, .3)) + .08*sin(ph));
      vec3 col = mix(hue(hh), vec3(1., .84, .22), step(.62, k.x)*.7);
      float shape;
      if(L==1 && h.w > .35){
        float R = 13. + 19.*k.z;
        vec2 aq = abs(q)/R;
        shape = smoothstep(1., .5, sqrt(aq.x) + sqrt(aq.y)) + .5*smoothstep(R*.3, 0., length(q));
        col = mix(col, vec3(1.), .25*shape);
      } else {
        float R = 3. + 5.5*k.z*k.z;
        shape = smoothstep(R, R*.35, length(q))*.85;
      }
      acc += col*shape*b;
    }
  }
  return acc;
}

/* sunburst behind the figure, a rainbow sheen that slides with the tilt, and the foil */
vec3 backdrop(vec2 a){
  vec2 d = a - SUN;
  float r = length(d), an = atan(d.y, d.x);
  float k = sin(an*RAYS + .9 + .35*sin(an*2. + 1.3) + .25*sin(an*5.));
  float w = .42 + 30./max(r, 30.);
  float ray = smoothstep(-w, w, k + .12);
  vec3 col = mix(RAY_DARK, RAY_LIGHT, ray);
  col *= mix(1.1, .46, smoothstep(140., 780., r));
  col *= .8 + .36*fbm(a*.0075 + 3.);
  float s = dot(a/ART.zw - .5, vec2(.8, .6)) - uTilt.x*.75 - uTilt.y*.5;
  col += hue(s*1.4 + .05)*exp(-s*s*9.)*.085*(.6 + .4*ray);
  col += sparkles(a)*1.1;
  return col;
}

/* how much of the head turn a point of the cut-out follows */
float headW(vec2 P){
  float e = length((P - HEAD_C)/HEAD_R);
  float w = 1. - smoothstep(1., 1.5, e);
  if(STILL.w > 0.) w *= smoothstep(STILL.z, STILL.w, length(P - STILL.xy));
  return w;
}

vec4 figure(vec2 a){
  vec2 P = (a - FIG.xy)/FIG.zw*FPX;
  P.y = (P.y - FPX.y)*(1. + .006*sin(uT*2.4)) + FPX.y;            // breathing, feet planted
  vec2 Q = P;
  for(int i=0;i<3;i++) Q = PIV + rot(-uTheta*headW(Q))*(P - PIV);  // inverse of the head turn
  vec2 uv = Q/FPX;
  if(uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return vec4(0.);
  vec2 tx = 1.3/FPX;
  vec4 c = texture(uFig, uv)*.4 + .15*(texture(uFig, uv+vec2(tx.x,0.)) + texture(uFig, uv-vec2(tx.x,0.))
         + texture(uFig, uv+vec2(0.,tx.y)) + texture(uFig, uv-vec2(0.,tx.y)));
  vec3 col = c.rgb;
  float l = dot(col, vec3(.3,.59,.11));
  col = mix(vec3(l), col, 1.15);
  col = pow(max(col, 0.), vec3(GAMMA))*.95;                       // card prints are pale; deepen them
  col = mix(col, floor(col*6. + .5)/6., .75);                     // flat cel tones
  col *= mix(TINT, vec3(.97), smoothstep(.4, .8, c.b)*smoothstep(.5, .8, c.r));
  return vec4(clamp(col, 0., 1.), c.a);
}

/* a small flame that lives on the figure, like a tail tip */
vec4 ember(vec2 a){
  ${ember ? `vec2 base = FIG.xy + ${vec(ember.at)}/FPX*FIG.zw;
  vec2 q = (a - base)/${vec([ember.size[0], -ember.size[1]])};
  if(q.y < -.05 || q.y > 1.25 || abs(q.x) > 1.) return vec4(0.);
  float y = clamp(q.y, 0., 1.2);
  float sway = (fbm(vec2(y*2.2 - uT*3.2, 4.)) - .5)*.55*y;
  float wd = 1.5*sqrt(y)*(1. - y/(1.02 + .14*sin(uT*9.) + .1*sin(uT*14.3)))*(.9 + .3*fbm(vec2(y*5. - uT*5., 9.)));
  float f = wd - abs(q.x - sway);
  float al = smoothstep(0., .035, f);
  vec3 col = mix(F_RIM, F_CORE, smoothstep(.02, .09, f));
  float fl = fbm(vec2(q.x*7., q.y*9. - uT*4.));
  col = mix(col, F_DARK, step(.74, fl)*step(.25, y)*step(.1, f)*.9);
  return vec4(col, al);` : 'return vec4(0.);'}
}

/* the breath: a flat, cel-shaded cone that goes ragged as the power comes up */
vec4 breath(vec2 c, float px){
  ${breath ? '' : 'return vec4(0.);'}
  vec2 e = uDir, nr = vec2(e.y, -e.x);
  vec2 d = c - uApex;
  float u = dot(d, e), v = dot(d, nr), p = uPower;
  if(u < -4. || u > 880. || abs(v) > 420.) return vec4(0.);
  float su = u - uT*mix(340., 640., p);
  float up = max(u, 0.);
  float hw = mix(112.*pow(up/210., .6), 158.*pow(up/270., .55), p);
  hw = min(hw, mix(165., 235., p));
  float len = mix(600., 760., p);
  hw *= 1. - smoothstep(len*.5, len, u);
  if(hw < 3.) return vec4(0.);
  float rag = smoothstep(20., 240., u)*(1. + 1.6*smoothstep(.45, 1., u/len));
  float sd = v > 0. ? 1. : -1.;
  float vv = v + (fbm(vec2(u/280. - uT*1.5, 1.7)) - .5)*mix(34., 60., p)*smoothstep(0., 220., u);
  float e1 = nz(vec2(su/mix(200., 130., p), sd*5.3 + 2.)) - .5;       // long licks, one set per side
  float e2 = nz(vec2(su/46., sd*3.1 + vv/90. + 9.)) - .5;             // small teeth
  float f = 1. - abs(vv)/hw + e1*mix(.22, .62, p)*(.3 + .7*rag) + e2*mix(.06, .5, p)*rag;
  f = min(f, (u + 2.)/10.);
  float al = clamp(f*hw/(px*1.6), 0., 1.);
  if(al <= 0.) return vec4(0.);
  float lower = clamp(vv/hw, -1., 1.);
  float rim = step(f, .06 + .1*e2 + .05*p + .05*max(lower, 0.));
  float pat = step(mix(1.2, .1, p*(1. - smoothstep(40., 250., u))) - .25*lower, nz(vec2(su/210., vv/75. + 11.)));
  float hole = step(mix(.93, .76, p) + .5*(1. - smoothstep(140., 330., u)), nz(vec2(su/125., vv/44. + 23.)))*step(.1, f);
  vec3 col = mix(F_CORE, F_RIM, max(rim, pat));
  col = mix(col, F_DARK, hole);
  return vec4(col, al);
}

void main(){
  // cast a ray from the camera through this pixel onto the tilted window
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 P = ((frag - uStage.xy)/uStage.z - uCard.xy)/uCard.z;
  vec3 n = uR[2];
  float tt = -CAM*n.z/(P.x*n.x + P.y*n.y - CAM*n.z);
  vec3 hit = vec3(0., 0., CAM) + tt*vec3(P, -CAM);
  vec2 c = vec2(dot(hit, uR[0]), dot(hit, uR[1])) + WIN*.5;
  float px = max(length(dFdx(c)), length(dFdy(c)));

  vec3 col = vec3(1.);
  vec2 bd = abs(c - WIN*.5) - WIN*.5;
  float inWin = 1. - smoothstep(-px, px*.5, max(bd.x, bd.y));
  if(inWin > 0.){
    vec3 w = texture(uChrome, c/WIN).rgb;
    vec2 a = c - ART.xy;
    vec2 ad = abs(a - ART.zw*.5) - ART.zw*.5;
    float inArt = 1. - smoothstep(-px, px*.5, max(ad.x, ad.y));
    if(inArt > 0.){
      vec3 art = backdrop(a);
      vec4 fg = figure(a);
      art = mix(art, fg.rgb, fg.a);
      vec4 em = ember(a);
      art = mix(art, em.rgb, em.a);
      w = mix(w, art, inArt);
    }
    col = mix(col, w, inWin);
  }
  vec4 br = breath(c, px);
  col = mix(col, br.rgb, br.a);
  o = vec4(col, mix(inWin, .5, br.a));   // alpha marks coverage: 1 window, .5 breath, 0 paper
}`;
}

/* pass 2: a CRT in front of everything. Paper (alpha 0) stays white. */
export const CRT = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uScene;
uniform vec2 uRes;
uniform float uT, uUnit;
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx)*.1031); q += dot(q, q.yzx + 33.33); return fract((q.x+q.y)*q.z); }
void main(){
  vec2 px = 1./uRes;
  vec2 uv = gl_FragCoord.xy*px;
  float line = floor(gl_FragCoord.y/(2.*uUnit));
  uv.x += (h21(vec2(line, floor(uT*30.))) - .5)*1.3*uUnit*px.x;       // scanline wobble
  float ab = 1.5*uUnit*px.x;                                           // colour fringing
  vec3 c = vec3(texture(uScene, uv + vec2(ab, 0.)).r, texture(uScene, uv).g, texture(uScene, uv - vec2(ab, 0.)).b);
  float cov = texture(uScene, uv).a;
  vec3 bl = vec3(0.);
  for(int i=0;i<4;i++){
    float a = float(i)*1.5708 + .6;
    bl += texture(uScene, uv + vec2(cos(a), sin(a))*3.5*uUnit*px).rgb;
  }
  c = mix(c, max(c, bl*.25), .35) + bl*.25*.12;                        // phosphor bloom

  // aperture grille: one colour stripe per column, three columns per triad
  float x = gl_FragCoord.x/max(3., 3.*uUnit);
  vec3 m = .5 + .5*cos(6.2832*(x - vec3(0., 1./3., 2./3.)));
  m = pow(max(m, vec3(0.)), vec3(1.3));                                // max(): pow of a negative is NaN
  c = clamp(c, 0., 1.);
  float lum = dot(c, vec3(.3, .59, .11));
  vec3 gr = .42 + 1.22*m;
  gr = mix(gr, vec3(1.), .6*smoothstep(.4, .75, lum));                 // bright areas: paler, finer lines
  c *= mix(vec3(1.), gr, .8);
  c *= 1. - .09*(.5 + .5*cos(6.2832*gl_FragCoord.y/max(4., 4.*uUnit)));
  c *= .97 + .03*sin(uT*50.);
  c += (h21(gl_FragCoord.xy + fract(uT)*91.) - .5)*.03;
  c = pow(clamp(c, 0., 1.), vec3(.94));
  c = mix(vec3(1.), c, smoothstep(0., .22, cov));
  o = vec4(c, 1.);
}`;
