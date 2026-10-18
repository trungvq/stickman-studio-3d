import { D } from "./constants";
import type { Garment, Pattern } from "./schema";
import type { MarkFill, P2, SP, Surface } from "./torso";

/**
 * Độ nổi khỏi mặt khối của mảng áo, px: lớp `under` từ `under`, lớp `over` từ `over`, mỗi mảng sau cao thêm `step`,
 * hoạ tiết nằm trên nền mảng thêm `pattern` mỗi lớp. Mảng da nổi ít nhất `skin`: vỏ viền cổ người 3D cắm xiên qua mặt vát,
 * da nổi thấp thì vỏ ấy lòi qua thành chấm mực. Đặc điểm của kiểu nổi `0.3`, hình in `0.8`
 */
export const PANEL_LIFT = { under: 0.16, over: 0.36, step: 0.03, pattern: 0.01, skin: 1 } as const;

export interface PanelFill {
  /** Polygon kín trên mặt khối, điểm cuối trùng điểm đầu */
  pts: SP[];
  fill: MarkFill;
  lift: number;
}

export interface PanelParts {
  fills: PanelFill[];
  /** Nét viền nổi `lift` px, trên nền mảng của nó */
  lines: { pts: SP[]; k: number; lift: number }[];
}

/** Chia nhỏ một đoạn cong `C`/`Q` bấy nhiêu khúc */
const CURVE_STEPS = 10;

/** Path SVG `M L H V C Q Z` (tuyệt đối và tương đối) thành các polygon con */
export function flattenPath(d: string): P2[][] {
  const tokens = d.match(/[MLHVCQZmlhvcqz]|-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const out: P2[][] = [];
  let cur: P2[] = [];
  let [x, y] = [0, 0];
  let cmd = "";
  let i = 0;
  const num = () => Number(tokens[i++]);
  const flush = () => {
    if (cur.length > 2) out.push(cur);
    cur = [];
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const [ox, oy] = rel ? [x, y] : [0, 0];
    switch (cmd.toUpperCase()) {
      case "M":
        flush();
        [x, y] = [ox + num(), oy + num()];
        cur.push([x, y]);
        cmd = rel ? "l" : "L";
        break;
      case "L":
        [x, y] = [ox + num(), oy + num()];
        cur.push([x, y]);
        break;
      case "H":
        x = (rel ? x : 0) + num();
        cur.push([x, y]);
        break;
      case "V":
        y = (rel ? y : 0) + num();
        cur.push([x, y]);
        break;
      case "C":
      case "Q": {
        const n = cmd.toUpperCase() === "C" ? 3 : 2;
        const p: P2[] = [[x, y]];
        for (let k = 0; k < n; k++) p.push([ox + num(), oy + num()]);
        for (let s = 1; s <= CURVE_STEPS; s++) {
          const u = s / CURVE_STEPS;
          const w =
            n === 3
              ? [(1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3]
              : [(1 - u) ** 2, 2 * u * (1 - u), u * u];
          cur.push([0, 1].map((c) => w.reduce((a, wk, k) => a + wk * p[k][c], 0)) as P2);
        }
        [x, y] = p[n];
        break;
      }
      case "Z":
        if (cur.length) [x, y] = cur[0];
        flush();
        break;
      default:
        i++;
    }
  }
  flush();
  return out;
}

/** Cắt polygon theo nửa mặt phẳng `f(p) ≥ 0`, `f` tuyến tính */
export function clipHalf(poly: P2[], f: (p: P2) => number): P2[] {
  const out: P2[] = [];
  poly.forEach((p, i) => {
    const q = poly[(i + 1) % poly.length];
    const [a, b] = [f(p), f(q)];
    if (a >= 0) out.push(p);
    if (a >= 0 !== b >= 0) {
      const u = a / (a - b);
      out.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]);
    }
  });
  return out;
}

const area = (poly: P2[]) =>
  poly.reduce((s, p, i) => {
    const q = poly[(i + 1) % poly.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;

/** Tam giác hoá polygon đơn (lồi hay lõm) bằng cắt tai; trả các tam giác */
export function triangulate(poly: P2[]): [P2, P2, P2][] {
  const pts = poly.filter((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-9;
  });
  const s = Math.sign(area(pts)) || 1;
  const idx = pts.map((_, i) => i);
  const cross = (a: P2, b: P2, c: P2) =>
    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const out: [P2, P2, P2][] = [];
  let guard = idx.length * idx.length;
  while (idx.length > 3 && guard-- > 0) {
    let cut = false;
    for (let k = 0; k < idx.length; k++) {
      const [a, b, c] = [
        idx[(k + idx.length - 1) % idx.length],
        idx[k],
        idx[(k + 1) % idx.length],
      ].map((i) => pts[i]);
      if (s * cross(a, b, c) <= 1e-12) continue;
      const inside = idx.some((i) => {
        const p = pts[i];
        if (p === a || p === b || p === c) return false;
        return s * cross(a, b, p) > 0 && s * cross(b, c, p) > 0 && s * cross(c, a, p) > 0;
      });
      if (inside) continue;
      out.push([a, b, c]);
      idx.splice(k, 1);
      cut = true;
      break;
    }
    // còn toàn đỉnh thẳng hàng hay chồng nhau: bỏ một đỉnh
    if (!cut) idx.splice(0, 1);
  }
  if (idx.length === 3) out.push([pts[idx[0]], pts[idx[1]], pts[idx[2]]]);
  return out;
}

/** Cắt polygon bất kỳ theo một polygon lồi */
export function clipConvex(poly: P2[], hull: P2[]): P2[] {
  const s = Math.sign(area(hull)) || 1;
  return hull.reduce((acc, a, i) => {
    if (acc.length < 3) return [];
    const b = hull[(i + 1) % hull.length];
    return clipHalf(
      acc,
      (p) => s * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])),
    );
  }, poly);
}

/** Chèn điểm để mỗi cạnh không dài quá `step` */
function densify(poly: P2[], step: number, closed = true): P2[] {
  const out: P2[] = [];
  const n = closed ? poly.length : poly.length - 1;
  for (let i = 0; i < n; i++) {
    const [p, q] = [poly[i], poly[(i + 1) % poly.length]];
    const m = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / step));
    for (let j = 0; j < m; j++)
      out.push([p[0] + ((q[0] - p[0]) * j) / m, p[1] + ((q[1] - p[1]) * j) / m]);
  }
  out.push(closed ? poly[0] : poly[poly.length - 1]);
  return out;
}

/** Các mảnh hoạ tiết trong polygon `poly` (px), gốc `o`: mỗi mảnh kèm màu và bậc lớp trên nền mảng */
export function patternCells(
  poly: P2[],
  pt: Pattern,
  o: P2,
): { poly: P2[]; fill: MarkFill; tier: number }[] {
  const P = pt.width + pt.gap;
  // cắt Sutherland–Hodgman chỉ đúng với polygon lồi: chia mảng thành tam giác rồi cắt từng tam giác
  const tris = triangulate(poly);
  const span = (n: P2) => {
    const c = poly.map((p) => n[0] * (p[0] - o[0]) + n[1] * (p[1] - o[1]) - pt.offset);
    return [Math.floor(Math.min(...c) / P) - 1, Math.ceil(Math.max(...c) / P) + 1];
  };
  const normal = (deg: number): P2 => [Math.sin(deg * D), Math.cos(deg * D)];
  const band = (src: P2[], n: P2, k: number): P2[] => {
    const c0 = k * P + pt.offset;
    const along = (p: P2) => n[0] * (p[0] - o[0]) + n[1] * (p[1] - o[1]);
    return clipHalf(
      clipHalf(src, (p) => along(p) - c0),
      (p) => c0 + pt.width - along(p),
    );
  };
  const out: { poly: P2[]; fill: MarkFill; tier: number }[] = [];
  const push = (p: P2[], fill: MarkFill, tier: number) => {
    if (p.length > 2 && Math.abs(area(p)) > 0.05) out.push({ poly: p, fill, tier });
  };
  if (pt.kind === "dots") {
    const [n, d] = [normal(pt.angle), normal(pt.angle + 90)];
    const [j0, j1] = span(n);
    const [i0, i1] = span(d);
    const r = pt.width / 2;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const u = (i + (j % 2 ? 0.5 : 0)) * P + pt.offset;
        const v = j * P + pt.offset;
        const c: P2 = [o[0] + d[0] * u + n[0] * v, o[1] + d[1] * u + n[1] * v];
        const disc = Array.from({ length: 14 }, (_, k): P2 => {
          const a = (2 * Math.PI * k) / 14;
          return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
        });
        for (const t of tris) push(clipConvex(t, disc), pt.color, 1);
      }
    return out;
  }
  const sets = pt.kind === "check" ? [pt.angle, pt.angle + 90] : [pt.angle];
  sets.forEach((deg, s) => {
    const n = normal(deg);
    const [k0, k1] = span(n);
    for (let k = k0; k <= k1; k++) for (const t of tris) push(band(t, n, k), pt.color, s + 1);
  });
  if (pt.kind === "check" && pt.cross && pt.cross !== pt.color) {
    const [n1, n2] = [normal(pt.angle), normal(pt.angle + 90)];
    const [a0, a1] = span(n1);
    const [b0, b1] = span(n2);
    for (const t of tris)
      for (let a = a0; a <= a1; a++) {
        const strip = band(t, n1, a);
        if (strip.length < 3) continue;
        for (let b = b0; b <= b1; b++) push(band(strip, n2, b), pt.cross, 3);
      }
  }
  return out;
}

/** Bước tích phân cung ellipse từ giữa ra sườn */
const ARC_STEPS = 24;

/**
 * Kinh độ (độ, `0..90`) của điểm cách đường giữa `s` px đo dọc tiết diện ellipse nửa rộng `a`, nửa sâu `d`; quá sườn thì
 * `90` và `edge`
 */
export function arcLon(a: number, d: number, s: number): { lon: number; edge: boolean } {
  let acc = 0;
  for (let i = 0; i < ARC_STEPS; i++) {
    const [t0, t1] = [(i / ARC_STEPS) * (Math.PI / 2), ((i + 1) / ARC_STEPS) * (Math.PI / 2)];
    const tm = (t0 + t1) / 2;
    const ds = Math.hypot(a * Math.cos(tm), d * Math.sin(tm)) * (t1 - t0);
    if (acc + ds >= s) return { lon: (t0 + ((s - acc) / (ds || 1)) * (t1 - t0)) / D, edge: false };
    acc += ds;
  }
  return { lon: 90, edge: true };
}

/** Viền cổ trên mặt khối theo kinh độ: `y` của viền cổ ở kinh độ `lon` */
function necklineAt(s: Surface) {
  const tab = Array.from({ length: 721 }, (_, i) => s.neck(-180 + i / 2)).map(([lon, y]): P2 => [
    ((((lon + 180) % 360) + 360) % 360) - 180,
    y,
  ]);
  tab.sort((p, q) => p[0] - q[0]);
  return (lon: number) => {
    const l = ((((lon + 180) % 360) + 360) % 360) - 180;
    let i = 1;
    while (i < tab.length - 1 && tab[i][0] < l) i++;
    const [p, q] = [tab[i - 1], tab[i]];
    return p[1] + ((q[1] - p[1]) * (l - p[0])) / (q[0] - p[0] || 1);
  };
}

/**
 * Mảng áo (`garment.panels`) trên mặt khối `s`: polygon nền, các mảnh hoạ tiết và nét viền, toạ độ mặt khối. Nét viền
 * không chạy dọc mép khối — mép trên, gấu, sườn chỗ mặt trước gặp mặt sau, đường nối sau lưng của mảng cả thân —, chạy
 * dọc chỗ cắt theo viền cổ
 */
export function panelParts(s: Surface, g: Garment, height: number): PanelParts {
  const out: PanelParts = { fills: [], lines: [] };
  const panels = g.panels ?? [];
  if (!panels.length) return out;
  const neckY = necklineAt(s);
  /** px trên mặt khối mỗi độ kinh, đo ở nửa rộng ngang ngực: hoạ tiết của mảng quanh khối đo bằng px */
  const R = s.a(s.t(0.3)) * D;
  const EPS = 1e-3;
  const order = { under: 0, over: 0 };
  for (const p of panels) {
    const base = PANEL_LIFT[p.layer] + PANEL_LIFT.step * order[p.layer]++;
    const lift = p.fill === "skin" ? Math.max(PANEL_LIFT.skin, base) : base;
    const whole = !p.pts && !p.path;
    const around = whole || p.side === "around";
    const yOf = (y: number) => (p.from === "neck" ? s.top() + y : -y * height);
    let polys: P2[][];
    if (whole)
      polys = [
        [
          [-180 * R, s.yC],
          [180 * R, s.yC],
          [180 * R, s.yH],
          [-180 * R, s.yH],
        ],
      ];
    else if (p.path) {
      const [w, h] = [p.width ?? p.size, p.height ?? p.size];
      const [cs, sn] = [Math.cos(p.rotate * D), Math.sin(p.rotate * D)];
      const [cx, cy] = [around ? p.x * R : p.x, yOf(p.y)];
      polys = flattenPath(p.path).map((sub) =>
        sub.map(([u, v]): P2 => {
          const [lu, lv] = [(u / 100 - 0.5) * w, (v / 100 - 0.5) * h];
          return [cx + lu * cs - lv * sn, cy + lu * sn + lv * cs];
        }),
      );
    } else polys = [p.pts!.map(([x, y]): P2 => [around ? x * R : x, yOf(y)])];
    if (p.mirror && !whole)
      polys = [...polys, ...polys.map((q) => q.map(([x, y]): P2 => [-x, y]).reverse())];
    const sides: ("front" | "back" | "around")[] = around
      ? ["around"]
      : p.side === "both"
        ? ["front", "back"]
        : [p.side as "front" | "back"];
    for (const side of sides) {
      /** Điểm px của mảng ra mặt khối, kèm cờ nằm trên mép khối */
      const onBody = ([x, y0]: P2): { sp: SP; bound: boolean } => {
        const y = Math.min(s.yH, Math.max(s.yC, y0));
        let bound = y0 <= s.yC + EPS || y0 >= s.yH - EPS;
        let sp: SP;
        if (side === "around") {
          sp = [x / R, y];
          if (whole && Math.abs(Math.abs(x / R) - 180) < EPS) bound = true;
        } else if (s.depth) {
          // đo dọc mặt khối từ đường giữa: mảng đặt theo px trên mặt vải, sườn không dồn
          const back = side === "back";
          const { lon, edge } = arcLon(
            Math.max(s.a(y), 1e-6),
            Math.max(s.depth(y, back), 1e-6),
            Math.abs(x),
          );
          if (edge) bound = true;
          const l = Math.sign(x) * lon;
          sp = [back ? 180 - l : l, y];
        } else {
          if (Math.abs(x) >= s.a(y) - EPS) bound = true;
          sp = s.at(x, y, side === "back");
        }
        if (p.clip !== "none") {
          const n = neckY(sp[0]);
          const y = p.clip === "neck" ? Math.min(sp[1], n) : Math.max(sp[1], n);
          // điểm dồn lên viền cổ nằm trên mép cắt thật, có nét
          if (Math.abs(y - sp[1]) > EPS) bound = false;
          sp = [sp[0], y];
        }
        return { sp, bound };
      };
      const step = 2;
      const fill = (poly: P2[], f: MarkFill, l: number) => {
        if (poly.length < 3 || Math.abs(area(poly)) < 0.05) return;
        const pts = densify(poly, step).map((q) => onBody(q).sp);
        const a = Math.abs(area(pts.slice(0, -1)));
        if (a > 1e-3) out.fills.push({ pts, fill: f, lift: l });
      };
      for (const poly of polys) {
        if (p.fill) fill(poly, p.fill, lift);
        if (p.pattern) {
          const origin: P2 = [0, s.top()];
          for (const c of patternCells(poly, p.pattern, origin))
            fill(c.poly, c.fill, lift + PANEL_LIFT.pattern * c.tier);
        }
        if (p.line > 0) {
          const pts = densify(poly, step).map(onBody);
          let run: SP[] = [];
          const flush = () => {
            if (run.length > 1) out.lines.push({ pts: run, k: p.line, lift: lift + 0.2 });
            run = [];
          };
          pts.forEach((q, i) => {
            const prev = pts[i - 1];
            if (prev && prev.bound && q.bound) flush();
            else {
              if (!run.length && prev) run.push(prev.sp);
              if (prev || !run.length) run.push(q.sp);
            }
          });
          flush();
        }
      }
    }
  }
  return out;
}
