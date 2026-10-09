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
}: {
  kind: BrowKind;
  cx: number;
  cy: number;
  gap: number;
  /** Đầu `side`: chỉ vẽ nét bên này */
  only?: 1 | -1;
  /** Bóp ngang nét mày khi đầu quay */
  squash?: number;
}) {
  return faceMark(browMarks(kind, cx, cy, gap, { only, squash }));
}
