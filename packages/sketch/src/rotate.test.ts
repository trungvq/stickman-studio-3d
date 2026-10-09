import { describe, expect, it } from "vitest";

import { anchorAt } from "./anchor";
import {
  defaultAnimal,
  defaultProp,
  migrateScene,
  parseScene,
  type PropData,
  resolveScene,
  sceneAt,
  type SceneRuntime,
} from "@stickman3d/rig/core";

const GROUND = 260;
const PROPS: Record<string, PropData> = { xe: { ...defaultProp(), seat: { x: 0, y: -120 } } };

function run(json: Record<string, unknown>): SceneRuntime {
  const r = parseScene(json);
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(r.data, {}, { ngua: defaultAnimal() }, PROPS);
}

const lying = (extra: Record<string, unknown> = {}) =>
  run({ cast: [{ id: "a", x: 100, view: "side", rotate: 90, ...extra }] });

describe("cast[].rotate", () => {
  it("bỏ trống là đứng thẳng, sceneAt trả `0`", () => {
    expect(sceneAt(run({ cast: [{ id: "a" }] }), "a", 0).rotate).toBe(0);
  });

  it("scene đời trước nâng lên mà không thêm gì", () => {
    const o = migrateScene({ schemaVersion: 21, cast: [{ id: "a" }] }) as {
      cast: Record<string, unknown>[];
    };
    expect(o.cast[0].rotate).toBeUndefined();
  });

  it("`90` là nằm ngửa: chân ở gốc, đầu sang phía sau lưng, cả người nằm trên đường gốc", () => {
    const rt = lying();
    const head = anchorAt(rt, "a", "head", 0);
    const hip = anchorAt(rt, "a", "hip", 0);
    const foot = anchorAt(rt, "a", "footNear", 0);
    // Người nhìn `+x`: chân quét về phía mặt, đầu về `−x`
    expect(head.x).toBeLessThan(hip.x);
    expect(hip.x).toBeLessThan(foot.x);
    expect(foot.x).toBeCloseTo(100, 0);
    // Trục thân nằm ngang trên `groundY`; mặt (`face`) hướng lên trần
    expect(Math.abs(hip.y - GROUND)).toBeLessThan(5);
    expect(anchorAt(rt, "a", "face", 0).y).toBeLessThan(head.y);
  });

  it("`flip` lật gương cả người nằm: đầu sang phải, vẫn nằm ngửa", () => {
    const a = lying();
    const b = lying({ flip: true });
    for (const name of ["head", "hip", "footNear", "face", "wristNear"] as const) {
      const p = anchorAt(a, "a", name, 0);
      const q = anchorAt(b, "a", name, 0);
      expect(q.x - 100).toBeCloseTo(100 - p.x, 6);
      expect(q.y).toBeCloseTo(p.y, 6);
      expect(q.deg).toBeCloseTo(-p.deg, 6);
    }
    expect(anchorAt(b, "a", "face", 0).y).toBeLessThan(anchorAt(b, "a", "head", 0).y);
  });

  it("`-90` là nằm sấp: mặt úp xuống", () => {
    const rt = lying({ rotate: -90 });
    expect(anchorAt(rt, "a", "face", 0).y).toBeGreaterThan(anchorAt(rt, "a", "head", 0).y);
  });

  it("góc của mốc cộng thêm đúng góc xoay (độ SVG ngược chiều rig)", () => {
    const up = anchorAt(lying({ rotate: 0 }), "a", "torso", 0);
    const down = anchorAt(lying(), "a", "torso", 0);
    expect(down.deg - up.deg).toBeCloseTo(-90, 6);
  });

  it("không đi cùng `mount` hay `sit`", () => {
    expect(() =>
      run({
        cast: [{ id: "a", rotate: 90, sit: { in: "xe" } }],
        props: [{ id: "xe", prop: "xe" }],
      }),
    ).toThrow(/rotate/);
  });

  it('`base: "lie"` nâng sau đầu lên trên lưng, gót và lưng cùng một mặt nệm', () => {
    const flat = lying();
    const lie = lying({ base: "lie" });
    const back = (rt: SceneRuntime) => {
      const h = anchorAt(rt, "a", "head", 0);
      return h.y + h.h / 2;
    };
    // Nằm thẳng thì sau đầu tụt dưới nệm (thấp hơn gót); `lie` nhổm đầu lên trên đường hông
    expect(back(flat)).toBeGreaterThan(anchorAt(flat, "a", "footNear", 0).y);
    expect(back(lie)).toBeLessThan(anchorAt(lie, "a", "footNear", 0).y - 20);
    expect(anchorAt(lie, "a", "hip", 0).y).toBeCloseTo(GROUND, 6);
  });

  it("ngoài `[-180, 180]` là lỗi schema", () => {
    expect(parseScene({ cast: [{ id: "a", rotate: 270 }] }).success).toBe(false);
  });
});
