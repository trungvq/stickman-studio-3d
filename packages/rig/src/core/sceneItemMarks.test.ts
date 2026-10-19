import { afterEach, describe, expect, it, vi } from "vitest";
import { trunk3 } from "./act3";
import { body3 } from "./figure3d";
import * as groups from "./graspGroups";
import { heldAxis, heldPoint, parseHeldItem, type HeldItemSpec } from "./heldItem";
import { matVec, type V3 } from "./lens";
import {
  HolderCharError,
  ItemAxisError,
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

vi.mock("./graspGroups", async (orig) => {
  const m = await orig<typeof import("./graspGroups")>();
  return { ...m, groupIntent: vi.fn(m.groupIntent) };
});
const realIntent = (await vi.importActual<typeof import("./graspGroups")>("./graspGroups"))
  .groupIntent;
afterEach(() => vi.mocked(groups.groupIntent).mockImplementation(realIntent));

const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const heldParsed = parseHeldItem(bangGia);
if (!heldParsed.success) throw new Error("bang-gia");
const BANG: HeldItemSpec = heldParsed.data;
const chars = { nguoi: NGUOI };
const UP_ROLL = { axis: "top", toward: "up" } as const;
const EYE = [0, -400, -900];
const SHEET = { item: "bang-gia", group: "sheet", edge: "right", along: 0.33, thumb: "front" };

function runtime(items: unknown[], hands?: unknown[]): SceneRuntime {
  const r = parseScene({
    duration: 4,
    lens: { eye: EYE, yaw: 0, pitch: 0, f: 1000 },
    cast: [
      {
        id: "nguoi",
        base: { torso: 9, head: [0, 0, -6] },
        world: { at: [250, 0, 506], yaw: 270, ...(hands && { hands }) },
      },
    ],
    items,
  });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(
    r.data,
    {},
    {},
    {},
    { nguoi: NGUOI.rig.height },
    { nguoi: body3(NGUOI) },
    { "bang-gia": BANG },
  );
}

const at = (rt: SceneRuntime, t: number) => itemAt(rt, "bang-gia", t, { chars })!;
const axisOf = (p: ItemPose, a: string): V3 => matVec(p.R, heldAxis(BANG, a));
const unit = (v: readonly number[]): V3 => {
  const n = Math.hypot(...v);
  return v.map((x) => x / n) as V3;
};
const near = (a: readonly number[], b: readonly number[], d = 1e-9) =>
  a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThan(d));
const SPOT = [262, -300, 560];
const mark = (more: object = {}) => ({
  t: 0,
  cast: "nguoi",
  item: "bang-gia",
  to: "chest",
  offset: [30, 0, 0],
  face: { axis: "front", toward: "forward" },
  roll: UP_ROLL,
  ...more,
});
const placed = (more: object = {}) => mark({ to: undefined, offset: undefined, at: SPOT, ...more });

describe("mốc món: đặt, hướng, báo", () => {
  it("`at` + `point`: mốc món nằm đúng chỗ khai ở thế giới rig", () => {
    const p = at(runtime([placed({ point: "edgeR" })]), 0);
    const q = matVec(p.R, heldPoint(BANG, "edgeR"));
    near(
      [0, 1, 2].map((i) => p.P[i] + q[i] * p.s),
      SPOT,
      1e-9,
    );
  });

  it("`tilt` dương ngẩng trục khỏi đích, quanh trục ngang", () => {
    const p = at(runtime([placed({ face: { axis: "front", toward: "forward", tilt: 20 } })]), 0);
    const r = (20 * Math.PI) / 180;
    near(axisOf(p, "front"), [0, -Math.sin(r), Math.cos(r)], 1e-9);
  });

  it("đích `camera`: trục quay về mắt ống kính từ chỗ món", () => {
    const p = at(runtime([placed({ face: { axis: "front", toward: "camera" } })]), 0);
    near(axisOf(p, "front"), unit(EYE.map((v, i) => v - SPOT[i])), 1e-9);
  });

  it("`holderFace`: hướng ngang luôn về tâm sọ, chỉ góc ngẩng kẹp 45°", () => {
    const rises: number[] = [];
    const azimuths: number[] = [];
    for (let y = -480; y <= -160; y += 20) {
      const p = at(
        runtime([placed({ at: [262, y, 560], face: { axis: "front", toward: "holderFace" } })]),
        0,
      );
      const f = axisOf(p, "front");
      rises.push((Math.asin(-f[1]) * 180) / Math.PI);
      azimuths.push(Math.atan2(f[0], f[2]));
    }
    // chỗ món chỉ dời dọc: hướng ngang không đổi qua ranh 45°
    for (const a of azimuths) expect(a).toBeCloseTo(azimuths[0], 9);
    expect(Math.max(...rises)).toBeLessThanOrEqual(45 + 1e-9);
    expect(rises.filter((r) => r > 45 - 1e-9).length).toBeGreaterThan(0);
    expect(Math.min(...rises)).toBeLessThan(30);
    // tâm sọ của người cầm, hướng ngang từ chỗ món
    const T = trunk3(
      NGUOI,
      sceneAt(runtime([placed()]), "nguoi", 0, NGUOI.rig.height, body3(NGUOI)),
    )!;
    const head = [T.out.head[0] * 100, -T.out.head[1] * 100, -T.out.head[2] * 100];
    expect(azimuths[0]).toBeCloseTo(Math.atan2(head[0] - 262, head[2] - 560), 9);
  });

  it("đích trùng chỗ món là lỗi riêng, không thành suy biến 0°", () => {
    const face = runtime([
      mark({ face: { axis: "front", toward: { mark: "chest" } }, offset: undefined }),
    ]);
    expect(at(face, 0).coincident).toBe(true);
    expect(at(face, 0).degenerate).toBeUndefined();
    const lf = sceneItemProblems(face, { chars });
    expect(lf).toHaveLength(1);
    expect(lf[0]).toMatch(/nguoi: `items` bang-gia t=0: đích của `face` trùng chỗ món/);

    const roll = runtime([
      mark({ roll: { axis: "top", toward: { mark: "chest" } }, offset: undefined }),
    ]);
    const p = at(roll, 0);
    expect(p.coincident).toBe(true);
    expect(p.degenerate).toBeUndefined();
    near(axisOf(p, "front"), [0, 0, 1], 1e-9);
    const lr = sceneItemProblems(roll, { chars });
    expect(lr).toHaveLength(1);
    expect(lr[0]).toMatch(/đích của `roll` trùng chỗ món/);
    expect(lr[0]).not.toMatch(/lệch trục chính/);
  });

  it("`face` trần không trục: `itemAt` ném `ItemAxisError`, `check` báo `item`", () => {
    const rt = runtime([mark({ face: "forward", roll: undefined })]);
    expect(() => at(rt, 0)).toThrow(ItemAxisError);
    const lines = sceneItemProblems(rt, { chars });
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/nguoi: `items` bang-gia t=0: `face` là đích trần mà không có trục/);
    // nhóm tay đang cầm cho trục: `sheet` lấy `front`
    const held = runtime(
      [mark({ face: "forward", roll: undefined })],
      [{ t: 0, right: { hold: SHEET } }],
    );
    expect(sceneItemProblems(held, { chars })).toEqual([]);
    near(axisOf(at(held, 0), "front"), [0, 0, 1], 1e-9);
  });

  it("`face` trần mà nhóm đang cầm không có trục mặc định: lỗi `item` lúc nạp", () => {
    vi.mocked(groups.groupIntent).mockImplementation(() => ({}));
    expect(() =>
      runtime([mark({ face: "forward", roll: undefined })], [{ t: 0, right: { hold: SHEET } }]),
    ).toThrow(/nguoi: \(lỗi `item`\) `items` bang-gia t=0: `face` là đích trần/);
  });

  it("đường món đặt trước cần nhân vật thật: thiếu `chars` ném `HolderCharError`; `trunks` dùng thân đã dựng", () => {
    const rt = runtime([mark()]);
    expect(() => itemAt(rt, "bang-gia", 0)).toThrow(HolderCharError);
    expect(() => itemAt(rt, "bang-gia", 0, { chars: {} })).toThrow(/`nguoi` cầm món đặt trước/);
    expect(() => sceneItemProblems(rt)).toThrow(HolderCharError);
    const T = trunk3(NGUOI, sceneAt(rt, "nguoi", 0, NGUOI.rig.height, body3(NGUOI)))!;
    const p = itemAt(rt, "bang-gia", 0, { trunks: { nguoi: T } })!;
    const q = at(rt, 0);
    near(p.P, q.P, 1e-9);
    near(p.R, q.R, 1e-12);
  });

  it("`t` của cùng một món phải tăng hẳn", () => {
    expect(() => runtime([mark(), mark()])).toThrow(/`t` của cùng một món phải tăng dần/);
    expect(() => runtime([mark(), mark({ t: 1 })])).not.toThrow();
  });
});
