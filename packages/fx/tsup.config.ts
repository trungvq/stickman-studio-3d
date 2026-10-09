import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Rig phải là một bản duy nhất trong app; react và zod do bên tiêu thụ cài
  external: ["react", "react/jsx-runtime", "zod", "@stickman3d/sketch"],
});
