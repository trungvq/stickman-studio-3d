import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { HUMAN_HEAD, humanEar, humanSkull } from './core/humanHead';
import { fingerVec, HAND_POSES, HAND_REST, type HandPose } from './core/hand';
import { handSkin, skinHand, smoothNormals, type HandSkin } from './core/handMesh';

// Khối của người 3D mặc đồ (`palette.clad`) và đầu `head.form: "human"`: đầu có quai hàm, tai, cổ; bàn tay, giày, khối
// hông. Chỉ hình học; `stickman.ts` gắn vào khớp và tô màu. docs/01-rig.md#người-3d-mặc-đồ

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

export { handScale, openLength } from './core/act3';

/**
 * Bàn tay của người `clad` bên `side`: một lưới kín liền (`handSkin` của lõi) buộc vào các đốt của `handFrames`, da dời
 * trên CPU mỗi khi số bàn tay đổi — một lượt vẽ, vỏ viền dùng chung đỉnh nên chỉ có nét ở mép ngoài. Cỡ `scale`
 * (`handScale`), cỡ dọc `long`.
 */
export interface Hand {
  side: -1 | 1;
  scale: number;
  long: number;
  geo: THREE.BufferGeometry;
  skin: HandSkin;
  /** Số bàn tay (`HAND_DOF`) `act` đặt lần gần nhất */
  acted: readonly number[];
  /** Dáng giữ khi đang cầm đồ (`grip` của attach.ts): đè góc ngón của hành động, giữ xoay và gập cổ tay */
  held?: HandPose;
  /** Góc ngón đang vẽ */
  shown: number[];
}

/** Dựng bàn tay bên `side` cỡ `k`, cỡ dọc `long`, ở dáng nghỉ; `low` là lưới thưa cho người nền */
export function handRig(side: -1 | 1, k: number, long: number, low = false): Hand {
  const skin = handSkin(side, k, long, low), n = skin.pos.length / 3;
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(new THREE.BufferAttribute(skin.index, 1));
  // cầu và hộp bao cố định ôm mọi dáng (pipeline đọc hộp cho bóng và nét bóng dáng): không tính lại mỗi lần dời đỉnh
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -0.1 * long, 0), 0.14 * Math.max(k, long) + 0.02);
  geo.boundingBox = geo.boundingSphere.getBoundingBox(new THREE.Box3());
  const h: Hand = { side, scale: k, long, geo, skin, acted: HAND_REST, shown: [] };
  poseHand(h);
  return h;
}

/**
 * Đặt bàn tay theo số `v` (`HAND_DOF`; bỏ trống là giữ số đặt lần trước); đang cầm đồ thì góc ngón theo dáng `held`. Xoay
 * và gập cổ tay là việc của khớp cổ tay (`act`), ở đây chỉ uốn da theo đốt. Số không đổi thì không làm gì.
 */
export function poseHand(h: Hand, v?: readonly number[]) {
  if (v) h.acted = v;
  const want = h.held ? [0, 0, ...fingerVec(HAND_POSES[h.held])] : h.acted;
  if (h.shown.length && h.shown.every((x, i) => Math.abs(x - want[i + 2]) < 1e-3)) return;
  h.shown = want.slice(2);
  const P = h.geo.attributes.position as THREE.BufferAttribute, N = h.geo.attributes.normal as THREE.BufferAttribute;
  skinHand(h.skin, want, P.array as Float32Array);
  smoothNormals(P.array as Float32Array, h.skin.index, N.array as Float32Array);
  P.needsUpdate = N.needsUpdate = true;
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
const BUTT = { back: 0.4, drop: 0.4, r: 0.9 };

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
