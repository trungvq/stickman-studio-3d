import { APRON_KNEEL, D, HEM_HANG } from "./constants";
import {
  ApronSchema,
  WrapHemSchema,
  WrapSchema,
  type Garment,
  type Skirt,
  type WrapHem,
} from "./schema";

type P2 = readonly [number, number];
type V3 = [number, number, number];

/** Bộ số vạt dài quấn đã đủ */
export const wrapHemOf = (g: Pick<Skirt, "wrap">) => WrapHemSchema.parse(g.wrap ?? {});
/**
 * Vạt dài không khai `skirt.wrap` mặc dưới thân áo cổ chéo: mép vạt trên lấy `overlap` của cổ chéo, nối liền mép áo
 */
export const matchWrap = <S extends Skirt>(g: S, garment: Partial<Garment> | undefined): S =>
  g.style === "wrap" && !g.wrap && garment?.style === "wrap"
    ? { ...g, wrap: { ...wrapHemOf(g), overlap: WrapSchema.parse(garment.wrap ?? {}).overlap } }
    : g;
/** Bộ số tạp dề đã đủ */
export const apronOf = (g: Pick<Skirt, "apron">) => ApronSchema.parse(g.apron ?? {});

/** Kiểu treo ở hông (`wrap`, `apron`): người 3D dựng trong hệ hông, không nghiêng theo thân */
export const hangsFromHip = (g: Pick<Skirt, "style"> | undefined) =>
  g?.style === "wrap" || g?.style === "apron";

/**
 * Phần ống chân vạt treo hông phủ theo khi đùi lệch phương đứng `angle` radian: `1` khi đứng, đi, cúi chào; về `0` khi
 * đùi ngang (ngồi ghế, quỳ) — vạt dừng ở gối (`HEM_HANG`)
 */
export function hemHang(angle: number) {
  const [a, b] = HEM_HANG.map((d) => d * D);
  const u = Math.min(1, Math.max(0, (b - Math.abs(angle)) / (b - a)));
  return u * u * (3 - 2 * u);
}

/**
 * Vạt treo hông phủ dọc một chân bấy nhiêu px, `[đùi, ống chân]`: đứng thẳng gấu ở `length − rise` dưới hông; ống chân
 * chỉ phủ phần `hemHang` của góc đùi `angle` (radian, so với phương đứng)
 */
export function hemReach(g: Skirt, height: number, angle: number, lt: number, ls: number) {
  const s = Math.max(0, (g.length - g.rise) * height);
  return [Math.min(s, lt), Math.min(Math.max(0, s - lt), ls) * hemHang(angle)] as const;
}

/**
 * Mép vạt trên của vạt dài ở phần `v` quãng cạp → gấu: `x` hệ thân. Âm là bên phải người mặc — vạt trái đè vạt phải
 * (右前), cùng phía với mép vạt của thân áo cổ chéo
 */
export const wrapHemEdge = (w: WrapHem, v: number) => -(w.overlap + w.slant * v);

const cross = (o: P2, a: P2, b: P2) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Bao lồi của `pts`, các đỉnh theo vòng */
function hull2(pts: readonly P2[]): P2[] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (s.length < 3) return s;
  const half = (list: P2[]) => {
    const h: P2[] = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(s), ...half(s.reverse())];
}

/** `top` nằm trong mặt cắt lồi của `pts` thì quãng từ nó theo hướng `up` tới mép mặt cắt; ở ngoài là `0` */
function riseOut(top: P2, pts: readonly P2[], up: P2) {
  const h = hull2(pts);
  const n = h.length;
  if (n < 3) return 0;
  const side = h.map((p, i) => cross(p, h[(i + 1) % n], top));
  if (!side.every((v) => v >= 0) && !side.every((v) => v <= 0)) return 0;
  const f: P2 = [-up[1], up[0]];
  const along = (p: P2, d: P2) => (p[0] - top[0]) * d[0] + (p[1] - top[1]) * d[1];
  let out = 0;
  for (let i = 0; i < n; i++) {
    const [p, q] = [h[i], h[(i + 1) % n]];
    const [bp, bq] = [along(p, f), along(q, f)];
    if (bp > 0 === bq > 0 || bp === bq) continue;
    const w = bp / (bp - bq);
    out = Math.max(out, along([p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w], up));
  }
  return out;
}

/**
 * Vải buông từ mép trên `top` phủ qua vật có mặt cắt dọc `pts` (`[tiến, y xuống]`): chuỗi đỉnh bao lồi của `top`, `pts`
 * và bóng rơi thẳng xuống của chúng, từ `top` vòng phía trước tới chỗ vải rời vật. Sau đỉnh cuối vải rủ thẳng xuống.
 * `up` là hướng lên của thân (`[0, −1]` là đứng thẳng): thân ngả trước mà `top` lọt trong mặt cắt (cạp kẹt giữa bụng và
 * đùi gập) thì vải theo `up` dọc mặt bụng ra tới mép mặt cắt trước. Vật phía trước chỗ ấy mà cao hơn nó (đùi người ngồi)
 * thì vải đi thẳng lên trùm qua trước. Điểm cao hơn chỗ bắt đầu (lưng sau `top`) không thuộc đường vải
 */
export function drape(top: P2, pts: readonly P2[], up: P2 = [0, -1]): P2[] {
  const r = up[0] > 0 ? riseOut(top, pts, up) : 0;
  const from: P2 = r > 0.5 ? [top[0] + up[0] * r, top[1] + up[1] * r] : top;
  const over = Math.min(from[1], ...pts.filter((p) => p[0] > from[0]).map((p) => p[1]));
  const start: P2 = over < from[1] ? [from[0], over - 1e-6] : from;
  const real = [start, ...pts.filter((p) => p[1] >= start[1])];
  const floor = Math.max(...real.map((p) => p[1])) + 1e4;
  const all = [...real, ...real.map((p): P2 => [p[0], floor])];
  const path: P2[] = [top, ...(from === top ? [] : [from]), ...(start === from ? [] : [start])];
  let c = start;
  for (let k = 0; k < real.length; k++) {
    let p: P2 = [c[0], floor];
    for (const q of all) {
      if (q === c) continue;
      const t = cross(c, p, q);
      const far = Math.hypot(q[0] - c[0], q[1] - c[1]) > Math.hypot(p[0] - c[0], p[1] - c[1]);
      if (t < -1e-9 || (Math.abs(t) <= 1e-9 && far)) p = q;
    }
    if (p[1] >= floor) break;
    path.push(p);
    c = p;
  }
  return path;
}

/** Điểm cách đầu chuỗi `path` quãng `s` dọc chuỗi; quá đỉnh cuối thì rủ thẳng xuống */
export function drapeAt(path: readonly P2[], s: number): [number, number] {
  let left = s;
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (left <= l && l > 0)
      return [a[0] + ((b[0] - a[0]) * left) / l, a[1] + ((b[1] - a[1]) * left) / l];
    left -= l;
  }
  const e = path[path.length - 1];
  return [e[0], e[1] + left];
}

/** Chiều dài chuỗi `path` */
export const drapeLength = (path: readonly P2[]) =>
  path.reduce(
    (s, p, k) => (k ? s + Math.hypot(p[0] - path[k - 1][0], p[1] - path[k - 1][1]) : 0),
    0,
  );

/**
 * Đường vải `path` của `drape` gặp sàn ở độ cao `floor` (y xuống): cắt ở chỗ chạm sàn, không thì buông thẳng từ đỉnh cuối
 * xuống sàn, rồi nằm trên sàn tiến ra trước (`+tiến`) tới `run` px quá chỗ chạm; góc gập bo bán kính `bend`. Chuỗi trả về
 * dừng ở đó: vải dài hơn `drapeLength` của nó thì cắt ở mút
 */
export function drapeFloor(path: readonly P2[], floor: number, bend: number, run: number): P2[] {
  const out: P2[] = [];
  let hit: P2 | undefined;
  for (const p of path) {
    const a = out[out.length - 1];
    if (p[1] < floor) {
      out.push(p);
      continue;
    }
    hit = a ? [a[0] + ((p[0] - a[0]) * (floor - a[1])) / (p[1] - a[1]), floor] : [p[0], floor];
    break;
  }
  const last = out[out.length - 1] ?? hit!;
  hit ??= [last[0], floor];
  const din = [hit[0] - last[0], hit[1] - last[1]];
  const l = Math.hypot(din[0], din[1]);
  const r = Math.min(bend, l / 2, run);
  if (r > 1e-6) {
    const a: P2 = [hit[0] - (din[0] * r) / l, hit[1] - (din[1] * r) / l];
    const b: P2 = [hit[0] + r, floor];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      const v = 1 - u;
      out.push([
        v * v * a[0] + 2 * v * u * hit[0] + u * u * b[0],
        v * v * a[1] + 2 * v * u * hit[1] + u * u * b[1],
      ]);
    }
  } else out.push(hit);
  if (run > r) out.push([hit[0] + run, floor]);
  return out;
}

/**
 * Hai chân quỳ tới đâu, `0..1`: đáy gối (`knee` cách sàn `floor` trừ bán kính gối `r`, y xuống) sát sàn dưới
 * `APRON_KNEEL[0]` px và ống chân chĩa ra sau (cổ chân `foot` sau gối quá nửa ống chân) là `1`; trung bình hai chân
 */
export function kneelOn(legs: readonly { knee: V3; foot: V3 }[], floor: number, r: number) {
  const step = (u: number) => {
    const v = Math.min(1, Math.max(0, u));
    return v * v * (3 - 2 * v);
  };
  const [k0, k1] = APRON_KNEEL;
  let s = 0;
  for (const { knee, foot } of legs) {
    const shin = Math.hypot(foot[0] - knee[0], foot[1] - knee[1], foot[2] - knee[2]) || 1;
    s +=
      step((k1 - (floor - knee[1] - r)) / (k1 - k0)) *
      step(((knee[2] - foot[2]) / shin - 0.2) / 0.3);
  }
  return legs.length ? s / legs.length : 0;
}

/** Mặt trước của mặt cắt lồi `pts` (`[tiến, y xuống]`) ở độ cao `y`: bề tiến lớn nhất; ngoài mặt cắt là `undefined` */
export function sectionFront(pts: readonly P2[], y: number) {
  let z: number | undefined;
  for (const p of pts)
    for (const q of pts) {
      if (p[1] > y || q[1] < y) continue;
      const u = q[1] === p[1] ? 0 : (y - p[1]) / (q[1] - p[1]);
      const v = p[0] + (q[0] - p[0]) * u;
      if (z === undefined || v > z) z = v;
    }
  return z;
}

/** Một khối ellipsoid của nơ: tâm, nửa trục (hệ thân, px), lăn quanh trục tiến bấy nhiêu độ */
export interface BowLobe {
  c: V3;
  r: V3;
  roll: number;
}

/**
 * Nơ buộc sau lưng của tạp dề, cánh dài `size` px, tâm `c` trên mặt lưng (hệ thân, `z` ra trước ngực nên nơ nhô về `−z`):
 * hai cánh, nút giữa, hai đuôi ngắn chĩa xuống — khối cứng, không rủ
 */
export function apronBow(c: V3, size: number): BowLobe[] {
  const L = size;
  const at = (dx: number, dy: number, dz: number): V3 => [c[0] + dx, c[1] + dy, c[2] - dz];
  return [
    ...[-1, 1].map((s) => ({
      c: at(s * 0.62 * L, -0.08 * L, 0.2 * L),
      r: [0.58 * L, 0.3 * L, 0.17 * L] as V3,
      roll: s * 14,
    })),
    { c: at(0, 0, 0.26 * L), r: [0.2 * L, 0.24 * L, 0.2 * L], roll: 0 },
    ...[-1, 1].map((s) => ({
      c: at(s * 0.26 * L, 0.6 * L, 0.14 * L),
      r: [0.13 * L, 0.5 * L, 0.08 * L] as V3,
      roll: s * 16,
    })),
  ];
}
