import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildSockets, dress, headFit, newGear, type EquipState, type Gear, type ItemFactories, type Sockets } from './attach';
import { DEFAULT_FACE, faceRig, type FaceRig, type FaceShape, type FaceState } from './face';
import { sculptSkirt, sculptTorso } from './garment';
import { glassesMesh, type Glasses } from './glasses';
import { toThree, type Vec3 } from './khoi';
import { hullMaterial, npr } from './npr';
import { sculptMesh, type Sculpt } from './sculpt';
import { shoulderRoot, type Garment, type Rig, type Skirt } from './torso';

// Tỉ lệ lấy từ RIG của @stickman/rig, chia 100: người cao ~4,3 đơn vị, đầu to bằng gần một phần ba.
export const R = { torso: 1.2, neck: 0.08, head: 0.64, upperArm: 0.62, foreArm: 0.58, thigh: 0.78, shin: 0.92, limb: 0.042 };
const INK = '#1b1918';

const ink = npr({ color: INK, stipple: 0 });
const hull = hullMaterial(0.026, INK);

/** `-1` bên phải người (−x khi người nhìn +z), `1` bên trái. */
export type Side = -1 | 1;
const SIDES = [-1, 1] as const;
/** `wrist` treo ở đầu cẳng tay: chỗ gắn đồ cầm */
export interface Arm { shoulder: THREE.Group; elbow: THREE.Group; wrist: THREE.Group }
export interface Leg { hip: THREE.Group; knee: THREE.Group }
/** Người que dựng xong: `root` ở sàn dưới hông, mặt nhìn +z; các khớp để hoạt cảnh xoay. */
export interface Figure {
  root: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  arms: Record<Side, Arm>;
  legs: Record<Side, Leg>;
  face: FaceRig;
  /** Lệch nhịp chớp mắt của `act` giữa các người */
  seed: number;
  /** Chỗ gắn đồ: cổ tay, đầu, ngực (`attach.ts`) */
  sockets: Sockets;
  /** Đồ gọi tên của người và thứ đang mặc; `dress` đổi */
  gear: Gear;
  lod: Lod;
}

/** `low`: người nền rẻ — ít mặt lưới, gộp khối tĩnh theo vật liệu, nét mặt đứng yên dùng chung texture, không chớp mắt */
export type Lod = 'full' | 'low';
interface Quality { skull: [number, number]; limb: [number, number]; neck: number }
const QUALITY: Record<Lod, Quality> = {
  full: { skull: [36, 24], limb: [4, 10], neck: 10 },
  low: { skull: [16, 11], limb: [2, 6], neck: 6 },
};
let q = QUALITY.full;

/** Khối tô màu có viền dày: mesh chính + vỏ ngược. */
function inked(geo: THREE.BufferGeometry, mat: THREE.Material, w?: number) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  g.add(m);
  const h = new THREE.Mesh(geo, w ? hullMaterial(w, INK) : hull);
  h.userData.noShadow = true;
  g.add(h);
  return g;
}

/** Đoạn chi: nét đen tròn đầu, mọc từ gốc khớp theo −y. */
function limb(len: number, r = R.limb) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, ...q.limb), ink);
  m.position.y = -len / 2;
  m.userData.limb = true;
  return m;
}

function joint(parent: THREE.Object3D, x: number, y: number, z: number) {
  const j = new THREE.Group();
  j.userData.joint = true;
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

/** Chân hai đoạn: `hip` quay đùi, `knee` gập ống. */
function leg(parent: THREE.Object3D, side: Side, hipHalf: number): Leg {
  const hip = joint(parent, side * hipHalf, 0, 0);
  hip.add(limb(R.thigh));
  const knee = joint(hip, 0, -R.thigh, 0);
  knee.add(limb(R.shin));
  return { hip, knee };
}

function arm(parent: THREE.Object3D, side: Side, x: number, y: number): Arm {
  const shoulder = joint(parent, side * x, y, 0);
  shoulder.add(limb(R.upperArm));
  const elbow = joint(shoulder, 0, -R.upperArm, 0);
  elbow.add(limb(R.foreArm));
  const wrist = joint(elbow, 0, -R.foreArm, 0);
  return { shoulder, elbow, wrist };
}

/** Tóc dựng khối của rig (`pieces.hair.sculpt` trong JSON nhân vật), lưới hệ sọ đơn vị phóng theo khối đầu. */
function sculptHair(head: THREE.Object3D, sculpt: Partial<Sculpt>, color: string) {
  const mesh = sculptMesh(sculpt);
  const mat = npr({ color, stipple: 0.05, stippleScale: 5, soft: 0.6, doubleSided: true });
  for (const tris of [mesh.shell, mesh.spikes, mesh.hang]) {
    if (!tris.length) continue;
    const pos = new Float32Array(tris.length * 9);
    tris.forEach((t, i) => t.forEach((p, k) => pos.set(p, i * 9 + k * 3)));
    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo = mergeVertices(geo);
    geo.computeVertexNormals();
    geo.scale(R.head, R.head * 1.04, R.head * 0.98);
    const g = inked(geo, mat, 0.022);
    g.children[0].userData.hair = tris === mesh.shell ? 'shell' : tris === mesh.spikes ? 'spikes' : 'hang';
    head.add(g);
  }
  // co điểm trước khi dựng ống: LOD thấp dựng lại ống từ `parameters.path`, co hình học sau đó thì nét bay khỏi đầu
  for (const l of mesh.lines) {
    const pts = l.map(([x, y, z]) => new THREE.Vector3(x * R.head, y * R.head * 1.04, z * R.head * 0.98));
    head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), l.length * 2, 0.012, 5), ink));
  }
}

export interface StickmanOptions {
  /** `rig` của JSON nhân vật, px như JSON */
  rig: Rig;
  skin?: string;
  /** `pieces.torso.garment` */
  garment?: Partial<Garment>;
  color: string;
  accent?: string;
  /** `pieces.hem.skirt`, màu `skirtColor` */
  skirt?: Skirt;
  skirtColor?: string;
  /** `pieces.hair.sculpt`, bỏ trống là đầu trọc */
  hair?: Partial<Sculpt>;
  hairColor?: string;
  /** `pieces.faceAcc.glasses`; `true` là kính tròn mặc định */
  glasses?: boolean | Partial<Glasses>;
  /** `pieces.faceAcc.color`, bỏ trống là màu áo */
  glassesColor?: string;
  /** `face` của JSON nhân vật: chỗ mắt, khoảng hai mắt, mắt → mồm */
  faceShape?: Partial<FaceShape>;
  /** Nét mặt lúc dựng; `act` đổi theo từng khung */
  face?: Partial<FaceState>;
  seed?: number;
  sleeveWidth?: number;
  trouserWidth?: number;
  /** Gập đùi ra trước để váy phủ theo đùi */
  seated?: boolean;
  lod?: Lod;
  /** Hàm dựng vật theo tên (`items` của JSON nhân vật); `dress` gắn vào socket */
  items?: ItemFactories;
  /** `items` của JSON nhân vật: cấu hình từng socket, chuyển nguyên cho hàm dựng */
  itemSpecs?: Gear['specs'];
  /** Đồ mặc lúc dựng, như `dress` */
  equip?: EquipState;
}

/** Một người que 3D theo JSON nhân vật của rig. */
export function stickman({ rig, skin = '#f0d9b8', garment, color, accent, skirt, skirtColor = color, hair, hairColor = '#2a1c15', glasses = false, glassesColor, faceShape, face, seed = 0, sleeveWidth = 10, trouserWidth = 10, seated = false, lod = 'full', items, itemSpecs, equip }: StickmanOptions): Figure {
  q = QUALITY[lod];
  const root = new THREE.Group();
  const hips = joint(root, 0, R.thigh + R.shin + R.limb, 0);
  const spine = joint(hips, 0, 0.0, 0);
  sculptTorso(spine, { garment, rig, color, accent, ink: INK });
  // khối thân áo là mảnh đầu tiên: `collide` lấy hộp thân từ nó
  spine.children[0].userData.torso = true;
  if (skirt) {
    const dir: Vec3 = seated ? [0, 0.08, 1] : [0, 1, 0];
    const thighs = SIDES.map((s) => ({ hip: [s * rig.hipHalf, 0, 0] as Vec3, dir }));
    sculptSkirt(spine, { skirt, rig, color: skirtColor, ink: INK, thighs, legW: trouserWidth });
  }
  const neck = joint(spine, 0, R.torso, 0);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.2, q.neck), npr({ color: skin, stipple: 0 }));
  neckMesh.position.y = 0.05;
  neck.add(neckMesh);
  const head = joint(neck, 0, R.neck + R.head * 0.95, 0);
  const skullScale = new THREE.Vector3(1, 1.04, 0.98);
  const skull = new THREE.SphereGeometry(R.head, ...q.skull);
  skull.scale(skullScale.x, skullScale.y, skullScale.z);
  head.add(inked(skull, npr({ color: skin, stipple: 0.035, stippleScale: 4, soft: 1, flat: true }), 0.03));
  const faceR = lod === 'low' ? stillFace(skullScale, faceShape, face) : faceRig(R.head, skullScale, faceShape, { ...DEFAULT_FACE, ...face });
  head.add(faceR.mesh);
  if (glasses) {
    const sh = { eyeGap: 26, offsetY: 0, ...faceShape };
    const asin = (v: number) => (Math.asin(Math.max(-1, Math.min(1, v / 65))) * 180) / Math.PI;
    const g = glassesMesh(glasses === true ? {} : glasses, { eye: [asin(sh.eyeGap / 2), -asin(sh.offsetY)], color: glassesColor ?? color, line: INK, stroke: rig.stroke });
    g.scale.copy(skullScale).multiplyScalar(R.head);
    head.add(g);
  }
  if (hair) sculptHair(head, hair, hairColor);
  const legs = { [-1]: leg(hips, -1, rig.hipHalf / 100), [1]: leg(hips, 1, rig.hipHalf / 100) } as Record<Side, Leg>;
  const sx = shoulderRoot(garment, rig) / 100, sy = (120 - rig.shoulderDrop) / 100;
  const arms = { [-1]: arm(spine, -1, sx, sy), [1]: arm(spine, 1, sx, sy) } as Record<Side, Arm>;
  // tay chân rủ hơi choãi như hình 2D
  for (const s of SIDES) arms[s].shoulder.rotation.z = s * 0.2;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !o.userData.noShadow) o.castShadow = true;
  });
  for (const s of SIDES) {
    for (const j of [arms[s].shoulder, arms[s].elbow]) j.children.forEach((m) => m.userData.limb && m.scale.set(sleeveWidth / 10, 1, sleeveWidth / 10));
    for (const j of [legs[s].hip, legs[s].knee]) j.children.forEach((m) => m.userData.limb && m.scale.set(trouserWidth / 10, 1, trouserWidth / 10));
  }
  const shell = head.children.flatMap((g) => g.children.filter((m) => m.userData.hair === 'shell').map((m) => ((m as THREE.Mesh).geometry.attributes.position.array)));
  const fit = headFit(skullScale.clone().multiplyScalar(R.head), shell, faceShape?.offsetY ?? 0);
  if (lod === 'low') {
    spine.traverse((o) => {
      const g = (o as THREE.Mesh).geometry as THREE.TubeGeometry | undefined;
      if (g?.type !== 'TubeGeometry') return;
      const p = g.parameters;
      (o as THREE.Mesh).geometry = new THREE.TubeGeometry(p.path, Math.max(4, Math.ceil(p.tubularSegments / 4)), p.radius, 4, p.closed);
    });
    for (const j of [spine, neck, head]) mergeStatic(j);
  }
  const sockets = buildSockets({ root, spine, head, arms }, fit, (R.limb * sleeveWidth) / 10, rig);
  const fig: Figure = { root, hips, spine, neck, head, arms, legs, face: faceR, seed, sockets, gear: newGear(items, itemSpecs), lod };
  if (equip) dress(fig, equip);
  return fig;
}

const stillFaces = new Map<string, FaceRig>();
/** Nét mặt dùng chung cho người nền: một texture cho mọi người cùng dáng mặt, `set` không đổi gì */
function stillFace(scale: THREE.Vector3, shape?: Partial<FaceShape>, state?: Partial<FaceState>): FaceRig {
  const s = { ...DEFAULT_FACE, ...state }, key = JSON.stringify([shape, s]);
  let f = stillFaces.get(key);
  if (!f) stillFaces.set(key, (f = faceRig(R.head, scale, shape, s)));
  const mesh = new THREE.Mesh(f.mesh.geometry, f.mesh.material);
  mesh.userData.noShadow = true;
  mesh.renderOrder = f.mesh.renderOrder;
  return { mesh, state: s, set() {} };
}

/** Gộp mọi khối tĩnh dưới khớp `j` (không qua khớp con, trừ nét chi và nét mặt) thành một mesh mỗi vật liệu */
function mergeStatic(j: THREE.Object3D) {
  j.updateMatrixWorld(true);
  const inv = j.matrixWorld.clone().invert();
  const groups = new Map<string, THREE.Mesh[]>();
  const keyOf = (m: THREE.Material) => {
    const u = (m as THREE.ShaderMaterial).uniforms;
    return m.side === THREE.BackSide && u?.uW ? `hull ${u.uW.value} ${u.uColor.value.getHex()}` : m.uuid;
  };
  const walk = (o: THREE.Object3D) => {
    for (const c of o.children) {
      const m = c as THREE.Mesh;
      if (m.isMesh && !m.userData.limb && m.renderOrder === 0 && !Array.isArray(m.material)) {
        const k = keyOf(m.material), list = groups.get(k) ?? [];
        list.push(m);
        groups.set(k, list);
      } else if (!m.isMesh && c.children.length && Object.keys(c.userData).length === 0 && !isJoint(c)) walk(c);
    }
  };
  walk(j);
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const mat = list[0].material as THREE.Material;
    const geos = list.map((m) => {
      const g = new THREE.BufferGeometry();
      const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
      g.setAttribute('position', src.attributes.position.clone());
      g.setAttribute('normal', src.attributes.normal.clone());
      return g.applyMatrix4(inv.clone().multiply(m.matrixWorld));
    });
    const merged = new THREE.Mesh(mergeGeometries(geos), mat);
    merged.castShadow = list.some((m) => m.castShadow);
    if (list.some((m) => m.userData.torso)) merged.userData.torso = true;
    if (list.every((m) => m.userData.noShadow)) merged.userData.noShadow = true;
    for (const m of list) m.removeFromParent();
    j.add(merged);
  }
}
const isJoint = (o: THREE.Object3D) => !!o.userData.joint;

/** Các trường của JSON nhân vật mà người 3D đọc. Truyền object đã qua `parseCharacter` của @stickman/rig. */
export interface CharacterJson {
  rig: Rig;
  palette: { garment: string; skin?: string; sleeveWidth?: number; trouserWidth?: number };
  face?: Partial<FaceShape>;
  pieces: {
    torso: { garment?: Partial<Garment> };
    hem?: { skirt?: Skirt; color?: string };
    hair?: { sculpt?: Partial<Sculpt>; color?: string };
    faceAcc?: { src: string; glasses?: Partial<Glasses>; color?: string };
  };
  /** Vật gọi tên: socket → cấu hình; `opts.items` cấp hàm dựng 3D theo cùng tên */
  items?: Gear['specs'];
}

/** Tham số `stickman` đọc từ JSON nhân vật của rig (cho `seatCrowd`, hay đè thêm trước khi dựng); `opts` đè lên số đọc từ JSON. */
export function characterOptions(json: CharacterJson, opts: Partial<StickmanOptions> = {}): StickmanOptions {
  const pal = json.palette, pc = json.pieces;
  return {
    rig: json.rig, garment: pc.torso.garment, color: pal.garment, skin: pal.skin,
    skirt: pc.hem?.skirt, skirtColor: pc.hem?.color, hair: pc.hair?.sculpt, hairColor: pc.hair?.color,
    sleeveWidth: pal.sleeveWidth, trouserWidth: pal.trouserWidth, faceShape: json.face, itemSpecs: json.items,
    glasses: pc.faceAcc?.src === 'sculpt' && pc.faceAcc.glasses, glassesColor: pc.faceAcc?.color, ...opts,
  };
}

/** Người que từ JSON nhân vật của rig; `opts` đè lên số đọc từ JSON. */
export const fromCharacter = (json: CharacterJson, opts: Partial<StickmanOptions> = {}): Figure => stickman(characterOptions(json, opts));

const deg = Math.PI / 180;

/**
 * Đặt người theo toạ độ thế giới rig: `at` (đứng: điểm sàn dưới hông; ngồi: điểm mặt ngồi dưới khớp hông), `yaw` độ
 * (0 mặt về +x, 90 về −z). `sit` gập đùi ra trước, ngả thân.
 */
export function put(p: Figure, at: Vec3, yaw: number, sit = false) {
  p.root.position.copy(toThree([at[0], 0, at[2]]));
  p.root.rotation.y = Math.PI / 2 - yaw * deg;
  if (sit) {
    p.hips.position.y = -at[1] * 0.01 + R.limb;
    for (const s of SIDES) {
      p.legs[s].hip.rotation.set(-Math.PI / 2 + 0.06, 0, s * 0.04);
      p.legs[s].knee.rotation.x = Math.PI / 2 - 0.06;
    }
    p.spine.rotation.x = 0.14;
  } else for (const s of SIDES) p.legs[s].hip.rotation.set(0, 0, s * 0.03);
}
