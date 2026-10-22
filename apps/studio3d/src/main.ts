// Khung xem cảnh three: dựng như `three-page.mjs` của render (cảnh `worldOf` của repo video, không có thì `plainRoom()`),
// mỗi khung `stage.pose(t, view)` rồi vẽ bằng camera cảnh hay camera tự do (OrbitControls).
import * as rig from "@stickman3d/rig";
import type {
  AuthoredGrasp,
  HeldItemSpec,
  AaMode,
  Body3,
  CharacterData,
  Figure,
  HeldOptions,
  SceneData,
  SceneRuntime,
  Side,
  Stage,
  World3D,
  WorldCtx,
} from "@stickman3d/rig";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import * as world from "virtual:stickman-world";
import { GraspEditor, sceneHigh, type EditScene, type EditTarget } from "./editor";
import { freeCam, type WheelMode } from "./freecam";
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

type Data = {
  characters: Record<string, CharacterData>;
  actions: Record<string, unknown>;
  animals: Record<string, unknown>;
  props: Record<string, unknown>;
  held: Record<string, unknown>;
};
type WorldOf = (name: string, ctx: WorldCtx) => World3D | null;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  scene: $<HTMLInputElement>("scene"),
  scenes: $<HTMLDataListElement>("scenes"),
  reload: $<HTMLButtonElement>("reload"),
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
  editor: $<HTMLElement>("editor"),
};

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
  /** `STUDIO3D_HELD_OUT` của server: bản soạn lưu vào đây thay `held/` */
  heldOut: string | null;
} | null = null;
let t = 0;
let playing = false;
let mode: "scene" | "free" = "scene";
let dirty = true;
let loading = 0;

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

/** `heights`, `bodies` của `cast` — như `threeData` của render */
function castData(scene: SceneData, characters: Record<string, CharacterData>) {
  const heights: Record<string, number> = {};
  const bodies: Record<string, Body3> = {};
  const chars: Record<string, ReturnType<typeof rig.castCharacter>> = {};
  for (const m of scene.cast) {
    const c = m.character ? characters[m.character] : undefined;
    if (!c) continue;
    heights[m.id] = c.rig.height;
    bodies[m.id] = rig.body3(c);
    chars[m.id] = rig.castCharacter(m, c);
  }
  return { heights, bodies, chars };
}

function build(name: string, scene: SceneData, data: Data) {
  const { heights, bodies, chars } = castData(scene, data.characters);
  const runtime = rig.resolveScene(
    scene,
    data.actions as never,
    data.animals as never,
    data.props as never,
    heights,
    bodies,
    data.held as never,
  );
  // mốc món `rest` tra tay người thả ở `rt.chars`, như `loadScene` của render
  runtime.chars = { ...chars, ...runtime.chars };
  const ctx = { id: name, scene, runtime, characters: data.characters, heights, bodies };
  const worldOf = (world as { worldOf?: WorldOf }).worldOf;
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
  data: Data;
  heldRaw?: Record<string, unknown>;
  heldOpts?: Record<string, unknown> & { off?: true; error?: string };
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

async function load(name: string, keepTime = false, reuse = false) {
  const my = ++loading;
  playing = false;
  ui.play.textContent = "▶";
  say(`Đang nạp ${name}…`);
  try {
    const j: Scene3Json =
      reuse && fetched?.name === name
        ? fetched.j
        : await (await fetch(`/api/scene?name=${encodeURIComponent(name)}`)).json();
    if (j.error) throw new Error(j.error);
    fetched = { name, j };
    const warnings: string[] = [];
    const data = { ...j.data, held: heldOf(j, warnings) };
    const parsed = rig.parseScene(j.raw);
    if (!parsed.success) throw new Error(`scene JSON sai: ${parsed.error.message}`);
    const scene = parsed.data;
    let { w, dur, from, rt } = build(name, scene, data);
    const fonts = w.set.fonts;
    if (fonts?.specs?.length) {
      const missing = await rig.loadFonts(fonts.specs, fonts.text);
      if (missing.length) warnings.push(`thiếu phông decal: ${missing.join(", ")}`);
      // đồ riêng vẽ chữ lúc dựng: dựng lại khi phông đã nạp
      ({ w, dur, from, rt } = build(name, scene, data));
    }
    await w.ready;
    if (my !== loading) return;
    const box = { posed: {} as Record<string, Figure> };
    const stage = stageFor(w, scene, (p) => (box.posed = p ?? {}));
    dispose();
    ui.frame.append(stage.canvas);
    const held = (j.heldOpts && !j.heldOpts.off && !j.heldOpts.error ? j.heldOpts : {}) as Omit<
      HeldOptions,
      "frame"
    >;
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
      heldOut: j.heldOut ?? null,
      get posed() {
        return box.posed;
      },
    };
    rowsT = NaN;
    if (!keepTime) t = 0;
    t = Math.min(t, dur);
    ui.scene.value = name;
    ui.time.max = String(dur);
    ui.time.step = String(1 / FPS);
    drawMarks(scene, dur);
    attachOrbit();
    if (mode === "free" && !keepTime) seedFree();
    const gpu = /SwiftShader/.test(stage.gpu) ? " · ⚠ vẽ phần mềm" : "";
    ui.status.textContent = `${from === "world" ? "cảnh của repo" : "plainRoom (cảnh không có trong worldOf)"} · ${scene.cast.length} người${gpu}`;
    say(warnings.join("\n"));
    dirty = true;
    remember();
  } catch (e) {
    if (my !== loading) return;
    say(`${name}: ${(e as Error).stack ?? e}`, true);
  }
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
  // lớp phủ của bàn tay đã chọn: vẽ đè, không qua pipeline
  if (overlay.active) {
    const r = stage.renderer;
    const auto = r.autoClear;
    r.autoClear = false;
    r.setRenderTarget(null);
    r.clearDepth();
    r.render(overlay.scene, camera);
    r.autoClear = auto;
  }
  // `readPixels` một điểm: chờ GPU vẽ xong thật, để số ms vẽ không chỉ là thời gian đẩy lệnh
  stage.renderer.getContext().readPixels(0, 0, 1, 1, 0x1908, 0x1401, PIXEL);
  cost = { pose: t1 - t0, render: performance.now() - t1 };
  ui.time.value = String(t);
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
  }
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
}

/** Chọn bàn tay; `go` thì camera tự do bay tới cận tay ấy (góc trước) */
function select(r: HandRow | undefined, go: boolean) {
  sel = r ? { id: r.id, side: r.side } : null;
  lastCenter = null;
  if (r && go) view("truoc");
  else dirty = true;
  rowsT = NaN;
}

/** Camera tự do bay mượt tới cận bàn tay đã chọn ở góc `a` */
function view(a: Angle) {
  const r = selRow();
  if (!r || !orbit) return;
  if (mode !== "free") setMode("free");
  const to = anglePose(r, a, free.fov);
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
    const p = anglePose(r, a, free.fov);
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
  editor = new GraspEditor(
    target,
    {
      preview: async (t, au) => {
        patched[t.base] = withAuthored(t, au);
        if (cur) await load(cur.name, true, true);
      },
      save: async (t, au) => {
        const res = await fetch(`/api/held?name=${encodeURIComponent(t.base)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ group: t.group, variant: t.variant, authored: au }),
        });
        const j = await res.json();
        if (j.error) throw new Error(j.error);
        // bản đã lưu thành bản đọc: cảnh dựng lại từ nó, không còn áp tạm
        if (fetched) fetched.j.heldRaw = { ...fetched.j.heldRaw, [t.base]: j.item };
        delete patched[t.base];
        if (cur) await load(cur.name, true, true);
        return j.file as string;
      },
      close: () => closeEditor(),
      wheel: () => fc.wheel,
      aa: () => ui.aa.value as AaMode,
    },
    cur.held,
    ui.editor,
    ui.frame,
  );
}

function closeEditor() {
  if (!editor) return;
  editor.dispose();
  editor = null;
  ui.editor.hidden = true;
  const had = Object.keys(patched).length > 0;
  for (const k of Object.keys(patched)) delete patched[k];
  if (had && cur) load(cur.name, true, true);
  rowsT = NaN;
  dirty = true;
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

// --- giao diện ---

ui.scene.addEventListener("change", () => {
  const name = ui.scene.value.trim();
  if (name && name !== cur?.name) load(name);
});
ui.reload.onclick = () => cur && load(cur.name, true);
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
  // khung soạn đang hiện: phím của nó (`GraspEditor.onKey`), cảnh và camera ngầm không đổi
  if ((e.target instanceof HTMLInputElement && e.target.type === "text") || editor?.shown) return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
    e.preventDefault();
    const step = (e.shiftKey ? 10 : 1) / FPS;
    seek(t + (e.key === "ArrowLeft" ? -step : step));
  } else if (e.key === "c" || e.key === "C") setMode(mode === "scene" ? "free" : "scene");
  else if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey && cur)
    load(cur.name, true);
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
    await load(name, true);
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
  },
});
