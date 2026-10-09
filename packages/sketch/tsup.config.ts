import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // Bundle lõi vào là hai bản `PARTS`: bộ phận đăng ký ở một bản, `propSeat` tra ở bản kia
  external: ["react", "react/jsx-runtime", /^@stickman3d\/rig/],
});
