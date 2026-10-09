import { soloStage, soloToStage, type Solo } from "@stickman3d/fx";
import {
  actionReach,
  add3,
  CHANNELS,
  composeEquip,
  dot3,
  equipCharacter,
  figure3d,
  project,
  JOINT_CHANNELS,
  keyDelta,
  reachAngles,
  torsoBend,
  REACH_ELBOW,
  reachToWorld,
  scale3,
  sub3,
  unproject,
  worldToReach,
  type ActionData,
  type ActionKey,
  type CharacterData,
  type Equip,
  type Lens,
  type PoseDelta,
  type V3,
} from "@stickman3d/sketch";
import { useMemo } from "react";

export type ReachArm = "armNear" | "armFar";
export const REACH_ARMS: ReachArm[] = ["armNear", "armFar"];

/** Hành động soạn cho người 3D thì sân khấu, ô xem thử vẽ người 3D */
export const isSolid = (a: ActionData | null | undefined) => a?.authoredAt === "side";

/** Track dưới rồi tới hành động đang soạn, như hai track chồng nhau của scene */
export const soloStack = (action: ActionData, under: ActionData | null) =>
  under && under.name !== action.name ? [under, action] : [action];

/** Tầm góc cúi ống kính, như `pitch` của `render_action` */
export const PITCH = { min: 0, max: 80 };

/** Góc về `(-180, 180]`, làm tròn tới độ */
export const wrapYaw = (y: number) => {
  const r = ((((Math.round(y) + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
};

/**
 * `soloStage` cho từng độ yaw, giữ lại suốt lúc quay vòng nên mỗi hướng chỉ dựng cảnh một lần;
 * đổi nhân vật, hành động hay góc cúi thì dựng lại từ đầu.
 */
export function useSolo(character: CharacterData, stack: ActionData[] | null, pitch: number) {
  return useMemo(() => {
    if (!stack) return null;
    const cache = new Map<number, (time: number) => Solo>();
    return (yaw: number, time: number) => {
      const y = wrapYaw(yaw);
      let at = cache.get(y);
      if (!at) {
        at = soloStage({ character, yaw: y, pitch, action: stack });
        cache.set(y, at);
      }
      return at(time);
    };
  }, [character, stack, pitch]);
}

/** Khớp thế giới của người trong một khung `solo`, mặc đúng đồ đang mặc như chỗ vẽ */
export function soloJoints(character: CharacterData, equip: Equip | undefined, solo: Solo) {
  const worn = equipCharacter(character, composeEquip(equip, solo.equip));
  return figure3d(worn, solo.pose, solo.world).joints;
}

/**
 * Đường đất để vẽ `solo` ở `x`: người đứng thì sàn dưới hông nằm trên `groundY`; người ngồi thì bàn
 * chân gần ống kính rơi thấp hơn sàn dưới hông, nên nâng cả cụm cho bàn chân thấp nhất chạm `groundY`.
 */
export function soloGround(
  character: CharacterData,
  equip: Equip | undefined,
  solo: Solo,
  x: number,
  groundY: number,
) {
  if (!solo.furniture) return groundY;
  const j = soloJoints(character, equip, solo);
  const low = Math.max(
    ...[j.footNear, j.footFar].map(
      (f) => soloToStage(solo, x, groundY, project(solo.world.lens, f))[1],
    ),
  );
  return groundY - Math.max(0, low - groundY);
}

/** Đích cổ tay của tay `ch` ở mốc `key`: đích đã ghi, hoặc cổ tay đang vẽ nếu mốc ghi góc */
export function keyTarget(
  character: CharacterData,
  equip: Equip | undefined,
  solo: Solo,
  key: ActionKey,
  ch: ReachArm,
): V3 {
  const r = key.reach?.[ch];
  if (r) return reachToWorld(solo.world, ch, r.at, character.rig.height);
  const j = soloJoints(character, equip, solo);
  return ch === "armNear" ? j.wristNear : j.wristFar;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Điểm thế giới ra đích hệ thân của tay `ch`, làm tròn như số người gõ */
export const toReach = (character: CharacterData, solo: Solo, ch: ReachArm, p: V3): V3 =>
  worldToReach(solo.world, ch, p, character.rig.height).map(round1) as V3;

/**
 * Cổ tay hệ thân của tay `ch` ở mốc `key` — hệ thân không phụ thuộc hướng, nên dựng ở yaw 0 —,
 * để đổi một tay đang theo góc sang theo đích mà tay chưa dời.
 */
export function keyWrist(
  character: CharacterData,
  stack: ActionData[],
  action: ActionData,
  key: ActionKey,
  ch: ReachArm,
  equip?: Equip,
): V3 {
  const solo = soloStage({ character, yaw: 0, action: stack })(key.t * action.duration);
  return toReach(character, solo, ch, keyTarget(character, equip, solo, key, ch));
}

/** Điểm khung ống kính `uv` ra điểm thế giới trên mặt phẳng qua `T`, vuông góc tia nhìn tới `T` */
export function dragPlane(lens: Lens, T: V3, uv: [number, number]): V3 {
  const n = sub3(T, lens.eye);
  const d = sub3(unproject(lens, uv, 1), lens.eye);
  const along = dot3(d, n);
  if (!(along > 1e-9)) return T;
  return add3(lens.eye, scale3(d, dot3(n, n) / along));
}

/** Mốc đang gọi tên pose thì trải ra số trước khi sửa một kênh, giữ nguyên mặt nạ đang suy ra */
export function spreadKeyPose(d: ActionData, k: ActionKey): PoseDelta {
  if (typeof k.pose === "string") {
    const full = keyDelta(k);
    k.pose = Object.fromEntries(
      JOINT_CHANNELS.filter((c) => (d.mask ?? CHANNELS).includes(c)).map((c) => [c, full[c]]),
    ) as PoseDelta;
  }
  return k.pose as PoseDelta;
}

/** Tay `ch` của mốc theo đích `at`, giữ hướng khuỷu đã ghi; góc của kênh ấy bỏ đi để chỉ còn một nguồn */
export function setKeyReach(d: ActionData, k: ActionKey, ch: ReachArm, at: V3) {
  delete spreadKeyPose(d, k)[ch];
  k.reach = { ...k.reach, [ch]: { ...k.reach?.[ch], at } };
}

/** Bỏ đích của tay `ch`: kênh về góc dự phòng của chính đích ấy (`reachAngles`), tay không nhảy ở người 2D */
export function clearKeyReach(d: ActionData, k: ActionKey, ch: ReachArm) {
  const r = k.reach?.[ch];
  if (!r) return;
  const pose = spreadKeyPose(d, k);
  pose[ch] = reachAngles(r, pose.torso === undefined ? undefined : torsoBend(pose.torso));
  const rest = { ...k.reach };
  delete rest[ch];
  k.reach = Object.keys(rest).length ? rest : undefined;
}

/**
 * Đích của mốc mới chèn ở pha `t`: tay đang theo trọn đích (hai mốc kề đều có đích) thì ghi đích đã
 * nội suy và bỏ góc của kênh ấy khỏi `pose`, để tay người 3D không nhảy về góc dự phòng.
 */
export function reachAt(a: ActionData, t: number, pose: PoseDelta): ActionKey["reach"] {
  const out: NonNullable<ActionKey["reach"]> = {};
  for (const [k, r] of Object.entries(actionReach(a, t))) {
    if (!r || r.w < 1) continue;
    const ch: ReachArm = k === "an" ? "armNear" : "armFar";
    delete pose[ch];
    const elbow = r.elbow ?? REACH_ELBOW;
    const bent = elbow.some((v, i) => Math.abs(v - REACH_ELBOW[i]) > 1e-9);
    out[ch] = {
      at: r.at.map(round1) as V3,
      ...(bent && { elbow: elbow.map((v) => Math.round(v * 100) / 100) as V3 }),
    };
  }
  return Object.keys(out).length ? out : undefined;
}
