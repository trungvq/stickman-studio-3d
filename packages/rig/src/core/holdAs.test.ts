import { describe, expect, it } from "vitest";
import { actArm, actHeld, type ActInput } from "./act3";
import { body3 } from "./figure3d";
import { rigElbowBody, yawFrame } from "./graspArm";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";
import { matMul, type M3 } from "./lens";
import {
  graspAtTime,
  handReport,
  itemAt,
  parseScene,
  resolveScene,
  sceneAt,
  sceneItemHoldProblems,
  type SceneRuntime,
} from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";

// Mốc món `as` (docs/11-nhom-cam.md § Lần cầm theo mốc): `hand` lấy nguyên nghiệm tay đang vẽ, `prev` giữ mốc trước

const r1 = parseHeldItem(dienThoai);
if (!r1.success) throw new Error(r1.error.message);
const PHONE_SPEC: HeldItemSpec = r1.data;
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const H = NGUOI.rig.height;
const DIMS = body3(NGUOI);
const AT = [250, 0, 506];
const PHONE = { item: "dien-thoai", group: "palmBox" };
/** Đứng yên tới 1,6 s, quay tại chỗ 280° → 210° tới 3,6 s */
const TURN = [
  { t: 0, at: AT, yaw: 280 },
  { t: 1.6, at: AT, yaw: 280 },
  { t: 3.6, at: AT, yaw: 210 },
];

function runtime(hands: unknown[], items: unknown[]) {
  const r = parseScene({
    duration: 5,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [{ id: "nguoi", base: { torso: 9, head: [0, 0, -6] }, world: { path: TURN, hands } }],
    items,
  });
  if (!r.success) throw new Error(r.error.message);
  const rt = resolveScene(
    r.data,
    {},
    {},
    {},
    { nguoi: H },
    { nguoi: DIMS },
    {
      "dien-thoai": PHONE_SPEC,
    },
  );
  rt.chars = { nguoi: NGUOI };
  return rt;
}

const poseAt = (rt: SceneRuntime, t: number) => sceneAt(rt, "nguoi", t, H, DIMS) as ActInput;
const arm = (rt: SceneRuntime, t: number) => actArm(NGUOI, poseAt(rt, t), 1)!;
/** Khoảng hai điểm three, đơn vị rig */
const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * 100;
/** Khoảng hai điểm thế giới rig */
const gap = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const rotDeg = (a: M3, b: M3) => {
  const M = matMul(tr(a), b);
  return (Math.acos(Math.max(-1, Math.min(1, (M[0] + M[4] + M[8] - 1) / 2))) * 180) / Math.PI;
};
const flat = (R: readonly number[]) => [...R] as M3;
/** Món trong tay trái như vẽ */
const phoneAt = (rt: SceneRuntime, t: number) => actHeld(NGUOI, poseAt(rt, t)).L!;

/** Tay dẫn cầm máy trước cằm, tới 1,0 s đổi sang theo mốc: giơ máy, quay người, hạ máy */
const LEAD = {
  to: "chin",
  offset: [40, 50, 20],
  point: "grip",
  hold: { ...PHONE, face: { axis: "back", toward: "forward" } },
};
const hands = [
  { t: 0, left: LEAD },
  { t: 1, left: { hold: { ...PHONE, regrip: true } } },
];
const phone = (t: number, extra: object) => ({ t, cast: "nguoi", item: "dien-thoai", ...extra });
const ITEMS = [
  phone(1, { as: "hand" }),
  phone(1.5, { to: "eye", offset: [32, 10, 8], face: { axis: "screen", toward: "holderFace" } }),
  phone(3.6, { as: "prev" }),
  phone(4.1, { to: "chest", offset: [30, 20, 10], face: { axis: "screen", toward: "holderFace" } }),
];

describe("mốc món `as`", () => {
  it("schema: `as` không đi với chỗ, hướng, `rest`", () => {
    const ok = (k: object) =>
      parseScene({ cast: [{ id: "a" }], items: [{ t: 0, cast: "a", item: "b", ...k }] }).success;
    expect(ok({ as: "hand" })).toBe(true);
    expect(ok({ as: "prev" })).toBe(true);
    expect(ok({ as: "prev", ease: "auto" })).toBe(true);
    expect(ok({ as: "hand", to: "chest" })).toBe(false);
    expect(ok({ as: "hand", point: "speaker" })).toBe(false);
    expect(ok({ as: "prev", face: { axis: "screen", toward: "holderFace" } })).toBe(false);
    expect(ok({ as: "prev", rest: true })).toBe(false);
  });

  it("`hand`: tay dẫn → theo mốc không nhảy, mốc đầu là nghiệm tay đang vẽ", () => {
    const rt = runtime(hands, ITEMS);
    expect(handReport(rt, "nguoi", "left", 1.2)!.mode).toBe("keyed");
    const before = arm(rt, 1 - 1e-6);
    for (const t of [1, 1 + 1e-4, 1.01]) {
      const a = arm(rt, t);
      expect(dist(a.W, before.W)).toBeLessThan(0.3);
      expect(rotDeg(a.Rw, before.Rw)).toBeLessThan(0.5);
    }
    // món đi liền qua ranh giới: mốc sau hoà vào từ vận tốc 0, khung ngay sau ranh giới gần như đứng yên
    const step = (t: number) => gap(phoneAt(rt, t).at, phoneAt(rt, t - 1 / 30).at);
    expect(step(1)).toBeLessThan(0.3);
    expect(step(1 + 1 / 30)).toBeLessThan(0.6);
    expect(rotDeg(flat(phoneAt(rt, 1).R), flat(phoneAt(rt, 1 - 1 / 30).R))).toBeLessThan(1);
    expect(sceneItemHoldProblems(rt)).toEqual([]);
  });

  it("`hand` so với mốc khai chỗ: không có `as` thì nghiệm ở mốc đầu lệch tay đang vẽ", () => {
    const chars = { nguoi: NGUOI };
    const rt = runtime(hands, ITEMS);
    // món ở mốc `as` là món đang vẽ ngay trước ranh giới
    const here = itemAt(rt, "dien-thoai", 1, { chars })!;
    expect(gap(here.P, phoneAt(rt, 1 - 1e-6).at)).toBeLessThan(0.01);
    const before = arm(rt, 1 - 1e-6);
    const sol = graspAtTime(rt, "nguoi", "left", 1, { chars })!;
    expect(dist(sol.Wp, before.W)).toBeLessThan(1e-6);
    expect(rotDeg(sol.Rw, before.Rw)).toBeLessThan(1e-4);
    // cùng chỗ món khai tay: bộ giải chọn lại `φ` và khung cầm, bàn tay ở mốc khác tay đang vẽ
    const said = runtime(hands, [
      phone(1, {
        to: "chin",
        offset: [40, 50, 20],
        face: { axis: "back", toward: "forward" },
      }),
      ...ITEMS.slice(1),
    ]);
    const s2 = graspAtTime(said, "nguoi", "left", 1, { chars })!;
    expect(dist(s2.Wp, before.W) + rotDeg(s2.Rw, before.Rw)).toBeGreaterThan(1);
  });

  it("`prev`: quay người thì tay và máy đứng yên theo thân, rồi mới hoà sang mốc sau", () => {
    const rt = runtime(hands, ITEMS);
    const rel = (t: number) => {
      const j = handReport(rt, "nguoi", "left", t)!.joints;
      const yaw = poseAt(rt, t).world!.yaw;
      return rigElbowBody(
        yawFrame(yaw),
        1,
        [0, 1, 2].map((i) => j.wrist[i] - j.shoulder[i]),
      );
    };
    const ref = rel(1.6);
    expect(Math.abs(poseAt(rt, 3.6).world!.yaw - poseAt(rt, 1.6).world!.yaw)).toBeGreaterThan(1);
    for (const t of [2, 2.6, 3.2, 3.6]) expect(gap(rel(t), ref)).toBeLessThan(0.05);
    // sau mốc `prev` hoà sang mốc sau
    expect(gap(rel(4.1), ref)).toBeGreaterThan(5);
  });

  it("`as: hand` giữa lần cầm và `as` không ai cầm trước đó: `check` báo", () => {
    const mid = runtime(hands, [ITEMS[0], ITEMS[1], phone(2, { as: "hand" })]);
    expect(sceneItemHoldProblems(mid).join("\n")).toMatch(/giữa lần cầm/);
    const free = runtime(
      [
        { t: 0, left: null },
        { t: 1, left: { hold: PHONE } },
      ],
      [phone(1, { as: "hand" }), ITEMS[1]],
    );
    expect(sceneItemHoldProblems(free).join("\n")).toMatch(/không bàn tay nào cầm/);
  });
});
