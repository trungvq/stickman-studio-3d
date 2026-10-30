import { ShapeUtils, Vector2 } from 'three';
import { torsoSection, type ArmRoom } from './core/act3';
import { D } from './core/constants';
import type { Garment } from './core/schema';
import {
  COLLAR_LEAN, COLLAR_LINE, curve, GARMENT_STYLES, garmentOf, lerp, lerpAt, lipOf, profile, RIB_FRONT, spline,
  type MarkFill, type P2, type Rig, type SP, type Surface,
} from './core/torso';
import { WrapSchema, type Drape, type Necklace, type Shades } from './core/schema';
import { drapeSolid, shadesSolids } from './core/drape';
import { necklaceSolids } from './core/jewelry';
import { wrapParts, type WrapBody } from './core/wrap';
import { printParts, type PrintPart } from './core/print';
import { clipHalf, panelParts } from './core/panel';

// Thân áo dựng khối từ bảng kiểu và mặt cắt `profile` của lõi: khối, nét và tấm ở 3D.

export type { ArmRoom, Rig };
type Vec3 = [number, number, number];

/** Thân áo dựng khối ở 3D, hệ nhóm thân của rig (px, gốc ở hông, `y` xuống, `z` ra trước ngực). */
export interface TorsoMesh {
  /** Mặt cắt dọc `[nửa rộng, y]` từ mép trên xuống gấu; tiết diện ngang là ellipse nửa rộng ấy, nửa sâu `depth` cùng hàng */
  profile: P2[];
  /** Nửa bề sâu nửa sau từng hàng của `profile` (`torsoSection`): theo bề rộng, trên ngang ngực lưng đi dốc ngắn từ mép trên */
  depth: number[];
  /** Nửa bề sâu nửa trước từng hàng: từ mép trên dốc dài tới ngang ngực, cộng bụng phệ (`garment.belly`) */
  front: number[];
  /** Nét trên mặt khối, `k` lần nét thân */
  lines: { pts: Vec3[]; k: number }[];
  /**
   * Mảng tô trên mặt khối: điểm 3D và chỉ số tam giác, cạnh không dài quá `FILL_EDGE` px. `decal`: mảng áo
   * (`garment.panels`), vẽ như hình in — không ghi độ sâu, không vào nét bóng dáng của thân, lớp trên vẽ sau theo `lift`.
   * `skin`: mảng da của người mặc đồ, vật liệu da tay trần, ghi độ sâu. `ink`: nét nhạt (`Mark.ink`), hình in màu `fill` pha
   * về màu thân bấy nhiêu. `neck`: da trong miệng cổ, cùng vật liệu ống cổ — chỗ nối với cổ không có nét
   */
  fills: { pts: Vec3[]; tris: number[]; fill: MarkFill; decal?: { lift: number; normals: Vec3[] }; skin?: boolean; ink?: number; neck?: boolean }[];
  dots: { p: Vec3; k: number }[];
  /** Tấm nổi khối (cổ bẻ, viền gân, mũ trùm, dải cổ chéo): lưới cột × hàng, hàng `rims` có nét viền */
  sheets: { grid: Vec3[][]; rims: number[]; color: MarkFill; line: number }[];
  /**
   * Khối kín (đai, dây buộc, khoá, nút đai): tam giác quấn ra ngoài trong hệ thân `y` xuống. Có `ink` là đồ nhỏ (trang sức):
   * vỏ viền dày bấy nhiêu px, không nét hậu kỳ (`userData.noEdge`)
   */
  solids: { pts: Vec3[]; tris: number[]; color: MarkFill; ink?: number }[];
  /** Hình in bám mặt khối (chữ trên dải cổ, hình in, mặt thẻ tên): lưới cột × hàng và nội dung vẽ lên texture */
  prints: PrintPart[];
}

/** Nét nhạt (`Mark.ink`) nổi bấy nhiêu px: hình in như mảng áo, dưới mảng áo lớp `under` */
const FAINT_LIFT = 0.12;

/** Cạnh tam giác của mảng tô dài nhất bấy nhiêu px: dài hơn thì dây cung cắt xuyên mặt cong của khối */
const FILL_EDGE = 5;

/** Douglas–Peucker trên polygon kín: bỏ đỉnh cách dây cung dưới `tol`, bỏ đỉnh trùng */
function simplify(poly: P2[], tol: number): P2[] {
  const pts = poly.filter((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) > 1e-6;
  });
  if (pts.length < 4) return pts;
  const far = (from: number, to: number) => {
    let [best, at] = [-1, -1];
    const [a, b] = [pts[from], pts[to % pts.length]];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let i = from + 1; i < to; i++) {
      const p = pts[i];
      const d = l > 1e-9 ? Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / l : Math.hypot(p[0] - a[0], p[1] - a[1]);
      if (d > best) [best, at] = [d, i];
    }
    return [best, at] as const;
  };
  const keep = new Set<number>([0]);
  const split = (from: number, to: number) => {
    const [d, at] = far(from, to);
    if (at < 0 || d <= tol) return;
    keep.add(at);
    split(from, at);
    split(at, to);
  };
  // điểm xa điểm đầu nhất chia vòng làm hai nửa
  const mid = pts.reduce((m, p, i) => (Math.hypot(p[0] - pts[0][0], p[1] - pts[0][1]) > Math.hypot(pts[m][0] - pts[0][0], pts[m][1] - pts[0][1]) ? i : m), 0);
  keep.add(mid);
  split(0, mid);
  split(mid, pts.length);
  return [...keep].sort((a, b) => a - b).map((i) => pts[i]);
}

/** Đồ dựng khối ở socket `neck` bám thân áo: khăn vắt vai màu `color`, kính gài nẹp, dây chuyền */
export interface NeckWear { drape?: Partial<Drape>; shades?: Partial<Shades>; necklace?: Partial<Necklace>; color: string }

/** Da trong miệng cổ: nổi khỏi mặt khối bấy nhiêu px (dưới mép trong viền gân), số hàng mặt bên và số vòng nắp */
const NECK_SKIN = { lift: 0.3, rows: 6 } as const;
const lerp3 = (p: Vec3, q: Vec3, t: number): Vec3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];

/**
 * `arm` có là người `clad`: vát vai `cladSlope`, sườn áo lùi theo `cladProfile`. `neck`: khăn vắt vai, kính gài nẹp
 * (`pieces.neck`), khối kín đè lên thân và nắp vai
 */
export function torsoMesh(raw: Partial<Garment> | undefined, rig: Rig, arm?: ArmRoom, neck?: NeckWear): TorsoMesh {
  const g = garmentOf(raw, !!arm);
  const def = GARMENT_STYLES[g.style];
  const pr = profile(g, rig, rig.stroke / 2);
  const { pts, back: depth, front } = torsoSection(pr.pts, g, rig.height, arm);
  const aAt = (y: number) => lerpAt(pts, y, 1, 0);
  const deep: P2[] = pts.map(([, y], i) => [depth[i], y]);
  const ahead: P2[] = pts.map(([, y], i) => [front[i], y]);
  const dAt = (y: number) => lerpAt(deep, y, 1, 0);
  const fAt = (y: number) => lerpAt(ahead, y, 1, 0);
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
    depth: (y, back = false) => (back ? dAt : fAt)(y),
    neck: (phi, grow = 0) => {
      const x = (g.neck + grow) * Math.sin(phi * D);
      const c = Math.cos(phi * D);
      const dip =
        c < 0
          ? (g.neckBack + grow) * -c
          : (g.neckline ?? def.neckline) === "v"
            ? (g.neckFront + grow) * (1 - Math.abs(Math.sin(phi * D)))
            : (g.neckline ?? def.neckline) === "square"
              ? (g.neckFront + grow) * Math.min(1, c * 3)
              : (g.neckFront + grow) * c;
      const [lon, y] = at(x, top(grow) + dip, c < 0);
      return [lon + 360 * Math.round((phi - lon) / 360), y];
    },
    t: (tt) => pr.yS * (1 - tt),
  };
  const solid = ([lon, y]: SP): [Vec3, Vec3] => {
    const s = Math.sin(lon * D), c = Math.cos(lon * D), half = c > 0 ? fAt : dAt;
    const a = Math.max(aAt(y), 1e-6), d = Math.max(half(y), 1e-6);
    const p: Vec3 = [a * s, y, d * c];
    const da = (aAt(y + 4) - aAt(y - 4)) / 8, dd = (half(y + 4) - half(y - 4)) / 8;
    // pháp tuyến của ellipse nửa rộng a(y), nửa sâu d(y) (nửa trước, nửa sau riêng): gradient của x²/a² + z²/d²
    const n: Vec3 = [s / a, -(s * s * da) / a - (c * c * dd) / d, c / d];
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

  /** Tam giác hoá polygon ở toạ độ mặt rồi chẻ đôi cạnh dài (cạnh chung chẻ một lần cho cả hai bên, không hở) */
  const fillMesh = (poly: SP[], lift = 0.3) => {
    const sp = poly.slice(0, -1);
    const pts = sp.map((p) => onTorso(p, lift));
    let tris = ShapeUtils.triangulateShape(sp.map(([x, y]) => new Vector2(x, y)), []);
    for (let pass = 0; pass < 12; pass++) {
      const mids = new Map<string, number>();
      const mid = (i: number, j: number) => {
        const key = i < j ? `${i} ${j}` : `${j} ${i}`;
        let m = mids.get(key);
        if (m === undefined) {
          const [p, q] = [pts[i], pts[j]];
          m = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) > FILL_EDGE ? sp.length : -1;
          if (m >= 0) {
            sp.push([(sp[i][0] + sp[j][0]) / 2, (sp[i][1] + sp[j][1]) / 2]);
            pts.push(onTorso(sp[m], lift));
          }
          mids.set(key, m);
        }
        return m;
      };
      const next: number[][] = [];
      for (const v of tris) {
        const m = [0, 1, 2].map((k) => mid(v[k], v[(k + 1) % 3]));
        const at = (k: number) => k % 3;
        const cut = m.filter((x) => x >= 0).length;
        if (cut === 0) next.push(v);
        else if (cut === 3) next.push([v[0], m[0], m[2]], [m[0], v[1], m[1]], [m[2], m[1], v[2]], [m[0], m[1], m[2]]);
        else if (cut === 1) {
          const k = m.findIndex((x) => x >= 0);
          next.push([v[k], m[k], v[at(k + 2)]], [m[k], v[at(k + 1)], v[at(k + 2)]]);
        } else {
          const k = m.findIndex((x) => x < 0);
          const [a, b] = [m[at(k + 1)], m[at(k + 2)]];
          next.push([a, v[at(k + 2)], b], [v[k], v[at(k + 1)], a], [v[k], a, b]);
        }
      }
      const done = next.length === tris.length;
      tris = next;
      if (done) break;
    }
    return { pts, tris: tris.flat() };
  };

  /**
   * Mảng áo: cắt polygon theo lưới ô cỡ `FILL_EDGE` trên mặt khối rồi tam giác hoá từng ô — sọc dài quanh khối mà tam giác
   * hoá cả polygon thì thành tam giác dài, chẻ mãi mới bám mặt cong
   */
  const rowYs = pts.map(([, y]) => y);
  const gridMesh = (poly: SP[], lift: number) => {
    // bỏ đỉnh gần thẳng hàng (lệch dưới `0.1`): sọc quanh khối còn bốn đỉnh, tam giác hoá ra vài tam giác thay vì hàng trăm mảnh dẹt
    const sp = simplify(poly.slice(0, -1), 0.1);
    if (sp.length < 3) return { pts: [], tris: [], normals: [] };
    const pts: Vec3[] = [];
    const normals: Vec3[] = [];
    const tris: number[] = [];
    // đỉnh chung giữa các ô dùng chung một chỉ số: pháp tuyến đỉnh trơn, không thành bậc thang theo ô
    const ids = new Map<string, number>();
    const id = (p: SP) => {
      const key = `${Math.round(p[0] * 1e3)} ${Math.round(p[1] * 1e3)}`;
      let i = ids.get(key);
      if (i === undefined) {
        ids.set(key, (i = pts.push(onTorso(p, lift)) - 1));
        normals.push(solid(p)[1]);
      }
      return i;
    };
    const step = FILL_EDGE * 0.8;
    // cắt theo ô chỉ đúng với hình lồi: tam giác hoá cả polygon trước, rồi cắt từng tam giác theo ô
    for (const t of ShapeUtils.triangulateShape(sp.map(([x, y]) => new Vector2(x, y)), [])) {
      const tri = t.map((i) => sp[i]);
      const [y0, y1] = [Math.min(...tri.map((p) => p[1])), Math.max(...tri.map((p) => p[1]))];
      // hàng cắt cả ở từng hàng của mặt cắt: góc bo gấu, bo vai đổi bề ngang nhanh, ô thưa thì dây cung chui vào khối
      const cuts = [...new Set([...rowYs.filter((y) => y > y0 && y < y1), ...Array.from({ length: Math.ceil(y1 / step) - Math.floor(y0 / step) + 1 }, (_, k) => (Math.floor(y0 / step) + k) * step)])].sort((a, b) => a - b);
      for (let i = 0; i + 1 < cuts.length; i++) {
        const ya = cuts[i], yb = cuts[i + 1];
        if (yb <= y0 || ya >= y1) continue;
        const row = clipHalf(clipHalf(tri, (p) => p[1] - ya), (p) => yb - p[1]);
        if (row.length < 3) continue;
        // ô ngang đo theo kinh độ: cỡ `step` px ở chỗ rộng nhất của hàng
        const dl = step / (Math.max(aAt(ya), aAt(yb), 1) * D);
        const [l0, l1] = [Math.min(...row.map((p) => p[0])), Math.max(...row.map((p) => p[0]))];
        for (let j = Math.floor(l0 / dl); j * dl < l1; j++) {
          const cell = clipHalf(clipHalf(row, (p) => p[0] - j * dl), (p) => (j + 1) * dl - p[0]);
          if (cell.length < 3) continue;
          const v = cell.map(id);
          for (let k = 1; k + 1 < v.length; k++) {
            const [a, b, c] = [v[0], v[k], v[k + 1]];
            if (a === b || b === c || a === c) continue;
            // mặt trước quay ra ngoài khối: vật liệu hai mặt lật pháp tuyến theo mặt nhìn thấy
            const [A, B, C] = [pts[a], pts[b], pts[c]];
            const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
            const n = normals[a];
            const side = (u[1] * w[2] - u[2] * w[1]) * n[0] + (u[2] * w[0] - u[0] * w[2]) * n[1] + (u[0] * w[1] - u[1] * w[0]) * n[2];
            // hệ thân `y` xuống, sang three lật `y`: quấn ra ngoài là `side < 0`
            if (side < 0) tris.push(a, b, c);
            else tris.push(a, c, b);
          }
        }
      }
    }
    return { pts, tris, normals };
  };

  const decalOf = (poly: SP[], lift: number) => {
    const { pts, tris, normals } = gridMesh([...poly, poly[0]], lift);
    return { pts, tris, decal: { lift, normals } };
  };
  /** px dọc mặt khối từ đường giữa trước ra kinh độ ở độ cao `y`, và ngược lại */
  const pxOf = ([lon, y]: SP): P2 => [lon * D * Math.max(aAt(y), 1e-6), y];
  const lonOf = ([x, y]: P2): SP => [x / (D * Math.max(aAt(y), 1e-6)), y];
  /** Dải bề ngang `w` px dọc đường `pts`, thon về hai đầu như nét bút */
  const ribbon = (pts: SP[], w: number): SP[] => {
    const q = pts.map(pxOf);
    const side = (s: number) =>
      q.map((p, i) => {
        const [a, b] = [q[Math.max(0, i - 1)], q[Math.min(q.length - 1, i + 1)]];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const h = (s * w * (0.35 + 0.65 * Math.sin((Math.PI * i) / (q.length - 1)))) / 2;
        return lonOf([p[0] - ((b[1] - a[1]) / l) * h, p[1] + ((b[0] - a[0]) / l) * h]);
      });
    return [...side(1), ...side(-1).reverse()];
  };
  const disc = (c: SP, r: number): SP[] => {
    const [x, y] = pxOf(c);
    return curve(10, (u) => lonOf([x + r * Math.cos(2 * Math.PI * u), y + r * Math.sin(2 * Math.PI * u)])).slice(0, -1);
  };

  const out: TorsoMesh = { profile: pts, depth, front, lines: [], fills: [], dots: [], sheets: [], solids: [], prints: [] };
  for (const m of g.marks === false ? [] : def.marks(surf)) {
    if (m.ink !== undefined && m.ink < 1 && !m.fill) {
      out.fills.push({ ...decalOf(m.dot ? disc(m.pts[0], (m.k * rig.stroke) / 2) : ribbon(dense(m.pts), m.k * rig.stroke), FAINT_LIFT), fill: 'line', ink: m.ink });
      continue;
    }
    if (m.dot) {
      out.dots.push({ p: onTorso(m.pts[0], 0), k: m.k });
      continue;
    }
    const pts = dense(m.pts, m.closed || !!m.fill);
    if (m.fill) out.fills.push({ ...fillMesh(pts, m.lift), fill: m.fill });
    if (m.k > 0) out.lines.push({ pts: pts.map((p) => onTorso(p)), k: m.k });
  }
  // mảng cùng màu cùng độ nổi gộp một lưới: hoạ tiết là hàng trăm mảnh nhỏ
  const merged = new Map<string, TorsoMesh['fills'][number]>();
  const panels = panelParts(surf, g, rig.height);
  for (const f of panels.fills) {
    // da của người mặc đồ ghi độ sâu và có nét hậu kỳ: lưới kín không khe, khe giữa ô lộ thân áo thành chấm mực
    if (f.fill === 'skin' && arm) {
      const m = fillMesh(f.pts, f.lift);
      // quấn ra ngoài khối như `gridMesh`: lượt pháp tuyến của nét hậu kỳ đọc mặt trước
      for (let i = 0; i < m.tris.length; i += 3) {
        const [A, B, C] = [m.pts[m.tris[i]], m.pts[m.tris[i + 1]], m.pts[m.tris[i + 2]]];
        const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
        if ((u[1] * w[2] - u[2] * w[1]) * A[0] + (u[0] * w[1] - u[1] * w[0]) * A[2] > 0) [m.tris[i + 1], m.tris[i + 2]] = [m.tris[i + 2], m.tris[i + 1]];
      }
      out.fills.push({ ...m, fill: f.fill, skin: true });
      continue;
    }
    const m = gridMesh(f.pts, f.lift);
    const key = `${f.fill} ${f.lift}`;
    const into = merged.get(key);
    if (!into) merged.set(key, { pts: m.pts, tris: m.tris, fill: f.fill, decal: { lift: f.lift, normals: m.normals } });
    else {
      const base = into.pts.length;
      for (const q of m.pts) into.pts.push(q);
      for (const n of m.normals) into.decal!.normals.push(n);
      for (const i of m.tris) into.tris.push(i + base);
    }
  }
  out.fills.push(...merged.values());
  for (const l of panels.lines) out.lines.push({ pts: l.pts.map((p) => onTorso(p, l.lift)), k: l.k });

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
        rib.lean,
      );
    };
    sheet(curve(NU, (u) => curve(NV, (v) => ribAt(360 * u, v))), [0, NV], "color", rib.line);
  }

  // miệng cổ viền gân của người mặc đồ lộ da: mặt khối từ viền cổ lên đỉnh và nắp đỉnh khối, dưới viền gân
  if (arm && def.rib) {
    const ring = curve(NU, (u) => surf.neck(360 * u - 180));
    const yTop = pts[0][1];
    const side = ring.map(([lon, y]) => curve(NECK_SKIN.rows, (v) => raise([lon, lerp(y, yTop, v)], NECK_SKIN.lift, 0, 0)));
    const rim = side.map((col) => col[col.length - 1]);
    const c: Vec3 = [0, Math.min(...rim.map((p) => p[1])), rim.reduce((z, p) => z + p[2], 0) / rim.length];
    const grid = side.map((col, i) => [...col, ...curve(NECK_SKIN.rows, (v) => lerp3(rim[i], c, v)).slice(1)]);
    const rows = grid[0].length;
    const tris: number[] = [];
    for (let i = 0; i < NU; i++)
      for (let j = 0; j + 1 < rows; j++) {
        const [a, b, d, e] = [i * rows + j, (i + 1) * rows + j, (i + 1) * rows + j + 1, i * rows + j + 1];
        tris.push(a, b, d, a, d, e);
      }
    const flat = grid.flat();
    // quấn ra ngoài khối như mảng da của `panels` (hệ thân `y` xuống): đo ở ô giữa ngực, hàng dưới
    const [A, B, C] = [0, rows, rows + 1].map((k) => flat[(NU / 2) * rows + k]);
    const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], w = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    if ((u[1] * w[2] - u[2] * w[1]) * A[0] + (u[0] * w[1] - u[1] * w[0]) * A[2] > 0)
      for (let k = 0; k < tris.length; k += 3) [tris[k + 1], tris[k + 2]] = [tris[k + 2], tris[k + 1]];
    out.fills.push({ pts: flat, tris, fill: 'skin', skin: true, neck: true });
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

  const body: WrapBody = { s: surf, depth: dAt, front: fAt, raise: (sp, lift) => raise(sp, lift, 0, 0), height: rig.height, belly: !!g.belly };
  if (def.wrap) {
    const w = wrapParts(body, WrapSchema.parse(g.wrap ?? {}));
    out.sheets.push(...w.sheets);
    out.solids.push(...w.solids);
    out.prints.push(...w.prints);
  }
  out.prints.push(...printParts(body, g));

  if (neck?.drape) {
    const d = drapeSolid({ s: surf, depth: dAt, front: fAt, height: rig.height, ...(arm && { shoulder: { at: arm.at, r: arm.cap } }) }, neck.drape);
    if (d) out.solids.push({ ...d, color: neck.color as MarkFill });
  }
  if (neck?.shades) out.solids.push(...shadesSolids({ s: surf, raise: (sp, lift) => raise(sp, lift, 0, 0) }, neck.shades));
  if (neck?.necklace) out.solids.push(...necklaceSolids({ s: surf, raise: (sp, lift) => raise(sp, lift, 0, 0) }, neck.necklace));

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
    const up = g.collarUp ?? 0;
    const stand: Vec3[][] = [];
    const leaf: Vec3[][] = [];
    for (let i = 0; i <= NU; i++) {
      const phi = (360 * i) / NU;
      const h = spec.stand * (Math.cos(phi * D) <= 0 ? 1 : Math.abs(Math.sin(phi * D)));
      const inner = surf.neck(phi);
      const o = outer(phi);
      stand.push([0, 1].map((w) => raise(inner, liftFold * w, h * w)));
      const down = curve(NV, (v) =>
        raise([lerp(inner[0], o[0], v), lerp(inner[1], o[1], v)], lerp(liftFold, liftEdge + tipLift(phi), v), h * (1 - v) ** 2),
      );
      leaf.push(up > 0 ? popUp(down, solid(inner)[1], phi, up) : down);
    }
    sheet(stand, [], spec.fill ?? "color", COLLAR_LINE);
    sheet(leaf, [0, NV], spec.fill ?? "color", COLLAR_LINE);
  }
  return out;
}

/**
 * Lá cổ dựng hẳn lên chếch ra ngoài theo pháp tuyến ngang của mặt khối ở chân cổ: bấy nhiêu phần ở sau gáy, tới phần thứ
 * hai ở giữa ngực — hai mũi cổ xoè ra hai bên cằm thay vì đâm lên
 */
export const COLLAR_POP_FLARE = [0.25, 1.5] as const;

/**
 * Lá cổ gập `down` (hàng `0` ở nếp gập) dựng lên phần `w` quanh nếp gập, ở góc `phi` quanh trục cổ: mỗi điểm giữ khoảng
 * cách tới nếp gập, hướng từ hướng gập xuống sang hướng dựng — lên trên, chếch ra ngoài theo pháp tuyến `n` của mặt khối
 */
function popUp(down: Vec3[], n: Vec3, phi: number, w: number): Vec3[] {
  const F = down[0];
  const l = Math.hypot(n[0], n[2]) || 1;
  const c = Math.max(0, Math.cos(phi * D));
  const out = lerp(COLLAR_POP_FLARE[0], COLLAR_POP_FLARE[1], c * c * (3 - 2 * c));
  const rise: Vec3 = [(n[0] / l) * out, -1, (n[2] / l) * out];
  const k = Math.hypot(...rise);
  return down.map((p, j) => {
    if (!j) return p;
    const d = [p[0] - F[0], p[1] - F[1], p[2] - F[2]];
    const len = Math.hypot(...d);
    const dir = [0, 1, 2].map((i) => lerp(d[i] / (len || 1), rise[i] / k, w));
    const m = len / (Math.hypot(...dir) || 1);
    return [F[0] + dir[0] * m, F[1] + dir[1] * m, F[2] + dir[2] * m];
  });
}

/** Váy dựng khối (`SkirtSchema` của rig): nón cụt tiết diện ellipse treo ở hông */
