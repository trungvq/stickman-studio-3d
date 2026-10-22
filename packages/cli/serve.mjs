// `stickman studio2d`: phục vụ app studio 2D đã build như một app tĩnh, đè `characters/`,
// `actions/`, `props/`, `animals/`, `pieces/` của workspace lên đường dẫn bộ mẫu để mở lên
// là thấy repo này; trừ `props/`, các thư mục ấy có bộ chung của studio làm lớp dưới, như
// studio làm khi mở thư mục. `/parts.mjs` là `CODE_PARTS` của repo gói cho trình duyệt.

// Chỉ đọc — ghi vẫn đi qua "Mở thư mục" (File System Access API), không có endpoint ghi.
import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { networkInterfaces } from "node:os";
import { basename, extname, join, normalize, resolve } from "node:path";
import * as rig from "@stickman3d/sketch";
import { bundlePartsForBrowser, partsEntry } from "@stickman3d/render";
import { COMMON, SOURCES } from "./lib.mjs";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const OVERLAY = {
  pieces: /\.(png|webp|jpe?g)$/i,
  characters: /\.json$/i,
  actions: /\.json$/i,
  props: /\.json$/i,
  animals: /\.json$/i,
};
const layersOf = (root) => ({
  pieces: [join(root, "pieces"), COMMON.pieces],
  actions: [join(root, "actions"), COMMON.actions],
  characters: [join(root, "characters"), COMMON.characters],
  props: [join(root, "props")],
  animals: [join(root, "animals"), COMMON.animals],
});

// pieces/<socket>/x.png: tên mang cả thư mục con, như `assetIndex` của vite bên studio
const list = (dirs, re) =>
  [
    ...new Set(
      dirs
        .filter((d) => existsSync(d))
        .flatMap((d) => readdirSync(d, { recursive: true }))
        .map((f) => f.split("\\").join("/"))
        .filter((f) => f !== "index.json" && re.test(f)),
    ),
  ].sort();

const catalogOf = (dirs) =>
  rig.mergePieceCatalogs(
    ...dirs
      .map((d) => join(d, rig.PIECE_CATALOG_FILE))
      .filter((p) => existsSync(p))
      .map((p) => rig.parsePieceCatalog(JSON.parse(readFileSync(p, "utf8"))))
      .filter((r) => r.success)
      .map((r) => r.data),
  );

const send = (res, code, body, type = "text/plain; charset=utf-8") => {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
};

const sendFile = (res, path) => {
  if (!existsSync(path) || !statSync(path).isFile()) return false;
  send(
    res,
    200,
    readFileSync(path),
    MIME[extname(path).toLowerCase()] ?? "application/octet-stream",
  );
  return true;
};

export function serveStudio({ dir = ".", port = 5173, host = "0.0.0.0" } = {}) {
  const root = resolve(dir);
  const app = SOURCES.studio;
  if (!existsSync(join(app, "index.html")))
    throw new Error(`Không thấy app studio ở ${app} — chạy từ source thì build trước: pnpm build`);

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const p = decodeURIComponent(url.pathname);
    if (p.includes("..")) return send(res, 400, "?");
    if (p === "/workspace.json") {
      let parts = false;
      try {
        parts = !!partsEntry(root);
      } catch {
        parts = true; // khai mà thiếu file: để `/parts.mjs` báo lỗi lên trang
      }
      return send(
        res,
        200,
        JSON.stringify({ label: `${basename(root)} (chỉ đọc)`, parts }),
        MIME[".json"],
      );
    }
    // Gói lại mỗi lượt tải trang, nên sửa `CODE_PARTS` rồi F5 là thấy — docs/02-trang-phuc.md
    if (p === "/parts.mjs") {
      bundlePartsForBrowser(root)
        .then((code) => send(res, 200, code ?? "export const CODE_PARTS = {};", MIME[".js"]))
        .catch((e) =>
          send(res, 200, `throw new Error(${JSON.stringify(e.message)});`, MIME[".js"]),
        );
      return;
    }

    const [, top, ...rest] = p.split("/");
    if (top in OVERLAY) {
      const dirs = layersOf(root)[top];
      const file = rest.join("/");
      if (file === "index.json")
        return send(res, 200, JSON.stringify(list(dirs, OVERLAY[top])), MIME[".json"]);
      if (top === "pieces" && file === rig.PIECE_CATALOG_FILE)
        return send(res, 200, JSON.stringify(catalogOf(dirs)), MIME[".json"]);
      return (
        dirs.some((d) => sendFile(res, normalize(join(d, ...rest)))) || send(res, 404, "không có")
      );
    }
    if (p !== "/" && sendFile(res, normalize(join(app, p)))) return;
    // Đường không có đuôi là route của app, còn lại là file thật bị thiếu
    if (extname(p)) return send(res, 404, "không có");
    return sendFile(res, join(app, "index.html")) || send(res, 404, "không có");
  });

  return new Promise((ok, fail) => {
    server.once("error", fail);
    server.listen(port, host, () => {
      const lan = Object.values(networkInterfaces())
        .flat()
        .filter((i) => i && i.family === "IPv4" && !i.internal)
        .map((i) => `http://${i.address}:${port}/`);
      ok({ server, root, local: `http://localhost:${port}/`, lan });
    });
  });
}
