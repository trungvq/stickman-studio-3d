import { z } from "zod";
import {
  ACTION_VERSION,
  ARM_CHANNELS,
  CHANNELS,
  easeAt,
  EASE_NAMES,
  JOINT_CHANNELS,
  PoseDeltaSchema,
  actionDelta,
  actionReach,
  mixReach,
  actionEquip,
  actionEvents,
  actionAirborne,
  actionKind,
  actionMask,
  animalActionDelta,
  animalActionFace,
  animalActionMask,
  animalActionPose,
  animalDeltaPose,
  equipSockets,
  actionFace,
  actionAim,
  actionHand,
  keyAim,
  mixAim,
  reachTerm,
  actionLayers,
  actionPose,
  composeFace,
  composeLayers,
  composePose,
  deltaPose,
  smoothstep,
  type ActionData,
  type Channel,
} from "./action";
import type { Root } from "./types";
import {
  actHandAt,
  actHeld,
  bones3,
  cladHand,
  head3,
  markAt,
  trunk3,
  type ActCharacter,
  type ActInput,
  type Trunk3,
} from "./act3";
import { AIM_BEND, AIM_DEV, clampRange, TURN_MAX } from "./arm3";
import {
  armInput,
  armSeg,
  evalPhi,
  phiAt,
  solvePhi,
  type ArmInput,
  type ArmSeg,
  type ArmSol,
} from "./graspArm";
import {
  checkChoice,
  checkGroup,
  choiceWarnings,
  GRIP_GROUPS,
  groupIntent,
  groupNeeds,
  holdDefaults,
  variantOf,
} from "./graspGroups";
import {
  chooseMissing,
  edgeOk,
  graspCtx,
  graspFrame,
  handFromItem,
  LATER_SPAN,
  type GraspChoice,
  type GraspCtx,
  type GraspLater,
  type GraspOpts,
  type GraspSolution,
} from "./graspSolve";
import { axialAt, handDims, itemGeom, type Feature, type HandDims } from "./heldGeom";
import {
  AimDirSchema,
  BODY_MARKS,
  isOtherHand,
  PALM_DIRS,
  ReachPointSchema,
  type Aim,
  type AimTerm,
  type BodyMark,
} from "./bodyMark";
import {
  AxisIntentSchema,
  IntentTargetSchema,
  heldAxis,
  groupHold,
  heldBase,
  heldPoint,
  HOLD_BLEND,
  HOLD_SLEW_STEP,
  mixRotation,
  rotAxis,
  SceneHoldSchema,
  sceneHoldRef,
  type AxisIntent,
  type HeldItemSpec,
  type HoldAim,
  type HoldAxis,
  type HoldGrasp,
  type HoldTarget,
  type IntentTarget,
  type PlacedSolve,
  type WasSolve,
  type ReachHold,
  type SceneHold,
  type SceneHoldGroup,
} from "./heldItem";
import {
  ANIMAL_ANCHOR_NAMES,
  ANIMAL_CHANNELS,
  ANIMAL_JOINT_CHANNELS,
  ANIMAL_LEG_CHANNELS,
  DEFAULT_ANIMAL_FACE,
  type AnimalChannel,
  type AnimalData,
  type AnimalFace,
  type AnimalPose,
} from "./animals";
import {
  animalAnchorOf,
  animalFeet,
  animalHang,
  animalStand,
  composeAnimalPose,
  computeAnimalFigure,
  type AnimalFigure,
} from "./animalGeometry";
import {
  BLEND_MAX,
  BLEND_MIN,
  blendAnimalDuration,
  blendAnimalPose,
  blendDuration,
  blendFace,
  blendLayers,
  blendPose,
} from "./blend";
import { shapeBound, type CarryRef } from "./heldCarry";
import { isCarryHold, supportChoice, supportGroup } from "./holdLink";
import { D, FRAMES, RIG, type FrameName, type FrameSpec } from "./constants";
import { feet, lengths, type Legs } from "./geometry";
import { BODY3, dirOf, facing, feet3, viewOfTheta, type Body3, type World } from "./figure3d";
import {
  add3,
  cross3,
  dot3,
  fromColumns,
  matMul,
  matVec,
  project,
  scale3,
  sub3,
  scaleAt,
  type Lens,
  type M3,
  type V3,
} from "./lens";
import { POSES, POSE_NAMES } from "./poses";
import { propSeat, type PropData } from "./props";
import {
  EquipSchema,
  composeEquip,
  defaultCharacter,
  equipCharacter,
  equipSteps,
  limbWidths,
  wornPalette,
  type CharacterData,
  type Equip,
  type EquipStep,
} from "./schema";
import {
  bakeFeetTravel,
  bakeTravel,
  nextBearing,
  standing,
  travelAt,
  TRAVEL_STEP,
  type TravelTable,
} from "./travel";
import {
  BODY_PARTS,
  UPPER_OF,
  DEFAULT_VIEW,
  VIEWS,
  clampViews,
  LIFT_CHANNELS,
  REACH_CHANNELS,
  type ArmLayers,
  type Reach,
  type BodyPart,
  type FaceState,
  type LegAngles,
  type Pose,
  type View,
} from "./types";

/** Bump khi đổi hình dạng JSON scene; `migrateScene` phải có nhánh tương ứng. */
export const SCENE_VERSION = 30;

/** `"@ten"` hay `"@ten+0.4"` / `"@ten-1"`: một mốc có tên trong `scene.marks` cộng phần lệch giây */
export const MARK_REF = /^@([A-Za-z0-9_-]+)(?:\s*([+-])\s*(\d+(?:\.\d+)?))?$/;
export type MarkRef = `@${string}`;
const MarkRefSchema = z
  .string()
  .regex(MARK_REF, "mốc có tên viết `@ten`, `@ten+0.4` hay `@ten-1`") as z.ZodType<MarkRef>;
/**
 * Một giây trên timeline scene: số, hay tham chiếu tới một mốc có tên. `resolveScene` giải
 * ra số qua `unmarkScene`; JSON giữ nguyên tham chiếu nên dời mốc là sửa **một** số ở `marks`.
 * docs/03-scene.md#mốc-có-tên
 */
const time = () => z.union([z.number().min(0), MarkRefSchema]);

/**
 * Một mốc camera. `x`/`y` là tâm khung trong hệ toạ độ sân khấu, `zoom` là hệ số phóng
 * (`1` là đúng khung sân khấu của rig). `move` nói **cách vào mốc này**: `cut` giữ nguyên
 * mốc trước rồi nhảy — đó là mặc định, vì cắt nói đúng ngần ấy mà tốn `0` giây. docs/03-scene.md
 */
const CameraKeySchema = z.object({
  t: time().describe("Giây trên timeline scene, hay `@mốc`"),
  x: z.number().default(0),
  y: z.number().default(0),
  zoom: z.number().positive().default(1),
  move: z.enum(["cut", "linear", "ease"]).default("cut"),
});

/**
 * Một lớp nền. `scale` là bề ngang so với khung sân khấu (`1` là phủ đúng bề ngang),
 * `x`/`y` là tâm ảnh. `aspect` đo từ chính file lúc nạp — số trong JSON chỉ là cái đệm của
 * lần đo trước. docs/03-scene.md#nền
 */
const BgLayerSchema = z.object({
  file: z.string().min(1).describe("Ảnh trong `assets/bg/` của repo video"),
  x: z.number().default(0),
  y: z.number().default(0),
  scale: z.number().positive().default(1),
  aspect: z
    .number()
    .positive()
    .default(16 / 9),
  /**
   * Nấc xếp lớp **giữa các lớp nền**; nhỏ là ở sau. Bỏ trống là `SCENE_Z.bg` cộng thứ tự
   * mảng. Nền chưa vào trục chung của `sceneOrder` nên số lớn hơn băng nền không đưa được
   * lớp ấy ra trước người. docs/03-scene.md#trục-z
   */
  z: z.number().optional(),
  /**
   * Hệ số trôi theo camera: `1` là dán vào sân khấu (mặc định), `0` là dán vào khung máy
   * quay nên đứng im trên màn hình, nhỏ hơn `1` là ở xa nên trôi chậm hơn. docs/03-scene.md#nền
   */
  parallax: z.number().min(0).default(1),
  /**
   * Lát ngang khi camera lia ra ngoài bề rộng tấm: `none` là đúng một tấm (mặc định),
   * `tile` chép xuôi, `mirror` lật gương ô lẻ nên mép nối trùng khít. docs/03-scene.md#nền
   */
  repeat: z.enum(["none", "tile", "mirror"]).default("none"),
  /**
   * Chặn trên số ô của một khung; số ô thật suy từ hộp camera ở `bgTiles`. Chỉ để một tấm
   * hẹp gặp camera zoom rộng không đẻ ra nghìn ô. docs/03-scene.md#nền
   */
  tiles: z.number().int().min(1).max(512).default(32),
});

/** Một lần đặt một file hành động lên track. Không có độ dài: clip sau nói hộ. */
const ClipSchema = z.object({
  /** Tên hành động; bỏ trống là clip rỗng — nhả track về `base` */
  action: z.string().optional(),
  start: time().describe("Giây trên timeline scene, hay `@mốc`"),
  cycle: z
    .number()
    .positive()
    .optional()
    .describe("Giây cho một lượt t: 0 → 1; đè `duration` của file hành động"),
  /**
   * Cách khai nhịp thứ hai: tốc độ trôi ngang mong muốn, đơn vị scene mỗi giây cho người
   * `height = 1` — rig suy `cycle` từ sải chân của chính hành động (`actionStride`) nhân
   * `scale` của người. Không đi cùng `cycle`. docs/03-scene.md
   */
  speed: z
    .number()
    .positive()
    .optional()
    .describe(
      "Đơn vị scene mỗi giây; rig suy `cycle` từ sải chân của hành động, không khai cùng `cycle`",
    ),
  phase: z
    .number()
    .default(0)
    .describe("Pha lúc bắt đầu, tỉ lệ chu kỳ 0–1 (không phải giây); để hai người đi lệch bước"),
  mask: z
    .array(z.enum(CHANNELS))
    .optional()
    .describe("Thu hẹp `mask` của file cho riêng lần đặt này; nới rộng là lỗi"),
  /**
   * Đổi đồ ngay ở `start` của clip này — công tắc, giữ nguyên qua clip sau như mọi
   * `equip` khác. Chỗ để mốc đổi tay là **một con số trong scene**, không phải một file
   * hành động rỗng cho mỗi lần trao. docs/03-scene.md
   */
  equip: EquipSchema.optional(),
  blend: z
    .number()
    .min(0)
    .optional()
    .describe(
      `Giây hoà từ tư thế đang có sang clip này; 0 là cắt cứng; bỏ trống thì tự suy từ độ lệch tư thế, trong [${BLEND_MIN}, ${BLEND_MAX}]`,
    ),
  /** Như `snap` của hành động, cho riêng lần đặt này. docs/03-scene.md#giật-trên-hình */
  snap: z
    .boolean()
    .optional()
    .describe(
      "Cố ý giật (cắt cứng, giật mình): `check` không đo giật ở kênh clip ghi suốt lúc nó chạy, kể cả đoạn hoà vào và ra",
    ),
});

const TrackSchema = z.object({
  name: z.string().optional(),
  clips: z.array(ClipSchema).min(1),
});

/** Một mốc đường đi; `t` là giây scene, trường bỏ trống lấy `x`/`y`/`scale` của `cast` */
const PathKeySchema = z.object({
  t: time(),
  x: z.number().optional(),
  y: z.number().optional(),
  scale: z.number().positive().optional(),
  /** Vào mốc này theo smoothstep thay vì thẳng */
  ease: z.boolean().default(false),
});

/** Một mốc mờ dần; `v` là độ đục 0–1 */
const FadeKeySchema = z.object({
  t: time(),
  v: z.number().min(0).max(1),
});

/** Một mốc đổi hướng; `v` là `flip` kể từ giây `t` */
const FlipKeySchema = z.object({
  t: time(),
  v: z.boolean(),
});

/** Một mốc đổi góc nhìn; `v` là góc kể từ giây `t` */
const ViewKeySchema = z.object({
  t: time(),
  v: z.enum(VIEWS),
});
const ViewTrackSchema = z.union([z.enum(VIEWS), z.array(ViewKeySchema).min(1)]);

/**
 * Một con vật đang bị xách hay ôm: vẽ trong khung cổ tay của `socket`, cùng lớp với cẳng
 * tay ấy. `anchor` là điểm nào của con vật đặt vào tay, `dx`/`dy` dời thêm trong khung
 * cổ tay (đơn vị rig của người), `rotate` xoay quanh đó theo chiều rig — gà xách ngược
 * chân lên thì `anchor: "hip"`, `rotate: 180`. docs/03-scene.md#động-vật
 */
const CarrySchema = z.object({
  /** `id` trong `animals[]` */
  animal: z.string().min(1),
  socket: z.enum(["handNear", "handFar"]).default("handNear"),
  anchor: z.enum(ANIMAL_ANCHOR_NAMES).default("hip"),
  dx: z.number().default(0),
  dy: z.number().default(0),
  rotate: z.number().default(0),
  /** Lật ngược so với người xách */
  flip: z.boolean().default(false),
});

const V3Schema = z.tuple([z.number(), z.number(), z.number()]);

/**
 * Mốc chỗ đặt người 3D: `at` toạ độ thế giới — ngồi (`sit`) thì là điểm trên mặt ngồi ngay dưới
 * khớp hông, không thì điểm sàn dưới hông —, `yaw` độ quanh trục đứng (0 là mặt hướng +x, 90 là
 * −z). `path` là chỗ người phải ở theo thời gian (`ease` thì êm): đứng thì hông suy từ bàn chân
 * trụ, nhịp chân co giãn cho kịp; đoạn có mốc ngồi thì hông nội suy. `steps` là số nhịp bước của cú
 * quay tại chỗ kết thúc ở mốc này. docs/03-scene.md#đi-theo-path
 */
const WorldKeySchema = z.object({
  t: time(),
  at: V3Schema,
  yaw: z.number().default(0),
  sit: z.boolean().default(false),
  ease: z.boolean().default(false),
  steps: z.number().int().min(1).optional(),
});

/**
 * Đích một bàn tay trong thế giới: `at` toạ độ thế giới, hay mốc thân `to` trên chính người ấy (`side`, `offset` như đích
 * của hành động); `point` là điểm bàn tay đặt vào đích (thiếu là cổ tay với `at`, lòng tay với `to`; `item:<mốc>` là mốc
 * của món đang cầm); `elbow` hướng khuỷu (bỏ trống là mặc định hệ thân). `palm` / `fingers` / `bend` khai lòng tay theo ý
 * định, đè bàn tay của hành động theo phần đích. `hold` là chỗ cầm từ mốc này (`món@nhóm` hay `{ item, group, … }`,
 * `null` là buông): mốc chỉ có `hold` thì vị trí lấy từ hành động. docs/03-scene.md#đích-bàn-tay-thế-giới
 */
const HandSchema = z
  .object({
    at: V3Schema.optional(),
    to: z.enum(BODY_MARKS).optional(),
    side: z.enum(["same", "other"]).optional(),
    offset: V3Schema.optional(),
    point: ReachPointSchema.optional(),
    elbow: V3Schema.optional(),
    palm: AimDirSchema.optional(),
    fingers: AimDirSchema.optional(),
    bend: z.number().min(-90).max(90).optional(),
    hold: SceneHoldSchema.nullable().optional(),
  })
  .refine((h) => (h.hold !== undefined ? !(h.at && h.to) : !!h.at !== !!h.to), {
    message: "đích bàn tay cần đúng một trong `at` (toạ độ thế giới) hay `to` (mốc thân)",
  })
  .refine((h) => !h.hold || (!h.palm && !h.fingers && h.bend === undefined), {
    message: "mốc có `hold` thì hướng tay do ý định của món quyết — bỏ `palm`, `fingers`, `bend`",
  })
  .refine((h) => !!h.to || (h.side === undefined && h.offset === undefined), {
    message: "`side`, `offset` chỉ đi với `to`",
  });

/**
 * Mốc đích cổ tay thế giới: tay phải, tay trái của người (giải phẫu, không theo gần / xa), `null` là
 * thả tay về góc của hành động. Giữa hai mốc nhắc một tay thì đích và phần của đích nội suy êm;
 * trước mốc đầu và sau mốc cuối giữ nguyên. docs/03-scene.md#đích-bàn-tay-thế-giới
 */
const HandKeySchema = z.object({
  t: time(),
  right: HandSchema.nullable().optional(),
  left: HandSchema.nullable().optional(),
  /** Đoạn từ mốc trước tới mốc này cố ý nhanh (chộp, giật tay): `check` không đo giật tay ở đoạn ấy */
  snap: z.boolean().optional(),
});

/**
 * Mốc món đặt trước (`scene.items[]`): món `item` ở giây `t`, người cầm `cast`. Chỗ là mốc thân `to` của người cầm dời
 * `offset` `[tiến, y, ngang]` (ngang dương về phía tay phải người cầm), hay toạ độ thế giới `at`; `point` là mốc của món đặt
 * vào chỗ ấy, bỏ trống là tâm hộp bao. `face` / `up` (trục chính) và `roll` (trục phụ) cho trọn hướng món, vectơ ở hệ thân
 * người cầm `[tiến, y, ngang phải]`; thiếu trục nào lấy của nhóm. `ease` là đường hoà vào mốc này. `rest`: món nằm trên
 * một mặt ở mốc này (rig suy mặt đỡ từ món); không khai `at` / `to` thì chỗ và hướng món là lúc thả gần nhất (`itemReleased`).
 * docs/11-nhom-cam.md#mốc-món-items
 */
export const SceneItemMarkSchema = z
  .strictObject({
    t: time(),
    cast: z.string().min(1),
    item: z.string().min(1),
    to: z.enum(BODY_MARKS).optional(),
    at: V3Schema.optional(),
    offset: V3Schema.optional(),
    point: z.string().min(1).optional(),
    face: z.union([AxisIntentSchema, IntentTargetSchema]).optional(),
    up: z.union([z.string().min(1), V3Schema]).optional(),
    roll: AxisIntentSchema.optional(),
    ease: z.enum(EASE_NAMES).optional(),
    rest: z.literal(true).optional(),
  })
  .refine((k) => !!k.at !== !!k.to || (k.rest && !k.at && !k.to), {
    message:
      "chỗ món cần đúng một trong `at` (toạ độ thế giới) hay `to` (mốc thân); bỏ cả hai chỉ với `rest` (món nằm ở chỗ thả)",
  })
  .refine(
    (k) =>
      !k.rest ||
      !!(k.at || k.to) ||
      (k.point === undefined && k.face === undefined && k.up === undefined && k.roll === undefined),
    {
      message:
        "`rest` không khai chỗ: chỗ và hướng món lấy từ lúc thả gần nhất — bỏ `point`, `face`, `up`, `roll` hay khai `at` / `to`",
    },
  )
  .refine((k) => !!k.to || k.offset === undefined, { message: "`offset` chỉ đi với `to`" })
  .refine((k) => !isOtherHand(k.to), {
    message: "mốc món không đặt theo bàn tay: bàn tay suy từ món",
  })
  .refine((k) => !(k.face && k.up !== undefined), {
    message: "`up` là viết tắt của `face` hướng lên — khai một",
  });
export type SceneItemMark = Unmarked<z.infer<typeof SceneItemMarkSchema>>;

/**
 * Người đặt trong thế giới 3D của `scene.lens`: chỗ đứng, cỡ, góc nhìn, lật đều suy từ đây mỗi
 * khung — `x`, `y`, `scale`, `view`, `headView`, `flip`, `zParts` của người ấy không còn
 * nghĩa. Tay chân chiếu thật (kênh soạn ở `side`), `yaw` khai là hướng vẽ ở mọi góc. Tĩnh thì
 * khai `at` / `yaw` / `sit`, đi thì `path`. docs/03-scene.md#người-3d
 */
const WorldSchema = z
  .object({
    at: V3Schema.optional(),
    yaw: z.number().default(0),
    sit: z.boolean().default(false),
    /** Đơn vị thế giới cho một đơn vị rig */
    s: z.number().positive().default(1),
    /** y của sàn dưới chân người ngồi: có thì bàn chân chạm sàn có bóng. Người đứng lấy sàn ở `at` */
    floor: z.number().optional(),
    path: z.array(WorldKeySchema).min(1).optional(),
    /** Đích cổ tay thế giới theo thời gian; đè đích và góc tay của hành động */
    hands: z.array(HandKeySchema).min(1).optional(),
  })
  .refine((w) => !!w.at !== !!w.path, { message: "`world` cần đúng một trong `at` hoặc `path`" });

/** Ống kính 3D: mắt, góc quay quanh trục đứng và góc cúi (độ), tiêu cự, điểm khung của trục nhìn */
const LensSchema = z.object({
  eye: V3Schema,
  yaw: z.number(),
  pitch: z.number(),
  f: z.number().positive(),
  cx: z.number().default(0),
  cy: z.number().default(0),
});

const CastSchema = z.object({
  id: z.string().min(1),
  /** Tên file nhân vật; scene phần lớn không phụ thuộc ai diễn nên bỏ trống được */
  character: z.string().optional(),
  x: z.number().default(0),
  /** Đường đất người này đứng lên; bỏ trống là `scene.ground` — `0` là giữa khung */
  y: z.number().optional(),
  scale: z.number().positive().default(1),
  /**
   * Nấc xếp lớp; nhỏ là ở sau. Bỏ trống là `SCENE_Z.cast`. Ngồi trong đạo cụ thì đây là
   * `z` **cục bộ** giữa những người cùng ngồi trong đạo cụ ấy. docs/03-scene.md#trục-z
   */
  z: z.number().optional(),
  /**
   * `z` riêng cho từng khối của người, cùng trục với `z`; khối không khai thì theo `z`. Khối cùng
   * `z` vẽ chung một lượt theo thứ tự lớp của rig. Không đi cùng `mount` hay `sit`.
   * docs/03-scene.md#tách-người-theo-z
   */
  zParts: z.partialRecord(z.enum(BODY_PARTS), z.number()).optional(),
  /**
   * `id` một nhóm trong `groups[]`: `x`/`y`/`scale`/`flip`/`path` thành tương đối so với nhóm, `y`
   * bỏ trống là `0`, và `z` là `z` **cục bộ** trong nhóm. docs/03-scene.md#nhóm
   */
  group: z.string().optional(),
  /**
   * Hướng nhìn, `true` là lật. Chuỗi mốc là quay giữa cảnh: **công tắc, lấy mẫu bậc
   * thang, không hoà** — rig không có góc ¾ nên cú quay gọn trong một frame. Mốc đầu là
   * chỗ *đổi*, trước nó là hướng ngược lại: `[{ t: 2, v: true }]` là nhìn phải rồi giây
   * 2 quay sang trái. docs/03-scene.md
   */
  flip: z.union([z.boolean(), z.array(FlipKeySchema).min(1)]).default(false),
  /**
   * Góc nhìn của thân: `front` / `side` / `rear` / `back`, hay chuỗi mốc bậc thang như `flip` — trước
   * mốc đầu là `front`. Trôi ngang suy từ bàn chân không đổi theo góc nhìn: người quay lưng
   * đi vào trong thì khai `path`. docs/03-scene.md#góc-nhìn
   */
  view: ViewTrackSchema.default(DEFAULT_VIEW),
  /** Góc nhìn của đầu; bỏ trống là theo thân. Tổ hợp không vẽ được thì `clampViews` kẹp */
  headView: ViewTrackSchema.optional(),
  /**
   * Đè `face.turn` của nhân vật trong riêng cảnh này, cùng đơn vị px: mặt, thân dựng khối, tóc và
   * kính dựng khối cùng xoay theo. Chỉ có nghĩa ở nấc `quarter`. docs/03-scene.md#góc-nhìn
   */
  turn: z.number().optional(),
  /**
   * Xoay cả người quanh gốc (`x`, `y` — điểm chạm đất giữa hai bàn chân), độ theo chiều rig:
   * dương là chân quét về phía mặt nhìn, nên `90` là nằm ngửa, `-90` là nằm sấp; lật theo `flip`,
   * nên `flip` chọn đầu bên phải hay bên trái. Tĩnh cả cảnh. Không đi cùng `mount` hay `sit`.
   * docs/03-scene.md#nằm-và-xoay-cả-người
   */
  rotate: z.number().min(-180).max(180).default(0),
  /**
   * Có `path` là trôi ngang tự suy **tắt**: người giậm chân tại chỗ, chỗ đứng nội suy
   * giữa các mốc và kẹp ở hai đầu. Chân có trượt hay không là scene chịu. docs/03-scene.md
   */
  path: z.array(PathKeySchema).min(1).optional(),
  /** Bỏ trống là `idle`, hay `ride` khi có `mount` */
  base: z.union([z.enum(POSE_NAMES), PoseDeltaSchema]).optional(),
  /**
   * Cưỡi một con trong `animals[]`: hông đặt vào mốc `saddle` của nó, đi theo nó, lật theo
   * nó; `x`/`y`/`flip`/`path` của người không còn nghĩa, `scale` nhân thêm. `dx`/`dy` dời
   * chỗ ngồi so với yên, đơn vị rig của con vật. Con vật vẽ **giữa các lớp của người** —
   * sau chân xa, trước chân gần. docs/03-scene.md#động-vật
   */
  mount: z
    .object({
      on: z.string().min(1),
      dx: z.number().default(0),
      dy: z.number().default(0),
    })
    .optional(),
  /** Con vật đang cầm trên tay, mỗi tay một con */
  carry: z.array(CarrySchema).default([]),
  /**
   * Ngồi trong một đạo cụ trong `props[]`: hông đặt vào chỗ ngồi của nó (`propSeat`), đi theo
   * nó, lật theo nó; `x`/`y`/`flip`/`path` của người không còn nghĩa, `scale` nhân thêm.
   * `dx`/`dy` dời chỗ ngồi, đơn vị rig của đạo cụ. Đạo cụ vẽ **quanh** người: lớp sau, người,
   * lớp trước — `sceneOrder` tách nó làm hai. docs/03-scene.md#đạo-cụ
   */
  sit: z
    .object({
      in: z.string().min(1),
      dx: z.number().default(0),
      dy: z.number().default(0),
    })
    .optional(),
  /** Mặc gì lúc mở màn; hành động đổi tiếp từ đó. docs/03-scene.md */
  equip: EquipSchema.optional(),
  /**
   * Mờ dần rồi biến mất (hiện ra): mốc `{ t, v }`, `v` là độ đục 0–1, nội suy thẳng
   * và giữ ở hai đầu. Bỏ trống là đục hẳn suốt cảnh. docs/03-scene.md
   */
  fade: z.array(FadeKeySchema).min(1).optional(),
  /** Thứ tự có nghĩa: track sau đè track trước */
  tracks: z.array(TrackSchema).default([]),
  world: WorldSchema.optional(),
});

/**
 * Một đạo cụ trên sân khấu. Không có track: chuyển động duy nhất của nó là chỗ đứng
 * (và bánh quay theo chỗ đứng). `follow` là đi theo một người trong `cast`: khi đó
 * `x`/`y` là độ lệch trong hệ của người ấy (đơn vị rig, đã nhân `scale` và lật theo
 * họ), `scale` nhân thêm, `flip` lật ngược lại so với họ. docs/06-dao-cu.md
 */
const PropCastSchema = z.object({
  id: z.string().min(1),
  /** Tên file trong `props/` */
  prop: z.string().min(1),
  x: z.number().default(0),
  /** Đường đất; bỏ trống là `scene.ground`, hay `0` khi `follow` */
  y: z.number().optional(),
  scale: z.number().positive().default(1),
  flip: z.boolean().default(false),
  path: z.array(PathKeySchema).min(1).optional(),
  follow: z.string().optional(),
  /**
   * `follow` trỏ tới con vật: đặt gốc đạo cụ vào mốc này của nó (chóp cánh, mõm…) thay vì chỗ
   * đứng; `x`/`y` dời thêm, đơn vị rig của con vật. Không xoay theo đoạn mang mốc. docs/03-scene.md#động-vật
   */
  anchor: z.enum(ANIMAL_ANCHOR_NAMES).optional(),
  /** Đường tắt của `z`: vẽ trước hay sau người nó theo; không theo ai thì trước hay sau cả `cast` */
  layer: z.enum(["back", "front"]).default("front"),
  /**
   * Nấc xếp lớp; nhỏ là ở sau, có thì `layer` không còn nghĩa. Đứng rời thì đây là `z` toàn
   * cục của sân khấu (mặc định `SCENE_Z.propBack` / `propFront`); có `follow` thì là `z`
   * **cục bộ** quanh chủ nó — chủ ở `0`, mặc định `∓1` — và cả cụm dời theo `z` của chủ.
   * docs/03-scene.md#trục-z
   */
  z: z.number().optional(),
  /**
   * `id` một nhóm trong `groups[]`: `x`/`y`/`scale`/`flip`/`path` thành tương đối so với nhóm, `y`
   * bỏ trống là `0`, và `z` là `z` **cục bộ** trong nhóm. docs/03-scene.md#nhóm
   */
  group: z.string().optional(),
});

/**
 * Một lần đặt hành động của động vật lên track. Như clip của người, trừ `equip`; `blend` hoà
 * thân, cổ, đầu, đuôi, cánh và mặt, còn **chân cắt cứng** ở `start` — góc chân là kết quả IK,
 * hoà là bàn chân trượt. Clip rỗng nhả track. docs/03-scene.md#động-vật
 */
const AnimalClipSchema = z.object({
  action: z.string().optional(),
  start: time().describe("Giây trên timeline scene, hay `@mốc`"),
  cycle: z.number().positive().optional(),
  /** Như `clips[].speed` của người: đơn vị scene mỗi giây, suy `cycle` từ sải chân của con vật */
  speed: z.number().positive().optional(),
  phase: z.number().default(0),
  mask: z
    .array(z.enum(ANIMAL_CHANNELS))
    .optional()
    .describe("Thu hẹp `mask` của file cho riêng lần đặt này; nới rộng là lỗi"),
  blend: z
    .number()
    .min(0)
    .optional()
    .describe(
      `Giây hoà thân, cổ, đầu, đuôi, cánh và mặt sang clip này — chân luôn cắt cứng ở start; 0 là cắt hết; bỏ trống thì tự suy, trong [${BLEND_MIN}, ${BLEND_MAX}]`,
    ),
});

const AnimalTrackSchema = z.object({
  name: z.string().optional(),
  clips: z.array(AnimalClipSchema).min(1),
});

/**
 * Một con vật trên sân khấu, một chồng track như người. Trôi ngang suy từ bàn chân của
 * **chính con vật ấy** — sải chân kẹp theo chân nó — nên `resolveScene` cần JSON con vật ngay
 * lúc nướng; đang bay thì không nướng gì, chỗ đứng là `path`. docs/03-scene.md#động-vật
 */
const AnimalCastSchema = z.object({
  id: z.string().min(1),
  /** Tên file trong `animals/` */
  animal: z.string().min(1),
  x: z.number().default(0),
  /** Đường đất; bỏ trống là `scene.ground` */
  y: z.number().optional(),
  scale: z.number().positive().default(1),
  flip: z.union([z.boolean(), z.array(FlipKeySchema).min(1)]).default(false),
  path: z.array(PathKeySchema).min(1).optional(),
  fade: z.array(FadeKeySchema).min(1).optional(),
  /** Đường tắt của `z`: vẽ dưới hay trên cả `cast`. Con vật có người cưỡi hay bị xách thì vẽ trong người ấy, không ở đây */
  layer: z.enum(["back", "front"]).default("back"),
  /**
   * Nấc xếp lớp toàn cục; nhỏ là ở sau, có thì `layer` không còn nghĩa. Mặc định
   * `SCENE_Z.animalBack` / `animalFront`. Con vật có chủ vẽ ở `slots` của người ấy nên
   * **bỏ qua** `z`. docs/03-scene.md#trục-z
   */
  z: z.number().optional(),
  /**
   * `id` một nhóm trong `groups[]`: `x`/`y`/`scale`/`flip`/`path` thành tương đối so với nhóm, `y`
   * bỏ trống là `0`, và `z` là `z` **cục bộ** trong nhóm. docs/03-scene.md#nhóm
   */
  group: z.string().optional(),
  /** Thứ tự có nghĩa: track sau đè track trước */
  tracks: z.array(AnimalTrackSchema).default([]),
});

/**
 * Một nhóm người, đạo cụ và động vật đặt chung: thành viên khai `group` trỏ về đây, chỗ đứng của
 * họ là tương đối so với nhóm, và cả nhóm là **một** mục trên trục `z` của sân khấu. Nhóm đứng
 * yên. docs/03-scene.md#nhóm
 */
const GroupSchema = z.object({
  id: z.string().min(1),
  x: z.number().default(0),
  /** Đường đất của nhóm; bỏ trống là `scene.ground` */
  y: z.number().optional(),
  scale: z.number().positive().default(1),
  /** Lật gương cả nhóm quanh `x` của nó */
  flip: z.boolean().default(false),
  /** Nấc của cả nhóm ở tầng sân khấu; bỏ trống là `SCENE_Z.cast` */
  z: z.number().optional(),
});

/**
 * Một cảnh: nhiều nhân vật, mỗi người một chồng track. docs/03-scene.md
 * `z.object()` trần ở tầng ngoài — props editor của Remotion cần vậy, nên kiểm
 * chéo giữa các trường nằm ở `resolveScene`.
 */
export const SceneSchema = z.object({
  schemaVersion: z
    .literal(SCENE_VERSION, {
      error: "JSON scene thuộc phiên bản schema khác; cần bản @stickman3d/sketch khớp với nó",
    })
    .default(SCENE_VERSION),
  name: z.string().default("scene"),
  /**
   * Khung hình: `wide` (1280×720, ra 1920×1080) cho tập phim, `tall` (405×720, ra 1080×1920)
   * cho short. Hai khung cùng cao và cùng `ground`, chỉ khác bề ngang. Mọi shot của một tập
   * phải cùng khung. docs/03-scene.md#khung-hình
   */
  frame: z.enum(Object.keys(FRAMES) as [FrameName, ...FrameName[]]).default("wide"),
  /** Giây; bỏ trống thì suy từ clip cuối lúc `resolveScene` */
  duration: z.number().positive().optional(),
  /**
   * Mốc có tên, giây scene. Mọi trường thời gian trong cảnh (`start`, `t`, `from`/`to` của
   * `fx`…) viết được `"@ten+0.4"` thay cho số; dời mốc là sửa một số ở đây, mọi thứ neo vào nó
   * đi theo. `stickman retime` ghi vào bảng này. docs/03-scene.md#mốc-có-tên
   */
  marks: z.record(z.string().regex(/^[A-Za-z0-9_-]+$/), z.number().min(0)).default({}),
  /** Đường đất của cả cảnh; `cast[].y` và `props[].y` không khai thì đứng lên nó */
  ground: z.number().default(FRAMES.wide.ground),
  /** Ống kính 3D cho người khai `cast[].world` và đồ khối của lớp vẽ code. docs/03-scene.md#người-3d */
  lens: LensSchema.optional(),
  /** Các lớp nền, vẽ dưới lên theo `z`; rỗng là sân khấu trắng và chỗ vẽ kẻ vạch đường đất */
  bg: z.array(BgLayerSchema).default([]),
  /** Chuỗi mốc camera; rỗng là đúng khung sân khấu, `zoom` 1. docs/03-scene.md#camera */
  camera: z.array(CameraKeySchema).default([]),
  groups: z.array(GroupSchema).default([]),
  cast: z.array(CastSchema).min(1),
  /** Mốc món đặt trước: chỗ, hướng món theo thời gian; chỗ cầm ở `cast[].world.hands[].hold`. docs/11-nhom-cam.md#mốc-món-items */
  items: z.array(SceneItemMarkSchema).optional(),
  props: z.array(PropCastSchema).default([]),
  animals: z.array(AnimalCastSchema).default([]),
  /**
   * Hiệu ứng: hào quang, nước mắt, vật rời tay, chữ, iris… Rig chỉ mang danh sách này theo;
   * hình dạng từng mục do `@stickman3d/fx` kiểm (`parseFx`) và vẽ (`<SceneFx>`). docs/09-hieu-ung.md
   */
  fx: z.array(z.record(z.string(), z.unknown())).default([]),
});

export type ClipData = z.infer<typeof ClipSchema>;
export type SceneData = z.infer<typeof SceneSchema>;
export type CastData = SceneData["cast"][number];
export type BgLayerData = SceneData["bg"][number];
export type PropCastData = SceneData["props"][number];
export type AnimalCastData = SceneData["animals"][number];
export type GroupData = SceneData["groups"][number];
export type CarryData = z.infer<typeof CarrySchema>;

/** `T` với mọi tham chiếu `@mốc` đã thành số — hình dạng `resolveScene` đọc */
export type Unmarked<T> = T extends MarkRef
  ? never
  : T extends readonly unknown[]
    ? { [K in keyof T]: Unmarked<T[K]> }
    : T extends object
      ? { [K in keyof T]: Unmarked<T[K]> }
      : T;
export type SceneSpec = Unmarked<SceneData>;

/** Tách `"@ten+0.4"` thành tên và phần lệch; không phải tham chiếu thì `null` */
export function parseMarkRef(ref: unknown): { name: string; offset: number } | null {
  if (typeof ref !== "string") return null;
  const m = MARK_REF.exec(ref);
  if (!m) return null;
  const off = m[3] ? Number(m[3]) : 0;
  return { name: m[1], offset: m[2] === "-" ? -off : off };
}

/** Giây của một trường thời gian: số giữ nguyên, `@mốc` tra `marks`; mốc không có là lỗi kèm chỗ */
export function markTime(ref: number | string, marks: Record<string, number>, where = ""): number {
  if (typeof ref === "number") return ref;
  const r = parseMarkRef(ref);
  if (!r)
    throw new Error(`scene: ${where ? `${where}: ` : ""}\`${ref}\` không phải giây hay \`@mốc\``);
  const base = marks[r.name];
  if (base === undefined)
    throw new Error(
      `scene: ${where ? `${where}: ` : ""}mốc \`@${r.name}\` không có trong \`marks\``,
    );
  return Math.max(0, base + r.offset);
}

/** Mọi tham chiếu `@mốc` trong một cảnh: đường dẫn trường và tên mốc, kể cả trong `fx[]` */
export function markRefs(scene: SceneData): { path: string; name: string; offset: number }[] {
  const out: { path: string; name: string; offset: number }[] = [];
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) walk(x, path ? `${path}.${k}` : k);
    else {
      const r = parseMarkRef(v);
      if (r) out.push({ path, ...r });
    }
  };
  for (const [k, v] of Object.entries(scene)) if (k !== "marks") walk(v, k);
  return out;
}

/**
 * Cảnh với mọi `@mốc` đã thành số, kể cả trong `fx[]`; `marks` giữ nguyên. Mốc không có là
 * lỗi kèm đường dẫn trường. `resolveScene` gọi trước tiên; JSON trên đĩa vẫn giữ tham chiếu.
 */
export function unmarkScene(scene: SceneData): SceneSpec {
  const walk = (v: unknown, path: string): unknown => {
    if (Array.isArray(v)) return v.map((x, i) => walk(x, `${path}[${i}]`));
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, walk(x, path ? `${path}.${k}` : k)]),
      );
    return parseMarkRef(v) ? markTime(v as string, scene.marks, path) : v;
  };
  const { marks, ...rest } = scene;
  return { ...(walk(rest, "") as Omit<SceneSpec, "marks">), marks };
}

/** Nâng JSON đời cũ lên `SCENE_VERSION`. File mới hơn thì trả nguyên để zod báo lỗi. */
export function migrateScene(json: unknown): unknown {
  if (!json || typeof json !== "object" || Array.isArray(json)) return json;
  const o = structuredClone(json) as Record<string, unknown>;
  const from = typeof o.schemaVersion === "number" ? o.schemaVersion : 0;
  if (from > SCENE_VERSION) return o;
  // v2 → v3 `cast[].show` thành `cast[].equip`, tắt socket là gán `null`
  if (from < 3)
    for (const m of (o.cast ?? []) as Record<string, unknown>[]) {
      const show = m?.show;
      if (!show || typeof show !== "object") continue;
      m.equip = Object.fromEntries(
        Object.entries(show as Record<string, boolean>).map(([sock, on]) => [
          sock,
          on ? "base" : null,
        ]),
      );
      delete m.show;
    }
  // v3 → v4 `cast[].flip` nhận thêm chuỗi mốc; boolean cũ vẫn hợp lệ nên không phải đổi
  // v4 → v5 thêm `ground` / `bg` / `camera`; thiếu cả ba là đúng hành vi cũ
  // v5 → v6 thêm `clips[].equip`; thiếu nó là clip không đổi đồ, không phải viết gì
  // v6 → v7 thêm `animals[]`, `cast[].mount` và `cast[].carry`; thiếu là cảnh không có con vật nào
  // v7 → v8 thêm `clips[].speed` và `fx[]`; thiếu là nhịp lấy từ `cycle` như cũ và không hiệu ứng nào
  // v8 → v9 `bg` thành mảng lớp; một tấm đời cũ là mảng một phần tử, `z` mặc định giữ nguyên chỗ
  if (from < 9 && o.bg && typeof o.bg === "object" && !Array.isArray(o.bg)) o.bg = [o.bg];
  // v9 → v10 thêm `bg[].parallax`; thiếu là `1`, tức lớp nền dán vào sân khấu như cũ
  // v10 → v11 thêm `bg[].repeat` và `bg[].tiles`; thiếu là `none`, tức vẫn đúng một tấm
  // v11 → v12 thêm `fx[].z`; thiếu là nấc mặc định của `layer`, tức ba lớp fx vẫn chèn ba chỗ cũ
  // v12 → v13 thêm `marks` và tham chiếu `@mốc` ở trường thời gian; số cũ vẫn là số
  // v13 → v14 trước mốc `flip` đầu là chưa lật; đời cũ ngầm là ngược mốc đầu, ghi rõ ra
  if (from < 14)
    for (const key of ["cast", "animals"])
      for (const m of (o[key] ?? []) as Record<string, unknown>[]) {
        const f = m?.flip;
        if (!Array.isArray(f) || !f.length) continue;
        const first = f[0] as { t: number; v: boolean };
        if (first.t > 0 && !first.v) m.flip = [{ t: 0, v: true }, ...f];
      }
  // v14 → v15 thêm `frame`; thiếu là `wide`
  // v15 → v16 `animals[].clips` thành chồng `tracks[]`; chuỗi clip cũ là track duy nhất
  if (from < 16)
    for (const a of (o.animals ?? []) as Record<string, unknown>[]) {
      if (!a || !Array.isArray(a.clips)) continue;
      if (a.clips.length && !a.tracks) a.tracks = [{ clips: a.clips }];
      delete a.clips;
    }
  // v17 → v18 thêm `cast[].view` và `cast[].headView`; thiếu là chính diện
  // v16 → v17 thêm `groups[]`, `group` và `cast[].zParts`; thiếu là không nhóm nào và người vẽ nguyên khối
  // v18 → v19 thêm nấc `quarter` và nó là mặc định; `front` đời cũ chính là `quarter` bây giờ
  if (from < 19)
    for (const m of (o.cast ?? []) as Record<string, unknown>[])
      for (const field of ["view", "headView"]) {
        const v = m?.[field];
        if (v === "front") m[field] = "quarter";
        else if (Array.isArray(v))
          m[field] = v.map((k: { v?: unknown }) =>
            k && k.v === "front" ? { ...k, v: "quarter" } : k,
          );
      }
  // v19 → v20 thêm `cast[].turn`; thiếu là theo `face.turn` của nhân vật
  // v20 → v21 `stretch` của `cast[].base` nhận thêm tám số từng đoạn; bốn số cũ vẫn hợp lệ
  // v21 → v22 thêm `cast[].rotate`; thiếu là `0`, tức đứng thẳng
  // v22 → v23 thêm `scene.lens` và `cast[].world` (cả `world.hands`); thiếu là người 2D như cũ
  // v23 → v24 thêm `clips[].snap` và `world.hands[].snap`; thiếu là không cố ý giật
  // v24 → v25 `cast[].base` nhận số dang của tay chân và `torso: [cúi, nghiêng]`; dạng cũ vẫn hợp lệ
  // v25 → v26 `cast[].base` nhận số xoắn vai, `clips[].mask` nhận kênh `hand`; dạng cũ vẫn hợp lệ
  // v26 → v27 `world.hands[]` nhận mốc thân (`to`), điểm bàn tay (`point`) và lòng tay theo ý định (`palm`, `fingers`); dạng cũ vẫn hợp lệ
  // v27 → v28 thêm `world.path[].steps`; thiếu là số nhịp quay tại chỗ tự suy từ góc
  // v28 → v29 `world.hands[]` nhận món cầm (`hold`) và điểm `item:<mốc>`; dạng cũ vẫn hợp lệ
  // v29 → v30 `hold` chỉ nhận chỗ cầm nhóm (`món@nhóm`, `{ item, group, … }`); `món#kiểu` và `{ item, grip }` để zod báo kèm
  // lệnh chuyển `stickman migrate-held` — chuyển cần món bản 1 nên không tự đổi ở đây
  o.schemaVersion = SCENE_VERSION;
  return o;
}

export const parseScene = (json: unknown) => SceneSchema.safeParse(migrateScene(json));

/** Clip đã tra xong hành động và nướng sẵn τ. */
interface Clip {
  start: number;
  /** Tên file hành động; `sceneEvents` trả nó về để biết sự kiện đến từ clip nào */
  file?: string;
  action?: ActionData;
  cycle: number;
  phase: number;
  mask?: Channel[];
  equip?: Equip;
  tau: number;
  /** Cố ý giật: clip khai `snap` hay hành động của nó khai `snap` */
  snap?: boolean;
  /** Người 3D đi theo `path`: quãng một lượt (đơn vị rig, `height = 1`) của clip có sải chân; pha chạy theo đồng hồ của người ấy */
  stride?: number;
}

/**
 * Đồng hồ của người 3D đi theo `path`: `at` là giây đã co giãn theo nhịp chân của clip có sải chân,
 * `half` là số lần thân đã lật qua chính diện / quay lưng — lẻ thì kênh gần và xa đổi chỗ.
 */
type Clock = (t: number) => { at: number; half: number };

interface Track {
  name?: string;
  clips: Clip[];
}

export interface CastMember extends Omit<
  Unmarked<CastData>,
  "base" | "tracks" | "path" | "flip" | "y" | "view" | "headView"
> {
  /** Đường đất đã suy: `cast[].y`, hay `scene.ground` */
  y: number;
  base: Pose;
  tracks: Track[];
  path?: PathKey[];
  /** Hướng nhìn đã chuẩn hoá thành chuỗi mốc, luôn có mốc ở giây 0 */
  flip: FlipKey[];
  /** Góc nhìn của thân và của đầu, cùng dạng chuỗi mốc; đầu bỏ trống là theo thân */
  view: ViewKey[];
  headView?: ViewKey[];
  /** Trôi ngang cho `height = 1`, chưa nhân `scale` và chưa lật */
  travel: TravelTable;
}

export interface PropMember extends Omit<Unmarked<PropCastData>, "path"> {
  path?: PathKey[];
  /** JSON đạo cụ đã parse, nếu `resolveScene` được đưa; có người ngồi thì bắt buộc */
  spec?: PropData;
}

interface AnimalClip {
  start: number;
  file?: string;
  action?: ActionData;
  cycle: number;
  phase: number;
  mask?: AnimalChannel[];
  tau: number;
}

interface AnimalTrack {
  name?: string;
  clips: AnimalClip[];
}

export interface AnimalMember extends Omit<
  Unmarked<AnimalCastData>,
  "path" | "flip" | "y" | "tracks"
> {
  y: number;
  flip: FlipKey[];
  path?: PathKey[];
  tracks: AnimalTrack[];
  /** JSON con vật đã parse — dáng đi và mốc trên lưng đều cần nó */
  spec: AnimalData;
  /** Trôi ngang của chính con vật này, chưa nhân `scale` và chưa lật */
  travel: TravelTable;
  /** Người đang cưỡi hay xách nó; có thì con vật vẽ trong người ấy, không có lớp riêng */
  host?: { id: string; kind: "mount" | "carry" };
}

export interface SceneRuntime {
  name: string;
  duration: number;
  /** Khung sân khấu của cảnh, tra từ `scene.frame`; `cameraAt` cắt theo nó */
  frame: FrameSpec;
  ground: number;
  bg: SceneData["bg"];
  camera: CameraKey[];
  /** Nhóm của cảnh; chỗ đứng của thành viên trong `cast` / `props` / `animals` đã quy ra sân khấu */
  groups: GroupData[];
  cast: CastMember[];
  props: PropMember[];
  animals: AnimalMember[];
  /** `rig.height` của từng người trong `cast`, do chỗ nạp đưa vào; thiếu là `1`. Đạo cụ theo người và người ngồi trên đạo cụ ấy trôi theo số này */
  heights: Record<string, number>;
  /** `body3(nhân vật)` của từng người trong `cast`, do chỗ nạp đưa vào; thiếu là `BODY3`. Người 3D đi theo `path` bước bằng hông này */
  bodies: Record<string, Body3>;
  /** Nguyên như `scene.fx` nhưng `@mốc` đã thành số, chưa qua zod của `@stickman3d/fx` — chỗ vẽ gọi `sceneFx(rt)` bên ấy */
  fx: SceneData["fx"];
  /** Bảng mốc có tên của cảnh, giây scene — lớp vẽ code đọc qua `ctx.marks` */
  marks: Record<string, number>;
  /** `scene.lens`, góc đã ra radian */
  lens?: Lens;
  /** Món cầm tay (`held/<món>.json`) theo tên, do chỗ nạp đưa vào; `world.hands[].hold` tra ở đây */
  held: Record<string, HeldItemSpec>;
  /** `scene.items`, `@mốc` đã thành số; `itemAt` đọc */
  items?: SceneItemMark[];
  /**
   * JSON nhân vật (`castCharacter`) của từng người trong `cast`, do chỗ dựng cảnh đưa vào (`buildWorld` điền): mốc món `rest`
   * không khai chỗ dựng bàn tay người thả từ đây khi `ItemOptions.chars` không có người ấy
   */
  chars?: Record<string, CharacterData>;
}

/** Khung camera lúc `time`; `view` là hộp cắt trong hệ toạ độ sân khấu */
export interface CameraShot {
  x: number;
  y: number;
  zoom: number;
  /** Khung sân khấu của cảnh; chỗ vẽ nào cần cỡ khung thì đọc ở đây, đừng lấy hằng số */
  frame: FrameSpec;
  view: { x: number; y: number; w: number; h: number };
  /** `view` viết sẵn cho thuộc tính `viewBox` của SVG */
  viewBox: string;
}

/** Chỗ đặt con vật đang cưỡi **trong hệ của người**: props `<Animal>` cho khe `slots.mount` */
export interface MountSpot {
  id: string;
  x: number;
  groundY: number;
  scale: number;
  /** `hip` khi con vật đang bay: không bàn chân nào chạm đất để treo nó vào */
  root: Root;
  /** `over` khi đang bay: cặp chân xếp phải nổi lên trên thân mới thấy */
  legLayer: "under" | "over";
}

/** Chỗ đặt con vật đang cầm **trong khung cổ tay**: props `<Animal>` cho khe `slots[socket]` */
export interface CarrySpot {
  id: string;
  socket: "handNear" | "handFar";
  x: number;
  groundY: number;
  scale: number;
  rotate: number;
  flip: boolean;
  root: Root;
}

/** Props mà `<Character>` nhận thẳng: `{...sceneAt(rt, id, t, height)}` */
export interface ScenePose extends FaceState {
  pose: Pose;
  layers: ArmLayers;
  /** Chỗ đứng trên sân khấu: `cast[].x` cộng trôi ngang suy từ bàn chân, hoặc tra `path`; cưỡi thì là yên con vật */
  x: number;
  /** Đường đất: `cast[].y`, hoặc tra `path`; gốc `hip` thì đây là chính tâm hông */
  groundY: number;
  scale: number;
  /** Hướng nhìn lúc này, tra `cast[].flip`; `<Character flip>` nhận thẳng */
  flip: boolean;
  /** Góc nhìn của thân và đầu lúc này, đã kẹp; `<Character view headView>` nhận thẳng */
  view: View;
  headView: View;
  /** `hip` khi đang cưỡi hay ngồi xe — treo người ở hông thay cho bàn chân */
  root: Root;
  /** Xoay cả người quanh gốc, tra `cast[].rotate`; `<Character rotate>` nhận thẳng */
  rotate: number;
  /** Đồ đang mặc lúc này; `<Character equip>` nhận thẳng */
  equip: EquipStep[];
  /** Độ đục 0–1, tra `cast[].fade`; 1 là đục hẳn */
  opacity: number;
  /** Con vật đang cưỡi, đặt trong hệ của người; `castSlots` dựng `<Animal>` từ đây */
  mounted?: MountSpot;
  /** Con vật đang cầm, mỗi cái trong khung cổ tay của nó */
  carried: CarrySpot[];
  /** Người 3D (`cast[].world`): chỗ đặt và ống kính; `<Character world>` nhận thẳng */
  world?: World;
}

/** Props mà `<Animal>` nhận thẳng: `{...animalAt(rt, id, t)}` */
export interface AnimalSpot extends AnimalFace {
  pose: AnimalPose;
  /** Con bị xách thì đây là chỗ đứng của người xách — chỗ chính xác trong tay là việc của `<Character slots>` */
  x: number;
  groundY: number;
  scale: number;
  flip: boolean;
  /** `hip` khi đang bay hay bị xách — treo ở khớp hông thay cho bàn chân; đang bay thì `groundY` đã trừ `rig.hipY` để hông cao như lúc đứng */
  root: Root;
  /** `over` khi đang bay: chân xếp sát bụng nằm gọn trong bóng thân, phải nổi lên mới thấy */
  legLayer: "under" | "over";
  opacity: number;
}

/** Props mà `<Prop>` nhận thẳng: `{...propAt(rt, id, t, height)}` */
export interface PropPose {
  x: number;
  groundY: number;
  scale: number;
  /** `0` khi đạo cụ theo người mà được nâng lên (`y` khác `0`) — kiệu trên vai không đổ bóng lơ lửng, người khiêng đã có bóng */
  shadow?: number;
  flip: boolean;
  /** Quãng đã lăn trên màn hình — chính là `x`, bánh quay theo nó */
  roll: number;
}

const phaseAt = (
  c: { start: number; cycle: number; phase: number; stride?: number },
  time: number,
  clock?: Clock,
) => (clock && c.stride ? clockPhase(c, time, clock) : (time - c.start) / c.cycle + c.phase);

function clockPhase(
  c: { start: number; cycle: number; phase: number },
  time: number,
  clock: Clock,
) {
  return (clock(time).at - clock(c.start).at) / c.cycle + c.phase;
}

const inMask = (c: Clip, k: Channel) => !c.mask || c.mask.includes(k);

function clipPose(c: Clip, time: number, clock?: Clock): Partial<Pose> {
  if (!c.action) return {};
  const d = actionDelta(c.action, phaseAt(c, time, clock));
  for (const k of JOINT_CHANNELS) if (!inMask(c, k)) delete d[k];
  const p = deltaPose(d);
  // Kênh tay chân hành động này ghi mang cờ nâng của nó: người 3D đọc góc soạn ở `side`
  if (c.action.authoredAt === "side")
    p.lift = Object.fromEntries(LIFT_CHANNELS.filter((k) => p[k]).map((k) => [k, true]));
  const reach = actionReach(c.action, phaseAt(c, time, clock));
  for (const k of REACH_CHANNELS) if (!p[k]) delete reach[k];
  if (Object.keys(reach).length) p.reach = reach;
  if (inMask(c, "hand")) {
    const hand = actionHand(c.action, phaseAt(c, time, clock));
    if (Object.keys(hand).length) p.hand = hand;
    const aim = actionAim(c.action, phaseAt(c, time, clock));
    if (Object.keys(aim).length) p.aim = aim;
  }
  return p;
}

function clipLayers(c: Clip, time: number, clock?: Clock): Partial<ArmLayers> {
  if (!c.action) return {};
  const l = actionLayers(c.action, phaseAt(c, time, clock));
  for (const k of ARM_CHANNELS) if (!inMask(c, k)) delete l[k];
  return l;
}

const clipFace = (c: Clip, time: number, clock?: Clock): Partial<FaceState> =>
  c.action && inMask(c, "face") ? actionFace(c.action, phaseAt(c, time, clock)) : {};

/**
 * Đổi đồ không đi qua `mask`: nó không phải khớp, thu hẹp `mask` không đụng tới nó.
 * `clips[].equip` đặt trước, mốc trong file hành động đè lên — file nói được chi tiết hơn.
 */
const clipEquip = (c: Clip, time: number, clock?: Clock): EquipStep[] =>
  composeEquip(c.equip, ...(c.action ? [actionEquip(c.action, phaseAt(c, time, clock))] : []));

/**
 * Tư thế track ghi tại `time`, tính tới hết clip `i`.
 * Clip cũ **vẫn chạy** trong lúc hoà — đóng băng nó là chân đứng chết nửa giây.
 * Đệ quy vì clip mới chen vào khi chỗ nối cũ chưa xong là chuyện thường.
 */
function poseUpTo(tr: Track, i: number, time: number, base: Pose, clock?: Clock): Partial<Pose> {
  const c = tr.clips[i];
  const p = clipPose(c, time, clock);
  const s = time - c.start;
  if (s >= c.tau) return p;
  return blendPose(base, i === 0 ? {} : poseUpTo(tr, i - 1, time, base, clock), p, s / c.tau);
}

function layersUpTo(tr: Track, i: number, time: number, clock?: Clock): Partial<ArmLayers> {
  const c = tr.clips[i];
  const l = clipLayers(c, time, clock);
  const s = time - c.start;
  if (s >= c.tau) return l;
  return blendLayers(i === 0 ? {} : layersUpTo(tr, i - 1, time, clock), l, s / c.tau);
}

function faceUpTo(tr: Track, i: number, time: number, clock?: Clock): Partial<FaceState> {
  const c = tr.clips[i];
  const f = clipFace(c, time, clock);
  const s = time - c.start;
  if (s >= c.tau) return f;
  return blendFace(i === 0 ? {} : faceUpTo(tr, i - 1, time, clock), f, s / c.tau);
}

/**
 * Mặc gì là **công tắc, không phải tư thế**: đồ một clip đổi giữ nguyên qua clip sau, tới
 * khi có clip khác nói khác — nhả track không trả mũ về tay. Vẫn thuần theo `time`: quét
 * lại cả track từ đầu, clip cũ lấy ở đúng giây clip sau tiếp quản.
 */
function equipUpTo(tr: Track, i: number, time: number, clock?: Clock): EquipStep[] {
  const steps: EquipStep[][] = [];
  for (let k = 0; k <= i; k++)
    steps.push(clipEquip(tr.clips[k], k === i ? time : tr.clips[k + 1].start, clock));
  return composeEquip(...steps);
}

/** Clip đang chạy: clip cuối cùng đã tới lượt. `-1` là track chưa ghi gì. */
function activeClip(tr: { clips: { start: number }[] }, time: number): number {
  let i = -1;
  for (let k = 0; k < tr.clips.length && tr.clips[k].start <= time; k++) i = k;
  return i;
}

const fail = (msg: string): never => {
  throw new Error(`scene: ${msg}`);
};

const basePose = (b: NonNullable<SceneSpec["cast"][number]["base"]>): Pose =>
  typeof b === "string" ? POSES[b] : composePose(POSES.idle, deltaPose(b));

/** Chuẩn hoá hướng về chuỗi mốc bắt đầu ở giây 0; trước mốc đầu là chưa lật. */
function flipKeys(f: SceneSpec["cast"][number]["flip"], who: string): FlipKey[] {
  if (typeof f === "boolean") return [{ t: 0, v: f }];
  f.forEach((k, i) => {
    if (i > 0 && k.t <= f[i - 1].t) fail(`${who}: \`flip[].t\` phải tăng dần`);
  });
  return f[0].t > 0 ? [{ t: 0, v: false }, ...f] : f;
}

function viewKeys(
  v: NonNullable<SceneSpec["cast"][number]["headView"]>,
  who: string,
  field: "view" | "headView",
): ViewKey[] {
  if (typeof v === "string") return [{ t: 0, v }];
  v.forEach((k, i) => {
    if (i > 0 && k.t <= v[i - 1].t) fail(`${who}: \`${field}[].t\` phải tăng dần`);
  });
  return v[0].t > 0 ? [{ t: 0, v: DEFAULT_VIEW }, ...v] : v;
}

/**
 * `cycle` suy từ `speed`: một lượt hành động trôi `stride` đơn vị rig, nhân `scale` ra đơn vị
 * scene, chia tốc độ ra giây. Hành động không trôi thì không có gì để chia — lỗi lúc nạp.
 */
function cycleForSpeed(
  r: { cycle?: number; speed?: number; action?: string },
  stride: () => number,
  scale: number,
  where: string,
): number | undefined {
  if (r.speed === undefined) return r.cycle;
  if (r.cycle !== undefined)
    fail(`${where}: \`cycle\` và \`speed\` là hai cách khai một con số, chọn một`);
  if (!r.action) fail(`${where}: \`speed\` cần một hành động`);
  const s = Math.abs(stride());
  if (s < 1e-6)
    fail(`${where}: \`${r.action}\` không trôi ngang, không suy được \`cycle\` từ \`speed\``);
  return (s * scale) / (r.speed as number);
}

type Stride = (a: ActionData, base: Pose) => number;

/** `actionStride` nhớ theo cặp hành động và tư thế nền trong một lượt `resolveScene`: cả đám đông đi chung vài hành động */
function strideCache(): Stride {
  const memo = new Map<ActionData, Map<Pose, number>>();
  return (a, base) => {
    let byBase = memo.get(a);
    if (!byBase) memo.set(a, (byBase = new Map()));
    let v = byBase.get(base);
    if (v === undefined) byBase.set(base, (v = actionStride(a, base)));
    return v;
  };
}

function resolveTrack(
  raw: SceneSpec["cast"][number]["tracks"][number],
  base: Pose,
  scale: number,
  who: string,
  actions: Record<string, ActionData>,
  stride: Stride,
): Track {
  const tr: Track = { name: raw.name, clips: [] };
  raw.clips.forEach((r, i) => {
    const where = `${who}/${raw.name ?? i} clip ${i}`;
    if (i > 0 && r.start <= raw.clips[i - 1].start) fail(`${where}: \`start\` phải tăng dần`);
    const action = r.action ? actions[r.action] : undefined;
    if (r.action && !action) fail(`${where}: không có hành động \`${r.action}\``);
    if (action && action.schemaVersion !== ACTION_VERSION)
      fail(`${where}: \`${r.action}\` chưa qua \`parseAction\``);
    const cycle = cycleForSpeed(r, () => stride(action as ActionData, base), scale, where);
    const c: Clip = {
      start: r.start,
      file: r.action,
      action,
      cycle: cycle ?? action?.duration ?? 1,
      phase: r.phase,
      mask: r.mask,
      equip: r.equip,
      tau: r.blend ?? 0,
      ...((r.snap || action?.snap) && { snap: true }),
    };
    tr.clips.push(c);
    // τ là chỗ nối giữa thứ track đã ghi và clip này; ở giây 0 chưa có chỗ nối nào
    if (r.blend === undefined && !(i === 0 && r.start === 0))
      c.tau = blendDuration(
        base,
        i === 0 ? {} : poseUpTo(tr, i - 1, c.start, base),
        clipPose(c, c.start),
      );
  });
  return tr;
}

/**
 * Tra hành động, nướng τ và bảng trôi ngang, kiểm chéo. Làm một lần lúc nạp — τ không
 * phụ thuộc frame đang vẽ, tính lại mỗi frame là đệ quy mũ; trôi ngang là tích phân,
 * tích luỹ trong rAF là Remotion seek sai.
 */
export function resolveScene(
  raw: SceneData,
  actions: Record<string, ActionData>,
  animals: Record<string, AnimalData> = {},
  propSpecs: Record<string, PropData> = {},
  heights: Record<string, number> = {},
  bodies: Record<string, Body3> = {},
  held0: Record<string, HeldItemSpec> = {},
): SceneRuntime {
  // Mốc có tên giải ra số ở đây và chỉ ở đây: mọi thứ dưới đọc số
  const scene = unmarkScene(raw);
  const held = heldInstances(held0, scene.cast);
  const stride = strideCache();
  const seen = new Set<string>();
  const claim = (id: string) => {
    if (seen.has(id)) fail(`\`id\` trùng: \`${id}\``);
    seen.add(id);
  };
  scene.camera.forEach((k, i) => {
    if (i > 0 && k.t <= scene.camera[i - 1].t) fail(`\`camera[].t\` phải tăng dần`);
  });
  const keyed = (who: string, keys: { t: number }[] | undefined, name: string) =>
    keys?.forEach((k, i) => {
      if (i > 0 && k.t <= keys[i - 1].t) fail(`${who}: \`${name}[].t\` phải tăng dần`);
    });
  const pathOf = <T extends { x: number; scale: number; path?: PathKey0[] }>(
    id: string,
    m: T,
    y: number,
  ) => {
    keyed(id, m.path, "path");
    return m.path?.map((k) => ({ ...k, x: k.x ?? m.x, y: k.y ?? y, scale: k.scale ?? m.scale }));
  };
  for (const g of scene.groups) claim(g.id);
  // Nhóm đứng yên nên quy chỗ đứng ra sân khấu một lần ở đây; mọi thứ dưới đọc số sân khấu
  const placed = <T extends { x: number; scale: number; group?: string; path?: PathKey0[] }>(
    id: string,
    m: T,
    y: number | undefined,
    free: number,
  ) => {
    if (!m.group) {
      const at = y ?? free;
      return { x: m.x, y: at, scale: m.scale, path: pathOf(id, m, at), mirror: false };
    }
    const g =
      scene.groups.find((q) => q.id === m.group) ??
      fail(`${id}: không có nhóm \`${m.group}\` trong \`groups\``);
    const dir = g.flip ? -1 : 1;
    const gy = g.y ?? scene.ground;
    const out = (x: number, ly: number, k: number) => ({
      x: g.x + dir * g.scale * x,
      y: gy + g.scale * ly,
      scale: g.scale * k,
    });
    return {
      ...out(m.x, y ?? 0, m.scale),
      path: pathOf(id, m, y ?? 0)?.map((k) => ({ ...k, ...out(k.x, k.y, k.scale) })),
      mirror: g.flip,
    };
  };

  const hosts = new Map<string, AnimalMember["host"]>();
  const beasts = scene.animals.map((a): Omit<AnimalMember, "travel" | "host"> => {
    claim(a.id);
    const spec = animals[a.animal] ?? fail(`${a.id}: không có con vật \`${a.animal}\``);
    const { mirror, ...at } = placed(a.id, a, a.y, scene.ground);
    keyed(a.id, a.fade, "fade");
    const tracks = a.tracks.map((t) => resolveAnimalTrack(t, spec, a.scale, a.id, actions));
    const flip = flipKeys(a.flip, a.id).map((k) => ({ ...k, v: k.v !== mirror }));
    return { ...a, ...at, spec, tracks, flip };
  });
  const beast = (who: string, id: string, kind: "mount" | "carry") => {
    const b =
      beasts.find((a) => a.id === id) ?? fail(`${who}: không có \`${id}\` trong \`animals\``);
    const had = hosts.get(id);
    if (had)
      fail(
        `${who}: \`${id}\` đã có người ${had.kind === "mount" ? "cưỡi" : "xách"} (\`${had.id}\`)`,
      );
    hosts.set(id, { id: who, kind });
    if (b.group) fail(`${id}: \`${who}\` đang giữ nó nên nó đi theo người ấy — bỏ \`group\``);
    return b;
  };

  const cast = scene.cast.map((m) => {
    claim(m.id);
    const base = basePose(m.base ?? (m.mount ? "ride" : m.sit ? "sit" : "idle"));
    const { mirror, ...at } = placed(m.id, m, m.y, scene.ground);
    keyed(m.id, m.fade, "fade");
    keyed(m.id, m.world?.path, "world.path");
    keyed(m.id, m.world?.hands, "world.hands");
    if (m.world?.hands)
      checkHolds(m.id, m.world.hands, held, scene.cast, scene.items, () =>
        holderDims(heights[m.id] ?? 1),
      );
    if (m.world) {
      if (!scene.lens) fail(`${m.id}: có \`world\` thì cảnh phải có \`lens\``);
      if (m.mount || m.sit)
        fail(
          `${m.id}: \`world\` không đi cùng \`mount\` hay \`sit\` — người 3D ngồi bằng \`world.sit\``,
        );
      if (m.path) fail(`${m.id}: có \`world\` thì đường đi là \`world.path\` — bỏ \`path\``);
    }
    if ((m.mount || m.sit) && m.group)
      fail(`${m.id}: đang cưỡi hay ngồi xe thì đi theo chủ — bỏ \`group\``);
    if ((m.mount || m.sit) && m.zParts)
      fail(`${m.id}: \`zParts\` không đi cùng \`mount\` hay \`sit\``);
    if ((m.mount || m.sit) && m.rotate)
      fail(`${m.id}: \`rotate\` không đi cùng \`mount\` hay \`sit\` — tư thế là của chỗ ngồi`);
    if (m.mount) {
      beast(m.id, m.mount.on, "mount");
      if (m.path) fail(`${m.id}: đang cưỡi thì không có \`path\` — đường đi là của con vật`);
      if (m.flip !== false) fail(`${m.id}: đang cưỡi thì không có \`flip\` — hướng là của con vật`);
    }
    if (m.sit) {
      if (m.mount) fail(`${m.id}: không vừa cưỡi vừa ngồi xe`);
      const p =
        scene.props.find((q) => q.id === m.sit?.in) ??
        fail(`${m.id}: không có \`${m.sit.in}\` trong \`props\``);
      const spec =
        propSpecs[p.prop] ??
        fail(`${m.id}: ngồi \`${p.id}\` thì \`resolveScene\` cần JSON đạo cụ \`${p.prop}\``);
      if (!propSeat(spec)) fail(`${m.id}: \`${p.prop}\` không có chỗ ngồi (\`seat\`)`);
      if (m.path) fail(`${m.id}: đang ngồi xe thì không có \`path\` — đường đi là của đạo cụ`);
      if (m.flip !== false)
        fail(`${m.id}: đang ngồi xe thì không có \`flip\` — hướng là của đạo cụ`);
    }
    const socks = new Set<string>();
    for (const c of m.carry) {
      beast(m.id, c.animal, "carry");
      if (socks.has(c.socket)) fail(`${m.id}: hai con cùng cầm ở \`${c.socket}\``);
      socks.add(c.socket);
    }
    const tracks = m.tracks.map((t) => resolveTrack(t, base, m.scale, m.id, actions, stride));
    if (m.world?.path)
      for (const tr of tracks)
        for (const c of tr.clips) {
          if (!c.action || !writesLegs(c)) continue;
          const st = stride(c.action, base);
          if (Math.abs(st) > STRIDE_MIN) c.stride = st;
        }
    return {
      ...m,
      ...at,
      base,
      flip: flipKeys(m.flip, m.id).map((k) => ({ ...k, v: k.v !== mirror })),
      view: viewKeys(m.view, m.id, "view"),
      headView: m.headView && viewKeys(m.headView, m.id, "headView"),
      tracks,
    };
  });
  const props = scene.props.map((p) => {
    claim(p.id);
    if (
      p.follow &&
      !scene.cast.some((m) => m.id === p.follow) &&
      !beasts.some((a) => a.id === p.follow)
    )
      fail(`${p.id}: \`follow\` trỏ tới \`${p.follow}\` không có trong \`cast\` hay \`animals\``);
    if (p.follow && p.path) fail(`${p.id}: có \`follow\` thì không có \`path\``);
    // Đạo cụ theo người đọc chỗ đứng 2D của chủ; người 3D cầm đồ bằng `equip`
    if (scene.cast.some((m) => m.id === p.follow && m.world))
      fail(
        `${p.id}: \`follow\` không theo được người 3D \`${p.follow}\` — cho người ấy cầm bằng \`equip\``,
      );
    if (p.anchor && !beasts.some((a) => a.id === p.follow))
      fail(
        `${p.id}: \`anchor\` là mốc trên con vật, cần \`follow\` trỏ tới một con trong \`animals\``,
      );
    if (p.follow && p.group) fail(`${p.id}: có \`follow\` thì đi theo chủ — bỏ \`group\``);
    const { mirror, ...at } = placed(p.id, p, p.y, p.follow ? 0 : scene.ground);
    return { ...p, ...at, flip: p.flip !== mirror, spec: propSpecs[p.prop] };
  });
  // Người ngồi xe đi theo xe, xe đi theo người: chuỗi ấy khép lại là `propAt` gọi mình mãi
  for (const m of scene.cast) {
    const trail = [m.id];
    let id: string | undefined = m.sit?.in;
    while (id) {
      const p = scene.props.find((q) => q.id === id);
      const next = p?.follow;
      if (next && trail.includes(next))
        fail(`${trail.join(" → ")} → ${id} → ${next}: ngồi xe đi theo chính mình`);
      if (!next) break;
      trail.push(next);
      id = scene.cast.find((c) => c.id === next)?.sit?.in;
    }
  }
  if (scene.items) checkItems(scene.items, held, scene.cast);
  const duration = scene.duration ?? sceneEnd(cast, beasts);
  return {
    name: scene.name,
    marks: scene.marks,
    duration,
    frame: FRAMES[scene.frame],
    ground: scene.ground,
    bg: scene.bg,
    camera: scene.camera,
    groups: scene.groups,
    fx: scene.fx,
    ...(scene.lens && {
      lens: { ...scene.lens, yaw: scene.lens.yaw * D, pitch: scene.lens.pitch * D },
    }),
    cast: cast.map((m) => ({
      ...m,
      travel: drifts(m) ? bakeTravel((t) => poseAt(m, t), duration) : STILL,
    })),
    props,
    heights,
    bodies,
    held,
    ...(scene.items && { items: scene.items }),
    animals: beasts.map((a) => {
      const host = hosts.get(a.id);
      const m = { ...a, host };
      // Đang bay thì không bàn chân nào: `bakeFeetTravel` đứng yên chứ không giữ đà
      return {
        ...m,
        travel: bakeFeetTravel(
          (t) => (animalAirborne(m, t) ? [] : animalFeet(a.spec, animalPoseOf(m, t))),
          duration,
        ),
      };
    }),
  };
}

/** Như `resolveTrack` cho động vật: τ đo trên các kênh hoà được, nền là tư thế đứng của chính con ấy. */
function resolveAnimalTrack(
  raw: SceneSpec["animals"][number]["tracks"][number],
  spec: AnimalData,
  scale: number,
  who: string,
  actions: Record<string, ActionData>,
): AnimalTrack {
  const base = animalStand(spec);
  const tr: AnimalTrack = { name: raw.name, clips: [] };
  raw.clips.forEach((r, i) => {
    const where = `${who}/${raw.name ?? i} clip ${i}`;
    if (i > 0 && r.start <= raw.clips[i - 1].start) fail(`${where}: \`start\` phải tăng dần`);
    const action = r.action ? actions[r.action] : undefined;
    if (r.action && !action) fail(`${where}: không có hành động \`${r.action}\``);
    if (action && action.schemaVersion !== ACTION_VERSION)
      fail(`${where}: \`${r.action}\` chưa qua \`parseAction\``);
    if (action && actionKind(action) !== "animal")
      fail(`${where}: \`${r.action}\` là hành động của người, không phải của động vật`);
    const cycle = cycleForSpeed(r, () => animalStride(spec, action as ActionData), scale, where);
    const c: AnimalClip = {
      start: r.start,
      file: r.action,
      action,
      cycle: cycle ?? action?.duration ?? 1,
      phase: r.phase,
      mask: r.mask,
      tau: r.blend ?? 0,
    };
    tr.clips.push(c);
    if (r.blend === undefined && !(i === 0 && r.start === 0))
      c.tau = blendAnimalDuration(
        base,
        i === 0 ? {} : animalPoseUpTo(tr, i - 1, c.start, base, spec),
        animalClipPose(c, c.start, spec),
      );
  });
  return tr;
}

type PathKey0 = Unmarked<z.infer<typeof PathKeySchema>>;

/**
 * Quãng một lượt hành động trôi ngang, đơn vị rig ở `height = 1`; âm là đi lùi. Đo bằng
 * chính `bakeTravel`, nên nó khớp với trôi ngang lúc vẽ — `clips[].speed` chia cho số này.
 * `legs` đo trên độ dài chân khác rig đang cài (`stickman reseat`).
 */
export function actionStride(a: ActionData, base: Pose = POSES.idle, legs?: Legs): number {
  // hành động soạn ở `side` thì chân của nó là chân nâng: bàn chân đang bước dang ra cao lên như người 3D dựng
  const side = a.authoredAt === "side";
  const lift = { lf: true, ln: true };
  const tb = bakeTravel(
    (t) =>
      side ? { ...composePose(base, actionPose(a, t)), lift } : composePose(base, actionPose(a, t)),
    1,
    legs,
    side,
  );
  return tb.xs[tb.xs.length - 1];
}

/** Như `actionStride` cho động vật: một lượt hành động, đơn vị rig của chính con ấy; bay thì không trôi. */
export function animalStride(spec: AnimalData, a: ActionData): number {
  if (actionAirborne(a)) return 0;
  const stand = animalStand(spec);
  const tb = bakeFeetTravel(
    (t) => animalFeet(spec, composeAnimalPose(stand, animalActionPose(a, t, spec) ?? {})),
    1,
  );
  return tb.xs[tb.xs.length - 1];
}

/** Hết clip cuối của mọi người và mọi con vật: mốc bắt đầu của nó cộng một lượt (clip rỗng thì cộng τ). */
const sceneEnd = (cast: Acting[], animals: Pick<AnimalMember, "tracks">[]): number =>
  Math.max(
    0,
    ...[...cast, ...animals].flatMap((m) =>
      m.tracks.map((t: Track | AnimalTrack) => {
        const c = t.clips[t.clips.length - 1];
        return c.start + (c.action ? c.cycle : c.tau);
      }),
    ),
  );

const member = (rt: SceneRuntime, id: string): CastMember =>
  rt.cast.find((m) => m.id === id) ?? fail(`không có \`${id}\` trong \`cast\``);

const turned = new WeakMap<CharacterData, Map<number, CharacterData>>();

/**
 * JSON nhân vật mà một người trong cảnh diễn bằng: `cast[].turn` đè `face.turn`. Mọi chỗ vẽ hay
 * đo người của scene đi qua đây; cùng đầu vào trả cùng object nên `<Character>` không vẽ lại.
 */
export function castCharacter(m: Pick<CastData, "turn">, c: CharacterData): CharacterData {
  if (m.turn === undefined || m.turn === c.face.turn) return c;
  let byTurn = turned.get(c);
  if (!byTurn) turned.set(c, (byTurn = new Map()));
  let out = byTurn.get(m.turn);
  if (!out) byTurn.set(m.turn, (out = { ...c, face: { ...c.face, turn: m.turn } }));
  return out;
}

/** Tư thế ở một mẫu của chuỗi cổ tay mang món (`ReachHold.prior`): mỗi mẫu một lần cho một runtime */
const keyPoses = new WeakMap<SceneRuntime, Map<string, ScenePose>>();

function keyPose(rt: SceneRuntime, id: string, t: number, height: number, dims: Body3): ScenePose {
  let m = keyPoses.get(rt);
  if (!m) keyPoses.set(rt, (m = new Map()));
  const k = `${id}|${t}|${height}|${dims.legHalf}|${dims.hipHalf}`;
  let sp = m.get(k);
  if (!sp) m.set(k, (sp = sceneAt(rt, id, t, height, dims)));
  return sp;
}

/**
 * Tư thế, lớp, nét mặt và chỗ đứng của một người tại `time` giây; `height` là
 * `rig.height` của người diễn, trôi ngang tỉ lệ với nó. Track sau đè track trước.
 * `base` của mỗi track là **thứ nằm dưới nó**, không phải `base` của scene: nhả một
 * track là lộ ra track dưới, hoà về `base` thì cuối đoạn nhả có cú giật.
 */
export function sceneAt(
  rt: SceneRuntime,
  id: string,
  time: number,
  height = 1,
  dims: Body3 = rt.bodies[id] ?? BODY3,
): ScenePose {
  // Chỗ gọi JS còn truyền nửa bề dày đùi như số thì mọi toạ độ 3D ra NaN, không gì báo
  if (typeof dims !== "object")
    fail("`sceneAt`: tham số thứ năm là `body3(nhân vật)`, không phải số");
  const m = member(rt, id);
  const walk = walkerOf(rt, m, height, dims.hipHalf);
  const clock = walk && clockOf(walk);
  const layers: Partial<ArmLayers>[] = [];
  const faces: Partial<FaceState>[] = [];
  const equips: EquipStep[][] = [];
  for (const tr of m.tracks) {
    const i = activeClip(tr, time);
    if (i < 0) continue;
    layers.push(layersUpTo(tr, i, time, clock));
    faces.push(faceUpTo(tr, i, time, clock));
    equips.push(equipUpTo(tr, i, time, clock));
  }
  const pose = worldPoseAt(m, time, walk, height, dims.hipHalf);
  // Thân lật thì `poseAt` đổi kênh tay gần ↔ xa: lớp hành động khai theo cùng tay ấy; lớp mặc định
  // vẫn theo chỗ gần / xa nên đổi trước khi ghép với nó
  const own = clock && clock(time).half % 2 ? layers.map(swapLayers) : layers;
  const placed =
    m.world && rt.lens && worldAt(rt.lens, m.world, time, pose, height, dims.legHalf, walk).world;
  const world =
    placed && m.world?.hands
      ? withHands(
          placed,
          m.world.hands,
          time,
          rt.held,
          (who, mark) => castMarkAt(rt, who, mark, time),
          (t) => keyPose(rt, id, t, height, dims),
          { rt, height, id },
        )
      : placed;
  const body = world ? viewOfTheta(world.theta) : stepOf(m.view, time);
  const views = clampViews({ body, head: m.headView && !world ? stepOf(m.headView, time) : body });
  const spot3 = world && {
    x: project(world.lens, world.hip)[0],
    groundY: project(world.lens, world.hip)[1],
    scale: scaleAt(world.lens, world.hip) * world.s,
    flip: world.flip,
    root: "hip" as const,
    rotate: 0,
    world,
  };
  return {
    pose,
    view: views.body,
    headView: views.head,
    layers: composeLayers(...own),
    equip: composeEquip(m.equip, ...equips),
    ...composeFace(...faces),
    ...(spot3
      ? spot3
      : m.mount
        ? rideAt(rt, m, time)
        : m.sit
          ? sitAt(rt, m, time)
          : {
              ...spotAt(m, time, height),
              flip: flipOf(m.flip, time),
              root: "feet" as const,
              rotate: m.rotate,
            }),
    opacity: m.fade ? fadeAt(m.fade, time) : 1,
    carried: m.carry.map((c) => carryAt(rt, c)),
  };
}

/**
 * Người cưỡi: hông đặt vào yên con vật tại `time`, nên nhún, chồm và trôi theo lưng nó tự có.
 * Trả kèm chỗ đặt con vật **trong hệ của người** — con vật vẽ ở khe `slots.mount`, giữa chân
 * xa và chân gần, nên phải quy về hệ ấy: người là gốc, con vật đi vào trong.
 */
function rideAt(rt: SceneRuntime, m: CastMember, time: number) {
  const on = m.mount as NonNullable<CastMember["mount"]>;
  const a = animalMember(rt, on.on);
  const at = animalSpotOf(a, time);
  const F = computeAnimalFigure(a.spec, animalPoseOf(a, time));
  const sx = F.saddle[0] + on.dx;
  const sy = F.saddle[1] + on.dy - drop(F, at.root);
  const dir = at.flip ? -1 : 1;
  const k = 1 / m.scale;
  return {
    x: at.x + at.scale * dir * sx,
    groundY: at.groundY + at.scale * sy,
    scale: at.scale * m.scale,
    flip: at.flip,
    root: "hip" as const,
    rotate: 0,
    mounted: {
      id: a.id,
      x: -k * sx,
      groundY: -k * sy,
      scale: k,
      root: at.root,
      legLayer: at.legLayer,
    },
  };
}

/** Gốc `feet` treo con vật ở bàn chân thấp nhất, gốc `hip` ở chính khớp hông — cùng phép tính với `rootDrop` của rig. */
const drop = (F: AnimalFigure, root: Root) => (root === "hip" ? 0 : F.lowest);

/**
 * Người ngồi xe: hông đặt vào chỗ ngồi của đạo cụ tại `time`, đi theo và lật theo nó. Đạo cụ
 * theo ai thì chỗ đứng ấy đã lấy `rt.heights` của người đó — không nhận `height` ở đây.
 */
function sitAt(rt: SceneRuntime, m: CastMember, time: number) {
  const on = m.sit as NonNullable<CastMember["sit"]>;
  const p = propMember(rt, on.in);
  const seat = propSeat(p.spec as PropData) as { x: number; y: number };
  const at = propAt(rt, p.id, time);
  const dir = at.flip ? -1 : 1;
  return {
    x: at.x + at.scale * dir * (seat.x + on.dx),
    groundY: at.groundY + at.scale * (seat.y + on.dy),
    scale: at.scale * m.scale,
    flip: at.flip,
    root: "hip" as const,
    rotate: 0,
  };
}

/** Con vật trong tay: điểm `anchor` của nó đặt vào `dx`/`dy` của khung cổ tay, xoay `rotate` quanh đó. */
function carryAt(rt: SceneRuntime, c: CarryData): CarrySpot {
  const a = animalMember(rt, c.animal);
  const F = computeAnimalFigure(a.spec, animalHang(a.spec));
  const p = animalAnchorOf(a.spec, F, c.anchor);
  const k = a.scale;
  const r = -c.rotate * D;
  const fx = c.flip ? -1 : 1;
  // Gốc `hip` của <Animal>: điểm `p` sau translate · rotate · scale · lật nằm ở R(−rotate)·k·p
  const px = fx * p.x * k;
  const py = p.y * k;
  return {
    id: a.id,
    socket: c.socket,
    x: c.dx - (px * Math.cos(r) - py * Math.sin(r)),
    groundY: c.dy - (px * Math.sin(r) + py * Math.cos(r)),
    scale: k,
    rotate: c.rotate,
    flip: c.flip,
    root: "hip",
  };
}

const animalMember = (rt: SceneRuntime, id: string): AnimalMember =>
  rt.animals.find((a) => a.id === id) ?? fail(`không có \`${id}\` trong \`animals\``);

const inAnimalMask = (c: AnimalClip, k: AnimalChannel) => !c.mask || c.mask.includes(k);

function animalClipPose(c: AnimalClip, time: number, spec: AnimalData): Partial<AnimalPose> {
  if (!c.action) return {};
  const d = animalActionDelta(c.action, phaseAt(c, time), spec);
  for (const k of ANIMAL_JOINT_CHANNELS) if (!inAnimalMask(c, k)) delete d[k];
  return animalDeltaPose(d);
}

const animalClipFace = (c: AnimalClip, time: number): Partial<AnimalFace> =>
  c.action && inAnimalMask(c, "face") ? animalActionFace(c.action, phaseAt(c, time)) : {};

/** Như `poseUpTo` cho động vật; chân không hoà — xem `blendAnimalPose`. */
function animalPoseUpTo(
  tr: AnimalTrack,
  i: number,
  time: number,
  base: AnimalPose,
  spec: AnimalData,
): Partial<AnimalPose> {
  const c = tr.clips[i];
  const p = animalClipPose(c, time, spec);
  const s = time - c.start;
  if (s >= c.tau) return p;
  return blendAnimalPose(
    base,
    i === 0 ? {} : animalPoseUpTo(tr, i - 1, time, base, spec),
    p,
    s / c.tau,
  );
}

function animalFaceUpTo(tr: AnimalTrack, i: number, time: number): Partial<AnimalFace> {
  const c = tr.clips[i];
  const f = animalClipFace(c, time);
  const s = time - c.start;
  if (s >= c.tau) return f;
  return blendFace(i === 0 ? {} : animalFaceUpTo(tr, i - 1, time), f, s / c.tau);
}

type Beast = Omit<AnimalMember, "travel">;

/** Tư thế con vật tại `time`: track sau đè track trước lên nền đứng — hay buông chân nếu đang bị xách. */
function animalPoseOf(a: Beast, time: number): AnimalPose {
  let pose = a.host?.kind === "carry" ? animalHang(a.spec) : animalStand(a.spec);
  for (const tr of a.tracks) {
    const i = activeClip(tr, time);
    if (i >= 0) pose = composeAnimalPose(pose, animalPoseUpTo(tr, i, time, pose, a.spec));
  }
  return pose;
}

function animalFaceOf(a: Beast, time: number): AnimalFace {
  const faces: Partial<AnimalFace>[] = [];
  for (const tr of a.tracks) {
    const i = activeClip(tr, time);
    if (i >= 0) faces.push(animalFaceUpTo(tr, i, time));
  }
  return Object.assign({}, DEFAULT_ANIMAL_FACE, ...faces) as AnimalFace;
}

/**
 * Đang trên không: clip **trên cùng đang ghi chân** quyết định — track trên không ghi chân
 * thì chân là của track dưới, và cùng với chân là chuyện có chạm đất hay không.
 */
function animalAirborne(a: Beast, time: number): boolean {
  for (let k = a.tracks.length - 1; k >= 0; k--) {
    const tr = a.tracks[k];
    const i = activeClip(tr, time);
    if (i < 0) continue;
    const c = tr.clips[i];
    if (!c.action) continue;
    const mask = animalActionMask(c.action);
    if (!ANIMAL_LEG_CHANNELS.some((ch) => mask.includes(ch) && inAnimalMask(c, ch))) continue;
    return actionAirborne(c.action);
  }
  return false;
}

/**
 * Chỗ đứng của con vật. Đang bay thì treo ở hông (`root: "hip"`) và hạ `groundY` đúng một
 * `rig.hipY` để hông cao ngang lúc đứng: cất cánh tại chỗ không nhảy, `path.y` là độ cao thêm.
 */
function animalSpotOf(
  a: AnimalMember,
  time: number,
): Spot & { flip: boolean; root: Root; legLayer: "under" | "over" } {
  const spot = a.path
    ? pathAt(a.path, time)
    : { x: a.x + a.scale * travelSigned(a, time), groundY: a.y, scale: a.scale };
  const fly = animalAirborne(a, time);
  return {
    ...spot,
    groundY: fly ? spot.groundY - spot.scale * a.spec.rig.hipY : spot.groundY,
    flip: flipOf(a.flip, time),
    root: fly ? "hip" : "feet",
    legLayer: fly ? "over" : "under",
  };
}

/**
 * Tư thế và chỗ đứng của một con vật tại `time`; `<Animal>` nhận thẳng. Con đang bị cưỡi vẫn
 * có chỗ đứng của chính nó (người theo nó). Con đang bị xách thì mượn chỗ đứng của người xách —
 * chỗ chính xác trong tay nằm ở `sceneAt(...).carried`, và ba đường render vẽ nó qua
 * `castSlots`, không đặt rời.
 */
export function animalAt(rt: SceneRuntime, id: string, time: number): AnimalSpot {
  const a = animalMember(rt, id);
  const pose = animalPoseOf(a, time);
  const face = animalFaceOf(a, time);
  const opacity = a.fade ? fadeAt(a.fade, time) : 1;
  if (a.host?.kind === "carry") {
    const h = sceneAt(rt, a.host.id, time);
    return {
      pose,
      ...face,
      x: h.x,
      groundY: h.groundY,
      scale: h.scale * a.scale,
      flip: h.flip,
      root: "hip",
      legLayer: "under",
      opacity,
    };
  }
  return { pose, ...face, ...animalSpotOf(a, time), opacity };
}

/**
 * Socket mà nhiều track của cùng một người cùng ghi `equip`. Nó là công tắc, và track sau
 * đè track trước ở mọi giây nó đã ghi — cái gỡ mũ khỏi tay ở track trước bị track sau cầm
 * đồ đè lại: nhân vật đội mũ mà tay vẫn cầm thêm một cái. Không nổ ở đâu cả, nên `check`
 * và `validate` là chỗ duy nhất nó kêu. docs/03-scene.md
 */
export function sceneEquipProblems(
  scene: SceneData,
  actions: Record<string, ActionData>,
): string[] {
  const out: string[] = [];
  for (const m of scene.cast) {
    const by = new Map<string, Set<number>>();
    m.tracks.forEach((tr, ti) => {
      for (const clip of tr.clips) {
        const socks = [
          ...equipSteps(clip.equip).flatMap((s) => (typeof s === "string" ? [] : Object.keys(s))),
          ...(clip.action && actions[clip.action] ? equipSockets(actions[clip.action]) : []),
        ];
        for (const k of socks) {
          const seen = by.get(k) ?? new Set<number>();
          by.set(k, seen.add(ti));
        }
      }
    });
    for (const [k, tracks] of by)
      if (tracks.size > 1)
        out.push(
          `cast ${m.id}: socket \`${k}\` bị ${tracks.size} track cùng ghi (${[...tracks].join(", ")}) — track sau đè track trước, chữa bằng một clip nói ngược lại trên chính track kia`,
        );
  }
  return out;
}

/** Một lần sự kiện của hành động rơi xuống timeline scene. */
export interface SceneEvent {
  /** Giây scene */
  t: number;
  name: string;
  /** `cast[].id` của người diễn */
  cast: string;
  /** Chỉ số track và chỉ số clip trong track ấy */
  track: number;
  clip: number;
  /** Tên file hành động */
  action?: string;
}

/** Chặn vòng lặp chạy dại khi `cycle` bé xíu mà clip dài; sự kiện nhiều thế là do JSON sai. */
const EVENT_CAP = 10000;

/**
 * Mọi `events[]` của mọi clip, đã đổi sang **giây scene** và sắp theo thời gian. Clip
 * `wrap` lặp thì sự kiện lặp theo; `hold` thì đúng một lần. Đây là chỗ hỏi "lưỡi rìu chạm
 * gỗ ở giây nào" — thay cho việc lọc clip theo tên hành động rồi cộng tay `phase` với
 * `cycle` ở repo video. docs/03-scene.md
 */
export function sceneEvents(rt: SceneRuntime, name?: string): SceneEvent[] {
  const out: SceneEvent[] = [];
  for (const m of [...rt.cast, ...rt.animals]) {
    const walk =
      "world" in m
        ? walkerOf(rt, m, rt.heights[m.id] ?? 1, (rt.bodies[m.id] ?? BODY3).hipHalf)
        : undefined;
    m.tracks.forEach((tr: Track | AnimalTrack, ti) =>
      tr.clips.forEach((c, ci) => {
        if (!c.action?.events.length) return;
        const end = tr.clips[ci + 1]?.start ?? rt.duration;
        const clock = walk && (c as Clip).stride ? clockOf(walk) : undefined;
        for (const e of actionEvents(c.action)) {
          if (name !== undefined && e.name !== name) continue;
          const put = (t: number) => {
            if (t >= c.start && t < end)
              out.push({ t, name: e.name, cast: m.id, track: ti, clip: ci, action: c.file });
          };
          // Pha lúc `time` là `(time - start) / cycle + phase`; giải ngược ra giây scene
          const at = (n: number) =>
            clock ? clockTime(c, e.t + n, end, clock) : c.start + (e.t + n - c.phase) * c.cycle;
          if (c.action.end === "hold") {
            put(at(0));
            continue;
          }
          let n = Math.ceil(c.phase - e.t);
          for (let i = 0; i < EVENT_CAP && at(n) < end; i++, n++) put(at(n));
        }
      }),
    );
  }
  return out.sort((a, b) => a.t - b.t);
}

/**
 * Giây scene đầu tiên mà clip chạy theo đồng hồ của người 3D tới pha `phase`; không tới trước `end`
 * thì `Infinity`, đã qua trước `start` thì `-Infinity`
 */
function clockTime(
  c: { start: number; cycle: number; phase: number },
  phase: number,
  end: number,
  clock: Clock,
): number {
  if (clockPhase(c, end, clock) < phase) return Infinity;
  if (phase < c.phase) return -Infinity;
  let [lo, hi] = [c.start, end];
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (clockPhase(c, mid, clock) < phase) lo = mid;
    else hi = mid;
  }
  return hi;
}

/** Một quãng giây scene `[from, to)` không ai trên sân khấu đi đâu cả */
export interface StillSpan {
  from: number;
  to: number;
}

/** Bước lấy mẫu chỗ đứng khi dò quãng đứng yên, giây scene */
const STILL_STEP = 1 / 15;
/** Trôi ngang chậm hơn ngần này đơn vị sân khấu mỗi giây thì coi như đứng yên */
const STILL_SPEED = 5;

/**
 * Những quãng **cả sân khấu đứng yên**: không người hay con vật nào trôi ngang, và không
 * clip nào đang là hành động có sải chân — người giậm chân tại chỗ (`path` ghim một chỗ)
 * vẫn là đang bước. `min` là quãng ngắn hơn thì bỏ qua. Bè lặp tiếng bước, tiếng vó kêu
 * đè lên một quãng ở đây là tiếng còn chạy sau khi người đã dừng: docs/07-lam-tap.md.
 */
export function stillSpans(rt: SceneRuntime, min = 0): StillSpan[] {
  const strides = new Map<ActionData, number>();
  const stride = (a: ActionData, spec?: AnimalData) => {
    let v = strides.get(a);
    if (v === undefined) strides.set(a, (v = spec ? animalStride(spec, a) : actionStride(a)));
    return v;
  };
  const gaits: StillSpan[] = [];
  const walked = (clips: Clip[] | AnimalClip[], i: number, next: number, spec?: AnimalData) => {
    const c = clips[i];
    if (!c.action || stride(c.action, spec) === 0) return;
    // `end: "hold"` là đi đúng một lượt rồi đứng lại, dù clip còn giữ track tới tận đây
    gaits.push({
      from: c.start,
      to: c.action.end === "hold" ? Math.min(next, c.start + c.cycle) : next,
    });
  };
  for (const m of rt.cast)
    for (const tr of m.tracks)
      tr.clips.forEach((_, i) => walked(tr.clips, i, tr.clips[i + 1]?.start ?? rt.duration));
  for (const a of rt.animals)
    for (const tr of a.tracks)
      tr.clips.forEach((_, i) =>
        walked(tr.clips, i, tr.clips[i + 1]?.start ?? rt.duration, a.spec),
      );

  const spots = (t: number) => [
    ...rt.cast.map((m) => sceneAt(rt, m.id, t, rt.heights[m.id] ?? 1).x),
    ...rt.animals.map((a) => animalAt(rt, a.id, t).x),
  ];
  const out: StillSpan[] = [];
  let prev = spots(0);
  for (let t = 0; t < rt.duration; t += STILL_STEP) {
    const to = Math.min(t + STILL_STEP, rt.duration);
    const now = spots(to);
    const mid = (t + to) / 2;
    const still =
      now.every((x, i) => Math.abs(x - prev[i]) <= STILL_SPEED * (to - t)) &&
      !gaits.some((g) => g.from <= mid && mid < g.to);
    prev = now;
    const last = out[out.length - 1];
    if (!still) continue;
    if (last && last.to >= t - STILL_STEP / 2) last.to = to;
    else out.push({ from: t, to });
  }
  return out.filter((s) => s.to - s.from >= min);
}

/** Nội suy thẳng giữa hai mốc mờ, giữ ở hai đầu */
function fadeAt(keys: FadeKey[], time: number): number {
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].t <= time) i++;
  const a = keys[i];
  const b = keys[i + 1];
  if (!b || time <= a.t) return a.v;
  return a.v + (b.v - a.v) * ((time - a.t) / (b.t - a.t));
}

/** Lấy mẫu bậc thang, như `layer` và `equip`: hướng của mốc cuối cùng đã tới. */
const flipOf = (keys: FlipKey[], time: number): boolean => stepOf(keys, time);

function stepOf<T>(keys: { t: number; v: T }[], time: number): T {
  let v = keys[0].v;
  for (const k of keys) {
    if (k.t > time) break;
    v = k.v;
  }
  return v;
}

/** Hướng nhìn của một người tại `time`; đạo cụ theo họ và ba đường render dùng chung. */
export const flipAt = (rt: SceneRuntime, id: string, time: number): boolean =>
  flipOf(member(rt, id).flip, time);

type Spot = Pick<ScenePose, "x" | "groundY" | "scale">;

/** Người trôi ngang bằng bảng `travel`: còn lại đứng theo `world`, `path`, yên con vật hay chỗ ngồi — đường của `spotAt` / `hostSpot` */
const drifts = (m: Pick<CastMember, "world" | "path" | "mount" | "sit">): boolean =>
  !m.world && !m.path && !m.mount && !m.sit;

/** Bảng của người không trôi theo chân: `travelAt` ra 0 ở mọi `t` */
const STILL: TravelTable = { step: TRAVEL_STEP, xs: [0] };

const spotAt = (m: CastMember, time: number, height: number): Spot =>
  m.path
    ? pathAt(m.path, time)
    : { x: m.x + m.scale * height * travelSigned(m, time), groundY: m.y, scale: m.scale };

/**
 * Trôi ngang cộng dồn từng đoạn hướng: `Σ dirₖ · (T(min(t, tₖ₊₁)) − T(tₖ))`. Nhân dấu ở
 * ngoài tích phân — `dir(t) · T(t)` — là lật một cái người nhảy `2 · T(t)`.
 */
function travelSigned(m: { flip: FlipKey[]; travel: TravelTable }, time: number): number {
  let x = 0;
  for (let i = 0; i < m.flip.length && m.flip[i].t < time; i++) {
    const to = Math.min(time, m.flip[i + 1]?.t ?? time);
    x += (m.flip[i].v ? -1 : 1) * (travelAt(m.travel, to) - travelAt(m.travel, m.flip[i].t));
  }
  return x;
}

const propMember = (rt: SceneRuntime, id: string): PropMember =>
  rt.props.find((p) => p.id === id) ?? fail(`không có \`${id}\` trong \`props\``);

/**
 * Chỗ đứng của một đạo cụ tại `time`; `height` là `rig.height` của người nó theo (nếu
 * có), bỏ trống là tra `rt.heights`. Đi theo ai thì mượn chỗ đứng, `scale` và hướng của
 * người ấy rồi cộng độ lệch.
 */
export function propAt(rt: SceneRuntime, id: string, time: number, height?: number): PropPose {
  const p = propMember(rt, id);
  let spot: Spot & { flip: boolean };
  if (p.follow) {
    const beast = rt.animals.find((a) => a.id === p.follow);
    let at = beast
      ? animalSpotOf(beast, time)
      : hostSpot(rt, member(rt, p.follow), time, height ?? rt.heights[p.follow] ?? 1);
    if (beast && p.anchor) {
      // Gốc đạo cụ dời tới mốc trên con vật; `x`/`y` cộng tiếp từ đó
      const F = computeAnimalFigure(beast.spec, animalPoseOf(beast, time));
      const q = animalAnchorOf(beast.spec, F, p.anchor);
      const root = (at as { root?: Root }).root ?? "feet";
      at = {
        ...at,
        x: at.x + (at.flip ? -1 : 1) * at.scale * q.x,
        groundY: at.groundY + at.scale * (q.y - drop(F, root)),
      };
    }
    spot = {
      x: at.x + (at.flip ? -1 : 1) * at.scale * p.x,
      groundY: at.groundY + at.scale * (p.y as number),
      scale: at.scale * p.scale,
      flip: at.flip !== p.flip,
    };
  } else {
    spot = {
      ...(p.path ? pathAt(p.path, time) : { x: p.x, groundY: p.y as number, scale: p.scale }),
      flip: p.flip,
    };
  }
  return { ...spot, roll: spot.x, ...(p.follow && p.y !== 0 ? { shadow: 0 } : {}) };
}

/** Chỗ đứng và hướng của một người, kể cả khi đang cưỡi (yên con vật) hay ngồi xe (chỗ ngồi của đạo cụ). */
function hostSpot(rt: SceneRuntime, m: CastMember, time: number, height: number) {
  if (m.mount || m.sit) {
    const r = m.mount ? rideAt(rt, m, time) : sitAt(rt, m, time);
    return { x: r.x, groundY: r.groundY, scale: r.scale, flip: r.flip };
  }
  return { ...spotAt(m, time, height), flip: flipOf(m.flip, time) };
}

/**
 * Khung camera tại `time`. Không có mốc nào là đúng khung sân khấu của cảnh — cỡ chung của
 * cả tập, đừng bịa một cỡ riêng cho một cảnh; đổi khung là đổi `scene.frame`. Ba đường
 * render gọi chính hàm này, nên dải ảnh và mp4 thấy đúng cái Remotion thấy. docs/03-scene.md#camera
 */
export function cameraAt(rt: SceneRuntime, time: number): CameraShot {
  const at = cameraKey(rt.camera, time);
  const w = rt.frame.w / at.zoom;
  const h = rt.frame.h / at.zoom;
  const view = { x: at.x - w / 2, y: at.y - h / 2, w, h };
  return { ...at, frame: rt.frame, view, viewBox: `${view.x} ${view.y} ${view.w} ${view.h}` };
}

const CAMERA_HOME = { x: 0, y: 0, zoom: 1 };

/** `cut` là giữ nguyên mốc trước rồi nhảy — nên đoạn trước một mốc `cut` không nội suy gì. */
function cameraKey(keys: CameraKey[], time: number): { x: number; y: number; zoom: number } {
  if (!keys.length) return CAMERA_HOME;
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].t <= time) i++;
  const a = keys[i];
  const b = keys[i + 1];
  if (!b || time <= a.t || b.move === "cut") return a;
  let u = (time - a.t) / (b.t - a.t);
  if (b.move === "ease") u = u * u * (3 - 2 * u);
  const mix = (p: number, q: number) => p + (q - p) * u;
  return { x: mix(a.x, b.x), y: mix(a.y, b.y), zoom: mix(a.zoom, b.zoom) };
}

/**
 * Hộp vẽ một lớp nền trong hệ toạ độ sân khấu, tại mốc camera `cam`. `parallax` trôi lớp
 * ấy theo máy quay: `1` không dời gì (dán vào sân khấu), `0` dời đúng bằng camera nên lớp
 * đứng im trên màn hình. Mốc `x`/`y` trong JSON là chỗ lớp nằm khi camera ở nhà (`0, 0`).
 * Hàm thuần và là bảng chung cho cả ba đường render — cộng thêm phần trôi ở chỗ vẽ là mỗi
 * đường ra một khung khác. Đây là ô gốc; chỗ vẽ gọi `bgTiles` để có cả các ô lát. docs/03-scene.md#nền
 */
export function bgRect(
  bg: BgLayerData,
  cam: Pick<CameraShot, "x" | "y" | "frame">,
  canvas = cam.frame,
) {
  const w = canvas.w * bg.scale;
  const h = w / bg.aspect;
  const drift = 1 - bg.parallax;
  return { x: bg.x + drift * cam.x - w / 2, y: bg.y + drift * cam.y - h / 2, w, h };
}

/**
 * Hai ô nền kề nhau **phải chờm lên nhau**, không chỉ chạm mép: chỗ vẽ khử răng cưa mép ảnh,
 * nên hai mép chạm đúng nhau vẫn để lọt nền giấy thành một vạch dọc một pixel. Đơn vị sân
 * khấu, nới đều hai bên mỗi ô — ảnh giãn ra `2·bleed / w`, dưới một phần nghìn.
 */
const BG_TILE_BLEED = 1;

/** Một ô nền đã tính xong chỗ đặt. `transform` có khi ô lật gương — cắm thẳng vào `<image>`. */
export interface BgTile {
  x: number;
  y: number;
  w: number;
  h: number;
  flip: boolean;
  transform?: string;
}

/**
 * Các ô của một lớp nền tại mốc camera `cam`, trái sang phải. `repeat: "none"` là đúng một
 * ô — chính `bgRect` — nên cảnh không khai gì vẽ y như cũ. `tile` chép xuôi sang hai bên,
 * `mirror` lật gương ô lẻ nên mép nối trùng khít, không cần tấm nền vẽ hai mép giống nhau.
 *
 * **Số ô suy từ hộp camera**, không phải người dùng đếm: chỉ những ô cắt vào `cam.view` mới
 * ra, nên lia máy tới đâu có nền tới đó. `bg.tiles` là chặn trên, cắt bớt hai đầu xa tâm
 * khung. Lát chỉ ngang — hở trên dưới là chuyện của `scale` và `y`. Ô lát rộng hơn ô gốc
 * `2·BG_TILE_BLEED` để hai ô chờm lên nhau; `repeat: "none"` thì không.
 *
 * Hàm thuần và là bảng chung cho cả ba đường render: **không đường nào tự nhân ô**, chúng
 * chỉ vẽ danh sách này. docs/03-scene.md#nền
 */
export function bgTiles(
  bg: BgLayerData,
  cam: Pick<CameraShot, "x" | "y" | "view" | "frame">,
  canvas = cam.frame,
): BgTile[] {
  const base = bgRect(bg, cam, canvas);
  if (bg.repeat === "none") return [{ ...base, flip: false }];
  // Ô `k` phủ `[x + k·w, x + (k+1)·w)`; giữ đúng những ô cắt vào hộp nhìn
  let from = Math.floor((cam.view.x - base.x) / base.w);
  let to = Math.ceil((cam.view.x + cam.view.w - base.x) / base.w) - 1;
  // `scale` bé tới mức phép chia tràn số thì thôi lát; không có chặn này là vòng lặp không dừng
  if (!Number.isFinite(from) || !Number.isFinite(to)) return [{ ...base, flip: false }];
  // Chặn trên cắt đều hai bên quanh ô giữa khung, để chỗ hở (nếu có) rơi ra ngoài rìa
  if (to - from + 1 > bg.tiles) {
    const mid = Math.round((from + to) / 2);
    from = mid - (bg.tiles >> 1);
    to = from + bg.tiles - 1;
  }
  const out: BgTile[] = [];
  // Cộng dồn chứ không nhân `k · w`: mép phải ô này là đúng cái số làm mép trái ô sau, nên
  // hai ô kề nhau không hở một ulp
  let seam = base.x + from * base.w;
  const w = base.w + 2 * BG_TILE_BLEED;
  for (let k = from; k <= to; k++, seam += base.w) {
    const x = seam - BG_TILE_BLEED;
    // Ô lẻ lật gương: mép phải của ô chẵn gặp đúng mép phải của ảnh trong ô lẻ
    const flip = bg.repeat === "mirror" && ((k % 2) + 2) % 2 === 1;
    out.push({
      ...base,
      x,
      w,
      flip,
      ...(flip ? { transform: `translate(${2 * x + w} 0) scale(-1 1)` } : {}),
    });
  }
  return out;
}

/** Ảnh mà một scene cần nạp — hiện chỉ các lớp nền. Mọi đường đọc đo `aspect` qua đây. */
export const sceneImages = (scene: SceneData): string[] => [
  ...new Set(scene.bg.map((b) => b.file)),
];

/** Ghi `aspect` đo được vào từng lớp nền, như `applyAspects` làm với mảnh nhân vật */
export function applySceneAspects(scene: SceneData, aspects: Record<string, number>) {
  for (const b of scene.bg) if (aspects[b.file] !== undefined) b.aspect = aspects[b.file];
}

/** Đạo cụ có người ngồi tách làm hai mục `part`; `<Prop part>` nhận thẳng. Không có `part` là vẽ cả */
export type SceneLayer = {
  kind: "cast" | "prop" | "animal";
  id: string;
  part?: "back" | "front";
  /** Người khai `zParts` ra nhiều mục, mỗi mục một lượt `<Character parts>`. Không có là vẽ cả người */
  parts?: BodyPart[];
  /** `z` ở tầng sân khấu của mục này — của chủ cụm nếu nó theo ai; `fx` và lớp vẽ code xen vào theo số này */
  z: number;
};

/**
 * Nấc `z` mặc định của từng loại mục trên sân khấu, dựng lại đúng thứ tự cứng vốn có: nền,
 * `fx` lớp `back`, đạo cụ `back`, con vật `back`, người, con vật `front`, đạo cụ `front`,
 * `fx` lớp `front`, `fx` lớp `ui`. Nền và `fx` **chưa** vào trục của `sceneOrder`: băng `bg`
 * là chỗ `bgOrder` xếp các lớp nền với nhau, băng `fx` giữ chỗ cho `<SceneFx>` — đừng phát
 * lại số của chúng cho thứ khác. docs/03-scene.md#trục-z
 */
export const SCENE_Z = {
  bg: -1000,
  fxBack: -500,
  propBack: -100,
  animalBack: -50,
  cast: 0,
  animalFront: 50,
  propFront: 100,
  fxFront: 500,
  fxUi: 1000,
} as const;

/**
 * Các lớp nền theo thứ tự vẽ, dưới lên: `z` tăng dần, hoà thì giữ nguyên thứ tự mảng. Bỏ
 * trống `z` là `SCENE_Z.bg` cộng thứ tự mảng — cùng một số cho mọi lớp là tự vô hiệu. Ba
 * đường render gọi chung hàm này. docs/03-scene.md#nền
 */
export const bgOrder = (bg: SceneData["bg"]): BgLayerData[] =>
  bg
    .map((b, i) => ({ b, z: b.z ?? SCENE_Z.bg + i }))
    .sort((p, q) => p.z - q.z)
    .map((p) => p.b);

/** `z` cục bộ của đạo cụ đi theo ai đó: chủ nó ở `0`, nên `back`/`front` là ngay dưới / ngay trên */
const FOLLOW_Z = { back: -1, front: 1 } as const;

const propZ = (p: Pick<PropCastData, "z" | "layer" | "follow">): number =>
  p.z ?? (p.follow ? FOLLOW_Z[p.layer] : p.layer === "back" ? SCENE_Z.propBack : SCENE_Z.propFront);

const animalZ = (a: Pick<AnimalCastData, "z" | "layer">): number =>
  a.z ?? (a.layer === "back" ? SCENE_Z.animalBack : SCENE_Z.animalFront);

const castZ = (m: Pick<CastData, "z">): number => m.z ?? SCENE_Z.cast;

/** Các lượt vẽ của một người: khối cùng `z` gộp một lượt; lượt ở `z` của người là lượt mang cụm `follow` */
function castBands(m: Pick<CastData, "z" | "zParts">): { z: number; parts?: BodyPart[] }[] {
  const own = castZ(m);
  if (!m.zParts) return [{ z: own }];
  const bands = new Map<number, BodyPart[]>([[own, []]]);
  for (const p of BODY_PARTS) {
    const upper = UPPER_OF[p];
    const z = m.zParts[p] ?? (upper && m.zParts[upper]) ?? own;
    bands.set(z, [...(bands.get(z) ?? []), p]);
  }
  return [...bands].map(([z, parts]) => ({ z, parts }));
}

/** Một mục của một tầng: `z` trong chính tầng ấy, và những lớp nó nở ra */
type Stage = Omit<SceneLayer, "z">;
type ZItem = { z: number; layers: Stage[] };

/**
 * Sắp một tầng: `z` tăng dần, hoà thì giữ nguyên thứ tự mảng — `sort` của JS ổn định. Mỗi lớp
 * mang `z` của tầng vừa sắp, nên tầng ngoài cùng ghi đè `z` cục bộ bằng `z` sân khấu
 */
const stack = (items: ZItem[]): SceneLayer[] =>
  [...items].sort((a, b) => a.z - b.z).flatMap((i) => i.layers.map((l) => ({ ...l, z: i.z })));

/**
 * Thứ tự vẽ cả cảnh, dưới lên, sắp theo `z` ở **các tầng lồng nhau** chứ không phẳng cả cảnh:
 * tầng sân khấu là nhóm, cùng người không ngồi, con vật không chủ và đạo cụ không theo ai chưa vào
 * nhóm nào; trong một nhóm thì thành viên sắp theo `z` cục bộ, cả nhóm dời theo `z` của nó; người
 * khai `zParts` ra nhiều mục trong chính tầng của mình; trong một cụm
 * thì chủ ở `z` cục bộ `0` và đạo cụ theo nó xếp quanh, cả cụm dời theo `z` của chủ; trong một
 * đạo cụ có người ngồi thì những người ấy sắp theo `z` cục bộ của họ. Con vật có người cưỡi hay
 * xách **không có lớp riêng** — nó vẽ trong người ấy qua `slots`; đạo cụ theo nó bám quanh người
 * ấy. Đạo cụ có người ngồi tách làm `part: "back"`, những người ngồi, `part: "front"` — chỗ cắt
 * ấy không phải một nấc `z`. Ba đường render dùng chung, đừng tự xếp lại. docs/03-scene.md#trục-z
 */
export function sceneOrder(rt: SceneRuntime): SceneLayer[] {
  // Lớp nào đang vẽ một `id`: con vật có chủ thì là chủ nó
  const ownerOf = (id: string) => rt.animals.find((a) => a.id === id)?.host?.id ?? id;
  const cluster = (id: string, self: Stage[]): Stage[] =>
    stack([
      { z: 0, layers: self },
      ...rt.props
        .filter((p) => !!p.follow && ownerOf(p.follow) === id)
        .map((p) => ({ z: propZ(p), layers: propLayers(p) })),
    ]);
  const sitter = (m: CastMember): Stage[] => cluster(m.id, [{ kind: "cast", id: m.id }]);
  const person = (m: CastMember): ZItem[] =>
    castBands(m).map(({ z, parts }) => {
      const self: Stage[] = [{ kind: "cast", id: m.id, ...(parts ? { parts } : {}) }];
      return { z, layers: z === castZ(m) ? cluster(m.id, self) : self };
    });
  const propLayers = (p: PropMember): Stage[] => {
    const inside = rt.cast.filter((m) => m.sit?.in === p.id);
    return inside.length
      ? [
          { kind: "prop", id: p.id, part: "back" },
          ...stack(inside.map((m) => ({ z: castZ(m), layers: sitter(m) }))),
          { kind: "prop", id: p.id, part: "front" },
        ]
      : [{ kind: "prop", id: p.id }];
  };
  const tier = (group?: string): ZItem[] => [
    ...rt.props
      .filter((p) => !p.follow && p.group === group)
      .map((p) => ({ z: propZ(p), layers: propLayers(p) })),
    ...rt.animals
      .filter((a) => !a.host && a.group === group)
      .map((a) => ({
        z: animalZ(a),
        layers: cluster(a.id, [{ kind: "animal" as const, id: a.id }]),
      })),
    ...rt.cast.filter((m) => !m.sit && m.group === group).flatMap(person),
  ];
  return stack([
    ...rt.groups.map((g) => ({ z: g.z ?? SCENE_Z.cast, layers: stack(tier(g.id)) })),
    ...tier(),
  ]);
}

/** Cửa sổ đo trượt chân (giây); chân chịu lực dịch quá nửa quãng hông đi trong cửa sổ là trượt */
const SLIDE_WINDOW = 0.4;
/** Trượt dưới ngần này (đơn vị rig một cửa sổ) thì mắt không thấy, kể cả thân đứng yên */
const SLIDE_MIN = 8;

/**
 * Người 3D trượt trên sàn hay không tới mốc dừng của `path`; chỉ đo người có `world` ở cảnh có
 * `lens`. docs/03-scene.md#check-cho-người-3d
 */
export function sceneSlideProblems(rt: SceneRuntime): string[] {
  return rt.lens ? rt.cast.flatMap((m) => (m.world ? worldSlideProblems(rt, m) : [])) : [];
}

/** Mốc dừng trượt khỏi `at` quá ngần này (đơn vị rig) là người không tới được chỗ khai */
const ARRIVE_MAX = 20;
/** Clip có sải chân chạy mà `path` đứng yên lâu hơn ngần này (giây) là chân đứng sững giữa bước */
const STALL_MIN = 0.25;

/**
 * Trượt của một người 3D, đo trên mặt sàn thế giới: chân chịu lực (luật của
 * `bakeFeetTravel`) dịch trong cửa sổ `SLIDE_WINDOW` quá nửa quãng hông đi cộng `SLIDE_MIN` (đơn
 * vị rig, quy ra thế giới bằng `s`) là trượt. Đoạn có mốc ngồi là hông nội suy, không đo; cú quay
 * tại chỗ bằng bước chân (`turnStep`) không đo, chân xoay của nó trượt cố ý. Kèm hai
 * lỗi của `path`: mốc dừng (đứng yên sau nó, ngồi sau nó, hay mốc cuối) mà hông không tới, và clip
 * có sải chân chạy khi `path` đứng yên.
 */
function worldSlideProblems(rt: SceneRuntime, m: CastMember): string[] {
  const w = m.world as WorldSpec;
  const h = rt.heights[m.id] ?? 1;
  const dims = rt.bodies[m.id] ?? BODY3;
  const unit = w.s;
  const keys = keysOf(w);
  const bad: string[] = [];
  const n = Math.max(1, Math.round(rt.duration / TRAVEL_STEP));
  const dt = rt.duration / n;
  const per = Math.max(1, Math.round(SLIDE_WINDOW / dt));
  let prev: { ft: V3[]; fwd: number[]; hip: V3; flip: boolean } | undefined;
  let bearing: number[] = [];
  let slip: [number, number] = [0, 0];
  let from = 0;
  let hip0: V3 | undefined;
  let slid = false;
  for (let k = 0; k <= n && !slid; k++) {
    const t = k * dt;
    const sp = sceneAt(rt, m.id, t, h);
    const wd = sp.world as World;
    const ft = feet3(sp.pose, wd, h, dims.hipHalf);
    const F = dirOf(wd.yaw);
    const fwd = ft.map((p) => ((p[0] - wd.hip[0]) * F[0] + (p[2] - wd.hip[2]) * F[2]) / (unit * h));
    const ys = feet(sp.pose, h, RIG, true).map((p) => p[1] / h);
    const sitting = legOf(keys, t).sit;
    if (!prev || sitting) bearing = standing(ys);
    else {
      if (prev.flip !== wd.flip) {
        bearing = bearing.map((i) => 1 - i);
        prev.ft.reverse();
        prev.fwd.reverse();
      }
      const was = bearing;
      bearing = nextBearing(
        bearing,
        ys,
        fwd.map((x, i) => x - (prev as { fwd: number[] }).fwd[i]),
      );
      // chân xoay của cú quay tại chỗ trượt trên sàn là cố ý
      const both =
        turnStepAt(m, t) || turnStepAt(m, t - dt) ? [] : bearing.filter((i) => was.includes(i));
      for (const i of both) {
        slip[0] += (ft[i][0] - prev.ft[i][0]) / both.length;
        slip[1] += (ft[i][2] - prev.ft[i][2]) / both.length;
      }
    }
    hip0 ??= wd.hip;
    if (sitting) {
      [slip, from, hip0] = [[0, 0], k, wd.hip];
    } else if (k - from >= per) {
      const R = Math.hypot(wd.hip[0] - hip0[0], wd.hip[2] - hip0[2]);
      const S = Math.hypot(...slip);
      if (S > 0.5 * R + SLIDE_MIN * unit) {
        const why = w.path
          ? "`path` dời người mà chân không bước — thêm clip có sải chân (`walk`), hay để các mốc đứng yên"
          : "chân bước mà người đứng một chỗ (`world.at`) — muốn đi thì khai `world.path`";
        bad.push(
          `\`${m.id}\` giây ${(from * dt).toFixed(2)}–${t.toFixed(2)}: chân trụ trượt ${Math.round(S)} đơn vị trên sàn trong khi hông đi ${Math.round(R)} — ${why}`,
        );
        slid = true;
      }
      [slip, from, hip0] = [[0, 0], k, wd.hip];
    }
    prev = { ft, fwd, hip: wd.hip, flip: wd.flip };
  }
  if (!w.path) return bad;
  const walk = walkerOf(rt, m, h, dims.hipHalf) as Walker;
  keys.forEach((k, i) => {
    const next = keys[i + 1];
    if (k.sit || i === 0) return;
    const stops = !next || next.sit || (next.at[0] === k.at[0] && next.at[2] === k.at[2]);
    if (!stops) return;
    const miss = Math.hypot(
      sampleAt(walk.x, walk.step, k.t) - k.at[0],
      sampleAt(walk.z, walk.step, k.t) - k.at[2],
    );
    if (miss > ARRIVE_MAX * unit)
      bad.push(
        `\`${m.id}\`: mốc dừng \`world.path\` giây ${k.t} — hông cách \`at\` ${Math.round(miss)} đơn vị: chân không đưa người tới đó (thiếu clip có sải chân trên quãng tới, quãng quá xa cho thời gian ấy), hay clip đi kết thúc lệch lúc tới mốc — dời \`start\` của clip sau nó`,
      );
  });
  let still = -1;
  for (let k = 0; k <= n; k++) {
    const t = k * dt;
    const c = strideClip(m, t, false);
    const a = keyAt(keys, t).xz;
    const b = keyAt(keys, t + dt).xz;
    const idle = c && a[0] === b[0] && a[1] === b[1] && !legOf(keys, t).sit;
    if (idle && still < 0) still = t;
    if ((!idle || k === n) && still >= 0) {
      if (t - still >= STALL_MIN)
        bad.push(
          `\`${m.id}\` giây ${still.toFixed(2)}–${t.toFixed(2)}: clip có sải chân (\`${c?.file ?? "walk"}\`) còn chạy mà \`path\` đứng yên — chân đứng sững giữa bước; cho clip ấy kết thúc (sang \`idle\`) lúc tới mốc`,
        );
      still = -1;
    }
  }
  return bad;
}

/** Bước lấy mẫu (giây) khi dò thân quay: một khung ở 60 fps */
const TURN_STEP = 1 / 60;
/** Thân quay nhanh hơn ngần này (độ mỗi giây) là giật */
const TURN_JERK = 300;
/** Thân quay đi ít nhất ngần này độ rồi quay lại quá nửa cú ấy trong `TURN_BACK_SPAN` giây là cú vặn qua lại */
const TURN_BACK = 20;
const TURN_BACK_SPAN = 1.5;

/**
 * Người 3D mà thân quay gắt: quay nhanh hơn `TURN_JERK` độ/giây, hay quay đi `TURN_BACK`° rồi quay
 * lại quá nửa trong `TURN_BACK_SPAN` giây. Đo trên hướng thân thế giới `sceneAt(…).world.yaw` từng
 * khung, nên bắt cả cú quay do rig tự lái (hông trượt quá mốc dừng, hướng thân lái theo `path`)
 * chứ không chỉ mốc `yaw` khai. Mỗi cú một dòng. Kèm cú quay tại chỗ khai `steps` ít tới mức một
 * nhịp quá `TURN_STEP_MAX`. docs/03-scene.md#check-cho-người-3d
 */
export function sceneTurnProblems(rt: SceneRuntime): string[] {
  if (!rt.lens) return [];
  const bad: string[] = [];
  const n = Math.max(1, Math.round(rt.duration / TURN_STEP));
  for (const m of rt.cast) {
    if (!m.world) continue;
    const h = rt.heights[m.id] ?? 1;
    const ts: number[] = [];
    const ys: number[] = [];
    for (let k = 0; k <= n; k++) {
      const t = (k * rt.duration) / n;
      const y = sceneAt(rt, m.id, t, h).world!.yaw / D;
      ts.push(t);
      ys.push(k ? ys[k - 1] + wrap180(y - ys[k - 1]) : y);
    }
    const sec = (t: number) => t.toFixed(2);
    // quay giật: các khung liền nhau vượt tốc, một dòng một quãng
    let jerk: { from: number; to: number; rate: number } | undefined;
    const flushJerk = () => {
      if (!jerk) return;
      const span =
        jerk.from === jerk.to ? `giây ${sec(jerk.from)}` : `giây ${sec(jerk.from)}–${sec(jerk.to)}`;
      bad.push(
        `\`${m.id}\` ${span}: thân quay ${Math.round(jerk.rate)}°/s (ngưỡng ${TURN_JERK}°/s) — mốc \`yaw\` đổi gấp, hay hướng thân lái về chỗ hông chưa tới; giãn mốc \`yaw\` ra, hay cho clip đi kết thúc đúng lúc tới mốc dừng`,
      );
      jerk = undefined;
    };
    for (let k = 1; k <= n; k++) {
      const rate = Math.abs(ys[k] - ys[k - 1]) / (ts[k] - ts[k - 1]);
      if (rate <= TURN_JERK) {
        flushJerk();
        continue;
      }
      jerk ??= { from: ts[k - 1], to: ts[k], rate };
      jerk.to = ts[k];
      jerk.rate = Math.max(jerk.rate, rate);
    }
    flushJerk();
    // quay đi rồi quay lại: đỉnh của hướng thân với hai chân dốc ngược chiều
    const peaks: number[] = [0];
    for (let k = 1; k < n; k++) {
      const a = ys[k] - ys[k - 1];
      const b = ys[k + 1] - ys[k];
      if (a * b < 0 || (a !== 0 && b === 0)) peaks.push(k);
    }
    peaks.push(n);
    let i = 0;
    while (i + 2 < peaks.length) {
      // gộp các đỉnh nhỏ: tìm đỉnh xa nhất trong khung thời gian tính từ đỉnh `i`
      const k0 = peaks[i];
      let best = -1;
      for (let j = i + 1; j < peaks.length && ts[peaks[j]] - ts[k0] <= TURN_BACK_SPAN; j++)
        if (best < 0 || Math.abs(ys[peaks[j]] - ys[k0]) > Math.abs(ys[peaks[best]] - ys[k0]))
          best = j;
      const out = best < 0 ? 0 : ys[peaks[best]] - ys[k0];
      if (best < 0 || Math.abs(out) < TURN_BACK) {
        i++;
        continue;
      }
      const kb = peaks[best];
      let back = -1;
      for (let k = kb; k <= n && ts[k] - ts[k0] <= TURN_BACK_SPAN; k++)
        if ((ys[kb] - ys[k]) * Math.sign(out) >= Math.abs(out) / 2) {
          back = k;
          break;
        }
      if (back < 0) {
        i = best;
        continue;
      }
      // mốc đầu là lúc thân rời hướng ở đỉnh trước, không phải chính đỉnh ấy
      let from = k0;
      while (from < kb && Math.abs(ys[from + 1] - ys[k0]) < 2) from++;
      bad.push(
        `\`${m.id}\` giây ${sec(ts[from])}–${sec(ts[back])}: thân quay ${Math.round(Math.abs(out))}° rồi quay lại trong ${sec(ts[back] - ts[from])} s — thường là hông trượt quá mốc dừng \`path\` (clip đi kết thúc trễ) hay hướng thân lái về chỗ hông chưa tới; dời \`start\` của clip sau clip đi, hay giãn mốc \`path\` ra`,
      );
      while (i < peaks.length && peaks[i] < back) i++;
    }
    // `steps` khai ít quá: một nhịp bước quay quá `TURN_STEP_MAX`
    const keys = m.world.path ?? [];
    for (let k = 1; k < keys.length; k++) {
      const turn = keys[k].steps && turnOf(keys[k - 1], keys[k]);
      if (!turn || Math.abs(turn.delta) / turn.steps <= TURN_STEP_MAX) continue;
      bad.push(
        `\`${m.id}\` giây ${sec(keys[k - 1].t)}–${sec(keys[k].t)}: quay tại chỗ ${Math.round(Math.abs(turn.delta))}° trong ${turn.steps} nhịp, mỗi nhịp ${Math.round(Math.abs(turn.delta) / turn.steps)}° (nhiều nhất ${TURN_STEP_MAX}°) — bàn chân bước vòng quanh hông; tăng \`steps\` lên ${Math.ceil(Math.abs(turn.delta) / TURN_STEP_MAX)}, hay bỏ trống cho rig tự chia`,
      );
    }
  }
  return bad;
}

/**
 * Hướng của người 3D tại `time`, độ: `said` là yaw khai (nội suy `path`), `yaw` là hướng thân nhắm
 * tới (người đi: hướng theo `path`, trước giới hạn tốc quay). Người không có `world` thì
 * `undefined`. Hướng vẽ là `sceneAt(…).world.yaw`.
 */
export function worldFacingAt(
  rt: SceneRuntime,
  id: string,
  time: number,
  height = 1,
  dims: Body3 = rt.bodies[id] ?? BODY3,
): { said: number; yaw: number } | undefined {
  const m = member(rt, id);
  if (!m.world || !rt.lens) return;
  const walk = walkerOf(rt, m, height, dims.hipHalf);
  const pose = worldPoseAt(m, time, walk, height, dims.hipHalf);
  const at = worldAt(rt.lens, m.world, time, pose, height, dims.legHalf, walk);
  return { said: keyAt(keysOf(m.world), time).yaw, yaw: at.yaw };
}

type PathKey = Required<PathKey0>;
type CameraKey = Unmarked<z.infer<typeof CameraKeySchema>>;
type FadeKey = Unmarked<z.infer<typeof FadeKeySchema>>;
type FlipKey = Unmarked<z.infer<typeof FlipKeySchema>>;
type ViewKey = Unmarked<z.infer<typeof ViewKeySchema>>;

type WorldSpec = NonNullable<CastMember["world"]>;
type WorldKey = NonNullable<WorldSpec["path"]>[number];

const keysOf = (w: WorldSpec): WorldKey[] =>
  w.path ?? [{ t: 0, at: w.at!, yaw: w.yaw, sit: w.sit, ease: false }];

const wrap180 = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** Đoạn `path` chứa `time`: mốc trước, mốc sau (nếu đang đi giữa hai mốc), tỉ lệ đã êm, và có ngồi không */
function legOf(keys: WorldKey[], time: number) {
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].t <= time) i++;
  const a = keys[i];
  const b = time > a.t ? keys[i + 1] : undefined;
  let u = b ? (time - a.t) / (b.t - a.t) : 0;
  if (b?.ease) u = u * u * (3 - 2 * u);
  return { i, a, b, u, sit: a.sit || !!b?.sit };
}

/** Điểm sàn `[x, z]`, `y` của sàn và yaw khai (độ) của `path` tại `time` */
function keyAt(keys: WorldKey[], time: number) {
  const { a, b, u } = legOf(keys, time);
  const mix = (p: number, q: number) => p + (q - p) * u;
  if (!b) return { xz: [a.at[0], a.at[2]] as [number, number], y: a.at[1], yaw: a.yaw };
  const turn = turnOf(a, b);
  return {
    xz: [mix(a.at[0], b.at[0]), mix(a.at[2], b.at[2])] as [number, number],
    y: mix(a.at[1], b.at[1]),
    yaw: turn
      ? a.yaw + turn.delta * turnShare(turn.steps, (time - a.t) / (b.t - a.t))
      : a.yaw + wrap180(b.yaw - a.yaw) * u,
  };
}

/** Quay tại chỗ dưới ngần này độ thì hai bàn chân xoay quanh hông, không bước */
const TURN_STEP_MIN = 15;
/** Một nhịp bước quay (một chân bước, chân kia xoay trên sàn) quay nhiều nhất ngần này độ */
const TURN_STEP_MAX = 90;
/** Phần nhịp mà chân bước đặt xuống trước khi thân dừng, và chân xoay chờ trước khi trượt */
const TURN_LAG = 0.15;
/** Bàn chân bước nhấc cao nhất, phần độ dài chân */
const TURN_LIFT = 0.07;
/** Hông hạ khi bước quay, phần độ dài chân: gối chùng cho bàn chân trụ với tới */
const TURN_DIP = 0.015;
/** Phần đầu và cuối cú quay mà hông hạ xuống, đứng lên */
const TURN_DIP_RAMP = 0.2;
/** Thân nghiêng về chân xoay khi chân kia nhấc, độ */
const TURN_LEAN = 3;

/**
 * Hai mốc đứng cùng `at` khác `yaw` là quay tại chỗ: góc quay (độ, có dấu) và số nhịp bước — `b.steps`
 * khai thì theo nó (kể cả dưới `TURN_STEP_MIN`), không thì mỗi nhịp tới `TURN_STEP_MAX`
 */
function turnOf(a: WorldKey, b: WorldKey) {
  if (a.sit || b.sit || a.at[0] !== b.at[0] || a.at[2] !== b.at[2]) return;
  const delta = wrap180(b.yaw - a.yaw);
  if (delta === 0 || (!b.steps && Math.abs(delta) < TURN_STEP_MIN)) return;
  return { delta, steps: b.steps ?? Math.ceil(Math.abs(delta) / TURN_STEP_MAX) };
}

/** Phần góc đã quay ở `u` (0..1) của cú quay `steps` nhịp: mỗi nhịp thân quay êm một lượt, dừng giữa hai nhịp */
function turnShare(steps: number, u: number): number {
  const v = Math.min(1, Math.max(0, u)) * steps;
  const j = Math.min(steps - 1, Math.floor(v));
  return (j + smoothstep(v - j)) / steps;
}

/**
 * Người 3D đi theo `path`, nướng theo bước `TRAVEL_STEP`: điểm sàn dưới hông `[x, z]`, yaw (độ,
 * liền), đồng hồ của clip có sải chân, và độ cao hông trên bàn chân thấp nhất (đơn vị rig).
 */
interface Walker {
  step: number;
  x: number[];
  z: number[];
  /** Yaw vẽ (đã giới hạn tốc quay) và yaw thân nhắm tới */
  yaw: number[];
  yaw0: number[];
  /** Lật của bước ấy, và số lần đã lật tính tới nó — tra bậc thang, không nội suy */
  flip: boolean[];
  half: number[];
  clock: number[];
  lift: number[];
}

/** Clip có sải chân bám lại path trong ngần này giây khi tụt trước / sau mốc */
const TRACK_ALONG = 0.5;
/** Người đang bước nhìn về chỗ `path` sẽ tới sau ngần này giây */
const STEER_AHEAD = 0.35;
/** Đi chậm hơn ngần này (đơn vị rig mỗi giây), hay cách chỗ nhìn tới gần hơn ngần này (đơn vị rig), thì hướng thân nhạt dần về `yaw` khai */
const STEER_SPEED = 60;
const STEER_NEAR = 30;
/** Chỗ nhìn tới lệch hướng khai quá số độ đầu thì lái nhạt dần, tới số sau thì thôi lái: nó đã ở sau lưng */
const STEER_BACK = [60, 120] as const;
/** Hằng thời gian (giây) của nhịp chân và hướng thân — đổi nhịp đột ngột ở mốc path thành êm */
const RATE_TAU = 0.15;
/**
 * Thân người đang bước quay nhanh nhất ngần này (độ mỗi giây): cú quay trải qua cả một pha trụ nên
 * hông xoay quanh bàn chân trụ không văng ra
 */
const TURN_WALK = 150;
/** Như `TURN_WALK` khi không bước — quay tại chỗ, ngồi: chỉ chặn cú nhảy một khung */
const TURN_STAND = 720;
/** Nhịp chân nhanh nhất so với nhịp khai của clip */
const RATE_MAX = 2.5;
/** Clip trôi một lượt dưới ngần này (đơn vị rig) là không có sải chân */
const STRIDE_MIN = 1;

const sampleAt = (xs: number[], step: number, t: number) => {
  const last = xs.length - 1;
  const u = Math.min(last, Math.max(0, t / step));
  const i = Math.min(last - 1, Math.floor(u));
  return last === 0 ? xs[0] : xs[i] + (xs[i + 1] - xs[i]) * (u - i);
};

/** Chỉ số bước cho tra bậc thang: bước cuối đã tới */
const stepIndex = (w: Walker, t: number) =>
  Math.min(w.half.length - 1, Math.max(0, Math.floor(t / w.step + 1e-6)));

const clockOf =
  (w: Walker): Clock =>
  (t) => ({ at: sampleAt(w.clock, w.step, t), half: w.half[stepIndex(w, t)] ?? 0 });

/** Clip có sải chân đang lái chân lúc `time` (`tail`: kể cả lúc nó đang hoà ra), track sau đè track trước */
function strideClip(m: Acting, time: number, tail = true): Clip | undefined {
  let out: Clip | undefined;
  for (const tr of m.tracks) {
    const i = activeClip(tr, time);
    if (i < 0) continue;
    const c = tr.clips[i];
    const was = i > 0 ? tr.clips[i - 1] : undefined;
    if (c.stride) out = c;
    else if (tail && was?.stride && time - c.start < c.tau) out = was;
    else if (writesLegs(c)) out = undefined;
  }
  return out;
}

const walkers = new WeakMap<CastMember, Map<string, Walker>>();

function walkerOf(
  rt: SceneRuntime,
  m: CastMember,
  height: number,
  hipHalf: number,
): Walker | undefined {
  if (!m.world?.path || !rt.lens) return;
  let byKey = walkers.get(m);
  if (!byKey) walkers.set(m, (byKey = new Map()));
  const key = `${height}|${hipHalf}`;
  let w = byKey.get(key);
  if (!w) byKey.set(key, (w = bakeWalker(rt.lens, m, height, hipHalf, rt.duration)));
  return w;
}

/**
 * Hông người 3D trên sàn suy từ bàn chân trụ: chân chịu lực (luật của `bakeFeetTravel`) dịch bao
 * nhiêu trong thế giới — gồm cả phần quay theo yaw — thì hông dịch ngược lại bấy nhiêu, nên chân
 * trụ đứng yên cả lúc quay. `path` là chỗ người phải ở theo thời gian: nhịp chân của clip có sải
 * chân co giãn cho kịp nó (bám lại cả phần tụt trước / sau), lệch ngang thì lái yaw vài độ. Không
 * clip nào có sải chân mà `path` vẫn dời thì hông trượt theo `path`. Đoạn có mốc ngồi thì hông nội
 * suy từ chỗ đang đứng tới mốc. docs/03-scene.md#người-3d
 */
function bakeWalker(
  lens: Lens,
  m: CastMember,
  height: number,
  hipHalf: number,
  duration: number,
): Walker {
  const w = m.world as WorldSpec;
  const keys = keysOf(w);
  const n = Math.max(1, Math.ceil(duration / TRAVEL_STEP - 1e-9));
  const step = duration > 0 ? duration / n : TRAVEL_STEP;
  const unit = height * w.s;
  const out: Walker = {
    step,
    x: [],
    z: [],
    yaw: [],
    yaw0: [],
    flip: [],
    half: [],
    clock: [],
    lift: [],
  };
  let H: [number, number] = [keys[0].at[0], keys[0].at[2]];
  let from = H;
  let seg = -1;
  let r = 1;
  let steer = 0;
  let yawKey = keys[0].yaw;
  let yaw = yawKey;
  let lift = RIG.thigh + RIG.shin;
  let prevP = keyAt(keys, 0).xz;
  let prevO: [number, number][] = [];
  let prevF: number[] = [];
  let bearing: number[] = [];
  let d: [number, number] = [0, 0];
  for (let k = 0; k <= n; k++) {
    const t = k * step;
    const leg = legOf(keys, t);
    const segId = leg.b ? leg.i : -1 - leg.i;
    if (segId !== seg) [seg, from] = [segId, H];
    const key = keyAt(keys, t);
    const P = key.xz;
    const V: [number, number] = k
      ? [(P[0] - prevP[0]) / step, (P[1] - prevP[1]) / step]
      : ((q) => [(q[0] - P[0]) / step, (q[1] - P[1]) / step])(keyAt(keys, step).xz);
    yawKey += wrap180(key.yaw - yawKey);
    const c = strideClip(m, t);
    const vNat = c ? ((c.stride as number) * unit) / c.cycle : 0;
    let rT = 1;
    let sT = 0;
    if (c) {
      const F = dirOf((yawKey + steer) * D);
      const e = [P[0] - H[0], P[1] - H[1]];
      const along = e[0] * F[0] + e[1] * F[2];
      const want = V[0] * F[0] + V[1] * F[2] + (leg.sit ? 0 : along / TRACK_ALONG);
      rT = Math.min(RATE_MAX, Math.max(0, want / vNat));
      const ahead = keyAt(keys, t + STEER_AHEAD).xz;
      const to = [ahead[0] - H[0], ahead[1] - H[1]];
      const fade = Math.min(
        Math.abs(r * vNat) / (STEER_SPEED * unit),
        Math.hypot(to[0], to[1]) / (STEER_NEAR * unit),
        1,
      );
      // clip đi lùi thì lưng quay về chỗ tới
      const head = Math.atan2(-to[1], to[0]) / D + (vNat < 0 ? 180 : 0);
      // chỗ tới đã ở sau lưng (hông trượt quá mốc dừng): không quay người lại để bù vài bước
      const off = wrap180(head - yawKey);
      const behind = smoothstep(
        Math.min(1, Math.max(0, (STEER_BACK[1] - Math.abs(off)) / (STEER_BACK[1] - STEER_BACK[0]))),
      );
      if (!leg.sit) sT = off * fade * behind;
    }
    const ease = k ? Math.min(1, step / RATE_TAU) : 1;
    r += (rT - r) * ease;
    steer += (sT - steer) * ease;
    out.clock.push(k ? out.clock[k - 1] + r * step : 0);
    const hip: V3 = [H[0], key.y - w.s * lift, H[1]];
    const turn = (c ? TURN_WALK : TURN_STAND) * step;
    const dy = wrap180(yawKey + steer - yaw);
    yaw += k ? Math.max(-turn, Math.min(turn, dy)) : dy;
    out.yaw.push(yaw);
    out.yaw0.push(yawKey + steer);
    const f = facing(lens, hip, yaw * D);
    // Lật là chân gần đổi sang chân kia: `poseAt` đổi kênh để mỗi bàn chân vẫn là chính nó
    const turned = k > 0 && f.flip !== out.flip[k - 1];
    out.flip.push(f.flip);
    out.half.push(k ? out.half[k - 1] + (turned ? 1 : 0) : 0);
    if (turned) {
      bearing = bearing.map((i) => 1 - i);
      prevO = [prevO[1], prevO[0]];
      prevF = [prevF[1], prevF[0]];
    }
    const pose = worldPoseAt(m, t, out, height, hipHalf);
    const ys = feet(pose, height, RIG, true).map((q) => q[1]);
    lift = Math.max(...ys);
    out.lift.push(lift);
    hip[1] = key.y - w.s * lift;
    const ft = feet3(
      pose,
      { lens, hip, yaw: f.yaw, s: w.s, flip: f.flip, theta: f.theta },
      height,
      hipHalf,
    );
    const Fe = dirOf(f.yaw);
    const o = ft.map((q): [number, number] => [q[0] - H[0], q[2] - H[1]]);
    const fwd = o.map((q) => (q[0] * Fe[0] + q[1] * Fe[2]) / unit);
    const yn = ys.map((y) => y / height);
    if (leg.sit) {
      const to: [number, number] = leg.b ? [leg.b.at[0], leg.b.at[2]] : [leg.a.at[0], leg.a.at[2]];
      H = leg.b ? [from[0] + (to[0] - from[0]) * leg.u, from[1] + (to[1] - from[1]) * leg.u] : to;
    } else if (k && c) {
      bearing = nextBearing(
        bearing,
        yn,
        fwd.map((x, i) => x - prevF[i]),
      );
      if (bearing.length)
        d = [0, 1].map(
          (j) => bearing.reduce((acc, i) => acc + o[i][j] - prevO[i][j], 0) / bearing.length,
        ) as [number, number];
      H = [H[0] - d[0], H[1] - d[1]];
    } else if (k) H = [H[0] + P[0] - prevP[0], H[1] + P[1] - prevP[1]];
    if (leg.sit || !c) {
      bearing = standing(yn);
      d = [0, 0];
    }
    out.x.push(H[0]);
    out.z.push(H[1]);
    prevO = o;
    prevF = fwd;
    prevP = P;
  }
  return out;
}

/**
 * Người 3D tại `time`: tâm hông thế giới — ngồi thì nâng khỏi mặt ngồi nửa bề dày đùi, đứng thì
 * bàn chân thấp nhất chạm sàn —, rồi hướng thật so với ống kính. Đứng yên (`at`) thì đặt thẳng;
 * đi theo `path` thì điểm sàn và yaw tra bảng `walk` đã nướng. Trả kèm hướng thân nhắm tới (độ).
 */
function worldAt(
  lens: Lens,
  w: WorldSpec,
  time: number,
  pose: Pose,
  height: number,
  legHalf: number,
  walk?: Walker,
): { world: World; yaw: number } {
  const keys = keysOf(w);
  const { a, b, u, sit } = legOf(keys, time);
  const stand = Math.max(...feet(pose, height, RIG, true).map((f) => f[1]));
  const key = keyAt(keys, time);
  const xz = walk ? [sampleAt(walk.x, walk.step, time), sampleAt(walk.z, walk.step, time)] : key.xz;
  const yaw = walk ? sampleAt(walk.yaw0, walk.step, time) : key.yaw;
  // Đang ngồi xuống hay đứng dậy: mốc đứng giữ độ cao hông của chính lúc ấy, không theo chân đang co
  const liftAt = (k: WorldKey) =>
    k.sit ? legHalf : walk ? sampleAt(walk.lift, walk.step, k.t) : (RIG.thigh + RIG.shin) * height;
  let y = key.y - w.s * stand;
  if (sit) {
    const ya = a.at[1] - w.s * liftAt(a);
    y = b ? ya + (b.at[1] - w.s * liftAt(b) - ya) * u : ya;
  }
  const hip: V3 = [xz[0], y, xz[1]];
  const f = walk
    ? {
        ...facing(lens, hip, sampleAt(walk.yaw, walk.step, time) * D),
        flip: walk.flip[stepIndex(walk, time)],
      }
    : facing(lens, hip, yaw * D);
  return {
    world: {
      lens,
      hip,
      yaw: f.yaw,
      s: w.s,
      flip: f.flip,
      theta: f.theta,
      floor: sit ? w.floor : key.y,
      ...(sit && { seated: true }),
    },
    yaw,
  };
}

type HandKey = NonNullable<WorldSpec["hands"]>[number];
type HandSide = "right" | "left";

/** Mốc thân trên người khác trong `cast` được ước ở chỗ này: mặt (giữa hai mắt), mồm, ngực, bụng */
const CAST_MARKS = ["eye", "mouth", "chest", "belly"] as const;

const regripOf = (h: SceneHold): boolean => typeof h === "object" && !!h.regrip;

/**
 * Lần cầm của tay `side` ở giây `time`: mốc gần nhất (không sau `time`) khai `hold` của tay ấy; `null` là buông. `since` là
 * giây bắt đầu chuỗi mốc cầm cùng món, cùng khoá lần cầm (`sceneHoldRef`), không `regrip`
 */
function holdRun(keys: HandKey[], side: HandSide, time: number): HoldRun | undefined {
  let run: HoldRun | undefined;
  for (const k of keys) {
    if (k.t > time) break;
    const h = k[side]?.hold;
    if (h === undefined) continue;
    if (h === null) {
      run = undefined;
      continue;
    }
    const r = sceneHoldRef(h);
    const same = run && sceneHoldRef(run.hold);
    run = {
      hold: h,
      since:
        same && same.item === r.item && same.grip === r.grip && !regripOf(h) ? run!.since : k.t,
    };
  }
  return run;
}

/**
 * Tay `hand` của người `id` ở `time` còn trong `HOLD_BLEND` của một ranh giới lần cầm (vừa cầm, đổi chỗ cầm, vừa buông —
 * `ReachHold.enter` / `from` / `was`): bàn tay đang đi tới món, chưa tới chỗ cầm. Ranh giới ở giây `0` không hoà
 */
export function holdBlending(rt: SceneRuntime, id: string, hand: "R" | "L", time: number): boolean {
  const keys = rt.cast.find((m) => m.id === id)?.world?.hands;
  if (!keys) return false;
  const side: HandSide = hand === "R" ? "right" : "left";
  for (const k of keys) {
    if (k.t > time) break;
    if (k.t <= 0 || time - k.t >= HOLD_BLEND || !holdKey(k)) continue;
    if (!sameRun(effRun(rt, keys, side, k.t - 1e-6), effRun(rt, keys, side, k.t))) return true;
  }
  return false;
}

/**
 * Bảng món cộng các tên thể hiện scene nhắc tới: `vali:2` (hai món cùng loại trên một người hay trong một cảnh) dùng
 * chung `held/vali.json` mà là một món riêng — `provide`, `holder`, đổi tay theo tên đủ
 */
function heldInstances(
  held: Record<string, HeldItemSpec>,
  cast: { world?: { hands?: HandKey[] } }[],
): Record<string, HeldItemSpec> {
  let out = held;
  for (const m of cast)
    for (const k of m.world?.hands ?? [])
      for (const h of [k.right?.hold, k.left?.hold]) {
        if (!h) continue;
        const { item } = sceneHoldRef(h);
        const base = heldBase(item);
        if (out[item] || base === item || !held[base]) continue;
        if (out === held) out = { ...held };
        out[item] = held[base];
      }
  return out;
}

/**
 * Lần cầm hai tay khai lệch ở `world.hands`: một tay cầm hai tay (`both`) mà cùng lúc tay kia cầm món khác — cầm hai tay
 * không thành, mỗi tay mang một món; và cảnh báo của chỗ cầm nhóm (`choiceWarnings`, cỡ tay người mẫu cao như người
 * cầm). `check` (nhóm `ref`) báo. docs/03-scene.md#đồ-cầm-tay
 */
export function sceneHoldProblems(rt: SceneRuntime): string[] {
  const out: string[] = [];
  for (const m of rt.cast) {
    const keys = m.world?.hands;
    if (!keys?.length) continue;
    const said = new Set<string>();
    for (const k of keys)
      for (const side of ["right", "left"] as const) {
        const h = k[side]?.hold;
        const spec = h ? rt.held[groupHold(h).item] : undefined;
        if (!h || !spec) continue;
        const g = groupHold(h);
        const dims = holderDims(rt.heights[m.id] ?? 1);
        for (const line of choiceWarnings(g.group, itemGeom(spec), h, dims, spec.anchors)) {
          if (said.has(`${side}|${line}`)) continue;
          said.add(`${side}|${line}`);
          out.push(
            `${m.id}: \`world.hands\` ${side} t=${k.t} (cảnh báo \`choice\`): ${line} (docs/11-nhom-cam.md mục 3, nhóm 5)`,
          );
        }
      }
    for (const k of keys) {
      const runs = { right: holdRun(keys, "right", k.t), left: holdRun(keys, "left", k.t) };
      if (!runs.right || !runs.left) continue;
      const refs = { right: sceneHoldRef(runs.right.hold), left: sceneHoldRef(runs.left.hold) };
      if (refs.right.item === refs.left.item) continue;
      for (const side of ["right", "left"] as const) {
        const a = refs[side];
        const b = refs[side === "right" ? "left" : "right"];
        const g = groupHold(runs[side]!.hold);
        const name = `${a.item}@${g.group}`;
        const key = `${side}|${name}|${b.item}`;
        if (!g.both || said.has(key)) continue;
        said.add(key);
        out.push(
          `${m.id}: \`world.hands\` t=${k.t}: cầm hai tay \`${name}\` (\`both\`) ở tay ${side === "right" ? "phải" : "trái"} mà tay kia đang cầm \`${b.item}\` — hai tay của món hai tay phải cùng một món: tay kia khai cùng món, hay \`hold: null\` (docs/03-scene.md#đồ-cầm-tay)`,
        );
      }
    }
  }
  return out;
}

/** Đích một trục ý định ra dạng bộ giải đọc; người khác trong `cast` ước ra điểm thế giới ở giây đang lấy mẫu */
function holdTarget(
  t: AxisIntent["toward"],
  castAt: (id: string, mark: BodyMark | undefined) => V3,
): HoldTarget {
  if (typeof t === "string")
    return t === "camera" || t === "holderFace" ? { name: t } : { v: [...PALM_DIRS[t]] as V3 };
  if (Array.isArray(t)) return { v: [...t] as V3 };
  if ("cast" in t) return { at: castAt(t.cast, t.mark) };
  return {
    to: t.mark,
    ...(t.side && { side: t.side }),
    ...(t.offset && { offset: [...t.offset] as V3 }),
  };
}

/** Đích một trục ý định như scene khai, để báo */
const towardLabel = (t: AxisIntent["toward"]): string =>
  typeof t === "string"
    ? t
    : Array.isArray(t)
      ? `[${t.join(", ")}]`
      : "cast" in t
        ? `${t.cast}.${t.mark ?? "eye"}`
        : t.mark;

/**
 * Ý định `roll` của tay dẫn khi biến thể có `thumbToward`: phía ngón cái (`ρ(around)` của chỗ cầm) quay về đích; cảnh khai
 * `roll` hay `keep` thì không có
 */
function thumbRoll(
  spec: HeldItemSpec,
  h: SceneHold,
  choice: GraspChoice,
  height: number,
): AxisIntent | undefined {
  const g = groupHold(h);
  if (g.roll || g.keep) return undefined;
  const group = GRIP_GROUPS[g.group];
  const geom = itemGeom(spec);
  const f = geom.features.find(
    (x) =>
      (x.kind === "lathe" || x.kind === "rod") &&
      (choice.part === undefined || x.part === choice.part) &&
      (choice.feature === undefined || x.kind === choice.feature),
  );
  if (!f || (f.kind !== "lathe" && f.kind !== "rod")) return undefined;
  const variant =
    choice.variant ??
    group.variantOf?.(f, geom, choice.around, holderDims(height)) ??
    Object.keys(group.variants)[0];
  const to = variantOf(spec, group, variant)?.spec.thumbToward;
  return to && { axis: axialAt(geom, f, 0.5, choice.around ?? 0).rho, toward: to };
}

/** Ý định của một lần cầm ra số hạng bàn tay (`AimTerm.hold`); `thumb` đè `roll` của nhóm (`thumbRoll`) */
function holdAim(
  spec: HeldItemSpec,
  h: SceneHold,
  castAt: (id: string, mark: BodyMark | undefined) => V3,
  thumb?: AxisIntent,
): HoldAim {
  const { item, grip } = sceneHoldRef(h);
  const intent = groupIntent(groupHold(h).group, h, itemGeom(spec));
  const face = intent.face;
  const roll = thumb ?? intent.roll;
  const axis = (a: AxisIntent): HoldAxis => ({
    axis: heldAxis(spec, a.axis),
    target: holdTarget(a.toward, castAt),
    ...(a.tilt && { tilt: a.tilt }),
    label: towardLabel(a.toward),
  });
  return { item, grip, ...(face && { face: axis(face) }), ...(roll && { roll: axis(roll) }) };
}

/**
 * Đích một tay tại `time`: nội suy êm giữa hai mốc nhắc tay ấy, `null` là `w` 0. Món đang cầm (`hold`) là bậc thang theo
 * `holdRun`; ý định của nó là số hạng bàn tay của mọi mốc trong quãng cầm, nên đổi ý định thì cổ tay xoay dần. Chỗ cầm
 * nhóm mang `grasp` (`host` là người cầm); món đặt trước thì không có ý định, bàn tay suy từ món
 */
function handAt(
  keys: HandKey[],
  side: HandSide,
  time: number,
  held: Record<string, HeldItemSpec>,
  castAt: (id: string, mark: BodyMark | undefined) => V3,
  poseAt?: (t: number) => object,
  host?: GraspHost,
): Reach | undefined {
  const ks = keys.filter((k) => k[side] !== undefined) as (HandKey & { t: number })[];
  const now = holdRun(keys, side, time);
  // tay phụ của `both` trên món đặt trước, hay lần cầm ấy vừa xong
  const extra = host && !now ? supportHold(host, keys, side, time, held) : undefined;
  if (!ks.length) return extra && { w: 0, at: [0, 0, 0], hold: extra };
  let i = 0;
  while (i + 1 < ks.length && ks[i + 1].t <= time) i++;
  const a = ks[i];
  const b = time > a.t ? ks[i + 1] : undefined;
  const ra = a[side];
  const fk = b ? smoothstep((time - a.t) / (b.t - a.t)) : 0;
  const nowRef = now && sceneHoldRef(now.hold);
  // mẫu trước khung này, trên lưới `HOLD_SLEW_STEP` từ mốc gần nhất: cổ tay mang món nối từ đó
  const key = ks[i].t < time - 1e-9 ? ks[i] : ks[i - 1];
  const prior =
    key && key.t + HOLD_SLEW_STEP * Math.ceil((time - key.t) / HOLD_SLEW_STEP - 1 - 1e-3);
  // `HOLD_BLEND` giây đầu của lần cầm (trừ lần cầm từ đầu cảnh): đổi chỗ cầm cùng món thì liên kết và ý định hoà từ chỗ
  // cũ; cầm món mới thì `enter` cho tay phụ hoà tới mốc trên món
  const blend = now && now.since > 0 && time - now.since < HOLD_BLEND;
  const prev = blend ? holdRun(keys, side, now!.since - 1e-6) : undefined;
  const prevRef = prev && sceneHoldRef(prev.hold);
  const f = blend ? smoothstep((time - now!.since) / HOLD_BLEND) : 1;
  // món treo không hoà liên kết, không có ý định: món theo chỗ treo ngay từ mốc
  const carried = !!now && isCarryHold(carryRef(now.hold));
  const regrip = !carried && !!(nowRef && prevRef) && prevRef!.item === nowRef!.item;
  const grasp = now && host ? holdGraspAt(host, keys, side, time, now) : undefined;
  const prevGrasp =
    blend && regrip && host ? holdGraspAt(host, keys, side, now!.since - 1e-6, prev!) : undefined;
  const placedItem = grasp?.mode === "item";
  const was = host && placedWas(host, keys, side, time);
  const hold: ReachHold | undefined = nowRef && {
    ...nowRef,
    spec: held[nowRef.item],
    since: now.since,
    ...(blend &&
      regrip && {
        from: { grip: prevRef!.grip, k: 1 - f, ...(prevGrasp && { grasp: prevGrasp }) },
      }),
    ...(blend && !carried && prevRef?.item !== nowRef.item && { enter: f }),
    ...(poseAt &&
      prior !== undefined &&
      !placedItem && {
        prior: { dt: time - prior, pose: () => poseAt(+prior.toFixed(6)) },
      }),
    ...(grasp && { grasp }),
    ...(placedItem && {
      solve: (c: ActCharacter, T?: Trunk3) =>
        graspAtTime(host!.rt, host!.id, side, time, {
          chars: { [host!.id]: c },
          ...(T && { trunks: { [host!.id]: T } }),
        }),
    }),
    ...(was && { was: was.was }),
  };
  // vừa buông món đặt trước: lần cầm cũ chỉ còn hoà ra
  const gone: ReachHold | undefined =
    !hold && was
      ? {
          ...sceneHoldRef(was.run.hold),
          spec: held[sceneHoldRef(was.run.hold).item],
          since: was.run.since,
          was: was.was,
          released: true,
        }
      : undefined;
  /**
   * Ý định ở mốc `kt` của lần cầm đang có ở `time`: lần cầm có hiệu lực ở mốc ấy, hay ngay trước nó — mốc thả (`hold: null`,
   * đổi món) vẫn giữ ý định tới đúng lúc thả
   */
  const intentAt = (kt: number): Aim | undefined => {
    if (!hold || carried || placedItem) return undefined;
    for (const run of [holdRun(keys, side, kt), holdRun(keys, side, kt - 1e-6)]) {
      const r = run && sceneHoldRef(run.hold);
      if (r && r.item === hold.item && r.grip === hold.grip) {
        const thumb = grasp && host && thumbRoll(hold.spec, run!.hold, grasp.choice, host.height);
        return {
          terms: [
            { k: 1, hold: holdAim(hold.spec, run!.hold, castAt, thumb || undefined) } as AimTerm,
          ],
        };
      }
    }
    return undefined;
  };
  /** Mốc tay chỉ mang chỗ cầm món đặt trước: đích tay tự do lấy của mốc có đích gần nhất trước nó */
  const bare = (k: HandKey): boolean => {
    const h = k[side];
    if (!h?.hold || h.at || h.to || h.palm || h.fingers) return false;
    const run = host && holdRun(keys, side, k.t);
    return !!run && placedRun(host!.rt, keys, side, run);
  };
  const lend = (h: NonNullable<typeof ra>, kt: number): NonNullable<typeof ra> => {
    let i = ks.findIndex((k) => k.t === kt);
    if (i < 0 || !bare(ks[i])) return h;
    while (i > 0 && bare(ks[i])) i--;
    const d = ks[i][side];
    if (bare(ks[i]) || !d || !(d.at || d.to)) return h;
    const { at, to, offset, point, elbow } = d;
    return { ...h, at, to, offset, point, ...(!h.elbow && elbow && { elbow }) };
  };
  const one = (h0: typeof ra, kt: number): Reach | undefined => {
    const intent = intentAt(kt);
    if (!h0) return intent && { w: 0, at: [0, 0, 0], aim: intent };
    const h = lend(h0, kt);
    const placed = !!(h.at || h.to);
    const term = placed ? reachTerm({ ...h, ...(h.to && { at: undefined }) }) : undefined;
    // lòng tay theo ý định của mốc; mốc không khai giữ bàn tay của hành động
    const aim: Aim | undefined =
      intent ??
      (h.palm || h.fingers
        ? keyAim({ palm: h.palm, fingers: h.fingers, bend: h.bend })
        : undefined);
    if (!placed && !aim) return undefined;
    return {
      w: placed ? 1 : 0,
      at: (h.at ?? [0, 0, 0]) as [number, number, number],
      ...(h.elbow && { elbow: h.elbow }),
      ...(term && { terms: [term] }),
      ...(aim && { aim }),
    };
  };
  const keep: Aim = { terms: [{ k: 1, keep: true }] };
  const finish = (r: Reach | undefined, pa?: Reach, pb?: Reach): Reach | undefined => {
    const tail = extra ?? gone;
    if (tail) return { ...(finishHeld(r, pa, pb) ?? { w: 0, at: [0, 0, 0] }), hold: tail };
    return finishHeld(r, pa, pb);
  };
  const finishHeld = (r: Reach | undefined, pa?: Reach, pb?: Reach): Reach | undefined => {
    let aim =
      pa?.aim || pb?.aim ? (b ? mixAim(pa?.aim ?? keep, pb?.aim ?? keep, fk) : pa?.aim) : undefined;
    if (hold?.from && hold.from.grasp?.mode !== "item") {
      // ý định của kiểu cũ nhường dần cho kiểu mới
      const old: Aim = {
        terms: [
          {
            k: 1,
            hold: holdAim(
              hold.spec,
              prev!.hold,
              castAt,
              (prevGrasp &&
                host &&
                thumbRoll(hold.spec, prev!.hold, prevGrasp.choice, host.height)) ||
                undefined,
            ),
          } as AimTerm,
        ],
      };
      aim = mixAim(old, aim ?? keep, 1 - hold.from.k);
    } else if (hold?.enter !== undefined && aim) aim = mixAim(keep, aim, hold.enter);
    if (!r && !aim && !hold) return undefined;
    return {
      ...(r ?? { w: 0, at: [0, 0, 0] }),
      ...(aim && { aim }),
      ...(hold && { hold }),
    };
  };
  if (!b) {
    const p = one(ra, a.t);
    return finish(p && p.w > 0 ? { ...p, aim: undefined } : undefined, p);
  }
  const rb = b[side];
  const pa = one(ra, a.t);
  const pb = one(rb, b.t);
  // hai mốc cùng có đích mà một bên không khai hướng khuỷu: giữ hướng của bên kia, không nội suy
  if (pa && pb && !!pa.elbow !== !!pb.elbow) pa.elbow = pb.elbow = pa.elbow ?? pb.elbow;
  const r = mixReach(pa, pb, fk);
  const out =
    r && (pa?.elbow || pb?.elbow ? r : { w: r.w, at: r.at, ...(r.terms && { terms: r.terms }) });
  return finish(out, pa, pb);
}

/** Gắn đích cổ tay thế giới vào chỗ đặt: tay phải là tay gần khi không lật */
function withHands(
  w: World,
  keys: HandKey[],
  time: number,
  held: Record<string, HeldItemSpec> = {},
  castAt: (id: string, mark: BodyMark | undefined) => V3 = () => fail("không ước được người khác"),
  poseAt?: (t: number) => object,
  host?: GraspHost,
): World {
  const right = handAt(keys, "right", time, held, castAt, poseAt, host);
  const left = handAt(keys, "left", time, held, castAt, poseAt, host);
  if (!right && !left) return w;
  const [near, far] = w.flip ? [left, right] : [right, left];
  return { ...w, hands: { ...(near && { near }), ...(far && { far }) } };
}

/** Người cầm của `handAt`: chỗ cầm nhóm tra mốc món trên runtime, tay dẫn lấy mặc định theo cỡ người */
interface GraspHost {
  rt: SceneRuntime;
  height: number;
  id: string;
}

/** Lần cầm của một tay; tay phụ của `both` trên món đặt trước mang `lead` (tay dẫn) và `end` (giây hết, không có là hết cảnh) */
type HoldRun = { hold: SceneHold; since: number; lead?: HandSide; end?: number };

const otherSide = (side: HandSide): HandSide => (side === "right" ? "left" : "right");
const holdKey = (k: HandKey) => k.right?.hold !== undefined || k.left?.hold !== undefined;
const sameRun = (a: HoldRun | undefined, b: HoldRun | undefined) =>
  a?.since === b?.since && a?.lead === b?.lead;

const supportMemo = new WeakMap<HandKey[], Partial<Record<HandSide, HoldRun[]>>>();

/**
 * Các lần cầm tay phụ của tay `side`: tay ấy không cầm gì mà tay kia cầm món đặt trước khai `both` có tay phụ
 * (`supportGroup`). Lần cầm mới khi tay dẫn mở lần cầm mới. `hold` chỉ mang món và nhóm; chỗ cầm giải ở `graspStart`
 */
function supportRuns(rt: SceneRuntime, keys: HandKey[], side: HandSide): HoldRun[] {
  let m = supportMemo.get(keys);
  if (!m) supportMemo.set(keys, (m = {}));
  const hit = m[side];
  if (hit) return hit;
  const lead = otherSide(side);
  const out: HoldRun[] = [];
  let cur: { run: HoldRun; key: string } | undefined;
  for (const k of keys) {
    if (!holdKey(k)) continue;
    const L = holdRun(keys, lead, k.t);
    const g =
      L && !holdRun(keys, side, k.t) && placedRun(rt, keys, lead, L)
        ? groupHold(L.hold)
        : undefined;
    const group = g && supportGroup(g);
    const key = group ? `${L!.since}|${group}` : undefined;
    if (cur && key === cur.key) continue;
    if (cur) cur.run.end = k.t;
    cur = undefined;
    if (!group) continue;
    cur = { run: { hold: { item: g!.item, group }, since: k.t, lead }, key: key! };
    out.push(cur.run);
  }
  return (m[side] = out);
}

const supportRun = (rt: SceneRuntime, keys: HandKey[], side: HandSide, time: number) =>
  supportRuns(rt, keys, side).find((r) => r.since <= time && time < (r.end ?? Infinity));

/** Lần cầm của tay `side` ở `time`: lần cầm tay ấy khai, không thì lần cầm tay phụ */
const effRun = (rt: SceneRuntime, keys: HandKey[], side: HandSide, time: number) =>
  holdRun(keys, side, time) ?? supportRun(rt, keys, side, time);

/** Trường số của chỗ cầm nhóm: tay trượt hoà chúng giữa hai mốc tay của cùng lần cầm */
const SLIDE_FIELDS = ["along", "slant", "around", "tilt", "psi", "inset"] as const;
const ALONG_AT: Record<string, number> = { low: 0.25, mid: 0.5, high: 0.75 };
const GRASP_FIELDS = [
  "part",
  "edge",
  "along",
  "thumb",
  "variant",
  "slant",
  "around",
  "tilt",
  "psi",
  "inset",
] as const;

const slideNum = (key: string, v: unknown): number | undefined =>
  typeof v === "number" ? v : key === "along" && typeof v === "string" ? ALONG_AT[v] : undefined;

/** Trường chỗ cầm cảnh khai, dạng lựa chọn */
function declared(g: SceneHoldGroup): GraspChoice {
  const out: Record<string, unknown> = {};
  for (const k of GRASP_FIELDS) if (g[k] !== undefined) out[k] = g[k];
  return out as GraspChoice;
}

/** Người mang chuỗi mốc tay `keys` */
function ownerOf(rt: SceneRuntime, keys: HandKey[]): string | undefined {
  return rt.cast.find((m) => m.world?.hands === keys)?.id;
}

/** Mốc món của lần cầm và lần cầm ấy có theo mốc không (một tay, không tay nào khác cầm cùng món) */
type RunMarks = { marks: SceneItemMark[]; keyed: boolean };
const runMarksMemo = new WeakMap<HandKey[], Map<string, RunMarks>>();

/**
 * Mốc món (`scene.items`) của lần cầm `run`: cùng món, cùng người cầm, trong `[since, runEnd)`; tay phụ lấy của lần cầm tay
 * dẫn. `keyed`: lần cầm một tay — không `both`, tay kia không cầm cùng món trong lần cầm — có mốc: bàn tay giải ở từng mốc,
 * giữa hai mốc hoà trong hệ thân, món theo bàn tay vẽ. docs/11-nhom-cam.md § Lần cầm theo mốc
 */
function runMarks(rt: SceneRuntime, keys: HandKey[], side: HandSide, run: HoldRun): RunMarks {
  if (run.lead) {
    const L = holdRun(keys, run.lead, run.since);
    return { marks: L ? runMarks(rt, keys, run.lead, L).marks : [], keyed: false };
  }
  let m = runMarksMemo.get(keys);
  if (!m) runMarksMemo.set(keys, (m = new Map()));
  const key = `${side}|${run.since}`;
  const hit = m.get(key);
  if (hit) return hit;
  const id = ownerOf(rt, keys);
  const item = groupHold(run.hold).item;
  const end = runEnd(keys, side, run);
  const marks = (rt.items ?? []).filter(
    (k) => k.item === item && k.cast === id && k.t >= run.since - 1e-9 && k.t < end,
  );
  const inRun = keys.filter(
    (k) => k.t >= run.since && k.t < end && holdRun(keys, side, k.t)?.since === run.since,
  );
  const other = otherSide(side);
  const both = inRun.some((k) => {
    const h = k[side]?.hold;
    return !!h && !!groupHold(h).both;
  });
  const shared = [run.since, ...inRun.map((k) => k.t)].some((t) => {
    const o = holdRun(keys, other, t);
    return !!o && sceneHoldRef(o.hold).item === item;
  });
  const out = { marks, keyed: marks.length > 0 && !both && !shared };
  m.set(key, out);
  return out;
}

/**
 * Lần cầm theo mốc trước mốc món đầu hay sau mốc món cuối mà mốc ấy là mốc nằm (`rest`): món đứng ở mốc ấy, bàn tay đang
 * tới hay vừa rời món. docs/11-nhom-cam.md § Lần cầm theo mốc
 */
function restingMark(rm: RunMarks, time: number): SceneItemMark | undefined {
  if (!rm.keyed) return undefined;
  const first = rm.marks[0];
  const last = rm.marks[rm.marks.length - 1];
  if (first.rest && time < first.t) return first;
  if (last.rest && time > last.t) return last;
  return undefined;
}

/** Lần cầm nhóm theo món: có mốc món trong lần cầm (docs/11-nhom-cam.md mục 4) */
const placedRun = (rt: SceneRuntime, keys: HandKey[], side: HandSide, run: HoldRun): boolean =>
  runMarks(rt, keys, side, run).marks.length > 0;

/**
 * Lần cầm vừa xong trên tay `side`, còn hoà ra ở `time` (`HOLD_BLEND` từ ranh giới): phần còn lại và bàn tay của nó ngay
 * trước ranh giới — nghiệm cũ đứng yên, không giải tiếp qua ranh giới (chuỗi `φ` của lần cầm đã xong có thể nhảy nhánh khi
 * món đi tiếp). Lần cầm theo món, hay lần cầm tay dẫn khi lần cầm mới theo món của cùng món. docs/11-nhom-cam.md § Đổi lần
 * cầm
 */
function placedWas(
  host: GraspHost,
  keys: HandKey[],
  side: HandSide,
  time: number,
): { run: HoldRun; was: { k: number; solve: WasSolve } } | undefined {
  const { rt, id } = host;
  for (let i = keys.length - 1; i >= 0; i--) {
    const k = keys[i];
    if (k.t > time || !holdKey(k)) continue;
    if (time - k.t >= HOLD_BLEND) return undefined;
    const prev = effRun(rt, keys, side, k.t - 1e-6);
    if (sameRun(prev, effRun(rt, keys, side, k.t))) continue;
    if (!prev) return undefined;
    const t0 = k.t - 1e-6;
    if (!placedRun(rt, keys, side, prev)) {
      // tay dẫn sang lần cầm theo món của cùng món: hoà từ bàn tay đã vẽ ngay trước ranh giới
      const now = effRun(rt, keys, side, k.t);
      if (
        !now ||
        !placedRun(rt, keys, side, now) ||
        sceneHoldRef(now.hold).item !== sceneHoldRef(prev.hold).item
      )
        return undefined;
      const solve: WasSolve = (c) =>
        actHandAt(
          c,
          sceneAt(rt, id, t0, rt.heights[id] ?? 1, rt.bodies[id] ?? BODY3) as ActInput,
          sideSign(side),
        );
      return { run: prev, was: { k: 1 - smoothstep((time - k.t) / HOLD_BLEND), solve } };
    }
    // hướng món của tay phụ theo nhóm tay dẫn
    const g = groupHold(prev.lead ? holdRun(keys, prev.lead, t0)!.hold : prev.hold);
    const solve: PlacedSolve = (c) => {
      const o: ItemOptions = {
        chars: { [id]: c },
        defaults: groupIntent(
          g.group,
          { item: g.item, group: g.group },
          itemGeom(itemSpec(rt, g.item)),
        ),
      };
      return graspArmAt(rt, id, side, t0, o, prev)?.sol;
    };
    return { run: prev, was: { k: 1 - smoothstep((time - k.t) / HOLD_BLEND), solve } };
  }
  return undefined;
}

/**
 * Lần cầm tay phụ của tay `side` ở `time` (`supportRun`): bàn tay suy từ món như tay khai `hold`, vừa cầm thì hoà từ tay
 * tự do (`enter`) hay từ lần cầm món đặt trước vừa xong (`was`); tay phụ vừa xong thì chỉ còn hoà ra
 */
function supportHold(
  host: GraspHost,
  keys: HandKey[],
  side: HandSide,
  time: number,
  held: Record<string, HeldItemSpec>,
): ReachHold | undefined {
  const { rt, id } = host;
  const run = supportRun(rt, keys, side, time);
  const was = placedWas(host, keys, side, time);
  if (!run) {
    if (!was) return undefined;
    const ref = sceneHoldRef(was.run.hold);
    return { ...ref, spec: held[ref.item], since: was.run.since, was: was.was, released: true };
  }
  const g = groupHold(run.hold);
  const blend = run.since > 0 && time - run.since < HOLD_BLEND;
  const prev = blend ? effRun(rt, keys, side, run.since - 1e-6) : undefined;
  const enter =
    blend && (!prev || sceneHoldRef(prev.hold).item !== g.item)
      ? smoothstep((time - run.since) / HOLD_BLEND)
      : undefined;
  return {
    ...sceneHoldRef(run.hold),
    spec: held[g.item],
    since: run.since,
    grasp: { hold: g, mode: "item", choice: {}, t0: run.since },
    solve: (c: ActCharacter, T?: Trunk3) =>
      graspAtTime(rt, id, side, time, {
        chars: { [id]: c },
        ...(T && { trunks: { [id]: T } }),
      }),
    ...(enter !== undefined && { enter }),
    ...(was && { was: was.was }),
  };
}

const sideSign = (side: HandSide) => (side === "right" ? -1 : 1);

/**
 * Chỗ cầm nhóm của lần cầm `run` ở `time`: mốc tay khai `hold` gần nhất của lần cầm, trường số hoà (`smoothstep`, như đích
 * tay) tới mốc `hold` sau của cùng lần cầm; trường mốc không khai lấy của `fill`. Kèm hướng khuỷu của mốc ấy
 */
function slideHold(
  keys: HandKey[],
  side: HandSide,
  time: number,
  run: HoldRun,
  fill: GraspChoice,
): { hold: SceneHoldGroup; elbow?: readonly number[] } {
  let a: HandKey | undefined;
  let b: HandKey | undefined;
  for (const k of keys) {
    if (!k[side]?.hold || k.t < run.since) continue;
    if (holdRun(keys, side, k.t)?.since !== run.since) break;
    if (k.t <= time) a = k;
    else {
      b = k;
      break;
    }
  }
  const ga = groupHold(a?.[side]?.hold ?? run.hold);
  const elbow = a?.[side]?.elbow;
  if (!a || !b) return { hold: ga, ...(elbow && { elbow }) };
  const gb = groupHold(b[side]!.hold!);
  const f = smoothstep((time - a.t) / (b.t - a.t));
  const out: SceneHoldGroup = { ...ga };
  for (const key of SLIDE_FIELDS) {
    const x = slideNum(key, ga[key] ?? fill[key]);
    const y = slideNum(key, gb[key] ?? fill[key]);
    if (x !== undefined && y !== undefined && x !== y) out[key] = x + (y - x) * f;
  }
  return { hold: out, ...(elbow && { elbow }) };
}

const handSizes = new Map<number, HandDims>();

/** Cỡ bàn tay của người mẫu (mặc áo) cao `height`: cho chỗ chưa có JSON nhân vật */
function holderDims(height: number): HandDims {
  let d = handSizes.get(height);
  if (!d) {
    const c = sampleChar(height);
    const sleeve = limbWidths(wornPalette(c)).sleeve;
    const hand = cladHand(sleeve, c.rig.stroke, bones3(height).foreArm * 100);
    handSizes.set(height, (d = handDims(hand.k, hand.long)));
  }
  return d;
}

/** Lựa chọn của tay dẫn: cảnh khai, còn lại mặc định của nhóm trên khối hình đầu tiên đạt nhóm, không giải */
function handChoice(
  held: Record<string, HeldItemSpec>,
  g: SceneHoldGroup,
  side: HandSide,
  height: number,
): GraspChoice {
  const spec = held[g.item] ?? held[heldBase(g.item)];
  if (!spec) return declared(g);
  const geom = itemGeom(spec);
  const group = GRIP_GROUPS[g.group];
  const kinds = new Set<string>(group.needs.flatMap((n) => n.kinds));
  const ok = (f: Feature) =>
    kinds.has(f.kind) && (g.part === undefined || f.part === g.part) && edgeOk(f, g.edge);
  const f =
    groupNeeds(geom, group, holderDims(height), spec.anchors).find(ok) ?? geom.features.find(ok);
  const defs = holdDefaults(group, geom, {
    ...(f && { feature: f }),
    side: sideSign(side),
  }) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of GRASP_FIELDS) if (defs[k] !== undefined) out[k] = defs[k];
  // tấm một tay: `along` theo cạnh và bên tay, điền lúc dựng khung (`holdLink`)
  if (g.group === "sheet" && !g.both) delete out.along;
  if (f) Object.assign(out, { part: f.part, feature: f.kind });
  return { ...(out as GraspChoice), ...declared(g) };
}

/**
 * Chỗ cầm nhóm của lần cầm `run` ở `time` (`ReachHold.grasp`): món đặt trước chỉ mang trường cảnh khai — lựa chọn rig giải
 * lấy ở `graspAtTime` với JSON nhân vật thật
 */
function holdGraspAt(
  host: GraspHost,
  keys: HandKey[],
  side: HandSide,
  time: number,
  run: HoldRun,
): HoldGrasp {
  const g = groupHold(run.hold);
  const rm = runMarks(host.rt, keys, side, run);
  const mode = rm.marks.length ? "item" : "hand";
  const base = mode === "item" ? {} : handChoice(host.rt.held, g, side, host.height);
  const { hold } = slideHold(keys, side, time, run, base);
  const inherit = mode === "hand" ? keyedInherit(host, keys, side, run, hold) : undefined;
  return {
    hold,
    mode,
    choice: { ...base, ...declared(hold) },
    t0: run.since,
    ...(rm.keyed && { keyed: true as const }),
    ...(inherit && { inherit }),
    ...(restingMark(rm, time) && { rest: true as const }),
  };
}

const inherits = new WeakMap<
  SceneRuntime,
  Map<string, ReturnType<NonNullable<HoldGrasp["inherit"]>>>
>();

/**
 * Tay dẫn `run` nối ngay sau lần cầm theo mốc cùng món, cùng nhóm, cùng tay (`regrip`, đổi trường số): lựa chọn và đầu cao
 * rig đã giải của lần cầm ấy ngay trước ranh giới, trường cảnh khai của `hold` đè; khác thì `undefined`
 */
function keyedInherit(
  host: GraspHost,
  keys: HandKey[],
  side: HandSide,
  run: HoldRun,
  hold: SceneHoldGroup,
): HoldGrasp["inherit"] {
  if (run.lead || run.since <= 0) return undefined;
  const { rt, id } = host;
  const t0 = run.since - 1e-6;
  const prev = holdRun(keys, side, t0);
  if (!prev || !runMarks(rt, keys, side, prev).keyed) return undefined;
  const pg = groupHold(prev.hold);
  if (pg.item !== hold.item || pg.group !== hold.group) return undefined;
  const said = declared(hold);
  return (c) => {
    let m = inherits.get(rt);
    if (!m) inherits.set(rt, (m = new Map()));
    const key = `${id}|${side}|${run.since}|${charId(c)}|${JSON.stringify(said)}`;
    if (m.has(key)) return m.get(key);
    const sol = graspAtTime(rt, id, side, t0, { chars: { [id]: c } });
    let out: ReturnType<NonNullable<HoldGrasp["inherit"]>>;
    if (sol) {
      const choice: GraspChoice = { ...sol.choice, ...said };
      // khai phần, cạnh hay mặt ngón cái khác: khối hình và đầu cao tìm lại theo trường khai
      const moved = (["part", "edge", "thumb"] as const).some(
        (k) => said[k] !== undefined && said[k] !== sol.choice[k],
      );
      if (moved) {
        delete choice.featureIndex;
        delete choice.feature;
      }
      out = { choice, ...(sol.high && !moved && { high: sol.high }) };
    }
    m.set(key, out);
    return out;
  };
}

/** Một lần cầm món đặt trước của một tay: lựa chọn giải ở `t0`, chuỗi `φ` mẫu cách `HOLD_SLEW_STEP` từ `t0` */
interface GraspRun {
  sol: GraspSolution;
  ctx: GraspCtx;
  t0: number;
  phiPrev?: number;
  chain: { t: number; sol: ArmSol }[];
  /** Lần cầm theo mốc: nghiệm ở từng mốc món, thay cho chuỗi `φ` */
  keyed?: KeyedMark[];
}

/** Lần cầm theo mốc ở một mốc món: cổ tay `W` (so với vai bên ấy) và khung bàn tay `R` trong hệ thân (`Rr`), `φ`, góc cổ tay */
interface KeyedMark {
  t: number;
  ease?: SceneItemMark["ease"];
  W: V3;
  R: M3;
  phi: number;
  /** Xoay, gập, lệch đã kẹp; phần vượt kẹp */
  wrist: number[];
  over: number[];
}

/** Lần cầm theo mốc: số mốc sau mốc đầu cộng vào giá của lựa chọn (`chooseMissing`) */
const KEYED_MAX = 8;

/** Lần cầm món đặt trước đã giải, theo runtime: Remotion vẽ khung nhảy cóc thì chuỗi vẫn tính từ `t0`, ra cùng số */
const graspRuns = new WeakMap<SceneRuntime, Map<string, GraspRun>>();
const charIds = new WeakMap<object, number>();
let charSeq = 0;
const charId = (c: object | undefined): number => {
  if (!c) return 0;
  let n = charIds.get(c);
  if (n === undefined) charIds.set(c, (n = ++charSeq));
  return n;
};

const handKeys = (rt: SceneRuntime, id: string): HandKey[] => member(rt, id).world?.hands ?? [];

/** Giây mốc tay đầu tiên sau `run` mở lần cầm khác hay buông; lần cầm tới hết cảnh là `Infinity` */
function runEnd(keys: HandKey[], side: HandSide, run: HoldRun): number {
  if (run.lead) return run.end ?? Infinity;
  for (const k of keys)
    if (
      k.t > run.since &&
      k[side]?.hold !== undefined &&
      holdRun(keys, side, k.t)?.since !== run.since
    )
      return k.t;
  return Infinity;
}

/** Hướng mặc định của món theo nhóm tay `keys` đang cầm nó ở `time` (tay phải trước); không tay nào cầm thì `undefined` */
function itemGroupDefaults(
  keys: HandKey[],
  spec: () => HeldItemSpec,
  item: string,
  time: number,
): ItemDefaults | undefined {
  for (const side of ["right", "left"] as const) {
    const run = holdRun(keys, side, time);
    if (!run) continue;
    const g = groupHold(run.hold);
    if (g.item !== item) continue;
    return groupIntent(g.group, { item, group: g.group }, itemGeom(spec()));
  }
  return undefined;
}

/**
 * Lựa chọn của lần cầm `run` món đặt trước, giải một lần (`chooseMissing`): lần cầm theo mốc ở mốc món đầu, cộng các mốc
 * sau của lần cầm (tối đa `KEYED_MAX`), rồi giải bàn tay ở từng mốc (`KeyedMark`); lần cầm khác ở mốc bắt đầu, cộng các mốc
 * món trong `LATER_SPAN` giây còn trong lần cầm. `φ_trước` là `φ` cuối của lần cầm món đặt trước liền trước trên cùng tay
 */
function graspStart(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  run: HoldRun,
  o: ItemOptions = {},
): GraspRun {
  const key = `${id}|${side}|${run.since}|${charId(o.chars?.[id])}`;
  let m = graspRuns.get(rt);
  if (!m) graspRuns.set(rt, (m = new Map()));
  const hit = m.get(key);
  if (hit) return hit;
  const keys = handKeys(rt, id);
  const rm = runMarks(rt, keys, side, run);
  const marks = rm.keyed ? rm.marks : undefined;
  const t0 = run.since;
  const holder = (t: number) => graspCtx(holderTrunk(rt, id, t, o), rt.held);
  // lần cầm theo mốc giải lựa chọn ở mốc món đầu: trước mốc ấy bàn tay giữ nghiệm của nó
  const ts = marks ? marks[0].t : t0;
  const ctx = holder(ts);
  const g = run.lead
    ? supportAt(rt, id, run, ctx, o)
    : groupHold((holdRun(keys, side, t0) ?? run).hold);
  const before = effRun(rt, keys, side, t0 - 1e-6);
  const phiPrev =
    before && placedRun(rt, keys, side, before) ? lastPhi(rt, id, side, before, t0, o) : undefined;
  const poseAt = (t: number) => itemAt(rt, g.item, t, o)!;
  const end = runEnd(keys, side, run);
  const after = marks
    ? marks.slice(1, 1 + KEYED_MAX)
    : (rt.items ?? []).filter(
        (k) => k.item === g.item && k.t > t0 && k.t <= t0 + LATER_SPAN + 1e-9 && k.t < end,
      );
  const later: GraspLater[] = after.map((k) => {
    const other = placedOther(rt, id, side, k.t, o);
    return { t: k.t, pose: poseAt(k.t), ctx: holder(k.t), ...(other && { other }) };
  });
  const { elbow } = slideHold(keys, side, ts, run, {});
  const other = placedOther(rt, id, side, ts, o);
  const keep = marks && !run.lead ? priorChoice(rt, id, side, run, o) : undefined;
  const sol = chooseMissing(ctx, g, poseAt(ts), sideSign(side), {
    t0: ts,
    later,
    ...(marks && { span: Infinity, laterMax: KEYED_MAX }),
    ...(keep && { keep }),
    ...(phiPrev !== undefined && { phiPrev }),
    ...(elbow && { elbow }),
    ...(other && { other }),
  });
  const out: GraspRun = { sol, ctx, t0, ...(phiPrev !== undefined && { phiPrev }), chain: [] };
  if (marks) {
    // mỗi mốc: bàn tay trên món ở mốc, `φ` liền với mốc trước; lưu trong hệ thân (vai bên ấy, `Rr`)
    const keyed: KeyedMark[] = [];
    let prev = phiPrev;
    for (const k of marks) {
      const q = graspSample(rt, id, side, run, out, k.t, o);
      const a = solvePhi(q.inp, q.Wp, q.Rw, prev, placedOther(rt, id, side, k.t, o), q.elbow);
      const Rt = tr3(q.inp.Rr);
      const w = a.wrist;
      keyed.push({
        t: k.t,
        ease: k.ease,
        W: matVec(Rt, sub3(q.Wp, q.inp.S)),
        R: matMul(Rt, q.Rw),
        phi: a.phi,
        wrist: [
          clampTo(w.turn, TURN_MAX),
          clampRange(w.bend, AIM_BEND),
          clampRange(w.dev, AIM_DEV),
        ],
        over: [w.over.turn, w.over.bend, w.over.dev],
      });
      prev = a.phi;
    }
    out.keyed = keyed;
  }
  m.set(key, out);
  return out;
}

/**
 * Lựa chọn ngay trước lần cầm theo mốc `run` của lần cầm liền trước cùng món, cùng nhóm, cùng tay (`GraspOpts.keep`):
 * món đặt trước thì lựa chọn đã giải và đầu cao; tay dẫn thì lựa chọn kế thừa (`inherit`) hay trường khai cộng mặc định nhóm
 */
function priorChoice(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  run: HoldRun,
  o: ItemOptions,
): GraspOpts["keep"] {
  if (run.since <= 0) return undefined;
  const keys = handKeys(rt, id);
  const t = run.since - 1e-6;
  const prev = holdRun(keys, side, t);
  if (!prev || prev.since === run.since) return undefined;
  const pg = groupHold(prev.hold);
  const g = groupHold(run.hold);
  if (pg.item !== g.item || pg.group !== g.group) return undefined;
  if (placedRun(rt, keys, side, prev)) {
    const s = graspAtTime(rt, id, side, t, o);
    return s && { choice: s.choice, ...(s.high && { high: s.high }) };
  }
  const hg = holdGraspAt({ rt, id, height: rt.heights[id] ?? 1 }, keys, side, t, prev);
  const c = o.chars?.[id];
  return (c && hg.inherit?.(c)) || { choice: hg.choice };
}

const clampTo = (v: number, L: number) => Math.max(-L, Math.min(L, v));
const wrapDeg = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const lerpN = (a: readonly number[], b: readonly number[], f: number) =>
  a.map((x, i) => x + (b[i] - x) * f);

/** Hai mốc kề `time` của lần cầm theo mốc và hệ số hoà theo `ease` của mốc sau; ngoài khoảng mốc thì mốc gần nhất */
function keyedSpan(ks: readonly KeyedMark[], time: number) {
  let i = 0;
  while (i + 1 < ks.length && ks[i + 1].t <= time) i++;
  const a = ks[i];
  const b = time > a.t ? ks[i + 1] : undefined;
  const f = b ? easeAt({ ease: b.ease ?? "smooth" }, (time - a.t) / (b.t - a.t)) : 0;
  return { a, b: b ?? a, f };
}

/** `φ` của lần cầm theo mốc ở `time`: đường ngắn nhất giữa hai mốc kề */
function keyedPhi(ks: readonly KeyedMark[], time: number): number {
  const { a, b, f } = keyedSpan(ks, time);
  return wrapDeg(a.phi + wrapDeg(b.phi - a.phi) * f);
}

/**
 * Bàn tay của lần cầm theo mốc ở `time` (như `solveActing` của `act3.ts`): cổ tay dời thẳng và bàn tay quay đường ngắn nhất
 * trong hệ thân, đổi ra thế giới bằng thân ở chính `time`; `φ` đường ngắn nhất; góc cổ tay đã kẹp hoà thẳng
 */
function keyedArm(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  run: HoldRun,
  r: GraspRun,
  time: number,
  o: ItemOptions,
) {
  const { a, b, f } = keyedSpan(r.keyed!, time);
  const T = holderTrunk(rt, id, time, o);
  const { elbow, frame } = graspFrameAt(rt, id, side, run, r, time, T, T.s);
  const inp = armInput(T, sideSign(side));
  const Wp = add3(inp.S, matVec(inp.Rr, lerpN(a.W, b.W, f) as V3));
  const Rw = matMul(inp.Rr, mixRotation(a.R, b.R, f));
  const other = placedOther(rt, id, side, time, o);
  const arm = evalPhi(inp, Wp, Rw, keyedPhi(r.keyed!, time), undefined, other, elbow);
  const [turn, bend, dev] = lerpN(a.wrist, b.wrist, f);
  const over = lerpN(a.over, b.over, f);
  return {
    inp,
    Wp,
    Rw,
    frame,
    arm: {
      ...arm,
      wrist: { turn, bend, dev, over: { turn: over[0], bend: over[1], dev: over[2] } },
    },
  };
}

/**
 * Chỗ cầm của tay phụ `run` ở mốc bắt đầu: `supportChoice` trên khung tay dẫn đã giải ở giây ấy; trường còn thiếu
 * `chooseMissing` giải
 */
function supportAt(
  rt: SceneRuntime,
  id: string,
  run: HoldRun,
  ctx: GraspCtx,
  o: ItemOptions,
): SceneHoldGroup {
  const L = holdRun(handKeys(rt, id), run.lead!, run.since)!;
  const lead = graspArmAt(rt, id, run.lead!, run.since, o, L)!.sol;
  const g = groupHold(L.hold);
  const sc = supportChoice(itemSpec(rt, g.item), g, lead.frame, ctx.dims)!;
  const c: GraspChoice = { ...sc.choice };
  // tay phụ khác nhóm: hướng ngón trên mặt đỡ để `chooseMissing` giải, trừ khi cảnh khai
  if (sc.group !== g.group && (g.both === true || g.both?.psi === undefined)) delete c.psi;
  return { ...c, item: g.item, group: sc.group } as SceneHoldGroup;
}

/** `φ` mẫu cuối (không trước `t1`) của lần cầm `run`; lần cầm theo mốc thì `φ` ở `t1` */
function lastPhi(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  run: HoldRun,
  t1: number,
  o: ItemOptions,
): number {
  const r = graspStart(rt, id, side, run, o);
  if (r.keyed) return keyedPhi(r.keyed, t1);
  const n = Math.max(0, Math.ceil((t1 - r.t0) / HOLD_SLEW_STEP - 1e-9));
  chainTo(rt, id, side, run, r, n, o);
  return r.chain[n].sol.phi;
}

/** Khung cầm ở `time` của lần cầm đã giải `r` (trường số đã hoà) trên thân `T`, món cỡ `s`, kèm hướng khuỷu của mốc tay */
function graspFrameAt(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  run: HoldRun,
  r: GraspRun,
  time: number,
  T: Trunk3,
  s: number,
) {
  const { hold, elbow } = slideHold(handKeys(rt, id), side, time, run, r.sol.choice);
  const choice = { ...r.sol.choice, ...declared(hold) };
  const spec = itemSpec(rt, hold.item);
  const frame = graspFrame(
    spec,
    itemGeom(spec),
    { ...choice, group: hold.group },
    sideSign(side),
    r.ctx.dims,
    r.ctx.k * T.s,
    r.ctx.long * T.s,
    s,
    r.sol.high,
  );
  return { elbow, frame };
}

/** Món, khung cầm, cổ tay, khung bàn tay và tay ở `time` của lần cầm đã giải `r` */
function graspSample(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  run: HoldRun,
  r: GraspRun,
  time: number,
  o: ItemOptions,
) {
  const pose = itemAt(rt, groupHold(run.hold).item, time, o)!;
  const T = holderTrunk(rt, id, time, o);
  const { elbow, frame } = graspFrameAt(rt, id, side, run, r, time, T, pose.s);
  const { Wp, Rw } = handFromItem(pose.R, pose.P, pose.s, frame.G);
  return { inp: armInput(T, sideSign(side)), Wp, Rw, elbow, frame };
}

/** Chuỗi `φ` của `r` tới mẫu `n`: mẫu `i` ở `t0 + i · HOLD_SLEW_STEP` lấy `φ_trước` là mẫu `i − 1` (như `phiChain`) */
function chainTo(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  run: HoldRun,
  r: GraspRun,
  n: number,
  o: ItemOptions,
) {
  while (r.chain.length <= n) {
    const i = r.chain.length;
    const t = r.t0 + i * HOLD_SLEW_STEP;
    const q = graspSample(rt, id, side, run, r, t, o);
    const prev = i ? r.chain[i - 1].sol.phi : r.phiPrev;
    const other = placedOther(rt, id, side, t, o);
    r.chain.push({ t, sol: solvePhi(q.inp, q.Wp, q.Rw, prev, other, q.elbow) });
  }
}

/** Bàn tay cầm món đặt trước ở một khung: nghiệm của lần cầm bắt đầu ở `t0`, khung cầm, cổ tay, cánh tay ở khung ấy */
export interface GraspAtTime extends GraspSolution {
  t0: number;
}

/**
 * Bàn tay `side` của `id` cầm món đặt trước ở `time`: lựa chọn giải một lần ở mốc bắt đầu lần cầm, khung cầm theo chỗ cầm
 * (trường số đã hoà) trên món ở `itemAt`, `φ` hoà giữa hai mẫu kề của chuỗi tính từ đầu lần cầm. `o.chars` bắt buộc: JSON
 * nhân vật thật của người cầm, thiếu thì `HolderCharError`. Nhớ theo runtime và nhân vật; tay không cầm món đặt trước thì
 * `undefined`. docs/11-nhom-cam.md mục 5
 */
export function graspAtTime(
  rt: SceneRuntime,
  id: string,
  side: "right" | "left",
  time: number,
  o: ItemOptions = {},
): GraspAtTime | undefined {
  return graspArmAt(rt, id, side, time, o)?.sol;
}

/**
 * Tay đã đặt trên món đặt trước ở `time` cho số hạng lấn của tay `side` giải sau nó: tay dẫn của `both` giải trước, tay phụ
 * sau; không có `both` thì tay phải trước (docs/11-nhom-cam.md § Khuỷu tự nhiên)
 */
function placedOther(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  time: number,
  o: ItemOptions,
): ArmSeg | undefined {
  const keys = handKeys(rt, id);
  const other = otherSide(side);
  const own = holdRun(keys, side, time);
  if (
    own ? !!supportRun(rt, keys, other, time) || side !== "left" : !supportRun(rt, keys, side, time)
  )
    return undefined;
  const r = graspArmAt(rt, id, other, time, o);
  return r && armSeg(r.inp, r.sol.arm);
}

function graspArmAt(
  rt: SceneRuntime,
  id: string,
  side: HandSide,
  time: number,
  o: ItemOptions,
  run = effRun(rt, handKeys(rt, id), side, time),
): { sol: GraspAtTime; inp: ArmInput } | undefined {
  if (!run || !placedRun(rt, handKeys(rt, id), side, run)) return undefined;
  // `trunks` là thân ở đúng `time`: mẫu của chuỗi ở giây khác dựng thân riêng
  const at = { ...o, trunks: undefined };
  const r = graspStart(rt, id, side, run, at);
  if (r.keyed) {
    const k = keyedArm(rt, id, side, run, r, time, o);
    const rest = restingMark(runMarks(rt, handKeys(rt, id), side, run), time);
    const still = rest && itemAt(rt, rest.item, rest.t, at);
    return {
      sol: {
        ...r.sol,
        choice: k.frame.choice,
        frame: k.frame,
        Wp: k.Wp,
        Rw: k.Rw,
        arm: k.arm,
        t0: r.t0,
        ...(still && { still }),
      },
      inp: k.inp,
    };
  }
  chainTo(rt, id, side, run, r, Math.max(0, Math.floor((time - r.t0) / HOLD_SLEW_STEP)) + 1, at);
  const q = graspSample(rt, id, side, run, r, time, o);
  const other = placedOther(rt, id, side, time, o);
  const arm = evalPhi(q.inp, q.Wp, q.Rw, phiAt(r.chain, time), undefined, other, q.elbow);
  return {
    sol: { ...r.sol, choice: q.frame.choice, frame: q.frame, Wp: q.Wp, Rw: q.Rw, arm, t0: r.t0 },
    inp: q.inp,
  };
}

/**
 * Mốc thân của người `id` (người 3D trong `cast`) ở `time`, toạ độ thế giới rig, ước từ chỗ đặt, góc cúi thân và khung
 * xương theo `rig.height` — không giải tay, không đọc đầu quay: đủ cho hướng món quay về người ấy (`face: { cast }`)
 */
function castMarkAt(rt: SceneRuntime, id: string, mark: BodyMark | undefined, time: number): V3 {
  const m = member(rt, id);
  const lens =
    (m.world && rt.lens) || fail(`\`${id}\`: \`face: { cast }\` cần người 3D (\`cast[].world\`)`);
  const height = rt.heights[id] ?? 1;
  const dims = rt.bodies[id] ?? BODY3;
  const walk = walkerOf(rt, m, height, dims.hipHalf);
  const pose = worldPoseAt(m, time, walk, height, dims.hipHalf);
  const w = worldAt(lens, m.world!, time, pose, height, dims.legHalf, walk).world;
  const B = bones3(height);
  const k = 100 * w.s;
  const bend = (pose.torso ?? 0) * D;
  // hệ thân rig: tiến theo `dirOf(yaw)`, y xuống
  const F = dirOf(w.yaw);
  const along = (up: number, fwd: number): V3 => [
    w.hip[0] + F[0] * fwd * k,
    w.hip[1] - up * k,
    w.hip[2] + F[2] * fwd * k,
  ];
  const onTorso = (u: number, front = 0) => along(u * Math.cos(bend), u * Math.sin(bend) + front);
  const which = mark ?? "eye";
  if (which === "chest") return onTorso(0.7 * B.torso, 0.12);
  if (which === "belly") return onTorso(0.3 * B.torso, 0.14);
  const neck = B.torso + B.neck * 0.5;
  const head = neck + head3(B) - B.neck * 0.5;
  // mặt trước sọ: nửa bề sâu đầu ra trước, mồm thấp hơn mắt chừng một phần năm đầu
  return onTorso(which === "mouth" ? head - B.head * 0.35 : head - B.head * 0.1, B.head * 0.45);
}

/** Lần cầm của mốc `hold` cho `isCarryHold` / `carrySpecOf`: chỗ cầm nhóm của cảnh */
const carryRef = (h: SceneHold): CarryRef => ({ grasp: { hold: groupHold(h) } });

/** Mốc tay của món đặt trước không khai đích, ý định: bàn tay suy từ món (docs/11-nhom-cam.md#chỗ-cầm) */
const PLACED_TARGET = ["to", "at", "offset", "point"] as const;
const PLACED_INTENT = ["face", "up", "roll", "keep"] as const;

/**
 * Lần cầm khai ở `world.hands` của người `who` phải có thật: món trong `held`, trục ý định trên mốc có `dir`, người khác
 * của `face: { cast }`, và `point: "item:<mốc>"` chỉ ở mốc đang cầm, mốc ấy có trên món. Chỗ cầm nhóm: món có khối hình cho nhóm với cỡ tay `dims` (lỗi `group`), chỗ cầm hợp lệ (lỗi `choice`: `checkChoice`, món đặt trước
 * mà mốc tay khai đích hay ý định, `both` mà tay kia cũng cầm). Mốc món của `who` khai `face` trần mà nhóm tay đang cầm
 * không có trục mặc định: lỗi `item`
 */
function checkHolds(
  who: string,
  keys: HandKey[],
  held: Record<string, HeldItemSpec>,
  cast: { id: string; world?: unknown }[],
  items: SceneItemMark[] = [],
  dims: () => HandDims = () => holderDims(1),
) {
  // lần cầm có mốc món của chính người ấy: bàn tay suy từ món
  const marked = (side: HandSide, run: HoldRun) => {
    const item = groupHold(run.hold).item;
    const end = runEnd(keys, side, run);
    return items.some(
      (m) => m.item === item && m.cast === who && m.t >= run.since - 1e-9 && m.t < end,
    );
  };
  for (const k of keys)
    for (const side of ["right", "left"] as const) {
      const h = k[side];
      const where = `${who}: \`world.hands\` ${side} t=${k.t}`;
      const cur = holdRun(keys, side, k.t);
      const g = cur && groupHold(cur.hold);
      if (g?.both && holdRun(keys, side === "right" ? "left" : "right", k.t))
        fail(
          `${where} (lỗi \`choice\`): \`${g.item}@${g.group}\` khai \`both\` mà tay kia cũng cầm ở giây này — bỏ \`both\` hay \`hold\` của tay kia`,
        );
      if (!h) continue;
      if (g && marked(side, cur!)) {
        const bad = [
          ...PLACED_TARGET.filter((f) => h[f] !== undefined),
          ...(h.hold && typeof h.hold === "object"
            ? PLACED_INTENT.filter((f) => (h.hold as Record<string, unknown>)[f] !== undefined)
            : []),
        ];
        if (bad.length)
          fail(
            `${where} (lỗi \`choice\`): lần cầm \`${g.item}\` có mốc ở \`items\` — bàn tay suy từ món, mốc tay không khai ${bad.map((f) => `\`${f}\``).join(", ")} (docs/11-nhom-cam.md#chỗ-cầm)`,
          );
      }
      if (h.hold) {
        const { item } = sceneHoldRef(h.hold);
        const spec =
          held[item] ??
          fail(`${where}: không có món \`${item}\` (\`held/${heldBase(item)}.json\`)`);
        const hg = groupHold(h.hold);
        const geom = itemGeom(spec);
        const later = !!GRIP_GROUPS[hg.group].later;
        const partOk =
          hg.part === undefined || geom.parts.some((p) => p.name === hg.part && p.grip);
        const groupLines =
          later || !partOk
            ? []
            : checkGroup(geom, hg.group, dims(), { item, part: hg.part, anchors: spec.anchors });
        const choiceLines = checkChoice(
          hg.group,
          geom,
          h.hold,
          dims(),
          spec.anchors,
          spec.shape,
          spec.authored,
        ).filter((l) => !groupLines.includes(l));
        const lines = [
          ...groupLines.map((l) => `lỗi \`group\`: ${l}`),
          ...choiceLines.map((l) => `lỗi \`choice\`: ${l}`),
        ];
        if (lines.length) fail(`${where}: ${lines.join("; ")}`);
        try {
          const { face, roll } = groupIntent(hg.group, h.hold, geom);
          for (const a of [face, roll])
            if (a) {
              heldAxis(spec, a.axis);
              const t = a.toward;
              if (typeof t === "object" && !Array.isArray(t) && "cast" in t) {
                const c = cast.find((m) => m.id === t.cast);
                if (!c?.world) throw new Error(`\`${t.cast}\` không phải người 3D trong \`cast\``);
                if (t.mark && !(CAST_MARKS as readonly string[]).includes(t.mark))
                  throw new Error(`mốc trên người khác chỉ ước được ${CAST_MARKS.join(", ")}`);
              }
            }
        } catch (e) {
          fail(`${where}: ${(e as Error).message}`);
        }
      }
      if (typeof h.point === "string" && h.point.startsWith("item:")) {
        const run =
          holdRun(keys, side, k.t) ??
          fail(`${where}: \`point: ${h.point}\` cần món đang cầm (\`hold\`)`);
        const { item } = sceneHoldRef(run.hold);
        const spec = held[item];
        const ref = carryRef(run.hold);
        if (spec && isCarryHold(ref))
          fail(
            `${where}: \`point: ${h.point}\` cần món cầm trong bàn tay — \`${item}@carry\` treo trên tay (\`on: ${ref.grasp!.hold.on}\`)`,
          );
        try {
          if (spec) heldPoint(spec, h.point.slice(5));
        } catch (e) {
          fail(`${where}: ${(e as Error).message}`);
        }
      }
    }
  for (const k of items) {
    const spec = held[k.item] ?? held[heldBase(k.item)];
    if (k.cast !== who || !spec || !bareFace(k)) continue;
    // không tay nào cầm ở giây ấy: `sceneItemHoldProblems` báo
    const d = itemGroupDefaults(keys, () => spec, k.item, k.t);
    try {
      if (d) itemIntent(k, d);
    } catch (e) {
      fail(`${who}: (lỗi \`item\`) ${(e as Error).message}`);
    }
  }
}

/** Bên của mốc thân người cầm món đặt trước: tay phải — `offset` ngang và `PALM_DIRS` `out` dương về phía tay phải */
const ITEM_SIDE = -1;
/** Góc ngẩng lớn nhất của `holderFace` ở mốc món: món ngang ngực người chibi mà không kẹp thì mặt món gần ngửa */
const HOLDER_FACE_RISE = 45 * D;
/** Trục phụ lệch trục chính dưới 18° (|cos| > 0,95): hướng món suy biến, `check` báo */
const ITEM_AXIS_COS = 0.95;

/** Hướng mặc định của nhóm đang cầm, cho trục món mà mốc không khai */
export interface ItemDefaults {
  face?: AxisIntent;
  up?: string | V3;
  roll?: AxisIntent;
}

export interface ItemOptions {
  /** JSON nhân vật của người cầm theo `id`; bắt buộc ở đường món đặt trước, thiếu người cầm thì ném `HolderCharError` */
  chars?: Record<string, ActCharacter>;
  /** Hướng mặc định cho trục mốc không khai; thiếu thì lấy của nhóm tay người cầm (`cast` của mốc) đang cầm món */
  defaults?: ItemDefaults;
  /** Thân 3D đã dựng của người cầm theo `id`, ở đúng giây đang hỏi; thiếu thì dựng (nhớ theo runtime) */
  trunks?: Record<string, Trunk3>;
}

/** Đường món đặt trước thiếu JSON nhân vật của người cầm (`ItemOptions.chars`) */
export class HolderCharError extends Error {
  readonly id: string;
  constructor(id: string) {
    super(
      `scene: \`${id}\` cầm món đặt trước — cần JSON nhân vật của người ấy (\`chars.${id}\`), không dựng trên người mẫu`,
    );
    this.name = "HolderCharError";
    this.id = id;
  }
}

/** Mốc món khai `face` là đích trần mà không có trục: mốc không khai `axis`, nhóm đang cầm không có trục mặc định */
export class ItemAxisError extends Error {
  readonly item: string;
  readonly t: number;
  constructor(k: SceneItemMark) {
    super(
      `\`items\` ${k.item} t=${k.t}: \`face\` là đích trần mà không có trục — nhóm đang cầm không có trục mặc định; khai \`face: { axis, toward }\` hay \`up\` (docs/11-nhom-cam.md#mốc-món-items)`,
    );
    this.name = "ItemAxisError";
    this.item = k.item;
    this.t = k.t;
  }
}

/** Món đặt trước ở một giây: điểm món `q` (khung món, đơn vị rig) nằm ở `P + R · q · s` (thế giới rig) */
export interface ItemPose {
  /** Khung món → thế giới rig */
  R: M3;
  /** Gốc khung món, thế giới rig */
  P: V3;
  /** Người cầm của mốc gần nhất không sau giây ấy */
  cast: string;
  /** `world.s` của người cầm */
  s: number;
  /** Trục phụ lệch trục chính dưới 18°: hướng món suy biến */
  degenerate?: true;
  /** Đích của một trục trùng chỗ món: trục ấy không cho hướng */
  coincident?: true;
  /** Món nằm trên một mặt (mốc `rest`, không hoà giữa hai mốc): mặt đỡ ngang qua điểm thấp nhất của món */
  rest?: true;
}

const toThree = (p: readonly number[]): V3 => [p[0] / 100, -p[1] / 100, -p[2] / 100];
const norm3 = (v: V3): V3 => scale3(v, 1 / (Math.hypot(...v) || 1));
const perp3 = (v: V3, n: V3): V3 => sub3(v, scale3(n, dot3(v, n)));
const tr3 = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];

const sampleChars = new Map<number, ActCharacter>();
function sampleChar(height: number): ActCharacter {
  let c = sampleChars.get(height);
  if (!c) {
    const d = defaultCharacter();
    c = {
      ...d,
      rig: { ...d.rig, height },
      palette: { ...d.palette, clad: true },
      head: { ...d.head, form: "human" },
    };
    sampleChars.set(height, c);
  }
  return c;
}

/** Thân người cầm đã dựng, theo runtime; khoá `id|giây|nhân vật`, giữ `TRUNK_KEEP` thân gần nhất */
const trunks = new WeakMap<SceneRuntime, Map<string, Trunk3>>();
const TRUNK_KEEP = 64;

/** Thân 3D của người cầm `id` ở `time` (chưa giải tay, nên mốc món không vòng qua bàn tay) */
function holderTrunk(rt: SceneRuntime, id: string, time: number, o: ItemOptions): Trunk3 {
  const given = o.trunks?.[id];
  if (given) return given;
  const c = o.chars?.[id];
  if (!c) throw new HolderCharError(id);
  let memo = trunks.get(rt);
  if (!memo) trunks.set(rt, (memo = new Map()));
  const key = `${id}|${time}|${charId(c)}`;
  const hit = memo.get(key);
  if (hit) return hit;
  const m = member(rt, id);
  const lens =
    (m.world && rt.lens) ||
    fail(`\`${id}\`: người cầm món đặt trước phải là người 3D (\`cast[].world\`)`);
  const height = rt.heights[id] ?? 1;
  const dims = rt.bodies[id] ?? BODY3;
  const walk = walkerOf(rt, m, height, dims.hipHalf);
  const pose = worldPoseAt(m, time, walk, height, dims.hipHalf);
  const world = worldAt(lens, m.world!, time, pose, height, dims.legHalf, walk).world;
  const T = trunk3(c, { pose, world })!;
  if (memo.size >= TRUNK_KEEP) memo.delete(memo.keys().next().value!);
  memo.set(key, T);
  return T;
}

const eyeMid = (T: Trunk3): V3 =>
  scale3(
    add3(markAt(T, { to: "eye" }, -1, undefined), markAt(T, { to: "eye" }, 1, undefined)),
    0.5,
  );

/** Chỗ mốc thân `to` dời `offset` của người cầm (three); `eye` là giữa hai mắt */
function itemMarkPoint(T: Trunk3, to: BodyMark, offset?: readonly number[]): V3 {
  if (to !== "eye") return markAt(T, { to, offset }, ITEM_SIDE, undefined);
  if (!offset) return eyeMid(T);
  const moved = sub3(
    markAt(T, { to, offset }, ITEM_SIDE, undefined),
    markAt(T, { to }, ITEM_SIDE, undefined),
  );
  return add3(eyeMid(T), moved);
}

/** `holderFace` từ `from` (three): ngang về tâm sọ, ngẩng tới tầm giữa hai mắt, góc ngẩng kẹp `HOLDER_FACE_RISE` */
function holderFace(T: Trunk3, from: V3): V3 {
  let h = sub3(T.out.head, from);
  const rise = Math.min(
    Math.atan2(eyeMid(T)[1] - from[1], Math.hypot(h[0], h[2])),
    HOLDER_FACE_RISE,
  );
  if (Math.hypot(h[0], h[2]) < 1e-9) h = matVec(T.Rr, [0, 0, -1]);
  const k = Math.hypot(h[0], h[2]);
  return [(h[0] / k) * Math.cos(rise), Math.sin(rise), (h[2] / k) * Math.cos(rise)];
}

/** Hướng từ `from` (three) tới đích ý định của mốc món, đọc ở `time`; vectơ ở hệ thân người cầm */
function itemToward(rt: SceneRuntime, T: Trunk3, t: IntentTarget, from: V3, time: number): V3 {
  if (t === "holderFace") return holderFace(T, from);
  if (t === "camera") {
    const eye = T.W.eye ?? T.W.lens?.eye ?? fail("`camera` cần `scene.lens`");
    return sub3(toThree(eye), from);
  }
  const body = (v: readonly number[]) => matVec(T.Rr, [ITEM_SIDE * v[2], -v[1], v[0]]);
  if (typeof t === "string") return body(PALM_DIRS[t]);
  if (Array.isArray(t)) return body(t);
  if ("cast" in t) return sub3(toThree(castMarkAt(rt, t.cast, t.mark, time)), from);
  const ref = { to: t.mark, side: t.side, offset: t.offset };
  return sub3(markAt(T, ref, ITEM_SIDE, undefined), from);
}

/** Phép quay ngắn nhất đưa hướng đơn vị `a` tới `b` */
function arcRot(a: V3, b: V3): M3 {
  const u = cross3(a, b);
  const c = Math.max(-1, Math.min(1, dot3(a, b)));
  if (Math.hypot(...u) > 1e-9) return rotAxis(norm3(u), Math.acos(c));
  if (c > 0) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  return rotAxis(norm3(perp3(Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], a)), Math.PI);
}

/** `face` của mốc món là đích trần (không `axis`) */
const bareFace = (k: SceneItemMark): boolean =>
  k.up === undefined &&
  k.face !== undefined &&
  !(typeof k.face === "object" && !Array.isArray(k.face) && "axis" in k.face);

/**
 * Trục chính và trục phụ của mốc món: `up` / `face` / `roll` của mốc, thiếu trục nào lấy của nhóm. `face` trần mà nhóm
 * không cho trục thì ném `ItemAxisError`
 */
function itemIntent(k: SceneItemMark, d?: ItemDefaults) {
  const group: AxisIntent | undefined =
    d?.face ?? (d?.up !== undefined ? { axis: d.up, toward: "up" } : undefined);
  let face = group;
  if (k.up !== undefined) face = { axis: k.up, toward: "up" };
  else if (k.face !== undefined && !bareFace(k)) face = k.face as AxisIntent;
  else if (k.face !== undefined) {
    if (!group) throw new ItemAxisError(k);
    face = { axis: group.axis, toward: k.face as IntentTarget };
  }
  return { face, roll: k.roll ?? d?.roll };
}

const itemSpec = (rt: SceneRuntime, item: string): HeldItemSpec =>
  rt.held[item] ??
  rt.held[heldBase(item)] ??
  fail(`không có món \`${item}\` (\`held/${heldBase(item)}.json\`)`);

/** Tâm hộp bao của món (khung món) */
const itemCentre = (spec: HeldItemSpec): V3 =>
  spec.shape ? [...shapeBound(spec.shape)[0]] : [0, 0, 0];

/** Mốc món nằm không khai chỗ: chỗ và hướng món lấy từ lúc thả gần nhất */
const restFromRelease = (k: SceneItemMark): boolean => !!k.rest && !k.at && !k.to;

/** Mốc món `rest` không khai chỗ mà trước nó không có lần thả nào của món */
export class ItemRestError extends Error {
  readonly item: string;
  readonly t: number;
  constructor(k: SceneItemMark) {
    super(
      `\`items\` ${k.item} t=${k.t}: \`rest\` không khai chỗ mà trước mốc không ai thả \`${k.item}\` — khai \`at\` / \`to\` hay thêm mốc thả (\`hold: null\`) trước mốc (docs/11-nhom-cam.md#mốc-món-items)`,
    );
    this.name = "ItemRestError";
    this.item = k.item;
    this.t = k.t;
  }
}

/** Giây trước mốc thả mà bàn tay người thả còn mang món: chỗ món lúc thả đọc ở đó */
export const RELEASE_EPS = 1e-3;

/** Người, tay đang mang món `item` ở `time` theo mốc tay: cầm trong bàn tay trước, treo (`carry`) sau; `who` lọc người */
function itemCarrier(
  rt: SceneRuntime,
  item: string,
  time: number,
  who?: (id: string) => boolean,
): { id: string; side: HandSide; carry: boolean } | undefined {
  let hung: { id: string; side: HandSide; carry: boolean } | undefined;
  for (const m of rt.cast) {
    if (!m.world?.hands || (who && !who(m.id))) continue;
    for (const side of ["right", "left"] as const) {
      const run = holdRun(m.world.hands, side, time);
      if (!run || sceneHoldRef(run.hold).item !== item) continue;
      if (!isCarryHold(carryRef(run.hold))) return { id: m.id, side, carry: false };
      hung ??= { id: m.id, side, carry: true };
    }
  }
  return hung;
}

/**
 * Các lần thả món `item` không sau `time`, gần nhất trước: mốc tay mà không ai mang món, ngay trước đó (`RELEASE_EPS`) có
 * người cầm trong bàn tay; lần gỡ món treo bỏ qua. Thuần, chỉ đọc mốc tay
 */
export function itemReleases(
  rt: SceneRuntime,
  item: string,
  time: number,
  who?: (id: string) => boolean,
): { id: string; side: HandSide; t: number }[] {
  const ts = [
    ...new Set(rt.cast.flatMap((m) => (m.world?.hands ?? []).filter(holdKey).map((k) => k.t))),
  ].sort((a, b) => b - a);
  const out: { id: string; side: HandSide; t: number }[] = [];
  for (const tr of ts) {
    if (tr > time + 1e-9 || itemCarrier(rt, item, tr, who)) continue;
    const h = itemCarrier(rt, item, tr - RELEASE_EPS, who);
    if (h && !h.carry) out.push({ id: h.id, side: h.side, t: tr });
  }
  return out;
}

/** Lần thả một món: ai, tay nào, giây nào, món ở đâu lúc thả (bàn tay đã vẽ · khung cầm, thế giới rig) */
export interface ItemRelease {
  id: string;
  side: HandSide;
  t: number;
  pose: ItemPose;
}

export interface ReleaseOptions extends ItemOptions {
  /** Người được tính là người mang món (`cast.released` lọc theo chủ món) */
  who?: (id: string) => boolean;
  /** Tư thế người thả ở giây ấy; bỏ trống là `sceneAt` */
  pose?: (id: string, time: number) => ScenePose;
}

const releaseMemo = new WeakMap<SceneRuntime, Map<string, ItemRelease | null>>();
const releasing = new Set<string>();

/**
 * Lần thả gần nhất (không sau `time`) của món `item` và chỗ món lúc ấy: bàn tay người thả đã vẽ ngay trước mốc thả nhân khung
 * cầm (`actHeld`) — tay dẫn hay lần cầm theo mốc như nhau. Nhân vật người thả lấy ở `rt.chars` (mặc theo `equip` lúc thả),
 * không có thì `o.chars`; thiếu cả hai là `HolderCharError`. Nhớ theo runtime, nhân vật. Mốc món `rest` không khai chỗ và
 * `cast.released` của cảnh three cùng đọc ở đây. docs/11-nhom-cam.md#mốc-món-items
 */
export function itemReleased(
  rt: SceneRuntime,
  item: string,
  time: number,
  o: ReleaseOptions = {},
): ItemRelease | undefined {
  for (const r of itemReleases(rt, item, time, o.who)) {
    const base = rt.chars?.[r.id];
    const given = o.chars?.[r.id];
    if (!base && !given) throw new HolderCharError(r.id);
    const key = `${item}|${r.t}|${r.id}|${charId(base ?? given)}`;
    let memo = releaseMemo.get(rt);
    if (!memo) releaseMemo.set(rt, (memo = new Map()));
    let hit = o.pose ? undefined : memo.get(key);
    if (hit === undefined) {
      if (releasing.has(key))
        throw new Error(
          `\`items\` ${item}: chỗ thả lúc ${r.t} lại cần chính nó — mốc món \`rest\` không khai chỗ đọc vòng (docs/11-nhom-cam.md#mốc-món-items)`,
        );
      releasing.add(key);
      try {
        const t = r.t - RELEASE_EPS;
        const sp =
          o.pose?.(r.id, t) ??
          sceneAt(rt, r.id, t, rt.heights[r.id] ?? 1, rt.bodies[r.id] ?? BODY3);
        const c = base ? equipCharacter(base, sp.equip) : given!;
        const held = actHeld(c, sp as ActInput);
        const h = [held.R, held.L].find((x) => x?.item === item);
        const R = h?.R;
        hit =
          h && R
            ? {
                ...r,
                pose: {
                  R: [R[0], R[1], R[2], -R[3], -R[4], -R[5], -R[6], -R[7], -R[8]],
                  P: [...h.at] as V3,
                  cast: r.id,
                  s: h.s,
                },
              }
            : null;
      } finally {
        releasing.delete(key);
      }
      if (!o.pose) memo.set(key, hit);
    }
    if (hit) return hit;
  }
  return undefined;
}

/** Mốc món nằm không khai chỗ (three, như `solveItemMark`): chỗ và hướng món lúc thả gần nhất trước mốc */
function restMark(rt: SceneRuntime, k: SceneItemMark, o: ItemOptions) {
  const rel = itemReleased(rt, k.item, k.t, o);
  if (!rel) throw new ItemRestError(k);
  const { R: Rr, P, s } = rel.pose;
  const R: M3 = [Rr[0], Rr[1], Rr[2], -Rr[3], -Rr[4], -Rr[5], -Rr[6], -Rr[7], -Rr[8]];
  const pt = itemCentre(itemSpec(rt, k.item));
  return { R, at: add3(toThree(P), scale3(matVec(R, pt), 0.01 * s)), pt, s } as {
    R: M3;
    at: V3;
    pt: V3;
    s: number;
    gap?: number;
    same?: "face" | "roll";
  };
}

/**
 * Một mốc món giải ở `time` (three): hướng `R`, chỗ `at` của điểm món `pt`; `gap` là góc độ giữa đích hai trục, `same` là
 * trục có đích trùng chỗ món (không cho hướng: trục chính thì món giữ hướng thân người cầm, trục phụ thì bỏ)
 */
function solveItemMark(rt: SceneRuntime, k: SceneItemMark, time: number, o: ItemOptions) {
  if (restFromRelease(k)) return restMark(rt, k, o);
  const spec = itemSpec(rt, k.item);
  const T = holderTrunk(rt, k.cast, time, o);
  const at = k.at ? toThree(k.at) : itemMarkPoint(T, k.to!, k.offset);
  const pt = k.point ? heldPoint(spec, k.point) : itemCentre(spec);
  const d = o.defaults ?? itemGroupDefaults(handKeys(rt, k.cast), () => spec, k.item, time);
  const { face, roll } = itemIntent(k, d);
  const aim = (a: AxisIntent): V3 | undefined => {
    const d0 = itemToward(rt, T, a.toward, at, time);
    if (Math.hypot(...d0) < 1e-9) return undefined;
    const d = norm3(d0);
    const u = cross3(d, [0, 1, 0]);
    return a.tilt && Math.hypot(...u) > 1e-6 ? matVec(rotAxis(norm3(u), a.tilt * D), d) : d;
  };
  const out = (R: M3, gap?: number, same?: "face" | "roll") => ({
    R,
    at,
    pt,
    s: T.s,
    ...(gap !== undefined && { gap }),
    ...(same && { same }),
  });
  const main = face ?? roll;
  const dM = main && aim(main);
  if (!main) return out(T.Rr);
  if (!dM) return out(T.Rr, undefined, face ? "face" : "roll");
  const aH = heldAxis(spec, main.axis);
  const second = face && roll;
  let gap: number | undefined;
  if (second) {
    const aS = heldAxis(spec, second.axis);
    const dS = aim(second);
    const cos = Math.max(Math.abs(dot3(aS, aH)), dS ? Math.abs(dot3(dS, dM)) : 0);
    gap = Math.acos(Math.min(1, cos)) / D;
    if (!dS) return out(matMul(arcRot(matVec(T.Rr, aH), dM), T.Rr), gap, "roll");
    const ru = perp3(aS, aH);
    const du = dS && perp3(dS, dM);
    if (du && Math.hypot(...ru) > 1e-6 && Math.hypot(...du) > 1e-6) {
      const r = norm3(ru);
      const q = norm3(du);
      const R = matMul(fromColumns(dM, q, cross3(dM, q)), tr3(fromColumns(aH, r, cross3(aH, r))));
      return out(R, gap);
    }
  }
  // không trục phụ, hay trục phụ trùng hẳn trục chính: món quay ít nhất từ hệ thân người cầm
  return out(matMul(arcRot(matVec(T.Rr, aH), dM), T.Rr), gap);
}

/**
 * Món đặt trước `item` ở `time` theo `scene.items`: giữa hai mốc thì chỗ món hoà theo `ease` của mốc sau, mỗi mốc đọc
 * trong khung mốc thân ở chính `time`, hướng hoà cầu giữa hai phép quay giải ở hai mốc; trước mốc đầu, sau mốc cuối giữ
 * mốc gần nhất. Món không có mốc thì `undefined`. Trục phụ suy biến không ném, trả `degenerate`; đích trùng chỗ món
 * trả `coincident`. `o.chars` bắt buộc (`HolderCharError`); `face` trần không trục thì `ItemAxisError`. Mốc `rest` không khai
 * chỗ đọc lúc thả (`itemReleased`; không có thì `ItemRestError`), món không hoà tới nó; ở mốc `rest` (không hoà) trả `rest`.
 * docs/11-nhom-cam.md#mốc-món-items
 */
export function itemAt(
  rt: SceneRuntime,
  item: string,
  time: number,
  o: ItemOptions = {},
): ItemPose | undefined {
  const ks = rt.items?.filter((k) => k.item === item);
  if (!ks?.length) return undefined;
  let i = 0;
  while (i + 1 < ks.length && ks[i + 1].t <= time) i++;
  const a = ks[i];
  // món không hoà tới mốc nằm lấy chỗ thả: trước mốc ấy món còn trong tay người thả hay đã rời tay
  const next = ks[i + 1];
  const b = time > a.t && next && !restFromRelease(next) ? next : undefined;
  const A = solveItemMark(rt, a, time, o);
  const B = b && solveItemMark(rt, b, time, o);
  const f = b ? easeAt({ ease: b.ease ?? "smooth" }, (time - a.t) / (b.t - a.t)) : 0;
  const mix = (p: V3, q: V3 | undefined) => (q ? add3(p, scale3(sub3(q, p), f)) : p);
  const R = B ? mixRotation(A.R, B.R, f) : A.R;
  const s = B ? A.s + (B.s - A.s) * f : A.s;
  const P = sub3(mix(A.at, B?.at), scale3(matVec(R, mix(A.pt, B?.pt)), 0.01 * s));
  const bad = [A, B].some((m) => m?.gap !== undefined && Math.cos(m.gap * D) > ITEM_AXIS_COS);
  return {
    R: [R[0], R[1], R[2], -R[3], -R[4], -R[5], -R[6], -R[7], -R[8]],
    P: [P[0] * 100, -P[1] * 100, -P[2] * 100],
    cast: a.cast,
    s,
    ...(bad && { degenerate: true as const }),
    ...((A.same || B?.same) && { coincident: true as const }),
    ...(!B && a.rest && { rest: true as const }),
  };
}

/**
 * Mốc món sai hướng, xét ở chính giây của mốc với hướng mặc định của nhóm tay người cầm: đích trục phụ lệch đích trục chính
 * dưới 18° (|cos| > 0,95), đích một trục trùng chỗ món, `face` trần không có trục. `check` (nhóm `ref`, lỗi `item`) báo; rig
 * không tự đổi. `o.chars` bắt buộc như `itemAt`. docs/11-nhom-cam.md#mốc-món-items
 */
export function sceneItemProblems(rt: SceneRuntime, o: ItemOptions = {}): string[] {
  const out: string[] = [];
  for (const k of rt.items ?? []) {
    // mốc nằm không khai chỗ: hướng từ lúc thả, không có trục khai (`sceneItemHoldProblems` báo khi không có lần thả)
    if (restFromRelease(k)) continue;
    const where = `${k.cast}: \`items\` ${k.item} t=${k.t}`;
    let m: ReturnType<typeof solveItemMark>;
    try {
      m = solveItemMark(rt, k, k.t, o);
    } catch (e) {
      if (!(e instanceof ItemAxisError)) throw e;
      out.push(`${k.cast}: ${e.message}`);
      continue;
    }
    if (m.same)
      out.push(
        `${where}: đích của \`${m.same}\` trùng chỗ món — trục ấy không cho hướng; dời chỗ món (\`to\`, \`offset\`, \`at\`) hay đổi đích (docs/11-nhom-cam.md#mốc-món-items)`,
      );
    if (m.gap !== undefined && Math.cos(m.gap * D) > ITEM_AXIS_COS)
      out.push(
        `${where}: trục phụ (\`roll\`) lệch trục chính ${m.gap.toFixed(1)}° (dưới 18°) — hướng món suy biến; khai \`roll\` khác (docs/11-nhom-cam.md#mốc-món-items)`,
      );
  }
  return out;
}

/**
 * Mốc món ở giây không tay nào của người cầm (`cast` của mốc) cầm món ấy, mốc nằm không khai chỗ mà trước nó không có lần
 * thả: `check` (nhóm `ref`, lỗi `choice`) báo.
 * docs/11-nhom-cam.md#mốc-món-items
 */
export function sceneItemHoldProblems(rt: SceneRuntime): string[] {
  const out: string[] = [];
  for (const k of rt.items ?? []) {
    const keys = handKeys(rt, k.cast);
    const holds = (["right", "left"] as const).some((side) => {
      const run = holdRun(keys, side, k.t);
      return !!run && sceneHoldRef(run.hold).item === k.item;
    });
    if (!holds)
      out.push(
        `${k.cast}: \`items\` ${k.item} t=${k.t}: không tay nào của \`${k.cast}\` cầm \`${k.item}\` ở giây này — khai \`hold\` ở \`world.hands\` hay bỏ mốc (docs/11-nhom-cam.md#mốc-món-items)`,
      );
    if (restFromRelease(k) && !itemReleases(rt, k.item, k.t).length)
      out.push(`${k.cast}: ${new ItemRestError(k).message}`);
  }
  return out;
}

/**
 * Mốc món phải có thật: người cầm là người 3D trong `cast`, món trong `held`, `point` và trục trên món, người khác của
 * `face: { cast }`; `t` của cùng một món tăng dần
 */
function checkItems(
  items: SceneItemMark[],
  held: Record<string, HeldItemSpec>,
  cast: { id: string; world?: unknown }[],
) {
  const last = new Map<string, number>();
  items.forEach((k, i) => {
    const where = `\`items[${i}]\` ${k.item} t=${k.t}`;
    const prev = last.get(k.item);
    if (prev !== undefined && k.t <= prev) fail(`${where}: \`t\` của cùng một món phải tăng dần`);
    last.set(k.item, k.t);
    const c =
      cast.find((m) => m.id === k.cast) ?? fail(`${where}: không có \`${k.cast}\` trong \`cast\``);
    if (!c.world) fail(`${where}: người cầm \`${k.cast}\` phải là người 3D (\`cast[].world\`)`);
    const spec =
      held[k.item] ??
      held[heldBase(k.item)] ??
      fail(`${where}: không có món \`${k.item}\` (\`held/${heldBase(k.item)}.json\`)`);
    try {
      if (k.point) heldPoint(spec, k.point);
      if (k.up !== undefined) heldAxis(spec, k.up);
      for (const a of [k.face, k.roll]) {
        if (!a || typeof a !== "object" || Array.isArray(a)) continue;
        if ("axis" in a) heldAxis(spec, a.axis);
        const t = "axis" in a ? a.toward : a;
        if (typeof t !== "object" || Array.isArray(t)) continue;
        if ("cast" in t) {
          if (!cast.find((m) => m.id === t.cast)?.world)
            throw new Error(`\`${t.cast}\` không phải người 3D trong \`cast\``);
          if (t.mark && !(CAST_MARKS as readonly string[]).includes(t.mark))
            throw new Error(`mốc trên người khác chỉ ước được ${CAST_MARKS.join(", ")}`);
        } else if (isOtherHand(t.mark))
          throw new Error(`đích \`${t.mark}\` là bàn tay: bàn tay suy từ món`);
      }
    } catch (e) {
      fail(`${where}: ${(e as Error).message}`);
    }
  });
}

function pathAt(path: PathKey[], time: number): Spot {
  let i = 0;
  while (i + 1 < path.length && path[i + 1].t <= time) i++;
  const a = path[i];
  const b = path[i + 1];
  if (!b || time <= a.t) return { x: a.x, groundY: a.y, scale: a.scale };
  let u = (time - a.t) / (b.t - a.t);
  if (b.ease) u = u * u * (3 - 2 * u);
  const mix = (p: number, q: number) => p + (q - p) * u;
  return { x: mix(a.x, b.x), groundY: mix(a.y, b.y), scale: mix(a.scale, b.scale) };
}

type Acting = Omit<CastMember, "travel">;

/** `turn` sửa tư thế trước khi đổi kênh gần ↔ xa: kênh còn là chi gần lúc đầu cảnh */
function poseAt(m: Acting, time: number, clock?: Clock, turn?: (p: Pose) => Pose): Pose {
  let pose: Pose = m.base;
  for (const tr of m.tracks) {
    const i = activeClip(tr, time);
    if (i >= 0) pose = composePose(pose, poseUpTo(tr, i, time, pose, clock));
  }
  // Người đi theo `path` đọc chân như soạn ở `side`: bàn chân trụ phải nằm trên sàn thế giới, và
  // hoà từ chân nâng sang chân 2D là bàn chân nhảy giữa chừng
  if (m.world?.path) pose = { ...pose, lift: { ...pose.lift, ln: true, lf: true } };
  if (turn) pose = turn(pose);
  return clock && clock(time).half % 2 ? swapSides(pose) : pose;
}

/** Tư thế người 3D đi theo `path`: `poseAt` cộng bước chân của cú quay tại chỗ */
function worldPoseAt(
  m: Acting,
  time: number,
  walk: Walker | undefined,
  height: number,
  hipHalf: number,
): Pose {
  if (!walk) return poseAt(m, time);
  const yaw = sampleAt(walk.yaw, walk.step, time);
  const flip = walk.flip[stepIndex(walk, time)];
  return poseAt(m, time, clockOf(walk), (p) =>
    turnStep(m, time, p, yaw, walk.flip[0], flip, height, hipHalf),
  );
}

/** Cú quay tại chỗ đang bước lúc `time`: mốc đầu, mốc cuối và `turnOf` của chúng; clip có sải chân đang lái chân thì không */
function turnStepAt(m: Acting, time: number) {
  if (!m.world?.path) return;
  const { a, b } = legOf(keysOf(m.world as WorldSpec), time);
  const turn = b && turnOf(a, b);
  if (!turn || strideClip(m, a.t) || strideClip(m, time)) return;
  return { a, b, turn };
}

/**
 * Quay tại chỗ (`turnOf`) bằng bước chân: mỗi nhịp một chân nhấc lên đặt xuống chỗ của nó ở hướng
 * mới, chân kia xoay trên sàn tới chỗ của nó (không nhấc); nhịp đầu chân phía quay bước, các nhịp
 * sau đổi chân. Hông hạ chút cho gối chùng, thân nghiêng về chân xoay một lần mỗi nhịp. Chỗ hai bàn
 * chân lấy từ chân của `pose` ở hướng đầu và cuối nhịp; góc chân giải lại theo hướng thân đang vẽ
 * `yaw` (độ). `pose` chưa đổi kênh: `ln` là chi gần lúc đầu cảnh, tức chân phải khi `flip0` không
 * lật. docs/03-scene.md#quay-tại-chỗ
 */
function turnStep(
  m: Acting,
  time: number,
  pose: Pose,
  yaw: number,
  flip0: boolean,
  flip: boolean,
  height: number,
  hipHalf: number,
): Pose {
  const at = turnStepAt(m, time);
  if (!at) return pose;
  const { a, b, turn } = at;
  const u = (time - a.t) / (b.t - a.t);
  const v = Math.min(1, Math.max(0, u)) * turn.steps;
  const j = Math.min(turn.steps - 1, Math.floor(v));
  const w = v - j;
  const step = turn.delta / turn.steps;
  // hướng thân so với đầu nhịp; hệ phẳng `[tiến, phải]` của đầu nhịp
  const rel = wrap180(yaw - a.yaw - step * j) * D;
  const rot = ([f, l]: [number, number], th: number): [number, number] => [
    f * Math.cos(th) - l * Math.sin(th),
    f * Math.sin(th) + l * Math.cos(th),
  ];
  const len = lengths(height);
  const st = pose.stretch;
  // nhịp đầu chân phía quay bước (quay phải — `delta` dương — là chân phải), nhịp sau đổi chân
  const right: "ln" | "lf" = flip0 ? "lf" : "ln";
  const left = right === "ln" ? "lf" : "ln";
  const lead = turn.delta > 0 === (j % 2 === 0) ? right : left;
  const ramp = Math.min(1, u / TURN_DIP_RAMP, (1 - u) / TURN_DIP_RAMP);
  const out: Partial<Record<"ln" | "lf", LegAngles>> = {};
  for (const ch of ["ln", "lf"] as const) {
    const l1 = len.thigh * st[ch === "ln" ? 6 : 4];
    const l2 = len.shin * st[ch === "ln" ? 7 : 5];
    const [a0, b0, sp0 = 0] = pose[ch];
    const x = Math.sin(a0 * D) * l1 + Math.sin((a0 + b0) * D) * l2;
    const y = Math.cos(a0 * D) * l1 + Math.cos((a0 + b0) * D) * l2;
    const side = ch === right ? 1 : -1;
    const from: [number, number] = [x, side * (hipHalf + y * Math.sin(sp0 * D))];
    const to = rot(from, step * D);
    // chân bước đi trước thân, đặt xuống trước khi thân dừng; chân xoay trượt theo sau
    const p = ch === lead ? w / (1 - TURN_LAG) : (w - TURN_LAG) / (1 - TURN_LAG);
    const s = smoothstep(Math.min(1, Math.max(0, p)));
    const lift = ch === lead && p > 0 && p < 1 ? TURN_LIFT * (l1 + l2) * Math.sin(Math.PI * p) : 0;
    const [f, l] = rot([from[0] + (to[0] - from[0]) * s, from[1] + (to[1] - from[1]) * s], -rel);
    const depth = y * Math.cos(sp0 * D) - TURN_DIP * (l1 + l2) * smoothstep(ramp) - lift;
    out[ch] = legTo(f, depth, side * l - hipHalf, l1, l2);
  }
  // thân nghiêng về chân xoay; `lean` dương là về chân đang xa
  const far = (lead !== right) === flip;
  const lean = TURN_LEAN * Math.sin(Math.PI * w) * (far ? 1 : -1);
  return { ...pose, ln: out.ln!, lf: out.lf!, lean: (pose.lean ?? 0) + lean };
}

/**
 * Góc chân nâng `[đùi, gối, dang]` đặt cổ chân ở `[tiến f, sâu dưới gốc depth, ra ngoài o]` so với gốc
 * chân; gối gập ra trước. Xa quá tầm thì duỗi thẳng về phía ấy.
 */
function legTo(f: number, depth: number, o: number, l1: number, l2: number): LegAngles {
  const sp = Math.atan2(o, depth) / D;
  const y = Math.hypot(o, depth);
  const r = Math.min(l1 + l2, Math.max(Math.abs(l1 - l2), Math.hypot(f, y), 1e-6));
  const phi = Math.atan2(f, y) / D;
  const acos = (c: number) => Math.acos(Math.min(1, Math.max(-1, c))) / D;
  const al = acos((l1 * l1 + r * r - l2 * l2) / (2 * l1 * r));
  const be = acos((l2 * l2 + r * r - l1 * l1) / (2 * l2 * r));
  return [phi + al, -(al + be), sp];
}

const swapLayers = (l: Partial<ArmLayers>): Partial<ArmLayers> => ({
  ...(l.armFar && { armNear: l.armFar }),
  ...(l.armNear && { armFar: l.armNear }),
});

/** Đổi kênh gần ↔ xa: thân vừa lật qua chính diện hay quay lưng thì chi gần là chi kia */
function swapSides(p: Pose): Pose {
  const st = p.stretch;
  const l = p.lift;
  const r = p.reach;
  const h = p.hand;
  const a = p.aim;
  return {
    ...p,
    an: p.af,
    af: p.an,
    ln: p.lf,
    lf: p.ln,
    stretch: [st[2], st[3], st[0], st[1], st[6], st[7], st[4], st[5]],
    ...(l && { lift: { ...l, an: l.af, af: l.an, ln: l.lf, lf: l.ln } }),
    ...(r && { reach: { ...(r.af && { an: r.af }), ...(r.an && { af: r.an }) } }),
    ...(h && { hand: { ...(h.af && { an: h.af }), ...(h.an && { af: h.an }) } }),
    ...(a && { aim: { ...(a.af && { an: a.af }), ...(a.an && { af: a.an }) } }),
  };
}

const LEGS: Channel[] = ["legFar", "legNear"];
const writesLegs = (c: Clip) =>
  !!c.action && LEGS.some((k) => inMask(c, k) && actionMask(c.action as ActionData).includes(k));

/**
 * Phần của kênh chân tại `time` đến từ clip mà `pick(tên hành động)` nhận, `0..1`, hoà đúng như
 * `poseAt`; `base` là phần của tư thế nền. `stickman reseat` đọc nó để biết khung nào đang ngồi.
 */
export function legShare(
  rt: SceneRuntime,
  id: string,
  time: number,
  pick: (action: string) => boolean,
  base = 0,
): number {
  let share = base;
  for (const tr of member(rt, id).tracks) {
    const i = activeClip(tr, time);
    if (i >= 0) share = legShareUpTo(tr, i, time, share, pick);
  }
  return share;
}

function legShareUpTo(
  tr: Track,
  i: number,
  time: number,
  under: number,
  pick: (action: string) => boolean,
): number {
  const c = tr.clips[i];
  const own = writesLegs(c) ? (pick(c.file ?? "") ? 1 : 0) : under;
  const s = time - c.start;
  if (s >= c.tau) return own;
  const from = i === 0 ? under : legShareUpTo(tr, i - 1, time, under, pick);
  return from + (own - from) * (s <= 0 ? 0 : smoothstep(s / c.tau));
}
