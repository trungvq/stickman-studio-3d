import { describe, expect, it } from "vitest";

import { D } from "./index";
import { SculptSchema, type Sculpt } from "./index";
import { SCULPT_PRESETS, chain, hairline, sculptPaths, sculptPresetOf, weld } from "./index";
import type { Vec3 } from "./index";

const R = 65;
const points = (d: string) =>
  [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
/** Diện tích có dấu cộng dồn mọi subpath: hàn ô giữ nguyên nó */
const area = (d: string) =>
  d
    .split("M")
    .filter(Boolean)
    .reduce((sum, sub) => {
      const p = points(sub);
      return (
        sum +
        p.reduce(
          (a, [x, y], i) => a + x * p[(i + 1) % p.length][1] - p[(i + 1) % p.length][0] * y,
          0,
        ) /
          2
      );
    }, 0);

describe("tóc dựng khối", () => {
  it("tóc ngắn: phần sau thân chỉ là vách chân tóc nằm dưới nét viền đầu", () => {
    for (const yaw of [-90, -45, 0, 45, 90, 120, 180])
      for (const pitch of [-30, 0, 30]) {
        const p = sculptPaths(SCULPT_PRESETS.short.sculpt, { yaw, pitch }, "round", 0, 0, R, R);
        for (const [x, y] of points(p.under)) expect(Math.hypot(x, y)).toBeLessThan(R * 1.03);
      }
  });

  it("tóc gai vươn khỏi vỏ phồng theo hệ số, không có đường ngôi", () => {
    const s = SCULPT_PRESETS.spiky.sculpt;
    const p = sculptPaths(s, { yaw: 0, pitch: 0 }, "round", 0, 0, R, R);
    const top = Math.min(...points(p.cap).map(([, y]) => y));
    expect(-top).toBeGreaterThan(R * (1 + s.volume + 0.15));
    expect(p.lines).toEqual([]);
    const flat = sculptPaths({ ...s, spike: 0 }, { yaw: 0, pitch: 0 }, "round", 0, 0, R, R);
    expect(-Math.min(...points(flat.cap).map(([, y]) => y))).toBeLessThan(
      R * (1 + s.volume + 0.05),
    );
  });

  it("ô vỏ không bị bỏ theo chiều quay: sau mặt phẳng giữa thì vào lớp khoét theo viền đầu", () => {
    const s = SCULPT_PRESETS.spiky.sculpt;
    for (const [yaw, pitch] of [
      [0, 0],
      [20, 15],
      [-70, -30],
      [180, 0],
    ]) {
      const p = sculptPaths(s, { yaw, pitch }, "round", 0, 0, R, R);
      const whole = Math.abs(area(p.cap)) + Math.abs(area(p.back));
      const front = sculptPaths(s, { yaw: 0, pitch: 0 }, "round", 0, 0, R, R);
      expect(whole / (Math.abs(area(front.cap)) + Math.abs(area(front.back)))).toBeGreaterThan(
        0.95,
      );
      expect(p.back).not.toBe("");
    }
  });

  it("hàn ô: cạnh chung triệt tiêu, ô quấn ngược vẫn cộng vào, diện tích giữ nguyên", () => {
    const at = (x: number, y: number): Vec3 => [x, y, 0];
    const cells = [0, 1, 2].flatMap((i) =>
      [0, 1].map((k) => [at(i, k), at(i + 1, k), at(i + 1, k + 1), at(i, k + 1)]),
    );
    cells[3].reverse();
    const d = weld(cells);
    expect(d.split("M").length - 1).toBe(1);
    expect(points(d)).toHaveLength(10);
    expect(Math.abs(area(d))).toBeCloseTo(6, 6);
  });

  it("nối nét: đoạn chung đỉnh thành một polyline, đoạn trùng vẽ một lần", () => {
    const at = (x: number, y: number): Vec3 => [x, y, 0];
    const d = chain([
      [at(0, 0), at(1, 0)],
      [at(2, 0), at(1, 0)],
      [at(1, 0), at(0, 0)],
      [at(2, 0), at(2, 1), at(3, 1)],
    ]);
    expect(d.split("M").length - 1).toBe(1);
    expect(points(d)).toHaveLength(5);
  });

  it("tóc chải gọn đổi phía ngôi thì lật gương cả nét lẫn vỏ", () => {
    const s = SCULPT_PRESETS.neat.sculpt;
    const t = { yaw: 0, pitch: 0 };
    const p = sculptPaths(s, t, "round", 0, 0, R, R);
    const q = sculptPaths({ ...s, part: -s.part }, t, "round", 0, 0, R, R);
    const key = (d: string, sx: number) =>
      points(d)
        .map(([x, y]) => `${(sx * x).toFixed(1)} ${y.toFixed(1)}`.replace(/^-0\.0 /, "0.0 "))
        .sort();
    expect(key(q.lines.join(""), -1)).toEqual(key(p.lines.join(""), 1));
    expect(key(q.cap, -1)).toEqual(key(p.cap, 1));
  });

  it("mái bằng chỉ có nét cắt, không đường ngôi; ngôi giữa đối xứng hai bên", () => {
    const t = { yaw: 0, pitch: 0 };
    expect(sculptPaths(SCULPT_PRESETS.round.sculpt, t, "round", 0, 0, R, R).lines).toHaveLength(1);
    const p = sculptPaths(SCULPT_PRESETS.center.sculpt, t, "round", 0, 0, R, R);
    const xs = points(p.cap).map(([x]) => x);
    expect(Math.max(...xs)).toBeCloseTo(-Math.min(...xs), 0);
  });

  it("đuôi chia lọn: mũi lọn chạm `length`, giữa hai lọn ngắn hơn", () => {
    const s = SCULPT_PRESETS.center.sculpt;
    const p = sculptPaths(s, { yaw: 180, pitch: 0 }, "round", 0, 0, R, R);
    const ys = points(p.cap).map(([, y]) => y);
    expect(Math.max(...ys)).toBeCloseTo(s.length * R, 0);
    const tips = ys.filter((y) => y > s.length * R - 1).length;
    expect(tips).toBeGreaterThan(2);
    expect(tips).toBeLessThan(ys.filter((y) => y > R * (s.length - 0.3)).length / 2);
  });

  it("bob cụp vào, tóc ngang vai hất ra và mép đuôi lượn theo ngôi", () => {
    const radiusAtTip = (preset: "bob" | "shoulder", plain = false) => {
      const s = SCULPT_PRESETS[preset].sculpt;
      const p = sculptPaths(
        plain ? { ...s, style: "plain" } : s,
        { yaw: 0, pitch: 0 },
        "round",
        0,
        0,
        R,
        R,
      );
      return Math.max(
        ...points(p.cap + p.under)
          .filter(([, y]) => y > (s.length - 0.2) * R)
          .map(([x]) => Math.abs(x)),
      );
    };
    expect(radiusAtTip("bob")).toBeLessThan(radiusAtTip("bob", true) - R * 0.07);
    expect(radiusAtTip("shoulder")).toBeGreaterThan(radiusAtTip("shoulder", true) + R * 0.02);
    const s = SCULPT_PRESETS.shoulder.sculpt;
    const key = (part: number, sign: number) => {
      const p = sculptPaths({ ...s, part }, { yaw: 0, pitch: 0 }, "round", 0, 0, R, R);
      return [
        ...new Set(
          points(p.cap + p.under).map(([x, y]) =>
            `${(x * sign).toFixed(1)} ${y.toFixed(1)}`.replace(/^-0\.0 /, "0.0 "),
          ),
        ),
      ].sort();
    };
    expect(key(s.part, 1)).toEqual(key(-s.part, -1));
  });

  it("vuốt ngược để trán cao và dồn khối về trước", () => {
    const s = SculptSchema.parse(SCULPT_PRESETS.slick.sculpt);
    for (const lon of [-55, -30, 0, 30, 55]) expect(hairline(s, lon)).toBeGreaterThan(47);
    const p = sculptPaths(s, { yaw: 90, pitch: 0 }, "round", 0, 0, R, R);
    const upper = points(p.cap + p.back).filter(([, y]) => y < -R * 0.8);
    const front = Math.min(...upper.filter(([x]) => x > R * 0.2).map(([, y]) => y));
    const rear = Math.min(...upper.filter(([x]) => x < -R * 0.2).map(([, y]) => y));
    expect(front).toBeLessThan(rear - R * 0.05);
  });

  it("lọn vuốt và nét chải lật theo ngôi ở cả trước lẫn sau", () => {
    const s = SCULPT_PRESETS.slick.sculpt;
    const key = (d: string, sign: number) =>
      points(d)
        .map(([x, y]) => `${(sign * x).toFixed(1)} ${y.toFixed(1)}`.replace(/^-0\.0 /, "0.0 "))
        .sort();
    for (const [yaw, pitch] of [
      [0, 0],
      [45, 25],
      [90, -25],
      [120, 0],
      [180, 0],
    ]) {
      const p = sculptPaths(s, { yaw, pitch }, "round", 0, 0, R, R);
      const q = sculptPaths({ ...s, part: -s.part }, { yaw: -yaw, pitch }, "round", 0, 0, R, R);
      expect(key(p.lines.join(""), 1)).toEqual(key(q.lines.join(""), -1));
      const a = points(p.cap + p.back);
      const b = points(q.cap + q.back).map(([x, y]) => [-x, y]);
      for (const axis of [0, 1]) {
        expect(Math.min(...a.map((p) => p[axis]))).toBeCloseTo(
          Math.min(...b.map((p) => p[axis])),
          0,
        );
        expect(Math.max(...a.map((p) => p[axis]))).toBeCloseTo(
          Math.max(...b.map((p) => p[axis])),
          0,
        );
      }
      expect(p.cap + p.back + p.lines.join("")).not.toMatch(/NaN|Infinity/);
    }
  });

  it("xoăn: viền trên gợn thành búp, chân tóc thành vỏ sò, có nét khe giữa búp", () => {
    const s = SculptSchema.parse(SCULPT_PRESETS.curly.sculpt);
    expect(hairline(s, 15)).toBeLessThan(hairline(s, 0) - 6);
    /** Số búp trên nửa trên bóng tóc: bán kính lớn nhất theo góc, đỉnh nhô hơn khe hai bên 1 px */
    const peaks = (raw: Partial<typeof s>) => {
      const p = sculptPaths(raw, { yaw: 90, pitch: 0 }, "round", 0, 0, R, R);
      const far = new Map<number, number>();
      // Nội suy dọc cạnh: dải gộp nhiều ô chỉ có đỉnh ở góc ô
      const dense = (p.cap + p.back)
        .split("M")
        .filter(Boolean)
        .flatMap((d) => {
          const q = points(d);
          return q.flatMap(([x, y], i) => {
            const [u, v] = q[(i + 1) % q.length];
            return [0, 0.25, 0.5, 0.75].map((k) => [x + (u - x) * k, y + (v - y) * k]);
          });
        });
      for (const [x, y] of dense) {
        const k = Math.round(Math.atan2(-y, x) / D / 3);
        if (k > 3 && k < 57) far.set(k, Math.max(far.get(k) ?? 0, Math.hypot(x, y)));
      }
      let count = 0;
      let ext = 0;
      let up = true;
      for (const v of [...far].sort(([a], [b]) => a - b).map(([, r]) => r)) {
        if (up ? v > ext : v < ext) ext = v;
        else if (up ? v < ext - 1 : v > ext + 1) {
          if (up) count++;
          up = !up;
          ext = v;
        }
      }
      return count;
    };
    expect(peaks(s)).toBeGreaterThanOrEqual(4);
    expect(peaks(SCULPT_PRESETS.short.sculpt)).toBeLessThanOrEqual(1);
    const p = sculptPaths(s, { yaw: 0, pitch: 25 }, "round", 0, 0, R, R);
    expect(p.lines.length).toBeGreaterThanOrEqual(3);
    expect(p.cap + p.back + p.lines.join("")).not.toMatch(/NaN|Infinity/);
  });

  it("hói đỉnh: chỉ vành tóc hai bên và sau gáy, trán và đỉnh trọc, không nét ngôi", () => {
    const s = SCULPT_PRESETS.bald.sculpt;
    const front = sculptPaths(s, { yaw: 0, pitch: 0 }, "round", 0, 0, R, R);
    for (const [x] of points(front.cap)) expect(Math.abs(x)).toBeGreaterThan(R * 0.75);
    for (const yaw of [0, 60, 90, 180]) {
      const p = sculptPaths(s, { yaw, pitch: 0 }, "round", 0, 0, R, R);
      expect(p.cap).not.toBe("");
      expect(p.lines).toEqual([]);
      for (const [, y] of points(p.cap + p.back)) expect(y).toBeGreaterThan(-R * 0.65);
      expect(p.cap + p.back + p.capEdge + p.backEdge).not.toMatch(/NaN|Infinity/);
    }
    // Vành cao hơn, vòng ra trước hơn: hói ít hơn
    const top = (raw: Partial<Sculpt>) =>
      Math.min(
        ...points(sculptPaths(raw, { yaw: 0, pitch: 0 }, "round", 0, 0, R, R).cap).map(
          ([, y]) => y,
        ),
      );
    expect(top(SCULPT_PRESETS.baldLight.sculpt)).toBeLessThan(top(s) - R * 0.3);
    expect(sculptPresetOf(SCULPT_PRESETS.baldLight.sculpt)).toBe("baldLight");
    expect(sculptPresetOf({ ...s, crownEase: 0 })).toBeUndefined();
    expect(
      sculptPaths({ ...s, crownEase: 0 }, { yaw: 30, pitch: 0 }, "round", 0, 0, R, R).cap,
    ).not.toMatch(/NaN/);
  });

  it("nhận ra mẫu từ bộ số", () => {
    expect(sculptPresetOf(undefined)).toBe("short");
    expect(sculptPresetOf(SCULPT_PRESETS.spiky.sculpt)).toBe("spiky");
    expect(sculptPresetOf({ ...SCULPT_PRESETS.spiky.sculpt, spike: 1.3 })).toBeUndefined();
  });

  it("tóc rủ tách phần sau tâm đầu ra lớp sau thân", () => {
    const s = SCULPT_PRESETS.shoulder.sculpt;
    const front = sculptPaths(s, { yaw: 0, pitch: 0 }, "round", 0, 0, R, R);
    expect(front.under).not.toBe("");
    // Nhìn từ sau, mảng rủ sau gáy nằm trên thân, che kín dưới tâm đầu
    const back = sculptPaths(s, { yaw: 180, pitch: 0 }, "round", 0, 0, R, R);
    expect(Math.max(...points(back.cap).map(([, y]) => y))).toBeCloseTo(s.length * R, 0);
  });

  it("đuôi tóc treo theo khung hình dù nhóm đầu xoay, gật hay lắc", () => {
    const s = SCULPT_PRESETS.shoulder.sculpt;
    for (const roll of [-30, 0, 25])
      for (const [yaw, pitch] of [
        [0, 0],
        [50, 20],
        [-70, -30],
      ]) {
        const p = sculptPaths(s, { yaw, pitch }, "round", 0, 0, R, R, roll);
        // Hướng xuống của khung hình, đo trong nhóm đầu đã xoay `roll`
        const [gx, gy] = [Math.sin(roll * D), Math.cos(roll * D)];
        const low = Math.max(...points(p.cap + p.under).map(([x, y]) => x * gx + y * gy));
        expect(low).toBeCloseTo(s.length * R, 0);
      }
  });

  it("đuôi ngựa buộc thấp: nhìn trước nằm sau đầu, nhìn sau vẽ trên tóc", () => {
    const s = SCULPT_PRESETS.ponyLow.sculpt;
    const front = sculptPaths(s, { yaw: 0, pitch: 0 }, "round", 0, 0, R, R);
    expect(front.knot).toBe("");
    expect(front.under).not.toBe("");
    expect(front.lines).toEqual([]);
    const back = sculptPaths(s, { yaw: 180, pitch: 0 }, "round", 0, 0, R, R);
    expect(back.knot).not.toBe("");
    expect(back.knotEdge).not.toBe("");
  });

  it("đuôi ngựa của mẫu ngắn, không lộ dưới đầu ở góc nào", () => {
    for (const preset of ["ponyHigh", "ponyLow"] as const)
      for (const yaw of [-90, -45, 0, 45, 90, 180])
        for (const pitch of [-25, 0, 25]) {
          const p = sculptPaths(SCULPT_PRESETS[preset].sculpt, { yaw, pitch }, "round", 0, 0, R, R);
          expect(Math.max(...points(p.knot + p.under).map(([, y]) => y))).toBeLessThan(R * 0.97);
        }
  });

  it("đuôi ngựa buộc cao nhìn nghiêng vồng ra sau gáy, hai phía đối xứng", () => {
    const s = SCULPT_PRESETS.ponyHigh.sculpt;
    const reach = (yaw: number, sign: number) => {
      const p = sculptPaths(s, { yaw, pitch: 0 }, "round", 0, 0, R, R);
      return Math.max(...points(p.knot + p.under).map(([x]) => x * sign));
    };
    expect(reach(90, -1)).toBeGreaterThan(R * 1.15);
    expect(reach(90, -1)).toBeCloseTo(reach(-90, 1), 0);
    expect(reach(60, -1)).toBeCloseTo(reach(-60, 1), 0);
  });

  it("đuôi ngựa treo theo khung hình khi nhóm đầu lắc", () => {
    // Đuôi dài hơn mẫu cho mũi đuôi thấp hơn hẳn vách chân tóc sau gáy
    const s = { ...SCULPT_PRESETS.ponyLow.sculpt, tail: 1.3 };
    for (const roll of [-25, 25]) {
      const p = sculptPaths(s, { yaw: 180, pitch: 0 }, "round", 0, 0, R, R, roll);
      const [gx, gy] = [Math.sin(roll * D), Math.cos(roll * D)];
      const [x, y] = points(p.knot + p.under).reduce((a, b) =>
        b[0] * gx + b[1] * gy > a[0] * gx + a[1] * gy ? b : a,
      );
      // Mũi đuôi ở ngay dưới chỗ buộc theo khung hình; gắn cứng vào đầu thì lệch cả nửa bán kính
      expect(Math.abs(x * gy - y * gx)).toBeLessThan(R * 0.15);
    }
  });

  it("búi nhô khỏi đỉnh vỏ, nhìn trước nằm sau đầu, nhìn sau vẽ trên tóc", () => {
    const s = SCULPT_PRESETS.bun.sculpt;
    const front = sculptPaths(s, { yaw: 0, pitch: 0 }, "round", 0, 0, R, R);
    expect(front.knot).toBe("");
    expect(front.lines).toEqual([]);
    expect(-Math.min(...points(front.under).map(([, y]) => y))).toBeGreaterThan(
      R * (1 + s.volume + 0.2),
    );
    const back = sculptPaths(s, { yaw: 180, pitch: 0 }, "round", 0, 0, R, R);
    expect(back.knot).not.toBe("");
    expect(back.knotEdge).not.toBe("");
  });

  it("ngắn xù: không nét ngôi, đuôi rủ sau gáy, mũi lọn so le", () => {
    const tips = (raw: Partial<Sculpt>) => {
      const p = sculptPaths(raw, { yaw: 180, pitch: 0 }, "round", 0, 0, R, R);
      const low = ((raw.length ?? 0) - 0.3) * R;
      const bins = new Map<number, number>();
      for (const [x, y] of points(p.cap + p.under))
        if (Math.abs(x) < R * 0.7 && y > low) {
          const b = Math.round(x / 2);
          bins.set(b, Math.max(bins.get(b) ?? y, y));
        }
      // Gộp đoạn bằng nhau rồi lấy đỉnh cao hơn cả hai bên
      const edge = [...bins]
        .sort(([a], [b]) => a - b)
        .map(([, y]) => y)
        .filter((y, i, a) => y !== a[i - 1]);
      return edge.filter((y, i) => y > edge[i - 1] && y > edge[i + 1]);
    };
    const s = SCULPT_PRESETS.messy.sculpt;
    const p = sculptPaths(s, { yaw: 0, pitch: 0 }, "round", 0, 0, R, R);
    expect(p.lines).toEqual([]);
    expect(p.under).not.toBe("");
    const messy = tips(s);
    expect(Math.max(...messy) - Math.min(...messy)).toBeGreaterThan(R * 0.05);
    // Đối chứng: đuôi chia lọn không so le thì mọi mũi lọn bằng nhau
    const even = tips(SCULPT_PRESETS.center.sculpt);
    expect(Math.max(...even) - Math.min(...even)).toBeLessThan(1);
  });

  it("xoăn bồng: khối tóc ôm cả đầu, rộng ra hai bên, chân tóc hai bên xuống ngang cằm", () => {
    const s = SCULPT_PRESETS.afro.sculpt;
    const p = sculptPaths(s, { yaw: 0, pitch: 0 }, "round", 0, 0, R, R);
    const pts = points(p.cap + p.back);
    expect(Math.max(...pts.map(([x]) => Math.abs(x)))).toBeGreaterThan(R * 1.35);
    expect(-Math.min(...pts.map(([, y]) => y))).toBeGreaterThan(R * 1.35);
    expect(Math.max(...pts.filter(([x]) => Math.abs(x) > R).map(([, y]) => y))).toBeGreaterThan(
      R * 0.5,
    );
  });

  it("đuôi ngựa, búi, ngắn xù, xoăn bồng: không NaN ở mọi hướng đầu, nhận ra mẫu", () => {
    for (const k of ["ponyHigh", "ponyLow", "bun", "messy", "afro"] as const) {
      const s = SCULPT_PRESETS[k].sculpt;
      expect(sculptPresetOf(s)).toBe(k);
      for (const raw of [s, { ...s, tie: 90 }, { ...s, tie: -90 }, { ...s, tail: 0 }])
        for (const [yaw, pitch, roll] of [
          [0, 0, 0],
          [90, 0, 0],
          [-90, 30, 0],
          [135, -30, 20],
          [180, 0, -25],
          [-45, 20, 10],
        ]) {
          const p = sculptPaths(raw, { yaw, pitch }, "round", 0, 0, R, R, roll);
          expect(
            p.cap + p.back + p.under + p.knot + p.capEdge + p.backEdge + p.underEdge + p.knotEdge,
          ).not.toMatch(/NaN|Infinity/);
        }
    }
    expect(sculptPresetOf({ ...SCULPT_PRESETS.ponyLow.sculpt, tail: 1.5 })).toBeUndefined();
  });

  it("đầu đinh sát sọ, tròn ngắn có mũi lọn xoáy và trán vòm, mái dựng cao hơn tóc ngắn", () => {
    const at = (raw: Partial<Sculpt>, yaw: number) =>
      points(sculptPaths(raw, { yaw, pitch: 0 }, "round", 0, 0, R, R).cap);
    for (const yaw of [0, 90, 180])
      for (const [x, y] of at(SCULPT_PRESETS.buzz.sculpt, yaw))
        expect(Math.hypot(x, y)).toBeLessThan(R * 1.06);
    const crop = SculptSchema.parse(SCULPT_PRESETS.crop.sculpt);
    expect(hairline(crop, -12)).toBeLessThan(hairline(crop, 0) - crop.fringe);
    expect(hairline(crop, 45)).toBeLessThan(hairline(crop, 20));
    const top = (raw: Partial<Sculpt>) => -Math.min(...at(raw, 90).map(([, y]) => y));
    expect(top(SCULPT_PRESETS.quiff.sculpt)).toBeGreaterThan(
      top(SCULPT_PRESETS.short.sculpt) + R * 0.1,
    );
    for (const k of ["buzz", "crop", "quiff"] as const) {
      const s = SCULPT_PRESETS[k].sculpt;
      expect(sculptPresetOf(s)).toBe(k);
      for (const [yaw, pitch] of [
        [0, 0],
        [90, 0],
        [-135, 30],
        [180, -30],
      ]) {
        const p = sculptPaths(s, { yaw, pitch }, "round", 0, 0, R, R);
        expect(p.cap + p.back + p.lines.join("")).not.toMatch(/NaN|Infinity/);
      }
    }
  });
});
