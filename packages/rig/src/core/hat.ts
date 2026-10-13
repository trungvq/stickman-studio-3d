import { HatSchema, PinSchema, SculptSchema, type Hat, type Pin, type Sculpt } from "./schema";
import {
  bangAt,
  CROWN_EASE,
  crownLat,
  cross,
  dot,
  knotFrame,
  NJ,
  rootLat,
  rowEase,
  SCULPT_STYLES,
  shellLift,
  step,
} from "./sculpt";
import { onSkull, type Vec3 } from "./sphere";

const unit = (v: Vec3): Vec3 => {
  const k = Math.hypot(...v) || 1;
  return v.map((a) => a / k) as Vec3;
};
const add = (p: Vec3, ...terms: [Vec3, number][]) =>
  p.map((v, d) => terms.reduce((s, [q, k]) => s + q[d] * k, v)) as Vec3;

/**
 * Mũ đặt trên đầu, hệ sọ đơn vị (y lên, z ra trước mặt): `n` trục mũ hướng lên, `fwd` trục trước nằm trên miệng mũ, `base`
 * tâm miệng; thân là ống elip nửa trục `a` ngang, `b` trước–sau, cao `height` theo `n`
 */
export interface HatFit {
  n: Vec3;
  fwd: Vec3;
  base: Vec3;
  a: number;
  b: number;
  height: number;
}

/** Bước lấy mẫu mặt sọ và vỏ tóc khi đo mũ, độ */
const FIT_STEP = 3;
/** Điểm dưới miệng mũ trong dải bấy nhiêu lần bán kính vẫn tính vào cỡ miệng */
const FIT_BAND = 0.03;

/** Độ nổi của vỏ tóc khỏi da ở `(lon, lat)`, như hàng vỏ của tóc dựng khối khi đầu thẳng; ngoài vỏ là `0` */
export function shellAt(s: Sculpt, lon: number, lat: number) {
  const def = SCULPT_STYLES[s.style];
  const low = rootLat(s, lon);
  const high = crownLat(s, lon, low);
  if (lat < low || lat > high || high - low < 0.5) return 0;
  const e = def.crown
    ? step(0, CROWN_EASE, lat - low) * step(0, CROWN_EASE, high - lat)
    : rowEase(((lat - low) / (high - low)) * NJ, s.style);
  const base = Math.max((def.rim ?? 0.3) * s.volume, s.bangThick * bangAt(s, lon)[1]);
  return shellLift(s, lon, lat, e, base);
}

/**
 * Đo mũ `raw` trên đầu có tóc dựng khối `hair` (trống là đầu trọc): miệng là mặt phẳng qua vĩ độ `front` giữa trán và
 * `back` ở gáy; thân là ống elip nhỏ nhất cùng tâm ôm mọi điểm của sọ và vỏ tóc trên miệng, nở thêm `ease`; cao ít nhất
 * tới trên đỉnh tóc `ease`. docs/02-trang-phuc.md#mũ-dựng-khối
 */
export function hatFit(raw: Partial<Hat> | undefined, hair?: Partial<Sculpt>): HatFit {
  const h = HatSchema.parse(raw ?? {});
  const s = hair && SculptSchema.parse(hair);
  const F = onSkull(0, h.front);
  const fwd = unit(add(F, [onSkull(180, h.back), -1]));
  const n = cross(fwd, [1, 0, 0]);
  const d = dot(n, F);
  const pts: [x: number, z: number, up: number][] = [];
  for (let lon = -180; lon < 180; lon += FIT_STEP)
    for (let lat = -60; lat <= 90; lat += FIT_STEP / 2) {
      const p = onSkull(lon, lat, s ? shellAt(s, lon, lat) : 0);
      const up = dot(n, p) - d;
      if (up >= -FIT_BAND) pts.push([p[0], dot(fwd, p), up]);
    }
  const zs = pts.map(([, z]) => z);
  const zc = (Math.max(...zs) + Math.min(...zs)) / 2;
  const a0 = Math.max(...pts.map(([x]) => Math.abs(x)));
  const b0 = Math.max(...zs.map((z) => Math.abs(z - zc)));
  const k = Math.max(...pts.map(([x, z]) => Math.hypot(x / a0, (z - zc) / b0)));
  const top = Math.max(...pts.map(([, , up]) => up));
  return {
    n,
    fwd,
    base: add([0, 0, 0], [n, d], [fwd, zc]),
    a: a0 * k + h.ease,
    b: b0 * k + h.ease,
    height: Math.max(h.height, top + Math.max(h.ease, 0.02) + h.round * 0.3),
  };
}

/** Điểm `p` của hệ sọ đơn vị nằm trong lòng mũ: trên miệng, dưới đỉnh, trong ống elip */
export function insideHat(fit: HatFit, p: Vec3) {
  const rel = add(p, [fit.base, -1]);
  const up = dot(rel, fit.n);
  return (
    up >= -FIT_BAND &&
    up <= fit.height &&
    Math.hypot(rel[0] / fit.a, dot(rel, fit.fwd) / fit.b) <= 1
  );
}

/** Số đỉnh mỗi vòng thân mũ, số vòng thân và vòng bo mép đỉnh */
const HAT_RING = 48;
const HAT_WALL = 8;
const HAT_ROUND = 5;
/** Nét nếp gấp nổi khỏi thân mũ bấy nhiêu lần bán kính */
const FOLD_LIFT = 0.006;

/** Mũ dựng khối: tam giác thân và đỉnh quay mặt ra ngoài, nét nếp gấp là vòng kín; hệ sọ đơn vị */
export interface HatMesh {
  tris: Vec3[][];
  lines: Vec3[][];
}

/** Lưới mũ `raw` đặt theo `fit` (`hatFit`). docs/02-trang-phuc.md#mũ-dựng-khối */
export function hatMesh(raw: Partial<Hat> | undefined, fit: HatFit): HatMesh {
  const h = HatSchema.parse(raw ?? {});
  const x: Vec3 = [1, 0, 0];
  const { n, fwd, base, a, b, height } = fit;
  const round = Math.max(0, Math.min(h.round, height * 0.5, a * 0.5, b * 0.5));
  const wall = height - round;
  const ring = (up: number, inset: number) =>
    Array.from({ length: HAT_RING }, (_, i) => {
      const f = (i / HAT_RING) * 2 * Math.PI;
      const k = up < wall ? 1 + h.flare * (1 - up / wall) ** 2 : 1;
      return add(
        base,
        [n, up],
        [x, (a * k - inset) * Math.sin(f)],
        [fwd, (b * k - inset) * Math.cos(f)],
      );
    });
  const rings: Vec3[][] = [];
  for (let j = 0; j <= HAT_WALL; j++) rings.push(ring((wall * j) / HAT_WALL, 0));
  for (let j = 1; j <= HAT_ROUND; j++) {
    const t = ((j / HAT_ROUND) * Math.PI) / 2;
    rings.push(ring(wall + round * Math.sin(t), round * (1 - Math.cos(t))));
  }
  const top = add(base, [n, height]);
  const tris: Vec3[][] = [];
  const face = (t: Vec3[], ref: Vec3) => {
    const nm = cross(add(t[1], [t[0], -1]), add(t[2], [t[0], -1]));
    const c = add([0, 0, 0], [t[0], 1 / 3], [t[1], 1 / 3], [t[2], 1 / 3], [ref, -1]);
    tris.push(dot(nm, c) < 0 ? [t[0], t[2], t[1]] : t);
  };
  for (let j = 0; j + 1 < rings.length; j++) {
    const ref = add(base, [n, Math.min(dot(add(rings[j][0], [base, -1]), n), wall)]);
    for (let i = 0; i < HAT_RING; i++) {
      const i1 = (i + 1) % HAT_RING;
      face([rings[j][i], rings[j][i1], rings[j + 1][i1]], ref);
      face([rings[j][i], rings[j + 1][i1], rings[j + 1][i]], ref);
    }
  }
  const last = rings[rings.length - 1];
  const below = add(base, [n, wall]);
  for (let i = 0; i < HAT_RING; i++) face([top, last[i], last[(i + 1) % HAT_RING]], below);
  const lines = h.folds
    .filter((f) => f > 0 && f < 1)
    .map((f) => {
      const pts = ring(wall * f, -FOLD_LIFT);
      return [...pts, pts[0]];
    });
  return { tris, lines };
}

/** Số đỉnh mỗi vòng que trâm, số vòng kinh tuyến và vĩ tuyến của hạt */
const PIN_SIDES = 8;
const BEAD_SEG = 10;

/** Trâm cài búi: tam giác que và hạt quay mặt ra ngoài, hệ sọ đơn vị, đầu thẳng */
export interface PinMesh {
  stick: Vec3[][];
  bead: Vec3[][];
}

/**
 * Trâm `raw` cắm qua khối buộc của tóc `hair` (`knotFrame`): que xuyên gần tâm khối, đầu có hạt chĩa theo `angle` trên
 * mặt búi rồi chếch ra `lean`. docs/02-trang-phuc.md#trâm-cài-búi
 */
export function pinMesh(raw: Partial<Pin> | undefined, hair: Partial<Sculpt> | undefined): PinMesh {
  const p = PinSchema.parse(raw ?? {});
  const s = SculptSchema.parse(hair ?? {});
  const { n, center, h } = knotFrame(s);
  // Tiếp tuyến lên và ngang trên mặt búi; búi trên đỉnh thì "lên" là về phía gáy
  let up = add([0, 1, 0], [n, -n[1]]);
  if (Math.hypot(...up) < 1e-3) up = add([0, 0, -1], [n, n[2]]);
  up = unit(up);
  let ex = cross(up, n);
  if (ex[0] - 0.2 * ex[2] < 0) ex = ex.map((v) => -v) as Vec3;
  const D = Math.PI / 180;
  const flat = add([0, 0, 0], [ex, Math.cos(p.angle * D)], [up, Math.sin(p.angle * D)]);
  const dir = unit(add([0, 0, 0], [flat, Math.cos(p.lean * D)], [n, Math.sin(p.lean * D)]));
  const via = add(center, [n, 0.2 * h]);
  const A = add(via, [dir, -p.length * (1 - p.reach)]);
  const B = add(via, [dir, p.length * p.reach]);
  const side = unit(Math.abs(dot(dir, n)) > 0.95 ? cross(dir, ex) : cross(dir, n));
  const other = cross(dir, side);
  const circle = (c: Vec3, r: number) =>
    Array.from({ length: PIN_SIDES }, (_, i) => {
      const f = (i / PIN_SIDES) * 2 * Math.PI;
      return add(c, [side, r * Math.cos(f)], [other, r * Math.sin(f)]);
    });
  const out = (list: Vec3[][], t: Vec3[], ref: Vec3) => {
    const nm = cross(add(t[1], [t[0], -1]), add(t[2], [t[0], -1]));
    const c = add([0, 0, 0], [t[0], 1 / 3], [t[1], 1 / 3], [t[2], 1 / 3], [ref, -1]);
    list.push(dot(nm, c) < 0 ? [t[0], t[2], t[1]] : t);
  };
  const stick: Vec3[][] = [];
  const [ra, rb] = [circle(A, p.thick * 0.7), circle(B, p.thick)];
  const mid = add(A, [B, 1], [A, -0.5], [B, -0.5]);
  for (let i = 0; i < PIN_SIDES; i++) {
    const i1 = (i + 1) % PIN_SIDES;
    out(stick, [ra[i], ra[i1], rb[i1]], add(mid, [dir, dot(add(ra[i], [mid, -1]), dir)]));
    out(stick, [ra[i], rb[i1], rb[i]], add(mid, [dir, dot(add(rb[i], [mid, -1]), dir)]));
    out(stick, [A, ra[i], ra[i1]], add(A, [dir, 1]));
    out(stick, [B, rb[i1], rb[i]], add(B, [dir, -1]));
  }
  const bead: Vec3[][] = [];
  const C = add(B, [dir, p.bead * 0.7]);
  const at = (u: number, v: number) => {
    const th = (u / BEAD_SEG) * Math.PI;
    const f = (v / BEAD_SEG) * 2 * Math.PI;
    return add(
      C,
      [dir, p.bead * Math.cos(th)],
      [side, p.bead * Math.sin(th) * Math.cos(f)],
      [other, p.bead * Math.sin(th) * Math.sin(f)],
    );
  };
  for (let u = 0; u < BEAD_SEG; u++)
    for (let v = 0; v < BEAD_SEG; v++) {
      const [q0, q1, q2, q3] = [at(u, v), at(u + 1, v), at(u + 1, v + 1), at(u, v + 1)];
      if (u + 1 < BEAD_SEG) out(bead, [q0, q1, q2], C);
      if (u > 0) out(bead, [q0, q2, q3], C);
    }
  return { stick, bead };
}
