import {
  body3,
  defaultCharacter,
  holdRuns,
  parseAction,
  parseHeldItem,
  parseScene,
  resolveScene,
  type HandSide,
  type HeldItemSpec,
  type SceneRuntime,
} from "@stickman3d/rig/core";
import { describe, expect, it } from "vitest";
import bangGia from "../../../packages/rig/src/core/__fixtures__/held-v2/bang-gia.json";
import cocJson from "../../studio/public/held/coc.json";
import { drawnHand, drawnItem } from "./drawn";
import {
  deleteKey,
  editKey,
  handShape,
  handValueAt,
  holdPickOf,
  insertHandKey,
  insertItemKey,
  itemValueAt,
  keyTime,
  moveKey,
  retime,
  setEase,
  setHold,
  touch,
  type Json,
} from "./keys";

const MARKS = { tra: 3.4, nedan: 3.229, loi: 0.8 };

describe("retime: dời trường thời gian giữ mốc tên", () => {
  it("`@tra` → `@tra+0.2`, `@tra-0.2`, về đúng mốc là `@tra`", () => {
    expect(retime("@tra", 3.6, MARKS)).toBe("@tra+0.2");
    expect(retime("@tra+0.6", 3.2, MARKS)).toBe("@tra-0.2");
    expect(retime("@tra+0.6", 3.4, MARKS)).toBe("@tra");
    expect(retime("@tra", 3.4 + 1 / 30, MARKS)).toBe("@tra+0.033");
  });
  it("số giữ là số, làm tròn 0,001 s, không âm", () => {
    expect(retime(2, 2.25, MARKS)).toBe(2.25);
    expect(retime(1, 1.23456, MARKS)).toBe(1.235);
    expect(retime(1, -0.4, MARKS)).toBe(0);
  });
  it("Alt bắt vào mốc tên gần nhất, kể cả từ số", () => {
    expect(retime(2, 3.35, MARKS, true)).toBe("@tra");
    expect(retime("@tra+0.6", 3.25, MARKS, true)).toBe("@nedan");
    expect(retime("@tra", 1, MARKS, true)).toBe("@loi");
    expect(retime(2, 2.5, {}, true)).toBe(2.5);
  });
});

/** Cảnh thô có trường lạ (`hand`, `ghi`) và mốc tên */
function raw(): Json {
  return {
    name: "x",
    marks: { tra: 3.4 },
    cast: [
      {
        id: "a",
        ghi: "trường lạ của người",
        world: {
          at: [0, 0, 0],
          hands: [
            {
              t: 0,
              right: { to: "belly", offset: [12, 18, 0], point: "palm", hand: { palm: "in" } },
              left: { at: [1, 2, 3] },
            },
            { t: "@tra", right: { at: [4, 5, 6], point: "grip", ghi: 1 }, snap: true },
            { t: "@tra+0.6", left: { at: [7, 8, 9] } },
          ],
        },
      },
    ],
    items: [
      { t: 0, cast: "a", item: "coc", at: [0, 0, 0] },
      { t: 2, cast: "a", item: "coc", at: [1, 0, 0], ease: "linear" },
    ],
  };
}

const hands = (r: Json) =>
  ((r.cast as Json[])[0].world as { hands: Json[] }).hands as Record<string, unknown>[];

describe("sửa mốc trên JSON thô", () => {
  it("dời mốc tên một tay: dòng chỉ nhắc tay ấy đổi `t`, giữ trường lạ", () => {
    const a = raw();
    const { raw: b, key } = moveKey(a, { kind: "hand", id: "a", side: "left", index: 2 }, 3.6);
    expect(hands(b)[2]).toEqual({ t: "@tra+0.2", left: { at: [7, 8, 9] } });
    expect(key).toEqual({ kind: "hand", id: "a", side: "left", index: 2 });
    expect(hands(b)[0].right).toEqual(hands(a)[0].right);
    expect((b.cast as Json[])[0].ghi).toBe("trường lạ của người");
    expect(hands(a)[2].t).toBe("@tra+0.6");
  });

  it("dời một tay của dòng nhắc hai tay: tách ra dòng mới, xếp theo giây, `snap` chép theo", () => {
    const { raw: b, key } = moveKey(raw(), { kind: "hand", id: "a", side: "left", index: 0 }, 3.5);
    const h = hands(b);
    expect(h.map((k) => k.t)).toEqual([0, "@tra", 3.5, "@tra+0.6"]);
    expect(h[0]).toEqual({ t: 0, right: hands(raw())[0].right });
    expect(h[2]).toEqual({ t: 3.5, left: { at: [1, 2, 3] } });
    expect(key.kind === "hand" && key.index).toBe(2);
    const { raw: c } = moveKey(raw(), { kind: "hand", id: "a", side: "right", index: 1 }, 1);
    expect(hands(c)[1]).toEqual({
      t: "@tra-2.4",
      right: { at: [4, 5, 6], point: "grip", ghi: 1 },
      snap: true,
    });
    const { raw: d } = moveKey(raw(), { kind: "hand", id: "a", side: "right", index: 1 }, 3.9);
    expect(hands(d).map((k) => k.t)).toEqual([0, "@tra+0.5", "@tra+0.6"]);
    expect(hands(d)[1]).toMatchObject({ snap: true, right: { ghi: 1 } });
  });

  it("dời qua mốc khác: đổi chỗ trong mảng; Alt bắt vào mốc tên", () => {
    const { raw: b, key } = moveKey(raw(), { kind: "hand", id: "a", side: "left", index: 2 }, 0.5);
    expect(hands(b).map((k) => k.t)).toEqual([0, "@tra-2.9", "@tra"]);
    expect(key.kind === "hand" && key.index).toBe(1);
    const { raw: c } = moveKey(raw(), { kind: "hand", id: "a", side: "left", index: 2 }, 3.3, true);
    expect(hands(c)).toHaveLength(2);
    expect(hands(c)[1]).toEqual({
      t: "@tra",
      right: { at: [4, 5, 6], point: "grip", ghi: 1 },
      snap: true,
      left: { at: [7, 8, 9] },
    });
    expect(() => moveKey(raw(), { kind: "hand", id: "a", side: "right", index: 1 }, 0)).toThrow(
      /đã có mốc/,
    );
  });

  it("thêm mốc: dòng mới theo giây, hay vào dòng sẵn ở đúng giây; trùng mốc của tay thì lỗi", () => {
    const { raw: b, key } = insertHandKey(raw(), "a", "left", 1.5, { at: [0, 0, 0] });
    expect(hands(b)[1]).toEqual({ t: 1.5, left: { at: [0, 0, 0] } });
    expect(key).toEqual({ kind: "hand", id: "a", side: "left", index: 1 });
    const { raw: c, key: k2 } = insertHandKey(raw(), "a", "left", 3.4, null);
    expect(hands(c)).toHaveLength(3);
    expect(hands(c)[1]).toMatchObject({ t: "@tra", left: null, snap: true });
    expect(k2.kind === "hand" && k2.index).toBe(1);
    expect(() => insertHandKey(raw(), "a", "right", 3.4, null)).toThrow(/đã có mốc/);
    const { raw: d } = insertHandKey(raw(), "a", "right", 3.4 + 0.25, null);
    expect(hands(d)[2].t).toBe(3.65);
  });

  it("xoá mốc: bỏ tay khỏi dòng, dòng rỗng thì bỏ dòng; mốc tay cuối cùng thì lỗi", () => {
    const b = deleteKey(raw(), { kind: "hand", id: "a", side: "left", index: 0 });
    expect(hands(b)[0]).toEqual({ t: 0, right: hands(raw())[0].right });
    const c = deleteKey(raw(), { kind: "hand", id: "a", side: "left", index: 2 });
    expect(hands(c).map((k) => k.t)).toEqual([0, "@tra"]);
    let d = raw();
    hands(d).splice(1);
    d = deleteKey(d, { kind: "hand", id: "a", side: "left", index: 0 });
    expect(() => deleteKey(d, { kind: "hand", id: "a", side: "right", index: 0 })).toThrow(
      /cuối cùng/,
    );
    const e = deleteKey(raw(), { kind: "item", index: 0 });
    expect(e.items).toEqual([raw().items && (raw().items as Json[])[1]]);
    expect(deleteKey(e, { kind: "item", index: 0 }).items).toEqual([]);
  });

  it('`ease` và `bezier`: `bezier` chỉ đi với `ease: "bezier"`, trường khác còn nguyên', () => {
    const k = { kind: "hand", id: "a", side: "right", index: 1 } as const;
    let b = editKey(raw(), k, (m) => setEase(m!, "bezier"));
    expect(hands(b)[1].right).toEqual({
      at: [4, 5, 6],
      point: "grip",
      ghi: 1,
      ease: "bezier",
      bezier: [0.42, 0, 0.58, 1],
    });
    b = editKey(b, k, (m) => setEase(m!, "bezier", [0.1, 0.2, 0.3, 0.9]));
    expect(hands(b)[1].right).toMatchObject({ bezier: [0.1, 0.2, 0.3, 0.9] });
    b = editKey(b, k, (m) => setEase(m!, "auto"));
    expect(hands(b)[1].right).toEqual({ at: [4, 5, 6], point: "grip", ghi: 1, ease: "auto" });
    b = editKey(b, k, (m) => setEase(m!, undefined));
    expect(hands(b)[1].right).toEqual(hands(raw())[1].right);
    const c = editKey(raw(), { kind: "item", index: 1 }, (m) => setEase(m!, "spring"));
    expect((c.items as Json[])[1]).toEqual({
      t: 2,
      cast: "a",
      item: "coc",
      at: [1, 0, 0],
      ease: "spring",
    });
  });

  it("mốc món: dời, thêm theo giây", () => {
    const { raw: b, key } = moveKey(raw(), { kind: "item", index: 0 }, 3.5);
    expect((b.items as Json[]).map((k) => k.t)).toEqual([2, 3.5]);
    expect(key).toEqual({ kind: "item", index: 1 });
    expect(keyTime(b, key)).toBeCloseTo(3.5);
    const { raw: c } = insertItemKey(raw(), 1, { cast: "a", item: "coc", at: [2, 0, 0] });
    expect((c.items as Json[])[1]).toEqual({ t: 1, cast: "a", item: "coc", at: [2, 0, 0] });
    expect(() => moveKey(raw(), { kind: "item", index: 0 }, 2)).toThrow(/đã có mốc/);
    expect(() => insertItemKey(raw(), 2, { cast: "a", item: "coc" })).toThrow(/đã có mốc/);
  });
});

// mốc mới lấy đúng thứ đang vẽ: lần cầm giữ nguyên, bàn tay và món ở giây ấy không nhảy
const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const HELD = { coc: spec(cocJson), "bang-gia": spec(bangGia) };
const still = parseAction({
  name: "still",
  duration: 1,
  end: "hold",
  authoredAt: "side",
  keys: [{ t: 0, pose: {} }],
}).data!;
const c = defaultCharacter();
c.palette.clad = true;
const SHEET = { item: "bang-gia", group: "sheet", edge: "right", along: 0.33, thumb: "front" };

function scene(): Json {
  return {
    name: "x",
    duration: 4,
    marks: { m: 1.5 },
    lens: { eye: [0, -250, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 },
    cast: [
      {
        id: "a",
        character: "a.json",
        tracks: [{ clips: [{ action: "still", start: 0 }] }],
        world: {
          at: [0, 0, 0],
          yaw: 90,
          hands: [
            {
              t: 0,
              right: { at: [36, -250, -40], point: "grip", elbow: [-0.6, 1, -0.3] },
              left: { at: [40, -250, -40], point: "grip", hold: "coc@cylinder" },
            },
            { t: 1, left: { at: [50, -270, -30], point: "grip", ease: "auto" } },
            { t: 1.2, right: { at: [30, -260, -50], point: "grip", elbow: [-0.3, 1, 0.4] } },
            { t: "@m", left: { at: [45, -280, -20], point: "grip", ease: "auto" } },
            { t: 2, right: { hold: { ...SHEET, along: 0.3 } } },
            { t: 3, right: { hold: { ...SHEET, along: 0.6 } } },
            { t: 3.5, right: { hold: null } },
          ],
        },
      },
    ],
    items: [
      {
        t: 2,
        cast: "a",
        item: "bang-gia",
        to: "chest",
        offset: [30, -3, 0],
        face: { axis: "front", toward: "holderFace" },
        roll: { axis: "top", toward: "up" },
      },
      {
        t: 3,
        cast: "a",
        item: "bang-gia",
        to: "chest",
        offset: [38, -14, 8],
        face: { axis: "front", toward: "holderFace" },
        roll: { axis: "top", toward: "up" },
      },
    ],
  };
}

function runtime(j: Json): SceneRuntime {
  const p = parseScene(j);
  if (!p.success) throw new Error(p.error.message);
  const rt = resolveScene(p.data, { still }, {}, {}, { a: 1 }, { a: body3(c) }, HELD);
  rt.chars = { a: c };
  return rt;
}

const runsOf = (rt: SceneRuntime, side: HandSide) =>
  holdRuns(rt, "a")[side].map(({ since, until, item, group, variant, mode }) => ({
    since,
    until,
    item,
    group,
    variant,
    mode,
  }));
const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe("mốc mới ở giây đang xem (＋)", () => {
  it(
    "chèn giữa lần cầm: lần cầm giữ nguyên, tâm nắm ở giây ấy không nhảy",
    { timeout: 60_000 },
    () => {
      const j = scene();
      const rt = runtime(j);
      const cases: [HandSide, number, string][] = [
        ["left", 1.25, "hand"],
        ["right", 2.5, "keyed"],
        ["right", 0.6, "free"],
      ];
      for (const [side, t, mode] of cases) {
        const d = drawnHand(rt, "a", side, t)!;
        expect(d.mode).toBe(mode);
        const { value, notes } = handValueAt(j, "a", side, t, d);
        expect(value).toMatchObject({ ease: "auto" });
        if (mode === "keyed")
          expect(value).toEqual({ hold: { ...SHEET, along: 0.45 }, ease: "auto" });
        else expect(value && "hold" in value).toBe(false);
        const { raw: next } = insertHandKey(j, "a", side, t, value);
        const rt2 = runtime(next);
        expect(runsOf(rt2, side), `${side} ${t}`).toEqual(runsOf(rt, side));
        expect(holdRuns(rt2, "a")[side].reduce((n, r) => n + r.handKeys.length, 0)).toBe(
          holdRuns(rt, "a")[side].reduce((n, r) => n + r.handKeys.length, 0) +
            (mode === "free" ? 0 : 1),
        );
        const d2 = drawnHand(rt2, "a", side, t)!;
        expect(dist(d2.grip, d.grip), `${side} ${t} ${notes}`).toBeLessThan(0.5);
      }
    },
  );

  it("mốc món ở giây đang xem: món ở giây ấy không nhảy", { timeout: 60_000 }, () => {
    const j = scene();
    const rt = runtime(j);
    const p = drawnItem(rt, "a", "right", "bang-gia", 2.5)!;
    const { raw: next } = insertItemKey(j, 2.5, itemValueAt("a", "bang-gia", p.at, p.face, p.roll));
    expect((next.items as Json[]).map((k) => k.t)).toEqual([2, 2.5, 3]);
    const rt2 = runtime(next);
    expect(runsOf(rt2, "right")).toEqual(runsOf(rt, "right"));
    const q = drawnItem(rt2, "a", "right", "bang-gia", 2.5)!;
    expect(dist(q.at, p.at)).toBeLessThan(0.5);
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(q.face, p.face)).toBeGreaterThan(0.999);
    expect(dot(q.roll, p.roll)).toBeGreaterThan(0.999);
  });
});

describe("hold của thẻ mốc", () => {
  it("đọc và ghi `hold`: dạng chuỗi giữ chuỗi, dạng object giữ trường khác", () => {
    expect(holdPickOf("coc@cylinder/wrap")).toEqual({
      item: "coc",
      group: "cylinder",
      variant: "wrap",
    });
    expect(holdPickOf({ ...SHEET, variant: "pinch", face: {} })).toEqual({
      item: "bang-gia",
      group: "sheet",
      variant: "pinch",
    });
    const a: Json = { at: [1, 2, 3], hold: "coc@cylinder" };
    setHold(a, { item: "coc", group: "cylinder", variant: "flat" });
    expect(a.hold).toBe("coc@cylinder/flat");
    const b: Json = { hold: { ...SHEET, variant: "pinch", lạ: 1 } };
    setHold(b, { item: "bang-gia", group: "sheet" });
    expect(b.hold).toEqual({ ...SHEET, lạ: 1 });
    setHold(b, null);
    expect(b.hold).toBeNull();
    setHold(b, undefined);
    expect(b).toEqual({});
    const c: Json = { ease: "linear" };
    touch(c);
    expect(c.ease).toBe("linear");
    touch(b);
    expect(b.ease).toBe("auto");
    expect([null, { hold: "coc@cylinder" }, { hold: null, to: "hip" }].map(handShape)).toEqual([
      "null",
      "ring",
      "dot",
    ]);
  });
});
