import { describe, expect, it } from "vitest";

import { CharacterSchema, POSES, type View } from "@stickman3d/rig/core";
import { figureAnchors } from "./anchor";

describe("trang sức dựng khối ở người 2D, 2.5D", () => {
  it("dây chuyền, bông tai chỉ người 3D dựng: mốc người SVG như không đeo", () => {
    const bare = CharacterSchema.parse({
      pieces: { torso: { src: "sculpt" }, hair: { src: "sculpt" } },
    });
    const worn = CharacterSchema.parse({
      pieces: {
        torso: { src: "sculpt" },
        hair: { src: "sculpt" },
        neck: { src: "sculpt", necklace: { style: "pearl", pendant: "drop" } },
        headAcc: { src: "sculpt", earrings: { shape: "drop" } },
      },
    });
    for (const view of ["front", "side", "rear"] as View[]) {
      const a = figureAnchors(bare, POSES.idle, { body: view, head: view });
      const b = figureAnchors(worn, POSES.idle, { body: view, head: view });
      expect(b.slots.torso).toEqual(a.slots.torso);
      expect(b.slots.hair).toEqual(a.slots.hair);
    }
  });
});
