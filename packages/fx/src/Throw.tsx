import { Piece } from "./Piece";
import type { ThrowData } from "./schema";
import { clamp01, easeOut, flightAt } from "./math";

/** Tia nước tóe lúc chạm: [góc SVG (0 là +x, âm là lên), dài] */
const DROPS: [number, number][] = [
  [-152, 58],
  [-124, 84],
  [-96, 96],
  [-68, 80],
  [-38, 54],
];

/** Ba vòng sóng: [trễ, đời] giây kể từ lúc chạm */
const RINGS: [number, number][] = [
  [0, 0.55],
  [0.22, 0.55],
  [0.44, 0.55],
];

/** Chỗ vật chạm — vòng sóng, bọt (`fizz`) và tiếng tõm đều lấy điểm này, khai một chỗ */
export const throwLanding = (fx: ThrowData) => ({
  t: fx.t0 + fx.flight,
  ...flightAt(fx, fx.flight),
});

/**
 * Vật rời tay: bay parabol + xoay, chạm rồi tóe và loang sóng nếu có `splash` / `ripple`.
 * Trước `t0` trả `null` — cái trên tay là đồ của nhân vật, `equip` tắt đúng giây ấy.
 */
export function Throw({ fx, url, t }: { fx: ThrowData; url?: string; t: number }) {
  const tau = t - fx.t0;
  if (tau < 0) return null;
  const { x, y } = flightAt(fx, Math.min(tau, fx.flight));

  if (tau < fx.flight) {
    if (!url) return null;
    const k = 1 - fx.shrink * (tau / fx.flight);
    return (
      <g transform={`translate(${x} ${y}) rotate(${fx.deg0 + fx.spin * tau}) scale(${k})`}>
        <Piece url={url} w={fx.w} h={fx.h} />
      </g>
    );
  }

  const s = tau - fx.flight;
  if (s > Math.max(fx.ripple, fx.splash)) return null;
  const drop = fx.splash > 0 ? clamp01(s / fx.splash) : 1;
  return (
    <g>
      {s <= fx.ripple &&
        RINGS.map(([delay, life], i) => {
          const u = clamp01((s - delay) / life);
          if (s < delay || u >= 1) return null;
          const rx = 10 + 100 * easeOut(u);
          return (
            <ellipse
              key={i}
              cx={x}
              cy={y}
              rx={rx}
              ry={rx * 0.26}
              fill="none"
              stroke={fx.line}
              strokeWidth={3}
              opacity={0.75 * (1 - u)}
            />
          );
        })}
      {drop < 1 &&
        DROPS.map(([deg, len], i) => {
          const a = (deg * Math.PI) / 180;
          const r0 = 6 + len * easeOut(drop);
          const r1 = r0 + 16 * (1 - drop);
          return (
            <line
              key={i}
              x1={x + Math.cos(a) * r0}
              y1={y + Math.sin(a) * r0 * 0.8}
              x2={x + Math.cos(a) * r1}
              y2={y + Math.sin(a) * r1 * 0.8}
              stroke={fx.foam}
              strokeWidth={4}
              strokeLinecap="round"
              opacity={1 - drop}
            />
          );
        })}
      {drop < 1 && (
        <ellipse
          cx={x}
          cy={y}
          rx={12 + 34 * easeOut(drop)}
          ry={(12 + 34 * easeOut(drop)) * 0.3}
          fill={fx.foam}
          opacity={0.8 * (1 - drop)}
        />
      )}
    </g>
  );
}
