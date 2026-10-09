import { describe, expect, it } from "vitest";

import { figureAnchors } from "./anchor";
import { drawSteps, partGroups } from "./Character";
import { POSES } from "./poses";
import { defaultCharacter } from "./schema";
import type { ArmLayers, BodyPart, View } from "./types";

type Item = { kind: "solid"; n: number } | { kind: "part"; id: string; part: BodyPart };
const P = (id: string, part: BodyPart): Item => ({ kind: "part", id, part });
const S = (n: number): Item => ({ kind: "solid", n });
const ref = (x: Item) => (x.kind === "part" ? x : undefined);
const label = (g: Item[][]) =>
  g.map((x) => x.map((y) => (y.kind === "part" ? `${y.id}:${y.part}` : `#${y.n}`)).join("+"));

const RIG: BodyPart[][] = [
  ["torso"],
  ["legFar", "shinFar"],
  ["armFar"],
  ["legNear", "shinNear"],
  ["torso"],
  ["armNear"],
  ["head"],
];
const steps = () => RIG;

describe("partGroups", () => {
  it("gộp các phần liền nhau cùng người theo đúng thứ tự rig", () => {
    const g = partGroups(
      [P("a", "legFar"), P("a", "armFar"), P("a", "legNear"), P("a", "armNear"), P("a", "head")],
      ref,
      steps,
    );
    expect(label(g)).toEqual(["a:legFar+a:armFar+a:legNear+a:armNear+a:head"]);
  });

  it("đồ khối xen giữa thì cắt nhóm", () => {
    const g = partGroups([P("a", "legFar"), S(1), P("a", "armFar"), P("a", "head")], ref, steps);
    expect(label(g)).toEqual(["a:legFar", "#1", "a:armFar+a:head"]);
  });

  it("thứ tự đảo so với rig thì không gộp đoạn ấy, vẫn gộp đoạn con thuận", () => {
    const g = partGroups(
      [P("a", "head"), P("a", "armNear"), P("a", "legFar"), P("a", "armFar")],
      ref,
      steps,
    );
    expect(label(g)).toEqual(["a:head", "a:armNear", "a:legFar+a:armFar"]);
  });

  it("khối có bước trải hai bên khối kia không gộp với nó", () => {
    // thân vẽ cả trước lẫn sau chân
    const g = partGroups([P("a", "legNear"), P("a", "torso"), P("a", "head")], ref, steps);
    expect(label(g)).toEqual(["a:legNear", "a:torso+a:head"]);
  });

  it("hai khối cần chung một nét không gộp", () => {
    const g = partGroups([P("a", "legFar"), P("a", "shinFar")], ref, steps);
    expect(label(g)).toEqual(["a:legFar", "a:shinFar"]);
  });

  it("hai người xen nhau không gộp sang nhau", () => {
    const g = partGroups(
      [P("a", "legFar"), P("b", "legNear"), P("a", "armFar"), P("a", "head"), P("b", "head")],
      ref,
      steps,
    );
    expect(label(g)).toEqual(["a:legFar", "b:legNear", "a:armFar+a:head", "b:head"]);
  });

  it("người không có bước thì mỗi phần một nhóm", () => {
    const g = partGroups([P("a", "legFar"), P("a", "armFar")], ref, () => undefined);
    expect(label(g)).toEqual(["a:legFar", "a:armFar"]);
  });
});

describe("drawSteps", () => {
  const c = defaultCharacter();
  const lastTorso = (s: BodyPart[][]) => s.map((x) => x.includes("torso")).lastIndexOf(true);
  const at = (body: View, layers: ArmLayers = { armFar: "mid", armNear: "mid" }) =>
    drawSteps(c, figureAnchors(c, POSES.idle, { body, head: body }), { layers, root: "hip" });

  it("đùi và ống chân cùng một bước; thân trải trước chân khi có mảng tóc sau", () => {
    const s = at("quarter");
    expect(s).toContainEqual(["legFar", "shinFar"]);
    const torso = s.flatMap((x, i) => (x.includes("torso") ? [i] : []));
    const leg = s.findIndex((x) => x.includes("legNear"));
    expect(torso[0]).toBeLessThan(leg);
    expect(torso.at(-1)).toBeGreaterThan(leg);
  });

  it("thân `side` khoá cẳng tay xa dưới thân", () => {
    const s = at("side", { armFar: "front", armNear: "mid" });
    const fore = s.findIndex((x) => x.includes("forearmFar"));
    expect(fore).toBeLessThan(lastTorso(s));
  });

  it("thân `back`: cánh tay gần trước thân áo", () => {
    const s = at("back");
    expect(s.findIndex((x) => x.includes("armNear"))).toBeLessThan(lastTorso(s));
  });
});
