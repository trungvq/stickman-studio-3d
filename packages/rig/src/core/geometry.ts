import { D, RIG } from "./constants";
import { limbWidths, type CharacterData } from "./schema";
import { limbSpread, shoulderRoot } from "./torso";
import type { Pose, Pt, Stretch } from "./types";

export const tip = (x: number, y: number, len: number, deg: number): Pt => [
  x + Math.sin(deg * D) * len,
  y + Math.cos(deg * D) * len,
];

/** Độ dài các đoạn sau khi nhân chiều cao; đầu không co theo, xem docs/01-rig.md */
export interface Lengths {
  torso: number;
  neck: number;
  upperArm: number;
  foreArm: number;
  thigh: number;
  shin: number;
}

export const lengths = (height: number): Lengths => ({
  torso: RIG.torso * height,
  neck: RIG.neck * height,
  upperArm: RIG.upperArm * height,
  foreArm: RIG.foreArm * height,
  thigh: RIG.thigh * height,
  shin: RIG.shin * height,
});

export interface Figure {
  /** Độ dài chuẩn, chưa nhân `stretch`; hộp mảnh đo theo đây */
  len: Lengths;
  stretch: Stretch;
  /** Gốc chi gần ống kính nằm phía nào: `-1`, riêng thân áo dựng khối ở `rear` là `+1` */
  shoulderSpan: number;
  hipSpan: number;
  nearSide: 1 | -1;
  cap: number;
  armOuter: number;
  legF: Pt[];
  legN: Pt[];
  armF: Pt[];
  armN: Pt[];
  shF: Pt;
  shN: Pt;
  /** y của bàn chân thấp nhất, tính từ hông */
  lowest: number;
}

// Cổ tay không vào chuỗi: rig không vẽ bàn tay, nó chỉ xoay đồ cầm
const chain = (root: Pt, a: readonly number[], l1: number, l2: number): Pt[] => {
  const k = tip(root[0], root[1], l1, a[0]);
  const f = tip(k[0], k[1], l2, a[0] + a[1]);
  return [root, k, f];
};

/**
 * Hai bàn chân `[xa, gần]` so với tâm hông, bỏ bề ngang hông vì nó là hằng số. `spread` là của
 * người 3D: chân nâng dang ra thì bàn chân lên theo `cos` góc dang, như `act` dựng.
 */
export function feet(P: Pose, height: number, spread = false): [Pt, Pt] {
  const thigh = RIG.thigh * height;
  const shin = RIG.shin * height;
  const s = P.stretch;
  const foot = (ch: "lf" | "ln", l1: number, l2: number): Pt => {
    const [x, y] = chain([0, 0], P[ch], l1, l2)[2];
    return spread && P.lift?.[ch] ? [x, y * Math.cos((P[ch][2] ?? 0) * D)] : [x, y];
  };
  return [foot("lf", thigh * s[4], shin * s[5]), foot("ln", thigh * s[6], shin * s[7])];
}

/**
 * Toàn bộ hình học của một pose nhìn chính diện, gốc ở tâm hông. `stretch` nhân riêng từng đoạn chi.
 * Thân áo dựng khối thì gốc chi chiếu từ vành vai và vành hông của khối.
 */
export function computeFigure(c: CharacterData, P: Pose): Figure {
  const { rig, palette } = c;
  const wLine = rig.stroke;
  const len = lengths(rig.height);
  const clad = palette.clad;
  const s = P.stretch;

  const armOuter = limbWidths(palette).sleeve + (clad ? wLine : 0);
  const cap = armOuter / 2;
  const solid = c.pieces.torso.src === "sculpt";
  const shoulderSpan = solid ? limbSpread(shoulderRoot(c), 0) : rig.shoulderHalf;
  const hipSpan = solid ? limbSpread(rig.hipHalf, 0) : rig.hipHalf;
  const nearSide = -1;

  const hipN: Pt = [nearSide * hipSpan, 0];
  const hipF: Pt = [-nearSide * hipSpan, 0];
  const legF = chain(hipF, P.lf, len.thigh * s[4], len.shin * s[5]);
  const legN = chain(hipN, P.ln, len.thigh * s[6], len.shin * s[7]);

  const shY = -len.torso + rig.shoulderDrop;
  const shN: Pt = [nearSide * shoulderSpan, shY];
  const shF: Pt = [-nearSide * shoulderSpan, shY];
  const armF = chain(shF, P.af, len.upperArm * s[0], len.foreArm * s[1]);
  const armN = chain(shN, P.an, len.upperArm * s[2], len.foreArm * s[3]);

  return {
    len,
    stretch: P.stretch,
    shoulderSpan,
    hipSpan,
    nearSide,
    cap,
    armOuter,
    legF,
    legN,
    armF,
    armN,
    shF,
    shN,
    lowest: Math.max(legF[2][1], legN[2][1]),
  };
}

export const mix = (hex: string, target: string, k: number) => {
  const A = parseInt(hex.slice(1), 16);
  const B = parseInt(target.slice(1), 16);
  const f = (sh: number) => Math.round(((A >> sh) & 255) * (1 - k) + ((B >> sh) & 255) * k);
  return `rgb(${f(16)},${f(8)},${f(0)})`;
};

export const pathOf = (pts: Pt[]) =>
  pts.map((q, i) => `${i ? "L" : "M"} ${q[0]} ${q[1]}`).join(" ");

/** Một cubic Bézier: `[đầu, tay cầm đầu, tay cầm cuối, cuối]` */
export type Cubic = [Pt, Pt, Pt, Pt];

/**
 * Nét chi cong kiểu rubber hose: Catmull-Rom đều qua ba khớp `[gốc, khớp giữa, ngọn]`, tách ở
 * khớp giữa thành hai cubic nên hai nửa vẽ riêng vẫn liền tiếp tuyến. Hai đầu giữ nguyên điểm
 * và hướng của đoạn thẳng — vai áo và đồ cầm tay treo theo `chain()` không lệch. `k` là độ
 * cong `0..1`, `0` là hai đoạn thẳng. docs/01-rig.md#vẽ-chi
 */
export function limbCurves(pts: Pt[], k: number): [Cubic, Cubic] {
  const [P0, P1, P2] = pts;
  const f = k / 6;
  const T0: Pt = [(P1[0] - P0[0]) * f, (P1[1] - P0[1]) * f];
  const T1: Pt = [(P2[0] - P0[0]) * f, (P2[1] - P0[1]) * f];
  const T2: Pt = [(P2[0] - P1[0]) * f, (P2[1] - P1[1]) * f];
  return [
    [P0, [P0[0] + T0[0], P0[1] + T0[1]], [P1[0] - T1[0], P1[1] - T1[1]], P1],
    [P1, [P1[0] + T1[0], P1[1] + T1[1]], [P2[0] - T2[0], P2[1] - T2[1]], P2],
  ];
}
