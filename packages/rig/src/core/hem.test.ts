import { describe, expect, it } from "vitest";

import {
  D,
  drape,
  drapeAt,
  drapeFloor,
  drapeLength,
  hemHang,
  hemReach,
  kneelOn,
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
    // lưng sau dây cạp cao hơn chỗ vải bắt đầu: vải vẫn phủ tới gối, không vòng ra sau lưng
    const back = drape(
      [24, -27],
      [...lap.map(([z, y]): [number, number] => [z, y - 15]), [-30, -33]],
    );
    expect(back.map(([z]) => z)).toEqual(up.map(([z]) => z));
    // sau đỉnh cuối vải rủ thẳng
    const [z, y] = drapeAt(path, 1000);
    expect(z).toBe(92);
    expect(y).toBeGreaterThan(0);
  });

  it("thân ngả trước, cạp kẹt giữa bụng và đùi: vải theo mặt bụng ra khỏi mặt cắt, không đi thẳng lên", () => {
    // đùi chéo xuống trước, cạp ở `[30, 10]` nằm trong mặt cắt
    const thigh: [number, number][] = [
      [-10, -20],
      [10, -22],
      [80, 15],
      [85, 40],
      [70, 50],
      [0, 20],
    ];
    const top: [number, number] = [30, 10];
    const up: [number, number] = [Math.sin(0.9), -Math.cos(0.9)];
    const path = drape(top, thigh, up);
    expect(path[0]).toEqual(top);
    // đi theo `up` tới mép mặt cắt, rồi xuống theo mặt trên đùi tới gối
    const [z1, y1] = path[1];
    expect((z1 - top[0]) * up[1] - (y1 - top[1]) * up[0]).toBeCloseTo(0, 6);
    expect(y1).toBeLessThan(top[1]);
    expect(z1).toBeGreaterThan(top[0]);
    expect(path[path.length - 1][0]).toBe(85);
    // thân đứng thẳng: như không có `up`
    expect(drape(top, thigh, [0, -1])).toEqual(drape(top, thigh));
    // cạp ở ngoài mặt cắt: `up` ngả trước không đổi gì
    const out: [number, number] = [40, -40];
    expect(drape(out, thigh, up)).toEqual(drape(out, thigh));
  });

  it("vải chạm sàn: cắt ở sàn, nằm trên sàn tiến ra trước có hạn, góc gập bo", () => {
    const path: [number, number][] = [
      [24, -27],
      [80, -14],
      [92, 0],
    ];
    // buông thẳng từ đỉnh cuối xuống sàn ở 40
    const f = drapeFloor(path, 40, 8, 20);
    expect(f.slice(0, 3)).toEqual(path);
    for (const [, y] of f) expect(y).toBeLessThanOrEqual(40);
    expect(f[f.length - 1][0]).toBeCloseTo(112, 9);
    expect(f[f.length - 1][1]).toBeCloseTo(40, 9);
    expect(drapeLength(f)).toBeLessThan(drapeLength(path) + 40 + 20);
    expect(drapeLength(f)).toBeGreaterThan(drapeLength(path) + 40 + 20 - 4);
    // vải dài hơn thì dừng ở mút, không rủ xuống dưới sàn
    const [z, y] = drapeAt(f, drapeLength(f));
    expect(z).toBeCloseTo(112, 6);
    expect(y).toBeCloseTo(40, 6);
    // đường vải cắt sàn: dừng ở chỗ cắt rồi nằm sàn
    const cut = drapeFloor(path, -7, 8, 20);
    expect(cut[cut.length - 1]).toEqual([106, -7]);
    expect(Math.max(...cut.map((p) => p[1]))).toBeLessThanOrEqual(-7 + 1e-9);
  });

  it("quỳ: gối sát sàn và ống chân chĩa ra sau; đứng, ngồi ghế, duỗi chân trên sàn thì không", () => {
    const leg = (knee: [number, number, number], foot: [number, number, number]) => ({
      knee,
      foot,
    });
    // sàn ở 90, bán kính gối 8
    expect(kneelOn([leg([0, 82, 10], [0, 70, -88])], 90, 8)).toBe(1);
    expect(kneelOn([leg([0, 80, 0], [0, 170, 0])], 180, 8)).toBe(0);
    expect(kneelOn([leg([0, 0, 78], [0, 80, 78])], 120, 8)).toBe(0);
    expect(kneelOn([leg([0, 82, 78], [0, 82, 170])], 90, 8)).toBe(0);
    // gối nhấc dần khỏi sàn: giảm dần về 0
    const k = [5, 15, 22, 30].map((d) => kneelOn([leg([0, 82 - d, 10], [0, 70 - d, -88])], 90, 8));
    expect(k[0]).toBe(1);
    for (let i = 1; i < k.length; i++) expect(k[i]).toBeLessThan(k[i - 1]);
    expect(k[3]).toBe(0);
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
