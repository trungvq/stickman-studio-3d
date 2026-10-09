import { SCENE_CANVAS, type FrameSpec } from "@stickman3d/sketch";
import type { IrisData } from "./schema";
import { clamp01, easeInOut } from "./math";

/** Bán kính đủ phủ hết khung sân khấu từ `(x, y)`, đo tới góc xa nhất */
const cover = (x: number, y: number, W: number, H: number) =>
  Math.hypot(
    Math.max(Math.abs(x - W / 2), Math.abs(x + W / 2)),
    Math.max(Math.abs(y - H / 2), Math.abs(y + H / 2)),
  );

/**
 * Iris khép kiểu phim câm: mặt nạ tối có lỗ tròn thu dần vào một khuôn mặt, giữ, rồi đóng.
 * Một `path` evenodd — chữ nhật phủ dư ra ngoài khung trừ hình tròn — nên không đụng cây
 * cast bên dưới và camera kẹp mép cũng không lộ.
 */
export function Iris({
  fx,
  t,
  frame = SCENE_CANVAS,
}: {
  fx: IrisData;
  t: number;
  frame?: FrameSpec;
}) {
  if (t < fx.from) return null;
  const { w: W, h: H } = frame;
  const r0 = cover(fx.x, fx.y, W, H) * 1.05;
  let r: number;
  if (t < fx.to) r = r0 + (fx.r - r0) * easeInOut(clamp01((t - fx.from) / (fx.to - fx.from)));
  else if (t < fx.close) r = fx.r;
  else r = fx.r * (1 - easeInOut(clamp01((t - fx.close) / fx.shut)));
  const pad = 2 * Math.max(W, H);
  const d =
    `M ${-W / 2 - pad} ${-H / 2 - pad} h ${W + 2 * pad} v ${H + 2 * pad} h ${-(W + 2 * pad)} Z ` +
    (r > 0.01
      ? `M ${fx.x - r} ${fx.y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`
      : "");
  return <path d={d} fill={fx.color} fillRule="evenodd" />;
}
