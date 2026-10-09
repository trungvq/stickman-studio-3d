/**
 * Mái đời trước v5 → [kiểu tóc hoặc nhóm mái, dx, dy, scale, widthScale]. Bốn số là số căn mà kiểu
 * tóc đã nướng vào hình; số căn của nhân vật đổi ra độ lệch so với chúng.
 */
const OLD_HAIR: Record<string, [string, number, number, number, number]> = {
  "hair-f-21": ["hair-low-tail", 0, -39, 1.6, 1],
  "hair-f-20": ["hair-bob-chin", 0, -39, 1.6, 1],
  "hair-f-19": ["hair-bob-shoulder", 0, -39, 1.6, 1],
  "hair-m-19": ["hair-side-part", 0, -39, 1.6, 1.04],
  "hair-f-01": ["blunt", 0, -38, 0.9, 1],
  "hair-f-02": ["center", 0, -38, 0.9, 1],
  "hair-f-03": ["swept", 0, -38, 0.9, 1],
  "hair-f-04": ["swept", 0, -38, 0.9, 1],
  "hair-f-05": ["blunt", 0, -38, 0.9, 1],
  "hair-f-06": ["center", 0, -38, 0.9, 1],
  "hair-f-07": ["swept", 0, -38, 0.9, 1],
  "hair-f-08": ["swept", 0, -38, 0.9, 1],
  "hair-f-09": ["center", 0, -38, 0.9, 1],
  "hair-f-10": ["blunt", 0, -38, 0.9, 1],
  "hair-f-11": ["swept", 0, -38, 0.9, 1],
  "hair-f-12": ["center", 0, -38, 0.9, 1],
  "hair-f-13": ["swept", 0, -38, 0.9, 1],
  "hair-f-14": ["swept", 0, -38, 0.9, 1],
  "hair-f-15": ["blunt", 0, -26, 0.9, 1],
  "hair-f-16": ["swept", 0, -26, 0.9, 1.1],
  "hair-f-17": ["hair-bun-high", 0, -31, 0.9, 1.1],
  "hair-f-18": ["swept", -5, -34, 0.9, 1.1],
  "hair-m-01": ["hair-spiky", -2, -34, 0.9, 1.1],
  "hair-m-02": ["hair-neat-part", 0, -34, 0.9, 1.1],
  "hair-m-03": ["hair-spiky", 1.2, -31.8, 0.974, 1],
  "hair-m-04": ["hair-neat-part", -1, -37, 0.9, 1.1],
  "hair-m-06": ["hair-spiky", 0, -35, 0.96, 1.1],
  "hair-m-07": ["hair-slick-back", 0, -38, 0.9, 1],
  "hair-m-10": ["hair-buzz", -1, -32, 0.9, 1],
  "hair-m-11": ["hair-short-round", 0, -31, 0.9, 1.06],
  "hair-m-12": ["hair-short-round", 0, -34, 0.9, 1.06],
  "hair-m-13": ["hair-neat-part", 0, -35, 0.9, 1.08],
  "hair-m-14": ["hair-slick-back", 0, -38, 0.9, 1],
  "hair-m-15": ["hair-bald", 0, -26, 0.9, 1.1],
  "hair-m-16": ["hair-bald", 0, -30, 0.9, 1.14],
  "hair-m-17": ["hair-bald", 0, -32, 0.9, 1.06],
  "hair-m-18": ["hair-short-round", 0, -33, 0.9, 1.12],
  "sage-bun": ["hair-bun-high", -1, -84, 1.11, 1],
};

const SHOULDER = ["hairback-f-06", "hairback-f-07"];
const LONG = ["hairback-f-01", "hairback-f-02", "hairback-f-05", "hairback-f-08", "sage-long"];
const TIED = ["hairback-f-03", "hairback-f-04", "hairback-f-09", "hairback-f-10"];

/** Mái `blunt` / `center` / `swept` chọn kiểu theo độ dài của mảng sau */
function styleOf(group: string, back: string | undefined): string {
  if (group.startsWith("hair-")) return group;
  if (back && TIED.includes(back)) return "hair-low-tail";
  if (back && SHOULDER.includes(back))
    return group === "blunt" ? "hair-shoulder-blunt" : "hair-shoulder-swept";
  if (back && LONG.includes(back))
    return group === "blunt" ? "hair-long-blunt" : "hair-long-center";
  return "hair-bob-chin";
}

type Piece = Record<string, unknown>;
const num = (v: unknown, d: number) => (typeof v === "number" ? v : d);

/**
 * v4 → v5: cặp `hair` + `hairBack` dạng `part` gộp thành một kiểu tóc ở `hair`. Kiểu tóc phóng quanh
 * tâm sọ, mái cũ phóng quanh mép trên hộp, nên `dy` bù phần chênh ấy. docs/02-trang-phuc.md#kiểu-tóc
 */
export function migrateHairPieces(pieces: Record<string, Piece | undefined>, headH: number) {
  const hair = pieces.hair;
  const back = pieces.hairBack;
  const backPart = back?.src === "part" ? (back.part as string) : undefined;
  const old = hair?.src === "part" ? OLD_HAIR[hair.part as string] : undefined;
  if (backPart) {
    back!.src = "none";
    delete back!.part;
  }
  if (!hair || !old) return;
  const [group, bdx, bdy, bs, bws] = old;
  const r = num(hair.scale, 1) / bs;
  const rw = num(hair.widthScale, 1) / bws;
  hair.part = styleOf(group, backPart);
  hair.scale = r;
  hair.widthScale = rw;
  hair.dx = num(hair.dx, 0) - r * rw * bdx;
  hair.dy = num(hair.dy, 0) - r * bdy + ((r - 1) * headH) / 2;
  hair.aspect = 1;
}
