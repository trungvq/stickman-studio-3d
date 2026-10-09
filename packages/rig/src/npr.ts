import * as THREE from 'three';

// Bảng màu soạn thẳng ở không gian hiển thị, bỏ quản lý màu cho khỏi lệch tông.
THREE.ColorManagement.enabled = false;

type Vec3 = [number, number, number];
const v3 = () => new THREE.Vector3();
/** Số đèn cục bộ tối đa, và số đèn trong đó được bản đồ bóng (theo thứ tự khai). */
export const MAX_LAMPS = 4;
export const MAX_LAMP_SHADOWS = 2;

/** Uniform dùng chung: mọi vật liệu cầm cùng object nên đổi giờ trong ngày hay bộ đèn là đổi một chỗ. */
export const G = {
  uLightDir: { value: new THREE.Vector3(0.3, 0.8, 0.55).normalize() },
  uLightColor: { value: new THREE.Color(1.05, 1.0, 0.92) },
  uKey: { value: 1 },
  uKeyWrap: { value: 0 },
  uKeyFill: { value: 0 },
  uKeySpread: { value: 0 },
  /** Độ đậm bóng đổ đèn chính, 0–1: ánh dội trong phòng làm bóng không đen hẳn */
  uKeyShade: { value: 1 },
  uRoomGain: { value: 1 },
  uShadowTint: { value: new THREE.Color(0.46, 0.5, 0.74) },
  uAmbient: { value: new THREE.Color(0.55, 0.68, 0.95) },
  uShadowMap: { value: null as THREE.Texture | null },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowTexel: { value: 1 / 2048 },
  /** x cỡ texel (three), y chiều sâu hộp, z độ loe bóng theo khoảng cách, w bán kính lọc tối đa (texel) */
  uShadowInfo: { value: new THREE.Vector4(0.01, 30, 0.015, 3) },
  uSun: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color() },
  uWinC: { value: v3() },
  uWinU: { value: v3() },
  uWinV: { value: v3() },
  uWinN: { value: v3() },
  /** x cột, y hàng ô kính, z và w nửa bề song cửa theo bề ngang và bề cao một ô */
  uWinBars: { value: new THREE.Vector4(1, 1, 0, 0) },
  uSunMap: { value: null as THREE.Texture | null },
  uSunMatrix: { value: new THREE.Matrix4() },
  /** x texel uv, y chiều sâu hộp, z có bóng */
  uSunInfo: { value: new THREE.Vector3(1 / 1024, 30, 0) },
  uLampCount: { value: 0 },
  uLampPos: { value: Array.from({ length: MAX_LAMPS }, v3) },
  uLampDir: { value: Array.from({ length: MAX_LAMPS }, v3) },
  uLampColor: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Color(0, 0, 0)) },
  /** x cos mép ngoài, y cos mép trong, z tầm (three), w ô bản đồ bóng (−1 không bóng) */
  uLampCone: { value: Array.from({ length: MAX_LAMPS }, () => new THREE.Vector4(-2, -1, 1, -1)) },
  uSpotMap0: { value: null as THREE.Texture | null },
  uSpotMap1: { value: null as THREE.Texture | null },
  uSpotMatrix: { value: Array.from({ length: MAX_LAMP_SHADOWS }, () => new THREE.Matrix4()) },
  /** x near, y far, z texel uv */
  uSpotInfo: { value: Array.from({ length: MAX_LAMP_SHADOWS }, () => new THREE.Vector3(0.1, 10, 1 / 1024)) },
  uTime: { value: 0 },
};

const POISSON = /* glsl */ `const vec2 PD[16] = vec2[](
  vec2(-0.9420, -0.3991), vec2(0.9456, -0.7689), vec2(-0.0942, -0.9294), vec2(0.3450, 0.2939),
  vec2(-0.9159, 0.4577), vec2(-0.8154, -0.8791), vec2(-0.3828, 0.2768), vec2(0.9748, 0.7565),
  vec2(0.4432, -0.9751), vec2(0.5374, -0.4737), vec2(-0.2650, -0.4189), vec2(0.7920, 0.1909),
  vec2(-0.2419, 0.9971), vec2(-0.8141, 0.9144), vec2(0.1998, 0.7864), vec2(0.1438, -0.1410));`;

const COMMON = /* glsl */ `
uniform vec3 uLightDir, uLightColor, uShadowTint, uAmbient;
uniform float uKey, uKeyWrap, uKeyFill, uKeySpread, uKeyShade, uRoomGain, uShadowTexel, uTime;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform vec4 uShadowInfo;
uniform float uSun;
uniform vec3 uSunDir, uSunColor, uWinC, uWinU, uWinV, uWinN, uSunInfo;
uniform vec4 uWinBars;
uniform sampler2D uSunMap;
uniform mat4 uSunMatrix;
uniform float uLampCount;
uniform vec3 uLampPos[${MAX_LAMPS}], uLampDir[${MAX_LAMPS}], uLampColor[${MAX_LAMPS}];
uniform vec4 uLampCone[${MAX_LAMPS}];
uniform sampler2D uSpotMap0, uSpotMap1;
uniform mat4 uSpotMatrix[${MAX_LAMP_SHADOWS}];
uniform vec3 uSpotInfo[${MAX_LAMP_SHADOWS}];
${POISSON}
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(
    mix(mix(hash13(i), hash13(i+vec3(1,0,0)), f.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), f.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), f.x), f.y),
    f.z);
}
// Đĩa Poisson xoay theo điểm ảnh: cùng khung là cùng ảnh, không đổi theo lần chạy.
mat2 diskRot(){ float a = hash12(gl_FragCoord.xy) * 6.2832; float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
bool outside(vec3 c){ return c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0; }
// Bóng đèn chính kiểu PCSS: tìm vật che, bóng loe theo khoảng cách vật che → mặt nhận, nên sát chân thì sắc, xa thì mềm.
// Vật che trong vùng tìm: số mẫu, độ sâu trung bình zb và độ sâu vật che gần mặt nhận nhất zn
float keyBlockers(vec3 c, mat2 R, float search, out float zb, out float zn){
  float bias = 0.02 / uShadowInfo.y, nb = 0.0;
  zb = 0.0;
  zn = 0.0;
  for (int i = 0; i < 16; i += 2) {
    float d = texture2D(uShadowMap, c.xy + R * PD[i] * search).r;
    if (d < c.z - bias) { zb += d; nb += 1.0; zn = max(zn, d); }
  }
  if (nb > 0.0) zb /= nb;
  return nb;
}
float keyShadow(vec3 wp, vec3 n, mat2 R){
  // mặt gần song song tia đèn (tường dưới đèn trần) đẩy ra xa hơn cho khỏi tự che trong vùng tìm vật che
  float side = 1.0 - abs(dot(n, uLightDir));
  // mặt đứng dò hẹp: vùng dò rộng của sàn với tới người đứng sát tường, in bóng ma lên tường
  float wide = mix(uShadowInfo.w, min(uShadowInfo.w, 10.0), smoothstep(0.6, 0.95, side)), search = wide * uShadowTexel;
  vec3 p = wp + n * (0.03 + 0.12 * side);
  vec3 c = (uShadowMatrix * vec4(p, 1.0)).xyz;
  if (outside(c)) return 1.0;
  float zb, zn;
  if (keyBlockers(c, R, search, zb, zn) == 0.0) return 1.0;
  // mặt đứng dưới vật nhô (tủ treo): đèn tấm rải khắp trần rọi xiên từ giữa phòng, dò lại ở điểm lùi vào phòng theo khoảng
  // cách tới vật che — sát dưới vật vẫn tối, xa xuống thì sáng lại
  float loose = 1.0;
#ifdef KEY_SPREAD
  // tăng dần theo độ đứng của mặt: mặt cong không có ranh bật/tắt
  float wv = uKeySpread * smoothstep(0.6, 0.95, side);
  if (wv > 0.0) {
    // dời theo vật che sát mặt nhận nhất (mặt kệ), không theo đồ cao hơn bày trên nó
    c = (uShadowMatrix * vec4(p + n * (c.z - zn) * uShadowInfo.y * wv, 1.0)).xyz;
    if (outside(c) || keyBlockers(c, R, search, zb, zn) == 0.0) return 1.0;
    // ánh xiên từ cả mảng trần: bóng xa vật che loe rộng hơn, không in sắc đáy từng món trên kệ
    loose = 1.0 + 3.0 * wv / uKeySpread;
  }
#endif
  float bias = 0.02 / uShadowInfo.y, dist = (c.z - zb) * uShadowInfo.y;
  float pen = clamp(dist * uShadowInfo.z * loose / uShadowInfo.x, 1.0, wide * loose) * uShadowTexel;
  // hai vòng đĩa lệch góc: 32 mẫu cho mép bóng rộng khỏi lấm tấm
  mat2 R2 = R * mat2(0.27, 0.96, -0.96, 0.27);
  float s = 0.0;
  for (int i = 0; i < 16; i++) {
    s += (c.z - bias > texture2D(uShadowMap, c.xy + R * PD[i] * pen).r) ? 0.0 : 1.0;
    s += (c.z - bias > texture2D(uShadowMap, c.xy + R2 * PD[i] * pen * 0.6).r) ? 0.0 : 1.0;
  }
  return 1.0 - (1.0 - s / 32.0) * uKeyShade;
}
float sunShadow(vec3 wp, vec3 n, mat2 R){
  vec3 c = (uSunMatrix * vec4(wp + n * (0.02 + 0.05 * (1.0 - abs(dot(n, uSunDir)))), 1.0)).xyz;
  if (outside(c)) return 1.0;
  float bias = 0.015 / uSunInfo.y, s = 0.0;
  for (int i = 0; i < 16; i += 2) s += (c.z - bias > texture2D(uSunMap, c.xy + R * PD[i] * 1.2 * uSunInfo.x).r) ? 0.0 : 1.0;
  return s / 8.0;
}
float linz(float d, vec3 info){ float z = d * 2.0 - 1.0; return 2.0 * info.x * info.y / (info.y + info.x - z * (info.y - info.x)); }
float spotShadowIn(sampler2D map, mat4 M, vec3 info, vec3 wp, vec3 n, mat2 R){
  vec4 sc = M * vec4(wp + n*0.02, 1.0);
  if (sc.w <= 0.0) return 1.0;
  vec3 c = sc.xyz / sc.w;
  if (outside(c)) return 1.0;
  float z = linz(c.z, info) - 0.025, s = 0.0;
  for (int i = 0; i < 16; i += 2) s += (z > linz(texture2D(map, c.xy + R * PD[i] * 1.5 * info.z).r, info)) ? 0.0 : 1.0;
  return s / 8.0;
}
// Nắng qua cửa sổ: lần tia về phía mặt trời tới mặt phẳng cửa, chỉ sáng khi tia lọt qua ô kính.
float sunThrough(vec3 wp){
  float dn = dot(uSunDir, uWinN);
  if (dn > -0.02) return 0.0;
  float s = dot(uWinC - wp, uWinN) / dn;
  if (s <= 0.0) return 0.0;
  vec3 h = wp + uSunDir * s - uWinC;
  vec2 q = vec2(dot(h, uWinU), dot(h, uWinV));
  if (abs(q.x) > 1.0 || abs(q.y) > 1.0) return 0.0;
  vec2 g = fract((q * 0.5 + 0.5) * uWinBars.xy);
  g = min(g, 1.0 - g);
  return step(uWinBars.z, g.x) * step(uWinBars.w, g.y);
}
// Ba dải sáng cứng; nhiễu thế giới đẩy ngưỡng lệch đi nên ranh dải loang như vết cọ.
vec3 nprShade(vec3 base, vec3 N, vec3 wp, float stipple, float scale, float soft){
  mat2 R = diskRot();
  float noise = vnoise(wp * scale) * 0.62 + vnoise(wp * scale * 2.7 + 11.0) * 0.38;
  float light = 0.0, shadowed = 1.0;
  #ifdef FLAT_KEY
  light = uKey;
  #else
  if (uKey > 0.0) {
    // trong nhà mặt quay khỏi đèn vẫn có ánh dội uKeyFill, chỉ bóng đổ mới về dải tối
    float lam = max(clamp((dot(N, uLightDir) + uKeyWrap) / (1.0 + uKeyWrap) * 1.15, 0.0, 1.0), uKeyFill);
    if (lam > 0.0) {
      light = lam * uKey;
      shadowed = keyShadow(wp, N, R);
    }
  }
  #endif
  float shade = light + (noise - 0.5) * stipple;
  vec3 mid = base * mix(uShadowTint, vec3(1.0), mix(0.66, 0.8, soft));
  vec3 dark = mix(base * uShadowTint, mid, soft * uKey);
  vec3 lit = base * uLightColor;
  vec3 c = mix(dark, mix(mid, lit, step(0.46, shade)), step(0.16, shade));
  c = mix(c, lit * 1.14, step(0.9, shade) * step(0.2, stipple));
  // bóng đổ không chia dải: mép loe mềm liền, không thành mảng sắc
  c = mix(dark, c, shadowed);
  c += uAmbient * base * (0.5 + 0.5 * N.y) * 0.16;
  c *= uRoomGain;
  if (uSun > 0.0) {
    float sl = clamp(dot(N, uSunDir) * 1.3, 0.0, 1.0) * sunThrough(wp) * uSun;
    if (sl > 0.0 && uSunInfo.z > 0.5) sl *= sunShadow(wp, N, R);
    c = mix(c, max(c, base * uSunColor), step(0.35, sl + (noise - 0.5) * 0.2));
  }
  for (int i = 0; i < ${MAX_LAMPS}; i++) {
    if (float(i) >= uLampCount) break;
    vec3 d = uLampPos[i] - wp;
    float r = length(d);
    vec3 l = d / r;
    vec4 cn = uLampCone[i];
    float k = max(dot(N, l), 0.0) * smoothstep(cn.x, cn.y, dot(-l, uLampDir[i])) * (1.0 - smoothstep(cn.z * 0.7, cn.z, r));
    if (k <= 0.0) continue;
    if (cn.w > 0.5) k *= spotShadowIn(uSpotMap1, uSpotMatrix[1], uSpotInfo[1], wp, N, R);
    else if (cn.w > -0.5) k *= spotShadowIn(uSpotMap0, uSpotMatrix[0], uSpotInfo[0], wp, N, R);
    c += base * uLampColor[i] * (0.4 * smoothstep(0.14, 0.18, k) + 0.45 * smoothstep(0.48, 0.52, k));
  }
  return c;
}
`;

const VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormal;
#ifdef USE_MAP
varying vec2 vUv;
#endif
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  #ifdef USE_MAP
    vUv = uv;
  #endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

// Ra màu nhân sẵn alpha (`premultipliedAlpha`): vật đục có `uOpacity` 1 là như cũ.
const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStipple, uStippleScale, uEmissive, uSoft, uOpacity, uGlow;
varying vec3 vWorldPos;
varying vec3 vNormal;
#ifdef USE_MAP
uniform sampler2D uMap;
varying vec2 vUv;
#endif
${COMMON}
void main(){
  vec3 N = normalize(vNormal);
  #ifdef DOUBLE_SIDED
    N = gl_FrontFacing ? N : -N;
  #endif
  vec3 base = uColor;
  float a = uOpacity;
  #ifdef USE_MAP
    vec4 tex = texture2D(uMap, vUv);
    #if defined(MAP_BLEND)
      // texture nhân sẵn alpha: màu vẫn nhân sẵn qua mọi phép đổ sáng (đều tuyến tính theo base)
      base *= tex.rgb;
      a *= tex.a;
    #elif defined(MAP_CUT)
      if (tex.a < 0.5) discard;
      base *= tex.rgb / tex.a;
    #else
      base *= tex.rgb;
    #endif
  #endif
  vec3 c = nprShade(base, N, vWorldPos, uStipple, uStippleScale, uSoft);
  c = mix(c, base * 1.08, uEmissive);
  c = mix(c, base, uGlow);
  #ifdef MAP_BLEND
    gl_FragColor = vec4(c * uOpacity, a);
  #else
    gl_FragColor = vec4(c * a, a);
  #endif
}
`;

const cache = new Map<string, THREE.ShaderMaterial>();

export interface NprOptions {
  color?: THREE.ColorRepresentation;
  stipple?: number;
  stippleScale?: number;
  soft?: number;
  emissive?: number;
  doubleSided?: boolean;
  /** Mặt đứng nhận ánh xiên của đèn tấm trần dưới vật nhô (`CeilingLight.spread`): vỏ phòng, đồ đạc (`Batch` bật sẵn); người tắt */
  spread?: boolean;
  /** Không nhận dải tối và bóng đổ của đèn chính, chỉ sáng đều theo cường độ đèn: da mặt người */
  flat?: boolean;
  /** Nét bóng dáng dày bao nhiêu (three) — hậu kỳ dò từ mặt nạ vật thay vỏ ngược, cho khối hở nằm sát khối khác như tóc */
  ink?: number;
}

function shaded(defines: Record<string, string>, side: THREE.Side, own: Record<string, THREE.IUniform>) {
  return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, defines, side, premultipliedAlpha: true, uniforms: { ...G, ...own } });
}

const ownUniforms = (o: NprOptions & { opacity?: number; glow?: number }) => ({
  uColor: { value: new THREE.Color(o.color ?? '#ffffff') },
  uStipple: { value: o.stipple ?? 0.12 },
  uStippleScale: { value: o.stippleScale ?? 2.2 },
  uEmissive: { value: o.emissive ?? 0 },
  uSoft: { value: o.soft ?? 0 },
  uOpacity: { value: o.opacity ?? 1 },
  uGlow: { value: o.glow ?? 0 },
});

/** Vật liệu toon: `color`, `stipple` độ loang, `stippleScale` cỡ vết, `soft` 1 là hai tông như bóng 2D của nhân vật; `doubleSided` vẽ cả mặt sau. */
export function npr(o: NprOptions = {}): THREE.ShaderMaterial {
  const key = JSON.stringify(o);
  const hit = cache.get(key);
  if (hit) return hit;
  const defines: Record<string, string> = { ...(o.doubleSided ? { DOUBLE_SIDED: '' } : {}), ...(o.spread ? { KEY_SPREAD: '' } : {}), ...(o.flat ? { FLAT_KEY: '' } : {}) };
  const m = shaded(defines, o.doubleSided ? THREE.DoubleSide : THREE.FrontSide, ownUniforms(o));
  if (o.ink) m.userData.ink = o.ink;
  cache.set(key, m);
  return m;
}

/** Mặt có nội dung: texture nhận cùng dải sáng, bóng, bóng tiếp xúc như mọi mặt `npr`, hay tự sáng như màn hình. */
export interface SurfaceOptions {
  /** Texture màu, nhân với `color`. `canvasTexture` của package hay ảnh đã nạp xong. */
  map?: THREE.Texture | null;
  color?: THREE.ColorRepresentation;
  /** 0 nhận đèn như mặt khác; 1 tự sáng đúng màu texture (màn hình, TV), đọc được cả trong phòng tối */
  glow?: number;
  /** `opaque` bỏ alpha; `cut` bỏ điểm alpha dưới 0,5 (nhãn cắt hình, vẫn ghi độ sâu); `blend` hoà theo alpha, không ghi độ sâu */
  alpha?: 'opaque' | 'cut' | 'blend';
  opacity?: number;
  stipple?: number;
  stippleScale?: number;
  soft?: number;
  /** Mặt vẽ: `back` cho mặt sau giấy dùng chung lưới với mặt trước */
  side?: 'front' | 'back' | 'double';
  /** Đẩy độ sâu về phía camera để decal nằm sát mặt khác không giành điểm ảnh với mặt ấy. Mặc định có khi có `map`. */
  offset?: boolean;
}

/** Vật liệu mặt có nội dung (decal, màn hình, trang giấy). Không cache: mỗi texture một vật liệu, uniform chung `G` vẫn dùng chung. */
export function surface(o: SurfaceOptions = {}): THREE.ShaderMaterial {
  const alpha = o.alpha ?? 'opaque';
  const defines: Record<string, string> = {};
  if (o.map) defines.USE_MAP = '';
  if (o.map && alpha === 'blend') defines.MAP_BLEND = '';
  if (o.map && alpha === 'cut') defines.MAP_CUT = '';
  if (o.side && o.side !== 'front') defines.DOUBLE_SIDED = '';
  const side = o.side === 'back' ? THREE.BackSide : o.side === 'double' ? THREE.DoubleSide : THREE.FrontSide;
  const m = shaded(defines, side, { ...ownUniforms({ stipple: 0.06, ...o }), uMap: { value: o.map ?? null } });
  m.transparent = alpha === 'blend' || (o.opacity ?? 1) < 1;
  m.depthWrite = alpha !== 'blend';
  if (o.offset ?? !!o.map) {
    m.polygonOffset = true;
    m.polygonOffsetFactor = -1;
    m.polygonOffsetUnits = -4;
  }
  return m;
}

/** Bản riêng của một vật liệu `npr`/`surface` (đổi `uOpacity`, `uColor` cho một vật mà không đụng vật khác); uniform chung `G` vẫn dùng chung. */
export function unshare(m: THREE.ShaderMaterial): THREE.ShaderMaterial {
  const own: Record<string, THREE.IUniform> = {};
  for (const [k, u] of Object.entries(m.uniforms)) {
    if (k in G) continue;
    const v = u.value as { clone?: () => unknown; isTexture?: boolean } | null;
    own[k] = { value: v && typeof v.clone === 'function' && !v.isTexture ? v.clone() : v };
  }
  const c = shaded({ ...(m.defines as Record<string, string>) }, m.side, own);
  c.transparent = m.transparent;
  c.depthWrite = m.depthWrite;
  c.polygonOffset = m.polygonOffset;
  c.polygonOffsetFactor = m.polygonOffsetFactor;
  c.polygonOffsetUnits = m.polygonOffsetUnits;
  c.userData = { ...m.userData };
  return c;
}

/** Vỏ ngược cho nét viền dày của nhân vật: mặt sau đẩy ra theo pháp tuyến. */
export function hullMaterial(width = 0.03, color: THREE.ColorRepresentation = '#1a1716'): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uW: { value: width }, uColor: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      uniform float uW;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vec3 n = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp.xyz + n * uW, 1.0);
      }`,
    fragmentShader: /* glsl */ `uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
  });
}

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){
  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position.z = gl_Position.w;
}`;
export const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith, uHorizon, uLow;
varying vec3 vDir;
void main(){
  float h = vDir.y;
  vec3 c = mix(uHorizon, uZenith, smoothstep(0.0, 0.75, h));
  c = mix(c, uLow, smoothstep(0.0, -0.6, h));
  gl_FragColor = vec4(c, 1.0);
}`;

interface Palette { dir: Vec3; light: Vec3; ceil: Vec3; gain: number; sun: number; tint: Vec3; room: Vec3; amb: Vec3; lamp: number; zen: string; hor: string; low: string }

/**
 * Giờ trong ngày (three): `dir`/`light` hướng và màu mặt trời (ngoài trời là đèn chính; trong nhà chỉ lấy độ cao cho nắng qua
 * cửa sổ), `ceil` màu đèn trần (đen là tắt), `gain` độ sáng chung trong nhà, `sun` cường độ nắng qua cửa, `tint` màu bóng ngoài trời, `room` màu bóng trong nhà
 * (xám thật, không pha xanh trời), `amb` môi trường, `lamp` vật
 * `userData.lamp` sáng, ba tông trời.
 */
export const PALETTES = {
  day: { dir: [0.3, 0.8, 0.55], light: [1.05, 1.0, 0.92], ceil: [1.02, 1.0, 0.97], gain: 1, sun: 1, tint: [0.46, 0.5, 0.74], room: [0.6, 0.61, 0.66], amb: [0.55, 0.68, 0.95], lamp: 0, zen: '#5b95dc', hor: '#d4e8f3', low: '#a9c7dc' },
  evening: { dir: [0.75, 0.42, 0.35], light: [1.12, 0.84, 0.62], ceil: [1.04, 0.96, 0.88], gain: 1, sun: 1, tint: [0.42, 0.36, 0.62], room: [0.6, 0.55, 0.62], amb: [0.7, 0.5, 0.7], lamp: 1, zen: '#3d4f8f', hor: '#f2b27c', low: '#8c6a8c' },
  /** 18:30: ngoài trời đã tối, đèn tầng còn bật */
  dusk: { dir: [0.6, 0.3, 0.5], light: [0.66, 0.6, 0.82], ceil: [1.0, 0.97, 0.92], gain: 0.95, sun: 0, tint: [0.38, 0.38, 0.6], room: [0.55, 0.55, 0.63], amb: [0.45, 0.42, 0.72], lamp: 1, zen: '#1c2446', hor: '#7a5a78', low: '#2a2f4a' },
  /** Sau giờ làm: đèn trần tắt, chỉ còn đèn cục bộ */
  night: { dir: [0.2, 0.85, 0.4], light: [0.42, 0.48, 0.7], ceil: [0, 0, 0], gain: 1, sun: 0, tint: [0.25, 0.28, 0.44], room: [0.34, 0.36, 0.44], amb: [0.3, 0.36, 0.62], lamp: 1, zen: '#0b1024', hor: '#1d2546', low: '#121829' },
  /** Phòng họp 17:30: trời ngoài sập tối, đèn trần dịu, bóng sâu */
  dim: { dir: [0.75, 0.25, 0.4], light: [0.9, 0.62, 0.52], ceil: [0.98, 0.98, 1.02], gain: 0.66, sun: 0, tint: [0.32, 0.34, 0.52], room: [0.42, 0.43, 0.52], amb: [0.4, 0.42, 0.64], lamp: 1, zen: '#26305a', hor: '#9a6a6a', low: '#3a3550' },
} satisfies Record<string, Palette>;
export type PaletteName = keyof typeof PALETTES;

/** Vòm trời: cầu lật trong, luôn nằm ở mặt phẳng xa, không đổ bóng. */
export function skyDome(radius = 120): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 32, 16),
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uLow: { value: new THREE.Color() } },
    }),
  );
  sky.userData.noShadow = true;
  return sky;
}

/** Đèn trần: nguồn chính trong nhà, coi như một mảng đèn rộng trên trần. */
export interface CeilingLight {
  /** y mặt trần (rig, âm là lên cao): vật cao hơn không che đèn trần. */
  y: number;
  /** Hướng từ vật về phía đèn (rig); mặc định thẳng đứng nên bóng ngắn, rơi ngay dưới người và đồ. Nghiêng thì tường quay lưng với đèn tự che phần dưới. */
  dir?: Vec3;
  /** 0 chỉ mặt ngửa về đèn mới sáng; lớn dần thì tường đứng sáng như dưới đèn tấm rộng. Mặc định 1. */
  wrap?: number;
  /** Ánh dội cho mặt quay khỏi đèn (trần, gầm), 0–1: 0,3 là dải giữa. Mặc định 0,3. */
  fill?: number;
  /** Tấm đèn rải khắp trần: mặt đứng dưới vật nhô khỏi tường (tủ treo) nhận ánh xiên từ giữa phòng; bóng dưới vật dài cỡ bề nhô
   *  chia `spread` rồi sáng lại. 0 là đèn rọi thẳng: cả dải tường dưới vật tối. Mặc định 0,6. */
  spread?: number;
  /** Độ sáng cả phòng (đèn trần và ánh dội), 0–1: hạ xuống khi đèn rọi sân khấu bật. Mặc định 1. */
  intensity?: number;
  /** Độ loe bóng theo khoảng cách vật che → mặt nhận (cỡ mảng đèn / độ cao trần): vật mảnh như người cách sàn xa thì
   *  bóng nhạt, vật rộng như mặt bàn vẫn đậm ở giữa. Mặc định 0,08. */
  soft?: number;
  /** Độ đậm bóng đổ chỗ bị che hết, 0–1: ánh dội trong phòng làm bóng không đen hẳn. Mặc định 0,4. */
  shadow?: number;
}

/** Cửa sổ trên tường đứng: nắng xiên lọt qua ô kính thành một mảng sáng có bóng sắc. */
export interface WindowLight {
  /** Tâm ô cửa (rig) */
  at: Vec3;
  /** Pháp tuyến tường hướng vào phòng (rig) */
  normal: Vec3;
  width: number;
  height: number;
  /** Mặt trời lệch khỏi pháp tuyến cửa quanh trục đứng, độ. Mặc định 30. */
  azimuth?: number;
  /** Số cột, số hàng ô kính */
  bars?: [cols: number, rows: number];
  /** Bề song cửa (px). Mặc định 6. */
  frame?: number;
  /** Bề dày tường (px): vật trong lớp này và ngoài phòng không che nắng. Mặc định 20. */
  depth?: number;
  /** Nắng qua cửa có bản đồ bóng riêng. Mặc định có. */
  shadow?: boolean;
}

/** Đèn cục bộ: đèn rọi khi có `angle`, đèn điểm khi không. */
export interface Lamp {
  /** Chỗ bóng đèn (rig) */
  at: Vec3;
  /** Điểm đèn rọi vào (rig); mặc định thẳng xuống. */
  target?: Vec3;
  /** Nửa góc chùm, độ; từ 80 trở lên là đèn điểm, không bóng. Mặc định 180. */
  angle?: number;
  /** Phần mép chùm nhoè, 0–1. Mặc định 0,2. */
  penumbra?: number;
  color?: THREE.ColorRepresentation;
  /** 0 là tắt */
  intensity?: number;
  /** Tầm sáng (px): mờ dần từ 70% tầm, tắt hẳn ở `range`. Mặc định 900. */
  range?: number;
  /** Có bản đồ bóng (đèn rọi, chỉ `MAX_LAMP_SHADOWS` đèn đầu được). Mặc định có. */
  shadow?: boolean;
}

/** Bộ đèn một phòng khai một lần; đổi theo `t` thì gọi lại `setLights` mỗi khung. */
export interface LightRig {
  /** Không có thì đèn chính là mặt trời của bảng màu (ngoài trời). */
  ceiling?: CeilingLight;
  window?: WindowLight;
  lamps?: Lamp[];
  /** Hộp phòng (rig): hộp bóng tự tính không vượt ra ngoài. Không có thì lấy hộp mọi vật đổ bóng trong cảnh. */
  bounds?: { min: Vec3; max: Vec3 };
  /** Bóng tiếp xúc ở hậu kỳ: `radius` px, `strength` 0 là tắt. Mặc định 35 và 1. */
  ao?: { radius?: number; strength?: number };
}

/** Trạng thái đèn đã đổi sang three, cho pipeline dựng bản đồ bóng. */
export const LIGHTING = {
  keyClip: null as THREE.Plane | null,
  window: null as null | { corners: THREE.Vector3[]; clip: THREE.Plane; shadow: boolean },
  lamps: [] as { pos: THREE.Vector3; target: THREE.Vector3; angle: number; far: number; slot: number; on: boolean }[],
  bounds: null as THREE.Box3 | null,
  ao: { radius: 0.35, strength: 1 },
};

// như toThree của khoi.ts
const T = ([x, y, z]: Vec3) => new THREE.Vector3(x * 0.01, -y * 0.01, -z * 0.01);
const UP = new THREE.Vector3(0, 1, 0);
const deg = Math.PI / 180;
let palette: PaletteName = 'day';
let rig: LightRig = {};

function applyLights() {
  const p: Palette = PALETTES[palette];
  const c = rig.ceiling;
  const sunDir = new THREE.Vector3(...p.dir).normalize();
  if (c) {
    G.uLightDir.value.copy(T(c.dir ?? [0, -100, 0]).normalize());
    G.uLightColor.value.setRGB(...p.ceil);
    G.uKeyWrap.value = c.wrap ?? 1;
    G.uKeyFill.value = c.fill ?? 0.3;
    G.uKeySpread.value = c.spread ?? 0.6;
    G.uRoomGain.value = p.gain * (c.intensity ?? 1);
    G.uShadowInfo.value.z = c.soft ?? 0.08;
    G.uShadowInfo.value.w = 48;
    G.uKeyShade.value = c.shadow ?? 0.4;
    LIGHTING.keyClip = new THREE.Plane(new THREE.Vector3(0, -1, 0), -c.y * 0.01 - 0.03);
  } else {
    G.uLightDir.value.copy(sunDir);
    G.uLightColor.value.setRGB(...p.light);
    G.uKeyWrap.value = 0;
    G.uKeyFill.value = 0;
    G.uKeySpread.value = 0;
    G.uRoomGain.value = 1;
    G.uShadowInfo.value.z = 0.015;
    G.uShadowInfo.value.w = 3;
    G.uKeyShade.value = 1;
    LIGHTING.keyClip = null;
  }
  const lc = G.uLightColor.value;
  G.uKey.value = Math.max(lc.r, lc.g, lc.b) > 0.01 ? 1 : 0;
  G.uShadowTint.value.setRGB(...(c ? p.room : p.tint));
  G.uAmbient.value.setRGB(...p.amb);

  const w = rig.window;
  if (w && p.sun > 0) {
    const n = T(w.normal).setY(0).normalize(), u = new THREE.Vector3().crossVectors(UP, n).normalize();
    const ctr = T(w.at), hw = (w.width * 0.01) / 2, hh = (w.height * 0.01) / 2;
    const [cols, rows] = w.bars ?? [1, 1], fr = (w.frame ?? 6) / 2;
    G.uWinC.value.copy(ctr);
    G.uWinU.value.copy(u).divideScalar(hw);
    G.uWinV.value.copy(UP).divideScalar(hh);
    G.uWinN.value.copy(n);
    G.uWinBars.value.set(cols, rows, (fr * cols) / w.width, (fr * rows) / w.height);
    const el = Math.asin(sunDir.y), az = (w.azimuth ?? 30) * deg;
    const out = n.clone().negate().applyAxisAngle(UP, az);
    G.uSunDir.value.copy(out.multiplyScalar(Math.cos(el)).addScaledVector(UP, Math.sin(el))).normalize();
    G.uSun.value = p.sun;
    G.uSunColor.value.setRGB(...p.light).multiplyScalar(1.45);
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ctr.clone().addScaledVector(u, a * hw).addScaledVector(UP, b * hh));
    LIGHTING.window = { corners, clip: new THREE.Plane(n.clone(), -n.dot(ctr) - (w.depth ?? 20) * 0.01), shadow: w.shadow ?? true };
  } else {
    G.uSun.value = 0;
    LIGHTING.window = null;
  }

  const lamps = (rig.lamps ?? []).slice(0, MAX_LAMPS);
  let slot = 0;
  LIGHTING.lamps = lamps.map((l, i) => {
    const pos = T(l.at), target = T(l.target ?? [l.at[0], l.at[1] + 100, l.at[2]]);
    const a = Math.min(l.angle ?? 180, 180), point = a >= 80, pen = l.penumbra ?? 0.2;
    const on = (l.intensity ?? 1) > 0;
    const shadow = on && !point && (l.shadow ?? true) && slot < MAX_LAMP_SHADOWS;
    const far = (l.range ?? 900) * 0.01;
    G.uLampPos.value[i].copy(pos);
    G.uLampDir.value[i].copy(target).sub(pos).normalize();
    G.uLampColor.value[i].set(l.color ?? '#ffd59a').multiplyScalar(l.intensity ?? 1);
    G.uLampCone.value[i].set(point ? -2 : Math.cos(a * deg), point ? -1 : Math.cos(a * deg * (1 - pen)), far, shadow ? slot : -1);
    return { pos, target, angle: a * deg, far, slot: shadow ? slot++ : -1, on };
  });
  G.uLampCount.value = lamps.length;

  LIGHTING.bounds = rig.bounds ? new THREE.Box3().setFromPoints([T(rig.bounds.min), T(rig.bounds.max)]) : null;
  LIGHTING.ao = { radius: (rig.ao?.radius ?? 35) * 0.01, strength: rig.ao?.strength ?? 1 };
}

/**
 * Khai bộ đèn (rig): đèn trần, nắng qua cửa sổ, đèn cục bộ, hộp phòng, bóng tiếp xúc. Ghép với giờ trong ngày của
 * `setPalette` vào uniform chung `G`. Rẻ, gọi lại mỗi khung được khi đèn chạy theo `t`. `setLights()` về ngoài trời.
 */
export function setLights(r: LightRig = {}) {
  rig = r;
  applyLights();
}

/** Đổi giờ trong ngày: uniform chung `G`, màu trời của `sky`, và vật `userData.lamp` trong `scene` sáng khi có đèn. */
export function setPalette(name: PaletteName, { scene, sky }: { scene?: THREE.Object3D; sky?: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> } = {}) {
  palette = name;
  applyLights();
  const p = PALETTES[name];
  if (sky) {
    sky.material.uniforms.uZenith.value.set(p.zen);
    sky.material.uniforms.uHorizon.value.set(p.hor);
    sky.material.uniforms.uLow.value.set(p.low);
  }
  scene?.traverse((o) => {
    const u = (o as THREE.Mesh).isMesh && ((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms;
    if (o.userData.lamp && u && u.uEmissive) u.uEmissive.value = p.lamp ? 0.9 : 0;
  });
}

applyLights();
