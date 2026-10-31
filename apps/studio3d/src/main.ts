// Khung xem cảnh three: dựng như `three-page.mjs` của render (cảnh `worldOf` của repo video, không có thì `plainRoom()`),
// mỗi khung `stage.pose(t, view)` rồi vẽ bằng camera cảnh hay camera tự do (OrbitControls). Chế độ Dáng tay sửa mốc tay,
// mốc món trên bản JSON thô của cảnh (`keys.ts`), một lịch sử chung, lưu qua `/api/scene`.
import * as rig from "@stickman3d/rig";
import type {
  ActionData,
  AuthoredGrasp,
  HandShape,
  HandShapes,
  HeldItemSpec,
  AaMode,
  CharacterData,
  Figure,
  HandSide,
  HeldOptions,
  HoldRunInfo,
  SceneData,
  SceneRuntime,
  Side,
  Stage,
  World3D,
  WorldCtx,
} from "@stickman3d/rig";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as world0 from "virtual:stickman-world";
import { renderCard, type CardModel } from "./card";
import { renderClipCard, type ClipCardModel } from "./clipCard";
import {
  clipOf,
  compatibleActions,
  deleteClip,
  restHand,
  setBaseMirror,
  setClipAction,
  setClipMirror,
  tracksOf,
  type ClipRef,
  type RestHit,
} from "./clips";
import { anchorHand, heldPlace, itemPlace, placeHand, placeItem } from "./drag";
import { drawnHand, drawnItem } from "./drawn";
import { GraspEditor, sceneHigh, type EditScene, type EditTarget } from "./editor";
import { freeCam, type WheelMode } from "./freecam";
import { HandGrab } from "./gizmo";
import {
  ANGLES,
  anglePose,
  behind,
  gripWorld,
  handRows,
  heldLabel,
  HandOverlay,
  measureHtml,
  pickHand,
  shown,
  sideName,
  type Angle,
  type HandRow,
} from "./hands";
import {
  deleteKey,
  editKey,
  handShape,
  handsOf,
  holdPickOf,
  insertHandKey,
  keyTime,
  keyValue,
  marksOf,
  moveKey,
  retime,
  setEase,
  setHold,
  timeOf,
  touch,
  worldAtMoves,
  type Ease,
  type HoldPick,
  type Json,
  type KeyRef,
} from "./keys";
import { record, travel } from "./history";
import {
  PARTNER_AT,
  PREVIEW_ACTOR,
  PREVIEW_ANGLES,
  PREVIEW_PARTNER,
  previewExtra,
  previewLens,
  previewScene,
  previewSet,
  previewStage,
  type PreviewScene,
} from "@stickman3d/rig";
import {
  SPEEDS,
  groupActions,
  isLibrary,
  isMouthOnly,
  orderCharacters,
  readLibrary,
  stepIn,
  writeLibrary,
  type ActionGroup,
  type LibraryEntry,
} from "./libraryList";
import { LibraryPanel } from "./libraryUi";
import { GEN_PAGES, paramProblems, type GenStage } from "@stickman3d/cli/gen-pages";
import { genParams, isGen, readGen, setValue, writeGen } from "./genPage";
import { GenQueue } from "./genQueue";
import { GenPanel, type GenResult } from "./genUi";
import { walkChart } from "./genWalkChart";
import { runAt } from "./mode";
import { ModeCard } from "./modeUi";
import { runHoldKeys, setRunVariant, styleEntries, styleUses, type RunRef } from "./named";
import { renderStyles } from "./namedUi";
import { plusHand, plusItem } from "./plus";
import { PoseEditor, type PoseHost, type PoseTarget, type ShapeEntry } from "./poseEditor";
import { runtimeOf, type Data } from "./runtime";
import { SceneList } from "./sceneList";
import { lensOf, readView, viewNote, writeView, type V3, type ViewState } from "./share";
import { Solo } from "./solo";
import { sourceHtml, sourceLines, sourceModel } from "./source";
import { KeyTrack, type Band, type Lane } from "./track";
import { Trails } from "./trails";

type WorldOf = (name: string, ctx: WorldCtx) => World3D | null;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  header: document.querySelector("header") as HTMLElement,
  footer: document.querySelector("footer") as HTMLElement,
  scene: $<HTMLInputElement>("scene"),
  scenes: $<HTMLDataListElement>("scenes"),
  sceneSide: $<HTMLElement>("sceneSide"),
  sceneOpen: $<HTMLButtonElement>("sceneOpen"),
  appMode: $<HTMLDivElement>("appMode"),
  libTitle: $<HTMLSpanElement>("libTitle"),
  libCount: $<HTMLSpanElement>("libCount"),
  libFilter: $<HTMLInputElement>("libFilter"),
  libList: $<HTMLDivElement>("libList"),
  libCard: $<HTMLElement>("libCard"),
  genForm: $<HTMLDivElement>("genForm"),
  genCard: $<HTMLElement>("genCard"),
  sceneTitle: $<HTMLElement>("sceneTitle"),
  sideTitle: $<HTMLElement>("sideTitle"),
  speed: $<HTMLSpanElement>("speed"),
  loop: $<HTMLButtonElement>("loop"),
  scrim: $<HTMLDivElement>("scrim"),
  sceneToggle: $<HTMLButtonElement>("sceneToggle"),
  sceneCount: $<HTMLSpanElement>("sceneCount"),
  sceneFilter: $<HTMLInputElement>("sceneFilter"),
  sceneList: $<HTMLDivElement>("sceneList"),
  reload: $<HTMLButtonElement>("reload"),
  copyView: $<HTMLButtonElement>("copyView"),
  edMode: $<HTMLDivElement>("edMode"),
  dirty: $<HTMLSpanElement>("dirty"),
  undo: $<HTMLButtonElement>("undo"),
  redo: $<HTMLButtonElement>("redo"),
  save: $<HTMLButtonElement>("save"),
  discard: $<HTMLButtonElement>("discard"),
  more: $<HTMLButtonElement>("more"),
  conflict: $<HTMLDivElement>("conflict"),
  cfLoad: $<HTMLButtonElement>("cfLoad"),
  cfCopy: $<HTMLButtonElement>("cfCopy"),
  cfKeep: $<HTMLButtonElement>("cfKeep"),
  keyCard: $<HTMLElement>("keyCard"),
  runCard: $<HTMLElement>("runCard"),
  clipCard: $<HTMLElement>("clipCard"),
  laneLabels: $<HTMLDivElement>("laneLabels"),
  lanes: $<HTMLDivElement>("lanes"),
  laneAdds: $<HTMLDivElement>("laneAdds"),
  playhead: $<HTMLDivElement>("playhead"),
  cam: $<HTMLDivElement>("cam"),
  aa: $<HTMLSelectElement>("aa"),
  wheel: $<HTMLSelectElement>("wheel"),
  status: $<HTMLSpanElement>("status"),
  view: $<HTMLElement>("view"),
  frame: $<HTMLDivElement>("frame"),
  msg: $<HTMLDivElement>("msg"),
  play: $<HTMLButtonElement>("play"),
  time: $<HTMLInputElement>("time"),
  marks: $<HTMLDivElement>("marks"),
  clock: $<HTMLSpanElement>("clock"),
  side: $<HTMLElement>("side"),
  sideToggle: $<HTMLButtonElement>("sideToggle"),
  handsAt: $<HTMLSpanElement>("handsAt"),
  handList: $<HTMLDivElement>("handList"),
  selBox: $<HTMLElement>("selBox"),
  selName: $<HTMLDivElement>("selName"),
  angles: $<HTMLDivElement>("angles"),
  follow: $<HTMLInputElement>("follow"),
  solo: $<HTMLInputElement>("solo"),
  baseMirror: $<HTMLInputElement>("baseMirror"),
  measure: $<HTMLDivElement>("measure"),
  source: $<HTMLDivElement>("source"),
  editGrasp: $<HTMLButtonElement>("editGrasp"),
  editShape: $<HTMLButtonElement>("editShape"),
  restHand: $<HTMLButtonElement>("restHand"),
  styles: $<HTMLElement>("styles"),
  editor: $<HTMLElement>("editor"),
};

/**
 * Cảnh three của repo video. File nó nhập đổi trên đĩa (cảnh, món — kể cả khi Lưu) thì nhận bản mới tại chỗ, không nạp lại
 * trang: bản đang sửa và lịch sử còn nguyên, lần dựng cảnh sau dùng bản mới
 */
let world: { worldOf?: WorldOf } = world0;
import.meta.hot?.accept("virtual:stickman-world", (m) => {
  if (m) world = m as { worldOf?: WorldOf };
});

/** Khung cảnh 16:9 như composition Remotion */
const ASPECT = 16 / 9;
const FPS = 30;

let cur: {
  name: string;
  scene: SceneData;
  /** Giây cảnh: `scene.duration`, không khai thì rig suy từ clip (`runtime.duration`) */
  dur: number;
  stage: Stage;
  w: World3D;
  from: "world" | "plain";
  rt: SceneRuntime;
  /** Bản JSON thô `rt` dựng từ: khác `work.raw` là cảnh đang dựng lại sau một lần áp */
  src: Json;
  /** Ngưỡng luật `held` của repo (`package.json` `stickman.held`) */
  held: Omit<HeldOptions, "frame">;
  /** Người đang hiện ở khung vừa đặt (`w.pose`) */
  posed: Record<string, Figure>;
  /** Dữ liệu đã dựng cảnh (`held` đã parse, kể cả món áp tạm) */
  data: Data;
  /** `data` dạng chuỗi: cùng chuỗi thì đổi mốc tay, mốc món làm mới được (`restage`) */
  key: string;
  /** `STUDIO3D_HELD_OUT` của server: bản soạn lưu vào đây thay `held/` */
  heldOut: string | null;
} | null = null;
let t = 0;
let playing = false;
let mode: "scene" | "free" = "scene";
/** Trang soi: sân khấu đang đặt trên khung vẽ; camera tự do đang ở cận vùng tương tác (nút **Cận**) */
let genStage: GenStage | null = null;
let genClose = false;
let dirty = true;
let loading = 0;
/** Gốc repo video (`/api/scenes`) */
let repoRoot = "";
/** Trang mở trang soi bộ sinh (`?gen=<kiểu>`): như Thư viện, cảnh thử là sân khấu của bộ sinh. README.md#bộ-sinh */
const GEN = isGen(new URLSearchParams(location.search));
/**
 * Trang mở chế độ Thư viện (`?library=1`) hay Bộ sinh: xem thử trên cảnh dựng trong bộ nhớ, không sửa gì.
 * README.md#thư-viện
 */
const LIB = GEN || isLibrary(new URLSearchParams(location.search));
document.body.classList.toggle("library", LIB);
document.body.classList.toggle("gen", GEN);
/** Chế độ của công tắc đầu thanh trên */
const APP = GEN ? "gen" : LIB ? "library" : "scene";
const APP_URL = {
  scene: ["studio3d.sceneUrl", ""],
  library: ["studio3d.libraryUrl", "?library=1"],
  gen: ["studio3d.genUrl", "?gen=sit"],
} as const;
/** Bộ sinh và tham số của trang soi */
const gv = readGen(new URLSearchParams(GEN ? location.search : ""), GEN_PAGES);
/** Tốc độ phát, lặp khi hết cảnh: chỉ Thư viện đổi được */
const lv = readLibrary(new URLSearchParams(LIB ? location.search : ""));

/**
 * Bản đang sửa của cảnh: JSON thô (giữ trường lạ, mốc tên), chữ của bản đã lưu, hash lúc nạp và một lịch sử chung (mỗi bước
 * là ảnh chụp JSON thô)
 */
let work: {
  name: string;
  raw: Json;
  saved: string;
  hash: string;
  undo: string[];
  redo: string[];
} | null = null;
const isDirty = () => !!work && JSON.stringify(work.raw) !== work.saved;
/** Xem cảnh hay sửa mốc tay (thanh tua có hàng mốc) */
let edMode: "view" | "hands" =
  !LIB && localStorage.getItem("studio3d.mode") === "hands" ? "hands" : "view";
/** Mốc đang mở thẻ */
let picked: KeyRef | null = null;
/** Clip đang mở thẻ (hàng track của Dáng tay) */
let clipSel: ClipRef | null = null;
/** Mốc đang mở thẻ khi rời mỗi bản của lịch sử (chữ JSON thô): hoàn tác / làm lại mở lại đúng mốc ấy */
const picks = new Map<string, KeyRef | null>();
/** Dòng nhắc của lần thêm mốc gần nhất (chỗ mốc mới chỉ gần đúng), hiện trên thẻ của mốc ấy */
let added: { key: KeyRef; notes: string[] } | null = null;

const free = new THREE.PerspectiveCamera(30, ASPECT, 0.05, 300);
let orbit: OrbitControls | null = null;
const fc = freeCam(free, ui.frame, () => mode === "free" && !editor?.shown);

const say = (text: string, error = false) => {
  ui.msg.textContent = text;
  ui.msg.classList.toggle("error", error);
};

const params = () => new URLSearchParams(location.search);
/** View đang xem: cảnh, giây, camera (camera tự do kèm chỗ đứng, tâm xoay, fov), bàn tay đang chọn */
function viewState(): ViewState {
  return {
    scene: LIB ? undefined : (cur?.name ?? params().get("scene") ?? undefined),
    t,
    cam: mode,
    ...(mode === "free" &&
      orbit && {
        free: { pos: free.position.toArray(), at: orbit.target.toArray() as V3, fov: free.fov },
      }),
    ...(sel && { hand: { id: sel.id, side: sel.side < 0 ? "right" : "left" } }),
    solo: ui.solo.checked,
    ed: edMode,
  };
}
/** Ghi view vào URL; mỗi chế độ nhớ view cuối của nó để công tắc Cảnh / Thư viện / Bộ sinh mở lại đúng chỗ */
function remember() {
  const p = writeView(params(), viewState());
  const q = `?${GEN ? genUrl(p) : LIB ? writeLibrary(p, lv) : p}`;
  history.replaceState(null, "", q);
  localStorage.setItem(APP_URL[APP][0], q);
}

/** URL của trang soi: người, góc máy, tốc độ, lặp như Thư viện (không hành động, không cờ `library`), rồi tham số */
function genUrl(p: URLSearchParams) {
  writeLibrary(p, { ...lv, action: undefined, mouth: false });
  p.delete("library");
  return writeGen(p, gv, GEN_PAGES);
}

/** Cỡ khung vẽ: 16:9 lớn nhất vừa vùng giữa, pixel thật theo màn hình (tối đa 2) */
function frameSize() {
  const r = ui.view.getBoundingClientRect();
  const w = Math.max(16, Math.min(r.width - 16, (r.height - 16) * ASPECT));
  const h = w / ASPECT;
  ui.frame.style.width = `${w}px`;
  ui.frame.style.height = `${h}px`;
  const dpr = Math.min(2, devicePixelRatio || 1);
  return { w: Math.round(w * dpr), h: Math.round(h * dpr) };
}

function build(name: string, scene: SceneData, data: Data) {
  const { runtime, heights, bodies } = runtimeOf(scene, data);
  const ctx = { id: name, scene, runtime, characters: data.characters, heights, bodies };
  const worldOf = world.worldOf;
  const w = typeof worldOf === "function" ? worldOf(scene.name, ctx) : null;
  const dur = runtime.duration;
  if (w) return { w, dur, rt: runtime, from: "world" as const };
  return {
    w: rig.buildWorld(scene, runtime, { set: () => rig.plainRoom() }, ctx),
    dur,
    rt: runtime,
    from: "plain" as const,
  };
}

/** Sân khấu cho cảnh đã dựng — như `stageOf` của rig; camera cảnh là `stage.camera`; `posed` nhận người đã đặt mỗi khung */
function stageFor(w: World3D, scene: SceneData, posed: (p: Record<string, Figure>) => void) {
  const s = w.set;
  const stage = rig.createStage({
    size: frameSize(),
    aa: ui.aa.value as AaMode,
    lens: scene.lens,
    light: () => rig.setPalette(s.palette),
    update: (t, st) => {
      posed(w.pose(t));
      s.room.cull(st.camera);
      rig.setLights(w.lights(t));
    },
  });
  stage.scene.background = new THREE.Color(s.background ?? rig.PAPER);
  stage.scene.add(w.root);
  return stage;
}

/** Lần đọc cảnh gần nhất (`/api/scene`): dựng lại không đọc đĩa khi áp tạm bản soạn */
let fetched: { name: string; j: Scene3Json } | null = null;
/** Món áp tạm (bản soạn chưa lưu), theo tên file `held/`: đè `held` của lần đọc */
const patched: Record<string, HeldItemSpec> = {};

interface Scene3Json {
  raw: unknown;
  /** Hash của file cảnh lúc nạp: lưu gửi kèm, file trên đĩa đã đổi thì server trả 409 */
  hash: string;
  data: Data;
  heldRaw?: Record<string, unknown>;
  /** Hash của từng file `held/` lúc nạp, như `hash` */
  heldHash?: Record<string, string>;
  /** JSON thô và hash lúc nạp của dáng tay trong `hands/` của repo (lớp chung ở `data.hands`) */
  handsRaw?: Record<string, unknown>;
  handsHash?: Record<string, string>;
  heldOpts?: Record<string, unknown> & { off?: true; error?: string };
  /** `stickman.snap` của repo (ngưỡng giật của `check`) */
  snapOpts?: { px?: number; k?: number; fps?: number; off?: true; error?: string };
  /** Quãng lên hình của cảnh trong `episodes/` (`check` chỉ đo giật trong đó); không shot nào dùng thì không có */
  snapSpans?: [number, number][];
  heldOut?: string | null;
  error?: string;
}

/**
 * `held` của cảnh: bản `worldData` (rig bản dựng của CLI parse — có thể cắt mất trường rig mới như `authored`), đè bằng JSON
 * thô của `held/` (cả lớp `STUDIO3D_HELD_OUT`) parse bằng mã nguồn rig, rồi món áp tạm
 */
function heldOf(j: Scene3Json, warn: string[]) {
  const out: Record<string, unknown> = { ...j.data.held };
  for (const [k, raw] of Object.entries(j.heldRaw ?? {})) {
    const r = rig.parseHeldItem(raw);
    if (r.success) out[k] = r.data;
    else warn.push(`held/${k}.json: ${r.error.message.slice(0, 200)}`);
  }
  return { ...out, ...patched };
}

/**
 * Thư viện dáng tay của cảnh: bản `worldData` (hai lớp, rig bản dựng của CLI parse), đè bằng JSON thô của `hands/` parse
 * bằng mã nguồn rig
 */
function handsLib(j: Scene3Json, warn: string[]): HandShapes {
  const out = { ...(j.data.hands ?? {}) } as HandShapes;
  for (const [k, raw] of Object.entries(j.handsRaw ?? {})) {
    const why = rig.handShapeNameProblem(k);
    const r = rig.parseHandShape(raw);
    if (!why && r.success) out[k] = r.data;
    else warn.push(`hands/${k}.json: ${why ?? r.error!.message.slice(0, 200)}`);
  }
  return out;
}

interface LoadOptions {
  /** Giữ giây đang xem */
  keepTime?: boolean;
  /** Dùng lần đọc đĩa gần nhất (`fetched`), không đọc lại */
  reuse?: boolean;
  /** Đọc lại đĩa nhưng giữ bản đang sửa nếu có thay đổi chưa lưu (Shift+R) */
  keepWork?: boolean;
  /** Dựng lại cả cảnh, không làm mới tại chỗ */
  full?: boolean;
  /** Nạp xong thì giữ lời báo đang hiện (lời báo của thao tác vừa áp), cảnh báo nối thêm */
  quiet?: boolean;
}

/** Nạp cảnh; `false` khi hỏng hay đã có lần nạp sau */
async function load(name: string, o: LoadOptions = {}): Promise<boolean> {
  const my = ++loading;
  playing = false;
  ui.play.textContent = "▶";
  const shown = ui.msg.textContent ?? "";
  if (!o.quiet) say(`Đang nạp ${name}…`);
  const done = (warnings: string[]) =>
    o.quiet
      ? warnings.length &&
        say([ui.msg.textContent || shown, ...warnings].filter(Boolean).join("\n"))
      : say(warnings.join("\n"));
  try {
    const j: Scene3Json =
      o.reuse && fetched?.name === name
        ? fetched.j
        : await (await fetch(`/api/scene?name=${encodeURIComponent(name)}`)).json();
    if (my !== loading) return false;
    if (j.error) throw new Error(j.error);
    fetched = { name, j };
    if (work?.name !== name || (!o.reuse && !(o.keepWork && isDirty()))) {
      work = {
        name,
        // cảnh đời trước chỉ khác số `schemaVersion`: mốc soạn ở đây (`elbow` hệ thân) đọc theo nghĩa mới khi lưu
        raw: rig.sceneVersionUp(structuredClone(j.raw)) as Json,
        saved: JSON.stringify(rig.sceneVersionUp(j.raw)),
        hash: j.hash,
        undo: [],
        redo: [],
      };
      picked = null;
      picks.clear();
      ui.conflict.hidden = true;
    }
    const warnings: string[] = [];
    const data = { ...j.data, held: heldOf(j, warnings), hands: handsLib(j, warnings) };
    const src = work.raw;
    const parsed = rig.parseScene(src);
    if (!parsed.success) throw new Error(`scene JSON sai: ${parsed.error.message}`);
    const scene = parsed.data;
    // bàn tay đang chọn của cảnh trước: người không có trong cảnh này thì bỏ chọn (vệt, thẻ món tra người theo `id`)
    const has = (id: string) => scene.cast.some((m) => m.id === id);
    if (sel && !has(sel.id)) {
      sel = null;
      lastCenter = null;
    }
    if (modeCard.sel && !has(modeCard.sel.id)) modeCard.close();
    const key = JSON.stringify(data);
    const held = (j.heldOpts && !j.heldOpts.off && !j.heldOpts.error ? j.heldOpts : {}) as Omit<
      HeldOptions,
      "frame"
    >;
    if (!o.full && cur?.name === name && cur.key === key && restage(scene)) {
      cur.held = held;
      cur.src = src;
      done(warnings);
      syncEdit();
      return true;
    }
    let { w, dur, from, rt } = build(name, scene, data);
    const fonts = w.set.fonts;
    if (fonts?.specs?.length) {
      const missing = await rig.loadFonts(fonts.specs, fonts.text);
      if (missing.length) warnings.push(`thiếu phông decal: ${missing.join(", ")}`);
      // đồ riêng vẽ chữ lúc dựng: dựng lại khi phông đã nạp
      ({ w, dur, from, rt } = build(name, scene, data));
    }
    await w.ready;
    if (my !== loading) return false;
    const box = { posed: {} as Record<string, Figure> };
    const stage = stageFor(w, scene, (p) => (box.posed = p ?? {}));
    dispose();
    ui.frame.append(stage.canvas);
    cur = {
      name,
      scene,
      dur,
      stage,
      w,
      from,
      rt,
      src,
      held,
      data,
      key,
      heldOut: j.heldOut ?? null,
      get posed() {
        return box.posed;
      },
    };
    rowsT = NaN;
    if (!o.keepTime) t = 0;
    t = Math.min(t, dur);
    ui.scene.value = name;
    sceneList.mark(name);
    ui.time.max = String(dur);
    ui.time.step = String(1 / FPS);
    drawMarks(scene, dur);
    attachOrbit();
    if (mode === "free" && !o.keepTime) seedFree();
    const gpu = /SwiftShader/.test(stage.gpu) ? " · ⚠ vẽ phần mềm" : "";
    ui.status.textContent = `${from === "world" ? "cảnh của repo" : "plainRoom (cảnh không có trong worldOf)"} · ${scene.cast.length} người${gpu}`;
    done(warnings);
    dirty = true;
    remember();
    syncEdit();
    return true;
  } catch (e) {
    if (my !== loading) return false;
    say(`${name}: ${(e as Error).stack ?? e}`, true);
    return false;
  }
}

/** Đổi mốc tay, mốc món của cảnh đang mở mà không dựng lại lưới (`World3D.refresh`); `false` là phải dựng lại */
function restage(scene: SceneData): boolean {
  if (!cur?.w.refresh?.(scene)) return false;
  cur.scene = scene;
  rowsT = NaN;
  drawMarks(scene, cur.dur);
  dirty = true;
  return true;
}

function dispose() {
  solo.show();
  if (!cur) return;
  cur.stage.dispose();
  cur.stage.canvas.remove();
  cur = null;
}

function drawMarks(scene: SceneData, dur: number) {
  ui.marks.replaceChildren();
  const marks = (scene as { marks?: Record<string, number> }).marks ?? {};
  // mốc cùng giây gộp một nhãn, không thì chữ đè nhau
  const at = new Map<number, string[]>();
  for (const [k, v] of Object.entries(marks))
    if (typeof v === "number" && v >= 0 && v <= dur) at.set(v, [...(at.get(v) ?? []), k]);
  for (const [v, ks] of at) {
    const b = document.createElement("button");
    b.textContent = ks.join(" · ");
    b.title = `${ks.map((k) => `@${k}`).join(", ")} = ${v.toFixed(2)} s`;
    b.style.left = `${(v / dur) * 100}%`;
    b.onclick = () => seek(v);
    ui.marks.append(b);
  }
}

function seek(v: number) {
  if (!cur) return;
  t = Math.max(0, Math.min(cur.dur, v));
  dirty = true;
  remember();
}

/** Camera tự do bắt đầu ở đúng chỗ camera cảnh đang đứng, tâm xoay là chỗ trục nhìn chạm cảnh */
function seedFree() {
  if (!cur || !orbit) return;
  const { stage, w } = cur;
  solo.show();
  stage.pose(t, w.view(t));
  applySolo();
  const cam = stage.camera;
  free.position.copy(cam.position);
  free.quaternion.copy(cam.quaternion);
  free.fov = cam.fov;
  free.updateProjectionMatrix();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  const hit = new THREE.Raycaster(cam.position, dir)
    .intersectObject(w.root, true)
    .find((h) => shown(h.object));
  orbit.target.copy(cam.position).addScaledVector(dir, hit ? hit.distance : 3);
  orbit.update();
}

function attachOrbit() {
  // canvas mới mỗi lần nạp: giữ tâm xoay cũ, không thì OrbitControls mới quay quanh gốc toạ độ
  const target = orbit?.target.clone();
  orbit?.dispose();
  if (!cur) return;
  orbit = new OrbitControls(free, cur.stage.canvas);
  if (target) orbit.target.copy(target);
  orbit.enableDamping = true;
  orbit.zoomToCursor = true;
  orbit.enabled = mode === "free";
  fc.attach(orbit);
  orbit.addEventListener("change", () => (dirty = true));
  orbit.addEventListener("end", remember);
  grab.attach(cur.stage.canvas);
}

function setMode(m: "scene" | "free") {
  mode = m;
  genClose = false;
  for (const b of ui.cam.querySelectorAll("button")) b.classList.toggle("on", b.dataset.mode === m);
  ui.frame.classList.toggle("free", m === "free");
  if (orbit) orbit.enabled = m === "free";
  if (m === "free") seedFree();
  dirty = true;
  if (GEN) syncGen();
  else remember();
}

function draw() {
  if (!cur) return;
  const { stage, w } = cur;
  const t0 = performance.now();
  const view = w.view(t);
  // số đo bàn tay đo trên cảnh đủ người, chỉ lúc vẽ mới ẩn
  solo.show();
  stage.pose(t, view);
  afterPose();
  const t1 = performance.now();
  const camera = mode === "free" ? free : stage.camera;
  if (mode === "free") w.set.room.cull(free);
  applySolo();
  stage.pipeline.render(stage.scene, camera, view.render);
  // lớp phủ của bàn tay đã chọn, tay nắm, vòng khuỷu, nón cổ tay: vẽ đè, không qua pipeline
  if (overlay.active || grab.active) {
    const r = stage.renderer;
    const auto = r.autoClear;
    r.autoClear = false;
    r.setRenderTarget(null);
    r.clearDepth();
    if (overlay.active) r.render(overlay.scene, camera);
    grab.render(r, camera);
    r.autoClear = auto;
  }
  trails.render(camera);
  // `readPixels` một điểm: chờ GPU vẽ xong thật, để số ms vẽ không chỉ là thời gian đẩy lệnh
  stage.renderer.getContext().readPixels(0, 0, 1, 1, 0x1908, 0x1401, PIXEL);
  cost = { pose: t1 - t0, render: performance.now() - t1 };
  ui.time.value = String(t);
  if (edMode === "hands") track.playhead(t, cur.dur);
  ui.clock.textContent = `${fps ? `${fps} fps · ` : ""}${t.toFixed(2)} / ${cur.dur.toFixed(2)} s`;
  ui.clock.title = `khung vừa vẽ: tư thế ${cost.pose.toFixed(0)} ms, vẽ ${cost.render.toFixed(0)} ms`;
}

const PIXEL = new Uint8Array(4);

// --- bàn tay: danh sách, chọn, số đo, cận tay ---

let rows: HandRow[] = [];
/** Giây của `rows` (đo lại khi tua); `NaN` là phải đo lại */
let rowsT = NaN;
let sel: { id: string; side: Side } | null = null;
/** Tâm nắm của tay đã chọn ở khung trước: camera bám theo phần dời */
let lastCenter: THREE.Vector3 | null = null;
let fly: {
  p0: THREE.Vector3;
  t0: THREE.Vector3;
  p1: THREE.Vector3;
  t1: THREE.Vector3;
  at: number;
} | null = null;
const FLY = 0.6;
const overlay = new HandOverlay();
/** Tay nắm, vòng khuỷu, nón cổ tay của bàn tay đang chọn (Dáng tay) */
const grab = new HandGrab(ui.frame, {
  ctx: () =>
    work && cur && edMode === "hands" && !editor
      ? {
          raw: work.raw,
          rt: cur.rt,
          t,
          opts: (id: string) => ({ ...charOf(id), rebuild: rebuildRaw, fps: FPS, dur: cur!.dur }),
        }
      : null,
  apply: (raw, key) => apply(raw, { key }),
  say,
  orbit: () => orbit,
  redraw: () => (dirty = true),
  wristWarn: () => cur?.held.wrist ?? rig.HELD_WRIST,
});
/** Vệt cổ tay, khuỷu, tâm món của bàn tay đang chọn (Dáng tay) */
const trails = new Trails(ui.frame);
const selRow = () => (sel ? rows.find((r) => r.id === sel!.id && r.side === sel!.side) : undefined);

/** "Chỉ người này": khung vẽ chỉ còn người có bàn tay đang chọn và món người ấy cầm, treo */
const solo = new Solo();
function applySolo() {
  const r = ui.solo.checked && cur ? selRow() : undefined;
  if (!r || !cur) return solo.show();
  const keep: THREE.Object3D[] = [r.fig.root];
  for (const s of [-1, 1] as Side[])
    for (const o of [r.fig.holding?.[s]?.object, r.fig.carrying?.[s]?.object]) if (o) keep.push(o);
  solo.hide(cur.w.root, keep);
}

function toggleSolo() {
  applySolo();
  dirty = true;
  remember();
  say(
    !ui.solo.checked
      ? "hiện cả cảnh"
      : sel
        ? "chỉ hiện người đang chọn (H tắt)"
        : "chỉ người này: chọn một bàn tay để ẩn cảnh và người khác",
  );
}

/** Sau khi đặt người ở `t`: đo bàn tay (khi tua tới giây mới), camera bám tay đã chọn, lớp phủ, panel */
function afterPose() {
  if (!cur) return;
  const fresh = t !== rowsT;
  if (fresh) {
    // đang phát: chỉ danh sách, không đo (vài ms mỗi tay)
    rows = handRows(cur.posed, {
      U: rig.U,
      eye: cur.stage.camera.position,
      held: cur.held,
      measure: !playing,
    });
    rowsT = playing ? NaN : t;
  }
  const r = selRow();
  if (r) {
    const c = gripWorld(r.fig, r.side);
    if (lastCenter && ui.follow.checked && mode === "free" && orbit) {
      const d = c.clone().sub(lastCenter);
      free.position.add(d);
      orbit.target.add(d);
      if (fly) {
        fly.p1.add(d);
        fly.t1.add(d);
      }
    }
    lastCenter = c;
  } else lastCenter = null;
  if (fresh || !r) {
    overlay.update(r, {
      sink: cur.held.sink ?? rig.HELD_SINK,
      wrap: cur.held.wrap ?? rig.HELD_WRAP,
    });
    if (!playing || fresh) panel();
    if (fresh && !playing && modeCard.sel) modeCard.render();
    grab.sync(edMode === "hands" && !playing && !editor ? r : undefined);
  }
  trails.update(
    edMode === "hands" && !playing && !editor && sel && work
      ? {
          raw: work.raw,
          data: cur.data,
          dataKey: cur.key,
          snap: fetched?.j.snapOpts,
          ...(fetched?.j.snapSpans && { spans: fetched.j.snapSpans }),
          id: sel.id,
          side: sideOf(sel.side),
          t,
        }
      : null,
  );
}

/** Panel bàn tay: danh sách mọi tay, rồi số đo của tay đã chọn */
function panel() {
  ui.handsAt.textContent = `${t.toFixed(2)} s`;
  ui.handList.replaceChildren(
    ...rows.map((r) => {
      const b = document.createElement("button");
      b.className = "hand";
      const on = sel?.id === r.id && sel.side === r.side;
      b.classList.toggle("on", on);
      b.classList.toggle("empty", !r.hold && !r.carry);
      const bad = r.hits?.length ? (r.hits.some((h) => h.error) ? "!!" : "!") : "";
      b.innerHTML = `<span class="who">${r.id}</span><span class="lr">${sideName(r.side)}</span><span class="what">${heldLabel(r)}</span><span class="bad">${bad}</span>`;
      b.title = r.hits?.map((h) => `${h.rule} ${h.worst.toFixed(1)}`).join(", ") ?? "";
      b.onclick = () => select(r, true);
      return b;
    }),
  );
  const r = selRow();
  ui.selBox.hidden = !r || !!editor;
  if (!r || !cur) return;
  ui.selName.textContent = `${r.id} · tay ${sideName(r.side)}`;
  const member = work && castOf(work.raw, r.id);
  ui.baseMirror.checked = member?.baseMirror === true;
  ui.baseMirror.disabled = !member;
  const src = sourceOf(r);
  ui.source.innerHTML = src
    ? sourceHtml(src)
    : `<div class="dim">người không có \`world\`: không có nguồn dáng 3D</div>`;
  const free = !r.hold && !r.carry;
  ui.editGrasp.hidden = free;
  ui.editShape.hidden = !free;
  ui.editShape.disabled = !work;
  const why = restBlock(r);
  ui.restHand.disabled = !!why;
  ui.restHand.title =
    why ??
    "Bỏ bàn tay của hành động ở tay này: clip chỉ chạm tay này thì xoá, clip chạm cả hai tay thì thêm mốc rest ở giây đang xem";
  ui.editGrasp.disabled = !editable(r);
  ui.editGrasp.title = editable(r)
    ? "Soạn kiểu cầm món × nhóm × biến thể này bằng mắt"
    : "chỉ soạn được chỗ cầm nhóm (`món@nhóm`) của món có hình va chạm";
  const back = behind(r);
  for (const b of ui.angles.querySelectorAll("button"))
    b.hidden = b.dataset.angle === "sau" && !back;
  ui.measure.innerHTML =
    rowsT === t ? measureHtml(r, cur.held) : `<div class="dim">dừng phát để đo</div>`;
  const run = runOf(r.id, r.side, t);
  renderStyles(ui.styles, run ? styleModel(run, r) : null, (v) => pickStyle(run!, v));
}

/** Clip đang ghi bàn tay của tay `side` người `id` ở giây đang xem (`clipSides`), mỗi track clip đang chạy */
function restHits(id: string, side: HandSide): RestHit[] {
  const m = cur!.rt.cast.find((x) => x.id === id);
  const other: HandSide = side === "right" ? "left" : "right";
  const out: RestHit[] = [];
  m?.tracks.forEach((tr, track) => {
    let clip = -1;
    tr.clips.forEach((c, j) => {
      if (c.start <= t) clip = j;
    });
    const s = clip >= 0 ? rig.clipSides(cur!.rt, id, track, clip, t) : undefined;
    if (!s?.[side].hand) return;
    out.push({
      track,
      clip,
      ...(tr.clips[clip].file && { action: tr.clips[clip].file }),
      other: s[other].arm || s[other].hand,
    });
  });
  return out;
}

/** Lý do nút Về tư thế buông tắt; `undefined` là bấm được */
function restBlock(r: HandRow): string | undefined {
  if (!work || !cur) return "chưa mở cảnh";
  if (cur.src !== work.raw) return "đang dựng lại cảnh";
  if (r.hold || r.carry) return "tay đang cầm / treo món: buông món là `hold: null` ở thẻ mốc";
  const src = rig.handSources(cur.rt, r.id, t)[sideOf(r.side)];
  if (src.rest >= 1 - 1e-6) return "tay đã buông (mốc rest)";
  if (!restHits(r.id, sideOf(r.side)).length)
    return "không clip nào ghi bàn tay này ở giây đang xem: tay đã theo dáng của track ghi góc cánh tay";
  return undefined;
}

/** **Về tư thế buông**: bỏ bàn tay của hành động ở tay đang chọn — xoá clip chỉ chạm tay ấy, chạm cả hai tay thì mốc `rest` */
function goRest() {
  const r = selRow();
  if (!r || !work || !cur) return;
  const why = restBlock(r);
  if (why) return say(why, true);
  const side = sideOf(r.side);
  try {
    const before = tracksOf(work.raw, r.id)?.length ?? 0;
    const plan = restHand(work.raw, r.id, side, t, restHits(r.id, side));
    const after = tracksOf(plan.raw, r.id)?.length ?? 0;
    const at = plan.rest ? insertedAt(plan.raw, r.id, side) : null;
    if (!apply(plan.raw, { key: at })) return;
    clipSel = null;
    syncEdit();
    const parts = [
      ...plan.deleted.map((h) => `xoá clip ${h.action ?? "rỗng"} (track #${h.track})`),
      ...(after < before ? [`bỏ ${before - after} track hết clip`] : []),
      ...(plan.rest
        ? [`thêm mốc rest tay ${SIDE_NAME[side]} ở ${t.toFixed(2)} s (clip chạm cả hai tay)`]
        : []),
    ];
    say(`về tư thế buông: ${parts.join("; ")}`);
  } catch (e) {
    say((e as Error).message, true);
  }
}

/** Mốc `rest` vừa thêm của tay `side` ở giây đang xem */
function insertedAt(raw: Json, id: string, side: HandSide): KeyRef | null {
  const marks = marksOf(raw);
  const i = (handsOf(raw, id) ?? []).findIndex(
    (k) =>
      Math.abs(timeOf(k.t, marks) - t) < 5e-4 && isObj(k[side]) && (k[side] as Json).rest === true,
  );
  return i < 0 ? null : { kind: "hand", id, side, index: i };
}

/** Nguồn dáng của bàn tay `r` ở giây đang xem (`handSources` của rig trên runtime đang vẽ) */
function sourceOf(r: HandRow) {
  const src = cur && rig.handSources(cur.rt, r.id, t)?.[sideOf(r.side)];
  return src && sourceModel(r.id, src);
}

/** Lần cầm của tay `side` người `id` chứa giây `at` */
function runOf(id: string, side: Side, at: number): (RunRef & HoldRunInfo) | undefined {
  if (!cur) return undefined;
  const run = runAt(rig.holdRuns(cur.rt, id)[sideOf(side)], at, cur.dur);
  return run && { ...run, id, side: sideOf(side) };
}

/**
 * Danh sách kiểu cầm của món × nhóm của lần cầm; lần cầm không có kiểu để chọn (món treo, tay không giải chỗ cầm nhóm,
 * nhóm một kiểu mà món chưa có kiểu có tên) thì một dòng nêu lý do
 */
function styleModel(run: RunRef & HoldRunInfo, r: HandRow) {
  if (!work || !cur) return null;
  if (run.group === "carry") return "món treo (`carry`): không có kiểu cầm";
  if (!r.report)
    return "bàn tay không giải chỗ cầm nhóm ở giây này (món tựa, đang hoà, hay không khai nhóm): không có kiểu để chọn";
  const held = cur.data.held as Record<string, HeldItemSpec>;
  const entries = styleEntries(held[run.item] ?? held[rig.heldBase(run.item)], run.group);
  if (entries.length < 2 && !run.variant)
    return `nhóm \`${run.group}\` chỉ có một kiểu, món chưa có kiểu có tên`;
  return {
    label: holdLabel({ ...run, variant: undefined }) + (run.lead ? " (tay phụ)" : ""),
    ...(run.variant && { current: run.variant }),
    ...(!run.variant && r.report.choice.variant && { solved: r.report.choice.variant }),
    entries,
    keys: runHoldKeys(work.raw, run).length,
  };
}

const keepEdge = (n: number) =>
  n ? `, thêm \`regrip\` ở ${n} mốc để lần cầm không nhập vào lần cầm kề cùng kiểu` : "";

/** Đổi `variant` của cả lần cầm (một bước lịch sử); `undefined` bỏ khai, rig chọn */
function pickStyle(run: RunRef & HoldRunInfo, v: string | undefined) {
  if (!work) return;
  const { raw, changed, regrip } = setRunVariant(work.raw, run, v);
  if (!changed) return say("lần cầm không có mốc `hold` nào đổi");
  if (apply(raw))
    say(
      `${run.item}@${run.group}: kiểu ${v ?? "rig chọn"} — đổi ${changed} mốc${keepEdge(regrip)}`,
    );
}

/** Chọn bàn tay; `go` thì camera tự do bay tới cận tay ấy (góc trước) */
function select(r: HandRow | undefined, go: boolean) {
  sel = r ? { id: r.id, side: r.side } : null;
  lastCenter = null;
  applySolo();
  if (r && go) view("truoc");
  else dirty = true;
  rowsT = NaN;
  syncEdit();
  remember();
}

/** Camera tự do bay mượt tới cận bàn tay đã chọn ở góc `a` */
function view(a: Angle) {
  const r = selRow();
  if (!r || !orbit) return;
  if (mode !== "free") setMode("free");
  const to = anglePose(r, a, free.fov, cur?.w.root);
  fly = {
    p0: free.position.clone(),
    t0: orbit.target.clone(),
    p1: to.position,
    t1: to.target,
    at: performance.now(),
  };
  dirty = true;
}

// --- soạn kiểu cầm ---

let editor: GraspEditor | PoseEditor | null = null;

const editable = (r: HandRow) =>
  !!(r.hold?.spec?.shape && r.report && r.report.group !== "carry" && r.report.choice.variant);

/** Cỡ bàn tay (`cladHand`) của từng nhân vật mặc đồ: lấy tay nhỏ nhất và lớn nhất của dàn nhân vật */
function handSizes(chars: Record<string, CharacterData>) {
  const all = Object.entries(chars).flatMap(([name, c]) => {
    const pal = rig.wornPalette(c);
    if (!(pal as { clad?: boolean }).clad) return [];
    const { k, long } = rig.cladHand(
      rig.limbWidths(pal).sleeve,
      c.rig.stroke,
      rig.bones3(c.rig.height).foreArm * 100,
    );
    return [{ name: name.replace(/\.json$/, ""), k, long }];
  });
  all.sort((a, b) => a.k * a.long - b.k * b.long);
  return all.length > 1 ? [all[0], all[all.length - 1]] : all;
}

/** Bàn tay đã chọn → một lần soạn: món, nhóm, biến thể, lựa chọn, đầu cao của cạnh, cỡ tay và cỡ món trong khung tay */
function editTarget(r: HandRow): EditTarget | undefined {
  if (!cur || !editable(r)) return;
  const hold = r.hold!;
  const g = r.report!;
  const item = hold.item ?? g.item;
  const base = rig.heldBase(item);
  const spec = (cur.data.held[item] ?? cur.data.held[base]) as HeldItemSpec | undefined;
  if (!spec) return;
  const h = r.fig.hands![r.side];
  const wrist = r.fig.arms[r.side].wrist;
  wrist.updateWorldMatrix(true, false);
  hold.object.updateWorldMatrix(true, false);
  const rel = new THREE.Matrix4()
    .copy(wrist.matrixWorld)
    .invert()
    .multiply(hold.object.matrixWorld);
  const s = new THREE.Vector3().setFromMatrixScale(rel).x;
  const geom = rig.itemGeom(spec);
  const choice = { ...g.choice, group: g.group };
  return {
    row: r,
    base,
    spec,
    group: g.group,
    variant: g.choice.variant!,
    choice: g.choice,
    high: sceneHigh(spec, geom, choice, r.side, h.scale, h.long, s, hold.hand),
    k: h.scale,
    long: h.long,
    s,
    object: hold.object,
    sizes: handSizes(cur.data.characters),
    scene: editScene(r),
  };
}

/**
 * Bàn tay `r` trong cảnh đổi sang khung soạn: hướng khung bàn tay trong thế giới, khuỷu trong khung bàn tay, hướng ra
 * camera đang xem và ra ba góc cận tay, vật liệu da, đèn và nét vẽ của cảnh ở giây ấy. Khung soạn dựng đúng bên tay ấy
 */
function editScene(r: HandRow): EditScene {
  const { stage, w } = cur!;
  const view = w.view(t);
  solo.show();
  stage.pose(t, view);
  const lights = rig.currentLights();
  const arm = r.fig.arms[r.side];
  arm.wrist.updateWorldMatrix(true, false);
  const R = new THREE.Matrix4().extractRotation(arm.wrist.matrixWorld);
  const elbow = arm.wrist.worldToLocal(arm.elbow.getWorldPosition(new THREE.Vector3()));
  const c = gripWorld(r.fig, r.side);
  const cam = mode === "free" ? free : stage.camera;
  const dir = (a: Angle) => {
    const p = anglePose(r, a, free.fov, w.root);
    return p.position.sub(p.target).normalize();
  };
  const inked = arm.wrist.children.find((g) => g.userData.hand === r.side);
  const [skin, hull] = (inked?.children ?? []) as THREE.Mesh[];
  const ceiling = lights.rig.ceiling;
  return {
    q: new THREE.Quaternion().setFromRotationMatrix(R),
    elbow,
    views: {
      canh: cam.position.clone().sub(c).normalize(),
      truoc: dir("truoc"),
      cheo: dir("cheo"),
      ngang: dir("ngang"),
    },
    ...(skin && { skin: skin.material as THREE.Material }),
    ...(hull && { hull: hull.material as THREE.Material }),
    background:
      (stage.scene.background as THREE.Color | null)?.clone() ?? new THREE.Color(rig.PAPER),
    render: view.render ?? {},
    palette: lights.palette,
    // khung soạn không có phòng: bỏ đèn đặt chỗ (đèn rọi, nắng qua cửa), trần không cắt bóng
    lights: {
      ...(ceiling && { ceiling: { ...ceiling, y: -1e5 } }),
      ...(lights.rig.ao && { ao: lights.rig.ao }),
    },
    t,
  };
}

/**
 * Ghi bản soạn `au` (`null` xoá) vào khoá `authored.<group>.<variant>` của `held/<name>.json` kèm hash lúc nạp; bản đã lưu
 * thành bản đọc, cảnh dựng lại từ nó (không còn áp tạm món ấy)
 */
async function postHeld(name: string, group: string, variant: string, au: AuthoredGrasp | null) {
  const res = await fetch(`/api/held?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ group, variant, authored: au, hash: fetched?.j.heldHash?.[name] }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  if (fetched) {
    fetched.j.heldRaw = { ...fetched.j.heldRaw, [name]: j.item };
    fetched.j.heldHash = { ...fetched.j.heldHash, [name]: j.hash };
  }
  delete patched[name];
  if (cur) await load(cur.name, { keepTime: true, reuse: true });
  return j as { file: string; item: unknown };
}

/** Món kèm bản soạn `au` (hay bỏ bản soạn, `null`) cho nhóm × biến thể của lần soạn */
function withAuthored(t: EditTarget, au: AuthoredGrasp | null): HeldItemSpec {
  const all = structuredClone(t.spec.authored ?? {}) as NonNullable<HeldItemSpec["authored"]>;
  const by = { ...all[t.group] };
  if (au) by[t.variant] = au;
  else delete by[t.variant];
  if (Object.keys(by).length) all[t.group] = by;
  else delete all[t.group];
  return { ...t.spec, authored: Object.keys(all).length ? all : undefined };
}

function openEditor() {
  const r = selRow();
  const target = r && editTarget(r);
  if (!target || !cur) return;
  closeEditor();
  ui.selBox.hidden = true;
  ui.editor.hidden = false;
  rowsT = NaN;
  editor = new GraspEditor(
    target,
    {
      preview: async (t, au) => {
        patched[t.base] = withAuthored(t, au);
        if (cur) await load(cur.name, { keepTime: true, reuse: true });
      },
      save: async (t, au) => (await postHeld(t.base, t.group, t.variant, au)).file,
      saveAs: async (t, au, name, use) => {
        const j = await postHeld(t.base, t.group, name, au);
        const spec = rig.parseHeldItem(j.item);
        if (!spec.success) throw new Error(spec.error.message);
        const saved = `đã lưu kiểu ${name} vào ${j.file}`;
        if (!use) return { spec: spec.data, message: saved };
        const run = runOf(t.row.id, t.row.side, t.scene.t);
        if (!run || !work)
          return {
            spec: spec.data,
            message: `${saved}; không thấy lần cầm: cảnh không đổi`,
            error: true,
          };
        const { raw, changed, regrip } = setRunVariant(work.raw, run, name);
        if (!apply(raw))
          return {
            spec: spec.data,
            message: `${saved}, nhưng không ghi được \`variant\` vào cảnh: ${ui.msg.textContent}`,
            error: true,
          };
        return {
          spec: spec.data,
          message: `${saved}; cảnh: \`variant\` ở ${changed} mốc của lần cầm${keepEdge(regrip)} — chưa lưu cảnh (Lưu, Ctrl+S)`,
        };
      },
      copyTo: async (t, dst, name, au) => (await postHeld(dst, t.group, name, au)).file,
      run: (t) => {
        const run = runOf(t.row.id, t.row.side, t.scene.t);
        return run && work
          ? { label: holdLabel(run), keys: runHoldKeys(work.raw, run).length }
          : undefined;
      },
      uses: (t) =>
        work && !(rig.GROUP_VARIANTS[t.group] as readonly string[]).includes(t.variant)
          ? styleUses(work.raw, t.base, t.group, t.variant).map(
              (u) => `${u.id} tay ${SIDE_NAME[u.side]} t=${u.t}`,
            )
          : [],
      held: () => cur?.data.held as Record<string, HeldItemSpec>,
      close: () => closeEditor(),
      wheel: () => fc.wheel,
      aa: () => ui.aa.value as AaMode,
    },
    cur.held,
    ui.editor,
    ui.frame,
  );
  syncEdit();
}

// --- chỉnh dáng tay không cầm đồ ---

/** Dòng mốc của tay `side` người `id` đúng giây `at` trong `raw`; không có là `-1` */
function keyIndexAt(raw: Json, id: string, side: HandSide, at: number): number {
  const marks = marksOf(raw);
  return (handsOf(raw, id) ?? []).findIndex(
    (k) => k[side] !== undefined && Math.abs(timeOf(k.t, marks) - at) < 5e-4,
  );
}

/** Dáng có sẵn của rig và dáng của thư viện (chung, của repo) cho khung dáng tay và thẻ mốc */
function shapeEntries(): ShapeEntry[] {
  const lib = (cur?.data.hands ?? {}) as HandShapes;
  const own = fetched?.j.handsHash ?? {};
  return [
    ...Object.keys(lib)
      .filter((n) => !(n in rig.HAND_POSES))
      .sort()
      .map((name) => ({
        name,
        label: name,
        builtin: false,
        own: name in own,
        ...(lib[name].note && { note: lib[name].note }),
      })),
    ...rig.HAND_POSE_KINDS.map((name) => ({
      name,
      label: rig.HAND_POSE_LABELS[name],
      builtin: true,
      own: false,
    })),
  ];
}

/** Mốc của cảnh đang sửa gọi dáng `name` */
function shapeUses(raw: Json, name: string): string[] {
  const out: string[] = [];
  for (const c of (raw.cast as Json[] | undefined) ?? [])
    for (const k of handsOf(raw, c.id as string) ?? [])
      for (const side of ["right", "left"] as HandSide[]) {
        const v = k[side];
        if (isObj(v) && v.pose === name) out.push(`${c.id} tay ${SIDE_NAME[side]} t=${k.t}`);
      }
  return out;
}

/**
 * Ghi dáng `shape` vào `hands/<name>.json` kèm hash lúc nạp (`create`: dáng mới, file đã có thì 409); dáng đã lưu thành bản
 * đọc, cảnh dựng lại từ nó
 */
async function postHands(name: string, shape: HandShape, create: boolean) {
  const res = await fetch(`/api/hands?name=${encodeURIComponent(name)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      shape,
      hash: create ? null : (fetched?.j.handsHash?.[name] ?? null),
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error);
  if (fetched) {
    fetched.j.handsRaw = { ...fetched.j.handsRaw, [name]: j.shape };
    fetched.j.handsHash = { ...fetched.j.handsHash, [name]: j.hash };
  }
  if (cur) await load(cur.name, { keepTime: true, reuse: true, quiet: true });
  return j as { file: string };
}

/**
 * Ghi `pose: name` vào mốc tay của bàn tay `tg` ở giây đang chỉnh (không có mốc thì thêm mốc chỉ có `pose`), một bước của
 * lịch sử chung; cảnh lưu bằng Lưu như mọi mốc
 */
function useShape(tg: PoseTarget, name: string): { message: string; error?: boolean } {
  if (!work || !cur) return { message: "chưa mở cảnh", error: true };
  const id = tg.row.id;
  const side = sideOf(tg.row.side);
  const at = tg.scene.t;
  const i = keyIndexAt(work.raw, id, side, at);
  let next: Json;
  let key: KeyRef;
  try {
    if (i >= 0) {
      key = { kind: "hand", id, side, index: i };
      next = editKey(work.raw, key, (m) => {
        if (!m) throw new Error("mốc ở giây này là `null` (thả đích): thêm `pose` ở mốc khác");
        if (m.hold !== undefined)
          throw new Error("mốc ở giây này khai `hold`: dáng ngón do kiểu cầm quyết");
        m.pose = name;
        delete m.w;
      });
    } else ({ raw: next, key } = insertHandKey(work.raw, id, side, at, { pose: name }));
  } catch (e) {
    return { message: (e as Error).message, error: true };
  }
  if (!apply(next, { key }))
    return { message: `không ghi được \`pose\`: ${ui.msg.textContent}`, error: true };
  return {
    message: `${id} tay ${SIDE_NAME[side]} ${at.toFixed(2)} s: \`pose: "${name}"\`${i < 0 ? " (mốc mới chỉ có `pose`)" : ""} — chưa lưu cảnh (Lưu, Ctrl+S)`,
  };
}

const shapeHost: PoseHost = {
  shapes: shapeEntries,
  fingers: (name) => rig.shapeFingers(name, (cur?.data.hands ?? {}) as HandShapes),
  save: async (name, shape, create) => (await postHands(name, shape, create)).file,
  use: useShape,
  uses: (name) => (work ? shapeUses(work.raw, name) : []),
  close: () => closeEditor(),
  wheel: () => fc.wheel,
  aa: () => ui.aa.value as AaMode,
};

/** Khung dáng tay cho bàn tay không cầm đồ đang chọn, ở giây đang xem */
function openShapeEditor() {
  const r = selRow();
  if (!r || !cur || !work || r.hold || r.carry || !r.fig.hands) return;
  closeEditor();
  ui.selBox.hidden = true;
  ui.editor.hidden = false;
  rowsT = NaN;
  const h = r.fig.hands[r.side];
  const side = sideOf(r.side);
  const i = keyIndexAt(work.raw, r.id, side, t);
  const v = i >= 0 ? handsOf(work.raw, r.id)![i][side] : undefined;
  const pose = isObj(v) && typeof v.pose === "string" ? v.pose : undefined;
  editor = new PoseEditor(
    {
      row: r,
      k: h.scale,
      long: h.long,
      scene: editScene(r),
      drawn: Array.from({ length: 20 }, (_, j) => h.shown[j] ?? 0),
      ...(pose && { pose }),
      key: `mốc tay ${SIDE_NAME[side]} ${t.toFixed(2)} s${i < 0 ? " (mốc mới)" : ""}`,
    },
    shapeHost,
    ui.editor,
    ui.frame,
  );
  syncEdit();
}

function closeEditor() {
  if (!editor) return;
  editor.dispose();
  editor = null;
  ui.editor.hidden = true;
  const had = Object.keys(patched).length > 0;
  for (const k of Object.keys(patched)) delete patched[k];
  if (had && cur) void load(cur.name, { keepTime: true, reuse: true });
  rowsT = NaN;
  dirty = true;
  syncEdit();
}

function flyStep(now: number) {
  if (!fly || !orbit) return false;
  const k = Math.min(1, (now - fly.at) / 1000 / FLY);
  const e = k * k * (3 - 2 * k);
  free.position.lerpVectors(fly.p0, fly.p1, e);
  orbit.target.lerpVectors(fly.t0, fly.t1, e);
  if (k >= 1) {
    fly = null;
    remember();
  }
  return true;
}
let cost = { pose: 0, render: 0 };

let last = performance.now();
// fps lúc phát, đếm theo từng giây; dừng thì ẩn
let fps = 0;
let frames = 0;
let since = 0;
function loop(now: number) {
  const dt = (now - last) / 1000;
  last = now;
  if (cur && playing) {
    t += dt * lv.speed;
    if (t > cur.dur) {
      t = lv.loop ? 0 : cur.dur;
      if (!lv.loop) togglePlay();
    }
    dirty = true;
    frames++;
    if (now - since > 1000) {
      fps = Math.round((frames * 1000) / (now - since));
      [frames, since] = [0, now];
    }
  } else [fps, frames, since] = [0, 0, now];
  if (fc.step(dt)) dirty = true;
  if (flyStep(now)) dirty = true;
  if (orbit?.enabled && orbit.update()) dirty = true;
  if (dirty && cur) {
    dirty = false;
    try {
      draw();
    } catch (e) {
      playing = false;
      say(`vẽ hỏng ở ${t.toFixed(2)} s: ${(e as Error).stack ?? e}`, true);
    }
  }
  requestAnimationFrame(loop);
}

function resize() {
  if (!cur) return;
  const s = frameSize();
  cur.stage.setSize(s.w, s.h, { aa: ui.aa.value as AaMode });
  free.aspect = s.w / s.h;
  free.updateProjectionMatrix();
  dirty = true;
}

function togglePlay() {
  playing = !playing;
  ui.play.textContent = playing ? "⏸" : "▶";
  if (!playing) {
    remember();
    // dừng: đo lại bàn tay ở giây đang đứng
    rowsT = NaN;
    dirty = true;
  }
}

// --- dáng tay: hàng mốc, thẻ mốc, lịch sử, lưu ---

const sideOf = (s: Side): HandSide => (s < 0 ? "right" : "left");
const sideNum = (s: HandSide): Side => (s === "right" ? -1 : 1);
const SIDE_NAME: Record<HandSide, string> = { right: "phải", left: "trái" };
const sameKey = (a: KeyRef | null, b: KeyRef | null) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v: unknown): v is Json => !!v && typeof v === "object" && !Array.isArray(v);
const holdLabel = (r: Pick<HoldRunInfo, "item" | "group" | "variant">) =>
  `${r.item}@${r.group}${r.variant ? `/${r.variant}` : ""}`;
const MODE_NAME = {
  hand: "đồ theo tay",
  keyed: "tay theo đồ, theo mốc",
  both: "tay theo đồ, hai tay",
} as const;

/** Chọn tay `side` của `id` (người × tay của hàng mốc), camera không bay */
function selectSide(id: string, side: HandSide) {
  if (sel?.id === id && sel.side === sideNum(side)) return;
  sel = { id, side: sideNum(side) };
  lastCenter = null;
  rowsT = NaN;
  dirty = true;
}

/** Dòng mốc (`hands[i]` hay `items[i]`) của mốc */
function rowOf(raw: Json, k: KeyRef): Json | undefined {
  return k.kind === "item"
    ? (raw.items as Json[] | undefined)?.[k.index]
    : handsOf(raw, k.id)?.[k.index];
}

/**
 * Dải lần cầm của một tay: chế độ từng lần cầm, khoảng tay tự do, quãng `HOLD_BLEND` ở ranh giới; `open` là giây của lần
 * cầm đang mở thẻ lần cầm
 */
function bandsOf(runs: HoldRunInfo[], dur: number, open?: number) {
  const bands: Band[] = [];
  const blends: [number, number][] = [];
  let at = 0;
  const rs = [...runs].sort((a, b) => a.since - b.since);
  for (const r of rs) {
    if (r.since > at + 1e-6)
      bands.push({ from: at, to: r.since, kind: "free", title: "tay tự do" });
    const lead = r.lead ? ` · tay phụ, tay dẫn: ${SIDE_NAME[r.lead]}` : "";
    bands.push({
      from: r.since,
      to: r.until,
      kind: r.mode === "hand" ? "hand" : "item",
      label: holdLabel(r) + (r.lead ? " (phụ)" : ""),
      title: `${holdLabel(r)} · ${MODE_NAME[r.mode]}${lead} · ${r.since.toFixed(2)}–${r.until.toFixed(2)} s · nhấp: thẻ lần cầm, đổi chế độ`,
      run: { since: r.since, until: r.until },
      on: open !== undefined && runAt([r], open, dur) === r,
    });
    if (r.since > 0) blends.push([r.since, Math.min(r.since + rig.HOLD_BLEND, r.until)]);
    // nhả món đặt trước: bàn tay hoà ra từ nghiệm cũ
    if (
      r.mode !== "hand" &&
      r.until < dur - 1e-6 &&
      !rs.some((x) => Math.abs(x.since - r.until) < 1e-6)
    )
      blends.push([r.until, Math.min(r.until + rig.HOLD_BLEND, dur)]);
    at = Math.max(at, r.until);
  }
  if (at < dur - 1e-6) bands.push({ from: at, to: dur, kind: "free", title: "tay tự do" });
  return { bands, blends };
}

/** Hàng mốc của người đang chọn: hai tay (dải lần cầm theo chế độ) và hàng Món của tay đang chọn */
function lanesOf(id: string, on: HandSide): Lane[] {
  const raw = work!.raw;
  const marks = marksOf(raw);
  const runs = rig.holdRuns(cur!.rt, id);
  const hands = handsOf(raw, id) ?? [];
  const at = (ref: unknown, tt: number) =>
    `${typeof ref === "string" ? `${ref} = ` : ""}${tt.toFixed(3)} s`;
  const lanes: Lane[] = (["right", "left"] as HandSide[]).map((side) => {
    const keys = hands.flatMap((row, index) => {
      const v = row[side];
      if (v === undefined) return [];
      const key: KeyRef = { kind: "hand", id, side, index };
      const tt = timeOf(row.t, marks);
      const shape = handShape(v);
      const what =
        shape === "null"
          ? "null — thả đích"
          : shape === "rest"
            ? "rest — tay buông, bỏ bàn tay của hành động"
            : shape === "ring"
              ? "chỉ `hold`"
              : shape === "pose"
                ? "chỉ `pose`"
                : "đích";
      const pose = isObj(v) && typeof v.pose === "string" ? ` · dáng ${v.pose}` : "";
      return [
        {
          key,
          t: tt,
          shape,
          on: sameKey(picked, key),
          lock: isObj(v) && v.elbowLock === true,
          title: `${at(row.t, tt)} · ${what}${pose}${isObj(v) && v.ease ? ` · ${v.ease}` : ""}`,
        },
      ];
    });
    return {
      id: side,
      label: `Tay ${SIDE_NAME[side]}`,
      title: `Mốc \`world.hands\` tay ${SIDE_NAME[side]} của ${id}; nhấp để chọn tay này`,
      on: side === on,
      add: `Thêm mốc tay ${SIDE_NAME[side]} ở giây đang xem, giá trị như đang vẽ`,
      ...bandsOf(
        runs[side],
        cur!.dur,
        modeCard.sel?.id === id && modeCard.sel.side === side ? modeCard.sel.at : undefined,
      ),
      keys,
    };
  });
  const items = new Set(runs[on].map((r) => r.item));
  const keys = ((raw.items as Json[] | undefined) ?? []).flatMap((m, index) => {
    if (!items.has(m.item as string)) return [];
    const key: KeyRef = { kind: "item", index };
    const tt = timeOf(m.t, marks);
    return [
      {
        key,
        t: tt,
        shape: "diamond" as const,
        on: sameKey(picked, key),
        title: `${m.item} · ${m.cast} · ${at(m.t, tt)}${m.ease ? ` · ${m.ease}` : ""}`,
      },
    ];
  });
  const itemLane: Lane = {
    id: "item",
    label: "Món",
    title: `Mốc \`items[]\` của món tay ${SIDE_NAME[on]} cầm`,
    add: `Thêm mốc món của lần cầm tay ${SIDE_NAME[on]} ở giây đang xem (tay theo đồ), chỗ và hướng như đang vẽ`,
    bands: [],
    blends: [],
    keys,
  };
  lanes.push(itemLane, ...trackLanes(id, on));
  return lanes;
}

const ARM_PART = (s: { arm: boolean; hand: boolean }) =>
  [s.arm && "cánh tay", s.hand && "bàn tay"].filter(Boolean).join(", ");

/** Tay clip chạm ở giây đang xem, một dòng: `tay phải (bàn tay)` */
function touchText(id: string, k: ClipRef): string {
  const s = rig.clipSides(cur!.rt, id, k.track, k.clip, t);
  if (!s) return "không đo được (cảnh đang dựng lại)";
  const parts = (["right", "left"] as HandSide[])
    .filter((x) => s[x].arm || s[x].hand)
    .map((x) => `tay ${SIDE_NAME[x]} (${ARM_PART(s[x])})`);
  return parts.length ? parts.join(", ") : "không chạm tay nào";
}

/** Mỗi track của người `id` một hàng: dải clip, sáng khi clip chạm tay `on` (`clipSides` của rig), sọc là `blend` */
function trackLanes(id: string, on: HandSide): Lane[] {
  const raw = work!.raw;
  const marks = marksOf(raw);
  const live = cur!.src === raw ? cur!.rt.cast.find((m) => m.id === id) : undefined;
  return (tracksOf(raw, id) ?? []).map((tr, ti) => {
    const clips = (tr.clips as Json[] | undefined) ?? [];
    const starts = clips.map((c) => timeOf(c.start, marks));
    const bands: Band[] = [];
    const blends: [number, number][] = [];
    clips.forEach((c, ci) => {
      const from = starts[ci];
      const to = starts[ci + 1] ?? cur!.dur;
      const s = live && rig.clipSides(cur!.rt, id, ti, ci, t);
      const touch = s?.[on];
      const act = typeof c.action === "string" ? c.action : undefined;
      bands.push({
        from,
        to,
        kind: "clip",
        label: act ?? "(rỗng)",
        title: `${act ?? "clip rỗng"} · start ${c.start}${typeof c.start === "string" ? ` = ${from.toFixed(2)} s` : " s"}${touch && (touch.arm || touch.hand) ? ` · chạm tay ${SIDE_NAME[on]}: ${ARM_PART(touch)}` : ` · không chạm tay ${SIDE_NAME[on]}`} · nhấp: thẻ clip`,
        clip: ci,
        dim: !(touch?.arm || touch?.hand),
        on: clipSel?.id === id && clipSel.track === ti && clipSel.clip === ci,
      });
      const tau = live?.tracks[ti]?.clips[ci]?.tau ?? 0;
      if (tau > 0) blends.push([from, Math.min(from + tau, to)]);
    });
    const name = typeof tr.name === "string" ? tr.name : `#${ti}`;
    return {
      id: `track:${ti}`,
      kind: "track" as const,
      label: `track ${name}`,
      title: `Track \`${name}\` của ${id}: dải sáng là clip chạm tay ${SIDE_NAME[on]}; nhấp dải mở thẻ clip`,
      bands,
      blends,
      keys: [],
    };
  });
}

const track = new KeyTrack(
  {
    lanes: ui.lanes,
    labels: ui.laneLabels,
    adds: ui.laneAdds,
    playhead: ui.playhead,
    scroller: $<HTMLDivElement>("tlScroll"),
  },
  {
    pick(k) {
      if (!work) return;
      if (k.kind === "hand") selectSide(k.id, k.side);
      modeCard.sel = null;
      clipSel = null;
      picked = k;
      seek(keyTime(work.raw, k));
      syncEdit();
    },
    move(k, at, alt) {
      if (!work) return;
      try {
        const r = moveKey(work.raw, k, at, alt);
        const next = editKey(r.raw, r.key, (m) => touch(m));
        if (apply(next, { key: r.key })) {
          const tt = keyTime(next, r.key);
          say(`đã dời mốc tới ${rowOf(next, r.key)!.t} (${tt.toFixed(3)} s)`);
          seek(tt);
        }
      } catch (e) {
        say((e as Error).message, true);
        syncEdit();
      }
    },
    preview(k, at, alt) {
      const row = work && rowOf(work.raw, k);
      if (!row) return "";
      const marks = marksOf(work!.raw);
      const ref = retime(row.t, at, marks, alt);
      return typeof ref === "string" ? `${ref} = ${timeOf(ref, marks).toFixed(3)} s` : `${ref} s`;
    },
    snap(k, at) {
      const row = work && rowOf(work.raw, k);
      const m = typeof row?.t === "string" ? rig.parseMarkRef(row.t) : null;
      const base = m ? (marksOf(work!.raw)[m.name] ?? 0) : 0;
      return Math.max(0, base + Math.round((at - base) * FPS) / FPS);
    },
    add: (lane) => addKey(lane),
    lane(lane) {
      if (!sel || (lane !== "right" && lane !== "left")) return;
      selectSide(sel.id, lane);
      syncEdit();
    },
    band(lane, b) {
      if (sel && b.clip !== undefined && lane.startsWith("track:")) {
        clipSel = { id: sel.id, track: Number(lane.slice(6)), clip: b.clip };
        picked = null;
        modeCard.close();
        syncEdit();
        return;
      }
      if (!sel || !b.run || (lane !== "right" && lane !== "left")) return;
      clipSel = null;
      selectSide(sel.id, lane);
      picked = null;
      modeCard.open(sel.id, lane, (b.run.since + b.run.until) / 2);
      syncEdit();
    },
  },
);

/** Thẻ lần cầm: công tắc chế độ, bảng độ lệch, Áp / Thôi */
const modeCard = new ModeCard(ui.runCard, {
  ctx: () =>
    work && cur && edMode === "hands" && !editor
      ? {
          raw: work.raw,
          rt: cur.rt,
          building: cur.src !== work.raw,
          t,
          dur: cur.dur,
          rebuild: (j: unknown) => rebuildRaw(j as Json),
        }
      : null,
  apply(raw, message) {
    if (!apply(raw, { key: null })) return false;
    say(`đã đổi chế độ lần cầm ${message}`);
    return true;
  },
});

/**
 * Áp JSON thô mới của cảnh: parse, làm mới tại chỗ (`restage`; không được thì dựng lại cả cảnh). Hỏng thì giữ bản cũ, báo
 * lỗi (dựng lại cả cảnh hỏng thì về bản trước, lời báo lỗi còn lại). Không đổi gì thì không thành bước (`record`).
 * `history: false` là bước hoàn tác / làm lại
 */
function apply(next: Json, o: { key?: KeyRef | null; history?: boolean } = {}): boolean {
  if (!work || !cur) return false;
  // hết mốc món mà bản lưu không có `items`: bỏ khoá, như bản lưu
  if (Array.isArray(next.items) && !next.items.length && !("items" in JSON.parse(work.saved)))
    delete next.items;
  const prev = JSON.stringify(work.raw);
  const parsed = rig.parseScene(next);
  if (!parsed.success) {
    const why = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    say(`không áp được: ${why}`, true);
    syncEdit();
    return false;
  }
  let fresh: boolean;
  try {
    fresh = restage(parsed.data);
  } catch (e) {
    say(`không áp được: ${(e as Error).message}`, true);
    syncEdit();
    return false;
  }
  const stacks = { undo: [...work.undo], redo: [...work.redo] };
  if (o.history !== false && record(work, prev, JSON.stringify(next))) {
    picks.set(prev, picked);
    // nhánh làm lại vừa bị cắt: bỏ mốc mở của các bản không còn trong lịch sử
    const live = new Set([...work.undo, ...work.redo]);
    for (const k of picks.keys()) if (!live.has(k)) picks.delete(k);
  }
  work.raw = next;
  if (fresh) cur.src = next;
  if (o.key !== undefined) picked = o.key;
  say("");
  if (!fresh) {
    const name = work.name;
    void load(name, { keepTime: true, reuse: true, full: true, quiet: true }).then(async (ok) => {
      if (ok || !work || work.name !== name || JSON.stringify(work.raw) !== JSON.stringify(next))
        return;
      // cảnh dựng không được: về bản trước, giữ lời báo lỗi của lần dựng hỏng
      const why = (ui.msg.textContent ?? "").split(/\n\s+at /)[0];
      work.raw = JSON.parse(prev);
      Object.assign(work, stacks);
      await load(name, { keepTime: true, reuse: true, full: true });
      say(`không áp được (dựng lại cảnh hỏng, đã về bản trước): ${why}`, true);
      syncEdit();
    });
  }
  syncEdit();
  return true;
}

/** Hoàn tác (`back`) / làm lại một bước của lịch sử chung */
function step(back: boolean) {
  if (!work || editor) return;
  const w = work;
  const now = JSON.stringify(w.raw);
  const was = picked;
  const go = (to: string) => apply(JSON.parse(to), { history: false, key: picks.get(to) ?? null });
  if (travel(w, back, now, go)) {
    picks.set(now, was);
    say(back ? "đã hoàn tác" : "đã làm lại");
  }
  syncEdit();
}

/** Thanh trên, hàng mốc và thẻ mốc theo bản đang sửa */
function syncEdit() {
  const d = isDirty();
  ui.dirty.hidden = !d;
  ui.save.disabled = !d;
  ui.discard.disabled = !d;
  ui.undo.disabled = !work?.undo.length || !!editor;
  ui.redo.disabled = !work?.redo.length || !!editor;
  document.title = `${d ? "● " : ""}${work?.name ?? "Studio 3D"} — Studio 3D`;
  for (const b of ui.edMode.querySelectorAll<HTMLButtonElement>("button"))
    b.classList.toggle("on", b.dataset.m === edMode);
  ui.footer.classList.toggle("hands", edMode === "hands");
  document.body.classList.toggle("hands", edMode === "hands");
  document.body.classList.toggle("dirty", d);
  if (picked && (!work || keyValue(work.raw, picked) === undefined)) picked = null;
  if (picked?.kind === "hand" && sel && picked.id !== sel.id) picked = null;
  if (clipSel && (!work || !sel || clipSel.id !== sel.id || !clipOf(work.raw, clipSel)))
    clipSel = null;
  if (!cur || !work || edMode !== "hands") {
    track.render(null, cur?.dur ?? 1);
    renderCard(ui.keyCard, null, cardHost);
    renderClipCard(ui.clipCard, null, clipHost);
    modeCard.render();
    return;
  }
  if (!sel)
    track.render(
      [],
      cur.dur,
      "Bấm một bàn tay (trên hình hay trong panel) để hiện hàng mốc của người ấy",
    );
  else track.render(lanesOf(sel.id, sideOf(sel.side)), cur.dur);
  track.playhead(t, cur.dur);
  renderCard(ui.keyCard, picked && cardOf(picked), cardHost);
  renderClipCard(ui.clipCard, clipSel && clipCardOf(clipSel), clipHost);
  modeCard.render();
}

/** Thẻ clip: hành động, `start`, `blend`, `mask`, `note`, tay clip chạm, hành động thay được */
function clipCardOf(k: ClipRef): ClipCardModel | null {
  if (!work || !cur) return null;
  const raw = work.raw;
  const c = clipOf(raw, k);
  const tr = tracksOf(raw, k.id)?.[k.track];
  if (!c || !tr) return null;
  const actions = cur.data.actions as Record<string, rig.ActionData>;
  const act = typeof c.action === "string" ? c.action : "";
  const a = act ? actions[act] : undefined;
  const at = timeOf(c.start, marksOf(raw));
  const live = cur.src === raw ? cur.rt.cast.find((m) => m.id === k.id) : undefined;
  const tau = live?.tracks[k.track]?.clips[k.clip]?.tau;
  const mask = c.mask as string[] | undefined;
  return {
    title: `Clip · track ${typeof tr.name === "string" ? tr.name : `#${k.track}`} #${k.clip} · ${k.id}`,
    action: act,
    start: `${c.start}${typeof c.start === "string" ? ` = ${at.toFixed(3)} s` : " s"}`,
    blend:
      c.blend !== undefined
        ? `${c.blend} s`
        : `tự suy${tau !== undefined ? `: ${tau.toFixed(2)} s` : ""}`,
    mask: mask
      ? `clip: ${mask.join(", ")}`
      : a
        ? `theo hành động: ${rig.actionMask(a).join(", ") || "—"}`
        : "—",
    touch: live ? touchText(k.id, k) : "đang dựng lại cảnh",
    mirror: c.mirror === true,
    ...(a?.note && { note: a.note }),
    options: compatibleActions(actions, act || undefined, mask),
    last: ((tr.clips as Json[] | undefined)?.length ?? 0) <= 1,
  };
}

const clipHost = {
  del() {
    if (!work || !clipSel) return;
    const k = clipSel;
    const tr = tracksOf(work.raw, k.id)?.[k.track];
    const last = ((tr?.clips as Json[] | undefined)?.length ?? 0) <= 1;
    const act = clipOf(work.raw, k)?.action ?? "clip rỗng";
    try {
      const next = deleteClip(work.raw, k);
      clipSel = null;
      if (apply(next, { key: null }))
        say(
          `đã xoá clip ${act}${last ? ` — track ${tr?.name ?? `#${k.track}`} hết clip, bỏ cả track` : ""}`,
        );
    } catch (e) {
      say((e as Error).message, true);
    }
  },
  swap(action: string) {
    if (!work || !clipSel) return;
    try {
      if (apply(setClipAction(work.raw, clipSel, action))) say(`clip đổi sang ${action}`);
    } catch (e) {
      say((e as Error).message, true);
    }
  },
  mirror(on: boolean) {
    if (!work || !clipSel) return;
    try {
      if (apply(setClipMirror(work.raw, clipSel, on)))
        say(`clip ${on ? "soi gương" : "bỏ soi gương"}`);
    } catch (e) {
      say((e as Error).message, true);
    }
  },
  close() {
    clipSel = null;
    syncEdit();
  },
};

/** Mốc kế (cùng tay, cùng món) mà sửa mốc `k` còn đổi hình tới: mốc sau, chuỗi `auto` thì mốc sau nữa */
function reach(raw: Json, k: KeyRef): number | undefined {
  const marks = marksOf(raw);
  const row = rowOf(raw, k)!;
  const list =
    k.kind === "item"
      ? ((raw.items as Json[]) ?? []).filter((m) => m.item === row.item)
      : (handsOf(raw, k.id) ?? []).filter((x) => x[k.side] !== undefined);
  const ease = (x: Json) => (k.kind === "item" ? x.ease : (x[k.side] as Json | null)?.ease);
  const i = list.indexOf(row);
  const next = list[i + 1];
  if (!next) return undefined;
  const after = list[i + 2];
  const auto = ease(next) === "auto" && after && ease(after) === "auto";
  return timeOf((auto ? after : next).t, marks);
}

/** Bản `held/<món>.json` của món (tên thể hiện `vali:2` tra món gốc) */
function heldSpec(item: string): HeldItemSpec | undefined {
  const held = cur?.data.held as Record<string, HeldItemSpec> | undefined;
  return held?.[item] ?? held?.[rig.heldBase(item)];
}

/** Món, nhóm, biến thể cho phần `hold` của thẻ */
function variantsOf(item: string, group: string) {
  const base: readonly string[] =
    (rig.GROUP_VARIANTS as Record<string, readonly string[]>)[group] ?? [];
  const spec = heldSpec(item);
  const named = Object.entries(spec?.authored?.[group] ?? {})
    .filter(([n]) => !base.includes(n))
    .map(([name, a]) => ({ name, ...(a.note && { note: a.note }) }));
  return [...base.map((name) => ({ name })), ...named];
}

function cardOf(k: KeyRef): CardModel | null {
  if (!work || !cur) return null;
  const raw = work.raw;
  const row = rowOf(raw, k);
  if (!row) return null;
  const v = keyValue(raw, k);
  const m = isObj(v) ? v : null;
  const tt = timeOf(row.t, marksOf(raw));
  const until = reach(raw, k);
  const who = k.kind === "hand" ? k.id : (row.cast as string);
  const side = k.kind === "hand" ? k.side : sel ? sideOf(sel.side) : "right";
  const run = runAt(rig.holdRuns(cur.rt, who)[side], tt, cur.dur);
  const scened = Object.values(rig.holdRuns(cur.rt, who)).flatMap((rs) => rs.map((r) => r.item));
  const items = [...new Set([...Object.keys(cur.data.held), ...scened])].sort();
  const pick = holdPickOf(m?.hold);
  const placed = !!run && run.mode !== "hand" && !run.lead;
  const lockOn = m?.elbowLock === true;
  const rest = m?.rest === true;
  const idle = !lockOn
    ? undefined
    : run?.lead
      ? "tay phụ của `both` không khoá khuỷu"
      : !placed && m?.at === undefined && m?.to === undefined
        ? "khoá không có tác dụng: mốc không có `at` / `to`, ở mốc ấy tay theo hành động"
        : undefined;
  const json =
    k.kind === "hand"
      ? { t: row.t, [k.side]: v, ...(row.snap !== undefined && { snap: row.snap }) }
      : row;
  return {
    title:
      k.kind === "hand"
        ? `Mốc tay ${SIDE_NAME[k.side]} · ${k.id}`
        : `Mốc món ${row.item} · ${row.cast}`,
    when: `${tt.toFixed(3)} s${typeof row.t === "string" ? ` (${row.t})` : ""}`,
    until:
      until === undefined
        ? "ảnh hưởng tới hết cảnh"
        : `ảnh hưởng tới ~${until.toFixed(2)} s (ước: tới mốc kế; chuỗi auto thêm một mốc)`,
    ease: (m?.ease as Ease | undefined) ?? "",
    bezier: (m?.bezier as number[] | undefined) ?? rig.BEZIER_DEFAULT,
    ...(!m && { noEase: "mốc `null` không có `ease`: đoạn tới nó hoà `smooth`" }),
    ...(k.kind === "hand" &&
      !rest && {
        hold: {
          mode: m?.hold === null ? "null" : m?.hold === undefined ? "none" : "set",
          item: pick?.item ?? run?.item ?? items[0] ?? "",
          group: pick?.group ?? run?.group ?? "sheet",
          variant: pick?.variant ?? "",
        },
        shape: {
          pose: typeof m?.pose === "string" ? m.pose : "",
          ...(typeof m?.w === "number" && { w: m.w }),
          options: shapeEntries().map((e) => ({
            v: e.name,
            label: `${e.builtin ? `${e.name} (${e.label})` : `${e.name} · hands/`}${e.note ? ` — ${e.note}` : ""}`,
          })),
          ...(!m
            ? { disabled: "mốc `null` (thả đích) không có dáng ngón: thêm `pose` ở mốc khác" }
            : m.hold !== undefined && { disabled: "mốc có `hold`: dáng ngón do kiểu cầm quyết" }),
        },
        lock: {
          on: lockOn,
          ...(!m && { disabled: "mốc `null` không có khuỷu" }),
          ...(idle && { idle }),
        },
      }),
    ...(k.kind === "item"
      ? placeOf(row, tt)
      : m && !rest && run?.mode === "hand" && !run.lead && handPlaceOf(k.id, k.side, run.item, tt)),
    ...anchorOf(raw, k),
    items,
    groups: rig.GROUP_IDS,
    variants: variantsOf,
    json: JSON.stringify(json, null, 2),
    notes: [
      ...(rest
        ? [
            "mốc `rest`: tay buông — thả đích, bỏ bàn tay (ngón, xoay, gập cổ tay, palm / fingers) của hành động ở tay này tới mốc sau; xoá mốc là trả lại",
          ]
        : []),
      ...(added && sameKey(added.key, k) ? added.notes : []),
    ],
  };
}

/** Mốc tay `at` còn hiệu lực lúc người dời, quay (`worldAtMoves`): lời nhắc của thẻ */
function anchorOf(raw: Json, k: KeyRef): Pick<CardModel, "anchor"> {
  const mv = worldAtMoves(raw, k);
  if (!mv) return {};
  return {
    anchor: `đích \`at\` là điểm thế giới, đứng yên khi người dời (từ ${mv.t.toFixed(2)} s)${mv.turn === undefined ? "" : `, quay (từ ${mv.turn.toFixed(2)} s)`} trong lúc mốc còn hiệu lực: tay lệch khỏi thân — đổi sang đích theo mốc thân để tay đi theo người`,
  };
}

/** Bàn tay cầm theo đồ (không phải tay phụ) món của mốc món `row` ở `tt` */
function itemHand(row: Json, tt: number): HandSide | undefined {
  const runs = rig.holdRuns(cur!.rt, row.cast as string);
  return (["right", "left"] as const).find((s) => {
    const r = runAt(runs[s], tt, cur!.dur);
    return !!r && r.item === row.item && r.mode !== "hand" && !r.lead;
  });
}

/** Ô số chỗ, hướng của thẻ mốc món: như vẽ ở giây của mốc */
function placeOf(row: Json, tt: number): Pick<CardModel, "place"> {
  const id = row.cast as string;
  const p = itemPlace(cur!.rt, id, row.item as string, tt, charOf(id).char);
  if (!p) return {};
  return {
    place: {
      ...p,
      ...(!itemHand(row, tt) && {
        disabled:
          "món không ở tay theo đồ ở giây của mốc (đồ theo tay, đã thả): sửa số khi tay theo đồ",
      }),
    },
  };
}

/** Ô số chỗ, hướng của thẻ mốc tay đồ theo tay: món như vẽ ở giây của mốc */
function handPlaceOf(
  id: string,
  side: HandSide,
  item: string,
  tt: number,
): Pick<CardModel, "place"> {
  const p = heldPlace(cur!.rt, id, side, item, tt, charOf(id).char);
  return p ? { place: p } : {};
}

/** Sửa mốc đang mở thẻ bằng `fn`; mốc chưa khai `ease` thì ghi `auto` */
function editPicked(fn: (m: Json | null) => Json | null | void) {
  if (!work || !picked) return;
  const k = picked;
  try {
    const next = editKey(work.raw, k, (m) => {
      const r = fn(m);
      touch(r === undefined ? m : r);
      return r;
    });
    apply(next, { key: k });
  } catch (e) {
    say((e as Error).message, true);
  }
}

const cardHost = {
  place(to: { at?: V3; angles?: V3 }) {
    if (!work || !picked) return;
    const k = picked;
    const row = rowOf(work.raw, k);
    if (!row) return;
    const tt = timeOf(row.t, marksOf(work.raw));
    const side = k.kind === "hand" ? k.side : itemHand(row, tt);
    const id = k.kind === "hand" ? k.id : (row.cast as string);
    if (!side) return say("món không ở tay theo đồ ở giây của mốc", true);
    const what = to.angles ? "xoay món" : "dời món";
    const ok = grab.run(what, (c) => {
      const r = (k.kind === "hand" ? placeHand : placeItem)(
        c.raw,
        c.rt,
        id,
        side,
        tt,
        to,
        c.opts(id),
      );
      return { raw: r.raw, key: r.key, say: [`đã ${what} (số)`, ...r.notes].join(" · ") };
    });
    if (!ok) {
      say("đang áp thao tác trước: thử lại", true);
      syncEdit();
    }
  },
  anchor() {
    if (!work || picked?.kind !== "hand") return;
    const k = picked;
    const tt = keyTime(work.raw, k);
    const ok = grab.run("đổi sang mốc thân", (c) => {
      const r = anchorHand(c.raw, c.rt, k.id, k.side, tt, c.opts(k.id));
      return {
        raw: r.raw,
        key: r.key,
        say: ["đã đổi đích sang mốc thân hip", ...r.notes].join(" · "),
      };
    });
    if (!ok) {
      say("đang áp thao tác trước: thử lại", true);
      syncEdit();
    }
  },
  ease(e: Ease | undefined, bezier?: number[]) {
    if (!work || !picked) return;
    const k = picked;
    try {
      const next = editKey(work.raw, k, (m) => {
        if (!m) throw new Error("mốc `null` không có `ease`");
        setEase(m, e, bezier);
      });
      apply(next, { key: k });
    } catch (err) {
      say((err as Error).message, true);
    }
  },
  hold(h: HoldPick | null | undefined, what?: "item" | "group" | "variant") {
    if (what === "item" && h) return pickGroup(h);
    editPicked((m) => {
      if (!m && h === undefined) return;
      const o = m ?? {};
      setHold(o, h, h ? heldSpec(h.item) : undefined);
      return o;
    });
  },
  lock(on: boolean) {
    if (!work || !cur || picked?.kind !== "hand") return;
    const k = picked;
    let elbow: number[] | undefined;
    const m = keyValue(work.raw, k);
    if (on && isObj(m) && !m.elbow) {
      const d = drawnHand(cur.rt, k.id, k.side, keyTime(work.raw, k), charOf(k.id));
      // `elbow` theo hệ của đích: mốc có `at` thế giới rig, mốc khác hệ thân
      const e =
        d?.elbow &&
        (m.at !== undefined || !d.Rr
          ? d.elbow
          : rig.rigElbowBody(d.Rr, k.side === "right" ? -1 : 1, d.elbow));
      elbow = e?.map((x) => Math.round(x * 1e4) / 1e4);
      if (!elbow) return say("không lấy được hướng khuỷu đang vẽ ở mốc ấy", true);
    }
    editPicked((x) => {
      if (!x) throw new Error("mốc `null` không có khuỷu");
      if (on) {
        if (elbow) x.elbow = elbow;
        x.elbowLock = true;
      } else delete x.elbowLock;
    });
  },
  shape(pose: string | undefined, w: number | undefined) {
    if (!work || picked?.kind !== "hand") return;
    const k = picked;
    const m = keyValue(work.raw, k);
    // mốc chỉ có `pose` mà bỏ dáng thì không còn gì: xoá mốc
    if (!pose && handShape(m) === "pose") return deletePicked();
    try {
      const next = editKey(work.raw, k, (x) => {
        if (!x) throw new Error("mốc `null` không có dáng ngón");
        if (pose) x.pose = pose;
        else delete x.pose;
        if (pose && w !== undefined && w < 1) x.w = w;
        else delete x.w;
      });
      apply(next, { key: k });
    } catch (e) {
      say((e as Error).message, true);
    }
  },
  del: () => deletePicked(),
  close() {
    picked = null;
    syncEdit();
  },
};

/**
 * Đổi món của `hold` ở thẻ: thử nhóm đang chọn rồi lần lượt các nhóm khác, áp nhóm đầu tiên mà cảnh dựng và giải được tay
 * ở mốc ấy; không nhóm nào được thì không áp, báo lỗi của nhóm đang chọn
 */
function pickGroup(h: HoldPick) {
  if (!work || !cur || picked?.kind !== "hand") return;
  const k = picked;
  const at = keyTime(work.raw, k);
  let first: string | undefined;
  for (const group of [h.group, ...rig.GROUP_IDS.filter((g) => g !== h.group)]) {
    try {
      const next = editKey(work.raw, k, (m) => {
        const o = m ?? {};
        setHold(o, { item: h.item, group });
        touch(o);
        return o;
      });
      drawnHand(rebuildRaw(next), k.id, k.side, at, charOf(k.id));
      if (apply(next, { key: k }) && group !== h.group)
        say(`${h.item} không cầm được kiểu \`${h.group}\` (${first}): đã chọn nhóm \`${group}\``);
      return;
    } catch (e) {
      first ??= (e as Error).message;
    }
  }
  say(`không đổi được món sang ${h.item}: ${first}`, true);
  syncEdit();
}

/** Nhân vật như vẽ và mắt ống kính (thế giới rig) cho `handReport` */
function charOf(id: string) {
  const p = cur!.stage.camera.position;
  return { char: cur!.posed[id]?.body, eye: [p.x / rig.U, -p.y / rig.U, -p.z / rig.U] };
}

/** Runtime của JSON thô `raw` trên dữ liệu đã dựng cảnh: để đo mốc mới trước khi áp */
function rebuildRaw(raw: Json): SceneRuntime {
  const p = rig.parseScene(raw);
  if (!p.success) throw new Error(`scene JSON sai: ${p.error.message}`);
  return runtimeOf(p.data, cur!.data).runtime;
}

/**
 * Nút ＋ của hàng: mốc mới ở giây đang xem, `ease: "auto"`, hình ở giây ấy giữ nguyên (`plus.ts`: dựng lại, đo, bù `at`);
 * không giữ được thì chặn kèm lời báo
 */
function addKey(lane: string) {
  if (!work || !cur || !sel) return;
  const id = sel.id;
  const at = t;
  const marks = marksOf(work.raw);
  const side = lane === "item" ? sideOf(sel.side) : (lane as HandSide);
  if (lane !== "item") selectSide(id, side);
  const have =
    lane === "item"
      ? -1
      : (handsOf(work.raw, id) ?? []).findIndex(
          (k) => k[side] !== undefined && Math.abs(timeOf(k.t, marks) - at) < 5e-4,
        );
  if (have >= 0) {
    picked = { kind: "hand", id, side, index: have };
    syncEdit();
    return say("tay đã có mốc ở giây này: sửa ở thẻ mốc");
  }
  const run = runAt(rig.holdRuns(cur.rt, id)[side], at, cur.dur);
  if (lane === "item") {
    if (!run) return say(`tay ${SIDE_NAME[side]} không cầm món ở ${at.toFixed(2)} s`, true);
    if (run.mode === "hand")
      return say("lần cầm đồ theo tay: món theo bàn tay, không có mốc món", true);
    const hit = ((work.raw.items as Json[] | undefined) ?? []).findIndex(
      (m) => m.item === run.item && Math.abs(timeOf(m.t, marks) - at) < 5e-4,
    );
    if (hit >= 0) {
      picked = { kind: "item", index: hit };
      syncEdit();
      return say("món đã có mốc ở giây này: sửa ở thẻ mốc");
    }
  }
  say("đang thêm mốc: dựng lại cảnh để đo…");
  const raw = work.raw;
  const o = { ...charOf(id), rebuild: rebuildRaw, fps: FPS, dur: cur.dur };
  // để thanh trạng thái kịp vẽ lời chờ: đo có thể mất vài trăm ms
  setTimeout(() => {
    if (!work || !cur || work.raw !== raw) return;
    try {
      const r =
        lane === "item"
          ? plusItem(raw, cur.rt, id, side, run!.item, at, o)
          : plusHand(raw, cur.rt, id, side, at, o);
      added = { key: r.key, notes: r.notes };
      const gap = Object.entries(r.gap)
        .map(([k, v]) => `${{ grip: "tâm nắm", wrist: "cổ tay", item: "món" }[k]} ${v!.toFixed(2)}`)
        .join(", ");
      if (apply(r.raw, { key: r.key }))
        say(
          `đã thêm mốc ${lane === "item" ? `món ${run!.item} ` : ""}${at.toFixed(2)} s (lệch ${gap} px)${r.notes.length ? ` — ${r.notes.join("; ")}` : ""}`,
        );
    } catch (e) {
      say((e as Error).message, true);
    }
  }, 30);
}

function deletePicked() {
  if (!work || !picked) return;
  try {
    const at = keyTime(work.raw, picked);
    if (apply(deleteKey(work.raw, picked), { key: null })) say(`đã xoá mốc ${at.toFixed(2)} s`);
  } catch (e) {
    say((e as Error).message, true);
  }
}

function setEdMode(m: "view" | "hands") {
  edMode = m;
  localStorage.setItem("studio3d.mode", m);
  rowsT = NaN;
  dirty = true;
  syncEdit();
  remember();
}

/** Người `id` trong `cast` của JSON thô */
const castOf = (raw: Json, id: string) =>
  (raw.cast as Json[] | undefined)?.find((m) => isObj(m) && m.id === id);

/** Bản gửi lưu: khoá `items`, `cast[].baseMirror` bản đang sửa bỏ mà bản đã lưu có thành `null` để server bỏ khoá ấy trên đĩa */
function savedShape(raw: Json, saved: Json): Json {
  const out: Json = !("items" in raw) && "items" in saved ? { ...raw, items: null } : { ...raw };
  if (Array.isArray(raw.cast))
    out.cast = raw.cast.map((m) =>
      isObj(m) && !("baseMirror" in m) && castOf(saved, m.id as string)?.baseMirror !== undefined
        ? { ...m, baseMirror: null }
        : m,
    );
  return out;
}

/** Lưu mốc tay, mốc món, track vào `scenes/` kèm hash lúc nạp; file đã đổi trên đĩa thì 409, hiện hộp chọn */
let saving = false;
async function save() {
  if (!work || !isDirty() || saving) return;
  saving = true;
  const name = work.name;
  const text = JSON.stringify(work.raw);
  try {
    const res = await fetch(`/api/scene?name=${encodeURIComponent(name)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hash: work.hash,
        scene: savedShape(work.raw, JSON.parse(work.saved)),
      }),
    });
    const j = await res.json();
    if (res.status === 409) {
      ui.conflict.hidden = false;
      say("");
      return;
    }
    if (j.error) return say(`Lưu không được: ${j.error}`, true);
    if (work?.name !== name) return;
    work.hash = j.hash;
    work.saved = text;
    if (fetched?.name === name) fetched.j = { ...fetched.j, raw: j.raw, hash: j.hash };
    ui.conflict.hidden = true;
    say(`Đã lưu ${j.file}`);
  } catch (e) {
    say(`Lưu không được: ${(e as Error).message}`, true);
  } finally {
    saving = false;
    syncEdit();
  }
}

/**
 * Hộp 409, **Tải bản đĩa về**: bản đĩa thành một bước mới của lịch sử (hash mới, là bản đã lưu); Ctrl+Z quay lại bản của
 * mình để so
 */
async function takeDisk() {
  if (!work || !cur) return;
  const w = work;
  const name = w.name;
  say(`Đang tải ${name} từ đĩa…`);
  try {
    const j: Scene3Json = await (await fetch(`/api/scene?name=${encodeURIComponent(name)}`)).json();
    if (j.error) throw new Error(j.error);
    if (work !== w) return;
    const old = { raw: w.raw, hash: w.hash, saved: w.saved, undo: [...w.undo], redo: [...w.redo] };
    const oldFetched = fetched;
    const disk = rig.sceneVersionUp(structuredClone(j.raw)) as Json;
    record(w, JSON.stringify(w.raw), JSON.stringify(disk));
    Object.assign(w, {
      raw: disk,
      hash: j.hash,
      saved: JSON.stringify(disk),
    });
    fetched = { name, j };
    ui.conflict.hidden = true;
    // chỉ số mốc của bản đĩa khác bản mình
    picked = null;
    if (await load(name, { keepTime: true, reuse: true, full: true })) {
      say("đã tải bản đĩa về (một bước mới): Ctrl+Z quay lại bản của mình để so");
      return;
    }
    const why = ui.msg.textContent ?? "";
    if (work !== w) return;
    Object.assign(w, old);
    fetched = oldFetched;
    await load(name, { keepTime: true, reuse: true, full: true });
    say(`bản đĩa không dựng được, giữ bản của mình: ${why}`, true);
  } catch (e) {
    say(`Tải bản đĩa không được: ${(e as Error).message}`, true);
  } finally {
    syncEdit();
  }
}

/** Nạp lại từ đĩa (hỏi trước khi bỏ thay đổi chưa lưu); `full`: dựng lại cả cảnh, giữ bản đang sửa */
function reload(full: boolean) {
  if (!cur) return;
  if (full) return void load(cur.name, { keepTime: true, keepWork: true, full: true });
  if (isDirty() && !confirm("Cảnh có thay đổi chưa lưu. Bỏ chúng và nạp lại từ đĩa?")) return;
  void load(cur.name, { keepTime: true });
}

// --- giao diện ---

function openScene(name: string) {
  if (!name || name === cur?.name) return;
  if (isDirty() && !confirm(`${work!.name} có thay đổi chưa lưu. Bỏ chúng và mở ${name}?`)) {
    ui.scene.value = cur?.name ?? "";
    return;
  }
  void load(name);
}
ui.scene.addEventListener("change", () => openScene(ui.scene.value.trim()));
/** Màn hẹp (điện thoại dọc, điện thoại ngang): danh sách cảnh là ngăn kéo mở bằng ☰, panel bàn tay nhớ gập riêng */
const narrow = matchMedia("(max-width: 760px), (max-height: 500px) and (pointer: coarse)");
function setScenesOpen(on: boolean) {
  document.body.classList.toggle("scenesOpen", on);
  ui.scrim.hidden = !on;
  if (on && LIB && !GEN) libPanel.reveal();
}
ui.sceneOpen.onclick = () => setScenesOpen(!document.body.classList.contains("scenesOpen"));
ui.scrim.onclick = () => setScenesOpen(false);
const sceneList = new SceneList(ui.sceneList, ui.sceneFilter, ui.sceneCount, (n) => {
  setScenesOpen(false);
  openScene(n);
});
ui.sceneToggle.onclick = () => {
  if (narrow.matches) return setScenesOpen(false);
  ui.sceneSide.classList.toggle("shut");
  localStorage.setItem("studio3d.sceneSide", ui.sceneSide.classList.contains("shut") ? "shut" : "");
};
if (localStorage.getItem("studio3d.sceneSide") === "shut") ui.sceneSide.classList.add("shut");
ui.reload.onclick = (e) => (LIB ? void reloadLibrary() : reload(e.shiftKey));
ui.copyView.onclick = () => void copyView();
ui.edMode.onclick = (e) => {
  const m = (e.target as HTMLElement).dataset.m;
  if (m === "view" || m === "hands") setEdMode(m);
};
ui.undo.onclick = () => step(true);
ui.redo.onclick = () => step(false);
ui.save.onclick = () => void save();
ui.restHand.onclick = () => goRest();
ui.discard.onclick = () => {
  if (!work || !isDirty() || !confirm("Bỏ mọi thay đổi chưa lưu? (hoàn tác được)")) return;
  if (apply(JSON.parse(work.saved), { key: null })) say("đã bỏ thay đổi");
};
ui.more.onclick = () => ui.header.classList.toggle("open");
ui.cfLoad.onclick = () => void takeDisk();
ui.cfKeep.onclick = () => (ui.conflict.hidden = true);
ui.cfCopy.onclick = async () => {
  if (!work) return;
  const cast = ((work.raw.cast as Json[]) ?? []).map((c) => ({
    id: c.id,
    hands: (c.world as Json | undefined)?.hands,
    tracks: c.tracks,
  }));
  await navigator.clipboard?.writeText(JSON.stringify({ cast, items: work.raw.items }, null, 2));
  ui.cfCopy.textContent = "Đã chép";
};
addEventListener("beforeunload", (e) => {
  if (isDirty()) e.preventDefault();
});
ui.cam.onclick = (e) => {
  const m = (e.target as HTMLElement).dataset.mode;
  if (m === "scene" || m === "free") setMode(m);
};
ui.aa.onchange = resize;
ui.wheel.value = fc.wheel;
ui.wheel.onchange = () => {
  fc.wheel = ui.wheel.value as WheelMode;
  localStorage.setItem("studio3d.wheel", fc.wheel);
};
ui.play.onclick = togglePlay;
ui.time.addEventListener("input", () => {
  playing = false;
  ui.play.textContent = "▶";
  seek(Number(ui.time.value));
});
// nhấp (không kéo) lên bàn tay hay món đang cầm: chọn bàn tay ấy
let down: { x: number; y: number } | null = null;
ui.frame.addEventListener("pointerdown", (e) => {
  down = e.button === 0 && !e.shiftKey && !e.ctrlKey ? { x: e.clientX, y: e.clientY } : null;
});
ui.frame.addEventListener("pointerup", (e) => {
  if (
    LIB ||
    !down ||
    !cur ||
    editor?.shown ||
    Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4
  )
    return;
  down = null;
  const r = cur.stage.canvas.getBoundingClientRect();
  const p = new THREE.Vector2(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    -((e.clientY - r.top) / r.height) * 2 + 1,
  );
  const hit = pickHand(rows, cur.w.root, mode === "free" ? free : cur.stage.camera, p, {
    w: r.width,
    h: r.height,
  });
  if (hit) select(hit, true);
});
ui.editGrasp.onclick = openEditor;
ui.editShape.onclick = openShapeEditor;
ui.solo.onchange = toggleSolo;
ui.baseMirror.onchange = () => {
  const r = selRow();
  if (!work || !r) return;
  const on = ui.baseMirror.checked;
  try {
    if (apply(setBaseMirror(work.raw, r.id, on)))
      say(`${r.id}: ${on ? "soi gương tư thế nền" : "bỏ soi gương tư thế nền"}`);
  } catch (e) {
    say((e as Error).message, true);
  }
  panel();
};
const sideKey = () => (narrow.matches ? "studio3d.sideNarrow" : "studio3d.side");
const syncSide = () => ui.side.classList.toggle("shut", localStorage.getItem(sideKey()) === "shut");
ui.sideToggle.onclick = () => {
  ui.side.classList.toggle("shut");
  localStorage.setItem(sideKey(), ui.side.classList.contains("shut") ? "shut" : "");
};
syncSide();
narrow.addEventListener("change", () => {
  syncSide();
  if (!narrow.matches) setScenesOpen(false);
});
ui.angles.replaceChildren(
  ...(Object.entries(ANGLES) as [Angle, string][]).map(([a, label]) => {
    const b = document.createElement("button");
    b.dataset.angle = a;
    b.textContent = label;
    b.onclick = () => view(a);
    return b;
  }),
);
ui.frame.addEventListener("dblclick", (e) => {
  // camera tự do: nhấp đúp đặt tâm xoay vào chỗ nhấp (khung soạn có nhấp đúp riêng)
  if (mode !== "free" || !cur || !orbit || editor?.shown) return;
  const r = cur.stage.canvas.getBoundingClientRect();
  const p = new THREE.Vector2(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    -((e.clientY - r.top) / r.height) * 2 + 1,
  );
  const ray = new THREE.Raycaster();
  ray.setFromCamera(p, free);
  const hit = ray.intersectObject(cur.w.root, true).find((h) => shown(h.object));
  if (hit) {
    orbit.target.copy(hit.point);
    dirty = true;
  }
});
addEventListener("keydown", (e) => {
  // khung soạn đang hiện: phím của nó (`GraspEditor.onKey`), cảnh và camera ngầm không đổi; hộp thoại mở: phím của hộp
  if (
    (e.target instanceof HTMLInputElement && e.target.type === "text") ||
    editor?.shown ||
    document.querySelector("dialog[open]")
  )
    return;
  const typing =
    (e.target instanceof HTMLInputElement && !["range", "checkbox"].includes(e.target.type)) ||
    e.target instanceof HTMLSelectElement ||
    e.target instanceof HTMLTextAreaElement;
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (mod && k === "s") {
    e.preventDefault();
    if (!LIB) void save();
    return;
  }
  if (typing) return;
  if (LIB && libKey(e)) return;
  if (mod && (k === "z" || k === "y")) {
    e.preventDefault();
    if (editor) say("khung soạn kiểu cầm đang mở: hoàn tác ở khung soạn");
    else step(k === "z" && !e.shiftKey);
    return;
  }
  if ((e.key === "Delete" || e.key === "Backspace") && picked && edMode === "hands") {
    e.preventDefault();
    deletePicked();
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    const step = (e.shiftKey ? 10 : 1) / FPS;
    seek(t + (e.key === "ArrowLeft" ? -step : step));
  } else if (e.key === "c" || e.key === "C") setMode(mode === "scene" ? "free" : "scene");
  else if ((e.key === "h" || e.key === "H") && !mod) {
    ui.solo.checked = !ui.solo.checked;
    toggleSolo();
  } else if ((e.key === "r" || e.key === "R") && !mod && cur) reload(e.shiftKey);
  else if (e.key === "Escape" && clipSel) clipHost.close();
  else if (e.key === "Escape" && modeCard.sel) modeCard.close();
  else if (e.key === "Escape" && picked) cardHost.close();
  else if (e.key === "Escape" && sel) select(undefined, false);
});
new ResizeObserver(resize).observe(ui.view);

async function start() {
  if (GEN) return startGen();
  if (LIB) return startLibrary();
  const j = await (await fetch("/api/scenes")).json();
  ui.scenes.replaceChildren(
    ...j.names.map((n: string) => Object.assign(document.createElement("option"), { value: n })),
  );
  sceneList.set(j.names);
  repoRoot = j.root;
  if (!j.world) say(`${j.root}: package.json không khai stickman.world — mọi cảnh đi plainRoom()`);
  const v = readView(params());
  mode = v.cam;
  if (v.ed) edMode = v.ed;
  if (v.scene) {
    t = v.t;
    if ((await load(v.scene, { keepTime: true })) && cur) restoreView(v);
  } else say(`${j.names.length} cảnh ở ${j.root}. Gõ tên cảnh ở trên để mở.`);
  requestAnimationFrame(loop);
}

/** Bàn tay, Chỉ người này và camera tự do của view trong URL (`readView`), sau khi cảnh đã nạp */
function restoreView(v: ViewState) {
  if (mode === "free") setMode("free");
  if (v.hand && cur?.scene.cast.some((m) => m.id === v.hand!.id)) {
    selectSide(v.hand.id, v.hand.side);
    syncEdit();
  }
  ui.solo.checked = !!v.solo;
  applySolo();
  if (v.free && orbit) {
    free.position.fromArray(v.free.pos);
    free.fov = v.free.fov;
    free.updateProjectionMatrix();
    orbit.target.fromArray(v.free.at);
    orbit.update();
  }
  dirty = true;
  remember();
}

/** Khung vẽ đúng như trên màn hình (three, lớp phủ bàn tay, vệt), PNG data URL; gọi ngay sau `draw()` */
function snapshot(): string {
  const src = cur!.stage.canvas;
  const layer = trails.layer;
  if (!layer) return src.toDataURL("image/png");
  const c = document.createElement("canvas");
  [c.width, c.height] = [src.width, src.height];
  const g = c.getContext("2d")!;
  g.drawImage(src, 0, 0);
  g.drawImage(layer, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}

/** Dòng chữ của HTML số đo bàn tay (`measureHtml`): mỗi khối một dòng, bảng ngón mỗi hàng một dòng */
function htmlLines(html: string): string[] {
  const d = document.createElement("div");
  d.innerHTML = html;
  const text = (e: Element) => (e.textContent ?? "").replace(/\s+/g, " ").trim();
  return [...d.children]
    .flatMap((e) =>
      e.tagName === "TABLE"
        ? [...e.querySelectorAll("tr")].map((tr) => [...tr.children].map(text).join(" · "))
        : [text(e)],
    )
    .filter(Boolean);
}

/**
 * **Chép view**: dừng phát, vẽ lại và đo ở giây đang xem, lưu ảnh khung vẽ vào `tmp/studio3d/` của repo (`/api/snap`),
 * chép đoạn chữ cho agent (`viewNote`) vào clipboard. `clipboard.write` gọi ngay trong lượt bấm, chữ đến sau: Safari
 * bỏ lượt bấm sau `await`. Không có clipboard (http ngoài `localhost`) thì hiện hộp chép tay
 */
async function copyView() {
  if (!cur) return say("chưa mở cảnh");
  const job = viewJob();
  let copied = false;
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": job.then((j) => new Blob([j.note], { type: "text/plain" })),
      }),
    ]);
    copied = true;
  } catch {
    // trình duyệt không có `ClipboardItem` nhận promise
  }
  let j: Awaited<typeof job>;
  try {
    j = await job;
  } catch (e) {
    return say((e as Error).message, true);
  }
  if (!copied)
    copied = await navigator.clipboard?.writeText(j.note).then(
      () => true,
      () => false,
    );
  if (!copied) return showNote(j.note);
  say(
    `đã chép view${j.file ? ` · ảnh ở ${j.file}` : ""}${j.pngError ? ` · ảnh không lưu được: ${j.pngError}` : ""}`,
  );
}

/** Vẽ lại ở giây đang xem, lưu ảnh, dựng đoạn chữ của **Chép view** */
async function viewJob() {
  if (playing) togglePlay();
  // camera đang bay tới cận tay: chụp ở chỗ đến
  if (fly) flyStep(fly.at + FLY * 1000);
  try {
    draw();
  } catch (e) {
    throw new Error(`vẽ hỏng ở ${t.toFixed(2)} s: ${(e as Error).message}`);
  }
  dirty = false;
  const png = snapshot();
  remember();
  const c = cur!;
  const view = viewState();
  let file: string | undefined;
  let pngError: string | undefined;
  try {
    const res = await fetch(`/api/snap?name=${encodeURIComponent(c.name)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ png: png.slice(png.indexOf(",") + 1), t }),
    });
    const j = await res.json();
    if (j.error) pngError = j.error;
    else file = j.file;
  } catch (e) {
    pngError = (e as Error).message;
  }
  const r = selRow();
  const hits = (h: HandRow) =>
    h.hits?.length
      ? ` — ${h.hits.map((x) => `${x.error ? "!!" : "!"}${x.rule} ${x.worst.toFixed(1)}`).join(", ")}`
      : "";
  const note = viewNote({
    root: repoRoot,
    scene: c.name,
    from: c.from,
    t,
    dur: c.dur,
    marks: (c.scene as { marks?: Record<string, number> }).marks ?? {},
    url: location.href,
    png: file,
    pngError,
    view,
    stage: c.rt.frame,
    ...(mode === "free"
      ? {
          freeLens: lensOf(
            free.position.toArray(),
            new THREE.Vector3(0, 0, -1).applyQuaternion(free.quaternion).toArray(),
            free.fov,
            c.rt.frame,
            free.aspect,
          ),
        }
      : {
          shot: {
            lens: c.stage.lens,
            lensFrom: c.stage.lens === c.scene.lens ? "scene" : "world",
            crop: c.stage.crop,
          },
        }),
    ...(r && {
      hand: {
        label: `${r.id} · tay ${sideName(r.side)} · ${heldLabel(r)}`,
        source: (() => {
          const src = sourceOf(r);
          return src ? sourceLines(src) : [];
        })(),
        measure: rowsT === t ? htmlLines(measureHtml(r, c.held)) : [],
      },
    }),
    hands: rows
      .filter((h) => h.hold || h.carry)
      .map((h) => `${h.id} tay ${sideName(h.side)}: ${heldLabel(h)}${hits(h)}`),
    ...(edMode === "hands" &&
      picked &&
      work && { picked: `${JSON.stringify(picked)} ở ${keyTime(work.raw, picked).toFixed(2)} s` }),
    ...(editor?.shown && {
      editor: editor instanceof GraspEditor ? "khung soạn kiểu cầm" : "khung chỉnh dáng tay",
    }),
    dirty: isDirty(),
  });
  return { note, file, pngError };
}

/**
 * Clipboard không dùng được (trang không ở `localhost` / https): hiện đoạn chữ, nút **Chép** dùng `execCommand` (chạy cả
 * trên http). Ô chữ không `readonly`: Safari iOS không chọn được chữ trong ô `readonly`
 */
function showNote(note: string) {
  const d = document.createElement("dialog");
  d.className = "named note";
  d.innerHTML = `<form method="dialog"><b>Chép đoạn này cho agent</b><textarea rows="16" inputmode="none" spellcheck="false"></textarea><div class="row"><span class="dim"></span><button type="button" value="copy">Chép</button><button value="ok">Đóng</button></div></form>`;
  const ta = d.querySelector("textarea")!;
  const said = d.querySelector(".dim")!;
  ta.value = note;
  d.querySelector<HTMLButtonElement>('[value="copy"]')!.onclick = () => {
    ta.value = note;
    ta.focus();
    ta.setSelectionRange(0, note.length);
    const ok = document.execCommand("copy");
    ta.blur();
    ta.scrollTop = 0;
    said.textContent = ok ? "đã chép" : "không chép được: chọn hết chữ rồi chép tay";
  };
  d.onclose = () => d.remove();
  document.body.append(d);
  d.showModal();
}

// --- thư viện: xem thử một hành động trên một người, cảnh dựng trong bộ nhớ (`previewScene`) ---

interface LibraryJson extends Scene3Json {
  root: string;
  actions: (LibraryEntry & { raw: unknown })[];
  characters: LibraryEntry[];
}

let lib: {
  data: Data;
  actions: Record<string, ActionData>;
  layers: Record<string, LibraryEntry["layer"]>;
  groups: ActionGroup[];
  /** Hành động chỉ nhép miệng (`isMouthOnly`): danh sách ẩn khi `lv.mouth` tắt */
  mouth: Set<string>;
  chars: LibraryEntry[];
  held: Omit<HeldOptions, "frame">;
  warn: string[];
} | null = null;
/** JSON cảnh xem thử đang dựng: đổi góc máy chỉ thay bản này, `WorldSpec.lens` đọc lại mỗi khung */
let preview: PreviewScene | null = null;
let libError = "";

const libPanel = new LibraryPanel(ui.libList, ui.libFilter, ui.libCount, ui.libCard, {
  pick: (n) => {
    setScenesOpen(false);
    void openAction(n);
  },
  who: (file) => {
    lv.who = file.replace(/\.json$/, "") || undefined;
    if (GEN) runGen(0);
    else void loadPreview(true);
  },
  angle: setAngle,
  mouthOn: () => lv.mouth,
  mouth: (on) => {
    lv.mouth = on;
    syncLibrary();
  },
});

/** Đọc thư viện hai lớp; hành động parse bằng mã nguồn rig của trang (bản `worldData` có thể cắt mất `preview`) */
async function fetchLibrary() {
  const j: LibraryJson = await (await fetch("/api/library")).json();
  if (j.error) throw new Error(j.error);
  const warn: string[] = [];
  const actions: Record<string, ActionData> = {};
  const layers: Record<string, LibraryEntry["layer"]> = {};
  for (const e of j.actions) {
    const r = rig.parseAction(e.raw);
    if (r.success) actions[e.name] = r.data;
    else warn.push(`actions/${e.name}.json: ${r.error.message.slice(0, 200)}`);
    layers[e.name] = e.layer;
  }
  const people = Object.keys(actions);
  lib = {
    data: { ...j.data, actions, held: heldOf(j, warn), hands: handsLib(j, warn) },
    actions,
    layers,
    groups: groupActions(people),
    mouth: new Set(people.filter((n) => isMouthOnly(actions[n]))),
    chars: orderCharacters(j.characters.filter((c) => j.data.characters[c.name])),
    held: (j.heldOpts && !j.heldOpts.off && !j.heldOpts.error ? j.heldOpts : {}) as Omit<
      HeldOptions,
      "frame"
    >,
    warn,
  };
  repoRoot = j.root;
  libPanel.set(lib.groups, layers, lib.mouth);
  // hành động, người trong URL không còn thì về `stand-3d` và người đầu danh sách; khẩu hình đang ẩn vẫn mở được
  const names = lib.groups.flatMap((g) => g.names);
  if (!lv.action || !names.includes(lv.action))
    lv.action = names.includes("stand-3d") ? "stand-3d" : names[0];
  if (!lv.who || !lib.chars.some((c) => c.name === `${lv.who}.json`))
    lv.who = lib.chars[0]?.name.replace(/\.json$/, "");
}

const whoFile = () => (lv.who ? `${lv.who}.json` : undefined);

/** Cảnh xem thử của `name` trên `lv.who`; người thứ hai (`preview.partner`) là người đầu danh sách khác người diễn */
function previewOf(name: string, angle: (typeof lv)["angle"]): PreviewScene {
  const file = whoFile();
  const c = file ? lib!.data.characters[file] : undefined;
  const partner = lib!.chars.find((e) => e.name !== file)?.name;
  return previewScene(name, lib!.actions[name], c && file, {
    angle,
    height: c?.rig.height ?? 1,
    has: (n) => n in lib!.actions,
    partner,
    partnerHeight: partner ? lib!.data.characters[partner]?.rig.height : undefined,
  });
}

/** Dựng cảnh xem thử của `lv.action` trên `lv.who`; `false` khi hỏng hay đã có lần dựng sau */
async function loadPreview(keepTime = false): Promise<boolean> {
  if (!lib || !lv.action) return false;
  const my = ++loading;
  playing = false;
  ui.play.textContent = "▶";
  const name = lv.action;
  const file = whoFile();
  const c = file ? lib.data.characters[file] : undefined;
  try {
    const json = previewOf(name, lv.angle);
    const parsed = rig.parseScene(json);
    if (!parsed.success) throw new Error(`scene JSON sai: ${parsed.error.message}`);
    const scene = parsed.data;
    const { runtime, heights, bodies } = runtimeOf(scene, lib.data);
    const ctx = { characters: lib.data.characters, heights, bodies };
    // `still: []`: người ngồi (`world.sit`) vẫn diễn, không đóng băng thành người nền
    const w = rig.buildWorld(
      scene,
      runtime,
      {
        set: () =>
          previewSet(previewStage(name, lib!.actions[name]), {
            height: c?.rig.height ?? 1,
          }),
        still: [],
        extra: previewExtra(json, lib.data.held as Record<string, HeldItemSpec>),
        lens: (tt) => (preview ? previewLens(preview, tt) : undefined),
      },
      ctx,
    );
    await w.ready;
    if (my !== loading) return false;
    const gpu = mountPreview(json, scene, runtime, w, lib.data, keepTime);
    libError = "";
    ui.status.textContent = `plainRoom · ${lv.who ?? "người mặc định"} · ${previewStage(name, lib.actions[name])}${gpu}`;
    say(lib.warn.join("\n"));
    dirty = true;
    return true;
  } catch (e) {
    if (my !== loading) return false;
    libError = `${name}: ${(e as Error).message ?? e}`;
    say(libError, true);
    return false;
  } finally {
    if (my === loading) syncLibrary();
  }
}

/** Đặt cảnh xem thử đã dựng (`w` của `json`) lên khung vẽ: `cur`, thanh tua, camera; trả ghi chú vẽ phần mềm */
function mountPreview(
  json: PreviewScene,
  scene: SceneData,
  runtime: SceneRuntime,
  w: World3D,
  data: Data,
  keepTime: boolean,
) {
  const box = { posed: {} as Record<string, Figure> };
  const stage = stageFor(w, scene, (p) => (box.posed = p ?? {}));
  dispose();
  ui.frame.append(stage.canvas);
  preview = json;
  cur = {
    name: scene.name,
    scene,
    dur: runtime.duration,
    stage,
    w,
    from: "plain",
    rt: runtime,
    src: json as unknown as Json,
    held: lib!.held,
    data,
    key: "",
    heldOut: null,
    get posed() {
      return box.posed;
    },
  };
  rowsT = NaN;
  t = keepTime ? Math.min(t, cur.dur) : 0;
  ui.time.max = String(cur.dur);
  ui.time.step = String(1 / FPS);
  ui.marks.replaceChildren();
  attachOrbit();
  if (mode === "free" && !keepTime) seedFree();
  return /SwiftShader/.test(stage.gpu) ? " · ⚠ vẽ phần mềm" : "";
}

/** Danh sách, thẻ, tiêu đề, URL theo `lv` */
function syncLibrary() {
  if (GEN) return syncGen();
  if (!lib) return;
  const name = lv.action ?? "";
  const a = lib.actions[name];
  libPanel.mark(name);
  ui.libTitle.textContent = name;
  ui.libTitle.title = name;
  document.title = `${name} — Thư viện — Studio 3D`;
  const tracks = preview?.cast[0].tracks ?? [];
  const base = tracks
    .filter((tr) => tr.name === "base")
    .flatMap((tr) => tr.clips.map((c) => c.action))
    .join(" → ");
  libPanel.renderCard({
    info: a
      ? {
          name,
          layer: lib.layers[name],
          stage: previewStage(name, a),
          ...(base && { base }),
          ...(a.preview?.hold && { hold: holdText(a.preview.hold) }),
          ...(a.preview?.partner && { partner: partnerText(a.preview.partner) }),
          duration: a.duration,
          end: a.end,
          ...(a.mask && { mask: a.mask }),
          channels: rig.actionMask(a),
          ...(a.note && { note: a.note }),
          ...(a.authoredAt && { authoredAt: a.authoredAt }),
          ...(a.gen && { gen: a.gen }),
          variants: libPanel.siblings(name),
          sceneDuration: preview?.duration ?? a.duration,
        }
      : null,
    who: lib.chars,
    whoOn: whoFile(),
    angle: lv.angle,
    ...(libError && { error: libError }),
  });
  for (const b of ui.speed.querySelectorAll<HTMLButtonElement>("button"))
    b.classList.toggle("on", Number(b.dataset.s) === lv.speed);
  ui.loop.classList.toggle("on", lv.loop);
  remember();
}

const holdText = (h: NonNullable<NonNullable<ActionData["preview"]>["hold"]>) =>
  (["right", "left"] as const)
    .filter((s) => h[s])
    .map((s) => {
      const g = rig.groupHold(h[s]!);
      return `${s === "right" ? "phải" : "trái"} ${g.item}@${g.group}${g.variant ? `/${g.variant}` : ""}${g.both ? " (hai tay)" : ""}`;
    })
    .join(" · ");

function partnerText(p: NonNullable<NonNullable<ActionData["preview"]>["partner"]>) {
  const [ahead, right] = p.at ?? PARTNER_AT;
  const b = preview?.cast.find((c) => c.id === PREVIEW_PARTNER);
  return [
    b?.character?.replace(/\.json$/, "") ?? "người mặc định",
    `trước ${ahead}, phải ${right}${p.yaw ? `, quay ${p.yaw}°` : ""}`,
    p.action ?? "stand-3d",
    ...(p.hold ? [`cầm ${holdText(p.hold)}`] : []),
    ...(b?.fade ? ["ẩn ở góc này (che người diễn)"] : []),
  ].join(" · ");
}

async function openAction(name: string) {
  if (!lib?.actions[name] || name === lv.action) return;
  lv.action = name;
  await loadPreview();
}

function setAngle(a: (typeof lv)["angle"]) {
  lv.angle = a;
  // người thứ hai ẩn khi che người diễn (`cast[].fade`) suy từ ống kính của cảnh: dựng lại; trang soi gửi góc máy cho bộ sinh
  if (GEN) runGen(0);
  else if (preview && lib && lv.action) void loadPreview(true);
  // camera tự do: góc máy mới là chỗ đứng mới của nó
  if (mode === "free") setMode("scene");
  dirty = true;
  syncLibrary();
}

async function reloadLibrary() {
  try {
    say("Đang nạp lại thư viện…");
    await fetchLibrary();
    if (GEN) {
      say("");
      return runGen(0);
    }
    await loadPreview(true);
  } catch (e) {
    say(`${(e as Error).stack ?? e}`, true);
  }
}

/** Phím riêng của Thư viện; `true` là đã dùng phím */
function libKey(e: KeyboardEvent): boolean {
  if (GEN) return genKey(e);
  if (e.ctrlKey || e.metaKey || e.altKey || !lib || !lv.action) return false;
  const k = e.key.toLowerCase();
  const go = (n: string | undefined) => {
    e.preventDefault();
    if (n) void openAction(n);
    return true;
  };
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    const shown = libPanel.shown();
    return go(
      stepIn(shown.length ? shown : [lv.action], lv.action, e.key === "ArrowDown" ? 1 : -1),
    );
  }
  if (k === "v") return go(stepIn(libPanel.siblings(lv.action), lv.action, e.shiftKey ? -1 : 1));
  const n = Number(e.key);
  if (n >= 1 && n <= PREVIEW_ANGLES.length) {
    setAngle(PREVIEW_ANGLES[n - 1]);
    return true;
  }
  if (k === "l") {
    lv.loop = !lv.loop;
    syncLibrary();
    return true;
  }
  if (k === "r") {
    void reloadLibrary();
    return true;
  }
  // bàn tay, chỉ người này, xoá mốc: của chế độ Cảnh
  return k === "h" || e.key === "Delete" || e.key === "Backspace";
}

ui.appMode.onclick = (e) => {
  const a = (e.target as HTMLElement).closest("button")?.dataset.a as keyof typeof APP_URL;
  if (!a || !(a in APP_URL) || a === APP) return;
  const [key, empty] = APP_URL[a];
  location.search = localStorage.getItem(key) ?? empty;
};
for (const b of ui.appMode.querySelectorAll<HTMLButtonElement>("button"))
  b.classList.toggle("on", b.dataset.a === APP);
ui.speed.onclick = (e) => {
  const s = Number((e.target as HTMLElement).dataset.s);
  if (!(SPEEDS as readonly number[]).includes(s)) return;
  lv.speed = s;
  syncLibrary();
};
ui.loop.onclick = () => {
  lv.loop = !lv.loop;
  syncLibrary();
};
if (GEN) {
  ui.sceneTitle.textContent = "Tham số";
  ui.sideTitle.textContent = "Tự kiểm";
  ui.sceneOpen.title = "Tham số của bộ sinh";
} else if (LIB) {
  ui.sceneTitle.textContent = "Thư viện";
  ui.sideTitle.textContent = "Hành động";
  ui.sceneOpen.title = "Danh sách hành động";
}

async function startLibrary() {
  const v = readView(params());
  mode = v.cam;
  t = v.t;
  try {
    await fetchLibrary();
  } catch (e) {
    say(`${(e as Error).stack ?? e}`, true);
    return;
  }
  if ((await loadPreview(true)) && cur) restoreView(v);
  requestAnimationFrame(loop);
}

// --- bộ sinh: tham số, sân khấu thử (`GEN_PAGES[kiểu].stage`), chạy khô trên server (`/api/gen`), tự kiểm ---

/** Ngừng gõ ngần này (ms) thì chạy lại bộ sinh */
const GEN_DEBOUNCE = 450;
let genRes: GenResult = {};
const genQueue = new GenQueue((stale) => genOnce(stale), {
  set: (f, ms) => window.setTimeout(f, ms),
  clear: (id) => clearTimeout(id),
});
const genPage = () => GEN_PAGES[gv.kind];

const genPanel = new GenPanel(ui.genForm, ui.genCard, {
  kind: (k) => {
    if (k === gv.kind) return;
    gv.kind = k;
    gv.values = {};
    genRes = {};
    runGen(0);
    syncGen(true);
  },
  set: (key, v) => {
    gv.values = setValue(genPage().params, gv.values, key, v);
    runGen(GEN_DEBOUNCE);
    syncGen();
  },
  reset: () => {
    gv.values = {};
    runGen(0);
    syncGen(true);
  },
  seek: (tt) => {
    if (playing) togglePlay();
    seek(tt);
  },
  close: genCloseUp,
});

/** Form, thẻ người và góc máy, thẻ kết quả, tiêu đề, URL theo `gv` và `lv` */
function syncGen(force = false) {
  if (!lib) return;
  const page = genPage();
  const file = whoFile();
  genPanel.who = {
    name: file,
    character: file ? lib.data.characters[file] : undefined,
    actions: lib.data.actions,
  };
  genPanel.renderForm(GEN_PAGES, gv, force);
  libPanel.renderCard({ info: null, who: lib.chars, whoOn: whoFile(), angle: lv.angle });
  genPanel.renderCard(genRes, page, gv.kind, genClose && mode === "free");
  ui.libTitle.textContent = `${page.label} · gen ${gv.kind}`;
  ui.libTitle.title = `stickman gen ${gv.kind}`;
  document.title = `gen ${gv.kind} — Bộ sinh — Studio 3D`;
  for (const b of ui.speed.querySelectorAll<HTMLButtonElement>("button"))
    b.classList.toggle("on", Number(b.dataset.s) === lv.speed);
  ui.loop.classList.toggle("on", lv.loop);
  remember();
}

/** Đầu vào của trang đổi: kết quả đang hiện thành cũ, chạy lại sau `delay` ms */
function runGen(delay: number) {
  genRes = { ...genRes, busy: true };
  genQueue.changed(delay);
}

/**
 * Dựng sân khấu thử ngay, rồi gửi `/api/gen` và phát hành động sinh ra trên chính sân khấu ấy; `stale()` đúng là đầu vào đã
 * đổi: lượt bỏ kết quả của nó
 */
async function genOnce(stale: () => boolean) {
  if (!lib) return;
  const page = genPage();
  const kind = gv.kind;
  const p = genParams(gv.values, lv.angle);
  const file = whoFile();
  const character = file ? lib.data.characters[file] : undefined;
  const problems = paramProblems(page.params, p);
  if (problems.length) {
    genRes = { error: "Tham số sai", errorLines: problems };
    return syncGen();
  }
  let st: GenStage;
  try {
    st = page.stage(p, { name: file, character, actions: lib.data.actions });
    await showGen(st, st.scene, {}, stale);
  } catch (e) {
    if (stale()) return;
    genRes = { error: `sân khấu thử: ${(e as Error).message ?? e}` };
    return syncGen();
  }
  if (stale()) return;
  genRes = { ...genRes, busy: true, error: undefined };
  genPanel.unpick();
  syncGen();
  const t0 = performance.now();
  try {
    const r = await fetch("/api/gen", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, params: p, who: file }),
    });
    const j = await r.json();
    if (stale()) return;
    if (!r.ok) {
      genRes = { error: j.error ?? `HTTP ${r.status}`, errorLines: j.lines };
      return syncGen();
    }
    // `walk` ghi cảnh, không sinh hành động
    const a = j.action ? rig.parseAction(j.action) : undefined;
    if (a && !a.success) throw new Error(`hành động sinh ra không qua schema: ${a.error.message}`);
    const shown = await showGen(st, j.scene, a ? { [j.name]: a.data } : {}, stale);
    if (stale()) return;
    const trace =
      kind === "walk" && shown
        ? rig.gaitTrace(
            shown.runtime,
            PREVIEW_ACTOR,
            shown.heights[PREVIEW_ACTOR],
            shown.bodies[PREVIEW_ACTOR],
          )
        : undefined;
    genRes = {
      ...(trace && {
        chart: walkChart(trace, (tt) => {
          if (playing) togglePlay();
          seek(tt);
        }),
      }),
      ok: j.ok,
      name: j.name,
      checks: j.checks,
      lines: j.lines,
      ms: performance.now() - t0,
    };
  } catch (e) {
    if (stale()) return;
    genRes = { error: `${(e as Error).message ?? e}` };
  }
  syncGen();
}

/**
 * Dựng cảnh `json` của sân khấu `st` như Thư viện: `parseScene` → `resolveScene` → `buildWorld` với `propWorld(props)` làm
 * `WorldSpec`, món thử (`st.held`) qua `previewExtra`; `actions` là hành động sinh ra. `stale()` đúng lúc dựng xong thì không đặt
 */
async function showGen(
  st: GenStage,
  json: unknown,
  actions: Record<string, ActionData>,
  stale: () => boolean,
) {
  if (!lib) return;
  const my = ++loading;
  const parsed = rig.parseScene(json);
  if (!parsed.success) throw new Error(`cảnh thử sai: ${parsed.error.message}`);
  const scene = parsed.data;
  const held = { ...lib.data.held, ...st.held } as Record<string, HeldItemSpec>;
  const data: Data = { ...lib.data, actions: { ...lib.data.actions, ...actions }, held };
  const { runtime, heights, bodies } = runtimeOf(scene, data);
  const w = rig.buildWorld(
    scene,
    runtime,
    {
      ...rig.propWorld(st.props, { h: st.h }),
      still: [],
      extra: previewExtra(json as PreviewScene, held),
      lens: (tt) => previewLens(st.scene, tt),
    },
    { characters: data.characters, heights, bodies },
  );
  await w.ready;
  if (my !== loading || stale()) return;
  const gpu = mountPreview(st.scene, scene, runtime, w, data, true);
  genStage = st;
  ui.status.textContent = `sân khấu thử · ${lv.who ?? "người mặc định"} · ${st.props.map((x) => x.name).join(", ") || "không đồ"}${gpu}`;
  dirty = true;
  return { runtime, heights, bodies };
}

/**
 * Nút **Cận**: camera tự do bay tới khung quanh vùng tương tác ở giây đang xem — hai cổ tay, hông, món đang cầm, chỗ chén —
 * nhìn theo hướng của góc máy đang chọn; bấm lại về camera cảnh
 */
function genCloseUp() {
  if (!cur || !orbit) return;
  if (genClose && mode === "free") {
    setMode("scene");
    return syncGen();
  }
  const fig = cur.posed[PREVIEW_ACTOR];
  if (!fig) return;
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  for (const s of [-1, 1] as const) {
    box.expandByPoint(fig.arms[s].wrist.getWorldPosition(p));
    const held = fig.holding?.[s]?.object;
    if (held) box.expandByObject(held);
  }
  box.expandByPoint(fig.hips.getWorldPosition(p));
  if (genStage?.cup) box.expandByPoint(rig.toThree(genStage.cup));
  const ball = box.getBoundingSphere(new THREE.Sphere());
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cur.stage.camera.quaternion);
  if (mode !== "free") setMode("free");
  const r = Math.max(ball.radius, 0.4);
  const dist = (r / Math.sin(((free.fov / 2) * Math.PI) / 180)) * 1.1;
  fly = {
    p0: free.position.clone(),
    t0: orbit.target.clone(),
    p1: ball.center.clone().addScaledVector(dir, -dist),
    t1: ball.center.clone(),
    at: performance.now(),
  };
  genClose = true;
  dirty = true;
  syncGen();
}

/** Phím riêng của trang soi; `true` là đã dùng phím */
function genKey(e: KeyboardEvent): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey || !lib) return false;
  const k = e.key.toLowerCase();
  const n = Number(e.key);
  if (n >= 1 && n <= PREVIEW_ANGLES.length) {
    setAngle(PREVIEW_ANGLES[n - 1]);
    return true;
  }
  if (k === "l") {
    lv.loop = !lv.loop;
    syncGen();
    return true;
  }
  if (k === "r") {
    void reloadLibrary();
    return true;
  }
  return k === "h" || k === "v" || e.key === "Delete" || e.key === "Backspace";
}

async function startGen() {
  const v = readView(params());
  mode = v.cam;
  t = v.t;
  try {
    await fetchLibrary();
  } catch (e) {
    say(`${(e as Error).stack ?? e}`, true);
    return;
  }
  syncGen(true);
  requestAnimationFrame(loop);
  await genQueue.go();
  if (cur) restoreView(v);
}

start();

// soi từ devtools (và công cụ chụp thử): trạng thái trang, không phải API
Object.assign(window, {
  studio3d: {
    get cur() {
      return cur;
    },
    get t() {
      return t;
    },
    get mode() {
      return mode;
    },
    free,
    get orbit() {
      return orbit;
    },
    get editor() {
      return editor;
    },
    get work() {
      return work;
    },
    get picked() {
      return picked;
    },
    get clipSel() {
      return clipSel;
    },
    openClip(k: ClipRef) {
      clipSel = k;
      picked = null;
      syncEdit();
    },
    clipHost,
    restage,
    apply,
    seek,
    setEdMode,
    selectHand(id: string, side: HandSide) {
      selectSide(id, side);
      syncEdit();
    },
    addKey,
    drawn: (id: string, side: HandSide, at: number) =>
      cur && drawnHand(cur.rt, id, side, at, charOf(id)),
    drawnItem: (id: string, side: HandSide, item: string, at: number) =>
      cur && drawnItem(cur.rt, id, side, item, at, { char: charOf(id).char }),
    pick(k: KeyRef) {
      picked = k;
      seek(keyTime(work!.raw, k));
      syncEdit();
    },
    step,
    save,
    grab,
    modeCard,
  },
});
