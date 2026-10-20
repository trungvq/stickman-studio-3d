import { describe, expect, it, vi } from "vitest";
import { body3 } from "./figure3d";
import * as solve from "./graspSolve";
import { HOLD_BLEND, parseHeldItem, type HeldItemSpec, type ReachHold } from "./heldItem";
import {
  graspAtTime,
  HolderCharError,
  parseScene,
  resolveScene,
  sceneAt,
  sceneItemHoldProblems,
  type GraspAtTime,
  type SceneRuntime,
} from "./scene";
import { parseCharacter } from "./schema";
import type { Reach } from "./types";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";

vi.mock("./graspSolve", async (orig) => {
  const m = await orig<typeof import("./graspSolve")>();
  return { ...m, chooseMissing: vi.fn(m.chooseMissing) };
});

const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

// chỗ cầm nhóm: người mẫu đứng cầm bảng (như `sceneItems.test.ts`)
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const BANG = spec(bangGia);
const PHONE = spec(dienThoai);
const H = NGUOI.rig.height;
const chars = { nguoi: NGUOI };

function runtime(hands: unknown[], items?: unknown[]): SceneRuntime {
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
    ...(items && { items }),
  });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(
    r.data,
    {},
    {},
    {},
    { nguoi: H },
    { nguoi: body3(NGUOI) },
    { "bang-gia": BANG, "dien-thoai": PHONE },
  );
}

/** Tay phải, tay trái của người ở `t` (gần / xa đổi theo lật) */
function handsAt(rt: SceneRuntime, t: number): { right?: Reach; left?: Reach } {
  const w = sceneAt(rt, "nguoi", t, H, body3(NGUOI)).world!;
  const [right, left] = w.flip ? [w.hands?.far, w.hands?.near] : [w.hands?.near, w.hands?.far];
  return { right, left };
}
const holdAt = (rt: SceneRuntime, t: number, side: "right" | "left" = "right"): ReachHold =>
  handsAt(rt, t)[side]!.hold!;

const mark = (t: number, offset = [30, -2.9, 0]) => ({
  t,
  cast: "nguoi",
  item: "bang-gia",
  to: "chest",
  offset,
  face: { axis: "front", toward: "holderFace" },
  roll: { axis: "top", toward: "up" },
});
const SHEET = { item: "bang-gia", group: "sheet", edge: "right", along: 0.33, thumb: "front" };

describe("chỗ cầm nhóm trong cảnh", () => {
  it("`hold` dạng `{ item, grip }` hay chuỗi có `#`: `parseScene` báo lỗi", () => {
    const parse = (hold: unknown) =>
      parseScene({
        name: "x",
        lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
        cast: [{ id: "a", world: { at: [0, 0, 0], hands: [{ t: 0, right: { hold } }] } }],
      });
    const grip = parse({ item: "dien-thoai", grip: "doc" });
    expect(grip.success).toBe(false);
    expect(grip.error!.message).toMatch(/stickman migrate-held/);
    const hash = parse("dien-thoai#doc");
    expect(hash.success).toBe(false);
    expect(hash.error!.message).toMatch(/món@nhóm/);
  });

  it("tay dẫn `món@sheet`: `mode: hand`, lựa chọn mặc định của nhóm, ý định của nhóm", () => {
    const rt = runtime([
      { t: 0, right: { to: "chest", offset: [30, 20, 20], point: "grip", hold: "bang-gia@sheet" } },
    ]);
    const r = handsAt(rt, 0.5).right!;
    const g = r.hold!.grasp!;
    expect(g.mode).toBe("hand");
    expect(g.t0).toBe(0);
    expect(g.hold).toEqual({ item: "bang-gia", group: "sheet" });
    expect(g.choice).toMatchObject({ part: expect.any(String), feature: "slab", thumb: "front" });
    expect(r.hold!.grip).toBe("@sheet////");
    expect(r.hold!.prior).toBeDefined();
    expect(r.aim?.terms?.[0]).toMatchObject({ hold: { item: "bang-gia", grip: "@sheet////" } });
  });

  it("món có mốc ở `items`: `mode: item`, `choice` chỉ trường cảnh khai, không ý định, không `prior`", () => {
    const rt = runtime([{ t: 0, right: { hold: SHEET } }], [mark(0)]);
    const r = handsAt(rt, 0.2).right!;
    const g = r.hold!.grasp!;
    expect(g.mode).toBe("item");
    expect(g.t0).toBe(0);
    expect(g.choice).toEqual({ edge: "right", along: 0.33, thumb: "front" });
    expect(r.hold!.prior).toBeUndefined();
    expect(r.aim).toBeUndefined();
    // lựa chọn rig giải chỉ có ở `graspAtTime`, trên nhân vật thật
    expect(() => graspAtTime(rt, "nguoi", "right", 0.2)).toThrow(HolderCharError);
    const sol = graspAtTime(rt, "nguoi", "right", 0.2, { chars })!;
    expect(sol.choice).toMatchObject({ ...g.choice, feature: "slab" });
    expect(sol.choice.variant).toBeDefined();
    expect(sol.t0).toBe(0);
    expect(graspAtTime(rt, "nguoi", "left", 0.2, { chars })).toBeUndefined();
  });

  it("lỗi `choice`: mốc tay khai đích hay ý định cho món đặt trước, `both` mà tay kia cũng cầm", () => {
    const at = { to: "chest", offset: [30, 0, 0] };
    expect(() => runtime([{ t: 0, right: { ...at, hold: SHEET } }], [mark(0)])).toThrow(
      /lỗi `choice`.*mốc tay không khai `to`, `offset`/,
    );
    expect(() =>
      runtime([{ t: 0, right: { hold: { ...SHEET, face: "camera" } } }], [mark(0)]),
    ).toThrow(/lỗi `choice`.*`face`/);
    expect(() =>
      runtime(
        [
          { t: 0, right: { hold: SHEET } },
          { t: 1, right: { to: "chest" } },
        ],
        [mark(0)],
      ),
    ).toThrow(/right t=1 \(lỗi `choice`\)/);
    expect(() =>
      runtime([
        {
          t: 0,
          right: { to: "chest", hold: { item: "bang-gia", group: "sheet", both: true } },
          left: { to: "belly", hold: "dien-thoai@palmBox" },
        },
      ]),
    ).toThrow(/lỗi `choice`.*`both`/);
    // tay dẫn được khai đích và ý định
    expect(() =>
      runtime([{ t: 0, right: { ...at, hold: { ...SHEET, face: "camera" } } }]),
    ).not.toThrow();
  });

  it("lỗi `group` khi món không có khối hình cho nhóm, lỗi `choice` khi trường không thuộc nhóm", () => {
    expect(() => runtime([{ t: 0, right: { to: "chest", hold: "bang-gia@palmBox" } }])).toThrow(
      /lỗi `group`/,
    );
    expect(() =>
      runtime([{ t: 0, right: { to: "chest", hold: { ...SHEET, around: 30 } } }]),
    ).toThrow(/lỗi `choice`.*`around`/);
  });

  it("mốc món ở giây không tay nào cầm: `sceneItemHoldProblems`", () => {
    const rt = runtime(
      [
        { t: 0, right: { hold: SHEET } },
        { t: 1, right: { hold: null } },
      ],
      [mark(0), mark(2)],
    );
    const lines = sceneItemHoldProblems(rt);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/nguoi: `items` bang-gia t=2: không tay nào/);
  });

  it("`regrip` mở lần cầm mới cùng khoá; liên kết cũ mang theo ở `from`", () => {
    const hands = (regrip: boolean) => [
      { t: 0, right: { to: "chest", hold: SHEET } },
      { t: 1, right: { to: "chest", hold: { ...SHEET, along: 0.6, ...(regrip && { regrip }) } } },
    ];
    const plain = holdAt(runtime(hands(false)), 1.1);
    expect(plain.since).toBe(0);
    expect(plain.grasp!.t0).toBe(0);
    expect(plain.from).toBeUndefined();
    const rt = runtime(hands(true));
    const h = holdAt(rt, 1 + HOLD_BLEND / 2);
    expect(h.since).toBe(1);
    expect(h.grasp!.t0).toBe(1);
    expect(h.from!.k).toBeCloseTo(0.5, 9);
    expect(h.from!.grasp!.t0).toBe(0);
    expect(h.from!.grasp!.hold.along).toBe(0.33);
    expect(holdAt(rt, 1 + HOLD_BLEND + 0.01).from).toBeUndefined();
  });

  it("tay trượt: trường số hoà theo `smoothstep` giữa hai mốc tay của cùng lần cầm", () => {
    const rt = runtime([
      { t: 0, right: { to: "chest", hold: { ...SHEET, along: 0.2 } } },
      { t: 1, right: { to: "chest", hold: { ...SHEET, along: 0.8 } } },
      { t: 2, right: { to: "chest", hold: { ...SHEET, edge: "left", along: 0.5 } } },
    ]);
    const along = (t: number) => holdAt(rt, t).grasp!.hold.along as number;
    expect(along(0)).toBeCloseTo(0.2, 12);
    expect(along(0.25)).toBeCloseTo(0.2 + 0.6 * 0.15625, 12);
    expect(along(0.5)).toBeCloseTo(0.5, 12);
    expect(holdAt(rt, 0.5).grasp!.choice.along).toBeCloseTo(0.5, 12);
    expect(along(1.5)).toBe(0.8);
    expect(holdAt(rt, 1.5).since).toBe(0);
    // đổi cạnh là lần cầm mới: không hoà qua ranh giới
    expect(holdAt(rt, 2.1).since).toBe(2);
    expect(along(1.99)).toBe(0.8);
  });

  it("món đặt trước: lựa chọn giải một lần mỗi lần cầm, tất định giữa hai runtime và khi khung nhảy cóc", () => {
    const hands = [
      { t: 0, right: { hold: { ...SHEET, along: 0.25 } } },
      { t: 0.6, right: { hold: { ...SHEET, along: 0.5 } } },
      { t: 1, right: { hold: { ...SHEET, along: 0.5, regrip: true } } },
    ];
    const items = [mark(0), mark(0.8, [34, -8, 4]), mark(1.6, [30, 0, -4])];
    const spy = vi.mocked(solve.chooseMissing);
    spy.mockClear();
    const a = runtime(hands, items);
    const seq: GraspAtTime[] = [];
    for (let i = 0; i <= 45; i++) seq.push(graspAtTime(a, "nguoi", "right", i / 30, { chars })!);
    // hai lần cầm (0 và `regrip` ở 1), mỗi lần một lời giải; `sceneAt` không giải
    expect(spy).toHaveBeenCalledTimes(2);
    for (let i = 0; i <= 45; i += 5) handsAt(a, i / 30);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(seq[20].t0).toBe(0);
    expect(seq[40].t0).toBe(1);
    expect(seq[9].choice.along).toBeCloseTo(0.25 + 0.25 * 0.5, 9);
    const steps = seq.slice(1, 30).map((s, i) => Math.abs(s.arm.phi - seq[i].arm.phi));
    expect(Math.max(...steps)).toBeLessThanOrEqual(2.5 + 1e-9);

    for (const i of [42, 13, 0, 30]) {
      const b = runtime(hands, items);
      expect(graspAtTime(b, "nguoi", "right", i / 30, { chars })).toEqual(seq[i]);
    }
    const c = runtime(hands, items);
    expect(handsAt(c, 1.2).right!.hold!.grasp).toEqual(handsAt(a, 1.2).right!.hold!.grasp);
  });
});
