import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Cả hai đều do bên tiêu thụ cài; bundle vào là có hai bản zod trong một app
  external: ["react", "react/jsx-runtime", "zod"],
});
