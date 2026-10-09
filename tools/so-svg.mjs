// Bộ so SVG: dựng `<SceneWorld>` của mọi scene (repo video + bộ mẫu) ở t = 0, giữa, cuối và từng
// `marks`, bằng bản gốc và bằng mã đang sửa, chuẩn hoá rồi so chuỗi. Khung khác thì so PNG
// (`rsvg-convert` + `magick compare -metric AE`).
//
//   node tools/so-svg.mjs --repo ../youtube-video/jp-psychology [--base v0.51.0 | --base-ref <ref>]
//                         [--only <regex>] [--out tmp/so-svg] [--no-png] [--no-build]
//
// Bản gốc: `--base <tag>` cài bản phát hành từ registry; `--base-ref <ref>` dựng worktree git tách
// rời của ref ở `$TMPDIR/stickman-so-svg-ref-<sha12>` (install + build một lần, lần sau dùng lại;
// gỡ bằng `git worktree remove --force <thư mục>`).
// Một bên chạy trong một tiến trình con (`--dump`): hai bản rig không được chung một tiến trình.
// Bộ chung (`COMMON`), lớp vẽ code và bộ phận vẽ code của repo nạp qua chính bản đang dựng.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const STUDIO = resolve(HERE, "..");
const args = process.argv.slice(2);
const flag = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const has = (k) => args.includes(`--${k}`);

if (has("dump")) await dump();
else await main();

/** Chuẩn hoá: số làm tròn 0.01, `id` của `useId` đánh lại theo thứ tự gặp, data URI thành băm. */
function normalize(svg) {
  const ids = new Map();
  return svg
    .replace(
      /data:[^"')]+/g,
      (u) => `data:${createHash("sha1").update(u).digest("hex").slice(0, 12)}`,
    )
    .replace(/«r[0-9a-z]+»|:r[0-9a-z]+:|_r_[0-9a-z]+_/g, (m) => {
      if (!ids.has(m)) ids.set(m, `ID${ids.size}`);
      return ids.get(m);
    })
    .replace(/-?\d*\.\d+(?:e-?\d+)?/g, (m) => {
      const v = Math.round(Number(m) * 100) / 100;
      return String(Object.is(v, -0) ? 0 : v);
    });
}

/** Các mốc soi của một cảnh: 0, giữa, cuối và từng mốc có tên. */
function timesOf(rt) {
  const d = rt.duration;
  const ts = [0, d / 2, d, ...Object.values(rt.marks ?? {})].filter((t) => t >= 0 && t <= d);
  return [...new Set(ts.map((t) => +t.toFixed(3)))].sort((a, b) => a - b);
}

/** Tiến trình con: dựng mọi khung của một bên, ghi SVG đã chuẩn hoá vào `--out`. */
async function dump() {
  const cliLib = realpathSync(resolve(flag("cli")));
  const out = resolve(flag("out"));
  const repo = resolve(flag("repo"));
  const only = flag("only") ? new RegExp(flag("only")) : null;
  const req = createRequire(cliLib);
  const imp = (name) => import(pathToFileURL(req.resolve(name)).href);
  const { COMMON, SOURCES } = await import(pathToFileURL(cliLib).href);
  const R = await imp("@stickman3d/render");
  const rig = await imp("@stickman3d/sketch");
  mkdirSync(out, { recursive: true });

  const workspaces = [
    { tag: "kenh", root: repo, code: true },
    { tag: "mau", root: SOURCES.sample, code: false },
  ];
  let n = 0;
  for (const ws of workspaces) {
    const dir = join(ws.root, "scenes");
    if (!existsSync(dir)) continue;
    const L = (k) => R.layers(join(ws.root, k), ws.root === SOURCES.sample ? null : COMMON[k]);
    const piecesDirs = L("pieces");
    const actionsDirs = L("actions");
    const animalsDirs = L("animals");
    const charsDirs = L("characters");
    if (ws.code) await R.loadParts(ws.root);
    const codeLayers = ws.code ? await R.loadLayers(ws.root) : [];
    for (const f of readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()) {
      const name = `${ws.tag}-${f.replace(/\.json$/, "")}`;
      if (only && !only.test(name)) continue;
      const write = (t, body) => writeFileSync(join(out, `${name}@${t}.svg`), body);
      let rt, world;
      try {
        const parsed = rig.parseScene(R.readJson(join(dir, f)));
        if (!parsed.success) throw new Error(parsed.error.message);
        const bgUrls = R.mountBg(parsed.data, R.layers(join(ws.root, "assets/bg"), null));
        const loaded = R.loadScene(
          parsed.data,
          actionsDirs,
          animalsDirs,
          [join(ws.root, "props")],
          charsDirs,
        );
        rt = loaded.rt;
        const chars = {};
        const props = {};
        const beasts = {};
        world = {
          bgUrls,
          codeLayers,
          loadCharacter: (file) => {
            if (chars[file]) return chars[file];
            const c = rig.parseCharacter(R.readJson(R.findIn(charsDirs, file)));
            if (!c.success) throw new Error(`${file}: ${c.error.message}`);
            return (chars[file] = { character: c.data, urls: R.mount(c.data, piecesDirs) });
          },
          loadProp: (file) => {
            if (props[file]) return props[file];
            const p = rig.parseProp(R.readJson(join(ws.root, "props", file)));
            if (!p.success) throw new Error(`${file}: ${p.error.message}`);
            return (props[file] = { prop: p.data, url: R.mountProp(p.data, piecesDirs) });
          },
          loadAnimal: (file) =>
            (beasts[file] ??= {
              animal: loaded.animals[file],
              urls: R.mountAnimal(loaded.animals[file], piecesDirs),
            }),
          loadPiece: (file) => R.mountPiece(file, piecesDirs),
        };
      } catch (e) {
        write("nap", `LỖI NẠP: ${e.message}\n`);
        n++;
        continue;
      }
      for (const t of timesOf(rt)) {
        let svg;
        try {
          svg = R.sceneFrame({ rt, t, ...world });
        } catch (e) {
          svg = `LỖI DỰNG: ${e.message}\n`;
        }
        write(t, normalize(svg));
        n++;
      }
    }
  }
  console.log(`${n} khung → ${out}`);
}

/** Cài bản phát hành gốc (render + cli cùng version với tag) vào thư mục tạm, trả đường dẫn `cli/lib.mjs`. */
function baseline(tag) {
  const ver = (pkg) =>
    JSON.parse(
      execFileSync("git", ["-C", STUDIO, "show", `${tag}:packages/${pkg}/package.json`], {
        encoding: "utf8",
      }),
    ).version;
  const want = { render: ver("render"), cli: ver("cli") };
  const dir = join(tmpdir(), `stickman-so-svg-${tag}`);
  const lib = join(dir, "node_modules/@stickman3d/cli/lib.mjs");
  if (!existsSync(lib)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "so-svg-base", private: true }),
    );
    const r = spawnSync(
      "pnpm",
      [
        "add",
        "--allow-build=esbuild",
        `@stickman3d/render@${want.render}`,
        `@stickman3d/cli@${want.cli}`,
      ],
      { cwd: dir, stdio: "inherit" },
    );
    if (r.status || !existsSync(lib)) throw new Error(`không cài được bản gốc ${tag} vào ${dir}`);
  }
  return lib;
}

/** Dựng bản gốc từ một git ref trong worktree tạm theo sha, trả đường dẫn `cli/lib.mjs` của nó. */
function baselineRef(ref) {
  const git = (...a) => execFileSync("git", ["-C", STUDIO, ...a], { encoding: "utf8" }).trim();
  const sha = git("rev-parse", "--verify", `${ref}^{commit}`);
  const dir = join(tmpdir(), `stickman-so-svg-ref-${sha.slice(0, 12)}`);
  const lib = join(dir, "packages/cli/lib.mjs");
  const stamp = join(dir, "node_modules/.so-svg-xong");
  const listed = () =>
    git("worktree", "list", "--porcelain")
      .split("\n")
      .filter((l) => l.startsWith("worktree "))
      .map((l) => l.slice(9));
  const real = (p) => (existsSync(p) ? realpathSync(p) : p);
  const registered = listed().some((p) => real(p) === real(dir));
  const head = () => {
    try {
      return execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    } catch {
      return null;
    }
  };
  const label = sha.startsWith(ref) ? sha.slice(0, 12) : `${ref} (${sha.slice(0, 12)})`;
  if (registered && existsSync(stamp) && head() === sha) return { lib, label };

  if (registered) git("worktree", "remove", "--force", dir);
  rmSync(dir, { recursive: true, force: true });
  git("worktree", "prune");
  git("worktree", "add", "--detach", dir, sha);
  const run = (cmd, a) => execFileSync(cmd, a, { cwd: dir, stdio: "inherit" });
  run("pnpm", ["install", "--frozen-lockfile"]);
  for (const p of ["@stickman3d/sketch", "@stickman3d/fx", "@stickman3d/render", "@stickman3d/cli"])
    run("pnpm", ["--filter", p, "build"]);
  writeFileSync(stamp, `${sha}\n`);
  return { lib, label };
}

function side(label, cliLib, out, repo) {
  rmSync(out, { recursive: true, force: true });
  const r = spawnSync(
    process.execPath,
    [
      fileURLToPath(import.meta.url),
      "--dump",
      "--cli",
      cliLib,
      "--out",
      out,
      "--repo",
      repo,
      ...(flag("only") ? ["--only", flag("only")] : []),
    ],
    { stdio: "inherit" },
  );
  if (r.status) throw new Error(`bên ${label} dựng hỏng`);
}

/** Số điểm ảnh khác nhau giữa hai SVG sau khi rasterize; `null` nếu không rasterize được. */
function pixelDiff(a, b, tmp) {
  const png = (svg, p) => {
    execFileSync("rsvg-convert", ["-o", p], { input: svg });
    return p;
  };
  try {
    const pa = png(a, join(tmp, "a.png"));
    const pb = png(b, join(tmp, "b.png"));
    const r = spawnSync("magick", ["compare", "-metric", "AE", pa, pb, join(tmp, "d.png")], {
      encoding: "utf8",
    });
    return Number.parseFloat(r.stderr);
  } catch {
    return null;
  }
}

async function main() {
  const repo = resolve(flag("repo") ?? die("thiếu --repo <repo video>"));
  const ref = flag("base-ref");
  const tag = flag("base", "v0.51.0");
  const out = resolve(STUDIO, flag("out", "tmp/so-svg"));
  if (!has("no-build")) {
    for (const p of ["@stickman3d/sketch", "@stickman3d/fx"])
      execFileSync("pnpm", ["--filter", p, "build"], { cwd: STUDIO, stdio: "ignore" });
  }
  const base = join(out, "goc");
  const cur = join(out, "moi");
  const origin = ref ? baselineRef(ref) : { lib: baseline(tag), label: tag };
  side(`gốc ${origin.label}`, origin.lib, base, repo);
  side("đang sửa", join(STUDIO, "packages/cli/lib.mjs"), cur, repo);

  const names = [...new Set([...readdirSync(base), ...readdirSync(cur)])].sort();
  const red = [];
  for (const f of names) {
    const a = existsSync(join(base, f)) ? readFileSync(join(base, f), "utf8") : "(không có)";
    const b = existsSync(join(cur, f)) ? readFileSync(join(cur, f), "utf8") : "(không có)";
    if (a !== b) red.push({ f, a, b });
  }
  const tmp = join(out, "png");
  mkdirSync(tmp, { recursive: true });
  const rows = red.map(({ f, a, b }) => {
    const svg = a.startsWith("<svg") && b.startsWith("<svg");
    const ae = svg && !has("no-png") ? pixelDiff(a, b, tmp) : null;
    return { f, ae, why: svg ? "" : (b.startsWith("<svg") ? a : b).split("\n")[0].slice(0, 160) };
  });
  const scenes = (xs) => new Set(xs.map((f) => f.replace(/@[^@]+\.svg$/, ""))).size;
  const redScenes = scenes(red.map((r) => r.f));
  const lines = [
    `so SVG ${origin.label} ↔ đang sửa, repo ${basename(repo)}`,
    `${names.length} khung / ${scenes(names)} cảnh: xanh ${names.length - red.length}, đỏ ${red.length} (${redScenes} cảnh)`,
    ...rows.map(
      (r) =>
        `  ĐỎ ${r.f}${r.ae != null ? `  PNG AE ${r.ae}${r.ae === 0 ? " (vô hại)" : ""}` : ""}${r.why ? `  ${r.why}` : ""}`,
    ),
  ];
  writeFileSync(join(out, "bao-cao.txt"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
  process.exitCode = rows.some((r) => r.ae !== 0) ? 1 : 0;
}

function die(msg) {
  console.error(msg);
  process.exit(2);
}
