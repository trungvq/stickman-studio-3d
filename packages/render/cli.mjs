#!/usr/bin/env node
// Ba chế độ:
//   mặc định  — cắm mảnh thật trong JSON, để soi việc căn dx/dy/scale
//               --view/--head-view (front|quarter|side|rear|back) đổi góc nhìn thân và đầu
//               --yaw <độ> [--pitch 16] vẽ người 3D một mình qua ống kính cúi; --action <tên,…>
//               [--at <giây>] diễn hành động, nhiều tên là nhiều track chồng — ngồi thì có ghế chuẩn
//   --boxes   — hai khung: rig trần + khối đánh dấu chỗ từng mảnh, dùng làm reference lúc gen
//   --scene   — dải ảnh một cảnh, mỗi ô một mốc thời gian, mỗi hàng một nhân vật
//               góc nhìn lấy từ cast[].view của chính cảnh, không có cờ
//   --stage   — cùng thế nhưng mỗi ô là cả khung: có nền, có camera, có chỗ đứng
//               --times 0,1.5,3 chỉ đích danh mốc; --around <cast> [--anchor root] [--pad 200]
//               cắt mỗi ô quanh một mốc anchorAt của người ấy, đơn vị sân khấu
// Xem docs/02-trang-phuc.md và docs/03-scene.md.
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
  mountPiece,
  mountProp,
  poseOf,
  readJson,
  renderBoxes,
  renderFrames,
  renderPoses,
  renderScene,
  sampleTimes,
  solo3d,
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
const viewFlag = (name) => {
  const v = flag(name);
  if (v !== undefined && !rig.VIEWS.includes(v))
    die(`góc nhìn lạ: ${v} — có ${rig.VIEWS.join(", ")}`);
  return v;
};
const json = (p) => {
  try {
    return readJson(resolve(CWD, p));
  } catch (e) {
    die(`không đọc được ${resolve(CWD, p)} — ${e.message}`);
  }
};

// `pieces/`, `actions/`, `animals/` và `characters/` của workspace, bộ chung của studio làm lớp dưới
const common = await commonLayer(CWD);

// Bộ phận vẽ code của repo, nếu `package.json` khai `stickman.parts` — docs/02-trang-phuc.md
try {
  await loadParts(CWD);
} catch (e) {
  die(e.message);
}
const piecesDirs = layers(resolve(CWD, flag("pieces", "pieces")), common?.pieces);
const actionsDirs = layers(resolve(CWD, flag("actions", "actions")), common?.actions);
const animalsDirs = layers(resolve(CWD, flag("animals", "animals")), common?.animals);
const charsDirs = layers(resolve(CWD, flag("characters", "characters")), common?.characters);
const heldDirs = layers(resolve(CWD, flag("held", "held")), common?.held);

// Xoè tay để hai mảnh vai áo tách khỏi thân; xa dương, gần âm
const spread = (p, arms) => ({
  ...p,
  pose: { ...p.pose, af: [arms, p.pose.af[1], 0], an: [-arms, p.pose.an[1], 0] },
});

try {
  if (has("scene")) {
    if (has("view") || has("head-view"))
      die("góc nhìn của cảnh nằm ở `cast[].view` / `cast[].headView` — bỏ `--view`");
    const parsed = rig.parseScene(json(flag("scene")));
    if (!parsed.success) die(parsed.error.message);
    // Đo `aspect` từng lớp nền trước `resolveScene` — số khai trong JSON chỉ là cái đệm lần trước
    const bgUrls = mountBg(parsed.data, layers(resolve(CWD, flag("bgdir", "assets/bg")), null));
    const propsDir = resolve(CWD, flag("props", "props"));
    const { rt, animals } = loadScene(
      parsed.data,
      actionsDirs,
      animalsDirs,
      [propsDir],
      charsDirs,
      heldDirs,
    );

    const props = {};
    const beasts = {};
    const common = {
      rt,
      // Lớp vẽ code của repo, nếu `package.json` khai `stickman.layers` — docs/10-lop-ve-code.md
      codeLayers: has("stage") ? await loadLayers(CWD) : [],
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
        const c = rig.parseCharacter(json(findIn(charsDirs, file)));
        if (!c.success) die(`${file}: ${c.error.message}`);
        return { character: c.data, urls: mount(c.data, piecesDirs) };
      },
      loadProp: (file) => {
        if (props[file]) return props[file];
        const p = rig.parseProp(json(resolve(propsDir, file)));
        if (!p.success) die(`${file}: ${p.error.message}`);
        return (props[file] = { prop: p.data, url: mountProp(p.data, piecesDirs) });
      },
      // `loadScene` đã parse xong con vật; ở đây chỉ nhúng ảnh
      loadAnimal: (file) =>
        (beasts[file] ??= { animal: animals[file], urls: mountAnimal(animals[file], piecesDirs) }),
      loadPiece: (file) => mountPiece(file, piecesDirs),
      bg: flag("bg"),
      out: resolve(CWD, flag("out", has("stage") ? "tmp/scene-frames.png" : "tmp/scene-strip.png")),
    };
    const r = has("stage")
      ? renderFrames({
          ...common,
          bgUrls,
          around: flag("around")
            ? {
                cast: flag("around"),
                anchor: flag("anchor", "root"),
                pad: Number(flag("pad", 200)),
              }
            : undefined,
          scale: Number(flag("scale", flag("around") ? 1 : 0.3)),
          cols: Number(flag("cols", 4)),
        })
      : renderScene({
          ...common,
          only: flag("cast"),
          scale: Number(flag("scale", 1)),
          crop: flag("crop", "full"),
        });
    console.log(r.out);
  } else {
    const charPath = args.find((a) => !a.startsWith("--") && a.endsWith(".json"));
    if (!charPath)
      die(
        "dùng: stickman-render <character.json> --out tmp/ref.png" +
          " [--boxes] [--pieces pieces] [--pose idle] [--arms 22]" +
          " [--view front|quarter|side|rear|back] [--head-view front|quarter|side|rear|back]" +
          " [--bg '#FF00FF'] [--scale 2] [--crop full|head|torso]\n" +
          "  người 3D: stickman-render <character.json> --yaw 45 [--pitch 16]" +
          " [--action sit-3d[,type-3d] [--at 0.5]] [--pose idle]\n" +
          "  hoặc: stickman-render --scene canh.json --out tmp/strip.png" +
          " [--stage] [--cast but] [--actions actions] [--characters characters]" +
          " [--props props] [--animals animals] [--bgdir assets/bg] [--character ink.json]" +
          " [--from 0] [--to 3] [--cols 12] [--every 0.25]",
      );
    const parsed = rig.parseCharacter(json(charPath));
    if (!parsed.success) die(parsed.error.message);
    const character = parsed.data;
    const boxes = has("boxes");
    const opt = {
      character,
      view: viewFlag("view"),
      headView: viewFlag("head-view"),
      bg: flag("bg"),
      scale: Number(flag("scale", 2)),
      crop: flag("crop", "full"),
      out: resolve(CWD, flag("out", boxes ? "tmp/rig-reference.png" : "tmp/rig-fit.png")),
    };
    const num = (name, dflt) => {
      const v = Number(flag(name, dflt));
      if (!Number.isFinite(v)) die(`--${name} phải là số: ${flag(name)}`);
      return v;
    };
    const yaw = flag("yaw") === undefined ? undefined : num("yaw");
    if (has("action") && yaw === undefined) die("`--action` chỉ đi với `--yaw`");
    if (has("action") && !flag("action"))
      die("`--action` cần tên hành động: --action sit-3d,type-3d");
    if (boxes && yaw !== undefined) die("`--boxes` không đi với `--yaw`");
    let cell = poseOf(flag("pose", "idle"));
    if (yaw === undefined) cell = spread(cell, Number(flag("arms", 22)));
    else {
      // Người 3D một mình qua ống kính cúi `--pitch`: hành động diễn tới giây `--at`, còn tư thế
      // rời giữ kênh 2D; view, headView, flip suy từ theta nên `--view` không còn nghĩa
      if (has("view") || has("head-view"))
        die("có `--yaw` thì góc nhìn suy từ theta — bỏ `--view`");
      // `sit-3d,type-3d`: mỗi tên một track, chồng lên nhau theo thứ tự như trong cảnh
      const action = flag("action")
        ?.split(",")
        .map((name) => {
          const a = rig.parseAction(json(findIn(actionsDirs, `${name}.json`)));
          if (!a.success) die(`${name}: ${a.error.message}`);
          return a.data;
        });
      const s = solo3d({
        character,
        yaw,
        pitch: num("pitch", 16),
        action,
        time: num("at", 0),
        pose: action ? undefined : cell.pose,
      });
      cell = action
        ? s
        : { ...cell, flip: s.flip, view: s.view, headView: s.headView, world: s.world };
    }
    const r = boxes
      ? renderBoxes({ ...opt, poseName: flag("pose", "idle"), arms: Number(flag("arms", 22)) })
      : renderPoses({
          ...opt,
          urls: mount(character, piecesDirs),
          poses: [cell],
          labels: false,
        });
    console.log(r.out);
  }
} catch (e) {
  die(e.message);
}
