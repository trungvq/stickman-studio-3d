import { headOver, mixAim, mixAngles, mixReach, rawAim, smoothstep, stretchOver } from "./action";
import { HAND_REST, mixHand } from "./hand";
import {
  LIFT_CHANNELS,
  REACH_CHANNELS,
  type AimMap,
  type FaceState,
  type HandMap,
  type Lift,
  type Pose,
  type ReachMap,
} from "./types";

/** Tốc độ coi là vừa mắt khi hoà hai hành động (độ/giây); τ suy từ biên độ, không phải hằng số */
const BLEND_RATE = 400;
export const BLEND_MIN = 0.12;
export const BLEND_MAX = 0.4;

/** Kênh mang một dãy số; tay ba hay bốn số, chân hai hay ba, `head` ba, `stretch` tám hệ số */
const VECTORS = ["af", "an", "lf", "ln", "head", "stretch"] as const;

/**
 * Đi qua từng kênh của hai bên, bên nào không ghi thì lấy `base`; `stretch` xét theo từng chi, `head`
 * theo từng góc, `torso` là `[cúi, nghiêng]`.
 */
function eachChannel(
  base: Pose,
  from: Partial<Pose>,
  to: Partial<Pose>,
  vec: (k: (typeof VECTORS)[number], a: readonly number[], b: readonly number[]) => void,
  torso: (a: readonly number[], b: readonly number[]) => void,
) {
  for (const k of VECTORS) {
    if (!from[k] && !to[k]) continue;
    if (k === "stretch") vec(k, stretchOver(base.stretch, from), stretchOver(base.stretch, to));
    else if (k === "head") vec(k, headOver(base.head, from), headOver(base.head, to));
    else vec(k, from[k] ?? base[k], to[k] ?? base[k]);
  }
  const bent = (p: Partial<Pose>) =>
    p.torso !== undefined ? [p.torso, p.lean ?? 0] : [base.torso, base.lean ?? 0];
  if (from.torso !== undefined || to.torso !== undefined) torso(bent(from), bent(to));
}

/** Bàn tay hai bên theo từng kênh tay: bên không ghi lấy của `base`, `base` không có thì `HAND_REST` */
function eachHand(
  base: Pose,
  from: Partial<Pose>,
  to: Partial<Pose>,
  vec: (k: keyof HandMap, a: readonly number[], b: readonly number[]) => void,
) {
  for (const k of REACH_CHANNELS) {
    const a = from.hand?.[k];
    const b = to.hand?.[k];
    if (!a && !b) continue;
    const under = base.hand?.[k] ?? HAND_REST;
    vec(k, a ?? under, b ?? under);
  }
}

/**
 * Hoà hai kết quả `actionPose` theo `f: 0 → 1` (đã smoothstep bên trong).
 * Kênh chỉ một bên ghi thì bên kia lấy từ `base` — không thì chi đứng chết ở tư thế cũ.
 */
export function blendPose(
  base: Pose,
  from: Partial<Pose>,
  to: Partial<Pose>,
  f: number,
): Partial<Pose> {
  if (f >= 1) return to;
  const w = f <= 0 ? 0 : smoothstep(f);
  const o: Partial<Pose> = {};
  eachChannel(
    base,
    from,
    to,
    (k, a, b) => Object.assign(o, { [k]: mixAngles(a, b, w) }),
    (a, b) => ([o.torso, o.lean] = mixAngles(a, b, w) as number[]),
  );
  // Cờ nâng không hoà được: nửa đầu đoạn hoà theo bên cũ, nửa sau theo bên mới
  // Bên đang thắng ghi kênh nào thì cờ của kênh ấy theo bên đó, kể cả khi bên đó không nâng
  if (base.lift || from.lift || to.lift) {
    const side = w < 0.5 ? from : to;
    const lift: Lift = { ...base.lift };
    for (const k of LIFT_CHANNELS) if (side[k]) lift[k] = !!side.lift?.[k];
    o.lift = lift;
  }
  // Đích cổ tay hoà trên vị trí: rig giải IK tới điểm đã hoà, độ dài đoạn giữ nguyên
  if (base.reach || from.reach || to.reach) {
    const reach: ReachMap = {};
    for (const k of REACH_CHANNELS) {
      if (!from[k] && !to[k]) continue;
      const r = mixReach((from[k] ? from : base).reach?.[k], (to[k] ? to : base).reach?.[k], w);
      if (r) reach[k] = r;
    }
    if (Object.keys(reach).length) o.reach = reach;
  }
  // Bàn tay hoà trên góc khớp, cả xoay cẳng tay và gập cổ tay: dáng tay đổi dần, không nhảy
  const hand: HandMap = {};
  eachHand(base, from, to, (k, a, b) => (hand[k] = mixHand(a, b, w)));
  if (Object.keys(hand).length) o.hand = hand;
  // Lòng tay theo ý định hoà trên số hạng: bên thô là một số hạng xoay, gập cổ tay của chính nó
  if (base.aim || from.aim || to.aim) {
    const aim: AimMap = {};
    for (const k of REACH_CHANNELS) {
      if (!from.hand?.[k] && !to.hand?.[k]) continue;
      const side = (p: Partial<Pose>) => {
        const q = p.hand?.[k] ? p : base;
        return q.aim?.[k] ?? rawAim(q.hand?.[k] ?? HAND_REST);
      };
      const has = (p: Partial<Pose>) => !!(p.hand?.[k] ? p : base).aim?.[k];
      if (has(from) || has(to)) aim[k] = mixAim(side(from), side(to), w);
    }
    if (Object.keys(aim).length) o.aim = aim;
  }
  return o;
}

/** Giây cần để đi từ `from` sang `to`; scene đè được. */
export function blendDuration(base: Pose, from: Partial<Pose>, to: Partial<Pose>): number {
  let d = 0;
  eachChannel(
    base,
    from,
    to,
    (_k, a, b) => (d = Math.max(d, ...gap(a, b))),
    (a, b) => (d = Math.max(d, ...gap(a, b))),
  );
  eachHand(base, from, to, (_k, a, b) => (d = Math.max(d, ...gap(a, b))));
  return Math.min(BLEND_MAX, Math.max(BLEND_MIN, d / BLEND_RATE));
}

const gap = (a: readonly number[], b: readonly number[]) =>
  (mixAngles(a, b, 1) as number[]).map((v, i) => Math.abs(v - (a[i] ?? 0)));

/**
 * Kiểu nét mặt không nội suy được: đổi ở giữa đoạn hoà. Khẩu hình đọc ra là tức thì, nên đổi
 * sớm hay muộn nửa đoạn đều không ai thấy sai. `blush` hoà thẳng suốt đoạn, bên không ghi là `0`.
 */
export function blendFace(
  from: Partial<FaceState>,
  to: Partial<FaceState>,
  f: number,
): Partial<FaceState> {
  const o = { ...(f < 0.5 ? from : to) };
  if (from.blush === undefined && to.blush === undefined) delete o.blush;
  else {
    const a = from.blush ?? 0;
    o.blush = a + ((to.blush ?? 0) - a) * f;
  }
  return o;
}
