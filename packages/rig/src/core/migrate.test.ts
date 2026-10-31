import { describe, expect, it } from "vitest";
import { ACTION_VERSION, parseAction } from "./action";
import { migrateHeldItem } from "./heldItem";
import { migrateScene, parseScene, SCENE_VERSION } from "./scene";
import { CHARACTER_VERSION, parseCharacter } from "./schema";

const LENS = { eye: [0, -250, -1400], yaw: 0, pitch: 0, f: 800 };

describe("kênh, socket đời cũ thành tên phải / trái", () => {
  it("hành động: khoá `pose`, `reach`, `hand`, `mask`, socket bàn tay của `equip`; bỏ `sides`", () => {
    const r = parseAction({
      schemaVersion: 20,
      name: "x",
      duration: 1,
      sides: "anatomical",
      mask: ["armNear", "legFar", "hand"],
      keys: [
        {
          t: 0,
          pose: { armNear: [10, 20, 0], legFar: [5, 0] },
          reach: { armNear: { at: [0.3, -0.4, 0.2] } },
          hand: { armNear: "fist", armFar: "open" },
          equip: { handNear: "coc", handFar: null },
        },
      ],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.schemaVersion).toBe(ACTION_VERSION);
    expect("sides" in r.data).toBe(false);
    expect(r.data.mask).toEqual(["armRight", "legLeft", "hand"]);
    const k = r.data.keys![0];
    expect(k.pose).toEqual({ armRight: [10, 20, 0], legLeft: [5, 0] });
    expect(Object.keys(k.reach!)).toEqual(["armRight"]);
    expect(k.hand).toEqual({ armRight: "fist", armLeft: "open" });
    expect(k.equip).toEqual({ handRight: "coc", handLeft: null });
  });

  it("nhân vật: socket `handNear` / `handFar` ở `pieces`, `items`, `outfits`", () => {
    const r = parseCharacter({
      schemaVersion: 6,
      pieces: { handNear: { color: "#111" }, handFar: { color: "#222" } },
      items: { coc: { handNear: { src: "sculpt" } } },
      outfits: { uong: { handFar: "coc" } },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.pieces.handRight.color).toBe("#111");
    expect(r.data.pieces.handLeft.color).toBe("#222");
    expect(Object.keys(r.data.items.coc)).toEqual(["handRight"]);
    expect(r.data.outfits.uong).toEqual({ handLeft: "coc" });
  });

  it("cảnh: `cast[].base`, `cast[].equip`, `clips[].mask`, `clips[].equip`; bản hiện hành giữ nguyên", () => {
    const cast = (v: Record<string, unknown>) => [
      {
        id: "a",
        world: { at: [0, 0, 400] },
        base: { [`arm${v.near}`]: [5, 10, 0] },
        equip: { [`hand${v.far}`]: "coc" },
        tracks: [
          {
            clips: [
              {
                action: "x",
                start: 0,
                mask: [`arm${v.near}`, "torso"],
                equip: [{ [`hand${v.near}`]: null }, "tet"],
                ...(v.mirror ? { mirror: true } : {}),
              },
            ],
          },
        ],
      },
    ];
    const old = parseScene({
      schemaVersion: 36,
      lens: LENS,
      cast: cast({ near: "Near", far: "Far" }),
    });
    expect(old.success).toBe(true);
    if (!old.success) return;
    const m = old.data.cast[0];
    expect(old.data.schemaVersion).toBe(SCENE_VERSION);
    expect(m.base).toEqual({ armRight: [5, 10, 0] });
    expect(m.equip).toEqual({ handLeft: "coc" });
    expect(m.tracks[0].clips[0].mask).toEqual(["armRight", "torso"]);
    expect(m.tracks[0].clips[0].equip).toEqual([{ handRight: null }, "tet"]);
    const now = parseScene({
      lens: LENS,
      cast: cast({ near: "Right", far: "Left", mirror: true }),
    });
    expect(now.success).toBe(true);
    expect(now.data?.cast[0].tracks[0].clips[0]).toMatchObject({
      mirror: true,
      mask: ["armRight", "torso"],
    });
    expect(
      parseScene({
        schemaVersion: SCENE_VERSION,
        lens: LENS,
        cast: cast({ near: "Near", far: "Far" }),
      }).success,
    ).toBe(false);
  });
});

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
      items: { ao: { sleeveNear: { src: "none" }, handRight: { src: "none" } } },
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    for (const k of ["shape", "dx", "dy"]) expect(k in r.data.head).toBe(false);
    expect(r.data.head.scaleX).toBe(1.1);
    for (const k of ["sleeveNear", "sleeveFar", "hairBack"]) expect(k in r.data.pieces).toBe(false);
    expect(Object.keys(r.data.items.ao)).toEqual(["handRight"]);
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
        { id: "ar", character: "an.json", x: 5000, y: 300, scale: 1, tracks: [] },
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
      cast: [{ id: "ar", x: 5000, tracks: [{ clips: [{ action: "idle", start: 0 }] }] }],
      fx: [{ kind: "glow", from: 0, to: 1, x: 0, y: 0, r: 40 }],
    });
    expect(s.success).toBe(true);
    if (s.success) expect(s.data.cast).toEqual([]);
  });

  it("cảnh dựng trong code (không `schemaVersion`) thiếu `world` thì zod báo", () => {
    expect(parseScene({ lens: LENS, cast: [{ id: "a" }] }).success).toBe(false);
  });
});

describe("mốc người, khối va chạm đời cũ thành tên phải / trái", () => {
  it("cảnh: `fx[].anchor`, `touch` của `hold` trong `world.hands`", () => {
    const o = migrateScene({
      schemaVersion: 36,
      fx: [
        { kind: "bubble", anchor: "wristNear" },
        { kind: "bubble", anchor: "head" },
      ],
      cast: [
        {
          id: "a",
          world: {
            at: [0, 0, 0],
            hands: [
              {
                t: 0,
                left: { hold: { item: "coc", touch: ["forearmFar", { part: "armNear", max: 2 }] } },
              },
            ],
          },
        },
      ],
    }) as {
      fx: { anchor: string }[];
      cast: { world: { hands: { left: { hold: { touch: unknown[] } } }[] } }[];
    };
    expect(o.fx.map((f) => f.anchor)).toEqual(["wristRight", "head"]);
    expect(o.cast[0].world.hands[0].left.hold.touch).toEqual([
      "forearmLeft",
      { part: "armRight", max: 2 },
    ]);
  });

  it("món: `touch`", () => {
    const o = migrateHeldItem({ schemaVersion: 4, touch: ["shinNear", "torso"] }) as {
      touch: unknown[];
    };
    expect(o.touch).toEqual(["shinRight", "torso"]);
  });
});
