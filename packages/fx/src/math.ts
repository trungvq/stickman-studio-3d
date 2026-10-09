export type Pt = { x: number; y: number };

/** Nhiễu tất định theo số thứ tự: cùng `i` luôn ra cùng số, nên seek tới frame nào cũng ra đúng hình ấy. Đổi `seed` cho hai lớp khỏi trùng nhịp */
export const hash = (i: number, seed = 12.9898): number => {
  const v = Math.sin(i * seed) * 43758.5453;
  return v - Math.floor(v);
};

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const easeOut = (u: number): number => 1 - (1 - u) * (1 - u);
export const easeOutCubic = (u: number): number => 1 - (1 - u) * (1 - u) * (1 - u);
/** smoothstep: chậm hai đầu, nhanh ở giữa */
export const easeInOut = (u: number): number => u * u * (3 - 2 * u);
/** Bật ra quá một nhịp rồi về (`easeOutBack`) */
export const pop = (u: number): number => {
  if (u >= 1) return 1;
  const p = u - 1;
  return 1 + 2.7 * p * p * p + 1.7 * p * p;
};

export const mix = (a: number, b: number, u: number): number => a + (b - a) * u;

/** Cung bậc hai từ `a` tới `b`, điểm điều khiển kéo lên `arc` (y xuống nên âm là vồng lên); `u` 0→1 */
export function arcAt(a: Pt, b: Pt, arc: number, u: number): Pt {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2 + arc;
  const v = 1 - u;
  return {
    x: v * v * a.x + 2 * v * u * cx + u * u * b.x,
    y: v * v * a.y + 2 * v * u * cy + u * u * b.y,
  };
}

/** Parabol: chỗ của vật ném sau `tau` giây, `vy` âm là bay lên vì y xuống */
export const flightAt = (
  o: { x0: number; y0: number; vx: number; vy: number; g: number },
  tau: number,
): Pt => ({ x: o.x0 + o.vx * tau, y: o.y0 + o.vy * tau + 0.5 * o.g * tau * tau });

/** Đồng hồ riêng của vật bị bấm dừng: giây đã bay kể từ `t0`, trừ quãng `hold` */
export function pausedTau(t0: number, hold: { from: number; to: number }, t: number): number {
  if (t < hold.from) return t - t0;
  if (t < hold.to) return hold.from - t0;
  return t - t0 - (hold.to - hold.from);
}

export const chord = (a: Pt, b: Pt): number => Math.hypot(b.x - a.x, b.y - a.y);
