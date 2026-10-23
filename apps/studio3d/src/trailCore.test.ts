import {
  elbowLockSnaps,
  handReport,
  holdRuns,
  sceneSnaps,
  stageJoints,
  sceneAt,
  type ElbowLockSnap,
  type Snap,
} from "@stickman3d/rig/core";
import { describe, expect, it } from "vitest";
import { drawnItem } from "./drawn";
import { c, runtime, scene } from "./fixture";
import type { Json } from "./keys";
import {
  runTrail,
  trailSample,
  trailSnaps,
  trailTimes,
  type TrailSample,
  type TrailTime,
} from "./trailCore";

const snap = (o: Partial<Snap>): Snap => ({
  id: "a",
  t: 1,
  joint: "wristR",
  px: 20,
  base: 2,
  also: [],
  causes: [],
  clips: [],
  ...o,
});
const lock = (o: Partial<ElbowLockSnap>): ElbowLockSnap => ({
  id: "a",
  hand: "right",
  from: 3.4,
  to: 3.5,
  deg: 45,
  keys: [3.4, 3.5],
  ...o,
});

describe("trailTimes", () => {
  it("mọi khung trong cửa sổ, theo thứ tự tăng, kẹp vào cảnh", () => {
    const x = trailTimes(1, 0.5, 30, 4);
    expect(x.map((s) => s.frame)).toEqual(Array.from({ length: 31 }, (_, i) => 15 + i));
    expect(x.every((s, i) => !i || s.t > x[i - 1].t)).toBe(true);
    const lo = trailTimes(0.2, 2, 30, 1);
    expect(lo[0].t).toBe(0);
    expect(lo.at(-1)!.frame).toBe(30);
  });

  it("giây mốc lệch khung chen vào đúng chỗ, mốc trùng khung đánh dấu khung ấy", () => {
    const x = trailTimes(1, 0.2, 30, 4, [1.01, 1.1, 5], [1.1, 0.9]);
    const keys = x.filter((s) => s.key);
    expect(keys.map((s) => [s.t, s.frame, s.key])).toEqual([
      [0.9, 27, "item"],
      [1.01, undefined, "hand"],
      [1.1, 33, "both"],
    ]);
    expect(x.every((s, i) => !i || s.t > x[i - 1].t)).toBe(true);
  });
});

describe("runTrail", () => {
  const times: TrailTime[] = trailTimes(2, 1, 30, 4);

  it("lấy mẫu đúng thứ tự giây tăng, nhường theo ngân sách", async () => {
    const seen: number[] = [];
    let clock = 0;
    let pauses = 0;
    const out = await runTrail(
      times,
      (x) => {
        seen.push(x.t);
        clock += 3;
        return x.t;
      },
      {
        budget: 10,
        now: () => clock,
        pause: async () => void pauses++,
        alive: () => true,
      },
    );
    expect(out).toEqual(times.map((x) => x.t));
    expect(seen).toEqual(times.map((x) => x.t));
    expect(pauses).toBeGreaterThan(10);
  });

  it("lượt bị thay sau khi nhường thì dừng, không lấy mẫu tiếp, trả null", async () => {
    let gen = 1;
    let clock = 0;
    let n = 0;
    const out = await runTrail(
      times,
      () => {
        n++;
        clock += 5;
        if (n === 7) gen = 2;
      },
      {
        budget: 10,
        now: () => clock,
        pause: async () => undefined,
        alive: () => gen === 1,
      },
    );
    expect(out).toBeNull();
    expect(n).toBeLessThan(10);
  });
});

describe("trailSnaps", () => {
  it("khớp chính hay `also` bên ấy, khung sau cú nhảy ở nhịp vệt, lọc người", () => {
    const r = trailSnaps(
      [
        snap({ t: 1, joint: "wristR" }),
        // 60 khung/s: khung lẻ nằm giữa hai khung vệt — đỏ ở khung vệt sau
        snap({ t: 61 / 60, joint: "kneeL", also: ["elbowR"] }),
        snap({ t: 2, joint: "handR" }),
        snap({ t: 2.5, joint: "footL" }),
        snap({ t: 3, joint: "wristL" }),
        snap({ t: 1.5, joint: "wristR", id: "b" }),
      ],
      [],
      "a",
      "right",
      30,
    );
    expect(r.wrist).toEqual([30, 60]);
    expect(r.elbow).toEqual([31]);
    expect(r.other.map((o) => [o.t, o.what])).toEqual([
      [2.5, "bàn chân trái"],
      [3, "cổ tay trái"],
    ]);
  });

  it("khuỷu khoá xoay nhanh: mọi khung trong (from, to] ở vệt khuỷu; tay kia vào `other`", () => {
    const r = trailSnaps([], [lock({}), lock({ hand: "left", from: 1 })], "a", "right", 30);
    expect(r.elbow).toEqual([103, 104, 105]);
    expect(r.wrist).toEqual([]);
    expect(r.other).toEqual([{ t: 1, what: "khuỷu khoá trái" }]);
  });
});

describe("trailSample trên cảnh thử", () => {
  const rt = runtime(scene());
  const runs = (side: "right" | "left") => holdRuns(rt, "a")[side];

  it("cổ tay, khuỷu là `actJoints` như `check` đo; kẹp như `handReport`; tâm món như vẽ", () => {
    for (const t of [0.5, 1.3, 2.5]) {
      for (const side of ["right", "left"] as const) {
        const s = trailSample(rt, "a", side, { t }, runs(side));
        const J = stageJoints(c, sceneAt(rt, "a", t, 1))!.world;
        const tag = side === "right" ? "R" : "L";
        expect(s.wrist).toEqual(J[`wrist${tag}`]);
        expect(s.elbow).toEqual(J[`elbow${tag}`]);
        expect(s.clamped).toEqual(handReport(rt, "a", side, t)!.wrist.clamped);
      }
    }
    const cup = trailSample(rt, "a", "left", { t: 0.5 }, runs("left"));
    expect(cup.item).toEqual(drawnItem(rt, "a", "left", "coc", 0.5)!.at);
    expect(trailSample(rt, "a", "right", { t: 0.5 }, runs("right")).item).toBeNull();
    expect(trailSample(rt, "a", "right", { t: 2.5 }, runs("right")).item).not.toBeNull();
  });

  it("chấm đỏ trùng giật của `sceneSnaps`: khung có bước cổ tay lớn nhất của vệt", async () => {
    const j = scene() as Json & { cast: { world: { hands: Json[] } }[] };
    const hands = j.cast[0].world.hands;
    // tay phải nhảy 80 đơn vị trong một khung
    hands.splice(3, 0, {
      t: 1.4,
      right: { at: [30, -260, -50], point: "grip" },
    });
    hands.splice(4, 0, {
      t: 1.4 + 1 / 30,
      right: { at: [110, -260, -50], point: "grip" },
    });
    const rt2 = runtime(j);
    const characterOf = () => c;
    const snaps = sceneSnaps(rt2, { characterOf, fps: 60 });
    const marks = trailSnaps(snaps, elbowLockSnaps(rt2, { characterOf }), "a", "right", 30);
    expect(marks.wrist.length).toBeGreaterThan(0);
    const times = trailTimes(1.4, 0.5, 30, rt2.duration);
    const out = (await runTrail(times, (x) => trailSample(rt2, "a", "right", x, []), {
      budget: Infinity,
      now: () => 0,
      pause: async () => undefined,
      alive: () => true,
    }))!;
    const step = (s: TrailSample, i: number) =>
      i ? Math.hypot(...s.wrist!.map((v, k) => v - out[i - 1].wrist![k])) : 0;
    const steps = out.map(step);
    const top = out[steps.indexOf(Math.max(...steps))].frame;
    expect(marks.wrist).toContain(top);
  });
});
