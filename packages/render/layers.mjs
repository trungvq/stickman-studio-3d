// Nạp mã của repo video: `package.json` khai `"stickman": { "layers": "src/lop.tsx",
// "parts": "src/parts.tsx", "world": "src/khoi3d/world.ts" }`, esbuild gói từng entry. Lớp vẽ code
// thì `<SceneWorld>` của @stickman3d/fx gọi năm chỗ móc — docs/10-lop-ve-code.md; bộ phận thì vào
// `PARTS` của rig qua `registerParts` — docs/02-trang-phuc.md; cảnh three thì `check` đo người lồng
// vào vật trên nó — docs/10-lop-ve-code.md#người-lồng-vào-đồ.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { registerParts } from "@stickman3d/sketch";

const req = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

/** Không gói lại: hai bản React là hai dispatcher hook khác nhau, hai bản rig là hai bảng hằng số */
const SHARED = /^(react|react-dom|@stickman3d\/(rig|sketch|fx))(\/|$)/;

const IMAGE = ["png", "jpg", "jpeg", "webp", "gif", "svg", "avif"];

/** Đường dẫn thật của entry `stickman[key]`, hay `null` nếu repo không khai */
function entryOf(root, key) {
  const pkg = join(root, "package.json");
  if (!existsSync(pkg)) return null;
  let json;
  try {
    json = JSON.parse(readFileSync(pkg, "utf8"));
  } catch {
    return null;
  }
  const rel = json.stickman?.[key];
  if (!rel) return null;
  const abs = resolve(root, rel);
  if (!existsSync(abs))
    throw new Error(`package.json khai stickman.${key} = "${rel}" nhưng không có file ${abs}`);
  return abs;
}

/** Đường dẫn thật của entry lớp, hay `null` nếu repo không khai */
export const layersEntry = (root = process.cwd()) => entryOf(root, "layers");

/** Đường dẫn thật của entry bộ phận, hay `null` nếu repo không khai */
export const partsEntry = (root = process.cwd()) => entryOf(root, "parts");

/** Đường dẫn thật của entry dựng cảnh three, hay `null` nếu repo không khai */
export const worldEntry = (root = process.cwd()) => entryOf(root, "world");

const stampOf = (root, inputs) =>
  inputs
    .map((f) => {
      try {
        return statSync(resolve(root, f)).mtimeMs;
      } catch {
        return 0;
      }
    })
    .join(",");

// Mã vẽ thuần theo `t`; render, MCP và studio gọi nó ngoài Remotion
const noRemotion = (what) => ({
  name: "stickman-no-remotion",
  setup(b) {
    b.onResolve({ filter: /^remotion(\/|$)/ }, (a) => ({
      errors: [
        {
          text: `${what} không được import "${a.path}" — hợp đồng là thuần theo \`t\`, studio, stickman-render và MCP đều gọi nó ngoài Remotion`,
        },
      ],
    }));
  },
});

async function bundle(root, entry, { platform, plugins, stdin, resolveExtensions, loader }) {
  try {
    const out = await build({
      ...(stdin
        ? { stdin: { contents: stdin, resolveDir: root, loader: "js" } }
        : { entryPoints: [entry] }),
      absWorkingDir: root,
      bundle: true,
      format: "esm",
      platform,
      target: platform === "node" ? `node${process.versions.node.split(".")[0]}` : "es2022",
      jsx: "automatic",
      metafile: true,
      write: false,
      logLevel: "silent",
      loader: { ...Object.fromEntries(IMAGE.map((e) => [`.${e}`, "dataurl"])), ...loader },
      ...(resolveExtensions && { resolveExtensions }),
      plugins,
    });
    return { code: out.outputFiles[0].text, inputs: Object.keys(out.metafile.inputs) };
  } catch (e) {
    const why = (e.errors ?? [])
      .map((x) => `${x.location ? `${x.location.file}:${x.location.line}: ` : ""}${x.text}`)
      .join("\n");
    throw new Error(`không gói được ${entry}\n${why || e.message}`);
  }
}

const cache = new Map();

/** React, rig, sketch, fx là bản của chính CLI: đồ của lớp và bộ phận đi thẳng vào `<SceneWorld>` của nó */
const sharedWithCli = {
  name: "stickman-shared",
  setup(b) {
    b.onResolve({ filter: SHARED }, (a) => {
      try {
        return { path: req.resolve(a.path), external: true };
      } catch {
        return { path: a.path, external: true };
      }
    });
  },
};

/**
 * Gói entry cho Node rồi `import` nó; gói lại khi file nguồn đổi, nên MCP không phải khởi động lại.
 * Mặc định chặn Remotion và dùng chung React, rig, sketch, fx với CLI; `opts` đè cách gói
 */
async function loadEntry(root, entry, prefix, what, opts = {}) {
  const key = `${prefix}:${entry}`;
  const hit = cache.get(key);
  if (hit && stampOf(root, hit.inputs) === hit.stamp) return hit.mod;

  const { code, inputs } = await bundle(root, entry, {
    platform: "node",
    plugins: [noRemotion(what), sharedWithCli],
    ...opts,
  });
  const dir = join(root, "node_modules", ".stickman");
  const file = join(
    dir,
    `${prefix}-${createHash("sha1").update(code).digest("hex").slice(0, 12)}.mjs`,
  );
  mkdirSync(dir, { recursive: true });
  if (!existsSync(file)) writeFileSync(file, code);
  for (const f of readdirSync(dir))
    if (f.startsWith(`${prefix}-`) && join(dir, f) !== file) rmSync(join(dir, f), { force: true });

  const mod = await import(pathToFileURL(file).href);
  cache.set(key, { mod, inputs, stamp: stampOf(root, inputs) });
  return mod;
}

/** Bảng `CODE_LAYERS` của repo video, hay `[]` nếu repo không khai lớp nào. */
export async function loadLayers(root = process.cwd()) {
  const entry = layersEntry(root);
  if (!entry) return [];
  const layers = (await loadEntry(root, entry, "layers", "lớp vẽ code")).CODE_LAYERS;
  if (!Array.isArray(layers))
    throw new Error(`${entry} phải \`export const CODE_LAYERS\` là một mảng lớp vẽ code`);
  return layers;
}

/**
 * Bảng `CODE_PARTS` của repo video, đã đăng ký vào `PARTS` của rig mà render vẽ bằng; `{}` nếu
 * repo không khai. Chỗ giữ bản rig riêng (MCP nạp rig theo version) gọi `registerParts` lần nữa.
 */
export async function loadParts(root = process.cwd()) {
  const entry = partsEntry(root);
  const parts = entry ? (await loadEntry(root, entry, "parts", "bộ phận vẽ code")).CODE_PARTS : {};
  if (!parts || typeof parts !== "object" || Array.isArray(parts))
    throw new Error(`${entry} phải \`export const CODE_PARTS\` là một bảng tên → PartDef`);
  registerParts(parts);
  return parts;
}

// Code dựng cảnh three hay nằm chung file với component Remotion: React và Remotion thành vỏ rỗng — đọc
// gì, gọi gì cũng ra vỏ rỗng, nên import và khai component chạy được, chỉ không vẽ gì. Tên import
// (`import { useVideoConfig }`) đi qua prototype mà `__toESM` của esbuild chép từ module
const HOLLOW = /^(remotion|@remotion\/[^/]+|react|react-dom)(\/|$)/;
const HOLLOW_JS = `"use strict";
const hollow = () => new Proxy(function () {}, {
  get: (_, k) => (k === "toString" || k === "valueOf" ? () => "" : typeof k === "symbol" || k === "then" || k === "__esModule" ? undefined : hollow()),
  getPrototypeOf: () => hollow(),
  apply: () => hollow(),
  construct: () => hollow(),
});
module.exports = hollow();
`;
const hollowReact = {
  name: "stickman-hollow",
  setup(b) {
    b.onResolve({ filter: HOLLOW }, (a) => ({ path: a.path, namespace: "stickman-hollow" }));
    b.onLoad({ filter: /.*/, namespace: "stickman-hollow" }, () => ({
      contents: HOLLOW_JS,
      loader: "js",
    }));
  },
};

/** Gói mà cảnh three của repo video dùng chung với rig của nó: một bản `three` là một `instanceof` */
const WORLD_SHARED = /^(three|zod|@stickman3d\/(rig|sketch|fx))(\/|$)/;
/** Chỗ dò gói khi repo video không cài: rig đi theo sketch của CLI */
const cliDirs = () => {
  const sketch = dirname(req.resolve("@stickman3d/sketch"));
  return [HERE, sketch];
};

/**
 * Rig, sketch, fx là bản repo video cài (không có thì bản của CLI); `three` và `zod` là bản mà rig
 * ấy nạp, nên `collide` của rig nhận đúng vật repo dựng. Mọi gói này để ngoài, đường dẫn tuyệt đối;
 * `inline` thì gói vào luôn (trang trình duyệt), vẫn một bản
 */
const sharedWithRepo = (root, inline = false) => ({
  name: "stickman-world-shared",
  setup(b) {
    const SKIP = Symbol("stickman-world-shared");
    const find = async (path, dirs, kind) => {
      for (const resolveDir of dirs) {
        const r = await b.resolve(path, { kind, resolveDir, pluginData: SKIP });
        if (!r.errors.length && r.path) return r.path;
      }
      return null;
    };
    let rigDir;
    b.onResolve({ filter: WORLD_SHARED }, async (a) => {
      if (a.pluginData === SKIP) return undefined;
      const dirs = [root, ...cliDirs()];
      if (/^(three|zod)(\/|$)/.test(a.path)) {
        rigDir ??= dirname((await find("@stickman3d/rig", dirs, a.kind)) ?? root);
        dirs.unshift(rigDir);
      }
      const path = await find(a.path, dirs, a.kind);
      if (path) return inline ? { path } : { path, external: true };
      return {
        errors: [{ text: `không tìm thấy gói "${a.path}" — repo video phải cài nó` }],
      };
    });
  },
});

/** `Path2D` rỗng cho code canvas của cảnh three trong Node: vẽ lên canvas rỗng của rig cũng không ra gì */
class BlankPath2D {
  constructor() {
    return new Proxy(this, { get: (t, k) => (k in t ? t[k] : () => undefined) });
  }
}

/**
 * Cảnh three của repo video, hay `null` nếu repo không khai `stickman.world`: `{ worldOf, collide,
 * colliders, U, heldHands, heldCarries, legacyHolds }` — `worldOf` của entry, các thứ sau của chính bản rig mà entry nạp
 * (`heldHands`, `heldCarries`, `legacyHolds` trống khi bản rig ấy chưa có). Đặt `Path2D`
 * rỗng vào `globalThis` khi Node không có. Hợp đồng ở docs/10-lop-ve-code.md#đo-trên-cảnh-three
 */
export async function loadWorld(root = process.cwd()) {
  const entry = worldEntry(root);
  if (!entry) return null;
  globalThis.Path2D ??= BlankPath2D;
  const mod = await loadEntry(root, entry, "world", "cảnh three", {
    plugins: [hollowReact, sharedWithRepo(root)],
    stdin: `export * as world from ${JSON.stringify(entry)};
export * from "@stickman3d/rig";`,
    resolveExtensions: [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".cjs", ".json"],
    loader: { ".css": "empty" },
  });
  if (typeof mod.world.worldOf !== "function")
    throw new Error(`${entry} phải \`export function worldOf(sceneName, rt)\``);
  return {
    worldOf: mod.world.worldOf,
    collide: mod.collide,
    colliders: mod.colliders,
    U: mod.U,
    heldHands: mod.heldHands,
    heldCarries: mod.heldCarries,
    legacyHolds: mod.legacyHolds,
  };
}

/**
 * Bảng `CODE_PARTS` gói cho trình duyệt, `null` nếu repo không khai. React và rig không gói
 * vào mà lấy của chính trang qua `globalThis.__stickman[<tên gói>]`: studio đặt sẵn trước khi
 * `import` — thêm tên gói dùng chung thì thêm cả ở `apps/studio/src/repoParts.ts`.
 */
export async function bundlePartsForBrowser(root = process.cwd()) {
  const entry = partsEntry(root);
  if (!entry) return null;
  const { code } = await bundle(root, entry, {
    platform: "browser",
    plugins: [
      noRemotion("bộ phận vẽ code"),
      {
        name: "stickman-page",
        setup(b) {
          b.onResolve({ filter: SHARED }, (a) => ({ path: a.path, namespace: "stickman-page" }));
          // CommonJS để esbuild tự đổi `import { x }` ra đọc thuộc tính, không phải liệt kê tên
          b.onLoad({ filter: /.*/, namespace: "stickman-page" }, (a) => ({
            contents: `const m = globalThis.__stickman?.[${JSON.stringify(a.path)}];
if (!m) throw new Error(${JSON.stringify(`studio không cấp "${a.path}" cho bộ phận vẽ code`)});
module.exports = m;`,
            loader: "js",
          }));
        },
      },
    ],
  });
  return code;
}

const pageCache = new Map();

/**
 * Trang trình duyệt vẽ cảnh three của repo video cho `stickman-render --three`: rig, `three` và module
 * `stickman.world` (nếu khai) gói chung một bản, rồi `boot(rig, world)` của `three-page.mjs`. Gói lại
 * khi file nguồn đổi
 */
export async function bundleThreePage(root = process.cwd()) {
  const entry = worldEntry(root);
  const key = `${root}:${entry}`;
  const hit = pageCache.get(key);
  if (hit && stampOf(root, hit.inputs) === hit.stamp) return hit.code;
  const page = join(HERE, "three-page.mjs");
  const { code, inputs } = await bundle(root, entry ?? page, {
    platform: "browser",
    plugins: [hollowReact, sharedWithRepo(root, true)],
    stdin: `import * as rig from "@stickman3d/rig";
${entry ? `import * as world from ${JSON.stringify(entry)};` : "const world = {};"}
import { boot } from ${JSON.stringify(page)};
boot(rig, world);`,
    resolveExtensions: [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".cjs", ".json"],
    loader: { ".css": "empty" },
  });
  pageCache.set(key, { code, inputs, stamp: stampOf(root, inputs) });
  return code;
}
