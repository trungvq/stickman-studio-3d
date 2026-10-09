// Khẩu hình tự sinh từ lời: `pnpm lipsync <file tiếng> <tên hành động> [tuỳ chọn]`
// faster-whisper (`tools/words.py`) ra mốc từng chữ; mỗi mora (tiếng Nhật) hay mỗi tiếng
// (chữ Latin) một khẩu hình theo âm, nhấn và cảm xúc, khép khi nghỉ. Ghi `actions/<tên>.json`
// qua `ActionSchema` của rig. docs/07 § Khẩu hình theo lời, docs/01 § Khẩu hình và mắt.
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ACTION_VERSION, parseAction } from "@stickman3d/sketch";

/** Độ dài một mora ước cho phần chữ không đọc được âm (kanji), và nhịp chẻ tiếng Latin dài */
const STEP = 0.13;

const USAGE = `pnpm lipsync <file tiếng> <tên hành động> [tuỳ chọn]

  --step <giây>     độ dài một mora ước cho kanji, nhịp chẻ tiếng dài (mặc định ${STEP})
  --faster <hệ số>  chọn --step sao cho số lần mấp máy gấp ngần này lần bản mặc định
  --mood <kiểu>     neutral (mặc định) | happy | sad | bored | angry — bộ khẩu hình
  --words <file>    dùng mốc chữ có sẵn thay vì chạy whisper
  --model <tên>     model whisper (mặc định small)   --lang <mã>  (mặc định vi; tiếng Nhật: ja)
  --out <thư mục>   thư mục ghi (mặc định actions)
  --force           chạy lại whisper dù đã có mốc chữ trong tmp/words/`;

/** Nghỉ từ ngần này giây thì khép về hình nghỉ của bộ */
const REST_GAP = 0.2;
/** Nghỉ ngắn hơn ngần này thì giữ hình đang có; ở giữa thì răng cắn */
const SHORT_GAP = 0.07;
/** Một hình giữ ít nhất ngần này giây; mora ngắn hơn gộp vào mora kề */
const MIN_HOLD = 0.07;
/** Mỗi đoạn lời ngần này giây có một mora há to */
const STRESS_SPAN = 1.5;

/**
 * Bộ khẩu hình theo vai: R nghỉ, G răng cắn, A há vừa, B há to, O tròn, OO tròn dọc (nguyên âm
 * o kéo dài). docs/01 § Khẩu hình và mắt.
 */
const MOODS = {
  neutral: { R: "closed", G: "talkTeeth", A: "talkA", B: "talkB", O: "o", OO: "talkO" },
  happy: { R: "smile", G: "talkTeeth", A: "talkA", B: "grin", O: "o", OO: "talkO" },
  sad: { R: "frown", G: "talkSadA", A: "talkSadB", B: "talkSadB", O: "o", OO: "talkO" },
  bored: { R: "closed", G: "talkSadA", A: "talkSadB", B: "talkSadB", O: "o", OO: "talkO" },
  angry: { R: "frown", G: "grit", A: "talkAngryA", B: "talkAngryB", O: "o", OO: "talkO" },
};

const argv = process.argv.slice(2);
const opt = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i < 0 ? undefined : argv[i + 1];
};
const valued = new Set(["step", "faster", "mood", "words", "model", "lang", "out"]);
const positional = argv.filter(
  (a, i) => !a.startsWith("--") && !(i > 0 && valued.has(argv[i - 1].slice(2))),
);
const [audio, name] = positional;
if (argv.includes("--help") || !audio || !name) {
  console.error(USAGE);
  process.exit(argv.includes("--help") ? 0 : 1);
}
const die = (msg) => {
  console.error(msg);
  process.exit(1);
};
if (!existsSync(audio)) die(`không có ${audio}`);
const mood = MOODS[opt("mood") ?? "neutral"] ?? die(`--mood: ${Object.keys(MOODS).join(" | ")}`);

const probe = spawnSync(
  "ffprobe",
  ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audio],
  { encoding: "utf8" },
);
const duration = Number(probe.stdout?.trim());
if (probe.status !== 0 || !(duration > 0)) die(`ffprobe không đo được ${audio}`);

function transcribe() {
  const hash = createHash("sha1").update(readFileSync(audio)).digest("hex").slice(0, 12);
  const cache = join("tmp/words", `${hash}.json`);
  if (existsSync(cache) && !argv.includes("--force"))
    return JSON.parse(readFileSync(cache, "utf8"));
  const python =
    process.env.PYTHON ?? (existsSync(".venv/bin/python") ? ".venv/bin/python" : "python3");
  const args = [
    "tools/words.py",
    audio,
    `--model=${opt("model") ?? "small"}`,
    `--lang=${opt("lang") ?? "vi"}`,
  ];
  console.error(`… whisper ${audio}`);
  const r = spawnSync(python, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  if (r.status !== 0) die(`tools/words.py lỗi (${python})`);
  const words = JSON.parse(r.stdout);
  mkdirSync("tmp/words", { recursive: true });
  writeFileSync(cache, JSON.stringify(words) + "\n");
  return words;
}

const words = opt("words") ? JSON.parse(readFileSync(opt("words"), "utf8")) : transcribe();
if (!words.length) die(`không nghe ra chữ nào trong ${audio}`);

/** Độ to (dB) mỗi 1/100 s của file tiếng; `null` khi không đọc được hoặc tiếng lặng */
function loudness() {
  const r = spawnSync(
    "ffmpeg",
    ["-v", "error", "-i", audio, "-ac", "1", "-ar", "16000", "-f", "s16le", "-"],
    { maxBuffer: 1 << 30 },
  );
  if (r.status !== 0 || !r.stdout?.length) return null;
  const pcm = new Int16Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length >> 1);
  const hop = 160;
  const db = [];
  for (let i = 0; i + hop <= pcm.length; i += hop) {
    let sum = 0;
    for (let j = i; j < i + hop; j++) sum += pcm[j] * pcm[j];
    db.push(10 * Math.log10(sum / hop / 32768 ** 2 + 1e-12));
  }
  return Math.max(...db) > -50 ? db : null;
}
const loud = loudness();
const loudAt = (s, e) => {
  const seg = loud.slice(
    Math.floor(s * 100),
    Math.max(Math.floor(s * 100) + 1, Math.ceil(e * 100)),
  );
  return seg.length ? Math.max(...seg) : -120;
};

const VOWEL = {};
for (const [v, row] of Object.entries({
  a: "あかさたなはまやらわがざだばぱぁゃゎ",
  i: "いきしちにひみりぎじぢびぴぃ",
  u: "うくすつぬふむゆるぐずづぶぷぅゅゔ",
  e: "えけせてねへめれげぜでべぺぇ",
  o: "おこそとのほもよろをごぞどぼぽぉょ",
}))
  for (const ch of row) VOWEL[ch] = v;
const SMALL = new Set("ぁぃぅぇぉゃゅょゎ");
const LIPS = new Set("まみむめもばびぶべぼぱぴぷぺぽ");
const hira = (ch) => {
  const c = ch.codePointAt(0);
  return c >= 0x30a1 && c <= 0x30f6 ? String.fromCodePoint(c - 0x60) : ch;
};
const isKana = (ch) => ch === "ー" || ch === "ん" || ch === "っ" || ch in VOWEL;
const isKanji = (ch) => /[\u3005\u4e00-\u9fff]/.test(ch);

/**
 * Âm của một tiếng Latin: o tròn môi (o / ô / u, trừ âm cuối của ao / au / âu / eo và u của
 * qu), i bè (chỉ i / y / ư), còn lại a
 */
function latinVowel(w) {
  const bare = w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300\u0301\u0303\u0309\u0323]/g, "")
    .normalize("NFC")
    .replace(/^qu/, "q")
    .replace(/([aăâeê])[ou]/g, "$1");
  if (/[oôu]/.test(bare)) return "o";
  if (/[iyư]/.test(bare) && !/[aăâeêơ]/.test(bare)) return "i";
  return "a";
}

/**
 * Tách một chữ thành các đơn vị khẩu hình `{ s, e, v, lips, last }`: `v` là âm (a i u e o,
 * N ん, Q っ, L kéo dài, null không đọc được). Chữ có kana đi theo mora; kanji ước theo `step`.
 */
function units(w, step) {
  const chars = [...w.w].map(hira);
  const dur = w.e - w.s;
  let mora = [];
  if (chars.some((ch) => isKana(ch) || isKanji(ch))) {
    const kana = chars.filter((ch) => isKana(ch) && !SMALL.has(ch)).length;
    const kanji = chars.filter(isKanji).length;
    const extra = Math.max(0, Math.round(dur / step) - kana - kanji);
    const blocks = [];
    for (const ch of chars) {
      if (SMALL.has(ch) && mora.length) mora.at(-1).v = VOWEL[ch];
      else if (ch === "ー") mora.push({ v: "L" });
      else if (ch === "ん") mora.push({ v: "N" });
      else if (ch === "っ") mora.push({ v: "Q" });
      else if (ch in VOWEL) {
        const prev = mora.at(-1)?.v;
        // Nguyên âm lặp lại âm của mora trước (おお, ええ, いい) cũng là kéo dài
        const long =
          (ch === "う" && (prev === "o" || prev === "u")) ||
          (ch === "い" && prev === "e") ||
          ("あいうえお".includes(ch) && prev === VOWEL[ch]);
        mora.push({ v: long ? "L" : VOWEL[ch], lips: LIPS.has(ch) });
      } else if (isKanji(ch)) {
        const b = { v: null, n: 1 };
        blocks.push(b);
        mora.push(b);
      }
    }
    // Mora kanji còn thiếu so với độ dài chữ chia vòng cho các kanji
    for (let k = 0; k < extra && blocks.length; k++) blocks[k % blocks.length].n++;
    mora = mora.flatMap((m) => (m.n ? Array.from({ length: m.n }, () => ({ v: null })) : [m]));
  } else {
    const n = Math.max(1, Math.floor(dur / step));
    // Khép môi xét độ dài cả tiếng: chẻ tiếng dài ra nhiều đơn vị không được làm mất nhịp khép
    const lips = /^[mbp]/i.test(w.w) && !/^ph/i.test(w.w) && dur >= 2 * MIN_HOLD;
    mora = Array.from({ length: n }, (_, i) =>
      i ? { v: null } : { v: latinVowel(w.w), lips, close: lips },
    );
  }
  if (!mora.length) mora = [{ v: null }];
  const d = dur / mora.length;
  let out = mora.map((m, i) => ({ ...m, s: w.s + i * d, e: w.s + (i + 1) * d }));
  // Mora kéo dài và mora quá ngắn gộp vào mora trước; tròn môi thắng khi gộp
  const merged = [];
  for (const u of out) {
    const p = merged.at(-1);
    if (p && (u.v === "L" || u.e - u.s < MIN_HOLD || p.e - p.s < MIN_HOLD)) {
      if (u.v === "L") p.long = true;
      else if (u.v === "o" || u.v === "u") p.v = u.v;
      p.e = u.e;
    } else merged.push({ ...u });
  }
  out = merged;
  for (const u of out) u.close ??= !!u.lips && u.e - u.s >= 2 * MIN_HOLD;
  out.at(-1).last = true;
  return out;
}

function generate(step) {
  const keys = [];
  const key = (t, mouth) => {
    const at = Math.round((Math.min(t, duration) / duration) * 1e4) / 1e4;
    // Trùng `t` thì mốc sau thắng: chữ đầu ở giây 0 đè mốc khép mở đầu
    if (keys.length && keys.at(-1).t >= at) keys.pop();
    keys.push({ t: at, pose: {}, face: { mouth }, ease: "linear" });
  };
  key(0, mood.R);
  // Đoạn lời: chuỗi chữ giữa hai lần nghỉ dài
  const phrases = [[]];
  words.forEach((w, i) => {
    phrases.at(-1).push(w);
    if (i + 1 < words.length && words[i + 1].s - w.e >= REST_GAP) phrases.push([]);
  });
  let prev = mood.R;
  for (const phrase of phrases) {
    const list = phrase.map((w) => ({ w, us: units(w, step) }));
    const all = list.flatMap((x) => x.us);
    // Há to: độ to cao nhất mỗi `STRESS_SPAN` giây của đoạn; tiếng lặng thì mora đầu đoạn
    const stress = new Set();
    if (loud) {
      const t0 = all[0].s;
      const spans = new Map();
      for (const u of all.filter((u) => u.v !== "o" && u.v !== "u")) {
        const k = Math.floor((u.s - t0) / STRESS_SPAN);
        const db = loudAt(u.s, u.e);
        if (!spans.has(k) || db > spans.get(k).db) spans.set(k, { u, db });
      }
      for (const { u } of spans.values()) stress.add(u);
    } else stress.add(all[0]);
    list.forEach(({ w, us }, wi) => {
      const hasO = us.some((u) => u.v === "o");
      let usedO = false;
      for (const u of us) {
        let role;
        if (u.v === "o" || (u.v === "u" && !hasO && !usedO)) role = u.long ? "OO" : "O";
        else if (u.v === "a" || u.v === "e") role = "A";
        else if (u.v === "N" && u.last && wi === list.length - 1) role = "R";
        else if (u.v === "i" || u.v === "u" || u.v === "N" || u.v === "Q") role = "G";
        else role = prev === mood.A ? "G" : "A";
        if (stress.has(u) && role !== "O" && role !== "OO" && role !== "R") role = "B";
        if (role === "O" || role === "OO") usedO = true;
        let mouth = mood[role];
        // Hai mora liền nhau cùng hình thì đổi răng cắn ↔ há vừa cho miệng vẫn mấp máy; tròn môi giữ
        if (mouth === prev && role !== "R" && role !== "O" && role !== "OO")
          mouth = mouth === mood.G ? mood.A : mood.G;
        if (u.close) {
          key(u.s, mood.R);
          key(u.s + MIN_HOLD, mouth);
        } else key(u.s, mouth);
        prev = mouth;
      }
      const next = phrase[wi + 1]?.s;
      if (next !== undefined && next - w.e >= SHORT_GAP && prev !== mood.G) {
        key(w.e, mood.G);
        prev = mood.G;
      }
    });
    key(phrase.at(-1).e, mood.R);
    prev = mood.R;
  }
  const out = keys.filter((k, i) => !i || k.face.mouth !== keys[i - 1].face.mouth);
  // Mốc giữ chưa tới `MIN_HOLD` nhường chỗ cho hình trước; mốc mở đầu thì nhường cho hình nghỉ
  const span = (i) => ((out[i + 1]?.t ?? 1) - out[i].t) * duration;
  if (span(0) < MIN_HOLD - 0.01) out[0].face.mouth = mood.R;
  for (let i = 1; i < out.length; i++)
    if (span(i) < MIN_HOLD - 0.01 && out[i].face.mouth !== mood.R) out.splice(i--, 1);
  return out.filter((k, i) => !i || k.face.mouth !== out[i - 1].face.mouth);
}

const flaps = (keys) => keys.filter((k, i) => i && k.face.mouth !== keys[i - 1].face.mouth).length;

let step = Number(opt("step") ?? STEP);
if (opt("faster")) {
  const want = Number(opt("faster"));
  const base = flaps(generate(STEP));
  const steps = Array.from({ length: 13 }, (_, i) => +(STEP - 0.005 * i).toFixed(3));
  step = steps.reduce((best, s) =>
    Math.abs(flaps(generate(s)) / base - want) < Math.abs(flaps(generate(best)) / base - want)
      ? s
      : best,
  );
  console.error(`--faster ${want}: step ${step}, mấp máy ${base} → ${flaps(generate(step))}`);
}
if (!(step > 0)) die("--step phải dương");

const parsed = parseAction({
  schemaVersion: ACTION_VERSION,
  name,
  duration: Math.round(duration * 1000) / 1000,
  end: "hold",
  mask: ["face"],
  keys: generate(step),
});
if (!parsed.success) die(parsed.error.message);

const outDir = resolve(opt("out") ?? "actions");
mkdirSync(outDir, { recursive: true });
const file = join(outDir, `${name}.json`);
writeFileSync(file, JSON.stringify(parsed.data, null, 2) + "\n");
const d = parsed.data.duration;
console.log(
  `${file}: ${parsed.data.keys.length} mốc, ${words.length} chữ, ${d}s, step ${step}${loud ? "" : ", không đọc được độ to"}`,
);
console.log(
  `Cảnh: { "action": "${name}", "start": "@<mốc lời>", "cycle": ${d}, "blend": 0 }, rồi { "start": "@<mốc lời>+${d}", "blend": 0 }`,
);
