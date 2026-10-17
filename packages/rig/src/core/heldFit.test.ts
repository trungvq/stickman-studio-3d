import { describe, expect, it } from "vitest";
import { fingerVec, HAND_FIT, HAND_POSES, handFrames } from "./hand";
import {
  capsuleClearance,
  fingerClearance,
  HELD_FIT,
  heldDistance,
  heldFit,
  shapeDistance,
} from "./heldFit";
import { heldHits, HELD_PIERCE_FIT, HELD_WRAP, heldLine, type HeldHand } from "./heldAudit";
import {
  gripFrame,
  gripHand,
  HELD_FINGERS,
  parseHeldItem,
  type GripFrame,
  type HeldShape,
} from "./heldItem";
import { handVec } from "./hand";
import type { V3 } from "./lens";

const spec = (j: unknown) => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

/** Gậy đứng bán kính `r` (cán, cổ chai), nắm ở tâm: kiểu `grip` ôm cả năm ngón */
const rod = (r: number, wrap = [...HELD_FINGERS]) =>
  spec({
    size: [2 * r, 30, 2 * r],
    anchors: { mid: { at: [0, 0, 0] } },
    grips: { nam: { pose: "grip", at: "mid", palm: [0, 0, 1], fingers: [-1, 0, 0], wrap } },
    shape: [{ cyl: r, from: [0, -15, 0], to: [0, 15, 0] }],
  });

/** Hai cỡ tay: mặc định và tay to, dài */
const SIZES = [
  [1, 1],
  [1.3, 1.15],
] as const;

describe("hình va chạm: khoảng cách có dấu", () => {
  it("hộp, hộp bo, cầu, trụ côn: dương ở ngoài, âm ở trong", () => {
    const box: HeldShape = { box: [4, 2, 6], at: [1, 0, 0] };
    expect(shapeDistance(box, [1, 0, 0])).toBeCloseTo(-1, 9);
    expect(shapeDistance(box, [5, 0, 0])).toBeCloseTo(2, 9);
    expect(shapeDistance(box, [4, 2, 4])).toBeCloseTo(Math.hypot(1, 1, 1), 9);
    const round: HeldShape = { box: [4, 4, 4], round: 1 };
    expect(shapeDistance(round, [3, 3, 0])).toBeCloseTo(Math.hypot(2, 2) - 1, 9);
    expect(shapeDistance({ ball: 2, at: [0, 3, 0] }, [0, 0, 0])).toBeCloseTo(1, 9);
    const cone: HeldShape = { cyl: 2, from: [0, 0, 0], to: [0, 10, 0], r2: 4 };
    expect(shapeDistance(cone, [5, 5, 0])).toBeCloseTo(2 * Math.cos(Math.atan(0.2)), 6);
    expect(shapeDistance(cone, [0, 5, 0])).toBeCloseTo(-2.94, 1);
    expect(shapeDistance(cone, [0, -3, 0])).toBeCloseTo(3, 9);
  });

  it("ống rỗng (`wall`): trong thành là trong, lòng ống và hai đầu là ngoài", () => {
    const tube: HeldShape = { cyl: 8, from: [0, 0, 0], to: [0, 4, 0], wall: 1 };
    expect(shapeDistance(tube, [7.5, 2, 0])).toBeCloseTo(-0.5, 9);
    expect(shapeDistance(tube, [0, 2, 0])).toBeCloseTo(7, 9);
    expect(shapeDistance(tube, [3, 4.5, 0])).toBeGreaterThan(3);
  });

  it("hợp các khối bằng min của từng khối, cả khi bỏ khối xa theo cầu bao", () => {
    const shape: HeldShape[] = [
      { box: [4, 2, 6], at: [1, 0, 0] },
      { cyl: 1, from: [0, 0, 0], to: [10, 0, 0], r2: 3 },
      { ball: 2, at: [-5, 4, 1] },
    ];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 24 - 12;
    for (let i = 0; i < 200; i++) {
      const p: V3 = [rnd(), rnd(), rnd()];
      expect(heldDistance(shape, p)).toBeCloseTo(
        Math.min(...shape.map((b) => shapeDistance(b, p))),
        9,
      );
    }
  });

  it("nang cắt qua tấm mỏng hơn bước lấy mẫu: trục vào trong (`core` dương)", () => {
    const G: GripFrame = { R: [1, 0, 0, 0, 1, 0, 0, 0, 1], p: [0, 0, 0], u: 0.01 };
    const plate: HeldShape[] = [{ box: [20, 0.3, 20], at: [0, 0.07, 0] }];
    const c = capsuleClearance(plate, G, [0, -0.02, 0], [0, 0.02, 0], 0.01);
    expect(c.core).toBeGreaterThan(0);
    expect(c.gap).toBeLessThan(-1);
  });

  it("schema: bo cạnh quá nửa cạnh, ống thành dày hơn bán kính là lỗi", () => {
    const base = {
      size: [4, 4, 4],
      anchors: { a: { at: [0, 0, 0] } },
      grips: { g: { pose: "grip", at: "a", palm: [1, 0, 0], fingers: [0, -1, 0] } },
    };
    expect(parseHeldItem({ ...base, shape: [{ box: [4, 2, 4], round: 1.2 }] }).success).toBe(false);
    expect(
      parseHeldItem({ ...base, shape: [{ cyl: 2, from: [0, 0, 0], to: [0, 1, 0], wall: 2 }] })
        .success,
    ).toBe(false);
    expect(
      parseHeldItem({ ...base, shape: [{ cyl: 2, from: [0, 0, 0], to: [0, 1, 0], wall: 0.5 }] })
        .success,
    ).toBe(true);
  });
});

describe("handFrames: độ gập thêm từng đốt", () => {
  it("không có số thêm, hay số thêm bằng 0: đúng khung cũ; số thêm chỉ đổi ngón ấy", () => {
    const v = [0, 0, ...fingerVec(HAND_POSES.grip)];
    const a = handFrames(v, -1, 1.1, 1.05);
    expect(handFrames([...v, ...HAND_FIT.map(() => 0)], -1, 1.1, 1.05)).toEqual(a);
    const ring = HAND_FIT.indexOf("ring1");
    const fit = HAND_FIT.map((_, i) => (i === ring ? 20 : 0));
    const b = handFrames([...v, ...fit], -1, 1.1, 1.05);
    for (const n of Object.keys(a) as (keyof typeof a)[])
      if (n === "ring1") expect(b[n].R).not.toEqual(a[n].R);
      else expect(b[n]).toEqual(a[n]);
  });
});

describe("heldFit: ngón ôm theo đồ", () => {
  const solve = (r: number, side: number, k: number, long: number, wrap?: readonly string[]) => {
    const item = rod(r, wrap as never);
    const gh = gripHand(item.grips.nam, side);
    const G = gripFrame(item, gh, side, k, long);
    const v = [0, 0, ...fingerVec(HAND_POSES.grip)];
    const inp = { v, side, k, long, shape: item.shape!, G, wrap: gh.wrap };
    const fit = heldFit(inp);
    return {
      fit,
      before: fingerClearance(inp, v),
      after: fingerClearance(inp, [...v, ...fit]),
      inp,
    };
  };

  it("cán vừa nắm tay, hai tay, hai cỡ tay: ngón khai ôm chạm mặt cán, không ngón nào lún", () => {
    for (const side of [-1, 1])
      for (const [k, long] of SIZES) {
        const { after } = solve(2.5, side, k, long);
        for (const f of HELD_FINGERS) {
          const g = Math.min(...after[f]);
          expect(g, `${side} ${k} ${f}`).toBeGreaterThan(-HELD_FIT.sink - 0.3);
          expect(g, `${side} ${k} ${f}`).toBeLessThan(0.5);
        }
      }
  });

  it("cán mảnh hơn nắm tay: ngón khai ôm cuộn thêm; ngón không khai ôm không cuộn thêm, chỉ gỡ khi lún", () => {
    for (const [k, long] of SIZES) {
      const { fit, before, after } = solve(0.8, -1, k, long, ["index", "middle"]);
      expect(Math.min(...before.index)).toBeGreaterThan(HELD_FIT.touch);
      expect(fit[HAND_FIT.indexOf("index0")] + fit[HAND_FIT.indexOf("index1")]).toBeGreaterThan(0);
      expect(Math.min(...after.index)).toBeLessThan(0.3);
      for (const n of ["thumb", "ring", "pinky"]) {
        expect(fit[HAND_FIT.indexOf(`${n}0` as never)]).toBeLessThanOrEqual(0);
        expect(Math.min(...after[n as "ring"])).toBeGreaterThan(-HELD_FIT.sink - 0.3);
      }
    }
  });

  it("món xa bàn tay: không đổi gì; cùng số vào là cùng số ra", () => {
    const item = rod(2.5);
    const gh = gripHand(item.grips.nam, -1);
    const G = gripFrame(item, gh, -1);
    const far = { ...G, p: [G.p[0] + 1, G.p[1], G.p[2]] as V3 };
    const v = [0, 0, ...fingerVec(HAND_POSES.grip)];
    expect(
      heldFit({ v, side: -1, k: 1, long: 1, shape: item.shape!, G: far, wrap: gh.wrap }),
    ).toEqual(HAND_FIT.map(() => 0));
    const a = heldFit({ v, side: -1, k: 1, long: 1, shape: item.shape!, G, wrap: gh.wrap });
    expect(heldFit({ v, side: -1, k: 1, long: 1, shape: item.shape!, G, wrap: gh.wrap })).toEqual(
      a,
    );
  });
});

const sample = (o: Partial<HeldHand> = {}): HeldHand => ({
  id: "a",
  hand: "R",
  item: "binh",
  key: "binh|co",
  pose: "grip",
  follow: "wrist",
  hold: "binh#co",
  acted: handVec("grip"),
  pierce: { depth: 1, core: -0.5, piece: "index1" },
  gaps: { thumb: 0, index: 0, fingers: 0, palm: 0 },
  fingers: { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 },
  wrap: ["index", "middle", "ring", "pinky"],
  grip: -1,
  palm: { gap: 0, angle: 0 },
  rel: { p: [0, -8, 0], q: [0, 0, 0, 1] },
  at: [0, -150, 0],
  ...o,
});

describe("luật `held` trên hình va chạm", () => {
  it("ngón khai ôm còn hở quá `HELD_WRAP`: `wrap`, dòng báo kể ngón", () => {
    expect(heldHits(sample())).toEqual([]);
    const s = sample({ fingers: { thumb: 5, index: 0, middle: 0, ring: 0, pinky: HELD_WRAP + 1 } });
    const hits = heldHits(s);
    expect(hits.map((h) => h.rule)).toEqual(["wrap"]);
    const line = heldLine({
      id: "a",
      hand: "R",
      item: "binh",
      rule: "wrap",
      t: 1,
      worst: hits[0].worst,
      sample: s,
      declared: { pose: "grip", off: 0 },
      runs: [[0, 1]],
      clips: [],
    });
    expect(line).toContain("ngón út cách món 2.5");
    expect(line).not.toContain("ngón cái");
  });

  it("trục ngón vào trong hình quá `HELD_PIERCE_FIT` là xuyên; lưới (không hình) giữ ngưỡng cũ", () => {
    const core = HELD_PIERCE_FIT + 0.2;
    expect(
      heldHits(sample({ pierce: { depth: 2, core, piece: "pinky1" } })).map((h) => h.rule),
    ).toEqual(["pierce"]);
    expect(
      heldHits(
        sample({
          fingers: undefined,
          wrap: undefined,
          pierce: { depth: 2, core, piece: "pinky1" },
        }),
      ),
    ).toEqual([]);
  });
});
