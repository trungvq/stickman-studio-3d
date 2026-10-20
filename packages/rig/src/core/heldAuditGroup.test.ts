import { describe, expect, it } from "vitest";
import { AIM_BEND } from "./arm3";
import { AIM_GAP } from "./constants";
import { SIZE_WARN } from "./graspGroups";
import type { GraspReport } from "./graspSolve";
import { handVec } from "./hand";
import {
  HELD_ARM,
  HELD_GRIP,
  HELD_GRIP_PINCH,
  HELD_SINK,
  HELD_WRIST,
  heldGripMax,
  heldHits,
  heldLine,
  heldPlace,
  heldSize,
  sceneHeld,
  type HeldHand,
} from "./heldAudit";
import { itemGeom } from "./heldGeom";
import { HOLD_BLEND, parseHeldItem } from "./heldItem";
import { parseScene, resolveScene, holdBlending } from "./scene";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import chaiDia from "./__fixtures__/held-v2/chai-dia.json";

const parsed = parseHeldItem(bangGia);
if (!parsed.success) throw new Error(parsed.error.message);
const BANG = parsed.data;

const grasp = (
  o: Partial<GraspReport> = {},
  arm: Partial<GraspReport["arm"]> = {},
): GraspReport => ({
  item: "bang-gia",
  group: "sheet",
  mode: "item",
  t0: 0,
  choice: { edge: "right", along: 0.33, thumb: "front", variant: "pinch", featureIndex: 0 },
  by: { edge: "scene", along: "scene", thumb: "scene", variant: "rig" },
  arm: {
    phi: 20,
    wrist: { turn: 10, bend: 10, dev: 5, over: 0, off: 0 },
    body: 0,
    bodyRatio: 0,
    gap: 0,
    ...arm,
  },
  ...o,
});

const fingers = (v = -0.1) => ({ thumb: v, index: v, middle: v, ring: v, pinky: v });
const PINCH = {
  thumb: "press",
  index: "press",
  middle: "press",
  ring: "press",
  pinky: "press",
  palm: "free",
} as const;

/** Tay cầm món đặt trước `bang-gia@sheet` đúng chỗ: ngón chạm, lòng tay tự do */
const sample = (o: Partial<HeldHand> = {}): HeldHand => ({
  id: "a",
  hand: "R",
  item: "bang-gia",
  key: "7|@sheet/pinch//right/front",
  hold: "bang-gia@sheet/pinch//right/front",
  pose: "sheet",
  follow: "wrist",
  acted: handVec({}),
  pierce: { depth: 0.1, core: -2, piece: "index1" },
  gaps: { thumb: -0.1, index: -0.1, fingers: -0.1, palm: 3 },
  fingers: fingers(),
  roles: PINCH,
  grip: -0.5,
  palm: { gap: 3, angle: 20 },
  rel: { p: [0, -8, 0], q: [0, 0, 0, 1] },
  at: [0, -150, 0],
  obj: 7,
  s: 1,
  grasp: grasp(),
  ...o,
});
const rules = (o: Partial<HeldHand>, blend = false) =>
  heldHits(sample(o), {}, blend).map((h) => h.rule);

describe("heldHits: chỗ cầm nhóm", () => {
  it("cầm đúng thì không phạm gì", () => {
    expect(rules({})).toEqual([]);
  });

  it("`reach`: món đặt trước ngoài tầm với quá `AIM_GAP` nhân cỡ người là lỗi", () => {
    expect(rules({ grasp: grasp({}, { gap: AIM_GAP - 1 }) })).toEqual([]);
    const h = heldHits(sample({ grasp: grasp({}, { gap: AIM_GAP + 2 }) }));
    expect(h).toEqual([{ rule: "reach", worst: AIM_GAP + 2, error: true }]);
    expect(rules({ grasp: grasp({}, { gap: AIM_GAP + 2 }), s: 2 })).toEqual([]);
  });

  it("`wrist`: vượt kẹp là lỗi, sát kẹp trong `HELD_WRIST` độ là cảnh báo, xa kẹp thì im", () => {
    const at = (bend: number, over = 0) =>
      heldHits(
        sample({ grasp: grasp({}, { wrist: { turn: 0, bend, dev: 0, over, off: over && 3 } }) }),
      );
    expect(at(AIM_BEND - HELD_WRIST - 1)).toEqual([]);
    expect(at(AIM_BEND - 2)).toEqual([{ rule: "wrist", worst: -2 }]);
    expect(at(AIM_BEND + 8, 8)).toEqual([{ rule: "wrist", worst: 8, error: true }]);
  });

  it("`arm`: tay lấn quá `HELD_ARM` lần bán kính tay", () => {
    expect(rules({ grasp: grasp({}, { body: 1, bodyRatio: HELD_ARM - 0.1 }) })).toEqual([]);
    expect(
      rules({ grasp: grasp({}, { body: 4, bodyRatio: HELD_ARM + 0.2, bodyPart: "fore.torso" }) }),
    ).toEqual(["arm"]);
  });

  it("`role`: ngón `press` hở quá `HELD_WRAP`; ngón `free` hở thì không xét", () => {
    expect(rules({ fingers: { ...fingers(), thumb: 3 } })).toEqual(["role"]);
    expect(
      rules({ fingers: { ...fingers(), pinky: 6 }, roles: { ...PINCH, pinky: "free" } }),
    ).toEqual([]);
  });

  it("`loose`: không vùng da nào của vai trò bắt buộc chạm; lòng tay `free` chạm không tính", () => {
    const far = { fingers: fingers(4), gaps: { thumb: 4, index: 4, fingers: 4, palm: 0 } };
    expect(rules(far)).toEqual(["loose"]);
    expect(rules({ ...far, roles: { ...PINCH, palm: "press" } })).toEqual(["role"]);
  });

  it("`sink`: da lún quá `HELD_SINK`", () => {
    expect(HELD_SINK).toBeCloseTo(0.65, 9);
    expect(rules({ fingers: { ...fingers(), index: -0.5 } })).toEqual([]);
    expect(rules({ fingers: { ...fingers(), index: -1.2 } })).toEqual(["sink"]);
  });

  it("`size`: khối hình đã chọn từ `SIZE_WARN · W`", () => {
    expect(rules({ size: { of: 5, W: 10, ratio: 0.5 } })).toEqual([]);
    expect(rules({ size: { of: 9, W: 10, ratio: 0.9 } })).toEqual(["size"]);
  });

  it("`grip`: tâm nắm ngoài hình món, ngưỡng theo nhóm", () => {
    expect(heldGripMax("sheet")).toBe(HELD_GRIP_PINCH);
    expect(heldGripMax("cylinder")).toBe(HELD_GRIP);
    expect(rules({ grip: HELD_GRIP_PINCH - 1 })).toEqual([]);
    expect(rules({ grip: HELD_GRIP_PINCH + 1 })).toEqual(["grip"]);
    const rod = { grasp: grasp({ group: "cylinder", choice: { variant: "wrap" } }) };
    expect(rules({ ...rod, grip: HELD_GRIP + 1, roles: undefined })).toEqual(["grip"]);
  });

  it("tay dẫn (không `grasp`): nhóm đọc từ khoá lần cầm, không xét `wrist`, `arm`", () => {
    const lead = { grasp: undefined, hold: "dien-thoai@palmBox////", item: "dien-thoai" };
    expect(rules(lead)).toEqual([]);
    expect(rules({ ...lead, grip: HELD_GRIP_PINCH + 1 })).toEqual(["grip"]);
  });

  it("trong cửa sổ hoà lần cầm: không `grip`, `loose`, `role`; `sink` vẫn xét", () => {
    const far = {
      fingers: fingers(80),
      gaps: { thumb: 80, index: 80, fingers: 80, palm: 80 },
      grip: 94,
    };
    expect(rules(far)).toEqual(["loose", "grip"]);
    expect(rules(far, true)).toEqual([]);
    expect(rules({ fingers: { ...fingers(), index: -1.2 } }, true)).toEqual(["sink"]);
  });
});

describe("heldSize", () => {
  it("nhóm có `size` đo khối hình đã chọn theo `W`; nhóm không có thì không có", () => {
    const r = parseHeldItem(chaiDia);
    if (!r.success) throw new Error(r.error.message);
    const i = itemGeom(r.data).features.findIndex((f) => f.kind === "rod" || f.kind === "lathe");
    const g = { group: "cylinder" as const, choice: { featureIndex: i } };
    const s = heldSize(r.data, g, { W: 10 })!;
    expect(s.ratio).toBeCloseTo(s.of / 10, 9);
    expect(heldSize(r.data, g, { W: s.of / (SIZE_WARN + 0.05) })!.ratio).toBeGreaterThan(SIZE_WARN);
    expect(heldSize(r.data, { ...g, group: "sheet" }, { W: 10 })).toBeUndefined();
  });
});

describe("sceneHeld: chỗ cầm nhóm", () => {
  const scene = (hands: unknown[]) => {
    const r = parseScene({
      duration: 2,
      lens: { eye: [0, -300, -900], yaw: 0, pitch: 10, f: 800, cx: 0, cy: 0 },
      cast: [{ id: "a", world: { at: [0, 0, 0], ...(hands.length && { hands }) }, tracks: [] }],
    });
    if (!r.success) throw new Error(r.error.message);
    return resolveScene(r.data, {}, {}, {}, {}, {}, { "bang-gia": BANG });
  };

  it("`holdBlending`: `HOLD_BLEND` giây sau mốc vừa cầm, đổi chỗ cầm, buông; mốc ở giây 0 không hoà", () => {
    const rt = scene([
      { t: 0, right: { hold: "bang-gia@sheet" } },
      { t: 0.5, right: { hold: "bang-gia@sheet" } },
      { t: 1, right: { hold: { item: "bang-gia", group: "sheet", edge: "left" } } },
      { t: 1.5, right: { hold: null } },
    ]);
    const at = (t: number) => holdBlending(rt, "a", "R", t);
    expect([0, 0.2, 0.6, 0.9].map(at)).toEqual([false, false, false, false]);
    expect([1, 1 + HOLD_BLEND - 0.01, 1 + HOLD_BLEND].map(at)).toEqual([true, true, false]);
    expect([1.5, 1.7, 1.9].map(at)).toEqual([true, true, false]);
    expect(holdBlending(rt, "a", "L", 1.1)).toBe(false);
  });

  it("tay đang đi tới món lúc vừa cầm không báo `grip`; hết cửa sổ hoà thì báo", () => {
    const rt = scene([{ t: 1, right: { hold: "bang-gia@sheet" } }]);
    const far = sample({ grasp: undefined, grip: 94, hold: "bang-gia@sheet////" });
    const issues = sceneHeld(rt, { frame: (t) => (t >= 1 && t < 1.25 ? [far] : []) });
    expect(issues).toEqual([]);
    const late = sceneHeld(rt, { frame: (t) => (t >= 1 && t < 1.65 ? [far] : []) });
    expect(late.map((i) => [i.rule, i.runs])).toEqual([["grip", [[1.3, 1.6]]]]);
  });

  it("dòng báo trỏ về chỗ cầm ở cảnh (`món@nhóm` và trường), không về `held/<món>.json`; lỗi mang `error`", () => {
    const rt = scene([]);
    const s = sample({
      grasp: grasp({}, { wrist: { turn: 100, bend: 0, dev: 0, over: 10, off: 2.5 } }),
      fingers: { ...fingers(), thumb: 3 },
    });
    const issues = sceneHeld(rt, { frame: () => [s] });
    const wrist = issues.find((i) => i.rule === "wrist")!;
    expect(wrist.error).toBe(true);
    expect(issues.find((i) => i.rule === "role")!.error).toBeUndefined();
    const lines = issues.map(heldLine);
    for (const l of lines) {
      expect(l).toContain(
        "`bang-gia@sheet` (edge right, along 0.33, thumb front, variant pinch (rig chọn))",
      );
      expect(l).not.toContain("held/");
    }
    expect(lines.find((l) => l.startsWith("cổ tay vượt giới hạn"))).toMatch(
      /xoay 100°\/±90.*vượt 10\.0°, bàn tay vẽ lệch chỗ cầm 2\.5/,
    );
    expect(lines.find((l) => l.startsWith("ngón không chạm món"))).toContain(
      "ngón cái (`press`) cách món 3.0",
    );
    expect(heldPlace({ item: "dien-thoai", hold: "dien-thoai@palmBox////" })).toBe(
      "`dien-thoai@palmBox`",
    );
  });
});
