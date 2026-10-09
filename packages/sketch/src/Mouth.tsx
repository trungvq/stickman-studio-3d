import { useId } from "react";
import { type MouthKind, mouthMark } from "@stickman3d/rig/core";
import { faceMark } from "./faceMark";

export function Mouth({ kind, cx, cy }: { kind: MouthKind; cx: number; cy: number }) {
  const uid = useId();
  return faceMark(mouthMark(kind, cx, cy), `mouth${uid.replace(/:/g, "")}`);
}
