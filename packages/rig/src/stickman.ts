import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildSockets, dress, headFit, newGear, type Carrying, type EquipState, type Gear, type Holding, type ItemFactories, type Sockets } from './attach';
import { D, DEFAULT_FACE } from './core/constants';
import type { FaceState } from './core/types';
import { faceRig, type FaceRig, type FaceShape } from './face';
import { apronTie, clothMaterial, paint, sameColor, sculptHipHem, sculptSkirt, sculptTorso, skinLook, type HemLeg, type SkirtOptions } from './garment';
import { glassesMesh } from './glasses';
import { INK, toThree, type Vec3 } from './khoi';
import { hullMaterial, npr } from './npr';
import { sculptMesh } from './sculpt';
import { equipCharacter, limbWidths, wornPalette, type CharacterData, type Drape, type Earrings, type Equip, type PieceKey, type Garment, type Glasses, type Hat, type Necklace, type Pin, type Sculpt, type Shades, type Skirt } from './core/schema';
import { hatFit, hatMesh, hatSpec, insideHat, pinMesh, pressHair } from './core/hat';
import { earringMesh } from './core/jewelry';
import { BONES3, bones3, CLAD_TAPER, cladHand, cladThigh, roots3, SLEEVE_EASE, sleeveGrow, THIGH_ROOT, type ActCharacter, type AimReport, type Bones3 } from './core/act3';
import { blushLevel, chibiShape } from './core/face';
import { wornSkirt } from './core/skirtShape';
import { hangsFromHip, matchWrap } from './core/hem';
import { humanNeckWidth, NECK_BEND } from './core/torso';
import { setBluntSideburn } from './core/sculpt';
import { humanHair, humanSkull, setHeadShape, SKULL3 } from './core/humanHead';
import { Ankle, earGroup, handRig, humanHeadGeometry, NECK_COLS, neckGeometry, noseGeometry, pelvisGeometry, shoeMesh, type Hand } from './human';
import { SHOE_CLEAR, shoeCapsule, shoeFit, shoeTuck, type ShoeKind } from './core/shoe';
import { handGrip } from './core/hand';
import type { Rig } from './torso';

// Tỉ lệ lấy từ RIG của lõi, chia 100: người cao ~4,3 đơn vị, đầu to bằng gần một phần ba. Độ dài đoạn của
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
  /**
   * Ống cổ người `human` (không có ở `lod` `low`): `act` gọi `bendNeck` uốn theo hai khớp cổ; `rest` là lưới đứng thẳng hệ
   * khớp cổ, `from` chân cổ (`Bones3.neckBase`), `tops` từng đỉnh: độ cao chỗ đường dọc của nó chạm sọ lúc đứng thẳng;
   * `foot`, `tip` điểm của đường dọc ấy ở chân cổ và ở chỗ chạm sọ
   */
  neckTube?: { geo: THREE.BufferGeometry; rest: Float32Array; from: number; tops: Float32Array; foot: Float32Array; tip: Float32Array };
  /** Nhóm ống cổ người `human`: `lod` `low` không uốn lưới, `bendNeck` đặt cả nhóm theo chân cổ */
  neckCol?: THREE.Object3D;
  /** Váy dựng khối: `act` gọi `fitSkirt` dựng lại theo đùi khi đùi đổi hướng; `hip` là vạt treo ở nhóm hông */
  skirt?: { opts: Omit<SkirtOptions, 'thighs'>; group: THREE.Group; key: string; hip?: boolean };
  /** Sàn dưới người ở lần `act` gần nhất: y trong nhóm hông (px, y xuống); tạp dề nằm trên nó */
  floor?: number;
  /** Vạt áo người ngồi: `act` gọi `fitSkirt` gập lại theo đùi khi đùi đổi hướng trong hệ thân */
  lap?: { refold: (dir: [number, number]) => void; key: string };
  /** Bàn tay của người `clad` */
  hands?: Record<Side, Hand>;
  /** Món từng bàn tay đang cầm (`hold` ghi, `release` xoá) */
  holding?: Partial<Record<Side, Holding>>;
  /** Món treo trên từng cánh tay (`món@carry`: khuỷu, vai — `carry` ghi, `release` xoá); bàn tay ấy vẫn tự do */
  carrying?: Partial<Record<Side, Carrying>>;
  /** `act` đang đặt dáng: dáng dở, món treo (`carry`) chưa đặt lại theo nó */
  posing?: boolean;
  /** Độ lệch còn lại từng tay (`R` phải, `L` trái người) ở lần `act` gần nhất, khi có gì phải giải (`actAim` của lõi) */
  aim?: Record<'R' | 'L', AimReport>;
  /** Khung xương theo `rig.height` (`bones3` của lõi): `act` đặt đoạn chi bằng nó */
  bones: Bones3;
  /** Tay choãi, radian (`roots3`) */
  splay: number;
  /** Số đo nhân vật cho `resolveActing` của lõi: `act` giải đích theo mốc thân và lòng tay theo ý định trên chính người này */
  body: ActCharacter;
}

/** `low`: người nền rẻ — ít mặt lưới, gộp khối tĩnh theo vật liệu, nét mặt đứng yên dùng chung texture, không chớp mắt */
export type Lod = 'full' | 'low';
/** `limb`: vòng mỗi đầu tròn, cạnh quanh ống, đoạn dọc ống */
interface Quality { skull: [number, number]; limb: [number, number, number] }
const QUALITY: Record<Lod, Quality> = {
  full: { skull: [72, 52], limb: [4, 16, 12] },
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
 * `rim` lần, hai mút tròn dẹt theo `flat0`, `flat1` (`1` là nửa cầu); `open` thì mút cuối hở (miệng tay áo loe).
 */
function fillTube(geo: THREE.BufferGeometry, c: THREE.Vector3[], r0: number, r1 = r0, u0 = 0, u1 = 1, rim = 1, flat0 = 1, flat1 = 1, open = false) {
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
    const f = open ? Math.PI / 2 : (i / cap) * (Math.PI / 2);
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

/**
 * Ống phủ trên đoạn chi của người `clad`: phần `u0..u1`, to hơn ống chi `k` lần cộng `grow` (three, ở `u0`, `u1`), mút cuối
 * nở `rim`, dẹt `flat`; `open` thì mút cuối hở. `disk` là đĩa lót miệng tay áo loe thay cho ống, lùi vào trong miệng bấy nhiêu
 */
interface Cover { geo: THREE.BufferGeometry; u0: number; u1: number; k: number; rim: number; flat: number; grow?: [number, number]; open?: boolean; disk?: number }

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
    const [g0, g1] = v.grow ?? [0, 0];
    const ra = (a + (b - a) * v.u0) * v.k + g0, rb = (a + (b - a) * v.u1) * v.k + g1;
    if (v.disk !== undefined) {
      const u = Math.max(v.u0, v.u1 - v.disk / m.userData.len);
      fillTube(v.geo, c, rb * 0.97, rb * 0.97, u, u, 1, 0, 0);
    } else fillTube(v.geo, c, ra, rb, v.u0, v.u1, v.rim, v.u0 > 0 ? v.flat : root, v.u1 < 1 ? v.flat : 1, v.open);
  }
}
/**
 * Uốn hai đoạn chi như `limbCurves` của lõi: hai đoạn Bézier bậc ba qua gốc, khớp giữa, đầu chi; tiếp tuyến ở khớp
 * giữa song song gốc → đầu chi, `k` là `limbCurve`. Đặt vào `userData.bend` của hai đoạn; pipeline gọi trước mỗi lượt vẽ.
 */
function bendLimb(upper: THREE.Mesh, mid: THREE.Object3D, lower: THREE.Mesh, k: number, ankle?: THREE.Object3D) {
  let key = '';
  const P0 = new THREE.Vector3(), P1 = new THREE.Vector3(), P2 = new THREE.Vector3(), inv = new THREE.Matrix4();
  const bend = () => {
    // bàn chân nằm ngang theo dáng đang đặt, không theo lượt vẽ trước: chỗ ép trong giày đọc hệ cổ chân
    ankle?.updateWorldMatrix(true, false);
    P1.copy(mid.position);
    P2.set(0, -lower.userData.len, 0).applyQuaternion(mid.quaternion).add(P1);
    const now = [P1.x, P1.y, P1.z, P2.x, P2.y, P2.z, upper.userData.r, lower.userData.r, ...(ankle ? ankle.quaternion.toArray() : [])].join();
    if (now === key) return;
    key = now;
    const f = k / 6;
    const T0 = P1.clone().multiplyScalar(f), T1 = P2.clone().multiplyScalar(f), T2 = P2.clone().sub(P1).multiplyScalar(f);
    tubes(upper, [P0, T0, P1.clone().sub(T1), P1]);
    inv.compose(mid.position, mid.quaternion, ONE).invert();
    tubes(lower, [P1.clone(), P1.clone().add(T1), P2.clone().sub(T2), P2].map((p) => p.applyMatrix4(inv)));
    if (ankle) tuck(lower, ankle);
  };
  upper.userData.bend = lower.userData.bend = bend;
  bend();
}

const _tk = new THREE.Matrix4(), _ti = new THREE.Matrix4(), _tv = new THREE.Vector3();
/** Mặt sau ống chân dưới cổ giày lùi dần về chỗ ép trong khoảng này trên cổ giày (three) */
const TUCK_BLEND = 0.03;
/**
 * Ép phần ống chân và ống phủ trong giày theo hệ `ankle` (`userData.tuck`, `shoeTuck` của lõi): dưới `y0` dồn vào khoảng
 * `bottom..y0`, dưới cổ giày mặt sau không lùi quá `back` (ống phủ: thêm phần to hơn ống chân) — ống chân ngả ra sau lúc
 * bước không xuyên qua lưng gót
 */
function tuck(lower: THREE.Mesh, ankle: THREE.Object3D) {
  const T = ankle.userData.tuck as { bottom: number; y0: number; collar: number; back: number } | undefined;
  if (!T) return;
  _tk.compose(ankle.position, ankle.quaternion, ONE);
  _ti.copy(_tk).invert();
  for (const [geo, back] of [[lower.geometry, T.back], ...((lower.userData.covers ?? []) as Cover[]).map((c) => [c.geo, T.back * c.k - (c.grow?.[1] ?? 0)])] as [THREE.BufferGeometry, number][]) {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    let low = T.y0;
    for (let i = 0; i < pos.count; i++) low = Math.min(low, _tv.fromBufferAttribute(pos, i).applyMatrix4(_ti).y);
    const k = low < T.bottom ? (T.y0 - T.bottom) / (T.y0 - low) : 1;
    let moved = false;
    for (let i = 0; i < pos.count; i++) {
      _tv.fromBufferAttribute(pos, i).applyMatrix4(_ti);
      const y = _tv.y, z = _tv.z;
      if (y < T.y0) _tv.y = T.y0 + (y - T.y0) * k;
      if (z < back && y < T.collar + TUCK_BLEND) {
        const u = Math.min(1, Math.max(0, (y - T.collar) / TUCK_BLEND));
        _tv.z = z + (back - z) * (1 - u * u * (3 - 2 * u));
      }
      if (_tv.y === y && _tv.z === z) continue;
      moved = true;
      _tv.applyMatrix4(_tk);
      pos.setXYZ(i, _tv.x, _tv.y, _tv.z);
    }
    if (!moved) continue;
    pos.needsUpdate = true;
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
  }
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

/** Bề dày nét bóng dáng của sọ, ống cổ và da trong miệng cổ áo của người `human` (three): cùng khoá nét, chỗ nối không có nét */
const HEAD_INK = 0.03;
/**
 * THỬ (feat/real-head-proto): khe sâu (`inkGap`) của mã vật da đầu `human` (sọ, tai, mũi): mép đầu đè lên ống cổ, cùng vật
 * liệu, chỉ có nét khi khe sâu ở mép qua 0,6–1,6. Đứng thẳng chỗ hàm, gáy gặp cổ khe dưới 0,3 nên không nét ở mọi góc; cúi
 * (cằm che cổ, `look-down-20`) khe trên 1,6 nên nét bóng dáng cằm trên cổ vẫn có, hiện dần theo độ cúi
 */
const HEAD_NECK_GAP = 2;
/** Trục cổ `human` lùi sau trục thân ngần này (three): tâm toả pháp tuyến của da trong miệng cổ áo */
const NECK_FILL_AXIS = 0.025;

/** Nét mép tay đè lên thân cùng vật liệu đậm dần theo khoảng dọc tay từ vai, phần bắp tay (pipeline `userData.inkU`), thay cho khe sâu */
const ARM_INK_U = [0.06, 0.2] as const;

function arm(parent: THREE.Object3D, side: Side, x: number, y: number, B: Bones3): Arm {
  const shoulder = joint(parent, side * x, y, 0);
  const [u0, u1] = ARM_INK_U.map((f) => f * B.upperArm);
  const upper = limb(B.upperArm), fore = limb(B.foreArm);
  upper.userData.inkU = [0, u0, u1];
  fore.userData.inkU = [B.upperArm, u0, u1];
  shoulder.add(upper);
  const elbow = joint(shoulder, 0, -B.upperArm, 0);
  elbow.add(fore);
  const wrist = joint(elbow, 0, -B.foreArm, 0);
  return { shoulder, elbow, wrist };
}

/**
 * Mặt rủ trên đầu `human`: dời bằng chân nó ở chỗ rời sọ, cộng phần sọ đẩy ra theo phương ngang (quai hàm); sọ thu vào
 * (gáy) không kéo tóc theo. docs/01-rig.md#người-3d-mặc-đồ
 */
function hangHair(p: Vec3): Vec3 {
  const h = Math.hypot(p[0], p[2]) || 1;
  const n: Vec3 = [p[0] / h, 0, p[2] / h];
  const root = humanHair(n);
  const bent = humanHair(p);
  const out = Math.max(0, (bent[0] - p[0] - root[0] + n[0]) * n[0] + (bent[2] - p[2] - root[2] + n[2]) * n[2]);
  return [p[0] + root[0] - n[0] + out * n[0], p[1] + root[1], p[2] + root[2] - n[2] + out * n[2]];
}

/**
 * Tóc dựng khối của rig (`pieces.hair.sculpt` trong JSON nhân vật), lưới hệ sọ đơn vị phóng theo khối đầu. Đầu `human`:
 * tóc dời theo sọ (`humanHair`), mặt rủ theo `hangHair`.
 */
function sculptHair(head: THREE.Object3D, sculpt: Partial<Sculpt>, color: string, human: boolean, hat?: SculptHat, accent?: string) {
  const mesh = sculptMesh(sculpt, { cut: hat?.cut, accent: !!accent });
  if (human || hat?.press) {
    const press = hat?.press ?? ((p: Vec3) => p);
    const bend = (p: number[]) => (human ? humanHair(press(p as Vec3)) : press(p as Vec3));
    const hang = (p: number[]) => (human ? hangHair(press(p as Vec3)) : press(p as Vec3));
    for (const tris of [mesh.shell, mesh.spikes, mesh.hang]) tris.forEach((t, i) => (tris[i] = t.map(tris === mesh.hang ? hang : bend) as typeof t));
    mesh.lines.forEach((l, i) => (mesh.lines[i] = l.map(bend) as typeof l));
  }
  // vỏ ngược đánh nhau độ sâu với sọ ngay dưới và bị vỏ tóc che ở lọn nằm sát: nét bóng dáng vẽ ở hậu kỳ
  // màu phụ: một vật liệu màu theo đỉnh, nên chỗ giáp hai màu không có nét như hai vật
  const mat = npr({ color: accent ? '#ffffff' : color, stipple: 0.05, stippleScale: 5, soft: 0.6, doubleSided: true, ink: 0.022, tint: !!accent });
  const [c0, c1] = [new THREE.Color(color), new THREE.Color(accent ?? color)];
  for (const tris of [mesh.shell, mesh.spikes, mesh.hang]) {
    if (!tris.length) continue;
    const tone = accent ? tris.map((_, i) => ((tris === mesh.shell ? mesh.tone : tris === mesh.hang ? mesh.hangTone : undefined)?.[i] ? c1 : c0)) : undefined;
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

/** Vùng trong lòng mũ (tóc bỏ lọn, búi nằm trong ấy) và phép ép tóc dưới mũ (`pressHair`; trống là không ép) */
interface SculptHat { cut: (p: Vec3) => boolean; press?: (p: Vec3) => Vec3 }

/**
 * Mũ dựng khối (`pieces.crown.hat`) ôm sọ và vỏ tóc `hair`; trả vùng trong lòng mũ và phép ép tóc.
 * docs/12-trang-phuc-3d.md#mũ-dựng-khối
 */
function sculptHat(head: THREE.Object3D, hat: Partial<Hat>, hair: Partial<Sculpt> | undefined, color: string): SculptHat {
  const h = hatSpec(hat);
  const fit = hatFit(h, hair);
  const m = hatMesh(h, fit);
  // một vật liệu màu theo tam giác: chỗ giáp hai phần không có nét như hai vật, nên quai và huy hiệu nổi sát băng không bị
  // nét bóng dáng của băng phủ; khe sâu `inkGap` cho mép lưỡi trai, chóp loe vẫn có nét
  const brimColor = h.brimColor ?? (h.shape === 'peaked' ? '#101114' : color);
  // vân rơm: vòng xen kẽ tối đi `straw` về màu nét
  const woven = (c: string) => '#' + new THREE.Color(c).lerp(new THREE.Color(INK), h.straw).getHexString();
  const parts = [[m.tris, color], [m.weave, woven(color)], [m.band, h.bandColor], [m.seat, h.bandColor], [m.brim, brimColor], [m.brimWeave, woven(brimColor)], [m.strap, h.strapColor], [m.badge, h.badgeColor]] as const;
  const multi = h.shape !== 'drum' || h.straw > 0;
  const tris = parts.flatMap(([t]) => t);
  const tone = multi ? parts.flatMap(([t, c]) => t.map(() => new THREE.Color(c))) : undefined;
  const mesh = new THREE.Mesh(skullGeometry(tris, tone), npr({ color: multi ? '#ffffff' : color, stipple: 0.04, stippleScale: 4, soft: 0.7, doubleSided: true, ink: 0.03, tint: multi }));
  mesh.castShadow = true;
  mesh.userData.hair = 'hat';
  if (multi) mesh.userData.inkGap = 0.06;
  head.add(new THREE.Group().add(mesh));
  inkLines(head, m.lines, 0.01);
  return { cut: (p: Vec3) => insideHat(fit, p), ...(fit.squash < 1 && { press: (p: Vec3) => pressHair(fit, p) }) };
}

/** Trâm cài búi (`pieces.headAcc.pin`) xuyên khối buộc của tóc `hair`: que màu `color`, hạt màu `bead`. docs/12-trang-phuc-3d.md#trâm-cài-búi */
function sculptPin(head: THREE.Object3D, pin: Partial<Pin>, hair: Partial<Sculpt> | undefined, human: boolean, color: string, bead: string) {
  const m = pinMesh(pin, hair);
  const bend = (t: Vec3[]) => (human ? t.map(humanHair) : t);
  for (const [tris, c] of [[m.stick, color], [m.bead, bead]] as const) {
    const mesh = new THREE.Mesh(skullGeometry(tris.map(bend)), npr({ color: c, stipple: 0.03, stippleScale: 4, soft: 0.7, ink: 0.014 }));
    mesh.castShadow = true;
    head.add(new THREE.Group().add(mesh));
  }
}

/**
 * Bông tai (`pieces.headAcc.earrings`) ở hai dái tai: phần cố định gắn vào đầu, vòng và phần thõng là nhóm quay quanh lỗ xỏ
 * (`userData.dangle`), `hangJewelry` quay cho thõng theo trọng lực. docs/12-trang-phuc-3d.md#bông-tai
 */
function sculptEarrings(head: THREE.Object3D, earrings: Partial<Earrings>, human: boolean) {
  const metal = earrings.color ?? '#d9b44a';
  const gem = earrings.gem ?? metal;
  const mat = (c: string) => npr({ color: c, stipple: 0.03, stippleScale: 4, soft: 0.6, ink: 0.012 });
  const put = (parent: THREE.Object3D, tris: Vec3[][], c: string) => {
    if (!tris.length) return;
    const m = new THREE.Mesh(skullGeometry(tris), mat(c));
    m.castShadow = true;
    m.userData.noEdge = true;
    parent.add(m);
  };
  for (const side of SIDES) {
    const e = earringMesh(earrings, side, human);
    const fixed = new THREE.Group();
    put(fixed, e.metal, metal);
    put(fixed, e.gem, gem);
    if (fixed.children.length) head.add(fixed);
    if (!e.hang) continue;
    const g = new THREE.Group();
    g.position.set(...(e.hang.pivot.map((v, i) => v * R.head * SKULL3[i]) as Vec3));
    g.userData.dangle = true;
    put(g, e.hang.metal, metal);
    put(g, e.hang.gem, gem);
    head.add(g);
  }
}

const qHead = new THREE.Quaternion(), sHead = new THREE.Vector3(), headDown = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);
/**
 * Phần thõng của bông tai (`userData.dangle` trên nhóm đầu) quay quanh lỗ xỏ cho trục `−y` của nó chỉ thẳng xuống thế giới:
 * nghiêng đầu, cúi, ngả thì vòng và bông dài vẫn rủ. `act` gọi sau khi đặt khớp; cảnh tự đặt khớp thì gọi sau
 * `updateMatrixWorld`
 */
export function hangJewelry(p: Figure) {
  const list = p.head.children.filter((o) => o.userData.dangle);
  if (!list.length) return;
  p.head.matrixWorld.decompose(headDown, qHead, sHead);
  // hướng xuống của thế giới trong hệ đầu, qua cả cỡ đầu ba trục (`headDims`): trục −y của phần thõng chỉ đúng xuống
  headDown.copy(DOWN).applyQuaternion(qHead.invert()).divide(sHead).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(DOWN, headDown);
  for (const g of list) {
    g.quaternion.copy(q);
    g.updateMatrixWorld(true);
  }
}

const qInv = new THREE.Quaternion(), qLow = new THREE.Quaternion(), eLow = new THREE.Euler();
const vBase = new THREE.Vector3(), vNape = new THREE.Vector3(), vShift = new THREE.Vector3(), vP = new THREE.Vector3(), vCol = new THREE.Vector3(), vHead = new THREE.Vector3(), vOff = new THREE.Vector3(), vHeadAt = new THREE.Vector3();
const qMid = new THREE.Quaternion();
/**
 * Cổ gập theo đầu ở hai khớp (`NECK_BEND`): chân cổ (`Bones3.neckBase`) quay phần `lower` của góc khớp cổ, đỉnh cổ
 * (`Bones3.headPivot`) phần còn lại — dời khớp cổ cho đầu tới đúng chỗ `actJoints` tính. Ống cổ: dưới chân cổ đứng theo
 * thân; mỗi đường dọc từ chân cổ tới chỗ nó chạm sọ (`neckTube.tops`) là dây thẳng nối điểm chân (theo cột cổ) với điểm
 * chạm (theo đầu), cộng độ lồi lúc đứng thẳng quay dần theo; trên đó theo trọn đầu: ngửa thì họng là một đường thẳng từ cổ
 * áo lên cằm. `act` gọi sau khi đặt khớp cổ; cảnh tự đặt khớp thì gọi sau
 * khi đặt `neck.rotation`
 */
export function bendNeck(p: Figure) {
  const B = p.bones, a = NECK_BEND.lower, q = p.neck.quaternion, e = p.neck.rotation;
  qLow.setFromEuler(eLow.set(e.x * a, e.y * a, e.z * a, e.order));
  // hệ thân gốc ở khớp cổ: đầu = chân cổ + qLow·(đỉnh cổ − chân cổ) + q·(tâm sọ − đỉnh cổ)
  vBase.set(0, B.neckBase, 0);
  vNape.set(0, B.headPivot[0], B.headPivot[1]);
  vShift.copy(vNape).sub(vBase).applyQuaternion(qLow).add(vBase).sub(vP.copy(vNape).applyQuaternion(q));
  p.neck.position.set(0, B.torso, 0).add(vShift);
  qInv.copy(q).invert();
  const t = p.neckTube;
  if (!t) {
    // ống cứng theo cột cổ: hệ khớp cổ = q⁻¹·(chân cổ + qLow·(v − chân cổ) − dời)
    if (p.neckCol) {
      p.neckCol.quaternion.copy(qInv).multiply(qLow);
      p.neckCol.position.copy(vBase).sub(vP.copy(vBase).applyQuaternion(qLow)).sub(vShift).applyQuaternion(qInv);
    }
    return;
  }
  const pos = t.geo.attributes.position as THREE.BufferAttribute, rest = t.rest;
  // đầu: v ↦ chân cổ + qLow·(đỉnh cổ − chân cổ) + q·(v − đỉnh cổ); cột cổ: v ↦ chân cổ + qLow·(v − chân cổ)
  vHeadAt.copy(vNape).sub(vBase).applyQuaternion(qLow).add(vBase);
  for (let i = 0; i < pos.count; i++) {
    vP.fromArray(rest, 3 * i);
    const y = vP.y, top = t.tops[i];
    if (y >= top) vP.sub(vNape).applyQuaternion(q).add(vHeadAt);
    else if (y > t.from) {
      const w = (y - t.from) / (top - t.from);
      vCol.fromArray(t.foot, 3 * i);
      vHead.fromArray(t.tip, 3 * i);
      // độ lồi so với dây lúc đứng thẳng, quay dần từ cột cổ sang đầu
      vOff.copy(vCol).lerp(vHead, w).negate().add(vP).applyQuaternion(qMid.slerpQuaternions(qLow, q, w));
      vCol.sub(vBase).applyQuaternion(qLow).add(vBase);
      vHead.sub(vNape).applyQuaternion(q).add(vHeadAt);
      vP.copy(vCol).lerp(vHead, w).add(vOff);
    }
    vP.sub(vShift).applyQuaternion(qInv);
    pos.setXYZ(i, vP.x, vP.y, vP.z);
  }
  pos.needsUpdate = true;
  t.geo.computeVertexNormals();
}

/** Đường dọc của ống cổ ngập vào sọ ngần này (three) qua chỗ chạm: đầu ngửa không hở khe giữa cổ và mặt dưới sọ */
const NECK_SINK = 0.025;
/**
 * Từng đỉnh của ống cổ: độ cao (hệ khớp cổ) chỗ đường dọc của nó chạm mặt dưới sọ lúc đứng thẳng (không chạm thì đỉnh
 * ống), điểm của đường dọc ấy ở chân cổ `from` và ở chỗ chạm
 */
function neckTops(geo: THREE.BufferGeometry, skull: THREE.BufferGeometry, head: THREE.Object3D, from: number) {
  const P = geo.attributes.position, n = P.count;
  const tops = new Float32Array(n), foot = new Float32Array(3 * n), tip = new Float32Array(3 * n);
  const mesh = new THREE.Mesh(skull, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.position.copy(head.position);
  mesh.scale.copy(head.scale);
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), up = new THREE.Vector3(0, 1, 0), o = new THREE.Vector3();
  const cols = Array.from({ length: NECK_COLS }, (_, i) => Array.from({ length: n / NECK_COLS }, (_, j) => j * NECK_COLS + i));
  const along = (c: number[], y: number, out: Float32Array, k: number) => {
    let a = c[0];
    for (const i of c) if (P.getY(i) <= y) a = i;
    const b = c.find((i) => P.getY(i) > y) ?? a;
    const u = b === a ? 0 : (y - P.getY(a)) / (P.getY(b) - P.getY(a));
    out[3 * k] = P.getX(a) + (P.getX(b) - P.getX(a)) * u;
    out[3 * k + 1] = y;
    out[3 * k + 2] = P.getZ(a) + (P.getZ(b) - P.getZ(a)) * u;
  };
  const f = new Float32Array(3), e = new Float32Array(3);
  for (const c of cols) {
    along(c, from, f, 0);
    ray.set(o.set(f[0], from, f[2]), up);
    const hit = ray.intersectObject(mesh, false)[0];
    const top = Math.max(from + 0.03, Math.min(hit ? hit.point.y + NECK_SINK : Infinity, P.getY(c[c.length - 1])));
    along(c, top, e, 0);
    for (const i of c) {
      tops[i] = top;
      foot.set(f, 3 * i);
      tip.set(e, 3 * i);
    }
  }
  return { tops, foot, tip };
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
  /** `pieces.headAcc.earrings`: bông tai hai bên, màu ở chính `earrings` */
  earrings?: Partial<Earrings>;
  /** `pieces.neck.drape`: khăn vắt vai, màu `drapeColor` (bỏ trống là màu áo); `pieces.neck.shades`: kính gài nẹp */
  drape?: Partial<Drape>;
  drapeColor?: string;
  shades?: Partial<Shades>;
  /** `pieces.neck.necklace`: dây chuyền, màu ở chính `necklace` */
  necklace?: Partial<Necklace>;
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
  /** `palette.sleeve`, `palette.trouser`, `palette.shoe`, `palette.sole` */
  sleeveColor?: string;
  trouserColor?: string;
  shoeColor?: string;
  soleColor?: string;
  /** `palette.shoeStyle`: kiểu giày dép, khoá của `SHOE_STYLES`. docs/12-trang-phuc-3d.md#giày-dép */
  shoeStyle?: ShoeKind;
  /** `palette.bicep`: gốc cánh tay to thêm bấy nhiêu phần */
  bicep?: number;
  /** `palette.sleeveLength`, `palette.trouserLength`: phần chi phủ màu áo, quần từ gốc chi */
  sleeveLength?: number;
  /** `palette.sleeveFlare`: tay áo loe, miệng tay rộng hơn cổ tay bấy nhiêu px */
  sleeveFlare?: number;
  trouserLength?: number;
  /** `head.form` */
  headForm?: 'sphere' | 'human';
  /** THỬ: `head.jaw` */
  headJaw?: 'v' | 'square';
  /** THỬ: `head.face` (mặc định `asian`) */
  headFace?: 'asian' | 'western';
  /** THỬ: `head.nose` */
  headNose?: { length?: number; out?: number };
  /** `head.heads`: đầu `human` theo số đầu */
  headHeads?: number;
  /** `head.aspect`: bề ngang đầu `human` chia chiều cao đầu */
  headAspect?: number;
}

/** `head` của JSON nhân vật dựng lại từ tham số của `stickman`: cỡ đầu (`bones3`) */
const headSpec = (o: StickmanOptions) => ({ form: o.headForm ?? 'sphere', jaw: o.headJaw ?? 'v', face: o.headFace ?? 'asian', heads: o.headHeads, aspect: o.headAspect });

/** Phần JSON nhân vật mà `resolveActing` đọc, dựng lại từ tham số của `stickman` */
function actCharacter(o: StickmanOptions): ActCharacter {
  return {
    rig: o.rig,
    head: headSpec(o),
    face: o.faceShape,
    palette: { clad: !!o.clad, sleeveWidth: o.sleeveWidth, trouserWidth: o.trouserWidth, bicep: o.bicep ?? 0, sleeveFlare: o.sleeveFlare ?? 0, sleeveLength: o.sleeveLength ?? 1 },
    pieces: { torso: { garment: o.garment }, ...(o.skirt && { hem: { src: 'sculpt', skirt: o.skirt } }) },
  } as unknown as ActCharacter;
}

/** Một người que 3D theo JSON nhân vật của rig. */
export function stickman(o: StickmanOptions): Figure {
  // dáng đầu (kiểu mặt, hình hàm) đặt suốt lúc dựng: sọ, nét mặt, tai, tóc bám sọ, mũi, bông tai cùng đọc
  const prevShape = setHeadShape({ face: o.headFace, jaw: o.headJaw });
  const prevSideburn = setBluntSideburn(o.headForm === 'human');
  try {
    return stickmanBuild(o);
  } finally {
    setHeadShape(prevShape);
    setBluntSideburn(prevSideburn);
  }
}

function stickmanBuild(o: StickmanOptions): Figure {
  const { rig, skin = '#f0d9b8', garment, color, accent, skirt, skirtColor = color, hair, hairColor = '#2a1c15', glasses = false, glassesColor, faceShape, face, seed = 0, seated = false, limbCurve = 1, lod = 'full', items, itemSpecs, equip } = o;
  const clad = !!o.clad, human = o.headForm === 'human';
  const { sleeve: sleeveWidth, trouser: trouserWidth } = limbWidths(o);
  // người `clad`: nửa bề dày chi như `limbHalf` của lõi (gồm viền), nên người ngồi nằm đúng trên mặt ghế
  const limbR = (w: number) => (clad ? (w + rig.stroke) / 200 : (R.limb * w) / 10);
  q = QUALITY[lod];
  const B = bones3(rig.height, headSpec(o));
  const root = new THREE.Group();
  const hips = joint(root, 0, B.thigh + B.shin + B.limb, 0);
  const spine = joint(hips, 0, 0.0, 0);
  const bicep = o.bicep ?? 0;
  const thighR = clad ? cladThigh(trouserWidth, rig.stroke) : 0;
  const at = roots3(garment, rig, { clad, sleeve: sleeveWidth, trouser: trouserWidth, bicep, skirt, flare: o.sleeveFlare, sleeveLength: o.sleeveLength });
  const [sx, sy] = at.shoulder;
  // người ngồi: vạt áo dưới hông nằm trên đùi, không buông xuyên đùi xuống ghế; mặc váy thì thân áo dừng ở cạp
  // mặt ghế dưới hông `legHalf` của `body3`; vạt nằm trên chỗ cao nhất của mặt đùi gồm cả vỏ viền: gối gập vuông thì đùi
  // cong vồng lên theo `bendLimb` (điểm điều khiển thứ hai nhô `limbCurve / 6` ống chân) trong khi ống thon dần về gối
  const seatAt = (clad ? thighR : trouserWidth / 2) - 0.5;
  const [r0, r1] = clad ? [thighR + 1.8, CLAD_TAPER.leg[1] * limbR(trouserWidth) * 100 + 1.8] : [limbR(trouserWidth) * 100 + 2.6, limbR(trouserWidth) * 100 + 2.6];
  const thighTop = Math.max(...Array.from({ length: 11 }, (_, i) => i / 10).map((t) => 3 * t * t * (1 - t) * (B.shin * 100 * limbCurve) / 6 + r0 + (r1 - r0) * t));
  // gập sẵn hơi chếch lên cho người nền `lod: 'low'` (gộp lưới, không gập lại): thân ngả trước vài độ thì vạt vẫn trên đùi
  // tạp dề mặc ngoài quần: thân áo, vạt áo người ngồi và khối hông như không có váy
  const dressed = skirt?.style === 'apron' ? undefined : skirt;
  // tay áo khác màu thân áo: thân và tay áo chung vật liệu vải, tô màu từng đỉnh — vai liền như cùng màu. Thân trần giữ
  // vật liệu riêng
  const sleeveColor = o.sleeveColor ?? '#1a1a1a';
  const cloth = clad && (o.sleeveLength ?? 1) > 0 && !sameColor(sleeveColor, color) && !sameColor(color, skin) ? clothMaterial(LIMB_SIL) : undefined;
  const lap = seated ? (dressed ? { seat: -dressed.rise * rig.height } : { seat: seatAt, fold: { top: -(thighTop + 1), dir: [-0.1, 1] as [number, number] } }) : undefined;
  const body = sculptTorso(spine, { garment, rig, color, accent, skin, ink: INK, arm: at.room, lap, ...((o.drape || o.shades || o.necklace) && { neck: { drape: o.drape, shades: o.shades, necklace: o.necklace, color: o.drapeColor ?? color } }), ...(clad && { sil: LIMB_SIL }), ...(dressed && { tuck: -dressed.rise * rig.height }), cloth, human: human ? humanNeckWidth(B.headWidth) : undefined });
  // khối thân áo là mảnh đầu tiên: `collide` lấy hộp thân từ nó
  spine.children[0].userData.torso = true;
  spine.children[0].userData.inkGap = Math.max(...body.depth) / 100;
  let skirtRig: Figure['skirt'];
  if (skirt) {
    const dir: Vec3 = seated ? [0, 0.08, 1] : [0, 1, 0];
    const thighs = SIDES.map((s) => ({ hip: [s * rig.hipHalf, 0, 0] as Vec3, dir }));
    const leg = (k: number) => (thighR * CLAD_TAPER.leg[k]) / CLAD_TAPER.leg[0];
    const seat = clad ? pelvisGeometry(body.profile, body.depth, at.hip, thighR / 100).attributes.position.array : undefined;
    const legR = clad ? ([thighR, leg(1), leg(2)] as const) : ([0, 0, 0].map(() => limbR(trouserWidth) * 100) as [number, number, number]);
    const opts = { skirt: matchWrap(skirt, garment), rig, color: skirtColor, ink: INK, legW: clad ? 2 * thighR : trouserWidth, legR, curve: limbCurve, body, ...(clad && { knee: leg(1), seat }) };
    if (hangsFromHip(skirt)) {
      const [lt, ls] = [B.thigh * 100, B.shin * 100];
      const legs = SIDES.map((s): HemLeg => {
        const hip: Vec3 = [s * rig.hipHalf, 0, 0], knee: Vec3 = seated ? [s * rig.hipHalf, 0, lt] : [s * rig.hipHalf, lt, 0];
        return { hip, knee, foot: [knee[0], knee[1] + ls, knee[2]] };
      });
      skirtRig = { opts, group: sculptHipHem(hips, opts, { spine: new THREE.Matrix4(), legs }), key: '', hip: true };
      if (skirt.style === 'apron') apronTie(spine, opts);
    } else skirtRig = { opts, group: sculptSkirt(spine, { ...opts, thighs }), key: '' };
  }
  const neck = joint(spine, 0, B.torso, 0);
  let neckTube: Figure['neckTube'];
  let neckCol: THREE.Object3D | undefined;
  const skullScale = new THREE.Vector3(...SKULL3);
  // đáy sọ trên mép cổ áo (khớp cổ của lõi + `rise` 6 của áo phông); mọi thứ trên đầu dựng ở cỡ gốc `R.head` rồi phóng theo
  // cỡ đầu của người (`headDims`): sọ, nét mặt, tóc, mũ, kính, tai, mũi, bông tai, socket đầu cùng co
  const head = joint(neck, 0, B.headUp, 0);
  head.scale.set(...B.headK);
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
  const skin3 = skinLook(skin);
  const skinMat = npr(skin3);
  // vỏ ngược dưới cằm `human` chìm sau cổ và cổ áo: nét bóng dáng vẽ thêm ở hậu kỳ
  const skullMat = human ? npr({ ...skin3, ink: HEAD_INK }) : skinMat;
  const skullG = inked(skull, skullMat, 0.03);
  head.add(skullG);
  // THỬ (feat/real-head-proto): khối da của đầu `human` (sọ, tai, mũi) chung một mã vật cho nét bóng dáng: không nét ở chỗ tai,
  // mũi liền vào đầu (kể cả sọ che tai, mũi khi nhìn 3/4 sau); nét ngoài (da trên nền, tóc, áo) giữ. Ống cổ giữ mã riêng, mép
  // đầu đè lên cổ theo khe sâu `HEAD_NECK_GAP`. Mọi khối của mã cùng một khe để bảng nét không đổi theo thứ tự duyệt
  const skinChain = skullG.children[0].id;
  const headSkin = (o: THREE.Object3D) => Object.assign(o.userData, { inkChain: skinChain, inkGap: HEAD_NECK_GAP });
  if (human) headSkin(skullG.children[0]);
  const faceR = lod === 'low' ? stillFace(skullScale, faceShape, face, human, skin, hairColor) : faceRig(R.head, skullScale, faceShape, { ...DEFAULT_FACE, ...face }, human, skin, hairColor);
  head.add(faceR.mesh);
  if (glasses) {
    const asin = (v: number) => (Math.asin(Math.max(-1, Math.min(1, v / 65))) * 180) / Math.PI;
    const g = glassesMesh(glasses === true ? {} : glasses, { eye: [asin(eyes.eyeGap / 2), -asin(eyes.offsetY)], color: glassesColor ?? color, line: INK, stroke: rig.stroke });
    g.scale.copy(skullScale).multiplyScalar(R.head);
    head.add(g);
  }
  const hat = o.hat ? sculptHat(head, o.hat, hair, o.hatColor ?? color) : undefined;
  if (hair) sculptHair(head, hair, hairColor, human, hat, o.hairAccent);
  if (o.pin) sculptPin(head, o.pin, hair, human, o.pinColor ?? '#3a2a22', o.pinBead ?? o.pinColor ?? '#3a2a22');
  if (o.earrings) sculptEarrings(head, o.earrings, human);
  if (human) {
    for (const s of SIDES) {
      const ear = earGroup(s, R.head, skullScale, skullMat, INK);
      headSkin(ear.children[0]);
      if (!hairCovers(head, ear.position)) head.add(ear);
    }
    // THỬ (feat/real-head-proto): mũi khối riêng, cùng vật liệu và mã vật với sọ: không nét chỗ liền vào mặt; không đổ bóng lên mặt
    const nose = new THREE.Mesh(noseGeometry(R.head, skullScale, eyes, o.headNose, lod === 'low'), skullMat);
    nose.userData.noShadow = true;
    headSkin(nose);
    head.add(nose);
    const bend = lod !== 'low';
    const geo = neckGeometry(B.headUp - B.skull[1] * 0.5, humanNeckWidth(B.headWidth), bend ? NECK_BEND.rows : 1);
    // nét cổ là nét bóng dáng hậu kỳ, không vỏ ngược: vỏ ngược thò qua khe cằm và cổ áo thành vạch đổi theo dáng đầu từng khung.
    // Chung vật liệu với sọ và da trong miệng cổ áo, khe nét xa như tai: không nét ở chỗ cắm vào đầu, vào miệng cổ áo
    const tube = new THREE.Group();
    const neckMesh = new THREE.Mesh(geo, skullMat);
    neckMesh.castShadow = true;
    neckMesh.userData.inkGap = 1;
    // da trong miệng cổ áo chung mã vật với ống cổ: không nét giữa hai bên, thân áo bỏ qua nét của cả hai bằng một mã
    neckMesh.userData.inkChain = neckMesh.id;
    const fillMat = npr({ ...skin3, doubleSided: true, ink: HEAD_INK });
    for (const c of spine.children) {
      if (!c.userData.neckFill) continue;
      (c as THREE.Mesh).material = fillMat;
      c.userData.inkChain = neckMesh.id;
      // THỬ (feat/real-head-proto): da trong miệng cổ (mặt vát quanh chân cổ) mang pháp tuyến nằm ngang toả từ trục cổ như mặt
      // cổ: không sáng hơn cổ thành gờ ngang ở chân cổ
      const g = (c as THREE.Mesh).geometry, P = g.attributes.position, N = g.attributes.normal, v = new THREE.Vector3();
      for (let i = 0; i < P.count; i++) {
        v.set(P.getX(i), 0, P.getZ(i) + NECK_FILL_AXIS);
        if (v.lengthSq() < 1e-8) continue;
        v.normalize();
        N.setXYZ(i, v.x, v.y, v.z);
      }
      N.needsUpdate = true;
    }
    tube.add(neckMesh);
    tube.userData.neckCol = true;
    neckCol = tube;
    // chân ống lùi sau mép cổ áo một khe đổi theo dáng đầu: nét bóng dáng của thân áo, mảng da ngực loang lên đó thành vạch
    tube.children[0].userData.inkSkip = body.skin ? [spine.children[0], body.skin] : spine.children[0];
    neck.add(tube);
    if (bend) {
      tube.userData.neckTube = true;
      neckTube = { geo, rest: Float32Array.from(geo.attributes.position.array), from: B.neckBase, ...neckTops(geo, skull, head, B.neckBase) };
    }
  }
  const legs = { [-1]: leg(hips, -1, at.hip, B), [1]: leg(hips, 1, at.hip, B) } as Record<Side, Leg>;
  const arms = { [-1]: arm(spine, -1, sx, sy, B), [1]: arm(spine, 1, sx, sy, B) } as Record<Side, Arm>;
  // tay chân rủ hơi choãi
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
    const { trouserColor = '#1a1a1a', shoeColor = '#2b2623', shoeStyle = 'plain', sleeveLength = 1, trouserLength = 1, sleeveFlare = 0 } = o;
    const soleColor = o.soleColor ?? shoeFit(shoeStyle, 0).S.soleColor ?? new THREE.Color(shoeColor).multiplyScalar(0.55).getStyle();
    // tay áo loe: ống phủ hở miệng nhìn được lòng trong, đĩa lót tối hơn lùi trong miệng
    const flare = sleeveFlare > 0 && { cover: cloth ? clothMaterial(LIMB_SIL, true) : npr({ color: sleeveColor, stipple: 0.05, stippleScale: 3, soft: 1, ink: LIMB_SIL, doubleSided: true }), lining: npr({ color: new THREE.Color(sleeveColor).multiplyScalar(0.45).getStyle(), stipple: 0, soft: 1, ink: LIMB_SIL }), grow: sleeveFlare / 100, gap: limbR(sleeveWidth) };
    const thigh = thighR / 100;
    pelvis(spine, body, at.hip, thigh, tone(dressed ? skirtColor : trouserColor));
    const legTaper = [thigh / limbR(trouserWidth), CLAD_TAPER.leg[1], CLAD_TAPER.leg[2]] as const;
    hands = {} as Record<Side, Hand>;
    for (const s of SIDES) {
      cladLimb(seg(arms[s].shoulder), seg(arms[s].elbow), [B.upperArm, B.foreArm], [CLAD_TAPER.arm[0] * (1 + bicep), CLAD_TAPER.arm[1], CLAD_TAPER.arm[2]], cloth ?? tone(sleeveColor), limbSkin, sleeveLength, true, flare || undefined, cloth && sleeveColor);
      cladLimb(seg(legs[s].hip), seg(legs[s].knee), [B.thigh, B.shin], legTaper, tone(trouserColor), legSkin, trouserLength, false);
      const { k, long } = cladHand(sleeveWidth, rig.stroke, B.foreArm * 100);
      hands[s] = handRig(s, k, long, lod === 'low');
      // vỏ lùi sau mặt `HAND_INK_PUSH` dọc tia nhìn: không lòi qua kẽ ngón khép, ngón cái vắt trước nắm tay
      const g = inked(hands[s].geo, limbSkin, 0.014, HAND_INK_PUSH * hands[s].scale);
      g.userData.hand = s;
      // cuối cẳng tay là da: bàn tay chung mã nét với ống tay, cổ tay không có nét
      if (sleeveLength < 0.999 || flare) g.children[0].userData.inkChain = seg(arms[s].shoulder).id;
      arms[s].wrist.add(g);
      const ankle = new Ankle(root);
      ankle.position.y = -B.shin;
      legs[s].knee.add(ankle);
      const foot = trouserLength >= 0.999 ? tone(trouserColor) : legSkin;
      footwear(ankle, seg(legs[s].knee), s, shoeStyle, limbR(trouserWidth) * 100, { shoe: tone(shoeColor), sole: tone(soleColor), foot }, seg(legs[s].hip).id, B.shin, lod === 'low');
      legs[s].ankle = ankle;
    }
  }
  for (const s of SIDES) {
    for (const [a, b, w, ankle] of [[arms[s].shoulder, arms[s].elbow, sleeveWidth], [legs[s].hip, legs[s].knee, trouserWidth, legs[s].ankle]] as const) {
      seg(a).userData.r = seg(b).userData.r = limbR(w);
      // mép chi đè lên thân, hông cùng màu: nét theo khe sâu cỡ bán kính ống
      seg(a).userData.inkGap = limbR(w);
      bendLimb(seg(a), b, seg(b), limbCurve, ankle);
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
  // người có nét riêng: không vẽ nét gấp pháp tuyến; đồ cầm gắn sau thì vẫn có
  root.traverse(bodyMark);
  root.userData.figure = true;
  const grip = (s: Side): Vec3 => (hands ? handGrip(s, hands[s].scale, hands[s].long) : [0, -(R.limb * sleeveWidth) / 10, 0]);
  const sockets = buildSockets({ root, spine, head, arms }, fit, grip, rig);
  const fig: Figure = { root, hips, spine, neck, head, arms, legs, face: faceR, seed, sockets, gear: newGear(items, itemSpecs), lod, skirt: skirtRig, bones: B, splay: at.splay, body: actCharacter(o), ...(hands && { hands }), ...(neckTube && { neckTube }), ...(neckCol && { neckCol }), ...(body.refold && lod !== 'low' && { lap: { refold: body.refold, key: '' } }) };
  if (equip) dress(fig, equip);
  return fig;
}

/**
 * Đoạn chi `upper` → `lower` của người `clad` (dài `L1`, `L2`): ống tô màu có vỏ viền, thon theo `taper` (bán kính ở gốc,
 * khớp giữa, ngọn, nhân `userData.r`). `f` phần chi từ gốc phủ `cover`, còn lại `skin`; phủ hết thì `cuff` thêm cổ tay áo.
 * `tint`: `cover` là vật liệu vải chung (`clothMaterial`), lưới phủ tô màu ấy.
 * `flare`: tay áo loe — ống phủ `flare.cover` rộng dần thêm tới `flare.grow` ở miệng, khe nét `flare.gap`, miệng hở có đĩa lót
 * `flare.lining`, tay trong là da.
 */
function cladLimb(upper: THREE.Mesh, lower: THREE.Mesh, [L1, L2]: [number, number], taper: readonly [number, number, number], cover: THREE.Material, skin: THREE.Material, f: number, cuff: boolean, flare?: { cover: THREE.Material; lining: THREE.Material; grow: number; gap: number }, tint?: string) {
  upper.userData.taper = [taper[0], taper[1]];
  // gốc đùi to nằm trong khối hông: mút tròn đủ cỡ thì chĩa ra sau xuyên váy khi ngồi
  if (!cuff) upper.userData.root = THIGH_ROOT;
  lower.userData.taper = [taper[1], taper[2]];
  const full = f >= 0.999 && !flare;
  // khuỷu, gối: hai ống chồng mút lên nhau, nét bóng dáng hậu kỳ coi cả chi là một vật
  const chain = upper.id;
  for (const m of [upper, lower]) {
    m.userData.inkChain = chain;
    m.material = full ? cover : skin;
    if (full && tint) paint(m.geometry, tint);
    const h = new THREE.Mesh(m.geometry, limbHull);
    h.userData.noShadow = true;
    m.add(h);
  }
  const add = (m: THREE.Mesh, u0: number, u1: number, rim: number, flat: number, more: Partial<Cover> = {}, mat = cover, hull = true) => {
    const geo = tube(), c = new THREE.Mesh(geo, mat);
    if ((mat === cover || mat === flare?.cover) && tint) paint(geo, tint);
    // tay áo loe chung khe nét với thân áo: mép tay áo trên thân có nét theo khe sâu cỡ bán kính ống như ống tay
    if (mat === flare?.cover) c.userData.inkGap = flare.gap;
    if (m.userData.inkU) c.userData.inkU = m.userData.inkU;
    c.castShadow = true;
    c.userData.inkChain = more.disk === undefined ? chain : -chain;
    if (hull) {
      const h = new THREE.Mesh(geo, limbHull);
      h.userData.noShadow = true;
      c.add(h);
    }
    m.parent!.add(c);
    (m.userData.covers ??= []).push({ geo, u0, u1, k: 1.1, rim, flat, ...more } satisfies Cover);
  };
  const d = f * (L1 + L2);
  if (flare) {
    // bán kính cộng thêm ở khoảng `s` dọc tay từ vai, cùng công thức `roots3` đặt tay
    const g = (s: number) => sleeveGrow(flare.grow, f, [L1, L2], s);
    const k = SLEEVE_EASE;
    const end = d < L1 ? upper : lower;
    const uEnd = d < L1 ? d / L1 : Math.min(1, (d - L1) / L2);
    add(upper, 0, Math.min(1, d / L1), 1, 1, { k, grow: [0, g(Math.min(d, L1))], open: d < L1 }, flare.cover);
    if (d >= L1) add(lower, 0, uEnd, 1, 1, { k, grow: [g(L1), g(d)], open: true }, flare.cover);
    add(end, 0, uEnd, 1, 0, { k, grow: [0, g(d)], disk: 0.02 }, flare.lining, false);
  } else if (full) {
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

/**
 * Giày kiểu `kind` của người `clad` trên cổ chân `ankle` (`shoeMesh`), nửa bề dày chân `legHalf` px: vỏ giày, đế, gót màu
 * đế, bàn chân và ngón của giày miệng thấp, dép hở màu `foot` chung mã nét với chân (`chain`). Cổ ủng, quai cổ chân là ống
 * phủ trên ống chân `lower` (dài `shin`, three) nên bám cẳng chân khi chi cong. docs/12-trang-phuc-3d.md#giày-dép
 */
function footwear(ankle: THREE.Object3D, lower: THREE.Mesh, side: Side, kind: ShoeKind, legHalf: number, mat: { shoe: THREE.Material; sole: THREE.Material; foot: THREE.Material }, chain: number, shin: number, low: boolean) {
  const P = shoeMesh(kind, legHalf, side, low), { S } = shoeFit(kind, legHalf);
  let shoeChain = 0;
  if (P.upper) {
    const g = inked(P.upper, mat.shoe, 0.02);
    shoeChain = g.children[0].id;
    g.children[0].userData.inkChain = shoeChain;
    ankle.add(g);
  }
  ankle.add(inked(P.sole, mat.sole, 0.02));
  if (P.heel) ankle.add(inked(P.heel, mat.sole, 0.02));
  for (const [geo, w] of [...(P.foot ? [[P.foot, 0.018]] : []), ...P.toes.map((t) => [t, 0.008])] as [THREE.BufferGeometry, number][]) {
    const g = inked(geo, mat.foot, w);
    g.children[0].userData.inkChain = chain;
    ankle.add(g);
  }
  for (const st of P.straps) ankle.add(inked(st, mat.shoe, 0.014));
  ankle.userData.shoe = shoeCapsule(kind, legHalf).map((v) => v / 100);
  const T = shoeTuck(kind, legHalf);
  ankle.userData.tuck = { bottom: T.bottom / 100, y0: T.y0 / 100, collar: T.collar / 100, back: T.back / 100 };
  if (S.shaft) {
    shinCover(lower, mat.shoe, 1 - S.shaft.length, 1, (SHOE_CLEAR + S.shaft.ease) / 100, shoeChain);
    ankle.userData.shaft = [1 - S.shaft.length, (shoeFit(kind, legHalf).shaft) / 100];
  }
  if (S.open?.ankle) {
    const y = shoeFit(kind, legHalf).ra * S.collar / 100;
    shinCover(lower, mat.shoe, 1 - (y + 0.035) / shin, 1 - (y + 0.012) / shin, 0.009);
  }
}

/** Ống phủ màu `mat` trên ống chân `lower` phần `u0..u1` (từ gối), rộng hơn ống chân `grow` (three), mút trên gần phẳng */
function shinCover(lower: THREE.Mesh, mat: THREE.Material, u0: number, u1: number, grow: number, chain = 0) {
  const geo = tube(), c = new THREE.Mesh(geo, mat);
  c.castShadow = true;
  if (chain) c.userData.inkChain = chain;
  const h = new THREE.Mesh(geo, limbHull);
  h.userData.noShadow = true;
  c.add(h);
  lower.parent!.add(c);
  (lower.userData.covers ??= []).push({ geo, u0, u1, k: 1, rim: 1, flat: 0.35, grow: [grow, grow] } satisfies Cover);
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
  if (sk.hip) return fitHipHem(p, sk);
  const legs = legsIn(p, toSpine);
  const key = [...thighs.map(({ hip, dir }) => [...hip.map((v) => Math.round(v * 10)), ...dir.map((v) => Math.round(v * 1000))].join(',')), ...legs.flatMap((l) => [...l.knee, ...l.foot].map((v) => Math.round(v * 2)))].join(';');
  if (key === sk.key) return;
  sk.key = key;
  const parent = sk.group.parent!;
  sk.group.removeFromParent();
  sk.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  sk.group = sculptSkirt(parent, { ...sk.opts, thighs, legs });
  sk.group.traverse(bodyMark);
  sk.group.updateMatrixWorld(true);
}

const kneeAt = new THREE.Matrix4(), footAt = new THREE.Vector3(), legAt = new THREE.Vector3();
/** Hai chân của `p` (px, y xuống) trong hệ có ma trận `frame` so với nhóm hông: hông, gối, cổ chân */
function legsIn(p: Figure, frame = new THREE.Matrix4()) {
  const px = (v: THREE.Vector3): Vec3 => [v.x * 100, -v.y * 100, v.z * 100];
  return SIDES.map((s): HemLeg => {
    const { hip, knee, ankle } = p.legs[s];
    kneeAt.multiplyMatrices(hip.matrix, knee.matrix);
    footAt.copy(ankle?.position ?? new THREE.Vector3(0, -p.bones.shin, 0)).applyMatrix4(kneeAt).applyMatrix4(frame);
    return { hip: px(legAt.setFromMatrixPosition(hip.matrix).applyMatrix4(frame)), knee: px(legAt.setFromMatrixPosition(kneeAt).applyMatrix4(frame)), foot: px(footAt) };
  });
}

/** Vạt treo hông: dựng lại theo nhóm thân và hai chân trong hệ hông */
function fitHipHem(p: Figure, sk: NonNullable<Figure['skirt']>) {
  const legs = legsIn(p);
  const floor = sk.opts.skirt.style === 'apron' ? p.floor : undefined;
  const key = [...p.spine.matrix.elements.slice(0, 11).map((v) => Math.round(v * 1000)), ...legs.flatMap((l) => [...l.knee, ...l.foot].map((v) => Math.round(v * 2))), floor === undefined ? '' : Math.round(floor * 2)].join(',');
  if (key === sk.key) return;
  sk.key = key;
  const parent = sk.group.parent!;
  sk.group.removeFromParent();
  sk.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  sk.group = sculptHipHem(parent, sk.opts, { spine: p.spine.matrix, legs, floor });
  sk.group.traverse(bodyMark);
  sk.group.updateMatrixWorld(true);
}

const stillFaces = new Map<string, FaceRig>();
/** Nét mặt dùng chung cho người nền: một cặp texture mặt và mồm cho mọi người cùng dáng mặt, nét, mức ửng và màu da; `set` không đổi gì, mồm không lật */
function stillFace(scale: THREE.Vector3, shape: Partial<FaceShape> = {}, state?: Partial<FaceState>, human = false, skin?: string, hair?: string): FaceRig {
  const s = { ...DEFAULT_FACE, ...state }, { blush, ...rest } = shape, lv = blushLevel(blush, s.blush);
  const key = JSON.stringify([rest, s.mouth, s.brow, s.eyes, lv, human, skin, rest.beard && hair]);
  let f = stillFaces.get(key);
  if (!f) stillFaces.set(key, (f = faceRig(R.head, scale, { ...rest, blush: lv }, { ...s, blush: 0 }, human, skin, hair)));
  const copy = (m: THREE.Mesh) => {
    const c = new THREE.Mesh(m.geometry, m.material);
    c.userData.noShadow = true;
    c.userData.noCollide = true;
    c.renderOrder = m.renderOrder;
    return c;
  };
  const mesh = copy(f.mesh);
  for (const c of f.mesh.children) mesh.add(copy(c as THREE.Mesh));
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
      if (src.attributes.tint && (mat as THREE.ShaderMaterial).defines?.USE_TINT !== undefined) g.setAttribute('tint', src.attributes.tint.clone());
      return g.applyMatrix4(inv.clone().multiply(m.matrixWorld));
    });
    const merged = new THREE.Mesh(mergeGeometries(geos), mat);
    merged.castShadow = list.some((m) => m.castShadow);
    if (list.some((m) => m.userData.torso)) merged.userData.torso = true;
    if (list.every((m) => m.userData.noShadow)) merged.userData.noShadow = true;
    if (list.every((m) => m.userData.noEdge)) merged.userData.noEdge = true;
    for (const m of list) m.removeFromParent();
    j.add(merged);
  }
}
const isJoint = (o: THREE.Object3D) => !!o.userData.joint;

/** Các trường của JSON nhân vật mà người 3D đọc. Truyền object đã qua `parseCharacter` của lõi. */
export interface CharacterJson {
  rig: Rig;
  palette: {
    garment: string; skin?: string; sleeveWidth?: number; trouserWidth?: number; limbCurve?: number; sleeveFlare?: number;
    clad?: boolean; sleeve?: string; trouser?: string; shoe?: string; shoeStyle?: ShoeKind; sole?: string; sleeveLength?: number; trouserLength?: number; bicep?: number;
  };
  head?: { form?: 'sphere' | 'human'; jaw?: 'v' | 'square'; face?: 'asian' | 'western'; nose?: { length?: number; out?: number }; heads?: number; aspect?: number };
  face?: Partial<FaceShape>;
  pieces: {
    torso: {
      garment?: Partial<Garment>; accent?: string; color?: string;
      /** Tay áo, quần, giày đi theo thân áo này, đè `palette` (`wornPalette`) */
      palette?: { sleeve?: string; sleeveLength?: number; sleeveFlare?: number; trouser?: string; trouserLength?: number; shoe?: string; shoeStyle?: ShoeKind; sole?: string };
    };
    hem?: { src?: string; skirt?: Partial<Skirt>; color?: string };
    hair?: { sculpt?: Partial<Sculpt>; color?: string; accent?: string };
    crown?: { src: string; hat?: Partial<Hat>; color?: string };
    headAcc?: { src: string; pin?: Partial<Pin>; earrings?: Partial<Earrings>; color?: string; accent?: string };
    faceAcc?: { src: string; glasses?: Partial<Glasses>; color?: string };
    neck?: { src?: string; drape?: Partial<Drape>; shades?: Partial<Shades>; necklace?: Partial<Necklace>; color?: string };
  };
  /** Vật gọi tên: socket → cấu hình; `opts.items` cấp hàm dựng 3D theo cùng tên */
  items?: Gear['specs'];
}

/** Tham số `stickman` đọc từ JSON nhân vật của rig (cho `seatCrowd`, hay đè thêm trước khi dựng); `opts` đè lên số đọc từ JSON. */
export function characterOptions(json: CharacterJson, opts: Partial<StickmanOptions> = {}): StickmanOptions {
  const pal = wornPalette(json), pc = json.pieces;
  return {
    rig: json.rig, garment: pc.torso.garment, color: pc.torso.color ?? pal.garment, accent: pc.torso.accent, skin: pal.skin,
    skirt: wornSkirt(pc.hem), skirtColor: pc.hem?.color, hair: pc.hair?.sculpt, hairColor: pc.hair?.color, hairAccent: pc.hair?.accent,
    sleeveWidth: pal.sleeveWidth, trouserWidth: pal.trouserWidth, limbCurve: pal.limbCurve, faceShape: json.face, itemSpecs: json.items,
    glasses: pc.faceAcc?.src === 'sculpt' && pc.faceAcc.glasses, glassesColor: pc.faceAcc?.color,
    ...(pc.crown?.src === 'sculpt' && { hat: pc.crown.hat ?? {}, hatColor: pc.crown.color }),
    // `headAcc` dựng khối chỉ có bông tai thì không cắm trâm mặc định
    ...(pc.headAcc?.src === 'sculpt' && { pin: pc.headAcc.pin ?? (pc.headAcc.earrings ? undefined : {}), earrings: pc.headAcc.earrings, pinColor: pc.headAcc.color, pinBead: pc.headAcc.accent }),
    ...(pc.neck?.src === 'sculpt' && { drape: pc.neck.drape, shades: pc.neck.shades, necklace: pc.neck.necklace, drapeColor: pc.neck.color }),
    clad: pal.clad, sleeveColor: pal.sleeve, trouserColor: pal.trouser, shoeColor: pal.shoe, shoeStyle: pal.shoeStyle, soleColor: pal.sole, sleeveLength: pal.sleeveLength, sleeveFlare: pal.sleeveFlare, bicep: pal.bicep,
    trouserLength: pal.trouserLength, headForm: json.head?.form, headJaw: json.head?.jaw, headFace: json.head?.face, headNose: json.head?.nose, headHeads: json.head?.heads, headAspect: json.head?.aspect, ...opts,
  };
}

/** Người que từ JSON nhân vật của rig; `opts` đè lên số đọc từ JSON. */
export const fromCharacter = (json: CharacterJson, opts: Partial<StickmanOptions> = {}): Figure => stickman(characterOptions(json, opts));

/** Socket mà người 3D dựng hình từ đó (`characterOptions`): đổi vật ở đây là phải dựng lại người */
export const BUILT_SOCKETS = ['torso', 'hem', 'hair', 'crown', 'headAcc', 'faceAcc', 'neck'] as const satisfies readonly PieceKey[];

/**
 * Người 3D của một vai theo đồ đang mặc (`items`, `equip`; docs/01-rig.md#đồ-thay-được-items-và-equip): `get` mặc `equip`
 * vào JSON nhân vật (`equipCharacter`) rồi dựng bằng `make`, một bản cho mỗi bộ mảnh ở `BUILT_SOCKETS` và mỗi dáng
 * đứng / ngồi, dựng lần đầu cần tới rồi giữ. `fresh` là bản vừa dựng: chỗ gọi thêm `fig.root` vào cảnh. Đồ cầm tay, đồ
 * gắn socket three (`dress`) không làm dựng lại.
 */
export function wardrobe(c: CharacterData, make: (worn: CharacterData, seated: boolean) => Figure) {
  const figures = new Map<string, Figure>();
  return {
    figures,
    get(equip: Equip | undefined, seated = false) {
      const worn = equipCharacter(c, equip);
      const key = JSON.stringify([seated, BUILT_SOCKETS.map((k) => worn.pieces[k])]);
      let fig = figures.get(key);
      const fresh = !fig;
      if (!fig) figures.set(key, (fig = make(worn, seated)));
      return { fig, fresh };
    },
  };
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
