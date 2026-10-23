import { describe, expect, it } from "vitest";
import {
  clipSides,
  HAND_REST,
  handSources,
  parseAction,
  parseScene,
  resolveScene,
  sceneAt,
  sideChannel,
  type ActionData,
} from "./index";

function action(json: unknown): ActionData {
  const r = parseAction(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}

const ACTIONS: Record<string, ActionData> = {
  stand: action({
    name: "stand",
    duration: 1,
    end: "hold",
    authoredAt: "side",
    mask: ["armFar", "armNear"],
    keys: [{ t: 0, pose: { armFar: [5, -10, 0], armNear: [5, -10, 0] } }],
  }),
  farHand: action({
    name: "farHand",
    duration: 1,
    end: "hold",
    authoredAt: "side",
    mask: ["hand"],
    keys: [
      {
        t: 0,
        pose: {},
        hand: { armFar: { pose: "open", w: 0.75, palm: "down", fingers: "forward" } },
      },
    ],
  }),
  rightHand: action({
    name: "rightHand",
    duration: 1,
    end: "hold",
    authoredAt: "side",
    sides: "anatomical",
    mask: ["hand"],
    keys: [{ t: 0, pose: {}, hand: { armNear: "fist" } }],
  }),
};

const LENS = { eye: [0, -200, 0], yaw: 0, pitch: 0, f: 800, cx: 0, cy: -200 };

function run(yaw: number, hand: string, hands?: unknown[]) {
  const r = parseScene({
    lens: LENS,
    duration: 2,
    cast: [
      {
        id: "a",
        world: { at: [0, 0, 500], yaw, ...(hands && { hands }) },
        tracks: [
          { name: "than", clips: [{ action: "stand", start: 0 }] },
          { name: "tay", clips: [{ action: hand, start: 0 }] },
        ],
      },
    ],
  });
  if (!r.success) throw new Error(r.error.message);
  const rt = resolveScene(r.data, ACTIONS);
  return { rt, src: handSources(rt, "a", 0.5)! };
}

describe("handSources", () => {
  it("kênh xa đi vào tay phải khi thân lật, tay trái khi không", () => {
    for (const yaw of [90, 270]) {
      const { rt, src } = run(yaw, "farHand");
      const flip = rt.cast[0].rightFar === true;
      const far = flip ? src.right : src.left;
      const near = flip ? src.left : src.right;
      expect(far.flip).toBe(flip);
      expect(far.channel).toBe("af");
      expect(far.hand).toMatchObject({
        track: 1,
        trackName: "tay",
        clip: 0,
        action: "farHand",
        channel: "armFar",
        aim: true,
        key: { pose: "open", w: 0.75, palm: "down", fingers: "forward" },
      });
      expect(far.arm).toMatchObject({ trackName: "than", action: "stand", channel: "armFar" });
      expect(near.channel).toBe("an");
      expect(near.hand).toBeUndefined();
      expect(near.arm).toMatchObject({ trackName: "than", channel: "armNear" });
    }
    expect([90, 270].map((y) => run(y, "farHand").rt.cast[0].rightFar === true)).toContain(true);
  });

  it('hành động `sides: "anatomical"` giữ kênh gần là tay phải', () => {
    for (const yaw of [90, 270]) {
      const { src } = run(yaw, "rightHand");
      expect(src.right.hand).toMatchObject({ action: "rightHand", anatomical: src.right.flip });
      expect(src.right.hand?.channel).toBe("armNear");
      expect(src.right.channel).toBe(src.right.flip ? "af" : "an");
      expect(src.right.hand?.aim).toBe(false);
      expect(src.left.hand).toBeUndefined();
    }
  });

  it("mốc `world.hands` của tay và đích thế giới đang áp", () => {
    const hands = [
      { t: 0, left: { at: [0, -200, 520], palm: "down" } },
      { t: 1, left: null, right: { pose: "fist" } },
    ];
    const { src } = run(270, "farHand", hands);
    expect(src.left.mark).toEqual({
      index: 0,
      t: 0,
      kind: "target",
      next: { index: 1, t: 1, kind: "null" },
    });
    expect(src.left.world).toMatchObject({ aim: true });
    expect(src.left.world!.w).toBeGreaterThan(0);
    // trước mốc đầu tay giữ mốc đầu
    expect(src.right.mark).toEqual({ index: 1, t: 1, kind: "pose" });
    expect(src.right.world).toBeUndefined();
  });
});

describe("clipSides", () => {
  it("clip chỉ ghi bàn tay xa: tay phải khi lật, tay trái khi không; clip thân ghi góc cả hai tay", () => {
    for (const yaw of [90, 270]) {
      const { rt } = run(yaw, "farHand");
      const flip = rt.cast[0].rightFar === true;
      const far = flip ? "right" : "left";
      const near = flip ? "left" : "right";
      const s = clipSides(rt, "a", 1, 0, 0.5)!;
      expect(s[far]).toEqual({ arm: false, hand: true });
      expect(s[near]).toEqual({ arm: false, hand: false });
      const body = clipSides(rt, "a", 0, 0, 0.5)!;
      expect(body.right).toEqual({ arm: true, hand: false });
      expect(body.left).toEqual({ arm: true, hand: false });
    }
  });

  it('hành động `sides: "anatomical"` ghi kênh gần vào tay phải ở mọi phía', () => {
    for (const yaw of [90, 270]) {
      const s = clipSides(run(yaw, "rightHand").rt, "a", 1, 0, 0.5)!;
      expect(s.right.hand).toBe(true);
      expect(s.left.hand).toBe(false);
    }
  });
});

describe("mốc `rest`", () => {
  const both = action({
    name: "both",
    duration: 1,
    end: "hold",
    authoredAt: "side",
    mask: ["hand"],
    keys: [
      {
        t: 0,
        pose: {},
        hand: { armFar: { pose: "open", palm: "down" }, armNear: { pose: "open", palm: "down" } },
      },
    ],
  });
  const at = (hands: unknown[], time: number) => {
    const r = parseScene({
      lens: LENS,
      duration: 3,
      cast: [
        {
          id: "a",
          world: { at: [0, 0, 500], yaw: 270, hands },
          tracks: [
            { name: "than", clips: [{ action: "stand", start: 0 }] },
            { name: "tay", clips: [{ action: "both", start: 0 }] },
          ],
        },
      ],
    });
    if (!r.success) throw new Error(r.error.message);
    const rt = resolveScene(r.data, { ...ACTIONS, both });
    const sp = sceneAt(rt, "a", time);
    const flip = !!sp.world?.flip;
    return { rt, sp, ch: (s: "right" | "left") => sideChannel(s, flip) };
  };

  it("huỷ bàn tay và ý định của hành động ở đúng tay ấy, từ mốc", () => {
    const { sp, ch } = at([{ t: 1, right: { rest: true } }], 2);
    expect(sp.pose.hand?.[ch("right")]).toEqual(HAND_REST);
    expect(sp.pose.aim?.[ch("right")]).toBeUndefined();
    expect(sp.pose.aim?.[ch("left")]).toBeDefined();
    expect(sp.pose.hand?.[ch("left")]).not.toEqual(HAND_REST);
  });

  it("hoà như mốc thường: mốc `null` rồi mốc `rest` thì giữa hai mốc buông một phần", () => {
    const half = at(
      [
        { t: 0, right: null },
        { t: 2, right: { rest: true } },
      ],
      1,
    );
    const src = handSources(half.rt, "a", 1)!;
    expect(src.right.rest).toBeCloseTo(0.5, 5);
    expect(src.right.mark).toMatchObject({ kind: "null", next: { kind: "rest" } });
    expect(src.left.rest).toBe(0);
    expect(half.sp.pose.aim?.[half.ch("right")]?.terms.length).toBeGreaterThan(1);
    expect(handSources(half.rt, "a", 2.5)!.right.rest).toBe(1);
  });

  it("chỉ đi với `ease`, `bezier`", () => {
    const scene = (right: unknown) =>
      parseScene({
        lens: LENS,
        cast: [{ id: "a", world: { at: [0, 0, 0], hands: [{ t: 0, right }] } }],
      });
    expect(scene({ rest: true, pose: "fist" }).success).toBe(false);
    expect(scene({ rest: true, at: [0, 0, 0] }).success).toBe(false);
    expect(scene({ rest: true, ease: "auto" }).success).toBe(true);
  });
});
