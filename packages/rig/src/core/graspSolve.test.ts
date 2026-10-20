import { describe, expect, it } from "vitest";
import { FLAT_MAX, GRIP_GROUPS, SHEET_INSET, tooThick } from "./graspGroups";
import {
  CONTACTS,
  edgeHigh,
  graspFrame,
  platformInset,
  type ContactInput,
  type GraspChoice,
} from "./graspSolve";
import { HAND_BONES, HAND_DOF, HAND_PIECES, handFrames, handVec } from "./hand";
import { handSkin, skinHand } from "./handMesh";
import { HELD_PIERCE_FIT, HELD_SINK, HELD_WRAP } from "./heldAudit";
import { capsuleClearance, heldFit, skinBulge, skinDepth, skinPieces, toItem } from "./heldFit";
import { edgeFrame, handDims, itemGeom, type Feature, type SlabFeature } from "./heldGeom";
import {
  gripCenter,
  gripPoint,
  parseHeldItem,
  rotAxis,
  type GripFrame,
  type GroupId,
  type HeldItemSpec,
} from "./heldItem";
import { add3, fromColumns, matMul, matVec, sub3, type M3, type V3 } from "./lens";
import grip from "./__fixtures__/grip-frames.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import chaiDia from "./__fixtures__/held-v2/chai-dia.json";
import ongNghe from "./__fixtures__/held-v2/ong-nghe-ban.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";
import tomHum from "./__fixtures__/held-v2/tom-hum.json";
import khay from "./__fixtures__/held-v2/khay.json";
import dua from "./__fixtures__/held-v2/dua.json";
import but from "./__fixtures__/held-v2/but.json";
import tui from "./__fixtures__/held-v2/tui.json";
import chen from "./__fixtures__/held-v2/chen.json";

const item = (json: unknown): HeldItemSpec => {
  const r = parseHeldItem(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
// tấm tối thiểu cùng số đo với món của fixture: một khối hộp, `front`, `top` khai bằng vectơ
const sheet = (box: V3, at: V3, front: V3, top: V3) =>
  item({ schemaVersion: 2, size: box, front, top, anchors: {}, shape: [{ box, at }] });

const BANG = item(bangGia);
const PHONE = item(dienThoai);
const TOM = item(tomHum);
const PHIEU = sheet([40, 0.6, 34], [0, 0.4, 0], [0, 1, 0], [0, 0, -1]);
const THUC_DON = sheet([36, 1.4, 52], [0, 0.7, 0], [0, 1, 0], [0, 0, -1]);
const BO_DA = sheet([83.2, 3.9, 55.9], [0, 4.55, 0], [0, 0, 1], [0, 1, 0]);
const BAO = sheet([200, 136, 0.24], [0, 0, 0.12], [0, 0, 1], [0, 1, 0]);
const THE = sheet([28, 0.8, 17.6], [0, 0.4, 0], [0, 1, 0], [0, 0, -1]);

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
  /** Khung thay cho `grip-frames.json` */
  fix?: Record<string, FixSize>;
}

/** Dư của khung dựng lại so với fixture: góc quay, khoảng điểm nắm của fixture trong khung bàn tay (đơn vị món) */
function residual(c: Case, size: string, side: Side, sideN: number) {
  const fx = (c.fix ?? FIX[c.fixture])[size];
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

describe("`cylinder` `wrap`", () => {
  const CHAI = item(chaiDia);
  const geom = itemGeom(CHAI);
  const thumbOf = (G: GripFrame): V3 => matVec(tr(G.R), [0, 0, 1]);
  const fingersOf = (G: GripFrame): V3 => matVec(tr(G.R), [0, -1, 0]);

  // `along` của fixture: tâm nắm của dáng đóng (`fist`) theo khung fixture, trên đoạn bám y 0–68,5
  it("ra lại fixture `chai-dia#co` ở hai cỡ tay, hai tay trong 5° và 1 đơn vị", () => {
    for (const size of ["t01-sakura", "kuroiwa"])
      for (const [side, n] of SIDES) {
        const fx = FIX["chai-dia#co"][size];
        const F = fx[side];
        const y = toItem(F, gripCenter("fist", n, fx.k, fx.long))[1];
        const g = graspFrame(
          CHAI,
          geom,
          { group: "cylinder", part: "vai", along: y / 68.5, around: 180, thumb: "up" },
          n,
          handDims(fx.k, fx.long),
          fx.k,
          fx.long,
        );
        const q = F.centre.item;
        expect(rotDeg(g.G.R, F.R), `${size} ${side}`).toBeLessThanOrEqual(5);
        expect(
          dist(gripPoint(g.G, q), gripPoint(F, q)) / g.G.u,
          `${size} ${side}`,
        ).toBeLessThanOrEqual(1);
      }
  });

  it("tay trái det +1, cùng lòng tay, ngón quấn ngược chiều; ngón cái về đầu trên, `down` về đầu dưới", () => {
    const dims = handDims(1.75, 1.545);
    for (const thumb of ["up", "down"] as const) {
      const pick: Pick = { group: "cylinder", along: 0.5, around: 30, thumb };
      const [r, l] = [-1, 1].map((s) => graspFrame(CHAI, geom, pick, s, dims, 1.75, 1.545));
      expect(det(r.G.R)).toBeCloseTo(1, 9);
      expect(det(l.G.R)).toBeCloseTo(1, 9);
      close(r.hand.palm as V3, l.hand.palm as V3);
      close(r.hand.at as V3, l.hand.at as V3);
      close(
        fingersOf(r.G),
        fingersOf(l.G).map((x) => -x),
      );
      for (const g of [r, l])
        expect(thumbOf(g.G)[1] * (thumb === "up" ? 1 : -1)).toBeGreaterThan(0.99);
    }
  });

  it("thân thẳng: lòng tay `−ρ(around)`, ngón vuông góc trục, tâm nắm ngoài trục theo `ρ`; vai: lòng tay ngả theo dốc", () => {
    const dims = handDims(1.75, 1.545);
    const body = graspFrame(CHAI, geom, { group: "cylinder", along: 0.4, around: 90 }, -1, dims);
    // `ρ(0)` là `front` (nhãn, +z), `ρ(90) = a × ρ(0)` = +x
    close(body.hand.palm as V3, [-1, 0, 0], 1e-9);
    expect(Math.abs((body.hand.fingers as V3)[1])).toBeLessThan(1e-9);
    const at = body.hand.at as V3;
    expect(at[1]).toBeCloseTo(0.4 * 68.5, 9);
    expect(at[0]).toBeGreaterThan(10.2);
    const shoulder = graspFrame(CHAI, geom, { group: "cylinder", along: 0.8, around: 0 }, -1, dims);
    expect((shoulder.hand.palm as V3)[1]).toBeLessThan(-0.3);
    expect(body.choice).toMatchObject({
      part: "than",
      feature: "lathe",
      along: 0.4,
      around: 90,
      thumb: "up",
    });
  });

  it("thanh hộp `ong-nghe-ban`: lòng tay áp phẳng mặt gần `around` nhất (180 là lưng), da lòng tay không lún", () => {
    const ONG = item(ongNghe);
    const k = 1.75;
    const long = 1.545;
    const g = graspFrame(
      ONG,
      itemGeom(ONG),
      { group: "cylinder", around: 180 },
      -1,
      handDims(k, long),
      k,
      long,
    );
    close(g.hand.palm as V3, [0, -1, 0], 1e-9);
    expect(g.choice).toMatchObject({ part: "tay", feature: "rod", along: 0.5 });
    const skin = handSkin(-1, k, long);
    const pos = new Float32Array(skin.pos.length);
    skinHand(skin, g.pose, pos);
    const { gaps } = skinDepth(pos, skinPieces(skin), g.G, ONG.shape!);
    expect(gaps.palm).toBeGreaterThan(0.5);
    expect(gaps.palm).toBeLessThan(1);
    const at = (around: number) =>
      graspFrame(ONG, itemGeom(ONG), { group: "cylinder", around }, -1, handDims(k, long), k, long)
        .hand.palm as V3;
    close(at(150), [0, -1, 0], 1e-9);
    close(at(330), [0, 1, 0], 1e-9);
    close(at(80), [-1, 0, 0], 1e-9);
  });
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

/** `cylinder` `wrap` qua ngón ôm theo vai trò, đo trên da: lún, xuyên trục nang, khe từng ngón, hướng ngón cái so với trục `a` */
function wrapSkin(spec: HeldItemSpec, pick: Pick, side: number, k: number, long: number) {
  const g = graspFrame(spec, itemGeom(spec), pick, side, handDims(k, long), k, long);
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
  const v = [...g.pose, ...fit];
  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, v, pos);
  const { gaps } = skinDepth(pos, skinPieces(skin), g.G, spec.shape!);
  const F = handFrames(v, side, k, long);
  const end = (n: (typeof HAND_PIECES)[number]): V3 => {
    const d = matVec(F[n].R, [0, -F[n].len, 0]);
    return [F[n].o[0] + d[0], F[n].o[1] + d[1], F[n].o[2] + d[2]];
  };
  const pierce = Math.max(
    ...HAND_PIECES.filter((n) => n !== "palm").map(
      (n) => capsuleClearance(spec.shape!, g.G, F[n].o, end(n), 0).core,
    ),
  );
  const tip = end("thumb1");
  const d = matVec(tr(g.G.R), [0, 1, 2].map((i) => tip[i] - F.thumb0.o[i]) as V3);
  const a = itemGeom(spec).features[g.choice.featureIndex!] as Feature & { a: V3 };
  return {
    sink: Math.max(0, -Math.min(...Object.values(gaps))),
    pierce,
    gaps,
    thumbUp: (d[0] * a.a[0] + d[1] * a.a[1] + d[2] * a.a[2]) / Math.hypot(...d),
    thumbTip: toItem(g.G, tip),
  };
}

describe("`cylinder` `wrap` trên da", () => {
  const rod = (r: number) =>
    item({
      schemaVersion: 2,
      size: [2 * r, 40, 2 * r],
      front: [0, 0, 1],
      top: [0, 1, 0],
      anchors: {},
      shape: [{ cyl: r, from: [0, 0, 0], to: [0, 40, 0] }],
    });

  it("thanh r 2,5 / 5 / 10 / 13: không lún quá `HELD_SINK`, không xuyên, mọi ngón và lòng tay chạm — hai cỡ tay, hai tay", () => {
    for (const r of [2.5, 5, 10, 13])
      for (const [k, long] of HANDS)
        for (const side of [-1, 1]) {
          const at = `r ${r} k ${k} side ${side}`;
          const m = wrapSkin(rod(r), { group: "cylinder", around: 0 }, side, k, long);
          expect(m.sink, at).toBeLessThanOrEqual(HELD_SINK);
          expect(m.pierce, at).toBeLessThanOrEqual(HELD_PIERCE_FIT);
          for (const f of ["palm", "thumb", "index", "middle", "ring", "pinky"] as const)
            expect(m.gaps[f], `${at} ${f}`).toBeLessThanOrEqual(HELD_WRAP);
        }
  });

  it("ngón cái: trụ mảnh nằm dọc trục về phía út (chồng lên trỏ–giữa), trụ to dọc thân về đầu trên", () => {
    for (const [k, long] of HANDS)
      for (const side of [-1, 1]) {
        for (const r of [2.5, 5])
          expect(wrapSkin(rod(r), { group: "cylinder" }, side, k, long).thumbUp).toBeLessThan(-0.8);
        for (const r of [10, 13])
          expect(wrapSkin(rod(r), { group: "cylinder" }, side, k, long).thumbUp).toBeGreaterThan(
            0.7,
          );
      }
  });

  it("`chai-dia`: thân và chỗ fixture `#co` lún dưới `HELD_SINK`, không xuyên", () => {
    const CHAI = item(chaiDia);
    for (const [k, long] of HANDS)
      for (const side of [-1, 1])
        for (const pick of [
          { group: "cylinder", part: "than", along: 0.25, around: 300 },
          { group: "cylinder", part: "vai", along: 0.93, around: 180 },
        ] as Pick[]) {
          const m = wrapSkin(CHAI, pick, side, k, long);
          expect(m.sink, `${k} ${side} ${pick.along}`).toBeLessThanOrEqual(HELD_SINK);
          expect(m.pierce).toBeLessThanOrEqual(HELD_PIERCE_FIT);
        }
  });

  it("dáng hoà theo bán kính ở chỗ cầm, không theo `rMax` của trụ tiện", () => {
    const CHAI = item(chaiDia);
    const geom = itemGeom(CHAI);
    const pose = (along: number) =>
      graspFrame(CHAI, geom, { group: "cylinder", along, around: 180 }, -1, handDims(1.75, 1.68))
        .pose;
    const i = HAND_DOF.indexOf("indexBase");
    // cổ r 4,4 khép hơn thân r 10,2; thân cùng dáng ở mọi chỗ cùng bán kính
    expect(pose(0.95)[i]).toBeGreaterThan(pose(0.3)[i] + 5);
    close(pose(0.2), pose(0.3));
  });
});

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

describe("`card` `pad`", () => {
  // fixture `the-phong#kep`: cạnh dưới, thụt 2,5, giữa bề dày, lòng tay hướng `−front`
  const KEP: Case = {
    fixture: "the-phong#kep",
    spec: THE,
    pick: both({ group: "card", edge: "bottom", thumb: "back" }, {}, {}),
  };
  const SIZES2 = ["1.61", "2.16", "t01-sakura", "kuroiwa"] as const;

  it("ra lại fixture `the-phong#kep` ở cỡ tay thật, hai tay trong 5° và 1 đơn vị", () => {
    for (const size of SIZES2)
      for (const [side, n] of SIDES) {
        const r = residual(KEP, size, side, n);
        expect(r.rot, `${size} ${side}`).toBeLessThanOrEqual(5);
        expect(r.pos, `${size} ${side}`).toBeLessThanOrEqual(1);
      }
  });

  it("ngón cái của fixture ở phía mặt `back`: lòng tay `n = F` của mặt có ngón cái", () => {
    for (const size of SIZES2)
      for (const [side, n] of SIDES) {
        const fx = FIX["the-phong#kep"][size];
        const F = handFrames(handVec("pinch"), n, fx.k, fx.long).thumb1;
        const tip = toItem(fx[side], add3(F.o, matVec(F.R, [0, -F.len, 0])));
        expect(tip[1], `${size} ${side}`).toBeLessThan(0.4);
        close(residual(KEP, size, side, n).g.hand.palm as V3, [0, -1, 0], 1e-12);
      }
  });

  it("tâm nắm thụt 0,15·W giữa bề dày, ngón vào trong tấm quay `slant`", () => {
    const dims = handDims(1.75, 1.68);
    for (const slant of [-30, 0, 30]) {
      const g = graspFrame(
        THE,
        itemGeom(THE),
        { group: "card", edge: "bottom", thumb: "front", slant },
        -1,
        dims,
      );
      close(g.hand.palm as V3, [0, 1, 0], 1e-12);
      close(g.hand.fingers as V3, [-Math.sin(slant * D2R), 0, -Math.cos(slant * D2R)], 1e-12);
      expect((g.hand.at as V3)[2]).toBeCloseTo(8.8 - 0.15 * dims.W, 9);
      expect((g.hand.at as V3)[1]).toBeCloseTo(0.4, 9);
      expect(g.pose).toEqual(handVec("pinch"));
    }
  });

  it("trên da: đệm trỏ áp mặt kia, ngón cái ở mép phía `F`, không lún, không xuyên — hai cỡ tay, hai tay", () => {
    for (const [k, long] of HANDS)
      for (const [, side] of SIDES)
        for (const slant of [-22.5, 0, 22.5]) {
          const pick: Pick = { group: "card", edge: "bottom", thumb: "back", slant };
          const r = cardSkin(THE, pick, side, k, long);
          const at = `${k} ${side} ${slant}`;
          expect(r.gaps.index, at).toBeLessThanOrEqual(0.7);
          expect(r.gaps.thumb, at).toBeLessThanOrEqual(1.7);
          expect(r.sink, at).toBeLessThanOrEqual(0.1);
          expect(r.pierce, at).toBeLessThan(0);
        }
  });

  it("`along` kẹp cho đệm trỏ nằm trong cạnh; cạnh dài thì giữ `along` khai", () => {
    for (const [k, long] of HANDS)
      for (const [, side] of SIDES)
        for (const along of [0, 0.25, 0.5, 0.75, 1]) {
          const r = cardSkin(
            THE,
            { group: "card", edge: "right", thumb: "back", along },
            side,
            k,
            long,
          );
          expect(r.gaps.index, `${k} ${side} ${along}`).toBeLessThanOrEqual(0.7);
        }
    const g = graspFrame(
      THE,
      itemGeom(THE),
      { group: "card", edge: "bottom", thumb: "back", along: 0.5 },
      -1,
      handDims(1.75, 1.68),
    );
    expect(g.choice.along).toBe(0.5);
  });
});

/** Ngón theo vai trò rồi đo trên da: khe từng ngón, lún sâu nhất, trục nang sâu nhất vào món */
function cardSkin(spec: HeldItemSpec, pick: Pick, side: number, k: number, long: number) {
  const g = graspFrame(spec, itemGeom(spec), pick, side, handDims(k, long), k, long);
  const skin = handSkin(side, k, long);
  const v = [
    ...g.pose,
    ...heldFit({
      v: g.pose,
      side,
      k,
      long,
      shape: spec.shape!,
      G: g.G,
      roles: g.roles,
      bulge: skinBulge(skin, g.pose),
    }),
  ];
  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, v, pos);
  const { gaps } = skinDepth(pos, skinPieces(skin), g.G, spec.shape!);
  const F = handFrames(v, side, k, long);
  const pierce = Math.max(
    ...HAND_PIECES.filter((n) => n !== "palm").map(
      (n) =>
        capsuleClearance(
          spec.shape!,
          g.G,
          F[n].o,
          add3(F[n].o, matVec(F[n].R, [0, -F[n].len, 0])),
          0,
        ).core,
    ),
  );
  return { gaps, sink: Math.max(0, -Math.min(...Object.values(gaps))), pierce };
}

describe("`platform` `palm`", () => {
  const KHAY = item(khay);
  // phiếu của fixture `phieu#do`: nằm, mặt trước lên, đầu trên ra xa
  const SLIP = sheet([40, 1.1, 68], [0, 0.65, 0], [0, 1, 0], [0, 0, -1]);
  const palmOf = (G: GripFrame, side: number): V3 => matVec(tr(G.R), [-side, 0, 0]);
  const fingersOf = (G: GripFrame): V3 => matVec(tr(G.R), [0, -1, 0]);
  const BIG = ["t01-sakura", "kuroiwa"] as const;

  /** Lòng tay, ngón, tâm nắm của khung dựng lại so với fixture: góc quay, khoảng tâm nắm theo mặt đỡ và theo pháp tuyến */
  function vsFixture(fixture: string, spec: HeldItemSpec, size: string, side: Side, pick: Pick) {
    const fx = FIX[fixture][size];
    const n = side === "right" ? -1 : 1;
    const g = graspFrame(spec, itemGeom(spec), pick, n, handDims(fx.k, fx.long), fx.k, fx.long);
    const F = fx[side];
    const q = F.centre.item;
    const d = matVec(
      tr(g.G.R),
      [0, 1, 2].map((i) => gripPoint(g.G, q)[i] - gripPoint(F, q)[i]) as V3,
    );
    const up = Math.abs(d[1]) / g.G.u;
    return { g, rot: rotDeg(g.G.R, F.R), plane: Math.hypot(d[0], d[2]) / g.G.u, up };
  }

  it("`khay#bung` (`ψ` 90, cạnh trái / phải): hướng trong 5° mọi cỡ, hai tay; tâm nắm trong mặt đáy khớp `inset` 6 của fixture", () => {
    for (const size of SIZES)
      for (const [side] of SIDES) {
        const edge = side === "right" ? "right" : "left";
        const pick: Pick = { group: "platform", edge, psi: 90, inset: 6 };
        const r = vsFixture("khay#bung", KHAY, size, side, pick);
        expect(r.rot, `${size} ${side}`).toBeLessThanOrEqual(5);
        expect(r.plane, `${size} ${side}`).toBeLessThanOrEqual(1);
      }
  });

  // fixture đặt tâm nắm trên mặt đáy (gò lòng tay lún 1,2–1,5); v2 hạ tâm nắm tới khi da lòng tay vừa áp mặt
  it("`khay#bung` mặc định `inset₀ = W/2`: khớp tâm nắm cách vành 6 ở cỡ 1,61; tâm nắm dưới mặt đáy theo da lòng tay", () => {
    const r = vsFixture("khay#bung", KHAY, "1.61", "right", { group: "platform", edge: "right" });
    expect(r.rot).toBeLessThan(1e-6);
    expect(r.plane).toBeLessThanOrEqual(1);
    for (const size of BIG) {
      const fx = FIX["khay#bung"][size];
      const W = handDims(fx.k, fx.long).W;
      const x = vsFixture("khay#bung", KHAY, size, "right", { group: "platform", edge: "right" });
      expect(x.plane).toBeCloseTo(W / 2 - 6, 6);
      expect(x.up).toBeGreaterThan(1);
      expect(x.up).toBeLessThan(2.2);
    }
  });

  it("`phieu#do` (đỡ mặt sau, ngón về đầu trên, tâm nắm giữa phiếu): trong 5° và 1 đơn vị mọi cỡ, hai tay", () => {
    for (const size of SIZES)
      for (const [side] of SIDES) {
        const pick: Pick = { group: "platform", edge: "bottom", psi: 0, inset: 34 };
        const r = vsFixture("phieu#do", SLIP, size, side, pick);
        expect(r.rot, `${size} ${side}`).toBeLessThanOrEqual(5);
        expect(Math.hypot(r.plane, r.up), `${size} ${side}`).toBeLessThanOrEqual(1);
      }
  });

  it("mặt đỡ mặc định gần `−top`, hoà thì gần `−front`: khay mặt đáy, phiếu mặt sau", () => {
    const dims = handDims(1.75, 1.545);
    const a = graspFrame(KHAY, itemGeom(KHAY), { group: "platform", edge: "left" }, 1, dims);
    expect(a.feature).toMatchObject({ kind: "face", part: "day", name: "bottom" });
    const b = graspFrame(SLIP, itemGeom(SLIP), { group: "platform", edge: "left" }, 1, dims);
    expect(b.feature).toMatchObject({ kind: "face", name: "back" });
  });

  it("lòng tay ngược pháp tuyến mặt; `ψ` 0 ngón vào trong, ±90 dọc cạnh; thụt `inset₀(ψ)` theo pháp tuyến trong", () => {
    const k = 1.75;
    const long = 1.545;
    const dims = handDims(k, long);
    expect(platformInset(90, dims)).toBeCloseTo(dims.W / 2, 9);
    expect(platformInset(0, dims)).toBeCloseTo(dims.P / 2, 9);
    expect(platformInset(45, dims)).toBeCloseTo(((dims.W + dims.P) / 2) * Math.SQRT1_2, 9);
    for (const [, side] of SIDES)
      for (const psi of [-90, -45, 0, 45, 90]) {
        const g = graspFrame(
          KHAY,
          itemGeom(KHAY),
          { group: "platform", edge: "right", psi },
          side,
          dims,
          k,
          long,
        );
        expect(det(g.G.R)).toBeCloseTo(1, 9);
        close(palmOf(g.G, side), [0, 1, 0], 1e-9);
        const c = Math.cos(psi * D2R);
        const sn = Math.sin(psi * D2R);
        // không có hướng món: đầu cao của cạnh về `−front` (xa người)
        close(fingersOf(g.G), [-c, 0, -sn], 1e-9);
        close([(g.hand.at as V3)[0]], [46 - platformInset(psi, dims)], 1e-9);
      }
  });

  it("`along` kẹp cho bàn tay nằm trong cạnh: gót lòng `P` sau tâm nắm, đầu ngón `L − P` trước, ngang `W / 2`", () => {
    const dims = handDims(1.75, 1.545);
    const at = (psi: number, along: number) =>
      graspFrame(KHAY, itemGeom(KHAY), { group: "platform", edge: "right", psi, along }, -1, dims)
        .hand.at as V3;
    // cạnh phải dài 52 từ z = 26 (đầu thấp, `−front` là đầu cao) tới z = −26
    expect(at(90, 0)[2]).toBeCloseTo(26 - dims.P, 9);
    expect(at(90, 1)[2]).toBeCloseTo(-26 + (dims.L - dims.P), 9);
    expect(at(-90, 0)[2]).toBeCloseTo(26 - (dims.L - dims.P), 9);
    expect(at(0, 0)[2]).toBeCloseTo(26 - dims.W / 2, 9);
    expect(at(90, 0.5)[2]).toBeCloseTo(0, 9);
  });

  it("hai tay hai cạnh trái / phải cùng `ψ` 90: ngón cùng chĩa ra xa, ngón cái ra ngoài vành", () => {
    const dims = handDims(2, 1.813);
    const thumbOf = (G: GripFrame): V3 => matVec(tr(G.R), [0, 0, 1]);
    for (const [edge, side, out] of [
      ["right", -1, 1],
      ["left", 1, -1],
    ] as const) {
      const g = graspFrame(KHAY, itemGeom(KHAY), { group: "platform", edge }, side, dims, 2, 1.813);
      expect(g.choice.psi).toBe(90);
      close(fingersOf(g.G), [0, 0, -1], 1e-9);
      expect(thumbOf(g.G)[0] * out).toBeCloseTo(1, 9);
    }
  });

  /** Khe da từng phần bàn tay tới món sau ngón ôm theo vai trò, lún sâu nhất */
  function platformSkin(spec: HeldItemSpec, pick: Pick, side: number, k: number, long: number) {
    const g = graspFrame(spec, itemGeom(spec), pick, side, handDims(k, long), k, long);
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
    return { gaps, sink: Math.max(0, -Math.min(...Object.values(gaps))) };
  }

  it("trên da: lòng tay áp mặt (khe 0,15), bốn ngón đỡ chạm (khe ≤ 0,5), lún ≤ 0,3 — khay, phiếu, hai cỡ, hai tay", () => {
    for (const size of BIG)
      for (const [side, n] of SIDES)
        for (const [spec, pick] of [
          [KHAY, { group: "platform", edge: side === "right" ? "right" : "left" }],
          [SLIP, { group: "platform", edge: "bottom", psi: 0, inset: 34 }],
        ] as const) {
          const fx = FIX["khay#bung"][size];
          const r = platformSkin(spec, pick, n, fx.k, fx.long);
          expect(r.gaps.palm, `${size} ${side}`).toBeCloseTo(0.15, 1);
          for (const f of ["index", "middle", "ring", "pinky"] as const)
            expect(r.gaps[f], `${size} ${side} ${f}`).toBeLessThanOrEqual(0.5);
          expect(r.sink, `${size} ${side}`).toBeLessThanOrEqual(0.3);
        }
  });

  it("vai trò: lòng tay `press`, bốn ngón `support`, ngón cái `free`; dáng phẳng gập gốc 30, ngọn 5", () => {
    const g = graspFrame(
      KHAY,
      itemGeom(KHAY),
      { group: "platform", edge: "right" },
      -1,
      handDims(1.75),
    );
    expect(g.roles).toMatchObject({
      palm: "press",
      thumb: "free",
      index: "support",
      pinky: "support",
    });
    const flat = handVec("flat");
    const i = HAND_DOF.indexOf("indexBase");
    expect(g.pose[i] - flat[i]).toBeCloseTo(30, 9);
    expect(g.pose[i + 1] - flat[i + 1]).toBeCloseTo(5, 9);
  });

  it("mặt không có cạnh khai là lỗi có tên; thiếu `edge` là lỗi", () => {
    const geom = itemGeom(KHAY);
    const bottom = geom.features.findIndex(
      (f) => f.kind === "face" && f.part === "day" && f.name === "bottom",
    );
    expect(() =>
      graspFrame(
        KHAY,
        geom,
        { group: "platform", featureIndex: bottom, edge: "top" },
        -1,
        handDims(1.75),
      ),
    ).toThrow(/không có cạnh `top`/);
    expect(() =>
      graspFrame(KHAY, itemGeom(KHAY), { group: "platform" }, -1, handDims(1.75)),
    ).toThrow(/edge/);
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

  it("chỉ `sheet`, `card`, `palmBox`, `cylinder`, `platform`, `chopsticks`, `pen`, `handle`, `bowl` có chỗ tiếp xúc; thiếu `edge` của tấm là lỗi", () => {
    expect(Object.keys(CONTACTS)).toEqual([
      "sheet",
      "card",
      "palmBox",
      "cylinder",
      "platform",
      "chopsticks",
      "pen",
      "handle",
      "bowl",
    ]);
    expect(() => graspFrame(BANG, itemGeom(BANG), { group: "round" }, -1, dims)).toThrow(/round/);
    expect(() => graspFrame(BANG, itemGeom(BANG), { group: "sheet" }, -1, dims)).toThrow(/edge/);
  });

  it("`G` là `graspLink` của bàn tay tổng hợp: điểm nắm về tâm nắm của dáng", () => {
    const g = graspFrame(PHONE, itemGeom(PHONE), { group: "palmBox" }, -1, dims, 1.61);
    close(gripPoint(g.G, g.hand.at as V3), [0.035 * 1.61, -0.117 * 1.61, 0.027 * 1.61], 1e-12);
  });
  it("`around`, `psi`, `inset` đi tới chỗ tiếp xúc; `choice` giữ những trường nhóm có", () => {
    const chai = item(chaiDia);
    const seen: ContactInput[] = [];
    const keep = CONTACTS.cylinder;
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
      CONTACTS.cylinder = keep;
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

describe("`chopsticks` `grip`", () => {
  const DUA = item(dua);
  const geom = itemGeom(DUA);
  const FIXC: Case = { fixture: "dua#cam", spec: DUA, pick: both({ group: "chopsticks" }, {}, {}) };
  // sakura, kuroiwa
  const REAL = [
    [1.75, 1.545],
    [2, 1.813],
  ] as const;
  const tip: V3 = [0, -35.68, 67.1];
  const end: V3 = [0, 2.82, -5.3];

  it("ra lại fixture `dua#cam` ở mọi cỡ, hai tay trong 5° và 1 đơn vị với `along` mặc định 0,25", () => {
    for (const size of SIZES)
      for (const [side, n] of SIDES) {
        const r = residual(FIXC, size, side, n);
        expect(r.g.choice.along, `${size} ${side}`).toBe(0.25);
        expect(r.rot, `${size} ${side}`).toBeLessThanOrEqual(5);
        expect(r.pos, `${size} ${side}`).toBeLessThanOrEqual(1);
      }
  });

  it("ngón dọc que về ngọn; `along` từ đầu cầm; hai tay đổi que kề ngón cái, det +1, cùng một khung từ que nào", () => {
    const dims = handDims(1.75, 1.545);
    const axis = [tip[0] - end[0], tip[1] - end[1], tip[2] - end[2]] as V3;
    const at = (along: number, side: number, featureIndex?: number) =>
      graspFrame(
        DUA,
        geom,
        { group: "chopsticks", along, ...(featureIndex !== undefined && { featureIndex }) },
        side,
        dims,
        1.75,
        1.545,
      );
    for (const side of [-1, 1]) {
      const g = at(0.25, side);
      expect(det(g.G.R)).toBeCloseTo(1, 9);
      const f = g.hand.fingers as V3;
      expect(f[1] * axis[1] + f[2] * axis[2]).toBeGreaterThan(0.99 * Math.hypot(...axis));
      // dời theo `along`: tâm nắm đi dọc đường giữa về ngọn
      const step = sub3(at(0.4, side).hand.at as V3, g.hand.at as V3);
      expect(Math.hypot(...step)).toBeCloseTo(0.15 * 82.0157, 2);
      expect(step[1] * axis[1] + step[2] * axis[2]).toBeGreaterThan(0);
      // tâm nắm `pinch` của fixture về que phía tay (tay phải `+x`)
      close(at(0.25, side, 0).G.R, at(0.25, side, 1).G.R, 1e-12);
    }
    expect(Math.sign((at(0.25, -1).hand.at as V3)[0])).toBe(
      -Math.sign((at(0.25, 1).hand.at as V3)[0]),
    );
  });

  it("trên da: ngón cái, trỏ chạm hay hở dưới 0,15·W, không lún quá `HELD_SINK`, không xuyên; ngón cuộn thêm ≤ 15° — hai cỡ tay, hai tay", () => {
    for (const [k, long] of REAL)
      for (const [, side] of SIDES) {
        const r = gripSkin(DUA, { group: "chopsticks" }, side, k, long);
        const at = `${k} ${side}`;
        const W = handDims(k, long).W;
        expect(r.gaps.thumb, at).toBeLessThanOrEqual(0.9);
        expect(r.gaps.index, at).toBeLessThanOrEqual(0.15 * W);
        expect(r.sink, at).toBeLessThanOrEqual(HELD_SINK);
        expect(r.pierce, at).toBeLessThan(0);
        for (const x of r.fit) expect(x, at).toBeLessThanOrEqual(15);
      }
  });
});

describe("`pen` `grip`", () => {
  const BUT = item(but);
  const SIZES2 = ["1.61", "2.16", "t01-sakura", "kuroiwa"] as const;
  const REAL = [
    [1.75, 1.545],
    [2, 1.813],
  ] as const;
  // fixture tay trái không soi gương món (ngón cái ở phía kia thân bút); bút đối xứng qua `x = 0` nên so với tay phải soi gương
  const MIRROR: Record<string, FixSize> = Object.fromEntries(
    SIZES2.map((size) => {
      const f = FIX["but#viet"][size];
      const { R, p, u, centre } = f.right;
      const left: FixHand = {
        R: R.map((v, i) => (i < 3 !== (i % 3 === 0) ? -v : v)) as unknown as M3,
        p: [-p[0], p[1], p[2]],
        u,
        centre: { item: [-centre.item[0], centre.item[1], centre.item[2]] },
      };
      return [size, { ...f, left }];
    }),
  );
  const FIXP: Case = { fixture: "but#viet", spec: BUT, pick: both({ group: "pen" }, {}, {}) };
  const FIXM: Case = { ...FIXP, fix: MIRROR };

  it("ra lại fixture `but#viet` ở cỡ tay thật, hai tay (tay trái soi gương) trong 5° và 1 đơn vị với `along` mặc định 0,3", () => {
    for (const size of SIZES2)
      for (const [side, n] of SIDES) {
        const r = residual(side === "left" ? FIXM : FIXP, size, side, n);
        expect(r.g.choice.along, `${size} ${side}`).toBe(0.3);
        expect(r.g.pose, `${size} ${side}`).toEqual(handVec("tripod"));
        expect(r.rot, `${size} ${side}`).toBeLessThanOrEqual(5);
        expect(r.pos, `${size} ${side}`).toBeLessThanOrEqual(1);
      }
  });

  it("`along` tính từ mốc `tip` dọc đoạn bám; hai tay soi gương qua mặt chứa trục, det +1", () => {
    const dims = handDims(1.75, 1.545);
    const at = (spec: HeldItemSpec, along: number, side: number) =>
      graspFrame(spec, itemGeom(spec), { group: "pen", along }, side, dims, 1.75, 1.545);
    for (const side of [-1, 1]) {
      const g = at(BUT, 0.3, side);
      expect(det(g.G.R)).toBeCloseTo(1, 9);
      // ngón chúc về ngòi
      expect((g.hand.fingers as V3)[1]).toBeLessThan(0);
      const step = sub3(at(BUT, 0.45, side).hand.at as V3, g.hand.at as V3);
      close(step, [0, 0.15 * 26.8, 0], 1e-9);
    }
    const r = at(BUT, 0.3, -1).hand;
    const l = at(BUT, 0.3, 1).hand;
    close(l.at as V3, [-(r.at as V3)[0], (r.at as V3)[1], (r.at as V3)[2]], 1e-9);
    close(l.palm as V3, [-(r.palm as V3)[0], (r.palm as V3)[1], (r.palm as V3)[2]], 1e-9);
    // mốc `tip` ở đầu kia: chỗ cầm lật qua giữa đoạn bám (y 3,2–30)
    const flip = item({
      ...but,
      anchors: { ...but.anchors, tip: { at: [0, 30, 0], dir: [0, 1, 0] } },
    });
    const f = at(flip, 0.3, -1).hand;
    expect((f.at as V3)[1]).toBeCloseTo(33.2 - (r.at as V3)[1], 9);
    expect((f.fingers as V3)[1]).toBeGreaterThan(0);
  });

  it("trên da: ngón cái, trỏ, giữa chạm (hở ≤ 0,1 / 0,3 / 0,4), không lún quá `HELD_SINK`, không xuyên; ngón cuộn thêm ≤ 15° — hai cỡ tay, hai tay", () => {
    for (const [k, long] of REAL)
      for (const [, side] of SIDES) {
        const r = gripSkin(BUT, { group: "pen" }, side, k, long);
        const at = `${k} ${side}`;
        expect(r.gaps.thumb, at).toBeLessThanOrEqual(0.1);
        expect(r.gaps.index, at).toBeLessThanOrEqual(0.3);
        expect(r.gaps.middle, at).toBeLessThanOrEqual(0.4);
        expect(r.sink, at).toBeLessThanOrEqual(HELD_SINK);
        expect(r.pierce, at).toBeLessThan(0);
        for (const x of r.fit) expect(x, at).toBeLessThanOrEqual(15);
      }
  });
});

describe("`handle` `hook`", () => {
  const TUI = item(tui);
  const SIZES2 = ["1.61", "2.16", "t01-sakura", "kuroiwa"] as const;
  const REAL = [
    [1.75, 1.545],
    [2, 1.813],
  ] as const;
  const FIXH: Case = { fixture: "tui#xach", spec: TUI, pick: both({ group: "handle" }, {}, {}) };

  it("ra lại fixture `tui#xach` ở cỡ tay thật, hai tay trong 5° và 1 đơn vị với `along` mặc định 0,5", () => {
    for (const size of SIZES2)
      for (const [side, n] of SIDES) {
        const r = residual(FIXH, size, side, n);
        expect(r.g.choice).toMatchObject({ part: "quai", along: 0.5, variant: "hook" });
        expect(r.rot, `${size} ${side}`).toBeLessThanOrEqual(5);
        expect(r.pos, `${size} ${side}`).toBeLessThanOrEqual(1);
      }
  });

  it("ngón vuông góc thanh về `−top`, lòng tay về `front`, tâm nắm trên trục ở `along`; hai tay cùng lòng, det +1", () => {
    const dims = handDims(1.75, 1.545);
    const at = (along: number, side: number) =>
      graspFrame(TUI, itemGeom(TUI), { group: "handle", along }, side, dims, 1.75, 1.545);
    for (const side of [-1, 1]) {
      const g = at(0.5, side);
      expect(det(g.G.R)).toBeCloseTo(1, 9);
      close(g.hand.fingers as V3, [0, -1, 0]);
      close(g.hand.palm as V3, [0, 0, -1]);
      close(g.hand.at as V3, [0, 84.7, 0]);
      expect(Math.abs((at(0.25, side).hand.at as V3)[0])).toBeCloseTo(8, 9);
    }
  });

  it("trên da: trỏ–út móc chạm (khe ≤ 0,3), không lún quá `HELD_SINK`, không xuyên; gốc ngón duỗi, ngọn trỏ, giữa gập ≥ 80° — hai cỡ tay, hai tay", () => {
    const [I, M] = [HAND_DOF.indexOf("indexBase"), HAND_DOF.indexOf("fingersBase")];
    for (const [k, long] of REAL)
      for (const [, side] of SIDES) {
        const r = gripSkin(TUI, { group: "handle" }, side, k, long);
        const at = `${k} ${side}`;
        for (const f of ["index", "middle", "ring", "pinky"] as const)
          expect(r.gaps[f], `${at} ${f}`).toBeLessThanOrEqual(0.3);
        expect(r.sink, at).toBeLessThanOrEqual(HELD_SINK);
        expect(r.pierce, at).toBeLessThan(0);
        for (const [d, j] of [
          [I, 2],
          [M, 4],
        ]) {
          expect(Math.abs(r.v[d] + r.fit[j]), at).toBeLessThanOrEqual(15);
          expect(r.v[d + 1] + r.fit[j + 1], at).toBeGreaterThanOrEqual(80);
        }
      }
  });
});

function gripSkin(spec: HeldItemSpec, pick: Pick, side: number, k: number, long: number) {
  const g = graspFrame(spec, itemGeom(spec), pick, side, handDims(k, long), k, long);
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
    curl: GRIP_GROUPS[pick.group].variants[g.choice.variant!].curl,
  });
  const v = [...g.pose, ...fit];
  const pos = new Float32Array(skin.pos.length);
  skinHand(skin, v, pos);
  const { gaps } = skinDepth(pos, skinPieces(skin), g.G, spec.shape!);
  const F = handFrames(v, side, k, long);
  const pierce = Math.max(
    ...HAND_PIECES.filter((n) => n !== "palm").map(
      (n) =>
        capsuleClearance(
          spec.shape!,
          g.G,
          F[n].o,
          add3(F[n].o, matVec(F[n].R, [0, -F[n].len, 0])),
          0,
        ).core,
    ),
  );
  return { gaps, fit, v: g.pose, sink: Math.max(0, -Math.min(...Object.values(gaps))), pierce };
}

describe("`bowl` `side`", () => {
  const CHEN = item(chen);
  const geom = itemGeom(CHEN);
  const thumbOf = (G: GripFrame): V3 => matVec(tr(G.R), [0, 0, 1]);
  const fingersOf = (G: GripFrame): V3 => matVec(tr(G.R), [0, -1, 0]);
  const REAL = [
    [1.75, 1.545],
    [2, 1.813],
  ] as const;

  // fixture lún lòng tay 1,4–2,0: tâm nắm dời ra tới da lòng cách `BOWL_GAP`, lệch 0,8 (kuroiwa) – 1,5 (sakura)
  it("ra lại fixture `chen#kep` ở hai cỡ tay, hai tay trong 5° và 1,5 đơn vị", () => {
    const fix: Case = {
      fixture: "chen#kep",
      spec: CHEN,
      pick: both({ group: "bowl", along: 1.5 / 9, around: 180 }, {}, {}),
      pos: 1.5,
    };
    for (const size of ["t01-sakura", "kuroiwa"])
      for (const [side, n] of SIDES) {
        const r = residual(fix, size, side, n);
        expect(r.rot, `${size} ${side}`).toBeLessThanOrEqual(5);
        expect(r.pos, `${size} ${side}`).toBeLessThanOrEqual(1.5);
      }
  });

  it("lòng tay `−ρ(around)` ngả theo thành ≤ 4°, ngón cái về miệng, tay trái ngón quấn ngược chiều; `along` mặc định 0,25", () => {
    const dims = handDims(1.75, 1.545);
    for (const around of [0, 90, 200]) {
      const [r, l] = [-1, 1].map((s) =>
        graspFrame(CHEN, geom, { group: "bowl", around }, s, dims, 1.75, 1.545),
      );
      expect(det(r.G.R)).toBeCloseTo(1, 9);
      expect(det(l.G.R)).toBeCloseTo(1, 9);
      close(r.hand.palm as V3, l.hand.palm as V3);
      close(
        fingersOf(r.G),
        fingersOf(l.G).map((x) => -x),
      );
      const palm = r.hand.palm as V3;
      // `ρ(0)` là `b0` (+z) khi món không khai `front`
      const rho: V3 = [Math.sin(around * D2R), 0, Math.cos(around * D2R)];
      const tilt = Math.acos(-(palm[0] * rho[0] + palm[2] * rho[2])) / D2R;
      expect(tilt).toBeLessThanOrEqual(4 + 1e-9);
      for (const g of [r, l]) expect(thumbOf(g.G)[1]).toBeGreaterThan(0.99);
      expect(r.choice).toMatchObject({ feature: "lathe", along: 0.25, variant: "side", around });
    }
  });

  it("trên da: không lún quá `HELD_SINK`, không xuyên, cái – trỏ – giữa chạm (khe ≤ 0,15·W), ngón cái gác trên miệng — hai cỡ tay, hai tay", () => {
    for (const [k, long] of REAL)
      for (const [, side] of SIDES)
        for (const pick of [
          { group: "bowl", around: 0 },
          { group: "bowl", around: 120, along: 0.5 },
        ] as Pick[]) {
          const at = `${k} ${side} ${pick.around}`;
          const m = wrapSkin(CHEN, pick, side, k, long);
          expect(m.sink, at).toBeLessThanOrEqual(HELD_SINK);
          expect(m.pierce, at).toBeLessThanOrEqual(0);
          for (const f of ["thumb", "index", "middle"] as const)
            expect(m.gaps[f], `${at} ${f}`).toBeLessThanOrEqual(0.15 * handDims(k, long).W);
          // đầu ngón cái cao hơn miệng (y 4,5), không quá hai bán kính ngón
          expect(m.thumbTip[1], at).toBeGreaterThan(4.5);
          expect(m.thumbTip[1], at).toBeLessThan(4.5 + 2 * HAND_BONES.thumb.r * k * 100);
        }
  });
});
