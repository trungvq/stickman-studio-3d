import { HUMAN_HEAD, humanSkull, SKULL3 } from "./humanHead";
import { EarringsSchema, NecklaceSchema, type Earrings, type Necklace } from "./schema";
import {
  GARMENT_STYLES,
  NECK_TUBE,
  RIB_FRONT,
  type MarkFill,
  type SP,
  type Surface,
} from "./torso";
import { necklineAt } from "./panel";
import { gridTris, signedVolume } from "./wrap";
import type { Vec3 } from "./sphere";

/** Khối kín: điểm và chỉ số tam giác quấn ra ngoài */
interface Solid {
  pts: Vec3[];
  tris: number[];
}

const add = (p: Vec3, ...terms: [Vec3, number][]) =>
  p.map((v, d) => terms.reduce((s, [q, k]) => s + q[d] * k, v)) as Vec3;
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (v: Vec3): Vec3 => {
  const k = Math.hypot(...v) || 1;
  return [v[0] / k, v[1] / k, v[2] / k];
};

function outward(s: Solid): Solid {
  if (signedVolume(s.pts, s.tris) < 0)
    for (let i = 0; i < s.tris.length; i += 3)
      [s.tris[i + 1], s.tris[i + 2]] = [s.tris[i + 2], s.tris[i + 1]];
  return s;
}

/** Gộp nhiều khối kín rời thành một lưới */
function mergeSolids(list: Solid[]): Solid {
  const pts: Vec3[] = [];
  const tris: number[] = [];
  for (const s of list) {
    const o = pts.length;
    pts.push(...s.pts);
    tris.push(...s.tris.map((i) => i + o));
  }
  return { pts, tris };
}

/**
 * Khối tròn xoay quanh trục `ey` tâm `c`: `profile` là các cặp `[bán kính, độ cao]` từ cực trên tới cực dưới (bán kính hai
 * đầu là `0`); tiết diện là ellipse nửa trục `ex`, `ez` (độ dài vector là hệ số), `m` cạnh
 */
function lathe(c: Vec3, ex: Vec3, ey: Vec3, ez: Vec3, profile: [number, number][], m = 10): Solid {
  const n = profile.length - 1;
  const pts: Vec3[] = [add(c, [ey, profile[0][1]])];
  for (let j = 1; j < n; j++) {
    const [rho, h] = profile[j];
    for (let k = 0; k < m; k++) {
      const f = (2 * Math.PI * k) / m;
      pts.push(add(c, [ey, h], [ex, rho * Math.cos(f)], [ez, rho * Math.sin(f)]));
    }
  }
  pts.push(add(c, [ey, profile[n][1]]));
  const tris = gridTris(n - 1, m, false, true).map((i) => i + 1);
  const last = pts.length - 1;
  for (let k = 0; k < m; k++) {
    const k1 = (k + 1) % m;
    tris.push(0, 1 + k, 1 + k1);
    tris.push(last, last - m + k1, last - m + k);
  }
  return outward({ pts, tris });
}

/** Mặt cầu (ellipsoid khi ba trục khác dài) tâm `c` */
const ball = (c: Vec3, ex: Vec3, ey: Vec3, ez: Vec3, m = 10, n = 7) =>
  lathe(
    c,
    ex,
    ey,
    ez,
    Array.from({ length: n + 1 }, (_, i): [number, number] => {
      const th = (Math.PI * i) / n;
      return [Math.sin(th), -Math.cos(th)];
    }),
    m,
  );

/** Giọt nước đầu nhọn quay về `-ey`, đáy tròn về `+ey`; nửa rộng lớn nhất chừng `1` lần `ex`, `ez`, dài `±1.25` lần `ey` */
const teardrop = (c: Vec3, ex: Vec3, ey: Vec3, ez: Vec3, m = 10, n = 10) =>
  lathe(
    c,
    ex,
    ey,
    ez,
    Array.from({ length: n + 1 }, (_, i): [number, number] => {
      const th = (Math.PI * i) / n;
      return [1.3 * Math.sin(th) * Math.sin(th / 2), -1.25 * Math.cos(th)];
    }),
    m,
  );

/**
 * Ống kín bán kính `r`, `m` cạnh dọc đường `path`; `loop` thì khép vòng, không thì bịt hai đầu. `up(i)` là hướng tham chiếu
 * ở điểm `i` (pháp tuyến mặt bên dưới): mặt cắt dựng vuông góc đường đi, một trục theo `up`
 */
function tube(path: Vec3[], r: number, m: number, loop: boolean, up?: (i: number) => Vec3): Solid {
  const N = path.length;
  const rings = path.map((p, i) => {
    const a = loop ? path[(i - 1 + N) % N] : path[Math.max(0, i - 1)];
    const b = loop ? path[(i + 1) % N] : path[Math.min(N - 1, i + 1)];
    const t = unit(sub(b, a));
    let u: Vec3 = up ? up(i) : [0, 0, 1];
    if (Math.abs(dot(u, t)) > 0.95) u = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const n = unit(add(u, [t, -dot(u, t)]));
    const bn = cross(t, n);
    return Array.from({ length: m }, (_, k): Vec3 => {
      const f = (2 * Math.PI * k) / m;
      return add(p, [n, r * Math.cos(f)], [bn, r * Math.sin(f)]);
    });
  });
  const pts = rings.flat();
  const tris = gridTris(N, m, loop, true);
  // vách quấn vào trong (mặt cắt quay thuận quanh hướng đi); nắp đầu và nắp cuối quấn cùng chiều ấy
  if (!loop)
    for (const [j, sgn] of [
      [0, 1],
      [N - 1, -1],
    ] as const) {
      const ci = pts.push(path[j]) - 1;
      for (let k = 0; k < m; k++) {
        const [p, q] = [j * m + k, j * m + ((k + 1) % m)];
        tris.push(ci, ...(sgn > 0 ? [p, q] : [q, p]));
      }
    }
  return outward({ pts, tris });
}

/** Dây chuyền mảnh nổi khỏi mặt thân bấy nhiêu px ngoài bán kính dây: nằm áp mặt mà không chìm vào mảng tô */
export const NECKLACE_LIFT = 0.35;
/** Tâm dây lùi vào trong viền cổ áo bấy nhiêu px ngoài bán kính dây: nằm trên da giữa cổ và mép cổ áo */
export const NECKLACE_INSET = 1.2;
/** Nét viền dây, hạt, mặt dây, px */
export const NECKLACE_INK = { chain: 0.3, pearl: 0.4, pendant: 0.6 } as const;

/**
 * Dây chuyền dựng khối trên mặt thân (`raise`: điểm mặt khối nổi `lift` px theo pháp tuyến): sau gáy và hai bên chân cổ dây
 * chạy theo viền cổ áo lùi vào `NECKLACE_INSET` (nằm trên da, trong viền gân hay chân cổ bẻ), phía trước võng tới `drop` px
 * dưới chân cổ theo `cos^k` của góc quanh cổ, nên cổ U, cổ V, cổ vuông đều mang cùng một vòng võng. Mặt dây treo ở chỗ thấp
 * nhất. Dây `chain` là ống liền, `pearl` là chuỗi hạt tròn sát nhau. Mỗi phần một khối kín kèm bề dày nét viền `ink` (px).
 * docs/02-trang-phuc.md#dây-chuyền
 */
export function necklaceSolids(
  b: { s: Surface; raise: (sp: SP, lift: number) => Vec3 },
  raw: Partial<Necklace>,
): { pts: Vec3[]; tris: number[]; color: MarkFill; ink: number }[] {
  const n = NecklaceSchema.parse(raw);
  const { s } = b;
  const pearl = n.style === "pearl";
  const r = n.thick ?? (pearl ? 1.9 : 0.75);
  const color = (n.color ?? (pearl ? "#f4ede0" : "#d9b44a")) as MarkFill;
  const gem = (n.gem ?? color) as MarkFill;
  const rib = GARMENT_STYLES[s.g.style].rib;
  const neckY = necklineAt(s);
  // đoạn dây nằm trên viền gân nổi theo viền ở góc ấy như `ribAt`, đoạn trong miệng cổ nằm sát da
  const liftAt = (phi: number, [lon, y]: SP) => {
    if (!rib) return r + NECKLACE_LIFT;
    const back = Math.cos((phi * Math.PI) / 180) <= 0 ? 1 : Math.sin((phi * Math.PI) / 180) ** 2;
    const on = Math.min(1, Math.max(0, (y - neckY(lon) + r) / r));
    return r + NECKLACE_LIFT + on * rib.lift[0] * (RIB_FRONT + (1 - RIB_FRONT) * back);
  };
  const inset = NECKLACE_INSET + r;
  const y0 = s.top(-inset);
  const xw = s.g.neck - inset;
  const k = n.pendant === "none" ? 1.3 : 1.7;
  // ống cổ lùi sau và nở ở chân: sau gáy nó nhô khỏi mặt khối, dây lùi vào trong viền cổ thì chui vào ống cổ
  const clear = NECK_TUBE.r * NECK_TUBE.flare * 100 + r + NECKLACE_LIFT;
  const outside = (sp: SP) => {
    const p = b.raise(sp, 0);
    return Math.hypot(p[0], p[2] + NECK_TUBE.back * 100) >= clear;
  };
  // không đủ chỗ trong viền cổ thì dây vắt lên viền gân, tối đa hết bề rộng viền
  const floor = -(rib?.width ?? 0);
  const need = (phi: number) => {
    if (outside(s.neck(phi, -inset))) return inset;
    let [lo, hi] = [floor, inset];
    for (let i = 0; i < 16; i++) {
      const m = (lo + hi) / 2;
      if (outside(s.neck(phi, -m))) lo = m;
      else hi = m;
    }
    return lo;
  };
  // độ lùi sau gáy trơn theo `(−cos)^p`, `p` lớn nhất mà mọi góc vẫn tránh được ống cổ
  const backs = Array.from({ length: 37 }, (_, i) => 90 + i * 2.5);
  const needs = backs.map(need);
  const low = Math.min(...needs);
  const dip = (phi: number, p: number) =>
    inset - (inset - low) * Math.max(0, -Math.cos((phi * Math.PI) / 180)) ** p;
  const pow =
    [16, 12, 8, 6, 4, 3, 2, 1.5, 1, 0.5].find((p) =>
      backs.every((phi, i) => dip(phi, p) <= needs[i] + 0.05),
    ) ?? 0;
  const at = (phi: number): SP => {
    const c = Math.cos((phi * Math.PI) / 180);
    if (c <= 0) return s.neck(phi, -(rib ? dip(phi, pow) : inset));
    return s.at(xw * Math.sin((phi * Math.PI) / 180), y0 + n.drop * c ** k);
  };
  const NP = 180;
  const phis = Array.from({ length: NP }, (_, i) => -180 + (360 * i) / NP);
  const sps = phis.map(at);
  const lifts = sps.map((sp, i) => liftAt(phis[i], sp));
  const path = sps.map((sp, i) => b.raise(sp, lifts[i]));
  const normal = (sp: SP, l: number, p: Vec3) => unit(sub(b.raise(sp, l + 1), p));
  const out: { pts: Vec3[]; tris: number[]; color: MarkFill; ink: number }[] = [];
  const bottom: SP = s.at(0, y0 + n.drop);
  // mặt dây treo ở giữa ngực
  const lift = liftAt(0, bottom);
  if (pearl) {
    const len = [0];
    for (let i = 1; i <= NP; i++)
      len.push(len[i - 1] + Math.hypot(...sub(path[i % NP], path[i - 1])));
    const L = len[NP];
    const count = Math.max(6, Math.floor(L / (2.05 * r)));
    const beads: Solid[] = [];
    for (let j = 0; j < count; j++) {
      // hạt giữa ngực nằm đúng chỗ thấp nhất: đếm từ giữa sau (`phi = -180`) thêm nửa vòng
      const d = ((j + 0.5) / count) * L;
      let i = 1;
      while (i < NP && len[i] < d) i++;
      const u = (d - len[i - 1]) / (len[i] - len[i - 1] || 1);
      const [p, q] = [path[i - 1], path[i % NP]];
      const c = add(p, [sub(q, p), u]);
      const t = unit(sub(q, p));
      // pháp tuyến vuông góc hướng dây: chỗ dây gãy dốc (hai bên cổ) hạt vẫn tròn, không méo thành bầu dục lún vào vai
      const n0 = normal(sps[i - 1], lifts[i - 1], p);
      const nm = unit(add(n0, [t, -dot(n0, t)]));
      const side = cross(t, nm);
      beads.push(
        ball(
          c,
          [t[0] * r, t[1] * r, t[2] * r],
          [nm[0] * r, nm[1] * r, nm[2] * r],
          [side[0] * r, side[1] * r, side[2] * r],
          10,
          7,
        ),
      );
    }
    out.push({ ...mergeSolids(beads), color, ink: NECKLACE_INK.pearl });
  } else {
    out.push({
      ...tube(path, r, 6, true, (i) => normal(sps[i], lifts[i], path[i])),
      color,
      ink: NECKLACE_INK.chain,
    });
  }
  if (n.pendant !== "none") {
    const h = n.size;
    const drop = n.pendant === "drop";
    const yc = y0 + n.drop + r * 0.6 + (drop ? 1.25 * h : h);
    const deep = h * 0.55;
    const O = b.raise(s.at(0, yc), lift - r + deep);
    const ey = unit(sub(b.raise(s.at(0, yc + 1), lift - r + deep), O));
    const ez = unit(sub(b.raise(s.at(0, yc), lift - r + deep + 1), O));
    const ex = cross(ey, ez);
    const sc = (v: Vec3, k2: number): Vec3 => [v[0] * k2, v[1] * k2, v[2] * k2];
    const body = drop
      ? teardrop(O, sc(ex, h), sc(ey, h), sc(ez, deep), 12, 12)
      : ball(O, sc(ex, h), sc(ey, h), sc(ez, deep), 12, 8);
    out.push({ ...body, color: gem, ink: NECKLACE_INK.pendant });
    if (!pearl) {
      // khoen nối mặt dây vào dây
      const P = b.raise(bottom, lift);
      const nm = normal(bottom, lift, P);
      const br = r * 1.5;
      out.push({ ...ball(P, [br, 0, 0], [0, br, 0], sc(nm, br)), color, ink: NECKLACE_INK.chain });
    }
  }
  return out;
}

/** Bông tai: một chiếc ở tai `side`, hệ sọ đơn vị, đầu thẳng. `hang` là phần thõng quay quanh `pivot` theo trọng lực */
export interface EarringMesh {
  metal: Vec3[][];
  gem: Vec3[][];
  /** Tam giác của phần thõng tính từ `pivot`: đầu thẳng thì thõng theo `−y` */
  hang?: { pivot: Vec3; metal: Vec3[][]; gem: Vec3[][] };
}

/** Cỡ mặc định theo dáng, lần bán kính sọ: to hơn thật chừng một nửa cho đọc được ở trung cảnh */
export const EARRING_SIZE = { stud: 0.06, hoop: 0.15, drop: 0.07 } as const;

const trisOf = (s: Solid, shift: Vec3 = [0, 0, 0]): Vec3[][] => {
  const out: Vec3[][] = [];
  for (let i = 0; i < s.tris.length; i += 3)
    out.push([0, 1, 2].map((k) => sub(s.pts[s.tris[i + k]], shift)) as Vec3[]);
  return out;
};

/**
 * Dái tai bên `side` (`-1` bên phải người, −x) trên sọ đơn vị: lỗ xỏ giữa bề dày dái tai, mặt ngoài dái tai, và các hướng
 * ra ngoài, ra trước của tai. Tai đọc từ `HUMAN_HEAD.ear` và đặt như `earGroup` của người 3D (lệch, quay); đầu cầu không có
 * tai thì lấy cùng chỗ trên mặt cầu
 */
export function earLobe(side: -1 | 1, human: boolean) {
  const E = HUMAN_HEAD.ear;
  const x = Math.sqrt(Math.max(0, 1 - E.y * E.y - E.z * E.z));
  const base: Vec3 = [side * x, E.y, E.z];
  const c = human ? humanSkull(base) : base;
  // quay như `earGroup`: Euler XYZ (0, −0.35·side, 0.12·side)
  const [ry, rz] = [side * -0.35, side * 0.12];
  const rot = ([px, py, pz]: Vec3): Vec3 => {
    const [x1, y1] = [px * Math.cos(rz) - py * Math.sin(rz), px * Math.sin(rz) + py * Math.cos(rz)];
    return [x1 * Math.cos(ry) + pz * Math.sin(ry), y1, -x1 * Math.sin(ry) + pz * Math.cos(ry)];
  };
  const toSkull = (local: Vec3): Vec3 => {
    const p = rot(local);
    return [c[0] + p[0] / SKULL3[0], c[1] + p[1] / SKULL3[1], c[2] + p[2] / SKULL3[2]];
  };
  const y = -E.h * 0.78;
  const half = E.out * Math.sqrt(1 - 0.78 * 0.78);
  return {
    pierce: toSkull([side * E.out * 0.35, y, 0]),
    face: toSkull([side * (E.out * 0.35 + half), y, 0]),
    out: unit(rot([side, 0, 0])),
    fwd: unit(rot([0, 0, 1])),
  };
}

/**
 * Bông tai `raw` ở tai `side`: `stud` một nụ dẹt áp mặt ngoài dái tai; `hoop` vòng tròn xỏ qua dái tai, nằm trong mặt
 * phẳng dọc của tai; `drop` một hạt kim loại ở dái tai, sợi thõng xuống và viên giọt nước ở đáy. Vòng và phần thõng của
 * bông dài là `hang`: người 3D quay nó quanh lỗ xỏ cho luôn thõng theo trọng lực. docs/02-trang-phuc.md#bông-tai
 */
export function earringMesh(
  raw: Partial<Earrings> | undefined,
  side: -1 | 1,
  human: boolean,
): EarringMesh {
  const e = EarringsSchema.parse(raw ?? {});
  const size = e.size ?? EARRING_SIZE[e.shape];
  const lobe = earLobe(side, human);
  const down: Vec3 = [0, -1, 0];
  const fwd = unit(add(lobe.fwd, [down, -dot(lobe.fwd, down)]));
  const sideAxis = cross(down, fwd);
  const sc = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
  if (e.shape === "stud") {
    const c = add(lobe.face, [lobe.out, size * 0.45]);
    const o = lobe.out;
    const u = unit(cross(o, [0, 1, 0]));
    const v = cross(u, o);
    return { metal: [], gem: trisOf(ball(c, sc(u, size), sc(o, size * 0.6), sc(v, size), 12, 8)) };
  }
  if (e.shape === "hoop") {
    const pivot = lobe.pierce;
    const N = 32;
    const ring = Array.from({ length: N }, (_, i): Vec3 => {
      const f = (2 * Math.PI * i) / N;
      return add([0, 0, 0], [down, size * (1 - Math.cos(f))], [fwd, size * Math.sin(f)]);
    });
    const t = tube(ring, e.thick * 1.3, 6, true, () => sideAxis);
    return { metal: [], gem: [], hang: { pivot, metal: trisOf(t), gem: [] } };
  }
  const pivot = add(lobe.face, [lobe.out, e.thick]);
  const hook = trisOf(
    ball(pivot, [e.thick * 2.2, 0, 0], [0, e.thick * 2.2, 0], [0, 0, e.thick * 2.2], 8, 6),
  );
  const gemTop = Math.max(e.thick * 2, e.length - 2.5 * size);
  const wire = tube(
    Array.from({ length: 5 }, (_, i): Vec3 => sc(down, (gemTop * i) / 4)),
    e.thick,
    6,
    false,
    () => sideAxis,
  );
  const c = sc(down, gemTop + 1.25 * size);
  const gem = teardrop(c, sc(fwd, size), sc(down, size), sc(sideAxis, size * 0.8), 12, 12);
  return { metal: hook, gem: [], hang: { pivot, metal: trisOf(wire), gem: trisOf(gem) } };
}
