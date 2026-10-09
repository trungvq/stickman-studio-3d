import fs from "node:fs/promises";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const PUBLIC = path.resolve(__dirname, "public");
const INDEXED: Record<string, RegExp> = {
  pieces: /\.(png|webp|jpe?g)$/i,
  characters: /\.json$/i,
  actions: /\.json$/i,
};

// pieces/<socket>/x.png: một cấp thư mục con, tên mang cả thư mục
const list = async (dir: string) =>
  (await fs.readdir(path.join(PUBLIC, dir), { recursive: true }))
    .map((f) => f.split(path.sep).join("/"))
    .filter((f) => f !== "index.json" && INDEXED[dir].test(f))
    .sort();

// publicDir không liệt kê thư mục; studio cần danh sách mới dựng được ô chọn mẫu.
function assetIndex(): Plugin {
  return {
    name: "stickman:asset-index",
    configureServer(server) {
      for (const dir of Object.keys(INDEXED))
        server.middlewares.use(`/${dir}/index.json`, async (_req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(await list(dir)));
        });
    },
    async generateBundle() {
      for (const dir of Object.keys(INDEXED))
        this.emitFile({
          type: "asset",
          fileName: `${dir}/index.json`,
          source: JSON.stringify(await list(dir)),
        });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), assetIndex()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  // host: true để mở studio bằng điện thoại trong cùng mạng LAN
  server: { host: true },
});
