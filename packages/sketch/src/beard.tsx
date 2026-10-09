import { useId } from "react";

import { D } from "./constants";
import { headPath, headWarp } from "./Head";
import { BeardSchema, type Beard } from "./schema";
import { depthHalf, grid, step, weld, type Layer } from "./sculpt";
import { onSkull, turnPoint, type HeadTurn, type Vec3 } from "./sphere";
import type { HeadShape, MoustacheKind, Pt } from "./types";

/** Lưới râu: số cột kinh độ giữa hai mép sau, số hàng từ đáy lên mép trên; dải ria thưa hơn */
const NI = 72;
const NJ = 16;
const LIP_NI = 24;
const LIP_NJ = 3;
/** Mép trên chuyển từ má lên tóc mai trong khoảng kinh độ này */
const BURN_FROM = 78;
/** Râu dày đủ từ đáy tới bấy nhiêu phần chiều cao cột, rồi mỏng dần về mép trên */
const BULK_TOP = 0.55;
/** Mép sau thẳng: râu mỏng về da trong bấy nhiêu độ kinh cuối */
const EDGE_EASE = 8;
/** Phần râu rủ dồn về độ sâu này trước mặt phẳng giữa, nhìn nghiêng thì rủ dưới cằm chứ không dưới gáy */
const DROP_Z = 0.5;
/** Râu rủ ngắn hơn bấy nhiêu thì dồn ít đi theo tỉ lệ */
const DROP_FULL = 0.3;
/** Mặt dưới cằm rủ bấy nhiêu phần so với mặt trước: rủ sâu nhất ở cằm, không ở đáy sọ */
const DROP_UNDER = 0.3;
/** Mặt phẳng giữa trước bấy nhiêu thì râu đi hẳn theo nét mặt, sát viền thì bám sọ */
const FACE_HOLD = 0.5;
/** Mồm mở kéo râu trong bấy nhiêu độ kinh quanh trục giữa đi hẳn theo, ra tới tai thì đứng yên */
const JAW_HOLD = 20;
/** Râu cách mồm từ bấy nhiêu độ vĩ trở ra thì đi hẳn theo môi */
const JAW_SPAN = 6;
/** Râu lún phún: độ đục của lớp màu */
export const STUBBLE_OPACITY = 0.4;

/** Bộ số mẫu; áp mẫu là thay cả `beard`, `moustache` là ria đi kèm. docs/02-trang-phuc.md#râu-dựng-khối */
export const BEARD_PRESETS = {
  stubble: {
    label: "Râu lún phún",
    beard: { stubble: true, cheek: 12, gap: -12, bulk: 0 },
    moustache: "none",
  },
  short: { label: "Quai nón ngắn", beard: {}, moustache: "short" },
  full: {
    label: "Quai nón dài",
    beard: { cheek: 10, bulk: 0.09, length: 0.35 },
    moustache: "short",
  },
  long: {
    label: "Râu xồm",
    beard: { cheek: 12, bulk: 0.12, length: 0.9 },
    moustache: "walrus",
  },
  ducktail: {
    label: "Đuôi vịt",
    beard: { length: 0.5, tip: "point" },
    moustache: "short",
  },
  chinCurtain: {
    label: "Viền hàm",
    beard: { cheek: -18, gap: 22, bulk: 0.05 },
    moustache: "none",
  },
  boxed: {
    label: "Quai nón gọn",
    beard: { cheek: 6, gap: 8, notch: 16, soft: 8, bulk: 0.02, lip: 7, lipWidth: 30, lipRise: 2 },
    moustache: "none",
  },
  circle: {
    label: "Vòng quanh mồm",
    beard: { reach: 29, cheek: 4, gap: 7, notch: 23, soft: 2, bulk: 0, lip: 3 },
    moustache: "none",
  },
  ring: {
    label: "Vòng mảnh",
    beard: { reach: 25, cheek: 4, gap: 32, notch: 21, soft: 1, bulk: 0, lip: 3 },
    moustache: "none",
  },
  goatee: {
    label: "Râu quanh mồm",
    beard: { reach: 34, round: 14, cheek: 2, notch: 16, bulk: 0.05 },
    moustache: "short",
  },
  vanDyke: {
    label: "Chòm nhọn",
    beard: { reach: 18, round: 16, cheek: -14, gap: 12, bulk: 0.05, length: 0.3, tip: "point" },
    moustache: "handlebar",
  },
  muttonChops: {
    label: "Tóc mai rậm",
    beard: { shave: 0.42, cheek: 10, bulk: 0.06 },
    moustache: "short",
  },
} as const satisfies Record<
  string,
  { label: string; beard: Partial<Beard>; moustache: MoustacheKind }
>;

export type BeardPreset = keyof typeof BEARD_PRESETS;

/** Mẫu mà bộ số `raw` đang đúng bằng, không thì `undefined` (đã chỉnh tay) */
export function beardPresetOf(raw: Partial<Beard> | undefined): BeardPreset | undefined {
  const b = BeardSchema.parse(raw ?? {});
  return (Object.keys(BEARD_PRESETS) as BeardPreset[]).find((k) => {
    const q = BeardSchema.parse(BEARD_PRESETS[k].beard);
    return (Object.keys(b) as (keyof Beard)[]).every((f) => b[f] === q[f]);
  });
}

export interface BeardPaths {
  /** Phần trước mặt phẳng giữa; viền là nét của chính hình này vẽ dưới ruột, chỉ lộ đường bao */
  front: string;
  /** Phần sau mặt phẳng giữa: `SculptBeard` cắt theo viền đầu, chỉ còn chỗ thò ra ngoài */
  back: string;
  head: (grow: number) => string;
  stubble: boolean;
  /** Râu phủ lên chỗ mồm: mồm vẽ đè lên thì cần viền */
  covers: boolean;
  /** Hộp bao hình chiếu, hộp mảnh của socket `chin` */
  box: { x: number; y: number; w: number; h: number };
}

/**
 * Chỗ nét mặt vẽ mồm, để phần râu trước mặt khớp vào đó như kính khớp vào mắt. `yaw` là góc lắc
 * mà nét mặt vẽ theo khi nó khác góc của sọ: `rear` vẽ mặt ở lắc 90, râu quanh mồm quay theo góc
 * ấy rồi chuyển dần về góc của sọ ở tai
 */
export interface BeardFit {
  x: number;
  y: number;
  yaw?: number;
  /** Môi dưới hạ và môi trên nhấc bấy nhiêu so với mồm đóng (`mouthExtent`); râu dưới / trên mồm đi theo */
  open?: { down: number; up: number };
}

/** Độ rủ theo bề ngang `x` của sọ đơn vị, `1` ở giữa; `wx` là nửa bề ngang của râu */
function dropProfile(b: Beard, x: number, wx: number): number {
  const u = Math.min(1, Math.abs(x) / wx);
  switch (b.tip) {
    case "point":
      return (1 - u) ** 1.6;
    case "square":
      return 1 - step(0.55, 1, u);
    case "fork":
      return Math.sqrt(1 - u * u) * (1 - 0.55 * Math.exp(-((x / (0.16 * wx)) ** 2)));
    default:
      return Math.sqrt(1 - u * u);
  }
}

const cache = new Map<string, BeardPaths>();
const CACHE_SIZE = 64;

/**
 * Dựng râu trên nửa dưới sọ đơn vị quanh mồm ở vĩ độ `mouth`, quay theo `t`, ra toạ độ nhóm đầu
 * quanh tâm `(cx, cy)`. Mỗi cột kinh độ là một dải từ đáy lên mép trên; phần quay ra người xem
 * dời theo `fit` cho khấc trùng mồm, phần sát viền bám sọ và nắn theo `headWarp`.
 */
export function beardPaths(
  raw: Partial<Beard> | undefined,
  t: HeadTurn,
  mouth: number,
  shape: HeadShape,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fit?: BeardFit,
): BeardPaths {
  const key = JSON.stringify([raw, t.yaw, t.pitch, t.look, mouth, shape, cx, cy, rx, ry, fit]);
  let p = cache.get(key);
  if (!p) {
    p = buildBeard(BeardSchema.parse(raw ?? {}), t, mouth, shape, cx, cy, rx, ry, fit);
    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
    cache.set(key, p);
  }
  return p;
}

function buildBeard(
  b: Beard,
  t: HeadTurn,
  mouth: number,
  shape: HeadShape,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fit?: BeardFit,
): BeardPaths {
  const reach = Math.max(1, b.reach);
  const lift = b.stubble ? 0 : b.bulk;
  const length = b.stubble ? 0 : b.length;
  const faceYaw = fit?.yaw ?? t.yaw;
  const turnAt = (lon: number) => ({
    yaw: faceYaw + (t.yaw - faceYaw) * step(0, 90, Math.abs(lon)),
    pitch: t.pitch,
    look: t.look,
  });
  const turn = turnAt(0);
  const warp = headWarp(shape, rx, ry);
  const flat = (p: Vec3): Pt => [cx + rx * p[0], cy - ry * p[1]];
  const m = turnPoint(turn, onSkull(0, mouth));
  const [mx, my] = flat(m);
  const shift: Pt = fit ? [fit.x - mx, fit.y - my] : [0, 0];
  const y0 = Math.sin(mouth * D);
  const wx = Math.sin(Math.min(90, reach) * D);

  /** Dải của cột: đáy và mép trên, `undefined` là cột trống */
  const span = (lon: number): [number, number] | undefined => {
    const a = Math.abs(lon);
    let low = -90;
    if (b.shave > 0) {
      const s = Math.sin(a * D);
      if (s <= b.shave) return undefined;
      low = -Math.acos(b.shave / s) / D;
    }
    const cheek = mouth + b.cheek;
    let top = cheek + (b.burn - cheek) * step(BURN_FROM, Math.max(BURN_FROM + 1, reach), a);
    const floor = mouth - b.gap;
    if (!b.cover)
      top = Math.min(
        top,
        floor + (top - floor) * step(b.notch, b.notch + Math.max(0.1, b.soft), a),
      );
    if (b.round > 0 && a > reach - b.round) {
      const u = Math.min(1, (a - reach + b.round) / b.round);
      top = low + (top - low) * Math.sqrt(1 - u * u);
    }
    return top > low + 0.5 ? [low, top] : undefined;
  };

  const vertex = (lon: number, lat: number, r: number, lip = false): Vec3 => {
    const a = Math.abs(lon);
    const { down, up: rise } = fit?.open ?? { down: 0, up: 0 };
    const up = b.cover ? 0 : rise;
    const lips = lip
      ? -up
      : down * step(0, JAW_SPAN, mouth - lat) - up * step(0, JAW_SPAN, lat - mouth);
    const jaw = lips * (1 - step(JAW_HOLD, 90, a));
    const ease = (1 - step(BULK_TOP, 1, r)) * (b.round > 0 ? 1 : step(0, EDGE_EASE, reach - a));
    const p = onSkull(lon, lat, lift * ease);
    if (length > 0) {
      const g = dropProfile(b, p[0], wx);
      const h = Math.max(0, Math.min(1, (y0 - p[1]) / (y0 + 1 + lift))) ** 1.5;
      p[1] -= length * g * h * (DROP_UNDER + (1 - DROP_UNDER) * step(-0.2, 0.6, p[2]));
      p[2] += (DROP_Z - p[2]) * g * h * Math.min(1, length / DROP_FULL);
    }
    const at = turnAt(lon);
    const q = turnPoint(at, p);
    const w = step(0, FACE_HOLD, turnPoint(at, onSkull(lon, lat))[2]);
    const [sx, sy] = warp(q[0], q[1]);
    const [fx, fy] = flat(q);
    return [
      cx + sx + (fx + shift[0] - cx - sx) * w,
      cy + sy + (fy + shift[1] - cy - sy) * w + jaw,
      q[2],
    ];
  };

  /** Dải ria: mép dưới ngay trên mồm, bo tròn hai đầu; phẳng trên da */
  const lipSpan = (lon: number): [number, number] | undefined => {
    const u = Math.abs(lon) / Math.max(1, b.lipWidth);
    const h = b.lip * Math.sqrt(Math.max(0, 1 - u ** 4));
    const low = mouth + b.lipRise;
    return h > 0.2 ? [low, low + h] : undefined;
  };

  /** Một mảng cột kinh độ trong `± half`, mỗi cột một dải `at(lon)` chia `nj` hàng */
  const sheet = (
    half: number,
    ni: number,
    nj: number,
    at: (lon: number) => [number, number] | undefined,
    lifted: boolean,
  ) => {
    const cols = Array.from({ length: ni + 1 }, (_, i) => {
      const lon = -half + (2 * half * i) / ni;
      const s = at(lon);
      return (
        s &&
        Array.from({ length: nj + 1 }, (_, j) =>
          vertex(lon, s[0] + ((s[1] - s[0]) * j) / nj, lifted ? j / nj : 1, !lifted),
        )
      );
    });
    const cells = Array.from({ length: ni }, (_, i) => {
      const [A, B] = [cols[i], cols[i + 1]];
      if (!A || !B) return undefined;
      return Array.from({ length: nj }, (_, j) => [A[j], B[j], B[j + 1], A[j + 1]]);
    });
    return { cols, cells };
  };
  const sheets = [sheet(reach, NI, NJ, span, true)];
  if (b.lip > 0 && !b.stubble)
    sheets.push(sheet(Math.max(1, b.lipWidth), LIP_NI, LIP_NJ, lipSpan, false));
  const pts = sheets.flatMap((sh) => sh.cols.flatMap((c) => c ?? []));
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const box = pts.length
    ? {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        h: Math.max(...ys) - Math.min(...ys),
      }
    : { x: cx, y: cy, w: 0, h: 0 };
  const front: Layer = { fill: [], edge: [] };
  const back: Layer = { fill: [], edge: [] };
  for (const { cells } of sheets)
    grid(cells, false, front, back, (q) => {
      for (const side of [1, -1]) {
        const half = depthHalf(q, side);
        if (half.length >= 3) (side > 0 ? front : back).fill.push(half);
      }
    });
  return {
    front: weld(front.fill),
    back: weld(back.fill),
    head: (grow) => headPath(shape, cx, cy, rx + grow, ry + grow),
    stubble: b.stubble,
    covers:
      !b.stubble &&
      ((span(0)?.[1] ?? -90) > mouth || (b.lip > 0 && b.lipRise < 0 && b.lip + b.lipRise > 0)),
    box,
  };
}

/**
 * Râu dựng khối: nét của chính hình vẽ dưới, ruột đè lên nên chỉ còn nửa viền ngoài theo đường bao,
 * không nét nào trong lòng râu. Phần sau mặt
 * phẳng giữa bị khoét theo viền đầu nở nửa nét. Lún phún thì chỉ một lớp màu mờ. Vẽ trong hệ nhóm đầu;
 * vẽ trong nhóm nét mặt đã gật thì `skull` đưa viền đầu từ nhóm đầu vào nhóm ấy.
 */
export function SculptBeard({
  paths,
  color,
  line,
  stroke,
  skull,
}: {
  paths: BeardPaths;
  color: string;
  line: string;
  stroke: number;
  skull?: string;
}) {
  const id = `beard${useId().replace(/:/g, "")}`;
  const clip = paths.back ? `url(#${id})` : undefined;
  if (paths.stubble)
    return <path d={paths.front} fill={color} fillOpacity={STUBBLE_OPACITY} stroke="none" />;
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      {clip && (
        <clipPath id={id}>
          <path
            d={`M-1e4 -1e4H1e4V1e4H-1e4Z${paths.head(stroke / 2)}`}
            clipRule="evenodd"
            transform={skull}
          />
        </clipPath>
      )}
      <path d={paths.back} fill="none" stroke={line} strokeWidth={stroke * 1.4} clipPath={clip} />
      <path d={paths.front} fill="none" stroke={line} strokeWidth={stroke * 1.4} />
      <path d={paths.back} fill={color} clipPath={clip} />
      <path d={paths.front} fill={color} />
    </g>
  );
}
