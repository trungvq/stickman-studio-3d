import type { ReactNode } from "react";
import { type CameraShot, type Lens, SCENE_Z } from "@stickman3d/sketch";
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
  /** Mốc trên người / thú của cảnh — component sâu bên trong không cầm `ctx` thì đọc `SceneAnchor` */
  anchor: FxAnchor;
}

/** Chỗ đứng mà `place` được hỏi — `sceneAt`, `propAt` và `animalAt` đều trả hai trường này */
export interface Spot {
  x: number;
  groundY: number;
}

/** Nghiêng cả người quanh một điểm sân khấu: độ theo chiều SVG */
export interface Spin {
  deg: number;
  x: number;
  y: number;
}

/**
 * Phần lệch `place` trả: cộng thẳng vào `x` / `groundY`. `spin` và `ring` chỉ có ở người;
 * `ring` nhận hai bàn chân đã cộng phần lệch và `scale` của người ấy. docs/10-lop-ve-code.md
 */
export interface Offset {
  dx: number;
  dy: number;
  spin?: Spin;
  ring?: (feet: { x: number; y: number }[], scale: number) => ReactNode;
}

/** Một lớp vẽ code của repo video; `CODE_LAYERS` là mảng của chúng, thứ tự mảng là thứ tự vẽ khi hoà `z` */
export interface CodeLayer {
  /** Để đọc lỗi và làm `key` của React */
  name: string;
  /** Tên cảnh (`scene.name`) bật lớp này */
  scenes: Set<string> | readonly string[];
  /** Nấc trên trục `z` của `back` / `front`; bỏ trống là `SCENE_Z.fxBack` / `SCENE_Z.fxFront` */
  z?: { back?: number; front?: number };
  /** Vẽ cả bối cảnh thay chồng `scene.bg[]`, vạch đất tắt theo; nhiều lớp cùng khai thì lớp đứng trước thắng */
  bg?: (ctx: LayerCtx) => ReactNode;
  back?: (ctx: LayerCtx) => ReactNode;
  front?: (ctx: LayerCtx) => ReactNode;
  /** Rung cả khung; nhiều lớp thì cộng dồn */
  shake?: (ctx: LayerCtx) => { dx: number; dy: number } | null | undefined;
  /**
   * Đồ khối của cảnh có `scene.lens`: vẽ chung một lượt với người khai `cast[].world`, thứ tự che
   * từng mảnh đồ và từng phần người suy từ hình học mỗi khung. docs/10-lop-ve-code.md#đồ-khối
   */
  solids?: (ctx: LayerCtx) => SolidItem[];
  /** Đẩy chỗ đứng của một `id`; mỗi lớp thấy `spot` đã cộng phần lệch của lớp trước */
  place?: (ctx: LayerCtx, id: string, spot: Spot) => Offset | null | undefined;
}

/** Cảnh nào bật một lớp: `Set` hay mảng tên cảnh, cùng nghĩa */
export const layerCovers = (layer: Pick<CodeLayer, "scenes">, name: string): boolean =>
  layer.scenes instanceof Set ? layer.scenes.has(name) : layer.scenes.includes(name);

/**
 * Nấc `z` của các chỗ móc `back` / `front` mà cảnh `name` bật — đúng số `SceneWorld` xếp lên trục
 * chung. `sceneZProblems` của rig nhận để biết lớp code nào kẹp giữa hai lượt của `zParts`.
 */
export const layerZs = (
  layers: readonly Pick<CodeLayer, "scenes" | "z" | "back" | "front">[],
  name: string,
): number[] =>
  layers
    .filter((l) => layerCovers(l, name))
    .flatMap((l) => [
      ...(l.back ? [l.z?.back ?? SCENE_Z.fxBack] : []),
      ...(l.front ? [l.z?.front ?? SCENE_Z.fxFront] : []),
    ]);
