import { describe, expect, it } from "vitest";
import { body3 } from "./figure3d";
import { armPierce, PIERCE_TOL } from "./pierce";
import { parseScene, resolveScene, sceneAt } from "./scene";
import { defaultCharacter } from "./schema";

describe("armPierce: tay người 3D xuyên thân áo của chính người ấy", () => {
  const plain = defaultCharacter();
  /** Người mặc đồ (`palette.clad`): sườn áo lùi nhường chỗ cho tay (`cladProfile`) */
  const clad = (() => {
    const d = defaultCharacter();
    return { ...d, palette: { ...d.palette, clad: true }, pieces: { ...d.pieces, torso: { ...d.pieces.torso, src: "sculpt" as const, garment: { style: "shirt" as const } } } };
  })();
  /** Người đứng ở gốc nhìn +x (bên phải là −z), tay phải với tới `right` (bỏ trống là tay buông) */
  const at = (right?: [number, number, number], c = plain) => {
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

  it("người mặc đồ tay buông bên sườn: không báo (sườn áo đã lùi cho tay)", () => {
    expect(at(undefined, clad)).toEqual([]);
  });

  it("người mặc đồ bụng phệ tay buông choãi: không báo", () => {
    const belly = { ...clad, pieces: { ...clad.pieces, torso: { ...clad.pieces.torso, garment: { style: "polo" as const, belly: 24 } } } };
    expect(at(undefined, belly)).toEqual([]);
  });

  it("người mặc đồ với tay chéo qua người: vẫn báo", () => {
    const hits = at([20, -250, 60], clad);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].depth).toBeGreaterThan(10);
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
