// Studio 3D chạy trong monorepo này: cùng cấu hình `stickman studio` dựng cho một repo video (`studio3dConfig` của CLI),
// nhưng rig, fx lấy mã nguồn của chính monorepo. `STICKMAN_ROOT=<repo> pnpm --filter studio3d dev`; bỏ trống là gốc
// monorepo, chỉ có lớp chung. README.md.
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { studio3dConfig } from "@stickman3d/cli/studio3d";
import { defineConfig } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../..");

export default defineConfig(() =>
  studio3dConfig({
    dir: process.env.STICKMAN_ROOT || REPO,
    tree: REPO,
    app: HERE,
  }),
);
