import { describe, expect, it } from "vitest";

import {
  body3,
  defaultCharacter,
  parseAction,
  parseScene,
  resolveScene,
  sceneAt,
} from "@stickman3d/sketch";
import { box, type SolidItem } from "./solid";
import { solidOrder, solidOverdraws, type SolidNode } from "./solidOrder";
import { solidBody } from "./SolidWorld";

const TONE = { top: "#a00", lit: "#0a0", side: "#00a" };

describe("solidOverdraws: thứ tự vẽ ngược độ sâu", () => {
  const c = defaultCharacter();
  const LENS = { eye: [0, -504, -1000], yaw: 0, pitch: 0, f: 800, cx: 0, cy: -200 };
  // mặt bục y −54, hai người đứng trên bục chân choãi, một quầy thấp trước người b
  const stage: SolidItem = {
    name: "bucSan",
    at: { at: [0, 0, 0] },
    parts: [{ v: box(-640, 640, -54, 0, -180, 465), tone: TONE }],
  };
  const counter: SolidItem = {
    name: "quay",
    at: { at: [0, 0, 0] },
    parts: [{ v: box(200, 400, -140, -54, 0, 60), tone: TONE }],
  };
  const stand = parseAction({
    name: "stand",
    duration: 2,
    authoredAt: "side",
    mask: ["legFar", "legNear"],
    keys: [{ t: 0, pose: { legFar: [-6, 0], legNear: [7, 0] } }],
  });
  if (!stand.success) throw new Error(stand.error.message);
  const r = parseScene({
    lens: LENS,
    duration: 2,
    cast: [
      {
        id: "a",
        world: { at: [-110, -54, 130], yaw: 0.2 },
        tracks: [{ clips: [{ action: "stand", start: 0 }] }],
      },
      {
        id: "b",
        world: { at: [300, -54, 150], yaw: 2.9 },
        tracks: [{ clips: [{ action: "stand", start: 0 }] }],
      },
    ],
  });
  if (!r.success) throw new Error(r.error.message);
  const rt = resolveScene(r.data, { stand: stand.data! });
  const lens = rt.lens!;
  const people = ["a", "b"].map((id) => {
    const sp = sceneAt(rt, id, 0, c.rig.height, body3(c));
    return solidBody(id, { character: c, ...sp })!;
  });
  const items = [stage, counter];

  it("thứ tự của `solidOrder`: không báo", () => {
    expect(solidOverdraws(lens, items, people, { tol: 2 })).toEqual([]);
  });

  it("mặt bục dời xuống cuối lượt vẽ: báo bục đè lên ống chân hai người", () => {
    const order = solidOrder(lens, items, people);
    const isStage = (n: SolidNode) => n.kind === "solid" && n.s.part === stage.parts[0];
    const late = [...order.filter((n) => !isStage(n)), ...order.filter(isStage)];
    const hits = solidOverdraws(lens, items, people, { tol: 2, order: late });
    const shins = hits.filter((h) => h.part.startsWith("shin"));
    expect(new Set(shins.map((h) => h.id))).toEqual(new Set(["a", "b"]));
    for (const h of hits) expect(h).toMatchObject({ item: 0, piece: 0, over: true });
  });

  it("quầy dời lên đầu lượt vẽ: báo người b vẽ đè lên quầy đứng trước", () => {
    const order = solidOrder(lens, items, people);
    const isCounter = (n: SolidNode) => n.kind === "solid" && n.s.part === counter.parts[0];
    const early = [...order.filter(isCounter), ...order.filter((n) => !isCounter(n))];
    const hits = solidOverdraws(lens, items, people, { tol: 2, order: early });
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h).toMatchObject({ id: "b", item: 1, piece: 0, over: false });
    // món khai `touch` cho đúng các phần ấy thì im
    const ok = { ...counter, touch: hits.map((h) => `${h.id}.${h.part}`) };
    expect(solidOverdraws(lens, [stage, ok], people, { tol: 2, order: early })).toEqual([]);
  });
});
