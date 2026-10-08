import * as THREE from 'three';
import { ConvexHull } from 'three/addons/math/ConvexHull.js';
import { place3, toThree, type Item, type Place3, type Vec3 } from './khoi';
import { R, type Figure, type Side } from './stickman';

// Kiểm người xuyên đồ ở tư thế hiện tại: người là các viên nang (chi, thân, đầu), đồ là khối lồi (hộp, món khối)
// hay lưới tam giác. Thuần: không đổi gì trên người hay đồ, gọi được ở từng `t` đã lấy mẫu sau `act`.

export type BodyPart = 'head' | 'torso' | 'upperArm' | 'foreArm' | 'thigh' | 'shin';
export const BODY_PARTS: readonly BodyPart[] = ['head', 'torso', 'upperArm', 'foreArm', 'thigh', 'shin'];

/** Một vật cản: khối lồi (`planes`, mặt phẳng pháp tuyến ra ngoài) hay lưới tam giác (`tris`, 9 số mỗi tam giác), toạ độ thế giới three */
export interface Collider {
  name: string;
  box: THREE.Box3;
  planes?: THREE.Plane[];
  tris?: Float32Array;
}

/** Một chỗ xuyên: `depth` là độ lún của nét vào vật (đơn vị three, ×100 ra px rig), `at` điểm sâu nhất trên trục nét */
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
}

type ColliderSource = THREE.Box3 | THREE.Object3D | Item | { points: readonly (THREE.Vector3 | Vec3)[] };

const isItem = (s: unknown): s is Item => !!s && typeof s === 'object' && 'at' in s && ('parts' in s || 'lathes' in s);

/** Khối lồi bao các điểm (three); `null` khi điểm dẹt không thành khối */
function convex(name: string, pts: THREE.Vector3[]): Collider | null {
  try {
    const hull = new ConvexHull().setFromPoints(pts);
    const planes = hull.faces.map((f) => new THREE.Plane(f.normal.clone(), -f.constant));
    if (planes.length < 4) return null;
    return { name, box: new THREE.Box3().setFromPoints(pts), planes };
  } catch {
    return null;
  }
}

const ring = (y: number, r: number, sx: number, sz: number, n = 12): Vec3[] =>
  Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * Math.PI * 2) * sx, y, r * Math.sin((i / n) * Math.PI * 2) * sz]);

/** Khối lồi của một món khối: mỗi khối tám đỉnh và mỗi khối tròn xoay một khối */
function itemColliders(item: Item, name: string): Collider[] {
  const out: Collider[] = [];
  const P = (at: Place3) => (p: Vec3) => toThree(place3(at, p));
  item.parts?.forEach((p) => {
    const c = convex(name, p.v.map(P(item.at)));
    if (c) out.push(c);
  });
  item.lathes?.forEach(({ spec, at }) => {
    const t = spec.tilt ?? 0, ct = Math.cos(t), st = Math.sin(t);
    const pts = spec.rings.flatMap(([y, r]) => ring(y, Math.max(r, 0.01), spec.sx ?? 1, spec.sz ?? 1)).map(([x, y, z]): Vec3 => [x * ct - y * st, x * st + y * ct, z]);
    const c = convex(name, pts.map(P(at)));
    if (c) out.push(c);
  });
  return out;
}

/** Tam giác thế giới của mọi mesh dưới `o`, trừ vỏ nét ngược và vật `noShadow` */
function meshCollider(o: THREE.Object3D, name: string): Collider | null {
  o.updateWorldMatrix(true, true);
  const tris: number[] = [];
  const v = new THREE.Vector3();
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh || m.userData.noShadow || (m.material as THREE.Material).side === THREE.BackSide) return;
    const pos = m.geometry.attributes.position, idx = m.geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m.matrixWorld);
      tris.push(v.x, v.y, v.z);
    }
  });
  if (!tris.length) return null;
  const arr = new Float32Array(tris);
  return { name, tris: arr, box: new THREE.Box3().setFromArray(arr) };
}

/**
 * Vật cản từ: `Box3` (thế giới three), món khối `Item` của `khoi` (từng khối lồi, chính xác), `{ points }` (bao lồi),
 * hay `Object3D` (mọi tam giác; dùng cho lưới đã gộp như đầu ra của `Batch`, chỉ bắt được nét cắt qua mặt).
 */
export function colliders(src: ColliderSource | readonly ColliderSource[], name = 'vat'): Collider[] {
  if (Array.isArray(src)) return src.flatMap((s, i) => colliders(s, `${name}${i}`));
  if (src instanceof THREE.Box3) {
    const { min: a, max: b } = src;
    const pts = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? b.x : a.x, i & 2 ? b.y : a.y, i & 4 ? b.z : a.z));
    return [convex(name, pts)].filter((c): c is Collider => !!c);
  }
  if (src instanceof THREE.Object3D) return [meshCollider(src, name)].filter((c): c is Collider => !!c);
  if (isItem(src)) return itemColliders(src, name);
  const pts = (src as { points: readonly (THREE.Vector3 | Vec3)[] }).points.map((p) => (p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(...p)));
  return [convex(name, pts)].filter((c): c is Collider => !!c);
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
      if (!m.isMesh || m.userData.noShadow || m.userData.limb) continue;
      m.geometry.computeBoundingBox();
      const b = m.geometry.boundingBox!.clone().applyMatrix4(m.matrix), s = b.getSize(new THREE.Vector3());
      if (s.x * s.y * s.z > vol) (vol = s.x * s.y * s.z), (best = b);
    }
    torsoDims.set(fig, (d = { box: best }));
  }
  return d.box;
}

/** Các viên nang của người ở tư thế hiện tại, thế giới three */
export function bodyCapsules(fig: Figure, parts: readonly BodyPart[] = BODY_PARTS): Capsule[] {
  fig.root.updateWorldMatrix(true, true);
  const k = fig.root.getWorldScale(new THREE.Vector3()).x;
  const out: Capsule[] = [];
  const want = new Set(parts);
  const seg = (j: THREE.Object3D, part: BodyPart, side: Side) => {
    const m = j.children.find((c) => c.userData.limb) as THREE.Mesh | undefined;
    if (!m) return;
    const a = j.getWorldPosition(new THREE.Vector3()), b = j.localToWorld(new THREE.Vector3(0, m.position.y * 2, 0));
    out.push({ part, side, a, b, r: R.limb * m.scale.x * k });
  };
  for (const s of [-1, 1] as const) {
    if (want.has('upperArm')) seg(fig.arms[s].shoulder, 'upperArm', s);
    if (want.has('foreArm')) seg(fig.arms[s].elbow, 'foreArm', s);
    if (want.has('thigh')) seg(fig.legs[s].hip, 'thigh', s);
    if (want.has('shin')) seg(fig.legs[s].knee, 'shin', s);
  }
  if (want.has('head')) {
    const c = fig.head.getWorldPosition(new THREE.Vector3());
    out.push({ part: 'head', a: c, b: c.clone(), r: R.head * k });
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

const _p = new THREE.Vector3();
/** Khoảng cách có dấu nhỏ nhất từ đoạn `a`–`b` tới khối lồi (âm là nằm trong), và điểm đạt được */
function segConvex(a: THREE.Vector3, b: THREE.Vector3, planes: THREE.Plane[]): [number, THREE.Vector3] {
  const f = (s: number) => {
    _p.lerpVectors(a, b, s);
    let d = -Infinity;
    for (const pl of planes) d = Math.max(d, pl.distanceToPoint(_p));
    return d;
  };
  let lo = 0, hi = 1;
  for (let i = 0; i < 40 && hi - lo > 1e-5; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (f(m1) <= f(m2)) hi = m2;
    else lo = m1;
  }
  const s = (lo + hi) / 2;
  return [f(s), new THREE.Vector3().lerpVectors(a, b, s)];
}

/** Khoảng cách hai đoạn thẳng và điểm trên đoạn đầu */
function segSeg(p1: THREE.Vector3, q1: THREE.Vector3, p2: THREE.Vector3, q2: THREE.Vector3): [number, THREE.Vector3] {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s = 0, t = 0;
  if (a < 1e-12 && e < 1e-12) return [p1.distanceTo(p2), p1.clone()];
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
  const c1 = p1.clone().addScaledVector(d1, s), c2 = p2.clone().addScaledVector(d2, t);
  return [c1.distanceTo(c2), c1];
}

const tri = new THREE.Triangle(), plane = new THREE.Plane(), line = new THREE.Line3(), hitP = new THREE.Vector3();
/** Độ lún của viên nang vào một tam giác: cắt qua mặt thì tính tới mút nét gần mặt hơn */
function capsuleTri(c: Capsule, A: THREE.Vector3, B: THREE.Vector3, C: THREE.Vector3): [number, THREE.Vector3] | null {
  tri.set(A, B, C);
  tri.getPlane(plane);
  const da = plane.distanceToPoint(c.a), db = plane.distanceToPoint(c.b);
  if (da * db < 0) {
    line.set(c.a, c.b);
    if (plane.intersectLine(line, hitP) && tri.containsPoint(hitP)) return [c.r + Math.min(Math.abs(da), Math.abs(db)), hitP.clone()];
  }
  let best: [number, THREE.Vector3] = [Infinity, c.a];
  for (const p of [c.a, c.b]) {
    const d = tri.closestPointToPoint(p, _p).distanceTo(p);
    if (d < best[0]) best = [d, p.clone()];
  }
  for (const [u, v] of [[A, B], [B, C], [C, A]]) {
    const r = segSeg(c.a, c.b, u, v);
    if (r[0] < best[0]) best = r;
  }
  return best[0] < c.r ? [c.r - best[0], best[1]] : null;
}

function capsuleCollider(c: Capsule, col: Collider): [number, THREE.Vector3] | null {
  const box = new THREE.Box3().setFromPoints([c.a, c.b]).expandByScalar(c.r);
  if (!box.intersectsBox(col.box)) return null;
  if (col.planes) {
    const [d, at] = segConvex(c.a, c.b, col.planes);
    return d < c.r ? [c.r - d, at] : null;
  }
  const t = col.tris!;
  let best: [number, THREE.Vector3] | null = null;
  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), tb = new THREE.Box3();
  for (let i = 0; i + 8 < t.length; i += 9) {
    A.fromArray(t, i), B.fromArray(t, i + 3), C.fromArray(t, i + 6);
    tb.makeEmpty().expandByPoint(A).expandByPoint(B).expandByPoint(C);
    if (!tb.intersectsBox(box)) continue;
    const h = capsuleTri(c, A, B, C);
    if (h && (!best || h[0] > best[0])) best = h;
  }
  return best;
}

/**
 * Chỗ người xuyên vật cản ở tư thế hiện tại: bộ phận nào, vật nào, lún bao sâu. Mỗi cặp (người, bộ phận, bên,
 * vật) một dòng, lấy chỗ sâu nhất. `figures` là mảng hay map tên → người; `people` thêm cặp người với người.
 */
export function collide(figures: readonly Figure[] | Record<string, Figure>, cols: readonly Collider[], o: CollideOptions = {}): Contact[] {
  const slack = o.slack ?? 0.01;
  const entries = Array.isArray(figures) ? figures.map((f, i) => [String(i), f] as const) : Object.entries(figures);
  const bodies = entries.map(([who, f]) => ({ who, caps: bodyCapsules(f, o.parts) }));
  const found = new Map<string, Contact>();
  const add = (who: string, c: Capsule, collider: string, h: [number, THREE.Vector3] | null) => {
    if (!h || h[0] <= slack) return;
    const key = `${who}|${c.part}|${c.side ?? ''}|${collider}`, cur = found.get(key);
    if (!cur || h[0] > cur.depth) found.set(key, { who, part: c.part, side: c.side, collider, depth: h[0], at: h[1] });
  };
  for (const { who, caps } of bodies) for (const c of caps) for (const col of cols) add(who, c, col.name, capsuleCollider(c, col));
  if (o.people)
    for (let i = 0; i < bodies.length; i++)
      for (let j = i + 1; j < bodies.length; j++)
        for (const c of bodies[i].caps)
          for (const d of bodies[j].caps) {
            const [dist, at] = segSeg(c.a, c.b, d.a, d.b);
            if (dist < c.r + d.r) add(bodies[i].who, c, `${bodies[j].who}.${d.part}${d.side ? (d.side < 0 ? 'R' : 'L') : ''}`, [c.r + d.r - dist, at]);
          }
  return [...found.values()].sort((a, b) => b.depth - a.depth);
}
