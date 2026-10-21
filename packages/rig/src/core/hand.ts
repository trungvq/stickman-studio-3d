import { add3, matMul, matVec, rotX, rotY, rotZ, type M3, type V3 } from "./lens";
import type { AimDirJson } from "./bodyMark";

/**
 * Bàn tay của người 3D mặc đồ: lòng bàn tay và năm ngón — ngón cái, trỏ, giữa, áp út, út — mỗi ngón hai đốt trên khớp;
 * mặt da liền ở `handMesh.ts`. Dáng tay là góc khớp, nên hoà hai dáng là hoà góc. Hệ khung bàn tay (three): −y dọc bàn
 * tay ra ngoài, lòng bàn tay quay về `p · x` với `p = −side` (về phía thân khi tay buông), ngón cái về +z.
 * docs/01-rig.md#bàn-tay
 */

/**
 * Góc ngón, độ: ngón cái `[dạng, đối, gập gốc, gập ngọn]`, trỏ `[gập gốc, gập ngọn]`, `fingers` chung cho giữa, áp út, út
 * (`HAND_FINGERS` cộng độ lệch từng ngón), `spread` độ xoè: trỏ tách ra, áp út và út toả theo; `thumbRoll` xoay ngón cái
 * quanh trục đốt gốc (`THUMB_ROLL`), bỏ trống là `0`
 */
export interface Fingers {
  thumb: readonly [number, number, number, number];
  index: readonly [number, number];
  fingers: readonly [number, number];
  spread: number;
  thumbRoll?: number;
}

/**
 * Tầm xoay ngón cái quanh trục đốt gốc, độ: dương là sấp (đệm ngón cái quay về phía các ngón), âm là ngửa.
 * docs/01-rig.md#bàn-tay
 */
export const THUMB_ROLL = [-15, 45] as const;

/** Dáng nghỉ: ngón cong nhẹ, ngón cái khép sát ngón trỏ — bàn tay không ai đặt dáng, và gốc mà `w` hoà từ đó. Không soạn được */
export const HAND_RELAXED: Fingers = {
  thumb: [11, 16, 4, 8],
  index: [8, 10],
  fingers: [10, 14],
  spread: 2,
};

/** Dáng tay soạn được. Thêm một dáng là thêm một dòng; `HandPose` và `HAND_POSE_KINDS` lấy từ khoá của bảng */
export const HAND_POSES = {
  open: { thumb: [40, 12, 0, 0], index: [0, 0], fingers: [0, 0], spread: 6 },
  grip: { thumb: [50, 61, -4, 15], index: [45, 80], fingers: [50, 80], spread: 0 },
  point: { thumb: [37, 78, 29, 31], index: [0, 0], fingers: [90, 100], spread: 0 },
  fist: { thumb: [16, 85, 29, 30], index: [90, 85], fingers: [90, 85], spread: 0 },
  cup: { thumb: [11, 15, 4, 4], index: [4, 6], fingers: [6, 8], spread: 1 },
  pinch: { thumb: [46, 46, 6, 22], index: [45, 35], fingers: [70, 70], spread: 0 },
  clasp: { thumb: [62, 55, 18, 22], index: [52, 62], fingers: [58, 66], spread: 0 },
  flat: { thumb: [16, 3, 0, 0], index: [-4, -2], fingers: [-4, -2], spread: 1 },
  hook: { thumb: [14, 18, 4, 8], index: [28, 96], fingers: [32, 100], spread: 0 },
  edge: { thumb: [72, 29, 5, 5], index: [10, 6], fingers: [12, 8], spread: 1 },
  span: { thumb: [71, 6, 0, 44], index: [3, 20], fingers: [3, 21], spread: 0 },
  sheet: { thumb: [12, 40, 16, 20], index: [40, 0], fingers: [43, 2], spread: 0 },
  thumbsUp: { thumb: [80, 4, 0, 0], index: [90, 85], fingers: [90, 85], spread: 0 },
  tripod: { thumb: [28, 45, 0, 0], index: [40, 40], fingers: [48, 76], spread: 0 },
  chopsticks: { thumb: [36, 52, 6, 0], index: [50, 35], fingers: [45, 50], spread: 2 },
  card: { thumb: [48, 75, -20, 0], index: [28, 110], fingers: [90, 40], spread: 0, thumbRoll: 45 },
  cupPinch: {
    thumb: [60, 103, -8, -15],
    index: [32, 25],
    fingers: [45, 12],
    spread: 0,
    thumbRoll: 45,
  },
} as const satisfies Record<string, Fingers>;

export type HandPose = keyof typeof HAND_POSES;
export const HAND_POSE_KINDS = Object.keys(HAND_POSES) as [HandPose, ...HandPose[]];

export const HAND_POSE_LABELS: Record<HandPose, string> = {
  open: "xoè",
  grip: "cầm",
  point: "chỉ tay",
  fist: "nắm đấm",
  cup: "khum",
  pinch: "kẹp",
  clasp: "nắm cổ tay",
  flat: "đặt phẳng",
  hook: "móc",
  edge: "kẹp cạnh",
  span: "ôm hai cạnh",
  sheet: "kẹp tờ",
  thumbsUp: "giơ ngón cái",
  tripod: "cầm bút",
  chopsticks: "cầm đũa",
  card: "kẹp thẻ",
  cupPinch: "kẹp chén",
};

/**
 * Tâm nắm của từng dáng trong khung bàn tay cỡ `1`, như `HAND_BONES.grip` (x về phía lòng tay, y dọc bàn tay, z về phía
 * ngón cái): chỗ đồ cầm ngồi khi tay giữ dáng ấy. `grip` là chỗ treo đồ (`handGrip`); dáng khác dời đồ từ đó
 * (`gripShift`). `rest` là dáng nghỉ
 */
export const HAND_GRIPS: Record<HandPose | "rest", V3> = {
  rest: [0.035, -0.11, 0.01],
  open: [0.03, -0.13, 0.01],
  grip: [0.04, -0.088, 0],
  point: [0.036, -0.09, 0.004],
  fist: [0.03, -0.085, 0],
  cup: [0.036, -0.11, 0.01],
  pinch: [0.07, -0.106, 0.072],
  clasp: [0.046, -0.105, 0.008],
  flat: [0.03, -0.12, 0],
  hook: [0.036, -0.124, 0],
  edge: [0.045, -0.1, 0.035],
  span: [0.035, -0.117, 0.027],
  sheet: [0.031, -0.112, 0.013],
  thumbsUp: [0.03, -0.085, 0],
  tripod: [0.063, -0.104, 0.033],
  // trùng `pinch`: khung `chopsticks` dựng từ fixture dáng `pinch` (`graspSolve.ts`)
  chopsticks: [0.07, -0.106, 0.072],
  // giữa bề dày thẻ dưới đệm ngón cái, thẻ đè lên sườn ngón trỏ (`card` `lateral`, `CARD_TILT`)
  card: [0.053, -0.1, 0.042],
  // trục chén giữa đệm ngón cái và đệm trỏ – giữa, ngang tầm đệm (`bowl` `pinch`)
  cupPinch: [0.063, -0.121, 0.024],
};

/**
 * Số của một bàn tay, theo thứ tự này: xoay cẳng tay (`turn`, dương là sấp — lòng tay úp khi cẳng tay chĩa ra trước),
 * gập cổ tay (`bend`, dương về phía lòng tay), rồi mười góc ngón của `Fingers` (`thumbRoll` cuối)
 */
export const HAND_DOF = [
  "turn",
  "bend",
  "thumbAbd",
  "thumbOpp",
  "thumbBase",
  "thumbTip",
  "indexBase",
  "indexTip",
  "fingersBase",
  "fingersTip",
  "spread",
  "thumbRoll",
] as const;
const ROLL = HAND_DOF.indexOf("thumbRoll");

export type HandVec = readonly number[];

/**
 * Đốt nhận độ gập thêm của ngón ôm theo đồ (`heldFit`), theo thứ tự này: số thứ `HAND_DOF.length + i` của một `HandVec`
 * (bỏ trống là `0`) cộng vào góc gập ở gốc đốt ấy, độ. Hai đốt mỗi ngón: cái, trỏ, giữa, áp út, út
 */
export const HAND_FIT = [
  "thumb0",
  "thumb1",
  "index0",
  "index1",
  "middle0",
  "middle1",
  "ring0",
  "ring1",
  "pinky0",
  "pinky1",
] as const;

export const fingerVec = (f: Fingers): number[] => [
  ...f.thumb,
  ...f.index,
  ...f.fingers,
  f.spread,
  f.thumbRoll ?? 0,
];

/** Bàn tay không ai ghi: cẳng tay trung tính (lòng tay quay vào thân), cổ tay thẳng, ngón thả lỏng */
export const HAND_REST: HandVec = [0, 0, ...fingerVec(HAND_RELAXED)];

/**
 * Một mốc bàn tay trong JSON: tên dáng, hay dáng `pose` (bỏ trống là dáng nghỉ) với phần `w`, xoay và gập cổ tay; hay
 * hướng lòng tay (`palm`) và ngón (`fingers`) theo ý định — rig giải ra xoay và gập, `turn` khi ấy bị bỏ qua
 */
export interface HandKey {
  pose?: HandPose;
  w?: number;
  turn?: number;
  bend?: number;
  palm?: AimDirJson;
  fingers?: AimDirJson;
}

export const mixHand = (a: HandVec, b: HandVec, f: number): number[] =>
  a.map((v, i) => v + ((b[i] ?? 0) - v) * f);

/** Số bàn tay của một mốc: dáng hoà từ dáng nghỉ theo `w`; không có dáng là dáng nghỉ */
export function handVec(k: HandPose | HandKey): number[] {
  const o: HandKey = typeof k === "string" ? { pose: k } : k;
  const rest = fingerVec(HAND_RELAXED);
  const fingers = o.pose ? mixHand(rest, fingerVec(HAND_POSES[o.pose]), o.w ?? 1) : rest;
  return [o.turn ?? 0, o.bend ?? 0, ...fingers];
}

/**
 * Số đo bàn tay cỡ `1`, đơn vị three: lòng bàn tay dài `palm`, nửa dày, nửa rộng `half`; ngón cái, ngón trỏ gốc `at` (x
 * nhân `p`), hai đốt `len`, bán kính `r`; `fingers` gốc và hai đốt chung của ba ngón còn lại (`HAND_FINGERS`); `grip` tâm
 * nắm của dáng `grip` — chỗ treo đồ cầm. Bề ngang (x, z) nhân cỡ `k`, chiều dọc (y) nhân `long` của `cladHand`.
 */
export const HAND_BONES = {
  palm: { len: 0.101, half: [0.026, 0.042] as const },
  thumb: { at: [0.019, -0.033, 0.03] as V3, len: [0.048, 0.04] as const, r: 0.017 },
  index: { at: [0, -0.101, 0.026] as V3, len: [0.04, 0.037] as const, r: 0.015 },
  fingers: { at: [0, -0.101, -0.014] as V3, len: [0.037, 0.032] as const },
  grip: [0.04, -0.088, 0] as V3,
};

/**
 * Ngón giữa, áp út, út: gốc lệch `dz` (z) và `dy` (dọc) khỏi gốc chung `HAND_BONES.fingers`, dài `len` lần, bán kính `r`
 * (cỡ `1`), xoè `fan + fanK · spread` độ (dương về phía ngón cái), gập thêm `curl` độ ở cả hai khớp. Cả ba theo góc
 * `fingersBase`, `fingersTip` của dáng: nắm lại ngón út cuộn sâu hơn, xoè thì áp út và út toả ra
 */
export const HAND_FINGERS = {
  middle: { dz: 0.018, dy: -0.004, len: 1.06, r: 0.0145, fan: 0, fanK: 0.1, curl: 0 },
  ring: { dz: -0.004, dy: 0, len: 0.98, r: 0.0135, fan: -1, fanK: -0.35, curl: 3 },
  pinky: { dz: -0.023, dy: 0.01, len: 0.8, r: 0.012, fan: -3, fanK: -0.8, curl: 6 },
} as const;
export type HandFinger = keyof typeof HAND_FINGERS;
const FINGERS = Object.keys(HAND_FINGERS) as HandFinger[];

export type HandPiece = "palm" | `${"thumb" | "index" | HandFinger}${0 | 1}`;
export const HAND_PIECES: readonly HandPiece[] = [
  "palm",
  "thumb0",
  "thumb1",
  "index0",
  "index1",
  "middle0",
  "middle1",
  "ring0",
  "ring1",
  "pinky0",
  "pinky1",
];

/** Khung một đốt trong khung bàn tay: gốc `o`, hướng `R`; đốt mọc từ gốc theo −y, dài `len` */
export interface HandFrame {
  o: V3;
  R: M3;
  len: number;
}

const D = Math.PI / 180;
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/**
 * Khung từng đốt của bàn tay bên `side` (`-1` tay phải) cỡ `k`, cỡ dọc `long`, theo góc ngón của `v` (`HAND_DOF`; hai số
 * đầu là của cổ tay, không đọc ở đây). Mọi ngón gập về phía lòng tay; ngón cái đặt gốc bằng dạng (ra +z) rồi đối (về lòng
 * tay), nên gập nó là vắt ngang lòng tay khi đối nhiều; `thumbRoll` xoay đốt gốc ngón cái quanh trục của chính nó sau
 * gập gốc: đốt gốc không đổi chỗ, mặt đệm và mặt gập của đốt ngọn xoay theo.
 */
export function handFrames(
  v: HandVec,
  side: number,
  k = 1,
  long = k,
): Record<HandPiece, HandFrame> {
  const p = -side;
  const [abd, opp, tb0, tt0, ib0, it0, fb, ft, sp] = v.slice(2, ROLL).map((x) => (x ?? 0) * D);
  const roll = Math.min(THUMB_ROLL[1], Math.max(THUMB_ROLL[0], v[ROLL] ?? 0)) * D;
  const fit = (i: number) => (v[HAND_DOF.length + i] ?? 0) * D;
  const [tb, tt, ib, it] = [tb0 + fit(0), tt0 + fit(1), ib0 + fit(2), it0 + fit(3)];
  const B = HAND_BONES;
  const at = ([x, y, z]: V3): V3 => [p * x * k, y * long, z * k];
  const chain = (o: V3, R0: M3, len: readonly [number, number], bend: number) => {
    const R1 = matMul(R0, rotZ(p * bend));
    const l0 = len[0] * long;
    return [
      { o, R: R0, len: l0 },
      { o: add3(o, matVec(R0, [0, -l0, 0])), R: R1, len: len[1] * long },
    ] as const;
  };
  const base = matMul(matMul(rotY(p * opp), rotX(-abd)), rotZ(p * tb));
  const [thumb0, thumb1] = chain(
    at(B.thumb.at),
    roll ? matMul(base, rotY(p * roll)) : base,
    B.thumb.len,
    tt,
  );
  const [index0, index1] = chain(at(B.index.at), matMul(rotX(-sp), rotZ(p * ib)), B.index.len, it);
  const out = {
    palm: { o: [0, 0, 0], R: I3, len: B.palm.len * long },
    thumb0,
    thumb1,
    index0,
    index1,
  } as Record<HandPiece, HandFrame>;
  FINGERS.forEach((n, j) => {
    const f = HAND_FINGERS[n];
    const [a, b] = chain(
      at([B.fingers.at[0], B.fingers.at[1] + f.dy, B.fingers.at[2] + f.dz]),
      matMul(rotX(-(f.fan * D + f.fanK * sp)), rotZ(p * (fb + f.curl * D + fit(4 + 2 * j)))),
      [B.fingers.len[0] * f.len, B.fingers.len[1] * f.len],
      ft + f.curl * D + fit(5 + 2 * j),
    );
    out[`${n}0`] = a;
    out[`${n}1`] = b;
  });
  return out;
}

/** Tâm nắm của bàn tay bên `side` trong khung bàn tay: chỗ treo đồ cầm, giữa lòng bàn tay và các ngón của dáng `grip` */
export const handGrip = (side: number, k = 1, long = k): V3 => {
  const [x, y, z] = HAND_BONES.grip;
  return [-side * x * k, y * long, z * k];
};

/** Độ rộng (độ, trên mười góc ngón) của phép hoà tâm nắm theo dáng gần nhất: dáng soạn đúng gần như trùng bảng */
const GRIP_SPREAD = 12;

/**
 * Tâm nắm của bàn tay bên `side` theo góc ngón đang vẽ (`v`, `HAND_DOF`), khung bàn tay: hoà `HAND_GRIPS` theo độ gần của
 * góc ngón với từng dáng (min mềm), nên đổi dần khi dáng hoà, đúng bảng khi đúng dáng
 */
export function handGripOf(v: HandVec, side: number, k = 1, long = k): V3 {
  const f = v.slice(2);
  let sum = 0;
  const acc: V3 = [0, 0, 0];
  for (const [name, g] of Object.entries(HAND_GRIPS) as [HandPose | "rest", V3][]) {
    const ref = fingerVec(name === "rest" ? HAND_RELAXED : HAND_POSES[name]);
    const d2 = ref.reduce((a, r, i) => a + (r - (f[i] ?? 0)) ** 2, 0);
    const w = Math.exp(-d2 / GRIP_SPREAD ** 2);
    sum += w;
    for (let i = 0; i < 3; i++) acc[i] += g[i] * w;
  }
  const [x, y, z] = sum > 1e-12 ? acc.map((a) => a / sum) : HAND_BONES.grip;
  return [-side * x * k, y * long, z * k];
}

/** Đồ cầm dời bấy nhiêu khỏi chỗ treo (`handGrip`) khi tay giữ dáng `pose`, khung bàn tay */
export const gripShift = (pose: HandPose, side: number, k = 1, long = k): V3 => {
  const [x, y, z] = HAND_GRIPS[pose].map((g, i) => g - HAND_BONES.grip[i]);
  return [-side * x * k, y * long, z * k];
};

/**
 * Điểm `point` của bàn tay bên `side` cỡ `k`, cỡ dọc `long` ở góc ngón `v`, trong khung bàn tay: cổ tay (gốc), giữa lòng
 * tay và giữa mu tay (trên mặt da lòng bàn tay), tâm nắm (`handGripOf`), đầu ngón giữa
 */
export function handPoint(
  point: "wrist" | "palm" | "back" | "grip" | "tip",
  v: HandVec,
  side: number,
  k = 1,
  long = k,
): V3 {
  if (point === "wrist") return [0, 0, 0];
  if (point === "grip") return handGripOf(v, side, k, long);
  const mid = (-HAND_BONES.palm.len * long) / 2;
  const thick = HAND_BONES.palm.half[0] * k;
  if (point === "palm") return [-side * thick, mid, 0];
  if (point === "back") return [side * thick, mid, 0];
  const f = handFrames(v, side, k, long).middle1;
  return add3(f.o, matVec(f.R, [0, -f.len, 0]));
}

/**
 * Khung bàn tay trong khung cổ tay theo xoay cẳng tay `turn`, gập cổ tay `bend` (của `HandVec`) và lệch cổ tay `dev` (số
 * thứ ba của tuple tay, cùng mặt phẳng với khuỷu — ra +z, phía ngón cái): Euler `YZX` của three — xoay quanh trục cẳng
 * tay, rồi gập, rồi lệch
 */
export const wristTurn = (turn: number, bend: number, dev: number, side: number): M3 =>
  matMul(matMul(rotY(-side * turn * D), rotZ(-side * bend * D)), rotX(-dev * D));
