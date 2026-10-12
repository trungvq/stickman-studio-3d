import { ARM_LAYERS, DEFAULT_LAYERS } from "./constants";
import { ARM_CHANNELS, headOver, mixAngles, mixReach, smoothstep, stretchOver } from "./action";
import type { AnimalPose } from "./animals";
import {
  LIFT_CHANNELS,
  REACH_CHANNELS,
  type ArmLayer,
  type ArmLayers,
  type FaceState,
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
  // Chân cắt cứng ngay ở `f === 0` nữa: giữ chân của clip cũ dù chỉ một khung là con vật
  // đang bay bỗng đứng bằng chân xếp, và `animalAirborne` đã trả về mặt đất từ khung ấy
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
  return Math.min(BLEND_MAX, Math.max(BLEND_MIN, d / BLEND_RATE));
}

const gap = (a: readonly number[], b: readonly number[]) =>
  (mixAngles(a, b, 1) as number[]).map((v, i) => Math.abs(v - (a[i] ?? 0)));

const rank = (l: ArmLayer) => ARM_LAYERS.indexOf(l);

/**
 * Lớp không nội suy được: suốt đoạn hoà lấy lớp **trước nhất** của hai bên.
 * Đè dư vài frame thì không ai thấy; đè thiếu thì cẳng tay chui vào khối thân giữa đường bay.
 */
export function blendLayers(
  from: Partial<ArmLayers>,
  to: Partial<ArmLayers>,
  f: number,
): Partial<ArmLayers> {
  if (f <= 0) return from;
  if (f >= 1) return to;
  const o: Partial<ArmLayers> = {};
  for (const k of ARM_CHANNELS) {
    if (!from[k] && !to[k]) continue;
    const a = from[k] ?? DEFAULT_LAYERS[k];
    const b = to[k] ?? DEFAULT_LAYERS[k];
    o[k] = rank(a) >= rank(b) ? a : b;
  }
  return o;
}

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

/** Kênh động vật hoà được: thân, cổ, đầu một số; đuôi, cánh hai số. Chân thì không — xem `blendAnimalPose`. */
const ANIMAL_SCALARS = ["spine", "neck", "head"] as const;
const ANIMAL_VECTORS = ["tail", "wing"] as const;
const ANIMAL_LEGS = ["fn", "ff", "hn", "hf"] as const;

function eachAnimalChannel(
  base: AnimalPose,
  from: Partial<AnimalPose>,
  to: Partial<AnimalPose>,
  vec: (k: (typeof ANIMAL_VECTORS)[number], a: readonly number[], b: readonly number[]) => void,
  num: (k: (typeof ANIMAL_SCALARS)[number], a: number, b: number) => void,
) {
  for (const k of ANIMAL_VECTORS) {
    if (!from[k] && !to[k]) continue;
    vec(k, from[k] ?? base[k], to[k] ?? base[k]);
  }
  for (const k of ANIMAL_SCALARS) {
    if (from[k] === undefined && to[k] === undefined) continue;
    num(k, from[k] ?? base[k], to[k] ?? base[k]);
  }
}

/**
 * Hoà hai kết quả `animalActionPose`. Thân, cổ, đầu, đuôi, cánh hoà như của người; **chân
 * cắt cứng**: góc chân là kết quả IK, hoà là bàn chân trượt, nên từ giây đầu chỗ nối chân đã là
 * của clip mới — clip mới không ghi chân thì chân về track dưới ngay. docs/03-scene.md#động-vật
 */
export function blendAnimalPose(
  base: AnimalPose,
  from: Partial<AnimalPose>,
  to: Partial<AnimalPose>,
  f: number,
): Partial<AnimalPose> {
  if (f >= 1) return to;
  // Chân cắt cứng ngay ở `f === 0` nữa: giữ chân của clip cũ dù chỉ một khung là con vật
  // đang bay bỗng đứng bằng chân xếp, và `animalAirborne` đã trả về mặt đất từ khung ấy
  const w = f <= 0 ? 0 : smoothstep(f);
  const o: Partial<AnimalPose> = {};
  eachAnimalChannel(
    base,
    from,
    to,
    (k, a, b) => Object.assign(o, { [k]: a.map((v, i) => v + (b[i] - v) * w) }),
    (k, a, b) => (o[k] = a + (b - a) * w),
  );
  for (const k of ANIMAL_LEGS) if (to[k]) o[k] = to[k];
  return o;
}

/** Giây cần để đi từ `from` sang `to` ở các kênh hoà được của động vật; scene đè được. */
export function blendAnimalDuration(
  base: AnimalPose,
  from: Partial<AnimalPose>,
  to: Partial<AnimalPose>,
): number {
  let d = 0;
  eachAnimalChannel(
    base,
    from,
    to,
    (_k, a, b) => (d = Math.max(d, ...a.map((v, i) => Math.abs(b[i] - v)))),
    (_k, a, b) => (d = Math.max(d, Math.abs(b - a))),
  );
  return Math.min(BLEND_MAX, Math.max(BLEND_MIN, d / BLEND_RATE));
}
