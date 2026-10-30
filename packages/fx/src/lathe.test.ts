import { describe, expect, it } from "vitest";

import {
  D,
  cross3,
  dot3,
  orbit,
  place3,
  project,
  scaleAt,
  sub3,
  type Lens,
  type Place3,
  type V3,
} from "@stickman3d/rig/core";
import { lathe, type Lathe, type Ring } from "./lathe";
import { solid, type Mark, type Part } from "./solid";

const TAU = Math.PI * 2;
const INK = "#111";
const TOP = "#c00";
const BEAD = "#0c0";
const CUP: Ring[] = [
  [0, 12],
  [-52, 16.2],
  [-62, 17],
];
const cup = (o: Partial<Lathe> = {}): Lathe => ({
  rings: CUP,
  tone: { top: "#eee", lit: "#ddd", side: "#ccc" },
  n: 8,
  ink: INK,
  ...o,
});

interface Case {
  name: string;
  lens: Lens;
  at: Place3;
  spec: Lathe;
}
const CASES: Case[] = [
  {
    name: "nhìn xuống 25°",
    lens: orbit({ target: [0, -30, 0], dist: 420, yaw: 0, pitch: 25 * D, f: 800 }),
    at: { at: [0, 0, 0] },
    spec: cup(),
  },
  {
    name: "nghiêng, bầu dục, xoay, phóng",
    lens: orbit({ target: [20, -40, 10], dist: 380, yaw: 35 * D, pitch: 45 * D, f: 800 }),
    at: { at: [30, 0, -20], yaw: 0.7, s: 1.3 },
    spec: cup({ tilt: 0.25, sx: 1.4, sz: 0.8 }),
  },
  {
    name: "mắt ngang thân cốc",
    lens: orbit({ target: [0, -30, 0], dist: 300, yaw: -60 * D, pitch: 0, f: 800 }),
    at: { at: [-10, 0, 15], yaw: -0.4 },
    spec: cup({ sx: 0.9, sz: 1.2 }),
  },
];

const tiltOf = (spec: Lathe) => [Math.cos(spec.tilt ?? 0), Math.sin(spec.tilt ?? 0)];
/** Bỏ nghiêng: toạ độ món trước `tilt` */
const untilt = (spec: Lathe, [x, y, z]: V3): V3 => {
  const [ct, st] = tiltOf(spec);
  return [x * ct + y * st, -x * st + y * ct, z];
};
const retilt = (spec: Lathe, [x, y, z]: V3): V3 => {
  const [ct, st] = tiltOf(spec);
  return [x * ct - y * st, x * st + y * ct, z];
};
const angle = (spec: Lathe, p: V3) => {
  const q = untilt(spec, p);
  return Math.atan2(q[2] / (spec.sz ?? 1), q[0] / (spec.sx ?? 1));
};
const wrap = (a: number) => ((a % TAU) + TAU) % TAU;

/** Điểm thế giới trên mặt tròn xoay thật của đai j, tham số t ∈ [0, 1] từ vòng j lên vòng j + 1 */
function surface(c: Case, j: number, a: number, t: number): V3 {
  const [y0, r0] = c.spec.rings[j];
  const [y1, r1] = c.spec.rings[j + 1];
  const r = r0 + (r1 - r0) * t;
  const y = y0 + (y1 - y0) * t;
  const p = retilt(c.spec, [
    r * (c.spec.sx ?? 1) * Math.cos(a),
    y,
    r * (c.spec.sz ?? 1) * Math.sin(a),
  ]);
  return place3(c.at, p);
}
/** Mặt thật của đai j tại góc a quay ra mắt: pháp tuyến sai phân, hướng ra xa trục */
function faces(c: Case, j: number, a: number) {
  const h = 1e-5;
  const p = surface(c, j, a, 0.5);
  const n = cross3(
    sub3(surface(c, j, a + h, 0.5), surface(c, j, a - h, 0.5)),
    sub3(surface(c, j, a, 0.5 + h), surface(c, j, a, 0.5 - h)),
  );
  const [y0] = c.spec.rings[j];
  const axis = place3(c.at, retilt(c.spec, [0, (y0 + c.spec.rings[j + 1][0]) / 2, 0]));
  const out = dot3(n, sub3(p, axis)) > 0 ? 1 : -1;
  return out * dot3(n, sub3(c.lens.eye, p)) > 0;
}

type Kind = "top" | "line" | "bead";
/** Viền nét `w` 1, đĩa mực của hạt dày hơn */
const kind = (m: Mark): Kind =>
  m.color === TOP ? "top" : m.color === BEAD || m.w !== 1 ? "bead" : "line";

interface Line {
  part: number;
  mark: Mark;
  sil: boolean;
  y: number;
}
function lines(spec: Lathe, parts: Part[]): Line[] {
  return parts.flatMap((p, part) =>
    (p.marks ?? [])
      .filter((m) => kind(m) === "line")
      .map((mark) => {
        const [a, b] = mark.d[0].map((q) => untilt(spec, q)[1]);
        return { part, mark, sil: mark.d[0].length === 2 && Math.abs(a - b) > 1e-6, y: a };
      }),
  );
}
const ends = (l: Line) => [l.mark.d[0][0], l.mark.d[0][l.mark.d[0].length - 1]];

describe("lathe: viền", () => {
  for (const c of CASES) {
    const parts = lathe(c.spec, c.lens, c.at);
    const ls = lines(c.spec, parts);
    const sils = ls.filter((l) => l.sil);
    const arcs = ls.filter((l) => !l.sil);

    it(`${c.name}: đường bao dọc tựa vào bóng chiếu của mặt thật`, () => {
      const cloud = c.spec.rings.flatMap((_, k) =>
        Array.from({ length: 2000 }, (_, i) => {
          const a = (TAU * i) / 2000;
          return project(c.lens, k ? surface(c, k - 1, a, 1) : surface(c, 0, a, 0));
        }),
      );
      // mỗi đai có hai đường sinh tiếp xúc, mỗi đường vẽ ở hai múi
      expect(sils.length).toBe(4 * (c.spec.rings.length - 1));
      for (const l of sils) {
        const [p, q] = l.mark.d[0].map((x) => project(c.lens, place3(c.at, x)));
        const dir = [q[0] - p[0], q[1] - p[1]];
        const len = Math.hypot(dir[0], dir[1]);
        const sd = cloud.map((x) => (dir[0] * (x[1] - p[1]) - dir[1] * (x[0] - p[0])) / len);
        expect(Math.min(Math.max(...sd), -Math.min(...sd))).toBeLessThan(1e-6);
      }
    });

    it(`${c.name}: đầu đường bao dọc trùng đầu một cung vòng`, () => {
      for (const l of sils)
        for (const p of l.mark.d[0])
          expect(
            Math.min(
              ...arcs.flatMap(ends).map((q) => Math.hypot(...sub3(p, q))),
              ...sils
                .filter((o) => o.mark !== l.mark)
                .flatMap((o) =>
                  ends(o)
                    .filter((q) => Math.abs(untilt(c.spec, q)[1] - untilt(c.spec, p)[1]) < 1e-6)
                    .map((q) => Math.hypot(...sub3(p, q))),
                ),
            ),
          ).toBeLessThan(1e-6);
    });

    it(`${c.name}: mọi khúc viền neo trên một mặt đang quay ra mắt`, () => {
      for (const l of ls) {
        const s = solid(parts[l.part], c.at, c.lens, 3);
        const n = place3({ at: [0, 0, 0], yaw: c.at.yaw }, l.mark.n);
        const f = s.f.reduce((a, b) => (dot3(b.n, n) > dot3(a.n, n) ? b : a));
        expect(dot3(sub3(c.lens.eye, f.c), f.n)).toBeGreaterThan(0);
      }
    });
  }

  /** Góc a nằm trên một cung vòng ở độ cao y */
  const covered = (spec: Lathe, arcs: Line[], y: number, a: number) =>
    arcs.some((l) => {
      if (Math.abs(l.y - y) > 1e-6) return false;
      const [p, q] = ends(l);
      const a0 = angle(spec, p);
      return wrap(a - a0) <= wrap(angle(spec, q) - a0) + 1e-9;
    });

  it("mắt trên miệng: vòng miệng khép kín, vòng đáy chỉ phần trước", () => {
    for (const c of CASES.slice(0, 2)) {
      const arcs = lines(c.spec, lathe(c.spec, c.lens, c.at)).filter((l) => !l.sil);
      const [yb] = c.spec.rings[0];
      const [yt] = c.spec.rings[c.spec.rings.length - 1];
      const as = Array.from({ length: 360 }, (_, i) => (TAU * (i + 0.5)) / 360);
      for (const a of as) expect(covered(c.spec, arcs, yt, a)).toBe(true);
      let front = 0;
      for (const a of as) {
        const v = faces(c, 0, a);
        if (v !== faces(c, 0, a - D) || v !== faces(c, 0, a + D)) continue;
        expect(covered(c.spec, arcs, yb, a)).toBe(v);
        front += +v;
      }
      expect(front).toBeGreaterThan(0);
      expect(front).toBeLessThan(360);
    }
  });

  it("mắt dưới miệng: vòng miệng chỉ phần trước", () => {
    const c = CASES[2];
    const arcs = lines(c.spec, lathe(c.spec, c.lens, c.at)).filter((l) => !l.sil);
    const [yt] = c.spec.rings[c.spec.rings.length - 1];
    const j = c.spec.rings.length - 2;
    for (let i = 0; i < 360; i++) {
      const a = (TAU * (i + 0.5)) / 360;
      const v = faces(c, j, a);
      if (v !== faces(c, j, a - D) || v !== faces(c, j, a + D)) continue;
      expect(covered(c.spec, arcs, yt, a)).toBe(v);
    }
  });

  it("bậc phẳng ngửa lên, mắt trên: hai mép bậc là viền khép kín", () => {
    const spec = cup({
      rings: [
        [0, 30],
        [-20, 30],
        [-20, 20],
        [-35, 20],
      ],
      n: 12,
    });
    const lens = orbit({ target: [0, -20, 0], dist: 400, yaw: 0, pitch: 40 * D, f: 800 });
    const arcs = lines(spec, lathe(spec, lens, { at: [0, 0, 0] })).filter((l) => !l.sil);
    for (const r of [30, 20]) {
      const at = arcs.filter((l) => Math.abs(Math.hypot(ends(l)[0][0], ends(l)[0][2]) - r) < 1e-6);
      for (let i = 0; i < 360; i++)
        expect(covered(spec, at, -20, (TAU * (i + 0.5)) / 360)).toBe(true);
    }
  });
});

describe("lathe: mặt đỉnh", () => {
  const c = CASES[1];
  const yTop = CUP[CUP.length - 1][0];
  const topMarks = (spec: Lathe, sw?: number) =>
    lathe(spec, c.lens, c.at, sw).flatMap((p) => (p.marks ?? []).filter((m) => kind(m) === "top"));

  it("trong múi: vân đỉnh, rồi viền, rồi hạt; múi nào của đai trên cũng có hạt", () => {
    const spec = cup({
      tilt: 0,
      top: [
        {
          d: [
            [
              [-8, 0, 0],
              [8, 0, 3],
            ],
          ],
          color: TOP,
          w: 0.5,
        },
      ],
      beads: [
        {
          d: [
            [0, 5],
            [3, -4],
          ],
          w: 2,
          color: BEAD,
        },
      ],
    });
    const parts = lathe(spec, c.lens, c.at);
    const n = spec.n!;
    parts.forEach((p, i) => {
      const ks = (p.marks ?? []).map(kind);
      const last = (k: Kind) => ks.lastIndexOf(k);
      const first = (k: Kind) => (ks.includes(k) ? ks.indexOf(k) : Infinity);
      expect(last("top")).toBeLessThan(first("line"));
      expect(last("line")).toBeLessThan(first("bead"));
      expect(ks.filter((k) => k === "bead").length).toBe(i >= parts.length - n ? 4 : 0);
    });
  });

  it("vân dày thành dải nét mảnh nằm trong đĩa đỉnh; vân mảnh giữ nguyên", () => {
    const line: V3[] = [
      [-15, 0, 0],
      [15, 0, 0],
    ];
    const thick = topMarks(cup({ tilt: 0, top: [{ d: [line], color: TOP, w: 1.3 }] }));
    const h = ((1.3 - 0.4) * 3) / 2;
    const zs = new Set(thick.flatMap((m) => m.d.flat().map((p) => p[2].toFixed(3))));
    expect(zs.size).toBeGreaterThanOrEqual(3);
    for (const m of thick) {
      expect(m.w).toBe(0.4);
      for (const p of m.d.flat()) {
        expect(p[1]).toBeCloseTo(yTop, 9);
        expect(Math.abs(p[2])).toBeLessThanOrEqual(h + 1e-9);
        expect(Math.hypot(p[0], p[2])).toBeLessThanOrEqual(15 + h + 1e-9);
      }
    }

    const thin = topMarks(cup({ tilt: 0, top: [{ d: [line], color: TOP, w: 0.5 }] }));
    expect(thin.length).toBeGreaterThan(0);
    for (const m of thin) {
      expect(m.w).toBe(0.5);
      for (const p of m.d.flat()) expect(p[2]).toBe(0);
    }
  });

  it("bề ngang dải tính theo `sw`: nét một đơn vị món thì vân 1.3 không cần tách", () => {
    const sw = scaleAt(c.lens, c.at.at) * (c.at.s ?? 1);
    const ms = topMarks(
      cup({
        tilt: 0,
        top: [
          {
            d: [
              [
                [-15, 0, 0],
                [15, 0, 0],
              ],
            ],
            color: TOP,
            w: 1.3,
          },
        ],
      }),
      sw,
    );
    expect(ms.length).toBeGreaterThan(0);
    for (const m of ms) expect(m.w).toBe(1.3);
  });
});
