import { D, INK } from "./constants";
import { DrapeSchema, ShadesSchema, type Drape, type Shades } from "./schema";
import { curve, lerp, type MarkFill, type SP, type Surface } from "./torso";
import { gridTris, roundRect, signedVolume } from "./wrap";
import type { Vec3 } from "./sphere";

/** Khăn nằm cách mặt thân, nắp vai bấy nhiêu px */
export const DRAPE_GAP = 1.5;

/**
 * Khối thân mà khăn vắt vai đè lên, hệ nhóm thân (px, gốc ở hông, `y` xuống, `z` ra trước ngực): mặt khối, nửa sâu nửa
 * sau và nửa trước theo `y`, nắp vai (tâm `[x, y]` của gốc tay bên `+x`, bán kính) nếu có
 */
export interface DrapeBody {
  s: Surface;
  depth: (y: number) => number;
  front: (y: number) => number;
  shoulder?: { at: readonly [number, number]; r: number };
  /** `rig.height` */
  height: number;
}

/**
 * Khăn vắt vai dựng khối: một dải dày `thick` vắt qua vai bên `side`, từ ngực qua đỉnh vai xuống lưng. Mỗi lát dọc của
 * khăn (mặt phẳng cách trục một `x`) là bao của thân áo và nắp vai nở `DRAPE_GAP`, nhìn từ một tâm trong thân ngang gốc vai;
 * dưới tâm ấy vải rủ thẳng: xuống tới đâu cũng không lùi vào gần thân hơn chỗ nhô nhất phía trên (ngực, bụng phệ). Khăn
 * dài `front`, `back` tính từ đỉnh vai dọc lát giữa. Trả khối kín, tam giác quấn ra ngoài; `null` khi không có chỗ trên vai
 */
export function drapeSolid(
  b: DrapeBody,
  raw: Partial<Drape>,
): { pts: Vec3[]; tris: number[] } | null {
  const d = DrapeSchema.parse(raw);
  const { s } = b;
  const h = b.height;
  const sx = d.side === "left" ? 1 : -1;
  const neck = s.g.neck;
  const xOut = b.shoulder ? b.shoulder.at[0] : s.a(s.yS);
  const xc = lerp(neck + d.width / 2, xOut - d.width / 4, d.at);
  if (!(xOut > neck)) return null;
  const yc = b.shoulder ? b.shoulder.at[1] : s.yS;
  const inside = (x: number, y: number, z: number) => {
    if (b.shoulder) {
      const [bx, by] = b.shoulder.at;
      const r = b.shoulder.r + DRAPE_GAP;
      if ((x - bx) ** 2 + (y - by) ** 2 + z * z <= r * r) return true;
    }
    if (y < s.yC || y > s.yH) return false;
    const a = s.a(y) + DRAPE_GAP;
    const dz = (z > 0 ? b.front(y) : b.depth(y)) + DRAPE_GAP;
    return (x / a) ** 2 + (z / dz) ** 2 <= 1;
  };
  /** Mặt ngoài của thân và nắp vai đã nở ở `y` trong lát `x`, phía trước (`1`) hay sau (`-1`): `0` khi lát không cắt */
  const surf = (x: number, y: number, side: 1 | -1) => {
    let z = 160;
    while (z > 0 && !inside(x, y, side * z)) z -= 2;
    if (z <= 0) return 0;
    let [lo, hi] = [z, z + 2];
    for (let k = 0; k < 12; k++) {
      const m = (lo + hi) / 2;
      if (inside(x, y, side * m)) lo = m;
      else hi = m;
    }
    return lo;
  };
  const NK = 4;
  const STEP = 1;
  /** Lát dọc ở `x`: đường `[y, z]` từ mút trước qua đỉnh vai xuống mút sau, mỗi đoạn chừng `STEP` px */
  const slice = (x: number): [number, number][] => {
    const arc: [number, number][] = [];
    for (let i = 0; i <= 90; i++) {
      const th = (Math.PI * i) / 90;
      const [dy, dz] = [-Math.sin(th), Math.cos(th)];
      let [lo, hi] = [0, 300];
      for (let k = 0; k < 40; k++) {
        const m = (lo + hi) / 2;
        if (inside(x, yc + dy * m, dz * m)) lo = m;
        else hi = m;
      }
      arc.push([yc + dy * lo, dz * lo]);
    }
    const hang = (side: 1 | -1) => {
      const out: [number, number][] = [];
      let z = Math.abs(side > 0 ? arc[0][1] : arc[arc.length - 1][1]);
      for (let y = yc + STEP; y <= yc + (Math.max(d.front, d.back) + 20) * h; y += STEP) {
        z = Math.max(z, surf(x, y, side));
        out.push([y, side * z]);
      }
      return out;
    };
    return [...hang(1).reverse(), ...arc, ...hang(-1)];
  };
  /** Điểm cách đỉnh vai `t` px dọc đường (âm về phía trước), và hướng đi ở đó */
  const along = (line: [number, number][]) => {
    const len = [0];
    for (let i = 1; i < line.length; i++)
      len.push(len[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]));
    let top = 0;
    for (let i = 1; i < line.length; i++) if (line[i][0] < line[top][0]) top = i;
    return (t: number): [number, number, number, number] => {
      const L = Math.max(0, Math.min(len[len.length - 1], len[top] + t));
      let i = 1;
      while (i < len.length - 1 && len[i] < L) i++;
      const u = (L - len[i - 1]) / (len[i] - len[i - 1] || 1);
      const [p, q] = [line[i - 1], line[i]];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      return [lerp(p[0], q[0], u), lerp(p[1], q[1], u), (q[0] - p[0]) / l, (q[1] - p[1]) / l];
    };
  };
  const xs = Array.from({ length: NK + 1 }, (_, k) => xc + d.width * (k / NK - 0.5));
  const lines = xs.map((x) => along(slice(x)));
  const [f, bk] = [d.front * h, d.back * h];
  const n = Math.max(8, Math.ceil((f + bk) / 3));
  const rings = Array.from({ length: n + 1 }, (_, j) => {
    const t = -f + ((f + bk) * j) / n;
    const inner = xs.map((x, k): Vec3 => {
      const [y, z] = lines[k](t);
      return [sx * x, y, z];
    });
    const outer = xs.map((x, k): Vec3 => {
      const [y, z, ty, tz] = lines[k](t);
      // pháp tuyến trong lát quay ra ngoài thân: vuông góc hướng đi, cùng phía với điểm so với tâm
      let [ny, nz] = [-tz, ty];
      if (ny * (y - yc) + nz * z < 0) [ny, nz] = [-ny, -nz];
      return [sx * x, y + ny * d.thick, z + nz * d.thick];
    });
    return [...inner, ...outer.reverse()];
  });
  return closed(rings);
}

/** Khối kín từ các vòng cùng số điểm nối nhau, bịt hai đầu bằng quạt tới trọng tâm vòng; tam giác quấn ra ngoài */
function closed(rings: Vec3[][]) {
  const n = rings.length - 1;
  const m = rings[0].length;
  const pts = rings.flat();
  const tris = gridTris(n + 1, m, false, true);
  for (const [j, sgn] of [
    [0, 1],
    [n, -1],
  ]) {
    const c = rings[j].reduce(
      (a, p): Vec3 => [a[0] + p[0] / m, a[1] + p[1] / m, a[2] + p[2] / m],
      [0, 0, 0],
    );
    const ci = pts.push(c) - 1;
    for (let k = 0; k < m; k++) {
      const [p, q] = [j * m + k, j * m + ((k + 1) % m)];
      tris.push(ci, ...(sgn > 0 ? [p, q] : [q, p]));
    }
  }
  if (signedVolume(pts, tris) < 0)
    for (let i = 0; i < tris.length; i += 3)
      [tris[i + 1], tris[i + 2]] = [tris[i + 2], tris[i + 1]];
  return { pts, tris };
}

/** Kính gài nẹp: mặt kính nổi khỏi mặt thân bấy nhiêu px, dày bấy nhiêu px */
export const SHADES_LIFT = 1.4;
export const SHADES_THICK = 1.4;

/**
 * Kính râm gài nẹp áo dựng khối: hai mắt kính, cầu kính và một gọng gài lên đáy cổ áo, dán trên mặt thân (`raise`: điểm
 * mặt khối nổi `lift` px theo pháp tuyến). Gọng ở bên `side` mọc từ góc trên ngoài của mắt kính bên ấy lên khe nẹp; cả
 * kính nghiêng `tilt` độ, mắt kính bên kia trễ xuống. Mỗi phần là một khối dẹt kín; mắt kính màu `lens`, cầu và gọng màu mực
 */
export function shadesSolids(
  b: Pick<DrapeBody, "s"> & { raise: (sp: SP, lift: number) => Vec3 },
  raw: Partial<Shades>,
): { pts: Vec3[]; tris: number[]; color: MarkFill }[] {
  const g = ShadesSchema.parse(raw);
  const { s } = b;
  const sx = g.side === "left" ? 1 : -1;
  const h = g.size;
  const w = g.shape === "round" ? h : h * 1.3;
  const gap = h * 0.55;
  const yV = s.top() + s.g.neckFront;
  /** Bản lề gọng: góc trên ngoài mắt kính bên gài */
  const A: [number, number] = [sx * 5, yV + g.y];
  const th = -sx * g.tilt * D;
  const [c, sn] = [Math.cos(th), Math.sin(th)];
  /** Toạ độ kính (gốc ở bản lề, `y` xuống) ra hình phẳng của mặt thân */
  const place = ([x, y]: [number, number]): [number, number] => [
    A[0] + x * c - y * sn,
    A[1] + x * sn + y * c,
  ];
  const slab = (outline: [number, number][], color: MarkFill, lift = SHADES_LIFT) => {
    const flat = outline.map(place);
    const rings = [lift, lift + SHADES_THICK].map((l) =>
      flat.map(([x, y]) => b.raise(s.at(x, y), l)),
    );
    return { ...closed(rings), color };
  };
  const lensAt = (cx: number) =>
    g.shape === "round"
      ? curve(23, (u) => 2 * Math.PI * u * (1 - 1 / 24)).map((t): [number, number] => [
          cx + w * Math.cos(t),
          h + h * Math.sin(t),
        ])
      : roundRect(cx, h, w, h, h * 0.45, 4);
  const near = -sx * w;
  const far = near - sx * (2 * w + gap);
  const bridge = roundRect(near - sx * (w + gap / 2), h * 0.45, gap / 2 + 1, 0.9, 0.8, 2);
  // gọng: dải mảnh từ bản lề lên khe nẹp ở đáy cổ áo
  const hook: [number, number] = [sx * 1.5 - A[0], yV + 0.5 - A[1]];
  const [hx, hy] = [hook[0] * c + hook[1] * sn, -hook[0] * sn + hook[1] * c];
  const l = Math.hypot(hx, hy) || 1;
  const [px, py] = [(-hy / l) * 0.9, (hx / l) * 0.9];
  const arm: [number, number][] = [
    [px, py],
    [hx + px, hy + py],
    [hx - px, hy - py],
    [-px, -py],
  ];
  const lens = g.lens as MarkFill;
  return [
    slab(lensAt(near), lens),
    slab(lensAt(far), lens),
    slab(bridge, INK as MarkFill),
    slab(arm, INK as MarkFill, SHADES_LIFT + SHADES_THICK * 0.5),
  ];
}
