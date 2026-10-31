import { NEUTRAL_HEAD, NEUTRAL_STRETCH } from "./constants";
import type { IdleParams, Pose } from "./types";

export const DEFAULT_IDLE: IdleParams = { breath: 2, arm: 3, lean: 0 };

/** Thời lượng mặc định của một nhịp thở (giây) */
export const IDLE_CYCLE_SECONDS = 3.2;

/** Đứng thở tại pha t, `0 → 1` là một nhịp. Thân xoay quanh hông nên đầu và tay đi theo. */
export function idlePose(t: number, p: IdleParams): Pose {
  const a = 2 * Math.PI * t;
  const s = Math.sin(a);
  return {
    // Xoè đối xứng: tay phải âm, tay trái dương
    ar: [-8 - p.arm * s, 6, 0],
    al: [8 + p.arm * s, -6, 0],
    lr: [-2, 0],
    ll: [2, 0],
    torso: p.lean + p.breath * s,
    head: NEUTRAL_HEAD,
    stretch: NEUTRAL_STRETCH,
  };
}
