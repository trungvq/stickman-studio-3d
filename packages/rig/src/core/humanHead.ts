import type { V3 } from "./lens";

/**
 * Số đo của `head.form: "human"` trong sọ đơn vị (bán kính 1, y lên, z ra trước mặt): đầu chibi. Nửa trên giữ mặt
 * cầu nên tóc và kính dựng khối ôm như đầu cầu; nửa dưới nở ngang về phía đáy và vạt đáy thành cằm chữ U rộng, thu
 * gáy vào cổ. docs/01-rig.md#người-3d-mặc-đồ
 */
/** THỬ (feat/real-head-proto): hai hình hàm, `head.jaw` của nhân vật chọn (số của mặt `western`; `FACES` đè theo kiểu mặt) */
export const JAWS = {
  v: { jaw: 0.04, jawAt: 0.55, chinW: 0.5, drop: 0.14, corner: 0.07, flat: 0.12, squareLow: 2.4 },
  square: { jaw: 0.06, jawAt: 0.62, chinW: 0.6, corner: 0.06, flat: 0.1, squareLow: 3.2 },
} as const;
export type JawKind = keyof typeof JAWS;
/** Hình hàm của nhân vật: một kiểu `JAWS`, hay số 0..1 pha số hàm `v` (0) sang `square` (1) của kiểu mặt */
export type JawShape = JawKind | number;

export const HUMAN_HEAD = {
  /** THỬ (feat/real-head-proto): đầu người thật, mặt góc cạnh. Bề ngang thon nhẹ từ xích đạo tới góc hàm, phần */
  jaw: -0.06,
  /** Đáy kéo xuống, phần: mặt dài */
  drop: 0.18,
  /** Đáy cằm vạt phẳng: đáy cắt ở bấy nhiêu phần dưới đáy đã kéo, góc mềm `corner` */
  flat: 0.1,
  /** Nửa dưới dời ra trước ở đáy: cằm nhô (số của mặt `western`; `FACES` đè cả `chinFront`, `profile`) */
  chin: 0.06,
  /** Gáy thu vào cổ */
  nape: 0.6,
  /** Số mũ siêu elip của sọ: 2 là cầu, lớn hơn là vuông. Sọ trên giữ cầu như đầu chibi để tóc dựng khối ôm như cũ */
  square: 2,
  /** Số mũ cộng thêm về phía đáy: mặt cắt nửa dưới vuông dần, má và hàm thành mặt phẳng */
  squareLow: 2,
  /** Bề ngang so với bề sâu, bề cao */
  narrow: 0.9,
  /** Góc hàm: độ sâu dưới xích đạo (sọ cầu) nơi bề ngang bắt đầu thon thẳng về cằm */
  jawAt: 0.55,
  /** Bề ngang cằm ở đáy, phần bề ngang mặt */
  chinW: 0.52,
  /** Độ mềm của góc hàm, góc cằm (sọ đơn vị) */
  corner: 0.05,
  /** Mặt trước cằm dựng đứng: nửa dưới mặt trước dời ra trước theo lập phương độ sâu */
  chinFront: 0.3,
  /**
   * Quai hàm: đáy cắt phẳng ở cằm (bề sâu `z` từ `front` ra trước) nâng dần lên `rise` ở góc hàm (bề sâu `back` trở ra
   * sau), thành đường chéo từ cằm lên góc hàm dưới tai; sau góc hàm đáy nằm ngang trong ống cổ
   */
  jawLine: { front: 0.45, back: -0.05, rise: 0.4 },
  /**
   * Đáy nửa sau: sau góc hàm đáy không nằm ngang mà hạ dần `drop` (sọ đơn vị) tới bề sâu `to`, gáy sọ cong xuống ôm vào cổ
   * (`HUMAN_NECK_ROWS`) thay vì gờ ngang trên cổ
   */
  napeDrop: { to: -0.75, drop: 0.3 },
  /**
   * Sọ ôm cổ: sau góc hàm (bề sâu từ `jawLine.back` lùi tới `back`) và dưới tai (cao từ `top` xuống `low`) bề ngang thu về
   * `half` (min mềm bậc `p`) — nửa bề ngang đỉnh cổ (`HUMAN_NECK_ROWS` × `humanNeckWidth`) theo sọ đơn vị. Đáy sọ sau góc
   * hàm (`napeDrop`) không chìa ngoài cổ thành gờ chữ ∧ dưới tai khi nhìn ngang mà thon dần vào cổ; quai hàm, cằm, gáy giữa
   * không đổi
   */
  hug: { half: 0.42, p: 4, back: -0.45, nape: [-0.5, -0.75], top: -0.4, low: -0.85 },
  /**
   * Mép đáy sọ sau góc hàm (bề sâu từ `front` lùi tới `back`) bo mềm thêm `round` (cộng vào `corner`) ở hai bên, nhạt về
   * giữa gáy (cos² góc tính từ sau): vách sọ dưới tai cong tròn xuống cổ thay vì gấp thành nếp chéo cùng cổ ra rãnh chữ V
   */
  backRound: { round: 0, front: -0.1, back: -0.35 },
  /** Nửa sau thu bề sâu còn bấy nhiêu phần: tai ngay sau đường giữa đầu, đầu nhìn ngang không dài như trứng nằm */
  backDepth: 0.9,
  /**
   * Gáy: nửa dưới phía sau kéo vĩ độ xuống (`t + pull·t²(1−t)²`, `t` vĩ độ âm theo phần 90°), chân tóc gáy của tóc dựng
   * khối xuống tới ống cổ như đầu chibi thay vì lơ lửng giữa gáy
   */
  napePull: 6,
  /**
   * Đường nghiêng mặt: trán đầy, gờ mày nhô, hốc mắt và sống mũi trên lõm, môi trên, môi dưới nhô, rãnh dưới môi lõm, cằm nhô.
   * Mỗi nét: cao độ (sọ cầu, như nét mặt dán), nửa cao, nửa rộng ngang (sin kinh độ), độ nhô (âm là lõm)
   */
  profile: [
    { y: 0.42, h: 0.18, w: 0.6, out: 0.03 },
    { y: 0.15, h: 0.09, w: 0.6, out: 0.055 },
    { y: -0.04, h: 0.08, w: 0.45, out: -0.055 },
    { y: -0.5, h: 0.06, w: 0.28, out: 0.045 },
    { y: -0.6, h: 0.05, w: 0.26, out: 0.045 },
    { y: -0.66, h: 0.035, w: 0.3, out: -0.05 },
    { y: -0.74, h: 0.055, w: 0.38, out: 0.075 },
  ],
  /** Sống mũi: cao độ tâm (sọ cầu), nửa cao, nửa rộng, độ nhô. THỬ: mũi dựng khối riêng nên sọ không nặn gò mũi */
  nose: { y: -0.3, h: 0.17, w: 0.085, out: 0 },
  /** Tai: cao độ tâm, lệch sau tâm sọ, nửa cao, nửa rộng, độ chìa khỏi má */
  ear: { y: -0.2, z: -0.08, h: 0.24, w: 0.12, out: 0.06 },
} as const;

/**
 * THỬ (feat/real-head-proto): mũi khối riêng của đầu `human` (`noseGeometry` của human.ts), px nét mặt (`FACE_R`, y xuống
 * quanh tâm đầu) và sọ đơn vị; số của mặt `western`, `FACES` đè theo kiểu mặt. Gốc sống mũi `root` px trên hàng mắt; chóp
 * cách gốc `tip` phần khoảng mắt → mồm (nhân `length` của nhân vật), cách mồm ít nhất `gap` px; mặt dưới chóp dài `under`
 * px về nhân trung. Nửa rộng dải đặt mũi `wRoot` ở gốc, `wTip` ở chóp (px, mép dải chìm dưới da), nở theo luỹ thừa `flare`
 * của độ dài tới chóp; độ nhô ở chóp `out` (sọ đơn vị, nhân `out` của nhân vật), cong sống mũi `bow`; mép dải chìm `sink`.
 * Mặt cắt ngang theo `(1 − (u/t)²)^k`, `k` từ `ridge[0]` ở gốc về `ridge[1]` ở chóp (lớn là sống hẹp, nhỏ là tròn bầu),
 * `t` từ `1` ở gốc về `tipW` ở chóp (chóp chỉ chiếm bấy nhiêu phần nửa rộng, phần ngoài để cho cánh mũi). Cánh
 * mũi `ala`: hai gò hai bên chóp ở `u` (phần nửa rộng) nửa rộng `w`, cao `h` phần độ nhô chóp, dọc theo `v` (phần dải gốc →
 * nhân trung) nửa cao `vh`; `h: 0` là không cánh
 */
export const HUMAN_NOSE = {
  root: 1,
  tip: 0.6,
  gap: 9,
  under: 5,
  wRoot: 4,
  wTip: 5.2,
  flare: 1,
  out: 0.2,
  bow: 1.7,
  sink: 0.01,
  ridge: [2.6, 1.8] as readonly [number, number],
  tipW: 1,
  ala: { u: 0.62, w: 0.22, h: 0, v: 0.8, vh: 0.14 },
};
export type NoseNums = typeof HUMAN_NOSE;

/** Số sọ của đầu `human` mà kiểu mặt đè: hằng số `HUMAN_HEAD`, hình hàm `JAWS` */
type Widen<T> = T extends number
  ? number
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : T extends object
      ? { readonly [K in keyof T]: Widen<T[K]> }
      : T;
export type HeadNums = Widen<typeof HUMAN_HEAD>;
type JawNums = Widen<(typeof JAWS)["v"]>;

/** Một kiểu mặt: số đè lên `HUMAN_HEAD` (`head`), lên từng hình hàm `JAWS` (`jaw`), lên `HUMAN_NOSE` (`nose`) */
export interface FacePreset {
  head?: Partial<
    Pick<
      HeadNums,
      | "chin"
      | "chinFront"
      | "profile"
      | "square"
      | "backDepth"
      | "nape"
      | "jawLine"
      | "hug"
      | "napeDrop"
      | "backRound"
    >
  >;
  /** Cổ riêng của kiểu mặt: hàng `[y, nửa rộng, mép sau, mép trước]` như `HUMAN_NECK_ROWS`, chỗ thon nhất bằng `ofHead` bề ngang đầu */
  neck?: { rows: readonly (readonly [number, number, number, number])[]; ofHead: number };
  jaw?: Partial<Record<JawKind, Partial<JawNums>>>;
  nose?: Partial<NoseNums>;
}

/**
 * THỬ (feat/real-head-proto): kiểu mặt của đầu `human` (`head.face`), gói mũi, đường nghiêng mặt và cằm, hàm. `western`
 * là đúng số gốc (`HUMAN_HEAD`, `JAWS`, `HUMAN_NOSE`): mũi cao thon, gờ mày và hốc mắt sâu, cằm nhô trước đường môi.
 * `asian` (mặc định): mũi rộng gấp đôi, chóp tròn bầu có cánh, gốc mũi giữa hai mắt nông và thấp, chóp nhô ít hơn; gờ mày,
 * hốc mắt nhẹ, giữa mặt phẳng; cằm lùi sau đường môi khi nhìn ngang, tròn, rộng hơn nhìn thẳng, nửa dưới mặt đầy hơn.
 * Trường riêng của nhân vật (`head.jaw`, `head.nose`, `head.aspect`, `head.heads`) chồng lên kiểu mặt.
 * docs/01-rig.md#người-3d-mặc-đồ
 */
export const FACES = {
  western: {},
  asian: {
    head: {
      chin: 0.04,
      chinFront: 0.19,
      profile: [
        { y: 0.42, h: 0.18, w: 0.6, out: 0.025 },
        { y: 0.15, h: 0.09, w: 0.6, out: 0.018 },
        { y: -0.04, h: 0.08, w: 0.45, out: -0.018 },
        { y: -0.5, h: 0.06, w: 0.3, out: 0.05 },
        { y: -0.6, h: 0.05, w: 0.28, out: 0.045 },
        { y: -0.66, h: 0.035, w: 0.3, out: -0.025 },
        { y: -0.74, h: 0.07, w: 0.42, out: 0.035 },
      ],
    },
    jaw: {
      v: { jaw: 0.06, chinW: 0.58, corner: 0.1 },
      square: { jaw: 0.08, chinW: 0.66, corner: 0.09 },
    },
    nose: {
      root: -1,
      wRoot: 5,
      wTip: 15,
      flare: 2,
      out: 0.17,
      bow: 2.4,
      ridge: [2.2, 1.3],
      tipW: 0.6,
      ala: { u: 0.72, w: 0.2, h: 0.55, v: 0.8, vh: 0.15 },
    },
  },
  anime: {
    head: {
      chin: 0.107,
      chinFront: 0,
      square: 2.488,
      backDepth: 0.85,
      nape: 0.9,
      napeDrop: { to: -0.75, drop: 0.1 },
      jawLine: { front: 0.477, back: -0.3, rise: 0.45 },
      hug: { half: 0.3, p: 4, back: -0.45, nape: [-0.5, -0.75], top: -0.4, low: -0.85 },
      backRound: { round: 0.6, front: -0.1, back: -0.35 },
      profile: [
        { y: 0.42, h: 0.18, w: 0.6, out: 0.015 },
        { y: 0.15, h: 0.09, w: 0.6, out: 0.01 },
        { y: -0.04, h: 0.08, w: 0.45, out: -0.012 },
        { y: -0.5, h: 0.06, w: 0.3, out: 0.03 },
        { y: -0.6, h: 0.05, w: 0.28, out: 0.025 },
        { y: -0.66, h: 0.035, w: 0.3, out: -0.015 },
        { y: -0.74, h: 0.06, w: 0.3, out: 0.02 },
      ],
    },
    jaw: {
      v: {
        jaw: 0.215,
        jawAt: 0.8,
        chinW: 0.465,
        corner: 0.364,
        flat: 0.267,
        drop: 0.49,
        squareLow: 2.05,
      },
      square: {
        jaw: 0.08,
        jawAt: 0.45,
        chinW: 0.7,
        corner: 0.1,
        flat: 0.1,
        drop: 0.45,
        squareLow: 1.6,
      },
    },
    nose: {
      root: -1,
      wRoot: 3,
      wTip: 6,
      out: 0.1,
      tipW: 0.8,
    },
    neck: {
      rows: [
        [-0.02, 0.215, -0.15, 0.1],
        [0.07, 0.232, -0.165, 0.115],
        [0.13, 0.22, -0.09, 0.113],
        [0.17, 0.18, -0.082, 0.112],
        [0.23, 0.14, -0.08, 0.115],
        [0.29, 0.14, -0.09, 0.118],
        [0.35, 0.145, -0.12, 0.12],
        [0.4, 0.15, -0.165, 0.12],
      ],
      ofHead: 0.36,
    },
  },
} as const satisfies Record<string, FacePreset>;
export type FaceKind = keyof typeof FACES;

/** Dáng đầu `human` của một nhân vật: kiểu mặt và hình hàm */
export interface HeadShape {
  face: FaceKind;
  jaw: JawShape;
}
export const HEAD_SHAPE_DEFAULT: HeadShape = { face: "asian", jaw: "v" };

/** Số sọ của dáng `s`: `HUMAN_HEAD` ← `JAWS[jaw]` ← kiểu mặt (`head`, rồi `jaw` của nó) */
export function headNums(s: HeadShape): HeadNums {
  const F: FacePreset = FACES[s.face];
  if (typeof s.jaw === "string")
    return { ...HUMAN_HEAD, ...JAWS[s.jaw], ...F.head, ...F.jaw?.[s.jaw] };
  const t = Math.max(0, Math.min(1, s.jaw));
  const a = headNums({ face: s.face, jaw: "v" }),
    b = headNums({ face: s.face, jaw: "square" });
  const out: Record<string, unknown> = { ...a };
  for (const k of Object.keys(JAWS.v) as (keyof JawNums)[]) out[k] = (1 - t) * a[k] + t * b[k];
  return out as HeadNums;
}

/** Số mũi của dáng `s`: `HUMAN_NOSE` ← `nose` của kiểu mặt */
export function noseNums(s: HeadShape): NoseNums {
  const F: FacePreset = FACES[s.face];
  return { ...HUMAN_NOSE, ...F.nose };
}

let shapeNow: HeadShape = { ...HEAD_SHAPE_DEFAULT };
let numsNow = headNums(shapeNow);

/**
 * Đặt dáng đầu (kiểu mặt, hình hàm; trường bỏ trống lấy `HEAD_SHAPE_DEFAULT`) cho các lần đọc mặt sọ sau: `humanSkull`,
 * `humanHair`, `humanEar`, `faceSurface`, `humanSkullGlsl`, mũi — dựng người, mốc, đo đầu cùng đặt trước khi đọc. Trả dáng cũ
 */
export function setHeadShape(s: Partial<HeadShape> = {}): HeadShape {
  const old = shapeNow;
  shapeNow = { face: s.face ?? HEAD_SHAPE_DEFAULT.face, jaw: s.jaw ?? HEAD_SHAPE_DEFAULT.jaw };
  if (shapeNow.face !== old.face || shapeNow.jaw !== old.jaw) numsNow = headNums(shapeNow);
  return old;
}

/** Dáng đầu đang đặt */
export const headShape = (): HeadShape => shapeNow;

/** Chạy `fn` với dáng đầu `s` rồi trả dáng cũ */
export function withHeadShape<T>(s: Partial<HeadShape> | undefined, fn: () => T): T {
  const old = setHeadShape(s);
  try {
    return fn();
  } finally {
    setHeadShape(old);
  }
}

/** Mức min mềm của `max(−v, 0)`: gáy thu vào trơn, không gãy ở hai bên má */
const back = (v: number) => (Math.sqrt(v * v + 0.04) - v) / 2;
const smooth01 = (a: number, b: number, v: number) => {
  const u = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

/** Hướng `p` trên cầu đơn vị kéo vĩ độ nửa dưới phía sau xuống (`HUMAN_HEAD.napePull`) */
function napeWarp([x, y, z]: V3, pull: number): V3 {
  const wb = smooth01(-0.15, -0.65, z);
  if (y >= 0 || wb === 0) return [x, y, z];
  const t = Math.asin(Math.min(1, -y)) / (Math.PI / 2);
  const t1 = t + pull * wb * t * t * (1 - t) * (1 - t);
  const y1 = -Math.sin((t1 * Math.PI) / 2);
  const h0 = Math.hypot(x, z);
  if (h0 < 1e-9) return [x, y1, z];
  const k = Math.sqrt(Math.max(0, 1 - y1 * y1)) / h0;
  return [x * k, y1, z * k];
}

/**
 * Điểm trên đầu `human` ứng với điểm `p` của mặt cầu đơn vị: gáy kéo xuống, đẩy về siêu elip (vuông), bóp ngang, rồi
 * nửa dưới kéo dài thành mặt, quai hàm thon về cằm, đáy cắt theo quai hàm chéo lên góc hàm, gáy thu vào cổ, nửa sau
 * thu bề sâu; mặt trước theo đường nghiêng của người (gờ mày, hốc mắt, môi, cằm).
 */
export function humanSkull(p: V3): V3 {
  const H = numsNow;
  const [x, y, z] = napeWarp(p, H.napePull);
  const s0 = Math.max(0, -y);
  const n = H.square + H.squareLow * s0 * s0;
  const q = Math.pow(Math.abs(x) ** n + Math.abs(y) ** n + Math.abs(z) ** n, 1 / n) || 1;
  const X = x / q,
    Y = y / q,
    Z = z / q;
  const s = Math.max(0, -Y);
  const s2 = s * s;
  const e = H.corner;
  // thon thẳng từ góc hàm về cằm, góc mềm `e`
  const ramp = (u: number) => (u + Math.sqrt(u * u + e * e)) / 2;
  const w1 = 1 + H.jaw * H.jawAt * H.jawAt;
  const k = (w1 + H.jaw * (1 - H.jawAt * H.jawAt) - H.chinW) / (1 - H.jawAt);
  const w = 1 + H.jaw * s2 - k * ramp(s - H.jawAt);
  // đáy cắt theo quai hàm: phẳng dưới cằm, chéo lên góc hàm, góc mềm `e`
  const J = H.jawLine;
  const y1 = Y * (1 + H.drop * s2);
  const bottom =
    -(1 + H.drop) * (1 - H.flat) +
    J.rise * smooth01(J.front, J.back, Z) -
    H.napeDrop.drop * smooth01(J.back, H.napeDrop.to, Z);
  const lat = X * X + Z * Z > 1e-9 ? (X * X) / (X * X + Z * Z) : 0;
  const eb = e + H.backRound.round * lat * smooth01(H.backRound.front, H.backRound.back, Z);
  const yb = (y1 + bottom + Math.sqrt((y1 - bottom) ** 2 + eb * eb)) / 2;
  const front = Math.max(0, z);
  // đường nghiêng mặt: các nét theo cao độ của cầu gốc như nét mặt dán (`faceSurface`), nên mắt, miệng nằm đúng nét
  // trọng số: mặt quay ra trước (cos kinh độ bình phương), nét ngang theo sin kinh độ
  const hz = Math.hypot(p[0], p[2]);
  const fw = hz > 1e-9 ? (Math.max(0, p[2]) / hz) ** 2 : 0,
    lon = hz > 1e-9 ? p[0] / hz : 0;
  let relief = 0;
  for (const f of H.profile)
    relief += f.out * Math.exp(-((lon / f.w) ** 2) - ((p[1] - f.y) / f.h) ** 2);
  const N = H.nose;
  const bump = N.out * front * front * Math.exp(-((p[0] / N.w) ** 2) - ((p[1] - N.y) / N.h) ** 2);
  const Zd =
    Z + s2 * (H.chin + H.nape * back(Z)) + H.chinFront * front * s2 * s + fw * relief + bump;
  // sọ ôm cổ sau góc hàm, dưới tai
  const G = H.hug,
    xo = X * H.narrow * w,
    ax = Math.abs(xo);
  const wh =
    smooth01(J.back, G.back, Z) * smooth01(G.nape[1], G.nape[0], Z) * smooth01(G.top, G.low, yb);
  const hx = ax + ((ax * G.half) / Math.pow(ax ** G.p + G.half ** G.p, 1 / G.p) - ax) * wh;
  return [Math.sign(xo) * hx, yb, Zd + (1 - H.backDepth) * back(Zd)];
}

/**
 * `humanSkull` viết bằng GLSL cho dáng đầu `shape` (mặc định dáng đang đặt; số chép từ `headNums`): hàm `vec3 humanSkull(vec3 p)`
 * cho shader cần mặt đầu (`earMaterial`). Đổi `humanSkull` thì đổi theo ở đây
 */
export function humanSkullGlsl(shape: HeadShape = shapeNow): string {
  const H = headNums(shape);
  const f = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
  const J = H.jawLine,
    N = H.nose,
    ND = H.napeDrop,
    BR = H.backRound,
    G = H.hug;
  const relief = H.profile
    .map((r) => `${f(r.out)} * exp(-hsSq(lon / ${f(r.w)}) - hsSq((p.y - ${f(r.y)}) / ${f(r.h)}))`)
    .join(" + ");
  return /* glsl */ `
      float hsBack(float v){ return (sqrt(v * v + 0.04) - v) / 2.0; }
      float hsSq(float v){ return v * v; }
      // smoothstep cho cả a > b như smooth01 (smoothstep của GLSL không định nghĩa khi a ≥ b)
      float hsStep(float a, float b, float v){ float u = clamp((v - a) / (b - a), 0.0, 1.0); return u * u * (3.0 - 2.0 * u); }
      vec3 humanSkull(vec3 p){
        vec3 a = p;
        float wb = hsStep(-0.15, -0.65, a.z);
        if (a.y < 0.0 && wb > 0.0) {
          float t = asin(min(1.0, -a.y)) / 1.5707963;
          float t1 = t + ${f(H.napePull)} * wb * t * t * (1.0 - t) * (1.0 - t);
          float y1 = -sin(t1 * 1.5707963), h0 = length(a.xz);
          if (h0 > 1e-9) a.xz *= sqrt(max(0.0, 1.0 - y1 * y1)) / h0;
          a.y = y1;
        }
        float s0 = max(0.0, -a.y), n = ${f(H.square)} + ${f(H.squareLow)} * s0 * s0;
        float q = pow(pow(abs(a.x), n) + pow(abs(a.y), n) + pow(abs(a.z), n), 1.0 / n);
        vec3 b = a / max(q, 1e-9);
        float s = max(0.0, -b.y), s2 = s * s, e = ${f(H.corner)};
        float w1 = 1.0 + ${f(H.jaw)} * ${f(H.jawAt * H.jawAt)};
        float k = (w1 + ${f(H.jaw)} * ${f(1 - H.jawAt * H.jawAt)} - ${f(H.chinW)}) / ${f(1 - H.jawAt)};
        float u = s - ${f(H.jawAt)};
        float w = 1.0 + ${f(H.jaw)} * s2 - k * (u + sqrt(u * u + e * e)) / 2.0;
        float y1 = b.y * (1.0 + ${f(H.drop)} * s2);
        float bottom = ${f(-(1 + H.drop) * (1 - H.flat))} + ${f(J.rise)} * hsStep(${f(J.front)}, ${f(J.back)}, b.z) - ${f(ND.drop)} * hsStep(${f(J.back)}, ${f(ND.to)}, b.z);
        float lat = dot(b.xz, b.xz) > 1e-9 ? b.x * b.x / dot(b.xz, b.xz) : 0.0;
        float eb = e + ${f(BR.round)} * lat * hsStep(${f(BR.front)}, ${f(BR.back)}, b.z);
        float yb = (y1 + bottom + sqrt((y1 - bottom) * (y1 - bottom) + eb * eb)) / 2.0;
        float front = max(0.0, a.z), hz = length(p.xz);
        float fw = hz > 1e-9 ? pow(max(0.0, p.z) / hz, 2.0) : 0.0, lon = hz > 1e-9 ? p.x / hz : 0.0;
        float relief = ${relief};
        float bump = ${f(N.out)} * front * front * exp(-hsSq(p.x / ${f(N.w)}) - hsSq((p.y - ${f(N.y)}) / ${f(N.h)}));
        float zd = b.z + s2 * (${f(H.chin)} + ${f(H.nape)} * hsBack(b.z)) + ${f(H.chinFront)} * front * s2 * s + fw * relief + bump;
        float xo = b.x * ${f(H.narrow)} * w, ax = abs(xo);
        float wh = hsStep(${f(J.back)}, ${f(G.back)}, b.z) * hsStep(${f(G.nape[1])}, ${f(G.nape[0])}, b.z) * hsStep(${f(G.top)}, ${f(G.low)}, yb);
        float hx = ax + (ax * ${f(G.half)} / pow(pow(ax, ${f(G.p)}) + ${f(G.half ** G.p)}, ${f(1 / G.p)}) - ax) * wh;
        return vec3(sign(xo) * hx, yb, zd + ${f(1 - H.backDepth)} * hsBack(zd));
      }`;
}

/**
 * Điểm `p` của lớp bám sọ (tóc dựng khối, sọ đơn vị) dời theo đúng độ dời của điểm sọ bên dưới nó: tóc giữ bề dày
 * trên đầu `human`, gáy thu vào thì tóc gáy thu theo.
 */
export function humanHair([x, y, z]: V3): V3 {
  const r = Math.hypot(x, y, z) || 1;
  const d: V3 = [x / r, y / r, z / r];
  const h = humanSkull(d);
  return [x + h[0] - d[0], y + h[1] - d[1], z + h[2] - d[2]];
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
