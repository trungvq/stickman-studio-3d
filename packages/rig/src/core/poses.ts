import { NEUTRAL_HEAD, NEUTRAL_STRETCH } from "./constants";
import type { Pose } from "./types";

/** Bảng tư thế chỉ nói chuyện tay chân; góc đầu để hành động ghi, chi dài chuẩn */
const stand = (p: Omit<Pose, "head" | "stretch">): Pose => ({
  ...p,
  head: NEUTRAL_HEAD,
  stretch: NEUTRAL_STRETCH,
});

/** Xoè đối xứng thì tay phải âm, tay trái dương; cổ tay `0` — thư viện tư thế không cầm gì */
export const POSES = {
  idle: stand({ al: [8, -6, 0], ar: [-8, 6, 0], ll: [2, 0], lr: [-2, 0], torso: 0 }),
  talk: stand({ al: [10, -8, 0], ar: [-18, -64, 0], ll: [2, 0], lr: [-2, 0], torso: 2 }),
  point: stand({ al: [10, -6, 0], ar: [78, 6, 0], ll: [2, 0], lr: [-2, 0], torso: 3 }),
  raise: stand({ al: [10, -6, 0], ar: [-140, -8, 0], ll: [2, 0], lr: [-2, 0], torso: -2 }),
  shrug: stand({ al: [30, 75, 0], ar: [-30, -75, 0], ll: [2, 0], lr: [-2, 0], torso: 0 }),
  shock: stand({ al: [45, 80, 0], ar: [-45, -80, 0], ll: [6, 0], lr: [-6, 0], torso: -6 }),
  think: stand({ al: [10, -6, 0], ar: [60, 135, 0], ll: [2, 0], lr: [-2, 0], torso: 4 }),
  hold: stand({ al: [22, -124, 0], ar: [-22, 124, 0], ll: [2, 0], lr: [-2, 0], torso: 0 }),
  // Ngồi ghế: đùi đưa ngang, cẳng chân thả thẳng xuống, tay đặt trên đùi
  sit: stand({ al: [26, 38, 0], ar: [30, 42, 0], ll: [88, -92], lr: [92, -88], torso: 2 }),
} satisfies Record<string, Pose>;

export type PoseName = keyof typeof POSES;

export const POSE_NAMES = Object.keys(POSES) as [PoseName, ...PoseName[]];

export const POSE_LABELS: Record<PoseName, string> = {
  idle: "idle — đứng nghe",
  talk: "talk — đang nói",
  point: "point — chỉ tay",
  raise: "raise — giơ tay",
  shrug: "shrug — bó tay",
  shock: "shock — sốc",
  think: "think — suy nghĩ",
  hold: "hold — cầm đồ",
  sit: "sit — ngồi ghế",
};
