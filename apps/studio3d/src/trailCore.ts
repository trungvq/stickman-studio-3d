// Vệt của bàn tay đang chọn (Dáng tay), phần không `three`: giây lấy mẫu, mẫu cổ tay / khuỷu / tâm món như `check` đo
// (`actJoints`), lượt lấy mẫu theo `t` tăng có huỷ, lọc giật của `check` (`sceneSnaps`, `elbowLockSnaps`) cho vệt. Luồng vệt
// (`trailWorker.ts`) chạy phần này; `trails.ts` vẽ. README.md § Dáng tay.
import {
  actArm,
  actJoints,
  AIM_BEND,
  AIM_DEV,
  BODY3,
  sceneAt,
  TURN_MAX,
  type ActInput,
  type ElbowLockSnap,
  type HandSide,
  type HoldRunInfo,
  type SceneRuntime,
  type Snap,
} from "@stickman3d/rig/core";
import { drawnItemAt } from "./drawn";
import type { V3 } from "./keys";

export type WristJoint = "turn" | "bend" | "dev";

/** Một giây của vệt: khung `1/fps` hay giây của mốc nằm giữa hai khung */
export interface TrailTime {
  t: number;
  /** Chỉ số khung (`t · fps`); giây của mốc lệch khung thì `undefined` */
  frame?: number;
  /** Giây của một mốc tay (cổ tay, khuỷu) hay mốc món (tâm món) */
  key?: "hand" | "item" | "both";
}

export interface TrailSample extends TrailTime {
  /** Cổ tay, khuỷu như `actJoints` (thế giới rig); người không có `world` thì `null` */
  wrist: V3 | null;
  elbow: V3 | null;
  /** Tâm hộp bao của món tay ấy đang cầm, như vẽ */
  item: V3 | null;
  /** Khớp cổ tay ở giới hạn, như `handReport.wrist.clamped` */
  clamped: WristJoint[];
}

const E = 1e-6;

/**
 * Giây lấy mẫu của vệt quanh `t` trong `±span`: mọi khung `1/fps` trong cảnh, cộng giây mốc tay `hands` và mốc món `items`
 * nằm giữa hai khung; theo thứ tự tăng (đồ theo tay nhớ chuỗi cổ tay từ mốc gần nhất: lấy mẫu lùi là giải lại từ đầu)
 */
export function trailTimes(
  t: number,
  span: number,
  fps: number,
  dur: number,
  hands: readonly number[] = [],
  items: readonly number[] = [],
): TrailTime[] {
  const lo = Math.max(0, Math.ceil((t - span) * fps - E));
  const hi = Math.min(Math.floor(dur * fps + E), Math.floor((t + span) * fps + E));
  const out = new Map<string, TrailTime>();
  for (let i = lo; i <= hi; i++) out.set(String(i), { t: i / fps, frame: i });
  const mark = (k: number, kind: "hand" | "item") => {
    if (k < lo / fps - E || k > hi / fps + E) return;
    const i = Math.round(k * fps);
    const id = Math.abs(i / fps - k) < E ? String(i) : k.toFixed(6);
    const x = out.get(id) ?? { t: k };
    x.key = x.key && x.key !== kind ? "both" : kind;
    out.set(id, x);
  };
  for (const k of hands) mark(k, "hand");
  for (const k of items) mark(k, "item");
  return [...out.values()].sort((a, b) => a.t - b.t);
}

const WRIST: readonly WristJoint[] = ["turn", "bend", "dev"];
/** Cách biên miền `[lo, hi]`, dương là vượt — như `rangeMargin` của lõi */
const margin = (v: number, [lo, hi]: readonly [number, number]) => Math.max(lo - v, v - hi);

/** Lần cầm chứa giây `t` (lần cầm tới hết cảnh còn ở chính giây cuối) */
export const runAt = (runs: readonly HoldRunInfo[], t: number, dur: number) =>
  runs.find(
    (r) =>
      r.since <= t + 1e-9 && (t < r.until - 1e-9 || (r.until >= dur - 1e-9 && t <= r.until + 1e-9)),
  );

/**
 * Mẫu tay `side` của `id` ở giây `x.t`: cổ tay, khuỷu (`actJoints` của nhân vật `rt.chars[id]`, như `check`), tâm món của
 * lần cầm `runs` ở giây ấy (`drawnItemAt`, cùng nhân vật và tư thế), khớp cổ tay kẹp như `handReport` (món:
 * `AimReport.hold.clamped`; không món: góc vẽ chạm giới hạn)
 */
export function trailSample(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  x: TrailTime,
  runs: readonly HoldRunInfo[],
): TrailSample {
  const out: TrailSample = { ...x, wrist: null, elbow: null, item: null, clamped: [] };
  const c = rt.chars?.[id];
  if (!c) return out;
  const sp = sceneAt(rt, id, x.t, rt.heights[id] ?? 1, rt.bodies[id] ?? BODY3) as ActInput;
  if (!sp.world) return out;
  const tag = side === "right" ? "R" : "L";
  const J = actJoints(c, sp);
  if (J) [out.wrist, out.elbow] = [[...J[`wrist${tag}`]] as V3, [...J[`elbow${tag}`]] as V3];
  const a = actArm(c, sp, side === "right" ? -1 : 1);
  if (a) {
    const [turn, bend, dev] = a.wrist;
    const w = { turn, bend, dev };
    out.clamped =
      a.report.hold?.clamped ??
      WRIST.filter((k) =>
        k === "turn"
          ? Math.abs(w.turn) >= TURN_MAX - 0.05
          : margin(w[k], k === "bend" ? AIM_BEND : AIM_DEV) >= -0.05,
      );
  }
  const run = runAt(runs, x.t, rt.duration);
  if (run && run.group !== "carry")
    out.item = drawnItemAt(rt, id, side, run.item, x.t, c, sp) ?? null;
  return out;
}

export interface RunOptions {
  /** ms làm liền một mạch trước khi nhường */
  budget: number;
  now(): number;
  /** Nhường luồng (thư mới tới được) */
  pause(): Promise<void>;
  /** Lượt này còn là lượt mới nhất */
  alive(): boolean;
}

/**
 * Lấy mẫu `times` theo đúng thứ tự, nhường mỗi `budget` ms; lượt bị thay (`alive` sai sau khi nhường) thì bỏ, trả `null`
 */
export async function runTrail<T>(
  times: readonly TrailTime[],
  sample: (x: TrailTime) => T,
  o: RunOptions,
): Promise<T[] | null> {
  const out: T[] = [];
  let t0 = o.now();
  for (const x of times) {
    if (o.now() - t0 > o.budget) {
      await o.pause();
      if (!o.alive()) return null;
      t0 = o.now();
    }
    out.push(sample(x));
  }
  return o.alive() ? out : null;
}

/** Nhãn khớp của giật không nằm trên vệt */
const JOINT_NAME: Record<string, string> = {
  kneeR: "gối phải",
  kneeL: "gối trái",
  footR: "bàn chân phải",
  footL: "bàn chân trái",
  elbowR: "khuỷu phải",
  elbowL: "khuỷu trái",
  wristR: "cổ tay phải",
  wristL: "cổ tay trái",
  handR: "bàn tay phải",
  handL: "bàn tay trái",
  head: "đầu",
};

/** Giật của `check` trên vệt tay `side`: chỉ số khung đỏ của vệt cổ tay, vệt khuỷu; giật khác của người ấy */
export interface TrailSnaps {
  wrist: number[];
  elbow: number[];
  other: { t: number; what: string }[];
}

/**
 * Lọc giật của người `id` cho vệt tay `side` ở nhịp `fps`: cú giật `sceneSnaps` (khung sau cú nhảy, `Snap.t`) nhắc cổ tay
 * hay bàn tay bên ấy (khớp chính hay `also`) đỏ ở vệt cổ tay, nhắc khuỷu đỏ ở vệt khuỷu — giây của nó ở nhịp đo khác thì
 * khung vệt chứa cú nhảy (khung đầu từ `Snap.t` trở đi); quãng khuỷu khoá xoay quá nhanh (`elbowLockSnaps`) bên ấy đỏ mọi
 * khung trong `(from, to]` ở vệt khuỷu. Còn lại vào `other`
 */
export function trailSnaps(
  snaps: readonly Snap[],
  locks: readonly ElbowLockSnap[],
  id: string,
  side: HandSide,
  fps: number,
): TrailSnaps {
  const tag = side === "right" ? "R" : "L";
  const wrist = new Set<number>();
  const elbow = new Set<number>();
  const other: TrailSnaps["other"] = [];
  for (const s of snaps) {
    if (s.id !== id) continue;
    const js = [s.joint, ...s.also];
    const i = Math.ceil(s.t * fps - E);
    const w = js.includes(`wrist${tag}`) || js.includes(`hand${tag}`);
    const e = js.includes(`elbow${tag}`);
    if (w) wrist.add(i);
    if (e) elbow.add(i);
    if (!w && !e) other.push({ t: s.t, what: JOINT_NAME[s.joint] ?? s.joint });
  }
  for (const s of locks) {
    if (s.id !== id) continue;
    if (s.hand !== side) {
      other.push({ t: s.from, what: `khuỷu khoá ${s.hand === "right" ? "phải" : "trái"}` });
      continue;
    }
    const a = Math.floor(s.from * fps + E) + 1;
    const b = Math.floor(s.to * fps + E);
    for (let i = a; i <= b; i++) elbow.add(i);
  }
  const sort = (x: Set<number>) => [...x].sort((p, q) => p - q);
  return { wrist: sort(wrist), elbow: sort(elbow), other: other.sort((p, q) => p.t - q.t) };
}
