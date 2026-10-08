import * as THREE from 'three';
import { npr, type NprOptions } from './npr';

// Đồ khối của rig dựng thành mesh three. `box`, `bar`, `slab` theo @stickman/fx (packages/fx/src/solid.tsx),
// `place3` theo @stickman/rig (packages/rig/src/lens.ts). docs/10-lop-ve-code.md#đồ-khối của @stickman/rig.
//
// Thế giới rig: x phải, y xuống, z sâu vào cảnh, người cao ~430. Sang three đảo cả y lẫn z (một phép quay,
// không phải soi gương, nên chiều quấn tam giác giữ nguyên) và chia 100.
//
// Một món là `{ parts, lathes, at, k }`: `parts` khối lồi tám đỉnh toạ độ món, `lathes` các khối tròn xoay
// `{ spec, at }` tự mang chỗ đặt, `at` là `Place3`, `k` bề dày nét của món tính bằng đơn vị rig (cùng nghĩa `sw`
// chia cỡ món trên khung, mặc định 3) — chỉ dùng cho bề ngang vân.

export type Vec3 = [number, number, number];
export interface Place3 { at: Vec3; yaw?: number; s?: number }
/** Tông một khối: mặt ngửa `top`, mặt khác `lit`; `glow` là tự sáng. */
export interface Tone { top: string; lit: string; side?: string; glow?: boolean }
/** Vân trên mặt pháp tuyến `n`: mỗi đường `d` là một dải bề ngang `w` (× `k`). */
export interface Mark { n: Vec3; color: string; w?: number; d: Vec3[][] }
export interface Part { v: Vec3[]; tone: Tone; marks?: Mark[] }
export interface LatheSpec {
  rings: [y: number, r: number][];
  tone: Tone | Tone[];
  sx?: number;
  sz?: number;
  tilt?: number;
  top?: { color: string; w?: number; d: Vec3[][] }[];
  beads?: { color: string; w: number; d: [x: number, z: number][] }[];
}
export interface Item { parts?: Part[]; lathes?: { spec: LatheSpec; at: Place3; k?: number }[]; at: Place3; k?: number }

export const U = 0.01;
export const toThree = ([x, y, z]: Vec3) => new THREE.Vector3(x * U, -y * U, -z * U);

export function place3({ at, yaw = 0, s = 1 }: Place3, p: Vec3): Vec3 {
  const c = Math.cos(yaw), n = Math.sin(yaw);
  return [at[0] + s * (p[0] * c + p[2] * n), at[1] + s * p[1], at[2] + s * (-p[0] * n + p[2] * c)];
}

export const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): Vec3[] => [
  [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1],
  [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1],
];
export const bar = (a: Vec3, b: Vec3, hx: number, hz = hx): Vec3[] => {
  const q = (c: Vec3): Vec3[] => [[c[0] - hx, c[1], c[2] - hz], [c[0] + hx, c[1], c[2] - hz], [c[0] + hx, c[1], c[2] + hz], [c[0] - hx, c[1], c[2] + hz]];
  return [...q(a), ...q(b)];
};
export const slab = (pr: [number, number][], z0: number, z1: number): Vec3[] => [...pr.map(([x, y]): Vec3 => [x, y, z0]), ...pr.map(([x, y]): Vec3 => [x, y, z1])];

const FACES = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
const UP: Vec3 = [0, -1, 0];

type BatchMat = string | NprOptions;
interface Bucket { mat: NprOptions; pos: number[]; nrm: number[] }

/** Gom tam giác theo vật liệu: cả cảnh tĩnh chỉ còn vài chục lượt vẽ. */
export class Batch {
  base: NprOptions;
  groups = new Map<string, Bucket>();
  constructor(base: NprOptions = {}) {
    this.base = base;
  }
  bucket(mat: BatchMat) {
    const o = typeof mat === 'string' ? { color: mat } : mat;
    const key = JSON.stringify(o);
    let g = this.groups.get(key);
    if (!g) this.groups.set(key, (g = { mat: o, pos: [], nrm: [] }));
    return g;
  }
  /** Tam giác phẳng: các đỉnh liền nhau ba một, chung pháp tuyến `n`. */
  flat(mat: BatchMat, pts: THREE.Vector3[], n: THREE.Vector3) {
    const g = this.bucket(mat);
    for (const p of pts) g.pos.push(p.x, p.y, p.z), g.nrm.push(n.x, n.y, n.z);
  }
  geometry(mat: BatchMat, geo: THREE.BufferGeometry) {
    const g = this.bucket(mat), src = geo.index ? geo.toNonIndexed() : geo;
    const p = src.attributes.position.array, n = src.attributes.normal.array;
    for (let i = 0; i < p.length; i++) g.pos.push(p[i]), g.nrm.push(n[i]);
  }
  build({ shadow = true } = {}) {
    const out = new THREE.Group();
    for (const { mat, pos, nrm } of this.groups.values()) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      const m = new THREE.Mesh(geo, npr({ stipple: 0.08, stippleScale: 2.4, spread: true, ...this.base, ...mat }));
      m.castShadow = shadow;
      m.receiveShadow = true;
      if (!shadow) m.userData.noShadow = true;
      out.add(m);
    }
    return out;
  }
}

/** Điểm món → điểm three, và hướng món → hướng three (bỏ dời, bỏ cỡ). */
const placer = (at: Place3) => (p: Vec3) => toThree(place3(at, p));
const turner = (at: Place3) => (n: Vec3) => toThree(place3({ at: [0, 0, 0], yaw: at.yaw }, n)).normalize();

const newell = (q: THREE.Vector3[]) => {
  const n = new THREE.Vector3();
  q.forEach((a, i) => {
    const b = q[(i + 1) % q.length];
    n.x += (a.y - b.y) * (a.z + b.z);
    n.y += (a.z - b.z) * (a.x + b.x);
    n.z += (a.x - b.x) * (a.y + b.y);
  });
  return n;
};
const mean = (ps: THREE.Vector3[]) => ps.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / ps.length);

/** Mặt ngửa lên lấy `tone.top` (mặt món ăn trong khay, đất trong chậu khác hẳn màu thành), mặt khác lấy `tone.lit`; sáng tối để npr đổ. */
const faceColor = (tone: Tone, n: THREE.Vector3) => (n.y > 0.7 ? tone.top : tone.lit);
const toneMat = (tone: Tone, color: string): BatchMat => (tone.glow ? { color, emissive: 1, stipple: 0 } : color);

/** Vân: mỗi khúc là một dải mảnh nằm trên mặt, nhích ra theo pháp tuyến cho khỏi chìm vào mặt. */
function strips(batch: Batch, mat: BatchMat, lines: THREE.Vector3[][], n: THREE.Vector3, width: number) {
  const lift = n.clone().multiplyScalar(0.0015);
  for (const l of lines)
    for (let i = 0; i + 1 < l.length; i++) {
      const a = l[i].clone().add(lift), b = l[i + 1].clone().add(lift), e = b.clone().sub(a);
      if (e.lengthSq() < 1e-12) continue;
      const s = new THREE.Vector3().crossVectors(n, e).normalize().multiplyScalar(width / 2);
      const q = [a.clone().sub(s), b.clone().sub(s), b.clone().add(s), a.clone().add(s)];
      batch.flat(mat, [q[0], q[1], q[2], q[0], q[2], q[3]], n);
    }
}

export function addPart(batch: Batch, part: Part, at: Place3, k = 3) {
  const P = placer(at), v = part.v.map(P), c = mean(v);
  for (const f of FACES) {
    const q = f.map((i) => v[i]);
    const n = newell(q);
    if (n.lengthSq() < 1e-14) continue;
    n.normalize();
    if (n.dot(mean(q).sub(c)) < 0) q.reverse(), n.negate();
    batch.flat(toneMat(part.tone, faceColor(part.tone, n)), [q[0], q[1], q[2], q[0], q[2], q[3]], n);
  }
  const T = turner(at);
  for (const m of part.marks ?? []) strips(batch, m.color, m.d.map((l) => l.map(P)), T(m.n), (m.w ?? 0.5) * k * U * (at.s ?? 1));
}

/**
 * Khối tròn xoay của fx (`Lathe`: `rings` [y, r] từ đáy lên, `tone` một hay từng đai, `sx`/`sz`, `tilt`, `top`, `beads`) thành
 * `LatheGeometry`: mỗi đai một khúc, cộng nắp đáy và nắp đỉnh. Hệ lathe của three (trục y lên) sang hệ món bằng phép quay
 * (x, y, z) → (x, −y, −z), rồi kéo `sx`/`sz`, nghiêng `tilt` quanh trục z món, đặt bằng `place3`.
 */
export function addLathe(batch: Batch, spec: LatheSpec, at: Place3, k = 3) {
  const { rings, sx = 1, sz = 1, tilt = 0 } = spec;
  const tones = Array.isArray(spec.tone) ? spec.tone : rings.slice(1).map(() => spec.tone as Tone);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const R = ([x, y, z]: Vec3): Vec3 => [x * ct - y * st, x * st + y * ct, z];
  const P = placer(at), T = turner(at);
  const segs = Math.max(...rings.map(([, r]) => r)) * (at.s ?? 1) > 20 ? 32 : 20;
  const piece = (profile: [number, number][], mat: BatchMat) => {
    const g = new THREE.LatheGeometry(profile.map(([y, r]) => new THREE.Vector2(r, -y)), segs);
    const pos = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const w = P(R([v.x * sx, -v.y, -v.z * sz]));
      pos.setXYZ(i, w.x, w.y, w.z);
    }
    g.computeVertexNormals();
    batch.geometry(mat, g);
  };
  for (let j = 0; j + 1 < rings.length; j++) {
    const [y0, r0] = rings[j], [y1, r1] = rings[j + 1], t = tones[j];
    if (r0 === 0 && r1 === 0) continue;
    // bậc phẳng ngửa lên là mặt đỉnh
    piece([rings[j], rings[j + 1]], toneMat(t, y0 === y1 && r1 < r0 ? t.top : t.lit));
  }
  const [yb, rb] = rings[0], [yt, rt] = rings[rings.length - 1], tt = tones[tones.length - 1];
  if (rb > 0) piece([[yb, 0], [yb, rb]], toneMat(tones[0], tones[0].lit));
  if (rt > 0) piece([[yt, rt], [yt, 0]], toneMat(tt, tt.top));
  const n = T(R(UP));
  const onTop = ([x, , z]: Vec3, lift: number) => P(R([x * 1, yt - lift, z]));
  for (const m of spec.top ?? []) strips(batch, m.color, m.d.map((l) => l.map((p) => onTop(p, 0.3))), n, (m.w ?? 0.5) * k * U);
  for (const b of spec.beads ?? [])
    for (const [x, z] of b.d) {
      const c = onTop([x, 0, z], 0.6), r = (b.w * k * U) / 2;
      const s = new THREE.Vector3().crossVectors(n, Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
      const s2 = new THREE.Vector3().crossVectors(n, s);
      const rim = Array.from({ length: 9 }, (_, i) => c.clone().addScaledVector(s, r * Math.cos((i * Math.PI) / 4)).addScaledVector(s2, r * Math.sin((i * Math.PI) / 4)));
      for (let i = 0; i < 8; i++) batch.flat(b.color, [c, rim[i], rim[i + 1]], n);
    }
}

export function addItem(batch: Batch, item: Item) {
  const k = item.k ?? 3;
  for (const p of item.parts ?? []) addPart(batch, p, item.at, k);
  for (const l of item.lathes ?? []) addLathe(batch, l.spec, l.at, l.k ?? k);
}
