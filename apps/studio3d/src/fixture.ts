// Cảnh thử chung của test trang: một người mặc đồ, cốc (đồ theo tay) và bảng giá (tay theo đồ, theo mốc).
import {
  body3,
  defaultCharacter,
  parseAction,
  parseHeldItem,
  parseScene,
  resolveScene,
  type HeldItemSpec,
  type SceneRuntime,
} from "@stickman3d/rig/core";
import bangGia from "../../../packages/rig/src/core/__fixtures__/held-v2/bang-gia.json";
import cocJson from "../../../common/held/coc.json";
import type { Json } from "./keys";

const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
export const HELD = { coc: spec(cocJson), "bang-gia": spec(bangGia) };
const still = parseAction({
  name: "still",
  duration: 1,
  end: "hold",
  authoredAt: "side",
  keys: [{ t: 0, pose: {} }],
}).data!;
export const c = defaultCharacter();
c.palette.clad = true;
export const SHEET = {
  item: "bang-gia",
  group: "sheet",
  edge: "right",
  along: 0.33,
  thumb: "front",
};

export function scene(): Json {
  return {
    name: "x",
    duration: 4,
    marks: { m: 1.5 },
    lens: { eye: [0, -250, -1400], yaw: 0, pitch: 0, f: 800, cx: 0, cy: 0 },
    cast: [
      {
        id: "a",
        character: "a.json",
        tracks: [{ clips: [{ action: "still", start: 0 }] }],
        world: {
          at: [0, 0, 0],
          yaw: 90,
          hands: [
            {
              t: 0,
              right: { at: [36, -250, -40], point: "grip", elbow: [-0.6, 1, -0.3] },
              left: { at: [40, -250, -40], point: "grip", hold: "coc@cylinder" },
            },
            { t: 1, left: { at: [50, -270, -30], point: "grip", ease: "auto" } },
            { t: 1.2, right: { at: [30, -260, -50], point: "grip", elbow: [-0.3, 1, 0.4] } },
            { t: "@m", left: { at: [45, -280, -20], point: "grip", ease: "auto" } },
            { t: 2, right: { hold: { ...SHEET, along: 0.3 } } },
            { t: 3, right: { hold: { ...SHEET, along: 0.6 } } },
            { t: 3.5, right: { hold: null } },
          ],
        },
      },
    ],
    items: [
      {
        t: 2,
        cast: "a",
        item: "bang-gia",
        to: "chest",
        offset: [30, -3, 0],
        face: { axis: "front", toward: "holderFace" },
        roll: { axis: "top", toward: "up" },
      },
      {
        t: 3,
        cast: "a",
        item: "bang-gia",
        to: "chest",
        offset: [38, -14, 8],
        face: { axis: "front", toward: "holderFace" },
        roll: { axis: "top", toward: "up" },
      },
    ],
  };
}

export function runtime(j: Json): SceneRuntime {
  const p = parseScene(j);
  if (!p.success) throw new Error(p.error.message);
  const rt = resolveScene(p.data, { still }, { a: 1 }, { a: body3(c) }, HELD);
  rt.chars = { a: c };
  return rt;
}
