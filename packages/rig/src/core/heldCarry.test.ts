import { describe, expect, it } from "vitest";
import { actHeld, holdRoles, type ActInput } from "./act3";
import { body3 } from "./figure3d";
import { carryHits, heldLine, type HeldCarry, type HeldIssue } from "./heldAudit";
import {
  CARRY,
  carryFrame,
  carrySpecOf,
  cloudClearance,
  elbowSeat,
  type CarryCapsule,
  type CarryRef,
} from "./heldCarry";
import { gripPoint, heldPoint, parseHeldItem, type HeldItemSpec } from "./heldItem";
import { isCarryHold } from "./holdLink";
import { matVec, type V3 } from "./lens";
import { parseScene, resolveScene, sceneAt } from "./scene";
import { CharacterSchema } from "./schema";
import cocJson from "../../../../apps/studio/public/held/coc.json";
import tuiJson from "../../../../apps/studio/public/held/tui.json";
import tuiHieuJson from "./__fixtures__/held-v2/tui-hieu.json";

const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const TUI = spec(tuiJson);
const COC = spec(cocJson);
/** Lần treo `món@carry` của cảnh */
const carry = (item: string, h: object): CarryRef => ({
  grasp: { hold: { item, group: "carry", ...h } },
});
const close = (a: readonly number[], b: readonly number[], d = 6) =>
  a.forEach((x, i) => expect(x).toBeCloseTo(b[i], d));

describe("held/<món>.json: chỗ treo", () => {
  it("món mẫu `tui` nạp được; `carrySpecOf` lấy đỉnh quai từ `seats[on]`", () => {
    expect(TUI.seats).toEqual({ elbow: "quai", shoulder: "quai" });
    expect(carrySpecOf(TUI, carry("tui", { on: "elbow" }))).toEqual({ on: "elbow", at: "quai" });
    expect(carrySpecOf(COC, { grasp: { hold: { item: "coc", group: "handle" } } })).toBeUndefined();
    expect(carrySpecOf(COC, {})).toBeUndefined();
  });
});

describe("elbowSeat, carryFrame", () => {
  it("chỗ gập: góc khuỷu, độ ngóc cẳng tay, điểm trên mặt trong một bán kính tay", () => {
    // cánh tay trên dọc xuống, cẳng tay ngang ra trước: chữ L
    const e = elbowSeat([0, 3, 0], [0, 2, 0], [0, 2, 1], 0.1);
    expect(e.bend).toBeCloseTo(90);
    expect(e.rise).toBeCloseTo(0);
    close(e.pivot, [0, 2 + 0.1 / Math.SQRT2, 0.1 / Math.SQRT2]);
    close(e.bar, [0, 0, 1]);
    // cẳng tay chúc xuống
    expect(elbowSeat([0, 3, 0], [0, 2, 0], [0, 1.5, 0.5], 0.1).rise).toBeCloseTo(-45);
  });

  const grip = carrySpecOf(TUI, carry("tui", { on: "elbow" }))!;
  const top = heldPoint(TUI, "quai");

  it("không gì cản: đỉnh quai ở chỗ treo, y của món lên, mặt trước theo hướng ngang của thanh quai", () => {
    const f = carryFrame({
      item: TUI,
      grip,
      pivot: [1, 2, 3],
      bar: [0.6, 0.8, 0],
      away: [1, 0, 0],
      u: 0.01,
      body: [],
    });
    expect(f.swing).toBe(0);
    close(gripPoint(f.G, top as V3), [1, 2, 3]);
    close(matVec(f.G.R, [0, 1, 0]), [0, 1, 0]);
    close(matVec(f.G.R, [0, 0, 1]), [1, 0, 0]);
    // `yaw` quay thân món quanh phương đứng
    const y = carryFrame({
      item: TUI,
      grip: { ...grip, yaw: 90 },
      pivot: [0, 0, 0],
      bar: [1, 0, 0],
      away: [1, 0, 0],
      u: 0.01,
      body: [],
    });
    close(matVec(y.G.R, [0, 0, 1]), [0, 0, -1]);
  });

  it("thân món lồng vào thân: đẩy ra quanh chỗ treo vừa hết lồng; phía ngoài chật thì kẹp giữa", () => {
    // thân: nang dọc ngay dưới chỗ treo, phía −x
    const torso: CarryCapsule = { a: [-0.2, 0, 0], b: [-0.2, 2, 0], r: 0.22, part: "torso" };
    const base = {
      item: TUI,
      grip,
      pivot: [0, 2, 0] as V3,
      bar: [0, 0, 1] as V3,
      away: [1, 0, 0] as V3,
      u: 0.01,
    };
    const f = carryFrame({ ...base, body: [torso] });
    expect(f.swing).toBeGreaterThan(0);
    expect(f.gap).toBeGreaterThanOrEqual(-1e-3);
    expect(f.gap).toBeLessThan(0.2);
    // lùi một chút là lồng: góc nhỏ nhất
    const less = carryFrame({ ...base, body: [torso], outer: [] });
    expect(less.swing).toBeCloseTo(f.swing, 6);
    // cánh tay sát phía ngoài: hai bên lồng bằng nhau
    const arm: CarryCapsule = { a: [0.12, 2, 0], b: [0.12, 0.8, 0], r: 0.05, part: "upperArmR" };
    const s = carryFrame({ ...base, body: [torso], outer: [arm] });
    expect(s.swing).toBeLessThan(f.swing);
    expect(s.gap).toBeLessThan(0);
  });

  it("đám điểm: khe tới hình va chạm, điểm trong món là âm", () => {
    const G = carryFrame({
      item: TUI,
      grip,
      pivot: [0, 0.74, 0],
      bar: [0, 0, 1],
      away: [1, 0, 0],
      u: 0.01,
      body: [],
    }).G;
    // thân hộp 30 × 26 × 10 ở y 0–26 (đơn vị rig), tâm ở gốc
    expect(cloudClearance(TUI.shape!, G, [0, 0.13, 0])).toBeLessThan(-4);
    expect(cloudClearance(TUI.shape!, G, [0, 0.13, 0.1, 0.5, 0.13, 0])).toBeCloseTo(5, 4);
  });
});

describe("carryHits", () => {
  const S: HeldCarry = {
    id: "a",
    hand: "R",
    item: "tui",
    hold: "tui@carry",
    on: "elbow",
    key: "k",
    at: [0, 0, 0],
    seat: 0,
    bend: 60,
    rise: 30,
    body: { gap: 0.5, part: "torso" },
    swing: 5,
    s: 1,
  };
  const issue = (x: HeldCarry, rule: "seat" | "body"): HeldIssue => ({
    id: "a",
    hand: "R",
    item: "tui",
    rule,
    t: 1,
    worst: 1,
    sample: x,
    declared: { pose: "rest", off: 0 },
    runs: [[0.5, 1.5]],
    clips: [],
  });

  it("đúng chỗ thì im; khuỷu mở, cẳng tay chúc, quai rời chỗ treo là `seat`; lồng quá phần cho lấn là `body`", () => {
    expect(carryHits(S)).toEqual([]);
    expect(carryHits({ ...S, bend: CARRY.bend + 5 }).map((h) => h.rule)).toEqual(["seat"]);
    expect(carryHits({ ...S, rise: CARRY.rise - 5 }).map((h) => h.rule)).toEqual(["seat"]);
    expect(carryHits({ ...S, seat: CARRY.seat + 1 }).map((h) => h.rule)).toEqual(["seat"]);
    expect(carryHits({ ...S, body: { gap: -3, part: "thighR" } }).map((h) => h.rule)).toEqual([
      "body",
    ]);
    expect(carryHits({ ...S, body: { gap: -3, part: "upperArmR", allow: 2 } })).toEqual([]);
    expect(carryHits({ ...S, body: { gap: -3, part: "thighR" } }, { body: 4 })).toEqual([]);
  });

  it("dòng báo nêu chỗ sai và cách sửa", () => {
    expect(heldLine(issue({ ...S, rise: -40 }, "seat"))).toMatch(
      /quai không nằm trên chỗ treo — `a` tay phải treo tui \(`tui@carry`, khuỷu\): cẳng tay chúc 40° .* · giây 0\.50–1\.50\. Lúc ấy: chỗ cầm tui@carry \(khuỷu\)/,
    );
    expect(
      heldLine(issue({ ...S, on: "shoulder", body: { gap: -4, part: "upperArmR" } }, "body")),
    ).toMatch(
      /món treo lồng vào người — .*thân món lồng 4\.0 vào `upperArmR`; dang tay ra khỏi món/,
    );
  });
});

describe("treo: `món@carry` đọc `seats` của món", () => {
  const HIEU = spec(tuiHieuJson);
  const hieu = (h: object): CarryRef => carry("tui-hieu", h);

  it("`carrySpecOf`: `at` là `seats[on]`, `yaw` của cảnh, `touch` của món cộng của cảnh", () => {
    expect(carrySpecOf(HIEU, hieu({ on: "elbow" }))).toEqual({
      on: "elbow",
      at: "treoKhuyu",
      touch: HIEU.touch,
    });
    expect(carrySpecOf(HIEU, hieu({ on: "shoulder", yaw: 20, touch: ["self.head"] }))).toEqual({
      on: "shoulder",
      at: "quai",
      yaw: 20,
      touch: [...HIEU.touch!, "self.head"],
    });
    expect(carrySpecOf(HIEU, hieu({ group: "palmBox" }))).toBeUndefined();
    expect(isCarryHold(hieu({ on: "elbow" }))).toBe(true);
    expect(isCarryHold(hieu({ group: "palmBox" }))).toBe(false);
    expect(isCarryHold({})).toBe(false);
  });

  it("`carrySpecOf`: thiếu `on`, món không có `seats[on]` là lỗi có tên", () => {
    expect(() => carrySpecOf(HIEU, hieu({}))).toThrow(/`tui-hieu@carry`: thiếu `on`/);
    const elbow = spec({ ...tuiHieuJson, seats: { elbow: "treoKhuyu" } });
    expect(() => carrySpecOf(elbow, hieu({ on: "shoulder" }))).toThrow(
      /không có chỗ treo `seats.shoulder`/,
    );
  });

  describe("scene", () => {
    const C = CharacterSchema.parse({ head: { form: "human" }, palette: { clad: true } });
    const runtime = (hands: unknown[], item: HeldItemSpec = HIEU) => {
      const items = { "tui-hieu": item, coc: COC };
      const sc = parseScene({
        name: "x",
        lens: { eye: [0, -250, -1400], yaw: 0, pitch: 0, f: 800 },
        cast: [{ id: "a", world: { at: [0, 0, 0], yaw: 90, hands }, tracks: [] }],
      });
      if (!sc.success) throw new Error(sc.error.message);
      return resolveScene(sc.data, {}, {}, {}, { a: 1 }, { a: body3(C) }, items);
    };
    const hold = (h: object) => ({ hold: { item: "tui-hieu", group: "carry", ...h } });

    it("tay treo không có vai trò, không ý định; tay kia cầm cốc như thường", () => {
      const rt = runtime([
        {
          t: 0,
          right: hold({ on: "elbow" }),
          left: { at: [40, -250, -40], hold: "coc@cylinder" },
        },
      ]);
      const sp = sceneAt(rt, "a", 0.5, 1, body3(C)) as ActInput;
      const roles = holdRoles(sp.world!.hands, -1);
      expect(roles[-1]).toBeUndefined();
      expect(roles[1]).toMatchObject({ role: "lead", hold: { item: "coc" } });
      expect(sp.world!.hands!.near!.hold).toMatchObject({ item: "tui-hieu", grip: "@carry////" });
      expect(sp.world!.hands!.near!.aim).toBeUndefined();
      const held = actHeld(C, sp);
      expect(held.R).toBeUndefined();
      expect(held.L).toBeDefined();
    });

    it("thiếu `on`, `seats[on]` không có: lỗi `choice` có tên", () => {
      expect(() => runtime([{ t: 0, right: hold({}) }])).toThrow(/lỗi `choice`: .*thiếu `on`/);
      expect(() => runtime([{ t: 0, right: { hold: "tui-hieu@carry" } }])).toThrow(/thiếu `on`/);
      const elbow = spec({ ...tuiHieuJson, seats: { elbow: "treoKhuyu" } });
      expect(() => runtime([{ t: 0, right: hold({ on: "shoulder" }) }], elbow)).toThrow(
        /lỗi `choice`: .*không có chỗ treo `seats.shoulder`/,
      );
      const bare = spec({ ...tuiHieuJson, seats: undefined });
      expect(() => runtime([{ t: 0, right: hold({ on: "elbow" }) }], bare)).toThrow(
        /lỗi `group`: .*nhóm `carry`/,
      );
    });

    it("`point: item:` trên món treo là lỗi", () => {
      expect(() =>
        runtime([
          { t: 0, right: hold({ on: "elbow" }) },
          { t: 1, right: { at: [0, -200, 0], point: "item:quai" } },
        ]),
      ).toThrow(/cần món cầm trong bàn tay — `tui-hieu@carry` treo trên tay \(`on: elbow`\)/);
    });
  });
});
