import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { Solo } from "./solo";

const named = (name: string, ...kids: THREE.Object3D[]) => {
  const g = new THREE.Group();
  g.name = name;
  for (const k of kids) g.add(k);
  return g;
};

describe("Solo", () => {
  it("ẩn mọi nhánh trừ vật giữ và đường xuống chúng, trả lại đúng những gì đã ẩn", () => {
    const hand = named("hand");
    const me = named("me", named("arm", hand));
    const cup = named("cup");
    const off = named("offstage");
    off.visible = false;
    const wall = named("wall");
    const set = named("set", wall, named("shelf", cup));
    const other = named("other");
    const root = named("root", set, me, other, off);
    const solo = new Solo();
    solo.hide(root, [me, cup]);
    const shelf = cup.parent!;
    expect([me, hand, set, shelf, cup].every((o) => o.visible)).toBe(true);
    expect([wall.visible, other.visible, off.visible]).toEqual([false, false, false]);
    solo.hide(root, [other]);
    expect([wall.visible, me.visible, other.visible, set.visible]).toEqual([
      true,
      false,
      true,
      false,
    ]);
    solo.show();
    expect([wall, set, me, other].every((o) => o.visible)).toBe(true);
    expect(off.visible).toBe(false);
  });
});
