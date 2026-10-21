// Vẽ bằng chính @stickman3d/sketch ra PNG, không cần trình duyệt. CLI và MCP server cùng gọi vào đây.
// Mọi đường dẫn tính từ `cwd`, nên chạy được trong repo video.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as rig from "@stickman3d/sketch";
import * as FX from "@stickman3d/fx";
import { jointSampler, motionData, motionOverlay } from "./trails.mjs";
import { threeData, threeShots, threeSize } from "./three.mjs";
import {
  floorGrid,
  floorOverlay,
  sideLegend,
  skeletonData,
  skeletonOverlay,
  solidBoxes,
  topView,
  worldBoxes,
} from "./skeleton.mjs";

export {
  bundlePartsForBrowser,
  layersEntry,
  loadLayers,
  loadParts,
  loadWorld,
  partsEntry,
  worldEntry,
} from "./layers.mjs";
export {
  BONE_SEGS,
  jointSampler,
  motionData,
  motionOverlay,
  TRAIL_NAMES,
  trailJoints,
} from "./trails.mjs";
export { findChrome, threeData, threeShots, threeSize } from "./three.mjs";
export {
  floorGrid,
  skeletonData,
  skeletonOverlay,
  solidBoxes,
  topView,
  worldBoxes,
} from "./skeleton.mjs";

// 1x1 PNG xám, rig tự kéo giãn ra đúng hộp của mảnh
const BLOCK =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQI12OYNm1aDwAF1wJPIOGcygAAAABJRU5ErkJggg==";
const SOFT =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQI12OYNm1aJAAFpAIc6V+/eAAAAABJRU5ErkJggg==";
// Khối đánh dấu: tỉ lệ khung thiết kế, và khăn chỉ chiếm nửa trên đầu
const DESIGN = { torso: 0.55, sleeveNear: 0.45, sleeveFar: 0.45, crown: 2.9 };
const CROWN_BAND = 0.37;

export const PAPER = "#f4f1e8";
export const GROUND = 170;
/** Khung một ô; `head`/`torso` là khung cắt để soi kỹ một vùng */
export const CROPS = {
  full: { x: -160, y: -300, w: 320, h: 520 },
  /** Rộng gấp đôi về phía trước mặt — cho cảnh có xe theo người */
  wide: { x: -220, y: -300, w: 720, h: 520 },
  head: { x: -100, y: -295, w: 200, h: 225 },
  torso: { x: -130, y: -140, w: 260, h: 190 },
};
export const CROP_NAMES = Object.keys(CROPS);
/** Khung cắt để soi kỹ một vùng: nhãn tụt xuống đáy vì trên đó là tóc, và render ở tỉ lệ gấp đôi */
export const isZoom = (crop) => crop !== "full" && crop !== "wide";
export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Bộ chung đi theo studio (mảnh, hành động, động vật và nhân vật mẫu) — `COMMON` của `@stickman3d/cli`, cài cùng

 * repo video hay nằm cạnh trong monorepo. Không thấy cli thì `null`: chỉ có lớp workspace.
 */
export async function commonLayer(cwd = process.cwd()) {
  return (await cliModule(cwd))?.COMMON ?? null;
}

/** Module `lib.mjs` của `@stickman3d/cli`, cài cùng repo video hay nằm cạnh trong monorepo; không thấy thì `null` */
export async function cliModule(cwd = process.cwd()) {
  const found = [];
  try {
    found.push(createRequire(join(cwd, "noop.js")).resolve("@stickman3d/cli"));
  } catch {
    /* repo không cài cli */
  }
  const sibling = resolve(HERE, "../cli/lib.mjs");
  if (existsSync(sibling)) found.push(sibling);
  for (const f of found) return await import(pathToFileURL(f).href);
  return null;
}

/** Thứ tự tìm file: thư mục của workspace trước, bộ chung sau; trùng đường dẫn thì tính một lần */
export const layers = (local, common) => [
  ...new Set([resolve(local), ...(common ? [resolve(common)] : [])]),
];

const toDirs = (dirs) => (Array.isArray(dirs) ? dirs : [dirs]);

/** Đường dẫn thật của một file qua các lớp; không có ở lớp nào thì ném lỗi kể đủ chỗ đã tìm */
export function findIn(dirs, file) {
  const list = toDirs(dirs);
  for (const d of list) {
    const p = resolve(d, file);
    if (existsSync(p)) return p;
  }
  throw new Error(`không có ${file} trong ${list.join(", ")}`);
}

/** Đo tỉ lệ khung PNG từ header */
export const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** Cỡ SVG từ `width`/`height` của thẻ gốc, không có thì từ `viewBox` */
export function svgSize(buf) {
  const head = buf.toString("utf8", 0, Math.min(buf.length, 4096));
  const tag = /<svg\b[^>]*>/i.exec(head)?.[0];
  if (!tag) return undefined;
  const attr = (k) => new RegExp(`\\b${k}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1];
  const num = (v) => (v && /^[\d.]+(px)?$/.test(v.trim()) ? parseFloat(v) : undefined);
  const w = num(attr("width"));
  const h = num(attr("height"));
  if (w && h) return { w, h };
  const vb = attr("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  return vb?.length === 4 && vb[2] > 0 && vb[3] > 0 ? { w: vb[2], h: vb[3] } : undefined;
}

/**
 * Cỡ ảnh đọc từ header — PNG, JPEG, WebP, SVG. Mảnh trang phục thì luôn PNG (`pngSize`),
 * nhưng tấm nền là ảnh chụp, ảnh gen hay SVG vẽ tay nên phải nhận cả bốn.
 */
export function imageSize(buf) {
  if (buf.toString("ascii", 1, 4) === "PNG") return pngSize(buf);
  if (/^\s*(<\?xml|<!--|<svg)/.test(buf.toString("utf8", 0, Math.min(buf.length, 256))))
    return svgSize(buf);
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const tag = buf.toString("ascii", 12, 16);
    if (tag === "VP8 ")
      return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    if (tag === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
    }
    if (tag === "VP8X")
      return {
        w: (buf.readUIntLE(24, 3) & 0xffffff) + 1,
        h: (buf.readUIntLE(27, 3) & 0xffffff) + 1,
      };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8)
    // SOF0..SOF15 mang cỡ thật; SOF4/8/12 là bảng Huffman/số học nên bỏ qua
    for (let i = 2; i + 9 < buf.length;) {
      if (buf[i] !== 0xff) return void 0;
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  return undefined;
}

/** Các lớp nền: nhúng data URI và đo `aspect` từ chính file, như `mount` làm với mảnh. Khoá theo tên file */
export function mountBg(scene, bgDirs) {
  const urls = {};
  const aspects = {};
  for (const file of rig.sceneImages(scene)) {
    const path = findIn(bgDirs, file);
    const buf = readFileSync(path);
    const size = imageSize(buf);
    if (!size) throw new Error(`không đo được cỡ ${file} — nền phải là PNG, JPEG, WebP hay SVG`);
    aspects[file] = size.w / size.h;
    const mime = MIME[path.split(".").pop().toLowerCase()] ?? "image/png";
    urls[file] = `data:${mime};base64,${buf.toString("base64")}`;
  }
  rig.applySceneAspects(scene, aspects);
  return urls;
}

/**
 * Mảnh thật: nhúng thành data URI và đo tỉ lệ khung, đúng như studio làm lúc nạp. `urls`
 * khoá theo tên file và gồm cả vật chưa mặc — cảnh sau mới mặc thì cũng phải có sẵn ảnh.
 * `piecesDirs` là các lớp, xem `layers`.
 */
export function mount(character, piecesDirs) {
  const urls = {};
  const aspects = {};
  for (const file of rig.characterFiles(character)) {
    const buf = readFileSync(findIn(piecesDirs, file));
    const { w, h } = pngSize(buf);
    aspects[file] = w / h;
    urls[file] = `data:image/png;base64,${buf.toString("base64")}`;
  }
  rig.applyAspects(character, aspects);
  return urls;
}

/** Thân đạo cụ: nhúng data URI và đo tỉ lệ khung, như `mount` */
export function mountProp(prop, piecesDirs) {
  if (prop.body.src !== "image" || !prop.body.file) return undefined;
  const buf = readFileSync(findIn(piecesDirs, prop.body.file));
  const { w, h } = pngSize(buf);
  prop.body.aspect = w / h;
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/** Một file mảnh bất kỳ thành data URI — cho hiệu ứng vẽ vật rời tay (`fxFiles`); không có thì `undefined` */
export function mountPiece(file, piecesDirs) {
  try {
    return `data:image/png;base64,${readFileSync(findIn(piecesDirs, file)).toString("base64")}`;
  } catch {
    return undefined;
  }
}

/** Ảnh của một con vật: nhúng data URI, khoá theo tên file như `mount`. Hộp lấy từ bộ xương nên không đo `aspect`. */
export function mountAnimal(animal, piecesDirs) {
  const urls = {};
  for (const file of rig.animalFiles(animal)) {
    const buf = readFileSync(findIn(piecesDirs, file));
    urls[file] = `data:image/png;base64,${buf.toString("base64")}`;
  }
  return urls;
}

/** Khối đánh dấu chỗ từng mảnh, bỏ qua mọi hiệu chỉnh đang có trong JSON — lúc gen thì chưa có mảnh nào */
export function blocks(character) {
  for (const k of rig.PIECE_KEYS) Object.assign(character.pieces[k], { dx: 0, dy: 0, scale: 1 });
  for (const [k, a] of Object.entries(DESIGN)) character.pieces[k].aspect = a;
  character.pieces.crown.scale = CROWN_BAND;
  const urls = {};
  // `urls` khoá theo tên file, nên khối đánh dấu cũng phải mang một cái tên giả
  for (const [k, url] of Object.entries({
    torso: BLOCK,
    sleeveNear: BLOCK,
    sleeveFar: BLOCK,
    crown: SOFT,
  })) {
    const file = `__block__/${k}.png`;
    Object.assign(character.pieces[k], { src: "image", file });
    urls[file] = url;
  }
  return urls;
}

/** Ghép các ô thành một tấm rồi gọi `rsvg-convert` đúng một lần. Trả về đường dẫn PNG. */
export function sheet(cells, { cols, bg = PAPER, scale = 1, out, crop = "full", box }) {
  const VB = box ?? CROPS[crop] ?? CROPS.full;
  cols = Math.max(1, Math.min(cols ?? cells.length, cells.length));
  const rows = Math.ceil(cells.length / cols);
  const w = VB.w * cols;
  const h = VB.h * rows;
  // Mỗi ô cắt đúng khung của nó: xe theo người dài hơn ô thì đừng tràn sang ô bên
  const svg = renderToStaticMarkup(
    React.createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: Math.round(w * scale),
        height: Math.round(h * scale),
        viewBox: `${VB.x} ${VB.y} ${w} ${h}`,
      },
      React.createElement(
        "defs",
        null,
        React.createElement(
          "clipPath",
          { id: "cell" },
          React.createElement("rect", { x: VB.x, y: VB.y, width: VB.w, height: VB.h }),
        ),
      ),
      React.createElement("rect", { x: VB.x, y: VB.y, width: w, height: h, fill: bg }),
      cells.map((cell, i) =>
        React.createElement(
          "g",
          {
            key: i,
            transform: `translate(${(i % cols) * VB.w} ${Math.floor(i / cols) * VB.h})`,
            clipPath: "url(#cell)",
          },
          cell,
        ),
      ),
    ),
  );
  mkdirSync(dirname(out), { recursive: true });
  const svgPath = out.replace(/\.png$/, ".svg");
  writeFileSync(svgPath, `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`);
  execFileSync("rsvg-convert", ["-o", out, svgPath]);
  return { out, width: Math.round(w * scale), height: Math.round(h * scale), cols, rows };
}

/** Nhãn góc trên ô; khung cắt thì đặt xuống đáy vì trên đó là tóc */
export const label = (key, text, dy, dim, crop = "full") => {
  const VB = CROPS[crop] ?? CROPS.full;
  const y = isZoom(crop) ? VB.y + VB.h - 32 + dy / 2 : VB.y + dy;
  return React.createElement(
    "text",
    {
      key,
      x: VB.x + 10,
      y,
      fontSize: isZoom(crop) ? 14 : 22,
      fontFamily: "monospace",
      fill: dim,
    },
    text,
  );
};

/**
 * Tư thế + lớp + nét mặt từ một mô tả: tên trong `POSES`, delta pose, hoặc `{ action, t }`.
 * Hành động sample trên nền `idle`, đúng như scene làm với `base` mặc định.
 */
export function poseOf(spec, actions = {}) {
  if (typeof spec === "string") {
    if (spec in rig.POSES)
      return {
        pose: rig.POSES[spec],
        layers: rig.composeLayers(rig.DEFAULT_LAYERS, rig.POSE_LAYERS[spec] ?? {}),
        face: rig.DEFAULT_FACE,
        equip: [],
        label: spec,
      };
    throw new Error(`pose lạ: ${spec} — có ${rig.POSE_NAMES.join(", ")}`);
  }
  if (spec.action) {
    const a = typeof spec.action === "string" ? actions[spec.action] : spec.action;
    if (!a) throw new Error(`không có hành động \`${spec.action}\``);
    const t = spec.t ?? 0;
    return {
      pose: rig.composePose(rig.POSES.idle, rig.actionPose(a, t)),
      layers: rig.composeLayers(rig.DEFAULT_LAYERS, rig.actionLayers(a, t)),
      face: rig.composeFace(rig.DEFAULT_FACE, rig.actionFace(a, t)),
      equip: rig.actionEquip(a, t),
      label: `${a.name}@${t}`,
    };
  }
  return {
    pose: rig.composePose(rig.POSES.idle, rig.deltaPose(spec)),
    layers: rig.composeLayers(rig.DEFAULT_LAYERS, spec.layer ?? {}),
    face: rig.composeFace(rig.DEFAULT_FACE, spec.face ?? {}),
    equip: spec.equip ?? [],
    label: "delta",
  };
}

/** Một hàng các tư thế của một nhân vật; ô mang `world` (người 3D, xem `solo3d`) thì `flip` / góc nhìn của ô đè của cả dải */
export function renderPoses({
  character,
  urls,
  poses,
  flip = false,
  face = {},
  labels = true,
  equip,
  view,
  headView,
  ...opt
}) {
  const crop = opt.crop ?? "full";
  const cells = poses.map((p, i) => {
    const body = {
      character,
      urls,
      pose: p.pose,
      layers: p.layers,
      equip: rig.composeEquip(equip, p.equip),
      groundY: GROUND,
      flip: p.flip ?? flip,
      view: p.view ?? view,
      headView: p.headView ?? headView,
      world: p.world,
      ...p.face,
      ...face,
    };
    // Người 3D có đồ khối đi kèm (ghế của `solo3d`): xếp lớp chung như cảnh có `scene.lens`
    const solid = p.furniture && p.world && p.spot;
    return [
      labels ? label("l", p.label, 26, "#999", crop) : null,
      solid
        ? React.createElement(FX.SoloWorld, { key: i, solo: p, body, groundY: GROUND })
        : React.createElement(rig.Character, { key: i, ...body }),
    ];
  });
  return sheet(cells, opt);
}

/** Người 3D một mình giữa sân khấu trống; sống ở `@stickman3d/fx` để studio dùng chung */
export { SOLO_LENS, SOLO_SIT_THIGH, solo3d, soloChair } from "@stickman3d/fx";

/** Hai khung reference để đi gen mảnh: rig trần + khối đánh dấu chỗ từng mảnh */
export function renderBoxes({ character, poseName = "idle", arms = 22, view, headView, ...opt }) {
  const base = rig.POSES[poseName];
  if (!base) throw new Error(`pose lạ: ${poseName} — có ${rig.POSE_NAMES.join(", ")}`);
  // Xoè tay để hai mảnh vai áo tách khỏi thân; xa dương, gần âm
  const pose = { ...base, af: [arms, base.af[1], 0], an: [-arms, base.an[1], 0] };
  const bg = opt.bg ?? "#FF00FF";
  const urls = blocks(character);
  const cells = [{}, urls].map((u, i) =>
    React.createElement(rig.Character, {
      key: i,
      character,
      pose,
      urls: u,
      groundY: GROUND,
      view,
      headView,
    }),
  );
  return sheet(cells, { ...opt, bg, cols: 2 });
}

/**
 * Nạp mọi hành động, con vật và đạo cụ mà scene nhắc tới rồi `resolveScene`; mỗi `*Dirs` là
 * các lớp, xem `layers`. Trôi ngang của con vật nướng từ chính JSON của nó nên phải có mặt
 * ngay lúc này; đạo cụ có người ngồi cần chỗ ngồi; `charactersDirs` cho `rt.heights` và `rt.bodies` — đạo
 * cụ theo người cao thấp khác `1` trôi theo số ấy; `heldDirs` cho món cầm tay của `world.hands[].hold`. Thiếu file thì
 * để trống, chỗ vẽ báo sau.
 */
export function loadScene(
  scene,
  actionsDirs,
  animalsDirs,
  propsDirs = [],
  charactersDirs = [],
  heldDirs = [],
) {
  const actions = {};
  const need = (name) => {
    if (!name || actions[name]) return;
    const a = rig.parseAction(readJson(findIn(actionsDirs, `${name}.json`)));
    if (!a.success) throw new Error(`${name}: ${a.error.message}`);
    actions[name] = a.data;
  };
  for (const c of scene.cast)
    for (const t of c.tracks) for (const clip of t.clips) need(clip.action);
  for (const a of scene.animals)
    for (const t of a.tracks) for (const clip of t.clips) need(clip.action);
  const animals = {};
  for (const a of scene.animals) {
    if (animals[a.animal]) continue;
    const r = rig.parseAnimal(readJson(findIn(animalsDirs, a.animal)));

    if (!r.success) throw new Error(`${a.animal}: ${r.error.message}`);
    animals[a.animal] = r.data;
  }
  const maybe = (dirs, file, parse) => {
    let path;
    try {
      path = findIn(dirs, file);
    } catch {
      return undefined;
    }
    const r = parse(readJson(path));
    if (!r.success) throw new Error(`${file}: ${r.error.message}`);
    return r.data;
  };
  const props = {};
  for (const p of scene.props) props[p.prop] ??= maybe(propsDirs, p.prop, rig.parseProp);
  const heights = {};
  const bodies = {};
  for (const m of scene.cast) {
    const c = m.character && maybe(charactersDirs, m.character, rig.parseCharacter);
    if (c) [heights[m.id], bodies[m.id]] = [c.rig.height, rig.body3(c)];
  }
  // món cầm tay mà `world.hands[].hold` nhắc tới; thiếu thì `resolveScene` báo
  const held = {};
  for (const m of scene.cast)
    for (const k of m.world?.hands ?? [])
      for (const h of [k.right?.hold, k.left?.hold]) {
        if (!h) continue;
        const item = rig.heldBase(rig.sceneHoldRef(h).item);
        held[item] ??= maybe(heldDirs, `${item}.json`, rig.parseHeldItem);
      }
  const rt = rig.resolveScene(scene, actions, animals, props, heights, bodies, held);
  // `scene.fx` qua zod của @stickman3d/fx ngay lúc nạp — rig chỉ mang nó theo
  FX.sceneFx(rt);
  return { actions, animals, props, held, rt };
}

/** Đỉnh con vật tính từ mặt đất: lưng cộng cổ và nửa đầu — đủ cho cả voi lẫn gà ngẩng */
const animalHeight = (b) => b.rig.hipY + b.body.depth * b.body.back + b.neck.len + b.head.len * 0.5;

/** Các mốc thời gian đều nhau trong `[from, to]` */
export function sampleTimes({ from = 0, to, cols = 12, every }) {
  const step = every ?? (to - from) / Math.max(1, cols - 1);
  const times = [];
  for (let t = from; t <= to + 1e-9 && times.length < 200; t += Math.max(step, 1e-6))
    times.push(+t.toFixed(3));
  return times;
}

/**
 * Dải ảnh một cảnh: mỗi cột một mốc, mỗi hàng một người. `loadCharacter(file)` trả
 * `{ character, urls }`; dải để soi thân người nên bỏ chỗ đứng, trôi ngang và `scale`, giữ `flip`.
 */
export function renderScene({
  rt,
  loadCharacter,
  loadProp,
  loadAnimal = () => ({ urls: {} }),
  times,
  only,
  fallback,
  ...opt
}) {
  const crop = opt.crop ?? "full";
  const bg = opt.bg ?? PAPER;
  const cast = rt.cast.filter((m) => !only || m.id === only);
  const loose = rt.props.filter((p) => !p.follow && (!only || p.id === only));
  // Con vật có chủ vẽ trong ô của chủ nó
  const beasts = rt.animals.filter((a) => !a.host && (!only || a.id === only));
  if (!cast.length && !loose.length && !beasts.length)
    throw new Error(`không có \`${only}\` trong \`cast\``);
  const many = cast.length + loose.length + beasts.length > 1;
  const cells = [];
  const animalUrls = (a) => loadAnimal(a.animal).urls;
  // Đạo cụ theo người vẽ chung ô với người ấy, giữ độ lệch và góc bánh, bỏ chỗ đứng như người
  const riding = (m, t, height, layer) =>
    rt.props
      .filter((p) => p.follow === m.id && p.layer === layer)
      .map((p) => {
        const at = rig.propAt(rt, p.id, t, height);
        const dir = rig.flipAt(rt, m.id, t) ? -1 : 1;
        return React.createElement(rig.Prop, {
          key: p.id,
          prop: loadProp(p.prop).prop,
          url: loadProp(p.prop).url,
          ...at,
          x: dir * p.x,
          groundY: GROUND + p.y,
          scale: p.scale,
        });
      });
  for (const m of cast) {
    const file = m.character ?? fallback;
    if (!file) throw new Error(`${m.id}: thiếu \`character\``);
    const { character: data, urls } = loadCharacter(file);
    const character = rig.castCharacter(m, data);
    const height = character.rig.height;
    for (const t of times) {
      const sp = rig.sceneAt(rt, m.id, t, height, rig.body3(character));
      // Người cưỡi thì hông đặt cao hơn đường đất đúng chiều cao yên, cho con vật đứng trên đất của ô;
      // người ngồi xe thì dải không có xe, đặt chân lên đất như đứng; người nằm dựng đứng lại cho lọt ô
      const seat = sp.mounted ? sp.mounted.groundY / sp.mounted.scale : 0;
      const at = {
        ...sp,
        x: 0,
        groundY: GROUND - seat,
        scale: 1,
        root: sp.mounted ? sp.root : "feet",
        rotate: 0,
      };
      cells.push([
        label("t", `${t}s`, 26, "#999", crop),
        many ? label("id", m.id, 50, "#bbb", crop) : null,
        ...riding(m, t, height, "back"),
        React.createElement(rig.Character, {
          key: "c",
          character,
          urls,
          slots: rig.castSlots(rt, sp, t, animalUrls),
          ...at,
        }),
        ...riding(m, t, height, "front"),
      ]);
    }
  }
  // Ô là cỡ người; con vật cao hơn thì co lại cho lọt, con thấp giữ nguyên cỡ
  const cell = CROPS[crop] ?? CROPS.full;
  for (const a of beasts) {
    const fit = Math.min(1, (0.85 * (GROUND - cell.y)) / animalHeight(a.spec));
    for (const t of times)
      cells.push([
        label("t", `${t}s`, 26, "#999", crop),
        many ? label("id", a.id, 50, "#bbb", crop) : null,
        React.createElement(rig.Animal, {
          key: "a",
          animal: a.spec,
          urls: animalUrls(a),
          ...rig.animalAt(rt, a.id, t),
          x: 0,
          groundY: GROUND,
          scale: fit,
        }),
      ]);
  }
  for (const p of loose) {
    const { prop, url } = loadProp(p.prop);
    for (const t of times)
      cells.push([
        label("t", `${t}s`, 26, "#999", crop),
        many ? label("id", p.id, 50, "#bbb", crop) : null,
        React.createElement(rig.Prop, {
          key: "p",
          prop,
          url,
          ...rig.propAt(rt, p.id, t),
          x: 0,
          groundY: GROUND,
          scale: 1,
        }),
      ]);
  }
  return sheet(cells, { ...opt, bg, cols: times.length });
}

/**
 * Nội dung thế giới tại `t`: `<SceneWorld>` của `@stickman3d/fx` — cùng component mà app Remotion
 * vẽ, nên khung mp4, ô của dải khung thật và bản render cuối xếp lớp y như nhau. Ở đây chỉ
 * đổi bộ nạp của render sang hợp đồng của nó; `fallback` là nhân vật cho `cast` không khai.
 */
export function sceneWorld({
  rt,
  loadCharacter,
  loadProp,
  loadAnimal = () => ({ urls: {} }),
  loadPiece = () => undefined,
  t,
  fallback,
  bgUrls = {},
  cam,
  codeLayers = [],
}) {
  return React.createElement(FX.SceneWorld, {
    key: "world",
    rt,
    t,
    cam,
    bgUrls,
    codeLayers,
    url: loadPiece,
    characterOf: (m) => {
      const file = m.character ?? fallback;
      if (!file) throw new Error(`${m.id}: thiếu \`character\``);
      return loadCharacter(file);
    },
    propOf: (file) => loadProp(file),
    animalUrls: (a) => loadAnimal(a.animal).urls,
  });
}

/**
 * Một frame của cảnh trên khung của chính cảnh ấy: giữ chỗ đứng, trôi ngang, `scale`, các
 * lớp nền và camera — ngược với `renderScene` (dải ảnh bỏ chúng đi để soi thân người).
 * Trả về chuỗi SVG.
 */
export function sceneFrame({ rt, t, canvas = rt.frame, bg = PAPER, bgUrls, ...world }) {
  const cam = rig.cameraAt(rt, t);
  // Nửa cỡ bản chốt: đủ nhìn, và cả hai chiều chẵn nên libx264 nuốt được khung dọc
  const px = { w: Math.round(canvas.video.w / 2), h: Math.round(canvas.video.h / 2) };
  return renderToStaticMarkup(
    React.createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: px.w,
        height: px.h,
        viewBox: cam.viewBox,
      },
      React.createElement("rect", {
        x: cam.view.x,
        y: cam.view.y,
        width: cam.view.w,
        height: cam.view.h,
        fill: bg,
      }),
      sceneWorld({ rt, t, bgUrls, cam, ...world }),
    ),
  );
}

/**
 * Dải **khung thật**: mỗi ô là cả khung tại một mốc, có nền và có camera — thứ mà
 * `renderScene` cố ý bỏ đi. Camera vào bằng `scale(zoom) translate(−tâm)` nên ô nào cũng
 * cùng một hộp, zoom khác nhau vẫn xếp thẳng hàng. docs/03-scene.md#camera
 *
 * `skeleton: { cast?, views?, world? }` thay người, nền và lớp vẽ code bằng que xương người 3D trên lưới
 * sàn (`views: ["top"]` thêm ô nhìn từ trên xuống, `world` là `worldScene` của cli để vẽ hộp vật cảnh
 * three). Kết quả kèm `warnings`. docs/04-mcp.md#người-3d
 */
export function renderFrames({
  rt,
  times,
  canvas = rt.frame,
  around,
  motion,
  skeleton,
  three,
  ...opt
}) {
  if (three && (around || skeleton))
    throw new Error("ảnh three không đi với `around` hay `skeleton`");
  // `around`: ô là hộp `±pad` đơn vị sân khấu quanh một mốc `anchorAt` của một người, không
  // qua camera — soi bàn tay đang cầm mà không phải đoán toạ độ pixel rồi cắt lại
  const focus = around
    ? (t) => {
        const m = rt.cast.find((c) => c.id === around.cast);
        if (!m) throw new Error(`around: không có cast \`${around.cast}\` trong cảnh`);
        const file = m.character ?? opt.fallback;
        const c = file ? opt.loadCharacter(file).character : rig.defaultCharacter();
        return rig.anchorAt(rt, around.cast, around.anchor ?? "root", t, c);
      }
    : null;
  const pad = around?.pad ?? 200;
  const box = around
    ? { x: -pad, y: -pad, w: 2 * pad, h: 2 * pad }
    : { x: -canvas.w / 2, y: -canvas.h / 2, w: canvas.w, h: canvas.h };
  const bg = opt.bg ?? PAPER;
  // `motion`: vệt khớp và bóng que xương vẽ đè trong cùng hệ chỗ vẽ, nét giữ cỡ trên ô dù zoom
  const sampler =
    (motion || skeleton) &&
    jointSampler(rt, (m) => {
      const file = m.character ?? opt.fallback;
      return file ? opt.loadCharacter(file).character : rig.defaultCharacter();
    });
  const warnings = new Set(sampler?.warnings);
  if (skeleton && !rt.lens)
    warnings.add("cảnh không có `scene.lens` — không có người 3D để vẽ que xương");
  const grid = skeleton ? floorGrid(rt) : [];
  const top = skeleton?.views?.includes("top");
  const boxesAt = (t) => {
    const out = solidBoxes(rt, t, { codeLayers: opt.codeLayers, url: opt.loadPiece });
    if (skeleton.world)
      try {
        out.push(...worldBoxes(skeleton.world, t));
      } catch (e) {
        warnings.add(`cảnh three ném lỗi ở giây ${t} — ${e.message}; bỏ hộp vật của nó`);
      }
    return out;
  };
  const cells = times.flatMap((t, i) => {
    const cam = rig.cameraAt(rt, t);
    const f = focus?.(t);
    const u = box.w / 300 / (f ? 1 : cam.zoom);
    const overlay =
      motion && motionOverlay(motionData(rt, { ...motion, t, sampler, only: motion.cast }), t, u);
    const boxes = skeleton && rt.lens ? boxesAt(t) : [];
    const paper = React.createElement("rect", {
      key: "paper",
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      fill: bg,
    });
    const fontSize = Math.min(34, box.w / 12);
    const tag = f
      ? `${t}s  ${around.cast}.${around.anchor ?? "root"}`
      : `${t}s${cam.zoom === 1 && !cam.x && !cam.y ? "" : `  ×${cam.zoom.toFixed(2)}`}`;
    // Ảnh three đã qua ống kính và khung cắt `cameraAt`: phủ cả ô, lớp phủ vẫn vẽ trong hệ chỗ vẽ như ô 2.5D
    if (three)
      return [
        [
          React.createElement("image", {
            key: "three",
            href: three.href[i],
            x: box.x,
            y: box.y,
            width: box.w,
            height: box.h,
            preserveAspectRatio: "none",
          }),
          ...(overlay
            ? [
                React.createElement(
                  "g",
                  { key: "world", transform: `scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})` },
                  overlay,
                ),
              ]
            : []),
          React.createElement("rect", {
            key: "tag",
            x: box.x + 8,
            y: box.y + 10,
            width: fontSize * 0.62 * tag.length + 16,
            height: fontSize * 1.35,
            fill: bg,
            opacity: 0.8,
          }),
          React.createElement(
            "text",
            {
              key: "t",
              x: box.x + 16,
              y: box.y + 46,
              fontSize,
              fontFamily: "monospace",
              fill: "#555",
            },
            tag,
          ),
        ],
      ];
    const main = [
      paper,
      React.createElement(
        "g",
        {
          key: "world",
          transform: f
            ? `translate(${(-f.x).toFixed(2)} ${(-f.y).toFixed(2)})`
            : `scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`,
        },
        ...(skeleton
          ? [
              floorOverlay({ grid, boxes, lens: rt.lens }, u),
              skeletonOverlay(skeletonData(rt, { t, sampler, only: skeleton.cast }), u),
            ]
          : [sceneWorld({ rt, t, cam, ...opt })]),
        // thêm con chỉ khi có lớp phủ: đổi cấu trúc cây là đổi `useId` của SVG
        ...(overlay ? [overlay] : []),
      ),
      // Ô rộng bằng cả khung sân khấu nên nhãn phải to hơn nhãn của dải ảnh thân người
      React.createElement(
        "text",
        {
          key: "t",
          x: box.x + 16,
          y: box.y + 46,
          fontSize,
          fontFamily: "monospace",
          fill: "#999",
        },
        tag,
      ),
      ...(skeleton ? [sideLegend(box)] : []),
    ];
    if (!top) return [main];
    const view = topView({
      rt,
      t,
      sampler,
      boxes,
      box,
      span: motion?.span,
      fps: motion?.fps,
      only: skeleton.cast,
    });
    const label = React.createElement(
      "text",
      { key: "t", x: box.x + 16, y: box.y + 46, fontSize, fontFamily: "monospace", fill: "#999" },
      `${t}s  từ trên: x →, z ↑`,
    );
    return [main, [paper, view, label, sideLegend(box)]];
  });
  const cols = (opt.cols ?? times.length) * (top ? 2 : 1);
  return { ...sheet(cells, { ...opt, bg, box, cols }), warnings: [...warnings] };
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

/** Món cầm tay mà `world.hands[].hold` của cảnh nhắc tới */
const heldItems = (scene) =>
  new Set(
    scene.cast.flatMap((m) =>
      (m.world?.hands ?? []).flatMap((k) =>
        [k.right?.hold, k.left?.hold]
          .filter(Boolean)
          .map((h) => rig.heldBase(rig.sceneHoldRef(h).item)),
      ),
    ),
  );

/**
 * Dải khung thật vẽ bằng three trong Chromium (`threeShots`): mỗi ô là ảnh của sân khấu mà Remotion vẽ — cảnh
 * `worldOf` của repo, không có thì `plainRoom()`. Vệt và bóng que xương (`motion`) đè lên như `renderFrames`.
 * Từng khung ghi ở thư mục cùng tên `out`; kết quả kèm `frames`, `gpu`, `from`, `ms` ({ boot, frame } trung vị)
 * và `warnings`. `data` là JSON đã parse của `threeData`. docs/04-mcp.md#ảnh-three-thật
 */
export async function renderThree({
  root = process.cwd(),
  id,
  scene,
  data,
  rt,
  times,
  size,
  software = false,
  out,
  scale,
  ...opt
}) {
  const px = threeSize(size, rt.frame);
  const shots = await threeShots({
    root,
    size: px,
    software,
    jobs: [{ id, scene, data: threeData(scene, data), times }],
  });
  const job = shots.jobs[0];
  const dir = out.replace(/\.png$/, "");
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith(".png")) rmSync(join(dir, f));
  const files = job.frames.map((f) => {
    const file = join(dir, `${f.t}s.png`);
    writeFileSync(file, f.png);
    return file;
  });
  const r = renderFrames({
    ...opt,
    rt,
    times,
    out,
    scale: scale ?? px.w / rt.frame.w,
    three: { href: files.map((f) => relative(dirname(out), f)) },
  });
  const warnings = [...job.warnings];
  if (job.from === "plain")
    warnings.push(
      "cảnh không có trong `worldOf` của `stickman.world` — vẽ trong `plainRoom()`; video chỉ vẽ cảnh three cho cảnh khai trong `CANH_3D`",
    );
  for (const m of scene.cast)
    if (m.world && !data.characters[m.character])
      warnings.push(
        `\`${m.id}\` không có nhân vật trong characters/ (\`${m.character ?? "—"}\`) — cảnh three không vẽ người này`,
      );
  const missing = [...heldItems(scene)].filter((x) => !job.provided.includes(x));
  if (missing.length)
    warnings.push(
      `món cầm tay không ai \`provide\` trong cảnh three: ${missing.join(", ")} — tay vẫn nắm, món không hiện (docs/03-scene.md#đồ-cầm-tay)`,
    );
  return {
    ...r,
    frames: files,
    gpu: shots.gpu,
    from: job.from,
    ms: { boot: Math.round(shots.boot), frame: Math.round(median(job.frames.map((f) => f.ms))) },
    warnings: [...warnings, ...r.warnings],
  };
}

/**
 * Người 3D một mình vẽ bằng three (`render_action` / `render_character` với `yaw`): mỗi ô `{ action, time, label }`
 * là cảnh tối thiểu của `solo3d` — cùng ống kính cúi `pitch`, người ở gốc quay `yaw`, ngồi thì trên ghế chuẩn — trong
 * `plainRoom()`, không qua `worldOf` của repo. `action` là một hay mảng hành động đã parse. Từng khung ghi ở thư mục
 * cùng tên `out`; kết quả như `sheet`, kèm `frames`, `gpu`, `ms`. docs/04-mcp.md#ảnh-three-thật
 */
export async function soloThree({
  root = process.cwd(),
  character,
  cells,
  yaw,
  pitch = 16,
  size,
  software = false,
  out,
  cols,
  scale = 0.5,
}) {
  const jobs = new Map();
  for (const [i, cell] of cells.entries()) {
    const acts = [cell.action].flat();
    const s = FX.solo3d({ character, yaw, pitch, action: acts, time: cell.time });
    const key = JSON.stringify([acts.map((a) => a.name), s.place]);
    let job = jobs.get(key);
    if (!job) {
      const scene = rig.parseScene({
        schemaVersion: rig.SCENE_VERSION,
        name: "solo3d",
        lens: s.world.lens,
        cast: [
          {
            id: "a",
            character: "solo.json",
            world: s.place,
            tracks: acts.map((a, k) => ({
              clips: [{ action: `a${k}`, start: 0, cycle: a.duration }],
            })),
          },
        ],
      });
      if (!scene.success) throw new Error(`solo3d: ${scene.error.message}`);
      const data = {
        characters: { "solo.json": character },
        actions: Object.fromEntries(acts.map((a, k) => [`a${k}`, a])),
      };
      job = {
        cells: [],
        run: {
          id: "solo3d",
          scene: scene.data,
          data: threeData(scene.data, data),
          plain: true,
          furniture: s.furniture ?? [],
          times: [],
        },
      };
      jobs.set(key, job);
    }
    job.cells.push(i);
    job.run.times.push(cell.time);
  }
  const frame = rig.FRAMES.wide;
  const px = threeSize(size, frame);
  const list = [...jobs.values()];
  const shots = await threeShots({ root, size: px, software, jobs: list.map((j) => j.run) });
  const pngs = [];
  list.forEach((j, k) => shots.jobs[k].frames.forEach((f, n) => (pngs[j.cells[n]] = f)));
  const dir = out.replace(/\.png$/, "");
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith(".png")) rmSync(join(dir, f));
  const files = pngs.map((f, i) => {
    const file = join(dir, `${String(i).padStart(2, "0")}.png`);
    writeFileSync(file, f.png);
    return file;
  });
  const box = { x: 0, y: 0, w: px.w, h: px.h };
  const fontSize = Math.max(14, px.w / 40);
  const r = sheet(
    files.map((file, i) => [
      React.createElement("image", {
        key: "three",
        href: relative(dirname(out), file),
        x: 0,
        y: 0,
        width: px.w,
        height: px.h,
      }),
      React.createElement(
        "text",
        { key: "t", x: 12, y: 12 + fontSize, fontSize, fontFamily: "monospace", fill: "#555" },
        cells[i].label,
      ),
    ]),
    { cols, box, scale, out },
  );
  return {
    ...r,
    frames: files,
    gpu: shots.gpu,
    ms: {
      boot: Math.round(shots.boot),
      frame: Math.round(median(pngs.map((f) => f.ms))),
    },
  };
}
