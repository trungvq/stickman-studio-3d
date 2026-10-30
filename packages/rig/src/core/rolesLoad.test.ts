import { describe, expect, it, vi } from "vitest";
import binh from "../../../../common/held/binh.json";

// Mỗi ca nạp lại module từ đầu (`resetModules`), module đầu tiên vào vòng `heldItem` → `heldGeom` → `heldFit` → `heldItem`
// khác nhau: schema vai trò không được phụ thuộc thứ tự import
const LOAD = {
  roles: () => import("./roles"),
  heldRoles: () => import("./heldRoles"),
  heldItem: () => import("./heldItem"),
  heldGeom: () => import("./heldGeom"),
  heldFit: () => import("./heldFit"),
  index: () => import("./index"),
};

describe("vai trò nạp độc lập theo mọi thứ tự import", () => {
  for (const first of Object.keys(LOAD) as (keyof typeof LOAD)[])
    it(`${first} trước`, async () => {
      vi.resetModules();
      await LOAD[first]();
      const { parseHeldItem } = await LOAD.heldItem();
      const { heldRoles } = await LOAD.heldRoles();
      const { parseRoles } = await LOAD.roles();
      const held = parseHeldItem(structuredClone(binh));
      expect(held.success).toBe(true);
      expect(heldRoles(held.data!).roles[0]).toMatchObject({ role: "pourer", spout: [0, 0, 1] });
      expect(parseRoles([{ role: "seat", at: [0, 0, 0], size: [40, 40] }]).success).toBe(true);
    });
});
