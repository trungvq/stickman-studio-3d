import { describe, expect, it } from "vitest";

import { parseAction, type ActionData } from "./index";
import { D } from "./index";
import { body3, dirOf, feet3 } from "./index";
import { feet } from "./index";
import { defaultCharacter, lengths } from "./index";
import {
  actionStride,
  parseScene,
  resolveScene,
  sceneAt,
  sceneEvents,
  sceneLaunchProblems,
  sceneStopProblems,
  sceneTurnProblems,
  sceneSlideProblems,
  worldFacingAt,
  type ScenePose,
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

/** Các khung `k / fps` (`k` nguyên) trong `[t0, t1]`: thời điểm khung thật, không cộng dồn `1 / fps` */
function frames(t0: number, t1: number, fps: number): number[] {
  const out: number[] = [];
  for (let k = Math.ceil(t0 * fps - 1e-6); k <= Math.floor(t1 * fps + 1e-6); k++) out.push(k / fps);
  return out;
}

/** Bước dời cao độ hông (`hip[1]`) lớn nhất giữa hai khung `1/60 s` liền trong `[t0, t1]` */
function hipRise(rt: SceneRuntime, t0: number, t1: number) {
  let worst = 0;
  let last: number | undefined;
  for (const t of frames(t0, t1, 60)) {
    const y = sceneAt(rt, "a", t, h, dims).world!.hip[1];
    if (last !== undefined) worst = Math.max(worst, Math.abs(y - last));
    last = y;
  }
  return worst;
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
  for (const t of frames(from, to, 120)) {
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
  for (const t of frames(0, rt.duration, 120)) {
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
    for (const t of frames(0, 3, 10)) {
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
    for (const t of frames(1.5, 3, 120)) {
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
    for (const t of frames(0.5, t1, 120)) {
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
    for (const t of frames(1, 3, 60))
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

describe("quay tại chỗ rồi đi: nhịp cuối của cú quay là bước đầu của chu kỳ đi", () => {
  const PATH = (end = 2.8): Key[] => [
    { t: 0.4, at: [0, 0, 900], yaw: 0 },
    { t: 1.4, at: [0, 0, 900], yaw: 160, steps: 2 },
    { t: end, at: [-282, 0, 797], yaw: 160 },
  ];
  const go = (start: number) =>
    scene(
      [
        walker(PATH(), [
          { action: "idle", start: 0 },
          { action: "walk", start },
          { action: "idle", start: 2.7, blend: 0.3 },
        ]),
      ],
      3.4,
    );
  /** Tốc độ hông trên sàn mỗi khung `1/60 s` trong `[t0, t1]` */
  const speeds = (rt: SceneRuntime, t0: number, t1: number) => {
    const out: number[] = [];
    let last: number[] | undefined;
    for (const t of frames(t0, t1, 60)) {
      const hip = sceneAt(rt, "a", t, h, dims).world!.hip;
      if (last) out.push(Math.hypot(hip[0] - last[0], hip[2] - last[2]) * 60);
      last = hip;
    }
    return out;
  };
  const travel = 300 / 1.4;

  it.each([1.4, 1.2])(
    "clip đi bắt đầu ở giây %s: hông khởi hành liền, không vọt quá tốc độ hành trình",
    (start) => {
      const rt = go(start);
      const v = speeds(rt, 0.4, 2.4);
      expect(Math.max(...v)).toBeLessThan(1.15 * travel);
      // đã rời chỗ thì không khung nào đứng lại rồi nhảy, tăng tốc không quá ~2 m/s²
      const moving = v.findIndex((x) => x > 1);
      for (let i = moving + 1; i < v.length; i++) {
        expect(v[i]).toBeGreaterThan(1);
        expect((v[i] - v[i - 1]) * 60).toBeLessThan(600);
      }
      // hông rời mốc trong nhịp cuối, trước mốc cuối của cú quay
      expect(speeds(rt, 1.3, 1.4)[0]).toBeGreaterThan(20);
      expect(sceneLaunchProblems(rt)).toStrictEqual([]);
      expect(sceneSlideProblems(rt)).toStrictEqual([]);
      expect(sceneTurnProblems(rt)).toStrictEqual([]);
    },
  );

  it("chân bước của nhịp cuối là chân chạm đất đầu tiên của clip đi: đứng trụ, chân xoay nhấc trước", () => {
    const rt = go(1.4);
    const at = (t: number) => {
      const s = sceneAt(rt, "a", t, h, dims);
      return feet3(s.pose, s.world!, h, dims.hipHalf);
    };
    // bám từng bàn chân thật qua các lần lật
    let cur = at(0.9);
    const path: number[][][] = [[], []];
    for (let t = 0.9; t <= 2 + 1e-9; t += 1 / 120) {
      const [p, q] = at(t);
      const d = (x: number[], y: number[]) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
      cur = d(p, cur[0]) + d(q, cur[1]) <= d(q, cur[0]) + d(p, cur[1]) ? [p, q] : [q, p];
      cur.forEach((f, i) => path[i].push([t, ...f]));
    }
    const top = (i: number, a: number, b: number) =>
      Math.min(...path[i].filter(([t]) => t >= a && t <= b).map((f) => f[2]));
    // nhịp cuối (0,9 → 1,4): một chân nhấc — chân bước —, chân kia xoay trên sàn tới lúc chân bước
    // đặt xuống (1,325), rồi kiễng gót bắt đầu bước đầu của clip đi
    const lead = top(0, 0.9, 1.4) < top(1, 0.9, 1.4) ? 0 : 1;
    const pivot = 1 - lead;
    expect(top(lead, 0.9, 1.4)).toBeLessThan(-8);
    expect(top(pivot, 0.9, 1.325)).toBeGreaterThan(-0.5);
    // chân bước đã đặt xuống sàn trước lúc ấy
    const high = path[lead].findIndex(([, , y]) => y < -8);
    const down = path[lead].slice(high).find(([, , y]) => y > -0.5);
    expect(down?.[0] ?? Infinity).toBeLessThan(1.325);
    // sau mốc: chân xoay nhấc lên trước, chân bước đứng trụ
    const lift = (i: number) => path[i].find(([t, , y]) => t > 1.42 && y < -2)?.[0] ?? Infinity;
    expect(lift(pivot)).toBeLessThan(lift(lead));
    // bàn chân trụ không trượt từ lúc đặt xuống tới lúc nhấc
    const planted = path[lead].filter(([t]) => t >= 1.42 && t < lift(lead));
    const [, x0, , z0] = planted[0];
    for (const [, x, , z] of planted) expect(Math.hypot(x - x0, z - z0)).toBeLessThan(1);
    // chân bước đặt xuống phía trước theo hướng mới, khoảng một bước của clip đi
    const F = dirOf(160 * D);
    const hip = sceneAt(rt, "a", 1.4, h, dims).world!.hip;
    expect((x0 - hip[0]) * F[0] + (z0 - hip[2]) * F[2]).toBeGreaterThan(40);
    expect(stanceSlip(rt, "a", 1.42, 2.4).worst).toBeLessThan(3);
  });

  it("clip đi bắt đầu sau mốc cuối của cú quay: không ghép, người đứng ở mốc tới khi clip bắt đầu, `check` kêu cú khởi hành", () => {
    const rt = scene(
      [
        walker(PATH(), [
          { action: "idle", start: 0 },
          { action: "walk", start: 1.6 },
          { action: "idle", start: 2.6, blend: 0.3 },
        ]),
      ],
      3.4,
    );
    const bad = sceneLaunchProblems(rt);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatch(/^`a` giây 1\.\d\d–1\.\d\d: hông khởi hành vọt lên \d+ đơn vị\/s/);
    expect(bad[0]).toContain("nhịp cuối của cú quay");
  });

  it.each([
    [0, 110],
    [0, 115],
    [40, 205],
  ])(
    "cú quay %s° → %s°, lệch hướng quãng đi 45–50°: cú quay bẻ tới hướng đi, hông bám `path`",
    (yaw0, yaw) => {
      const keys = PATH();
      keys[0] = { ...keys[0], yaw: yaw0 };
      keys[1] = { ...keys[1], yaw };
      const rt = scene(
        [
          walker(keys, [
            { action: "idle", start: 0 },
            { action: "walk", start: 1.4 },
            { action: "idle", start: 2.7, blend: 0.3 },
          ]),
        ],
        3.4,
      );
      // khoảng cách ngang tới đường `path` của quãng đi
      const [dx, dz] = [-282, -103];
      const L = Math.hypot(dx, dz);
      let off = 0;
      for (const t of frames(1.4, 3.4, 60)) {
        const hip = sceneAt(rt, "a", t, h, dims).world!.hip;
        off = Math.max(off, Math.abs((hip[0] * dz - (hip[2] - 900) * dx) / L));
      }
      expect(off).toBeLessThan(1);
      const end = sceneAt(rt, "a", 3.4, h, dims).world!.hip;
      expect(Math.hypot(end[0] + 282, end[2] - 797)).toBeLessThan(3);
      expect(sceneAt(rt, "a", 1.4, h, dims).world!.yaw / D).toBeCloseTo(160, 0);
      expect(Math.max(...speeds(rt, 0.4, 3.4))).toBeLessThan(1.15 * travel);
      expect(stanceSlip(rt, "a", 1.42, 3.4).worst).toBeLessThan(3);
      expect(sceneLaunchProblems(rt)).toStrictEqual([]);
      expect(sceneSlideProblems(rt)).toStrictEqual([]);
      expect(sceneStopProblems(rt)).toStrictEqual([]);
      expect(sceneTurnProblems(rt)).toStrictEqual([]);
    },
  );

  it("quay rồi đi rồi dừng, ngay sau mốc dừng là cú quay: dừng đúng mốc, khép chân rồi mới quay", () => {
    const rt = scene(
      [
        walker(
          [...PATH(), { t: 3.6, at: [-282, 0, 797], yaw: 250 }],
          [
            { action: "idle", start: 0 },
            { action: "walk", start: 1.4 },
            { action: "idle", start: 2.7, blend: 0.3 },
          ],
        ),
      ],
      4.2,
    );
    const hips: number[][] = [];
    for (const t of frames(2, 4.2, 60)) hips.push(sceneAt(rt, "a", t, h, dims).world!.hip);
    // dọc hướng đi không vượt mốc, rồi đứng đúng mốc
    const F = [-282 / Math.hypot(282, 103), -103 / Math.hypot(282, 103)];
    for (const p of hips) expect((p[0] + 282) * F[0] + (p[2] - 797) * F[1]).toBeLessThan(1);
    const end = hips[hips.length - 1];
    expect(Math.hypot(end[0] + 282, end[2] - 797)).toBeLessThan(3);
    expect(Math.max(...speeds(rt, 2, 4.2))).toBeLessThan(1.15 * travel);
    expect(sceneAt(rt, "a", 2.9, h, dims).world!.yaw / D).toBeCloseTo(160, 0);
    expect(sceneAt(rt, "a", 3.6, h, dims).world!.yaw / D).toBeCloseTo(250, 0);
    expect(stanceSlip(rt, "a", 1.42, 3).worst).toBeLessThan(3);
    expect(sceneStopProblems(rt)).toStrictEqual([]);
    expect(sceneSlideProblems(rt)).toStrictEqual([]);
    expect(sceneTurnProblems(rt)).toStrictEqual([]);
    expect(sceneLaunchProblems(rt)).toStrictEqual([]);
  });

  it("clip đi trước còn hoà ra lúc cú quay bắt đầu: không ghép, `check` nói clip ấy phải hết trước", () => {
    const rt = scene(
      [
        walker(
          [
            { t: 0, at: [300, 0, 900], yaw: 180 },
            { t: 1.4, at: [0, 0, 900], yaw: 180 },
            { t: 2.4, at: [0, 0, 900], yaw: 340, steps: 2 },
            { t: 3.8, at: [282, 0, 1003], yaw: 340 },
          ],
          [
            { action: "walk", start: 0 },
            { action: "idle", start: 1.3, blend: 0.3 },
            { action: "walk", start: 2.4 },
            { action: "idle", start: 3.7, blend: 0.3 },
          ],
        ),
      ],
      4.4,
    );
    const bad = sceneLaunchProblems(rt);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toContain("clip đi trước phải hết trước mốc đầu của cú quay");
  });

  /** Tốc quay lớn nhất của thân (độ/giây) mỗi khung `1/60 s` trong `[t0, t1]` */
  const turnRate = (rt: SceneRuntime, t0: number, t1: number) => {
    let top = 0;
    let last: number | undefined;
    for (const t of frames(t0, t1, 60)) {
      const y = sceneAt(rt, "a", t, h, dims).world!.yaw / D;
      if (last !== undefined) top = Math.max(top, Math.abs(y - last) * 60);
      last = y;
    }
    return top;
  };
  const turnWalk = (yaw: number, t1: number, steps: number, clips = true) => {
    const keys = PATH();
    keys[1] = { ...keys[1], t: t1, yaw, steps };
    return scene(
      [
        walker(
          clips ? keys : keys.slice(0, 2),
          clips
            ? [
                { action: "idle", start: 0 },
                { action: "walk", start: t1 },
                { action: "idle", start: 2.7, blend: 0.3 },
              ]
            : [{ action: "idle", start: 0 }],
        ),
      ],
      3.4,
    );
  };

  it("cú quay khai đã nhanh hơn `300°/s`: bẻ tới hướng đi không làm nó quay nhanh hơn", () => {
    // 110° trong 0,3 s, quãng đi lệch thêm 50°
    const authored = turnRate(turnWalk(110, 0.7, 2, false), 0.4, 0.7);
    expect(authored).toBeGreaterThan(300);
    const rt = turnWalk(110, 0.7, 2);
    expect(turnRate(rt, 0.4, 0.7)).toBeLessThanOrEqual(authored + 1);
    expect(sceneAt(rt, "a", 0.7, h, dims).world!.yaw / D).toBeCloseTo(110, 0);
    const turn = sceneTurnProblems(rt);
    expect(turn.length).toBeGreaterThan(0);
    expect(turn[0]).toContain(
      "cú quay tại chỗ giây 0.40–0.70 nối đi: ở mốc cuối của cú quay đặt `yaw` 160",
    );
  });

  it("phần lệch không bẻ hết quá `10°`: `check` gợi `yaw` theo hướng quãng đi", () => {
    // một nhịp 40° trong 1 s: nhịp ấy bẻ tới 90°, còn lệch 70°
    const rt = turnWalk(40, 1.4, 1);
    const bad = sceneLaunchProblems(rt);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatch(/hông rời `path` tới|hông khởi hành vọt lên/);
    expect(bad[0]).toContain("lệch hướng quãng đi 120° (rig bẻ thêm 50°): đặt `yaw` 160");
  });

  // tư thế khi không ghép quay rồi đi: [hông x, y, z, yaw, bàn chân xa x y z, gần x y z]
  const TIMES = [0.5, 0.75, 0.9, 1.0, 1.15, 1.3, 1.4, 1.5, 1.8];
  const TURN = [
    [0, -168.6214, 900, 0.1452, 6.1001, 0, 921.7604, -8.2804, -8.017, 881.364],
    [0, -167.3464, 900, 1.0947, 17.9056, 0, 904.8425, -21.3142, -6.2645, 900.0422],
    [0, -167.3464, 900, 1.3963, 22.696, 0, 897.9775, -22.696, 0, 902.0225],
    [0, -167.3464, 900, 1.5415, 19.7907, -8.017, 895.0815, -22.4891, 0, 902.2288],
    [0, -167.3464, 900, 2.0944, -15.04, 0, 909.6538, 9.6053, -11.4457, 884.9289],
    [0, -168.6214, 900, 2.6473, -4.8546, 0, 919.8065, 2.1562, -2.1866, 877.5038],
    [0, -169.8964, 900, 2.7925, -1.9493, 0, 922.7024, 1.9493, 0, 877.2976],
  ];
  const STAND = [0, -169.8964, 900, 2.7925, -1.9493, 0, 922.7024, 1.9493, 0, 877.2976];
  const sample = (rt: SceneRuntime) =>
    TIMES.map((t) => {
      const s = sceneAt(rt, "a", t, h, dims);
      const [far, near] = feet3(s.pose, s.world!, h, dims.hipHalf);
      return [...s.world!.hip, s.world!.yaw, ...far, ...near];
    });
  const near = (got: number[][], want: number[][]) =>
    got.forEach((row, i) => row.forEach((x, j) => expect(x).toBeCloseTo(want[i][j], 3)));

  it("cảnh chỉ quay, hay clip đi bắt đầu sau mốc: tư thế khi không ghép", () => {
    near(sample(scene([walker(PATH().slice(0, 2), [{ action: "idle", start: 0 }])], 2.2)), [
      ...TURN,
      STAND,
      STAND,
    ]);
    const late = scene(
      [
        walker(PATH(), [
          { action: "idle", start: 0 },
          { action: "walk", start: 1.6 },
          { action: "idle", start: 2.6, blend: 0.3 },
        ]),
      ],
      3.4,
    );
    near(sample(late), [
      ...TURN,
      [-20.1429, -169.8964, 892.6429, 2.7925, -22.0922, 0, 915.3453, -18.1935, 0, 869.9404],
      [-76.6926, -157.7491, 871.9926, 2.7916, -155.677, -8.5594, 866.5844, -18.3958, 0, 869.8503],
    ]);
  });
});

describe("đi rồi dừng: bước cuối của chu kỳ đi là bước dừng", () => {
  const PATH: Key[] = [
    { t: 0, at: [-300, 0, 900], yaw: 0 },
    { t: 2, at: [0, 0, 900], yaw: 0 },
  ];
  const go = (end: number) =>
    scene(
      [
        walker(PATH, [
          { action: "walk", start: 0 },
          { action: "idle", start: end, blend: 0.3 },
        ]),
      ],
      3,
    );
  const travel = 300 / 2;
  const hipsOf = (rt: SceneRuntime, t0: number, t1: number) => {
    const out: number[][] = [];
    for (const t of frames(t0, t1, 60)) out.push(sceneAt(rt, "a", t, h, dims).world!.hip);
    return out;
  };

  it.each([1.5, 1.75, 2, 2.2])(
    "clip đi hết ở giây %s: hông giảm tốc đều tới đúng mốc, chân trụ không trượt",
    (end) => {
      const rt = go(end);
      const hips = hipsOf(rt, 1, 3);
      const v = hips.slice(1).map((p, i) => Math.hypot(p[0] - hips[i][0], p[2] - hips[i][2]) * 60);
      expect(Math.max(...v)).toBeLessThan(1.15 * travel);
      for (let i = 1; i < v.length; i++) expect(Math.abs(v[i] - v[i - 1]) * 60).toBeLessThan(600);
      // không vượt mốc, dừng ở mốc
      for (const p of hips) expect(p[0]).toBeLessThan(1);
      const [x, , z] = hips[hips.length - 1];
      expect(Math.hypot(x, z - 900)).toBeLessThan(3);
      expect(stanceSlip(rt, "a", 1.2, 3).worst).toBeLessThan(3);
      expect(sceneStopProblems(rt)).toStrictEqual([]);
      expect(sceneSlideProblems(rt)).toStrictEqual([]);
      expect(sceneTurnProblems(rt)).toStrictEqual([]);
    },
  );

  it("clip đi hết lúc nào trong cửa sổ cũng không đổi hông, không đổi chỗ hai bàn chân khép", () => {
    const at = (rt: SceneRuntime, t: number) => {
      const s = sceneAt(rt, "a", t, h, dims);
      return [...s.world!.hip, ...feet3(s.pose, s.world!, h, dims.hipHalf).flat()];
    };
    const ref = go(1.5);
    for (const end of [1.75, 2]) {
      const rt = go(end);
      for (const t of [1.2, 1.6, 2, 2.4])
        expect(at(rt, t).slice(0, 3)).toStrictEqual(at(ref, t).slice(0, 3));
      at(rt, 3).forEach((x, i) => expect(x).toBeCloseTo(at(ref, 3)[i], 6));
    }
    // hai bàn chân khép ở chỗ của tư thế nền quanh mốc
    const s = sceneAt(ref, "a", 3, h, dims);
    for (const f of feet3(s.pose, s.world!, h, dims.hipHalf)) {
      expect(Math.abs(f[0])).toBeLessThan(8);
      expect(Math.abs(f[1])).toBeLessThan(0.5);
    }
  });

  it("clip đi hết sớm hơn cửa sổ: tư thế khi không ghép — hông trượt theo `path`, `check` kêu hụt mốc", () => {
    const rt = go(1.2);
    // [hông x, y, z, yaw, bàn chân xa x y z, gần x y z]
    const want = [
      [-148.8531, -166.1003, 900, 0, -130.6954, -9.7659, 922, -166.3148, 0, 878],
      [-113.432, -160.7193, 900, 0, -54.3056, -2.6381, 922, -162.2902, 0, 878],
      [-91.9897, -169.8964, 900, 0, -86.0568, 0, 922, -97.9227, 0, 878],
      [-31.9897, -169.8964, 900, 0, -26.0568, 0, 922, -37.9227, 0, 878],
      [-31.9897, -169.8964, 900, 0, -26.0568, 0, 922, -37.9227, 0, 878],
      [-31.9897, -169.8964, 900, 0, -26.0568, 0, 922, -37.9227, 0, 878],
    ];
    [1, 1.3, 1.6, 2, 2.5, 3].forEach((t, i) => {
      const s = sceneAt(rt, "a", t, h, dims);
      const row = [
        ...s.world!.hip,
        s.world!.yaw,
        ...feet3(s.pose, s.world!, h, dims.hipHalf).flat(),
      ];
      row.forEach((x, j) => expect(x).toBeCloseTo(want[i][j], 3));
    });
    expect(sceneSlideProblems(rt).some((p) => p.includes("mốc dừng `world.path` giây 2"))).toBe(
      true,
    );
  });

  it("dừng rồi quay tại chỗ quá gấp ngay ở mốc: không ghép, `check` kêu dừng giật", () => {
    // 90° trong 0,3 s: phần sau cú quay không đủ quay dưới `300°/s`
    const rt = scene(
      [
        walker(
          [{ ...PATH[0] }, { t: 1, at: [0, 0, 900], yaw: 0 }, { t: 1.3, at: [0, 0, 900], yaw: 90 }],
          [
            { action: "walk", start: 0 },
            { action: "idle", start: 1, blend: 0.3 },
          ],
        ),
      ],
      3,
    );
    const bad = sceneStopProblems(rt);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatch(/^`a`: mốc dừng `world.path` giây 1 — /);
  });

  it("dừng rồi quay tại chỗ ngay ở mốc: bước khép xong rồi mới quay, dừng đúng mốc; chèn mốc đứng trước cú quay cũng êm", () => {
    const turn = (keys: Key[]) =>
      scene(
        [
          walker(keys, [
            { action: "walk", start: 0 },
            { action: "idle", start: 1, blend: 0.3 },
          ]),
        ],
        3,
      );
    const stop: Key = { t: 1, at: [0, 0, 900], yaw: 0 };
    for (const keys of [
      [{ ...PATH[0] }, stop, { t: 2.5, at: [0, 0, 900], yaw: 90 }],
      [{ ...PATH[0] }, stop, { ...stop, t: 1.4 }, { t: 2.5, at: [0, 0, 900], yaw: 90 }],
    ] as Key[][]) {
      const rt = turn(keys);
      expect(sceneStopProblems(rt)).toStrictEqual([]);
      expect(sceneSlideProblems(rt)).toStrictEqual([]);
      expect(sceneTurnProblems(rt)).toStrictEqual([]);
      for (const p of hipsOf(rt, 0.5, 3)) {
        expect(p[0]).toBeLessThan(1);
        expect(Math.abs(p[2] - 900)).toBeLessThan(1);
      }
      // thân chưa quay khi bước khép chưa xong, quay đủ ở mốc cuối
      expect(sceneAt(rt, "a", 1.1, h, dims).world!.yaw / D).toBeCloseTo(0, 3);
      expect(sceneAt(rt, "a", 2.5, h, dims).world!.yaw / D).toBeCloseTo(90, 1);
      expect(stanceSlip(rt, "a", 0.5, 1.5).worst).toBeLessThan(3);
    }
  });
});

/**
 * Các lần một bàn chân chạm sàn trong `[t0, t1]`: lúc ấy, khoảng cách hai bàn chân trên sàn, và bàn
 * chân vừa đặt xuống trượt bao xa tới khi nó nhấc lên
 */
function touchdowns(rt: SceneRuntime, t0: number, t1: number) {
  const out: { t: number; d: number; slide: number }[] = [];
  let cur: number[][] | undefined;
  const up = [false, false];
  const open: ({ at: number[]; i: number } | undefined)[] = [undefined, undefined];
  for (const t of frames(t0, t1, 120)) {
    const s = sceneAt(rt, "a", t, h, dims);
    const [p, q] = feet3(s.pose, s.world!, h, dims.hipHalf);
    const d = (x: number[], y: number[]) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
    cur = !cur || d(p, cur[0]) + d(q, cur[1]) <= d(q, cur[0]) + d(p, cur[1]) ? [p, q] : [q, p];
    const ft = cur;
    for (const i of [0, 1]) {
      const air = (s.world!.floor ?? 0) - ft[i][1] > 0.5;
      if (up[i] && !air) {
        out.push({ t, d: Math.hypot(ft[0][0] - ft[1][0], ft[0][2] - ft[1][2]), slide: 0 });
        open[i] = { at: ft[i], i: out.length - 1 };
      }
      const o = open[i];
      if (air) open[i] = undefined;
      else if (o)
        out[o.i].slide = Math.max(
          out[o.i].slide,
          Math.hypot(ft[i][0] - o.at[0], ft[i][2] - o.at[2]),
        );
      up[i] = air;
    }
  }
  return out;
}

describe("sải chân theo tốc độ hông: bước đầu và bước áp chót ngắn, thân ngả", () => {
  const LONG: Key[] = [
    { t: 0.4, at: [0, 0, 900], yaw: 0 },
    { t: 1.4, at: [0, 0, 900], yaw: 160, steps: 2 },
    { t: 4.2, at: [-564, 0, 694], yaw: 160 },
  ];
  const travel = 600 / 2.8;
  const torso = (rt: SceneRuntime, t: number) => sceneAt(rt, "a", t, h, dims).pose.torso;
  const span = (rt: SceneRuntime, t0: number, t1: number) => {
    const out: number[] = [];
    for (const t of frames(t0, t1, 60)) out.push(torso(rt, t));
    return out;
  };

  it("quay rồi đi: bước đầu dài 50–80% bước đều, bước hai gần đủ; hông tăng tốc đều, chân trụ không trượt, thân ngả trước rồi về", () => {
    const rt = scene(
      [
        walker(LONG, [
          { action: "idle", start: 0 },
          { action: "walk", start: 1.4 },
          { action: "idle", start: 4.1, blend: 0.3 },
        ]),
      ],
      5,
    );
    const td = touchdowns(rt, 0.9, 4.0).filter((e) => e.t > 1.2);
    const steady = td.filter((e) => e.t > 2.4 && e.t < 3.6).map((e) => e.d);
    const full = steady.reduce((a, b) => a + b, 0) / steady.length;
    // bước đầu: chân bước của nhịp cuối đặt xuống trước mốc cuối của cú quay
    expect(td[0].t).toBeLessThan(1.4);
    expect(td[0].d / full).toBeGreaterThan(0.5);
    expect(td[0].d / full).toBeLessThan(0.8);
    expect(td[1].d / full).toBeGreaterThan(0.85);
    for (const e of td.filter((e) => e.t < 3.6)) expect(e.slide).toBeLessThan(3);
    expect(stanceSlip(rt, "a", 1.42, 3.6).worst).toBeLessThan(3);
    // hông tăng tốc đều, không vượt tốc độ hành trình, không khung nào nhảy
    let last: number[] | undefined;
    let lv: number | undefined;
    let top = 0;
    for (const t of frames(0.4, 3.4, 60)) {
      const hip = sceneAt(rt, "a", t, h, dims).world!.hip;
      if (last) {
        const v = Math.hypot(hip[0] - last[0], hip[2] - last[2]) * 60;
        top = Math.max(top, v);
        if (lv !== undefined) expect(Math.abs(v - lv) * 60).toBeLessThan(600);
        lv = v;
      }
      last = hip;
    }
    expect(top).toBeLessThan(1.15 * travel);
    // thân ngả về trước lúc khởi hành, về dáng đi khi hông đã đủ tốc
    expect(Math.max(...span(rt, 1.1, 1.6))).toBeGreaterThan(4);
    expect(Math.max(...span(rt, 1.7, 3.4))).toBeLessThan(2.2);
    expect(sceneLaunchProblems(rt)).toStrictEqual([]);
    expect(sceneSlideProblems(rt)).toStrictEqual([]);
  });

  /** Gối chùng nhất (độ) của chân chạm sàn và hông thấp nhất trên sàn trong `[t0, t1]` */
  const legs = (rt: SceneRuntime, t0: number, t1: number) => {
    let knee = 0;
    let hip = Infinity;
    for (const t of frames(t0, t1, 120)) {
      const s = sceneAt(rt, "a", t, h, dims);
      const w = s.world!;
      const [lf, ln] = feet3(s.pose, w, h, dims.hipHalf);
      const floor = w.floor ?? 0;
      if (floor - ln[1] < 0.5) knee = Math.max(knee, Math.abs(s.pose.ln[1]));
      if (floor - lf[1] < 0.5) knee = Math.max(knee, Math.abs(s.pose.lf[1]));
      hip = Math.min(hip, floor - w.hip[1]);
    }
    return { knee, hip };
  };

  it.each([1.4, 2.8, 5])(
    "quay rồi đi quãng %s s: chân trụ ở nhịp cuối và bước đầu không chùng hơn đi đều quá 3°, hông không thấp hơn đáy đi đều",
    (dur) => {
      const rt = scene(
        [
          walker(
            [
              { t: 0.4, at: [0, 0, 900], yaw: 0 },
              { t: 1.4, at: [0, 0, 900], yaw: 160, steps: 2 },
              { t: 1.4 + dur, at: [-564, 0, 694], yaw: 160 },
            ],
            [
              { action: "idle", start: 0 },
              { action: "walk", start: 1.4 },
              { action: "idle", start: 1.3 + dur, blend: 0.3 },
            ],
          ),
        ],
        dur + 2.4,
      );
      const even = legs(rt, 1.4 + dur / 2 - 0.55, 1.4 + dur / 2 + 0.55);
      const join = legs(rt, 0.9, 2.2);
      expect(join.knee).toBeLessThan(even.knee + 3);
      expect(join.hip).toBeGreaterThan(even.hip - 0.1);
    },
  );

  it.each([
    [1400, false],
    [1500, false],
    [1560, false],
    [1400, true],
    [1500, true],
    [1560, true],
  ])(
    "quãng %s ở 290 đơn vị/s (quay trước: %s): chân trụ không trượt lúc khởi hành và lúc dừng, ở pha nào cũng vậy",
    (len, turn) => {
      const T = len / 290;
      const t0 = turn ? 1.35 : 0.5;
      const path: Key[] = [
        { t: 0, at: [0, 0, -400], yaw: turn ? 90 : 270 },
        { t: 0.5, at: [0, 0, -400], yaw: turn ? 90 : 270 },
        ...(turn ? [{ t: 1.35, at: [0, 0, -400], yaw: 270, steps: 2 } as Key] : []),
        { t: t0 + T, at: [0, 0, len - 400], yaw: 270 },
        { t: t0 + T + 1, at: [0, 0, len - 400], yaw: 270 },
      ];
      const rt = scene(
        [
          walker(path, [
            { action: "idle", start: 0 },
            { action: "walk", start: turn ? 1.35 : 0.3 },
            { action: "idle", start: t0 + T, blend: 0.3 },
          ]),
        ],
        t0 + T + 2,
      );
      const from = turn ? 1.42 : 1.2;
      for (const e of touchdowns(rt, from, t0 + T + 1.9)) expect(e.slide).toBeLessThan(3);
      expect(stanceSlip(rt, "a", from, t0 + T + 1.9).worst).toBeLessThan(3);
      expect(sceneStopProblems(rt)).toStrictEqual([]);
    },
  );

  it.each([1.75, 2])(
    "đi rồi dừng (clip đi hết ở giây %s): bước áp chót ngắn hơn bước đều, bước cuối khép chân, thân ngả ra sau rồi về",
    (end) => {
      const rt = scene(
        [
          walker(
            [
              { t: 0, at: [-500, 0, 900], yaw: 0 },
              { t: 3, at: [0, 0, 900], yaw: 0 },
            ],
            [
              { action: "walk", start: 0 },
              { action: "idle", start: end + 1, blend: 0.3 },
            ],
          ),
        ],
        4.5,
      );
      const td = touchdowns(rt, 0.3, 4.5);
      const steady = td.filter((e) => e.t > 0.8 && e.t < 2).map((e) => e.d);
      const full = steady.reduce((a, b) => a + b, 0) / steady.length;
      const [pen, last] = td.slice(-2);
      expect(last.d / full).toBeLessThan(0.4);
      expect(pen.d / full).toBeLessThan(0.85);
      for (const e of td) expect(e.slide).toBeLessThan(3);
      expect(stanceSlip(rt, "a", 0.5, 4.5).worst).toBeLessThan(3);
      expect(Math.min(...span(rt, 2.4, 3.6))).toBeLessThan(-1.5);
      expect(torso(rt, 4.5)).toBeGreaterThan(-1);
      expect(sceneStopProblems(rt)).toStrictEqual([]);
      expect(sceneSlideProblems(rt)).toStrictEqual([]);
    },
  );
});

describe("chỗ ghép quay rồi đi, dừng, dừng rồi quay: hông không tụt hay bật quá `3` trong một khung", () => {
  it.each([0.4, 0.45, 0.65])(
    "quay hai nhịp từ giây %s rồi đi: kể cả khung đúng đầu nhịp cuối",
    (a0) => {
      const b = a0 + 1;
      const rt = scene(
        [
          walker(
            [
              { t: a0, at: [0, 0, 900], yaw: 0 },
              { t: b, at: [0, 0, 900], yaw: 160, steps: 2 },
              { t: b + 1.4, at: [-282, 0, 797], yaw: 160 },
            ],
            [
              { action: "idle", start: 0 },
              { action: "walk", start: b },
              { action: "idle", start: b + 1.3, blend: 0.3 },
            ],
          ),
        ],
        b + 2,
      );
      expect(hipRise(rt, a0, b + 2)).toBeLessThan(3);
    },
  );

  it.each([
    [1, 230, 0.15],
    [0.9, 260, 0],
    [1.2, 200, 0],
  ])(
    "đi %s s, %s đơn vị/s (đứng tới giây %s) rồi dừng: chân đáp xa không kéo hông tụt",
    (dur, v, st) => {
      const t1 = st + dur;
      const from = { at: [-v * dur, 0, 900] as [number, number, number], yaw: 0 };
      const rt = scene(
        [
          walker(
            [
              { t: 0, ...from },
              ...(st ? [{ t: st, ...from }] : []),
              { t: t1, at: [0, 0, 900], yaw: 0 },
            ],
            st
              ? [
                  { action: "idle", start: 0 },
                  { action: "walk", start: st, blend: 0.2 },
                  { action: "idle", start: t1, blend: 0.3 },
                ]
              : [
                  { action: "walk", start: 0 },
                  { action: "idle", start: t1, blend: 0.3 },
                ],
          ),
        ],
        t1 + 1,
      );
      expect(hipRise(rt, t1 - 0.5, t1 + 1)).toBeLessThan(3);
      expect(sceneStopProblems(rt)).toStrictEqual([]);
    },
  );

  it("quay rồi đi `0,35 s` rồi dừng, chân trụ trước hông hơn `40%` chiều dài chân lúc vào bước dừng: gối nó không bật thẳng", () => {
    const rt = scene(
      [
        walker(
          [
            { t: 0, at: [0, 0, 900], yaw: 170 },
            { t: 1, at: [0, 0, 900], yaw: 170 },
            { t: 2, at: [0, 0, 900], yaw: 15, steps: 2 },
            { t: 2.35, at: [33, 0, 906], yaw: 15 },
          ],
          [
            { action: "idle", start: 0 },
            { action: "walk", start: 2, blend: 0.15 },
            { action: "idle", start: 2.2, blend: 0.3 },
          ],
        ),
      ],
      4,
    );
    const L = lengths(h).thigh + lengths(h).shin;
    let reach = 0;
    let knee = 0;
    let hip = 0;
    let last: { s: ScenePose; ft: number[][] } | undefined;
    for (const t of frames(1.8, 3.4, 60)) {
      const s = sceneAt(rt, "a", t, h, dims);
      const w = s.world!;
      const F = dirOf(w.yaw);
      // [xa, gần]: bàn chân gần (`ln`) chịu lực, trước hông lúc vào bước dừng
      const ft = feet3(s.pose, w, h, dims.hipHalf);
      if (t < 1.96 && Math.abs(ft[1][1]) < 0.5)
        reach = Math.max(reach, ((ft[1][0] - w.hip[0]) * F[0] + (ft[1][2] - w.hip[2]) * F[2]) / L);
      if (last) {
        // gối của chân chịu lực ở cả hai khung; chân bay gập duỗi nhanh theo clip đi
        (["lf", "ln"] as const).forEach((ch, i) => {
          if (Math.abs(ft[i][1]) < 0.5 && Math.abs(last!.ft[i][1]) < 0.5)
            knee = Math.max(knee, Math.abs(s.pose[ch][1] - last!.s.pose[ch][1]));
        });
        hip = Math.max(hip, Math.abs(w.hip[1] - last.s.world!.hip[1]));
      }
      last = { s, ft };
    }
    expect(reach).toBeGreaterThan(0.4);
    expect(knee).toBeLessThan(8);
    expect(hip).toBeLessThan(1);
  });

  it("nhịp cuối của cú quay dưới `0,12 s`: không ghép, `check` nói vì sao", () => {
    const rt = scene(
      [
        walker(
          [
            { t: 0.4, at: [0, 0, 900], yaw: 0 },
            { t: 0.5, at: [0, 0, 900], yaw: 30 },
            { t: 1.9, at: [-150, 0, 1160], yaw: 30 },
          ],
          [
            { action: "idle", start: 0 },
            { action: "walk", start: 0.47, blend: 0.15 },
            { action: "idle", start: 1.8, blend: 0.3 },
          ],
        ),
      ],
      2.6,
    );
    expect(hipRise(rt, 0.3, 1.2)).toBeLessThan(3);
    const bad = sceneLaunchProblems(rt);
    expect(bad).toHaveLength(1);
    expect(bad[0]).toContain("nhịp cuối của cú quay chỉ 0.1 s, dưới 0.12 s nên rig không ghép");
    // quay thẳng tới hướng quãng đi: `30°` khai cộng `−150°` lệch
    expect(bad[0]).toContain(
      "đặt `yaw` mốc cuối của cú quay 240 (hướng quãng đi) và giãn cú quay ra ít nhất 0.6 s",
    );
  });

  it("dừng rồi quay tại chỗ, và quay rồi đi rồi dừng rồi quay", () => {
    const stopTurn = scene(
      [
        walker(
          [
            { t: 0, at: [-300, 0, 900], yaw: 0 },
            { t: 1, at: [0, 0, 900], yaw: 0 },
            { t: 2.5, at: [0, 0, 900], yaw: 90 },
          ],
          [
            { action: "walk", start: 0 },
            { action: "idle", start: 1, blend: 0.3 },
          ],
        ),
      ],
      3,
    );
    expect(hipRise(stopTurn, 0.3, 3)).toBeLessThan(3);
    const round = scene(
      [
        walker(
          [
            { t: 0.4, at: [0, 0, 900], yaw: 0 },
            { t: 1.4, at: [0, 0, 900], yaw: 160, steps: 2 },
            { t: 2.8, at: [-282, 0, 797], yaw: 160 },
            { t: 3.6, at: [-282, 0, 797], yaw: 250 },
          ],
          [
            { action: "idle", start: 0 },
            { action: "walk", start: 1.4 },
            { action: "idle", start: 2.7, blend: 0.3 },
          ],
        ),
      ],
      4.2,
    );
    expect(hipRise(round, 0.4, 4.2)).toBeLessThan(3);
  });
});
