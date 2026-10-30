import { HAND_BONES, HAND_REST, handFrames, handVec, type HandFrame } from "./hand";
import { heldDistance } from "./heldFit";
import type { HeldItemSpec, HeldSeats, HeldShape } from "./heldItem";
import { add3, cross3, dot3, scale3, sub3, type V3 } from "./lens";

/**
 * Khối hình rig suy từ hình va chạm của món (`held/<món>.json` v2): mỗi phần (bỏ khối `detail` và quai `strap`) ra tấm, đĩa, trụ tiện,
 * thanh, hộp, mặt; nhóm cầm lấy loại nó cần. Khung món, đơn vị rig của món. docs/11-nhom-cam.md mục 2
 */

export type FeatureKind = "slab" | "disc" | "rod" | "lathe" | "box" | "face";
/** Tên mặt, tên cạnh: theo `top` (U), `front` (F) và `right = U × F` của món */
export type SideName = "top" | "bottom" | "front" | "back" | "left" | "right";
export type AlongName = "corner" | "low" | "mid" | "high";

export interface NamedDir {
  name: SideName;
  n: V3;
}

export interface SlabEdge {
  name: SideName;
  /** Pháp tuyến ngoài của cạnh, trong mặt tấm */
  m: V3;
  /** Giữa cạnh, giữa bề dày */
  at: V3;
  len: number;
}

export interface SlabFeature {
  kind: "slab";
  part: string;
  c: V3;
  half: V3;
  t: number;
  /** Pháp tuyến mặt lớn lệch U dưới 45° */
  lying: boolean;
  faces: [NamedDir, NamedDir];
  edges: SlabEdge[];
}

/** Trục `a` về phía U (đầu thấp `lo` ngược U); `ρ(θ) = cos θ · b0 + sin θ · b90` */
interface Axial {
  part: string;
  a: V3;
  lo: V3;
  c: V3;
  len: number;
  b0: V3;
  b90: V3;
}

export interface LatheFeature extends Axial {
  kind: "lathe";
  blocks: number[];
  /** Bán kính theo `s` (từ `lo`), tuyến tính từng khúc; hai điểm cùng `s` là bậc */
  profile: [number, number][];
  rMax: number;
  /** Đầu có khối `wall` */
  mouth?: "lo" | "hi";
}

export interface DiscFeature extends Axial {
  kind: "disc";
  radius: number;
  t: number;
  lying: boolean;
  faces: [NamedDir, NamedDir];
  /** Tên vành ở góc `0`, `90`, `180`, `270` */
  rim: [SideName, SideName, SideName, SideName];
}

export interface RodFeature extends Axial {
  kind: "rod";
  blocks: number[];
  r: number;
  R: number;
  /** Hướng của nửa cạnh dài `R` (thanh hộp) */
  wide?: V3;
  /** Khe sau thanh: từ mặt thanh tới phần còn lại của món, hẹp nhất quanh trục, rộng nhất dọc đoạn bám (`rodGap`) */
  gap: number;
}

export interface BoxFeature {
  kind: "box";
  part: string;
  c: V3;
  half: V3;
}

export interface FaceEdge {
  /** Tên theo hướng ra ngoài của cạnh trong khung món */
  name: SideName;
  /** Pháp tuyến của cạnh, nằm trong mặt, hướng vào trong mặt */
  inward: V3;
  /** Giữa cạnh */
  at: V3;
  len: number;
}

export interface FaceFeature {
  kind: "face";
  part: string;
  name: SideName;
  from: "box" | "lathe";
  c: V3;
  n: V3;
  u: V3;
  v: V3;
  half: [number, number];
  /** Bốn cạnh của mặt hộp; mặt tròn của trụ tiện không có cạnh */
  edges: FaceEdge[];
}

export type Feature =
  SlabFeature | DiscFeature | RodFeature | LatheFeature | BoxFeature | FaceFeature;

export interface PartGeom {
  name: string;
  grip: boolean;
  blocks: number[];
  min: V3;
  max: V3;
}

export interface ItemGeom {
  U: V3;
  F: V3;
  R: V3;
  /** `F` lấy từ `front` của món (không thì `F` là hướng tạm) */
  hasFront?: true;
  /** Hướng miệng (`lathe` có `wall` ở một đầu) */
  mouth?: V3;
  parts: PartGeom[];
  /** Hộp bao của các phần `grip: false` */
  blocked: { part: string; min: V3; max: V3; shape: HeldShape[] }[];
  features: Feature[];
  /** Chỗ treo của món (`seats`), cho nhóm `carry` */
  seats?: HeldSeats;
}

type GeomSpec = Pick<HeldItemSpec, "anchors" | "shape" | "front" | "top" | "parts" | "seats">;

const D2R = Math.PI / 180;
const PARALLEL = Math.cos(2 * D2R);
const COAXIAL = 0.1;
const SLAB_T = 0.25;
const SLAB_FILL = 0.5;
const DISC_LEN = 0.3;
const ROD_ASPECT = 3;
const ROD_LONG = 0.5;
const LYING = Math.cos(45 * D2R);
export const TOP_MOUTH_MAX = 10;
const EPS = 1e-6;

const len3 = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => scale3(a, 1 / (len3(a) || 1));
const perp = (v: V3, n: V3): V3 => sub3(v, scale3(n, dot3(v, n)));
const neg = (a: V3): V3 => [-a[0], -a[1], -a[2]];
const AXES: V3[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const angle = (a: V3, b: V3) => Math.acos(Math.max(-1, Math.min(1, dot3(unit(a), unit(b))))) / D2R;

interface Cyl {
  i: number;
  from: V3;
  to: V3;
  d: V3;
  L: number;
  r0: number;
  r1: number;
  rMax: number;
  wall: boolean;
  /** Bề dày thành ống (`wall`), `0` khi đặc */
  wt: number;
}

const cylOf = (b: HeldShape, i: number): Cyl | undefined => {
  if (!("cyl" in b)) return undefined;
  const from = [...b.from] as V3;
  const to = [...b.to] as V3;
  const r1 = b.r2 ?? b.cyl;
  return {
    i,
    from,
    to,
    d: unit(sub3(to, from)),
    L: len3(sub3(to, from)),
    r0: b.cyl,
    r1,
    rMax: Math.max(b.cyl, r1),
    wall: b.wall !== undefined,
    wt: b.wall ?? 0,
  };
};

function blockBox(b: HeldShape): [V3, V3] {
  if ("box" in b) {
    const c = (b.at ?? [0, 0, 0]) as V3;
    const h = scale3(b.box as V3, 0.5);
    return [sub3(c, h), add3(c, h)];
  }
  if ("ball" in b) {
    const c = (b.at ?? [0, 0, 0]) as V3;
    const h: V3 = [b.ball, b.ball, b.ball];
    return [sub3(c, h), add3(c, h)];
  }
  const y = cylOf(b, 0)!;
  const lo: V3 = [0, 0, 0];
  const hi: V3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    const e = Math.sqrt(Math.max(0, 1 - y.d[k] ** 2));
    lo[k] = Math.min(y.from[k] - y.r0 * e, y.to[k] - y.r1 * e);
    hi[k] = Math.max(y.from[k] + y.r0 * e, y.to[k] + y.r1 * e);
  }
  return [lo, hi];
}

/** Điểm xa nhất của khối theo hướng đơn vị `d`: `max dot(p, d)` */
function blockReach(b: HeldShape, d: V3): number {
  if ("box" in b) {
    const c = (b.at ?? [0, 0, 0]) as V3;
    return dot3(c, d) + b.box.reduce((sum, x, k) => sum + (Math.abs(d[k]) * x) / 2, 0);
  }
  if ("ball" in b) return dot3((b.at ?? [0, 0, 0]) as V3, d) + b.ball;
  const y = cylOf(b, 0)!;
  const e = Math.sqrt(Math.max(0, 1 - dot3(y.d, d) ** 2));
  return Math.max(dot3(y.from, d) + y.r0 * e, dot3(y.to, d) + y.r1 * e);
}

const unionBox = (boxes: [V3, V3][]): [V3, V3] => {
  const lo: V3 = [Infinity, Infinity, Infinity];
  const hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (const [a, b] of boxes)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], a[k]);
      hi[k] = Math.max(hi[k], b[k]);
    }
  return [lo, hi];
};

/** Hai trục song song (lệch ≤ 2°) và cách nhau ≤ `0,1 · r`, `r` bán kính lớn hơn */
function coaxial(p: { o: V3; d: V3; r: number }, q: { o: V3; d: V3; r: number }) {
  if (Math.abs(dot3(p.d, q.d)) < PARALLEL) return false;
  const gap = Math.max(len3(cross3(sub3(q.o, p.o), p.d)), len3(cross3(sub3(p.o, q.o), q.d)));
  return gap <= COAXIAL * Math.max(p.r, q.r) + EPS;
}
const cylLine = (y: Cyl) => ({ o: y.from, d: y.d, r: y.rMax });

/** Các nhóm khối `cyl` đồng trục (bắc cầu) */
function coaxialGroups(cyls: Cyl[]): Cyl[][] {
  const root = cyls.map((_, i) => i);
  const find = (i: number): number => (root[i] === i ? i : (root[i] = find(root[i])));
  for (let i = 0; i < cyls.length; i++)
    for (let j = i + 1; j < cyls.length; j++)
      if (coaxial(cylLine(cyls[i]), cylLine(cyls[j]))) root[find(j)] = find(i);
  const out = new Map<number, Cyl[]>();
  cyls.forEach((y, i) => out.set(find(i), [...(out.get(find(i)) ?? []), y]));
  return [...out.values()];
}

/** Trụ tiện của một phần: mọi khối `cyl` của phần cùng một nhóm đồng trục; không thì rỗng */
function latheBlocks(cyls: Cyl[]): Cyl[] {
  return cyls.length && coaxialGroups(cyls).length === 1 ? cyls : [];
}

const anchorDir = (spec: GeomSpec, d: string | readonly number[] | undefined): V3 | undefined => {
  if (d === undefined) return undefined;
  const v = typeof d === "string" ? spec.anchors[d]?.dir : d;
  return v && len3(v as V3) > EPS ? unit([...v] as V3) : undefined;
};

/** Hướng trục lấy về phía U; trục vuông góc U thì về F, rồi R */
function orient(a: V3, U: V3, F: V3, R: V3): V3 {
  for (const ref of [U, F, R]) {
    const s = dot3(a, ref);
    if (Math.abs(s) > EPS) return s < 0 ? neg(a) : a;
  }
  return a;
}

/** Gốc góc quanh trục: trục gần U thì `0` ở F, `90` ở R; trục xa U thì `0` ở U */
function radialBasis(a: V3, U: V3, F: V3, R: V3): { b0: V3; b90: V3 } {
  const refs = Math.abs(dot3(a, U)) > LYING ? [F, R, U] : [U, F, R];
  let b0: V3 = [0, 0, 0];
  for (const r of refs) {
    const p = perp(r, a);
    if (len3(p) > 1e-3) {
      b0 = unit(p);
      break;
    }
  }
  const p90 = perp(perp(R, a), b0);
  const b90 = len3(p90) > 1e-3 ? unit(p90) : unit(cross3(a, b0));
  return { b0, b90 };
}

/** Tên của hướng `v`: trục gần nhất trong U, F, R */
function sideName(v: V3, U: V3, F: V3, R: V3, only?: ("U" | "F" | "R")[]): SideName {
  const axes = { U, F, R } as const;
  const names = { U: ["top", "bottom"], F: ["front", "back"], R: ["right", "left"] } as const;
  let best: "U" | "F" | "R" = "U";
  let score = -1;
  for (const k of only ?? (["U", "F", "R"] as const)) {
    const s = Math.abs(dot3(v, axes[k]));
    if (s > score + EPS) {
      score = s;
      best = k;
    }
  }
  return names[best][dot3(v, axes[best]) >= 0 ? 0 : 1];
}

/** Nhóm trục khung món còn lại sau khi bỏ trục `face` */
const OTHER = { U: ["F", "R"], F: ["U", "R"], R: ["U", "F"] } as const;

function slabOf(part: string, lo: V3, hi: V3, U: V3, F: V3, R: V3): SlabFeature {
  const size = sub3(hi, lo);
  const half = scale3(size, 0.5);
  const c = add3(lo, half);
  const order = [0, 1, 2].sort((x, y) => size[x] - size[y] || x - y);
  const ni = order[0];
  const n = AXES[ni];
  const lying = Math.abs(dot3(n, U)) > LYING;
  const axes = { U, F, R } as const;
  const faceAx: "U" | "F" | "R" = lying
    ? "U"
    : Math.abs(dot3(n, F)) >= Math.abs(dot3(n, R))
      ? "F"
      : "R";
  const nUp = dot3(n, axes[faceAx]) >= 0 ? n : neg(n);
  const faces: [NamedDir, NamedDir] = [
    { name: sideName(nUp, U, F, R, [faceAx]), n: nUp },
    { name: sideName(neg(nUp), U, F, R, [faceAx]), n: neg(nUp) },
  ];
  const [i1, i2] = [order[1], order[2]].sort((x, y) => x - y);
  const [X1, X2] = OTHER[faceAx];
  const straight = Math.abs(dot3(AXES[i1], axes[X1])) + Math.abs(dot3(AXES[i2], axes[X2]));
  const swapped = Math.abs(dot3(AXES[i1], axes[X2])) + Math.abs(dot3(AXES[i2], axes[X1]));
  const pairs: [number, "U" | "F" | "R"][] =
    straight >= swapped
      ? [
          [i1, X1],
          [i2, X2],
        ]
      : [
          [i1, X2],
          [i2, X1],
        ];
  const edges: SlabEdge[] = [];
  for (const [i, X] of pairs) {
    const other = i === i1 ? i2 : i1;
    for (const sg of [1, -1]) {
      const m = scale3(AXES[i], sg);
      edges.push({
        name: sideName(m, U, F, R, [X]),
        m,
        at: add3(c, scale3(m, half[i])),
        len: size[other],
      });
    }
  }
  return { kind: "slab", part, c, half, t: size[ni], lying, faces, edges };
}

/** Bốn cạnh của mặt chữ nhật `(c, u, v, half)`; tên cạnh theo trục khung món nằm trong mặt */
function faceEdges(c: V3, n: V3, u: V3, v: V3, half: [number, number], U: V3, F: V3, R: V3) {
  const axes = { U, F, R } as const;
  const ax = (["U", "F", "R"] as const).reduce((b, k) =>
    Math.abs(dot3(n, axes[k])) > Math.abs(dot3(n, axes[b])) + EPS ? k : b,
  );
  const [X1, X2] = OTHER[ax];
  const straight = Math.abs(dot3(u, axes[X1])) + Math.abs(dot3(v, axes[X2]));
  const swapped = Math.abs(dot3(u, axes[X2])) + Math.abs(dot3(v, axes[X1]));
  const pairs: [V3, "U" | "F" | "R", number][] =
    straight >= swapped
      ? [
          [u, X1, 0],
          [v, X2, 1],
        ]
      : [
          [u, X2, 0],
          [v, X1, 1],
        ];
  const out: FaceEdge[] = [];
  for (const [d, X, i] of pairs)
    for (const sg of [1, -1]) {
      const m = scale3(d, sg);
      out.push({
        name: sideName(m, U, F, R, [X]),
        inward: neg(m),
        at: add3(c, scale3(m, half[i])),
        len: 2 * half[1 - i],
      });
    }
  return out;
}

function boxFaces(part: string, lo: V3, hi: V3, U: V3, F: V3, R: V3): FaceFeature[] {
  const half = scale3(sub3(hi, lo), 0.5);
  const c = add3(lo, half);
  const out: FaceFeature[] = [];
  for (let i = 0; i < 3; i++) {
    const [j, k] = [0, 1, 2].filter((x) => x !== i);
    for (const sg of [1, -1]) {
      const n = scale3(AXES[i], sg);
      const fc = add3(c, scale3(n, half[i]));
      out.push({
        kind: "face",
        part,
        name: sideName(n, U, F, R),
        from: "box",
        c: fc,
        n,
        u: AXES[j],
        v: AXES[k],
        half: [half[j], half[k]],
        edges: faceEdges(fc, n, AXES[j], AXES[k], [half[j], half[k]], U, F, R),
      });
    }
  }
  return out;
}

interface RawLathe {
  a: V3;
  lo: V3;
  len: number;
  /** Khúc của từng khối: `s` (từ `lo`) và bán kính hai đầu */
  segs: { i: number; s0: number; r0: number; s1: number; r1: number; wall: boolean; wt: number }[];
}

function rawLathe(cyls: Cyl[], a0: V3): RawLathe {
  const ref = cyls[0].d;
  let sum: V3 = [0, 0, 0];
  for (const y of cyls) sum = add3(sum, dot3(y.d, ref) < 0 ? neg(y.d) : y.d);
  const a = dot3(unit(sum), a0) < 0 ? neg(unit(sum)) : unit(sum);
  let c: V3 = [0, 0, 0];
  for (const y of cyls) c = add3(c, add3(y.from, y.to));
  c = scale3(c, 1 / (2 * cyls.length));
  const raw = cyls.map((y) => {
    const sf = dot3(sub3(y.from, c), a);
    const st = dot3(sub3(y.to, c), a);
    return sf <= st
      ? { i: y.i, s0: sf, r0: y.r0, s1: st, r1: y.r1, wall: y.wall, wt: y.wt }
      : { i: y.i, s0: st, r0: y.r1, s1: sf, r1: y.r0, wall: y.wall, wt: y.wt };
  });
  const sMin = Math.min(...raw.map((g) => g.s0));
  const sMax = Math.max(...raw.map((g) => g.s1));
  const segs = raw.map((g) => ({ ...g, s0: g.s0 - sMin, s1: g.s1 - sMin }));
  return { a, lo: add3(c, scale3(a, sMin)), len: sMax - sMin, segs };
}

const touchTol = (l: RawLathe) => 1e-4 * Math.max(1, l.len);

function mouthOf(l: RawLathe): "lo" | "hi" | undefined {
  const tol = touchTol(l);
  const lo = l.segs.some((g) => g.wall && g.s0 <= tol);
  const hi = l.segs.some((g) => g.wall && g.s1 >= l.len - tol);
  return lo === hi ? undefined : lo ? "lo" : "hi";
}

function profileOf(l: RawLathe): [number, number][] {
  const at = (g: RawLathe["segs"][number], s: number) =>
    g.s1 - g.s0 < EPS ? Math.max(g.r0, g.r1) : g.r0 + ((g.r1 - g.r0) * (s - g.s0)) / (g.s1 - g.s0);
  const ss = [...new Set(l.segs.flatMap((g) => [g.s0, g.s1]))].sort((x, y) => x - y);
  const out: [number, number][] = [];
  ss.forEach((s, k) => {
    const left = l.segs.filter((g) => g.s0 < s - EPS && g.s1 >= s - EPS).map((g) => at(g, s));
    const right = l.segs.filter((g) => g.s0 <= s + EPS && g.s1 > s + EPS).map((g) => at(g, s));
    const rl = left.length ? Math.max(...left) : 0;
    const rr = right.length ? Math.max(...right) : 0;
    if (k > 0) out.push([s, rl]);
    if (k === 0 || (k < ss.length - 1 && Math.abs(rr - rl) > EPS)) out.push([s, rr]);
  });
  return out;
}

/** Bán kính của trụ tiện ở `s` (từ đầu thấp) */
export function latheRadius(l: LatheFeature, s: number): number {
  const p = l.profile;
  if (s <= p[0][0]) return p[0][1];
  for (let k = 1; k < p.length; k++) {
    const [s0, r0] = p[k - 1];
    const [s1, r1] = p[k];
    if (s <= s1) return s1 - s0 < EPS ? r1 : r0 + ((r1 - r0) * (s - s0)) / (s1 - s0);
  }
  return p[p.length - 1][1];
}

/** Hướng bán kính `ρ(θ)` quanh trục của trụ, thanh, đĩa; `θ` độ */
export const radialDir = (f: Pick<Axial, "b0" | "b90">, deg: number): V3 =>
  add3(scale3(f.b0, Math.cos(deg * D2R)), scale3(f.b90, Math.sin(deg * D2R)));

/** Hướng miệng của món: trụ tiện đầu tiên có `wall` ở đúng một đầu */
function mouthDir(spec: GeomSpec): V3 | undefined {
  for (const p of partsOf(spec)) {
    const cyls = p.blocks.map((i) => cylOf(spec.shape![i], i)).filter((y): y is Cyl => !!y);
    const g = latheBlocks(cyls);
    if (!g.length) continue;
    const l = rawLathe(g, g[0].d);
    const m = mouthOf(l);
    if (m) return m === "hi" ? l.a : neg(l.a);
  }
  return undefined;
}

/** Miệng của món suy từ hình: tâm đầu có `wall`, bán kính trong (bán kính ngoài trừ `wall`), hướng ra, phần mang nó */
export interface ItemMouth {
  part: string;
  at: V3;
  r: number;
  dir: V3;
}

/** Mọi miệng suy được của món: mỗi phần có trụ tiện với khối `wall` ở đúng một đầu (docs/13 mục 3.2) */
export function itemMouths(spec: GeomSpec): ItemMouth[] {
  const out: ItemMouth[] = [];
  for (const p of partsOf(spec)) {
    const cyls = p.blocks.map((i) => cylOf(spec.shape![i], i)).filter((y): y is Cyl => !!y);
    const g = latheBlocks(cyls);
    if (!g.length) continue;
    const l = rawLathe(g, g[0].d);
    const m = mouthOf(l);
    if (!m) continue;
    const tol = touchTol(l);
    const end = l.segs
      .filter((s) => (m === "hi" ? s.s1 >= l.len - tol : s.s0 <= tol))
      .map((s) => ({ r: m === "hi" ? s.r1 : s.r0, wt: s.wt }));
    const outer = end.reduce((a, b) => (b.r > a.r ? b : a));
    const wt = Math.max(...end.filter((e) => e.wt > 0).map((e) => e.wt));
    out.push({
      part: p.name,
      at: add3(l.lo, scale3(l.a, m === "hi" ? l.len : 0)),
      r: outer.r - (outer.wt || wt),
      dir: m === "hi" ? l.a : neg(l.a),
    });
  }
  return out;
}

function partsOf(spec: GeomSpec): PartGeom[] {
  const by = new Map<string, number[]>();
  (spec.shape ?? []).forEach((b, i) => {
    const name = b.part ?? "body";
    if (b.detail || spec.parts?.[name]?.strap) return;
    by.set(name, [...(by.get(name) ?? []), i]);
  });
  return [...by].map(([name, blocks]) => {
    const [min, max] = unionBox(blocks.map((i) => blockBox(spec.shape![i])));
    return { name, grip: spec.parts?.[name]?.grip !== false, blocks, min, max };
  });
}

function frameOf(spec: GeomSpec): { U: V3; F: V3; R: V3; mouth?: V3; hasFront: boolean } {
  const mouth = mouthDir(spec);
  const U = anchorDir(spec, spec.top) ?? mouth ?? [0, 1, 0];
  const front = anchorDir(spec, spec.front);
  let F = perp(front ?? [0, 0, 1], U);
  const hasFront = !!front && len3(F) >= 1e-3;
  if (len3(F) < 1e-3)
    F = perp(
      AXES.reduce((b, x) => (Math.abs(dot3(x, U)) < Math.abs(dot3(b, U)) ? x : b)),
      U,
    );
  F = unit(F);
  return { U, F, R: unit(cross3(U, F)), mouth, hasFront };
}

function axialOf(part: string, a: V3, lo: V3, len: number, U: V3, F: V3, R: V3): Axial {
  return { part, a, lo, len, c: add3(lo, scale3(a, len / 2)), ...radialBasis(a, U, F, R) };
}

function latheFeature(part: string, l: RawLathe, U: V3, F: V3, R: V3): LatheFeature {
  const profile = profileOf(l);
  const mouth = mouthOf(l);
  return {
    kind: "lathe",
    ...axialOf(part, l.a, l.lo, l.len, U, F, R),
    blocks: l.segs.map((g) => g.i),
    profile,
    rMax: Math.max(...profile.map((p) => p[1])),
    ...(mouth ? { mouth } : {}),
  };
}

function discFeature(l: LatheFeature, U: V3, F: V3, R: V3): DiscFeature {
  const lying = Math.abs(dot3(l.a, U)) > LYING;
  const faceAx: "U" | "F" | "R" = lying
    ? "U"
    : Math.abs(dot3(l.a, F)) >= Math.abs(dot3(l.a, R))
      ? "F"
      : "R";
  const nUp = dot3(l.a, { U, F, R }[faceAx]) >= 0 ? l.a : neg(l.a);
  const name = (v: V3, only: ("U" | "F" | "R")[]) => sideName(v, U, F, R, only);
  return {
    kind: "disc",
    part: l.part,
    a: l.a,
    lo: l.lo,
    c: l.c,
    len: l.len,
    b0: l.b0,
    b90: l.b90,
    radius: l.rMax,
    t: l.len,
    lying,
    faces: [
      { name: name(nUp, [faceAx]), n: nUp },
      { name: name(neg(nUp), [faceAx]), n: neg(nUp) },
    ],
    rim: [0, 90, 180, 270].map((q) =>
      name(radialDir(l, q), [...OTHER[faceAx]]),
    ) as DiscFeature["rim"],
  };
}

/** Mặt đáy hở ra ngoài của trụ tiện: đầu không có khối `cyl` đồng trục nào nối tiếp, không phải miệng */
function latheEnds(l: LatheFeature, others: Cyl[], U: V3, F: V3, R: V3): FaceFeature[] {
  const tol = 1e-4 * Math.max(1, l.len);
  const out: FaceFeature[] = [];
  const mine = new Set(l.blocks);
  for (const end of ["lo", "hi"] as const) {
    if (l.mouth === end) continue;
    const s = end === "lo" ? 0 : l.len;
    const r = l.profile[end === "lo" ? 0 : l.profile.length - 1][1];
    if (r < EPS) continue;
    const p = add3(l.lo, scale3(l.a, s));
    const covered = others.some(
      (y) =>
        !mine.has(y.i) &&
        coaxial({ o: l.lo, d: l.a, r: l.rMax }, cylLine(y)) &&
        Math.min(...[y.from, y.to].map((q) => Math.abs(dot3(sub3(q, p), l.a)))) <= tol,
    );
    if (covered) continue;
    const n = end === "lo" ? neg(l.a) : l.a;
    out.push({
      kind: "face",
      part: l.part,
      name: sideName(n, U, F, R),
      from: "lathe",
      c: p,
      n,
      u: l.b0,
      v: l.b90,
      half: [r, r],
      edges: [],
    });
  }
  return out;
}

/** Thanh từ một khối hộp: tiết diện `a ≤ b`, `b / a ≤ 3`, `b ≤ 0,5 ×` cạnh dài */
function boxRod(
  part: string,
  b: HeldShape,
  i: number,
  U: V3,
  F: V3,
  R: V3,
  force = false,
): RodFeature | undefined {
  if (!("box" in b)) return undefined;
  const s = b.box;
  const [ia, ib, il] = [0, 1, 2].sort((x, y) => s[x] - s[y] || x - y);
  if (!force && !(s[ib] <= ROD_ASPECT * s[ia] && s[ib] <= ROD_LONG * s[il])) return undefined;
  const a = orient(AXES[il], U, F, R);
  const c = (b.at ?? [0, 0, 0]) as V3;
  return {
    kind: "rod",
    ...axialOf(part, a, sub3(c, scale3(a, s[il] / 2)), s[il], U, F, R),
    blocks: [i],
    r: s[ia] / 2,
    R: s[ib] / 2,
    wide: AXES[ib],
    gap: Infinity,
  };
}

/** Thanh ép (`as: "rod"`): hộp bao của phần chiếu lên `axis` */
function forcedRod(p: PartGeom, axis: V3, U: V3, F: V3, R: V3): RodFeature {
  const a = orient(axis, U, F, R);
  const { b0, b90 } = radialBasis(a, U, F, R);
  const corners: V3[] = [];
  for (let k = 0; k < 8; k++)
    corners.push([0, 1, 2].map((d) => ((k >> d) & 1 ? p.max[d] : p.min[d])) as V3);
  const span = (d: V3) => {
    const v = corners.map((q) => dot3(q, d));
    return [Math.min(...v), Math.max(...v)] as const;
  };
  const [s0, s1] = span(a);
  const [u0, u1] = span(b0);
  const [v0, v1] = span(b90);
  const mid = add3(scale3(b0, (u0 + u1) / 2), scale3(b90, (v0 + v1) / 2));
  const lo = add3(mid, scale3(a, s0));
  const [ru, rv] = [(u1 - u0) / 2, (v1 - v0) / 2];
  return {
    kind: "rod",
    part: p.name,
    a,
    lo,
    len: s1 - s0,
    c: add3(lo, scale3(a, (s1 - s0) / 2)),
    b0,
    b90,
    blocks: p.blocks,
    r: Math.min(ru, rv),
    R: Math.max(ru, rv),
    wide: ru >= rv ? b0 : b90,
    gap: Infinity,
  };
}

/** Tỉ lệ hộp bao do các khối của phần lấp đầy (lấy mẫu lưới, tất định) */
function fillRatio(blocks: HeldShape[], lo: V3, hi: V3): number {
  const n = 20;
  const inside = (b: HeldShape, p: V3): boolean => {
    if ("box" in b) {
      const c = (b.at ?? [0, 0, 0]) as V3;
      return [0, 1, 2].every((k) => Math.abs(p[k] - c[k]) <= b.box[k] / 2);
    }
    if ("ball" in b) return len3(sub3(p, (b.at ?? [0, 0, 0]) as V3)) <= b.ball;
    const y = cylOf(b, 0)!;
    const s = dot3(sub3(p, y.from), y.d);
    if (s < 0 || s > y.L) return false;
    return len3(perp(sub3(p, y.from), y.d)) <= y.r0 + ((y.r1 - y.r0) * s) / y.L;
  };
  let hit = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      for (let k = 0; k < n; k++) {
        const p = [i, j, k].map((q, d) => lo[d] + ((q + 0.5) / n) * (hi[d] - lo[d])) as V3;
        if (blocks.some((b) => inside(b, p))) hit++;
      }
  return hit / n ** 3;
}

const CACHE = new WeakMap<object, ItemGeom>();

/** Khối hình của món (nhớ theo object spec). docs/11-nhom-cam.md#khối-hình-rig-suy-ra-itemgeom */
export function itemGeom(spec: GeomSpec): ItemGeom {
  const hit = CACHE.get(spec);
  if (hit) return hit;
  const { U, F, R, mouth, hasFront } = frameOf(spec);
  const shape = spec.shape ?? [];
  const parts = partsOf(spec);
  const allCyls = parts
    .flatMap((p) => p.blocks)
    .map((i) => cylOf(shape[i], i))
    .filter((y): y is Cyl => !!y);
  const features: Feature[] = [];
  for (const p of parts) {
    if (!p.grip) continue;
    const as = spec.parts?.[p.name]?.as;
    const axis = anchorDir(spec, spec.parts?.[p.name]?.axis);
    const size = sub3(p.max, p.min);
    const [t, mid] = [...size].sort((x, y) => x - y);
    if (
      as === "slab" ||
      (as === undefined &&
        t <= SLAB_T * mid &&
        (p.blocks.length < 2 ||
          fillRatio(
            p.blocks.map((i) => shape[i]),
            p.min,
            p.max,
          ) >= SLAB_FILL))
    )
      features.push(slabOf(p.name, p.min, p.max, U, F, R));
    const cyls = p.blocks.map((i) => cylOf(shape[i], i)).filter((y): y is Cyl => !!y);
    const lb = as === undefined ? latheBlocks(cyls) : as === "lathe" || as === "disc" ? cyls : [];
    const lathes = lb.length
      ? [latheFeature(p.name, rawLathe(lb, orient(axis ?? lb[0].d, U, F, R)), U, F, R)]
      : [];
    const rods: RodFeature[] = [];
    if (as === undefined && !lb.length)
      for (const y of cyls)
        if (2 * y.rMax <= ROD_LONG * y.L) {
          const a = orient(y.d, U, F, R);
          const lo = dot3(sub3(y.to, y.from), a) < 0 ? y.to : y.from;
          rods.push({
            kind: "rod",
            ...axialOf(p.name, a, lo, y.L, U, F, R),
            blocks: [y.i],
            r: y.rMax,
            R: y.rMax,
            gap: Infinity,
          });
        }
    for (const l of lathes)
      if (as === "disc" || (as === undefined && l.len <= DISC_LEN * l.rMax))
        features.push(discFeature(l, U, F, R));
    features.push(...lathes);
    if (as === undefined)
      p.blocks.forEach((i) => {
        const r = boxRod(p.name, shape[i], i, U, F, R);
        if (r) rods.push(r);
      });
    if (as === "rod" && axis) rods.push(forcedRod(p, axis, U, F, R));
    features.push(...rods);
    features.push({
      kind: "box",
      part: p.name,
      c: scale3(add3(p.min, p.max), 0.5),
      half: scale3(size, 0.5),
    });
    features.push(...boxFaces(p.name, p.min, p.max, U, F, R));
    for (const l of lathes) features.push(...latheEnds(l, allCyls, U, F, R));
  }
  const geom: ItemGeom = {
    U,
    F,
    R,
    ...(hasFront ? { hasFront: true as const } : {}),
    ...(mouth ? { mouth } : {}),
    parts,
    blocked: parts
      .filter((p) => !p.grip)
      .map((p) => ({ part: p.name, min: p.min, max: p.max, shape: p.blocks.map((i) => shape[i]) })),
    features,
    ...(spec.seats && (spec.seats.elbow || spec.seats.shoulder) ? { seats: spec.seats } : {}),
  };
  for (const f of features) if (f.kind === "rod") f.gap = rodGap(geom, f, shape);
  CACHE.set(spec, geom);
  return geom;
}

/** Lỗi của món: `top` lệch hướng miệng quá `10°` (một trục, một nguồn) */
export function topProblems(spec: GeomSpec): string[] {
  const top = anchorDir(spec, spec.top);
  const mouth = mouthDir(spec);
  if (!top || !mouth) return [];
  const d = angle(top, mouth);
  return d > TOP_MOUTH_MAX
    ? [
        `\`top\` lệch hướng miệng ${d.toFixed(1)}° (quá ${TOP_MOUTH_MAX}°): món có miệng lấy đầu trên từ miệng, bỏ \`top\``,
      ]
    : [];
}

export interface EdgeFrame {
  /** Pháp tuyến ngoài của cạnh trong mặt tấm (đĩa: hướng bán kính) */
  m: V3;
  /** Dọc cạnh, về đầu cao */
  e: V3;
  /** Pháp tuyến mặt có ngón cái */
  F: V3;
  /** Giữa cạnh, giữa bề dày */
  at: V3;
  /** Dài cạnh; vành đĩa là `0` */
  len: number;
}

/**
 * Khung cạnh của tấm (cạnh có tên) hay đĩa (tên hay góc, độ); `thumb` là tên mặt có ngón cái. `e` mặc định `m × F`,
 * `high` (khung món) lật `e` về đầu cao
 */
export function edgeFrame(
  f: SlabFeature | DiscFeature,
  edge: SideName | number,
  thumb: SideName,
  high?: V3,
): EdgeFrame {
  const face = f.faces.find((x) => x.name === thumb);
  if (!face)
    throw new Error(
      `mặt \`${thumb}\` không có ở ${f.kind === "slab" ? "tấm" : "đĩa"} \`${f.part}\`; mặt: ${f.faces.map((x) => x.name).join(", ")}`,
    );
  let m: V3;
  let at: V3;
  let len: number;
  if (f.kind === "slab") {
    const ed = typeof edge === "string" ? f.edges.find((x) => x.name === edge) : undefined;
    if (!ed)
      throw new Error(
        `tấm \`${f.part}\` không có cạnh \`${edge}\`; cạnh: ${f.edges.map((x) => x.name).join(", ")}`,
      );
    ({ m, at, len } = ed);
  } else {
    const deg = typeof edge === "number" ? edge : 90 * f.rim.indexOf(edge);
    if (typeof edge === "string" && deg < 0)
      throw new Error(
        `đĩa \`${f.part}\` không có cạnh \`${edge}\`; cạnh: ${f.rim.join(", ")} hay góc`,
      );
    m = radialDir(f, deg);
    at = add3(f.c, scale3(m, f.radius));
    len = 0;
  }
  const e0 = unit(cross3(m, face.n));
  const e = high && dot3(e0, high) < 0 ? neg(e0) : e0;
  return { m, e, F: face.n, at, len };
}

/** Vị trí dọc cạnh, tỉ lệ từ đầu thấp: `corner` nửa bàn tay `W`, `low` 0,25, `mid` 0,5, `high` 0,75 */
export function alongFrac(along: AlongName | number, len: number, W: number): number {
  const f =
    typeof along === "number"
      ? along
      : along === "corner"
        ? W / 2 / Math.max(len, EPS)
        : { low: 0.25, mid: 0.5, high: 0.75 }[along];
  return Math.min(1, Math.max(0, f));
}

/** Điểm ở tỉ lệ `frac` từ đầu thấp của cạnh */
export const edgePoint = (fr: EdgeFrame, frac: number): V3 =>
  add3(fr.at, scale3(fr.e, (frac - 0.5) * fr.len));

export interface GripSegment {
  lo: V3;
  hi: V3;
  len: number;
  parts: string[];
  /** Phần `grip: false` cắt đầu thấp, đầu cao của đoạn; không có là đầu của chính khối */
  cut: [string | undefined, string | undefined];
}

type Line = { part: string; o: V3; a: V3; s0: number; s1: number; r: number };

const lineOf = (f: Feature): Line | undefined =>
  f.kind === "rod"
    ? { part: f.part, o: f.lo, a: f.a, s0: 0, s1: f.len, r: f.R }
    : f.kind === "lathe"
      ? { part: f.part, o: f.lo, a: f.a, s0: 0, s1: f.len, r: f.rMax }
      : f.kind === "disc"
        ? { part: f.part, o: f.lo, a: f.a, s0: 0, s1: f.len, r: f.radius }
        : undefined;

/** Khoảng `s` dọc trục mà hộp (nở `pad`) chạm vào ống bán kính `r` quanh trục */
function boxSpan(min: V3, max: V3, o: V3, a: V3, r: number, pad: number) {
  const corners: V3[] = [];
  for (let k = 0; k < 8; k++)
    corners.push([0, 1, 2].map((d) => ((k >> d) & 1 ? max[d] + pad : min[d] - pad)) as V3);
  const c = scale3(add3(min, max), 0.5);
  const off = (q: V3) => len3(perp(sub3(q, o), a));
  const reach = Math.max(...corners.map((q) => len3(perp(sub3(q, c), a))));
  if (off(c) > r + reach) return undefined;
  const s = corners.map((q) => dot3(sub3(q, o), a));
  return [Math.min(...s), Math.max(...s)] as const;
}

/**
 * Đoạn bám liền của một khối hình: thanh, trụ tiện, đĩa nối với các khối đồng trục kề nó (qua phần), tấm theo một cạnh;
 * trừ hộp bao các phần `grip: false` nở `pad` (một bán kính ngón)
 */
export function gripSpan(
  geom: ItemGeom,
  f: Feature,
  opts: { edge?: SideName; pad?: number } = {},
): GripSegment[] {
  const pad = opts.pad ?? 0;
  let base: Line;
  let chain: Line[];
  if (f.kind === "slab") {
    const ed = f.edges.find((x) => x.name === opts.edge);
    if (!ed)
      throw new Error(
        `\`gripSpan\` của tấm cần \`edge\` (${f.edges.map((x) => x.name).join(", ")})`,
      );
    const a = unit(cross3(ed.m, f.faces[0].n));
    base = {
      part: f.part,
      o: sub3(ed.at, scale3(a, ed.len / 2)),
      a,
      s0: 0,
      s1: ed.len,
      r: f.t / 2,
    };
    chain = [base];
  } else {
    const own = lineOf(f);
    if (!own) throw new Error(`\`gripSpan\` không đo được khối \`${f.kind}\``);
    base = own;
    const lines = geom.features
      .map(lineOf)
      .filter(
        (l): l is Line =>
          !!l && coaxial({ o: base.o, d: base.a, r: base.r }, { o: l.o, d: l.a, r: l.r }),
      )
      .map((l) => {
        const s = [l.s0, l.s1].map((x) => dot3(sub3(add3(l.o, scale3(l.a, x)), base.o), base.a));
        return { ...l, s0: Math.min(...s), s1: Math.max(...s) };
      });
    chain = [base];
    let [s0, s1] = [base.s0, base.s1];
    const tol = 1e-4 * Math.max(1, s1 - s0);
    for (let grew = true; grew;) {
      grew = false;
      for (const l of lines)
        if (!chain.includes(l) && l.s0 <= s1 + tol && l.s1 >= s0 - tol) {
          chain.push(l);
          [s0, s1] = [Math.min(s0, l.s0), Math.max(s1, l.s1)];
          grew = true;
        }
    }
    base = { ...base, s0, s1 };
  }
  // hộp chạm sát đầu đoạn (miệng chai nối cổ) cũng là cắt
  const TOUCH_TOL = 1e-4 * Math.max(1, base.s1 - base.s0);
  type Seg = [number, number, string | undefined, string | undefined];
  let segs: Seg[] = [[base.s0, base.s1, undefined, undefined]];
  for (const b of geom.blocked) {
    const cut = boxSpan(b.min, b.max, base.o, base.a, base.r, pad);
    if (!cut) continue;
    segs = segs.flatMap(([x, y, p, q]): Seg[] =>
      (
        [
          [x, Math.min(y, cut[0]), p, y >= cut[0] - TOUCH_TOL ? b.part : q],
          [Math.max(x, cut[1]), y, x <= cut[1] + TOUCH_TOL ? b.part : p, q],
        ] as Seg[]
      ).filter(([u, v]) => v - u > EPS),
    );
  }
  return segs.map(([x, y, p, q]) => ({
    lo: add3(base.o, scale3(base.a, x)),
    hi: add3(base.o, scale3(base.a, y)),
    len: y - x,
    parts: [
      ...new Set(
        chain
          .filter((l) => Math.min(y, l.s1) - Math.max(x, l.s0) > EPS)
          .sort((p, q) => p.s0 - q.s0)
          .map((l) => l.part),
      ),
    ],
    cut: [p, q],
  }));
}

/**
 * Miền `along` (tỉ lệ của đoạn `seg`) mà điểm trên trục cách đầu bị phần `grip: false` cắt ít nhất `clear`; đầu của chính
 * khối không giữ khoảng. Đoạn ngắn quá thì `undefined`
 */
export function alongRoom(seg: GripSegment, clear: number): [number, number] | undefined {
  const L = Math.max(seg.len, EPS);
  const lo = seg.cut[0] !== undefined ? clear / L : 0;
  const hi = seg.cut[1] !== undefined ? 1 - clear / L : 1;
  return lo <= hi + 1e-12 ? [lo, Math.max(lo, hi)] : undefined;
}

export interface AxialPoint {
  /** Điểm trên trục */
  at: V3;
  /** Trục, về phía U */
  a: V3;
  /** Hướng bán kính `ρ(θ)` */
  rho: V3;
  /** Trục tới mặt món theo `ρ`: `r(s)` của trụ tiện, `r` của thanh tròn, tới mặt tiết diện của thanh hộp */
  r: number;
  /** Đoạn bám liền chứa điểm */
  seg: GripSegment;
  /** `along` đã kẹp vào `[0, 1]` và `alongRoom` của `clear` */
  along: number;
}

/** Trục tới mặt của một thanh theo hướng `rho` (vuông góc trục) */
function rodReach(f: RodFeature, rho: V3): number {
  if (!f.wide) return f.r;
  const cw = Math.abs(dot3(rho, f.wide));
  const cn = Math.abs(dot3(rho, unit(cross3(f.a, f.wide))));
  return Math.min(cw > EPS ? f.R / cw : Infinity, cn > EPS ? f.r / cn : Infinity);
}

/** Khe sau thanh: số hướng quanh trục, số điểm dọc mỗi đoạn bám */
const GAP_AROUND = 24;
const GAP_ALONG = 9;

/**
 * Khe từ mặt thanh `f` tới các khối khác của món (dò cầu theo `ρ`): ngón móc quanh thanh nên lấy hướng hẹp nhất quanh trục,
 * rồi chỗ rộng nhất dọc các đoạn bám. Không chạm gì trong hộp bao món thì `Infinity`
 */
function rodGap(geom: ItemGeom, f: RodFeature, shape: readonly HeldShape[]): number {
  const rest = shape.filter((_, i) => !f.blocks.includes(i));
  if (!rest.length) return Infinity;
  const [lo, hi] = unionBox(shape.map(blockBox));
  const far = len3(sub3(hi, lo));
  const ray = (o: V3, rho: V3) => {
    let t = 0;
    for (let i = 0; i < 64 && t <= far; i++) {
      const d = heldDistance(rest, add3(o, scale3(rho, t)));
      if (d < 0.01) return t;
      t += d;
    }
    return Infinity;
  };
  let best = 0;
  for (const seg of gripSpan(geom, f))
    for (let j = 0; j < GAP_ALONG; j++) {
      const c = add3(seg.lo, scale3(f.a, ((j + 0.5) / GAP_ALONG) * seg.len));
      let g = Infinity;
      for (let k = 0; k < GAP_AROUND && g > best; k++) {
        const rho = radialDir(f, (360 * k) / GAP_AROUND);
        g = Math.min(g, ray(add3(c, scale3(rho, rodReach(f, rho))), rho));
      }
      best = Math.max(best, g);
    }
  return best;
}

/** Đoạn bám liền chồng nhiều nhất lên khối `f` (`gripSpan`); không còn đoạn thì ném lỗi */
function spanOf(geom: ItemGeom, f: RodFeature | LatheFeature, opts: { pad?: number } = {}) {
  const over = (g: GripSegment) =>
    Math.min(dot3(sub3(g.hi, f.lo), f.a), f.len) - Math.max(dot3(sub3(g.lo, f.lo), f.a), 0);
  const seg = gripSpan(geom, f, opts).reduce<GripSegment | undefined>(
    (b, g) => (!b || over(g) > over(b) + EPS ? g : b),
    undefined,
  );
  if (!seg) throw new Error(`\`${f.part}\` không còn đoạn bám (phần \`grip: false\` che hết)`);
  return seg;
}

/**
 * Miền `along` (của đoạn bám liền, như `axialAt`) nằm trên chính khối `f`, giao miền `alongRoom` của `clear`; khối nằm ngoài
 * miền ấy thì cả miền `alongRoom`
 */
export function ownAlong(
  geom: ItemGeom,
  f: RodFeature | LatheFeature,
  opts: { pad?: number; clear?: number } = {},
): [number, number] {
  const seg = spanOf(geom, f, opts);
  const L = Math.max(seg.len, EPS);
  const s0 = dot3(sub3(f.lo, seg.lo), f.a) / L;
  const own: [number, number] = [Math.max(0, s0), Math.min(1, s0 + f.len / L)];
  const room = (opts.clear ? alongRoom(seg, opts.clear) : undefined) ?? [0, 1];
  const lo = Math.max(own[0], room[0]);
  const hi = Math.min(own[1], room[1]);
  return lo <= hi ? [lo, hi] : room;
}

/**
 * Điểm ở `along` (0 đầu thấp, 1 đầu cao) của đoạn bám liền quanh thanh hay trụ tiện `f` (`gripSpan`, `pad` như ở đó), quay
 * `around` độ quanh trục: `ρ(0)` là `F` chiếu lên mặt vuông góc trục (món không khai `front`, hay `F` dọc trục: `b0`),
 * `ρ(90) = a × ρ(0)`. Bán kính lấy ở khối đồng trục chứa điểm (lớn nhất ở chỗ nối). `clear`: điểm cách phần `grip: false`
 * ít nhất ngần này dọc trục (`alongRoom`; đoạn ngắn quá thì giữa đoạn)
 */
export function axialAt(
  geom: ItemGeom,
  f: RodFeature | LatheFeature,
  along: number,
  around: number,
  opts: { pad?: number; clear?: number } = {},
): AxialPoint {
  const seg = spanOf(geom, f, opts);
  let u = Math.min(1, Math.max(0, along));
  if (opts.clear) {
    const room = alongRoom(seg, opts.clear);
    u = room ? Math.min(room[1], Math.max(room[0], u)) : 0.5;
  }
  const at = add3(seg.lo, scale3(f.a, u * seg.len));
  const pf = perp(geom.F, f.a);
  const r0 = geom.hasFront && len3(pf) > 1e-3 ? unit(pf) : f.b0;
  const rho = radialDir({ b0: r0, b90: unit(cross3(f.a, r0)) }, around);
  const own = lineOf(f)!;
  let r = 0;
  for (const g of geom.features) {
    if (g.kind !== "rod" && g.kind !== "lathe") continue;
    const l = lineOf(g)!;
    if (g !== f && !coaxial({ o: own.o, d: own.a, r: own.r }, { o: l.o, d: l.a, r: l.r })) continue;
    const s = dot3(sub3(at, g.lo), g.a);
    const tol = 1e-4 * Math.max(1, g.len);
    if (s < -tol || s > g.len + tol) continue;
    r = Math.max(r, g.kind === "lathe" ? latheRadius(g, s) : rodReach(g, rho));
  }
  return { at, a: f.a, rho, r, seg, along: u };
}

/** `around` (độ, `[0, 360)`) mà `ρ` của `axialAt` trên `f` chỉ về `dir` chiếu lên mặt vuông góc trục */
export function aroundOf(geom: ItemGeom, f: RodFeature | LatheFeature, dir: V3): number {
  const pf = perp(geom.F, f.a);
  const r0 = geom.hasFront && len3(pf) > 1e-3 ? unit(pf) : f.b0;
  const b90 = unit(cross3(f.a, r0));
  const deg = (Math.atan2(dot3(dir, b90), dot3(dir, r0)) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

/** Hướng lòng tay áp của thanh hộp: mặt tiết diện gần `rho` nhất; thanh tròn, trụ tiện giữ `rho` */
export function faceRho(f: RodFeature | LatheFeature, rho: V3): V3 {
  if (f.kind !== "rod" || !f.wide) return rho;
  return [f.wide, unit(cross3(f.a, f.wide))]
    .flatMap((v) => [v, neg(v)])
    .reduce((a, b) => (dot3(b, rho) > dot3(a, rho) + EPS ? b : a));
}

/**
 * Phần `grip: false` cắt đoạn bám của `f` mà nhô khỏi mặt khối quá `margin` về phía lòng tay ở `around` (`faceRho`): đo từ
 * mặt khối ở đầu đoạn kề phần ấy
 */
export function bulgeToward(
  geom: ItemGeom,
  f: RodFeature | LatheFeature,
  around: number,
  margin: number,
): string[] {
  const out: string[] = [];
  const mid = axialAt(geom, f, 0.5, around);
  const rho = faceRho(f, mid.rho);
  for (const b of geom.blocked) {
    const end = mid.seg.cut.indexOf(b.part);
    if (end < 0) continue;
    const p = axialAt(geom, f, end, around);
    const r = f.kind === "rod" ? rodReach(f, rho) : p.r;
    const m = Math.max(...b.shape.map((x) => blockReach(x, rho))) - dot3(p.at, rho);
    if (m > r + margin) out.push(b.part);
  }
  return out;
}

export interface HandDims {
  /** Bề ngang lòng bàn tay */
  W: number;
  /** Khe đầu ngón cái – đầu ngón trỏ ở dáng `open` */
  A: number;
  /** Cổ tay tới đầu ngón trỏ, dáng nghỉ */
  L: number;
  /** Dài lòng bàn tay */
  P: number;
}

const tip = (F: HandFrame): V3 => add3(F.o, [-F.R[1] * F.len, -F.R[4] * F.len, -F.R[7] * F.len]);
const DIMS = new Map<string, HandDims>();

/** Cỡ bàn tay cỡ `k`, cỡ dọc `long`, đơn vị rig (`× 100` đơn vị three). docs/11-nhom-cam.md#cỡ-tay */
export function handDims(k: number, long = k): HandDims {
  const key = `${k}|${long}`;
  const hit = DIMS.get(key);
  if (hit) return hit;
  const open = handFrames(handVec("open"), -1, k, long);
  const rest = handFrames(HAND_REST, -1, k, long);
  const d: HandDims = {
    W: 2 * HAND_BONES.palm.half[1] * k * 100,
    A: len3(sub3(tip(open.thumb1), tip(open.index1))) * 100,
    L: len3(tip(rest.index1)) * 100,
    P: HAND_BONES.palm.len * long * 100,
  };
  DIMS.set(key, d);
  return d;
}
