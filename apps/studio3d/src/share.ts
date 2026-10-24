// View trong URL (cảnh, giây, camera tự do, bàn tay đang chọn) và đoạn chữ của **Chép view** cho agent. README.md#chép-view
import type { HandSide } from "@stickman3d/rig";

export type V3 = [number, number, number];

export interface ViewState {
  scene?: string;
  t: number;
  cam: "scene" | "free";
  /** Camera tự do, hệ three: chỗ đứng, tâm xoay, fov dọc (độ) */
  free?: { pos: V3; at: V3; fov: number };
  hand?: { id: string; side: HandSide };
  solo?: boolean;
  ed?: "view" | "hands";
}

const KEYS = ["scene", "t", "cam", "pos", "at", "fov", "hand", "solo", "ed"];
const num = (v: number, d = 3) => String(Number(v.toFixed(d)));
const vec = (v: V3) => v.map((x) => num(x)).join(",");

function readVec(s: string | null): V3 | undefined {
  const v = s?.split(",").map(Number);
  return v?.length === 3 && v.every(Number.isFinite) ? (v as V3) : undefined;
}

/** Ghi view vào `p` (giữ tham số khác của URL); khoá của view không có trong `v` thì bỏ */
export function writeView(p: URLSearchParams, v: ViewState): URLSearchParams {
  for (const k of KEYS) p.delete(k);
  if (v.scene) p.set("scene", v.scene);
  p.set("t", v.t.toFixed(3));
  p.set("cam", v.cam);
  if (v.cam === "free" && v.free) {
    p.set("pos", vec(v.free.pos));
    p.set("at", vec(v.free.at));
    p.set("fov", num(v.free.fov, 2));
  }
  if (v.hand) p.set("hand", `${v.hand.id}:${v.hand.side}`);
  if (v.solo) p.set("solo", "1");
  if (v.ed === "hands") p.set("ed", "hands");
  return p;
}

/** Đọc view từ URL; khoá sai thì bỏ khoá ấy */
export function readView(p: URLSearchParams): ViewState {
  const v: ViewState = { t: Math.max(0, Number(p.get("t")) || 0), cam: "scene" };
  const scene = p.get("scene");
  if (scene) v.scene = scene;
  if (p.get("cam") === "free") v.cam = "free";
  const pos = readVec(p.get("pos"));
  const at = readVec(p.get("at"));
  const fov = Number(p.get("fov"));
  if (v.cam === "free" && pos && at)
    v.free = { pos, at, fov: Number.isFinite(fov) && fov > 1 && fov < 179 ? fov : 30 };
  const m = p.get("hand")?.match(/^(.+):(left|right)$/);
  if (m) v.hand = { id: m[1], side: m[2] as HandSide };
  if (p.get("solo") === "1") v.solo = true;
  if (p.get("ed") === "hands") v.ed = "hands";
  return v;
}

/** Điểm hệ three ra hệ rig (px, y xuống, z sâu vào cảnh): ngược `toThree` */
export const toRig = (p: V3): V3 => [p[0] * 100, -p[1] * 100, -p[2] * 100];

/** `scene.lens` như trong JSON cảnh: hệ rig, góc độ, `f` px trên khung sân khấu */
export interface LensJson {
  eye: V3;
  yaw: number;
  pitch: number;
  f: number;
  cx?: number;
  cy?: number;
}

const D = Math.PI / 180;

/**
 * Camera three (chỗ đứng, hướng nhìn, fov dọc của khung vẽ tỉ lệ `aspect`) thành `scene.lens` trên sân khấu `stage`:
 * ngược `lensCamera`; khung cắt mặc định (x 0, y 0, zoom 1) thì camera cảnh thấy đúng khung vẽ
 */
export function lensOf(
  pos: V3,
  dir: V3,
  fov: number,
  stage: { w: number; h: number },
  aspect: number,
): LensJson {
  const n = Math.hypot(...dir);
  // khung vẽ rộng hơn sân khấu thì giữ bề cao, hẹp hơn thì giữ bề ngang (`viewRect`)
  const h = Math.max(stage.h, stage.w / aspect);
  const r = (v: number, d: number) => Number(v.toFixed(d));
  return {
    eye: toRig(pos).map((x) => r(x, 1)) as V3,
    yaw: r(Math.atan2(dir[0], -dir[2]) / D, 2),
    pitch: r(Math.asin(-dir[1] / n) / D, 2),
    f: r(h / 2 / Math.tan((fov / 2) * D), 1),
  };
}

export interface NoteInput {
  root: string;
  scene: string;
  /** Cảnh của repo (`worldOf`) hay `plainRoom()` */
  from: "world" | "plain";
  t: number;
  dur: number;
  marks: Record<string, number>;
  url: string;
  /** Đường ảnh khung vẽ đã lưu; `pngError` khi lưu hỏng */
  png?: string;
  pngError?: string;
  view: ViewState;
  /** Camera tự do đã quy ra `scene.lens` (`lensOf`) */
  freeLens?: LensJson;
  /** Camera cảnh: ống kính và khung cắt `cameraAt` ở giây này; `lensFrom` `world` là ống kính do `worldOf` đặt theo giây */
  shot?: {
    lens?: LensJson;
    lensFrom: "scene" | "world";
    crop: { x: number; y: number; zoom: number };
  };
  /** Khung sân khấu (`rt.frame`) */
  stage: { w: number; h: number };
  /** Bàn tay đang chọn: nhãn, nguồn dáng (`sourceLines`), số đo */
  hand?: { label: string; source?: string[]; measure: string[] };
  /** Bàn tay đang cầm, treo đồ ở giây này */
  hands: string[];
  /** Mốc đang mở thẻ (Dáng tay) */
  picked?: string;
  editor?: string;
  dirty: boolean;
}

const fmt = (v: V3, d = 2) => `(${v.map((x) => x.toFixed(d)).join(", ")})`;

/** Mốc của cảnh gần `t` nhất, trong `win` giây */
function nearMark(marks: Record<string, number>, t: number, win = 0.5) {
  let best: [string, number] | undefined;
  for (const [k, v] of Object.entries(marks))
    if (
      typeof v === "number" &&
      Math.abs(v - t) <= win &&
      (!best || Math.abs(v - t) < Math.abs(best[1] - t))
    )
      best = [k, v];
  return best;
}

/** Đoạn chữ dán cho agent: đủ để tìm file, tua đúng giây, dựng lại đúng góc nhìn và đọc ảnh */
export function viewNote(o: NoteInput): string {
  const file = `scenes/${o.scene}.json`;
  const mark = nearMark(o.marks, o.t);
  const L: string[] = [
    `Studio 3D — view đang xem`,
    `- Repo video: ${o.root}`,
    `- Cảnh: \`${o.scene}\` — ${file}${o.from === "plain" ? " (worldOf không dựng: plainRoom)" : ""}`,
    `- Giây: ${o.t.toFixed(3)} s / ${o.dur.toFixed(2)} s${
      mark ? ` · mốc gần: @${mark[0]} = ${mark[1].toFixed(2)} s` : ""
    }`,
  ];
  if (o.png) L.push(`- Ảnh khung vẽ (đúng như trên màn hình): ${o.png}`);
  else if (o.pngError) L.push(`- Ảnh khung vẽ: không lưu được (${o.pngError})`);
  L.push(`- Mở lại đúng view trong Studio 3D đang chạy: ${o.url}`);
  const lens = (l: LensJson) => `\`"lens": ${JSON.stringify(l)}\``;
  const stage = `khung sân khấu ${o.stage.w}×${o.stage.h}`;
  if (o.view.cam === "free" && o.view.free) {
    const f = o.view.free;
    if (o.freeLens)
      L.push(
        `- Camera tự do, quy sẵn ra ống kính cảnh (hệ rig: px, y xuống, z sâu; góc độ; ${stage}): ${lens(o.freeLens)}` +
          ` — dán làm \`scene.lens\` và để khung cắt \`camera[]\` ở x 0, y 0, zoom 1 thì camera cảnh thấy đúng ảnh`,
      );
    L.push(
      `  tâm xoay hệ rig ${fmt(toRig(f.at), 0)}; link mở lại giữ camera ở hệ three (m, y lên): ở ${fmt(f.pos)}, tâm xoay ${fmt(f.at)}, fov ${num(f.fov, 1)}°`,
    );
  } else if (o.shot) {
    const c = o.shot.crop;
    L.push(
      o.shot.lens
        ? `- Camera cảnh: ${lens(o.shot.lens)}${o.shot.lensFrom === "world" ? " (do `worldOf` đặt theo giây, không phải `scene.lens`)" : " (`scene.lens`)"} (hệ rig: px, y xuống, z sâu; góc độ)`
        : `- Camera cảnh: cảnh không có \`scene.lens\``,
      `  khung cắt \`cameraAt\` ở giây này: x ${num(c.x, 1)}, y ${num(c.y, 1)}, zoom ${num(c.zoom)} (${stage})`,
    );
  }
  if (o.view.ed === "hands")
    L.push(`- Chế độ: Dáng tay${o.picked ? ` · mốc đang mở: ${o.picked}` : ""}`);
  if (o.editor) L.push(`- Đang mở: ${o.editor} (ảnh là khung cảnh phía sau)`);
  if (o.hand) {
    L.push(
      `- Bàn tay đang chọn: ${o.hand.label}${o.view.solo ? " · Chỉ người này: bật (ảnh chỉ có người ấy)" : ""}`,
    );
    for (const m of o.hand.source ?? []) L.push(`  ${m}`);
    for (const m of o.hand.measure) L.push(`  ${m}`);
  }
  if (o.hands.length) {
    L.push(`- Bàn tay đang cầm, treo đồ ở giây này:`);
    for (const h of o.hands) L.push(`  - ${h}`);
  }
  if (o.dirty)
    L.push(
      `- ⚠ Có thay đổi chưa lưu: ${file} trên đĩa khác bản đang xem (link mở lại bản trên đĩa)`,
    );
  if (o.view.cam === "scene")
    L.push(
      `- Vẽ lại không cần trình duyệt: pnpm exec stickman-render --scene ${file} --three --times ${num(o.t)} --out tmp/studio3d/${o.scene}-render.png`,
    );
  return L.join("\n");
}
