// Tay và món như người 3D vẽ ở một giây, đọc từ runtime bằng lõi rig (không `three`): đầu vào của mốc mới (nút ＋ của thanh
// tua) để mốc mới ghi đúng thứ đang vẽ.
import {
  actHeld,
  BODY3,
  equipCharacter,
  handReport,
  heldBase,
  holderTrunk,
  holdRuns,
  itemAt,
  itemCentre,
  matVec,
  sceneAt,
  type ActCharacter,
  type ActInput,
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
    world?: { hands?: { near?: { w: number }; far?: { w: number } } };
  };

/** Tay `side` của `id` ở `t` (`handReport`, phần đích của `sceneAt`); người không có `world` thì `undefined` */
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
  return {
    mode: r.mode,
    support: !!r.run?.lead,
    w: reach?.w ?? 0,
    grip: [...r.grip] as V3,
    wrist: [...r.joints.wrist] as V3,
    ...(n > 1e-6 && { elbow: e.map((x) => x / n) as V3 }),
    locked: r.elbowLock,
    ...(r.grasp && { choice: r.grasp.choice as Record<string, unknown> }),
  };
}

/**
 * Món `item` tay `side` của `id` đang cầm ở `t`, như vẽ: hai tay trên mốc món ở `itemAt`, còn lại theo bàn tay
 * (`actHeld`). `at` tâm hộp bao (thế giới rig); `face`, `roll` là trục `+z`, `+y` của khung món ra vectơ hệ thân người
 * cầm `[tiến, y xuống, ngang phải]` — như mốc món của `holdToItemLed`
 */
export function drawnItem(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  item: string,
  t: number,
  o: { char?: ActCharacter } = {},
): { at: V3; face: V3; roll: V3 } | undefined {
  const sp = poseOf(rt, id, t);
  const base = rt.chars?.[id] as CharacterData | undefined;
  const c = o.char ?? (base && equipCharacter(base, sp.equip));
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
    const h = Object.values(actHeld(c, sp)).find((x) => x?.item === item);
    if (!h) return undefined;
    [R, P, s] = [flipRows(h.R), h.at, h.s];
  }
  const q = itemCentre(spec);
  const d = matVec(R, [q[0] * s, q[1] * s, q[2] * s]);
  const Rr = holderTrunk(rt, id, t, { chars: { [id]: c } }).Rr as M3;
  const R3 = flipRows(R);
  const body = (v: V3): V3 => {
    const l = trVec(Rr, v);
    return [l[2], -l[1], -l[0]];
  };
  return {
    at: [P[0] + d[0], P[1] + d[1], P[2] + d[2]],
    face: body(matVec(R3, [0, 0, 1])),
    roll: body(matVec(R3, [0, 1, 0])),
  };
}
