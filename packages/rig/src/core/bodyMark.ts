import { z } from "zod";
import type { HoldAim } from "./heldItem";

/**
 * Mốc có tên trên người 3D cho đích bàn tay (`keys[].reach`, `world.hands`) và hướng lòng tay (`palm: { toward }`). Chỗ
 * của mốc tính mỗi khung trên chính khung xương, đầu và thân áo của nhân vật ở tư thế lúc ấy (`markAt` của `act3.ts`),
 * không theo bảng số. docs/01-rig.md#đích-theo-mốc
 */
export const BODY_MARKS = [
  "mouth",
  "chin",
  "cheek",
  "eye",
  "ear",
  "forehead",
  "crown",
  "backHead",
  "head",
  "nape",
  "shoulder",
  "chest",
  "belly",
  "back",
  "hip",
  "thigh",
  "knee",
  "otherWrist",
  "otherPalm",
  "otherBack",
  "otherGrip",
] as const;
export type BodyMark = (typeof BODY_MARKS)[number];

export const BODY_MARK_LABELS: Record<BodyMark, string> = {
  mouth: "giữa mồm, trên mặt",
  chin: "dưới cằm, mặt trước",
  cheek: "má",
  eye: "mắt",
  ear: "mặt ngoài tai",
  forehead: "trán",
  crown: "đỉnh sọ",
  backHead: "sau gáy đầu",
  head: "tâm sọ, trong đầu: đích hướng món (loa áp tai, miệng chén kề môi), không phải chỗ đặt tay",
  nape: "gáy cổ",
  shoulder: "đỉnh vai",
  chest: "giữa ngực, mặt áo",
  belly: "đỉnh bụng, mặt áo",
  back: "giữa lưng ngang thắt lưng, mặt áo",
  hip: "sườn ngang hông, mặt áo",
  thigh: "giữa mặt đùi",
  knee: "mặt gối",
  otherWrist: "cổ tay tay kia",
  otherPalm: "giữa lòng tay tay kia",
  otherBack: "giữa mu tay tay kia",
  otherGrip: "tâm nắm tay kia",
};

/** Mốc có hai bên: `side` chọn bên cùng phía tay đang với (mặc định) hay bên kia */
export const SIDED_BODY_MARKS: readonly BodyMark[] = [
  "cheek",
  "eye",
  "ear",
  "shoulder",
  "hip",
  "thigh",
  "knee",
];

/** Mốc trên bàn tay kia: tay ấy giải trước */
export const isOtherHand = (m: BodyMark | undefined) => !!m && m.startsWith("other");

/** Mốc trên đầu: `offset` theo khung đầu (đã cúi, lắc, nghiêng) */
export const HEAD_BODY_MARKS: readonly BodyMark[] = [
  "mouth",
  "chin",
  "cheek",
  "eye",
  "ear",
  "forehead",
  "crown",
  "backHead",
  "head",
];

/** Điểm trên bàn tay đặt vào đích: cổ tay, giữa lòng tay, giữa mu tay, tâm nắm của dáng đang vẽ, đầu ngón giữa */
export const HAND_POINTS = ["wrist", "palm", "back", "grip", "tip"] as const;
export type HandPoint = (typeof HAND_POINTS)[number];
/** Điểm bàn tay đặt vào đích ở `world.hands`: cả mốc của món đang cầm (`item:<mốc>`) */
export type ReachPoint = HandPoint | `item:${string}`;
/** `point` của `world.hands`: `HAND_POINTS` hay `item:<mốc>` */
export const ReachPointSchema = z.union([
  z.enum(HAND_POINTS),
  z.custom<`item:${string}`>((v) => typeof v === "string" && /^item:.+$/.test(v), {
    message: "điểm bàn tay là `wrist`, `palm`, `back`, `grip`, `tip` hay `item:<mốc của món>`",
  }),
]);

/**
 * Hướng gọi tên, hệ thân `[tiến, y, ra ngoài]` như đích cổ tay: `in` về đường giữa thân, `out` ra phía chính tay ấy,
 * `down` / `up` theo trục đứng
 */
export const PALM_DIRS = {
  down: [0, 1, 0],
  up: [0, -1, 0],
  forward: [1, 0, 0],
  back: [-1, 0, 0],
  in: [0, 0, -1],
  out: [0, 0, 1],
} as const satisfies Record<string, readonly [number, number, number]>;
export type PalmDir = keyof typeof PALM_DIRS;
export const PALM_DIR_NAMES = Object.keys(PALM_DIRS) as [PalmDir, ...PalmDir[]];

type V3 = [number, number, number];
const v3 = z.tuple([z.number(), z.number(), z.number()]);

/** Một mốc có tên: `to`, bên (`side`), dời khỏi mốc (`offset`, `[tiến, y, ra ngoài]` đơn vị rig theo khung phần người mang mốc) */
export const BodyMarkRefSchema = z.object({
  to: z.enum(BODY_MARKS),
  side: z.enum(["same", "other"]).optional(),
  offset: v3.optional(),
});
export type BodyMarkRef = z.infer<typeof BodyMarkRefSchema>;

/**
 * Hướng khai cho lòng tay hay ngón: tên (`PALM_DIRS`), vectơ hệ thân `[tiến, y, ra ngoài]`, hay `{ toward }` — quay về một
 * mốc (`side`, `offset` như đích). docs/01-rig.md#hướng-lòng-tay-theo-ý
 */
export const AimDirSchema = z.union([
  z.enum(PALM_DIR_NAMES),
  v3,
  z.strictObject({
    toward: z.enum(BODY_MARKS),
    side: z.enum(["same", "other"]).optional(),
    offset: v3.optional(),
  }),
]);
export type AimDirJson = z.infer<typeof AimDirSchema>;

/** Hướng đã quy về dạng nội suy được: vectơ hệ thân, hay mốc */
export interface AimDir {
  v?: V3;
  /** Hướng thế giới three, rig tự đặt (tay phụ của món cầm hai tay) */
  abs?: V3;
  to?: BodyMark;
  side?: "same" | "other";
  offset?: V3;
}

export const aimDir = (d: AimDirJson): AimDir =>
  typeof d === "string"
    ? { v: [...PALM_DIRS[d]] as V3 }
    : Array.isArray(d)
      ? { v: [...d] as V3 }
      : { to: d.toward, ...(d.side && { side: d.side }), ...(d.offset && { offset: d.offset }) };

/**
 * Một số hạng của đích bàn tay đã lấy mẫu: phần `k`, chỗ — toạ độ thô `at` (hệ của nguồn: hệ thân với hành động, thế
 * giới với `world.hands`) hay mốc `to` — và điểm bàn tay đặt vào đó (`point`; thiếu là cổ tay với `at`, lòng tay với
 * mốc). Đích là tổng có trọng số của các số hạng: hoà mốc với toạ độ thô, mốc với mốc là hoà trên vị trí đã giải
 */
export interface ReachTerm {
  k: number;
  at?: V3;
  to?: BodyMark;
  side?: "same" | "other";
  offset?: V3;
  point?: ReachPoint;
}

/**
 * Đích `ease: "auto"` của `world.hands`: số hạng của bốn mốc kề (mốc ngoài vắng khi chuỗi `auto` dừng ở đó), độ dài ba
 * đoạn và phần `f` của đoạn giữa. Người 3D giải cổ tay của từng mốc trong cùng khung ở `t` rồi nội suy bậc ba đơn điệu
 * từng thành phần (`hermiteN`). docs/03-scene.md#đích-bàn-tay-thế-giới
 */
export interface ReachSpline {
  keys: [ReachTerm[] | undefined, ReachTerm[], ReachTerm[], ReachTerm[] | undefined];
  h: [number, number, number];
  f: number;
}

/**
 * Một số hạng của bàn tay đã lấy mẫu: phần `k`, và hoặc xoay / gập cổ tay thô (`raw`), hoặc ý định — lòng tay (`palm`),
 * ngón (`fingers`) quay về đâu, `bend` khai kèm thì giữ cố định. `keep` (chỉ ở `world.hands`): giữ bàn tay của hành động
 */
export interface AimTerm {
  k: number;
  raw?: [number, number];
  palm?: AimDir;
  fingers?: AimDir;
  bend?: number;
  keep?: boolean;
  /** Ý định của món đang cầm (`world.hands[].hold`): rig giải ra lòng tay, ngón */
  hold?: HoldAim;
}

/** Bàn tay theo ý định của một kênh tay: các số hạng, phần cộng lại là `1` */
export interface Aim {
  terms: AimTerm[];
}

/** Trường nội suy được của số hạng: toạ độ thô của đích, xoay / gập thô của bàn tay */
const LERPED = ["at", "raw"] as const;
const termKey = (t: object) =>
  JSON.stringify(
    Object.entries(t)
      .filter(([k]) => k !== "k" && !(LERPED as readonly string[]).includes(k))
      .concat(LERPED.map((k) => [k, k in t])),
  );

/**
 * Hoà hai dãy số hạng theo `f`: `a` nhân `1 − f`, `b` nhân `f`; số hạng cùng loại gộp lại — toạ độ thô (`at`, `raw`) nội
 * suy theo phần —, số hạng còn phần quá nhỏ thì bỏ
 */
export function mixTerms<T extends { k: number; at?: V3; raw?: [number, number] }>(
  a: readonly T[],
  b: readonly T[],
  f: number,
): T[] {
  const out: T[] = [];
  const add = (t: T, w: number) => {
    if (!(t.k * w > 1e-9)) return;
    const key = termKey(t);
    const same = out.find((o) => termKey(o) === key);
    if (!same) {
      out.push({
        ...t,
        k: t.k * w,
        ...(t.at && { at: [...t.at] }),
        ...(t.raw && { raw: [...t.raw] }),
      });
      return;
    }
    const k = same.k + t.k * w;
    const u = (t.k * w) / k;
    for (const f of LERPED) {
      const x = same[f] as number[] | undefined;
      const y = t[f] as number[] | undefined;
      if (x && y) for (let i = 0; i < x.length; i++) x[i] += (y[i] - x[i]) * u;
    }
    same.k = k;
  };
  for (const t of a) add(t, 1 - f);
  for (const t of b) add(t, f);
  return out;
}
