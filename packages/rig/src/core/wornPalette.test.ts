import { describe, expect, it } from "vitest";
import { defaultCharacter, equipCharacter, parseCharacter, wornPalette } from "./schema";

describe("wornPalette: tay áo, quần, giày đi theo thân áo đang mặc", () => {
  const c = (() => {
    const d = defaultCharacter();
    const r = parseCharacter({
      ...d,
      palette: {
        ...d.palette,
        clad: true,
        sleeve: "#c98a86",
        sleeveLength: 0.3,
        trouser: "#efe4cf",
      },
      items: {
        yukata: {
          torso: {
            src: "sculpt",
            garment: { style: "wrap" },
            palette: { sleeve: "#efe4cf", sleeveLength: 1, sleeveFlare: 12, trouser: "#efe4cf" },
          },
        },
      },
    });
    if (!r.success) throw new Error(r.error.message);
    return r.data;
  })();

  it("thân áo nền không khai `palette`: giữ `palette` của nhân vật", () => {
    expect(wornPalette(c)).toBe(c.palette);
  });

  it("mặc vật thay áo: tay áo, độ loe, quần theo vật; trường không khai giữ của nhân vật", () => {
    const p = wornPalette(equipCharacter(c, { torso: "yukata" }));
    expect(p.sleeve).toBe("#efe4cf");
    expect(p.sleeveLength).toBe(1);
    expect(p.sleeveFlare).toBe(12);
    expect(p.shoe).toBe(c.palette.shoe);
    expect(p.clad).toBe(true);
  });
});
