import { describe, expect, it } from "vitest";

import { actionDelta, ACTION_VERSION, cubicBezier, parseAction, smoothstep } from "./index";

type Key = { t: number; v: number; ease?: string; bezier?: number[] };

const torso = (keys: Key[], end: "hold" | "wrap" = "hold") => {
  const r = parseAction({
    name: "ease",
    duration: 1,
    end,
    keys: keys.map(({ t, v, ease, bezier }) => ({
      t,
      pose: { torso: v },
      ease: ease ?? "auto",
      ...(bezier && { bezier }),
    })),
  });
  if (!r.success) throw r.error;
  return (u: number) => actionDelta(r.data, u).torso as number;
};

const E = 1e-5;
/** Sai phân trái và phải tại `u` */
const slopes = (f: (u: number) => number, u: number) => [
  (f(u) - f(u - E)) / E,
  (f(u + E) - f(u)) / E,
];

/** `cubic-bezier` tham chiếu: lấy mẫu dày theo tham số, nội suy thẳng theo x */
const bezierRef = (x1: number, y1: number, x2: number, y2: number, x: number) => {
  const b = (p1: number, p2: number, s: number) =>
    3 * (1 - s) ** 2 * s * p1 + 3 * (1 - s) * s * s * p2 + s ** 3;
  const N = 200000;
  let prev = 0;
  for (let i = 1; i <= N; i++) {
    const s = i / N;
    const bx = b(x1, x2, s);
    if (bx >= x) {
      const px = b(x1, x2, prev);
      const k = bx > px ? (x - px) / (bx - px) : 0;
      return b(y1, y2, prev) + (b(y1, y2, s) - b(y1, y2, prev)) * k;
    }
    prev = s;
  }
  return 1;
};

describe('`ease: "auto"`', () => {
  it("hai mốc đơn lẻ là đúng smoothstep", () => {
    const f = torso([
      { t: 0, v: 0 },
      { t: 1, v: 10 },
    ]);
    for (const u of [0, 0.1, 0.25, 0.5, 0.8, 1]) expect(f(u)).toBeCloseTo(10 * smoothstep(u), 10);
  });

  it("chuỗi đơn điệu: vận tốc liền ở mốc giữa, đoạn dài ngắn khác nhau", () => {
    const f = torso([
      { t: 0, v: 0 },
      { t: 0.3, v: 4 },
      { t: 1, v: 10 },
    ]);
    const [l, r] = slopes(f, 0.3);
    expect(l).toBeGreaterThan(5);
    expect(Math.abs(l - r)).toBeLessThan(1e-2 * l);
    expect(f(0.3)).toBeCloseTo(4, 10);
  });

  it("không vượt khoảng của hai mốc kẹp, dữ liệu đổi chiều và đơn điệu", () => {
    const zig: Key[] = [
      { t: 0, v: 0 },
      { t: 0.2, v: 10 },
      { t: 0.5, v: 2 },
      { t: 0.55, v: 8 },
      { t: 1, v: 7 },
    ];
    const f = torso(zig);
    for (let i = 0; i <= 4000; i++) {
      const u = i / 4000;
      const k = zig.findIndex((q, j) => j < zig.length - 1 && q.t <= u && u <= zig[j + 1].t);
      const [a, b] = [zig[k].v, zig[k + 1].v];
      expect(f(u)).toBeGreaterThanOrEqual(Math.min(a, b) - 1e-9);
      expect(f(u)).toBeLessThanOrEqual(Math.max(a, b) + 1e-9);
    }
    const g = torso([
      { t: 0, v: 0 },
      { t: 0.4, v: 1 },
      { t: 0.5, v: 9 },
      { t: 1, v: 10 },
    ]);
    let last = -Infinity;
    for (let i = 0; i <= 4000; i++) {
      const v = g(i / 4000);
      expect(v).toBeGreaterThanOrEqual(last - 1e-12);
      last = v;
    }
  });

  it("mốc đổi chiều có tiếp tuyến 0", () => {
    const f = torso([
      { t: 0, v: 0 },
      { t: 0.5, v: 10 },
      { t: 1, v: 3 },
    ]);
    for (const s of slopes(f, 0.5)) expect(Math.abs(s)).toBeLessThan(1e-2);
  });

  it("`wrap` liền vận tốc qua đường nối vòng, kể cả có mốc `t: 1` trùng mốc đầu", () => {
    const loop: Key[] = [
      { t: 0, v: 5 },
      { t: 0.25, v: 10 },
      { t: 0.5, v: 5 },
      { t: 0.75, v: 0 },
    ];
    for (const keys of [loop, [...loop, { t: 1, v: 5 }]]) {
      const f = torso(keys, "wrap");
      const [l, r] = slopes(f, 0);
      expect(r).toBeGreaterThan(5);
      expect(Math.abs(l - r)).toBeLessThan(1e-2 * r);
    }
    const hold = torso(loop);
    expect(slopes(hold, 0)[1]).toBeLessThan(1e-2);
  });

  it("mốc kề có `ease` khác cắt chuỗi: tiếp tuyến 0 ở phía đó", () => {
    const f = torso([
      { t: 0, v: 0 },
      { t: 0.4, v: 5, ease: "linear" },
      { t: 1, v: 10 },
    ]);
    const [l, r] = slopes(f, 0.4);
    expect(Math.abs(l)).toBeLessThan(1e-2);
    expect(r).toBeCloseTo(5 / 0.6, 6);
    const g = torso([
      { t: 0, v: 0, ease: "smooth" },
      { t: 0.4, v: 5 },
      { t: 0.7, v: 8 },
      { t: 1, v: 10, ease: "linear" },
    ]);
    expect(Math.abs(slopes(g, 0.4)[1])).toBeLessThan(1e-2);
    const [l7, r7] = slopes(g, 0.7);
    expect(Math.abs(l7 - r7)).toBeLessThan(1e-2 * l7);
  });

  it("mỗi góc đầu một chuỗi: mốc ghi `null` không thuộc chuỗi của góc ấy", () => {
    const r = parseAction({
      name: "head",
      end: "hold",
      keys: [
        { t: 0, pose: { head: [0, 0, 0] }, ease: "auto" },
        { t: 0.5, pose: { head: [6, null, 6] }, ease: "auto" },
        { t: 1, pose: { head: [12, 10, 0] }, ease: "auto" },
      ],
    });
    const a = r.data!;
    const h = (u: number) => actionDelta(a, u).head as number[];
    expect(h(0.25)[1]).toBeCloseTo(10 * smoothstep(0.25), 10);
    const [l, rr] = slopes((u) => h(u)[0], 0.5);
    expect(Math.abs(l - rr)).toBeLessThan(1e-2 * l);
    expect(Math.abs(slopes((u) => h(u)[2], 0.5)[0])).toBeLessThan(1e-2);
  });
});

describe('`ease: "bezier"`', () => {
  it("mặc định là `cubic-bezier(0.42, 0, 0.58, 1)`, chạm 0 và 1 ở hai đầu", () => {
    const f = torso([
      { t: 0, v: 0, ease: "bezier" },
      { t: 1, v: 10 },
    ]);
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(10);
    expect(f(0.5)).toBeCloseTo(5, 6);
    for (const u of [0.1, 0.25, 0.7, 0.95])
      expect(f(u)).toBeCloseTo(10 * bezierRef(0.42, 0, 0.58, 1, u), 4);
  });

  it("đường tự khai, mỗi đoạn một đường", () => {
    const f = torso([
      { t: 0, v: 0, ease: "bezier", bezier: [0.6, 0, 1, 1] },
      { t: 0.5, v: 10, ease: "linear" },
      { t: 1, v: 20 },
    ]);
    for (const u of [0.05, 0.2, 0.4])
      expect(f(u)).toBeCloseTo(10 * bezierRef(0.6, 0, 1, 1, u / 0.5), 4);
    expect(f(0.75)).toBeCloseTo(15, 10);
    const ease = cubicBezier(0, 0, 1, 1);
    expect(ease(0.3)).toBeCloseTo(bezierRef(0, 0, 1, 1, 0.3), 5);
  });

  it("`bezier` ngoài `[0, 1]` là lỗi schema", () => {
    const bad = parseAction({
      keys: [{ t: 0, pose: {}, ease: "bezier", bezier: [0.4, -0.5, 0.6, 1] }],
    });
    expect(bad.success).toBe(false);
  });
});

describe(`đời ${ACTION_VERSION}`, () => {
  it("file đời cũ đọc như cũ, `ease` mặc định vẫn là `linear`", () => {
    const r = parseAction({
      schemaVersion: 19,
      end: "hold",
      keys: [
        { t: 0, pose: { torso: 0 } },
        { t: 1, pose: { torso: 10 } },
      ],
    });
    expect(r.data?.schemaVersion).toBe(ACTION_VERSION);
    expect(r.data?.keys?.[0].ease).toBe("linear");
    expect(r.data?.keys?.[0].bezier).toBeUndefined();
    expect(actionDelta(r.data!, 0.3).torso).toBeCloseTo(3, 10);
  });
});
