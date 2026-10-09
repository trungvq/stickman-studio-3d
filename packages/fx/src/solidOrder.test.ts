import { describe, expect, it } from "vitest";

import {
  body3,
  D,
  POSES,
  defaultCharacter,
  depthAt,
  dirOf,
  facing,
  handsOn,
  orbit,
  parseAction,
  parseScene,
  resolveScene,
  sceneAt,
  type ArmLayers,
  type BodyPart,
  type Pose,
  type V3,
} from "@stickman3d/sketch";
import { box, solid, type SolidItem } from "./solid";
import { solidOrder } from "./solidOrder";
import { solidFigure } from "./SolidWorld";

const c = defaultCharacter();
const lens = orbit({ target: [0, -120, 0], dist: 750, yaw: 0, pitch: 7 * D, f: 800 });
const hip: V3 = [0, -90, 0];
// chính diện lệch, khoá ở FRONT_MIN
const f = facing(lens, hip, Math.atan2(-lens.eye[2], lens.eye[0]) + 20 * D);
const world = { lens, hip, yaw: f.yaw, s: 1, flip: f.flip, theta: f.theta, floor: 0 };

/** Cánh tay xa đưa nhẹ ra trước: tâm nó ngang độ sâu tâm thân, thân nghiêng `lean`; `hand` là đích cổ tay xa */
function figure(lean: number, layers?: ArmLayers, af: Pose["af"] = [22, 0, 0], hand?: V3) {
  const pose: Pose = { ...POSES.idle, af, torso: lean, lift: { af: true, an: true } };
  const fig = solidFigure("p", {
    character: c,
    pose,
    view: "quarter",
    world: hand ? { ...world, hands: { far: { at: hand, w: 1 } } } : world,
    flip: f.flip,
    layers,
  })!;
  const at = (p: BodyPart) => {
    const v = fig.solids.find((s) => s.part === p)!.v;
    return depthAt(
      lens,
      solid({ v, tone: { top: "", lit: "", side: "" } }, { at: [0, 0, 0] }, lens, 0).c,
    );
  };
  const order = solidOrder(lens, [], [fig]).map((o) => (o.kind === "part" ? o.part : ""));
  return {
    gap: at("armFar") - at("torso"),
    under: order.indexOf("armFar") < order.indexOf("torso"),
    foreUnder: order.indexOf("forearmFar") < order.indexOf("torso"),
  };
}

const LEANS = [-2, -1, 0, 1, 2];

describe("solidOrder: thân với chi cùng người", () => {
  it("ca thử có tâm cánh tay xa đổi phía tâm thân khi thân nghiêng ±2°", () => {
    const gaps = LEANS.map((l) => figure(l).gap);
    expect(Math.min(...gaps)).toBeLessThan(0);
    expect(Math.max(...gaps)).toBeGreaterThan(0);
  });

  it("tay xa `back` nằm dưới thân bất kể nghiêng thân", () => {
    for (const l of LEANS) expect(figure(l).under).toBe(true);
  });

  it("tay xa thõng sau thân: dưới thân dù lớp `front`", () => {
    for (const l of LEANS)
      expect(figure(l, { armFar: "front", armNear: "front" }).under).toBe(true);
  });
});

describe("solidOrder: đoạn tay 3D theo phần nằm trong bóng thân", () => {
  it("vươn thẳng ra trước: gốc sau thân, khuỷu ngoài bóng thân — dưới thân, mọi độ nghiêng", () => {
    for (const l of LEANS)
      expect(figure(l, { armFar: "front", armNear: "front" }, [80, 0, 0]).under).toBe(true);
  });

  it("cổ tay xa trước giữa ngực: cẳng tay trên thân dù lớp `back`, mọi độ nghiêng", () => {
    const F = dirOf(world.yaw);
    const hand: V3 = [hip[0] + 40 * F[0], hip[1] - 60, hip[2] + 40 * F[2]];
    for (const l of LEANS) expect(figure(l, undefined, undefined, hand).foreUnder).toBe(false);
  });

  it("vòng ra sau lưng: dưới thân dù lớp `front`, mọi độ nghiêng", () => {
    for (const l of LEANS)
      expect(figure(l, { armFar: "front", armNear: "front" }, [-70, 0, 0]).under).toBe(true);
  });

  it("ngồi đặt tay lên bàn, khuỷu trên mặt bàn: cánh tay trên xa dưới thân mọi nhịp thở", () => {
    const c = defaultCharacter();
    const deskLens = orbit({ target: [0, -300, 0], dist: 640, yaw: -32 * D, pitch: 9 * D, f: 800 });
    const LENS = { eye: deskLens.eye, yaw: -32, pitch: 9, f: 800, cx: 0, cy: 0 };
    const TOP = -175;
    const AT: V3 = [-120, -100, 250];
    const desk: SolidItem = {
      at: { at: [AT[0], 0, AT[2] - 112], yaw: 90 * D },
      parts: [{ v: box(-62, 62, TOP, TOP + 16, -165, 165), tone: { top: "", lit: "", side: "" } }],
    };
    const sit = parseAction({
      name: "sit",
      duration: 3.4,
      end: "wrap",
      authoredAt: "side",
      mask: ["armFar", "armNear", "legFar", "legNear", "torso"],
      keys: [
        {
          t: 0,
          pose: {
            armFar: [11, 42, 0],
            armNear: [11, 42, 0],
            legFar: [90, -90],
            legNear: [90, -90],
            torso: 3,
          },
        },
        {
          t: 0.5,
          pose: {
            armFar: [12, 42, 0],
            armNear: [12, 42, 0],
            legFar: [90, -90],
            legNear: [90, -90],
            torso: 4,
          },
        },
      ],
    });
    if (!sit.success) throw new Error(sit.error.message);
    const at = (hands?: object) => {
      const r = parseScene({
        lens: LENS,
        duration: 3.4,
        cast: [
          {
            id: "a",
            base: "sit",
            world: { at: AT, yaw: 90, sit: true, ...(hands ? { hands: [hands] } : {}) },
            tracks: [{ clips: [{ action: "sit", start: 0 }] }],
          },
        ],
      });
      if (!r.success) throw new Error(r.error.message);
      const rt = resolveScene(r.data, { sit: sit.data! });
      return (t: number) => sceneAt(rt, "a", t, c.rig.height, body3(c));
    };
    const sp0 = at()(0);
    const on = handsOn(c, sp0.pose, sp0.world!, {
      y: TOP,
      poly: [
        [AT[0] - 165, AT[2] - 174],
        [AT[0] + 165, AT[2] - 174],
        [AT[0] + 165, AT[2] - 50],
        [AT[0] - 165, AT[2] - 50],
      ],
    });
    const seated = at({ t: 0, right: on.right, left: on.left });
    const over = Array.from({ length: 52 }, (_, i) => {
      const fig = solidFigure("a", { character: c, ...seated(i / 15) })!;
      const order = solidOrder(deskLens, [desk], [fig]).flatMap((o) =>
        o.kind === "part" ? [o.part] : [],
      );
      return order.indexOf("armFar") > order.indexOf("torso");
    });
    expect(over.every((o) => !o)).toBe(true);
  });
});

describe("solidOrder: váy trên đùi người ngồi", () => {
  const plain = defaultCharacter();
  const skirted = {
    ...plain,
    pieces: {
      ...plain.pieces,
      hem: {
        ...plain.pieces.hem,
        src: "sculpt" as const,
        layer: "under" as const,
        skirt: { rise: 27, waist: 40, length: 52, flare: 30, pleats: 8 },
      },
    },
  };
  const LENS = { eye: [0, -330, -700] as V3, yaw: 0, pitch: 8, f: 800, cx: 0, cy: 0 };
  const lens = { ...LENS, yaw: 0, pitch: 8 * D };
  const sit = parseAction({
    name: "sit",
    duration: 1,
    authoredAt: "side",
    mask: ["legFar", "legNear", "torso"],
    keys: [{ t: 0, pose: { legFar: [90, -90], legNear: [90, -90], torso: 0 } }],
  });
  if (!sit.success) throw new Error(sit.error.message);
  const TONE = { top: "", lit: "", side: "" };
  const TOP = -175;
  const EDGE = 70;
  // ngồi quay sang trái khung cạnh bàn, đùi chìa vào gầm bàn, hai tay đặt lên mặt bàn
  const seat = (hands?: object) => {
    const r = parseScene({
      lens: LENS,
      duration: 1,
      cast: [
        {
          id: "a",
          base: "sit",
          world: { at: [120, -100, 0], yaw: 180, sit: true, ...(hands ? { hands: [hands] } : {}) },
          tracks: [{ clips: [{ action: "sit", start: 0 }] }],
        },
      ],
    });
    if (!r.success) throw new Error(r.error.message);
    return sceneAt(
      resolveScene(r.data, { sit: sit.data! }),
      "a",
      0,
      plain.rig.height,
      body3(plain),
    );
  };
  const sp0 = seat();
  const on = handsOn(plain, sp0.pose, sp0.world!, {
    y: TOP,
    poly: [
      [-200, -120],
      [EDGE, -120],
      [EDGE, 120],
      [-200, 120],
    ],
  });
  const sp = seat({ t: 0, right: on.right, left: on.left });
  // mặt bàn che đùi, mép bàn còn cách thân: thân không chạm bàn
  const table: SolidItem = {
    at: { at: [0, 0, 0] },
    parts: [{ v: box(-200, EDGE, TOP, TOP + 15, -120, 120), tone: TONE }],
  };
  const order = (c: typeof plain, items: SolidItem[]) => {
    const fig = solidFigure("a", { character: c, ...sp })!;
    return solidOrder(lens, items, [fig]).map((o) => (o.kind === "part" ? o.part : "#"));
  };

  it("chỉ người ngồi mặc váy dựng khối có khối váy trên đùi", () => {
    expect(solidFigure("a", { character: skirted, ...sp })!.lap).toBeDefined();
    expect(solidFigure("a", { character: plain, ...sp })!.lap).toBeUndefined();
  });

  it("bàn che đùi: váy trên đùi vẽ dưới mặt bàn, thân vẽ sau", () => {
    const o = order(skirted, [table]);
    expect(o).toContain("lap");
    expect(o.indexOf("lap")).toBeLessThan(o.indexOf("#"));
    expect(o.indexOf("legNear")).toBeLessThan(o.indexOf("lap"));
    expect(o.indexOf("#")).toBeLessThan(o.indexOf("torso"));
  });

  it("lượt váy trên đùi nằm đúng chỗ lớp `hem` so với thân áo", () => {
    const step = (layer: "under" | "front") =>
      solidFigure("a", {
        character: {
          ...skirted,
          pieces: { ...skirted.pieces, hem: { ...skirted.pieces.hem, layer } },
        },
        ...sp,
      })!.step;
    expect(step("under").lap!).toBeLessThan(step("under").torso!);
    expect(step("front").lap!).toBeGreaterThan(step("front").torso!);
  });

  it("không có gì chen giữa: thân vẽ cả váy, thứ tự như người không váy", () => {
    expect(order(skirted, [])).toEqual(order(plain, []));
    const far: SolidItem = {
      at: { at: [0, 0, 0] },
      parts: [{ v: box(-600, -500, -175, -160, 400, 500), tone: TONE }],
    };
    expect(order(skirted, [far])).toEqual(order(plain, [far]));
  });
});
