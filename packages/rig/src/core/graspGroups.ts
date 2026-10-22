import { HAND_BONES, type HandPose } from "./hand";
import { heldDistance, type FingerRole } from "./heldFit";
import {
  alongFrac,
  alongRoom,
  axialAt,
  edgeFrame,
  faceRho,
  gripSpan,
  type DiscFeature,
  type FaceFeature,
  type Feature,
  type FeatureKind,
  type HandDims,
  type ItemGeom,
  type SideName,
  type SlabFeature,
} from "./heldGeom";
import {
  CARRY_ON,
  GROUP_IDS,
  groupHold,
  HELD_FINGERS,
  type AuthoredGrasp,
  type AxisIntent,
  type GroupId,
  type GroupVariant,
  type HeldItemSpec,
  type HeldFinger,
  type HeldShape,
  type IntentTarget,
  type SceneHold,
  type SceneHoldGroup,
} from "./heldItem";
import { add3, dot3, scale3, sub3, type V3 } from "./lens";

/**
 * Bảng nhóm cầm (`GRIP_GROUPS`): điều kiện hình học theo cỡ tay, biến thể (khung, dáng, vai trò ngón), lựa chọn và miền,
 * tay phụ và hướng mặc định của từng nhóm. Chỗ tiếp xúc (`contact`) nằm ở `graspSolve.ts`. docs/11-nhom-cam.md mục 3
 */

export type NeedKind = Feature["kind"] | "path" | "ball";
/** Dáng tay chưa soạn: nhóm dùng nó là `later` */
export type PlannedPose = "ball" | "claw";
export type GroupPoseName = HandPose | PlannedPose;

/**
 * Một dáng mở hay đóng; `knuckle`, `tip` là độ gập thêm ở gốc, ở ngọn bốn ngón; `thumb` thay góc ngón cái của dáng
 * (`Fingers.thumb`). Tâm nắm của khung theo tên dáng đóng
 */
export interface PoseRef {
  pose: GroupPoseName;
  knuckle?: number;
  tip?: number;
  thumb?: ThumbAngles;
}

/** Góc ngón cái `[dạng, đối, gập gốc, gập ngọn]`, độ (`Fingers.thumb`) */
export type ThumbAngles = readonly [number, number, number, number];

/**
 * Dáng theo số đo món: `closed` ở `range[0]`, `open` ở `range[1]` (đơn vị `A` hay `W`). `thumb`: góc ngón cái theo số đo
 * (cùng đơn vị, tăng dần), nội suy tuyến tính, ngoài bảng lấy đầu gần; có thì đè ngón cái của dáng hoà
 */
export interface PoseSpec {
  open: PoseRef;
  closed: PoseRef;
  by: "thick" | "radius" | "width";
  unit: "A" | "W";
  range: [number, number];
  thumb?: readonly (readonly [number, ThumbAngles])[];
}

export type FrameKind = "nf" | "nt";
export type RoleMap = Record<HeldFinger | "palm", FingerRole>;

export interface VariantSpec {
  frame: FrameKind;
  pose?: PoseSpec;
  roles: RoleMap;
  /** Tầm cuộn thêm từ dáng gốc, độ, mọi đốt (`HeldFitInput.curl`); bỏ trống là theo vai trò (`HELD_ROLE_CURL`) */
  curl?: number;
  /** Khoá khung chuẩn của biến thể trong fixture test (`__fixtures__/grip-frames.json`) */
  fixture?: string;
  /** Bề dày thật ở mép (`edgeThick`) tối đa, lần `W`: dày hơn thì biến thể không áp */
  thickMax?: number;
  /** Khối hình biến thể áp được; bỏ trống là mọi khối hình của nhóm */
  kinds?: FeatureKind[];
  /**
   * Phía ngón cái (`ρ(around)` của chỗ tiếp xúc) quay về đích này: tay dẫn thì là ý định `roll` của lần cầm; món đặt trước
   * mà cảnh không khai `around` thì rig chỉ thử `around` trong `THUMB_TOWARD_SPAN` quanh hướng ấy (`back`: về thân người
   * cầm dọc hướng mặt người)
   */
  thumbToward?: "back";
  /**
   * Món đặt trước: rig chuộng chỗ cầm mà thân món ở trên bàn tay — giá thêm `UPRIGHT_W · ((1 − u) / 2)²` với `u` là sin góc
   * ngẩng của hướng từ tâm nắm tới tâm khối hình
   */
  upright?: boolean;
  /**
   * Bề rộng tấm từ cạnh được cầm sang cạnh đối diện (`acrossOf`), lần `W`: ngoài miền thì biến thể không áp ở cạnh ấy
   * (kẹp đầu ngón qua hai mép không mở tới, hay không khép đủ)
   */
  across?: readonly [number, number];
  /** Món đặt trước: `chooseMissing` cộng giá lún da của bàn tay đúng khung cầm (như nhóm `SINK_GROUPS`) */
  sink?: boolean;
}

/** `upright`: trọng số giá thân món không ở trên bàn tay */
export const UPRIGHT_W = 4;

/** `thumbToward`: nửa miền `around` (độ) rig thử quanh hướng đích, và bước lưới */
export const THUMB_TOWARD_SPAN = 60;
export const THUMB_TOWARD_STEP = 15;

export interface FeatureNeed {
  kinds: NeedKind[];
  /** Điều kiện số đo theo cỡ tay */
  test?: (f: Feature, h: HandDims, g: ItemGeom) => boolean;
  /** Điều kiện bằng lời cho dòng báo */
  text: string;
}

export type ChoiceKey =
  | "part"
  | "edge"
  | "along"
  | "thumb"
  | "slant"
  | "around"
  | "tilt"
  | "psi"
  | "inset"
  | "variant"
  | "on"
  | "yaw";

/** Bậc rời. Bỏ `values` thì miền lấy trên khối hình (cạnh, mặt); `from`: mặc định tính ở `holdDefaults` */
export interface NamesChoice {
  kind: "names";
  values?: readonly string[];
  default?: string;
  /**
   * Mặc định theo người cầm (`holder`), bên tay (`side`) hay phần có khối hình của nhóm dài nhất (`longest`, cho `part`: cảnh
   * không khai thì rig chỉ giải trên phần ấy)
   */
  from?: "holder" | "side" | "longest";
  /** Giá thêm khi rig chọn giá trị khác mặc định (`chooseMissing`) */
  cost?: number;
}

/** Bậc liên tục (độ hay tỉ lệ); `names` là tên gọi thay số; `byVariant` đè miền theo biến thể */
export interface RangeChoice {
  kind: "range";
  min: number;
  max: number;
  default?: number;
  names?: readonly string[];
  byVariant?: Record<string, [number, number]>;
  /** Lưới rig thử khi cảnh không khai, thay lưới mặc định của trường (`chooseMissing`) */
  grid?: readonly number[];
  /** Lưới theo biến thể, đè `grid` */
  gridByVariant?: Record<string, readonly number[]>;
  /** Giá thêm khi rig chọn giá trị khác `default` (`chooseMissing`) */
  cost?: number;
}

export type Choice = NamesChoice | RangeChoice;
export type ChoiceSpec = Partial<Record<ChoiceKey, Choice>>;

/** Tay phụ mặc định khi cảnh khai `both`: cùng `keep` của tay dẫn, ở `edge` hay `place` */
export interface SupportSpec {
  group: GroupId;
  edge?: "opposite" | "same";
  place?: "bottom" | "back";
  keep?: ChoiceKey[];
}

/** `support`: ngược pháp tuyến mặt đỡ của `platform` (`supportAxis`) */
export interface IntentAxis {
  axis: "front" | "top" | "support";
  toward: IntentTarget;
}

/** Hướng món mặc định theo `front` / `top` (đã gồm miệng) của món, hay mặt đỡ */
export interface GroupIntent {
  face?: IntentAxis;
  roll?: IntentAxis;
}

/** Số đo tính ra đơn vị rig của món để so với `W`: từ `SIZE_WARN · W` cảnh báo, quá `SIZE_MAX · W` loại */
export interface SizeSpec {
  of: (f: Feature) => number;
}

export interface GroupSpec {
  id: GroupId;
  label: string;
  needs: FeatureNeed[];
  /** Mốc món phải có (và có `dir`) */
  anchors?: string[];
  variants: Record<string, VariantSpec>;
  choices: ChoiceSpec;
  hands: "one" | "two" | "either";
  support?: SupportSpec;
  intent?: GroupIntent;
  size?: SizeSpec;
  /**
   * Tâm nắm cách phần `grip: false` ít nhất ngần này lần `W` dọc trục: `along` kẹp vào miền ấy (`alongRoom`); rig không
   * chọn `around` mà phần ấy nhô ra phía lòng tay (`bulgeToward`)
   */
  clear?: number;
  /** Biến thể khi chỗ cầm không khai `variant` mà nhóm không có mặc định: theo khối hình, `around`, cỡ tay */
  variantOf?: (f: Feature, g: ItemGeom, around: number | undefined, h: HandDims) => string;
  motion?: "write" | "pick";
  later?: true;
}

/** Góc ngửa mặc định của mặt thẻ (`card`) về người cầm, độ: thẻ dựng xiên, cầm xem khuỷu thấp sát sườn */
export const CARD_RISE = 20;
/** Hướng mặt thẻ mặc định ở hệ thân người cầm `[tiến, y xuống, ra ngoài]` (`PALM_DIRS`): lùi về người cầm, ngửa `CARD_RISE` */
const CARD_FACE: [number, number, number] = [
  -Math.cos((CARD_RISE * Math.PI) / 180),
  -Math.sin((CARD_RISE * Math.PI) / 180),
  0,
];

/** `cylinder` `wrap`: gập gốc, gập ngọn thêm của bốn ngón — mở hơn chỗ chạm để `heldFit` cuộn tới; đóng hơn thì đốt ngọn lún */
const WRAP_OPEN = [-20, -80] as const;
const WRAP_CLOSED = [-35, -85] as const;
/**
 * `cylinder` `wrap`, ngón cái theo bán kính chỗ cầm (`W`): trụ mảnh thì đối hết, nằm dọc trục chồng lên trỏ–giữa về phía út;
 * trụ to thì dạng, ít đối, áp dọc thân về đầu trên. Đổi họ qua dạng hết (`0,36–0,42·W`): đối giữa chừng thì cắt vào trụ
 */
const WRAP_THUMB = [
  [0.17, [60, 60, 45, 60]],
  [0.3, [60, 90, 45, 10]],
  [0.36, [60, 90, 45, 10]],
  [0.42, [100, 90, 0, 30]],
] as const satisfies readonly (readonly [number, ThumbAngles])[];

/** `platform` `palm`: ngón gập gốc, ngọn để đệm ngón chạm mặt đỡ ngang gò lòng tay (da lòng dày hơn ngón) */
const PLATFORM_FLAT: PoseRef = { pose: "flat", knuckle: 30, tip: 5 };

/** `handle` `hook`: gốc ngón duỗi, ngọn gập ~90° móc dưới quai (dáng `hook` gập gốc 28–32° đẩy đốt gốc vào quai dày) */
const HOOK: PoseRef = { pose: "hook", knuckle: -40, tip: -10 };

/** `bowl` `side`: ngón cái ít dạng, đối nhiều, gốc duỗi ngược: nằm vắt trên vành chén phía lòng tay */
const BOWL_THUMB = [15, 50, -30, 20] as const;
/** `bowl`: chén có bán kính lớn nhất tới ngần này lần `W` thì mặc định kẹp đầu ngón `pinch`, lớn hơn thì `side` */
export const BOWL_PINCH_MAX = 0.7;
/** `bowl` `pinch`: miền `along` (tính từ miệng) */
export const PINCH_ALONG = [0.4, 0.5] as const;
/** `bowl` `pinch`: ngón chỉ cuộn thêm ngần này độ để khép khe, gỡ lún — chỗ tiếp xúc đã đặt đệm ngón lên thành */
const PINCH_CURL = 10;
/** `bowl` `pinch`: dáng mở (thành to): gốc trỏ – út duỗi thêm 40°, ngọn 18° */
const PINCH_OPEN: PoseRef = { pose: "cupPinch", knuckle: -40, tip: -18 };

export const SIZE_WARN = 0.8;
export const SIZE_MAX = 0.95;

const D2R = Math.PI / 180;
const fmt = (x: number) => x.toFixed(1).replace(".", ",");

const ALL_FINGERS = HELD_FINGERS.filter((f) => f !== "thumb");
const roles = (
  thumb: FingerRole,
  fingers: FingerRole,
  palm: FingerRole,
  over: Partial<RoleMap> = {},
): RoleMap => {
  const r = { thumb, palm } as RoleMap;
  for (const f of ALL_FINGERS) r[f] = fingers;
  return { ...r, ...over };
};

const names = (
  values?: readonly string[],
  rest: Omit<NamesChoice, "kind" | "values"> = {},
): Choice => ({
  kind: "names",
  ...(values ? { values } : {}),
  ...rest,
});
const range = (
  min: number,
  max: number,
  rest: Omit<RangeChoice, "kind" | "min" | "max"> = {},
): Choice => ({
  kind: "range",
  min,
  max,
  ...rest,
});
const PART: Choice = names();
const EDGE: Choice = names();
const ALONG: Choice = range(0, 1, { default: 0.5, names: ["corner", "low", "mid", "high"] });

const sorted = (f: Feature): number[] | undefined =>
  f.kind === "box" || f.kind === "slab"
    ? f.half.map((x) => 2 * x).sort((a, b) => a - b)
    : undefined;
const thick = (f: Feature) => (f.kind === "slab" || f.kind === "disc" ? f.t : Infinity);
const radius = (f: Feature) => (f.kind === "rod" ? f.R : f.kind === "lathe" ? f.rMax : Infinity);
const span = (g: ItemGeom, f: Feature) => Math.max(0, ...gripSpan(g, f).map((s) => s.len));

/** `pen`, `chopsticks`: ngón chỉ cuộn thêm ngần này độ để khép khe, gỡ lún (docs/11 mục 6 điểm 4) */
const THIN_CURL = 15;
/** Thanh khác cùng phần với `f`, lệch trục `≤ 15°` (đôi đũa) */
const pairOf = (f: Feature, g: ItemGeom, R = Infinity) =>
  g.features.some(
    (o) =>
      o !== f &&
      o.kind === "rod" &&
      o.part === f.part &&
      o.R <= R &&
      f.kind === "rod" &&
      Math.abs(dot3(o.a, f.a)) >= Math.cos(15 * D2R),
  );
/** `handle`: khe sau thanh ít nhất hai bán kính ngón trỏ (ngón to nhất), lần `W` */
export const HOOK_GAP = (2 * HAND_BONES.index.r) / (2 * HAND_BONES.palm.half[1]);
/** `handle`: thanh lệch `top` từ ngần này độ trở lên (món treo dưới tay) */
export const HOOK_TILT = 45;
/**
 * `cylinder`: rig chọn ngón cái về đầu dưới (`thumb: "down"`, bàn tay ngược với món) hay `slant` khác mặc định cộng giá ngần
 * này — cỡ cổ tay vượt kẹp 30%
 */
const OFF_COST = 1;
/**
 * `cylinder` `wrap`: trụ to nằm chéo lòng tay, hướng ngón chếch ngần này độ về phía ngón cái (trục món từ gò út sang gốc
 * ngón trỏ) — mặc định của `slant`; rig thử cả `0` khi cổ tay không theo được
 */
export const WRAP_SLANT = 25;
/** `cylinder`: tâm nắm cách phần `grip: false` ít nhất ngần này lần `W` dọc trục */
export const GRIP_CLEAR = 0.3;
/** `cylinder`: thanh hộp áp mặt rộng ít nhất ngần này lần `W` thì lòng áp phẳng, ngón dọc thân (`flat`) */
export const FLAT_WIDE = 1;
/** `cylinder`: `flat` khi lòng tay áp mặt rộng (`2R`) của thanh hộp rộng hơn `FLAT_WIDE · W`, không thì `wrap` */
const cylinderVariant = (f: Feature, g: ItemGeom, around: number | undefined, h: HandDims) => {
  if (f.kind !== "rod" || !f.wide || 2 * f.R < FLAT_WIDE * h.W) return "wrap";
  const rho = faceRho(f, axialAt(g, f, 0.5, around ?? 0).rho);
  return Math.abs(dot3(rho, f.wide)) < 0.5 ? "flat" : "wrap";
};
/** Có đoạn bám liền dài `≥ len · W` chứa được tâm nắm cách phần `grip: false` `≥ clear · W` */
const roomy = (g: ItemGeom, f: Feature, W: number, len: number, clear: number) =>
  gripSpan(g, f).some((s) => s.len >= len * W && alongRoom(s, clear * W) !== undefined);

/** Cạnh tấm được cầm dài ít nhất ngần này lần `W` (`sheet`) */
export const EDGE_MIN = 0.6;
/** Cạnh của tấm đủ dài để cầm (`EDGE_MIN · W`), theo thứ tự của `heldGeom` */
export const longEdges = (f: SlabFeature, h: HandDims) =>
  f.edges.filter((e) => e.len >= EDGE_MIN * h.W);

/** Bề rộng tấm từ cạnh `edge` sang cạnh có pháp tuyến ngoài ngược nhất, đo theo pháp tuyến cạnh; không có cạnh thì `undefined` */
export function acrossOf(f: SlabFeature, edge: SideName): number | undefined {
  const ed = f.edges.find((x) => x.name === edge);
  if (!ed) return undefined;
  const op = f.edges.reduce((a, b) => (dot3(b.m, ed.m) < dot3(a.m, ed.m) ? b : a));
  return dot3(sub3(ed.at, op.at), ed.m);
}

/**
 * Bề rộng ở cạnh `edge` khi biến thể `variant` có `across` mà bề rộng ngoài miền (cạnh không có trên tấm: `NaN`); áp được
 * hay biến thể không có `across` thì `undefined`
 */
export function acrossMiss(
  group: GroupSpec,
  variant: string,
  f: Feature,
  edge: SideName | number | undefined,
  dims: HandDims,
): number | undefined {
  const r = group.variants[variant]?.across;
  if (!r || f.kind !== "slab" || edge === undefined) return undefined;
  const w = typeof edge === "string" ? acrossOf(f, edge) : undefined;
  if (w === undefined) return NaN;
  return w >= r[0] * dims.W && w <= r[1] * dims.W ? undefined : w;
}

/** Thụt tâm nắm vào trong tấm, đơn vị món, cố định mọi cỡ tay (fixture của từng biến thể) */
export const SHEET_INSET = { pinch: 2.5, flat: 5, rim: 3.2 } as const;
/** `flat`: khe đệm ngón cái dáng `edge` – mặt lòng tay, lần `W` (0,24 ở cỡ k 1,75 dọc 1,545; 0,25 ở k 2 dọc 1,813) */
export const FLAT_MAX = 0.24;
const SPAN_STEPS = 24;

/** Đoạn có vật liệu dọc `F` qua `c` trong `[−t/2, t/2]` (khung món), `SPAN_STEPS` mẫu: hai mút tính từ `c` */
export function spanAt(
  shape: readonly HeldShape[],
  c: V3,
  F: V3,
  t: number,
): [number, number] | undefined {
  const h = t / SPAN_STEPS;
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < SPAN_STEPS; i++) {
    const s = (i + 0.5) * h - t / 2;
    if (heldDistance(shape, add3(c, scale3(F, s))) >= 0) continue;
    lo = Math.min(lo, s - h / 2);
    hi = Math.max(hi, s + h / 2);
  }
  return lo < hi ? [lo, hi] : undefined;
}

/** Bề dày vật liệu ở `inset` vào trong giữa cạnh `edge` của tấm hay đĩa; không có hình thì bề dày khối hình */
export function edgeThick(
  f: SlabFeature | DiscFeature,
  edge: SideName | number,
  inset: number,
  shape?: readonly HeldShape[],
): number {
  const fr = edgeFrame(f, edge, f.faces[0].name);
  const s = shape && spanAt(shape, sub3(fr.at, scale3(fr.m, inset)), fr.F, f.t);
  return s ? s[1] - s[0] : f.t;
}

/**
 * Bề dày ở mép khi biến thể `variant` không áp được trên khối hình `f` (vượt `thickMax · W` ở cạnh `edge`, hay ở mọi cạnh
 * được cầm khi bỏ trống); áp được thì `undefined`
 */
export function tooThick(
  group: GroupSpec,
  variant: string,
  f: Feature,
  edge: SideName | number | undefined,
  dims: HandDims,
  shape?: readonly HeldShape[],
): number | undefined {
  const max = group.variants[variant]?.thickMax;
  if (max === undefined || (f.kind !== "slab" && f.kind !== "disc")) return undefined;
  const inset = SHEET_INSET[variant as keyof typeof SHEET_INSET] ?? 0;
  const edges =
    edge !== undefined
      ? [edge]
      : f.kind === "slab"
        ? (longEdges(f, dims).length ? longEdges(f, dims) : f.edges).map((e) => e.name)
        : f.rim;
  const t = Math.min(...edges.map((e) => edgeThick(f, e, inset, shape)));
  return t > max * dims.W ? t : undefined;
}

/**
 * `card` `edges`: dáng `edgePinch` (khép) ở bề rộng `EDGES_RANGE[0]` lần `W` hoà sang dáng mở (gốc trỏ – út duỗi bớt, ngón cái
 * dạng rộng) ở `EDGES_RANGE[1]`: khe da đệm cái – đệm trỏ dọc đường kẹp theo bề rộng, khớp ở 1,05 và 1,2·W (cỡ tay 1,75 – 2)
 */
const EDGES_OPEN: PoseRef = { pose: "edgePinch", knuckle: -25, tip: -5, thumb: [85, 25, 0, 5] };
export const EDGES_RANGE: [number, number] = [-0.07, 1.38];
/** `edges`: bề rộng tấm qua hai mép được kẹp, lần `W` */
export const EDGES_ACROSS = [0.9, 1.35] as const;
/** `edges`: ngón ép chỉ cuộn thêm ngần này độ để khép khe tới mép */
const EDGES_CURL = 20;

/** Ngón cái `pinch`: khép theo trỏ, ngọn duỗi ngược để đầu ngón đè mặt trước mà đốt gốc (da phình to) tránh mép */
const PINCH_THUMB = [0, 10, 10, -20] as const;
/** Ngón cái `rim`: khép về cạnh trỏ, đè mặt `F` lên trỏ đã cuộn; góc chọn để `handGripOf` của dáng đóng còn ở kẽ cái–trỏ */
const RIM_THUMB = [25, 20, 10, 25] as const;

const SPECS: {
  [G in GroupId]: Omit<GroupSpec, "id" | "variants"> & {
    variants: Record<GroupVariant<G>, VariantSpec>;
  };
} = {
  sheet: {
    label: "Tấm kẹp mép",
    needs: [
      {
        kinds: ["slab", "disc"],
        test: (f, h) =>
          thick(f) <= 0.45 * h.A &&
          (f.kind === "slab"
            ? longEdges(f, h).length > 0
            : f.kind === "disc" && 2 * f.radius >= EDGE_MIN * h.W),
        text: "tấm hay đĩa dày ≤ 0,45·A, cạnh dài ≥ 0,6·W",
      },
    ],
    variants: {
      pinch: {
        frame: "nf",
        pose: {
          open: { pose: "sheet", knuckle: 30, thumb: PINCH_THUMB },
          closed: { pose: "sheet", thumb: PINCH_THUMB },
          by: "thick",
          unit: "A",
          range: [0.05, 0.45],
        },
        roles: roles("press", "press", "free"),
        fixture: "bang-gia#doc",
      },
      flat: {
        frame: "nf",
        pose: {
          open: { pose: "edge" },
          closed: { pose: "edge" },
          by: "thick",
          unit: "A",
          range: [0.05, 0.45],
        },
        roles: roles("press", "support", "press"),
        fixture: "phieu-lien#cam",
        thickMax: FLAT_MAX,
      },
      rim: {
        frame: "nt",
        pose: {
          open: { pose: "edge" },
          closed: { pose: "edge", knuckle: 45, tip: 65, thumb: RIM_THUMB },
          by: "thick",
          unit: "A",
          range: [0.05, 0.2],
        },
        roles: roles("press", "support", "press", { index: "wrap", middle: "press" }),
        fixture: "tom-hum#nhac",
      },
    },
    choices: {
      part: PART,
      edge: EDGE,
      along: ALONG,
      thumb: names(undefined, { from: "holder" }),
      variant: names(["pinch", "flat", "rim"], { default: "pinch" }),
      slant: range(-90, 90, {
        default: 0,
        names: ["in", "low", "high"],
        byVariant: { pinch: [-60, 60], flat: [-90, 90], rim: [-45, 45] },
      }),
    },
    hands: "either",
    support: { group: "sheet", edge: "opposite", keep: ["variant", "thumb", "along"] },
    intent: {
      face: { axis: "front", toward: "holderFace" },
      roll: { axis: "top", toward: "up" },
    },
  },

  card: {
    label: "Tấm nhỏ kẹp đầu ngón",
    needs: [{ kinds: ["slab"], test: (f, h) => thick(f) <= 0.2 * h.W, text: "tấm dày ≤ 0,2·W" }],
    variants: {
      lateral: {
        frame: "nf",
        pose: {
          open: { pose: "card" },
          closed: { pose: "card" },
          by: "thick",
          unit: "W",
          range: [0, 0.2],
        },
        roles: roles("press", "support", "free"),
        curl: 15,
        upright: true,
      },
      edges: {
        frame: "nf",
        pose: {
          open: EDGES_OPEN,
          closed: { pose: "edgePinch" },
          by: "width",
          unit: "W",
          range: EDGES_RANGE,
        },
        roles: roles("press", "support", "free", { index: "press" }),
        curl: EDGES_CURL,
        across: EDGES_ACROSS,
        sink: true,
      },
    },
    choices: {
      part: PART,
      edge: EDGE,
      // `edges`: ngón cái ở trung điểm cạnh trừ khi cảnh khai
      along: range(0, 1, {
        default: 0.5,
        names: ["corner", "low", "mid", "high"],
        gridByVariant: { edges: [0.5] },
      }),
      thumb: names(undefined, { from: "holder" }),
      variant: names(["lateral", "edges"], { default: "lateral" }),
      slant: range(-90, 90, {
        default: 0,
        names: ["in", "low", "high"],
        grid: [-40, 0, 40],
        byVariant: { lateral: [-90, 90], edges: [-30, 30] },
        gridByVariant: { edges: [-15, 0, 15] },
      }),
      // `edges`: phía ngón cái nâng quá 0 thì áp út, út và mép lòng tay hạ xuống mặt thẻ
      tilt: range(-30, 15, {
        default: 0,
        byVariant: { lateral: [0, 0], edges: [-30, 15] },
        gridByVariant: { edges: [-20, -10, 0] },
      }),
    },
    hands: "one",
    // mặt thẻ về người cầm, ngửa `CARD_RISE`: ngửa hơn thì kẹp bên chỉ tới được bằng khuỷu gập ngược hay cổ tay vượt kẹp
    intent: {
      face: { axis: "front", toward: CARD_FACE },
      roll: { axis: "top", toward: "up" },
    },
  },

  pen: {
    label: "Bút",
    needs: [
      {
        kinds: ["rod", "lathe"],
        test: (f, h, g) =>
          radius(f) <= 0.12 * h.W &&
          (f.kind === "rod" || f.kind === "lathe") &&
          f.len >= 1.2 * h.W &&
          !pairOf(f, g),
        text: "một thanh hay trụ bán kính ≤ 0,12·W, dài ≥ 1,2·W (không có thanh song song cùng phần)",
      },
    ],
    anchors: ["tip"],
    variants: {
      grip: {
        frame: "nf",
        pose: {
          open: { pose: "tripod" },
          closed: { pose: "tripod" },
          by: "radius",
          unit: "W",
          range: [0, 0.12],
        },
        roles: roles("press", "free", "free", { index: "press", middle: "support" }),
        curl: THIN_CURL,
        fixture: "but#viet",
      },
    },
    choices: { part: PART, along: range(0.15, 0.45, { default: 0.3 }) },
    hands: "one",
    motion: "write",
  },

  chopsticks: {
    label: "Đũa",
    needs: [
      {
        kinds: ["rod"],
        test: (f, h, g) => f.kind === "rod" && f.R <= 0.15 * h.W && pairOf(f, g, 0.15 * h.W),
        text: "hai thanh mảnh (r ≤ 0,15·W) cùng phần, lệch ≤ 15°",
      },
    ],
    anchors: ["tip"],
    variants: {
      grip: {
        frame: "nf",
        pose: {
          open: { pose: "chopsticks" },
          closed: { pose: "chopsticks" },
          by: "radius",
          unit: "W",
          range: [0, 0.15],
        },
        roles: roles("press", "press", "free", { pinky: "free" }),
        curl: THIN_CURL,
      },
    },
    choices: { part: PART, along: range(0.15, 0.5, { default: 0.35 }) },
    hands: "one",
    motion: "pick",
  },

  cylinder: {
    label: "Thân trụ",
    needs: [
      {
        kinds: ["rod", "lathe"],
        test: (f, h, g) =>
          (f.kind === "rod" ? f.r : f.kind === "lathe" ? f.rMax : 0) >= 0.06 * h.W &&
          roomy(g, f, h.W, 0.6, GRIP_CLEAR),
        text: "thanh hay trụ bán kính 0,06–0,95·W, đoạn bám liền ≥ 0,6·W chứa tâm nắm cách phần `grip: false` ≥ 0,3·W",
      },
    ],
    variants: {
      wrap: {
        frame: "nt",
        pose: {
          open: { pose: "grip", knuckle: WRAP_OPEN[0], tip: WRAP_OPEN[1] },
          closed: { pose: "fist", knuckle: WRAP_CLOSED[0], tip: WRAP_CLOSED[1] },
          by: "radius",
          unit: "W",
          range: [0.06, 0.95],
          thumb: WRAP_THUMB,
        },
        roles: roles("wrap", "wrap", "press"),
        fixture: "chai-dia#co",
      },
      flat: {
        frame: "nf",
        pose: {
          open: { pose: "span" },
          closed: { pose: "span" },
          by: "radius",
          unit: "W",
          range: [0.06, 0.95],
        },
        roles: roles("press", "press", "press", { pinky: "support" }),
        fixture: "dien-thoai#doc",
        kinds: ["rod"],
      },
    },
    choices: {
      part: names(undefined, { from: "longest" }),
      along: range(0, 1, { default: 0.5, names: ["low", "mid", "high"] }),
      around: range(0, 360),
      thumb: names(["up", "down"], { default: "up", cost: OFF_COST }),
      slant: range(0, WRAP_SLANT, {
        default: WRAP_SLANT,
        cost: OFF_COST,
        gridByVariant: { wrap: [0, WRAP_SLANT], flat: [WRAP_SLANT] },
      }),
    },
    hands: "either",
    support: { group: "platform", place: "bottom" },
    intent: { face: { axis: "top", toward: "up" } },
    size: { of: radius },
    clear: GRIP_CLEAR,
    variantOf: cylinderVariant,
  },

  round: {
    label: "Khối tròn",
    needs: [
      {
        kinds: ["ball", "lathe"],
        test: (f, h) => f.kind === "lathe" && f.len <= 2 * f.rMax && f.rMax <= SIZE_MAX * h.W,
        text: "khối cầu hay trụ ngắn béo",
      },
    ],
    variants: {
      palm: {
        frame: "nf",
        pose: {
          open: { pose: "ball" },
          closed: { pose: "ball" },
          by: "radius",
          unit: "W",
          range: [0, SIZE_MAX],
        },
        roles: roles("wrap", "wrap", "press"),
      },
      top: {
        frame: "nf",
        pose: {
          open: { pose: "claw" },
          closed: { pose: "claw" },
          by: "radius",
          unit: "W",
          range: [0, SIZE_MAX],
        },
        roles: roles("tip", "tip", "free"),
      },
    },
    choices: {
      part: PART,
      variant: names(["palm", "top"], { default: "palm" }),
    },
    hands: "one",
    later: true,
  },

  bowl: {
    label: "Chén không quai",
    needs: [
      {
        kinds: ["lathe"],
        test: (f, h) => f.kind === "lathe" && f.mouth !== undefined && f.rMax <= 1.3 * h.W,
        text: "trụ tiện có miệng, bán kính lớn nhất ≤ 1,3·W",
      },
    ],
    variants: {
      side: {
        frame: "nt",
        pose: {
          open: { pose: "clasp", thumb: BOWL_THUMB },
          closed: { pose: "clasp", thumb: BOWL_THUMB },
          by: "radius",
          unit: "W",
          range: [0, 1.3],
        },
        roles: roles("wrap", "wrap", "press", { ring: "support", pinky: "support" }),
        fixture: "chen#kep",
      },
      pinch: {
        frame: "nt",
        pose: {
          open: PINCH_OPEN,
          closed: { pose: "cupPinch" },
          by: "radius",
          unit: "W",
          range: [0.3, BOWL_PINCH_MAX],
        },
        roles: roles("press", "support", "free", { index: "press", middle: "press" }),
        curl: PINCH_CURL,
        thumbToward: "back",
      },
    },
    choices: {
      part: PART,
      around: range(0, 360),
      // `side` tính từ đáy, nửa dưới thành: cao hơn thì lòng tay trùm miệng; `pinch` tính từ miệng, sâu hơn thì lòng tay chạm thân
      along: range(0, 0.5, {
        default: 0.25,
        names: ["low", "mid"],
        byVariant: { pinch: [PINCH_ALONG[0], PINCH_ALONG[1]] },
      }),
    },
    hands: "either",
    support: { group: "platform", place: "bottom" },
    intent: { face: { axis: "top", toward: "up" } },
    variantOf: (f, _g, _around, h) =>
      f.kind === "lathe" && f.rMax <= BOWL_PINCH_MAX * h.W ? "pinch" : "side",
  },

  handle: {
    label: "Quai",
    needs: [
      {
        kinds: ["rod"],
        test: (f, h, g) =>
          f.kind === "rod" &&
          f.R <= 0.3 * h.W &&
          Math.abs(dot3(f.a, g.U)) <= Math.cos(HOOK_TILT * D2R) &&
          span(g, f) >= 0.8 * h.W &&
          f.gap >= HOOK_GAP * h.W,
        text: "thanh có R ≤ 0,3·W, lệch `top` ≥ 45°, đoạn bám liền ≥ 0,8·W, khe sau thanh ≥ 2 × bán kính ngón",
      },
    ],
    variants: {
      hook: {
        frame: "nf",
        pose: {
          open: HOOK,
          closed: HOOK,
          by: "radius",
          unit: "W",
          range: [0, 0.3],
        },
        roles: roles("free", "wrap", "free"),
        fixture: "tui#xach",
      },
    },
    choices: { part: PART, along: ALONG },
    hands: "one",
    intent: { face: { axis: "top", toward: "up" } },
  },

  palmBox: {
    label: "Hộp cỡ lòng tay",
    needs: [
      {
        kinds: ["box"],
        test: (f, h) => {
          const s = sorted(f);
          return (
            !!s &&
            s[0] >= 0.1 * h.W &&
            s[0] <= 0.6 * h.W &&
            s[1] >= 0.7 * h.W &&
            s[1] <= 1.9 * h.W &&
            s[2] >= 1.2 * h.W
          );
        },
        text: "hộp dày 0,1–0,6·W, rộng 0,7–1,9·W, dài ≥ 1,2·W",
      },
    ],
    variants: {
      default: {
        frame: "nf",
        pose: {
          open: { pose: "span" },
          closed: { pose: "span" },
          by: "width",
          unit: "W",
          range: [0.7, 1.9],
        },
        roles: roles("press", "press", "press", { pinky: "support" }),
        fixture: "dien-thoai#doc",
      },
    },
    choices: {
      part: PART,
      thumb: names(["left", "right"], { from: "side" }),
      along: range(0, 1, { default: 0.4 }),
      tilt: range(0, 25, { default: 20 }),
    },
    hands: "one",
    support: { group: "platform", place: "back" },
    intent: { face: { axis: "front", toward: "holderFace" } },
  },

  platform: {
    label: "Đỡ dưới",
    needs: [
      {
        kinds: ["face"],
        test: (f, h) =>
          f.kind === "face" &&
          2 * Math.min(...f.half) >= 0.4 * h.W &&
          2 * Math.max(...f.half) >= 0.6 * h.L,
        text: "mặt chứa được 0,4·W × 0,6·L",
      },
    ],
    variants: {
      palm: {
        frame: "nf",
        pose: {
          open: PLATFORM_FLAT,
          closed: PLATFORM_FLAT,
          by: "width",
          unit: "W",
          range: [0, 1],
        },
        roles: roles("free", "support", "press"),
        fixture: "khay#bung",
      },
    },
    choices: {
      part: PART,
      edge: EDGE,
      along: ALONG,
      psi: range(-90, 90, { default: 90 }),
      inset: range(0, Infinity),
    },
    hands: "either",
    support: { group: "platform", edge: "opposite" },
    intent: { face: { axis: "support", toward: "up" } },
  },

  hug: {
    label: "Ôm vào thân",
    needs: [
      {
        kinds: ["slab", "box"],
        test: (f, h) => {
          const s = sorted(f);
          return !!s && s[1] >= 2 * h.W && s[2] >= 2 * h.W;
        },
        text: "tấm hay hộp có mặt lớn ≥ 2·W × 2·W",
      },
    ],
    variants: {
      default: {
        frame: "nf",
        pose: {
          open: { pose: "flat" },
          closed: { pose: "flat" },
          by: "width",
          unit: "W",
          range: [0, 1],
        },
        roles: roles("free", "support", "press"),
      },
    },
    choices: { part: PART },
    hands: "one",
    later: true,
  },

  clamp: {
    label: "Ép hai lòng tay",
    needs: [
      {
        kinds: ["box"],
        test: (f, h) => {
          const s = sorted(f);
          return !!s && s[1] >= 1.2 * h.W;
        },
        text: "hộp có hai mặt đối cách ≥ 1,2·W",
      },
    ],
    variants: {
      default: {
        frame: "nf",
        pose: {
          open: { pose: "flat" },
          closed: { pose: "flat" },
          by: "width",
          unit: "W",
          range: [1.2, Infinity],
        },
        roles: roles("free", "support", "press"),
      },
    },
    choices: { part: PART },
    hands: "two",
    later: true,
  },

  carry: {
    label: "Treo",
    needs: [
      {
        kinds: ["box"],
        test: (_f, _h, g) => !!(g.seats?.elbow || g.seats?.shoulder),
        text: "thân món (hình va chạm) và chỗ treo `seats`",
      },
    ],
    variants: { default: { frame: "nf", roles: roles("free", "free", "free") } },
    choices: {
      on: names(CARRY_ON),
      yaw: range(-180, 180, { default: 0 }),
    },
    hands: "one",
  },

  soft: {
    label: "Vật mềm",
    needs: [],
    variants: { default: { frame: "nf", roles: roles("free", "free", "free") } },
    choices: { part: PART },
    hands: "one",
    later: true,
  },
};

export const GRIP_GROUPS = Object.fromEntries(
  GROUP_IDS.map((id) => [id, { id, ...SPECS[id] }]),
) as Record<GroupId, GroupSpec>;

const specOf = (g: GroupId | GroupSpec): GroupSpec => (typeof g === "string" ? GRIP_GROUPS[g] : g);

/** Biến thể của một chỗ cầm: biến thể gốc `base` (tên, bảng) và bản soạn tay của món cho chính tên đã gọi, nếu có */
export interface VariantRef {
  base: string;
  spec: VariantSpec;
  authored?: AuthoredGrasp;
}

/**
 * Biến thể `v` của nhóm trên món `item`: biến thể gốc, hay kiểu cầm có tên của món (`authored.<nhóm>.<tên>`) — mượn chỗ
 * tiếp xúc, dáng, vai trò, miền của `base`, khung cầm theo bản soạn của tên ấy. Không có thì `undefined`. Mọi chỗ tra
 * bảng biến thể theo `variant` của cảnh đi qua đây (docs/11-nhom-cam.md § Kiểu cầm soạn tay)
 */
export function variantOf(
  item: Pick<HeldItemSpec, "authored"> | undefined,
  group: GroupId | GroupSpec,
  v: string,
): VariantRef | undefined {
  const g = specOf(group);
  const au = item?.authored?.[g.id]?.[v];
  if (Object.hasOwn(g.variants, v))
    return { base: v, spec: g.variants[v], ...(au && { authored: au }) };
  if (!au?.base || !Object.hasOwn(g.variants, au.base)) return undefined;
  return { base: au.base, spec: g.variants[au.base], authored: au };
}

/** Biến thể gốc của biến thể `v` (tên kiểu cầm của món ra `base` của nó); không có thì chính `v` */
export const baseVariant = (
  item: Pick<HeldItemSpec, "authored"> | undefined,
  group: GroupId | GroupSpec,
  v: string,
): string => variantOf(item, group, v)?.base ?? v;

/** Kiểu cầm có tên của món cho nhóm (khoá `authored` không phải biến thể gốc): tên, biến thể gốc, mô tả */
export function namedVariants(
  item: Pick<HeldItemSpec, "authored"> | undefined,
  group: GroupId | GroupSpec,
): { name: string; base: string; note?: string }[] {
  const g = specOf(group);
  return Object.entries(item?.authored?.[g.id] ?? {})
    .filter(([name, a]) => !Object.hasOwn(g.variants, name) && a.base)
    .map(([name, a]) => ({ name, base: a.base!, ...(a.note && { note: a.note }) }));
}

export interface GroupFit {
  feature: Feature;
  /** Số đo / `W` khi nhóm có `size` */
  ratio?: number;
  /** `ratio ≥ SIZE_WARN` (nắm không kín) */
  warn: boolean;
}

/**
 * Khối hình của món đạt `needs` của nhóm với cỡ tay `dims`, kèm tỉ lệ `size` (quá `SIZE_MAX · W` bị loại, từ `SIZE_WARN · W`
 * cảnh báo). Nhóm `later` không có khối nào; `anchors` (mốc của món) có thì mốc nhóm cần phải có `dir`
 */
export function groupFits(
  geom: ItemGeom,
  group: GroupId | GroupSpec,
  dims: HandDims,
  anchors?: Record<string, { dir?: unknown }>,
): GroupFit[] {
  const spec = specOf(group);
  if (spec.later) return [];
  if (anchors && spec.anchors?.some((a) => !anchors[a]?.dir)) return [];
  const out: GroupFit[] = [];
  for (const f of geom.features) {
    if (!spec.needs.some((n) => n.kinds.includes(f.kind) && (!n.test || n.test(f, dims, geom))))
      continue;
    const ratio = spec.size ? spec.size.of(f) / dims.W : undefined;
    if (ratio !== undefined && ratio > SIZE_MAX) continue;
    out.push({
      feature: f,
      ...(ratio !== undefined ? { ratio } : {}),
      warn: (ratio ?? 0) >= SIZE_WARN,
    });
  }
  return out;
}

/** Khối hình đạt `needs` (xem `groupFits`) */
export const groupNeeds = (
  geom: ItemGeom,
  group: GroupId | GroupSpec,
  dims: HandDims,
  anchors?: Record<string, { dir?: unknown }>,
): Feature[] => groupFits(geom, group, dims, anchors).map((x) => x.feature);

export interface HoldDefaultOpts {
  /** Khối hình chọn; bỏ trống là tấm hay đĩa đầu tiên */
  feature?: Feature;
  /** Hướng từ món tới mặt người cầm, khung món; bỏ trống là `front` (mặt trước quay về người cầm) */
  toHolder?: V3;
  /** Bên giải phẫu của tay: `-1` phải, `1` trái */
  side?: 1 | -1;
}

/** Giá trị mặc định (in đậm ở docs/11 mục 3) của các lựa chọn nhóm có mặc định; `thumb` theo `opts` */
export function holdDefaults(
  group: GroupId | GroupSpec,
  geom: ItemGeom,
  opts: HoldDefaultOpts = {},
): Partial<Record<ChoiceKey, string | number>> {
  const spec = specOf(group);
  const out: Partial<Record<ChoiceKey, string | number>> = {};
  for (const [key, c] of Object.entries(spec.choices) as [ChoiceKey, Choice][]) {
    if (c.default !== undefined) out[key] = c.default;
    else if (c.kind === "names" && c.from === "side")
      out[key] = (opts.side ?? -1) === -1 ? "right" : "left";
    else if (c.kind === "names" && c.from === "longest") {
      const kinds = new Set<string>(spec.needs.flatMap((n) => n.kinds));
      let best: Feature | undefined;
      for (const f of geom.features)
        if (
          kinds.has(f.kind) &&
          "len" in f &&
          (!best || f.len > (best as { len: number }).len + 1e-9)
        )
          best = f;
      if (best) out[key] = best.part;
    } else if (c.kind === "names" && c.from === "holder") {
      const f =
        opts.feature ??
        geom.features.find(
          (x): x is Extract<Feature, { kind: "slab" | "disc" }> =>
            x.kind === "slab" || x.kind === "disc",
        );
      if (f && (f.kind === "slab" || f.kind === "disc")) {
        const to = opts.toHolder ?? geom.F;
        const best = f.faces.reduce((a, b) => (dot3(b.n, to) > dot3(a.n, to) + 1e-9 ? b : a));
        out[key] = f.lying ? "top" : best.name;
      }
    }
  }
  return out;
}

type IntentGeom = Pick<ItemGeom, "U" | "F"> & Partial<Pick<ItemGeom, "features">>;

const axisOf = (a: IntentAxis, geom: IntentGeom): AxisIntent => ({
  axis: [...(a.axis === "front" ? geom.F : a.axis === "top" ? geom.U : supportAxis(geom))] as V3,
  toward: a.toward,
});

/**
 * Mặt đỡ trong `faces`: pháp tuyến ngoài gần `down` nhất, hoà (lệch dưới 1e-6) thì gần `back`; các mặt hoà nhau giữ thứ tự
 * (docs/11 mục 3 nhóm 10)
 */
export function supportFaces(faces: readonly FaceFeature[], down: V3, back: V3): FaceFeature[] {
  const score = (f: FaceFeature): [number, number] => [dot3(f.n, down), dot3(f.n, back)];
  let best: [number, number] | undefined;
  for (const f of faces) {
    const s = score(f);
    if (!best || s[0] > best[0] + 1e-6 || (s[0] > best[0] - 1e-6 && s[1] > best[1] + 1e-6))
      best = s;
  }
  return faces.filter((f) => {
    const s = score(f);
    return best && Math.abs(s[0] - best[0]) <= 1e-6 && Math.abs(s[1] - best[1]) <= 1e-6;
  });
}

/** Mặt lớn (diện tích ≥ ½ mặt lớn nhất) mà món dựng theo `top` đặt lên lòng tay: gần `−top`, hoà thì gần `−front` */
const SUPPORT_AREA = 0.5;
function supportAxis(geom: IntentGeom): V3 {
  const faces = (geom.features ?? []).filter((f): f is FaceFeature => f.kind === "face");
  const area = (f: FaceFeature) => f.half[0] * f.half[1];
  const big = Math.max(0, ...faces.map(area));
  const pick = supportFaces(
    faces.filter((f) => area(f) >= SUPPORT_AREA * big),
    scale3(geom.U, -1),
    scale3(geom.F, -1),
  )[0];
  return pick ? scale3(pick.n, -1) : geom.U;
}

/**
 * Hướng món của chỗ cầm: mặc định của nhóm (trục `front` / `top` của món) bị `up`, `face`, `roll` của `hold` đè; `keep`
 * bỏ hết. `face` khai đích trần mà nhóm không có trục mặc định thì ném lỗi
 */
export function groupIntent(
  group: GroupId | GroupSpec,
  hold: SceneHold,
  geom: IntentGeom,
): { face?: AxisIntent; roll?: AxisIntent } {
  const spec = specOf(group);
  const h = groupHold(hold);
  if (h.keep) return {};
  let face = spec.intent?.face && axisOf(spec.intent.face, geom);
  let roll = spec.intent?.roll && axisOf(spec.intent.roll, geom);
  if (h.up !== undefined) face = { axis: h.up, toward: "up" };
  else if (h.face !== undefined) {
    if (typeof h.face === "object" && !Array.isArray(h.face) && "axis" in h.face) face = h.face;
    else {
      if (!face)
        throw new Error(
          `nhóm \`${spec.id}\` không có trục ý định mặc định cho \`face\` khai đích trần`,
        );
      face = { axis: face.axis, toward: h.face as IntentTarget };
    }
  }
  if (h.roll) roll = h.roll;
  return { ...(face && { face }), ...(roll && { roll }) };
}

const describe = (f: Feature): string => {
  const p = `\`${f.part}\``;
  switch (f.kind) {
    case "slab":
      return `tấm ${p} (dày ${fmt(f.t)})`;
    case "disc":
      return `đĩa ${p} (r ${fmt(f.radius)})`;
    case "rod":
      return `thanh ${p} (r ${fmt(f.r)}, R ${fmt(f.R)})`;
    case "lathe":
      return `trụ tiện ${p} (r ${fmt(f.rMax)})`;
    case "box":
      return `hộp ${p} (${f.half.map((x) => fmt(2 * x)).join(" × ")})`;
    case "face":
      return `mặt ${p}`;
  }
};

const kindsOf = (spec: GroupSpec) => new Set(spec.needs.flatMap((n) => n.kinds));

/**
 * Lỗi `group`: món (hay phần `part`) không có khối hình nào cho nhóm với cỡ tay. Dòng báo nêu khối hình món có, phần
 * quá tầm nắm, và phần khác còn vừa
 */
export function checkGroup(
  geom: ItemGeom,
  group: GroupId | GroupSpec,
  dims: HandDims,
  opts: { item?: string; part?: string; anchors?: Record<string, { dir?: unknown }> } = {},
): string[] {
  const spec = specOf(group);
  const who = `\`${opts.item ?? "món"}\``;
  if (spec.later) return [`${who}: nhóm \`${spec.id}\` (${spec.label}) chưa làm`];
  const fits = groupFits(geom, spec, dims, opts.anchors);
  const mine = opts.part ? fits.filter((x) => x.feature.part === opts.part) : fits;
  if (mine.length) return [];
  const kinds = kindsOf(spec);
  const own = geom.features.filter(
    (f) => kinds.has(f.kind) && (!opts.part || f.part === opts.part),
  );
  const big = spec.size
    ? own
        .filter((f) => spec.size!.of(f) / dims.W > SIZE_MAX)
        .map(
          (f) =>
            `${describe(f)} quá tầm nắm của tay (${fmt(SIZE_MAX)} · W = ${fmt(SIZE_MAX * dims.W)})`,
        )
    : [];
  const missing = spec.anchors?.filter((a) => !opts.anchors?.[a]?.dir) ?? [];
  const have = [...new Set(geom.features.filter((f) => f.kind !== "face").map(describe))];
  const other = opts.part ? fits.map((x) => `\`${x.feature.part}\``) : [];
  return [
    `${who}${opts.part ? ` phần \`${opts.part}\`` : ""} không có khối hình nào cho nhóm \`${spec.id}\` (${spec.label}) với cỡ tay này (W ${fmt(dims.W)}): cần ${spec.needs.map((n) => n.text).join(" hay ") || "khối hình riêng"}` +
      (missing.length && opts.anchors ? `; thiếu mốc có \`dir\`: ${missing.join(", ")}` : "") +
      (big.length ? `; ${big.join("; ")}` : "") +
      (have.length ? `; món có: ${have.join(", ")}` : "") +
      (other.length ? `; phần khác còn vừa: ${[...new Set(other)].join(", ")}` : ""),
  ];
}

const CHOICE_KEYS: ChoiceKey[] = [
  "part",
  "edge",
  "along",
  "thumb",
  "slant",
  "around",
  "tilt",
  "psi",
  "inset",
  "variant",
  "on",
  "yaw",
];

/** Tên mặt, cạnh mà khối hình tấm, đĩa hay mặt nhận */
const slabEdgeOk = (f: Feature, edge: string | number): boolean =>
  f.kind === "slab" || f.kind === "face"
    ? typeof edge === "string" && f.edges.some((e) => e.name === edge)
    : f.kind === "disc"
      ? typeof edge === "number" || f.rim.includes(edge as never)
      : true;
const faceOk = (f: Feature, thumb: string): boolean =>
  f.kind === "slab" || f.kind === "disc" ? f.faces.some((x) => x.name === thumb) : true;

/**
 * Lỗi `group` và `choice` của một chỗ cầm v2 (docs/11 mục 7): nhóm `later`, trường không thuộc nhóm, `on` / `yaw` ngoài
 * `carry`, `carry` thiếu `on` hay món không có `seats[on]`, `both` với nhóm một tay không có tay phụ (`support`), biến thể,
 * số ngoài miền, `part` / `edge` / `thumb` không có trên khối hình, biến thể quá bề dày ở mép (`thickMax`, đo trên `shape`),
 * và món không có khối hình cho nhóm. `variant` là biến thể gốc hay tên kiểu cầm trong `authored` của món (`variantOf`).
 * Mảng rỗng là hợp lệ
 */
export function checkChoice(
  group: GroupId | GroupSpec,
  geom: ItemGeom,
  hold: SceneHold,
  dims: HandDims,
  anchors?: Record<string, { dir?: unknown }>,
  shape?: readonly HeldShape[],
  authored?: HeldItemSpec["authored"],
): string[] {
  const spec = specOf(group);
  const h: SceneHoldGroup = groupHold(hold);
  const where = `\`${h.item}@${spec.id}\``;
  if (spec.later) return [`${where}: nhóm \`${spec.id}\` (${spec.label}) chưa làm`];
  const out: string[] = [];
  const bad = (m: string) => out.push(`${where}: ${m}`);

  for (const key of CHOICE_KEYS) {
    const v = h[key];
    if (v === undefined) continue;
    const c = spec.choices[key];
    if (key === "variant") {
      if (!variantOf({ authored }, spec, v as string)) {
        const named = namedVariants({ authored }, spec).map((x) => x.name);
        bad(
          `biến thể \`${v}\` không có ở nhóm \`${spec.id}\` (gốc: ${Object.keys(spec.variants).join(", ")}; kiểu cầm của món: ${named.join(", ") || "không có"})`,
        );
      }
      continue;
    }
    if (!c) {
      bad(
        key === "on" || key === "yaw"
          ? `\`${key}\` chỉ có ở nhóm \`carry\``
          : `\`${key}\` không thuộc nhóm \`${spec.id}\` (có: ${Object.keys(spec.choices).join(", ") || "không"})`,
      );
      continue;
    }
    if (c.kind === "names") {
      if (c.values && !c.values.includes(v as string))
        bad(`\`${key}: ${v}\` ngoài miền (${c.values.join(", ")})`);
    } else if (typeof v === "number") {
      const variant =
        h.variant !== undefined
          ? baseVariant({ authored }, spec, h.variant)
          : spec.choices.variant?.default;
      const [lo, hi] = (variant && c.byVariant?.[variant]) || [c.min, c.max];
      if (!(v >= lo && v <= hi)) bad(`\`${key}: ${v}\` ngoài miền [${lo}, ${hi}]`);
    } else if (!c.names?.includes(v as string)) {
      bad(`\`${key}: ${v}\` không phải tên gọi hợp lệ${c.names ? ` (${c.names.join(", ")})` : ""}`);
    }
  }
  if (h.both !== undefined && spec.hands === "one" && !spec.support)
    bad(`nhóm \`${spec.id}\` một tay, không có \`both\``);
  if (spec.choices.on) {
    const seats = geom.seats;
    if (h.on === undefined) bad(`thiếu \`on\`: chỗ treo trên cánh tay (${CARRY_ON.join(", ")})`);
    else if (seats && !seats[h.on])
      bad(
        `món không có chỗ treo \`seats.${h.on}\` (có: ${CARRY_ON.filter((k) => seats[k]).join(", ")})`,
      );
  }

  const part = h.part;
  if (part !== undefined) {
    const p = geom.parts.find((x) => x.name === part);
    if (!p) bad(`không có phần \`${part}\` (phần: ${geom.parts.map((x) => x.name).join(", ")})`);
    else if (!p.grip) bad(`phần \`${part}\` là \`grip: false\`, không được cầm`);
  }
  if (out.length && part !== undefined && !geom.parts.some((x) => x.name === part && x.grip))
    return out;
  const noFit = checkGroup(geom, spec, dims, { item: h.item, part, anchors });
  if (noFit.length) return [...out, ...noFit];

  const fits = groupFits(geom, spec, dims, anchors)
    .map((x) => x.feature)
    .filter((f) => !part || f.part === part);
  const byEdge = h.edge === undefined ? fits : fits.filter((f) => slabEdgeOk(f, h.edge!));
  if (!byEdge.length)
    bad(`\`edge: ${h.edge}\` không có trên khối hình (${fits.map(describe).join(", ")})`);
  else if (
    h.thumb !== undefined &&
    spec.choices.thumb?.kind === "names" &&
    !spec.choices.thumb.values &&
    !byEdge.some((f) => faceOk(f, h.thumb!))
  )
    bad(`\`thumb: ${h.thumb}\` không có trên khối hình (${byEdge.map(describe).join(", ")})`);
  const v = h.variant !== undefined ? variantOf({ authored }, spec, h.variant)?.base : undefined;
  const vl = h.variant === v ? `\`${v}\`` : `\`${h.variant}\` (gốc \`${v}\`)`;
  const kinds = v !== undefined ? spec.variants[v].kinds : undefined;
  if (kinds && byEdge.length && !byEdge.some((f) => kinds.includes(f.kind)))
    bad(
      `biến thể ${vl} chỉ áp trên ${kinds.map((k) => `\`${k}\``).join(", ")} (${byEdge.map(describe).join(", ")})`,
    );
  const across = v !== undefined ? spec.variants[v].across : undefined;
  if (v !== undefined && across && byEdge.length) {
    const slabs = byEdge.filter((f): f is SlabFeature => f.kind === "slab");
    const names = (f: SlabFeature) =>
      h.edge !== undefined ? [h.edge as SideName] : f.edges.map((e) => e.name);
    const fit = slabs.flatMap((f) =>
      names(f).filter((e) => acrossMiss(spec, v, f, e, dims) === undefined),
    );
    if (!fit.length) {
      const ws = slabs.flatMap((f) => names(f).map((e) => acrossOf(f, e) ?? NaN));
      bad(
        `biến thể ${vl} cần tấm rộng ${String(across[0]).replace(".", ",")}–${String(across[1]).replace(".", ",")}·W (${fmt(across[0] * dims.W)}–${fmt(across[1] * dims.W)}) qua hai mép được kẹp${h.edge !== undefined ? ` ở cạnh \`${h.edge}\`` : ""}, tấm rộng ${ws
          .filter(Number.isFinite)
          .map(fmt)
          .join(", ")}`,
      );
    }
  }
  const max = v !== undefined ? spec.variants[v].thickMax : undefined;
  if (v !== undefined && max !== undefined && byEdge.length) {
    const thick = byEdge.map((f) => tooThick(spec, v, f, h.edge, dims, shape));
    if (thick.every((t) => t !== undefined)) {
      const others = Object.keys(spec.variants).filter((x) => !spec.variants[x].thickMax);
      bad(
        `biến thể ${vl} cần bề dày ở mép ≤ ${String(max).replace(".", ",")}·W (${fmt(max * dims.W)}), mép dày ${fmt(Math.min(...(thick as number[])))}: ngón cái không vắt qua mép — dùng ${others.map((x) => `\`${x}\``).join(" hay ")}`,
      );
    }
  }
  return out;
}

/**
 * Cảnh báo của một chỗ cầm v2 hợp lệ (docs/11 mục 7), không chặn: `along` cảnh khai sát phần `grip: false` quá `clear · W`
 * của nhóm — rig kẹp tâm nắm về miền `alongRoom`. Mảng rỗng là không có gì
 */
export function choiceWarnings(
  group: GroupId | GroupSpec,
  geom: ItemGeom,
  hold: SceneHold,
  dims: HandDims,
  anchors?: Record<string, { dir?: unknown }>,
): string[] {
  const spec = specOf(group);
  const h: SceneHoldGroup = groupHold(hold);
  if (!spec.clear || spec.later || h.along === undefined || !spec.choices.along) return [];
  const want = alongFrac(h.along, 1, dims.W);
  const clear = spec.clear * dims.W;
  const out = new Set<string>();
  for (const { feature: f } of groupFits(geom, spec, dims, anchors)) {
    if ((f.kind !== "rod" && f.kind !== "lathe") || (h.part !== undefined && f.part !== h.part))
      continue;
    const p = axialAt(geom, f, want, 0, { clear });
    if (Math.abs(p.along - want) < 1e-9) continue;
    const low = want < p.along;
    const gap = Math.max(0, low ? want : 1 - want) * p.seg.len;
    out.add(
      `\`${h.item}@${spec.id}\`: \`along: ${h.along}\` sát phần \`grip: false\` \`${p.seg.cut[low ? 0 : 1]}\` — tâm nắm cách nó ${fmt(gap)} dọc trục, dưới ${String(spec.clear).replace(".", ",")}·W (${fmt(clear)}); rig kẹp về \`along\` ${p.along.toFixed(2).replace(".", ",")}, khai \`along\` ${low ? "≥" : "≤"} ${p.along.toFixed(2).replace(".", ",")}`,
    );
  }
  return [...out];
}
