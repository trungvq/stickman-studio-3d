import { describe, expect, it } from "vitest";

import { parseAction, type ActionData } from "./index";
import { computeFigure } from "./index";
import { defaultCharacter } from "./index";
import {
  migrateScene,
  parseScene,
  resolveScene,
  sceneAt,
  type SceneData,
  type SceneRuntime,
} from "./index";

/** Cảnh thô qua zod; JSON sai là hỏng ngay trong test chứ không lặng lẽ lấy mặc định */
function parsed(json: unknown): SceneData {
  const r = parseScene(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}

/** Cảnh không clip nào nên không cần bảng hành động */
const run = (json: unknown): SceneRuntime => resolveScene(parsed(json), {});

const LENS = { eye: [0, -250, -1400], yaw: 0, pitch: 0, f: 800 };
const WORLD = { at: [0, 0, 400] };

describe("cảnh không người", () => {
  it("`cast` rỗng có `duration` thì dựng được", () => {
    const rt = run({ duration: 3, cast: [] });
    expect(rt.cast).toEqual([]);
    expect(rt.duration).toBe(3);
  });

  it("`cast` rỗng thiếu `duration` thì dài `0`", () => {
    expect(run({}).duration).toBe(0);
  });

  it("có người mà thiếu `lens` là lỗi", () => {
    expect(() => run({ cast: [{ id: "a", world: WORLD }] })).toThrow("phải có `lens`");
  });

  it("`id` trùng", () => {
    expect(() =>
      run({
        lens: LENS,
        cast: [
          { id: "a", world: WORLD },
          { id: "a", world: WORLD },
        ],
      }),
    ).toThrow("`id` trùng: `a`");
  });
});

describe("`cast[].base` với `stretch` từng đoạn", () => {
  const ngoi = {
    legFar: [82, -82],
    legNear: [82, -82],
    stretch: [1, 1, 1, 1, 0.75, 1.19, 0.75, 1.19],
  };
  const go = parseAction({
    mask: ["armFar", "armNear", "stretch"],
    keys: [{ t: 0, pose: { armFar: [34, 58, 0], armNear: [38, 54, 0], stretch: [0.9, 1, 1, 1] } }],
  });
  if (!go.success) throw new Error(go.error.message);

  it("tám số nạp được, bốn số trải ra tám", () => {
    const rt = run({
      lens: LENS,
      cast: [
        { id: "a", base: ngoi, world: WORLD },
        { id: "b", base: { stretch: [1.2, 1, 1, 1] }, world: WORLD },
      ],
    });
    const a = sceneAt(rt, "a", 0).pose;
    expect(a.stretch).toEqual(ngoi.stretch);
    expect(Math.abs(computeFigure(defaultCharacter(), a).lowest - 118)).toBeLessThan(0.5);
    expect(sceneAt(rt, "b", 0).pose.stretch).toEqual([1.2, 1.2, 1, 1, 1, 1, 1, 1]);
  });

  it("clip chỉ ghi tay vươn tay, không xoá hệ số chân của `base`", () => {
    const rt = resolveScene(
      parsed({
        lens: LENS,
        cast: [
          {
            id: "a",
            base: ngoi,
            world: WORLD,
            tracks: [{ clips: [{ action: "go", start: 0, blend: 0 }] }],
          },
        ],
      }),
      { go: go.data },
    );
    expect(sceneAt(rt, "a", 0.5).pose.stretch).toEqual([0.9, 0.9, 1, 1, 0.75, 1.19, 0.75, 1.19]);
  });
});

describe("đầu khi nói không xoá hướng nhìn", () => {
  const act = (j: unknown): ActionData => {
    const r = parseAction(j);
    if (!r.success) throw new Error(r.error.message);
    return r.data;
  };
  const ACTS = {
    "look-camera": act({
      name: "look-camera",
      duration: 0.4,
      end: "hold",
      mask: ["head"],
      keys: [{ t: 0, pose: { head: [null, -29, null] }, ease: "linear" }],
    }),
    "talk-tilt": act({
      name: "talk-tilt",
      duration: 0.5,
      end: "hold",
      mask: ["head"],
      keys: [
        { t: 0, pose: { head: [0, null, null] }, ease: "smooth" },
        { t: 1, pose: { head: [10, null, null] }, ease: "linear" },
      ],
    }),
    "talk-beat": act({
      name: "talk-beat",
      duration: 0.45,
      end: "hold",
      mask: ["torso", "head"],
      keys: [
        { t: 0, pose: { torso: 0, head: [null, null, 0] }, ease: "smooth" },
        { t: 1, pose: { torso: 4, head: [null, null, 2] }, ease: "linear" },
      ],
    }),
  };
  const head = (order: string[]) =>
    sceneAt(
      resolveScene(
        parsed({
          lens: LENS,
          cast: [
            {
              id: "a",
              world: WORLD,
              tracks: order.map((action) => ({ clips: [{ action, start: 0, blend: 0 }] })),
            },
          ],
        }),
        ACTS,
      ),
      "a",
      2,
    ).pose.head;

  it.each([
    [["look-camera", "talk-tilt", "talk-beat"]],
    [["talk-beat", "talk-tilt", "look-camera"]],
    [["talk-tilt", "look-camera", "talk-beat"]],
  ])("thứ tự %j: nghiêng của talk-tilt, lắc của look-camera, gật của talk-beat", (order) => {
    expect(head(order)).toEqual([10, -29, 2]);
  });

  it("hoà vào và nhả ra không đụng góc lắc", () => {
    const rt = resolveScene(
      parsed({
        lens: LENS,
        cast: [
          {
            id: "a",
            world: WORLD,
            tracks: [
              { clips: [{ action: "look-camera", start: 0, blend: 0 }] },
              {
                clips: [
                  { action: "talk-tilt", start: 0.5, blend: 0.3 },
                  { start: 1.5, blend: 0.4 },
                ],
              },
            ],
          },
        ],
      }),
      ACTS,
    );
    for (let t = 0; t <= 2.5; t += 0.05) {
      const h = sceneAt(rt, "a", t).pose.head;
      expect(h[1]).toBe(-29);
      h.forEach((v) => expect(Number.isFinite(v)).toBe(true));
    }
    expect(sceneAt(rt, "a", 1.4).pose.head[0]).toBe(10);
    expect(sceneAt(rt, "a", 2.5).pose.head[0]).toBe(0);
  });
});

describe("cảnh đời trước 36", () => {
  it("bỏ động vật, `mount`, `carry`, đạo cụ và `sit`", () => {
    const old = {
      schemaVersion: 34,
      lens: LENS,
      cast: [{ id: "a", mount: { on: "b" }, carry: [], sit: { in: "p" }, world: WORLD }],
      animals: [{ id: "b", animal: "ngua" }],
      props: [{ id: "p", prop: "xe", follow: "b", anchor: "saddle" }],
    };
    const o = migrateScene(old) as Record<string, unknown>;
    expect(o.animals).toBeUndefined();
    expect(o.props).toBeUndefined();
    expect(o.cast).toEqual([{ id: "a", world: WORLD }]);
    expect(parseScene(old).success).toBe(true);
  });
});
