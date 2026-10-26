import {
  handReport,
  itemAt,
  itemCentre,
  matMul,
  matVec,
  wristAngles,
  type M3,
} from "@stickman3d/rig/core";
import { describe, expect, it } from "vitest";
import {
  anchorHand,
  dragHand,
  dragItem,
  heldPlace,
  itemPlace,
  lockElbow,
  placeHand,
  placeItem,
  turnShort,
  unlockElbow,
} from "./drag";
import { drawnHand, drawnItem, palmAt, trunkAt } from "./drawn";
import { c, HELD, runtime, scene } from "./fixture";
import {
  angleFrame,
  axisRotation,
  bodyAngles,
  coneRim,
  costAt,
  costRamp,
  fromBody,
  movePoint,
  ringDir,
  ringPhi,
  ringPoint,
  rigRotation,
  toBody,
  turnBody,
  wristDir,
  wrapDeg,
} from "./grab";
import { handsOf, keyValue, worldAtMoves, type Json, type V3 } from "./keys";

const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const dist = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const deg = (a: readonly number[], b: readonly number[]) =>
  (Math.acos(Math.max(-1, Math.min(1, dot(a, b) / Math.hypot(...a) / Math.hypot(...b)))) * 180) /
  Math.PI;
const HELD_BANG = HELD["bang-gia"];
const close = (a: readonly number[], b: readonly number[], eps: number) =>
  a.forEach((x, i) => expect(Math.abs(x - b[i])).toBeLessThan(eps));

/** Thân quay 35° quanh trục đứng, như người đứng chéo */
const Rr: M3 = (() => {
  const a = (35 * Math.PI) / 180;
  return [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
})();

describe("phép đổi của tay nắm (grab.ts)", () => {
  it("hệ thân: tiến, xuống, ngang ra phía tay; đi về", () => {
    const I: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    // three: z tới trước, y lên, x về trái người — rig đảo y, z
    close(toBody([0, 0, -1], I, -1), [1, 0, 0], 1e-12);
    close(toBody([0, 1, 0], I, -1), [0, 1, 0], 1e-12);
    close(toBody([-1, 0, 0], I, -1), [0, 0, 1], 1e-12);
    close(toBody([1, 0, 0], I, 1), [0, 0, 1], 1e-12);
    for (const out of [-1, 1]) {
      const v: V3 = [0.3, -0.7, 0.2];
      close(fromBody(toBody(v, Rr, out), Rr, out), v, 1e-12);
    }
  });

  it("góc theo thân: khung thân tay phải, đi về, quay quanh trục đứng là `quay`", () => {
    const det = (m: M3) =>
      m[0] * (m[4] * m[8] - m[5] * m[7]) -
      m[1] * (m[3] * m[8] - m[5] * m[6]) +
      m[2] * (m[3] * m[7] - m[4] * m[6]);
    expect(det(angleFrame([0, 0, 0], Rr))).toBeCloseTo(1, 12);
    for (const a of [
      [20, -35, 70],
      [-150, 10, -5],
      [0, 89.5, 30],
    ] as V3[])
      close(bodyAngles(angleFrame(a, Rr), Rr), a, 1e-6);
    // gập 90°: `nghiêng` dồn vào `quay`, khung vẫn đúng
    const R = angleFrame([10, 90, 25], Rr);
    close(angleFrame(bodyAngles(R, Rr), Rr), R, 1e-6);
    const down = fromBody([0, 1, 0], Rr, -1);
    const turned = matMul(axisRotation(down, 40), angleFrame([15, 0, 0], Rr));
    close(bodyAngles(turned, Rr), [55, 0, 0], 1e-6);
  });

  it("quay 30° quanh một trục: vectơ hệ thân ghi ra khớp tới 1e-6, quay ngược về chỗ cũ", () => {
    const axis = [0.2, -0.9, 0.4];
    const R = axisRotation(axis, 30);
    const b: V3 = [0.6, -0.3, 0.74];
    for (const out of [-1, 1]) {
      const got = turnBody(b, R, Rr, out);
      // trục quay đổi sang hệ thân; hệ thân ngang phải (`out` −1) là hệ tay trái nên chiều quay đảo
      const k = toBody(axis, Rr, out);
      close(got, matVec(axisRotation(k, 30 * out), b), 1e-6);
      expect(deg(got, b)).toBeGreaterThan(1);
      close(turnBody(got, axisRotation(axis, -30), Rr, out), b, 1e-9);
      close(turnBody(k, R, Rr, out), k, 1e-9);
    }
  });

  it("quay three → rig: cùng phép quay trên vectơ đã đảo y, z", () => {
    const R3 = axisRotation([0.3, 0.5, -0.8], 40);
    const v3: V3 = [0.1, 0.9, -0.2];
    const a = matVec(R3, v3);
    const b = matVec(rigRotation(R3), [v3[0], -v3[1], -v3[2]]);
    close([a[0], -a[1], -a[2]], b, 1e-12);
  });

  it("vòng khuỷu: φ ↔ điểm đi về; thang giá rẻ 0, đắt 1", () => {
    const ring = {
      center: [10, -200, 30] as V3,
      radius: 12,
      d0: [0, 1, 0] as V3,
      o0: [0.6, 0, 0.8] as V3,
    };
    for (const phi of [-170, -90, -12.5, 0, 45, 179]) {
      const p = ringPoint(ring, phi);
      expect(dist(p, ring.center)).toBeCloseTo(12, 9);
      expect(wrapDeg(ringPhi(ring, p) - phi)).toBeCloseTo(0, 9);
      expect(Math.hypot(...ringDir(ring, phi))).toBeCloseTo(1, 12);
    }
    const E = [0.2, 0.3, 5, 3.2, 0.2];
    expect(costRamp(E)).toEqual([0, expect.closeTo(Math.sqrt(0.1 / 3), 9), 1, 1, 0]);
    const cost = { phi: [-180, -90, 0, 90], E: [4, 2, 0, 2] };
    expect(costAt(cost, -45)).toBeCloseTo(1, 9);
    expect(costAt(cost, 135)).toBeCloseTo(3, 9);
    expect(costAt(cost, 180)).toBeCloseTo(4, 9);
  });

  it("nón cổ tay: hướng bàn tay đọc lại đúng góc cổ tay, mép nón ở giới hạn", () => {
    for (const side of [-1, 1]) {
      const d = wristDir(30, 20, -10, side);
      expect(Math.hypot(...d)).toBeCloseTo(1, 12);
      const rim = coneRim(30, side);
      expect(rim).toHaveLength(32);
      expect(rim[0]).toEqual(wristDir(30, -60, -30, side));
      // không gập, không lệch: thẳng theo cẳng tay (−y)
      close(wristDir(70, 0, 0, side), [0, -1, 0], 1e-12);
      expect(wristAngles).toBeTypeOf("function");
    }
  });
});

// thao tác kéo trên cảnh thử: phải (`right`) tay tự do 0–2 s, theo mốc bảng giá 2–3,5 s; trái (`left`) cầm cốc đồ theo tay
describe("kéo tay nắm, vòng khuỷu (drag.ts)", () => {
  const O = { rebuild: runtime, fps: 30, dur: 4, char: c };
  const count = (j: Json, side: string) =>
    (handsOf(j, "a") ?? []).filter((k) => k[side] !== undefined).length;

  it("dời tay tự do: không có mốc ở giây ấy thì chèn mốc rồi sửa", { timeout: 120_000 }, () => {
    const j = scene();
    const rt = runtime(j);
    for (const [t, add] of [
      [0.6, true],
      [1.2, false],
    ] as const) {
      const d0 = drawnHand(rt, "a", "right", t)!;
      expect(d0.mode).toBe("free");
      const r = dragHand(j, rt, "a", "right", t, { d: [6, -8, 4] }, O);
      expect(r.added).toBe(add);
      expect(count(r.raw, "right")).toBe(count(j, "right") + (add ? 1 : 0));
      const d1 = drawnHand(runtime(r.raw), "a", "right", t)!;
      expect(dist(d1.grip, [d0.grip[0] + 6, d0.grip[1] - 8, d0.grip[2] + 4])).toBeLessThan(0.5);
      expect((keyValue(r.raw, r.key) as Json).ease).toBeDefined();
    }
  });

  it("xoay tay tự do ghi `palm` + `fingers`: lòng tay quay theo", { timeout: 120_000 }, () => {
    const j = scene();
    const rt = runtime(j);
    const t = 1.2;
    const p0 = palmAt(rt, "a", "right", t, c)!;
    const R = axisRotation([0, 1, 0], 25);
    const r = dragHand(j, rt, "a", "right", t, { d: [0, 0, 0], R }, O);
    const v = keyValue(r.raw, r.key) as Json;
    const tk = trunkAt(rt, "a", t, c)!;
    close(v.palm as number[], toBody(matVec(R, p0.palm), tk.Rr, -1), 1e-3);
    const rt2 = runtime(r.raw);
    const p1 = palmAt(rt2, "a", "right", t, c)!;
    expect(deg(p1.palm, matVec(R, p0.palm))).toBeLessThan(3);
    expect(deg(p1.finger, matVec(R, p0.finger))).toBeLessThan(6);
    expect(r.gap).toBeLessThan(0.5);
  });

  it("xoay đồ theo tay ghi ý định `hold.face`, `hold.roll`", { timeout: 120_000 }, () => {
    const j = scene();
    const rt = runtime(j);
    const t = 1.25;
    const d0 = drawnHand(rt, "a", "left", t)!;
    expect(d0.mode).toBe("hand");
    const R = axisRotation([1, 0, 0], 20);
    const r = dragHand(j, rt, "a", "left", t, { d: [0, 0, 0], R }, O);
    expect(r.added).toBe(true);
    const tk = trunkAt(rt, "a", t, c)!;
    const face = turnBody(d0.axes!.face, R, tk.Rr, 1);
    const hold = (keyValue(r.raw, r.key) as Json).hold as Json;
    expect(hold).toMatchObject({ item: "coc", group: "cylinder" });
    close((hold.face as Json).toward as number[], face, 1e-3);
    const d1 = drawnHand(runtime(r.raw), "a", "left", t)!;
    expect(deg(d1.axes!.face, face)).toBeLessThan(5);
    expect(r.gap).toBeLessThan(0.5);
  });

  it("tay theo đồ: dời, xoay món quanh tâm nắm, ghi mốc `items[]`", { timeout: 120_000 }, () => {
    const j = scene();
    const rt = runtime(j);
    const chars = { chars: { a: c } };
    const centre = (r: ReturnType<typeof itemAt>) => {
      const q = itemCentre(HELD_BANG);
      return matVec(r!.R, [q[0] * r!.s, q[1] * r!.s, q[2] * r!.s]).map((x, i) => x + r!.P[i]);
    };
    // không có mốc món ở 2,5 s: chèn mốc (chỗ, hướng như đang vẽ) rồi dời
    expect(drawnHand(rt, "a", "right", 2.5)!.mode).toBe("keyed");
    const seen = drawnItem(rt, "a", "right", "bang-gia", 2.5)!;
    const r = dragItem(j, rt, "a", "right", 2.5, { d: [4, 0, -3] }, O);
    expect(r.added).toBe(true);
    expect((r.raw.items as Json[]).length).toBe((j.items as Json[]).length + 1);
    const p1 = itemAt(runtime(r.raw), "bang-gia", 2.5, chars)!;
    expect(dist(centre(p1), [seen.at[0] + 4, seen.at[1], seen.at[2] - 3])).toBeLessThan(0.6);
    // mốc sẵn có (3 s, theo mốc thân `to` + `offset`): sửa mốc ấy; món quay đúng `R` quanh tâm nắm
    const t = 3;
    const p0 = itemAt(rt, "bang-gia", t, chars)!;
    const grip = drawnHand(rt, "a", "right", t)!.grip;
    const R = axisRotation([0.3, 0.2, 1], 30);
    const r2 = dragItem(j, rt, "a", "right", t, { d: [0, -5, 0], R }, O);
    expect(r2.added).toBe(false);
    expect((r2.raw.items as Json[]).length).toBe((j.items as Json[]).length);
    expect((r2.raw.items as Json[])[1]).toMatchObject({ to: "chest" });
    const p2 = itemAt(runtime(r2.raw), "bang-gia", t, chars)!;
    for (const a of [
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
    ] as V3[])
      close(matVec(p2.R, a), matVec(R, matVec(p0.R, a)), 2e-3);
    expect(dist(centre(p2), movePoint(centre(p0), grip, R, [0, -5, 0]))).toBeLessThan(0.5);
    expect(r2.gap).toBeLessThan(0.5);
  });

  it(
    "ô số của mốc món: tâm món tới đúng chỗ, góc đúng số, chỉ dời giữ hướng của mốc",
    { timeout: 120_000 },
    () => {
      const j = scene();
      const rt = runtime(j);
      const t = 3;
      const p0 = itemPlace(rt, "a", "bang-gia", t, c)!;
      const at: V3 = [p0.at[0] + 6, p0.at[1], p0.at[2]];
      const r = placeItem(j, rt, "a", "right", t, { at }, O);
      expect(r.added).toBe(false);
      expect((r.raw.items as Json[])[1]).toMatchObject({ to: "chest" });
      const p1 = itemPlace(runtime(r.raw), "a", "bang-gia", t, c)!;
      expect(dist(p1.at, at)).toBeLessThan(0.5);
      // chỉ dời thì giữ ý định hướng của mốc (`face` hướng về mặt người cầm)
      expect((r.raw.items as Json[])[1].face).toEqual((j.items as Json[])[1].face);
      const angles: V3 = [p0.angles[0] + 20, p0.angles[1], p0.angles[2] - 10];
      const r2 = placeItem(j, rt, "a", "right", t, { angles }, O);
      const p2 = itemPlace(runtime(r2.raw), "a", "bang-gia", t, c)!;
      close(p2.angles, angles, 0.05);
      expect(dist(p2.at, p0.at)).toBeLessThan(0.5);
    },
  );

  it("ô số của mốc tay đồ theo tay: món tới đúng chỗ, góc đúng số", { timeout: 120_000 }, () => {
    const j = scene();
    const rt = runtime(j);
    const t = 1.25;
    const p0 = heldPlace(rt, "a", "left", "coc", t, c)!;
    const at: V3 = [p0.at[0] - 5, p0.at[1] + 4, p0.at[2]];
    const r = placeHand(j, rt, "a", "left", t, { at }, O);
    const p1 = heldPlace(runtime(r.raw), "a", "left", "coc", t, c)!;
    expect(dist(p1.at, at)).toBeLessThan(0.6);
    const angles: V3 = [p0.angles[0] + 6, p0.angles[1], p0.angles[2]];
    const r2 = placeHand(j, rt, "a", "left", t, { angles }, O);
    const p2 = heldPlace(runtime(r2.raw), "a", "left", "coc", t, c)!;
    // so khung, không so số: góc có thể ra cách nhau 360°
    const Rb = trunkAt(rt, "a", t, c)!.Rr;
    close(angleFrame(p2.angles, Rb), angleFrame(angles, Rb), 0.02);
    expect(dist(p2.at, p0.at)).toBeLessThan(0.6);
  });

  it(
    "thả sát mép tầm với: `at` ghi ra nằm sát tâm nắm, không vượt tầm với",
    { timeout: 120_000 },
    () => {
      const j = scene();
      const rt = runtime(j);
      const t = 1.2;
      const r0 = handReport(rt, "a", "right", t, { char: c })!;
      const { shoulder, elbow, wrist } = r0.joints;
      const reach = dist(shoulder, elbow) + dist(elbow, wrist) + dist(wrist, r0.grip);
      // tay ra ngoài và chúc xuống, tâm nắm ở 99,5% tầm với: tay gần duỗi thẳng, Jacobian theo trục cánh tay gần 0
      const dir = [0.25, 0.94, 0.23].map((x) => x / Math.hypot(0.25, 0.94, 0.23));
      const want = shoulder.map((x, i) => x + dir[i] * reach * 0.995) as V3;
      const r = dragHand(
        j,
        rt,
        "a",
        "right",
        t,
        { d: want.map((x, i) => x - r0.grip[i]) as V3 },
        O,
      );
      const at = (keyValue(r.raw, r.key) as Json).at as number[];
      const d1 = drawnHand(runtime(r.raw), "a", "right", t)!;
      expect(dist(at, d1.grip)).toBeLessThan(5);
      expect(dist(at, shoulder)).toBeLessThan(reach + 5);
    },
  );

  it(
    "thả ngoài tầm với: `at` kéo về chỗ bàn tay với tới, thanh trạng thái báo",
    { timeout: 120_000 },
    () => {
      const j = scene();
      const rt = runtime(j);
      const t = 1.2;
      const r0 = handReport(rt, "a", "right", t, { char: c })!;
      const r = dragHand(j, rt, "a", "right", t, { d: [60, 160, 40] }, O);
      const at = (keyValue(r.raw, r.key) as Json).at as number[];
      const d1 = drawnHand(runtime(r.raw), "a", "right", t)!;
      expect(r.gap).toBeGreaterThan(0.5);
      expect(r.notes.join(" ")).toMatch(/ngoài tầm với/);
      expect(dist(at, d1.grip)).toBeLessThan(5);
      expect(dist(at, r0.joints.shoulder)).toBeLessThan(200);
    },
  );

  it(
    "mốc `at` còn hiệu lực lúc người quay: báo, đổi sang mốc thân thì tay quay theo người",
    { timeout: 120_000 },
    () => {
      const j = scene();
      const w = (j.cast as Json[])[0].world as Json;
      delete w.at;
      w.path = [
        { t: 0, at: [0, 0, 0], yaw: 90 },
        { t: 1.6, at: [0, 0, 0], yaw: 90 },
        { t: 2.2, at: [0, 0, 0], yaw: 270 },
      ];
      const rt = runtime(j);
      const ref = { kind: "hand", id: "a", side: "left", index: 3 } as const;
      expect(worldAtMoves(j, ref)).toEqual({ t: 1.6, turn: 1.6 });
      const r = anchorHand(j, rt, "a", "left", 1.5, O);
      const v = keyValue(r.raw, r.key) as Json;
      expect(v.at).toBeUndefined();
      expect(v).toMatchObject({ to: "hip", point: "grip" });
      expect(worldAtMoves(r.raw, r.key)).toBeUndefined();
      expect(r.gap).toBeLessThan(0.5);
      const rt1 = runtime(r.raw);
      const body = (rtx: typeof rt, t: number) =>
        toBody(drawnHand(rtx, "a", "left", t)!.grip, trunkAt(rtx, "a", t, c)!.Rr, 1);
      close(body(rt1, 1.5), body(rt, 1.5), 0.5);
      // sau khi quay: đích theo mốc thân giữ chỗ trên thân, `at` thế giới thì không
      close(body(rt1, 3), body(rt1, 1.5), 1.5);
      expect(dist(body(rt, 3), body(rt, 1.5))).toBeGreaterThan(20);
    },
  );

  it(
    "vòng khuỷu: khoá ở góc thả, `handReport.phi` khớp; nhấp đúp bỏ khoá",
    { timeout: 120_000 },
    () => {
      const j = scene();
      const rt = runtime(j);
      for (const [side, t] of [
        ["right", 1.2],
        ["right", 2.5],
        ["left", 1.25],
      ] as const) {
        const r0 = handReport(rt, "a", side, t, { char: c })!;
        const want = wrapDeg(r0.phi + 35);
        const r = lockElbow(j, rt, "a", side, t, want, O);
        const r1 = handReport(runtime(r.raw), "a", side, t, { char: c })!;
        expect(r1.elbowLock, `${side} ${t}`).toBe(true);
        expect(Math.abs(wrapDeg(r1.phi - want)), `${side} ${t}`).toBeLessThan(0.5);
        expect(r.phi!.got).toBeCloseTo(r1.phi, 6);
        const u = unlockElbow(r.raw, "a", side, t);
        const v = keyValue(u.raw, u.key) as Json;
        expect(v.elbowLock).toBeUndefined();
        expect(v.elbow).toBeUndefined();
      }
      expect(() => unlockElbow(j, "a", "right", 1.2)).toThrow(/không có mốc khoá/);
    },
  );
});

describe("turnShort", () => {
  const before = { palm: [1, 0, 0] as V3, finger: [0, 1, 0] as V3 };
  const R = axisRotation([0, 0, 1], 40);
  const turned = { palm: matVec(R, before.palm), finger: matVec(R, before.finger) };

  it("xoay tới (lệch dưới 2° hay một phần mười góc) thì không báo", () => {
    expect(turnShort(R, before, turned, [])).toBeUndefined();
    const most = axisRotation([0, 0, 1], 37);
    const part = { palm: matVec(most, before.palm), finger: matVec(most, before.finger) };
    expect(turnShort(R, before, part, ["bend"])).toBeUndefined();
  });

  it("xoay không tới thì báo góc xoay được và khớp kẹp", () => {
    const half = axisRotation([0, 0, 1], 15);
    const part = { palm: matVec(half, before.palm), finger: matVec(half, before.finger) };
    expect(turnShort(R, before, part, ["bend", "dev"])).toBe(
      "bàn tay chỉ xoay được ~15° / 40° (lệch 25°), cổ tay kẹp gập, lệch",
    );
    expect(turnShort(R, before, before, [])).toMatch(/~0° \/ 40°.*hết miền khớp/);
  });
});
