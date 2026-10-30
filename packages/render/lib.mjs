// Ảnh soi của MCP server: khung three thật qua Chromium headless, que xương người 3D trên lưới sàn, lớp
// vẽ code và hiệu ứng, ghép tờ bằng `rsvg-convert`. Mọi đường dẫn tính từ `cwd`, nên chạy được trong repo video.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as rig from "@stickman3d/rig/core";
import * as FX from "@stickman3d/fx";
import { jointSampler, motionData, motionOverlay, motionText, numberEvents } from "./trails.mjs";
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

export { layersEntry, loadLayers, loadWorld, worldEntry } from "./layers.mjs";
export {
  BONE_SEGS,
  jointSampler,
  motionData,
  motionOverlay,
  motionText,
  numberEvents,
  TRAIL_EVENT,
  TRAIL_NAMES,
  trailEvents,
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

export const PAPER = "#f4f1e8";
export const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Bộ chung đi theo package (hành động, nhân vật, món cầm tay, dáng tay) — `COMMON` của `@stickman3d/cli`, cài cùng

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

/** Các lớp nền: nhúng data URI và đo `aspect` từ chính file. Khoá theo tên file */
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

/** Một file trong `pieces/` thành data URI — cho hiệu ứng vẽ vật rời tay (`fxFiles`); không có thì `undefined` */
export function mountPiece(file, piecesDirs) {
  try {
    return `data:image/png;base64,${readFileSync(findIn(piecesDirs, file)).toString("base64")}`;
  } catch {
    return undefined;
  }
}

/** Ghép các ô thành một tấm rồi gọi `rsvg-convert` đúng một lần. Trả về đường dẫn PNG. */
export function sheet(cells, { cols, bg = PAPER, scale = 1, out, box: VB }) {
  cols = Math.max(1, Math.min(cols ?? cells.length, cells.length));
  const rows = Math.ceil(cells.length / cols);
  const w = VB.w * cols;
  const h = VB.h * rows;
  // Mỗi ô cắt đúng khung của nó, không tràn sang ô bên
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

/**
 * Dáng tay của thư viện tên `names` (`world.hands[].pose`, `keys[].hand` của hành động), tra trong các lớp `handsDirs`;
 * dáng có sẵn của rig và tên không có file thì bỏ, file hỏng thì ném
 */
export function handShapesIn(names, handsDirs) {
  const hands = {};
  for (const name of names) {
    if (!name || name in rig.HAND_POSES || name in hands) continue;
    let path;
    try {
      path = findIn(handsDirs, `${name}.json`);
    } catch {
      continue;
    }
    const r = rig.parseHandShape(readJson(path));
    if (!r.success) throw new Error(`${name}.json: ${r.error.message}`);
    hands[name] = r.data;
  }
  return hands;
}

/**
 * Nạp mọi hành động mà scene nhắc tới rồi `resolveScene`; mỗi `*Dirs` là
 * các lớp, xem `layers`. `charactersDirs` cho `rt.heights` và `rt.bodies`; `heldDirs` cho món cầm tay của `world.hands[].hold`, `handsDirs` cho
 * dáng tay của thư viện mà `world.hands[].right|left.pose` và `keys[].hand` của hành động gọi. Thiếu file thì để trống,
 * chỗ vẽ báo sau.
 */
export function loadScene(scene, actionsDirs, charactersDirs = [], heldDirs = [], handsDirs = []) {
  const actions = {};
  const need = (name) => {
    if (!name || actions[name]) return;
    const a = rig.parseAction(readJson(findIn(actionsDirs, `${name}.json`)));
    if (!a.success) throw new Error(`${name}: ${a.error.message}`);
    actions[name] = a.data;
  };
  for (const c of scene.cast)
    for (const t of c.tracks) for (const clip of t.clips) need(clip.action);
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
  const heights = {};
  const bodies = {};
  const chars = {};
  for (const m of scene.cast) {
    const c = m.character && maybe(charactersDirs, m.character, rig.parseCharacter);
    if (c) [heights[m.id], bodies[m.id], chars[m.id]] = [c.rig.height, rig.body3(c), c];
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
  const hands = handShapesIn(
    [
      ...scene.cast.flatMap((m) =>
        (m.world?.hands ?? []).flatMap((k) => [k.right?.pose, k.left?.pose]),
      ),
      ...Object.values(actions).flatMap(rig.actionHandShapes),
    ],
    handsDirs,
  );
  const rt = rig.resolveScene(scene, actions, heights, bodies, held, hands);
  // mốc món `rest` tra tay người thả ở `rt.chars`
  rt.chars = { ...chars, ...rt.chars };
  // `scene.fx` qua zod của @stickman3d/fx ngay lúc nạp — rig chỉ mang nó theo
  FX.sceneFx(rt);
  return { actions, held, hands, rt };
}

/** Các mốc thời gian đều nhau trong `[from, to]` */
export function sampleTimes({ from = 0, to, cols = 12, every }) {
  const step = every ?? (to - from) / Math.max(1, cols - 1);
  const times = [];
  for (let t = from; t <= to + 1e-9 && times.length < 200; t += Math.max(step, 1e-6))
    times.push(+t.toFixed(3));
  return times;
}

/**
 * Nền, lớp vẽ code và hiệu ứng của cảnh tại `t`: `<SceneWorld>` của `@stickman3d/fx` — cùng component mà
 * app Remotion vẽ cho cảnh không dựng bằng three. Ở đây chỉ đổi bộ nạp của render sang hợp đồng của nó;
 * `fallback` là nhân vật cho `cast` không khai (mốc bám người).
 */
export function sceneWorld({
  rt,
  loadCharacter,
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
      return file ? loadCharacter(file) : undefined;
    },
  });
}

/**
 * Dải **khung thật**: mỗi ô là cả khung tại một mốc, có nền và có camera. `three: { href }` là ảnh three
 * của từng ô (`renderThree`), không có thì ô vẽ nền, lớp vẽ code và hiệu ứng (`sceneWorld`). Camera vào bằng
 * `scale(zoom) translate(−tâm)` nên ô nào cũng cùng một hộp, zoom khác nhau vẫn xếp thẳng hàng. docs/03-scene.md#camera
 *
 * `skeleton: { cast?, views?, world? }` thay nền và lớp vẽ code bằng que xương người 3D trên lưới
 * sàn (`views: ["top"]` thêm ô nhìn từ trên xuống, `world` là `worldScene` của cli để vẽ hộp vật cảnh
 * three). Kết quả kèm `warnings`. docs/04-mcp.md#người-3d
 */
export function renderFrames({ rt, times, canvas = rt.frame, motion, skeleton, three, ...opt }) {
  if (three && skeleton) throw new Error("ảnh three không đi với `skeleton`");
  const box = { x: -canvas.w / 2, y: -canvas.h / 2, w: canvas.w, h: canvas.h };
  const bg = opt.bg ?? PAPER;
  // `motion`: vệt khớp và bóng que xương vẽ đè trong cùng hệ chỗ vẽ, nét giữ cỡ trên ô dù zoom
  const sampler =
    (motion || skeleton) &&
    jointSampler(rt, (m) => {
      const file = m.character ?? opt.fallback;
      return file ? opt.loadCharacter(file).character : rig.defaultCharacter();
    });
  const warnings = new Set();
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
  const fontSize = Math.min(34, box.w / 12);
  // Lớp phủ chuyển động: nhãn ô nằm trên một dải riêng phía trên khung, không đè lên người
  const band = motion || skeleton ? Math.round(fontSize * 1.6) : 0;
  const cell = band ? { ...box, y: box.y - band, h: box.h + band } : box;
  const baseline = box.y - band * 0.3;
  // số sự kiện đánh cho cả tờ trước khi vẽ ô nào: cùng sự kiện ở nhiều ô cùng số
  const moves = motion
    ? times.map((t) => ({ t, data: motionData(rt, { ...motion, t, sampler, only: motion.cast }) }))
    : [];
  if (motion) numberEvents(moves, motion.fps);
  const cells = times.flatMap((t, i) => {
    const cam = rig.cameraAt(rt, t);
    const u = box.w / 300 / cam.zoom;
    const data = moves[i]?.data;
    const bounds = {
      x: cam.x + box.x / cam.zoom,
      y: cam.y + box.y / cam.zoom,
      w: box.w / cam.zoom,
      h: box.h / cam.zoom,
    };
    const overlay =
      data &&
      motionOverlay(data, t, u, {
        fps: motion.fps,
        px: (opt.scale ?? 1) * cam.zoom,
        bounds,
      });
    const boxes = skeleton && rt.lens ? boxesAt(t) : [];
    const paper = React.createElement("rect", {
      key: "paper",
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      fill: bg,
    });
    const spanTag = data?.some((P) => P.lines.length)
      ? `  vệt ${data[0].window.map((v) => +v.toFixed(2)).join("→")}s`
      : "";
    const tag = `${t}s${cam.zoom === 1 && !cam.x && !cam.y ? "" : `  ×${cam.zoom.toFixed(2)}`}${spanTag}`;
    const label = (key, text, fill) =>
      React.createElement(
        "text",
        {
          key,
          x: box.x + 16,
          y: band ? baseline : box.y + 46,
          // dải nhãn: chữ co cho vừa bề ngang ô, chừa chỗ cho hai màu bên của que xương
          fontSize: band
            ? +Math.min(fontSize, (box.w * (skeleton ? 0.6 : 0.95)) / (0.62 * text.length)).toFixed(
                2,
              )
            : fontSize,
          fontFamily: "monospace",
          fill,
        },
        text,
      );
    const legend = skeleton ? [sideLegend(box, baseline, fontSize * 0.8)] : [];
    // Ảnh three đã qua ống kính và khung cắt `cameraAt`: phủ cả ô, lớp phủ vẽ trong hệ chỗ vẽ
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
          ...(band
            ? []
            : [
                React.createElement("rect", {
                  key: "tag",
                  x: box.x + 8,
                  y: box.y + 10,
                  width: fontSize * 0.62 * tag.length + 16,
                  height: fontSize * 1.35,
                  fill: bg,
                  opacity: 0.8,
                }),
              ]),
          label("t", tag, "#555"),
        ],
      ];
    const main = [
      paper,
      React.createElement(
        "g",
        {
          key: "world",
          transform: `scale(${cam.zoom}) translate(${-cam.x} ${-cam.y})`,
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
      label("t", tag, band ? "#555" : "#999"),
      ...legend,
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
    return [main, [paper, view, label("t", `${t}s  từ trên: x →, z ↑`, "#555"), ...legend]];
  });
  const cols = (opt.cols ?? times.length) * (top ? 2 : 1);
  const guide =
    motion && motionText(moves, { ...motion, rt, skeleton: !!skeleton, video: rt.frame.video.w });
  return {
    ...sheet(cells, { ...opt, bg, box: cell, cols }),
    warnings: [...warnings],
    ...(guide ? { guide } : {}),
  };
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
    if (!data.characters[m.character])
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
 * Tờ ảnh three: PNG `pngs[i]` (Buffer; `null` là ô trống chỉ có chữ) ghi từng khung vào thư mục cùng tên `out`, ghép
 * thành tờ `cols` cột, mỗi ô kèm nhãn `labels[i]` ở góc trên trái — một chuỗi, hay danh sách dòng `{ text, fill? }`;
 * `band` thì nhãn nằm trên dải riêng phía trên ảnh, cao theo ô nhiều dòng nhất. Trả như `sheet` kèm `frames` là các file
 * khung
 */
export function frameSheet(pngs, labels, { size, cols, scale = 0.5, out, band = false }) {
  const dir = out.replace(/\.png$/, "");
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith(".png")) rmSync(join(dir, f));
  const files = pngs.map((png, i) => {
    if (!png) return null;
    const file = join(dir, `${String(i).padStart(2, "0")}.png`);
    writeFileSync(file, png);
    return file;
  });
  const fontSize = Math.max(14, size.w / 40);
  const listOf = (label) => (typeof label === "string" ? [{ text: label }] : (label ?? []));
  const most = Math.max(1, ...labels.map((l) => listOf(l).length));
  const top = band ? Math.ceil(fontSize * (1.25 * most + 0.8)) : 0;
  const box = { x: 0, y: 0, w: size.w, h: size.h + top };
  const lines = (label) =>
    listOf(label).map((l, k) =>
      React.createElement(
        "text",
        {
          key: `t${k}`,
          x: 12,
          y: 12 + fontSize + fontSize * 1.25 * k,
          fontSize,
          fontFamily: "monospace",
          fill: l.fill ?? "#555",
        },
        l.text,
      ),
    );
  const r = sheet(
    files.map((file, i) => [
      file &&
        React.createElement("image", {
          key: "three",
          href: relative(dirname(out), file),
          x: 0,
          y: top,
          width: size.w,
          height: size.h,
        }),
      ...lines(labels[i]),
    ]),
    { cols, box, scale, out },
  );
  return { ...r, frames: files.filter(Boolean) };
}

/**
 * Người 3D một mình vẽ bằng three (`render_action` / `render_character` với `yaw`): mỗi ô `{ action, time, label }`
 * là cảnh tối thiểu của `solo3d` — cùng ống kính cúi `pitch`, người ở gốc quay `yaw`, ngồi thì trên ghế chuẩn — trong
 * `plainRoom()`, không qua `worldOf` của repo. `action` là một hay mảng hành động đã parse; `handsDirs` là các lớp
 * `hands/` cho dáng tay của thư viện mà hành động gọi. Từng khung ghi ở thư mục cùng tên `out`; kết quả như `sheet`,
 * kèm `frames`, `gpu`, `ms`. docs/04-mcp.md#ảnh-three-thật
 */
export async function soloThree({
  root = process.cwd(),
  character,
  handsDirs = [],
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
        hands: handShapesIn(acts.flatMap(rig.actionHandShapes), handsDirs),
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
  const r = frameSheet(
    pngs.map((f) => f.png),
    cells.map((c) => c.label),
    { size: px, cols, scale, out },
  );
  return {
    ...r,
    gpu: shots.gpu,
    ms: {
      boot: Math.round(shots.boot),
      frame: Math.round(median(pngs.map((f) => f.ms))),
    },
  };
}
