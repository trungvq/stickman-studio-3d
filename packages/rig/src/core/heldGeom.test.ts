import { describe, expect, it } from "vitest";
import {
  alongFrac,
  axialAt,
  edgeFrame,
  gripSpan,
  handDims,
  itemGeom,
  latheRadius,
  topProblems,
  type DiscFeature,
  type Feature,
  type FaceFeature,
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
import khay from "./__fixtures__/held-v2/khay.json";
import tomHum from "./__fixtures__/held-v2/tom-hum.json";
import tuiHieu from "./__fixtures__/held-v2/tui-hieu.json";

const item = (json: unknown): HeldItemSpec => {
  const r = parseHeldItem(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const of = <K extends Feature["kind"]>(fs: Feature[], kind: K) =>
  fs.filter((f): f is Extract<Feature, { kind: K }> => f.kind === kind);
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
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

describe("cạnh của mặt", () => {
  const bottom = (json: unknown): FaceFeature => {
    const g = itemGeom(item(json));
    return of(g.features, "face").find((f) => f.part === "day" && f.name === "bottom")!;
  };

  it("đáy khay: bốn cạnh front, back, left, right với dài và điểm giữa đúng", () => {
    const f = bottom(khay);
    expect(f.edges.map((e) => e.name).sort()).toEqual(["back", "front", "left", "right"]);
    const by = Object.fromEntries(f.edges.map((e) => [e.name, e]));
    close(by.front.at, [0, 0, 26]);
    close(by.back.at, [0, 0, -26]);
    close(by.right.at, [46, 0, 0]);
    close(by.left.at, [-46, 0, 0]);
    expect([by.front.len, by.back.len, by.left.len, by.right.len]).toEqual([92, 92, 52, 52]);
    expect(f.edges.reduce((a, e) => a + e.len, 0)).toBeCloseTo(2 * (92 + 52));
    close(by.front.inward, [0, 0, -1]);
    close(by.right.inward, [-1, 0, 0]);
  });

  it("pháp tuyến trong nằm trong mặt, trực giao cạnh, chỉ vào tâm mặt", () => {
    for (const json of [khay, bangGia, dienThoai]) {
      for (const f of of(itemGeom(item(json)).features, "face")) {
        for (const e of f.edges) {
          const along = [f.u, f.v].find((d) => Math.abs(dot(d, e.inward)) < 1e-9)!;
          expect(Math.abs(dot(e.inward, f.n))).toBeCloseTo(0);
          expect(Math.abs(dot(along, e.inward))).toBeCloseTo(0);
          const toC = [0, 1, 2].map((i) => f.c[i] - e.at[i]);
          expect(dot(toC, e.inward)).toBeGreaterThan(0);
          expect(e.len).toBeCloseTo(2 * (Math.abs(dot(along, f.u)) > 0.5 ? f.half[0] : f.half[1]));
        }
        if (f.from === "box") expect(f.edges).toHaveLength(4);
      }
    }
  });

  it("mặt tròn của trụ tiện không có cạnh", () => {
    const ends = of(itemGeom(item(chaiDia)).features, "face").filter((f) => f.from === "lathe");
    expect(ends.length).toBeGreaterThan(0);
    for (const f of ends) expect(f.edges).toEqual([]);
  });

  it("khung món nghiêng 44°: bốn cạnh của đáy vẫn khác tên", () => {
    const g = itemGeom(SLAB_BOX(tilt(44)));
    for (const f of of(g.features, "face"))
      expect(new Set(f.edges.map((e) => e.name)).size).toBe(f.edges.length);
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

describe("axialAt trên trụ tiện và thanh", () => {
  const rodItem = (from: V3, to: V3, front: V3) =>
    item({
      schemaVersion: 2,
      size: [40, 40, 40],
      anchors: {},
      front,
      top: [0, 1, 0],
      shape: [{ cyl: 2, from, to }],
    });

  it("chai địa: `along` 0/1 là hai đầu đoạn bám y 0–68,5 (cắt miệng), `pad` thu đầu cao", () => {
    const g = itemGeom(item(chaiDia));
    for (const l of of(g.features, "lathe")) {
      close(axialAt(g, l, 0, 0).at, [0, 0, 0]);
      close(axialAt(g, l, 1, 0).at, [0, 68.5, 0]);
      close(axialAt(g, l, 0.5, 0).at, [0, 34.25, 0]);
      close(axialAt(g, l, 1.4, 0).at, [0, 68.5, 0]);
    }
    const [than] = of(g.features, "lathe");
    close(axialAt(g, than, 1, 0, { pad: 1 }).at, [0, 67.5, 0]);
  });

  it("chai địa: `r(s)` khớp `latheRadius` của phần chứa điểm, lớn nhất ở chỗ nối", () => {
    const g = itemGeom(item(chaiDia));
    const [than, vai, co] = of(g.features, "lathe");
    const at = (y: number) => axialAt(g, vai, y / 68.5, 0).r;
    expect(at(20)).toBeCloseTo(latheRadius(than, 20), 9);
    expect(at(50)).toBeCloseTo(latheRadius(vai, 10), 9);
    expect(at(50)).toBeCloseTo(7.8, 9);
    expect(at(57.5)).toBeCloseTo(latheRadius(vai, 17.5), 9);
    expect(at(65)).toBeCloseTo(latheRadius(co, 4), 9);
    expect(at(0.4)).toBeCloseTo(9.8, 9);
    expect(at(40)).toBeCloseTo(10.2, 9);
    expect(at(61)).toBeCloseTo(4.4, 9);
  });

  it("chai địa: `ρ(0)` là `front` (nhãn), `ρ(90)` là `right`, `ρ(θ)` không phụ thuộc `along`", () => {
    const g = itemGeom(item(chaiDia));
    const [, vai] = of(g.features, "lathe");
    expect(g.hasFront).toBe(true);
    close(axialAt(g, vai, 0.5, 0).rho, [0, 0, 1]);
    close(axialAt(g, vai, 0.5, 90).rho, g.R);
    close(axialAt(g, vai, 0.5, 90).rho, [1, 0, 0]);
    close(axialAt(g, vai, 0.9, 180).rho, [0, 0, -1]);
    close(axialAt(g, vai, 0.1, 270).rho, [-1, 0, 0]);
    close(axialAt(g, vai, 0.5, 0).a, [0, 1, 0]);
  });

  it("ống nghe: `along` 0/1 là hai đầu thân giữa mic và loa, `ρ(0)` mặt trước, `r` tới mặt tiết diện", () => {
    const g = itemGeom(item(ongNgheBan));
    const [r] = of(g.features, "rod");
    close(axialAt(g, r, 0, 0).at, [0, 0, -11]);
    close(axialAt(g, r, 1, 0).at, [0, 0, 11]);
    const p = (deg: number) => axialAt(g, r, 0.5, deg);
    close(p(0).rho, [0, -1, 0]);
    close(p(90).rho, [1, 0, 0]);
    close(p(180).rho, [0, 1, 0]);
    expect(p(0).r).toBeCloseTo(3, 9);
    expect(p(90).r).toBeCloseTo(9, 9);
    expect(p(180).r).toBeCloseTo(3, 9);
    expect(p(45).r).toBeCloseTo(3 * Math.SQRT2, 9);
  });

  it("đũa (không `front`): `ρ(0)` là `b0`, `ρ(90) = a × ρ(0)`; đầu cao cắt ở núm", () => {
    const g = itemGeom(item(dua));
    expect(g.hasFront).toBeUndefined();
    for (const r of of(g.features, "rod")) {
      const [seg] = gripSpan(g, r);
      expect(seg.len).toBeLessThan(r.len - 1);
      close(axialAt(g, r, 0, 0).at, seg.lo);
      close(axialAt(g, r, 1, 0).at, seg.hi);
      close(axialAt(g, r, 0, 0).rho, r.b0);
      const x = axialAt(g, r, 0, 90).rho;
      close(x, [
        r.a[1] * r.b0[2] - r.a[2] * r.b0[1],
        r.a[2] * r.b0[0] - r.a[0] * r.b0[2],
        r.a[0] * r.b0[1] - r.a[1] * r.b0[0],
      ]);
      expect(dot(x, r.a)).toBeCloseTo(0, 9);
      expect(axialAt(g, r, 0.3, 0).r).toBe(1.5);
    }
  });

  it("trụ nằm có `front`: `ρ(0)` là `front` chiếu, không phải `b0`; `front` dọc trục thì `b0`", () => {
    const across = itemGeom(rodItem([-15, 0, 0], [15, 0, 0], [0, 0, 1]));
    const [r] = of(across.features, "lathe");
    close(r.b0, [0, 1, 0]);
    close(axialAt(across, r, 0.5, 0).rho, [0, 0, 1]);
    close(axialAt(across, r, 0.5, 90).rho, [0, -1, 0]);
    const tilted = itemGeom(rodItem([-15, 0, 0], [15, 0, 0], [0.5, 0, 1]));
    close(axialAt(tilted, of(tilted.features, "lathe")[0], 0.5, 0).rho, [0, 0, 1]);
    const along = itemGeom(rodItem([0, 0, -15], [0, 0, 15], [0, 0, 1]));
    const [q] = of(along.features, "lathe");
    close(axialAt(along, q, 0.5, 0).rho, q.b0);
    close(axialAt(along, q, 0.5, 0).rho, [0, 1, 0]);
    close(axialAt(along, q, 0.5, 90).rho, [-1, 0, 0]);
  });

  it("phần `grip: false` che hết thì báo lỗi", () => {
    const g = itemGeom(
      item({
        schemaVersion: 2,
        size: [40, 40, 40],
        anchors: {},
        parts: { vo: { grip: false } },
        shape: [
          { cyl: 2, from: [0, 0, 0], to: [0, 30, 0], part: "can" },
          { box: [10, 40, 10], at: [0, 15, 0], part: "vo" },
        ],
      }),
    );
    const [l] = of(g.features, "lathe");
    expect(() => axialAt(g, l, 0.5, 0)).toThrow(/không còn đoạn bám/);
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
