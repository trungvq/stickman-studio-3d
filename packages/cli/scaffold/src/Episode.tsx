import { FRAMES, resolveScene, type FrameName } from "@stickman3d/sketch";
import { useMemo } from "react";
import {
  Audio,
  Loop,
  Sequence,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { useAudioDurations } from "./audio";
import { ACTIONS, ANIMALS, AUDIO, PROPS, SCENES } from "./data";
import type { CueData, EpisodeData, ShotData } from "./episode";
import { Scene } from "./Scene";
import { cueStart, layoutShots, type LaidShot } from "./shots";

const SECONDS: Record<string, number> = {};

/** Độ dài một cảnh; shot không khai `to` thì lấy hết cảnh */
export const sceneSeconds = (name: string): number => {
  const s = SCENES[name];
  if (!s) throw new Error(`không có scenes/${name}.json`);
  return (SECONDS[name] ??= resolveScene(s, ACTIONS, ANIMALS, PROPS).duration);
};

/** Khung của một cảnh — `wide` cho tập, `tall` cho short. docs/03-scene.md#khung-hình */
export const sceneFrame = (name: string): FrameName => {
  const s = SCENES[name];
  if (!s) throw new Error(`không có scenes/${name}.json`);
  return s.frame;
};

/**
 * Cỡ pixel của cả tập. Một tập là một composition nên chỉ có **một** khung: shot trộn
 * `wide` với `tall` thì nổ ở đây, `stickman check` kêu trước.
 */
export const episodeVideo = (ep: EpisodeData, id: string) => {
  const names = new Set(ep.shots.flatMap((s) => (s.scene ? [sceneFrame(s.scene)] : [])));
  if (names.size > 1)
    throw new Error(
      `tập ${id}: các shot trộn khung ${[...names].join(" và ")} — một tập một khung`,
    );
  return FRAMES[[...names][0] ?? "wide"].video;
};

/**
 * Studio chỉ dựng vào cây những shot và cue cách đầu đọc không quá ngần này giây. Mỗi `<Sequence>`
 * trên cây tốn một lượt render **mỗi khung** dù đang ngoài tầm (nó đọc frame qua context), và ở
 * React dev của Studio mỗi lượt kèm `console.createTask`: tập 137 shot xem chỉ ~8 khung/giây.
 * Đổi lại timeline Studio chỉ hiện các shot quanh đầu đọc; tua bằng thước thời gian vẫn tới mọi khung.
 * Lúc render thì dựng đủ cả cây như cũ, để tiếng và hình không khác bản đã đăng.
 */
const NEAR = 3;

/** Khoảng `[from, to)` (khung) có chạm cửa sổ quanh `frame` không; `to` không biết thì coi như kéo tới cuối */
const near = (frame: number, pad: number, from: number, to?: number) =>
  from - pad <= frame && (to === undefined || frame < to + pad);

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Một cue: thẻ `<audio>` với `volume` tính lại mỗi frame, `<Loop>` bọc trong nếu là bè lặp.
 * `<Loop>` phải nằm **dưới** chỗ đọc frame — trong lòng nó frame đếm lại từ 0 mỗi vòng, nên
 * đọc ở trong là `fade` lịm mỗi vòng và `out` không bao giờ tới.
 */
const CueAudio = ({ c, src, seconds }: { c: CueData; src: string; seconds?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let v = c.volume;
  if (c.fade) {
    const at = frame / fps;
    if (c.fade.in > 0) v *= clamp01(at / c.fade.in);
    if (c.fade.out > 0 && seconds) v *= clamp01((seconds - at) / c.fade.out);
  }
  const audio = <Audio src={src} volume={v} />;
  return c.loop ? (
    <Loop durationInFrames={Math.max(1, Math.round(c.loop * fps))} layout="none">
      {audio}
    </Loop>
  ) : (
    audio
  );
};

/**
 * Tiếng của một shot. Mỗi cue là một `<Sequence>` **có độ dài**: hết tiếng là thẻ `<audio>` bị
 * tháo. Cue không khai `dur` thì lấy độ dài đo từ chính file; chưa đo xong thì nó sống tới hết
 * shot như nếp cũ, và một shot dày cue thì số thẻ cùng lúc đủ để kéo preview xuống vài fps.
 * Cue có `loop` là bè nền lặp — `<Loop>` của Remotion chỉ giữ **một** vòng trên cây tại mỗi
 * khung, nên cả chuỗi bước chân dài chỉ tốn một thẻ.
 */
const Cues = ({
  cues,
  fps,
  shot,
  lang,
}: {
  cues: CueData[];
  fps: number;
  shot?: ShotData;
  lang?: string;
}) => {
  const durations = useAudioDurations(AUDIO);
  const frame = useCurrentFrame();
  const all = getRemotionEnvironment().isRendering;
  // `"@mốc"` là mốc của cảnh shot đang chiếu; cue ở tầng tập không có cảnh nào để tra
  const marks = shot?.scene ? SCENES[shot.scene]?.marks : undefined;
  return cues.map((c, i) => {
    // Lồng tiếng: cue lời — có `text` — đổi `<thư mục>/<file>` sang `<thư mục>/<lang>/<file>`, nhạc
    // và tiếng động giữ nguyên. Thiếu bản dịch thì nổ: lặng lẽ rơi về tiếng gốc là lẫn hai thứ
    // tiếng trong một track
    const file = lang && c.text ? c.file.replace(/([^/]*)$/, `${lang}/$1`) : c.file;
    const src = AUDIO[file];
    if (!src && file !== c.file) throw new Error(`cue ${c.file}: chưa có bản lồng tiếng ${file}`);
    if (!src) return null;
    if (c.loop && !c.dur)
      throw new Error(`cue ${c.file}: có \`loop\` thì phải có \`dur\`, không thì lặp tới vô tận`);
    const seconds = c.dur ?? durations[file];
    const at = shot && marks ? cueStart(c, shot, marks) : c.at;
    if (typeof at !== "number")
      throw new Error(`cue ${c.file}: \`at\` là \`${at}\` mà không có cảnh nào để tra mốc`);
    if (!all && !near(frame, NEAR * fps, at * fps, seconds ? (at + seconds) * fps : undefined))
      return null;
    return (
      <Sequence
        key={`${c.file}-${i}`}
        from={Math.round(at * fps)}
        durationInFrames={seconds ? Math.max(1, Math.ceil(seconds * fps)) : undefined}
        layout="none"
      >
        <CueAudio c={c} src={src} seconds={seconds} />
      </Sequence>
    );
  });
};

/**
 * Cả tập trên một trục. Shot xếp **ngược** trong DOM: shot sau nằm dưới, nên `overlap` cho
 * nó chạy sẵn sau lưng shot trước mà không đè lên hình đang chiếu; shot trước hết là nó lộ
 * ra, đang giữa đà. Xem docs/07-lam-tap.md.
 */
export const Episode = ({
  episode,
  fps,
  lang,
}: {
  episode: EpisodeData;
  fps: number;
  /** Ngôn ngữ lồng tiếng — `--props='{"lang":"en"}'`; bỏ trống là tiếng gốc */
  lang?: string;
}) => {
  const frame = useCurrentFrame();
  const all = getRemotionEnvironment().isRendering;
  const laid = useMemo(() => [...layoutShots(episode, fps, sceneSeconds)].reverse(), [episode, fps]);
  return (
    <>
      {laid
        .filter((l) => all || near(frame, NEAR * fps, l.mountFrom, l.from + l.frames))
        .map((l) => (
          <Shot key={l.shot.id} laid={l} fps={fps} lang={lang} />
        ))}
      <Cues cues={episode.audio} fps={fps} lang={lang} />
    </>
  );
};

const Shot = ({ laid, fps, lang }: { laid: LaidShot; fps: number; lang?: string }) => {
  const scene = laid.shot.scene ? SCENES[laid.shot.scene] : undefined;
  return (
    <>
      <Sequence
        from={laid.mountFrom}
        durationInFrames={laid.from + laid.frames - laid.mountFrom}
        name={laid.shot.id}
      >
        {scene ? (
          <Scene scene={scene} at={laid.at} preroll={laid.preroll} table={laid.table} />
        ) : null}
      </Sequence>
      <Sequence from={laid.from} durationInFrames={laid.frames}>
        <Cues cues={laid.shot.audio} fps={fps} shot={laid.shot} lang={lang} />
      </Sequence>
    </>
  );
};
