import { describe, expect, it } from "vitest";
import { HAND_POSE_KINDS } from "./hand";
import {
  GROUP_IDS,
  groupHold,
  holdRunKey,
  SceneHoldSchema,
  sceneHoldRef,
  graspLink,
  gripAxes,
  gripCenter,
  gripPoint,
  HELD_VERSION,
  heldAxis,
  heldPoint,
  migrateHeldItem,
  parseHeldItem,
  type GraspHand,
  type HeldItemSpec,
} from "./heldItem";
import { matVec, type M3, type V3 } from "./lens";
import cocJson from "../../../../apps/studio/public/held/coc.json";
import tuiJson from "../../../../apps/studio/public/held/tui.json";

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const det = (R: M3) =>
  R[0] * (R[4] * R[8] - R[5] * R[7]) -
  R[1] * (R[3] * R[8] - R[5] * R[6]) +
  R[2] * (R[3] * R[7] - R[4] * R[6]);
const close = (a: readonly number[], b: readonly number[], eps = 1e-9) =>
  a.forEach((x, i) => expect(x).toBeCloseTo(b[i], -Math.log10(eps)));

const parse = (j: unknown): HeldItemSpec => {
  const r = parseHeldItem(j);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};

const DIEN_THOAI_V2 = {
  schemaVersion: 2,
  size: [18.45, 37.8, 2.88],
  front: "screen",
  top: "top",
  anchors: {
    screen: { at: [0, 0, 1.44], dir: [0, 0, 1] },
    back: { at: [0, 0, -1.44], dir: [0, 0, -1] },
    top: { at: [0, 18.9, 0], dir: [0, 1, 0] },
    bottom: { at: [0, -18.9, 0], dir: [0, -1, 0] },
    speaker: { at: [0, 17, 1.44], dir: [0, 0, 1] },
  },
  shape: [
    { box: [12.69, 37.8, 2.88] },
    { box: [18.45, 32.04, 2.88] },
    { cyl: 2.88, from: [-6.34, -16.02, -1.44], to: [-6.34, -16.02, 1.44] },
    { box: [6.84, 7.02, 0.81], at: [4.18, 13.77, -1.85], detail: true },
    { cyl: 1.44, from: [5.72, 15.21, -2.25], to: [5.72, 15.21, -3.24], detail: true },
    { box: [0.45, 4.5, 1.44], at: [-9.45, 11.7, 0], detail: true },
  ],
};

const CHAI_DIA_V2 = {
  schemaVersion: 2,
  size: [20.4, 76, 20.4],
  front: "nhan",
  top: "mouth",
  anchors: {
    mouth: { at: [0, 76, 0], dir: [0, 1, 0] },
    shoulder: { at: [0, 56, 0] },
    nhan: { at: [0, 22, 10.45], dir: [0, 0, 1] },
    base: { at: [0, 0, 0], dir: [0, -1, 0] },
  },
  shape: [
    { cyl: 9.4, from: [0, 0, 0], to: [0, 0.8, 0], r2: 10.2, part: "than" },
    { cyl: 10.2, from: [0, 0.8, 0], to: [0, 40, 0], part: "than" },
    { cyl: 10.2, from: [0, 40, 0], to: [0, 44, 0], r2: 9.8, part: "vai" },
    { cyl: 4.4, from: [0, 61, 0], to: [0, 68.5, 0], part: "co" },
    { cyl: 5.1, from: [0, 68.5, 0], to: [0, 76, 0], part: "mieng" },
  ],
  parts: { mieng: { grip: false } },
  hang: ["dong-ruou"],
};

const TUI_HIEU_V2 = {
  schemaVersion: 2,
  size: [65.6, 94.1, 23],
  front: "mat",
  top: "quai",
  anchors: {
    quai: { at: [0, 91.1, 0], dir: [0, 1, 0] },
    treoKhuyu: { at: [0, 87.1, -14] },
    mat: { at: [0, 16.5, 9.18], dir: [0, 0, 1] },
  },
  seats: { elbow: "treoKhuyu", shoulder: "quai" },
  shape: [{ box: [65.6, 70, 23], at: [0, 35, 0] }],
};

describe("held/<món>.json", () => {
  const errs = (j: unknown) => {
    const r = parseHeldItem(j);
    expect(r.success).toBe(false);
    return r.error!.issues.map((i) => i.message).join("; ");
  };
  const edit = <T extends object>(j: T, f: (o: Record<string, unknown>) => void) => {
    const o = structuredClone(j) as Record<string, unknown>;
    f(o);
    return o;
  };

  it("phiên bản 3", () => {
    expect(HELD_VERSION).toBe(3);
  });

  it("`coc`, `tui` mẫu nạp được: phần, chỗ treo", () => {
    const coc = parse(cocJson);
    expect(coc.schemaVersion).toBe(3);
    expect(new Set(coc.shape!.map((b) => b.part))).toEqual(new Set(["than", "quai"]));
    expect(coc.shape!.filter((b) => b.detail)).toHaveLength(2);
    const tui = parse(tuiJson);
    expect(tui.seats).toEqual({ elbow: "quai", shoulder: "quai" });
    expect(tui.shape![0]).toMatchObject({ part: "than" });
  });

  it("`migrateHeldItem`: thiếu số ra 1, bản 2 lên 3, số khác giữ nguyên", () => {
    const noVer: Record<string, unknown> = { ...DIEN_THOAI_V2 };
    delete noVer.schemaVersion;
    expect((migrateHeldItem(noVer) as { schemaVersion: number }).schemaVersion).toBe(1);
    expect((migrateHeldItem(DIEN_THOAI_V2) as { schemaVersion: number }).schemaVersion).toBe(3);
    expect((migrateHeldItem({ schemaVersion: 3 }) as { schemaVersion: number }).schemaVersion).toBe(
      3,
    );
    expect((migrateHeldItem({ schemaVersion: 4 }) as { schemaVersion: number }).schemaVersion).toBe(
      4,
    );
  });

  it("món bản 1 (thiếu `schemaVersion` hay khai 1) bị từ chối, lời báo chỉ `stickman migrate-held`", () => {
    const noVer = edit(DIEN_THOAI_V2, (o) => delete o.schemaVersion);
    expect(errs(noVer)).toMatch(/stickman migrate-held/);
    expect(errs(edit(DIEN_THOAI_V2, (o) => (o.schemaVersion = 1)))).toMatch(
      /stickman migrate-held/,
    );
  });

  it("ba ví dụ của spec nạp được", () => {
    for (const j of [DIEN_THOAI_V2, CHAI_DIA_V2, TUI_HIEU_V2])
      expect(parse(j).schemaVersion).toBe(3);
    const dt = parse(DIEN_THOAI_V2);
    expect(dt.shape![3]).toMatchObject({ detail: true });
    expect(parse(CHAI_DIA_V2).shape![0]).toMatchObject({ part: "than" });
    expect(parse(CHAI_DIA_V2).parts).toEqual({ mieng: { grip: false } });
    expect(parse(TUI_HIEU_V2).seats).toEqual({ elbow: "treoKhuyu", shoulder: "quai" });
  });

  it("`touch`, `parts.as` + `axis`", () => {
    const m = parse(
      edit(CHAI_DIA_V2, (o) => {
        o.touch = ["self.hand", { part: "self.foreArm", max: 2 }];
        o.parts = { than: { as: "rod", axis: [0, 1, 0] }, mieng: { grip: false } };
      }),
    );
    expect(m.touch).toHaveLength(2);
    expect(m.parts?.than).toEqual({ as: "rod", axis: [0, 1, 0] });
  });

  it("thiếu `shape` bị từ chối", () => {
    expect(errs(edit(DIEN_THOAI_V2, (o) => delete o.shape))).toMatch(/cần `shape`/);
  });

  it("`schemaVersion` lạ báo lỗi phiên bản", () => {
    expect(errs(edit(DIEN_THOAI_V2, (o) => (o.schemaVersion = 4)))).toMatch(/phiên bản/);
    expect(errs(edit(DIEN_THOAI_V2, (o) => (o.schemaVersion = 0)))).toMatch(/phiên bản/);
    expect(errs(edit(DIEN_THOAI_V2, (o) => (o.schemaVersion = 99)))).toMatch(/phiên bản/);
  });

  it("`front` / `top` / `seats` trỏ mốc không có hay không có `dir`", () => {
    expect(errs(edit(DIEN_THOAI_V2, (o) => (o.front = "nope")))).toMatch(/không có mốc `nope`/);
    expect(errs(edit(DIEN_THOAI_V2, (o) => (o.top = "nope")))).toMatch(/không có mốc `nope`/);
    expect(errs(edit(CHAI_DIA_V2, (o) => (o.front = "shoulder")))).toMatch(/không có `dir`/);
    expect(errs(edit(CHAI_DIA_V2, (o) => (o.top = "shoulder")))).toMatch(/không có `dir`/);
    expect(errs(edit(DIEN_THOAI_V2, (o) => (o.top = [0, 0, 0])))).toMatch(/vectơ không/);
    expect(errs(edit(TUI_HIEU_V2, (o) => (o.seats = { elbow: "nope" })))).toMatch(
      /không có mốc `nope`/,
    );
    expect(parse(edit(DIEN_THOAI_V2, (o) => (o.top = [0, 1, 0]))).top).toEqual([0, 1, 0]);
  });

  it('`as: "rod"` thiếu `axis`', () => {
    expect(errs(edit(CHAI_DIA_V2, (o) => (o.parts = { than: { as: "rod" } })))).toMatch(
      /`as: "rod"` cần `axis`/,
    );
    expect(
      errs(edit(CHAI_DIA_V2, (o) => (o.parts = { than: { as: "rod", axis: "nope" } }))),
    ).toMatch(/không có mốc `nope`/);
  });

  it("mọi khối đều `grip: false` hay `detail`", () => {
    expect(
      errs(
        edit(CHAI_DIA_V2, (o) => {
          o.shape = [{ cyl: 5, from: [0, 0, 0], to: [0, 5, 0], part: "mieng" }];
        }),
      ),
    ).toMatch(/không còn gì để cầm/);
    expect(
      errs(edit(DIEN_THOAI_V2, (o) => (o.shape = [{ box: [1, 1, 1], detail: true }]))),
    ).toMatch(/không còn gì để cầm/);
    expect(
      parse(
        edit(CHAI_DIA_V2, (o) => {
          o.shape = [
            { cyl: 5, from: [0, 0, 0], to: [0, 5, 0], part: "mieng" },
            { cyl: 5, from: [0, 5, 0], to: [0, 9, 0] },
          ];
        }),
      ).schemaVersion,
    ).toBe(3);
  });

  it("điểm và trục trong khung món", () => {
    const m = parse(DIEN_THOAI_V2);
    close(heldPoint(m, { anchor: "back", offset: [0, -6, -1.5] }), [0, -6, -2.94]);
    close(heldPoint(m, "top"), [0, 18.9, 0]);
    close(heldPoint(m, [1, 2, 3]), [1, 2, 3]);
    close(heldAxis(m, "back"), [0, 0, -1]);
    close(heldAxis(m, [0, 3, 4]), [0, 0.6, 0.8]);
    expect(() => heldPoint(m, "nope")).toThrow(/không có mốc `nope`/);
  });
});

describe("graspLink", () => {
  // điện thoại khoe màn: lưng máy trong lòng tay, ngón vắt về cạnh phải chếch lên đầu máy
  const at: V3 = [0, -6, -2.94];
  const hand: GraspHand = { pose: "span", at, palm: [0, 0, 1], fingers: [9.225, 6, 2.94] };

  it("phép quay thật (không soi gương), lòng tay và ngón trùng hướng khai", () => {
    const ax = gripAxes(hand);
    close(ax.palm, [0, 0, 1]);
    // ngón trực giao hoá theo lòng tay
    expect(ax.fingers[2]).toBeCloseTo(0, 9);
    expect(ax.fingers[0]).toBeGreaterThan(0.8);
    expect(() => gripAxes({ ...hand, fingers: [0, 0, 2] })).toThrow(/song song/);
    for (const side of [-1, 1]) {
      const G = graspLink(hand, side);
      expect(det(G.R)).toBeCloseTo(1, 9);
      close(matVec(G.R, ax.palm), [-side, 0, 0]);
      close(matVec(G.R, ax.fingers), [0, -1, 0]);
    }
  });

  it("tay trái, tay phải cùng bàn tay trên món: cùng chỗ, ngón cái ở hai cạnh", () => {
    const thumbs: V3[] = [];
    for (const side of [-1, 1]) {
      const G = graspLink(hand, side);
      close(gripPoint(G, at), gripCenter("span", side));
      thumbs.push(matVec(tr(G.R), [0, 0, 1]));
    }
    expect(dot(thumbs[0], thumbs[1])).toBeCloseTo(-1, 9);
    // ngón vắt về cạnh phải máy: phía ngón cái tay phải ngả về đáy máy, tay trái về đầu máy
    expect(thumbs[0][1]).toBeLessThan(-0.8);
    expect(thumbs[0][2]).toBeCloseTo(0, 9);
  });

  it("cỡ tay khác, người cỡ khác: điểm `at` vẫn trùng tâm nắm", () => {
    const m = parse(DIEN_THOAI_V2);
    for (const [k, long, s] of [
      [1, 1, 1],
      [1.4, 1.1, 1],
      [2, 1.6, 1.3],
    ])
      for (const side of [-1, 1]) {
        const G = graspLink(hand, side, k * s, long * s, s);
        close(gripPoint(G, at), gripCenter("span", side, k * s, long * s));
        // món to theo người: hai mốc cách nhau đúng khoảng rig nhân 0,01·s
        const a = gripPoint(G, heldPoint(m, "top"));
        const b = gripPoint(G, heldPoint(m, "bottom"));
        expect(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])).toBeCloseTo(0.378 * s, 9);
      }
  });
});

describe("thumbsUp", () => {
  it("là dáng soạn được", () => {
    expect(HAND_POSE_KINDS).toContain("thumbsUp");
  });
});

describe("SceneHoldSchema", () => {
  const ok = (h: unknown) => SceneHoldSchema.safeParse(h);
  const msg = (h: unknown) => {
    const r = ok(h);
    return r.success
      ? ""
      : r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("\n");
  };

  it("14 nhóm", () => {
    expect(GROUP_IDS).toHaveLength(14);
    expect(new Set(GROUP_IDS).size).toBe(14);
  });

  it("`món@nhóm` và `{ item, group, … }` parse", () => {
    expect(ok("bang-gia@sheet").success).toBe(true);
    expect(
      ok({
        item: "bang-gia",
        group: "sheet",
        edge: "right",
        along: 0.33,
        thumb: "front",
        both: { group: "platform", edge: "bottom", along: "mid" },
        touch: ["self.head", { part: "torso", max: 2 }],
        regrip: true,
        keep: true,
      }).success,
    ).toBe(true);
    expect(ok({ item: "tui", group: "carry", on: "elbow", yaw: 20 }).success).toBe(true);
    expect(ok({ item: "chai", group: "cylinder", both: true, around: 30 }).success).toBe(true);
  });

  it("object có `grip` bị từ chối, lời báo chỉ `stickman migrate-held`", () => {
    for (const h of [
      { item: "a", grip: "x", along: 0.5 },
      { item: "dien-thoai", grip: "tai", up: "top" },
    ])
      expect(msg(h)).toMatch(/\{ item, group, … \}.*stickman migrate-held/);
  });

  it("chuỗi có `#` bị từ chối", () => {
    for (const h of ["bang-gia#doc", "a#", "a#b@c", "a@b#c"]) expect(msg(h)).toMatch(/món@nhóm/);
  });

  it("chuỗi có `#`: lời báo chỉ `stickman migrate-held`", () => {
    expect(msg("bang-gia#doc")).toMatch(/stickman migrate-held/);
  });

  it("lỗi có tên từng dạng", () => {
    expect(msg("a@")).toMatch(/món@nhóm/);
    expect(msg("a@khongco")).toMatch(/nhóm cầm/);
    expect(msg("a")).toMatch(/món@nhóm/);
    expect(msg({ item: "a", group: "khongco" })).toMatch(/\{ item, group, … \}.*group/);
    expect(msg({ item: "a", group: "sheet", along: 2 })).toMatch(/along/);
    expect(msg({ item: "a", group: "sheet", both: { thumb: "xyz" } })).toMatch(/both/);
    expect(msg(5)).toMatch(/hold/);
  });

  it("groupHold", () => {
    expect(groupHold("bang-gia@sheet")).toEqual({ item: "bang-gia", group: "sheet" });
    const o = { item: "a", group: "pen" as const, variant: "v" };
    expect(groupHold(o)).toBe(o);
    expect(() => groupHold("a#b")).toThrow(/món@nhóm/);
    expect(() => groupHold("a@khongco")).toThrow(/nhóm cầm/);
  });

  it("khoá lần cầm dựng từ trường rời", () => {
    expect(sceneHoldRef("bang-gia@sheet")).toEqual({ item: "bang-gia", grip: "@sheet////" });
    expect(
      sceneHoldRef({
        item: "cuoc",
        group: "cylinder",
        variant: "v",
        part: "can",
        edge: "top",
        thumb: "up",
      }),
    ).toEqual({ item: "cuoc", grip: "@cylinder/v/can/top/up" });
    expect(holdRunKey("bang-gia@sheet")).toBe("bang-gia@sheet////");
  });
  it("món@nhóm bằng {item, group}", () => {
    const a = sceneHoldRef(groupHold("bang-gia@sheet"));
    expect(a).toEqual(sceneHoldRef("bang-gia@sheet"));
    expect(holdRunKey({ item: "bang-gia", group: "sheet" })).toBe(holdRunKey("bang-gia@sheet"));
  });

  it("`along` và các số trượt cùng khoá, `edge` khác khác khoá", () => {
    const base = { item: "bang-gia", group: "sheet" as const, edge: "right" as const };
    const k = (h: object) => holdRunKey({ ...base, ...h });
    expect(k({ along: 0.2 })).toBe(k({ along: 0.8 }));
    expect(k({ slant: 10, inset: 1, psi: 3, around: 5, tilt: 2 })).toBe(k({}));
    expect(k({ edge: "left" })).not.toBe(k({}));
    expect(k({ edge: 30 })).not.toBe(k({ edge: 40 }));
    expect(k({ thumb: "front" })).not.toBe(k({}));
    expect(k({ part: "x" })).not.toBe(k({}));
    expect(k({ variant: "x" })).not.toBe(k({}));
    expect(k({ regrip: true })).toBe(k({}));
  });
});
