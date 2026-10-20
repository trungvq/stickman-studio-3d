import { describe, expect, it } from "vitest";
import { trunk3, type ActInput } from "./act3";
import { phiChain } from "./graspArm";
import {
  chooseMissing,
  graspAt,
  graspCtx,
  graspFrame,
  graspReport,
  handFromItem,
  type GraspCtx,
  type GraspSolution,
} from "./graspSolve";
import { itemGeom, type SlabFeature } from "./heldGeom";
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
const ctx = graspCtx(T, { "bang-gia": BANG, "tam-dai": LONG });
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
    // 2 cạnh × 2 mặt × 3 biến thể, rồi `along` 3 × `slant` 3
    expect(sol.candidates).toBe(12 + 9);
  });
});

/** Phần giá lệch mặc định của nghiệm (giá trừ E và khe ở mốc bắt đầu) */
const devOf = (s: GraspSolution) => s.cost - s.arm.E - (s.arm.gap / 6) ** 2;

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
