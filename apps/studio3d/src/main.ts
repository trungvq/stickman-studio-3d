// Khung xem cảnh three: dựng như `three-page.mjs` của render (cảnh `worldOf` của repo video, không có thì `plainRoom()`),
// mỗi khung `stage.pose(t, view)` rồi vẽ bằng camera cảnh hay camera tự do (OrbitControls). Chế độ Dáng tay sửa mốc tay,
// mốc món trên bản JSON thô của cảnh (`keys.ts`), một lịch sử chung, lưu qua `/api/scene`.
import * as rig from "@stickman3d/rig";
import type {
  AuthoredGrasp,
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
  keyTime,
  keyValue,
  marksOf,
  moveKey,
  retime,
  setEase,
  setHold,
  timeOf,
  touch,
  type Ease,
  type HoldPick,
  type Json,
  type KeyRef,
} from "./keys";
import { record, travel } from "./history";
import { runAt } from "./mode";
import { ModeCard } from "./modeUi";
import { runHoldKeys, setRunVariant, styleEntries, styleUses, type RunRef } from "./named";
import { renderStyles } from "./namedUi";
import { plusHand, plusItem } from "./plus";
import { runtimeOf, type Data } from "./runtime";
import { KeyTrack, type Band, type Lane } from "./track";
import { Trails } from "./trails";

type WorldOf = (name: string, ctx: WorldCtx) => World3D | null;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  header: document.querySelector("header") as HTMLElement,
  footer: document.querySelector("footer") as HTMLElement,
  scene: $<HTMLInputElement>("scene"),
  scenes: $<HTMLDataListElement>("scenes"),
  reload: $<HTMLButtonElement>("reload"),
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
  measure: $<HTMLDivElement>("measure"),
  editGrasp: $<HTMLButtonElement>("editGrasp"),
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
let dirty = true;
let loading = 0;

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
let edMode: "view" | "hands" = localStorage.getItem("studio3d.mode") === "hands" ? "hands" : "view";
/** Mốc đang mở thẻ */
let picked: KeyRef | null = null;
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
const remember = () => {
  const p = params();
  if (cur) p.set("scene", cur.name);
  p.set("t", t.toFixed(3));
  p.set("cam", mode);
  history.replaceState(null, "", `?${p}`);
};

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
  heldOpts?: Record<string, unknown> & { off?: true; error?: string };
  /** `stickman.snap` của repo (ngưỡng giật của `check`) */
  snapOpts?: { px?: number; k?: number; fps?: number; off?: true; error?: string };
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
        raw: structuredClone(j.raw) as Json,
        saved: JSON.stringify(j.raw),
        hash: j.hash,
        undo: [],
        redo: [],
      };
      picked = null;
      picks.clear();
      ui.conflict.hidden = true;
    }
    const warnings: string[] = [];
    const data = { ...j.data, held: heldOf(j, warnings) };
    const parsed = rig.parseScene(work.raw);
    if (!parsed.success) throw new Error(`scene JSON sai: ${parsed.error.message}`);
    const scene = parsed.data;
    const key = JSON.stringify(data);
    const held = (j.heldOpts && !j.heldOpts.off && !j.heldOpts.error ? j.heldOpts : {}) as Omit<
      HeldOptions,
      "frame"
    >;
    if (!o.full && cur?.name === name && cur.key === key && restage(scene)) {
      cur.held = held;
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
  stage.pose(t, w.view(t));
  const cam = stage.camera;
  free.position.copy(cam.position);
  free.quaternion.copy(cam.quaternion);
  free.fov = cam.fov;
  free.updateProjectionMatrix();
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
  const hit = new THREE.Raycaster(cam.position, dir).intersectObject(w.root, true)[0];
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
  grab.attach(cur.stage.canvas);
}

function setMode(m: "scene" | "free") {
  mode = m;
  for (const b of ui.cam.querySelectorAll("button")) b.classList.toggle("on", b.dataset.mode === m);
  ui.frame.classList.toggle("free", m === "free");
  if (orbit) orbit.enabled = m === "free";
  if (m === "free") seedFree();
  dirty = true;
  remember();
}

function draw() {
  if (!cur) return;
  const { stage, w } = cur;
  const t0 = performance.now();
  const view = w.view(t);
  stage.pose(t, view);
  afterPose();
  const t1 = performance.now();
  const camera = mode === "free" ? free : stage.camera;
  if (mode === "free") w.set.room.cull(free);
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
  if (r && go) view("truoc");
  else dirty = true;
  rowsT = NaN;
  syncEdit();
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

let editor: GraspEditor | null = null;

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

/** Gương trái ↔ phải qua mặt phẳng `x = 0` (thế giới hay khung bàn tay) */
const FLIP = new THREE.Matrix4().makeScale(-1, 1, 1);

/**
 * Bàn tay `r` trong cảnh đổi sang khung soạn: hướng khung bàn tay trong thế giới, khuỷu trong khung bàn tay, hướng ra
 * camera đang xem và ra ba góc cận tay, vật liệu da, đèn và nét vẽ của cảnh ở giây ấy. Khung soạn là tay phải: tay trái
 * soi gương cả thế giới lẫn khung bàn tay (`FLIP · R · FLIP` vẫn là phép quay), như bàn tay phải đứng trước gương
 */
function editScene(r: HandRow): EditScene {
  const { stage, w } = cur!;
  const view = w.view(t);
  stage.pose(t, view);
  const lights = rig.currentLights();
  const arm = r.fig.arms[r.side];
  arm.wrist.updateWorldMatrix(true, false);
  const R = new THREE.Matrix4().extractRotation(arm.wrist.matrixWorld);
  const left = r.side > 0;
  if (left) R.premultiply(FLIP).multiply(FLIP);
  const mirror = (v: THREE.Vector3) => (left ? v.applyMatrix4(FLIP) : v);
  const elbow = mirror(arm.wrist.worldToLocal(arm.elbow.getWorldPosition(new THREE.Vector3())));
  const c = gripWorld(r.fig, r.side);
  const cam = mode === "free" ? free : stage.camera;
  const dir = (a: Angle) => {
    const p = anglePose(r, a, free.fov, w.root);
    return mirror(p.position.sub(p.target).normalize());
  };
  const inked = arm.wrist.children.find((g) => g.userData.hand === r.side);
  const [skin, hull] = (inked?.children ?? []) as THREE.Mesh[];
  const ceiling = lights.rig.ceiling;
  return {
    q: new THREE.Quaternion().setFromRotationMatrix(R),
    elbow,
    views: {
      canh: mirror(cam.position.clone().sub(c).normalize()),
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
  if (k >= 1) fly = null;
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
    t += dt;
    if (t > cur.dur) t = 0;
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
      const what = shape === "null" ? "null — thả đích" : shape === "ring" ? "chỉ `hold`" : "đích";
      return [
        {
          key,
          t: tt,
          shape,
          on: sameKey(picked, key),
          lock: isObj(v) && v.elbowLock === true,
          title: `${at(row.t, tt)} · ${what}${isObj(v) && v.ease ? ` · ${v.ease}` : ""}`,
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
  lanes.push({
    id: "item",
    label: "Món",
    title: `Mốc \`items[]\` của món tay ${SIDE_NAME[on]} cầm`,
    add: `Thêm mốc món của lần cầm tay ${SIDE_NAME[on]} ở giây đang xem (tay theo đồ), chỗ và hướng như đang vẽ`,
    bands: [],
    blends: [],
    keys,
  });
  return lanes;
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
      if (!sel || !b.run || (lane !== "right" && lane !== "left")) return;
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
  if (picked && (!work || keyValue(work.raw, picked) === undefined)) picked = null;
  if (picked?.kind === "hand" && sel && picked.id !== sel.id) picked = null;
  if (!cur || !work || edMode !== "hands") {
    track.render(null, cur?.dur ?? 1);
    renderCard(ui.keyCard, null, cardHost);
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
  modeCard.render();
}

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

/** Món, nhóm, biến thể cho phần `hold` của thẻ */
function variantsOf(item: string, group: string) {
  const held = cur!.data.held as Record<string, HeldItemSpec>;
  const base: readonly string[] =
    (rig.GROUP_VARIANTS as Record<string, readonly string[]>)[group] ?? [];
  const spec = held[item] ?? held[rig.heldBase(item)];
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
    ...(k.kind === "hand" && {
      hold: {
        mode: m?.hold === null ? "null" : m?.hold === undefined ? "none" : "set",
        item: pick?.item ?? run?.item ?? items[0] ?? "",
        group: pick?.group ?? run?.group ?? "sheet",
        variant: pick?.variant ?? "",
      },
      lock: {
        on: lockOn,
        ...(!m && { disabled: "mốc `null` không có khuỷu" }),
        ...(idle && { idle }),
      },
    }),
    items,
    groups: rig.GROUP_IDS,
    variants: variantsOf,
    json: JSON.stringify(json, null, 2),
    notes: added && sameKey(added.key, k) ? added.notes : [],
  };
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
      setHold(o, h);
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
      elbow = d?.elbow?.map((x) => Math.round(x * 1e4) / 1e4);
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
}

/** Lưu mốc tay, mốc món vào `scenes/` kèm hash lúc nạp; file đã đổi trên đĩa thì 409, hiện hộp chọn */
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
      // bản đang sửa bỏ khoá `items` mà bản đã lưu có: `null` để server bỏ khoá ấy trên đĩa
      body: JSON.stringify({
        hash: work.hash,
        scene:
          !("items" in work.raw) && "items" in JSON.parse(work.saved)
            ? { ...work.raw, items: null }
            : work.raw,
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
    record(w, JSON.stringify(w.raw), JSON.stringify(j.raw));
    Object.assign(w, {
      raw: structuredClone(j.raw) as Json,
      hash: j.hash,
      saved: JSON.stringify(j.raw),
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

ui.scene.addEventListener("change", () => {
  const name = ui.scene.value.trim();
  if (!name || name === cur?.name) return;
  if (isDirty() && !confirm(`${work!.name} có thay đổi chưa lưu. Bỏ chúng và mở ${name}?`)) {
    ui.scene.value = cur?.name ?? "";
    return;
  }
  void load(name);
});
ui.reload.onclick = (e) => reload(e.shiftKey);
ui.edMode.onclick = (e) => {
  const m = (e.target as HTMLElement).dataset.m;
  if (m === "view" || m === "hands") setEdMode(m);
};
ui.undo.onclick = () => step(true);
ui.redo.onclick = () => step(false);
ui.save.onclick = () => void save();
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
  if (!down || !cur || editor?.shown || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4)
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
ui.sideToggle.onclick = () => {
  ui.side.classList.toggle("shut");
  localStorage.setItem("studio3d.side", ui.side.classList.contains("shut") ? "shut" : "");
};
if (localStorage.getItem("studio3d.side") === "shut") ui.side.classList.add("shut");
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
  const hit = ray.intersectObject(cur.w.root, true)[0];
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
    void save();
    return;
  }
  if (typing) return;
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
  else if ((e.key === "r" || e.key === "R") && !mod && cur) reload(e.shiftKey);
  else if (e.key === "Escape" && modeCard.sel) modeCard.close();
  else if (e.key === "Escape" && picked) cardHost.close();
  else if (e.key === "Escape" && sel) select(undefined, false);
});
new ResizeObserver(resize).observe(ui.view);

async function start() {
  const j = await (await fetch("/api/scenes")).json();
  ui.scenes.replaceChildren(
    ...j.names.map((n: string) => Object.assign(document.createElement("option"), { value: n })),
  );
  if (!j.world) say(`${j.root}: package.json không khai stickman.world — mọi cảnh đi plainRoom()`);
  const p = params();
  const name = p.get("scene");
  if (p.get("cam") === "free") mode = "free";
  if (name) {
    t = Number(p.get("t") ?? 0) || 0;
    await load(name, { keepTime: true });
    if (mode === "free") setMode("free");
  } else say(`${j.names.length} cảnh ở ${j.root}. Gõ tên cảnh ở trên để mở.`);
  requestAnimationFrame(loop);
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
