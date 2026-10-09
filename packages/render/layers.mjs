// Nạp mã vẽ của repo video: `package.json` khai `"stickman": { "layers": "src/lop.tsx",
// "parts": "src/parts.tsx" }`, esbuild gói từng entry. Lớp vẽ code thì `<SceneWorld>` của
// @stickman3d/fx gọi năm chỗ móc — docs/10-lop-ve-code.md; bộ phận thì vào `PARTS` của rig qua
// `registerParts` — docs/02-trang-phuc.md.
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
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { registerParts } from "@stickman3d/sketch";

const req = createRequire(import.meta.url);

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

async function bundle(root, entry, { platform, plugins }) {
  try {
    const out = await build({
      entryPoints: [entry],
      absWorkingDir: root,
      bundle: true,
      format: "esm",
      platform,
      target: platform === "node" ? `node${process.versions.node.split(".")[0]}` : "es2022",
      jsx: "automatic",
      metafile: true,
      write: false,
      logLevel: "silent",
      loader: Object.fromEntries(IMAGE.map((e) => [`.${e}`, "dataurl"])),
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

/** Gói entry cho Node rồi `import` nó; gói lại khi file nguồn đổi, nên MCP không phải khởi động lại */
async function loadEntry(root, entry, prefix, what) {
  const hit = cache.get(entry);
  if (hit && stampOf(root, hit.inputs) === hit.stamp) return hit.mod;

  const { code, inputs } = await bundle(root, entry, {
    platform: "node",
    plugins: [
      noRemotion(what),
      {
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
      },
    ],
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
  cache.set(entry, { mod, inputs, stamp: stampOf(root, inputs) });
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
