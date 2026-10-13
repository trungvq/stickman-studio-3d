import { z } from "zod";
import { HAIR_BACK_FOLLOW, HEAD_FOLLOW, INK, RIG, SHADE } from "./constants";
import { migrateHairPieces } from "./hairMigration";

/** Bump khi đổi hình dạng JSON nhân vật; `migrateCharacter` phải có nhánh tương ứng. */
export const CHARACTER_VERSION = 5;

/** Bộ chỉnh của hình `side` / `rear` / `back`, đo từ chỗ hình nằm trong `VIEW_FRAME`. docs/01-rig.md#bộ-chỉnh-theo-góc */
export const ViewTuneSchema = z.object({
  dx: z.number().default(0),
  dy: z.number().default(0),
  scale: z.number().default(1),
  widthScale: z.number().default(1),
  rotate: z.number().default(0),
});

const stretch = z.object({
  /** `part` là bộ phận vẽ bằng code trong `PARTS`; giữ `file` để đổi qua lại không mất ảnh */
  src: z.enum(["none", "image", "part"]).default("none"),
  file: z.string().optional(),
  part: z.string().optional(),
  /** Bộ phận code: màu vẽ, bỏ trống thì lấy `palette.garment`. Ảnh: nhân vào ảnh mực, bỏ trống thì để nguyên ảnh */
  color: z.string().optional(),
  accent: z.string().optional(),
  dx: z.number().default(0),
  dy: z.number().default(0),
  /** `scale` là chiều cao, `widthScale` nhân thêm vào bề ngang */
  scale: z.number().default(1),
  widthScale: z.number().default(1),
  aspect: z.number().positive().default(1),
  /** Độ, chiều rig; xoay quanh tâm hộp, trừ vai áo (quanh khớp vai) và đồ cầm tay (quanh bàn tay) */
  rotate: z.number().default(0),
});

const piece = stretch.extend({
  /** Hình riêng của góc ấy không đọc `dx` … `rotate` ở trên mà đọc ở đây; thiếu là trung tính */
  views: z
    .object({
      side: ViewTuneSchema.optional(),
      rear: ViewTuneSchema.optional(),
      back: ViewTuneSchema.optional(),
    })
    .optional(),
});

/**
 * Tóc dựng khối: mảng tóc là một vỏ ôm sọ đơn vị, chân tóc là vĩ độ theo kinh độ, độ.
 * Kinh độ 0 là giữa mặt, dương về `+x`. docs/02-trang-phuc.md#tóc-dựng-khối
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
 * Số đo theo bán kính sọ. docs/02-trang-phuc.md#kính-dựng-khối
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
 * docs/02-trang-phuc.md#mũ-dựng-khối
 */
export const HAT_SHAPES = ["drum"] as const;

export const HatSchema = z.object({
  /** `drum` trụ thấp hở đáy, đỉnh phẳng bo mép */
  shape: z.enum(HAT_SHAPES).default("drum"),
  /** Vĩ độ miệng mũ ở giữa trán */
  front: z.number().default(32),
  /** Vĩ độ miệng mũ ở gáy */
  back: z.number().default(18),
  /** Thân mũ cao bấy nhiêu tính từ miệng; thấp hơn tóc dưới nó thì nâng cho trùm hết */
  height: z.number().default(0.62),
  /** Khoảng hở giữa thân mũ và vỏ tóc (hay sọ); âm là ôm chặt hơn */
  ease: z.number().default(0.03),
  /** Bán kính bo mép đỉnh */
  round: z.number().default(0.12),
  /** Miệng mũ nở ra bấy nhiêu phần bán kính thân, `0` là trụ thẳng */
  flare: z.number().default(0),
  /** Nếp gấp ngang: các độ cao, phần chiều cao thân */
  folds: z.array(z.number()).default([0.32]),
});

/**
 * Trâm cài búi: que mảnh xuyên qua khối buộc của tóc dựng khối (búi, đuôi ngựa), một hạt ở đầu que.
 * docs/02-trang-phuc.md#trâm-cài-búi
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
 * Râu dựng khối: một mảng trên nửa dưới sọ đơn vị, nổi khỏi da và rủ dưới cằm, quay theo mặt.
 * Góc theo độ, dài theo bán kính sọ. docs/02-trang-phuc.md#râu-dựng-khối
 */
export const BEARD_TIPS = ["round", "point", "square", "fork"] as const;

export const BeardSchema = z.object({
  /** Kinh độ mép sau của râu; quá `90` là tóc mai lên tới tai */
  reach: z.number().default(100),
  /** Vĩ độ đỉnh tóc mai ở mép sau */
  burn: z.number().default(10),
  /** Mép trên ở má cao hơn mồm bấy nhiêu độ; âm là thấp hơn */
  cheek: z.number().default(8),
  /** Khấc chừa mồm: mép trên thấp hơn mồm bấy nhiêu độ, nửa rộng `notch` độ kinh */
  gap: z.number().default(10),
  notch: z.number().default(22),
  /** Thành khấc lên tới mép má trong bấy nhiêu độ kinh; nhỏ là thành dựng đứng */
  soft: z.number().default(12),
  /** Kín mồm: bỏ khấc, mồm vẽ đè lên râu và có viền */
  cover: z.boolean().default(false),
  /** Dải ria liền với râu: dày bấy nhiêu độ vĩ, `0` là không có */
  lip: z.number().default(0),
  /** Dải ria: nửa rộng, độ kinh; mép dưới cao hơn mồm `lipRise` độ */
  lipWidth: z.number().default(26),
  lipRise: z.number().default(3),
  /** Bấy nhiêu độ kinh cuối mỗi bên, mép trên cong xuống đáy; `0` là mép sau thẳng */
  round: z.number().default(0),
  /** Cạo giữa cằm: bỏ phần gần trục giữa hơn bấy nhiêu lần bán kính */
  shave: z.number().default(0),
  /** Râu nổi khỏi da bấy nhiêu, đầy ở phần dưới, mỏng về mép trên */
  bulk: z.number().default(0.07),
  /** Rủ dưới cằm bấy nhiêu, sâu nhất ở giữa theo `tip` */
  length: z.number().default(0),
  /** Dáng đáy khi rủ: `round` tròn, `point` nhọn, `square` vuông, `fork` chẻ đôi */
  tip: z.enum(BEARD_TIPS).default("round"),
  /** Râu lún phún: lớp màu mờ không viền, không nổi, không rủ */
  stubble: z.boolean().default(false),
});

/**
 * Thân áo dựng khối: áo là các đặc điểm trên một khối thân lồi, chiếu theo góc nhìn. Số đo bằng
 * px; trường bỏ trống lấy số của kiểu ở `GARMENT_STYLES`. docs/02-trang-phuc.md#thân-áo-dựng-khối
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

/** Đai ngang thân áo cổ chéo. docs/02-trang-phuc.md#áo-cổ-chéo */
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

/** Hai vạt mở của áo khoác kiểu `wrap`. docs/02-trang-phuc.md#áo-khoác-vạt-mở */
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

/** Chữ dọc trên dải cổ. docs/02-trang-phuc.md#chữ-trên-dải-cổ */
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

/** Cổ chéo, dải cổ và đai của kiểu `wrap`. docs/02-trang-phuc.md#áo-cổ-chéo */
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

/** Hình in trên thân áo dựng khối: chữ, hình có tên hay path SVG. docs/02-trang-phuc.md#hình-in-trên-áo */
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

/** Thẻ tên dán ngực thân áo dựng khối. docs/02-trang-phuc.md#thẻ-tên */
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

/** Khăn vắt vai của người 3D (`pieces.neck.drape`): dải phẳng vắt qua một vai, khối cứng bám thân. docs/02-trang-phuc.md#khăn-vắt-vai */
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

/** Kính râm gài nẹp áo của người 3D (`pieces.neck.shades`): treo dưới đáy cổ áo bằng một gọng. docs/02-trang-phuc.md#kính-gài-nẹp */
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
  /** Kiểu `wrap`: cổ chéo, dải cổ, đai; kiểu khác bỏ qua */
  wrap: WrapSchema.optional(),
  /** Hình in trên mặt khối, chỉ người 3D */
  prints: z.array(PrintSchema).optional(),
  /** Thẻ tên dán ngực, chỉ người 3D */
  badge: BadgeSchema.optional(),
  /** Lá cổ bẻ dựng lên ôm gáy, `0..1`: `0` gập xuống, `1` dựng hẳn; chỉ người 3D. docs/02-trang-phuc.md#cổ-dựng */
  collarUp: z.number().min(0).max(1).optional(),
  /** Bụng phệ: thân nhô ra trước nhiều nhất bấy nhiêu px ở bụng, ra hai bên ít hơn; chỉ người 3D nhô ra trước. docs/02-trang-phuc.md#bụng-phệ */
  belly: z.number().min(0).optional(),
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

/** Vạt dài quấn (`skirt.style: "wrap"`). docs/02-trang-phuc.md#vạt-dài-quấn */
export const WrapHemSchema = z.object({
  /** Mép vạt trên ở cạp lệch sang bên phải người mặc bấy nhiêu px */
  overlap: z.number().default(22),
  /** Tới gấu mép vạt lệch thêm bấy nhiêu px về bên phải người mặc */
  slant: z.number().default(6),
});

/** Tạp dề (`skirt.style: "apron"`). docs/02-trang-phuc.md#tạp-dề */
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

/** Váy dựng khối: nón cụt treo ở hông, chiếu theo góc của thân. docs/02-trang-phuc.md#váy-dựng-khối */
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

/** Thân đạo cụ dùng lại đúng hình dạng này — docs/06-dao-cu.md */
export const StretchPieceSchema = stretch;

/** Khai trước `CharacterSchema` vì `items` cần tới; `PIECE_KEYS` bên dưới kiểm lại cho khớp. */
const PIECE_KEY_NAMES = [
  "torso",
  "sleeveNear",
  "sleeveFar",
  "neck",
  "hairBack",
  "hair",
  "crown",
  "headAcc",
  "faceAcc",
  "chin",
  "hem",
  "handNear",
  "handFar",
] as const;

/**
 * Config của một socket bất kỳ: hợp mọi trường mà các socket dùng tới. Một vật cắm được
 * vào nhiều socket nên không biết trước mình cần trường nào; socket bỏ qua trường thừa.
 */
export const SocketPieceSchema = piece.extend({
  src: z.enum(["none", "image", "part", "sculpt"]).default("none"),
  glasses: GlassesSchema.optional(),
  beard: BeardSchema.optional(),
  hat: HatSchema.optional(),
  pin: PinSchema.optional(),
  drape: DrapeSchema.optional(),
  shades: ShadesSchema.optional(),
  garment: GarmentSchema.optional(),
  palette: PiecePaletteSchema.optional(),
  skirt: SkirtSchema.optional(),
  clip: z.boolean().default(false),
  clipGrow: z.number().default(1.12),
  hideLegs: z.boolean().default(true),
  /** `chin`: dưới nét mặt; `hem`: dưới thân áo; `handNear`/`handFar`: sau cả chân lẫn thân */
  layer: z.enum(["front", "under"]).default("front"),
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

export const CharacterSchema = z.object({
  schemaVersion: z
    .literal(CHARACTER_VERSION, {
      error: "JSON nhân vật thuộc phiên bản schema khác; cần bản @stickman3d/sketch khớp với nó",
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
      shape: z.enum(["round", "square", "trapezoid"]).default("round"),
      scaleX: z.number().default(1),
      scaleY: z.number().default(1),
      dx: z.number().default(0),
      dy: z.number().default(0),
      /** Mảnh `hair` / `crown` trôi theo mặt bấy nhiêu phần; 0 = bám sọ, đứng yên khi lắc */
      follow: z.number().default(HEAD_FOLLOW),
      /** Như trên cho lớp sau đầu: `hairBack` và lớp `under` của kiểu tóc; nó nằm sau trục lắc nên muốn nhúc nhích thì kéo âm */
      followBack: z.number().default(HAIR_BACK_FOLLOW),
      /** Dáng khối đầu của người 3D: `human` có quai hàm, cằm, tai, mũi; 2D không đọc. docs/01-rig.md#người-3d-mặc-đồ */
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
      /** Đậm của bóng khối trên đầu, thân áo, tà áo; `0` tắt. docs/01-rig.md#bóng-khối */
      shade: z.number().min(0).max(1).default(SHADE),
    })
    .prefault({}),
  face: z
    .object({
      offsetY: z.number().default(0),
      eyeGap: z.number().default(26),
      turn: z.number().default(12),
      mouthGap: z.number().default(34),
      /** Má ửng `0..1` của người 3D, màu suy từ `palette.skin` (`blushColor`); `0` tắt, 2D không vẽ */
      blush: z.number().min(0).max(1).default(0),
      moustache: z
        .object({
          kind: z
            .enum([
              "none",
              "short",
              "long",
              "pencil",
              "chevron",
              "handlebar",
              "walrus",
              "horseshoe",
            ])
            .default("none"),
          color: z.string().default("#3a2620"),
          width: z.number().default(1),
          dx: z.number().default(0),
          dy: z.number().default(0),
          follow: z.boolean().default(true),
        })
        .prefault({}),
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
  sleeveFit: z
    .object({
      hideUpperArm: z.boolean().default(false),
      /** Tay xa dùng chung dx/dy/dài/bề ngang với tay gần; ảnh và aspect vẫn riêng */
      syncFar: z.boolean().default(true),
    })
    .prefault({}),
  pieces: z
    .object({
      /** `sculpt` là thân áo dựng khối, số đo ở `garment` */
      torso: piece
        .extend({
          src: z.enum(["none", "image", "part", "sculpt"]).default("none"),
          garment: GarmentSchema.optional(),
          /** Tay áo, quần, giày của bộ áo này, đè `palette`; chỉ người 3D */
          palette: PiecePaletteSchema.optional(),
        })
        .prefault({ scale: 1.1, aspect: 0.55 }),
      sleeveNear: piece.prefault({ aspect: 0.45 }),
      sleeveFar: piece.prefault({ aspect: 0.45 }),
      /** Khăn quàng, cà vạt, yếm; `sculpt` là khăn vắt vai (`drape`) và kính gài nẹp (`shades`) của người 3D */
      neck: piece
        .extend({
          src: z.enum(["none", "image", "part", "sculpt"]).default("none"),
          drape: DrapeSchema.optional(),
          shades: ShadesSchema.optional(),
        })
        .prefault({ aspect: 1 }),
      hairBack: piece.prefault({ aspect: 0.62 }),
      hair: piece
        .extend({
          src: z.enum(["none", "image", "part", "sculpt"]).default("none"),
          sculpt: SculptSchema.optional(),
          /** Cắt mảnh theo bao tóc để ảnh không tràn khỏi khối đầu */
          clip: z.boolean().default(false),
          /** Bao tóc = viền đầu nở ra bấy nhiêu; 1 là đúng viền */
          clipGrow: z.number().default(1.12),
        })
        .prefault({ aspect: 0.95 }),
      /** Mũ; `sculpt` là mũ dựng khối của người 3D, số đo ở `hat` */
      crown: piece
        .extend({
          src: z.enum(["none", "image", "part", "sculpt"]).default("none"),
          hat: HatSchema.optional(),
        })
        .prefault({ aspect: 0.95 }),
      /** Phụ kiện đội trên mũ / bám sọ: sừng, tai, vòng hoa — đứng yên khi lắc đầu; `sculpt` là trâm cài búi của người 3D */
      headAcc: piece
        .extend({
          src: z.enum(["none", "image", "part", "sculpt"]).default("none"),
          pin: PinSchema.optional(),
        })
        .prefault({ aspect: 0.95 }),
      /** Phụ kiện dán lên mặt: kính, sẹo, mặt nạ — trôi đúng bằng nét mặt; `sculpt` là kính dựng khối */
      faceAcc: piece
        .extend({
          src: z.enum(["none", "image", "part", "sculpt"]).default("none"),
          glasses: GlassesSchema.optional(),
        })
        .prefault({ aspect: 0.95 }),
      /** Râu; `sculpt` là râu dựng khối, luôn vẽ dưới nét mặt */
      chin: piece
        .extend({
          src: z.enum(["none", "image", "part", "sculpt"]).default("none"),
          beard: BeardSchema.optional(),
          /** `under` = dưới miệng/ria/mắt: râu quai nón khỏi phải khoét alpha chừa mồm */
          layer: z.enum(["front", "under"]).default("front"),
        })
        .prefault({ aspect: 0.62 }),
      /** `sculpt` là váy dựng khối, số đo ở `skirt` */
      hem: piece
        .extend({
          src: z.enum(["none", "image", "part", "sculpt"]).default("none"),
          skirt: SkirtSchema.optional(),
          hideLegs: z.boolean().default(true),
          /** `under` = dưới thân áo: gấu áo trùm ra ngoài, tà áo luồn vào trong */
          layer: z.enum(["front", "under"]).default("front"),
        })
        .prefault({ aspect: 0.62 }),
      /** `under` = sau cả chân lẫn thân: đồ vác sau lưng, mũ cầm buông thõng sau đùi */
      handNear: piece.extend({ layer: z.enum(["front", "under"]).default("front") }).prefault({}),
      handFar: piece.extend({ layer: z.enum(["front", "under"]).default("front") }).prefault({}),
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

export type ViewTune = z.infer<typeof ViewTuneSchema>;
export type Sculpt = z.infer<typeof SculptSchema>;
export type Glasses = z.infer<typeof GlassesSchema>;
export type Beard = z.infer<typeof BeardSchema>;
export type Hat = z.infer<typeof HatSchema>;
export type Pin = z.infer<typeof PinSchema>;
export type Drape = z.infer<typeof DrapeSchema>;
export type Shades = z.infer<typeof ShadesSchema>;
export type BeardTip = (typeof BEARD_TIPS)[number];
export type Garment = z.infer<typeof GarmentSchema>;
export type Wrap = z.infer<typeof WrapSchema>;
export type Open = z.infer<typeof OpenSchema>;
export type Letters = z.infer<typeof LettersSchema>;
export type Print = z.infer<typeof PrintSchema>;
export type PrintShape = (typeof PRINT_SHAPE_NAMES)[number];
export type PrintFont = (typeof PRINT_FONTS)[number];
export type Badge = z.infer<typeof BadgeSchema>;
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

/**
 * Object đang chiếm socket, sửa được tại chỗ: của vật đang mặc nếu có, không thì của
 * `pieces`. Studio chỉnh mảnh phải đi qua đây, không thì kéo cái áo giáp lại ghi vào áo nền.
 */
export function wornPiece(c: CharacterData, e: Equip | undefined, k: PieceKey): PieceData {
  const name = equipMap(c, e)[k];
  if (name && name !== BASE_ITEM)
    return (c.items[name]?.[k] as PieceData | undefined) ?? c.pieces[k];
  return c.pieces[k];
}

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

/**
 * Thư mục ảnh và socket trong danh mục: đồ cầm tay dùng chung `hand`, thân đạo cụ ở
 * `prop`, socket của động vật mang tiền tố `animal` để không đụng tên socket nhân vật (`neck`,
 * `head`, …) — xem `animalPieceDir` ở docs/08-dong-vat.md
 */
export const PIECE_DIRS = [
  "torso",
  "sleeveNear",
  "sleeveFar",
  "neck",
  "hairBack",
  "hair",
  "crown",
  "headAcc",
  "faceAcc",
  "chin",
  "hem",
  "hand",
  "prop",
  "animalBody",
  "animalNeck",
  "animalHead",
  "animalEar",
  "animalWing",
  "animalTail",
] as const;
export type PieceDir = (typeof PIECE_DIRS)[number];
export const pieceDir = (k: PieceKey): PieceDir =>
  k === "handNear" || k === "handFar" ? "hand" : k;

/** Tên file ảnh của socket, hoặc `undefined` nếu socket không dùng ảnh. */
export const pieceFile = (p: PieceData): string | undefined =>
  p.src === "image" ? p.file : undefined;

/** Tên bộ phận code của socket, hoặc `undefined` nếu socket không dùng bộ phận code. */
export const piecePart = (p: PieceData): string | undefined =>
  p.src === "part" ? p.part : undefined;

/** Mọi socket có thể vẽ: mảnh nền và mảnh của từng vật. Đường nạp ảnh đi qua đây. */
export const characterSockets = (c: CharacterData): PieceData[] => [
  ...PIECE_KEYS.map((k) => c.pieces[k]),
  ...Object.values(c.items).flatMap((it) => Object.values(it) as PieceData[]),
];

/** Tên file ảnh mà nhân vật cần — kể cả vật chưa mặc, vì cảnh sau sẽ mặc. Không trùng lặp. */
export const characterFiles = (c: CharacterData): string[] => [
  ...new Set(characterSockets(c).flatMap((p) => pieceFile(p) ?? [])),
];

/** Ghi tỉ lệ khung đo từ ảnh vào mọi socket dùng file ấy, kể cả socket của vật. */
export function applyAspects(c: CharacterData, aspects: Record<string, number>) {
  for (const p of characterSockets(c)) {
    const f = pieceFile(p);
    if (f && aspects[f] !== undefined) p.aspect = aspects[f];
  }
}

/** Nâng JSON đời cũ lên `CHARACTER_VERSION`. File mới hơn thì trả nguyên để zod báo lỗi. */
export function migrateCharacter(json: unknown): unknown {
  if (!json || typeof json !== "object" || Array.isArray(json)) return json;
  const o = structuredClone(json) as Record<string, unknown>;
  const from = typeof o.schemaVersion === "number" ? o.schemaVersion : 0;
  if (from > CHARACTER_VERSION) return o;
  // v1 → v2 thêm `items` / `outfits`; thiếu thì nhân vật chỉ có mảnh nền, đúng như trước
  // v2 → v3 thêm `palette.limbCurve` và `palette.shade`; thiếu thì lấy mặc định, không phải viết gì
  // v3 → v4 thêm `pieces.*.views`; thiếu là bộ chỉnh trung tính
  if (from < 1) {
    const pieces = (o.pieces ?? {}) as Record<string, Record<string, unknown>>;
    for (const pc of Object.values(pieces))
      if (pc && typeof pc === "object") pc.src ??= pc.file ? "image" : "none";
  }
  if (from < 5) {
    const pieces = (o.pieces ?? {}) as Record<string, Record<string, unknown>>;
    migrateHairPieces(pieces, RIG.headH);
    const items = (o.items ?? {}) as Record<string, Record<string, Record<string, unknown>>>;
    for (const it of Object.values(items))
      if (it && typeof it === "object") migrateHairPieces(it, RIG.headH);
  }
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

/** Ảnh mảnh đã nạp, **khoá theo tên file** — một ảnh dùng ở hai socket chỉ nạp một lần */
export type PieceUrls = Record<string, string>;

export { RIG };

/** Tên file danh mục mảnh ảnh, nằm ngay trong `pieces/`. */
export const PIECE_CATALOG_FILE = "catalog.json";

/** Cấu hình mặc định của một kiểu; thiếu khoá nào thì giữ giá trị đang có của socket. */
export const PieceConfigSchema = z
  .object({
    dx: z.number(),
    dy: z.number(),
    scale: z.number(),
    widthScale: z.number(),
    clip: z.boolean(),
    clipGrow: z.number(),
    hideLegs: z.boolean(),
    layer: z.enum(["front", "under"]),
    rotate: z.number(),
  })
  .partial();

export const PieceCatalogEntrySchema = z.object({
  /** Đường dẫn trong `pieces/`, mang cả thư mục socket (`hair/x.png`) */
  file: z.string(),
  socket: z.enum(PIECE_DIRS),
  name: z.string(),
  description: z.string().default(""),
  config: PieceConfigSchema.default({}),
});

/** `pieces/catalog.json`: studio chỉ liệt kê mảnh có trong đây, không quét thư mục. */
export const PieceCatalogSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  pieces: z.array(PieceCatalogEntrySchema).default([]),
  /** Cấu hình lúc cắm của bộ phận vẽ code, theo tên `part`; đè lên `preset` của bộ phận */
  parts: z.record(z.string(), PieceConfigSchema).default({}),
});

export type PieceConfig = z.infer<typeof PieceConfigSchema>;
export type PieceCatalogEntry = z.infer<typeof PieceCatalogEntrySchema>;
export type PieceCatalog = z.infer<typeof PieceCatalogSchema>;

export const parsePieceCatalog = (json: unknown) => PieceCatalogSchema.safeParse(json);

/**
 * Gộp danh mục theo lớp, lớp trước đè lớp sau theo `file` và theo tên `part` — workspace trước,
 * bộ chung của studio sau.
 */
export function mergePieceCatalogs(...layers: PieceCatalog[]): PieceCatalog {
  const seen = new Set<string>();
  const pieces: PieceCatalogEntry[] = [];
  const parts: Record<string, PieceConfig> = {};
  for (const layer of layers) {
    for (const p of layer.pieces) {
      if (seen.has(p.file)) continue;
      seen.add(p.file);
      pieces.push(p);
    }
    for (const [n, c] of Object.entries(layer.parts)) parts[n] ??= c;
  }
  return { schemaVersion: 1, pieces, parts };
}

/** Mọi khoá cấu hình mà socket này có, đọc từ mảnh đang cắm — chiều ngược của `applyPieceConfig` */
export function pieceConfigOf(piece: PieceData): PieceConfig {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(PieceConfigSchema.shape))
    if (k in piece) out[k] = (piece as Record<string, unknown>)[k];
  return out as PieceConfig;
}

/** Ghi config của kiểu vào socket; khoá không có trong socket (vd. `clip` ở torso) bị bỏ qua. */
export function applyPieceConfig(piece: PieceData, config: PieceConfig) {
  for (const [k, v] of Object.entries(config))
    if (v !== undefined && k in piece) (piece as Record<string, unknown>)[k] = v;
}
