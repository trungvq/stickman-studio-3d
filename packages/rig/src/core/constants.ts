import type { FaceState, HeadPose, Stretch } from "./types";

/** Bảng hằng số ở docs/01-rig.md */
export const RIG = {
  torso: 120,
  neck: 8,
  headH: 130,
  upperArm: 62,
  foreArm: 58,
  thigh: 78,
  shin: 92,
  stroke: 12,
  footY: 170,
} as const;

/** Đơn vị rig trong một mét: người cao 428 ≈ 1,71 m. docs/01-rig.md */
export const RIG_PER_METRE = 250;

export const PAPER = "#f4f1e8";
/** Màu nét mặc định — `palette.line` khởi tạo từ đây; chỗ vẽ ngoài rig đừng gõ lại mã màu */
export const INK = "#1a1a1a";
/**
 * Hai khung sân khấu, chọn bằng `scene.frame`: `wide` cho tập phim, `tall` cho short.
 * Gốc ở giữa khung, `video` là cỡ pixel bản chốt. **Hai khung cùng cao 720**: đổi khung là
 * hẹp bề ngang lại, người vẫn to y hệt. Đơn vị này là toạ độ `viewBox`, không phải pixel — chỗ
 * vẽ phóng lên `video`. docs/03-scene.md#khung-hình
 */
export const FRAMES = {
  wide: { w: 1280, h: 720, video: { w: 1920, h: 1080 } },
  tall: { w: 405, h: 720, video: { w: 1080, h: 1920 } },
} as const;

export type FrameName = keyof typeof FRAMES;
export type FrameSpec = (typeof FRAMES)[FrameName];

/** Khung mặc định (`wide`) của cảnh không khai `frame` */
export const SCENE_CANVAS: FrameSpec = FRAMES.wide;
export const D = Math.PI / 180;

export const NEUTRAL_HEAD: HeadPose = [0, 0, 0];
/** Chi dài chuẩn: mặc định của kênh `stretch`, và là giá trị nền khi hành động không ghi nó */
export const NEUTRAL_STRETCH: Stretch = [1, 1, 1, 1, 1, 1, 1, 1];

export const DEFAULT_FACE: FaceState = { mouth: "closed", brow: "neutral", eyes: "open", blush: 0 };

/** Lông mày cao hơn mắt bấy nhiêu px khi nhìn thẳng */
export const BROW_ABOVE = 18;
/** Góc quay của nấc `rear`: đầu cho tóc dựng khối, thân cho thân áo dựng khối; `side` là 90, `back` là 180 */
export const REAR_YAW = 120;
/** Tóc dựng khối rủ: kinh độ mép trước mảng rủ hai bên, ở thái dương */
export const SCULPT_HANG_FROM = 75;
/** Tóc dựng khối rủ: đuôi tóc xoè ra khỏi trục dọc qua tâm đầu bấy nhiêu lần bán kính sọ */
export const SCULPT_FLARE = 0.08;
/** Tóc dựng khối rủ: xoè, uốn và sóng theo chiều trước–sau bằng bấy nhiêu phần chiều ngang */
export const SCULPT_DEPTH = 0.4;
/** Tóc dựng khối rủ: tới đuôi, phần trước mặt phẳng qua hai tai co về nó bấy nhiêu phần */
export const SCULPT_TUCK = 0.7;
/** Tóc dựng khối rủ: vỏ ở chỗ rời sọ co về mặt phẳng qua hai tai bấy nhiêu phần, hết co ở vĩ độ 40° */
export const SCULPT_TEMPLE = 0.45;
/** Mái lệch: quá `bangTo` bấy nhiêu độ thì bề dày mép mái mỏng hết */
export const SCULPT_BANG_TIP = 22;
/** Thân áo dựng khối: bề dày trước–sau của khối thân, lần bề ngang ở cùng độ cao */
export const TORSO_DEPTH = 0.78;
/** Váy dựng khối: vải trùm đùi rộng hơn nửa nét chân bấy nhiêu px */
export const SKIRT_EASE = 4;
/** Váy dựng khối: vạt váy ngắn phủ dọc đùi không quá bấy nhiêu phần đùi, váy tới gối thì tới gối (`skirtCover`) */
export const SKIRT_REACH = 0.7;
/** Váy dựng khối: đùi càng ngang thì gấu ở mút đùi rủ xuống thêm bấy nhiêu lần `flare` */
export const SKIRT_FALL = 0.5;
/** Vạt dài, tạp dề: đùi lệch phương đứng dưới góc đầu (độ) thì vạt phủ đủ ống chân, quá góc sau thì chỉ tới gối */
export const HEM_HANG = [35, 70] as const;
/** Tạp dề nằm cách mặt người và đồ bên dưới bấy nhiêu px */
export const APRON_LIFT = 5;
/** Đầu `side`: mắt cách tâm đầu bấy nhiêu lần nửa trục ngang, về phía `+x` */
export const SIDE_EYE = 0.74;
/** Đầu `side`: hình tròn của mắt bóp ngang còn bấy nhiêu, thành oval đứng */
export const SIDE_EYE_OVAL = 0.7;
/** Đầu `rear`: mắt cách tâm đầu bấy nhiêu lần nửa trục ngang, về phía `+x` */
export const REAR_EYE = 0.86;
/** Người 3D có tóc dựng khối: nét mặt chiếu thật trên sọ tới góc quay này, quá nữa thì chạy chậm hơn đầu */
export const FACE_TRUE = 40;
/** Người 3D: từ góc quay này nét mặt trượt dần về chỗ chiếu thật, trọn trong `FACE_REAL_SPAN` độ */
export const FACE_REAL_FROM = 95;
export const FACE_REAL_SPAN = 25;
/** Đích theo mốc còn cách điểm bàn tay quá ngần này (rig, nhân `world.s`) thì `check` báo */
export const AIM_GAP = 6;
