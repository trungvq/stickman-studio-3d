import { describe, expect, it, vi } from "vitest";
import { actArm, actHeld, actJoints, type ActJoint } from "./act3";
import type { ActInput } from "./arm3";
import { body3 } from "./figure3d";
import { evalPhi, phiOf, phiToward } from "./graspArm";
import { HELD_ARM } from "./heldAudit";
import { heldPoint, parseHeldItem, type HeldItemSpec } from "./heldItem";
import {
  applyJsonPatch,
  holdToHandLed,
  holdToItemLed,
  HOLD_MODE_ANGLE,
  HOLD_MODE_POS,
  type HoldModeResult,
  type JsonPatchOp,
} from "./holdMode";
import { holdHand } from "./holdLink";
import { add3, matVec, scale3, sub3, type M3, type V3 } from "./lens";
import {
  holdRuns,
  itemAt,
  itemCentre,
  parseScene,
  resolveScene,
  sceneAt,
  sceneHoldProblems,
  type SceneRuntime,
} from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dienThoai from "../../../../common/held/dien-thoai.json";
import khay from "./__fixtures__/held-v2/khay.json";

vi.setConfig({ testTimeout: 30_000 });

// Đổi chế độ lần cầm (docs/11-nhom-cam.md § Đổi chế độ lần cầm)

const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const HELD = { "bang-gia": spec(bangGia), "dien-thoai": spec(dienThoai), khay: spec(khay) };
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const H = NGUOI.rig.height;
const DIMS = body3(NGUOI);

const SHEET = { item: "bang-gia", group: "sheet", edge: "right", along: 0.33, thumb: "front" };
const bang = (t: number | string, offset = [30, -2.9, 0]) => ({
  t,
  cast: "nguoi",
  item: "bang-gia",
  to: "chest",
  offset,
  face: { axis: "front", toward: "holderFace" },
  roll: { axis: "top", toward: "up" },
});

type Raw = Record<string, unknown> & {
  cast: (Record<string, unknown> & { world: Record<string, unknown> & { hands: unknown[] } })[];
  items?: unknown[];
};

/** Cảnh: tay phải dẫn điện thoại từ giây 0 (mốc thân, mốc tên, trường lạ `hand`), tay trái cầm bảng theo mốc từ 2,5 */
const sceneA = (): Raw => ({
  duration: 5,
  marks: { cam: 0.8, doi: 3.2 },
  lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
  cast: [
    {
      id: "nguoi",
      base: { torso: 9, head: [0, 0, -6] },
      world: {
        at: [250, 0, 506],
        yaw: 270,
        hands: [
          {
            t: 0,
            right: {
              to: "chest",
              offset: [40, 10, 20],
              point: "grip",
              hold: "dien-thoai@palmBox",
              hand: { palm: "in" },
            },
          },
          { t: "@cam", right: { at: [205, -265, 480], point: "grip" } },
          {
            t: 2,
            right: {
              to: "chest",
              offset: [38, 0, 18],
              point: "grip",
              hold: {
                item: "dien-thoai",
                group: "palmBox",
                face: { axis: "screen", toward: "camera" },
              },
            },
          },
          { t: 2.5, right: { hold: null }, left: { hold: SHEET } },
          { t: 4.6, left: { hold: null } },
        ],
      },
    },
  ],
  items: [bang(2.5), bang("@doi", [36, -10, 6]), bang(4.2, [30, 0, 0])],
});

/**
 * Cảnh: hai tay cầm bảng theo mốc món (tay trái khai riêng từ giây 1); `face` của mốc món, `offset` đổi được. Cạnh tấm
 * gọi theo khung món nhìn từ mặt `front`, nên bảng quay mặt về người cầm thì cầm thuận là tay phải `right`, tay trái `left`;
 * `edges` ngược lại là hai tay bắt chéo
 */
const sceneB = (
  face = "holderFace",
  offsets = [
    [35, -5, 0],
    [30, -5, -5],
  ],
  [er, el] = ["right", "left"],
): Raw => ({
  duration: 3,
  lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
  cast: [
    {
      id: "nguoi",
      base: { torso: 9, head: [0, 0, -6] },
      world: {
        at: [250, 0, 506],
        yaw: 270,
        hands: [
          { t: 0, right: { hold: { item: "bang-gia", group: "sheet", edge: er } } },
          {
            t: 1,
            right: { hold: { item: "bang-gia", group: "sheet", edge: er } },
            left: { hold: { item: "bang-gia", group: "sheet", edge: el } },
          },
          { t: 2.5, right: { hold: null }, left: { hold: null } },
        ],
      },
    },
  ],
  items: [
    {
      t: 0,
      cast: "nguoi",
      item: "bang-gia",
      to: "chest",
      offset: offsets[0],
      face: { axis: "front", toward: face },
      roll: { axis: "top", toward: "up" },
    },
    {
      t: 2,
      cast: "nguoi",
      item: "bang-gia",
      to: "chest",
      offset: offsets[1],
      face: { axis: "front", toward: face },
      roll: { axis: "top", toward: "up" },
    },
  ],
});

function build(raw: unknown): SceneRuntime {
  const r = parseScene(raw);
  if (!r.success) throw new Error(r.error.message);
  const rt = resolveScene(r.data, {}, { nguoi: H }, { nguoi: DIMS }, HELD);
  rt.chars = { nguoi: NGUOI };
  return rt;
}

const keysOf = (raw: Raw) => raw.cast[0].world.hands as Record<string, unknown>[];
const keyRows = (r: HoldModeResult) => r.rows.filter((x) => x.kind === "key" && !x.blending);

describe("applyJsonPatch", () => {
  it("thêm, thay, xoá theo thứ tự; chỉ số mảng sau thao tác trước; không đổi bản gốc", () => {
    const doc = { a: [1, 2, 3], b: { c: 1, "x/y": 2 } };
    const ops: JsonPatchOp[] = [
      { op: "remove", path: "/a/0" },
      { op: "add", path: "/a/1", value: 9 },
      { op: "add", path: "/a/-", value: 7 },
      { op: "replace", path: "/b/c", value: { d: 1 } },
      { op: "remove", path: "/b/x~1y" },
      { op: "add", path: "/e", value: [] },
    ];
    expect(applyJsonPatch(doc, ops)).toEqual({ a: [2, 9, 3, 7], b: { c: { d: 1 } }, e: [] });
    expect(doc).toEqual({ a: [1, 2, 3], b: { c: 1, "x/y": 2 } });
  });

  it("đường sai thì ném", () => {
    expect(() => applyJsonPatch({ a: [] }, [{ op: "remove", path: "/a/0" }])).toThrow(/ngoài/);
    expect(() => applyJsonPatch({ a: 1 }, [{ op: "replace", path: "/b", value: 1 }])).toThrow(
      /không có/,
    );
  });
});

/**
 * Tâm hộp bao của món (bảng mặc định) như người 3D vẽ ở `t`: hai tay trên mốc món thì `itemAt`, còn lại món theo bàn tay
 * (`actHeld`)
 */
function drawnBoard(
  rt: SceneRuntime,
  t: number,
  both: boolean,
  item: keyof typeof HELD = "bang-gia",
) {
  const c = itemCentre(HELD[item]);
  if (both) {
    const p = itemAt(rt, item, t, { chars: { nguoi: NGUOI } })!;
    return { P: add3(p.P, matVec(p.R, scale3(c, p.s))), R: p.R };
  }
  const h = Object.values(actHeld(NGUOI, sceneAt(rt, "nguoi", t, H, DIMS) as ActInput)).find(
    (x) => x?.item === item,
  )!;
  const R: M3 = [h.R[0], h.R[1], h.R[2], -h.R[3], -h.R[4], -h.R[5], -h.R[6], -h.R[7], -h.R[8]];
  return { P: add3(h.at, matVec(R, scale3(c, h.s))), R };
}

describe("đồ theo tay → tay theo đồ", () => {
  const raw = sceneA();
  const rt = build(raw);
  const r = holdToItemLed(rt, raw, { id: "nguoi", side: "right", at: 1, rebuild: build });
  const next = applyJsonPatch(raw, r.ops);

  it("lần cầm và chế độ", () => {
    expect(r.scope).toMatchObject({
      item: "dien-thoai",
      lead: "right",
      from: 0,
      until: 2.5,
      mode: { before: "hand", after: "keyed" },
    });
  });

  it("mốc món ở từng mốc tay, giữ `@tên` và mốc thân; mốc tay chỉ còn chỗ cầm, trường lạ còn nguyên", () => {
    const items = next.items as Record<string, unknown>[];
    const mine = items.filter((k) => k.item === "dien-thoai");
    expect(mine.map((k) => k.t)).toEqual([0, "@cam", 2]);
    expect(mine.map((k) => k.to)).toEqual(["chest", undefined, "chest"]);
    expect(mine[1].at).toHaveLength(3);
    for (const k of mine) {
      expect(k).toMatchObject({ cast: "nguoi", ease: "auto" });
      expect((k.face as { axis: number[] }).axis).toEqual([0, 0, 1]);
      expect((k.roll as { axis: number[] }).axis).toEqual([0, 1, 0]);
    }
    // mốc món chèn theo giây, trước các mốc của bảng
    expect(items.map((k) => k.item)).toEqual([
      "dien-thoai",
      "dien-thoai",
      "dien-thoai",
      "bang-gia",
      "bang-gia",
      "bang-gia",
    ]);
    // mốc món chọn khuỷu khác khuỷu đang vẽ ở cả ba mốc: mốc tay giữ chỗ cầm và khoá khuỷu vào hướng đang vẽ
    const hands = keysOf(next);
    expect(hands.map((k) => k.t)).toEqual([0, "@cam", 2, 2.5, 4.6]);
    const right = hands.slice(0, 3).map((k) => k.right as Record<string, unknown>);
    expect(Object.keys(right[0]).sort()).toEqual(["elbow", "elbowLock", "hand", "hold"]);
    expect(right[0].hand).toEqual({ palm: "in" });
    for (const x of right) {
      expect(Object.keys(x)).not.toContain("at");
      expect(Object.keys(x)).not.toContain("to");
      expect(x.hold).toMatchObject({ item: "dien-thoai", group: "palmBox" });
      expect(x.hold).not.toHaveProperty("face");
      expect(x.elbowLock).toBe(true);
    }
    expect(hands.slice(3)).toEqual(keysOf(raw).slice(3));
  });

  it("khuỷu khoá: `elbow` là hướng khuỷu đang vẽ, `φ` sau trùng trước", () => {
    for (const x of keyRows(r)) {
      expect(x.elbowLock).toBe(true);
      expect(Math.abs(x.phi!.after - x.phi!.before)).toBeLessThan(0.5);
    }
    expect(r.notes.join(" ")).toMatch(/khoá \(`elbowLock`\)/);
  });

  it("món ở mốc lệch dưới 0,5 đơn vị rig và 1°; ngoài quãng đổi không đổi", () => {
    expect(keyRows(r).map((x) => x.ref)).toEqual([0, "@cam", 2]);
    expect(r.max.item.pos).toBeLessThan(0.5);
    expect(r.max.item.angle).toBeLessThan(1);
    expect(r.outside.item.pos).toBeLessThan(1e-6);
    expect(r.outside.hand).toBeLessThan(1e-6);
    expect(r.rows.filter((x) => x.kind === "mid").map((x) => x.t)).toEqual([0.4, 1.4]);
  });

  it("vòng về: đồ theo tay lại, đích và món ở mốc trùng bản đầu", () => {
    const back = holdToHandLed(build(next), next, {
      id: "nguoi",
      side: "right",
      at: 0,
      rebuild: build,
    });
    expect(back.scope.mode).toEqual({ before: "keyed", after: "hand" });
    // khuỷu còn khoá ở các mốc tay: tay dẫn không dò khuỷu, món về đúng chỗ
    expect(back.max.item.pos).toBeLessThan(HOLD_MODE_POS);
    expect(back.max.item.angle).toBeLessThan(HOLD_MODE_ANGLE);
    const last = applyJsonPatch(next, back.ops);
    expect(last.items).toEqual(raw.items);
    const hands = keysOf(last);
    expect(hands.map((k) => k.t)).toEqual(keysOf(raw).map((k) => k.t));
    expect(hands.slice(3)).toEqual(keysOf(raw).slice(3));
    const right = hands.map((k) => k.right as Record<string, unknown>);
    const orig = keysOf(raw).map((k) => k.right as Record<string, unknown>);
    expect(right[0]).toMatchObject({
      to: "chest",
      point: "grip",
      hand: { palm: "in" },
      elbowLock: true,
    });
    expect(right[1]).toMatchObject({ point: "grip", elbowLock: true });
    expect(right[2]).toMatchObject({ to: "chest", point: "grip" });
    const near = (a: unknown, b: unknown, d: number) =>
      (a as number[]).forEach((x, i) => expect(Math.abs(x - (b as number[])[i])).toBeLessThan(d));
    near(right[0].offset, orig[0].offset, 0.5);
    near(right[1].at, orig[1].at, 0.5);
    near(right[2].offset, orig[2].offset, 0.5);
  });

  it("đổi giữa chừng: chèn mốc `regrip` ở giây đổi, phần trước giữ mốc cũ", () => {
    const m = holdToItemLed(rt, raw, {
      id: "nguoi",
      side: "right",
      at: 0,
      from: 1.2,
      rebuild: build,
    });
    expect(m.scope).toMatchObject({ from: 1.2, until: 2.5 });
    const n = applyJsonPatch(raw, m.ops);
    const hands = keysOf(n);
    expect(hands.slice(0, 2)).toEqual(keysOf(raw).slice(0, 2));
    expect(hands[2]).toEqual({
      t: 1.2,
      right: {
        hold: expect.objectContaining({ item: "dien-thoai", group: "palmBox", regrip: true }),
      },
    });
    const mine = (n.items as { item: string; t: unknown }[]).filter((k) => k.item === "dien-thoai");
    expect(mine.map((k) => k.t)).toEqual([1.2, 2]);
    const runs = holdRuns(build(n), "nguoi").right;
    expect(runs.map((x) => [x.since, x.until, x.mode])).toEqual([
      [0, 1.2, "hand"],
      [1.2, 2.5, "keyed"],
    ]);
    // giây đổi nằm trong quãng hoà của ranh giới mới; mốc sau trùng
    expect(m.rows[0]).toMatchObject({ t: 1.2, kind: "key", blending: true });
    expect(m.max.item.pos).toBeLessThan(0.5);
    // phần trước giây đổi không còn đi về đích ở giây 2: báo ở `outside`
    expect(m.outside.hand).toBeGreaterThan(1);
    expect(m.outside.t).toBeLessThan(1.2);
    expect(m.notes.join(" ")).toMatch(/ngoài quãng đổi hình đổi/);
  });

  it("từ chối lần cầm đã ở chế độ ấy, giây đổi ngoài lần cầm", () => {
    expect(() =>
      holdToItemLed(rt, raw, { id: "nguoi", side: "left", at: 3, rebuild: build }),
    ).toThrow(/đã là tay theo đồ/);
    expect(() =>
      holdToItemLed(rt, raw, { id: "nguoi", side: "right", at: 0, from: 3, rebuild: build }),
    ).toThrow(/ngoài lần cầm/);
    expect(() =>
      holdToHandLed(rt, raw, { id: "nguoi", side: "right", at: 0, rebuild: build }),
    ).toThrow(/đã là đồ theo tay/);
  });
});

/**
 * Cảnh: tay phải dẫn điện thoại áp tai như `phone-ear-3d` của bộ chung — loa ở tai, máy nằm phẳng trên má dọc đường tai –
 * miệng, màn vào má; hướng món khai ở hệ đầu nên máy quay, gật theo đầu; khuỷu rig giải
 */
const sceneEar = (offset = [33, 19, 11], head = [0, 0, -6], elbow?: number[]): Raw => ({
  duration: 2,
  lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
  cast: [
    {
      id: "nguoi",
      base: { torso: 9, head },
      world: {
        at: [250, 0, 506],
        yaw: 270,
        hands: [
          {
            t: 0,
            right: {
              to: "ear",
              offset,
              point: "grip",
              ...(elbow && { elbow }),
              hold: {
                item: "dien-thoai",
                group: "palmBox",
                thumb: "right",
                tilt: 2,
                face: { axis: "screen", toward: [0, 0, -1], frame: "head" },
                roll: { axis: "top", toward: [-0.9, -0.44, 0], frame: "head" },
                touch: ["self.head"],
              },
            },
          },
        ],
      },
    },
  ],
});

/** Cảnh: tay phải dẫn điện thoại trước mặt, `elbow` khai chĩa ra sau: khuỷu khai khép trước ngực, bắp tay lấn thân */
const sceneC = (): Raw => ({
  duration: 2,
  lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
  cast: [
    {
      id: "nguoi",
      base: { torso: 9, head: [0, 0, -6] },
      world: {
        at: [250, 0, 506],
        yaw: 270,
        hands: [
          {
            t: 0,
            right: {
              to: "chest",
              offset: [0, -60, 30],
              point: "grip",
              elbow: [0, 1, -1],
              hold: {
                item: "dien-thoai",
                group: "palmBox",
                face: { axis: "screen", toward: "holderFace" },
              },
            },
          },
        ],
      },
    },
  ],
});

/**
 * Tay phải như vẽ ở `t`: `φ` khuỷu, góc cổ tay, khớp chạm giới hạn, lấn thân (`bodyRatio`, như `E(φ)` đo) và `φ` của
 * `elbow` khai
 */
function rightArm(rt: SceneRuntime, t = 0) {
  const a = actArm(NGUOI, sceneAt(rt, "nguoi", t, H, DIMS) as ActInput, -1)!;
  const phi = phiOf(a.inp, a.W, a.E);
  return {
    phi,
    wrist: a.wrist,
    clamped: a.report.hold?.clamped ?? [],
    body: evalPhi(a.inp, a.W, a.Rw, phi).bodyRatio,
    toward: (v: number[]) =>
      phiToward(a.inp, a.W, { v: v as [number, number, number], body: true }),
  };
}
const wrapDeg = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;

describe("đồ theo tay → tay theo đồ: khoá khuỷu", () => {
  // `elbow` khai ra trước và xuống hơn khuỷu rig tự giải (~16° `φ`): món đặt trước dò khuỷu riêng nên phải khoá
  const raw = sceneEar(undefined, undefined, [0.6, 0.6, 0.5]);
  const rt = build(raw);
  const r = holdToItemLed(rt, raw, { id: "nguoi", side: "right", at: 0, rebuild: build });
  const next = applyJsonPatch(raw, r.ops);
  const right = keysOf(next)[0].right as Record<string, unknown>;
  const angle = (A: M3, B: M3) =>
    Math.acos(Math.min(1, (A.reduce((n, x, i) => n + x * B[i], 0) - 1) / 2)) / (Math.PI / 180);

  it("mốc tay khoá khuỷu vào hướng đang vẽ; món ở mốc lệch dưới ngưỡng", () => {
    expect(r.scope.mode).toEqual({ before: "hand", after: "keyed" });
    expect(right).toMatchObject({ elbowLock: true, hold: { item: "dien-thoai" } });
    expect(right.elbow).not.toEqual([0.6, 0.6, 0.5]);
    expect(r.rows[0]).toMatchObject({
      elbowLock: true,
      clamped: { before: { right: [] } },
    });
    expect(r.max.item.pos).toBeLessThan(HOLD_MODE_POS);
    expect(r.max.item.angle).toBeLessThan(HOLD_MODE_ANGLE);
    const a = drawnBoard(rt, 0, false, "dien-thoai");
    const b = drawnBoard(build(next), 0, false, "dien-thoai");
    expect(Math.abs(r.rows[0].item!.pos - Math.hypot(...sub3(a.P, b.P)))).toBeLessThan(1e-6);
  });

  it("dáng áp tai tự nhiên (không `elbow`): đổi không khoá; cổ tay xa giới hạn, tay không lấn thân ở cả hai chế độ", () => {
    const bare = sceneEar();
    const rb = holdToItemLed(build(bare), bare, {
      id: "nguoi",
      side: "right",
      at: 0,
      rebuild: build,
    });
    const keyed = applyJsonPatch(bare, rb.ops);
    expect(rb.rows.some((x) => x.elbowLock)).toBe(false);
    expect(rb.max.item.pos).toBeLessThan(HOLD_MODE_POS);
    for (const x of [build(bare), build(keyed)]) {
      const arm = rightArm(x);
      expect(arm.clamped).toEqual([]);
      expect(arm.body).toBeLessThan(0.05);
      // đo được gập −38°, lệch −12°: còn ≥ 15° tới `AIM_BEND` −60 và `AIM_DEV` −30
      expect(arm.wrist[1]).toBeGreaterThan(-45);
      expect(Math.abs(arm.wrist[2])).toBeLessThan(15);
    }
  });

  it("bỏ khoá thì mốc món lấy `elbow` đã ghi làm gợi ý; dáng tự nhiên không phải nhường: món gần như không dời", () => {
    const free = structuredClone(next);
    delete (keysOf(free)[0].right as Record<string, unknown>).elbowLock;
    const a = drawnBoard(rt, 0, false, "dien-thoai");
    const b = drawnBoard(build(free), 0, false, "dien-thoai");
    expect(Math.hypot(...sub3(a.P, b.P))).toBeLessThan(HOLD_MODE_POS);
    expect(angle(a.R, b.R)).toBeLessThan(HOLD_MODE_ANGLE);
  });

  it("vòng về: đồ theo tay giữ khoá, món về chỗ cũ", () => {
    const back = holdToHandLed(build(next), next, {
      id: "nguoi",
      side: "right",
      at: 0,
      rebuild: build,
    });
    expect(back.max.item.pos).toBeLessThan(HOLD_MODE_POS);
    expect(back.max.item.angle).toBeLessThan(HOLD_MODE_ANGLE);
    const last = keysOf(applyJsonPatch(next, back.ops))[0].right as Record<string, unknown>;
    expect(last).toMatchObject({ to: "ear", point: "grip", elbowLock: true });
    expect(last.elbow).toEqual(right.elbow);
  });
});

// Trục dài máy quanh ngưỡng 30° của `edgeHigh`: dưới ngưỡng món đặt trước lấy đầu cao là đầu dưới, tay dẫn lấy đầu `top`;
// phép đổi ghi `high` của chế độ đang vẽ vào chỗ cầm nên khung cầm trùng, món giữ chỗ cả hai chiều. `face`, `roll` khai hệ
// đầu nên trục `top` ngẩng theo đầu gật, mọi `offset`: gật −20 ngẩng 15°, −6 ngẩng 29°, 0 ngẩng 35°, 14 ngẩng 49°
describe("đồ theo tay ↔ tay theo đồ: áp tai, dải dáng tự nhiên quanh ngưỡng 30°", () => {
  const runs = [-20, -6, 0, 14].flatMap((nod) =>
    [
      [33, 19, 11],
      [29, 19, 11],
      [33, 19, 7],
      [33, 23, 11],
    ].map((offset) => {
      const raw = sceneEar(offset, [0, 0, nod]);
      const rt = build(raw);
      const r = holdToItemLed(rt, raw, { id: "nguoi", side: "right", at: 0, rebuild: build });
      const next = applyJsonPatch(raw, r.ops);
      const rise = -matVec(drawnBoard(rt, 0, false, "dien-thoai").R, [0, 1, 0])[1];
      const back = holdToHandLed(build(next), next, {
        id: "nguoi",
        side: "right",
        at: 0,
        rebuild: build,
      });
      return { tag: `offset ${offset} gật ${nod}`, rt, r, next, rise, back };
    }),
  );

  it("dải dáng vắt qua ngưỡng: trục `top` ngẩng 14–50°, có dáng dưới và trên 30°", () => {
    for (const { rise } of runs) {
      expect(rise).toBeGreaterThan(Math.sin(14 * (Math.PI / 180)));
      expect(rise).toBeLessThan(Math.sin(50 * (Math.PI / 180)));
    }
    expect(runs.some((x) => x.rise < 0.5)).toBe(true);
    expect(runs.some((x) => x.rise > 0.5)).toBe(true);
  });

  it("tay theo đồ: mốc món giữ hệ đầu; món ở mốc lệch dưới ngưỡng; cổ tay không chạm giới hạn trước và sau", () => {
    for (const { tag, rt, r, next } of runs) {
      const m = (next.items as { face: { frame?: string }; roll: { frame?: string } }[])[0];
      expect([m.face.frame, m.roll.frame], tag).toEqual(["head", "head"]);
      expect(r.scope.mode, tag).toEqual({ before: "hand", after: "keyed" });
      expect(r.max.item.pos, tag).toBeLessThan(HOLD_MODE_POS);
      expect(r.max.item.angle, tag).toBeLessThan(HOLD_MODE_ANGLE);
      expect(rightArm(rt).clamped, tag).toEqual([]);
      expect(rightArm(build(next)).clamped, tag).toEqual([]);
    }
  });

  it("bỏ `elbow`, `along`, `thumb` (rig giải): cổ tay không chạm giới hạn, món ở mốc như khi giữ", () => {
    for (const { tag, next } of runs) {
      const bare = structuredClone(next);
      const k = keysOf(bare)[0].right as Record<string, unknown>;
      const hold = k.hold as Record<string, unknown>;
      delete k.elbow;
      delete k.elbowLock;
      delete hold.along;
      delete hold.thumb;
      const a = drawnBoard(build(next), 0, false, "dien-thoai");
      const b = drawnBoard(build(bare), 0, false, "dien-thoai");
      expect(rightArm(build(bare)).clamped, tag).toEqual([]);
      expect(Math.hypot(...sub3(a.P, b.P)), tag).toBeLessThan(HOLD_MODE_POS);
    }
  });

  it("đồ theo tay lại: ý định giữ hệ đầu, món về chỗ, cổ tay không chạm giới hạn", () => {
    for (const { tag, next, back } of runs) {
      type Ax = { frame?: string };
      const h = (
        keysOf(applyJsonPatch(next, back.ops))[0].right as { hold: { face: Ax; roll: Ax } }
      ).hold;
      expect([h.face.frame, h.roll.frame], tag).toEqual(["head", "head"]);
      expect(back.max.item.pos, tag).toBeLessThan(HOLD_MODE_POS);
      expect(back.max.item.angle, tag).toBeLessThan(HOLD_MODE_ANGLE);
      expect(rightArm(build(applyJsonPatch(next, back.ops))).clamped, tag).toEqual([]);
    }
  });

  it("`high` chỉ ghi khi hai chế độ khác đầu: dưới 30° ghi đầu `top` của tay dẫn, trên 30° không ghi; chiều ngược giữ", () => {
    for (const { tag, next, rise, back } of runs) {
      const hold = (keysOf(next as Raw)[0].right as { hold: Record<string, unknown> }).hold;
      expect(hold.high, tag).toBe(rise < 0.5 ? "top" : undefined);
      const lead = (
        keysOf(applyJsonPatch(next, back.ops) as Raw)[0].right as { hold: Record<string, unknown> }
      ).hold;
      expect(lead.high, tag).toBe(hold.high);
    }
  });
});

/** Đầu cao khung cầm của tay phải dùng ở `t` (`GraspReport.high`), chiếu lên trục `top` của điện thoại (`+1` / `−1`) */
function highSign(rt: SceneRuntime, t = 0) {
  const g = actArm(NGUOI, sceneAt(rt, "nguoi", t, H, DIMS) as ActInput, -1)!.report.hold?.grasp;
  const h = g?.high;
  return h ? Math.sign(h[1]) : 0;
}

/** Đặt `high` (hay bỏ khi `undefined`) vào `hold` của mọi mốc tay phải */
function withHigh(raw: unknown, high?: string): Raw {
  const out = structuredClone(raw) as Raw;
  for (const k of keysOf(out)) {
    const h = (k.right as { hold?: Record<string, unknown> } | undefined)?.hold;
    if (!h) continue;
    if (high) h.high = high;
    else delete h.high;
  }
  return out;
}

describe("đầu cao cảnh khai (`hold.high`)", () => {
  // trục `top` ngẩng ~29°: món đặt trước không khai lấy đầu dưới (`edgeHigh`), tay dẫn không khai lấy đầu `top`
  const ear = sceneEar();
  const r = holdToItemLed(build(ear), ear, { id: "nguoi", side: "right", at: 0, rebuild: build });
  const keyed = applyJsonPatch(ear, r.ops);

  it("tay dẫn: không khai lấy `top`; khai `bottom` thì dùng đầu dưới, món theo bàn tay đổi khung", () => {
    expect(highSign(build(ear))).toBe(1);
    const bottom = build(withHigh(ear, "bottom"));
    expect(highSign(bottom)).toBe(-1);
    const a = drawnBoard(build(ear), 0, false, "dien-thoai");
    const b = drawnBoard(bottom, 0, false, "dien-thoai");
    expect(Math.hypot(...sub3(a.P, b.P))).toBeGreaterThan(HOLD_MODE_POS);
  });

  it("món đặt trước: không khai như cũ (`edgeHigh`, đầu dưới); khai `bottom` trùng không khai, khai `top` dùng đầu trên", () => {
    expect(highSign(build(keyed))).toBe(1);
    const none = build(withHigh(keyed));
    const bottom = build(withHigh(keyed, "bottom"));
    expect(highSign(none)).toBe(-1);
    expect(highSign(bottom)).toBe(-1);
    const a = drawnBoard(none, 0, false, "dien-thoai");
    const b = drawnBoard(bottom, 0, false, "dien-thoai");
    expect(Math.hypot(...sub3(a.P, b.P))).toBeLessThan(1e-9);
  });

  it("hướng vuông góc chiều cạnh (`front` trên trục dài máy) thì như không khai", () => {
    for (const raw of [ear, keyed]) {
      const a = drawnBoard(build(withHigh(raw)), 0, false, "dien-thoai");
      const b = drawnBoard(build(withHigh(raw, "front")), 0, false, "dien-thoai");
      expect(Math.hypot(...sub3(a.P, b.P))).toBeLessThan(1e-9);
    }
  });

  it("đổi `high` giữa chừng là lần cầm mới", () => {
    const raw = withHigh(ear);
    keysOf(raw).push({
      t: 1,
      right: { hold: { item: "dien-thoai", group: "palmBox", high: "bottom" } },
    });
    const runs = holdRuns(build(raw), "nguoi").right;
    expect(runs.map((x) => x.since)).toEqual([0, 1]);
  });

  it("`sceneHoldProblems` báo `high` vuông góc chiều cạnh, một dòng không số đo; dọc chiều cạnh thì không", () => {
    for (const raw of [ear, keyed]) {
      expect(sceneHoldProblems(build(withHigh(raw, "front")))).toEqual([
        "nguoi: `world.hands` right t=0 (cảnh báo `choice`): `dien-thoai@palmBox`: `high: front` vuông góc chiều cạnh ở mọi chỗ cầm (|cos| dưới 0,1): đầu cao không theo hướng ấy — khai hướng dọc chiều cạnh (`top`, `bottom`) (docs/11-nhom-cam.md#chỗ-cầm-castworldhandshold)",
      ]);
      expect(sceneHoldProblems(build(withHigh(raw, "bottom")))).toEqual([]);
      expect(sceneHoldProblems(build(withHigh(raw)))).toEqual([]);
    }
  });
});

/** Bảng hai tay (`both`) tay phải dẫn, cạnh dưới `along` 0,25; `keyed` thì món đặt trước, không thì tay dẫn tới trước ngực */
function sceneBoth(high: string | undefined, keyed: boolean, both = true): Raw {
  const hold = {
    ...SHEET,
    edge: "bottom",
    along: 0.25,
    ...(high && { high }),
    ...(both && { both: true }),
  };
  return {
    duration: 2,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [
      {
        id: "nguoi",
        base: { torso: 9, head: [0, 0, -6] },
        world: {
          at: [250, 0, 506],
          yaw: 270,
          hands: [
            {
              t: 0,
              right: keyed ? { hold } : { to: "chest", offset: [30, 20, 0], point: "grip", hold },
            },
          ],
        },
      },
    ],
    ...(keyed && { items: [bang(0, [35, -5, 0])] }),
  };
}

/** Đầu cao khung cầm tay `side` dùng ở `t` (`GraspReport.high`), lựa chọn cạnh và `along` */
function graspOf(rt: SceneRuntime, side: -1 | 1, t = 0.5) {
  const g = actArm(NGUOI, sceneAt(rt, "nguoi", t, H, DIMS) as ActInput, side)!.report.hold?.grasp;
  return {
    high: g?.high?.map((v) => Math.round(v * 1e6) / 1e6 + 0),
    edge: g?.choice.edge,
    along: g?.choice.along,
  };
}

// Tay phụ của `both` không mang `high`: món chỉ theo tay dẫn (tay dẫn) hay mốc món (món đặt trước), tay phụ đặt lên món sau
// đó, nên đầu cao khai của tay dẫn đúng chỗ món mà không cần tay phụ; tay phụ đo `along` từ đầu của chính nó ở cả hai chế độ
describe("hai tay (`both`) khai `high`", () => {
  const HIGHS = [undefined, "left", "right"] as const;
  const sign = (high: (typeof HIGHS)[number]) => (high === "right" ? 1 : -1);

  it("tay dẫn: khung cầm tay dẫn theo `high`, món như khi cầm một tay cùng chỗ; tay phụ cùng chỗ trên món mọi `high`", () => {
    const spots = HIGHS.map((high) => {
      const rt = build(sceneBoth(high, false));
      expect(graspOf(rt, -1).high, high).toEqual([sign(high), 0, 0]);
      const one = drawnBoard(build(sceneBoth(high, false, false)), 0.5, false);
      const two = drawnBoard(rt, 0.5, false);
      expect(Math.hypot(...sub3(one.P, two.P)), high).toBeLessThan(1e-9);
      expect(Math.max(...one.R.map((v, i) => Math.abs(v - two.R[i]))), high).toBeLessThan(1e-9);
      const h = (sceneAt(rt, "nguoi", 0.5, H, DIMS) as ActInput).world!.hands!.right!.hold!;
      const x = holdHand(h, -1)!;
      return { lead: heldPoint(HELD["bang-gia"], x.hand.at as V3), other: x.both!.other.at };
    });
    // tay dẫn sang góc kia của cạnh dưới khi `high` đổi đầu; tay phụ (cạnh trên, `along` 0,25 từ đầu của nó) đứng yên
    expect(spots.map((s) => Math.sign(s.lead[0]))).toEqual([1, 1, -1]);
    for (const s of spots.slice(1)) expect(s.other).toEqual(spots[0].other);
  });

  it("món đặt trước: tay dẫn theo `high`, món ở mốc; tay phụ cùng cạnh, cùng `along`, cùng đầu cao mọi `high`", () => {
    const base = build(sceneBoth(undefined, true));
    const sup = graspOf(base, 1);
    expect(sup).toMatchObject({ edge: "top", along: 0.25 });
    const P = drawnBoard(base, 0.5, true).P;
    for (const high of HIGHS.slice(1)) {
      const rt = build(sceneBoth(high, true));
      expect(graspOf(rt, -1).high, high).toEqual([sign(high), 0, 0]);
      expect(graspOf(rt, 1), high).toEqual(sup);
      expect(Math.hypot(...sub3(drawnBoard(rt, 0.5, true).P, P)), high).toBeLessThan(1e-9);
    }
  });

  it("đổi chế độ hai chiều giữ món; `high` ở lại chỗ cầm tay dẫn, `both` không mang", () => {
    const raw = sceneBoth("right", false);
    const r = holdToItemLed(build(raw), raw, { id: "nguoi", side: "right", at: 0, rebuild: build });
    expect(r.max.item.pos).toBeLessThan(HOLD_MODE_POS);
    expect(r.max.item.angle).toBeLessThan(HOLD_MODE_ANGLE);
    const next = applyJsonPatch(raw, r.ops);
    const hold = (keysOf(next)[0].right as { hold: Record<string, unknown> }).hold;
    expect(hold.high).toBe("right");
    expect(hold.both).not.toHaveProperty("high");
    const back = holdToHandLed(build(next), next, {
      id: "nguoi",
      side: "right",
      at: 0,
      rebuild: build,
    });
    expect(back.max.item.pos).toBeLessThan(HOLD_MODE_POS);
    expect(back.max.item.angle).toBeLessThan(HOLD_MODE_ANGLE);
  });

  it("hai tay trên mốc món cùng khai `high` → đồ theo tay: tay kia thành `both` không `high`, đo từ đầu kia, món giữ chỗ", () => {
    const raw = sceneB();
    for (const k of keysOf(raw))
      for (const s of ["right", "left"])
        Object.assign((k[s] as { hold?: object } | undefined)?.hold ?? {}, {
          along: 0.3,
          high: "bottom",
        });
    const r = holdToHandLed(build(raw), raw, {
      id: "nguoi",
      side: "left",
      at: 1.5,
      rebuild: build,
    });
    expect(r.max.item.pos).toBeLessThan(HOLD_MODE_POS);
    expect(r.max.item.angle).toBeLessThan(HOLD_MODE_ANGLE);
    const hold = (keysOf(applyJsonPatch(raw, r.ops))[1].right as { hold: Record<string, unknown> })
      .hold;
    expect(hold.high).toBe("bottom");
    expect(hold.both).toMatchObject({ edge: "left", along: 0.7 });
    expect(hold.both).not.toHaveProperty("high");
    expect(r.notes.join(" ")).toMatch(/tay trái đo từ đầu kia của cạnh \(`along`\)/);
  });
});

// `sheet` và `platform` khai `high` (tay dẫn và món đặt trước): đầu cao khung cầm theo tên khai, `along` đo từ đầu ngược
describe("`high` của `sheet`, `platform`", () => {
  it("`sheet` cạnh dưới: `high` đổi đầu cao và góc cầm; `top` (vuông góc cạnh) như không khai, `sceneHoldProblems` báo", () => {
    for (const keyed of [false, true]) {
      const none = build(sceneBoth(undefined, keyed, false));
      const def = graspOf(none, -1).high!;
      for (const high of ["left", "right"]) {
        const rt = build(sceneBoth(high, keyed, false));
        const want = high === "right" ? 1 : -1;
        expect(graspOf(rt, -1).high, `${keyed} ${high}`).toEqual([want, 0, 0]);
        expect(sceneHoldProblems(rt)).toEqual([]);
        if (def[0] !== want && !keyed) {
          const a = drawnBoard(none, 0.5, false);
          const b = drawnBoard(rt, 0.5, false);
          expect(Math.hypot(...sub3(a.P, b.P))).toBeGreaterThan(HOLD_MODE_POS);
        }
      }
      const top = build(sceneBoth("top", keyed, false));
      expect(graspOf(top, -1).high).toEqual(def);
      expect(drawnBoard(top, 0.5, keyed).P).toEqual(drawnBoard(none, 0.5, keyed).P);
      expect(sceneHoldProblems(top)).toHaveLength(1);
    }
  });

  it("`platform` cạnh phải: `front` / `back` chọn đầu cao dọc cạnh; `left` (vuông góc) như không khai, báo", () => {
    for (const keyed of [false, true]) {
      const at = (high?: string) => build(sceneTray(high, keyed));
      const none = at();
      for (const high of ["front", "back"]) {
        const g = graspOf(at(high), -1);
        expect(g.edge).toBe("right");
        expect(g.high, `${keyed} ${high}`).toEqual([0, 0, high === "front" ? 1 : -1]);
        expect(sceneHoldProblems(at(high))).toEqual([]);
      }
      const left = at("left");
      expect(graspOf(left, -1)).toEqual(graspOf(none, -1));
      expect(sceneHoldProblems(left)).toHaveLength(1);
    }
  });
});

/** Khay đỡ dưới một tay phải, cạnh phải, `along` 0,25, `psi` 60; `keyed` thì món đặt trước */
function sceneTray(high: string | undefined, keyed: boolean): Raw {
  const hold = {
    item: "khay",
    group: "platform",
    edge: "right",
    along: 0.25,
    psi: 60,
    ...(high && { high }),
  };
  return {
    duration: 2,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [
      {
        id: "nguoi",
        base: { torso: 9, head: [0, 0, -6] },
        world: {
          at: [250, 0, 506],
          yaw: 270,
          hands: [
            {
              t: 0,
              right: keyed ? { hold } : { to: "chest", offset: [30, 20, 0], point: "grip", hold },
            },
          ],
        },
      },
    ],
    ...(keyed && {
      items: [
        {
          t: 0,
          cast: "nguoi",
          item: "khay",
          to: "chest",
          offset: [35, -5, 0],
          face: { axis: "top", toward: "up" },
        },
      ],
    }),
  };
}

// Chủ ý (docs/11-nhom-cam.md § Đổi chế độ lần cầm): món theo mốc đọc `elbow` là gợi ý, tay dẫn đọc là lệnh. Khuỷu khai xấu
// thì món theo mốc được nhường khuỷu để tránh lấn thân, chịu cổ tay chạm giới hạn; muốn cứng thì `elbowLock`
describe("món theo mốc: `elbow` khai xấu là gợi ý, `elbowLock` là lệnh", () => {
  const raw = sceneC();
  const r = holdToItemLed(build(raw), raw, { id: "nguoi", side: "right", at: 0, rebuild: build });
  const next = applyJsonPatch(raw, r.ops);
  const elbow = (keysOf(next)[0].right as { elbow: number[] }).elbow;
  const free = structuredClone(next);
  delete (keysOf(free)[0].right as Record<string, unknown>).elbowLock;

  it("có `elbowLock`: khuỷu đúng hướng khai, kể cả khi bắp tay lấn thân", () => {
    const arm = rightArm(build(next));
    expect(Math.abs(wrapDeg(arm.phi - arm.toward(elbow)))).toBeLessThan(0.5);
    expect(arm.body).toBeGreaterThan(HELD_ARM);
  });

  it("không `elbowLock`: rig được nhường khuỷu khỏi hướng khai để tay không lấn thân", () => {
    const arm = rightArm(build(free));
    expect(Math.abs(wrapDeg(arm.phi - arm.toward(elbow)))).toBeGreaterThan(10);
    expect(arm.body).toBeLessThan(HELD_ARM);
  });
});

describe("tay theo đồ → đồ theo tay", () => {
  const raw = sceneA();
  const rt = build(raw);
  const r = holdToHandLed(rt, raw, { id: "nguoi", side: "left", at: "@doi", rebuild: build });
  const next = applyJsonPatch(raw, r.ops);
  const rt2 = build(next);

  it("mốc tay ở từng mốc món, đích theo mốc thân, ý định bằng vectơ; mốc món của lần cầm bị xoá", () => {
    expect(r.scope.mode).toEqual({ before: "keyed", after: "hand" });
    const all = keysOf(next);
    expect(all.slice(0, 3)).toEqual(keysOf(raw).slice(0, 3));
    // tay trái chưa có mốc nào trước lần cầm: thả về hành động trước `HOLD_BLEND`
    expect(all[3]).toEqual({ t: 2.2, left: null });
    const hands = all.filter((k) => (k.left as { hold?: unknown } | null)?.hold);
    expect(hands.map((k) => k.t)).toEqual([2.5, "@doi", 4.2]);
    for (const k of hands) {
      const x = k.left as Record<string, unknown>;
      expect(x).toMatchObject({ to: "chest", point: "grip" });
      expect(x.offset).toHaveLength(3);
      expect(x.elbow).toHaveLength(3);
      const h = x.hold as Record<string, { axis: number[]; toward: number[] }>;
      expect(h.face.axis).toEqual([0, 0, 1]);
      expect(h.roll.toward).toHaveLength(3);
    }
    expect((hands[1].left as { ease?: string }).ease).toBe("auto");
    expect(next).not.toHaveProperty("items");
  });

  it("độ lệch báo đúng món như người 3D vẽ trước và sau", () => {
    for (const x of r.rows) {
      const a = drawnBoard(rt, x.t, false);
      const b = drawnBoard(rt2, x.t, false);
      const pos = Math.hypot(...sub3(a.P, b.P));
      expect(Math.abs(x.item!.pos - pos)).toBeLessThan(1e-6);
    }
    expect(r.rows.find((x) => x.t === 2.5)?.blending).toBe(true);
    expect(r.notes.join(" ")).toMatch(/lần cầm mở ở 2.5s/);
    expect(r.max.item.pos).toBeLessThan(0.5);
    expect(r.max.item.angle).toBeLessThan(2);
  });

  it("tay theo đích mang món, mốc giữa không khai `elbow`: khuỷu liền quanh từng mốc tay (`t₀ ± 1e-4` s)", () => {
    const bare = structuredClone(next);
    const mid = keysOf(bare).find((k) => k.t === "@doi")!.left as Record<string, unknown>;
    delete mid.elbow;
    const rt3 = build(bare);
    const J = (t: number) => actJoints(NGUOI, sceneAt(rt3, "nguoi", t, H, DIMS) as ActInput)!;
    type Js = ReturnType<typeof J>;
    const rel = (X: Js, k: ActJoint) => sub3(X[k], X.shoulderL);
    const d = (a: Js, b: Js, k: ActJoint) => Math.hypot(...sub3(rel(a, k), rel(b, k)));
    let w = 0;
    for (const t0 of [2.5, 3.2, 4.2]) {
      const [a, b, c] = [J(t0 - 1e-4), J(t0), J(t0 + 1e-4)];
      for (const [x, y] of [
        [a, b],
        [b, c],
      ])
        w = Math.max(w, d(x, y, "elbowL") - 1.5 * d(x, y, "wristL"));
    }
    expect(w).toBeLessThan(0.05);
  });
});

describe("hai tay trên mốc món → đồ theo tay", () => {
  const raw = sceneB();
  const rt = build(raw);
  const r = holdToHandLed(rt, raw, { id: "nguoi", side: "left", at: 1.5, rebuild: build });
  const next = applyJsonPatch(raw, r.ops);

  it("tay phải dẫn, tay trái thành `both` từ lúc nó cầm", () => {
    expect(r.scope).toMatchObject({
      lead: "right",
      partner: "left",
      mode: { before: "both", after: "hand" },
    });
    const hands = keysOf(next);
    expect(hands.map((k) => k.t)).toEqual([0, 1, 2, 2.5]);
    expect((hands[0].right as { hold: object }).hold).not.toHaveProperty("both");
    for (const k of hands.slice(1, 3))
      expect((k.right as { hold: { both: object } }).hold.both).toMatchObject({ edge: "left" });
    expect(hands[1]).not.toHaveProperty("left");
    expect(hands[3]).toEqual(keysOf(raw)[2]);
    expect(next).not.toHaveProperty("items");
    const runs = holdRuns(build(next), "nguoi");
    expect(runs.left.map((x) => [x.since, x.lead, x.mode])).toEqual([[1, "right", "hand"]]);
  });

  it("cầm thuận: cổ tay hai tay trong giới hạn, không báo chạm giới hạn; món ở mốc giữ chỗ trong 0,5 đơn vị rig và 1°", () => {
    for (const x of r.rows) expect(Object.values(x.clamped.before).flat()).toEqual([]);
    expect(r.notes.join(" ")).not.toMatch(/cổ tay chạm giới hạn/);
    expect(r.max.item.pos).toBeLessThan(0.5);
    expect(r.max.item.angle).toBeLessThan(1);
  });

  it(
    "cổ tay tay dẫn chạm giới hạn khi còn hai tay: độ lệch báo đúng món như vẽ, báo chạm giới hạn",
    { timeout: 30_000 },
    () => {
      // hai tay bắt chéo, bảng quay về máy: cổ tay phải vượt giới hạn
      const b = sceneB(
        "camera",
        [
          [35, -10, 0],
          [35, -10, 0],
        ],
        ["left", "right"],
      );
      const rb = build(b);
      const k = holdToHandLed(rb, b, { id: "nguoi", side: "right", at: 0, rebuild: build });
      const rb2 = build(applyJsonPatch(b, k.ops));
      const row = k.rows[0];
      expect(row.clamped.before.right!.length).toBeGreaterThan(0);
      const a = drawnBoard(rb, 0, true);
      const c = drawnBoard(rb2, 0, false);
      expect(Math.abs(row.item!.pos - Math.hypot(...sub3(a.P, c.P)))).toBeLessThan(1e-6);
      expect(k.notes.join(" ")).toMatch(/cổ tay chạm giới hạn trước phép đổi: tay phải \(`turn`/);
      expect(k.notes.join(" ")).toMatch(/sau phép đổi món theo bàn tay đã dừng ở giới hạn nên dời/);
    },
  );
});
