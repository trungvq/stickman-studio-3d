// Thẻ clip của hàng track (Dáng tay): hành động, `start`, `blend`, `mask`, `note` của hành động, tay clip chạm; Soi gương,
// Xoá clip, Đổi hành động (danh sách hành động cùng mask).

export interface ClipCardModel {
  title: string;
  action: string;
  start: string;
  blend: string;
  mask: string;
  /** Tay giải phẫu clip chạm ở giây đang xem (góc cánh tay, bàn tay) */
  touch: string;
  /** `mirror` của clip */
  mirror: boolean;
  note?: string;
  /** Hành động thay được (`compatibleActions`), cho ô chọn của nút Đổi hành động */
  options: string[];
  /** Clip cuối của track: xoá là bỏ cả track */
  last: boolean;
}

export interface ClipCardHost {
  del(): void;
  swap(action: string): void;
  mirror(on: boolean): void;
  close(): void;
}

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function renderClipCard(el: HTMLElement, m: ClipCardModel | null, host: ClipCardHost) {
  el.hidden = !m;
  if (!m) return el.replaceChildren();
  const row = (k: string, v: string) =>
    `<div class="kv"><span class="dim">${k}</span> ${esc(v)}</div>`;
  el.innerHTML = `
    <div class="cardhead"><b>${esc(m.title)}</b><button data-c="close" title="Đóng thẻ (Esc)">✕</button></div>
    ${row("hành động", m.action || "(clip rỗng: nhả track)")}
    ${row("start", m.start)}
    ${row("blend", m.blend)}
    ${row("mask", m.mask)}
    ${row("chạm", m.touch)}
    <label title="Phát clip như soi gương: tay chân phải ↔ trái, nghiêng thân, lắc và nghiêng đầu đổi chiều"><input type="checkbox" data-c="mirror"${m.mirror ? " checked" : ""} /> Soi gương</label>
    ${m.note ? `<div class="dim">${esc(m.note)}</div>` : ""}
    <div class="crow"><select data-c="pick" title="Hành động ghi cùng các kênh"${m.options.length ? "" : " disabled"}>
      <option value="">${m.options.length ? "(chọn hành động cùng mask)" : "không có hành động cùng mask"}</option>
      ${m.options.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join("")}
    </select><button data-c="swap" disabled>Đổi hành động</button></div>
    <div class="crow"><button data-c="del" title="${m.last ? "Clip cuối của track: xoá là bỏ cả track" : "Xoá clip khỏi track"}">Xoá clip</button>${m.last ? `<span class="dim">clip cuối: bỏ cả track</span>` : ""}</div>`;
  const q = <T extends HTMLElement>(c: string) => el.querySelector<T>(`[data-c=${c}]`)!;
  q("close").onclick = () => host.close();
  q("del").onclick = () => host.del();
  q<HTMLInputElement>("mirror").onchange = (e) =>
    host.mirror((e.target as HTMLInputElement).checked);
  const pick = q<HTMLSelectElement>("pick");
  pick.onchange = () => (q<HTMLButtonElement>("swap").disabled = !pick.value);
  q("swap").onclick = () => pick.value && host.swap(pick.value);
}
