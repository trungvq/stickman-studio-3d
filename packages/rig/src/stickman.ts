import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
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
}

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
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), ink);
  m.position.y = -len / 2;
  m.userData.limb = true;
  return m;
}

function joint(parent: THREE.Object3D, x: number, y: number, z: number) {
  const j = new THREE.Group();
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
    head.add(inked(geo, mat, 0.022));
  }
  for (const l of mesh.lines) {
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(l.map((p) => new THREE.Vector3(...p))), l.length * 2, 0.012 / R.head, 5);
    geo.scale(R.head, R.head * 1.04, R.head * 0.98);
    head.add(new THREE.Mesh(geo, ink));
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
}

/** Một người que 3D theo JSON nhân vật của rig. */
export function stickman({ rig, skin = '#f0d9b8', garment, color, accent, skirt, skirtColor = color, hair, hairColor = '#2a1c15', glasses = false, glassesColor, faceShape, face, seed = 0, sleeveWidth = 10, trouserWidth = 10, seated = false }: StickmanOptions): Figure {
  const root = new THREE.Group();
  const hips = joint(root, 0, R.thigh + R.shin + R.limb, 0);
  const spine = joint(hips, 0, 0.0, 0);
  sculptTorso(spine, { garment, rig, color, accent, ink: INK });
  if (skirt) {
    const dir: Vec3 = seated ? [0, 0.08, 1] : [0, 1, 0];
    const thighs = SIDES.map((s) => ({ hip: [s * rig.hipHalf, 0, 0] as Vec3, dir }));
    sculptSkirt(spine, { skirt, rig, color: skirtColor, ink: INK, thighs, legW: trouserWidth });
  }
  const neck = joint(spine, 0, R.torso, 0);
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.2, 10), npr({ color: skin, stipple: 0 }));
  neckMesh.position.y = 0.05;
  neck.add(neckMesh);
  const head = joint(neck, 0, R.neck + R.head * 0.95, 0);
  const skullScale = new THREE.Vector3(1, 1.04, 0.98);
  const skull = new THREE.SphereGeometry(R.head, 36, 24);
  skull.scale(skullScale.x, skullScale.y, skullScale.z);
  head.add(inked(skull, npr({ color: skin, stipple: 0.035, stippleScale: 4, soft: 1 }), 0.03));
  const faceR = faceRig(R.head, skullScale, faceShape, { ...DEFAULT_FACE, ...face });
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
  return { root, hips, spine, neck, head, arms, legs, face: faceR, seed };
}

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
}

/** Người que từ JSON nhân vật của rig; `opts` đè lên số đọc từ JSON. */
export function fromCharacter(json: CharacterJson, opts: Partial<StickmanOptions> = {}): Figure {
  const pal = json.palette, pc = json.pieces;
  return stickman({
    rig: json.rig, garment: pc.torso.garment, color: pal.garment, skin: pal.skin,
    skirt: pc.hem?.skirt, skirtColor: pc.hem?.color, hair: pc.hair?.sculpt, hairColor: pc.hair?.color,
    sleeveWidth: pal.sleeveWidth, trouserWidth: pal.trouserWidth, faceShape: json.face,
    glasses: pc.faceAcc?.src === 'sculpt' && pc.faceAcc.glasses, glassesColor: pc.faceAcc?.color, ...opts,
  });
}

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
