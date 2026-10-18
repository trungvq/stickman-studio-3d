// Phạm vi bundle (docs/03 § Phạm vi bundle): cảnh, tập và tiếng nào của workspace vào một bundle Remotion. `src/data.ts`
// nạp `scenes/`, `episodes/`, `assets/audio/` bằng `require.context`; plugin của `webpack.mjs` lọc ba context ấy theo
// phạm vi, nên bundle và trang chỉ mang phần cần chứ không lớn theo cả repo. Không import gì của Remotion hay webpack.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ids = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.slice(0, -5))
    : [];

const stickmanOf = (root) => {
  try {
    return JSON.parse(readFileSync(join(root, "package.json"), "utf8")).stickman ?? {};
  } catch {
    return {};
  }
};

/** Thư mục của một id theo `stickman.folders` — đoạn khớp đầu của regex; `null` là nằm ở gốc */
export function folderFn(root) {
  const src = stickmanOf(root).folders;
  const re = src ? new RegExp(src) : null;
  return (id) => (re ? (re.exec(id)?.[0] ?? null) : null);
}

/** `"t02, thu"` → `["t02", "thu"]` */
export const parseTokens = (s) =>
  String(s ?? "")
    .split(/[\s,]+/)
    .filter(Boolean);

/** Phạm vi khi không ai chỉ: biến `STICKMAN_SCOPE`, rồi `stickman.scope` của `package.json`, rồi cả workspace */
export const defaultTokens = (root) =>
  parseTokens(process.env.STICKMAN_SCOPE ?? stickmanOf(root).scope ?? "*");

/**
 * Đời của luật chọn file trong file này: vào `key`, nên cache webpack (giữ danh sách file của context theo id module)
 * không dùng lại kết quả của luật cũ. Đổi luật chọn thì tăng số này.
 */
const RULES = 1;

const THUMB = /^(.+)-thumb(?:-[a-z0-9-]+)?$/;
/** Thư mục lồng tiếng `<thư mục>/<lang>/<file>` của `Episode.tsx`: mã ngôn ngữ hai chữ (`en`, `pt-BR`) */
const LANG = /^[a-z]{2}(?:-[A-Za-z0-9]{2,8})?$/;

/**
 * Id composition thumbnail → id tập (`<tập>-thumb`, `<tập>-thumb-<khoá>`), theo `thumbnail` của `episodes/<tập>.json`
 * như `episodeThumbnails` của `src/episode.ts`
 */
export function thumbIds(root, episode) {
  const ep = readJson(join(root, "episodes", `${episode}.json`));
  const t = ep?.thumbnail;
  if (!t) return [];
  return t.variants
    ? Object.keys(t.variants).map((k) => `${episode}-thumb-${k}`)
    : [`${episode}-thumb`];
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/** File tiếng mà cue của một tập gọi tên (`file` của `audio[]` và `shots[].audio[]`) */
const cueFiles = (ep) =>
  [...(ep.audio ?? []), ...(ep.shots ?? []).flatMap((s) => s.audio ?? [])]
    .map((c) => c?.file)
    .filter((f) => typeof f === "string");

/** Cảnh mà một tập gọi tên: shot và thumbnail (cả biến thể) */
const episodeScenes = (ep) => [
  ...(ep.shots ?? []).map((s) => s?.scene),
  ep.thumbnail?.scene,
  ...Object.values(ep.thumbnail?.variants ?? {}).map((v) => v?.scene),
];

/**
 * Phạm vi từ danh sách khoá. Một khoá là:
 * - `*`: cả workspace;
 * - id một cảnh: cảnh ấy cùng mọi cảnh cùng thư mục (lớp vẽ code hay gọi cảnh anh em, như ô cảnh trong cảnh);
 * - id một tập, hay id thumbnail của nó: tập ấy, cảnh nó gọi, cảnh cùng thư mục với nó và tiếng cue của nó;
 * - tên thư mục của `stickman.folders` (`t02`): mọi cảnh, tập trong thư mục, cùng cảnh và tiếng các tập ấy gọi.
 *
 * `audio`: `"files"` chỉ file cue gọi tên (kể cả bản lồng tiếng `<thư mục>/<lang>/<file>`, `lang` hai chữ), `"dirs"` thêm cả thư mục
 * đầu của chúng và thư mục tiếng trùng tên thư mục phạm vi (Studio: file gen mới hiện ngay), `"none"` không tiếng nào
 * (ảnh tĩnh). Cảnh và tập mới thêm vào thư mục trong phạm vi hiện ngay ở Studio; cảnh ngoài thư mục mà tập mới gọi thì
 * phải mở lại.
 */
export function bundleScope(root, tokens, { audio = "files" } = {}) {
  const folderOf = folderFn(root);
  const sceneIds = new Set(ids(join(root, "scenes")));
  const episodeIds = new Set(ids(join(root, "episodes")));
  const all = tokens.includes("*");
  const scenes = new Set();
  const sceneFolders = new Set();
  const episodes = new Set();
  const folders = new Set();
  const unknown = [];
  for (const t of all ? [] : tokens) {
    const thumbOf = THUMB.exec(t)?.[1];
    if (sceneIds.has(t)) {
      scenes.add(t);
      sceneFolders.add(folderOf(t));
    } else if (episodeIds.has(t) || (thumbOf && episodeIds.has(thumbOf))) {
      const e = episodeIds.has(t) ? t : thumbOf;
      episodes.add(e);
      sceneFolders.add(folderOf(e));
    } else {
      folders.add(t);
      sceneFolders.add(t);
      if (![...sceneIds, ...episodeIds].some((id) => folderOf(id) === t)) unknown.push(t);
    }
  }
  const episodeIn = (id) => all || episodes.has(id) || folders.has(folderOf(id));
  const called = new Set();
  const files = new Set();
  for (const id of [...episodeIds].filter(episodeIn)) {
    const ep = readJson(join(root, "episodes", `${id}.json`));
    if (!ep) continue;
    for (const s of episodeScenes(ep)) if (typeof s === "string") called.add(s);
    if (audio !== "none") for (const f of cueFiles(ep)) files.add(f);
  }
  const dirs = new Set(
    audio === "dirs"
      ? [...[...files].filter((f) => f.includes("/")).map((f) => f.split("/")[0]), ...folders]
      : [],
  );
  const sceneIn = (id) => all || called.has(id) || sceneFolders.has(folderOf(id));
  /** `t01/x.mp3`, hay bản lồng tiếng `t01/en/x.mp3` của nó */
  const audioIn = (path) => {
    if (audio === "none") return false;
    if (files.has(path)) return true;
    const parts = path.split("/");
    if (
      parts.length > 1 &&
      LANG.test(parts.at(-2)) &&
      files.has([...parts.slice(0, -2), parts.at(-1)].join("/"))
    )
      return true;
    return parts.length > 1 && dirs.has(parts[0]);
  };
  // Thư mục đáng duyệt khi webpack đi `assets/audio/`: tổ tiên của file cue, thư mục lồng tiếng ngay dưới thư mục có
  // file cue, và (Studio) cả cây của thư mục tiếng trong phạm vi. Mục có thư mục cha ngoài các chỗ ấy thì bỏ, khỏi `stat`
  const dirOf = (p) => (p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "");
  const fileDirs = new Set([...files].map(dirOf));
  const prefixes = new Set(
    [...files].flatMap((f) => {
      const parts = f.split("/");
      return parts.slice(1).map((_, i) => parts.slice(0, i + 1).join("/"));
    }),
  );
  const parentOk = (p) =>
    p === "" ||
    prefixes.has(p) ||
    (LANG.test(p.split("/").at(-1)) && fileDirs.has(dirOf(p))) ||
    dirs.has(p.split("/")[0]);
  const audioVisit = (rel) => audio !== "none" && parentOk(dirOf(rel));
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        RULES,
        stickmanOf(root).folders ?? null,
        all,
        [...scenes].sort(),
        [...sceneFolders].map(String).sort(),
        [...episodes].sort(),
        [...folders].sort(),
        [...called].sort(),
        audio,
        [...files].sort(),
        [...dirs].sort(),
      ]),
    )
    .digest("hex")
    .slice(0, 16);
  const count = (set, pick) => [...set].filter(pick).length;
  return {
    tokens: all ? ["*"] : tokens,
    all,
    unknown,
    key,
    scene: sceneIn,
    episode: episodeIn,
    audio: audioIn,
    /** Mục `rel` (đường dưới `assets/audio/`) có đáng duyệt không — `exclude` của context tiếng */
    audioVisit,
    /** Một dòng cho log: khoá và số cảnh, tập, file cue lúc bundle */
    summary: () =>
      `phạm vi ${all ? "*" : tokens.join(",") || "(rỗng)"}: ${count(sceneIds, sceneIn)}/${sceneIds.size} cảnh, ` +
      `${count(episodeIds, episodeIn)}/${episodeIds.size} tập, tiếng ${
        audio === "none"
          ? "không"
          : `${files.size} file cue${dirs.size ? ` + thư mục ${[...dirs].join(",")}` : ""}`
      }`,
  };
}

const SUBCOMMANDS = ["render", "still", "studio", "preview", "bundle", "compositions", "benchmark"];

/**
 * Phạm vi của một lệnh `remotion …` (`remotion.config.ts` gọi): `STICKMAN_SCOPE` thắng; `render` / `still <id>` lấy
 * chính id composition gõ trên dòng lệnh; còn lại (`studio`, `bundle`, id không nhận ra) là `defaultTokens`.
 * `still` không mang tiếng, `studio` mang cả thư mục tiếng.
 */
export function cliScope(root, argv = process.argv) {
  const cmd = argv.find((a) => SUBCOMMANDS.includes(a));
  const audio = cmd === "still" ? "none" : cmd === "studio" || cmd === "preview" ? "dirs" : "files";
  if (process.env.STICKMAN_SCOPE)
    return bundleScope(root, parseTokens(process.env.STICKMAN_SCOPE), { audio });
  if (cmd === "render" || cmd === "still") {
    const known = new Set([...ids(join(root, "scenes")), ...ids(join(root, "episodes"))]);
    const after = argv.slice(argv.indexOf(cmd) + 1).filter((a) => !a.startsWith("-"));
    const id = after.find((a) => known.has(a) || known.has(THUMB.exec(a)?.[1]));
    if (id) return bundleScope(root, [id], { audio });
    const tokens = defaultTokens(root);
    // Đường dẫn có thật (entry, bundle) hay có đuôi (file ra) thì không phải id
    if (after.some((a) => !existsSync(a) && !/\.\w+$/.test(a)))
      console.warn(
        `stickman: không nhận ra id composition trong \`remotion ${cmd}\` — bundle theo phạm vi ${tokens.join(",")}; ` +
          "chỉ khác bằng STICKMAN_SCOPE=<id|thư mục>",
      );
    return bundleScope(root, tokens, { audio });
  }
  const scope = bundleScope(root, defaultTokens(root), { audio });
  const episodes = ids(join(root, "episodes")).length;
  if (scope.all && episodes > 3)
    console.warn(
      `stickman: phạm vi * mang cả ${episodes} tập vào bundle — khai \`stickman.scope\` (thư mục đang làm) trong package.json`,
    );
  return scope;
}
