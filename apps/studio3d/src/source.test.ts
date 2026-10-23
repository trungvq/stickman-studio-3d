import type { HandSource } from "@stickman3d/rig/core";
import { describe, expect, it } from "vitest";
import { handKeyText, sourceHtml, sourceLines, sourceModel } from "./source";

const clip = {
  clip: 0,
  start: 0,
  blend: 0,
  blending: false,
  channel: "armFar" as const,
  anatomical: false,
};

const lost: HandSource = {
  side: "right",
  channel: "af",
  flip: true,
  stepSwap: false,
  arm: { ...clip, track: 0, trackName: "than", action: "stand-3d" },
  hand: {
    ...clip,
    track: 1,
    trackName: "tay",
    action: "tay-dat-xa-3d",
    key: { pose: "open", w: 0.75, palm: "down", fingers: "forward" },
    aim: true,
  },
};

describe("nguồn dáng", () => {
  it("tay xa đang lật: clip bàn tay theo ý định mà không mốc tay thì tô vàng", () => {
    const m = sourceModel("takumi", lost);
    expect(m.head).toBe("takumi · tay phải · tay XA (đang lật)");
    expect(m.rows.map((r) => [r.label, r.what, r.where])).toEqual([
      ["cánh tay", "stand-3d", "track than"],
      ["bàn tay", "tay-dat-xa-3d", "track tay"],
      ["mốc tay", "—", ""],
    ]);
    expect(m.rows[1].detail).toBe("open 0.75 · palm down · fingers forward");
    expect(m.rows[1].warn).toBe(true);
    expect(m.note).toBe("kênh xa → tay phải vì đang lật");
    expect(sourceHtml(m)).toContain('<tr class="warn"');
    expect(sourceLines(m)[2]).toContain("tay-dat-xa-3d");
  });

  it("mốc tay đang áp thì không tô vàng", () => {
    const m = sourceModel("takumi", {
      ...lost,
      mark: { index: 0, t: 0, kind: "target" },
      world: { w: 1, aim: true },
    });
    expect(m.rows[1].warn).toBeUndefined();
    expect(m.rows[2]).toMatchObject({ what: "#0 đích", where: "0.00 s", detail: "đích w 1" });
  });

  it("mốc bàn tay một dòng", () => {
    expect(handKeyText("fist")).toBe("fist");
    expect(handKeyText({ turn: 30 })).toBe("nghỉ · turn 30");
    expect(handKeyText({ pose: "open", palm: { v: [0, 1, 0] } })).toBe('open · palm {"v":[0,1,0]}');
  });
});
