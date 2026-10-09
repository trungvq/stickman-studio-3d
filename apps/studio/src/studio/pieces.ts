import {
  animalFiles,
  characterFiles,
  type AnimalData,
  type CharacterData,
  type PieceKey,
  type PieceUrls,
} from "@stickman3d/sketch";
import type { Workspace } from "./workspace";

/** Tầm kéo thường ngày của `dx`/`dy`, không phải giới hạn: mũ đã cần `−85`, chừa tới một đầu người */
export const PIECE_SHIFT = 150;

/** Tầm `scale` thường ngày: kính chỉ chiếm nửa đầu nên đáy phải xuống tới `0.1`; đỉnh nới theo giá trị */
export const PIECE_SCALE = { min: 0.1, max: 2.2 };
export const PIECE_WIDTH = { min: 0.5, max: 2.2 };

export const PIECE_LABELS: Record<PieceKey, string> = {
  torso: "Thân áo",
  sleeveNear: "Vai áo — gần",
  sleeveFar: "Vai áo — xa",
  neck: "Khăn cổ",
  hairBack: "Tóc ảnh — sau đầu",
  hair: "Tóc",
  crown: "Mũ / khăn đầu",
  headAcc: "Phụ kiện đầu",
  faceAcc: "Phụ kiện mặt",
  chin: "Râu",
  hem: "Tà áo",
  handNear: "Đồ cầm tay — gần",
  handFar: "Đồ cầm tay — xa",
};

/** Socket studio không cho chỉnh: không có ô ở panel, không bấm chọn được trên sân khấu */
export const HIDDEN_PIECES: readonly PieceKey[] = ["sleeveNear", "sleeveFar"];

export const PIECE_NOTES: Partial<Record<PieceKey, string>> = {
  neck: "socket neck, trên thân áo",
  hairBack: "ảnh, sau cả thân và chân",
  hair: "kiểu tóc, tóc dựng khối hoặc ảnh, trên đầu",
  crown: "socket crown, trên tóc",
  headAcc: "trên mũ, bám sọ",
  faceAcc: "trên nét mặt, trôi theo mặt",
  chin: "râu dựng khối hoặc ảnh, socket chin",
  hem: "socket pelvis",
  handNear: "tâm ở bàn tay, cùng lớp cẳng tay",
  handFar: "tâm ở bàn tay, cùng lớp cẳng tay",
};

export function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Tỉ lệ khung đo từ chính ảnh, khoá theo tên file như `urls`. */
export async function measureAspects(urls: PieceUrls) {
  const aspects: Record<string, number> = {};
  await Promise.all(
    Object.entries(urls).map(async ([file, url]) => {
      const img = await loadImage(url);
      aspects[file] = img.naturalWidth / img.naturalHeight;
    }),
  );
  return aspects;
}

/** Nạp mọi ảnh nhân vật cần — kể cả vật chưa mặc — trả URL và aspect, khoá theo tên file. */
export async function loadPieces(ws: Workspace, c: CharacterData) {
  const urls: PieceUrls = {};
  const aspects: Record<string, number> = {};
  await Promise.all(
    characterFiles(c).map(async (file) => {
      try {
        const img = await loadImage(await ws.pieceUrl(file));
        urls[file] = img.src;
        aspects[file] = img.naturalWidth / img.naturalHeight;
      } catch {
        console.warn(`Không nạp được mảnh ${file}`);
      }
    }),
  );
  return { urls, aspects };
}

/** Nạp ảnh của động vật. Hộp lấy từ bộ xương nên không phải đo `aspect` như mảnh nhân vật. */
export async function loadAnimalPieces(ws: Workspace, b: AnimalData) {
  const urls: PieceUrls = {};
  await Promise.all(
    animalFiles(b).map(async (file) => {
      try {
        urls[file] = (await loadImage(await ws.pieceUrl(file))).src;
      } catch {
        console.warn(`Không nạp được mảnh động vật ${file}`);
      }
    }),
  );
  return urls;
}
