import { describe, expect, it } from "vitest";
import { parseAction, type ActionData } from "@stickman3d/rig/core";
import {
  actionRoot,
  actionStem,
  filterGroups,
  flatNames,
  groupActions,
  hideNames,
  isMouthOnly,
  libraryRows,
  orderCharacters,
  readLibrary,
  stepIn,
  stepNames,
  siblingsOf,
  writeLibrary,
} from "./libraryList";

const NAMES = [
  "bow-3d",
  "bow-30-3d",
  "bow-15-3d",
  "bow-quick-3d",
  "bow-hands-front-30-3d",
  "bow-hands-front-45-robe-hold-3d",
  "look-up-3d",
  "look-down-3d",
  "turn-head-35-right-3d",
  "turn-head-70-left-3d",
  "turn-head-70-snap-right-3d",
  "sit-3d",
  "sit-3d-staggered",
  "walk",
  "walk-fast",
];

describe("gốc tên hành động", () => {
  it("bỏ đuôi 3d và hậu tố mức, phía, pha", () => {
    expect(actionStem("turn-head-70-right-3d")).toBe("turn-head");
    expect(actionStem("bow-hands-front-45-robe-hold-3d")).toBe("bow-hands-front-45-robe");
    expect(actionStem("nod-soft-3d")).toBe("nod");
    expect(actionStem("sit-3d-staggered")).toBe("sit-staggered");
    expect(actionStem("hold")).toBe("hold");
  });

  it("bỏ từng từ biến khi phần còn lại là thân tên của hành động khác", () => {
    const stems = new Set(NAMES.map(actionStem));
    expect(actionRoot("bow-quick-3d", stems)).toBe("bow");
    expect(actionRoot("bow-hands-front-45-robe-hold-3d", stems)).toBe("bow-hands-front");
    expect(actionRoot("turn-head-70-snap-right-3d", stems)).toBe("turn-head");
    expect(actionRoot("sit-3d-staggered", stems)).toBe("sit");
    expect(actionRoot("walk-fast", stems)).toBe("walk");
    expect(actionRoot("look-up-3d", stems)).toBe("look-up");
    const pour = new Set(["pour-3d", "pour-serve-3d"].map(actionStem));
    expect(actionRoot("pour-serve-kneel-3d", pour)).toBe("pour");
  });

  it("nhóm theo gốc, bản đúng gốc đứng trước, số theo giá trị", () => {
    const g = groupActions(NAMES);
    expect(g.map((x) => x.root)).toEqual([
      "bow",
      "bow-hands-front",
      "look-down",
      "look-up",
      "sit",
      "turn-head",
      "walk",
    ]);
    expect(g[0].names).toEqual(["bow-3d", "bow-15-3d", "bow-30-3d", "bow-quick-3d"]);
    expect(siblingsOf(g, "turn-head-70-left-3d")).toEqual([
      "turn-head-35-right-3d",
      "turn-head-70-left-3d",
      "turn-head-70-snap-right-3d",
    ]);
  });

  it("lọc theo mọi từ, bước vòng hai đầu", () => {
    const g = filterGroups(groupActions(NAMES), "Head right");
    expect(flatNames(g)).toEqual(["turn-head-35-right-3d", "turn-head-70-snap-right-3d"]);
    const all = flatNames(groupActions(NAMES));
    expect(stepIn(all, "bow-3d", -1)).toBe("walk-fast");
    expect(stepIn(all, "walk-fast", 1)).toBe("bow-3d");
    expect(stepIn(all, "không-có", 1)).toBe("bow-3d");
    expect(stepIn([], "bow-3d", 1)).toBeUndefined();
  });
});

const act = (o: Record<string, unknown>): ActionData => {
  const r = parseAction({ name: "x", duration: 1, ...o });
  if (!r.success) throw r.error;
  return r.data;
};
const lip = (keys: Record<string, unknown>[], mask: unknown = ["face"]) =>
  act({
    ...(mask ? { mask } : {}),
    keys: keys.map((k, i) => ({ t: i / keys.length, pose: {}, ...k })),
  });

describe("hành động chỉ nhép miệng", () => {
  it("chỉ mốc khẩu hình, khai hay không khai mask", () => {
    expect(isMouthOnly(lip([{ face: { mouth: "closed" } }, { face: { mouth: "o" } }]))).toBe(true);
    expect(isMouthOnly(lip([{ face: { mouth: "o" } }, {}], null))).toBe(true);
  });

  it("có góc, đích, bàn tay, mắt, mày, má hay kênh khác thì không", () => {
    const m = { face: { mouth: "o" } };
    expect(isMouthOnly(lip([m, { pose: { head: [10, 0, 0] } }], null))).toBe(false);
    expect(isMouthOnly(lip([m, { pose: "talk" }]))).toBe(false);
    expect(isMouthOnly(lip([{ face: { mouth: "o", eyes: "shut" } }]))).toBe(false);
    expect(isMouthOnly(lip([{ face: { mouth: "o", brow: "lifted" } }]))).toBe(false);
    expect(isMouthOnly(lip([{ face: { mouth: "o", blush: 0.5 } }]))).toBe(false);
    expect(isMouthOnly(lip([m, { hand: { armRight: "open" } }], null))).toBe(false);
    expect(isMouthOnly(lip([m], ["face", "head"]))).toBe(false);
    expect(isMouthOnly(lip([{}, {}]))).toBe(false);
    expect(isMouthOnly({ ...lip([{ face: { mouth: "o" } }]), keys: undefined })).toBe(false);
  });

  it("ẩn tên khỏi nhóm, giữ tên đang mở", () => {
    const g = groupActions(["lip-a-01", "lip-a-02", "nod-3d"]);
    const hide = new Set(["lip-a-01", "lip-a-02"]);
    expect(flatNames(hideNames(g, hide))).toEqual(["nod-3d"]);
    expect(flatNames(hideNames(g, hide, "lip-a-02"))).toEqual(["lip-a-02", "nod-3d"]);
  });
});

describe("gập nhóm và đi phím", () => {
  const g = groupActions([
    "bow-3d",
    "bow-15-3d",
    "bow-30-3d",
    "look-up-3d",
    "nod-3d",
    "nod-soft-3d",
  ]);
  const none = new Map<string, boolean>();
  const shown = (rows: ReturnType<typeof libraryRows>) =>
    rows.map((r) => (r.kind === "root" ? `${r.open ? "▾" : "▸"}${r.root}` : r.name));

  it("nhóm nhiều bản gập, nhóm chứa hành động đang chọn tự mở", () => {
    const rows = libraryRows(g, { fold: none, cur: "nod-soft-3d", searching: false });
    expect(shown(rows)).toEqual(["▸bow", "look-up-3d", "▾nod", "nod-3d", "nod-soft-3d"]);
    expect(stepNames(rows, "nod-soft-3d")).toEqual([
      "bow-3d",
      "look-up-3d",
      "nod-3d",
      "nod-soft-3d",
    ]);
  });

  it("bấm tay thắng luật mặc định; đang tìm thì mở mọi nhóm", () => {
    const fold = new Map([
      ["bow", true],
      ["nod", false],
    ]);
    const rows = libraryRows(g, { fold, cur: "nod-soft-3d", searching: false });
    expect(shown(rows)).toEqual(["▾bow", "bow-3d", "bow-15-3d", "bow-30-3d", "look-up-3d", "▸nod"]);
    // nhóm gập chứa hành động đang chọn đứng cho chính nó: ↑ ↓ không nhảy về đầu
    expect(stepNames(rows, "nod-soft-3d").at(-1)).toBe("nod-soft-3d");
    expect(stepIn(stepNames(rows, "nod-soft-3d"), "nod-soft-3d", 1)).toBe("bow-3d");
    const q = libraryRows(filterGroups(g, "o"), { fold: none, cur: "", searching: true });
    expect(q.filter((r) => r.kind === "root").every((r) => r.open)).toBe(true);
  });
});

describe("người và URL", () => {
  it("người mẫu lên đầu, rồi người của repo, rồi lớp chung", () => {
    const list = orderCharacters([
      { name: "other.json", layer: "common" },
      { name: "zed.json", layer: "repo" },
      { name: "sample-kimono.json", layer: "common" },
      { name: "sample-man.json", layer: "repo" },
      { name: "alice.json", layer: "repo" },
    ]);
    expect(list.map((c) => c.name)).toEqual([
      "sample-man.json",
      "sample-kimono.json",
      "alice.json",
      "zed.json",
      "other.json",
    ]);
  });

  it("ghi rồi đọc lại giữ nguyên trạng thái, khoá sai lấy mặc định", () => {
    const v = {
      action: "bow-3d",
      who: "sample-man",
      angle: "far" as const,
      speed: 0.25,
      loop: false,
      mouth: true,
    };
    const p = writeLibrary(new URLSearchParams("t=1.5&cam=free"), v);
    expect(p.get("t")).toBe("1.5");
    expect(readLibrary(new URLSearchParams(p.toString()))).toEqual(v);
    expect(readLibrary(new URLSearchParams("library=1&angle=top&speed=3"))).toEqual({
      angle: "near",
      speed: 1,
      loop: true,
      mouth: false,
    });
  });
});
