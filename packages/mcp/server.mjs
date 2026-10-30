#!/usr/bin/env node
// MCP server (stdio) cho agent dựng nhân vật / hành động / scene rồi soi bằng ảnh.
// Server là tay và mắt: liệt kê, kiểm qua zod của rig, ghi JSON, vẽ PNG ra đĩa.
// Không có bước "tạo từ mô tả" — đó là việc của model gọi tool. Xem tool `docs`, file 04.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  held: resolve(WS, "held"),
  hands: resolve(WS, "hands"),
  pieces: resolve(WS, "pieces"),
  bg: resolve(WS, "assets/bg"),
};
const layerName = (kind, dir) => (dir === DIRS[kind] ? "workspace" : "common");
const KINDS = ["characters", "actions", "scenes", "held", "hands"];

/**
 * Bộ `@stickman3d/*` nạp từ `node_modules` của chính workspace — đúng bản nó đã pin — và nạp
 * lại khi version trên đĩa đổi giữa phiên: mỗi lượt gọi tool đi qua `refresh()` trước.
 * Workspace chưa có `node_modules` thì rơi về bộ đi kèm server này. `rig`, `R`, `cli`, `P`
 * và hai bảng suy từ chúng là `let` vì thế — mọi tool đọc chúng lúc gọi, không giữ riêng.
 */
let rig, R, cli;
/** Vá JSON thô giữ chữ của `@stickman3d/cli` (`rawjson.mjs`); bản cli không có thì `null` */
let RAW;
/** `stickman gen` của `@stickman3d/cli` (`gen.mjs`); bản cli không có thì `null` */
let GEN;
/** Nơi đọc: trừ `scenes/`, mỗi loại có bộ chung làm lớp dưới, file trùng tên thì workspace đè */
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
  const [nrig, nR, ncli] = await Promise.all([
    load(resolveFrom("@stickman3d/rig/core")),
    load(resolveFrom("@stickman3d/render")),
    load(resolveFrom("@stickman3d/cli")),
  ]);
  rig = nrig;
  R = nR;
  cli = ncli;
  RAW = await load(join(dirname(resolveFrom("@stickman3d/cli")), "rawjson.mjs")).catch(() => null);
  GEN = await load(join(dirname(resolveFrom("@stickman3d/cli")), "gen.mjs")).catch(() => null);
  LAYERS = {
    ...Object.fromEntries(Object.entries(DIRS).map(([k, d]) => [k, [d]])),
    actions: R.layers(DIRS.actions, cli.COMMON.actions),
    held: R.layers(DIRS.held, cli.COMMON.held),
    hands: R.layers(DIRS.hands, cli.COMMON.hands),
    characters: R.layers(DIRS.characters, cli.COMMON.characters),
    pieces: [DIRS.pieces],
  };

  SCHEMAS = {
    characters: { schema: rig.CharacterSchema, parse: rig.parseCharacter },
    actions: { schema: rig.ActionSchema, parse: rig.parseAction },
    scenes: { schema: rig.SceneSchema, parse: rig.parseScene },
    held: { schema: rig.HeldItemSchema, parse: rig.parseHeldItem },
    hands: { schema: rig.HandShapeSchema, parse: rig.parseHandShape },
  };
  loadedRig = version;
}

/** Rig trên đĩa khác bản đang chạy thì nạp lại cả bộ; trả dòng báo để dán vào kết quả, không thì `null` */
async function refresh() {
  const now = versionOnDisk("@stickman3d/rig");
  if (!now || now === loadedRig) return null;
  const was = loadedRig;
  try {
    await bind(now);
  } catch (e) {
    throw new Error(
      `trên đĩa là @stickman3d/rig@${now} nhưng không nạp lại được (${e.message}) — đang chạy bản ${was}; /mcp reconnect`,
    );
  }
  return `đã nạp lại @stickman3d/rig@${now} (trước là ${was}). Schema input của tool vẫn là bản lúc kết nối — tên mới cần /mcp reconnect`;
}

await bind(versionOnDisk("@stickman3d/rig"));

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
  if ("anchors" in o && "shape" in o) return "held";
  if (Array.isArray(o.fingers) && !("anchors" in o)) return "hands";
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

const loadCharacter = (spec) => ({ character: loadSpec("characters", spec) });

const loadScene = (s) =>
  R.loadScene(s, LAYERS.actions, LAYERS.characters, LAYERS.held, LAYERS.hands);

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
      chars[m.id] = c;
    } catch {
      // file nhân vật thiếu: rig báo người cầm thiếu nhân vật
    }
  try {
    return rig.sceneItemProblems(rt, { chars });
  } catch (e) {
    return [e.message];
  }
}

/** Nhịp chấm của vệt khớp: `stickman.snap.fps` của workspace, không khai thì 30 */
function snapFps() {
  try {
    const v = R.readJson(join(WS, "package.json"))?.stickman?.snap?.fps;
    return typeof v === "number" && v > 0 ? v : 30;
  } catch {
    return 30;
  }
}

/** Ngưỡng giật `{ px, k }` của `stickman.snap` cho sự kiện giật trên vệt; không đo hay khai sai thì ngưỡng của rig */
function snapThresholds() {
  const o = cli.snapOptions?.(WS);
  return o && !o.off && !o.error ? { px: o.px, k: o.k } : undefined;
}

/** Hướng dẫn đọc lớp phủ và bảng số đo của ảnh (`guide` của `renderFrames`) — docs/04-mcp.md#người-3d */
const guideOf = (results) =>
  results
    .filter((r) => r.guide)
    .map((r) => `\n\n${r.guide}`)
    .join("");

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

/** `a,b*` thành một regex trên cả tên: phẩy ngăn, `*` khớp mọi chuỗi */
const globs = (s) =>
  new RegExp(
    `^(?:${s
      .split(",")
      .map((p) => p.trim().split("*").map(escRe).join(".*"))
      .join("|")})$`,
  );
const escRe = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

/** `{ file, path, layer }` qua các lớp, workspace đè bộ chung theo tên */
function listFiles(kind) {
  const seen = new Map();
  for (const dir of LAYERS[kind])
    for (const f of filesIn(kind, dir))
      if (!seen.has(f))
        seen.set(f, { file: f, path: resolve(dir, f), layer: layerName(kind, dir) });
  return [...seen.values()].sort((a, b) => a.file.localeCompare(b.file));
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

const Spec = z.union([z.string(), z.record(z.string(), z.unknown())]);
/** Một ô: tên hành động (`t` 0), hay `{ action, t }` với `t` tỉ lệ 0–1 của một lượt */
const CellSpec = z.union([
  z.string(),
  z.object({ action: Spec, t: z.number().min(0).max(1).default(0) }),
]);
/** Map socket → tên vật (`null` là để trống, "base" là về mảnh nền), hoặc tên một bộ đồ */
const EquipSpec = z.union([z.string(), z.record(z.string(), z.string().nullable())]).optional();
const YawSpec = z
  .number()
  .default(60)
  .describe(
    "Hướng mặt của người 3D giữa sân khấu trống, độ quanh trục đứng (0 = +x phải khung, 90 = −z về ống kính). Hành động gập hai đùi (sit-3d) thì người ngồi trên ghế chuẩn, bàn chân chạm sàn",
  );
const PitchSpec = z.number().min(0).max(80).default(16).describe("Góc cúi ống kính, độ");
const SizeSpec = z
  .string()
  .regex(/^\d+(x\d+)?$/)
  .optional()
  .describe(
    "Cỡ khung three pixel `1280x720` hay `1280` (cao suy từ tỉ lệ khung cảnh); mặc định 1280 ngang",
  );
const SoftwareSpec = z
  .boolean()
  .default(false)
  .describe("Cho Chromium vẽ three bằng SwiftShader khi máy không có GPU — chậm hơn nhiều");

/** Dòng báo của ảnh three: GPU, thời gian, thư mục từng khung */
const threeNote = (r) =>
  `three: ${r.gpu} — mở trang ${r.ms.boot} ms, ${r.ms.frame} ms/khung; từng khung: ${dirname(r.frames[0] ?? r.out)}`;

/** Người 3D một mình bằng three, mỗi ô `{ action, time, label }` */
async function soloThreeTool({ character, cells, yaw, pitch, size, software, cols, scale, out }) {
  const r = await R.soloThree({
    root: WS,
    character,
    handsDirs: LAYERS.hands,
    cells,
    yaw,
    pitch,
    size,
    software,
    cols,
    scale,
    out,
  });
  return text(`${report([r])}\n${threeNote(r)}`);
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
    ],
    zoom: {
      note: "Người 3D dựng khối nên zoom bao nhiêu cũng nét; ảnh nền thì không. px nguồn còn lại = bề ngang ảnh ÷ zoom. Chữa được lúc tạo asset, không chữa được lúc render.",
      backdrop: "nền 3840 px: 4,5× là trần, hỏng hẳn từ ~6×",
    },
  };
}

/** Cảnh 3D tối thiểu cho `schema(scenes)`: ống kính, một người ngồi gõ phím, một người đi tới — docs/03-scene.md#người-3d */
const EXAMPLE_3D = {
  lens: { eye: [0, -423, -1057], yaw: 0, pitch: 16, f: 800, cx: 0, cy: 120 },
  cast: [
    {
      id: "a",
      character: "sample-man.json",
      world: { at: [-150, -94.5, 0], yaw: 45, sit: true, floor: 0 },
      tracks: [
        { clips: [{ action: "sit-3d", start: 0 }] },
        { clips: [{ action: "type-3d", start: 0 }] },
      ],
    },
    {
      id: "b",
      character: "sample-woman.json",
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
  { t: 0, right: { at: [-60, -280, -120], point: "grip", hold: "coc@cylinder" } },
  {
    t: 1.2,
    right: {
      to: "mouth",
      point: "item:rim",
      hold: { item: "coc", group: "cylinder", face: { axis: "rim", toward: { mark: "mouth" } } },
    },
  },
  { t: 2.4, right: { at: [-60, -280, -120], point: "grip", hold: "coc@cylinder" } },
  { t: 3, right: { hold: null } },
];

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
      "`cast[].world` đặt một người vào thế giới của `scene.lens`: đúng một trong `at` (tĩnh, kèm `yaw`, `sit`) hoặc `path` [{t, at, yaw, sit, ease, steps}] (đi: chỗ người phải ở theo thời gian, chân tự đuổi theo; hai mốc đứng cùng `at` khác `yaw` là quay tại chỗ bằng bước chân, `steps` ở mốc cuối là số nhịp, bỏ trống thì mỗi nhịp tới 90°). Đứng thì `at` là điểm sàn dưới hông, ngồi (`sit`) là điểm trên mặt ngồi dưới khớp hông. `s` đơn vị thế giới cho một đơn vị rig (mặc định 1), `floor` y sàn dưới chân người ngồi (có thì bàn chân chạm sàn có bóng), `hands` đích cổ tay thế giới theo thời gian. Chỗ đứng, cỡ và lật trên khung rig suy từ phép chiếu; nhịp `clips[].speed` là đơn vị thế giới mỗi giây (sải chân nhân `s`); người 3D xếp lớp chung với `solids` của lớp vẽ code theo hình học.",
    yaw: "`world.yaw` / `path[].yaw` độ quanh trục đứng: 0 mặt hướng +x, 90 hướng −z, 180 hướng −x — ống kính yaw 0 đặt ở z âm nhìn theo +z thì 90 là quay mặt về ống kính, 0 là đi sang phải khung. Yaw khai là hướng vẽ ở mọi góc, kể cả nhìn thẳng ống kính.",
    theta:
      "`theta` là góc thật giữa hướng mặt và tia nhìn từ người tới ống kính, 0–180, đo trong mặt sàn. Thân áo, váy dựng khối chiếu thật qua ống kính (co dọc theo góc cúi); cổ, đầu, gốc vai, gốc chân ở chỗ chiếu thật; khối sọ nhận HEAD_LOOK phần góc ống kính nhìn xuống.",
    authoredAt:
      'Hành động `authoredAt: "side"` cho kênh tay chân nó ghi cờ nâng (`pose.lift`): góc đọc như soạn ở `side` — tiến theo hướng mặt, lên theo trục đứng. Kênh không cờ (POSES, hành động không soạn ở `side`) người 3D không đọc, `check` báo lỗi. `torso` của người 3D luôn là góc cúi trong mặt phẳng dọc của thân. Người đi theo `path` đọc chân như soạn ở `side` dù hành động không khai.',
    reach: `keys[].reach.armNear / armFar = { at: [tiến, y, ra ngoài], elbow?, point? } hay { to, side?, offset?, point?, elbow? }. \`at\`: đích cổ tay hệ thân, gốc tâm hông, đơn vị rig ở height 1 (rig nhân height), y xuống dương, "ra ngoài" dương về phía chính tay ấy — một bộ số cho hai tay đối xứng; hệ thân không nghiêng theo torso. \`to\`: mốc thân trên chính người ấy (${rig.BODY_MARKS.join(", ")}), tính mỗi khung theo đúng đầu, thân, bụng, chiều cao của nhân vật và tư thế lúc ấy (cúi, ngồi, quỳ) — dùng nó cho mọi chỗ chạm người (che miệng, áp tai, vỗ tay, chắp tay sau, tay lên đùi) thay cho số đoán; \`side: "other"\` lấy bên kia (tai, mắt, má, vai, hông, đùi, gối); \`offset\` [tiến, y, ra ngoài] rig (không nhân height) theo khung phần người mang mốc (đầu cho mốc trên đầu, thân cho ngực/bụng/lưng/hông/vai/gáy, hướng mặt cho đùi, gối, tay kia). Mốc other* là bàn tay kia (cổ tay, giữa lòng tay, giữa mu tay, tâm nắm): tay ấy giải trước. \`point\` là điểm bàn tay đặt vào đích (wrist, palm, back, grip, tip; thiếu là wrist với at, palm với to). elbow là hướng khuỷu hệ thân, bỏ trống là khuỷu ưu tiên của cổ tay (hàm trơn của chỗ cổ tay so với vai, nội suy các tư thế mẫu — docs/01-rig.md#khuỷu-ưu-tiên). Rig giải IK hai đoạn từ vai thật; sát hay quá tầm thì tay duỗi gần thẳng về phía đích (soft IK). Đích hoà trên vị trí (cổ tay đi đường thẳng), hoà toạ độ với mốc cũng vậy. Mốc không ghi góc kênh tay ấy thì kênh nhận góc suy từ đích — đoạn hoà sang mốc ghi góc đi từ đó. docs/01-rig.md#đích-theo-mốc`,
    twist:
      'Tay của hành động `authoredAt: "side"` nhận thêm số thứ năm `[vai, khuỷu, cổ tay, dang, xoắn vai]`: xoắn cánh tay quanh chính nó, dương là xoay ngoài — khuỷu gập ra trước thì cẳng tay quay ra phía chính tay ấy. Vẫy tay là `[0, 90, 0, 90, 90]` (dang ngang, khuỷu 90, xoay ngoài 90: cẳng tay dựng đứng); vẫy qua lại bằng lắc khuỷu (dưới 90 ngả ra ngoài đầu), không bằng lắc xoắn vai (lắc ra trước, ra sau). Số thứ ba (cổ tay) ở người 3D là lệch bàn tay trong mặt phẳng khuỷu, ra phía ngón cái khi dương. Tay theo đích (IK) không đọc xoắn vai: hướng khuỷu quyết định mặt phẳng gập. docs/01-rig.md#xoắn-tay',
    hand: `keys[].hand.armNear / armFar (kênh mask "hand"): tên dáng (${rig.HAND_POSE_KINDS.join(", ")}, hay tên file \`hands/<tên>.json\` của thư viện — list(hands); tên không có thì check báo lỗi) hay { pose, w, turn, bend, palm, fingers } — dáng hoà từ dáng nghỉ (ngón cong nhẹ, bàn tay không ai đặt dáng) theo w (0..1), bỏ trống pose (hay {}) là dáng nghỉ, turn xoay cẳng tay (−90..90, dương sấp: cẳng tay chĩa ra trước thì lòng tay úp, âm ngửa), bend gập cổ tay (−90..90, dương về phía lòng tay). Dáng: cup khum (che miệng, che tai), pinch kẹp vật nhỏ bằng đầu ngón (chén), clasp nắm quanh cổ tay tay kia, flat duỗi phẳng chịu lực (tay vịn, mặt bàn), hook móc (quai túi, cán vali), edge kẹp cạnh vật dẹt — ngón cái mặt trước, các ngón mặt sau (điện thoại ngang hai tay). ĐỪNG đoán turn: khai palm (lòng tay quay về) và fingers (ngón chĩa về) bằng tên hệ thân (${rig.PALM_DIR_NAMES.join(", ")}; in là về đường giữa thân, out ra phía tay ấy), vectơ [tiến, y, ra ngoài], hay { toward: mốc thân, side?, offset? } — rig tự giải xoay, gập, lệch cổ tay (và xoay khuỷu quanh trục vai → cổ tay khi có fingers), kẹp trong giới hạn khớp (gập cổ tay ${rig.AIM_BEND[0]}..${rig.AIM_BEND[1]}, âm là ngửa; lệch ${rig.AIM_DEV[0]}..${rig.AIM_DEV[1]}, dương về ngón cái); có palm thì turn bị bỏ qua, bend khai kèm thì giữ cố định; không đạt thì check và scene_probe (world.palms.*.aim) báo độ lệch. Không soạn từng ngón. Nội suy góc khớp giữa các mốc theo ease và hoà dần giữa hai clip; track không ghi một bên thì giữ bàn tay bên ấy của track dưới. Chỉ người 3D mặc đồ (palette.clad) vẽ ngón; turn, bend xoay cả đồ cầm ở mọi người 3D. Người đang cầm đồ (equip ở handNear/handFar) giữ dáng grip ở ngón. docs/01-rig.md#bàn-tay`,
    hands:
      '`cast[].world.hands` [{t, right: {at | to, side?, offset?, point?, elbow?, elbowLock?, palm?, fingers?, bend?, hold?, pose?, w?, ease?, bezier?} | {rest: true, ease?, bezier?} | null, left: …}]: đích bàn tay THẾ GIỚI theo tay phải / trái giải phẫu (tay phải là tay gần khi không lật), đè đích hệ thân và góc tay của mọi hành động; `null` thả tay về góc của hành động. `at` toạ độ thế giới, hay `to` mốc thân của chính người ấy như keys[].reach; `point: "palm"` đặt giữa lòng tay (không phải cổ tay) vào điểm ấy — tay lên tay vịn, mặt bàn; `palm`/`fingers` như keys[].hand, đè bàn tay của hành động theo phần đích. `elbow` là hướng khuỷu theo hệ của đích: mốc có `at` là thế giới rig, mốc khác (`to`, mốc chỉ có `hold`) là hệ thân `[tiến, y, ra ngoài]` của chính tay ấy như keys[].reach (bỏ trống là khuỷu ưu tiên của cổ tay), nên người quay thì khuỷu quay theo; cảnh schema trước 34 còn `elbow` thế giới trên mốc không có `at` thì zod từ chối, chuyển bằng `stickman migrate-elbow`; `elbowLock: true` (đi với `elbow`) đặt khuỷu đúng hướng ấy ở mốc, rig không dò khuỷu và không giới hạn tốc độ xoay khuỷu — hai mốc khoá sát nhau mà lệch xa thì check báo giật; khoá chỉ có tác dụng khi mốc có `at` / `to` (trừ lần cầm có mốc món), mốc khoá không có thì check báo khoá bị bỏ qua; khoá khuỷu vào thân thì check báo lấn. `pose` là dáng ngón (dáng có sẵn của rig HAND_POSES hay tên file `hands/<tên>.json` của thư viện — list(hands)), `w` hoà từ dáng nghỉ (0..1), đè ngón của hành động; mốc chỉ có `pose` không đổi đích tay; không đi với `hold`. `{ rest: true }` là tay buông: thả đích như `null` và huỷ bàn tay của hành động (dáng ngón, xoay, gập cổ tay, `palm`/`fingers`) ở tay ấy về dáng nghỉ tới mốc sau của tay ấy — sửa clip hành động soạn cho tay khác rơi vào tay này mà không phải xoá clip. `ease` là đường hoà vào mốc này của tay ấy (bỏ trống là smooth, dừng ở mỗi mốc; auto là bậc ba liền vận tốc qua chuỗi mốc auto liền nhau; bezier theo `bezier` [x1, y1, x2, y2]). Tay đặt lên mặt bàn thì tính bằng `handsOn` của rig — docs/03-scene.md#đích-bàn-tay-thế-giới. Cầm đồ: xem `held`.',
    held: 'Món cầm tay là file `held/<món>.json` (schema(held), list(held), describe_held(món)): `schemaVersion: 4` (bản 2, 3 không có `roles` nạp như bản 4), `size`, `shape` (bắt buộc: hợp {box:[w,h,d], at?, round?} | {cyl: r, from, to, r2?, wall?} | {ball: r, at?}, nhãn `part`, `detail`), `front`, `top`, `anchors` {tên: {at, dir?}} (khung món: đơn vị rig, y lên, +z mặt trước), `parts` (`grip: false`, `as`, `axis`, `strap: true` là quai của món treo — rig đặt quai tựa lên tay, vai), `seats` (chỗ treo `elbow` / `shoulder`), `touch`, `hang`, `authored` (kiểu cầm soạn tay theo nhóm rồi biến thể; khoá không phải biến thể gốc là kiểu cầm có tên, khai `base` là biến thể gốc nó mượn và `note` mô tả — list(held) và describe_held trả ở `named`), `roles` (vai trò cho bộ sinh `gen`: `pourer` {lip, spout?} — điểm rót và hướng rót, `vessel` {mouth: {at, r, dir?}} — miệng vật đựng; `vessel` suy từ `lathe` có `wall` nên chén không phải khai; điểm là mốc, `[x,y,z]` khung món hay {anchor, offset} — describe_held trả `roles` đã giải, docs/13-vai-tro-do.md). File bản 1 (không `schemaVersion`) bị từ chối: chuyển bằng `stickman migrate-held`. Rig suy khối hình (tấm, đĩa, thanh, trụ tiện, hộp) từ `shape`; nhóm cầm (`GRIP_GROUPS`) áp được theo khối hình ấy và cỡ tay — describe_held trả khối hình, nhóm áp được, trường lựa chọn và mặc định. Scene khai chỗ cầm ở `world.hands[].right|left.hold` = "món@nhóm", "món@nhóm/<biến thể hay tên kiểu cầm của món>" hay {item, group, part?, edge?, along?, thumb?, slant?, around?, tilt?, psi?, inset?, variant?, face?, up?, roll?, keep?, both?, touch?, regrip?, on?, yaw?} — `variant` nhận biến thể gốc hay tên kiểu cầm của món; rig không tự chọn kiểu cầm có tên. BẬC THANG từ mốc khai tới mốc có `hold` khác hay `hold: null` (buông); trường không khai thì rig giải, scene_probe trả lựa chọn đã giải và nguồn của nó ở `world.held.<tay>.grasp`. Lần cầm có mốc món (`scene.items`, cùng người cầm) trong khoảng của nó là món đặt trước: bàn tay suy từ món — cầm một tay thì bàn tay giải ở từng mốc, giữa hai mốc hoà trong hệ thân và món theo bàn tay (grasp.keyed; người quay thì tay và món quay cứng theo thân); mốc món `as: "hand"` (mốc đầu của lần cầm) lấy nguyên bàn tay và món như đang vẽ ngay trước lần cầm mở — tay dẫn sang theo mốc không nhảy, lựa chọn chỗ cầm giữ như cũ —, `as: "prev"` giữ nghiệm hệ thân của mốc món trước (đứng yên theo thân tới đây rồi mới hoà sang mốc sau); mốc `as` không khai `at`/`to`/`point`/`face`/`up`/`roll`/`rest`, cầm hai tay thì món ở đúng mốc; lần cầm không có mốc thì tay dẫn: mốc tay đặt bàn tay, ý định `face` {axis: mốc|vectơ, toward: camera|holderFace|up|down|tên hệ thân|vectơ|{cast, mark?}|{mark}, tilt?}, `up`, `roll` giải qua cổ tay trong giới hạn khớp. `point: "item:<mốc>"` đặt một mốc của món vào đích. Món TREO trên cánh tay (`món@carry`, `on: "elbow"|"shoulder"`, `yaw?`; đỉnh quai là `seats[on]`; bộ chung có `tui`): món thõng theo trọng lực, đẩy khỏi thân áo/hông/váy/đùi; bàn tay ấy theo hành động; check đo `seat` và `body`, scene_probe trả ở `world.carry`. Hai tay: `both` (tay phụ theo mặc định của nhóm, object đè từng trường), hay hai tay cùng khai một món để đổi tay. Món phải được `cast.provide(món, vật three, chủ?)` trong `extra` của cảnh three — docs/11-nhom-cam.md, docs/03-scene.md#đồ-cầm-tay.',

    handShapes: listFiles("hands").flatMap(({ file }) => {
      try {
        return [{ name: file.replace(/\.json$/, ""), note: load("hands", file).note }];
      } catch {
        return [];
      }
    }),
    heldItems: listFiles("held").flatMap(({ file }) => {
      try {
        const name = file.replace(/\.json$/, "");
        return [{ file: name, ...heldListRow(load("held", file), name) }];
      } catch {
        return [];
      }
    }),
    actions,
    actionsNote:
      'Bộ hành động 3D (`authoredAt: "side"`): đứng thở, đi, ngồi (ghép với `world.sit`), tay trên bàn, gõ phím chồng lên ngồi, cúi chào — đích hệ thân và bàn chuẩn ở docs/01-rig.md#bộ-hành-động-3d. Soi một người 3D không cần cảnh: render_action / render_character (`yaw`, `pitch`).',
  };
}

const server = new McpServer({ name: "stickman", version: "0.1.0" });

const guard = (fn) => async (input) => {
  try {
    const note = await refresh();
    const r = await fn(input);
    if (note && r.content?.[0]?.type === "text")
      r.content[0].text = `ℹ ${note}\n${r.content[0].text}`;
    return r;
  } catch (e) {
    return fail(e.message);
  }
};

server.registerTool(
  "describe_rig",
  {
    description:
      "Mọi thứ có sẵn để chọn khi viết JSON: tư thế, kênh khớp, bộ sinh và tham số, kiểu tóc/mặt, mốc trên người 3D, và các quy ước dấu góc bắt buộc.",
    inputSchema: {},
  },
  guard(() => {
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
      world3d: world3Notes(),
      anchors: rig.ANCHOR_NAMES,
      anchorNote:
        'Mọi chỗ muốn bám vào người 3D — hào quang, nước mắt, vật rời khỏi tay — đều hỏi qua anchorAt của rig (scene_probe input `anchors`, `ctx.anchor` của lớp vẽ code). Mỗi mốc trả {x, y, deg, w, h} trong hệ chỗ vẽ của camera: tâm và cỡ hộp đã nhân scale, deg là độ SVG đã lật, nên vẽ đè đúng chỗ là <g transform="translate(x y) rotate(deg)"> với hộp gốc ở giữa. Tên mốc là khớp: root là điểm chạm đất, wrist* là cổ tay, head có cả w/h khối đầu, face/eye*/mouth để bám nét mặt.',
      poses: rig.POSES,
      poseLabels: rig.POSE_LABELS,
      channels: rig.CHANNEL_LABELS,
      handPoses: rig.HAND_POSE_LABELS,
      bodyMarks: rig.BODY_MARK_LABELS,
      palmDirs: rig.PALM_DIRS,
      generators: gens,
      pieceKeys: rig.PIECE_KEYS,
      glassesPresets: rig.GLASSES_PRESETS,
      pieceNotes:
        'Mọi socket nhận src: "none" (trống); hair, crown, headAcc, faceAcc, neck, torso, hem còn nhận src: "sculpt" — người 3D dựng khối từ bộ số, không cần ảnh. Hành động không mang đồ vật — đồ là của nhân vật (items + equip), món cầm tay là held/ (describe_held). Tóc dựng khối: hair { src: "sculpt", color, sculpt: {…} }, một bộ số quay theo đầu; sculpt.bang/bangTo/bangThick là mái lệch, sculpt.length > 0 là tóc rủ theo trọng lực (1.5 ≈ ngang vai), sculpt.style: "spiky" là tóc gai theo bảng của kiểu, "anime" là tóc anime lọn dẹt nhọn, sculpt.spike nhân chiều cao gai và chiều dài lọn (1 đúng kiểu); sculpt.style: "pony" là đuôi ngựa, "bun" là búi, cả hai buộc sau gáy ở vĩ độ sculpt.tie, đuôi ngựa rủ sculpt.tail lần bán kính sọ dưới chỗ buộc, sculpt.tieLon dời chỗ buộc quanh đầu (180 giữa gáy), sculpt.knotSize phóng khối buộc; sculpt.ahoge là số lọn vểnh trên đỉnh, sculpt.recede là hói chữ M hai bên trán, pieces.hair.accent là màu phụ phần tóc dưới hai bên; bộ mẫu SCULPT_PRESETS của rig: short, buzz, crop, quiff, spiky, neat, round, slick, curly, afro, bald, baldLight, baldFront, ponyHigh, ponyLow, bun, messy, bang, bob, shoulder, center, anime — đọc docs 12-trang-phuc-3d#tóc-dựng-khối. Mũ: crown { src: "sculpt", color, hat: { shape, front, back, height, ease, folds } } là mũ dựng khối ôm tóc: shape "drum" trụ thấp, "peaked" mũ kê-pi cảnh sát (band, brim, droop, strap, badge và bandColor, brimColor, strapColor, badgeColor); headAcc { src: "sculpt", color, accent, pin: { angle } } là trâm cắm qua búi — đọc docs 12-trang-phuc-3d#mũ-dựng-khối, #trâm-cài-búi. Thân áo dựng khối: torso { src: "sculpt", color, garment: { style: "tshirt" | "bare", … } } — đọc docs 12-trang-phuc-3d#thân-áo-dựng-khối; garment.collarUp (0..1, cổ bẻ dựng ôm gáy), garment.belly (px, bụng phệ), garment.bust (px, ngực nở) — #cổ-dựng, #bụng-phệ, #ngực-nở; garment.panels là mảng màu tuỳ ý trên thân (pts hay path SVG, side front/back/both/around, fill màu hay "skin" để khoét lộ da, pattern sọc/kẻ ô/chấm, clip theo viền cổ), garment.inner chỉnh áo trong và cà vạt của blazer/cardigan/suit, garment.neckline đè dáng cổ, garment.marks: false bỏ đặc điểm của kiểu — #mảng-áo-và-hoạ-tiết, #áo-trong-và-cà-vạt; palette.sleeveFlare là tay áo loe, bàn tay giữ cỡ theo sleeveWidth. Váy dựng khối: hem { src: "sculpt", color, skirt: { rise, waist, length, flare, pleats } }, gấu rủ theo đùi và phủ đùi lúc sải, lúc ngồi — đọc docs 12-trang-phuc-3d#váy-dựng-khối. Kính dựng khối: faceAcc { src: "sculpt", color, glasses: { shape, tint, size, … } }, một bộ số quay theo đầu, cắm được vào items để đeo tháo bằng equip; bộ mẫu ở glassesPresets — đọc docs 12-trang-phuc-3d#kính-dựng-khối. Nếp nhăn vẽ riêng (face.wrinkle). neck { src: "sculpt", color, drape: { side, width, front, back } } là khăn vắt vai, neck.shades: { side, size } là kính râm gài nẹp áo — đọc docs 12-trang-phuc-3d#khăn-vắt-vai-và-kính-gài-nẹp.',
      wrinkleKinds: rig.WRINKLE_KINDS,
      wrinkleNote:
        "face.wrinkle (kind none|light|deep, color, width, dy) là dấu hiệu tuổi tác vẽ bằng code: nếp trán, chân chim, thêm túi mắt và pháp lệnh ở deep. Nó bám tâm mặt nên đi theo lắc/gật, và bị tóc hay mũ che phần trán. Nhân vật già thì dùng nó cùng tóc màu bạc, đừng gen nếp nhăn vào mảnh ảnh.",
      blushNote:
        "face.blush (0..1, mặc định 0) của nhân vật là má ửng của người 3D, màu suy từ palette.skin nên đọc được trên da sáng lẫn da sẫm. keys[].face.blush (0..1) của hành động cộng thêm vào nó (kẹp ở 1) và nội suy giữa các mốc như góc, không bậc thang như mouth/brow/eyes — ngượng đỏ mặt dần là hai mốc blush 0 → 0.6, mask phải có face.",
      faceRest: rig.FACE_REST,
      faceRestNote:
        "face.eyeScale, eyeWidth, lid, shine, browWidth, browTilt (mặc định và khoảng ở faceRest) là nét mặt nghỉ riêng của nhân vật: mọi người dùng chung bộ nét mặt, mỗi người khác nhau ở 2–3 số này. eyeScale nhân cỡ mắt, eyeWidth nhân bề ngang (<1 hẹp, >1 tròn), shine nhân đốm sáng (0 là mắt không đốm, lạnh): ba số này chỉ đầu human của người 3D đọc. lid là mi trên sụp, phần chiều cao con ngươi (0.4 lười, 0.15–0.25 nghiêm, nham hiểm), ăn ở mắt open, mắt mở của wink, wide và bulge (nhẹ hơn), squint lấy số lớn hơn; browWidth nhân bề dày mày; browTilt cộng vào độ nghiêng mọi kiểu mày, dương nhấc đầu trong (hiền, rụt rè), âm hạ đầu trong (nghiêm, khó tính). Ba số sau mọi nét mặt đọc. Phản diện vẫn cùng rig: lid 0.25, shine 0.5 kèm miệng smirk / fang, mắt sly; quát mắng là miệng shout. Ngạc nhiên thường là mắt wide (cùng họ chấm đặc với open), mắt trố bulge (lòng trắng to) để dành cho cú sốc lớn.",
      mouth: rig.MOUTH_KINDS,
      brow: rig.BROW_KINDS,
      eyes: rig.EYE_KINDS,
      rules: [
        "Góc: 0° là đoạn chỉ thẳng xuống, dương xoay về +x; khớp con (khuỷu, gối) đo tương đối so với khớp cha. Toạ độ y hướng xuống, gốc ở hông.",
        "Vai gần ở −x, vai xa ở +x. Hai tay xoè đối xứng thì armNear âm, armFar dương. armFar âm là cánh tay trên chui sau thân — trừ khi giơ hẳn lên cao (|góc| > 120) thì nó lộ lại phía trên vai.",
        "Dấu khuỷu theo từng tay: khuỷu gập vào thân là armNear DƯƠNG, armFar ÂM (hold: an [−22, 124, 0], af [22, −124, 0]). Khuỷu ngược dấu là cẳng tay bẻ ra ngoài — chỉ hợp lý khi tay đang giơ cao.",
        "armNear/armFar là ba số [vai, khuỷu, cổ tay] trên mặt soạn, cộng số thứ tư (dang) và thứ năm (xoắn vai) mà người 3D đọc ở hành động authoredAt side — world3d.twist. Vị trí bàn tay trên mặt soạn là lượng giác: x = vai.x + sU·sin(vai)·62 + sL·sin(vai+khuỷu)·58, y = vai.y + sU·cos(vai)·62 + sL·cos(vai+khuỷu)·58, với sU, sL là hệ số vươn cánh tay trên, cẳng tay của chính tay ấy (kênh stretch, mặc định 1) — cổ tay không vào đó. Qua −90° thì sin quay đầu — armFar càng âm bàn tay càng về +x. Muốn chính xác thì scene_probe, đừng suy bằng mắt.",
        "stretch là kênh khớp trong keys[].pose, số dương, mặc định 1: bốn số [tay xa, tay gần, chân xa, chân gần] nhân vào CẢ HAI đoạn của chi ấy, hoặc tám số từng đoạn, đoạn gốc trước [tay xa trên, tay xa dưới, tay gần trên, tay gần dưới, đùi xa, cẳng chân xa, đùi gần, cẳng chân gần]; bảng tầm với ở docs/01 mục Vươn chi. Ghép theo chi: hệ số của một chi chỉ ăn khi hành động cũng ghi chính chi ấy (hành động chỉ ghi stretch thì phủ cả bốn chi), nên hành động ngồi vươn chân và track gõ phím vươn tay đặt sau nó chồng lên nhau được. Ngồi nhìn từ sau có sẵn hành động chung sit-rear: chân [82, -82], stretch [1, 1, 1, 1, 0.75, 1.4, 0.75, 1.4] — đùi chạy sâu vào khung ngắn lại, cẳng chân thẳng đứng dài ra, hông cách sàn ≈ 118 như hành động sit (chân [60, -60], đùi dốc chỉ hợp nhìn nghiêng). palette.limbCurve (0..1, mặc định 1) uốn chi thành nét cong; nhân vật hạ nó về 0 là chi thẳng thì đừng vươn quá ~1.2, đoạn thẳng dài ra đọc thành sai tỉ lệ. mask khai tường minh phải liệt kê stretch mới ăn. Tay lên đỉnh đầu: armNear [-157, -73, 0], stretch [1, 1.65, 1, 1].",
        "Hành động: đúng một trong gen hoặc keys. t trong keys là tỉ lệ 0→1, không phải giây; duration là giây cho một lượt, chỉ là nhịp mặc định, scene đè bằng cycle.",
        "Đồ thay được nằm ở JSON nhân vật: items là { tên vật: { socket: config socket } } — một vật khai nhiều socket là để nó ĐỔI CHỖ (kính cầm ở handNear rồi đeo lên faceAcc), mỗi lúc chỉ một socket giữ nó. outfits là { tên bộ: map socket → vật }, chỉ là cách viết gọn. pieces là mảnh nền, mặc định lúc không equip gì.",
        'equip chọn vật cho socket: { torso: "ao-giap" } thay áo, { faceAcc: "kinh" } đeo kính, null là để trống socket, "base" là về mảnh nền, socket không nhắc tới thì giữ nguyên thứ đang có. Giá trị cũng nhận thẳng một tên bộ đồ, hoặc mảng nhiều bước. Nó là công tắc: giữ nguyên qua clip sau ở scene và không đi qua mask.',
        "keys[].equip đổi đồ kể từ mốc đó, cast[].equip là chỗ mở màn. Nhân vật cầm nhiều thứ trong một tập thì chỉ cần MỘT file nhân vật: khai mỗi thứ một vật trong items, cảnh nào cần thì equip cảnh ấy — đừng tách thành nhiều file nhân vật, và đừng cắm sẵn vào pieces rồi cảnh nào cũng phải gỡ ra.",
        "Mốc t: 0 là hình đầu tiên của hành động, không phải tư thế trước nó; đoạn đưa tay lên thuộc về chỗ nối của scene (blend). Vào giữa chu kỳ thì dùng phase.",
        "end: wrap (lặp về mốc đầu) hoặc hold (giữ mốc cuối). Mask bỏ trống thì suy từ các mốc; hành động sau đè hành động trước ở đúng các khớp trong mask.",
        "Camera và nền nằm TRONG scene: `camera[]` là chuỗi mốc {t, x, y, zoom, move}, `move` mặc định `cut` (giữ mốc trước rồi nhảy) — chạy máy chỉ khi cái chạy tự nó có nghĩa; `bg[]` là các lớp nền (ảnh trong assets/bg/), vẽ dưới lên theo `z`, mỗi lớp có `parallax` (hệ số trôi theo camera, `1` là dán vào sân khấu) và `repeat` (`none` mặc định vẽ một tấm; `tile`/`mirror` lát ngang khi camera lia ra ngoài bề rộng tấm — `mirror` lật gương ô lẻ nên mép nối trùng khít, số ô rig tự suy từ hộp camera). Từng mục `fx[]` nằm trên một trục `z` (số nhỏ ở sau; `fx[].z` bỏ trống là băng của `layer`: back −500, front 500, ui 1000; người ở `z: 0`, nên mục fx âm vẽ sau người, dương vẽ trước). Soi bố cục bằng render_scene, hỏi khung bằng scene_probe (trường `camera`).",
        "Scene: clip có start (giây), không có độ dài — clip sau kết thúc clip trước; clip không action là nhả track. cycle là giây, phase là tỉ lệ 0–1, blend là giây. Mỗi người trong cast là người 3D: chỗ đứng và hướng ở cast[].world (at/yaw, hay path khi đi). cast rỗng là cảnh chỉ có nền, lớp vẽ code và fx — khi ấy khai duration.",
        'Mốc có tên: scene.marks = { "nui-dang": 3.0 } rồi MỌI trường thời gian (start, camera[].t, world.path/world.hands/fade[].t, from/to/at của fx) viết được "@nui-dang" hay "@nui-dang+0.4" thay cho số. Đặt mốc cho mọi thời điểm mà tiếng, hình và lớp vẽ code cùng phải khớp; dời mốc là patch một số ở marks, mọi thứ neo vào nó đi theo — đừng sửa từng số. scene_probe và render_scene nhận t / times là "@mốc". check chỉ kêu mốc khai mà JSON không neo khi package.json có stickman.marks.unused = "warn" (lớp vẽ code đọc mốc qua ctx.marks).',
        "Khung hình là scene.frame: wide (1280×720, ra video 1920×1080) mặc định, tall (405×720, ra 1080×1920) cho short. Hai khung cùng cao, khung dọc chỉ hẹp bề ngang. Mọi shot của một tập phải cùng khung.",
        "Cách đo rẻ nhất: nhồi N tư thế ứng viên vào N mốc của một action inline rồi render_action / scene_probe — một lần gọi vừa có số vừa có hình.",
        'Người 3D (cảnh có `scene.lens`, người có `cast[].world`): quy ước trục, yaw, theta, đích tay và bộ hành động ở `world3d`; mẫu cảnh ở schema(scenes).example3d. Góc khớp trong hành động vẫn theo các luật trên, đọc như soạn ở `side` khi hành động khai `authoredAt: "side"`.',
        "Cần biết một khớp nằm ở đâu trên khung thì hỏi scene_probe với `anchors`, đừng suy công thức và đừng render hai lượt rồi diff: nó trả tâm, góc và cỡ hộp trong đúng hệ toạ độ chỗ vẽ.",
      ],
    });
  }),
);

server.registerTool(
  "schema",
  {
    description:
      "JSON Schema (sinh từ zod của rig) và object mặc định của một loại file: characters, actions, scenes, held (món cầm tay `schemaVersion: 4`: hình va chạm, mặt trước, đầu trên, mốc, phần, chỗ treo, `roles` — vai trò của món cho bộ sinh: `pourer` vật rót {lip, spout?}, `vessel` vật đựng {mouth: {at, r, dir?}} — docs/11-nhom-cam.md, docs/13-vai-tro-do.md) hay hands (dáng tay có tên `hands/<tên>.json`: mười góc ngón `fingers`, độ gập thêm `fit`; tên chỉ gồm chữ thường, số, gạch nối và không trùng dáng có sẵn của rig). `held` trả `defaults` là món tối thiểu (một tấm), `sample` là món mẫu `coc` của bộ chung, `groups` là bảng nhóm cầm. `hands` trả `defaults` là dáng `open` của rig, `sample` là dáng mẫu `peace` của bộ chung, `builtin` là tên dáng có sẵn. Scene kèm `example3d` (người 3D) và `exampleHold` (`world.hands[].hold`).",
    inputSchema: { kind: z.enum(KINDS) },
  },
  guard(({ kind }) => {
    const schema = z.toJSONSchema(SCHEMAS[kind].schema, { unrepresentable: "any" });
    const defaults =
      kind === "characters"
        ? rig.defaultCharacter()
        : kind === "actions"
          ? rig.defaultAction()
          : kind === "held"
            ? HELD_EXAMPLE
            : kind === "hands"
              ? {
                  schemaVersion: rig.HAND_SHAPE_VERSION,
                  note: "bàn tay mở",
                  fingers: rig.shapeFingers("open").slice(0, 10),
                }
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
      ...(kind === "held"
        ? {
            sample: findOf("held", "coc") && load("held", "coc"),
            groups: heldGroupTable(),
          }
        : {}),
      ...(kind === "hands"
        ? {
            sample: findOf("hands", "peace") && load("hands", "peace"),
            builtin: rig.HAND_POSE_KINDS,
          }
        : {}),
    });
  }),
);

server.registerTool(
  "list",
  {
    description:
      "Liệt kê file: characters, actions, scenes, held (kèm `schemaVersion` của file, `groups`: nhóm cầm áp được cho cỡ tay 1, chi tiết ở describe_held; `named`: kiểu cầm có tên của món {group, name, base, note, hold} — gọi bằng `variant` hay dạng tắt `hold`; `roles`: vai trò của món, khai hay suy — `role` lọc theo vai trò, vd. `vessel` là món `gen pour` rót vào được), hands (dáng tay có tên kèm `note`; gọi bằng `world.hands[].right|left.pose`) hoặc pieces (PNG cho hiệu ứng vật rời tay, kèm kích thước). characters, actions, held, hands và pieces gồm cả bộ chung, `layer` cho biết file nằm ở workspace hay common; file cùng tên thì workspace đè. `match` lọc theo tên file không đuôi (phẩy ngăn, `*` khớp mọi chuỗi: `bow-*,nod-*-3d`); actions có `match` thì mỗi hàng kèm `note` (làm gì, ghi kênh nào, cần nền gì, chồng với gì) và `preview` — chọn hành động chung bằng nó, bảng cả bộ ở docs 01 § Bộ hành động 3D.",

    inputSchema: {
      kind: z.enum([...KINDS, "pieces"]),
      match: z
        .string()
        .optional()
        .describe("Lọc tên file không đuôi: phẩy ngăn, `*` khớp mọi chuỗi (`bow-*,nod-*-3d`)"),
      role: z
        .enum(["pourer", "vessel"])
        .optional()
        .describe(
          "`held`: chỉ món mang vai trò này (khai hay suy, như describe_held) — `vessel` là món làm đích rót được, `pourer` là bình",
        ),
    },
  },
  guard(({ kind, match, role }) => {
    if (role && kind !== "held") return fail("`role` chỉ lọc `held`");
    const want = match && globs(match);
    const files = listFiles(kind).filter(
      ({ file: f }) => !want || want.test(f.replace(/\.(json|png)$/, "")),
    );
    const rows = files.map(({ file: f, path: p, layer }) => {
      const at = LAYERS[kind].length > 1 ? { layer } : {};
      if (kind === "pieces") {
        const { w, h } = R.pngSize(readFileSync(p));
        return { file: f, ...at, width: w, height: h };
      }
      const r = SCHEMAS[kind].parse(R.readJson(p));
      return r.success
        ? {
            file: f,
            ...at,
            ...(kind === "held"
              ? heldListRow(r.data, f.replace(/\.json$/, ""))
              : kind === "hands"
                ? { note: r.data.note }
                : { name: r.data.name }),
            ...(kind === "actions" ? { mask: rig.actionMask(r.data) } : {}),
            ...(kind === "actions" && want ? { note: r.data.note, preview: r.data.preview } : {}),
          }
        : { file: f, ...at, error: issues(r.error) };
    });
    return text({
      dir: DIRS[kind],
      ...(LAYERS[kind].length > 1 ? { common: LAYERS[kind][1] } : {}),
      files: role ? rows.filter((r) => r.roles?.includes(role)) : rows,
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
        ...rig.sceneLaunchProblems(rt),
        ...rig.sceneStopProblems(rt),
        ...rig.sceneTurnProblems(rt),
        ...(rig.sceneWalkInProblems?.(rt) ?? []),
        ...(rig.sceneWalkYawProblems?.(rt) ?? []),
        ...sceneSnapLines(rt),
        ...(rig.sceneHoldProblems?.(rt) ?? []),
        ...(rig.elbowLockIdle?.(rt) ?? []).map(rig.elbowLockIdleLine),
      ];
      // `check` coi là lỗi: người 3D diễn hành động không soạn ở `side` ở kênh tay chân, mốc món sai hướng hay không tay nào cầm
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
    const named = kind === "hands" && rig.handShapeNameProblem(basename(p).replace(/\.json$/, ""));
    if (named) return fail(`hands/${basename(p)}: ${named}`);
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
      "Vẽ một nhân vật (tên file hoặc object inline) thành người 3D thật bằng three (Chromium headless) như video — dựng khối, bàn tay năm ngón, vật liệu NPR, bóng — một mình giữa plainRoom(), ghi PNG ra đĩa và trả về đường dẫn. Mỗi ô là một hành động: tên (giây 0) hay { action, t } với t tỉ lệ 0–1 của một lượt; hành động gập hai đùi (sit-3d) thì người ngồi trên ghế chuẩn. equip chọn vật trong character.items, xem describe_rig. yaw là hướng mặt (độ, 0 = +x, 90 = −z về ống kính), pitch là góc cúi ống kính.",
    inputSchema: {
      character: Spec,
      poses: z.array(CellSpec).default([
        { action: "stand-3d", t: 0 },
        { action: "sit-3d", t: 0 },
      ]),
      equip: EquipSpec,
      yaw: YawSpec,
      pitch: PitchSpec,
      size: SizeSpec,
      software: SoftwareSpec,
      cols: z.number().int().positive().optional(),
      scale: z.number().positive().default(0.5),
      name: z.string().optional(),
    },
  },
  guard(async ({ character, poses, equip, yaw, pitch, size, software, cols, scale, name }) => {
    const { character: c } = loadCharacter(character);
    const bad = rig.equipProblems(c, equip);
    if (bad.length) throw new Error(`equip: ${bad.join("; ")}`);
    const tag = slug(name ?? (typeof character === "string" ? character : c.name));
    const actions = allActions();
    const cells = poses.map((p) => {
      const spec = typeof p === "string" ? { action: p, t: 0 } : p;
      const a =
        typeof spec.action === "string" ? actions[spec.action] : loadSpec("actions", spec.action);
      if (!a) throw new Error(`không có hành động ${spec.action}`);
      return { action: a, time: spec.t * a.duration, label: `${a.name} ${spec.t}` };
    });
    return soloThreeTool({
      character: equip ? rig.equipCharacter(c, equip) : c,
      cells,
      yaw,
      pitch,
      size,
      software,
      cols,
      scale,
      out: outPath(tag, "three"),
    });
  }),
);

server.registerTool(
  "render_action",
  {
    description:
      "Vẽ một hành động (tên file hoặc object inline) thành dải frames đều nhau trong một chu kỳ, trên một nhân vật (mặc định: nhân vật rỗng): người 3D thật bằng three (Chromium headless) như video, một mình giữa plainRoom(), qua ống kính cúi pitch độ, mặt quay yaw độ (0 = +x, 90 = −z về ống kính).",
    inputSchema: {
      action: Spec,
      character: Spec.optional(),
      frames: z.number().int().min(2).max(48).default(8),
      yaw: YawSpec,
      pitch: PitchSpec,
      size: SizeSpec,
      software: SoftwareSpec,
      cols: z.number().int().positive().optional(),
      scale: z.number().positive().default(0.5),
      name: z.string().optional(),
    },
  },
  guard(async ({ action, character, frames, yaw, pitch, size, software, cols, scale, name }) => {
    const a = loadSpec("actions", action);
    const c = character ? loadCharacter(character).character : rig.defaultCharacter();
    return soloThreeTool({
      character: c,
      cells: Array.from({ length: frames }, (_, i) => {
        const t = +(i / (frames - 1)).toFixed(3);
        return { action: a, time: t * a.duration, label: `${t}` };
      }),
      yaw,
      pitch,
      size,
      software,
      cols: cols ?? Math.min(frames, 4),
      scale,
      out: outPath(slug(name ?? (typeof action === "string" ? action : a.name)), "three"),
    });
  }),
);

server.registerTool(
  "render_scene",
  {
    description:
      'Dải khung một scene (tên file hoặc object inline), mỗi ô một mốc thời gian, cả khung đã qua camera. Cảnh có `scene.lens` thì mỗi ô là khung three thật mà video vẽ (Chromium headless; cảnh `worldOf` của stickman.world: bàn tay năm ngón, áo dựng khối, bóng, phòng, đồ riêng, món cầm tay — cảnh repo không dựng thì plainRoom()); cảnh không có lens thì ô vẽ nền, lớp vẽ code và hiệu ứng. Mốc lấy đều bằng `from`/`to`/`cols`/`every`, hay chỉ đích danh bằng `times`. `trails` / `ghosts` vẽ đè vệt khớp và bóng que xương của người 3D để soi chuyển động trong một ô: chấm mỗi khung (dồn là chậm, thưa là nhanh), đuôi mảnh nét đứt là đã qua, đầu mập nét liền là sắp tới, mũi tên chỉ chiều đi, màu theo bên người, vòng đứt kèm số n là sự kiện máy đo (khựng, giật, quay gắt, vào / dừng gắt); phần chữ kèm ảnh có cách đọc ngắn, bảng sự kiện #n (clip, giây và `t` trong hành động, `keys[i]` kẹp quanh, số góc đổi kèm tên, gợi ý sửa) và số đo từng vệt. `skeleton: true` thay khung three bằng que xương người 3D hai màu bên trên lưới sàn chiếu qua lens (soi nhịp, chân nào bước, chiều sâu); `views: ["top"]` thêm ô nhìn từ trên xuống.',
    inputSchema: {
      scene: Spec,
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
      trails: z
        .array(z.string())
        .optional()
        .describe(
          "Vệt khớp vẽ đè mỗi ô: tên khớp như `check` đo (wristR, footL, head, hip…) hay `hands`, `feet`, `all`; lọc người bằng `cast`",
        ),
      span: z.number().positive().default(1).describe("Vệt lấy trong ± ngần này giây quanh mỗi ô"),
      fps: z
        .number()
        .positive()
        .max(240)
        .optional()
        .describe("Nhịp chấm của vệt; mặc định `stickman.snap.fps` của package.json hay 30"),
      relative: z
        .boolean()
        .default(false)
        .describe("Trừ phần dời của hông so với khung của ô: người đang đi vẫn thấy cung tay chân"),
      ghosts: z
        .number()
        .int()
        .min(0)
        .max(12)
        .default(0)
        .describe("Số bóng que xương mỗi phía (trước nét đứt, sau nét liền)"),
      ghostStep: z.number().positive().default(0.1).describe("Giây giữa hai bóng que xương"),
      skeleton: z
        .boolean()
        .default(false)
        .describe(
          "Chỉ người 3D, không nền: lưới sàn chiếu qua lens, viền hộp đồ khối, que xương (phải hồng, trái xanh lục lam, đoạn gần ống kính nét to); đi chung trails / ghosts",
        ),
      views: z
        .array(z.enum(["top"]))
        .optional()
        .describe("Với skeleton: `top` thêm ô nhìn từ trên xuống mặt sàn x–z mỗi mốc"),
      size: SizeSpec,
      software: SoftwareSpec,
      cast: z.string().optional(),
      character: z.string().optional(),
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
      scale,
      name,
      times: picked,
      trails,
      span,
      fps,
      relative,
      ghosts,
      ghostStep,
      skeleton,
      views,
    } = input;
    const motion =
      trails?.length || ghosts || skeleton
        ? {
            trails,
            span,
            fps: fps ?? snapFps(),
            relative,
            ghosts,
            ghostStep,
            cast,
            snap: snapThresholds(),
          }
        : undefined;
    const s = loadSpec("scenes", scene);
    const id = typeof scene === "string" ? basename(scene).replace(/\.json$/, "") : s.name;
    // Đo `aspect` từng lớp nền trước `resolveScene` — số khai trong JSON chỉ là cái đệm lần trước
    const bgUrls = R.mountBg(s, LAYERS.bg);
    const { rt } = loadScene(s);
    const times =
      picked?.map((x) => rig.markTime(x, rt.marks, "times")) ??
      R.sampleTimes({ from, to: to ?? rt.duration, cols, every });
    const tag = slug(name ?? (typeof scene === "string" ? scene : s.name));
    const notes = [];
    const cache = {};
    const common = {
      rt,
      times,
      fallback: character,
      loadCharacter: (f) => (cache[f] ??= loadCharacter(f)),
      loadPiece: (f) => (cache[`piece:${f}`] ??= R.mountPiece(f, LAYERS.pieces)),
    };
    if (s.lens && !skeleton) {
      const data = cli.worldData(WS);
      const px = R.threeSize(input.size, rt.frame);
      const r = await R.renderThree({
        ...common,
        root: WS,
        id,
        scene: s,
        data,
        size: input.size,
        software: input.software,
        motion,
        cols: Math.min(cols, times.length, 4),
        scale: (scale * px.w) / rt.frame.w,
        out: outPath(tag, "three"),
      });
      notes.push(threeNote(r), ...r.warnings);
      return text(
        `duration ${rt.duration}s, mốc: ${times.join(", ")}\n${report([r])}${notes.map((n) => `\n${n}`).join("")}${guideOf([r])}`,
      );
    }
    let bones;
    if (skeleton) {
      const { world, warn } = await probeWorld(id, s, rt);
      if (warn) notes.push(`${warn} — bỏ hộp vật của cảnh three`);
      bones = { cast, views, world: world ?? undefined };
    }
    const r = R.renderFrames({
      ...common,
      bgUrls,
      // Lớp vẽ code của repo — docs/10-lop-ve-code.md
      codeLayers: await R.loadLayers(WS),
      motion,
      skeleton: bones,
      scale: scale * 0.6,
      cols: Math.min(cols, times.length),
      out: outPath(tag, skeleton ? "skeleton" : "stage"),
    });
    notes.push(...(r.warnings ?? []));
    return text(
      `duration ${rt.duration}s, mốc: ${times.join(", ")}\n${report([r])}${notes.map((n) => `\n${n}`).join("")}${guideOf([r])}`,
    );
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
      "Số liệu một scene tại các mốc giây: chỗ đứng, tư thế và nét mặt của từng người, kèm toạ độ vai / khuỷu / cổ tay / bàn chân và khối đầu, đọc bằng anchorAt của rig nên đúng hệ toạ độ chỗ vẽ của lớp SVG đè lên khung (`viewBox` của camera, y xuống). `anchors` hỏi thêm mốc trên người 3D, mỗi mốc trả {x, y, deg, w, h}: tâm hộp, góc SVG và cỡ hộp đã nhân scale, cắm thẳng vào translate/rotate của một <g> trong lớp vẽ code. Dùng để tính điểm gặp, bám hiệu ứng vào người thay vì đoán. Kèm cả `world`: khớp hông/gối/bàn chân/vai/khuỷu/cổ tay/cổ/đầu trong toạ độ thế giới, yaw vẽ, yawSaid, yawHeading (người đi: hướng nhắm theo path), theta, seated, near (tay gần là tay phải hay trái), hands (đích thế giới đang áp), palms (người mặc đồ: lòng bàn tay phải/trái quay về đâu — úp/ngửa/vào thân/ra ngoài/ra trước/ra sau —, down: góc lệch khỏi úp, pháp tuyến lòng tay, hướng ngón, tâm; có stickman.world thì kèm on/gap: vật có mặt ngang dưới bàn tay và khe tới nó; tay khai đích theo mốc thân hay palm/fingers thì kèm aim: reach {to, point, gap — khe rig từ điểm bàn tay tới mốc}, palmOff / fingersOff — độ lệch còn lại so với hướng đã khai) — đặt tay lên mặt hay đổi turn/elbow xong thì đọc palms, đừng phán bằng mắt. Có stickman.world thì người đang cầm đồ (hold) kèm held.right / held.left: món, dáng vẽ (pose) và dáng hành động khai (declared), follow, pierce {core, depth, piece} — đốt có trục vào trong lưới món sâu nhất (core, ngưỡng check 1,25; depth là da lún qua mặt món, âm là khe), wrap — nhóm ngón chạm món (thumb, index, fingers, palm), gaps, grip — tâm nắm tới mặt món (âm là trong món), palm {gap, angle}, up / face — góc lệch trục ý định của món (userData.hold, đường cũ), hold — khoá lần cầm nhóm `món@nhóm/biến thể/phần/cạnh/ngón cái` (không có là đường cũ), grasp — chỗ cầm nhóm rig đã giải {group, mode (item: món đặt trước, hand: tay dẫn), keyed (cầm một tay theo mốc: món theo bàn tay), t0, choice {part, feature, edge, along, thumb, variant, slant, around, tilt, psi, inset — trường đã điền}, by (từng trường của choice do `scene` khai, `rig` giải hay `default` nhóm), arm {phi: góc khuỷu quanh trục vai–cổ tay (độ), wrist {turn, bend, dev, over (độ vượt kẹp), off (lệch bàn tay vẽ khỏi chỗ cầm)}, body (lấn thân), gap (khe tầm với)}}, intent {rule, toward, want, got, err, clamped} — ý định trục chính bộ giải nhắm, hướng muốn / đạt (thế giới rig), góc còn lệch, khớp cổ tay kẹp, reach {kind: support | item, point, to, gap} — tay phụ hay điểm `item:` còn cách đích, rel — món trong khung bàn tay (so hai mốc giây để thấy món trôi), issues — luật đồ cầm check sẽ kêu. Cảnh có lens và người 3D kèm `clashes`: mỗi mốc giây, các chỗ phần người lồng vào đồ khối hay vào người khác sâu quá ngưỡng của check (stickman.clash.tol, mặc định 2) ({who, with, depth}) — rig không đẩy người ra khỏi đồ. Repo khai stickman.world và worldOf trả cảnh thì đồ là mọi vật của cảnh three ấy, đúng như check (who theo cú pháp touch: `a.foreArmR`); cảnh three hỏng thì `warnings` kể lỗi và mốc ấy đo bằng khối lớp vẽ code. `snaps`: các cú tay chân giật trên hình của cả cảnh (có `cast` thì của người ấy), cùng dòng báo và ngưỡng (stickman.snap) với check; cố ý giật thì khai `snap: true` ở hành động, ở clip hay ở mốc world.hands. Repo khai stickman.world thì kèm `roles`: mỗi mốc giây, vai trò của đồ của cảnh three ({name: tên vật, owner: số thứ tự Item trong nhóm Batch, entries: [{role, name?, …toạ độ thế giới rig — seat/footrest {at, size, front}, armrest/backrest {from, to, width, front?}, tabletop {y, poly, thick}, vessel {mouth}}], errors?}) — chọn `table`, `armrest`, `backrest`, `footrest` của gen sit (`vật` hay `vật#mục`) và `cup` của gen pour từ đây.",
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
        .describe("Mốc muốn hỏi thêm trên người 3D, xem describe_rig `anchors`"),
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
      const raw = file ? loadSpec("characters", file) : rig.defaultCharacter();
      const c = raw;
      for (const time of times) {
        const at = rig.sceneAt(rt, m.id, time, c.rig.height, rig.body3(c));
        // `anchorAt` đã gồm chỗ đứng, `scale` và lật
        const box = (name) => {
          const a = rig.anchorAt(rt, m.id, name, time, raw);
          return {
            x: +a.x.toFixed(1),
            y: +a.y.toFixed(1),
            deg: +a.deg.toFixed(1),
            w: +a.w.toFixed(1),
            h: +a.h.toFixed(1),
          };
        };
        const put = (name) => {
          const { x, y, deg } = box(name);
          return { x, y, deg };
        };
        const pt = (name) => {
          const { x, y } = box(name);
          return [x, y];
        };
        rows.push({
          id: m.id,
          t: time,
          x: +at.x.toFixed(1),
          y: +at.groundY.toFixed(1),
          scale: +at.scale.toFixed(3),
          flip: at.flip,
          pose: at.pose,
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
          world: world3(rt, m.id, time, c, at),
          ...(anchors?.length
            ? { anchors: Object.fromEntries(anchors.map((n) => [n, box(n)])) }
            : {}),
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
    let roles;
    const warnings = new Set();
    if (rt.lens && rt.cast.length && cli.clashesAt) {
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
      // Mặt ngang dưới bàn tay: khe từ điểm thấp nhất của bàn tay
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
      // Vai trò của đồ của cảnh three ở từng giây: agent chọn `table`, `cup`… của `gen` từ đây — docs/13-vai-tro-do.md
      if (world && typeof world.rig?.rolesOf === "function") {
        roles = {};
        for (const time of times) {
          try {
            world.scene.pose(time);
            world.scene.root.updateMatrixWorld(true);
            roles[time] = world.rig.rolesOf(world.scene.root).map(propBrief);
          } catch (e) {
            warnings.add(`${rel}: không đọc được vai trò ở giây ${time} — ${e.message}`);
          }
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
            // món treo trên cánh tay (`món@carry`): số đo riêng ở `world.carry`
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
      ...(roles ? { roles } : {}),
      ...(warnings.size ? { warnings: [...warnings] } : {}),
      ...(snaps.length ? { snaps } : {}),
    });
  }),
);

/** Món tối thiểu (một tấm) cho `schema(held)` */
const HELD_EXAMPLE = {
  schemaVersion: rig.HELD_VERSION,
  size: [44, 1.1, 58],
  front: "front",
  top: "top",
  anchors: {
    front: { at: [0, 1.1, 0], dir: [0, 1, 0] },
    back: { at: [0, 0.1, 0], dir: [0, -1, 0] },
    top: { at: [0, 0.6, -29], dir: [0, 0, -1] },
    center: { at: [0, 0.6, 0] },
  },
  shape: [{ box: [44, 1, 58], at: [0, 0.6, 0] }],
};

const r2 = (n) => +n.toFixed(2);
const roundAll = (o) =>
  Array.isArray(o)
    ? o.map(roundAll)
    : o && typeof o === "object"
      ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, roundAll(v)]))
      : typeof o === "number"
        ? r2(o)
        : o;

/** Miền một trường lựa chọn của nhóm; `fits` (khối hình áp được) cho miền suy trên khối hình (phần, cạnh, mặt) */
function choiceDomain(key, c, fits) {
  if (c.kind === "range")
    return roundAll({
      min: c.min,
      max: c.max,
      ...(c.default !== undefined ? { default: c.default } : {}),
      ...(c.names ? { names: c.names } : {}),
      ...(c.byVariant ? { byVariant: c.byVariant } : {}),
    });
  if (c.values)
    return { values: c.values, ...(c.default !== undefined ? { default: c.default } : {}) };
  if (!fits)
    return {
      from:
        key === "thumb"
          ? "mặt của khối hình"
          : key === "part"
            ? "phần của món"
            : "cạnh của khối hình",
    };
  const vals = new Set();
  let degrees = false;
  for (const f of fits.map((x) => x.feature)) {
    if (key === "part") vals.add(f.part);
    else if (key === "edge") {
      if (f.kind === "slab") f.edges.forEach((e) => vals.add(e.name));
      else if (f.kind === "disc") {
        f.rim.forEach((n) => vals.add(n));
        degrees = true;
      }
    } else if (key === "thumb" && (f.kind === "slab" || f.kind === "disc"))
      f.faces.forEach((x) => vals.add(x.name));
  }
  return { values: [...vals], ...(degrees ? { degrees: true } : {}) };
}

/** Số đo gọn của một khối hình (`Feature` của `itemGeom`); mặt (`face`) là suy từ hộp và trụ, không liệt kê */
function featureBrief(f) {
  const size = (h) => h.map((x) => r1(2 * x));
  switch (f.kind) {
    case "slab":
      return {
        kind: f.kind,
        part: f.part,
        size: size(f.half),
        t: r2(f.t),
        lying: f.lying,
        faces: f.faces.map((x) => x.name),
        edges: f.edges.map((e) => ({ name: e.name, len: r1(e.len) })),
      };
    case "disc":
      return {
        kind: f.kind,
        part: f.part,
        radius: r1(f.radius),
        t: r2(f.t),
        lying: f.lying,
        faces: f.faces.map((x) => x.name),
        rim: f.rim,
      };
    case "rod":
      return { kind: f.kind, part: f.part, len: r1(f.len), r: r1(f.r), R: r1(f.R) };
    case "lathe":
      return {
        kind: f.kind,
        part: f.part,
        len: r1(f.len),
        rMax: r1(f.rMax),
        ...(f.mouth ? { mouth: f.mouth } : {}),
        profile: f.profile.map(([s, r]) => [r1(s), r1(r)]),
      };
    case "box":
      return { kind: f.kind, part: f.part, size: size(f.half) };
    default:
      return null;
  }
}

/** Nhóm cầm áp được cho món với cỡ tay `dims`: `{ groups, unfit, later }` */
function heldGroupsOf(data, geom, dims) {
  const groups = [];
  const unfit = [];
  const later = [];
  for (const id of rig.GROUP_IDS) {
    const spec = rig.GRIP_GROUPS[id];
    if (spec.later) {
      later.push(id);
      continue;
    }
    const fits = rig.groupFits(geom, spec, dims, data.anchors);
    if (!fits.length) {
      unfit.push({
        group: id,
        label: spec.label,
        needs: spec.needs.map((n) => n.text),
        ...(spec.anchors ? { anchors: spec.anchors } : {}),
      });
      continue;
    }
    const lead = fits.map((x) => x.feature).find((f) => f.kind === "slab" || f.kind === "disc");
    groups.push({
      group: id,
      label: spec.label,
      hold: `<tên món>@${id}`,
      hands: spec.hands,
      variants: Object.keys(spec.variants),
      ...named(data, id),
      features: fits.map((x) => ({
        ...featureBrief(x.feature),
        ...(x.ratio !== undefined ? { ratio: r2(x.ratio), warn: x.warn } : {}),
      })),
      choices: Object.fromEntries(
        Object.entries(spec.choices).map(([k, c]) => [k, choiceDomain(k, c, fits)]),
      ),
      defaults: roundAll(rig.holdDefaults(spec, geom, lead ? { feature: lead } : {})),
    });
  }
  return { groups, unfit, later };
}

/** Bảng nhóm cầm không theo món (cho `schema(held)`) */
function heldGroupTable() {
  return rig.GROUP_IDS.map((id) => {
    const s = rig.GRIP_GROUPS[id];
    return {
      group: id,
      label: s.label,
      hands: s.hands,
      ...(s.later ? { later: true } : {}),
      needs: s.needs.map((n) => n.text),
      ...(s.anchors ? { anchors: s.anchors } : {}),
      variants: Object.keys(s.variants),
      choices: Object.fromEntries(
        Object.entries(s.choices).map(([k, c]) => [k, choiceDomain(k, c)]),
      ),
    };
  });
}

/** Kiểu cầm có tên của món cho nhóm `id` (`{ name, base, note? }`), rỗng thì không có trường */
function named(data, id) {
  const list = rig.namedVariants(data, id);
  return list.length ? { named: list } : {};
}

/** Hàng `list(held)` của món `item`: nhóm áp được cho cỡ tay 1, kiểu cầm có tên của món */
function heldListRow(data, item) {
  const all = rig.GROUP_IDS.flatMap((id) =>
    rig.namedVariants(data, id).map((x) => ({ group: id, ...x, hold: `${item}@${id}/${x.name}` })),
  );
  const named = all.length ? { named: all } : {};
  const roles = heldRoleIds(data);
  try {
    const geom = rig.itemGeom(data);
    const { groups } = heldGroupsOf(data, geom, rig.handDims(1));
    return {
      schemaVersion: data.schemaVersion,
      groups: groups.map((g) => g.group),
      ...named,
      roles,
    };
  } catch (e) {
    return { schemaVersion: data.schemaVersion, groups: [], ...named, roles, error: e.message };
  }
}

/** Một vật mang vai trò (`rolesOf`) cho `scene_probe`: tên, chủ, mục thế giới rig làm tròn, lỗi zod / phép đặt */
function propBrief(p) {
  return {
    name: p.name,
    ...(p.owner !== undefined ? { owner: p.owner } : {}),
    entries: p.roles.map((r) => roundAll(r)),
    ...(p.errors.length ? { errors: p.errors } : {}),
  };
}

/** Vai trò của món (khai cộng suy, `heldRoles`), không trùng; rig chưa có vai trò thì rỗng */
function heldRoleIds(data) {
  if (!rig.heldRoles) return [];
  try {
    return [...new Set(rig.heldRoles(data).roles.map((r) => r.role))];
  } catch {
    return [];
  }
}

/** `roles` của `describe_held`: mục khai và suy (`source`), giá trị đã giải ra khung món, cảnh báo lệch */
function heldRolesBrief(data) {
  if (!rig.heldRoles) return undefined;
  const d = (v) => roundAll(Array.from(v));
  try {
    const { roles, warnings } = rig.heldRoles(data);
    return {
      entries: roles.map((r) =>
        r.role === "pourer"
          ? {
              role: r.role,
              ...(r.name ? { name: r.name } : {}),
              source: r.source,
              lip: d(r.lip),
              spout: d(r.spout),
              spoutSource: r.spoutSource,
              ...(r.axis
                ? { axis: { at: d(r.axis.at), dir: d(r.axis.dir), part: r.axis.part } }
                : {}),
            }
          : {
              role: r.role,
              ...(r.name ? { name: r.name } : {}),
              source: r.source,
              ...(r.part ? { part: r.part } : {}),
              mouth: { at: d(r.mouth.at), r: +r.mouth.r.toFixed(2), dir: d(r.mouth.dir) },
            },
      ),
      warnings,
    };
  } catch (e) {
    return { entries: [], warnings: [], error: e.message };
  }
}

server.registerTool(
  "describe_held",
  {
    description:
      "Mô tả một món cầm tay (file trong `held/` hay object inline): `roles` — vai trò cho bộ sinh (`entries`: mục khai và suy, `source` `declared` | `inferred`, giá trị đã giải ra khung món — `pourer` {lip, spout, spoutSource, axis}, `vessel` {mouth {at, r, dir}, part}; `warnings`: khai lệch hình, vd. `spout` lệch hướng suy quá 30°), phần (`parts`, nhãn `part` của `shape`, `grip`, `as`), khối hình rig suy ra (`features`: tấm, đĩa, thanh, trụ tiện, hộp — kích thước, tên mặt và cạnh), khung (`front`, `top`, `right`, miệng), mốc, `seats`, và các nhóm cầm áp được ở cỡ tay `scale`/`long` (mặc định 1): khối hình khớp (kèm `ratio` so với bề ngang lòng tay, `warn` từ 0,8), trường lựa chọn với miền, mặc định rig, dòng `hold` viết tắt cho `world.hands[].hold` và `named` — kiểu cầm có tên của món ở nhóm ấy (`name`, `base`, `note`; gọi bằng `variant: <name>` hay `món@nhóm/<name>`). `unfit` nêu nhóm không áp được và điều kiện của nó, `later` là nhóm chưa làm. docs/11-nhom-cam.md, docs/04-mcp.md.",
    inputSchema: {
      item: z.union([z.string(), z.object({}).passthrough()]),
      scale: z.number().positive().optional(),
      long: z.number().positive().optional(),
    },
  },
  guard(({ item, scale, long }) => {
    const data = loadSpec("held", item);
    const name =
      typeof item === "string" ? withJson(basename(item)).replace(/\.json$/, "") : undefined;
    const k = scale ?? 1;
    const dims = rig.handDims(k, long ?? k);
    const out = {
      ...(name ? { item: name, layer: layerName("held", dirname(findOf("held", name))) } : {}),
      schemaVersion: data.schemaVersion,
      size: data.size,
    };
    const geom = rig.itemGeom(data);
    const sd = (d) => roundAll(Array.from(d));
    Object.assign(out, {
      hand: roundAll({ scale: k, ...dims }),
      frame: {
        front: data.front ?? null,
        top: data.top ?? null,
        F: sd(geom.F),
        U: sd(geom.U),
        right: sd(geom.R),
        ...(geom.mouth ? { mouth: sd(geom.mouth) } : {}),
      },
      anchors: data.anchors,
      ...(data.seats ? { seats: data.seats } : {}),
      parts: geom.parts.map((p) => ({
        name: p.name,
        grip: p.grip,
        blocks: p.blocks.length,
        min: p.min.map(r1),
        max: p.max.map(r1),
        ...(data.parts?.[p.name]?.as ? { as: data.parts[p.name].as } : {}),
        ...(data.parts?.[p.name]?.axis !== undefined ? { axis: data.parts[p.name].axis } : {}),
      })),
      ...(geom.blocked.length
        ? {
            blocked: geom.blocked.map((b) => ({
              part: b.part,
              min: b.min.map(r1),
              max: b.max.map(r1),
            })),
          }
        : {}),
      features: geom.features.map(featureBrief).filter(Boolean),
    });
    const g = heldGroupsOf(data, geom, dims);
    Object.assign(out, { groups: g.groups, unfit: g.unfit, later: g.later });
    const roles = heldRolesBrief(data);
    if (roles) out.roles = roles;
    for (const row of out.groups) row.hold = row.hold.replace("<tên món>", name ?? "<tên món>");
    return text(out);
  }),
);

/** Số đo một bàn tay đang cầm đồ (`HeldHand` của rig) cho `scene_probe`: số làm tròn, kèm các luật `check` sẽ kêu */
function carryProbe(h) {
  return {
    item: h.item,
    hold: h.hold,
    on: h.on,
    seat: r1(h.seat),
    ...(h.shift ? { shift: r1(h.shift) } : {}),
    ...(h.bend !== undefined ? { bend: Math.round(h.bend), rise: Math.round(h.rise) } : {}),
    body: {
      gap: r1(h.body.gap),
      part: h.body.part,
      ...(h.body.allow ? { allow: h.body.allow } : {}),
    },
    issues: rig.carryHits ? rig.carryHits(h).map((x) => x.rule) : [],
  };
}

/** Chỗ cầm nhóm đã giải (`GraspReport`): lựa chọn, nguồn của từng trường (`scene` / `rig` / `default`) và số đo tay */
function graspProbe(g) {
  return {
    group: g.group,
    mode: g.mode,
    ...(g.keyed ? { keyed: true } : {}),
    t0: r2(g.t0),
    choice: roundAll(g.choice),
    by: g.by,
    arm: roundAll({
      phi: g.arm.phi,
      wrist: g.arm.wrist,
      body: g.arm.body,
      ...(g.arm.bodyPart ? { bodyPart: g.arm.bodyPart, bodyRatio: g.arm.bodyRatio } : {}),
      gap: g.arm.gap,
    }),
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
    ...(h.grasp ? { grasp: graspProbe(h.grasp) } : {}),
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
function world3(rt, id, time, c, at) {
  const w = at.world;
  const f3 = rig.figure3d(rig.equipCharacter(c, at.equip), at.pose, w);
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
    joints: Object.fromEntries(JOINTS3.map((k) => [k, v3(f3.joints[k])])),
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

/** Một hàng độ lệch của `hold_mode`, số làm tròn để đọc */
const holdModeRow = (r) => {
  const n = (x) => +x.toFixed(2);
  return {
    t: n(r.t),
    ...(r.ref !== undefined && { ref: r.ref }),
    kind: r.kind,
    item: r.item && { pos: n(r.item.pos), angle: n(r.item.angle) },
    hand: Object.fromEntries(Object.entries(r.hand).map(([k, v]) => [k, n(v)])),
    ...(r.phi && { phi: { before: n(r.phi.before), after: n(r.phi.after) } }),
    clamped: r.clamped,
    ...(r.elbowLock && { elbowLock: true }),
    ...(r.blending && { blending: true }),
  };
};

server.registerTool(
  "hold_mode",
  {
    description:
      'Đổi chế độ một lần cầm giữa đồ theo tay (mốc tay dẫn: `at`/`to`, `point`, ý định) và tay theo đồ (mốc món `items[]`, mốc tay chỉ còn `hold`) — docs/11-nhom-cam.md § Đổi chế độ lần cầm. `to: "item"`: mỗi mốc tay của lần cầm sinh một mốc món ở cùng `t` (giữ `@mốc±Δ`) từ món đang vẽ, `to` + `offset` khi mốc tay dùng `to`, hướng bằng `face`/`roll` vectơ hệ thân, `ease: "auto"`; mốc tay bỏ đích, ý định, ghi các trường chỗ cầm rig đã dùng mà cảnh chưa khai. Mốc mà chế độ mới chọn khuỷu khác khuỷu đang vẽ nhận `elbow` hướng khuỷu đang vẽ + `elbowLock: true` (cả hai chiều), giữ khi món lệch ít hơn; `elbow` ghi theo hệ của đích mốc ấy (mốc có `at` thế giới, mốc khác hệ thân), `elbow` đã khai đổi hệ khi đích của mốc đổi; cảnh đời trước chỉ khác số `schemaVersion` thì `ops` nâng luôn số ấy. `to: "hand"`: ngược lại — mốc tay nhận đích ở tâm nắm đang vẽ (`point: "grip"`, mốc món có `point` thì `item:<mốc>`), ý định `face`+`roll` vectơ hệ thân, `elbow` theo khuỷu đang vẽ; mốc món của lần cầm bị xoá; tay kia cầm cùng món thành `both` của tay dẫn. `from` giữa lần cầm: chèn mốc `regrip` ở đó, chỉ đổi phần sau. Trả `ops` (JSON Patch RFC 6902 trên JSON thô của cảnh, áp theo thứ tự), `rows` (từng mốc và giữa hai mốc: món dời `item.pos` đơn vị rig, quay `item.angle` độ, tâm nắm dời `hand`, `phi` khuỷu trước/sau, khớp cổ tay kẹp trước/sau, `elbowLock` ở mốc khoá khuỷu, `blending` khi đang hoà giữa hai lần cầm), `max` (lệch lớn nhất ở mốc, trừ lúc hoà), `outside` (ngoài quãng đổi), `blend`, `notes`. Phép đổi không khớp tuyệt đối: hai chế độ chọn khuỷu khác nhau, cổ tay kẹp thì món lệch — đọc `rows` trước khi ghi. `write: true` (cảnh là file) vá thẳng chữ của file (giữ thứ tự, trường lạ, định dạng), bản cũ ở `<file>.json.bak`.',
    inputSchema: {
      scene: Spec,
      cast: z.string().describe("Người cầm (`cast[].id`)"),
      side: z
        .enum(["right", "left"])
        .describe("Tay của lần cầm; tay phụ hay tay kia cầm cùng món thì quy về tay dẫn"),
      at: z.union([z.number(), z.string()]).describe("Một giây trong lần cầm, hay `@mốc±Δ`"),
      to: z.enum(["item", "hand"]).describe("`item`: tay theo đồ; `hand`: đồ theo tay"),
      from: z
        .union([z.number(), z.string()])
        .optional()
        .describe("Chỉ đổi từ giây này tới hết lần cầm; giữa lần cầm thì chèn mốc `regrip`"),
      write: z.boolean().default(false),
    },
  },
  guard(async ({ scene, cast, side, at, to, from, write }) => {
    const file = typeof scene === "string" ? findOf("scenes", scene) : null;
    if (typeof scene === "string" && !file) return fail(`không có scenes/${withJson(scene)}`);
    const before = file ? readFileSync(file, "utf8") : null;
    const raw = before ? JSON.parse(before) : scene;
    const rebuild = (json) => {
      const r = rig.parseScene(json);
      if (!r.success) throw new Error(issues(r.error));
      const { rt } = loadScene(r.data);
      // người không khai `character` vẽ bằng nhân vật mặc định, như `check`
      for (const m of r.data.cast) rt.chars[m.id] ??= rig.defaultCharacter();
      return rt;
    };
    const run = to === "item" ? rig.holdToItemLed : rig.holdToHandLed;
    const r = run(rebuild(raw), raw, { id: cast, side, at, from, rebuild });
    const out = {
      scope: r.scope,
      max: r.max,
      outside: r.outside,
      blend: r.blend,
      notes: r.notes,
      rows: r.rows.map(holdModeRow),
      ops: r.ops,
    };
    if (!write) return text(out);
    if (!file) return fail("`write` cần cảnh là tên file trong `scenes/`");
    if (!RAW)
      return fail("@stickman3d/cli của workspace không có `rawjson.mjs`: không vá chữ được");
    const next = rig.applyJsonPatch(raw, r.ops);
    const body = await RAW.formatLike(before, next);
    writeFileSync(`${file}.bak`, before);
    writeFileSync(file, body);
    return text({ wrote: file, ...out });
  }),
);

server.registerTool(
  "docs",
  {
    description:
      "Spec rig của chính version đang cài — nguồn sự thật cho mọi hành vi, đọc trước khi viết JSON. Không có `file` thì trả mục lục. `file` nhận tiền tố: `03` ra `03-scene.md`. Docs không nằm trong repo video, nó đi theo package đã pin nên không lệch version được. Bộ hành động chung (có gì theo nhóm, xem ở Studio 3D → Thư viện, cách đặt tên, chọn bằng `list` có `match`) ở `01` § Bộ hành động 3D.",
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
      "Dựng workspace cho một repo video trong thư mục đang mở: scenes kèm cảnh 3D mẫu vi-du-3d, episodes trống, characters/actions/pieces trống (bộ chung là lớp dưới), app Remotion, stickman.md / AGENTS.md / CLAUDE.md / README.md / .mcp.json / package.json. Spec rig thì không chép — đọc bằng tool `docs`. Không đè file có sẵn trừ khi force.",

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
      "Nâng workspace lên bộ `@stickman3d` đang cài: chép lại app Remotion và stickman.md / .mcp.json / .npmrc / pnpm-workspace.yaml, trộn số version vào package.json. Không đụng characters / actions / scenes / held / episodes / pieces, cũng không đụng AGENTS.md / README.md / CLAUDE.md / .gitignore (chỉ phát lúc init — AGENTS.md là chỗ repo video ghi luật riêng). Docs không có ở đây vì không có bản chép — chúng đi theo package. File đã sửa tay thì theo `modified`, mỗi bản mẫu chỉ hỏi một lần; chạy `dryRun` trước để xem sẽ đè cái gì.",
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
  "gen",
  {
    description:
      "Sinh một hành động cho đúng một cảnh từ chỗ người và đồ trong cảnh ấy, tự kiểm trên chính cảnh (cổ tay so với kẹp, tầm với, khuỷu đi một chiều, điểm tiếp xúc trôi, các dòng `check` move/clash/held/roles mới so với cảnh chưa có hành động) rồi mới ghi `actions/<name>.json`; không đạt thì báo lỗi, không ghi. Tham số như cờ của `stickman gen`. Đồ tìm theo VAI TRÒ (docs/13-vai-tro-do.md): món cầm tay khai `roles` trong `held/` (describe_held, list({kind: held, role})), đồ của cảnh three khai `Item.roles` / `withRoles` (scene_probe trả `roles`). Mỗi kiểu khai các slot (vai trò cần, bắt buộc khi nào, tìm thế nào, cờ nào chỉ đích danh) — trả ở `slots` của kết quả và in ở `stickman gen <kiểu> --help`. Cờ của slot nhận tên vật (`ghe-banh`), `vật#mục` (`ban-an#tren`), số (đồ ảo dựng qua đúng RoleSchema) hay `none` (bỏ slot dùng-nếu-có; không tắt va chạm của vật); tên vật không mang vai trò thì lỗi kèm danh sách vật mang vai trò ấy. Kiểu `pour` (rót): bình là món tay phải đang cầm (không thì `item`, mặc định `binh`) mang `pourer`; đích `cup` là `<người>` cầm món mang `vessel`, `<người>:<món>`, món ở `items[]`, vật của cảnh three mang `vessel`, hay điểm `x,y,z`; điểm rót đứng yên trên tâm miệng khi nâng đuôi bình, ra ngoài miệng thì cảnh báo. Trả bảng tự kiểm, `lip` (đích hệ thân so với `chest`), `dir`, `pourer` (điểm rót, hướng rót, phần cầm đã giải) và `snippet` (clip và mốc `hands` để dán). Kiểu `sit` (ngồi): dáng ngồi nền lặp thở cho người đang ngồi (`world.sit` hay mốc `sit` của `path`) ở giây `at` — mặt ngồi dưới hông (`seat`), lưng ghế, tay vịn, để chân của cùng ghế và bàn trước mặt tự tìm theo vai trò; góc chân cho đế giày trên sàn hay để chân, đùi chỉ chúi tới khi mặt dưới đùi lún mép trước mặt ngồi `THIGH_SINK` (không tới thì chân `square` thõng, kiểu khác lỗi, `feet: floor` thì lỗi; hông không bao giờ dời); `legs` `bent` | `square` | `straight` | `staggered` (`tuck` chân co), `back` `upright` | `recline` | `forward` (tựa thì vừa chạm lưng ghế, không có lưng ghế thì −12° kèm cảnh báo), `hands` `thighs` | `table` | `armrest` | `fold` (`elbow`, `top`). Tự kiểm thêm luật mặt ngồi (điểm ngồi lệch mặt, mông lọt mép, ngồi nông, đùi lún mép trước), đế giày trên mặt đỡ hay chân thõng, lòng tay trên đùi / mặt bàn, cẳng tay trên tay vịn, lòng tay trên mu tay, gối dưới mặt bàn, lưng với lưng ghế (vật phép tính dùng hay chỉ bằng cờ: lấn là lỗi; vật chỉ tự tìm để kiểm: cảnh báo). Trả `legs`, `torso`, `roles` (đồ đã chọn cho từng slot), `snippet.clip` thay clip nền ở giây ấy. Kiểu `walk` (đi, không cần vai trò, docs/14-di-muot.md): người đi qua các điểm sàn `to` từ giây `at`; bộ sinh viết mốc `world.path` (`yaw` theo hướng đi, mốc giữa đường là đích mềm — rẽ khi đang đi, không dừng – xoay – đi; góc quá 100° hay `radius` thì bo cung), giây từng mốc theo `speed`, clip đi `cycle` khớp sải, clip `after` ở mốc dừng, cú quay tại chỗ và quay rồi đi, thay mọi mốc và clip của track từ `at`, tự kiểm số đo đi (cảnh báo, chưa chặn) và `check` move/clash/held so với cảnh trước khi vá, rồi vá JSON thô `scenes/<id>.json` (bản cũ ở `.bak`; `hash` khác bytes trên đĩa là lỗi). Trả `path`, `clips`, `checks`, `metrics`, `strips` (cửa sổ dải khung dày từng chỗ rẽ, dừng, quay — lệnh `stickman-render` in ở `lines`), `hash`, `wrote` — docs 05 § Sinh hành động theo cảnh.",
    inputSchema: {
      kind: z
        .enum(["pour", "sit", "walk"])
        .describe(
          "Kiểu sinh: `pour` rót, `sit` dáng ngồi nền, `walk` đi (ghi `path` và clip vào cảnh)",
        ),
      scene: z.string().describe("Id cảnh (tên file bỏ .json)"),
      cast: z.string().describe("Id người rót / người ngồi / người đi trong `cast`"),
      at: z
        .union([z.number().min(0), z.string()])
        .optional()
        .describe(
          "Giây cảnh clip bắt đầu: rót (bắt buộc; sự kiện `pour` sau 1,26 s), ngồi (mặc định 0, thay clip nền bắt đầu ở giây ấy), đi (số hay `@mốc±s`; bắt buộc khi người đã có `path`, thay mốc và clip từ giây ấy)",
        ),
      to: z
        .union([
          z.string(),
          z.array(
            z.object({
              at: z.tuple([z.number(), z.number()]),
              stop: z.boolean().optional(),
              yaw: z.number().optional(),
            }),
          ),
        ])
        .optional()
        .describe(
          '`walk` (bắt buộc): điểm sàn thế giới rig — chuỗi `"x,z x,z! x,z!yaw"` như cờ `--to` hay mảng `{ at: [x, z], stop?, yaw? }`. Điểm thường là mốc giữa đường (rẽ khi đang đi, đích mềm tới 100°, quá thì bo cung); `stop` dừng, quay tại chỗ tới hướng quãng sau rồi đi; `yaw` chỉ ở điểm cuối: dừng rồi quay tới yaw. Điểm cuối luôn là mốc dừng',
        ),
      speed: z
        .number()
        .positive()
        .optional()
        .describe(
          "`walk`: đơn vị thế giới mỗi giây dọc đường (mặc định tốc tự nhiên của `action`)",
        ),
      action: z.string().optional().describe("`walk`: hành động đi tới (mặc định `walk`)"),
      start: z
        .enum(["rest", "moving"])
        .optional()
        .describe(
          "`walk`: `rest` (mặc định) người đứng yên ở `at` rồi khởi hành; `moving` vào cảnh đang đi (clip đi `blend 0`, người chưa có `path` trước `at`)",
        ),
      radius: z
        .number()
        .min(0)
        .optional()
        .describe("`walk`: bán kính bo các góc rẽ khi đang đi (0 = đích mềm; vòng chữ U thì ~125)"),
      turnTime: z
        .number()
        .min(0.5)
        .max(2)
        .optional()
        .describe("`walk`: giây cho mỗi 90° quay tại chỗ (mặc định 0,8)"),
      turnSide: z
        .enum(["auto", "right", "left"])
        .optional()
        .describe("`walk`: chiều cú quay đúng 180° (`auto`: giữa cú quay mặt về phía ống kính)"),
      hold: z
        .number()
        .min(0.2)
        .optional()
        .describe("`walk`: giây đứng yên ở điểm cuối (mặc định 0,6)"),
      track: z
        .string()
        .optional()
        .describe(
          "`walk`: track ghi clip (mặc định track đang lái chân lúc `at`, không có thì `chan`)",
        ),
      after: z
        .string()
        .optional()
        .describe("`walk`: hành động sau mỗi mốc dừng (mặc định `stand-3d`)"),
      blend: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe(
          "`walk`: `blend` của clip đi (trừ clip vào cảnh đang đi) và clip sau (mặc định 0,3)",
        ),
      hash: z
        .string()
        .optional()
        .describe(
          "`walk`: sha của file cảnh agent đã có (`hash` / `wrote.hash` của lần gọi trước); file trên đĩa khác thì lỗi, không ghi",
        ),
      cup: z
        .string()
        .optional()
        .describe(
          "`pour` (slot `cup`, vai trò `vessel`): `<người>` cầm món mang `vessel`, `<người>:<món>`, `<món>` của `items[]`, `<vật>` của cảnh three mang `vessel`, hay `x,y,z` thế giới rig (đích dạng điểm)",
        ),
      style: z
        .enum(["single", "serve"])
        .optional()
        .describe("`pour`: rót một tay (mặc định) hay mời khách hai tay"),
      tilt: z
        .number()
        .optional()
        .describe("`pour`: góc nghiêng hết, độ (mặc định theo kiểu: 100 / 88)"),
      pourDir: z
        .number()
        .optional()
        .describe(
          "`pour`: hướng rót, độ từ ra ngoài về trước (mặc định theo kiểu: 180 / 30); không đạt thì thử hướng lân cận và báo",
        ),
      name: z
        .string()
        .optional()
        .describe(
          "Tên file hành động (mặc định pour[-serve]-<cảnh>-<người>-3d, sit-<cảnh>-<người>-3d)",
        ),
      item: z
        .string()
        .optional()
        .describe(
          "`pour` (slot `bottle`, vai trò `pourer`): bình khi tay phải người rót chưa cầm gì (mặc định `binh`)",
        ),
      legs: z
        .enum(["bent", "square", "straight", "staggered"])
        .optional()
        .describe(
          "`sit`: chân co (bàn chân lùi dưới mép ghế, gót nhấc), vuông góc (mặc định), duỗi (gót trên sàn), so le (một co một duỗi)",
        ),
      tuck: z
        .enum(["near", "far"])
        .optional()
        .describe("`sit` `staggered`: chân co là chân gần hay xa ống kính (mặc định `far`)"),
      feet: z
        .enum(["free", "floor"])
        .optional()
        .describe(
          "`sit`: `free` (mặc định) đế giày chạm sàn hay để chân nếu với tới, không thì chân `square` thõng (đùi nằm trên mặt ngồi, khe in ở `lines`) — `bent`, `straight` dựng ống chân về phương đứng tới ±10° rồi lỗi, `staggered` đổi chân không chạm được sang vuông; `floor` bắt buộc chạm, không được thì lỗi nói vì sao (đùi lún mép trước mặt ngồi hay ngoài tầm kiểu chân). Không bao giờ dời hông",
        ),
      back: z
        .enum(["upright", "recline", "forward"])
        .optional()
        .describe(
          "`sit`: lưng thẳng (mặc định), tựa ra sau (ngả tới lưng ghế của ghế hay `backrest`, không có thì −12°), nghiêng về trước",
        ),
      hands: z
        .enum(["thighs", "table", "armrest", "fold"])
        .optional()
        .describe(
          "`sit`: tay úp trên đùi (mặc định, lòng tay theo mặt trên đùi), đặt trên bàn (`table`: bàn trước mặt tự tìm hay cờ `table`), khuỷu và cẳng tay trên tay vịn (`armrest`: tay vịn hai bên của ghế hay cờ `armrest`; bàn tay thả, vượt đầu tay vịn thì buông xuống), khuỷu trên tay vịn và hai bàn tay chồng trước bụng (`fold`)",
        ),
      elbow: z
        .number()
        .optional()
        .describe(
          "`sit` `armrest` | `fold`: dời khuỷu dọc tay vịn khỏi chỗ tự nhiên (rig ở height 1, dương ra trước); bù bằng góc thân trong tầm kiểu lưng và chỗ khuỷu trên bề ngang tay vịn, không đặt được thì lỗi nêu tầm dời được",
        ),
      top: z
        .enum(["near", "far"])
        .optional()
        .describe("`sit` `fold`: bàn tay gần hay xa ống kính nằm trên (mặc định `near`)"),
      table: z
        .string()
        .optional()
        .describe(
          "`sit` (slot `table`, vai trò `tabletop`): tên vật, `vật#mục`, `y` mặt bàn hay `y,mép gần` (đồ ảo, mép gần trước hông), `none` không kiểm bàn; bỏ trống là bàn trước mặt trong tầm",
        ),
      armrest: z
        .string()
        .optional()
        .describe(
          "`sit` (slot `armrest`, vai trò `armrest`, mỗi bên một mục): tên vật (không nhận `#mục`) hay `x,y,z` giữa mặt trên đầu trước một tay vịn (đồ ảo đối xứng); bỏ trống là tay vịn của cùng ghế",
        ),
      backrest: z
        .string()
        .optional()
        .describe(
          "`sit` (slot `backrest`, vai trò `backrest`): tên vật, `vật#mục`, khoảng từ hông lùi tới mặt trước lưng ghế (đồ ảo) hay `none`; bỏ trống là lưng ghế của cùng ghế",
        ),
      footrest: z
        .string()
        .optional()
        .describe(
          "`sit` (slot `footrest`, vai trò `footrest`): tên vật, `vật#mục`, `y` bệ để chân (đồ ảo) hay `none` (bàn chân xuống `world.floor`); bỏ trống là để chân của cùng ghế (thanh hẹp thì thanh dưới đế giày)",
        ),
      force: z
        .boolean()
        .default(false)
        .describe("Ghi dù tự kiểm không đạt, đè file không phải gen sinh"),
      dryRun: z.boolean().default(false).describe("Chỉ tính và kiểm, không ghi"),
    },
  },
  guard(async ({ kind, ...o }) => {
    if (!GEN) return fail("bản @stickman3d/cli đang cài chưa có `stickman gen`");
    const slots = GEN.GEN_KINDS?.[kind]?.roles;
    let r;
    try {
      r = await GEN.genWorkspace({ kind, dir: WS, ...o });
    } catch (e) {
      // lỗi tìm slot kèm danh sách vật mang vai trò đã nằm trong dòng báo
      return fail(slots ? `${e.message}\n\n${GEN.slotTable(kind)}` : e.message);
    }
    const { action, world, scene, ...rest } = r;
    return text({
      ...rest,
      ...(kind !== "walk" && { scene }),
      check: world?.rows ?? [],
      ...(action && { action: action.name }),
      ...(slots?.length ? { slots } : {}),
    });
  }),
);

server.registerTool(
  "check",
  {
    description:
      "Soi workspace: version đã pin so với @stickman3d/rig đang cài, JSON hỏng, lớp vẽ code gói được không và `scenes` của nó có trỏ đúng tên cảnh, và công cụ ngoài (rsvg-convert / ffmpeg / ffprobe / magick) thiếu trên PATH. Soi cả workspace chậm: sửa xong một cảnh thì truyền `scene` — chỉ soi cảnh khớp (cảnh báo của chúng, kèm mọi lỗi), bỏ tập, tiếng, git. Sửa gì thì chỉ chạy nhóm luật của thứ ấy (`only`): chỗ đứng, path → move; tay → move (+held nếu đang cầm); đồ cầm, chỗ cầm, `held/` → held (+ref khi sửa `held/<món>.json`); bối cảnh, đồ khối → clash (+roles khi sửa vai trò `Item.roles` / `withRoles`: zod, vai trò lệch hình khối cùng vật, người ngồi lệch mặt ngồi); hành động chung → `uses` tên ấy + ref,move,held. Nhóm `legacy` kể đồ cầm còn đi đường cũ (`hold` không có chỗ cầm nhóm), bỏ bằng `skip`. Nhóm `clash` (người lồng vào đồ, tay xuyên thân) chỉ chạy khi gọi tên trong `only`. Nhóm không chạy thì không dựng thứ nó cần. Cuối lô thì đủ nhóm trên các cảnh vừa đổi với `baseline` để chỉ thấy cảnh báo mới; cả workspace chỉ ở cuối tập hay sau khi nâng rig. Kết quả kèm `time` (ms từng nhóm, cộng dồn mọi luồng).",
    inputSchema: {
      scene: z
        .string()
        .optional()
        .describe("Regex trên id cảnh (tên file bỏ .json), vd. `t03-s01-cd-haru` hay `^t03-s01`"),
      uses: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe(
          "Chỉ soi cảnh dùng các tên này: hành động, nhân vật (phẩy ngăn hay mảng); đi chung `scene` thì lấy cảnh khớp cả hai",
        ),
      only: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe(
          "Chỉ chạy các nhóm luật: ref, move, held, legacy, roles, clash, episode (phẩy ngăn hay mảng); không khai là mọi nhóm trừ clash",
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
            "2. Viết JSON: bảng màu, đầu/tóc/râu, socket dùng src: sculpt (dựng khối, không cần ảnh).\n" +
            "3. render_character với object inline, mở ảnh xem, sửa; không ghi cho tới khi ưng.\n" +
            "4. write, rồi render_character theo tên file một lần nữa để chốt.\n" +
            "Lưu ý: rig.height chỉ kéo dọc.",
        },
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());
