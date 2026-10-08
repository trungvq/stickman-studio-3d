import * as THREE from 'three';
import { G, LIGHTING, MAX_LAMP_SHADOWS } from './npr';

const POST_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// Nhân bán cầu cố định cho bóng tiếp xúc: mẫu dồn về gần tâm.
const AO_N = 12;
const AO_KERNEL = Array.from({ length: AO_N }, (_, i) => {
  const a = i * 2.39996, z = 0.15 + 0.85 * ((i * 7) % AO_N) / AO_N, r = Math.sqrt(1 - z * z);
  const s = 0.15 + 0.85 * ((i + 1) / AO_N) ** 2;
  return `vec3(${(Math.cos(a) * r * s).toFixed(4)}, ${(Math.sin(a) * r * s).toFixed(4)}, ${(z * s).toFixed(4)})`;
}).join(', ');

// Nét mực: Laplacian của 1/độ sâu — chỗ độ sâu gãy (mép, nếp gấp) thì tối đi; cạnh gấp (pháp tuyến gãy, độ sâu liền) cũng
// tối. Bóng tiếp xúc từ độ sâu, hạt giấy, tối góc.
const POST_FRAG = /* glsl */ `
uniform sampler2D tColor, tDepth, tNormal;
uniform vec2 uRes;
uniform float uNear, uFar, uOutline, uThick, uPixel, uAo, uAoRadius;
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
  if (uAo > 0.0 && d0 < 0.99999) {
    float o = smoothstep(0.08, 0.55, ssao(vUv)) * uAo;
    col *= mix(vec3(1.0), uShadowTint * 0.8, clamp(o, 0.0, 1.0) * 0.75);
  }
  float lap = (4.0 * w0 - wl - wr - wu - wd) / w0;
  float crease = 0.0;
  vec4 n0 = texture2D(tNormal, vUv);
  if (n0.a > 0.75) {
    vec3 a = n0.xyz * 2.0 - 1.0;
    vec2 off[4] = vec2[](vec2(-px.x, 0.0), vec2(px.x, 0.0), vec2(0.0, px.y), vec2(0.0, -px.y));
    float wn[4] = float[](wl, wr, wu, wd);
    for (int i = 0; i < 4; i++) {
      vec4 nb = texture2D(tNormal, vUv + off[i]);
      // độ sâu gãy là mép bóng dáng, Laplacian đã vẽ: chỉ xét cạnh gấp trên cùng một mặt liền
      if (nb.a > 0.75 && abs(wn[i] - w0) < w0 * 0.01) crease = max(crease, 1.0 - dot(a, nb.xyz * 2.0 - 1.0));
    }
  }
  // nét gấp dày theo điểm ảnh: đồ nhỏ ở xa nhạt dần cho khỏi đen kịt
  crease = smoothstep(0.25, 0.45, crease) * mix(1.0, 0.35, smoothstep(8.0, 25.0, 1.0 / w0));
  float edge = max(smoothstep(0.0025, 0.01, lap), crease) * uOutline;
  col = mix(col, col * vec3(0.2, 0.18, 0.26), edge * 0.92);
  vec2 fc = vUv * uRes;
  if (uPixel > 0.5) col = floor(col * 14.0 + 0.5 + bayer4(fc) - 0.5) / 14.0;
  else col *= 0.975 + 0.05 * h12(floor(gl_FragCoord.xy));
  float v = length(vUv - 0.5) * 1.35;
  col *= mix(1.0, 0.86, smoothstep(0.45, 1.05, v));
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
const _v = new THREE.Vector3(), _b = new THREE.Box3();

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
 * vỏ ngược (`BackSide`) không đổ bóng; vật `userData.noCrease` (người que) không có nét cạnh gấp.
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
  const normalRT = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType });
  // pháp tuyến hệ nhìn, mặt sau lật lại; a: 1 có nét gấp, 0,5 vật `noCrease`, 0 không có vật
  const normalMat = (a: number) => new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `varying vec3 vN; void main(){ vec3 n = normalize(gl_FrontFacing ? vN : -vN); gl_FragColor = vec4(n * 0.5 + 0.5, ${a.toFixed(1)}); }`,
  });
  // decal giữ độ lệch sâu của vật liệu gốc, không thì giành điểm ảnh với mặt dưới nó thành nét lấm chấm
  const normalMats = new Map<string, THREE.ShaderMaterial>();
  const normalFor = (m: THREE.Mesh, src: THREE.Material) => {
    const a = m.userData.noCrease ? 0.5 : 1, key = src.polygonOffset ? `${a} ${src.polygonOffsetFactor} ${src.polygonOffsetUnits}` : `${a}`;
    let mat = normalMats.get(key);
    if (!mat) {
      normalMats.set(key, (mat = normalMat(a)));
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
      uRes: { value: new THREE.Vector2() },
      uNear: { value: 0 },
      uFar: { value: 0 },
      uOutline: { value: 1 },
      uThick: { value: 1 },
      uPixel: { value: 0 },
      uAo: { value: 1 },
      uAoRadius: { value: 0.35 },
      uProj: { value: new THREE.Matrix4() },
      uProjInv: { value: new THREE.Matrix4() },
      uShadowTint: G.uShadowTint,
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
      const rw = Math.max(1, Math.round(w * k)), rh = Math.max(1, Math.round(h * k));
      mainRT.setSize(rw, rh);
      inkRT.setSize(rw, rh);
      normalRT.setSize(rw, rh);
      const filt = pixel ? THREE.NearestFilter : THREE.LinearFilter;
      for (const t of [mainRT.texture, inkRT.texture, normalRT.texture]) {
        t.minFilter = t.magFilter = filt;
        t.needsUpdate = true;
      }
      postMat.uniforms.uRes.value.set(rw, rh);
      postMat.uniforms.uThick.value = pixel ? 1 : Math.max(1, dpr * ss * 1.25);
      postMat.uniforms.uPixel.value = pixel ? 1 : 0;
      gradeMat.uniforms.uRes.value.set(Math.round(w * dpr), Math.round(h * dpr));
    },

    render(scene, camera, { outline = true, t = 0, grade = {} } = {}) {
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
      if (outline) {
        // vỏ nét ngược không phải mặt thật, vật không ghi độ sâu (kính, lớp nét mặt) không có trong độ sâu: bỏ khỏi lượt pháp tuyến
        const shells: THREE.Object3D[] = [], swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || !m.visible || Array.isArray(m.material)) return;
          if (m.material.side === THREE.BackSide || !m.material.depthWrite) shells.push(m);
          else swapped.push([m, m.material]), (m.material = normalFor(m, m.material));
        });
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
        for (const [m, mat] of swapped) m.material = mat;
      }
      renderer.setRenderTarget(mainRT);
      renderer.render(scene, camera);
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
      for (const rt of [keyRT, sunRT, ...spotRT, mainRT, inkRT, normalRT]) {
        rt.depthTexture?.dispose();
        rt.dispose();
      }
      for (const m of [plainDepth, keyDepth, sunDepth, ...normalMats.values(), postMat, gradeMat]) m.dispose();
      quad.geometry.dispose();
    },
  };
}
