import { describe, expect, it } from "vitest";

import { hatFit, hatMesh, insideHat, pinMesh, shellAt } from "./hat";
import { HatSchema, SculptSchema, type Sculpt } from "./schema";
import { accentAt, ahogeRings, hairline, knotFrame, SCULPT_PRESETS, sculptPaths } from "./sculpt";
import { onSkull, type Vec3 } from "./sphere";

const R = 65;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

describe("búi lệch tâm", () => {
  const bun = SCULPT_PRESETS.bun.sculpt;
  it("kinh độ chỗ buộc mặc định giữa gáy: hình y như không khai", () => {
    const a = sculptPaths(bun, { yaw: 150, pitch: 0 }, "round", 0, 0, R, R);
    const b = sculptPaths({ ...bun, tieLon: 180 }, { yaw: 150, pitch: 0 }, "round", 0, 0, R, R);
    expect(b.knot).toBe(a.knot);
  });
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
    const h = HatSchema.parse({});
    expect(dot(sub(onSkull(0, h.front), fit.base), fit.n)).toBeCloseTo(0, 9);
    expect(fit.height).toBeGreaterThanOrEqual(h.height);
    const m = hatMesh({}, fit);
    const top = Math.max(...m.tris.flat().map((p) => dot(sub(p, fit.base), fit.n)));
    expect(top).toBeCloseTo(fit.height, 9);
    expect(m.lines).toHaveLength(h.folds.length);
    for (const l of m.lines) expect(l[0]).toEqual(l[l.length - 1]);
    expect(hatMesh({ folds: [] }, fit).lines).toEqual([]);
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
