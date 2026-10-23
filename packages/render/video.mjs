#!/usr/bin/env node
// Ghép mp4 thử từ một scene bằng chính rig — để người xem chuyển động, không phải đường
// render chính thức (đó là Remotion ở repo video). Cần `rsvg-convert` và `ffmpeg`.
// Xem docs/03-scene.md.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as rig from "@stickman3d/sketch";
import {
  commonLayer,
  findIn,
  layers,
  loadLayers,
  loadParts,
  loadScene,
  mount,
  mountAnimal,
  mountBg,
  mountProp,
  readJson,
  mountPiece,
  sceneFrame,
} from "./lib.mjs";

const CWD = process.cwd();
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? dflt : args[i + 1];
};
const die = (msg) => {
  console.error(msg);
  process.exit(1);
};
const json = (p) => {
  try {
    return readJson(resolve(CWD, p));
  } catch (e) {
    die(`không đọc được ${resolve(CWD, p)} — ${e.message}`);
  }
};
// ffmpeg không nhận `--version`, rsvg-convert không nhận `-version`
const need = (bin, arg) => {
  try {
    execFileSync(bin, [arg], { stdio: "ignore" });
  } catch {
    die(`thiếu \`${bin}\` — cài rồi chạy lại`);
  }
};

const scenePath = flag("scene") ?? args.find((a) => !a.startsWith("--") && a.endsWith(".json"));
if (!scenePath)
  die(
    "dùng: stickman-video --scene scenes/canh.json --out tmp/canh.mp4" +
      " [--fps 24] [--from 0] [--to 3]" +
      " [--actions actions] [--characters characters] [--props props] [--animals animals] [--pieces pieces]" +
      " [--bgdir assets/bg]",
  );

need("rsvg-convert", "--version");
need("ffmpeg", "-version");

// Bộ phận vẽ code của repo, nếu `package.json` khai `stickman.parts` — docs/02-trang-phuc.md
try {
  await loadParts(CWD);
} catch (e) {
  die(e.message);
}

const parsed = rig.parseScene(json(scenePath));
if (!parsed.success) die(parsed.error.message);
// `pieces/`, `actions/`, `animals/` và `characters/` của workspace, bộ chung của studio làm lớp dưới
const common = await commonLayer(CWD);

// Đo `aspect` từng lớp nền trước `resolveScene` — số khai trong JSON chỉ là cái đệm lần trước
const bgUrls = mountBg(parsed.data, layers(resolve(CWD, flag("bgdir", "assets/bg")), null));
const charsDirs = layers(resolve(CWD, flag("characters", "characters")), common?.characters);
const piecesDirs = layers(resolve(CWD, flag("pieces", "pieces")), common?.pieces);
const propsDir = resolve(CWD, flag("props", "props"));
const { rt, animals } = loadScene(
  parsed.data,
  layers(resolve(CWD, flag("actions", "actions")), common?.actions),
  layers(resolve(CWD, flag("animals", "animals")), common?.animals),
  [propsDir],
  charsDirs,
  layers(resolve(CWD, flag("held", "held")), common?.held),
  layers(resolve(CWD, flag("hands", "hands")), common?.hands),
);

const chars = {};
const loadCharacter = (file) =>
  (chars[file] ??= (() => {
    const c = rig.parseCharacter(json(findIn(charsDirs, file)));
    if (!c.success) die(`${file}: ${c.error.message}`);
    return { character: c.data, urls: mount(c.data, piecesDirs) };
  })());

const props = {};
const loadProp = (file) =>
  (props[file] ??= (() => {
    const p = rig.parseProp(json(resolve(propsDir, file)));
    if (!p.success) die(`${file}: ${p.error.message}`);
    return { prop: p.data, url: mountProp(p.data, piecesDirs) };
  })());

const pieces = {};
const beasts = {};
const loadAnimal = (file) =>
  (beasts[file] ??= { animal: animals[file], urls: mountAnimal(animals[file], piecesDirs) });

// Lớp vẽ code của repo, nếu `package.json` khai `stickman.layers` — docs/10-lop-ve-code.md
const codeLayers = await loadLayers(CWD);

const fps = Number(flag("fps", 24));
const from = Number(flag("from", 0));
const to = Number(flag("to", rt.duration));
const out = resolve(CWD, flag("out", "tmp/scene.mp4"));
const frames = resolve(CWD, flag("frames", "tmp/frames"));

try {
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  mkdirSync(resolve(out, ".."), { recursive: true });
  const n = Math.max(1, Math.ceil((to - from) * fps));
  for (let i = 0; i < n; i++) {
    const svg = sceneFrame({
      rt,
      loadCharacter,
      loadProp,
      loadAnimal,
      loadPiece: (file) => (pieces[file] ??= mountPiece(file, piecesDirs)),
      t: from + i / fps,
      codeLayers,
      fallback: flag("character"),
      bg: flag("bg"),
      bgUrls,
    });
    const p = resolve(frames, `f${String(i).padStart(4, "0")}`);
    writeFileSync(`${p}.svg`, svg);
    execFileSync("rsvg-convert", ["-o", `${p}.png`, `${p}.svg`]);
  }
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    String(fps),
    "-i",
    resolve(frames, "f%04d.png"),
    "-pix_fmt",
    "yuv420p",
    "-c:v",
    "libx264",
    out,
  ]);
  console.log(out, `${n} frames @ ${fps}fps`);
} catch (e) {
  die(e.message);
}
