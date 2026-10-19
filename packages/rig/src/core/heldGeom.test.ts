import { describe, expect, it } from "vitest";
import {
  alongFrac,
  edgeFrame,
  gripSpan,
  handDims,
  itemGeom,
  topProblems,
  type DiscFeature,
  type Feature,
  type LatheFeature,
  type RodFeature,
  type SlabFeature,
} from "./heldGeom";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";
import type { V3 } from "./lens";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import bienLai from "./__fixtures__/held-v2/bien-lai.json";
import chaiDia from "./__fixtures__/held-v2/chai-dia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";
import dua from "./__fixtures__/held-v2/dua.json";
import ongNgheBan from "./__fixtures__/held-v2/ong-nghe-ban.json";
import tomHum from "./__fixtures__/held-v2/tom-hum.json";
import tuiHieu from "./__fixtures__/held-v2/tui-hieu.json";

const item = (json: unknown): HeldItemSpec => {
  const r = parseHeldItem(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const of = <K extends Feature["kind"]>(fs: Feature[], kind: K) =>
  fs.filter((f): f is Extract<Feature, { kind: K }> => f.kind === kind);
const close = (a: readonly number[], b: readonly number[], d = 1e-6) =>
  a.forEach((x, i) => expect(x).toBeCloseTo(b[i], -Math.log10(d) - 1));

const SLAB_BOX = (top: V3) =>
  item({
    schemaVersion: 2,
    size: [40, 1, 60],
    anchors: {},
    front: [0, 1, 0],
    top,
    shape: [{ box: [40, 1, 60] }],
  });
const tilt = (deg: number): V3 => [
  0,
  Math.cos((deg * Math.PI) / 180),
  -Math.sin((deg * Math.PI) / 180),
];

describe("itemGeom trên tám món", () => {
  it("biên lai, điện thoại không ra `rod`; cả hai là tấm đứng", () => {
    for (const json of [bienLai, dienThoai]) {
      const g = itemGeom(item(json));
      expect(of(g.features, "rod")).toEqual([]);
      expect(of(g.features, "lathe")).toEqual([]);
      const [s] = of(g.features, "slab");
      expect(s.lying).toBe(false);
      expect(s.faces.map((f) => f.name)).toEqual(["front", "back"]);
    }
    const [s] = of(itemGeom(item(dienThoai)).features, "slab");
    expect(s.t).toBeCloseTo(2.88, 6);
    const len = Object.fromEntries(s.edges.map((e) => [e.name, e.len]));
    expect(len.top).toBeCloseTo(18.45, 6);
    expect(len.bottom).toBeCloseTo(18.45, 6);
    expect(len.left).toBeCloseTo(37.8, 6);
    expect(len.right).toBeCloseTo(37.8, 6);
  });

  it("đũa ra hai `rod` (mỗi que một khối `cyl`), phần `nut` không vào", () => {
    const g = itemGeom(item(dua));
    const rods = of(g.features, "rod");
    expect(rods).toHaveLength(2);
    for (const r of rods) {
      expect(r.r).toBe(1.5);
      expect(r.R).toBe(1.5);
      expect(r.len).toBeCloseTo(82.02, 1);
      expect(r.a[1]).toBeGreaterThan(0);
    }
    expect(g.features.some((f) => f.part === "nut")).toBe(false);
    expect(g.blocked.map((b) => b.part)).toEqual(["nut"]);
  });

  it("phần nhiều khối chỉ ra `slab` khi lấp ≥ 0,5 hộp bao: đũa không, điện thoại có", () => {
    expect(of(itemGeom(item(dua)).features, "slab")).toEqual([]);
    expect(of(itemGeom(item(dienThoai)).features, "slab")).toHaveLength(1);
    const two = (z: number) =>
      item({
        schemaVersion: 2,
        size: [40, 40, 4],
        anchors: {},
        shape: [
          { box: [40, 2, 4], at: [0, 19, 0] },
          { box: [40, 2, z], at: [0, -19, 0] },
        ],
      });
    expect(of(itemGeom(two(4)).features, "slab")).toEqual([]);
  });

  it("đĩa tôm hùm: hai bộ trụ côn lệch trục 2 ra một `lathe`, cũng là `disc` nằm", () => {
    const g = itemGeom(item(tomHum));
    const lathes = of(g.features, "lathe");
    expect(lathes).toHaveLength(1);
    const [l] = lathes;
    expect(l.part).toBe("dia");
    expect(l.blocks).toHaveLength(6);
    expect(l.rMax).toBe(35);
    expect(l.profile[0]).toEqual([0, 21.32]);
    expect(l.len).toBeCloseTo(5.4, 6);
    const [d] = of(g.features, "disc");
    expect(d.lying).toBe(true);
    expect(d.radius).toBe(35);
    expect(d.rim).toEqual(["front", "right", "back", "left"]);
    expect(g.features.some((f) => f.part === "mon-an")).toBe(false);
  });

  it("ống nghe máy bàn: phần `tay` ra `rod` r 3, R 9; miền bám chỉ là thân giữa loa và mic", () => {
    const g = itemGeom(item(ongNgheBan));
    const rods = of(g.features, "rod");
    expect(rods).toHaveLength(1);
    const [r] = rods;
    expect(r.part).toBe("tay");
    expect([r.r, r.R]).toEqual([3, 9]);
    close(r.a, [0, 0, 1]);
    const span = gripSpan(g, r);
    expect(span).toHaveLength(1);
    close(span[0].lo, [0, 0, -11]);
    close(span[0].hi, [0, 0, 11]);
    expect(g.features.some((f) => f.part === "mic" || f.part === "loa")).toBe(false);
  });

  it("chai địa: ba trụ tiện than, vai, cổ; đoạn bám liền y 0–68,5, miệng loại", () => {
    const g = itemGeom(item(chaiDia));
    const lathes = of(g.features, "lathe");
    expect(lathes.map((l) => [l.part, l.rMax, l.lo[1], l.lo[1] + l.len])).toEqual([
      ["than", 10.2, 0, 40],
      ["vai", 10.2, 40, 61],
      ["co", 4.4, 61, 68.5],
    ]);
    for (const l of lathes) {
      const span = gripSpan(g, l);
      expect(span).toHaveLength(1);
      expect(span[0].lo[1]).toBeCloseTo(0, 9);
      expect(span[0].hi[1]).toBeCloseTo(68.5, 9);
      expect(span[0].parts).toEqual(["than", "vai", "co"]);
    }
    expect(gripSpan(g, lathes[0], { pad: 1 })[0].hi[1]).toBeCloseTo(67.5, 9);
    const ends = of(g.features, "face").filter((f) => f.from === "lathe");
    expect(ends.map((f) => [f.part, f.name, f.c[1]])).toEqual([["than", "bottom", 0]]);
  });

  it("túi hiệu: không phần nào `grip: false`, mọi khối là một phần `body`", () => {
    const g = itemGeom(item(tuiHieu));
    expect(g.parts.map((p) => p.name)).toEqual(["body"]);
    expect(g.blocked).toEqual([]);
    expect(of(g.features, "box")).toHaveLength(1);
  });

  it("khối `detail` bị bỏ khỏi khối hình", () => {
    const spec = item(dienThoai);
    const g = itemGeom(spec);
    const detail = new Set(spec.shape!.flatMap((b, i) => (b.detail ? [i] : [])));
    expect(detail.size).toBe(5);
    expect(g.parts[0].blocks.some((i) => detail.has(i))).toBe(false);
    const [box] = of(g.features, "box");
    expect(box.half[2]).toBeCloseTo(1.44, 6);
    const [s] = of(g.features, "slab");
    expect(s.t).toBeCloseTo(2.88, 6);
  });

  it("nhớ theo object spec", () => {
    const spec = item(bangGia);
    expect(itemGeom(spec)).toBe(itemGeom(spec));
  });
});

describe("tên mặt, tên cạnh của tấm", () => {
  it("bảng giá: mặt trước +y, cạnh trên −z, cạnh phải +x", () => {
    const [s] = of(itemGeom(item(bangGia)).features, "slab");
    const m = Object.fromEntries(s.edges.map((e) => [e.name, e.m]));
    close(m.top, [0, 0, -1]);
    close(m.right, [1, 0, 0]);
    close(s.faces[0].n, [0, 1, 0]);
  });

  it("ngưỡng 45°: pháp tuyến lệch U 44° là tấm nằm, 46° là tấm đứng", () => {
    const [lying] = of(itemGeom(SLAB_BOX(tilt(44))).features, "slab");
    expect(lying.lying).toBe(true);
    expect(lying.faces.map((f) => f.name)).toEqual(["top", "bottom"]);
    expect(lying.edges.map((e) => e.name).sort()).toEqual(["back", "front", "left", "right"]);
    close(lying.edges.find((e) => e.name === "front")!.m, [0, 0, 1]);
    const [standing] = of(itemGeom(SLAB_BOX(tilt(46))).features, "slab");
    expect(standing.lying).toBe(false);
    expect(standing.faces.map((f) => f.name)).toEqual(["front", "back"]);
    expect(standing.edges.map((e) => e.name).sort()).toEqual(["bottom", "left", "right", "top"]);
    close(standing.edges.find((e) => e.name === "top")!.m, [0, 0, -1]);
  });
});

describe("edgeFrame", () => {
  it("cạnh tấm: m, F theo ngón cái, e = m × F, lật theo đầu cao", () => {
    const [s] = of(itemGeom(item(bangGia)).features, "slab") as SlabFeature[];
    const fr = edgeFrame(s, "right", "front");
    close(fr.m, [1, 0, 0]);
    close(fr.F, [0, 1, 0]);
    close(fr.e, [0, 0, 1]);
    close(fr.at, [22, 0.6, 0]);
    expect(fr.len).toBe(58);
    close(edgeFrame(s, "right", "front", [0, 0, -1]).e, [0, 0, -1]);
    close(edgeFrame(s, "right", "back").F, [0, -1, 0]);
    expect(() => edgeFrame(s, "front", "front")).toThrow(/không có cạnh/);
    expect(() => edgeFrame(s, "right", "top")).toThrow(/mặt `top`/);
  });

  it("vành đĩa: tên ứng với góc 0, 90, 180, 270 từ `front` về `right`", () => {
    const [d] = of(itemGeom(item(tomHum)).features, "disc") as DiscFeature[];
    const r = edgeFrame(d, "right", "top");
    close(r.m, [1, 0, 0]);
    close(r.at, [35, 2.7, 0]);
    close(edgeFrame(d, 90, "top").m, r.m);
    close(edgeFrame(d, "front", "top").m, [0, 0, 1]);
  });
});

describe("vị trí dọc cạnh", () => {
  it("tên ra tỉ lệ từ đầu thấp; `corner` là nửa bàn tay", () => {
    expect(alongFrac("low", 58, 8.4)).toBe(0.25);
    expect(alongFrac("mid", 58, 8.4)).toBe(0.5);
    expect(alongFrac("high", 58, 8.4)).toBe(0.75);
    expect(alongFrac("corner", 58, 8.4)).toBeCloseTo(4.2 / 58, 9);
    expect(alongFrac(1.3, 58, 8.4)).toBe(1);
  });
});

describe("gripSpan trên cạnh tấm", () => {
  it("cạnh không chạm phần `grip: false` là trọn cạnh", () => {
    const g = itemGeom(item(bangGia));
    const [s] = of(g.features, "slab");
    const [seg] = gripSpan(g, s, { edge: "right" });
    expect(seg.len).toBe(58);
    expect(() => gripSpan(g, s)).toThrow(/cần `edge`/);
  });
});

describe("đầu trên và miệng", () => {
  // thô, không qua `parseHeldItem`: parse đã từ chối `top` lệch miệng
  const cup = (top?: V3, flip = false) =>
    ({
      schemaVersion: 2,
      size: [10, 12, 10],
      anchors: {},
      ...(top ? { top } : {}),
      shape: [
        { cyl: 5, from: [0, flip ? 12 : 0, 0], to: [0, flip ? 11 : 1, 0] },
        { cyl: 5, from: [0, flip ? 11 : 1, 0], to: [0, flip ? 0 : 12, 0], wall: 0.5 },
      ],
    }) as unknown as HeldItemSpec;

  it("bỏ trống `top` thì đầu trên là hướng miệng", () => {
    const g = itemGeom(cup(undefined, true));
    close(g.U, [0, -1, 0]);
    const [l] = of(g.features, "lathe") as LatheFeature[];
    expect(l.mouth).toBe("hi");
    expect(of(g.features, "face").filter((f) => f.from === "lathe")).toHaveLength(1);
  });

  it("`top` lệch miệng quá 10° là lỗi", () => {
    expect(topProblems(cup([0, 1, 0]))).toEqual([]);
    expect(topProblems(cup([0, 1, Math.tan((9 * Math.PI) / 180)]))).toEqual([]);
    expect(topProblems(cup([0, 1, Math.tan((11 * Math.PI) / 180)]))[0]).toMatch(
      /lệch hướng miệng 11\.0°/,
    );
    expect(topProblems(cup([0, 0, 1]))).toHaveLength(1);
    expect(topProblems(item(chaiDia))).toEqual([]);
  });
});

describe("handDims", () => {
  it("cỡ 1: W 8,4, A 9,76, L 17,9, P 10,1", () => {
    const d = handDims(1);
    expect(Math.abs(d.W - 8.4)).toBeLessThan(0.05);
    expect(Math.abs(d.A - 9.76)).toBeLessThan(0.05);
    expect(Math.abs(d.L - 17.9)).toBeLessThan(0.05);
    expect(Math.abs(d.P - 10.1)).toBeLessThan(0.05);
  });

  it("W theo k, P theo long", () => {
    const d = handDims(1.75, 1.5446);
    expect(d.W).toBeCloseTo(14.7, 6);
    expect(d.P).toBeCloseTo(10.1 * 1.5446, 6);
    expect(handDims(2)).toBe(handDims(2, 2));
  });
});

// thanh hộp: tiết diện đúng ngưỡng 3 : 1 vẫn là thanh, quá thì không
it("ngưỡng thanh hộp b / a ≤ 3, b ≤ 0,5 × cạnh dài", () => {
  const rods = (box: V3) =>
    of(
      itemGeom(item({ schemaVersion: 2, size: box, anchors: {}, shape: [{ box }] })).features,
      "rod",
    ) as RodFeature[];
  expect(rods([18, 6, 44])).toHaveLength(1);
  expect(rods([18.5, 6, 44])).toHaveLength(0);
  expect(rods([12, 6, 23])).toHaveLength(0);
});
