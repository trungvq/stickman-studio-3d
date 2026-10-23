import { describe, expect, it } from "vitest";

import { parseAction, type ActionData } from "./index";
import { D } from "./index";
import { body3, dirOf, feet3 } from "./index";
import { feet } from "./index";
import { defaultCharacter } from "./index";
import {
  actionStride,
  parseScene,
  resolveScene,
  sceneAt,
  sceneEvents,
  sceneTurnProblems,
  sceneSlideProblems,
  worldFacingAt,
  type SceneRuntime,
} from "./index";
import { bakeTravel, nextBearing, standing } from "./index";

const c = defaultCharacter();
const dims = body3(c);
const h = c.rig.height;

function action(json: unknown): ActionData {
  const r = parseAction(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}

const ACTIONS: Record<string, ActionData> = {
  idle: action({
    name: "idle",
    duration: 3.2,
    end: "wrap",
    gen: "idleSway",
    params: { breath: 2, arm: 3, lean: 0 },
  }),
  walk: action({
    name: "walk",
    duration: 1.1,
    end: "wrap",
    gen: "walkCycle",
    authoredAt: "side",
    params: { hip: 28, knee: 68, stance: 0.6, arm: 25, elbow: 24, lean: 1, crouch: 0, dip: 1 },
    events: [
      { name: "step", t: 0.211 },
      { name: "step", t: 0.711 },
    ],
  }),
  walkHold: action({
    name: "walkHold",
    duration: 1.1,
    end: "hold",
    gen: "walkCycle",
    authoredAt: "side",
    params: { hip: 28, knee: 68, stance: 0.6, arm: 25, elbow: 24, lean: 1, crouch: 0, dip: 1 },
    events: [
      { name: "step", t: 0.211 },
      { name: "step", t: 0.711 },
    ],
  }),
  raise: action({
    name: "raise",
    duration: 1,
    end: "hold",
    mask: ["armNear"],
    keys: [{ t: 0, pose: { armNear: [150, -60, 0] }, layer: { armNear: "front" } }],
  }),
  sit: action({
    name: "sit",
    duration: 1,
    authoredAt: "side",
    mask: ["legFar", "legNear", "torso"],
    keys: [{ t: 0, pose: { legFar: [90, -90], legNear: [90, -90], torso: 3 } }],
  }),
};

const LENS = { eye: [0, -200, 0], yaw: 0, pitch: 0, f: 800, cx: 0, cy: -200 };

function scene(cast: unknown[], duration?: number): SceneRuntime {
  const r = parseScene({ lens: LENS, cast, ...(duration ? { duration } : {}) });
  if (!r.success) throw new Error(r.error.message);
  return resolveScene(r.data, ACTIONS);
}

type Key = {
  t: number;
  at: [number, number, number];
  yaw: number;
  sit?: boolean;
  steps?: number;
};

/** Đi theo vòng tròn tâm `[cx, cz]` bán kính `rho`, từ góc `a0` tới `a1` (độ) trong `dur` giây */
function arc(cx: number, cz: number, rho: number, a0: number, a1: number, dur: number): Key[] {
  const n = Math.ceil(dur / 0.25);
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (a0 + ((a1 - a0) * i) / n) * D;
    const dir = Math.sign(a1 - a0);
    // hướng đi là tiếp tuyến: x = −sin, z = cos theo chiều góc tăng
    const yaw = Math.atan2(-dir * Math.cos(a), -dir * Math.sin(a)) / D;
    return {
      t: (dur * i) / n,
      at: [cx + rho * Math.cos(a), 0, cz + rho * Math.sin(a)] as [number, number, number],
      yaw,
    };
  });
}

/**
 * Bàn chân trụ trong thế giới: chân chịu lực theo đúng luật của `bakeFeetTravel`, cộng dồn độ
 * dịch của nó suốt từng pha trụ (một chân chịu lực, không đổi chân); trả độ dịch lớn nhất và số
 * pha trụ đã đo.
 */
function stanceSlip(rt: SceneRuntime, id: string, from = 0, to = rt.duration) {
  let prev: { ft: number[][]; fwd: number[]; flip: boolean } | undefined;
  let bearing: number[] = [];
  let acc: [number, number] = [0, 0];
  let stance = "";
  let worst = 0;
  let phases = 0;
  for (let t = from; t <= to + 1e-9; t += 1 / 120) {
    const s = sceneAt(rt, id, t, h, dims);
    const w = s.world!;
    const ft = feet3(s.pose, w, h, dims.hipHalf);
    const F = dirOf(w.yaw);
    const fwd = ft.map((p) => (p[0] - w.hip[0]) * F[0] + (p[2] - w.hip[2]) * F[2]);
    const ys = feet(s.pose, h).map((p) => p[1] / h);
    if (!prev) bearing = standing(ys);
    else {
      if (prev.flip !== w.flip) {
        bearing = bearing.map((i) => 1 - i);
        prev.ft.reverse();
        prev.fwd.reverse();
        stance = bearing.join();
      }
      const p = prev;
      bearing = nextBearing(
        bearing,
        ys,
        fwd.map((x, i) => x - p.fwd[i]),
      );
      const key = bearing.join();
      if (bearing.length === 1 && key === stance) {
        const i = bearing[0];
        acc = [acc[0] + ft[i][0] - p.ft[i][0], acc[1] + ft[i][2] - p.ft[i][2]];
        worst = Math.max(worst, Math.hypot(...acc));
      } else {
        if (bearing.length === 1) phases++;
        acc = [0, 0];
      }
      stance = key;
    }
    prev = { ft, fwd, flip: w.flip };
  }
  return { worst, phases };
}

/** Hông dịch nhiều nhất giữa hai bước `1/120 s` liền nhau — không có cú nhảy */
function maxHipStep(rt: SceneRuntime, id: string) {
  let worst = 0;
  let last: number[] | undefined;
  for (let t = 0; t <= rt.duration + 1e-9; t += 1 / 120) {
    const hip = sceneAt(rt, id, t, h, dims).world!.hip;
    if (last)
      worst = Math.max(worst, Math.hypot(hip[0] - last[0], hip[1] - last[1], hip[2] - last[2]));
    last = hip;
  }
  return worst;
}

const walker = (path: Key[], clips: unknown[] = [{ action: "walk", start: 0 }]) => ({
  id: "a",
  tracks: clips.length ? [{ clips }] : [],
  world: { path },
});

describe("người 3D: kết hợp không hợp lệ là lỗi lúc nạp", () => {
  const load = (raw: object) => {
    const r = parseScene(raw);
    if (!r.success) throw new Error(r.error.message);
    return () => resolveScene(r.data, ACTIONS);
  };
  const person = { id: "a", tracks: [], world: { at: [0, 0, 900] } };

  it("`world` mà cảnh thiếu `lens`", () => {
    expect(load({ cast: [person] })).toThrow("`lens`");
  });

  it("`world` cùng `path` 2D", () => {
    expect(load({ lens: LENS, cast: [{ ...person, path: [{ t: 0, x: 0 }] }] })).toThrow(
      "`world.path`",
    );
  });

  it("đạo cụ `follow` người 3D", () => {
    expect(
      load({ lens: LENS, cast: [person], props: [{ id: "p", prop: "x.json", follow: "a" }] }),
    ).toThrow("`equip`");
  });
});

describe("người 3D đi theo `path`: chân trụ đứng yên trên sàn", () => {
  it("đi thẳng: chân trụ không trượt, tới đúng mốc cuối", () => {
    const rt = scene(
      [
        walker(
          [
            { t: 0, at: [-300, 0, 900], yaw: 0 },
            { t: 3, at: [300, 0, 900], yaw: 0 },
          ],
          [{ action: "walk", start: 0 }, { start: 2.9 }],
        ),
      ],
      4,
    );
    const { worst, phases } = stanceSlip(rt, "a");
    expect(phases).toBeGreaterThan(3);
    expect(worst).toBeLessThan(1);
    const end = sceneAt(rt, "a", 4, h, dims).world!.hip;
    expect(Math.hypot(end[0] - 300, end[2] - 900)).toBeLessThan(0.08 * actionStride(ACTIONS.walk));
    expect(maxHipStep(rt, "a")).toBeLessThan(5);
    expect(sceneSlideProblems(rt)).toStrictEqual([]);
  });

  it("nhịp chân co giãn theo `path`: đi nhanh hơn nhịp khai vẫn không trượt", () => {
    const rt = scene(
      [
        walker([
          { t: 0, at: [-300, 0, 900], yaw: 0 },
          { t: 2, at: [300, 0, 900], yaw: 0 },
        ]),
      ],
      2,
    );
    expect(stanceSlip(rt, "a").worst).toBeLessThan(1);
    const at2 = sceneAt(rt, "a", 2, h, dims).world!.hip;
    expect(Math.abs(at2[0] - 300)).toBeLessThan(40);
  });

  it("tiếng bước theo nhịp chân đã co giãn", () => {
    const run = (dur: number) =>
      scene(
        [
          walker([
            { t: 0, at: [-300, 0, 900], yaw: 0 },
            { t: dur, at: [300, 0, 900], yaw: 0 },
          ]),
        ],
        dur,
      );
    const slow = sceneEvents(run(4), "step").length;
    const fast = sceneEvents(run(2), "step").length;
    // cùng quãng đường thì cùng số bước, dù thời gian gấp đôi
    expect(Math.abs(slow - fast)).toBeLessThanOrEqual(1);
    expect(fast).toBeGreaterThan(3);
  });

  it("quay tại chỗ qua chính diện: lớp tay khai đi theo đúng cánh tay đã đổi kênh", () => {
    const path: Key[] = [
      { t: 0, at: [0, 0, 900], yaw: 45 },
      { t: 3, at: [0, 0, 900], yaw: 135 },
    ];
    const rt = scene([walker(path, [{ action: "raise", start: 0 }])], 3);
    const sides = new Set<string>();
    for (let t = 0; t <= 3; t += 0.1) {
      const s = sceneAt(rt, "a", t, h, dims);
      const raised = s.pose.an[0] === 150 ? "armNear" : "armFar";
      sides.add(raised);
      expect(s.layers[raised]).toBe("front");
    }
    expect(sides).toEqual(new Set(["armNear", "armFar"]));
  });

  it("clip `hold` vào giữa pha: sự kiện nằm trước pha đầu không phát, như người đứng ở `at`", () => {
    const path: Key[] = [
      { t: 0, at: [-300, 0, 900], yaw: 0 },
      { t: 2, at: [300, 0, 900], yaw: 0 },
    ];
    const clips = [{ action: "walkHold", start: 0, phase: 0.65 }];
    const walking = sceneEvents(scene([walker(path, clips)], 2), "step");
    const still = sceneEvents(
      scene([{ id: "a", tracks: [{ clips }], world: { at: path[0].at, yaw: 0 } }], 2),
      "step",
    );
    expect(still).toHaveLength(1);
    expect(walking).toHaveLength(1);
  });

  it("đi cong và quay một vòng ba phần tư — qua chính diện và qua quay lưng — không trượt", () => {
    const path = arc(0, 900, 220, -90, 180, 4.5);
    const rt = scene([walker(path)], 4.5);
    const { worst, phases } = stanceSlip(rt, "a");
    expect(phases).toBeGreaterThan(5);
    expect(worst).toBeLessThan(1);
    // hông bám đường vòng: không lạc quá nửa bán kính
    for (const k of path) {
      const hip = sceneAt(rt, "a", k.t, h, dims).world!.hip;
      expect(Math.hypot(hip[0] - k.at[0], hip[2] - k.at[2])).toBeLessThan(110);
    }
    expect(maxHipStep(rt, "a")).toBeLessThan(8);
    expect(sceneSlideProblems(rt).filter((p) => p.includes("trượt"))).toStrictEqual([]);
  });

  it("đi tới rồi ngồi: hông đúng mặt ngồi, chuyển đi ↔ đứng ↔ ngồi không giật", () => {
    const rt = scene(
      [
        walker(
          [
            { t: 0, at: [-300, 0, 900], yaw: 0 },
            { t: 2, at: [0, 0, 900], yaw: 0 },
            { t: 2.4, at: [0, 0, 900], yaw: 270 },
            { t: 3.2, at: [0, -95, 850], yaw: 270, sit: true },
          ],
          [
            { action: "walk", start: 0 },
            { start: 1.95, blend: 0.4 },
            { action: "sit", start: 2.4 },
          ],
        ),
      ],
      3.5,
    );
    const hip = sceneAt(rt, "a", 3.5, h, dims).world!.hip;
    expect(hip[0]).toBeCloseTo(0, 6);
    expect(hip[2]).toBeCloseTo(850, 6);
    expect(hip[1]).toBeCloseTo(-95 - dims.legHalf, 6);
    expect(maxHipStep(rt, "a")).toBeLessThan(5);
    expect(sceneSlideProblems(rt)).toStrictEqual([]);
  });
});

describe("hoà đi → đứng và quay tại chỗ: bàn chân liền, không xuống dưới sàn", () => {
  it("bàn chân không dưới sàn, không nhảy giữa hai bước liền khi hoà và khi quay lưng qua ống kính", () => {
    const rt = scene(
      [
        walker(
          [
            { t: 0, at: [-300, 0, 900], yaw: 0 },
            { t: 2, at: [0, 0, 900], yaw: 0 },
            { t: 2.3, at: [0, 0, 900], yaw: 270 },
            { t: 2.6, at: [0, 0, 900], yaw: 180 },
          ],
          [
            { action: "walk", start: 0 },
            { action: "idle", start: 1.95, blend: 0.4 },
          ],
        ),
      ],
      3,
    );
    let prev: number[][] | undefined;
    let jump = 0;
    let deepest = -Infinity;
    for (let t = 1.5; t <= 3 + 1e-9; t += 1 / 120) {
      const s = sceneAt(rt, "a", t, h, dims);
      const ft = feet3(s.pose, s.world!, h, dims.hipHalf);
      deepest = Math.max(deepest, ...ft.map((p) => p[1]));
      if (prev) {
        const p = prev;
        for (const f of ft)
          jump = Math.max(
            jump,
            Math.min(...p.map((q) => Math.hypot(f[0] - q[0], f[1] - q[1], f[2] - q[2]))),
          );
      }
      prev = ft;
    }
    expect(deepest).toBeLessThan(0.5);
    // Chân vung lúc hoà sang đứng đã đi ~7,7 mỗi 1/120 s; cú nhảy khi lật qua lưng là cỡ 15
    expect(jump).toBeLessThan(8);
  });
});

describe("quay tại chỗ bằng bước chân", () => {
  const turn = (y1: number, t1 = 1.3, steps?: number) =>
    scene(
      [
        walker(
          [
            { t: 0.5, at: [0, 0, 900], yaw: 0 },
            { t: t1, at: [0, 0, 900], yaw: y1, steps },
          ],
          [{ action: "idle", start: 0 }],
        ),
      ],
      t1 + 0.7,
    );
  const at = (rt: SceneRuntime, t: number) => {
    const s = sceneAt(rt, "a", t, h, dims);
    return feet3(s.pose, s.world!, h, dims.hipHalf);
  };
  const moved = (p: number[], q: number[]) => Math.hypot(p[0] - q[0], p[2] - q[2]);

  /**
   * Hai bàn chân bám theo từng chân thật từ `0,5 s` (thứ tự lúc ấy: xa, gần) — lật qua chính diện
   * hay quay lưng đổi thứ tự của `feet3`: chỗ đầu, chỗ cuối và độ nhấc cao nhất (y âm là lên) trong `[t0, t1]`
   */
  const track = (rt: SceneRuntime, t0: number, t1: number) => {
    let cur = at(rt, 0.5);
    const out = cur.map((p) => ({ from: p, to: p, top: p[1] }));
    for (let t = 0.5; t <= t1 + 1e-9; t += 1 / 120) {
      const [p, q] = at(rt, t);
      const d = (x: number[], y: number[]) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
      cur = d(p, cur[0]) + d(q, cur[1]) <= d(q, cur[0]) + d(p, cur[1]) ? [p, q] : [q, p];
      cur.forEach((f, i) => {
        if (t < t0 - 1e-9) out[i].from = f;
        else out[i].top = Math.min(out[i].top, f[1]);
        out[i].to = f;
      });
    }
    return out;
  };

  it("mỗi nhịp một chân bước: chân phía quay nhấc lên, chân kia xoay trên sàn tới chỗ mới", () => {
    // ống kính ở gốc, người ở +z nhìn +x: chân gần (thứ hai) là chân phải; quay phải là `yaw` tăng
    const rt = turn(90);
    const [left, right] = track(rt, 0.5, 1.3);
    expect(right.top).toBeLessThan(-8);
    expect(left.top).toBeGreaterThan(-0.5);
    expect(moved(right.from, right.to)).toBeGreaterThan(15);
    expect(moved(left.from, left.to)).toBeGreaterThan(15);
    const end = sceneAt(rt, "a", 1.3, h, dims);
    expect(end.world!.yaw / D).toBeCloseTo(90, 5);
    expect(sceneSlideProblems(rt)).toStrictEqual([]);
    expect(sceneTurnProblems(rt)).toStrictEqual([]);
  });

  it("quay trái thì chân trái dẫn; quay nửa vòng là hai nhịp, nhịp sau đổi chân", () => {
    const rt = turn(-180, 2.1);
    // nhịp đầu chân trái bước, chân phải xoay trên sàn; nhịp sau ngược lại
    const [left1, right1] = track(rt, 0.5, 1.3);
    const [left2, right2] = track(rt, 1.3, 2.1);
    expect(left1.top).toBeLessThan(-8);
    expect(right1.top).toBeGreaterThan(-0.5);
    expect(right2.top).toBeLessThan(-8);
    expect(left2.top).toBeGreaterThan(-0.5);
    for (const f of [left1, right1, left2, right2]) expect(moved(f.from, f.to)).toBeGreaterThan(15);
    // giữa hai nhịp cả hai chân đứng trên sàn, thân đã quay nửa đường
    expect(Math.min(left1.to[1], right1.to[1])).toBeGreaterThan(-0.5);
    expect(sceneAt(rt, "a", 1.3, h, dims).world!.yaw / D).toBeCloseTo(-90, 5);
    expect(sceneSlideProblems(rt)).toStrictEqual([]);
    expect(sceneTurnProblems(rt)).toStrictEqual([]);
  });

  it("quay ít hơn ngưỡng thì không bước", () => {
    const rt = turn(10);
    expect(Math.min(...at(rt, 0.9).map((p) => p[1]))).toBeGreaterThan(-0.5);
  });

  it("`steps` khai số nhịp: 90° trong hai nhịp, phải rồi trái", () => {
    const rt = turn(90, 2.1, 2);
    const [left1, right1] = track(rt, 0.5, 1.3);
    const [left2, right2] = track(rt, 1.3, 2.1);
    expect(right1.top).toBeLessThan(-8);
    expect(left1.top).toBeGreaterThan(-0.5);
    expect(left2.top).toBeLessThan(-8);
    expect(right2.top).toBeGreaterThan(-0.5);
    expect(sceneAt(rt, "a", 1.3, h, dims).world!.yaw / D).toBeCloseTo(45, 5);
    expect(sceneSlideProblems(rt)).toStrictEqual([]);
    expect(sceneTurnProblems(rt)).toStrictEqual([]);
  });

  it("`steps` khai thì bước cả khi quay dưới ngưỡng", () => {
    const [left, right] = track(turn(10, 1.3, 1), 0.5, 1.3);
    expect(right.top).toBeLessThan(-8);
    expect(left.top).toBeGreaterThan(-0.5);
  });

  it("`steps` ít tới mức một nhịp quá 90° thì `check` kêu", () => {
    const bad = sceneTurnProblems(turn(180, 2.1, 1));
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatch(/^`a` giây 0\.50–2\.10: quay tại chỗ 180° trong 1 nhịp, mỗi nhịp 180°/);
    expect(bad[0]).toContain("tăng `steps` lên 2");
  });
});

describe("sceneSlideProblems cho người 3D đo trên sàn thế giới", () => {
  it("`path` dời người mà chân không bước là trượt", () => {
    const rt = scene(
      [
        walker(
          [
            { t: 0, at: [-300, 0, 900], yaw: 0 },
            { t: 2, at: [300, 0, 900], yaw: 0 },
          ],
          [],
        ),
      ],
      2,
    );
    const bad = sceneSlideProblems(rt);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatch(/^`a` giây 0\.00–0\.40: chân trụ trượt \d+ đơn vị trên sàn/);
  });

  it("đứng một chỗ (`world.at`) mà chân bước là trượt", () => {
    const rt = scene(
      [
        {
          id: "a",
          tracks: [{ clips: [{ action: "walk", start: 0 }] }],
          world: { at: [0, 0, 900], yaw: 0 },
        },
      ],
      2,
    );
    expect(sceneSlideProblems(rt)[0]).toMatch(/`a` giây .*chân bước mà người đứng một chỗ/);
  });

  it("quãng quá xa cho thời gian ấy: mốc dừng không tới thì kêu, chân vẫn không trượt", () => {
    const rt = scene(
      [
        walker(
          [
            { t: 0, at: [-400, 0, 900], yaw: 0 },
            { t: 1, at: [400, 0, 900], yaw: 0 },
          ],
          [
            { action: "walk", start: 0 },
            { start: 1, blend: 0.3 },
          ],
        ),
      ],
      2,
    );
    expect(stanceSlip(rt, "a").worst).toBeLessThan(1);
    const bad = sceneSlideProblems(rt);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatch(/^`a`: mốc dừng `world.path` giây 1 — hông cách `at` \d+ đơn vị/);
  });

  it("clip đi còn chạy khi `path` đã dừng thì kêu chân đứng sững", () => {
    const rt = scene(
      [
        walker([
          { t: 0, at: [-200, 0, 900], yaw: 0 },
          { t: 1.5, at: [100, 0, 900], yaw: 0 },
        ]),
      ],
      3,
    );
    expect(sceneSlideProblems(rt).some((p) => p.includes("chân đứng sững"))).toBe(true);
  });
});

describe("sceneTurnProblems", () => {
  const stand = (yaws: [number, number][]) =>
    scene(
      [
        {
          id: "a",
          tracks: [],
          world: { path: yaws.map(([t, yaw]) => ({ t, at: [0, 0, 900], yaw })) },
        },
      ],
      2,
    );

  it("quay nhanh quá ngưỡng là một dòng cho cả quãng", () => {
    const out = sceneTurnProblems(
      stand([
        [0, 0],
        [1, 0],
        [1.05, 90],
      ]),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/^`a` giây 1\.0\d–1\.1\d: thân quay 720°\/s/);
  });

  it("quay đi rồi quay lại trong chốc lát", () => {
    const out = sceneTurnProblems(
      stand([
        [0, 0],
        [0.5, 0],
        [0.9, 30],
        [1.3, 0],
      ]),
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatch(/^`a` giây 0\.5\d–1\.\d\d: thân quay 30° rồi quay lại/);
  });

  it("quay chậm một chiều thì không kêu, kể cả khi quay qua chính diện", () => {
    // ống kính ở gốc, người ở +z: yaw 90 là nhìn thẳng ống kính
    const away = stand([
      [0, 0],
      [2, -120],
    ]);
    expect(sceneTurnProblems(away)).toStrictEqual([]);
    const across = sceneTurnProblems(
      stand([
        [0, 0],
        [2, 120],
      ]),
    );
    expect(across).toStrictEqual([]);
  });

  it("hông trượt quá mốc dừng thì thân không quay lại nhìn chỗ sau lưng", () => {
    // clip đi còn chạy 0,4 s sau mốc dừng: chân đưa hông vượt mốc, chỗ cần nhìn tới ở sau lưng
    const rt = scene(
      [
        {
          id: "a",
          tracks: [
            {
              clips: [
                { action: "walk", start: 0 },
                { action: "idle", start: 1.4, blend: 0.3 },
              ],
            },
          ],
          world: {
            path: [
              { t: 0, at: [-200, 0, 900], yaw: 0 },
              { t: 1, at: [0, 0, 900], yaw: 0, ease: true },
            ],
          },
        },
      ],
      3,
    );
    let worst = 0;
    for (let t = 1; t <= 3; t += 1 / 60)
      worst = Math.max(worst, Math.abs(sceneAt(rt, "a", t, h, dims).world!.yaw / D));
    expect(worst).toBeLessThan(10);
    expect(sceneTurnProblems(rt)).toStrictEqual([]);
  });
});

describe("worldFacingAt", () => {
  it("trả yaw khai và hướng nhắm tới; sceneAt vẽ đúng yaw khai, kể cả nhìn thẳng ống kính", () => {
    // mắt ở gốc, người ở +z: hướng về ống kính là −z, tức yaw 90
    const rt = scene(
      [
        { id: "a", tracks: [], world: { at: [0, 0, 900], yaw: 95 } },
        { id: "b", tracks: [], world: { at: [0, 0, 900], yaw: 90 } },
        { id: "c", tracks: [] },
      ],
      2,
    );
    const a = worldFacingAt(rt, "a", 1, h, dims)!;
    expect(a.said).toBe(95);
    expect(a.yaw).toBe(95);
    const wa = sceneAt(rt, "a", 1, h, dims).world!;
    expect(wa.yaw / D).toBeCloseTo(95, 6);
    expect(wa.theta).toBeCloseTo(5, 6);
    const wb = sceneAt(rt, "b", 1, h, dims).world!;
    expect(wb.yaw / D).toBeCloseTo(90, 6);
    expect(wb.theta).toBeCloseTo(0, 4);
    expect(worldFacingAt(rt, "c", 1, h, dims)).toBeUndefined();
  });
});

describe("bảng `travel` chỉ nướng cho người trôi theo chân", () => {
  const walking = { tracks: [{ clips: [{ start: 0, action: "walk" }] }] };
  const rt = scene(
    [
      { id: "flat", ...walking },
      {
        id: "path",
        ...walking,
        path: [
          { t: 0, x: 0 },
          { t: 2, x: 300 },
        ],
      },
      { id: "world", ...walking, world: { at: [0, 0, 900] } },
    ],
    2,
  );
  const table = (id: string) => rt.cast.find((m) => m.id === id)!.travel;

  it("người 3D và người đi `path` không nướng", () => {
    expect(table("world").xs).toStrictEqual([0]);
    expect(table("path").xs).toStrictEqual([0]);
  });

  it("người 2D vẫn nướng từ tư thế từng khung", () => {
    const tb = table("flat");
    expect(tb).toStrictEqual(bakeTravel((t) => sceneAt(rt, "flat", t).pose, rt.duration));
    expect(Math.abs(tb.xs[tb.xs.length - 1])).toBeGreaterThan(0.1);
  });
});

describe('hành động `sides: "anatomical"`', () => {
  const reachNear = (sides?: "anatomical") =>
    action({
      name: "hip",
      duration: 1,
      end: "hold",
      authoredAt: "side",
      ...(sides && { sides }),
      mask: ["armNear"],
      keys: [{ t: 0, pose: {}, reach: { armNear: { at: [0.1, -0.5, 0.3] } } }],
    });
  const run = (yaw: number, sides?: "anatomical") => {
    const r = parseScene({
      lens: LENS,
      duration: 1,
      cast: [
        {
          id: "a",
          world: { at: [0, 0, 500], yaw },
          tracks: [{ clips: [{ action: "hip", start: 0 }] }],
        },
      ],
    });
    if (!r.success) throw new Error(r.error.message);
    const rt = resolveScene(r.data, { ...ACTIONS, hip: reachNear(sides) });
    return { rt, pose: sceneAt(rt, "a", 0.5, h, dims).pose };
  };

  it("kênh gần là tay phải: tay phải ở phía xa ống kính thì clip đổi sang kênh xa", () => {
    for (const yaw of [90, 270]) {
      const { rt, pose } = run(yaw, "anatomical");
      const far = rt.cast[0].rightFar === true;
      expect(Object.keys(pose.reach ?? {})).toEqual([far ? "af" : "an"]);
    }
    expect([90, 270].map((y) => run(y, "anatomical").rt.cast[0].rightFar === true)).toContain(true);
  });

  it("bỏ trống `sides` thì vẫn theo gần / xa ống kính", () => {
    for (const yaw of [90, 270]) expect(Object.keys(run(yaw).pose.reach ?? {})).toEqual(["an"]);
  });
});
