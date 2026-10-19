#!/usr/bin/env node
// MCP server (stdio) cho agent dựng nhân vật / hành động / scene rồi soi bằng ảnh.
// Server là tay và mắt: liệt kê, kiểm qua zod của rig, ghi JSON, vẽ PNG ra đĩa.
// Không có bước "tạo từ mô tả" — đó là việc của model gọi tool. Xem tool `docs`, file 04.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? dflt : args[i + 1];
};
const WS = resolve(process.cwd(), flag("workspace", "."));
const OUT = resolve(WS, flag("out", "tmp/mcp"));
/** Thư mục của workspace — nơi ghi */
const DIRS = {
  characters: resolve(WS, "characters"),
  actions: resolve(WS, "actions"),
  scenes: resolve(WS, "scenes"),
  props: resolve(WS, "props"),
  animals: resolve(WS, "animals"),
  held: resolve(WS, "held"),
  pieces: resolve(WS, "pieces"),
  bg: resolve(WS, "assets/bg"),
};
const layerName = (kind, dir) => (dir === DIRS[kind] ? "workspace" : "common");
const KINDS = ["characters", "actions", "scenes", "props", "animals", "held"];

/**
 * Bộ `@stickman3d/*` nạp từ `node_modules` của chính workspace — đúng bản nó đã pin — và nạp
 * lại khi version trên đĩa đổi giữa phiên: mỗi lượt gọi tool đi qua `refresh()` trước.
 * Workspace chưa có `node_modules` thì rơi về bộ đi kèm server này. `rig`, `R`, `cli`, `P`
 * và hai bảng suy từ chúng là `let` vì thế — mọi tool đọc chúng lúc gọi, không giữ riêng.
 */
let rig, R, cli, P;
/** Nơi đọc: trừ `scenes/` và `props/`, mỗi loại có bộ chung của studio làm lớp dưới, file trùng tên thì workspace đè */
let LAYERS;
let SCHEMAS;
let loadedRig = null;

const HERE = fileURLToPath(import.meta.url);
const wsRequire = createRequire(join(WS, "package.json"));
const ownRequire = createRequire(HERE);
const resolveFrom = (spec) => {
  try {
    return wsRequire.resolve(spec);
  } catch {
    return ownRequire.resolve(spec);
  }
};

/** Version của một package như nó nằm trên đĩa, đi lên từ workspace — không qua cache phân giải của Node */
function versionOnDisk(name) {
  let d = WS;
  for (let i = 0; i < 8; i++) {
    const p = join(d, "node_modules", ...name.split("/"), "package.json");
    if (existsSync(p)) {
      try {
        return JSON.parse(readFileSync(p, "utf8")).version;
      } catch {
        return null;
      }
    }
    const up = dirname(d);
    if (up === d) break;
    d = up;
  }
  return null;
}

async function bind(version) {
  // pnpm đặt mỗi version ở một đường thật khác nhau nên `import()` đã là bản mới; `?v=` là
  // cho chỗ cài đè cùng đường — Node coi URL khác query là module khác
  const load = (path) =>
    import(`${pathToFileURL(path).href}?v=${encodeURIComponent(version ?? "src")}`);
  let pieces;
  try {
    pieces = wsRequire.resolve("@stickman3d/mcp/pieces.mjs");
  } catch {
    pieces = join(dirname(HERE), "pieces.mjs");
  }
  const [nrig, nR, ncli, nP] = await Promise.all([
    load(resolveFrom("@stickman3d/sketch")),
    load(resolveFrom("@stickman3d/render")),
    load(resolveFrom("@stickman3d/cli")),
    load(pieces),
  ]);
  rig = nrig;
  R = nR;
  cli = ncli;
  P = nP;
  LAYERS = {
    ...Object.fromEntries(Object.entries(DIRS).map(([k, d]) => [k, [d]])),
    actions: R.layers(DIRS.actions, cli.COMMON.actions),
    animals: R.layers(DIRS.animals, cli.COMMON.animals),
    held: R.layers(DIRS.held, cli.COMMON.held),
    characters: R.layers(DIRS.characters, cli.COMMON.characters),
    pieces: R.layers(DIRS.pieces, cli.COMMON.pieces),
  };

  SCHEMAS = {
    characters: { schema: rig.CharacterSchema, parse: rig.parseCharacter },
    actions: { schema: rig.ActionSchema, parse: rig.parseAction },
    scenes: { schema: rig.SceneSchema, parse: rig.parseScene },
    props: { schema: rig.PropSchema, parse: rig.parseProp },
    animals: { schema: rig.AnimalSchema, parse: rig.parseAnimal },
    held: { schema: rig.HeldItemSchema, parse: rig.parseHeldItem },
  };
  loadedRig = version;
}

/** Rig trên đĩa khác bản đang chạy thì nạp lại cả bộ; trả dòng báo để dán vào kết quả, không thì `null` */
async function refresh() {
  const now = versionOnDisk("@stickman3d/sketch");
  if (!now || now === loadedRig) return null;
  const was = loadedRig;
  try {
    await bind(now);
  } catch (e) {
    throw new Error(
      `trên đĩa là @stickman3d/sketch@${now} nhưng không nạp lại được (${e.message}) — đang chạy bản ${was}; /mcp reconnect`,
    );
  }
  return `đã nạp lại @stickman3d/sketch@${now} (trước là ${was}). Schema input của tool vẫn là bản lúc kết nối — tên pose / crop mới cần /mcp reconnect`;
}

await bind(versionOnDisk("@stickman3d/sketch"));

/**
 * `CODE_PARTS` của repo vào cả rig mà render vẽ bằng lẫn `rig` nạp theo version ở đây. Gói hỏng
 * thì báo kèm kết quả chứ không chặn tool: sửa JSON vẫn phải làm được trong lúc file ấy dở.
 */
async function repoParts() {
  if (!R.loadParts) return null;
  try {
    rig.registerParts(await R.loadParts(WS));
    return null;
  } catch (e) {
    return `⚠ bộ phận vẽ code không nạp được, đang dùng bộ lần trước: ${e.message}`;
  }
}

const text = (s) => ({ content: [{ type: "text", text: typeof s === "string" ? s : pretty(s) }] });
const fail = (s) => ({ content: [{ type: "text", text: s }], isError: true });
/** JSON có thụt dòng nhưng mảng số nằm một dòng, cho pose/toạ độ đọc được */
const pretty = (o) =>
  JSON.stringify(o, null, 2).replace(
    /\[\s+(-?[\d.e+-]+(?:,\s+-?[\d.e+-]+)*)\s+\]/g,
    (_, a) => `[${a.replace(/\s+/g, " ")}]`,
  );
const issues = (err) =>
  err.issues.map((i) => `${i.path.join(".") || "(gốc)"}: ${i.message}`).join("\n");

const withJson = (name) => (name.endsWith(".json") ? name : `${name}.json`);
const pathOf = (kind, file) => resolve(DIRS[kind], withJson(basename(file)));
/** Đường dẫn để đọc: lớp đầu tiên có file, hoặc `null` */
const findOf = (kind, file) =>
  LAYERS[kind].map((d) => resolve(d, withJson(basename(file)))).find((p) => existsSync(p)) ?? null;

/**
 * Loại của một object theo khoá riêng của nó. Đoán sai loại thì zod kể lỗi của loại khác
 * (kiểm một action lại nghe về `cast`), nên `validate` tự nhận thay vì bắt gõ `kind`.
 */
function sniffKind(o) {
  if (!o || typeof o !== "object") return null;
  if (Array.isArray(o.cast)) return "scenes";
  if ("keys" in o || "gen" in o) return "actions";
  if ("legs" in o || "legHind" in o) return "animals";
  if ("wheel" in o) return "props";
  if ("anchors" in o && ("grips" in o || "shape" in o)) return "held";
  if ("pieces" in o || "palette" in o || "face" in o) return "characters";
  return null;
}

/** File của một `kind` bất kỳ, tìm qua mọi lớp; trả cả loại đã nhận ra */
function findAnywhere(file) {
  for (const kind of KINDS) {
    const p = findOf(kind, file);
    if (p) return { kind, path: p };
  }
  return null;
}

/** Nạp + parse một file JSON qua các lớp; ném lỗi có tên file */
function load(kind, file) {
  const p = findOf(kind, file);
  if (!p) throw new Error(`không có ${kind}/${withJson(file)}`);
  const r = SCHEMAS[kind].parse(R.readJson(p));
  if (!r.success) throw new Error(`${kind}/${withJson(file)}:\n${issues(r.error)}`);
  return r.data;
}

/** `spec` là tên file trong workspace hoặc object inline chưa ghi */
function loadSpec(kind, spec) {
  if (typeof spec === "string") return load(kind, spec);
  const r = SCHEMAS[kind].parse(spec);
  if (!r.success) throw new Error(`${kind} inline:\n${issues(r.error)}`);
  return r.data;
}

const loadCharacter = (spec) => {
  const character = loadSpec("characters", spec);
  return { character, urls: R.mount(character, LAYERS.pieces) };
};

const loadProp = (spec) => {
  const prop = loadSpec("props", spec);
  return { prop, url: R.mountProp(prop, LAYERS.pieces) };
};

const loadAnimal = (spec) => {
  const animal = loadSpec("animals", spec);
  return { animal, urls: R.mountAnimal(animal, LAYERS.pieces) };
};

const loadScene = (s) =>
  R.loadScene(s, LAYERS.actions, LAYERS.animals, LAYERS.props, LAYERS.characters, LAYERS.held);

/**
 * Cảnh three `stickman.world` của repo cho một cảnh, để `scene_probe` đo người lồng vào vật như `check`:
 * `{ world, rel }` (`world` `null` là cảnh đi đường `solids(ctx)`) hay `{ warn }`. Module nạp qua `loadWorld`, gói lại
 * khi file nguồn đổi; `worldOf` dựng lại mỗi lượt gọi vì cảnh, nhân vật hay hành động có thể vừa sửa.
 */
async function probeWorld(id, scene, runtime) {
  if (!R.loadWorld || !cli.worldScene) return { world: null };
  let rel = "stickman.world";
  try {
    const entry = R.worldEntry(WS);
    if (!entry) return { world: null };
    rel = relative(WS, entry);
    const world = await R.loadWorld(WS);
    const on = cli.worldScene(world, { id, scene, runtime, ...cli.worldData(WS) }, rel);
    return on?.error ? { warn: on.error } : { world: on, rel };
  } catch (e) {
    return { warn: `${rel}: ${e.message}` };
  }
}

/** Mốc món sai hướng (`sceneItemProblems`) trên nhân vật thật của người cầm, như `check` */
function itemProblems(scene, rt) {
  if (!rt.items || !rig.sceneItemProblems) return [];
  const chars = {};
  for (const m of scene.cast)
    try {
      const c = m.character ? loadSpec("characters", m.character) : rig.defaultCharacter();
      chars[m.id] = rig.castCharacter(m, c);
    } catch {
      // file nhân vật thiếu: rig báo người cầm thiếu nhân vật
    }
  try {
    return rig.sceneItemProblems(rt, { chars });
  } catch (e) {
    return [e.message];
  }
}

/** Tay chân giật trên hình của cả cảnh (hay của một người), cùng phép đo và ngưỡng với `check` (`stickman.snap`) */
function sceneSnapLines(rt, character, cast) {
  const opts = cli.snapOptions?.(WS);
  if (!opts || opts.off || opts.error || !rig.sceneSnaps) return [];
  const characterOf = (m) => {
    if (cast && m.id !== cast) return undefined;
    const file = m.character ?? character;
    return file ? loadSpec("characters", file) : rig.defaultCharacter();
  };
  return rig.sceneSnaps(rt, { characterOf, ...opts }).map(rig.snapLine);
}

/** Mọi hành động qua các lớp, bỏ qua file hỏng (báo riêng ở `list`) */
function allActions() {
  const out = {};
  for (const { file } of listFiles("actions"))
    try {
      out[file.replace(/\.json$/, "")] = load("actions", file);
    } catch {
      /* file hỏng thì `list` báo */
    }
  return out;
}

// pieces/<socket>/x.png: một cấp thư mục con, tên trả về mang cả thư mục
const filesIn = (kind, dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory() && kind === "pieces"
            ? readdirSync(resolve(dir, e.name)).map((f) => `${e.name}/${f}`)
            : [e.name],
        )
        .filter((f) => (kind === "pieces" ? /\.png$/i : /\.json$/).test(f))
        // `index.json` là bảng liệt kê của bộ mẫu, không phải file nội dung
        .filter((f) => f !== "index.json" && !f.endsWith(".bak"))
    : [];

/** `{ file, path, layer }` qua các lớp, workspace đè bộ chung theo tên */
function listFiles(kind) {
  const seen = new Map();
  for (const dir of LAYERS[kind])
    for (const f of filesIn(kind, dir))
      if (!seen.has(f))
        seen.set(f, { file: f, path: resolve(dir, f), layer: layerName(kind, dir) });
  return [...seen.values()].sort((a, b) => a.file.localeCompare(b.file));
}

/** Danh mục mảnh gộp qua các lớp, cả `pieces` lẫn `parts` */
function catalog() {
  return rig.mergePieceCatalogs(
    ...LAYERS.pieces
      .map((d) => resolve(d, rig.PIECE_CATALOG_FILE))
      .filter((p) => existsSync(p))
      .map((p) => rig.parsePieceCatalog(R.readJson(p)))
      .filter((r) => r.success)
      .map((r) => r.data),
  );
}

/** Deep-merge một phần vào object; `null` xoá khoá, mảng thay cả mảng */
function merge(base, patch) {
  if (Array.isArray(patch) || typeof patch !== "object" || patch === null) return patch;
  const out = { ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) delete out[k];
    else out[k] = merge(out[k], v);
  }
  return out;
}

const slug = (s) =>
  String(s)
    .replace(/\.json$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .slice(0, 40) || "x";

const outPath = (name, crop) => {
  mkdirSync(OUT, { recursive: true });
  return resolve(OUT, `${name}-${crop}-${Date.now().toString(36).slice(-5)}.png`);
};

const report = (results) =>
  results.map((r) => `${r.out}  (${r.width}×${r.height}, ${r.cols}×${r.rows} ô)`).join("\n");

/** Mô tả một tư thế: tên trong POSES, `{ action, t }`, hoặc delta pose */
const PoseSpec = z.union([
  z.string(),
  z.object({ action: z.union([z.string(), z.record(z.string(), z.unknown())]), t: z.number() }),
  z.record(z.string(), z.unknown()),
]);
const Crops = z.array(z.enum(R.CROP_NAMES)).default(["full"]);
const Spec = z.union([z.string(), z.record(z.string(), z.unknown())]);
const LayerSpec = z
  .object({
    armFar: z.enum(rig.ARM_LAYERS).optional(),
    armNear: z.enum(rig.ARM_LAYERS).optional(),
  })
  .optional();
/** Map socket → tên vật (`null` là để trống, "base" là về mảnh nền), hoặc tên một bộ đồ */
const EquipSpec = z.union([z.string(), z.record(z.string(), z.string().nullable())]).optional();
const FaceSpec = z
  .object({
    mouth: z.enum(rig.MOUTH_KINDS).optional(),
    brow: z.enum(rig.BROW_KINDS).optional(),
    eyes: z.enum(rig.EYE_KINDS).optional(),
    blush: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Má ửng thêm 0..1 cộng vào face.blush của nhân vật; chỉ người 3D vẽ"),
  })
  .optional();
const ViewSpec = z
  .enum(rig.VIEWS)
  .default(rig.DEFAULT_VIEW)
  .describe("Góc nhìn của thân, xem describe_rig");
const HeadViewSpec = z
  .enum(rig.VIEWS)
  .optional()
  .describe("Góc nhìn của đầu; bỏ trống là theo thân");
const YawSpec = z
  .number()
  .optional()
  .describe(
    "Có thì vẽ người 3D giữa sân khấu trống: hướng mặt, độ quanh trục đứng (0 = +x phải khung, 90 = −z về ống kính); bỏ qua view/headView/flip. Hành động gập hai đùi (sit-3d) thì người ngồi trên ghế chuẩn, bàn chân chạm sàn",
  );
const PitchSpec = z.number().min(0).max(80).default(16).describe("Góc cúi ống kính khi có yaw, độ");

/** Ô người 3D: hành động thì diễn trong cảnh tối thiểu của `solo3d`, tư thế rời thì giữ kênh 2D */
function cell3d(c, cell, yaw, pitch, action, t) {
  const s = R.solo3d({
    character: c,
    yaw,
    pitch,
    action,
    time: action ? t * action.duration : 0,
    pose: action ? undefined : cell.pose,
  });
  const label = `${cell.label} ${Math.round(s.world.theta)}°`;
  return action
    ? { ...s, label }
    : { ...cell, flip: s.flip, view: s.view, headView: s.headView, world: s.world, label };
}

/**
 * Tầm với và hai vùng chết, suy từ hằng số rig chứ không gõ số. Không có nó thì cách duy
 * nhất để biết tay có với tới đâu là nhồi tư thế vào một hành động rồi render ra mà nhìn.
 */
function reachNotes() {
  const { torso, neck, headH, upperArm, foreArm } = rig.RIG;
  const d = rig.defaultCharacter();
  const half = headH / 2;
  return {
    note: "Mọi số theo height 1 và nhân `rig.height` — trừ đầu: `height` chỉ kéo dọc thân/tay/chân, khối đầu giữ nguyên. Nên nhân vật lùn với tới kém hơn, người cao lại với tới nhiều hơn tỉ lệ.",
    shoulder: [-d.rig.shoulderHalf, -(torso - d.rig.shoulderDrop)],
    shoulderFormula: "[∓shoulderHalf, −(torso − shoulderDrop) × height] — vai gần ở −x",
    armReach: upperArm + foreArm,
    chinY: -(torso + neck),
    skullTopY: -(torso + neck) - headH,
    headHalfWidth: half,
    shoulderToSkullTop: `${torso + neck - (torso - d.rig.shoulderDrop)} × height + ${headH}`,
    deadZones: [
      {
        what: "đỉnh đầu ngoài tầm với khi stretch = 1",
        why: `tay dài ${upperArm + foreArm} từ vai, mà đỉnh sọ cách vai ${torso + neck - (torso - d.rig.shoulderDrop) + headH} ở height 1. Giải ngược động học sẽ ra một tư thế "bàn tay nằm giữa mặt" chứ không báo là với không tới.`,
        fix: "Ở stretch 1 chạm được má, cằm, thái dương; muốn chạm đỉnh đầu thì nghiêng đầu vào tay (head[nghiêng]), hoặc ghi stretch ≈ 1.6 cho tay ấy.",
      },
      {
        what: `vai gần trong khoảng 117°–204° làm mất khúc vai→khuỷu`,
        why: `đầu rộng hơn vai (nửa rộng ${half} so với ${d.rig.shoulderHalf}) nên vai nằm lọt trong bóng đầu; khuỷu vừa cao hơn cằm vừa nằm trong bề ngang đầu.`,
        fix: 'layer.armNear: "front" — nó nâng cả khúc trên, không riêng cẳng tay.',
      },
      {
        what: "vai xa quá 155° mất khúc trên, không chữa được",
        why: "khúc vai→khuỷu xa bị khoá dưới thân áo; đẩy nó lên là hở đường ghép ở vai.",
        fix: "Giữ khuỷu xa rộng như POSES.hold, đừng đưa hai tay chụm vào trục giữa.",
      },
    ],
    zoom: {
      note: "Nhân vật vẽ vector nên zoom bao nhiêu cũng nét; ảnh thì không. px nguồn còn lại = bề ngang ảnh ÷ zoom. Chữa được lúc tạo asset, không chữa được lúc render — docs/02.",
      backdrop: "nền 3840 px: 4,5× là trần, hỏng hẳn từ ~6×",
      pieces: "mảnh đồ cầm 949 px và mảnh tóc 560 px thì dư sức ở mọi cú cận đã dùng",
    },
  };
}

/** Cảnh 3D tối thiểu cho `schema(scenes)`: ống kính, một người ngồi gõ phím, một người đi tới — docs/03-scene.md#người-3d */
const EXAMPLE_3D = {
  lens: { eye: [0, -423, -1057], yaw: 0, pitch: 16, f: 800, cx: 0, cy: 120 },
  cast: [
    {
      id: "a",
      character: "code.json",
      world: { at: [-150, -94.5, 0], yaw: 45, sit: true, floor: 0 },
      tracks: [
        { clips: [{ action: "sit-3d", start: 0 }] },
        { clips: [{ action: "type-3d", start: 0 }] },
      ],
    },
    {
      id: "b",
      character: "code.json",
      world: {
        path: [
          { t: 0, at: [400, 0, 300], yaw: 180 },
          { t: 3, at: [150, 0, 100], yaw: 135 },
          { t: 3.6, at: [150, 0, 100], yaw: 120 },
        ],
      },
      tracks: [
        {
          clips: [
            { action: "walk", start: 0 },
            { action: "stand-3d", start: 2.8, blend: 0.3 },
          ],
        },
      ],
    },
  ],
};

/**
 * Mốc `world.hands` cầm món `coc` (bộ chung): cầm từ giây 0, đưa miệng cốc lên mồm, đặt lại, buông. Món phải được
 * `cast.provide("coc", vật)` trong `extra` của cảnh three — docs/03-scene.md#đồ-cầm-tay
 */
const EXAMPLE_HOLD = [
  { t: 0, right: { at: [-60, -280, -120], point: "grip", hold: "coc#quai" } },
  {
    t: 1.2,
    right: {
      to: "mouth",
      point: "item:rim",
      hold: { item: "coc", grip: "quai", face: { axis: "rim", toward: { mark: "mouth" } } },
    },
  },
  { t: 2.4, right: { at: [-60, -280, -120], point: "grip", hold: "coc#quai" } },
  { t: 3, right: { hold: null } },
];

/** Nấc góc nhìn theo `theta`, đo từ chính `viewOfTheta` của rig */
function thetaBands() {
  const out = [];
  for (let th = 0; th <= 180; th++) {
    const v = rig.viewOfTheta(th);
    if (out.at(-1)?.view === v) out.at(-1).to = th;
    else out.push({ view: v, from: th, to: th });
  }
  return out.map(({ view, from, to }) => ({ view, theta: `${from}–${to === 180 ? 180 : to + 1}` }));
}

/** Quy ước người 3D cho `describe_rig`; số đọc từ hằng số rig. docs/01-rig.md#người-3d, docs/03-scene.md#người-3d */
function world3Notes() {
  const actions = listFiles("actions").flatMap(({ file }) => {
    try {
      const a = load("actions", file);
      return a.authoredAt === "side"
        ? [{ file: file.replace(/\.json$/, ""), name: a.name, duration: a.duration, end: a.end }]
        : [];
    } catch {
      return [];
    }
  });
  return {
    axes: "Thế giới trục như SVG: x phải, y xuống (lên là âm, sàn thường ở y 0 hay y của `floor`), z sâu vào cảnh.",
    lens: "`scene.lens` { eye [x,y,z], yaw, pitch, f, cx, cy } là ống kính 3D: yaw độ quanh trục đứng (0 nhìn theo +z), pitch dương là cúi, f tiêu cự, (cx, cy) điểm khung của trục nhìn. Không phải `camera[]`: camera là khung cắt 2D đặt SAU phép chiếu, zoom ở đó là phóng ảnh, không phải dolly.",
    world:
      "`cast[].world` đặt một người vào thế giới của `scene.lens`: đúng một trong `at` (tĩnh, kèm `yaw`, `sit`) hoặc `path` [{t, at, yaw, sit, ease, steps}] (đi: chỗ người phải ở theo thời gian, chân tự đuổi theo; hai mốc đứng cùng `at` khác `yaw` là quay tại chỗ bằng bước chân, `steps` ở mốc cuối là số nhịp, bỏ trống thì mỗi nhịp tới 90°). Đứng thì `at` là điểm sàn dưới hông, ngồi (`sit`) là điểm trên mặt ngồi dưới khớp hông. `s` đơn vị thế giới cho một đơn vị rig (mặc định 1), `floor` y sàn dưới chân người ngồi (có thì bàn chân chạm sàn có bóng), `hands` đích cổ tay thế giới theo thời gian. Có `world` thì `x`, `y`, `scale`, `view`, `headView`, `flip`, `z`, `zParts` của người ấy không còn nghĩa — rig suy từ phép chiếu; người 3D xếp lớp chung với `solids` của lớp vẽ code theo hình học.",
    yaw: "`world.yaw` / `path[].yaw` độ quanh trục đứng: 0 mặt hướng +x, 90 hướng −z, 180 hướng −x — ống kính yaw 0 đặt ở z âm nhìn theo +z thì 90 là quay mặt về ống kính, 0 là đi sang phải khung. Yaw khai là hướng vẽ ở mọi góc, kể cả nhìn thẳng ống kính.",
    theta:
      "`theta` là góc thật giữa hướng mặt và tia nhìn từ người tới ống kính, 0–180, đo trong mặt sàn. Thân áo, váy dựng khối chiếu thật qua ống kính (co dọc theo góc cúi); cổ, đầu, gốc vai, gốc chân ở chỗ chiếu thật; khối sọ nhận HEAD_LOOK phần góc ống kính nhìn xuống. Mảnh ảnh và nét mặt lấy nấc gần nhất theo `viewBands`.",
    viewBands: thetaBands(),
    authoredAt:
      'Hành động `authoredAt: "side"` cho kênh tay chân nó ghi cờ nâng (`pose.lift`): góc đọc như soạn ở `side` — tiến theo hướng mặt, lên theo trục đứng. Kênh không cờ (POSES, hành động 2D) vẽ như rig 2D trên mặt khung. `torso` của người 3D luôn là góc cúi trong mặt phẳng dọc của thân. Người đi theo `path` đọc chân như soạn ở `side` dù hành động không khai.',
    reach: `keys[].reach.armNear / armFar = { at: [tiến, y, ra ngoài], elbow?, point? } hay { to, side?, offset?, point?, elbow? }. \`at\`: đích cổ tay hệ thân, gốc tâm hông, đơn vị rig ở height 1 (rig nhân height), y xuống dương, "ra ngoài" dương về phía chính tay ấy — một bộ số cho hai tay đối xứng; hệ thân không nghiêng theo torso. \`to\`: mốc thân trên chính người ấy (${rig.BODY_MARKS.join(", ")}), tính mỗi khung theo đúng đầu, thân, bụng, chiều cao của nhân vật và tư thế lúc ấy (cúi, ngồi, quỳ) — dùng nó cho mọi chỗ chạm người (che miệng, áp tai, vỗ tay, chắp tay sau, tay lên đùi) thay cho số đoán; \`side: "other"\` lấy bên kia (tai, mắt, má, vai, hông, đùi, gối); \`offset\` [tiến, y, ra ngoài] rig (không nhân height) theo khung phần người mang mốc (đầu cho mốc trên đầu, thân cho ngực/bụng/lưng/hông/vai/gáy, hướng mặt cho đùi, gối, tay kia). Mốc other* là bàn tay kia (cổ tay, giữa lòng tay, giữa mu tay, tâm nắm): tay ấy giải trước. \`point\` là điểm bàn tay đặt vào đích (wrist, palm, back, grip, tip; thiếu là wrist với at, palm với to). elbow là hướng khuỷu hệ thân, mặc định REACH_ELBOW ${JSON.stringify(rig.REACH_ELBOW)}. Rig giải IK hai đoạn từ vai thật; xa quá tầm thì tay duỗi về phía đích. Đích hoà trên vị trí (cổ tay đi đường thẳng), hoà toạ độ với mốc cũng vậy. Người 2D không đọc đích, kênh nhận góc dự phòng. docs/01-rig.md#đích-theo-mốc`,
    twist:
      'Tay của hành động `authoredAt: "side"` nhận thêm số thứ năm `[vai, khuỷu, cổ tay, dang, xoắn vai]`: xoắn cánh tay quanh chính nó, dương là xoay ngoài — khuỷu gập ra trước thì cẳng tay quay ra phía chính tay ấy. Vẫy tay là `[0, 90, 0, 90, 90]` (dang ngang, khuỷu 90, xoay ngoài 90: cẳng tay dựng đứng); vẫy qua lại bằng lắc khuỷu (dưới 90 ngả ra ngoài đầu), không bằng lắc xoắn vai (lắc ra trước, ra sau). Số thứ ba (cổ tay) ở người 3D là lệch bàn tay trong mặt phẳng khuỷu, ra phía ngón cái khi dương. Tay theo đích (IK) không đọc xoắn vai: hướng khuỷu quyết định mặt phẳng gập. docs/01-rig.md#xoắn-tay',
    hand: `keys[].hand.armNear / armFar (kênh mask "hand"): tên dáng (${rig.HAND_POSE_KINDS.join(", ")}) hay { pose, w, turn, bend, palm, fingers } — dáng hoà từ dáng nghỉ (ngón cong nhẹ, bàn tay không ai đặt dáng) theo w (0..1), bỏ trống pose (hay {}) là dáng nghỉ, turn xoay cẳng tay (−90..90, dương sấp: cẳng tay chĩa ra trước thì lòng tay úp, âm ngửa), bend gập cổ tay (−90..90, dương về phía lòng tay). Dáng: cup khum (che miệng, che tai), pinch kẹp vật nhỏ bằng đầu ngón (chén), clasp nắm quanh cổ tay tay kia, flat duỗi phẳng chịu lực (tay vịn, mặt bàn), hook móc (quai túi, cán vali), edge kẹp cạnh vật dẹt — ngón cái mặt trước, các ngón mặt sau (điện thoại ngang hai tay). ĐỪNG đoán turn: khai palm (lòng tay quay về) và fingers (ngón chĩa về) bằng tên hệ thân (${rig.PALM_DIR_NAMES.join(", ")}; in là về đường giữa thân, out ra phía tay ấy), vectơ [tiến, y, ra ngoài], hay { toward: mốc thân, side?, offset? } — rig tự giải xoay, gập, lệch cổ tay (và xoay khuỷu quanh trục vai → cổ tay khi có fingers), kẹp trong giới hạn khớp (gập cổ tay ±${rig.AIM_BEND}, lệch ±${rig.AIM_DEV}); có palm thì turn bị bỏ qua, bend khai kèm thì giữ cố định; không đạt thì check và scene_probe (world.palms.*.aim) báo độ lệch. Không soạn từng ngón. Nội suy góc khớp giữa các mốc theo ease và hoà dần giữa hai clip; track không ghi một bên thì giữ bàn tay bên ấy của track dưới. Chỉ người 3D mặc đồ (palette.clad) vẽ ngón; turn, bend xoay cả đồ cầm ở mọi người 3D. Người đang cầm đồ (equip ở handNear/handFar) giữ dáng grip ở ngón. docs/01-rig.md#bàn-tay`,
    hands:
      '`cast[].world.hands` [{t, right: {at | to, side?, offset?, point?, elbow?, palm?, fingers?, bend?, hold?} | null, left: …}]: đích bàn tay THẾ GIỚI theo tay phải / trái giải phẫu (tay phải là tay gần khi không lật), đè đích hệ thân và góc tay của mọi hành động; `null` thả tay về góc của hành động. `at` toạ độ thế giới, hay `to` mốc thân của chính người ấy như keys[].reach; `point: "palm"` đặt giữa lòng tay (không phải cổ tay) vào điểm ấy — tay lên tay vịn, mặt bàn; `palm`/`fingers` như keys[].hand, đè bàn tay của hành động theo phần đích. Tay đặt lên mặt bàn thì tính bằng `handsOn` của rig — docs/03-scene.md#đích-bàn-tay-thế-giới. Cầm đồ: xem `held`.',
    held: 'Món cầm tay là file `held/<món>.json` (schema(held), list(held); bộ chung có `coc`): khung món (đơn vị rig, y lên, +z mặt trước), `anchors` {tên: {at, dir?}}, `grips` {kiểu: {pose, at (mốc hay {anchor, offset}), palm, fingers ({into|along|toward: mốc} hay vectơ khung món), wrap? (ngón ôm: thumb|index|middle|ring|pinky), touch?, intent?, left?, both?}}, `shape?` hình va chạm (hợp {box:[w,h,d], at?, round?} | {cyl: r, from, to, r2?, wall?} | {ball: r, at?}) — có thì mỗi khung ngón khai `wrap` cuộn tới khi chạm mặt món, mọi ngón gỡ khi lún, theo cỡ tay từng người; luật held đo lún và ngón hở trên hình ấy. Kiểu cầm là liên kết CỨNG tay↔món: dáng ngón, chỗ và hướng món đều từ kiểu cầm, đúng mọi cỡ tay, tay trái không lật món. Scene: `world.hands[].right|left.hold` = "món#kiểu" hay {item, grip, face?, up?, roll?} — BẬC THANG (không nội suy) từ mốc khai tới mốc có `hold` khác hay `hold: null` (buông; `right: null` không buông); mốc chỉ có `hold` thì chỗ tay theo hành động; `hold` không đi cùng `palm`/`fingers`/`bend` (hướng tay do ý định). Ý định: `face` {axis: mốc|vectơ, toward: camera|holderFace|up|down|tên hệ thân|vectơ|{cast, mark?}|{mark}, tilt?}, `up` (viết tắt face→up), `roll` trục phụ; giải qua cổ tay trong giới hạn khớp (không nới), không đạt thì check báo độ lệch và khớp kẹp. `point: "item:<mốc>"` đặt một mốc của món vào đích (loa vào tai, miệng chén vào mồm). Kiểu TREO trên cánh tay (túi xách; bộ chung có `tui`): `grips` {kiểu: {on: "elbow"|"shoulder", at: mốc đỉnh quai, yaw?, touch?}} cần `shape` (thân món): đỉnh quai đặt ở mặt trong khuỷu gập (`elbow`) hay đỉnh vai phía trong khớp vai, tay luồn ngoài quai (`shoulder`), món thõng theo trọng lực, đẩy khỏi thân áo/hông/váy/đùi; bàn tay ấy theo hành động (không dáng nắm, không ý định), tay kia cầm món khác được; scene vẫn `hold: "tui#khuyu"`; check đo `seat` (quai rời chỗ treo, khuỷu không gập đủ) và `body` (thân món lồng vào người), scene_probe trả ở `world.carry`. Hai tay: kiểu `both` (món theo `both.lead`, tay kia với tới `both.other`), hay hai tay cùng khai một món (tay cầm trước mang món) để đổi tay. Món phải được `cast.provide(món, vật three, chủ?)` trong `extra` của cảnh three; rig gắn món vào tay suốt quãng `hold`, hết quãng trả về chỗ cũ (`cast.released` cho chỗ thả, `cast.holder` cho ai đang mang) — docs/01-rig.md#kiểu-cầm, docs/03-scene.md#đồ-cầm-tay.',
    heldItems: listFiles("held").flatMap(({ file }) => {
      try {
        return [
          { file: file.replace(/\.json$/, ""), grips: Object.keys(load("held", file).grips ?? {}) },
        ];
      } catch {
        return [];
      }
    }),
    actions,
    actionsNote:
      'Bộ hành động 3D (`authoredAt: "side"`): đứng thở, đi, ngồi (ghép với `world.sit`), tay trên bàn, gõ phím chồng lên ngồi, cúi chào — đích hệ thân và bàn chuẩn ở docs/01-rig.md#bộ-hành-động-3d. Soi một người 3D không cần cảnh: render_action / render_character với `yaw` (và `pitch`).',
  };
}

const server = new McpServer({ name: "stickman", version: "0.1.0" });

const guard = (fn) => async (input) => {
  try {
    const note = await refresh();
    const notes = [note && `ℹ ${note}`, await repoParts()].filter(Boolean);
    const r = await fn(input);
    if (notes.length && r.content?.[0]?.type === "text")
      r.content[0].text = `${notes.join("\n")}\n${r.content[0].text}`;
    return r;
  } catch (e) {
    return fail(e.message);
  }
};

server.registerTool(
  "describe_rig",
  {
    description:
      "Mọi thứ có sẵn để chọn khi viết JSON: tư thế, kênh khớp, bộ sinh và tham số, bộ phận vẽ bằng code theo socket, kiểu đầu/tóc/râu/mặt, lớp tay, và các quy ước dấu góc bắt buộc.",
    inputSchema: {},
  },
  guard(() => {
    const parts = {};
    const cat = catalog();
    for (const k of rig.PIECE_KEYS)
      if (rig.partsFor(k).length)
        parts[k] = rig.partsFor(k).map((n) => ({
          name: n,
          label: rig.PARTS[n].label,
          preset: rig.partConfig(n, cat),
        }));
    const gens = Object.fromEntries(
      Object.entries(rig.GENERATORS).map(([k, g]) => [k, { label: g.label, params: g.params }]),
    );
    return text({
      workspace: WS,
      dirs: DIRS,
      common: cli.COMMON,
      out: OUT,
      constants: { ...rig.RIG, frames: rig.FRAMES },
      reach: reachNotes(),
      views: rig.VIEWS,
      viewNote:
        "Năm góc nhìn rời rạc, không xoay liên tục: `view` là thân, `headView` là đầu (bỏ trống thì theo thân). `quarter` là mặc định — chính diện 3/4, mặt lệch theo `face.turn`; `front` là chính diện thật, mặt nhìn thẳng. Mảnh vẽ tay dùng chung hình chính diện ở hai nấc ấy. `side` chập hai vai và hai hông về trục giữa, ghim mắt và mồm ra mép trước; `rear` là 3/4 sau; `back` quay lưng, không có nét mặt. Thân `rear` chỉ có khi thân áo dựng khối (pieces.torso.src là sculpt): khối thân quay 120°, vai và hông còn nửa khoảng cách, và chi gần (armNear, legNear) sang +x; thân khác ở `rear` vẽ như `back`. Tổ hợp không vẽ được bị kẹp lại: thân quay lưng (`rear`, `back`) với đầu `front` / `quarter` thành đầu cùng nấc thân, đầu `back` / `rear` trên thân không quay lưng thành đầu `side`. Trong scene thì khai ở `cast[].view` / `cast[].headView`; render_character và render_action nhận thẳng hai tham số ấy.",
      world3d: world3Notes(),
      anchors: rig.ANCHOR_NAMES,
      anchorNote:
        'Mọi chỗ muốn bám vào người — hào quang, nước mắt, vật rời khỏi tay, khung chỉnh — đều hỏi qua anchorAt của rig (scene_probe input `anchors`), đừng chép chuỗi biến hình của <Character> ra ngoài. Mỗi mốc trả {x, y, deg, w, h}: tâm và cỡ hộp đã nhân scale, deg là độ SVG đã lật, nên vẽ đè đúng chỗ là <g transform="translate(x y) rotate(deg)"> với hộp gốc ở giữa. Tên mốc: khớp (root là điểm chạm đất, wrist* là cổ tay, head có cả w/h khối đầu, eye*/mouth để bám nét mặt) hoặc thẳng tên socket mảnh.',
      poses: rig.POSES,
      poseLabels: rig.POSE_LABELS,
      poseLayers: rig.POSE_LAYERS,
      channels: rig.CHANNEL_LABELS,
      handPoses: rig.HAND_POSE_LABELS,
      bodyMarks: rig.BODY_MARK_LABELS,
      palmDirs: rig.PALM_DIRS,
      defaultLayers: rig.DEFAULT_LAYERS,
      armLayers: rig.ARM_LAYER_LABELS,
      generators: gens,
      parts,
      pieceKeys: rig.PIECE_KEYS,
      glassesPresets: rig.GLASSES_PRESETS,
      beardPresets: rig.BEARD_PRESETS,
      pieceNotes:
        'hairBack không có part, chỉ nhận ảnh; socket khác nhận part (xem parts) hoặc ảnh, và hair, faceAcc, chin, torso, hem (cùng crown, headAcc, neck của người 3D) còn nhận src: "sculpt" (dựng khối, không cần ảnh). handNear/handFar là đồ cầm tay: hộp cao 120 (cả cánh tay, không nhân height, không theo stretch), tâm ở bàn tay, xoay theo cẳng tay cộng cổ tay (số thứ ba của armNear/armFar) cộng pieces.hand*.rotate, vẽ cùng lớp với cẳng tay (keys[].layer). Socket nào cũng có rotate, mặc định 0, xoay quanh tâm hộp trừ vai áo (quanh khớp vai) và đồ cầm tay (quanh bàn tay). Hộp vai áo cao theo upperArm × stretch cánh tay trên của tay ấy nên tay vươn vẫn phủ kín khúc vai→khuỷu. Hành động không mang đồ vật — cùng một chop.json dùng cho rìu, cuốc, búa; đồ là mảnh của nhân vật. Tóc: hair nhận kiểu tóc (part hair-*, xem parts) vẽ đủ bốn góc, chính diện kèm lớp sau thân dùng chung bộ chỉnh với lớp trên, và bỏ qua hairBack. Tóc dựng khối: hair { src: "sculpt", color, sculpt: {…} } không cần ảnh, một bộ số quay theo đầu ở mọi góc; sculpt.bang/bangTo/bangThick là mái lệch, sculpt.length > 0 là tóc rủ theo trọng lực (1.5 ≈ ngang vai), sculpt.style: "spiky" là tóc gai theo bảng của kiểu, "anime" là tóc anime lọn dẹt nhọn (chỉ người 3D có lọn), sculpt.spike nhân chiều cao gai và chiều dài lọn (1 đúng kiểu); sculpt.style: "pony" là đuôi ngựa, "bun" là búi, cả hai buộc sau gáy ở vĩ độ sculpt.tie, đuôi ngựa rủ sculpt.tail lần bán kính sọ dưới chỗ buộc, sculpt.tieLon dời chỗ buộc quanh đầu (180 giữa gáy), sculpt.knotSize phóng khối buộc; sculpt.ahoge là số lọn vểnh trên đỉnh, sculpt.recede là hói chữ M hai bên trán, pieces.hair.accent là màu phụ phần tóc dưới hai bên (chỉ người 3D); bộ mẫu SCULPT_PRESETS của rig: short, buzz, crop, quiff, spiky, neat, round, slick, curly, afro, bald, baldLight, baldFront, ponyHigh, ponyLow, bun, messy, bang, bob, shoulder, center, anime — đọc docs 02-trang-phuc#tóc-dựng-khối. Tóc ảnh: hair là mái, vẽ trên đầu; hairBack là mảng rủ sau gáy, vẽ sau cả thân và chân. crown vẽ đè lên hair, và mũ nón khăn đội đầu đều là crown. headAcc là phụ kiện đầu (sừng, tai, vòng hoa), chung hộp với crown nhưng vẽ trên cả mũ và bám sọ — không trôi theo mặt khi lắc. Người 3D: crown { src: "sculpt", color, hat: { shape, front, back, height, ease, folds } } là mũ dựng khối ôm tóc: shape "drum" trụ thấp, "peaked" mũ kê-pi cảnh sát (band, brim, droop, strap, badge và bandColor, brimColor, strapColor, badgeColor), headAcc { src: "sculpt", color, accent, pin: { angle } } là trâm cắm qua búi — đọc docs 02-trang-phuc#mũ-dựng-khối, #trâm-cài-búi. faceAcc là phụ kiện mặt (kính, sẹo, mặt nạ), chung hộp với crown, vẽ trên mắt/mày/miệng và dưới tóc mũ, trôi đúng bằng nét mặt; mắt kính phải để rỗng vì mắt vẽ bằng code ở dưới. Thân áo dựng khối: torso { src: "sculpt", color, garment: { style: "tshirt" | "bare", … } } không cần ảnh, một bộ số chiếu theo góc của thân ở mọi nấc, và gốc vai, hông chiếu từ khối — đọc docs 02-trang-phuc#thân-áo-dựng-khối. Váy dựng khối: hem { src: "sculpt", color, layer: "under", skirt: { rise, waist, length, flare, pleats } } không cần ảnh, một bộ số chiếu theo góc của thân ở mọi nấc, gấu rủ theo đùi và phủ đùi lúc sải, lúc ngồi, chân luôn vẽ (bỏ qua hideLegs, dx…rotate) — đọc docs 02-trang-phuc#váy-dựng-khối. Kính dựng khối: faceAcc { src: "sculpt", color, glasses: { shape, tint, size, … } } không cần ảnh, một bộ số quay theo đầu ở mọi góc, cắm được vào items để đeo tháo bằng equip; bộ mẫu ở glassesPresets — đọc docs 02-trang-phuc#kính-dựng-khối. chin là mảnh râu, vẽ trên cùng ở khối đầu, pieces.chin.layer="under" thì vẽ dưới mắt/mày/ria/miệng cho râu quai nón khỏi khoét chừa mồm. Râu dựng khối: chin { src: "sculpt", color, beard: { reach, cheek, gap, bulk, length, tip, stubble, … } } không cần ảnh, một bộ số quay theo đầu ở mọi góc, khấc tự khớp vào mồm, beard.cover: true là râu kín không khấc và mồm vẽ đè lên có viền, luôn vẽ dưới mắt/mày/ria/miệng (bỏ qua layer, dx…rotate), màu trống thì lấy face.moustache.color; bộ mẫu ở beardPresets, mỗi mẫu kèm kiểu ria hợp với nó — đọc docs 02-trang-phuc#râu-dựng-khối. Ria mép và nếp nhăn luôn vẽ code riêng (face.moustache, face.wrinkle), râu dựng khối không vẽ ria. neck là khăn quàng cổ / cà vạt / yếm, treo ở khớp cổ và nghiêng theo thân chứ không theo đầu; người 3D: neck { src: "sculpt", color, drape: { side, width, front, back } } là khăn vắt vai, neck.shades: { side, size } là kính râm gài nẹp áo — đọc docs 02-trang-phuc#khăn-vắt-vai-và-kính-gài-nẹp. Thân áo dựng khối còn có garment.collarUp (0..1, cổ bẻ dựng ôm gáy) và garment.belly (px, bụng phệ) — #cổ-dựng, #bụng-phệ; garment.panels là mảng màu tuỳ ý trên thân (pts hay path SVG, side front/back/both/around, fill màu hay "skin" để khoét lộ da, pattern sọc/kẻ ô/chấm, clip theo viền cổ), garment.inner chỉnh áo trong và cà vạt của blazer/cardigan/suit, garment.neckline đè dáng cổ, garment.marks: false bỏ đặc điểm của kiểu — #mảng-áo-và-hoạ-tiết, #áo-trong-và-cà-vạt; palette.sleeveFlare là tay áo loe của người 3D, bàn tay giữ cỡ theo sleeveWidth. hem là tà áo / váy, treo ở chậu hông, pieces.hem.hideLegs ẩn hai chân và pieces.hem.layer="under" thì thân áo vẽ đè lên tà. Lắc đầu thì tóc và mũ trôi theo mặt head.follow phần (mặc định 0.1) và mảng sau theo head.followBack (mặc định -0.2, âm vì nằm sau trục lắc); đặt 0 là bám sọ, đứng yên hẳn. pieces.hair.clip cắt mái theo bao đầu nở clipGrow lần, mở xuống dưới.',
      headShapes: rig.HEAD_SHAPES,
      moustacheKinds: rig.MOUSTACHE_KINDS,
      wrinkleKinds: rig.WRINKLE_KINDS,
      wrinkleNote:
        "face.wrinkle (kind none|light|deep, color, width, dy) là dấu hiệu tuổi tác vẽ bằng code: nếp trán, chân chim, thêm túi mắt và pháp lệnh ở deep. Nó bám tâm mặt nên đi theo lắc/gật, và bị mảnh tóc hay mũ che phần trán. Nhân vật già thì dùng nó cùng tóc râu màu bạc, đừng gen nếp nhăn vào mảnh ảnh.",
      blushNote:
        "face.blush (0..1, mặc định 0) của nhân vật là má ửng của người 3D, màu suy từ palette.skin nên đọc được trên da sáng lẫn da sẫm; 2D không vẽ. keys[].face.blush (0..1) của hành động cộng thêm vào nó (kẹp ở 1) và nội suy giữa các mốc như góc, không bậc thang như mouth/brow/eyes — ngượng đỏ mặt dần là hai mốc blush 0 → 0.6, mask phải có face.",
      faceRest: rig.FACE_REST,
      faceRestNote:
        "face.eyeScale, eyeWidth, lid, shine, browWidth, browTilt (mặc định và khoảng ở faceRest) là nét mặt nghỉ riêng của nhân vật: mọi người dùng chung bộ nét mặt, mỗi người khác nhau ở 2–3 số này. eyeScale nhân cỡ mắt, eyeWidth nhân bề ngang (<1 hẹp, >1 tròn), shine nhân đốm sáng (0 là mắt không đốm, lạnh): ba số này chỉ đầu human của người 3D đọc. lid là mi trên sụp, phần chiều cao con ngươi (0.4 lười, 0.15–0.25 nghiêm, nham hiểm), ăn ở mắt open, mắt mở của wink, wide và bulge (nhẹ hơn), squint lấy số lớn hơn; browWidth nhân bề dày mày; browTilt cộng vào độ nghiêng mọi kiểu mày, dương nhấc đầu trong (hiền, rụt rè), âm hạ đầu trong (nghiêm, khó tính). Ba số sau mọi nét mặt đọc, cả 2D. Phản diện vẫn cùng rig: lid 0.25, shine 0.5 kèm miệng smirk / fang, mắt sly; quát mắng là miệng shout. Ngạc nhiên thường là mắt wide (cùng họ chấm đặc với open), mắt trố bulge (lòng trắng to) để dành cho cú sốc lớn.",
      mouth: rig.MOUTH_KINDS,
      brow: rig.BROW_KINDS,
      eyes: rig.EYE_KINDS,
      rules: [
        "Góc: 0° là đoạn chỉ thẳng xuống, dương xoay về +x; khớp con (khuỷu, gối) đo tương đối so với khớp cha. Toạ độ y hướng xuống, gốc ở hông.",
        "Vai gần ở −x, vai xa ở +x — riêng thân `rear` của thân áo dựng khối thì ngược lại, chi gần (gần ống kính) sang +x. Hai tay xoè đối xứng thì armNear âm, armFar dương. armFar âm là cánh tay trên chui sau thân — trừ khi giơ hẳn lên cao (|góc| > 120) thì nó lộ lại phía trên vai.",
        "Dấu khuỷu theo từng tay: khuỷu gập vào thân là armNear DƯƠNG, armFar ÂM (hold: an [−22, 124, 0], af [22, −124, 0]). Khuỷu ngược dấu là cẳng tay bẻ ra ngoài — chỉ hợp lý khi tay đang giơ cao.",
        "armNear/armFar của người 2D là BA số [vai, khuỷu, cổ tay]; số thứ tư (dang) và thứ năm (xoắn vai) chỉ người 3D đọc ở hành động authoredAt side — world3d.twist. Vị trí bàn tay là lượng giác: x = vai.x + sU·sin(vai)·62 + sL·sin(vai+khuỷu)·58, y = vai.y + sU·cos(vai)·62 + sL·cos(vai+khuỷu)·58, với sU, sL là hệ số vươn cánh tay trên, cẳng tay của chính tay ấy (kênh stretch, mặc định 1) — cổ tay không vào đó. Qua −90° thì sin quay đầu — armFar càng âm bàn tay càng về +x. Muốn chính xác thì scene_probe, đừng suy bằng mắt.",
        "stretch là kênh khớp trong keys[].pose, số dương, mặc định 1: bốn số [tay xa, tay gần, chân xa, chân gần] nhân vào CẢ HAI đoạn của chi ấy, hoặc tám số từng đoạn, đoạn gốc trước [tay xa trên, tay xa dưới, tay gần trên, tay gần dưới, đùi xa, cẳng chân xa, đùi gần, cẳng chân gần]; bảng tầm với ở docs/01 mục Vươn chi. Ghép theo chi: hệ số của một chi chỉ ăn khi hành động cũng ghi chính chi ấy (hành động chỉ ghi stretch thì phủ cả bốn chi), nên hành động ngồi vươn chân và track gõ phím vươn tay đặt sau nó chồng lên nhau được. Ngồi nhìn từ sau có sẵn hành động chung sit-rear: chân [82, -82], stretch [1, 1, 1, 1, 0.75, 1.4, 0.75, 1.4] — đùi chạy sâu vào khung ngắn lại, cẳng chân thẳng đứng dài ra, hông cách sàn ≈ 118 như hành động sit (chân [60, -60], đùi dốc chỉ hợp nhìn nghiêng). palette.limbCurve (0..1, mặc định 1) uốn chi thành nét cong; nhân vật hạ nó về 0 là chi thẳng thì đừng vươn quá ~1.2, đoạn thẳng dài ra đọc thành sai tỉ lệ. mask khai tường minh phải liệt kê stretch mới ăn. Tay lên đỉnh đầu: armNear [-157, -73, 0], stretch [1, 1.65, 1, 1], layer.armNear front.",
        "Tay đưa lên mặt hoặc vào giữa thân thì đặt layer (armNear/armFar: back|mid|front): back dưới thân, mid trên thân dưới đầu (bị đầu che), front trên tất cả. Tay giơ qua đầu mà thiếu layer front là bị đầu/nón nuốt, trông y như lỗi render.",
        "Cổ tay chỉ xoay đồ cầm tay (handNear/handFar), không đổi hình cánh tay — nhân vật tay không thì đặt bao nhiêu cũng như nhau. Cách nắm cố định là pieces.hand*.rotate của nhân vật; cổ tay là phần đổi theo thời gian, vd. rìu ngửa ra sau lúc lấy đà rồi gằn xuống lúc chạm.",
        "Tay phía trước người đối diện là armFar (tầm với 120+34 ở stretch 1); bắt tay, chỉ, đưa đồ thì ghi armFar + layer.armFar: front.",
        "Hành động: đúng một trong gen hoặc keys. t trong keys là tỉ lệ 0→1, không phải giây; duration là giây cho một lượt, chỉ là nhịp mặc định, scene đè bằng cycle.",
        "Đồ thay được nằm ở JSON nhân vật: items là { tên vật: { socket: config mảnh } } — một vật khai nhiều socket là để nó ĐỔI CHỖ (kính cầm ở handNear rồi đeo lên faceAcc), mỗi lúc chỉ một socket giữ nó. outfits là { tên bộ: map socket → vật }, chỉ là cách viết gọn. pieces là mảnh nền, mặc định lúc không equip gì.",
        'equip chọn vật cho socket: { torso: "ao-giap" } thay áo, { faceAcc: "kinh" } đeo kính, null là để trống socket, "base" là về mảnh nền, socket không nhắc tới thì giữ nguyên thứ đang có. Giá trị cũng nhận thẳng một tên bộ đồ, hoặc mảng nhiều bước. Nó là công tắc: giữ nguyên qua clip sau ở scene và không đi qua mask.',
        "keys[].equip đổi đồ kể từ mốc đó, cast[].equip là chỗ mở màn. Nhân vật cầm nhiều thứ trong một tập thì chỉ cần MỘT file nhân vật: khai mỗi thứ một vật trong items, cảnh nào cần thì equip cảnh ấy — đừng tách thành nhiều file nhân vật, và đừng cắm sẵn vào pieces rồi cảnh nào cũng phải gỡ ra.",
        "Mọi socket đều có pieces[k].rotate (độ, chiều rig, mặc định 0): xoay quanh tâm hộp, riêng sleeveNear/sleeveFar quanh khớp vai và handNear/handFar quanh bàn tay.",
        "Mốc t: 0 là hình đầu tiên của hành động, không phải tư thế trước nó; đoạn đưa tay lên thuộc về chỗ nối của scene (blend). Vào giữa chu kỳ thì dùng phase.",
        "end: wrap (lặp về mốc đầu) hoặc hold (giữ mốc cuối). Mask bỏ trống thì suy từ các mốc; hành động sau đè hành động trước ở đúng các khớp trong mask.",
        "Camera và nền nằm TRONG scene: `camera[]` là chuỗi mốc {t, x, y, zoom, move}, `move` mặc định `cut` (giữ mốc trước rồi nhảy) — chạy máy chỉ khi cái chạy tự nó có nghĩa; `bg[]` là các lớp nền (ảnh trong assets/bg/), vẽ dưới lên theo `z`, mỗi lớp có `parallax` (hệ số trôi theo camera, `1` là dán vào sân khấu) và `repeat` (`none` mặc định vẽ một tấm; `tile`/`mirror` lát ngang khi camera lia ra ngoài bề rộng tấm — `mirror` lật gương ô lẻ nên mép nối trùng khít, số ô rig tự suy từ hộp camera), `ground` là đường đất cả cảnh. Người, đạo cụ, động vật và từng mục `fx[]` chung một trục `z` (số nhỏ ở sau; `fx[].z` bỏ trống là băng của `layer`: back −500, front 500, ui 1000; đàn bướm nửa trước nửa sau một người ở `z: 0` là hai mục fx ở −1 và 1). Người ngồi sau bàn — thân sau bàn, tay và đầu trên bàn — là `cast[].zParts` (`z` riêng cho legFar, shinFar, legNear, shinNear, torso, armFar, forearmFar, armNear, forearmNear, head; arm* là khúc vai→khuỷu, forearm* là cẳng tay kèm đồ cầm và bỏ trống thì theo arm* của nó; leg* là khúc hông→gối, shin* là ống chân và bỏ trống thì theo leg* của nó; tay xa gõ phím mà vẫn sau thân thì chỉ nâng forearmFar; đùi trên mặt ghế mà ống chân sau mép ghế thì hạ shin* xuống dưới z của ghế). Cụm người và đồ đặt chung là `groups[]` {id, x, y, scale, flip, z}: thành viên khai `group`, chỗ đứng và `z` của họ thành tương đối, cả nhóm là một mục trên trục `z`; nhóm đứng yên. Soi bố cục bằng render_scene với `stage: true`, hỏi khung bằng scene_probe (trường `camera`).",
        "Scene: clip có start (giây), không có độ dài — clip sau kết thúc clip trước; clip không action là nhả track. cycle là giây, phase là tỉ lệ 0–1, blend là giây. flip là hướng người, x là chỗ đứng; trôi ngang khi đi tự sinh từ bàn chân, scene_probe trả x đã cộng trôi.",
        'Mốc có tên: scene.marks = { "nui-dang": 3.0 } rồi MỌI trường thời gian (start, camera[].t, path/flip/fade[].t, from/to/at của fx) viết được "@nui-dang" hay "@nui-dang+0.4" thay cho số. Đặt mốc cho mọi thời điểm mà tiếng, hình và lớp vẽ code cùng phải khớp; dời mốc là patch một số ở marks, mọi thứ neo vào nó đi theo — đừng sửa từng số. scene_probe và render_scene nhận t / times là "@mốc". check chỉ kêu mốc khai mà JSON không neo khi package.json có stickman.marks.unused = "warn" (lớp vẽ code đọc mốc qua ctx.marks).',
        "cast[].flip nhận boolean, hoặc chuỗi mốc [{t, v}] để quay giữa cảnh: công tắc bậc thang, không hoà, và MỐC ĐẦU LÀ CHỖ ĐỔI nên trước nó là hướng ngược lại ([{t: 2.4, v: true}] là nhìn phải rồi giây 2.4 quay sang trái). Cú quay gọn một frame vì rig không có góc ¾ — lật lúc hai chân chụm thì đỡ lộ. Đạo cụ follow nhảy sang bên kia người khi quay, đó là ý nghĩa của follow.",
        'cast[].view và cast[].headView: góc nhìn của thân và của đầu, "front" | "quarter" | "side" | "rear" | "back", hoặc chuỗi mốc bậc thang [{t, v}] như flip (t nhận cả "@mốc", phải tăng dần, trước mốc đầu là quarter). quarter là mặc định: chính diện 3/4, mặt lệch theo face.turn, thân dựng khối quay theo cùng góc nghỉ ấy; front là chính diện thật, mặt nhìn thẳng ống kính. headView bỏ trống là theo thân — quay lưng mà ngoái mặt nói chuyện thì view: "back", headView: "side". rear là 3/4 sau: đầu còn một mắt nhỏ sát mép và khoé mồm, tóc phủ gần hết đầu; thân rear chỉ có khi thân áo dựng khối — khối quay 120°, thấy lưng, vai xoay, chi gần sang +x — thân khác vẽ như back. Người ngồi bàn nhìn từ sau chếch: view "rear", hành động sit-rear ở track dưới, track tay gõ phím đặt sau nó, zParts cho chân nằm sau đệm ghế nếu cảnh có lớp ghế. Tổ hợp không vẽ được bị kẹp: thân quay lưng (rear, back) với đầu front hay quarter thành đầu cùng nấc thân, đầu back hay rear trên thân không quay lưng thành đầu side. Góc là năm nấc rời, không xoay liên tục, nên đổi góc là một frame, lật lúc hai chân chụm thì đỡ lộ, y như flip. cast[].turn (px, cùng nghĩa face.turn) đè face.turn của nhân vật trong riêng cảnh ấy — mặt, thân, tóc và kính dựng khối cùng xoay theo; chỉ có nghĩa ở quarter (front coi turn là 0). turn gần nửa bề ngang đầu (52 trên đầu nửa rộng 65 ≈ 53°) là 3/4 xoay gần ngang, hợp người ngồi nghiêng bên bàn; đừng sửa face.turn trong file nhân vật chỉ vì một cảnh.',
        "cast[].path: [{t, x, y, scale, ease}] — có path là tắt trôi tự suy, người giậm chân tại chỗ và chỗ đứng/đường đất/scale nội suy giữa các mốc (kẹp hai đầu). Dùng cho đi chéo, đi từ xa lại gần, khớp nền. Chân không trượt khi tốc độ dọc đường ≈ tốc độ trôi tự nhiên × scale (walk mặc định ~293 px/chu kỳ ở scale 1).",
        "Khung hình là scene.frame: wide (1280×720, ra video 1920×1080) mặc định, tall (405×720, ra 1080×1920) cho short. Gốc ở giữa, đất ở y=260, hai khung cùng cao nên người to y hệt — khung dọc chỉ hẹp bề ngang: x ngoài ±640 (wide) hay ±202 (tall) là ra khỏi khung. Một chu kỳ walk mặc định trôi ~293 px, tức gần hết bề ngang khung dọc. Mọi shot của một tập phải cùng khung.",
        "Nhân vật: rig.height chỉ kéo dọc. Trang phục là part (src: part) hoặc PNG có alpha (src: image, file trong pieces/); không có SVG.",
        "Cách đo rẻ nhất: nhồi N tư thế ứng viên vào N mốc của một action inline rồi render_action / scene_probe — một lần gọi vừa có số vừa có hình.",
        'Người 3D (cảnh có `scene.lens`, người có `cast[].world`): quy ước trục, yaw, theta, đích tay và bộ hành động ở `world3d`; mẫu cảnh ở schema(scenes).example3d. Góc khớp trong hành động vẫn theo các luật trên, đọc như soạn ở `side` khi hành động khai `authoredAt: "side"`.',
        "Cần biết một mảnh hay một khớp nằm ở đâu trên khung thì hỏi scene_probe với `anchors`, đừng suy công thức và đừng render hai lượt rồi diff: nó trả tâm, góc và cỡ hộp trong đúng hệ toạ độ chỗ vẽ.",
      ],
    });
  }),
);

server.registerTool(
  "schema",
  {
    description:
      "JSON Schema (sinh từ zod của rig) và object mặc định của một loại file: characters, actions, scenes, props (đạo cụ có bánh — docs/06-dao-cu.md), animals (động vật — docs/08-dong-vat.md) hay held (món cầm tay: khung, mốc, kiểu cầm, ý định — docs/01-rig.md#kiểu-cầm; mặc định là món mẫu `coc` của bộ chung). Scene kèm `example3d` (người 3D) và `exampleHold` (`world.hands[].hold`).",
    inputSchema: { kind: z.enum(KINDS) },
  },
  guard(({ kind }) => {
    const schema = z.toJSONSchema(SCHEMAS[kind].schema, { unrepresentable: "any" });
    const defaults =
      kind === "characters"
        ? rig.defaultCharacter()
        : kind === "actions"
          ? rig.defaultAction()
          : kind === "props"
            ? rig.defaultProp()
            : kind === "held"
              ? findOf("held", "coc") && load("held", "coc")
              : {
                  schemaVersion: rig.SCENE_VERSION,
                  name: "scene",
                  cast: [
                    {
                      id: "a",
                      character: "common.json",
                      x: 0,
                      tracks: [{ clips: [{ action: "walk", start: 0 }, { start: 2 }] }],
                    },
                  ],
                };
    return text({
      schema,
      defaults,
      ...(kind === "scenes" ? { example3d: EXAMPLE_3D, exampleHold: EXAMPLE_HOLD } : {}),
    });
  }),
);

server.registerTool(
  "list",
  {
    description:
      "Liệt kê file: characters, actions, scenes, props, animals (kèm name), held (kèm tên các kiểu cầm, `grips`) hoặc pieces (PNG kèm kích thước; kèm name/description/config nếu có trong pieces/catalog.json — studio chỉ liệt kê mảnh có trong danh mục đó). characters, actions, animals, held và pieces gồm cả bộ chung của studio, `layer` cho biết file nằm ở workspace hay common; file cùng tên thì workspace đè.",

    inputSchema: { kind: z.enum([...KINDS, "pieces"]) },
  },
  guard(({ kind }) => {
    const entries = kind === "pieces" ? catalog().pieces : [];
    const rows = listFiles(kind).map(({ file: f, path: p, layer }) => {
      const at = LAYERS[kind].length > 1 ? { layer } : {};
      if (kind === "pieces") {
        const { w, h } = R.pngSize(readFileSync(p));
        const e = entries.find((c) => c.file === f);
        return {
          file: f,
          ...at,
          width: w,
          height: h,
          ...(e ? { name: e.name, description: e.description, config: e.config } : {}),
        };
      }
      const r = SCHEMAS[kind].parse(R.readJson(p));
      return r.success
        ? {
            file: f,
            ...at,
            ...(kind === "held"
              ? { grips: Object.keys(r.data.grips ?? {}) }
              : { name: r.data.name }),
            ...(kind === "actions" ? { mask: rig.actionMask(r.data) } : {}),
          }
        : { file: f, ...at, error: issues(r.error) };
    });
    return text({
      dir: DIRS[kind],
      ...(LAYERS[kind].length > 1 ? { common: LAYERS[kind][1] } : {}),
      files: rows,
    });
  }),
);

server.registerTool(
  "read",
  {
    description: "Đọc một file JSON của workspace, trả về bản đã parse (điền đủ mặc định).",
    inputSchema: { kind: z.enum(KINDS), file: z.string() },
  },
  guard(({ kind, file }) => text(load(kind, file))),
);

server.registerTool(
  "validate",
  {
    description:
      "Kiểm một object inline (`data`) hoặc một file có sẵn của workspace (`file`, kể cả file lớp chung) qua schema của rig mà không ghi. `kind` bỏ trống thì tự nhận theo nội dung. Scene thì kiểm chéo luôn với các hành động trong workspace. Trả về bản đã điền mặc định hoặc danh sách lỗi.",
    inputSchema: {
      kind: z.enum(KINDS).optional(),
      data: z.record(z.string(), z.unknown()).optional(),
      file: z.string().optional(),
    },
  },
  guard(async ({ kind, data, file }) => {
    if (!data && !file)
      return fail("cần `data` (object inline) hoặc `file` (file trong workspace)");
    let where = "inline";
    let raw = data;
    if (file) {
      const found = kind ? { kind, path: findOf(kind, file) } : findAnywhere(file);
      if (!found?.path) return fail(`không có file ${withJson(file)} ở lớp nào`);
      kind = found.kind;
      where = `${kind}/${withJson(basename(file))}`;
      raw = R.readJson(found.path);
    }
    kind ??= sniffKind(raw);
    if (!kind)
      return fail(`không nhận ra loại của ${where} — truyền kind (${KINDS.join(", ")}) để nói rõ`);
    const r = SCHEMAS[kind].parse(raw);
    if (!r.success) return fail(`${where} (kiểm như ${kind}):\n${issues(r.error)}`);
    if (kind === "scenes") {
      const { actions, rt } = loadScene(r.data);
      // Hợp lệ mà vẫn ra hình thiếu: đây là chỗ duy nhất chúng kêu — docs/03-scene.md
      const warnings = [
        ...rig.sceneEquipProblems(r.data, actions),
        ...rig.sceneSlideProblems(rt),
        ...rig.sceneTurnProblems(rt),
        ...sceneSnapLines(rt),
        ...(rig.sceneHoldProblems?.(rt) ?? []),
      ];
      // `check` coi là lỗi: người 3D diễn hành động 2D ở kênh tay chân, mốc món sai hướng hay không tay nào cầm
      const errors = [
        ...(rig.sceneSideProblems?.(rt, allActions()) ?? []),
        ...itemProblems(r.data, rt),
        ...(rig.sceneItemHoldProblems?.(rt) ?? []),
      ];
      return text({
        ok: true,
        kind,
        duration: rt.duration,
        ...(errors.length ? { errors } : {}),
        ...(warnings.length ? { warnings } : {}),
        data: r.data,
      });
    }
    if (kind === "actions") {
      const warnings = [
        ...rig.equipSwitchProblems(r.data),
        ...rig.armFoldProblems(r.data),
        ...rig.maskProblems(r.data),
        ...(rig.aimProblems?.(r.data) ?? []),
        ...(rig.actionSnapProblems?.(r.data) ?? []),
      ];
      return text({ ok: true, kind, ...(warnings.length ? { warnings } : {}), data: r.data });
    }
    return text({ ok: true, kind, data: r.data });
  }),
);

server.registerTool(
  "write",
  {
    description:
      "Parse rồi ghi một file JSON vào workspace (ghi bản đã parse). Từ chối đè file có sẵn trừ khi overwrite: true.",
    inputSchema: {
      kind: z.enum(KINDS),
      file: z.string(),
      data: z.record(z.string(), z.unknown()),
      overwrite: z.boolean().default(false),
    },
  },
  guard(({ kind, file, data, overwrite }) => {
    const p = pathOf(kind, file);
    if (existsSync(p) && !overwrite) return fail(`${p} đã có; truyền overwrite: true để đè`);
    const r = SCHEMAS[kind].parse(data);
    if (!r.success) return fail(issues(r.error));
    if (kind === "scenes") loadScene(r.data);
    mkdirSync(DIRS[kind], { recursive: true });
    const shadowed = findOf(kind, file);
    writeFileSync(p, pretty(r.data) + "\n");
    return text(
      shadowed && shadowed !== p ? `đã ghi ${p} — đè bản chung ${shadowed}` : `đã ghi ${p}`,
    );
  }),
);

server.registerTool(
  "patch",
  {
    description:
      "Sửa một phần file JSON: deep-merge patch vào file rồi parse và ghi lại. null xoá khoá, mảng thay cả mảng. Dùng cho vòng lặp căn chỉnh (vd. { pieces: { torso: { dy: -12 } } }).",
    inputSchema: {
      kind: z.enum(KINDS),
      file: z.string(),
      patch: z.record(z.string(), z.unknown()),
    },
  },
  guard(({ kind, file, patch }) => {
    // Đọc qua các lớp, ghi vào workspace: vá một file của bộ chung là tạo bản đè ở đây
    const src = findOf(kind, file);
    if (!src) return fail(`không có ${kind}/${withJson(file)}`);
    const merged = merge(R.readJson(src), patch);
    const r = SCHEMAS[kind].parse(merged);
    if (!r.success) return fail(issues(r.error));
    if (kind === "scenes") loadScene(r.data);
    const p = pathOf(kind, file);
    mkdirSync(DIRS[kind], { recursive: true });
    writeFileSync(p, pretty(r.data) + "\n");
    return text({ wrote: p, ...(src !== p ? { from: src } : {}), data: r.data });
  }),
);

server.registerTool(
  "delete",
  {
    description: "Xoá một file JSON của workspace (dọn file nháp).",
    inputSchema: { kind: z.enum(KINDS), file: z.string() },
  },
  guard(({ kind, file }) => {
    const p = pathOf(kind, file);
    if (!existsSync(p)) return fail(`không có ${p}`);
    rmSync(p);
    return text(`đã xoá ${p}`);
  }),
);

server.registerTool(
  "render_character",
  {
    description:
      "Vẽ một nhân vật (tên file hoặc object inline) ở nhiều tư thế thành một PNG mỗi crop, ghi ra đĩa và trả về đường dẫn. poses nhận tên trong POSES, { action, t }, hoặc delta pose { armNear, armFar, legNear, legFar, torso, head, layer, face, equip } — layer/face trong delta đè layers/face chung của tool, equip trong delta đè equip chung. equip chọn vật trong character.items, xem describe_rig. view/headView đổi góc nhìn cả dải (front|quarter|side|rear|back, mặc định quarter), headView bỏ trống là theo thân. boxes: true thì thay bằng hai khung reference để đi gen mảnh ảnh. yaw (độ, 0 = +x, 90 = −z) vẽ người 3D một mình giữa sân khấu trống qua ống kính cúi pitch độ: ô { action, t } diễn hành động ấy với cờ nâng và đích tay, tên POSES và delta pose vẽ kênh 2D; view/headView/flip suy từ theta.",
    inputSchema: {
      character: Spec,
      poses: z.array(PoseSpec).default(["idle", "shrug", "think", "hold"]),
      crops: Crops,
      cols: z.number().int().positive().optional(),
      scale: z.number().positive().default(0.6),
      flip: z.boolean().default(false),
      face: FaceSpec,
      layers: LayerSpec,
      equip: EquipSpec,
      view: ViewSpec,
      headView: HeadViewSpec,
      yaw: YawSpec,
      pitch: PitchSpec,
      boxes: z.boolean().default(false),
      name: z.string().optional(),
    },
  },
  guard(
    ({
      character,
      poses,
      crops,
      cols,
      scale,
      flip,
      face,
      layers,
      equip,
      view,
      headView,
      yaw,
      pitch,
      boxes,
      name,
    }) => {
      const { character: c, urls } = loadCharacter(character);
      const bad = rig.equipProblems(c, equip);
      if (bad.length) throw new Error(`equip: ${bad.join("; ")}`);
      const tag = slug(name ?? (typeof character === "string" ? character : c.name));
      if (boxes && yaw !== undefined) return fail("`boxes` không đi với `yaw`");
      if (boxes)
        return text(
          report([
            R.renderBoxes({ character: c, scale, view, headView, out: outPath(tag, "boxes") }),
          ]),
        );
      const actions = allActions();
      const cells = poses.map((p) => {
        let cell = R.poseOf(p, actions);
        if (yaw !== undefined) {
          const a =
            p.action &&
            (typeof p.action === "string" ? actions[p.action] : loadSpec("actions", p.action));
          cell = cell3d(c, cell, yaw, pitch, a, p.t ?? 0);
        }
        return layers ? { ...cell, layers: rig.composeLayers(cell.layers, layers) } : cell;
      });
      const results = crops.map((crop) =>
        R.renderPoses({
          character: c,
          urls,
          poses: cells,
          flip,
          equip,
          face: face ?? {},
          view,
          headView,
          crop,
          cols,
          scale: R.isZoom(crop) ? scale * 2 : scale,
          out: outPath(tag, crop),
        }),
      );
      return text(report(results));
    },
  ),
);

server.registerTool(
  "render_action",
  {
    description:
      "Vẽ một hành động (tên file hoặc object inline) thành dải frames đều nhau trong một chu kỳ, trên một nhân vật (mặc định: nhân vật rỗng). view/headView đổi góc nhìn cả dải (front|quarter|side|rear|back, mặc định quarter), headView bỏ trống là theo thân. yaw (độ, 0 = +x, 90 = −z) vẽ người 3D một mình qua ống kính cúi pitch độ, như trong scene có scene.lens; view/headView/flip suy từ theta.",
    inputSchema: {
      action: Spec,
      character: Spec.optional(),
      frames: z.number().int().min(2).max(48).default(8),
      crops: Crops,
      scale: z.number().positive().default(0.6),
      flip: z.boolean().default(false),
      layers: LayerSpec,
      view: ViewSpec,
      headView: HeadViewSpec,
      yaw: YawSpec,
      pitch: PitchSpec,
      name: z.string().optional(),
    },
  },
  guard(
    ({
      action,
      character,
      frames,
      crops,
      scale,
      flip,
      layers,
      view,
      headView,
      yaw,
      pitch,
      name,
    }) => {
      const a = loadSpec("actions", action);
      const { character: c, urls } = character
        ? loadCharacter(character)
        : { character: rig.defaultCharacter(), urls: {} };
      const cells = Array.from({ length: frames }, (_, i) => {
        const t = +(i / (frames - 1)).toFixed(3);
        let cell = R.poseOf({ action: a, t });
        if (yaw !== undefined) cell = cell3d(c, cell, yaw, pitch, a, t);
        return layers ? { ...cell, layers: rig.composeLayers(cell.layers, layers) } : cell;
      });
      const tag = slug(name ?? (typeof action === "string" ? action : a.name));
      const results = crops.map((crop) =>
        R.renderPoses({
          character: c,
          urls,
          poses: cells,
          flip,
          view,
          headView,
          crop,
          cols: frames,
          scale: R.isZoom(crop) ? scale * 2 : scale,
          out: outPath(tag, crop),
        }),
      );
      return text(report(results));
    },
  ),
);

server.registerTool(
  "render_scene",
  {
    description:
      "Dải ảnh một scene (tên file hoặc object inline): mỗi cột một mốc thời gian, mỗi hàng một người. Bỏ chỗ đứng và trôi ngang để soi thân người; xem vị trí thì dùng scene_probe. `stage: true` thì ngược lại — mỗi ô là cả khung, có nền, camera, hiệu ứng và lớp vẽ code của repo, để soi bố cục. Mốc lấy đều bằng `from`/`to`/`cols`/`every`, hay chỉ đích danh bằng `times`. `around` cắt mỗi ô quanh một mốc trên người (đơn vị sân khấu, không qua camera) — soi bàn tay đang cầm mà không đoán pixel. Người 3D (cast[].world) chiếu qua scene.lens; stage xếp họ chung với solids của lớp vẽ code.",
    inputSchema: {
      scene: Spec,
      stage: z
        .boolean()
        .default(false)
        .describe("Mỗi ô là cả khung sân khấu: giữ chỗ đứng, vẽ nền, đi qua camera"),
      from: z.number().min(0).default(0),
      to: z.number().positive().optional(),
      cols: z.number().int().min(1).max(48).default(12),
      every: z.number().positive().optional(),
      times: z
        .array(z.union([z.number().min(0), z.string()]))
        .min(1)
        .max(200)
        .optional()
        .describe(
          "Đúng các mốc này (giây, hay `@mốc+0.4` theo `scene.marks`), thay cho from/to/cols/every — thay cho `pnpm frames` + montage",
        ),
      around: z
        .object({
          cast: z.string().describe("`id` trong cast[]"),
          anchor: z.enum(rig.ANCHOR_NAMES).default("root"),
          pad: z.number().positive().default(200).describe("Nửa cạnh ô, đơn vị sân khấu"),
        })
        .optional()
        .describe("Cắt mỗi ô quanh mốc `anchorAt` của một người; kéo theo stage: true"),
      cast: z.string().optional(),
      character: z.string().optional(),
      crops: Crops,
      scale: z.number().positive().default(0.5),
      name: z.string().optional(),
    },
  },
  guard(async (input) => {
    const {
      scene,
      from,
      to,
      cols,
      every,
      cast,
      character,
      crops,
      scale,
      name,
      times: picked,
      around,
    } = input;
    const stage = input.stage || !!around;
    const s = loadSpec("scenes", scene);
    // Đo `aspect` từng lớp nền trước `resolveScene` — số khai trong JSON chỉ là cái đệm lần trước
    const bgUrls = R.mountBg(s, LAYERS.bg);
    const { rt } = loadScene(s);
    const times =
      picked?.map((x) => rig.markTime(x, rt.marks, "times")) ??
      R.sampleTimes({ from, to: to ?? rt.duration, cols, every });
    const tag = slug(name ?? (typeof scene === "string" ? scene : s.name));
    const cache = {};
    const common = {
      rt,
      times,
      fallback: character,
      loadCharacter: (f) => (cache[f] ??= loadCharacter(f)),
      loadProp: (f) => (cache[`prop:${f}`] ??= loadProp(f)),
      loadAnimal: (f) => (cache[`animal:${f}`] ??= loadAnimal(f)),
      loadPiece: (f) => (cache[`piece:${f}`] ??= R.mountPiece(f, LAYERS.pieces)),
    };
    const results = stage
      ? [
          R.renderFrames({
            ...common,
            bgUrls,
            // Lớp vẽ code của repo — docs/10-lop-ve-code.md; dải ảnh thân người không có bối cảnh nên không cần
            codeLayers: await R.loadLayers(WS),
            around,
            // Ô cắt quanh mốc nhỏ như ô zoom của dải thân người nên phóng lên như ô zoom
            scale: around ? scale * 2 : scale * 0.6,
            cols: Math.min(cols, times.length),
            out: outPath(tag, around ? `around-${around.anchor}` : "stage"),
          }),
        ]
      : crops.map((crop) =>
          R.renderScene({
            ...common,
            only: cast,
            crop,
            scale: R.isZoom(crop) ? scale * 2 : scale,
            out: outPath(tag, crop),
          }),
        );
    return text(`duration ${rt.duration}s, mốc: ${times.join(", ")}\n${report(results)}`);
  }),
);

server.registerTool(
  "scene_events",
  {
    description:
      "Mốc `events[]` của mọi hành động trong một scene, đã đổi ra **giây scene** và sắp theo thời gian: lưỡi rìu chạm gỗ, bàn chân chạm đất. Clip lặp thì sự kiện lặp theo. Dùng để đặt hiệu ứng và tiếng động đúng chỗ thay vì đo lại bằng mắt hay lọc clip theo tên hành động.",
    inputSchema: {
      scene: Spec,
      name: z.string().optional().describe("Chỉ lấy sự kiện tên này"),
      cast: z.string().optional(),
    },
  },
  guard(({ scene, name, cast }) => {
    const s = loadSpec("scenes", scene);
    const { rt } = loadScene(s);
    const rows = rig
      .sceneEvents(rt, name)
      .filter((e) => !cast || e.cast === cast)
      .map((e) => ({ ...e, t: +e.t.toFixed(3) }));
    return text({ duration: rt.duration, events: rows });
  }),
);

server.registerTool(
  "scene_probe",
  {
    description:
      "Số liệu một scene tại các mốc giây, đọc bằng anchorAt của rig nên đúng hệ toạ độ chỗ vẽ (y xuống, đất ở y của chân): chỗ đứng x (đã cộng trôi ngang), tư thế, lớp tay, nét mặt, toạ độ vai / khuỷu / cổ tay / bàn chân và khối đầu của từng người; đạo cụ thì chỗ đứng, trục bánh và góc bánh đã quay; động vật thì chỗ đứng, hông, vai, yên (saddle), gáy, mõm, bàn chân — con đang bị cưỡi hay xách trả kèm host. `anchors` hỏi thêm mốc bất kỳ — khớp hoặc socket mảnh — mỗi mốc trả {x, y, deg, w, h}: tâm hộp, góc SVG và cỡ hộp đã nhân scale, cắm thẳng vào translate/rotate của một <g> anh em với <Character>. Dùng để tính điểm gặp, đặt tay lên càng xe, bám hiệu ứng vào người thay vì đoán. Người 3D (cast[].world) kèm `world`: khớp hông/gối/bàn chân/vai/khuỷu/cổ tay/cổ/đầu trong toạ độ thế giới, yaw vẽ, yawSaid, yawHeading (người đi: hướng nhắm theo path), theta, seated, near (tay gần là tay phải hay trái), hands (đích thế giới đang áp), palms (người mặc đồ: lòng bàn tay phải/trái quay về đâu — úp/ngửa/vào thân/ra ngoài/ra trước/ra sau —, down: góc lệch khỏi úp, pháp tuyến lòng tay, hướng ngón, tâm; có stickman.world thì kèm on/gap: vật có mặt ngang dưới bàn tay và khe tới nó; tay khai đích theo mốc thân hay palm/fingers thì kèm aim: reach {to, point, gap — khe rig từ điểm bàn tay tới mốc}, palmOff / fingersOff — độ lệch còn lại so với hướng đã khai) — đặt tay lên mặt hay đổi turn/elbow xong thì đọc palms, đừng phán bằng mắt. Có stickman.world thì người đang cầm đồ (hold) kèm held.right / held.left: món, dáng vẽ (pose) và dáng hành động khai (declared), follow, pierce {core, depth, piece} — đốt có trục vào trong lưới món sâu nhất (core, ngưỡng check 1,25; depth là da lún qua mặt món, âm là khe), wrap — nhóm ngón chạm món (thumb, index, fingers, palm), gaps, grip — tâm nắm tới mặt món (âm là trong món), palm {gap, angle}, up / face — góc lệch trục ý định của món (userData.hold, đường cũ), hold — kiểu cầm cứng `món#kiểu` (không có là đường cũ), intent {rule, toward, want, got, err, clamped, alts} — ý định trục chính bộ giải nhắm, hướng muốn / đạt (thế giới rig), góc còn lệch, khớp cổ tay kẹp và (lệch quá 30°) kiểu cầm khác của cùng món với lệch của nó, reach {kind: support | item, point, to, gap} — tay phụ hay điểm `item:` còn cách đích, rel — món trong khung bàn tay (so hai mốc giây để thấy món trôi), issues — luật đồ cầm check sẽ kêu. Cảnh có lens và người 3D kèm `clashes`: mỗi mốc giây, các chỗ phần người lồng vào đồ khối hay vào người khác sâu quá ngưỡng của check (stickman.clash.tol, mặc định 2) ({who, with, depth}) — rig không đẩy người ra khỏi đồ. Repo khai stickman.world và worldOf trả cảnh thì đồ là mọi vật của cảnh three ấy, đúng như check (who theo cú pháp touch: `a.foreArmR`); cảnh three hỏng thì `warnings` kể lỗi và mốc ấy đo bằng khối lớp vẽ code. `snaps`: các cú tay chân giật trên hình của cả cảnh (có `cast` thì của người ấy), cùng dòng báo và ngưỡng (stickman.snap) với check; cố ý giật thì khai `snap: true` ở hành động, ở clip hay ở mốc world.hands.",
    inputSchema: {
      scene: Spec,
      t: z
        .union([z.number(), z.string(), z.array(z.union([z.number(), z.string()]))])
        .describe("Giây scene, hay `@mốc` / `@mốc+0.4` theo `scene.marks`"),
      cast: z.string().optional(),
      character: z.string().optional(),
      anchors: z
        .array(z.enum(rig.ANCHOR_NAMES))
        .optional()
        .describe("Mốc muốn hỏi thêm; tên khớp hoặc tên socket mảnh"),
    },
  },
  guard(async ({ scene, t, cast, character, anchors }) => {
    const s = loadSpec("scenes", scene);
    const { rt } = loadScene(s);
    const times = (Array.isArray(t) ? t : [t]).map((x) => rig.markTime(x, rt.marks, "t"));
    const rows = [];
    for (const m of rt.cast) {
      if (cast && m.id !== cast) continue;
      const file = m.character ?? character;
      const c = rig.castCharacter(m, file ? loadSpec("characters", file) : rig.defaultCharacter());
      for (const time of times) {
        const at = rig.sceneAt(rt, m.id, time, c.rig.height, rig.body3(c));
        // Một bảng chỗ treo cho cả mốc này; anchorIn đã gồm `-lowest`, `scale` và lật
        const fa = rig.figureAnchors(
          rig.equipCharacter(c, at.equip),
          at.pose,
          { body: at.view, head: at.headView },
          "closed",
          at.world,
        );
        const put = (name) => {
          const a = rig.anchorIn(fa, name, at);
          return { x: +a.x.toFixed(1), y: +a.y.toFixed(1), deg: +a.deg.toFixed(1) };
        };
        const pt = (name) => {
          const a = put(name);
          return [a.x, a.y];
        };
        const box = (name) => {
          const a = rig.anchorIn(fa, name, at);
          return {
            x: +a.x.toFixed(1),
            y: +a.y.toFixed(1),
            deg: +a.deg.toFixed(1),
            w: +a.w.toFixed(1),
            h: +a.h.toFixed(1),
          };
        };
        rows.push({
          id: m.id,
          t: time,
          x: +at.x.toFixed(1),
          y: +at.groundY.toFixed(1),
          scale: +at.scale.toFixed(3),
          travel: m.path || m.mount || m.sit || at.world ? null : +(at.x - m.x).toFixed(1),
          flip: at.flip,
          rotate: at.rotate,
          view: at.view,
          headView: at.headView,
          root: at.root,
          pose: at.pose,
          layers: at.layers,
          face: { mouth: at.mouth, brow: at.brow, eyes: at.eyes, blush: at.blush },
          shoulderFar: pt("shoulderFar"),
          shoulderNear: pt("shoulderNear"),
          elbowFar: pt("elbowFar"),
          elbowNear: pt("elbowNear"),
          wristFar: put("wristFar"),
          wristNear: put("wristNear"),
          footFar: pt("footFar"),
          footNear: pt("footNear"),
          head: box("head"),
          ...(at.world ? { world: world3(rt, m.id, time, c, at, fa) } : {}),
          ...(anchors?.length
            ? { anchors: Object.fromEntries(anchors.map((n) => [n, box(n)])) }
            : {}),
        });
      }
    }
    for (const p of rt.props) {
      if (cast && p.id !== cast) continue;
      const { prop } = loadProp(p.prop);
      const seat = rig.propSeat(prop);
      for (const time of times) {
        const at = rig.propAt(rt, p.id, time);
        const sx = (at.flip ? -1 : 1) * at.scale;
        const axle = (x, r) => [
          +(at.x + sx * x).toFixed(1),
          +(at.groundY - at.scale * r).toFixed(1),
        ];
        const spin = (r) => +(((at.roll / (r * at.scale)) * 180) / Math.PI).toFixed(1);
        rows.push({
          id: p.id,
          t: time,
          prop: p.prop,
          follow: p.follow ?? null,
          x: +at.x.toFixed(1),
          y: +at.groundY.toFixed(1),
          scale: +at.scale.toFixed(3),
          flip: at.flip,
          ...(seat ? { seat: axle(seat.x, -seat.y) } : {}),
          ...(prop.rear ? { rearAxle: axle(0, prop.rear.r), rearSpin: spin(prop.rear.r) } : {}),
          ...(prop.front
            ? { frontAxle: axle(prop.front.x, prop.front.r), frontSpin: spin(prop.front.r) }
            : {}),
        });
      }
    }
    for (const a of rt.animals) {
      if (cast && a.id !== cast) continue;
      const carrier =
        a.host?.kind === "carry" ? rt.cast.find((m) => m.id === a.host.id) : undefined;
      const cc = carrier ? loadSpec("characters", carrier.character ?? character ?? {}) : undefined;
      for (const time of times) {
        const at = rig.animalAt(rt, a.id, time);
        const pt = (name) => {
          const k = rig.animalAnchorAt(rt, a.id, name, time, cc);
          return [+k.x.toFixed(1), +k.y.toFixed(1)];
        };
        rows.push({
          id: a.id,
          t: time,
          animal: a.animal,
          host: a.host ?? null,
          x: +at.x.toFixed(1),
          y: +at.groundY.toFixed(1),
          scale: +at.scale.toFixed(3),
          travel: a.path || a.host ? null : +(at.x - a.x).toFixed(1),
          flip: at.flip,
          hip: pt("hip"),
          shoulder: pt("shoulder"),
          saddle: pt("saddle"),
          poll: pt("poll"),
          muzzle: pt("muzzle"),
          wingTip: pt("wingTip"),
          mouth: at.mouth,
          eyes: at.eyes,
          root: at.root,
          feet: Object.fromEntries(
            rig.animalLegs(a.spec).map((k) => [
              k,
              pt(
                {
                  hn: "footHindNear",
                  hf: "footHindFar",
                  fn: "footFrontNear",
                  ff: "footFrontFar",
                }[k],
              ),
            ]),
          ),
        });
      }
    }
    // Khung camera lúc ấy: hiệu ứng bám vào người vẫn có thể nằm ngoài khung
    const camera = Object.fromEntries(
      times.map((time) => {
        const c = rig.cameraAt(rt, time);
        const r = (n) => +n.toFixed(1);
        return [
          time,
          {
            x: r(c.x),
            y: r(c.y),
            zoom: +c.zoom.toFixed(3),
            view: [r(c.view.x), r(c.view.y), r(c.view.w), r(c.view.h)],
          },
        ];
      }),
    );
    // Người 3D lồng vào đồ khối, vào vật của cảnh three hay vào người khác — cùng phép đo với `check`
    let clashes;
    const warnings = new Set();
    if (rt.lens && rt.cast.some((m) => m.world) && cli.clashesAt) {
      const codeLayers = await R.loadLayers(WS);
      const characterOf = (m) => {
        const file = m.character ?? character;
        return { character: file ? loadSpec("characters", file) : rig.defaultCharacter() };
      };
      const id = typeof scene === "string" ? basename(scene).replace(/\.json$/, "") : s.name;
      const { world, warn, rel } = await probeWorld(id, s, rt);
      if (warn) warnings.add(`${warn}; đo bằng khối lớp vẽ code`);
      const onWorld = ({ error, unknown }) => {
        if (error) warnings.add(`${rel}: ${error}`);
        for (const [entry, thing] of unknown ?? [])
          warnings.add(
            `\`touch\` "${entry}" của vật ${thing} không phải phần người nào — bỏ qua (docs/10-lop-ve-code.md#đo-trên-cảnh-three)`,
          );
      };
      const opts = { characterOf, codeLayers, tol: cli.clashTol(WS), self: cli.selfTol?.(WS) };
      clashes = Object.fromEntries(
        times.map((time) => [time, cli.clashesAt(rt, time, { ...opts, world, onWorld })]),
      );
      // Mặt ngang dưới bàn tay: khe từ điểm thấp nhất của bàn tay, như luật bàn tay đặt trên mặt ngang của `check`
      if (world && cli.palmFrame)
        for (const time of times) {
          const fr = cli.palmFrame(time, world);
          for (const row of rows.filter((r) => r.t === time && r.world?.palms))
            for (const p of Object.values(row.world.palms)) {
              let best = null;
              for (const q of palmSkin.get(p) ?? []) {
                const top = fr.surface(row.id, q);
                if (top && (!best || top.gap < best.gap)) best = top;
              }
              if (best && best.gap <= PALM_NEAR)
                Object.assign(p, { on: best.name, gap: +best.gap.toFixed(1) });
            }
        }
      // Đồ cầm tay: cùng phép đo với luật đồ cầm của `check` — docs/03-scene.md#đồ-cầm-tay
      const heldAt = world && cli.heldFrame?.(rt, world);
      if (heldAt && rig.heldHits)
        for (const time of times)
          for (const h of heldAt(time)) {
            const row = rows.find((r) => r.t === time && r.id === h.id && r.world);
            if (!row) continue;
            const side = h.hand === "R" ? "right" : "left";
            // món treo trên cánh tay (kiểu treo): số đo riêng ở `world.carry`
            if (h.on) (row.world.carry ??= {})[side] = carryProbe(h);
            else (row.world.held ??= {})[side] = heldProbe(h);
          }
    }
    // Tay chân giật trên hình, cả cảnh — cùng phép đo với `check`
    const snaps = sceneSnapLines(rt, character, cast);
    return text({
      duration: rt.duration,
      camera,
      rows,
      ...(clashes ? { clashes } : {}),
      ...(warnings.size ? { warnings: [...warnings] } : {}),
      ...(snaps.length ? { snaps } : {}),
    });
  }),
);

/** Số đo một bàn tay đang cầm đồ (`HeldHand` của rig) cho `scene_probe`: số làm tròn, kèm các luật `check` sẽ kêu */
function carryProbe(h) {
  return {
    item: h.item,
    hold: h.hold,
    on: h.on,
    seat: r1(h.seat),
    ...(h.bend !== undefined ? { bend: Math.round(h.bend), rise: Math.round(h.rise) } : {}),
    body: {
      gap: r1(h.body.gap),
      part: h.body.part,
      ...(h.body.allow ? { allow: h.body.allow } : {}),
    },
    swing: Math.round(h.swing),
    issues: rig.carryHits ? rig.carryHits(h).map((x) => x.rule) : [],
  };
}

function heldProbe(h) {
  const declared = rig.nearestHandPose(h.acted);
  return {
    item: h.item,
    ...(h.hold ? { hold: h.hold } : {}),
    pose: h.pose,
    follow: h.follow,
    declared: declared.pose,
    pierce: { core: r1(h.pierce.core), depth: r1(h.pierce.depth), piece: h.pierce.piece },
    wrap: rig.heldWrap(h),
    gaps: Object.fromEntries(Object.entries(h.gaps).map(([k, v]) => [k, r1(v)])),
    ...(h.fingers
      ? {
          fingers: Object.fromEntries(Object.entries(h.fingers).map(([k, v]) => [k, r1(v)])),
          ...(h.wrap ? { hug: h.wrap, open: rig.heldOpen(h) } : {}),
        }
      : {}),
    grip: r1(h.grip),
    palm: { gap: r1(h.palm.gap), angle: Math.round(h.palm.angle) },
    ...(h.up !== undefined ? { up: Math.round(h.up) } : {}),
    ...(h.face ? { face: { angle: Math.round(h.face.angle), toward: h.face.toward } } : {}),
    ...(h.intent
      ? {
          intent: {
            rule: h.intent.rule,
            ...(h.intent.toward ? { toward: h.intent.toward } : {}),
            want: h.intent.want.map((x) => +x.toFixed(3)),
            got: h.intent.got.map((x) => +x.toFixed(3)),
            err: Math.round(h.intent.err),
            clamped: h.intent.clamped,
            ...(h.intent.alts
              ? { alts: h.intent.alts.map((x) => ({ grip: x.grip, err: Math.round(x.err) })) }
              : {}),
          },
        }
      : {}),
    ...(h.reach
      ? {
          reach: {
            kind: h.reach.kind,
            point: h.reach.point,
            to: h.reach.to,
            gap: r1(h.reach.gap),
          },
        }
      : {}),
    rel: { p: v3(h.rel.p), q: h.rel.q.map((x) => +x.toFixed(3)) },
    issues: rig.heldHits(h).map((x) => x.rule),
  };
}

/** `scene_probe` kể mặt ngang dưới bàn tay khi điểm thấp nhất của bàn tay cách nó tới ngần này, px */
const PALM_NEAR = 30;
const r1 = (n) => +n.toFixed(1);
const v3 = (v) => v.map(r1);
const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const JOINTS3 = [
  "hip",
  "kneeNear",
  "kneeFar",
  "footNear",
  "footFar",
  "shoulderNear",
  "shoulderFar",
  "elbowNear",
  "elbowFar",
  "wristNear",
  "wristFar",
  "neck",
  "head",
];

/** Người 3D trong thế giới: khớp, hướng khai / nhắm tới / vẽ, đích tay — docs/03-scene.md#người-3d */
function world3(rt, id, time, c, at, fa) {
  const w = at.world;
  const said = rig.worldFacingAt?.(rt, id, time, c.rig.height, rig.body3(c));
  const yaw = w.yaw / (Math.PI / 180);
  const near = w.flip ? "left" : "right";
  const hand = (r) =>
    r && { at: v3(r.at), ...(r.elbow ? { elbow: r.elbow } : {}), w: +r.w.toFixed(3) };
  const { near: hn, far: hf } = w.hands ?? {};
  // cùng vòng với yaw khai: path quay nhiều vòng thì số khai vượt ±180
  const near0 = (a) => (said ? said.said + wrap180(a - said.said) : wrap180(a));
  const heading = said && Math.abs(wrap180(said.yaw - said.said)) > 0.05;
  return {
    yaw: r1(near0(yaw)),
    ...(said ? { yawSaid: r1(said.said) } : {}),
    ...(heading ? { yawHeading: r1(near0(said.yaw)) } : {}),
    theta: r1(w.theta),
    flip: w.flip,
    near,
    seated: !!w.seated,
    ...(w.floor !== undefined ? { floor: r1(w.floor) } : {}),
    s: w.s,
    joints: Object.fromEntries(JOINTS3.map((k) => [k, v3(fa.fig3.joints[k])])),
    ...(hn || hf
      ? {
          hands: {
            [near]: hand(hn) ?? null,
            [near === "right" ? "left" : "right"]: hand(hf) ?? null,
          },
        }
      : {}),
    ...palms3(c, at),
  };
}

/** Điểm da bàn tay của từng `world.palms` để `scene_probe` tìm mặt ngang dưới bàn tay */
const palmSkin = new WeakMap();

/**
 * Lòng bàn tay người 3D mặc đồ, theo bên giải phẫu: quay về đâu (`faces`), lệch khỏi úp (`down`, độ), pháp
 * tuyến lòng tay và hướng ngón (thế giới rig), tâm lòng bàn tay — docs/01-rig.md#hướng-lòng-bàn-tay
 */
function palms3(c, at) {
  const P = rig.actPalms?.(c, at);
  if (!P) return {};
  const r2 = (n) => +n.toFixed(2);
  // đích theo mốc thân, lòng tay theo ý định: khe tới mốc và góc lệch còn lại — docs/01-rig.md#đích-theo-mốc
  const aim = rig.needsSolve?.(at) ? rig.actAim(c, at)?.report : undefined;
  const aimOf = (k) => {
    const a = aim?.[k];
    if (!a || !(a.reach || a.palm !== undefined || a.fingers !== undefined)) return {};
    return {
      aim: {
        ...(a.reach
          ? { reach: { to: a.reach.to, point: a.reach.point, gap: +a.reach.gap.toFixed(1) } }
          : {}),
        ...(a.palm !== undefined ? { palmOff: Math.round(a.palm) } : {}),
        ...(a.fingers !== undefined ? { fingersOff: Math.round(a.fingers) } : {}),
        ...(a.cycle ? { cycle: true } : {}),
      },
    };
  };
  const one = (p, k) => {
    const f = rig.palmFace(p);
    const o = {
      faces: rig.PALM_FACES[f.face],
      down: Math.round(f.down),
      palm: p.palm.map(r2),
      finger: p.finger.map(r2),
      at: v3(p.at),
      ...aimOf(k),
    };
    palmSkin.set(o, p.skin);
    return o;
  };
  return { palms: { right: one(P.R, "R"), left: one(P.L, "L") } };
}

server.registerTool(
  "describe_pieces",
  {
    description:
      "Số đo hộp ảnh của từng socket (tính từ hằng số rig), mốc treo, hình dáng mảnh phải vẽ, khung của sheet đã gen, và ràng buộc bắt buộc khi gen ảnh. Đọc trước khi đi gen mảnh.",
    inputSchema: {},
  },
  guard(() => text(P.describePieces())),
);

server.registerTool(
  "piece_prompt",
  {
    description:
      "Prompt tiếng Anh cho một lượt gen sheet mảnh ảnh, theo schema nhãn của skill imagegen: khổ ảnh, lưới, quy tắc hai màu, ràng buộc của socket và góc vẽ. Gen bằng codex (skill imagegen nếu bạn là codex, không thì codex exec -m gpt-5.6-sol), không đính ảnh tham chiếu, gen xong kiểm alpha ngay.",
    inputSchema: {
      socket: z.enum(Object.keys(P.SPECS)),
      styles: z
        .array(z.string())
        .default([])
        .describe("Mỗi ô một kiểu, đúng thứ tự trái sang phải"),
      cols: z.number().int().positive().optional(),
      rows: z.number().int().positive().optional(),
      width: z.number().int().positive().default(1536),
      height: z.number().int().positive().default(1024),
      extra: z
        .string()
        .optional()
        .describe("Ràng buộc riêng của tập phim, chèn trước danh sách kiểu"),
    },
  },
  guard((input) => {
    const spec = P.SPECS[input.socket];
    return text(
      `${P.piecePrompt(input)}\n\n---\n` +
        "Gen bằng codex (`codex exec -m gpt-5.6-sol` nếu bạn không phải codex), đừng đính ảnh tham chiếu — lượt nào đính cũng về không alpha. " +
        "Cần bám nét bộ mẫu thì cho codex mở file mẫu ra nhìn rồi tự tả, lấy đoạn tả ấy làm Style/medium. " +
        "Gen xong kiểm ngay `magick identify -format '%[channels] %[opaque]' <file>`: phải ra `srgba False`, " +
        "không thì gen lại chứ đừng nhận. Sheet gốc lưu assets/sheets/, cắt và tẩy mực theo docs/02 " +
        `(${spec.frame}), rồi add_piece để vào thư mục và danh mục.`,
    );
  }),
);

server.registerTool(
  "add_piece",
  {
    description:
      "Đưa một PNG vào pieces/<socket>/ rồi ghi mục vào pieces/catalog.json. Thiếu mục danh mục là studio không liệt kê mảnh. Ảnh phải có alpha sẵn — server không xoá nền.",
    inputSchema: {
      file: z.string().describe("Đường dẫn PNG trên đĩa, hoặc tên đã nằm trong pieces/"),
      socket: z.enum(rig.PIECE_DIRS),
      name: z.string().describe("Tên hiện trong ô chọn mảnh của studio"),
      description: z.string().default(""),
      config: z
        .record(z.string(), z.unknown())
        .default({})
        .describe("Căn mặc định của kiểu: dx/dy/scale/widthScale/clip/clipGrow/hideLegs/rotate"),
      as: z.string().optional().describe("Đổi tên file lúc chép vào"),
      overwrite: z.boolean().default(false),
    },
  },
  guard(({ file, socket, name, description, config, as, overwrite }) => {
    const src = [
      resolve(process.cwd(), file),
      resolve(WS, file),
      ...LAYERS.pieces.map((d) => resolve(d, file)),
    ].find((p) => existsSync(p));
    if (!src) throw new Error(`không có file ${file}`);
    const rel = `${socket}/${basename(as ?? file)}`;
    const dest = resolve(DIRS.pieces, rel);
    const buf = readFileSync(src);
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file} không phải PNG`);
    // IHDR: kiểu màu ở byte 25, bit 4 là có alpha
    if (!(buf[25] & 4))
      throw new Error(`${file} không có kênh alpha — xoá nền trước, studio không key nền lúc chạy`);
    if (src !== dest) {
      if (existsSync(dest) && !overwrite)
        throw new Error(`pieces/${rel} đã có, cần overwrite: true`);
      mkdirSync(resolve(DIRS.pieces, socket), { recursive: true });
      copyFileSync(src, dest);
    }

    const cfg = rig.PieceConfigSchema.safeParse(config);
    if (!cfg.success) throw new Error(`config:\n${issues(cfg.error)}`);
    const entry = { file: rel, socket, name, description, config: cfg.data };
    const path = resolve(DIRS.pieces, rig.PIECE_CATALOG_FILE);
    const old = existsSync(path)
      ? rig.parsePieceCatalog(R.readJson(path))
      : { success: true, data: { schemaVersion: 1, pieces: [], parts: {} } };
    if (!old.success) throw new Error(`pieces/catalog.json hỏng:\n${issues(old.error)}`);
    const pieces = old.data.pieces.filter((p) => p.file !== rel);
    pieces.push(entry);
    writeFileSync(path, `${JSON.stringify({ ...old.data, pieces }, null, 2)}\n`);
    // `aspect` không khai trong JSON — cả bốn đường đọc đo từ chính ảnh. Báo khi ảnh lệch
    // hẳn khỏi tỉ lệ thiết kế của socket: dấu hiệu cắt sai khung chứ không phải kiểu dáng khác.
    const { w, h } = R.pngSize(buf);
    const aspect = w / h;
    const want = P.SPECS[socket]?.aspect;
    const off = want && (aspect > want * 1.5 || aspect < want / 1.5);
    return text({
      file: `pieces/${rel}`,
      width: w,
      height: h,
      aspect: +aspect.toFixed(3),
      ...(off
        ? {
            warning: `tỉ lệ ${aspect.toFixed(2)} lệch xa thiết kế ${want} của ${socket} — cắt lại khung?`,
          }
        : {}),
      entry,
      catalog: pieces.length,
    });
  }),
);

server.registerTool(
  "docs",
  {
    description:
      "Spec rig của chính version đang cài — nguồn sự thật cho mọi hành vi, đọc trước khi viết JSON. Không có `file` thì trả mục lục. `file` nhận tiền tố: `02` ra `02-trang-phuc.md`. Docs không nằm trong repo video, nó đi theo package đã pin nên không lệch version được.",
    inputSchema: {
      file: z
        .string()
        .optional()
        .describe("Tên file docs hoặc tiền tố số (`01`…`07`, `README`); bỏ trống là mục lục"),
    },
  },
  guard(({ file }) => {
    if (!file) return text({ docs: cli.listDocs() });
    const body = cli.readDoc(file);
    if (!body) return text({ error: `không có docs ${file}`, docs: cli.listDocs() });
    return { content: [{ type: "text", text: body }] };
  }),
);

server.registerTool(
  "init",
  {
    description:
      "Dựng workspace cho một repo video trong thư mục đang mở: scenes/props/episodes kèm bộ mẫu, characters/actions/animals/pieces trống (bộ chung là lớp dưới), app Remotion, stickman.md / AGENTS.md / CLAUDE.md / README.md / .mcp.json / package.json. Spec rig thì không chép — đọc bằng tool `docs`. Không đè file có sẵn trừ khi force.",

    inputSchema: {
      force: z.boolean().default(false),
      name: z
        .string()
        .optional()
        .describe("Tên project trong package.json; mặc định lấy tên thư mục"),
    },
  },
  guard(({ force, name }) => {
    const r = cli.initWorkspace({ dir: WS, force, name });
    return text({
      dir: r.dir,
      rig: r.versions.rig,
      wrote: r.wrote.length,
      skipped: r.skipped,
      next: "Đọc stickman.md, rồi describe_rig trước khi viết JSON đầu tiên.",
    });
  }),
);

server.registerTool(
  "upgrade",
  {
    description:
      "Nâng workspace lên bộ `@stickman3d` đang cài: chép lại app Remotion và stickman.md / .mcp.json / .npmrc / pnpm-workspace.yaml, trộn số version vào package.json. Không đụng characters / actions / scenes / props / episodes / pieces, cũng không đụng AGENTS.md / README.md / CLAUDE.md / .gitignore (chỉ phát lúc init — AGENTS.md là chỗ repo video ghi luật riêng). Docs không có ở đây vì không có bản chép — chúng đi theo package. File đã sửa tay thì theo `modified`, mỗi bản mẫu chỉ hỏi một lần; chạy `dryRun` trước để xem sẽ đè cái gì.",
    inputSchema: {
      modified: z
        .enum(["bỏ qua", "đè", "dừng"])
        .default("bỏ qua")
        .describe("Làm gì với file studio phát mà repo này đã sửa tay"),
      dryRun: z.boolean().default(false),
    },
  },
  guard(async ({ modified, dryRun }) => {
    const r = await cli.upgradeWorkspace({ dir: WS, decide: () => modified, dryRun });
    return text(r);
  }),
);

server.registerTool(
  "retime",
  {
    description:
      "Đo lại file tiếng rồi ghi số vào chỗ episodes/ khai luật: cue có `after: { cue, offset }` được ghi `at`, mốc khai ở `shot.marks: { ten: { cue, edge, offset } }` được ghi vào `marks` của cảnh — mọi thứ neo `@mốc` trong cảnh đi theo. `set` đặt tay một mốc. `dryRun` chỉ liệt kê số sẽ đổi.",
    inputSchema: {
      dryRun: z.boolean().default(false),
      set: z
        .array(z.object({ scene: z.string(), mark: z.string(), seconds: z.number().min(0) }))
        .default([]),
    },
  },
  guard(({ dryRun, set }) => text(cli.retimeWorkspace({ dir: WS, set, dryRun }))),
);

server.registerTool(
  "check",
  {
    description:
      "Soi workspace: version đã pin so với @stickman3d/sketch đang cài, JSON hỏng, socket trỏ tới mảnh không có, PNG thiếu alpha, mảnh không có trong danh mục, lớp vẽ code gói được không và `scenes` của nó có trỏ đúng tên cảnh, và công cụ ngoài (rsvg-convert / ffmpeg / ffprobe / magick) thiếu trên PATH. Soi cả workspace chậm: sửa xong một cảnh thì truyền `scene` — chỉ soi cảnh khớp (cảnh báo của chúng, người lồng vào đồ, kèm mọi lỗi), bỏ tập, tiếng, mảnh, git. Sửa gì thì chỉ chạy nhóm luật của thứ ấy (`only`): chỗ đứng, path → move,clash; tay → hands,clash (+held nếu đang cầm); đồ cầm, kiểu cầm, `held/` → held,clash (+ref khi sửa `held/<món>.json`); bối cảnh, đồ khối → clash,hands; hành động chung → `uses` tên ấy + ref,move,hands,held. Nhóm `legacy` kể đồ cầm còn đi đường cũ (`hold` không có kiểu cầm), bỏ bằng `skip`. Nhóm không chạy thì không dựng thứ nó cần. Cuối lô thì đủ nhóm trên các cảnh vừa đổi với `baseline` để chỉ thấy cảnh báo mới; cả workspace chỉ ở cuối tập hay sau khi nâng rig. Kết quả kèm `time` (ms từng nhóm, cộng dồn mọi luồng).",
    inputSchema: {
      scene: z
        .string()
        .optional()
        .describe("Regex trên id cảnh (tên file bỏ .json), vd. `t03-s01-cd-haru` hay `^t03-s01`"),
      uses: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe(
          "Chỉ soi cảnh dùng các tên này: hành động, nhân vật, đạo cụ, động vật (phẩy ngăn hay mảng); đi chung `scene` thì lấy cảnh khớp cả hai",
        ),
      only: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe(
          "Chỉ chạy các nhóm luật: ref, move, hands, held, legacy, clash, episode (phẩy ngăn hay mảng)",
        ),
      skip: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe("Bỏ các nhóm luật này"),
      baseline: z
        .string()
        .optional()
        .describe(
          "File baseline (đường từ workspace): chỉ trả lỗi và cảnh báo mới hay nặng hơn file ấy, kèm số đã hết",
        ),
      saveBaseline: z
        .string()
        .optional()
        .describe(
          "Ghi cảnh báo lượt này vào file baseline, gộp với mục của cảnh và nhóm không chạy",
        ),
    },
  },
  guard(async ({ scene, uses, only, skip, baseline, saveBaseline }) =>
    text(await cli.checkWorkspace({ dir: WS, scene, uses, only, skip, baseline, saveBaseline })),
  ),
);

server.registerPrompt(
  "new-character",
  {
    description: "Quy trình dựng một nhân vật mới bằng JSON rồi soi ảnh",
    argsSchema: { description: z.string().describe("Mô tả nhân vật") },
  },
  ({ description }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text:
            `Dựng nhân vật người que: ${description}\n\n` +
            "1. describe_rig và schema(characters) để biết có gì.\n" +
            "2. Viết JSON: bảng màu, đầu/tóc/râu, socket dùng src: part (không cần ảnh).\n" +
            "3. render_character với object inline, mở ảnh xem, sửa; không ghi cho tới khi ưng.\n" +
            "4. write, rồi render_character theo tên file một lần nữa để chốt.\n" +
            "Lưu ý: rig.height chỉ kéo dọc; mảnh part có preset scale/dy — lấy làm điểm xuất phát.",
        },
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());
