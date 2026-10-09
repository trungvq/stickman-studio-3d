import { Piece } from "./Piece";
import type { FlyData } from "./schema";
import { arcAt, clamp01, easeInOut, mix } from "./math";

/** Ba vòng sáng mờ chạy quanh vật suốt đường bay: [pha, bán kính phần] */
const RINGS: [number, number][] = [
  [0, 1],
  [0.33, 0.78],
  [0.66, 0.56],
];

/**
 * Vật bay có phép từ tay này sang tay kia: cung tự chọn, không rơi, kèm vành sáng vẽ
 * **dưới** vật. Chậm hai đầu nhanh ở giữa — đường thẳng đều đọc ra bị kéo bằng dây. Cỡ và
 * góc nội suy giữa hai đầu, nên vật to dần là nó đi từ xa về gần.
 */
export function Fly({ fx, url, t, id }: { fx: FlyData; url?: string; t: number; id: string }) {
  const tau = t - fx.t0;
  if (tau < 0 || tau > fx.flight || (!url && !fx.part)) return null;
  const raw = tau / fx.flight;
  const u = easeInOut(clamp01(raw));
  const { x, y } = arcAt({ x: fx.x0, y: fx.y0 }, { x: fx.x1, y: fx.y1 }, fx.arc, u);
  const w = mix(fx.w0, fx.w1, u);
  const h = mix(fx.h0, fx.h1, u);
  const deg = mix(fx.deg0, fx.deg1, u);
  // Sáng lên 15% đầu, tắt 25% cuối: tới nơi thì mảnh trên tay hiện ra không kèm hào quang
  const a = Math.min(1, raw / 0.15) * Math.min(1, (1 - raw) / 0.25);
  const halo = `fly-${id}`;
  const rad = (h / 2) * fx.r;
  return (
    <g>
      <defs>
        <radialGradient id={halo}>
          <stop offset="0%" stopColor={fx.color} stopOpacity={0.05} />
          <stop offset="45%" stopColor={fx.color} stopOpacity={0.32} />
          <stop offset="75%" stopColor={fx.color} stopOpacity={0.14} />
          <stop offset="100%" stopColor={fx.color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={rad} fill={`url(#${halo})`} opacity={a} />
      {RINGS.map(([phase, part], i) => {
        const k = (((raw * 2.6 + phase) % 1) + 1) % 1;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={rad * part * (0.45 + 0.75 * k)}
            fill="none"
            stroke={fx.color}
            strokeWidth={2.4}
            opacity={a * 0.5 * (1 - k)}
          />
        );
      })}
      <g transform={`translate(${x} ${y}) rotate(${deg})`}>
        <Piece part={fx.part} url={url} w={w} h={h} />
      </g>
    </g>
  );
}
