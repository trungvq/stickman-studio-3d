import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { HUMAN_HEAD, humanEar, humanSkull } from './core/humanHead';

// Khối của người 3D mặc đồ (`palette.clad`) và đầu `head.form: "human"`: đầu có quai hàm, tai, cổ; bàn tay, giày, khối
// hông. Chỉ hình học; `stickman.ts` gắn vào khớp và tô màu. docs/01-rig.md#người-3d-mặc-đồ

/** Bàn tay trong khung cổ tay (three): `grip` tâm nắm — chỗ treo đồ cầm, `cap` nang va chạm `[y đầu, y cuối, bán kính]` */
export const HAND = {
  grip: 0.085,
  cap: { open: [-0.05, -0.17, 0.05], fist: [-0.04, -0.12, 0.058] } as Record<'open' | 'fist', [number, number, number]>,
};

/** Giày trong khung cổ chân (y lên, z mũi giày), đo bằng bán kính cổ chân: gót, mũi, nửa rộng, cao trên cổ chân */
export const SHOE = { heel: -1.25, toe: 3.3, half: 1.22, top: 1.15 };

const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _qk = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _e = new THREE.Euler();
/** Ống chân lệch khỏi phương đứng dưới góc này thì bàn chân vẫn nằm ngang, quá thì nghiêng theo phần dư (radian) */
const FOOT_FREE = 0.5;

/**
 * Cổ chân: tự xoay bàn chân về nằm ngang trong hệ người (`body`) mỗi lần three tính ma trận, không cần `act` gọi. Ống
 * chân chúc quá `FOOT_FREE` (quỳ, đá chân) thì bàn chân nghiêng theo phần dư.
 */
export class Ankle extends THREE.Group {
  constructor(private body: THREE.Object3D) {
    super();
  }
  private level() {
    const knee = this.parent;
    if (!knee) return;
    knee.matrixWorld.decompose(_v, _qk, _s);
    this.body.matrixWorld.decompose(_v, _qb, _s);
    const rel = _qb.invert().multiply(_qk);
    const d = _v.set(0, -1, 0).applyQuaternion(rel);
    const pitch = Math.atan2(-d.z, -d.y);
    const foot = new THREE.Quaternion().setFromEuler(_e.set(pitch - Math.max(-FOOT_FREE, Math.min(FOOT_FREE, pitch)), 0, 0));
    this.quaternion.copy(rel.invert().multiply(foot));
  }
  override updateMatrixWorld(force?: boolean) {
    this.level();
    super.updateMatrixWorld(force);
  }
  override updateWorldMatrix(updateParents: boolean, updateChildren: boolean) {
    if (updateParents) this.parent?.updateWorldMatrix(true, false);
    this.level();
    super.updateWorldMatrix(false, updateChildren);
  }
}

/** Lưới kín, pháp tuyến trơn qua đường nối UV: vỏ viền ngược không nứt */
function smooth(g: THREE.BufferGeometry) {
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const m = mergeVertices(g);
  m.computeVertexNormals();
  return m;
}

/** Khối sọ `human`: mặt cầu bán kính `r` qua `humanSkull` rồi phóng `scale` như sọ cầu */
export function humanHeadGeometry(r: number, segs: [number, number], scale: THREE.Vector3) {
  const g = new THREE.SphereGeometry(1, ...segs), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = humanSkull([p.getX(i), p.getY(i), p.getZ(i)]);
    p.setXYZ(i, x * r * scale.x, y * r * scale.y, z * r * scale.z);
  }
  return smooth(g);
}

/**
 * Tai bên `side` trên đầu `human` (hệ nhóm đầu): vỏ dẹt chìm nửa vào má, mặt ngoài ngả ra trước, một nét cong chữ C mở
 * về phía mặt. `ink` là vật liệu nét.
 */
export function earGroup(side: -1 | 1, r: number, scale: THREE.Vector3, skin: THREE.Material, hull: THREE.Material, ink: THREE.Material) {
  const E = HUMAN_HEAD.ear;
  const [cx, cy, cz] = humanEar(side);
  const g = new THREE.Group();
  g.position.set(cx * r * scale.x, cy * r * scale.y, cz * r * scale.z);
  g.rotation.set(0, side * -0.35, side * 0.12);
  const geo = smooth(new THREE.SphereGeometry(1, 14, 10).scale(E.out * r, E.h * r, E.w * r).translate(side * E.out * r * 0.35, 0, 0));
  const m = new THREE.Mesh(geo, skin);
  m.castShadow = true;
  const h = new THREE.Mesh(geo, hull);
  h.userData.noShadow = true;
  g.add(m, h);
  const pts: THREE.Vector3[] = [];
  for (let a = 70; a <= 290; a += 20) {
    const t = (a * Math.PI) / 180, y = 0.42 * Math.sin(t), z = 0.36 * Math.cos(t) - 0.08;
    const x = Math.sqrt(Math.max(0, 1 - y * y - z * z));
    pts.push(new THREE.Vector3(side * (x * E.out * r * 1.02 + E.out * r * 0.35), y * E.h * r, z * E.w * r));
  }
  const c = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.006, 5), ink);
  c.userData.noShadow = true;
  g.add(c);
  return g;
}

/** Cổ trong nhóm cổ: từ trong cổ áo lên tới trong đầu, hơi lùi sau trục */
export function neckGeometry(top: number, radius: number) {
  const g = new THREE.CylinderGeometry(radius, radius * 1.08, top + 0.04, 16, 1, true);
  g.translate(0, top / 2 - 0.02, -0.03);
  return smooth(g);
}

const place = (g: THREE.BufferGeometry, from: THREE.Vector3, dir: THREE.Vector3) =>
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.normalize())).translate(from.x, from.y, from.z);

/** Ống mọc từ gốc chĩa theo −y, dài `len`, bán kính `r` */
const finger = (r: number, len: number) => new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 3, 8).translate(0, -len / 2, 0);

/** Cỡ bàn tay theo bán kính cổ tay `rw`: nhân vào `HAND` và `handGeometry` */
export const handScale = (rw: number) => Math.max(1, rw / 0.048);

/** Bàn tay xoè cỡ `1` dài chừng này; xoè không dài quá `OPEN_REACH` cẳng tay */
const OPEN_LEN = 0.21;
const OPEN_REACH = 0.55;
/** Cỡ dọc của bàn tay xoè cỡ `k` trên cẳng tay dài `foreArm`: chi to mà ngắn thì găng tròn lại, không dài tới gối */
export const openLength = (k: number, foreArm: number) => Math.min(k, Math.max(1, (OPEN_REACH * foreArm) / OPEN_LEN));

/**
 * Bàn tay bên `side` trong khung cổ tay (−y dọc cẳng tay ra ngoài, lòng bàn tay quay về phía thân, ngón cái về +z):
 * xoè là găng dẹt có ngón cái tách, nắm là khối tròn có ngón cái vắt ngang trước. Cỡ `handScale`, xoè dài `long` (`openLength`).
 */
export function handGeometry(side: -1 | 1, fist: boolean, k: number, long = k) {
  const palm = -side;
  const parts: THREE.BufferGeometry[] = [];
  if (!fist) {
    parts.push(new THREE.CapsuleGeometry(0.06, 0.09, 4, 12).scale(0.5, 1, 1).translate(0, -0.105, 0));
    parts.push(place(finger(0.021, 0.085), new THREE.Vector3(palm * 0.012, -0.045, 0.04), new THREE.Vector3(palm * 0.25, -0.75, 0.55)));
  } else {
    parts.push(new THREE.SphereGeometry(1, 14, 10).scale(0.052, 0.068, 0.064).translate(0, -HAND.grip, 0.004));
    parts.push(place(finger(0.022, 0.075), new THREE.Vector3(palm * 0.006, -0.05, 0.05), new THREE.Vector3(palm * 0.55, -0.6, 0.25)));
  }
  const g = smooth(mergeGeometries(parts.map((p) => p.toNonIndexed())));
  const ky = fist ? k : long;
  return k === 1 && ky === 1 ? g : g.scale(k, ky, k);
}

/**
 * Giày trong khung cổ chân, cỡ theo bán kính cổ chân `ra`: đế phẳng cách cổ chân `sole` xuống, gót tròn trùm mút ống
 * chân, mũi thấp dần về trước.
 */
export function shoeGeometry(sole: number, ra: number) {
  const heel = SHOE.heel * ra, toe = SHOE.toe * ra, half = SHOE.half * ra, top = SHOE.top * ra + sole;
  const g = new THREE.SphereGeometry(1, 22, 14), p = g.attributes.position;
  const cz = (heel + toe) / 2, rz = (toe - heel) / 2, mid = top / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let Y = mid + y * mid * (y > 0 ? 1 - 0.45 * Math.max(0, z) : 1.05);
    if (Y < 0.003) Y = 0.003 - (0.003 - Y) * 0.15;
    p.setXYZ(i, x * half * (1 - 0.12 * Math.max(0, z)), Y - sole, cz + z * rz);
  }
  return smooth(g);
}

/** Nang va chạm của giày trong khung cổ chân: gót, mũi (z), cao độ trục, bán kính */
export function shoeCapsule(sole: number, ra: number): [number, number, number, number] {
  const r = (SHOE.top * ra + sole) / 2;
  return [SHOE.heel * ra + r, SHOE.toe * ra - r, r - sole, r];
}

/** Mông trong khối hông, theo bán kính gốc đùi: tâm lùi sau `back`, thấp hơn khớp hông `drop`, bán kính `r` */
const BUTT = { back: 0.7, drop: 0.4, r: 1 };

/**
 * Khối hông nối thân áo với hai đùi, hệ nhóm thân (three, y lên từ hông): bao lồi của vành thân áo thu vào ở `ringY`, hai
 * khối cầu bán kính `r` quanh gốc chân `±hip` và hai khối cầu mông (`BUTT`). `profile` là mặt cắt thân áo (`[nửa rộng,
 * y xuống]`, px), `depth` nửa bề sâu từng hàng của nó.
 */
export function pelvisGeometry(profile: [number, number][], depth: number[], hip: number, r: number) {
  const bottom = profile[profile.length - 1][1];
  /** Nửa rộng, nửa sâu của thân áo ở `y` */
  const at = (y: number): [number, number] => {
    for (let i = 1; i < profile.length; i++) {
      const [a0, y0] = profile[i - 1], [a1, y1] = profile[i];
      if (y0 <= y && y <= y1) {
        const u = y1 === y0 ? 1 : (y - y0) / (y1 - y0);
        return [a0 + (a1 - a0) * u, depth[i - 1] + (depth[i] - depth[i - 1]) * u];
      }
    }
    return [profile[profile.length - 1][0], depth[depth.length - 1]];
  };
  const yRing = Math.min(-15, bottom - 3);
  const pts: THREE.Vector3[] = [];
  const [ra, rd] = at(yRing).map((v) => (v * 0.94) / 100);
  for (let i = 0; i < 32; i++) {
    const t = (2 * Math.PI * i) / 32;
    pts.push(new THREE.Vector3(ra * Math.sin(t), -yRing / 100, rd * Math.cos(t)));
  }
  const ball = (x: number, y: number, z: number, rr: number) => {
    for (let i = 0; i <= 6; i++)
      for (let j = 0; j < 12; j++) {
        const th = (Math.PI * i) / 6, ph = (2 * Math.PI * j) / 12;
        pts.push(new THREE.Vector3(x + rr * Math.sin(th) * Math.cos(ph), y + rr * Math.cos(th), z + rr * Math.sin(th) * Math.sin(ph)));
      }
  };
  for (const s of [-1, 1]) {
    ball(s * hip, 0, 0, r);
    ball(s * hip, -BUTT.drop * r, -BUTT.back * r, BUTT.r * r);
  }
  // tới nửa bán kính đùi dưới gấu, khối hông lùi hẳn vào trong thân áo: mặt bao lồi nối lên trên gấu không cắt qua lưng, sườn áo
  for (const p of pts) {
    const y = -p.y * 100;
    if (y >= bottom + 50 * r) continue;
    const [a, d] = at(y).map((v) => (v * 0.88) / 100), e = Math.hypot(p.x / a, p.z / d);
    if (e > 1) p.set(p.x / e, p.y, p.z / e);
  }
  return smooth(new ConvexGeometry(pts));
}
