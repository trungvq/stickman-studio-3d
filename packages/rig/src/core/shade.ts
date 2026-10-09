import { SHADE_GAIN, SHADE_RIM } from "./constants";

/**
 * Vùng sáng của một mảnh là chính hình bao của nó bóp ngang quanh `cx` rồi dịch về phía mặt;
 * phần còn lại của mảnh là bóng khối. `faceDx` là độ trôi nét mặt so với tâm đầu (`+x` là
 * phía nhân vật nhìn). Trả về `transform` đặt lên bản sao hình bao. docs/01-rig.md#bóng-khối
 */
export const litTransform = (cx: number, faceDx: number) =>
  `translate(${cx + faceDx * SHADE_GAIN} 0) scale(${1 - SHADE_RIM} 1) translate(${-cx} 0)`;

/** Bề dày bóng ở hai mép ngang của một mảnh nửa rộng `hw`: `[phía gáy, phía mặt]`, không âm */
export const shadeBands = (hw: number, faceDx: number): [number, number] => {
  const rim = SHADE_RIM * hw;
  const shift = SHADE_GAIN * faceDx;
  return [Math.max(0, rim + shift), Math.max(0, rim - shift)];
};
