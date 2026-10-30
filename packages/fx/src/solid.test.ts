import { describe, expect, it } from "vitest";

import { D, depthAt, orbit } from "@stickman3d/rig/core";
import { box, itemSolids, meets } from "./solid";

const TONE = { top: "#a00", lit: "#0a0", side: "#00a" };

describe("itemSolids: ống kính đứng trong lòng món", () => {
  // mặt bục rộng, ống kính đứng ngay trên mép trước: nửa bục nằm sau mặt phẳng ống kính
  const lens = orbit({ target: [200, -270, 0], dist: 370, yaw: 60 * D, pitch: 7 * D, f: 800 });
  const bucSan = box(-640, 640, -54, 0, -180, 465);

  it("ca thử có đỉnh khối sau ống kính", () => {
    expect(Math.min(...bucSan.map((p) => depthAt(lens, p)))).toBeLessThan(0);
  });

  it("chặt khối ở mặt phẳng ống kính thay vì bỏ cả khối", () => {
    const ss = itemSolids({ parts: [{ v: bucSan, tone: TONE }], at: { at: [0, 0, 0] } }, lens);
    expect(ss).toHaveLength(1);
    expect(Math.min(...ss[0].v.map((p) => depthAt(lens, p)))).toBeGreaterThan(0.99);
    // mặt trên còn, mép chặt không có viền
    const top = ss[0].f.find((f) => !f.cap && f.n[1] < -0.5)!;
    expect(top.e.some((e) => !e)).toBe(true);
  });

  it("khối nằm hẳn sau ống kính thì bỏ", () => {
    const v = box(-640, -600, -54, 0, -180, -150);
    const ss = itemSolids({ parts: [{ v, tone: TONE }], at: { at: [0, 0, 0] } }, lens);
    expect(ss).toHaveLength(0);
  });
});

describe("meets: bao lồi có cạnh gần như không dài", () => {
  // mặt bục chặt ở t03-s43-coffee 3,5 s: hai đỉnh lệch nhau 1e-13, ống chân ミサキ nằm trong bóng mặt bục
  const piece = [
    [-624.390243902439, 239.02439024390242],
    [-508.5707197088547, 157.58878729528845],
    [364.11696739042816, 56.019742696394815],
    [364.1169673904283, 56.01974269639487],
    [624.390243902439, 239.02439024390242],
    [624.390243902439, 291.7073170731707],
    [-624.390243902439, 291.7073170731707],
  ];
  const shin = [
    [218.56732555890505, 51.761938666000475],
    [224.893573080821, 51.68356174341824],
    [226.68623923449027, 53.6110676081266],
    [227.7197518777615, 119.11351830425212],
    [221.33666101849082, 119.19268146285458],
    [219.58454990615576, 116.7441012606302],
  ];

  it("không lấy cạnh suy biến làm trục tách", () => {
    expect(meets(piece, shin)).toBe(true);
    expect(meets(shin, piece)).toBe(true);
  });

  it("vẫn tách hai bóng rời nhau", () => {
    expect(
      meets(
        piece,
        shin.map(([x, y]) => [x, y - 200]),
      ),
    ).toBe(false);
  });
});
