import { describe, expect, it } from "vitest";
import { actAim, actJoints, type ActInput } from "./act3";
import { AIM_BEND, AIM_DEV, clampRange, overRange, TURN_MAX } from "./arm3";
import { body3 } from "./figure3d";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";
import {
  graspAtTime,
  handReport,
  holdRuns,
  parseScene,
  resolveScene,
  sceneAt,
  type HandReport,
} from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";

// Lần cầm và báo tay cho studio (docs/11-nhom-cam.md § Báo tay cho studio)

const spec = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const HELD = { "bang-gia": spec(bangGia), "dien-thoai": spec(dienThoai) };
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const H = NGUOI.rig.height;
const DIMS = body3(NGUOI);
const chars = { nguoi: NGUOI, ban: NGUOI };

const SHEET = { item: "bang-gia", group: "sheet", edge: "right", along: 0.33, thumb: "front" };
const PHONE = { item: "dien-thoai", group: "palmBox" };
const bang = (t: number | string, offset = [30, -2.9, 0]) => ({
  t,
  cast: "nguoi",
  item: "bang-gia",
  to: "chest",
  offset,
  face: { axis: "front", toward: "holderFace" },
  roll: { axis: "top", toward: "up" },
});
const AT_PHONE = [214, -260, 470];

// mốc tay: tay dẫn mốc trước, lần cầm theo mốc, `regrip`, hai tay theo mốc, buông, tay dẫn, tay dẫn có tay phụ
const HANDS = [
  { t: 0, left: { at: [300, -240, 470], point: "grip" } },
  { t: "@cam", right: { hold: SHEET } },
  { t: 1.5, right: { hold: SHEET, elbow: [-0.3, 1, 0.4] } },
  { t: 2, right: { hold: { ...SHEET, regrip: true } } },
  {
    t: "@doi",
    right: { hold: { item: "bang-gia", group: "sheet", edge: "left", variant: "pinch" } },
    left: { hold: { item: "bang-gia", group: "sheet", edge: "right" } },
  },
  { t: 4, right: { hold: null }, left: { hold: null } },
  { t: 4.5, right: { at: AT_PHONE, point: "grip", hold: "dien-thoai@palmBox" } },
  { t: 5.5, right: { at: [220, -280, 460], point: "grip" } },
  { t: 5.8, right: null },
  { t: 6, right: { hold: null } },
  {
    t: 6.5,
    right: { at: [220, -250, 470], point: "grip", hold: { ...SHEET, both: true } },
  },
];
// mốc món của người khác chen trước: chỉ số `itemKeys` trỏ vào mảng JSON
const ITEMS = [
  { t: 1, cast: "ban", item: "dien-thoai", to: "chest", offset: [40, -6, 6] },
  bang("@cam"),
  bang(1.5, [38, -14, 8]),
  bang(2.5, [26, 6, -6]),
  bang(3.2, [35, 0, 0]),
  bang(3.8, [33, -4, 0]),
];

function runtime() {
  const r = parseScene({
    duration: 8,
    marks: { cam: 0.5, doi: 3 },
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [
      {
        id: "nguoi",
        base: { torso: 9, head: [0, 0, -6] },
        world: { at: [250, 0, 506], yaw: 270, hands: HANDS },
      },
      {
        id: "ban",
        base: { torso: 9, head: [0, 0, -6] },
        world: { at: [-250, 0, 506], yaw: 90, hands: [{ t: 0, right: { hold: PHONE } }] },
      },
    ],
    items: ITEMS,
  });
  if (!r.success) throw new Error(r.error.message);
  const rt = resolveScene(
    r.data,
    {},
    {},
    {},
    { nguoi: H, ban: H },
    { nguoi: DIMS, ban: DIMS },
    HELD,
  );
  rt.chars = chars;
  return rt;
}

const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const poseAt = (rt: ReturnType<typeof runtime>, t: number) =>
  sceneAt(rt, "nguoi", t, H, DIMS) as ActInput;

describe("holdRuns", () => {
  const rt = runtime();
  const runs = holdRuns(rt, "nguoi");

  it("lần cầm, chế độ, mốc JSON của từng tay", () => {
    expect(runs.right).toEqual([
      {
        since: 0.5,
        until: 2,
        item: "bang-gia",
        group: "sheet",
        mode: "keyed",
        handKeys: [1, 2],
        itemKeys: [1, 2],
      },
      {
        since: 2,
        until: 3,
        item: "bang-gia",
        group: "sheet",
        mode: "keyed",
        handKeys: [3],
        itemKeys: [3],
      },
      {
        since: 3,
        until: 4,
        item: "bang-gia",
        group: "sheet",
        variant: "pinch",
        mode: "both",
        handKeys: [4],
        itemKeys: [4, 5],
      },
      {
        since: 4.5,
        until: 6,
        item: "dien-thoai",
        group: "palmBox",
        mode: "hand",
        handKeys: [6, 7, 8],
        itemKeys: [],
      },
      {
        since: 6.5,
        until: 8,
        item: "bang-gia",
        group: "sheet",
        mode: "hand",
        handKeys: [10],
        itemKeys: [],
      },
    ]);
    expect(runs.left).toEqual([
      {
        since: 3,
        until: 4,
        item: "bang-gia",
        group: "sheet",
        mode: "both",
        handKeys: [4],
        itemKeys: [4, 5],
      },
      {
        since: 6.5,
        until: 8,
        item: "bang-gia",
        group: "sheet",
        mode: "hand",
        handKeys: [10],
        itemKeys: [],
        lead: "right",
      },
    ]);
    expect(holdRuns(rt, "ban").right).toEqual([
      {
        since: 0,
        until: 8,
        item: "dien-thoai",
        group: "palmBox",
        mode: "keyed",
        handKeys: [0],
        itemKeys: [0],
      },
    ]);
  });

  it("nhớ theo runtime", () => {
    expect(holdRuns(rt, "nguoi")).toBe(runs);
  });

  it("tay phụ của `both` trên món đặt trước: chế độ `both`, mốc của tay dẫn", () => {
    const r = parseScene({
      duration: 3,
      lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
      cast: [
        {
          id: "nguoi",
          base: { torso: 9, head: [0, 0, -6] },
          world: {
            at: [250, 0, 506],
            yaw: 270,
            hands: [
              { t: 0, right: { hold: { ...SHEET, both: true } } },
              { t: 2, right: { hold: null } },
            ],
          },
        },
      ],
      items: [bang(0.5)],
    });
    if (!r.success) throw new Error(r.error.message);
    const rt2 = resolveScene(r.data, {}, {}, {}, { nguoi: H }, { nguoi: DIMS }, HELD);
    expect(holdRuns(rt2, "nguoi").left).toEqual([
      {
        since: 0,
        until: 2,
        item: "bang-gia",
        group: "sheet",
        mode: "both",
        handKeys: [0],
        itemKeys: [0],
        lead: "right",
      },
    ]);
  });
});

describe("handReport", () => {
  const rt = runtime();
  const report = (side: "right" | "left", t: number) => handReport(rt, "nguoi", side, t)!;

  /** Khớp như `actJoints`, góc cổ tay và kẹp như `AimReport.hold.grasp` của cùng khung, vòng khuỷu qua khuỷu vẽ */
  function agrees(h: HandReport, side: "right" | "left", t: number) {
    const sp = poseAt(rt, t);
    const tag = side === "right" ? "R" : "L";
    const J = actJoints(NGUOI, sp)!;
    expect(h.joints.shoulder).toEqual(J[`shoulder${tag}`]);
    expect(h.joints.elbow).toEqual(J[`elbow${tag}`]);
    expect(h.joints.wrist).toEqual(J[`wrist${tag}`]);
    const { center, radius, d0, o0 } = h.ring;
    const p = h.phi * (Math.PI / 180);
    const E = center.map((x, i) => x + radius * (Math.cos(p) * d0[i] + Math.sin(p) * o0[i]));
    expect(dist(E, h.joints.elbow)).toBeLessThan(1e-6);
    const g = actAim(NGUOI, sp)!.report[tag].hold?.grasp;
    if (!g) return;
    const w = g.mode === "hand" || g.keyed ? h.wrist.drawn : h.wrist.raw!;
    expect(w.turn).toBeCloseTo(g.arm.wrist.turn, 9);
    expect(w.bend).toBeCloseTo(g.arm.wrist.bend, 9);
    expect(w.dev).toBeCloseTo(g.arm.wrist.dev, 9);
    const o = h.wrist.over;
    expect(Math.max(o.turn, o.bend, o.dev)).toBeCloseTo(g.arm.wrist.over, 9);
    expect(Math.abs(wrap(h.phi - g.arm.phi))).toBeLessThan(1e-6);
    expect(h.grasp).toEqual(g);
  }

  it("tay tự do: không giá khuỷu, `φ₀` theo đích", () => {
    const h = report("left", 0.2);
    expect(h.mode).toBe("free");
    expect(h.run).toBeUndefined();
    expect(h.cost).toBeNull();
    expect(h.wrist.raw).toBeNull();
    expect(h.phi0).not.toBeNull();
    expect(h.elbowLock).toBe(false);
    agrees(h, "left", 0.2);
    expect(report("right", 0.2).phi0).toBeNull();
  });

  it("theo mốc: lần cầm, `φ₀` từ `elbow` của mốc, nghiệm ở mốc", () => {
    for (const t of [1, 1.5, 1.8]) {
      const h = report("right", t);
      expect(h.mode).toBe("keyed");
      expect(h.run).toBe(holdRuns(rt, "nguoi").right[0]);
      expect(h.blending).toBe(false);
      expect(h.cost!.phi).toHaveLength(36);
      agrees(h, "right", t);
    }
    const sol = graspAtTime(rt, "nguoi", "right", 1.5, { chars })!;
    expect(report("right", 1.5).phi0).toBeCloseTo(sol.arm.phi0, 9);
    // ở mốc món: sau kẹp là nghiệm của mốc kẹp vào miền, phần vượt đo trên nghiệm ấy
    const { raw, drawn, over } = report("right", 1.5).wrist;
    expect(drawn.turn).toBeCloseTo(Math.max(-TURN_MAX, Math.min(TURN_MAX, raw!.turn)), 9);
    expect(drawn.bend).toBeCloseTo(clampRange(raw!.bend, AIM_BEND), 9);
    expect(drawn.dev).toBeCloseTo(clampRange(raw!.dev, AIM_DEV), 9);
    expect(over.bend).toBeCloseTo(overRange(raw!.bend, AIM_BEND), 9);
    expect(over.dev).toBeCloseTo(overRange(raw!.dev, AIM_DEV), 9);
  });

  it("`regrip`: trong `HOLD_BLEND` báo đang hoà", () => {
    const h = report("right", 2.1);
    expect(h.mode).toBe("keyed");
    expect(h.run!.since).toBe(2);
    expect(h.blending).toBe(true);
    expect(report("right", 2.6).blending).toBe(false);
  });

  it("hai tay theo mốc: `E(φ)` của bộ giải, cực tiểu gần `φ`", () => {
    for (const side of ["right", "left"] as const) {
      const h = report(side, 3.5);
      expect(h.mode).toBe("both");
      agrees(h, side, 3.5);
      const sol = graspAtTime(rt, "nguoi", side, 3.5, { chars })!;
      expect(h.phi0).toBeCloseTo(sol.arm.phi0, 9);
      const i = h.cost!.E.indexOf(Math.min(...h.cost!.E));
      expect(Math.abs(wrap(h.cost!.phi[i] - h.phi))).toBeLessThanOrEqual(20);
    }
  });

  it("tay dẫn: tâm nắm ở đích `grip`, góc cổ tay như vẽ", () => {
    const h = report("right", 4.5);
    expect(h.mode).toBe("hand");
    expect(h.wrist.raw).not.toBeNull();
    agrees(h, "right", 4.5);
    const gap = actAim(NGUOI, poseAt(rt, 4.5))!.report.R.reach!.gap;
    expect(Math.abs(dist(h.grip, AT_PHONE) - gap)).toBeLessThan(1e-6);
    // tay phụ của tay dẫn
    const s = report("left", 7);
    expect(s.mode).toBe("hand");
    expect(s.run!.lead).toBe("right");
    agrees(s, "left", 7);
    // lần cầm tới hết cảnh còn ở giây cuối
    expect(report("right", 8).mode).toBe("hand");
    expect(report("left", 8).run!.lead).toBe("right");
  });

  it("gọi theo `t` tăng ra cùng số với gọi nhảy cóc", () => {
    const ts = [0.6, 1.2, 2.4, 3.3, 4.8, 5.2];
    const fwd = ts.map((t) => report("right", t));
    const b = runtime();
    const back = [...ts].reverse().map((t) => handReport(b, "nguoi", "right", t)!);
    back.reverse().forEach((h, i) => {
      expect(h.phi).toBe(fwd[i].phi);
      expect(h.wrist).toEqual(fwd[i].wrist);
      expect(h.cost).toEqual(fwd[i].cost);
    });
  });
});
