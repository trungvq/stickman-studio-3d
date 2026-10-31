import { z } from "zod";
import { INK, RIG } from "./constants";
import { FACE_REST } from "./face";

/** Bump khi đổi hình dạng JSON nhân vật; `migrateCharacter` phải có nhánh tương ứng. */
export const CHARACTER_VERSION = 7;

/** Một socket của người 3D: `sculpt` dựng khối theo trường riêng của socket, `none` là trống */
const piece = z.object({
  src: z.enum(["none"]).default("none"),
  /** Màu dựng khối; bỏ trống thì lấy theo bảng màu */
  color: z.string().optional(),
  accent: z.string().optional(),
});

/**
 * Tóc dựng khối: mảng tóc là một vỏ ôm sọ đơn vị, chân tóc là vĩ độ theo kinh độ, độ.
 * Kinh độ 0 là giữa mặt, dương về `+x`. docs/12-trang-phuc-3d.md#tóc-dựng-khối
 */
/** Kiểu tóc dựng khối: bảng gai và răng cưa mái hard code theo kiểu ở `SCULPT_STYLES` */
export const SCULPT_STYLE_NAMES = [
  "plain",
  "neat",
  "spiky",
  "round",
  "center",
  "bob",
  "shoulder",
  "slick",
  "curly",
  "bald",
  "pony",
  "bun",
  "messy",
  "afro",
  "buzz",
  "crop",
  "quiff",
  "anime",
] as const;

export const SculptSchema = z.object({
  /**
   * `plain` vỏ trơn; `neat` rẽ rãnh ngôi, lọn dẹt chải sang mái; `spiky` mọc gai theo bảng của kiểu;
   * `round` mái bằng; `center` ngôi giữa; `bob` đuôi cụp; `shoulder` ngang vai gợn sóng; `slick` vuốt ngược;
   * `curly` xoăn búp; `bald` hói đỉnh, chỉ còn vành tóc hai bên và sau gáy; `pony` đuôi ngựa; `bun`
   * búi; `messy` ngắn xù, đuôi so le; `afro` xoăn bồng ôm cả đầu; `buzz` đầu đinh sát da; `crop` tròn ngắn mái bằng có lọn xoáy;
   * `quiff` mái dựng cao vuốt ngược; `anime` lọn dẹt nhọn chảy từ xoáy, mái rủ, mai và gáy hất ra
   */
  style: z.enum(SCULPT_STYLE_NAMES).default("plain"),
  /** Vĩ độ chân tóc giữa trán */
  front: z.number().default(42),
  /** Vĩ độ chân tóc ở gáy */
  nape: z.number().default(-22),
  /** Vĩ độ chân tóc vòng trên tai */
  ear: z.number().default(16),
  /** Vĩ độ mút tóc mai trước tai */
  sideburn: z.number().default(0),
  /** Kinh độ đường ngôi; mái hất về phía đối diện */
  part: z.number().default(35),
  /** Mái rủ xuống trán bấy nhiêu độ, sâu nhất ở giữa ngôi và thái dương bên kia */
  fringe: z.number().default(15),
  /** Độ phồng ở đỉnh, lần bán kính sọ */
  volume: z.number().default(0.07),
  /** Mái lệch rủ xuống dưới chân tóc bấy nhiêu độ ở chỗ sâu nhất; `0` là không có */
  bang: z.number().default(0),
  /** Kinh độ chỗ mái lệch rủ sâu nhất; mép mái chéo từ đường ngôi tới đây */
  bangTo: z.number().default(-50),
  /** Bề dày mép mái lệch, lần bán kính sọ */
  bangThick: z.number().default(0.1),
  /** Đuôi tóc rủ tới bấy nhiêu lần bán kính dưới tâm đầu theo trọng lực; `0` là tóc không rủ */
  length: z.number().default(0),
  /** Hệ số nhân chiều dài gai và lọn vuốt; `1` đúng bảng, `0` tắt cả hai */
  spike: z.number().default(1),
  /** Kiểu hói: vĩ độ mép trên vành tóc ở hai bên */
  crownSide: z.number().default(22),
  /** Kiểu hói: vĩ độ mép trên vành tóc sau gáy */
  crownBack: z.number().default(32),
  /** Kiểu hói: kinh độ mũi trước của vành tóc, tính từ giữa mặt; trước đó trọc */
  crownFrom: z.number().default(80),
  /** Kiểu hói: vành mở hết bề cao sau bấy nhiêu độ kinh tính từ mũi */
  crownEase: z.number().default(12),
  /** Đuôi ngựa, búi: vĩ độ chỗ buộc sau gáy */
  tie: z.number().default(55),
  /** Đuôi ngựa: đuôi rủ tới bấy nhiêu lần bán kính sọ dưới chỗ buộc, theo trọng lực */
  tail: z.number().default(1.3),
  /** Đuôi ngựa, búi: kinh độ chỗ buộc; `180` giữa gáy */
  tieLon: z.number().default(180),
  /** Đuôi ngựa, búi: hệ số nhân bán kính búi và bề ngang đuôi */
  knotSize: z.number().default(1),
  /** Số lọn vểnh trên đỉnh đầu; `0` là không có */
  ahoge: z.number().int().min(0).default(0),
  /** Lọn vểnh: dài bấy nhiêu lần bán kính sọ */
  ahogeLength: z.number().default(0.5),
  /** Lọn vểnh: hướng cong trên mặt sọ, độ; `0` ra trước mặt, `90` về `+x`, `180` ra sau */
  ahogeHeading: z.number().default(0),
  /** Lọn vểnh: ngọn ngả khỏi phương dựng đứng bấy nhiêu độ; `90` nằm ngang, hơn nữa thì cụp xuống */
  ahogeBend: z.number().default(120),
  /** Chân tóc hai bên trán lùi lên bấy nhiêu độ (hói chữ M); `0` là không */
  recede: z.number().default(0),
  /** Kinh độ chỗ chân tóc lùi sâu nhất, hai bên đối xứng */
  recedeAt: z.number().default(40),
  /** Màu phụ `pieces.hair.accent`: phủ từ chân tóc lên bấy nhiêu phần chiều cao vỏ */
  accentTo: z.number().default(0.45),
  /** Màu phụ: từ kinh độ này ra sau gáy, hai bên đối xứng */
  accentFrom: z.number().default(70),
});

/**
 * Kính dựng khối: hai mắt kính, cầu và càng dựng quanh hai mắt trên sọ đơn vị, quay theo mặt.
 * Số đo theo bán kính sọ. docs/12-trang-phuc-3d.md#kính-dựng-khối
 */
export const GLASSES_SHAPES = ["round", "rect"] as const;

export const GlassesSchema = z.object({
  /** `round` mắt tròn, `rect` chữ nhật bo góc */
  shape: z.enum(GLASSES_SHAPES).default("round"),
  /** Kính râm: mắt kính tô `color`, gọng vẽ màu nét */
  tint: z.boolean().default(false),
  /** Nửa chiều cao mắt kính */
  size: z.number().default(0.19),
  /** Tâm mắt kính xa trục giữa mặt hơn tâm mắt bấy nhiêu */
  spread: z.number().default(0.03),
  /** Tâm mắt kính cao hơn tâm mắt bấy nhiêu */
  rise: z.number().default(0),
  /** Mặt kính đứng trước mắt bấy nhiêu */
  stand: z.number().default(0.12),
  /** Bề dày gọng, phần nét viền */
  thick: z.number().default(0.34),
});

/**
 * Mũ dựng khối của người 3D: ôm sọ và vỏ tóc dưới nó, quay theo đầu. Góc theo độ, dài theo bán kính sọ.
 * docs/12-trang-phuc-3d.md#mũ-dựng-khối
 */
export const HAT_SHAPES = ["drum", "peaked"] as const;
export type HatShape = (typeof HAT_SHAPES)[number];

export const HatSchema = z.object({
  /** `drum` trụ thấp hở đáy, đỉnh phẳng bo mép; `peaked` mũ kê-pi: băng quanh chân, chóp loe đỉnh phẳng, lưỡi trai, quai, huy hiệu */
  shape: z.enum(HAT_SHAPES).default("drum"),
  /** Vĩ độ miệng mũ ở giữa trán; bỏ trống theo `HAT_SHAPE_DEFAULTS` của dáng */
  front: z.number().optional(),
  /** Vĩ độ miệng mũ ở gáy */
  back: z.number().optional(),
  /** Thân mũ cao bấy nhiêu tính từ miệng; thấp hơn tóc dưới nó thì nâng cho trùm hết */
  height: z.number().optional(),
  /** Khoảng hở giữa thân mũ và vỏ tóc (hay sọ); âm là ôm chặt hơn */
  ease: z.number().default(0.03),
  /** Bán kính bo mép đỉnh */
  round: z.number().optional(),
  /** `drum`: miệng mũ nở ra bấy nhiêu phần bán kính thân; `peaked`: chóp nở rộng hơn băng bấy nhiêu phần ở đỉnh */
  flare: z.number().optional(),
  /** Nếp gấp ngang: các độ cao, phần chiều cao thân */
  folds: z.array(z.number()).optional(),
  /** `peaked`: băng quanh chân mũ cao bấy nhiêu tính từ miệng */
  band: z.number().default(0.24),
  /** `peaked`: màu băng, cũng là màu đế huy hiệu */
  bandColor: z.string().default("#16171b"),
  /** `peaked`: lưỡi trai chìa ra trước miệng mũ bấy nhiêu ở giữa trán; `0` là không có */
  brim: z.number().default(0.5),
  /** `peaked`: lưỡi trai chúc xuống bấy nhiêu độ so với miệng mũ */
  droop: z.number().default(24),
  brimColor: z.string().default("#101114"),
  /** `peaked`: bản dây quai ngang trán trên lưỡi trai; `0` là không có */
  strap: z.number().default(0.055),
  strapColor: z.string().default("#222327"),
  /** `peaked`: bán kính huy hiệu trên trán, chỗ chóp gặp băng; `0` là không có */
  badge: z.number().default(0.13),
  /** `peaked`: màu huy hiệu và hai nút ở đầu dây quai */
  badgeColor: z.string().default("#d8aa3c"),
});

/** Số đo theo dáng mũ khi JSON bỏ trống. docs/12-trang-phuc-3d.md#mũ-dựng-khối */
export const HAT_SHAPE_DEFAULTS: Record<
  HatShape,
  { front: number; back: number; height: number; round: number; flare: number; folds: number[] }
> = {
  drum: { front: 32, back: 18, height: 0.62, round: 0.12, flare: 0, folds: [0.32] },
  peaked: { front: 24, back: 14, height: 0.66, round: 0.05, flare: 0.24, folds: [] },
};

/**
 * Trâm cài búi: que mảnh xuyên qua khối buộc của tóc dựng khối (búi, đuôi ngựa), một hạt ở đầu que.
 * docs/12-trang-phuc-3d.md#trâm-cài-búi
 */
export const PinSchema = z.object({
  /** Hướng đầu có hạt trên mặt búi, độ: `0` ngang về `+x`, `90` thẳng lên, `180` ngang về `−x` */
  angle: z.number().default(40),
  /** Đầu có hạt chếch ra khỏi mặt búi bấy nhiêu độ */
  lean: z.number().default(15),
  /** Dài cả que, lần bán kính sọ */
  length: z.number().default(0.95),
  /** Phần que nằm phía hạt, tính từ chỗ xuyên */
  reach: z.number().default(0.6),
  /** Bán kính que */
  thick: z.number().default(0.02),
  /** Bán kính hạt */
  bead: z.number().default(0.065),
});

/**
 * Thân áo dựng khối: áo là các đặc điểm trên một khối thân lồi, chiếu theo góc nhìn. Số đo bằng
 * px; trường bỏ trống lấy số của kiểu ở `GARMENT_STYLES`. docs/12-trang-phuc-3d.md#thân-áo-dựng-khối
 */
export const GARMENT_STYLE_NAMES = [
  "bare",
  "tshirt",
  "shirt",
  "polo",
  "sweater",
  "suit",
  "hoodie",
  "blouse",
  "blazer",
  "cardigan",
  "bowShirt",
  "squareNeck",
  "wrap",
] as const;

export const OBI_KNOTS = ["none", "taiko", "kai", "bunko"] as const;

/** Đai ngang thân áo cổ chéo. docs/12-trang-phuc-3d.md#áo-cổ-chéo */
export const ObiSchema = z.object({
  /** Bỏ trống là màu nhấn `torso.accent` */
  color: z.string().optional(),
  /** Tâm đai cao hơn hông bấy nhiêu px, nhân `rig.height` */
  y: z.number().default(52),
  /** Bản rộng, nhân `rig.height` */
  width: z.number().default(30),
  /** Đai nổi khỏi thân áo bấy nhiêu px */
  lift: z.number().default(4),
  /** Dây buộc đai quanh giữa bản đai dày bấy nhiêu px; `0` là không có */
  cord: z.number().default(0),
  /** Bỏ trống là màu đai */
  cordColor: z.string().optional(),
  /** Khoá đai trên dây trước bụng rộng bấy nhiêu px; `0` là không có */
  clasp: z.number().default(0),
  claspColor: z.string().optional(),
  /** Nút sau lưng: `taiko` khối hộp dẹt, `kai` nút dẹt nhỏ chếch lệch một bên, `bunko` nơ hai cánh */
  knot: z.enum(OBI_KNOTS).default("none"),
  knotColor: z.string().optional(),
  /** Tâm nút lệch khỏi giữa lưng bấy nhiêu px về `+x` (bên trái người mặc); bỏ trống là `0`, `kai` thì lệch sẵn */
  knotX: z.number().optional(),
});

/** Hai vạt mở của áo khoác kiểu `wrap`. docs/12-trang-phuc-3d.md#áo-khoác-vạt-mở */
export const OpenSchema = z.object({
  /** Khe giữa hai mép vạt chỗ buông thẳng rộng bấy nhiêu px */
  gap: z.number().default(12),
  /** Áo trong cổ chéo: hai mép cổ áo trong giao nhau thấp hơn chỗ viền cổ chạm mặt vát bấy nhiêu px; `0` là áo trong cổ tròn */
  cross: z.number().default(0),
  /** Dây buộc trước ngực dày bấy nhiêu px; `0` là không có */
  tie: z.number().default(0),
  /** Dây buộc cao hơn hông bấy nhiêu px, nhân `rig.height` */
  tieY: z.number().default(80),
  tieColor: z.string().default("#f6efe4"),
});

export const PRINT_FONTS = ["serif", "sans"] as const;

/** Chữ dọc trên dải cổ. docs/12-trang-phuc-3d.md#chữ-trên-dải-cổ */
export const LettersSchema = z.object({
  /** Chuỗi chữ trên dải cổ bên trái người mặc (`+x`) */
  left: z.string().default(""),
  /** Bên phải người mặc; áo cổ chéo khép thì bỏ qua (dải ấy khuất dưới vạt trên) */
  right: z.string().default(""),
  color: z.string().default("#ffffff"),
  /** Cỡ chữ, px; bỏ trống là `0.8` bản dải cổ */
  size: z.number().optional(),
  /** Tâm chuỗi chữ cao hơn hông bấy nhiêu px, nhân `rig.height` */
  y: z.number().default(66),
  font: z.enum(PRINT_FONTS).default("serif"),
});

/** Cổ chéo, dải cổ và đai của kiểu `wrap`. docs/12-trang-phuc-3d.md#áo-cổ-chéo */
export const WrapSchema = z.object({
  /** Mép vạt trên chạy xuống gấu lệch sang bên phải người mặc nhiều nhất bấy nhiêu px */
  overlap: z.number().default(22),
  /** Dải cổ rộng bấy nhiêu px dọc mép vạt và quanh gáy */
  band: z.number().default(6),
  /** Bỏ trống là màu áo */
  bandColor: z.string().optional(),
  /** Cổ lót lộ một dải bấy nhiêu px phía trong dải cổ; `0` là không có */
  under: z.number().default(0),
  underColor: z.string().default("#f6efe4"),
  /** Bỏ trống là không đai */
  obi: ObiSchema.optional(),
  /** Có thì hai vạt không chéo nhau mà buông thẳng chừa khe giữa: áo khoác 法被, 羽織 */
  open: OpenSchema.optional(),
  letters: LettersSchema.optional(),
});

export const PRINT_SHAPE_NAMES = ["maple", "circle", "ring", "diamond"] as const;

/** Hình in trên thân áo dựng khối: chữ, hình có tên hay path SVG. docs/12-trang-phuc-3d.md#hình-in-trên-áo */
export const PrintSchema = z.object({
  side: z.enum(["back", "front"]).default("back"),
  /** Tâm lệch khỏi giữa thân bấy nhiêu px về `+x` (bên trái người mặc) */
  x: z.number().default(0),
  /** Tâm cao hơn hông bấy nhiêu px, nhân `rig.height` */
  y: z.number().default(72),
  /** Cạnh hình vuông của hình, hay cỡ một chữ, px */
  size: z.number().default(40),
  color: z.string().default("#fff8ec"),
  /** Chữ in; có thì bỏ qua `path` và `shape` */
  text: z.string().optional(),
  font: z.enum(PRINT_FONTS).default("serif"),
  /** Chữ xếp dọc từ trên xuống; `false` là một dòng ngang */
  vertical: z.boolean().default(true),
  /** Path SVG trong hộp `0…100` (`y` xuống), tô theo luật evenodd; có thì bỏ qua `shape` */
  path: z.string().optional(),
  shape: z.enum(PRINT_SHAPE_NAMES).default("circle"),
  /** Xoay theo chiều kim đồng hồ khi nhìn thẳng vào hình, độ */
  rotate: z.number().default(0),
});

/** Thẻ tên dán ngực thân áo dựng khối. docs/12-trang-phuc-3d.md#thẻ-tên */
export const BadgeSchema = z.object({
  /** Tâm lệch khỏi giữa ngực bấy nhiêu px về `+x` (ngực trái người mặc) */
  x: z.number().default(19),
  /** Tâm cao hơn hông bấy nhiêu px, nhân `rig.height` */
  y: z.number().default(86),
  width: z.number().default(12),
  height: z.number().default(6),
  round: z.number().default(1.2),
  /** Thẻ nổi khỏi mặt khối bấy nhiêu px; dán lên dải cổ thì nâng quá độ nổi của dải */
  lift: z.number().default(0.8),
  color: z.string().default("#fff8ec"),
  /** Màu viền in quanh mép mặt thẻ */
  edge: z.string().default("#3a2a22"),
  text: z.string().default(""),
  textColor: z.string().default("#1c1c1e"),
  /** Dấu lá non 若葉マーク ở đầu trái mặt thẻ */
  wakaba: z.boolean().default(false),
});

/** Màu tô trên thân áo dựng khối: màu áo, màu nét, màu nhấn, màu da hay một mã màu */
export const MarkFillSchema = z.union([
  z.enum(["color", "line", "accent", "skin"]),
  z
    .string()
    .regex(
      /^#[0-9a-fA-F]{3,8}$/,
      "màu tô là color, line, accent, skin hay mã màu #rrggbb",
    ) as unknown as z.ZodType<`#${string}`>,
]);

export const PATTERN_KINDS = ["stripes", "check", "dots"] as const;

/** Hoạ tiết lặp trên một mảng áo. docs/12-trang-phuc-3d.md#mảng-áo-và-hoạ-tiết */
export const PatternSchema = z.object({
  /** `stripes` sọc, `check` kẻ ô (sọc hai chiều vuông góc), `dots` chấm bi */
  kind: z.enum(PATTERN_KINDS).default("stripes"),
  color: MarkFillSchema.default("#ffffff"),
  /** Bề rộng sọc, hay đường kính chấm, px */
  width: z.number().positive().default(6),
  /** Khoảng trống giữa hai sọc, hai chấm, px */
  gap: z.number().min(0).default(6),
  /** `0` sọc ngang, `90` sọc dọc; dương là đầu phải của sọc ngóc lên khi nhìn thẳng, độ */
  angle: z.number().default(0),
  /** Dời cả hoạ tiết theo pháp tuyến của sọc bấy nhiêu px */
  offset: z.number().default(0),
  /** Kẻ ô: màu ô hai sọc chéo nhau; bỏ trống là `color` */
  cross: MarkFillSchema.optional(),
});

export const PANEL_SIDES = ["front", "back", "both", "around"] as const;

/** Mảng màu kín trên thân áo dựng khối, có viền và hoạ tiết tuỳ chọn. docs/12-trang-phuc-3d.md#mảng-áo-và-hoạ-tiết */
export const PanelSchema = z.object({
  /** Màu nền của mảng; bỏ trống là không tô, chỉ hoạ tiết và viền */
  fill: MarkFillSchema.optional(),
  /** `front` mặt trước, `back` mặt sau, `both` cả hai (cùng `pts`), `around` quanh khối: `x` của `pts` là kinh độ, độ */
  side: z.enum(PANEL_SIDES).default("front"),
  /** Đỉnh polygon `[x, y]`: `x` px cách trục về `+x` (bên trái người mặc), `y` theo `from`; bỏ trống cùng `path` là cả thân */
  pts: z
    .array(z.tuple([z.number(), z.number()]))
    .min(3)
    .optional(),
  /** Path SVG trong hộp `0…100` (`y` xuống) chiếu lên mặt khối như `prints`, tâm `x`, `y`; có thì bỏ qua `pts` */
  path: z
    .string()
    .regex(/^[\sMLHVCQZmlhvcqz\d.,eE+-]*$/, "path chỉ nhận lệnh M L H V C Q Z")
    .optional(),
  x: z.number().default(0),
  y: z.number().default(0),
  size: z.number().positive().default(40),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  rotate: z.number().default(0),
  /** `y` đo từ đâu: `hip` cao hơn hông bấy nhiêu px nhân `rig.height`, `neck` thấp hơn chỗ viền cổ chạm mặt vát bấy nhiêu px */
  from: z.enum(["hip", "neck"]).default("hip"),
  /** Thêm bản lật qua trục giữa: một mảng cho cả hai bên người */
  mirror: z.boolean().default(false),
  /** `neck` chỉ giữ phần trong miệng cổ (trên viền cổ), `body` chỉ giữ phần dưới viền cổ */
  clip: z.enum(["none", "neck", "body"]).default("none"),
  /** Nét viền, lần nét thân; `0` là không viền. Viền không chạy dọc mép khối (mép trên, gấu, sườn của mặt trước/sau) */
  line: z.number().min(0).default(0),
  pattern: PatternSchema.optional(),
  /** `under` dưới đặc điểm của kiểu (áo trong, cà vạt), `over` trên */
  layer: z.enum(["under", "over"]).default("over"),
});

/** Cà vạt trong miệng cổ chữ V, cắt theo chữ V như luồn dưới vạt */
export const TieSchema = z.object({
  /** Bỏ trống là màu nét */
  color: MarkFillSchema.optional(),
  /** Nhân bề ngang */
  width: z.number().positive().default(1),
  /** Mũi cà vạt thấp hơn chỗ viền cổ chạm mặt vát bấy nhiêu px; phần dưới đáy chữ V khuất dưới vạt */
  length: z.number().default(102),
  /** Nét viền, lần nét thân */
  line: z.number().min(0).default(0),
});

/** Áo trong lộ ở miệng cổ chữ V của `blazer`, `cardigan`, `suit`. docs/12-trang-phuc-3d.md#áo-trong-và-cà-vạt */
export const InnerSchema = z.object({
  /** Màu áo trong; bỏ trống là `accent` (blazer, cardigan) hay không có (suit) */
  color: MarkFillSchema.optional(),
  /** Nét viền áo trong, lần nét thân */
  line: z.number().min(0).default(0),
  /** Cà vạt; `false` bỏ cà vạt của `suit` */
  tie: z.union([z.literal(false), TieSchema]).optional(),
});

/** Khăn vắt vai của người 3D (`pieces.neck.drape`): dải phẳng vắt qua một vai, khối cứng bám thân. docs/12-trang-phuc-3d.md#khăn-vắt-vai */
export const DrapeSchema = z.object({
  /** Vai vắt khăn: `left` vai trái người mặc (`+x` hệ thân), `right` vai phải */
  side: z.enum(["left", "right"]).default("left"),
  /** Bản rộng, px */
  width: z.number().default(16),
  /** Dài phía trước ngực, phía sau lưng tính từ đỉnh vai, px dọc khăn, nhân `rig.height` */
  front: z.number().default(70),
  back: z.number().default(60),
  /** Dày, px */
  thick: z.number().default(2.5),
  /** Tâm khăn trên vai: `0` sát cổ áo, `1` ở gốc tay */
  at: z.number().min(0).max(1).default(0.5),
});

/** Kính râm gài nẹp áo của người 3D (`pieces.neck.shades`): treo dưới đáy cổ áo bằng một gọng. docs/12-trang-phuc-3d.md#kính-gài-nẹp */
export const ShadesSchema = z.object({
  /** `rect` mắt chữ nhật bo góc, `round` mắt tròn */
  shape: z.enum(["rect", "round"]).default("rect"),
  /** Nửa chiều cao mắt kính, px */
  size: z.number().default(7),
  /** Mép trên mắt kính thấp hơn đáy cổ áo bấy nhiêu px */
  y: z.number().default(6),
  /** Gọng gài ở bên `left` (`+x` hệ thân, trái người mặc) hay `right`; kính nghiêng xuống phía kia */
  side: z.enum(["left", "right"]).default("left"),
  /** Nghiêng, độ */
  tilt: z.number().default(14),
  /** Màu mắt kính; gọng và nét màu mực */
  lens: z.string().default("#2a2b33"),
});

/** Dây chuyền của người 3D (`pieces.neck.necklace`): vòng quanh chân cổ, võng trước ngực, bám mặt thân. docs/12-trang-phuc-3d.md#dây-chuyền */
export const NecklaceSchema = z.object({
  /** `chain` dây mảnh liền, `pearl` chuỗi hạt tròn nối nhau */
  style: z.enum(["chain", "pearl"]).default("chain"),
  /** Màu dây hay màu hạt; bỏ trống là vàng (`chain`), trắng ngà (`pearl`) */
  color: z.string().optional(),
  /** Chỗ thấp nhất giữa ngực thấp hơn chân cổ bấy nhiêu px */
  drop: z.number().default(20),
  /** Bán kính dây (`chain`) hay bán kính hạt (`pearl`), px; bỏ trống là `0.75` / `1.9` */
  thick: z.number().optional(),
  /** Mặt dây ở chỗ thấp nhất: `none` không có, `round` hạt tròn dẹt, `drop` giọt nước */
  pendant: z.enum(["none", "round", "drop"]).default("round"),
  /** Bán kính mặt dây, px */
  size: z.number().default(3.6),
  /** Màu mặt dây; bỏ trống là màu dây */
  gem: z.string().optional(),
});

/** Bông tai của người 3D (`pieces.headAcc.earrings`): một cặp ở dái tai. docs/12-trang-phuc-3d.md#bông-tai */
export const EarringsSchema = z.object({
  /** `stud` nụ, `hoop` vòng tròn, `drop` dài thả có viên ở đáy */
  shape: z.enum(["stud", "hoop", "drop"]).default("stud"),
  /** Màu kim loại */
  color: z.string().default("#d9b44a"),
  /** Màu viên (nụ, viên ở đáy bông dài); bỏ trống là màu kim loại */
  gem: z.string().optional(),
  /** Bán kính nụ, bán kính vòng, bán kính viên ở đáy; lần bán kính sọ. Bỏ trống: `0.06` / `0.15` / `0.07` */
  size: z.number().optional(),
  /** Bông dài: từ lỗ xỏ tới đáy viên, lần bán kính sọ */
  length: z.number().default(0.36),
  /** Bán kính sợi kim loại, lần bán kính sọ */
  thick: z.number().default(0.014),
});

export const GarmentSchema = z.object({
  /** Kiểu áo trong `GARMENT_STYLES`: `bare` ngực trần, `tshirt` áo phông cổ tròn, `shirt` sơ mi, `polo`, `sweater` áo len, `suit` vest, `hoodie`, `blouse` cổ lá sen, `wrap` cổ chéo */
  style: z.enum(GARMENT_STYLE_NAMES).default("tshirt"),
  /** Vải rộng hơn thân bấy nhiêu, mỗi bên */
  ease: z.number().optional(),
  /** Độ suông `0…1`: gấu rộng bằng hông ở `0`, bằng vai ở `1` */
  fit: z.number().optional(),
  /** Eo co vào bấy nhiêu mỗi bên, sâu nhất giữa vành vai và gấu */
  waist: z.number().optional(),
  /** Gấu thấp hơn hông bấy nhiêu */
  hem: z.number().optional(),
  /** Mép trên của khối cao hơn khớp cổ bấy nhiêu; âm là thấp hơn */
  rise: z.number().optional(),
  /** Nửa rộng miệng cổ áo */
  neck: z.number().optional(),
  /** Cổ áo phía trước, phía sau thấp hơn chỗ chạm hai bên bấy nhiêu, đo trên mặt khối; âm là cao hơn */
  neckFront: z.number().optional(),
  neckBack: z.number().optional(),
  /** Vát vai hạ bấy nhiêu px mỗi px ra ngang */
  slope: z.number().optional(),
  /** Như `slope` cho nhân vật `palette.clad`: vai thoải hơn để tay to buông thẳng */
  cladSlope: z.number().optional(),
  /** Bán kính bo góc giữa vát vai và thân */
  round: z.number().optional(),
  /** Bán kính bo góc gấu */
  hemRound: z.number().optional(),
  /** Đè dáng viền cổ trước của kiểu: `round` chữ U, `v` chữ V, `square` cổ vuông */
  neckline: z.enum(["round", "v", "square"]).optional(),
  /** `false` bỏ đặc điểm dán của kiểu (nét, chấm, mảng); cổ bẻ, viền gân, mũ trùm, cổ chéo vẫn dựng */
  marks: z.boolean().optional(),
  /** Mảng màu kín, hoạ tiết, chỗ khoét lộ da (`fill: "skin"`); chỉ người 3D. docs/12-trang-phuc-3d.md#mảng-áo-và-hoạ-tiết */
  panels: z.array(PanelSchema).optional(),
  /** Áo trong và cà vạt ở miệng cổ chữ V của `blazer`, `cardigan`, `suit` */
  inner: InnerSchema.optional(),
  /** Kiểu `wrap`: cổ chéo, dải cổ, đai; kiểu khác bỏ qua */
  wrap: WrapSchema.optional(),
  /** Hình in trên mặt khối, chỉ người 3D */
  prints: z.array(PrintSchema).optional(),
  /** Thẻ tên dán ngực, chỉ người 3D */
  badge: BadgeSchema.optional(),
  /** Lá cổ bẻ dựng lên ôm gáy, `0..1`: `0` gập xuống, `1` dựng hẳn; chỉ người 3D. docs/12-trang-phuc-3d.md#cổ-dựng */
  collarUp: z.number().min(0).max(1).optional(),
  /** Bụng phệ: thân nhô ra trước nhiều nhất bấy nhiêu px ở bụng, ra hai bên ít hơn; chỉ người 3D nhô ra trước. docs/12-trang-phuc-3d.md#bụng-phệ */
  belly: z.number().min(0).optional(),
  /** Bụng phệ ra hai bên bấy nhiêu lần `belly`; bỏ trống là `BELLY.side` (`0.45`), `0` là chỉ nhô ra trước. docs/12-trang-phuc-3d.md#bụng-phệ */
  bellySide: z.number().min(0).optional(),
  /** Ngực nở: nửa trước phồng thêm nhiều nhất bấy nhiêu px ở ngang ngực, liền một khối; chỉ người 3D. docs/12-trang-phuc-3d.md#ngực-nở */
  bust: z.number().min(0).optional(),
});

/**
 * Tay áo, quần, giày đi theo thân áo này, đè `palette` của nhân vật khi thân áo ấy đang mặc — áo thay qua `items`
 * (đồ Tây sang yukata) đổi luôn màu và độ dài tay áo, ống quần. Chỉ người 3D đọc. docs/01-rig.md#đồ-thay-được-items-và-equip
 */
export const PiecePaletteSchema = z.object({
  sleeve: z.string().optional(),
  sleeveLength: z.number().min(0).max(1).optional(),
  sleeveFlare: z.number().min(0).optional(),
  trouser: z.string().optional(),
  trouserLength: z.number().min(0).max(1).optional(),
  shoe: z.string().optional(),
});

export const SKIRT_STYLES = ["cone", "wrap", "apron"] as const;

/** Vạt dài quấn (`skirt.style: "wrap"`). docs/12-trang-phuc-3d.md#vạt-dài-quấn */
export const WrapHemSchema = z.object({
  /** Mép vạt trên ở cạp lệch sang bên phải người mặc bấy nhiêu px */
  overlap: z.number().default(22),
  /** Tới gấu mép vạt lệch thêm bấy nhiêu px về bên phải người mặc */
  slant: z.number().default(6),
});

/** Tạp dề (`skirt.style: "apron"`). docs/12-trang-phuc-3d.md#tạp-dề */
export const ApronSchema = z.object({
  /** Nửa rộng tấm */
  width: z.number().default(38),
  /** Dây cạp dày bấy nhiêu px; `0` là không có */
  band: z.number().default(5),
  /** Màu dây cạp và nơ; bỏ trống là màu tấm */
  tieColor: z.string().optional(),
  /** Mỗi cánh nơ sau lưng dài bấy nhiêu px; `0` là không có nơ */
  bow: z.number().default(13),
});

/** Váy dựng khối: nón cụt treo ở hông, chiếu theo góc của thân. docs/12-trang-phuc-3d.md#váy-dựng-khối */
export const SkirtSchema = z.object({
  /** Bỏ trống là `cone` nón cụt trong nhóm thân; `wrap` vạt dài quấn và `apron` tạp dề treo ở hông, chỉ người 3D dựng */
  style: z.enum(SKIRT_STYLES).optional(),
  /** Cạp cao hơn hông bấy nhiêu, nhân `rig.height` */
  rise: z.number().default(27),
  /** Nửa rộng cạp */
  waist: z.number().default(40),
  /** Gấu thấp hơn cạp bấy nhiêu khi đùi buông thẳng, nhân `rig.height` */
  length: z.number().default(52),
  /** Gấu rộng hơn cạp bấy nhiêu mỗi bên; âm là gấu hẹp hơn cạp (váy bút chì), không hẹp hơn hai đùi */
  flare: z.number().default(12),
  /** Số nếp quanh khối; `0` là trơn */
  pleats: z.number().default(8),
  /** Kiểu `wrap`: mép vạt trên; kiểu khác bỏ qua */
  wrap: WrapHemSchema.optional(),
  /** Kiểu `apron`: tấm, dây cạp, nơ; kiểu khác bỏ qua */
  apron: ApronSchema.optional(),
});

/** Khai trước `CharacterSchema` vì `items` cần tới; `PIECE_KEYS` bên dưới kiểm lại cho khớp. */
const PIECE_KEY_NAMES = [
  "torso",
  "neck",
  "hair",
  "crown",
  "headAcc",
  "faceAcc",
  "hem",
  "handRight",
  "handLeft",
] as const;

/**
 * Config của một socket bất kỳ: hợp mọi trường mà các socket dùng tới. Một vật cắm được
 * vào nhiều socket nên không biết trước mình cần trường nào; socket bỏ qua trường thừa.
 */
export const SocketPieceSchema = piece.extend({
  src: z.enum(["none", "sculpt"]).default("none"),
  glasses: GlassesSchema.optional(),
  hat: HatSchema.optional(),
  pin: PinSchema.optional(),
  drape: DrapeSchema.optional(),
  shades: ShadesSchema.optional(),
  necklace: NecklaceSchema.optional(),
  earrings: EarringsSchema.optional(),
  garment: GarmentSchema.optional(),
  palette: PiecePaletteSchema.optional(),
  skirt: SkirtSchema.optional(),
});

/** Một vật thay được: config ở từng socket nó cắm được. Mỗi lúc chỉ một socket giữ nó. */
export const ItemSchema = z.partialRecord(z.enum(PIECE_KEY_NAMES), SocketPieceSchema);

/** Tên vật chiếm socket; `null` là socket trống, `BASE_ITEM` là trả về mảnh nền trong `pieces`. */
export const EquipMapSchema = z.partialRecord(z.enum(PIECE_KEY_NAMES), z.string().nullable());
/** Một bước: tên bộ đồ trong `outfits`, hoặc thẳng một map socket → vật */
const EquipStepSchema = z.union([z.string(), EquipMapSchema]);
export const EquipSchema = z.union([EquipStepSchema, z.array(EquipStepSchema)]);

/** Giá trị `equip` đưa socket về mảnh nền trong `pieces`. */
export const BASE_ITEM = "base";

const rest = (k: keyof typeof FACE_REST) =>
  z.number().min(FACE_REST[k].min).max(FACE_REST[k].max).default(FACE_REST[k].def);

export const CharacterSchema = z.object({
  schemaVersion: z
    .literal(CHARACTER_VERSION, {
      error: "JSON nhân vật thuộc phiên bản schema khác; cần bản @stickman3d/rig khớp với nó",
    })
    .default(CHARACTER_VERSION),
  name: z.string().default("common"),
  rig: z
    .object({
      stroke: z.number().default(6),
      /** Nhân vào mọi đoạn thân/tay/chân; đầu giữ nguyên */
      height: z.number().default(1),
      /** Nửa khoảng cách hai khớp vai */
      shoulderHalf: z.number().default(40),
      /** Khớp vai tụt xuống dưới đỉnh thân bấy nhiêu */
      shoulderDrop: z.number().default(20),
      hipHalf: z.number().default(22),
    })
    .prefault({}),
  head: z
    .object({
      scaleX: z.number().default(1),
      scaleY: z.number().default(1),
      /** Dáng khối đầu: `human` có quai hàm, cằm, tai, mũi. docs/01-rig.md#người-3d-mặc-đồ */
      form: z.enum(["sphere", "human"]).default("sphere"),
    })
    .prefault({}),
  palette: z
    .object({
      line: z.string().default(INK),
      skin: z.string().default("#f0d9b8"),
      garment: z.string().default("#5b6ea8"),
      sleeve: z.string().default("#1a1a1a"),
      trouser: z.string().default("#1a1a1a"),
      /** Bề dày tay, chân; bỏ trống thì theo `clad`: `limbWidths` */
      sleeveWidth: z.number().optional(),
      /** Tay áo người 3D `clad` loe: miệng tay rộng hơn cổ tay bấy nhiêu px (bán kính), rộng dần từ vai; bàn tay giữ cỡ theo `sleeveWidth`. docs/01-rig.md#người-3d-mặc-đồ */
      sleeveFlare: z.number().min(0).default(0),
      trouserWidth: z.number().optional(),
      clad: z.boolean().default(false),
      /** Phần tay phủ màu `sleeve` từ vai, `0..1`; người 3D `clad` đọc, phần còn lại màu da */
      sleeveLength: z.number().min(0).max(1).default(1),
      /** Phần chân phủ màu `trouser` từ hông, `0..1`; người 3D `clad` đọc, phần còn lại màu da */
      trouserLength: z.number().min(0).max(1).default(1),
      /** Gốc cánh tay của người 3D `clad` to thêm bấy nhiêu phần: vai, bắp tay lồi khỏi sườn áo; nam vạm vỡ quanh `0,7` */
      bicep: z.number().min(0).max(1).default(0),
      /** Màu giày của người 3D `clad` */
      shoe: z.string().default("#2b2623"),
      /** Độ cong nét chi `0..1`; `0` là hai đoạn thẳng gãy ở khuỷu, gối. docs/01-rig.md#vẽ-chi */
      limbCurve: z.number().min(0).max(1).default(1),
    })
    .prefault({}),
  face: z
    .object({
      offsetY: z.number().default(0),
      eyeGap: z.number().default(26),
      mouthGap: z.number().default(34),
      /** Má ửng `0..1` của người 3D, màu suy từ `palette.skin` (`blushColor`); `0` tắt */
      blush: z.number().min(0).max(1).default(0),
      /** Nét mặt nghỉ riêng của nhân vật, mặc định và khoảng ở `FACE_REST`. docs/01-rig.md#nét-mặt-riêng */
      eyeScale: rest("eyeScale"),
      eyeWidth: rest("eyeWidth"),
      lid: rest("lid"),
      shine: rest("shine"),
      browWidth: rest("browWidth"),
      browTilt: rest("browTilt"),
      wrinkle: z
        .object({
          kind: z.enum(["none", "light", "deep"]).default("none"),
          color: z.string().default("#9c8367"),
          width: z.number().default(1),
          /** Dịch cả cụm lên xuống; mỗi ảnh đầu một tỉ lệ trán khác nhau */
          dy: z.number().default(0),
        })
        .prefault({}),
    })
    .prefault({}),
  pieces: z
    .object({
      /** `sculpt` là thân áo dựng khối, số đo ở `garment` */
      torso: piece
        .extend({
          src: z.enum(["none", "sculpt"]).default("none"),
          garment: GarmentSchema.optional(),
          /** Tay áo, quần, giày của bộ áo này, đè `palette`; chỉ người 3D */
          palette: PiecePaletteSchema.optional(),
        })
        .prefault({}),
      /** Khăn quàng, cà vạt, yếm; `sculpt` là khăn vắt vai (`drape`), kính gài nẹp (`shades`) và dây chuyền (`necklace`) của người 3D */
      neck: piece
        .extend({
          src: z.enum(["none", "sculpt"]).default("none"),
          drape: DrapeSchema.optional(),
          shades: ShadesSchema.optional(),
          necklace: NecklaceSchema.optional(),
        })
        .prefault({}),
      hair: piece
        .extend({
          src: z.enum(["none", "sculpt"]).default("none"),
          sculpt: SculptSchema.optional(),
        })
        .prefault({}),
      /** Mũ; `sculpt` là mũ dựng khối của người 3D, số đo ở `hat` */
      crown: piece
        .extend({
          src: z.enum(["none", "sculpt"]).default("none"),
          hat: HatSchema.optional(),
        })
        .prefault({}),
      /** Phụ kiện đội trên mũ / bám sọ: sừng, tai, vòng hoa — đứng yên khi lắc đầu; `sculpt` là trâm cài búi (`pin`) và bông tai (`earrings`) của người 3D */
      headAcc: piece
        .extend({
          src: z.enum(["none", "sculpt"]).default("none"),
          pin: PinSchema.optional(),
          earrings: EarringsSchema.optional(),
        })
        .prefault({}),
      /** Phụ kiện dán lên mặt: kính, sẹo, mặt nạ — trôi đúng bằng nét mặt; `sculpt` là kính dựng khối */
      faceAcc: piece
        .extend({
          src: z.enum(["none", "sculpt"]).default("none"),
          glasses: GlassesSchema.optional(),
        })
        .prefault({}),
      /** `sculpt` là váy dựng khối, số đo ở `skirt` */
      hem: piece
        .extend({
          src: z.enum(["none", "sculpt"]).default("none"),
          skirt: SkirtSchema.optional(),
        })
        .prefault({}),
      handRight: piece.prefault({}),
      handLeft: piece.prefault({}),
    })
    .prefault({}),
  /** Vật thay được — rìu, áo giáp, kính. Scene và hành động gọi tên ở đây qua `equip`. docs/01-rig.md */
  items: z.record(z.string(), ItemSchema).default({}),
  /** Bộ đồ: một tên trải ra nhiều socket. Chỉ là cách viết gọn của một bước `equip` */
  outfits: z.record(z.string(), EquipMapSchema).default({}),
});

export type CharacterData = z.infer<typeof CharacterSchema>;
export type PieceKey = keyof CharacterData["pieces"];
export const PIECE_KEYS = PIECE_KEY_NAMES satisfies readonly PieceKey[];

export type Sculpt = z.infer<typeof SculptSchema>;
export type Glasses = z.infer<typeof GlassesSchema>;
export type Hat = z.infer<typeof HatSchema>;
export type Pin = z.infer<typeof PinSchema>;
export type Drape = z.infer<typeof DrapeSchema>;
export type Shades = z.infer<typeof ShadesSchema>;
export type Necklace = z.infer<typeof NecklaceSchema>;
export type Earrings = z.infer<typeof EarringsSchema>;
export type Garment = z.infer<typeof GarmentSchema>;
export type Wrap = z.infer<typeof WrapSchema>;
export type Open = z.infer<typeof OpenSchema>;
export type Letters = z.infer<typeof LettersSchema>;
export type Print = z.infer<typeof PrintSchema>;
export type PrintShape = (typeof PRINT_SHAPE_NAMES)[number];
export type PrintFont = (typeof PRINT_FONTS)[number];
export type Badge = z.infer<typeof BadgeSchema>;
export type Panel = z.infer<typeof PanelSchema>;
export type Pattern = z.infer<typeof PatternSchema>;
export type Inner = z.infer<typeof InnerSchema>;
export type Tie = z.infer<typeof TieSchema>;
export type Obi = z.infer<typeof ObiSchema>;
export type ObiKnot = (typeof OBI_KNOTS)[number];
export type Skirt = z.infer<typeof SkirtSchema>;
export type SkirtStyle = (typeof SKIRT_STYLES)[number];
export type WrapHem = z.infer<typeof WrapHemSchema>;
export type Apron = z.infer<typeof ApronSchema>;
export type GarmentStyle = (typeof GARMENT_STYLE_NAMES)[number];
export type GlassesShape = (typeof GLASSES_SHAPES)[number];
export type SculptStyle = (typeof SCULPT_STYLE_NAMES)[number];
export type PieceData = CharacterData["pieces"][PieceKey];
export type SocketPiece = z.infer<typeof SocketPieceSchema>;
export type ItemData = z.infer<typeof ItemSchema>;
export type EquipMap = z.infer<typeof EquipMapSchema>;
export type EquipStep = z.infer<typeof EquipStepSchema>;
export type Equip = z.infer<typeof EquipSchema>;

export const equipSteps = (e?: Equip): EquipStep[] =>
  e === undefined ? [] : Array.isArray(e) ? e : [e];

/**
 * Nối các bước theo thứ tự, bước sau đè bước trước ở đúng socket nó nhắc tới. Tên bộ đồ
 * giữ nguyên chỗ trong chuỗi: phải có JSON nhân vật mới trải ra socket được, mà scene
 * ghép `equip` thì chưa biết ai diễn.
 */
export function composeEquip(...parts: (Equip | undefined)[]): EquipStep[] {
  const out: EquipStep[] = [];
  for (const p of parts)
    for (const step of equipSteps(p)) {
      const last = out[out.length - 1];
      if (typeof step === "object" && typeof last === "object")
        out[out.length - 1] = { ...last, ...step };
      else out.push(step);
    }
  return out;
}

/** Socket → vật đang chiếm, đã trải bộ đồ. Thiếu khoá là mảnh nền, `null` là socket trống. */
export function equipMap(c: CharacterData, e?: Equip): EquipMap {
  const o: EquipMap = {};
  for (const step of equipSteps(e))
    Object.assign(o, typeof step === "string" ? (c.outfits[step] ?? {}) : step);
  return o;
}

/**
 * Mảnh thật của từng socket sau khi mặc. Vật lạ hoặc vật không khai socket ấy thì giữ
 * mảnh nền — `equipProblems` là chỗ báo, chứ giữa chừng phim không cởi đồ người ta ra.
 */
export function equipPieces(c: CharacterData, e?: Equip): CharacterData["pieces"] {
  const m = equipMap(c, e);
  const keys = Object.keys(m) as PieceKey[];
  if (!keys.length) return c.pieces;
  // `SocketPiece` có đủ trường của mọi socket nên gán vào socket nào cũng hợp lệ
  const out = { ...c.pieces } as Record<PieceKey, PieceData>;
  for (const k of keys) {
    const name = m[k];
    if (name === undefined || name === BASE_ITEM) continue;
    if (name === null) out[k] = { ...c.pieces[k], src: "none" };
    else out[k] = (c.items[name]?.[k] as PieceData | undefined) ?? out[k];
  }
  return out as CharacterData["pieces"];
}

/** Nhân vật với `pieces` đã mặc xong; mọi chỗ vẽ và mọi công thức hình học đi qua bản này. */
/** `palette` của nhân vật cộng phần thân áo đang mặc đè lên (`pieces.torso.palette`): tay áo, quần, giày người 3D vẽ */
export const wornPalette = <P extends object>(c: {
  palette: P;
  pieces: { torso: { palette?: Partial<P> } };
}): P => {
  const o = c.pieces.torso.palette;
  if (!o) return c.palette;
  const out = { ...c.palette };
  for (const [k, v] of Object.entries(o))
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
};

export const equipCharacter = (c: CharacterData, e?: Equip): CharacterData => {
  const pieces = equipPieces(c, e);
  return pieces === c.pieces ? c : { ...c, pieces };
};

/** Tên vật / bộ đồ mà `equip` gọi tới mà nhân vật không có. Rỗng là sạch. */
export function equipProblems(c: CharacterData, e?: Equip): string[] {
  const bad: string[] = [];
  for (const step of equipSteps(e)) {
    if (typeof step === "string") {
      if (!c.outfits[step]) bad.push(`không có bộ đồ \`${step}\``);
      continue;
    }
    for (const [k, name] of Object.entries(step))
      if (name !== null && name !== BASE_ITEM) {
        if (!c.items[name]) bad.push(`không có vật \`${name}\``);
        else if (!c.items[name][k as PieceKey]) bad.push(`vật \`${name}\` không cắm vào \`${k}\``);
      }
  }
  return bad;
}

/** Socket không còn trong `PIECE_KEYS`: JSON nhân vật, hành động và cảnh ở mọi đời bỏ nó lặng lẽ */
const GONE_SOCKETS = ["chin", "sleeveNear", "sleeveFar", "hairBack"];

/** Bỏ socket không còn khỏi một map socket → giá trị (`pieces`, một vật của `items`, bộ đồ) */
const dropGone = (map: unknown) => {
  if (map && typeof map === "object" && !Array.isArray(map))
    for (const k of GONE_SOCKETS) delete (map as Record<string, unknown>)[k];
};

/** Bỏ socket không còn khỏi một `equip` thô: tên bộ đồ, map hay mảng các bước */
export const dropGoneEquip = (e: unknown) => {
  for (const step of Array.isArray(e) ? e : [e]) dropGone(step);
};

/** Tên kênh tay chân, socket bàn tay đời cũ → tên theo phải / trái của người, cho `migrate*` */
export const SIDE_RENAMES: Readonly<Record<string, string>> = {
  armNear: "armRight",
  armFar: "armLeft",
  legNear: "legRight",
  legFar: "legLeft",
  handNear: "handRight",
  handFar: "handLeft",
};

/** Đổi khoá đời cũ của một map thô tại chỗ (`SIDE_RENAMES`), giữ thứ tự khoá */
export const renameSideKeys = (map: unknown) => {
  if (!map || typeof map !== "object" || Array.isArray(map)) return;
  const o = map as Record<string, unknown>;
  if (!Object.keys(o).some((k) => k in SIDE_RENAMES)) return;
  const entries = Object.entries(o);
  for (const k of Object.keys(o)) delete o[k];
  for (const [k, v] of entries) o[SIDE_RENAMES[k] ?? k] = v;
};

/** `renameSideKeys` cho một `equip` thô: tên bộ đồ, map hay mảng các bước */
export const renameSideEquip = (e: unknown) => {
  for (const step of Array.isArray(e) ? e : [e]) renameSideKeys(step);
};

/** Đổi tên kênh đời cũ trong một mảng thô (`mask`) */
export const renameSideList = (a: unknown): unknown =>
  Array.isArray(a) ? a.map((k) => (typeof k === "string" ? (SIDE_RENAMES[k] ?? k) : k)) : a;

/** Nâng JSON đời cũ lên `CHARACTER_VERSION`. File mới hơn thì trả nguyên để zod báo lỗi. */
export function migrateCharacter(json: unknown): unknown {
  if (!json || typeof json !== "object" || Array.isArray(json)) return json;
  const o = structuredClone(json) as Record<string, unknown>;
  const from = typeof o.schemaVersion === "number" ? o.schemaVersion : 0;
  if (from > CHARACTER_VERSION) return o;
  // v1 → v2 thêm `items` / `outfits`; thiếu thì nhân vật chỉ có mảnh nền, đúng như trước
  // v2 → v3 thêm `palette.limbCurve` và `palette.shade`; thiếu thì lấy mặc định, không phải viết gì
  // v5 → v6 chỉ còn `none` và `sculpt`: socket ảnh, bộ phận vẽ code thành trống; bỏ `face.turn`, `face.moustache`,
  // `head.shape`, `head.dx`, `head.dy`
  if (from < 6) {
    if (o.face && typeof o.face === "object")
      for (const k of ["turn", "moustache"]) delete (o.face as Record<string, unknown>)[k];
    if (o.head && typeof o.head === "object")
      for (const k of ["shape", "dx", "dy"]) delete (o.head as Record<string, unknown>)[k];
    const sockets = [
      o.pieces,
      ...Object.values((o.items ?? {}) as Record<string, unknown>),
    ] as Record<string, Record<string, unknown> | undefined>[];
    for (const group of sockets)
      for (const pc of Object.values(group ?? {}))
        if (pc && typeof pc === "object" && pc.src !== "sculpt") pc.src = "none";
  }
  // v6 → v7 socket bàn tay theo phải / trái của người: `handNear` → `handRight`, `handFar` → `handLeft`
  if (from < 7) {
    renameSideKeys(o.pieces);
    for (const group of [o.items, o.outfits])
      if (group && typeof group === "object") Object.values(group).forEach(renameSideKeys);
  }
  dropGone(o.pieces);
  for (const group of [o.items, o.outfits])
    if (group && typeof group === "object") Object.values(group).forEach(dropGone);
  o.schemaVersion = CHARACTER_VERSION;
  return o;
}

/** Bề dày tay, chân mặc định: nét que `10`, người `clad` dày như tay áo, ống quần */
export const LIMB_WIDTH = { stick: 10, clad: { sleeve: 15, trouser: 17 } } as const;

/** Bề dày tay, chân của `palette`: trường bỏ trống lấy `LIMB_WIDTH` theo `clad` */
export const limbWidths = (p: { clad?: boolean; sleeveWidth?: number; trouserWidth?: number }) => ({
  sleeve: p.sleeveWidth ?? (p.clad ? LIMB_WIDTH.clad.sleeve : LIMB_WIDTH.stick),
  trouser: p.trouserWidth ?? (p.clad ? LIMB_WIDTH.clad.trouser : LIMB_WIDTH.stick),
});

export const defaultCharacter = (): CharacterData => CharacterSchema.parse({});

export const parseCharacter = (json: unknown) => CharacterSchema.safeParse(migrateCharacter(json));

export { RIG };
