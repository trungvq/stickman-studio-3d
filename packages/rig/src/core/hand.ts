import { add3, matMul, matVec, rotX, rotY, rotZ, type M3, type V3 } from "./lens";

/**
 * Bàn tay của người 3D mặc đồ: lòng bàn tay và năm ngón — ngón cái, trỏ, giữa, áp út, út — mỗi ngón hai đốt trên khớp;
 * mặt da liền ở `handMesh.ts`. Dáng tay là góc khớp, nên hoà hai dáng là hoà góc. Hệ khung bàn tay (three): −y dọc bàn
 * tay ra ngoài, lòng bàn tay quay về `p · x` với `p = −side` (về phía thân khi tay buông), ngón cái về +z.
 * docs/01-rig.md#bàn-tay
 */

/**
 * Góc ngón, độ: ngón cái `[dạng, đối, gập gốc, gập ngọn]`, trỏ `[gập gốc, gập ngọn]`, `fingers` chung cho giữa, áp út, út
 * (`HAND_FINGERS` cộng độ lệch từng ngón), `spread` độ xoè: trỏ tách ra, áp út và út toả theo
 */
export interface Fingers {
  thumb: readonly [number, number, number, number];
  index: readonly [number, number];
  fingers: readonly [number, number];
  spread: number;
}

/** Dáng nghỉ: ngón cong nhẹ, ngón cái khép sát ngón trỏ — bàn tay không ai đặt dáng, và gốc mà `w` hoà từ đó. Không soạn được */
export const HAND_RELAXED: Fingers = {
  thumb: [15, 20, 4, 8],
  index: [8, 10],
  fingers: [10, 14],
  spread: 2,
};

/** Dáng tay soạn được. Thêm một dáng là thêm một dòng; `HandPose` và `HAND_POSE_KINDS` lấy từ khoá của bảng */
export const HAND_POSES = {
  open: { thumb: [40, 15, 0, 0], index: [0, 0], fingers: [0, 0], spread: 6 },
  grip: { thumb: [55, 65, 10, 15], index: [45, 80], fingers: [50, 80], spread: 0 },
  point: { thumb: [45, 70, 25, 30], index: [0, 0], fingers: [90, 100], spread: 0 },
  fist: { thumb: [20, 85, 25, 30], index: [90, 85], fingers: [90, 85], spread: 0 },
} as const satisfies Record<string, Fingers>;

export type HandPose = keyof typeof HAND_POSES;
export const HAND_POSE_KINDS = Object.keys(HAND_POSES) as [HandPose, ...HandPose[]];

export const HAND_POSE_LABELS: Record<HandPose, string> = {
  open: "xoè",
  grip: "cầm",
  point: "chỉ tay",
  fist: "nắm đấm",
};

/**
 * Số của một bàn tay, theo thứ tự này: xoay cẳng tay (`turn`, dương là sấp — lòng tay úp khi cẳng tay chĩa ra trước),
 * gập cổ tay (`bend`, dương về phía lòng tay), rồi chín góc ngón của `Fingers`
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
] as const;

export type HandVec = readonly number[];

export const fingerVec = (f: Fingers): number[] => [...f.thumb, ...f.index, ...f.fingers, f.spread];

/** Bàn tay không ai ghi: cẳng tay trung tính (lòng tay quay vào thân), cổ tay thẳng, ngón thả lỏng */
export const HAND_REST: HandVec = [0, 0, ...fingerVec(HAND_RELAXED)];

/** Một mốc bàn tay trong JSON: tên dáng, hay dáng `pose` (bỏ trống là dáng nghỉ) với phần `w`, xoay và gập cổ tay */
export interface HandKey {
  pose?: HandPose;
  w?: number;
  turn?: number;
  bend?: number;
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
  thumb: { at: [0.019, -0.033, 0.022] as V3, len: [0.04, 0.035] as const, r: 0.017 },
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
 * tay), nên gập nó là vắt ngang lòng tay khi đối nhiều.
 */
export function handFrames(
  v: HandVec,
  side: number,
  k = 1,
  long = k,
): Record<HandPiece, HandFrame> {
  const p = -side;
  const [abd, opp, tb, tt, ib, it, fb, ft, sp] = v.slice(2).map((x) => (x ?? 0) * D);
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
  const [thumb0, thumb1] = chain(
    at(B.thumb.at),
    matMul(matMul(rotY(p * opp), rotX(-abd)), rotZ(p * tb)),
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
  for (const n of FINGERS) {
    const f = HAND_FINGERS[n];
    const [a, b] = chain(
      at([B.fingers.at[0], B.fingers.at[1] + f.dy, B.fingers.at[2] + f.dz]),
      matMul(rotX(-(f.fan * D + f.fanK * sp)), rotZ(p * (fb + f.curl * D))),
      [B.fingers.len[0] * f.len, B.fingers.len[1] * f.len],
      ft + f.curl * D,
    );
    out[`${n}0`] = a;
    out[`${n}1`] = b;
  }
  return out;
}

/** Tâm nắm của bàn tay bên `side` trong khung bàn tay: chỗ treo đồ cầm, giữa lòng bàn tay và các ngón của dáng `grip` */
export const handGrip = (side: number, k = 1, long = k): V3 => {
  const [x, y, z] = HAND_BONES.grip;
  return [-side * x * k, y * long, z * k];
};

/**
 * Khung bàn tay trong khung cổ tay theo xoay cẳng tay `turn`, gập cổ tay `bend` (của `HandVec`) và lệch cổ tay `dev` (số
 * thứ ba của tuple tay, cùng mặt phẳng với khuỷu — ra +z, phía ngón cái): Euler `YZX` của three — xoay quanh trục cẳng
 * tay, rồi gập, rồi lệch
 */
export const wristTurn = (turn: number, bend: number, dev: number, side: number): M3 =>
  matMul(matMul(rotY(-side * turn * D), rotZ(-side * bend * D)), rotX(-dev * D));
