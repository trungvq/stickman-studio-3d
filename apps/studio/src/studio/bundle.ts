import {
  characterFiles,
  parseAction,
  parseCharacter,
  type ActionData,
  type CharacterData,
  type PieceUrls,
} from "@stickman3d/sketch";
import { unzipSync, zipSync, type Zippable } from "fflate";

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const MIME: Record<string, string> = {
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

const base = (path: string) => path.slice(path.lastIndexOf("/") + 1);
/** Phần sau `pieces/`, giữ thư mục con của socket. */
const inPieces = (path: string) => path.slice(path.indexOf("pieces/") + 7);
const mime = (name: string) => MIME[name.slice(name.lastIndexOf(".") + 1).toLowerCase()] ?? "";

/**
 * Gói tự chứa `<tên>/{character.json, action.json, pieces/}`. Tên mảnh trong JSON
 * chính là đường dẫn trong `pieces/` (kèm thư mục socket), nên giải nén ra là nạp lại được ở máy khác.
 */
export async function exportBundle(
  character: CharacterData,
  action: ActionData | null,
  urls: PieceUrls,
): Promise<Blob> {
  const pieces: Zippable = {};
  for (const file of characterFiles(character)) {
    const url = urls[file];
    if (!url) continue;
    const buf = await (await fetch(url)).arrayBuffer();
    // Ảnh đã nén sẵn, nén lại chỉ tốn thời gian
    pieces[file] = [new Uint8Array(buf), { level: 0 }];
  }
  const enc = new TextEncoder();
  const zipped = zipSync({
    [character.name || "character"]: {
      "character.json": enc.encode(JSON.stringify(character, null, 2)),
      ...(action && { "action.json": enc.encode(JSON.stringify(action, null, 2)) }),
      pieces,
    },
  });
  return new Blob([zipped as BlobPart], { type: "application/zip" });
}

export interface Bundle {
  character: CharacterData;
  action: ActionData | null;
  urls: PieceUrls;
  warn: string | null;
}

/** Đọc gói do `exportBundle` sinh ra. Thư mục gốc tên gì cũng được, khớp theo tên file. */
export async function importBundle(file: File): Promise<Bundle> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  const read = (name: string) => {
    const hit = Object.entries(entries).find(([p]) => base(p) === name);
    return hit ? JSON.parse(new TextDecoder().decode(hit[1])) : null;
  };

  const cjson: unknown = read("character.json");
  if (!cjson) throw new Error("Trong zip không có character.json");
  const c = parseCharacter(cjson);
  if (!c.success) throw new Error("character.json trong zip không hợp lệ");
  const ajson: unknown = read("action.json");
  const a = ajson ? parseAction(ajson) : null;

  const imgs = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(entries))
    if (path.includes("pieces/")) imgs.set(inPieces(path), data);

  const urls: PieceUrls = {};
  const missing: string[] = [];
  for (const f of characterFiles(c.data)) {
    const data = imgs.get(f);
    if (!data) missing.push(f);
    else urls[f] = URL.createObjectURL(new Blob([data as BlobPart], { type: mime(f) }));
  }

  return {
    character: c.data,
    action: a?.success ? a.data : null,
    urls,
    warn: missing.length ? `Zip thiếu mảnh: ${missing.join(", ")}` : null,
  };
}
