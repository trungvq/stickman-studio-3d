import * as THREE from 'three';
import { addPart, Batch, box, place3, toThree, U, type Mark, type Part, type Place3, type Tone, type Vec3 } from './khoi';
import { currentLights } from './lighting';
import { G, npr, PALETTES, type CeilingLight, type Lamp, type LightRig, type WindowLight } from './npr';

// Bộ dựng phòng: vỏ hộp (sàn, trần, bốn tường có bề dày), ô cửa sổ và cửa đi khoét trong tường, đèn trần, bộ đèn
// của phòng. Toạ độ rig (x phải, y xuống, z sâu), sàn ở y 0. Mỗi tường có hệ riêng như món áp tường: gốc ở mép trái
// tường (đứng trong phòng nhìn vào tường) trên sàn, x dọc tường sang phải, y xuống, −z vào phòng, +z ra sau tường.

export type WallSide = 'back' | 'front' | 'left' | 'right';
export type Face = WallSide | 'floor' | 'ceiling';
const WALLS: readonly WallSide[] = ['back', 'right', 'front', 'left'];
const YAW: Record<WallSide, number> = { back: 0, left: -Math.PI / 2, right: Math.PI / 2, front: Math.PI };
const INK = '#1b1918';

export interface RoomTones {
  /** Một màu cho cả bốn tường hay từng tường */
  wall?: string | Partial<Record<WallSide, string>>;
  floor?: string;
  ceiling?: string;
  /** Mặt cắt: đỉnh tường, đầu tường và mép sàn lộ ra khi tường bên cạnh bị giấu */
  cut?: string;
  /** Ốp chân tường; `false` là không ốp */
  skirting?: string | false;
  /** Nẹp, khung cửa sổ, bậu cửa */
  trim?: string;
  /** Ray và thanh đáy rèm lá */
  blind?: string;
}

/** Vân sàn: ron gạch vuông cạnh `size` hay ván dài, bề ngang `width`, chạy dọc `along`. */
export type FloorPattern =
  | { grout: string; size: number; width?: number }
  | { planks: string; width: number; length?: number; along?: 'x' | 'z' };

export interface WindowSpec {
  wall: WallSide;
  /** Tâm ô cửa dọc tường, px từ mép trái tường */
  u: number;
  width: number;
  height: number;
  /** Mép dưới ô cửa cách sàn. Mặc định 250. */
  sill?: number;
  /** Số cột, số hàng ô kính. Mặc định một ô mỗi ~180 px ngang, hai hàng khi cao từ 300. */
  panes?: [cols: number, rows: number];
  /** Bề song cửa (px). Mặc định 6. */
  bar?: number;
  /** Ngoài kính: phố (nhà cao, đêm có đèn cửa sổ) hay chỉ trời. Mặc định `city`. */
  view?: 'city' | 'sky';
  /** Cửa cho nắng vào bộ đèn (bộ đèn chỉ có một cửa nắng). Mặc định cửa rộng nhất. */
  sun?: boolean;
  /** Mặt trời lệch khỏi pháp tuyến cửa quanh trục đứng, độ. Mặc định 30. */
  azimuth?: number;
  /** Hạt giống của dãy nhà ngoài phố */
  seed?: number;
  /** Rèm lá kéo xuống từ đỉnh ô cửa, phần chiều cao 0–1 (nắng chỉ lọt phần còn hở). Mặc định 0. */
  blind?: number;
}

export interface DoorSpec {
  wall: WallSide;
  /** Tâm ô cửa dọc tường, px từ mép trái tường */
  u: number;
  /** Mặc định 250 × 560 (≈ 1,3 người đứng) */
  width?: number;
  height?: number;
  /** Phía bản lề, nhìn từ trong phòng. Cánh mở vào phòng. Mặc định `left`. */
  hinge?: 'left' | 'right';
  leaf?: string;
  frame?: string;
  /** Ô kính hẹp dọc trên cánh. Mặc định có. */
  glass?: boolean;
  /** Biển trên tường cạnh cửa: tâm lệch khỏi tâm ô cửa (`u` dọc tường, `y` độ cao, âm là lên) và cỡ. `true` là cạnh mép tự do ngang tầm mắt. */
  sign?: boolean | { u?: number; y?: number; width?: number; height?: number };
}

export interface PanelSpec {
  /** Tâm từng tấm (x, z rig); bỏ trống thì rải lưới đều trên trần */
  at?: [x: number, z: number][];
  /** Cỡ tấm theo x, z (px). Mặc định 300 × 80. */
  size?: [number, number];
  /** Số tấm theo x, z khi rải lưới. Mặc định một tấm mỗi ~550 × 450 px. */
  grid?: [number, number];
}

export interface RoomOptions {
  x: [x0: number, x1: number];
  z: [z0: number, z1: number];
  /** Trần cao (px). Mặc định 780. */
  height?: number;
  /** Bề dày tường, sàn, trần (px). Mặc định 20. */
  wall?: number;
  tones?: RoomTones;
  floor?: FloorPattern;
  /** Cao ốp chân tường (px). Mặc định 12. */
  skirting?: number;
  windows?: WindowSpec[];
  doors?: DoorSpec[];
  /** Đèn tấm trên trần; `false` là trần trơn */
  panels?: PanelSpec | false;
  /** Đèn trần của bộ đèn (trừ `y`, lấy từ trần) */
  ceiling?: Omit<CeilingLight, 'y'>;
  /** Bề nét mực ở mép tường (px). Mặc định 4. */
  ink?: number;
}

export interface RoomDoor {
  spec: DoorSpec;
  /** Chỗ khung cửa: gốc ở sàn giữa ô cửa trên mặt tường, hệ như món áp tường */
  place: Place3;
  /** Trục bản lề (three): xoay quanh y */
  pivot: THREE.Group;
  /** Độ mở 0–1 (1 là ~95°) */
  open: number;
  /** Đặt độ mở, gọi mỗi khung theo `t` */
  set(open: number): void;
  /** Điểm tay nắm khi cửa đóng (rig): đích cổ tay người mở cửa */
  handle: Vec3;
  /** Biển trống cạnh cửa: `anchor` ở tâm mặt biển, +x dọc tường, +y lên, +z ra phòng (three); `width`, `height` px */
  sign?: { anchor: THREE.Object3D; width: number; height: number };
}

export interface RoomWindow {
  spec: WindowSpec;
  place: Place3;
  /** Mục `window` của bộ đèn cho cửa này */
  light: WindowLight;
}

export interface Room {
  group: THREE.Group;
  /** Hộp phòng kể cả bề dày (rig), như `LightRig.bounds` */
  bounds: { min: Vec3; max: Vec3 };
  /** Nhóm từng mặt: thêm đồ áp tường vào đây thì giấu cùng tường */
  faces: Record<Face, THREE.Group>;
  windows: RoomWindow[];
  doors: RoomDoor[];
  /** Chỗ món áp tường: `u` dọc tường từ mép trái, `y` độ cao (âm là lên); hệ món như khung cửa */
  wallPlace(side: WallSide, u: number, y?: number): Place3;
  /** Giấu tường, trần, sàn mà camera đứng phía ngoài: gọi mỗi khung sau khi đặt camera (`update` của sân khấu) */
  cull(camera: THREE.Camera): void;
  /** Bộ đèn của phòng cho `setLights`: đèn trần ở trần, nắng qua cửa nắng, hộp phòng; thêm đèn cục bộ, đè đèn trần */
  lights(o?: { lamps?: Lamp[]; ceiling?: Omit<CeilingLight, 'y'>; sun?: boolean; ao?: LightRig['ao'] }): LightRig;
}

const flat = (c: string): Tone => ({ top: c, lit: c });

/** Mặt phẳng rỗng ruột → hộp khối: chia tường thành dải theo mép các ô khoét, mỗi dải bỏ khoảng y của ô khoét. */
function wallBlocks(u: [number, number], h: number, holes: { u0: number; u1: number; y0: number; y1: number }[]) {
  const us = [...new Set([u[0], u[1], ...holes.flatMap((o) => [o.u0, o.u1])])].filter((x) => x >= u[0] && x <= u[1]).sort((a, b) => a - b);
  const out: [number, number, number, number][] = [];
  for (let i = 0; i + 1 < us.length; i++) {
    const a = us[i], b = us[i + 1], m = (a + b) / 2;
    const cut = holes.filter((o) => o.u0 < m && o.u1 > m).map((o) => [o.y0, o.y1]).sort((p, q) => p[0] - q[0]);
    let y = -h;
    for (const [y0, y1] of cut) {
      if (y0 > y) out.push([a, b, y, y0]);
      y = Math.max(y, y1);
    }
    if (y < 0) out.push([a, b, y, 0]);
  }
  return out;
}

/** Khoảng [a, b] bỏ các khoảng `gaps` */
function spans(a: number, b: number, gaps: [number, number][]) {
  const out: [number, number][] = [];
  let x = a;
  for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (g0 > x) out.push([x, Math.min(g0, b)]);
    x = Math.max(x, g1);
  }
  if (x < b) out.push([x, b]);
  return out;
}

const PORTAL_VERT = /* glsl */ `
varying vec3 vWp;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

// Cảnh sau ô cửa vẽ trên một tấm ở mặt kính: tia từ mắt qua điểm ảnh cắt mặt phẳng phố ở xa, nên nhìn xiên vẫn
// đúng thị sai mà không có vật nào thò ra ngoài tường. Cửa đi thì là hành lang tối: sàn, hai vách, vách cuối.
const PORTAL_FRAG = /* glsl */ `
uniform vec3 uO, uU, uN, uZen, uHor, uLow;
uniform float uMode, uDist, uNight, uCity, uSeed, uHalfW;
varying vec3 vWp;
float h11(float x){ return fract(sin(x * 127.1 + uSeed * 31.7) * 43758.5453); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 74.7) * 43758.5453); }
// Một dãy nhà ở khoảng cách d (px) sau kính: x, y px trên mặt phẳng ấy, y lên từ tâm ô cửa. Trả màu, độ phủ.
vec4 row(vec3 r, float rn, float d, float lane, float top0, float topK, vec3 body){
  float t = (dot(uO - cameraPosition, uN) + d * 0.01) / rn;
  vec3 hp = cameraPosition + r * t - uO;
  float x = dot(hp, uU) * 100.0 + lane * 1000.0, y = hp.y * 100.0;
  float id = floor(x / 150.0), f = fract(x / 150.0);
  float gap = h11(id + lane * 17.0) < 0.25 ? 0.18 : 0.04;
  float top = top0 + h11(id * 1.7 + lane * 5.0) * topK;
  if (y > top || f < gap) return vec4(0.0);
  vec3 c = body * (0.88 + 0.24 * h11(id * 3.1 + lane));
  vec2 cell = vec2(x, y - top) / vec2(30.0, 40.0), cf = fract(cell);
  if (cf.x > 0.25 && cf.x < 0.8 && cf.y > 0.3 && cf.y < 0.8 && y < top - 25.0) {
    float k = h21(floor(cell) + id);
    c = mix(c * mix(0.93, 0.8, uNight), vec3(1.0, 0.82, 0.52), step(0.62, k) * uNight);
  }
  return vec4(c, 1.0);
}
void main(){
  vec3 r = normalize(vWp - cameraPosition);
  float rn = dot(r, uN);
  vec3 c;
  if (uMode < 0.5) {
    c = mix(uHor, uZen, smoothstep(0.0, 0.5, r.y));
    c = mix(c, uLow, smoothstep(0.0, -0.35, r.y));
    if (uCity > 0.5 && rn > 0.02) {
      vec4 far = row(r, rn, 2600.0, 1.0, -300.0, 650.0, mix(uLow, uHor, 0.35));
      c = mix(c, far.rgb, far.a);
      vec4 near = row(r, rn, 1500.0, 0.0, -650.0, 800.0, uLow * 0.8);
      c = mix(c, near.rgb, near.a);
    }
    // vệt sáng xiên trên kính
    vec3 q = vWp - uO;
    float s = fract((dot(q, uU) * 100.0 + q.y * 70.0) / 340.0);
    c += (1.0 - uNight) * 0.07 * (step(0.08, s) - step(0.16, s) + step(0.22, s) - step(0.25, s));
  } else {
    float far = (dot(uO - cameraPosition, uN) + uDist) / max(rn, 1e-4);
    float floorT = r.y < -1e-4 ? -cameraPosition.y / r.y : 1e9;
    float side = 1e9;
    float ru = dot(r, uU), cu = dot(cameraPosition - uO, uU);
    if (abs(ru) > 1e-4) side = (sign(ru) * uHalfW - cu) / ru;
    float t = min(far, min(floorT, side));
    vec3 hp = cameraPosition + r * t;
    float depth = clamp(dot(hp - uO, uN) / uDist, 0.0, 1.0);
    c = t == floorT ? vec3(0.29, 0.31, 0.33) : t == far ? vec3(0.2, 0.21, 0.23) : vec3(0.24, 0.25, 0.27);
    c *= 1.0 - 0.45 * depth;
  }
  gl_FragColor = vec4(c, 1.0);
}`;

const lum = (c: THREE.Color) => 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;

function portal(corners: THREE.Vector3[], o: { O: THREE.Vector3; U: THREE.Vector3; N: THREE.Vector3; door?: boolean; dist?: number; halfW?: number; city?: boolean; seed?: number }) {
  const geo = new THREE.BufferGeometry().setFromPoints([0, 1, 2, 0, 2, 3].map((i) => corners[i]));
  geo.computeVertexNormals();
  const u = {
    uO: { value: o.O }, uU: { value: o.U }, uN: { value: o.N },
    uZen: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uLow: { value: new THREE.Color() },
    uMode: { value: o.door ? 1 : 0 }, uDist: { value: (o.dist ?? 400) * U }, uNight: { value: 0 }, uCity: { value: o.city ? 1 : 0 },
    uSeed: { value: o.seed ?? 0 }, uHalfW: { value: (o.halfW ?? 200) * U },
  };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: PORTAL_VERT, fragmentShader: PORTAL_FRAG, uniforms: u, side: THREE.DoubleSide }));
  mesh.userData.noShadow = true;
  if (!o.door)
    // trời và phố theo giờ trong ngày của sân khấu đang vẽ
    mesh.onBeforeRender = () => {
      const p = PALETTES[currentLights().palette];
      u.uZen.value.set(p.zen);
      u.uHor.value.set(p.hor);
      u.uLow.value.set(p.low);
      u.uNight.value = 1 - THREE.MathUtils.smoothstep(lum(u.uHor.value), 0.2, 0.55);
    };
  return mesh;
}

const PANEL_FRAG = /* glsl */ `
uniform vec3 uLightColor, uShadowTint, uOn, uOff;
uniform float uKey, uRoomGain;
void main(){
  float on = uKey * smoothstep(0.15, 0.5, uRoomGain);
  vec3 lc = uLightColor / max(max(uLightColor.r, max(uLightColor.g, uLightColor.b)), 1e-3);
  gl_FragColor = vec4(mix(uOff * uShadowTint * uRoomGain, uOn * lc, on), 1.0);
}`;

/** Tấm đèn trần: sáng theo đèn trần trong `G` (bảng màu tắt đèn trần thì tối), không cần đặt tay */
function panelMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: PANEL_FRAG,
    uniforms: {
      uLightColor: G.uLightColor, uShadowTint: G.uShadowTint, uKey: G.uKey, uRoomGain: G.uRoomGain,
      uOn: { value: new THREE.Color('#fbfaf4') }, uOff: { value: new THREE.Color('#a9adb2') },
    },
  });
}

/** Nét mực dọc đoạn `a` → `b` (rig) */
function inkBar(a: Vec3, b: Vec3, w: number) {
  const A = toThree(a), B = toThree(b);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w * U, w * U, A.distanceTo(B) + w * U), npr({ color: INK, stipple: 0 }));
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.lookAt(B);
  m.userData.noShadow = true;
  return m;
}

/**
 * Vỏ phòng hộp từ `x`, `z`, `height`: sàn, trần, bốn tường dày `wall`, ốp chân tường, nét mực ở mép tường, ô cửa sổ
 * (khung, song, bậu, trời và phố sau kính theo giờ trong ngày), cửa đi có bản lề và biển, đèn tấm trên trần. `cull(camera)`
 * mỗi khung giấu mặt mà camera đứng phía ngoài, nên camera đặt ngoài phòng vẫn nhìn vào được. `lights()` ra bộ đèn cho
 * `setLights`. Mọi mesh tĩnh trừ cánh cửa.
 */
export function room(o: RoomOptions): Room {
  const [x0, x1] = o.x, [z0, z1] = o.z, h = o.height ?? 780, d = o.wall ?? 20, ink = o.ink ?? 4;
  const tones = o.tones ?? {};
  const wallColor = (s: WallSide) => (typeof tones.wall === 'object' ? tones.wall[s] : tones.wall) ?? '#b4b8bb';
  const cut = tones.cut ?? '#3a3d41', trim = flat(tones.trim ?? '#e3e6e9');
  const skirt = tones.skirting === false ? null : tones.skirting ?? '#4b4f53', skH = o.skirting ?? 12;
  const length = (s: WallSide) => (s === 'back' || s === 'front' ? x1 - x0 : z1 - z0);
  const onWall = (s: WallSide, u: number, y: number): Vec3 =>
    s === 'back' ? [x0 + u, y, z1] : s === 'front' ? [x1 - u, y, z0] : s === 'left' ? [x0, y, z0 + u] : [x1, y, z1 - u];
  const wallPlace = (s: WallSide, u: number, y = 0): Place3 => ({ at: onWall(s, u, y), yaw: YAW[s] });
  const inward = (s: WallSide) => toThree(place3({ at: [0, 0, 0], yaw: YAW[s] }, [0, 0, -1])).normalize();

  const group = new THREE.Group();
  group.name = 'room';
  const faces = Object.fromEntries((['floor', 'ceiling', ...WALLS] as Face[]).map((f) => {
    const g = new THREE.Group();
    g.name = f;
    group.add(g);
    return [f, g];
  })) as Record<Face, THREE.Group>;
  const batches = Object.fromEntries((['floor', 'ceiling', ...WALLS] as Face[]).map((f) => [f, new Batch()])) as Record<Face, Batch>;
  // nẹp, khung kính: mảnh, ít loang cho khỏi lấm tấm
  const trims = Object.fromEntries(WALLS.map((f) => [f, new Batch({ stipple: 0.02 })])) as Record<WallSide, Batch>;

  // sàn và trần là tấm dày phủ cả bề dày tường: mép lộ ra khi tường phía camera bị giấu
  const floorPart: Part = { v: box(x0 - d, x1 + d, 0, d, z0 - d, z1 + d), tone: { top: tones.floor ?? '#74787c', lit: cut } };
  const fp = o.floor;
  if (fp) {
    const lines: Vec3[][] = [];
    if ('grout' in fp) {
      for (let x = x0 + fp.size; x < x1 - 1; x += fp.size) lines.push([[x, 0, z0], [x, 0, z1]]);
      for (let z = z0 + fp.size; z < z1 - 1; z += fp.size) lines.push([[x0, 0, z], [x1, 0, z]]);
    } else {
      const alongX = (fp.along ?? 'x') === 'x', L = fp.length ?? fp.width * 6;
      const [a0, a1] = alongX ? [x0, x1] : [z0, z1], [b0, b1] = alongX ? [z0, z1] : [x0, x1];
      const P = (a: number, b: number): Vec3 => (alongX ? [a, 0, b] : [b, 0, a]);
      for (let b = b0, i = 0; b < b1 - 1; b += fp.width, i++) {
        if (b > b0) lines.push([P(a0, b), P(a1, b)]);
        // nối ván so le theo hàng
        for (let a = a0 + ((i * 0.37) % 1) * L; a < a1; a += L) if (a > a0) lines.push([P(a, b), P(a, Math.min(b + fp.width, b1))]);
      }
    }
    floorPart.marks = [{ n: [0, -1, 0], color: 'grout' in fp ? fp.grout : fp.planks, w: 'grout' in fp ? fp.width ?? 2 : 1.5, d: lines }] satisfies Mark[];
  }
  addPart(batches.floor, floorPart, { at: [0, 0, 0] }, 1);
  addPart(batches.ceiling, { v: box(x0 - d, x1 + d, -h - d, -h, z0 - d, z1 + d), tone: flat(tones.ceiling ?? '#c9ccce') }, { at: [0, 0, 0] });

  const winSpecs = o.windows ?? [], doorSpecs = o.doors ?? [];
  const sunWin = winSpecs.find((w) => w.sun) ?? [...winSpecs].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const windows: RoomWindow[] = [];
  const doors: RoomDoor[] = [];

  for (const s of WALLS) {
    const L = length(s), b = batches[s], tb = trims[s], at0 = wallPlace(s, 0);
    const wallTone: Tone = { top: cut, lit: wallColor(s) };
    const myWins = winSpecs.filter((w) => w.wall === s), myDoors = doorSpecs.filter((w) => w.wall === s);
    const holes = [
      ...myWins.map((w) => ({ u0: w.u - w.width / 2, u1: w.u + w.width / 2, y0: -(w.sill ?? 250) - w.height, y1: -(w.sill ?? 250) })),
      ...myDoors.map((w) => ({ u0: w.u - (w.width ?? 250) / 2, u1: w.u + (w.width ?? 250) / 2, y0: -(w.height ?? 560), y1: 0 })),
    ];
    // tường trước, sau ôm luôn góc phòng
    const ext: [number, number] = s === 'back' || s === 'front' ? [-d, L + d] : [0, L];
    for (const [a, c, y0, y1] of wallBlocks(ext, h, holes)) addPart(b, { v: box(a, c, y0, y1, 0, d), tone: wallTone }, at0);
    const doorGaps = myDoors.map((w): [number, number] => [w.u - (w.width ?? 250) / 2 - 14, w.u + (w.width ?? 250) / 2 + 14]);
    if (skirt) for (const [a, c] of spans(0, L, doorGaps)) addPart(b, { v: box(a, c, -skH, 0, -2, 0), tone: { top: skirt, lit: skirt } }, at0);
    // nét chân tường, đỉnh tường
    const g = faces[s];
    for (const [a, c] of spans(0, L, doorGaps)) g.add(inkBar(place3(at0, [a, 0, -ink / 4]), place3(at0, [c, 0, -ink / 4]), ink));
    g.add(inkBar(place3(at0, [0, -h, -ink / 4]), place3(at0, [L, -h, -ink / 4]), ink));

    for (const w of myWins) {
      const sill = w.sill ?? 250, a = w.u - w.width / 2, c = w.u + w.width / 2, yb = -sill, yt = -sill - w.height;
      const cols = w.panes?.[0] ?? Math.max(1, Math.round(w.width / 180)), rows = w.panes?.[1] ?? (w.height >= 300 ? 2 : 1);
      const bw = w.bar ?? 6, gz = d - 4;
      // khung ngoài nửa bề song: mặt nạ nắng của npr coi mép ô cửa là nửa song
      const sash: Vec3[][] = [
        box(a, c, yt, yt + bw / 2, gz - 3, gz + 1), box(a, c, yb - bw / 2, yb, gz - 3, gz + 1),
        box(a, a + bw / 2, yt, yb, gz - 3, gz + 1), box(c - bw / 2, c, yt, yb, gz - 3, gz + 1),
        ...Array.from({ length: cols - 1 }, (_, i) => a + ((i + 1) * w.width) / cols).map((x) => box(x - bw / 2, x + bw / 2, yt, yb, gz - 3, gz + 1)),
        ...Array.from({ length: rows - 1 }, (_, i) => yt + ((i + 1) * w.height) / rows).map((y) => box(a, c, y - bw / 2, y + bw / 2, gz - 3, gz + 1)),
      ];
      const casing: Vec3[][] = [
        box(a - 8, c + 8, yt - 8, yt, -3, 0), box(a - 8, a, yt, yb, -3, 0), box(c, c + 8, yt, yb, -3, 0),
        // bậu nhô 8: npr dò bóng đèn trần ở mặt tường cách tường 15 px, vật nhô sâu hơn thì phủ bóng cả dải tường dưới nó
        box(a - 14, c + 14, yb - 2, yb + 6, -8, gz),
      ];
      for (const v of [...sash, ...casing]) addPart(tb, { v, tone: trim }, at0);
      // rèm lá: thanh ray ở đỉnh, lá nghiêng cách nhau ~11 px, thanh đáy; nằm trong bề dày tường trước kính
      const bl = Math.min(1, Math.max(0, w.blind ?? 0)), yo = yt + w.height * bl;
      if (bl > 0) {
        const n = Math.max(1, Math.round((w.height * bl) / 11));
        addPart(tb, { v: box(a, c, yt, yt + 8, 1, 5), tone: flat(tones.blind ?? '#c9cdd1') }, at0);
        for (let i = 0; i < n; i++) {
          const y = yt + 8 + ((yo - yt - 8) * (i + 0.5)) / n;
          addPart(tb, { v: [[a, y + 3, 2], [c, y + 3, 2], [c, y + 3, 6], [a, y + 3, 6], [a, y - 4, 3], [c, y - 4, 3], [c, y - 4, 7], [a, y - 4, 7]], tone: flat('#eef0f1') }, at0);
        }
        addPart(tb, { v: box(a, c, yo - 2, yo + 5, 2, 6), tone: flat(tones.blind ?? '#c9cdd1') }, at0);
      }
      const place = wallPlace(s, w.u, (yt + yb) / 2);
      const P = (u: number, y: number, z: number) => toThree(place3(at0, [u, y, z]));
      const view = portal([P(a, yb, gz), P(c, yb, gz), P(c, yt, gz), P(a, yt, gz)], {
        O: P(w.u, (yt + yb) / 2, gz), U: P(1, 0, 0).sub(P(0, 0, 0)).normalize(), N: inward(s).negate(),
        city: (w.view ?? 'city') === 'city', seed: w.seed ?? windows.length,
      });
      g.add(view);
      windows.push({
        spec: w, place,
        light: {
          at: place3(at0, [w.u, (yo + yb) / 2, gz]), normal: place3({ at: [0, 0, 0], yaw: YAW[s] }, [0, 0, -1]),
          width: w.width, height: yb - yo, bars: [cols, bl > 0 ? 1 : rows], frame: bw, depth: gz + 2, azimuth: w.azimuth,
        },
      });
    }

    for (const w of myDoors) {
      const dw = w.width ?? 250, dh = w.height ?? 560, a = w.u - dw / 2, c = w.u + dw / 2, sd = (w.hinge ?? 'left') === 'left' ? 1 : -1;
      const frame = flat(w.frame ?? '#8a8f95'), leaf = flat(w.leaf ?? '#a3a8ae'), steel = flat('#d2d6da');
      for (const v of [box(a - 14, c + 14, -dh - 14, -dh, -5, 0), box(a - 14, a, -dh, 0, -5, 0), box(c, c + 14, -dh, 0, -5, 0)]) addPart(tb, { v, tone: frame }, at0);
      const P = (u: number, y: number, z: number) => toThree(place3(at0, [u, y, z]));
      g.add(portal([P(a, 0, d - 1), P(c, 0, d - 1), P(c, -dh, d - 1), P(a, -dh, d - 1)], {
        O: P(w.u, -dh / 2, d - 1), U: P(1, 0, 0).sub(P(0, 0, 0)).normalize(), N: inward(s).negate(), door: true, dist: 500, halfW: dw / 2 + 160,
      }));
      // cánh cửa trong hệ bản lề: x từ bản lề ra mép tự do (`sd` đổi chiều theo phía bản lề), mặt phòng ở z 0
      const X = (v: number) => sd * v, xs = (p: number, q: number): [number, number] => [Math.min(X(p), X(q)), Math.max(X(p), X(q))];
      const lb = new Batch({ stipple: 0.04 }), hb = new Batch({ stipple: 0 }), ly = -dh * 0.45, free = dw - 30;
      addPart(lb, { v: box(...xs(1.5, dw - 1.5), -dh + 1.5, -1, 0, 5), tone: leaf }, { at: [0, 0, 0] });
      if (w.glass ?? true) addPart(lb, { v: box(...xs(dw * 0.4 - 13, dw * 0.4 + 13), -dh * 0.86, -dh * 0.52, -1, 6), tone: flat('#9fc9dd') }, { at: [0, 0, 0] });
      // tay nắm nhô quá 15 px: không đổ bóng (như bậu cửa sổ)
      for (const v of [box(...xs(free - 7, free + 7), ly - 24, ly + 22, -2, 0), box(...xs(free - 3, free + 3), ly - 6, ly + 2, -9, -2), box(...xs(free - 44, free + 3), ly - 6, ly + 1, -14, -8)])
        addPart(hb, { v, tone: steel }, { at: [0, 0, 0] });
      const pivot = new THREE.Group();
      pivot.add(lb.build({ ink: 0 }), hb.build({ shadow: false, ink: 0 }));
      pivot.position.copy(P(sd > 0 ? a : c, 0, -2));
      const base = -YAW[s];
      const door: RoomDoor = {
        spec: w, place: wallPlace(s, w.u), pivot, open: 0,
        set(v) {
          door.open = v;
          pivot.rotation.y = base - sd * Math.min(1, Math.max(0, v)) * (95 * Math.PI) / 180;
        },
        handle: place3(at0, [sd > 0 ? a + free - 24 : c - free + 24, ly - 3, -14]),
      };
      door.set(0);
      g.add(pivot);
      if (w.sign) {
        const sg = w.sign === true ? {} : w.sign;
        const sw = sg.width ?? 80, sh = sg.height ?? 96, su = w.u + (sg.u ?? sd * (dw / 2 + 30 + sw / 2)), sy = sg.y ?? -dh + 120;
        addPart(tb, { v: box(su - sw / 2, su + sw / 2, sy - sh / 2, sy + sh / 2, -2, 0), tone: flat('#fbfbf8') }, at0);
        const anchor = new THREE.Object3D();
        anchor.position.copy(P(su, sy, -2.2));
        anchor.rotation.y = base;
        g.add(anchor);
        door.sign = { anchor, width: sw, height: sh };
      }
      doors.push(door);
    }
  }

  // nét góc tường: hiện khi một trong hai tường còn
  const corners: [number, number, WallSide, WallSide][] = [[x0, z0, 'left', 'front'], [x1, z0, 'right', 'front'], [x0, z1, 'left', 'back'], [x1, z1, 'right', 'back']];
  const edges = corners.map(([x, z, p, q]) => {
    const k = ink / 4, ox = x === x0 ? k : -k, oz = z === z0 ? k : -k;
    const m = inkBar([x + ox, 0, z + oz], [x + ox, -h, z + oz], ink);
    group.add(m);
    return { m, owners: [p, q] as WallSide[] };
  });

  if (o.panels !== false) {
    const pn = o.panels ?? {}, [pw, pd] = pn.size ?? [300, 80];
    const [gx, gz] = pn.grid ?? [Math.max(1, Math.round((x1 - x0) / 550)), Math.max(1, Math.round((z1 - z0) / 450))];
    const at = pn.at ?? Array.from({ length: gx * gz }, (_, i): [number, number] => [x0 + ((i % gx) + 0.5) * ((x1 - x0) / gx), z0 + (Math.floor(i / gx) + 0.5) * ((z1 - z0) / gz)]);
    const geo = new THREE.BoxGeometry(pw * U, 8 * U, pd * U);
    const mat = panelMaterial();
    for (const [x, z] of at) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(toThree([x, -h + 4, z]));
      m.userData.noShadow = true;
      faces.ceiling.add(m);
    }
  }

  for (const f of Object.keys(batches) as Face[]) {
    const built = [batches[f].build({ ink: 0 }), ...(f in trims ? [trims[f as WallSide].build({ ink: 0 })] : [])];
    for (const g of built) {
      g.traverse((m) => (m.userData.static = true));
      faces[f].add(g);
    }
  }

  const planes: { g: THREE.Group; p: THREE.Vector3; n: THREE.Vector3 }[] = [
    { g: faces.floor, p: new THREE.Vector3(0, 0, 0), n: new THREE.Vector3(0, 1, 0) },
    { g: faces.ceiling, p: toThree([0, -h, 0]), n: new THREE.Vector3(0, -1, 0) },
    ...WALLS.map((s) => ({ g: faces[s], p: toThree(onWall(s, 0, 0)), n: inward(s) })),
  ];
  // vỏ phòng có nét riêng (`ink`); đồ thêm vào sau vẫn có nét gấp
  group.traverse((m) => (m.userData.noCrease = true));
  const eye = new THREE.Vector3();
  const bounds = { min: [x0 - d, -h - d, z0 - d] as Vec3, max: [x1 + d, d, z1 + d] as Vec3 };

  return {
    group, bounds, faces, windows, doors, wallPlace,
    cull(camera) {
      camera.getWorldPosition(eye);
      for (const { g, p, n } of planes) g.visible = eye.clone().sub(p).dot(n) > 0;
      for (const e of edges) e.m.visible = e.owners.some((s) => faces[s].visible);
    },
    lights(l = {}) {
      const win = windows.find((w) => w.spec === sunWin);
      return {
        ceiling: { ...o.ceiling, ...l.ceiling, y: -h },
        window: win && l.sun !== false ? win.light : undefined,
        lamps: l.lamps,
        bounds,
        ao: l.ao,
      };
    },
  };
}
