import { describe, expect, it } from "vitest";
import { actHeld, actJoints, type ActInput } from "./act3";
import { body3 } from "./figure3d";
import { parabolaMin, REFINE_TOL, refineMin } from "./graspArm";
import { parseHeldItem, type HeldItemSpec } from "./heldItem";
import { add3, matVec, scale3, type M3 } from "./lens";
import { itemCentre, parseScene, resolveScene, sceneAt } from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";

// Góc dò liên tục giữa các nấc lưới: đích trôi chậm thì khuỷu trôi theo, không nhảy từng nấc (docs/11-nhom-cam.md § Khuỷu
// tự nhiên)

describe("`parabolaMin`", () => {
  it("đỉnh đúng của parabol, kể cả ba điểm cách không đều", () => {
    const f = (x: number) => 2 * (x - 0.3) ** 2 + 1;
    const v = parabolaMin(-1, f(-1), 0, f(0), 1, f(1))!;
    expect(v.x).toBeCloseTo(0.3, 12);
    expect(v.y).toBeCloseTo(1, 12);
    expect(parabolaMin(-0.4, f(-0.4), 0, f(0), 1, f(1))!.x).toBeCloseTo(0.3, 12);
  });

  it("không kẹp cực tiểu, ba điểm phẳng hay lõm thì `undefined`", () => {
    expect(parabolaMin(0, 1, 1, 2, 2, 3)).toBeUndefined();
    expect(parabolaMin(0, 1, 1, 1, 2, 1)).toBeUndefined();
    expect(parabolaMin(0, 0, 1, 1, 2, 0)).toBeUndefined();
  });
});

describe("`refineMin`", () => {
  const STEP = 1.875;
  const grid = (c: number) => Math.round(c / STEP) * STEP;

  it("giá trơn: cực tiểu trôi đều thì góc trôi đều; parabol đúng tới 1e-6, giá bậc bốn dưới `2 · REFINE_TOL`", () => {
    let prev: number | undefined;
    for (let c = 0; c <= 6; c += 0.01) {
      const q = refineMin(
        (x) => (x - c) ** 2,
        (y) => y,
        grid(c),
        STEP,
      );
      expect(Math.abs(q.x - c)).toBeLessThan(1e-6);
      const r = refineMin(
        (x) => (x - c) ** 2 + 0.1 * (x - c) ** 4,
        (y) => y,
        grid(c),
        STEP,
      );
      expect(Math.abs(r.x - c)).toBeLessThan(2 * REFINE_TOL);
      if (prev !== undefined) expect(Math.abs(r.x - prev)).toBeLessThan(0.01 + 2 * REFINE_TOL);
      prev = r.x;
    }
  });

  it("giá gãy khúc (bình phương cộng bản lề): góc bám chỗ gãy dưới `2 · REFINE_TOL`", () => {
    let prev: number | undefined;
    for (let k = -45; k <= -40; k += 0.01) {
      const cost = (x: number) => 0.008 * x * x + Math.max(0, 20 * (x - k));
      const r = refineMin(cost, (y) => y, grid(k), STEP);
      expect(Math.abs(r.x - k)).toBeLessThan(2 * REFINE_TOL);
      if (prev !== undefined) expect(Math.abs(r.x - prev)).toBeLessThan(4 * REFINE_TOL);
      prev = r.x;
    }
  });

  it("trong tầm `[l, h]`: cực tiểu ngoài tầm thì giữ mép, không thử ngoài tầm", () => {
    const seen: number[] = [];
    const r = refineMin(
      (x) => (seen.push(x), (x - 10) ** 2),
      (y) => y,
      5,
      STEP,
      -5,
      5,
    );
    expect(r.x).toBe(5);
    expect(Math.max(...seen)).toBeLessThanOrEqual(5);
  });
});

describe("tay mang món, đích trôi chậm", () => {
  const parsed = parseCharacter(fx.character);
  if (!parsed.success) throw new Error("nguoi");
  const NGUOI = parsed.data;
  const H = NGUOI.rig.height;
  const DIMS = body3(NGUOI);
  const r = parseHeldItem(dienThoai);
  if (!r.success) throw new Error(r.error.message);
  const PHONE: HeldItemSpec = r.data;
  const hold = { item: "dien-thoai", group: "palmBox", face: { axis: "screen", toward: "camera" } };
  const s = parseScene({
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
            { t: 0, right: { to: "chest", offset: [38, 0, 18], point: "grip", hold } },
            {
              t: 3,
              ease: "linear",
              right: { to: "chest", offset: [46, -8, 24], point: "grip", hold },
            },
          ],
        },
      },
    ],
  });
  if (!s.success) throw new Error(s.error.message);
  const rt = resolveScene(
    s.data,
    {},
    {},
    {},
    { nguoi: H },
    { nguoi: DIMS },
    { "dien-thoai": PHONE },
  );
  rt.chars = { nguoi: NGUOI };
  const c = itemCentre(PHONE);
  const frames = Array.from({ length: 121 }, (_, i) => 0.5 + i / 60).map((t) => {
    const sp = sceneAt(rt, "nguoi", t, H, DIMS) as ActInput;
    const h = actHeld(NGUOI, sp).R!;
    const R: M3 = [h.R[0], h.R[1], h.R[2], -h.R[3], -h.R[4], -h.R[5], -h.R[6], -h.R[7], -h.R[8]];
    return {
      elbow: actJoints(NGUOI, sp)!.elbowR,
      item: add3(h.at, matVec(R, scale3(c, h.s))),
    };
  });
  const steps = (k: "elbow" | "item") =>
    frames.slice(1).map((f, i) => Math.hypot(...f[k].map((v, j) => v - frames[i][k][j])));

  it.each(["elbow", "item"] as const)(
    "%s: không bước nào quá 3 lần trung vị giữa hai khung liền",
    (k) => {
      const d = steps(k);
      const mid = [...d].sort((a, b) => a - b)[d.length >> 1];
      expect(mid).toBeGreaterThan(0.01);
      expect(Math.max(...d)).toBeLessThan(3 * mid);
    },
  );
});
