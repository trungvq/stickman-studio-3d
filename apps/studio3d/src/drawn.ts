// Tay và món như người 3D vẽ ở một giây, đọc từ runtime bằng lõi rig (không `three`): đầu vào của mốc mới (nút ＋ của thanh
// tua) để mốc mới ghi đúng thứ đang vẽ.
import {
  actHeld,
  actPalms,
  BODY3,
  bodyMarkAt,
  equipCharacter,
  handReport,
  heldBase,
  holderTrunk,
  holdRuns,
  itemAt,
  itemCentre,
  matVec,
  sceneAt,
  yawFrame,
  type ActCharacter,
  type ActInput,
  type BodyMark,
  type CharacterData,
  type Equip,
  type HandSide,
  type M3,
  type SceneRuntime,
} from "@stickman3d/rig/core";
import type { DrawnHand, V3 } from "./keys";

const sub = (a: readonly number[], b: readonly number[]): V3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
/** Khung món → thế giới rig và → thế giới three: đảo hàng y, z */
const flipRows = (R: M3): M3 => [R[0], R[1], R[2], -R[3], -R[4], -R[5], -R[6], -R[7], -R[8]];
const trVec = (R: M3, v: V3): V3 => [
  R[0] * v[0] + R[3] * v[1] + R[6] * v[2],
  R[1] * v[0] + R[4] * v[1] + R[7] * v[2],
  R[2] * v[0] + R[5] * v[1] + R[8] * v[2],
];

const poseOf = (rt: SceneRuntime, id: string, t: number) =>
  sceneAt(rt, id, t, rt.heights[id] ?? 1, rt.bodies[id] ?? BODY3) as unknown as ActInput & {
    equip?: Equip;
    world?: { yaw: number; hands?: { near?: { w: number }; far?: { w: number } } };
  };

/**
 * Tay `side` của `id` ở `t` (`handReport`, phần đích của `sceneAt`); đồ theo tay thì kèm hướng món đang vẽ (`axes`). Người
 * không có `world` thì `undefined`
 */
export function drawnHand(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  t: number,
  o: { char?: ActCharacter; eye?: readonly number[] } = {},
): DrawnHand | undefined {
  const r = handReport(rt, id, side, t, o);
  if (!r) return undefined;
  const sp = poseOf(rt, id, t);
  const near: HandSide = sp.world?.flip ? "left" : "right";
  const reach = sp.world?.hands?.[side === near ? "near" : "far"];
  const e = sub(r.joints.elbow, r.ring.center);
  const n = Math.hypot(...e);
  const axes =
    r.mode === "hand" && r.run
      ? drawnItem(rt, id, side, r.run.item, t, { char: o.char, out: side === "right" ? -1 : 1 })
      : undefined;
  return {
    mode: r.mode,
    ...(axes && { axes: { face: axes.face, roll: axes.roll } }),
    blending: r.blending,
    support: !!r.run?.lead,
    w: reach?.w ?? 0,
    grip: [...r.grip] as V3,
    wrist: [...r.joints.wrist] as V3,
    ...(n > 1e-6 && { elbow: e.map((x) => x / n) as V3 }),
    ...(sp.world && { Rr: yawFrame(sp.world.yaw) }),
    locked: r.elbowLock,
    ...(r.grasp && { choice: r.grasp.choice as Record<string, unknown> }),
  };
}

/** Nhân vật của `id` như vẽ ở `t`: `char` nếu có, không thì `rt.chars[id]` mặc theo `equip` lúc ấy */
export function charAt(
  rt: SceneRuntime,
  id: string,
  t: number,
  char?: ActCharacter,
): ActCharacter | undefined {
  if (char) return char;
  const base = rt.chars?.[id] as CharacterData | undefined;
  return base && equipCharacter(base, poseOf(rt, id, t).equip);
}

/** Lòng tay và hướng ngón (thế giới rig) của tay `side` như vẽ ở `t` (`actPalms`) */
export function palmAt(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  t: number,
  char?: ActCharacter,
): { palm: V3; finger: V3 } | undefined {
  const c = charAt(rt, id, t, char);
  const p = c && actPalms(c, poseOf(rt, id, t))?.[side === "right" ? "R" : "L"];
  return p && { palm: [...p.palm] as V3, finger: [...p.finger] as V3 };
}

/**
 * Điểm đích theo mốc thân của tay `side` (`bodyMarkAt`, gồm `offset`) trên người `id` như vẽ ở `t`, thế giới rig: chỗ `point`
 * của mốc nhắm tới
 */
export function markPoint(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  t: number,
  ref: { to: string; side?: "same" | "other"; offset?: readonly number[] },
  char?: ActCharacter,
): V3 | undefined {
  const c = charAt(rt, id, t, char);
  const p =
    c &&
    bodyMarkAt(
      c,
      poseOf(rt, id, t),
      { ...ref, to: ref.to as BodyMark },
      side === "right" ? "R" : "L",
    );
  return p && ([...p] as V3);
}

/** Thân người `id` ở `t` (`holderTrunk`): `Rr` (three) cho vectơ hệ thân, `s` là `world.s` */
export function trunkAt(rt: SceneRuntime, id: string, t: number, char?: ActCharacter) {
  const c = charAt(rt, id, t, char);
  if (!c) return undefined;
  const T = holderTrunk(rt, id, t, { chars: { [id]: c as CharacterData } });
  return { c, Rr: T.Rr as M3, s: T.s };
}

/**
 * Khung món `item` tay `side` của `id` đang cầm ở `t`, như vẽ, và tâm hộp bao (thế giới rig). `sp`: tư thế `sceneAt` đã
 * có ở `t` (cùng `char` thì không giải lại tay)
 */
export function itemFrame(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  item: string,
  t: number,
  char?: ActCharacter,
  sp?: ActInput,
) {
  const c = charAt(rt, id, t, char);
  const spec = rt.held[item] ?? rt.held[heldBase(item)];
  if (!c || !spec) return undefined;
  const both = holdRuns(rt, id)[side].some(
    (r) => r.item === item && r.mode === "both" && r.since <= t && t < r.until,
  );
  let R: M3, P: readonly number[], s: number;
  if (both) {
    const p = itemAt(rt, item, t, { chars: { [id]: c } });
    if (!p) return undefined;
    [R, P, s] = [p.R, p.P, p.s];
  } else {
    const h = Object.values(actHeld(c, sp ?? poseOf(rt, id, t))).find((x) => x?.item === item);
    if (!h) return undefined;
    [R, P, s] = [flipRows(h.R), h.at, h.s];
  }
  const q = itemCentre(spec);
  const d = matVec(R, [q[0] * s, q[1] * s, q[2] * s]);
  return { c, R, at: [P[0] + d[0], P[1] + d[1], P[2] + d[2]] as V3 };
}

/** Tâm hộp bao (thế giới rig) của món `item` tay `side` của `id` đang cầm ở `t`, như vẽ (`drawnItem`) */
export const drawnItemAt = (
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  item: string,
  t: number,
  char?: ActCharacter,
  sp?: ActInput,
): V3 | undefined => itemFrame(rt, id, side, item, t, char, sp)?.at;

/**
 * Món `item` tay `side` của `id` đang cầm ở `t`, như vẽ: hai tay trên mốc món ở `itemAt`, còn lại theo bàn tay
 * (`actHeld`). `at` tâm hộp bao (thế giới rig); `face`, `roll` là trục `+z`, `+y` của khung món ra vectơ hệ thân người
 * cầm `[tiến, y xuống, ngang]`, như `itemAxes` của `core/holdMode.ts`: `out` `-1` ngang phải (mốc món), ý định của `hold`
 * thì ra ngoài phía tay cầm (`-1` phải, `1` trái)
 */
export function drawnItem(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  item: string,
  t: number,
  o: { char?: ActCharacter; out?: number } = {},
): { at: V3; face: V3; roll: V3 } | undefined {
  const f = itemFrame(rt, id, side, item, t, o.char);
  if (!f) return undefined;
  const Rr = holderTrunk(rt, id, t, { chars: { [id]: f.c } }).Rr as M3;
  const R3 = flipRows(f.R);
  const out = o.out ?? -1;
  const body = (v: V3): V3 => {
    const l = trVec(Rr, v);
    return [l[2], -l[1], out * l[0]];
  };
  return {
    at: f.at,
    face: body(matVec(R3, [0, 0, 1])),
    roll: body(matVec(R3, [0, 1, 0])),
  };
}
