import { describe, expect, it } from "vitest";

import { hatFit, hatMesh, hatSpec, insideHat, pinMesh, pressHair, shellAt } from "./hat";
import { HAT_SHAPE_DEFAULTS, HatSchema, SculptSchema, type Hat, type Sculpt } from "./schema";
import { accentAt, ahogeRings, hairline, knotFrame, SCULPT_PRESETS } from "./sculpt";
import { onSkull, type Vec3 } from "./sphere";

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

describe("búi lệch tâm", () => {
  const bun = SCULPT_PRESETS.bun.sculpt;
  it("`tieLon` dời khối buộc sang bên, `knotSize` phóng khối", () => {
    const s = SculptSchema.parse({ ...bun, tie: 5, tieLon: -140 });
    const k = knotFrame(s);
    expect(k.center[0]).toBeLessThan(-0.5);
    expect(k.center[2]).toBeLessThan(-0.5);
    expect(knotFrame({ ...s, knotSize: 1.4 }).radius).toBeCloseTo(k.radius * 1.4, 9);
  });
});

describe("hói chữ M", () => {
  const s = SculptSchema.parse({ ...SCULPT_PRESETS.slick.sculpt, recede: 16, recedeAt: 40 });
  const flat = SculptSchema.parse(SCULPT_PRESETS.slick.sculpt);
  it("giữa trán giữ chân tóc, thái dương lùi đủ `recede`, trước tai trở lại", () => {
    expect(hairline(s, 0)).toBeCloseTo(hairline(flat, 0), 9);
    expect(hairline(s, 40) - hairline(flat, 40)).toBeCloseTo(16, 9);
    expect(hairline(s, -40) - hairline(flat, -40)).toBeCloseTo(16, 9);
    expect(hairline(s, 90)).toBeCloseTo(hairline(flat, 90), 9);
  });
});

describe("lọn vểnh", () => {
  it("tắt mặc định; mỗi lọn dựng khỏi đỉnh rồi cong về `ahogeHeading`", () => {
    expect(ahogeRings(SculptSchema.parse({}))).toEqual([]);
    const s = SculptSchema.parse({ ...SCULPT_PRESETS.neat.sculpt, ahoge: 2 });
    const locks = ahogeRings(s);
    expect(locks).toHaveLength(2);
    for (const rings of locks) {
      const root = rings[0][0];
      const tip = rings[rings.length - 1][0];
      expect(Math.max(...rings.flat().map(([, y]) => y))).toBeGreaterThan(1 + s.volume + 0.2);
      expect(tip[2]).toBeGreaterThan(root[2]);
    }
    const back = ahogeRings({ ...s, ahoge: 1, ahogeHeading: 180 })[0];
    expect(back[back.length - 1][0][2]).toBeLessThan(back[0][0][2]);
  });
});

describe("màu phụ", () => {
  it("đủ `accentTo` từ `accentFrom` ra sau, trán không có", () => {
    const s = SculptSchema.parse({ accentTo: 0.5, accentFrom: 70 });
    expect(accentAt(s, 0)).toBe(0);
    expect(accentAt(s, 70)).toBeCloseTo(0.5, 9);
    expect(accentAt(s, -180)).toBeCloseTo(0.5, 9);
  });
});

describe("mũ dựng khối", () => {
  const hair: Partial<Sculpt> = SCULPT_PRESETS.buzz.sculpt;
  const s = SculptSchema.parse(hair);
  const fit = hatFit({}, hair);
  it("ống mũ ôm mọi điểm vỏ tóc và sọ trên miệng mũ", () => {
    for (let lon = -180; lon < 180; lon += 7)
      for (let lat = 0; lat <= 90; lat += 4) {
        const p = onSkull(lon, lat, shellAt(s, lon, lat));
        const up = dot(sub(p, fit.base), fit.n);
        if (up < 0) continue;
        expect(insideHat({ ...fit, a: fit.a + 1e-9, b: fit.b + 1e-9 }, p)).toBe(true);
      }
  });
  it("tóc dày hơn thì mũ to hơn; `ease` nới thêm đúng bấy nhiêu", () => {
    const afro = hatFit({}, SCULPT_PRESETS.afro.sculpt);
    expect(afro.a).toBeGreaterThan(fit.a + 0.2);
    const loose = hatFit({ ease: 0.13 }, hair);
    expect(loose.a - fit.a).toBeCloseTo(0.1, 9);
  });
  it("miệng mũ ở vĩ độ `front` giữa trán, đỉnh cao `height`, nếp gấp là vòng kín", () => {
    const h = hatSpec({});
    expect(h).toMatchObject(HAT_SHAPE_DEFAULTS.drum);
    expect(dot(sub(onSkull(0, h.front), fit.base), fit.n)).toBeCloseTo(0, 9);
    expect(fit.height).toBeGreaterThanOrEqual(h.height);
    const m = hatMesh({}, fit);
    const top = Math.max(...m.tris.flat().map((p) => dot(sub(p, fit.base), fit.n)));
    expect(top).toBeCloseTo(fit.height, 9);
    expect(m.lines).toHaveLength(h.folds.length);
    for (const l of m.lines) expect(l[0]).toEqual(l[l.length - 1]);
    expect(hatMesh({ folds: [] }, fit).lines).toEqual([]);
    expect(m.band.length + m.brim.length + m.strap.length + m.badge.length + m.seat.length).toBe(0);
  });
});

describe("mũ kê-pi", () => {
  const up = (fit: ReturnType<typeof hatFit>, p: Vec3) => dot(sub(p, fit.base), fit.n);
  const ahead = (fit: ReturnType<typeof hatFit>, p: Vec3) => dot(p, fit.fwd);
  const police = { shape: "peaked" } as const;
  for (const [name, hair] of [
    ["tóc ngắn", SCULPT_PRESETS.short.sculpt],
    ["tóc dài", SCULPT_PRESETS.shoulder.sculpt],
    ["đầu trọc", undefined],
  ] as const) {
    const fit = hatFit(police, hair);
    const m = hatMesh(police, fit);
    it(`${name}: đủ phần, số theo dáng \`peaked\``, () => {
      expect(hatSpec(police)).toMatchObject(HAT_SHAPE_DEFAULTS.peaked);
      for (const part of [m.tris, m.band, m.brim, m.strap, m.badge, m.seat])
        expect(part.length).toBeGreaterThan(0);
      // nét đường nối băng với chóp, `folds` mặc định trống
      expect(m.lines).toHaveLength(1);
    });
    it(`${name}: chóp loe rộng hơn băng, đỉnh phẳng ở \`height\``, () => {
      const h = hatSpec(police);
      const r = (tris: Vec3[][]) => Math.max(...tris.flat().map((p) => Math.abs(p[0])));
      expect(r(m.tris)).toBeGreaterThan(r(m.band) * (1 + h.flare * 0.8));
      const tops = m.tris.flat().filter((p) => up(fit, p) > fit.height - 1e-9);
      expect(tops.length).toBeGreaterThan(0);
      expect(Math.max(...m.tris.flat().map((p) => up(fit, p)))).toBeCloseTo(fit.height, 9);
      const band = m.band.flat().filter((p) => Math.abs(p[0]) > 0.5);
      expect(Math.max(...band.map((p) => up(fit, p)))).toBeCloseTo(h.band, 9);
    });
    it(`${name}: lưỡi trai chìa trước trán, chúc xuống, không lấn vào sọ`, () => {
      const pts = m.brim.flat();
      const tip = pts.reduce((q, p) => (ahead(fit, p) > ahead(fit, q) ? p : q));
      const front = ahead(fit, fit.base) + fit.b;
      expect(ahead(fit, tip) - front).toBeGreaterThan(hatSpec(police).brim * 0.9);
      expect(up(fit, tip)).toBeLessThan(-0.05);
      // phần lưỡi trai ra ngoài băng nằm ngoài sọ đơn vị (cả đầu `human`: nửa trên trùng mặt cầu)
      for (const p of pts)
        if (ahead(fit, p) > front) expect(Math.hypot(...p)).toBeGreaterThan(1.02);
    });
  }
  it("mọi trường số của `HatSchema` đổi hình `peaked` (đầu trọc: tóc không nâng `height`, không có gì để ép)", () => {
    const hair = undefined;
    const base = JSON.stringify(hatMesh(police, hatFit(police, hair)));
    const keys = Object.keys(HatSchema.shape).filter(
      (k) => k !== "shape" && k !== "press" && !k.endsWith("Color"),
    );
    expect(keys.length).toBeGreaterThan(10);
    for (const k of keys) {
      const hat = {
        ...police,
        [k]: k === "folds" ? [0.5] : (hatSpec(police)[k as keyof Hat] as number) + 0.07,
      };
      expect(JSON.stringify(hatMesh(hat, hatFit(hat, hair))), k).not.toBe(base);
    }
  });
  it("`brim`, `strap`, `badge` bằng 0 là bỏ phần ấy; `droop` chúc mép lưỡi trai xuống thêm", () => {
    const fit = hatFit(police);
    const none = hatMesh({ ...police, brim: 0, strap: 0, badge: 0 }, fit);
    expect(none.brim.length + none.strap.length + none.badge.length + none.seat.length).toBe(0);
    const low = (droop: number) =>
      Math.min(
        ...hatMesh({ ...police, droop }, fit)
          .brim.flat()
          .map((p) => up(fit, p)),
      );
    expect(low(30)).toBeLessThan(low(10) - 0.1);
    const reach = (brim: number) =>
      Math.max(
        ...hatMesh({ ...police, brim }, fit)
          .brim.flat()
          .map((p) => ahead(fit, p)),
      );
    expect(reach(0.7) - reach(0.4)).toBeGreaterThan(0.2);
  });
});

describe("mũ vành tròn", () => {
  const up = (fit: ReturnType<typeof hatFit>, p: Vec3) => dot(sub(p, fit.base), fit.n);
  const wide = { shape: "brimmed" } as const;
  const hair = SCULPT_PRESETS.short.sculpt;
  const fit = hatFit(wide, hair);
  const m = hatMesh(wide, fit);
  it("số theo dáng `brimmed`; mặc định trơn, không băng, chỉ thân và vành", () => {
    expect(hatSpec(wide)).toMatchObject(HAT_SHAPE_DEFAULTS.brimmed);
    expect(m.tris.length).toBeGreaterThan(0);
    expect(m.brim.length).toBeGreaterThan(0);
    for (const part of [m.band, m.strap, m.badge, m.seat, m.weave, m.brimWeave])
      expect(part).toEqual([]);
    expect(m.lines).toEqual([]);
  });
  it("vành vòng kín quanh miệng mũ, chìa `brim` ra mọi phía, nằm ngoài sọ", () => {
    const pts = m.brim.flat();
    const h = hatSpec(wide);
    // chìa ra quanh trục mũ: trước, sau, hai bên đều xa trục hơn thân `brim`
    const rel = (p: Vec3) => sub(p, fit.base);
    const reach = (dir: Vec3) => Math.max(...pts.map((p) => dot(rel(p), dir)));
    const back: Vec3 = [-fit.fwd[0], -fit.fwd[1], -fit.fwd[2]];
    expect(reach(fit.fwd) - fit.b).toBeGreaterThan(h.brim * 0.9);
    expect(reach(back) - fit.b).toBeGreaterThan(h.brim * 0.9);
    expect(reach([1, 0, 0]) - fit.a).toBeGreaterThan(h.brim * 0.9);
    expect(reach([-1, 0, 0]) - fit.a).toBeGreaterThan(h.brim * 0.9);
    for (const p of pts)
      if (Math.hypot(...rel(p)) > Math.max(fit.a, fit.b))
        expect(Math.hypot(...p)).toBeGreaterThan(1.02);
  });
  it("`droop` cụp mép vành xuống, âm thì vểnh lên; `brim: 0` là không vành", () => {
    const low = (droop: number) =>
      Math.min(
        ...hatMesh({ ...wide, droop }, fit)
          .brim.flat()
          .map((p) => up(fit, p)),
      );
    expect(low(30)).toBeLessThan(low(5) - 0.1);
    const high = Math.max(
      ...hatMesh({ ...wide, droop: -20 }, fit)
        .brim.flat()
        .map((p) => up(fit, p)),
    );
    expect(high).toBeGreaterThan(0.1);
    expect(hatMesh({ ...wide, brim: 0 }, fit).brim).toEqual([]);
  });
  it("`band` là dải băng quanh chân chóp có nét ở mép trên; `straw` tách vòng xen kẽ của thân và vành", () => {
    const ribbon = hatMesh({ ...wide, band: 0.12 }, fit);
    expect(ribbon.band.length).toBeGreaterThan(0);
    expect(Math.max(...ribbon.band.flat().map((p) => up(fit, p)))).toBeCloseTo(0.12, 9);
    expect(ribbon.lines).toHaveLength(1);
    const straw = hatMesh({ ...wide, straw: 0.15 }, fit);
    expect(straw.weave.length).toBeGreaterThan(0);
    expect(straw.brimWeave.length).toBeGreaterThan(0);
    expect(straw.tris.length + straw.weave.length).toBe(m.tris.length);
    expect(straw.brim.length + straw.brimWeave.length).toBe(m.brim.length);
  });
});

describe("mũ ép tóc", () => {
  const hair = { ...SCULPT_PRESETS.slick.sculpt, volume: 0.12 };
  const s = SculptSchema.parse(hair);
  const low = { shape: "brimmed", front: 14, back: 6 } as const;
  it("`press: 0` nâng thân trùm hết tóc; `press: 1` giữ thân thấp và nén tóc trên miệng xuống dưới đỉnh", () => {
    const tall = hatFit({ ...low, press: 0 }, hair);
    const flat = hatFit(low, hair);
    expect(tall.squash).toBe(1);
    expect(flat.height).toBeLessThan(tall.height - 0.05);
    expect(flat.squash).toBeLessThan(1);
    const room = Math.max(hatSpec(low).ease, 0.02) + hatSpec(low).round * 0.3;
    for (let lon = -180; lon < 180; lon += 9)
      for (let lat = 0; lat <= 90; lat += 6) {
        const p = pressHair(flat, onSkull(lon, lat, shellAt(s, lon, lat)));
        expect(dot(sub(p, flat.base), flat.n)).toBeLessThanOrEqual(flat.height - room + 1e-9);
      }
  });
  it("thân không thấp hơn đỉnh sọ; dưới miệng mũ tóc không dời; mũ cũ mặc định không ép", () => {
    const flat = hatFit({ ...low, height: 0.05 }, hair);
    const bare = hatFit({ ...low, press: 0, height: 0.05 });
    expect(flat.height).toBeCloseTo(bare.height, 3);
    const below = onSkull(0, 0, 0.1);
    expect(pressHair(flat, below)).toEqual(below);
    for (const shape of ["drum", "peaked"] as const) expect(hatFit({ shape }, hair).squash).toBe(1);
  });
});

describe("trâm cài búi", () => {
  it("que xuyên khối búi lệch, hạt ở đầu chĩa ra ngoài", () => {
    const hair = { ...SCULPT_PRESETS.bun.sculpt, tie: 5, tieLon: -140 };
    const k = knotFrame(SculptSchema.parse(hair));
    const m = pinMesh({}, hair);
    const mid = (tris: Vec3[][]) =>
      tris
        .flat()
        .reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]] as Vec3, [0, 0, 0])
        .map((v) => v / (tris.length * 3)) as Vec3;
    // Trục que: qua trọng tâm các đỉnh, hướng về đỉnh xa nhất
    const c = mid(m.stick);
    const far = m.stick
      .flat()
      .reduce((a, p) => (Math.hypot(...sub(p, c)) > Math.hypot(...sub(a, c)) ? p : a));
    const dir = sub(far, c).map((v) => v / Math.hypot(...sub(far, c))) as Vec3;
    const off = sub(k.center, c);
    expect(Math.hypot(...sub(off, dir.map((v) => v * dot(off, dir)) as Vec3))).toBeLessThan(k.h);
    const bead = mid(m.bead);
    expect(Math.hypot(...sub(bead, k.center))).toBeGreaterThan(k.radius);
    expect(dot(sub(bead, k.center), k.n)).toBeGreaterThan(0);
  });
});
