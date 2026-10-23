// Danh sách cảnh ở panel bên trái: nhóm theo tập (`t01-…`), cảnh không theo tập vào nhóm "khác", ô lọc, cảnh đang mở tô cam.

export interface SceneGroup {
  /** `t01`…; `""` là nhóm "khác" */
  key: string;
  names: string[];
}

const EP = /^(t\d+)-/;

/** Nhóm tên cảnh theo tập, giữ thứ tự tên; nhóm "khác" đứng cuối */
export function groupScenes(names: readonly string[]): SceneGroup[] {
  const by = new Map<string, string[]>();
  for (const n of names) {
    const k = EP.exec(n)?.[1] ?? "";
    by.set(k, [...(by.get(k) ?? []), n]);
  }
  return [...by]
    .map(([key, names]) => ({ key, names }))
    .sort((a, b) =>
      !a.key ? 1 : !b.key ? -1 : a.key.localeCompare(b.key, "en", { numeric: true }),
    );
}

/** Lọc theo các từ của `q` (mọi từ đều phải có trong tên, không phân biệt hoa thường) */
export function filterScenes(names: readonly string[], q: string): string[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return words.length
    ? names.filter((n) => words.every((w) => n.toLowerCase().includes(w)))
    : [...names];
}

export class SceneList {
  private names: string[] = [];
  private cur = "";
  /** Nhóm người dùng đã mở / đóng tay: giữ qua các lần vẽ lại */
  private open = new Map<string, boolean>();

  constructor(
    private el: HTMLElement,
    private filter: HTMLInputElement,
    private count: HTMLElement,
    private pick: (name: string) => void,
  ) {
    filter.addEventListener("input", () => this.render());
    filter.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && filter.value) {
        filter.value = "";
        this.render();
      } else if (e.key === "Enter") {
        const first = filterScenes(this.names, filter.value)[0];
        if (first) pick(first);
      }
    });
  }

  set(names: readonly string[]) {
    this.names = [...names];
    this.render();
  }

  /** Cảnh đang mở; nhóm của nó mở ra và dòng của nó cuộn vào khung */
  mark(name: string) {
    this.cur = name;
    this.open.set(EP.exec(name)?.[1] ?? "", true);
    this.render();
    this.el.querySelector(".on")?.scrollIntoView({ block: "nearest" });
  }

  private render() {
    const q = this.filter.value.trim();
    const shown = filterScenes(this.names, q);
    this.count.textContent = q ? `${shown.length}/${this.names.length}` : String(this.names.length);
    this.el.replaceChildren(
      ...groupScenes(shown).map((g) => {
        const d = document.createElement("details");
        d.open = !!q || (this.open.get(g.key) ?? false);
        d.ontoggle = () => {
          if (!q) this.open.set(g.key, d.open);
        };
        const s = document.createElement("summary");
        s.textContent = `${g.key || "khác"} · ${g.names.length}`;
        d.append(
          s,
          ...g.names.map((n) => {
            const b = document.createElement("button");
            b.className = n === this.cur ? "scene on" : "scene";
            b.textContent = g.key ? n.slice(g.key.length + 1) : n;
            b.title = n;
            b.onclick = () => this.pick(n);
            return b;
          }),
        );
        return d;
      }),
    );
  }
}
