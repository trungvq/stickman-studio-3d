// Số đo hộp mảnh và bộ sinh prompt gen ảnh. Hộp tính từ hằng số rig; công thức đặt hộp
// nằm ở `packages/sketch/src/Character.tsx`, bảng đối chiếu ở docs/01-rig.md#mốc-đặt-mảnh.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SOURCES } from "@stickman3d/cli";
import * as rig from "@stickman3d/sketch";

const R = rig.RIG;
const TORSO_BOX = 1.1;
// Vai áo nhô lên trên khớp vai nửa nét tay áo; `palette.sleeveWidth` mặc định là 10
const CAP = 10 / 2;
const DEF = rig.defaultCharacter().rig;
const num = (n) => +n.toFixed(1);

/**
 * Một socket: hộp ảnh ở `scale = 1`, mốc treo, và những gì prompt phải đòi.
 * `boxH`/`boxW` chưa nhân `aspect` — bề ngang thật là `boxW × scale × aspect × widthScale`.
 */
export const SPECS = {
  torso: {
    label: "TORSO GARMENT pieces (the body of a shirt / jacket)",
    boxH: R.torso * TORSO_BOX,
    boxW: R.torso * TORSO_BOX,
    aspect: 0.55,
    shape:
      "a tall rounded shape, about 1.6 times as tall as it is wide, shoulders at the very top, hips at the very bottom",
    anchor: `mép trên ở y = −${R.torso} (đỉnh thân), tâm ngang ở 0`,
    grid: [3, 3],
    frame: "bộ mẫu cắt 300×360, danh mục dy −16, scale 1.36, widthScale 0.9",
    rules: [
      "The piece is ONLY the cloth on the torso: collar at the top, hem at the bottom. No head, no neck, no skin, no arms, no hands, no legs.",
      "NO SLEEVES AND NO ARMHOLES. The silhouette is one smooth closed shape like a bean: a rounded shoulder each side flowing in one curve down to the hip. The arms are separate pieces drawn behind it.",
      "NO SKIN ANYWHERE: close every collar, put a shirt in the opening of a jacket. Every filled area is recoloured with the garment, so bare skin would come out the colour of the shirt.",
      "ONE SOLID FULLY OPAQUE SHAPE — no transparent holes inside the outline.",
      "Keep the SAME collar-to-hem height in every cell; the width may differ a little.",
    ],
  },
  sleeveNear: {
    label: "SHOULDER / UPPER-SLEEVE pieces",
    boxH: R.upperArm + CAP,
    boxW: R.upperArm + CAP,
    aspect: 0.45,
    shape:
      "a narrow vertical strip, about twice as tall as it is wide, hanging straight down from the shoulder seam",
    anchor: "mép trên ở khớp vai, xoay theo góc vai; nửa nét tay nhô lên trên khớp",
    grid: [3, 3],
    frame: "chưa gen sheet nào — hộp dài đúng đoạn vai→khuỷu",
    rules: [
      "The piece is ONE SLEEVE from the shoulder seam down to the elbow, nothing else — no torso, no hand, no forearm.",
      "It must never be narrower than the arm line it covers: the forearm is drawn as a thick black line coming out of its bottom edge.",
      "The top edge is the shoulder seam and must be flat-ish; the piece hangs straight down in the cell.",
    ],
  },
  neck: {
    label: "NECKWEAR pieces (scarf, tie, bib, collar wrap)",
    boxH: R.torso * rig.NECK_BOX,
    boxW: R.torso * rig.NECK_BOX,
    aspect: 1,
    shape: "roughly square: the loop or knot at the top, the ends hanging into the lower half",
    anchor: `mép trên ở khớp cổ, y = −${R.torso + R.neck}; nghiêng theo thân, không theo đầu`,
    grid: [3, 3],
    frame: "chưa gen sheet nào",
    rules: [
      "The piece hangs from the neck joint down over the chest. No head, no chin, no shoulders, no garment behind it.",
      "The top of the piece is the loop or knot around the neck; it must read as sitting ON the neck, not floating.",
    ],
  },
  hairBack: {
    label: "BACK-HAIR pieces (the mass of hair falling behind the head)",
    boxH: R.headH * rig.HAIR_BACK_H,
    boxW: R.headH * rig.HAIR_BACK_H,
    aspect: 0.62,
    shape: "a little taller than wide, the crown at the very top edge and the length falling below",
    anchor: "mép trên ở đỉnh đầu; vẽ sau cả thân lẫn chân",
    grid: [3, 3],
    frame: "bộ mẫu cắt 416×384, danh mục scale 1, dy 0",
    rules: [
      "Seen from BEHIND: the crown of the skull is at the very top edge, the hair falls to its full length below.",
      "No face, no ears, no neck, no shoulders — the front hair is a separate sheet.",
      "Every cell puts the crown of the skull at the same height.",
    ],
  },
  hair: {
    label: "FRONT-HAIR pieces (the fringe and the mass over the skull)",
    boxH: R.headH,
    boxW: R.headH,
    aspect: 0.95,
    shape:
      "much wider than tall — the band from crown to brow is a shallow arc about three times as wide as it is tall; side locks may hang below it",
    anchor: "mép trên ở đỉnh đầu, trong nhóm đầu; vẽ đè lên đầu, dưới mũ",
    grid: [3, 3],
    frame: "bộ mẫu cắt 416×288, danh mục scale 0.9, dy −38",
    rules: [
      "The piece is a shell of hair with a HOLE where the face is: eyes, brows and mouth are drawn by code underneath it.",
      "No face, no ears, no neck, no shoulders.",
      "Every cell puts the crown of the skull at the same height, and keeps the real size difference between styles — a big style is drawn bigger.",
      `The head is a circle ${R.headH} across, so the band from the crown down to the brow is only about a third of its width: the fringe is a SHALLOW arc, roughly three times as wide as it is tall.`,
    ],
  },
  crown: {
    label: "HEADWEAR pieces (hats, caps, helmets, head wraps)",
    boxH: R.headH,
    boxW: R.headH,
    aspect: 0.95,
    shape: "wider than tall: the hat sits on the top third of a head 130 across",
    anchor: "chung hộp với `hair`, mép trên ở đỉnh đầu; vẽ sau tóc nên tóc vẫn thò ra",
    grid: [3, 3],
    frame: "bộ mẫu cắt 560×360 căn mép dưới mực, danh mục dy −85, scale 1.1",
    rules: [
      "The MOUTH of the hat — the inner curve where it bites onto the skull — is IDENTICAL in every cell: same width, same height. Brims and crowns may differ as much as they like, the mouth may not move.",
      "The crown of the hat is frontal, but anything sticking forward — a peak, a bill, the front of a brim, a knot — is drawn in side view pointing to the viewer's RIGHT.",
      "No alpha holes inside the outline: the hat is drawn over the hair, a hole shows hair through the crown.",
      "Tilt only left-to-right. Never draw the hat seen from above or below.",
    ],
  },
  headAcc: {
    label: "HEAD-ACCESSORY pieces (horns, ears, antennae, flower crowns, halos)",
    boxH: R.headH,
    boxW: R.headH,
    aspect: 0.95,
    shape: "wider than tall, sitting on the top third of a head 130 across",
    anchor:
      "chung hộp với `crown`, mép trên ở đỉnh đầu; vẽ trên cả mũ, bám sọ nên đứng yên khi lắc",
    grid: [3, 3],
    frame: "chưa gen sheet nào — hộp trùng hộp `crown`",
    rules: [
      "The piece is ONLY the accessory — horns, ears, a wreath, a halo. No head, no hair, no hat, no face.",
      "Anything sticking forward is drawn in side view pointing to the viewer's RIGHT, like the hats.",
      "The two sides straddle the skull symmetrically; leave the middle empty where the head shows through.",
    ],
  },
  faceAcc: {
    label: "FACE-ACCESSORY pieces (glasses, eye patches, scars, masks)",
    boxH: R.headH,
    boxW: R.headH,
    aspect: 0.95,
    shape: "much wider than tall, a band across the eye line of a head 130 across",
    anchor: "chung hộp với `crown`, mép trên ở đỉnh đầu; vẽ trên mắt/mày/miệng, dưới tóc và mũ",
    grid: [3, 3],
    frame: "chưa gen sheet nào — hộp trùng hộp `crown`, `dy` kéo xuống ngang mắt",
    rules: [
      "The piece is ONLY the accessory — frames, lenses, a patch, a scar. No head, no eyes, no brows, no nose, no hair.",
      "Lenses are EMPTY: the eyes are drawn by code underneath, so a filled lens hides them. Draw the frame alone.",
      "Frames, straps and buckles are painted flat black #000000 — they must stay dark whatever colour the piece is recoloured to.",
      "Frontal and symmetric about the vertical axis of the cell, and every cell puts the eye line at the same height.",
    ],
  },
  chin: {
    label: "BEARD pieces",
    boxH: R.headH,
    boxW: R.headH,
    aspect: 0.62,
    shape: "about as wide as it is tall, filling the lower half of a circular head",
    anchor: `mép trên ở y = −${num(R.headH * 0.1)} (cằm), trong nhóm đầu; vẽ trên cùng của khối đầu, hoặc dưới mắt/ria/miệng nếu pieces.chin.layer = "under"`,
    grid: [2, 2],
    frame:
      "bộ mẫu cắt 420×420 căn mép trên mực, lề trên 10; bộ đặc (layer under) dy −71 scale 1.05, bộ có lỗ mồm dy −61…−66",
    rules: [
      "The outer edge of the beard is an ARC OF THE HEAD CIRCLE itself — the head is a circle, so no square jaw and no sharp corner at the sideburn.",
      "NO HOLE FOR THE MOUTH: a beard that rings the mouth is one continuous solid shape, the mouth zone filled with the same flat interior tone, because the piece is pasted UNDER the face and the mouth is drawn by code on top of it. That zone — about a third of the head wide, between the moustache and the lower lip — stays CLEAN FLAT FILL: no outline, no interior line, no hair stroke crosses it, or the mouth drawn over it is unreadable.",
      "Do not fill the whole lower half of the head — the sides are narrow straps hugging the jaw, not a mask.",
      "Same jawline in every cell, sideburns ending at the same height.",
      "A moustache belongs in the piece only for styles that ring the mouth; goatee styles have none (code draws the moustache for those).",
    ],
  },
  hem: {
    label: "SKIRT / ROBE-HEM pieces",
    boxH: R.thigh + R.shin,
    boxW: R.thigh + R.shin,
    aspect: 0.62,
    shape: "about 1.6 times as tall as it is wide, waist at the top edge, hem at the bottom",
    anchor: "mép trên ở chậu hông (y = 0); scale 1 thì gấu chạm đúng ground line",
    grid: [3, 3],
    frame: "chưa gen sheet nào",
    rules: [
      "The piece starts at the waist and falls to the hem. No legs, no feet, no torso above the waist.",
      "It hangs straight: it does not follow the legs, it only leans with the body.",
    ],
  },
  hand: {
    label: "HAND-PROP pieces (tools, sticks, bundles)",
    boxH: R.upperArm + R.foreArm,
    boxW: R.upperArm + R.foreArm,
    aspect: 1,
    shape: "fits a square cell, the shaft running along its vertical axis",
    anchor: "hộp đặt **tâm** ở bàn tay, không nhân chiều cao; xoay theo cẳng tay + cổ tay",
    grid: [3, 3],
    frame: "hộp vuông cạnh 120; điểm cầm ở giữa ảnh",
    rules: [
      "The grip point is at the CENTRE of the cell and the shaft runs along the vertical axis of the cell.",
      "The FAR END of the prop points at the BOTTOM edge of the cell: an axe head drawn at the top edge is held backwards.",
      "No hand, no arm, no fingers — the rig does not draw hands, the prop is drawn alone.",
    ],
  },
};

const SCENE =
  "genuinely transparent background; the output must contain a real alpha channel, not a " +
  "checkerboard pattern and not a white or coloured backdrop. Every empty area of the sheet, " +
  "and every hole inside a piece, is transparent pixels.";

const STYLE =
  "flat vector cartoon ink drawing; thick uniform black outline with rounded ends, the same line " +
  "weight everywhere, the weight the stick figure's own limbs are drawn with. EXACTLY TWO COLOURS: " +
  "#000000 for the outline and for every interior line, and one single dark tone #2b2320 for the " +
  "whole fill. The fill is bleached to white afterwards and recoloured per character, so draw the " +
  "SHAPE, not the colour. Anything that must stay dark whatever colour the piece is — a tie, a brim, " +
  "glasses, a buckle — is painted flat black #000000: black survives the recolour, no other tone does.";

const AVOID =
  "checkerboard drawn into the image, white background, coloured background, drop shadow, glow, halo, " +
  "gradient, shading, highlight, texture, a third colour, grid lines, labels, captions, watermark, " +
  "mirroring one of the cells.";

const angleBlock = () => {
  const p = join(SOURCES.prompts, "angle.txt");
  return existsSync(p) ? readFileSync(p, "utf8").trim() : "";
};

/** Bảng số đo cho `describe_pieces` */
export function describePieces() {
  const out = {};
  for (const [k, s] of Object.entries(SPECS))
    out[k] = {
      boxH: num(s.boxH),
      boxW: num(s.boxW),
      aspectDefault: s.aspect,
      shape: s.shape,
      anchor: s.anchor,
      sheet: s.frame,
      rules: s.rules,
    };
  return {
    note:
      "Hộp ảnh cao `boxH × scale`, rộng `boxW × scale × aspect × widthScale`; `aspect` đo từ chính file ảnh, " +
      "`boxH` đã nhân `rig.height` trừ hộp đồ cầm tay. Số ở đây ứng với `height = 1`, `stroke` mặc định.",
    landmarks: {
      shoulders: `±${DEF.shoulderHalf} ở y = −${R.torso - DEF.shoulderDrop}`,
      hips: `±${DEF.hipHalf} ở y = 0`,
      head: `đường kính ${R.headH}, tâm ở y = −${R.torso + R.neck + R.headH / 2}`,
      ground: `y = ${R.footY}`,
    },
    sockets: out,
    flow: [
      "render_character boxes:true để tự nhìn cái hộp mảnh phải lấp — ảnh này agent xem, không đính vào lượt gen.",
      "piece_prompt lấy prompt rồi gen bằng codex: skill imagegen nếu bạn là codex, không thì codex exec -m gpt-5.6-sol (model gen ảnh). Sheet nhiều ô thì đừng đính ảnh tham chiếu — lưới gặp ảnh đính là mất alpha.",
      "Kiểm alpha ngay (magick identify %[channels] phải ra srgba); mất alpha thì gen lại, đừng nhận.",
      "Cắt và tẩy mực bằng magick theo docs/02, rồi add_piece để vào thư mục và danh mục.",
    ],
  };
}

/**
 * Prompt tiếng Anh cho một lượt gen sheet, theo schema nhãn của skill `imagegen`:
 * mỗi nhãn một dòng, giá trị viết liền một đoạn — xuống dòng giữa chừng là model đọc rời ra.
 */
export function piecePrompt({
  socket,
  styles = [],
  cols,
  rows,
  width = 1536,
  height = 1024,
  extra,
}) {
  const s = SPECS[socket];
  if (!s) throw new Error(`socket lạ: ${socket} — có ${Object.keys(SPECS).join(", ")}`);
  const c = cols ?? s.grid[0];
  const r = rows ?? s.grid[1];
  const n = styles.length || c * r;
  const lines = [
    "Use case: stylized-concept",
    `Asset type: sprite sheet of ${s.label} for a 2D cartoon stick-figure rig — each cell is cut out and pasted onto the figure, whose limbs are thick black lines drawn behind it`,
    `Primary request: Generate one ${width}x${height} PNG holding a ${c}x${r} grid of ${n} separate ${s.label}, one per cell, drawn as flat two-colour ink art.`,
    `Scene/backdrop: ${SCENE}`,
    `Subject: ${
      styles.length
        ? `${n} ${s.label}, in this order (left to right, top to bottom): ` +
          styles.map((x, i) => `${i + 1}. ${x}.`).join(" ")
        : `${n} clearly different styles of ${s.label}, one per cell.`
    }`,
    `Style/medium: ${STYLE}`,
    `Composition/framing: a clean ${c}x${r} grid, one piece centred in each cell with a clear margin, nothing touching the sheet edges. Every piece is ${s.shape}. Keep the same size relationship in every cell — a big style is drawn bigger, a slim one smaller.`,
    "Lighting/mood: flat graphic, no lighting effects.",
    `Constraints: actual transparent pixels outside the artwork and inside every hole; preserve alpha. ${s.rules.join(" ")}${extra ? ` ${extra}` : ""}`,
    angleBlock(),
    `Avoid: ${AVOID}`,
  ];
  return lines.filter(Boolean).join("\n");
}
