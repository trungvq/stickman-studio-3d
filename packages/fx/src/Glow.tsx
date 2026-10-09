import type { GlowData } from "./schema";
import { clamp01, easeOut, hash } from "./math";

/**
 * Sao bốn cánh nhọn, eo thắt. Cong bằng `C` với hai điểm điều khiển nằm trên trục: một `Q`
 * dù đặt sát tâm vẫn phồng giữa cánh tới 0.35 × `arm`, bốn chỗ phồng gặp nhau thành hình
 * thoi đặc che mất vật đang phát sáng.
 */
const star4 = (cx: number, cy: number, arm: number, aspect = 1) => {
  const ax = arm * aspect;
  const k = 0.03;
  const kx = ax * k;
  const ky = arm * k;
  return [
    `M ${cx} ${cy - arm}`,
    `C ${cx} ${cy - ky} ${cx + kx} ${cy} ${cx + ax} ${cy}`,
    `C ${cx + kx} ${cy} ${cx} ${cy + ky} ${cx} ${cy + arm}`,
    `C ${cx} ${cy + ky} ${cx - kx} ${cy} ${cx - ax} ${cy}`,
    `C ${cx - kx} ${cy} ${cx} ${cy - ky} ${cx} ${cy - arm}`,
    "Z",
  ].join(" ");
};

/**
 * Hào quang. `rays`: quầng + nan tia quay + vũng sáng dẹt, cho nguồn sáng ở một chỗ.
 * `sparkle`: vành khuyên + đám sao nhỏ chớp lệch pha, cho một vật đang cầm — giữa để trống,
 * vì quầng đặc tẩy trắng đúng cái vật cú cận dựng ra để nhìn.
 */
export function Glow({ fx, t, id }: { fx: GlowData; t: number; id: string }) {
  if (t < fx.from || t > fx.to) return null;
  const a = easeOut(clamp01((t - fx.from) / fx.rise)) * easeOut(clamp01((fx.to - t) / fx.fall));
  if (a <= 0) return null;
  const age = t - fx.from;
  const spun = fx.spin * age;
  const halo = `halo-${id}`;
  const pool = `pool-${id}`;

  if (fx.style === "sparkle") {
    const beat = 0.5 + 0.5 * Math.sin(2 * Math.PI * 1.4 * age);
    return (
      <g>
        <defs>
          <radialGradient id={halo}>
            <stop offset="0%" stopColor={fx.color} stopOpacity={0.06} />
            <stop offset="40%" stopColor={fx.color} stopOpacity={0.34} />
            <stop offset="72%" stopColor={fx.color} stopOpacity={0.16} />
            <stop offset="100%" stopColor={fx.color} stopOpacity={0} />
          </radialGradient>
        </defs>
        <circle
          cx={fx.x}
          cy={fx.y}
          r={fx.r * 1.45}
          fill={`url(#${halo})`}
          opacity={a * (0.72 + 0.28 * beat)}
        />
        <g transform={`rotate(${spun * 0.35} ${fx.x} ${fx.y})`} opacity={a}>
          {Array.from({ length: fx.rays }, (_, i) => {
            const per = 0.5 + 0.85 * hash(i * 3 + 1);
            const u = (((age / per + hash(i * 3 + 2)) % 1) + 1) % 1;
            if (u > 0.55) return null;
            const s = Math.sin((Math.PI * u) / 0.55);
            // Góc chia đều rồi mới thêm nhiễu: hash thuần vón thành chùm về một phía
            const ang = ((i + 0.5) / fx.rays) * Math.PI * 2 + (hash(i * 3 + 3) - 0.5) * 0.9;
            const d = 0.58 + 0.62 * hash(i * 5 + 4);
            const px = fx.x + Math.cos(ang) * fx.r * 0.88 * d;
            const py = fx.y + Math.sin(ang) * fx.r * 1.1 * d;
            const sa = fx.ray * (0.32 + 0.68 * hash(i * 7 + 5)) * (1.3 - 0.5 * d) * s;
            return (
              <g key={i} transform={`rotate(${hash(i * 11 + 6) * 90} ${px} ${py})`}>
                <path d={star4(px, py, sa)} fill={fx.color} opacity={0.95} />
                <path d={star4(px, py, sa * 0.45)} fill="#ffffff" opacity={0.95} />
              </g>
            );
          })}
        </g>
      </g>
    );
  }

  return (
    <g>
      <defs>
        <radialGradient id={halo}>
          <stop offset="0%" stopColor={fx.color} stopOpacity={0.85} />
          <stop offset="45%" stopColor={fx.color} stopOpacity={0.32} />
          <stop offset="100%" stopColor={fx.color} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={pool}>
          <stop offset="0%" stopColor={fx.color} stopOpacity={0.95} />
          <stop offset="60%" stopColor={fx.color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={fx.color} stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={fx.x} cy={fx.y} r={fx.r * 1.5} fill={`url(#${halo})`} opacity={a * 0.7} />
      <g transform={`rotate(${spun} ${fx.x} ${fx.y})`} opacity={a}>
        {Array.from({ length: fx.rays }, (_, i) => {
          const deg = (i * 360) / fx.rays;
          const rad = (deg * Math.PI) / 180;
          // Bình phương cho chỗ chuyển mượt, khỏi thấy tia tắt phụt ở đường chân trời
          const k = Math.max(0, -Math.sin(rad + (spun * Math.PI) / 180));
          const w = 1 - fx.up + fx.up * k * k;
          if (w <= 0.02) return null;
          const len = fx.ray * (0.62 + 0.38 * hash(i));
          const half = (fx.r * 0.16) / len;
          const p = (d: number) => {
            const r = (d * Math.PI) / 180;
            return `${fx.x + Math.cos(r) * fx.r * 0.35} ${fx.y + Math.sin(r) * fx.r * 0.35}`;
          };
          return (
            <path
              key={i}
              d={`M ${p(deg - half * 40)} L ${fx.x + Math.cos(rad) * len} ${fx.y + Math.sin(rad) * len} L ${p(deg + half * 40)} Z`}
              fill={fx.color}
              opacity={0.5 * w}
            />
          );
        })}
      </g>
      <ellipse cx={fx.x} cy={fx.y} rx={fx.r} ry={fx.r * 0.3} fill={`url(#${pool})`} opacity={a} />
    </g>
  );
}
