import { describe, expect, it } from "vitest";
import { trunk3 } from "./act3";
import { body3 } from "./figure3d";
import { heldAxis, parseHeldItem, type HeldItemSpec } from "./heldItem";
import { matVec, type M3, type V3 } from "./lens";
import {
  itemAt,
  parseScene,
  resolveScene,
  sceneAt,
  sceneItemProblems,
  type ItemPose,
  type SceneRuntime,
} from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";

// người mẫu đứng cầm bảng: chỗ đứng, ống kính và góc cúi thân, đầu như cảnh ấy ở t = 1
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const heldParsed = parseHeldItem(bangGia);
if (!heldParsed.success) throw new Error("bang-gia");
const BANG: HeldItemSpec = heldParsed.data;
const chars = { nguoi: NGUOI };
const UP_ROLL = { axis: "top", toward: "up" } as const;

function runtime(items: unknown[], base: object = { torso: 9, head: [0, 0, -6] }): SceneRuntime {
  const r = parseScene({
    duration: 4,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [{ id: "nguoi", base, world: { at: [250, 0, 506], yaw: 270 } }],
    items,
  });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(
    r.data,
    {},
    { nguoi: NGUOI.rig.height },
    { nguoi: body3(NGUOI) },
    { "bang-gia": BANG },
  );
}

const at = (rt: SceneRuntime, t: number) => itemAt(rt, "bang-gia", t, { chars })!;
/** Trục món (khung món) ra thế giới rig, đơn vị */
const axisOf = (p: ItemPose, a: string): V3 => matVec(p.R, heldAxis(BANG, a));
const angle = (a: V3, b: V3) =>
  (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;
const near = (a: readonly number[], b: readonly number[], d = 1e-9) =>
  a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(d));
const lerp = (a: V3, b: V3, f: number): V3 => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * f) as V3;
const det = (m: M3) =>
  m[0] * (m[4] * m[8] - m[5] * m[7]) -
  m[1] * (m[3] * m[8] - m[5] * m[6]) +
  m[2] * (m[3] * m[7] - m[4] * m[6]);

const mark = (t: number, more: object = {}) => ({
  t,
  cast: "nguoi",
  item: "bang-gia",
  to: "chest",
  offset: [30, 0, 0],
  face: { axis: "front", toward: "forward" },
  roll: UP_ROLL,
  ...more,
});

describe("mốc món (`items`)", () => {
  it("cảnh không có `items` giữ nguyên: parse không thêm trường, `itemAt` ra `undefined`", () => {
    const r = parseScene({ duration: 1 });
    expect(r.success && "items" in r.data).toBe(false);
    const rt = resolveScene(r.data!, {});
    expect(rt.items).toBeUndefined();
    expect(itemAt(rt, "bang-gia", 0)).toBeUndefined();
    expect(sceneItemProblems(rt)).toEqual([]);
  });

  it("hướng là phép quay thật, đúng trục khai; món không có mốc ra `undefined`", () => {
    const rt = runtime([mark(0)]);
    const p = at(rt, 0);
    expect(det(p.R)).toBeCloseTo(1, 9);
    expect(p.cast).toBe("nguoi");
    // nguoi quay mặt về +z thế giới (yaw 270): `forward` là [0, 0, 1], lên là −y
    near(axisOf(p, "front"), [0, 0, 1], 1e-9);
    near(axisOf(p, "top"), [0, -1, 0], 1e-9);
    expect(p.degenerate).toBeUndefined();
    expect(itemAt(rt, "khac", 0)).toBeUndefined();
  });

  it("giữa hai mốc chỗ món hoà theo `ease` của mốc sau (mặc định smooth)", () => {
    const one = (t: number, offset: number[], ease?: string) =>
      at(runtime([mark(0, { offset, ...(ease && { ease }) })]), t).P as V3;
    const P0 = one(0, [30, 0, 0]);
    const P1 = one(0, [30, -40, 10]);
    const smooth = runtime([mark(0), mark(1, { offset: [30, -40, 10] })]);
    near(at(smooth, 0.5).P, lerp(P0, P1, 0.5), 1e-9);
    near(at(smooth, 0.25).P, lerp(P0, P1, 0.15625), 1e-9);
    const linear = runtime([mark(0), mark(1, { offset: [30, -40, 10], ease: "linear" })]);
    near(at(linear, 0.25).P, lerp(P0, P1, 0.25), 1e-9);
  });

  it("hướng hoà cầu theo đường ngắn", () => {
    const toward = [Math.cos((150 * Math.PI) / 180), 0, Math.sin((150 * Math.PI) / 180)];
    const rt = runtime([
      mark(0, { ease: "linear" }),
      mark(1, { ease: "linear", face: { axis: "front", toward } }),
    ]);
    const a = axisOf(at(rt, 0), "front");
    const b = axisOf(at(rt, 1), "front");
    expect(angle(a, b)).toBeCloseTo(150, 6);
    const m = axisOf(at(rt, 0.5), "front");
    expect(angle(a, m)).toBeCloseTo(75, 6);
    expect(angle(m, b)).toBeCloseTo(75, 6);
    near(axisOf(at(rt, 0.5), "top"), [0, -1, 0], 1e-9);
  });

  it("trước mốc đầu giữ mốc đầu, sau mốc cuối giữ mốc cuối", () => {
    const rt = runtime([
      mark(1),
      mark(2, { offset: [40, -30, 0], face: { axis: "front", toward: "out" } }),
    ]);
    expect(at(rt, 0)).toEqual(at(rt, 1));
    expect(at(rt, 0.5)).toEqual(at(rt, 1));
    expect(at(rt, 3)).toEqual(at(rt, 2));
    expect(at(rt, 1.5)).not.toEqual(at(rt, 1));
  });

  it("người cúi thì món theo khung mốc thân", () => {
    const pts = [0, 30].map((torso) => {
      const rt = runtime([mark(0, { offset: [30, -10, 0] })], { torso });
      const sp = sceneAt(rt, "nguoi", 0, NGUOI.rig.height, body3(NGUOI));
      const T = trunk3(NGUOI, sp)!;
      // tâm bảng (thế giới rig) trừ khớp hông thân
      const p = at(rt, 0);
      const c = matVec(p.R, [0, 0.6, 0]);
      const hips: V3 = [T.hips[0] * 100, -T.hips[1] * 100, -T.hips[2] * 100];
      return [0, 1, 2].map((i) => p.P[i] + c[i] * p.s - hips[i]) as V3;
    });
    const len = (v: V3) => Math.hypot(...v);
    expect(len(pts[1])).toBeCloseTo(len(pts[0]), 6);
    expect(
      angle(pts[0].map((v) => v / len(pts[0])) as V3, pts[1].map((v) => v / len(pts[1])) as V3),
    ).toBeCloseTo(30, 4);
    // cúi về trước: người nhìn +z nên tâm bảng ra +z và xuống (+y)
    expect(pts[1][2]).toBeGreaterThan(pts[0][2]);
    expect(pts[1][1]).toBeGreaterThan(pts[0][1]);
  });

  it("trục phụ gần trùng trục chính: không ném, trả `degenerate`, `check` báo `item`", () => {
    const rt = runtime([mark(0, { roll: { axis: "top", toward: [1, 0.1, 0] } })]);
    const p = at(rt, 0);
    expect(p.degenerate).toBe(true);
    expect(det(p.R)).toBeCloseTo(1, 9);
    const lines = sceneItemProblems(rt, { chars });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/nguoi: `items` bang-gia t=0: trục phụ .* lệch trục chính 5\.7°/);
    expect(sceneItemProblems(runtime([mark(0)]), { chars })).toEqual([]);
  });

  it("ca 1 bước 0: `holderFace` từ ngực ngẩng không quá 45°, mặt bảng về người cầm", () => {
    const rt = runtime([
      mark(0, { offset: [30, -2.9, 0], face: { axis: "front", toward: "holderFace" } }),
    ]);
    const w = sceneAt(rt, "nguoi", 0, NGUOI.rig.height, body3(NGUOI)).world!;
    near(w.hip, fx.world.hip, 0.1);
    expect(w.yaw).toBeCloseTo(fx.world.yaw, 9);
    expect(w.flip).toBe(fx.world.flip);
    const p = at(rt, 0);
    const front = axisOf(p, "front");
    const rise = (Math.asin(-front[1]) * 180) / Math.PI;
    expect(rise).toBeLessThanOrEqual(45 + 1e-9);
    expect(rise).toBeGreaterThan(44.9);
    // nguoi nhìn +z: mặt bảng quay lùi về người cầm
    expect(front[2]).toBeLessThan(0);
    expect(p.degenerate).toBeUndefined();
  });

  it("mặc định của nhóm lấp trục không khai; `face` trần lấy trục của nhóm", () => {
    const rt = runtime([
      { t: 0, cast: "nguoi", item: "bang-gia", to: "chest", offset: [30, 0, 0], face: "forward" },
    ]);
    const p = itemAt(rt, "bang-gia", 0, {
      chars,
      defaults: { face: { axis: "front", toward: "holderFace" }, roll: UP_ROLL },
    })!;
    near(axisOf(p, "front"), [0, 0, 1], 1e-9);
    near(axisOf(p, "top"), [0, -1, 0], 1e-9);
  });

  it("tất định: hai runtime cùng JSON cùng số", () => {
    const items = [
      mark(0),
      mark(1.2, { offset: [20, -40, 15], face: { axis: "front", toward: "holderFace" } }),
    ];
    const a = runtime(items);
    const b = runtime(items);
    for (const t of [0, 0.37, 0.8, 1.2, 2]) expect(at(a, t)).toEqual(at(b, t));
  });

  it("mốc món tham chiếu người hay món không có là lỗi lúc nạp", () => {
    expect(() => runtime([mark(0, { cast: "ai" })])).toThrow(/không có `ai` trong `cast`/);
    expect(() => runtime([mark(0, { item: "khac" })])).toThrow(/không có món `khac`/);
    expect(() => runtime([mark(1), mark(0.5)])).toThrow(/tăng dần/);
    expect(() => runtime([mark(0, { roll: { axis: "khong", toward: "up" } })])).toThrow(/khong/);
    expect(
      parseScene({ cast: [{ id: "a" }], items: [{ t: 0, cast: "a", item: "x" }] }).success,
    ).toBe(false);
  });
});
