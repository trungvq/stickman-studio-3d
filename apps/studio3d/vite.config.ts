// Studio 3D chạy trong monorepo này: cùng cấu hình `stickman studio` dựng cho một repo video (`studio3dConfig` của CLI),
// nhưng rig, sketch, fx lấy mã nguồn của chính monorepo. `STICKMAN_ROOT=<repo> pnpm --filter studio3d dev`. README.md.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { studio3dConfig } from "@stickman3d/cli/studio3d";
import { defineConfig } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");

export default defineConfig(() =>
  studio3dConfig({
    dir: process.env.STICKMAN_ROOT ?? join(REPO, "../youtube-video/jp-sukatto-nhom-cam"),
    tree: REPO,
    app: HERE,
  }),
);
