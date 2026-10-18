import { type BrowKind, browMarks } from "@stickman3d/rig/core";
import { faceMark } from "./faceMark";

/** Hai nét mày trên tâm mắt `cy` */
export function Brow({
  kind,
  cx,
  cy,
  gap,
  only,
  squash,
  width,
  tilt,
}: {
  kind: BrowKind;
  cx: number;
  cy: number;
  gap: number;
  /** Đầu `side`: chỉ vẽ nét bên này */
  only?: 1 | -1;
  /** Bóp ngang nét mày khi đầu quay */
  squash?: number;
  /** Nhân bề dày nét, `face.browWidth` của nhân vật */
  width?: number;
  /** Cộng vào độ nghiêng, dương nhấc đầu trong; `face.browTilt` của nhân vật */
  tilt?: number;
}) {
  return faceMark(browMarks(kind, cx, cy, gap, { only, squash, width, tilt }));
}
