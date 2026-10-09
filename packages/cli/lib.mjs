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
import { basename, delimiter, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as rig from "@stickman3d/sketch";
import * as FX from "@stickman3d/fx";
import { layersEntry, loadLayers, loadParts, partsEntry } from "@stickman3d/render";
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
const CONTEXT_DIRS = ["characters", "actions", "animals", "pieces"];
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
// IHDR: rộng ở byte 16, cao ở 20, kiểu màu ở 25 — bit 4 của kiểu màu là có alpha
const pngAlpha = (buf) => (buf[25] & 4) !== 0;

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

const listPngs = (d, sub = "") => {
  const at = join(d, sub);
  if (!existsSync(at)) return [];
  return readdirSync(at, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? listPngs(d, join(sub, e.name))
      : /\.png$/i.test(e.name)
        ? [join(sub, e.name)]
        : [],
  );
};

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
  const props = loadByFile([join(root, "props")], rig.parseProp);
  const frozen = frozenOf(root);
  if (frozen.error) plan.problems.push(frozen.error);
  // Cảnh đã vá phải nạp lại được trước khi ghi: lỗi thì `undefined` là qua, chuỗi là lý do
  Object.defineProperty(plan, "verify", {
    value: (text) => {
      try {
        const r = rig.parseScene(JSON.parse(text));
        if (!r.success) return issues(r.error);
        rig.resolveScene(r.data, actionsNow, animals, props, ...castBodies(r.data, characters));
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
        rig.resolveScene(r.data, actionsThen, animals, props, ...bodies),
        actionsNow,
        from,
        file,
      ));
      // Đời trước dựng trên cảnh đã giãn nhịp: hoà giữa đi và ngồi rơi đúng pha như bây giờ
      then = rig.resolveScene(scene, actionsThen, animals, props, ...bodies);
      now = rig.resolveScene(scene, actionsNow, animals, props, ...bodies);
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

/** Báo mốc khai mà JSON không neo: `stickman.marks.unused` trong `package.json`, `"off"` (mặc định) hay
 *  `"warn"` — lớp vẽ code đọc mốc qua `ctx.marks`, `check` không thấy. docs/03-scene.md#mốc-có-tên */
export const marksUnused = (dir = ".") => readPkg(resolve(dir))?.stickman?.marks?.unused ?? "off";

/** Vế kia của một chỗ lấn: `tên món (mảnh k)` hay `người.phần` */
const clashWith = (c) =>
  c.other ? `${c.other.id}.${c.other.part}` : `${c.name ?? `món #${c.item}`} (mảnh ${c.piece})`;

/**
 * Chỗ người 3D lồng vào đồ ở giây `t`, sâu trước: `{ who, with, depth }`. `scene_probe` trả nó cho
 * cảnh có `lens`. docs/10-lop-ve-code.md#người-lồng-vào-đồ
 */
/** `sceneZProblems` kể cả nấc `z` của lớp vẽ code bật ở cảnh — `check` và `validate` của MCP dùng chung */
export const sceneZWarnings = (data, codeLayers = []) =>
  rig.sceneZProblems(data, FX.layerZs(codeLayers, data.name));

export const clashesAt = (rt, t, { characterOf, codeLayers, tol = CLASH_TOL }) =>
  FX.sceneClashes(rt, t, { characterOf, codeLayers, tol }).map((c) => ({
    who: `${c.id}.${c.part}`,
    with: clashWith(c),
    depth: +c.depth.toFixed(1),
  }));

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
 * `at(t, i)` trả các chỗ của giây thứ `i`, mỗi chỗ `{ key, depth, … }`
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
      return `${line(c)} ở giây ${at.toFixed(2)} · giây ${shown}${more}`;
    });
}

/**
 * Người 3D lồng vào đồ khối hay vào người khác, mỗi cặp một dòng: chỗ lấn sâu nhất và các quãng
 * giây liền nhau. docs/10-lop-ve-code.md#người-lồng-vào-đồ
 */
export function sceneClashProblems(
  rt,
  { characterOf, codeLayers, tol = CLASH_TOL, every = CLASH_EVERY, samples },
) {
  const { times, built } = samples ?? sceneSamples(rt, { characterOf, every });
  // `sceneClashes` sắp sâu trước: mỗi cặp (phần người, món) lấy mảnh lấn sâu nhất của khung. Món
  // gộp theo `name`: lớp ẩn bớt món thì chỉ số trong mảng `solids` dời giữa chừng
  const at = (t) =>
    FX.sceneClashes(rt, t, { characterOf, codeLayers, tol, people: built.get(t) }).map((c) => ({
      ...c,
      key: c.other
        ? `${c.id}.${c.part}|${c.other.id}.${c.other.part}`
        : `${c.id}.${c.part}|${c.name ?? `#${c.item}`}`,
    }));
  return tally(
    times,
    at,
    (c) => `người lồng vào đồ — ${c.id}.${c.part} ↔ ${clashWith(c)} lấn ${c.depth.toFixed(1)}`,
  );
}

/**
 * Đồ khối và người 3D xếp vẽ ngược độ sâu (mảnh đồ ở sau mà đè lên người, hay người đè lên mảnh đồ
 * đứng trước), mỗi cặp một dòng. docs/10-lop-ve-code.md#vẽ-sai-thứ-tự
 */
export function sceneOverdrawProblems(
  rt,
  { characterOf, codeLayers, tol = CLASH_TOL, every = CLASH_EVERY, samples },
) {
  const { times } = samples ?? sceneSamples(rt, { characterOf, every });
  const at = (t) =>
    FX.sceneOverdraws(rt, t, { characterOf, codeLayers, tol }).map((o) => ({
      ...o,
      key: `${o.id}.${o.part}|${o.name ?? `#${o.item}`}|${o.over}`,
    }));
  return tally(times, at, (o) => {
    const [who, item] = [`${o.id}.${o.part}`, `${o.name ?? `món #${o.item}`} (mảnh ${o.piece})`];
    const [top, under] = o.over ? [item, who] : [who, item];
    return `vẽ sai thứ tự — ${top} đè lên ${under} dù nằm sau ${o.depth.toFixed(1)}`;
  });
}

/**
 * Soi một workspace: version đã đóng dấu so với rig đang cài, JSON hỏng, mảnh thiếu file,
 * PNG không có alpha, mảnh không có trong danh mục.
 *
 * `scene` (regex trên id cảnh) chỉ soi sâu cảnh khớp: cảnh báo của chúng và lỗi ở bất kỳ đâu;
 * tập, tiếng, mảnh, git và công cụ ngoài bỏ qua — docs/05-repo-video.md#soi-một-cảnh
 */
export async function checkWorkspace({ dir = ".", scene } = {}) {
  const root = resolve(dir);
  const problems = [];
  let focus = null;
  if (scene !== undefined && scene !== null && scene !== "") {
    try {
      focus = scene instanceof RegExp ? scene : new RegExp(scene);
    } catch (e) {
      const msg = `scene \`${scene}\` không phải regex — ${e.message}`;
      return { dir: root, counts: {}, problems: [{ level: "lỗi", msg }], frozen: 0, scenes: [] };
    }
  }
  const inFocus = (name) => !focus || focus.test(name);
  // Cảnh, tập hay lớp đang soi: khớp `stickman.frozen` thì nó vẫn được nạp cho tham chiếu chéo,
  // chỉ thôi kêu
  const frozen = frozenOf(root);
  let owner = null;
  let muted = 0;
  const focused = new Set();
  const push = (level, msg) => {
    if (focus && level !== "lỗi" && !(owner !== null && focused.has(owner))) return;
    if (owner !== null && frozen.test(owner)) muted++;
    else problems.push({ level, msg });
  };
  const bad = (msg) => push("lỗi", msg);
  const warn = (msg) => push("cảnh báo", msg);
  if (frozen.error) bad(frozen.error);
  const unusedMarks = marksUnused(root);
  if (unusedMarks !== "off" && unusedMarks !== "warn")
    bad(
      `package.json: stickman.marks.unused phải là "off" hay "warn", đang là ${JSON.stringify(unusedMarks)}`,
    );

  const stamp = readStickman(root);
  const installed =
    pkgVersionOnDisk("@stickman3d/rig", root) ?? pkgVersion("@stickman3d/rig", root);
  if (!stamp) warn("không có stickman.json — workspace này chưa qua `stickman init`");
  else if (installed && stamp.versions?.rig !== installed)
    warn(
      `stickman.json ghi @stickman3d/rig@${stamp.versions?.rig} nhưng đang cài ${installed} — chạy \`stickman upgrade\``,
    );
  if (stamp && !sameLegs(legsOf(stamp), legsNow()))
    warn(
      `cảnh dựng cho chân ${legsLabel(legsOf(stamp))}, rig đang cài ${legsLabel(legsNow())} — người ngồi 2D nhô khỏi ghế: chạy \`stickman reseat\``,
    );
  if (stamp && !stamp.files)
    warn("stickman.json chưa có bảng băm — `stickman upgrade` sẽ hỏi lại từng file một lượt đầu");

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

  const scenesByName = {};
  /** Cảnh chờ `sceneZProblems`: [file, owner, data] */
  const zScenes = [];
  const assets = [];
  const inLayers = (dirs, file) => dirs.some((d) => existsSync(join(d, file)));
  // `animals` trước `scenes`: trôi ngang của con vật nướng từ chính JSON của nó
  const kinds = {
    characters: rig.parseCharacter,
    actions: rig.parseAction,
    props: rig.parseProp,
    animals: rig.parseAnimal,
    scenes: rig.parseScene,
  };
  const characters = [];
  const props = [];
  const animalsByName = loadAnimals(animalsLayers);
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
      if (kind === "characters") characters.push([f, r.data]);
      if (kind === "props") props.push([f, r.data]);
      if (kind === "scenes") scenesByName[f.replace(/\.json$/, "")] = r.data;
      if (kind === "scenes" && !inFocus(owner)) continue;
      if (kind === "scenes" && focus) focused.add(owner);
      // Công tắc một chiều: đổi đồ mà trạng thái không đổi frame nào — không nổ, chỉ thiếu hình
      if (kind === "actions") {
        for (const problem of rig.equipSwitchProblems(r.data)) warn(`actions/${f}: ${problem}`);
        // Khuỷu gập ngược khi giơ tay, mốc ghi kênh ngoài `mask`: schema không biết, hình chỉ sai — docs/00
        for (const problem of rig.armFoldProblems(r.data)) warn(`actions/${f}: ${problem}`);
        for (const problem of rig.maskProblems(r.data)) warn(`actions/${f}: ${problem}`);
      }
      // Chân duỗi gần hết khi đứng: hình đứng vẫn đúng, chỉ sải chân bị cắt cụt — docs/08
      if (kind === "animals") {
        animalsByName[f] = r.data;
        for (const problem of rig.animalProblems(r.data)) warn(`animals/${f}: ${problem}`);
      }
      if (kind === "scenes") {
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
        // Ai cưỡi, ai xách: mọi ràng buộc chéo còn lại (`id` có không, một con một chủ) nằm ở `resolveScene`
        try {
          const rt = rig.resolveScene(
            r.data,
            actionsByName,
            animalsByName,
            Object.fromEntries(props),
            ...castBodies(r.data, charactersByName),
          );
          // Chân trụ trượt trên `path`: hợp lệ, chỉ nhìn là thấy — docs/03-scene.md#đường-đi-soạn-tay
          for (const problem of rig.sceneSlideProblems(rt)) warn(`scenes/${f}: ${problem}`);
          // Khoá góc chính diện đẩy thân người 3D: hướng khai không được giữ — docs/03-scene.md#người-3d
          for (const problem of rig.sceneFacingProblems(rt)) warn(`scenes/${f}: ${problem}`);
        } catch (e) {
          bad(`scenes/${f}: ${e.message}`);
        }
        for (const problem of rig.sceneFlipProblems(r.data)) warn(`scenes/${f}: ${problem}`);
        for (const file of rig.sceneImages(r.data)) {
          assets.push(join("assets/bg", file));
          if (!existsSync(join(root, "assets/bg", file)))
            bad(`scenes/${f}: nền trỏ tới assets/bg/${file} không có`);
        }
        for (const problem of rig.sceneEquipProblems(r.data, actionsByName))
          warn(`scenes/${f}: ${problem}`);
        // `z` khai ở chỗ trục không với tới: kiểm sau khi nạp lớp vẽ code, vì lớp code cũng kẹp được người
        zScenes.push([f, owner, r.data]);
        // Mốc có tên: tham chiếu tới mốc không có đã kêu ở `resolveScene`; mốc khai mà JSON không
        // neo chỉ báo khi bật `stickman.marks.unused`. docs/03-scene.md#mốc-có-tên
        if (unusedMarks === "warn") {
          const used = new Set(rig.markRefs(r.data).map((m) => m.name));
          for (const name of Object.keys(r.data.marks))
            if (!used.has(name))
              warn(
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
          for (const i of fx.error.issues) bad(`scenes/${f}: fx.${i.path.join(".")}: ${i.message}`);
        else if (fx)
          for (const file of FX.fxFiles(fx.data))
            if (!inLayers(piecesLayers, file))
              bad(`scenes/${f}: fx trỏ tới pieces/${file} không có`);
      }
    }
  }
  owner = null;

  // Lớp vẽ code: gói thử như lúc render, rồi đối chiếu `scenes` của từng lớp với tên cảnh có
  // thật — sai tên thì lớp chỉ không vẽ, không có gì báo. docs/10-lop-ve-code.md
  const sceneNames = new Set(Object.values(scenesByName).map((s) => s.name));
  let entry = null;
  try {
    entry = layersEntry(root);
  } catch (e) {
    bad(e.message);
  }
  let codeLayers = [];
  if (entry) {
    const rel = relative(root, entry);
    try {
      codeLayers = await loadLayers(root);
    } catch (e) {
      bad(`${rel}: ${e.message}`);
    }
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
          bad(`${at} bật cho cảnh "${name}" không có — tên là \`scene.name\`, không phải tên file`);
      if (!scenes.length) warn(`${at} không bật cho cảnh nào`);
      if (!["bg", "back", "front", "shake", "place"].some((h) => typeof l[h] === "function"))
        warn(`${at} không có chỗ móc nào (bg / back / front / shake / place)`);
    }
    owner = null;
    counts.layers = codeLayers.length;
  }

  // `z` khai ở chỗ trục không với tới: im lặng bị bỏ qua — docs/03-scene.md#trục-z. Lớp code
  // (chăn ở `z: { front: 10 }`) là thứ kẹp giữa hai lượt `zParts` mà JSON không thấy
  for (const [f, o, data] of zScenes) {
    owner = o;
    for (const problem of sceneZWarnings(data, codeLayers)) warn(`scenes/${f}: ${problem}`);
  }
  owner = null;

  // Thư mục sidebar Remotion: regex hỏng hay tên thư mục có ký tự lạ thì `Root.tsx` ném —
  // docs/03-scene.md#remotion
  const folders = readPkg(root)?.stickman?.folders;
  if (folders !== undefined) {
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
      if (name !== undefined && !/^[a-zA-Z0-9\u4E00-\u9FFF-]+$/.test(name))
        bad(
          `package.json: stickman.folders cắt "${id}" ra thư mục "${name}" — chỉ nhận a-z A-Z 0-9 - và chữ Hán`,
        );
    }
  }

  const haveFfprobe = onPath("ffprobe");
  const runtimes = new Map();
  /** Runtime của một file trong `scenes/`; `null` là chưa dựng nổi — lỗi đã kêu ở trên */
  const sceneRuntime = (name) => {
    if (runtimes.has(name)) return runtimes.get(name);
    const data = scenesByName[name];
    let rt = null;
    try {
      if (data)
        rt = rig.resolveScene(
          data,
          actionsByName,
          animalsByName,
          Object.fromEntries(props),
          ...castBodies(data, charactersByName),
        );
    } catch {
      rt = null;
    }
    runtimes.set(name, rt);
    return rt;
  };
  // Người 3D lồng vào đồ khối (rig không đẩy người ra, chặt mảnh đồ qua người rồi vẽ đè lên) và đồ
  // với người xếp vẽ ngược độ sâu — chỉ nhìn hình mới thấy. Cảnh khớp `stickman.frozen` thì không đo.
  // docs/10-lop-ve-code.md#người-lồng-vào-đồ, docs/10-lop-ve-code.md#vẽ-sai-thứ-tự
  const tol = clashTol(root);
  if (typeof tol !== "number" || !(tol >= 0))
    bad(`package.json: stickman.clash.tol phải là số không âm, đang là ${JSON.stringify(tol)}`);
  else
    for (const [name, data] of Object.entries(scenesByName)) {
      if (!data.lens || !data.cast.some((m) => m.world) || frozen.test(name) || !inFocus(name))
        continue;
      const rt = sceneRuntime(name);
      if (!rt) continue;
      owner = name;
      const characterOf = (m) => {
        const character = m.character ? charactersByName[m.character] : rig.defaultCharacter();
        return character && { character };
      };
      try {
        const samples = sceneSamples(rt, { characterOf });
        for (const problem of [
          ...sceneClashProblems(rt, { characterOf, codeLayers, tol, samples }),
          ...sceneOverdrawProblems(rt, { characterOf, codeLayers, tol, samples }),
        ])
          warn(`scenes/${name}.json: ${problem}`);
      } catch (e) {
        warn(`scenes/${name}.json: không đo được người 3D với đồ khối — ${e.message}`);
      }
    }
  owner = null;

  if (focus) {
    if (!focused.size) bad(`scene \`${focus.source}\` không khớp cảnh nào trong scenes/`);
    return {
      dir: root,
      counts,
      stamped: stamp?.versions?.rig ?? null,
      rig: installed,
      problems,
      frozen: muted,
      scenes: [...focused],
    };
  }

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
  counts.episodes = 0;
  for (const f of listJson(join(root, "episodes"))) {
    counts.episodes++;
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
        warn(
          `${at}: ${c.file} dài ${secs.toFixed(2)}s từ giây ${at0.toFixed(2)}, quá chỗ ${limit.toFixed(2)}s — cụt ${over.toFixed(2)}s`,
        );
      for (const [from, to] of stillUnder(shot, c, at0)) {
        warn(
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
    warn(
      `${ch.file}: ${ch.path} đang ${ch.from ?? "trống"} mà tiếng đo ra ${ch.to} (${ch.why}) — chạy \`stickman retime\``,
    );

  for (const [f, c] of characters) {
    for (const file of rig.characterFiles(c))
      if (!inLayers(piecesLayers, file)) bad(`characters/${f}: trỏ tới pieces/${file} không có`);
    // Tên lạ thì `<Character>` bỏ trống socket, không có gì báo
    for (const part of new Set(rig.characterSockets(c).map(rig.piecePart)))
      if (part && !rig.PARTS[part]) bad(`characters/${f}: trỏ tới bộ phận "${part}" không có`);
    for (const [name, e] of Object.entries(c.outfits))
      for (const problem of rig.equipProblems(c, e))
        bad(`characters/${f}: bộ đồ ${name} ${problem}`);
  }
  for (const [f, p] of props) {
    const file = rig.pieceFile(p.body);
    if (file && !inLayers(piecesLayers, file))
      bad(`props/${f}: thân trỏ tới pieces/${file} không có`);
    if (p.body.src === "part" && p.body.part && !rig.PARTS[p.body.part])
      bad(`props/${f}: thân trỏ tới bộ phận "${p.body.part}" không có`);
  }

  const pngs = listPngs(piecesDir);
  counts.pieces = pngs.length;
  const catalogPath = join(piecesDir, rig.PIECE_CATALOG_FILE);
  let listed = new Set();
  if (!existsSync(catalogPath)) {
    if (pngs.length)
      warn("không có pieces/catalog.json — studio chỉ thấy bộ chung, không thấy mảnh nào ở đây");
  } else {
    const r = rig.parsePieceCatalog(readJson(catalogPath));
    if (!r.success) bad(`pieces/catalog.json: ${issues(r.error)}`);
    else {
      listed = new Set(r.data.pieces.map((p) => p.file));
      // Mục trỏ tới mảnh chỉ có ở bộ chung là hợp lệ: đè config mà không chép ảnh
      for (const p of r.data.pieces) {
        if (!inLayers(piecesLayers, p.file)) bad(`catalog: ${p.file} không có file`);
        else if (!p.file.startsWith(`${p.socket}/`))
          warn(
            `catalog: ${p.file} khai socket ${p.socket} nhưng nằm thư mục khác — studio lọc theo thư mục`,
          );
      }
      for (const n of Object.keys(r.data.parts))
        if (!rig.PARTS[n]) bad(`catalog: parts.${n} không phải bộ phận nào`);
      const commonCatalog = join(COMMON.pieces, rig.PIECE_CATALOG_FILE);
      const shared = existsSync(commonCatalog)
        ? new Map(
            (rig.parsePieceCatalog(readJson(commonCatalog)).data?.pieces ?? []).map((p) => [
              p.file,
              JSON.stringify(p),
            ]),
          )
        : new Map();
      const same = r.data.pieces.filter((p) => shared.get(p.file) === JSON.stringify(p));
      if (same.length)
        warn(
          `catalog: ${same.length} mục giống hệt bộ chung của studio, xoá được — ${same.map((p) => p.file).join(", ")}`,
        );
    }
  }
  for (const f of pngs) {
    const buf = readFileSync(join(piecesDir, f));
    if (!pngAlpha(buf)) bad(`pieces/${f}: PNG không có kênh alpha — nền sẽ hiện ra trong preview`);
    if (!listed.has(f)) warn(`pieces/${f}: không có trong catalog.json, studio không thấy`);
  }

  // Chép y nguyên từ bộ chung (workspace dựng trước khi có hai lớp) thì thừa; khác nội dung là cố ý đè
  for (const [kind, files, local, common] of [
    ["pieces", pngs, piecesDir, COMMON.pieces],
    ["actions", listJson(join(root, "actions")), join(root, "actions"), COMMON.actions],
    ["animals", listJson(join(root, "animals")), join(root, "animals"), COMMON.animals],
    ["characters", listJson(join(root, "characters")), join(root, "characters"), COMMON.characters],
  ]) {
    const same = files.filter(
      (f) =>
        existsSync(join(common, f)) &&
        hash(readFileSync(join(local, f))) === hash(readFileSync(join(common, f))),
    );
    if (same.length)
      warn(
        `${kind}/: ${same.length} file giống hệt bộ chung của studio, xoá được — ${same.join(", ")}`,
      );
  }
  counts.common =
    listPngs(COMMON.pieces).length +
    listJson(COMMON.actions).length +
    listJson(COMMON.animals).length +
    listJson(COMMON.characters).length;

  // File có trên đĩa mà chưa commit thì máy khác clone về là thiếu, và không gì báo:
  // mọi `existsSync` ở trên vẫn xanh vì chúng soi đúng cái đĩa đang có. docs/05-repo-video.md
  const tracked = gitTracked(root);
  if (tracked) {
    const untracked = gitUntracked(root);
    const owned = [
      ...[...Object.keys(kinds), "episodes"].flatMap((k) =>
        listJson(join(root, k)).map((f) => join(k, f)),
      ),
      ...pngs.map((f) => join("pieces", f)),
      join("pieces", rig.PIECE_CATALOG_FILE),
      ...assets,
    ];
    // File `.gitignore` loại là cố ý để ngoài git (vd. audio gen ra), không kêu
    const kept = [...new Set(owned)].filter(
      (rel) => existsSync(join(root, rel)) && (tracked.has(rel) || untracked.has(rel)),
    );
    const loose = kept.filter((rel) => untracked.has(rel));
    if (loose.length && loose.length === kept.length)
      warn("chưa commit file nội dung nào — `git add` trước khi ai đó clone về");
    else if (loose.length)
      warn(
        `chưa commit ${loose.length} file: ${loose.slice(0, 8).join(", ")}${loose.length > 8 ? ", …" : ""}`,
      );
  }

  // Không cái nào là dependency npm nên không có gì báo lúc cài; chúng chỉ nổ giữa lượt render
  const missing = TOOLS.filter(([cmd]) => !onPath(cmd));
  for (const [cmd, what] of missing) warn(`không có \`${cmd}\` trên PATH — cần cho ${what}`);

  return {
    dir: root,
    counts,
    stamped: stamp?.versions?.rig ?? null,
    rig: installed,
    tools: Object.fromEntries(TOOLS.map(([cmd]) => [cmd, !missing.some(([m]) => m === cmd)])),
    problems,
    frozen: muted,
  };
}
