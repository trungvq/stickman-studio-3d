import { D } from "./constants";
import type { HeadShape, Pt } from "./types";

interface HeadProps {
  shape: HeadShape;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

/** Đa giác bo góc: mỗi đỉnh thay bằng một cung Q bán kính r */
function roundedPolygon(pts: [number, number][], r: number) {
  const n = pts.length;
  const d: string[] = [];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pts[(i + n - 1) % n];
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % n];
    const cut = (ax: number, ay: number, bx: number, by: number) => {
      const len = Math.hypot(bx - ax, by - ay);
      const k = Math.min(r, len / 2) / len;
      return [ax + (bx - ax) * k, ay + (by - ay) * k];
    };
    const [ix, iy] = cut(x1, y1, x0, y0);
    const [ox, oy] = cut(x1, y1, x2, y2);
    d.push(`${i === 0 ? "M" : "L"} ${ix} ${iy} Q ${x1} ${y1} ${ox} ${oy}`);
  }
  return d.join(" ") + " Z";
}

/** Đường bao đầu; râu quai nón cắt theo chính đường này */
export function headPath(shape: HeadShape, cx: number, cy: number, rx: number, ry: number) {
  const corner = Math.min(rx, ry) * 0.35;
  switch (shape) {
    case "round":
      return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 1 ${cx - rx} ${cy} Z`;
    case "square": {
      const l = cx - rx;
      const r = cx + rx;
      const t = cy - ry;
      const b = cy + ry;
      const a = `A ${corner} ${corner} 0 0 1`;
      return `M ${l + corner} ${t} L ${r - corner} ${t} ${a} ${r} ${t + corner}
        L ${r} ${b - corner} ${a} ${r - corner} ${b}
        L ${l + corner} ${b} ${a} ${l} ${b - corner}
        L ${l} ${t + corner} ${a} ${l + corner} ${t} Z`;
    }
    case "trapezoid": {
      const chin = rx * 0.72;
      return roundedPolygon(
        [
          [cx - rx, cy - ry],
          [cx + rx, cy - ry],
          [cx + chin, cy + ry],
          [cx - chin, cy + ry],
        ],
        corner,
      );
    }
  }
}

/** Điểm trên đường bao đầu theo hướng `deg` (0 = thẳng lên, dương về +x); bỏ qua bo góc */
export function headPoint(
  shape: HeadShape,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  deg: number,
): Pt {
  const ux = Math.sin(deg * D);
  const uy = -Math.cos(deg * D);
  let t: number;
  if (shape === "round") {
    t = 1 / Math.hypot(ux / rx, uy / ry);
  } else {
    // Cắt tia với từng nửa mặt phẳng [nx, ny, d] của đa giác lồi, lấy cạnh gần nhất
    const chin = shape === "trapezoid" ? rx * 0.72 : rx;
    const side = ry * (rx + chin);
    t = Infinity;
    for (const [nx, ny, d] of [
      [0, -1, ry],
      [0, 1, ry],
      [2 * ry, rx - chin, side],
      [-2 * ry, rx - chin, side],
    ]) {
      const den = nx * ux + ny * uy;
      if (den > 1e-6) t = Math.min(t, d / den);
    }
  }
  return [cx + ux * t, cy + uy * t];
}

/** Nửa bề ngang khối đầu ở độ cao `dy` dưới tâm; bỏ qua bo góc */
export function headHalfWidth(shape: HeadShape, rx: number, ry: number, dy: number): number {
  const v = Math.max(-1, Math.min(1, dy / ry));
  if (shape === "round") return rx * Math.sqrt(1 - v * v);
  if (shape === "square") return rx;
  return rx * (1 - 0.14 * (v + 1));
}

export function Head({ shape, cx, cy, rx, ry, ...paint }: HeadProps) {
  return <path d={headPath(shape, cx, cy, rx, ry)} {...paint} />;
}

export const HEAD_SHAPES: HeadShape[] = ["round", "square", "trapezoid"];

/** Điểm dày trên đường bao đầu, cùng hình học với `headPath`; tâm đầu ở gốc */
function outlinePoints(shape: HeadShape, rx: number, ry: number): Pt[] {
  const corner = Math.min(rx, ry) * 0.35;
  const pts: Pt[] = [];
  if (shape === "square") {
    const arcs: [number, number, number][] = [
      [rx - corner, -(ry - corner), -90],
      [rx - corner, ry - corner, 0],
      [-(rx - corner), ry - corner, 90],
      [-(rx - corner), -(ry - corner), 180],
    ];
    for (const [cx, cy, a0] of arcs)
      for (let i = 0; i <= 8; i++) {
        const a = (a0 + (i / 8) * 90) * D;
        pts.push([cx + Math.cos(a) * corner, cy + Math.sin(a) * corner]);
      }
    return pts;
  }
  const chin = rx * 0.72;
  const poly: Pt[] = [
    [-rx, -ry],
    [rx, -ry],
    [chin, ry],
    [-chin, ry],
  ];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[(i + n - 1) % n];
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % n];
    const cut = (bx: number, by: number): Pt => {
      const len = Math.hypot(bx - x1, by - y1);
      const k = Math.min(corner, len / 2) / len;
      return [x1 + (bx - x1) * k, y1 + (by - y1) * k];
    };
    const a = cut(x0, y0);
    const b = cut(x2, y2);
    for (let j = 0; j <= 8; j++) {
      const t = j / 8;
      const u = 1 - t;
      pts.push([
        u * u * a[0] + 2 * u * t * x1 + t * t * b[0],
        u * u * a[1] + 2 * u * t * y1 + t * t * b[1],
      ]);
    }
  }
  return pts;
}

/** Khoảng từ tâm tới đường bao lồi `pts` theo hướng `(ux, uy)` */
function rayTo(pts: Pt[], ux: number, uy: number): number {
  let best = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const ex = bx - ax;
    const ey = by - ay;
    const den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = (ax * ey - ay * ex) / den;
    const s = (ax * uy - ay * ux) / den;
    if (t > 0 && s >= -1e-6 && s <= 1 + 1e-6) best = Math.min(best, t);
  }
  return best;
}

/**
 * Nắn đĩa đơn vị thành khối đầu: điểm `(x, y)` của sọ đơn vị đã chiếu (`y` lên) ra độ lệch px
 * khỏi tâm đầu. Tròn là kéo giãn theo `rx`, `ry`; dạng khác đẩy theo tia từ tâm ra đúng viền
 * của `headPath`, nên vỏ tóc ôm viền đầu ở mọi góc xoay.
 */
export function headWarp(shape: HeadShape, rx: number, ry: number): (x: number, y: number) => Pt {
  if (shape === "round") return (x, y) => [x * rx, -y * ry];
  const pts = outlinePoints(shape, rx, ry);
  const N = 256;
  const ratio = Array.from({ length: N + 1 }, (_, i) => {
    const a = (i / N) * 2 * Math.PI;
    const dx = Math.cos(a) * rx;
    const dy = -Math.sin(a) * ry;
    const len = Math.hypot(dx, dy);
    return rayTo(pts, dx / len, dy / len) / len;
  });
  return (x, y) => {
    const a = ((Math.atan2(y, x) / (2 * Math.PI)) % 1) + 1;
    const f = (a % 1) * N;
    const i = Math.floor(f);
    const k = ratio[i] + (ratio[i + 1] - ratio[i]) * (f - i);
    return [x * rx * k, -y * ry * k];
  };
}
