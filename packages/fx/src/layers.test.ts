import { SCENE_Z } from "@stickman3d/sketch";
import { describe, expect, it } from "vitest";
import { layerZs } from "./layers";

describe("layerZs", () => {
  const draw = () => null;
  it("chỉ lớp bật ở cảnh, mỗi chỗ móc có vẽ một nấc, bỏ trống là băng fx", () => {
    expect(
      layerZs(
        [
          { scenes: new Set(["a"]), z: { front: 10 }, front: draw },
          { scenes: ["a"], back: draw, front: draw },
          { scenes: ["b"], z: { front: 3 }, front: draw },
          { scenes: ["a"], z: { back: -7 } },
        ],
        "a",
      ),
    ).toEqual([10, SCENE_Z.fxBack, SCENE_Z.fxFront]);
  });
});
