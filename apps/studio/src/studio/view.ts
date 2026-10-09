import {
  clampViews,
  DEFAULT_VIEW,
  DEFAULT_FACE,
  PIECE_KEYS,
  VIEWS,
  type BrowKind,
  type EquipMap,
  type EyeKind,
  type MouthKind,
  type PieceKey,
  type PoseName,
  type View,
  type Views,
} from "@stickman3d/sketch";

/** Trạng thái sân khấu — không nằm trong JSON nào. Có hành động nạp là chạy, không thì đứng ở `pose`. */
export interface ViewState {
  pose: PoseName;
  travel: boolean;
  flip: boolean;
  /** Nét mặt xem thử; hành động ghi nét nào thì nét đó thắng */
  mouth: MouthKind;
  brow: BrowKind;
  /** `auto` là chớp mắt ngẫu nhiên của studio */
  eyes: EyeKind | "auto";
  /** Hoà từ tư thế nền vào hành động ở đầu lượt, như scene sẽ làm */
  blend: boolean;
  /** Ghim pha để sửa một mốc; `null` là đang chạy */
  scrub: number | null;
  /** Đạo cụ xem thử: độ lệch so với nhân vật như `props[].x` khi `follow`, và vẽ sau người */
  propX: number;
  propBack: boolean;
  /** Người ngồi vào chỗ ngồi của đạo cụ như `cast[].sit`: xe đứng giữa, người treo hông, xe kẹp quanh người */
  propSit: boolean;
  /** Tab Động vật: có dựng người đứng cạnh để so tỉ lệ không, người cách con vật bao xa, và vẽ con vật sau hay trước người */
  compare: boolean;
  animalX: number;
  animalBack: boolean;
  /** Góc nhìn của thân; đầu `auto` là theo thân. Tổ hợp không vẽ được thì `viewsOf` kẹp lại */
  bodyView: View;
  headView: View | "auto";
  /** Đang mặc vật nào ở socket nào — như `cast[].equip` của scene, không ra JSON nhân vật */
  equip: EquipMap;
  /** Lắc và gật xem thử, độ, cộng lên kênh `head` của tư thế đang chạy */
  turn: number;
  nod: number;
  /** Đầu tự lắc gật qua lại theo `t`, cộng thêm lên `turn` / `nod` */
  sway: boolean;
  /** Người 3D (hành động `authoredAt: "side"`): hướng mặt, độ (0 = `+x`, 90 = `−z` về ống kính), và góc cúi ống kính */
  yaw: number;
  pitch: number;
  /** Người 3D tự quay vòng quanh trục đứng */
  spin: boolean;
  /** Hành động 3D chồng dưới hành động đang soạn, như track dưới của scene (`sit-3d` dưới `type-3d`); tên file */
  under: string;
}

/** Góc nhìn đã kẹp — `<Character>` và mọi chỗ đo hộp mảnh phải dùng chung cái này */
export const viewsOf = (v: ViewState): Views =>
  clampViews({ body: v.bodyView, head: v.headView === "auto" ? v.bodyView : v.headView });

export const defaultView = (): ViewState => ({
  pose: "idle",
  travel: false,
  flip: false,
  mouth: DEFAULT_FACE.mouth,
  brow: DEFAULT_FACE.brow,
  eyes: "auto",
  blend: true,
  scrub: null,
  propX: 330,
  propBack: false,
  propSit: false,
  compare: false,
  animalX: 520,
  animalBack: false,
  bodyView: DEFAULT_VIEW,
  headView: "auto",
  equip: {},
  turn: 0,
  nod: 0,
  sway: false,
  yaw: 45,
  pitch: 16,
  spin: false,
  under: "",
});

const isView = (s: string | null): s is View => !!s && (VIEWS as readonly string[]).includes(s);

/** ?pose=shrug&flip=1 — để chụp màn hình thẳng vào một trạng thái */
export function viewFromUrl(base: ViewState): ViewState {
  const q = new URLSearchParams(location.search);
  const v = { ...base };
  const bool = (
    k:
      | "travel"
      | "flip"
      | "blend"
      | "propBack"
      | "propSit"
      | "compare"
      | "animalBack"
      | "sway"
      | "spin",
  ) => {
    const s = q.get(k);
    if (s !== null) v[k] = s === "1" || s === "true";
  };
  bool("travel");
  bool("flip");
  bool("blend");
  bool("propBack");
  bool("propSit");
  bool("compare");
  bool("animalBack");
  bool("sway");
  bool("spin");
  for (const k of ["propX", "animalX", "turn", "nod", "yaw", "pitch"] as const) {
    const n = q.get(k);
    if (n !== null && !Number.isNaN(+n)) v[k] = +n;
  }
  const scrub = q.get("scrub");
  if (scrub !== null) v.scrub = Math.min(1, Math.max(0, +scrub));
  // Ngồi trong xe mà không nói tư thế thì là `sit`, như `cast[].sit` mặc định `base`
  if (v.propSit && !q.get("pose")) v.pose = "sit";
  if (q.get("pose")) v.pose = q.get("pose") as PoseName;
  if (q.get("mouth")) v.mouth = q.get("mouth") as MouthKind;
  if (q.get("brow")) v.brow = q.get("brow") as BrowKind;
  if (q.get("eyes")) v.eyes = q.get("eyes") as ViewState["eyes"];
  const body = q.get("view");
  if (isView(body)) v.bodyView = body;
  const head = q.get("headView");
  if (head === "auto" || isView(head)) v.headView = head;
  const under = q.get("under");
  if (under) v.under = under;
  const equip = q.get("equip");
  if (equip) v.equip = parseEquip(equip);
  return v;
}

/** `?equip=torso:ao-giap,handNear:riu,crown:-` — `-` là để trống socket */
export function parseEquip(s: string): EquipMap {
  const o: EquipMap = {};
  for (const part of s.split(",")) {
    const [k, name] = part.split(":");
    if (PIECE_KEYS.includes(k as PieceKey)) o[k as PieceKey] = name === "-" ? null : name;
  }
  return o;
}
