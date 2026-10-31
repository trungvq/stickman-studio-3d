import { D } from "@stickman3d/rig/core";
import type { TearsData } from "./schema";
import { hash } from "./math";
import type { FxAnchor } from "./anchor";

/** Bụng tròn, đuôi nhọn; `deg` xoay cho bụng đi trước, đuôi kéo lại sau */
function Drop({
  x,
  y,
  w,
  deg,
  opacity,
  fill,
  line,
}: {
  x: number;
  y: number;
  w: number;
  deg: number;
  opacity: number;
  fill: string;
  line: string;
}) {
  const h = w * 1.7;
  return (
    <path
      d={`M 0 ${-h} C ${w * 0.75} ${-h * 0.15} ${w} ${h * 0.35} 0 ${h * 0.62} C ${-w} ${h * 0.35} ${-w * 0.75} ${-h * 0.15} 0 ${-h} Z`}
      transform={`translate(${x} ${y}) rotate(${deg})`}
      fill={fill}
      stroke={line}
      strokeWidth={Math.max(1.6, w * 0.3)}
      strokeLinejoin="round"
      opacity={opacity}
    />
  );
}

/**
 * Nước mắt bắn ra hai bên. Giọt thứ `i` sinh ở `from + i × every`, sống `life` giây, bay
 * parabol từ chỗ con mắt **lúc nó sinh ra** — người khóc gục đầu suốt, một điểm cứng trôi
 * khỏi mặt sau vài nhịp. Con mắt hỏi qua `anchor` (tức `anchorAt` của rig).
 */
export function Tears({ fx, t, anchor }: { fx: TearsData; t: number; anchor: FxAnchor }) {
  if (t < fx.from) return null;
  const first = Math.max(0, Math.ceil((t - fx.life - fx.from) / fx.every));
  const last = Math.floor((Math.min(t, fx.to) - fx.from) / fx.every);
  const drops = [];
  for (let i = first; i <= last; i++) {
    const born = fx.from + i * fx.every;
    const tau = t - born;
    if (tau < 0 || tau > fx.life) continue;
    // Hai bên xen kẽ; `side` là bên của khung hình
    const side = i % 2 ? 1 : -1;
    const a = anchor(fx.cast, side > 0 ? "eyeLeft" : "eyeRight", born);
    if (!a) continue;
    const j = hash(i);
    const vx = fx.vx * side * (0.78 + 0.44 * j);
    const vy = fx.vy * (0.8 + 0.4 * hash(i + 101));
    const dx = fx.dx * side + fx.vx * 0.02 * side;
    const px = a.x + a.scale * (dx + vx * tau);
    const py = a.y + a.scale * (fx.dy + vy * tau + 0.5 * fx.g * tau * tau);
    const u = tau / fx.life;
    // Hình vẽ đuôi ở −y, nên −90° là đuôi quay ngược hướng bay
    const deg = Math.atan2(vy + fx.g * tau, vx) / D - 90;
    drops.push(
      <Drop
        key={i}
        x={px}
        y={py}
        w={fx.r * a.scale * (0.8 + 0.4 * j)}
        deg={deg}
        opacity={Math.min(1, tau / 0.08) * (1 - u * u)}
        fill={fx.fill}
        line={fx.line}
      />,
    );
  }
  return <g>{drops}</g>;
}
