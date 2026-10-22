// `@stickman3d/cli` là JS thuần: chỉ khai phần vite.config.ts dùng
declare module "@stickman3d/cli" {
  export function worldData(dir?: string): Record<string, Record<string, unknown>>;
  /** Ngưỡng luật `held` của `package.json` `stickman.held` (thiếu thì mặc định của rig); `off` khi repo tắt nhóm luật */
  export function heldOptions(dir?: string): Record<string, unknown>;
}
