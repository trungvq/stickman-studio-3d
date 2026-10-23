// Giao diện kiểu cầm có tên: danh sách kiểu của món × nhóm trong panel bàn tay, hộp "Lưu thành kiểu mới…" và
// "Chép sang món…" của khung soạn. README.md § Kiểu cầm có tên
import type { StyleEntry } from "./named";

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Danh sách kiểu của lần cầm đang chọn */
export interface StyleModel {
  /** `món@nhóm` của lần cầm (tay phụ ghi thêm) */
  label: string;
  /** `variant` cảnh khai; không khai thì rig chọn (`solved`) */
  current?: string;
  solved?: string;
  entries: StyleEntry[];
  /** Số mốc `hold` của lần cầm sẽ đổi */
  keys: number;
}

/** Danh sách kiểu trong `el`; nhấp một kiểu là `pick(tên)`, "rig chọn" là `pick(undefined)` */
export function renderStyles(
  el: HTMLElement,
  m: StyleModel | null,
  pick: (variant: string | undefined) => void,
) {
  el.hidden = !m;
  if (!m) return el.replaceChildren();
  el.innerHTML = `<div class="sthead"><b>Kiểu cầm</b> <span class="dim">${esc(m.label)} · ${m.keys} mốc \`hold\` của lần cầm</span></div>`;
  const row = (v: string | undefined, name: string, tag: string, note?: string) => {
    const b = document.createElement("button");
    b.className = "style";
    b.classList.toggle("on", v === m.current);
    b.innerHTML = `<span class="sn">${esc(name)}</span><span class="st">${esc(tag)}</span>${note ? `<span class="note">${esc(note)}</span>` : ""}`;
    b.title = v === m.current ? "đang dùng" : `đổi \`variant\` của lần cầm sang ${name}`;
    b.onclick = () => v !== m.current && pick(v);
    return b;
  };
  el.append(
    row(undefined, "rig chọn", m.solved ? `không khai · đang ra ${m.solved}` : "không khai"),
    ...m.entries.map((e) =>
      row(
        e.name,
        e.name,
        e.base ? `kiểu có tên · gốc ${e.base}` : e.authored ? "gốc · đã soạn" : "gốc",
        e.note,
      ),
    ),
  );
}

/** Hộp nổi: `body` là các ô; `check` trả lỗi (chặn nút chính) hay `undefined`; trả giá trị của `read` hay `null` khi thôi */
function modal<T>(
  title: string,
  body: string,
  ok: string,
  read: (d: HTMLDialogElement) => T,
  check: (d: HTMLDialogElement) => string | undefined,
): Promise<T | null> {
  const d = document.createElement("dialog");
  d.className = "named";
  d.innerHTML = `<form method="dialog"><b>${esc(title)}</b>${body}<div class="error" data-n="err"></div><div class="row"><button value="ok" class="primary">${esc(ok)}</button><button value="cancel" formnovalidate>Thôi</button></div></form>`;
  document.body.append(d);
  const err = d.querySelector<HTMLElement>("[data-n=err]")!;
  const okBtn = d.querySelector<HTMLButtonElement>("button[value=ok]")!;
  const sync = () => {
    const e = check(d);
    err.textContent = e ?? "";
    okBtn.disabled = !!e;
  };
  d.addEventListener("input", sync);
  d.addEventListener("change", sync);
  sync();
  d.showModal();
  return new Promise((done) => {
    d.addEventListener("close", () => {
      const v = d.returnValue === "ok" && !check(d) ? read(d) : null;
      d.remove();
      done(v);
    });
  });
}

const field = (d: HTMLDialogElement, n: string) =>
  d.querySelector<HTMLInputElement & HTMLSelectElement>(`[data-n=${n}]`)!;

/**
 * Hộp "Lưu thành kiểu mới…": tên (`problem` kiểm), mô tả, "dùng cho lần cầm này" (`run` là nhãn và số mốc; không có thì
 * ô tắt)
 */
export function saveAsDialog(o: {
  key: string;
  base: string;
  note?: string;
  problem: (name: string) => string | undefined;
  run?: { label: string; keys: number };
}): Promise<{ name: string; note: string; use: boolean } | null> {
  const body = `
    <div class="dim">Từ ${esc(o.key)} đang soạn; biến thể gốc <code>${esc(o.base)}</code></div>
    <label>Tên <input type="text" data-n="name" placeholder="vd: kep-mep-doc" spellcheck="false" autocomplete="off" /></label>
    <label>Mô tả <input type="text" data-n="note" value="${esc(o.note ?? "")}" placeholder="cho người và agent đọc" /></label>
    <label class="use"><input type="checkbox" data-n="use" ${o.run ? "checked" : "disabled"} /> Dùng cho lần cầm này ${
      o.run
        ? `<span class="dim">(${esc(o.run.label)}, ghi \`variant\` vào ${o.run.keys} mốc)</span>`
        : `<span class="dim">(không thấy lần cầm)</span>`
    }</label>`;
  return modal(
    "Lưu thành kiểu mới",
    body,
    "Lưu kiểu mới",
    (d) => ({
      name: field(d, "name").value.trim(),
      note: field(d, "note").value.trim(),
      use: field(d, "use").checked,
    }),
    (d) => o.problem(field(d, "name").value.trim()),
  );
}

/** Hộp "Chép sang món…": món đích (món không cầm được nhóm ở cùng lựa chọn thì tắt, kèm lý do), tên, mô tả */
export function copyDialog(o: {
  key: string;
  name: string;
  note?: string;
  targets: { name: string; why?: string }[];
  problem: (dst: string, name: string) => string | undefined;
}): Promise<{ dst: string; name: string; note: string } | null> {
  const first = o.targets.find((x) => !x.why)?.name ?? "";
  const opts = o.targets
    .map(
      (x) =>
        `<option value="${esc(x.name)}" ${x.why ? "disabled" : ""} ${x.name === first ? "selected" : ""}>${esc(x.name)}${x.why ? ` — ${esc(x.why)}` : ""}</option>`,
    )
    .join("");
  const body = `
    <div class="dim">Chép ${esc(o.key)} (bản đang thấy) sang món khác cùng nhóm: bàn tay dựng lại từ chỗ tiếp xúc của món đích ở cùng lựa chọn</div>
    <label>Món đích <select data-n="dst">${opts}</select></label>
    <label>Tên <input type="text" data-n="name" value="${esc(o.name)}" spellcheck="false" autocomplete="off" /></label>
    <label>Mô tả <input type="text" data-n="note" value="${esc(o.note ?? "")}" /></label>`;
  return modal(
    "Chép sang món",
    body,
    "Chép",
    (d) => ({
      dst: field(d, "dst").value,
      name: field(d, "name").value.trim(),
      note: field(d, "note").value.trim(),
    }),
    (d) =>
      field(d, "dst").value
        ? o.problem(field(d, "dst").value, field(d, "name").value.trim())
        : "không có món nào khác cầm được nhóm này ở cùng lựa chọn",
  );
}
