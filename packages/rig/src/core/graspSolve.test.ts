import { describe, expect, it } from "vitest";
import { FLAT_MAX, GRIP_GROUPS, SHEET_INSET, tooThick } from "./graspGroups";
import { CONTACTS, edgeHigh, graspFrame, type ContactInput, type GraspChoice } from "./graspSolve";
import { HAND_DOF, HAND_PIECES, handVec } from "./hand";
import { handSkin, skinHand } from "./handMesh";
import { HELD_SINK } from "./heldAudit";
import { heldFit, skinBulge, skinDepth, skinPieces, toItem } from "./heldFit";
import { edgeFrame, handDims, itemGeom, type Feature, type SlabFeature } from "./heldGeom";
import {
  gripPoint,
  parseHeldItem,
  rotAxis,
  type GripFrame,
  type GroupId,
  type HeldItemSpec,
} from "./heldItem";
import { fromColumns, matMul, matVec, type M3, type V3 } from "./lens";
import grip from "./__fixtures__/grip-frames.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import chaiDia from "./__fixtures__/held-v2/chai-dia.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";
import tomHum from "./__fixtures__/held-v2/tom-hum.json";

const item = (json: unknown): HeldItemSpec => {
  const r = parseHeldItem(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
// tấm tối thiểu cùng số đo với món v1 của fixture: một khối hộp, `front`, `top` khai bằng vectơ
const sheet = (box: V3, at: V3, front: V3, top: V3) =>
  item({ schemaVersion: 2, size: box, front, top, anchors: {}, shape: [{ box, at }] });

const BANG = item(bangGia);
const PHONE = item(dienThoai);
const TOM = item(tomHum);
const PHIEU = sheet([40, 0.6, 34], [0, 0.4, 0], [0, 1, 0], [0, 0, -1]);
const THUC_DON = sheet([36, 1.4, 52], [0, 0.7, 0], [0, 1, 0], [0, 0, -1]);
const BO_DA = sheet([83.2, 3.9, 55.9], [0, 4.55, 0], [0, 0, 1], [0, 1, 0]);
const BAO = sheet([200, 136, 0.24], [0, 0, 0.12], [0, 0, 1], [0, 1, 0]);

const D2R = Math.PI / 180;
const SIZES = ["1", "1.61", "2.16", "t01-sakura", "kuroiwa"] as const;
const SIDES = [
  ["right", -1],
  ["left", 1],
] as const;
type Side = (typeof SIDES)[number][0];
interface FixHand extends GripFrame {
  centre: { item: V3 };
}
type FixSize = Record<Side, FixHand> & { k: number; long: number };
const FIX = grip as unknown as Record<string, Record<string, FixSize>>;

const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const rotDeg = (A: M3, B: M3) => {
  const D = matMul(tr(A), B);
  return Math.acos(Math.max(-1, Math.min(1, (D[0] + D[4] + D[8] - 1) / 2))) / D2R;
};
const det = (m: M3) =>
  m[0] * (m[4] * m[8] - m[5] * m[7]) -
  m[1] * (m[3] * m[8] - m[5] * m[6]) +
  m[2] * (m[3] * m[7] - m[4] * m[6]);
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const close = (a: readonly number[], b: readonly number[], d = 1e-9) =>
  a.forEach((x, i) => expect(Math.abs(x - b[i])).toBeLessThanOrEqual(d));
const deg = (y: number, x: number) => Math.atan2(y, x) / D2R;

type Pick = GraspChoice & { group: GroupId };
interface Case {
  fixture: string;
  spec: HeldItemSpec;
  pick: Record<Side, Pick>;
  high?: V3;
  /** Dư vị trí chấp nhận, đơn vị món */
  pos?: number;
}

/** Dư của khung dựng lại so với fixture: góc quay, khoảng điểm nắm của fixture trong khung bàn tay (đơn vị món) */
function residual(c: Case, size: string, side: Side, sideN: number) {
  const fx = FIX[c.fixture][size];
  const dims = handDims(fx.k, fx.long);
  const g = graspFrame(
    c.spec,
    itemGeom(c.spec),
    c.pick[side],
    sideN,
    dims,
    fx.k,
    fx.long,
    1,
    c.high,
  );
  const F = fx[side];
  const q = F.centre.item;
  return {
    g,
    rot: rotDeg(g.G.R, F.R),
    pos: dist(gripPoint(g.G, q), gripPoint(F, q)) / g.G.u,
  };
}

const both = (pick: Pick, right: Partial<Pick>, left: Partial<Pick>) => ({
  right: { ...pick, ...right },
  left: { ...pick, ...left },
});

const CASES: Case[] = [
  {
    fixture: "bang-gia#doc",
    spec: BANG,
    pick: both(
      {
        group: "sheet",
        variant: "pinch",
        thumb: "front",
        along: (29 - 12) / 58,
        slant: deg(0.3372, 0.9414),
      },
      { edge: "right" },
      { edge: "left" },
    ),
    high: [0, 0, -1],
  },
  {
    fixture: "dien-thoai#doc",
    spec: PHONE,
    pick: both({ group: "palmBox" }, {}, {}),
  },
  {
    fixture: "phieu-lien#cam",
    spec: PHIEU,
    pick: both(
      { group: "sheet", variant: "flat", thumb: "front" },
      { edge: "right" },
      { edge: "left" },
    ),
    high: [0, 0, -1],
  },
  {
    fixture: "thuc-don#khoe",
    spec: THUC_DON,
    pick: both(
      {
        group: "sheet",
        variant: "flat",
        thumb: "front",
        along: (26 - 10) / 52,
        slant: deg(0.940554, 0.339644),
      },
      { edge: "left" },
      { edge: "right" },
    ),
    high: [0, 0, -1],
  },
  {
    fixture: "bo-da#bung",
    spec: BO_DA,
    pick: both(
      { group: "sheet", variant: "rim", thumb: "top", slant: deg(0.4, 1) },
      { edge: "left" },
      { edge: "right" },
    ),
    pos: 0.1,
  },
  // tâm nắm của fixture cách mặt trên đĩa 1,2, thụt 0,9
  {
    fixture: "tom-hum#nhac",
    spec: TOM,
    pick: both(
      { group: "sheet", feature: "slab", variant: "rim", thumb: "top", slant: deg(0.4, 1) },
      { edge: "left" },
      { edge: "right" },
    ),
    pos: 0.75,
  },
  // tờ báo dày 0,24: fixture thụt 3 từ mép
  {
    fixture: "bao#doc",
    spec: BAO,
    pick: both(
      { group: "sheet", variant: "rim", thumb: "front", along: 23 / 136, slant: deg(0.6, 0.8) },
      { edge: "right" },
      { edge: "left" },
    ),
    high: [0, 1, 0],
    pos: 0.1,
  },
];

describe("graspFrame ra lại fixture GripFrame", () => {
  for (const c of CASES)
    it(`${c.fixture}: mọi cỡ, hai tay trong 5° và ${c.pos ?? 1} đơn vị`, () => {
      for (const size of SIZES)
        for (const [side, n] of SIDES) {
          const r = residual(c, size, side, n);
          expect(r.rot, `${size} ${side}`).toBeLessThanOrEqual(5);
          expect(r.pos, `${size} ${side}`).toBeLessThanOrEqual(c.pos ?? 1);
        }
    });

  it("`bang-gia#doc` dư 0,3° và 0,1 đơn vị; `dien-thoai#doc` theo mặc định nhóm dư dưới 1° và 0,8", () => {
    for (const size of SIZES)
      for (const [side, n] of SIDES) {
        const a = residual(CASES[0], size, side, n);
        expect(a.rot).toBeLessThan(0.3);
        expect(a.pos).toBeLessThan(0.1);
        const b = residual(CASES[1], size, side, n);
        expect(b.rot).toBeLessThan(1);
        expect(b.pos).toBeLessThan(0.8);
      }
  });

  it("`dien-thoai#doc` với `along` của fixture dư dưới 0,05 đơn vị", () => {
    const c = { ...CASES[1], pick: both({ group: "palmBox", along: 15.9 / 37.8 }, {}, {}) };
    for (const [side, n] of SIDES) expect(residual(c, "1.61", side, n).pos).toBeLessThan(0.05);
  });
});

describe("tay trái không soi gương món", () => {
  const dims = handDims(1.61);
  const thumbOf = (G: GripFrame): V3 => matVec(tr(G.R), [0, 0, 1]);

  it("cùng chỗ tiếp xúc: det +1 hai tay, ngón cái ngược chiều dọc cạnh", () => {
    for (const variant of ["pinch", "flat"]) {
      const pick: Pick = { group: "sheet", edge: "right", thumb: "front", variant, slant: 20 };
      const [r, l] = [-1, 1].map((s) =>
        graspFrame(BANG, itemGeom(BANG), pick, s, dims, 1.61, 1.61, 1, [0, 0, -1]),
      );
      expect(det(r.G.R)).toBeCloseTo(1, 9);
      expect(det(l.G.R)).toBeCloseTo(1, 9);
      close(r.hand.palm as V3, l.hand.palm as V3);
      close(r.hand.fingers as V3, l.hand.fingers as V3);
      close(
        thumbOf(r.G),
        thumbOf(l.G).map((x) => -x),
      );
    }
  });

  it("`palmBox` mặc định: ngón cái dọc cạnh cùng bên tay, ngón sang cạnh kia, det +1", () => {
    const geom = itemGeom(PHONE);
    const [r, l] = [-1, 1].map((s) =>
      graspFrame(PHONE, geom, { group: "palmBox" }, s, dims, 1.61, 1.61),
    );
    expect(r.choice.thumb).toBe("right");
    expect(l.choice.thumb).toBe("left");
    expect(det(r.G.R)).toBeCloseTo(1, 9);
    expect(det(l.G.R)).toBeCloseTo(1, 9);
    expect((r.hand.at as V3)[0]).toBeLessThan(0);
    expect((l.hand.at as V3)[0]).toBeGreaterThan(0);
    expect((r.hand.fingers as V3)[0]).toBeLessThan(-0.8);
    expect((l.hand.fingers as V3)[0]).toBeGreaterThan(0.8);
    expect(thumbOf(r.G)[1]).toBeGreaterThan(0.8);
    expect(thumbOf(l.G)[1]).toBeGreaterThan(0.8);
  });

  it("`palmBox` mặc định: cái, trỏ–áp út, lòng tay `press`, út `support`; ngón ôm là cái–út", () => {
    const g = graspFrame(PHONE, itemGeom(PHONE), { group: "palmBox" }, -1, dims, 1.61);
    expect(g.roles).toEqual({
      thumb: "press",
      index: "press",
      middle: "press",
      ring: "press",
      pinky: "support",
      palm: "press",
    });
    expect(g.hand.wrap).toEqual(["thumb", "index", "middle", "ring", "pinky"]);
  });

  // lún là gò ngón cái ép cạnh gần theo khung bàn tay, ngón ôm không gỡ được: `chooseMissing` cộng giá lún
  it.each([-1, 1])(
    "`palmBox` tay %i: `tilt` ≤ 10° không lún ở cỡ 1,61, 2,16; `tilt` 25° lún quá `HELD_SINK` ở 1,61",
    (side) => {
      const geom = itemGeom(PHONE);
      const sink = (k: number, tilt: number) => {
        const g = graspFrame(PHONE, geom, { group: "palmBox", tilt }, side, handDims(k), k);
        const skin = handSkin(side, k, k);
        const fit = heldFit({
          v: g.pose,
          side,
          k,
          long: k,
          shape: PHONE.shape!,
          G: g.G,
          roles: g.roles,
          bulge: skinBulge(skin, g.pose),
        });
        const pos = new Float32Array(skin.pos.length);
        skinHand(skin, [...g.pose, ...fit], pos);
        const { gaps } = skinDepth(pos, skinPieces(skin), g.G, PHONE.shape!);
        return Math.max(0, -Math.min(...Object.values(gaps)));
      };
      for (const k of [1.61, 2.16]) for (const tilt of [0, 5, 10]) expect(sink(k, tilt)).toBe(0);
      expect(sink(1.61, 25)).toBeGreaterThan(HELD_SINK);
    },
  );
});

describe("đổi `thumb` là quay π quanh `m`", () => {
  const dims = handDims(1.61);
  const geom = itemGeom(BANG);
  const slab = geom.features.find((f): f is SlabFeature => f.kind === "slab")!;

  for (const variant of ["pinch", "flat", "rim"])
    for (const side of [-1, 1])
      it(`${variant}, tay ${side < 0 ? "phải" : "trái"}`, () => {
        const pick = (thumb: "front" | "back", slant: number, along: number, high?: V3) =>
          graspFrame(
            BANG,
            geom,
            { group: "sheet", edge: "bottom", thumb, variant, slant, along },
            side,
            dims,
            1.61,
            1.61,
            1,
            high,
          );
        const fr = edgeFrame(slab, "bottom", "front");
        const Q = rotAxis(fr.m, Math.PI);
        const turn = (p: V3): V3 => {
          const q = matVec(Q, [p[0] - fr.at[0], p[1] - fr.at[1], p[2] - fr.at[2]]);
          return [q[0] + fr.at[0], q[1] + fr.at[1], q[2] + fr.at[2]];
        };
        // đầu cao theo `m × F`: cả khung cạnh quay theo
        const a = pick("front", 15, 0.3);
        const b = pick("back", 15, 0.3);
        close(b.G.R, matMul(a.G.R, Q), 1e-9);
        close(b.hand.at as V3, turn(a.hand.at as V3), 1e-9);
        // đầu cao cố định theo món trong thế giới: `slant` đổi dấu (trừ `rim`), giữa cạnh
        const high: V3 = [1, 0, 0];
        const c = pick("front", 15, 0.5, high);
        const d = pick("back", variant === "rim" ? 15 : -15, 0.5, high);
        close(d.G.R, matMul(c.G.R, Q), 1e-9);
        close(d.hand.at as V3, c.hand.at as V3, 1e-9);
      });
});

describe("biến thể của `sheet`", () => {
  const dims = handDims(1);
  const geom = itemGeom(BANG);

  it("`flat`: lòng tay `n = F`, ngón trong mặt tấm", () => {
    for (const thumb of ["front", "back"] as const)
      for (const slant of [-60, 0, 45]) {
        const g = graspFrame(
          BANG,
          geom,
          { group: "sheet", variant: "flat", edge: "top", thumb, slant },
          -1,
          dims,
        );
        const F: V3 = thumb === "front" ? [0, 1, 0] : [0, -1, 0];
        close(g.hand.palm as V3, F, 1e-12);
        expect(Math.abs((g.hand.fingers as V3)[1])).toBeLessThan(1e-12);
      }
  });

  it("thụt `d` cố định mọi cỡ tay: pinch 2,5, flat 5, rim 3,2 − 0,8 · dày, giữa bề dày", () => {
    const d = { pinch: SHEET_INSET.pinch, flat: SHEET_INSET.flat, rim: SHEET_INSET.rim - 0.8 };
    for (const variant of ["pinch", "flat", "rim"] as const)
      for (const k of [1, 2.16]) {
        const g = graspFrame(
          BANG,
          geom,
          { group: "sheet", variant, edge: "right", thumb: "front" },
          -1,
          handDims(k),
          k,
        );
        close(g.hand.at as V3, [22 - d[variant], 0.6, 0], 1e-6);
      }
  });

  it("`rim` tấm dày: thụt không dưới 1, tâm nắm cách mặt ngón cái 1,9", () => {
    const thick = sheet([40, 6, 40], [0, 0, 0], [0, 1, 0], [0, 0, -1]);
    for (const thumb of ["front", "back"] as const) {
      const g = graspFrame(
        thick,
        itemGeom(thick),
        { group: "sheet", variant: "rim", edge: "right", thumb },
        -1,
        dims,
      );
      close(g.hand.at as V3, [19, thumb === "front" ? 1.1 : -1.1, 0], 1e-9);
    }
  });

  it("`slant` theo tên: `low`, `high` là nửa miền của biến thể", () => {
    const sl = (variant: string, slant: "low" | "in" | "high") =>
      graspFrame(BANG, geom, { group: "sheet", variant, edge: "right", slant }, -1, dims).choice
        .slant;
    expect([sl("pinch", "low"), sl("pinch", "in"), sl("pinch", "high")]).toEqual([-30, 0, 30]);
    expect(sl("flat", "high")).toBe(45);
    expect(sl("rim", "low")).toBe(-22.5);
  });

  it("mặc định: `pinch`, giữa cạnh, `thumb` mặt trước, vai trò theo bảng nhóm", () => {
    const g = graspFrame(BANG, geom, { group: "sheet", edge: "left" }, 1, dims);
    expect(g.choice).toMatchObject({
      variant: "pinch",
      along: 0.5,
      thumb: "front",
      slant: 0,
      feature: "slab",
    });
    expect(g.hand.pose).toBe("sheet");
    expect(g.roles).toMatchObject({ thumb: "press", index: "press", palm: "free" });
    expect(g.hand.wrap).toEqual(["thumb", "index", "middle", "ring", "pinky"]);
  });

  it("dáng gốc: tấm mỏng là dáng đóng, tấm dày là dáng mở (gốc ngón gập thêm 30°); ngón cái theo bảng nhóm", () => {
    const closed = handVec("sheet");
    const th = GRIP_GROUPS.sheet.variants.pinch.pose!.closed.thumb!;
    closed.splice(HAND_DOF.indexOf("thumbAbd"), 4, ...th);
    const thin = graspFrame(BANG, geom, { group: "sheet", edge: "left" }, 1, handDims(2.16));
    close(thin.pose, closed, 1e-12);
    const thick = sheet([40, 6, 40], [0, 0, 0], [0, 1, 0], [0, 0, -1]);
    const open = graspFrame(thick, itemGeom(thick), { group: "sheet", edge: "left" }, 1, dims);
    const want = [...closed];
    for (const dof of ["indexBase", "fingersBase"] as const) want[HAND_DOF.indexOf(dof)] += 30;
    close(open.pose, want, 1e-12);
  });
});

// cỡ tay của hai người mẫu `bang-cam` (W 14,7 / 16,8, P 16,96): `handDims(k, long)`
const HANDS = [
  [1.75, 1.68],
  [2, 1.68],
] as const;

/** Ngón ôm theo vai trò rồi đo trên da: khe ngón cái, lún sâu nhất */
function pinchSkin(
  spec: HeldItemSpec,
  pick: Pick,
  side: number,
  k: number,
  long: number,
  high: V3,
) {
  const g = graspFrame(spec, itemGeom(spec), pick, side, handDims(k, long), k, long, 1, high);
  const skin = handSkin(side, k, long);
  const fit = heldFit({
    v: g.pose,
    side,
    k,
    long,
    shape: spec.shape!,
    G: g.G,
    roles: g.roles,
    bulge: skinBulge(skin, g.pose),
  });
  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, [...g.pose, ...fit], pos);
  const { gaps } = skinDepth(pos, skinPieces(skin), g.G, spec.shape!);
  return { thumb: gaps.thumb, sink: Math.max(0, -Math.min(...Object.values(gaps))) };
}

describe("`sheet` `pinch` trên da", () => {
  it("bảng: ngón cái đè mặt trước (khe ≤ 0,8), lún ≤ 0,6 — hai cỡ tay, hai tay, mọi `slant` lưới", () => {
    for (const [k, long] of HANDS)
      for (const [edge, side] of [
        ["right", -1],
        ["left", 1],
      ] as const)
        for (const slant of [-30, 0, 30]) {
          const pick: Pick = { group: "sheet", variant: "pinch", thumb: "front", edge, slant };
          const r = pinchSkin(BANG, pick, side, k, long, [0, 0, -1]);
          expect(r.thumb, `${k} ${edge} ${slant}`).toBeLessThanOrEqual(0.8);
          expect(r.sink, `${k} ${edge} ${slant}`).toBeLessThanOrEqual(0.6);
        }
  });

  it("điện thoại (dày 2,88): lún dưới `HELD_SINK` cả hai đầu cao, hai mặt ngón cái", () => {
    for (const [k, long] of HANDS)
      for (const high of [
        [0, 1, 0],
        [0, -1, 0],
      ] as V3[])
        for (const thumb of ["front", "back"] as const) {
          const pick: Pick = {
            group: "sheet",
            variant: "pinch",
            thumb,
            edge: "right",
            along: 0.33,
            slant: 30,
          };
          expect(pinchSkin(PHONE, pick, -1, k, long, high).sink).toBeLessThan(HELD_SINK);
        }
  });

  it("tâm nắm cách mặt bốn ngón 0,5; tấm dày hơn 1 thì lùi ra mép 1,3 lần phần dày thêm", () => {
    const thick = sheet([40, 6, 40], [0, 0, 0], [0, 1, 0], [0, 0, -1]);
    const at = (spec: HeldItemSpec, thumb: "front" | "back") =>
      graspFrame(
        spec,
        itemGeom(spec),
        { group: "sheet", variant: "pinch", edge: "right", thumb },
        -1,
        handDims(1),
      ).hand.at as V3;
    close(at(thick, "front"), [20, -2.5, 0], 1e-9);
    close(at(thick, "back"), [20, 2.5, 0], 1e-9);
    close(at(PHIEU, "front"), [20 - 2.5 - 1.3 * 0.4, 0.6, 0], 1e-9);
  });
});

describe("`sheet` `pinch`, `flat`: bề dày thật ở mép", () => {
  // tấm có chân: lớp mặt dày 1 (y 5–6) phủ cả tấm, chân 40 × 5 × 30 ở giữa — hộp bao dày 6
  const PLATE = item({
    schemaVersion: 2,
    size: [60, 6, 40],
    front: [0, 1, 0],
    top: [0, 0, -1],
    anchors: {},
    shape: [
      { box: [60, 1, 40], at: [0, 5.5, 0] },
      { box: [40, 5, 30], at: [0, 2.5, 0] },
    ],
  });
  const TOP = sheet([60, 1, 40], [0, 5.5, 0], [0, 1, 0], [0, 0, -1]);
  const slabOf = (spec: HeldItemSpec) => itemGeom(spec).features.find((x) => x.kind === "slab")!;
  const input = (spec: HeldItemSpec, f: Feature, edge: string | number, thumb: string) => ({
    geom: itemGeom(spec),
    feature: f,
    side: -1,
    dims: handDims(1.75, 1.68),
    edge: edge as ContactInput["edge"],
    along: 0.5,
    thumb,
    slant: 0,
    tilt: 0,
    shape: spec.shape,
  });

  it("tấm có chân: chỗ tiếp xúc và dáng như tấm phẳng của lớp mặt", () => {
    expect(slabOf(PLATE).t).toBe(6);
    for (const variant of ["pinch", "flat"])
      for (const thumb of ["front", "back"] as const)
        for (const [k, long] of HANDS) {
          const pick: Pick = { group: "sheet", variant, edge: "right", thumb };
          const a = graspFrame(PLATE, itemGeom(PLATE), pick, -1, handDims(k, long), k, long);
          const b = graspFrame(TOP, itemGeom(TOP), pick, -1, handDims(k, long), k, long);
          close(a.hand.at as V3, b.hand.at as V3, 1e-9);
          close(a.hand.palm as V3, b.hand.palm as V3, 1e-12);
          close(a.pose, b.pose, 1e-9);
        }
  });

  it("đĩa: bề dày và mặt bốn ngón đo ở vành, không theo hộp bao 5,4", () => {
    const disc = itemGeom(TOM).features.find((f) => f.kind === "disc")!;
    const c = CONTACTS.sheet!.pinch(input(TOM, disc, 0, "top"));
    // vật liệu 2,5 trong vành (r 32,5): y 3,76–5,4, lấy mẫu 24 điểm trên 5,4
    expect(c.thick).toBeGreaterThan(1.4);
    expect(c.thick).toBeLessThan(1.9);
    expect(c.at[1]).toBeCloseTo(5.4 - c.thick! + 0.5, 9);
    const box = CONTACTS.sheet!.pinch({ ...input(TOM, disc, 0, "top"), shape: undefined });
    expect(box.thick).toBeCloseTo(5.4, 9);
    const f = CONTACTS.sheet!.flat(input(TOM, disc, 0, "top"));
    expect(f.at[1]).toBeCloseTo(5.4 - f.thick! / 2, 9);
  });

  it("tấm phẳng một khối: bề dày, tâm nắm như hộp bao", () => {
    for (const spec of [BANG, THUC_DON, PHONE, BO_DA, PHIEU]) {
      const f = slabOf(spec) as SlabFeature;
      for (const variant of ["pinch", "flat"] as const)
        for (const e of f.edges)
          for (const thumb of f.faces.map((x) => x.name)) {
            const x = input(spec, f, e.name, thumb);
            const real = CONTACTS.sheet![variant](x);
            const box = CONTACTS.sheet![variant]({ ...x, shape: undefined });
            expect(real.thick).toBeCloseTo(f.t, 9);
            close(real.at, box.at, 1e-9);
          }
    }
  });

  it("`flat` không áp trên tấm dày quá `FLAT_MAX · W` ở mép; `pinch`, `rim` vẫn áp", () => {
    const dims = handDims(1.75, 1.68);
    const f = slabOf(BO_DA);
    for (const e of ["left", "right", "front", "back"] as const)
      expect(tooThick(GRIP_GROUPS.sheet, "flat", f, e, dims, BO_DA.shape)).toBeGreaterThan(
        FLAT_MAX * dims.W,
      );
    expect(tooThick(GRIP_GROUPS.sheet, "flat", f, undefined, dims, BO_DA.shape)).toBeCloseTo(
      3.9,
      0,
    );
    for (const v of ["pinch", "rim"])
      expect(tooThick(GRIP_GROUPS.sheet, v, f, undefined, dims, BO_DA.shape)).toBeUndefined();
    const phone = slabOf(PHONE);
    expect(
      tooThick(GRIP_GROUPS.sheet, "flat", phone, undefined, dims, PHONE.shape),
    ).toBeUndefined();
    const plate = slabOf(PLATE);
    expect(tooThick(GRIP_GROUPS.sheet, "flat", plate, "right", dims, PLATE.shape)).toBeUndefined();
    expect(tooThick(GRIP_GROUPS.sheet, "flat", plate, "right", dims)).toBe(6);
  });
});

/** `rim` trên da: khe từng ngón, lún, độ cao trung bình của ngón cái và trỏ theo `F` so với giữa bề dày ở cạnh */
function rimSkin(spec: HeldItemSpec, pick: Pick, side: number, k: number, long: number, high?: V3) {
  const g = graspFrame(spec, itemGeom(spec), pick, side, handDims(k, long), k, long, 1, high);
  const skin = handSkin(side, k, long);
  const fit = heldFit({
    v: g.pose,
    side,
    k,
    long,
    shape: spec.shape!,
    G: g.G,
    roles: g.roles,
    bulge: skinBulge(skin, g.pose),
  });
  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, [...g.pose, ...fit], pos);
  const piece = skinPieces(skin);
  const { gaps } = skinDepth(pos, piece, g.G, spec.shape!);
  const fr = edgeFrame(g.feature as SlabFeature, pick.edge!, pick.thumb as "front");
  const sum = { thumb: [0, 0], index: [0, 0] };
  for (let i = 0; i < piece.length; i++) {
    const f = HAND_PIECES[piece[i]].slice(0, -1) as keyof typeof sum;
    if (!(f in sum)) continue;
    const q = toItem(g.G, [pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]]);
    sum[f][0] +=
      (q[0] - fr.at[0]) * fr.F[0] + (q[1] - fr.at[1]) * fr.F[1] + (q[2] - fr.at[2]) * fr.F[2];
    sum[f][1]++;
  }
  return {
    g,
    gaps,
    sink: Math.max(0, -Math.min(...Object.values(gaps))),
    up: { thumb: sum.thumb[0] / sum.thumb[1], index: sum.index[0] / sum.index[1] },
  };
}

describe("`sheet` `rim` trên da", () => {
  const SLANTS = [0, 22.5, 45];

  it("tấm mỏng (báo 0,24, phiếu 0,6): ngón cái đè mặt `F`, trỏ cuộn dưới mép chạm mặt kia, lún ≤ 0,35", () => {
    for (const [spec, edge, high] of [
      [BAO, "right", [0, 1, 0]],
      [PHIEU, "right", [0, 0, -1]],
    ] as const)
      for (const [k, long] of HANDS)
        for (const side of [-1, 1])
          for (const slant of SLANTS) {
            const pick: Pick = { group: "sheet", variant: "rim", edge, thumb: "front", slant };
            const r = rimSkin(spec, pick, side, k, long, high as V3);
            const at = `${k} ${side} ${slant}`;
            expect(r.up.thumb, at).toBeGreaterThan(1);
            expect(r.up.index, at).toBeLessThan(-1);
            expect(r.gaps.thumb, at).toBeLessThanOrEqual(1.1);
            expect(r.gaps.index, at).toBeLessThanOrEqual(0.4);
            expect(r.sink, at).toBeLessThanOrEqual(0.35);
          }
  });

  it("dáng theo bề dày ở chỗ ngón ôm: vành đĩa mỏng gần dáng đóng dù hộp bao dày 5,4; tấm đặc dày 3,9 là dáng mở", () => {
    const ps = GRIP_GROUPS.sheet.variants.rim.pose!;
    const i = HAND_DOF.indexOf("indexBase");
    const open = handVec(ps.open.pose as "edge");
    const shut = handVec(ps.closed.pose as "edge")[i] + ps.closed.knuckle!;
    const pick = (edge: "left", feature?: "slab"): Pick => ({
      group: "sheet",
      variant: "rim",
      edge,
      thumb: "top",
      ...(feature && { feature }),
    });
    for (const [k, long] of HANDS) {
      const tom = graspFrame(TOM, itemGeom(TOM), pick("left", "slab"), -1, handDims(k, long));
      expect(tom.pose[i]).toBeGreaterThan((shut + open[i]) / 2);
      const bo = graspFrame(BO_DA, itemGeom(BO_DA), pick("left"), -1, handDims(k, long));
      close(bo.pose, open, 1e-12);
    }
  });

  it("tấm dày (3,9), vành đĩa: không lún quá 0,1; trỏ áp mép, ngón cái trên mặt `F`", () => {
    for (const [spec, feature] of [
      [BO_DA, undefined],
      [TOM, "slab"],
    ] as const)
      for (const [k, long] of HANDS)
        for (const side of [-1, 1])
          for (const slant of SLANTS) {
            const pick: Pick = {
              group: "sheet",
              variant: "rim",
              edge: "left",
              thumb: "top",
              slant,
              ...(feature && { feature }),
            };
            const r = rimSkin(spec, pick, side, k, long);
            const at = `${feature ?? "bo-da"} ${k} ${side} ${slant}`;
            expect(r.sink, at).toBeLessThanOrEqual(0.1);
            expect(r.gaps.index, at).toBeLessThanOrEqual(0.4);
            expect(r.up.thumb, at).toBeGreaterThan(r.up.index);
          }
  });
});

describe("edgeHigh", () => {
  // bảng đứng trong thế giới rig: `top` của món (−z) lên (−y), mặt trước về −z
  const R: M3 = [1, 0, 0, 0, 0, 1, 0, -1, 0];
  const across: V3 = [1, 0, 0];

  it("cạnh dốc: đầu cao là đầu trên, hai tay như nhau", () => {
    for (const side of [-1, 1]) {
      close(edgeHigh([0, 0, 1], R, side, across), [0, 0, -1]);
      close(edgeHigh([0, 0, -1], R, side, across), [0, 0, -1]);
    }
  });

  it("cạnh ngang: đầu thấp về phía tay ấy", () => {
    close(edgeHigh([1, 0, 0], R, -1, across), [-1, 0, 0]);
    close(edgeHigh([1, 0, 0], R, 1, across), [1, 0, 0]);
  });

  it("tấm nằm: cạnh chạy trước–sau có đầu thấp về phía người cầm, cạnh chạy ngang thân về phía tay ấy", () => {
    const flat = sheet([40, 0.6, 34], [0, 0.3, 0], [0, 0, 1], [0, 1, 0]);
    const f = itemGeom(flat).features.find((x): x is SlabFeature => x.kind === "slab")!;
    expect(f.lying).toBe(true);
    // món nằm trước người cầm, `front` về người cầm (−z), quay quanh phương đứng `yaw`; người cầm nhìn +z
    const ahead: V3 = [0, 0, 1];
    const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    for (const yaw of [0, 20, -20]) {
      const c = Math.cos(yaw * D2R);
      const s = Math.sin(yaw * D2R);
      const Rl = fromColumns([c, 0, s], [0, -1, 0], [s, 0, -c]);
      for (const thumb of ["top", "bottom"] as const)
        for (const side of [-1, 1]) {
          for (const edge of ["left", "right"] as const) {
            const hi = edgeHigh(edgeFrame(f, edge, thumb).e, Rl, side, across);
            expect(dot(matVec(Rl, hi), ahead)).toBeGreaterThan(0);
          }
          for (const edge of ["front", "back"] as const) {
            const hi = edgeHigh(edgeFrame(f, edge, thumb).e, Rl, side, across);
            expect(dot(matVec(Rl, hi), across) * side).toBeGreaterThan(0);
          }
        }
    }
  });

  it("ngưỡng 30°: dốc 31° là đầu trên, 29° theo tay", () => {
    for (const [a, want] of [
      [31, [Math.cos(31 * D2R), 0, -Math.sin(31 * D2R)]],
      [29, [-Math.cos(29 * D2R), 0, Math.sin(29 * D2R)]],
    ] as const) {
      const e: V3 = [Math.cos(a * D2R), 0, -Math.sin(a * D2R)];
      close(edgeHigh(e, R, -1, across), want as unknown as V3, 1e-12);
    }
  });
});

describe("graspFrame", () => {
  const dims = handDims(1.61);

  it("tất định: cùng đầu vào cùng số, không phụ thuộc thứ tự gọi", () => {
    const run = () =>
      JSON.stringify([
        graspFrame(PHONE, itemGeom(PHONE), { group: "palmBox", tilt: 10 }, 1, dims, 1.61),
        graspFrame(
          BANG,
          itemGeom(BANG),
          { group: "sheet", edge: "bottom", variant: "rim", slant: 12 },
          -1,
          dims,
          1.61,
          1.61,
          1.2,
          [1, 0, 0],
        ),
      ]);
    const a = run();
    graspFrame(TOM, itemGeom(TOM), { group: "sheet", edge: 30, feature: "disc" }, -1, dims);
    expect(run()).toBe(a);
  });

  it("chỉ `sheet`, `palmBox` có chỗ tiếp xúc; thiếu `edge` của tấm là lỗi", () => {
    expect(Object.keys(CONTACTS)).toEqual(["sheet", "palmBox"]);
    expect(() => graspFrame(BANG, itemGeom(BANG), { group: "cylinder" }, -1, dims)).toThrow(
      /cylinder/,
    );
    expect(() => graspFrame(BANG, itemGeom(BANG), { group: "sheet" }, -1, dims)).toThrow(/edge/);
  });

  it("`G` là `gripFrame` của bàn tay tổng hợp: điểm nắm về tâm nắm của dáng", () => {
    const g = graspFrame(PHONE, itemGeom(PHONE), { group: "palmBox" }, -1, dims, 1.61);
    close(gripPoint(g.G, g.hand.at as V3), [0.035 * 1.61, -0.117 * 1.61, 0.027 * 1.61], 1e-12);
  });
  it("`around`, `psi`, `inset` đi tới chỗ tiếp xúc; `choice` giữ những trường nhóm có", () => {
    const chai = item(chaiDia);
    const seen: ContactInput[] = [];
    CONTACTS.cylinder = {
      wrap: (x) => {
        seen.push(x);
        return { at: [0, 64, 4.4], palm: [0, 0, -1], fingers: [1, 0, 0], along: 0.4 };
      },
    };
    try {
      const g = graspFrame(
        chai,
        itemGeom(chai),
        { group: "cylinder", part: "co", around: 30, psi: 45, inset: 6 },
        -1,
        dims,
      );
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({ around: 30, psi: 45, inset: 6, along: 0.5 });
      expect(seen[0].feature.part).toBe("co");
      expect(g.choice).toMatchObject({ around: 30, along: 0.4 });
      expect("psi" in g.choice || "inset" in g.choice).toBe(false);
    } finally {
      delete CONTACTS.cylinder;
    }
  });

  it("`sheet`, `palmBox` không khai thì không nhận `around`, `psi`, `inset`", () => {
    const keep = { sheet: CONTACTS.sheet!.pinch, palmBox: CONTACTS.palmBox!.default };
    const seen: ContactInput[] = [];
    CONTACTS.sheet!.pinch = (x) => (seen.push(x), keep.sheet(x));
    CONTACTS.palmBox!.default = (x) => (seen.push(x), keep.palmBox(x));
    try {
      const a = graspFrame(BANG, itemGeom(BANG), { group: "sheet", edge: "bottom" }, -1, dims);
      const b = graspFrame(PHONE, itemGeom(PHONE), { group: "palmBox" }, 1, dims);
      expect(seen).toHaveLength(2);
      for (const x of seen)
        expect([x.around, x.psi, x.inset]).toEqual([undefined, undefined, undefined]);
      for (const g of [a, b]) expect(Object.keys(g.choice)).not.toContain("around");
    } finally {
      CONTACTS.sheet!.pinch = keep.sheet;
      CONTACTS.palmBox!.default = keep.palmBox;
    }
  });
});
