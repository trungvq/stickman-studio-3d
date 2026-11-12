// Tiếng của một cảnh trong Studio 3D: lấy cue của mọi shot trỏ vào cảnh trong tập, đổi ra giây cảnh rồi phát bằng Web Audio.
// Hình bám đồng hồ âm thanh, máy giật thì mất khung chứ tiếng không lệch. docs/05-repo-video.md#tiếng-và-phụ-đề-trong-studio-3d
import { markTime, sceneTime, screenTime, warpTable } from "@stickman3d/rig/core";

type RawCue = {
  file: string;
  at?: number | string;
  dur?: number;
  loop?: number;
  fade?: { in?: number; out?: number };
  text?: string;
  volume?: number;
};
type RawShot = {
  scene?: string;
  from?: number;
  to?: number;
  duration?: number;
  hold?: number;
  slow?: { from: number; to: number; rate: number }[];
  audio?: RawCue[];
};
/** Trả về của `GET /api/sound` */
export type SoundData = {
  episode: string | null;
  shots?: RawShot[];
  audio?: RawCue[];
  durations?: Record<string, number | undefined>;
  fps?: number;
};

/** Một cue trên trục giây cảnh: nghe trong `[from, end)`, `start` là lúc file bắt đầu (trước `from` nếu cue đã chạy từ shot khác) */
export type PlayCue = {
  file: string;
  start: number;
  from: number;
  end: number;
  volume: number;
  fadeIn: number;
  fadeOut: number;
  dur?: number;
  loop?: number;
  text?: string;
};

const EPS = 1e-3;

type Part = { shot: RawShot; sceneFrom: number; sceneTo: number };
type Run = { sceneFrom: number; sceneTo: number; epFrom: number; parts: Part[] };

/** Các đoạn shot liền nhau của cảnh; đoạn chồng lên đoạn dài hơn (hook cắt lại từ cảnh) thì bỏ, vì một giây cảnh chỉ phát một bộ tiếng */
function sceneRuns(data: SoundData, name: string): Run[] {
  const fps = data.fps ?? 60;
  const runs: Run[] = [];
  let frame = 0;
  let open: Run | null = null;
  for (const shot of data.shots ?? []) {
    const table = warpTable(shot.slow ?? []);
    const from = shot.from ?? 0;
    const whole = shot.scene ? data.durations?.[shot.scene] : undefined;
    const end = shot.to ?? whole;
    const screen = shot.duration ?? (end === undefined ? NaN : screenTime(end - from, table));
    if (shot.scene === name) {
      const sceneTo =
        shot.to ??
        (shot.duration !== undefined
          ? from + sceneTime(shot.duration, table)
          : (whole ?? Infinity));
      const part = { shot, sceneFrom: from, sceneTo };
      if (open && Math.abs(open.sceneTo - from) < EPS) {
        open.parts.push(part);
        open.sceneTo = sceneTo;
      } else {
        open = { sceneFrom: from, sceneTo, epFrom: frame / fps, parts: [part] };
        runs.push(open);
      }
    } else open = null;
    frame += Math.max(1, Math.round((screen + (shot.hold ?? 0)) * fps));
  }
  const kept: Run[] = [];
  for (const r of [...runs].sort((a, b) => b.sceneTo - b.sceneFrom - (a.sceneTo - a.sceneFrom)))
    if (!kept.some((k) => r.sceneFrom < k.sceneTo - EPS && k.sceneFrom < r.sceneTo - EPS))
      kept.push(r);
  return kept.sort((a, b) => a.sceneFrom - b.sceneFrom);
}

const base = (c: RawCue) => ({
  file: c.file,
  volume: c.volume ?? 1,
  fadeIn: c.fade?.in ?? 0,
  fadeOut: c.fade?.out ?? 0,
  ...(c.dur !== undefined && { dur: c.dur }),
  ...(c.loop !== undefined && { loop: c.loop }),
  ...(c.text !== undefined && { text: c.text }),
});

/** Cue của cảnh `name` trên trục giây cảnh, sắp theo lúc vào. `marks` là mốc có tên của cảnh (cue khai `at: "@mốc"`) */
export function sceneCues(data: SoundData, name: string, marks: Record<string, number>): PlayCue[] {
  const out: PlayCue[] = [];
  const runs = sceneRuns(data, name);
  for (const run of runs)
    for (const { shot, sceneFrom, sceneTo } of run.parts) {
      const table = warpTable(shot.slow ?? []);
      for (const c of shot.audio ?? []) {
        let at: number;
        try {
          at =
            typeof c.at === "string"
              ? Math.max(0, screenTime(markTime(c.at, marks, `cue ${c.file}`) - sceneFrom, table))
              : (c.at ?? 0);
        } catch {
          continue;
        }
        const start = sceneFrom + sceneTime(at, table);
        if (start < sceneTo) out.push({ ...base(c), start, from: start, end: sceneTo });
      }
    }
  // cue tầng tập (nhạc, bè nền) khai giây của cả tập: đổi sang giây cảnh theo chỗ đoạn shot đứng trong tập
  for (const c of data.audio ?? []) {
    if (typeof c.at === "string") continue;
    for (const run of runs) {
      if (!Number.isFinite(run.epFrom)) continue;
      const start = (c.at ?? 0) + run.sceneFrom - run.epFrom;
      if (start >= run.sceneTo || (c.dur !== undefined && start + c.dur <= run.sceneFrom)) continue;
      out.push({ ...base(c), start, from: Math.max(start, run.sceneFrom), end: run.sceneTo });
    }
  }
  return out.sort((a, b) => a.from - b.from);
}

/** Một lần phát file: `when` và `gains[].when` tính bằng giây thật kể từ lúc bấm phát, `offset`, `length` là giây trong file */
export type Segment = {
  when: number;
  offset: number;
  length: number;
  gains: { when: number; v: number }[];
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Các lần phát của cue khi bắt đầu nghe ở giây cảnh `t`; mức âm như `CueAudio` của Remotion */
export function planCue(c: PlayCue, fileSeconds: number, t: number, speed: number): Segment[] {
  const span = c.dur ?? fileSeconds;
  const stop = Math.min(c.end, c.start + span);
  const begin = Math.max(t, c.from);
  if (begin >= stop) return [];
  const level = (l: number) => {
    let v = c.volume;
    if (c.fadeIn > 0) v *= clamp01(l / c.fadeIn);
    if (c.fadeOut > 0) v *= clamp01((span - l) / c.fadeOut);
    return v;
  };
  const clock = (l: number) => (c.start + l - t) / speed;
  const segment = (a: number, b: number, iter: number): Segment => {
    const la = a - c.start;
    const lb = b - c.start;
    const stops = [la, c.fadeIn, span - c.fadeOut, lb].filter((l) => l >= la && l <= lb);
    const gains = [...new Set(stops)]
      .sort((x, y) => x - y)
      .map((l) => ({ when: clock(l), v: level(l) }));
    return { when: clock(la), offset: a - iter, length: b - a, gains };
  };
  if (!c.loop) {
    const b = Math.min(stop, c.start + fileSeconds);
    return b > begin ? [segment(begin, b, c.start)] : [];
  }
  const out: Segment[] = [];
  for (let i = Math.floor((begin - c.start) / c.loop); c.start + i * c.loop < stop; i++) {
    const iter = c.start + i * c.loop;
    const a = Math.max(begin, iter);
    const b = Math.min(stop, iter + c.loop, iter + fileSeconds);
    if (b > a) out.push(segment(a, b, iter));
  }
  return out;
}

/** Trễ giữa lệnh phát và tiếng đầu tiên, đủ để mọi cue vào cùng lúc */
const LEAD = 0.04;

export class ScenePlayer {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private cues: PlayCue[] = [];
  private live: AudioBufferSourceNode[] = [];
  private anchor: { at: number; t: number; speed: number } | null = null;
  private gen = 0;

  get has() {
    return this.cues.length > 0;
  }
  get running() {
    return this.anchor !== null;
  }
  get speed() {
    return this.anchor?.speed ?? 1;
  }

  /** Giải mã mọi file của `cues`; file đã có thì dùng lại, file không còn cần thì bỏ. Trả các file không nạp được */
  async load(cues: PlayCue[], url: (file: string) => string): Promise<string[]> {
    const gen = ++this.gen;
    this.stop();
    this.cues = [];
    this.ctx ??= new AudioContext();
    const ctx = this.ctx;
    const files = [...new Set(cues.map((c) => c.file))];
    for (const f of [...this.buffers.keys()]) if (!files.includes(f)) this.buffers.delete(f);
    const missing: string[] = [];
    await Promise.all(
      files
        .filter((f) => !this.buffers.has(f))
        .map(async (f) => {
          try {
            const res = await fetch(url(f));
            if (!res.ok) throw new Error(String(res.status));
            this.buffers.set(f, await ctx.decodeAudioData(await res.arrayBuffer()));
          } catch {
            missing.push(f);
          }
        }),
    );
    if (gen !== this.gen) return [];
    this.cues = cues.filter((c) => this.buffers.has(c.file));
    return missing;
  }

  /** Bỏ hết tiếng của cảnh đang có */
  clear() {
    this.gen++;
    this.stop();
    this.cues = [];
  }

  /** Phát từ giây cảnh `t`; `false` là trình duyệt chưa cho phát âm thanh, khung sau gọi lại */
  start(t: number, speed: number): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    if (ctx.state !== "running") {
      void ctx.resume();
      return false;
    }
    this.stop();
    const at = ctx.currentTime + LEAD;
    for (const c of this.cues) {
      const buffer = this.buffers.get(c.file)!;
      for (const s of planCue(c, buffer.duration, t, speed)) {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.playbackRate.value = speed;
        const gain = ctx.createGain();
        s.gains.forEach((g, i) => {
          if (i === 0) gain.gain.setValueAtTime(g.v, at + g.when);
          else gain.gain.linearRampToValueAtTime(g.v, at + g.when);
        });
        src.connect(gain).connect(ctx.destination);
        src.start(at + s.when, s.offset, s.length);
        this.live.push(src);
      }
    }
    this.anchor = { at, t, speed };
    return true;
  }

  stop() {
    for (const s of this.live) {
      try {
        s.stop();
      } catch {
        // nguồn đã phát xong
      }
      s.disconnect();
    }
    this.live = [];
    this.anchor = null;
  }

  /** Giây cảnh đang nghe, đã trừ độ trễ ra loa để hình khớp tiếng */
  time(): number {
    const { at, t, speed } = this.anchor!;
    const ctx = this.ctx!;
    return t + Math.max(0, ctx.currentTime - (ctx.outputLatency || 0) - at) * speed;
  }

  /** Lời đang nói ở giây `t` */
  subtitle(t: number): string {
    let text = "";
    for (const c of this.cues) {
      if (c.text === undefined || t < c.from) continue;
      const span = c.dur ?? this.buffers.get(c.file)!.duration;
      if (t < Math.min(c.end, c.start + span)) text = c.text;
    }
    return text;
  }
}
