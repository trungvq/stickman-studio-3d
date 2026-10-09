import { Config } from "@remotion/cli/config";
import { webpackOverride } from "./tools/webpack.mjs";

Config.setVideoImageFormat("jpeg");
// Cảnh 3D (`src/khoi3d/`): GPU thật qua ANGLE trên Vulkan; máy không có Vulkan thì tạo context lỗi ngay, không âm thầm vẽ phần mềm
Config.setChromiumOpenGlRenderer("vulkan");

// Alias `@stickman-common` dùng chung với `tools/still.mjs` — sửa ở `tools/webpack.mjs`.
// Khi `@stickman3d/sketch` trỏ `link:` sang cây nguồn studio thì bỏ chú thích khối dưới: symlink
// làm webpack tìm react ở repo kia, hai bản react là hook hỏng. Cài lại từ registry thì
// chú thích lại.
// const one = (m: string) => `${process.cwd()}/node_modules/${m}`;
Config.overrideWebpackConfig((c) => {
  const w = webpackOverride(c);
  // w.resolve.alias["react/jsx-runtime"] = one("react/jsx-runtime.js");
  // w.resolve.alias["react-dom"] = one("react-dom");
  // w.resolve.alias.react = one("react");
  // w.resolve.alias.zod = one("zod");
  return w;
});
