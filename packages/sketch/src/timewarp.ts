// Hai đồng hồ: giây **cảnh** (thứ `sceneAt` nhận) và giây **màn hình** (thứ frame đếm).
// Chậm hay nhanh khai bằng giây cảnh, nên kéo đoạn slow-mo đi không phải tính lại mốc nào.
// Cả hai chiều đọc chung một bảng — hai công thức rời nhau lệch `0,005 s` là ra hai cây
// rìu trong một khung. Ở rig chứ không ở app Remotion vì `stickman check` cũng phải đo
// được độ dài một shot để so với tiếng. Xem docs/07-lam-tap.md.

/** Một đoạn chạy chậm (hay nhanh) khai bằng giây cảnh; `rate` nhỏ hơn 1 là chậm lại */
export interface WarpSlow {
  from: number;
  to: number;
  rate: number;
}

/** Một đoạn của bảng: `[from, to)` giây cảnh, chạy `rate` lần tốc độ, mở màn ở `screen` */
export interface WarpSpan extends WarpSlow {
  screen: number;
}

/** Bảng đoạn phủ kín `[0, ∞)`; đoạn không khai thì `rate` là 1 */
export function warpTable(slows: WarpSlow[] = []): WarpSpan[] {
  const sorted = [...(slows ?? [])].sort((a, b) => a.from - b.from);
  const spans: WarpSpan[] = [];
  let at = 0;
  let screen = 0;
  const push = (from: number, to: number, rate: number) => {
    spans.push({ from, to, rate, screen });
    screen += (to - from) / rate;
  };
  for (const s of sorted) {
    if (s.to <= at) continue;
    const from = Math.max(s.from, at);
    if (from > at) push(at, from, 1);
    push(from, s.to, s.rate);
    at = s.to;
  }
  spans.push({ from: at, to: Infinity, rate: 1, screen });
  return spans;
}

/** Giây màn hình → giây cảnh */
export function sceneTime(screen: number, table: WarpSpan[]): number {
  let i = 0;
  while (i + 1 < table.length && table[i + 1].screen <= screen) i++;
  const s = table[i];
  return s.from + (screen - s.screen) * s.rate;
}

/** Giây cảnh → giây màn hình; độ dài một shot có slow-mo đo bằng hàm này */
export function screenTime(scene: number, table: WarpSpan[]): number {
  let i = 0;
  while (i + 1 < table.length && table[i + 1].from <= scene) i++;
  const s = table[i];
  return s.screen + (scene - s.from) / s.rate;
}
