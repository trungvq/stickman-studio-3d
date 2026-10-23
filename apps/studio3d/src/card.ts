// Thẻ mốc của thanh tua: `ease` (ô 4 số khi `bezier`), `hold` (món, nhóm, biến thể; kiểu có tên kèm `note`), `elbowLock`,
// JSON thô của mốc chỉ đọc kèm nút chép, xoá mốc.
import type { Ease, HoldPick } from "./keys";

export const EASES: { v: Ease | ""; label: string }[] = [
  { v: "", label: "smooth (bỏ trống)" },
  { v: "auto", label: "auto — liền vận tốc" },
  { v: "smooth", label: "smooth" },
  { v: "linear", label: "linear" },
  { v: "spring", label: "spring" },
  { v: "bezier", label: "bezier" },
];

export interface CardModel {
  title: string;
  /** Giây và trường `t` như JSON */
  when: string;
  /** "ảnh hưởng tới …" */
  until: string;
  ease: Ease | "";
  bezier: readonly number[];
  /** Mốc không nhận `ease` (`null`): lý do */
  noEase?: string;
  /** Mốc tay: `hold` đang khai (`none` không khai, `null` buông); mốc món thì không có */
  hold?: { mode: "none" | "null" | "set"; item: string; group: string; variant: string };
  items: string[];
  groups: readonly string[];
  variants: (item: string, group: string) => { name: string; note?: string }[];
  /** Mốc tay: khoá khuỷu; `idle` là lý do khoá không có tác dụng ở mốc */
  lock?: { on: boolean; disabled?: string; idle?: string };
  json: string;
  notes: string[];
}

export interface CardHost {
  ease(e: Ease | undefined, bezier?: number[]): void;
  hold(h: HoldPick | null | undefined): void;
  lock(on: boolean): void;
  del(): void;
  close(): void;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const opts = (xs: readonly { v: string; label: string }[], cur: string) =>
  xs
    .map(
      (x) =>
        `<option value="${esc(x.v)}"${x.v === cur ? " selected" : ""}>${esc(x.label)}</option>`,
    )
    .join("");

export function renderCard(el: HTMLElement, m: CardModel | null, host: CardHost) {
  el.hidden = !m;
  if (!m) return el.replaceChildren();
  const h = m.hold;
  const vs = h ? m.variants(h.item, h.group) : [];
  const note = h && vs.find((v) => v.name === h.variant)?.note;
  el.innerHTML = `
    <div class="cardhead"><b>${esc(m.title)}</b><button data-c="close" title="Đóng thẻ (Esc)">✕</button></div>
    <div class="dim">${esc(m.when)} · ${esc(m.until)}</div>
    <label class="crow"${m.noEase ? ` title="${esc(m.noEase)}"` : ""}>ease <select data-c="ease"${m.noEase ? " disabled" : ""}>${opts(EASES, m.ease)}</select></label>
    <div class="crow bez"${m.ease === "bezier" ? "" : " hidden"}>${[0, 1, 2, 3]
      .map(
        (i) =>
          `<input data-c="bz" data-i="${i}" type="number" step="0.05" min="0" max="1" value="${m.bezier[i]}" />`,
      )
      .join("")}</div>
    ${
      h
        ? `<div class="crow">hold <select data-c="hmode">${opts(
            [
              { v: "none", label: "không khai" },
              { v: "null", label: "buông (null)" },
              { v: "set", label: "cầm" },
            ],
            h.mode,
          )}</select></div>
    <div class="crow"${h.mode === "set" ? "" : " hidden"}>
      <select data-c="item" title="Món">${opts(
        m.items.map((x) => ({ v: x, label: x })),
        h.item,
      )}</select>
      <select data-c="group" title="Nhóm">${opts(
        m.groups.map((x) => ({ v: x, label: x })),
        h.group,
      )}</select>
      <select data-c="variant" title="Biến thể">${opts(
        [
          { v: "", label: "(mặc định)" },
          ...vs.map((v) => ({ v: v.name, label: v.note ? `${v.name} — ${v.note}` : v.name })),
        ],
        h.variant,
      )}</select>
    </div>
    ${note ? `<div class="dim">${esc(note)}</div>` : ""}`
        : ""
    }
    ${
      m.lock
        ? `<label class="crow" title="${esc(m.lock.disabled ?? "Khuỷu ở mốc nằm đúng hướng `elbow` (thế giới); chưa có `elbow` thì lấy hướng khuỷu đang vẽ")}"><input type="checkbox" data-c="lock"${m.lock.on ? " checked" : ""}${m.lock.disabled ? " disabled" : ""} /> elbowLock</label>
    ${m.lock.idle ? `<div class="warn">${esc(m.lock.idle)}</div>` : ""}`
        : ""
    }
    ${m.notes.map((n) => `<div class="warn">${esc(n)}</div>`).join("")}
    <details class="cjson"><summary>JSON thô của mốc</summary><pre>${esc(m.json)}</pre></details>
    <div class="crow"><button data-c="copy">Chép JSON</button><button data-c="del" title="Xoá mốc (Del)">Xoá mốc</button></div>`;
  const q = <T extends HTMLElement>(c: string) => el.querySelector<T>(`[data-c=${c}]`)!;
  q("close").onclick = () => host.close();
  q("del").onclick = () => host.del();
  q("copy").onclick = async () => {
    await navigator.clipboard?.writeText(m.json);
    q("copy").textContent = "Đã chép";
  };
  const bez = () =>
    [...el.querySelectorAll<HTMLInputElement>("[data-c=bz]")].map((i) =>
      Math.max(0, Math.min(1, Number(i.value) || 0)),
    );
  q<HTMLSelectElement>("ease").onchange = (e) => {
    const v = (e.target as HTMLSelectElement).value as Ease | "";
    host.ease(v || undefined, v === "bezier" ? [...m.bezier] : undefined);
  };
  for (const i of el.querySelectorAll<HTMLInputElement>("[data-c=bz]"))
    i.onchange = () => host.ease("bezier", bez());
  if (h) {
    const pick = (): HoldPick => ({
      item: q<HTMLSelectElement>("item").value,
      group: q<HTMLSelectElement>("group").value,
      ...(q<HTMLSelectElement>("variant").value && {
        variant: q<HTMLSelectElement>("variant").value,
      }),
    });
    q<HTMLSelectElement>("hmode").onchange = (e) => {
      const v = (e.target as HTMLSelectElement).value;
      host.hold(v === "none" ? undefined : v === "null" ? null : pick());
    };
    for (const c of ["item", "group", "variant"])
      q<HTMLSelectElement>(c).onchange = () => {
        // đổi món hay nhóm thì biến thể cũ không còn nghĩa
        if (c !== "variant") q<HTMLSelectElement>("variant").value = "";
        host.hold(pick());
      };
  }
  if (m.lock)
    q<HTMLInputElement>("lock").onchange = (e) => host.lock((e.target as HTMLInputElement).checked);
}
