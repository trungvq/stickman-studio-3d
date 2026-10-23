// Hàng mốc trên thanh tua (chế độ Dáng tay): mỗi tay của người đang chọn một hàng, thêm hàng Món; dải lần cầm dưới hàng,
// nhấp / kéo mốc, nút ＋ từng hàng. Chỉ vẽ và báo thao tác; sửa JSON ở `keys.ts`, `main.ts` nối hai bên.
import type { KeyRef } from "./keys";

/** Một mốc trên hàng: tròn mốc tay, vòng rỗng mốc chỉ có `hold`, chấm xám mốc `null`, thoi mốc món */
export interface Glyph {
  key: KeyRef;
  t: number;
  shape: "dot" | "ring" | "null" | "diamond";
  title: string;
  on: boolean;
  lock?: boolean;
}

/** Một đoạn dải lần cầm: `item` tay theo đồ (theo mốc, hai tay), `hand` đồ theo tay, `free` tay tự do */
export interface Band {
  from: number;
  to: number;
  kind: "item" | "hand" | "free";
  label?: string;
  title?: string;
}

export interface Lane {
  id: string;
  label: string;
  title?: string;
  on?: boolean;
  /** Nút ＋: `title` nói nó thêm gì */
  add?: string;
  bands: Band[];
  /** Quãng `HOLD_BLEND` ở ranh giới lần cầm: vẽ sọc */
  blends: [number, number][];
  keys: Glyph[];
}

export interface TrackHost {
  /** Nhấp mốc */
  pick(k: KeyRef): void;
  /** Thả mốc đã kéo ở giây `t`; `alt` bắt vào mốc tên */
  move(k: KeyRef, t: number, alt: boolean): void;
  /** Nhãn của giây mới khi đang kéo (`@tên±Δ`) */
  preview(k: KeyRef, t: number, alt: boolean): string;
  /** Giây kéo tới, bám lưới khung tính từ mốc tên của mốc */
  snap(k: KeyRef, t: number): number;
  add(lane: string): void;
  lane(lane: string): void;
}

const pct = (t: number, dur: number) => `${(Math.max(0, Math.min(dur, t)) / (dur || 1)) * 100}%`;
const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export class KeyTrack {
  private dur = 1;
  constructor(
    private els: {
      lanes: HTMLElement;
      labels: HTMLElement;
      adds: HTMLElement;
      playhead: HTMLElement;
      scroller: HTMLElement;
    },
    private host: TrackHost,
  ) {}

  /** `lanes` `null` thì ẩn cả khối; `hint` thay hàng khi chưa chọn tay */
  render(lanes: Lane[] | null, dur: number, hint?: string) {
    this.dur = dur;
    const { lanes: box, labels, adds } = this.els;
    for (const el of [box, labels, adds]) el.replaceChildren();
    const show = !!lanes;
    for (const el of [box, labels, adds]) el.hidden = !show;
    this.els.playhead.hidden = !lanes?.length;
    box.append(this.els.playhead);
    if (!lanes) return;
    if (!lanes.length) {
      const d = document.createElement("div");
      d.className = "lanehint";
      d.textContent = hint ?? "";
      box.append(d);
      labels.append(Object.assign(document.createElement("div"), { className: "lanelabel" }));
      adds.append(Object.assign(document.createElement("div"), { className: "laneadd" }));
      return;
    }
    for (const l of lanes) {
      const lab = document.createElement("button");
      lab.className = "lanelabel";
      lab.classList.toggle("on", !!l.on);
      lab.textContent = l.label;
      lab.title = l.title ?? "";
      lab.onclick = () => this.host.lane(l.id);
      labels.append(lab);
      const add = document.createElement("button");
      add.className = "laneadd";
      add.textContent = "＋";
      add.disabled = !l.add;
      add.title = l.add ?? "";
      add.onclick = () => this.host.add(l.id);
      adds.append(add);
      box.append(this.lane(l));
    }
  }

  /** Vạch giây đang xem; thanh tua cuộn ngang (màn hẹp) thì cuộn cho vạch lọt vào khung */
  playhead(t: number, dur: number) {
    const { playhead, scroller } = this.els;
    playhead.style.left = pct(t, dur);
    if (playhead.hidden || scroller.scrollWidth <= scroller.clientWidth) return;
    const x = playhead.getBoundingClientRect().left - scroller.getBoundingClientRect().left;
    if (x < 16 || x > scroller.clientWidth - 16)
      scroller.scrollLeft += x - scroller.clientWidth / 2;
  }

  private lane(l: Lane) {
    const row = document.createElement("div");
    row.className = "lane";
    row.classList.toggle("on", !!l.on);
    const band = document.createElement("div");
    band.className = "bands";
    for (const b of l.bands) {
      const d = document.createElement("div");
      d.className = `band ${b.kind}`;
      d.style.left = pct(b.from, this.dur);
      d.style.width = `calc(${pct(b.to, this.dur)} - ${pct(b.from, this.dur)})`;
      d.title = b.title ?? "";
      if (b.label) d.innerHTML = `<span>${esc(b.label)}</span>`;
      band.append(d);
    }
    for (const [a, z] of l.blends) {
      const d = document.createElement("div");
      d.className = "blend";
      d.style.left = pct(a, this.dur);
      d.style.width = `calc(${pct(z, this.dur)} - ${pct(a, this.dur)})`;
      d.title = "HOLD_BLEND: bàn tay hoà sang lần cầm mới";
      band.append(d);
    }
    row.append(band);
    for (const g of l.keys) row.append(this.glyph(g));
    return row;
  }

  private glyph(g: Glyph) {
    const b = document.createElement("button");
    b.className = `key ${g.shape}`;
    b.classList.toggle("on", g.on);
    b.classList.toggle("lock", !!g.lock);
    b.style.left = pct(g.t, this.dur);
    b.title = g.title;
    let drag: { x: number; t: number; moved: boolean } | null = null;
    const tip = document.createElement("span");
    tip.className = "keytip";
    b.onpointerdown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      drag = { x: e.clientX, t: g.t, moved: false };
    };
    b.onpointermove = (e) => {
      if (!drag) return;
      if (!drag.moved && Math.abs(e.clientX - drag.x) < 4) return;
      drag.moved = true;
      const r = (b.parentElement as HTMLElement).getBoundingClientRect();
      const raw = ((e.clientX - r.left) / r.width) * this.dur;
      drag.t = this.host.snap(g.key, Math.max(0, Math.min(this.dur, raw)));
      b.style.left = pct(drag.t, this.dur);
      b.classList.add("drag");
      tip.textContent = this.host.preview(g.key, drag.t, e.altKey);
      if (!tip.isConnected) b.append(tip);
    };
    const end = (e: PointerEvent, cancel = false) => {
      const d = drag;
      drag = null;
      tip.remove();
      b.classList.remove("drag");
      if (!d) return;
      if (cancel) b.style.left = pct(g.t, this.dur);
      else if (d.moved) this.host.move(g.key, d.t, e.altKey);
      else this.host.pick(g.key);
    };
    b.onpointerup = (e) => end(e);
    b.onpointercancel = (e) => end(e, true);
    return b;
  }
}
