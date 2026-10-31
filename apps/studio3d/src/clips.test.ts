import { parseAction, type ActionData } from "@stickman3d/rig/core";
import { describe, expect, it } from "vitest";
import {
  compatibleActions,
  deleteClip,
  restHand,
  setBaseMirror,
  setClipAction,
  setClipMirror,
  tracksOf,
} from "./clips";

const raw = () => ({
  cast: [
    {
      id: "a",
      tracks: [
        { name: "than", clips: [{ action: "stand", start: 0 }] },
        {
          name: "tay",
          clips: [
            { action: "leftHand", start: 0, lạ: 1 },
            { action: "leftHand", start: "@x+1", blend: 0.3 },
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
      { action: "leftHand", start: "@x+1", blend: 0.3 },
    ]);
    const two = deleteClip(one, { id: "a", track: 1, clip: 0 });
    expect(tracksOf(two, "a")!.map((t) => t.name)).toEqual(["than"]);
    expect(() => deleteClip(two, { id: "a", track: 1, clip: 0 })).toThrow();
  });

  it("đổi hành động giữ trường khác của clip", () => {
    const out = setClipAction(raw(), { id: "a", track: 1, clip: 0 }, "rightHand");
    expect(tracksOf(out, "a")![1].clips).toContainEqual({ action: "rightHand", start: 0, lạ: 1 });
  });

  it("soi gương clip và tư thế nền: bật là `true`, tắt là bỏ khoá", () => {
    const k = { id: "a", track: 1, clip: 0 };
    const on = setClipMirror(raw(), k, true);
    expect(tracksOf(on, "a")![1].clips).toContainEqual({
      action: "leftHand",
      start: 0,
      lạ: 1,
      mirror: true,
    });
    expect((tracksOf(setClipMirror(on, k, false), "a")![1].clips as unknown[])[0]).toEqual({
      action: "leftHand",
      start: 0,
      lạ: 1,
    });
    const base = setBaseMirror(raw(), "a", true);
    expect((base.cast as { baseMirror?: boolean }[])[0].baseMirror).toBe(true);
    expect("baseMirror" in (setBaseMirror(base, "a", false).cast as object[])[0]).toBe(false);
    expect(() => setBaseMirror(raw(), "b", true)).toThrow();
  });

  it("hành động thay được: cùng kênh, hay đủ `mask` của clip", () => {
    const actions = {
      leftHand: act("leftHand", ["hand"]),
      rightHand: act("rightHand", ["hand"]),
      both: act("both", ["hand", "armLeft"]),
      stand: act("stand", ["armLeft", "armRight"]),
    };
    expect(compatibleActions(actions, "leftHand")).toEqual(["rightHand"]);
    expect(compatibleActions(actions, "leftHand", ["hand"])).toEqual(["both", "rightHand"]);
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
