import { RIG, RIG_PER_METRE } from "./constants";
import { humanSkull, SKULL3, withHeadShape, type FaceKind, type JawShape } from "./humanHead";
import type { V3 } from "./lens";

/**
 * Chiều cao người và cỡ đầu của người 3D, đơn vị three (một đơn vị là 100 px rig). Người đứng: sàn → khớp hông là
 * `LIMB3` + đùi + ống chân; khớp hông → khớp cổ là thân + cổ (`rig.height`); khớp cổ → mép cổ áo `COLLAR3`; đầu `human`
 * thêm cổ họng lộ (`THROAT` chiều cao đầu) rồi tới cằm và đỉnh sọ. docs/01-rig.md#chiều-cao-và-cỡ-đầu
 */

/** Bán kính khối sọ gốc (lưới đầu dựng ở cỡ này rồi phóng theo `HeadDims.k`) */
export const HEAD3_R = 0.384;
/** Bề dày nửa nét chi người que: khớp hông người đứng cao hơn bàn chân ngần này */
export const LIMB3 = 0.042;
/**
 * Bán kính chi người 3D mặc đồ (`palette.clad`) ở gốc, khớp giữa, ngọn, nhân bán kính chi: bắp tay to hơn cẳng tay
 * như đùi với ống chân. Cổ tay `0,53`: bề ngang cổ tay chừng `0,75` bề ngang lòng bàn tay (`cladHand`), dày hơn lòng tay
 * chừng `1,2` lần
 */
export const CLAD_TAPER = {
  arm: [1.12, 0.88, 0.53],
  leg: [1.35, 0.9, 0.74],
} as const;
/** Đáy sọ trên khớp cổ của lõi ngần này (mép cổ áo áo phông) */
export const COLLAR3 = 0.09;
/** Số đầu của người đầu `human` (chiều cao gót → đỉnh sọ chia chiều cao đầu cằm → đỉnh sọ): mặc định, khoảng kẹp */
export const HEADS = { def: 6, min: 5.5, max: 7 } as const;
/** Bề ngang đầu `human` chia chiều cao đầu: mặc định, khoảng kẹp */
export const HEAD_ASPECT = { def: 0.76, min: 0.71, max: 0.81 } as const;
/** Bề sâu đầu `human` (trán → gáy, không mũi) chia chiều cao đầu ở `HEAD_ASPECT.def`; bề ngang lệch bao nhiêu thì bề sâu lệch nửa */
export const HEAD_DEPTH = 0.86;
/** Cổ họng lộ giữa mép cổ áo và cằm, phần chiều cao đầu */
export const THROAT = 0.1;
/**
 * Bề ngang chỗ thon nhất của cổ `human`, phần bề ngang đầu. Đầu sáu đầu vẫn to hơn đầu thật chừng 1,3 lần nên hệ số
 * thấp hơn tỉ lệ người thật (~0,75): người `1,80 m` cổ ~12 cm, nữ `1,60 m` ~11 cm, cổ thon hơn quai hàm rõ từ chính diện
 */
export const NECK_OF_HEAD = 0.54;

/** Thân, cổ, đùi, ống chân ở `rig.height = 1`, three */
const BODY_K = (RIG.torso + RIG.neck + RIG.thigh + RIG.shin) / 100;
/** Một mét, three */
const METRE = RIG_PER_METRE / 100;

/** Phần đầu của JSON nhân vật mà cỡ đầu đọc */
export interface HeadSpec {
  form?: "sphere" | "human";
  heads?: number;
  aspect?: number;
  jaw?: JawShape;
  face?: FaceKind;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Sọ `human` đơn vị của một dáng đầu (kiểu mặt, hình hàm): cằm dưới tâm, nửa ngang, bề sâu (gáy → mặt) */
const units = new Map<string, { chin: number; half: number; depth: number }>();
function skullUnits(head: HeadSpec) {
  const shape = { face: head.face, jaw: head.jaw };
  const key = `${shape.face ?? ""}/${shape.jaw ?? ""}`;
  let u = units.get(key);
  if (u) return u;
  let [chin, half, back, front] = [0, 0, 0, 0];
  withHeadShape(shape, () => {
    const n = 96;
    for (let i = 0; i <= n; i++)
      for (let j = 0; j < 2 * n; j++) {
        const th = (Math.PI * i) / n,
          ph = (Math.PI * j) / n;
        const p = humanSkull([
          Math.sin(th) * Math.cos(ph),
          Math.cos(th),
          Math.sin(th) * Math.sin(ph),
        ]);
        chin = Math.max(chin, -p[1]);
        half = Math.max(half, Math.abs(p[0]));
        back = Math.max(back, -p[2]);
        front = Math.max(front, p[2]);
      }
  });
  units.set(key, (u = { chin, half, depth: back + front }));
  return u;
}

/** Cỡ đầu của một người 3D, three */
export interface HeadDims {
  human: boolean;
  /** Chiều cao đầu, cằm → đỉnh sọ */
  height: number;
  /** Bề ngang đầu */
  width: number;
  /** Nhân lưới đầu gốc (`HEAD3_R`, `SKULL3`) theo ba trục: sọ, nét mặt, tóc, mũ, kính, tai, mũi cùng phóng */
  k: V3;
  /** Bán kính ba trục của khối sọ: `HEAD3_R · SKULL3 · k` */
  skull: V3;
  /** Tâm khối sọ trên khớp cổ của lõi (gốc nhóm cổ) */
  up: number;
  /** Cổ họng lộ giữa mép cổ áo và cằm */
  throat: number;
  /** Chiều cao người gót → đỉnh sọ, mét */
  stature: number;
}

/** Sàn → mép cổ áo của người đứng ở `rig.height` */
const collarAt = (height: number) => LIMB3 + BODY_K * height + COLLAR3;

/** Cỡ đầu ở `rig.height` theo `head` của JSON nhân vật: đầu cầu giữ cỡ gốc, đầu `human` theo số đầu */
export function headDims(height: number, head: HeadSpec = {}): HeadDims {
  const neck = (RIG.neck * height) / 100;
  if (head.form !== "human") {
    const R = HEAD3_R;
    return {
      human: false,
      height: 2 * SKULL3[1] * R,
      width: 2 * R,
      k: [1, 1, 1],
      skull: [R * SKULL3[0], R * SKULL3[1], R * SKULL3[2]],
      up: neck + COLLAR3 + R * SKULL3[1],
      throat: 0,
      stature: (collarAt(height) + 2 * SKULL3[1] * R) / METRE,
    };
  }
  const n = clamp(head.heads ?? HEADS.def, HEADS.min, HEADS.max);
  const a = clamp(head.aspect ?? HEAD_ASPECT.def, HEAD_ASPECT.min, HEAD_ASPECT.max);
  const u = skullUnits(head);
  const R = HEAD3_R;
  // người cao n đầu: sàn → cổ áo + cổ họng + đầu = n đầu
  const h = collarAt(height) / (n - 1 - THROAT);
  const h0 = (1 + u.chin) * SKULL3[1] * R;
  const ky = h / h0;
  const kx = (a * h) / (2 * u.half * SKULL3[0] * R);
  const d = HEAD_DEPTH + (a - HEAD_ASPECT.def) / 2;
  const kz = (d * h) / (u.depth * SKULL3[2] * R);
  const throat = THROAT * h;
  return {
    human: true,
    height: h,
    width: a * h,
    k: [kx, ky, kz],
    skull: [R * SKULL3[0] * kx, R * SKULL3[1] * ky, R * SKULL3[2] * kz],
    up: neck + COLLAR3 + throat + u.chin * SKULL3[1] * R * ky,
    throat,
    stature: (n * h) / METRE,
  };
}

/** `rig.height` cho người cao `stature` mét (gót → đỉnh sọ) với đầu `head`: phần dưới cổ áo co giãn, đầu theo số đầu */
export function heightOfStature(stature: number, head: HeadSpec = {}): number {
  const st = stature * METRE;
  const below =
    head.form === "human"
      ? st - (st / clamp(head.heads ?? HEADS.def, HEADS.min, HEADS.max)) * (1 + THROAT)
      : st - 2 * SKULL3[1] * HEAD3_R;
  return (below - LIMB3 - COLLAR3) / BODY_K;
}
