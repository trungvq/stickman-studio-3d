import * as THREE from 'three';
import { INK } from './khoi';
import { G, LIGHTING, MAX_LAMP_SHADOWS } from './npr';

const POST_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Nhân bán cầu cố định cho bóng tiếp xúc: mẫu dồn về gần tâm.
const AO_N = 12;
const AO_KERNEL = Array.from({ length: AO_N }, (_, i) => {
  const a = i * 2.39996, z = 0.15 + 0.85 * ((i * 7) % AO_N) / AO_N, r = Math.sqrt(1 - z * z);
  const s = 0.15 + 0.85 * ((i + 1) / AO_N) ** 2;
  return `vec3(${(Math.cos(a) * r * s).toFixed(4)}, ${(Math.sin(a) * r * s).toFixed(4)}, ${(z * s).toFixed(4)})`;
}).join(', ');

// Nét bóng dáng của vật liệu `userData.ink`: mầm là điểm ngay ngoài mép vật, loang bằng jump flood. Mầm `s` = (độ lệch
// tới mầm gói một số, mã·1024 + bán kính px, độ sâu vật, độ đậm); `uInk[mã]` = (bề dày three, khe vật liệu); chỉ dò trong
// các khung điểm ảnh (gồm cả hai mép) ôm vật có nét và bán kính nét. Cùng vật
// liệu (lọn cắm vào vỏ tóc) thì nét nhạt dần theo khe sâu ở mép; vật khác thì nét chỉ dừng ở chỗ nó nằm hẳn trước.
const MAX_INK = 128, MAX_RECTS = 8;
const INK_GLSL = /* glsl */ `
uniform vec2 uInk[${MAX_INK}];
ivec2 inkClamp(ivec2 q, vec4 r){ return clamp(q, ivec2(r.xy), ivec2(r.zw)); }
float linz(float d){ float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
vec2 inkOff(vec4 s){ return vec2(mod(s.x, 2048.0), floor(s.x / 2048.0)) - 1024.0; }
float inkPack(vec2 o){ return o.x + 1024.0 + (o.y + 1024.0) * 2048.0; }
float inkGate(float idp, float zp, vec4 s){
  float ids = floor(s.y / 1024.0);
  if (s.z < 0.0 || ids == idp) return 0.0;
  float w = uInk[int(ids)].x;
  return smoothstep(-3.0 * w, -2.0 * w, zp - s.z);
}
float inkReach(vec4 s){ return s.y - floor(s.y / 1024.0) * 1024.0 - length(inkOff(s)); }
`;

// uStep 0 gieo mầm; còn lại một bước loang, mỗi điểm giữ mầm phủ xa nhất trong chín điểm cách `uStep`.
const JFA_FRAG = /* glsl */ `
uniform highp sampler2D tPrev, tId, tZ;
uniform vec2 uRes;
uniform float uNear, uFar, uStep;
uniform vec4 uRect;
uniform mat4 uProj;
${INK_GLSL}
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  float idp = texelFetch(tId, p, 0).r, zp = linz(texelFetch(tZ, p, 0).r);
  vec4 best = vec4(0.0, 0.0, -1.0, 0.0);
  if (uStep < 0.5) {
    // vật có nét gần nhất trong tám điểm kề; khe sâu đo tới điểm kề thẳng xa nhất của nó (sát mép nhất), không thì sọc theo bậc thang của mép
    float idb = 0.0, zb = 1e9, ze = 0.0;
    for (int i = 0; i < 9; i++) {
      ivec2 q = inkClamp(p + ivec2(i % 3 - 1, i / 3 - 1), uRect);
      float idq = texelFetch(tId, q, 0).r, zq = linz(texelFetch(tZ, q, 0).r);
      if (idq > 0.5 && idq != idp && zq < zb) {
        idb = idq;
        zb = zq;
      }
    }
    if (idb < 0.5) {
      gl_FragColor = best;
      return;
    }
    for (int i = 1; i < 9; i += 2) {
      ivec2 q = inkClamp(p + ivec2(i % 3 - 1, i / 3 - 1), uRect);
      if (texelFetch(tId, q, 0).r == idb) ze = max(ze, linz(texelFetch(tZ, q, 0).r));
    }
    vec2 k = uInk[int(idb)];
    float edge = uInk[int(idp)].y != k.y ? 1.0 : ze > 0.0 ? smoothstep(0.1 * k.x, 0.6 * k.x, zp - ze) : 0.0;
    best = vec4(inkPack(vec2(0.0)), idb * 1024.0 + min(k.x * uProj[1][1] * uRes.y * 0.5 / zb, 1000.0), zb, edge);
    if (best.w <= 0.0 || inkGate(idp, zp, best) <= 0.0) best.z = -1.0;
    gl_FragColor = best;
    return;
  }
  float m = -1e9;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    ivec2 q = p + ivec2(x, y) * int(uStep);
    if (q != inkClamp(q, uRect)) continue;
    vec4 s = texelFetch(tPrev, q, 0);
    vec2 o = inkOff(s) + vec2(q - p);
    if (s.z < 0.0 || abs(o.x) > 1000.0 || abs(o.y) > 1000.0) continue;
    s.x = inkPack(o);
    if (inkGate(idp, zp, s) <= 0.0) continue;
    float k = inkReach(s);
    if (k > m) {
      m = k;
      best = s;
    }
  }
  gl_FragColor = best;
}`;

// Độ phủ nét từ mầm đã loang, ra mặt nạ một kênh cho lượt hậu kỳ.
const INK_FRAG = /* glsl */ `
uniform highp sampler2D tSil, tId, tZ;
uniform float uNear, uFar, uThick;
uniform vec4 uRect;
${INK_GLSL}
void main(){
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(tSil, p, 0);
  float ink = 0.0;
  if (s.z >= 0.0 && inkReach(s) > -0.5) {
    // độ sâu ở mép vật nhảy theo điểm ảnh: độ đậm lấy trung bình mầm quanh đây cùng vật
    float ids = floor(s.y / 1024.0), w = 0.0, n = 0.0;
    int d = max(1, int(uThick + 0.5));
    for (int i = 0; i < 25; i++) {
      vec4 t = texelFetch(tSil, inkClamp(p + ivec2(i % 5 - 2, i / 5 - 2) * d, uRect), 0);
      if (t.z >= 0.0 && floor(t.y / 1024.0) == ids) {
        w += t.w;
        n += 1.0;
      }
    }
    ink = inkGate(texelFetch(tId, p, 0).r, linz(texelFetch(tZ, p, 0).r), s) * w / max(n, 1.0) * clamp(inkReach(s) + 0.5, 0.0, 1.0);
  }
  gl_FragColor = vec4(ink);
}`;

// Nét mực: Laplacian của 1/độ sâu — chỗ độ sâu gãy (mép, nếp gấp) thì tối đi; cạnh gấp (pháp tuyến gãy, độ sâu liền) cũng
// tối. Bóng tiếp xúc từ độ sâu, hạt giấy, tối góc.
const POST_FRAG = /* glsl */ `
uniform sampler2D tColor, tDepth, tNormal, tInk;
uniform vec2 uRes;
uniform float uNear, uFar, uOutline, uThick, uPixel, uPaper, uAo, uAoRadius, uSil;
uniform vec3 uInkColor;
uniform mat4 uProj, uProjInv;
uniform vec3 uShadowTint;
varying vec2 vUv;
const vec3 AOK[${AO_N}] = vec3[](${AO_KERNEL});
float invz(float d){ float z = d * 2.0 - 1.0; return (uFar + uNear - z * (uFar - uNear)) / (2.0 * uNear * uFar); }
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
vec3 vpos(vec2 uv){ vec4 p = uProjInv * vec4(uv * 2.0 - 1.0, texture2D(tDepth, uv).r * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
// SSAO bán cầu theo pháp tuyến dựng lại từ độ sâu; hướng xoay theo ô 4×4 điểm ảnh nên tất định.
float ssao(vec2 uv){
  vec3 P = vpos(uv);
  vec2 e = 1.0 / uRes;
  vec3 pl = vpos(uv - vec2(e.x, 0.0)), pr = vpos(uv + vec2(e.x, 0.0)), pd = vpos(uv - vec2(0.0, e.y)), pu = vpos(uv + vec2(0.0, e.y));
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
  vec3 N = normalize(cross(dx, dy));
  float a = h12(mod(floor(gl_FragCoord.xy), 4.0) + 7.0) * 6.2832;
  vec3 rv = vec3(cos(a), sin(a), 0.0);
  vec3 Tn = normalize(rv - N * dot(rv, N)), B = cross(N, Tn);
  float occ = 0.0;
  for (int i = 0; i < ${AO_N}; i++) {
    vec3 S = P + (Tn * AOK[i].x + B * AOK[i].y + N * AOK[i].z) * uAoRadius;
    vec4 c = uProj * vec4(S, 1.0);
    vec2 su = c.xy / c.w * 0.5 + 0.5;
    if (su.x < 0.0 || su.x > 1.0 || su.y < 0.0 || su.y > 1.0) continue;
    float sz = vpos(su).z;
    occ += step(S.z + 0.02, sz) * smoothstep(0.0, 1.0, uAoRadius / abs(P.z - sz));
  }
  return occ / float(${AO_N});
}
void main(){
  vec2 px = uThick / uRes;
  vec3 col = texture2D(tColor, vUv).rgb;
  float d0 = texture2D(tDepth, vUv).r;
  float w0 = invz(d0);
  float wl = invz(texture2D(tDepth, vUv - vec2(px.x, 0.0)).r);
  float wr = invz(texture2D(tDepth, vUv + vec2(px.x, 0.0)).r);
  float wu = invz(texture2D(tDepth, vUv + vec2(0.0, px.y)).r);
  float wd = invz(texture2D(tDepth, vUv - vec2(0.0, px.y)).r);
  vec4 n0 = texture2D(tNormal, vUv);
  // lưới người (a 0,3) không nhận: cằm sát cổ áo, tay sát thân thành vệt lem; bóng đổ của đèn đã đủ
  if (uAo > 0.0 && d0 < 0.99999 && abs(n0.a - 0.3) > 0.05) {
    float o = smoothstep(0.08, 0.55, ssao(vUv)) * uAo;
    col *= mix(vec3(1.0), uShadowTint * 0.8, clamp(o, 0.0, 1.0) * 0.75);
  }
  float lap = (4.0 * w0 - wl - wr - wu - wd) / w0;
  float crease = 0.0;
  vec3 a = n0.xyz * 2.0 - 1.0;
  vec2 off[4] = vec2[](vec2(-px.x, 0.0), vec2(px.x, 0.0), vec2(0.0, px.y), vec2(0.0, -px.y));
  float wn[4] = float[](wl, wr, wu, wd);
  vec4 nbs[4];
  for (int i = 0; i < 4; i++) nbs[i] = texture2D(tNormal, vUv + off[i]);
  // lưới người (a 0,3) nhìn sượt: Laplacian bắt cạnh tam giác thành vụn dọc viền. Mặt cong dốc đổi rồi giữ là gấp lưới, bỏ; bậc (dốc
  // vọt rồi về, lọn tóc chồng nhau) và mặt phẳng giữ. Bước nguyên: uThick lẻ nửa điểm ảnh thì ±1, ±2 bước làm tròn lệch, giả ra bậc
  ivec2 p = ivec2(gl_FragCoord.xy), hi = textureSize(tDepth, 0) - 1, k = ivec2(max(1, int(uThick + 0.5)), 0);
  #define N(o) texelFetch(tNormal, clamp(p + (o), ivec2(0), hi), 0)
  #define ON(o, c) (abs(N(o).a - 0.3) < 0.05 && dot(a, N(o).xyz * 2.0 - 1.0) > c)
  if (abs(n0.a - 0.3) < 0.05 && ON(-k, 0.95) && ON(k, 0.95) && ON(-k.yx, 0.95) && ON(k.yx, 0.95)) {
    #define W(o) invz(texelFetch(tDepth, clamp(p + (o), ivec2(0), hi), 0).r)
    vec2 m2 = vec2(W(-2 * k), W(-2 * k.yx)), m1 = vec2(W(-k), W(-k.yx)), p1 = vec2(W(k), W(k.yx)), p2 = vec2(W(2 * k), W(2 * k.yx));
    #undef W
    // độ đổi dốc ở điểm trước, ở đây, ở điểm sau; "về" phải qua ngưỡng nét, điểm thứ hai ra khỏi mặt thì phía ấy không tính
    vec2 c0 = w0 - 2.0 * m1 + m2, c1 = m1 + p1 - 2.0 * w0, c2 = w0 - 2.0 * p1 + p2;
    vec2 m = max(0.5 * abs(c1), vec2(0.0025 * w0));
    bvec2 on0 = bvec2(ON(-2 * k, 0.9), ON(-2 * k.yx, 0.9)), on2 = bvec2(ON(2 * k, 0.9), ON(2 * k.yx, 0.9));
    bvec2 back0 = bvec2(on0.x && c0.x * c1.x < 0.0 && abs(c0.x) > m.x, on0.y && c0.y * c1.y < 0.0 && abs(c0.y) > m.y);
    bvec2 back2 = bvec2(on2.x && c2.x * c1.x < 0.0 && abs(c2.x) > m.x, on2.y && c2.y * c1.y < 0.0 && abs(c2.y) > m.y);
    // mặt phẳng: pháp tuyến y hệt nhau
    #define BEND(o) (1.0 - dot(a, N(o).xyz * 2.0 - 1.0))
    float bend = max(max(BEND(-k), BEND(k)), max(BEND(-k.yx), BEND(k.yx)));
    #undef BEND
    if (bend > 2e-5 && !any(back0) && !any(back2)) lap = 0.0;
  }
  #undef ON
  #undef N
  if (n0.a > 0.75) {
    for (int i = 0; i < 4; i++) {
      // độ sâu gãy là mép bóng dáng, Laplacian đã vẽ: chỉ xét cạnh gấp trên cùng một mặt liền
      if (nbs[i].a > 0.75 && abs(wn[i] - w0) < w0 * 0.01) crease = max(crease, 1.0 - dot(a, nbs[i].xyz * 2.0 - 1.0));
    }
  }
  // nét gấp dày theo điểm ảnh: đồ nhỏ ở xa nhạt dần cho khỏi đen kịt
  crease = smoothstep(0.25, 0.45, crease) * mix(1.0, 0.35, smoothstep(8.0, 25.0, 1.0 / w0));
  float edge = max(smoothstep(0.0025, 0.01, lap), crease) * uOutline;
  col = mix(col, col * vec3(0.2, 0.18, 0.26), edge * 0.92);
  if (uSil > 0.5) col = mix(col, uInkColor, texelFetch(tInk, ivec2(gl_FragCoord.xy), 0).r);
  vec2 fc = vUv * uRes;
  if (uPixel > 0.5) col = floor(col * 14.0 + 0.5 + bayer4(fc) - 0.5) / 14.0;
  else if (uPaper > 0.5) col *= 0.975 + 0.05 * h12(floor(gl_FragCoord.xy));
  float v = length(vUv - 0.5) * 1.35;
  if (uPaper > 0.5) col *= mix(1.0, 0.86, smoothstep(0.45, 1.05, v));
  gl_FragColor = vec4(col, 1.0);
}`;

// Hậu kỳ toàn khung, chỉ theo `t`: nhoè (hồi tưởng), giảm bão hoà, tối nền, nhiễu băng tua.
const GRADE_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 uRes;
uniform float uDesat, uBlur, uDarken, uVhs, uTime;
varying vec2 vUv;
float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 tap(vec2 uv){ return texture2D(tColor, uv).rgb; }
vec3 blurred(vec2 uv){
  if (uBlur <= 0.0) return tap(uv);
  vec2 k = vec2(uRes.y / uRes.x, 1.0) * uBlur * 0.012;
  vec3 s = tap(uv);
  float w = 1.0;
  for (int i = 1; i < 32; i++) {
    float f = float(i), r = sqrt(f / 31.0), a = f * 2.39996, wi = 1.0 - 0.5 * r;
    s += tap(uv + vec2(cos(a), sin(a)) * r * k) * wi;
    w += wi;
  }
  return s / w;
}
void main(){
  vec2 uv = vUv;
  float fr = floor(uTime * 30.0), row = floor(gl_FragCoord.y / 2.0), band = 0.0;
  if (uVhs > 0.0) {
    band = 1.0 - smoothstep(0.0, 0.05, abs(uv.y - fract(-uTime * 0.23)));
    uv.x += ((h12(vec2(row, fr)) - 0.5) * 0.004 + band * (h12(vec2(row * 0.37, fr + 3.0)) - 0.3) * 0.03 + sin(uv.y * 40.0 + uTime * 6.0) * 0.0015) * uVhs;
  }
  vec3 col = blurred(uv);
  if (uVhs > 0.0) {
    float ca = 0.003 * uVhs;
    col.r = mix(col.r, tap(uv + vec2(ca, 0.0)).r, 0.8);
    col.b = mix(col.b, tap(uv - vec2(ca, 0.0)).b, 0.8);
    col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))), 0.25 * uVhs);
    col *= 1.0 - 0.09 * uVhs * step(2.0, mod(floor(gl_FragCoord.y), 3.0));
    col += (h12(gl_FragCoord.xy + fr * 13.1) - 0.5) * 0.14 * uVhs;
    col += band * step(0.55, h12(vec2(floor(gl_FragCoord.x / 3.0), row + fr))) * 0.4 * uVhs;
  }
  col = mix(col, vec3(dot(col, vec3(0.299, 0.587, 0.114))), uDesat);
  col = mix(col, col * vec3(0.3, 0.32, 0.4), uDarken);
  gl_FragColor = vec4(col, 1.0);
}`;

// Khử răng cưa bằng siêu lấy mẫu: vẽ cả cảnh lẫn nét mực ở `ss` lần mỗi chiều rồi thu về khung.
// FXAA làm nhoè nét mực mảnh; MSAA không resolve độ sâu nên nét mực dò từ độ sâu mất hẳn.
export const AA = { off: 1, 'ss1.5': 1.5, ss2: 2 } as const;
export type AaMode = keyof typeof AA;

export interface PipelineOptions {
  /** Hộp ống kính bóng của đèn chính nhập tay: nửa cạnh và tâm (three). Bỏ trống thì tự ôm vùng camera thấy trong hộp cảnh. */
  shadow?: { half: number; center: THREE.Vector3 };
  /** Cạnh bản đồ bóng đèn chính; nắng qua cửa và đèn rọi dùng nửa cạnh. */
  shadowSize?: number;
}

/** Hậu kỳ toàn khung, mỗi mục 0–1. */
export interface Grade {
  /** Giảm bão hoà */
  desaturate?: number;
  /** Nhoè cả khung (hồi tưởng) */
  blur?: number;
  /** Tối nền dưới lớp 2D */
  darken?: number;
  /** Nhiễu băng tua ngược: rung dòng, lệch màu, vạch quét, dải nhiễu trôi theo `t` */
  vhs?: number;
}

export interface RenderOptions {
  outline?: boolean;
  /** Giây của khung: nhiễu băng chạy theo nó */
  t?: number;
  grade?: Grade;
  /** Hạt giấy và tối góc; tắt thì màu mỗi điểm ảnh chỉ còn theo cảnh, tách nền được (`portrait`) */
  paper?: boolean;
}

export interface Pipeline {
  /** Cỡ khung CSS px; `pixel` vẽ ở ~360 px cạnh ngắn rồi phóng lên, bỏ `aa`. */
  setSize(w: number, h: number, o?: { aa?: AaMode; pixel?: boolean }): void;
  /** Một khung: bản đồ bóng của mọi đèn, cảnh, nét mực và bóng tiếp xúc, hậu kỳ. Đèn (`setPalette`, `setLights`) phải đã đặt cho khung này. */
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, o?: RenderOptions): void;
  /** Huỷ render target, texture độ sâu và vật liệu của pipeline; renderer và cảnh không đụng tới */
  dispose(): void;
}

const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
const _v = new THREE.Vector3(), _b = new THREE.Box3(), _p = new THREE.Vector2();

function shadowTarget(size: number) {
  return new THREE.WebGLRenderTarget(size, size, { depthTexture: new THREE.DepthTexture(size, size) });
}

function boxCorners(b: THREE.Box3) {
  const out: THREE.Vector3[] = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new THREE.Vector3(x, y, z));
  return out;
}

/** Góc khối nhìn của camera, cắt mặt xa ở chỗ xa nhất của hộp cảnh. */
function frustumPoints(camera: THREE.PerspectiveCamera, box: THREE.Box3 | null) {
  const inv = camera.matrixWorldInverse;
  let far = camera.far;
  if (box) far = Math.min(far, Math.max(camera.near + 0.1, ...boxCorners(box).map((p) => -p.applyMatrix4(inv).z)));
  const out: THREE.Vector3[] = [];
  for (const x of [-1, 1])
    for (const y of [-1, 1]) {
      const n = new THREE.Vector3(x, y, -1).applyMatrix4(camera.projectionMatrixInverse);
      const f = new THREE.Vector3(x, y, 1).applyMatrix4(camera.projectionMatrixInverse);
      f.multiplyScalar(far / -f.z);
      out.push(n.applyMatrix4(camera.matrixWorld), f.applyMatrix4(camera.matrixWorld));
    }
  return out;
}

/**
 * Ống kính trực giao nhìn theo −`dir` ôm vùng `region` (cắt theo hộp `box` nếu có), chiều sâu ôm cả hộp để vật che ngoài
 * khung vẫn đổ bóng vào. Tâm bám lưới texel, cỡ làm tròn bậc, nên camera trôi thì bóng không lăn tăn. Trả cỡ texel.
 */
function fitOrtho(cam: THREE.OrthographicCamera, dir: THREE.Vector3, region: THREE.Vector3[], box: THREE.Box3 | null, size: number) {
  cam.up.set(0, 1, 0);
  if (Math.abs(dir.y) > 0.9) cam.up.set(0, 0, -1);
  cam.position.set(0, 0, 0);
  cam.lookAt(_v.copy(dir).negate());
  cam.updateMatrixWorld();
  const inv = cam.matrixWorldInverse;
  const r = new THREE.Box3().setFromPoints(region.map((p) => p.clone().applyMatrix4(inv)));
  if (box) {
    const lb = new THREE.Box3().setFromPoints(boxCorners(box).map((p) => p.applyMatrix4(inv)));
    r.min.x = Math.max(r.min.x, lb.min.x);
    r.min.y = Math.max(r.min.y, lb.min.y);
    r.max.x = Math.min(r.max.x, lb.max.x);
    r.max.y = Math.min(r.max.y, lb.max.y);
    r.min.z = Math.min(r.min.z, lb.min.z);
    r.max.z = Math.max(r.max.z, lb.max.z);
  }
  if (r.max.x <= r.min.x || r.max.y <= r.min.y) r.max.x = r.min.x + 1, r.max.y = r.min.y + 1;
  const q = 0.25;
  const hx = Math.ceil(((r.max.x - r.min.x) / 2 + 0.2) / q) * q, hy = Math.ceil(((r.max.y - r.min.y) / 2 + 0.2) / q) * q;
  const tx = (2 * hx) / size, ty = (2 * hy) / size;
  const cx = Math.round((r.min.x + r.max.x) / 2 / tx) * tx, cy = Math.round((r.min.y + r.max.y) / 2 / ty) * ty;
  const top = r.max.z + 1;
  cam.position.set(cx, cy, top).applyMatrix4(cam.matrixWorld);
  cam.left = -hx;
  cam.right = hx;
  cam.top = hy;
  cam.bottom = -hy;
  cam.near = 0;
  cam.far = top - r.min.z + 0.5;
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  return Math.max(tx, ty);
}

/**
 * Pipeline vẽ trên một `WebGLRenderer`: bản đồ bóng cho đèn chính (trực giao), nắng qua cửa sổ (trực giao, cắt ở mặt tường)
 * và tối đa `MAX_LAMP_SHADOWS` đèn rọi (phối cảnh); cảnh vào render target có độ sâu, pháp tuyến vào một lượt riêng; lượt hậu kỳ
 * dò nét mực (mép độ sâu, cạnh gấp pháp tuyến) và bóng tiếp xúc; lượt cuối chấm hậu kỳ toàn khung. Vật `userData.noShadow` và
 * vỏ ngược (`BackSide`) không đổ bóng; vật `userData.noCrease` (người que) không có nét cạnh gấp; vật liệu `userData.ink` (`npr({ ink })`)
 * có nét bóng dáng dò ở hậu kỳ, cả khi tắt `outline` như vỏ ngược; các mesh cùng `userData.inkChain` và cùng vật liệu chung một
 * mã vật, chỗ nối không có nét.
 */
export function createPipeline(renderer: THREE.WebGLRenderer, { shadow, shadowSize = 2048 }: PipelineOptions = {}): Pipeline {
  renderer.localClippingEnabled = true;
  const SM = shadowSize, SM2 = shadowSize / 2;
  const keyRT = shadowTarget(SM), sunRT = shadowTarget(SM2);
  const spotRT = Array.from({ length: MAX_LAMP_SHADOWS }, () => shadowTarget(SM2));
  const keyCam = new THREE.OrthographicCamera(), sunCam = new THREE.OrthographicCamera();
  const spotCam = new THREE.PerspectiveCamera();
  const depthMat = (clip = false) => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false, clippingPlanes: clip ? [new THREE.Plane()] : null });
  const plainDepth = depthMat(), keyDepth = depthMat(true), sunDepth = depthMat(true);
  G.uShadowMap.value = keyRT.depthTexture;
  G.uShadowTexel.value = 1 / SM;
  G.uSunMap.value = sunRT.depthTexture;
  G.uSunInfo.value.x = 1 / SM2;
  G.uSpotMap0.value = spotRT[0].depthTexture;
  G.uSpotMap1.value = spotRT[1].depthTexture;

  const mainRT = new THREE.WebGLRenderTarget(4, 4, { depthTexture: new THREE.DepthTexture(4, 4) });
  const inkRT = new THREE.WebGLRenderTarget(4, 4);
  const normalRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, count: 2, depthTexture: new THREE.DepthTexture(4, 4) });
  normalRT.textures[1].minFilter = normalRT.textures[1].magFilter = THREE.NearestFilter;
  const jfaRT = [0, 1].map(() => new THREE.WebGLRenderTarget(4, 4, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false }));
  const inkTable = Array.from({ length: MAX_INK }, () => new THREE.Vector2());
  const maskRT = new THREE.WebGLRenderTarget(4, 4, { format: THREE.RedFormat, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
  let rw = 4, rh = 4;
  // pháp tuyến hệ nhìn, mặt sau lật lại; a: 1 có nét gấp, 0,5 vật `noCrease`, 0,3 lưới người (`body`), 0 không có vật. Đích thứ hai: mã vật có nét bóng dáng
  const normalMat = (a: number, id: number) => new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `layout(location = 1) out highp vec4 gInk; varying vec3 vN;
      void main(){ vec3 n = normalize(gl_FrontFacing ? vN : -vN); gl_FragColor = vec4(n * 0.5 + 0.5, ${a.toFixed(1)}); gInk = vec4(${id}.0, 0.0, 0.0, 1.0); }`,
  });
  // decal giữ độ lệch sâu của vật liệu gốc, không thì giành điểm ảnh với mặt dưới nó thành nét lấm chấm
  const normalMats = new Map<string, THREE.ShaderMaterial>();
  const normalFor = (m: THREE.Mesh, src: THREE.Material, id: number) => {
    const a = m.userData.body ? 0.3 : m.userData.noCrease ? 0.5 : 1, key = `${a} ${id}` + (src.polygonOffset ? ` ${src.polygonOffsetFactor} ${src.polygonOffsetUnits}` : '');
    let mat = normalMats.get(key);
    if (!mat) {
      normalMats.set(key, (mat = normalMat(a, id)));
      if (src.polygonOffset) Object.assign(mat, { polygonOffset: true, polygonOffsetFactor: src.polygonOffsetFactor, polygonOffsetUnits: src.polygonOffsetUnits });
    }
    return mat;
  };
  const postMat = new THREE.ShaderMaterial({
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tColor: { value: mainRT.texture },
      tDepth: { value: mainRT.depthTexture },
      tNormal: { value: normalRT.texture },
      tInk: { value: maskRT.texture },
      uSil: { value: 0 },
      uInkColor: { value: new THREE.Color(INK) },
      uRes: { value: new THREE.Vector2() },
      uNear: { value: 0 },
      uFar: { value: 0 },
      uOutline: { value: 1 },
      uThick: { value: 1 },
      uPixel: { value: 0 },
      uPaper: { value: 1 },
      uAo: { value: 1 },
      uAoRadius: { value: 0.35 },
      uProj: { value: new THREE.Matrix4() },
      uProjInv: { value: new THREE.Matrix4() },
      uShadowTint: G.uShadowTint,
    },
  });
  const jfaMat = new THREE.ShaderMaterial({
    vertexShader: POST_VERT,
    fragmentShader: JFA_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tPrev: { value: null },
      tId: { value: normalRT.textures[1] },
      tZ: { value: normalRT.depthTexture },
      uRes: { value: new THREE.Vector2() },
      uNear: { value: 0 },
      uFar: { value: 0 },
      uStep: { value: 0 },
      uProj: { value: new THREE.Matrix4() },
      uInk: { value: inkTable },
      uRect: { value: new THREE.Vector4() },
    },
  });
  const maskMat = new THREE.ShaderMaterial({
    vertexShader: POST_VERT,
    fragmentShader: INK_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tSil: { value: null },
      tId: { value: normalRT.textures[1] },
      tZ: { value: normalRT.depthTexture },
      uNear: jfaMat.uniforms.uNear,
      uFar: jfaMat.uniforms.uFar,
      uThick: postMat.uniforms.uThick,
      uRect: jfaMat.uniforms.uRect,
      uInk: { value: inkTable },
    },
  });
  const gradeMat = new THREE.ShaderMaterial({
    vertexShader: POST_VERT,
    fragmentShader: GRADE_FRAG,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tColor: { value: inkRT.texture },
      uRes: { value: new THREE.Vector2() },
      uDesat: { value: 0 },
      uBlur: { value: 0 },
      uDarken: { value: 0 },
      uVhs: { value: 0 },
      uTime: { value: 0 },
    },
  });
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
  quad.frustumCulled = false;
  postScene.add(quad);

  const pass = (scene: THREE.Scene, cam: THREE.Camera, rt: THREE.WebGLRenderTarget, mat: THREE.Material) => {
    scene.overrideMaterial = mat;
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, cam);
  };

  return {
    setSize(w, h, { aa = 'ss2', pixel = false } = {}) {
      renderer.setSize(w, h);
      const dpr = renderer.getPixelRatio();
      const ss = pixel ? 1 : AA[aa];
      const k = pixel ? 360 / Math.min(w, h) : dpr * ss;
      rw = Math.max(1, Math.round(w * k));
      rh = Math.max(1, Math.round(h * k));
      for (const rt of [mainRT, inkRT, normalRT, maskRT, ...jfaRT]) rt.setSize(rw, rh);
      const filt = pixel ? THREE.NearestFilter : THREE.LinearFilter;
      for (const t of [mainRT.texture, inkRT.texture, normalRT.texture]) {
        t.minFilter = t.magFilter = filt;
        t.needsUpdate = true;
      }
      postMat.uniforms.uRes.value.set(rw, rh);
      jfaMat.uniforms.uRes.value.set(rw, rh);
      postMat.uniforms.uThick.value = pixel ? 1 : Math.max(1, dpr * ss * 1.25);
      postMat.uniforms.uPixel.value = pixel ? 1 : 0;
      gradeMat.uniforms.uRes.value.set(Math.round(w * dpr), Math.round(h * dpr));
    },

    render(scene, camera, { outline = true, t = 0, grade = {}, paper = true } = {}) {
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      const hidden: THREE.Object3D[] = [];
      const box = LIGHTING.bounds ? null : new THREE.Box3();
      scene.traverse((o) => {
        o.userData.bend?.();
        const mesh = (o as THREE.Mesh).isMesh ? (o as THREE.Mesh) : null;
        const hull = mesh && (mesh.material as THREE.Material).side === THREE.BackSide;
        if ((o.userData.noShadow || hull) && o.visible) hidden.push(o);
        else if (box && mesh && mesh.visible) {
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          box.union(_b.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld));
        }
      });
      const bounds = LIGHTING.bounds ?? (box!.isEmpty() ? null : box);
      for (const o of hidden) o.visible = false;

      if (G.uKey.value > 0) {
        const dir = G.uLightDir.value;
        if (shadow) {
          const H = shadow.half;
          keyCam.left = keyCam.bottom = -H;
          keyCam.right = keyCam.top = H;
          keyCam.near = 1;
          keyCam.far = 30 + H * 2.5;
          keyCam.up.set(0, 1, 0);
          keyCam.position.copy(dir).multiplyScalar(30).add(shadow.center);
          keyCam.lookAt(shadow.center);
          keyCam.updateProjectionMatrix();
          keyCam.updateMatrixWorld();
          G.uShadowInfo.value.x = (2 * H) / SM;
        } else G.uShadowInfo.value.x = fitOrtho(keyCam, dir, frustumPoints(camera, bounds), bounds, SM);
        G.uShadowInfo.value.y = keyCam.far - keyCam.near;
        G.uShadowMatrix.value.copy(BIAS).multiply(keyCam.projectionMatrix).multiply(keyCam.matrixWorldInverse);
        keyDepth.clippingPlanes = LIGHTING.keyClip ? [LIGHTING.keyClip] : null;
        pass(scene, keyCam, keyRT, keyDepth);
      }

      const win = LIGHTING.window;
      G.uSunInfo.value.z = 0;
      if (G.uSun.value > 0 && win?.shadow) {
        const dir = G.uSunDir.value, floor = bounds ? bounds.min.y : 0;
        const reach = (p: THREE.Vector3) => p.clone().addScaledVector(dir, -(dir.y > 0.05 ? (p.y - floor) / dir.y : 30));
        fitOrtho(sunCam, dir, [...win.corners, ...win.corners.map(reach)], bounds, SM2);
        G.uSunInfo.value.y = sunCam.far - sunCam.near;
        G.uSunInfo.value.z = 1;
        G.uSunMatrix.value.copy(BIAS).multiply(sunCam.projectionMatrix).multiply(sunCam.matrixWorldInverse);
        sunDepth.clippingPlanes = [win.clip];
        pass(scene, sunCam, sunRT, sunDepth);
      }

      for (const l of LIGHTING.lamps) {
        if (l.slot < 0) continue;
        spotCam.fov = Math.min(160, (l.angle * 2.2 * 180) / Math.PI);
        spotCam.aspect = 1;
        spotCam.near = 0.08;
        spotCam.far = l.far;
        spotCam.up.set(0, 1, 0);
        if (Math.abs(_v.copy(l.target).sub(l.pos).normalize().y) > 0.9) spotCam.up.set(0, 0, -1);
        spotCam.position.copy(l.pos);
        spotCam.lookAt(l.target);
        spotCam.updateProjectionMatrix();
        spotCam.updateMatrixWorld();
        G.uSpotMatrix.value[l.slot].copy(BIAS).multiply(spotCam.projectionMatrix).multiply(spotCam.matrixWorldInverse);
        G.uSpotInfo.value[l.slot].set(spotCam.near, spotCam.far, 1 / SM2);
        pass(scene, spotCam, spotRT[l.slot], plainDepth);
      }
      scene.overrideMaterial = null;
      for (const o of hidden) o.visible = true;

      const pu = postMat.uniforms;
      pu.uNear.value = camera.near;
      pu.uFar.value = camera.far;
      pu.uProj.value.copy(camera.projectionMatrix);
      pu.uProjInv.value.copy(camera.projectionMatrixInverse);
      pu.uAo.value = LIGHTING.ao.strength;
      pu.uAoRadius.value = LIGHTING.ao.radius;
      pu.uOutline.value = outline ? 1 : 0;
      pu.uPaper.value = paper ? 1 : 0;
      // vỏ nét ngược không phải mặt thật, vật không ghi độ sâu (kính, lớp nét mặt) không có trong độ sâu: bỏ khỏi lượt pháp tuyến
      const shells: THREE.Object3D[] = [], swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
      const slots = new Map<THREE.Material, number>(), f = (camera.projectionMatrix.elements[5] * rh) / 2;
      const boxes: THREE.Box2[] = [];
      let inks = 0, reach = 0, whole = false;
      const chains = new Map<string, number>();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.visible || Array.isArray(m.material)) return;
        if (m.material.side === THREE.BackSide || !m.material.depthWrite) return void shells.push(m);
        const w: number = m.material.userData.ink ?? 0;
        let id = 0;
        const chain = m.userData.inkChain === undefined ? '' : `${m.userData.inkChain} ${m.material.uuid}`;
        if (w > 0 && (chains.has(chain) || inks < MAX_INK - 1)) {
          if (!slots.has(m.material)) slots.set(m.material, slots.size + 1);
          id = chains.get(chain) ?? ++inks;
          inkTable[id].set(w, slots.get(m.material)!);
          if (chain) chains.set(chain, id);
          if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
          const r = new THREE.Box2();
          boxes.push(r);
          for (const c of boxCorners(_b.copy(m.geometry.boundingBox!).applyMatrix4(m.matrixWorld))) {
            const z = -c.applyMatrix4(camera.matrixWorldInverse).z;
            if (z < camera.near) whole = true;
            else c.applyMatrix4(camera.projectionMatrix), r.expandByPoint(_p.set((c.x + 1) * rw / 2, (c.y + 1) * rh / 2));
            reach = Math.max(reach, (w * f) / Math.max(camera.near, z));
          }
        }
        swapped.push([m, m.material]);
        m.material = normalFor(m, m.material, id);
      });
      if (outline || inks) {
        for (const o of shells) o.visible = false;
        const bg = scene.background, clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
        scene.background = null;
        renderer.setClearColor(0x000000, 0);
        renderer.setRenderTarget(normalRT);
        renderer.clear();
        renderer.render(scene, camera);
        renderer.setClearColor(clear, alpha);
        scene.background = bg;
        for (const o of shells) o.visible = true;
      }
      for (const [m, mat] of swapped) m.material = mat;
      renderer.setRenderTarget(mainRT);
      renderer.render(scene, camera);
      // khung điểm ảnh ôm từng vật có nét và bán kính nét, gộp khung chồng nhau: các lượt loang chỉ vẽ trong đó
      reach = Math.min(reach, 256);
      const screen = new THREE.Box2(new THREE.Vector2(0, 0), new THREE.Vector2(rw, rh));
      let rects = whole ? [screen] : boxes.map((r) => r.expandByScalar(reach + 3).intersect(screen)).filter((r) => !r.isEmpty());
      for (let merged = true; merged; ) {
        merged = false;
        for (let i = 0; i < rects.length && !merged; i++)
          for (let j = i + 1; j < rects.length && !merged; j++)
            if ((merged = rects[i].intersectsBox(rects[j]))) rects[i].union(rects.splice(j, 1)[0]);
      }
      if (rects.length > MAX_RECTS) rects = [rects.reduce((a, r) => a.union(r))];
      pu.uSil.value = rects.length ? 1 : 0;
      if (rects.length) {
        const ju = jfaMat.uniforms;
        ju.uNear.value = camera.near;
        ju.uFar.value = camera.far;
        ju.uProj.value.copy(camera.projectionMatrix);
        // bước đầu đủ lớn để tổng các bước phủ hết bán kính nét lớn nhất
        let k = 1;
        while (2 * k - 1 < reach + 2) k *= 2;
        const steps = [0];
        for (; k >= 1; k /= 2) steps.push(k);
        // mặt nạ xoá cả khung, các lượt sau chỉ vẽ trong khung ôm
        const clear = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
        maskRT.scissorTest = false;
        renderer.setRenderTarget(maskRT);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, false, false);
        let [a, b] = jfaRT;
        const draw = (rt: THREE.WebGLRenderTarget, mat: THREE.ShaderMaterial) => {
          quad.material = mat;
          for (const r of rects) {
            const x0 = Math.floor(r.min.x), y0 = Math.floor(r.min.y), x1 = Math.min(rw, Math.ceil(r.max.x)), y1 = Math.min(rh, Math.ceil(r.max.y));
            ju.uRect.value.set(x0, y0, x1 - 1, y1 - 1);
            rt.scissor.set(x0, y0, x1 - x0, y1 - y0);
            rt.scissorTest = true;
            renderer.setRenderTarget(rt);
            renderer.render(postScene, postCam);
          }
        };
        for (const st of steps) {
          ju.uStep.value = st;
          ju.tPrev.value = a.texture;
          draw(b, jfaMat);
          [a, b] = [b, a];
        }
        maskMat.uniforms.tSil.value = a.texture;
        draw(maskRT, maskMat);
        renderer.setClearColor(clear, alpha);
      }
      quad.material = postMat;
      renderer.setRenderTarget(inkRT);
      renderer.render(postScene, postCam);

      const gu = gradeMat.uniforms;
      gu.uDesat.value = grade.desaturate ?? 0;
      gu.uBlur.value = grade.blur ?? 0;
      gu.uDarken.value = grade.darken ?? 0;
      gu.uVhs.value = grade.vhs ?? 0;
      gu.uTime.value = t;
      quad.material = gradeMat;
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    },

    dispose() {
      for (const rt of [keyRT, sunRT, ...spotRT, mainRT, inkRT, normalRT, maskRT, ...jfaRT]) {
        rt.depthTexture?.dispose();
        rt.dispose();
      }
      for (const m of [plainDepth, keyDepth, sunDepth, ...normalMats.values(), postMat, jfaMat, maskMat, gradeMat]) m.dispose();
      quad.geometry.dispose();
    },
  };
}
