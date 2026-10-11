import { D, SKIRT_EASE, SKIRT_FALL, SKIRT_REACH, TORSO_DEPTH, TORSO_TILT } from "./constants";
import { SkirtSchema, type CharacterData, type Skirt } from "./schema";
import { turnPoint, type Vec3 } from "./sphere";
import { localProject, type LocalLens } from "./lens";
import { cladThigh } from "./act3";
import type { Figure } from "./geometry";
import type { Pt } from "./types";

type P2 = [number, number];

export interface SkirtPaths {
  /** Hình bao, đã co vào nửa nét: viền vẽ dày gấp đôi bên dưới ruột */
  body: string;
  /** Nếp trên mặt khối, đã bỏ phần quay ra sau */
  pleats: string;
  /** Hộp bao cả viền, trong hệ nhóm thân */
  box: { x: number; y: number; w: number; h: number };
}

const f = (n: number) => String(Math.round(n * 10) / 10);

/** Bộ số đã đủ: trường bỏ trống lấy mặc định */
export const skirtOf = (raw: Partial<Skirt> | undefined): Skirt => SkirtSchema.parse(raw ?? {});

/** Bao lồi theo chiều kim đồng hồ trên màn hình (`y` xuống) */
export function hull(pts: P2[]): P2[] {
  const s = [...pts].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o: P2, a: P2, b: P2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: P2[]) => {
    const h: P2[] = [];
    for (const p of list) {
      while (h.length > 1 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(s), ...half([...s].reverse())];
}

/**
 * Váy phủ dọc một đùi bấy nhiêu đơn vị rig: tới chỗ gấu buông thẳng chạm, không quá `length` và không
 * quá `SKIRT_REACH` chiều dài đùi `lt`; `angle` là góc đùi so với trục thân, radian
 */
export function skirtCover(g: Skirt, height: number, angle: number, lt: number) {
  const len = g.length * height;
  const stand = Math.max(0, len - g.rise * height);
  return Math.min(stand / Math.max(Math.cos(angle), 0.05), len, lt * SKIRT_REACH);
}

/** Gấu rủ khỏi mút đùi bấy nhiêu khi đùi lệch trục thân trung bình `mean` radian */
export const skirtFall = (g: Skirt, mean: number) =>
  g.flare * (1 - Math.max(0, Math.cos(mean))) * SKIRT_FALL;

const cache = new Map<string, SkirtPaths>();
const CACHE_SIZE = 64;

/** Đùi trong hệ nhóm thân: hông → gối, trục `y` của nhóm thân nghiêng theo `torso` */
const thighOf = (leg: Pt[], torso: number): [P2, P2] => {
  const c = Math.cos(torso * D);
  const s = Math.sin(torso * D);
  const at = ([x, y]: Pt): P2 => [x * c + y * s, -x * s + y * c];
  return [at(leg[0]), at(leg[1])];
};

/**
 * Váy dựng khối quay `yaw` độ, ra toạ độ nhóm thân (gốc ở hông). Khối là hình nón cụt tiết diện
 * ellipse như thân áo; gấu rủ theo góc đùi, và hình bao gồm cả hai đùi tới `SKIRT_REACH` để chân
 * không xuyên qua váy khi sải hay ngồi. Người 3D chiếu qua ống kính thật trong hệ thân và lấy góc đùi
 * thật (`thighs`), không lấy góc trên khung. docs/02-trang-phuc.md#váy-dựng-khối
 */
export function skirtPaths(
  c: CharacterData,
  fig: Figure,
  torso: number,
  yaw: number,
  stroke: number,
  real?: { torsoLens: LocalLens; thighs: [number, number][] },
) {
  const g = skirtOf(c.pieces.hem.skirt);
  const legW = c.palette.clad
    ? 2 * cladThigh(c.palette.trouserWidth, stroke, c.rig.hipHalf)
    : c.palette.trouserWidth;
  const thighs = [thighOf(fig.legN, torso), thighOf(fig.legF, torso)];
  const r3 = real && {
    lens: real.torsoLens,
    thighs: real.thighs.map(([a, l]): [number, number] => [Math.round(a), Math.round(l)]),
  };
  const key = JSON.stringify([
    g,
    yaw,
    c.rig.height,
    stroke,
    legW,
    thighs.flat(2).map(Math.round),
    r3,
  ]);
  let p = cache.get(key);
  if (!p) {
    p = buildSkirt(g, c.rig.height, thighs, legW, yaw, stroke, r3);
    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
    cache.set(key, p);
  }
  return p;
}

function buildSkirt(
  g: Skirt,
  height: number,
  thighs: [P2, P2][],
  legW: number,
  yaw: number,
  stroke: number,
  real?: { lens: LocalLens; thighs: [number, number][] },
): SkirtPaths {
  const inset = stroke / 2;
  const t = { yaw, pitch: 0 };
  const cy = Math.cos(yaw * D);
  const sy = Math.sin(yaw * D);
  const lens = real?.lens;
  const view = lens
    ? (p: Vec3): Vec3 => {
        const [x, y, d] = localProject(lens, p);
        return [x, y, -d];
      }
    : (p: Vec3): Vec3 => {
        const [x, y, z] = turnPoint(t, p);
        return [x, y + TORSO_TILT * z, z];
      };
  // Góc đùi so với trục thân: `0` buông thẳng, `90` nằm ngang. Gấu rủ thẳng chỉ khi đùi buông
  const angles = real
    ? real.thighs.map(([a]) => a * D)
    : thighs.map(([h, k]) => Math.atan2(k[0] - h[0], k[1] - h[1]));
  const mean = (angles[0] + angles[1]) / 2;
  const hang = Math.max(0, Math.cos(mean));
  const yW = -g.rise * height;
  const len = g.length * height;
  const yH = yW + len * hang;
  // Gấu là vành cạp nở đều `flare` ra mọi phía, nên nhìn nghiêng váy xoè bằng nhìn thẳng
  const aW = Math.max(1, g.waist - inset);
  const spread = g.flare * hang;
  const ring = (u: number, y: number, phi: number) =>
    view([(aW + spread * u) * Math.sin(phi), y, (TORSO_DEPTH * aW + spread * u) * Math.cos(phi)]);
  const N = 72;
  const pts: P2[] = [];
  for (let i = 0; i < N; i++) {
    const phi = (2 * Math.PI * i) / N;
    for (const u of [0, 1]) {
      const [x, y] = ring(u, yW + (yH - yW) * u, phi);
      pts.push([x, y]);
    }
  }
  // Đùi: váy phủ dọc đùi tới chỗ gấu đứng thẳng chạm, nhưng không quá `length` và không quá `SKIRT_REACH` đùi
  const r = Math.max(1, legW / 2 + SKIRT_EASE - inset);
  thighs.forEach(([h, k], i) => {
    const l = Math.hypot(k[0] - h[0], k[1] - h[1]) || 1;
    const cover = (lt: number) => skirtCover(g, height, angles[i], lt);
    // Người 3D: tầm phủ đo trên đùi thật rồi đổi ra phần của đùi đã chiếu
    const lt = real?.thighs[i][1] || 1;
    const reach = real ? (cover(lt) * l) / lt : cover(l);
    const [ux, uy] = [(k[0] - h[0]) / l, (k[1] - h[1]) / l];
    const end: P2 = [h[0] + ux * reach, h[1] + uy * reach];
    // Ở mút đùi gấu rủ khỏi đùi bằng phần xoè mà gấu buông không dùng tới
    const fall = skirtFall(g, mean);
    for (let j = 0; j < 16; j++) {
      const a = (2 * Math.PI * j) / 16;
      const [ca, sa] = [Math.cos(a), Math.sin(a)];
      pts.push([h[0] + r * ca, h[1] + r * sa]);
      pts.push([end[0] + r * ca, end[1] + r * sa + (sa > 0 ? fall * sa : 0)]);
    }
  });
  const outline = hull(pts);
  const body = `M${outline.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}Z`;

  // Nếp: đường thẳng trên mặt nón cụt từ cạp xuống gấu, chỉ vẽ ở chỗ quay ra người xem
  const facing = (phi: number) => {
    const nx = Math.sin(phi) / (aW + spread);
    const nz = Math.cos(phi) / (TORSO_DEPTH * aW + spread);
    if (!lens) return (-nx * sy + nz * cy) / (Math.hypot(nx, nz) || 1);
    const y = (yW + yH) / 2;
    const p = [
      (aW + spread / 2) * Math.sin(phi),
      y,
      (TORSO_DEPTH * aW + spread / 2) * Math.cos(phi),
    ];
    const e = [lens.eye[0] - p[0], lens.eye[1] - p[1], lens.eye[2] - p[2]];
    return (nx * e[0] + nz * e[2]) / ((Math.hypot(nx, nz) || 1) * Math.hypot(...e));
  };
  let pleats = "";
  const n = Math.round(g.pleats);
  if (n > 0 && yH - yW > 8)
    for (let i = 0; i < n; i++) {
      const phi = (2 * Math.PI * (i + 0.5)) / n;
      if (facing(phi) < 0.5) continue;
      const a = ring(0.3, yW + (yH - yW) * 0.3, phi);
      const b = ring(0.9, yW + (yH - yW) * 0.9, phi);
      pleats += `M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`;
    }

  const xs = outline.map((q) => q[0]);
  const ys = outline.map((q) => q[1]);
  const pad = inset * 2;
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  return {
    body,
    pleats,
    box: { x: x0, y: y0, w: Math.max(...xs) + pad - x0, h: Math.max(...ys) + pad - y0 },
  };
}
