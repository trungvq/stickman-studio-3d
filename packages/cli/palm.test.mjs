import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { palmFrame } from "./lib.mjs";

const v = (x, y, z) => ({ x, y, z });
/** Hộp lồi (three) `[x0, x1] × [y0, y1] × [z0, z1]`, mặt trên nghiêng theo `slope` (dy / dx) */
const box = (name, [x0, x1], [y0, y1], [z0, z1], slope = 0, extra = {}) => {
  const n = Math.hypot(slope, 1);
  const up = { normal: v(-slope / n, 1 / n, 0), constant: -(y1 / n) };
  return {
    name,
    box: { min: v(x0, y0, z0), max: v(x1, y1 + Math.abs(slope) * (x1 - x0), z1) },
    planes: [
      up,
      { normal: v(0, -1, 0), constant: y0 },
      { normal: v(1, 0, 0), constant: -x1 },
      { normal: v(-1, 0, 0), constant: x0 },
      { normal: v(0, 0, 1), constant: -z1 },
      { normal: v(0, 0, -1), constant: z0 },
    ],
    ...extra,
  };
};
const tri = (name, y, extra = {}) => ({
  name,
  box: { min: v(2, y, 0), max: v(3, y, 1) },
  tris: new Float32Array([2, y, 0, 3, y, 0, 2, y, 1]),
  ...extra,
});
const world = (cols, posed = {}) => ({
  scene: { root: { updateMatrixWorld() {} }, pose: () => posed },
  colliders: () => cols,
  U: 0.01,
});

describe("palmFrame: mặt ngang dưới bàn tay trên cảnh three", () => {
  const own = {};
  const cols = [
    box("quay", [0, 1], [0, 0.8], [0, 1]),
    box("doc", [4, 5], [0, 0.8], [0, 1], 2),
    tri("so", 0.9),
    box("nguoi-nen", [6, 7], [0, 0.8], [0, 1], 0, { from: { userData: { crowd: true } } }),
    box("khay", [8, 9], [0, 0.8], [0, 1], 0, { owner: own }),
  ];
  const fr = palmFrame(
    0,
    world(cols, { a: { root: own, hands: { [-1]: { held: "grip" }, 1: {} } } }),
  );
  const at = (x, h, z = 50) => fr.surface("a", [x, -h, -z]);

  it("khối lồi: khe từ điểm tới mặt trên, lún là âm; ngoài mặt chiếu thì không có", () => {
    assert.equal(at(50, 85).name, "quay");
    assert.ok(Math.abs(at(50, 85).gap - 5) < 1e-9);
    assert.ok(Math.abs(at(50, 77).gap + 3) < 1e-9);
    assert.equal(at(150, 85), null);
  });

  it("mặt cao hơn điểm quá `PALM_SINK` thì lấy mặt thấp hơn dưới nó", () => {
    assert.equal(at(50, 60), null);
  });

  it("lưới tam giác: tam giác nằm ngang chứa điểm", () => {
    assert.equal(at(220, 95, 20).name, "so");
    assert.ok(Math.abs(at(220, 95, 20).gap - 5) < 1e-4);
  });

  it("mặt dốc không phải mặt ngang; người nền đóng băng và đồ người ấy mang bị bỏ", () => {
    assert.equal(at(450, 300), null);
    assert.equal(at(650, 85), null);
    assert.equal(at(850, 85), null);
  });

  it("tay cầm đồ theo bàn tay three; người không có trong `pose(t)` là người đóng băng", () => {
    assert.equal(fr.held("a", "R"), true);
    assert.equal(fr.held("a", "L"), false);
    assert.equal(fr.held("b", "R"), undefined);
    assert.equal(fr.frozen("a"), false);
    assert.equal(fr.frozen("b"), true);
  });
});
