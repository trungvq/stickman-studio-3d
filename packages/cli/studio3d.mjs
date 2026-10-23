// `stickman studio`: Studio 3D (`apps/studio3d`) chạy trên dev server Vite, gốc là repo video. Đọc cảnh, món và `worldData`;
// ghi `scenes/` (`POST /api/scene`) và `held/` (`POST /api/held`), cả hai kiểm hash lúc nạp, vá JSON thô, giữ `.bak`.
// apps/studio3d/README.md.
import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { heldOptions, sceneShotSpans, snapOptions, SOURCES, worldData } from "./lib.mjs";
import { formatLike } from "./rawjson.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
/** Gói dùng chung giữa trang và file của repo video: một bản mỗi gói, lấy theo repo video */
const SHARED = /^(three|react|react-dom|zod|@stickman3d\/(rig|sketch|fx))(\/.*)?$/;
const NAME = /^[\w.-]+$/;

export const sha = (buf) => createHash("sha256").update(buf).digest("hex");

/** Thư mục thật của gói `name` thấy từ `from` (đi ngược lên qua các `node_modules`) */
function findPkg(from, name) {
  for (let d = resolve(from); ; d = dirname(d)) {
    const p = join(d, "node_modules", name);
    if (existsSync(join(p, "package.json"))) return realpathSync(p);
    if (dirname(d) === d) return null;
  }
}

/**
 * Rig, sketch, fx cho trang: bản repo video nạp (thiếu thì bản đi kèm CLI). Gói là cây nguồn (`link:`, không nằm trong
 * `node_modules`) thì trang lấy `src/`, cài từ registry thì `dist`. `tree` là gốc một monorepo rig: lấy `src/` của nó.
 */
export function rigSources(root, tree) {
  const dirs = tree
    ? Object.fromEntries(["rig", "sketch", "fx"].map((p) => [p, join(tree, "packages", p)]))
    : {
        sketch: findPkg(root, "@stickman3d/sketch") ?? findPkg(HERE, "@stickman3d/sketch"),
        fx: findPkg(root, "@stickman3d/fx") ?? findPkg(HERE, "@stickman3d/fx"),
      };
  dirs.rig ??=
    findPkg(root, "@stickman3d/rig") ?? (dirs.sketch && findPkg(dirs.sketch, "@stickman3d/rig"));
  const out = {};
  for (const [p, dir] of Object.entries(dirs)) {
    if (!dir) throw new Error(`Không thấy @stickman3d/${p} từ ${root} — pnpm install trước`);
    const src = !dir.split(sep).includes("node_modules") && existsSync(join(dir, "src/index.ts"));
    const at = (sub) => join(dir, src ? `src/${sub}.ts` : `dist/${sub}.js`);
    if (!existsSync(at("index")))
      throw new Error(`@stickman3d/${p} ở ${dir} chưa build (thiếu ${at("index")})`);
    out[p] = { dir, src, main: at("index"), ...(p === "rig" && { core: at("core/index") }) };
  }
  return out;
}

/** Lối vào `stickman.world` của `package.json` repo video: module có `worldOf(tên cảnh, ctx)` */
function worldEntry(root) {
  const rel = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).stickman?.world;
  return rel ? join(root, rel) : null;
}

/** Prettier của repo video (thiếu thì bản đi kèm CLI), theo cấu hình của repo ấy */
async function prettierFor(root) {
  let p;
  try {
    p = createRequire(join(root, "package.json"))("prettier");
  } catch {
    p = await import("prettier");
  }
  return (file) => async (text) =>
    p.format(text, { ...(await p.resolveConfig(file)), filepath: file, parser: "json" });
}

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/** Ghi `text` vào `file` qua file tạm (hỏng giữa chừng thì xoá file tạm); bản cũ (`old`) giữ ở `<file>.bak` */
export function writeWithBak(file, text, old) {
  if (old) writeFileSync(`${file}.bak`, old);
  mkdirSync(dirname(file), { recursive: true });
  const tmp = join(dirname(file), `.${basename(file)}.${randomUUID()}.tmp`);
  try {
    writeFileSync(tmp, text);
    renameSync(tmp, file);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

/** Hàng ghi theo từng file: mỗi lượt đọc – vá – ghi của một file chạy xong mới tới lượt sau */
const queues = new Map();
function serial(key, fn) {
  const run = (queues.get(key) ?? Promise.resolve()).then(fn);
  const tail = run.catch(() => {});
  queues.set(key, tail);
  tail.then(() => queues.get(key) === tail && queues.delete(key));
  return run;
}

/** Bỏ những chỗ studio được ghi (`cast[*].world.hands`, `items`) để so phần còn lại */
const outsideHands = (s) => ({
  ...s,
  items: undefined,
  cast: Array.isArray(s?.cast)
    ? s.cast.map((c) => (c?.world ? { ...c, world: { ...c.world, hands: undefined } } : c))
    : s?.cast,
});

/**
 * Món `raw` (JSON thô của `held/`) với bản soạn `authored` ở khoá `authored.<group>.<variant>` (`null` là xoá). Món còn kiểu
 * cầm có tên (`base` / `note`, trường của bản `version`) mà `schemaVersion` cũ hơn thì lên `version`
 */
export function heldWithAuthored(raw, group, variant, authored, version) {
  const out = { ...raw };
  const all = { ...out.authored };
  const byVariant = { ...all[group] };
  if (authored) byVariant[variant] = authored;
  else delete byVariant[variant];
  if (Object.keys(byVariant).length) all[group] = byVariant;
  else delete all[group];
  if (Object.keys(all).length) out.authored = all;
  else delete out.authored;
  const named = Object.values(all).some((g) =>
    Object.values(g).some((a) => a && (a.base !== undefined || a.note !== undefined)),
  );
  if (named && typeof out.schemaVersion === "number" && out.schemaVersion < version)
    out.schemaVersion = version;
  return out;
}

/**
 * Cảnh trên đĩa `disk` nhận `cast[*].world.hands` và `items` của bản studio `edited`; phần khác phải trùng. Bản studio
 * thiếu khoá nào thì khoá ấy trên đĩa giữ nguyên; xoá hết là gửi mảng rỗng, `items: null` bỏ cả khoá `items`.
 */
export function sceneWithHands(disk, edited) {
  const clean = (v) => JSON.parse(JSON.stringify(v));
  if (!isDeepStrictEqual(clean(outsideHands(disk)), clean(outsideHands(edited))))
    throw new HttpError(
      400,
      "studio chỉ ghi `cast[*].world.hands` và `items`; bản gửi lên đổi cả phần khác của cảnh",
    );
  const next = structuredClone(disk);
  next.cast.forEach((c, i) => {
    const hands = edited.cast[i].world?.hands;
    if (hands !== undefined) c.world.hands = hands;
  });
  if (edited.items === null) delete next.items;
  else if (edited.items !== undefined) next.items = edited.items;
  return next;
}

/**
 * Cấu hình Vite của Studio 3D. `dir` là repo video; `tree` (tuỳ chọn) là monorepo rig mà trang lấy mã nguồn; `heldOut`
 * đổi hướng ghi món sang thư mục ấy và đọc nó phủ lên `held/`; `app` là thư mục app (mặc định bản đi kèm CLI).
 */
export function studio3dConfig({
  dir = ".",
  tree,
  heldOut = process.env.STUDIO3D_HELD_OUT,
  app = SOURCES.studio3d,
} = {}) {
  const ROOT = resolve(dir);
  const HELD = join(ROOT, "held");
  const HELD_OUT = heldOut ? resolve(heldOut) : null;
  const ENTRY = worldEntry(ROOT);
  const R = rigSources(ROOT, tree);
  const cacheDir = join(tmpdir(), "stickman-studio3d", sha(`${ROOT}|${app}`).slice(0, 12));
  const format = prettierFor(ROOT);

  /** JSON thô và hash các món `held/` (lớp `heldOut` đè): `worldData` parse bằng rig bản dựng, có thể bỏ trường mới */
  const heldRaw = () => {
    const raw = {};
    const hash = {};
    for (const d of [HELD, HELD_OUT])
      if (d && existsSync(d))
        for (const f of readdirSync(d).filter((f) => f.endsWith(".json"))) {
          const buf = readFileSync(join(d, f));
          raw[f.slice(0, -5)] = JSON.parse(buf.toString("utf8"));
          hash[f.slice(0, -5)] = sha(buf);
        }
    return { raw, hash };
  };

  const json = (res, body, status = 200) => {
    res.statusCode = status;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(JSON.stringify(body));
  };
  const readBody = async (req) => {
    if (!/^application\/json\b/.test(req.headers["content-type"] ?? ""))
      throw new HttpError(415, "gửi JSON (`content-type: application/json`)");
    const chunks = [];
    for await (const c of req) chunks.push(c);
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (e) {
      throw new HttpError(400, `thân yêu cầu không phải JSON: ${e.message}`);
    }
  };
  const route = (fn) => async (req, res) => {
    try {
      json(res, await fn(req, new URL(req.url ?? "", "http://x").searchParams.get("name") ?? ""));
    } catch (e) {
      json(res, { error: e.message, ...e.extra }, e.status ?? 500);
    }
  };
  /** Bytes trên đĩa phải đúng hash lúc nạp */
  const fresh = (buf, hash, what) => {
    if (typeof hash !== "string") throw new HttpError(400, "thiếu `hash` của bản lúc nạp");
    if (buf === null || sha(buf) !== hash)
      throw new HttpError(
        409,
        `${what} đã đổi trên đĩa từ lúc nạp — nạp lại (R) rồi sửa lại, hay giữ bản mình để so`,
        { conflict: true, hash: buf && sha(buf) },
      );
  };

  const workspace = {
    name: "studio3d-workspace",
    configureServer(server) {
      const core = () =>
        R.rig.src ? server.ssrLoadModule(R.rig.core) : import(pathToFileURL(R.rig.core).href);

      server.middlewares.use("/api/scenes", (_req, res) => {
        const d = join(ROOT, "scenes");
        const names = existsSync(d)
          ? readdirSync(d)
              .filter((f) => f.endsWith(".json"))
              .map((f) => f.slice(0, -5))
              .sort()
          : [];
        json(res, { root: ROOT, world: ENTRY, names });
      });

      server.middlewares.use(
        "/api/scene",
        route(async (req, name) => {
          const file = join(ROOT, "scenes", `${name}.json`);
          if (!NAME.test(name) || !existsSync(file))
            throw new HttpError(404, `không có cảnh ${name}`);
          if (req.method === "GET") {
            const buf = readFileSync(file);
            const held = heldRaw();
            const data = worldData(ROOT);
            const snapOpts = snapOptions(ROOT);
            return {
              raw: JSON.parse(buf.toString("utf8")),
              hash: sha(buf),
              data,
              heldRaw: held.raw,
              heldHash: held.hash,
              heldOpts: heldOptions(ROOT),
              snapOpts,
              // quãng lên hình của `episodes/`: vệt đo giật như `check`
              ...(!snapOpts.off &&
                !snapOpts.error && { snapSpans: sceneShotSpans(ROOT, name, data) }),
              heldOut: HELD_OUT,
            };
          }
          if (req.method !== "POST") throw new HttpError(405, "chỉ GET, POST");
          // ghi `cast[*].world.hands` và `items` của bản studio vào JSON thô trên đĩa
          const { hash, scene } = await readBody(req);
          return serial(file, async () => {
            const buf = readFileSync(file);
            fresh(buf, hash, "cảnh");
            const text = buf.toString("utf8");
            const next = sceneWithHands(JSON.parse(text), scene);
            const parsed = (await core()).parseScene(next);
            if (!parsed.success)
              throw new HttpError(
                400,
                `cảnh sau khi ghi không qua schema: ${parsed.error.message}`,
              );
            const out = await formatLike(text, next, (await format)(file));
            // đọc lại, so, ghi liền một mạch không `await`: người khác ghi trong lúc định dạng thì 409
            const now = readFileSync(file);
            fresh(now, hash, "cảnh");
            writeWithBak(file, out, now);
            return { file, raw: next, hash: sha(out) };
          });
        }),
      );

      // kiểu cầm soạn tay của một món × nhóm × biến thể (`authored: null` là xoá)
      server.middlewares.use(
        "/api/held",
        route(async (req, name) => {
          if (req.method !== "POST") throw new HttpError(405, "chỉ POST");
          const source = () =>
            [HELD_OUT, HELD]
              .map((d) => d && join(d, `${name}.json`))
              .find((f) => f && existsSync(f));
          if (!NAME.test(name) || !source()) throw new HttpError(404, `không có held/${name}.json`);
          const { group, variant, authored, hash } = await readBody(req);
          if (typeof group !== "string" || typeof variant !== "string")
            throw new HttpError(400, "thiếu `group` / `variant`");
          const out = join(HELD_OUT ?? HELD, `${name}.json`);
          const what = `held/${name}.json`;
          return serial(out, async () => {
            const src = source();
            const buf = src ? readFileSync(src) : null;
            fresh(buf, hash, what);
            const text = buf.toString("utf8");
            const rig = await core();
            const raw = heldWithAuthored(
              JSON.parse(text),
              group,
              variant,
              authored,
              rig.HELD_VERSION,
            );
            const parsed = rig.parseHeldItem(raw);
            if (!parsed.success)
              throw new HttpError(400, `món sau khi ghi không qua schema: ${parsed.error.message}`);
            const body = await formatLike(text, raw, (await format)(join(HELD, `${name}.json`)));
            // như cảnh: đọc lại nguồn, so, ghi liền một mạch
            const at = source();
            const now = at ? readFileSync(at) : null;
            fresh(now, hash, what);
            writeWithBak(out, body, at === out ? now : null);
            return { file: out, item: raw, hash: sha(body) };
          });
        }),
      );
    },
  };

  /** Mỗi gói dùng chung một bản: tra từ repo video trước, rồi CLI, rồi sketch (rig là gói của sketch) */
  const bases = [ROOT, HERE, R.sketch.dir].map((d) => join(d, "__studio3d__.js"));
  const shared = {
    name: "studio3d-shared",
    enforce: "pre",
    async resolveId(id, _importer, opts) {
      if (!SHARED.test(id)) return null;
      for (const b of bases) {
        const r = await this.resolve(id, b, { ...opts, skipSelf: true });
        if (r) return r;
      }
      return null;
    },
  };

  const alias = [
    { find: "virtual:stickman-world", replacement: ENTRY ?? join(app, "src/no-world.ts") },
    // cảnh three của repo nạp `remotion` gián tiếp thì nhận bản rỗng, như `hollowReact` của render
    { find: /^(remotion|@remotion\/[^/]+)(\/.*)?$/, replacement: join(app, "src/hollow.ts") },
  ];
  // cây nguồn: trang và cảnh của repo video cùng một bản rig mã nguồn (sửa rig là trang nạp lại)
  if (R.rig.src)
    alias.unshift(
      { find: /^@stickman3d\/rig\/core$/, replacement: R.rig.core },
      { find: /^@stickman3d\/rig$/, replacement: R.rig.main },
    );
  for (const p of ["sketch", "fx"])
    if (R[p].src) alias.unshift({ find: new RegExp(`^@stickman3d/${p}$`), replacement: R[p].main });

  const trees = Object.values(R).map((r) => (r.src ? resolve(r.dir, "../..") : r.dir));
  return {
    root: app,
    cacheDir,
    clearScreen: false,
    plugins: [shared, workspace],
    resolve: { alias },
    server: {
      port: 5180,
      host: "localhost",
      fs: { allow: [...new Set([app, ROOT, cacheDir, ...trees])] },
    },
  };
}

/**
 * Chạy Studio 3D cho repo video `dir`. Chỉ nghe `localhost`: trang ghi thẳng `scenes/`, `held/` của repo; `host` khác
 * (`--host`) là mở cả hai đường ghi ra mạng ấy. `heldOut` trả về là thư mục ghi món khi đổi hướng (`STUDIO3D_HELD_OUT`).
 */
export async function serveStudio3d({ dir = ".", port = 5180, host = "localhost", heldOut } = {}) {
  const { createServer } = await import("vite");
  const config = studio3dConfig({ dir, heldOut });
  const server = await createServer({
    ...config,
    configFile: false,
    server: { ...config.server, port, host },
  });
  await server.listen();
  const out = heldOut ?? process.env.STUDIO3D_HELD_OUT;
  return {
    server,
    root: resolve(dir),
    heldOut: out ? resolve(out) : null,
    urls: server.resolvedUrls,
  };
}
