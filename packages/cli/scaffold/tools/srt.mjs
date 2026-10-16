// Sinh phụ đề `out/<tập>.srt` cho mỗi file trong `episodes/`: `pnpm srt [tên-tập]`.
// Không gõ lại câu nào và không ước lượng mốc nào — ba nguồn đều có sẵn:
//   `src/shots.ts`            shot nào lên hình ở frame nào (cùng bảng xếp với composition)
//   `episodes/*.json`         `shots[].audio[]` — cue vào giây nào, câu chữ ở `text`
//   `assets/audio/<file>`     mốc trong cue **đo** bằng `ffmpeg silencedetect`, không đoán
// Chỉ có lời dẫn; tiếng động không vào phụ đề — đây là bản CC, không phải SDH. docs/07
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import {
  parseAction,
  parseAnimal,
  parseHeldItem,
  parseProp,
  parseScene,
  resolveScene,
} from "@stickman3d/sketch";
import { parseEpisode } from "../src/episode.ts";
import { cueStart, layoutShots } from "../src/shots.ts";
import { commonDir } from "./webpack.mjs";

const ROOT = process.cwd();
/** Cùng số với `Root.tsx`; đổi ở đó thì đổi ở đây */
const FPS = 60;

/** `silencedetect`: dưới ngưỡng này và dài hơn ngần này giây thì là chỗ nghỉ — bắt được ngắt mệnh đề mà không cắt nhầm phụ âm tắc */
const NOISE = "-35dB";
const MIN_SIL = 0.25;
/** Đoạn tiếng ngắn hơn ngần này là mẩu rác của phép đo */
const MIN_SPEECH = 0.08;
/** Hai dòng 42 ký tự là chuẩn CC, không giữ quá 7 giây */
const MAX_LINE = 42;
const MAX_CHARS = MAX_LINE * 2;
const MAX_HOLD = 7;
/** Chữ nán lại sau khi dứt tiếng — mắt đọc chậm hơn tai */
const TAIL = 0.4;
const MIN_HOLD = 1.2;
const GAP = 0.08;

const jsonIn = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json") : [];

const load = (dirs, parse, keep) => {
  const out = {};
  for (const dir of dirs)
    for (const f of jsonIn(dir)) {
      const r = parse(JSON.parse(readFileSync(join(dir, f), "utf8")));
      if (!r.success) throw new Error(`${f}: ${r.error.message}`);
      out[keep ? f : f.replace(/\.json$/, "")] = r.data;
    }
  return out;
};

const common = commonDir();
const ACTIONS = load([join(common, "actions"), join(ROOT, "actions")], parseAction);
const SCENES = load([join(ROOT, "scenes")], parseScene);
const ANIMALS = load([join(common, "animals"), join(ROOT, "animals")], parseAnimal, true);
const PROPS = load([join(ROOT, "props")], parseProp, true);
const HELD = load([join(common, "held"), join(ROOT, "held")], parseHeldItem);

const SECONDS = {};
const sceneSeconds = (name) => {
  if (!SCENES[name]) throw new Error(`không có scenes/${name}.json`);
  return (SECONDS[name] ??=
    SCENES[name].duration ??
    resolveScene(SCENES[name], ACTIONS, ANIMALS, PROPS, {}, {}, HELD).duration);
};

const run = (bin, args) => {
  const r = spawnSync(bin, args, { encoding: "utf8" });
  if (r.error || r.status !== 0) throw new Error(`${bin} hỏng: ${r.error?.message ?? r.stderr}`);
  return r;
};

const audioSeconds = (path) =>
  Number(
    run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "csv=p=0",
      path,
    ]).stdout.trim(),
  );

/** Các đoạn **có tiếng** trong một file; ffmpeg in kết quả ra stderr và vẫn trả 0 */
function speechSpans(path, dur) {
  const r = run("ffmpeg", [
    "-hide_banner",
    "-nostats",
    "-i",
    path,
    "-af",
    `silencedetect=n=${NOISE}:d=${MIN_SIL}`,
    "-f",
    "null",
    "-",
  ]);
  const marks = [...r.stderr.matchAll(/silence_(start|end): ([\d.-]+)/g)].map((m) => ({
    kind: m[1],
    t: Math.max(0, Math.min(dur, Number(m[2]))),
  }));
  const silences = [];
  for (const m of marks) {
    if (m.kind === "start") silences.push({ start: m.t, end: dur });
    else if (silences.length) silences[silences.length - 1].end = m.t;
  }
  const spans = [];
  let at = 0;
  for (const s of silences) {
    if (s.start - at > MIN_SPEECH) spans.push({ start: at, end: s.start });
    at = Math.max(at, s.end);
  }
  if (dur - at > MIN_SPEECH) spans.push({ start: at, end: dur });
  return spans.length ? spans : [{ start: 0, end: dur }];
}

/** Tiếng Việt mỗi tiếng một chữ rời, nên đếm chữ là đếm tiếng */
const syl = (s) => s.split(/\s+/).filter(Boolean).length;
const endsSentence = (s) => /[.!?…]["')\]]?$/.test(s.trim());
const chunks = (text) =>
  text
    .split(/(?<=[,.;:!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Mảnh chữ nào rơi vào đoạn tiếng nào. Số mảnh và số đoạn hiếm khi bằng nhau, nên khớp
 * tối ưu: cắt cả hai dãy thành cùng số khối, giữ thứ tự, sao cho tỉ lệ số tiếng của mỗi
 * khối chữ sát tỉ lệ thời lượng khối tiếng đứng cùng chỗ. Khối vắt qua dấu chấm bị phạt.
 */
function align(text, spans) {
  const n = text.length;
  const m = spans.length;
  const syls = [0];
  for (const t of text) syls.push(syls[syls.length - 1] + syl(t));
  const secs = [0];
  for (const s of spans) secs.push(secs[secs.length - 1] + (s.end - s.start));
  const chu = syls[n] || 1;
  const giay = secs[m] || 1;
  const PENALTY = 0.5;
  const cost = (i0, i1, j0, j1) => {
    let k = Math.abs((syls[i1] - syls[i0]) / chu - (secs[j1] - secs[j0]) / giay);
    for (let i = i0; i < i1 - 1; i++) if (endsSentence(text[i])) k += PENALTY;
    return k;
  };
  // Ép đúng `k` khối: không ép là dp gộp tất vào một khối chi phí 0
  const k = Math.min(n, m);
  const dp = Array.from({ length: k + 1 }, () =>
    Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity)),
  );
  const from = Array.from({ length: k + 1 }, () =>
    Array.from({ length: n + 1 }, () => Array(m + 1).fill([0, 0])),
  );
  dp[0][0][0] = 0;
  for (let b = 1; b <= k; b++)
    for (let i = b; i <= n; i++)
      for (let j = b; j <= m; j++)
        for (let i0 = b - 1; i0 < i; i0++)
          for (let j0 = b - 1; j0 < j; j0++) {
            const c = dp[b - 1][i0][j0] + cost(i0, i, j0, j);
            if (c < dp[b][i][j]) {
              dp[b][i][j] = c;
              from[b][i][j] = [i0, j0];
            }
          }
  const out = [];
  for (let [b, i, j] = [k, n, m]; b > 0; b--) {
    const [i0, j0] = from[b][i][j];
    out.unshift({
      text: text.slice(i0, i).join(" "),
      start: spans[j0].start,
      end: spans[j - 1].end,
    });
    [i, j] = [i0, j0];
  }
  return out;
}

/** Gom mảnh liền nhau thành thẻ: hết câu, quá dài hay quá lâu thì đóng thẻ */
function cards(parts) {
  const out = [];
  for (const p of parts) {
    const last = out[out.length - 1];
    const joined = last ? `${last.text} ${p.text}` : "";
    if (
      !last ||
      endsSentence(last.text) ||
      joined.length > MAX_CHARS ||
      p.end - last.start > MAX_HOLD
    )
      out.push({ ...p });
    else Object.assign(last, { text: joined, end: p.end });
  }
  return out;
}

/** Tối đa hai dòng, ưu tiên cắt sau dấu câu, không thì cân hai dòng */
function wrap(text) {
  if (text.length <= MAX_LINE) return text;
  const w = text.split(" ");
  const cuts = [...w.keys()].slice(1).map((i) => {
    const a = w.slice(0, i).join(" ");
    const b = w.slice(i).join(" ");
    return { a, b, fit: a.length <= MAX_LINE && b.length <= MAX_LINE };
  });
  const pool = cuts.some((c) => c.fit) ? cuts.filter((c) => c.fit) : cuts;
  const score = (c) => Math.abs(c.a.length - c.b.length) - (/[,.;:!?…]$/.test(c.a) ? 12 : 0);
  const best = pool.reduce((x, y) => (score(y) < score(x) ? y : x));
  return `${best.a}\n${best.b}`;
}

const stamp = (t) => {
  const ms = Math.round(t * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

function srtOf(name, ep) {
  const entries = [];
  const put = (cue, base, shot) => {
    if (!cue.text) return;
    const path = join(ROOT, "assets/audio", cue.file);
    if (!existsSync(path)) throw new Error(`${name}: không có assets/audio/${cue.file}`);
    // Cue vào ở frame nào — `Episode.tsx` cũng làm tròn đúng thế này; `"@mốc"` tra cảnh của shot
    const start = shot?.scene ? cueStart(cue, shot, SCENES[shot.scene].marks) : cue.at;
    if (typeof start !== "number")
      throw new Error(
        `${name}: cue ${cue.file} \`at\` là \`${start}\` mà không có cảnh để tra mốc`,
      );
    const at = (base + Math.round(start * FPS)) / FPS;
    const dur = audioSeconds(path);
    for (const c of cards(align(chunks(cue.text), speechSpans(path, dur))))
      entries.push({ start: at + c.start, end: at + c.end, text: c.text, cue: cue.file });
  };
  for (const l of layoutShots(ep, FPS, sceneSeconds))
    for (const cue of l.shot.audio) put(cue, l.from, l.shot);
  for (const cue of ep.audio) put(cue, 0, null);
  entries.sort((a, b) => a.start - b.start);
  entries.forEach((e, i) => {
    const next = entries[i + 1];
    const room = next ? next.start - GAP : Infinity;
    e.end = Math.min(Math.max(e.end + TAIL, Math.min(e.start + MIN_HOLD, room)), room);
    if (e.end <= e.start)
      throw new Error(`${e.cue}: thẻ "${e.text}" bị thẻ sau đè lên ở ${stamp(e.start)}`);
  });
  return {
    entries,
    srt: entries
      .map((e, i) => `${i + 1}\n${stamp(e.start)} --> ${stamp(e.end)}\n${wrap(e.text)}\n`)
      .join("\n"),
  };
}

const only = process.argv[2]?.replace(/\.json$/, "");
const files = jsonIn(join(ROOT, "episodes")).filter((f) => !only || f === `${only}.json`);
if (!files.length) {
  console.error(only ? `không có episodes/${only}.json` : "episodes/ trống");
  process.exit(1);
}
mkdirSync(join(ROOT, "out"), { recursive: true });
for (const f of files) {
  const r = parseEpisode(JSON.parse(readFileSync(join(ROOT, "episodes", f), "utf8")));
  if (!r.success) throw new Error(`${f}: ${r.error.message}`);
  const name = basename(f, ".json");
  const { entries, srt } = srtOf(name, r.data);
  const out = resolve(ROOT, "out", `${name}.srt`);
  writeFileSync(out, srt, "utf8");
  for (const e of entries)
    console.log(`${stamp(e.start)} → ${stamp(e.end)}  ${e.cue.padEnd(14)} ${e.text}`);
  console.log(`\n${entries.length} thẻ → ${out}`);
}
