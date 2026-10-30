import { describe, expect, it } from "vitest";
import { actJoints, type ActInput } from "./act3";
import { body3 } from "./figure3d";
import { HOLD_BLEND, parseHeldItem, type HeldItemSpec } from "./heldItem";
import { parseScene, resolveScene, sceneAt, type SceneRuntime } from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";

const r0 = parseHeldItem(bangGia);
if (!r0.success) throw new Error(r0.error.message);
const BANG: HeldItemSpec = r0.data;
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const H = NGUOI.rig.height;

function runtime(hands: unknown[], items: unknown[]): SceneRuntime {
  const r = parseScene({
    duration: 4,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [
      {
        id: "nguoi",
        base: { torso: 9, head: [0, 0, -6] },
        world: { at: [250, 0, 506], yaw: 270, hands },
      },
    ],
    items,
  });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(r.data, {}, { nguoi: H }, { nguoi: body3(NGUOI) }, { "bang-gia": BANG });
}

const joints = (rt: SceneRuntime, t: number) =>
  actJoints(NGUOI, sceneAt(rt, "nguoi", t, H, body3(NGUOI)) as ActInput)!;

const mark = (t: number) => ({
  t,
  cast: "nguoi",
  item: "bang-gia",
  to: "chest",
  offset: [30, -2.9, 0],
  face: { axis: "front", toward: "holderFace" },
  roll: { axis: "top", toward: "up" },
});
const SHEET = { item: "bang-gia", group: "sheet", edge: "right", along: 0.33, thumb: "front" };
const STEP = 1 / 30;
const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Dời lớn nhất giữa hai mẫu cách `STEP` của cổ tay, khuỷu, bàn tay phải quanh ranh giới `t0`, và dời cả quãng hoà */
function across(rt: SceneRuntime, t0: number) {
  const ts: number[] = [];
  for (let t = t0 - 3 * STEP; t <= t0 + HOLD_BLEND + 3 * STEP + 1e-9; t += STEP)
    ts.push(+t.toFixed(6));
  const js = ts.map((t) => joints(rt, t));
  let step = 0;
  for (let i = 1; i < js.length; i++)
    for (const k of ["wristR", "elbowR", "handR"] as const)
      step = Math.max(step, dist(js[i][k], js[i - 1][k]));
  return { step, total: dist(js[0].wristR, js[js.length - 1].wristR) };
}

describe("hoà vào / ra lần cầm món đặt trước", () => {
  it("tay tự do cầm món rồi buông về hông: cổ tay đi êm trong `HOLD_BLEND`", () => {
    const rt = runtime(
      [
        { t: 1, right: { hold: SHEET } },
        { t: 2.5, right: { hold: null, to: "hip", offset: [18, 0, 40], point: "grip" } },
      ],
      [mark(1), mark(2.4)],
    );
    const enter = across(rt, 1);
    const leave = across(rt, 2.5);
    // vào: cổ tay dời 95 cả quãng, mỗi mẫu ≤ 20; ra: 73, mỗi mẫu ≤ 16 — đỉnh `smoothstep` 1,5 lần trung bình
    expect(enter.total).toBeGreaterThan(40);
    expect(leave.total).toBeGreaterThan(40);
    expect(enter.step).toBeLessThanOrEqual(0.25 * enter.total);
    expect(leave.step).toBeLessThanOrEqual(0.25 * leave.total);
  });

  it("đổi lần cầm cùng món: tay hoà từ nghiệm cũ sang nghiệm mới", () => {
    const rt = runtime(
      [
        { t: 0, right: { hold: SHEET } },
        { t: 1.5, right: { hold: { ...SHEET, edge: "bottom", along: 0.5 } } },
      ],
      [mark(0), mark(3)],
    );
    const r = across(rt, 1.5);
    // cổ tay dời 37 cả quãng, mỗi mẫu ≤ 6,2
    expect(r.total).toBeGreaterThan(20);
    expect(r.step).toBeLessThanOrEqual(0.25 * r.total);
  });

  it("tất định: mẫu nhảy cóc ra cùng số với mẫu theo thứ tự", () => {
    const hands = [
      { t: 1, right: { hold: SHEET } },
      { t: 2.5, right: { hold: null, to: "hip", offset: [18, 0, 40], point: "grip" } },
    ];
    const ts = [1.1, 1.2, 2.6, 2.7];
    const a = runtime(hands, [mark(1), mark(2.4)]);
    const fwd = ts.map((t) => joints(a, t));
    const b = runtime(hands, [mark(1), mark(2.4)]);
    const back = [...ts]
      .reverse()
      .map((t) => joints(b, t))
      .reverse();
    for (let i = 0; i < ts.length; i++)
      for (const k of ["wristR", "elbowR", "handR"] as const)
        expect(dist(fwd[i][k], back[i][k])).toBeLessThan(1e-9);
  });
});
