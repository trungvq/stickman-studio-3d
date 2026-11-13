import {
  HAT_SHAPE_DEFAULTS,
  HatSchema,
  PinSchema,
  SculptSchema,
  type Hat,
  type Pin,
  type Sculpt,
} from "./schema";
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
import { humanShell, humanSkull } from "./humanHead";
import { onSkull, type Vec3 } from "./sphere";

const unit = (v: Vec3): Vec3 => {
  const k = Math.hypot(...v) || 1;
  return v.map((a) => a / k) as Vec3;
};
const add = (p: Vec3, ...terms: [Vec3, number][]) =>
  p.map((v, d) => terms.reduce((s, [q, k]) => s + q[d] * k, v)) as Vec3;

/** Mũ đã đủ số: trường bỏ trống lấy theo dáng ở `HAT_SHAPE_DEFAULTS` */
export type HatSpec = Hat & (typeof HAT_SHAPE_DEFAULTS)[keyof typeof HAT_SHAPE_DEFAULTS];

/** Đọc mũ `raw` qua zod, trường bỏ trống lấy theo dáng. docs/12-trang-phuc-3d.md#mũ-dựng-khối */
export function hatSpec(raw: Partial<Hat> | undefined): HatSpec {
  const h = HatSchema.parse(raw ?? {});
  const set = Object.fromEntries(Object.entries(h).filter(([, v]) => v !== undefined));
  return { ...HAT_SHAPE_DEFAULTS[h.shape], ...set } as HatSpec;
}

/**
 * Mũ đặt trên đầu, hệ sọ đơn vị (y lên, z ra trước mặt): `n` trục mũ hướng lên, `fwd` trục trước nằm trên miệng mũ, `base`
 * tâm miệng; thân là ống elip nửa trục `a` ngang, `b` trước–sau, cao `height` theo `n`. `squash` là hệ số nén độ cao (theo
 * `n`, từ miệng) của tóc trên miệng mũ (`pressHair`); `1` là không nén
 */
export interface HatFit {
  n: Vec3;
  fwd: Vec3;
  base: Vec3;
  a: number;
  b: number;
  height: number;
  squash: number;
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
 * tới trên đỉnh tóc `ease`. docs/12-trang-phuc-3d.md#mũ-dựng-khối
 */
export function hatFit(
  raw: Partial<Hat> | undefined,
  hair?: Partial<Sculpt>,
  human = false,
): HatFit {
  const h = hatSpec(raw);
  const s = hair && SculptSchema.parse(hair);
  // đầu `human`: đo cả mặt đầu thật (trán nhô hơn cầu ở giữa, không thì trán xuyên băng và chân lưỡi trai) lẫn sọ cầu
  // (thái dương thon hơn cầu: chỉ đo mặt thật thì mũ hẹp lại, đổi dáng mũ đã căn)
  const surf = (p: Vec3): Vec3[] => (human ? [p, humanShell(p) as Vec3] : [p]);
  const F = onSkull(0, h.front);
  const fwd = unit(add(F, [onSkull(180, h.back), -1]));
  const n = cross(fwd, [1, 0, 0]);
  const d = dot(n, F);
  const pts: [x: number, z: number, up: number][] = [];
  for (let lon = -180; lon < 180; lon += FIT_STEP)
    for (let lat = -60; lat <= 90; lat += FIT_STEP / 2) {
      for (const p of surf(onSkull(lon, lat, s ? shellAt(s, lon, lat) : 0))) {
        const up = dot(n, p) - d;
        if (up >= -FIT_BAND) pts.push([p[0], dot(fwd, p), up]);
      }
    }
  const zs = pts.map(([, z]) => z);
  const zc = (Math.max(...zs) + Math.min(...zs)) / 2;
  const a0 = Math.max(...pts.map(([x]) => Math.abs(x)));
  const b0 = Math.max(...zs.map((z) => Math.abs(z - zc)));
  const k = Math.max(...pts.map(([x, z]) => Math.hypot(x / a0, (z - zc) / b0)));
  const top = Math.max(...pts.map(([, , up]) => up));
  // đỉnh sọ trên miệng: mũ ép tóc tới đâu cũng không thấp hơn nó
  const skull = Math.max(
    ...SKULL_TOP.flatMap((p) =>
      (human ? [p, humanSkull(p) as Vec3] : [p]).map((q) => dot(n, q) - d),
    ),
  );
  const room = Math.max(h.ease, 0.02) + h.round * 0.3;
  const need = top + room;
  const floor = Math.max(h.height, skull + room);
  const height = Math.max(floor, need - h.press * (need - floor));
  return {
    n,
    fwd,
    base: add([0, 0, 0], [n, d], [fwd, zc]),
    a: a0 * k + h.ease,
    b: b0 * k + h.ease,
    height,
    squash: top > 0 && height < need - 1e-9 ? (height - room) / top : 1,
  };
}

/** Điểm sọ đơn vị nửa trên, mỗi `FIT_STEP` độ: đỉnh sọ trên miệng mũ */
const SKULL_TOP: Vec3[] = Array.from({ length: 360 / FIT_STEP }, (_, i) =>
  Array.from({ length: 31 }, (_, j) => onSkull(-180 + i * FIT_STEP, j * 3)),
).flat();

/**
 * Điểm tóc `p` (hệ sọ đơn vị) dưới mũ ép tóc: phần trên miệng mũ nén độ cao theo trục mũ bằng `fit.squash`, nên đỉnh tóc
 * nằm dưới đỉnh mũ; dưới miệng giữ nguyên. docs/12-trang-phuc-3d.md#mũ-vành-tròn
 */
export function pressHair(fit: HatFit, p: Vec3): Vec3 {
  if (fit.squash >= 1) return p;
  const up = dot(add(p, [fit.base, -1]), fit.n);
  return up > 0 ? add(p, [fit.n, -up * (1 - fit.squash)]) : p;
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
/** Lưỡi trai: số cột theo góc, số hàng từ chân ra mép, bề dày; mép trong lùi vào băng bấy nhiêu phần, hai đầu chìa ra */
const BRIM_COLS = 24;
const BRIM_ROWS = 4;
const BRIM_THICK = 0.035;
const BRIM_INSET = 0.04;
const BRIM_SIDE = 0.03;
/** Mặt trên lưỡi trai gặp vách mũ cao hơn mép dưới băng bấy nhiêu lần bán kính: khớp kín, không khe */
const BRIM_SEAT = 0.006;
/** Dây quai và nút: nổi khỏi băng, nửa góc tới nút (độ), bán kính nút; tâm dây ở bấy nhiêu phần chiều cao băng */
const STRAP_LIFT = 0.012;
const STRAP_SPAN = 92;
const STRAP_AT = 0.42;
const BUTTON_R = 0.032;
/** Huy hiệu: dày đế, dày hình nổi trên đế */
const BADGE_BASE = 0.01;
const BADGE_RELIEF = 0.012;

/** Vành của `brimmed`: số hàng từ chân ra mép không dưới bấy nhiêu, mỗi hàng không rộng quá bấy nhiêu lần bán kính */
const WIDE_ROWS = 6;
const WIDE_ROW = 0.06;

/**
 * Mũ dựng khối, hệ sọ đơn vị: tam giác từng phần quay mặt ra ngoài, nét nếp gấp và đường nối là vòng kín. `tris` là
 * thân (màu `pieces.crown.color`); `band`, `brim`, `strap`, `badge` là phần của `peaked` (`band`, `brim` cả của `brimmed`),
 * màu `bandColor` … `badgeColor`; `seat` là đế huy hiệu, màu băng. `weave` / `brimWeave` là các vòng thân / vành xen
 * kẽ của vân rơm (`straw`), màu thân / vành tối đi `straw`. Dáng khác để trống
 */
export interface HatMesh {
  tris: Vec3[][];
  lines: Vec3[][];
  band: Vec3[][];
  brim: Vec3[][];
  strap: Vec3[][];
  badge: Vec3[][];
  seat: Vec3[][];
  weave: Vec3[][];
  brimWeave: Vec3[][];
}

/** Đẩy tam giác `t` vào `list`, lật chiều cho pháp tuyến quay xa điểm `ref` */
const outward = (list: Vec3[][], t: Vec3[], ref: Vec3) => {
  const nm = cross(add(t[1], [t[0], -1]), add(t[2], [t[0], -1]));
  const c = add([0, 0, 0], [t[0], 1 / 3], [t[1], 1 / 3], [t[2], 1 / 3], [ref, -1]);
  list.push(dot(nm, c) < 0 ? [t[0], t[2], t[1]] : t);
};
/** Tứ giác `a b c d` (theo vòng) thành hai tam giác quay xa `ref` */
const quad = (list: Vec3[][], a: Vec3, b: Vec3, c: Vec3, d: Vec3, ref: Vec3) => {
  outward(list, [a, b, c], ref);
  outward(list, [a, c, d], ref);
};

/** Lưới mũ `raw` đặt theo `fit` (`hatFit`). docs/12-trang-phuc-3d.md#mũ-dựng-khối */
export function hatMesh(raw: Partial<Hat> | undefined, fit: HatFit): HatMesh {
  const h = hatSpec(raw);
  const x: Vec3 = [1, 0, 0];
  const { n, fwd, base, a, b, height } = fit;
  const peaked = h.shape === "peaked";
  const round = Math.max(0, Math.min(h.round, height * 0.5, a * 0.5, b * 0.5));
  const wall = height - round;
  const band = h.shape !== "drum" ? Math.max(0, Math.min(h.band, wall * 0.8)) : 0;
  const woven = h.straw > 0;
  /** Bán kính thân ở độ cao `up` chia bán kính miệng */
  const widen = (up: number) => {
    if (!peaked) return up < wall ? 1 + h.flare * (1 - up / wall) ** 2 : 1;
    const t = Math.max(0, Math.min(1, (up - band) / (wall - band)));
    return 1 + h.flare * t * t;
  };
  const along = (f: number, up: number, lift = 0): Vec3 => {
    const k = widen(Math.min(up, wall));
    return add(
      base,
      [n, up],
      [x, (a * k + lift) * Math.sin(f)],
      [fwd, (b * k + lift) * Math.cos(f)],
    );
  };
  const ring = (up: number, inset: number) =>
    Array.from({ length: HAT_RING }, (_, i) => along((i / HAT_RING) * 2 * Math.PI, up, -inset));
  const ups: number[] = [];
  if (band > 0) ups.push(0, band / 2, band);
  for (let j = band > 0 ? 1 : 0; j <= HAT_WALL; j++)
    ups.push(band + ((wall - band) * j) / HAT_WALL);
  const rings = ups.map((up) => ring(up, 0));
  const ringUp = [...ups];
  for (let j = 1; j <= HAT_ROUND; j++) {
    const t = ((j / HAT_ROUND) * Math.PI) / 2;
    rings.push(ring(wall + round * Math.sin(t), round * (1 - Math.cos(t))));
    ringUp.push(wall);
  }
  const top = add(base, [n, height]);
  const tris: Vec3[][] = [];
  const bandTris: Vec3[][] = [];
  const weave: Vec3[][] = [];
  for (let j = 0; j + 1 < rings.length; j++) {
    const ref = add(base, [n, Math.min(ringUp[j], wall)]);
    const list = ringUp[j + 1] <= band ? bandTris : woven && j % 2 ? weave : tris;
    for (let i = 0; i < HAT_RING; i++) {
      const i1 = (i + 1) % HAT_RING;
      quad(list, rings[j][i], rings[j][i1], rings[j + 1][i1], rings[j + 1][i], ref);
    }
  }
  const last = rings[rings.length - 1];
  const below = add(base, [n, wall]);
  for (let i = 0; i < HAT_RING; i++) outward(tris, [top, last[i], last[(i + 1) % HAT_RING]], below);
  const closed = (pts: Vec3[]) => [...pts, pts[0]];
  const lines = h.folds
    .filter((f) => f > 0 && f < 1)
    .map((f) => closed(ring(band + (wall - band) * f, -FOLD_LIFT)));
  const out: HatMesh = {
    tris,
    lines,
    band: bandTris,
    brim: [],
    strap: [],
    badge: [],
    seat: [],
    weave,
    brimWeave: [],
  };
  if (h.shape === "drum") return out;
  if (band > 0) lines.push(closed(ring(band, -FOLD_LIFT)));
  if (!peaked) {
    if (h.brim > 0) wideBrimMesh(out, fit, h.brim, h.droop, woven, widen(0));
    return out;
  }
  if (h.brim > 0) brimMesh(out.brim, fit, h.brim, h.droop);
  if (h.strap > 0) strapMesh(out, fit, band, h.strap);
  if (h.badge > 0) badgeMesh(out, fit, band, Math.min(h.badge, (wall - band) / 2), widen);
  return out;
}

/** Lưỡi trai: tấm dày `BRIM_THICK` hình lưỡi liềm, mép trong theo miệng mũ nửa trước, mép ngoài nửa elip chìa `brim`, chúc `droop` */
function brimMesh(list: Vec3[][], { n, fwd, base, a, b }: HatFit, brim: number, droop: number) {
  const x: Vec3 = [1, 0, 0];
  const d = (droop * Math.PI) / 180;
  // chân lùi vào ống `BRIM_INSET` rồi chúc `droop`: mặt trên ra tới vách mũ đã tụt dưới miệng chừng ấy, hở khe nhìn thấu
  // vào lòng mũ; nâng cả lưỡi trai cho mặt trên gặp vách trên mép băng `BRIM_SEAT`
  const lift = BRIM_INSET * Math.max(a, b) * Math.tan(Math.max(0, d)) + BRIM_SEAT;
  const top: Vec3[][] = [];
  const bot: Vec3[][] = [];
  for (let i = 0; i <= BRIM_COLS; i++) {
    const f = -Math.PI / 2 + (i / BRIM_COLS) * Math.PI;
    const inner = add(
      base,
      [n, lift],
      [x, a * (1 - BRIM_INSET) * Math.sin(f)],
      [fwd, b * (1 - BRIM_INSET) * Math.cos(f)],
    );
    const outer = add(
      base,
      [n, lift],
      [x, a * (1 + BRIM_SIDE) * Math.sin(f)],
      [fwd, (b + brim) * Math.cos(f)],
    );
    const v = add(outer, [inner, -1]);
    const len = Math.hypot(...v);
    const dir = add([0, 0, 0], [v, Math.cos(d)], [n, -len * Math.sin(d)]);
    const up = len > 1e-9 ? unit(add([0, 0, 0], [n, Math.cos(d)], [v, Math.sin(d) / len])) : n;
    top.push([]);
    bot.push([]);
    for (let j = 0; j <= BRIM_ROWS; j++) {
      const p = add(inner, [dir, j / BRIM_ROWS]);
      top[i].push(p);
      bot[i].push(add(p, [up, -BRIM_THICK]));
    }
  }
  const mid = (i: number, j: number) =>
    add(top[i][j], [bot[i][j], 1], [top[i][j], -0.5], [bot[i][j], -0.5]);
  for (let i = 0; i < BRIM_COLS; i++)
    for (let j = 0; j < BRIM_ROWS; j++) {
      quad(list, top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1], bot[i][j]);
      quad(list, bot[i][j], bot[i + 1][j], bot[i + 1][j + 1], bot[i][j + 1], top[i][j]);
    }
  for (let i = 0; i < BRIM_COLS; i++) {
    quad(
      list,
      top[i][BRIM_ROWS],
      top[i + 1][BRIM_ROWS],
      bot[i + 1][BRIM_ROWS],
      bot[i][BRIM_ROWS],
      mid(i, BRIM_ROWS - 1),
    );
    quad(list, top[i][0], top[i + 1][0], bot[i + 1][0], bot[i][0], mid(i, 1));
  }
  for (const [i, k] of [
    [0, 1],
    [BRIM_COLS, BRIM_COLS - 1],
  ])
    for (let j = 0; j < BRIM_ROWS; j++)
      quad(list, top[i][j], top[i][j + 1], bot[i][j + 1], bot[i][j], mid(k, j));
}

/**
 * Vành của `brimmed`: tấm dày `BRIM_THICK` vòng kín quanh miệng mũ, mép trong lùi vào thân `BRIM_INSET`, chìa ra `brim`
 * theo pháp tuyến ống mũ; mỗi điểm cụp xuống dần, góc tăng đều từ `0` ở chân vành tới `droop` ở mép. Hàng lẻ vào
 * `brimWeave` khi có vân rơm
 */
function wideBrimMesh(
  out: HatMesh,
  fit: HatFit,
  brim: number,
  droop: number,
  woven: boolean,
  k: number,
) {
  const { n, fwd, base, a, b } = fit;
  const x: Vec3 = [1, 0, 0];
  const rows = Math.max(WIDE_ROWS, Math.ceil(brim / WIDE_ROW));
  const d = (droop * Math.PI) / 180;
  // mặt cắt dọc của vành: ra ngoài `r`, xuống `dn` sau quãng `brim · j / rows`, góc tăng đều tới `droop`
  const prof: [r: number, dn: number, ang: number][] = [[0, 0, 0]];
  const sub = 8;
  for (let j = 0; j < rows * sub; j++) {
    const [r, dn] = prof[prof.length - 1].slice(0, 2) as [number, number];
    const ang = (d * (j + 0.5)) / (rows * sub);
    prof.push([
      r + (brim / (rows * sub)) * Math.cos(ang),
      dn + (brim / (rows * sub)) * Math.sin(ang),
      (d * (j + 1)) / (rows * sub),
    ]);
  }
  const cols = HAT_RING;
  const top: Vec3[][] = [];
  const bot: Vec3[][] = [];
  for (let i = 0; i <= cols; i++) {
    const f = (i / cols) * 2 * Math.PI;
    const out0 = wallNormal(fit, f);
    const inner = add(
      base,
      [x, a * k * (1 - BRIM_INSET) * Math.sin(f)],
      [fwd, b * k * (1 - BRIM_INSET) * Math.cos(f)],
    );
    const lead = BRIM_INSET * Math.hypot(a * Math.sin(f), b * Math.cos(f)) * k;
    top.push([]);
    bot.push([]);
    for (let j = 0; j <= rows; j++) {
      const [r, dn, ang] = prof[j * sub];
      const p = add(inner, [out0, r + lead * (j === 0 ? 0 : 1)], [n, -dn]);
      const up = add([0, 0, 0], [n, Math.cos(ang)], [out0, Math.sin(ang)]);
      top[i].push(p);
      bot[i].push(add(p, [up, -BRIM_THICK]));
    }
  }
  const mid = (i: number, j: number) =>
    add(top[i][j], [bot[i][j], 1], [top[i][j], -0.5], [bot[i][j], -0.5]);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const list = woven && j % 2 ? out.brimWeave : out.brim;
      quad(list, top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1], bot[i][j]);
      quad(list, bot[i][j], bot[i + 1][j], bot[i + 1][j + 1], bot[i][j + 1], top[i][j]);
    }
    quad(
      out.brim,
      top[i][rows],
      top[i + 1][rows],
      bot[i + 1][rows],
      bot[i][rows],
      mid(i, rows - 1),
    );
    quad(out.brim, top[i][0], top[i + 1][0], bot[i + 1][0], bot[i][0], mid(i, 1));
  }
}

/** Pháp tuyến ngoài của ống elip `a`, `b` ở góc `f` quanh trục mũ */
const wallNormal = ({ fwd, a, b }: HatFit, f: number) =>
  unit(add([0, 0, 0], [[1, 0, 0], Math.sin(f) / a], [fwd, Math.cos(f) / b]));

/** Đĩa dày `thick` tâm `c`, mặt quay về `nrm`, bán kính `r`, nằm trên mặt nền (đáy lùi vào `thick`) */
function disc(list: Vec3[][], c: Vec3, nrm: Vec3, r: number, thick: number, sides = 10) {
  const e1 = unit(Math.abs(nrm[1]) > 0.9 ? cross(nrm, [1, 0, 0]) : cross([0, 1, 0], nrm));
  const e2 = cross(nrm, e1);
  const lo = add(c, [nrm, -thick]);
  const hi = add(c, [nrm, thick]);
  const at = (o: Vec3, i: number) =>
    add(
      o,
      [e1, r * Math.cos((i / sides) * 2 * Math.PI)],
      [e2, r * Math.sin((i / sides) * 2 * Math.PI)],
    );
  for (let i = 0; i < sides; i++) {
    outward(list, [hi, at(hi, i), at(hi, i + 1)], lo);
    quad(list, at(lo, i), at(lo, i + 1), at(hi, i + 1), at(hi, i), c);
  }
}

/** Dây quai: dải nổi trên băng nửa trước, từ nút bên này qua trán sang nút bên kia, tâm ở `STRAP_AT` chiều cao băng */
function strapMesh(out: HatMesh, fit: HatFit, band: number, width: number) {
  const { n, fwd, base, a, b } = fit;
  const x: Vec3 = [1, 0, 0];
  const c = band * STRAP_AT;
  const w = Math.min(width, band * 0.8);
  const span = (STRAP_SPAN * Math.PI) / 180;
  const at = (f: number, up: number): Vec3 =>
    add(base, [n, up], [x, (a + STRAP_LIFT) * Math.sin(f)], [fwd, (b + STRAP_LIFT) * Math.cos(f)]);
  const cols = 24;
  for (let i = 0; i < cols; i++) {
    const [f0, f1] = [-span + (2 * span * i) / cols, -span + (2 * span * (i + 1)) / cols];
    quad(
      out.strap,
      at(f0, c - w / 2),
      at(f1, c - w / 2),
      at(f1, c + w / 2),
      at(f0, c + w / 2),
      add(base, [n, c]),
    );
  }
  for (const f of [-span, span]) {
    const nrm = wallNormal(fit, f);
    disc(out.badge, add(at(f, c), [nrm, STRAP_LIFT]), nrm, BUTTON_R, STRAP_LIFT);
  }
}

/** Huy hiệu giữa trán ngay trên băng: đế tròn (`seat`), sao năm cánh và vòng lá hở đỉnh màu huy hiệu */
function badgeMesh(
  out: HatMesh,
  fit: HatFit,
  band: number,
  r: number,
  widen: (up: number) => number,
) {
  const { n, fwd, base, b } = fit;
  const up = band + r * 0.8;
  const slope = (b * (widen(up + 0.01) - widen(up - 0.01))) / 0.02;
  const nrm = unit(add([0, 0, 0], [fwd, 1], [n, -slope]));
  const c = add(base, [n, up], [fwd, b * widen(up)]);
  disc(out.seat, c, nrm, r, BADGE_BASE, 16);
  const ex: Vec3 = [1, 0, 0];
  const ey = unit(cross(nrm, ex));
  const lo = add(c, [nrm, BADGE_BASE * 0.5]);
  const hi = add(c, [nrm, BADGE_BASE + BADGE_RELIEF]);
  const pt = (o: Vec3, ang: number, rr: number) =>
    add(o, [ex, rr * Math.cos(ang)], [ey, rr * Math.sin(ang)]);
  // sao năm cánh, cánh đầu chĩa thẳng lên
  const star = Array.from({ length: 10 }, (_, i) => [
    Math.PI / 2 + (i * Math.PI) / 5,
    i % 2 ? r * 0.26 : r * 0.6,
  ]);
  for (let i = 0; i < 10; i++) {
    const [f0, r0] = star[i];
    const [f1, r1] = star[(i + 1) % 10];
    outward(out.badge, [hi, pt(hi, f0, r0), pt(hi, f1, r1)], lo);
    quad(out.badge, pt(lo, f0, r0), pt(lo, f1, r1), pt(hi, f1, r1), pt(hi, f0, r0), c);
  }
  // vòng lá: cung từ đỉnh trái vòng qua đáy sang đỉnh phải, hở ở đỉnh
  const seg = 14;
  const gap = (35 * Math.PI) / 180;
  const [ri, ro] = [r * 0.72, r * 0.95];
  const arc = (k: number) => Math.PI / 2 + gap + (k / seg) * (2 * Math.PI - 2 * gap);
  for (let k = 0; k < seg; k++) {
    const [f0, f1] = [arc(k), arc(k + 1)];
    const fm = (f0 + f1) / 2;
    quad(out.badge, pt(hi, f0, ri), pt(hi, f1, ri), pt(hi, f1, ro), pt(hi, f0, ro), lo);
    quad(out.badge, pt(lo, f0, ro), pt(lo, f1, ro), pt(hi, f1, ro), pt(hi, f0, ro), pt(c, fm, ri));
    quad(out.badge, pt(lo, f0, ri), pt(lo, f1, ri), pt(hi, f1, ri), pt(hi, f0, ri), pt(c, fm, ro));
  }
  for (const f of [arc(0), arc(seg)]) {
    const ref = pt(c, f + (f === arc(0) ? 0.3 : -0.3), (ri + ro) / 2);
    quad(
      out.badge,
      pt(lo, f, ri),
      pt(lo, f, ro),
      pt(hi, f, ro),
      pt(hi, f, ri),
      add(ref, [nrm, BADGE_BASE]),
    );
  }
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
 * mặt búi rồi chếch ra `lean`. docs/12-trang-phuc-3d.md#trâm-cài-búi
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
