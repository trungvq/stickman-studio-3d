import { type EyeKind, eyeMarks } from "@stickman3d/rig/core";
import { faceMark } from "./faceMark";

/** Hai chấm mắt, cách nhau `gap` */
export function Eyes({
  kind,
  cx,
  cy,
  gap,
  only,
  squash,
  lid,
}: {
  kind: EyeKind;
  cx: number;
  cy: number;
  gap: number;
  /** Đầu `side`: chỉ vẽ nét bên này */
  only?: 1 | -1;
  /** Bóp ngang hình mắt khi đầu quay; bỏ trống thì `side` bóp `SIDE_EYE_OVAL` */
  squash?: number;
  /** Mi trên nghỉ sụp, `face.lid` của nhân vật */
  lid?: number;
}) {
  return faceMark(eyeMarks(kind, cx, cy, gap, { only, squash, lid }));
}
