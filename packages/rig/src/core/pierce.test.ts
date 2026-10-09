import { describe, expect, it } from "vitest";
import { body3 } from "./figure3d";
import { armPierce, PIERCE_TOL } from "./pierce";
import { parseScene, resolveScene, sceneAt } from "./scene";
import { defaultCharacter } from "./schema";

describe("armPierce: tay người 3D xuyên thân áo của chính người ấy", () => {
  const c = defaultCharacter();
  /** Người đứng ở gốc nhìn +x (bên phải là −z), tay phải với tới `right` (bỏ trống là tay buông) */
  const at = (right?: [number, number, number]) => {
    const r = parseScene({
      duration: 1,
      lens: { eye: [-300, -300, -900], yaw: 20, pitch: 10, f: 800, cx: 0, cy: 0 },
      cast: [
        {
          id: "a",
          world: {
            at: [0, 0, 0],
            yaw: 0,
            ...(right && { hands: [{ t: 0, right: { at: right } }] }),
          },
          tracks: [],
        },
      ],
    });
    if (!r.success) throw new Error(r.error.message);
    const rt = resolveScene(r.data, {});
    return armPierce(c, sceneAt(rt, "a", 0, c.rig.height, body3(c)), { tol: PIERCE_TOL });
  };

  it("tay buông bên sườn: không báo", () => {
    expect(at()).toEqual([]);
  });

  it("cầm cốc trước ngực, cổ tay ra trước đủ xa: không báo", () => {
    expect(at([54, -252, -22])).toEqual([]);
  });

  it("tay phải với chéo qua người sang phía trái: báo đoạn tay gần lấn vào thân", () => {
    const hits = at([20, -250, 60]);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].part).toMatch(/Near$/);
    expect(hits[0].depth).toBeGreaterThan(10);
  });
});
