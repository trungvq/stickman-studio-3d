#!/usr/bin/env node
// Các chế độ:
//   <nhân-vật.json> --yaw <độ> [--pitch 16] [--action <tên,…>] [--at <giây>]
//               người 3D một mình bằng three thật trong plainRoom(): hành động diễn tới giây `--at`,
//               nhiều tên là nhiều track chồng — ngồi thì có ghế chuẩn; [--size 1280] [--software]
//   --scene   — mỗi ô một mốc thời gian, ảnh three thật mà video vẽ (Chromium headless): cảnh `worldOf`
//               của `stickman.world`, không có thì `plainRoom()`; [--size 1280x720] [--software];
//               cảnh không có `scene.lens` thì mỗi ô là khung nền, lớp vẽ code và hiệu ứng
//               --times 0,1.5,3 chỉ đích danh mốc; --trails wristR,feet,… [--span 1] [--fps 30]
//               [--relative] [--cast id] vẽ vệt khớp trong ±span giây quanh mỗi ô; --ghosts 3
//               [--ghost-step 0.1] vẽ bóng que xương; từng khung PNG nằm ở thư mục cùng tên --out
//   --skeleton — chỉ người 3D: lưới sàn, viền hộp đồ khối, que xương hai màu bên; --views top thêm ô
//               nhìn từ trên xuống; nhận cả cờ vệt
//   có cờ vệt hay --skeleton thì stdout là phần chữ kèm ảnh, đường dẫn PNG in ra stderr
// Xem docs/04-mcp.md#ảnh-three-thật.
import { basename, relative, resolve } from "node:path";
import * as rig from "@stickman3d/rig/core";
import {
  cliModule,
  commonLayer,
  findIn,
  layers,
  loadLayers,
  loadScene,
  loadWorld,
  mountBg,
  mountPiece,
  readJson,
  renderFrames,
  renderThree,
  sampleTimes,
  soloThree,
} from "./lib.mjs";

const CWD = process.cwd();
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? dflt : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);
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

// `pieces/`, `actions/` và `characters/` của workspace, bộ chung làm lớp dưới
const common = await commonLayer(CWD);

const piecesDirs = layers(resolve(CWD, flag("pieces", "pieces")), null);
const actionsDirs = layers(resolve(CWD, flag("actions", "actions")), common?.actions);
const charsDirs = layers(resolve(CWD, flag("characters", "characters")), common?.characters);
const heldDirs = layers(resolve(CWD, flag("held", "held")), common?.held);
const handsDirs = layers(resolve(CWD, flag("hands", "hands")), common?.hands);

// Vệt khớp và bóng que xương; không cờ nào thì ảnh y như không có lớp phủ
const motionFlags = () => {
  if (!has("trails") && !has("ghosts") && !has("skeleton")) return undefined;
  const num = (name, dflt, ok) => {
    const v = Number(flag(name, dflt));
    if (!ok(v)) die(`--${name} không hợp lệ: ${flag(name)}`);
    return v;
  };
  let snap;
  try {
    snap = readJson(resolve(CWD, "package.json"))?.stickman?.snap;
  } catch {
    /* không có package.json */
  }
  const fps = snap?.fps ?? 30;
  return {
    trails: flag("trails"),
    relative: has("relative"),
    ghosts: num("ghosts", 0, (v) => Number.isInteger(v) && v >= 0 && v <= 12),
    ghostStep: num("ghost-step", 0.1, (v) => v > 0),
    span: num("span", 1, (v) => v > 0),
    fps: num("fps", fps, (v) => v > 0 && v <= 240),
    cast: flag("cast"),
    // ngưỡng giật của `check`, `stickman.snap` — docs/03-scene.md#giật-trên-hình
    snap: { px: snap?.px, k: snap?.k },
  };
};

const VIEWS = ["top"];
const skeletonFlags = async (data, rt) => {
  if (!has("skeleton")) return undefined;
  const views = flag("views")?.split(",").filter(Boolean);
  const bad = views?.find((v) => !VIEWS.includes(v));
  if (bad) die(`--views lạ: ${bad} — có ${VIEWS.join(", ")}`);
  return { cast: flag("cast"), views, world: await worldOn(data, rt) };
};

// Cảnh three `stickman.world` của repo để vẽ hộp vật; không khai hay dựng hỏng thì bỏ, kèm một dòng
async function worldOn(data, rt) {
  const world = await loadWorld(CWD).catch((e) => console.error(`stickman.world: ${e.message}`));
  if (!world) return undefined;
  const cli = await cliModule(CWD);
  if (!cli?.worldScene) return void console.error("stickman.world: không thấy @stickman3d/cli");
  const id = basename(flag("scene")).replace(/\.json$/, "");
  const data3 = { id, scene: data, runtime: rt, ...cli.worldData(CWD) };
  const on = cli.worldScene(world, data3, relative(CWD, flag("scene")));
  if (on?.error) console.error(`${on.error} — bỏ hộp vật của cảnh three`);
  return on && !on.error ? on : undefined;
}

// `ctx` của `worldOf` cho trang three: dữ liệu hai lớp của `check`, không có CLI thì chỉ thứ cảnh nhắc tới
async function threeInput(scene) {
  const cli = await cliModule(CWD);
  if (cli?.worldData) return cli.worldData(CWD);
  const { actions, held, hands } = loadScene(scene, actionsDirs, charsDirs, heldDirs, handsDirs);
  const characters = {};
  for (const m of scene.cast) {
    if (!m.character || characters[m.character]) continue;
    const c = rig.parseCharacter(json(findIn(charsDirs, m.character)));
    if (!c.success) die(`${m.character}: ${c.error.message}`);
    characters[m.character] = c.data;
  }
  return { characters, actions, held, hands };
}

// Có lớp phủ thì stdout chỉ là phần chữ kèm ảnh (cách đọc, bảng sự kiện, số đo), đường dẫn PNG sang stderr —
// docs/04-mcp.md#người-3d
function printOut(r) {
  if (!r.guide) return console.log(r.out);
  console.error(r.out);
  console.log(r.guide);
}

const num = (name, dflt) => {
  const v = Number(flag(name, dflt));
  if (!Number.isFinite(v)) die(`--${name} phải là số: ${flag(name)}`);
  return v;
};

try {
  if (has("scene")) {
    const parsed = rig.parseScene(json(flag("scene")));
    if (!parsed.success) die(parsed.error.message);
    // Đo `aspect` từng lớp nền trước `resolveScene` — số khai trong JSON chỉ là cái đệm lần trước
    const bgUrls = mountBg(parsed.data, layers(resolve(CWD, flag("bgdir", "assets/bg")), null));
    const { rt } = loadScene(parsed.data, actionsDirs, charsDirs, heldDirs, handsDirs);
    const skeleton = has("skeleton");
    const three = !skeleton && !!parsed.data.lens;
    const chars = {};
    const common = {
      rt,
      // Lớp vẽ code của repo, nếu `package.json` khai `stickman.layers` — docs/10-lop-ve-code.md
      codeLayers: await loadLayers(CWD),
      fallback: flag("character"),
      times: flag("times")
        ? flag("times").split(",").map(Number)
        : sampleTimes({
            from: Number(flag("from", 0)),
            to: Number(flag("to", rt.duration)),
            cols: Number(flag("cols", 12)),
            every: flag("every") ? Number(flag("every")) : undefined,
          }),
      loadCharacter: (file) => {
        if (chars[file]) return chars[file];
        const c = rig.parseCharacter(json(findIn(charsDirs, file)));
        if (!c.success) die(`${file}: ${c.error.message}`);
        return (chars[file] = { character: c.data });
      },
      loadPiece: (file) => mountPiece(file, piecesDirs),
      bg: flag("bg"),
      out: resolve(
        CWD,
        flag(
          "out",
          skeleton
            ? "tmp/scene-skeleton.png"
            : three
              ? "tmp/scene-three.png"
              : "tmp/scene-frames.png",
        ),
      ),
    };
    if (three) {
      const r = await renderThree({
        ...common,
        root: CWD,
        id: basename(flag("scene")).replace(/\.json$/, ""),
        scene: parsed.data,
        data: await threeInput(parsed.data),
        size: flag("size"),
        software: has("software"),
        scale: flag("scale") === undefined ? undefined : Number(flag("scale")),
        cols: Number(flag("cols", 4)),
        motion: motionFlags(),
      });
      for (const w of r.warnings) console.error(w);
      console.error(
        `three: ${r.gpu} — mở trang ${r.ms.boot} ms, ${r.ms.frame} ms/khung; từng khung ở ${relative(CWD, r.frames[0] ?? r.out)}`,
      );
      printOut(r);
      process.exit(0);
    }
    const r = renderFrames({
      ...common,
      bgUrls,
      scale: Number(flag("scale", 0.3)),
      cols: Number(flag("cols", 4)),
      motion: motionFlags(),
      skeleton: await skeletonFlags(parsed.data, rt),
    });
    for (const w of r.warnings ?? []) console.error(w);
    printOut(r);
  } else {
    const charPath = args.find((a) => !a.startsWith("--") && a.endsWith(".json"));
    if (!charPath)
      die(
        "dùng: stickman-render <character.json> [--yaw 60] [--pitch 16] [--action stand-3d[,type-3d]]" +
          " [--at 0.5] [--size 1280] [--software] [--scale 1] [--out tmp/rig-three.png]\n" +
          "  hoặc: stickman-render --scene canh.json [--times 0,1.5|--from 0 --to 3 --cols 12 --every 0.25]" +
          " [--size 1280x720] [--cols 4] [--software] [--character sample-man.json]\n" +
          "  vệt chuyển động: [--trails hands,feet,head|all|wristR,…] [--span 1] [--fps 30]" +
          " [--relative] [--ghosts 3] [--ghost-step 0.1] [--cast but]\n" +
          "  que xương người 3D: stickman-render --scene canh.json --skeleton [--views top]",
      );
    const parsed = rig.parseCharacter(json(charPath));
    if (!parsed.success) die(parsed.error.message);
    // `sit-3d,type-3d`: mỗi tên một track, chồng lên nhau theo thứ tự như trong cảnh
    const names = flag("action", "stand-3d");
    const action = names.split(",").map((name) => {
      const a = rig.parseAction(json(findIn(actionsDirs, `${name}.json`)));
      if (!a.success) die(`${name}: ${a.error.message}`);
      return a.data;
    });
    const r = await soloThree({
      root: CWD,
      character: parsed.data,
      handsDirs,
      cells: [{ action, time: num("at", 0), label: `${names} ${num("at", 0)}s` }],
      yaw: num("yaw", 60),
      pitch: num("pitch", 16),
      size: flag("size"),
      software: has("software"),
      scale: Number(flag("scale", 1)),
      out: resolve(CWD, flag("out", "tmp/rig-three.png")),
    });
    console.error(`three: ${r.gpu} — mở trang ${r.ms.boot} ms, ${r.ms.frame} ms/khung`);
    console.log(r.out);
  }
} catch (e) {
  die(e.message);
}
