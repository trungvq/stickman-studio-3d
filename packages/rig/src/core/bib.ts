import { PanelSchema, type Bib, type Panel } from "./schema";

/** Tâm dây vai vắt qua đỉnh vai ở chỗ khối nửa rộng bấy nhiêu px: ngoài miệng cổ (như dây áo ba lỗ) */
const STRAP_TOP = 25;
/** Chân dây sau lưng: tâm cách đường giữa lưng bấy nhiêu px, dây chéo thì ở bên kia trục */
const CROSS_FOOT = 16;
const STRAIGHT_FOOT = 20;
/** `y` dưới gấu: mảng dồn về gấu */
const BELOW = -200;

const panel = (p: Partial<Panel>) => PanelSchema.parse(p);

/**
 * Khung mặt khối cho yếm, độ cao `up` theo hệ `from: "hip"`: `side` là px đo dọc mặt khối từ đường giữa trước / giữa sau
 * tới sườn (kinh độ 90), `ridge` là độ cao trên mặt vát vai nơi khối nửa rộng `half` px
 */
export interface BibFrame {
  side: (up: number, back: boolean) => number;
  ridge: (half: number) => number;
}

/**
 * Mảng áo của yếm `bib` trên khung `f`: mảng ngực hình thang từ cạp lên `top`, hai dây từ mép trên mảng ngực vắt qua đỉnh
 * vai, sau lưng chéo hay thẳng xuống cạp, vòng cạp quanh khối từ cạp xuống gấu (`band`), cúc ở chân dây, túi ngực.
 * docs/12-trang-phuc-3d.md#yếm
 */
export function bibPanels(bib: Bib, f: BibFrame): Panel[] {
  const { color: fill, top, width: w, flare, waist, strap, line } = bib;
  const W = w + flare;
  const out: Panel[] = [];
  if (bib.band)
    out.push(
      panel({
        side: "around",
        fill,
        line,
        pts: [
          [-180, waist],
          [180, waist],
          [180, BELOW],
          [-180, BELOW],
        ],
      }),
    );
  // mảng ngực xuống quá cạp một chút cho liền vòng cạp
  out.push(
    panel({
      fill,
      line,
      pts: [
        [-W, waist - 2],
        [W, waist - 2],
        [w, top],
        [-w, top],
      ],
    }),
  );
  // dây: mặt trước từ mép trên mảng ngực lên sườn ở đỉnh vai, mặt sau từ đó xuống cạp; ở đỉnh vai mép gần cổ cao hơn
  const h = strap / 2;
  const foot = top - 1;
  const low = bib.band ? waist - 2 : waist;
  const [rIn, rOut] = [f.ridge(STRAP_TOP - h), f.ridge(STRAP_TOP + h)];
  out.push(
    panel({
      fill,
      line,
      mirror: true,
      clip: "body",
      pts: [
        [w - strap, foot],
        [w, foot],
        [f.side(rOut, false), rOut],
        [f.side(rIn, false), rIn],
      ],
    }),
  );
  const [x0, x1] =
    bib.back === "cross"
      ? [-CROSS_FOOT - h, -CROSS_FOOT + h]
      : [STRAIGHT_FOOT - h, STRAIGHT_FOOT + h];
  out.push(
    panel({
      side: "back",
      fill,
      line,
      mirror: true,
      pts: [
        [f.side(rIn, true), rIn],
        [x0, low],
        [x1, low],
        [f.side(rOut, true), rOut],
      ],
    }),
  );
  if (bib.pocket && top - waist > 30)
    out.push(
      panel({
        line: Math.max(line, 0.4),
        pts: [
          [-w * 0.55, top - 7],
          [w * 0.55, top - 7],
          [w * 0.55, top - 22],
          [-w * 0.55, top - 22],
        ],
      }),
    );
  if (bib.buttons !== false) {
    const r = strap * 0.45;
    out.push(
      PanelSchema.parse({
        fill: bib.buttons,
        line: 0.4,
        mirror: true,
        x: w - h,
        y: top - 3,
        size: 2 * r,
        path: "M50 0 Q100 0 100 50 Q100 100 50 100 Q0 100 0 50 Q0 0 50 0 Z",
      }),
    );
  }
  return out;
}

/**
 * Điểm mặt trước `x` px dọc mặt khối từ đường giữa, cao hơn hông `y` px (đã chia `rig.height`) nằm dưới yếm: nét và cúc
 * của kiểu ở đó bị yếm che
 */
export function bibCovers(bib: Bib, x: number, y: number) {
  if (y > bib.top) return false;
  if (y < bib.waist) return bib.band || y > bib.waist - 2;
  const t = (y - bib.waist) / Math.max(bib.top - bib.waist, 1e-6);
  return Math.abs(x) < bib.width + bib.flare * (1 - t);
}
