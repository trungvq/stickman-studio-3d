import { useId } from "react";
import type { GlassesPaths } from "@stickman3d/rig/core";

/**
 * Kính dựng khối: gọng một màu, không viền mực. Kính râm tô mắt kính `color`, gọng vẽ màu nét.
 * Phần sau mặt phẳng giữa chỉ hiện chỗ nhô ra ngoài viền đầu. Vẽ trong hệ nhóm đầu.
 */
export function SculptGlasses({
  paths,
  color,
  line,
  stroke,
}: {
  paths: GlassesPaths;
  color: string;
  line: string;
  stroke: number;
}) {
  const id = `glasses${useId().replace(/:/g, "")}`;
  const hidden = paths.back || paths.backFill;
  const lens = paths.tint ? color : "none";
  return (
    <g
      fill="none"
      stroke={paths.tint ? line : color}
      strokeWidth={stroke * paths.thick}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {hidden && (
        <>
          <clipPath id={id}>
            <path d={`M-1e4 -1e4H1e4V1e4H-1e4Z${paths.head(stroke / 2)}`} clipRule="evenodd" />
          </clipPath>
          <g clipPath={`url(#${id})`}>
            {paths.tint && <path d={paths.backFill} fill={lens} stroke="none" />}
            <path d={paths.back} />
          </g>
        </>
      )}
      <path d={paths.arms} />
      {paths.tint && <path d={paths.fill} fill={lens} stroke="none" />}
      <path d={paths.rim} />
    </g>
  );
}
