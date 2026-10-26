// Thẻ mốc của thanh tua: `ease` (ô 4 số khi `bezier`), `hold` (món, nhóm, biến thể; kiểu có tên kèm `note`), dáng ngón
// `pose` / `w`, `elbowLock`, chỗ và hướng của mốc món bằng số, nhắc mốc `at` còn hiệu lực lúc người dời kèm nút đổi sang
// mốc thân, JSON thô của mốc chỉ đọc kèm nút chép, xoá mốc.
import type { Ease, HoldPick, V3 } from "./keys";

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
  /** Mốc tay: dáng ngón (`""` là theo hành động), phần hoà `w`; `disabled` là lý do mốc không nhận `pose` */
  shape?: {
    pose: string;
    w?: number;
    options: { v: string; label: string }[];
    disabled?: string;
  };
  /** Mốc tay: khoá khuỷu; `idle` là lý do khoá không có tác dụng ở mốc */
  lock?: { on: boolean; disabled?: string; idle?: string };
  /**
   * Mốc món: tâm món (thế giới rig) và góc `[quay, chúc, nghiêng]` theo thân người cầm, như vẽ ở giây của mốc; `disabled`
   * là lý do không sửa được
   */
  place?: { at: V3; angles: V3; disabled?: string };
  /** Mốc tay `at` (thế giới) còn hiệu lực lúc người dời, quay: lời nhắc kèm nút đổi sang đích theo mốc thân */
  anchor?: string;
  json: string;
  notes: string[];
}

export interface CardHost {
  ease(e: Ease | undefined, bezier?: number[]): void;
  /** `what`: ô vừa đổi (đổi món thì bên gọi chọn nhóm hợp lệ) */
  hold(h: HoldPick | null | undefined, what?: "item" | "group" | "variant"): void;
  lock(on: boolean): void;
  /** `pose` bỏ trống là bỏ dáng; `w` bỏ trống là `1` */
  shape(pose: string | undefined, w: number | undefined): void;
  /** Ô số của mốc món: chỗ hay góc mới (trường không đổi giữ số đúng của `place`) */
  place(to: { at?: V3; angles?: V3 }): void;
  /** Đổi mốc tay `at` sang đích theo mốc thân `hip` + `offset`, hình ở giây của mốc giữ nguyên */
  anchor(): void;
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

const PLACE_AT = ["x", "y", "z"];
const PLACE_ANGLE = [
  ["quay", "quanh trục đứng của người cầm"],
  ["chúc", "quanh trục ngang của người cầm"],
  ["nghiêng", "quanh trục tiến của người cầm"],
] as const;
const fix = (x: number) => Math.round(x * 10) / 10 + 0;

/** Phần "JSON thô" mở hay đóng: giữ qua các lần vẽ lại thẻ */
let jsonOpen = false;

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
      m.shape
        ? `<div class="crow"${m.shape.disabled ? ` title="${esc(m.shape.disabled)}"` : ""}>dáng ngón <select data-c="pose"${m.shape.disabled ? " disabled" : ""}>${opts(
            [{ v: "", label: "theo hành động" }, ...m.shape.options],
            m.shape.pose,
          )}</select><input data-c="w" type="number" step="0.05" min="0" max="1" title="w: phần hoà từ dáng nghỉ (bỏ trống là 1)" value="${m.shape.w ?? ""}" placeholder="w 1"${m.shape.pose && !m.shape.disabled ? "" : " hidden"} /></div>`
        : ""
    }
    ${
      m.lock
        ? `<label class="crow" title="${esc(m.lock.disabled ?? "Khuỷu ở mốc nằm đúng hướng `elbow` (mốc `at` thế giới, mốc khác hệ thân); chưa có `elbow` thì lấy hướng khuỷu đang vẽ")}"><input type="checkbox" data-c="lock"${m.lock.on ? " checked" : ""}${m.lock.disabled ? " disabled" : ""} /> elbowLock</label>
    ${m.lock.idle ? `<div class="warn">${esc(m.lock.idle)}</div>` : ""}`
        : ""
    }
    ${
      m.place
        ? `<div class="crow place"${m.place.disabled ? ` title="${esc(m.place.disabled)}"` : ""}><span>chỗ</span>${PLACE_AT.map(
            (n, i) =>
              `<label>${n} <input data-c="at" data-i="${i}" type="number" step="1" value="${fix(m.place!.at[i])}"${m.place!.disabled ? " disabled" : ""} /></label>`,
          ).join("")}</div>
    <div class="crow place"${m.place.disabled ? ` title="${esc(m.place.disabled)}"` : ""}><span>hướng</span>${PLACE_ANGLE.map(
      ([n, tip], i) =>
        `<label title="${tip}">${n} <input data-c="ang" data-i="${i}" type="number" step="1" value="${fix(m.place!.angles[i])}"${m.place!.disabled ? " disabled" : ""} /></label>`,
    ).join("")}</div>
    <div class="dim">${m.place.disabled ? esc(m.place.disabled) : "tâm món, thế giới rig (x phải, y xuống, z sâu; 250 = 1 m) · hướng: độ, theo thân người cầm"}</div>`
        : ""
    }
    ${
      m.anchor
        ? `<div class="warn">${esc(m.anchor)}</div>
    <div class="crow"><button data-c="anchor" title="Ghi \`to: &quot;hip&quot;\` + \`offset\` thay cho \`at\`, tâm nắm ở giây của mốc giữ nguyên">Đổi sang mốc thân (hip)</button></div>`
        : ""
    }
    ${m.notes.map((n) => `<div class="warn">${esc(n)}</div>`).join("")}
    <details class="cjson"${jsonOpen ? " open" : ""}><summary>JSON thô của mốc</summary><pre>${esc(m.json)}</pre></details>
    <div class="crow"><button data-c="copy">Chép JSON</button><button data-c="del" title="Xoá mốc (Del)">Xoá mốc</button></div>`;
  const q = <T extends HTMLElement>(c: string) => el.querySelector<T>(`[data-c=${c}]`)!;
  const det = el.querySelector<HTMLDetailsElement>(".cjson")!;
  det.ontoggle = () => (jsonOpen = det.open);
  q("close").onclick = () => host.close();
  q("del").onclick = () => host.del();
  if (m.anchor) q("anchor").onclick = () => host.anchor();
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
    for (const c of ["item", "group", "variant"] as const)
      q<HTMLSelectElement>(c).onchange = () => {
        // đổi món hay nhóm thì biến thể cũ không còn nghĩa
        if (c !== "variant") q<HTMLSelectElement>("variant").value = "";
        host.hold(pick(), c);
      };
  }
  if (m.shape && !m.shape.disabled) {
    const w = () => {
      const v = q<HTMLInputElement>("w").value;
      return v === "" ? undefined : Math.max(0, Math.min(1, Number(v) || 0));
    };
    q<HTMLSelectElement>("pose").onchange = (e) =>
      host.shape((e.target as HTMLSelectElement).value || undefined, w());
    q<HTMLInputElement>("w").onchange = () =>
      host.shape(q<HTMLSelectElement>("pose").value || undefined, w());
  }
  if (m.lock)
    q<HTMLInputElement>("lock").onchange = (e) => host.lock((e.target as HTMLInputElement).checked);
  if (m.place && !m.place.disabled) {
    // ô chưa sửa giữ số đúng (ô chỉ hiện một chữ số lẻ)
    const read = (c: "at" | "ang", exact: V3): V3 | undefined => {
      const ins = [...el.querySelectorAll<HTMLInputElement>(`[data-c=${c}]`)];
      const v = ins.map((i, k) => {
        const x = Number(i.value);
        return i.value === "" || !Number.isFinite(x) || x === fix(exact[k]) ? exact[k] : x;
      }) as V3;
      return v.some((x, k) => x !== exact[k]) ? v : undefined;
    };
    for (const i of el.querySelectorAll<HTMLInputElement>("[data-c=at]"))
      i.onchange = () => {
        const at = read("at", m.place!.at);
        if (at) host.place({ at });
      };
    for (const i of el.querySelectorAll<HTMLInputElement>("[data-c=ang]"))
      i.onchange = () => {
        const angles = read("ang", m.place!.angles);
        if (angles) host.place({ angles });
      };
  }
}
