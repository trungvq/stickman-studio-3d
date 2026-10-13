import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildSockets, dress, headFit, newGear, type EquipState, type Gear, type ItemFactories, type Sockets } from './attach';
import { D, DEFAULT_FACE } from './core/constants';
import type { FaceState } from './core/types';
import { faceRig, type FaceRig, type FaceShape } from './face';
import { sculptSkirt, sculptTorso, type SkirtOptions } from './garment';
import { glassesMesh } from './glasses';
import { INK, toThree, type Vec3 } from './khoi';
import { hullMaterial, npr } from './npr';
import { sculptMesh } from './sculpt';
import { limbWidths, type Garment, type Glasses, type Hat, type Pin, type Sculpt, type Skirt } from './core/schema';
import { hatFit, hatMesh, insideHat, pinMesh } from './core/hat';
import { BONES3, bones3, CLAD_TAPER, cladHand, cladThigh, head3, roots3, type Bones3 } from './core/act3';
import { blushLevel, chibiShape } from './core/face';
import { wornSkirt } from './core/skirtShape';
import { humanHair, humanSkull } from './core/humanHead';
import { Ankle, earGroup, handRig, humanHeadGeometry, neckGeometry, pelvisGeometry, shoeCapsule, shoeGeometry, type Hand } from './human';
import { handGrip } from './core/hand';
import type { Rig } from './torso';

// Tỉ lệ lấy từ RIG của @stickman3d/sketch, chia 100: người cao ~4,3 đơn vị, đầu to bằng gần một phần ba. Độ dài đoạn của
// một người theo `rig.height` ở `Figure.bones`; `R` chỉ đúng ở `height = 1`, đầu và bề dày nét thì đúng mọi người.
export const R = BONES3;

const ink = npr({ color: INK, stipple: 0 });
const hull = hullMaterial(0.026, INK);
/** Vỏ viền chi của người `clad`: mỏng hơn thân để chỗ tay lấn vào thân áo không thành vệt đen */
const limbHull = hullMaterial(0.018, INK);
/**
 * Nét bóng dáng hậu kỳ của thân áo, khối hông, tay chân người `clad`: vỏ ngược của tay buông sát sườn hay vắt trước bụng
 * chìm sau thân áo. Thân áo và tay áo cùng màu là cùng vật liệu nên vai liền không có đường may
 */
const LIMB_SIL = 0.018;
/** Vỏ viền bàn tay lùi sau mặt bấy nhiêu (three, nhân cỡ bàn tay): hơn bề dày ngón, kém khoảng bàn tay tới vật sau nó */
const HAND_INK_PUSH = 0.03;

/** `-1` bên phải người (−x khi người nhìn +z), `1` bên trái. */
export type Side = -1 | 1;
const SIDES = [-1, 1] as const;
/** `wrist` treo ở đầu cẳng tay, xoay theo bàn tay (xoay cẳng tay, gập, lệch cổ tay): chỗ gắn bàn tay và đồ cầm */
export interface Arm { shoulder: THREE.Group; elbow: THREE.Group; wrist: THREE.Group }
/** `ankle` chỉ có ở người `clad`: giày treo ở đó */
export interface Leg { hip: THREE.Group; knee: THREE.Group; ankle?: THREE.Group }
export type { Hand };
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
  /** Váy dựng khối: `act` gọi `fitSkirt` dựng lại theo đùi khi đùi đổi hướng trong hệ thân */
  skirt?: { opts: Omit<SkirtOptions, 'thighs'>; group: THREE.Group; key: string };
  /** Vạt áo người ngồi: `act` gọi `fitSkirt` gập lại theo đùi khi đùi đổi hướng trong hệ thân */
  lap?: { refold: (dir: [number, number]) => void; key: string };
  /** Bàn tay của người `clad` */
  hands?: Record<Side, Hand>;
  /** Khung xương theo `rig.height` (`bones3` của lõi): `act` đặt đoạn chi bằng nó */
  bones: Bones3;
  /** Tay choãi, radian (`roots3`) */
  splay: number;
}

/** `low`: người nền rẻ — ít mặt lưới, gộp khối tĩnh theo vật liệu, nét mặt đứng yên dùng chung texture, không chớp mắt */
export type Lod = 'full' | 'low';
/** `limb`: vòng mỗi đầu tròn, cạnh quanh ống, đoạn dọc ống */
interface Quality { skull: [number, number]; limb: [number, number, number] }
const QUALITY: Record<Lod, Quality> = {
  full: { skull: [36, 24], limb: [4, 10, 12] },
  low: { skull: [16, 11], limb: [2, 6, 5] },
};
let q = QUALITY.full;

/** Khối tô màu có viền dày: mesh chính + vỏ ngược. */
function inked(geo: THREE.BufferGeometry, mat: THREE.Material, w?: number, push = 0) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  g.add(m);
  const h = new THREE.Mesh(geo, w ? hullMaterial(w, INK, push) : hull);
  h.userData.noShadow = true;
  g.add(h);
  return g;
}

/** Ống tròn đầu theo một đoạn Bézier bậc ba, lưới cố định; `fillTube` uốn lại. */
function tube() {
  const [cap, m, n] = q.limb, rings = 2 * cap + n + 1;
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(rings * m * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const idx: number[] = [];
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < m; j++) {
      const a = i * m + j, b = i * m + ((j + 1) % m);
      idx.push(a, b, a + m, b, b + m, a + m);
    }
  }
  geo.setIndex(idx);
  // lưới dựng theo chất lượng của người lúc dựng; `q` đổi theo người dựng sau
  geo.userData.limb = q.limb;
  return geo;
}

const bez = (c: THREE.Vector3[], u: number, out: THREE.Vector3) => {
  const v = 1 - u;
  return out.copy(c[0]).multiplyScalar(v * v * v).addScaledVector(c[1], 3 * v * v * u).addScaledVector(c[2], 3 * v * u * u).addScaledVector(c[3], u * u * u);
};
const bezTangent = (c: THREE.Vector3[], u: number, out: THREE.Vector3) => {
  const v = 1 - u;
  out.subVectors(c[1], c[0]).multiplyScalar(3 * v * v).addScaledVector(_d.subVectors(c[2], c[1]), 6 * v * u).addScaledVector(_d.subVectors(c[3], c[2]), 3 * u * u);
  if (out.lengthSq() < 1e-12) out.subVectors(c[3], c[0]);
  if (out.lengthSq() < 1e-12) out.set(0, -1, 0);
  return out.normalize();
};
const _d = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3(), _r = new THREE.Vector3();

const _e = new THREE.Vector3();
/**
 * Dựng ống theo đường cong `c`: cả đoạn, hay phần `u0..u1` (ống tay áo, cổ tay áo), bán kính `r0` → `r1`; mút cuối nở
 * `rim` lần, hai mút tròn dẹt theo `flat0`, `flat1` (`1` là nửa cầu).
 */
function fillTube(geo: THREE.BufferGeometry, c: THREE.Vector3[], r0: number, r1 = r0, u0 = 0, u1 = 1, rim = 1, flat0 = 1, flat1 = 1) {
  const [cap, m, n] = geo.userData.limb as Quality['limb'];
  const pos = geo.attributes.position as THREE.BufferAttribute, nor = geo.attributes.normal as THREE.BufferAttribute;
  let k = 0;
  const ring = (center: THREE.Vector3, along: number, rad: number, lean: number) => {
    for (let j = 0; j < m; j++, k++) {
      const a = (j / m) * Math.PI * 2;
      _r.copy(_n).multiplyScalar(Math.cos(a)).addScaledVector(_b, Math.sin(a));
      pos.setXYZ(k, center.x + _r.x * rad, center.y + _r.y * rad, center.z + _r.z * rad);
      _r.multiplyScalar(lean).addScaledVector(_t, along);
      nor.setXYZ(k, _r.x, _r.y, _r.z);
    }
  };
  bezTangent(c, u0, _t);
  _n.set(Math.abs(_t.x) < 0.9 ? 1 : 0, 0, Math.abs(_t.x) < 0.9 ? 0 : 1).addScaledVector(_t, -(Math.abs(_t.x) < 0.9 ? _t.x : _t.z)).normalize();
  _b.crossVectors(_t, _n);
  for (let i = 0; i < cap; i++) {
    const f = (i / cap) * (Math.PI / 2);
    ring(_c.copy(u0 === 0 ? c[0] : bez(c, u0, _e)).addScaledVector(_t, -r0 * flat0 * Math.cos(f)), -Math.cos(f), r0 * Math.sin(f), Math.sin(f));
  }
  for (let i = 0; i <= n; i++) {
    const u = u0 + ((u1 - u0) * i) / n;
    bezTangent(c, u, _t);
    // khung chuyển song song: pháp tuyến không xoắn theo đường cong
    _n.addScaledVector(_t, -_n.dot(_t)).normalize();
    _b.crossVectors(_t, _n);
    ring(bez(c, u, _c), 0, (r0 + ((r1 - r0) * i) / n) * (i === n ? rim : 1), 1);
  }
  const re = r1 * rim;
  for (let i = cap - 1; i >= 0; i--) {
    const f = (i / cap) * (Math.PI / 2);
    ring(_c.copy(u1 === 1 ? c[3] : bez(c, u1, _e)).addScaledVector(_t, re * flat1 * Math.cos(f)), Math.cos(f), re * Math.sin(f), Math.sin(f));
  }
  pos.needsUpdate = nor.needsUpdate = true;
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
}

/** Đoạn chi: nét đen tròn đầu, mọc từ gốc khớp theo −y; `bendLimb` uốn theo khớp. */
function limb(len: number) {
  const m = new THREE.Mesh(tube(), ink);
  m.userData.limb = true;
  m.userData.len = len;
  m.userData.r = R.limb;
  return m;
}

const ONE = new THREE.Vector3(1, 1, 1);

/** Ống phủ trên đoạn chi của người `clad`: phần `u0..u1`, to hơn ống chi `k` lần, mút cuối nở `rim`, dẹt `flat` */
interface Cover { geo: THREE.BufferGeometry; u0: number; u1: number; k: number; rim: number; flat: number }

/**
 * Ống của một đoạn chi theo đường cong `c`: ống chính (`userData.taper` nhân bán kính hai mút, `userData.root` độ tròn mút
 * gốc) rồi các ống phủ
 */
function tubes(m: THREE.Mesh, c: THREE.Vector3[]) {
  const r = m.userData.r as number, taper = m.userData.taper as [number, number] | undefined;
  if (!taper) return fillTube(m.geometry, c, r);
  const [a, b] = [r * taper[0], r * taper[1]], root = (m.userData.root as number | undefined) ?? 1;
  fillTube(m.geometry, c, a, b, 0, 1, 1, root);
  for (const v of (m.userData.covers ?? []) as Cover[]) {
    const ra = (a + (b - a) * v.u0) * v.k, rb = (a + (b - a) * v.u1) * v.k;
    fillTube(v.geo, c, ra, rb, v.u0, v.u1, v.rim, v.u0 > 0 ? v.flat : root, v.u1 < 1 ? v.flat : 1);
  }
}
/**
 * Uốn hai đoạn chi như `limbCurves` của rig 2D: hai đoạn Bézier bậc ba qua gốc, khớp giữa, đầu chi; tiếp tuyến ở khớp
 * giữa song song gốc → đầu chi, `k` là `limbCurve`. Đặt vào `userData.bend` của hai đoạn; pipeline gọi trước mỗi lượt vẽ.
 */
function bendLimb(upper: THREE.Mesh, mid: THREE.Object3D, lower: THREE.Mesh, k: number) {
  let key = '';
  const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), P2 = new THREE.Vector3(), inv = new THREE.Matrix4();
  const bend = () => {
    P1.copy(mid.position);
    P2.set(0, -lower.userData.len, 0).applyQuaternion(mid.quaternion).add(P1);
    const now = [P1.x, P1.y, P1.z, P2.x, P2.y, P2.z, upper.userData.r, lower.userData.r].join();
    if (now === key) return;
    key = now;
    const f = k / 6;
    const T0 = P1.clone().multiplyScalar(f), T1 = P2.clone().multiplyScalar(f), T2 = P2.clone().sub(P1).multiplyScalar(f);
    tubes(upper, [P0, T0, P1.clone().sub(T1), P1]);
    inv.compose(mid.position, mid.quaternion, ONE).invert();
    tubes(lower, [P1.clone(), P1.clone().add(T1), P2.clone().sub(T2), P2].map((p) => p.applyMatrix4(inv)));
  };
  upper.userData.bend = lower.userData.bend = bend;
  bend();
}

function joint(parent: THREE.Object3D, x: number, y: number, z: number) {
  const j = new THREE.Group();
  j.userData.joint = true;
  j.position.set(x, y, z);
  parent.add(j);
  return j;
}

/** Chân hai đoạn: `hip` quay đùi, `knee` gập ống. */
function leg(parent: THREE.Object3D, side: Side, hipHalf: number, B: Bones3): Leg {
  const hip = joint(parent, side * hipHalf, 0, 0);
  hip.add(limb(B.thigh));
  const knee = joint(hip, 0, -B.thigh, 0);
  knee.add(limb(B.shin));
  return { hip, knee };
}

function arm(parent: THREE.Object3D, side: Side, x: number, y: number, B: Bones3): Arm {
  const shoulder = joint(parent, side * x, y, 0);
  shoulder.add(limb(B.upperArm));
  const elbow = joint(shoulder, 0, -B.upperArm, 0);
  elbow.add(limb(B.foreArm));
  const wrist = joint(elbow, 0, -B.foreArm, 0);
  return { shoulder, elbow, wrist };
}

/**
 * Tóc dựng khối của rig (`pieces.hair.sculpt` trong JSON nhân vật), lưới hệ sọ đơn vị phóng theo khối đầu. Đầu `human`:
 * tóc dời theo sọ (`humanHair`).
 */
function sculptHair(head: THREE.Object3D, sculpt: Partial<Sculpt>, color: string, human: boolean, cut?: (p: Vec3) => boolean, accent?: string) {
  const mesh = sculptMesh(sculpt, { cut, accent: !!accent });
  if (human) {
    const bend = (p: number[]) => humanHair(p as Vec3);
    for (const tris of [mesh.shell, mesh.spikes, mesh.hang]) tris.forEach((t, i) => (tris[i] = t.map(bend) as typeof t));
    mesh.lines.forEach((l, i) => (mesh.lines[i] = l.map(bend) as typeof l));
  }
  // vỏ ngược đánh nhau độ sâu với sọ ngay dưới và bị vỏ tóc che ở lọn nằm sát: nét bóng dáng vẽ ở hậu kỳ
  // màu phụ: một vật liệu màu theo đỉnh, nên chỗ giáp hai màu không có nét như hai vật
  const mat = npr({ color: accent ? '#ffffff' : color, stipple: 0.05, stippleScale: 5, soft: 0.6, doubleSided: true, ink: 0.022, tint: !!accent });
  const [c0, c1] = [new THREE.Color(color), new THREE.Color(accent ?? color)];
  for (const tris of [mesh.shell, mesh.spikes, mesh.hang]) {
    if (!tris.length) continue;
    const tone = accent ? tris.map((_, i) => (tris === mesh.shell && mesh.tone?.[i] ? c1 : c0)) : undefined;
    const g = new THREE.Group(), m = new THREE.Mesh(skullGeometry(tris, tone), mat);
    m.castShadow = true;
    m.userData.hair = tris === mesh.shell ? 'shell' : tris === mesh.spikes ? 'spikes' : 'hang';
    head.add(g.add(m));
  }
  inkLines(head, mesh.lines, 0.012);
}

/** Lưới từ tam giác của hệ sọ đơn vị, phóng theo khối đầu như tóc; `tone` là màu từng tam giác (thuộc tính `tint`) */
function skullGeometry(tris: Vec3[][], tone?: THREE.Color[]) {
  const pos = new Float32Array(tris.length * 9);
  tris.forEach((t, i) => t.forEach((p, k) => pos.set(p, i * 9 + k * 3)));
  let geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (tone) {
    const col = new Float32Array(tris.length * 9);
    tone.forEach((c, i) => [0, 1, 2].forEach((k) => col.set([c.r, c.g, c.b], i * 9 + k * 3)));
    geo.setAttribute('tint', new THREE.BufferAttribute(col, 3));
  }
  geo = mergeVertices(geo);
  geo.computeVertexNormals();
  geo.scale(R.head, R.head * 1.04, R.head * 0.98);
  return geo;
}

/** Nét mực trên đầu theo các đường của hệ sọ đơn vị; đường khép kín khi điểm cuối trùng điểm đầu */
function inkLines(head: THREE.Object3D, lines: Vec3[][], r: number) {
  // co điểm trước khi dựng ống: LOD thấp dựng lại ống từ `parameters.path`, co hình học sau đó thì nét bay khỏi đầu
  for (const l of lines) {
    const closed = l.length > 2 && l[0].every((v, d) => v === l[l.length - 1][d]);
    const pts = (closed ? l.slice(0, -1) : l).map(([x, y, z]) => new THREE.Vector3(x * R.head, y * R.head * 1.04, z * R.head * 0.98));
    head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), l.length * 2, r, 5, closed), ink));
  }
}

/**
 * Mũ dựng khối (`pieces.crown.hat`) ôm sọ và vỏ tóc `hair`; trả vùng trong lòng mũ để tóc bỏ lọn, búi nằm trong ấy.
 * docs/02-trang-phuc.md#mũ-dựng-khối
 */
function sculptHat(head: THREE.Object3D, hat: Partial<Hat>, hair: Partial<Sculpt> | undefined, color: string) {
  const fit = hatFit(hat, hair);
  const { tris, lines } = hatMesh(hat, fit);
  const m = new THREE.Mesh(skullGeometry(tris), npr({ color, stipple: 0.04, stippleScale: 4, soft: 0.7, doubleSided: true, ink: 0.03 }));
  m.castShadow = true;
  m.userData.hair = 'hat';
  head.add(new THREE.Group().add(m));
  inkLines(head, lines, 0.01);
  return (p: Vec3) => insideHat(fit, p);
}

/** Trâm cài búi (`pieces.headAcc.pin`) xuyên khối buộc của tóc `hair`: que màu `color`, hạt màu `bead`. docs/02-trang-phuc.md#trâm-cài-búi */
function sculptPin(head: THREE.Object3D, pin: Partial<Pin>, hair: Partial<Sculpt> | undefined, human: boolean, color: string, bead: string) {
  const m = pinMesh(pin, hair);
  const bend = (t: Vec3[]) => (human ? t.map(humanHair) : t);
  for (const [tris, c] of [[m.stick, color], [m.bead, bead]] as const) {
    const mesh = new THREE.Mesh(skullGeometry(tris.map(bend)), npr({ color: c, stipple: 0.03, stippleScale: 4, soft: 0.7, ink: 0.014 }));
    mesh.castShadow = true;
    head.add(new THREE.Group().add(mesh));
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
  /** `pieces.hair.accent`: màu phụ của tóc dựng khối, vùng theo `accentTo` / `accentFrom` */
  hairAccent?: string;
  /** `pieces.crown.hat`: mũ dựng khối, màu `hatColor` (bỏ trống là màu áo) */
  hat?: Partial<Hat>;
  hatColor?: string;
  /** `pieces.headAcc.pin`: trâm cài búi, que màu `pinColor`, hạt màu `pinBead` */
  pin?: Partial<Pin>;
  pinColor?: string;
  pinBead?: string;
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
  /** Dáng váy lúc dựng, trước lần `act` đầu: đùi gập ra trước */
  seated?: boolean;
  /** `palette.limbCurve` của JSON nhân vật: độ cong nét chi `0..1`, `0` là hai đoạn thẳng gãy ở khuỷu, gối */
  limbCurve?: number;
  lod?: Lod;
  /** Hàm dựng vật theo tên (`items` của JSON nhân vật); `dress` gắn vào socket */
  items?: ItemFactories;
  /** `items` của JSON nhân vật: cấu hình từng socket, chuyển nguyên cho hàm dựng */
  itemSpecs?: Gear['specs'];
  /** Đồ mặc lúc dựng, như `dress` */
  equip?: EquipState;
  /** `palette.clad`: tay chân là ống màu có viền, bàn tay, giày, khối hông. docs/01-rig.md#người-3d-mặc-đồ */
  clad?: boolean;
  /** `palette.sleeve`, `palette.trouser`, `palette.shoe` */
  sleeveColor?: string;
  trouserColor?: string;
  shoeColor?: string;
  /** `palette.bicep`: gốc cánh tay to thêm bấy nhiêu phần */
  bicep?: number;
  /** `palette.sleeveLength`, `palette.trouserLength`: phần chi phủ màu áo, quần từ gốc chi */
  sleeveLength?: number;
  trouserLength?: number;
  /** `head.form` */
  headForm?: 'sphere' | 'human';
}

/** Một người que 3D theo JSON nhân vật của rig. */
export function stickman(o: StickmanOptions): Figure {
  const { rig, skin = '#f0d9b8', garment, color, accent, skirt, skirtColor = color, hair, hairColor = '#2a1c15', glasses = false, glassesColor, faceShape, face, seed = 0, seated = false, limbCurve = 1, lod = 'full', items, itemSpecs, equip } = o;
  const clad = !!o.clad, human = o.headForm === 'human';
  const { sleeve: sleeveWidth, trouser: trouserWidth } = limbWidths(o);
  // người `clad`: nửa bề dày chi như `limbHalf` của lõi (gồm viền), nên người ngồi nằm đúng trên mặt ghế
  const limbR = (w: number) => (clad ? (w + rig.stroke) / 200 : (R.limb * w) / 10);
  q = QUALITY[lod];
  const B = bones3(rig.height);
  const root = new THREE.Group();
  const hips = joint(root, 0, B.thigh + B.shin + B.limb, 0);
  const spine = joint(hips, 0, 0.0, 0);
  const bicep = o.bicep ?? 0;
  const thighR = clad ? cladThigh(trouserWidth, rig.stroke) : 0;
  const at = roots3(garment, rig, { clad, sleeve: sleeveWidth, trouser: trouserWidth, bicep, skirt });
  const [sx, sy] = at.shoulder;
  // người ngồi: vạt áo dưới hông nằm trên đùi, không buông xuyên đùi xuống ghế; mặc váy thì thân áo dừng ở cạp
  // mặt ghế dưới hông `legHalf` của `body3`; vạt nằm trên chỗ cao nhất của mặt đùi gồm cả vỏ viền: gối gập vuông thì đùi
  // cong vồng lên theo `bendLimb` (điểm điều khiển thứ hai nhô `limbCurve / 6` ống chân) trong khi ống thon dần về gối
  const seatAt = (clad ? thighR : trouserWidth / 2) - 0.5;
  const [r0, r1] = clad ? [thighR + 1.8, CLAD_TAPER.leg[1] * limbR(trouserWidth) * 100 + 1.8] : [limbR(trouserWidth) * 100 + 2.6, limbR(trouserWidth) * 100 + 2.6];
  const thighTop = Math.max(...Array.from({ length: 11 }, (_, i) => i / 10).map((t) => 3 * t * t * (1 - t) * (B.shin * 100 * limbCurve) / 6 + r0 + (r1 - r0) * t));
  // gập sẵn hơi chếch lên cho người nền `lod: 'low'` (gộp lưới, không gập lại): thân ngả trước vài độ thì vạt vẫn trên đùi
  const lap = seated ? (skirt ? { seat: -skirt.rise * rig.height } : { seat: seatAt, fold: { top: -(thighTop + 1), dir: [-0.1, 1] as [number, number] } }) : undefined;
  const body = sculptTorso(spine, { garment, rig, color, accent, ink: INK, arm: at.room, lap, ...(clad && { sil: LIMB_SIL }), ...(clad && skirt && { tuck: -skirt.rise * rig.height }) });
  // khối thân áo là mảnh đầu tiên: `collide` lấy hộp thân từ nó
  spine.children[0].userData.torso = true;
  spine.children[0].userData.inkGap = Math.max(...body.depth) / 100;
  let skirtRig: Figure['skirt'];
  if (skirt) {
    const dir: Vec3 = seated ? [0, 0.08, 1] : [0, 1, 0];
    const thighs = SIDES.map((s) => ({ hip: [s * rig.hipHalf, 0, 0] as Vec3, dir }));
    const opts = { skirt, rig, color: skirtColor, ink: INK, legW: clad ? 2 * thighR : trouserWidth, ...(clad && { body, knee: (thighR * CLAD_TAPER.leg[1]) / CLAD_TAPER.leg[0] }) };
    skirtRig = { opts, group: sculptSkirt(spine, { ...opts, thighs }), key: '' };
  }
  const neck = joint(spine, 0, B.torso, 0);
  const skullScale = new THREE.Vector3(1, 1.04, 0.98);
  // đáy sọ trên mép cổ áo (khớp cổ của lõi + `rise` 6 của áo phông)
  const head = joint(neck, 0, head3(B, human), 0);
  if (human) head.userData.human = true;
  // kính và mốc đầu đọc chỗ mắt đã dời của nét mặt chibi
  const eyes = { eyeGap: 26, offsetY: 0, mouthGap: 34, ...faceShape };
  if (human) Object.assign(eyes, chibiShape(eyes));
  let skull: THREE.BufferGeometry;
  if (human) skull = humanHeadGeometry(R.head, q.skull, skullScale);
  else {
    skull = new THREE.SphereGeometry(R.head, ...q.skull);
    skull.scale(skullScale.x, skullScale.y, skullScale.z);
  }
  const skin3 = { color: skin, stipple: 0.035, stippleScale: 4, soft: 1, flat: true };
  const skinMat = npr(skin3);
  // vỏ ngược dưới cằm `human` chìm sau cổ và cổ áo: nét bóng dáng vẽ thêm ở hậu kỳ
  head.add(inked(skull, human ? npr({ ...skin3, ink: 0.03 }) : skinMat, 0.03));
  const faceR = lod === 'low' ? stillFace(skullScale, faceShape, face, human, skin) : faceRig(R.head, skullScale, faceShape, { ...DEFAULT_FACE, ...face }, human, skin);
  head.add(faceR.mesh);
  if (glasses) {
    const asin = (v: number) => (Math.asin(Math.max(-1, Math.min(1, v / 65))) * 180) / Math.PI;
    const g = glassesMesh(glasses === true ? {} : glasses, { eye: [asin(eyes.eyeGap / 2), -asin(eyes.offsetY)], color: glassesColor ?? color, line: INK, stroke: rig.stroke });
    g.scale.copy(skullScale).multiplyScalar(R.head);
    head.add(g);
  }
  const cut = o.hat ? sculptHat(head, o.hat, hair, o.hatColor ?? color) : undefined;
  if (hair) sculptHair(head, hair, hairColor, human, cut, o.hairAccent);
  if (o.pin) sculptPin(head, o.pin, hair, human, o.pinColor ?? '#3a2a22', o.pinBead ?? o.pinColor ?? '#3a2a22');
  if (human) {
    for (const s of SIDES) {
      const ear = earGroup(s, R.head, skullScale, skinMat, hull, ink);
      if (!hairCovers(head, ear.position)) head.add(ear);
    }
    neck.add(inked(neckGeometry(head3(B, true) - R.head * 0.5, 0.135), skinMat, 0.022));
  }
  const legs = { [-1]: leg(hips, -1, at.hip, B), [1]: leg(hips, 1, at.hip, B) } as Record<Side, Leg>;
  const arms = { [-1]: arm(spine, -1, sx, sy, B), [1]: arm(spine, 1, sx, sy, B) } as Record<Side, Arm>;
  // tay chân rủ hơi choãi như hình 2D
  for (const s of SIDES) arms[s].shoulder.rotation.z = s * 0.2;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && !o.userData.noShadow) o.castShadow = true;
  });
  const seg = (j: THREE.Object3D) => j.children.find((m) => m.userData.limb) as THREE.Mesh;
  let hands: Figure['hands'];
  if (clad) {
    const tone = (c: string) => npr({ color: c, stipple: 0.05, stippleScale: 3, soft: 1, ink: LIMB_SIL });
    // vẽ cả mặt sau: ngón cái lấn vào ngón khác lúc nắm thì nhìn qua chỗ lấn thấy da, không thấy vỏ viền đen bên trong
    const limbSkin = npr({ ...skin3, ink: LIMB_SIL, doubleSided: true });
    // chân trần là vật khác bàn tay: tay đặt lên đùi vẫn có nét
    const legSkin = npr({ ...skin3, ink: LIMB_SIL, doubleSided: true, group: 'leg' });
    const { sleeveColor = '#1a1a1a', trouserColor = '#1a1a1a', shoeColor = '#2b2623', sleeveLength = 1, trouserLength = 1 } = o;
    const thigh = thighR / 100;
    pelvis(spine, body, at.hip, thigh, tone(skirt ? skirtColor : trouserColor));
    const legTaper = [thigh / limbR(trouserWidth), CLAD_TAPER.leg[1], CLAD_TAPER.leg[2]] as const;
    hands = {} as Record<Side, Hand>;
    for (const s of SIDES) {
      cladLimb(seg(arms[s].shoulder), seg(arms[s].elbow), [B.upperArm, B.foreArm], [CLAD_TAPER.arm[0] * (1 + bicep), CLAD_TAPER.arm[1], CLAD_TAPER.arm[2]], tone(sleeveColor), limbSkin, sleeveLength, true);
      cladLimb(seg(legs[s].hip), seg(legs[s].knee), [B.thigh, B.shin], legTaper, tone(trouserColor), legSkin, trouserLength, false);
      const { k, long } = cladHand(sleeveWidth, rig.stroke, B.foreArm * 100);
      hands[s] = handRig(s, k, long, lod === 'low');
      // vỏ lùi sau mặt `HAND_INK_PUSH` dọc tia nhìn: không lòi qua kẽ ngón khép, ngón cái vắt trước nắm tay
      const g = inked(hands[s].geo, limbSkin, 0.014, HAND_INK_PUSH * hands[s].scale);
      g.userData.hand = s;
      arms[s].wrist.add(g);
      const ankle = new Ankle(root);
      ankle.position.y = -B.shin;
      legs[s].knee.add(ankle);
      const ra = limbR(trouserWidth) * 0.8;
      ankle.add(inked(shoeGeometry(R.limb, ra), tone(shoeColor), 0.02));
      ankle.userData.shoe = shoeCapsule(R.limb, ra);
      legs[s].ankle = ankle;
    }
  }
  for (const s of SIDES) {
    for (const [a, b, w] of [[arms[s].shoulder, arms[s].elbow, sleeveWidth], [legs[s].hip, legs[s].knee, trouserWidth]] as const) {
      seg(a).userData.r = seg(b).userData.r = limbR(w);
      // mép chi đè lên thân, hông cùng màu: nét theo khe sâu cỡ bán kính ống
      seg(a).userData.inkGap = limbR(w);
      bendLimb(seg(a), b, seg(b), limbCurve);
    }
  }
  const shell = head.children.flatMap((g) => g.children.filter((m) => m.userData.hair === 'shell' || m.userData.hair === 'hat').map((m) => ((m as THREE.Mesh).geometry.attributes.position.array)));
  const fit = headFit(skullScale.clone().multiplyScalar(R.head), shell, eyes.offsetY);
  if (human) {
    // mặt trước ngang mắt trên đầu `human`: mắt thấp hơn tâm sọ thì đã vào phần nặn
    const ue = Math.max(-1, Math.min(1, fit.eye / (R.head * skullScale.y)));
    fit.front = humanSkull([0, ue, Math.sqrt(1 - ue * ue)])[2] * R.head * skullScale.z;
  }
  if (lod === 'low') {
    spine.traverse((o) => {
      const g = (o as THREE.Mesh).geometry as THREE.TubeGeometry | undefined;
      if (g?.type !== 'TubeGeometry') return;
      const p = g.parameters;
      (o as THREE.Mesh).geometry = new THREE.TubeGeometry(p.path, Math.max(4, Math.ceil(p.tubularSegments / 4)), p.radius, 4, p.closed);
    });
    for (const j of [spine, neck, head]) mergeStatic(j);
  }
  // người có nét riêng theo hình 2D: không vẽ nét gấp pháp tuyến; đồ cầm gắn sau thì vẫn có
  root.traverse(bodyMark);
  root.userData.figure = true;
  const grip = (s: Side): Vec3 => (hands ? handGrip(s, hands[s].scale, hands[s].long) : [0, -(R.limb * sleeveWidth) / 10, 0]);
  const sockets = buildSockets({ root, spine, head, arms }, fit, grip, rig);
  const fig: Figure = { root, hips, spine, neck, head, arms, legs, face: faceR, seed, sockets, gear: newGear(items, itemSpecs), lod, skirt: skirtRig, bones: B, splay: at.splay, ...(hands && { hands }), ...(body.refold && lod !== 'low' && { lap: { refold: body.refold, key: '' } }) };
  if (equip) dress(fig, equip);
  return fig;
}

/**
 * Đoạn chi `upper` → `lower` của người `clad` (dài `L1`, `L2`): ống tô màu có vỏ viền, thon theo `taper` (bán kính ở gốc,
 * khớp giữa, ngọn, nhân `userData.r`). `f` phần chi từ gốc phủ `cover`, còn lại `skin`; phủ hết thì `cuff` thêm cổ tay áo.
 */
function cladLimb(upper: THREE.Mesh, lower: THREE.Mesh, [L1, L2]: [number, number], taper: readonly [number, number, number], cover: THREE.Material, skin: THREE.Material, f: number, cuff: boolean) {
  upper.userData.taper = [taper[0], taper[1]];
  // gốc đùi to nằm trong khối hông: mút tròn đủ cỡ thì chĩa ra sau xuyên váy khi ngồi
  if (!cuff) upper.userData.root = 0.35;
  lower.userData.taper = [taper[1], taper[2]];
  const full = f >= 0.999;
  // khuỷu, gối: hai ống chồng mút lên nhau, nét bóng dáng hậu kỳ coi cả chi là một vật
  const chain = upper.id;
  for (const m of [upper, lower]) {
    m.userData.inkChain = chain;
    m.material = full ? cover : skin;
    const h = new THREE.Mesh(m.geometry, limbHull);
    h.userData.noShadow = true;
    m.add(h);
  }
  const add = (m: THREE.Mesh, u0: number, u1: number, rim: number, flat: number) => {
    const geo = tube(), c = new THREE.Mesh(geo, cover), h = new THREE.Mesh(geo, limbHull);
    c.castShadow = true;
    c.userData.inkChain = chain;
    h.userData.noShadow = true;
    m.parent!.add(c.add(h));
    (m.userData.covers ??= []).push({ geo, u0, u1, k: 1.1, rim, flat } satisfies Cover);
  };
  const d = f * (L1 + L2);
  if (full) {
    if (cuff) add(lower, 0.84, 1, 1, 0.3);
  } else if (d > 0.02) {
    if (d < L1 - 0.03) add(upper, 0, d / L1, 1.12, 0.3);
    else {
      add(upper, 0, 1, 1, 1);
      if (d > L1 + 0.03) add(lower, 0, Math.min(1, (d - L1) / L2), 1.12, 0.3);
    }
  }
}

/** Khối hông của người `clad` trong nhóm thân: nối đáy thân áo (mặt cắt, bề sâu của `body`) với hai gốc đùi bán kính `r`, có mông */
function pelvis(spine: THREE.Object3D, body: { profile: [number, number][]; depth: number[] }, hip: number, r: number, mat: THREE.Material) {
  const g = inked(pelvisGeometry(body.profile, body.depth, hip, r), mat);
  g.userData.pelvis = true;
  g.userData.inkGap = r;
  spine.add(g);
}

/** Tóc phủ lên chỗ tai `at` (hệ nhóm đầu): tia từ ngoài vào tâm tai chạm vỏ tóc hay tóc rủ */
function hairCovers(head: THREE.Object3D, at: THREE.Vector3) {
  const out = at.clone().setY(0).normalize();
  const ray = new THREE.Raycaster(at.clone().addScaledVector(out, 0.5), out.clone().negate(), 0, 0.5);
  const probe = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  let hit = false;
  head.traverse((o) => {
    if (hit || !o.userData.hair) return;
    probe.geometry = (o as THREE.Mesh).geometry;
    hit = ray.intersectObject(probe).length > 0;
  });
  return hit;
}

/** Lưới của chính người: không nét gấp, `collide` đo người bằng nang nên bỏ lưới `userData.body`; đồ gắn sau không mang cờ này */
function bodyMark(o: THREE.Object3D) {
  o.userData.noCrease = true;
  if ((o as THREE.Mesh).isMesh) o.userData.body = true;
}

const toSpine = new THREE.Matrix4(), thighAt = new THREE.Vector3(), thighDir = new THREE.Vector3();
/**
 * Dựng lại váy và gập lại vạt áo người ngồi của `p` theo đùi lúc này, đo trong hệ thân (khớp thân và khớp hông cùng con của
 * `hips`): thân nghiêng hay đùi đổi góc thì vạt váy, vạt áo vẫn ôm mặt trên đùi. Cần ma trận local đã cập nhật; đùi không đổi
 * thì không dựng lại.
 */
export function fitSkirt(p: Figure) {
  const sk = p.skirt;
  if (!sk && !p.lap) return;
  toSpine.copy(p.spine.matrix).invert();
  // three → hệ thân của váy: px, y xuống
  const flipY = (v: THREE.Vector3, k: number): Vec3 => [v.x * k, -v.y * k, v.z * k];
  const thighs = SIDES.map((s) => {
    const m = toSpine.clone().multiply(p.legs[s].hip.matrix);
    return { hip: flipY(thighAt.setFromMatrixPosition(m), 100), dir: flipY(thighDir.set(0, -1, 0).transformDirection(m), 1) };
  });
  if (p.lap) {
    // vạt áo: hướng đùi trung bình trong mặt dọc của thân, làm tròn nửa độ
    const a = Math.round((2 * Math.atan2(thighs[0].dir[2] + thighs[1].dir[2], thighs[0].dir[1] + thighs[1].dir[1])) / D) / 2;
    if (`${a}` !== p.lap.key) {
      p.lap.key = `${a}`;
      p.lap.refold([Math.cos(a * D), Math.sin(a * D)]);
    }
  }
  if (!sk) return;
  const key = thighs.map(({ hip, dir }) => [...hip.map((v) => Math.round(v * 10)), ...dir.map((v) => Math.round(v * 1000))].join(',')).join(';');
  if (key === sk.key) return;
  sk.key = key;
  const parent = sk.group.parent!;
  sk.group.removeFromParent();
  sk.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  sk.group = sculptSkirt(parent, { ...sk.opts, thighs });
  sk.group.traverse(bodyMark);
  sk.group.updateMatrixWorld(true);
}

const stillFaces = new Map<string, FaceRig>();
/** Nét mặt dùng chung cho người nền: một texture cho mọi người cùng dáng mặt, nét, mức ửng và màu da; `set` không đổi gì */
function stillFace(scale: THREE.Vector3, shape: Partial<FaceShape> = {}, state?: Partial<FaceState>, human = false, skin?: string): FaceRig {
  const s = { ...DEFAULT_FACE, ...state }, { blush, ...rest } = shape, lv = blushLevel(blush, s.blush);
  const key = JSON.stringify([rest, s.mouth, s.brow, s.eyes, lv, human, skin]);
  let f = stillFaces.get(key);
  if (!f) stillFaces.set(key, (f = faceRig(R.head, scale, { ...rest, blush: lv }, { ...s, blush: 0 }, human, skin)));
  const mesh = new THREE.Mesh(f.mesh.geometry, f.mesh.material);
  mesh.userData.noShadow = true;
  mesh.userData.noCollide = true;
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
    return m.side === THREE.BackSide && u?.uW ? `hull ${u.uW.value} ${u.uPush?.value ?? 0} ${u.uColor.value.getHex()}` : m.uuid;
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
      if (src.attributes.tint) g.setAttribute('tint', src.attributes.tint.clone());
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

/** Các trường của JSON nhân vật mà người 3D đọc. Truyền object đã qua `parseCharacter` của @stickman3d/sketch. */
export interface CharacterJson {
  rig: Rig;
  palette: {
    garment: string; skin?: string; sleeveWidth?: number; trouserWidth?: number; limbCurve?: number;
    clad?: boolean; sleeve?: string; trouser?: string; shoe?: string; sleeveLength?: number; trouserLength?: number; bicep?: number;
  };
  head?: { form?: 'sphere' | 'human' };
  face?: Partial<FaceShape>;
  pieces: {
    torso: { garment?: Partial<Garment>; accent?: string };
    hem?: { src?: string; skirt?: Partial<Skirt>; color?: string };
    hair?: { sculpt?: Partial<Sculpt>; color?: string; accent?: string };
    crown?: { src: string; hat?: Partial<Hat>; color?: string };
    headAcc?: { src: string; pin?: Partial<Pin>; color?: string; accent?: string };
    faceAcc?: { src: string; glasses?: Partial<Glasses>; color?: string };
  };
  /** Vật gọi tên: socket → cấu hình; `opts.items` cấp hàm dựng 3D theo cùng tên */
  items?: Gear['specs'];
}

/** Tham số `stickman` đọc từ JSON nhân vật của rig (cho `seatCrowd`, hay đè thêm trước khi dựng); `opts` đè lên số đọc từ JSON. */
export function characterOptions(json: CharacterJson, opts: Partial<StickmanOptions> = {}): StickmanOptions {
  const pal = json.palette, pc = json.pieces;
  return {
    rig: json.rig, garment: pc.torso.garment, color: pal.garment, accent: pc.torso.accent, skin: pal.skin,
    skirt: wornSkirt(pc.hem), skirtColor: pc.hem?.color, hair: pc.hair?.sculpt, hairColor: pc.hair?.color, hairAccent: pc.hair?.accent,
    sleeveWidth: pal.sleeveWidth, trouserWidth: pal.trouserWidth, limbCurve: pal.limbCurve, faceShape: json.face, itemSpecs: json.items,
    glasses: pc.faceAcc?.src === 'sculpt' && pc.faceAcc.glasses, glassesColor: pc.faceAcc?.color,
    ...(pc.crown?.src === 'sculpt' && { hat: pc.crown.hat ?? {}, hatColor: pc.crown.color }),
    ...(pc.headAcc?.src === 'sculpt' && { pin: pc.headAcc.pin ?? {}, pinColor: pc.headAcc.color, pinBead: pc.headAcc.accent }),
    clad: pal.clad, sleeveColor: pal.sleeve, trouserColor: pal.trouser, shoeColor: pal.shoe, sleeveLength: pal.sleeveLength, bicep: pal.bicep,
    trouserLength: pal.trouserLength, headForm: json.head?.form, ...opts,
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
