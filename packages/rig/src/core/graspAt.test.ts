import { describe, expect, it } from "vitest";
import { trunk3, type ActInput } from "./act3";
import { phiChain } from "./graspArm";
import { FLAT_MAX, GRIP_CLEAR } from "./graspGroups";
import {
  chooseMissing,
  CONTACTS,
  graspAt,
  graspCtx,
  graspFrame,
  graspReport,
  handFromItem,
  type GraspCtx,
  type GraspSolution,
} from "./graspSolve";
import {
  alongRoom,
  axialAt,
  bulgeToward,
  faceRho,
  gripSpan,
  itemGeom,
  type RodFeature,
  type SlabFeature,
} from "./heldGeom";
import { gripPoint, HOLD_SLEW_STEP, parseHeldItem, type HeldItemSpec } from "./heldItem";
import { handSkin, skinHand } from "./handMesh";
import { HELD_SINK } from "./heldAudit";
import { heldFit, skinBulge, skinDepth, skinPieces } from "./heldFit";
import { add3, cross3, fromColumns, matMul, matVec, type M3, type V3 } from "./lens";
import type { ItemPose } from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";
import tomHum from "./__fixtures__/held-v2/tom-hum.json";
import chaiDia from "./__fixtures__/held-v2/chai-dia.json";
import ongNgheBan from "./__fixtures__/held-v2/ong-nghe-ban.json";
import khay from "./__fixtures__/held-v2/khay.json";
import dua from "./__fixtures__/held-v2/dua.json";
import but from "./__fixtures__/held-v2/but.json";
import tui from "./__fixtures__/held-v2/tui.json";

// người mẫu đứng cầm bảng ở t = 1; mốc món và số đối chiếu của prototype bước 0 (docs/11-nhom-cam.md mục 5)
const item = (json: unknown): HeldItemSpec => {
  const r = parseHeldItem(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const BANG = item(bangGia);
const LONG = item({
  schemaVersion: 2,
  size: [110, 1, 24],
  front: "front",
  top: "top",
  anchors: {
    front: { at: [0, 1, 0], dir: [0, 1, 0] },
    top: { at: [0, 0.5, -12], dir: [0, 0, -1] },
  },
  shape: [{ box: [110, 1, 24], at: [0, 0.5, 0] }],
});
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const T = trunk3(parsed.data, { pose: fx.pose, world: fx.world } as unknown as ActInput)!;
const TOM = item(tomHum);
const ctx = graspCtx(T, { "bang-gia": BANG, "tam-dai": LONG, "tom-hum": TOM });
const RIGHT = -1;
const LEFT = 1;

type Mark = { P: number[]; x: number[]; y: number[]; z: number[] };
const poseOf = (m: Mark, s = 1): ItemPose => ({
  R: fromColumns(m.x as V3, m.y as V3, m.z as V3),
  P: m.P as V3,
  cast: "nguoi",
  s,
});
const ITEMS = fx.ca.items as Record<string, Mark>;
const CHOOSE = fx.ca.choose as unknown as Record<
  string,
  {
    item: string;
    hands: {
      hand: "right" | "left";
      given: Record<string, string | number>;
      rig: Record<string, string | number>;
      wrist: number[];
    }[];
  }
>;

const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const seg = (sol: GraspSolution, c: GraspCtx) => ({
  S: c.arms[sol.side].S,
  E: sol.arm.elbow,
  W: sol.arm.reach,
});

/** Giải các tay của một ca theo thứ tự: tay phải trước, tay trái tính tay phải vào lấn */
function solveCase(id: string) {
  const c = CHOOSE[id];
  const pose = poseOf(ITEMS[c.item]);
  const out: Record<string, GraspSolution> = {};
  for (const h of c.hands) {
    const side = h.hand === "right" ? RIGHT : LEFT;
    const other = side === LEFT && out.right ? seg(out.right, ctx) : undefined;
    out[h.hand] = graspAt(ctx, { item: "bang-gia", group: "sheet", ...h.given }, pose, side, other);
  }
  return out;
}

describe("handFromItem", () => {
  it("điểm món qua bàn tay về đúng chỗ của món trong thế giới", () => {
    const pose = poseOf(ITEMS.c1, 1.3);
    const g = graspFrame(
      BANG,
      itemGeom(BANG),
      { group: "sheet", edge: "right", thumb: "front", along: 0.33 },
      RIGHT,
      ctx.dims,
      ctx.k * 1.3,
      ctx.long * 1.3,
      1.3,
    );
    const { Wp, Rw } = handFromItem(pose.R, pose.P, pose.s, g.G);
    for (const q of [
      [0, 0, 0],
      [22, 0.6, -29],
      [-10, 1.1, 14],
    ] as V3[]) {
      const h = gripPoint(g.G, q);
      const w = matVec(Rw, h).map((v, i) => v + Wp[i]) as V3;
      const rig = matVec(pose.R, q).map((v, i) => (pose.P[i] + v * pose.s) / 100) as V3;
      expect(dist(w, [rig[0], -rig[1], -rig[2]])).toBeLessThan(1e-12);
    }
    const d = matMul(tr(Rw), Rw);
    for (let i = 0; i < 9; i++) expect(d[i]).toBeCloseTo(i % 4 === 0 ? 1 : 0, 6);
  });

  it("vòng kín với cỡ khác 1, cỡ dọc khác cỡ ngang, tay trái", () => {
    const s = 0.85;
    const pose = poseOf(ITEMS.c2, s);
    const [k, long] = [1.7 * s, 1.4 * s];
    const g = graspFrame(
      BANG,
      itemGeom(BANG),
      { group: "sheet", edge: "left", thumb: "back", variant: "rim", along: 0.7, slant: 10 },
      LEFT,
      ctx.dims,
      k,
      long,
      s,
    );
    const { Wp, Rw } = handFromItem(pose.R, pose.P, pose.s, g.G);
    for (const q of [
      [0, 0, 0],
      [-31, 0.4, 12],
      [8, 1.2, -20],
    ] as V3[]) {
      const w = matVec(Rw, gripPoint(g.G, q)).map((v, i) => v + Wp[i]) as V3;
      const rig = matVec(pose.R, q).map((v, i) => (pose.P[i] + v * s) / 100) as V3;
      expect(dist(w, [rig[0], -rig[1], -rig[2]])).toBeLessThan(1e-12);
    }
    const d = matMul(tr(Rw), Rw);
    for (let i = 0; i < 9; i++) expect(d[i]).toBeCloseTo(i % 4 === 0 ? 1 : 0, 9);
    const c = handFromItem(pose.R, pose.P, pose.s, g.G);
    expect(c).toEqual({ Wp, Rw });
  });

  it("khung cầm dựng với cỡ khác món là lỗi", () => {
    const g = graspFrame(BANG, itemGeom(BANG), { group: "sheet", edge: "right" }, RIGHT, ctx.dims);
    const pose = poseOf(ITEMS.c1, 1.2);
    expect(() => handFromItem(pose.R, pose.P, pose.s, g.G)).toThrow(/cỡ/);
  });
});

describe("graspAt: bốn ca `sheet` của bước 0", () => {
  const rows = Object.entries(CHOOSE).flatMap(([id, c]) => c.hands.map((h) => [id, h] as const));
  const solved = Object.fromEntries(Object.keys(CHOOSE).map((id) => [id, solveCase(id)]));

  it.each(rows)("%s tay %s: lựa chọn của rig và cổ tay ±3° so prototype", (id, h) => {
    const sol = solved[id][h.hand];
    for (const [k, v] of Object.entries(h.rig)) {
      expect(sol.choice[k as keyof typeof sol.choice]).toBe(v);
      expect(sol.by[k as keyof typeof sol.by]).toBe("rig");
    }
    for (const k of Object.keys(h.given)) expect(sol.by[k as keyof typeof sol.by]).toBe("scene");
    expect(sol.by.part).toBe("default");
    expect(sol.by.feature).toBe("default");
    const [turn, bend, dev] = h.wrist;
    expect(Math.abs(sol.arm.wrist.turn - turn)).toBeLessThanOrEqual(3);
    expect(Math.abs(sol.arm.wrist.bend - bend)).toBeLessThanOrEqual(3);
    expect(Math.abs(sol.arm.wrist.dev - dev)).toBeLessThanOrEqual(3);
  });

  it("ca 3 chọn `thumb: back` (mặt bảng ra trước); ca 4 tay phải `rim` vượt xoay cẳng tay", () => {
    expect(solved.c3.right.choice.thumb).toBe("back");
    expect(solved.c3.left.choice.thumb).toBe("back");
    const r = solved.c4.right;
    expect(r.choice.variant).toBe("rim");
    expect(r.arm.wrist.over.turn).toBeGreaterThan(0);
    const rep = graspReport(r, 2);
    expect(rep.arm.wrist.over).toBeCloseTo(r.arm.wrist.over.turn, 9);
    expect(rep.arm.wrist.off).toBeGreaterThan(0);
    const ok = graspReport(solved.c3.right, 2);
    expect(ok.arm.wrist.over).toBe(0);
    expect(ok.arm.wrist.off).toBe(0);
  });

  it("báo đúng kiểu: món, nhóm, chế độ, giây, lựa chọn, nguồn, cánh tay", () => {
    const sol = solved.c1.right;
    const rep = graspReport(sol, 1);
    expect(rep).toEqual({
      item: "bang-gia",
      group: "sheet",
      mode: "item",
      t0: 1,
      choice: sol.choice,
      by: sol.by,
      arm: {
        phi: sol.arm.phi,
        wrist: {
          turn: sol.arm.wrist.turn,
          bend: sol.arm.wrist.bend,
          dev: sol.arm.wrist.dev,
          over: 0,
          off: 0,
        },
        body: sol.arm.body,
        gap: sol.arm.gap,
      },
    });
    expect(sol.choice).toMatchObject({ part: "body", feature: "slab", edge: "right" });
  });

  it("tất định theo thứ tự hỏi và giữa hai lần chạy", () => {
    const a = solveCase("c4");
    solveCase("c2");
    graspAt(ctx, "bang-gia@sheet", poseOf(ITEMS.c3), LEFT);
    const b = solveCase("c4");
    expect(b).toEqual(a);
  });
});

describe("chooseMissing", () => {
  const pose = poseOf(ITEMS.c3);

  it("đủ thiếu `bang-gia@sheet`: hai bậc, mọi trường rời và liên tục do rig", () => {
    const sol = chooseMissing(ctx, "bang-gia@sheet", pose, RIGHT);
    // 4 cạnh × 2 mặt × 3 biến thể, rồi `along` 3 × `slant` 3
    expect(sol.candidates).toBe(24 + 9);
    for (const k of ["edge", "thumb", "variant", "along", "slant"] as const)
      expect(sol.by[k]).toBe("rig");
    expect(sol.cost).toBeGreaterThanOrEqual(sol.arm.E);
  });

  it("cảnh khai đủ thì không giải: một ứng viên, nguồn `scene`", () => {
    const sol = chooseMissing(
      ctx,
      {
        item: "bang-gia",
        group: "sheet",
        edge: "left",
        thumb: "back",
        variant: "pinch",
        along: 0.5,
        slant: 0,
      },
      pose,
      RIGHT,
    );
    expect(sol.candidates).toBe(1);
    for (const k of ["edge", "thumb", "variant", "along", "slant"] as const)
      expect(sol.by[k]).toBe("scene");
  });

  it("`solve: false` lấy mặc định của nhóm, `thumb` là mặt quay về người cầm", () => {
    const sol = chooseMissing(
      ctx,
      { item: "bang-gia", group: "sheet", edge: "left" },
      pose,
      RIGHT,
      { solve: false },
    );
    expect(sol.candidates).toBe(1);
    expect(sol.choice).toMatchObject({ thumb: "back", variant: "pinch", along: 0.5, slant: 0 });
    for (const k of ["thumb", "variant", "along", "slant"] as const)
      expect(sol.by[k]).toBe("default");
  });

  it("mốc món sau cộng trọng số 0,5; mốc ngoài 1,5 s hay quá bốn mốc bị bỏ", () => {
    const hold = { item: "bang-gia", group: "sheet", edge: "left" } as const;
    const base = chooseMissing(ctx, hold, pose, RIGHT, { t0: 1 });
    const one = chooseMissing(ctx, hold, pose, RIGHT, { t0: 1, later: [{ t: 2, pose }] });
    expect(one.cost).toBeCloseTo(base.cost * 1.5 - 0.5 * devOf(base), 9);
    const far = chooseMissing(ctx, hold, pose, RIGHT, { t0: 1, later: [{ t: 2.6, pose }] });
    expect(far.cost).toBe(base.cost);
    const many = chooseMissing(ctx, hold, pose, RIGHT, {
      t0: 1,
      later: [1.2, 1.4, 1.6, 1.8, 2].map((t) => ({ t, pose })),
    });
    expect(many.cost).toBeCloseTo(base.cost * 3 - 2 * devOf(base), 9);
  });
});

describe("chooseMissing: khối hình, mốc sau, cạnh", () => {
  const pose = poseOf(ITEMS.c3);
  const hold = { item: "bang-gia", group: "sheet", edge: "left" } as const;

  it("hai khối cùng phần, cùng loại: nghiệm dựng trên đúng khối của nó", () => {
    const twin = item(bangGia);
    const g = itemGeom(twin);
    const i0 = g.features.findIndex((f) => f.kind === "slab");
    const near = g.features[i0] as SlabFeature;
    const d: V3 = [0, 0, 400];
    const far: SlabFeature = {
      ...near,
      c: add3(near.c, d),
      edges: near.edges.map((e) => ({ ...e, at: add3(e.at, d) })),
    };
    g.features[i0] = far;
    g.features.push(near);
    const c2 = graspCtx(T, { "bang-gia": twin });
    const sol = chooseMissing(c2, hold, pose, RIGHT);
    expect(sol.choice.featureIndex).toBe(g.features.length - 1);
    expect(sol.frame.feature).toBe(near);
    const one = chooseMissing(ctx, hold, pose, RIGHT);
    expect(sol.Wp).toEqual(one.Wp);
    expect(sol.cost).toBe(one.cost);
    const again = graspFrame(
      twin,
      g,
      { ...sol.choice, group: "sheet" },
      RIGHT,
      c2.dims,
      c2.k * c2.s,
      c2.long * c2.s,
      pose.s,
      sol.high,
    );
    expect(again.G).toEqual(sol.frame.G);
    expect(() =>
      graspFrame(twin, g, { group: "sheet", edge: "left", featureIndex: 99 }, RIGHT, c2.dims),
    ).toThrow(/99/);
  });

  it("mốc món sau của người khác hay cỡ khác bị bỏ, không lỗi", () => {
    const base = chooseMissing(ctx, hold, pose, RIGHT, { t0: 1 });
    const other = chooseMissing(ctx, hold, pose, RIGHT, {
      t0: 1,
      later: [
        { t: 1.5, pose: { ...pose, cast: "khac", s: 1.3 } },
        { t: 2, pose: { ...pose, s: 1.2 } },
      ],
    });
    expect(other.cost).toBe(base.cost);
  });

  it("`high` mà chưa khai `edge` là lỗi", () => {
    expect(() => chooseMissing(ctx, "bang-gia@sheet", pose, RIGHT, { high: [1, 0, 0] })).toThrow(
      /edge/,
    );
  });

  it("tay dẫn không khai `edge`: tấm đứng `bottom`, tấm nằm cạnh phía tay ấy", () => {
    const lead = { solve: false } as const;
    for (const side of [RIGHT, LEFT])
      expect(chooseMissing(ctx, "bang-gia@sheet", pose, side, lead).choice.edge).toBe("bottom");
    const flat = item({
      schemaVersion: 2,
      size: [40, 0.6, 34],
      front: [0, 0, 1],
      top: [0, 1, 0],
      anchors: {},
      shape: [{ box: [40, 0.6, 34], at: [0, 0.3, 0] }],
    });
    const c2 = graspCtx(T, { "tam-nam": flat });
    expect(chooseMissing(c2, "tam-nam@sheet", pose, RIGHT, lead).choice.edge).toBe("right");
    expect(chooseMissing(c2, "tam-nam@sheet", pose, LEFT, lead).choice.edge).toBe("left");
  });

  it("chỉ giải cạnh dài ≥ 0,6·W", () => {
    const w = 0.5 * ctx.dims.W;
    const strip = item({
      schemaVersion: 2,
      size: [60, 1, w],
      front: "front",
      top: "top",
      anchors: {
        front: { at: [0, 1, 0], dir: [0, 1, 0] },
        top: { at: [0, 0.5, -w / 2], dir: [0, 0, -1] },
      },
      shape: [{ box: [60, 1, w], at: [0, 0.5, 0] }],
    });
    const c2 = graspCtx(T, { strip });
    const f = itemGeom(strip).features.find((x): x is SlabFeature => x.kind === "slab")!;
    const long = f.edges.filter((e) => e.len >= 0.6 * ctx.dims.W).map((e) => e.name);
    expect(long).toHaveLength(2);
    const sol = chooseMissing(c2, "strip@sheet", pose, RIGHT);
    expect(long).toContain(sol.choice.edge);
    // 2 cạnh × 2 mặt × 3 biến thể, rồi `along` 3 × `slant` 3 quanh ứng viên rời tốt nhất và quanh `pinch` tốt nhất
    expect(sol.candidates).toBe(12 + 9 + 9);
  });
});

describe("chooseMissing `card`", () => {
  const pose = poseOf(ITEMS.c3);
  const card = (front: V3, top: V3) =>
    item({
      schemaVersion: 2,
      size: [28, 0.8, 17.6],
      front,
      top,
      anchors: {},
      shape: [{ box: [28, 0.8, 17.6], at: [0, 0.4, 0] }],
    });
  const c2 = graspCtx(T, { the: card([0, 1, 0], [0, 0, -1]), nam: card([0, 0, 1], [0, 1, 0]) });

  it("đủ thiếu: rig giải `edge`, `thumb`, `along`, `slant`, biến thể `pad`; hai tay không lỗi", () => {
    for (const side of [RIGHT, LEFT]) {
      const sol = graspAt(c2, "the@card", pose, side);
      expect(sol.choice.variant).toBe("pad");
      for (const k of ["edge", "thumb", "along", "slant"] as const) expect(sol.by[k]).toBe("rig");
      expect(Number.isFinite(sol.cost)).toBe(true);
    }
  });

  it("tay dẫn không khai `edge`: tấm đứng `bottom`, tấm nằm cạnh phía tay ấy", () => {
    const lead = { solve: false } as const;
    for (const side of [RIGHT, LEFT])
      expect(chooseMissing(c2, "the@card", pose, side, lead).choice.edge).toBe("bottom");
    expect(chooseMissing(c2, "nam@card", pose, RIGHT, lead).choice.edge).toBe("right");
    expect(chooseMissing(c2, "nam@card", pose, LEFT, lead).choice.edge).toBe("left");
  });
});

describe("chooseMissing `chopsticks`", () => {
  const dc = graspCtx(T, { dua: item(dua) });

  it("đủ thiếu: rig giải `part`, `along` trong miền 0,15–0,45, biến thể `grip`; hai tay không lỗi", () => {
    for (const side of [RIGHT, LEFT]) {
      const sol = graspAt(dc, "dua@chopsticks", poseOf(ITEMS.c3), side);
      expect(sol.choice).toMatchObject({ part: "que", variant: "grip" });
      expect(sol.by.along).toBe("rig");
      expect(sol.choice.along).toBeGreaterThanOrEqual(0.15);
      expect(sol.choice.along).toBeLessThanOrEqual(0.45);
      expect(Number.isFinite(sol.cost)).toBe(true);
    }
  });

  it("tay dẫn lấy `along` mặc định 0,25", () => {
    for (const side of [RIGHT, LEFT])
      expect(
        chooseMissing(dc, "dua@chopsticks", poseOf(ITEMS.c3), side, { solve: false }).choice.along,
      ).toBe(0.25);
  });
});

describe("chooseMissing `pen`", () => {
  const bc = graspCtx(T, { but: item(but) });

  it("đủ thiếu: rig giải `part`, `along` trong miền 0,15–0,45, biến thể `grip`; hai tay không lỗi", () => {
    for (const side of [RIGHT, LEFT]) {
      const sol = graspAt(bc, "but@pen", poseOf(ITEMS.c3), side);
      expect(sol.choice).toMatchObject({ part: "than", variant: "grip" });
      expect(sol.by.along).toBe("rig");
      expect(sol.choice.along).toBeGreaterThanOrEqual(0.15);
      expect(sol.choice.along).toBeLessThanOrEqual(0.45);
      expect(Number.isFinite(sol.cost)).toBe(true);
    }
  });

  it("tay dẫn lấy `along` mặc định 0,3", () => {
    for (const side of [RIGHT, LEFT])
      expect(
        chooseMissing(bc, "but@pen", poseOf(ITEMS.c3), side, { solve: false }).choice.along,
      ).toBe(0.3);
  });
});

describe("chooseMissing `handle`", () => {
  const tc = graspCtx(T, { tui: item(tui) });

  it("đủ thiếu: rig giải `part`, `along`, biến thể `hook` trên thanh ngang của quai; hai tay không lỗi", () => {
    for (const side of [RIGHT, LEFT]) {
      const sol = graspAt(tc, "tui@handle", poseOf(ITEMS.c3), side);
      expect(sol.choice).toMatchObject({ part: "quai", feature: "rod", variant: "hook" });
      const f = itemGeom(item(tui)).features[sol.choice.featureIndex!];
      expect(f.kind === "rod" && f.blocks).toEqual([5]);
      expect(sol.by.along).toBe("rig");
      expect(Number.isFinite(sol.cost)).toBe(true);
    }
  });

  it("tay dẫn lấy `along` mặc định 0,5", () => {
    for (const side of [RIGHT, LEFT])
      expect(
        chooseMissing(tc, "tui@handle", poseOf(ITEMS.c3), side, { solve: false }).choice.along,
      ).toBe(0.5);
  });
});

describe("chooseMissing: giá biến thể", () => {
  // mặt bảng quay về người cầm, mép trên ngửa `a` độ, bảng ở `P`
  const reading = (P: V3, a: number): ItemPose => {
    const r = (a * Math.PI) / 180;
    const y: V3 = [0, -Math.sin(r), -Math.cos(r)];
    const z: V3 = [0, Math.cos(r), -Math.sin(r)];
    return { R: fromColumns(cross3(y, z), y, z), P, cast: "nguoi", s: 1 };
  };
  const at = (pose: ItemPose, variant?: string) =>
    chooseMissing(
      ctx,
      { item: "bang-gia", group: "sheet", ...(variant && { variant }) },
      pose,
      RIGHT,
    );

  it.each([
    ["đứng", [200, -230, 560], 0, 9],
    ["ngửa 20°", [200, -300, 610], 20, 18],
  ] as const)(
    "đọc ngang ngực, bảng %s: `flat` rẻ hơn khi khai mà rig chọn `pinch`",
    (_, P, a, grid) => {
      const pose = reading([...P], a);
      expect(at(pose, "flat").cost).toBeLessThan(at(pose, "pinch").cost);
      const sol = at(pose);
      expect(sol.choice.variant).toBe("pinch");
      expect(sol.by.variant).toBe("rig");
      expect(devOf(sol)).toBeLessThan(0.05);
      // lưới liên tục quanh `pinch` tốt nhất khi ứng viên rời tốt nhất là biến thể khác
      expect(sol.candidates).toBe(24 + grid);
    },
  );

  it("biến thể khác mặc định cộng 0,5: khoe dưới–trên vẫn `rim`", () => {
    const c4 = solveCase("c4");
    for (const s of [c4.right, c4.left]) {
      expect(s.choice.variant).toBe("rim");
      expect(devOf(s)).toBeGreaterThanOrEqual(0.5);
      expect(devOf(s)).toBeLessThanOrEqual(0.55 + 1e-9);
    }
  });
});

/** Phần giá lệch mặc định của nghiệm (giá trừ E và khe ở mốc bắt đầu) */
const devOf = (s: GraspSolution) => s.cost - s.arm.E - (s.arm.gap / 6) ** 2;

describe("chooseMissing: `flat` theo bề dày ở mép", () => {
  const slab = (t: number) =>
    item({
      schemaVersion: 2,
      size: [44, t, 58],
      front: [0, 1, 0],
      top: [0, 0, -1],
      anchors: {},
      shape: [{ box: [44, t, 58], at: [0, t / 2, 0] }],
    });
  // bảng đứng trước ngực, mặt quay về người cầm
  const pose: ItemPose = {
    R: fromColumns([1, 0, 0], [0, 0, -1], [0, 1, 0]),
    P: [200, -230, 560],
    cast: "nguoi",
    s: 1,
  };

  it("tấm dày quá `FLAT_MAX · W` ở mép: rig không thử `flat`; tấm mỏng thì thử", () => {
    const thick = FLAT_MAX * ctx.dims.W + 0.5;
    const c2 = graspCtx(T, { mong: slab(1), day: slab(thick) });
    const keep = CONTACTS.sheet!.flat;
    let n = 0;
    CONTACTS.sheet!.flat = (x) => (n++, keep(x));
    try {
      chooseMissing(c2, "mong@sheet", pose, RIGHT);
      expect(n).toBeGreaterThan(0);
      n = 0;
      expect(chooseMissing(c2, "day@sheet", pose, RIGHT).choice.variant).not.toBe("flat");
      expect(n).toBe(0);
    } finally {
      CONTACTS.sheet!.flat = keep;
    }
  });
});

describe("chooseMissing: vành đĩa", () => {
  // đĩa tôm hùm nằm ngửa trước ngực; `ngua: false` là úp (mặt `bottom` của món hướng lên)
  const dish = (ngua = true): ItemPose => ({
    R: ngua
      ? fromColumns([1, 0, 0], [0, -1, 0], [0, 0, -1])
      : fromColumns([1, 0, 0], [0, 1, 0], [0, 0, 1]),
    P: [250, -240, 590],
    cast: "nguoi",
    s: 1,
  });
  const at = (pose: ItemPose, side: number, more: Record<string, unknown> = {}, solve = true) =>
    chooseMissing(ctx, { item: "tom-hum", group: "sheet", ...more } as never, pose, side, {
      solve,
    });

  it("rig giải vành theo góc, lưới 0–330 bước 30", () => {
    for (const side of [RIGHT, LEFT]) {
      const s = at(dish(), side, { variant: "rim" });
      expect(s.choice.feature).toBe("disc");
      expect(typeof s.choice.edge).toBe("number");
      expect((s.choice.edge as number) % 30).toBe(0);
      expect(s.choice.edge).toBeGreaterThanOrEqual(0);
      expect(s.choice.edge).toBeLessThan(360);
      expect(s.by.edge).toBe("rig");
    }
    // tay phải vành phải (`90`), tay trái vành trái (`270`)
    expect(at(dish(), RIGHT, { variant: "rim" }).choice.edge).toBe(90);
    expect(at(dish(), LEFT, { variant: "rim" }).choice.edge).toBe(270);
  });

  it("`rim` không khai `thumb`: ngón cái ở mặt hướng lên; `pinch` vẫn thử hai mặt", () => {
    const up = at(dish(), RIGHT, { variant: "rim" });
    expect(up.choice.thumb).toBe("top");
    // món khai `top`: mặt `top` cả khi úp; món không khai `top` thì mặt hướng lên trong thế giới
    expect(at(dish(false), RIGHT, { variant: "rim" }).choice.thumb).toBe("top");
    const bare = graspCtx(T, { "tom-hum": item({ ...tomHum, top: undefined }) });
    const rim = (pose: ItemPose) =>
      chooseMissing(bare, { item: "tom-hum", group: "sheet", variant: "rim" }, pose, RIGHT).choice
        .thumb;
    expect(rim(dish())).toBe("top");
    expect(rim(dish(false))).toBe("bottom");
    // tấm 4 cạnh + đĩa 12 góc, một mặt; rồi `along` 3 × `slant` 3
    expect(up.candidates).toBe(16 + 9);
    expect(at(dish(), RIGHT, { variant: "pinch" }).candidates).toBe(16 * 2 + 9);
    expect(at(dish(), RIGHT, { variant: "rim", thumb: "bottom" }).choice.thumb).toBe("bottom");
    expect(at(dish(), RIGHT).choice.thumb).toBe("top");
  });

  it("tên vành vẫn nhận; tay dẫn không khai `edge` lấy góc vành phía tay ấy", () => {
    const named = at(dish(), RIGHT, { variant: "rim", edge: "right", feature: "disc" });
    const deg = at(dish(), RIGHT, { variant: "rim", edge: 90, feature: "disc" });
    expect(named.choice.edge).toBe("right");
    expect(named.frame.G).toEqual(deg.frame.G);
    // góc chỉ có ở đĩa: tấm cùng phần bị bỏ
    const sixty = at(dish(), RIGHT, { edge: 60 });
    expect(sixty.choice).toMatchObject({ feature: "disc", edge: 60 });
    expect(at(dish(), RIGHT, { feature: "disc" }, false).choice.edge).toBe(90);
    expect(at(dish(), LEFT, { feature: "disc" }, false).choice.edge).toBe(270);
  });
});

describe("tay trượt", () => {
  it("`along` 0,2 → 0,8 trên tấm dài: khuỷu đổi ≤ 2,5° mỗi mẫu", () => {
    const pose = poseOf(ITEMS.c3);
    const hold = {
      item: "tam-dai",
      group: "sheet",
      edge: "top",
      thumb: "back",
      variant: "rim",
      slant: 22.5,
    } as const;
    const first = graspAt(ctx, { ...hold, along: 0.2 }, pose, RIGHT);
    const t1 = 2;
    const smooth = (x: number) => x * x * (3 - 2 * x);
    const chain = phiChain(0, t1, (t) => {
      const along = 0.2 + 0.6 * smooth(Math.min(1, t / t1));
      const g = graspFrame(
        LONG,
        itemGeom(LONG),
        { ...hold, along },
        RIGHT,
        ctx.dims,
        ctx.k,
        ctx.long,
        1,
        first.high,
      );
      return { inp: ctx.arms[RIGHT], ...handFromItem(pose.R, pose.P, pose.s, g.G) };
    });
    expect(chain.length).toBe(Math.round(t1 / HOLD_SLEW_STEP) + 1);
    let jump = 0;
    for (let i = 1; i < chain.length; i++)
      jump = Math.max(jump, Math.abs(chain[i].sol.phi - chain[i - 1].sol.phi));
    expect(jump).toBeLessThanOrEqual(2.5);
    expect(Math.abs(chain.at(-1)!.sol.phi - chain[0].sol.phi)).toBeGreaterThan(0);
  });
});

describe("chooseMissing `palmBox`: giá lún da", () => {
  const PHONE = item(dienThoai);
  const pc = graspCtx(T, { "dien-thoai": PHONE });
  // điện thoại trước ngực, màn chếch lên về người cầm, đầu máy lên
  const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
  const unit = (a: V3): V3 => [a[0] / len(a), a[1] / len(a), a[2] / len(a)];
  const n = unit([0, -0.3, -1]);
  const x = unit(cross3([0, -1, 0], n));
  const pose: ItemPose = {
    R: fromColumns(x, cross3(n, x), n),
    P: [230, -265.83, 560],
    cast: "nguoi",
    s: 1,
  };
  /** Lún da và khe ngón của bàn tay đúng khung cầm của nghiệm, ngón ôm theo vai trò */
  const skinOf = (sol: GraspSolution) => {
    const f = sol.frame;
    const skin = handSkin(sol.side, pc.k, pc.long);
    const fit = heldFit({
      v: f.pose,
      side: sol.side,
      k: pc.k,
      long: pc.long,
      shape: PHONE.shape!,
      G: f.G,
      roles: f.roles,
      bulge: skinBulge(skin, f.pose),
    });
    const pos = new Float32Array(skin.pos.length);
    skinHand(skin, [...f.pose, ...fit], pos);
    const { gaps } = skinDepth(pos, skinPieces(skin), f.G, PHONE.shape!);
    return { sink: Math.max(0, -Math.min(...Object.values(gaps))), gaps };
  };

  it("rig chọn `tilt` không lún quá `HELD_SINK`, trỏ–áp út vẫn khép; `tilt` 25 cùng chỗ lún dù cổ tay trong giới hạn", () => {
    const sol = chooseMissing(pc, "dien-thoai@palmBox", pose, RIGHT);
    // `thumb` 2, rồi `along` 3 × `tilt` 6
    expect(sol.candidates).toBe(2 + 18);
    expect(sol.by.tilt).toBe("rig");
    expect(sol.choice.tilt).toBeLessThan(20);
    const got = skinOf(sol);
    expect(got.sink).toBeLessThanOrEqual(HELD_SINK);
    for (const f of ["index", "middle", "ring"] as const) expect(got.gaps[f]).toBeLessThan(0.6);
    expect(Math.max(...Object.values(sol.arm.wrist.over))).toBe(0);
    const steep = chooseMissing(
      pc,
      { ...sol.choice, item: "dien-thoai", group: "palmBox", tilt: 25 },
      pose,
      RIGHT,
    );
    expect(skinOf(steep).sink).toBeGreaterThan(HELD_SINK);
    expect(Math.max(...Object.values(steep.arm.wrist.over))).toBe(0);
    expect(steep.arm.E).toBeLessThan(sol.arm.E);
  });

  it("cảnh khai đủ như fixture `dien-thoai#doc` thì không giải: nghiệm là khung của fixture", () => {
    const given = { thumb: "right", along: 15.9 / 37.8, tilt: 20 } as const;
    const sol = chooseMissing(pc, { item: "dien-thoai", group: "palmBox", ...given }, pose, RIGHT);
    expect(sol.candidates).toBe(1);
    for (const k of ["thumb", "along", "tilt"] as const) expect(sol.by[k]).toBe("scene");
    const g = graspFrame(
      PHONE,
      itemGeom(PHONE),
      { group: "palmBox", ...given },
      RIGHT,
      pc.dims,
      pc.k * pc.s,
      pc.long * pc.s,
      pose.s,
      sol.high,
    );
    expect(sol.frame.G).toEqual(g.G);
  });
});

describe("chooseMissing `cylinder`", () => {
  const cc = graspCtx(T, { "chai-dia": item(chaiDia), "ong-nghe-ban": item(ongNgheBan) });
  // chai đứng trước ngực, đầu trên lên (y rig xuống); ống nghe đứng, mặt trước (loa, mic) quay về người cầm
  const upright: ItemPose = {
    R: fromColumns([1, 0, 0], [0, -1, 0], [0, 0, -1]),
    P: [240, -200, 560],
    cast: "nguoi",
    s: 1,
  };
  const handset: ItemPose = {
    R: fromColumns([1, 0, 0], [0, 0, 1], [0, -1, 0]),
    P: [240, -250, 560],
    cast: "nguoi",
    s: 1,
  };

  /** Biến thể mong đợi: thanh hộp ống nghe áp mặt rộng (`front` / `back`) là `flat`, còn lại `wrap` */
  const variantAt = (id: string, around: number) => {
    if (id !== "ong-nghe-ban") return "wrap";
    const geom = itemGeom(item(ongNgheBan));
    const rod = geom.features.find((f) => f.kind === "rod") as RodFeature;
    const rho = faceRho(rod, axialAt(geom, rod, 0.5, around).rho);
    return Math.abs(rho[0] * rod.wide![0] + rho[1] * rod.wide![1] + rho[2] * rod.wide![2]) < 0.5
      ? "flat"
      : "wrap";
  };

  // `part` × `thumb` 2, rồi `along` 3 × `around` 12; ống nghe bỏ ba `around` (0, 30, 330) về mặt có loa, mic nhô
  it.each([
    ["chai-dia", upright, 3, 12],
    ["ong-nghe-ban", handset, 1, 9],
  ] as const)(
    "đủ thiếu `%s@cylinder`: rig giải `part`, `thumb`, `along`, `around` không lỗi",
    (id, pose, parts, arounds) => {
      for (const side of [RIGHT, LEFT]) {
        const sol = chooseMissing(cc, `${id}@cylinder`, pose, side);
        expect(sol.candidates).toBe(parts * 2 + 3 * arounds);
        for (const k of ["thumb", "along", "around"] as const) expect(sol.by[k]).toBe("rig");
        expect(sol.choice.variant).toBe(variantAt(id, sol.choice.around!));
        expect(Number.isFinite(sol.cost)).toBe(true);
      }
    },
  );

  /** Lún da của bàn tay đúng khung cầm của nghiệm, ngón ôm theo vai trò */
  const sinkOf = (sol: GraspSolution, spec: HeldItemSpec) => {
    const f = sol.frame;
    const skin = handSkin(sol.side, cc.k, cc.long);
    const fit = heldFit({
      v: f.pose,
      side: sol.side,
      k: cc.k,
      long: cc.long,
      shape: spec.shape!,
      G: f.G,
      roles: f.roles,
      bulge: skinBulge(skin, f.pose),
    });
    const pos = new Float32Array(skin.pos.length);
    skinHand(skin, [...f.pose, ...fit], pos);
    const { gaps } = skinDepth(pos, skinPieces(skin), f.G, spec.shape!);
    return Math.max(0, -Math.min(...Object.values(gaps)));
  };

  it("ống nghe: rig không áp lòng tay vào mặt có loa, mic nhô ra; tâm nắm cách chúng ≥ 0,3·W; không lún quá `HELD_SINK`", () => {
    const spec = item(ongNgheBan);
    const geom = itemGeom(spec);
    const rod = geom.features.find((f) => f.kind === "rod") as RodFeature;
    const [seg] = gripSpan(geom, rod);
    const room = alongRoom(seg, GRIP_CLEAR * cc.dims.W)!;
    for (const side of [RIGHT, LEFT]) {
      const sol = chooseMissing(cc, "ong-nghe-ban@cylinder", handset, side);
      expect(sol.by.around).toBe("rig");
      expect(bulgeToward(geom, rod, sol.choice.around!, 0)).toEqual([]);
      expect(sol.choice.along).toBeGreaterThanOrEqual(room[0] - 1e-9);
      expect(sol.choice.along).toBeLessThanOrEqual(room[1] + 1e-9);
      expect(sinkOf(sol, spec)).toBeLessThanOrEqual(HELD_SINK);
    }
    // cảnh khai mặt trước, ngón ôm: ngón đâm vào loa
    const front = chooseMissing(
      cc,
      { item: "ong-nghe-ban", group: "cylinder", around: 0, variant: "wrap" },
      handset,
      RIGHT,
    );
    expect(sinkOf(front, spec)).toBeGreaterThan(HELD_SINK);
  });

  it("ống nghe: cảnh khai `along` sát loa thì tâm nắm kẹp cách loa 0,3·W", () => {
    const geom = itemGeom(item(ongNgheBan));
    const rod = geom.features.find((f) => f.kind === "rod") as RodFeature;
    const [seg] = gripSpan(geom, rod);
    expect(seg.cut).toEqual(["mic", "loa"]);
    const hi = 1 - (GRIP_CLEAR * cc.dims.W) / seg.len;
    for (const along of [1, 0.95]) {
      const sol = chooseMissing(
        cc,
        { item: "ong-nghe-ban", group: "cylinder", along, around: 180, thumb: "up" },
        handset,
        RIGHT,
      );
      expect(sol.by.along).toBe("scene");
      expect(sol.choice.along).toBeCloseTo(hi, 9);
    }
  });

  it("tay dẫn (`solve: false`): mặc định nhóm, `along` 0,5, ngón cái lên, `around` 0", () => {
    const sol = graspAt(cc, "chai-dia@cylinder", upright, RIGHT, undefined, { solve: false });
    expect(sol.candidates).toBe(1);
    expect(sol.choice).toMatchObject({ part: "than", along: 0.5, thumb: "up", variant: "wrap" });
  });
});

describe("chooseMissing `platform`", () => {
  const KHAY = item(khay);
  const SLIP = item({
    schemaVersion: 2,
    size: [40, 1.1, 68],
    front: [0, 1, 0],
    top: [0, 0, -1],
    anchors: {},
    shape: [{ box: [40, 1.1, 68], at: [0, 0.65, 0] }],
  });
  const pc = graspCtx(T, { khay: KHAY, phieu: SLIP });
  // nằm ngang trước bụng, đầu trên của món lên (y rig xuống), mặt trước của món về người cầm
  const flat = (z: number): ItemPose => ({
    R: fromColumns([1, 0, 0], [0, -1, 0], [0, 0, -1]),
    P: [250, -250, z],
    cast: "nguoi",
    s: 1,
  });
  const faceOf = (id: string, sol: GraspSolution) => {
    const f = itemGeom(id === "khay" ? KHAY : SLIP).features[sol.choice.featureIndex!];
    return f.kind === "face" ? `${f.part}:${f.name}` : f.kind;
  };

  // `edge` 4, rồi quanh ứng viên tốt nhất của từng cạnh `along` 3 × `psi` 5 (−90..90 bước 45); khay: hộp bao hai vành cũng
  // có mặt đáy cùng hướng
  it.each([
    ["khay", 590, 2],
    ["phieu", 570, 1],
  ] as const)(
    "đủ thiếu `%s@platform`: mặt chúc xuống nhất, rig giải `edge`, `along`, `psi`",
    (id, z, faces) => {
      for (const side of [RIGHT, LEFT]) {
        const sol = chooseMissing(pc, `${id}@platform`, flat(z), side);
        expect(sol.candidates).toBe(4 * faces + 4 * 3 * 5);
        expect(faceOf(id, sol)).toBe(id === "khay" ? "day:bottom" : "body:back");
        for (const k of ["edge", "along", "psi"] as const) expect(sol.by[k]).toBe("rig");
        expect([-90, -45, 0, 45, 90]).toContain(sol.choice.psi);
        expect(sol.choice.variant).toBe("palm");
        expect(Number.isFinite(sol.cost)).toBe(true);
        expect(sol.arm.gap).toBeLessThan(1e-6);
      }
    },
  );

  it("khay trước bụng: tay phải cạnh phải, tay trái cạnh trái, ngón chĩa ra xa (`ψ` 90)", () => {
    for (const [side, edge] of [
      [RIGHT, "right"],
      [LEFT, "left"],
    ] as const) {
      const sol = chooseMissing(pc, "khay@platform", flat(590), side);
      expect(sol.choice).toMatchObject({ edge, psi: 90 });
      const f = matVec(sol.Rw, [0, -1, 0]);
      expect(-f[2]).toBeGreaterThan(0.99);
    }
  });

  it("món lật: mặt chúc xuống ở mốc bắt đầu là mặt đỡ (khay úp: mặt trong của đáy)", () => {
    const upside: ItemPose = { ...flat(590), R: fromColumns([1, 0, 0], [0, 1, 0], [0, 0, 1]) };
    const sol = chooseMissing(pc, { item: "khay", group: "platform", part: "day" }, upside, RIGHT);
    expect(faceOf("khay", sol)).toBe("day:top");
  });

  it("tay dẫn (`solve: false`): mặt gần `−top`, cạnh phía tay ấy, `along` 0,5, `ψ` 90", () => {
    for (const [side, edge] of [
      [RIGHT, "right"],
      [LEFT, "left"],
    ] as const)
      for (const id of ["khay", "phieu"]) {
        const sol = graspAt(pc, `${id}@platform`, flat(590), side, undefined, { solve: false });
        expect(sol.candidates).toBe(1);
        expect(faceOf(id, sol)).toBe(id === "khay" ? "day:bottom" : "body:back");
        expect(sol.choice).toMatchObject({ edge, along: 0.5, psi: 90, variant: "palm" });
      }
  });
});
