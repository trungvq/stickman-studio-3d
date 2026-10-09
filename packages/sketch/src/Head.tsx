import { headPath, type HeadShape } from "@stickman3d/rig/core";

interface HeadProps {
  shape: HeadShape;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export function Head({ shape, cx, cy, rx, ry, ...paint }: HeadProps) {
  return <path d={headPath(shape, cx, cy, rx, ry)} {...paint} />;
}
