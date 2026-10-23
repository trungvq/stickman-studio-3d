// JSON và PNG nạp qua bundler, không qua `staticFile` — thư mục thật của workspace
// (`actions/`, `characters/`, `scenes/`, `props/`, `animals/`, `pieces/`) chính là nguồn, không phải `public/`.
// Thêm file vào các thư mục ấy là Remotion Studio thấy ngay, khỏi sửa file này. `scenes/`, `episodes/` và `assets/audio/`
// chỉ vào bundle phần thuộc phạm vi bundle (`tools/scope.mjs`, docs/03-scene.md#phạm-vi-bundle): plugin của
// `tools/webpack.mjs` thu hẹp ba context ấy, nên `SCENES`, `EPISODES`, `AUDIO` chỉ có phần ấy.
// `actions/`, `animals/`, `characters/`, `held/`, `hands/` và `pieces/` có bộ chung của studio làm lớp dưới: `@stickman-common` là alias

// `remotion.config.ts` trỏ vào `@stickman3d/cli`; file cùng tên thì bản của repo đè.
import {
  animalFiles,
  body3,
  characterFiles,
  handShapeNameProblem,
  parseAction,
  parseAnimal,
  parseCharacter,
  parseHandShape,
  parseHeldItem,
  parseProp,
  parseScene,
  pieceFile,
  type ActionData,
  type AnimalData,
  type Body3,
  type CharacterData,
  type HandShape,
  type HandShapes,
  type HeldItemSpec,
  type PieceUrls,
  type PropData,
  type SceneData,
} from "@stickman3d/sketch";
import { parseEpisode, type EpisodeData } from "./episode";

type Ctx = { keys: () => string[]; (id: string): unknown };
declare const require: { context: (dir: string, deep: boolean, re: RegExp) => Ctx };

// webpack chỉ hiểu `require.context` khi regex viết thẳng tại chỗ, không qua biến
const actionsCtx = require.context("../actions", false, /\.json$/);
const charactersCtx = require.context("../characters", false, /\.json$/);
const scenesCtx = require.context("../scenes", false, /\.json$/);
const propsCtx = require.context("../props", false, /\.json$/);
const animalsCtx = require.context("../animals", false, /\.json$/);
const heldCtx = require.context("../held", false, /\.json$/);
const handsCtx = require.context("../hands", false, /\.json$/);
const piecesCtx = require.context("../pieces", true, /\.png$/);
const episodesCtx = require.context("../episodes", false, /\.json$/);
// Nền và tiếng nằm ở `assets/`, không phải `pieces/` — chúng không phải mảnh của ai
const bgCtx = require.context("../assets/bg", true, /\.(png|jpe?g|webp|svg)$/);
const audioCtx = require.context("../assets/audio", true, /\.(mp3|wav|m4a|ogg)$/);
// Bộ mẫu của studio có `index.json` để liệt kê, không phải hành động
const commonActionsCtx = require.context(
  "@stickman-common/actions",
  false,
  /^\.\/(?!index\.json$).+\.json$/,
);
const commonAnimalsCtx = require.context(
  "@stickman-common/animals",
  false,
  /^\.\/(?!index\.json$).+\.json$/,
);
const commonHeldCtx = require.context(
  "@stickman-common/held",
  false,
  /^\.\/(?!index\.json$).+\.json$/,
);
const commonHandsCtx = require.context(
  "@stickman-common/hands",
  false,
  /^\.\/(?!index\.json$).+\.json$/,
);
const commonCharactersCtx = require.context(
  "@stickman-common/characters",
  false,
  /^\.\/(?!index\.json$).+\.json$/,
);
const commonPiecesCtx = require.context("@stickman-common/pieces", true, /\.png$/);

// Asset module trả `{ default: url }`, JSON trả thẳng object
const unwrap = (m: unknown) => (m as { default?: unknown })?.default ?? m;
const name = (key: string) => key.replace(/^\.\//, "");

/** Lớp sau đè lớp trước theo tên file */
function load<T>(
  ctxs: Ctx[],
  parse: (j: unknown) => { success: boolean; data?: T; error?: Error },
) {
  const out: Record<string, T> = {};
  for (const ctx of ctxs)
    for (const key of ctx.keys()) {
      const r = parse(unwrap(ctx(key)));
      if (!r.success) throw new Error(`${name(key)}: ${r.error?.message}`);
      out[name(key)] = r.data as T;
    }
  return out;
}

/** Hành động lấy khoá không đuôi — clip trong scene gọi bằng tên trần */
export const ACTIONS: Record<string, ActionData> = Object.fromEntries(
  Object.entries(load<ActionData>([commonActionsCtx, actionsCtx], parseAction)).map(([f, a]) => [
    f.replace(/\.json$/, ""),
    a,
  ]),
);

/** Nhân vật giữ cả đuôi — `cast[].character` trỏ bằng tên file */
export const CHARACTERS: Record<string, CharacterData> = load<CharacterData>(
  [commonCharactersCtx, charactersCtx],
  parseCharacter,
);

export const SCENES: Record<string, SceneData> = Object.fromEntries(
  Object.entries(load<SceneData>([scenesCtx], parseScene)).map(([f, s]) => [
    f.replace(/\.json$/, ""),
    s,
  ]),
);

/** Đạo cụ giữ cả đuôi như nhân vật — `props[].prop` trỏ bằng tên file */
export const PROPS: Record<string, PropData> = load<PropData>([propsCtx], parseProp);

/** `rig.height` của từng người trong `cast` — `resolveScene` cần để đạo cụ theo người và người ngồi xe trôi đúng */
export const castHeights = (scene: SceneData): Record<string, number> =>
  Object.fromEntries(
    scene.cast.map((m) => [m.id, (m.character && CHARACTERS[m.character]?.rig.height) || 1]),
  );

/** `body3` của từng người trong `cast` — `resolveScene` cần để người 3D đi theo `path` bước đúng hông */
export const castBodies = (scene: SceneData): Record<string, Body3> =>
  Object.fromEntries(
    scene.cast.flatMap((m) => {
      const c = m.character && CHARACTERS[m.character];
      return c ? [[m.id, body3(c)]] : [];
    }),
  );

/** Động vật giữ cả đuôi — `animals[].animal` trỏ bằng tên file; `resolveScene` cần bảng này */
export const ANIMALS: Record<string, AnimalData> = load<AnimalData>(
  [commonAnimalsCtx, animalsCtx],
  parseAnimal,
);

/** Món cầm tay lấy khoá không đuôi — `world.hands[].hold` gọi bằng `món@nhóm`; `resolveScene` cần bảng này */
export const HELD: Record<string, HeldItemSpec> = Object.fromEntries(
  Object.entries(load<HeldItemSpec>([commonHeldCtx, heldCtx], parseHeldItem)).map(([f, h]) => [
    f.replace(/\.json$/, ""),
    h,
  ]),
);

/** Dáng tay có tên lấy khoá không đuôi — `world.hands[].right|left.pose` gọi bằng tên; `resolveScene` cần bảng này */
export const HANDS: HandShapes = Object.fromEntries(
  Object.entries(load<HandShape>([commonHandsCtx, handsCtx], parseHandShape))
    .map(([f, h]) => [f.replace(/\.json$/, ""), h] as const)
    .filter(([n]) => !handShapeNameProblem(n)),
);

/** Một composition cho mỗi file trong `episodes/` của phạm vi bundle, như `scenes/` */
export const EPISODES: Record<string, EpisodeData> = Object.fromEntries(
  Object.entries(load<EpisodeData>([episodesCtx], parseEpisode)).map(([f, e]) => [
    f.replace(/\.json$/, ""),
    e,
  ]),
);

const PIECES: Record<string, string> = Object.fromEntries(
  [commonPiecesCtx, piecesCtx].flatMap((ctx) =>
    ctx.keys().map((k) => [name(k), unwrap(ctx(k)) as string]),
  ),
);

/** Tấm nền, khoá theo tên file dưới `assets/bg/` — `scene.bg.file` trỏ bằng tên ấy */
export const BACKGROUNDS: Record<string, string> = Object.fromEntries(
  bgCtx.keys().map((k) => [name(k), unwrap(bgCtx(k)) as string]),
);

/** Tiếng, khoá theo tên file dưới `assets/audio/` — `shots[].audio[].file` trỏ bằng tên ấy */
export const AUDIO: Record<string, string> = Object.fromEntries(
  audioCtx.keys().map((k) => [name(k), unwrap(audioCtx(k)) as string]),
);

/** Mọi ảnh bundler biết tới, khoá theo tên file mảnh: `useImagesReady` gác chúng trước khi
 *  Remotion chụp khung, và đo `aspect` từ đó. Thêm nguồn ảnh khác thì nối vào đây,
 *  không thì cú cắt vào nó ra khung giấy trắng. */
export const ALL_IMAGES: Readonly<Record<string, string>> = { ...PIECES, ...BACKGROUNDS };

/** Khoá theo tên file, và gồm cả vật chưa mặc — cảnh sau mặc tới thì phải có sẵn ảnh */
export const pieceUrls = (c: CharacterData): PieceUrls => {
  const urls: PieceUrls = {};
  for (const f of characterFiles(c)) urls[f] = PIECES[f];
  return urls;
};

/** Ảnh của một con vật, khoá theo tên file; hộp lấy từ bộ xương nên không đo `aspect` */
export const animalUrls = (a: AnimalData): PieceUrls => {
  const urls: PieceUrls = {};
  for (const f of animalFiles(a)) urls[f] = PIECES[f];
  return urls;
};

/** Ảnh một mảnh theo tên file — hiệu ứng vẽ vật rời tay hỏi qua đây (`fxFiles` của @stickman3d/fx) */
export const pieceUrl = (f: string): string | undefined => PIECES[f];

export const propUrl = (p: PropData): string | undefined => {
  const f = pieceFile(p.body);
  return f ? PIECES[f] : undefined;
};
