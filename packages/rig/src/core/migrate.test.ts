import { describe, expect, it } from "vitest";
import { parseAction } from "./action";
import { parseScene } from "./scene";
import { CHARACTER_VERSION, parseCharacter } from "./schema";

const LENS = { eye: [0, -250, -1400], yaw: 0, pitch: 0, f: 800 };

describe("trường không còn: JSON cũ bỏ lặng lẽ", () => {
  it("nhân vật: râu `chin`, ria `face.moustache`", () => {
    const r = parseCharacter({
      schemaVersion: 5,
      face: { moustache: { kind: "short" } },
      pieces: { chin: { src: "sculpt", beard: { length: 0.5 } } },
      items: { rau: { chin: { src: "sculpt" } }, kinh: { faceAcc: { src: "sculpt" } } },
      outfits: { tet: { chin: "rau", faceAcc: "kinh" } },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.schemaVersion).toBe(CHARACTER_VERSION);
    expect("moustache" in r.data.face).toBe(false);
    expect("chin" in r.data.pieces).toBe(false);
    expect(r.data.items.rau).toEqual({});
    expect(r.data.outfits.tet).toEqual({ faceAcc: "kinh" });
  });

  it("nhân vật: ô gắn rỗng `sleeveNear/Far`, `hairBack`, dáng đầu `head.shape`, `head.dx` / `dy`", () => {
    const r = parseCharacter({
      schemaVersion: 5,
      head: { shape: "square", scaleX: 1.1, dx: 4, dy: -3 },
      pieces: { sleeveNear: {}, sleeveFar: {}, hairBack: { color: "#000" } },
      items: { ao: { sleeveNear: { src: "none" }, handNear: { src: "none" } } },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    for (const k of ["shape", "dx", "dy"]) expect(k in r.data.head).toBe(false);
    expect(r.data.head.scaleX).toBe(1.1);
    for (const k of ["sleeveNear", "sleeveFar", "hairBack"]) expect(k in r.data.pieces).toBe(false);
    expect(Object.keys(r.data.items.ao)).toEqual(["handNear"]);
  });

  it("hành động và cảnh: `equip` của socket không còn", () => {
    const a = parseAction({
      schemaVersion: 20,
      name: "x",
      duration: 1,
      keys: [{ t: 0, pose: {}, equip: { chin: null, hairBack: null, faceAcc: "kinh" } }],
    });
    expect(a.success).toBe(true);
    if (a.success) expect(a.data.keys?.[0].equip).toEqual({ faceAcc: "kinh" });
    const s = parseScene({
      schemaVersion: 35,
      lens: LENS,
      cast: [
        {
          id: "a",
          world: { at: [0, 0, 400] },
          equip: [{ chin: "rau" }, "tet"],
          tracks: [{ clips: [{ action: "x", start: 0, equip: { chin: null, sleeveFar: null } }] }],
        },
      ],
    });
    expect(s.success).toBe(true);
    if (!s.success) return;
    expect(s.data.cast[0].equip).toEqual([{}, "tet"]);
    expect(s.data.cast[0].tracks[0].clips[0].equip).toEqual({});
  });

  it("cảnh: người không có `world`, chỗ đứng sân khấu, `scale`, `groups[]` và `ground`", () => {
    const s = parseScene({
      schemaVersion: 34,
      duration: 2,
      lens: LENS,
      ground: 300,
      groups: [{ id: "g", x: 100, flip: true }],
      cast: [
        { id: "an", character: "an.json", x: 5000, y: 300, scale: 1, tracks: [] },
        { id: "ink", x: -2000, fade: [{ t: 0, v: 0 }] },
        {
          id: "b",
          group: "g",
          x: 0,
          y: 10,
          scale: 1,
          flip: [{ t: 1, v: true }],
          rotate: 0,
          path: [{ t: 0, x: 0 }],
          world: { at: [0, 0, 400] },
        },
      ],
    });
    expect(s.success).toBe(true);
    if (!s.success) return;
    expect("groups" in s.data).toBe(false);
    expect("ground" in s.data).toBe(false);
    expect(s.data.cast.map((m) => m.id)).toEqual(["b"]);
    for (const k of ["x", "y", "group", "flip", "rotate", "path", "scale"])
      expect(k in s.data.cast[0]).toBe(false);
  });

  it("cảnh: chỉ có người giữ chỗ thì `cast` rỗng", () => {
    const s = parseScene({
      schemaVersion: 26,
      duration: 2,
      cast: [{ id: "an", x: 5000, tracks: [{ clips: [{ action: "idle", start: 0 }] }] }],
      fx: [{ kind: "glow", from: 0, to: 1, x: 0, y: 0, r: 40 }],
    });
    expect(s.success).toBe(true);
    if (s.success) expect(s.data.cast).toEqual([]);
  });

  it("cảnh dựng trong code (không `schemaVersion`) thiếu `world` thì zod báo", () => {
    expect(parseScene({ lens: LENS, cast: [{ id: "a" }] }).success).toBe(false);
  });
});
