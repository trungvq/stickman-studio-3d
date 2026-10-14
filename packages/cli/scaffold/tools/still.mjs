// Nhiều khung, nhiều cảnh trong MỘT lượt bundle: `pnpm frames <cảnh> 316,317,349-351 [<cảnh> 10,60 …] [thư mục ra]`
// `remotion still` bundle lại mỗi lượt và dựng lại cả cảnh cho từng ảnh; ở đây mỗi tab dựng cảnh một lần rồi chỉ tua.
// Khoảng liền viết `316-320`. Id không phải cảnh (tập, thumbnail) cũng được, chụp thẳng composition ấy.
// `--tab N` số tab song song (mặc định nửa số nhân). Ảnh ra `<thư mục ra>/<id>-<khung 5 số>.png`, mặc định `tmp`.
// Xem docs/03 § Remotion.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { FRAMES, parseScene } from "@stickman3d/rig/core";
import { defaultTabs, openSoi, renderComposition, renderSoi } from "./soi.mjs";

const argv = process.argv.slice(2);
const flag = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i < 0 ? d : argv.splice(i, 2)[1];
};
const tabs = Number(flag("tab", defaultTabs()));
let outDir = flag("out", "tmp");
const SPEC = /^\d+(-\d+)?(,\d+(-\d+)?)*$/;

/** "316,317,349-351" → [316, 317, 349, 350, 351] */
const parseFrames = (spec) =>
  [
    ...new Set(
      spec.split(",").flatMap((part) => {
        const m = part.match(/^(\d+)(?:-(\d+))?$/);
        const [a, b] = [Number(m[1]), Number(m[2] ?? m[1])];
        return Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => Math.min(a, b) + i);
      }),
    ),
  ].sort((a, b) => a - b);

/** Cặp `<id> <khung…>` theo thứ tự gõ; id lặp lại thì gộp khung */
const asks = new Map();
for (let i = 0; i < argv.length; i++) {
  const id = argv[i].replace(/^scenes\//, "").replace(/\.json$/, "");
  if (argv[i + 1] !== undefined && SPEC.test(argv[i + 1].replace(/\s/g, ""))) {
    asks.set(id, [
      ...new Set([...(asks.get(id) ?? []), ...parseFrames(argv[++i].replace(/\s/g, ""))]),
    ]);
  } else if (i === argv.length - 1 && asks.size) outDir = argv[i];
  else {
    console.error(`'${argv[i]}' thiếu danh sách khung sau nó`);
    asks.clear();
    break;
  }
}
if (!asks.size) {
  console.error(
    "dùng: node tools/still.mjs <id> <khung[,khung|a-b]> [<id> <khung…> …] [thư mục ra] [--tab N]",
  );
  process.exit(1);
}
mkdirSync(resolve(outDir), { recursive: true });

/** Cảnh `scenes/<id>.json` đi composition `soi`; id khác (tập, thumbnail) chụp thẳng composition ấy */
const sizeOf = (id) => {
  if (!existsSync(`scenes/${id}.json`)) return null;
  const r = parseScene(JSON.parse(readFileSync(`scenes/${id}.json`, "utf8")));
  return r.success ? FRAMES[r.data.frame].video : null;
};

/** Lệch một khung ở cuối thì cả lượt đi tong: cắt phần ngoài tầm rồi báo, khung xin đúng vẫn ra ảnh */
const clip = (id, frames, length) => {
  const outside = frames.filter((f) => f >= length);
  if (outside.length)
    console.error(`bỏ khung ${outside.join(",")} — ${id} dài ${length} khung (0-${length - 1})`);
  return frames.filter((f) => f < length);
};

const soi = await openSoi();
try {
  const outputs = [];
  const save = (id, frame, png) => {
    const output = resolve(outDir, `${id}-${String(frame).padStart(5, "0")}.png`);
    writeFileSync(output, png);
    outputs.push({ id, frame, output });
  };

  const scenes = [...asks].map(([id, frames]) => ({ id, frames, size: sizeOf(id) }));
  // Một composition `soi` có một cỡ khung: cảnh `wide` và `tall` đi hai lượt
  for (const key of new Set(scenes.filter((s) => s.size).map((s) => `${s.size.w}x${s.size.h}`))) {
    const [w, h] = key.split("x").map(Number);
    const group = scenes.filter((s) => s.size?.w === w && s.size?.h === h);
    const inside = new Map();
    await renderSoi(soi, {
      jobs: group.flatMap((s) => s.frames.map((frame) => ({ scene: s.id, frame }))),
      w,
      h,
      tabs,
      keep: (j, lengths) => {
        if (!inside.has(j.scene))
          inside.set(j.scene, new Set(clip(j.scene, asks.get(j.scene), lengths[j.scene])));
        return inside.get(j.scene).has(j.frame);
      },
      onJob: (j, png) => save(j.scene, j.frame, png),
    });
  }
  for (const { id, frames } of scenes.filter((s) => !s.size)) {
    const c = await soi.composition(id).catch((e) => {
      console.error(`không có composition ${id}: ${e.message.split("\n")[0].slice(0, 200)}`);
    });
    const inside = c ? clip(id, frames, c.durationInFrames) : [];
    if (inside.length)
      await renderComposition(soi, c, inside, { tabs, onFrame: (png, f) => save(id, f, png) });
  }

  if (!outputs.length) {
    console.error("không còn khung nào để chụp");
    process.exitCode = 1;
  }
  // In theo thứ tự đã xin, dán thẳng được vào lệnh sau
  const order = [...asks.keys()];
  outputs.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id) || a.frame - b.frame);
  for (const o of outputs) console.log(o.output);
} finally {
  await soi.close();
}
