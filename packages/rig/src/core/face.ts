import { BROW_ABOVE, SIDE_EYE_OVAL } from "./constants";
import type { BrowKind, EyeKind, MouthKind, WrinkleKind } from "./types";

/**
 * Nét mặt — khẩu hình, mắt, mày, nếp nhăn — là một danh sách nét theo nghĩa SVG, px của đầu cao
 * 130. `face.ts` của người 3D vẽ chúng lên canvas dán trên sọ. Thêm một kiểu là thêm một dòng vào `MOUTHS` / `EYES` / `BROWS`.
 * docs/01-rig.md#khẩu-hình-và-mắt
 */

/** Thuộc tính vẽ cùng tên và cùng mặc định như thuộc tính SVG; nét con kế thừa của nhóm */
export interface FaceInk {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: "round";
  strokeLinejoin?: "round";
}

type Quad = [number, number, number, number];
type MarkShape =
  { path: string } | { line: Quad } | { ellipse: Quad } | { rect: Quad } | { group: FaceMark[] };

/**
 * Một nét: hình (`line` x1 y1 x2 y2, `ellipse` cx cy rx ry, `rect` x y w h) kèm thuộc tính vẽ.
 * `{ clip }` khai vùng cắt cho các nét `clipped` cùng danh sách, tại đúng chỗ của nó.
 */
export type FaceMark = (MarkShape & FaceInk & { clipped?: true }) | { clip: string };

const MOUTH_INK = "#3a2620";
const EYE_INK = "#22201d";
const CAVITY = "#7a2b22";
const TOOTH = "#f7f2e6";
const TONGUE = "#d0675a";
const WHITE = "#f7f2e6";

/** Bán kính con ngươi lúc mở thường; các kiểu mắt khác đo theo nó */
export const EYE_R = 6;

const LINE = { fill: "none", stroke: MOUTH_INK, strokeWidth: 3, strokeLinecap: "round" } as const;
const THIN = { fill: "none", stroke: MOUTH_INK, strokeWidth: 2.2, strokeLinecap: "round" } as const;
const RIM = { fill: "none", stroke: MOUTH_INK, strokeWidth: 2.4, strokeLinejoin: "round" } as const;
/** Vạch ngăn hai hàm răng trong `talkTeeth`, `grit` */
const SEAM = { fill: "none", stroke: MOUTH_INK, strokeWidth: 1.6 } as const;

interface MouthDef {
  /** Mép trên / dưới so với tâm miệng, cho râu bám theo */
  extent: { top: number; bottom: number };
  marks: (cx: number, cy: number) => FaceMark;
}

/** Viền chữ D: góc trên nhọn, mép trên vồng `0,5`, đáy tròn */
function dPath(cx: number, cy: number, w: number, top: number, bottom: number) {
  const y0 = cy + top;
  const y1 = cy + bottom;
  const k = y0 + 0.55 * (y1 - y0);
  return (
    `M ${cx - w} ${y0} Q ${cx} ${y0 - 1} ${cx + w} ${y0}` +
    ` C ${cx + w} ${k} ${cx + 0.55 * w} ${y1} ${cx} ${y1}` +
    ` C ${cx - 0.55 * w} ${y1} ${cx - w} ${k} ${cx - w} ${y0} Z`
  );
}

/**
 * Bộ nói neutral dáng chữ D: mép trên gần phẳng, đáy tròn. `w` nửa bề ngang, `top` / `bottom`
 * mép trên / dưới so với tâm, `teeth` bề dày dải răng trên, `tongue` bề cao lưỡi ở đáy.
 */
function talk(w: number, top: number, bottom: number, teeth: number, tongue: number): MouthDef {
  return {
    extent: { top: top - 0.5, bottom },
    marks: (cx, cy) =>
      open(dPath(cx, cy, w, top, bottom), cx, w, cy + top, cy + bottom, teeth, tongue),
  };
}

/** Miệng bầu dục: nửa bề ngang, nửa bề cao, tâm lệch xuống, dải răng trên, lưỡi ở đáy */
function oval(rx: number, ry: number, dy: number, teeth: number, tongue: number): MouthDef {
  return {
    extent: { top: dy - ry, bottom: dy + ry },
    marks: (cx, cy) => {
      const [y0, y1] = [cy + dy - ry, cy + dy + ry];
      const d = `M ${cx} ${y0} A ${rx} ${ry} 0 1 1 ${cx} ${y1} A ${rx} ${ry} 0 1 1 ${cx} ${y0} Z`;
      return open(d, cx, rx, y0, y1, teeth, tongue);
    },
  };
}

/** Khẩu hình há có răng: khoang, lưỡi ở đáy và dải răng trên cắt trong viền, rồi viền */
function open(
  d: string,
  cx: number,
  w: number,
  y0: number,
  y1: number,
  teeth: number,
  tongue: number,
): FaceMark {
  return {
    group: [
      { clip: d },
      { path: d, fill: CAVITY },
      {
        group: [
          ...(tongue > 0 ? [{ ellipse: [cx, y1, w * 0.62, tongue] as Quad, fill: TONGUE }] : []),
          {
            path: `M ${cx - w - 2} ${y0 - 3} H ${cx + w + 2} V ${y0 + teeth} Q ${cx} ${y0 + teeth + 2} ${cx - w - 2} ${y0 + teeth} Z`,
            fill: TOOTH,
          },
        ],
        clipped: true,
      },
      { path: d, ...RIM },
    ],
  };
}

/** Chữ D tô trắng, vạch cong chia hai hàm: răng cắn khi nói */
function bite(w: number, top: number, bottom: number): MouthDef {
  return {
    extent: { top: top - 0.5, bottom },
    marks: (cx, cy) => {
      const d = dPath(cx, cy, w, top, bottom);
      const mid = cy + (top + bottom) / 2 - 0.75;
      return {
        group: [
          { clip: d },
          { path: d, fill: TOOTH },
          {
            path: `M ${cx - w} ${mid} Q ${cx} ${mid + 1.5} ${cx + w} ${mid}`,
            ...SEAM,
            clipped: true,
          },
          { path: d, ...RIM },
        ],
      };
    },
  };
}

/** Nửa bề ngang và nửa chiều cao của khẩu hình nghiến răng */
const GRIT = { w: 15, h: 7 };

function sad(large: boolean): MouthDef {
  const b = large ? 10 : 4;
  return {
    extent: { top: -7, bottom: large ? 12 : 6 },
    marks: (cx, cy) => {
      const d = `M ${cx - 13} ${cy + 1} C ${cx - 10} ${cy - 7} ${cx + 10} ${cy - 7} ${cx + 13} ${cy + 1} Q ${cx + 15} ${cy + b} ${cx + 11} ${cy + b} H ${cx - 11} Q ${cx - 15} ${cy + b} ${cx - 13} ${cy + 1} Z`;
      return {
        group: [
          { path: d, fill: large ? CAVITY : TOOTH },
          ...(large
            ? [
                { clip: d },
                { rect: [cx - 16, cy - 8, 32, 9] as Quad, fill: TOOTH, clipped: true as const },
              ]
            : []),
          { path: d, ...RIM },
        ],
      };
    },
  };
}

function angry(b: number): MouthDef {
  return {
    extent: { top: -10, bottom: b + 2 },
    marks: (cx, cy) => {
      const d = `M ${cx - 11} ${cy - 6} Q ${cx} ${cy - 10} ${cx + 11} ${cy - 6} L ${cx + 15} ${cy + b} Q ${cx} ${cy + b - 4} ${cx - 15} ${cy + b} Z`;
      return {
        group: [
          { clip: d },
          { path: d, fill: CAVITY },
          {
            path: `M ${cx - 16} ${cy - 12} H ${cx + 16} V ${cy - 1} Q ${cx} ${cy - 5} ${cx - 16} ${cy - 1} Z`,
            fill: TOOTH,
            clipped: true,
          },
          { path: d, ...RIM },
        ],
      };
    },
  };
}

/** La mắng: hình thang bè dưới rộng gần nửa mặt, mép trên vồng cao, đáy tròn xuống gần cằm, dải răng trên theo vồng, lưỡi to */
const shout: MouthDef = {
  extent: { top: -14, bottom: 30 },
  marks: (cx, cy) => {
    const d =
      `M ${cx - 23} ${cy - 5} Q ${cx} ${cy - 21} ${cx + 23} ${cy - 5}` +
      ` C ${cx + 27} ${cy + 4} ${cx + 30} ${cy + 17} ${cx + 28} ${cy + 24}` +
      ` Q ${cx} ${cy + 33} ${cx - 28} ${cy + 24}` +
      ` C ${cx - 30} ${cy + 17} ${cx - 27} ${cy + 4} ${cx - 23} ${cy - 5} Z`;
    return {
      group: [
        { clip: d },
        { path: d, fill: CAVITY },
        {
          group: [
            { ellipse: [cx, cy + 28, 17, 9], fill: TONGUE },
            {
              path: `M ${cx - 34} ${cy - 24} H ${cx + 34} V ${cy + 2} H ${cx + 23} Q ${cx} ${cy - 12} ${cx - 23} ${cy + 2} H ${cx - 34} Z`,
              fill: TOOTH,
            },
          ],
          clipped: true,
        },
        { path: d, ...RIM },
      ],
    };
  },
};

/** Ngoặc má phồng ở `x`, mở về phía `s` (`1` là `)`) */
const cheek = (cx: number, cy: number, x: number, s: 1 | -1): FaceMark => ({
  path: `M ${cx + x} ${cy - 6} Q ${cx + x + s * 5.5} ${cy} ${cx + x} ${cy + 6}`,
  ...THIN,
});

/** Chữ `3` của môi chu (thổi, huýt sáo) */
function chibiThree(): MouthDef {
  return {
    extent: { top: -7, bottom: 7 },
    marks: (cx, cy) => ({
      path: `M ${cx - 2} ${cy - 6} Q ${cx + 4} ${cy - 6} ${cx + 3} ${cy - 2} Q ${cx + 2} ${cy} ${cx - 1} ${cy} Q ${cx + 2} ${cy} ${cx + 3} ${cy + 2} Q ${cx + 4} ${cy + 6} ${cx - 2} ${cy + 6}`,
      ...LINE,
    }),
  };
}

/** Khẩu hình: thứ tự khoá là thứ tự của `MOUTH_KINDS` */
export const MOUTHS = {
  closed: {
    extent: { top: -2, bottom: 2 },
    marks: (cx, cy) => ({ line: [cx - 11, cy, cx + 11, cy], ...LINE }),
  },
  parted: {
    extent: { top: -2.5, bottom: 3 },
    marks: (cx, cy) => ({
      path: `M ${cx - 5} ${cy} Q ${cx} ${cy - 3} ${cx + 5} ${cy} Q ${cx} ${cy + 4} ${cx - 5} ${cy} Z`,
      ...LINE,
      fill: MOUTH_INK,
      strokeWidth: 2,
    }),
  },
  talkTeeth: bite(13, -4, 5.5),
  talkA: talk(13, -4.5, 7, 4.5, 0),
  talkB: talk(14, -6, 13, 4.5, 5),
  talkO: oval(5.5, 9, 2, 4.5, 4),
  talkSadA: sad(false),
  talkSadB: sad(true),
  talkAngryA: angry(5),
  talkAngryB: angry(12),
  smile: {
    extent: { top: -3, bottom: 5 },
    marks: (cx, cy) => ({
      path: `M ${cx - 13} ${cy - 3} Q ${cx} ${cy + 11} ${cx + 13} ${cy - 3}`,
      ...LINE,
    }),
  },
  frown: {
    extent: { top: -3, bottom: 5 },
    marks: (cx, cy) => ({
      path: `M ${cx - 13} ${cy + 5} Q ${cx} ${cy - 9} ${cx + 13} ${cy + 5}`,
      ...LINE,
    }),
  },
  pain: {
    extent: { top: -4, bottom: 6 },
    marks: (cx, cy) => ({
      path: `M ${cx - 14} ${cy + 2} C ${cx - 11} ${cy - 4} ${cx - 7} ${cy - 4} ${cx - 4} ${cy + 2} C ${cx - 1} ${cy + 8} ${cx + 3} ${cy + 8} ${cx + 6} ${cy + 2} C ${cx + 9} ${cy - 4} ${cx + 12} ${cy - 4} ${cx + 14} ${cy + 2}`,
      ...LINE,
    }),
  },
  grit: {
    extent: { top: -GRIT.h, bottom: GRIT.h },
    marks: (cx, cy) => {
      const { w, h } = GRIT;
      const r = 3;
      const wb = w - 3;
      const box =
        `M ${cx - w + r} ${cy - h} H ${cx + w - r} Q ${cx + w} ${cy - h} ${cx + w - 1} ${cy - h + r}` +
        ` L ${cx + wb + 1} ${cy + h - r} Q ${cx + wb} ${cy + h} ${cx + wb - r} ${cy + h}` +
        ` H ${cx - wb + r} Q ${cx - wb} ${cy + h} ${cx - wb - 1} ${cy + h - r}` +
        ` L ${cx - w + 1} ${cy - h + r} Q ${cx - w} ${cy - h} ${cx - w + r} ${cy - h} Z`;
      return {
        group: [
          { path: box, ...RIM, fill: TOOTH },
          { line: [cx - w + 2, cy, cx + w - 2, cy], ...SEAM },
        ],
      };
    },
  },
  grin: {
    extent: { top: -4, bottom: 12 },
    marks: (cx, cy) => {
      const w = 15;
      const d = `M ${cx - w} ${cy - 4} Q ${cx} ${cy + 20} ${cx + w} ${cy - 4} Z`;
      return {
        group: [
          { clip: d },
          { path: d, fill: CAVITY },
          { rect: [cx - w, cy - 6, w * 2, 8], fill: TOOTH, clipped: true },
          { path: d, ...RIM },
        ],
      };
    },
  },
  wry: {
    extent: { top: -3, bottom: 5 },
    marks: (cx, cy) => ({
      path: `M ${cx - 15} ${cy - 2} C ${cx - 11} ${cy + 6} ${cx - 5} ${cy + 6} ${cx - 1} ${cy + 1} C ${cx + 3} ${cy - 4} ${cx + 9} ${cy + 5} ${cx + 15} ${cy - 3}`,
      ...LINE,
    }),
  },
  wryOpen: {
    extent: { top: -6, bottom: 16 },
    // Lệch: khoé trái cao hơn khoé phải, đáy sâu về phía phải — đối xứng thì đọc thành cười vui
    marks: (cx, cy) => {
      const d = `M ${cx - 16} ${cy - 6} Q ${cx} ${cy - 3} ${cx + 15} ${cy - 1} Q ${cx + 14} ${cy + 16} ${cx + 2} ${cy + 16} Q ${cx - 13} ${cy + 15} ${cx - 16} ${cy - 6} Z`;
      return {
        group: [
          { clip: d },
          { path: d, fill: CAVITY },
          {
            group: [
              { ellipse: [cx + 3, cy + 14, 10, 6], fill: TONGUE },
              {
                path: `M ${cx - 18} ${cy - 12} H ${cx + 18} V ${cy + 3} Q ${cx} ${cy + 1} ${cx - 18} ${cy - 2} Z`,
                fill: TOOTH,
              },
            ],
            clipped: true,
          },
          { path: d, ...RIM },
        ],
      };
    },
  },
  pursed: {
    extent: { top: -2, bottom: 2 },
    // Má phồng bên phải: ngoặc `)` ôm khoé phải
    marks: (cx, cy) => ({
      group: [
        { path: `M ${cx - 10} ${cy} Q ${cx} ${cy + 1.5} ${cx + 9} ${cy - 0.5}`, ...LINE },
        cheek(cx, cy, 12, 1),
      ],
    }),
  },
  puffed: {
    extent: { top: -2, bottom: 2 },
    // Nín thở: hai má phồng ôm khoé thành `( ‿ )`
    marks: (cx, cy) => ({
      group: [
        { path: `M ${cx - 5} ${cy} Q ${cx} ${cy + 2} ${cx + 5} ${cy}`, ...LINE },
        cheek(cx, cy, -9.5, -1),
        cheek(cx, cy, 9.5, 1),
      ],
    }),
  },
  meh: {
    extent: { top: -3, bottom: 2 },
    // Phẳng, khoé phải nhếch lên một vạch: chán, nghi ngờ
    marks: (cx, cy) => ({
      group: [
        { path: `M ${cx - 11} ${cy + 0.5} Q ${cx - 1} ${cy + 1.5} ${cx + 9} ${cy - 0.5}`, ...LINE },
        {
          path: `M ${cx + 10} ${cy - 3.5} Q ${cx + 12.5} ${cy - 0.5} ${cx + 10.5} ${cy + 2.5}`,
          ...THIN,
        },
      ],
    }),
  },
  smirk: {
    extent: { top: -5, bottom: 3 },
    // Nhếch một khoé (ニヤリ): nét ngắn gần phẳng, khoé phải vểnh lên
    marks: (cx, cy) => ({
      path: `M ${cx - 9} ${cy + 0.5} C ${cx - 3} ${cy + 2.5} ${cx + 5} ${cy + 2} ${cx + 9} ${cy - 3.5}`,
      ...LINE,
    }),
  },
  fang: {
    extent: { top: -6, bottom: 9.5 },
    // Cười hé lệch, khoé phải cao, một răng nanh trắng (八重歯) từ mép trên gần khoé ấy
    marks: (cx, cy) => {
      const d = `M ${cx - 12} ${cy - 1} Q ${cx} ${cy + 0.5} ${cx + 12} ${cy - 5} C ${cx + 11.5} ${cy + 6} ${cx + 5} ${cy + 10} ${cx - 1} ${cy + 8} C ${cx - 7} ${cy + 6} ${cx - 11} ${cy + 2} ${cx - 12} ${cy - 1} Z`;
      return {
        group: [
          { clip: d },
          { path: d, fill: CAVITY },
          {
            path: `M ${cx} ${cy - 6} L ${cx + 11} ${cy - 9} L ${cx + 6} ${cy + 7} Z`,
            fill: TOOTH,
            clipped: true,
          },
          { path: d, ...RIM },
        ],
      };
    },
  },
  o: oval(5, 6, 0, 4, 0),
  wide: oval(13, 15, 0, 6.5, 6),
  shout,
  talkI: bite(14, -3, 4),
  talkU: oval(4, 5, 0, 3, 0),
  talkE: talk(13, -4, 5.5, 4.5, 0),
  talkM: {
    extent: { top: -2, bottom: 2 },
    marks: (cx, cy) => ({ line: [cx - 9, cy, cx + 9, cy], ...LINE, strokeWidth: 3.4 }),
  },
  pout: {
    extent: { top: -3, bottom: 9 },
    // Bĩu: cung trễ ngắn, môi dưới trề thành cung nhỏ bên dưới
    marks: (cx, cy) => ({
      group: [
        { path: `M ${cx - 9} ${cy + 3} Q ${cx} ${cy - 3} ${cx + 9} ${cy + 3}`, ...LINE },
        { path: `M ${cx - 5} ${cy + 6} Q ${cx} ${cy + 8.5} ${cx + 5} ${cy + 6}`, ...THIN },
      ],
    }),
  },
  // kiểu thêm cho mồm anime (9.2); mồm chibi vẽ phỏng theo
  laugh: talk(13, -4.5, 8, -3, 4),
  beam: {
    extent: { top: -5, bottom: 15 },
    marks: (cx, cy) => {
      const w = 18;
      const d = `M ${cx - w} ${cy - 5} Q ${cx} ${cy + 25} ${cx + w} ${cy - 5} Z`;
      return {
        group: [
          { clip: d },
          { path: d, fill: CAVITY },
          { ellipse: [cx, cy + 12, 9, 5], fill: TONGUE, clipped: true },
          { rect: [cx - w, cy - 7, w * 2, 9], fill: TOOTH, clipped: true },
          { path: d, ...RIM },
        ],
      };
    },
  },
  wobble: {
    extent: { top: -4, bottom: 4 },
    marks: (cx, cy) => ({
      path: `M ${cx - 11} ${cy + 3} C ${cx - 8} ${cy - 3} ${cx - 5} ${cy - 3} ${cx - 2} ${cy} C ${cx + 1} ${cy + 2} ${cx + 4} ${cy - 4} ${cx + 11} ${cy + 3}`,
      ...LINE,
    }),
  },
  cry: sad(true),
  wail: oval(12, 13, 2, -3, 6),
  gasp: oval(13, 12, 1, -3, 6),
  scared: sad(false),
  sigh: oval(4.5, 4, 1, -3, 0),
  yawn: oval(10, 15, 3, -3, 7),
  blow: chibiThree(),
  whistle: chibiThree(),
  chew: {
    extent: { top: -2, bottom: 2 },
    marks: (cx, cy) => ({
      group: [
        { path: `M ${cx - 10} ${cy} Q ${cx} ${cy + 1.5} ${cx + 9} ${cy - 0.5}`, ...LINE },
        cheek(cx, cy, 12, 1),
      ],
    }),
  },
  lick: {
    extent: { top: -3, bottom: 10 },
    marks: (cx, cy) => ({
      group: [
        { ellipse: [cx + 5, cy + 5, 4, 4.5], ...RIM, fill: TONGUE },
        { path: `M ${cx - 13} ${cy - 3} Q ${cx} ${cy + 11} ${cx + 13} ${cy - 3}`, ...LINE },
      ],
    }),
  },
} satisfies Record<string, MouthDef>;

/** Nét mồm tâm `(cx, cy)` */
export function mouthMark(kind: MouthKind, cx: number, cy: number): FaceMark {
  return MOUTHS[kind].marks(cx, cy);
}

/** Mép trên / dưới của khẩu hình so với tâm miệng, cho râu bám theo */
export function mouthExtent(kind: MouthKind): { top: number; bottom: number } {
  return MOUTHS[kind].extent;
}

/** Ria mép đã đủ số (`face.beard.moustache` của JSON nhân vật qua zod); `color` bỏ trống là màu tóc */
export interface MoustacheSpec {
  width: number;
  thick: number;
  gap: number;
  droop: number;
  taper: number;
  part: number;
  line: number;
  color?: string;
}

/** Số điểm mỗi mép của dải ria trên một nửa rộng */
const MOUSTACHE_STEPS = 10;

/**
 * Ria mép trên khẩu hình `kind` tâm `(cx, cy)`: dải nửa rộng `width`, dày `thick` ở giữa, thon về hai đầu còn `taper`
 * lần; đường giữa dải cong parabol, hai đầu thấp hơn giữa `droop`; mép dưới ở giữa cách mép trên của khẩu hình `gap` —
 * mồm há thì ria nhích lên theo. `kind` là số thì đó là mép trên của mồm (mồm anime, `humanMouthTop`). `part` hở giữa
 * nhân trung bấy nhiêu px. Tô `color`, viền mực `line`.
 * docs/01-rig.md#ria-mép
 */
export function moustacheMark(
  m: MoustacheSpec,
  kind: MouthKind | number,
  cx: number,
  cy: number,
  color: string,
): FaceMark {
  const top = typeof kind === "number" ? kind : MOUTHS[kind].extent.top;
  const mid = cy + top - m.gap - m.thick / 2;
  /** Dải từ `u0` tới `u1` (phần nửa rộng, âm là bên `−x`): mép trên đi tới, mép dưới đi về */
  const strip = (u0: number, u1: number) => {
    const n = Math.max(2, Math.round(MOUSTACHE_STEPS * Math.abs(u1 - u0)));
    const pts = Array.from({ length: n + 1 }, (_, k) => {
      const u = u0 + ((u1 - u0) * k) / n;
      const t = (m.thick * (1 - (1 - m.taper) * u * u)) / 2;
      const y = mid + m.droop * u * u;
      return [cx + u * m.width, y - t, y + t] as const;
    });
    const top = pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`);
    const bot = pts.map(([x, , y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).reverse();
    return `M ${top.join(" L ")} L ${bot.join(" L ")} Z`;
  };
  const ink =
    m.line > 0 ? { stroke: MOUTH_INK, strokeWidth: m.line, strokeLinejoin: "round" as const } : {};
  const x0 = Math.min(m.part / 2, m.width * 0.8) / m.width;
  const paths = x0 > 0 ? [strip(-1, -x0), strip(x0, 1)] : [strip(-1, 1)];
  return { group: paths.map((path) => ({ path, fill: color, ...ink })) };
}

/** Mép trên của ria mép so với tâm mồm ở khẩu hình há cao nhất: lớp mồm phải phủ tới đó */
export function moustacheTop(m: MoustacheSpec) {
  const top = Math.min(...MOUTH_KINDS.map((k) => MOUTHS[k].extent.top));
  return top - m.gap - m.thick - Math.max(0, -m.droop) - m.line;
}

/**
 * Dáng mồm anime của đầu `human`, px nhìn thấy: nửa rộng nét ngậm `half`; nét ngậm dày `line`; há hết cỡ cao `open`;
 * khoang tròn thêm `round` (`0..1`, cộng vào `round` của khẩu hình); khoé lên xuống hết cỡ `lift` (`corner ±1`), trễ lúc
 * nghỉ `droop`; dải răng cao `teeth`. Màu môi `tint` (`0` không): nét và viền ngả về đỏ môi; nếp ở khoé dài `fold`
 * (`0` không). docs/01-rig.md#mồm-anime
 */
export interface MouthShape {
  half: number;
  line: number;
  open: number;
  round: number;
  lift: number;
  droop: number;
  teeth: number;
  tint: number;
  fold: number;
}

/** Bảng dáng mồm anime: thứ tự khoá là thứ tự của `MOUTH_SHAPE_KINDS` */
export const MOUTH_SHAPES = {
  male: {
    half: 14,
    line: 2.3,
    open: 32,
    round: 0,
    lift: 4.2,
    droop: 0,
    teeth: 5.5,
    tint: 0,
    fold: 0,
  },
  female: {
    half: 12.5,
    line: 2.1,
    open: 29,
    round: 0.1,
    lift: 4,
    droop: 0,
    teeth: 5,
    tint: 0.55,
    fold: 0,
  },
  child: {
    half: 11,
    line: 2.1,
    open: 28,
    round: 0.3,
    lift: 3.6,
    droop: 0,
    teeth: 4.5,
    tint: 0.2,
    fold: 0,
  },
  elder: {
    half: 14,
    line: 2.1,
    open: 27,
    round: 0,
    lift: 3.4,
    droop: 2,
    teeth: 4.8,
    tint: 0,
    fold: 4.5,
  },
} satisfies Record<string, MouthShape>;

export type MouthShapeKind = keyof typeof MOUTH_SHAPES;
export const MOUTH_SHAPE_KINDS = Object.keys(MOUTH_SHAPES) as [MouthShapeKind, ...MouthShapeKind[]];
/** Tên trường của `MouthShape`, cho `face.mouth` của JSON nhân vật */
export const MOUTH_SHAPE_FIELDS = Object.keys(MOUTH_SHAPES.male) as (keyof MouthShape)[];

/** Dáng mồm `kind` với các số của `over` đè lên */
export function mouthShape(kind: MouthShapeKind, over: Partial<MouthShape> = {}): MouthShape {
  const own = Object.entries(over).filter(([, v]) => Number.isFinite(v));
  return { ...MOUTH_SHAPES[kind], ...Object.fromEntries(own) };
}

/**
 * Khẩu hình anime là một bộ số chung mọi dáng mồm: độ há `open` (`0..1` của `open` của dáng), bề ngang `wide` lần `half`,
 * khoé `corner` (`1` lên hết `lift`, âm là xuống), phần độ há nằm trên đường khoé `up` (`0` chữ D đáy tròn, `1` chữ D
 * úp — mếu), khoang tròn `round` (`0` thấu kính nhọn khoé, `1` bầu dục hay hộp bo), đáy nở `flare` (hình thang của quát,
 * hét), cả khối hạ xuống `drop` phần độ há (chữ D úp to: mép trên vòm mà không chạm mũi), eo giữa `pinch` (hai đầu bè
 * hơn giữa — nghiến), răng trên / dưới `upper` / `lower` (`0..1` của `teeth`, mép răng phẳng, chỉ vẽ khi chỗ hở từ
 * `TEETH_MIN`), lưỡi `tongue` `0..1`, gợn sóng `wave` (mếu, run, nhăn), nhếch khoé `+x` `skew`, mím `press` `0..1`, răng
 * nanh `fang` `0..1`
 */
export interface MouthPose {
  open: number;
  wide: number;
  corner: number;
  up: number;
  round: number;
  flare: number;
  drop: number;
  pinch: number;
  upper: number;
  lower: number;
  tongue: number;
  wave: number;
  skew: number;
  press: number;
  fang: number;
}

const MOUTH_REST: MouthPose = {
  open: 0,
  wide: 1,
  corner: 0,
  up: 0.3,
  round: 0.5,
  flare: 0,
  drop: 0,
  pinch: 0,
  upper: 0,
  lower: 0,
  tongue: 0,
  wave: 0,
  skew: 0,
  press: 0,
  fang: 0,
};

/**
 * Khẩu hình vẽ bằng mồm anime trên đầu khai `face.mouthShape`. Kiểu không có ở đây là nét vẽ riêng (`MOUTH_GLYPHS`).
 * Nhóm theo bảng tham chiếu: cơ bản, nói theo nguyên âm, cười, buồn, giận, ngạc nhiên.
 */
export const MOUTH_POSES = {
  // cơ bản — răng chỉ có ở cười lớn, rạng rỡ, nghiến, quát, hét như bảng tham chiếu
  closed: {},
  parted: { open: 0.25, wide: 0.6, up: 0.45, round: 1 },
  talkM: { wide: 1, press: 0.7 },
  // nói
  talkA: { open: 0.44, wide: 0.96, up: 0.45, round: 0.85, tongue: 0.7 },
  talkB: { open: 0.85, wide: 1.25, up: 0.4, round: 0.85, tongue: 0.8 },
  talkI: { open: 0.22, wide: 1, corner: 0.1, up: 0.4, round: 0.7, tongue: 0.3 },
  talkU: { open: 0.25, wide: 0.2, up: 0.45, round: 1, tongue: 0.3 },
  talkE: { open: 0.34, wide: 0.93, up: 0.4, round: 0.7, tongue: 0.5 },
  talkO: { open: 0.6, wide: 0.57, up: 0.45, round: 1, tongue: 0.6 },
  talkTeeth: { open: 0.28, wide: 0.86, corner: 0.2, up: 0, round: 0.75, tongue: 0.5 },
  talkSadA: { open: 0.3, wide: 1, corner: -0.1, up: 0.9, drop: 0.3, round: 0.8, tongue: 0.6 },
  talkSadB: { open: 0.45, wide: 1.14, corner: -0.1, up: 0.9, drop: 0.3, round: 0.8, tongue: 0.7 },
  talkAngryA: {
    open: 0.56,
    wide: 1.07,
    corner: -0.1,
    up: 0.8,
    drop: 0.35,
    round: 0.7,
    flare: 0.15,
    upper: 0.9,
    tongue: 0.7,
  },
  talkAngryB: {
    open: 0.8,
    wide: 1.3,
    corner: -0.1,
    up: 0.75,
    drop: 0.4,
    round: 0.7,
    flare: 0.2,
    upper: 0.9,
    lower: 0.3,
    tongue: 0.8,
  },
  // cười
  smile: { wide: 1.35, corner: 1 },
  smirk: { wide: 1.3, corner: 0.05, skew: 1 },
  laugh: { open: 0.5, wide: 1.15, corner: 0.1, up: 0, round: 0.8, tongue: 0.9 },
  grin: { open: 0.7, wide: 1.45, corner: 0.1, up: 0, round: 0.75, upper: 0.9, tongue: 0.8 },
  beam: { open: 0.82, wide: 1.75, corner: 0.15, up: 0, round: 0.75, upper: 1, tongue: 0.8 },
  wryOpen: { open: 0.45, wide: 1.2, corner: 0.2, up: 0.1, round: 0.7, tongue: 0.6, skew: 0.6 },
  fang: {
    open: 0.4,
    wide: 1.1,
    corner: 0.4,
    up: 0.05,
    round: 0.7,
    tongue: 0.6,
    skew: 0.4,
    fang: 1,
  },
  // buồn
  frown: { wide: 0.93, corner: -1 },
  wobble: { wide: 1.05, corner: -0.3, wave: 1 },
  cry: { open: 0.6, wide: 1.32, corner: -0.1, up: 0.9, drop: 0.4, round: 0.8, tongue: 0.7 },
  wail: { open: 0.85, wide: 1.7, up: 0.5, drop: 0.2, round: 1, pinch: 0.5, tongue: 0.8 },
  // giận
  meh: { wide: 1.1, corner: -0.1, skew: 0.35 },
  pursed: { wide: 0.85, skew: 0.25, press: 1 },
  grit: { open: 0.6, wide: 1.46, round: 1, pinch: 0.15, upper: 1, lower: 1 },
  shout: {
    open: 0.88,
    wide: 1.82,
    corner: -0.1,
    up: 0.85,
    drop: 0.45,
    round: 0.7,
    flare: 0.2,
    upper: 0.9,
    lower: 0.5,
    tongue: 0.8,
  },
  pain: { wide: 1.15, wave: 1 },
  wry: { wide: 1.1, skew: 0.4, wave: 0.8 },
  // ngạc nhiên, sợ
  o: { open: 0.56, wide: 0.64, up: 0.45, round: 1, tongue: 0.5 },
  wide: { open: 0.8, wide: 1.14, up: 0.45, round: 0.85, tongue: 0.8 },
  gasp: {
    open: 0.88,
    wide: 1.64,
    corner: -0.1,
    up: 0.8,
    drop: 0.4,
    round: 0.6,
    flare: 0.3,
    tongue: 0.8,
  },
  scared: {
    open: 0.44,
    wide: 1.82,
    corner: -0.1,
    up: 0.6,
    drop: 0.3,
    round: 0.8,
    tongue: 0.6,
    wave: 0.9,
  },
  // khác
  sigh: { open: 0.38, wide: 0.54, up: 0.45, round: 1, tongue: 0.4 },
  yawn: { open: 1, wide: 1, up: 0.4, drop: 0.15, round: 1, tongue: 0.8 },
} satisfies Partial<Record<MouthKind, Partial<MouthPose>>>;

/** Khẩu hình `kind` có bộ số mồm anime không (`MOUTH_POSES`); không thì là nét riêng (`MOUTH_GLYPHS`) */
export const humanMouthKind = (kind: MouthKind): kind is keyof typeof MOUTH_POSES =>
  kind in MOUTH_POSES;

/**
 * Chuyển giữa hai khẩu hình: mồm anime đi từ khẩu hình cũ sang mới trong `secs` giây kể từ mốc đổi, phần đã đi làm tròn
 * `1 / steps` — canvas mồm chỉ vẽ lại khi nấc đổi
 */
export const MOUTH_MIX = { secs: 0.07, steps: 4 } as const;

/** Phần đã đi `f` của một lần chuyển làm tròn về nấc `MOUTH_MIX` */
export const mouthStep = (f: number) => Math.round(clamp01(f) * MOUTH_MIX.steps) / MOUTH_MIX.steps;

/**
 * Bộ số khẩu hình đem vẽ: `mouth`, hay giữa `tween.from` và `tween.to` ở nấc `mouthStep(tween.f)`. Một bên là nét riêng
 * thì không có bộ số (`undefined`), mồm vẽ kiểu `mouth`.
 */
export function mouthPose(
  mouth: MouthKind,
  tween?: { from: MouthKind; to: MouthKind; f: number },
): MouthPose | undefined {
  const of = (k: MouthKind) =>
    humanMouthKind(k) ? { ...MOUTH_REST, ...MOUTH_POSES[k] } : undefined;
  if (!tween || tween.from === tween.to) return of(mouth);
  const [a, b] = [of(tween.from), of(tween.to)];
  if (!a || !b) return of(mouth);
  const f = mouthStep(tween.f);
  const keys = Object.keys(MOUTH_REST) as (keyof MouthPose)[];
  return Object.fromEntries(keys.map((k) => [k, lerp(a[k], b[k], f)])) as unknown as MouthPose;
}

/** Mép dưới khoang mồm anime cách tâm mồm tối đa bấy nhiêu px: mồm há hết cỡ không tràn xuống cằm */
export const MOUTH_LIMIT = 30;
/** Chỗ hở giữa hai mép (px) dưới mức này thì không vẽ răng: mồm há nhỏ không lộ răng, kể cả lúc chuyển khẩu hình */
const TEETH_MIN = 8;
/** Số đoạn mỗi nửa mép mồm */
const LIP_STEPS = 16;
/** Màu mồm anime: nét ngậm, viền khoang, khoang, lưỡi, răng (mép răng là viền mảnh) */
const ANIME = {
  ink: "#4a2a24",
  rim: "#7a3029",
  cavity: "#b9534b",
  tongue: "#ee9488",
  tooth: "#fbf7f1",
  /** Viền khoang dày bằng phần này của `line` */
  rimF: 0.5,
  /** Gợn sóng: số nửa chu kỳ trên cả bề ngang, biên độ px ở `wave 1` */
  waves: 3,
  waveAmp: 2,
  /** Khoé nhấc sẵn bấy nhiêu px: mặt cong làm nét ngang dán lên võng xuống hai đầu, bù cho nét ngậm thẳng */
  bow: 2,
} as const;
/** Đỏ môi mà nét ngả về theo `tint` */
const LIP = { red: [176, 64, 66], mix: 0.75 } as const;

const poly = (ps: P[]) => ps.map((p, i) => `${i ? "L" : "M"} ${pt(p)}`).join(" ");
/** Dải giữa hai đường cùng số điểm `a`, `b` (cùng chiều) */
const band = (a: P[], b: P[]) => `${poly(a)} L ${poly([...b].reverse()).slice(2)} Z`;
const mixHex = (a: string, b: readonly number[], f: number) =>
  `rgb(${hexRgb(a)
    .map((v, i) => Math.round(lerp(v, b[i], f)))
    .join(", ")})`;

/** Hai mép mồm anime (`humanMouthMarks`): mép trên `top`, mép dưới `bot` lấy mẫu theo `us`, đường khoé `mid` */
function mouthGeometry(S: MouthShape, P: MouthPose, cx: number, cy: number) {
  const w = S.half * P.wide * (1 - 0.15 * clamp01(P.press));
  const h = clamp01(P.open) * S.open;
  const a = clamp01(P.up);
  const lift = S.lift * P.corner - S.droop * (1 - clamp01(P.corner));
  const sk = P.skew;
  const pw = lerp(1, 0.32, clamp01(P.round + S.round));
  const us = Array.from({ length: 2 * LIP_STEPS + 1 }, (_, i) => -1 + i / LIP_STEPS);
  const wave = (u: number) =>
    P.wave * ANIME.waveAmp * Math.sin(((u + 1) / 2) * ANIME.waves * Math.PI) * (1 - u * u) ** 0.3;
  // nhếch nhấc riêng nửa `+x`, nửa kia trễ nhẹ
  const drop = clamp01(P.drop) * h;
  const midY = (u: number) =>
    cy + drop - (lift + ANIME.bow) * u * u - sk * S.lift * (u > 0 ? 1.2 : -0.2) * u * u + wave(u);
  const g = (u: number) => (1 - u * u) ** pw * (1 - clamp01(P.pinch) * (1 - u * u));
  const X = (u: number, f = 0) => cx + u * w * (1 + 0.08 * sk * Math.sign(u)) * (1 + f);
  const mid = us.map((u) => [X(u), midY(u)] as P);
  const top = us.map((u) => [X(u), midY(u) - a * h * g(u)] as P);
  // đáy nở `flare`: mép dưới phình ra ngoài ở giữa hai nửa, thành hình thang bo
  const bot = us.map(
    (u) =>
      [
        X(u, P.flare * Math.sin(Math.PI * Math.abs(u)) * 0.5),
        Math.min(midY(u) + (1 - a) * h * g(u), cy + MOUTH_LIMIT),
      ] as P,
  );
  return { w, h, us, mid, top, bot };
}

/** Nét của mồm anime: màu nét theo `tint` của dáng */
const inkOf = (S: MouthShape) =>
  S.tint > 0 ? mixHex(ANIME.ink, LIP.red, S.tint * LIP.mix) : ANIME.ink;

/**
 * Mồm anime tâm `(cx, cy)` dáng `S` ở khẩu hình `P`: ngậm là một nét thon nhẹ hai đầu; há là khoang đỏ nâu viền mảnh, lưỡi
 * hồng ở đáy, răng là dải trắng mép phẳng — chỉ có ở khẩu hình khai `upper` / `lower`; hai hàm cùng kín khoang (`grit`)
 * thì là khối răng có vạch giữa. docs/01-rig.md#mồm-anime
 */
export function humanMouthMarks(S: MouthShape, P: MouthPose, cx: number, cy: number): FaceMark {
  const { w, h, us, mid, top, bot } = mouthGeometry(S, P, cx, cy);
  const ink = inkOf(S);
  const out: FaceMark[] = [];
  if (h < 0.9) {
    const line = S.line * (1 + 0.6 * clamp01(P.press));
    const t = (u: number) => (line / 2) * (1 - u * u) ** 0.22;
    out.push({
      path: band(
        mid.map(([x, y], i) => [x, y - t(us[i])] as P),
        mid.map(([x, y], i) => [x, y + t(us[i])] as P),
      ),
      fill: ink,
    });
  } else {
    const d = band(top, bot);
    const yTop = Math.min(...top.map((p) => p[1]));
    const yBot = Math.max(...bot.map((p) => p[1]));
    const topMid = top[LIP_STEPS][1];
    const botMid = bot[LIP_STEPS][1];
    const span = botMid - topMid;
    const teeth = span >= TEETH_MIN ? 1 : 0;
    const tu = clamp01(P.upper) * S.teeth * teeth;
    const tl = clamp01(P.lower) * S.teeth * 0.75 * teeth;
    const inner: FaceMark[] = [];
    if (P.tongue > 0)
      inner.push({
        ellipse: [cx, botMid + 0.1 * span, 0.7 * w, 0.5 * span * clamp01(P.tongue)],
        fill: ANIME.tongue,
      });
    const rim = { fill: "none", stroke: ANIME.rim, strokeWidth: ANIME.rimF * S.line } as const;
    if (teeth && P.upper >= 1 && P.lower >= 1) {
      // nghiến: hai hàm kín khoang, vạch giữa chia hàm
      const yS = topMid + (span * tu) / (tu + tl);
      inner.push(
        { rect: [cx - 2 * w, yTop - 2, 4 * w, yBot - yTop + 4], fill: ANIME.tooth },
        { path: `M ${pt([cx - 2 * w, yS])} L ${pt([cx + 2 * w, yS])}`, ...rim },
      );
    } else {
      // răng là dải lưỡi liềm bám mép trên / dưới, dày nhất ở giữa, mỏng dần ra khoé (như bảng tham chiếu)
      const crescent = (edge: P[], t: number, s: 1 | -1) =>
        band(
          edge.map(([x, y]) => [x, y - 2 * s] as P),
          edge.map(([x, y], i) => [x, y + s * t * (1 - us[i] * us[i]) ** 0.6] as P),
        );
      if (tu > 0.5)
        inner.push({ path: crescent(top, Math.min(tu, 0.6 * span), 1), fill: ANIME.tooth });
      if (tl > 0.5)
        inner.push({ path: crescent(bot, Math.min(tl, 0.35 * span), -1), fill: ANIME.tooth });
    }
    if (P.fang > 0) {
      // răng nanh (八重歯) từ mép trên gần khoé `+x`
      const i = Math.round(LIP_STEPS * 1.55);
      const [x, y] = top[i];
      const fh = 0.45 * span * clamp01(P.fang);
      inner.push({
        path: `M ${pt([x - 2.2, y - 1])} L ${pt([x + 1.6, y - 1])} L ${pt([x - 0.5, y + fh])} Z`,
        fill: ANIME.tooth,
      });
    }
    out.push(
      { clip: d },
      { path: d, fill: ANIME.cavity },
      { group: inner, clipped: true },
      { path: d, ...rim, stroke: S.tint > 0 ? ink : ANIME.rim, strokeLinejoin: "round" },
    );
  }
  if (S.fold > 0) {
    // người già: nếp ngắn từ khoé xuôi xuống
    const ticks: FaceMark[] = [];
    for (const [s, [x, y]] of [
      [-1, mid[0]],
      [1, mid[2 * LIP_STEPS]],
    ] as const)
      ticks.push({
        path: `M ${pt([x + s * 1.2, y + 1])} Q ${pt([x + s * 1.9, y + 0.5 * S.fold + 1])} ${pt([x + s * 1.4, y + S.fold + 1])}`,
      });
    out.push({
      group: ticks,
      fill: "none",
      stroke: "rgba(74, 42, 36, 0.35)",
      strokeWidth: 0.9,
      strokeLinecap: "round",
    });
  }
  return { group: out };
}

/** Mép trên của mồm anime (px so với tâm, âm là trên) ở khẩu hình `P` dáng `S`: chỗ ria mép bám */
export function humanMouthTop(S: MouthShape, P: MouthPose): number {
  const { h, top, mid } = mouthGeometry(S, P, 0, 0);
  const ink = h < 0.9 ? (S.line * (1 + 0.6 * clamp01(P.press))) / 2 : (ANIME.rimF * S.line) / 2;
  return Math.min(...(h < 0.9 ? mid : top).map(([, y]) => y)) - ink;
}

/**
 * Nét riêng của mồm anime cho khẩu hình không có bộ số: chu môi thổi / huýt (chữ `3`), nhai (nét ngắn, má phồng một
 * bên), liếm (cười, lưỡi thè ở khoé), bĩu, phồng má. Cùng màu, cùng bề dày nét với mồm anime của dáng `S`.
 */
export const MOUTH_GLYPHS: Partial<
  Record<MouthKind, (S: MouthShape, cx: number, cy: number) => FaceMark>
> = {
  blow: (S, cx, cy) => three(S, cx, cy),
  whistle: (S, cx, cy) => three(S, cx, cy),
  chew: (S, cx, cy) => ({
    group: [
      {
        path: `M ${cx - 0.55 * S.half} ${cy + 0.5} Q ${cx} ${cy + 1.6} ${cx + 0.5 * S.half} ${cy - 0.4}`,
        ...glyphInk(S),
      },
      {
        path: `M ${cx + 0.7 * S.half} ${cy - 4} Q ${cx + 0.7 * S.half + 3.6} ${cy} ${cx + 0.7 * S.half} ${cy + 4}`,
        ...glyphInk(S, 0.75),
      },
    ],
  }),
  lick: (S, cx, cy) => {
    const w = 0.9 * S.half;
    const tx = cx + 0.45 * w;
    return {
      group: [
        {
          path: `M ${tx - 2.6} ${cy + 1.6} Q ${tx - 2.2} ${cy + 7} ${tx + 1} ${cy + 6.5} Q ${tx + 3.6} ${cy + 6} ${tx + 3} ${cy + 1}`,
          fill: ANIME.tongue,
          stroke: ANIME.rim,
          strokeWidth: ANIME.rimF * S.line,
          strokeLinejoin: "round",
        },
        {
          path: `M ${cx - w} ${cy - S.lift} Q ${cx} ${cy + S.lift + 1} ${cx + w} ${cy - S.lift}`,
          ...glyphInk(S),
        },
      ],
    };
  },
  pout: (S, cx, cy) => ({
    group: [
      {
        path: `M ${cx - 0.6 * S.half} ${cy + 2} Q ${cx} ${cy - 2} ${cx + 0.6 * S.half} ${cy + 2}`,
        ...glyphInk(S),
      },
      {
        path: `M ${cx - 0.35 * S.half} ${cy + 4.5} Q ${cx} ${cy + 6.5} ${cx + 0.35 * S.half} ${cy + 4.5}`,
        ...glyphInk(S, 0.7),
      },
    ],
  }),
  puffed: (S, cx, cy) => ({
    group: [
      {
        path: `M ${cx - 0.4 * S.half} ${cy} Q ${cx} ${cy + 1.2} ${cx + 0.4 * S.half} ${cy}`,
        ...glyphInk(S),
      },
      {
        path: `M ${cx - 0.85 * S.half} ${cy - 4} Q ${cx - 0.85 * S.half - 3.4} ${cy} ${cx - 0.85 * S.half} ${cy + 4}`,
        ...glyphInk(S, 0.75),
      },
      {
        path: `M ${cx + 0.85 * S.half} ${cy - 4} Q ${cx + 0.85 * S.half + 3.4} ${cy} ${cx + 0.85 * S.half} ${cy + 4}`,
        ...glyphInk(S, 0.75),
      },
    ],
  }),
};

function glyphInk(S: MouthShape, k = 1) {
  return {
    fill: "none",
    stroke: inkOf(S),
    strokeWidth: S.line * k,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
}

/** Chữ `3` của môi chu khi thổi, huýt sáo */
function three(S: MouthShape, cx: number, cy: number): FaceMark {
  const r = 0.25 * S.half;
  return {
    path: `M ${cx - 1.6} ${cy - 2 * r} Q ${cx + 2.6} ${cy - 2 * r} ${cx + 1.8} ${cy - r * 0.6} Q ${cx + 1.2} ${cy} ${cx - 0.6} ${cy} Q ${cx + 1.2} ${cy} ${cx + 1.8} ${cy + r * 0.6} Q ${cx + 2.6} ${cy + 2 * r} ${cx - 1.6} ${cy + 2 * r}`,
    ...glyphInk(S),
  };
}

/** Nét riêng của khẩu hình `kind` ở mồm anime dáng `S`, không có thì `undefined` (mồm vẽ kiểu chibi) */
export function humanMouthGlyph(
  kind: MouthKind,
  S: MouthShape,
  cx: number,
  cy: number,
): FaceMark | undefined {
  return MOUTH_GLYPHS[kind]?.(S, cx, cy);
}

const EYE_LINE = { fill: "none", stroke: EYE_INK, strokeWidth: 4, strokeLinecap: "round" } as const;

/** Bầu dục tâm `(x, cy)` cắt ngang ở phần `f` chiều cao tính từ đỉnh, giữ phần dưới: mi trên sụp */
function lidCut(x: number, cy: number, rx: number, ry: number, f: number): string {
  if (f <= 0)
    return `M ${x} ${cy - ry} A ${rx} ${ry} 0 1 0 ${x} ${cy + ry} A ${rx} ${ry} 0 1 0 ${x} ${cy - ry} Z`;
  const h = rx * Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2));
  const y = cy + ry * (2 * f - 1);
  return `M ${x - h} ${y} A ${rx} ${ry} 0 ${f < 0.5 ? 1 : 0} 0 ${x + h} ${y} Z`;
}

/** Con ngươi bầu dục; `lid` khác `0` thì mi trên cắt đi phần ấy của chiều cao */
const pupil = (x: number, cy: number, rx: number, ry: number, lid: number): FaceMark =>
  lid > 0
    ? { path: lidCut(x, cy, rx, ry, lid), fill: EYE_INK }
    : { ellipse: [x, cy, rx, ry], fill: EYE_INK };

/**
 * Một mắt tâm `(x, cy)`, bên `s` (`-1` trái hình), hình tròn bóp ngang còn `k`, con ngươi `wide` / `bulge` bán kính
 * `p · R`, mi trên nghỉ sụp `lid` phần chiều cao, hướng nhìn `look` (`lookStep`)
 */
type EyeDef = (
  x: number,
  cy: number,
  s: 1 | -1,
  k: number,
  p: number,
  lid: number,
  look: Look,
) => FaceMark;
const R = EYE_R;
const WIDE_PUPIL = 0.7;
/** Mắt trợn mở to hơn mắt nghỉ: mi sụp `lid` chỉ cắt bấy nhiêu phần ấy */
const WIDE_LID = 0.5;
/** `wide`: bầu dục đặc to hơn mắt mở bấy nhiêu lần, lòng trắng giữa chiếm `white` bán kính, con ngươi `dot · p · R` */
const WIDE = { r: 1.35, white: 0.55, dot: 0.45 };
/** Bán kính lòng trắng `bulge` theo `R` */
const BULGE = 1.5;

/** Hướng nhìn đã làm tròn (`lookStep`): `[ngang, dọc]`, ngang dương về bên trái người (`+x`), dọc dương xuống */
export type Look = readonly [number, number];
const CENTER: Look = [0, 0];

/**
 * Hướng nhìn của mắt: tròng mắt người đi tối đa `x` lần nửa rộng mắt sang ngang, `y` `EYE_R` xuống và `y` lần chỗ hở dưới
 * mi trên lên (`irisAt`); nhìn xuống mi trên sụp thêm `down` phần độ nhắm, nhìn lên mi trên mở thêm `up` lần. `lookStep`
 * làm tròn về `1 / steps`.
 * docs/01-rig.md#hướng-nhìn
 */
export const LOOK = { x: 0.42, y: 0.45, down: 0.3, up: 0.15, steps: 10 } as const;

/** Quãng đi của mắt đầu `sphere` theo `R`: chấm đen cả mắt (`open`, `squint`, `wink`), con ngươi `wide`, `bulge` */
const DOT_LOOK = { dot: 0.22, wide: 0.38, bulge: 0.6 };

/**
 * Hướng nhìn `look` của nét mặt đem vẽ: kéo về trong vòng tròn đơn vị (nhìn chéo không lùa tròng vào khoé), làm tròn
 * `1 / LOOK.steps`; bỏ trống là `[0, 0]`
 */
export function lookStep(look?: readonly number[]): Look {
  const [x, y] = [look?.[0], look?.[1]].map((v) => (Number.isFinite(v) ? (v as number) : 0));
  const m = Math.max(1, Math.hypot(x, y));
  const q = (v: number) => Math.round((v / m) * LOOK.steps) / LOOK.steps || 0;
  return [q(x), q(y)];
}

/** Dời của mắt đầu `sphere` nhìn `l`, quãng `travel · R`, ngang bóp `k` */
const dotLook = (l: Look, k: number, travel: number): P => [
  l[0] * travel * R * k,
  l[1] * travel * R,
];

/** Mắt chấm của đầu `sphere`, dời theo hướng nhìn `l` */
function dotEye(x: number, cy: number, k: number, lid: number, l: Look): FaceMark {
  const [dx, dy] = dotLook(l, k, DOT_LOOK.dot);
  return pupil(x + dx, cy + dy, R * k, R, lid);
}

/** Kiểu mắt: thứ tự khoá là thứ tự của `EYE_KINDS`; `wide` và `bulge` có lòng trắng */
export const EYES = {
  open: (x, cy, _s, k, _p, lid, l) => dotEye(x, cy, k, lid, l),
  shut: (x, cy) => ({ line: [x - 7, cy, x + 7, cy], ...EYE_LINE }),
  // Mắt mở to hơn, lòng trắng giữa vành đen, con ngươi co còn chấm
  wide: (x, cy, _s, k, p, lid, l) => {
    const [rx, ry] = [R * WIDE.r * k, R * WIDE.r];
    const d = lidCut(x, cy, rx, ry, lid * WIDE_LID);
    const w = WIDE.white;
    const [dx, dy] = dotLook(l, k, DOT_LOOK.wide);
    return {
      group: [
        { clip: d },
        { path: d, fill: EYE_INK },
        { ellipse: [x, cy, rx * w, ry * w], fill: WHITE, clipped: true },
        {
          ellipse: [x + dx, cy + dy, WIDE.dot * p * R * k, WIDE.dot * p * R],
          fill: EYE_INK,
          clipped: true,
        },
      ],
    };
  },
  // Mắt trố: lòng trắng to viền mảnh, con ngươi giữa
  bulge: (x, cy, _s, k, p, lid, l) => {
    const [dx, dy] = dotLook(l, k, DOT_LOOK.bulge);
    const iris = { ellipse: [x + dx, cy + dy, R * p * k, R * p] as Quad, fill: EYE_INK };
    if (!(lid > 0))
      return {
        group: [
          {
            ellipse: [x, cy, R * BULGE * k, R * BULGE],
            fill: WHITE,
            stroke: EYE_INK,
            strokeWidth: 2.5,
          },
          iris,
        ],
      };
    const d = lidCut(x, cy, R * BULGE * k, R * BULGE, lid * WIDE_LID);
    return {
      group: [
        { clip: d },
        { path: d, fill: WHITE },
        { ...iris, clipped: true },
        { path: d, fill: "none", stroke: EYE_INK, strokeWidth: 2.5, strokeLinejoin: "round" },
      ],
    };
  },
  // Mi trên sụp xuống: chỉ còn nửa dưới con ngươi, `lid` nghỉ sâu hơn thì theo nó
  squint: (x, cy, _s, k, _p, lid, l) => {
    const [dx, dy] = dotLook(l, k, DOT_LOOK.dot);
    return { path: lidCut(x + dx, cy + dy, R * k, R, Math.max(0.5, lid)), fill: EYE_INK };
  },
  happy: (x, cy) => ({
    path: `M ${x - 8} ${cy + 4} Q ${x} ${cy - 7} ${x + 8} ${cy + 4}`,
    ...EYE_LINE,
  }),
  squeezed: (x, cy, s) => ({
    path: `M ${x + s * 6} ${cy - 5} L ${x - s * 5} ${cy} L ${x + s * 6} ${cy + 5}`,
    ...EYE_LINE,
    strokeLinejoin: "round",
  }),
  droopy: (x, cy, s) => ({
    path: `M ${x - s * 7} ${cy - 3} Q ${x} ${cy} ${x + s * 7} ${cy + 3} Q ${x} ${cy + 10} ${x - s * 7} ${cy - 3} Z`,
    fill: EYE_INK,
  }),
  wink: (x, cy, s, k, _p, lid, l) =>
    s === -1
      ? { path: `M ${x - 7} ${cy + 2} Q ${x} ${cy - 3} ${x + 7} ${cy + 2}`, ...EYE_LINE }
      : dotEye(x, cy, k, lid, l),
  // Cười nham hiểm (ニタァ): trăng lưỡi liềm, mi dưới cong lên khoét lõm vào bầu dục, không đốm sáng
  sly: (x, cy, _s, k) => {
    const [rx, ry, y] = [R * k * 1.15, R * 1.05, cy + 0.55 * R];
    const h = rx * Math.sqrt(1 - ((y - cy) / ry) ** 2);
    return {
      path: `M ${x - h} ${y} A ${rx} ${ry} 0 1 1 ${x + h} ${y} Q ${x} ${cy - 0.35 * R} ${x - h} ${y} Z`,
      fill: EYE_INK,
    };
  },
} satisfies Record<string, EyeDef>;

/** Đầu `side` chỉ vẽ nét bên `only`; `squash` bóp ngang hình nét khi đầu quay */
export interface FaceSides {
  only?: 1 | -1;
  squash?: number;
}

/**
 * Dáng mắt người của đầu `human`, đơn vị `EYE_R` trừ bề dày nét (px): nửa rộng `half`; điểm điều khiển mi trên cao
 * `up`, mi dưới sâu `down` so với tâm (mép mi đi tới chừng ba phần tư); khoé ngoài nhấc `tilt` (âm là cụp); mi trên sụp
 * nghỉ `hood` (phần độ nhắm). Nét mi trên `lash`, nửa ngoài `outer`, đuôi `flick` px (`0` không đuôi), mi dưới nửa
 * ngoài `lower` (`0` không có); nếp mí `crease` `0..1` (`0` một mí). Tròng bán kính `iris`, con ngươi `pupil` phần
 * tròng, đốm sáng `shine` lần; nét mày dày `brow` lần. docs/01-rig.md#mắt-người
 */
export interface EyeShape {
  half: number;
  up: number;
  down: number;
  tilt: number;
  hood: number;
  lash: number;
  outer: number;
  flick: number;
  lower: number;
  crease: number;
  iris: number;
  pupil: number;
  shine: number;
  brow: number;
}

/** Bảng dáng mắt người: thứ tự khoá là thứ tự của `EYE_SHAPE_KINDS` */
export const EYE_SHAPES = {
  male: {
    half: 1.75,
    up: 0.96,
    down: 0.82,
    tilt: -0.05,
    hood: 0,
    lash: 2,
    outer: 2.4,
    flick: 0,
    lower: 0,
    crease: 0.5,
    iris: 0.82,
    pupil: 0.48,
    shine: 0.55,
    brow: 1.45,
  },
  female: {
    half: 1.65,
    up: 1.33,
    down: 1.06,
    tilt: 0.18,
    hood: 0,
    lash: 1.8,
    outer: 2.6,
    flick: 2.4,
    lower: 0.7,
    crease: 0.6,
    iris: 0.95,
    pupil: 0.5,
    shine: 1,
    brow: 0.8,
  },
  child: {
    half: 1.4,
    up: 1.53,
    down: 1.26,
    tilt: 0,
    hood: 0,
    lash: 1.8,
    outer: 2.2,
    flick: 0,
    lower: 0,
    crease: 0,
    iris: 1.05,
    pupil: 0.52,
    shine: 1.25,
    brow: 0.85,
  },
  elder: {
    half: 1.6,
    up: 0.82,
    down: 0.8,
    tilt: -0.28,
    hood: 0.15,
    lash: 1.8,
    outer: 2,
    flick: 0,
    lower: 0.8,
    crease: 0.9,
    iris: 0.78,
    pupil: 0.5,
    shine: 0.3,
    brow: 1.2,
  },
} satisfies Record<string, EyeShape>;

export type EyeShapeKind = keyof typeof EYE_SHAPES;
export const EYE_SHAPE_KINDS = Object.keys(EYE_SHAPES) as [EyeShapeKind, ...EyeShapeKind[]];
/** Tên trường của `EyeShape`, cho `face.eye` của JSON nhân vật */
export const EYE_SHAPE_FIELDS = Object.keys(EYE_SHAPES.male) as (keyof EyeShape)[];

/** Dáng mắt `kind` (mặc định `male`) với các số của `over` đè lên */
export function eyeShape(kind: EyeShapeKind = "male", over: Partial<EyeShape> = {}): EyeShape {
  const own = Object.entries(over).filter(([, v]) => Number.isFinite(v));
  return { ...EYE_SHAPES[kind], ...Object.fromEntries(own) };
}

/**
 * Trạng thái mi chung mọi dáng mắt người: độ nhắm `close` (`0` mở, `1` nhắm), mi trên mở `open` lần, mi dưới nhấc
 * `raise` (`1` tới cao `0,55 up` trên tâm) hay hạ `drop` phần, mi trên xiên `slant` (dương hạ đầu trong, âm hạ đầu ngoài), tròng `iris`, con
 * ngươi `pupil`, đốm sáng `shine` lần
 */
export interface EyeLids {
  close: number;
  open: number;
  raise: number;
  drop: number;
  slant: number;
  iris: number;
  pupil: number;
  shine: number;
}

const LIDS: EyeLids = {
  close: 0,
  open: 1,
  raise: 0,
  drop: 0,
  slant: 0,
  iris: 1,
  pupil: 1,
  shine: 1,
};

/** Kiểu mắt vẽ bằng mắt người trên đầu `human`; `squeezed`, `sly` giữ nét manga của `EYES` */
export const EYE_LIDS = {
  open: {},
  shut: { close: 1 },
  wide: { open: 1.35, pupil: 0.85 },
  bulge: { open: 1.75, drop: 0.35, iris: 0.82, pupil: 0.55, shine: 0.25 },
  squint: { close: 0.42, raise: 0.35 },
  happy: { close: 1, raise: 1.5 },
  droopy: { close: 0.62 },
  wink: {},
} satisfies Partial<Record<EyeKind, Partial<EyeLids>>>;

/** `wink`: bên `-1` nhắm cười, bên kia mở với mi dưới nhấc nhẹ */
const WINK: Record<1 | -1, Partial<EyeLids>> = {
  [-1]: { close: 1, raise: 0.85 },
  1: { raise: 0.2 },
};

/** Mi trên mắt người xiên theo mày: giận, chau hạ đầu trong; buồn, lo hạ đầu ngoài */
export const BROW_SLANT: Partial<Record<BrowKind, number>> = {
  angry: 1,
  furrowed: 0.6,
  sad: -1,
  worried: -0.7,
};

/** Kiểu mắt có chớp; `wink` chỉ mắt mở chớp */
const BLINKS: ReadonlySet<EyeKind> = new Set(["open", "wide", "bulge", "squint", "droopy", "wink"]);

/** Độ nhắm của chớp mắt áp lên kiểu mắt `kind`: kiểu đang nhắm hay mắt manga thì `0` */
export const eyeBlink = (kind: EyeKind, closure: number) =>
  BLINKS.has(kind) ? clamp01(closure) : 0;

/**
 * Chớp mắt vu vơ: mỗi nhịp `period` s một lần ở chỗ băm từ số nhịp và `seed`; nhắm trong `close` s, giữ `hold`, mở
 * trong `open`. Độ nhắm làm tròn `1 / steps`.
 */
export const BLINK = { period: 3.7, close: 2 / 60, hold: 1 / 60, open: 4 / 60, steps: 8 } as const;

const fract = (x: number) => x - Math.floor(x);

/** Độ nhắm `0..1` của chớp mắt vu vơ lúc `t` giây, người `seed`; cùng `t` cùng số */
export function blinkAt(t: number, seed = 0): number {
  const B = BLINK;
  const u = t + seed * 1.618;
  const n = Math.floor(u / B.period);
  const at =
    n * B.period + 0.4 + fract(Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453) * (B.period - 1);
  const d = u - at;
  const v =
    d < 0
      ? 0
      : d < B.close
        ? d / B.close
        : d < B.close + B.hold
          ? 1
          : 1 - (d - B.close - B.hold) / B.open;
  return Math.round(clamp01(v) * B.steps) / B.steps;
}

/**
 * Chớp chưa nhắm hẳn chỉ dồn tới bấy nhiêu phần độ nhắm của mắt người: nét mi trên che kín khe từ độ nhắm chừng `0,8`,
 * nên nấc `7/8` vẫn còn khe mảnh
 */
const BLINK_REACH = 0.84;

/**
 * Mi của mắt người kiểu `kind` bên `s`: mi sụp nghỉ `rest` (mắt mở to chỉ ăn `WIDE_LID` phần) và chớp `blink` (co theo
 * `BLINK_REACH`) dồn vào độ nhắm, mày `brow` xiên mi trên (`BROW_SLANT`), nhìn dọc `gaze` (dương xuống) hạ hay nâng mi trên (`LOOK`)
 */
export function eyeLids(
  kind: keyof typeof EYE_LIDS,
  s: 1 | -1,
  rest = 0,
  blink = 0,
  brow?: BrowKind,
  gaze = 0,
): EyeLids {
  const st: EyeLids = { ...LIDS, ...(kind === "wink" ? WINK[s] : EYE_LIDS[kind]) };
  const r = clamp01(rest) * (st.open > 1 ? WIDE_LID : 1);
  const down = 1 - LOOK.down * clamp01(gaze);
  const b = blink >= 1 ? 1 : BLINK_REACH * clamp01(blink);
  const close = st.close >= 1 ? 1 : 1 - (1 - st.close) * (1 - r) * (1 - b) * down;
  const open = st.open * (1 + LOOK.up * clamp01(-gaze));
  return { ...st, close, open, slant: st.slant + ((brow && BROW_SLANT[brow]) ?? 0) };
}

type P = [number, number];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pt = (p: P) => `${+p[0].toFixed(2)} ${+p[1].toFixed(2)}`;
const IRIS = "#4a3426";
/** Nếp mí cách mi trên bấy nhiêu `EYE_R` */
const CREASE = 0.45;
/** Đường nhắm võng xuống giữa tối đa bấy nhiêu `EYE_R` dưới tâm mắt */
const SAG = 0.5;
/** Mi trên dày dần từ `lash` lên `outer`: mỗi bậc `[từ chỗ t, phần độ dày thêm]` */
const TAPER: readonly P[] = [
  [0.3, 0.25],
  [0.42, 0.5],
  [0.54, 0.75],
  [0.66, 1],
];
/** Mi dưới chạy đoạn `[from, to]` từ khoé trong, đậm `alpha`, dừng trước khoé ngoài cho khỏi chẻ đuôi cá với đuôi mắt */
const LOWER = { from: 0.5, to: 0.9, alpha: 0.55 };
/** Đốm sáng co từ độ nhắm `close − 0,15` tới hết ở `close`; nhỏ hơn `room` phần bán kính đầy thì bỏ */
const SHINE_FIT = { close: 0.45, room: 0.45 };

/** Mi trên đi về đường nhắm theo độ nhắm */
const EASE = (f: number) => 1 - (1 - f) ** 1.5;

/** Đoạn `[t0, 1]` của đường cong bậc ba `a b c d` */
function tail(a: P, b: P, c: P, d: P, t0: number): [P, P, P, P] {
  const m = (p: P, q: P): P => [lerp(p[0], q[0], t0), lerp(p[1], q[1], t0)];
  const [ab, bc, cd] = [m(a, b), m(b, c), m(c, d)];
  const [abc, bcd] = [m(ab, bc), m(bc, cd)];
  return [m(abc, bcd), bcd, cd, d];
}
/** `y` của đường cong bậc ba `c` (`x` đi một chiều) ở hoành độ `x` */
function yAt(c: [P, P, P, P], x: number): number {
  const at = (t: number, i: 0 | 1) =>
    (1 - t) ** 3 * c[0][i] +
    3 * (1 - t) ** 2 * t * c[1][i] +
    3 * (1 - t) * t * t * c[2][i] +
    t ** 3 * c[3][i];
  const up = c[3][0] > c[0][0];
  let [a, b] = [0, 1];
  for (let i = 0; i < 24; i++) {
    const m = (a + b) / 2;
    if (at(m, 0) < x === up) a = m;
    else b = m;
  }
  return at((a + b) / 2, 1);
}

/** Đoạn `[t0, t1]` của đường cong bậc ba `c` */
function part(c: [P, P, P, P], t0: number, t1: number): [P, P, P, P] {
  const a = tail(...c, t0);
  const b = tail(a[3], a[2], a[1], a[0], 1 - (t1 - t0) / (1 - t0));
  return [b[3], b[2], b[1], b[0]];
}
const curve = (c: [P, P, P, P]) => `M ${pt(c[0])} C ${pt(c[1])} ${pt(c[2])} ${pt(c[3])}`;

/**
 * Tâm tròng mắt người tâm `(x, cy)` bên `s`, bóp ngang `k`, dáng `S`, mi `L`, nhìn `l`: mọi chỗ cần tâm tròng đọc ở đây.
 * Nhìn lên đi theo chỗ hở dưới mi trên (`S.up`, độ nhắm), con ngươi không lẩn hết vào mi.
 */
function irisAt(
  x: number,
  cy: number,
  s: 1 | -1,
  k: number,
  S: EyeShape,
  L: EyeLids,
  l: Look = CENTER,
): P {
  const up = l[1] < 0 ? S.up * (1 - clamp01(L.close)) : 1;
  return [
    x - s * 0.06 * R + l[0] * LOOK.x * S.half * R * k,
    cy + 0.08 * R + l[1] * LOOK.y * R * up,
  ];
}

/**
 * Mắt người tâm `(x, cy)` bên `s`, bóp ngang `k`, dáng `S`, mi `L`, đốm sáng nhân `shine`, nhìn `look`. Mi trên đi từ
 * chỗ mở về đường nhắm nằm trên mi dưới (`close`), đường nhắm rộng bằng mắt mở; nhắm hẳn thì không còn lòng trắng.
 */
function humanEye(
  x: number,
  cy: number,
  s: 1 | -1,
  k: number,
  S: EyeShape,
  L: EyeLids,
  shine: number,
  look: Look,
): FaceMark {
  const f = clamp01(L.close);
  const up = S.up * R;
  const X = (u: number) => x + s * u * S.half * R * k;
  const inner: P = [X(-1), cy + 0.12 * R];
  // khoé ngoài xếch hay cụp về ngang khi nhắm, đường nhắm khỏi vểnh sừng ở đuôi
  const outer: P = [X(1), cy - S.tilt * R * (1 - f * f)];
  const loY = lerp(cy + S.down * R * (1 + L.drop), cy - 0.55 * up, L.raise);
  const line = Math.min(lerp(loY, cy, 0.35), cy + SAG * R);
  const upY = cy - up * L.open;
  const [hi, lo] = [Math.max(L.slant, 0), Math.max(-L.slant, 0)];
  const o1 = upY + (0.71 * hi - 0.11 * lo) * up;
  const o2 = upY + 0.8 * lo * up;
  const low = lerp(loY, line, f ** 2);
  const g = EASE(f);
  // mắt trố: đuôi mắt và mi dưới mờ dần, khỏi thành quai và nét viền đứt
  const wide = clamp01(1 - (L.open - 1) / 0.6);
  const U: [P, P, P, P] = [
    inner,
    [X(-0.4), lerp(o1, line, g)],
    [X(0.45), lerp(o2, line, g)],
    outer,
  ];
  // mi dưới hạ (`drop`) thì điểm điều khiển dãn ra hai khoé: đáy tròn, không nhọn thành quả chanh
  const sp = 0.4 + L.drop;
  const D: [P, P, P, P] = [outer, [X(sp), low], [X(-sp), low], inner];
  const upper = curve(U);
  const d = `${upper} C ${pt(D[1])} ${pt(D[2])} ${pt(D[3])} Z`;
  const ink = { fill: "none", stroke: EYE_INK, strokeLinecap: "round" } as const;
  const out: FaceMark[] = [];
  if (S.crease > 0 && f < 1) {
    // nếp mí chạy song song mi trên đang mở, cách `CREASE` R, hạ và nhạt dần khi nhắm
    const dy = -CREASE * R + 0.3 * f * R;
    const c = tail(inner, [X(-0.4), o1], [X(0.45), o2], outer, 0.2).map(
      ([px, py]) => [px, py + dy] as P,
    );
    c[3] = [X(0.92), c[3][1]];
    const a = +(0.75 * clamp01(S.crease) * (1 - f)).toFixed(3);
    out.push({
      path: curve(c as [P, P, P, P]),
      ...ink,
      stroke: `rgba(34, 32, 29, ${a})`,
      strokeWidth: 0.9,
    });
  }
  if (f < 1) {
    const ir = S.iris * R * L.iris;
    const pr = ir * S.pupil * L.pupil;
    const [ix, iy] = irisAt(x, cy, s, k, S, L, look);
    // đốm sáng tụt xuống dưới nét mi trên, tới giữa tròng thì co, nhỏ dần theo độ nhắm, chật quá thì bỏ: không còn chấm
    // trắng lọt khe mi
    const sx = ix - 0.3 * ir * k;
    const sh0 = 0.3 * ir * S.shine * L.shine * shine;
    const sh1 = sh0 * clamp01((SHINE_FIT.close - f) / 0.15);
    const edge = yAt(U, sx) + S.lash / 2;
    const sy = Math.min(Math.max(iy - 0.38 * ir, edge + sh1), iy);
    const sh = Math.min(sh1, sy - edge) >= SHINE_FIT.room * sh0 ? Math.min(sh1, sy - edge) : 0;
    out.push(
      { clip: d },
      { path: d, fill: WHITE },
      { ellipse: [ix, iy, ir * k, ir], fill: IRIS, clipped: true },
      { ellipse: [ix, iy, pr * k, pr], fill: EYE_INK, clipped: true },
      ...(sh > 0
        ? [
            {
              ellipse: [sx, sy, sh * k, sh] as Quad,
              fill: WHITE,
              clipped: true as const,
            },
          ]
        : []),
    );
    const a = +(LOWER.alpha * wide).toFixed(3);
    // nét nằm hẳn ngoài mép dưới, trên da: đè lên tròng thì tối trên tối, như bị tròng cắt khi liếc
    const lash = part([D[3], D[2], D[1], D[0]], LOWER.from, lerp(LOWER.from, LOWER.to, wide));
    if (S.lower > 0 && a > 0)
      out.push({
        path: curve(lash.map(([px, py]) => [px, py + S.lower / 2]) as [P, P, P, P]),
        ...ink,
        stroke: `rgba(34, 32, 29, ${a})`,
        strokeWidth: S.lower,
      });
  }
  const thick = lerp(S.outer, S.lash + 0.4, f * 0.6);
  out.push(
    { path: upper, ...ink, strokeWidth: S.lash },
    ...TAPER.map(([t0, w]) => ({
      path: curve(tail(...U, t0)),
      ...ink,
      strokeWidth: lerp(S.lash, thick, w),
    })),
  );
  const fl = S.flick * (1 - 0.6 * f) * wide;
  if (fl > 0.05) {
    // đuôi mắt nhọn dần, chĩa ra ngoài, hơi lên khi mở, rủ xuống khi nhắm
    const [dx, dy] = [s, lerp(-0.45, 0.6, f)];
    const n = 1 / Math.hypot(dx, dy);
    const [ux, uy] = [dx * n, dy * n];
    const w = 0.45 * thick;
    out.push({
      path: `M ${pt([outer[0] - uy * w, outer[1] + ux * w])} L ${pt([outer[0] + ux * fl, outer[1] + uy * fl])} L ${pt([outer[0] + uy * w, outer[1] - ux * w])} Z`,
      fill: EYE_INK,
    });
  }
  return { group: out };
}

/**
 * `pupil` bán kính con ngươi `bulge` theo `EYE_R`, chấm con ngươi `wide` theo nó; `lid` mi trên nghỉ sụp phần độ nhắm
 * (`wide`, `bulge` nửa số); `blink` độ nhắm của chớp mắt (`blinkAt`). `shape` có thì vẽ mắt người của đầu `human`
 * (`EYE_LIDS`) với mi trên xiên theo mày `brow`, đốm sáng nhân `shine`. `look` (`lookStep`) dời tròng, hay chấm mắt
 * của đầu `sphere`.
 */
export interface EyeSides extends FaceSides {
  pupil?: number;
  lid?: number;
  shine?: number;
  blink?: number;
  shape?: EyeShape;
  brow?: BrowKind;
  look?: Look;
}

/** Bề dày nét mày, độ nghiêng cộng vào mọi kiểu mày — dương nhấc đầu trong; `human` lấy kiểu mày của `HUMAN_BROWS` */
export interface BrowSides extends FaceSides {
  width?: number;
  tilt?: number;
  human?: boolean;
}

const sidesOf = (only?: 1 | -1) => ([-1, 1] as const).filter((s) => !only || s === only);

/** Mắt chấm chớp từ độ nhắm này trở lên thì vẽ `shut`; dưới đó mi trên cắt như `lid` */
const DOT_BLINK = 0.75;

/** Hai mắt cách nhau `gap`; bỏ trống `squash` thì đầu `side` bóp `SIDE_EYE_OVAL`, nét vẽ giữ nguyên */
export function eyeMarks(
  kind: EyeKind,
  cx: number,
  cy: number,
  gap: number,
  o: EyeSides = {},
): FaceMark {
  const k = o.squash ?? (o.only ? SIDE_EYE_OVAL : 1);
  const p = o.pupil ?? WIDE_PUPIL;
  const lid = o.lid ?? 0;
  const b = eyeBlink(kind, o.blink ?? 0);
  const S = o.shape;
  const l = o.look ?? CENTER;
  return {
    group: sidesOf(o.only).map((s) => {
      const x = cx + (s * gap) / 2;
      if (S && kind in EYE_LIDS) {
        const L = eyeLids(kind as keyof typeof EYE_LIDS, s, lid + S.hood, b, o.brow, l[1]);
        return humanEye(x, cy, s, k, S, L, o.shine ?? 1, l);
      }
      if (b >= DOT_BLINK && !(kind === "wink" && s === -1)) return EYES.shut(x, cy);
      return EYES[kind](x, cy, s, k, p, Math.max(lid, b), l);
    }),
  };
}

/** `lift` hạ cả hai nét xuống, `tilt` nhấc đầu trong lên, `arch` uốn cung; `far` là nét bên `+1` */
type BrowShape = { lift: number; tilt: number; arch: number };

/** Kiểu mày: thứ tự khoá là thứ tự của `BROW_KINDS` */
export const BROWS = {
  neutral: { lift: 0, tilt: 2, arch: 0 },
  flat: { lift: 0, tilt: 0, arch: 0 },
  lifted: { lift: -3, tilt: 0, arch: -1 },
  furrowed: { lift: 1, tilt: -4, arch: -1 },
  angry: { lift: 3, tilt: -7, arch: -2 },
  sad: { lift: -1, tilt: 7, arch: 2 },
  raised: { lift: -8, tilt: 2, arch: -4 },
  worried: { lift: 1, tilt: 3, arch: 1, far: { lift: 0, tilt: 2, arch: -1 } },
  skeptical: { lift: -4, tilt: 1, arch: -7, far: { lift: 3, tilt: -2, arch: 0 } },
} satisfies Record<string, BrowShape & { far?: BrowShape }>;

/** Kiểu mày đầu `human` thay cho `BROWS`: mắt người lộ tròng, mày nghỉ nhấc đầu trong đã đọc ra lo */
export const HUMAN_BROWS: Partial<Record<BrowKind, BrowShape>> = {
  neutral: { lift: 0, tilt: 0, arch: -1.5 },
};

/** Hai nét mày rời hẳn khỏi mắt, trên tâm mắt `cy`; độ nghiêng của chúng làm gần hết biểu cảm */
export function browMarks(
  kind: BrowKind,
  cx: number,
  cy: number,
  gap: number,
  o: BrowSides = {},
): FaceMark {
  const squash = o.squash ?? 1;
  const shape: BrowShape & { far?: BrowShape } = (o.human && HUMAN_BROWS[kind]) || BROWS[kind];
  return {
    fill: "none",
    stroke: EYE_INK,
    strokeWidth: 4 * (o.width ?? 1),
    strokeLinecap: "round",
    group: sidesOf(o.only).map((s) => {
      const { lift, arch, ...t } = s === 1 && shape.far ? shape.far : shape;
      const tilt = t.tilt + (o.tilt ?? 0);
      const y = cy - BROW_ABOVE + lift;
      const ex = cx + (s * gap) / 2;
      return {
        path: `M ${ex + s * 8 * squash} ${y + tilt} Q ${ex} ${y + arch} ${ex - s * 8 * squash} ${y - tilt}`,
      };
    }),
  };
}

/**
 * Chân chim của mắt người: mỗi nét `[dời x, dời y, góc]` (px, độ) từ khoé ngoài cộng `gap` px, cao `y` px dưới tâm mắt;
 * dài `len` px, dày `width` lần nét nếp nhăn. `light` lấy hai nét đầu, `deep` cả ba.
 */
const CROW = {
  gap: 3.5,
  y: 1,
  len: 3.6,
  width: 0.4,
  lines: [
    [0.4, -1.2, 18],
    [0, 1.4, 36],
    [-0.8, 4, 54],
  ],
} as const;

export interface WrinkleSpec {
  kind: WrinkleKind;
  color: string;
  width: number;
  dy: number;
}

/**
 * Nếp nhăn quanh tâm mắt `(cx, cy)`: nếp trán, chân chim, `deep` thêm túi mắt và pháp lệnh tới
 * mồm ở `mouthCy`. `r` bán kính đầu, `squeeze` hệ số hẹp khi lắc — nhân vào mọi bề ngang, không thì
 * nếp trán thò ra ngoài viền đầu lúc quay mặt. `eyeHalf` (mắt người, px từ tâm tới khoé ngoài) có thì chân chim
 * là các nét rời của `CROW`, bắt đầu cách khoé ngoài một quãng. Nét ở thuộc tính nhóm.
 */
export function wrinkleMarks(
  wrinkle: WrinkleSpec,
  cx: number,
  cy: number,
  gap: number,
  mouthCy: number,
  r = 65,
  squeeze = 1,
  eyeHalf?: number,
): FaceMark | null {
  if (wrinkle.kind === "none") return null;
  const k = r / 65;
  const { color, width, dy } = wrinkle;
  const deep = wrinkle.kind === "deep";
  const y = cy + dy;
  const X = (v: number) => cx + v * squeeze;
  const eye = gap / 2 + 7 * k;
  const len = 8.5 * k;
  const w = 34 * k * width;
  // nét từ `x0` px ngoài tâm mặt bên `s`, chĩa ra ngoài, góc `a` độ dương xuống
  const ray = (s: 1 | -1, x0: number, y0: number, a: number, l: number, ink = {}) => {
    const rad = (a * Math.PI) / 180;
    return {
      line: [X(s * x0), y0, X(s * (x0 + l * Math.cos(rad))), y0 + l * Math.sin(rad)] as Quad,
      ...ink,
    };
  };
  const crow = (s: 1 | -1): FaceMark[] =>
    eyeHalf === undefined
      ? (deep ? [-6, 18, 42] : [12, 38]).map((a) => ray(s, eye, y + 2 * k, a, len))
      : CROW.lines
          .slice(0, deep ? 3 : 2)
          .map(([dx, dy, a]) =>
            ray(
              s,
              gap / 2 + eyeHalf + (CROW.gap + dx) * k,
              y + (CROW.y + dy) * k,
              a,
              CROW.len * k,
              { strokeWidth: 2.6 * k * CROW.width },
            ),
          );
  return {
    fill: "none",
    stroke: color,
    strokeWidth: 2.6 * k,
    strokeLinecap: "round",
    group: [
      // Nếp trán: cung nông vồng lên, giữa lông mày (cy − 18) và đỉnh đầu (cy − 65)
      ...(deep ? [-32, -46] : [-38]).map((b) => ({
        path: `M ${X(-w)} ${y + (b + 3) * k} Q ${cx} ${y + (b - 4) * k} ${X(w)} ${y + (b + 3) * k}`,
      })),
      ...([-1, 1] as const).map((s) => ({
        group: [
          // Chân chim: nan quạt ngắn từ đuôi mắt, xoè xuống — để ngang thành ria mèo
          ...crow(s),
          ...(deep
            ? [
                // Túi dưới mắt
                {
                  path: `M ${X(s * (gap / 2 - 8 * k))} ${y + 9 * k} Q ${X((s * gap) / 2)} ${y + 15 * k} ${X(s * (gap / 2 + 8 * k))} ${y + 9 * k}`,
                },
                // Pháp lệnh: từ cạnh mũi xoè ra ngoài rồi xuống quá mép mồm
                {
                  path: `M ${X(s * 11 * k)} ${y + 0.55 * (mouthCy - y)} Q ${X(s * 19 * k)} ${y + 0.75 * (mouthCy - y)} ${X(s * 18 * k)} ${mouthCy + 3 * k}`,
                },
              ]
            : []),
        ],
      })),
    ],
  };
}

/**
 * Nét mặt chibi của đầu `human` trên người 3D: mắt hạ `offsetY`, giãn `eyeGap`, mồm gần mắt `mouthGap` (cộng vào
 * `face` của JSON nhân vật); nét mắt phóng `eye` quanh tâm mắt và bóp ngang `squash`, mồm phóng `mouth`, bề ngang mồm
 * nhân thêm `mouthWide`, mày nhấc `brow` px. `FACE_REST` của nhân vật chỉnh `eye`, `squash` và đốm sáng.
 * docs/01-rig.md#người-3d-mặc-đồ
 */
export const CHIBI = {
  // THỬ (feat/real-head-proto): mắt nhỏ hơn, gần nhau hơn, miệng xa mắt hơn cho mặt dài
  shift: { offsetY: 4, eyeGap: 10, mouthGap: 0 },
  eye: 1.2,
  squash: 1,
  mouth: 0.8,
  // THỬ (feat/real-head-proto): đầu dài theo số đầu, mồm cùng cỡ px đọc hẹp (bề ngang / chiều cao đầu 0,13 → 0,10): nới
  // riêng bề ngang mồm (cả ria trên lớp mồm), chiều cao khẩu hình giữ `mouth`
  mouthWide: 1.3,
  brow: 3,
} as const;

/**
 * Nét mặt nghỉ riêng của nhân vật — trường cùng tên trong `face` của JSON nhân vật, mặc định và khoảng cho phép.
 * `eyeScale` nhân `CHIBI.eye`, `eyeWidth` nhân `CHIBI.squash`, `shine` nhân đốm sáng: chỉ đầu `human` đọc. `lid` mi
 * trên sụp (`EyeSides.lid`), `browWidth` / `browTilt` nhân bề dày / cộng độ nghiêng mày (`BrowSides`): mọi nét mặt
 * đọc. docs/01-rig.md#nét-mặt-riêng
 */
export const FACE_REST = {
  eyeScale: { def: 1, min: 0.7, max: 1.3 },
  eyeWidth: { def: 1, min: 0.7, max: 1.3 },
  lid: { def: 0, min: 0, max: 0.6 },
  shine: { def: 1, min: 0, max: 1.5 },
  browWidth: { def: 1, min: 0.5, max: 1.8 },
  browTilt: { def: 0, min: -8, max: 8 },
} as const;

export type FaceRest = Record<keyof typeof FACE_REST, number>;

/** `FACE_REST` của `face`, trường bỏ trống lấy mặc định */
export function faceRest(face: Partial<FaceRest> = {}): FaceRest {
  const keys = Object.keys(FACE_REST) as (keyof FaceRest)[];
  return Object.fromEntries(keys.map((k) => [k, face[k] ?? FACE_REST[k].def])) as FaceRest;
}

/**
 * Hộp mắt mở của đầu `human` (dáng `eyeShape` với số đè `eye`, vẽ ở `CHIBI.eye · eyeScale`, bóp ngang
 * `CHIBI.squash · eyeWidth`) quanh tâm mắt, px nét mặt: nửa rộng phía mũi `inner`, phía tai `outer` (cả đuôi mi), trên
 * `up` (đỉnh mi trên hay khoé ngoài xếch), dưới `down` (cả nét mi dưới). Kính dựng khối đọc để mắt kính ôm trọn mắt
 */
export function humanEyeBox(
  face: Partial<FaceRest> & { eyeShape?: EyeShapeKind; eye?: Partial<EyeShape> } = {},
) {
  const r = faceRest(face);
  const S = eyeShape(face.eyeShape, face.eye);
  const k = CHIBI.squash * r.eyeWidth,
    z = CHIBI.eye * r.eyeScale;
  const rx = S.half * EYE_R * k;
  return {
    inner: rx * z,
    outer: (rx + S.flick + S.outer / 2) * z,
    // mép cubic tới ba phần tư điểm điều khiển
    up: (Math.max(0.75 * S.up, S.tilt) * EYE_R + S.outer / 2) * z,
    down: (0.75 * S.down * EYE_R + S.lower) * z,
  };
}

/** `face` của JSON nhân vật dời theo `CHIBI.shift` */
export function chibiShape<T extends { offsetY: number; eyeGap: number; mouthGap: number }>(
  s: T,
): T {
  const d = CHIBI.shift;
  return {
    ...s,
    offsetY: s.offsetY + d.offsetY,
    eyeGap: s.eyeGap + d.eyeGap,
    mouthGap: s.mouthGap + d.mouthGap,
  };
}

/** Đỏ ấm mà màu má ngả về, phần ngả `BLUSH.mix`; độ đục ở mức ửng `1` là `BLUSH.alpha` */
export const BLUSH = { flush: [214, 52, 52], mix: 0.6, alpha: 0.55, steps: 32 } as const;

const SKIN_RGB = [240, 217, 184];

/** `#rgb` / `#rrggbb` ra ba kênh `0..255`; mã khác lấy màu da mặc định */
function hexRgb(hex: string): number[] {
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())?.[1];
  if (!h) return SKIN_RGB;
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

/**
 * Màu má ửng trên da `skin` ở mức `k` `0..1`: da ngả về `BLUSH.flush` — da sáng sẫm xuống thành hồng
 * cam, da sẫm sáng lên thành đỏ gạch — độ đục theo `k`. docs/01-rig.md#má-ửng
 */
export function blushColor(skin: string, k: number): string {
  const m = BLUSH.mix;
  const [r, g, b] = hexRgb(skin).map((v, i) => Math.round(v * (1 - m) + BLUSH.flush[i] * m));
  return `rgba(${r}, ${g}, ${b}, ${+(BLUSH.alpha * clamp01(k)).toFixed(3)})`;
}

/** Mức ửng vẽ ra: `face.blush` của nhân vật cộng `blush` của nét mặt, kẹp `0..1`, làm tròn `1 / BLUSH.steps` */
export const blushLevel = (base = 0, add = 0) =>
  Math.round(clamp01(base + add) * BLUSH.steps) / BLUSH.steps;

/** Má ửng dưới hai mắt, chếch ra ngoài, màu `blushColor(skin, k)`; `k` `0` thì rỗng */
export function blushMarks(cx: number, cy: number, gap: number, skin: string, k: number): FaceMark {
  return {
    fill: blushColor(skin, k),
    group:
      k > 0
        ? sidesOf().map((s) => ({ ellipse: [cx + s * (gap / 2 + 7), cy + 15, 8, 4.5] as Quad }))
        : [],
  };
}

export const MOUTH_KINDS = Object.keys(MOUTHS) as [MouthKind, ...MouthKind[]];
export const EYE_KINDS = Object.keys(EYES) as [EyeKind, ...EyeKind[]];
export const BROW_KINDS = Object.keys(BROWS) as [BrowKind, ...BrowKind[]];
export const WRINKLE_KINDS: WrinkleKind[] = ["none", "light", "deep"];
