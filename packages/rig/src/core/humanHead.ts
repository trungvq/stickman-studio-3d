import type { V3 } from "./lens";

/**
 * Số đo của `head.form: "human"` trong sọ đơn vị (bán kính 1, y lên, z ra trước mặt): đầu chibi. Nửa trên giữ mặt
 * cầu nên tóc và kính dựng khối ôm như đầu cầu; nửa dưới nở ngang về phía đáy và vạt đáy thành cằm chữ U rộng, thu
 * gáy vào cổ. docs/01-rig.md#người-3d-mặc-đồ
 */
/** THỬ (feat/real-head-proto): hai hình hàm, `head.jaw` của nhân vật chọn; nhân vật đang dựng đặt bằng `setJaw` */
export const JAWS = {
  v: { jaw: -0.04, jawAt: 0.18, chinW: 0.4, corner: 0.06, flat: 0.12, squareLow: 1 },
  square: { jaw: -0.06, jawAt: 0.55, chinW: 0.52, corner: 0.05, flat: 0.1, squareLow: 2 },
} as const;
export type JawKind = keyof typeof JAWS;
let jawNow: JawKind = 'v';
/** Đặt hình hàm cho các lần gọi `humanSkull` sau; trả hình hàm cũ */
export function setJaw(k: JawKind): JawKind {
  const old = jawNow;
  jawNow = k;
  return old;
}

export const HUMAN_HEAD = {
  /** THỬ (feat/real-head-proto): đầu người thật, mặt góc cạnh. Bề ngang thon nhẹ từ xích đạo tới góc hàm, phần */
  jaw: -0.06,
  /** Đáy kéo xuống, phần: mặt dài */
  drop: 0.22,
  /** Đáy cằm vạt phẳng: đáy cắt ở bấy nhiêu phần dưới đáy đã kéo, góc mềm `corner` */
  flat: 0.1,
  /** Nửa dưới dời ra trước ở đáy: cằm nhô */
  chin: 0.06,
  /** Gáy thu vào cổ */
  nape: 0.6,
  /** Số mũ siêu elip của sọ: 2 là cầu, lớn hơn là vuông */
  square: 2.5,
  /** Số mũ cộng thêm về phía đáy: mặt cắt nửa dưới vuông dần, má và hàm thành mặt phẳng */
  squareLow: 2,
  /** Bề ngang so với bề sâu, bề cao */
  narrow: 0.87,
  /** Góc hàm: độ sâu dưới xích đạo (sọ cầu) nơi bề ngang bắt đầu thon thẳng về cằm */
  jawAt: 0.55,
  /** Bề ngang cằm ở đáy, phần bề ngang mặt */
  chinW: 0.52,
  /** Độ mềm của góc hàm, góc cằm (sọ đơn vị) */
  corner: 0.05,
  /** Mặt trước cằm dựng đứng: nửa dưới mặt trước dời ra trước theo lập phương độ sâu */
  chinFront: 0.3,
  /** Sống mũi: cao độ tâm (sọ cầu), nửa cao, nửa rộng, độ nhô */
  nose: { y: -0.3, h: 0.17, w: 0.085, out: 0.16 },
  /** Tai: cao độ tâm, lệch sau tâm sọ, nửa cao, nửa rộng, độ chìa khỏi má */
  ear: { y: -0.2, z: -0.08, h: 0.24, w: 0.12, out: 0.06 },
} as const;

/** Mức min mềm của `max(−v, 0)`: gáy thu vào trơn, không gãy ở hai bên má */
const back = (v: number) => (Math.sqrt(v * v + 0.04) - v) / 2;

/**
 * Điểm trên đầu `human` ứng với điểm `p` của mặt cầu đơn vị: đẩy về siêu elip (vuông), bóp ngang, rồi nửa dưới kéo dài
 * thành mặt, quai hàm thon về cằm vạt phẳng nhô ra trước, gáy thu vào cổ; thêm sống mũi ở mặt trước.
 */
export function humanSkull([x, y, z]: V3): V3 {
  const H = { ...HUMAN_HEAD, ...JAWS[jawNow] };
  const s0 = Math.max(0, -y);
  const n = H.square + H.squareLow * s0 * s0;
  const q = Math.pow(Math.abs(x) ** n + Math.abs(y) ** n + Math.abs(z) ** n, 1 / n) || 1;
  const X = x / q, Y = y / q, Z = z / q;
  const s = Math.max(0, -Y);
  const s2 = s * s;
  const e = H.corner;
  // thon thẳng từ góc hàm về cằm, góc mềm `e`
  const ramp = (u: number) => (u + Math.sqrt(u * u + e * e)) / 2;
  const w1 = 1 + H.jaw * H.jawAt * H.jawAt;
  const k = (w1 + H.jaw * (1 - H.jawAt * H.jawAt) - H.chinW) / (1 - H.jawAt);
  const w = 1 + H.jaw * s2 - k * ramp(s - H.jawAt);
  // đáy cằm cắt phẳng, góc mềm `e`
  const y1 = Y * (1 + H.drop * s2), bottom = -(1 + H.drop) * (1 - H.flat);
  const yb = (y1 + bottom + Math.sqrt((y1 - bottom) ** 2 + e * e)) / 2;
  const N = H.nose;
  const front = Math.max(0, z);
  const bump = N.out * front * front * Math.exp(-((x / N.w) ** 2) - ((y - N.y) / N.h) ** 2);
  return [
    X * H.narrow * w,
    yb,
    Z + s2 * (H.chin + H.nape * back(Z)) + H.chinFront * front * s2 * s + bump,
  ];
}

/**
 * Điểm `p` của lớp bám sọ (tóc dựng khối, sọ đơn vị) dời theo đúng độ dời của điểm sọ bên dưới nó: tóc giữ bề dày
 * trên đầu `human`, gáy thu vào thì tóc gáy thu theo.
 */
export function humanHair([x, y, z]: V3): V3 {
  const r = Math.hypot(x, y, z) || 1;
  const d: V3 = [x / r, y / r, z / r];
  const h = humanSkull(d);
  return [h[0] * r, h[1] * r, h[2] * r];
}

/** Tâm tai bên `side` (`-1` bên phải người, −x) trên đầu `human`, sọ đơn vị */
export function humanEar(side: -1 | 1): V3 {
  const { y, z } = HUMAN_HEAD.ear;
  const x = Math.sqrt(Math.max(0, 1 - y * y - z * z));
  return humanSkull([side * x, y, z]);
}

/** Bán kính đầu theo px của nét mặt (`core/face.ts`): px nét mặt đổi ra sọ bán kính `r` theo `r / FACE_R` */
export const FACE_R = 65;

/** Khối sọ người 3D bóp theo ba trục, nhân bán kính `BONES3.head`: lưới sọ, nét mặt, tai và mốc trên đầu cùng đọc */
export const SKULL3: V3 = [1, 1.04, 0.98];

/**
 * Điểm px `(px, py)` của nét mặt (x ngang, y xuống, quanh tâm đầu) trên mặt trước sọ bán kính `r`, trước khi bóp `SKULL3`:
 * phép chiếu thẳng lên mặt cầu, đầu `human` đi tiếp qua `humanSkull`. Lưới nét mặt của người 3D dựng bằng chính nó
 */
export function faceSurface(px: number, py: number, r: number, human: boolean): V3 {
  const k = r / FACE_R;
  let x = px * k;
  let y = -py * k;
  const d = Math.hypot(x, y);
  const lim = r * 0.995;
  if (d > lim) [x, y] = [(x * lim) / d, (y * lim) / d];
  const z = Math.sqrt(Math.max(r * r - x * x - y * y, 0));
  return human ? (humanSkull([x / r, y / r, z / r]).map((v) => v * r) as V3) : [x, y, z];
}
