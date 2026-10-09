import { afterEach, describe, expect, it } from "vitest";

import { figureAnchors } from "./anchor";
import { PARTS, type PartDef } from "./Parts";
import {
  defaultCharacter,
  mergePieceCatalogs,
  parsePieceCatalog,
  partConfig,
  partsFor,
  POSES,
  registerParts,
} from "@stickman3d/rig/core";

const hat: PartDef = {
  label: "Mũ thử",
  sockets: ["crown"],
  aspect: 2,
  draw: () => null,
};

describe("registerParts", () => {
  afterEach(() => registerParts({}));

  it("thêm bộ phận của repo vào PARTS, cắm được như bộ phận của rig", () => {
    registerParts({ "test-hat": hat });
    expect(partsFor("crown")).toContain("test-hat");
    const c = defaultCharacter();
    Object.assign(c.pieces.crown, { src: "part", part: "test-hat", scale: 0.5 });
    const { w, h } = figureAnchors(c, POSES.idle).slots.crown.box;
    expect(w / h).toBeCloseTo(2);
  });

  it("lượt sau thay cả bộ lượt trước", () => {
    registerParts({ "test-hat": hat });
    registerParts({ "test-cap": hat });
    expect(PARTS["test-hat"]).toBeUndefined();
    expect(PARTS["test-cap"]).toBe(hat);
  });

  it("từ chối tên trùng bộ phận của rig và mục sai hợp đồng, không đụng tới PARTS", () => {
    const nonla = PARTS.nonla;
    expect(() => registerParts({ nonla: hat })).toThrow(/đã có trong rig/);
    expect(PARTS.nonla).toBe(nonla);
    expect(() => registerParts({ x: { ...hat, sockets: ["wing" as "crown"] } })).toThrow(
      /socket lạ "wing"/,
    );
    expect(() => registerParts({ x: { ...hat, aspect: 0 } })).toThrow(/aspect/);
    expect(PARTS.x).toBeUndefined();
  });
});

describe("partConfig", () => {
  const cat = (parts: unknown) => parsePieceCatalog({ parts }).data!;

  it("không có mục danh mục thì là preset của bộ phận", () => {
    expect(partConfig("nonla")).toEqual(PARTS["nonla"].preset);
  });

  it("mục danh mục đè từng khoá lên preset", () => {
    const c = partConfig("nonla", cat({ nonla: { dy: -50 } }));
    expect(c).toEqual({ ...PARTS["nonla"].preset, dy: -50 });
  });

  it("lớp trước thắng lớp sau theo tên bộ phận", () => {
    const merged = mergePieceCatalogs(
      cat({ nonla: { dy: -50 } }),
      cat({ nonla: { dy: -10 }, "crown-01": { scale: 2 } }),
    );
    expect(merged.parts).toEqual({ nonla: { dy: -50 }, "crown-01": { scale: 2 } });
  });
});
