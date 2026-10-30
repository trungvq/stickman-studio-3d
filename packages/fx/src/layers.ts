import type { ReactNode } from "react";
import type { CameraShot, Lens } from "@stickman3d/rig/core";
import type { FxAnchor } from "./anchor";
import type { SolidItem } from "./solid";

/**
 * Cái mọi chỗ móc nhận: tên cảnh, giây cảnh, khung camera tại giây ấy, bảng mốc có tên của
 * cảnh, và ảnh của một file trong `pieces/`
 */
export interface LayerCtx {
  name: string;
  t: number;
  cam: CameraShot;
  /** `scene.marks` — lớp neo theo `marks["nui-dang"]`, không ghim số, để `retime` kéo cả lớp đi theo */
  marks: Record<string, number>;
  url: (file: string) => string | undefined;
  /** `scene.lens` — ống kính 3D của cảnh, nếu có */
  lens?: Lens;
  /** Mốc trên người của cảnh — component sâu bên trong không cầm `ctx` thì đọc `SceneAnchor` */
  anchor: FxAnchor;
}

/** Một lớp vẽ code của repo video; `CODE_LAYERS` là mảng của chúng, thứ tự mảng là thứ tự vẽ khi hoà `z` */
export interface CodeLayer {
  /** Để đọc lỗi và làm `key` của React */
  name: string;
  /** Tên cảnh (`scene.name`) bật lớp này */
  scenes: Set<string> | readonly string[];
  /** Nấc trên trục `z` của `back` / `front`; bỏ trống là `SCENE_Z.fxBack` / `SCENE_Z.fxFront` */
  z?: { back?: number; front?: number };
  /** Vẽ cả bối cảnh thay chồng `scene.bg[]`; nhiều lớp cùng khai thì lớp đứng trước thắng */
  bg?: (ctx: LayerCtx) => ReactNode;
  back?: (ctx: LayerCtx) => ReactNode;
  front?: (ctx: LayerCtx) => ReactNode;
  /** Rung cả khung; nhiều lớp thì cộng dồn */
  shake?: (ctx: LayerCtx) => { dx: number; dy: number } | null | undefined;
  /**
   * Đồ khối của cảnh có `scene.lens`: `check` và `scene_probe` đo người 3D lồng vào chúng, không chỗ
   * nào vẽ chúng. docs/10-lop-ve-code.md#đồ-khối
   */
  solids?: (ctx: LayerCtx) => SolidItem[];
}

/** Cảnh nào bật một lớp: `Set` hay mảng tên cảnh, cùng nghĩa */
export const layerCovers = (layer: Pick<CodeLayer, "scenes">, name: string): boolean =>
  layer.scenes instanceof Set ? layer.scenes.has(name) : layer.scenes.includes(name);
