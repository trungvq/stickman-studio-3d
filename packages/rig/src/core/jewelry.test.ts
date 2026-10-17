import { describe, expect, it } from "vitest";

import { EARRING_SIZE, earLobe, earringMesh } from "./jewelry";
import { humanSkull } from "./humanHead";
import type { Vec3 } from "./sphere";

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (v: Vec3) => Math.hypot(...v);

/** Tam giác rời khép kín, quấn đều: mỗi cạnh có hướng gặp đúng một lần, cạnh ngược chiều của nó cũng một lần */
function closedSoup(tris: Vec3[][]) {
  const key = (p: Vec3) => p.map((v) => v.toFixed(6)).join(",");
  const edges = new Map<string, number>();
  for (const t of tris)
    for (let k = 0; k < 3; k++) {
      const e = `${key(t[k])}|${key(t[(k + 1) % 3])}`;
      edges.set(e, (edges.get(e) ?? 0) + 1);
    }
  for (const [e, n] of edges) {
    const [a, b] = e.split("|");
    if (n !== 1 || edges.get(`${b}|${a}`) !== 1) return false;
  }
  return true;
}

/** Thể tích có dấu của tam giác rời: dương là quấn ra ngoài */
const volume = (tris: Vec3[][]) =>
  tris.reduce(
    (s, [a, b, c]) =>
      s +
      (a[0] * (b[1] * c[2] - b[2] * c[1]) -
        a[1] * (b[0] * c[2] - b[2] * c[0]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) /
        6,
    0,
  );

describe("dái tai", () => {
  it("dưới tâm tai, lệch sau giữa mặt, nằm ngoài sọ người; hai bên đối xứng", () => {
    for (const side of [-1, 1] as const) {
      const l = earLobe(side, true);
      expect(Math.sign(l.face[0])).toBe(side);
      expect(l.face[1]).toBeLessThan(-0.25);
      expect(l.face[2]).toBeLessThan(0.1);
      // mặt ngoài dái tai chìa ra khỏi mặt sọ người ở cùng hướng
      const r = len(l.face);
      const skin = humanSkull(l.face.map((v) => v / r) as Vec3);
      expect(len(l.face)).toBeGreaterThan(len(skin) - 0.02);
      expect(Math.abs(l.face[0])).toBeGreaterThan(Math.abs(l.pierce[0]));
    }
    const [a, b] = [earLobe(-1, true), earLobe(1, true)];
    expect(a.face[0]).toBeCloseTo(-b.face[0], 9);
    expect(a.face[1]).toBeCloseTo(b.face[1], 9);
  });
});

describe("bông tai", () => {
  it("nụ: khối kín áp mặt ngoài dái tai, không có phần thõng; màu viên", () => {
    for (const side of [-1, 1] as const) {
      const m = earringMesh({}, side, true);
      expect(m.hang).toBeUndefined();
      expect(m.metal).toHaveLength(0);
      expect(closedSoup(m.gem)).toBe(true);
      expect(volume(m.gem)).toBeGreaterThan(0);
      const c = m.gem
        .flat()
        .reduce((s, p) => s.map((v, i) => v + p[i] / (m.gem.length * 3)) as Vec3, [
          0, 0, 0,
        ] as Vec3);
      expect(len(sub(c, earLobe(side, true).face))).toBeLessThan(EARRING_SIZE.stud * 1.2);
    }
  });

  it("vòng: thõng từ lỗ xỏ, đường kính `2·size`, khép kín", () => {
    const m = earringMesh({ shape: "hoop", size: 0.2 }, 1, true);
    expect(m.hang!.pivot).toEqual(earLobe(1, true).pierce);
    const pts = m.hang!.metal.flat();
    const ys = pts.map((p) => p[1]);
    expect(Math.min(...ys)).toBeCloseTo(-0.4 - 0.014 * 1.3, 2);
    expect(Math.max(...ys)).toBeLessThan(0.03);
    expect(closedSoup(m.hang!.metal)).toBe(true);
    expect(volume(m.hang!.metal)).toBeGreaterThan(0);
  });

  it("dài: hạt ở dái tai, sợi và viên giọt nước thõng đúng `length` dưới chỗ treo", () => {
    const m = earringMesh({ shape: "drop", length: 0.4 }, -1, true);
    expect(closedSoup(m.metal)).toBe(true);
    const { metal, gem } = m.hang!;
    for (const part of [metal, gem]) {
      expect(closedSoup(part)).toBe(true);
      expect(volume(part)).toBeGreaterThan(0);
    }
    const low = Math.min(...gem.flat().map((p) => p[1]));
    expect(low).toBeCloseTo(-0.4, 2);
    // thẳng đứng dưới chỗ treo
    for (const p of [...metal, ...gem].flat())
      expect(Math.hypot(p[0], p[2])).toBeLessThan(EARRING_SIZE.drop * 1.1);
  });

  it("đầu cầu cũng dựng được: dái tai lấy trên mặt cầu", () => {
    const l = earLobe(1, false);
    expect(l.face[0]).toBeGreaterThan(0.8);
    expect(earringMesh({ shape: "drop" }, 1, false).hang).toBeDefined();
  });
});
