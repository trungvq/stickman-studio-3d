// `@stickman3d/cli` là JS thuần: chỉ khai phần vite.config.ts dùng
declare module "@stickman3d/cli/studio3d" {
  /** Cấu hình Vite của Studio 3D cho repo video `dir`; `tree` là monorepo rig trang lấy mã nguồn */
  export function studio3dConfig(o: {
    dir?: string;
    tree?: string;
    heldOut?: string;
    app?: string;
  }): import("vite").InlineConfig;
}
