import type { ReactElement } from "react";
import {
  depthAt,
  dot3,
  place3,
  project,
  scaleAt,
  sub3,
  lensView,
  type Lens,
  type Place3,
  type V3,
} from "@stickman3d/sketch";

// Đồ dựng khối: vật là vài khối lồi tám đỉnh trong toạ độ riêng của vật, đặt vào thế giới bằng
// `Place3`, chiếu qua `Lens` của cảnh. Mặt khối một màu phẳng: mặt ngửa lên lấy `top`, mặt đứng quay
// về phía đèn (trái khung) lấy `lit`, còn lại `side`. docs/10-lop-ve-code.md#đồ-khối

export interface Tone {
  top: string;
  lit: string;
  side: string;
}
/** Nét vẽ thêm trên một mặt (vân gỗ…): hiện khi mặt có pháp tuyến gần `n` nhất đang quay ra ống kính */
export interface Mark {
  n: V3;
  d: V3[][];
  color: string;
  w?: number;
}
/** Khối lồi tám đỉnh: bốn đỉnh đáy theo vòng rồi bốn đỉnh trên tương ứng. `w` nhân độ dày nét */
export interface Part {
  v: V3[];
  tone: Tone;
  w?: number;
  marks?: Mark[];
}
/** Một món đồ khối của lớp vẽ code (`solids`): các khối, chỗ đặt, nét viền trên khung (mặc định 3 nhân cỡ món) */
export interface SolidItem {
  parts: Part[];
  at: Place3;
  sw?: number;
  /** Màu nét viền; bỏ trống là màu nét của rig */
  ink?: string;
  /** Tên món trong báo cáo người lồng vào đồ của `check` */
  name?: string;
  /** Phần người được phép lấn vào món: `"head"` của mọi người, `"haru.head"` của một người; chuỗi là lấn bao nhiêu cũng được */
  touch?: Touch[];
}
/** Một mục `touch`: tên phần người, hay `{ part, max }` cho lấn tới `max` đơn vị thế giới */
export type Touch = string | { part: string; max: number };

/** Nửa không gian giữ lại sau một nhát chặt: điểm p có dot(n, p) ≤ d */
export interface Half {
  n: V3;
  d: number;
}
/** Mặt khối: đa giác lồi; `e[i]` là cạnh p[i]→p[i+1] có viền (cạnh do chặt thì không); `cap` là mặt chặt, không vẽ */
interface Face {
  p: V3[];
  e: boolean[];
  n: V3;
  c: V3;
  cap?: boolean;
  hid?: boolean;
}
/** Một khối, hay một mảnh khối sau khi chặt, đã đặt vào thế giới */
export interface Solid {
  part: Part;
  at: Place3;
  sw: number;
  f: Face[];
  v: V3[];
  c: V3;
  far: number;
  box: [number, number, number, number];
  cut: Half[];
  ink?: string;
}

const mean = (ps: V3[]): V3 => {
  const n = ps.length;
  return [
    ps.reduce((a, p) => a + p[0], 0) / n,
    ps.reduce((a, p) => a + p[1], 0) / n,
    ps.reduce((a, p) => a + p[2], 0) / n,
  ];
};
const FACES = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [0, 1, 5, 4],
  [1, 2, 6, 5],
  [2, 3, 7, 6],
  [3, 0, 4, 7],
];
const EPS = 1e-3;

// ---- khối cơ bản (toạ độ vật)
export const box = (
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
): V3[] => [
  [x0, y1, z0],
  [x1, y1, z0],
  [x1, y1, z1],
  [x0, y1, z1],
  [x0, y0, z0],
  [x1, y0, z0],
  [x1, y0, z1],
  [x0, y0, z1],
];
/** Thanh tiết diện chữ nhật (nửa cạnh hx, hz) từ tâm đáy a tới tâm đỉnh b; đáy và đỉnh nằm ngang */
export const bar = (a: V3, b: V3, hx: number, hz = hx): V3[] => {
  const q = (c: V3): V3[] => [
    [c[0] - hx, c[1], c[2] - hz],
    [c[0] + hx, c[1], c[2] - hz],
    [c[0] + hx, c[1], c[2] + hz],
    [c[0] - hx, c[1], c[2] + hz],
  ];
  return [...q(a), ...q(b)];
};
/** Tấm đùn: mặt cắt bốn điểm (x, y) theo vòng, kéo từ z0 tới z1 */
export const slab = (pr: [number, number][], z0: number, z1: number): V3[] => [
  ...pr.map(([x, y]): V3 => [x, y, z0]),
  ...pr.map(([x, y]): V3 => [x, y, z1]),
];

function finish(s: Omit<Solid, "v" | "c" | "far" | "box">, lens: Lens): Solid {
  const v = s.f.flatMap((f) => f.p);
  const c = mean(v);
  const sp = v.map((p) => project(lens, p));
  const xs = sp.map((p) => p[0]);
  const ys = sp.map((p) => p[1]);
  return {
    ...s,
    v,
    c,
    far: Math.hypot(...sub3(c, lens.eye)),
    box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
  };
}

/** Đặt một khối vào thế giới; `sw` là nét viền trên khung */
export function solid(part: Part, at: Place3, lens: Lens, sw: number): Solid {
  const v = part.v.map((p) => place3(at, p));
  const c = mean(v);
  const f = FACES.map((i) => {
    const p = i.map((j) => v[j]);
    const fc = mean(p);
    let n: V3 = [0, 0, 0];
    // Newell cho pháp tuyến, rồi lật ra ngoài theo tâm khối: thứ tự đỉnh không cần đúng chiều
    p.forEach((a, k) => {
      const b = p[(k + 1) % p.length];
      n = [
        n[0] + (a[1] - b[1]) * (a[2] + b[2]),
        n[1] + (a[2] - b[2]) * (a[0] + b[0]),
        n[2] + (a[0] - b[0]) * (a[1] + b[1]),
      ];
    });
    const l = Math.hypot(...n) || 1;
    n = [n[0] / l, n[1] / l, n[2] / l];
    if (dot3(n, sub3(fc, c)) < 0) n = [-n[0], -n[1], -n[2]];
    return { p, e: p.map(() => true), n, c: fc };
  });
  return finish({ part, at, sw, f, cut: [] }, lens);
}

/** Ẩn mặt bị áp kín: mặt nằm gọn trong mặt ngược chiều của một khối khác cùng món (đầu chân ghế dưới mặt ngồi) */
export function bury(ss: Solid[]): Solid[] {
  const side = (p: V3, g: Face) =>
    g.p.map((a, i) => {
      const b = g.p[(i + 1) % g.p.length];
      const u = sub3(b, a);
      const w = sub3(p, a);
      return (
        dot3(
          [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]],
          g.n,
        ) / (Math.hypot(...u) || 1)
      );
    });
  const inside = (p: V3, g: Face) => {
    const k = side(p, g);
    return k.every((x) => x >= -0.5) || k.every((x) => x <= 0.5);
  };
  return ss.map((A, i) => ({
    ...A,
    f: A.f.map((f) =>
      ss.some(
        (B, j) =>
          j !== i &&
          B.f.some(
            (g) =>
              dot3(f.n, g.n) < -0.999 &&
              Math.abs(dot3(sub3(f.c, g.c), g.n)) < 0.5 &&
              f.p.every((p) => inside(p, g)),
          ),
      )
        ? { ...f, hid: true }
        : f,
    ),
  }));
}

function clipPoly(p: V3[], e: boolean[], h: Half) {
  const out: V3[] = [];
  const oe: boolean[] = [];
  const s = p.map((q) => dot3(h.n, q) - h.d);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    const a = p[i];
    const b = p[j];
    const sa = s[i];
    const sb = s[j];
    const x = (): V3 => {
      const t = sa / (sa - sb);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    };
    if (sa <= 0) {
      out.push(a);
      oe.push(e[i]);
      if (sb > 0) {
        out.push(x());
        oe.push(false);
      }
    } else if (sb <= 0) {
      out.push(x());
      oe.push(e[i]);
    }
  }
  return { p: out, e: oe };
}

/** Phần khối nằm trong nửa không gian `h`, kèm mặt chặt; không còn gì thì null */
export function cut(s: Solid, h: Half, lens: Lens): Solid | null {
  const f: Face[] = [];
  const on: V3[] = [];
  for (const x of s.f) {
    const r = clipPoly(x.p, x.e, h);
    if (r.p.length < 3) continue;
    for (const q of r.p)
      if (Math.abs(dot3(h.n, q) - h.d) < EPS && !on.some((o) => Math.hypot(...sub3(o, q)) < EPS))
        on.push(q);
    f.push({ ...x, p: r.p, e: r.e, c: mean(r.p) });
  }
  if (!f.some((x) => !x.cap)) return null;
  if (on.length >= 3) {
    const c = mean(on);
    const u0: V3 = Math.abs(h.n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = sub3(u0, h.n.map((k) => k * dot3(u0, h.n)) as V3);
    const w: V3 = [
      h.n[1] * u[2] - h.n[2] * u[1],
      h.n[2] * u[0] - h.n[0] * u[2],
      h.n[0] * u[1] - h.n[1] * u[0],
    ];
    const ang = (a: V3) => Math.atan2(dot3(sub3(a, c), w), dot3(sub3(a, c), u));
    const p = [...on].sort((a, b) => ang(a) - ang(b));
    f.push({ p, e: p.map(() => false), n: h.n, c, cap: true });
  }
  return finish({ ...s, f, cut: [...s.cut, h] }, lens);
}

/** Độ khối chồm qua mặt phẳng dot(n, p) = d: âm là còn nằm hẳn một bên */
export const straddle = (s: Pick<Solid, "v">, n: V3, d: number) => {
  const k = s.v.map((p) => dot3(n, p) - d);
  return Math.min(Math.max(...k), -Math.min(...k));
};

/** Mọi điểm ở phía ngoài mặt `f` (dot3(p − f.c, f.n) ≥ −EPS), không cấp phát: `occlude` chạy mỗi khung */
function outside(v: V3[], f: Face) {
  const [c, n] = [f.c, f.n];
  for (const p of v)
    if ((p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1] + (p[2] - c[2]) * n[2] < -EPS) return false;
  return true;
}
/**
 * 1: A vẽ trước B; −1: sau; 0: không tách được — hay hai mặt tách cho hai kết luận ngược nhau,
 * tức hai khối không che nhau trên khung dù khung bao chồng nhau
 */
export function occlude(A: Pick<Solid, "f" | "v">, B: Pick<Solid, "f" | "v">, eye: V3): number {
  let r = 0;
  for (const [X, Y, sg] of [
    [A, B, 1],
    [B, A, -1],
  ] as const)
    for (const f of X.f)
      if (outside(Y.v, f)) {
        const o = (dot3(sub3(eye, f.c), f.n) > 0 ? 1 : -1) * sg;
        if (r && o !== r) return 0;
        r = o;
      }
  return r;
}
export const overlap = (a: Solid["box"], b: Solid["box"]) =>
  a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/** Bao lồi các đỉnh đã chiếu, ngược chiều kim đồng hồ trên khung */
export function hull(v: V3[], lens: Lens): number[][] {
  const ps = v.map((p) => project(lens, p)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: number[], a: number[], b: number[]) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (q: number[][]) => {
    const h: number[][] = [];
    for (const p of q) {
      while (h.length > 1 && cr(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(ps), ...half([...ps].reverse())];
}
/** Hai bóng lồi chồng nhau thật (trục tách), không chỉ khung bao. Cạnh dài ≈ 0 bỏ qua: pháp tuyến ≈ 0 là trục tách giả */
export function meets(a: number[][], b: number[][]) {
  for (const [P, Q] of [
    [a, b],
    [b, a],
  ])
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const q = P[(i + 1) % P.length];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (l < 1e-9) continue;
      const [nx, ny] = [(q[1] - p[1]) / l, (p[0] - q[0]) / l];
      let [a0, a1, b0, b1] = [Infinity, -Infinity, Infinity, -Infinity];
      for (const x of P) {
        const k = x[0] * nx + x[1] * ny;
        if (k < a0) a0 = k;
        if (k > a1) a1 = k;
      }
      for (const x of Q) {
        const k = x[0] * nx + x[1] * ny;
        if (k < b0) b0 = k;
        if (k > b1) b1 = k;
      }
      if (a1 <= b0 + 1e-6 || b1 <= a0 + 1e-6) return false;
    }
  return true;
}

const fmt = (lens: Lens, p: V3) =>
  project(lens, p)
    .map((u) => u.toFixed(1))
    .join(" ");
const path = (lens: Lens, ps: V3[], close = true) =>
  "M" + ps.map((p) => fmt(lens, p)).join("L") + (close ? "Z" : "");
function clipSeg(a: V3, b: V3, hs: Half[]): [V3, V3] | null {
  let t0 = 0;
  let t1 = 1;
  for (const h of hs) {
    const sa = dot3(h.n, a) - h.d;
    const sb = dot3(h.n, b) - h.d;
    if (sa > 0 && sb > 0) return null;
    if (sa > 0) t0 = Math.max(t0, sa / (sa - sb));
    else if (sb > 0) t1 = Math.min(t1, sa / (sa - sb));
  }
  if (t0 >= t1) return null;
  const at = (t: number): V3 => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
  return [at(t0), at(t1)];
}

/** Ống kính theo giá trị: khoá của các bảng nhớ theo ống kính */
export const lensKey = (l: Lens) => `${l.eye}|${l.yaw}|${l.pitch}|${l.f}|${l.cx}|${l.cy}`;

let serial = 0;
const drawn = new WeakMap<Solid, { id: number; key: string; out: ReactElement[] }>();
/** Phần tử của một khối: mặt, viền cạnh thật, vân. `key` theo khối, không theo chỗ trong lượt */
function drawSolid(s: Solid, lens: Lens, key: string, ink: string): ReactElement[] {
  const c = drawn.get(s);
  if (c?.key === key) return c.out;
  const id = c?.id ?? serial++;
  const out: ReactElement[] = [];
  const light = (n: V3) => lensView(lens, n)[0];
  const seen = (f: Face) => dot3(sub3(lens.eye, f.c), f.n) > 0;
  const t = s.part.tone;
  const w = s.sw * (s.part.w ?? 1);
  s.f.forEach((f, i) => {
    if (f.cap || f.hid || !seen(f)) return;
    const fill = f.n[1] < -0.5 ? t.top : f.n[1] < 0.5 && light(f.n) < -0.25 ? t.lit : t.side;
    const ed = f.p
      .map((a, j) => (f.e[j] ? `M${fmt(lens, a)}L${fmt(lens, f.p[(j + 1) % f.p.length])}` : ""))
      .join("");
    out.push(
      <path key={`${id}f${i}`} d={path(lens, f.p)} fill={fill} stroke={fill} strokeWidth={0.8} />,
    );
    if (ed)
      out.push(
        <path key={`${id}e${i}`} d={ed} fill="none" stroke={s.ink ?? ink} strokeWidth={w} />,
      );
  });
  (s.part.marks ?? []).forEach((m, i) => {
    const n = place3({ at: [0, 0, 0], yaw: s.at.yaw }, m.n);
    const f = s.f.filter((x) => !x.cap).reduce((a, b) => (dot3(b.n, n) > dot3(a.n, n) ? b : a));
    if (!seen(f)) return;
    const d = m.d
      .flatMap((l) => l.slice(1).map((q, j) => clipSeg(place3(s.at, l[j]), place3(s.at, q), s.cut)))
      .filter((x): x is [V3, V3] => !!x)
      .map((x) => path(lens, x, false))
      .join("");
    if (d)
      out.push(
        <path
          key={`${id}m${i}`}
          d={d}
          fill="none"
          stroke={m.color}
          strokeWidth={s.sw * (m.w ?? 0.5)}
        />,
      );
  });
  drawn.set(s, { id, key, out });
  return out;
}

/**
 * Vẽ các khối theo thứ tự đưa vào: mỗi mặt tô màu (viền mảnh cùng màu cho khỏi hở chỗ chặt), nét
 * viền cạnh thật, rồi vân. Phần tử nhớ theo object khối, ống kính và `ink`: khối tĩnh của
 * `solidOrder` không chiếu lại, React gặp lại đúng phần tử cũ mỗi khung
 */
export function SolidPaths({ ss, lens, ink }: { ss: Solid[]; lens: Lens; ink: string }) {
  const key = `${lensKey(lens)}|${ink}`;
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {ss.flatMap((s) => drawSolid(s, lens, key, ink))}
    </g>
  );
}

/** Độ sâu tối thiểu của phần khối còn vẽ: gần hơn thì chiếu ra vô cực */
const NEAR = 1;
/** Nửa không gian trước mặt phẳng ống kính (độ sâu ≥ NEAR) */
function front(lens: Lens): Half {
  const n = ([0, 1, 2] as const).map(
    (i) => -lensView(lens, [i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0])[2],
  ) as V3;
  return { n, d: dot3(n, lens.eye) - NEAR };
}

/**
 * Khối của một món: nét mặc định 3 nhân cỡ món tại gốc. Khối có đỉnh sau mặt phẳng ống kính (ống
 * kính đứng sát hay trong lòng món: mặt bục, sàn lớn) thì chặt ở `NEAR`, giữ phần trước ống kính;
 * mép chặt không có viền. Khối nằm hẳn sau ống kính thì bỏ
 */
export function itemSolids(it: SolidItem, lens: Lens): Solid[] {
  const sw = it.sw ?? 3 * scaleAt(lens, it.at.at) * (it.at.s ?? 1);
  const h = front(lens);
  // chặt trước `bury`: phần bỏ đi không được giấu mặt áp vào nó của khối còn lại
  return bury(
    it.parts
      .map((p) => {
        const s: Solid = { ...solid(p, it.at, lens, sw), ink: it.ink };
        return s.v.every((q) => depthAt(lens, q) >= NEAR) ? s : cut(s, h, lens);
      })
      .filter((s): s is Solid => !!s),
  );
}

const unit3 = (a: V3): V3 | null => {
  const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : null;
};
const cross3 = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
/** Hướng đơn vị không phân biệt chiều, bỏ hướng trùng */
function dedupe(ds: V3[]): V3[] {
  const out: V3[] = [];
  for (const d of ds)
    if (!out.some((u) => Math.abs(u[0] * d[0] + u[1] * d[1] + u[2] * d[2]) > 1 - 1e-9)) out.push(d);
  return out;
}
/** Khối lồi để đo lấn: đỉnh, pháp tuyến các mặt, hướng các cạnh (`convexOf`) */
export interface Convex {
  v: V3[];
  n: V3[];
  e: V3[];
}
/** Bao lồi của một đám điểm: mặt là mọi bộ ba đỉnh để cả đám một phía; cạnh lấy mọi cặp đỉnh */
function convexOfPoints(v: V3[]): Convex {
  const n: V3[] = [];
  const e: V3[] = [];
  for (let i = 0; i < v.length; i++)
    for (let j = i + 1; j < v.length; j++) {
      const p = v[i];
      const u: V3 = [v[j][0] - p[0], v[j][1] - p[1], v[j][2] - p[2]];
      const ue = unit3(u);
      if (ue) e.push(ue);
      for (let k = j + 1; k < v.length; k++) {
        const m = unit3(cross3(u, [v[k][0] - p[0], v[k][1] - p[1], v[k][2] - p[2]]));
        if (!m) continue;
        const d = m[0] * p[0] + m[1] * p[1] + m[2] * p[2];
        let lo = 0;
        let hi = 0;
        for (const q of v) {
          const x = m[0] * q[0] + m[1] * q[1] + m[2] * q[2] - d;
          if (x < lo) lo = x;
          else if (x > hi) hi = x;
        }
        if (lo > -EPS || hi < EPS) n.push(m);
      }
    }
  return { v, n: dedupe(n), e: dedupe(e) };
}
/** Khối có mặt phẳng thật lấy mặt và cạnh của nó; mặt vênh (thân người xoắn) thì lấy bao lồi đỉnh */
function convexOfSolid(s: Pick<Solid, "f" | "v">): Convex {
  const e: V3[] = [];
  for (const f of s.f) {
    const d = dot3(f.n, f.c);
    if (f.p.some((p) => Math.abs(dot3(f.n, p) - d) > EPS)) return convexOfPoints(s.v);
    for (let i = 0; i < f.p.length; i++) {
      const u = unit3(sub3(f.p[(i + 1) % f.p.length], f.p[i]));
      if (u) e.push(u);
    }
  }
  return { v: s.v, n: dedupe(s.f.map((f) => f.n)), e: dedupe(e) };
}
type Shape = Pick<Solid, "f" | "v"> | V3[] | Convex;
/** Khối (`Solid`) lấy mặt của nó; đám đỉnh trần lấy bao lồi */
export const convexOf = (x: Shape): Convex =>
  Array.isArray(x) ? convexOfPoints(x) : "f" in x ? convexOfSolid(x) : x;
/** Độ chồm của hai đám điểm trên trục `n`: ≤ 0 là tách */
function overlapOn(A: V3[], B: V3[], n: V3) {
  let [a0, a1, b0, b1] = [Infinity, -Infinity, Infinity, -Infinity];
  for (const p of A) {
    const d = p[0] * n[0] + p[1] * n[1] + p[2] * n[2];
    if (d < a0) a0 = d;
    if (d > a1) a1 = d;
  }
  for (const p of B) {
    const d = p[0] * n[0] + p[1] * n[1] + p[2] * n[2];
    if (d < b0) b0 = d;
    if (d > b1) b1 = d;
  }
  return Math.min(a1 - b0, b1 - a0);
}
/**
 * Hai khối lồi lấn nhau sâu bao nhiêu: quãng ngắn nhất phải đẩy một khối đi cho hai khối rời nhau
 * (độ chồm nhỏ nhất trên mọi trục, đạt ở pháp tuyến mặt hay tích hai cạnh). ≤ 0 là rời nhau.
 * Đo lại nhiều lần một khối thì đưa `convexOf` của nó
 */
export function penetration(A: Shape, B: Shape) {
  const [a, b] = [convexOf(A), convexOf(B)];
  let best = Infinity;
  for (const n of [...a.n, ...b.n]) {
    best = Math.min(best, overlapOn(a.v, b.v, n));
    if (best <= 0) return best;
  }
  for (const x of a.e)
    for (const y of b.e) {
      const n = unit3(cross3(x, y));
      if (!n) continue;
      best = Math.min(best, overlapOn(a.v, b.v, n));
      if (best <= 0) return best;
    }
  return best;
}

/** Độ sâu theo trục nhìn của tâm khối */
export const solidDepth = (s: Pick<Solid, "c">, lens: Lens) => depthAt(lens, s.c);
