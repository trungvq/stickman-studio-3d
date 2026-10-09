/**
 * Nơi studio đọc/ghi nhân vật. Hai loại: bộ mẫu đi kèm studio (chỉ đọc), và một
 * thư mục thật trên máy — thường là `assets/` của repo video — mở qua File System
 * Access API. Studio không biết repo nào, người dùng chỉ nó tới.
 */
import {
  PIECE_CATALOG_FILE,
  mergePieceCatalogs,
  parsePieceCatalog,
  type PieceCatalog,
  type PieceCatalogEntry,
  type PieceConfig,
} from "@stickman3d/sketch";

export type RepoDir = "pieces" | "characters" | "actions" | "props" | "animals";
export type TextDir = "characters" | "actions" | "props" | "animals";

export interface Workspace {
  readonly label: string;
  readonly writable: boolean;
  list(dir: TextDir): Promise<string[]>;
  /** Danh mục `pieces/catalog.json`; không có file thì danh mục rỗng */
  pieces(): Promise<PieceCatalog>;
  readText(dir: TextDir, file: string): Promise<string>;
  /** URL để vẽ mảnh ảnh, `file` có thể mang thư mục con (`hair/x.png`); object URL thì gọi `release()` lúc đổi workspace */
  pieceUrl(file: string): Promise<string>;
  writeText(dir: TextDir, file: string, text: string): Promise<void>;
  /** Ghi cấu hình lúc cắm vào `pieces/catalog.json` của lớp ghi được — theo tên bộ phận, hoặc theo mục mảnh ảnh */
  savePieceConfig(target: PieceTarget, config: PieceConfig): Promise<void>;
  release(): void;
}

export type PieceTarget = { part: string } | { entry: PieceCatalogEntry };

export const FIXTURES_LABEL = "bộ mẫu đi kèm";

const EMPTY: PieceCatalog = { schemaVersion: 1, pieces: [], parts: {} };

function readCatalog(text: string): PieceCatalog {
  const r = parsePieceCatalog(JSON.parse(text));
  if (!r.success) throw new Error(`pieces/${PIECE_CATALOG_FILE} sai định dạng: ${r.error.message}`);
  return r.data;
}

/**
 * Bộ mẫu nằm trong `public/` của chính studio; chỉ để chạy thử và chụp hình kiểm tra.
 * `stickman studio` đè workspace thật lên cùng đường dẫn và đặt nhãn qua `/workspace.json`.
 */
export function fixtureWorkspace(label = FIXTURES_LABEL): Workspace {
  return {
    label,
    writable: false,
    async list(dir) {
      const r = await fetch(`/${dir}/index.json`);
      if (!r.ok) return [];
      const j: unknown = await r.json();
      return Array.isArray(j) ? j.filter((f): f is string => typeof f === "string") : [];
    },
    async pieces() {
      const r = await fetch(`/pieces/${PIECE_CATALOG_FILE}`);
      return r.ok ? readCatalog(await r.text()) : EMPTY;
    },
    async readText(dir, file) {
      const r = await fetch(`/${dir}/${file}`);
      if (!r.ok) throw new Error(`Không đọc được ${file}`);
      return r.text();
    },
    pieceUrl: (file) => Promise.resolve(`/pieces/${file}`),
    writeText: () => Promise.reject(new Error("Bộ mẫu chỉ đọc")),
    savePieceConfig: () => Promise.reject(new Error("Bộ mẫu chỉ đọc")),
    release: () => {},
  };
}

/** Nhãn do `stickman studio` khai; bộ mẫu tĩnh không có file này */
export async function servedLabel() {
  try {
    const r = await fetch("/workspace.json");
    const j: unknown = r.ok ? await r.json() : null;
    const label = j && typeof j === "object" ? (j as { label?: unknown }).label : null;
    return typeof label === "string" ? label : null;
  } catch {
    return null;
  }
}

export const canOpenDirectory = () => "showDirectoryPicker" in window;

/** Ghi file, bản cũ giữ ở `<file>.bak` (ghi đè mỗi lần) để lỡ tay còn lấy lại */
async function writeWithBackup(d: FileSystemDirectoryHandle, file: string, text: string) {
  const h = await d.getFileHandle(file, { create: true });
  const old = await (await h.getFile()).text();
  if (old) {
    const b = await (await d.getFileHandle(`${file}.bak`, { create: true })).createWritable();
    await b.write(old);
    await b.close();
  }
  const w = await h.createWritable();
  await w.write(text);
  await w.close();
}

const hidden = (name: string) =>
  name === "index.json" || name.startsWith(".") || !name.endsWith(".json");

/** Một thư mục thật: cần `characters/`, `actions/`, `pieces/` bên trong; `props/` và `animals/` tuỳ. */
export function directoryWorkspace(root: FileSystemDirectoryHandle): Workspace {
  const made = new Set<string>();
  const sub = async (dir: RepoDir, create = false) => {
    try {
      return await root.getDirectoryHandle(dir, { create });
    } catch {
      return null;
    }
  };
  const fileIn = async (d: FileSystemDirectoryHandle, path: string) => {
    const parts = path.split("/");
    for (const seg of parts.slice(0, -1)) d = await d.getDirectoryHandle(seg);
    return (await d.getFileHandle(parts[parts.length - 1])).getFile();
  };
  return {
    label: root.name,
    writable: true,
    async list(dir) {
      const d = await sub(dir);
      if (!d) return [];
      const out: string[] = [];
      for await (const [name, h] of d.entries())
        if (h.kind === "file" && !hidden(name)) out.push(name);
      return out.sort();
    },
    async pieces() {
      const d = await sub("pieces");
      if (!d) return EMPTY;
      try {
        return readCatalog(await (await fileIn(d, PIECE_CATALOG_FILE)).text());
      } catch (e) {
        if (e instanceof DOMException) return EMPTY;
        throw e;
      }
    },
    async readText(dir, file) {
      const d = await sub(dir);
      if (!d) throw new Error(`Thư mục thiếu ${dir}/`);
      return (await (await d.getFileHandle(file)).getFile()).text();
    },
    async pieceUrl(file) {
      const d = await sub("pieces");
      if (!d) throw new Error("Thư mục thiếu pieces/");
      const url = URL.createObjectURL(await fileIn(d, file));
      made.add(url);
      return url;
    },
    async writeText(dir, file, text) {
      const d = await sub(dir, true);
      if (!d) throw new Error(`Không tạo được ${dir}/`);
      await writeWithBackup(d, file, text);
    },
    async savePieceConfig(target, config) {
      const cat = structuredClone(await this.pieces());
      if ("part" in target) cat.parts[target.part] = config;
      else {
        // Mục chỉ có ở bộ chung thì chép sang lớp này, đè config mà không chép ảnh
        const i = cat.pieces.findIndex((e) => e.file === target.entry.file);
        const entry = { ...target.entry, config };
        if (i < 0) cat.pieces.push(entry);
        else cat.pieces[i] = entry;
      }
      const d = await sub("pieces", true);
      if (!d) throw new Error("Không tạo được pieces/");
      await writeWithBackup(d, PIECE_CATALOG_FILE, `${JSON.stringify(cat, null, 2)}\n`);
    },
    release() {
      for (const u of made) URL.revokeObjectURL(u);
      made.clear();
    },
  };
}

/**
 * Hai lớp: thư mục thật của repo video đè lên bộ mẫu đi kèm studio. `characters/`, `actions/`,
 * `animals/` và `pieces/` (kể cả danh mục) đọc ở `local` trước, không có thì rơi về `common`;
 * ghi luôn vào `local`. Đạo cụ chỉ có ở `local` — bộ mẫu của chúng `stickman init` đã chép sang.
 */
export function layeredWorkspace(local: Workspace, common: Workspace): Workspace {
  const shared = (dir: TextDir) => dir !== "props";

  return {
    label: local.label,
    writable: local.writable,
    async list(dir) {
      const mine = await local.list(dir);
      if (!shared(dir)) return mine;
      const theirs = await common.list(dir).catch(() => [] as string[]);
      return [...new Set([...mine, ...theirs])].sort();
    },
    async pieces() {
      const [mine, theirs] = await Promise.all([
        local.pieces(),
        common.pieces().catch(() => EMPTY),
      ]);
      return mergePieceCatalogs(mine, theirs);
    },
    readText: (dir, file) =>
      shared(dir)
        ? local.readText(dir, file).catch(() => common.readText(dir, file))
        : local.readText(dir, file),
    pieceUrl: (file) => local.pieceUrl(file).catch(() => common.pieceUrl(file)),
    writeText: (dir, file, text) => local.writeText(dir, file, text),
    savePieceConfig: (target, config) => local.savePieceConfig(target, config),
    release() {
      local.release();
      common.release();
    },
  };
}

const DB = "stickman-studio";
const STORE = "handles";

function open() {
  return new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
  return open().then(
    (db) =>
      new Promise<T>((res, rej) => {
        const r = fn(db.transaction(STORE, mode).objectStore(STORE));
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      }),
  );
}

export const rememberDirectory = (h: FileSystemDirectoryHandle) =>
  tx("readwrite", (s) => s.put(h, "root")).catch(() => undefined);

export const forgetDirectory = () =>
  tx("readwrite", (s) => s.delete("root")).catch(() => undefined);

/** Handle của lần trước, chỉ khi trình duyệt còn cho quyền mà không phải hỏi lại. */
export async function recallDirectory() {
  try {
    const h = await tx<FileSystemDirectoryHandle | undefined>("readonly", (s) => s.get("root"));
    if (!h) return null;
    const perm = await h.queryPermission({ mode: "readwrite" });
    return perm === "granted" ? h : null;
  } catch {
    return null;
  }
}

export async function pickDirectory() {
  const h = await window.showDirectoryPicker({ id: "stickman-assets", mode: "readwrite" });
  if ((await h.requestPermission({ mode: "readwrite" })) !== "granted")
    throw new Error("Không được cấp quyền ghi vào thư mục");
  return h;
}
