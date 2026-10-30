import * as THREE from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { place3, type Place3 } from './core/lens';
import { lathePoints, toThree, U, type BatchSolid, type Item, type Vec3 } from './khoi';
import { fitCapsules, handCapsules } from './core/handMesh';
import type { Hand } from './human';
import { R, type Figure, type Side } from './stickman';

// Kiểm người xuyên đồ ở tư thế hiện tại: người là các viên nang (chi, thân, đầu), đồ là khối lồi (hộp, món khối)
// hay lưới tam giác. Thuần: không đổi gì trên người hay đồ, gọi được ở từng `t` đã lấy mẫu sau `act`.

/** `hand`, `foot` chỉ người `clad` có: bàn tay đang hiện (xoè hay nắm) và giày */
export type BodyPart = 'head' | 'torso' | 'upperArm' | 'foreArm' | 'thigh' | 'shin' | 'hand' | 'foot';
export const BODY_PARTS: readonly BodyPart[] = ['head', 'torso', 'upperArm', 'foreArm', 'thigh', 'shin', 'hand', 'foot'];

/**
 * Phần người được phép lấn vào vật: `'<bộ phận>[R|L]'` của mọi người, `'<người>.<bộ phận>[R|L]'` của một người (tên như
 * khoá của `figures` truyền cho `collide`), `'self.…'` là người đang cầm, đang đội vật. Tên phần người của lớp vẽ code
 * (`forearmNear`, `legFar`, `lap`…) cũng được: gần / xa theo `eye` của `collide`. Chuỗi là lấn bao nhiêu cũng không báo;
 * `{ part, max }` cho lấn tới `max` đơn vị thế giới rig (px, như `touch` của món lớp vẽ code), sâu hơn vẫn báo.
 */
export type Touch = string | { part: string; max: number };

/**
 * Một vật cản, toạ độ thế giới three: khối lồi (`planes` pháp tuyến ra ngoài, `points` đỉnh, `faces` tam giác mặt cùng thứ tự
 * `planes`) hay lưới tam giác (`tris`); tam giác là 9 số
 */
export interface Collider {
  name: string;
  box: THREE.Box3;
  planes?: THREE.Plane[];
  points?: Float32Array;
  faces?: Float32Array;
  tris?: Float32Array;
  /** Vật ba chiều sinh ra vật cản: so hai mẫu `t` để biết vật dời bao xa */
  from?: THREE.Object3D;
  /** `userData.touch` của vật và các nhóm cha, `touch` của món */
  touch?: readonly Touch[];
  /** `root` của người mang vật (cầm, đội, gắn trên người): `self` trong `touch` */
  owner?: THREE.Object3D;
  /** Số thứ tự `Item` trong `Batch` của `from` (`SolidTag.owner`): chủ của vai trò (`rolesOf`) */
  item?: number;
}

/**
 * Một chỗ xuyên: `depth` là độ lún của nét vào vật (đơn vị three, ×100 ra px rig) — với khối lồi là quãng ngắn nhất phải dời
 * viên nang cho rời khối; `at` điểm sâu nhất trên trục nét
 */
export interface Contact {
  who: string;
  part: BodyPart;
  side?: Side;
  collider: string;
  depth: number;
  at: THREE.Vector3;
}

export interface CollideOptions {
  /** Lún dưới mức này thì bỏ qua (three); mặc định 0,01 tức 1 px */
  slack?: number;
  parts?: readonly BodyPart[];
  /** Kiểm cả người với người */
  people?: boolean;
  /** Mắt ống kính (thế giới three): tên `…Near` / `…Far` trong `touch` là bên gần / xa mắt của từng người; không có thì cả hai bên */
  eye?: THREE.Vector3 | readonly [number, number, number];
  /** Gọi với mục `touch` không phải phần người nào, mỗi lần gặp */
  unknown?: (entry: string, collider: string) => void;
}

type ColliderSource = THREE.Box3 | THREE.Object3D | Item | { points: readonly (THREE.Vector3 | Vec3)[] };

const isItem = (s: unknown): s is Item => !!s && typeof s === 'object' && 'at' in s && ('parts' in s || 'lathes' in s);

/** Khối lồi bao các điểm (three); điểm nằm trên một mặt phẳng thì nong dày 0,2 px; `null` khi điểm thẳng hàng */
function convex(name: string, pts: THREE.Vector3[]): Collider | null {
  const hull = (ps: THREE.Vector3[]) => {
    try {
      const h = new ConvexHull().setFromPoints(ps);
      if (h.faces.length < 4) return null;
      const planes = h.faces.map((f) => new THREE.Plane(f.normal.clone(), -f.constant));
      const faces = new Float32Array(h.faces.length * 9), seen = new Set<THREE.Vector3>(), points: number[] = [];
      h.faces.forEach((f, i) =>
        [f.edge.tail().point, f.edge.head().point, f.edge.next.head().point].forEach((p, k) => {
          p.toArray(faces, i * 9 + k * 3);
          if (!seen.has(p)) seen.add(p), points.push(p.x, p.y, p.z);
        }));
      return { planes, faces, points: new Float32Array(points) };
    } catch {
      return null;
    }
  };
  let h = hull(pts);
  if (!h && pts.length >= 3) {
    const n = new THREE.Vector3();
    for (let i = 2; i < pts.length && n.lengthSq() < 1e-12; i++) n.crossVectors(pts[1].clone().sub(pts[0]), pts[i].clone().sub(pts[0]));
    if (n.lengthSq() >= 1e-12) {
      n.setLength(0.001);
      h = hull(pts.flatMap((p) => [p.clone().add(n), p.clone().sub(n)]));
    }
  }
  return h ? { name, box: new THREE.Box3().setFromArray(h.points), ...h } : null;
}

/** Khối lồi của một món khối: mỗi khối tám đỉnh và mỗi khối tròn xoay một khối */
function itemColliders(item: Item, name: string): Collider[] {
  const out: Collider[] = [];
  const P = (at: Place3) => (p: Vec3) => toThree(place3(at, p));
  item.parts?.forEach((p) => {
    const c = convex(name, p.v.map(P(item.at)));
    if (c) out.push(c);
  });
  item.lathes?.forEach(({ spec, at }) => {
    const c = convex(name, lathePoints(spec, at));
    if (c) out.push(c);
  });
  if (item.touch?.length) for (const c of out) c.touch = item.touch;
  return out;
}

const opacity = (o: THREE.Object3D) => ((o as THREE.Mesh).material as THREE.ShaderMaterial | undefined)?.uniforms?.uOpacity?.value ?? 1;
/** Mờ quá nửa như `appear` (mất bóng, mất viền); nhóm khối thì xét các lưới của nó */
export const faded = (o: THREE.Object3D) =>
  (o as THREE.Mesh).isMesh ? opacity(o) < 0.5 : o.children.some((c) => (c as THREE.Mesh).isMesh && opacity(c) < 0.5);

/** Lưới không đo bằng tam giác: `noCollide`, lưới của chính người (`body`), vỏ nét ngược, vật đã mờ */
export const skipMesh = (m: THREE.Mesh) =>
  !!m.userData.noCollide || !!m.userData.body || (m.material as THREE.Material).side === THREE.BackSide || faded(m);

type Attr = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
const version = (a: Attr | null) => (a ? ((a as THREE.InterleavedBufferAttribute).data ?? (a as THREE.BufferAttribute)).version : -1);
/** Tam giác thế giới của từng lưới, giữ lại tới khi lưới dời hay hình đổi: đo cả cảnh mỗi mẫu `t` chỉ tính lại vật động */
const trisMemo = new WeakMap<THREE.Mesh, { pos: Attr; idx: Attr | null; ver: number; iver: number; m: THREE.Matrix4; tris: Float32Array; box: THREE.Box3 }>();

/** Tam giác thế giới của một lưới */
export function meshTris(m: THREE.Mesh, name: string): Collider | null {
  const pos = m.geometry?.attributes.position as Attr | undefined, idx = m.geometry?.index ?? null;
  if (!pos) return null;
  const hit = trisMemo.get(m);
  if (hit && hit.pos === pos && hit.idx === idx && hit.ver === version(pos) && hit.iver === version(idx) && hit.m.equals(m.matrixWorld))
    return { name, tris: hit.tris, box: hit.box };
  const n = idx ? idx.count : pos.count;
  if (n < 3) return null;
  const arr = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m.matrixWorld);
    arr[i * 3] = v.x, arr[i * 3 + 1] = v.y, arr[i * 3 + 2] = v.z;
  }
  const box = new THREE.Box3().setFromArray(arr);
  trisMemo.set(m, { pos, idx, ver: version(pos), iver: version(idx), m: m.matrixWorld.clone(), tris: arr, box });
  return { name, tris: arr, box };
}

/** Khối lồi thế giới của các món một nhóm `Batch`, giữ lại tới khi nhóm dời hay đổi `userData.colliders` */
const hullMemo = new WeakMap<THREE.Object3D, { solids: BatchSolid[]; m: THREE.Matrix4; hulls: (Collider | null)[] }>();

function batchHulls(o: THREE.Object3D, solids: BatchSolid[]): (Collider | null)[] {
  const hit = hullMemo.get(o);
  if (hit && hit.solids === solids && hit.m.equals(o.matrixWorld)) return hit.hulls;
  const hulls = solids.map((s) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i + 2 < s.points.length; i += 3) pts.push(new THREE.Vector3(s.points[i], s.points[i + 1], s.points[i + 2]).applyMatrix4(o.matrixWorld));
    return convex(s.name ?? '', pts);
  });
  hullMemo.set(o, { solids, m: o.matrixWorld.clone(), hulls });
  return hulls;
}

/** Chạm có chủ ý và người mang vật mà nhánh dưới `o` thừa hưởng */
function inherit(o: THREE.Object3D, touch: readonly Touch[], owner?: THREE.Object3D): [readonly Touch[], THREE.Object3D | undefined] {
  const t = o.userData.touch as Touch[] | undefined;
  return [t?.length ? [...touch, ...t] : touch, o.userData.figure ? o : owner];
}

/**
 * Vật cản của cả nhánh `src`: nhóm có `userData.colliders` (đầu ra của `Batch`) cho khối lồi từng món, lưới còn lại cho tam
 * giác. Bỏ nhánh ẩn (`visible` false, xét cả cha), lưới `noCollide`, lưới của người, vỏ nét, vật đã mờ. Tên mỗi vật cản là
 * `name` của món, không thì `name` của nút gần nhất từ lưới lên `src`, không nữa thì `name` truyền vào.
 */
function objectColliders(src: THREE.Object3D, name?: string): Collider[] {
  src.updateWorldMatrix(true, true);
  const up: THREE.Object3D[] = [];
  for (let o = src.parent; o; o = o.parent) up.unshift(o);
  if (up.some((o) => !o.visible)) return [];
  let touch: readonly Touch[] = [], owner: THREE.Object3D | undefined;
  for (const o of up) [touch, owner] = inherit(o, touch, owner);
  const out: Collider[] = [];
  const tag = (c: Collider | null, from: THREE.Object3D, t: readonly Touch[], who?: THREE.Object3D) => {
    if (!c) return;
    c.from = from;
    if (t.length) c.touch = t;
    if (who) c.owner = who;
    out.push(c);
  };
  const walk = (o: THREE.Object3D, label: string, touch: readonly Touch[], owner?: THREE.Object3D) => {
    if (!o.visible) return;
    [touch, owner] = inherit(o, touch, owner);
    const solids = o.userData.colliders as BatchSolid[] | undefined;
    if (solids?.length && !faded(o))
      batchHulls(o, solids).forEach((h, i) => {
        const s = solids[i];
        if (h) tag({ ...h, name: s.name || label, ...(s.owner !== undefined && { item: s.owner }) }, o, s.touch?.length ? [...touch, ...s.touch] : touch, owner);
      });
    const m = o as THREE.Mesh;
    if (m.isMesh && !skipMesh(m)) tag(meshTris(m, label), m, touch, owner);
    for (const c of o.children) walk(c, c.name || label, touch, owner);
  };
  walk(src, name ?? (src.name || 'vat'), touch, owner);
  return out;
}

/**
 * Vật cản từ: `Box3` (thế giới three), món khối `Item` của `khoi` (từng khối lồi, chính xác), `{ points }` (bao lồi),
 * hay `Object3D` (cả nhánh: món dựng qua `Batch` là khối lồi từng món, lưới khác là tam giác — chỉ bắt nét cắt qua mặt).
 */
export function colliders(src: ColliderSource | readonly ColliderSource[], name?: string): Collider[] {
  if (Array.isArray(src)) return src.flatMap((s, i) => colliders(s, s instanceof THREE.Object3D && name === undefined ? undefined : `${name ?? 'vat'}${i}`));
  if (src instanceof THREE.Box3) {
    const { min: a, max: b } = src;
    const pts = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? b.x : a.x, i & 2 ? b.y : a.y, i & 4 ? b.z : a.z));
    return [convex(name ?? 'vat', pts)].filter((c): c is Collider => !!c);
  }
  if (src instanceof THREE.Object3D) return objectColliders(src, name);
  if (isItem(src)) return itemColliders(src, name ?? src.name ?? 'vat');
  const pts = (src as { points: readonly (THREE.Vector3 | Vec3)[] }).points.map((p) => (p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(...p)));
  return [convex(name ?? 'vat', pts)].filter((c): c is Collider => !!c);
}

interface Capsule { part: BodyPart; side?: Side; a: THREE.Vector3; b: THREE.Vector3; r: number }

const torsoDims = new WeakMap<Figure, { box: THREE.Box3 }>();
/** Hộp thân áo trong hệ thân: khối thân áo, không có đánh dấu thì mảnh lớn nhất */
function torsoBox(fig: Figure) {
  let d = torsoDims.get(fig);
  if (!d) {
    let best = new THREE.Box3(), vol = -1;
    const tagged = fig.spine.children.filter((c) => c.userData.torso);
    for (const c of tagged.length ? tagged : fig.spine.children) {
      const m = c as THREE.Mesh;
      if (!m.isMesh || (m.material as THREE.Material).side === THREE.BackSide || m.userData.limb) continue;
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox!.clone().applyMatrix4(m.matrix), s = b.getSize(new THREE.Vector3());
      if (s.x * s.y * s.z > vol) (vol = s.x * s.y * s.z), (best = b);
    }
    torsoDims.set(fig, (d = { box: best }));
  }
  return d.box;
}

const handMemo = new WeakMap<Hand, { key: string; caps: ReturnType<typeof handCapsules> }>();
/** Nang bàn tay theo dáng đang vẽ (`shown`), nới cho ôm trọn lưới da; khung bàn tay, giữ tới khi dáng đổi */
export function handCaps(h: Hand) {
  const key = h.shown.join(), hit = handMemo.get(h);
  if (hit?.key === key) return hit.caps;
  const caps = fitCapsules(handCapsules([0, 0, ...h.shown], h.side, h.scale, h.long), h.geo.attributes.position.array);
  handMemo.set(h, { key, caps });
  return caps;
}

/**
 * Các viên nang của người ở tư thế hiện tại, thế giới three. Nang ống chân dừng ở mút nét (bàn chân đặt trên sàn ở đó),
 * không trùm nửa cầu đầu nét: đứng hay ngồi đặt chân xuống mặt nào cũng không lún.
 */
export function bodyCapsules(fig: Figure, parts: readonly BodyPart[] = BODY_PARTS): Capsule[] {
  fig.root.updateWorldMatrix(true, true);
  const k = fig.root.getWorldScale(new THREE.Vector3()).x;
  const out: Capsule[] = [];
  const want = new Set(parts);
  const seg = (j: THREE.Object3D, part: BodyPart, side: Side) => {
    const m = j.children.find((c) => c.userData.limb) as THREE.Mesh | undefined;
    if (!m) return;
    const a = j.getWorldPosition(new THREE.Vector3()), b = j.localToWorld(new THREE.Vector3(0, -m.userData.len, 0)), r = m.userData.r * k;
    if (part === 'shin') b.addScaledVector(a.clone().sub(b).normalize(), Math.min(r, a.distanceTo(b)));
    out.push({ part, side, a, b, r });
  };
  for (const s of [-1, 1] as const) {
    if (want.has('upperArm')) seg(fig.arms[s].shoulder, 'upperArm', s);
    if (want.has('foreArm')) seg(fig.arms[s].elbow, 'foreArm', s);
    if (want.has('thigh')) seg(fig.legs[s].hip, 'thigh', s);
    if (want.has('shin')) seg(fig.legs[s].knee, 'shin', s);
    const h = fig.hands?.[s];
    if (h && want.has('hand')) {
      const w = fig.arms[s].wrist;
      for (const [a, b, r] of handCaps(h))
        out.push({ part: 'hand', side: s, a: w.localToWorld(new THREE.Vector3(...a)), b: w.localToWorld(new THREE.Vector3(...b)), r: r * k });
    }
    const ankle = fig.legs[s].ankle;
    if (ankle && want.has('foot')) {
      // đáy nang đúng mặt đế: đứng trên sàn không lún
      const [z0, z1, y, r] = ankle.userData.shoe as [number, number, number, number];
      out.push({ part: 'foot', side: s, a: ankle.localToWorld(new THREE.Vector3(0, y, z0)), b: ankle.localToWorld(new THREE.Vector3(0, y, z1)), r: r * k });
    }
  }
  if (want.has('head')) {
    const c = fig.head.getWorldPosition(new THREE.Vector3());
    // đầu `human`: má và quai hàm chibi nở ra ngoài mặt cầu ở nửa dưới
    const b = fig.head.userData.human ? fig.head.localToWorld(new THREE.Vector3(0, -0.2 * R.head, 0.03 * R.head)) : c.clone();
    out.push({ part: 'head', a: c, b, r: R.head * k });
  }
  if (want.has('torso')) {
    const b = torsoBox(fig);
    const r = (b.max.z - b.min.z) / 2, z = (b.max.z + b.min.z) / 2;
    const x0 = b.min.x + r, x1 = b.max.x - r, y0 = b.min.y + r, y1 = b.max.y - r;
    const n = Math.max(1, Math.ceil((x1 - x0) / r) + 1);
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1);
      out.push({ part: 'torso', a: fig.spine.localToWorld(new THREE.Vector3(x, y0, z)), b: fig.spine.localToWorld(new THREE.Vector3(x, y1, z)), r: r * k });
    }
  }
  return out;
}

const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _s = new THREE.Vector3(), _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _r = new THREE.Vector3();
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _C = new THREE.Vector3(), _n = new THREE.Vector3(), _d = new THREE.Vector3();

/** Khoảng cách hai đoạn thẳng; điểm gần nhất trên đoạn đầu ghi vào `out` */
function segSeg(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3, out: THREE.Vector3): number {
  const d1 = _d1.subVectors(q1, p1), d2 = _d2.subVectors(q2, p2), r = _r.subVectors(p1, p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s = 0, t = 0;
  if (a < 1e-12 && e < 1e-12) return out.copy(p1).distanceTo(p2);
  if (a < 1e-12) t = THREE.MathUtils.clamp(f / e, 0, 1);
  else {
    const c = d1.dot(r);
    if (e < 1e-12) s = THREE.MathUtils.clamp(-c / a, 0, 1);
    else {
      const b = d1.dot(d2), den = a * e - b * b;
      s = den > 1e-12 ? THREE.MathUtils.clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) (t = 0), (s = THREE.MathUtils.clamp(-c / a, 0, 1));
      else if (t > 1) (t = 1), (s = THREE.MathUtils.clamp((b - c) / a, 0, 1));
    }
  }
  out.copy(p1).addScaledVector(d1, s);
  return _q.copy(p2).addScaledVector(d2, t).distanceTo(out);
}

const tri = new THREE.Triangle(), plane = new THREE.Plane(), line = new THREE.Line3(), hitP = new THREE.Vector3();
/** Khoảng cách đoạn `a`–`b` tới tam giác mà đoạn không cắt qua; điểm gần nhất trên đoạn ghi vào `out` */
function segTri(a: THREE.Vector3, b: THREE.Vector3, A: THREE.Vector3, B: THREE.Vector3, C: THREE.Vector3, out: THREE.Vector3): number {
  tri.set(A, B, C);
  let best = Infinity;
  for (const p of [a, b]) {
    const d = tri.closestPointToPoint(p, _p).distanceTo(p);
    if (d < best) (best = d), out.copy(p);
  }
  for (const [u, v] of [[A, B], [B, C], [C, A]]) {
    const d = segSeg(a, b, u, v, _s);
    if (d < best) (best = d), out.copy(_s);
  }
  return best;
}

/** Độ lún của viên nang vào một tam giác: cắt qua mặt thì tính tới mút nét gần mặt hơn */
function capsuleTri(c: Capsule, A: THREE.Vector3, B: THREE.Vector3, C: THREE.Vector3): [number, THREE.Vector3] | null {
  tri.set(A, B, C);
  tri.getPlane(plane);
  const da = plane.distanceToPoint(c.a), db = plane.distanceToPoint(c.b);
  if (da * db < 0) {
    line.set(c.a, c.b);
    if (plane.intersectLine(line, hitP) && tri.containsPoint(hitP)) return [c.r + Math.min(Math.abs(da), Math.abs(db)), hitP.clone()];
  }
  const d = segTri(c.a, c.b, A, B, C, _n);
  return d < c.r ? [c.r - d, _n.clone()] : null;
}

/** Pháp tuyến mặt và hướng cạnh của khối lồi, đơn vị, bỏ trùng: các trục tách khi đo độ lún */
const axesMemo = new WeakMap<Float32Array, { normals: THREE.Vector3[]; edges: THREE.Vector3[] }>();
function axesOf(col: Collider) {
  let ax = axesMemo.get(col.faces!);
  if (ax) return ax;
  const uniq = (vs: THREE.Vector3[]) => {
    const m = new Map<string, THREE.Vector3>();
    for (const v of vs) {
      if (v.lengthSq() < 1e-16) continue;
      v.normalize().multiplyScalar(Math.sign(Math.abs(v.x) > 1e-6 ? v.x : Math.abs(v.y) > 1e-6 ? v.y : v.z));
      m.set(`${Math.round(v.x * 1e4)},${Math.round(v.y * 1e4)},${Math.round(v.z * 1e4)}`, v);
    }
    return [...m.values()];
  };
  const f = col.faces!, edges: THREE.Vector3[] = [];
  for (let i = 0; i < f.length; i += 9)
    for (const [u, v] of [[0, 3], [3, 6], [6, 0]]) edges.push(new THREE.Vector3(f[i + v] - f[i + u], f[i + v + 1] - f[i + u + 1], f[i + v + 2] - f[i + u + 2]));
  axesMemo.set(col.faces!, (ax = { normals: uniq(col.planes!.map((p) => p.normal.clone())), edges: uniq(edges) }));
  return ax;
}

/**
 * Quãng ngắn nhất phải dời đoạn `a`–`b` (đang cắt khối lồi) cho rời khối: độ chồm nhỏ nhất trên pháp tuyến mặt khối và trên tích
 * từng hướng cạnh với đoạn — đủ trục tách của tổng Minkowski, nên đúng, không lấy mẫu hướng
 */
function pushOut(a: THREE.Vector3, b: THREE.Vector3, col: Collider): number {
  const { normals, edges } = axesOf(col), pts = col.points!, d = _d.subVectors(b, a);
  let best = Infinity;
  const over = (n: THREE.Vector3) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < pts.length; i += 3) {
      const v = n.x * pts[i] + n.y * pts[i + 1] + n.z * pts[i + 2];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const sa = n.dot(a), sb = n.dot(b);
    best = Math.min(best, hi - Math.min(sa, sb), Math.max(sa, sb) - lo);
  };
  for (const n of normals) over(n);
  if (d.lengthSq() > 1e-12)
    for (const e of edges) {
      _n.crossVectors(e, d);
      if (_n.lengthSq() > 1e-12) over(_n.normalize());
    }
  return Math.max(0, best);
}

/**
 * Độ lún của viên nang vào khối lồi: trục rời khối thì bán kính trừ khoảng cách thật từ trục tới khối, trục cắt khối thì bán kính
 * cộng quãng ngắn nhất phải dời trục ra khỏi khối (`pushOut`)
 */
function capsuleConvex(c: Capsule, col: Collider): [number, THREE.Vector3] | null {
  const { a, b, r } = c, planes = col.planes!, faces = col.faces;
  if (!faces || !col.points) throw new Error(`collide: khối lồi "${col.name}" thiếu points / faces — dựng vật cản bằng colliders()`);
  // cắt đoạn theo từng mặt (Cyrus–Beck); cả đoạn ngoài một mặt quá bán kính là không chạm
  let lo = 0, hi = 1;
  for (const pl of planes) {
    const da = pl.distanceToPoint(a), db = pl.distanceToPoint(b);
    if (da >= r && db >= r) return null;
    if (da > 0 && db > 0) hi = -1;
    else if (da > 0) lo = Math.max(lo, da / (da - db));
    else if (db > 0) hi = Math.min(hi, da / (da - db));
  }
  if (lo <= hi) return [r + pushOut(a, b, col), new THREE.Vector3().lerpVectors(a, b, (lo + hi) / 2)];
  // rời nhau: điểm gần nhất nằm trên mặt mà đoạn có phần ở phía ngoài
  let best = r;
  const at = new THREE.Vector3();
  for (let i = 0; i < planes.length; i++) {
    const da = planes[i].distanceToPoint(a), db = planes[i].distanceToPoint(b);
    if ((da <= 0 && db <= 0) || Math.min(da, db) >= best) continue;
    const d = segTri(a, b, _A.fromArray(faces, i * 9), _B.fromArray(faces, i * 9 + 3), _C.fromArray(faces, i * 9 + 6), _n);
    if (d < best) (best = d), at.copy(_n);
  }
  return best < r ? [r - best, at] : null;
}

/** Khung bao từng tam giác của `tris` (min xyz, max xyz), tính một lần cho mỗi mảng tam giác */
const triBoxMemo = new WeakMap<Float32Array, Float32Array>();
function triBoxes(t: Float32Array) {
  let b = triBoxMemo.get(t);
  if (b) return b;
  b = new Float32Array((Math.floor(t.length / 9)) * 6);
  for (let i = 0, j = 0; i + 8 < t.length; i += 9, j += 6)
    for (let k = 0; k < 3; k++) {
      const x = t[i + k], y = t[i + 3 + k], z = t[i + 6 + k];
      b[j + k] = Math.min(x, y, z), b[j + 3 + k] = Math.max(x, y, z);
    }
  triBoxMemo.set(t, b);
  return b;
}

function capsuleCollider(c: Capsule, box: THREE.Box3, col: Collider): [number, THREE.Vector3] | null {
  if (!box.intersectsBox(col.box)) return null;
  if (col.planes) return capsuleConvex(c, col);
  const t = col.tris!, tb = triBoxes(t), { min: lo, max: hi } = box;
  let best: [number, THREE.Vector3] | null = null;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let i = 0, j = 0; i + 8 < t.length; i += 9, j += 6) {
    if (tb[j + 3] < lo.x || tb[j] > hi.x || tb[j + 4] < lo.y || tb[j + 1] > hi.y || tb[j + 5] < lo.z || tb[j + 2] > hi.z) continue;
    A.fromArray(t, i), B.fromArray(t, i + 3), C.fromArray(t, i + 6);
    const h = capsuleTri(c, A, B, C);
    if (h && (!best || h[0] > best[0])) best = h;
  }
  return best;
}

const PART_RE = new RegExp(`^(${BODY_PARTS.join('|')})([RL])?$`, 'i');
/** Phần người của lớp vẽ code (`BODY_PARTS` của fx) → bộ phận rig; bên theo mắt (`eye`) */
const FLAT_RE = /^(arm|forearm|leg|shin)(Near|Far)$/;
const FLAT: Record<string, BodyPart> = { arm: 'upperArm', forearm: 'foreArm', leg: 'thigh', shin: 'shin' };
interface TouchRule { who?: string; part: BodyPart; side?: Side; near?: boolean; max: number }

/** Mục `touch` → luật; tên bộ phận rig không phân biệt hoa thường, tên của lớp vẽ code thì đúng như fx; mục không hiểu là `null` */
function touchRule(t: Touch): TouchRule | null {
  const s = typeof t === 'string' ? t : t.part, i = s.lastIndexOf('.'), name = s.slice(i + 1);
  const who = i < 0 ? undefined : s.slice(0, i), max = typeof t === 'string' ? Infinity : t.max * U;
  const f = FLAT_RE.exec(name);
  if (f) return { who, part: FLAT[f[1]], near: f[2] === 'Near', max };
  if (name === 'lap') return { who, part: 'thigh', max };
  const m = PART_RE.exec(name);
  if (!m) return null;
  const part = BODY_PARTS.find((p) => p.toLowerCase() === m[1].toLowerCase())!;
  const side = m[2] ? (m[2] === 'R' || m[2] === 'r' ? -1 : 1) : undefined;
  return { who, part, side, max };
}

/** Lún tối đa (three) mà `touch` của vật cho phép bộ phận ấy; `self` là người mang vật, `near` bên gần mắt của người */
function allowance(rules: readonly TouchRule[], who: string, c: Capsule, near?: Side, self?: string) {
  let lim = 0;
  for (const r of rules) {
    const side = r.near === undefined ? r.side === undefined || r.side === c.side : near === undefined || c.side === (r.near ? near : -near);
    if (r.part === c.part && side && (r.who === undefined || (r.who === 'self' ? self : r.who) === who)) lim = Math.max(lim, r.max);
  }
  return lim;
}

/** Bên gần mắt của người: bên có gốc chân gần mắt hơn theo phương ngang, như `flip` của lõi */
function nearSide(fig: Figure, eye: THREE.Vector3): Side {
  const r = fig.legs[-1].hip.getWorldPosition(new THREE.Vector3()), l = fig.legs[1].hip.getWorldPosition(new THREE.Vector3());
  return (r.x - l.x) * (eye.x - (r.x + l.x) / 2) + (r.z - l.z) * (eye.z - (r.z + l.z) / 2) >= 0 ? -1 : 1;
}

/**
 * Chỗ người xuyên vật cản ở tư thế hiện tại: bộ phận nào, vật nào, lún bao sâu. Mỗi cặp (người, bộ phận, bên,
 * vật) một dòng, lấy chỗ sâu nhất. `figures` là mảng hay map tên → người; `people` thêm cặp người với người. Bộ phận
 * vật khai trong `touch` thì lún tới mức khai không báo.
 */
export function collide(figures: readonly Figure[] | Record<string, Figure>, cols: readonly Collider[], o: CollideOptions = {}): Contact[] {
  const slack = o.slack ?? 0.01;
  const entries = Array.isArray(figures) ? figures.map((f, i) => [String(i), f] as const) : Object.entries(figures);
  const eye = o.eye && (o.eye instanceof THREE.Vector3 ? o.eye : new THREE.Vector3(...o.eye));
  const bodies = entries.map(([who, f]) => {
    const caps = bodyCapsules(f, o.parts), boxes = caps.map((c) => new THREE.Box3().setFromPoints([c.a, c.b]).expandByScalar(c.r));
    // khung bao cả người: vật ngoài nó thì không viên nang nào chạm
    const all = boxes.reduce((u, b) => u.union(b), new THREE.Box3());
    return { who, caps, boxes, all, near: eye && nearSide(f, eye) };
  });
  const whoOf = new Map(entries.map(([who, f]) => [f.root as THREE.Object3D, who]));
  const found = new Map<string, Contact>();
  const add = (who: string, c: Capsule, collider: string, h: [number, THREE.Vector3] | null, lim = 0) => {
    if (!h || h[0] <= Math.max(slack, lim)) return;
    const key = `${who}|${c.part}|${c.side ?? ''}|${collider}`, cur = found.get(key);
    if (!cur || h[0] > cur.depth) found.set(key, { who, part: c.part, side: c.side, collider, depth: h[0], at: h[1] });
  };
  for (const col of cols) {
    const rules: TouchRule[] = [];
    for (const t of col.touch ?? []) {
      const r = touchRule(t);
      if (r) rules.push(r);
      else o.unknown?.(typeof t === 'string' ? t : t.part, col.name);
    }
    const self = col.owner && whoOf.get(col.owner);
    for (const { who, caps, boxes, all, near } of bodies) {
      if (!all.intersectsBox(col.box)) continue;
      caps.forEach((c, k) => {
        const lim = rules.length ? allowance(rules, who, c, near, self) : 0;
        if (lim < Infinity) add(who, c, col.name, capsuleCollider(c, boxes[k], col), lim);
      });
    }
  }
  if (o.people)
    for (let i = 0; i < bodies.length; i++)
      for (let j = i + 1; j < bodies.length; j++)
        for (const c of bodies[i].caps)
          for (const d of bodies[j].caps) {
            const dist = segSeg(c.a, c.b, d.a, d.b, _p);
            if (dist < c.r + d.r) add(bodies[i].who, c, `${bodies[j].who}.${d.part}${d.side ? (d.side < 0 ? 'R' : 'L') : ''}`, [c.r + d.r - dist, _p.clone()]);
          }
  return [...found.values()].sort((a, b) => b.depth - a.depth);
}
