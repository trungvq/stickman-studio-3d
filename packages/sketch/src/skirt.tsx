import type { SkirtPaths } from "@stickman3d/rig/core";

/** Váy dựng khối: viền dày gấp đôi dưới cùng, ruột tô đè nên chỉ còn nửa ngoài, rồi nếp. Hệ nhóm thân */
export function SculptSkirt({
  paths,
  color,
  line,
  stroke,
}: {
  paths: SkirtPaths;
  color: string;
  line: string;
  stroke: number;
}) {
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d={paths.body} fill="none" stroke={line} strokeWidth={stroke * 2} />
      <path d={paths.body} fill={color} />
      {paths.pleats && (
        <path d={paths.pleats} fill="none" stroke={line} strokeWidth={stroke * 0.45} />
      )}
    </g>
  );
}
