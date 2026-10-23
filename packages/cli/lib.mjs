// Khởi tạo, nâng cấp và kiểm workspace của một repo video. CLI và MCP server cùng gọi vào đây.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  accessSync,
  constants,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { availableParallelism, freemem } from "node:os";
import { basename, delimiter, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import * as rig from "@stickman3d/sketch";
import * as FX from "@stickman3d/fx";
import {
  layersEntry,
  loadLayers,
  loadParts,
  loadWorld,
  partsEntry,
  worldEntry,
} from "@stickman3d/render";
import { bundleScope, parseTokens } from "./scaffold/tools/scope.mjs";
import * as T from "./templates.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const pick = (inPkg, inRepo) =>
  existsSync(join(HERE, inPkg)) ? join(HERE, inPkg) : join(REPO, inRepo);

/** Nguồn để chép: nằm trong package khi đã publish, ở gốc monorepo khi chạy từ source */
export const SOURCES = {
  docs: pick("docs", "docs"),
  sample: pick("template", "apps/studio/public"),
  prompts: pick("prompts", "assets/sheets/prompts"),
  studio: pick("studio", "apps/studio/dist"),
  // Studio 3D chạy bằng Vite từ mã nguồn của app (`stickman studio`)
  studio3d: pick("studio3d", "apps/studio3d"),
  // Nguồn duy nhất của app Remotion; nằm trong chính package nên không phải `pick`
  scaffold: join(HERE, "scaffold"),
};

/**
 * Bộ chung đi theo studio: mảnh ảnh, hành động, động vật và nhân vật mẫu. Repo video không
 * chép chúng mà nạp làm lớp dưới `pieces/` / `actions/` / `animals/` / `characters/` của mình
 * — file trùng đường dẫn thì bản của repo đè. Studio, render, MCP, `check` và app Remotion đều
 * lấy lớp này từ đây.
 */
export const COMMON = {
  pieces: join(SOURCES.sample, "pieces"),
  actions: join(SOURCES.sample, "actions"),
  animals: join(SOURCES.sample, "animals"),
  characters: join(SOURCES.sample, "characters"),
  held: join(SOURCES.sample, "held"),
  hands: join(SOURCES.sample, "hands"),
};

/** Chép một lần lúc `init` làm mẫu, từ đó là của repo video */
const SEED_DIRS = ["scenes", "props", "episodes"];

/** Thư mục hậu kỳ: `init` dựng sẵn vì đều mọc lên giữa chừng ở tập đầu — docs/07 */
const KEEP_DIRS = [
  "assets/audio",
  "assets/bg",
  "assets/concept",
  "assets/sheets",
  "assets/thumbnail",
  "public/fonts",
];
/**
 * Thư mục app Remotion `require.context` vào: webpack đòi có thật trên đĩa, kể cả rỗng.
 * `actions/` và `animals/` thường rỗng suốt cả tập (bộ chung của studio là đủ), mà git
 * không giữ thư mục rỗng — clone lại là bundle vỡ. Nên chúng cũng cần `.gitkeep`.
 */
const CONTEXT_DIRS = ["characters", "actions", "animals", "held", "hands", "pieces"];
const DIRS = [...SEED_DIRS, ...CONTEXT_DIRS, ...KEEP_DIRS];
/** Thư mục có thể rỗng mà vẫn phải sống qua git */
const GITKEEP_DIRS = [...CONTEXT_DIRS, ...KEEP_DIRS];

/** Tiếng vượt chỗ ngần này giây thì mới kêu — chừa cho chỗ làm tròn frame và đuôi im lặng */
const CUE_SLACK = 0.05;

/** Bè phủ quãng đứng yên ngắn hơn ngần này giây thì im: nhịp nghỉ giữa hai clip đi là chuyện thường */
const CUE_STILL = 1;

/**
 * Người 3D lồng vào đồ: lấy mẫu mỗi `CLASH_EVERY` giây cảnh, chia đôi quãng nào có đỉnh khối người
 * dời quá `CLASH_MOVE` đơn vị thế giới (tới một khung `1/30 s`), nên tay quét qua mép bàn trong vài
 * khung vẫn bị bắt. Lấn quá `stickman.clash.tol` (mặc định `CLASH_TOL`) mới kêu
 */
const CLASH_EVERY = 0.25;
const CLASH_MOVE = 4;
const CLASH_TOL = 2;
/**
 * Đồ lồng vào đồ: lấn quá `stickman.clash.tol` **và** phần thể tích món nhỏ nằm trong món kia quá
 * `stickman.clash.items` (mặc định `ITEM_RATIO`; `false` là không đo) mới kêu
 */
const ITEM_RATIO = 0.1;

/** Công cụ ngoài mà repo video cần; không cái nào được `init` cài hộ — docs/07 */
const TOOLS = [
  ["rsvg-convert", "render PNG và dải ảnh"],
  ["ffmpeg", "TTS, tiếng động, phụ đề"],
  ["ffprobe", "đo độ dài tiếng, dò khung trắng"],
  ["magick", "cắt mảnh, đo mảnh"],
];
// index.json chỉ để bộ mẫu tĩnh của studio liệt kê; workspace thật đọc bằng File System Access API
const SKIP = (f) => f === "index.json" || f.endsWith(".bak");

/**
 * Version đọc thẳng từ `node_modules` trên đĩa, không qua `require.resolve`. Sau `pnpm add`,
 * pnpm trỏ symlink sang thư mục store mới nhưng cache phân giải của Node còn giữ đường cũ —
 * `pkgVersion` sẽ trả số cũ suốt vòng đời tiến trình. MCP so số này để nạp lại rig — docs/04.
 */
export function pkgVersionOnDisk(name, from = ".") {
  let d = resolve(from);
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

/** Version của một package như nó phân giải từ `from` */
export function pkgVersion(name, from = HERE) {
  try {
    const req = createRequire(join(resolve(from), "noop.js"));
    let d = dirname(req.resolve(name));
    for (let i = 0; i < 6; i++) {
      const p = join(d, "package.json");
      if (existsSync(p)) {
        const j = JSON.parse(readFileSync(p, "utf8"));
        if (j.name === name) return j.version;
      }
      d = dirname(d);
    }
  } catch {
    /* chưa cài */
  }
  return null;
}

const OWN = ["rig", "sketch", "fx", "render", "mcp", "cli"];
/**
 * Version của cả bộ, để pin đúng số vào repo video. Đã publish thì đọc `versions.json`
 * mà `prepack` ghi lúc đóng gói; chạy từ source thì đọc thẳng package.json anh em.
 */
export function versions() {
  const stamped = join(HERE, "versions.json");
  if (existsSync(stamped)) return JSON.parse(readFileSync(stamped, "utf8"));
  const out = {};
  for (const k of OWN) {
    const sibling = join(REPO, "packages", k, "package.json");
    out[k] = existsSync(sibling)
      ? JSON.parse(readFileSync(sibling, "utf8")).version
      : (pkgVersion(`@stickman3d/${k}`) ?? "0.0.0");
  }
  return out;
}

/** Băm nội dung để lần nâng cấp sau biết file có bị sửa tay hay không */
const hash = (body) => createHash("sha256").update(body).digest("hex").slice(0, 16);

function write(path, body, opt, log) {
  const rel = log.rel(path);
  if (existsSync(path) && !opt.force) return log.skip(rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
  log.wrote(rel, opt.track ? body : null);
}

const copyFile = (src, dst, opt, log) => write(dst, readFileSync(src), opt, log);

/** Chép cây thư mục, bỏ qua file phụ trợ của bộ mẫu, không đè file có sẵn */
function copyTree(src, dst, opt, log) {
  if (!existsSync(src)) return;
  for (const e of readdirSync(src, { withFileTypes: true })) {
    if (SKIP(e.name)) continue;
    const from = join(src, e.name);
    const to = join(dst, e.name);
    if (e.isDirectory()) copyTree(from, to, opt, log);
    else copyFile(from, to, opt, log);
  }
}

const logger = (dir) => {
  const wrote = [];
  const skipped = [];
  const files = {};
  return {
    wrote: (f, body) => {
      wrote.push(f);
      if (body !== null && body !== undefined) files[f] = hash(body);
    },
    skip: (f) => skipped.push(f),
    rel: (p) => relative(dir, p) || ".",
    report: () => ({ wrote, skipped, files }),
  };
};

const walk = (root, sub = "") =>
  existsSync(join(root, sub))
    ? readdirSync(join(root, sub), { withFileTypes: true }).flatMap((e) =>
        SKIP(e.name) ? [] : e.isDirectory() ? walk(root, join(sub, e.name)) : [join(sub, e.name)],
      )
    : [];

/** File chỉ có giá trị lúc dựng: repo video sở hữu nó từ đó, `upgrade` không đụng */
const SEED_ONLY = new Set([
  "AGENTS.md",
  "README.md",
  "CLAUDE.md",
  ".gitignore",
  "src/lop.tsx",
  "src/parts.tsx",
  "src/scene-wrap.tsx",
  "src/khoi3d/canh.ts",
]);

/**
 * Mọi file studio phát ra một workspace, `{ rel, body, seed }` — app Remotion và file cho
 * agent. Nguồn duy nhất cho cả `init` lẫn `upgrade`; nội dung của repo video (scenes,
 * characters, actions, pieces) không nằm đây và `upgrade` không đụng tới. Docs và prompt cũng
 * không: chúng đọc thẳng từ package đã pin, xem `listDocs`.
 * `package.json` cũng không: `init` ghi cả file, `upgrade` chỉ trộn lại số version.
 */
export function managedFiles({ rigVersion, project }) {
  const out = [];
  for (const f of walk(SOURCES.scaffold))
    out.push({ rel: f, body: readFileSync(join(SOURCES.scaffold, f)) });
  out.push({ rel: "stickman.md", body: T.stickmanMd({ rigVersion }) });
  out.push({ rel: "AGENTS.md", body: T.agents() });
  out.push({ rel: "CLAUDE.md", body: T.claude() });
  out.push({ rel: "README.md", body: T.readme({ name: project, rigVersion }) });
  out.push({ rel: ".gitignore", body: T.gitignore() });
  out.push({ rel: ".npmrc", body: T.npmrc() });
  out.push({ rel: ".mcp.json", body: T.mcpJson() });
  out.push({ rel: "pnpm-workspace.yaml", body: T.pnpmWorkspace() });
  return out.map((f) => ({ ...f, seed: SEED_ONLY.has(f.rel) }));
}

/** Dựng một workspace repo video: thư mục, bộ mẫu, app Remotion, file cho agent */
export function initWorkspace({ dir = ".", force = false, name } = {}) {
  const root = resolve(dir);
  const opt = { force };
  // `track` = file studio phát và `upgrade` chép lại; nội dung của repo video thì không
  const managed = { force, track: true };
  const log = logger(root);
  const v = versions();
  const project = name ?? basename(root);

  for (const d of DIRS) mkdirSync(join(root, d), { recursive: true });
  // Thư mục dựng sẵn nhưng có thể chưa có file nào; git không giữ thư mục rỗng
  for (const d of GITKEEP_DIRS) write(join(root, d, ".gitkeep"), "", opt, log);
  for (const d of SEED_DIRS) copyTree(join(SOURCES.sample, d), join(root, d), opt, log);
  write(join(root, "pieces", rig.PIECE_CATALOG_FILE), T.emptyCatalog(), opt, log);
  write(join(root, "scenes", "vi-du-3d.json"), T.scene3d(rig.SCENE_VERSION), opt, log);
  for (const f of managedFiles({ rigVersion: v.rig, project }))
    write(join(root, f.rel), f.body, { ...managed, track: !f.seed }, log);
  write(join(root, "package.json"), T.packageJson({ name: project, versions: v }), opt, log);

  const r = log.report();
  writeStickman(root, { versions: v, at: today(), files: r.files, legs: legsNow() });
  return { dir: root, versions: v, ...r };
}

const today = () => new Date().toISOString().slice(0, 10);

const writeStickman = (root, { versions: v, at, files, legs }) =>
  writeFileSync(join(root, "stickman.json"), T.stickmanJson({ versions: v, at, files, legs }));

/**
 * Spec rig đi theo package đã pin, không chép vào repo video: version docs khớp version
 * code theo cấu trúc, nên không có bước cập nhật và không có gì để lệch. `stickman docs`
 * và tool `docs` của MCP cùng đọc qua đây.
 */
export function listDocs() {
  return readdirSync(SOURCES.docs)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((file) => ({ file, title: docTitle(join(SOURCES.docs, file)) }));
}

/** Nội dung một file docs; nhận cả tên đủ lẫn tiền tố (`02` ra `02-trang-phuc.md`) */
export function readDoc(name) {
  const want = name.replace(/\.md$/, "").toLowerCase();
  const hit = listDocs().find(
    (d) =>
      d.file.replace(/\.md$/, "").toLowerCase() === want ||
      d.file.toLowerCase().startsWith(`${want}-`),
  );
  return hit ? readFileSync(join(SOURCES.docs, hit.file), "utf8") : null;
}

const docTitle = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .find((l) => l.startsWith("# "))
    ?.slice(2)
    .trim() ?? "";

/**
 * Trạng thái một file studio phát so với bản trên đĩa. `recorded` là băm ghi trong
 * `stickman.json`: bản đã ghi, hoặc bản mẫu đã chào mà người ta chọn giữ bản sửa tay.
 */
function statusOf(root, f, recorded) {
  const path = join(root, f.rel);
  if (!existsSync(path)) return "mới";
  const now = hash(readFileSync(path));
  const tpl = hash(f.body);
  if (now === tpl) return "trùng";
  if (recorded === now) return "cũ";
  return recorded === tpl ? "giữ" : "sửa tay";
}

/**
 * `AGENTS.md` từng là file studio phát; giờ nó của repo video và hướng dẫn rig ở
 * `stickman.md`. Bản chưa ai sửa thì thay bằng seed mới, bản đã sửa tay thì giữ nguyên và
 * báo một lượt. Cả hai đường đều bỏ băm cũ đi, nên lượt sau không hỏi lại.
 */
function migrateAgents(root, recorded) {
  const rel = "AGENTS.md";
  const path = join(root, rel);
  if (!recorded[rel] || !existsSync(path)) return null;
  const now = hash(readFileSync(path));
  // Repo dựng từ bản mới đã là seed rồi: chỉ cần thôi ghi băm
  if (now === hash(T.agents())) return { rel };
  return now === recorded[rel]
    ? { rel, body: T.agents(), why: "tách sang stickman.md" }
    : { rel, stale: true };
}

/**
 * Nâng workspace lên bộ version đang cài: chép lại app Remotion và file cho agent, trộn
 * số version vào `package.json`. File người ta sửa tay thì hỏi `decide`
 * — trả `"đè" | "bỏ qua" | "dừng"`; mặc định bỏ qua. Bỏ qua thì ghi băm của mẫu vừa
 * chào, để mẫu ấy không hỏi lại lần sau. Lên kế hoạch xong mới ghi, nên `"dừng"` là
 * không file nào bị đụng.
 */
export async function upgradeWorkspace({ dir = ".", decide, dryRun = false } = {}) {
  const root = resolve(dir);
  const stamp = readStickman(root);
  const v = { ...versions(), rig: pkgVersion("@stickman3d/rig", root) ?? versions().rig };
  const from = stamp?.versions ?? null;
  const recorded = stamp?.files ?? {};
  // Tên project lấy ở package.json chứ không phải tên thư mục — README sinh theo nó
  const project = readPkg(root)?.name ?? basename(root);
  const plan = [];
  const conflicts = [];
  const same = [];
  const kept = [];
  const declined = {};

  const moved = migrateAgents(root, recorded);
  if (moved?.body) plan.push(moved);

  const all = managedFiles({ rigVersion: v.rig, project });
  for (const f of all) {
    // Seed là của repo: chỉ dựng lại khi thiếu — app Remotion `import` nó
    if (f.seed) {
      if (!existsSync(join(root, f.rel))) plan.push({ ...f, why: "mới" });
      continue;
    }
    const st = statusOf(root, f, recorded[f.rel]);
    if (st === "trùng") {
      same.push(f.rel);
      // Làm mới băm kẻo băm cũ còn treo, sửa tay về sau bị hỏi thừa một lần
      declined[f.rel] = hash(f.body);
      continue;
    }
    if (st === "giữ") {
      kept.push(f.rel);
      continue;
    }
    if (st !== "sửa tay") {
      plan.push({ ...f, why: st });
      continue;
    }
    const answer = decide ? await decide(f.rel) : "bỏ qua";
    if (answer === "dừng")
      return { dir: root, from, versions: v, aborted: true, conflicts, same, kept };
    conflicts.push({ file: f.rel, answer });
    if (answer === "đè") plan.push({ ...f, why: "sửa tay" });
    else declined[f.rel] = hash(f.body);
  }

  const pkg = pkgUpgrade(root, v);
  if (dryRun)
    return {
      dir: root,
      from,
      versions: v,
      dryRun: true,
      plan: plan.map((f) => ({ file: f.rel, why: f.why })),
      pkg: pkg?.changes ?? [],
      conflicts,
      same,
      kept,
      agentsMd: agentsNote(moved),
      legs: legsNote(stamp),
    };

  const log = logger(root);
  // Thư mục workspace mới thêm về sau (vd. `props/`) phải có, app Remotion `require.context` vào đó
  for (const d of DIRS) mkdirSync(join(root, d), { recursive: true });
  // Repo cũ `init` trước khi có `.gitkeep` cho `actions/`, `animals/`: bù lại, không đè gì của repo
  for (const d of GITKEEP_DIRS)
    write(join(root, d, ".gitkeep"), "", { force: false, track: false }, log);
  for (const f of plan) write(join(root, f.rel), f.body, { force: true, track: !f.seed }, log);
  if (pkg?.body) writeFileSync(join(root, "package.json"), pkg.body);

  // File bỏ qua ghi băm của mẫu, không phải băm bản trên đĩa — ghi băm đĩa là lần sau
  // `upgrade` tưởng nó nguyên vẹn và đè mất phần sửa tay.
  const files = { ...recorded, ...declined, ...log.report().files };
  // Thôi quản seed: còn băm là lượt sau lại coi nó là file studio phát
  for (const f of all) if (f.seed) delete files[f.rel];
  writeStickman(root, {
    versions: v,
    at: stamp?.initializedAt ?? today(),
    files,
    legs: stamp?.legs,
  });
  return {
    dir: root,
    from,
    versions: v,
    pkg: pkg?.changes ?? [],
    conflicts,
    same,
    kept,
    agentsMd: agentsNote(moved),
    legs: legsNote(stamp),
    ...log.report(),
  };
}

/** Rig đang cài khác chân mà cảnh được dựng cho: `upgrade` không đụng `scenes/`, chỉ nhắc */
const legsNote = (stamp) =>
  stamp && !sameLegs(legsOf(stamp), legsNow())
    ? `Rig đổi chân ${legsLabel(legsOf(stamp))} → ${legsLabel(legsNow())}: người ngồi 2D nhô khỏi ghế — chạy \`stickman reseat --dry-run\` rồi \`stickman reseat\`.`
    : null;

const agentsNote = (moved) =>
  !moved?.stale && !moved?.body
    ? null
    : moved.stale
      ? "AGENTS.md đã sửa tay nên giữ nguyên — hướng dẫn rig giờ ở stickman.md, xoá phần trùng trong AGENTS.md đi."
      : "AGENTS.md thay bằng bản seed: hướng dẫn rig chuyển sang stickman.md, từ giờ AGENTS.md là của repo này.";

const readPkg = (root) => {
  try {
    return readJson(join(root, "package.json"));
  } catch {
    return null;
  }
};

/** Lệnh mẫu mà `upgrade` thay bằng lệnh mẫu hiện tại; lệnh repo tự sửa thì không khớp nên giữ nguyên */
const STALE_SCRIPTS = {
  "render:final": ["remotion render --image-format=png --crf=18"],
};

/** Trộn số version của bộ stickman vào `package.json` sẵn có, giữ nguyên phần còn lại */
function pkgUpgrade(root, v) {
  const pkg = readPkg(root);
  if (!pkg) return null;
  const deps = pkg.dependencies ?? {};
  const changes = [];
  // Gói mới của bộ (vd. `@stickman3d/fx`) cũng vào: app Remotion vừa chép lại đã import nó
  for (const k of OWN) {
    const name = `@stickman3d/${k}`;
    if (deps[name] !== v[k]) changes.push(`${name} ${deps[name] ?? "(chưa có)"} → ${v[k]}`);
    deps[name] = v[k];
  }
  // Remotion và zod đi cùng bộ scaffold vừa chép lại — Remotion pin zod đúng một số, lệch là
  // mỗi lượt render in một khối "Version mismatch". Chỉ sửa gói repo đã có, không thêm mới.
  for (const [name, want] of [
    ["remotion", T.REMOTION],
    ["@remotion/bundler", T.REMOTION],
    ["@remotion/cli", T.REMOTION],
    ["@remotion/renderer", T.REMOTION],
    ["zod", T.ZOD],
  ]) {
    if (!(name in deps) || deps[name] === want) continue;
    changes.push(`${name} ${deps[name]} → ${want}`);
    deps[name] = want;
  }

  // App Remotion vừa chép lại import `three` (`src/khoi3d/`): repo chưa có thì thêm
  for (const [field, name, want] of [
    ["dependencies", "three", T.THREE],
    ["devDependencies", "@types/three", `^${T.THREE}`],
  ]) {
    const list = (pkg[field] ??= {});
    if (name in list) continue;
    changes.push(`${name} (chưa có) → ${want}`);
    list[name] = want;
  }

  // Tool mới vừa chép vào `tools/` cần script để chạy; script repo đã có thì giữ nguyên, trừ khi
  // nó còn đúng một bản mẫu trong `STALE_SCRIPTS`
  const scripts = pkg.scripts ?? {};
  for (const [name, cmd] of Object.entries(
    JSON.parse(T.packageJson({ name: "", versions: v })).scripts,
  ))
    if (!(name in scripts)) {
      scripts[name] = cmd;
      changes.push(`script ${name}`);
    } else if (scripts[name] !== cmd && STALE_SCRIPTS[name]?.includes(scripts[name])) {
      changes.push(`script ${name}: ${scripts[name]} → ${cmd}`);
      scripts[name] = cmd;
    }

  // Entry mã vẽ mới của bộ scaffold vừa chép lại; entry repo đã khai thì giữ nguyên
  const stickman = pkg.stickman ?? {};
  for (const [key, rel] of Object.entries(
    JSON.parse(T.packageJson({ name: "", versions: v })).stickman,
  ))
    if (!(key in stickman)) {
      stickman[key] = rel;
      changes.push(`stickman.${key} → ${rel}`);
    }

  if (!changes.length) return { body: null, changes };
  pkg.dependencies = deps;
  pkg.scripts = scripts;
  pkg.stickman = stickman;
  return { body: `${JSON.stringify(pkg, null, 2)}\n`, changes };
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const readStickman = (root) => {
  try {
    return readJson(join(root, "stickman.json"));
  } catch {
    return null;
  }
};
const listJson = (d) =>
  existsSync(d) ? readdirSync(d).filter((f) => /\.json$/.test(f) && !SKIP(f)) : [];
const issues = (err) =>
  err.issues.map((i) => `${i.path.join(".") || "(gốc)"}: ${i.message}`).join("; ");

/** Có chạy được lệnh này không — quét PATH chứ không spawn, để `check` khỏi tốn tiến trình */
const onPath = (cmd) =>
  (process.env.PATH ?? "").split(delimiter).some((d) => {
    if (!d) return false;
    try {
      accessSync(join(d, cmd), constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });

/** File git đang theo dõi, đường dẫn tương đối `root`; `null` là không phải repo git */
function gitTracked(root) {
  const r = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  if (r.status !== 0 || !r.stdout) return null;
  return new Set(r.stdout.split("\0").filter(Boolean));
}

/** File chưa theo dõi mà `.gitignore` không loại — thứ quên `git add`, không phải thứ cố ý để ngoài */
function gitUntracked(root) {
  const r = spawnSync("git", ["ls-files", "-z", "--others", "--exclude-standard"], {
    cwd: root,
    encoding: "utf8",
  });
  return new Set(r.status === 0 ? r.stdout.split("\0").filter(Boolean) : []);
}

/**
 * `stickman.frozen` của `package.json`: regex trên id cảnh, id tập và tên lớp vẽ code của tập
 * đã đóng — `check` không kêu thay chúng, `retime` không ghi vào chúng. docs/05-repo-video.md
 */
function frozenOf(root) {
  const src = readPkg(root)?.stickman?.frozen;
  if (src === undefined) return { test: () => false, error: null };
  try {
    const re = new RegExp(src);
    return { test: (id) => re.test(id), error: null };
  } catch (e) {
    return {
      test: () => false,
      error: `package.json: stickman.frozen không phải regex — ${e.message}`,
    };
  }
}

/** Độ dài thật của một file tiếng, tính bằng giây; `null` là không đo được */
function audioSeconds(file) {
  const r = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file],
    { encoding: "utf8" },
  );
  const v = Number.parseFloat(r.stdout ?? "");
  return Number.isFinite(v) ? v : null;
}

/** Hành động của cả hai lớp, khoá theo tên không đuôi; bản của repo đè bản chung */
function loadActions(layers) {
  const out = {};
  for (const dir of [...layers].reverse())
    for (const f of listJson(dir)) {
      const r = rig.parseAction(readJson(join(dir, f)));
      if (r.success) out[f.replace(/\.json$/, "")] = r.data;
    }
  return out;
}

/** Động vật qua các lớp, khoá giữ cả đuôi như `scene.animals[].animal`; file hỏng thì `check` báo ở vòng của nó */
const loadAnimals = (layers) => loadByFile(layers, rig.parseAnimal);

/** Món cầm tay qua các lớp, khoá không đuôi như món của `world.hands[].hold` (`món@nhóm`); bản của repo đè bản chung */
export function loadHeld(layers) {
  const out = {};
  for (const dir of [...layers].reverse())
    for (const f of listJson(dir)) {
      const r = rig.parseHeldItem(readJson(join(dir, f)));
      if (r.success) out[f.replace(/\.json$/, "")] = r.data;
    }
  return out;
}

/**
 * Dáng tay có tên qua các lớp, khoá không đuôi như `world.hands[].right|left.pose`; bản của repo đè bản chung. File hỏng hay
 * tên không dùng được thì bỏ, `check` báo ở vòng của nó
 */
export function loadHands(layers) {
  const out = {};
  for (const dir of [...layers].reverse())
    for (const f of listJson(dir)) {
      const name = f.replace(/\.json$/, "");
      if (rig.handShapeNameProblem(name)) continue;
      const r = rig.parseHandShape(readJson(join(dir, f)));
      if (r.success) out[name] = r.data;
    }
  return out;
}

/** Nhân vật qua các lớp, khoá giữ cả đuôi như `scene.cast[].character` */
const loadCharacters = (layers) => loadByFile(layers, rig.parseCharacter);

/** Hai tham số cuối của `resolveScene`: `rig.height` và `body3` của từng người trong `cast` */
const castBodies = (scene, characters) => {
  const played = scene.cast.flatMap((m) => {
    const c = m.character && characters[m.character];
    return c ? [[m.id, c]] : [];
  });
  return [
    Object.fromEntries(played.map(([id, c]) => [id, c.rig.height])),
    Object.fromEntries(played.map(([id, c]) => [id, rig.body3(c)])),
  ];
};

/** `chars` của `itemAt` / `sceneItemProblems` / `graspAtTime`: nhân vật thật của từng người trong `cast`, file thiếu thì bỏ */
export const castChars = (scene, characters) =>
  Object.fromEntries(
    scene.cast.flatMap((m) => {
      const c = m.character ? characters[m.character] : rig.defaultCharacter();
      return c ? [[m.id, rig.castCharacter(m, c)]] : [];
    }),
  );

/**
 * `resolveScene` của cảnh `check` đo, `rt.chars` của `castChars`: món đặt trước, mốc món `rest` tra nhân vật người cầm ở đó,
 * như `loadScene` của render và runtime của studio
 */
const castRuntime = (scene, actions, animals, props, characters, held, hands) => {
  const rt = rig.resolveScene(
    scene,
    actions,
    animals,
    props,
    ...castBodies(scene, characters),
    held,
    hands,
  );
  rt.chars = { ...castChars(scene, characters), ...rt.chars };
  return rt;
};

function loadByFile(layers, parse) {
  const out = {};
  for (const dir of [...layers].reverse())
    for (const f of listJson(dir)) {
      const r = parse(readJson(join(dir, f)));
      if (r.success) out[f] = r.data;
    }
  return out;
}

/**
 * Độ dài một shot tính bằng giây màn hình, đã cộng `hold`. Công thức phải khớp
 * `layoutShots` của scaffold — cả hai đọc chung `warpTable` của rig; ở đây chỉ khác chỗ
 * không làm tròn ra frame. `null` là không suy được (thiếu cả `duration` lẫn cảnh).
 */
function shotSeconds(shot, sceneSeconds) {
  if (shot.duration !== undefined) return shot.duration + (shot.hold ?? 0);
  const scene = sceneSeconds(shot.scene);
  if (scene == null) return null;
  const from = shot.from ?? 0;
  const to = shot.to ?? scene;
  if (to <= from) return null;
  return rig.screenTime(to - from, rig.warpTable(shot.slow ?? [])) + (shot.hold ?? 0);
}

/** Tên một cue để cue khác và `shot.marks` neo vào: `id`, hay tên file không đuôi */
// Khớp `cueId` của `scaffold/src/shots.ts`: tên file không thư mục, không đuôi
const cueId = (c) =>
  c.id ??
  String(c.file ?? "")
    .replace(/^.*\//, "")
    .replace(/\.[^.]+$/, "");

/**
 * Giây màn hình một cue vào, tính từ đầu shot — cùng phép đổi với `cueStart` của scaffold:
 * `"@mốc"` tra `marks` của cảnh rồi đổi giây cảnh ra giây màn hình qua bảng slow-mo của shot.
 * Không có cảnh để tra thì ném.
 */
function cueAt(c, shot, marks) {
  const at = c.at ?? 0;
  if (typeof at === "number") return at;
  if (!marks) throw new Error(`cue ${c.file}: \`at\` là \`${at}\` mà không có cảnh để tra mốc`);
  const t = rig.markTime(at, marks, `cue ${c.file}`);
  return Math.max(0, rig.screenTime(t - (shot?.from ?? 0), rig.warpTable(shot?.slow ?? [])));
}

/** Hai số thời gian coi như một khi lệch dưới nửa frame ở 60 fps */
const RETIME_EPS = 0.008;

/**
 * Tính lại mọi số mà `episodes/` khai luật cho: `at` của cue có `after`, và `marks` của cảnh
 * mà `shot.marks` neo theo cue. Đo file tiếng bằng `ffprobe`. Trả về danh sách số phải đổi
 * (chưa ghi) và các luật không giải được. `set` là mốc đặt tay: `[{ scene, mark, seconds }]`.
 * docs/07-lam-tap.md#mốc-có-tên-và-retime
 */
export function planRetime({ dir = ".", set = [] } = {}) {
  const root = resolve(dir);
  const changes = [];
  const problems = [];
  const scenes = {};
  const sceneRaw = (name) => {
    if (scenes[name] !== undefined) return scenes[name];
    const p = join(root, "scenes", `${name}.json`);
    try {
      scenes[name] = existsSync(p) ? readJson(p) : null;
    } catch {
      scenes[name] = null;
    }
    return scenes[name];
  };
  const haveFfprobe = onPath("ffprobe");
  const seconds = {};
  const durOf = (c, at) => {
    if (c.dur !== undefined) return c.dur;
    if (!haveFfprobe) {
      problems.push(`${at}: cần \`ffprobe\` trên PATH để đo ${c.file}`);
      return null;
    }
    const p = join(root, "assets/audio", c.file);
    if (!existsSync(p)) {
      problems.push(`${at}: cue trỏ tới assets/audio/${c.file} không có`);
      return null;
    }
    return (seconds[p] ??= audioSeconds(p));
  };
  const setMark = (file, obj, name, to, why) => {
    const from = obj.marks?.[name];
    if (from !== undefined && Math.abs(from - to) < RETIME_EPS) return;
    changes.push({ file, path: `marks.${name}`, from: from ?? null, to: +to.toFixed(3), why });
  };

  for (const m of set) {
    const raw = sceneRaw(m.scene);
    if (!raw) {
      problems.push(`không có scenes/${m.scene}.json`);
      continue;
    }
    setMark(`scenes/${m.scene}.json`, raw, m.mark, m.seconds, "đặt tay");
  }

  const frozen = frozenOf(root);
  for (const f of listJson(join(root, "episodes"))) {
    if (frozen.test(f.replace(/\.json$/, ""))) continue;
    let ep;
    try {
      ep = readJson(join(root, "episodes", f));
    } catch {
      continue;
    }
    for (const shot of ep.shots ?? []) {
      const where = `episodes/${f}: shot ${shot.id ?? "?"}`;
      const scene = shot.scene ? sceneRaw(shot.scene) : null;
      const marks = scene?.marks ?? {};
      const table = rig.warpTable(shot.slow ?? []);
      const cues = shot.audio ?? [];
      // Tên cue phải là một: hai cue cùng file mà không `id` riêng thì luật nào neo vào cũng mơ hồ
      const dup = new Set(cues.map(cueId).filter((id, i, all) => all.indexOf(id) !== i));
      const named = (id, at) => {
        if (!dup.has(id)) return true;
        problems.push(
          `${at}: cue \`${id}\` có ${cues.filter((x) => cueId(x) === id).length} lần trong shot — đặt \`id\` riêng để neo`,
        );
        return false;
      };
      // `at` đã giải của từng cue, theo thứ tự mảng: cue `after` chỉ neo vào cue đứng trước
      const starts = new Map();
      for (const [i, c] of cues.entries()) {
        const at = `${where} cue ${cueId(c)}`;
        let start = null;
        if (c.after && named(c.after.cue, at)) {
          const base = cues.find((x, k) => k < i && cueId(x) === c.after.cue);
          const baseAt = base ? starts.get(cueId(base)) : null;
          const dur = base ? durOf(base, at) : null;
          if (!base)
            problems.push(
              `${at}: \`after\` trỏ tới cue \`${c.after.cue}\` không đứng trước nó trong shot này`,
            );
          else if (baseAt != null && dur != null) {
            start = baseAt + dur + (c.after.offset ?? 0);
            if (typeof c.at !== "number" || Math.abs(c.at - start) >= RETIME_EPS)
              changes.push({
                file: `episodes/${f}`,
                path: `shots[${shot.id}].audio[${i}].at`,
                from: c.at ?? null,
                to: +start.toFixed(3),
                why: `${(c.after.offset ?? 0) >= 0 ? "+" : ""}${c.after.offset ?? 0}s sau khi ${c.after.cue} dứt`,
              });
          }
        }
        if (start == null)
          try {
            start = cueAt(c, shot, scene ? marks : null);
          } catch (e) {
            problems.push(`${at}: ${e.message}`);
          }
        starts.set(cueId(c), start);
      }
      // Tập đang làm mượn cảnh đã đóng băng thì không ghi mốc vào cảnh ấy
      if (shot.scene && frozen.test(shot.scene) && Object.keys(shot.marks ?? {}).length) {
        problems.push(
          `${where}: neo mốc vào cảnh ${shot.scene} khớp \`stickman.frozen\` — chép cảnh ra tên mới`,
        );
        continue;
      }
      for (const [name, rule] of Object.entries(shot.marks ?? {})) {
        const at = `${where} marks.${name}`;
        if (!scene) {
          problems.push(`${at}: shot không có \`scene\` để đặt mốc`);
          continue;
        }
        if (!named(rule.cue, at)) continue;
        const c = cues.find((x) => cueId(x) === rule.cue);
        if (!c) {
          problems.push(`${at}: trỏ tới cue \`${rule.cue}\` không có trong shot`);
          continue;
        }
        let shotSec = starts.get(cueId(c));
        if (shotSec == null) continue;
        if (rule.edge === "end") {
          const dur = durOf(c, at);
          if (dur == null) continue;
          shotSec += dur;
        }
        shotSec += rule.offset ?? 0;
        // Giây màn hình kể từ đầu shot → giây cảnh, qua chính bảng slow-mo của shot
        const sceneSec = (shot.from ?? 0) + rig.sceneTime(shotSec, table);
        setMark(
          `scenes/${shot.scene}.json`,
          scene,
          name,
          sceneSec,
          `${rule.edge === "end" ? "sau khi" : "lúc"} ${rule.cue} ${rule.edge === "end" ? "dứt" : "vào"}${rule.offset ? ` ${rule.offset >= 0 ? "+" : ""}${rule.offset}s` : ""}`,
        );
      }
    }
  }
  return { dir: root, changes, problems };
}

/**
 * Ghi các số `planRetime` tính ra: sửa thẳng JSON thô nên thứ tự khoá và mọi tham chiếu
 * `@mốc` giữ nguyên. `dryRun` chỉ trả kế hoạch.
 */
export function retimeWorkspace({ dir = ".", set = [], dryRun = false } = {}) {
  const plan = planRetime({ dir, set });
  if (dryRun || !plan.changes.length) return { ...plan, wrote: [] };
  const files = new Map();
  const load = (rel) => {
    if (!files.has(rel)) files.set(rel, readJson(join(plan.dir, rel)));
    return files.get(rel);
  };
  for (const ch of plan.changes) {
    const obj = load(ch.file);
    const m = /^marks\.(.+)$/.exec(ch.path);
    if (m) {
      obj.marks ??= {};
      obj.marks[m[1]] = ch.to;
      continue;
    }
    const cue = /^shots\[(.+)\]\.audio\[(\d+)\]\.at$/.exec(ch.path);
    if (cue) {
      const shot = obj.shots.find((x) => String(x.id) === cue[1]);
      shot.audio[Number(cue[2])].at = ch.to;
    }
  }
  const wrote = [];
  for (const [rel, obj] of files) {
    writeFileSync(join(plan.dir, rel), `${JSON.stringify(obj, null, 2)}\n`);
    wrote.push(rel);
  }
  return { ...plan, wrote };
}

/** Chân của rig 0.x; `stickman.json` không ghi `legs` là cảnh dựng cho chân này */
const LEGS_BEFORE = { thigh: 82, shin: 78 };
const legsNow = () => ({ thigh: rig.RIG.thigh, shin: rig.RIG.shin });
const legsOf = (stamp) => stamp?.legs ?? LEGS_BEFORE;
const sameLegs = (a, b) => a.thigh === b.thigh && a.shin === b.shin;
const legsLabel = (l) => `đùi ${l.thigh} / cẳng ${l.shin}`;
const legsKey = (l) => `${l.thigh}/${l.shin}`;

/**
 * Mỗi đời chân: kênh chân của hai hành động ngồi chung (chỉnh để hông người ngồi ghế vẽ tay giữ
 * chỗ). `reseat` dựng tư thế đời trước bằng bảng của đời ấy.
 */
const LEG_ERAS = {
  "82/78": {
    sit: { legFar: [60, -60], legNear: [60, -60] },
    "sit-rear": { stretch: [1, 1, 1, 1, 0.75, 1.4, 0.75, 1.4] },
  },
  "85/99": {
    sit: { legFar: [76, -76], legNear: [76, -76] },
    "sit-rear": { stretch: [1, 1, 1, 1, 0.75, 1.1, 0.75, 1.1] },
  },
  "78/92": {
    sit: { legFar: [70, -70], legNear: [70, -70] },
    "sit-rear": { stretch: [1, 1, 1, 1, 0.75, 1.19, 0.75, 1.19] },
  },
};
const RETUNED_ACTIONS = ["sit", "sit-rear"];

/** Bảng `{ tên: { now, before } }` cho hai đời chân; đời không có trong `LEG_ERAS` là lỗi */
function retunedBetween(from, to) {
  const a = LEG_ERAS[legsKey(from)];
  const b = LEG_ERAS[legsKey(to)];
  for (const [legs, era] of [
    [from, a],
    [to, b],
  ])
    if (!era) throw new Error(`chân ${legsKey(legs)} không có trong LEG_ERAS`);
  return Object.fromEntries(RETUNED_ACTIONS.map((n) => [n, { now: b[n], before: a[n] }]));
}

/** Hành động ngồi ghế: hông nằm trên ghế vẽ tay nên `reseat` giữ hông, không giữ chân */
const SEATED = /^sit(-|$)/;
/** Lệch dưới ngần này px sân khấu coi như không đổi */
const RESEAT_EPS = 0.05;
/** `path` của người vừa đứng vừa ngồi nội suy thẳng giữa các mốc, lệch tối đa ngần này px sân khấu */
const PATH_TOL = 0.25;
/** Chân co tới dưới tỉ lệ này của cả chân mà không phải hành động ngồi thì báo để soi tay */
const BENT = 0.85;
const round2 = (v) => Math.round(v * 100) / 100;

function retunedAction(name, a, t) {
  const out = structuredClone(a);
  for (const k of out.keys)
    for (const [ch, v] of Object.entries(t.now)) {
      if (k.pose?.[ch] === undefined) continue;
      if (JSON.stringify(k.pose[ch]) !== JSON.stringify(v))
        throw new Error(
          `actions/${name}.json chung không còn là bản \`reseat\` biết — cập nhật LEG_ERAS`,
        );
      k.pose[ch] = t.before[ch];
    }
  return out;
}

/**
 * Bảng hành động như ở đời chân trước: bản chung đã chỉnh lại lấy kênh chân cũ, và — nếu có
 * `ref` — lớp trên đọc ở commit ấy, cho repo đã chỉnh hành động ngồi riêng trước khi chạy.
 */
function actionsBefore(root, now, retuned, ref) {
  const upper = join(root, "actions");
  const common = loadActions([COMMON.actions]);
  for (const [name, t] of Object.entries(retuned))
    if (common[name]) common[name] = retunedAction(name, common[name], t);
  const mine = (name) => existsSync(join(upper, `${name}.json`));
  const out = Object.fromEntries(
    Object.entries(now).map(([name, a]) => [name, mine(name) ? a : (common[name] ?? a)]),
  );
  if (!ref) return out;
  const git = (...a) => spawnSync("git", a, { cwd: root, encoding: "utf8" });
  const ls = git("ls-tree", "--name-only", `${ref}:./actions`);
  if (ls.status !== 0) throw new Error(`không đọc được actions/ ở \`${ref}\`: ${ls.stderr.trim()}`);
  const then = new Set();
  for (const f of ls.stdout.split("\n").filter((x) => /\.json$/.test(x) && !SKIP(x))) {
    const shown = git("show", `${ref}:./actions/${f}`);
    if (shown.status !== 0)
      throw new Error(`không đọc được actions/${f} ở \`${ref}\`: ${shown.stderr.trim()}`);
    const r = rig.parseAction(JSON.parse(shown.stdout));
    if (!r.success) throw new Error(`actions/${f} ở \`${ref}\`: ${issues(r.error)}`);
    then.add(f.replace(/\.json$/, ""));
    out[f.replace(/\.json$/, "")] = r.data;
  }
  for (const name of Object.keys(now))
    if (mine(name) && !then.has(name) && common[name]) out[name] = common[name];
  return out;
}

/** Douglas–Peucker trên `[t, …giá trị]`: giữ mốc đủ để nội suy thẳng lệch không quá `tol` ở mọi giá trị */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts.at(-1)];
  let at = -1;
  let worst = tol;
  for (let i = 1; i < pts.length - 1; i++) {
    const u = (pts[i][0] - a[0]) / (b[0] - a[0]);
    const d = Math.max(
      ...a.slice(1).map((v, k) => Math.abs(pts[i][k + 1] - (v + (b[k + 1] - v) * u))),
    );
    if (d > worst) [worst, at] = [d, i];
  }
  if (at < 0) return [a, b];
  return [...simplify(pts.slice(0, at + 1), tol).slice(0, -1), ...simplify(pts.slice(at), tol)];
}

/** Mốc lấy mẫu của một người: lưới 1/60 giây, mốc có tên, đầu và cuối từng đoạn hoà */
function reseatTimes(rt, m) {
  const ts = [rt.duration, ...Object.values(rt.marks)];
  for (let i = 0; i / 60 < rt.duration; i++) ts.push(i / 60);
  for (const tr of m.tracks) for (const c of tr.clips) ts.push(c.start, c.start + c.tau);
  return [...new Set(ts.filter((t) => t >= 0 && t <= rt.duration).map((t) => +t.toFixed(4)))].sort(
    (a, b) => a - b,
  );
}

/**
 * Một người 2D: độ dời gốc từng khung để hông đứng đúng chỗ của đời chân trước ở khung ngồi
 * (hay cả cảnh, nếu người bị xoay), và bàn chân giữ trên đất ở khung đứng. Đang hoà giữa ngồi
 * và đứng thì lấy độ dời của khung ngồi gần nhất nhân phần ngồi, cho gốc trôi một mạch.
 */
function reseatMember(now, then, spec, m, from) {
  const h = now.heights[m.id] ?? 1;
  const seatBase = spec.base === "sit" ? 1 : 0;
  const low = (pose, legs) => Math.max(...rig.feet(pose, h, legs).map((q) => q[1]));
  const reach = (from.thigh + from.shin) * h;
  const rows = reseatTimes(now, m).map((t) => {
    const spot = rig.sceneAt(now, m.id, t, h);
    const old = low(rig.sceneAt(then, m.id, t, h).pose, from);
    const hold = spec.rotate
      ? 1
      : rig.legShare(now, m.id, t, (name) => SEATED.test(name), seatBase);
    return { t, hold, spot, old, d: low(spot.pose) - old };
  });
  const seated = rows.filter((r) => r.hold === 1);
  const near = (r) =>
    seated.reduce((a, b) => (Math.abs(b.t - r.t) < Math.abs(a.t - r.t) ? b : a), seated[0]) ?? r;
  return {
    bent: !seated.length && rows.some((r) => r.old < BENT * reach),
    rows: rows.map((r) => {
      const s = rig.hipHoldShift(r.spot, r.hold === 1 ? r.d : r.hold && r.hold * near(r).d);
      return {
        t: r.t,
        hold: r.hold,
        dx: s.x,
        dy: s.y,
        x: r.spot.x,
        scale: r.spot.scale,
        flip: r.spot.flip,
      };
    }),
  };
}

/**
 * Người 2D trôi ngang tự suy (không `path`) đi bằng clip khai `cycle`: sải chân đổi theo chân
 * mới, nên giãn `cycle` đúng tỉ lệ sải để người đi bao xa trong bao lâu vẫn như đời trước. Clip
 * khai `speed` thì rig tự suy nhịp, không đụng. Trả cảnh đã giãn và các thay đổi `nhịp`.
 */
function repace(data, then, actionsNow, from, file) {
  const scene = structuredClone(data);
  const paces = [];
  for (const [i, spec] of scene.cast.entries()) {
    if (spec.world || spec.mount || spec.sit || spec.path) continue;
    const m = then.cast[i];
    for (const [ti, tr] of spec.tracks.entries())
      for (const [ci, c] of tr.clips.entries()) {
        if (!c.action || c.speed !== undefined || !actionsNow[c.action]) continue;
        const old = m.tracks[ti].clips[ci];
        const was = rig.actionStride(old.action, m.base, from);
        const is = rig.actionStride(actionsNow[c.action], m.base);
        if (Math.abs(was) < 1e-6 || Math.abs(is / was - 1) < 1e-4) continue;
        c.cycle = +((old.cycle * is) / was).toFixed(4);
        paces.push({
          file,
          id: spec.id,
          index: i,
          kind: "nhịp",
          track: ti,
          clip: ci,
          action: c.action,
          cycle: { from: old.cycle, to: c.cycle },
        });
      }
  }
  return { scene, paces };
}

/**
 * Kế hoạch dời người ngồi 2D khi rig đổi độ dài chân: so tư thế mỗi khung ở đời chân ghi trong
 * `stickman.json` (`legs`, trống là `82 / 78`) với chân đang cài, dời `y` — và `x` nếu người bị
 * xoay — để hông ở đúng chỗ cũ; người đứng giữ nguyên. Cảnh khớp `stickman.frozen` và người 3D
 * không đụng. `before` là ref git đọc lớp `actions/` đời trước. docs/05-repo-video.md#đổi-độ-dài-chân
 */
export async function planReseat({ dir = ".", before } = {}) {
  const root = resolve(dir);
  const stamp = readStickman(root);
  const from = legsOf(stamp);
  const to = legsNow();
  const plan = { dir: root, from, to, changes: [], manual: [], problems: [], frozen: 0 };
  if (!stamp) {
    plan.problems.push(
      "không có stickman.json — chạy `stickman init` hay `stickman upgrade` trước",
    );
    return plan;
  }
  if (sameLegs(from, to)) return plan;
  try {
    if (partsEntry(root)) rig.registerParts(await loadParts(root));
  } catch (e) {
    plan.problems.push(e.message);
    return plan;
  }
  const actionsNow = loadActions([join(root, "actions"), COMMON.actions]);
  let actionsThen;
  try {
    actionsThen = actionsBefore(root, actionsNow, retunedBetween(from, to), before);
  } catch (e) {
    plan.problems.push(e.message);
    return plan;
  }
  // Hành động sửa mà chưa commit thường là hành động ngồi vừa chỉnh cho chân mới: đời trước nằm ở HEAD
  if (!before) {
    const st = spawnSync("git", ["status", "--porcelain", "--", "actions"], {
      cwd: root,
      encoding: "utf8",
    });
    for (const line of st.status === 0 ? st.stdout.split("\n") : [])
      if (/^(?:M.|.M) .*\.json$/.test(line))
        plan.manual.push({
          file: line.slice(3),
          why: "sửa mà chưa commit — `reseat` coi bản trên đĩa là đời trước; đã chỉnh chân cho rig mới thì chạy với `--before HEAD`",
        });
  }
  const characters = loadCharacters([join(root, "characters"), COMMON.characters]);
  const animals = loadAnimals([join(root, "animals"), COMMON.animals]);
  const held = loadHeld([join(root, "held"), COMMON.held]);
  const hands = loadHands([join(root, "hands"), COMMON.hands]);
  const props = loadByFile([join(root, "props")], rig.parseProp);
  const frozen = frozenOf(root);
  if (frozen.error) plan.problems.push(frozen.error);
  // Cảnh đã vá phải nạp lại được trước khi ghi: lỗi thì `undefined` là qua, chuỗi là lý do
  Object.defineProperty(plan, "verify", {
    value: (text) => {
      try {
        const r = rig.parseScene(JSON.parse(text));
        if (!r.success) return issues(r.error);
        rig.resolveScene(
          r.data,
          actionsNow,
          animals,
          props,
          ...castBodies(r.data, characters),
          held,
          hands,
        );
      } catch (e) {
        return e.message;
      }
    },
  });

  for (const f of listJson(join(root, "scenes"))) {
    if (frozen.test(f.replace(/\.json$/, ""))) {
      plan.frozen++;
      continue;
    }
    const file = `scenes/${f}`;
    const r = rig.parseScene(readJson(join(root, file)));
    if (!r.success) {
      plan.problems.push(`${file}: ${issues(r.error)}`);
      continue;
    }
    let paces = [];
    const bodies = castBodies(r.data, characters);
    let now, then, scene;
    try {
      ({ scene, paces } = repace(
        r.data,
        rig.resolveScene(r.data, actionsThen, animals, props, ...bodies, held, hands),
        actionsNow,
        from,
        file,
      ));
      // Đời trước dựng trên cảnh đã giãn nhịp: hoà giữa đi và ngồi rơi đúng pha như bây giờ
      then = rig.resolveScene(scene, actionsThen, animals, props, ...bodies, held, hands);
      now = rig.resolveScene(scene, actionsNow, animals, props, ...bodies, held, hands);
    } catch (e) {
      plan.problems.push(`${file}: ${e.message}`);
      continue;
    }
    plan.changes.push(...paces);
    for (const [i, spec] of scene.cast.entries()) {
      if (spec.world || spec.mount || spec.sit) continue;
      const m = now.cast[i];
      const { rows, bent } = reseatMember(now, then, spec, m, from);
      const who = { file, id: spec.id };
      if (bent)
        plan.manual.push({
          ...who,
          why: "chân co mà không phải hành động ngồi — giữ chân trên đất; nếu là ngồi ghế thì đặt lại `y` bằng tay",
        });
      if (rows.every((x) => x.hold === 0)) continue;
      const g = spec.group ? r.data.groups.find((q) => q.id === spec.group) : null;
      const local = (dx, dy) =>
        g ? { dx: dx / ((g.flip ? -1 : 1) * g.scale), dy: dy / g.scale } : { dx, dy };
      const at = { x: spec.x, y: spec.y ?? (g ? 0 : r.data.ground) };
      const follow = r.data.props.flatMap((p, k) => (p.follow === spec.id ? [k] : []));
      const seated = rows.filter((x) => x.hold === 1);
      const mixed = seated.length < rows.length;
      const spread = (k) => Math.max(...rows.map((x) => x[k])) - Math.min(...rows.map((x) => x[k]));
      const steady = !mixed && spread("dx") <= RESEAT_EPS && spread("dy") <= RESEAT_EPS;
      if (!steady && !spec.path) {
        // `path` lấy mẫu chính chỗ đứng (cả trôi ngang tự suy, vì `path` tắt nó) cộng độ dời từng khung
        const still = rows.every((x) => x.x === rows[0].x);
        const pts = rows.map((x) => {
          const l = local(x.dx, x.dy);
          const lx = g ? (x.x - g.x) / ((g.flip ? -1 : 1) * g.scale) : x.x;
          return [x.t, lx + l.dx, at.y + l.dy];
        });
        const keys = simplify(pts, PATH_TOL).map(([t, x, y]) => ({
          t: +t.toFixed(4),
          ...(still && !spec.rotate ? {} : { x: round2(x) }),
          y: round2(y),
        }));
        plan.changes.push({ ...who, index: i, kind: "path", y: { from: at.y }, path: keys });
        if (follow.length)
          plan.manual.push({
            ...who,
            why: `đạo cụ theo người (${follow.map((k) => r.data.props[k].id).join(", ")}) đi theo \`path\` mới — đặt lại tay`,
          });
        continue;
      }
      const most = seated.length * 2 >= rows.length;
      if (!steady) {
        const what = mixed ? "vừa đứng vừa ngồi" : "độ dời đổi theo khung";
        plan.manual.push({
          ...who,
          why: most
            ? `${what}, đã có \`path\`: dời theo khung ngồi (${seated.length}/${rows.length} mẫu)${mixed ? ", khung đứng chân lún dưới đất" : ""}`
            : `${what}, đã có \`path\`: giữ chân trên đất (khung ngồi ${seated.length}/${rows.length} mẫu), khung ngồi hông lệch chỗ cũ`,
        });
      }
      if (!most) continue;
      const mean = (k) => seated.reduce((sum, x) => sum + x[k], 0) / seated.length;
      const d = { dx: mean("dx"), dy: mean("dy") };
      if (Math.hypot(d.dx, d.dy) < RESEAT_EPS) continue;
      const l = local(d.dx, d.dy);
      const s0 = seated[0];
      plan.changes.push({
        ...who,
        index: i,
        kind: "dời",
        dx: d.dx,
        dy: d.dy,
        local: l,
        y: { from: at.y, to: round2(at.y + l.dy) },
        ...(Math.abs(l.dx) >= RESEAT_EPS ? { x: { from: at.x, to: round2(at.x + l.dx) } } : {}),
        props: follow.map((k) => {
          const p = r.data.props[k];
          return {
            index: k,
            id: p.id,
            x: round2(p.x - d.dx / ((s0.flip ? -1 : 1) * s0.scale)),
            y: round2((p.y ?? 0) - d.dy / s0.scale),
          };
        }),
      });
    }
  }
  return plan;
}

/**
 * Chỗ của giá trị ở `path` (khoá hay chỉ số) trong chuỗi JSON: `{ key, start, end }`, `key` là đầu
 * tên khoá hay đầu phần tử; không có thì `null`.
 */
function jsonSpan(text, path) {
  let i = 0;
  const ws = () => {
    while (" \t\n\r".includes(text[i])) i++;
  };
  const str = () => {
    for (i++; text[i] !== '"'; i += text[i] === "\\" ? 2 : 1);
    i++;
  };
  const skip = () => {
    ws();
    const open = text[i];
    if (open === '"') return str();
    if (open !== "{" && open !== "[") {
      while (i < text.length && !",]} \t\n\r".includes(text[i])) i++;
      return;
    }
    i++;
    ws();
    if (text[i] === (open === "{" ? "}" : "]")) return void i++;
    for (;;) {
      ws();
      if (open === "{") {
        str();
        ws();
        i++;
      }
      skip();
      ws();
      if (text[i++] !== ",") return;
    }
  };
  const find = (d, key) => {
    ws();
    if (d === path.length) {
      const start = i;
      skip();
      return { key, start, end: i };
    }
    const open = text[i];
    if (open !== "{" && open !== "[") return null;
    i++;
    ws();
    if (text[i] === (open === "{" ? "}" : "]")) return null;
    for (let n = 0; ; n++) {
      ws();
      const at = i;
      let k = n;
      if (open === "{") {
        str();
        k = JSON.parse(text.slice(at, i));
        ws();
        i++;
      }
      if (k === path[d]) return find(d + 1, at);
      skip();
      ws();
      if (text[i++] !== ",") return null;
    }
  };
  return find(0, 0);
}

/**
 * Đặt một giá trị vào chuỗi JSON mà giữ nguyên cách trình bày của file: có khoá thì thay đúng giá
 * trị, chưa có thì chèn ngay sau khoá `after` (hay đầu object), cùng kiểu xuống dòng với nó.
 */
function setJson(text, path, value, after) {
  const body = JSON.stringify(value);
  const hit = jsonSpan(text, path);
  if (hit) return text.slice(0, hit.start) + body + text.slice(hit.end);
  const key = path.at(-1);
  const prev = after && jsonSpan(text, [...path.slice(0, -1), after]);
  if (!prev) {
    const obj = jsonSpan(text, path.slice(0, -1));
    return `${text.slice(0, obj.start + 1)}"${key}": ${body}, ${text.slice(obj.start + 1)}`;
  }
  const indent = /\n([ \t]*)$/.exec(text.slice(0, prev.key));
  const sep = indent ? `,\n${indent[1]}` : ", ";
  return `${text.slice(0, prev.end)}${sep}"${key}": ${body}${text.slice(prev.end)}`;
}

/**
 * Ghi kế hoạch của `planReseat` vào cảnh — sửa đúng các số, giữ nguyên cách trình bày của file —
 * rồi ghi `legs` mới vào `stickman.json`, nên chạy lại là không còn gì để dời. Có lỗi nạp thì
 * không ghi gì: cảnh không nạp được mà đã đóng dấu chân mới thì không bao giờ được dời nữa.
 */
export async function reseatWorkspace({ dir = ".", before, dryRun = false } = {}) {
  const plan = await planReseat({ dir, before });
  if (dryRun || plan.problems.length || sameLegs(plan.from, plan.to)) return { ...plan, wrote: [] };
  const files = new Map();
  for (const ch of plan.changes) {
    const path = join(plan.dir, ch.file);
    let text = files.get(ch.file) ?? readFileSync(path, "utf8");
    const raw = JSON.parse(text);
    const at = ["cast", ch.index];
    if (ch.kind === "nhịp")
      text = setJson(
        text,
        [...at, "tracks", ch.track, "clips", ch.clip, "cycle"],
        ch.cycle.to,
        "start",
      );
    else if (ch.kind === "path") text = setJson(text, [...at, "path"], ch.path, "y");
    else {
      text = setJson(text, [...at, "y"], ch.y.to, "x");
      if (ch.x) text = setJson(text, [...at, "x"], ch.x.to, "id");
      for (const [j, k] of (raw.cast[ch.index].path ?? []).entries()) {
        if (typeof k.y === "number")
          text = setJson(text, [...at, "path", j, "y"], round2(k.y + ch.local.dy));
        if (ch.x && typeof k.x === "number")
          text = setJson(text, [...at, "path", j, "x"], round2(k.x + ch.local.dx));
      }
      for (const p of ch.props) {
        text = setJson(text, ["props", p.index, "y"], p.y, "x");
        if (Math.abs(ch.dx) >= RESEAT_EPS) text = setJson(text, ["props", p.index, "x"], p.x, "id");
      }
    }
    files.set(ch.file, text);
  }
  const broken = [...files].flatMap(([rel, text]) => {
    const why = plan.verify(text);
    return why ? [`${rel} sau khi dời không nạp lại được: ${why}`] : [];
  });
  if (broken.length) return { ...plan, problems: broken, wrote: [] };
  for (const [rel, text] of files) writeFileSync(join(plan.dir, rel), text);
  const { schemaVersion, versions: v, ...rest } = readStickman(plan.dir);
  delete rest.legs;
  writeFileSync(
    join(plan.dir, "stickman.json"),
    `${JSON.stringify({ schemaVersion, versions: v, legs: plan.to, ...rest }, null, 2)}\n`,
  );
  return { ...plan, wrote: [...files.keys()] };
}

/** Ngưỡng lấn của workspace: `stickman.clash.tol` trong `package.json`, mặc định `CLASH_TOL` */
export const clashTol = (dir = ".") => readPkg(resolve(dir))?.stickman?.clash?.tol ?? CLASH_TOL;

/** Ngưỡng tay xuyên thân mình: `stickman.clash.self`, mặc định `PIERCE_TOL` của lõi, `false` là tắt */
export const selfTol = (dir = ".") =>
  readPkg(resolve(dir))?.stickman?.clash?.self ?? rig.PIERCE_TOL;

/** Ngưỡng phần thể tích của đồ lồng vào đồ: `stickman.clash.items`, mặc định `ITEM_RATIO`, `false` là tắt */
export const itemRatio = (dir = ".") => readPkg(resolve(dir))?.stickman?.clash?.items ?? ITEM_RATIO;

/**
 * Quãng giây cảnh mà các shot của `episodes/` đưa lên hình, theo id cảnh: `[from, to]` mỗi shot, hai
 * shot liền nhau nối tiếp cùng một cảnh thì gộp — không có chỗ cắt giữa chúng. Cảnh không shot nào
 * dùng thì không có mục. Chỉ dựng runtime cho cảnh `wanted(id)` — cảnh khác không có mục.
 * docs/03-scene.md#giật-trên-hình
 */
function shotSpans(root, scenesByName, sceneRuntime, wanted = () => true) {
  const out = new Map();
  for (const f of listJson(join(root, "episodes"))) {
    let ep;
    try {
      ep = readJson(join(root, "episodes", f));
    } catch {
      continue;
    }
    let last = null;
    for (const shot of ep.shots ?? []) {
      const rt = shot.scene && wanted(shot.scene) && sceneRuntime(shot.scene);
      if (!rt) {
        last = null;
        continue;
      }
      let from;
      let to;
      try {
        const marks = scenesByName[shot.scene]?.marks ?? {};
        from = shot.from === undefined ? 0 : rig.markTime(shot.from, marks, "from");
        to =
          shot.to !== undefined
            ? rig.markTime(shot.to, marks, "to")
            : shot.duration !== undefined
              ? from + rig.sceneTime(shot.duration, rig.warpTable(shot.slow ?? []))
              : rt.duration;
      } catch {
        last = null;
        continue;
      }
      const list = out.get(shot.scene) ?? [];
      if (last && last.scene === shot.scene && Math.abs(last.span[1] - from) < RETIME_EPS)
        last.span[1] = to;
      else {
        const span = [from, Math.min(to, rt.duration)];
        list.push(span);
        last = { scene: shot.scene, span };
      }
      out.set(shot.scene, list);
    }
  }
  return out;
}

/**
 * Quãng lên hình của cảnh `name` như `check` đo giật (`shotSpans` trên bản đĩa), `data` là `worldData`; cảnh không shot nào
 * dùng hay không dựng được thì `undefined` (đo cả cảnh)
 */
export function sceneShotSpans(dir, name, data = worldData(dir)) {
  const root = resolve(dir);
  let scene;
  try {
    const r = rig.parseScene(readJson(join(root, "scenes", `${name}.json`)));
    if (!r.success) return undefined;
    scene = r.data;
  } catch {
    return undefined;
  }
  let rt;
  const sceneRuntime = (n) => {
    if (n !== name) return null;
    if (rt === undefined)
      try {
        rt = castRuntime(
          scene,
          data.actions,
          data.animals,
          data.props,
          data.characters,
          data.held,
          data.hands,
        );
      } catch {
        rt = null;
      }
    return rt;
  };
  return shotSpans(root, { [name]: scene }, sceneRuntime, (n) => n === name).get(name);
}

/**
 * Ngưỡng đo giật trên hình: `stickman.snap` trong `package.json` — `{ px, k, fps }`, trường thiếu lấy
 * `SNAP_PX` / `SNAP_K` / `SNAP_FPS` của rig; `false` là không đo. Sai kiểu thì trả `{ error }`.
 * docs/03-scene.md#giật-trên-hình
 */
export function snapOptions(dir = ".") {
  const raw = readPkg(resolve(dir))?.stickman?.snap;
  if (raw === false) return { off: true };
  const out = { px: rig.SNAP_PX, k: rig.SNAP_K, fps: rig.SNAP_FPS };
  if (raw === undefined) return out;
  const bad = `package.json: stickman.snap phải là false hay { px, k, fps } số dương, đang là ${JSON.stringify(raw)}`;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: bad };
  for (const [key, v] of Object.entries(raw)) {
    if (!(key in out) || typeof v !== "number" || !(v > 0)) return { error: bad };
    out[key] = v;
  }
  return out;
}

/**
 * Ngưỡng đo lòng bàn tay: `stickman.palm` trong `package.json` — `{ down, hang, hold }` (độ, độ, giây),
 * trường thiếu lấy `PALM_DOWN` / `PALM_HANG` / `PALM_HOLD` của rig; `false` là không đo. Sai kiểu thì trả
 * `{ error }`. docs/03-scene.md#lòng-bàn-tay
 */
export function palmOptions(dir = ".") {
  const raw = readPkg(resolve(dir))?.stickman?.palm;
  if (raw === false) return { off: true };
  const out = { down: rig.PALM_DOWN, hang: rig.PALM_HANG, hold: rig.PALM_HOLD };
  if (raw === undefined) return out;
  const bad = `package.json: stickman.palm phải là false hay { down, hang, hold } số dương, đang là ${JSON.stringify(raw)}`;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: bad };
  for (const [key, v] of Object.entries(raw)) {
    if (!(key in out) || typeof v !== "number" || !(v > 0)) return { error: bad };
    out[key] = v;
  }
  return out;
}

/**
 * Ngưỡng đo tay sai dáng: `stickman.arms` trong `package.json` — `{ straight, converge, upturn, hover, hold }` (độ, độ,
 * độ, đơn vị rig, giây), trường thiếu lấy `ARM_STRAIGHT` / `ARM_CONVERGE` / `ARM_UPTURN` / `ARM_HOVER_GAP` / `PALM_HOLD`
 * của rig; `false` là không đo. Sai kiểu thì trả `{ error }`. docs/03-scene.md#tay-và-khuỷu
 */
export function armOptions(dir = ".") {
  const raw = readPkg(resolve(dir))?.stickman?.arms;
  if (raw === false) return { off: true };
  const out = {
    straight: rig.ARM_STRAIGHT,
    converge: rig.ARM_CONVERGE,
    upturn: rig.ARM_UPTURN,
    hover: rig.ARM_HOVER_GAP,
    hold: rig.PALM_HOLD,
  };
  if (raw === undefined) return out;
  const bad = `package.json: stickman.arms phải là false hay { straight, converge, upturn, hover, hold } số dương, đang là ${JSON.stringify(raw)}`;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: bad };
  for (const [key, v] of Object.entries(raw)) {
    if (!(key in out) || typeof v !== "number" || !(v > 0)) return { error: bad };
    out[key] = v;
  }
  return out;
}

/**
 * Ngưỡng đo đồ cầm tay: `stickman.held` trong `package.json` — `{ pose, pierce, touch, wrap, grip, up, face, drift,
 * turn, reach, seat, body, sink, wrist, arm, elbow, oppose, hold }` (độ, rồi đơn vị rig bốn trường, độ, độ, đơn vị rig, độ,
 * đơn vị rig ba trường, đơn vị rig, độ, tỉ lệ bán kính tay, phần cánh tay trên, độ, giây), trường thiếu lấy các hằng `HELD_*` (`reach`: `AIM_GAP`; `seat`,
 * `body`: `CARRY`) của rig; `false` là không đo. `grip` khai thì thắng cả ngưỡng theo nhóm (`gripDeclared`). Sai kiểu thì
 * trả `{ error }`. docs/03-scene.md#đồ-cầm-tay, docs/11-nhom-cam.md

 */
export function heldOptions(dir = ".") {
  const raw = readPkg(resolve(dir))?.stickman?.held;
  if (raw === false || !rig.sceneHeldProblems) return { off: true };
  const out = {
    pose: rig.HELD_POSE,
    pierce: rig.HELD_PIERCE,
    touch: rig.HELD_TOUCH,
    wrap: rig.HELD_WRAP,
    grip: rig.HELD_GRIP,
    up: rig.HELD_UP,
    face: rig.HELD_FACE,
    drift: rig.HELD_DRIFT,
    turn: rig.HELD_TURN,
    reach: rig.AIM_GAP,
    seat: rig.CARRY?.seat,
    body: rig.CARRY?.body,
    sink: rig.HELD_SINK,
    wrist: rig.HELD_WRIST,
    arm: rig.HELD_ARM,
    elbow: rig.HELD_ELBOW,
    oppose: rig.HELD_OPPOSE,
    rest: rig.HELD_REST,
    hold: rig.HELD_HOLD,
  };
  if (raw === undefined) return out;
  const bad = `package.json: stickman.held phải là false hay { ${Object.keys(out).join(", ")} } số dương, đang là ${JSON.stringify(raw)}`;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { error: bad };
  for (const [key, v] of Object.entries(raw)) {
    if (!(key in out) || typeof v !== "number" || !(v > 0)) return { error: bad };
    out[key] = v;
  }
  if ("grip" in raw) out.gripDeclared = true;
  return out;
}

/**
 * Số đo đồ cầm ở giây `t` trên cảnh three `world` (`worldScene`): `pose(t)` rồi `heldHands`, `heldCarries` của rig cho mọi người đang
 * hiện — `frame` của `sceneHeld`. `pose(t)` ném thì giây ấy không có số đo, `onError(t, lỗi)`. `null` khi rig của repo
 * chưa có `heldHands`. Chỗ cầm nhóm mang `grasp` của `HeldHand`, đồ cầm đường cũ thì không. `onPosed(posed, t)`
 * được gọi sau mỗi lần đặt cảnh (luật `legacy` đọc cùng tư thế ấy).
 * docs/03-scene.md#đồ-cầm-tay
 */
export function heldFrame(rt, world, onError, onPosed) {
  const { scene, U, heldHands, heldCarries } = world;
  if (typeof heldHands !== "function") return null;
  const eye = rt.lens && [rt.lens.eye[0] * U, -rt.lens.eye[1] * U, -rt.lens.eye[2] * U];
  return (t) => {
    let posed;
    try {
      posed = scene.pose(t) ?? {};
    } catch (e) {
      onError?.(t, e);
      return [];
    }
    scene.root.updateMatrixWorld(true);
    onPosed?.(posed, t);
    return Object.entries(posed).flatMap(([id, f]) =>
      f?.root && shown(f.root)
        ? [...heldHands(f, id, { U, eye }), ...(heldCarries?.(f, id, { U }) ?? [])]
        : [],
    );
  };
}

/**
 * Các món đăng ký (`Cast3D.provide`) ở giây `t` trên cảnh three `world`: chỗ, hướng (thế giới rig), có hiện không, ai mang
 * — `items` của `sceneHeld` (món nhảy qua mốc `hold`). `null` khi cảnh không có `cast.provided` (rig cũ, `worldOf` tự dựng)
 */
export function heldItemsFrame(world) {
  const { scene, U } = world;
  if (typeof scene.cast?.provided !== "function") return null;
  return (t) => {
    scene.pose(t);
    scene.root.updateMatrixWorld(true);
    return scene.cast.provided().map(({ item, object, owner }) => {
      const p = object.getWorldPosition(object.position.clone());
      const q = object.getWorldQuaternion(object.quaternion.clone());
      const h = scene.cast.holder(item, t, owner);
      return {
        obj: object.id,
        item,
        ...(owner !== undefined && { owner }),
        p: [p.x / U, -p.y / U, -p.z / U],
        q: [q.x, q.y, q.z, q.w],
        shown: shown(object),
        ...(h && { holder: { id: h.id, hand: h.side < 0 ? "R" : "L" } }),
      };
    });
  };
}

/** Báo mốc khai mà JSON không neo: `stickman.marks.unused` trong `package.json`, `"off"` (mặc định) hay
 *  `"warn"` — lớp vẽ code đọc mốc qua `ctx.marks`, `check` không thấy. docs/03-scene.md#mốc-có-tên */
export const marksUnused = (dir = ".") => readPkg(resolve(dir))?.stickman?.marks?.unused ?? "off";

/** Vế kia của một chỗ lấn: `tên món (mảnh k)` hay `người.phần` */
const clashWith = (c) =>
  c.other ? `${c.other.id}.${c.other.part}` : `${c.name ?? `món #${c.item}`} (mảnh ${c.piece})`;

/**
 * Chỗ người 3D lồng vào đồ ở giây `t`, sâu trước: `{ who, with, depth }`. `scene_probe` trả nó cho
 * cảnh có `lens`. Có `world` (`worldScene`) thì người đo với mọi vật của cảnh three thay cho
 * `solids(ctx)`, như `check`; cảnh three ném lỗi thì `onWorld({ error })` và giây ấy đo bằng khối lớp
 * vẽ code, mục `touch` lạ thì `onWorld({ unknown })`. docs/10-lop-ve-code.md#người-lồng-vào-đồ
 */
export function clashesAt(
  rt,
  t,
  { characterOf, codeLayers, tol = CLASH_TOL, self = rig.PIERCE_TOL, world, onWorld },
) {
  let hits = null;
  if (world) {
    const unknown = new Map();
    try {
      hits = worldAt(rt, t, { world, tol, unknown: (e, name) => unknown.set(e, name) }).hits;
      dropNamed(unknown, world.scene.root);
      onWorld?.({ unknown });
    } catch (e) {
      onWorld?.({
        error: `cảnh three ném lỗi ở giây ${t.toFixed(2)} — ${e.message}; giây ấy đo bằng khối lớp vẽ code`,
      });
    }
  }
  return [
    ...FX.sceneClashes(rt, t, { characterOf, codeLayers: hits ? [] : codeLayers, tol, self }).map(
      (c) => ({ who: `${c.id}.${c.part}`, with: clashWith(c), depth: c.depth }),
    ),
    ...(hits ?? []).map((c) => ({ who: c.who, with: c.name, depth: c.depth })),
  ]
    .sort((a, b) => b.depth - a.depth)
    .map((c) => ({ ...c, depth: +c.depth.toFixed(1) }));
}

/** Dữ liệu `ctx` của `worldOf` chung mọi cảnh: nhân vật, hành động, động vật qua hai lớp, đạo cụ của repo */
export const worldData = (dir = ".") => {
  const root = resolve(dir);
  return {
    characters: loadCharacters([join(root, "characters"), COMMON.characters]),
    actions: loadActions([join(root, "actions"), COMMON.actions]),
    animals: loadAnimals([join(root, "animals"), COMMON.animals]),
    held: loadHeld([join(root, "held"), COMMON.held]),
    hands: loadHands([join(root, "hands"), COMMON.hands]),
    props: loadByFile([join(root, "props")], rig.parseProp),
  };
};

/**
 * Cảnh three `worldOf(scene.name, ctx)` của một cảnh, sẵn để đo: `{ ...world, scene }` với `world` của
 * `loadWorld`. `null` là cảnh ấy đi đường `solids(ctx)`, `{ error }` là dựng hỏng (`rel` là entry trong
 * dòng báo). `data` là `{ id, scene, runtime, characters, actions, animals, props }`, `heights` và
 * `bodies` suy ở đây — docs/10-lop-ve-code.md#đo-trên-cảnh-three
 */
export function worldScene(world, data, rel) {
  const { scene } = data;
  const [heights, bodies] = castBodies(scene, data.characters);
  let w;
  try {
    w = world.worldOf(scene.name, { ...data, heights, bodies });
  } catch (e) {
    return { error: `${rel}: worldOf("${scene.name}") ném lỗi — ${e.message}` };
  }
  if (w === null || w === undefined) return null;
  if (!w.root?.isObject3D || typeof w.pose !== "function")
    return {
      error: `${rel}: worldOf("${scene.name}") phải trả \`{ root: Object3D, pose(t) }\` hay null`,
    };
  return { ...world, scene: w };
}

/**
 * Các giây cảnh để đo người 3D: mỗi `every` giây, chia đôi quãng nào có đỉnh khối người dời quá
 * `CLASH_MOVE` (tới một khung `1/30 s`). Trả kèm `sceneBodies` của từng giây
 */
export function sceneSamples(rt, { characterOf, every = CLASH_EVERY }) {
  const built = new Map();
  const bodies = (t) => {
    const people = FX.sceneBodies(rt, t, { characterOf });
    built.set(t, people);
    return new Map(people.map((p) => [p.id, p.solids]));
  };
  // Đỉnh khối người dời xa nhất giữa hai mốc; người có ở mốc này mà không ở mốc kia là dời vô cùng
  const moved = (a, b) => {
    let m = a.size === b.size ? 0 : Infinity;
    for (const [id, ss] of a) {
      const tt = b.get(id);
      if (!tt) return Infinity;
      ss.forEach((s, i) =>
        s.v.forEach((p, k) => {
          const q = tt[i].v[k];
          m = Math.max(m, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]));
        }),
      );
    }
    return m;
  };
  const times = [0];
  const split = (t0, b0, t1, b1) => {
    if (t1 - t0 > 1 / 30 + 1e-9 && moved(b0, b1) > CLASH_MOVE) {
      const tm = (t0 + t1) / 2;
      const bm = bodies(tm);
      split(t0, b0, tm, bm);
      split(tm, bm, t1, b1);
    } else times.push(t1);
  };
  let b0 = bodies(0);
  for (let i = 1; i * every <= rt.duration + 1e-9; i++) {
    const t1 = +(i * every).toFixed(3);
    const b1 = bodies(t1);
    split(times.at(-1), b0, t1, b1);
    b0 = b1;
  }
  return { times, built };
}

/**
 * Gộp các chỗ đo được ở từng giây thành một dòng mỗi khoá: chỗ sâu nhất và các quãng giây liền nhau.
 * `at(t, i)` trả các chỗ của giây thứ `i`, mỗi chỗ `{ key, depth, … }`. Mỗi dòng `{ msg, key, measure }`,
 * `measure` là độ lấn sâu nhất
 */
function tally(times, at, line) {
  const pairs = new Map();
  times.forEach((t, i) => {
    for (const c of at(t, i)) {
      let r = pairs.get(c.key);
      if (r?.i === i) continue;
      if (!r) pairs.set(c.key, (r = { c, at: t, runs: [], i: -2 }));
      if (r.i === i - 1) r.runs[r.runs.length - 1][1] = t;
      else r.runs.push([t, t]);
      r.i = i;
      if (c.depth > r.c.depth) Object.assign(r, { c, at: t });
    }
  });
  const sec = ([a, b]) => (a === b ? a.toFixed(2) : `${a.toFixed(2)}–${b.toFixed(2)}`);
  return [...pairs.values()]
    .sort((a, b) => b.c.depth - a.c.depth)
    .map(({ c, at, runs }) => {
      const shown = runs.slice(0, 4).map(sec).join(", ");
      const more = runs.length > 4 ? `, +${runs.length - 4} quãng` : "";
      return {
        msg: `${line(c)} ở giây ${at.toFixed(2)} · giây ${shown}${more}`,
        key: c.key,
        measure: c.depth,
      };
    });
}

const shown = (o) => {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
};

/**
 * Chỗ người lồng vào vật trên cảnh three của repo video ở giây `t`: `pose(t)` rồi `collide` mọi người
 * đang hiện với mọi vật dưới `root`. Bỏ chỗ có điểm lấn sâu nhất ngoài khung camera; `depth` ra px rig,
 * `who` là `người.bộ phận[R|L]` như `touch`. Trả kèm khung bao từng vật (`boxes`, theo vật three sinh
 * ra nó). docs/10-lop-ve-code.md#đo-trên-cảnh-three
 */
function worldAt(rt, t, { world, tol, unknown }) {
  const { scene, collide, colliders, U } = world;
  const posed = scene.pose(t) ?? {};
  const figures = Object.fromEntries(
    Object.entries(posed).filter(([, f]) => f?.root && shown(f.root)),
  );
  scene.root.updateMatrixWorld(true);
  const cols = colliders(scene.root);
  const boxes = new Map();
  for (const c of cols) {
    if (!c.from) continue;
    const b = boxes.get(c.from);
    if (b) b.union(c.box);
    else boxes.set(c.from, c.box.clone());
  }
  const view = rt.lens && rig.cameraAt(rt, t).view;
  const inView = ({ at }) => {
    if (!view) return true;
    const [x, y] = rig.project(rt.lens, [at.x / U, -at.y / U, -at.z / U]);
    return x >= view.x && x <= view.x + view.w && y >= view.y && y <= view.y + view.h;
  };
  const eye = rt.lens && [rt.lens.eye[0] * U, -rt.lens.eye[1] * U, -rt.lens.eye[2] * U];
  const hits = collide(figures, cols, { slack: tol * U, eye, unknown })
    .filter(inView)
    .map((c) => {
      const who = `${c.who}.${c.part}${c.side ? (c.side < 0 ? "R" : "L") : ""}`;
      return { who, name: c.collider, depth: c.depth / U, key: `${who}|${c.collider}` };
    });
  return { hits, boxes };
}

/** Mặt nghiêng không quá ngần này (cos góc với phương đứng) mới là mặt ngang để đặt bàn tay */
const FLAT_TOP = Math.cos((30 * Math.PI) / 180);

/**
 * Mặt trên cao nhất của các vật `cols` dọc đường đứng qua điểm three `p`, không cao hơn `p` quá `sink`
 * (three): `{ y, flat, name }`, `flat` là mặt ấy gần nằm ngang. Khối lồi cắt theo các mặt phẳng, lưới
 * tam giác theo từng tam giác; bỏ vật `skip(c)`
 */
function topUnder(cols, p, sink, skip) {
  let best = null;
  const take = (y, ny, name) => {
    if (y > p.y + sink || (best && y <= best.y)) return;
    best = { y, flat: Math.abs(ny) >= FLAT_TOP, name };
  };
  for (const c of cols) {
    const b = c.box;
    if (p.x < b.min.x || p.x > b.max.x || p.z < b.min.z || p.z > b.max.z) continue;
    if (b.min.y > p.y + sink || (best && b.max.y <= best.y) || skip(c)) continue;
    if (c.planes) {
      let hi = Infinity;
      let lo = -Infinity;
      let ny = 1;
      let inside = true;
      for (const pl of c.planes) {
        const n = pl.normal;
        const r = -pl.constant - n.x * p.x - n.z * p.z;
        if (n.y > 1e-6) {
          if (r / n.y < hi) [hi, ny] = [r / n.y, n.y];
        } else if (n.y < -1e-6) lo = Math.max(lo, r / n.y);
        else if (r < -1e-6) inside = false;
      }
      if (inside && lo <= hi) take(hi, ny, c.name);
    } else if (c.tris) {
      const t = c.tris;
      for (let i = 0; i + 8 < t.length; i += 9) {
        const [ax, ay, az, bx, by, bz, cx, cy, cz] = t.subarray(i, i + 9);
        const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
        if (Math.abs(d) < 1e-12) continue;
        const u = ((bz - cz) * (p.x - cx) + (cx - bx) * (p.z - cz)) / d;
        const v = ((cz - az) * (p.x - cx) + (ax - cx) * (p.z - cz)) / d;
        if (u < 0 || v < 0 || u + v > 1) continue;
        const [ex, ey, ez, fx, fy, fz] = [bx - ax, by - ay, bz - az, cx - ax, cy - ay, cz - az];
        const nx = ey * fz - ez * fy;
        const ny = ez * fx - ex * fz;
        const nz = ex * fy - ey * fx;
        take(u * ay + v * by + (1 - u - v) * cy, ny / (Math.hypot(nx, ny, nz) || 1), c.name);
      }
    }
  }
  return best;
}

/**
 * Cảnh three ở giây `t` cho phép đo lòng bàn tay (`PalmFrame` của rig): `pose(t)` một lần; mặt ngang
 * dưới một điểm trong mọi vật của cảnh trừ đồ người ấy mang và người nền đóng băng (`userData.crowd`);
 * tay đang cầm đồ theo bàn tay three; người không có trong `pose(t)` là người đóng băng ở dáng giây 0.
 * docs/03-scene.md#lòng-bàn-tay
 */
export function palmFrame(t, world) {
  const { scene, colliders, U } = world;
  const posed = scene.pose(t) ?? {};
  scene.root.updateMatrixWorld(true);
  const cols = colliders(scene.root);
  return {
    frozen: (id) => !posed[id],
    held: (id, hand) => {
      const h = posed[id]?.hands?.[hand === "R" ? -1 : 1];
      return h ? !!h.held : undefined;
    },
    surface: (id, at) => {
      const own = posed[id]?.root;
      const p = { x: at[0] * U, y: -at[1] * U, z: -at[2] * U };
      const top = topUnder(
        cols,
        p,
        rig.PALM_SINK * U,
        (c) => (!!own && c.owner === own) || !!c.from?.userData.crowd,
      );
      return top?.flat ? { gap: (p.y - top.y) / U, name: top.name } : null;
    },
  };
}

/** Vật dời xa nhất giữa hai mẫu, đơn vị thế giới: góc khung bao của cùng một vật; vật hiện hay ẩn thì không tính */
function worldMoved(a, b, U) {
  let m = 0;
  for (const [o, p] of a) {
    const q = b.get(o);
    if (q) m = Math.max(m, p.min.distanceTo(q.min), p.max.distanceTo(q.max));
  }
  return m / U;
}

/**
 * Đo trên cảnh three ở các giây `times`, chia đôi thêm quãng nào có vật dời quá `CLASH_MOVE` (tới một
 * khung `1/30 s`) — đồ bay qua người giữa hai mẫu vẫn bị bắt. `pose(t)` hay `collide` ném thì dừng đo
 * cảnh three của cảnh, ghi lỗi vào `error`. Trả các giây đã đo và chỗ lấn của từng giây
 */
function worldSamples(rt, times, { world, tol }) {
  const at = new Map();
  const unknown = new Map();
  let error = null;
  const measure = (t) => {
    if (error) return null;
    try {
      const m = worldAt(rt, t, { world, tol, unknown: (e, name) => unknown.set(e, name) });
      at.set(t, m.hits);
      return m;
    } catch (e) {
      error = `cảnh three ném lỗi ở giây ${t.toFixed(2)} — ${e.message}; bỏ đo người lồng vào vật của cảnh three`;
      return null;
    }
  };
  const out = [times[0]];
  const split = (t0, m0, t1, m1) => {
    if (
      m0 &&
      m1 &&
      t1 - t0 > 1 / 30 + 1e-9 &&
      worldMoved(m0.boxes, m1.boxes, world.U) > CLASH_MOVE
    ) {
      const tm = (t0 + t1) / 2;
      const mm = measure(tm);
      split(t0, m0, tm, mm);
      split(tm, mm, t1, m1);
    } else out.push(t1);
  };
  let m0 = measure(times[0]);
  for (let i = 1; i < times.length; i++) {
    const m1 = measure(times[i]);
    split(times[i - 1], m0, times[i], m1);
    m0 = m1;
  }
  dropNamed(unknown, world.scene.root);
  return { times: out, at, unknown, error };
}

/** `touch` gọi tên vật khác (đồ lồng vào đồ của lớp vẽ code) không phải tên lạ */
function dropNamed(unknown, root) {
  root.traverse((o) => {
    unknown.delete(o.name);
    for (const c of o.userData.colliders ?? []) unknown.delete(c.name);
  });
}

/**
 * Người 3D lồng vào đồ khối hay vào người khác, mỗi cặp một dòng: chỗ lấn sâu nhất và các quãng
 * giây liền nhau. Có `world` (cảnh three của repo video, `{ scene, collide, colliders, U }`) thì đồ
 * là mọi vật của cảnh ấy, không còn là `solids(ctx)` của lớp vẽ code; cảnh three ném lỗi thì
 * `onWorld({ error })`, mục `touch` không phải phần người hay tên vật nào thì `onWorld({ unknown })`
 * (tên mục → tên vật). docs/10-lop-ve-code.md#người-lồng-vào-đồ
 */
export const sceneClashProblems = (rt, opts) => clashRows(rt, opts).map((r) => r.msg);

/** `sceneClashProblems` kèm khoá ổn định và độ lấn từng dòng (`{ msg, key, measure }`) cho baseline */
function clashRows(
  rt,
  {
    characterOf,
    codeLayers,
    tol = CLASH_TOL,
    self = rig.PIERCE_TOL,
    every = CLASH_EVERY,
    samples,
    world,
    onWorld,
  },
) {
  const { times: base, built } = samples ?? sceneSamples(rt, { characterOf, every });
  const w = world && worldSamples(rt, base, { world, tol });
  if (w) onWorld?.({ error: w.error, unknown: w.unknown });
  // `sceneClashes` sắp sâu trước: mỗi cặp (phần người, món) lấy mảnh lấn sâu nhất của khung. Món
  // gộp theo `name`: lớp ẩn bớt món thì chỉ số trong mảng `solids` dời giữa chừng
  const at = (t) => [
    ...FX.sceneClashes(rt, t, {
      characterOf,
      codeLayers: world ? [] : codeLayers,
      tol,
      self,
      people: built.get(t),
    }).map((c) => ({
      ...c,
      key: c.other
        ? `${c.id}.${c.part}|${c.other.id}.${c.other.part}`
        : `${c.id}.${c.part}|${c.name ?? `#${c.item}`}`,
    })),
    ...(w?.at.get(t) ?? []),
  ];
  return tally(w ? w.times : base, at, (c) =>
    c.who
      ? `người lồng vào đồ — ${c.who} ↔ ${c.name} lấn ${c.depth.toFixed(1)}`
      : c.other?.id === c.id
        ? `tay xuyên thân — ${c.id}.${c.part} lấn vào ${c.id}.torso ${c.depth.toFixed(1)}`
        : `người lồng vào đồ — ${c.id}.${c.part} ↔ ${clashWith(c)} lấn ${c.depth.toFixed(1)}`,
  );
}

/**
 * Món đồ lồng vào món khác, mỗi cặp món một dòng: chỗ lấn sâu nhất, phần thể tích của món nhỏ nằm
 * trong món kia, các quãng giây liền nhau. Món đứng yên chỉ đo một lần. docs/10-lop-ve-code.md#đồ-lồng-vào-đồ
 */
export const sceneItemClashProblems = (rt, opts) => itemClashRows(rt, opts).map((r) => r.msg);

/** `sceneItemClashProblems` kèm khoá ổn định và độ lấn từng dòng (`{ msg, key, measure }`) */
function itemClashRows(
  rt,
  { characterOf, codeLayers, tol = CLASH_TOL, ratio = ITEM_RATIO, every = CLASH_EVERY, samples },
) {
  const { times } = samples ?? sceneSamples(rt, { characterOf, every });
  const label = (name, k) => name ?? `món #${k}`;
  const at = (t) =>
    FX.sceneItemClashes(rt, t, { codeLayers, tol, ratio }).map((c) => {
      const [a, b] = [label(c.name, c.item), label(c.otherName, c.other)];
      return { ...c, a, b, key: [a, b].sort().join("|") };
    });
  return tally(times, at, (c) => {
    const small = c.small === "item" ? c.a : c.b;
    return `đồ lồng vào đồ — ${c.a} (mảnh ${c.piece}) ↔ ${c.b} (mảnh ${c.otherPiece}) lấn ${c.depth.toFixed(1)}, ${Math.round(c.ratio * 100)}% thể tích ${small}`;
  });
}

/** Người 3D trượt trên sàn, thân quay gắt: hợp lệ, chỉ nhìn là thấy — docs/03-scene.md#check-cho-người-3d */
const moveProblems = (rt) => [...rig.sceneSlideProblems(rt), ...rig.sceneTurnProblems(rt)];

/**
 * Nhóm luật của `check`, xếp theo thứ nó cần dựng: `ref` chỉ đọc JSON, `move` đo khớp người theo runtime, `hands`
 * và `held` cần cảnh three, `clash` cần cả cảnh three lẫn mẫu khối người, `episode` là tập, tiếng, git —
 * docs/05-repo-video.md#nhóm-luật
 */
export const CHECK_GROUPS = ["ref", "move", "hands", "held", "legacy", "clash", "episode"];

/**
 * Nhóm luật `check` chạy: `only` (mảng hay chuỗi phẩy ngăn, trống là mọi nhóm) trừ `skip`. Trả `{ groups, all }`,
 * `groups` theo thứ tự `CHECK_GROUPS`; tên sai hay bỏ hết nhóm thì `{ error }` kèm danh sách nhóm
 */
export function checkGroups({ only, skip } = {}) {
  const names = (v) =>
    (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [])
      .map((g) => String(g).trim())
      .filter(Boolean);
  const [want, drop] = [names(only), names(skip)];
  const list = `nhóm của check: ${CHECK_GROUPS.join(", ")}`;
  const bad = [...new Set([...want, ...drop])].filter((g) => !CHECK_GROUPS.includes(g));
  if (bad.length)
    return { error: `không có nhóm ${bad.map((g) => `\`${g}\``).join(", ")} — ${list}` };
  const groups = CHECK_GROUPS.filter(
    (g) => (!want.length || want.includes(g)) && !drop.includes(g),
  );
  if (!groups.length) return { error: `không còn nhóm nào để soi — ${list}` };
  return { groups, all: groups.length === CHECK_GROUPS.length };
}

/** Cộng thời gian chạy `fn` (ms) vào `acc[key]` */
function lap(acc, key, fn) {
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    acc[key] = (acc[key] ?? 0) + performance.now() - t0;
  }
}

async function lapAsync(acc, key, fn) {
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    acc[key] = (acc[key] ?? 0) + performance.now() - t0;
  }
}

const addTimes = (acc, more) => {
  for (const [k, v] of Object.entries(more ?? {})) acc[k] = (acc[k] ?? 0) + v;
};

/** Tên các phần `time` của `checkWorkspace`, theo thứ tự in */
export const CHECK_TIMES = {
  load: "nạp workspace (JSON, bộ phận vẽ code)",
  runtime: "dựng runtime (resolveScene)",
  layers: "gói lớp vẽ code",
  worldModule: "gói module cảnh three",
  threads: "nạp luồng phụ",
  three: "dựng cảnh three",
  ref: "ref",
  move: "move",
  hands: "hands",
  held: "held",
  legacy: "legacy",
  clash: "clash",
  episode: "episode",
};

/**
 * Luật đồ cầm tay của một cảnh (`sceneHeld` của rig) trên cảnh three `on` đã dựng (`worldScene`). `quiet`: lượt đo người
 * lồng vào vật đã báo cảnh three ném lỗi, không báo lại
 */
export function heldRows(ctx, rt, on, warn, quiet, onPosed) {
  let thrown = quiet;
  const onError = (t, e) => {
    if (!thrown)
      warn(
        `${ctx.worldRel}: cảnh three ném lỗi ở giây ${t.toFixed(2)} — ${e.message}; bỏ đo đồ cầm tay ở giây ấy`,
      );
    thrown = true;
  };
  const frame = heldFrame(rt, on, onError, onPosed);
  if (!frame) return;
  const items = heldItemsFrame(on);
  let issues;
  try {
    // `gripDeclared`: `grip` khai ở `package.json` thay ngưỡng theo nhóm của chỗ cầm nhóm
    issues = rig.sceneHeld(rt, { ...ctx.held, frame, ...(items && { items }) });
  } catch (e) {
    return warn(`không đo được đồ cầm tay — ${e.message}`);
  }
  for (const s of issues) {
    warn(rig.heldLine(s), {
      key: `held:${s.rule}|${s.id}|${s.hand}|${s.item}`,
      measure: s.worst,
      ...(s.error && { error: true }),
    });
  }
  // Cảnh khai `hold` món mà `extra` không `provide`
  if (items && rig.heldUnprovided)
    for (const u of rig.heldUnprovided(rt, on.scene.cast.provided()))
      warn(rig.heldUnprovidedLine(u), { key: `held:provide|${u.id}|${u.item}` });
}

/**
 * Các lần cầm còn đi đường cũ (`legacyHolds` của bản rig cảnh three `world` nạp) gom qua các giây đã đặt cảnh: `add(posed)`
 * cho mỗi tư thế, `line()` một dòng cho cả cảnh hay `null`
 */
function legacyCollector(world) {
  const seen = new Map();
  return {
    add(posed) {
      for (const [id, f] of Object.entries(posed ?? {}))
        if (f?.root)
          for (const l of world.legacyHolds?.(f, id) ?? [])
            if (!seen.has(`${l.id}|${l.hand}|${l.item}`))
              seen.set(`${l.id}|${l.hand}|${l.item}`, l);
    },
    get size() {
      return seen.size;
    },
    line: () => (seen.size ? rig.heldLegacyLine([...seen.values()]) : null),
  };
}

/**
 * Đo sâu một cảnh theo nhóm `ctx.groups`: trượt chân, thân quay gắt, giật trên hình (`move`); người lồng vào đồ, tay
 * xuyên thân, đồ lồng vào đồ (`clash`); tay sai dáng, lòng tay, đích theo mốc (`hands`); đồ cầm tay (`held`). Nhóm không
 * chạy thì không dựng thứ nó cần: cảnh three chỉ dựng cho `clash`, `hands`, `held`, mẫu khối người chỉ cho `clash`. Mỗi
 * mục `{ msg, group, key?, measure? }` (`key`, `measure` cho baseline), `error: true` là lỗi; mục `touch` lạ kèm `touch`
 * (tên mục) vì `check` chỉ báo nó ở cảnh đầu tiên gặp. `time` là ms từng phần. `ctx` là dữ liệu đã nạp của workspace
 * cùng ngưỡng đã kiểm
 */
function deepScene(ctx, name) {
  const { scenesByName, sceneRuntime, charactersByName, codeLayers, world, worldRel } = ctx;
  const { clash, arm, palm, snap, spans, held, groups } = ctx;
  const has = (g) => groups.includes(g);
  const time = {};
  const out = { move: [], clash: [], snap: [], time };
  const data = scenesByName[name];
  const rt = data && lap(time, "runtime", () => sceneRuntime(name));
  if (!rt) return out;
  const file = `scenes/${name}.json`;
  const row = (group, msg, { key, ...extra } = {}) => ({
    msg: `${file}: ${msg}`,
    group,
    ...(key ? { key: `${file}|${key}` } : {}),
    ...extra,
  });
  if (has("move"))
    lap(time, "move", () => {
      try {
        for (const problem of moveProblems(rt)) out.move.push(row("move", problem));
      } catch (e) {
        out.move.push(row("move", e.message, { error: true }));
      }
    });
  const people = !!data.lens && data.cast.some((m) => m.world);
  const doClash = has("clash") && !!clash && people;
  const doHands = has("hands") && people;
  const doHeld = has("held") && !!held && !held.off && !held.error && people;
  const doLegacy = has("legacy") && people;
  const warn = (group, msg, extra) => out.clash.push(row(group, msg, extra));
  const characterOf = (m) => {
    const character = m.character ? charactersByName[m.character] : rig.defaultCharacter();
    return character && { character };
  };
  // Cảnh three dựng một lần cho mọi nhóm cần nó; `ctx` là dữ liệu `check` đã nạp và resolve, cùng khoá như `data.ts`
  let on;
  if (world && (doClash || doHands || doHeld || doLegacy)) {
    const scene = lap(time, "three", () =>
      worldScene(
        world,
        {
          id: name,
          scene: data,
          runtime: rt,
          characters: charactersByName,
          actions: ctx.actionsByName,
          animals: ctx.animalsByName,
          props: ctx.props,
        },
        worldRel,
      ),
    );
    if (scene?.error)
      warn(doClash ? "clash" : doHands ? "hands" : doHeld ? "held" : "legacy", scene.error);
    on = scene && !scene.error ? scene : undefined;
  }
  if (doClash)
    lap(time, "clash", () => {
      const { tol, ratio, self } = clash;
      const onWorld = ({ error, unknown }) => {
        if (error) warn("clash", `${worldRel}: ${error}`);
        for (const [entry, thing] of unknown)
          warn(
            "clash",
            `\`touch\` "${entry}" của vật ${thing} không phải phần người nào — bỏ qua (docs/10-lop-ve-code.md#đo-trên-cảnh-three)`,
            { touch: entry },
          );
      };
      let rows;
      try {
        const samples = sceneSamples(rt, { characterOf });
        rows = [
          ...clashRows(rt, { characterOf, codeLayers, tol, self, samples, world: on, onWorld }).map(
            (r) => ({ ...r, key: `người|${r.key}` }),
          ),
          ...(ratio === false
            ? []
            : itemClashRows(rt, { characterOf, codeLayers, tol, ratio, samples }).map((r) => ({
                ...r,
                key: `đồ|${r.key}`,
              }))),
        ];
      } catch (e) {
        return warn("clash", `không đo được người 3D với đồ khối — ${e.message}`);
      }
      for (const r of rows) warn("clash", r.msg, { key: r.key, measure: r.measure });
    });
  if (doHands)
    lap(time, "hands", () => {
      const who = (m) => characterOf(m)?.character;
      const frame = on && ((t) => palmFrame(t, on));
      const each = (what, issues, line, key, measure) => {
        let list;
        try {
          list = issues();
        } catch (e) {
          return warn("hands", `không đo được ${what} — ${e.message}`);
        }
        for (const s of list) warn("hands", line(s), { key: key(s), measure: measure(s) });
      };
      // Tay sai dáng: khuỷu thẳng, ngón chĩa vào nhau, lòng tay ngửa, lơ lửng trên mặt, chạm đầu người khác —
      // docs/03-scene.md#tay-và-khuỷu
      if (!arm.error && !arm.off)
        each(
          "tay sai dáng",
          () => rig.sceneArms(rt, { ...arm, characterOf: who, frame }),
          rig.armLine,
          (s) =>
            `arm:${s.rule}${s.kind ? `:${s.kind}` : ""}|${s.id}|${s.hand}|${s.on ?? s.other ?? ""}`,
          (s) => s.amount,
        );
      if (!palm.error && !palm.off) {
        // Lòng bàn tay quay sai — docs/03-scene.md#lòng-bàn-tay
        each(
          "lòng bàn tay",
          () => rig.scenePalms(rt, { ...palm, characterOf: who, frame }),
          rig.palmLine,
          (s) => `palm:${s.rule}|${s.id}|${s.hand}|${s.on ?? ""}`,
          (s) => s.angle,
        );
        // Đích theo mốc thân, lòng tay theo ý định không đạt — docs/03-scene.md#bàn-tay-theo-ý-định
        each(
          "đích theo mốc",
          () => rig.sceneAims(rt, { hold: palm.hold, characterOf: who }),
          rig.aimLine,
          (s) => `aim:${s.rule}|${s.id}|${s.hand}|${s.to ?? ""}`,
          (s) => s.amount,
        );
      }
    });
  // Đồ cầm tay: dáng, ngón xuyên đồ, độ ôm, món xoay, món trôi, món nhảy, tay phụ — docs/03-scene.md#đồ-cầm-tay
  const legacy = doLegacy && on ? legacyCollector(on) : null;
  if (doHeld && on)
    lap(time, "held", () =>
      heldRows(
        ctx,
        rt,
        on,
        (msg, extra) => warn("held", msg, extra),
        doClash,
        legacy && ((posed) => legacy.add(posed)),
      ),
    );
  // Đồ cầm còn đi đường cũ: một dòng cho cả cảnh; đi cùng `held` thì đọc chung các tư thế ấy
  if (legacy)
    lap(time, "legacy", () => {
      if (!doHeld)
        for (let t = 0; t <= rt.duration + 1e-9; t += rig.HELD_EVERY) {
          let posed;
          try {
            posed = on.scene.pose(+t.toFixed(4));
          } catch {
            break;
          }
          legacy.add(posed);
        }
      const line = legacy.line();
      if (line) warn("legacy", line, { key: "legacy", measure: legacy.size });
    });
  if (has("move") && !snap.error && !snap.off)
    lap(time, "move", () => {
      const characterOf = (m) =>
        m.character ? charactersByName[m.character] : rig.defaultCharacter();
      try {
        for (const s of rig.sceneSnaps(rt, { characterOf, ...snap, spans: spans[name] }))
          out.snap.push(
            row("move", rig.snapLine(s), { key: `snap|${s.id}|${s.joint}`, measure: s.px }),
          );
        // khuỷu khoá xoay quá nhanh: rig không kẹp nó — docs/03-scene.md#giật-trên-hình
        for (const s of rig.elbowLockSnaps(rt, { characterOf, spans: spans[name] }))
          out.snap.push(
            row("move", rig.elbowLockLine(s), {
              key: `snap|${s.id}|elbowLock|${s.hand}`,
              measure: s.deg,
            }),
          );
      } catch (e) {
        out.snap.push(row("move", `không đo được giật trên hình — ${e.message}`));
      }
    });
  return out;
}

/**
 * Dữ liệu `deepScene` của một luồng phụ: nạp lại workspace như `checkWorkspace` (hai lớp nhân vật,
 * hành động, động vật, đạo cụ của repo, bộ phận, và lớp vẽ code, cảnh three khi nhóm cần) cho các cảnh `names`;
 * ngưỡng (`clash`, `arm`, `palm`, `snap`, `held`), `spans` và `groups` lấy từ luồng chính đã kiểm. `setup` là ms nạp
 */
export async function deepContext({ dir, names, ...opts }) {
  const t0 = performance.now();
  const root = resolve(dir);
  const has = (g) => opts.groups.includes(g);
  const actionsByName = loadActions([join(root, "actions"), COMMON.actions]);
  const charactersByName = loadCharacters([join(root, "characters"), COMMON.characters]);
  const animalsByName = loadAnimals([join(root, "animals"), COMMON.animals]);
  const heldByName = loadHeld([join(root, "held"), COMMON.held]);
  const handsByName = loadHands([join(root, "hands"), COMMON.hands]);
  const props = loadByFile([join(root, "props")], rig.parseProp);
  if (partsEntry(root)) rig.registerParts(await loadParts(root));
  const scenesByName = {};
  for (const name of names) {
    const r = rig.parseScene(readJson(join(root, "scenes", `${name}.json`)));
    if (r.success) scenesByName[name] = r.data;
  }
  const runtimes = new Map();
  const sceneRuntime = (name) => {
    if (!runtimes.has(name)) {
      let rt = null;
      try {
        rt = castRuntime(
          scenesByName[name],
          actionsByName,
          animalsByName,
          props,
          charactersByName,
          heldByName,
          handsByName,
        );
      } catch {
        rt = null;
      }
      runtimes.set(name, rt);
    }
    return runtimes.get(name);
  };
  let codeLayers = [];
  if (has("clash") && layersEntry(root))
    try {
      codeLayers = await loadLayers(root);
    } catch {
      codeLayers = [];
    }
  const we = WORLD_GROUPS.some(has) && worldEntry(root);
  let world = null;
  if (we)
    try {
      world = await loadWorld(root);
    } catch {
      world = null;
    }
  return {
    ...opts,
    scenesByName,
    sceneRuntime,
    charactersByName,
    actionsByName,
    animalsByName,
    props,
    codeLayers,
    world,
    worldRel: we && relative(root, we),
    setup: performance.now() - t0,
  };
}

/** Nhóm cần cảnh three của repo (`stickman.world`) */
const WORLD_GROUPS = ["clash", "hands", "held", "legacy"];

/** RAM một luồng đo sâu cần, ước chừng */
const JOB_RAM = 1e9;

/** Số luồng đo sâu mặc định cho `n` cảnh: nửa số nhân, không quá số GB RAM còn trống */
export const checkJobs = (n) =>
  Math.max(1, Math.min(n, Math.floor(availableParallelism() / 2), Math.floor(freemem() / JOB_RAM)));

/**
 * `deepScene` cho mọi cảnh `names`, theo id cảnh. Nhiều cảnh thì chia cho `jobs` luồng phụ, mỗi luồng
 * lấy cảnh kế tiếp (nặng trước) khi xong cảnh trước; luồng hỏng thì cảnh còn lại đo ở luồng chính.
 * Thời gian nạp của từng luồng cộng vào `times.threads`
 */
async function deepScenes(root, names, ctx, jobs = checkJobs(names.length), times = {}) {
  const out = new Map();
  const n = Math.min(jobs, names.length);
  if (n > 1) {
    const { clash, arm, palm, snap, spans, held, groups } = ctx;
    // cảnh nặng (dài, đông người) đi trước để không cảnh nào kéo đuôi
    const weight = (name) => {
      const d = ctx.scenesByName[name];
      return (d?.duration ?? 0) * Math.max(1, d?.cast.length ?? 0);
    };
    const queue = [...names].sort((a, b) => weight(b) - weight(a));
    await Promise.all(
      Array.from(
        { length: n },
        () =>
          new Promise((done) => {
            const w = new Worker(new URL("./check-worker.mjs", import.meta.url), {
              workerData: { dir: root, names, clash, arm, palm, snap, spans, held, groups },
            });
            const next = () => {
              const name = queue.shift();
              if (name === undefined) w.terminate().then(done, done);
              else w.postMessage(name);
            };
            w.on("message", (m) => {
              if (m.name !== undefined) out.set(m.name, m.result);
              else addTimes(times, { threads: m.setup });
              next();
            });
            w.on("error", done);
            w.on("exit", done);
          }),
      ),
    );
  }
  for (const name of names) if (!out.has(name)) out.set(name, deepScene(ctx, name));
  return out;
}

/** Luồng phụ của `deepScenes`: nhận id cảnh, trả `deepScene` của nó */
export async function deepWorker(port, data) {
  const ctx = await deepContext(data);
  port.on("message", (name) => port.postMessage({ name, result: deepScene(ctx, name) }));
  port.postMessage({ ready: true, setup: ctx.setup });
}

/** Danh sách tên của một tham số: mảng hay chuỗi phẩy ngăn */
const nameList = (v) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [])
    .map((x) => String(x).trim())
    .filter(Boolean);

/** Tên hành động, nhân vật, đạo cụ, động vật (bỏ đuôi `.json`) mà JSON một cảnh dùng — `check --uses` */
export function sceneUses(scene) {
  const out = new Set();
  const bare = (f) => f.replace(/\.json$/, "");
  const clips = (tracks) => {
    for (const t of tracks ?? []) for (const c of t.clips ?? []) if (c.action) out.add(c.action);
  };
  for (const c of scene.cast ?? []) {
    if (c.character) out.add(bare(c.character));
    clips(c.tracks);
  }
  for (const p of scene.props ?? []) if (p.prop) out.add(bare(p.prop));
  for (const a of scene.animals ?? []) {
    if (a.animal) out.add(bare(a.animal));
    clips(a.tracks);
  }
  return out;
}

/** Cờ có giá trị của `stickman check` → tên tham số của `checkWorkspace` */
const CHECK_VALUE_FLAGS = {
  scene: "scene",
  jobs: "jobs",
  only: "only",
  skip: "skip",
  uses: "uses",
  baseline: "baseline",
  "save-baseline": "saveBaseline",
};

/**
 * Tham số `stickman check` từ dòng lệnh (các cờ sau tên lệnh): `{ scene, jobs, only, skip, uses, baseline, saveBaseline,
 * time }`; `--held` là tên tắt của `--only held`, `--only` / `--skip` / `--uses` lặp thì cộng dồn. Sai thì `{ error }`
 */
export function parseCheckArgs(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("--")) continue;
    const flag = args[i].slice(2);
    if (flag === "held") out.only = [...(out.only ?? []), "held"];
    else if (flag === "time") out.time = true;
    else if (flag in CHECK_VALUE_FLAGS) {
      const v = args[i + 1];
      if (v === undefined || v.startsWith("--")) return { error: `--${flag} cần một giá trị` };
      i++;
      const key = CHECK_VALUE_FLAGS[flag];
      if (key === "only" || key === "skip" || key === "uses") {
        const list = nameList(v);
        if (!list.length) return { error: `--${flag} cần ít nhất một tên` };
        out[key] = [...(out[key] ?? []), ...list];
      } else out[key] = v;
    }
  }
  if (out.jobs !== undefined) {
    if (!(Number(out.jobs) >= 1))
      return { error: `--jobs phải là số nguyên dương, không phải \`${out.jobs}\`` };
    out.jobs = Math.floor(Number(out.jobs));
  }
  const picked = checkGroups(out);
  if (picked.error) return { error: picked.error };
  return out;
}

/** Cờ của từng lệnh `stickman`: bật tắt (`bool`) và nhận một giá trị (`value`); lệnh nào cũng nhận `--dir <thư mục>` */
export const CLI_FLAGS = {
  init: { bool: ["force"], value: ["name"] },
  upgrade: { bool: ["yes", "skip-modified", "dry-run"], value: [] },
  docs: { bool: [], value: [] },
  check: { bool: ["held", "time"], value: Object.keys(CHECK_VALUE_FLAGS) },
  retime: { bool: ["dry-run"], value: ["mark"] },
  reseat: { bool: ["dry-run"], value: ["before"] },
  "migrate-held": { bool: ["dry-run"], value: ["scene", "held-dir", "map", "out"] },
  studio: { bool: [], value: ["port", "host"] },
  studio2d: { bool: [], value: ["port"] },
};

/** Danh sách cờ của lệnh `cmd` để in */
export const cliFlagList = (cmd) => {
  const f = CLI_FLAGS[cmd];
  return [...f.bool.map((x) => `--${x}`), ...[...f.value, "dir"].map((x) => `--${x} <…>`)].join(
    ", ",
  );
};

/**
 * Soát dòng lệnh `stickman <lệnh> …` trước khi chạy: có `--help` / `-h` thì `{ cmd, help: true }`; lệnh không có thì
 * `{ cmd, unknown: true }`; cờ lệnh ấy không nhận hay cờ thiếu giá trị thì `{ cmd, error }` kèm danh sách cờ của lệnh
 */
export function cliArgs(args) {
  const cmd = args[0];
  if (args.includes("--help") || args.includes("-h")) return { cmd, help: true };
  const spec = Object.hasOwn(CLI_FLAGS, cmd) ? CLI_FLAGS[cmd] : undefined;
  if (!spec) return { cmd, unknown: true };
  const value = new Set([...spec.value, "dir"]);
  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("-")) continue;
    const name = a.startsWith("--") ? a.slice(2) : undefined;
    if (name !== undefined && spec.bool.includes(name)) continue;
    if (name !== undefined && value.has(name)) {
      const v = args[i + 1];
      if (v === undefined || v.startsWith("--"))
        return {
          cmd,
          error: `--${name} cần một giá trị. Cờ của \`stickman ${cmd}\`: ${cliFlagList(cmd)}`,
        };
      i++;
      continue;
    }
    return {
      cmd,
      error: `\`stickman ${cmd}\` không nhận \`${a}\`. Cờ của lệnh này: ${cliFlagList(cmd)}`,
    };
  }
  return { cmd };
}

/** Số đứng riêng trong dòng báo — không dính vào tên (`t01-s005`, `03-scene`, `#3`) */
const LOOSE_NUM = /(?<![\p{L}\p{N}_#./-])-?\d+(?:\.\d+)?(?![\p{L}\p{N}_/-])/gu;

/** Khoá ổn định của một dòng báo không có khoá riêng: bỏ clip đang chạy, số thay bằng `#` */
export const lineKey = (msg) => msg.replace(/\. Clip đang chạy: .*$/s, "").replace(LOOSE_NUM, "#");

/** Số đo chính của dòng báo chỉ có chữ: trượt, không tới mốc dừng, thân quay, tiếng cụt */
const LINE_MEASURES = [
  /trượt (\d+) đơn vị/,
  /cách `at` (\d+) đơn vị/,
  /thân quay (\d+)°/,
  /mỗi nhịp (\d+)°/,
  /cụt (\d+(?:\.\d+)?)s/,
];

export function lineMeasure(msg) {
  for (const re of LINE_MEASURES) {
    const m = re.exec(msg);
    if (m) return Number(m[1]);
  }
  return undefined;
}

/** Cảnh báo nặng hơn baseline khi số đo chính gấp từ `BASELINE_RATIO` lần **và** hơn từ `BASELINE_STEP` (đơn vị của số đo) */
export const BASELINE_RATIO = 1.25;
export const BASELINE_STEP = 1;

const heavier = (now, was) =>
  typeof now === "number" &&
  typeof was === "number" &&
  now >= was * BASELINE_RATIO &&
  now - was >= BASELINE_STEP;

const r2 = (v) => (typeof v === "number" ? Math.round(v * 100) / 100 : undefined);

/**
 * Gộp cảnh báo theo khoá thành mục baseline `{ scene, group, key, count, measure, msg }`: `count` số dòng cùng khoá,
 * `measure` số đo lớn nhất, `msg` dòng đầu. `rows` là `{ scene, group, key, measure, msg }`
 */
export function baselineEntries(rows) {
  const by = new Map();
  for (const r of rows) {
    const e = by.get(r.key);
    if (!e)
      by.set(r.key, {
        scene: r.scene ?? null,
        group: r.group,
        key: r.key,
        count: 1,
        ...(typeof r.measure === "number" ? { measure: r2(r.measure) } : {}),
        msg: r.msg,
      });
    else {
      e.count++;
      if (typeof r.measure === "number" && !(e.measure >= r2(r.measure))) e.measure = r2(r.measure);
    }
  }
  return sortEntries([...by.values()]);
}

/** Thứ tự ổn định của file baseline: cảnh (mục chung trước), nhóm theo `CHECK_GROUPS`, khoá */
const sortEntries = (list) =>
  list.sort(
    (a, b) =>
      (a.scene ?? "").localeCompare(b.scene ?? "") ||
      CHECK_GROUPS.indexOf(a.group) - CHECK_GROUPS.indexOf(b.group) ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );

/**
 * So cảnh báo lượt này (`rows`, như `baselineEntries`) với mục baseline `entries`: `fresh` khoá chưa có, `worse` khoá có
 * mà nhiều dòng hơn hay số đo nặng hơn rõ rệt (khoá → mục cũ), `gone` mục cũ trong phạm vi lượt này (`inScope(mục)`) mà
 * lượt này không còn
 */
export function compareBaseline(rows, entries, inScope) {
  const old = new Map(entries.map((e) => [e.key, e]));
  const now = baselineEntries(rows);
  const fresh = new Set();
  const worse = new Map();
  for (const e of now) {
    const o = old.get(e.key);
    if (!o) fresh.add(e.key);
    else if (e.count > (o.count ?? 1) || heavier(e.measure, o.measure)) worse.set(e.key, o);
  }
  const seen = new Set(now.map((e) => e.key));
  const gone = entries.filter((e) => inScope(e) && !seen.has(e.key));
  return { fresh, worse, gone };
}

/** Baseline mới: mục cũ trong phạm vi lượt này (`inScope`) thay bằng mục của lượt này, mục ngoài phạm vi giữ */
export const mergeBaseline = (entries, rows, inScope) => {
  const now = baselineEntries(rows);
  const keys = new Set(now.map((e) => e.key));
  return sortEntries([...entries.filter((e) => !inScope(e) && !keys.has(e.key)), ...now]);
};

/** Đọc file baseline: `null` khi chưa có file; hỏng thì ném */
function readBaseline(path) {
  if (!existsSync(path)) return null;
  const b = readJson(path);
  if (!b || !Array.isArray(b.warnings))
    throw new Error("không phải baseline của stickman check (thiếu mảng `warnings`)");
  return b.warnings;
}

/**
 * Soi một workspace: version đã đóng dấu so với rig đang cài, JSON hỏng, tham chiếu chéo trỏ
 * vào file không có, người 3D diễn hành động 2D, trượt hay lồng vào đồ, tay chân giật trên hình,
 * tiếng tràn chỗ.
 *
 * `scene` (regex trên id cảnh) và `uses` (tên hành động, nhân vật, đạo cụ, động vật: cảnh dùng chúng) chỉ soi sâu cảnh
 * khớp cả hai: cảnh báo của chúng và lỗi ở bất kỳ đâu; tập, tiếng, git và công cụ ngoài bỏ qua —
 * docs/05-repo-video.md#soi-một-cảnh. `only` / `skip` chọn nhóm luật (`CHECK_GROUPS`); nhóm không chạy thì không dựng
 * thứ nó cần — docs/05-repo-video.md#nhóm-luật. `baseline` (file JSON, đường tính từ `dir`) chỉ trả lỗi và cảnh báo mới
 * hay nặng hơn file ấy, `saveBaseline` ghi cảnh báo lượt này vào file — docs/05-repo-video.md#baseline. `jobs` là số
 * luồng đo sâu các cảnh, mặc định theo số nhân và RAM trống (`checkJobs`). `time` trả về là ms từng phần (`CHECK_TIMES`)
 * cộng dồn mọi cảnh và mọi luồng, `wall` là ms cả lượt
 */
export async function checkWorkspace({
  dir = ".",
  scene,
  jobs,
  only,
  skip,
  uses,
  baseline,
  saveBaseline,
} = {}) {
  const t0 = performance.now();
  const times = {};
  const root = resolve(dir);
  const problems = [];
  const fail = (msg) => ({
    dir: root,
    counts: {},
    problems: [{ level: "lỗi", msg }],
    frozen: 0,
    scenes: [],
  });
  const picked = checkGroups({ only, skip });
  if (picked.error) return fail(picked.error);
  const { groups } = picked;
  const has = (g) => groups.includes(g);
  let focus = null;
  if (scene !== undefined && scene !== null && scene !== "") {
    try {
      focus = scene instanceof RegExp ? scene : new RegExp(scene);
    } catch (e) {
      return fail(`scene \`${scene}\` không phải regex — ${e.message}`);
    }
  }
  const usesNames = nameList(uses).map((n) => n.replace(/\.json$/, ""));
  const focusing = !!focus || usesNames.length > 0;
  const inFocus = (name, data) =>
    (!focus || focus.test(name)) &&
    (!usesNames.length ||
      (() => {
        const used = sceneUses(data);
        return usesNames.some((n) => used.has(n));
      })());
  // Cảnh, tập hay lớp đang soi: khớp `stickman.frozen` thì nó vẫn được nạp cho tham chiếu chéo,
  // chỉ thôi kêu
  const frozen = frozenOf(root);
  let owner = null;
  // `--uses` một hành động: cảnh báo của chính file hành động ấy cũng in
  let shownAction = false;
  let muted = 0;
  const focused = new Set();
  const scenesByName = {};
  // Khoá và số đo của từng cảnh báo cho baseline
  const meta = new Map();
  const push = (level, msg, { group, key, measure } = {}) => {
    if (focusing && level !== "lỗi" && !shownAction && !(owner !== null && focused.has(owner)))
      return;
    if (owner !== null && frozen.test(owner)) {
      muted++;
      return;
    }
    const p = group ? { level, msg, group } : { level, msg };
    problems.push(p);
    if (level !== "lỗi")
      meta.set(p, {
        scene: owner !== null && owner in scenesByName ? owner : null,
        key: key ?? lineKey(msg),
        measure: measure ?? lineMeasure(msg),
      });
  };
  const bad = (msg, extra) => push("lỗi", msg, extra);
  const warn = (msg, extra) => push("cảnh báo", msg, extra);
  /** Cảnh báo của một nhóm */
  const warnIn = (group) => (msg, extra) => warn(msg, { ...extra, group });
  const refWarn = warnIn("ref");
  if (frozen.error) bad(frozen.error);
  const unusedMarks = marksUnused(root);
  if (has("ref") && unusedMarks !== "off" && unusedMarks !== "warn")
    bad(
      `package.json: stickman.marks.unused phải là "off" hay "warn", đang là ${JSON.stringify(unusedMarks)}`,
    );

  const stamp = readStickman(root);
  const installed =
    pkgVersionOnDisk("@stickman3d/rig", root) ?? pkgVersion("@stickman3d/rig", root);
  if (has("ref")) {
    if (!stamp) refWarn("không có stickman.json — workspace này chưa qua `stickman init`");
    else if (installed && stamp.versions?.rig !== installed)
      refWarn(
        `stickman.json ghi @stickman3d/rig@${stamp.versions?.rig} nhưng đang cài ${installed} — chạy \`stickman upgrade\``,
      );
    if (stamp && !stamp.files)
      refWarn(
        "stickman.json chưa có bảng băm — `stickman upgrade` sẽ hỏi lại từng file một lượt đầu",
      );
  }

  const loadStart = performance.now();
  const inner = {};
  const piecesDir = join(root, "pieces");
  const piecesLayers = [piecesDir, COMMON.pieces];
  const actionsLayers = [join(root, "actions"), COMMON.actions];
  const animalsLayers = [join(root, "animals"), COMMON.animals];
  const charactersLayers = [join(root, "characters"), COMMON.characters];
  const actionsByName = loadActions(actionsLayers);
  const charactersByName = loadCharacters(charactersLayers);

  const counts = {};
  // Bộ phận vẽ code phải vào `PARTS` trước khi parse scene: `fx` đối chiếu tên với nó — docs/02
  try {
    if (partsEntry(root)) {
      const parts = await loadParts(root);
      rig.registerParts(parts);
      counts.parts = Object.keys(parts).length;
    }
  } catch (e) {
    bad(e.message);
  }

  // Runtime theo id cảnh, dựng một lần cho mọi lượt đo; `null` là chưa dựng nổi
  const runtimes = new Map();
  const assets = [];
  const inLayers = (dirs, file) => dirs.some((d) => existsSync(join(d, file)));
  // `animals` trước `scenes`: trôi ngang của con vật nướng từ chính JSON của nó
  const kinds = {
    characters: rig.parseCharacter,
    actions: rig.parseAction,
    props: rig.parseProp,
    animals: rig.parseAnimal,
    held: rig.parseHeldItem,
    hands: rig.parseHandShape,
    scenes: rig.parseScene,
  };
  const characters = [];
  const props = [];
  const animalsByName = loadAnimals(animalsLayers);
  const heldByName = loadHeld([join(root, "held"), COMMON.held]);
  const handsByName = loadHands([join(root, "hands"), COMMON.hands]);
  if (usesNames.length) {
    const known = new Set([
      ...Object.keys(actionsByName),
      ...[...Object.keys(charactersByName), ...Object.keys(animalsByName)].map((f) =>
        f.replace(/\.json$/, ""),
      ),
      ...listJson(join(root, "props")).map((f) => f.replace(/\.json$/, "")),
    ]);
    const unknown = usesNames.filter((n) => !known.has(n));
    if (unknown.length)
      return fail(
        `--uses: không có hành động, nhân vật, đạo cụ hay động vật nào tên ${unknown.map((n) => `\`${n}\``).join(", ")}`,
      );
  }
  for (const [kind, parse] of Object.entries(kinds)) {
    const files = listJson(join(root, kind));
    counts[kind] = files.length;
    for (const f of files) {
      owner = kind === "scenes" ? f.replace(/\.json$/, "") : null;
      let r;
      try {
        r = parse(readJson(join(root, kind, f)));
      } catch (e) {
        bad(`${kind}/${f}: không đọc được — ${e.message}`);
        continue;
      }
      if (!r.success) {
        bad(`${kind}/${f}: ${issues(r.error)}`);
        continue;
      }
      const shapeName = kind === "hands" && rig.handShapeNameProblem(f.replace(/\.json$/, ""));
      if (shapeName) bad(`hands/${f}: ${shapeName}`);
      if (kind === "characters") characters.push([f, r.data]);
      if (kind === "props") props.push([f, r.data]);
      if (kind === "scenes") scenesByName[f.replace(/\.json$/, "")] = r.data;
      if (kind === "scenes" && !inFocus(owner, r.data)) continue;
      if (kind === "scenes" && focusing) focused.add(owner);
      // Công tắc một chiều: đổi đồ mà trạng thái không đổi frame nào — không nổ, chỉ thiếu hình
      if (kind === "actions" && has("ref"))
        lap(inner, "ref", () => {
          shownAction = usesNames.includes(f.replace(/\.json$/, ""));
          for (const problem of rig.equipSwitchProblems(r.data))
            refWarn(`actions/${f}: ${problem}`);
          // Khuỷu gập ngược khi giơ tay, mốc ghi kênh ngoài `mask`: schema không biết, hình chỉ sai — docs/00
          for (const problem of rig.armFoldProblems(r.data)) refWarn(`actions/${f}: ${problem}`);
          for (const problem of rig.maskProblems(r.data)) refWarn(`actions/${f}: ${problem}`);
          for (const problem of rig.aimProblems?.(r.data) ?? [])
            refWarn(`actions/${f}: ${problem}`);
          // Cắt cứng giấu trong file, đường nối vòng `wrap` nhảy — docs/03-scene.md#giật-trên-hình
          for (const problem of rig.actionSnapProblems(r.data)) refWarn(`actions/${f}: ${problem}`);
          shownAction = false;
        });
      if (kind === "animals") animalsByName[f] = r.data;
      if (kind === "scenes") {
        if (has("ref"))
          lap(inner, "ref", () => {
            for (const c of r.data.cast) {
              if (c.character && !inLayers(charactersLayers, c.character))
                bad(`scenes/${f}: cast ${c.id} trỏ tới characters/${c.character} không có`);
              // Nhân vật của cả hai lớp đã nạp trước, nên tên vật trong `equip` kiểm được ngay
              const played = charactersByName[c.character];
              if (played)
                for (const problem of rig.equipProblems(played, c.equip))
                  bad(`scenes/${f}: cast ${c.id} ${problem}`);
              for (const t of c.tracks)
                for (const clip of t.clips)
                  if (clip.action && !inLayers(actionsLayers, `${clip.action}.json`))
                    bad(`scenes/${f}: clip dùng actions/${clip.action}.json không có`);
            }
            for (const p of r.data.props)
              if (!existsSync(join(root, "props", p.prop)))
                bad(`scenes/${f}: đạo cụ ${p.id} trỏ tới props/${p.prop} không có`);
            for (const a of r.data.animals) {
              if (!inLayers(animalsLayers, a.animal))
                bad(`scenes/${f}: động vật ${a.id} trỏ tới animals/${a.animal} không có`);

              for (const t of a.tracks)
                for (const clip of t.clips) {
                  if (!clip.action) continue;
                  if (!inLayers(actionsLayers, `${clip.action}.json`))
                    bad(`scenes/${f}: clip dùng actions/${clip.action}.json không có`);
                  else if (
                    actionsByName[clip.action] &&
                    rig.actionKind(actionsByName[clip.action]) !== "animal"
                  )
                    bad(`scenes/${f}: động vật ${a.id} diễn ${clip.action} — hành động của người`);
                }
            }
          });
        // Ai cưỡi, ai xách: mọi ràng buộc chéo còn lại (`id` có không, một con một chủ) nằm ở `resolveScene`
        let rt = null;
        try {
          rt = lap(inner, "runtime", () =>
            castRuntime(
              r.data,
              actionsByName,
              animalsByName,
              Object.fromEntries(props),
              charactersByName,
              heldByName,
              handsByName,
            ),
          );
          runtimes.set(owner, rt);
        } catch (e) {
          bad(`scenes/${f}: ${e.message}`);
        }
        // Trượt chân, thân quay gắt: cảnh không khớp `stickman.frozen` đo ở `deepScene`
        if (rt && has("move") && frozen.test(owner))
          lap(inner, "move", () => {
            for (const problem of moveProblems(rt)) warn(`scenes/${f}: ${problem}`);
          });
        for (const file of rig.sceneImages(r.data)) assets.push(join("assets/bg", file));
        if (has("ref"))
          lap(inner, "ref", () => {
            // Người 3D diễn hành động 2D ở kênh tay chân — docs/03-scene.md#hành-động-cho-người-3d
            try {
              for (const problem of rt ? rig.sceneSideProblems(rt, actionsByName) : [])
                bad(`scenes/${f}: ${problem}`);
            } catch (e) {
              bad(`scenes/${f}: ${e.message}`);
            }
            // Hai tay của món cầm hai tay khai hai món khác nhau — docs/03-scene.md#đồ-cầm-tay
            for (const problem of rt && rig.sceneHoldProblems ? rig.sceneHoldProblems(rt) : [])
              refWarn(`scenes/${f}: ${problem}`);
            // Mốc khoá khuỷu mà khoá không có tác dụng — docs/03-scene.md#đích-bàn-tay-thế-giới
            for (const s of rt && rig.elbowLockIdle ? rig.elbowLockIdle(rt) : [])
              refWarn(`scenes/${f}: ${rig.elbowLockIdleLine(s)}`);
            // Mốc món suy biến hay không tay nào cầm — docs/11-nhom-cam.md#mốc-món-items
            if (rt?.items && rig.sceneItemProblems) {
              try {
                const chars = castChars(r.data, charactersByName);
                for (const problem of [
                  ...rig.sceneItemProblems(rt, { chars }),
                  ...rig.sceneItemHoldProblems(rt),
                ])
                  bad(`scenes/${f}: ${problem}`);
              } catch (e) {
                bad(`scenes/${f}: ${e.message}`);
              }
            }
            for (const file of rig.sceneImages(r.data))
              if (!existsSync(join(root, "assets/bg", file)))
                bad(`scenes/${f}: nền trỏ tới assets/bg/${file} không có`);
            for (const problem of rig.sceneEquipProblems(r.data, actionsByName))
              refWarn(`scenes/${f}: ${problem}`);
            // Mốc có tên: tham chiếu tới mốc không có đã kêu ở `resolveScene`; mốc khai mà JSON không
            // neo chỉ báo khi bật `stickman.marks.unused`. docs/03-scene.md#mốc-có-tên
            if (unusedMarks === "warn") {
              const used = new Set(rig.markRefs(r.data).map((m) => m.name));
              for (const name of Object.keys(r.data.marks))
                if (!used.has(name))
                  refWarn(
                    `scenes/${f}: mốc \`${name}\` khai trong \`marks\` mà không chỗ nào trong JSON neo vào`,
                  );
            }
            // `fx[]` đi qua zod của @stickman3d/fx (sau khi `@mốc` thành số), và vật rời tay phải có ảnh
            // ở một trong hai lớp mảnh
            let fxRaw = null;
            try {
              fxRaw = rig.unmarkScene(r.data).fx;
            } catch {
              fxRaw = null;
            }
            const fx = fxRaw && FX.parseFx(fxRaw);
            if (fx && !fx.success)
              for (const i of fx.error.issues)
                bad(`scenes/${f}: fx.${i.path.join(".")}: ${i.message}`);
            else if (fx)
              for (const file of FX.fxFiles(fx.data))
                if (!inLayers(piecesLayers, file))
                  bad(`scenes/${f}: fx trỏ tới pieces/${file} không có`);
          });
      }
    }
  }
  owner = null;
  addTimes(times, inner);
  times.load =
    (times.load ?? 0) +
    performance.now() -
    loadStart -
    Object.values(inner).reduce((a, b) => a + b, 0);

  // Lớp vẽ code: gói thử như lúc render, rồi đối chiếu `scenes` của từng lớp với tên cảnh có
  // thật — sai tên thì lớp chỉ không vẽ, không có gì báo. docs/10-lop-ve-code.md. Chỉ `ref` (đối chiếu) và `clash`
  // (khối đồ) cần nó
  const sceneNames = new Set(Object.values(scenesByName).map((s) => s.name));
  let entry = null;
  let codeLayers = [];
  if (has("ref") || has("clash")) {
    try {
      entry = layersEntry(root);
    } catch (e) {
      bad(e.message);
    }
    if (entry) {
      const rel = relative(root, entry);
      try {
        codeLayers = await lapAsync(times, "layers", () => loadLayers(root));
      } catch (e) {
        bad(`${rel}: ${e.message}`);
      }
      if (has("ref"))
        lap(times, "ref", () => {
          for (const [i, l] of codeLayers.entries()) {
            owner = typeof l?.name === "string" ? l.name : null;
            const at = `${rel}: lớp ${typeof l?.name === "string" ? l.name : `#${i}`}`;
            if (!l || typeof l !== "object" || typeof l.name !== "string" || !l.name) {
              bad(`${at} không có \`name\``);
              continue;
            }
            const scenes =
              l.scenes instanceof Set ? [...l.scenes] : Array.isArray(l.scenes) ? l.scenes : null;
            if (!scenes) {
              bad(`${at}: \`scenes\` phải là Set hay mảng tên cảnh`);
              continue;
            }
            for (const name of scenes)
              if (!sceneNames.has(name))
                bad(
                  `${at} bật cho cảnh "${name}" không có — tên là \`scene.name\`, không phải tên file`,
                );
            if (!scenes.length) refWarn(`${at} không bật cho cảnh nào`);
            if (!["bg", "back", "front", "shake", "place"].some((h) => typeof l[h] === "function"))
              refWarn(`${at} không có chỗ móc nào (bg / back / front / shake / place)`);
          }
          owner = null;
        });
      counts.layers = codeLayers.length;
    }
  }

  // Cảnh three của repo video: người lồng vào vật, tay, đồ cầm đo trên chính nó —
  // docs/10-lop-ve-code.md#người-lồng-vào-đồ
  let world = null;
  let worldRel = null;
  if (WORLD_GROUPS.some(has))
    try {
      const we = worldEntry(root);
      if (we) {
        worldRel = relative(root, we);
        world = await lapAsync(times, "worldModule", () => loadWorld(root));
      }
    } catch (e) {
      bad(worldRel ? `${worldRel}: ${e.message}` : e.message);
    }

  // Thư mục sidebar Remotion: regex hỏng hay tên thư mục có ký tự lạ thì `Root.tsx` ném —
  // docs/03-scene.md#remotion
  const folders = readPkg(root)?.stickman?.folders;
  if (has("ref") && folders !== undefined) {
    let re = null;
    try {
      re = new RegExp(folders);
    } catch (e) {
      bad(`package.json: stickman.folders không phải regex — ${e.message}`);
    }
    const ids = [...listJson(join(root, "scenes")), ...listJson(join(root, "episodes"))].map((f) =>
      f.replace(/\.json$/, ""),
    );
    for (const id of re ? ids : []) {
      const name = re.exec(id)?.[0];
      if (name !== undefined && !/^[a-zA-Z0-9一-鿿-]+$/.test(name))
        bad(
          `package.json: stickman.folders cắt "${id}" ra thư mục "${name}" — chỉ nhận a-z A-Z 0-9 - và chữ Hán`,
        );
    }
  }

  // Phạm vi bundle mặc định của Studio: khoá không khớp gì là Studio mở ra trống — docs/03-scene.md#phạm-vi-bundle
  const scopeRaw = readPkg(root)?.stickman?.scope;
  if (has("ref") && scopeRaw !== undefined) {
    if (typeof scopeRaw !== "string")
      bad(
        `package.json: stickman.scope phải là chuỗi khoá phẩy ngăn, đang là ${JSON.stringify(scopeRaw)}`,
      );
    else
      try {
        for (const t of bundleScope(root, parseTokens(scopeRaw)).unknown)
          warn(`package.json: stickman.scope có khoá "${t}" không khớp cảnh, tập hay thư mục nào`);
      } catch (e) {
        bad(`package.json: stickman.scope — ${e.message}`);
      }
  }

  const haveFfprobe = has("episode") && onPath("ffprobe");
  /** Runtime của một file trong `scenes/`; `null` là chưa dựng nổi — lỗi đã kêu ở trên */
  const sceneRuntime = (name) => {
    if (runtimes.has(name)) return runtimes.get(name);
    const data = scenesByName[name];
    let rt = null;
    try {
      if (data)
        rt = lap(times, "runtime", () =>
          castRuntime(
            data,
            actionsByName,
            animalsByName,
            Object.fromEntries(props),
            charactersByName,
            heldByName,
            handsByName,
          ),
        );
    } catch {
      rt = null;
    }
    runtimes.set(name, rt);
    return rt;
  };
  // Người 3D lồng vào đồ khối (rig không đẩy người ra, chặt mảnh đồ qua người rồi vẽ đè lên), tay
  // xuyên thân mình và đồ lồng vào đồ — chỉ nhìn hình mới thấy. Cảnh khớp `stickman.frozen` thì
  // không đo. docs/10-lop-ve-code.md#người-lồng-vào-đồ, docs/10-lop-ve-code.md#tay-xuyên-thân,
  // docs/10-lop-ve-code.md#đồ-lồng-vào-đồ
  const tol = clashTol(root);
  const ratio = itemRatio(root);
  const self = selfTol(root);
  const palm = palmOptions(root);
  if (has("hands") && palm.error) bad(palm.error);
  const arm = armOptions(root);
  if (has("hands") && arm.error) bad(arm.error);
  let clash = null;
  if (typeof tol !== "number" || !(tol >= 0)) {
    if (has("clash"))
      bad(`package.json: stickman.clash.tol phải là số không âm, đang là ${JSON.stringify(tol)}`);
  } else if (self !== false && (typeof self !== "number" || !(self >= 0))) {
    if (has("clash"))
      bad(
        `package.json: stickman.clash.self phải là số không âm hay false, đang là ${JSON.stringify(self)}`,
      );
  } else if (ratio !== false && (typeof ratio !== "number" || !(ratio >= 0 && ratio < 1))) {
    if (has("clash"))
      bad(
        `package.json: stickman.clash.items phải là số trong [0, 1) hay false, đang là ${JSON.stringify(ratio)}`,
      );
  } else clash = { tol, ratio, self };
  // Tay chân giật trên hình, đo đúng như hình vẽ ra — docs/03-scene.md#giật-trên-hình
  const snap = snapOptions(root);
  if (has("move") && snap.error) bad(snap.error);
  // Đồ cầm tay đo trên cảnh three — docs/03-scene.md#đồ-cầm-tay
  const held = heldOptions(root);
  if (has("held") && held.error) bad(held.error);
  if (nameList(only).includes("held") && held.off)
    bad("nhóm `held`: rig đang cài chưa có luật đồ cầm, hay stickman.held là false");
  const deep = ["move", "hands", "held", "legacy", "clash"].some(has)
    ? Object.keys(scenesByName).filter(
        (name) => !frozen.test(name) && (!focusing || focused.has(name)),
      )
    : [];
  const wanted = new Set(deep);
  const spans =
    snap.error || snap.off || !has("move")
      ? {}
      : lap(times, "move", () =>
          Object.fromEntries(shotSpans(root, scenesByName, sceneRuntime, (n) => wanted.has(n))),
        );
  const opts = { clash, arm, palm, snap, spans, held, groups };
  const results = deep.length
    ? await deepScenes(
        root,
        deep,
        {
          ...opts,
          scenesByName,
          sceneRuntime,
          charactersByName,
          actionsByName,
          animalsByName,
          props: Object.fromEntries(props),
          codeLayers,
          world,
          worldRel,
        },
        jobs,
        times,
      )
    : new Map();
  // Mục `touch` lạ chỉ báo ở cảnh đầu tiên gặp nó
  const touchSeen = new Set();
  for (const part of ["move", "clash", "snap"])
    for (const name of deep) {
      owner = name;
      for (const { msg, touch, error, group, key, measure } of results.get(name)[part]) {
        if (touch !== undefined) {
          if (touchSeen.has(touch)) continue;
          touchSeen.add(touch);
        }
        (error ? bad : warn)(msg, { group, key, measure });
      }
    }
  for (const name of deep) addTimes(times, results.get(name).time);
  owner = null;

  /** Kết quả cuối: lọc theo baseline, ghi baseline, gắn thời gian */
  const finish = (out) => {
    const sceneSet = new Set(focusing ? focused : Object.keys(scenesByName));
    const inScope = (e) =>
      groups.includes(e.group) && (e.scene ? sceneSet.has(e.scene) : !focusing);
    const rows = problems
      .filter((p) => meta.has(p))
      .map((p) => ({ ...meta.get(p), group: p.group, msg: p.msg, p }));
    const base = {};
    if (baseline) {
      const file = resolve(root, baseline);
      let entries;
      try {
        entries = readBaseline(file);
      } catch (e) {
        problems.push({ level: "lỗi", msg: `${baseline}: không đọc được baseline — ${e.message}` });
        entries = undefined;
      }
      if (entries !== undefined) {
        const cmp = compareBaseline(rows, entries ?? [], inScope);
        const now = new Map(baselineEntries(rows).map((e) => [e.key, e]));
        const tag = new Map();
        for (const r of rows) {
          if (cmp.fresh.has(r.key)) tag.set(r.p, { delta: "mới" });
          else if (cmp.worse.has(r.key)) {
            const [o, n] = [cmp.worse.get(r.key), now.get(r.key)];
            tag.set(r.p, {
              delta: "nặng hơn",
              was: { count: o.count ?? 1, measure: o.measure },
              now: { count: n.count, measure: n.measure },
            });
          }
        }
        const kept = problems.filter((p) => p.level === "lỗi" || tag.has(p));
        problems.length = 0;
        for (const p of kept) problems.push(Object.assign(p, tag.get(p)));
        Object.assign(base, {
          baseline: {
            file: baseline,
            missing: entries === null,
            fresh: kept.filter((p) => p.delta === "mới").length,
            worse: kept.filter((p) => p.delta === "nặng hơn").length,
            gone: cmp.gone.map((e) => ({ scene: e.scene, group: e.group, msg: e.msg })),
          },
        });
      }
    }
    if (saveBaseline) {
      const file = resolve(root, saveBaseline);
      let entries = [];
      try {
        entries = readBaseline(file) ?? [];
      } catch {
        entries = [];
      }
      const merged = mergeBaseline(entries, rows, inScope);
      writeFileSync(
        file,
        `${JSON.stringify({ stickman: "check-baseline", rig: installed ?? null, warnings: merged }, null, 2)}\n`,
      );
      base.saved = { file: saveBaseline, warnings: merged.length };
    }
    return {
      ...out,
      groups,
      ...base,
      time: Object.fromEntries(
        Object.keys(CHECK_TIMES)
          .filter((k) => times[k] !== undefined)
          .map((k) => [k, Math.round(times[k])]),
      ),
      wall: Math.round(performance.now() - t0),
    };
  };

  if (focusing) {
    if (!focused.size)
      bad(
        focus && usesNames.length
          ? `không cảnh nào vừa khớp scene \`${focus.source}\` vừa dùng ${usesNames.join(", ")}`
          : focus
            ? `scene \`${focus.source}\` không khớp cảnh nào trong scenes/`
            : `--uses: không cảnh nào dùng ${usesNames.join(", ")}`,
      );
    return finish({
      dir: root,
      counts,
      stamped: stamp?.versions?.rig ?? null,
      rig: installed,
      problems,
      frozen: muted,
      scenes: [...focused],
    });
  }

  counts.episodes = listJson(join(root, "episodes")).length;
  let missing = [];
  if (has("episode"))
    lap(times, "episode", () => {
      /** Độ dài (giây cảnh) của một file trong `scenes/`; `null` là chưa dựng nổi runtime */
      const sceneSeconds = (name) => sceneRuntime(name)?.duration ?? null;
      const stills = new Map();
      /** Quãng cả sân khấu đứng yên của một cảnh; lấy mẫu một lần rồi mọi cue dùng lại */
      const sceneStills = (name) => {
        if (!stills.has(name)) {
          const rt = sceneRuntime(name);
          stills.set(name, rt ? rig.stillSpans(rt, CUE_STILL) : []);
        }
        return stills.get(name);
      };
      /**
       * Quãng giây cảnh mà một bè lặp còn kêu trong khi không ai trên sân khấu nhúc nhích.
       * Cue thường thì không hỏi: một câu thoại nói trên nền người đứng yên là chuyện thường,
       * còn bè là tiếng của chuyển động — người dừng rồi mà nó vẫn chạy là nghe ra ngay.
       */
      const stillUnder = (shot, c, at0) => {
        if (!c.loop || !c.dur || !shot?.scene) return [];
        const rt = sceneRuntime(shot.scene);
        if (!rt) return [];
        const table = rig.warpTable(shot.slow ?? []);
        const base = shot.from ?? 0;
        const from = base + rig.sceneTime(at0, table);
        const to = Math.min(
          base + rig.sceneTime(at0 + c.dur, table),
          shot.to ?? rt.duration,
          rt.duration,
        );
        return sceneStills(shot.scene)
          .map((s) => [Math.max(s.from, from), Math.min(s.to, to)])
          .filter(([a, b]) => b - a >= CUE_STILL);
      };
      const epWarn = warnIn("episode");

      // Bảng tiếng động của repo đọc bằng tool Python, không ai khác mở nó trước lượt gen
      for (const f of listJson(join(root, "sfx"))) {
        try {
          readJson(join(root, "sfx", f));
        } catch (e) {
          bad(`sfx/${f}: không đọc được — ${e.message}`);
        }
      }

      // `episodes/` không đi qua zod ở đây (schema nằm trong scaffold, là TS), nhưng tham
      // chiếu chéo thì kiểm được — và đó mới là loại lỗi câm: trỏ vào file không có, không nổ.
      for (const f of listJson(join(root, "episodes"))) {
        owner = f.replace(/\.json$/, "");
        let ep;
        try {
          ep = readJson(join(root, "episodes", f));
        } catch (e) {
          bad(`episodes/${f}: không đọc được — ${e.message}`);
          continue;
        }
        const cues = [];
        let total = 0;
        for (const shot of ep.shots ?? []) {
          const at = `episodes/${f}: shot ${shot.id ?? "?"}`;
          if (shot.scene && !existsSync(join(root, "scenes", `${shot.scene}.json`)))
            bad(`${at} trỏ tới scenes/${shot.scene}.json không có`);
          if (!shot.scene && shot.duration === undefined)
            bad(`${at} không có \`scene\` thì phải có \`duration\``);
          const secs = shotSeconds(shot, sceneSeconds);
          total = secs == null ? null : total == null ? null : total + secs;
          // `at` viết `"@mốc"` tra cảnh của shot; lỗi tra là lỗi của cue, không chặn các cue khác
          const marks = shot.scene ? scenesByName[shot.scene]?.marks : null;
          for (const c of shot.audio ?? []) {
            let at0 = 0;
            try {
              at0 = cueAt(c, shot, marks ?? null);
            } catch (e) {
              bad(`${at}: ${e.message}`);
              continue;
            }
            cues.push([at, c, secs, shot, at0]);
          }
        }
        for (const c of ep.audio ?? []) {
          if (typeof c.at === "string") {
            bad(`episodes/${f}: cue ${c.file} ở tầng tập không có cảnh nào để tra \`${c.at}\``);
            continue;
          }
          cues.push([`episodes/${f}`, c, total, null, c.at ?? 0]);
        }
        // Một tập là một composition nên chỉ có một khung; trộn `wide` với `tall` thì Remotion nổ
        const frames = new Set(
          (ep.shots ?? []).flatMap((shot) =>
            shot.scene && scenesByName[shot.scene] ? [scenesByName[shot.scene].frame] : [],
          ),
        );
        if (frames.size > 1)
          bad(`episodes/${f}: các shot trộn khung ${[...frames].join(" và ")} — một tập một khung`);
        // Biến thể trộn lên phần chung như `episodeThumbnails` của scaffold
        const { variants, ...thBase } = ep.thumbnail ?? {};
        const thumbs = !ep.thumbnail
          ? []
          : variants
            ? Object.entries(variants).map(([k, t]) => [
                `thumbnail.variants.${k}`,
                { ...thBase, ...t, font: { ...thBase.font, ...t?.font } },
              ])
            : [["thumbnail", thBase]];
        for (const [at, th] of thumbs) {
          if (!th.scene) bad(`episodes/${f}: ${at} thiếu \`scene\``);
          else if (!existsSync(join(root, "scenes", `${th.scene}.json`)))
            bad(`episodes/${f}: ${at} trỏ tới scenes/${th.scene}.json không có`);
          if (th.font?.file && !existsSync(join(root, "public/fonts", th.font.file)))
            bad(`episodes/${f}: ${at} trỏ tới public/fonts/${th.font.file} không có`);
        }
        for (const [at, c, limit, shot, at0] of cues) {
          if (!c?.file) continue;
          const p = join(root, "assets/audio", c.file);
          assets.push(join("assets/audio", c.file));
          if (!existsSync(p)) {
            bad(`${at}: cue trỏ tới assets/audio/${c.file} không có`);
            continue;
          }
          // Bè lặp không có `dur` là lặp tới vô tận; `Episode.tsx` ném ngay lúc dựng cây
          if (c.loop && !c.dur) bad(`${at}: cue ${c.file} có \`loop\` thì phải có \`dur\``);
          // Tiếng dài hơn chỗ nó nằm thì bị cắt ngang, và không có gì báo — chỉ mất nửa câu thoại.
          // Cue khai `dur` là cắt CÓ CHỦ Ý (bè nền lặp, tiếng cắt sớm ở mép shot): đo theo `dur`,
          // không theo file, kẻo bè 24 s trong shot 2,5 s bị báo tràn dù đã khai vừa khít.
          const secs = c.dur ?? (haveFfprobe ? audioSeconds(p) : null);
          if (secs == null || limit == null) continue;
          const over = at0 + secs - limit;
          if (over > CUE_SLACK)
            epWarn(
              `${at}: ${c.file} dài ${secs.toFixed(2)}s từ giây ${at0.toFixed(2)}, quá chỗ ${limit.toFixed(2)}s — cụt ${over.toFixed(2)}s`,
            );
          for (const [from, to] of stillUnder(shot, c, at0)) {
            epWarn(
              `${at}: bè ${c.file} còn kêu trong khi cả sân khấu đứng yên, giây cảnh ${from.toFixed(2)}→${to.toFixed(2)} — cắt \`dur\` hay dời \`at\``,
            );
          }
        }
      }

      owner = null;

      // Số ghi trong JSON so với luật `after` / `shot.marks` đo lại từ tiếng: cũ là phải `retime`
      const plan = planRetime({ dir: root });
      for (const p of plan.problems) bad(p);
      for (const ch of plan.changes)
        epWarn(
          `${ch.file}: ${ch.path} đang ${ch.from ?? "trống"} mà tiếng đo ra ${ch.to} (${ch.why}) — chạy \`stickman retime\``,
        );
    });

  if (has("ref"))
    lap(times, "ref", () => {
      for (const [f, c] of characters)
        for (const [name, e] of Object.entries(c.outfits))
          for (const problem of rig.equipProblems(c, e))
            bad(`characters/${f}: bộ đồ ${name} ${problem}`);

      // Chép y nguyên từ bộ chung (workspace dựng trước khi có hai lớp) thì thừa; khác nội dung là cố ý đè
      for (const [kind, files, local, common] of [
        ["actions", listJson(join(root, "actions")), join(root, "actions"), COMMON.actions],
        ["animals", listJson(join(root, "animals")), join(root, "animals"), COMMON.animals],
        [
          "characters",
          listJson(join(root, "characters")),
          join(root, "characters"),
          COMMON.characters,
        ],
      ]) {
        const same = files.filter(
          (f) =>
            existsSync(join(common, f)) &&
            hash(readFileSync(join(local, f))) === hash(readFileSync(join(common, f))),
        );
        if (same.length)
          refWarn(
            `${kind}/: ${same.length} file giống hệt bộ chung của studio, xoá được — ${same.join(", ")}`,
          );
      }
    });
  counts.common =
    listJson(COMMON.actions).length +
    listJson(COMMON.animals).length +
    listJson(COMMON.characters).length;

  if (has("episode"))
    lap(times, "episode", () => {
      // File có trên đĩa mà chưa commit thì máy khác clone về là thiếu, và không gì báo:
      // mọi `existsSync` ở trên vẫn xanh vì chúng soi đúng cái đĩa đang có. docs/05-repo-video.md
      const tracked = gitTracked(root);
      if (tracked) {
        const untracked = gitUntracked(root);
        const owned = [
          ...[...Object.keys(kinds), "episodes"].flatMap((k) =>
            listJson(join(root, k)).map((f) => join(k, f)),
          ),
          ...assets,
        ];
        // File `.gitignore` loại là cố ý để ngoài git (vd. audio gen ra), không kêu
        const kept = [...new Set(owned)].filter(
          (rel) => existsSync(join(root, rel)) && (tracked.has(rel) || untracked.has(rel)),
        );
        const loose = kept.filter((rel) => untracked.has(rel));
        if (loose.length && loose.length === kept.length)
          warn("chưa commit file nội dung nào — `git add` trước khi ai đó clone về", {
            group: "episode",
          });
        else if (loose.length)
          warn(
            `chưa commit ${loose.length} file: ${loose.slice(0, 8).join(", ")}${loose.length > 8 ? ", …" : ""}`,
            { group: "episode", key: "git|chưa commit", measure: loose.length },
          );
      }

      // Không cái nào là dependency npm nên không có gì báo lúc cài; chúng chỉ nổ giữa lượt render
      missing = TOOLS.filter(([cmd]) => !onPath(cmd));
      for (const [cmd, what] of missing)
        warn(`không có \`${cmd}\` trên PATH — cần cho ${what}`, { group: "episode" });
    });

  return finish({
    dir: root,
    counts,
    stamped: stamp?.versions?.rig ?? null,
    rig: installed,
    ...(has("episode")
      ? {
          tools: Object.fromEntries(TOOLS.map(([cmd]) => [cmd, !missing.some(([m]) => m === cmd)])),
        }
      : {}),
    problems,
    frozen: muted,
  });
}
