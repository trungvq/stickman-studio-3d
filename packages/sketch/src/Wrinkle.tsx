import { type CharacterData, wrinkleMarks } from "@stickman3d/rig/core";
import { faceMark } from "./faceMark";

type Face = CharacterData["face"];

/** Nếp nhăn vẽ bằng code — dấu hiệu tuổi tác, cùng hệ toạ độ với mắt và mồm.
 *  Vẽ trên khối đầu, dưới mắt / mày / mồm; mảnh tóc vẽ sau nên che bớt nếp trán.
 *  `gap` là khoảng mắt chưa hẹp lại, `squeeze` là hệ số hẹp khi lắc. */
export function Wrinkle({
  wrinkle,
  cx,
  cy,
  gap,
  mouthCy,
  r,
  squeeze,
  clip,
}: {
  wrinkle: Face["wrinkle"];
  cx: number;
  cy: number;
  gap: number;
  mouthCy: number;
  r: number;
  squeeze: number;
  /** Cắt theo khối đầu: nếp trán dài hơn nửa bề ngang đầu ở độ cao đó thì thò ra ngoài */
  clip?: string;
}) {
  const m = wrinkleMarks(wrinkle, cx, cy, gap, mouthCy, r, squeeze);
  if (!m || !("group" in m)) return null;
  return (
    <g
      clipPath={clip && `url(#${clip})`}
      fill={m.fill}
      stroke={m.stroke}
      strokeWidth={m.strokeWidth}
      strokeLinecap={m.strokeLinecap}
    >
      {m.group.map((c, i) => faceMark(c, "", i))}
    </g>
  );
}
