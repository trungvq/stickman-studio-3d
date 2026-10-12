import type { BROWS, EYES, MOUTHS } from "./face";

/** [góc khớp cha, góc khớp con tương đối] */
export type Limb = [number, number];

/** [hông, gối, dang] — dang chỉ người 3D đọc, docs/01-rig.md#dang-và-nghiêng-ngang */
export type LegAngles = [number, number] | [number, number, number];

/**
 * [vai, khuỷu, cổ tay, dang] — cổ tay chỉ xoay đồ cầm tay, rig không vẽ bàn tay; dang chỉ người 3D
 * đọc, docs/01-rig.md#dang-và-nghiêng-ngang
 */
export type Arm = [number, number, number] | [number, number, number, number];

/** [nghiêng, lắc, gật] — độ; lắc và gật là dịch nét mặt, xem docs/01-rig.md */
export type HeadPose = [number, number, number];

/**
 * Hệ số nhân độ dài từng đoạn chi, hai số một chi theo thứ tự `[tay xa, tay gần, chân xa, chân
 * gần]`, đoạn gốc trước: cánh tay trên rồi cẳng tay, đùi rồi cẳng chân. `1` là dài chuẩn.
 * docs/01-rig.md#vươn-chi
 */
export type Stretch = [number, number, number, number, number, number, number, number];

/** `stretch` trong JSON: bốn số, mỗi số cho cả hai đoạn của một chi, hoặc tám số như `Stretch` */
export type StretchJson = [number, number, number, number] | Stretch;

/** Trải `stretch` của JSON ra tám số */
export const stretchSegs = (s: StretchJson): Stretch =>
  s.length === 8 ? s : [s[0], s[0], s[1], s[1], s[2], s[2], s[3], s[3]];

/** Chiều ngược của `stretchSegs`: chi nào hai đoạn bằng nhau hết thì gọn lại bốn số */
export const stretchJson = (s: Stretch): StretchJson =>
  s[0] === s[1] && s[2] === s[3] && s[4] === s[5] && s[6] === s[7]
    ? [s[0], s[2], s[4], s[6]]
    : [...s];

/** Kênh tay chân đọc được như góc soạn ở `side` cho người 3D (`cast[].world`); kênh không có là giữ 2D */
export const LIFT_CHANNELS = ["af", "an", "lf", "ln"] as const;
export type Lift = Partial<Record<(typeof LIFT_CHANNELS)[number], boolean>>;

/**
 * Đích cổ tay cho IK hai đoạn của người 3D. Trong `Pose` là hệ thân: gốc tâm hông, `[tiến, y, ra
 * ngoài]` đơn vị rig ở `height = 1`, `y` xuống là dương, `ra ngoài` dương về phía chính tay ấy; trong
 * `World.hands` là toạ độ thế giới. `elbow` là hướng khuỷu chĩa tới, cùng hệ (bỏ trống là
 * `REACH_ELBOW` của hệ thân). `w` là phần của đích, `0` là theo góc. docs/01-rig.md#đích-bàn-tay
 */
export interface Reach {
  at: [number, number, number];
  elbow?: [number, number, number];
  w: number;
}

/** Hai kênh tay nhận đích cổ tay */
export const REACH_CHANNELS = ["af", "an"] as const;
export type ReachMap = Partial<Record<(typeof REACH_CHANNELS)[number], Reach>>;

export interface Pose {
  af: Arm;
  an: Arm;
  lf: LegAngles;
  ln: LegAngles;
  torso: number;
  /** Thân nghiêng sang ngang, độ; chỉ người 3D đọc, đi cùng kênh `torso`. docs/01-rig.md#dang-và-nghiêng-ngang */
  lean?: number;
  head: HeadPose;
  stretch: Stretch;
  /** Chỉ người 3D đọc; hành động `authoredAt: "side"` ghi. docs/01-rig.md#người-3d */
  lift?: Lift;
  /** Đích cổ tay hệ thân; chỉ người 3D đọc, người 2D vẽ góc dự phòng của kênh tay */
  reach?: ReachMap;
}

export interface WalkParams {
  /** Nửa tầm vung đùi; đùi giữ lệch ra trước của clip đi */
  hip: number;
  /** Gập gối đỉnh của chân vung */
  knee: number;
  /** Phần chu kỳ mỗi chân chạm đất; trên `0.5` là có lúc hai chân cùng trụ, dưới là có lúc bay */
  stance: number;
  /** Nửa tầm vung vai */
  arm: number;
  /** Gập khuỷu đỉnh, lúc cánh tay vung ra trước */
  elbow: number;
  lean: number;
  /** Gập gối thường trực, cho dáng rón rén; `0` là đi thẳng lưng */
  crouch: number;
  /** Khoảng hở tối thiểu của bàn chân đang vung so với chân trụ (đơn vị rig) */
  clear: number;
  /** Nửa tầm thân cúi theo bước; trung bình vẫn là `lean` */
  dip: number;
}

export interface IdleParams {
  breath: number;
  arm: number;
  lean: number;
}

export type Pt = [number, number];

export type MouthKind = keyof typeof MOUTHS;

export type BrowKind = keyof typeof BROWS;

export type EyeKind = keyof typeof EYES;

/** Nét mặt tại một thời điểm; rời khỏi `Pose`: kiểu nét không nội suy được */
export interface FaceState {
  mouth: MouthKind;
  brow: BrowKind;
  eyes: EyeKind;
  /** Má ửng `0..1` cộng thêm vào `face.blush` của nhân vật; nội suy giữa các mốc, bỏ trống là `0` */
  blush?: number;
}

export type MoustacheKind =
  "none" | "short" | "long" | "pencil" | "chevron" | "handlebar" | "walrus" | "horseshoe";
/** Nếp nhăn: dấu hiệu tuổi tác, vẽ bằng code cùng hệ toạ độ với mắt và mồm */
export type WrinkleKind = "none" | "light" | "deep";
export type HeadShape = "round" | "square" | "trapezoid";

/** Góc nhìn rời rạc; không có góc ở giữa. docs/01-rig.md#góc-nhìn */
export const VIEWS = ["front", "quarter", "side", "rear", "back"] as const;
export type View = (typeof VIEWS)[number];
/** Góc mặc định: chính diện 3/4, mặt lệch theo `face.turn` */
export const DEFAULT_VIEW: View = "quarter";
/** `front` (chính diện thật) và `quarter` (3/4): mảnh vẽ tay lấy hình chính diện, mặt có đủ nét */
export const isFrontal = (v: View) => v === "front" || v === "quarter";
/** Đầu `side` và `rear`: một mắt, một lông mày, mồm cắt ở mép trước */
export const isProfile = (v: View) => v === "side" || v === "rear";
/** Góc nhìn của thân và của đầu; `headOf` kẹp tổ hợp không vẽ được */
export interface Views {
  body: View;
  head: View;
}

/** Thân quay lưng: `rear` hay `back` */
export const isAway = (v: View) => v === "rear" || v === "back";

/**
 * Thân `rear` chỉ có ở thân áo dựng khối (`solid`); thân khác vẽ như `back`. Chưa biết nhân vật thì
 * giữ `rear`, `figureAnchors` kẹp lần cuối. Tổ hợp không vẽ được: thân quay lưng với đầu `front` /
 * `quarter` thành đầu cùng nấc thân, và đầu `back` / `rear` trên thân chưa quay lưng thành `side`
 */
export function clampViews(v: Views, solid = true): Views {
  const body = v.body === "rear" && !solid ? "back" : v.body;
  if (isAway(body) && isFrontal(v.head)) return { body, head: body };
  if (!isAway(body) && isAway(v.head)) return { body, head: "side" };
  return { body, head: v.head };
}

/** Lớp vẽ của cẳng tay so với thân và đầu; cánh tay trên và vai áo không đổi lớp */
export type ArmLayer = "back" | "mid" | "front";

export interface ArmLayers {
  armFar: ArmLayer;
  armNear: ArmLayer;
}

/**
 * Khối của một người mà scene xếp `z` riêng được (`cast[].zParts`). `torso` mang cả bóng tiếp
 * đất, tóc sau và đồ vác lưng; `arm*` là khúc vai→khuỷu, `forearm*` là cẳng tay kèm đồ đang cầm;
 * `leg*` là khúc hông→gối, `shin*` là ống chân. Khúc dưới bỏ trống thì theo khúc trên của nó
 * (`UPPER_OF`). docs/03-scene.md#tách-người-theo-z
 */
export const BODY_PARTS = [
  "legFar",
  "shinFar",
  "legNear",
  "shinNear",
  "torso",
  "armFar",
  "forearmFar",
  "armNear",
  "forearmNear",
  "head",
] as const;
/**
 * Khối người: `BODY_PARTS`, và `lap` — phần váy dựng khối phủ lên đùi của người 3D ngồi, xếp lớp với
 * đồ khối theo khối riêng của nó. `zParts` không xếp được nó. docs/03-scene.md#người-3d
 */
export type BodyPart = (typeof BODY_PARTS)[number] | "lap";
/** Khối khúc dưới → khối khúc trên nó theo khi `zParts` không khai riêng */
export const UPPER_OF: Partial<Record<(typeof BODY_PARTS)[number], (typeof BODY_PARTS)[number]>> = {
  forearmFar: "armFar",
  forearmNear: "armNear",
  shinFar: "legFar",
  shinNear: "legNear",
};

/** Gốc treo người: `feet` là bàn chân thấp hơn chạm `groundY`, `hip` là hông đặt ngay tại `groundY` — người ngồi trên lưng thú. */
export type Root = "feet" | "hip";

/**
 * Độ mịn của hình dựng khối. `draft` làm tròn góc đầu để tóc trúng cache khi phát thời gian thực;
 * `final` chiếu đúng góc từng khung, chỉ cho bản render để đăng — xem docs/02-trang-phuc.md
 */
export type RigQuality = "draft" | "final";
