import {
  authoredFrom,
  graspFrame,
  handDims,
  itemGeom,
  parseHeldItem,
  type AuthoredGrasp,
  type GraspChoice,
  type GraspHand,
  type HeldItemSpec,
} from "@stickman3d/rig/core";
import { describe, expect, it } from "vitest";
import bangGia from "../../../packages/rig/src/core/__fixtures__/held-v2/bang-gia.json";
import dua from "../../../packages/rig/src/core/__fixtures__/held-v2/dua.json";
import type { Json } from "./keys";
import {
  copyAuthored,
  nameProblem,
  runVariant,
  setRunVariant,
  styleUses,
  type RunRef,
} from "./named";

const item = (json: unknown): HeldItemSpec => {
  const r = parseHeldItem(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

describe("tên kiểu cầm mới", () => {
  const spec = item({ ...bangGia });
  it("`[a-z0-9-]+`, không trùng biến thể gốc, không trùng khoá của món", () => {
    expect(nameProblem("kep-mep-2", "sheet", spec)).toBeUndefined();
    expect(nameProblem("", "sheet", spec)).toMatch(/nhập tên/);
    expect(nameProblem("Kep", "sheet", spec)).toMatch(/a–z/);
    expect(nameProblem("kep mep", "sheet", spec)).toMatch(/a–z/);
    expect(nameProblem("kep/mep", "sheet", spec)).toMatch(/a–z/);
    expect(nameProblem("flat", "sheet", spec)).toMatch(/biến thể gốc/);
    const au = {
      item: { p: [0, 0, 0], q: [0, 0, 0, 1] },
      anchor: "pinch",
      fingers: Array(10).fill(0),
    };
    const named = item({ ...bangGia, authored: { sheet: { "kep-mep": { base: "flat", ...au } } } });
    expect(nameProblem("kep-mep", "sheet", named)).toMatch(/đã có/);
    expect(nameProblem("kep-mep", "card", named)).toBeUndefined();
  });
});

/** Cảnh thô: mốc chuỗi tắt, mốc object có trường lạ, mốc của món khác, tay dẫn `both` */
function raw(): Json {
  return {
    name: "x",
    cast: [
      {
        id: "a",
        ghi: 1,
        world: {
          hands: [
            {
              t: 0,
              right: { at: [1, 2, 3], hold: "thuc-don@sheet", ease: "linear" },
              left: { at: [0, 0, 0] },
            },
            {
              t: 1,
              right: {
                hold: { item: "thuc-don", group: "sheet", variant: "flat", edge: "left", la: true },
              },
            },
            { t: 2, right: { hold: "coc@cylinder" } },
            { t: 3, right: { at: [4, 5, 6] } },
            {
              t: 4,
              left: { hold: { item: "khay", group: "platform", both: true } },
            },
            {
              t: 5,
              left: {
                hold: { item: "khay", group: "platform", both: { group: "platform", psi: 10 } },
              },
            },
          ],
        },
      },
    ],
  };
}
const hands = (r: Json) =>
  ((r.cast as Json[])[0].world as { hands: Record<string, unknown>[] }).hands;
const RUN: RunRef = {
  id: "a",
  side: "right",
  handKeys: [0, 1, 2, 3],
  item: "thuc-don",
  group: "sheet",
};

describe("đổi `variant` của một lần cầm trên JSON thô", () => {
  it("ghi tên: chuỗi tắt thành `món@nhóm/tên`, object thêm `variant`; mốc món khác, mốc không `hold` không đụng", () => {
    const a = raw();
    const { raw: b, changed } = setRunVariant(a, RUN, "thu-b12");
    expect(changed).toBe(2);
    const h = hands(b);
    expect(h[0]).toEqual({
      t: 0,
      right: { at: [1, 2, 3], hold: "thuc-don@sheet/thu-b12", ease: "linear" },
      left: { at: [0, 0, 0] },
    });
    expect(h[1].right).toEqual({
      hold: { item: "thuc-don", group: "sheet", variant: "thu-b12", edge: "left", la: true },
    });
    expect(h[2]).toEqual(hands(a)[2]);
    expect(h[3]).toEqual(hands(a)[3]);
    expect((b.cast as Json[])[0].ghi).toBe(1);
    // bản gốc không đổi
    expect(hands(a)[0].right).toMatchObject({ hold: "thuc-don@sheet" });
    expect(runVariant(b, RUN)).toBe("thu-b12");
  });

  it("bỏ khai (`undefined`): về chuỗi tắt `món@nhóm`, object bỏ `variant`; không đổi gì thì `changed` 0", () => {
    const { raw: b } = setRunVariant(raw(), RUN, "thu-b12");
    const { raw: c, changed } = setRunVariant(b, RUN, undefined);
    expect(changed).toBe(2);
    expect(hands(c)[0].right).toMatchObject({ hold: "thuc-don@sheet" });
    expect(hands(c)[1].right).toEqual({
      hold: { item: "thuc-don", group: "sheet", edge: "left", la: true },
    });
    expect(setRunVariant(raw(), { ...RUN, handKeys: [3] }, "x").changed).toBe(0);
    expect(setRunVariant(raw(), { ...RUN, handKeys: [1] }, "flat").changed).toBe(0);
  });

  it("tay phụ của `both`: đổi `variant` của `both` ở mốc tay dẫn, `true` thành object, bỏ hết về `true`", () => {
    const sup: RunRef = {
      id: "a",
      side: "right",
      lead: "left",
      handKeys: [4, 5],
      item: "khay",
      group: "platform",
    };
    const { raw: b, changed } = setRunVariant(raw(), sup, "do-day");
    expect(changed).toBe(2);
    expect(hands(b)[4].left).toEqual({
      hold: { item: "khay", group: "platform", both: { variant: "do-day" } },
    });
    expect(hands(b)[5].left).toEqual({
      hold: {
        item: "khay",
        group: "platform",
        both: { group: "platform", psi: 10, variant: "do-day" },
      },
    });
    expect(runVariant(b, sup)).toBe("do-day");
    const { raw: c } = setRunVariant(b, sup, undefined);
    expect(hands(c)[4].left).toEqual(hands(raw())[4].left);
    expect(hands(c)[5].left).toEqual(hands(raw())[5].left);
  });
});

describe("đổi `variant` giữ ranh giới với lần cầm kề", () => {
  /** Ba lần cầm liền nhau cùng món × nhóm, chỉ khác `variant`: 0–1 `flat`, 1–2 `pinch`, 2– `rim` */
  const three = (): Json => ({
    name: "x",
    cast: [
      {
        id: "a",
        world: {
          hands: [
            { t: 0, right: { hold: "thuc-don@sheet/flat" } },
            { t: 0.5, right: { hold: "thuc-don@sheet/flat" } },
            { t: 1, right: { hold: { item: "thuc-don", group: "sheet", variant: "pinch" } } },
            { t: 2, right: { hold: "thuc-don@sheet/rim" } },
          ],
        },
      },
    ],
  });
  const mid: RunRef = { id: "a", side: "right", handKeys: [2], item: "thuc-don", group: "sheet" };

  it("thành cùng kiểu với lần cầm trước: mốc mở lần cầm này nhận `regrip`", () => {
    const { raw: b, regrip } = setRunVariant(three(), mid, "flat");
    expect(regrip).toBe(1);
    expect(hands(b)[2].right).toEqual({
      hold: { item: "thuc-don", group: "sheet", variant: "flat", regrip: true },
    });
    expect(hands(b)[3]).toEqual(hands(three())[3]);
  });

  it("thành cùng kiểu với lần cầm sau: mốc mở lần cầm sau nhận `regrip`, chuỗi tắt thành object", () => {
    const { raw: b, regrip } = setRunVariant(three(), mid, "rim");
    expect(regrip).toBe(1);
    expect(hands(b)[2].right).toEqual({
      hold: { item: "thuc-don", group: "sheet", variant: "rim" },
    });
    expect(hands(b)[3].right).toEqual({
      hold: { item: "thuc-don", group: "sheet", variant: "rim", regrip: true },
    });
    const first: RunRef = { ...mid, handKeys: [0, 1] };
    const r = setRunVariant(three(), first, "pinch");
    expect(r.regrip).toBe(1);
    expect(hands(r.raw)[2].right).toMatchObject({ hold: { variant: "pinch", regrip: true } });
    expect(hands(r.raw)[0].right).toEqual({ hold: "thuc-don@sheet/pinch" });
  });

  it("kiểu khác cả hai bên, hay mốc kề là buông: không thêm `regrip`", () => {
    expect(setRunVariant(three(), mid, "kep").regrip).toBe(0);
    const j = three();
    hands(j)[1].right = { hold: null };
    expect(setRunVariant(j, mid, "flat").regrip).toBe(0);
  });
});

describe("mốc của cảnh gọi một kiểu", () => {
  it("`hold` cùng món × nhóm × kiểu, và `both` của tay dẫn", () => {
    const u = styleUses(raw(), "thuc-don", "sheet", "flat");
    expect(u).toEqual([{ id: "a", side: "right", t: 1 }]);
    const { raw: b } = setRunVariant(
      raw(),
      { id: "a", side: "right", lead: "left", handKeys: [4], item: "khay", group: "platform" },
      "do-day",
    );
    expect(styleUses(b, "khay", "platform", "do-day")).toEqual([{ id: "a", side: "left", t: 4 }]);
    expect(styleUses(b, "thuc-don", "sheet", "pinch")).toEqual([]);
  });
});

describe("chép kiểu cầm sang món khác", () => {
  const K = 1.75;
  const LONG = 1.545;
  const pick = {
    group: "sheet" as const,
    part: "body",
    edge: "left",
    along: 0.306,
    thumb: "front",
    slant: 70.3,
    variant: "flat",
  } as GraspChoice & { group: "sheet" };
  const src = item({ ...bangGia });
  /** Bản soạn lệch khỏi bộ giải: món dời 1,5 đơn vị và ngón cái gập thêm, như người chỉnh trong khung soạn */
  function edited(): AuthoredGrasp {
    const fr = graspFrame(src, itemGeom(src), pick, -1, handDims(K, LONG), K, LONG, 1);
    const G = { ...fr.G, p: [fr.G.p[0] + 0.015, fr.G.p[1], fr.G.p[2] - 0.01] as typeof fr.G.p };
    const v = [...fr.pose];
    v[4] += 12;
    const au = authoredFrom(G, fr.hand.pose, K, LONG, v, fr.choice as never, 6);
    return { base: "flat", note: "kẹp mép", ...au };
  }
  /** Bàn tay trong khung chỗ tiếp xúc (lòng tay, ngón, lòng × ngón); bản soạn làm tròn 1e-5 đơn vị three, tức 1e-3 đơn vị rig */
  const rel = (h: GraspHand, c: GraspHand) => {
    const dot = (a: readonly number[], b: readonly number[]) =>
      a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const unit = (a: number[]) => a.map((v) => v / Math.hypot(...a));
    const n = unit([...c.palm]);
    const f = unit(c.fingers.map((v, i) => v - n[i] * dot(c.fingers, n)));
    const x = [n[1] * f[2] - n[2] * f[1], n[2] * f[0] - n[0] * f[2], n[0] * f[1] - n[1] * f[0]];
    const d = h.at.map((v, i) => v - c.at[i]);
    return [n, f, x].flatMap((e) => [dot(d, e), dot(h.palm, e), dot(h.fingers, e)]);
  };
  const frames = (spec: HeldItemSpec, variant: string) => {
    const geom = itemGeom(spec);
    const c = { ...pick, variant };
    return {
      au: graspFrame(spec, geom, c, -1, handDims(1, 1), 1, 1, 1),
      ct: graspFrame(
        spec,
        geom,
        { ...pick, variant: "flat" },
        -1,
        handDims(1, 1),
        1,
        1,
        1,
        undefined,
        true,
      ),
    };
  };

  it("chép sang chính món: bản soạn không đổi", () => {
    const au = edited();
    const c = copyAuthored(src, au, "sheet", "flat", src);
    expect(c.base).toBe("flat");
    expect(c.note).toBe("kẹp mép");
    expect(c.fingers).toEqual(au.fingers);
    expect(c.curl).toBe(6);
    c.item.p.forEach((x, i) => expect(x).toBeCloseTo(au.item.p[i], 4));
    c.item.q.forEach((x, i) => expect(x).toBeCloseTo(au.item.q[i], 4));
  });

  it("chép sang món khác cùng nhóm: bàn tay giữ nguyên trong khung chỗ tiếp xúc ở cùng lựa chọn; rig dựng đúng kiểu mới", () => {
    const au = edited();
    const dst = item({
      ...bangGia,
      size: [36, 1.5, 52],
      shape: [{ box: [36, 1.4, 52], at: [0, 0.7, 0] }],
    });
    const c = copyAuthored(src, au, "sheet", "flat", dst);
    const withSrc = item({ ...bangGia, authored: { sheet: { "thu-b12": au } } });
    const withDst = item({ ...dst, authored: { sheet: { "thu-b12": c } } });
    const a = frames(withSrc, "thu-b12");
    const b = frames(withDst, "thu-b12");
    expect(b.au.authored).toBe(true);
    expect(b.au.choice.variant).toBe("thu-b12");
    expect(b.au.base).toBe("flat");
    // khác món: chỗ tiếp xúc dời, bàn tay dời theo
    expect(Math.hypot(...b.ct.hand.at.map((x, i) => x - a.ct.hand.at[i]))).toBeGreaterThan(0.1);
    rel(b.au.hand, b.ct.hand).forEach((x, i) =>
      expect(x).toBeCloseTo(rel(a.au.hand, a.ct.hand)[i], 2),
    );
    expect(b.au.pose).toEqual(a.au.pose);
  });

  it("món đích không dựng được lựa chọn: lỗi", () => {
    const au = edited();
    expect(() => copyAuthored(src, au, "sheet", "flat", item(dua))).toThrow();
  });
});
