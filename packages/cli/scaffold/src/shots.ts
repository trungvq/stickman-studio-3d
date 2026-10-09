// Xếp shot lên trục thời gian của tập. Tách khỏi composition vì **hai** thứ cần nó:
// composition trong bundler, và công cụ sinh `.srt` chạy thẳng bằng node.
// Xem docs/07-lam-tap.md § Bảng thời gian của cả tập.
import type { CueData, EpisodeData, ShotData } from "./episode";
import { markTime, screenTime, warpTable } from "@stickman3d/sketch";

export interface LaidShot {
  shot: ShotData;
  /** Frame tập shot lên hình */
  from: number;
  /** Số frame shot chiếm trên trục tập */
  frames: number;
  /** Frame shot được mount, sớm hơn `from` đúng `overlap` — nó chạy sau lưng shot trước */
  mountFrom: number;
  /** Giây màn hình chạy trước cú cắt; suy từ `mountFrom` nên không lệch được với nó */
  preroll: number;
  /** Giây cảnh lúc shot mở màn */
  at: number;
  /** Bảng slow-mo của shot; `<Scene>` và công cụ ngoài đọc chung một bảng */
  table: ReturnType<typeof warpTable>;
}

/**
 * `sceneDuration` trả độ dài (giây cảnh) của một file trong `scenes/`; shot không có
 * `scene` thì phải tự khai `duration`. **Cộng dồn bằng frame, không bằng giây** — cộng
 * giây rồi mới đổi là trôi frame.
 */
export function layoutShots(
  ep: EpisodeData,
  fps: number,
  sceneDuration: (name: string) => number,
): LaidShot[] {
  const out: LaidShot[] = [];
  let from = 0;
  for (const shot of ep.shots) {
    const table = warpTable(shot.slow);
    let seconds = shot.duration;
    if (seconds === undefined) {
      if (!shot.scene)
        throw new Error(`shot ${shot.id}: không có \`scene\` thì phải có \`duration\``);
      const to = shot.to ?? sceneDuration(shot.scene);
      if (to <= shot.from) throw new Error(`shot ${shot.id}: \`to\` phải lớn hơn \`from\``);
      // `slow` khai theo giây kể từ đầu shot, nên đổi sang giây màn hình cũng đo từ đó
      seconds = screenTime(to - shot.from, table);
    }
    const frames = Math.max(1, Math.round((seconds + shot.hold) * fps));
    const mountFrom = Math.max(0, from - Math.round(shot.overlap * fps));
    out.push({
      shot,
      from,
      frames,
      mountFrom,
      preroll: (from - mountFrom) / fps,
      at: shot.from,
      table,
    });
    from += frames;
  }
  return out;
}

export const episodeFrames = (laid: LaidShot[]): number =>
  Math.max(
    1,
    laid.reduce((n, l) => n + l.frames, 0),
  );

/** Tên của một cue để cue khác neo vào: `id`, hay tên file không đuôi, không thư mục `t<nn>/` */
export const cueId = (c: Pick<CueData, "id" | "file">): string =>
  c.id ?? c.file.replace(/^.*\//, "").replace(/\.[^.]+$/, "");

/**
 * Giây màn hình một cue vào, tính từ đầu shot. Số giữ nguyên; `"@mốc"` tra `marks` của cảnh
 * shot đang chiếu rồi đổi giây cảnh ra giây màn hình qua bảng slow-mo của shot — cùng phép
 * đổi `layoutShots` dùng cho độ dài shot. Mốc trước `from` của shot thì cue vào ngay đầu shot.
 */
export function cueStart(
  cue: Pick<CueData, "at" | "file">,
  shot: Pick<ShotData, "from" | "slow">,
  marks: Record<string, number>,
): number {
  if (typeof cue.at === "number") return cue.at;
  const t = markTime(cue.at, marks, `cue ${cue.file}`);
  return Math.max(0, screenTime(t - shot.from, warpTable(shot.slow)));
}
