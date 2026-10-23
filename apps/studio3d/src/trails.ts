// Vệt của bàn tay đang chọn (Dáng tay): cổ tay, khuỷu, tâm món trong `±span` giây quanh giây đang xem, mỗi chấm một khung
// 1/30 s (khoảng cách là tốc độ), chấm to ở mốc, chấm đỏ là khung giật của `check`, vạch tím là cổ tay kẹp. Luồng vệt
// (`trailWorker.ts`) tính sau mỗi thao tác (chậm lại 150 ms), vệt cũ mờ đi trong lúc tính; ở đây chỉ chiếu và vẽ lên lớp
// 2D phủ khung vẽ. README.md § Dáng tay.
import type { HandSide } from "@stickman3d/rig/core";
import * as THREE from "three";
import type { Json, V3 } from "./keys";
import type { Data } from "./runtime";
import { TrailJobs, type TrailOf, type TrailSample, type TrailSnaps } from "./trailCore";
import type { SnapOpts, TrailIn, TrailOut } from "./trailWorker";

/** Việc vệt ở khung đang vẽ */
export interface TrailWant {
  /** Bản JSON thô đang sửa */
  raw: Json;
  /** Dữ liệu đã dựng cảnh và khoá của nó (`cur.data`, `cur.key`) */
  data: Data;
  dataKey: string;
  /** `stickman.snap` của repo; `off` là không đo giật */
  snap?: (Partial<NonNullable<SnapOpts>> & { off?: true; error?: string }) | null;
  /** Quãng lên hình của cảnh (`episodes/`), như `check` đo giật; bỏ trống là cả cảnh */
  spans?: [number, number][];
  id: string;
  side: HandSide;
  t: number;
}

const FPS = 30;
const DELAY = 150;
const SPAN_KEY = "studio3d.trailSpan";
const ON_KEY = "studio3d.trail";
/** Bên giải phẫu: phải, trái — như `SIDE_COLOR` của vệt bản render */
const SIDE_COLOR: Record<HandSide, string> = { right: "#c2185b", left: "#00838f" };
const ITEM = "#e65100";
const JERK = "#ff1744";
const CLAMP = "#aa00ff";

type Kind = "wrist" | "elbow" | "item";

export class Trails {
  private canvas = document.createElement("canvas");
  private hud = document.createElement("div");
  private worker: Worker | null = null;
  private jobs = new TrailJobs();
  private timer = 0;
  /** Dữ liệu đã gửi luồng vệt: khoá `cur.key` và số hiệu ngắn gửi kèm mỗi việc */
  private data: { key: string; id: string } | null = null;
  /** Việc vừa gửi: không gửi lại việc trùng */
  private last = "";
  private want: TrailWant | null = null;
  private live = false;
  private samples: TrailSample[] = [];
  private snaps: TrailSnaps | null = null;
  /** Bản sửa × người × tay của việc đang chờ, của giật đang có: giật của bản cũ không đè lên vệt mới */
  private jobKey = "";
  private snapsKey = "";
  private trailMs = 0;
  private snapMs: number | undefined;
  private of: TrailOf | null = null;
  private stale = false;
  private busy = false;
  private note = "";
  private on = localStorage.getItem(ON_KEY) !== "0";
  private span = Number(localStorage.getItem(SPAN_KEY)) || 2;
  private tNow = 0;

  /** Camera của khung vừa vẽ: vệt mới về thì vẽ lại riêng lớp 2D, không vẽ lại cảnh */
  private camera: THREE.Camera | null = null;

  constructor(private frame: HTMLElement) {
    this.canvas.className = "trails";
    this.hud.className = "trailhud";
    this.hud.hidden = this.canvas.hidden = true;
    frame.append(this.canvas, this.hud);
    this.hud.innerHTML = `<label title="Vệt cổ tay, khuỷu, tâm món của bàn tay đang chọn"><input type="checkbox" data-k="on" /> Vệt</label><label title="Cửa sổ quanh giây đang xem">± <input type="number" data-k="span" min="0.5" max="10" step="0.5" /> s</label><span class="leg"></span><span class="st"></span><span class="other"></span>`;
    const box = this.hud.querySelector<HTMLInputElement>('[data-k="on"]')!;
    const span = this.hud.querySelector<HTMLInputElement>('[data-k="span"]')!;
    box.checked = this.on;
    span.value = String(this.span);
    box.onchange = () => {
      this.on = box.checked;
      localStorage.setItem(ON_KEY, this.on ? "1" : "0");
      if (this.live) this.stop();
      this.update(this.want);
      this.paint();
    };
    span.onchange = () => {
      const v = Math.max(0.5, Math.min(10, Number(span.value) || 2));
      span.value = String(v);
      this.span = v;
      localStorage.setItem(SPAN_KEY, String(v));
      this.update(this.want);
    };
    // phím trên ô số không tới cảnh (← → tua, Space phát)
    span.onkeydown = (e) => e.stopPropagation();
  }

  /**
   * Việc ở khung này (sau khi đặt người); `null` là ẩn (không chọn tay, đang phát, khung soạn kiểu cầm mở). Đổi bản sửa,
   * người × tay, giây hay cửa sổ thì tính lại sau `DELAY` ms; đổi bản sửa hay tay thì vệt cũ mờ đi tới khi có vệt mới
   */
  update(w: TrailWant | null) {
    this.want = w;
    this.hud.hidden = !w;
    this.canvas.hidden = !w || !this.on;
    if (!w || !this.on) {
      if (this.live) this.stop();
      return;
    }
    this.tNow = w.t;
    this.live = true;
    const go = this.jobs.want({ raw: w.raw, id: w.id, side: w.side, t: w.t, span: this.span });
    if (go === "same") return;
    if (go === "restart") {
      // lượt của bản hay tay cũ còn chạy: báo luồng vệt bỏ, kết quả của nó không vẽ lên tay mới
      this.stale = true;
      this.busy = false;
      this.last = "";
      this.worker?.postMessage({ type: "stop", gen: this.jobs.gen } satisfies TrailIn);
    }
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.post(), DELAY);
    this.status();
  }

  private stop() {
    clearTimeout(this.timer);
    this.live = false;
    this.last = "";
    this.busy = false;
    this.worker?.postMessage({ type: "stop", gen: this.jobs.stop() } satisfies TrailIn);
  }

  private post() {
    const w = this.want;
    if (!w || !this.on) return;
    if (!this.worker) {
      this.worker = new Worker(new URL("./trailWorker.ts", import.meta.url), { type: "module" });
      this.worker.onmessage = (e: MessageEvent<TrailOut>) => this.got(e.data);
      this.worker.onerror = (e) => {
        this.note = `luồng vệt hỏng: ${e.message}`;
        this.busy = false;
        this.status();
      };
      this.data = null;
    }
    if (this.data?.key !== w.dataKey) {
      const snap = w.snap && !w.snap.off && !w.snap.error ? (w.snap as SnapOpts) : null;
      this.data = { key: w.dataKey, id: String((Number(this.data?.id) || 0) + 1) };
      this.worker.postMessage({
        type: "data",
        key: this.data.id,
        data: w.data,
        snap,
      } satisfies TrailIn);
      this.last = "";
    }
    const raw = JSON.stringify(w.raw);
    const spans = JSON.stringify(w.spans ?? null);
    const last = `${this.data.id}|${w.id}|${w.side}|${w.t}|${this.span}|${spans}|${raw}`;
    if (last === this.last) return;
    this.last = last;
    this.jobKey = `${this.data.id}|${w.id}|${w.side}|${spans}|${raw}`;
    this.busy = true;
    this.note = "";
    this.worker.postMessage({
      type: "job",
      gen: this.jobs.send(),
      dataKey: this.data.id,
      raw,
      id: w.id,
      side: w.side,
      t: w.t,
      span: this.span,
      fps: FPS,
      ...(w.spans && { spans: w.spans }),
    } satisfies TrailIn);
    this.status();
  }

  private got(m: TrailOut) {
    const of = this.jobs.take(m.gen);
    if (!of) return;
    if (m.type === "error") {
      this.note = `vệt: ${m.message}`;
      this.busy = false;
    } else if (m.type === "trail") {
      this.samples = m.samples;
      this.of = of;
      this.stale = false;
      this.trailMs = m.ms;
      this.snapMs = undefined;
      if (this.snapsKey !== this.jobKey) this.snaps = null;
    } else {
      this.snaps = m.snaps;
      this.snapsKey = this.jobKey;
      this.snapMs = m.ms;
      this.busy = false;
    }
    this.status();
    this.paint();
  }

  private status() {
    const w = this.want;
    const side = w?.side ?? "right";
    const dot = (color: string, cls = "") => `<i class="d ${cls}" style="--c:${color}"></i>`;
    this.hud.querySelector(".leg")!.innerHTML =
      `${dot(SIDE_COLOR[side])}cổ tay ${dot(SIDE_COLOR[side], "o")}khuỷu ${dot(ITEM)}món · ${dot(JERK, "j")}giật <i class="v"></i>kẹp`;
    const st = this.hud.querySelector<HTMLElement>(".st")!;
    const snapOff = !!w?.snap && (w.snap.off || w.snap.error);
    st.textContent = this.note
      ? this.note
      : this.busy
        ? "đang tính…"
        : this.samples.length
          ? `${this.samples.length} mẫu · ${(this.trailMs / 1000).toFixed(2)} s${snapOff ? " · không đo giật (stickman.snap)" : this.snapMs !== undefined ? ` + giật ${(this.snapMs / 1000).toFixed(2)} s` : ""}`
          : "";
    st.classList.toggle("bad", !!this.note);
    const other = this.snaps?.other.filter((o) => Math.abs(o.t - this.tNow) <= this.span + 1e-6);
    const el = this.hud.querySelector<HTMLElement>(".other")!;
    el.textContent = other?.length
      ? `giật khác: ${other.map((o) => `${o.t.toFixed(2)} s ${o.what}`).join(", ")}`
      : "";
  }

  /** Lớp 2D đang hiện (ghép vào ảnh của **Chép view**); ẩn thì `null` */
  get layer(): HTMLCanvasElement | null {
    return this.canvas.hidden ? null : this.canvas;
  }

  /** Vẽ lên lớp 2D theo camera đang xem (sau khi khung three đã vẽ) */
  render(camera: THREE.Camera) {
    this.camera = camera;
    this.paint();
  }

  private paint() {
    const camera = this.camera;
    const c = this.canvas;
    if (!camera) return;
    const w = this.want;
    if (!w || !this.on) return;
    const r = this.frame.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    const [W, H] = [Math.round(r.width * dpr), Math.round(r.height * dpr)];
    if (c.width !== W || c.height !== H) [c.width, c.height] = [W, H];
    const g = c.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!this.samples.length || this.of?.id !== w.id || this.of.side !== w.side) return;
    g.scale(dpr, dpr);
    camera.updateMatrixWorld();
    const v = new THREE.Vector3();
    const scr = (p: V3 | null) => {
      if (!p) return null;
      v.set(p[0] * 0.01, -p[1] * 0.01, -p[2] * 0.01).project(camera);
      if (v.z > 1 || v.z < -1) return null;
      return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height };
    };
    g.globalAlpha = this.stale ? 0.3 : 1;
    const S = this.samples;
    const red: Record<Kind, Set<number>> = {
      wrist: new Set(this.snaps?.wrist),
      elbow: new Set(this.snaps?.elbow),
      item: new Set(),
    };
    const near = (s: TrailSample) => Math.abs(s.t - this.tNow) < 1.5 / FPS;
    const color = { wrist: SIDE_COLOR[w.side], elbow: SIDE_COLOR[w.side], item: ITEM };
    for (const kind of ["item", "elbow", "wrist"] as Kind[]) {
      const P = S.map((s) => scr(s[kind]));
      // đường nối mảnh, đứt ở chỗ không có điểm
      g.strokeStyle = color[kind];
      g.lineWidth = 1.2;
      g.globalAlpha = (this.stale ? 0.3 : 1) * 0.45;
      g.beginPath();
      P.forEach((p, i) => {
        if (!p) return;
        if (i && P[i - 1]) g.lineTo(p.x, p.y);
        else g.moveTo(p.x, p.y);
      });
      g.stroke();
      g.globalAlpha = this.stale ? 0.3 : 1;
      // vạch tím: cổ tay kẹp — ngang qua chấm, vuông góc đường vệt trên hình
      if (kind === "wrist")
        P.forEach((p, i) => {
          if (!p || !S[i].clamped.length || near(S[i])) return;
          const a = P[i - 1] ?? p;
          const b = P[i + 1] ?? p;
          let [dx, dy] = [b.x - a.x, b.y - a.y];
          const n = Math.hypot(dx, dy);
          [dx, dy] = n > 1e-6 ? [dx / n, dy / n] : [1, 0];
          g.strokeStyle = CLAMP;
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(p.x - dy * 6, p.y + dx * 6);
          g.lineTo(p.x + dy * 6, p.y - dx * 6);
          g.stroke();
        });
      // chấm khung, rồi chấm mốc, chấm giật đè lên: tay đứng yên thì các khung sau chồng đúng chỗ
      const dots = P.flatMap((p, i) => {
        const s = S[i];
        if (!p) return [];
        const jerk = s.frame !== undefined && red[kind].has(s.frame);
        // quanh giây đang xem chỉ còn chấm giật: chấm thường che tay
        if (near(s) && !jerk) return [];
        const key =
          s.key === "both" ||
          (s.key === "hand" && kind !== "item") ||
          (s.key === "item" && kind === "item");
        return [{ p, key, jerk, rank: jerk ? 2 : key ? 1 : 0 }];
      });
      dots.sort((a, b) => a.rank - b.rank);
      for (const { p, key, jerk } of dots) {
        g.beginPath();
        g.arc(p.x, p.y, key ? 5 : jerk ? 4.2 : 2.3, 0, Math.PI * 2);
        const hollow = kind === "elbow" && !jerk;
        g.fillStyle = jerk ? JERK : hollow ? "rgb(255 255 255 / 85%)" : color[kind];
        g.fill();
        g.lineWidth = hollow || jerk ? 1.5 : 1;
        g.strokeStyle = jerk ? "#1a1a1a" : hollow ? color[kind] : "rgb(255 255 255 / 85%)";
        g.stroke();
      }
    }
  }
}
