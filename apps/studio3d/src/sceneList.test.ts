import { describe, expect, it } from "vitest";
import { filterScenes, groupScenes } from "./sceneList";

describe("groupScenes", () => {
  it("nhóm theo tập, số tập theo thứ tự số, nhóm khác đứng cuối", () => {
    const g = groupScenes([
      "boi-canh-bep",
      "t10-s001-a",
      "t02-s002-b",
      "t02-s001-c",
      "kenh-avatar",
    ]);
    expect(g).toEqual([
      { key: "t02", names: ["t02-s002-b", "t02-s001-c"] },
      { key: "t10", names: ["t10-s001-a"] },
      { key: "", names: ["boi-canh-bep", "kenh-avatar"] },
    ]);
  });
});

describe("filterScenes", () => {
  it("mọi từ đều phải có trong tên, không phân biệt hoa thường", () => {
    const names = ["t01-s001-dt", "t01-s002-kawa", "t02-s001-kawa"];
    expect(filterScenes(names, " KAWA t02 ")).toEqual(["t02-s001-kawa"]);
    expect(filterScenes(names, "")).toEqual(names);
  });
});
