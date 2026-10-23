// Luồng vệt: dựng runtime của bản đang sửa (cùng `runtimeOf` với trang), lấy mẫu vệt theo `t` tăng, nhường mỗi ~20 ms để
// lượt mới thay lượt cũ, rồi đo giật của người ấy như `check` (`sceneSnaps`, `elbowLockSnaps` cả cảnh). Mẫu và giật nhớ theo
// bản JSON: tua chỉ lấy thêm khung mới. `trails.ts` gửi việc và vẽ.
import {
  defaultCharacter,
  elbowLockSnaps,
  holdRuns,
  parseScene,
  sceneSnaps,
  type CastMember,
  type ElbowLockSnap,
  type HandSide,
  type HoldRunInfo,
  type SceneRuntime,
  type Snap,
} from "@stickman3d/rig/core";
import { handsOf, marksOf, timeOf, type Json } from "./keys";
import { runtimeOf, type Data } from "./runtime";
import {
  runTrail,
  trailSample,
  trailSnaps,
  trailTimes,
  type TrailSample,
  type TrailSnaps,
} from "./trailCore";

/** Ngưỡng giật `stickman.snap` của repo (`{ px, k, fps }`); `null` là tắt */
export type SnapOpts = { px: number; k: number; fps: number } | null;

export type TrailIn =
  | { type: "data"; key: string; data: Data; snap: SnapOpts }
  /** Bỏ việc đang chạy */
  | { type: "stop"; gen: number }
  | {
      type: "job";
      gen: number;
      dataKey: string;
      raw: string;
      id: string;
      side: HandSide;
      t: number;
      span: number;
      fps: number;
    };

export type TrailOut =
  | { type: "trail"; gen: number; samples: TrailSample[]; ms: number; fresh: number }
  | { type: "snaps"; gen: number; snaps: TrailSnaps | null; ms: number }
  | { type: "error"; gen: number; message: string };

type Job = Extract<TrailIn, { type: "job" }>;

const ctx = self as unknown as {
  postMessage(m: TrailOut): void;
  onmessage: ((e: MessageEvent<TrailIn>) => void) | null;
};

let data: { key: string; data: Data; snap: SnapOpts } | null = null;
let rt: {
  raw: string;
  key: string;
  json: Json;
  rt: SceneRuntime;
  frames: Map<string, TrailSample>;
  runs: Map<string, Record<HandSide, HoldRunInfo[]>>;
  /** Giật cả cảnh của từng người */
  snaps: Map<string, { snaps: Snap[]; locks: ElbowLockSnap[] }>;
} | null = null;
let latest = 0;
let next: Job | null = null;
let busy = false;

const pause = () => new Promise<void>((r) => setTimeout(r, 0));

function runtime(job: Job) {
  if (rt?.raw === job.raw && rt.key === job.dataKey) return rt;
  if (!data || data.key !== job.dataKey) throw new Error("luồng vệt chưa có dữ liệu cảnh");
  const json = JSON.parse(job.raw) as Json;
  const p = parseScene(json);
  if (!p.success) throw new Error(`scene JSON sai: ${p.error.message}`);
  rt = {
    raw: job.raw,
    key: job.dataKey,
    json,
    rt: runtimeOf(p.data, data.data).runtime,
    frames: new Map(),
    runs: new Map(),
    snaps: new Map(),
  };
  return rt;
}

/** Giây mốc tay bên `side` của `id` và mốc món của các món tay ấy cầm */
function keyTimes(json: Json, id: string, side: HandSide, runs: readonly HoldRunInfo[]) {
  const marks = marksOf(json);
  const hands = (handsOf(json, id) ?? [])
    .filter((k) => k[side] !== undefined)
    .map((k) => timeOf(k.t, marks));
  const held = new Set(runs.map((r) => r.item));
  const items = ((json.items as Json[] | undefined) ?? [])
    .filter((m) => held.has(m.item as string))
    .map((m) => timeOf(m.t, marks));
  return { hands, items };
}

async function work(job: Job) {
  const alive = () => job.gen === latest;
  const R = runtime(job);
  let runs = R.runs.get(job.id);
  if (!runs) R.runs.set(job.id, (runs = holdRuns(R.rt, job.id)));
  const mine = runs[job.side];
  const k = keyTimes(R.json, job.id, job.side, mine);
  const times = trailTimes(job.t, job.span, job.fps, R.rt.duration, k.hands, k.items);
  const t0 = performance.now();
  let fresh = 0;
  const samples = await runTrail(
    times,
    (x) => {
      const key = `${job.id}|${job.side}|${x.t.toFixed(6)}`;
      let s = R.frames.get(key);
      if (!s) {
        fresh++;
        R.frames.set(key, (s = trailSample(R.rt, job.id, job.side, x, mine)));
      }
      return { ...s, ...x };
    },
    { budget: 20, now: () => performance.now(), pause, alive },
  );
  if (!samples) return;
  ctx.postMessage({ type: "trail", gen: job.gen, samples, ms: performance.now() - t0, fresh });
  const snap = data!.snap;
  if (!snap) return ctx.postMessage({ type: "snaps", gen: job.gen, snaps: null, ms: 0 });
  // cả cảnh, như `check` (nền trung vị ±2 khung, gộp khung sát nhau): tua không đo lại
  let got = R.snaps.get(job.id);
  const s0 = performance.now();
  if (!got) {
    await pause();
    if (!alive()) return;
    const characterOf = (m: CastMember) =>
      m.id !== job.id
        ? undefined
        : m.character
          ? data!.data.characters[m.character]
          : defaultCharacter();
    got = {
      snaps: sceneSnaps(R.rt, { characterOf, ...snap }),
      locks: elbowLockSnaps(R.rt, { characterOf }),
    };
    R.snaps.set(job.id, got);
  }
  if (alive())
    ctx.postMessage({
      type: "snaps",
      gen: job.gen,
      snaps: trailSnaps(got.snaps, got.locks, job.id, job.side, job.fps),
      ms: performance.now() - s0,
    });
}

async function pump() {
  if (busy) return;
  busy = true;
  while (next) {
    const job = next;
    next = null;
    try {
      await work(job);
    } catch (e) {
      ctx.postMessage({ type: "error", gen: job.gen, message: (e as Error).message });
    }
  }
  busy = false;
}

ctx.onmessage = (e) => {
  const m = e.data;
  if (m.type === "data") {
    data = { key: m.key, data: m.data, snap: m.snap };
    return;
  }
  latest = m.gen;
  if (m.type === "stop") {
    next = null;
    return;
  }
  next = m;
  void pump();
};
