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
  talkTeeth: {
    extent: { top: -4.5, bottom: 5.5 },
    marks: (cx, cy) => {
      const [w, top, bottom] = [13, -4, 5.5];
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
  },
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
} satisfies Record<string, MouthDef>;

/** Nét mồm tâm `(cx, cy)` */
export function mouthMark(kind: MouthKind, cx: number, cy: number): FaceMark {
  return MOUTHS[kind].marks(cx, cy);
}

/** Mép trên / dưới của khẩu hình so với tâm miệng, cho râu bám theo */
export function mouthExtent(kind: MouthKind): { top: number; bottom: number } {
  return MOUTHS[kind].extent;
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
 * `p · R`, mi trên nghỉ sụp `lid` phần chiều cao
 */
type EyeDef = (x: number, cy: number, s: 1 | -1, k: number, p: number, lid: number) => FaceMark;
const R = EYE_R;
const WIDE_PUPIL = 0.7;
/** Mắt trợn mở to hơn mắt nghỉ: mi sụp `lid` chỉ cắt bấy nhiêu phần ấy */
const WIDE_LID = 0.5;
/** `wide`: bầu dục đặc to hơn mắt mở bấy nhiêu lần, lòng trắng giữa chiếm `white` bán kính, con ngươi `dot · p · R` */
const WIDE = { r: 1.35, white: 0.55, dot: 0.45 };
/** Bán kính lòng trắng `bulge` theo `R` */
const BULGE = 1.5;

/** Kiểu mắt: thứ tự khoá là thứ tự của `EYE_KINDS`; `wide` và `bulge` có lòng trắng */
export const EYES = {
  open: (x, cy, _s, k, _p, lid) => pupil(x, cy, R * k, R, lid),
  shut: (x, cy) => ({ line: [x - 7, cy, x + 7, cy], ...EYE_LINE }),
  // Mắt mở to hơn, lòng trắng giữa vành đen, con ngươi co còn chấm
  wide: (x, cy, _s, k, p, lid) => {
    const [rx, ry] = [R * WIDE.r * k, R * WIDE.r];
    const d = lidCut(x, cy, rx, ry, lid * WIDE_LID);
    const w = WIDE.white;
    return {
      group: [
        { clip: d },
        { path: d, fill: EYE_INK },
        { ellipse: [x, cy, rx * w, ry * w], fill: WHITE, clipped: true },
        { ellipse: [x, cy, WIDE.dot * p * R * k, WIDE.dot * p * R], fill: EYE_INK, clipped: true },
      ],
    };
  },
  // Mắt trố: lòng trắng to viền mảnh, con ngươi giữa
  bulge: (x, cy, _s, k, p, lid) => {
    const iris = { ellipse: [x, cy, R * p * k, R * p] as Quad, fill: EYE_INK };
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
  squint: (x, cy, _s, k, _p, lid) => ({
    path: lidCut(x, cy, R * k, R, Math.max(0.5, lid)),
    fill: EYE_INK,
  }),
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
  wink: (x, cy, s, k, _p, lid) =>
    s === -1
      ? { path: `M ${x - 7} ${cy + 2} Q ${x} ${cy - 3} ${x + 7} ${cy + 2}`, ...EYE_LINE }
      : pupil(x, cy, R * k, R, lid),
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
 * `pupil` bán kính con ngươi `bulge` theo `EYE_R`, chấm con ngươi `wide` theo nó; `lid` mi trên nghỉ sụp phần chiều cao
 * con ngươi (`open`, mắt mở của `wink`, `wide` và `bulge` nửa số; `squint` lấy số lớn hơn); `shine` nhân đốm sáng của
 * `eyeShine`, `0` là không có
 */
export interface EyeSides extends FaceSides {
  pupil?: number;
  lid?: number;
  shine?: number;
}

/** `width` nhân bề dày nét mày, `tilt` cộng vào độ nghiêng của mọi kiểu mày — dương nhấc đầu trong */
export interface BrowSides extends FaceSides {
  width?: number;
  tilt?: number;
}

const sidesOf = (only?: 1 | -1) => ([-1, 1] as const).filter((s) => !only || s === only);

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
  const eye: EyeDef = EYES[kind];
  return {
    group: sidesOf(o.only).map((s) => eye(cx + (s * gap) / 2, cy, s, k, p, o.lid ?? 0)),
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

/** Hai nét mày rời hẳn khỏi mắt, trên tâm mắt `cy`; độ nghiêng của chúng làm gần hết biểu cảm */
export function browMarks(
  kind: BrowKind,
  cx: number,
  cy: number,
  gap: number,
  o: BrowSides = {},
): FaceMark {
  const squash = o.squash ?? 1;
  const shape: BrowShape & { far?: BrowShape } = BROWS[kind];
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

export interface WrinkleSpec {
  kind: WrinkleKind;
  color: string;
  width: number;
  dy: number;
}

/**
 * Nếp nhăn quanh tâm mắt `(cx, cy)`: nếp trán, chân chim, `deep` thêm túi mắt và pháp lệnh tới
 * mồm ở `mouthCy`. `r` bán kính đầu, `squeeze` hệ số hẹp khi lắc — nhân vào mọi bề ngang, không thì
 * nếp trán thò ra ngoài viền đầu lúc quay mặt. Nét ở thuộc tính nhóm.
 */
export function wrinkleMarks(
  wrinkle: WrinkleSpec,
  cx: number,
  cy: number,
  gap: number,
  mouthCy: number,
  r = 65,
  squeeze = 1,
): FaceMark | null {
  if (wrinkle.kind === "none") return null;
  const k = r / 65;
  const { color, width, dy } = wrinkle;
  const deep = wrinkle.kind === "deep";
  const y = cy + dy;
  const X = (v: number) => cx + v * squeeze;
  const eye = gap / 2 + 7 * k;
  const w = 34 * k * width;
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
          ...(deep ? [-6, 18, 42] : [12, 38]).map((a) => {
            const rad = (a * Math.PI) / 180;
            const len = 8.5 * k;
            return {
              line: [
                X(s * eye),
                y + 2 * k,
                X(s * (eye + len * Math.cos(rad))),
                y + (2 + 8.5 * Math.sin(rad)) * k,
              ] as Quad,
            };
          }),
          ...(deep
            ? [
                // Túi dưới mắt
                {
                  path: `M ${X(s * (gap / 2 - 8 * k))} ${y + 9 * k} Q ${X((s * gap) / 2)} ${y + 15 * k} ${X(s * (gap / 2 + 8 * k))} ${y + 9 * k}`,
                },
                // Pháp lệnh: từ cạnh mũi xoè ra ngoài rồi xuống quá mép mồm
                {
                  path: `M ${X(s * 7 * k)} ${y + 16 * k} Q ${X(s * 23 * k)} ${(y + mouthCy) / 2} ${X(s * 20 * k)} ${mouthCy + 6 * k}`,
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
 * `face` của JSON nhân vật); nét mắt phóng `eye` quanh tâm mắt và bóp ngang `squash` thành bầu dục đứng, con ngươi
 * `bulge` bán kính `pupil · EYE_R`, mồm phóng `mouth`, mày nhấc `brow` px. `FACE_REST` của nhân vật chỉnh `eye`,
 * `squash` và đốm sáng. docs/01-rig.md#người-3d-mặc-đồ
 */
export const CHIBI = {
  shift: { offsetY: 10, eyeGap: 18, mouthGap: -10 },
  eye: 1.45,
  squash: 0.75,
  pupil: 0.85,
  mouth: 0.8,
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

/** Bán kính con ngươi theo `EYE_R` của kiểu mắt có đốm sáng, `bulge` đọc `pupil`; `wink` chỉ bên `+1` còn mở */
const SHINE: Partial<Record<EyeKind, number>> = { open: 1, wink: 1 };

/**
 * Đốm sáng trên con ngươi của mắt chibi, cùng tâm, `only`, `squash` và `lid` như `eyeMarks`, cỡ nhân `shine`; kiểu mắt
 * nhắm thì rỗng. Mi sụp thì đốm hạ xuống dưới mép mi; mi sụp hay đốm to hơn mặc định thì cắt theo hình mắt.
 */
export function eyeShine(
  kind: EyeKind,
  cx: number,
  cy: number,
  gap: number,
  o: EyeSides = {},
): FaceMark {
  const p = (kind === "bulge" ? (o.pupil ?? WIDE_PUPIL) : (SHINE[kind] ?? 0)) * R;
  const squash = o.squash ?? 1;
  const [k, lid] = [o.shine ?? 1, o.lid ?? 0];
  const sides = p && k > 0 ? sidesOf(o.only).filter((s) => kind !== "wink" || s === 1) : [];
  const r = 0.36 * p * k;
  const [ry, f] = kind === "bulge" ? [BULGE * R, lid * WIDE_LID] : [R, lid];
  const y = lid > 0 ? Math.max(cy - 0.42 * p, cy + ry * (2 * f - 1) + r + 0.08 * p) : cy - 0.42 * p;
  const cut = lid > 0 || k > 1;
  const dots: FaceMark[] = sides.map((s) => {
    const x = cx + (s * gap) / 2;
    return {
      ellipse: [x - 0.3 * p * squash, y, r * squash, r] as Quad,
      ...(cut && { clipped: true as const }),
    };
  });
  const eye = (s: 1 | -1) => lidCut(cx + (s * gap) / 2, cy, ry * squash, ry, f);
  return {
    fill: WHITE,
    group: cut && dots.length ? [{ clip: sides.map(eye).join(" ") }, ...dots] : dots,
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
