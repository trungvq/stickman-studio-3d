// Studio 3D: trang Vite xem cảnh three của một repo video (cùng `buildWorld` mà Remotion vẽ), tua giây, xoay camera tự do.
// Repo video chỉ đọc, trừ kiểu cầm soạn tay lưu vào `held/<món>.json` (`POST /api/held`; `STUDIO3D_HELD_OUT=<thư mục>` đổi
// hướng ghi và phủ lên `held/` khi đọc). `STICKMAN_ROOT=<repo> pnpm --filter studio3d dev`. README.md cùng thư mục.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { heldOptions, worldData } from "@stickman3d/cli";
import { defineConfig, type Plugin } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");
const ROOT = resolve(
  process.env.STICKMAN_ROOT ?? join(REPO, "../youtube-video/jp-sukatto-nhom-cam"),
);

/** Lối vào `stickman.world` của `package.json` repo video: module có `worldOf(tên cảnh, ctx)` */
function worldEntry(root: string) {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const rel: string | undefined = pkg.stickman?.world;
  return rel ? join(root, rel) : null;
}

const ENTRY = worldEntry(ROOT);
/** Thư mục ghi kiểu cầm soạn tay thay `held/` của repo video (thử mà không đụng repo); có thì đọc phủ lên `held/` */
const HELD_OUT = process.env.STUDIO3D_HELD_OUT ? resolve(process.env.STUDIO3D_HELD_OUT) : null;
const HELD = join(ROOT, "held");

/** JSON thô của các món `held/` (lớp `STUDIO3D_HELD_OUT` đè): `worldData` parse bằng rig bản dựng, có thể bỏ trường mới */
function heldRaw(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const dir of [HELD, HELD_OUT])
    if (dir && existsSync(dir))
      for (const f of readdirSync(dir).filter((f) => f.endsWith(".json")))
        out[f.slice(0, -5)] = JSON.parse(readFileSync(join(dir, f), "utf8"));
  return out;
}

const body = (req: import("node:http").IncomingMessage) =>
  new Promise<string>((ok, fail) => {
    let s = "";
    req.on("data", (c) => (s += c));
    req.on("end", () => ok(s));
    req.on("error", fail);
  });
// repo không khai `stickman.world` thì mọi cảnh đi `plainRoom()`
const NO_WORLD = join(HERE, "src/no-world.ts");
// cảnh three của repo nạp `remotion` gián tiếp thì nhận bản rỗng, như `hollowReact` của render; `react` là bản thật vì
// `@stickman3d/sketch` (repo video nạp hằng số của nó) dựng `createContext` lúc nạp
const HOLLOW = join(HERE, "src/hollow.ts");

const json = (res: import("node:http").ServerResponse, body: unknown, status = 200) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

/** API đọc workspace: danh sách cảnh, và một cảnh kèm dữ liệu `worldData` đọc lại mỗi lần (sửa JSON là thấy) */
const workspace = (): Plugin => ({
  name: "studio3d-workspace",
  configureServer(server) {
    server.middlewares.use("/api/scenes", (_req, res) => {
      const dir = join(ROOT, "scenes");
      const names = existsSync(dir)
        ? readdirSync(dir)
            .filter((f) => f.endsWith(".json"))
            .map((f) => f.slice(0, -5))
            .sort()
        : [];
      json(res, { root: ROOT, world: ENTRY, names });
    });
    server.middlewares.use("/api/scene", (req, res) => {
      const name = new URL(req.url ?? "", "http://x").searchParams.get("name") ?? "";
      const file = join(ROOT, "scenes", `${name}.json`);
      if (!/^[\w.-]+$/.test(name) || !existsSync(file))
        return json(res, { error: `không có cảnh ${name}` }, 404);
      try {
        const raw = JSON.parse(readFileSync(file, "utf8"));
        json(res, {
          raw,
          data: worldData(ROOT),
          heldRaw: heldRaw(),
          heldOpts: heldOptions(ROOT),
          heldOut: HELD_OUT,
        });
      } catch (e) {
        json(res, { error: (e as Error).message }, 500);
      }
    });
    // ghi kiểu cầm soạn tay của một món × nhóm × biến thể (`authored: null` là xoá): giữ nguyên phần còn lại của file,
    // kiểm bằng `parseHeldItem` của mã nguồn rig, định dạng bằng prettier theo cấu hình của repo video
    server.middlewares.use("/api/held", async (req, res) => {
      if (req.method !== "POST") return json(res, { error: "chỉ POST" }, 405);
      try {
        const name = new URL(req.url ?? "", "http://x").searchParams.get("name") ?? "";
        const src = [HELD_OUT, HELD]
          .map((d) => d && join(d, `${name}.json`))
          .find((f) => f && existsSync(f));
        if (!/^[\w.-]+$/.test(name) || !src)
          return json(res, { error: `không có held/${name}.json` }, 404);
        const { group, variant, authored } = JSON.parse(await body(req));
        if (typeof group !== "string" || typeof variant !== "string")
          return json(res, { error: "thiếu `group` / `variant`" }, 400);
        const raw = JSON.parse(readFileSync(src, "utf8"));
        const all = { ...raw.authored };
        const byVariant = { ...all[group] };
        if (authored) byVariant[variant] = authored;
        else delete byVariant[variant];
        if (Object.keys(byVariant).length) all[group] = byVariant;
        else delete all[group];
        if (Object.keys(all).length) raw.authored = all;
        else delete raw.authored;
        const core = await server.ssrLoadModule(join(REPO, "packages/rig/src/core/index.ts"));
        const parsed = core.parseHeldItem(raw);
        if (!parsed.success)
          return json(
            res,
            { error: `món sau khi ghi không qua schema: ${parsed.error.message}` },
            400,
          );
        const out = join(HELD_OUT ?? HELD, `${name}.json`);
        const prettier = await import("prettier");
        const opts = (await prettier.resolveConfig(join(HELD, `${name}.json`))) ?? {};
        const text = await prettier.format(JSON.stringify(raw), { ...opts, parser: "json" });
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, text);
        json(res, { file: out, item: raw });
      } catch (e) {
        json(res, { error: (e as Error).message }, 500);
      }
    });
  },
});

export default defineConfig({
  plugins: [workspace()],
  resolve: {
    alias: [
      { find: "virtual:stickman-world", replacement: ENTRY ?? NO_WORLD },
      // một bản rig (mã nguồn, sửa rig là trang nạp lại) cho cả trang lẫn cảnh của repo video; sketch, fx cũng lấy mã
      // nguồn ở đây, không thì bản dist của chúng mang theo một rig nữa
      {
        find: /^@stickman3d\/rig\/core$/,
        replacement: join(REPO, "packages/rig/src/core/index.ts"),
      },
      { find: /^@stickman3d\/rig$/, replacement: join(REPO, "packages/rig/src/index.ts") },
      { find: /^@stickman3d\/sketch$/, replacement: join(REPO, "packages/sketch/src/index.ts") },
      { find: /^@stickman3d\/fx$/, replacement: join(REPO, "packages/fx/src/index.ts") },
      { find: /^(remotion|@remotion\/[^/]+)(\/.*)?$/, replacement: HOLLOW },
    ],
    // một bản `three` là một `instanceof`: file của repo video cũng lấy `three`, `react` của app
    dedupe: ["three", "zod", "react", "react-dom"],
  },
  server: {
    fs: { allow: [REPO, ROOT] },
    port: 5180,
  },
});
