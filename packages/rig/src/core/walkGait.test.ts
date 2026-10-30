import { describe, expect, it } from "vitest";

import { parseAction, type ActionData } from "./action";
import { D } from "./constants";
import { body3 } from "./figure3d";
import {
  gaitMetrics,
  gaitTrace,
  type GaitKey,
  type GaitRow,
  type GaitSample,
  type GaitTrace,
} from "./gait";
import {
  actionStride,
  parseScene,
  resolveScene,
  sceneAt,
  sceneLaunchProblems,
  sceneSlideProblems,
  sceneStopProblems,
  sceneTurnProblems,
  yawDelta,
} from "./scene";
import { parseCharacter, type CharacterData } from "./schema";
import { sceneSnaps } from "./snap";
import { segSegDistance } from "./heldAudit";
import { k4, K4_TURN, WALK_SCENES, WALK_STRIDE } from "./__fixtures__/walkScenes";
import walkJson from "../../../../common/actions/walk.json";
import standJson from "../../../../common/actions/stand-3d.json";
import heavyJson from "../../../../common/characters/sample-heavy.json";
import kimonoJson from "../../../../common/characters/sample-kimono.json";
import manJson from "../../../../common/characters/sample-man.json";
import womanJson from "../../../../common/characters/sample-woman.json";

function action(json: unknown): ActionData {
  const r = parseAction(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}

function character(json: unknown): CharacterData {
  const r = parseCharacter(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}

const ACTIONS = { walk: action(walkJson), "stand-3d": action(standJson) };
const CHARS: Record<string, CharacterData> = {
  "sample-man.json": character(manJson),
  "sample-woman.json": character(womanJson),
  "sample-heavy.json": character(heavyJson),
  "sample-kimono.json": character(kimonoJson),
};

// lõi không có kiểu của Node: thư mục ghi và `node:fs` đọc qua `globalThis`, chỉ khi chạy với `WALK_OUT`
const OUT = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
  .WALK_OUT;
const fs: {
  mkdirSync(p: string, o: object): void;
  writeFileSync(p: string, s: string): void;
} = OUT ? await import("node:fs" as string) : undefined;
const join = (...p: string[]) => p.join("/");

/** Giây đầu của bảng thứ hai (lấy mẫu từ `CUT − 0,1`) */
const CUT = 0.7;

/** Năm kịch bản trên bốn người mẫu: số đo hiện trạng, chưa chặn theo ngưỡng. `WALK_OUT=<thư mục>` ghi bảng và cảnh */
describe("đi mượt: số đo hiện trạng năm kịch bản (docs/14 mục 2–3)", () => {
  it("sải của `walk` chung khớp số của kịch bản", () => {
    expect(actionStride(ACTIONS.walk)).toBeCloseTo(WALK_STRIDE, 0);
  });

  const out: Record<string, unknown>[] = [];
  for (const k of WALK_SCENES)
    it(k.name, () => {
      for (const [file, c] of Object.entries(CHARS)) {
        const parsed = parseScene(k.scene(c.rig.height, file));
        if (!parsed.success) throw new Error(parsed.error.message);
        const rt = resolveScene(parsed.data, ACTIONS, { a: c.rig.height }, { a: body3(c) });
        const tr = gaitTrace(rt, "a")!;
        const rows: GaitRow[] = gaitMetrics(tr);
        const want = [
          "cruise",
          "stop",
          ...(/dung-roi-di|K4/.test(k.name) ? ["launch"] : []),
          ...(/K4/.test(k.name) ? ["turn"] : []),
        ];
        const got = new Set(tr.samples.map((x) => x.label));
        got.delete("still");
        expect([...got].sort(), `${k.name} ${file}`).toEqual(want.sort());
        const bend = /cung|K5/.test(k.name) ? "arc" : /K2|K3/.test(k.name) ? "corner" : undefined;
        expect(
          tr.bends.map((b) => b.kind),
          k.name,
        ).toEqual(bend ? (bend === "arc" ? ["arc"] : ["corner"]) : []);
        const measured: GaitKey[] = [
          "dip",
          "lag",
          "omega",
          "slip",
          "ratePeak",
          "devStraight",
          "feetCross",
          "feetGap",
          ...(bend === "arc" ? (["devArc"] as const) : bend ? (["devCorner"] as const) : []),
          ...(/K4/.test(k.name) ? (["omegaTurn", "slipJoin"] as const) : []),
        ];
        for (const key of measured)
          expect(row(rows, key).n, `${k.name} ${file} ${key}`).toBeGreaterThan(0);
        // bỏ quãng vào cảnh: clip `walk` hoà vào từ `idle` trong `blend` đầu
        const cut = gaitMetrics(gaitTrace(rt, "a", c.rig.height, body3(c), CUT)!);
        for (const r of [...rows, ...cut]) {
          expect(Number.isFinite(r.value), `${k.name} ${file} ${r.key}`).toBe(true);
          expect(Number.isFinite(r.t)).toBe(true);
        }
        const snaps = sceneSnaps(rt, { characterOf: () => c });
        const move = [
          ...sceneSlideProblems(rt),
          ...sceneLaunchProblems(rt),
          ...sceneStopProblems(rt),
          ...sceneTurnProblems(rt),
        ];
        const labels: Record<string, number> = {};
        for (const s of tr.samples) labels[s.label] = (labels[s.label] ?? 0) + 1;
        out.push({
          scene: k.name,
          character: file,
          height: c.rig.height,
          labels,
          rows,
          cut,
          snaps: snaps.map((s) => ({ t: s.t, joint: s.joint, px: s.px, base: s.base })),
          move,
        });
        if (OUT && file === "sample-man.json") {
          const dir = join(OUT, "scenes");
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(
            join(dir, `${k.name}.json`),
            JSON.stringify(parsed.data, null, 2) + "\n",
          );
          fs.writeFileSync(
            join(dir, `${k.name}.trace.json`),
            JSON.stringify(
              tr.samples.map((s) => ({
                t: +s.t.toFixed(4),
                label: s.label,
                run: s.run,
                hip: s.hip.map((v) => +v.toFixed(2)),
                P: s.P.map((v) => +v.toFixed(2)),
                vRef: +s.vRef.toFixed(2),
                yaw: +s.yaw.toFixed(2),
                yaw0: +s.yaw0.toFixed(2),
                rate: +s.rate.toFixed(4),
                stride: +s.stride.toFixed(4),
                bearing: s.bearing,
              })),
            ),
          );
        }
      }
    });

  it("ghi bảng", () => {
    if (!OUT) return;
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(join(OUT, "so-do.json"), JSON.stringify(out, null, 1));
    fs.writeFileSync(
      join(OUT, "strips.json"),
      JSON.stringify(
        WALK_SCENES.map((k) => ({ name: k.name, title: k.title, strips: k.strips })),
        null,
        1,
      ),
    );
  });
});

/** Trace tổng hợp: bước `0,01 s`, `height` `1`, `s` `1`, mặc định đứng hai chân cách nhau `40` dọc `z` */
function synth(
  n: number,
  at: (t: number, i: number) => Partial<GaitSample>,
  extra: Partial<GaitTrace> = {},
): GaitTrace {
  const step = 0.01;
  const samples = Array.from({ length: n + 1 }, (_, i): GaitSample => {
    const t = i * step;
    return {
      t,
      hip: [0, -100, 0],
      yaw: 0,
      yaw0: 0,
      rate: 1,
      stride: 1,
      bearing: [0, 1],
      feet: [
        [0, 0, -20],
        [0, 0, 20],
      ],
      knees: [
        [0, -50, -20],
        [0, -50, 20],
      ],
      P: [0, 0],
      T: [1, 0],
      vRef: 0,
      clip: "0:0",
      leg: 0,
      label: "cruise",
      run: 0,
      slip: true,
      ...at(t, i),
    };
  });
  return {
    id: "a",
    from: 0,
    to: n * step,
    height: 1,
    s: 1,
    step,
    legHalf: 5,
    strides: { "0:0": 100 },
    bends: [],
    path: [
      { t: 0, at: [0, 0] },
      { t: n * step, at: [1000, 0] },
    ],
    samples,
    ...extra,
  };
}

const row = (rows: GaitRow[], k: GaitKey) => rows.find((r) => r.key === k)!;

describe("đi mượt: công thức số đo trên trace tổng hợp", () => {
  it("M1: hông còn nửa tốc `path` một giây — tụt 50 %, không vọt, gia tốc 1/s qua cửa sổ một bước", () => {
    // cửa sổ `100 / (2 · 100)` = 0,5 s; dời 2 mẫu đổi `ρ` 0,02 trong 0,02 s
    const x = (t: number) => (t < 2 ? 100 * t : t < 3 ? 200 + 50 * (t - 2) : 250 + 100 * (t - 3));
    const rows = gaitMetrics(
      synth(500, (t) => ({ hip: [x(t), -100, 0], P: [x(t), 0], vRef: 100 })),
    );
    expect(row(rows, "dip").value).toBeCloseTo(0.5, 6);
    expect(row(rows, "dip").ok).toBe(false);
    expect(row(rows, "surge").value).toBeCloseTo(0, 6);
    expect(row(rows, "accel").value).toBeCloseTo(1, 6);
    expect(row(rows, "lag").value).toBeCloseTo(0, 9);
  });

  for (const lag of [100, -100, 30, -30])
    it(`trễ ${lag}: kiểm hai phía theo trị tuyệt đối, giữ dấu`, () => {
      const r = row(
        gaitMetrics(synth(10, () => ({ hip: [0, -100, 0], P: [lag, 0], vRef: 100 }))),
        "lag",
      );
      expect(r.value).toBeCloseTo(lag, 9);
      expect(r.limit).toBe(40);
      expect(r.ok).toBe(Math.abs(lag) <= 40);
    });

  it("M2: yaw `½ α t²` với `α` 2000°/s² — `α` đúng 2000, `ω` lớn nhất `α · t` ở mẫu cuối còn sai phân", () => {
    const rows = gaitMetrics(synth(30, (t) => ({ yaw: 1000 * t * t })));
    expect(row(rows, "alpha").value).toBeCloseTo(2000, 6);
    expect(row(rows, "omega").value).toBeCloseTo(2000 * 0.28, 6);
    expect(row(rows, "omega").ok).toBe(false);
  });

  it("M3: chân trụ trôi 0,3 mỗi mẫu suốt 20 mẫu — lệch 6, mỗi khung 0,6", () => {
    const rows = gaitMetrics(
      synth(40, (_, i) =>
        i >= 10 && i <= 30
          ? {
              bearing: [0],
              feet: [
                [0.3 * (i - 10), 0, -20],
                [0, -10, 20],
              ],
            }
          : {},
      ),
    );
    expect(row(rows, "slip").value).toBeCloseTo(6, 9);
    expect(row(rows, "slip").ok).toBe(false);
    expect(row(rows, "slipFrame").value).toBeCloseTo(0.6, 9);
  });

  const legs = (k1: number[], f1: number[]) => () => ({
    knees: [[0, 0, 0], k1] as GaitSample["knees"],
    feet: [[120, 0, 0], f1] as GaitSample["feet"],
  });
  it("M9: hai cẳng chân cắt nhau giữa hai điểm lưới — cách 0", () => {
    const r = row(gaitMetrics(synth(0, legs([5, -55, 0], [5, 65, 0]))), "feetGap");
    expect(r.value).toBeCloseTo(0, 9);
    expect(r.ok).toBe(false);
  });
  it("M9: hai cẳng chân song song cách 30; chỉ gần ở hai đầu — `hypot(10, 20)`", () => {
    const par = row(gaitMetrics(synth(0, legs([0, 30, 0], [120, 30, 0]))), "feetGap");
    expect(par.value).toBeCloseTo(30, 9);
    expect(par.ok).toBe(true);
    const ends = row(gaitMetrics(synth(0, legs([140, 0, 10], [200, 0, 10]))), "feetGap");
    expect(ends.value).toBeCloseTo(Math.hypot(20, 10), 9);
  });

  /** Chu kỳ 1 s: chân phải bay `[0; 0,4)`, chân trái `[0,5; 0,9)` tốc 100, nhấc 10; bước dừng chân trái tốc 150, nhấc 12 */
  function stopTrace(cruiseTo: number) {
    const x = [0, 0];
    return synth(Math.round((cruiseTo + 0.6) * 100), (t) => {
      const stop = t >= cruiseTo - 1e-9;
      const u = t - Math.floor(t + 1e-9);
      const fly = stop
        ? t >= cruiseTo + 0.1 && t < cruiseTo + 0.5
          ? 1
          : -1
        : u < 0.4 - 1e-9
          ? 0
          : u >= 0.5 - 1e-9 && u < 0.9 - 1e-9
            ? 1
            : -1;
      if (fly >= 0) x[fly] += (stop ? 150 : 100) * 0.01;
      const y = (f: number) => (fly === f ? (stop ? -12 : -10) : 0);
      return {
        label: stop ? "stop" : "cruise",
        run: stop ? 1 : 0,
        phase: t,
        bearing: fly < 0 ? [0, 1] : [1 - fly],
        feet: [
          [x[0], y(0), -20],
          [x[1], y(1), 20],
        ],
      };
    });
  }
  it("M10: so với trọn chu kỳ `cruise` cùng clip ngay trước — tốc 1,5 ×, nhấc 1,2 ×, giây là của đỉnh", () => {
    const rows = gaitMetrics(stopTrace(2));
    const [v, l] = [row(rows, "stopSpeed"), row(rows, "stopLift")];
    expect(v.value).toBeCloseTo(1.5, 6);
    expect(l.value).toBeCloseTo(1.2, 6);
    for (const r of [v, l]) {
      expect(r.ok).toBe(false);
      expect(r.t).toBeGreaterThanOrEqual(2.1);
      expect(r.t).toBeLessThan(2.5);
    }
  });
  it("M10: `cruise` trước lần dừng ngắn hơn một chu kỳ — thiếu dữ liệu, không đạt", () => {
    const v = row(gaitMetrics(stopTrace(0.6)), "stopSpeed");
    expect(v.n).toBe(0);
    expect(v.missing).toBe(1);
    expect(v.ok).toBe(false);
  });
});

describe("đi mượt: trace trên cảnh thật", () => {
  const man = CHARS["sample-man.json"];
  const runtime = (path: { t: number; at: number[]; yaw: number }[]) => {
    const end = path[path.length - 1].t;
    const parsed = parseScene({
      lens: { eye: [0, -300, -1500], yaw: 0, pitch: 10, f: 1100, cx: 0, cy: 0 },
      duration: end + 0.6,
      cast: [
        {
          id: "a",
          character: "sample-man.json",
          world: { path },
          tracks: [
            {
              name: "chan",
              clips: [
                { action: "walk", start: 0, cycle: 1.18, blend: 0.3 },
                { action: "stand-3d", start: end - 0.3, blend: 0.3 },
              ],
            },
          ],
        },
      ],
    });
    if (!parsed.success) throw new Error(parsed.error.message);
    return resolveScene(parsed.data, ACTIONS, { a: man.rig.height }, { a: body3(man) });
  };

  for (const mid of [2, 2.003])
    it(`mốc giữa đường thẳng cùng tốc ở giây ${mid}: \`vRef\` 250 và \`T\` dọc đường ở mọi mẫu đang đi`, () => {
      const rt = runtime([
        { t: 0, at: [0, 0, 0], yaw: 0 },
        { t: mid, at: [250 * mid, 0, 0], yaw: 0 },
        { t: 4, at: [1000, 0, 0], yaw: 0 },
      ]);
      const tr = gaitTrace(rt, "a", man.rig.height, body3(man))!;
      const moving = tr.samples.filter((x) => x.t > 1e-9 && x.t <= 4 + 1e-9);
      expect(moving.some((x) => Math.abs(x.t - mid) < tr.step / 2 + 1e-9)).toBe(true);
      for (const x of moving) {
        expect(x.vRef).toBeCloseTo(250, 6);
        expect(x.T[0]).toBeCloseTo(1, 9);
      }
    });

  it("khoảng đo `[from; to]`: mọi giây tệ nhất nằm trong khoảng, mẫu đệm chỉ làm sai phân", () => {
    const k = WALK_SCENES.find((x) => x.name === "K3-re-90")!;
    const parsed = parseScene(k.scene(man.rig.height, "sample-man.json"));
    if (!parsed.success) throw new Error(parsed.error.message);
    const rt = resolveScene(parsed.data, ACTIONS, { a: man.rig.height }, { a: body3(man) });
    const tr = gaitTrace(rt, "a", man.rig.height, body3(man), 1.5, 2.5)!;
    expect(tr.samples[0].t).toBeLessThan(1.5);
    for (const r of gaitMetrics(tr))
      if (r.n) {
        expect(r.t, r.key).toBeGreaterThanOrEqual(1.5 - 1e-9);
        expect(r.t, r.key).toBeLessThanOrEqual(2.5 + 1e-9);
      }
  });
});

/** K4 trên bốn người mẫu: cú quay tại chỗ từ giây 2,3 tới 3,9 rồi đi theo hướng mới hay đứng yên */
describe("yawDelta: lệch nửa vòng giữ dấu của lệch thô (docs/03 Quay tại chỗ)", () => {
  it.each([
    [0, 180, 180],
    [0, -180, -180],
    [-691.7, -511.7, 180],
    [511.7, 691.7, 180],
    [-511.7, -691.7, -180],
    [360, 540, 180],
    [540, 360, -180],
    [0, 540, 180],
    [179.9999999, -0.0000001, -180],
    [10, 100, 90],
    [350, 10, 20],
  ])("%d → %d ra %d", (from, to, want) => {
    expect(yawDelta(from, to)).toBe(want);
  });
});

describe("quay tại chỗ: chân không bắt chéo, thân quay liền, đầu dẫn (docs/03 Quay tại chỗ)", () => {
  const [T0, T1] = K4_TURN;
  type Opts = { yaw0?: number; parts?: number };
  const runtime = (turn: number, steps: number, walk: boolean, file: string, opts: Opts = {}) => {
    const c = CHARS[file];
    const parsed = parseScene(k4(turn, steps, walk, opts)(c.rig.height, file, "k4"));
    if (!parsed.success) throw new Error(parsed.error.message);
    return resolveScene(parsed.data, ACTIONS, { a: c.rig.height }, { a: body3(c) });
  };
  /** Hướng thân (độ, liền qua các vòng) và lệch của đầu so với thân mỗi `1/120 s` trong `[t0, t1]` */
  const turnSeries = (rt: ReturnType<typeof runtime>, file: string, t0: number, t1: number) => {
    const c = CHARS[file];
    const out: { t: number; yaw: number; lead: number }[] = [];
    for (let k = 0; t0 + k / 120 <= t1 + 1e-9; k++) {
      const t = t0 + k / 120;
      const s = sceneAt(rt, "a", t, c.rig.height, body3(c));
      const y = s.world!.yaw / D;
      const prev = out[out.length - 1]?.yaw ?? y;
      const yaw = prev + ((((y - prev + 180) % 360) + 360) % 360) - 180;
      // lắc dương là quay mặt về trái người khi không lật
      out.push({ t, yaw, lead: (s.world!.flip ? 1 : -1) * s.pose.head[1] });
    }
    return out;
  };
  /** Bàn chân nhấc cao nhất (`y` âm là lên) của [phải, trái] trong `[t0, t1]` */
  const lifts = (rt: ReturnType<typeof runtime>, file: string, t0: number, t1: number) => {
    const c = CHARS[file];
    const tr = gaitTrace(rt, "a", c.rig.height, body3(c), t0, t1)!;
    const xs = tr.samples.filter((x) => x.t >= t0 && x.t <= t1);
    return [0, 1].map((i) => Math.min(...xs.map((x) => x.feet[i][1])));
  };

  // `yaw0` 0 và 180 nhìn người từ hai phía: lật ban đầu khác nhau; `parts` 2 là hai cú quay liền nhau
  const CASES: [number, number, Opts][] = [
    [-90, 1, {}],
    [90, 1, {}],
    [-90, 2, {}],
    [90, 2, {}],
    [-180, 2, {}],
    [180, 2, {}],
    [-180, 3, {}],
    [180, 3, {}],
    [-180, 4, {}],
    [180, 4, {}],
    [-180, 2, { yaw0: 180 }],
    [180, 2, { yaw0: 180 }],
    [-90, 2, { yaw0: 180 }],
    [180, 3, { yaw0: 180 }],
    [-180, 1, { parts: 2 }],
    [180, 1, { parts: 2 }],
    [180, 2, { parts: 2, yaw0: 180 }],
  ];
  const label = (turn: number, steps: number, o: Opts) =>
    `${turn > 0 ? "phải" : "trái"} ${Math.abs(turn)}° \`steps\` ${steps}` +
    (o.parts ? ` chia ${o.parts} cú` : "") +
    (o.yaw0 ? ` từ \`yaw\` ${o.yaw0}` : "");

  it("hai hướng đầu của bảng nhìn người từ hai phía: lật ban đầu khác nhau", () => {
    const file = "sample-man.json";
    const h = CHARS[file].rig.height;
    const flip = (yaw0: number) =>
      sceneAt(runtime(180, 2, true, file, { yaw0 }), "a", 0, h, body3(CHARS[file])).world!.flip;
    expect(flip(0)).not.toBe(flip(180));
  });

  for (const [turn, steps, o] of CASES)
    for (const walk of [true, false])
      it(`${label(turn, steps, o)}${walk ? " rồi đi" : ""}: hai cẳng chân cách nhau từ 10 cm, check không kêu`, () => {
        for (const file of Object.keys(CHARS)) {
          const c = CHARS[file];
          const rt = runtime(turn, steps, walk, file, o);
          const tr = gaitTrace(rt, "a", c.rig.height, body3(c), T0, T1 + 0.4)!;
          let gap = Infinity;
          for (const x of tr.samples)
            if (x.t >= T0 && x.t <= T1 + 0.4)
              gap = Math.min(gap, segSegDistance(x.knees[0], x.feet[0], x.knees[1], x.feet[1]));
          expect(gap, `${file}`).toBeGreaterThan(0.1 * 250);
          expect([
            ...sceneSlideProblems(rt),
            ...sceneLaunchProblems(rt),
            ...sceneTurnProblems(rt),
          ]).toStrictEqual([]);
        }
      });

  for (const [turn, steps, o] of CASES)
    it(`${label(turn, steps, o)}: nhịp đầu là chân phía quay; rồi đi thì nhịp cuối là chân phía quay`, () => {
      const file = "sample-man.json";
      const parts = o.parts ?? 1;
      const beat = (T1 - T0) / parts / steps;
      // `feet` là [phải, trái]
      const side = (top: number[]) => (turn > 0 ? top : [top[1], top[0]]);
      const [first, other] = side(lifts(runtime(turn, steps, false, file, o), file, T0, T0 + beat));
      expect(first).toBeLessThan(-8);
      expect(first).toBeLessThan(other - 5);
      // nửa đầu nhịp cuối: chân kia về sau theo bước kế của clip đi khi chân bước đã đặt xuống
      const [last, pivot] = side(
        lifts(runtime(turn, steps, true, file, o), file, T1 - beat, T1 - beat / 2),
      );
      expect(last).toBeLessThan(-8);
      expect(last).toBeLessThan(pivot - 5);
    });

  it.each([-180, 180])(
    "quay %s° `steps` 1: rig bước hai nhịp như `steps` 2, `check` kêu số nhịp khai",
    (turn) => {
      const file = "sample-man.json";
      const c = CHARS[file];
      for (const walk of [true, false]) {
        const one = runtime(turn, 1, walk, file);
        const two = runtime(turn, 2, walk, file);
        for (let t = T0; t <= T1 + 0.4; t += 0.05)
          expect(sceneAt(one, "a", t, c.rig.height, body3(c))).toStrictEqual(
            sceneAt(two, "a", t, c.rig.height, body3(c)),
          );
        const bad = sceneTurnProblems(one);
        expect(bad).toHaveLength(1);
        expect(bad[0]).toContain("rig bước 2 nhịp");
      }
    },
  );

  it.each([2, 3])(
    "thân quay liền qua chỗ nối nhịp (`steps` %s): tốc ở chỗ nối là tốc trung bình",
    (steps) => {
      const file = "sample-man.json";
      const rt = runtime(-180, steps, true, file);
      const s = turnSeries(rt, file, T0, T1);
      const rate = (t: number) => {
        const i = s.findIndex((x) => x.t >= t - 1e-9);
        return Math.abs(s[i + 1].yaw - s[i - 1].yaw) * 60;
      };
      const mean = 180 / (T1 - T0);
      for (let j = 1; j < steps; j++)
        expect(rate(T0 + ((T1 - T0) * j) / steps)).toBeCloseTo(mean, -1);
      for (const x of s.slice(1, -1))
        if (x.t > T0 + 0.2 && x.t < T1 - 0.2) expect(rate(x.t)).toBeGreaterThan(0.6 * mean);
      expect(rate(T0 + 1 / 120)).toBeLessThan(0.1 * mean);
    },
  );

  it.each([-180, 180])(
    "quay %s°: đầu quay trước thân, lệch theo chiều quay tới 15–25°, về 0 ở mốc cuối",
    (turn) => {
      const file = "sample-woman.json";
      const rt = runtime(turn, 2, true, file);
      const s = turnSeries(rt, file, 2.0, 4.2);
      const lead0 = s[0].lead;
      const start = (f: (x: (typeof s)[number]) => number) =>
        s.find((x) => Math.abs(f(x)) > 2)?.t ?? Infinity;
      const body = start((x) => x.yaw - s[0].yaw);
      const head = start((x) => x.yaw - s[0].yaw + x.lead - lead0);
      expect(body - head).toBeGreaterThan(0.05);
      const top = s.reduce(
        (m, x) => (Math.abs(x.lead - lead0) > Math.abs(m) ? x.lead - lead0 : m),
        0,
      );
      expect(Math.sign(top)).toBe(Math.sign(turn));
      expect(Math.abs(top)).toBeGreaterThan(15);
      expect(Math.abs(top)).toBeLessThanOrEqual(25 + 1e-9);
      for (const x of s) if (x.t < T0 - 0.12 || x.t >= T1) expect(x.lead - lead0).toBeCloseTo(0, 6);
    },
  );

  it.each([-10, 10])(
    "quay %s° không `steps` (không bước): đầu vẫn dẫn theo chiều quay, `0` trước `HEAD_LEAD` giây trước mốc đầu và từ mốc cuối",
    (turn) => {
      const file = "sample-man.json";
      const s = turnSeries(runtime(turn, 0, false, file), file, 2.0, 4.2);
      const lead0 = s[0].lead;
      const rate = turn / (T1 - T0);
      for (const x of s) {
        const d = x.lead - lead0;
        if (x.t <= T0 - 0.12 + 1e-9 || x.t >= T1 - 1e-9) expect(d, `${x.t}`).toBeCloseTo(0, 6);
        else expect(Math.sign(d) || Math.sign(turn), `${x.t}`).toBe(Math.sign(turn));
        // tới hướng thân `0,12 s` sau: `rate · 0,12` giữa cú quay
        if (x.t > T0 + 0.3 && x.t < T1 - 0.3) expect(d, `${x.t}`).toBeCloseTo(rate * 0.12, 1);
      }
      for (let i = 1; i < s.length; i++)
        expect(Math.abs(s[i].lead - s[i - 1].lead)).toBeLessThan(0.1);
    },
  );

  it.each([
    [180, 2, {}],
    [-180, 1, { parts: 2 }],
    [180, 2, { parts: 2, yaw0: 180 }],
  ] as [number, number, Opts][])(
    "quay %s° `steps` %s %o: lệch đầu liền mạch, kể cả qua mốc chung của hai cú liền nhau",
    (turn, steps, o) => {
      const file = "sample-woman.json";
      const s = turnSeries(runtime(turn, steps, true, file, o), file, 2.0, 4.2);
      for (let i = 1; i < s.length; i++)
        expect(Math.abs(s[i].lead - s[i - 1].lead), `${s[i].t}`).toBeLessThan(1);
    },
  );

  it("H9: lệch đúng nửa vòng giữ dấu lệch thô — `0 → 180` quay phải, `0 → −180` quay trái", () => {
    const file = "sample-man.json";
    for (const turn of [180, -180]) {
      const s = turnSeries(runtime(turn, 2, false, file), file, T0, T1);
      expect(s[Math.floor(s.length / 2)].yaw).toBeCloseTo(turn / 2, 0);
      expect(s[s.length - 1].yaw).toBeCloseTo(turn, 6);
    }
  });
});
