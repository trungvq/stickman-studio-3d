import { dot3, type BodyPart, type Lens, type V3 } from "@stickman3d/rig/core";
import {
  convexOf,
  hull,
  itemSolids,
  lensKey,
  meets,
  occlude,
  overlap,
  penetration,
  solid,
  type Convex,
  type Part,
  type Solid,
  type SolidItem,
} from "./solid";

/** Một người 3D: khối từng phần người trong thế giới (`figure3d(...).solids`) */
export interface SolidPerson {
  id: string;
  solids: { part: BodyPart; v: V3[] }[];
}

const TONE = { top: "#000", lit: "#000", side: "#000" };

/** Khối đã `bury` của một món dưới một ống kính; `key` là ống kính và `at` theo giá trị */
interface Baked {
  key: string;
  parts: Part[];
  sw?: number;
  ink?: string;
  ss: Solid[];
  box: Solid["box"];
}
const baked = new WeakMap<SolidItem, Baked>();
const hulls = new WeakMap<Solid, number[][]>();
/** Khối lồi để đo lấn và hộp bao thế giới của mảnh đồ đã `bake`: mảnh sống qua nhiều khung */
const convexes = new WeakMap<Solid, Convex>();
const aabbs = new WeakMap<Solid, number[]>();
/** Hộp bao thế giới `[x0, y0, z0, x1, y1, z1]` */
function aabb(v: V3[]) {
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const p of v)
    for (let k = 0; k < 3; k++) {
      if (p[k] < b[k]) b[k] = p[k];
      if (p[k] > b[k + 3]) b[k + 3] = p[k];
    }
  return b;
}
/** Quãng đẩy ngắn nhất theo một trục thế giới cho hai hộp bao rời nhau: độ lấn không vượt quá nó */
const boxOverlap = (a: number[], b: number[]) =>
  Math.min(a[3] - b[0], b[3] - a[0], a[4] - b[1], b[4] - a[1], a[5] - b[2], b[5] - a[2]);

const hullOf = (x: Solid, lens: Lens) => {
  let v = hulls.get(x);
  if (!v) hulls.set(x, (v = hull(x.v, lens)));
  return v;
};
/** Hai bóng lồi chồng nhau trên khung */
const touches = (A: Solid, B: Solid, lens: Lens) =>
  overlap(A.box, B.box) && meets(hullOf(A, lens), hullOf(B, lens));
/**
 * Hai khối chồng nhau trên khung mà không mặt nào của khối này để cả khối kia ở ngoài: `solidClashes`
 * đo lấn ở đúng những cặp này
 */
const inseparable = (A: Solid, B: Solid, lens: Lens) =>
  touches(A, B, lens) && occlude(A, B, lens.eye) === 0;

/** `root`, `tip`: tâm hai mặt đầu của khối đoạn chi (`rod` bốn đỉnh gốc rồi bốn đỉnh ngọn) — vai, khuỷu, cổ tay */
type Seg = { id: string; part: BodyPart; s: Solid; root: V3; tip: V3 };
const segOf = (id: string, part: BodyPart, v: V3[], lens: Lens): Seg => {
  const at = (q: V3[]) => [0, 1, 2].map((k) => q.reduce((a, p) => a + p[k], 0) / 4) as V3;
  return {
    id,
    part,
    s: solid({ v, tone: TONE }, { at: [0, 0, 0] }, lens, 0),
    root: at(v.slice(0, 4)),
    tip: at(v.slice(4)),
  };
};
const segsOf = (people: SolidPerson[], lens: Lens): Seg[] =>
  people.flatMap((p) => p.solids.map((x) => segOf(p.id, x.part, x.v, lens)));

const pad = (b: Solid["box"]): Solid["box"] => [b[0] - 1e-6, b[1] - 1e-6, b[2] + 1e-6, b[3] + 1e-6];
function bake(it: SolidItem, lens: Lens, lk: string): Baked {
  const key = `${lk}|${it.at.at}|${it.at.yaw}|${it.at.s}`;
  const b = baked.get(it);
  if (b && b.key === key && b.parts === it.parts && b.sw === it.sw && b.ink === it.ink) return b;
  const ss = itemSolids(it, lens);
  const box: Solid["box"] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of ss)
    for (let k = 0; k < 4; k++) box[k] = (k < 2 ? Math.min : Math.max)(box[k], s.box[k]);
  const out = { key, parts: it.parts, sw: it.sw, ink: it.ink, ss, box };
  baked.set(it, out);
  return out;
}

/** Một chỗ người lồng vào đồ (hay vào người khác) ở một khung */
export interface SolidClash {
  id: string;
  part: BodyPart;
  /** Món thứ mấy trong `items`, và khối thứ mấy trong `parts` của món ấy */
  item?: number;
  piece?: number;
  /** Phần người của người khác */
  other?: { id: string; part: BodyPart };
  /** Quãng ngắn nhất phải đẩy phần người ra cho hai khối rời nhau, đơn vị thế giới */
  depth: number;
}

/** Ngưỡng lấn của từng phần người vào món: `tol`, nâng lên `max` của mục `touch` khớp phần ấy */
function touchLimits(it: SolidItem, tol: number) {
  const max = new Map<string, number>();
  for (const t of it.touch ?? []) {
    const [k, m] = typeof t === "string" ? [t, Infinity] : [t.part, t.max];
    max.set(k, Math.max(max.get(k) ?? tol, m));
  }
  return (g: Seg) => Math.max(tol, max.get(g.part) ?? tol, max.get(`${g.id}.${g.part}`) ?? tol);
}

/**
 * Phần người lồng vào khối đồ hay vào phần người của người khác, lấn sâu hơn `tol`: chỉ đo những cặp
 * mà phép chiếu không tách được trước sau. Phần người khai trong
 * `touch` của món thì ngưỡng là `max` của mục ấy (chuỗi: không báo), và bỏ phần người có bóng ngoài
 * `view` (khung camera) khi đưa `view`. Không gọi lúc vẽ: chỉ để kiểm.
 * docs/10-lop-ve-code.md#người-lồng-vào-đồ
 */
export function solidClashes(
  lens: Lens,
  items: SolidItem[],
  people: SolidPerson[],
  { tol = 0, view }: { tol?: number; view?: { x: number; y: number; w: number; h: number } } = {},
): SolidClash[] {
  const frame: Solid["box"] | undefined = view && [
    view.x,
    view.y,
    view.x + view.w,
    view.y + view.h,
  ];
  const segs = segsOf(people, lens).filter((g) => !frame || overlap(g.s.box, frame));
  const boxes = new Map(segs.map((g) => [g, aabb(g.s.v)]));
  const shapes = new Map<Seg, Convex>();
  const shape = (g: Seg) => {
    let c = shapes.get(g);
    if (!c) shapes.set(g, (c = convexOf(g.s)));
    return c;
  };
  const out: SolidClash[] = [];
  const lk = lensKey(lens);
  const seen = new Set<SolidItem>();
  items.forEach((it, k) => {
    if (seen.has(it)) return;
    seen.add(it);
    const b = bake(it, lens, lk);
    const lim = touchLimits(it, tol);
    const near = segs
      .map((g) => ({ g, max: lim(g) }))
      .filter(({ g, max }) => max < Infinity && overlap(pad(b.box), g.s.box));
    for (const s of b.ss) {
      let box = aabbs.get(s);
      if (!box) aabbs.set(s, (box = aabb(s.v)));
      for (const { g, max } of near) {
        if (boxOverlap(box, boxes.get(g)!) <= max || !inseparable(s, g.s, lens)) continue;
        let c = convexes.get(s);
        if (!c) convexes.set(s, (c = convexOf(s)));
        const depth = penetration(c, shape(g));
        if (depth > max)
          out.push({ id: g.id, part: g.part, item: k, piece: it.parts.indexOf(s.part), depth });
      }
    }
  });
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++) {
      const [a, b] = [segs[i], segs[j]];
      if (a.id === b.id || boxOverlap(boxes.get(a)!, boxes.get(b)!) <= tol) continue;
      if (!inseparable(a.s, b.s, lens)) continue;
      const depth = penetration(shape(a), shape(b));
      if (depth > tol)
        out.push({ id: a.id, part: a.part, other: { id: b.id, part: b.part }, depth });
    }
  return out.sort((a, b) => b.depth - a.depth);
}

/** Một chỗ món đồ lồng vào món khác ở một khung */
export interface ItemClash {
  /** Hai món (chỉ số trong `items`) và khối lấn sâu nhất của mỗi món */
  item: number;
  piece: number;
  other: number;
  otherPiece: number;
  /** Quãng ngắn nhất phải đẩy cho hai khối sâu nhất rời nhau, đơn vị thế giới */
  depth: number;
  /** Phần thể tích của món nhỏ hơn (`small`: `item` hay `other`) nằm trong món kia, 0–1 */
  ratio: number;
  small: "item" | "other";
}
/** Số điểm lấy mẫu mỗi chiều trong hộp bao của một khối khi ước thể tích lồng nhau */
const VOL_STEPS = 6;
/** Khoảng chiếu của khối lồi lên từng pháp tuyến mặt: điểm trong khối khi nằm trong mọi khoảng */
const slabs = new WeakMap<Convex, number[]>();
function inside(c: Convex, p: V3) {
  let r = slabs.get(c);
  if (!r) {
    r = c.n.flatMap((n) => {
      const d = c.v.map((q) => dot3(n, q));
      return [Math.min(...d), Math.max(...d)];
    });
    slabs.set(c, r);
  }
  for (let i = 0; i < c.n.length; i++) {
    const d = dot3(c.n[i], p);
    if (d < r[2 * i] - 1e-6 || d > r[2 * i + 1] + 1e-6) return false;
  }
  return true;
}
const convexOfS = (s: Solid) => {
  let c = convexes.get(s);
  if (!c) convexes.set(s, (c = convexOf(s)));
  return c;
};
const aabbOfS = (s: Solid) => {
  let b = aabbs.get(s);
  if (!b) aabbs.set(s, (b = aabb(s.v)));
  return b;
};
/** Thể tích (ước bằng lưới điểm) của món `A`, và phần thể tích ấy nằm trong món `B` */
function volumeIn(A: Solid[], B: Solid[]) {
  let [all, inB] = [0, 0];
  const bs = B.map((s) => ({ b: aabbOfS(s), c: convexOfS(s) }));
  for (const s of A) {
    const b = aabbOfS(s);
    const c = convexOfS(s);
    const step = [0, 1, 2].map((k) => (b[k + 3] - b[k]) / VOL_STEPS);
    const cell = step[0] * step[1] * step[2];
    if (!(cell > 0)) continue;
    for (let i = 0; i < VOL_STEPS; i++)
      for (let j = 0; j < VOL_STEPS; j++)
        for (let k = 0; k < VOL_STEPS; k++) {
          const p: V3 = [
            b[0] + (i + 0.5) * step[0],
            b[1] + (j + 0.5) * step[1],
            b[2] + (k + 0.5) * step[2],
          ];
          if (!inside(c, p)) continue;
          all += cell;
          if (
            bs.some(
              ({ b: q, c: d }) => p.every((x, m) => x >= q[m] && x <= q[m + 3]) && inside(d, p),
            )
          )
            inB += cell;
        }
  }
  return { all, inB };
}
/** Hai món là một vật dựng thành nhiều món (thân cốc và quai): cùng chỗ đặt, cùng hướng, cùng cỡ */
const samePlace = (a: SolidItem, b: SolidItem) =>
  a.at.at.every((x, k) => Math.abs(x - b.at.at[k]) < 1e-6) &&
  (a.at.yaw ?? 0) === (b.at.yaw ?? 0) &&
  (a.at.s ?? 1) === (b.at.s ?? 1);
/** Món này khai cho món kia lồng vào (`touch` có tên món kia) */
const nests = (a: SolidItem, b: SolidItem) =>
  !!b.name && (a.touch ?? []).some((t) => (typeof t === "string" ? t : t.part) === b.name);
/** Kết quả đo của một cặp món đã `bake`: món đứng yên qua nhiều khung thì chỉ đo một lần */
const itemPairs = new WeakMap<
  Baked,
  WeakMap<Baked, { key: string; hit?: Omit<ItemClash, "item" | "other"> }>
>();

/**
 * Món đồ lồng vào món khác: báo khi khối lấn sâu nhất sâu hơn `tol` **và** phần thể tích của món nhỏ hơn
 * nằm trong món kia vượt `ratio` (cốc lún nửa thân vào khay máy pha; đồ đặt lên mặt bàn, tờ giấy mỏng
 * nằm trên bàn thì không). Bỏ hai món cùng chỗ đặt (một vật dựng thành nhiều món), cặp mà một món khai
 * tên món kia trong `touch` (bút trong ống bút), và cặp có cả hai bóng ngoài `view`. Không gọi lúc vẽ:
 * chỉ để kiểm. docs/10-lop-ve-code.md#đồ-lồng-vào-đồ
 */
export function solidItemClashes(
  lens: Lens,
  items: SolidItem[],
  {
    tol = 0,
    ratio = 0.1,
    view,
  }: { tol?: number; ratio?: number; view?: { x: number; y: number; w: number; h: number } } = {},
): ItemClash[] {
  const frame: Solid["box"] | undefined = view && [
    view.x,
    view.y,
    view.x + view.w,
    view.y + view.h,
  ];
  const lk = lensKey(lens);
  const list = [...new Set(items)].map((it) => {
    const b = bake(it, lens, lk);
    const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
    for (const s of b.ss) {
      const q = aabbOfS(s);
      for (let k = 0; k < 3; k++) {
        box[k] = Math.min(box[k], q[k]);
        box[k + 3] = Math.max(box[k + 3], q[k + 3]);
      }
    }
    return { it, k: items.indexOf(it), b, box };
  });
  const out: ItemClash[] = [];
  const key = `${tol}|${ratio}`;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const [A, B] = [list[i], list[j]];
      if (boxOverlap(A.box, B.box) <= tol) continue;
      if (samePlace(A.it, B.it) || nests(A.it, B.it) || nests(B.it, A.it)) continue;
      if (frame && !overlap(A.b.box, frame) && !overlap(B.b.box, frame)) continue;
      let m = itemPairs.get(A.b);
      if (!m) itemPairs.set(A.b, (m = new WeakMap()));
      let r = m.get(B.b);
      if (!r || r.key !== key) {
        r = { key };
        let best = { depth: tol, piece: -1, otherPiece: -1 };
        for (const a of A.b.ss)
          for (const b of B.b.ss) {
            if (boxOverlap(aabbOfS(a), aabbOfS(b)) <= best.depth) continue;
            const d = penetration(convexOfS(a), convexOfS(b));
            if (d > best.depth)
              best = {
                depth: d,
                piece: A.it.parts.indexOf(a.part),
                otherPiece: B.it.parts.indexOf(b.part),
              };
          }
        if (best.piece >= 0) {
          const [va, vb] = [volumeIn(A.b.ss, B.b.ss), volumeIn(B.b.ss, A.b.ss)];
          const small = va.all <= vb.all ? "item" : "other";
          const v = small === "item" ? va : vb;
          const part = v.all > 0 ? v.inB / v.all : 0;
          if (part > ratio) r.hit = { ...best, ratio: part, small };
        }
        m.set(B.b, r);
      }
      if (r.hit) out.push({ ...r.hit, item: A.k, other: B.k });
    }
  return out.sort((a, b) => b.depth - a.depth);
}
