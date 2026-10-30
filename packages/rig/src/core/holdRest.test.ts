import { describe, expect, it } from "vitest";
import { actHeld, trunk3, type ActInput } from "./act3";
import { GRIP_GROUPS } from "./graspGroups";
import { body3 } from "./figure3d";
import {
  graspAt,
  graspCtx,
  handFromItem,
  REST_REF,
  restUnder,
  type GraspFrame,
} from "./graspSolve";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";
import { matMul, type M3, type V3 } from "./lens";
import {
  graspAtTime,
  itemAt,
  itemReleased,
  ItemRestError,
  parseScene,
  resolveScene,
  sceneAt,
  sceneItemHoldProblems,
  type ItemPose,
  type SceneRuntime,
} from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";

// Mốc món nằm (`rest`): chỗ món ở mốc lấy từ lúc thả, mặt đỡ suy từ món (docs/11-nhom-cam.md § Mốc món, § Mặt đỡ)

const r0 = parseHeldItem({
  schemaVersion: 2,
  size: [28, 0.8, 17.6],
  front: "front",
  top: "top",
  anchors: {
    front: { at: [0, 0.8, 0], dir: [0, 1, 0] },
    top: { at: [0, 0.4, -8.8], dir: [0, 0, -1] },
  },
  shape: [{ box: [28, 0.8, 17.6], at: [0, 0.4, 0] }],
});
if (!r0.success) throw new Error(r0.error.message);
const THE: HeldItemSpec = r0.data;
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const H = NGUOI.rig.height;
const DIMS = body3(NGUOI);
const chars = { a: NGUOI, b: NGUOI };
// hai người đối mặt qua một mặt ngang: thẻ nằm giữa hai người
const A = { at: [250, 0, 740], yaw: 90 };
const B = { at: [250, 0, 570], yaw: 270 };
const SPOT = [256, -204, 660];
const FLAT = { up: "front", roll: { axis: "top", toward: "forward" } };

function runtime(a: unknown[], b: unknown[], items: unknown[]): SceneRuntime {
  const r = parseScene({
    duration: 3,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [
      { id: "a", world: { ...A, hands: a } },
      { id: "b", world: { ...B, hands: b } },
    ],
    items,
  });
  if (!r.success) throw new Error(r.error.message);
  const rt = resolveScene(r.data, {}, { a: H, b: H }, { a: DIMS, b: DIMS }, { the: THE });
  // như `buildWorld`: nhân vật thật của mọi người cho bàn tay người thả
  rt.chars = { a: NGUOI, b: NGUOI };
  return rt;
}

/** A tay dẫn đặt thẻ ngửa trên mặt ngang rồi buông ở 1; B mở lần cầm ở 1,4, mốc nằm 1,7 không khai chỗ, nhấc lên ở 2,5 */
const LEAD = [
  {
    t: 0,
    left: {
      at: SPOT,
      point: "grip",
      hold: { item: "the", group: "card", edge: "bottom", ...FLAT },
    },
  },
  { t: 1, left: { at: SPOT, point: "grip", hold: null } },
  { t: 1.6, left: null },
];
const PICK = [{ t: 1.4, right: { hold: "the@card" } }];
const PICK_MARKS = [
  { t: 1.7, cast: "b", item: "the", rest: true },
  { t: 2.5, cast: "b", item: "the", to: "chest", offset: [30, 10, 0] },
];

const poseAt = (rt: SceneRuntime, id: string, t: number) => sceneAt(rt, id, t, H, DIMS) as ActInput;
const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const rotDeg = (P: M3, Q: M3) => {
  const M = matMul(tr(P), Q);
  return (Math.acos(Math.max(-1, Math.min(1, (M[0] + M[4] + M[8] - 1) / 2))) * 180) / Math.PI;
};
/** Món B vẽ ở `t`, thế giới rig (`R` rig như `ItemPose`) */
const drawnB = (rt: SceneRuntime, t: number) => {
  const h = actHeld(NGUOI, poseAt(rt, "b", t)).R!;
  const R = h.R;
  return { P: h.at, R: [R[0], R[1], R[2], -R[3], -R[4], -R[5], -R[6], -R[7], -R[8]] as M3 };
};

/** Da dưới mặt đỡ của bàn tay `side` người `id` ở `t`, khung cầm `frame`, món ở `pose` (ngón ôm theo vai trò như giá) */
const underAt = (
  rt: SceneRuntime,
  id: string,
  side: number,
  t: number,
  frame: GraspFrame,
  pose: ItemPose,
) => {
  const c = graspCtx(trunk3(NGUOI, poseAt(rt, id, t))!, { the: THE });
  return restUnder(THE, frame, side, c.k, c.long, c.s, pose, GRIP_GROUPS.card.variants.edges!.curl);
};

describe("mốc món `rest`", () => {
  it("không khai chỗ: chỗ, hướng món là lúc thả của người khác (tay dẫn); món không nhảy lúc B gắn và ở mốc", () => {
    const rt = runtime(LEAD, PICK, PICK_MARKS);
    const rel = itemReleased(rt, "the", 1.7)!;
    expect(rel).toMatchObject({ id: "a", side: "left", t: 1 });
    // chỗ thả là món A đã vẽ ngay trước mốc thả
    const before = actHeld(NGUOI, poseAt(rt, "a", 1 - 1e-3)).L!;
    expect(dist(rel.pose.P, before.at)).toBeLessThan(1e-9);
    const mark = itemAt(rt, "the", 1.7, { chars })!;
    expect(mark.rest).toBe(true);
    expect(dist(mark.P, rel.pose.P)).toBeLessThan(1e-9);
    expect(rotDeg(mark.R, rel.pose.R)).toBeLessThan(1e-6);
    // B vừa gắn (tay còn đang tới): món đứng ở mốc nằm, đúng chỗ thả
    for (const t of [1.4 + 1e-4, 1.55]) {
      const d = drawnB(rt, t);
      expect(dist(d.P, rel.pose.P), `${t}`).toBeLessThan(1e-6);
      expect(rotDeg(d.R, rel.pose.R), `${t}`).toBeLessThan(1e-4);
    }
    // ở mốc: bàn tay đã tới, món theo bàn tay mà vẫn ở chỗ thả
    const d = drawnB(rt, 1.7);
    expect(dist(d.P, rel.pose.P)).toBeLessThan(0.05);
    expect(rotDeg(d.R, rel.pose.R)).toBeLessThan(0.5);
    const g = graspAtTime(rt, "b", "right", 1.7, { chars })!;
    const want = handFromItem(mark.R, mark.P, mark.s, g.frame.G);
    expect(dist(g.Wp, want.Wp)).toBeLessThan(1e-9);
  });

  it("mặt đỡ: thẻ nằm thì rig kẹp `edges` từ phía trên, da không xuống dưới mặt thẻ", () => {
    const rt = runtime(LEAD, PICK, PICK_MARKS);
    const g = graspAtTime(rt, "b", "right", 1.7, { chars })!;
    expect(g.choice.variant).toBe("edges");
    const mark = itemAt(rt, "the", 1.7, { chars })!;
    // lòng tay chúc xuống (y rig hướng xuống)
    const palm = g.frame.hand.palm as V3;
    expect(mark.R[3] * palm[0] + mark.R[4] * palm[1] + mark.R[5] * palm[2]).toBeGreaterThan(0.8);
    expect(underAt(rt, "b", -1, 1.7, g.frame, mark)).toBeLessThan(REST_REF);
  });

  it("mặt đỡ trong `chooseMissing`: thẻ nằm sát người, mốc `rest` kẹp `edges` từ phía trên, nắm tay không xuống dưới mặt thẻ", () => {
    const T = trunk3(NGUOI, { pose: fx.pose, world: fx.world } as unknown as ActInput)!;
    const c = graspCtx(T, { the: THE });
    const R: M3 = [1, 0, 0, 0, -1, 0, 0, 0, -1];
    const curl = GRIP_GROUPS.card.variants.edges!.curl;
    for (const side of [-1, 1]) {
      const flat: ItemPose = { R, P: [250, -175, 540], cast: "nguoi", s: 1 };
      // không có mặt đỡ: kẹp bên `lateral` thì nắm tay ở dưới mặt thẻ
      const lateral = graspAt(c, { item: "the", group: "card", variant: "lateral" }, flat, side);
      expect(restUnder(THE, lateral.frame, side, c.k, c.long, c.s, flat)).toBeGreaterThan(5);
      const lying = graspAt(c, "the@card", { ...flat, rest: true }, side);
      expect(lying.choice).toMatchObject({ variant: "edges", thumb: "front" });
      expect(restUnder(THE, lying.frame, side, c.k, c.long, c.s, flat, curl)).toBeLessThan(
        REST_REF,
      );
    }
  });

  it("đặt xuống với mốc `rest` khai chỗ: không da nào dưới mặt quá ngưỡng; món đứng ở chỗ khai tới lúc thả, người nhặt đọc đúng chỗ ấy", () => {
    const put = [
      { t: 0, left: { hold: "the@card" } },
      { t: 1.3, left: { hold: null } },
    ];
    const marks = [
      { t: 0, cast: "a", item: "the", to: "chest", offset: [30, 10, 0] },
      { t: 1, cast: "a", item: "the", at: SPOT, rest: true, ...FLAT },
      ...PICK_MARKS,
    ];
    const rt = runtime(put, PICK, marks);
    const g = graspAtTime(rt, "a", "left", 1, { chars })!;
    const mark = itemAt(rt, "the", 1, { chars })!;
    expect(mark.rest).toBe(true);
    expect(underAt(rt, "a", 1, 1, g.frame, mark)).toBeLessThan(REST_REF);
    // sau mốc nằm cuối: món đứng ở chỗ khai, bàn tay giữ mốc trong hệ thân
    const held = actHeld(NGUOI, poseAt(rt, "a", 1.2)).L!;
    expect(dist(held.at, mark.P)).toBeLessThan(1e-6);
    const rel = itemReleased(rt, "the", 1.7)!;
    expect(rel).toMatchObject({ id: "a", t: 1.3 });
    expect(dist(rel.pose.P, mark.P)).toBeLessThan(1e-6);
    expect(rotDeg(rel.pose.R, mark.R)).toBeLessThan(1e-4);
  });

  it("không có lần thả trước mốc: lỗi `ref`, `itemAt` ném `ItemRestError`", () => {
    const rt = runtime([{ t: 0, left: { at: SPOT, point: "grip" } }], PICK, [
      { t: 1.7, cast: "b", item: "the", rest: true },
    ]);
    expect(sceneItemHoldProblems(rt).join("\n")).toMatch(/`rest` không khai chỗ/);
    expect(() => itemAt(rt, "the", 1.7, { chars })).toThrow(ItemRestError);
  });

  it("schema: `rest` không khai chỗ thì không khai hướng; thiếu chỗ mà không `rest` là lỗi", () => {
    const bad = (items: unknown[]) =>
      parseScene({ duration: 1, cast: [{ id: "b", world: B }], items }).success;
    expect(bad([{ t: 0, cast: "b", item: "the", rest: true }])).toBe(true);
    expect(bad([{ t: 0, cast: "b", item: "the", rest: true, up: "front" }])).toBe(false);
    expect(bad([{ t: 0, cast: "b", item: "the" }])).toBe(false);
  });

  it("tất định: hai runtime, thứ tự hỏi khác nhau, cùng số", () => {
    const a = runtime(LEAD, PICK, PICK_MARKS);
    const b = runtime(LEAD, PICK, PICK_MARKS);
    const ts = [1.5, 1.7, 2.1, 2.5];
    const fwd = ts.map((t) => graspAtTime(a, "b", "right", t, { chars })!);
    const back = [...ts].reverse().map((t) => graspAtTime(b, "b", "right", t, { chars })!);
    back.reverse();
    for (let i = 0; i < ts.length; i++) {
      expect(dist(fwd[i].Wp, back[i].Wp)).toBe(0);
      expect(fwd[i].arm.phi).toBe(back[i].arm.phi);
    }
    expect(itemReleased(a, "the", 2)!.pose).toEqual(itemReleased(b, "the", 2)!.pose);
  });
});
