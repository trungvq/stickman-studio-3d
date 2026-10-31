import type { BROWS, EYES, MOUTHS } from "./face";
import type { Aim, ReachSpline, ReachTerm } from "./bodyMark";
import type { ReachHold } from "./heldItem";

/** [góc khớp cha, góc khớp con tương đối] */
export type Limb = [number, number];

/** [hông, gối, dang] — dang chỉ người 3D đọc, docs/01-rig.md#dang-và-nghiêng-ngang */
export type LegAngles = [number, number] | [number, number, number];

/**
 * [vai, khuỷu, cổ tay, dang, xoắn vai] — cổ tay xoay đồ cầm tay, ở người 3D là lệch bàn tay trong mặt phẳng
 * khuỷu; dang và xoắn vai chỉ người 3D đọc, docs/01-rig.md#dang-và-nghiêng-ngang, docs/01-rig.md#xoắn-tay
 */
export type Arm =
  | [number, number, number]
  | [number, number, number, number]
  | [number, number, number, number, number];

/** [nghiêng, lắc, gật] — độ; lắc và gật là dịch nét mặt, xem docs/01-rig.md */
export type HeadPose = [number, number, number];

/**
 * Hệ số nhân độ dài từng đoạn chi, hai số một chi theo thứ tự `[tay trái, tay phải, chân trái, chân
 * phải]`, đoạn gốc trước: cánh tay trên rồi cẳng tay, đùi rồi cẳng chân. `1` là dài chuẩn.
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

/** Kênh tay chân đọc được như góc soạn ở `side` cho người 3D (`cast[].world`); kênh không có cờ là kênh không nâng */
export const LIFT_CHANNELS = ["al", "ar", "ll", "lr"] as const;
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
  /** Phần của hướng `elbow` (vắng là `1`), phần còn lại là khuỷu ưu tiên: đoạn giữa mốc khai `elbow` và mốc không khai */
  elbowW?: number;
  /** Phần khoá khuỷu của `world.hands` (`elbowLock`): `1` là khuỷu nằm đúng hướng `elbow`, không dò xoay khuỷu */
  elbowLock?: number;
  w: number;
  /**
   * Đích theo mốc hay theo điểm khác cổ tay (`ReachTerm`): người 3D giải thành cổ tay mỗi khung (`resolveActing`), `at`
   * khi ấy chỉ là chỗ ước lượng trên người mẫu cho góc suy từ đích (`reachAngles`). docs/01-rig.md#đích-theo-mốc
   */
  terms?: ReachTerm[];
  /** Đoạn `ease: "auto"` của `world.hands`: người 3D giải cổ tay theo đây, `terms` chỉ còn là đích ước lượng */
  spline?: ReachSpline;
  /** Lòng tay theo ý định của `world.hands`: đè bàn tay của hành động theo phần `w` */
  aim?: Aim;
  /** Món đang cầm (`world.hands[].hold`): bậc thang, không nội suy */
  hold?: ReachHold;
}

/** Hai kênh tay nhận đích cổ tay */
export const REACH_CHANNELS = ["al", "ar"] as const;
export type ReachMap = Partial<Record<(typeof REACH_CHANNELS)[number], Reach>>;

export interface Pose {
  al: Arm;
  ar: Arm;
  ll: LegAngles;
  lr: LegAngles;
  torso: number;
  /** Thân nghiêng sang ngang, độ; chỉ người 3D đọc, đi cùng kênh `torso`. docs/01-rig.md#dang-và-nghiêng-ngang */
  lean?: number;
  head: HeadPose;
  stretch: Stretch;
  /** Chỉ người 3D đọc; hành động `authoredAt: "side"` ghi. docs/01-rig.md#người-3d */
  lift?: Lift;
  /** Đích cổ tay hệ thân; người 3D giải IK tới đây, kênh tay của `pose` mang góc suy từ đích */
  reach?: ReachMap;
  /** Bàn tay theo `HAND_DOF`: xoay cẳng tay, gập cổ tay, góc ngón; chỉ người 3D mặc đồ đọc. docs/01-rig.md#bàn-tay */
  hand?: HandMap;
  /**
   * Lòng tay, ngón theo ý định (`palm`, `fingers` của `keys[].hand`): người 3D giải ra xoay và gập cổ tay, đè hai số đầu
   * của `hand` ở kênh ấy. docs/01-rig.md#hướng-lòng-tay-theo-ý
   */
  aim?: AimMap;
  /**
   * Kênh tay đến từ clip soi gương (`clips[].mirror`): người 3D giải hai tay theo thứ tự của hành động, tay trái (kênh
   * `armRight` của hành động) trước
   */
  mirror?: boolean;
}

/** Bàn tay theo ý định của hai kênh tay */
export type AimMap = Partial<Record<(typeof REACH_CHANNELS)[number], Aim>>;

/** Bàn tay của hai kênh tay, số theo `HAND_DOF`; kênh không có là `HAND_REST` */
export type HandMap = Partial<Record<(typeof REACH_CHANNELS)[number], readonly number[]>>;

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

/** Nếp nhăn: dấu hiệu tuổi tác, vẽ bằng code cùng hệ toạ độ với mắt và mồm */
export type WrinkleKind = "none" | "light" | "deep";

/**
 * Khối của một người 3D mà `check` đo va chạm: `arm*` là khúc vai→khuỷu, `forearm*` là cẳng tay,
 * `leg*` là khúc hông→gối, `shin*` là ống chân.
 */
export const BODY_PARTS = [
  "legLeft",
  "shinLeft",
  "legRight",
  "shinRight",
  "torso",
  "armLeft",
  "forearmLeft",
  "armRight",
  "forearmRight",
  "head",
] as const;
export type BodyPart = (typeof BODY_PARTS)[number];
