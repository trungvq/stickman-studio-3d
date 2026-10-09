import { D, TORSO_DEPTH } from './core/constants';
import type { Garment } from './core/schema';
import {
  COLLAR_LEAN, COLLAR_LINE, curve, GARMENT_STYLES, garmentOf, lerp, lerpAt, lipOf, profile, RIB_FRONT, spline,
  type MarkFill, type P2, type Rig, type SP, type Surface,
} from './core/torso';

// Thân áo dựng khối từ bảng kiểu và mặt cắt `profile` của lõi: như `torsoPaths` nhưng giữ khối, nét và tấm ở 3D
// thay vì chiếu ra path SVG.

export type { Rig };
type Vec3 = [number, number, number];

/** Thân áo dựng khối ở 3D, hệ nhóm thân của rig (px, gốc ở hông, `y` xuống, `z` ra trước ngực). */
export interface TorsoMesh {
  /** Mặt cắt dọc `[nửa rộng, y]` từ mép trên xuống gấu; tiết diện ngang là ellipse dẹt `TORSO_DEPTH` */
  profile: P2[];
  /** Nét trên mặt khối, `k` lần nét thân */
  lines: { pts: Vec3[]; k: number }[];
  /** Mảng tô trên mặt khối: polygon ở toạ độ mặt `(kinh độ, y)` để tam giác hoá, và điểm 3D tương ứng */
  fills: { sp: P2[]; pts: Vec3[]; fill: MarkFill }[];
  dots: { p: Vec3; k: number }[];
  /** Tấm nổi khối (cổ bẻ, viền gân, mũ trùm): lưới cột × hàng, hàng `rims` có nét viền */
  sheets: { grid: Vec3[][]; rims: number[]; color: MarkFill; line: number }[];
}

export function torsoMesh(raw: Partial<Garment> | undefined, rig: Rig): TorsoMesh {
  const g = garmentOf(raw);
  const def = GARMENT_STYLES[g.style];
  const pr = profile(g, rig, rig.stroke / 2);
  const aAt = (y: number) => lerpAt(pr.pts, y, 1, 0);
  const yOf = (a: number) => lerpAt(pr.upper, a, 0, 1);
  const at = (x: number, y: number, back = false): SP => {
    const lon = Math.asin(Math.max(-1, Math.min(1, x / Math.max(aAt(y), 1e-6)))) / D;
    return [back ? 180 - lon : lon, y];
  };
  const top = (grow = 0) => yOf(g.neck + grow);
  const surf: Surface = {
    g,
    yC: pr.yC,
    yS: pr.yS,
    yH: pr.yH,
    a: aAt,
    top,
    at,
    neck: (phi, grow = 0) => {
      const x = (g.neck + grow) * Math.sin(phi * D);
      const c = Math.cos(phi * D);
      const dip =
        c < 0
          ? (g.neckBack + grow) * -c
          : def.neckline === "v"
            ? (g.neckFront + grow) * (1 - Math.abs(Math.sin(phi * D)))
            : def.neckline === "square"
              ? (g.neckFront + grow) * Math.min(1, c * 3)
              : (g.neckFront + grow) * c;
      const [lon, y] = at(x, top(grow) + dip, c < 0);
      return [lon + 360 * Math.round((phi - lon) / 360), y];
    },
    t: (tt) => pr.yS * (1 - tt),
  };
  const solid = ([lon, y]: SP): [Vec3, Vec3] => {
    const a = aAt(y);
    const p: Vec3 = [a * Math.sin(lon * D), y, TORSO_DEPTH * a * Math.cos(lon * D)];
    const n: Vec3 = [p[0], (-a * (aAt(y + 4) - aAt(y - 4))) / 8, p[2] / TORSO_DEPTH ** 2];
    const l = Math.hypot(...n) || 1;
    return [p, n.map((v) => v / l) as Vec3];
  };
  const raise = (sp: SP, lift: number, h: number, lean = COLLAR_LEAN): Vec3 => {
    const [p, n] = solid(sp);
    const [x, y, z] = [p[0] + n[0] * lift, p[1] + n[1] * lift - h, p[2] + n[2] * lift];
    return [x, y - lean * ((Math.hypot(z, 8) - z) / 2), z];
  };
  /** Nét và mảng nổi khỏi mặt khối một chút cho khỏi chìm vào ruột */
  const onTorso = (sp: SP, lift = 0.5) => raise(sp, lift, 0, 0);
  const dense = (pts: SP[], closed = false) => {
    const out: SP[] = [];
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const [p, q] = [pts[i], pts[(i + 1) % pts.length]];
      const m = Math.max(1, Math.ceil(Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])) / 3));
      for (let j = 0; j < m; j++) out.push([p[0] + ((q[0] - p[0]) * j) / m, p[1] + ((q[1] - p[1]) * j) / m]);
    }
    out.push(closed ? pts[0] : pts[pts.length - 1]);
    return out;
  };

  const out: TorsoMesh = { profile: pr.pts, lines: [], fills: [], dots: [], sheets: [] };
  for (const m of def.marks(surf)) {
    if (m.dot) {
      out.dots.push({ p: onTorso(m.pts[0], 0), k: m.k });
      continue;
    }
    const pts = dense(m.pts, m.closed || !!m.fill);
    if (m.fill) out.fills.push({ sp: pts, pts: pts.map((p) => onTorso(p, 0.3)), fill: m.fill });
    if (m.k > 0) out.lines.push({ pts: pts.map((p) => onTorso(p)), k: m.k });
  }

  const NU = 144;
  const NV = 6;
  const sheet = (grid: Vec3[][], rims: number[], color: MarkFill, line: number) =>
    out.sheets.push({ grid, rims, color, line });

  const rib = def.rib;
  if (rib) {
    const [liftIn, liftOut] = rib.lift;
    const ribAt = (phi: number, v: number) => {
      const [i, o] = [surf.neck(phi), surf.neck(phi, rib.width)];
      const back = Math.cos(phi * D) <= 0 ? 1 : Math.sin(phi * D) ** 2;
      return raise(
        [lerp(i[0], o[0], v), lerp(i[1], o[1], v)],
        lerp(liftIn, liftOut, v) * lerp(RIB_FRONT, 1, back),
        rib.stand * back * (1 - v) ** 2,
      );
    };
    sheet(curve(NU, (u) => curve(NV, (v) => ribAt(360 * u, v))), [0, NV], "color", rib.line);
  }

  const hood = def.hood;
  if (hood) {
    const drop = hood.drop;
    const nodes: [number, number][] = [
      ...drop.slice(1).map(([p, y]): [number, number] => [-p, y]).reverse(),
      ...drop,
      ...drop.slice(0, -1).map(([p, y]): [number, number] => [360 - p, y]).reverse(),
    ];
    const collarOf = (a: number, d: number): SP => {
      const [sn, c] = [Math.sin(a * D), Math.cos(a * D)];
      const dip = c < 0 ? g.neckBack * -c : g.neckFront * (1 - sn);
      return at(d * g.neck * sn, top() + dip, c < 0);
    };
    const hoodAt = (a: number, d: number, v: number) => {
      const i = collarOf(a, d);
      const [lon] = collarOf(Math.abs(a), a < 0 ? -d : d);
      const o: SP = [lon, top() + spline(nodes, Math.abs(a))];
      const phi = d > 0 ? a : 360 - a;
      const wrap = (l: number) => l + 360 * Math.round((phi - l) / 360);
      const pile = lerp(hood.pile[0], hood.pile[1], Math.sin((a * D) / 2) ** 4);
      return raise(
        [lerp(wrap(i[0]), wrap(o[0]), v), lerp(i[1], o[1], v)],
        lerp(hood.lift[0], hood.lift[1], v) * lerp(RIB_FRONT, 1, Math.cos(a * D) <= 0 ? 1 : Math.sin(a * D) ** 2) +
          pile * 16 * v ** 2 * (1 - v) ** 2,
        0,
        0,
      );
    };
    const HV = 12;
    const span = 360 + 2 * hood.tuck;
    const n = Math.round(span / 2.5);
    sheet(
      curve(n, (u) => {
        const phi = span * u - hood.tuck;
        return curve(HV, (v) => (phi <= 180 ? hoodAt(phi, 1, v) : hoodAt(360 - phi, -1, v)));
      }),
      [0, HV],
      "color",
      hood.line,
    );
  }

  const spec = def.collar?.(surf);
  if (spec) {
    const lip = lipOf(surf, spec.side, spec.flap);
    const lens = lip.map((q, i) => (i ? Math.hypot(q[0] - lip[i - 1][0], q[1] - lip[i - 1][1]) : 0));
    for (let i = 1; i < lens.length; i++) lens[i] += lens[i - 1];
    const along = (t: number): P2 => {
      const d = t * lens[lens.length - 1];
      let i = 1;
      while (i < lens.length - 1 && lens[i] < d) i++;
      const u = (d - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
      return [lerp(lip[i - 1][0], lip[i][0], u), lerp(lip[i - 1][1], lip[i][1], u)];
    };
    const frontAt = (phi: number) =>
      Math.cos(phi * D) > 0 ? 1 - Math.asin(Math.abs(Math.sin(phi * D))) / (Math.PI / 2) : undefined;
    const [fx, fy] = spec.flap[spec.tipAt ?? spec.flap.length - 1];
    const tipT = lens[lip.findIndex(([x, y]) => Math.hypot(x - fx, y - fy) < 1e-6)] / lens[lens.length - 1];
    const onAxis = lens[lip.findIndex(([x]) => x < 1e-6)] / lens[lens.length - 1];
    const tipLift = (phi: number) => {
      const t = frontAt(phi);
      return t === undefined ? 0 : spec.tip * Math.exp(-(((t - tipT) / 0.25) ** 2));
    };
    const outer = (phi: number): SP => {
      const t = frontAt(phi);
      if (t === undefined) {
        const c = Math.cos(phi * D);
        const [l, y] = surf.neck(phi);
        return [l, y + spec.side + (spec.band - spec.side) * c * c];
      }
      const sn = Math.sin(phi * D);
      const [x, y] = along(Math.min(t, onAxis));
      const [l] = at(Math.sign(sn) * x, y);
      return [l + 360 * Math.round((phi - l) / 360), y];
    };
    const [liftFold, liftEdge] = spec.lift;
    const stand: Vec3[][] = [];
    const leaf: Vec3[][] = [];
    for (let i = 0; i <= NU; i++) {
      const phi = (360 * i) / NU;
      const h = spec.stand * (Math.cos(phi * D) <= 0 ? 1 : Math.abs(Math.sin(phi * D)));
      const inner = surf.neck(phi);
      const o = outer(phi);
      stand.push([0, 1].map((w) => raise(inner, liftFold * w, h * w)));
      leaf.push(
        curve(NV, (v) =>
          raise([lerp(inner[0], o[0], v), lerp(inner[1], o[1], v)], lerp(liftFold, liftEdge + tipLift(phi), v), h * (1 - v) ** 2),
        ),
      );
    }
    sheet(stand, [], spec.fill ?? "color", COLLAR_LINE);
    sheet(leaf, [0, NV], spec.fill ?? "color", COLLAR_LINE);
  }
  return out;
}

/** Váy dựng khối (`SkirtSchema` của rig): nón cụt tiết diện ellipse treo ở hông */
