/**
 * Bộ phận vẽ bằng code của repo: cắm vào socket nhân vật hay thân đạo cụ bằng `src: "part"`,
 * y như bộ phận trong `PARTS` của rig. `package.json` trỏ `stickman.parts` tới file này;
 * `stickman studio2d`, `stickman-render`, MCP và `index.ts` của app Remotion cùng nạp nó, nên
 * thấy gì ở studio thì mp4 vẽ đúng thế. Hợp đồng `PartDef` ở `pnpm exec stickman docs 02`.
 *
 * Tên không được trùng bộ phận của rig. Chỉ `import` React và `@stickman3d/sketch`; không `import`
 * Remotion — studio và render gọi nó ngoài Remotion.
 */
import type { PartDef } from "@stickman3d/sketch";

export const CODE_PARTS: Record<string, PartDef> = {};
