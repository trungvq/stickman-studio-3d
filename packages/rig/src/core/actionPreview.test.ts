import { describe, expect, it } from "vitest";
import { ActionSchema, parseAction } from "./index";

const json = {
  name: "wave-3d",
  authoredAt: "side",
  mask: ["armRight"],
  keys: [{ t: 0, pose: { armRight: [0, 0, 0] } }],
  preview: { base: "stand-3d", stage: "stand" },
};

describe("preview của hành động", () => {
  it("parse rồi xuất ra vẫn giữ nguyên preview", () => {
    const r = parseAction(json);
    expect(r.success).toBe(true);
    const out = JSON.parse(JSON.stringify(r.data));
    expect(out.preview).toEqual({ base: "stand-3d", stage: "stand" });
    expect(ActionSchema.parse(out).preview).toEqual(out.preview);
  });

  it("bỏ trống thì không có preview, base được bỏ trống", () => {
    expect(parseAction({ ...json, preview: undefined }).data?.preview).toBeUndefined();
    expect(parseAction({ ...json, preview: { stage: "chair" } }).data?.preview).toEqual({
      stage: "chair",
    });
  });

  it("stage lạ là lỗi zod", () => {
    const r = parseAction({ ...json, preview: { stage: "bed" } });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["preview", "stage"]);
  });
});

describe("preview.hold và preview.partner", () => {
  const preview = {
    stage: "stand",
    hold: { right: "coc@cylinder", left: { item: "tui", group: "carry", on: "elbow" } },
    partner: { at: [200, 40], yaw: -10, action: "receive-3d", hold: { right: "coc@cylinder" } },
  };

  it("parse rồi xuất ra vẫn giữ nguyên", () => {
    const r = parseAction({ ...json, preview });
    expect(r.success).toBe(true);
    const out = JSON.parse(JSON.stringify(r.data));
    expect(out.preview).toEqual(preview);
    expect(ActionSchema.parse(out).preview).toEqual(preview);
  });

  it("partner trống là hợp lệ", () => {
    expect(parseAction({ ...json, preview: { partner: {} } }).data?.preview).toEqual({
      partner: {},
    });
  });

  it("chỗ cầm sai dạng, tay lạ, trường lạ của partner là lỗi zod", () => {
    const at = (p: unknown) => parseAction({ ...json, preview: p }).error?.issues[0].path;
    expect(at({ hold: { right: "coc#cam" } })).toEqual(["preview", "hold", "right"]);
    expect(at({ hold: { near: "coc@cylinder" } })).toEqual(["preview", "hold"]);
    expect(at({ partner: { at: [200] } })).toEqual(["preview", "partner", "at"]);
    expect(at({ partner: { who: "x" } })).toEqual(["preview", "partner"]);
  });
});
