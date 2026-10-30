import type { WorldSpec } from "@stickman3d/rig";
import { plainRoom } from "./set";

// Cảnh của repo dựng bằng @stickman3d/rig: tên cảnh → cách dựng cảnh 3D (`WorldSpec`: bối cảnh `set`, người nền `still`,
// đồ riêng `extra`, đồ gắn lên người `wear`, ống kính `lens(t)`, hậu kỳ `grade(t)`). `Scene.tsx` gặp cảnh có ở đây thì vẽ
// sân khấu three (`Scene3D`), lớp chữ SVG (`Overlay3D`) đè lên; `stickman check` đo trên cùng cảnh
// three ấy (`world.ts`). Người diễn (`cast[].world`), ống kính (`lens`) và khung cắt (`camera`) lấy từ scene JSON. Phòng
// riêng của repo là hàm trả `Set3D` như `plainRoom`, để ở file mới cạnh file này.

export type Canh3D = WorldSpec;

const day = () => plainRoom();

export const CANH_3D: Record<string, Canh3D> = {
  "vi-du-3d": { set: day },
};

/** Composition thử bối cảnh: lấy người, ống kính và khung cắt của cảnh `scene`, đổi bối cảnh. Giây cảnh theo khung. */
export type Thu3D = Canh3D & { scene: string };

/** Id composition → bối cảnh thử; nằm trong thư mục `khoi3d` của sidebar Studio. */
export const THU_3D: Record<string, Thu3D> = {};
