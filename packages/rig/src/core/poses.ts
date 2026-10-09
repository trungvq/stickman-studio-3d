import { NEUTRAL_HEAD, NEUTRAL_STRETCH } from "./constants";
import type { ArmLayers, Pose } from "./types";

/** Bảng tư thế chỉ nói chuyện tay chân; góc đầu để hành động ghi, chi dài chuẩn */
const stand = (p: Omit<Pose, "head" | "stretch">): Pose => ({
  ...p,
  head: NEUTRAL_HEAD,
  stretch: NEUTRAL_STRETCH,
});

/** Xoè đối xứng thì tay gần âm, tay xa dương; cổ tay `0` — thư viện tư thế không cầm gì */
export const POSES = {
  idle: stand({ af: [8, -6, 0], an: [-8, 6, 0], lf: [2, 0], ln: [-2, 0], torso: 0 }),
  talk: stand({ af: [10, -8, 0], an: [-18, -64, 0], lf: [2, 0], ln: [-2, 0], torso: 2 }),
  point: stand({ af: [10, -6, 0], an: [78, 6, 0], lf: [2, 0], ln: [-2, 0], torso: 3 }),
  raise: stand({ af: [10, -6, 0], an: [-140, -8, 0], lf: [2, 0], ln: [-2, 0], torso: -2 }),
  shrug: stand({ af: [30, 75, 0], an: [-30, -75, 0], lf: [2, 0], ln: [-2, 0], torso: 0 }),
  shock: stand({ af: [45, 80, 0], an: [-45, -80, 0], lf: [6, 0], ln: [-6, 0], torso: -6 }),
  think: stand({ af: [10, -6, 0], an: [60, 135, 0], lf: [2, 0], ln: [-2, 0], torso: 4 }),
  hold: stand({ af: [22, -124, 0], an: [-22, 124, 0], lf: [2, 0], ln: [-2, 0], torso: 0 }),
  // Ngồi trên lưng: đùi đưa ngang ra trước, cẳng chân buông, hai tay đưa trước cầm cương
  ride: stand({ af: [34, 48, 0], an: [40, 44, 0], lf: [76, -104], ln: [84, -98], torso: 4 }),
  // Ngồi ghế: đùi đưa ngang, cẳng chân thả thẳng xuống, tay đặt trên đùi
  sit: stand({ af: [26, 38, 0], an: [30, 42, 0], lf: [88, -92], ln: [92, -88], torso: 2 }),
  // Nằm ngửa gối đầu, dùng với `cast[].rotate: 90`: thân và đầu nhổm lên gối, chân dốc xuống nệm
  lie: {
    ...stand({ af: [8, -6, 0], an: [-8, 6, 0], lf: [-10, 0], ln: [-11, 0], torso: 12 }),
    head: [18, 0, 0],
  },
} satisfies Record<string, Pose>;

export type PoseName = keyof typeof POSES;

export const POSE_NAMES = Object.keys(POSES) as [PoseName, ...PoseName[]];

/** Lớp cẳng tay riêng của pose; chỉ pose nào vung tay vào giữa thân mới cần khai */
export const POSE_LAYERS: Partial<Record<PoseName, Partial<ArmLayers>>> = {
  hold: { armFar: "front" },
};

export const POSE_LABELS: Record<PoseName, string> = {
  idle: "idle — đứng nghe",
  talk: "talk — đang nói",
  point: "point — chỉ tay",
  raise: "raise — giơ tay",
  shrug: "shrug — bó tay",
  shock: "shock — sốc",
  think: "think — suy nghĩ",
  hold: "hold — cầm đồ",
  ride: "ride — ngồi trên lưng",
  sit: "sit — ngồi ghế",
  lie: "lie — nằm ngửa gối đầu (cùng rotate 90)",
};
