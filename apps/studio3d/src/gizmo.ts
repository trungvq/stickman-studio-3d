// Tay nắm, vòng khuỷu, nón cổ tay của bàn tay đang chọn ở Dáng tay. Tay nắm (TransformControls, T dời / Y xoay) ở tâm nắm:
// đồ theo tay, tay tự do sửa mốc tay; tay theo đồ dời / xoay món quanh tâm nắm, sửa mốc món. Kéo vòng khuỷu khoá `elbow`,
// nhấp đúp lên vòng bỏ khoá. Áp khi thả chuột, một lần một lúc. README.md § Dáng tay.
import * as rig from "@stickman3d/rig";
import type { HandReport, HandSide, SceneRuntime } from "@stickman3d/rig";
import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { dragHand, dragItem, lockElbow, unlockElbow, type DragResult } from "./drag";
import { ElbowRing } from "./elbowRing";
import { rigRotation, wrapDeg } from "./grab";
import { gripWorld, type HandRow } from "./hands";
import type { Json, KeyRef, V3 } from "./keys";
import type { PlusOptions } from "./plus";
import { WristCone } from "./wristCone";

export interface GrabHost {
  /** Bản đang sửa, runtime và giây đang xem; `opts` đo như ＋ cho người `id`. `null` khi không sửa được */
  ctx(): { raw: Json; rt: SceneRuntime; t: number; opts(id: string): PlusOptions } | null;
  /** Áp bản mới (một bước lịch sử), mở thẻ mốc `key` */
  apply(raw: Json, key: KeyRef): boolean;
  say(text: string, error?: boolean): void;
  orbit(): { enabled: boolean } | null;
  /** Ngưỡng "sát kẹp" cổ tay của luật `held` (`stickman.held.wrist`, độ) */
  wristWarn(): number;
  redraw(): void;
}

export type Job = (c: NonNullable<ReturnType<GrabHost["ctx"]>>) => {
  raw: Json;
  key: KeyRef;
  say: string;
};

const MODE_KEY = { t: "translate", y: "rotate" } as const;
const sideOf = (s: number): HandSide => (s < 0 ? "right" : "left");
const rotationOf = (o: THREE.Object3D) => {
  o.updateWorldMatrix(true, false);
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().extractRotation(o.matrixWorld),
  );
};

export class HandGrab {
  readonly scene = new THREE.Scene();
  /** Lần khoá khuỷu: `φ` thả, `φ` vẽ ra sau khi áp (soi từ devtools) */
  readonly log: { t: number; side: HandSide; want: number; got: number }[] = [];
  private ring = new ElbowRing();
  private cone = new WristCone();
  private handle = new THREE.Object3D();
  private tc: TransformControls | null = null;
  private camera: THREE.Camera = new THREE.PerspectiveCamera();
  private row: HandRow | null = null;
  private rep: HandReport | null = null;
  private mode: "translate" | "rotate" = "translate";
  private start: { p: THREE.Vector3; q: THREE.Quaternion; orbit: boolean } | null = null;
  private ringPhi: number | null = null;
  /** Chỗ bấm xuống vòng khuỷu; thả mà chưa dời quá 3 px là nhấp (nhấp đúp bỏ khoá), không khoá */
  private ringAt: { x: number; y: number; moved: boolean } | null = null;
  private pending = false;
  private hud = document.createElement("div");
  private tagCone = document.createElement("div");
  private tagRing = document.createElement("div");

  constructor(
    private frame: HTMLElement,
    private host: GrabHost,
  ) {
    this.scene.add(this.ring.group, this.cone.group, this.handle);
    this.hud.className = "grabhud";
    this.tagCone.className = "grabtag";
    this.tagRing.className = "grabtag";
    this.hud.hidden = this.tagCone.hidden = this.tagRing.hidden = true;
    frame.append(this.hud, this.tagCone, this.tagRing);
    this.hud.onclick = (e) => {
      const m = (e.target as HTMLElement).dataset.m;
      if (m === "translate" || m === "rotate") this.setMode(m);
    };
    frame.addEventListener("pointerdown", this.onDown, true);
    frame.addEventListener("pointermove", this.onMove, true);
    frame.addEventListener("pointerup", this.onUp, true);
    frame.addEventListener("pointercancel", this.onUp, true);
    frame.addEventListener("dblclick", this.onDbl, true);
    addEventListener("keydown", this.onKey);
  }

  /** Có bàn tay đang chọn để vẽ tay nắm, vòng khuỷu, nón cổ tay */
  get active() {
    return !!this.row && !!this.rep;
  }

  /** Canvas mới của cảnh (mỗi lần dựng lại): TransformControls mới */
  attach(canvas: HTMLCanvasElement) {
    if (this.tc) {
      this.tc.detach();
      this.tc.getHelper().removeFromParent();
      this.tc.dispose();
    }
    const tc = new TransformControls(this.camera, canvas);
    tc.setSize(0.7);
    tc.setMode(this.mode);
    tc.setSpace(this.mode === "rotate" ? "local" : "world");
    tc.addEventListener("dragging-changed", (e) => (e.value ? this.grab() : this.drop()));
    tc.addEventListener("change", () => this.host.redraw());
    this.scene.add(tc.getHelper());
    this.tc = tc;
    this.place();
  }

  /**
   * Bàn tay đang chọn `row` ở giây đang xem (sau khi đặt người); `undefined` là ẩn. Đọc `handReport`, dựng vòng khuỷu, nón cổ
   * tay, đặt tay nắm ở tâm nắm
   */
  sync(row: HandRow | undefined) {
    const c = row && this.host.ctx();
    const rep =
      c && row
        ? (rig.handReport(c.rt, row.id, sideOf(row.side), c.t, c.opts(row.id)) ?? null)
        : null;
    this.row = rep ? row! : null;
    this.rep = rep;
    this.ringPhi = null;
    this.ring.update(rep, rig.U);
    this.cone.update(rep, this.row?.fig ?? null, row?.side ?? -1, this.host.wristWarn());
    this.place();
  }

  /** Vẽ sau cảnh (bên gọi đã xoá độ sâu, tắt `autoClear`), rồi đặt nhãn theo camera */
  render(renderer: THREE.WebGLRenderer, camera: THREE.Camera) {
    this.camera = camera;
    if (this.tc) this.tc.camera = camera;
    if (!this.active) return;
    renderer.render(this.scene, camera);
    const r = this.frame.getBoundingClientRect();
    const put = (el: HTMLElement, at: THREE.Vector3 | undefined) => {
      const p = at?.clone().project(camera);
      el.hidden = !p || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
      if (!p || el.hidden) return;
      el.style.left = `${((p.x + 1) / 2) * r.width}px`;
      el.style.top = `${((1 - p.y) / 2) * r.height}px`;
    };
    const lab = this.cone.label;
    this.tagCone.textContent = lab?.text ?? "";
    this.tagCone.classList.toggle("bad", lab?.tone === "bad");
    this.tagCone.classList.toggle("edge", lab?.tone === "edge");
    put(this.tagCone, lab?.at);
    const rep = this.rep!;
    const phi = this.ringPhi ?? rep.phi;
    const E = this.ring.cost(phi);
    this.tagRing.textContent = `φ ${phi.toFixed(1)}°${E === undefined ? "" : ` · E ${E.toFixed(2)}`}${rep.elbowLock && this.ringPhi === null ? " · khoá" : ""}`;
    const at = rep.joints.elbow;
    put(
      this.tagRing,
      this.ringPhi === null
        ? new THREE.Vector3(at[0] * rig.U, -at[1] * rig.U, -at[2] * rig.U)
        : this.ghostAt(this.ringPhi),
    );
  }

  private ghostAt(phi: number) {
    const ring = this.rep!.ring;
    const a = (phi * Math.PI) / 180;
    const p = ring.center.map(
      (c, i) => c + ring.radius * (Math.cos(a) * ring.d0[i] + Math.sin(a) * ring.o0[i]),
    );
    return new THREE.Vector3(p[0] * rig.U, -p[1] * rig.U, -p[2] * rig.U);
  }

  /** Tay nắm ở tâm nắm, hướng theo món (tay theo đồ) hay bàn tay; HUD theo chế độ */
  private place() {
    const row = this.row;
    const on = this.active && !this.support();
    this.hud.hidden = !this.active;
    if (!on) this.tagCone.hidden = this.tagRing.hidden = !this.active;
    if (!this.active) this.tagCone.hidden = this.tagRing.hidden = true;
    if (!this.tc) return;
    if (!on || !row) {
      this.tc.detach();
      this.tc.getHelper().visible = false;
      this.hudText();
      return;
    }
    if (this.start) return;
    this.handle.position.copy(gripWorld(row.fig, row.side));
    const obj = this.itemLed() ? row.hold?.object : undefined;
    this.handle.quaternion.copy(rotationOf(obj ?? row.fig.arms[row.side].wrist));
    this.handle.updateMatrixWorld(true);
    this.tc.attach(this.handle);
    this.tc.getHelper().visible = true;
    this.hudText();
  }

  private itemLed() {
    return this.rep?.mode === "keyed" || this.rep?.mode === "both";
  }

  private support() {
    return !!this.rep?.run?.lead;
  }

  private hudText() {
    const what = this.support()
      ? "tay phụ của `both`: kéo ở tay dẫn"
      : this.itemLed()
        ? "món quanh tâm nắm → mốc món"
        : this.rep?.mode === "hand"
          ? "bàn tay (ý định món) → mốc tay"
          : "bàn tay (lòng tay) → mốc tay";
    const b = (m: "translate" | "rotate", label: string) =>
      `<button data-m="${m}" class="${this.mode === m ? "on" : ""}">${label}</button>`;
    this.hud.innerHTML = `${b("translate", "T dời")}${b("rotate", "Y xoay")}<span>${what}</span><span class="dim">kéo vòng khuỷu: khoá · nhấp đúp vòng: bỏ khoá</span>`;
  }

  setMode(m: "translate" | "rotate") {
    this.mode = m;
    this.tc?.setMode(m);
    this.tc?.setSpace(m === "rotate" ? "local" : "world");
    this.hudText();
    this.host.redraw();
  }

  // --- tay nắm ---

  private grab() {
    const o = this.host.orbit();
    this.start = {
      p: this.handle.position.clone(),
      q: this.handle.quaternion.clone(),
      orbit: !!o?.enabled,
    };
    if (o) o.enabled = false;
  }

  private drop() {
    const s = this.start;
    this.start = null;
    if (!s) return;
    const o = this.host.orbit();
    if (o) o.enabled = s.orbit;
    const U = rig.U;
    const dp = this.handle.position.clone().sub(s.p);
    const d: V3 = [dp.x / U, -dp.y / U, -dp.z / U];
    const dq = this.handle.quaternion.clone().multiply(s.q.clone().invert());
    const turned = 2 * Math.acos(Math.min(1, Math.abs(dq.w))) > (0.05 * Math.PI) / 180;
    const moved = Math.hypot(...d) > 0.05;
    if (!turned && !moved) return this.place();
    const e = new THREE.Matrix4().makeRotationFromQuaternion(dq).elements;
    const R = turned
      ? rigRotation([e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]])
      : undefined;
    const row = this.row!;
    const side = sideOf(row.side);
    const item = this.itemLed();
    const what = item
      ? turned
        ? "xoay món"
        : "dời món"
      : turned
        ? this.rep?.mode === "hand"
          ? "xoay bàn tay (ý định món `hold.face`, `hold.roll`)"
          : "xoay lòng tay (`palm`, `fingers`)"
        : "dời tâm nắm";
    this.run(what, (c) => {
      const r: DragResult = (item ? dragItem : dragHand)(
        c.raw,
        c.rt,
        row.id,
        side,
        c.t,
        { d, ...(R && { R }) },
        c.opts(row.id),
      );
      return { raw: r.raw, key: r.key, say: this.said(r, c.t, `đã ${what}`) };
    });
  }

  private said(r: DragResult, t: number, what: string) {
    return [r.added ? `đã thêm mốc ${t.toFixed(2)} s` : "", what, ...r.notes]
      .filter(Boolean)
      .join(" · ");
  }

  /** Chạy một thao tác (dựng lại, đo — vài trăm ms) rồi áp; đang chạy thì bỏ thao tác mới (trả `false`) */
  run(what: string, job: Job): boolean {
    if (this.pending) return false;
    const c = this.host.ctx();
    if (!c) {
      this.place();
      return false;
    }
    this.pending = true;
    this.host.say(`đang áp: ${what}…`);
    setTimeout(() => {
      try {
        const now = this.host.ctx();
        if (!now || now.raw !== c.raw)
          return this.host.say(`bỏ thao tác ${what}: cảnh đã đổi trong lúc chờ áp`, true);
        const r = job(now);
        if (this.host.apply(r.raw, r.key)) this.host.say(r.say);
      } catch (e) {
        this.host.say((e as Error).message, true);
      } finally {
        this.pending = false;
        this.ring.drag(null);
        this.place();
        this.host.redraw();
      }
    }, 30);
    return true;
  }

  // --- vòng khuỷu ---

  private px(e: MouseEvent) {
    const r = this.frame.getBoundingClientRect();
    return {
      p: new THREE.Vector2(e.clientX - r.left, e.clientY - r.top),
      w: r.width,
      h: r.height,
    };
  }

  /** `φ` của chỗ trên vòng khuỷu dưới con trỏ; tay nắm dưới con trỏ thắng (trừ nhấp đúp: tay nắm không nhận) */
  private ringPick(e: MouseEvent, dbl = false) {
    if (!this.active || this.pending || this.start) return undefined;
    if (this.tc?.axis && !dbl) return undefined;
    const { p, w, h } = this.px(e);
    return this.ring.pick(this.camera, p, w, h);
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0 || e.shiftKey || e.ctrlKey) return;
    const phi = this.ringPick(e);
    if (phi === undefined || this.support()) return;
    e.stopPropagation();
    e.preventDefault();
    this.frame.setPointerCapture(e.pointerId);
    this.ringAt = { x: e.clientX, y: e.clientY, moved: false };
    this.ringPhi = phi;
    this.ring.drag(phi);
    this.host.redraw();
  };

  private onMove = (e: PointerEvent) => {
    if (this.ringPhi === null || !this.ringAt) return;
    e.stopPropagation();
    if (!this.ringAt.moved && Math.hypot(e.clientX - this.ringAt.x, e.clientY - this.ringAt.y) < 3)
      return;
    this.ringAt.moved = true;
    const { p, w, h } = this.px(e);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2((p.x / w) * 2 - 1, -(p.y / h) * 2 + 1), this.camera);
    const phi = this.ring.phiOn(ray.ray) ?? this.ring.pick(this.camera, p, w, h, 1e9);
    if (phi === undefined) return;
    this.ringPhi = phi;
    this.ring.drag(phi);
    this.host.redraw();
  };

  private onUp = (e: PointerEvent) => {
    if (this.ringPhi === null) return;
    e.stopPropagation();
    const phi = this.ringPhi;
    const row = this.row!;
    const side = sideOf(row.side);
    this.ringPhi = null;
    const moved = !!this.ringAt?.moved;
    this.ringAt = null;
    if (e.type === "pointercancel" || !moved) {
      this.ring.drag(null);
      return this.host.redraw();
    }
    this.run(`khoá khuỷu φ ${phi.toFixed(1)}°`, (c) => {
      const r = lockElbow(c.raw, c.rt, row.id, side, c.t, phi, c.opts(row.id));
      const got = r.phi!.got;
      this.log.push({ t: c.t, side, want: phi, got });
      return {
        raw: r.raw,
        key: r.key,
        say: this.said(
          r,
          c.t,
          `đã khoá khuỷu φ ${phi.toFixed(1)}° (vẽ ${got.toFixed(1)}°, lệch ${Math.abs(wrapDeg(got - phi)).toFixed(2)}°)`,
        ),
      };
    });
  };

  private onDbl = (e: MouseEvent) => {
    if (this.ringPick(e, true) === undefined) return;
    e.stopPropagation();
    e.preventDefault();
    const row = this.row!;
    this.run("bỏ khoá khuỷu", (c) => {
      const r = unlockElbow(c.raw, row.id, sideOf(row.side), c.t);
      return { ...r, say: `đã bỏ khoá khuỷu ở ${c.t.toFixed(2)} s (về khuỷu tự nhiên)` };
    });
  };

  private onKey = (e: KeyboardEvent) => {
    if (!this.active || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target;
    if (
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement ||
      (el instanceof HTMLInputElement && !["range", "checkbox"].includes(el.type))
    )
      return;
    const m = MODE_KEY[e.key.toLowerCase() as keyof typeof MODE_KEY];
    if (m) this.setMode(m);
  };
}
