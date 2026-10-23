import { parseAction, type ActionData } from "@stickman3d/rig/core";
import { describe, expect, it } from "vitest";
import { compatibleActions, deleteClip, restHand, setClipAction, tracksOf } from "./clips";

const raw = () => ({
  cast: [
    {
      id: "a",
      tracks: [
        { name: "than", clips: [{ action: "stand", start: 0 }] },
        {
          name: "tay",
          clips: [
            { action: "farHand", start: 0, lạ: 1 },
            { action: "farHand", start: "@x+1", blend: 0.3 },
          ],
        },
      ],
    },
  ],
});

const act = (name: string, mask: string[]): ActionData => {
  const r = parseAction({ name, duration: 1, mask, keys: [{ t: 0, pose: {} }] });
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

describe("sửa clip", () => {
  it("xoá clip giữ clip khác; xoá clip cuối bỏ cả track", () => {
    const one = deleteClip(raw(), { id: "a", track: 1, clip: 0 });
    expect(tracksOf(one, "a")![1].clips).toEqual([
      { action: "farHand", start: "@x+1", blend: 0.3 },
    ]);
    const two = deleteClip(one, { id: "a", track: 1, clip: 0 });
    expect(tracksOf(two, "a")!.map((t) => t.name)).toEqual(["than"]);
    expect(() => deleteClip(two, { id: "a", track: 1, clip: 0 })).toThrow();
  });

  it("đổi hành động giữ trường khác của clip", () => {
    const out = setClipAction(raw(), { id: "a", track: 1, clip: 0 }, "nearHand");
    expect(tracksOf(out, "a")![1].clips).toContainEqual({ action: "nearHand", start: 0, lạ: 1 });
  });

  it("hành động thay được: cùng kênh, hay đủ `mask` của clip", () => {
    const actions = {
      farHand: act("farHand", ["hand"]),
      nearHand: act("nearHand", ["hand"]),
      both: act("both", ["hand", "armFar"]),
      stand: act("stand", ["armFar", "armNear"]),
    };
    expect(compatibleActions(actions, "farHand")).toEqual(["nearHand"]);
    expect(compatibleActions(actions, "farHand", ["hand"])).toEqual(["both", "nearHand"]);
  });
});

describe("Về tư thế buông", () => {
  it("clip chỉ chạm tay ấy: xoá clip, track hết clip thì bỏ; không thêm mốc", () => {
    const r = restHand(raw(), "a", "right", 0.5, [{ track: 1, clip: 1, other: false }]);
    expect(r.rest).toBe(false);
    expect(tracksOf(r.raw, "a")![1].clips).toHaveLength(1);
    expect((r.raw.cast as { world?: unknown }[])[0].world).toBeUndefined();
  });

  it("clip chạm cả hai tay: thêm mốc `rest` ở giây ấy, clip giữ", () => {
    const base = { ...raw(), cast: [{ ...raw().cast[0], world: { at: [0, 0, 0] } }] };
    const r = restHand(base, "a", "left", 1.25, [{ track: 1, clip: 0, other: true }]);
    expect(r.rest).toBe(true);
    expect(tracksOf(r.raw, "a")![1].clips).toHaveLength(2);
    expect((r.raw.cast as { world: { hands: unknown[] } }[])[0].world.hands).toEqual([
      { t: 1.25, left: { rest: true } },
    ]);
  });
});
