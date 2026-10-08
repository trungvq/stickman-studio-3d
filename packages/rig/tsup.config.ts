import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  // three do bên tiêu thụ cài: bundle vào là hai bản three, `instanceof` và vật liệu hỏng mà không báo
  external: [/^three/],
});
