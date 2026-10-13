import { D } from "./constants";
import type { Wrap } from "./schema";
import { COLLAR_LINE, curve, lerp, type MarkFill, type SP, type Surface } from "./torso";
import type { Vec3 } from "./sphere";

/** Dải cổ nổi khỏi mặt khối bấy nhiêu px ở mép vạt và ở mép ngoài; cổ lót nằm thấp hơn */
export const WRAP_LIFT = [2.4, 1.4] as const;
export const WRAP_UNDER_LIFT = 1.6;
/** Da trong miệng cổ nổi khỏi mặt khối bấy nhiêu px */
export const WRAP_SKIN_LIFT = 1;
/** Mép vạt trên bẻ từ đường chéo sang thẳng đứng trong khoảng bấy nhiêu px */
export const WRAP_BEND = 14;

/** Khối thân mà cổ chéo bám: mặt khối, nửa sâu theo `y`, điểm nổi `lift` px theo pháp tuyến */
export interface WrapBody {
  s: Surface;
  depth: (y: number) => number;
  raise: (sp: SP, lift: number) => Vec3;
  /** `rig.height` */
  height: number;
}

export interface WrapParts {
  /** Tấm lưới cột × hàng, hàng `rims` có nét viền */
  sheets: { grid: Vec3[][]; rims: number[]; color: MarkFill; line: number }[];
  /** Khối kín: điểm, chỉ số tam giác quấn ra ngoài (hệ thân, `y` xuống) */
  solids: { pts: Vec3[]; tris: number[]; color: MarkFill }[];
}

/**
 * Mép vạt trên của áo cổ chéo trên hình phẳng, `x` theo `y`: từ bên cổ `+x` (vai trái người mặc) chéo qua giữa
 * ngực ở độ sâu `neckFront`, đi tiếp sang `−x` (hông phải người mặc) tới `−overlap` rồi thẳng xuống gấu. Vạt dưới
 * đối xứng qua trục, khuất dưới vạt trên quá chỗ giao
 */
export function wrapEdge(s: Surface, overlap: number) {
  const top = s.top();
  const nf = Math.max(1, s.g.neckFront);
  const slope = s.g.neck / nf;
  const x = (y: number) => {
    const a = s.g.neck - slope * (y - top);
    const h = Math.max(WRAP_BEND - Math.abs(a + overlap), 0) / WRAP_BEND;
    return Math.max(a, -overlap) + (h * h * WRAP_BEND) / 4;
  };
  return { top, cross: top + nf, x };
}

/** Tam giác của lưới `nu` cột × `nv` hàng xếp theo cột; `cu`, `cv` khép vòng theo cột, theo hàng */
export function gridTris(nu: number, nv: number, cu: boolean, cv: boolean) {
  const tris: number[] = [];
  for (let i = 0; i < (cu ? nu : nu - 1); i++)
    for (let j = 0; j < (cv ? nv : nv - 1); j++) {
      const [i1, j1] = [(i + 1) % nu, (j + 1) % nv];
      const [a, b, c, d] = [i * nv + j, i1 * nv + j, i1 * nv + j1, i * nv + j1];
      tris.push(a, b, c, a, c, d);
    }
  return tris;
}

/** Thể tích có dấu: dương là tam giác quấn ra ngoài */
export function signedVolume(pts: Vec3[], tris: number[]) {
  let v = 0;
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [pts[tris[i]], pts[tris[i + 1]], pts[tris[i + 2]]];
    v +=
      a[0] * (b[1] * c[2] - b[2] * c[1]) -
      a[1] * (b[0] * c[2] - b[2] * c[0]) +
      a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return v / 6;
}

const outward = (pts: Vec3[], tris: number[]) => {
  if (signedVolume(pts, tris) < 0)
    for (let i = 0; i < tris.length; i += 3)
      [tris[i + 1], tris[i + 2]] = [tris[i + 2], tris[i + 1]];
  return { pts, tris };
};

/** Vòng chữ nhật bo góc tâm `(cx, cy)`, nửa cạnh `hx`, `hy`, bán kính góc `r`; `n` điểm mỗi góc */
export function roundRect(cx: number, cy: number, hx: number, hy: number, r: number, n = 5) {
  const rr = Math.max(0.01, Math.min(r, hx, hy));
  const corners: [number, number, number][] = [
    [hx - rr, hy - rr, 0],
    [-(hx - rr), hy - rr, 90],
    [-(hx - rr), -(hy - rr), 180],
    [hx - rr, -(hy - rr), 270],
  ];
  return corners.flatMap(([x, y, a0]) =>
    curve(n, (u): [number, number] => {
      const t = (a0 + 90 * u) * D;
      return [cx + x + rr * Math.cos(t), cy + y + rr * Math.sin(t)];
    }),
  );
}

/**
 * Khối dẹt bo cạnh áp lên mặt cong: hình chữ nhật bo góc tâm `c`, nửa cạnh `hx`, `hy`, quay `rot` độ trên hình phẳng;
 * mặt trong nằm ở độ sâu `base(x)`, mặt ngoài phẳng, cách mặt trong ở tâm `t(v)` px (`v` từ mép trên `0` xuống mép dưới
 * `1`); cạnh bo bán kính `e`. `side` `1` phía trước ngực, `−1` sau lưng
 */
function plaque(
  c: [number, number],
  hx: number,
  hy: number,
  r: number,
  rot: number,
  t: (v: number) => number,
  base: (x: number) => number,
  side: 1 | -1,
  e: number,
) {
  const K = 6;
  const [cs, sn] = [Math.cos(rot * D), Math.sin(rot * D)];
  const rings = curve(K, (k) => {
    const th = Math.PI * k;
    const dl = e * (1 - Math.sin(th));
    const w = (1 - Math.cos(th)) / 2;
    return roundRect(0, 0, hx - dl, hy - dl, Math.max(0.3, r - dl)).map(([ox, oy]): Vec3 => {
      const [x, y] = [c[0] + ox * cs - oy * sn, c[1] + ox * sn + oy * cs];
      // mặt trong theo mặt cong, mặt ngoài phẳng ở độ sâu tâm khối
      return [x, y, side * lerp(base(x), base(c[0]) + t((oy + hy) / (2 * hy)), w)];
    });
  });
  const n = rings[0].length;
  const pts = rings.flat();
  // cột của lưới là vòng `k`, hàng là điểm trên vòng; nắp quạt quấn cùng chiều với cạnh vòng của lưới
  const tris = gridTris(K + 1, n, false, true);
  for (const [k, s] of [
    [0, 1],
    [K, -1],
  ]) {
    const ring = rings[k];
    const m = ring.reduce(
      (a, p): Vec3 => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n],
      [0, 0, 0],
    );
    const ci = pts.push(m) - 1;
    for (let j = 0; j < n; j++) {
      const [p, q] = [k * n + j, k * n + ((j + 1) % n)];
      tris.push(ci, ...(s > 0 ? [p, q] : [q, p]));
    }
  }
  return outward(pts, tris);
}

/** Cổ chéo, dải cổ, cổ lót, đai, dây buộc, khoá và nút đai của kiểu `wrap`, dựng trên khối thân `b` */
export function wrapParts(b: WrapBody, w: Wrap): WrapParts {
  const { s } = b;
  const out: WrapParts = { sheets: [], solids: [] };
  const e = wrapEdge(s, w.overlap);
  const yEnd = s.yH - 2;
  const width = w.under + w.band;
  /** Điểm cách mép vạt `d` px về phía thân vạt; `under` là vạt dưới, cắt ở mép vạt trên */
  const front = (y: number, d: number, under: boolean): SP => {
    const dx = e.x(y + 0.5) - e.x(y - 0.5);
    const n = Math.hypot(1, dx);
    let [qx, qy] = [e.x(y) + d / n, Math.min(y - (d * dx) / n, yEnd)];
    // sát bên cổ mặt khối hẹp hơn: trượt xuống mặt vát tới chỗ đủ rộng
    if (qx > s.a(qy)) qy = Math.max(qy, s.top(qx - s.g.neck));
    if (under) qx = Math.min(-qx, e.x(qy));
    return s.at(qx, qy);
  };
  const clipped = (y: number, d: number) => {
    const [lon, qy] = front(y, d, true);
    return s.at(e.x(qy), qy)[0] - lon < 1e-6;
  };
  const cols: ((d: number) => SP)[] = [];
  for (const y of curve(Math.ceil((yEnd - e.top) / 2), (u) => lerp(yEnd, e.top, u)))
    cols.push((d) => front(y, d, false));
  for (const phi of curve(60, (u) => 90 + 180 * u).slice(1, -1)) cols.push((d) => s.neck(phi, d));
  for (let y = e.top; y < e.cross + 4 * width + 10; y += 1.5) {
    cols.push((d) => front(y, d, true));
    if (clipped(y, width)) break;
  }
  const NV = 4;
  const strip = (
    d0: number,
    d1: number,
    lift: (v: number) => number,
    color: MarkFill,
    rims: number[],
  ) =>
    out.sheets.push({
      grid: cols.map((col) => curve(NV, (v) => b.raise(col(lerp(d0, d1, v)), lift(v)))),
      rims,
      color,
      line: COLLAR_LINE,
    });
  if (w.under > 0) strip(0, w.under, () => WRAP_UNDER_LIFT, w.underColor as MarkFill, [0]);
  if (w.band > 0)
    strip(
      w.under,
      width,
      (v) => lerp(WRAP_LIFT[0], WRAP_LIFT[1], v),
      (w.bandColor ?? "color") as MarkFill,
      [0, NV],
    );

  // da trong miệng cổ: chữ V phía trước, cả vòng trên viền cổ quanh gáy, từ viền cổ lên tới mép trên khối
  const lonAt = (y: number) => s.at(e.x(y), y)[0];
  const yOfLon = (lon: number) => {
    let [lo, hi] = [e.top, e.cross];
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      if (lonAt(m) > lon) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  const rim: SP[] = [
    ...curve(90, (u) => 90 - 180 * u).map((lon): SP => [lon, yOfLon(Math.abs(lon))]),
    ...curve(60, (u) => 270 - 180 * u)
      .slice(1)
      .map((phi): SP => {
        const [lon, y] = s.neck(phi);
        return [lon - 360, y];
      }),
  ];
  out.sheets.push({
    // hàng dày: mặt cắt dọc gãy khúc ở mép mặt vát, hàng thưa thì dây cung chui xuống dưới mặt khối
    grid: rim.map(([lon, y]) =>
      curve(32, (v) => b.raise([lon, lerp(y, s.yC + 1, v)], WRAP_SKIN_LIFT)),
    ),
    rims: [],
    color: "skin",
    line: 0,
  });

  const o = w.obi;
  if (!o) return out;
  const h = b.height;
  const yc = -o.y * h;
  const half = (o.width * h) / 2;
  const [y0, y1] = [yc - half, yc + half];
  let [A, Dp] = [1, 1];
  for (let y = y0; y <= Math.min(y1, s.yH); y += 1)
    [A, Dp] = [Math.max(A, s.a(y)), Math.max(Dp, b.depth(y))];
  const ring = (u: number, off: number, y: number): Vec3 => [
    (A + off) * Math.sin(u * D),
    y,
    (Dp + off) * Math.cos(u * D),
  ];
  const NU = 96;
  const torus = (section: [number, number][], color: MarkFill) => {
    const pts = curve(NU - 1, (u) => 360 * u * (1 - 1 / NU)).flatMap((u) =>
      section.map(([off, y]) => ring(u, off, y)),
    );
    out.solids.push({ ...outward(pts, gridTris(NU, section.length, true, true)), color });
  };
  const obiColor = (o.color ?? "accent") as MarkFill;
  const L = o.lift;
  const rc = Math.min(L * 0.6, half * 0.5);
  torus(roundRect((L - 2) / 2, yc, (L + 2) / 2, half, rc, 4), obiColor);
  const rC = o.cord / 2;
  if (rC > 0)
    torus(
      curve(9, (u): [number, number] => [
        L + rC * 0.4 + rC * Math.cos(2 * Math.PI * u),
        yc + rC * Math.sin(2 * Math.PI * u),
      ]).slice(0, -1),
      (o.cordColor ?? obiColor) as MarkFill,
    );
  /** Nửa sâu mặt ngoài đai (cộng `off`) ở `x` */
  const outer = (off: number) => (x: number) =>
    (Dp + off) * Math.sqrt(Math.max(0, 1 - (x / (A + off)) ** 2));
  if (o.clasp > 0) {
    const t = Math.max(2, o.clasp * 0.35);
    out.solids.push({
      ...plaque(
        [0, yc],
        o.clasp / 2,
        Math.max(rC * 1.4, o.clasp * 0.32),
        o.clasp * 0.2,
        0,
        () => t,
        (x) => outer(L + rC * 1.2)(x) - 1,
        1,
        Math.min(1.2, t / 2),
      ),
      color: (o.claspColor ?? o.cordColor ?? obiColor) as MarkFill,
    });
  }
  const knotColor = (o.knotColor ?? obiColor) as MarkFill;
  const back = (x: number) => outer(L)(x) - 1;
  const knot = (...a: Parameters<typeof plaque>) =>
    out.solids.push({ ...plaque(...a), color: knotColor });
  if (o.knot === "taiko") {
    const yT = y0 - 4;
    const yB = Math.max(y1 + 8, 12 * h);
    knot(
      [o.knotX ?? 0, (yT + yB) / 2],
      0.8 * A,
      (yB - yT) / 2,
      7,
      0,
      (v) => 3.5 + 3 * v,
      back,
      -1,
      2.5,
    );
  } else if (o.knot === "kai") {
    knot([o.knotX ?? 0.3 * A, yc], 0.36 * A, half * 1.05, 3, -14, () => 4, back, -1, 1.5);
  } else if (o.knot === "bunko") {
    const x0 = o.knotX ?? 0;
    for (const d of [-1, 1])
      knot([x0 + d * 0.3 * A, yc - 2], 0.3 * A, half * 1.15, 6, d * 10, () => 6, back, -1, 2);
    knot([x0, yc], 0.09 * A, half * 0.8, 3, 0, () => 9, back, -1, 2);
  }
  return out;
}
