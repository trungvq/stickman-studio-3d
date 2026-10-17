import { describe, expect, it } from "vitest";
import { HAND_POSE_KINDS } from "./hand";
import {
  gripAxes,
  gripFrame,
  gripHand,
  gripSpec,
  gripPoint,
  heldDir,
  heldPoint,
  holdRef,
  parseHeldItem,
  type HeldItemSpec,
} from "./heldItem";
import { matVec, type M3, type V3 } from "./lens";
import cocJson from "../../../../apps/studio/public/held/coc.json";

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const det = (R: M3) =>
  R[0] * (R[4] * R[8] - R[5] * R[7]) -
  R[1] * (R[3] * R[8] - R[5] * R[6]) +
  R[2] * (R[3] * R[7] - R[4] * R[6]);
const close = (a: readonly number[], b: readonly number[], eps = 1e-9) =>
  a.forEach((x, i) => expect(x).toBeCloseTo(b[i], -Math.log10(eps)));

/** Điện thoại dựng đứng: màn +z, đầu máy +y */
const PHONE = {
  size: [18, 36, 3.5],
  anchors: {
    screen: { at: [0, 0, 1.75], dir: [0, 0, 1] },
    back: { at: [0, 0, -1.75], dir: [0, 0, -1] },
    top: { at: [0, 18, 0], dir: [0, 1, 0] },
    bottom: { at: [0, -18, 0], dir: [0, -1, 0] },
    edgeR: { at: [9, 0, 0], dir: [1, 0, 0] },
    edgeL: { at: [-9, 0, 0], dir: [-1, 0, 0] },
    speaker: { at: [0, 15, 1.75], dir: [0, 0, 1] },
  },
  grips: {
    khoe: {
      pose: "span",
      at: { anchor: "back", offset: [0, -6, -1.5] },
      palm: { into: "back" },
      fingers: { toward: "edgeR" },
      touch: ["self.hand", "self.foreArm"],
      intent: {
        face: { axis: "screen", toward: "camera" },
        roll: { axis: "top", toward: "up" },
      },
    },
  },
};

const parse = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

describe("held/<món>.json", () => {
  it("nạp được món mẫu chung và món điện thoại", () => {
    expect(gripSpec(parse(cocJson), "quai").pose).toBe("grip");
    expect(parse(PHONE).schemaVersion).toBe(1);
  });

  it("báo mốc không có, mốc thiếu `dir`, lòng tay song song ngón, `up` lẫn `face`", () => {
    const bad = (patch: (j: typeof PHONE) => void) => {
      const j = structuredClone(PHONE);
      patch(j);
      const r = parseHeldItem(j);
      expect(r.success).toBe(false);
      return r.error!.issues.map((i) => i.message).join("; ");
    };
    expect(bad((j) => (j.grips.khoe.at = { anchor: "nope", offset: [0, 0, 0] }))).toMatch(
      /không có mốc `nope`/,
    );
    expect(
      bad((j) => {
        (j.anchors as Record<string, unknown>).mid = { at: [0, 0, 0] };
        j.grips.khoe.palm = { into: "mid" };
      }),
    ).toMatch(/không có `dir`/);
    expect(
      bad((j) => void ((j.grips.khoe as Record<string, unknown>).fingers = { along: "screen" })),
    ).toMatch(/song song/);
    expect(
      bad(
        (j) =>
          ((j.grips.khoe.intent as Record<string, unknown>) = {
            up: "top",
            face: { axis: "screen", toward: "camera" },
          }),
      ),
    ).toMatch(/`up`/);
    expect(bad((j) => void ((j as Record<string, unknown>).schemaVersion = 99))).toMatch(
      /phiên bản/,
    );
  });

  it("điểm, hướng `into` / `along` / `toward` trong khung món", () => {
    const m = parse(PHONE);
    close(heldPoint(m, { anchor: "back", offset: [0, -6, -1.5] }), [0, -6, -3.25]);
    close(heldDir(m, { into: "back" }, [0, 0, 0]), [0, 0, 1]);
    close(heldDir(m, { along: "top" }, [0, 0, 0]), [0, 1, 0]);
    close(heldDir(m, { toward: "edgeR" }, [0, 0, 0]), [1, 0, 0]);
  });

  it("`món#kiểu`", () => {
    expect(holdRef("dien-thoai#tai")).toEqual({ item: "dien-thoai", grip: "tai" });
    expect(() => holdRef("dien-thoai")).toThrow(/món#kiểu/);
  });
});

describe("gripFrame", () => {
  const m = parse(PHONE);
  const g = gripSpec(m, "khoe");

  it("phép quay thật (không soi gương), lòng tay và ngón trùng hướng khai", () => {
    const ax = gripAxes(m, g);
    close(ax.palm, [0, 0, 1]);
    // `toward: edgeR` từ điểm nắm, trực giao hoá theo lòng tay: vắt ngang chếch lên đầu máy
    expect(ax.fingers[2]).toBeCloseTo(0, 9);
    expect(ax.fingers[0]).toBeGreaterThan(0.8);
    for (const side of [-1, 1]) {
      const G = gripFrame(m, gripHand(g, side), side);
      expect(det(G.R)).toBeCloseTo(1, 9);
      close(matVec(G.R, ax.palm), [-side, 0, 0]);
      close(matVec(G.R, ax.fingers), [0, -1, 0]);
    }
  });

  it("tay trái, tay phải cùng kiểu cầm: cùng chỗ trên món, ngón cái ở hai cạnh", () => {
    const at = heldPoint(m, g.at);
    const thumbs: V3[] = [];
    for (const side of [-1, 1]) {
      const G = gripFrame(m, gripHand(g, side), side);
      // tâm nắm của dáng ra khung món
      const c = gripPoint(G, at);
      close(c, [-side * 0.035, -0.117, 0.027]);
      thumbs.push(matVec(tr(G.R), [0, 0, 1]));
    }
    expect(dot(thumbs[0], thumbs[1])).toBeCloseTo(-1, 9);
    // ngón vắt về cạnh phải máy: phía ngón cái tay phải ngả về đáy máy, tay trái về đầu máy
    expect(thumbs[0][1]).toBeLessThan(-0.8);
    expect(thumbs[0][2]).toBeCloseTo(0, 9);
  });

  it("cỡ tay khác, người cỡ khác: điểm `at` vẫn trùng tâm nắm", () => {
    const at = heldPoint(m, g.at);
    for (const [k, long, s] of [
      [1, 1, 1],
      [1.4, 1.1, 1],
      [2, 1.6, 1.3],
    ])
      for (const side of [-1, 1]) {
        const G = gripFrame(m, gripHand(g, side), side, k * s, long * s, s);
        close(gripPoint(G, at), [-side * 0.035 * k * s, -0.117 * long * s, 0.027 * k * s]);
        // món to theo người: hai mốc cách nhau đúng khoảng rig nhân 0,01·s
        const a = gripPoint(G, heldPoint(m, "top"));
        const b = gripPoint(G, heldPoint(m, "bottom"));
        expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeCloseTo(0.36 * s, 9);
      }
  });

  it("`left` đè riêng cho tay trái", () => {
    const coc = parse(cocJson);
    const q = gripSpec(coc, "quai");
    expect(gripHand(q, -1).fingers).toEqual([-1, 0, 0]);
    expect(gripHand(q, 1).fingers).toEqual([1, 0, 0]);
    // cốc cầm quai: ngón cái lên trên ở cả hai tay
    for (const side of [-1, 1]) {
      const G = gripFrame(coc, gripHand(q, side), side);
      close(matVec(tr(G.R), [0, 0, 1]), [0, 1, 0]);
    }
  });
});

describe("thumbsUp", () => {
  it("là dáng soạn được", () => {
    expect(HAND_POSE_KINDS).toContain("thumbsUp");
  });
});
