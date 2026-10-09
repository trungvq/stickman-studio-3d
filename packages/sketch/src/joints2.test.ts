import { describe, expect, it } from "vitest";

import { anchorAt } from "./anchor";
import {
  body3,
  defaultCharacter,
  joints2,
  parseAction,
  parseScene,
  resolveScene,
  sceneAt,
  type ActionData,
} from "./index";

const NAMES = {
  kneeN: "kneeNear",
  kneeF: "kneeFar",
  footN: "footNear",
  footF: "footFar",
  elbowN: "elbowNear",
  elbowF: "elbowFar",
  wristN: "wristNear",
  wristF: "wristFar",
  head: "head",
} as const;

const wave: ActionData = parseAction({
  name: "wave",
  duration: 1,
  keys: [
    {
      t: 0,
      pose: {
        armNear: [-120, -30, 0],
        armFar: [40, 70, 0],
        legNear: [20, -30],
        legFar: [-10, 5],
        torso: 12,
        head: [8, -20, 10],
      },
    },
    {
      t: 1,
      pose: {
        armNear: [30, 60, 0],
        armFar: [-90, -40, 0],
        legNear: [-15, 10],
        legFar: [30, -60],
        torso: -8,
        head: [-6, 25, -5],
      },
    },
  ],
}).data!;

describe("joints2", () => {
  it("trùng các mốc khớp của `anchorAt` ở người 2D: lật, góc nhìn, xoay", () => {
    const c = defaultCharacter();
    const r = parseScene({
      duration: 2,
      cast: [
        {
          id: "a",
          x: -100,
          y: 40,
          scale: 0.8,
          tracks: [{ clips: [{ action: "wave", start: 0 }] }],
        },
        {
          id: "b",
          x: 150,
          flip: true,
          view: "side",
          rotate: 15,
          tracks: [{ clips: [{ action: "wave", start: 0 }] }],
        },
        {
          id: "c",
          view: "rear",
          headView: "side",
          tracks: [{ clips: [{ action: "wave", start: 0.3 }] }],
        },
      ],
    });
    const rt = resolveScene(r.data!, { wave });
    for (const id of ["a", "b", "c"])
      for (const t of [0, 0.37, 0.8, 1.5]) {
        const sp = sceneAt(rt, id, t, c.rig.height, body3(c));
        const J = joints2(c, sp);
        for (const [k, name] of Object.entries(NAMES)) {
          const a = anchorAt(rt, id, name, t, c);
          expect(J[k as keyof typeof NAMES][0], `${id} ${k} giây ${t}`).toBeCloseTo(a.x, 6);
          expect(J[k as keyof typeof NAMES][1], `${id} ${k} giây ${t}`).toBeCloseTo(a.y, 6);
        }
      }
  });
});
