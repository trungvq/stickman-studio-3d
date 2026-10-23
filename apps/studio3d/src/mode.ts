// Công tắc chế độ lần cầm (tay theo đồ ↔ đồ theo tay): chạy `holdToItemLed` / `holdToHandLed` của rig trên JSON thô của
// cảnh, áp bản vá, đọc độ lệch. Hàm thuần; README.md § Đổi chế độ lần cầm, docs/11-nhom-cam.md § Đổi chế độ lần cầm.
import {
  applyJsonPatch,
  HOLD_MODE_ANGLE,
  HOLD_MODE_POS,
  holdToHandLed,
  holdToItemLed,
  RIG_PER_METRE,
  type HandSide,
  type HoldModeMax,
  type HoldModeResult,
  type HoldModeRow,
  type HoldRunInfo,
  type SceneRuntime,
} from "@stickman3d/rig/core";
import type { Json } from "./keys";

/** Chế độ đích của phép đổi: `item` tay theo đồ, `hand` đồ theo tay */
export type ModeTarget = "item" | "hand";

export const modeTarget = (m: HoldRunInfo["mode"]): ModeTarget => (m === "hand" ? "item" : "hand");

/** Lần cầm chứa giây `at` (lần cầm tới hết cảnh còn ở chính giây cuối) */
export const runAt = (runs: readonly HoldRunInfo[], at: number, dur: number) =>
  runs.find(
    (r) =>
      r.since <= at + 1e-9 &&
      (at < r.until - 1e-9 || (r.until >= dur - 1e-9 && at <= r.until + 1e-9)),
  );

/** Giây `t` nằm hẳn trong lần cầm, sau mốc mở: "chỉ từ đây" mới có nghĩa */
export const midRun = (run: Pick<HoldRunInfo, "since" | "until">, t: number) =>
  t > run.since + 1e-3 && t < run.until - 1e-3;

export interface ModeAsk {
  id: string;
  side: HandSide;
  /** Một giây trong lần cầm */
  at: number;
  to: ModeTarget;
  /** Chỉ đổi từ giây này (số hay `@mốc±Δ`); giữa lần cầm thì rig chèn mốc `regrip` ở đó */
  from?: number | string;
}

/** Phép đổi của rig trên `raw` (runtime `rt` dựng từ chính `raw`) và JSON thô sau bản vá; `raw` không đổi */
export function convertRun(
  rt: SceneRuntime,
  raw: Json,
  ask: ModeAsk,
  rebuild: (raw: unknown) => SceneRuntime,
): { res: HoldModeResult; raw: Json } {
  const fn = ask.to === "item" ? holdToItemLed : holdToHandLed;
  const res = fn(rt, raw, {
    id: ask.id,
    side: ask.side,
    at: ask.at,
    ...(ask.from !== undefined && { from: ask.from }),
    rebuild,
  });
  return { res, raw: applyJsonPatch(raw, res.ops) };
}

/** Đơn vị rig → cm */
export const toCm = (x: number) => (x * 100) / RIG_PER_METRE;

/** Độ dời trên bảng, cm: hai chữ số thập phân dưới 1 cm, một chữ số từ 1 cm */
export const cmText = (x: number) => {
  const c = toCm(x);
  return c < 0.005 ? "0" : c.toFixed(c < 0.995 ? 2 : 1);
};

/** Ngưỡng dời tô đỏ, cm, viết kiểu Việt (`0,2`) */
export const POS_LIMIT_CM = String(toCm(HOLD_MODE_POS)).replace(".", ",");

/** Lệch vượt ngưỡng giữ chỗ (`HOLD_MODE_POS` đơn vị rig, `HOLD_MODE_ANGLE` độ) */
export const overPos = (x: number | undefined) => (x ?? 0) > HOLD_MODE_POS;
export const overAngle = (x: number | undefined) => (x ?? 0) > HOLD_MODE_ANGLE;

/** Tâm nắm dời nhiều nhất trong các tay của hàng */
export const handMax = (r: Pick<HoldModeRow, "hand">) => Math.max(0, ...Object.values(r.hand));

/** Hàng có lệch vượt ngưỡng (món dời, món quay hay tâm nắm dời) */
export const rowOver = (r: Pick<HoldModeRow, "item" | "hand">) =>
  overPos(r.item?.pos) || overAngle(r.item?.angle) || overPos(handMax(r));

export const maxOver = (m: HoldModeMax) =>
  overPos(m.item.pos) || overAngle(m.item.angle) || overPos(m.hand);

/**
 * Lệch lớn nhất ở các hàng giữa hai mốc kề, trừ hàng đang hoà; giây là hàng lệch nặng nhất (tổng ba số, như `max` của rig).
 * Không có hàng thì `null`
 */
export function midMax(rows: readonly HoldModeRow[]): HoldModeMax | null {
  const mids = rows.filter((r) => r.kind === "mid" && !r.blending);
  if (!mids.length) return null;
  const m: HoldModeMax = { item: { pos: 0, angle: 0 }, hand: 0 };
  let worst = -1;
  for (const r of mids) {
    const h = handMax(r);
    m.item.pos = Math.max(m.item.pos, r.item?.pos ?? 0);
    m.item.angle = Math.max(m.item.angle, r.item?.angle ?? 0);
    m.hand = Math.max(m.hand, h);
    const w = (r.item?.pos ?? 0) + (r.item?.angle ?? 0) + h;
    if (w > worst) [worst, m.t] = [w, r.t];
  }
  return m;
}
