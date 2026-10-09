import type * as THREE from "three";
import { plainRoom, type Set3D } from "./set";

// Cảnh của repo dựng bằng @stickman3d/rig: tên cảnh → bối cảnh 3D. `Scene.tsx` gặp cảnh có ở đây thì vẽ sân khấu three
// (`Scene3D`) thay cho người que 2D, lớp chữ 2D (`Overlay3D`) đè lên. Người diễn (`cast[].world`), ống kính (`lens`) và
// khung cắt (`camera`) vẫn lấy từ scene JSON. Phòng riêng của repo là hàm trả `Set3D` như `plainRoom` (`set.ts`).

/** Đồ riêng của một cảnh: dựng một lần, `update(t)` đặt lại mỗi khung (khay đang cầm, tờ giấy đang đưa). */
export type Extra3D = { group: THREE.Object3D; update?(t: number): void };

export type Canh3D = {
  /** Dựng bối cảnh; gọi một lần mỗi lần dựng sân khấu */
  set: () => Set3D;
  /** Người nền đóng băng ở dáng giây 0; bỏ trống là mọi người ngồi */
  still?: readonly string[];
  extra?: () => Extra3D;
};

const day = () => plainRoom();

export const CANH_3D: Record<string, Canh3D> = {
  "vi-du-3d": { set: day },
};

/** Composition thử bối cảnh: lấy người, ống kính và khung cắt của cảnh `scene`, đổi bối cảnh. Giây cảnh theo khung. */
export type Thu3D = Canh3D & { scene: string };

/** Id composition → bối cảnh thử; nằm trong thư mục `khoi3d` của sidebar Studio. */
export const THU_3D: Record<string, Thu3D> = {};
