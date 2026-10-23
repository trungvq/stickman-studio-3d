// Test hàm thuần của trang (`src/*.test.ts`): rig lấy mã nguồn của monorepo, như `tsconfig.json`
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rig = (p: string) => fileURLToPath(new URL(`../../packages/rig/src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@stickman3d\/rig\/core$/, replacement: rig("core/index.ts") },
      { find: /^@stickman3d\/rig$/, replacement: rig("index.ts") },
    ],
  },
  test: { include: ["src/**/*.test.ts"] },
});
