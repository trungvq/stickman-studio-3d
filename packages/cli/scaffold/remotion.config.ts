import { Config } from "@remotion/cli/config";
import { createRequire } from "node:module";
import { cliScope } from "./tools/scope.mjs";
import { sweepAndReport } from "./tools/sweep.mjs";
import { ownTmpdir, webpackOverride } from "./tools/webpack.mjs";

// `remotion render` / `still` / `studio` dọn `TMPDIR` như tool của repo: bundle, Chrome của lượt bị giết giữa chừng
sweepAndReport({ own: ownTmpdir !== null });

Config.setVideoImageFormat("jpeg");
// Cảnh 3D (`src/khoi3d/`): GPU thật qua ANGLE trên Vulkan; máy không có Vulkan thì tạo context lỗi ngay, không âm thầm vẽ phần mềm
Config.setChromiumOpenGlRenderer("vulkan");

// `pnpm remotion-prod` (`STUDIO_FAST=1`): studio dùng React production — cảnh 3D nặng nhanh ~2,7 lần,
// đổi lại mất fast refresh (sửa code phải reload trang) và cảnh báo dev của React. Runtime,
// loader, plugin fast refresh và lớp gắn vị trí mã cho `<Sequence>` của Remotion cần React dev nên gỡ hết.
// Không có fast refresh thì không module nào nhận cập nhật, client HMR của studio reload cả trang mỗi
// lần lưu file: entry `noReload` tắt cờ `reload` của nó, sửa xong F5 lấy bundle mới. Plugin HMR phải
// giữ — client ném lỗi lúc nạp khi không có `module.hot`, trang trắng.
const shared = createRequire(
  createRequire(`${process.cwd()}/`).resolve("@remotion/bundler"),
).resolve("@remotion/studio-shared");
const noReload = `data:text/javascript,${encodeURIComponent(
  `import { hotMiddlewareOptions } from ${JSON.stringify(shared)}; hotMiddlewareOptions.reload = false;`,
)}`;
const noRefresh = (s: unknown) => !/fast-refresh|setup-sequence-stack-traces/.test(String(s));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const reactProd = (w: any) => ({
  ...w,
  entry: Array.isArray(w.entry) ? [...w.entry.filter(noRefresh), noReload] : w.entry,
  plugins: w.plugins?.filter((p: object) => p.constructor.name !== "ReactFreshWebpackPlugin"),
  module: {
    ...w.module,
    rules: w.module.rules.map((r: { use?: unknown }) =>
      Array.isArray(r.use)
        ? { ...r, use: r.use.filter((u: { loader?: string }) => noRefresh(u?.loader)) }
        : r,
    ),
  },
  optimization: { ...w.optimization, nodeEnv: "production" },
});

// Alias `@stickman-common` dùng chung với `tools/soi.mjs` — sửa ở `tools/webpack.mjs`.
// Khi `@stickman3d/rig` trỏ `link:` sang cây nguồn studio thì bỏ chú thích khối dưới: symlink
// làm webpack tìm react ở repo kia, hai bản react là hook hỏng. Cài lại từ registry thì
// chú thích lại.
// const one = (m: string) => `${process.cwd()}/node_modules/${m}`;
// Phạm vi bundle (`tools/scope.mjs`, docs/03 § Phạm vi bundle): `render` / `still <id>` chỉ mang composition gõ trên
// dòng lệnh, Studio và `remotion bundle` theo `STICKMAN_SCOPE` hay `stickman.scope` của `package.json`
const scope = cliScope(process.cwd(), process.argv);
let told = false;
Config.overrideWebpackConfig((c) => {
  if (!told) console.warn(`stickman: ${scope.summary()}`);
  told = true;
  const w = webpackOverride(c, scope);
  // w.resolve.alias["react/jsx-runtime"] = one("react/jsx-runtime.js");
  // w.resolve.alias["react-dom"] = one("react-dom");
  // w.resolve.alias.react = one("react");
  // w.resolve.alias.zod = one("zod");
  return process.env.STUDIO_FAST ? reactProd(w) : w;
});
