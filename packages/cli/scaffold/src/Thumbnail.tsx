import type { CodeLayer } from "@stickman3d/fx";
import { PAPER, type SceneData } from "@stickman3d/sketch";
import { useEffect, useMemo } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useVideoConfig } from "remotion";
import { SCENES } from "./data";
import { LAYER_HOOKS, type ThumbnailData } from "./episode";
import { CODE_LAYERS } from "./lop";
import { Scene } from "./Scene";

type Keep = ThumbnailData["keep"];

const only = <T extends { id: string }>(list: T[], ids?: string[]) =>
  ids ? list.filter((m) => ids.includes(m.id)) : list;

/** Cảnh chỉ còn những gì `keep` giữ; ai bị bỏ thì thứ bám vào người đó (người cưỡi, đồ xách) cũng phải bỏ */
const keepScene = (s: SceneData, keep: Keep): SceneData => ({
  ...s,
  cast: only(s.cast, keep.cast),
  animals: only(s.animals, keep.animals),
  props: only(s.props, keep.props),
  bg: keep.bg === false ? [] : s.bg,
  fx: keep.fx === false ? [] : s.fx,
});

const keepLayers = (keep: Keep): readonly CodeLayer[] =>
  CODE_LAYERS.filter((l) => !keep.layers || keep.layers.includes(l.name)).map((l) =>
    keep.hooks
      ? {
          ...l,
          ...Object.fromEntries(
            LAYER_HOOKS.filter((h) => !keep.hooks!.includes(h)).map((h) => [h, undefined]),
          ),
        }
      : l,
  );

/**
 * Thumbnail: một khung phim thật cộng một dòng hook. Không dựng cảnh riêng — `<Scene at>`
 * chạy đúng giây ấy, rồi cả tấm được phóng quanh `origin` và đẩy ngang `shift` cho mặt
 * nhân vật chiếm một góc, chữ ăn góc kia. Chữ là SVG `<text>` với `paint-order: stroke`:
 * viền giấy bọc ngoài nét mực nên đọc được trên mọi mảng nền. `keep` lọc người, thú, đạo cụ,
 * nền, hiệu ứng và lớp vẽ code của khung ấy mà không sửa cảnh phim. docs/07-lam-tap.md
 */
export const Thumbnail = ({ thumb }: { thumb: ThumbnailData }) => {
  const { width, height } = useVideoConfig();
  const font = thumb.font;
  // Font riêng phải nạp xong trước khi chụp, không thì chữ rơi về font hệ thống
  useEffect(() => {
    if (!font.file) return;
    const handle = delayRender("fonts");
    document.fonts
      .load(`${font.weight} 100px "${font.family}"`)
      .catch(() => undefined)
      .finally(() => continueRender(handle));
  }, [font]);
  const scene = useMemo(() => {
    const source = SCENES[thumb.scene];
    if (!source) throw new Error(`thumbnail: không có scenes/${thumb.scene}.json`);
    return keepScene(source, thumb.keep);
  }, [thumb.scene, thumb.keep]);
  const layers = useMemo(() => keepLayers(thumb.keep), [thumb.keep]);
  const [ox, oy] = thumb.origin;
  const size = height * thumb.size;
  const lineGap = size * 1.05;
  const x = width * thumb.textX;
  const y0 = height * thumb.textY;
  return (
    <AbsoluteFill style={{ background: PAPER, overflow: "hidden" }}>
      {font.file && (
        <style>{`@font-face { font-family: "${font.family}"; src: url("${staticFile(`fonts/${font.file}`)}"); font-weight: 100 900; }`}</style>
      )}
      <AbsoluteFill
        style={{
          transformOrigin: `${ox * 100}% ${oy * 100}%`,
          transform: `translateX(${thumb.shift * width}px) scale(${thumb.zoom})`,
        }}
      >
        <Scene scene={scene} at={thumb.at} codeLayers={layers} />
      </AbsoluteFill>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <g transform={`rotate(${thumb.tilt} ${x} ${y0})`}>
          {thumb.lines.map((line, i) => {
            const y = y0 + i * lineGap;
            const common = {
              x,
              y,
              fontFamily: `"${font.family}", sans-serif`,
              fontWeight: font.weight,
              fontSize: size,
            } as const;
            const accent = thumb.accent && line.endsWith(thumb.accent.char);
            return (
              <g key={i}>
                <text
                  {...common}
                  dx={size * 0.05}
                  dy={size * 0.06}
                  fill={thumb.shadow}
                  stroke={thumb.shadow}
                  strokeWidth={size * 0.13}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {line}
                </text>
                <text
                  {...common}
                  fill={thumb.ink}
                  stroke={thumb.paper}
                  strokeWidth={size * 0.13}
                  strokeLinejoin="round"
                  paintOrder="stroke"
                >
                  {accent ? (
                    <>
                      {line.slice(0, -thumb.accent!.char.length)}
                      <tspan fill={thumb.accent!.color}>{thumb.accent!.char}</tspan>
                    </>
                  ) : (
                    line
                  )}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </AbsoluteFill>
  );
};
