import { describe, expect, it } from "vitest";

import {
  type CharacterData,
  CharacterSchema,
  POSES,
  type Skirt,
  SKIRT_REACH,
  type View,
} from "@stickman3d/rig/core";
import { figureAnchors } from "./anchor";

const skirted = (skirt: Partial<Skirt> = {}): CharacterData =>
  CharacterSchema.parse({
    pieces: { torso: { src: "sculpt" }, hem: { src: "sculpt", skirt, layer: "under" } },
  });
const points = (d: string) =>
  [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
const skirtAt = (c: CharacterData, pose = POSES.idle, view: View = "front") =>
  figureAnchors(c, pose, { body: view, head: view }).skirt!;

describe("váy dựng khối", () => {
  it("hộp mảnh hem là hộp bao của hình chiếu", () => {
    const c = skirted();
    const A = figureAnchors(c, POSES.idle, { body: "front", head: "front" });
    expect(A.slots.hem.box).toEqual(A.skirt!.box);
  });

  it("nhìn nghiêng xoè gần bằng nhìn thẳng: gấu nở đều ra mọi phía", () => {
    const c = skirted();
    const front = skirtAt(c).box.w;
    const side = skirtAt(c, POSES.idle, "side").box.w;
    expect(side / front).toBeGreaterThan(0.85);
    expect(side).toBeLessThan(front);
  });

  it("xoè và dài thêm thì hộp to ra", () => {
    const base = skirtAt(skirted()).box;
    expect(skirtAt(skirted({ flare: 50 })).box.w).toBeGreaterThan(base.w);
    expect(skirtAt(skirted({ length: 80 })).box.h).toBeGreaterThan(base.h);
  });

  it("ngồi: váy phủ dọc đùi nhưng gối vẫn lộ", () => {
    const c = skirted();
    const A = figureAnchors(c, POSES.sit, { body: "side", head: "side" });
    const [hip, knee] = A.fig.legN;
    const right = Math.max(...points(A.skirt!.body).map(([x]) => x));
    const thigh = Math.hypot(knee[0] - hip[0], knee[1] - hip[1]);
    expect(right).toBeGreaterThan(hip[0] + thigh * 0.5);
    expect(right).toBeLessThan(knee[0]);
    expect(right).toBeLessThan(hip[0] + thigh * SKIRT_REACH + 12);
  });

  it("ngồi thì gấu không rủ xuống dưới đùi như lúc đứng", () => {
    const c = skirted();
    const stand = skirtAt(c, POSES.idle, "side").box;
    const sit = skirtAt(c, POSES.sit, "side").box;
    expect(sit.y + sit.h).toBeLessThan(stand.y + stand.h);
  });
});
