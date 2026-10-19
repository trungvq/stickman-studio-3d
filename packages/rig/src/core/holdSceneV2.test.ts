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
import { CharacterSchema, parseCharacter } from "./schema";
import type { Reach } from "./types";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";
import v1Reach from "./__fixtures__/hold-v1-reach.json";

vi.mock("./graspSolve", async (orig) => {
  const m = await orig<typeof import("./graspSolve")>();
  return { ...m, chooseMissing: vi.fn(m.chooseMissing) };
});

const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

// đường `món#kiểu`: cảnh và số ghi từ code trước khi có chỗ cầm nhóm (`__fixtures__/hold-v1-reach.json`)
const C1 = CharacterSchema.parse({ head: { form: "human" }, palette: { clad: true } });
const PHONE_V1 = spec({
  size: [18, 36, 3.5],
  anchors: {
    screen: { at: [0, 0, 1.75], dir: [0, 0, 1] },
    back: { at: [0, 0, -1.75], dir: [0, 0, -1] },
    top: { at: [0, 18, 0], dir: [0, 1, 0] },
    speaker: { at: [0, 15, 1.75], dir: [0, 0, 1] },
  },
  grips: {
    khoe: {
      pose: "span",
      at: { anchor: "back", offset: [0, -6, -1.5] },
      palm: { into: "back" },
      fingers: { toward: "top" },
      intent: { face: { axis: "screen", toward: "camera" }, roll: { axis: "top", toward: "up" } },
    },
    doc: {
      pose: "span",
      at: { anchor: "back", offset: [0, -4, -1.5] },
      palm: { into: "back" },
      fingers: { toward: "top" },
      intent: { face: { axis: "screen", toward: "holderFace" } },
    },
  },
});
const PEN_V1 = spec({
  size: [2.6, 30, 3.4],
  anchors: { tip: { at: [0, 0, 0], dir: [0, -1, 0] }, barrel: { at: [0, 7, 0] } },
  grips: {
    viet: {
      pose: "pinch",
      at: { anchor: "barrel", offset: [0, 0, 1.2] },
      palm: [1, 0, 0],
      fingers: { toward: "tip" },
      intent: { face: { axis: "tip", toward: [0.5, 0.866, 0] } },
    },
  },
});
const HANDS_V1 = [
  { t: 0, right: { to: "chest", offset: [30, 20, 10], point: "grip", hold: "dien-thoai#doc" } },
  { t: 0.4, left: { to: "belly", offset: [25, 0, 15], hold: "but#viet" } },
  { t: 1, right: { to: "chest", offset: [35, 10, 10], hold: "dien-thoai#khoe" } },
  {
    t: 1.6,
    right: {
      hold: { item: "dien-thoai", grip: "khoe", face: { axis: "screen", toward: { cast: "b" } } },
    },
  },
  {
    t: 2.4,
    right: { to: "head", offset: [0, 0, 18], point: "item:speaker", hold: "dien-thoai#doc" },
  },
  { t: 3, right: { hold: null }, left: { at: [20, -90, 40], point: "item:tip", hold: "but#viet" } },
  { t: 3.5, right: null, left: { hold: "dien-thoai#khoe" } },
  { t: 4, left: null },
];
const TIMES_V1 = [
  0, 0.1, 0.35, 0.4, 0.5, 0.7, 1, 1.05, 1.2, 1.31, 1.6, 1.7, 2, 2.4, 2.45, 2.6, 3, 3.1, 3.3, 3.5,
  3.6, 3.9, 4, 4.5,
];

function v1Hands() {
  const r = parseScene({
    name: "x",
    lens: { eye: [0, -250, -1400], yaw: 0, pitch: 0, f: 800 },
    cast: [
      { id: "a", world: { at: [0, 0, 0], yaw: 90, hands: HANDS_V1 }, tracks: [] },
      { id: "b", world: { at: [120, 0, 60], yaw: 270 }, tracks: [] },
    ],
  });
  if (!r.success) throw new Error(r.error.message);
  const rt = resolveScene(
    r.data,
    {},
    {},
    {},
    { a: 1, b: 1 },
    { a: body3(C1), b: body3(C1) },
    {
      "dien-thoai": PHONE_V1,
      but: PEN_V1,
    },
  );
  return TIMES_V1.map((t) => {
    const w = sceneAt(rt, "a", t, 1, body3(C1)).world!;
    return JSON.parse(
      JSON.stringify({ t, hands: w.hands ?? null }, (k, v) => (k === "spec" ? undefined : v)),
    );
  });
}

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
  it("`món#kiểu` ra `ReachHold` như cũ, không có `grasp`", () => {
    const now = v1Hands();
    expect(now).toEqual(v1Reach);
    expect(JSON.stringify(now)).not.toContain('"grasp"');
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
    expect(() => runtime([{ t: 0, right: { to: "chest", hold: "bang-gia#doc" } }])).toThrow(
      /món v2 không có kiểu cầm/,
    );
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
