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
] as const;

export const SculptSchema = z.object({
  /**
   * `plain` vỏ trơn; `neat` rẽ rãnh ngôi và có nét chải; `spiky` mọc gai theo bảng của kiểu;
   * `round` mái bằng; `center` ngôi giữa; `bob` đuôi cụp; `shoulder` ngang vai gợn sóng; `slick` vuốt ngược;
   * `curly` xoăn búp; `bald` hói đỉnh, chỉ còn vành tóc hai bên và sau gáy; `pony` đuôi ngựa; `bun`
   * búi; `messy` ngắn xù, đuôi so le; `afro` xoăn bồng ôm cả đầu; `buzz` đầu đinh sát da; `crop` tròn ngắn mái bằng có lọn xoáy;
   * `quiff` mái dựng cao vuốt ngược
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
] as const;

export const GarmentSchema = z.object({
  /** Kiểu áo trong `GARMENT_STYLES`: `bare` ngực trần, `tshirt` áo phông cổ tròn, `shirt` sơ mi, `polo`, `sweater` áo len, `suit` vest, `hoodie`, `blouse` cổ lá sen */
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
  /** Bán kính bo góc giữa vát vai và thân */
  round: z.number().optional(),
  /** Bán kính bo góc gấu */
  hemRound: z.number().optional(),
});

/** Váy dựng khối: nón cụt treo ở hông, chiếu theo góc của thân. docs/02-trang-phuc.md#váy-dựng-khối */
export const SkirtSchema = z.object({
  /** Cạp cao hơn hông bấy nhiêu, nhân `rig.height` */
  rise: z.number().default(27),
  /** Nửa rộng cạp */
  waist: z.number().default(40),
  /** Gấu thấp hơn cạp bấy nhiêu khi đùi buông thẳng, nhân `rig.height` */
  length: z.number().default(52),
  /** Gấu rộng hơn cạp bấy nhiêu mỗi bên */
  flare: z.number().default(30),
  /** Số nếp quanh khối; `0` là trơn */
  pleats: z.number().default(8),
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
  garment: GarmentSchema.optional(),
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
    })
    .prefault({}),
  palette: z
    .object({
      line: z.string().default(INK),
      skin: z.string().default("#f0d9b8"),
      garment: z.string().default("#5b6ea8"),
      sleeve: z.string().default("#1a1a1a"),
      trouser: z.string().default("#1a1a1a"),
      sleeveWidth: z.number().default(10),
      trouserWidth: z.number().default(10),
      clad: z.boolean().default(false),
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
        })
        .prefault({ scale: 1.1, aspect: 0.55 }),
      sleeveNear: piece.prefault({ aspect: 0.45 }),
      sleeveFar: piece.prefault({ aspect: 0.45 }),
      neck: piece.prefault({ aspect: 1 }),
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
      crown: piece.prefault({ aspect: 0.95 }),
      /** Phụ kiện đội trên mũ / bám sọ: sừng, tai, vòng hoa — đứng yên khi lắc đầu */
      headAcc: piece.prefault({ aspect: 0.95 }),
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
export type BeardTip = (typeof BEARD_TIPS)[number];
export type Garment = z.infer<typeof GarmentSchema>;
export type Skirt = z.infer<typeof SkirtSchema>;
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
