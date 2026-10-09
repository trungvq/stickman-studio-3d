import { describe, expect, it } from "vitest";

import { BEARD_PRESETS, beardPaths, beardPresetOf, type BeardFit } from "./beard";
import { MOUSTACHE_KINDS } from "./Moustache";
import { BEARD_TIPS, BeardSchema, parseCharacter, type Beard } from "./schema";
import { latOf } from "./sphere";

const R = 65;
const MOUTH = latOf(34, R);
const points = (d: string) =>
  [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
/** Diện tích có dấu cộng dồn mọi subpath: hàn ô giữ nguyên nó */
const area = (d: string) =>
  d
    .split("M")
    .filter(Boolean)
    .reduce((sum, sub) => {
      const p = points(sub);
      const n = p.length;
      return (
        sum + p.reduce((a, [x, y], i) => a + x * p[(i + 1) % n][1] - p[(i + 1) % n][0] * y, 0) / 2
      );
    }, 0);
const box = (d: string) => {
  const p = points(d);
  const xs = p.map(([x]) => x);
  const ys = p.map(([, y]) => y);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};
const beard = (raw: Partial<Beard> = {}, yaw = 0, fit?: BeardFit) =>
  beardPaths(raw, { yaw, pitch: 0 }, MOUTH, "round", 0, 0, R, R, fit);

describe("râu dựng khối", () => {
  it("nhìn thẳng thì đối xứng gương qua trục giữa mặt", () => {
    const p = beard();
    const key = ([x, y]: number[]) => `${x} ${y}`;
    for (const d of [p.front, p.back]) {
      const all = new Set(points(d).map(key));
      for (const [x, y] of points(d)) expect(all.has(key([-x, y]))).toBe(true);
    }
    const b = box(p.front);
    expect(b.x0).toBeCloseTo(-b.x1, 6);
  });

  it("khấc giữa cằm thấp hơn mồm `gap` độ", () => {
    const top = Math.min(
      ...points(beard().front)
        .filter(([x]) => x === 0)
        .map(([, y]) => y),
    );
    expect(top).toBeCloseTo(R * Math.sin(-(MOUTH - 10) * (Math.PI / 180)), 0);
  });

  it("mồm mở thì đáy khấc hạ và dải ria nhấc đúng bằng môi", () => {
    const top = (raw: Partial<Beard>, f: BeardFit) =>
      Math.min(
        ...points(beard(raw, 0, f).front)
          .filter(([x]) => x === 0)
          .map(([, y]) => y),
      );
    const fit = { x: 0, y: -R * Math.sin(MOUTH * (Math.PI / 180)) };
    const moved = (raw: Partial<Beard>, open: { down: number; up: number }) =>
      top(raw, { ...fit, open }) - top(raw, fit);
    expect(moved({}, { down: 9, up: 0 })).toBeCloseTo(9, 6);
    expect(moved({ lip: 4 }, { down: 0, up: 7 })).toBeCloseTo(-7, 6);
  });

  it("kín mồm thì không khấc, phủ chỗ mồm, râu trên mồm đứng yên", () => {
    const fit = { x: 0, y: -R * Math.sin(MOUTH * (Math.PI / 180)) };
    const open = { ...fit, open: { down: 0, up: 7 } };
    expect(beard({}, 0, fit).covers).toBe(false);
    expect(beard({ gap: -20 }, 0, fit).covers).toBe(true);
    const shut = beard({ cover: true, lip: 4 }, 0, fit);
    expect(shut.covers).toBe(true);
    expect(beard({ cover: true, lip: 4 }, 0, open).front).toBe(shut.front);
  });

  it("lún phún không nổi khỏi sọ, không rủ", () => {
    const p = beard({ stubble: true, bulk: 0.2, length: 1 });
    expect(p.stubble).toBe(true);
    for (const [x, y] of points(p.front + p.back))
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(R + 0.1);
    expect(box(beard().front).y1).toBeGreaterThan(R);
  });

  it("cạo hết bề ngang thì không còn gì", () => {
    const p = beard({ shave: 1 });
    expect(p.front + p.back).toBe("");
  });

  it("cạo giữa cằm bỏ phần gần trục giữa", () => {
    const xs = points(beard({ shave: 0.42 }).front).map(([x]) => Math.abs(x));
    expect(Math.min(...xs)).toBeGreaterThan(R * 0.4);
  });

  it("lắc mạnh thì một bên quay ra sau sọ", () => {
    expect(beard({ reach: 80 }).back).toBe("");
    expect(beard({ reach: 80 }, 85).back).not.toBe("");
  });

  it("rủ thì đáy xuống dưới đáy sọ, mỗi dáng đáy một hình", () => {
    const hang = beard({ length: 0.5 });
    expect(box(hang.front).y1 - box(beard().front).y1).toBeGreaterThan(R * 0.25);
    expect(box(hang.front).y1).toBeGreaterThan(R * 1.25);
    const fronts = BEARD_TIPS.map((tip) => beard({ length: 0.5, tip }).front);
    expect(new Set(fronts).size).toBe(BEARD_TIPS.length);
  });

  it("rủ sâu nhất ở trục giữa", () => {
    const p = points(beard({ length: 0.5, tip: "point" }).front);
    const low = Math.max(...p.map(([, y]) => y));
    expect(p.find(([, y]) => y === low)![0]).toBe(0);
  });

  it("khớp mồm: phần quay ra người xem dời theo, phần sau viền đứng yên", () => {
    const own = beard();
    const my = R * Math.sin(-MOUTH * (Math.PI / 180));
    const moved = beard({}, 0, { x: 8, y: my + 5 });
    const top = (d: string, at: number) =>
      Math.min(
        ...points(d)
          .filter(([x]) => x === at)
          .map(([, y]) => y),
      );
    expect(top(moved.front, 8)).toBeCloseTo(top(own.front, 0) + 5, 6);
    const a = points(own.back);
    const b = points(moved.back);
    expect(Math.abs(area(moved.back) / area(own.back) - 1)).toBeLessThan(0.01);
    for (const [x, y] of b)
      expect(Math.min(...a.map(([u, v]) => Math.hypot(x - u, y - v)))).toBeLessThan(0.5);
  });

  it("3/4 sau: quanh mồm quay như nghiêng, gần tai theo góc thật của sọ", () => {
    const fit = { x: R * 0.8, y: 34, yaw: 90 };
    const whole = (yaw: number, f?: BeardFit) => {
      const p = beard({}, yaw, f);
      return box(p.front + p.back);
    };
    const side = whole(90, fit);
    const rear = whole(120, fit);
    const skull = whole(120, { ...fit, yaw: undefined });
    expect(Math.abs(rear.x1 - side.x1)).toBeLessThan(3);
    expect(skull.x1 - side.x1).toBeGreaterThan(8);
    expect(rear.x0).toBeCloseTo(skull.x0, 6);
    expect(rear.x0).toBeLessThan(side.x0 - 20);
  });
});

describe("mẫu râu", () => {
  it("dải ria nằm ngay trên mồm, vòng mảnh chừa da giữa mồm và dải cằm", () => {
    const my = R * Math.sin(-MOUTH * (Math.PI / 180));
    const mid = (d: string) => points(d).filter(([x]) => Math.abs(x) < 3);
    expect(Math.min(...mid(beard({ lip: 4 }).front).map(([, y]) => y))).toBeLessThan(my - 3);
    expect(Math.min(...mid(beard().front).map(([, y]) => y))).toBeGreaterThan(my);
    const ring = mid(beard(BEARD_PRESETS.ring.beard).front).map(([, y]) => y);
    expect(ring.some((y) => y < my)).toBe(true);
    expect(ring.some((y) => y > my + 4 && y < my + 20)).toBe(false);
  });

  it("mọi mẫu qua schema không thừa trường, ria đi kèm là kiểu có thật", () => {
    for (const p of Object.values(BEARD_PRESETS)) {
      expect(() => BeardSchema.strict().parse(p.beard)).not.toThrow();
      expect(MOUSTACHE_KINDS).toContain(p.moustache);
    }
  });

  it("nhận ra mẫu, số đã chỉnh thì không", () => {
    for (const [k, p] of Object.entries(BEARD_PRESETS)) expect(beardPresetOf(p.beard)).toBe(k);
    expect(beardPresetOf(undefined)).toBe("short");
    expect(beardPresetOf({ ...BEARD_PRESETS.ducktail.beard, length: 0.6 })).toBeUndefined();
  });

  it("nhân vật nạp râu dựng khối ở `chin`", () => {
    const r = parseCharacter({
      pieces: { chin: { src: "sculpt", color: "#3a2620", beard: { length: 0.5, tip: "point" } } },
    });
    expect(r.success).toBe(true);
    const chin = r.data!.pieces.chin;
    expect(chin.src).toBe("sculpt");
    expect(chin.beard).toEqual(BeardSchema.parse({ length: 0.5, tip: "point" }));
    expect(
      parseCharacter({ pieces: { chin: { src: "sculpt", beard: { tip: "braid" } } } }).success,
    ).toBe(false);
  });
});
