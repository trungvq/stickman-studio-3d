import { D, HEM_HANG } from "./constants";
import { ApronSchema, WrapHemSchema, type Skirt, type WrapHem } from "./schema";

type P2 = readonly [number, number];
type V3 = [number, number, number];

/** Bộ số vạt dài quấn đã đủ */
export const wrapHemOf = (g: Pick<Skirt, "wrap">) => WrapHemSchema.parse(g.wrap ?? {});
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

/**
 * Vải buông từ mép trên `top` phủ qua vật có mặt cắt dọc `pts` (`[tiến, y xuống]`): chuỗi đỉnh bao lồi của `top`, `pts`
 * và bóng rơi thẳng xuống của chúng, từ `top` vòng phía trước tới chỗ vải rời vật. Sau đỉnh cuối vải rủ thẳng xuống
 */
export function drape(top: P2, pts: readonly P2[]): P2[] {
  const real = [top, ...pts];
  const floor = Math.max(...real.map((p) => p[1])) + 1e4;
  const all = [...real, ...real.map((p): P2 => [p[0], floor])];
  const path: P2[] = [top];
  let c = top;
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
