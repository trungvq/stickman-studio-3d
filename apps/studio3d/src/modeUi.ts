// Thẻ lần cầm (nhấp dải lần cầm trên thanh tua): công tắc Tay theo đồ ↔ Đồ theo tay, "cả lần cầm" hay "chỉ từ đây", bảng
// độ lệch từng mốc của phép đổi, Áp / Thôi. README.md § Đổi chế độ lần cầm
import {
  holdRuns,
  type HandSide,
  type HoldModeMax,
  type HoldModeResult,
  type HoldModeRow,
  type HoldRunInfo,
  type SceneRuntime,
} from "@stickman3d/rig/core";
import { marksOf, refAt, type Json } from "./keys";
import {
  cmText,
  convertRun,
  maxOver,
  midMax,
  midRun,
  modeTarget,
  overAngle,
  overPos,
  POS_LIMIT_CM,
  rowOver,
  runAt,
  type ModeAsk,
  type ModeTarget,
} from "./mode";

export interface ModeHost {
  /** Bản đang sửa (JSON thô), runtime dựng từ nó, giây đang xem; `null` khi không sửa được */
  ctx(): {
    raw: Json;
    rt: SceneRuntime;
    /** `rt` chưa dựng từ `raw` (trang đang dựng lại cảnh sau một lần áp): chờ */
    building?: boolean;
    t: number;
    dur: number;
    rebuild: (raw: unknown) => SceneRuntime;
  } | null;
  /** Áp JSON thô mới (một bước lịch sử chung) */
  apply(raw: Json, message: string): boolean;
}

const SIDE: Record<HandSide, string> = { right: "phải", left: "trái" };
const MODE: Record<HoldRunInfo["mode"] | "free", string> = {
  hand: "đồ theo tay",
  keyed: "tay theo đồ (theo mốc)",
  both: "tay theo đồ (hai tay)",
  free: "tay tự do",
};
const TARGET: Record<ModeTarget, string> = { item: "Tay theo đồ", hand: "Đồ theo tay" };
const CLAMP: Record<string, string> = { turn: "x", bend: "g", dev: "l" };

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const n1 = (x: number) => (Math.abs(x) < 0.05 ? "0" : x.toFixed(1));
const bad = (on: boolean, s: string) => (on ? `<span class="over">${s}</span>` : s);
const label = (r: Pick<HoldRunInfo, "item" | "group" | "variant">) =>
  `${r.item}@${r.group}${r.variant ? `/${r.variant}` : ""}`;

/** Lệch lớn nhất: món dời, món quay, tâm nắm dời */
function maxText(m: HoldModeMax) {
  return `món dời ${bad(overPos(m.item.pos), `${cmText(m.item.pos)} cm`)} · quay ${bad(overAngle(m.item.angle), `${n1(m.item.angle)}°`)} · tâm nắm ${bad(overPos(m.hand), `${cmText(m.hand)} cm`)}${m.t !== undefined ? ` <span class="dim">(ở ${m.t.toFixed(2)} s)</span>` : ""}`;
}

/** Khớp cổ tay kẹp trước → sau của các tay */
function clampText(r: HoldModeRow) {
  const sides = [
    ...new Set([...Object.keys(r.clamped.before), ...Object.keys(r.clamped.after)]),
  ] as HandSide[];
  const of = (xs?: string[]) => (xs?.length ? xs.map((x) => CLAMP[x] ?? x).join("") : "—");
  return sides
    .map((s) => {
      const a = of(r.clamped.before[s]);
      const b = of(r.clamped.after[s]);
      return `${sides.length > 1 ? `${SIDE[s][0].toUpperCase()} ` : ""}${a === b ? a : `${a}→${b}`}`;
    })
    .join("; ");
}

function rowHtml(r: HoldModeRow) {
  // hàng đang hoà không tính vào lệch lớn nhất: không tô
  const bad = (on: boolean, x: string) =>
    on && !r.blending ? `<span class="over">${x}</span>` : x;
  const when =
    r.kind === "mid"
      ? `<span class="dim">giữa ${r.t.toFixed(2)}</span>`
      : typeof r.ref === "string"
        ? esc(r.ref)
        : r.t.toFixed(2);
  const hands = Object.entries(r.hand)
    .map(
      ([s, v]) =>
        `${Object.keys(r.hand).length > 1 ? `${SIDE[s as HandSide][0].toUpperCase()} ` : ""}${bad(overPos(v), cmText(v))}`,
    )
    .join(" ");
  const tags = [r.elbowLock && "khoá", r.blending && "hoà"].filter(Boolean) as string[];
  const cls = [r.kind, r.blending ? "mixing" : rowOver(r) ? "rowover" : ""].join(" ");
  const why = [
    r.elbowLock && "bản vá khoá khuỷu ở mốc này",
    r.blending && "đang hoà (HOLD_BLEND), không tính vào lệch lớn nhất",
  ];
  return `<tr class="${cls}" title="${r.t.toFixed(3)} s${why
    .filter(Boolean)
    .map((x) => ` · ${x}`)
    .join("")}">
    <td>${when}${tags.map((x) => ` <span class="tag">${x}</span>`).join("")}</td>
    <td>${r.item ? bad(overPos(r.item.pos), cmText(r.item.pos)) : "—"}</td>
    <td>${r.item ? bad(overAngle(r.item.angle), n1(r.item.angle)) : "—"}</td>
    <td>${hands || "—"}</td>
    <td>${r.phi ? `${n1(r.phi.before)}→${n1(r.phi.after)}` : "—"}</td>
    <td class="clamp">${clampText(r)}</td>
  </tr>`;
}

interface Preview {
  /** JSON thô lúc tính: bản đang sửa đổi thì bỏ */
  base: Json;
  ask: ModeAsk;
  res: HoldModeResult;
  next: Json;
  ms: number;
}

export class ModeCard {
  /** Lần cầm đang mở thẻ: người, tay, một giây trong lần cầm */
  sel: { id: string; side: HandSide; at: number } | null = null;
  private here = false;
  private preview: Preview | null = null;
  private busy: { base: Json; to: ModeTarget } | null = null;
  private error = "";
  /** Phần "Bản vá" mở hay đóng: giữ qua các lần vẽ lại */
  private opsOpen = false;

  constructor(
    private el: HTMLElement,
    private host: ModeHost,
  ) {}

  open(id: string, side: HandSide, at: number) {
    this.sel = { id, side, at };
    this.here = false;
    this.preview = null;
    this.busy = null;
    this.error = "";
    this.render();
  }

  close() {
    this.sel = null;
    this.preview = null;
    this.busy = null;
    this.render();
  }

  /** Lần cầm của thẻ trên bản đang sửa */
  run(): HoldRunInfo | undefined {
    const c = this.host.ctx();
    if (!c || c.building || !this.sel) return undefined;
    return runAt(holdRuns(c.rt, this.sel.id)[this.sel.side], this.sel.at, c.dur);
  }

  /** Vẽ lại theo bản đang sửa: lần cầm không còn thì đóng, bản đổi từ lúc tính thì bỏ bảng */
  render() {
    const c = this.host.ctx();
    if (c?.building && this.sel) {
      // runtime còn là của bản trước: không tra lần cầm trên nó; dựng xong trang vẽ lại thẻ
      this.el.hidden = false;
      this.el.innerHTML = `<div class="cardhead"><b>Lần cầm</b><button data-m="close" title="Đóng thẻ (Esc)">✕</button></div><div class="dim">đang dựng lại cảnh…</div>`;
      this.el.querySelector<HTMLButtonElement>("[data-m=close]")!.onclick = () => this.close();
      return;
    }
    const run = this.run();
    if (!c || !this.sel || !run) {
      this.sel = null;
      this.el.hidden = true;
      return this.el.replaceChildren();
    }
    const { id, side } = this.sel;
    const mid = midRun(run, c.t);
    if (!mid) this.here = false;
    const from = this.here ? refAt(c.t, marksOf(c.raw)) : undefined;
    // bản đang sửa đổi, hay "chỉ từ đây" mà giây đang xem đã dời: bảng không còn đúng
    if (this.preview && (this.preview.base !== c.raw || this.preview.ask.from !== from))
      this.preview = null;
    if (this.busy && this.busy.base !== c.raw) this.busy = null;
    const to = modeTarget(run.mode);
    const carry = run.group === "carry" ? "món treo (`carry`) không đổi chế độ" : "";
    const p = this.preview;
    this.el.hidden = false;
    this.el.innerHTML = `
      <div class="cardhead"><b>Lần cầm ${esc(label(run))}</b><button data-m="close" title="Đóng thẻ (Esc)">✕</button></div>
      <div class="dim">${esc(id)} · tay ${SIDE[side]}${run.lead ? ` (tay phụ — phép đổi đổi lần cầm của tay dẫn ${SIDE[run.lead]})` : ""} · ${run.since.toFixed(2)}–${run.until.toFixed(2)} s · ${MODE[run.mode]}</div>
      <div class="crow"><div class="seg" title="Viết lại JSON của lần cầm sang chế độ kia (docs/11-nhom-cam.md § Đổi chế độ lần cầm)">${(
        ["item", "hand"] as ModeTarget[]
      )
        .map(
          (m) =>
            `<button data-m="to" data-v="${m}" class="${m === to ? "" : "on"}"${m === to && !carry && !this.busy ? "" : " disabled"}>${TARGET[m]}</button>`,
        )
        .join("")}</div></div>
      <div class="crow">
        <label><input type="radio" name="modeScope" data-m="all"${this.here ? "" : " checked"} /> cả lần cầm</label>
        <label title="${mid ? "chèn mốc `regrip` ở giây đang xem, chỉ đổi phần sau" : "giây đang xem không nằm giữa lần cầm"}"><input type="radio" name="modeScope" data-m="here"${this.here ? " checked" : ""}${mid ? "" : " disabled"} /> chỉ từ đây (${c.t.toFixed(2)} s)</label>
      </div>
      ${carry ? `<div class="warn">${esc(carry)}</div>` : ""}
      ${this.busy ? `<div class="dim">đang tính… (dựng lại cảnh vài lần)</div>` : ""}
      ${this.error ? `<div class="error">${esc(this.error)}</div>` : ""}
      ${p ? this.table(p) : ""}`;
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector<T>(`[data-m=${s}]`);
    q("close")!.onclick = () => this.close();
    for (const b of this.el.querySelectorAll<HTMLButtonElement>("[data-m=to]"))
      b.onclick = () => this.compute(b.dataset.v as ModeTarget);
    const scope = (here: boolean) => () => {
      this.here = here;
      // bảng đang hiện là của phạm vi kia: tính lại
      const again = this.preview?.ask.to;
      this.preview = null;
      this.error = "";
      if (again) this.compute(again);
      else this.render();
    };
    q<HTMLInputElement>("all")!.onchange = scope(false);
    q<HTMLInputElement>("here")!.onchange = scope(true);
    const det = this.el.querySelector<HTMLDetailsElement>("details.cjson");
    if (det) det.ontoggle = () => (this.opsOpen = det.open);
    const ok = q<HTMLButtonElement>("apply");
    if (ok) ok.onclick = () => this.apply();
    const no = q<HTMLButtonElement>("cancel");
    if (no)
      no.onclick = () => {
        this.preview = null;
        this.render();
      };
  }

  private table(p: Preview) {
    const s = p.res.scope;
    const keyed = p.res.rows.filter((r) => r.kind === "key");
    const mid = midMax(p.res.rows);
    return `
      <div class="mhead">${esc(s.item)}@${esc(s.group)} · tay dẫn ${SIDE[s.lead]}${s.partner ? ` + tay ${SIDE[s.partner]}` : ""} · ${s.from.toFixed(2)}–${s.until.toFixed(2)} s · ${MODE[s.mode.before]} → <b>${MODE[s.mode.after]}</b></div>
      <div class="dim">Đơn vị: cm, độ; tô đỏ: dời &gt; ${POS_LIMIT_CM} cm, quay &gt; 1°; kẹp (cổ tay ở giới hạn, trước → sau): x xoay, g gập, l lệch; khoá: bản vá khoá khuỷu ở mốc. ${keyed.length} mốc, ${p.res.ops.length} thao tác JSON Patch, ${Math.round(p.ms)} ms.</div>
      <div class="msum${maxOver(p.res.max) ? " bad" : ""}">Ở mốc: ${maxText(p.res.max)}</div>
      ${mid ? `<div class="msum${maxOver(mid) ? " bad" : ""}" title="hàng giữa hai mốc kề, trừ hàng đang hoà">Giữa mốc: ${maxText(mid)}</div>` : ""}
      <div class="msum${maxOver(p.res.outside) ? " bad" : ""}">Ngoài quãng đổi: ${maxText(p.res.outside)}</div>
      ${p.res.rows.some((r) => r.blending) ? `<div class="msum dim">Lúc hoà (<code>HOLD_BLEND</code>, không tính ở trên): ${maxText(p.res.blend)}</div>` : ""}
      <div class="mtable"><table>
        <thead><tr><th>Mốc</th><th title="tâm hộp bao của món dời, cm">Món dời cm</th><th title="món quay, độ">Quay °</th><th title="tâm nắm từng tay dời, cm">Tâm nắm cm</th><th title="góc khuỷu φ tay dẫn trước → sau, độ">φ °</th><th title="khớp cổ tay ở giới hạn trước → sau: x xoay, g gập, l lệch">Kẹp</th></tr></thead>
        <tbody>${p.res.rows.map(rowHtml).join("")}</tbody>
      </table></div>
      ${p.res.notes.map((n) => `<div class="warn">${esc(n)}</div>`).join("")}
      <details class="cjson"${this.opsOpen ? " open" : ""}><summary>Bản vá (JSON Patch)</summary><pre>${esc(JSON.stringify(p.res.ops, null, 2))}</pre></details>
      <div class="crow"><button data-m="apply" class="primary" title="Ghi bản vá vào cảnh đang sửa: một bước lịch sử (Ctrl+Z hoàn tác), chưa lưu">Áp</button><button data-m="cancel">Thôi</button></div>`;
  }

  /** Tính phép đổi sang `to` trên bản đang sửa; để trang kịp vẽ "đang tính…" trước khi dựng lại cảnh */
  private compute(to: ModeTarget) {
    const c = this.host.ctx();
    if (!c || !this.sel) return;
    const run = this.run();
    if (!run) return;
    const base = c.raw;
    const ask: ModeAsk = {
      ...this.sel,
      to,
      ...(this.here && midRun(run, c.t) && { from: refAt(c.t, marksOf(base)) }),
    };
    this.busy = { base, to };
    this.preview = null;
    this.error = "";
    this.render();
    const go = () => {
      const now = this.host.ctx();
      if (!this.busy || this.busy.base !== base || !now || now.raw !== base) return;
      // runtime chưa theo `base`: phép đổi trên runtime cũ sai, chờ trang dựng xong
      if (now.building) return void setTimeout(go, 100);
      const t0 = performance.now();
      try {
        const { res, raw } = convertRun(now.rt, base, ask, now.rebuild);
        this.preview = { base, ask, res, next: raw as Json, ms: performance.now() - t0 };
      } catch (e) {
        this.error = `không đổi được: ${(e as Error).message}`;
      }
      this.busy = null;
      this.render();
    };
    setTimeout(go, 30);
  }

  private apply() {
    const p = this.preview;
    const c = this.host.ctx();
    if (!p || !c || c.raw !== p.base || !this.sel) return;
    const s = p.res.scope;
    const msg = `${s.item}@${s.group}: ${MODE[s.mode.before]} → ${MODE[s.mode.after]}${p.ask.from !== undefined ? ` từ ${p.ask.from}` : ""} (${p.res.ops.length} thao tác) — Ctrl+Z hoàn tác, chưa lưu`;
    this.preview = null;
    // thẻ theo phần vừa đổi (đổi giữa chừng: phần sau giây đổi)
    if (p.ask.from !== undefined) this.sel = { ...this.sel, at: (s.from + s.until) / 2 };
    if (!this.host.apply(p.next, msg)) this.preview = p;
    this.render();
  }
}
