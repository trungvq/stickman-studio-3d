import { describe, expect, it } from "vitest";
import { handVec } from "./hand";
import {
  capsuleDepth,
  heldHits,
  heldLine,
  HELD_PIERCE,
  meshInside,
  meshSigned,
  meshWinding,
  nearestHandPose,
  quatAngle,
  heldLegacyLine,
  sceneHeld,
  segMeshDistance,
  type HeldCarry,
  type HeldHand,
  type HeldItemPose,
} from "./heldAudit";
import type { V3 } from "./lens";
import { parseHeldItem } from "./heldItem";
import { parseScene, resolveScene } from "./scene";
import chenJson from "./__fixtures__/held-v2/chen.json";

/** Hộp kín thẳng trục `lo..hi`, 12 tam giác quấn ra ngoài; `flip` quấn ngược */
function box(lo: V3, hi: V3, flip = false): Float32Array {
  const P = (i: number): V3 => [
    i & 1 ? hi[0] : lo[0],
    i & 2 ? hi[1] : lo[1],
    i & 4 ? hi[2] : lo[2],
  ];
  const quads = [
    [0, 2, 3, 1],
    [4, 5, 7, 6],
    [0, 1, 5, 4],
    [2, 6, 7, 3],
    [0, 4, 6, 2],
    [1, 3, 7, 5],
  ];
  const out: number[] = [];
  for (const [a, b, c, d] of quads)
    for (const t of [
      [a, b, c],
      [a, c, d],
    ]) {
      const tri = flip ? [t[0], t[2], t[1]] : t;
      for (const i of tri) out.push(...P(i));
    }
  return new Float32Array(out);
}

const CUBE = [box([-1, -1, -1], [1, 1, 1])];
/** Chén vuông: đáy và bốn thành là năm hộp kín chồng mép lên nhau, lòng chén rỗng */
const CUP = [
  box([-2, 0, -2], [2, 0.4, 2]),
  box([-2, 0, -2], [-1.6, 3, 2]),
  box([1.6, 0, -2], [2, 3, 2]),
  box([-2, 0, -2], [2, 3, -1.6]),
  box([-2, 0, 1.6], [2, 3, 2]),
];

describe("hình học lưới món", () => {
  it("số vòng: 1 trong hộp kín, 0 ngoài, không phụ thuộc chiều quấn", () => {
    expect(meshWinding(CUBE, [0.2, 0.1, -0.3])).toBeCloseTo(1, 5);
    expect(meshWinding(CUBE, [3, 0, 0])).toBeCloseTo(0, 5);
    expect(meshWinding([box([-1, -1, -1], [1, 1, 1], true)], [0, 0, 0])).toBeCloseTo(1, 5);
  });

  it("món lõm ghép nhiều mảnh: thành chén là trong, lòng chén là ngoài, chỗ hai mảnh chồng vẫn là trong", () => {
    expect(meshInside(CUP, [0, 1.5, 0])).toBe(false);
    expect(meshInside(CUP, [-1.8, 1.5, 0])).toBe(true);
    expect(meshInside(CUP, [-1.8, 0.2, -1.8])).toBe(true);
    expect(meshSigned(CUP, [0, 1.5, 0]).d).toBeCloseTo(1.1, 5);
    expect(meshSigned(CUP, [-1.8, 1.5, 0]).d).toBeCloseTo(-0.2, 5);
  });

  it("nang ngoài món: khe; trục trong món: bán kính cộng độ sâu", () => {
    expect(capsuleDepth(CUBE, [2, -0.5, 0], [2, 0.5, 0], 0.5, 5)).toBeCloseTo(-0.5, 5);
    expect(capsuleDepth(CUBE, [0.5, -0.5, 0], [0.5, 0.5, 0], 0.2, 5)).toBeCloseTo(0.7, 5);
    // ngón trong lòng chén không chạm thành: không lún
    expect(capsuleDepth(CUP, [0, 1, 0], [0, 2, 0], 0.5, 5)).toBeCloseTo(-0.1, 5);
  });

  it("tấm mỏng: trục cắt qua tấm là lún tới bán kính", () => {
    const sheet = [box([-2, -2, -0.01], [2, 2, 0.01])];
    expect(segMeshDistance(sheet, [0, 0, -1], [0, 0, 1])).toBe(0);
    expect(capsuleDepth(sheet, [0, 0, -1], [0, 0, 1], 0.3, 5)).toBeGreaterThanOrEqual(0.3 - 1e-6);
  });
});

describe("dáng tay", () => {
  it("dáng gần nhất của số bàn tay là chính dáng ấy; dáng nghỉ là rest", () => {
    expect(nearestHandPose(handVec("pinch")).pose).toBe("pinch");
    expect(nearestHandPose(handVec("cup")).pose).toBe("cup");
    expect(nearestHandPose(handVec({})).pose).toBe("rest");
  });

  it("quatAngle: nửa vòng quanh một trục là 180°", () => {
    expect(quatAngle([0, 0, 0, 1], [0, 1, 0, 0])).toBeCloseTo(180, 5);
    const h = Math.SQRT1_2;
    expect(quatAngle([0, 0, 0, 1], [0, h, 0, h])).toBeCloseTo(90, 5);
  });
});

const sample = (o: Partial<HeldHand> = {}): HeldHand => ({
  id: "a",
  hand: "R",
  item: "chen",
  key: "chen|grip",
  pose: "grip",
  follow: "level",
  acted: handVec("grip"),
  pierce: { depth: -0.5, core: -3, piece: "index1" },
  gaps: { thumb: 0.2, index: 0.5, fingers: 0.3, palm: 2 },
  grip: -1,
  palm: { gap: 2, angle: 10 },
  rel: { p: [0, -8, 0], q: [0, 0, 0, 1] },
  at: [0, -150, 0],
  ...o,
});

describe("heldHits: luật một giây", () => {
  it("cầm đúng thì không phạm gì", () => {
    expect(heldHits(sample())).toEqual([]);
  });

  it("hành động khai pinch mà hold vẽ grip: dáng khác; hành động không khai dáng thì không so", () => {
    expect(heldHits(sample({ acted: handVec("pinch") })).map((h) => h.rule)).toEqual(["pose"]);
    expect(heldHits(sample({ acted: handVec({}) }))).toEqual([]);
  });

  it("ngón lún quá ngưỡng, món không chạm tay, tâm nắm xa món, trục lệch", () => {
    const rules = (o: Partial<HeldHand>) => heldHits(sample(o)).map((h) => h.rule);
    expect(rules({ pierce: { depth: 7, core: HELD_PIERCE + 1, piece: "palm" } })).toEqual([
      "pierce",
    ]);
    expect(rules({ gaps: { thumb: 4, index: 5, fingers: 3, palm: 6 } })).toEqual(["loose"]);
    expect(rules({ grip: 9 })).toEqual(["grip"]);
    expect(rules({ up: 50, face: { angle: 80, toward: "camera" } })).toEqual(["up", "face"]);
  });
});

describe("sceneHeld: luật trên cả cảnh", () => {
  const r = parseScene({
    duration: 2,
    lens: { eye: [0, -300, -900], yaw: 0, pitch: 10, f: 800, cx: 0, cy: 0 },
    cast: [{ id: "a", world: { at: [0, 0, 0] }, tracks: [] }],
  });
  if (!r.success) throw new Error(r.error.message);
  const rt = resolveScene(r.data, {});

  it("dáng khác dáng khai suốt cả lần cầm: một dòng, đủ quãng giây", () => {
    const issues = sceneHeld(rt, {
      frame: (t) => (t <= 1 ? [sample({ acted: handVec("pinch") })] : []),
    });
    expect(issues.map((i) => i.rule)).toEqual(["pose"]);
    expect(issues[0].runs).toEqual([[0, 1]]);
    expect(heldLine(issues[0])).toContain("hành động khai `pinch` mà `hold` vẽ `grip`");
  });

  it("quãng ngắn hơn `hold` không báo", () => {
    const issues = sceneHeld(rt, {
      frame: (t) => [sample(t >= 0.5 && t <= 0.6 ? { grip: 9 } : {})],
    });
    expect(issues).toEqual([]);
  });

  it("món xoay dần trong khung bàn tay: trôi, so với lúc bắt đầu cầm; cầm lại là lần mới", () => {
    const turn = (deg: number): HeldHand["rel"]["q"] => {
      const a = (deg * Math.PI) / 360;
      return [0, Math.sin(a), 0, Math.cos(a)];
    };
    const issues = sceneHeld(rt, {
      frame: (t) =>
        t < 1
          ? [sample({ rel: { p: [0, -8, 0], q: turn(t * 60) } })]
          : [sample({ key: "khac", rel: { p: [0, -8, 0], q: turn(0) } })],
    });
    expect(issues.map((i) => i.rule)).toEqual(["drift"]);
    expect(issues[0].drift!.from).toBe(0);
    expect(issues[0].drift!.turn).toBeGreaterThan(50);
    expect(issues[0].runs[0][1]).toBeLessThan(1);
  });
});

describe("đồ cầm theo `world.hands`", () => {
  const rigid = (o: Partial<HeldHand> = {}) =>
    sample({
      hold: "chen@bowl////",
      key: "7|@bowl////",
      follow: "wrist",
      obj: 7,
      fingers: { thumb: 0, index: 0, middle: 0, ring: 0, pinky: 0 },
      ...o,
    });

  it("dòng báo món treo lấy đúng tên món, trỏ chỗ cầm của cảnh", () => {
    const carry = (hold: string, o: Partial<HeldCarry> = {}): HeldCarry => ({
      id: "a",
      hand: "R",
      item: "tui-hieu",
      hold,
      on: "shoulder",
      key: `1|${hold}|shoulder`,
      at: [0, -150, 0],
      seat: 0,
      body: { gap: -9, part: "torso" },
      swing: 0,
      s: 1,
      ...o,
    });
    const r = parseScene({
      duration: 1,
      lens: { eye: [0, -300, -900], yaw: 0, pitch: 10, f: 800, cx: 0, cy: 0 },
      cast: [{ id: "a", world: { at: [0, 0, 0] }, tracks: [] }],
    });
    if (!r.success) throw new Error(r.error.message);
    const rt = resolveScene(r.data, {});
    const line = (c: HeldCarry) => sceneHeld(rt, { frame: () => [c] }).map(heldLine)[0];
    const body = line(carry("tui-hieu@carry"));
    expect(body).toContain("khai `touch` ở chỗ cầm của cảnh");
    expect(body).toContain("`held/tui-hieu.json`");
    expect(body).toContain("chỗ cầm tui-hieu@carry");
    expect(body).not.toMatch(/@carry\.json/);
    const seat = line(carry("tui-hieu@carry", { seat: 20, body: { gap: 5, part: "torso" } }));
    expect(seat).toContain("`seats.shoulder` ở `held/tui-hieu.json`");
  });

  it("chỗ cầm nhóm không đo trôi; món nhảy qua mốc `hold` (gắn, thả, đổi tay) đo hai bên mốc", () => {
    const r = parseScene({
      duration: 3,
      lens: { eye: [0, -300, -900], yaw: 0, pitch: 10, f: 800, cx: 0, cy: 0 },
      cast: [
        {
          id: "a",
          world: {
            at: [0, 0, 0],
            hands: [
              { t: 0.5, right: { hold: "chen@bowl" } },
              { t: 1.5, right: { hold: null } },
              { t: 2.5, right: { hold: "chen@bowl" } },
            ],
          },
          tracks: [],
        },
      ],
    });
    if (!r.success) throw new Error(r.error.message);
    const parsed = parseHeldItem(chenJson);
    if (!parsed.success) throw new Error(parsed.error.message);
    const rt = resolveScene(r.data, {}, {}, {}, {}, {}, { chen: parsed.data });
    const held = (t: number) => (t >= 0.5 && t < 1.5) || t >= 2.5;
    const issues = sceneHeld(rt, {
      // món xoay trong tay suốt quãng cầm: chỗ cầm nhóm không báo trôi
      frame: (t) =>
        held(t) ? [rigid({ rel: { p: [0, -8, 0], q: [0, Math.sin(t), 0, Math.cos(t)] } })] : [],
      items: (t): HeldItemPose[] => [
        {
          obj: 7,
          item: "chen",
          // nằm bàn ở x 0; trong tay ở x 10 — gắn ở 0,5 nhảy, thả ở 1,5 nhảy; lần cầm thứ hai tay tới đúng chỗ món
          p: held(t) ? [t < 2 ? 10 : 0, 0, 0] : [0, 0, 0],
          q: [0, 0, 0, 1],
          shown: true,
          ...(held(t) && { holder: { id: "a", hand: "R" as const } }),
        },
      ],
    });
    expect(issues.map((i) => i.rule)).toEqual(["jump"]);
    expect(issues[0].runs).toEqual([
      [0.5, 0.5],
      [1.5, 1.5],
    ]);
    expect(heldLine(issues[0])).toMatch(/^món nhảy lúc (gắn vào tay|thả) — `a` tay phải cầm chen/);
  });

  it("đường cũ: một dòng cho cả cảnh, kể từng lần cầm", () => {
    const line = heldLegacyLine([
      { id: "a", hand: "R", item: "dien-thoai", follow: "wrist" },
      { id: "b", hand: "L", item: "chen", follow: "level" },
    ]);
    expect(line).toMatch(/^đồ cầm còn đi đường cũ — 2 lần cầm/);
    expect(line).toContain("`b` tay trái cầm chen (`level`)");
    expect(line).toContain("`--skip legacy`");
  });
});
