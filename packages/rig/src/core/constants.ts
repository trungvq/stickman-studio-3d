import type { ArmLayer, ArmLayers, FaceState, HeadPose, Stretch, Views } from "./types";

/** Bảng hằng số ở docs/02-rig.md */
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

export const PAPER = "#f4f1e8";
/** Màu nét mặc định — `palette.line` khởi tạo từ đây; chỗ vẽ ngoài rig đừng gõ lại mã màu */
export const INK = "#1a1a1a";
/**
 * Hai khung sân khấu, chọn bằng `scene.frame`: `wide` cho tập phim, `tall` cho short.
 * Gốc ở giữa khung, `ground` là y của đường đất, `video` là cỡ pixel bản chốt. **Hai khung
 * cùng cao 720 và cùng `ground`**: đổi khung là hẹp bề ngang lại, người vẫn to y hệt và
 * `scale` / `y` / `path` của cảnh cũ đọc nguyên nghĩa. Đơn vị này là toạ độ `viewBox`, không
 * phải pixel — chỗ vẽ phóng lên `video`. docs/03-scene.md#khung-hình
 */
export const FRAMES = {
  wide: { w: 1280, h: 720, ground: 260, video: { w: 1920, h: 1080 } },
  tall: { w: 405, h: 720, ground: 260, video: { w: 1080, h: 1920 } },
} as const;

export type FrameName = keyof typeof FRAMES;
export type FrameSpec = (typeof FRAMES)[FrameName];

/** Khung mặc định (`wide`); `cast[].x` / `y` của một cảnh không khai `frame` tính theo nó */
export const SCENE_CANVAS: FrameSpec = FRAMES.wide;
/** Alpha ở tâm bóng tiếp đất; bóng là màu nét trong suốt để đè lên nền nào cũng được */
export const SHADOW = 0.22;
/** Alpha mặc định của bóng khối (`palette.shade`): màu nét phủ lên, mảnh tối đi còn 70 % */
export const SHADE = 0.3;
/** Nhìn thẳng thì vùng sáng bóp ngang còn `1 − SHADE_RIM`, mỗi bên còn một viền bóng mỏng */
export const SHADE_RIM = 0.06;
/** Vùng sáng dịch về phía mặt bấy nhiêu lần độ trôi nét mặt; bóng phía gáy dày lên theo */
export const SHADE_GAIN = 1;
export const D = Math.PI / 180;

export const NEUTRAL_HEAD: HeadPose = [0, 0, 0];
/** Chi dài chuẩn: mặc định của kênh `stretch`, và là giá trị nền khi hành động không ghi nó */
export const NEUTRAL_STRETCH: Stretch = [1, 1, 1, 1, 1, 1, 1, 1];

export const DEFAULT_FACE: FaceState = { mouth: "closed", brow: "neutral", eyes: "open", blush: 0 };

/**
 * Tóc phẳng không quay theo đầu, nên lắc và gật chỉ dịch nét mặt bấy nhiêu lần nửa trục đầu.
 * Tóc dựng khối thì nét mặt chiếu từ khối sọ theo góc thật. docs/01-rig.md#đầu-và-nét-mặt
 */
export const FACE_YAW = 0.38;
export const FACE_PITCH = 0.5;
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
/** Mặc định của `head.follow` / `head.followBack`: tóc và mũ chỉ trôi theo mặt một chút */
export const HEAD_FOLLOW = 0.1;
/** Mảng sau nằm sau trục lắc nên ngược dấu với mái */
export const HAIR_BACK_FOLLOW = -0.2;
/** Hộp mảnh tóc sau, tính bằng chiều cao đầu — mảng rủ tới ngực */
export const HAIR_BACK_H = 1.8;
/** Hộp mảnh quàng cổ, tính bằng chiều dài thân — treo ở khớp cổ, rủ xuống ngực */
export const NECK_BOX = 0.6;
/** Khoảng cách mắt và khoảng mắt–mồm hẹp lại khi quay đầu, nhưng không được chập vào nhau */
export const FACE_GAP_MIN = 0.45;

/** Góc nhìn mặc định của mọi chỗ vẽ: chính diện 3/4 */
export const QUARTER: Views = { body: "quarter", head: "quarter" };
export const FRONT: Views = { body: "front", head: "front" };
/** Thân `side` chập hai vai và hai hông về trục giữa; hông giữ rộng hơn để đứng yên vẫn thấy hai chân */
export const SIDE_SHOULDER = 0.2;
export const SIDE_HIP = 0.4;
/** Thân áo dựng khối: bề dày trước–sau của khối thân, lần bề ngang ở cùng độ cao */
export const TORSO_DEPTH = 0.78;
/** Thân áo dựng khối nhìn từ hơi cao hơn tầm mắt: điểm quay ra người xem `z` px thì thấp xuống bấy nhiêu lần `z` */
export const TORSO_TILT = 0.25;
/** Váy dựng khối: vải trùm đùi rộng hơn nửa nét chân bấy nhiêu px */
export const SKIRT_EASE = 4;
/** Váy dựng khối: vạt váy ngắn phủ dọc đùi không quá bấy nhiêu phần đùi, váy tới gối thì tới gối (`skirtCover`) */
export const SKIRT_REACH = 0.7;
/** Váy dựng khối: đùi càng ngang thì gấu ở mút đùi rủ xuống thêm bấy nhiêu lần `flare` */
export const SKIRT_FALL = 0.5;
/** Thân áo chưa có hình `side` thì bóp ngang hình chính diện còn bấy nhiêu */
export const SIDE_TORSO = 0.78;
/** Đầu `side`: mắt cách tâm đầu bấy nhiêu lần nửa trục ngang, về phía `+x` */
export const SIDE_EYE = 0.74;
/** Đầu `side`: hình tròn của mắt bóp ngang còn bấy nhiêu, thành oval đứng */
export const SIDE_EYE_OVAL = 0.7;
/** Đầu `side`: tâm mồm cách viền đầu bấy nhiêu lần nửa trục ngang; nửa trước cắt theo viền */
export const SIDE_MOUTH_INSET = 0.08;
/** Râu `chin` ở đầu `side` chỉ vẽ nửa gần; trục giữa của râu lùi vào trong viền đầu bấy nhiêu lần nửa trục, đo ở độ cao mồm */
export const SIDE_CHIN_INSET = 0.08;
/** Kính `side`: càng kính dài bấy nhiêu lần bề ngang hộp, từ tâm mắt kính tới tai */
export const SIDE_GLASSES_ARM = 0.61;
/** Đầu `rear`: mắt cách tâm đầu bấy nhiêu lần nửa trục ngang, về phía `+x` */
export const REAR_EYE = 0.86;
/** Đầu `rear`: mắt và lông mày thu nhỏ còn bấy nhiêu quanh chính chúng */
export const REAR_FACE_SIZE = 0.8;
/** Đầu `rear`: tâm mồm cách viền đầu bấy nhiêu lần nửa trục ngang; chỉ khoé mồm lọt vào trong viền */
export const REAR_MOUTH_INSET = -0.02;
/** Người 3D có tóc dựng khối: nét mặt chiếu thật trên sọ tới góc quay này, quá nữa thì chạy chậm hơn đầu */
export const FACE_TRUE = 40;
/** Người 3D: từ góc quay này nét mặt trượt dần về chỗ chiếu thật, trọn trong `FACE_REAL_SPAN` độ */
export const FACE_REAL_FROM = 95;
export const FACE_REAL_SPAN = 25;
/** Người 3D: mắt lộ dưới phần này bề ngang mắt chính diện (đã trừ phần viền đầu che) thì tắt cả mắt lẫn mày bên ấy */
export const FACE_EYE_MIN = 0.15;
/** Đầu `rear` không có hình tóc riêng: chân tóc trên mặt, trên tâm đầu bấy nhiêu lần nửa trục dọc */
export const REAR_HAIRLINE = 0.52;
/** Đầu `rear` không có hình tóc riêng: mép tóc mai, cách tâm đầu bấy nhiêu lần nửa trục ngang */
export const REAR_TEMPLE = 0.5;
/** Đầu `back`: chỏm tóc phủ từ đỉnh tới đường gáy, tính bằng nửa trục dọc dưới tâm đầu */
export const BACK_NAPE = 0.62;

export const ARM_LAYERS = ["back", "mid", "front"] as const satisfies readonly ArmLayer[];

// Cẳng tay xa phải là `back`: nửa chu kỳ đi khuỷu tay xa nằm trong khối thân
export const DEFAULT_LAYERS: ArmLayers = { armFar: "back", armNear: "front" };

export const ARM_LAYER_LABELS: Record<ArmLayer, string> = {
  back: "sau — dưới khối thân",
  mid: "giữa — trên thân áo, dưới đầu",
  front: "trước — trên đầu",
};
