import { describe, expect, it } from "vitest";

import {
  D,
  drape,
  drapeAt,
  hemHang,
  hemReach,
  matchWrap,
  RIG,
  roots3,
  SkirtSchema,
  wrapHemEdge,
  wrapHemOf,
  WrapSchema,
} from "./index";
import { LAP_FLAP, lapFold } from "./torso";

const LONG = SkirtSchema.parse({ style: "wrap", rise: 30, length: 195, flare: -4, pleats: 0 });

describe("vạt treo hông", () => {
  it("phủ đủ ống chân khi đứng, đi, chỉ tới gối khi ngồi, quỳ", () => {
    expect(hemHang(0)).toBe(1);
    expect(hemHang(30 * D)).toBe(1);
    expect(hemHang(80 * D)).toBe(0);
    const [lt, ls] = [RIG.thigh, RIG.shin];
    expect(hemReach(LONG, 1, 0, lt, ls)).toEqual([lt, 165 - lt]);
    expect(hemReach(LONG, 1, 90 * D, lt, ls)).toEqual([lt, 0]);
    // vạt ngắn hơn đùi thì không tới ống chân
    expect(hemReach({ ...LONG, length: 90 }, 1, 0, lt, ls)).toEqual([60, 0]);
  });

  it("mép vạt trên luôn ở bên phải người mặc (右前): x hệ thân âm từ cạp tới gấu", () => {
    for (const wrap of [undefined, { overlap: 4, slant: 0 }, { overlap: 30, slant: 20 }]) {
      const w = wrapHemOf({ wrap });
      for (let v = 0; v <= 1; v += 0.1) expect(wrapHemEdge(w, v)).toBeLessThan(0);
      // càng xuống gấu càng lệch về bên phải, không quay lại giữa
      expect(wrapHemEdge(w, 1)).toBeLessThanOrEqual(wrapHemEdge(w, 0));
    }
  });

  it("vạt dài dưới thân áo cổ chéo: mép vạt nối liền mép áo", () => {
    const own = { ...LONG, wrap: { overlap: 10, slant: 0 } };
    expect(wrapHemEdge(wrapHemOf(matchWrap(LONG, { style: "wrap" })), 0)).toBe(
      -WrapSchema.parse({}).overlap,
    );
    expect(
      wrapHemOf(matchWrap(LONG, { style: "wrap", wrap: WrapSchema.parse({ overlap: 30 }) }))
        .overlap,
    ).toBe(30);
    expect(matchWrap(own, { style: "wrap" })).toBe(own);
    expect(matchWrap(LONG, { style: "shirt" })).toBe(LONG);
  });

  it("vải buông thẳng từ dây cạp khi người khuất sau mép trên, phủ lên đùi rồi rời ở gối khi ngồi", () => {
    const body: [number, number][] = [
      [20, -27],
      [24, 0],
      [18, 80],
      [-20, 80],
      [-24, 0],
    ];
    const hang = drape([28, -27], body);
    expect(hang).toEqual([[28, -27]]);
    expect(drapeAt(hang, 50)).toEqual([28, 23]);
    // đùi ngang ra trước: mặt trên đùi thấp hơn cạp, gối ở 80
    const lap: [number, number][] = [
      [20, -27],
      [0, -18],
      [80, -14],
      [92, 0],
      [80, 14],
      [-20, 14],
    ];
    const path = drape([24, -27], lap);
    expect(path.map(([z]) => z)).toEqual([24, 80, 92]);
    // đùi cao hơn dây cạp: vải lên trùm qua rồi phủ tới gối
    const up = drape(
      [24, -27],
      lap.map(([z, y]): [number, number] => [z, y - 15]),
    );
    expect(up[1][0]).toBe(24);
    expect(up[1][1]).toBeLessThan(-29);
    expect(up[up.length - 1][0]).toBe(92);
    // sau đỉnh cuối vải rủ thẳng
    const [z, y] = drapeAt(path, 1000);
    expect(z).toBe(92);
    expect(y).toBeGreaterThan(0);
  });

  it("tạp dề không làm tay choãi, vạt dài thì có", () => {
    const rig = { stroke: 12, height: 1, shoulderHalf: 40, shoulderDrop: 0, hipHalf: 22 };
    const b = { clad: true, sleeve: 15, trouser: 17 };
    const bare = roots3({ style: "shirt" }, rig, b).splay;
    const apron = SkirtSchema.parse({ style: "apron", length: 100 });
    expect(roots3({ style: "shirt" }, rig, { ...b, skirt: apron }).splay).toBe(bare);
    expect(roots3({ style: "shirt" }, rig, { ...b, skirt: LONG }).splay).toBeGreaterThan(bare);
  });
});

describe("vạt áo người ngồi", () => {
  const body = (hem: number) => {
    const pr: [number, number][] = [];
    for (let y = -120; y <= hem; y += 4) pr.push([40, y]);
    if (pr[pr.length - 1][1] !== hem) pr.push([40, hem]);
    return { pr, depth: pr.map(() => 25) };
  };
  const lap = { seat: 12, fold: { top: -14, dir: [-0.1, 1] as [number, number] } };

  it("gấu ngắn: nửa trước không trải ra trước, dừng ở đường gập", () => {
    const { pr, depth } = body(LAP_FLAP - 8);
    const [x, y, z] = lapFold(pr, depth, lap)([0, LAP_FLAP - 8, 25]);
    expect([x, z]).toEqual([0, 25]);
    expect(y).toBeLessThanOrEqual(lap.fold.top + 25 * -0.1 + 1e-9);
  });

  it("gấu dài: nửa trước gập thành vạt nằm dọc đùi", () => {
    const { pr, depth } = body(LAP_FLAP + 20);
    const [, , z] = lapFold(pr, depth, lap)([0, LAP_FLAP + 20, 25]);
    expect(z).toBeGreaterThan(25 + LAP_FLAP);
  });
});
