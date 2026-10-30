/**
 * Lớp vẽ code của repo: thứ `scene.fx` không làm được — vẽ cả bối cảnh, rung cả khung, đẩy
 * chỗ đứng của người. `package.json` trỏ `stickman.layers` tới file này;
 * `stickman-render`, MCP và `Scene.tsx` cùng nạp nó qua `<SceneWorld>`, nên dải ảnh soi và
 * mp4 cuối vẽ cùng một hình. Thứ tự mảng là thứ tự vẽ. Hợp đồng ở `pnpm exec stickman docs 10`.
 *
 * Thuần theo `t` như `@stickman3d/fx`: không trạng thái sống qua frame, không `Math.random`,
 * không `import` Remotion — giây vào bằng `ctx.t`, khung camera bằng `ctx.cam`, ảnh qua `ctx.url`.
 */
import type { CodeLayer } from "@stickman3d/fx";

export const CODE_LAYERS: CodeLayer[] = [];
