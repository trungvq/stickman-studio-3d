// Trang soi bộ sinh: form tham số dựng từ `GEN_PAGES[kiểu].params` (panel trái, ngăn kéo khi hẹp) và thẻ kết quả — trạng
// thái lần chạy, bảng tự kiểm (bấm dòng tới giây ấy), dòng in (panel phải). README.md#bộ-sinh
import type { GenPage, GenParam } from "@stickman3d/cli/gen-pages";
import { enumText, fieldsOf, type GenField, type GenValue, type GenView } from "./genPage";

/** Một dòng tự kiểm của `/api/gen` (`checkRows` của CLI) */
export interface GenCheck {
  rule: string;
  label: string;
  level: string;
  msg: string;
  limit?: string;
  t?: number;
  group?: string;
  sub?: boolean;
}

/** Kết quả gần nhất của trang */
export interface GenResult {
  busy?: boolean;
  /** Lỗi tham số, lỗi tìm slot hay lỗi dựng sân khấu */
  error?: string;
  errorLines?: string[];
  ok?: boolean;
  name?: string;
  checks?: GenCheck[];
  lines?: string[];
  ms?: number;
  /** Khối riêng của bộ sinh dưới bảng tự kiểm (`walk`: biểu đồ số đo đi) */
  chart?: Node;
}

export interface GenHost {
  kind(k: string): void;
  set(key: string, v: GenValue | undefined): void;
  reset(): void;
  seek(t: number): void;
  /** Nút **Cận**: khung quanh vùng tương tác / về camera cảnh */
  close(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

const num = (v: GenValue | undefined) => (typeof v === "number" ? v : Number(v));
const comma = (v: number) => String(+v.toFixed(2)).replace(".", ",");
const LEVEL: Record<string, string> = { ok: "đạt", "cảnh báo": "cảnh báo", lỗi: "lỗi" };

export class GenPanel {
  /** Khoá các ô đang hiện: đổi thì dựng lại form (luật `when`) */
  private keys = "";
  /** Giây của dòng tự kiểm vừa bấm */
  private picked: number | null = null;
  /** Trang và tham số của lần dựng gần nhất: ô nhập sai mất focus thì về giá trị này */
  private last: { pages: Record<string, GenPage>; v: GenView } | null = null;
  private reset: HTMLButtonElement | null = null;
  /** Người và hành động đang chọn: `auto(p, who)` của trang giải số theo chúng */
  who: Record<string, unknown> = {};

  constructor(
    private form: HTMLElement,
    private card: HTMLElement,
    private host: GenHost,
  ) {}

  /** Form của trang `v.kind`; ô đang hiện không đổi thì chỉ cập nhật giá trị, giữ ô đang gõ */
  renderForm(pages: Record<string, GenPage>, v: GenView, force = false) {
    this.last = { pages, v };
    const page = pages[v.kind];
    const auto = page.auto?.(v.values, this.who) ?? {};
    const fields = fieldsOf(page.params, v.values);
    const keys = `${v.kind}|${fields.map((f) => f.param.key).join(",")}`;
    if (!force && keys === this.keys && this.reset) {
      for (const f of fields) this.sync(f, auto[f.param.key]);
      this.reset.disabled = !Object.keys(v.values).length;
      return;
    }
    this.keys = keys;
    const pick = el(
      "select",
      { title: "Bộ sinh" },
      ...Object.entries(pages).map(([k, g]) =>
        el("option", { value: k, selected: k === v.kind }, `${g.label} · ${k}`),
      ),
    );
    pick.onchange = () => this.host.kind(pick.value);
    const kinds = el(
      "div",
      { className: "gfield gkinds" },
      el("div", { className: "glabel" }, el("span", {}, "Bộ sinh")),
      pick,
    );
    const reset = (this.reset = el(
      "button",
      {
        className: "greset",
        title: "Mọi tham số về mặc định",
        disabled: !Object.keys(v.values).length,
        onclick: () => this.host.reset(),
      },
      "Mặc định",
    ));
    this.form.replaceChildren(kinds, ...fields.map((f) => this.field(f, auto[f.param.key])), reset);
  }

  private field(f: GenField, auto: number | string | undefined): HTMLElement {
    const x = f.param;
    const box = el("div", {
      className: `gfield ${x.type}${f.changed ? " changed" : ""}`,
      title: x.unit ? `${x.key} · ${x.unit}` : x.key,
    });
    box.dataset.key = x.key;
    const set = (v: GenValue | undefined) => this.host.set(x.key, v);
    if (x.type === "bool") {
      const cb = el("input", { type: "checkbox", checked: f.value === true || f.value === "1" });
      cb.addEventListener("change", () => set(cb.checked));
      box.append(el("label", { className: "glabel" }, cb, el("span", {}, x.label)));
      return box;
    }
    const head = el("div", { className: "glabel" }, el("span", {}, x.label));
    box.append(head);
    if (x.type === "enum") {
      const sel = el(
        "select",
        {},
        ...(x.values ?? []).map((v) =>
          el("option", { value: v, selected: v === f.value }, enumText(x, v)),
        ),
      );
      sel.onchange = () => set(sel.value);
      box.append(sel);
      return box;
    }
    const canAuto = x.default === "auto";
    const row = el("div", { className: "ginputs" });
    if (canAuto) {
      const cb = el("input", { type: "checkbox", checked: f.auto, className: "gauto" });
      cb.addEventListener("change", () => {
        if (cb.checked) set("auto");
        else set(auto ?? (x.type === "point" ? "0,0,0" : mid(x)));
      });
      head.append(el("label", { className: "gautol", title: "Bộ sinh tự chọn" }, cb, "tự động"));
    }
    if (x.type === "number") {
      const range = el("input", {
        type: "range",
        min: String(x.min ?? 0),
        max: String(x.max ?? 100),
        step: String(x.step ?? 1),
      });
      const box2 = el("input", {
        type: "number",
        min: String(x.min ?? ""),
        max: String(x.max ?? ""),
        step: String(x.step ?? "any"),
        inputMode: "decimal",
      });
      range.oninput = () => {
        this.mark(box, "");
        box2.value = range.value;
        set(Number(range.value));
      };
      box2.oninput = () => {
        const bad = numberProblem(x, box2.value);
        this.mark(box, bad);
        if (bad) return;
        range.value = box2.value;
        set(Number(box2.value));
      };
      box2.addEventListener("blur", () => this.restore(box));
      row.append(range, box2);
    } else {
      // point: ba ô x, y, z
      for (const i of [0, 1, 2]) {
        const inp = el("input", { type: "number", step: "any", inputMode: "decimal" });
        inp.dataset.i = String(i);
        inp.oninput = () => {
          const all = [...row.querySelectorAll<HTMLInputElement>("input")].map((e) => e.value);
          const bad = all.some((s) => numberProblem(x, s)) ? "cần đủ ba số x, y, z" : "";
          this.mark(box, bad);
          if (!bad) set(all.map((s) => String(Number(s))).join(","));
        };
        // sang ô khác của cùng điểm thì chưa trả về
        inp.addEventListener("blur", (e) => {
          if (!row.contains((e as FocusEvent).relatedTarget as Node | null)) this.restore(box);
        });
        row.append(inp);
      }
    }
    box.append(row, el("div", { className: "gerr", hidden: true }));
    if (x.unit) box.append(el("div", { className: "gunit dim" }, x.unit));
    this.sync(f, auto, box);
    return box;
  }

  /** Ô số đang gõ sai: viền đỏ và dòng báo dưới ô kèm giá trị đang dùng — tham số, URL, cảnh giữ giá trị ấy */
  private mark(box: HTMLElement, bad: string) {
    box.classList.toggle("bad", !!bad);
    const err = box.querySelector<HTMLElement>(".gerr")!;
    const now = bad ? this.inUse(box.dataset.key!)?.shown : undefined;
    err.textContent = bad && `${bad} · đang dùng ${now ?? "?"}; rời ô thì ô về số ấy`;
    err.hidden = !bad;
  }

  /** Ô và giá trị đang dùng (số tự động nếu đang `auto`) của tham số `key` ở lần dựng gần nhất */
  private inUse(key: string) {
    if (!this.last) return;
    const { pages, v } = this.last;
    const page = pages[v.kind];
    const f = fieldsOf(page.params, v.values).find((g) => g.param.key === key);
    if (!f) return;
    const auto = page.auto?.(v.values, this.who)?.[key];
    return { f, auto, shown: String(f.auto ? auto : f.value).replaceAll(",", ", ") };
  }

  /** Ô sai mất focus: ô về giá trị đang dùng */
  private restore(box: HTMLElement) {
    if (!box.classList.contains("bad")) return;
    const now = this.inUse(box.dataset.key!);
    this.mark(box, "");
    if (now) this.sync(now.f, now.auto, box, true);
  }

  /** Giá trị của một ô theo `f` (ô đang gõ giữ chữ của người gõ, trừ khi `all`) */
  private sync(f: GenField, auto: number | string | undefined, box?: HTMLElement, all = false) {
    const x = f.param;
    box ??= this.form.querySelector<HTMLElement>(`.gfield[data-key="${x.key}"]`) ?? undefined;
    if (!box) return;
    box.classList.toggle("changed", f.changed);
    const typing = (e: Element) => !all && e === document.activeElement;
    if (x.type === "bool") {
      const cb = box.querySelector<HTMLInputElement>("input")!;
      cb.checked = f.value === true || f.value === "1";
      return;
    }
    if (x.type === "enum") {
      const sel = box.querySelector<HTMLSelectElement>("select")!;
      if (!typing(sel)) sel.value = String(f.value);
      return;
    }
    const cb = box.querySelector<HTMLInputElement>("input.gauto");
    if (cb) cb.checked = f.auto;
    const shownValue = f.auto ? auto : f.value;
    const inputs = [...box.querySelectorAll<HTMLInputElement>(".ginputs input")];
    for (const inp of inputs) inp.disabled = f.auto;
    if (x.type === "number") {
      const n = num(shownValue);
      for (const inp of inputs) if (!typing(inp)) inp.value = Number.isFinite(n) ? String(n) : "";
    } else {
      const parts = shownValue === undefined ? [] : String(shownValue).split(",");
      inputs.forEach((inp, i) => {
        if (!typing(inp)) inp.value = parts[i] ?? "";
      });
    }
  }

  /** Thẻ kết quả: trạng thái, bảng tự kiểm (dòng có giây bấm được), dòng in; `close`: camera đang ở cận vùng tương tác */
  renderCard(r: GenResult, page: GenPage, kind: string, close = false) {
    const kids: Node[] = [];
    const head = el(
      "div",
      { className: "lhead" },
      el("b", {}, `${page.label} · gen ${kind}`),
      el(
        "button",
        {
          className: `gclose${close ? " on" : ""}`,
          title: close
            ? "Về camera cảnh của góc máy đang chọn"
            : "Cận vùng tương tác (tay, món cầm, chỗ chén, hông) theo hướng của góc máy đang chọn",
          onclick: () => this.host.close(),
        },
        "Cận",
      ),
    );
    kids.push(head);
    if (r.busy) kids.push(el("div", { className: "gstat busy" }, "Đang chạy bộ sinh…"));
    if (r.error) {
      kids.push(
        el(
          "div",
          { className: "gstat bad" },
          el("b", {}, "Không sinh được"),
          el(
            "pre",
            { className: "lerr" },
            [r.error, ...(r.errorLines ?? []).filter((l) => l !== r.error)].join("\n"),
          ),
        ),
      );
    } else if (r.checks) {
      const bad = r.checks.filter((c) => c.level === "lỗi").length;
      const warn = r.checks.filter((c) => c.level === "cảnh báo").length;
      kids.push(
        el(
          "div",
          { className: `gstat ${r.ok ? "ok" : "bad"}${r.busy ? " stale" : ""}` },
          el("b", {}, r.ok ? "Tự kiểm đạt" : "Tự kiểm không đạt"),
          ` · ${bad} lỗi · ${warn} cảnh báo`,
          ...(r.ms !== undefined
            ? [el("span", { className: "dim" }, ` · ${comma(r.ms / 1000)} s`)]
            : []),
        ),
        el(
          "div",
          { className: "gname dim", title: "Hành động sinh ra (chạy khô, không ghi actions/)" },
          r.name ?? "",
        ),
        el(
          "div",
          { className: "gchecks" },
          el("div", { className: "dim gchint" }, "Tự kiểm — bấm dòng có giây để tới giây ấy"),
          ...r.checks.map((c) => this.check(c)),
        ),
      );
      if (r.chart) kids.push(r.chart);
    }
    if (r.lines?.length)
      kids.push(
        el(
          "details",
          { className: "glines" },
          el("summary", {}, "Dòng in của bộ sinh"),
          el("pre", {}, r.lines.join("\n")),
        ),
      );
    this.card.replaceChildren(...kids);
  }

  private check(c: GenCheck): HTMLElement {
    const lvl = c.sub
      ? c.level === "bỏ qua"
        ? "skip"
        : "bad"
      : c.level === "ok"
        ? "ok"
        : c.level === "lỗi"
          ? "bad"
          : "warn";
    const has = c.t !== undefined;
    const b = el(
      has ? "button" : "div",
      {
        className: `gcheck ${lvl}${c.sub ? " sub" : ""}${has && this.picked === c.t ? " on" : ""}`,
        title: has ? `Tới giây ${c.t} và dừng phát` : "",
      },
      el(
        "span",
        { className: "gcrow" },
        el(
          "span",
          { className: "gclvl" },
          c.sub ? (c.level === "bỏ qua" ? "bỏ qua" : "mới") : (LEVEL[c.level] ?? c.level),
        ),
        el("span", { className: "gclabel" }, c.sub ? (c.group ?? "check") : c.label),
        ...(has ? [el("span", { className: "gct" }, `${comma(c.t!)} s`)] : []),
      ),
      el("span", { className: "gcmsg" }, c.msg),
      ...(c.limit ? [el("span", { className: "gclim dim" }, `ngưỡng: ${c.limit}`)] : []),
    );
    if (has)
      b.addEventListener("click", () => {
        this.picked = c.t!;
        for (const o of this.card.querySelectorAll(".gcheck.on")) o.classList.remove("on");
        b.classList.add("on");
        this.host.seek(c.t!);
      });
    return b;
  }

  /** Bỏ đánh dấu dòng đã bấm (lần chạy mới) */
  unpick() {
    this.picked = null;
  }
}

/** Lý do chữ trong ô số không dùng được (trống, không phải số, ngoài `min`…`max`); `""` là dùng được */
export function numberProblem(x: GenParam, raw: string): string {
  const n = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(n)) return "chưa phải số";
  if ((x.min !== undefined && n < x.min) || (x.max !== undefined && n > x.max))
    return `phải trong ${x.min ?? "…"} … ${x.max ?? "…"}`;
  return "";
}

/** Giữa tầm, theo bước của tham số: chỗ bắt đầu khi bỏ `tự động` mà trang không biết số tự động */
function mid(x: GenParam): number {
  const lo = x.min ?? 0;
  const hi = x.max ?? lo;
  const step = x.step ?? 1;
  return lo + Math.round((hi - lo) / 2 / step) * step;
}
