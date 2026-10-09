import { Piece } from "./Piece";
import type { PausedThrowData } from "./schema";
import { arcAt, clamp01, easeOut, pausedTau } from "./math";

/** Tia loé lúc chạm: [góc SVG, dài] */
const SPARKS: [number, number][] = [
  [-142, 34],
  [-108, 46],
  [-72, 44],
  [-34, 30],
  [16, 24],
];

/**
 * Vật bay theo cung rồi **đứng hình** giữa trời trong `hold`, bay tiếp, chạm và loé; có
 * `bounce` thì bật ra khỏi khung. Không phải hai nhánh vẽ — chỉ là một đồng hồ khác
 * (`pausedTau`), nên seek tới đâu vẫn ra đúng hình ở đó.
 */
export function PausedThrow({ fx, url, t }: { fx: PausedThrowData; url?: string; t: number }) {
  const tau = pausedTau(fx.t0, fx.hold, t);
  if (tau < 0 || (!url && !fx.part)) return null;
  const { x, y } = arcAt(
    { x: fx.x0, y: fx.y0 },
    { x: fx.x1, y: fx.y1 },
    fx.arc,
    clamp01(tau / fx.flight),
  );
  if (tau < fx.flight)
    return (
      <g transform={`translate(${x} ${y}) rotate(${fx.deg0 + fx.spin * tau})`}>
        <Piece part={fx.part} url={url} w={fx.w} h={fx.h} />
      </g>
    );
  const s = tau - fx.flight;
  const u = fx.clang > 0 ? clamp01(s / fx.clang) : 1;
  const b = fx.bounce;
  if (b && s > b.life) return null;
  const bx = b ? x + b.vx * s : x;
  const by = b ? y + b.vy * s + 0.5 * b.g * s * s : y;
  const deg = fx.deg0 + fx.spin * fx.flight + (b ? b.spin * s : 0);
  return (
    <g>
      <g transform={`translate(${bx} ${by}) rotate(${deg})`}>
        <Piece part={fx.part} url={url} w={fx.w} h={fx.h} />
      </g>
      {u < 1 &&
        SPARKS.map(([deg, len], i) => {
          const a = (deg * Math.PI) / 180;
          const r0 = 8 + len * easeOut(u);
          const r1 = r0 + 14 * (1 - u);
          return (
            <line
              key={i}
              x1={x + Math.cos(a) * r0}
              y1={y + Math.sin(a) * r0}
              x2={x + Math.cos(a) * r1}
              y2={y + Math.sin(a) * r1}
              stroke={fx.line}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={1 - u}
            />
          );
        })}
    </g>
  );
}
