import { describe, expect, it } from "vitest";
import { actArm, actHeld, actJoints, type ActJoint } from "./act3";
import type { ActInput } from "./arm3";
import { body3 } from "./figure3d";
import { evalPhi, phiOf, phiToward } from "./graspArm";
import { HELD_ARM } from "./heldAudit";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";
import {
  applyJsonPatch,
  holdToHandLed,
  holdToItemLed,
  HOLD_MODE_ANGLE,
  HOLD_MODE_POS,
  type HoldModeResult,
  type JsonPatchOp,
} from "./holdMode";
import { add3, matVec, scale3, sub3, type M3 } from "./lens";
import {
  holdRuns,
  itemAt,
  itemCentre,
  parseScene,
  resolveScene,
  sceneAt,
  type SceneRuntime,
} from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";

// Đổi chế độ lần cầm (docs/11-nhom-cam.md § Đổi chế độ lần cầm)

const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const HELD = { "bang-gia": spec(bangGia), "dien-thoai": spec(dienThoai) };
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
 * Cảnh: tay phải dẫn điện thoại áp tai như người thật — loa ở tai, máy dọc má về miệng, màn vào má; khuỷu khai ra trước, ra
 * ngoài, hơi xuống (người chibi tai cao hơn vai nên khuỷu chỉ xuống tới ngang vai); cổ tay trong giới hạn, tay không lấn thân
 */
const sceneEar = (): Raw => ({
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
              to: "ear",
              offset: [4, 2, 2],
              point: "item:speaker",
              elbow: [0.5, 0, 0.8],
              hold: {
                item: "dien-thoai",
                group: "palmBox",
                along: 0.1,
                tilt: 5,
                face: { axis: "screen", toward: { mark: "head" } },
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

/** Tay phải như vẽ ở `t`: `φ` khuỷu, góc cổ tay, khớp kẹp, lấn thân (`bodyRatio`, như `E(φ)` đo) và `φ` của `elbow` khai */
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
  const raw = sceneEar();
  const rt = build(raw);
  const r = holdToItemLed(rt, raw, { id: "nguoi", side: "right", at: 0, rebuild: build });
  const next = applyJsonPatch(raw, r.ops);
  const right = keysOf(next)[0].right as Record<string, unknown>;
  const angle = (A: M3, B: M3) =>
    Math.acos(Math.min(1, (A.reduce((n, x, i) => n + x * B[i], 0) - 1) / 2)) / (Math.PI / 180);

  it("mốc tay khoá khuỷu vào hướng đang vẽ; món ở mốc lệch dưới ngưỡng", () => {
    expect(r.scope.mode).toEqual({ before: "hand", after: "keyed" });
    expect(right).toMatchObject({ elbowLock: true, hold: { item: "dien-thoai" } });
    expect(right.elbow).not.toEqual([0.5, 0, 0.8]);
    // ý định một trục (`face`): bàn tay lăn quanh trục món cho cổ tay thoải mái trên cẳng tay của khuỷu khai, nên cổ tay
    // trong giới hạn, không nhường
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

  it("dáng áp tai tự nhiên: cổ tay trong giới hạn, tay không lấn thân, cả đồ theo tay, khoá và bỏ khoá", () => {
    const free = structuredClone(next);
    delete (keysOf(free)[0].right as Record<string, unknown>).elbowLock;
    for (const x of [rt, build(next), build(free)]) {
      const arm = rightArm(x);
      expect(arm.clamped).toEqual([]);
      expect(arm.body).toBeLessThan(0.05);
      // gập, lệch cổ tay xa giới hạn (`AIM_BEND` −60, `AIM_DEV` −30)
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
    expect(last).toMatchObject({ to: "ear", point: "item:speaker", elbowLock: true });
    expect(last.elbow).toEqual(right.elbow);
  });
});

// Chủ ý (docs/11-nhom-cam.md § Đổi chế độ lần cầm): món theo mốc đọc `elbow` là gợi ý, tay dẫn đọc là lệnh. Khuỷu khai xấu
// thì món theo mốc được nhường khuỷu để tránh lấn thân, chịu cổ tay kẹp; muốn cứng thì `elbowLock`
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

  it("cầm thuận: cổ tay hai tay trong giới hạn, không báo kẹp; món ở mốc giữ chỗ trong 0,5 đơn vị rig và 1°", () => {
    for (const x of r.rows) expect(Object.values(x.clamped.before).flat()).toEqual([]);
    expect(r.notes.join(" ")).not.toMatch(/cổ tay kẹp/);
    expect(r.max.item.pos).toBeLessThan(0.5);
    expect(r.max.item.angle).toBeLessThan(1);
  });

  it(
    "cổ tay tay dẫn kẹp khi còn hai tay: độ lệch báo đúng món như vẽ, báo kẹp",
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
      expect(k.notes.join(" ")).toMatch(/cổ tay kẹp ở giới hạn trước phép đổi: tay phải \(`turn`/);
      expect(k.notes.join(" ")).toMatch(/sau phép đổi món theo bàn tay đã kẹp nên dời/);
    },
  );
});
