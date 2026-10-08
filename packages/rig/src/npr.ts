import * as THREE from 'three';

// Bảng màu soạn thẳng ở không gian hiển thị, bỏ quản lý màu cho khỏi lệch tông.
THREE.ColorManagement.enabled = false;

/** Uniform dùng chung: mọi vật liệu cầm cùng object nên đổi giờ trong ngày là đổi một chỗ. */
export const G = {
  uLightDir: { value: new THREE.Vector3(0.3, 0.8, 0.55).normalize() },
  uLightColor: { value: new THREE.Color(1.05, 1.0, 0.92) },
  uShadowTint: { value: new THREE.Color(0.46, 0.5, 0.74) },
  uAmbient: { value: new THREE.Color(0.55, 0.68, 0.95) },
  uShadowMap: { value: null as THREE.Texture | null },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowTexel: { value: 1 / 2048 },
  uLamp: { value: 0 },
  uLampPos: { value: new THREE.Vector3() },
  uTime: { value: 0 },
};

const COMMON = /* glsl */ `
uniform vec3 uLightDir, uLightColor, uShadowTint, uAmbient, uLampPos;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uShadowTexel, uLamp, uTime;
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(
    mix(mix(hash13(i), hash13(i+vec3(1,0,0)), f.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), f.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), f.x), f.y),
    f.z);
}
float shadowAt(vec3 wp, vec3 n){
  vec4 sc = uShadowMatrix * vec4(wp + n*0.04, 1.0);
  vec3 c = sc.xyz / sc.w;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float s = 0.0;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
    float d = texture2D(uShadowMap, c.xy + vec2(float(x), float(y)) * uShadowTexel).r;
    s += (c.z - 0.0008 > d) ? 0.0 : 1.0;
  }
  return s / 9.0;
}
// Ba dải sáng cứng; nhiễu thế giới đẩy ngưỡng lệch đi nên ranh dải loang như vết cọ.
vec3 nprShade(vec3 base, vec3 N, vec3 wp, float stipple, float scale, float soft){
  float shadow = shadowAt(wp, N);
  float light = clamp(dot(N, uLightDir) * 1.15, 0.0, 1.0) * shadow;
  float noise = vnoise(wp * scale) * 0.62 + vnoise(wp * scale * 2.7 + 11.0) * 0.38;
  float shade = light + (noise - 0.5) * stipple;
  vec3 mid = base * mix(uShadowTint, vec3(1.0), mix(0.66, 0.8, soft));
  vec3 dark = mix(base * uShadowTint, mid, soft);
  vec3 lit = base * uLightColor;
  vec3 c = mix(dark, mix(mid, lit, step(0.46, shade)), step(0.16, shade));
  c = mix(c, lit * 1.14, step(0.9, shade) * step(0.2, stipple));
  c += uAmbient * base * (0.5 + 0.5 * N.y) * 0.16;
  if (uLamp > 0.0) {
    vec3 d = uLampPos - wp; float r = length(d);
    float k = max(dot(N, d / r), 0.0) * (1.0 - smoothstep(1.5, 7.5, r));
    c += base * vec3(1.0, 0.72, 0.38) * step(0.18, k + (noise - 0.5) * 0.12) * (0.35 + 0.4 * step(0.5, k)) * uLamp;
  }
  return c;
}
`;

const VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vNormal;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uStipple, uStippleScale, uEmissive, uSoft;
varying vec3 vWorldPos;
varying vec3 vNormal;
${COMMON}
void main(){
  vec3 N = normalize(vNormal);
  #ifdef DOUBLE_SIDED
    N = gl_FrontFacing ? N : -N;
  #endif
  vec3 base = uColor;
  vec3 c = nprShade(base, N, vWorldPos, uStipple, uStippleScale, uSoft);
  c = mix(c, base * 1.08, uEmissive);
  gl_FragColor = vec4(c, 1.0);
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
}

/** Vật liệu toon: `color`, `stipple` độ loang, `stippleScale` cỡ vết, `soft` 1 là hai tông như bóng 2D của nhân vật; `doubleSided` vẽ cả mặt sau. */
export function npr(o: NprOptions = {}): THREE.ShaderMaterial {
  const key = JSON.stringify(o);
  const hit = cache.get(key);
  if (hit) return hit;
  const defines: Record<string, string> = o.doubleSided ? { DOUBLE_SIDED: '' } : {};
  const m = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines,
    side: o.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: {
      ...G,
      uColor: { value: new THREE.Color(o.color ?? '#ffffff') },
      uStipple: { value: o.stipple ?? 0.12 },
      uStippleScale: { value: o.stippleScale ?? 2.2 },
      uEmissive: { value: o.emissive ?? 0 },
      uSoft: { value: o.soft ?? 0 },
    },
  });
  cache.set(key, m);
  return m;
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

/** Giờ trong ngày: hướng và màu nắng, màu bóng, môi trường, đèn, ba tông trời. */
export const PALETTES = {
  day: { dir: [0.3, 0.8, 0.55], light: [1.05, 1.0, 0.92], tint: [0.46, 0.5, 0.74], amb: [0.55, 0.68, 0.95], lamp: 0, zen: '#5b95dc', hor: '#d4e8f3', low: '#a9c7dc' },
  evening: { dir: [0.75, 0.42, 0.35], light: [1.12, 0.84, 0.62], tint: [0.42, 0.36, 0.62], amb: [0.7, 0.5, 0.7], lamp: 1, zen: '#3d4f8f', hor: '#f2b27c', low: '#8c6a8c' },
} satisfies Record<string, { dir: Vec3; light: Vec3; tint: Vec3; amb: Vec3; lamp: number; zen: string; hor: string; low: string }>;
export type PaletteName = keyof typeof PALETTES;
type Vec3 = [number, number, number];

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

/** Đổi giờ trong ngày: uniform chung `G`, màu trời của `sky`, và vật `userData.lamp` trong `scene` sáng khi có đèn. */
export function setPalette(name: PaletteName, { scene, sky }: { scene?: THREE.Object3D; sky?: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> } = {}) {
  const p = PALETTES[name];
  G.uLightDir.value.set(...p.dir).normalize();
  G.uLightColor.value.setRGB(...p.light);
  G.uShadowTint.value.setRGB(...p.tint);
  G.uAmbient.value.setRGB(...p.amb);
  G.uLamp.value = p.lamp;
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
