import { describe, expect, it } from "vitest";

import {
  actionDelta,
  ACTION_VERSION,
  cubicBezier,
  hermiteN,
  parseAction,
  smoothstep,
} from "./index";
import { resolveActing, type ActInput } from "./act3";
import { body3 } from "./figure3d";
import { parseHeldItem, type ReachHold } from "./heldItem";
import { matMul, type M3 } from "./lens";
import {
  graspAtTime,
  itemAt,
  parseScene,
  resolveScene,
  sceneAt,
  SCENE_VERSION,
  type SceneRuntime,
} from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";

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

// Mốc tay và mốc món của scene: `ease` là đường hoà vào mốc (docs/03-scene.md#đích-bàn-tay-thế-giới, docs/11-nhom-cam.md)
const held = parseHeldItem(bangGia);
if (!held.success) throw new Error(held.error.message);
const NG = parseCharacter(fx.character);
if (!NG.success) throw new Error("nguoi");
const NGUOI = NG.data;
const H = NGUOI.rig.height;
const DIMS = body3(NGUOI);
const chars = { nguoi: NGUOI };
const AT = [250, 0, 506];

function scene(hands: unknown[], items: unknown[] = [], world: object = { at: AT, yaw: 270 }) {
  const r = parseScene({
    duration: 4,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [{ id: "nguoi", base: { torso: 9, head: [0, 0, -6] }, world: { ...world, hands } }],
    items,
  });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(
    r.data,
    {},
    {},
    {},
    { nguoi: H },
    { nguoi: DIMS },
    { "bang-gia": held.data! },
  );
}

const poseAt = (rt: SceneRuntime, t: number) => sceneAt(rt, "nguoi", t, H, DIMS) as ActInput;
/** Đích tay phải (tay gần khi không lật) ở `t` */
const right = (rt: SceneRuntime, t: number) => {
  const W = poseAt(rt, t).world!;
  return (W.flip ? W.hands!.far : W.hands!.near)!;
};
/** Cổ tay phải người 3D giải ra ở `t`, toạ độ thế giới rig */
const wristOf = (rt: SceneRuntime, t: number) => {
  const W = resolveActing(NGUOI, poseAt(rt, t)).world!;
  return (W.flip ? W.hands!.far : W.hands!.near)!.at;
};
const vsub = (a: readonly number[], b: readonly number[]) => a.map((v, i) => v - b[i]);
const vlen = (a: readonly number[]) => Math.hypot(...a);
const D = 1e-4;
/** Vận tốc trái và phải của một đường vectơ tại `t` */
const vel = (g: (t: number) => readonly number[], t: number) => [
  vsub(g(t), g(t - D)).map((v) => v / D),
  vsub(g(t + D), g(t)).map((v) => v / D),
];
const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const rotRad = (A: M3, B: M3) => {
  const M = matMul(tr(A), B);
  return Math.acos(Math.max(-1, Math.min(1, (M[0] + M[4] + M[8] - 1) / 2)));
};

const P0 = [210, -200, 470];
const P1 = [235, -240, 500];
const P2 = [300, -300, 520];
const chain = (ease?: string, extra: object = {}) => [
  { t: 0, right: { at: P0 } },
  { t: 0.8, right: { at: P1, ...extra, ...(ease && { ease }) } },
  { t: 2, right: { at: P2, ...extra, ...(ease && { ease }) } },
];

describe("`ease` của mốc tay scene", () => {
  it("chuỗi `auto` ba mốc: liền vận tốc ở mốc giữa, đi qua mốc, `smooth` dừng ở mốc", () => {
    const rt = scene(chain("auto"));
    const at = (t: number) => right(rt, t).at;
    expect(vlen(vsub(at(0.8), P1))).toBeLessThan(1e-9);
    const [l, r] = vel(at, 0.8);
    expect(vlen(l)).toBeGreaterThan(20);
    expect(vlen(vsub(l, r))).toBeLessThan(0.02 * vlen(l));
    const sm = scene(chain());
    for (const v of vel((t) => right(sm, t).at, 0.8)) expect(vlen(v)).toBeLessThan(0.1);
  });

  it("dữ liệu đơn điệu thì không vọt qua mốc", () => {
    const rt = scene(chain("auto"));
    let last = right(rt, 0).at;
    for (let i = 1; i <= 600; i++) {
      const t = (2 * i) / 600;
      const p = right(rt, t).at;
      const [a, b] = t <= 0.8 ? [P0, P1] : [P1, P2];
      for (let k = 0; k < 3; k++) {
        expect(p[k]).toBeGreaterThanOrEqual(Math.min(a[k], b[k]) - 1e-9);
        expect(p[k]).toBeLessThanOrEqual(Math.max(a[k], b[k]) + 1e-9);
        expect((p[k] - last[k]) * (P2[k] - P0[k])).toBeGreaterThanOrEqual(-1e-12);
      }
      last = p;
    }
  });

  it("thiếu `ease` là `smooth`; `bezier` theo `cubic-bezier` của mốc", () => {
    const plain = scene(chain());
    const smooth = scene(chain("smooth"));
    const bez = scene(chain("bezier", { bezier: [0.5, 0, 1, 1] }));
    for (const t of [0.1, 0.4, 0.7]) {
      expect(right(plain, t).at).toStrictEqual(right(smooth, t).at);
      const u = t / 0.8;
      const s = smoothstep(u);
      right(plain, t).at.forEach((v, k) => expect(v).toBeCloseTo(P0[k] + (P1[k] - P0[k]) * s, 9));
      const b = cubicBezier(0.5, 0, 1, 1)(u);
      right(bez, t).at.forEach((v, k) => expect(v).toBeCloseTo(P0[k] + (P1[k] - P0[k]) * b, 9));
    }
  });

  it("mốc thân theo thân đang đi: mỗi mốc giải trong cùng khung ở `t` rồi mới nội suy", () => {
    const path = [
      { t: 0, at: AT, yaw: 270 },
      { t: 3, at: [AT[0] + 160, 0, AT[2] + 60], yaw: 300, ease: true },
    ];
    const keys = [
      { t: 0, offset: [20, 10, 6] },
      { t: 0.8, offset: [34, 0, 10] },
      { t: 1.6, offset: [44, -14, 16] },
      { t: 2.4, offset: [50, -30, 20] },
    ];
    const hand = (o: number[], ease?: string) => ({
      to: "chest",
      offset: o,
      point: "wrist",
      ...(ease && { ease }),
    });
    const rt = scene(
      keys.map((k, i) => ({ t: k.t, right: hand(k.offset, i ? "auto" : undefined) })),
      [],
      { path },
    );
    const one = keys.map((k) => scene([{ t: 0, right: hand(k.offset) }], [], { path }));
    for (const t of [1, 1.2, 1.5]) {
      const w = one.map((r) => wristOf(r, t));
      const want = hermiteN(w[0], w[1], w[2], w[3], 0.8, 0.8, 0.8, (t - 0.8) / 0.8);
      expect(vlen(vsub(wristOf(rt, t), want))).toBeLessThan(1e-6);
    }
    expect(vlen(vsub(wristOf(rt, 1.6), wristOf(one[2], 1.6)))).toBeLessThan(1e-6);
    // thân đã đi: cùng mốc thân ở hai giây là hai chỗ thế giới
    expect(vlen(vsub(wristOf(one[1], 0), wristOf(one[1], 2)))).toBeGreaterThan(50);
    const [l, r] = vel((t) => wristOf(rt, t), 1.6);
    expect(vlen(vsub(l, r))).toBeLessThan(0.02 * vlen(l));
  });

  it("trường số của chỗ cầm trượt theo `auto` của mốc `hold`", () => {
    const sheet = { item: "bang-gia", group: "sheet", edge: "right", thumb: "front" };
    const k = (t: number, along: number, ease?: string) => ({
      t,
      right: {
        to: "chest",
        offset: [30, 20, -20],
        point: "grip",
        hold: { ...sheet, along },
        ...(ease && { ease }),
      },
    });
    const along = (rt: SceneRuntime) => (t: number) => [
      (right(rt, t).hold as ReachHold).grasp!.hold.along as number,
    ];
    const auto = along(scene([k(0, 0.1), k(1, 0.4, "auto"), k(2, 0.9, "auto")]));
    const [l, r] = vel(auto, 1);
    expect(l[0]).toBeGreaterThan(0.2);
    expect(Math.abs(l[0] - r[0])).toBeLessThan(0.02 * l[0]);
    const smooth = along(scene([k(0, 0.1), k(1, 0.4), k(2, 0.9)]));
    for (const v of vel(smooth, 1)) expect(Math.abs(v[0])).toBeLessThan(1e-3);
  });
});

describe("`ease` của mốc món", () => {
  const mark = (t: number, at: number[], toward: number[], ease?: string) => ({
    t,
    cast: "nguoi",
    item: "bang-gia",
    at,
    face: { axis: "front", toward },
    roll: { axis: "top", toward: "up" },
    ...(ease && { ease }),
  });
  const SHEET = { item: "bang-gia", group: "sheet", edge: "right", along: 0.33, thumb: "front" };
  const marks = (ease?: string) => [
    mark(0.5, [300, -260, 420], [-1, 0, 0]),
    mark(1.5, [320, -280, 440], [-1, 0, 0.6], ease),
    mark(2.5, [360, -300, 450], [-0.3, 0, 1], ease),
  ];
  const hold = [{ t: 0, right: { hold: SHEET } }];

  it("`itemAt`: chỗ và hướng món liền vận tốc ở mốc giữa; `smooth` dừng", () => {
    const rt = scene(hold, marks("auto"));
    const P = (t: number) => itemAt(rt, "bang-gia", t, { chars })!.P;
    const [l, r] = vel(P, 1.5);
    expect(vlen(l)).toBeGreaterThan(10);
    expect(vlen(vsub(l, r))).toBeLessThan(0.02 * vlen(l));
    const R = (t: number) => itemAt(rt, "bang-gia", t, { chars })!.R;
    const wl = rotRad(R(1.5 - D), R(1.5)) / D;
    const wr = rotRad(R(1.5), R(1.5 + D)) / D;
    expect(wl).toBeGreaterThan(0.1);
    expect(Math.abs(wl - wr)).toBeLessThan(0.02 * wl);
    const sm = scene(hold, marks());
    const Rs = (t: number) => itemAt(sm, "bang-gia", t, { chars })!.R;
    expect(rotRad(Rs(1.5), Rs(1.5 + D)) / D).toBeLessThan(1e-3);
  });

  it("`itemAt`: góc quay đơn điệu dọc đoạn, không vọt qua hướng của mốc", () => {
    const rt = scene(hold, marks("auto"));
    const R = (t: number) => itemAt(rt, "bang-gia", t, { chars })!.R;
    const R1 = R(1.5);
    const total = rotRad(R1, R(2.5));
    let last = 0;
    for (let i = 1; i <= 100; i++) {
      const g = rotRad(R1, R(1.5 + i / 100));
      expect(g).toBeGreaterThanOrEqual(last - 1e-9);
      expect(g).toBeLessThanOrEqual(total + 1e-9);
      last = g;
    }
  });

  it("lần cầm một tay theo mốc: cổ tay và bàn tay liền vận tốc ở mốc giữa", () => {
    const rt = scene(hold, marks("auto"));
    const sol = (t: number) => graspAtTime(rt, "nguoi", "right", t, { chars })!;
    const [l, r] = vel((t) => sol(t).Wp, 1.5);
    expect(vlen(l)).toBeGreaterThan(0.05);
    expect(vlen(vsub(l, r))).toBeLessThan(0.02 * vlen(l));
    const wl = rotRad(sol(1.5 - D).Rw, sol(1.5).Rw) / D;
    const wr = rotRad(sol(1.5).Rw, sol(1.5 + D).Rw) / D;
    expect(wl).toBeGreaterThan(0.1);
    expect(Math.abs(wl - wr)).toBeLessThan(0.02 * wl);
  });

  it("`bezier` của mốc món: phần hoà ở `u` là `cubic-bezier(u)`", () => {
    const bz = [0.2, 0.7, 0.4, 1];
    const rt = scene(
      hold,
      marks("bezier").map((m, i) => (i ? { ...m, bezier: bz } : m)),
    );
    const lin = scene(hold, marks("linear"));
    const u = 0.3;
    const f = cubicBezier(0.2, 0.7, 0.4, 1)(u);
    const a = itemAt(rt, "bang-gia", 0.5 + u, { chars })!.P;
    const b = itemAt(lin, "bang-gia", 0.5 + f, { chars })!.P;
    expect(vlen(vsub(a, b))).toBeLessThan(1e-6);
  });
});

describe(`scene đời ${SCENE_VERSION}`, () => {
  const json = (v: number) => ({
    schemaVersion: v,
    duration: 2,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [{ id: "nguoi", world: { at: AT, yaw: 270, hands: chain() } }],
    items: [{ t: 0, cast: "nguoi", item: "bang-gia", to: "chest", offset: [30, 0, 0] }],
  });

  it("scene bản 30 nạp y như bản hiện hành; bản mới hơn rig là lỗi phiên bản", () => {
    const old = parseScene(json(30));
    expect(old.success).toBe(true);
    expect(old.data).toStrictEqual(parseScene(json(SCENE_VERSION)).data);
    expect(old.data!.schemaVersion).toBe(SCENE_VERSION);
    const next = parseScene(json(SCENE_VERSION + 1));
    expect(next.success).toBe(false);
    expect(next.error!.message).toMatch(/phiên bản schema/);
  });
});

describe("`auto` của lần cầm theo mốc: `φ` qua `±180°`", () => {
  // bốn mốc món, `φ` ở mốc ≈ 160, 172,5, −57,5 (= 302,5), −40 (= 320): tăng đều, đoạn giữa đi qua `180°`
  const AT4 = [
    [260, -350, 380],
    [380, -380, 520],
    [300, -300, 520],
    [270, -340, 520],
  ];
  const rt = scene(
    [
      {
        t: 0,
        right: {
          hold: { item: "bang-gia", group: "sheet", edge: "right", along: 0.33, thumb: "front" },
          elbow: [-1, 0, 0],
        },
      },
    ],
    AT4.map((at, i) => ({
      t: 0.5 + i,
      cast: "nguoi",
      item: "bang-gia",
      at,
      face: { axis: "front", toward: [-1, 0, 0] },
      roll: { axis: "top", toward: "up" },
      ...(i && { ease: "auto" }),
    })),
  );
  const phi = (t: number) => graspAtTime(rt, "nguoi", "right", t, { chars })!.arm.phi;
  const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
  const dphi = (t: number) => [wrap(phi(t) - phi(t - D)) / D, wrap(phi(t + D) - phi(t)) / D];

  it("đi đường ngắn qua `180°`, liền vận tốc ở hai mốc kẹp đoạn ấy", () => {
    const [a, b] = [phi(1.5), phi(2.5)];
    expect(Math.abs(b - a)).toBeGreaterThan(180);
    let run = 0;
    for (let i = 1; i <= 100; i++) {
      const d = wrap(phi(1.5 + i / 100) - phi(1.5 + (i - 1) / 100));
      expect(d).toBeGreaterThanOrEqual(-1e-9);
      run += d;
    }
    expect(run).toBeCloseTo(wrap(b - a), 6);
    for (const t of [1.5, 2.5]) {
      const [l, r] = dphi(t);
      expect(l).toBeGreaterThan(5);
      expect(Math.abs(l - r)).toBeLessThan(0.02 * l);
    }
  });
});

describe("tay phụ vào chỗ cầm giữa chuỗi `auto`", () => {
  const lead = (hold?: object) => ({
    to: "chest",
    offset: [30, 20, 10],
    point: "grip",
    ...(hold && { hold }),
  });
  const own = (ease?: string) =>
    [
      [10, 20, -10],
      [24, 10, -14],
      [60, -20, -24],
      [70, -40, -20],
    ].map((offset, i) => ({
      t: i,
      left: { to: "chest", offset, point: "wrist", ...(i && ease && { ease }) },
    }));
  const run = (grab: boolean, ease?: string) => {
    const [k0, k1, ...rest] = own(ease);
    return scene([
      { ...k0, right: lead() },
      k1,
      {
        t: 1.2,
        right: lead(grab ? { item: "bang-gia", group: "sheet", both: true } : undefined),
      },
      ...rest,
    ]);
  };
  /** Cổ tay trái người 3D giải ra ở `t` */
  const left = (rt: SceneRuntime, t: number) => {
    const W = resolveActing(NGUOI, poseAt(rt, t)).world!;
    return (W.flip ? W.hands!.near : W.hands!.far)!.at;
  };

  it("vừa cầm, cổ tay tay phụ còn trên chuỗi `auto` của nó, không nhảy sang đích ước lượng", () => {
    const free = run(false, "auto");
    const grab = run(true, "auto");
    const t = 1.2 + 1e-3;
    // trên đoạn giữa, chuỗi `auto` và `smoothstep` cách nhau đủ xa để thấy nhảy
    const gap = vlen(vsub(left(free, t), left(run(false), t)));
    expect(gap).toBeGreaterThan(2);
    expect(vlen(vsub(left(grab, t), left(free, t)))).toBeLessThan(0.02 * gap);
    // xong quãng hoà: tay phụ ở chỗ cầm, không theo chuỗi nữa
    expect(vlen(vsub(left(grab, 2), left(free, 2)))).toBeGreaterThan(5);
  });
});
