// Chế độ Thư viện: danh sách hành động nhóm theo gốc ở panel trái, thẻ người, góc máy và thông tin hành động ở panel phải.
// README.md#thư-viện
import {
  filterGroups,
  flatNames,
  groupOpen,
  hideNames,
  libraryRows,
  siblingsOf,
  stepNames,
  type ActionGroup,
} from "./libraryList";
import type { PreviewAngle } from "@stickman3d/rig/core";

export const ANGLE_NAME: Record<PreviewAngle, string> = {
  front: "Trước",
  near: "3/4 phải",
  far: "3/4 trái",
  side: "Nghiêng",
  back: "Sau",
};

const LAYER_NAME = { common: "lớp chung", repo: "repo" } as const;

export interface LibraryCard {
  name: string;
  layer: "common" | "repo";
  stage: string;
  base?: string;
  /** Món mẫu trong tay (`preview.hold`), đã viết thành chữ */
  hold?: string;
  /** Người thứ hai (`preview.partner`), đã viết thành chữ */
  partner?: string;
  duration: number;
  end: "wrap" | "hold";
  /** `mask` khai trong file; không khai thì `channels` là kênh suy từ mốc */
  mask?: string[];
  channels: string[];
  note?: string;
  authoredAt?: string;
  gen?: string;
  variants: string[];
  /** Giây của cảnh xem thử */
  sceneDuration: number;
}

export interface LibraryHost {
  pick(action: string): void;
  /** Hiện hành động chỉ nhép miệng không; `mouth(on)` đổi */
  mouthOn(): boolean;
  mouth(on: boolean): void;
  who(file: string): void;
  angle(a: PreviewAngle): void;
}

function el(tag: string, props: Record<string, unknown> = {}, ...kids: (Node | string)[]) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

const STAGE_NAME: Record<string, string> = {
  stand: "đứng",
  chair: "ngồi ghế",
  floor: "ngồi sàn",
  "sit-down": "ngồi xuống ghế",
  "stand-up": "đứng dậy khỏi ghế",
  counter: "đứng trước quầy",
};

export class LibraryPanel {
  private groups: ActionGroup[] = [];
  private cur = "";
  private layers: Record<string, "common" | "repo"> = {};
  /** Hành động chỉ nhép miệng, ẩn khi `host.mouthOn()` tắt */
  private hidden = new Set<string>();
  /** Nhóm đã bấm mở / gập trong phiên */
  private fold = new Map<string, boolean>();
  private mouthBox = Object.assign(document.createElement("input"), { type: "checkbox" });
  private mouthText = el("span");
  private mouthRow = el(
    "label",
    { className: "lmouth", title: "Hành động chỉ nhép miệng (pnpm lipsync), ẩn mặc định" },
    this.mouthBox,
    this.mouthText,
  );

  constructor(
    private list: HTMLElement,
    private filter: HTMLInputElement,
    private count: HTMLElement,
    private card: HTMLElement,
    private host: LibraryHost,
  ) {
    list.before(this.mouthRow);
    this.mouthBox.onchange = () => host.mouth(this.mouthBox.checked);
    filter.addEventListener("input", () => {
      // gõ tìm thì nhóm có bản khớp mở lại, kể cả nhóm đã bấm gập
      for (const [r, open] of this.fold) if (!open) this.fold.delete(r);
      this.render();
      list.scrollTop = 0;
    });
    filter.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && filter.value) {
        filter.value = "";
        this.render();
      } else if (e.key === "Enter") {
        const first = this.shown()[0];
        if (first) host.pick(first);
      }
    });
  }

  set(
    groups: ActionGroup[],
    layers: Record<string, "common" | "repo">,
    hidden: ReadonlySet<string>,
  ) {
    this.groups = groups;
    this.layers = layers;
    this.hidden = new Set(hidden);
    this.render();
  }

  /** Nhóm sau khi ẩn khẩu hình (hành động đang mở vẫn giữ) */
  private visible(): ActionGroup[] {
    return this.host.mouthOn() ? this.groups : hideNames(this.groups, this.hidden, this.cur);
  }

  private rows(q: string) {
    return libraryRows(filterGroups(this.visible(), q), {
      fold: this.fold,
      cur: this.cur,
      searching: !!q,
    });
  }

  /** Tên ↑ ↓ đi qua theo ô lọc và nhóm đang mở, đúng thứ tự danh sách */
  shown(): string[] {
    return stepNames(this.rows(this.filter.value.trim()), this.cur);
  }

  /** Biến thể cùng gốc với `name` trong danh sách (khẩu hình ẩn thì không tính, trừ khi `name` là khẩu hình) */
  siblings(name: string): string[] {
    return siblingsOf(this.hidden.has(name) ? this.groups : this.visible(), name);
  }

  mark(action: string) {
    if (action !== this.cur) {
      const g = this.groups.find((x) => x.names.includes(action));
      if (g && this.fold.get(g.root) === false) this.fold.delete(g.root);
    }
    this.cur = action;
    this.render();
    this.reveal();
  }

  /** Cả nhóm của dòng đang chọn vào khung (biến thể cùng gốc thấy được), rồi chính dòng ấy */
  reveal() {
    const on = this.list.querySelector(".on");
    on?.closest(".lgroup")?.scrollIntoView({ block: "nearest" });
    on?.scrollIntoView({ block: "nearest" });
  }

  private render() {
    const q = this.filter.value.trim();
    const mouthOn = this.host.mouthOn();
    const vis = this.visible();
    const shown = filterGroups(vis, q);
    const all = flatNames(vis).length;
    const n = flatNames(shown).length;
    this.count.textContent = q ? `${n}/${all}` : String(all);
    const o = { fold: this.fold, cur: this.cur, searching: !!q };
    const action = (name: string) =>
      el(
        "button",
        {
          className: name === this.cur ? "scene on" : "scene",
          title: name,
          onclick: () => this.host.pick(name),
        },
        name,
        ...(this.layers[name] === "repo"
          ? [el("span", { className: "lrepo", title: "file của repo" }, "repo")]
          : []),
      );
    const boxes = shown.map((g) => {
      if (g.names.length === 1) return el("div", { className: "lgroup" }, action(g.names[0]));
      const open = groupOpen(g, o);
      const box = el(
        "div",
        { className: open ? "lgroup many open" : "lgroup many" },
        el(
          "button",
          {
            className: g.names.includes(this.cur) ? "lroot has" : "lroot",
            title: open ? "Gập nhóm" : "Mở nhóm",
            onclick: () => {
              this.fold.set(g.root, !open);
              this.render();
            },
          },
          el("span", { className: "lcaret" }, open ? "▼" : "▶"),
          g.root,
          el("span", { className: "dim" }, ` · ${g.names.length}`),
        ),
      );
      if (open) box.append(...g.names.map(action));
      return box;
    });
    // khẩu hình bị ẩn khớp ô tìm: công tắc ghi số, đang tìm thì thêm một dòng cuối danh sách
    const hid = this.hidden.size
      ? flatNames(filterGroups(this.groups, q)).filter(
          (x) => this.hidden.has(x) && (mouthOn || x !== this.cur),
        ).length
      : 0;
    this.mouthRow.hidden = !this.hidden.size;
    this.mouthBox.checked = mouthOn;
    this.mouthText.textContent = `Hiện khẩu hình (${hid})`;
    this.list.replaceChildren(
      ...boxes,
      ...(q && !mouthOn && hid
        ? [
            el(
              "button",
              { className: "lmore", onclick: () => this.host.mouth(true) },
              `${hid} khẩu hình khớp bị ẩn — `,
              el("u", {}, "hiện"),
            ),
          ]
        : []),
    );
  }

  /** Thẻ panel phải: người, góc máy, thông tin hành động, biến thể cùng gốc */
  renderCard(o: {
    info: LibraryCard | null;
    who: { name: string; layer: "common" | "repo" }[];
    whoOn: string | undefined;
    angle: PreviewAngle;
    error?: string;
  }) {
    const who = document.createElement("select");
    Object.assign(who, { title: "Người diễn", onchange: () => this.host.who(who.value) });
    who.append(
      ...o.who.map((c) =>
        el(
          "option",
          { value: c.name, selected: c.name === o.whoOn },
          `${c.name.replace(/\.json$/, "")}${c.layer === "repo" ? " · repo" : ""}`,
        ),
      ),
    );
    if (!o.who.length) who.append(el("option", { value: "" }, "người mặc định"));
    const angles = el(
      "div",
      { className: "seg", id: "libAngles", title: "Góc máy quanh người (phím 1–5)" },
      ...(Object.entries(ANGLE_NAME) as [PreviewAngle, string][]).map(([a, label]) =>
        el(
          "button",
          { className: a === o.angle ? "on" : "", onclick: () => this.host.angle(a) },
          label,
        ),
      ),
    );
    const kids: (Node | string)[] = [
      el("label", { className: "lrow" }, el("span", { className: "dim" }, "Người"), who),
      angles,
    ];
    const a = o.info;
    if (a) {
      const row = (k: string, ...v: (Node | string)[]) =>
        el("tr", {}, el("td", {}, k), el("td", {}, ...v));
      const ch = a.mask ?? a.channels;
      kids.push(
        el(
          "div",
          { className: "lhead" },
          el("b", {}, a.name),
          el("span", { className: `ltag ${a.layer}` }, LAYER_NAME[a.layer]),
        ),
        el(
          "table",
          { className: "linfo" },
          row(
            "Thời lượng",
            `${a.duration.toFixed(2)} s · ${a.end === "wrap" ? "lặp (wrap)" : "giữ dáng cuối (hold)"}`,
          ),
          row(
            "Kênh",
            ch.length ? ch.join(", ") : "không kênh nào",
            ...(a.mask ? [] : [el("span", { className: "dim" }, " (không khai mask: suy từ mốc)")]),
          ),
          row(
            "Nền",
            `${STAGE_NAME[a.stage] ?? a.stage}${a.base ? ` · ${a.base}` : " · không track nền"}`,
          ),
          ...(a.hold ? [row("Món cầm", a.hold)] : []),
          ...(a.partner ? [row("Người kia", a.partner)] : []),
          row(
            "Soạn",
            a.gen
              ? `bộ sinh ${a.gen}`
              : a.authoredAt
                ? `authoredAt: ${a.authoredAt}`
                : "không nâng (front)",
          ),
          row("Cảnh thử", `${a.sceneDuration.toFixed(2)} s`),
        ),
        a.note
          ? el("p", { className: "lnote" }, a.note)
          : el("p", { className: "lnote dim" }, "Không có note."),
      );
      if (a.variants.length > 1)
        kids.push(
          el(
            "div",
            { className: "lvars" },
            el("span", { className: "dim" }, "Biến thể (V / Shift+V)"),
            ...a.variants.map((v) =>
              el(
                "button",
                { className: v === a.name ? "on" : "", onclick: () => this.host.pick(v) },
                v,
              ),
            ),
          ),
        );
    }
    if (o.error) kids.push(el("p", { className: "lerr" }, o.error));
    this.card.replaceChildren(...kids);
  }
}
