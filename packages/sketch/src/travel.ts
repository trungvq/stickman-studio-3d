import { feet, type Legs } from "./geometry";
import type { Pose, Pt } from "./types";

/** Bước lấy mẫu lúc nướng bảng (giây); cố định để Remotion và studio ra cùng một bảng */
export const TRAVEL_STEP = 1 / 120;
/** Bàn chân cao hơn chân thấp nhất chưa tới ngần này (đơn vị rig, `height = 1`) thì còn trong dải chạm đất */
const GROUND_EPS = 4;

/** Trôi ngang đã nướng: `xs[k]` là x của root tại `k · step`, tính cho `height = 1`. */
export interface TravelTable {
  step: number;
  xs: number[];
}

/** Bàn chân trong dải chạm đất; `ys` là độ cao (xuống là dương) quy về `height = 1` */
export const standing = (ys: number[]): number[] => {
  const lowest = Math.max(...ys);
  return ys.flatMap((y, i) => (y >= lowest - GROUND_EPS ? [i] : []));
};

/**
 * Một bước của luật chân chịu lực: chân đang chịu lực giữ quyền tới khi rời dải chạm đất, chân
 * mới chỉ được nhận khi nó ngừng tiến (`v` — vận tốc tiến so với gốc — không dương).
 */
export function nextBearing(bearing: number[], ys: number[], v: number[]): number[] {
  const down = standing(ys);
  const out = bearing.filter((i) => down.includes(i));
  for (const i of down) if (!out.includes(i) && v[i] <= 0) out.push(i);
  return out;
}

/**
 * Nướng trôi ngang từ bàn chân bám đất: chân chịu lực dịch bao nhiêu so với gốc thì
 * gốc dịch ngược lại bấy nhiêu. Rig không có cổ chân nên lúc hai chân mở ra, chân đang
 * đáp thấp ngang chân đang đẩy — vì vậy chân mới chỉ được nhận là chịu lực khi nó
 * **ngừng tiến** (chạm gót), chân đang chịu lực giữ quyền cho tới khi rời dải chạm đất,
 * không chân nào chịu lực thì gốc giữ đà. Nhiều chân cùng chịu lực thì lấy trung bình:
 * dang chân đối xứng không làm người dịch. Số chân là bao nhiêu cũng được — người hai
 * chân và động vật bốn chân đi chung một hàm. docs/01-rig.md
 */
export function bakeFeetTravel(feetAt: (t: number) => Pt[], duration: number): TravelTable {
  const n = Math.max(1, Math.ceil(duration / TRAVEL_STEP - 1e-9));
  const step = duration / n;
  const xs = [0];
  let prev = feetAt(0);
  let bearing = standing(prev.map((p) => p[1]));
  let dx = 0;
  let x = 0;
  for (let k = 1; k <= n; k++) {
    const cur = feetAt(k * step);
    // Số bàn chân đổi là vừa cất cánh hay vừa đáp: không chân nào có gì để so, đứng yên chứ
    // không giữ đà — con vật đang bay trôi ngang bằng `path`, không phải bằng chân
    if (cur.length !== prev.length) {
      bearing = standing(cur.map((p) => p[1]));
      dx = 0;
      xs.push(x);
      prev = cur;
      continue;
    }
    const v = cur.map((p, i) => p[0] - prev[i][0]);
    bearing = nextBearing(
      bearing,
      cur.map((p) => p[1]),
      v,
    );
    if (bearing.length) dx = bearing.reduce((s, i) => s + v[i], 0) / bearing.length;
    x -= dx;
    xs.push(x);
    prev = cur;
  }
  return { step, xs };
}

/** Trôi ngang của một chu kỳ tư thế người; `feet` là hai bàn chân so với tâm hông, `legs` đổi độ dài chân. */
export const bakeTravel = (
  poseAt: (t: number) => Pose,
  duration: number,
  legs?: Legs,
): TravelTable => bakeFeetTravel((t) => feet(poseAt(t), 1, legs), duration);

/** Tra bảng tại `t` giây, nội suy thẳng; ngoài bảng thì kẹp ở hai đầu. */
export function travelAt(tb: TravelTable, t: number): number {
  const last = tb.xs.length - 1;
  const u = Math.min(last, Math.max(0, t / tb.step));
  const i = Math.min(last - 1, Math.floor(u));
  if (last === 0) return 0;
  return tb.xs[i] + (tb.xs[i + 1] - tb.xs[i]) * (u - i);
}

/** Trôi của một hành động lặp: bảng nướng cho một lượt `duration` giây, `end` của file quyết định ngoài lượt. */
export function loopTravel(tb: TravelTable, duration: number, end: "wrap" | "hold", s: number) {
  if (end === "hold") return travelAt(tb, s);
  const n = Math.floor(s / duration);
  return n * tb.xs[tb.xs.length - 1] + travelAt(tb, s - n * duration);
}
