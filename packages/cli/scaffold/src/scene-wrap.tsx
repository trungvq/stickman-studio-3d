/**
 * Chỗ của repo bọc `<SceneWorld>` trong app Remotion: cấp context cho lớp vẽ code cần thứ chỉ app
 * Remotion có (dữ liệu của `data.ts`, một cảnh khác dựng sẵn). Studio, render và MCP không bọc gì,
 * nên lớp đọc context ấy phải chịu được giá trị mặc định. `init` tạo file này, `upgrade` không đụng.
 */
import type { SceneRuntime } from "@stickman3d/sketch";
import type { ReactNode } from "react";

export const SceneWrap = ({ children }: { rt: SceneRuntime; t: number; children: ReactNode }) => (
  <>{children}</>
);
