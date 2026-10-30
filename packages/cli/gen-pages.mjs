// Bản mô tả trang soi của từng bộ sinh (docs/13-vai-tro-do.md mục 9): tham số của form, sân khấu thử (cảnh, đồ thử chỉ bằng
// mục vai trò, món cầm tay thử) và tham số gọi `run`. Module thuần — chỉ nhập `gen-sit.mjs`, `gen-pour.mjs`, `gen-walk.mjs` và lõi rig, nạp
// được trong trình duyệt (Studio 3D) lẫn Node (`studio3d.mjs`, tờ thử `gen sit --sheet`).
import * as rig from "@stickman3d/rig/core";
import { POUR_DURATION, POUR_STYLES, POUR_T } from "./gen-pour.mjs";
import {
  BACK_KINDS,
  FEET_KINDS,
  HAND_KINDS,
  LEG_KINDS,
  SIT_DURATION,
  TOP_KINDS,
} from "./gen-sit.mjs";
import {
  SOFT_MAX,
  WALK_DEFAULTS,
  arcAuto,
  arcMin,
  naturalSpeed,
  shapePoints,
} from "./gen-walk.mjs";

const r1 = (v) => Math.round(v * 10) / 10;
const YAW = 90;
/** Id cảnh và người diễn của sân khấu thử */
export const STAGE_SCENE = "xem-thu";
const ACTOR = rig.PREVIEW_ACTOR;

/** Tham số `p[key]`, hay mặc định của nó trong `params` */
const valueOf = (params, p, key) => {
  const v = p?.[key];
  return v === undefined || v === null || v === "" ? params.find((x) => x.key === key).default : v;
};
const num = (params, p, key) => Number(valueOf(params, p, key));
const bool = (params, p, key) => {
  const v = valueOf(params, p, key);
  return v === true || v === "true" || v === 1 || v === "1";
};
/** `rig.height` của nhân vật đang chọn (`who.character` đã `parseCharacter`) */
const heightOf = (who) => who?.character?.rig?.height ?? 1;

// ——— sit

/** Mặt để chân thử: bệ trước ghế dưới bàn chân, rig ở `height` 1 (sâu, rộng) */
const FOOT_PAD = { at: rig.RIG.thigh, size: [60, 96] };

const SIT_PARAMS = [
  {
    key: "legs",
    label: "Chân",
    type: "enum",
    values: LEG_KINDS,
    names: { bent: "co", square: "vuông góc", straight: "duỗi", staggered: "so le" },
    default: "square",
  },
  {
    key: "tuck",
    label: "Chân co",
    type: "enum",
    values: ["near", "far"],
    names: { near: "chân gần", far: "chân xa" },
    default: "far",
    when: { legs: "staggered" },
  },
  {
    key: "feet",
    label: "Bàn chân",
    type: "enum",
    values: FEET_KINDS,
    names: { free: "chạm được thì chạm, không thì chân vuông thõng", floor: "phải chạm mặt đỡ" },
    default: "free",
  },
  {
    key: "back",
    label: "Lưng",
    type: "enum",
    values: BACK_KINDS,
    names: { upright: "thẳng", recline: "tựa ra sau", forward: "nghiêng về trước" },
    default: "upright",
  },
  {
    key: "hands",
    label: "Tay",
    type: "enum",
    values: HAND_KINDS,
    names: {
      thighs: "úp trên đùi",
      table: "đặt trên bàn",
      armrest: "khuỷu, cẳng tay trên tay vịn",
      fold: "khuỷu trên tay vịn, bàn tay chồng trước bụng",
    },
    default: "thighs",
  },
  {
    key: "top",
    label: "Bàn tay nằm trên",
    type: "enum",
    values: TOP_KINDS,
    names: { near: "tay gần", far: "tay xa" },
    default: "near",
    when: { hands: "fold" },
  },
  {
    key: "elbow",
    label: "Dời khuỷu dọc tay vịn (dương ra trước)",
    type: "number",
    min: -60,
    max: 60,
    step: 1,
    unit: "rig ở height 1",
    default: 0,
    when: { hands: ["armrest", "fold"] },
  },
  {
    key: "seat",
    label: "Độ cao mặt ngồi",
    type: "number",
    min: 40,
    max: 160,
    step: 0.5,
    unit: "rig ở height 1",
    default: rig.PREVIEW_SEAT.chair,
  },
  {
    key: "depth",
    label: "Chỗ ngồi trên ghế (hông tới mép sau)",
    type: "number",
    min: 20,
    max: 100,
    step: 1,
    unit: "rig ở height 1",
    default: rig.CHAIR_BACK,
  },
  { key: "backrest", label: "Lưng ghế", type: "bool", default: true },
  { key: "armrest", label: "Tay vịn", type: "bool", default: false },
  {
    key: "armTop",
    label: "Tay vịn cao hơn mặt ngồi",
    type: "number",
    min: 10,
    max: 120,
    step: 1,
    unit: "rig ở height 1",
    default: rig.PREVIEW_ARMREST.top,
    when: { armrest: true },
  },
  {
    key: "armOut",
    label: "Tay vịn cách giữa hông",
    type: "number",
    min: 30,
    max: 120,
    step: 1,
    unit: "rig ở height 1",
    default: rig.PREVIEW_ARMREST.out,
    when: { armrest: true },
  },
  {
    key: "armFront",
    label: "Đầu tay vịn trước hông",
    type: "number",
    min: 0,
    max: 120,
    step: 1,
    unit: "rig ở height 1",
    default: rig.PREVIEW_ARMREST.front,
    when: { armrest: true },
  },
  { key: "desk", label: "Có bàn", type: "bool", default: false },
  {
    key: "deskNear",
    label: "Mép bàn gần trước hông",
    type: "number",
    min: 20,
    max: 200,
    step: 1,
    unit: "rig ở height 1",
    default: rig.PREVIEW_DESK.near,
    when: { desk: true },
  },
  {
    key: "deskTop",
    label: "Mặt bàn cao hơn mặt ngồi",
    type: "number",
    min: 10,
    max: 120,
    step: 1,
    unit: "rig ở height 1",
    default: rig.PREVIEW_DESK.top,
    when: { desk: true },
  },
  { key: "footrest", label: "Để chân", type: "bool", default: false },
  {
    key: "footY",
    label: "Độ cao để chân trên sàn",
    type: "number",
    min: 0,
    max: 120,
    step: 1,
    unit: "rig ở height 1",
    default: 25,
    when: { footrest: true },
  },
];

/**
 * Sân khấu thử của `gen sit`: người `who` ngồi ở gốc nhìn về `−z` trên ghế thử (mặt ngồi, lưng ghế, tay vịn, để chân là
 * mục vai trò của một vật `ghe-thu`, dựng bằng `chairRoles`), bàn thử `ban-thu` (`deskRoles`) khi có bàn. `p.angle` (góc máy
 * của Thư viện, mặc định `near`) chọn ống kính
 */
function sitStage(p, who) {
  const P = (k) => num(SIT_PARAMS, p, k);
  const B = (k) => bool(SIT_PARAMS, p, k);
  const h = heightOf(who);
  const seat = P("seat");
  const seatH = seat * h;
  const yaw = YAW * rig.D;
  const fwd = rig.dirOf(yaw);
  const scene = rig.previewScene(
    "sit-3d",
    { duration: SIT_DURATION, end: "wrap", preview: { stage: "chair" } },
    who?.name,
    { height: h, seat, angle: p?.angle ?? "near" },
  );
  scene.name = STAGE_SCENE;
  // gốc ghế là điểm ngồi lúc hông cách mép sau `CHAIR_BACK`: ngồi sâu hơn thì ghế lùi
  const shift = (rig.CHAIR_BACK - P("depth")) * h;
  const chair = rig
    .chairRoles(h, B("armrest"), { top: P("armTop"), out: P("armOut"), front: P("armFront") })
    .filter((r) => r.role !== "backrest" || B("backrest"));
  if (B("footrest"))
    chair.push({
      role: "footrest",
      at: [(FOOT_PAD.at - (rig.CHAIR_BACK - P("depth"))) * h, seatH - P("footY") * h, 0],
      size: [FOOT_PAD.size[0] * h, FOOT_PAD.size[1] * h],
    });
  const props = [
    {
      name: "ghe-thu",
      place: { at: [fwd[0] * shift, -seatH, fwd[2] * shift], yaw },
      roles: chair,
    },
  ];
  if (B("desk"))
    props.push({
      name: "ban-thu",
      place: { at: [0, 0, 0], yaw },
      roles: rig.deskRoles(seatH, h, { top: P("deskTop"), near: P("deskNear") }),
    });
  return { scene, props, held: {}, h };
}

function sitCall(p) {
  const v = (k) => valueOf(SIT_PARAMS, p, k);
  return {
    scene: STAGE_SCENE,
    cast: ACTOR,
    at: 0,
    legs: v("legs"),
    ...(v("legs") === "staggered" && { tuck: v("tuck") }),
    back: v("back"),
    hands: v("hands"),
    feet: v("feet"),
    ...(v("hands") === "fold" && { top: v("top") }),
    ...((v("hands") === "armrest" || v("hands") === "fold") &&
      Number(v("elbow")) !== 0 && { elbow: Number(v("elbow")) }),
    dryRun: true,
  };
}

// ——— pour

/** Giây bắt đầu rót trên sân khấu thử, và đuôi giữ sau lượt rót */
const POUR_AT = 0.5;
const POUR_TAIL = 0.5;
/** Đáy chai thử ở `y` này của khung món, như `held/binh.json` */
const BOTTLE_BASE = -38;

const POUR_PARAMS = [
  {
    key: "style",
    label: "Kiểu rót",
    type: "enum",
    values: Object.keys(POUR_STYLES),
    names: { single: "một tay", serve: "mời khách hai tay" },
    default: "single",
  },
  {
    key: "tilt",
    label: "Nghiêng hết",
    type: "number",
    min: 45,
    max: 150,
    step: 1,
    unit: "độ",
    default: "auto",
  },
  {
    key: "pourDir",
    label: "Hướng rót (từ ra ngoài về trước)",
    type: "number",
    min: -180,
    max: 360,
    step: 5,
    unit: "độ",
    default: "auto",
  },
  { key: "cup", label: "Có chén", type: "bool", default: true },
  {
    key: "cupAt",
    label: "Chỗ chén",
    type: "point",
    unit: "hệ thân [tiến, y xuống, ra ngoài] so với mốc chest, rig ở world.s 1",
    default: "auto",
  },
  {
    key: "cupR",
    label: "Bán kính chén",
    type: "number",
    min: 3,
    max: 20,
    step: 0.5,
    unit: "rig",
    default: 7,
    when: { cup: true },
  },
  {
    key: "bodyR",
    label: "Chai: thân r",
    type: "number",
    min: 4,
    max: 30,
    step: 0.5,
    unit: "rig",
    default: 13,
  },
  {
    key: "bodyH",
    label: "Chai: thân cao",
    type: "number",
    min: 10,
    max: 80,
    step: 1,
    unit: "rig",
    default: 36,
  },
  {
    key: "neckR",
    label: "Chai: cổ r",
    type: "number",
    min: 1,
    max: 15,
    step: 0.5,
    unit: "rig",
    default: 4,
  },
  {
    key: "neckH",
    label: "Chai: cổ cao",
    type: "number",
    min: 4,
    max: 40,
    step: 1,
    unit: "rig",
    default: 19,
  },
];

/** JSON `held` của chai thử: hai trụ (thân, cổ) đáy ở `BOTTLE_BASE`, `pourer` có `lip` ở mép cổ phía `+z` */
export function testBottle({ bodyR, bodyH, neckR, neckH }) {
  const neck = BOTTLE_BASE + bodyH;
  const top = neck + neckH;
  return {
    schemaVersion: rig.HELD_VERSION,
    size: [2 * bodyR, bodyH + neckH, 2 * bodyR],
    top: "mouth",
    anchors: {
      mouth: { at: [0, top, 0], dir: [0, 1, 0] },
      base: { at: [0, BOTTLE_BASE, 0], dir: [0, -1, 0] },
    },
    roles: [{ role: "pourer", lip: [0, top, neckR] }],
    shape: [
      { cyl: bodyR, from: [0, BOTTLE_BASE, 0], to: [0, neck, 0], part: "than" },
      { cyl: neckR, from: [0, neck, 0], to: [0, top, 0], part: "co" },
    ],
  };
}

/**
 * Sân khấu thử của `gen pour`: người `who` đứng ở gốc nhìn về `−z` trên nền `stand-3d`; chai thử `chai-thu` (`testBottle`
 * qua `parseHeldItem`); chén thử `chen-thu` là `vessel` của đồ cảnh ở chỗ chén. Chỗ chén `auto` là `lip` của kiểu, đổi ra
 * thế giới bằng mốc `chest` của người rót trong cảnh thử không có hành động (`sceneAt`, `bodyMarkAt`) nhân `world.s`. Trả kèm `cup` (điểm thế giới của chỗ
 * chén) cho đích dạng điểm khi tắt chén
 */
function pourStage(p, who) {
  const P = (k) => num(POUR_PARAMS, p, k);
  const style = valueOf(POUR_PARAMS, p, "style");
  const K = POUR_STYLES[style] ?? POUR_STYLES.single;
  const h = heightOf(who);
  const c = who?.character ?? rig.defaultCharacter();
  const scene = rig.previewScene(
    "pour-3d",
    { duration: POUR_DURATION, end: "hold", preview: { stage: "stand" } },
    who?.name,
    { height: h, angle: p?.angle ?? "near" },
  );
  scene.name = STAGE_SCENE;
  scene.duration = POUR_AT + POUR_DURATION + POUR_TAIL;
  scene.cast[0].tracks = [{ name: "base", clips: [{ action: "stand-3d", start: 0 }] }];
  // mốc `chest` đo trên cảnh không hành động: lõi không có JSON hành động ở đây
  const bare = structuredClone(scene);
  bare.cast[0].tracks = [];
  const parsed = rig.parseScene(bare);
  if (!parsed.success) throw new Error(`sân khấu thử hỏng: ${parsed.error.issues?.[0]?.message}`);
  const body = rig.body3(c);
  const rt = rig.resolveScene(parsed.data, {}, { [ACTOR]: h }, { [ACTOR]: body }, {}, {});
  const t = POUR_AT + ((POUR_T.at + POUR_T.back) / 2) * POUR_DURATION;
  const sp = rig.sceneAt(rt, ACTOR, t, h, body);
  const palms = rig.actPalms(c, sp)?.R;
  const chest = rig.bodyMarkAt(c, sp, { to: "chest" }, "R");
  const raw = valueOf(POUR_PARAMS, p, "cupAt");
  const local =
    raw === "auto" ? K.lip : (Array.isArray(raw) ? raw : String(raw).split(",")).map(Number);
  const s = sp.world.s;
  const fwd = palms?.forward ?? rig.dirOf(YAW * rig.D);
  const out = palms?.out ?? [0, 0, 0];
  const cup = chest.map((v, i) =>
    r1(v + s * (local[0] * fwd[i] + local[1] * [0, 1, 0][i] + local[2] * out[i])),
  );
  const bottle = rig.parseHeldItem(
    testBottle({ bodyR: P("bodyR"), bodyH: P("bodyH"), neckR: P("neckR"), neckH: P("neckH") }),
  );
  if (!bottle.success)
    throw new Error(`chai thử hỏng: ${bottle.error.issues.map((x) => x.message).join("; ")}`);
  const props = bool(POUR_PARAMS, p, "cup")
    ? [
        {
          name: "chen-thu",
          place: { at: cup, yaw: 0 },
          roles: [{ role: "vessel", mouth: { at: [0, 0, 0], r: P("cupR") } }],
        },
      ]
    : [];
  return { scene, props, held: { "chai-thu": bottle.data }, h, cup };
}

/** Số mà tham số `auto` của trang `pour` giải ra với kiểu rót đang chọn: nghiêng hết, hướng rót, chỗ chén (`lip` của kiểu) */
function pourAuto(p) {
  const K = POUR_STYLES[valueOf(POUR_PARAMS, p, "style")] ?? POUR_STYLES.single;
  return { tilt: K.tilt[1], pourDir: K.dir, cupAt: K.lip.join(",") };
}

function pourCall(p, stage) {
  const v = (k) => valueOf(POUR_PARAMS, p, k);
  const n = (k) => (v(k) === "auto" ? undefined : Number(v(k)));
  return {
    scene: STAGE_SCENE,
    cast: ACTOR,
    at: POUR_AT,
    style: v("style"),
    ...(n("tilt") !== undefined && { tilt: n("tilt") }),
    ...(n("pourDir") !== undefined && { pourDir: n("pourDir") }),
    cup: bool(POUR_PARAMS, p, "cup") ? "chen-thu" : stage.cup.join(","),
    item: "chai-thu",
    dryRun: true,
  };
}

// ——— walk

const WALK_SHAPES = ["straight", "bend", "corner", "back", "uturn"];
/** Chiều cao người (đầu tới bàn chân) ở `height` 1: ống kính nhìn vào giữa */
const TALL = rig.RIG.thigh + rig.RIG.shin + rig.RIG.torso + rig.RIG.neck + rig.RIG.headH;
/** Lề quanh hộp đường đi, đơn vị rig ở `height` 1; máy lùi thêm ngần này lần nửa đường chéo hộp */
const WALK_PAD = 60;
const WALK_FAR = 2;

const WALK_PARAMS = [
  {
    key: "shape",
    label: "Kịch bản",
    type: "enum",
    values: WALK_SHAPES,
    names: {
      straight: "đi thẳng",
      bend: "rẽ nhẹ",
      corner: "rẽ góc",
      back: "dừng – quay – về",
      uturn: "vòng chữ U",
    },
    default: "corner",
  },
  {
    key: "walkAction",
    label: "Hành động",
    type: "enum",
    values: ["walk", "walk-short", "run-3d"],
    names: { walk: "đi", "walk-short": "đi bước ngắn", "run-3d": "chạy" },
    default: "walk",
  },
  {
    key: "start",
    label: "Bắt đầu",
    type: "enum",
    values: ["moving", "rest"],
    names: { moving: "vào cảnh đang đi", rest: "đứng rồi đi" },
    default: "moving",
  },
  {
    key: "walkSpeed",
    label: "Tốc độ",
    type: "number",
    min: 100,
    max: 500,
    step: 10,
    unit: "đơn vị/s",
    default: "auto",
  },
  {
    key: "lead",
    label: "Quãng trước chỗ rẽ",
    type: "number",
    min: 150,
    max: 1500,
    step: 10,
    unit: "đơn vị",
    default: 500,
  },
  {
    key: "after",
    label: "Quãng sau chỗ rẽ",
    type: "number",
    min: 150,
    max: 1500,
    step: 10,
    unit: "đơn vị",
    default: 500,
    when: { shape: ["bend", "corner", "uturn"] },
  },
  {
    key: "bendTurn",
    label: "Góc rẽ",
    type: "number",
    min: 5,
    max: 45,
    step: 1,
    unit: "độ",
    default: 25,
    when: { shape: "bend" },
  },
  {
    key: "cornerTurn",
    label: "Góc rẽ",
    type: "number",
    min: 45,
    max: 135,
    step: 1,
    unit: "độ",
    default: 90,
    when: { shape: "corner" },
  },
  {
    key: "side",
    label: "Phía",
    type: "enum",
    values: ["right", "left"],
    names: { right: "phải (yaw tăng)", left: "trái" },
    default: "right",
    when: { shape: ["bend", "corner", "uturn"] },
  },
  {
    key: "radius",
    label: "Bán kính bo",
    type: "number",
    min: 0,
    max: 400,
    step: 5,
    unit: "đơn vị",
    default: "auto",
    when: { shape: ["corner", "uturn"] },
  },
  {
    key: "turnTime",
    label: "Thời gian quay",
    type: "number",
    min: 0.5,
    max: 2,
    step: 0.05,
    unit: "giây mỗi 90°",
    default: "auto",
    when: { shape: "back" },
  },
  {
    key: "turnSide",
    label: "Chiều quay nửa vòng",
    type: "enum",
    values: ["auto", "right", "left"],
    names: { auto: "quay về phía ống kính", right: "phải", left: "trái" },
    default: "auto",
    when: { shape: "back" },
  },
  {
    key: "hold",
    label: "Đứng ở mốc cuối",
    type: "number",
    min: 0.2,
    max: 2,
    step: 0.1,
    unit: "giây",
    default: WALK_DEFAULTS.hold,
  },
];

/**
 * Tốc độ và bán kính bo của trang `walk` giải như `run`: tốc độ tự nhiên của hành động đang chọn (`naturalSpeed`, nền
 * `idle`, `world.s` 1) cho người `who` khi `auto`; bán kính `arcAuto` với `uturn` và với `corner` quá `SOFT_MAX`, còn lại
 * `0`. Không có JSON hành động (`who.actions`) thì tốc độ tự nhiên `undefined`
 */
function walkNumbers(p, who) {
  const v = (k) => valueOf(WALK_PARAMS, p, k);
  const a = who?.actions?.[v("walkAction")];
  const nat = a ? naturalSpeed(a, heightOf(who)) : undefined;
  const speed = v("walkSpeed") === "auto" ? nat : Number(v("walkSpeed"));
  const shape = v("shape");
  const big =
    shape === "uturn" || (shape === "corner" && num(WALK_PARAMS, p, "cornerTurn") > SOFT_MAX);
  const auto = big && speed ? arcAuto(speed) : 0;
  return { nat, speed, auto, radius: v("radius") === "auto" ? auto : Number(v("radius")) };
}

/**
 * Sân khấu thử của `gen walk`: người `who` đứng hướng `+x` trên nền `stand-3d` (track `chan`), không đồ, ở chỗ để hộp đường
 * đi nằm giữa phòng thử (`PROP_ROOM`); điểm `--to` của kịch bản (`shapePoints`); ống kính đứng yên ôm hộp đường đi theo góc
 * máy `p.angle` tính từ phía ngoài chỗ rẽ (`lensAround`). `who.actions`
 * (hành động hai lớp) cho tốc độ tự nhiên. Trả kèm `to`, `radius` cho `call`
 */
function walkStage(p, who) {
  const v = (k) => valueOf(WALK_PARAMS, p, k);
  const n = (k) => num(WALK_PARAMS, p, k);
  const h = heightOf(who);
  const shape = v("shape");
  const { speed, radius } = walkNumbers(p, who);
  // bán kính tự chọn của vòng chữ U theo tốc độ: cần tốc độ tự nhiên khi `speed` là `auto`
  if (shape === "uturn" && speed === undefined)
    throw new Error(`sân khấu thử hỏng: không có hành động \`${v("walkAction")}\``);
  if (shape === "uturn" && radius < arcMin(speed) - 1e-6)
    throw new Error(
      `sân khấu thử hỏng: bán kính bo ${radius} dưới ${r1(arcMin(speed))} ở tốc ${r1(speed)} đơn vị/s — bán kính lớn hơn hay giảm tốc độ`,
    );
  const sigma = v("side") === "left" ? -1 : 1;
  const shapeOf = (at) =>
    shapePoints(shape, {
      lead: n("lead"),
      after: n("after"),
      theta: shape === "bend" ? n("bendTurn") : n("cornerTurn"),
      sigma,
      r: radius,
      at,
    });
  // hộp đường đi giữa phòng thử: người đứng ở góc hộp, không ở gốc
  const box = (to) => {
    const xz = to.split(" ").map((tok) => tok.replace(/!.*$/, "").split(",").map(Number));
    const lo = [0, 1].map((i) => Math.min(...xz.map((q) => q[i])));
    const hi = [0, 1].map((i) => Math.max(...xz.map((q) => q[i])));
    return { lo, hi, c: [0, 1].map((i) => (lo[i] + hi[i]) / 2) };
  };
  const b0 = box(`0,0 ${shapeOf([0, 0])}`);
  const at = b0.c.map((x) => Math.round(-x / 10) * 10 + 0);
  const to = shapeOf(at);
  const { lo, hi } = box(`${at[0]},${at[1]} ${to}`);
  const R = Math.hypot(hi[0] - lo[0], hi[1] - lo[1]) / 2 + WALK_PAD * h;
  const center = [(lo[0] + hi[0]) / 2, (-TALL * h) / 2, (lo[1] + hi[1]) / 2];
  // góc máy tính từ phía ngoài chỗ rẽ: `front` nhìn hộp từ phía ngược chiều rẽ, người đi ngang khung
  const base = ["bend", "corner", "uturn"].includes(shape) ? -90 * sigma : -90;
  const lens = rig.lensAround(center, base, rig.PREVIEW_ORBIT[p?.angle ?? "near"], h, WALK_FAR * R);
  const scene = {
    name: STAGE_SCENE,
    lens,
    cast: [
      {
        id: ACTOR,
        ...(who?.name && { character: who.name }),
        tracks: [{ name: "chan", clips: [{ action: "stand-3d", start: 0 }] }],
        world: { at: [at[0], 0, at[1]], yaw: 0 },
      },
    ],
  };
  return { scene, props: [], held: {}, h, to, radius };
}

function walkCall(p, st) {
  const v = (k) => valueOf(WALK_PARAMS, p, k);
  const shape = v("shape");
  return {
    scene: STAGE_SCENE,
    cast: ACTOR,
    at: 0,
    start: v("start"),
    action: v("walkAction"),
    to: st.to,
    ...(v("walkSpeed") !== "auto" && { speed: Number(v("walkSpeed")) }),
    ...((shape === "uturn" || (shape === "corner" && v("radius") !== "auto")) && {
      radius: st.radius,
    }),
    ...(shape === "back" && v("turnTime") !== "auto" && { turnTime: Number(v("turnTime")) }),
    ...(shape === "back" && { turnSide: v("turnSide") }),
    hold: Number(v("hold")),
    dryRun: true,
  };
}

/** Số mà tham số `auto` của trang `walk` giải ra: tốc độ tự nhiên, bán kính bo, giây mỗi `90°` */
function walkAuto(p, who) {
  const { nat, auto } = walkNumbers(p, who);
  return {
    ...(nat !== undefined && { walkSpeed: r1(nat) }),
    radius: auto,
    turnTime: WALK_DEFAULTS.turnTime,
  };
}

/** Giá trị tham số `key` của trang `params`: `p[key]`, thiếu thì mặc định của nó */
export const paramValue = (params, p, key) => valueOf(params, p, key);

const BOOLS = [true, false, "true", "false", 1, 0, "1", "0"];

/**
 * Dòng báo tham số sai của một trang (`params`) trên `p`: số ngoài `min`…`max` hay không phải số, `enum` ngoài `values`,
 * `bool` không phải bật / tắt, `point` không phải ba số, `"auto"` cho tham số không có mặc định `auto`, `angle` không phải
 * góc máy của Thư viện. Khoá không có trong `params` thì bỏ qua. Rỗng là hợp lệ
 */
export function paramProblems(params, p) {
  if (p === null || typeof p !== "object" || Array.isArray(p)) return ["`params` phải là object"];
  const out = [];
  const name = (x) => `\`${x.key}\` (${x.label})`;
  for (const x of params) {
    const v = p[x.key];
    if (v === undefined || v === null || v === "") continue;
    if (v === "auto") {
      if (x.default !== "auto") out.push(`${name(x)} không nhận \`auto\``);
      continue;
    }
    if (x.type === "number") {
      const n = typeof v === "boolean" ? NaN : Number(v);
      if (!Number.isFinite(n)) out.push(`${name(x)} phải là số, không phải \`${v}\``);
      else if ((x.min !== undefined && n < x.min) || (x.max !== undefined && n > x.max))
        out.push(`${name(x)} phải trong ${x.min} … ${x.max}, không phải ${n}`);
    } else if (x.type === "enum") {
      if (!x.values.includes(String(v)))
        out.push(`${name(x)} nhận ${x.values.join(" | ")}, không phải \`${v}\``);
    } else if (x.type === "bool") {
      if (!BOOLS.includes(v)) out.push(`${name(x)} là bật / tắt, không phải \`${v}\``);
    } else if (x.type === "point") {
      const a = Array.isArray(v) ? v : String(v).split(",");
      if (a.length !== 3 || !a.every((k) => k !== "" && Number.isFinite(Number(k))))
        out.push(`${name(x)} là ba số \`x,y,z\` hay \`auto\`, không phải \`${v}\``);
    }
  }
  if (p.angle !== undefined && !rig.PREVIEW_ANGLES.includes(p.angle))
    out.push(`\`angle\` nhận ${rig.PREVIEW_ANGLES.join(" | ")}, không phải \`${p.angle}\``);
  return out;
}

/**
 * Trang soi của từng bộ sinh: `label` tên trang, `params` (form: `key`, `label`, `type` `number` | `enum` | `bool` |
 * `point`, `min`/`max`/`step`/`unit`, `values` và tên tiếng Việt của chúng `names`, `default` số hay `"auto"`, `when`),
 * `stage(p, who)` sân khấu thử `{ scene, props, held, h, … }` từ tham số `p` và nhân vật `who` (`{ name, character, actions }`:
 * tên file `characters/`, JSON đã `parseCharacter`, hành động hai lớp), `call(p, stage)` tham số gọi `run` (như cờ CLI, luôn
 * `dryRun`), `auto(p, who)`
 * (tuỳ chọn) số mà tham số đang `"auto"` giải ra — phải trùng cách `stage` / `run` giải `auto` (form hiện nó, bỏ `auto` thì
 * bắt đầu từ đó). Sân khấu đưa riêng cho `run` qua `o.stage` — `stageRun` của `gen.mjs`
 */
export const GEN_PAGES = {
  sit: { label: "Ngồi", params: SIT_PARAMS, stage: sitStage, call: sitCall, auto: () => ({}) },
  pour: { label: "Rót", params: POUR_PARAMS, stage: pourStage, call: pourCall, auto: pourAuto },
  walk: { label: "Đi", params: WALK_PARAMS, stage: walkStage, call: walkCall, auto: walkAuto },
};
