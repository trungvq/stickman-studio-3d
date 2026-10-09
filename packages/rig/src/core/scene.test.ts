import { describe, expect, it } from "vitest";

import lookCameraJson from "../../../../apps/studio/public/actions/look-camera.json";
import talkBeatJson from "../../../../apps/studio/public/actions/talk-beat.json";
import talkTiltJson from "../../../../apps/studio/public/actions/talk-tilt.json";
import { parseAction, type ActionData } from "./index";
import { defaultAnimal, type AnimalData } from "./index";
import { computeFigure } from "./index";
import { defaultProp, type PropData } from "./index";
import { defaultCharacter } from "./index";
import {
  SCENE_Z,
  animalAt,
  parseScene,
  propAt,
  resolveScene,
  sceneAt,
  sceneOrder,
  type SceneData,
  type SceneRuntime,
} from "./index";

/** Cảnh thô qua zod; JSON sai là hỏng ngay trong test chứ không lặng lẽ lấy mặc định */
function parsed(json: unknown): SceneData {
  const r = parseScene(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}

const BEASTS: Record<string, AnimalData> = { ngua: defaultAnimal() };
/** Đạo cụ có chỗ ngồi, cho `cast[].sit` */
const PROPS: Record<string, PropData> = { xe: { ...defaultProp(), seat: { x: 0, y: -120 } } };

/** Cảnh không clip nào nên không cần bảng hành động */
const run = (json: unknown): SceneRuntime => resolveScene(parsed(json), {}, BEASTS, PROPS);

const GROUND = 260;

describe("sceneOrder không tách người", () => {
  it("mỗi người một lượt vẽ, không có `parts`", () => {
    const rt = run({ cast: [{ id: "a" }, { id: "b" }], props: [{ id: "p", prop: "xe" }] });
    expect(sceneOrder(rt)).toStrictEqual([
      { kind: "cast", id: "a", z: SCENE_Z.cast },
      { kind: "cast", id: "b", z: SCENE_Z.cast },
      { kind: "prop", id: "p", z: SCENE_Z.propFront },
    ]);
  });
});

describe("zParts", () => {
  it("khối không khai theo `z` của người, đạo cụ xen vào giữa hai băng", () => {
    const rt = run({
      cast: [{ id: "a", zParts: { armNear: 10, head: 10 } }],
      props: [{ id: "p", prop: "xe", z: 5 }],
    });
    expect(sceneOrder(rt)).toStrictEqual([
      {
        kind: "cast",
        id: "a",
        parts: ["legFar", "shinFar", "legNear", "shinNear", "torso", "armFar", "forearmFar"],
        z: 0,
      },
      { kind: "prop", id: "p", z: 5 },
      { kind: "cast", id: "a", parts: ["armNear", "forearmNear", "head"], z: 10 },
    ]);
  });

  it("khối khai `z` âm chui xuống dưới, băng sắp theo `z` chứ không theo thứ tự khai", () => {
    const rt = run({ cast: [{ id: "a", z: 4, zParts: { head: -2, armFar: 9 } }] });
    expect(sceneOrder(rt)).toStrictEqual([
      { kind: "cast", id: "a", parts: ["head"], z: -2 },
      {
        kind: "cast",
        id: "a",
        parts: ["legFar", "shinFar", "legNear", "shinNear", "torso", "armNear", "forearmNear"],
        z: 4,
      },
      { kind: "cast", id: "a", parts: ["armFar", "forearmFar"], z: 9 },
    ]);
  });

  it("cụm `follow` bám băng ở `z` của chính người, không bám băng tách ra", () => {
    const rt = run({
      cast: [{ id: "a", zParts: { head: 10 } }],
      props: [
        { id: "sau", prop: "xe", follow: "a", layer: "back" },
        { id: "truoc", prop: "xe", follow: "a", layer: "front" },
      ],
    });
    expect(sceneOrder(rt)).toStrictEqual([
      { kind: "prop", id: "sau", z: 0 },
      {
        kind: "cast",
        id: "a",
        parts: [
          "legFar",
          "shinFar",
          "legNear",
          "shinNear",
          "torso",
          "armFar",
          "forearmFar",
          "armNear",
          "forearmNear",
        ],
        z: 0,
      },
      { kind: "prop", id: "truoc", z: 0 },
      { kind: "cast", id: "a", parts: ["head"], z: 10 },
    ]);
  });

  it("dồn hết khối đi nơi khác thì băng của người rỗng nhưng vẫn còn", () => {
    const rt = run({
      cast: [
        { id: "a", zParts: { legFar: 3, legNear: 3, torso: 3, armFar: 3, armNear: 3, head: 3 } },
      ],
    });
    expect(sceneOrder(rt)).toStrictEqual([
      { kind: "cast", id: "a", parts: [], z: 0 },
      {
        kind: "cast",
        id: "a",
        parts: [
          "legFar",
          "shinFar",
          "legNear",
          "shinNear",
          "torso",
          "armFar",
          "forearmFar",
          "armNear",
          "forearmNear",
          "head",
        ],
        z: 3,
      },
    ]);
  });

  it("cẳng tay khai riêng thì tách khỏi khúc trên, khai `arm*` thôi thì cẳng tay theo", () => {
    const rt = run({ cast: [{ id: "a", zParts: { forearmFar: 3, armNear: 3 } }] });
    expect(sceneOrder(rt)).toStrictEqual([
      {
        kind: "cast",
        id: "a",
        parts: ["legFar", "shinFar", "legNear", "shinNear", "torso", "armFar", "head"],
        z: 0,
      },
      { kind: "cast", id: "a", parts: ["forearmFar", "armNear", "forearmNear"], z: 3 },
    ]);
  });

  it("ống chân khai riêng thì tách khỏi đùi, khai `leg*` thôi thì ống chân theo", () => {
    const rt = run({
      cast: [{ id: "a", z: 30, zParts: { legNear: 30, shinNear: 10, legFar: 40 } }],
      props: [{ id: "ghe", prop: "xe", z: 20 }],
    });
    expect(sceneOrder(rt)).toStrictEqual([
      { kind: "cast", id: "a", parts: ["shinNear"], z: 10 },
      { kind: "prop", id: "ghe", z: 20 },
      {
        kind: "cast",
        id: "a",
        parts: ["legNear", "torso", "armFar", "forearmFar", "armNear", "forearmNear", "head"],
        z: 30,
      },
      { kind: "cast", id: "a", parts: ["legFar", "shinFar"], z: 40 },
    ]);
  });

  it("không đi cùng `mount`", () => {
    expect(() =>
      run({
        cast: [{ id: "a", zParts: { head: 1 }, mount: { on: "b" } }],
        animals: [{ id: "b", animal: "ngua" }],
      }),
    ).toThrow("`zParts` không đi cùng `mount` hay `sit`");
  });

  it("không đi cùng `sit`", () => {
    expect(() =>
      run({
        cast: [{ id: "a", zParts: { head: 1 }, sit: { in: "p" } }],
        props: [{ id: "p", prop: "xe" }],
      }),
    ).toThrow("`zParts` không đi cùng `mount` hay `sit`");
  });
});

describe("nhóm gấp chỗ đứng vào thành viên", () => {
  const rt = run({
    duration: 2,
    groups: [{ id: "g", x: 100, y: 300, scale: 0.5, flip: true, z: 7 }],
    cast: [{ id: "a", group: "g", x: 40, y: 10, scale: 2 }],
    props: [{ id: "p", prop: "xe", group: "g", x: -20, y: 6, scale: 3, flip: true }],
    animals: [{ id: "c", animal: "ngua", group: "g", x: 80, flip: true }],
  });

  it("người: `x` lật quanh `x` của nhóm, `y` cộng vào đường đất nhóm, `scale` nhân", () => {
    const at = sceneAt(rt, "a", 0);
    expect(at.x).toBeCloseTo(80, 12);
    expect(at.groundY).toBeCloseTo(305, 12);
    expect(at.scale).toBeCloseTo(1, 12);
    expect(at.flip).toBe(true);
  });

  it("đạo cụ: cùng phép gấp, `flip` cộng dồn với nhóm", () => {
    const at = propAt(rt, "p", 0);
    expect(at.x).toBeCloseTo(110, 12);
    expect(at.groundY).toBeCloseTo(303, 12);
    expect(at.scale).toBeCloseTo(1.5, 12);
    expect(at.flip).toBe(false);
  });

  it("động vật: `y` bỏ trống là đúng đường đất của nhóm", () => {
    const at = animalAt(rt, "c", 0);
    expect(at.x).toBeCloseTo(60, 12);
    expect(at.groundY).toBeCloseTo(300, 12);
    expect(at.scale).toBeCloseTo(0.5, 12);
    expect(at.flip).toBe(false);
  });

  it("nhóm không khai `y` thì đứng lên đường đất của cảnh", () => {
    const r = run({
      groups: [{ id: "g", x: 10 }],
      cast: [{ id: "a", group: "g", x: 5 }],
    });
    const at = sceneAt(r, "a", 0);
    expect(at.x).toBeCloseTo(15, 12);
    expect(at.groundY).toBeCloseTo(GROUND, 12);
  });

  it("`path` gấp từng mốc như chỗ đứng", () => {
    const r = run({
      duration: 2,
      groups: [{ id: "g", x: 100, y: 300, scale: 0.5, flip: true }],
      cast: [
        {
          id: "a",
          group: "g",
          path: [
            { t: 0, x: 20, y: 4 },
            { t: 2, x: 60, y: 4 },
          ],
        },
      ],
    });
    expect(sceneAt(r, "a", 0).x).toBeCloseTo(90, 12);
    expect(sceneAt(r, "a", 1).x).toBeCloseTo(80, 12);
    expect(sceneAt(r, "a", 2).x).toBeCloseTo(70, 12);
    expect(sceneAt(r, "a", 1).groundY).toBeCloseTo(302, 12);
    expect(sceneAt(r, "a", 1).scale).toBeCloseTo(0.5, 12);
  });
});

describe("nhóm là một mục trên trục z của sân khấu", () => {
  it("cả nhóm A dưới cả nhóm B, `z` cục bộ của thành viên không với ra ngoài", () => {
    const rt = run({
      groups: [
        { id: "A", z: -10 },
        { id: "B", z: 10 },
      ],
      cast: [
        { id: "a1", group: "A", z: 100 },
        { id: "a2", group: "A", z: -100 },
        { id: "b1", group: "B", z: 100 },
        { id: "b2", group: "B", z: -100 },
        { id: "u" },
      ],
    });
    expect(sceneOrder(rt)).toStrictEqual([
      { kind: "cast", id: "a2", z: -10 },
      { kind: "cast", id: "a1", z: -10 },
      { kind: "cast", id: "u", z: 0 },
      { kind: "cast", id: "b2", z: 10 },
      { kind: "cast", id: "b1", z: 10 },
    ]);
  });

  it("trong nhóm thì đạo cụ và băng `zParts` vẫn sắp theo `z` cục bộ, `z` ra ngoài là của nhóm", () => {
    const rt = run({
      groups: [{ id: "g", z: 7 }],
      cast: [{ id: "a", group: "g", zParts: { head: 10 } }],
      props: [{ id: "p", prop: "xe", group: "g", z: 5 }],
    });
    expect(sceneOrder(rt)).toStrictEqual([
      {
        kind: "cast",
        id: "a",
        parts: [
          "legFar",
          "shinFar",
          "legNear",
          "shinNear",
          "torso",
          "armFar",
          "forearmFar",
          "armNear",
          "forearmNear",
        ],
        z: 7,
      },
      { kind: "prop", id: "p", z: 7 },
      { kind: "cast", id: "a", parts: ["head"], z: 7 },
    ]);
  });
});

describe("nhóm: chỗ khai sai", () => {
  it("`group` trỏ tới nhóm không có", () => {
    expect(() => run({ cast: [{ id: "a", group: "ma" }] })).toThrow("không có nhóm `ma`");
  });

  it("`id` nhóm trùng `id` thành viên", () => {
    expect(() => run({ groups: [{ id: "a" }], cast: [{ id: "a" }] })).toThrow("`id` trùng: `a`");
  });

  it("đạo cụ vừa `follow` vừa `group`", () => {
    expect(() =>
      run({
        groups: [{ id: "g" }],
        cast: [{ id: "a" }],
        props: [{ id: "p", prop: "xe", follow: "a", group: "g" }],
      }),
    ).toThrow("có `follow` thì đi theo chủ — bỏ `group`");
  });

  it("người đang cưỡi mà khai `group`", () => {
    expect(() =>
      run({
        groups: [{ id: "g" }],
        cast: [{ id: "a", group: "g", mount: { on: "b" } }],
        animals: [{ id: "b", animal: "ngua" }],
      }),
    ).toThrow("đang cưỡi hay ngồi xe thì đi theo chủ — bỏ `group`");
  });

  it("người đang ngồi xe mà khai `group`", () => {
    expect(() =>
      run({
        groups: [{ id: "g" }],
        cast: [{ id: "a", group: "g", sit: { in: "p" } }],
        props: [{ id: "p", prop: "xe" }],
      }),
    ).toThrow("đang cưỡi hay ngồi xe thì đi theo chủ — bỏ `group`");
  });

  it("con vật bị xách mà khai `group`", () => {
    expect(() =>
      run({
        groups: [{ id: "g" }],
        cast: [{ id: "a", carry: [{ animal: "b" }] }],
        animals: [{ id: "b", animal: "ngua", group: "g" }],
      }),
    ).toThrow("`a` đang giữ nó nên nó đi theo người ấy — bỏ `group`");
  });

  it("con vật có người cưỡi mà khai `group`", () => {
    expect(() =>
      run({
        groups: [{ id: "g" }],
        cast: [{ id: "a", mount: { on: "b" } }],
        animals: [{ id: "b", animal: "ngua", group: "g" }],
      }),
    ).toThrow("`a` đang giữ nó nên nó đi theo người ấy — bỏ `group`");
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
      cast: [
        { id: "a", base: ngoi },
        { id: "b", base: { stretch: [1.2, 1, 1, 1] } },
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
        cast: [
          { id: "a", base: ngoi, tracks: [{ clips: [{ action: "go", start: 0, blend: 0 }] }] },
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
    "look-camera": act(lookCameraJson),
    "talk-tilt": act(talkTiltJson),
    "talk-beat": act(talkBeatJson),
  };
  const head = (order: string[]) =>
    sceneAt(
      resolveScene(
        parsed({
          cast: [
            {
              id: "a",
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
        cast: [
          {
            id: "a",
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
