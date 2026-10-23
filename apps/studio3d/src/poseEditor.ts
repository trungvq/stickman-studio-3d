// Chỉnh dáng ngón của bàn tay không cầm đồ bằng mắt: khung riêng chỉ có bàn tay đang chọn (đúng bên, cỡ tay của người
// ấy), đứng yên đúng hướng như trong cảnh, kèm bóng cẳng tay. Ngón chọn bằng cách nhấp lên hình, kéo để gập, hay theo thanh
// kéo — như khung soạn kiểu cầm, không có món. Lưu là dáng có tên của thư viện `hands/<tên>.json` (`POST /api/hands`); mốc
// tay của cảnh gọi nó bằng `pose`. docs/01-rig.md#dáng-tay-có-tên
import * as rig from "@stickman3d/rig";
import type { AaMode, HandShape, Stage } from "@stickman3d/rig";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { EditScene } from "./editor";
import { wheelPans, type WheelMode } from "./freecam";
import {
  CURL,
  DRAG_DEG,
  esc,
  FINGER_NAMES,
  FINGER_RANGE,
  fingerOf,
  fingerPieces,
  FIT_RANGE,
  FLY,
  forearmMeshes,
  GROUPS,
  HandMesh,
  KNOBS,
  OWN,
  pieceSet,
  Tint,
  vertexPieces,
  VIEWS,
  WHEEL_DEG,
  type EditView,
  type Finger,
  type Knob,
} from "./handKit";
import type { HandRow } from "./hands";
import { shapeAsDialog } from "./namedUi";

/** Một lần chỉnh dáng: bàn tay không cầm đồ ở giây đang xem */
export interface PoseTarget {
  row: HandRow;
  /** Cỡ bàn tay, cỡ dọc của người đang chọn */
  k: number;
  long: number;
  scene: EditScene;
  /** Hai mươi số ngón đang vẽ ở giây ấy: mười góc ngón, mười `HAND_FIT` */
  drawn: number[];
  /** `pose` của mốc tay đúng giây ấy */
  pose?: string;
  /** Nhãn mốc sẽ nhận `pose` ("Dùng cho mốc này") */
  key: string;
}

/** Một dáng chọn được: có sẵn của rig hay của thư viện (`own`: file nằm trong `hands/` của repo) */
export interface ShapeEntry {
  name: string;
  label: string;
  builtin: boolean;
  own: boolean;
  note?: string;
}

/** Việc trang làm cho khung dáng tay: thư viện, ghi dáng, ghi `pose` vào mốc, thoát */
export interface PoseHost {
  shapes(): ShapeEntry[];
  /** Hai mươi số ngón của dáng `name` */
  fingers(name: string): number[] | undefined;
  /** Ghi dáng `name` vào `hands/` (`create`: dáng mới, file đã có thì lỗi); trả file */
  save(name: string, shape: HandShape, create: boolean): Promise<string>;
  /** Ghi `pose: name` vào mốc tay ở giây đang chỉnh (một bước lịch sử của cảnh); trả lời báo */
  use(t: PoseTarget, name: string): { message: string; error?: boolean };
  /** Mốc của cảnh đang mở gọi dáng `name` */
  uses(name: string): string[];
  close(): void;
  wheel(): WheelMode;
  aa(): AaMode;
}

/** Một trạng thái cho hoàn tác: góc ngón, `HAND_FIT` */
interface Snap {
  f: number[];
  fit: number[];
}
const snapKey = (s: Snap) => JSON.stringify([s.f, s.fit]);
const same = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
const r1 = (x: number) => Math.round(x * 10) / 10;
const FIT_N = rig.HAND_FIT.length;

export class PoseEditor {
  readonly canvas: HTMLCanvasElement;
  private stage: Stage;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.005, 20);
  private orbit: OrbitControls;
  /** Khung bàn tay: xoay như bàn tay trong cảnh */
  private root = new THREE.Group();
  private hand: HandMesh;
  private pieces: Uint8Array;
  /** Lớp vẽ sau pipeline (có độ sâu của cảnh): bóng cẳng tay, tô ngón */
  private over = new THREE.Scene();
  private handOver = new THREE.Group();
  private tints: Record<"sel" | "hover" | "knob", Tint>;
  private depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  private fingers: number[];
  private fit: number[];
  /** Dáng đang mở (có sẵn hay của thư viện) và số ngón của nó lúc mở / lưu */
  private name: string | undefined;
  private saved: number[] = [];
  private dirty = true;
  private stale = true;
  private raf = 0;
  private ui: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private hud: HTMLElement;
  private inputs: { knob: Knob; inp: HTMLInputElement; out: HTMLOutputElement }[] = [];
  private sel: Finger | null = null;
  private hoverFinger: Finger | "palm" | null = null;
  private past: Snap[] = [];
  private future: Snap[] = [];
  private last: Snap;
  private press: { x: number; y: number; finger: Finger | "palm" | null } | null = null;
  private curling: { y: number } | null = null;
  private wheelCommit = 0;
  private pans = wheelPans();
  private fly: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    t0: THREE.Vector3;
    t1: THREE.Vector3;
    d0: number;
    d1: number;
    at: number;
  } | null = null;
  private ray = new THREE.Raycaster();

  constructor(
    readonly t: PoseTarget,
    private host: PoseHost,
    panel: HTMLElement,
    frame: HTMLElement,
  ) {
    const sc = t.scene;
    this.stage = rig.createStage({
      size: { w: 16, h: 9 },
      aa: host.aa(),
      scene: this.scene,
      camera: this.camera,
      light: () => {
        rig.setPalette(sc.palette);
        rig.setLights(sc.lights);
      },
    });
    this.canvas = this.stage.canvas;
    this.canvas.className = "editor";
    this.canvas.style.width = this.canvas.style.height = "";
    frame.append(this.canvas);
    this.scene.background = sc.background.clone();
    this.root.quaternion.copy(sc.q);
    this.scene.add(this.root);
    const skin = sc.skin ?? rig.npr({ color: "#f2c9a4" });
    this.hand = new HandMesh(t.row.side, t.k, t.long, skin, sc.hull);
    this.root.add(this.hand.group);
    this.pieces = vertexPieces(this.hand.skin);
    this.handOver.matrixAutoUpdate = false;
    this.over.add(this.handOver);
    this.over.add(new THREE.HemisphereLight(0xffffff, 0x555566, 2.2));
    const arm = forearmMeshes(sc.elbow, t.k);
    if (arm.length) this.handOver.add(...arm);
    this.tints = {
      sel: new Tint(this.hand, this.pieces, 0xff9a3c, 0.45),
      hover: new Tint(this.hand, this.pieces, 0xffffff, 0.22),
      knob: new Tint(this.hand, this.pieces, 0x3cc8ff, 0.6),
    };
    for (const x of Object.values(this.tints)) this.handOver.add(x.mesh);
    // điểm đầu: dáng của mốc ở giây ấy, không thì dáng đang vẽ
    const start = (t.pose && host.fingers(t.pose)) || t.drawn;
    this.fingers = start.slice(0, 10);
    this.fit = Array.from({ length: FIT_N }, (_, i) => start[10 + i] ?? 0);
    this.open(t.pose && host.fingers(t.pose) ? t.pose : undefined);
    this.last = this.snap();
    this.canvas.addEventListener("pointerdown", this.onDown, true);
    this.canvas.addEventListener("pointermove", this.onMove, true);
    this.canvas.addEventListener("pointerup", this.onUp, true);
    this.canvas.addEventListener("pointercancel", this.onUp, true);
    this.canvas.addEventListener("wheel", this.onWheel, { capture: true, passive: false });
    this.canvas.addEventListener("pointerleave", this.onLeave);
    this.canvas.addEventListener("dblclick", this.onDbl);
    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.orbit.zoomToCursor = true;
    this.orbit.screenSpacePanning = true;
    this.orbit.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN,
    };
    this.orbit.addEventListener("change", () => (this.dirty = true));
    this.ui = panel;
    this.hud = document.createElement("div");
    this.hud.className = "edhud";
    frame.append(this.hud);
    this.panel();
    this.hudInit();
    this.rebuild();
    this.view("canh", false);
    addEventListener("keydown", this.onKey, true);
    this.loop();
  }

  /** Hai mươi số ngón đang thấy */
  private now(): number[] {
    return [...this.fingers, ...this.fit];
  }

  /** Dáng đang thấy, dạng file `hands/` (`fit` bỏ khi toàn `0`) */
  shape(note?: string): HandShape {
    const fit = this.fit.map(r1);
    return {
      schemaVersion: rig.HAND_SHAPE_VERSION,
      ...(note && { note }),
      fingers: this.fingers.map(r1) as HandShape["fingers"],
      ...(fit.some((x) => x !== 0) && { fit: fit as NonNullable<HandShape["fit"]> }),
    };
  }

  /** Mở dáng `name` (bỏ trống: không dáng nào mở): số đang thấy là bản đã lưu của nó */
  private open(name: string | undefined) {
    this.name = name;
    this.saved = this.now();
  }

  private entry = (name: string | undefined) =>
    name === undefined ? undefined : this.host.shapes().find((e) => e.name === name);

  private changed = () => !same(this.now(), this.saved);

  private edited() {
    this.dirty = true;
    this.stale = true;
  }

  // --- hoàn tác ---

  private snap(): Snap {
    return { f: [...this.fingers], fit: [...this.fit] };
  }

  private commit() {
    const s = this.snap();
    if (snapKey(s) === snapKey(this.last)) return;
    this.past.push(this.last);
    this.future = [];
    this.last = s;
    this.syncUndo();
    this.syncButtons();
  }

  private undo() {
    this.commit();
    const s = this.past.pop();
    if (!s) return;
    this.future.push(this.last);
    this.restore(s);
  }

  private redo() {
    const s = this.future.pop();
    if (!s) return;
    this.past.push(this.last);
    this.restore(s);
  }

  private restore(s: Snap) {
    this.last = s;
    this.fingers.splice(0, this.fingers.length, ...s.f);
    this.fit.splice(0, this.fit.length, ...s.fit);
    this.sync();
    this.edited();
    this.syncUndo();
    this.syncButtons();
  }

  private syncUndo() {
    for (const el of this.hud.querySelectorAll<HTMLButtonElement>("[data-undo]"))
      el.disabled = !(el.dataset.undo === "undo" ? this.past.length : this.future.length);
  }

  private rebuild() {
    this.stale = false;
    this.hand.pose([0, 0, ...this.fingers, ...this.fit]);
  }

  // --- góc nhìn ---

  /** Giữa lòng bàn tay (thế giới khung chỉnh) */
  private center() {
    return new THREE.Vector3(
      ...rig.handPoint("palm", [0, 0, ...this.fingers], this.t.row.side, this.t.k, this.t.long),
    ).applyQuaternion(this.root.quaternion);
  }

  private viewDir(v: EditView): THREE.Vector3 {
    const q = this.root.quaternion;
    let d: THREE.Vector3;
    if (v === "long" || v === "mu")
      d = new THREE.Vector3((v === "long" ? 1 : -1) * -this.t.row.side, 0.25, 0.15).applyQuaternion(
        q,
      );
    else d = this.t.scene.views[v].clone();
    d.normalize();
    if (Math.abs(d.y) > 0.985) d.add(new THREE.Vector3(0, 0, 0.2).applyQuaternion(q)).normalize();
    return d;
  }

  private view(v: EditView, smooth = true) {
    const c = this.center();
    this.scene.updateMatrixWorld();
    const r = new THREE.Box3()
      .setFromObject(this.hand.mesh, true)
      .getBoundingSphere(new THREE.Sphere()).radius;
    const dist = (r / Math.sin(((this.camera.fov / 2) * Math.PI) / 180)) * 1.1;
    const to = this.viewDir(v);
    for (const b of this.hud.querySelectorAll<HTMLButtonElement>("[data-view]"))
      b.classList.toggle("on", b.dataset.view === v);
    if (!smooth) {
      this.orbit.target.copy(c);
      this.camera.position.copy(c).addScaledVector(to, dist);
      this.camera.lookAt(c);
      this.orbit.update();
      this.dirty = true;
      return;
    }
    const off = this.camera.position.clone().sub(this.orbit.target);
    this.fly = {
      from: off.clone().normalize(),
      to,
      t0: this.orbit.target.clone(),
      t1: c,
      d0: off.length(),
      d1: dist,
      at: performance.now(),
    };
  }

  private flyStep(now: number) {
    const fl = this.fly;
    if (!fl) return;
    const k = Math.min(1, (now - fl.at) / 1000 / FLY);
    const e = k * k * (3 - 2 * k);
    const q = new THREE.Quaternion().setFromUnitVectors(fl.from, fl.to);
    const dir = fl.from.clone().applyQuaternion(new THREE.Quaternion().slerp(q, e));
    this.orbit.target.lerpVectors(fl.t0, fl.t1, e);
    this.camera.position.copy(this.orbit.target).addScaledVector(dir, fl.d0 + (fl.d1 - fl.d0) * e);
    this.camera.lookAt(this.orbit.target);
    this.dirty = true;
    if (k >= 1) this.fly = null;
  }

  // --- ngón ---

  private ndc(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
  }

  /** Ngón dưới con trỏ (lòng tay: `palm`) */
  private pick(e: MouseEvent): Finger | "palm" | null {
    this.ray.setFromCamera(this.ndc(e), this.camera);
    const hit = this.ray.intersectObject(this.hand.mesh, false)[0];
    if (!hit?.face) return null;
    const { a, b, c } = hit.face;
    const ps = [this.pieces[a], this.pieces[b], this.pieces[c]];
    return fingerOf(rig.HAND_PIECES[ps[1] === ps[2] ? ps[1] : ps[0]]);
  }

  private select(fi: Finger | null) {
    this.sel = fi;
    this.tints.sel.set(pieceSet(fi ? fingerPieces(fi) : []));
    for (const g of this.ui.querySelectorAll<HTMLElement>("[data-finger]"))
      g.classList.toggle("on", !!fi && g.dataset.finger!.split(" ").includes(fi));
    this.card();
    this.dirty = true;
  }

  /** Gập / duỗi ngón đang chọn `d` độ: `tip` chỉ đốt ngọn, `alone` riêng ngón ấy qua `HAND_FIT` */
  private curlBy(d: number, tip: boolean, alone: boolean) {
    const fi = this.sel;
    if (!fi) return;
    const [arr, idx, range] = alone
      ? [this.fit, OWN[fi], () => FIT_RANGE]
      : [this.fingers, CURL[fi], (i: number) => FINGER_RANGE[i]];
    for (const i of tip ? [idx[1]] : idx) {
      const [lo, hi] = range(i);
      arr[i] = Math.round(Math.min(hi, Math.max(lo, arr[i] + d)) * 10) / 10;
    }
    this.sync();
    this.edited();
  }

  private onDown = (e: PointerEvent) => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.press = null;
    if (e.button !== 0) return;
    const fi = this.pick(e);
    if (fi && fi !== "palm" && fi === this.sel) {
      e.stopImmediatePropagation();
      e.preventDefault();
      this.canvas.setPointerCapture(e.pointerId);
      this.curling = { y: e.clientY };
      return;
    }
    if (!e.shiftKey) this.press = { x: e.clientX, y: e.clientY, finger: fi };
  };

  private onMove = (e: PointerEvent) => {
    if (this.curling) {
      e.stopImmediatePropagation();
      const dy = this.curling.y - e.clientY;
      this.curling.y = e.clientY;
      if (dy) this.curlBy(dy * DRAG_DEG, e.shiftKey, e.ctrlKey || e.metaKey);
      return;
    }
    if (e.buttons) return;
    const fi = this.pick(e);
    this.canvas.style.cursor =
      fi && fi !== "palm" ? (fi === this.sel ? "ns-resize" : "pointer") : "";
    if (fi !== this.hoverFinger) {
      this.hoverFinger = fi;
      this.tints.hover.set(pieceSet(fi && fi !== this.sel ? fingerPieces(fi) : []));
      this.els.hover.textContent = fi && fi !== "palm" ? `${FINGER_NAMES[fi]} · ` : "";
      this.dirty = true;
    }
  };

  private onUp = (e: PointerEvent) => {
    if (this.curling) {
      e.stopImmediatePropagation();
      this.curling = null;
      if (this.canvas.hasPointerCapture(e.pointerId))
        this.canvas.releasePointerCapture(e.pointerId);
      this.commit();
      return;
    }
    const p = this.press;
    this.press = null;
    if (!p || e.type !== "pointerup" || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 4) return;
    this.select(p.finger && p.finger !== "palm" ? p.finger : null);
  };

  private onLeave = () => {
    if (this.hoverFinger === null) return;
    this.hoverFinger = null;
    this.tints.hover.set(new Set());
    this.dirty = true;
  };

  private onDbl = (e: MouseEvent) => {
    this.ray.setFromCamera(this.ndc(e), this.camera);
    const hit = this.ray.intersectObject(this.hand.mesh, false)[0];
    if (hit) {
      this.orbit.target.copy(hit.point);
      this.dirty = true;
    }
  };

  /** Alt + lăn gập / duỗi ngón đang chọn; lăn kiểu touchpad dời như camera tự do; còn lại OrbitControls tiến lùi */
  private onWheel = (e: WheelEvent) => {
    if (e.altKey) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!this.sel) return;
      const d = Math.max(-4, Math.min(4, -(e.deltaY || e.deltaX) * WHEEL_DEG));
      this.curlBy(d, e.shiftKey, e.ctrlKey || e.metaKey);
      clearTimeout(this.wheelCommit);
      this.wheelCommit = window.setTimeout(() => this.commit(), 400);
      return;
    }
    if (!this.pans(e, this.host.wheel())) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    this.orbit.pan(-e.deltaX, -e.deltaY);
    this.fly = null;
    this.dirty = true;
  };

  // --- panel, thẻ ngón ---

  private slider(knob: Knob): HTMLLabelElement {
    const vals = knob.k === "f" ? this.fingers : this.fit;
    const [lo, hi] = knob.k === "f" ? FINGER_RANGE[knob.i] : FIT_RANGE;
    const lab = document.createElement("label");
    lab.className = "slider";
    lab.innerHTML = `<span>${esc(knob.label)}</span><input type="range" min="${lo}" max="${hi}" step="0.5" /><output></output>`;
    const inp = lab.querySelector("input")!;
    const out = lab.querySelector("output")!;
    inp.value = String(vals[knob.i]);
    out.textContent = vals[knob.i].toFixed(1);
    inp.oninput = () => {
      vals[knob.i] = Number(inp.value);
      this.sync();
      this.edited();
    };
    inp.onchange = () => {
      this.commit();
      inp.blur();
    };
    lab.onpointerenter = () => this.hoverKnob(knob);
    lab.onpointerleave = () => this.hoverKnob(null);
    this.inputs.push({ knob, inp, out });
    return lab;
  }

  private hoverKnob(k: Knob | null) {
    this.tints.knob.set(pieceSet(k?.pieces ?? []));
    this.dirty = true;
  }

  private sync() {
    this.inputs = this.inputs.filter((x) => x.inp.isConnected);
    for (const { knob, inp, out } of this.inputs) {
      const v = (knob.k === "f" ? this.fingers : this.fit)[knob.i];
      if (document.activeElement !== inp) inp.value = String(v);
      out.textContent = v.toFixed(1);
    }
    this.syncButtons();
  }

  private hudInit() {
    this.hud.innerHTML = `
      <div class="edbar">
        <div class="seg">${(Object.entries(VIEWS) as [EditView, string][]).map(([v, l], i) => `<button data-view="${v}" title="${l} (${i + 1})">${l}</button>`).join("")}</div>
        <button data-undo="undo" title="Hoàn tác (Ctrl+Z)">↶<span class="lbl"> Hoàn tác</span></button>
        <button data-undo="redo" title="Làm lại (Ctrl+Shift+Z)">↷<span class="lbl"> Làm lại</span></button>
      </div>
      <div class="edcard"></div>
      <div class="edhint"><span data-hud="hover"></span>Kéo trái: xoay · kéo phải / giữa / Shift: dời · lăn: tiến lùi · hai ngón: dời · Ctrl + lăn / chụm: tiến lùi · nhấp ngón: chọn</div>`;
    this.els.hover = this.hud.querySelector("[data-hud=hover]")!;
    for (const b of this.hud.querySelectorAll<HTMLButtonElement>("[data-view]"))
      b.onclick = () => this.view(b.dataset.view as EditView);
    for (const b of this.hud.querySelectorAll<HTMLButtonElement>("[data-undo]"))
      b.onclick = () => (b.dataset.undo === "undo" ? this.undo() : this.redo());
    this.card();
    this.syncUndo();
  }

  private card() {
    const box = this.hud.querySelector<HTMLElement>(".edcard")!;
    box.replaceChildren();
    const fi = this.sel;
    if (!fi) {
      box.innerHTML = `<div class="dim">Nhấp lên một ngón trên hình để chỉnh ngón ấy</div>`;
      this.sync();
      return;
    }
    const head = document.createElement("div");
    head.className = "edcardhead";
    head.innerHTML = `<b>${FINGER_NAMES[fi]}</b>${fi === "middle" || fi === "ring" || fi === "pinky" ? ` <span class="dim">· gập chung với hai ngón kia, "riêng" là của ngón này</span>` : ""}`;
    const x = document.createElement("button");
    x.textContent = "×";
    x.title = "Bỏ chọn (Esc)";
    x.onclick = () => this.select(null);
    head.append(x);
    box.append(head, ...KNOBS[fi].map((k) => this.slider(k)));
    const hint = document.createElement("div");
    hint.className = "dim";
    hint.textContent =
      "Kéo lên / xuống trên ngón: gập / duỗi · Shift: chỉ đốt ngọn · Ctrl: riêng ngón này · Alt + lăn: như kéo";
    box.append(hint);
    this.sync();
  }

  /** Panel: điểm đầu, ngón theo nhóm, lưu, dùng cho mốc */
  private panel() {
    const t = this.t;
    const list = this.host.shapes();
    const opt = (e: ShapeEntry) =>
      `<option value="${esc(e.name)}">${esc(e.name)}${e.label !== e.name ? ` (${esc(e.label)})` : ""}${e.note ? ` — ${esc(e.note)}` : ""}</option>`;
    const lib = list.filter((e) => !e.builtin);
    this.ui.innerHTML = `
      <div class="edhead"><b>Dáng tay · ${esc(t.row.id)} tay ${t.row.side < 0 ? "phải" : "trái"}</b> · ${t.scene.t.toFixed(2)} s · cỡ tay ${t.k.toFixed(2)} / ${t.long.toFixed(2)}<div data-k="open" class="dim"></div></div>
      <label>Điểm đầu <select data-k="start"><option value="">—</option><option value="@drawn">đang vẽ ở giây này</option>${lib.length ? `<optgroup label="Thư viện hands/">${lib.map(opt).join("")}</optgroup>` : ""}<optgroup label="Dáng có sẵn">${list
        .filter((e) => e.builtin)
        .map(opt)
        .join("")}</optgroup></select></label>
      <div class="dim">Ngón: nhấp lên ngón trên hình để chọn, hay chỉnh số ở đây (rê chuột lên thanh: đốt ấy sáng xanh trên hình)</div>
      <div data-k="groups"></div>
      <div class="row"><button data-k="save" class="primary">Lưu</button><button data-k="saveAs">Lưu thành dáng mới…</button><button data-k="use">Dùng cho mốc này</button><button data-k="close">Thoát</button></div>
      <div data-k="warn" class="dim"></div>
      <div data-k="status" class="dim"></div>`;
    for (const el of this.ui.querySelectorAll<HTMLElement>("[data-k]"))
      this.els[el.dataset.k!] = el;
    for (const g of GROUPS) {
      const box = document.createElement("div");
      box.className = "fgroup";
      box.dataset.finger = [
        ...new Set(
          g.knobs.flatMap((k) => k.pieces.map((p) => fingerOf(p))).filter((x) => x !== "palm"),
        ),
      ].join(" ");
      const h = document.createElement("div");
      h.className = "fhead";
      h.textContent = g.title;
      box.append(h, ...g.knobs.map((k) => this.slider(k)));
      this.els.groups.append(box);
    }
    const start = this.els.start as HTMLSelectElement;
    start.onchange = () => {
      const v = start.value;
      start.value = "";
      start.blur();
      if (!v) return;
      const src = v === "@drawn" ? this.t.drawn : this.host.fingers(v);
      if (!src) return;
      this.fingers.splice(0, 10, ...src.slice(0, 10));
      this.fit.splice(0, FIT_N, ...this.fit.map((_, i) => src[10 + i] ?? 0));
      this.open(v === "@drawn" ? undefined : v);
      this.sync();
      this.edited();
      this.commit();
      this.syncButtons();
    };
    this.els.save.onclick = () => void this.save();
    this.els.saveAs.onclick = () => void this.saveAs();
    this.els.use.onclick = () => {
      if (!this.name) return;
      const r = this.host.use(this.t, this.name);
      this.say(r.message, r.error);
    };
    this.els.close.onclick = () => this.host.close();
    this.sync();
  }

  /** Nhãn, trạng thái nút theo dáng đang mở và số đang thấy */
  private syncButtons() {
    const save = this.els.save as HTMLButtonElement | undefined;
    if (!save) return;
    const use = this.els.use as HTMLButtonElement;
    const e = this.entry(this.name);
    const changed = this.changed();
    const uses = e && !e.builtin ? this.host.uses(e.name) : [];
    save.hidden = !e || e.builtin;
    save.disabled = !changed;
    save.textContent = e ? `Lưu dáng ${e.name}` : "Lưu";
    save.title = e
      ? `Ghi đè hands/${e.name}.json${e.own ? "" : " của repo (đè dáng chung cùng tên)"} — mọi mốc gọi dáng này, ở mọi cảnh, đổi theo`
      : "";
    use.disabled = !e || changed;
    use.textContent = e ? `Dùng ${e.name} cho mốc này` : "Dùng cho mốc này";
    use.title = !e
      ? "Lưu thành dáng mới trước (hay chọn một dáng ở Điểm đầu)"
      : changed
        ? "Dáng đã chỉnh mà chưa lưu: Lưu hay Lưu thành dáng mới trước"
        : `Ghi \`pose: "${e.name}"\` vào ${this.t.key} — chưa lưu cảnh (Lưu, Ctrl+S)`;
    this.els.open.textContent = e
      ? `${e.builtin ? "dáng có sẵn" : e.own ? "dáng của hands/" : "dáng chung (đi theo package)"} ${e.name}${e.note ? ` — ${e.note}` : ""}${changed ? " · đã chỉnh, chưa lưu" : ""}`
      : "chưa mở dáng nào: Lưu thành dáng mới để dùng lại";
    this.els.warn.textContent =
      e && !e.builtin && changed
        ? `Lưu ghi đè dáng ${e.name}: mọi mốc gọi nó đổi theo${uses.length ? ` — cảnh này: ${uses.join(", ")}` : ""}`
        : "";
  }

  private async save() {
    const e = this.entry(this.name);
    if (!e || e.builtin) return;
    const shape = this.shape(e.note);
    try {
      const file = await this.host.save(e.name, shape, false);
      this.open(e.name);
      this.syncButtons();
      this.say(`đã lưu ${file}`);
    } catch (err) {
      this.say(`không lưu được: ${(err as Error).message}`, true);
    }
  }

  private async saveAs() {
    const names = new Set(this.host.shapes().map((x) => x.name));
    const r = await shapeAsDialog({
      from: this.name ? `dáng ${this.name}` : "dáng đang vẽ",
      note: this.entry(this.name)?.note,
      key: this.t.key,
      problem: (n) =>
        !n
          ? "đặt tên cho dáng"
          : (rig.handShapeNameProblem(n) ??
            (names.has(n) ? `đã có dáng ${n} — mở nó ở Điểm đầu để sửa` : undefined)),
    });
    if (!r) return;
    this.say(`đang lưu dáng ${r.name}…`);
    try {
      const file = await this.host.save(r.name, this.shape(r.note || undefined), true);
      this.open(r.name);
      this.panel();
      this.select(this.sel);
      const used = r.use ? this.host.use(this.t, r.name) : undefined;
      this.say(`đã lưu ${file}${used ? `; ${used.message}` : ""}`, used?.error);
    } catch (err) {
      this.say(`không lưu được: ${(err as Error).message}`, true);
    }
  }

  get shown() {
    return this.canvas.style.display !== "none";
  }

  private say(s: string, err = false) {
    this.els.status.textContent = s;
    this.els.status.classList.toggle("error", err);
  }

  /** Phím khi khung đang hiện: bắt ở pha capture của `window` trước phím của trang */
  private onKey = (e: KeyboardEvent) => {
    if (!this.shown || document.querySelector("dialog[open]")) return;
    if (e.target instanceof HTMLInputElement && e.target.type === "text") return;
    const k = e.key.toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (mod && k === "z") {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    } else if (mod && k === "y") {
      e.preventDefault();
      this.redo();
    } else if (mod || e.altKey || e.target instanceof HTMLSelectElement) return;
    else if (k === "escape") this.select(null);
    else if (/^[1-6]$/.test(k)) this.view(Object.keys(VIEWS)[Number(k) - 1] as EditView);
    else if (e.key.startsWith("Arrow") || [" ", "c", "r", "w", "a", "s", "d", "q", "e"].includes(k))
      return void e.stopPropagation();
    else return;
    e.stopPropagation();
  };

  private resize(w: number, h: number) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    this.stage.setSize(Math.round(w * dpr), Math.round(h * dpr), { aa: this.host.aa() });
    this.canvas.style.width = this.canvas.style.height = "";
    this.dirty = true;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.shown) return;
    this.flyStep(performance.now());
    if (this.orbit.update()) this.dirty = true;
    if (this.stale) this.rebuild();
    if (!this.dirty) return;
    this.dirty = false;
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    if (r.width && this.canvas.width !== Math.round(r.width * dpr)) this.resize(r.width, r.height);
    this.draw();
  };

  /** Một khung: pipeline của rig, rồi lượt độ sâu của cảnh và lớp vẽ sau (cẳng tay, tô ngón) có che khuất */
  private draw() {
    const sc = this.t.scene;
    this.stage.draw(sc.t, { render: { ...sc.render, grade: undefined } });
    this.root.updateMatrixWorld();
    this.handOver.matrix.copy(this.root.matrixWorld);
    const r = this.stage.renderer;
    r.setRenderTarget(null);
    r.autoClear = false;
    r.clearDepth();
    const bg = this.scene.background;
    this.scene.background = null;
    this.scene.overrideMaterial = this.depthMat;
    r.render(this.scene, this.camera);
    this.scene.overrideMaterial = null;
    this.scene.background = bg;
    r.render(this.over, this.camera);
    r.autoClear = true;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.wheelCommit);
    removeEventListener("keydown", this.onKey, true);
    this.orbit.dispose();
    this.stage.dispose();
    this.canvas.remove();
    this.hud.remove();
    this.ui.innerHTML = "";
  }
}
