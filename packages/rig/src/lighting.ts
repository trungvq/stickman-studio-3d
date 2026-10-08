import * as THREE from 'three';
import { PALETTES, setLights as applyRig, setPalette as applyPalette, type LightRig, type PaletteName } from './npr';

/**
 * Giờ trong ngày và bộ đèn đang đặt. Đèn ghép từ cả hai mỗi lần đổi một trong hai, nên sân khấu giữ cặp này cùng `G`
 * và `LIGHTING`: sân khấu khác vẽ xen giữa thì đổi giờ hay đổi đèn vẫn ghép với giờ, đèn của chính nó.
 */
export interface LightState { palette: PaletteName; rig: LightRig }

const state: LightState = { palette: 'day', rig: {} };

/** Giờ trong ngày và bộ đèn hiện tại (của sân khấu đang vẽ) */
export const currentLights = (): Readonly<LightState> => state;

/** Đổi giờ trong ngày: uniform chung `G`, màu trời của `sky`, và vật `userData.lamp` trong `scene` sáng khi có đèn. */
export function setPalette(name: PaletteName, o?: { scene?: THREE.Object3D; sky?: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> }) {
  if (!(name in PALETTES)) throw new Error(`không có bảng màu ${name}`);
  state.palette = name;
  applyPalette(name, o);
}

/**
 * Khai bộ đèn (rig): đèn trần, nắng qua cửa sổ, đèn cục bộ, hộp phòng, bóng tiếp xúc. Ghép với giờ trong ngày của
 * `setPalette` vào uniform chung `G`. Rẻ, gọi lại mỗi khung được khi đèn chạy theo `t`. `setLights()` về ngoài trời.
 */
export function setLights(r: LightRig = {}) {
  state.rig = r;
  applyRig(r);
}

export const captureLights = (): LightState => ({ ...state });

/** Đặt lại cặp giờ/bộ đèn: ghép lại phần đèn của `G` và `LIGHTING` (hộp bóng nắng, đèn rọi, hộp phòng) cho khớp */
export function restoreLights(s: LightState) {
  state.palette = s.palette;
  state.rig = s.rig;
  applyPalette(s.palette);
  applyRig(s.rig);
}
