import type { ActPalm } from "./act3";
import { actionMask } from "./action";
import type { CastMember } from "./scene";

/** Mặt trên cao hơn điểm bàn tay tới ngần này vẫn tính là mặt dưới bàn tay (bàn tay lún vào), px */
export const PALM_SINK = 8;

export const PALM_FACES = {
  down: "úp",
  up: "ngửa",
  in: "vào thân",
  out: "ra ngoài",
  front: "ra trước",
  back: "ra sau",
} as const;
export type PalmFace = keyof typeof PALM_FACES;

export type PalmHand = "R" | "L";
export const PALM_HAND_LABELS: Record<PalmHand, string> = { R: "tay phải", L: "tay trái" };

const deg = (c: number) => (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;

/**
 * Lòng bàn tay quay về đâu: trục trội trong sáu hướng — xuống / lên của thế giới, trước / sau theo hướng mặt người
 * nằm ngang, vào thân / ra ngoài theo phía tay ấy — và góc lệch khỏi úp, độ
 */
export function palmFace(p: Pick<ActPalm, "palm" | "forward" | "out">): {
  face: PalmFace;
  down: number;
} {
  const dot = (a: readonly number[], b: readonly number[]) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const d = p.palm[1];
  const f = dot(p.palm, p.forward);
  const o = dot(p.palm, p.out);
  const [a, b, c] = [Math.abs(d), Math.abs(f), Math.abs(o)];
  const face: PalmFace =
    a >= b && a >= c
      ? d > 0
        ? "down"
        : "up"
      : b >= c
        ? f > 0
          ? "front"
          : "back"
        : o > 0
          ? "out"
          : "in";
  return { face, down: deg(d) };
}

/** Clip đang chạy tại `t` có ghi kênh tay hay bàn tay: `file (track)` */
export function handClips(m: CastMember, t: number): string[] {
  return m.tracks.flatMap((tr, ti) => {
    let c: (typeof tr.clips)[number] | undefined;
    for (const k of tr.clips) if (k.start <= t) c = k;
    const hands =
      c?.action &&
      actionMask(c.action).some((k) => k === "hand" || k === "armNear" || k === "armFar");
    return hands ? [`${c!.file ?? c!.action!.name} (${tr.name ?? `#${ti}`})`] : [];
  });
}
