import type { GarmentShape } from "./garments";

/** Mảnh vẽ lại từ ảnh mẫu: path viết trong khung `box`, `fitPath` co vào hộp thật */
export interface TracedDef {
  label: string;
  socket: "crown" | "chin" | "hem" | "neck" | "faceAcc";
  box: { w: number; h: number };
  preset: {
    dx?: number;
    dy?: number;
    scale?: number;
    widthScale?: number;
    clip?: boolean;
    clipGrow?: number;
    hideLegs?: boolean;
    layer?: "front" | "under";
  };
  shapes: readonly GarmentShape[];
}
