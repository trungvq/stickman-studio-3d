import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GEN_PAGES } from "@stickman3d/cli/gen-pages";
import { genParams, setValue, writeGen, type GenView } from "./genPage";
import { GenQueue } from "./genQueue";
import { GenPanel, numberProblem } from "./genUi";

/** DOM tối thiểu cho `GenPanel`: phần tử, lớp, `dataset`, sự kiện, bộ chọn `tag.lớp[data-k="v"]` và con cháu */
class FakeEl {
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  dataset: Record<string, string> = {};
  className = "";
  hidden = false;
  disabled = false;
  value = "";
  checked = false;
  textContent = "";
  private on: Record<string, ((e: unknown) => void)[]> = {};
  [k: string]: unknown;
  constructor(public tagName: string) {}
  get classList() {
    const list = () => this.className.split(/\s+/).filter(Boolean);
    const put = (a: string[]) => (this.className = a.join(" "));
    return {
      contains: (c: string) => list().includes(c),
      add: (c: string) => put([...new Set([...list(), c])]),
      remove: (c: string) => put(list().filter((x) => x !== c)),
      toggle: (c: string, on?: boolean) =>
        (on ?? !list().includes(c))
          ? put([...new Set([...list(), c])])
          : put(list().filter((x) => x !== c)),
    };
  }
  append(...kids: (FakeEl | string)[]) {
    for (const k of kids) {
      if (typeof k === "string") continue;
      k.parent = this;
      this.children.push(k);
    }
  }
  replaceChildren(...kids: FakeEl[]) {
    this.children = [];
    this.append(...kids);
  }
  contains(o: unknown): boolean {
    return o === this || this.children.some((c) => c.contains(o));
  }
  addEventListener(type: string, f: (e: unknown) => void) {
    (this.on[type] ??= []).push(f);
  }
  fire(type: string, e: unknown = {}) {
    (this[`on${type}`] as (() => void) | undefined)?.();
    for (const f of this.on[type] ?? []) f(e);
  }
  private all(): FakeEl[] {
    return this.children.flatMap((c) => [c, ...c.all()]);
  }
  private matches(sel: string): boolean {
    const m = /^([a-z]*)((?:\.[\w-]+)*)(?:\[data-([\w-]+)="([^"]*)"\])?$/.exec(sel)!;
    const [, tag, cls, dk, dv] = m;
    return (
      (!tag || this.tagName === tag) &&
      cls
        .split(".")
        .filter(Boolean)
        .every((c) => this.classList.contains(c)) &&
      (!dk || this.dataset[dk] === dv)
    );
  }
  querySelectorAll(sel: string): FakeEl[] {
    const parts = sel.trim().split(/\s+/);
    const last = parts.pop()!;
    return this.all().filter((e) => {
      if (!e.matches(last)) return false;
      let i = parts.length - 1;
      for (let p = e.parent; p && p !== this.parent && i >= 0; p = p.parent)
        if (p.matches(parts[i])) i--;
      return i < 0;
    });
  }
  querySelector(sel: string): FakeEl | null {
    return this.querySelectorAll(sel)[0] ?? null;
  }
}

const doc = { activeElement: null as FakeEl | null, createElement: (t: string) => new FakeEl(t) };

beforeEach(() => {
  doc.activeElement = null;
  (globalThis as { document?: unknown }).document = doc;
});
afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
});

/** Trang soi tối thiểu: form, giá trị, URL và tham số gửi `/api/gen` đi theo thao tác như `main.ts` */
function page(kind: string) {
  const form = new FakeEl("div");
  const v: GenView = { kind, values: {} };
  const sent: Record<string, unknown>[] = [];
  const panel: GenPanel = new GenPanel(
    form as unknown as HTMLElement,
    new FakeEl("section") as unknown as HTMLElement,
    {
      kind() {},
      set(k, x) {
        v.values = setValue(GEN_PAGES[kind].params, v.values, k, x);
        sent.push(genParams(v.values, "near"));
        panel.renderForm(GEN_PAGES, v);
      },
      reset() {
        v.values = {};
        sent.push(genParams(v.values, "near"));
        panel.renderForm(GEN_PAGES, v, true);
      },
      seek() {},
      close() {},
    },
  );
  panel.renderForm(GEN_PAGES, v, true);
  const field = (key: string) => form.querySelector(`.gfield[data-key="${key}"]`)!;
  const url = () => writeGen(new URLSearchParams(), v, GEN_PAGES).toString();
  return { form, v, sent, panel, field, url, reset: () => form.querySelector(".greset")! };
}

describe("form của trang soi", () => {
  it("**Mặc định** bật khi có ô khác mặc định, tắt lại khi về mặc định — cả khi form không dựng lại", () => {
    const p = page("sit");
    expect(p.reset().disabled).toBe(true);
    const num = p.field("seat").querySelectorAll(".ginputs input")[1];
    num.value = "100";
    num.fire("input");
    expect(p.v.values).toEqual({ seat: 100 });
    expect(p.reset().disabled).toBe(false);
    p.reset().fire("click");
    expect(p.v.values).toEqual({});
    expect(p.reset().disabled).toBe(true);
  });

  it("ô số gõ ngoài tầm hay xoá trắng: báo dưới ô, không đổi tham số; mất focus thì về giá trị đang dùng", () => {
    const p = page("sit");
    const seat = p.field("seat");
    const num = seat.querySelectorAll(".ginputs input")[1];
    num.value = "100";
    num.fire("input");
    const before = { url: p.url(), sent: p.sent.length };
    expect(before.url).toBe("gen=sit&seat=100");
    for (const typed of ["500", ""]) {
      doc.activeElement = num;
      num.value = typed;
      num.fire("input");
      expect(seat.classList.contains("bad")).toBe(true);
      const err = seat.querySelector(".gerr")!;
      expect(err.hidden).toBe(false);
      expect(err.textContent).toBe(
        `${typed ? "phải trong 40 … 160" : "chưa phải số"} · đang dùng 100; rời ô thì ô về số ấy`,
      );
      expect(p.v.values).toEqual({ seat: 100 });
      expect(p.url()).toBe(before.url);
      expect(p.sent.length).toBe(before.sent);
      doc.activeElement = null;
      num.fire("blur");
      expect(num.value).toBe("100");
      expect(seat.classList.contains("bad")).toBe(false);
      expect(err.hidden).toBe(true);
    }
    expect(p.sent.at(-1)).toEqual({ seat: 100, angle: "near" });
  });

  it("điểm: ô trống báo lỗi, sang ô khác cùng điểm thì giữ chữ, rời điểm thì về giá trị đang dùng", () => {
    const p = page("pour");
    const cupAt = p.field("cupAt");
    const auto = cupAt.querySelector("input.gauto")!;
    auto.checked = false;
    auto.fire("change");
    const [x, y] = cupAt.querySelectorAll(".ginputs input");
    const was = x.value;
    expect(p.url()).toMatch(/cupAt=/);
    x.value = "";
    x.fire("input");
    expect(cupAt.classList.contains("bad")).toBe(true);
    x.fire("blur", { relatedTarget: y });
    expect(x.value).toBe("");
    x.fire("blur", { relatedTarget: null });
    expect(x.value).toBe(was);
    expect(cupAt.classList.contains("bad")).toBe(false);
  });

  it("`numberProblem`: rỗng, chữ, ngoài tầm là sai; trong tầm là đúng", () => {
    const seat = GEN_PAGES.sit.params.find((x) => x.key === "seat")!;
    expect(numberProblem(seat, "")).not.toBe("");
    expect(numberProblem(seat, "abc")).not.toBe("");
    expect(numberProblem(seat, "39")).toMatch(/40 … 160/);
    expect(numberProblem(seat, "95")).toBe("");
  });
});

describe("hàng chạy bộ sinh", () => {
  /** Hẹn giờ điều khiển bằng tay */
  const clock = () => {
    const due = new Map<number, () => void>();
    let id = 0;
    return {
      set: (f: () => void) => (due.set(++id, f), id),
      clear: (i: number) => void due.delete(i),
      fire: () => {
        const fs = [...due.values()];
        due.clear();
        for (const f of fs) f();
      },
      pending: () => due.size,
    };
  };
  const later = () => {
    let done!: () => void;
    const p = new Promise<void>((r) => (done = r));
    return { p, done };
  };

  it("đổi tham số lúc lượt A đang chạy, chưa hết thời gian chờ gõ: A trả về thì đã là lượt cũ, B chạy sau đó", async () => {
    const T = clock();
    const runs: { stale: () => boolean; gate: ReturnType<typeof later> }[] = [];
    const q = new GenQueue((stale) => {
      const gate = later();
      runs.push({ stale, gate });
      return gate.p;
    }, T);
    const a = q.go();
    expect(runs).toHaveLength(1);
    q.changed(450);
    expect(T.pending()).toBe(1);
    runs[0].gate.done();
    await a;
    expect(runs[0].stale()).toBe(true);
    expect(runs).toHaveLength(1);
    T.fire();
    expect(runs).toHaveLength(2);
    expect(runs[1].stale()).toBe(false);
    runs[1].gate.done();
  });

  it("hết thời gian chờ lúc lượt đang chạy: chạy tiếp ngay sau lượt ấy, một lượt một lúc", async () => {
    const T = clock();
    const runs: ReturnType<typeof later>[] = [];
    let active = 0;
    let most = 0;
    const q = new GenQueue(async () => {
      active++;
      most = Math.max(most, active);
      const g = later();
      runs.push(g);
      await g.p;
      active--;
    }, T);
    void q.go();
    q.changed(450);
    T.fire();
    expect(runs).toHaveLength(1);
    runs[0].done();
    await new Promise((r) => setTimeout(r, 0));
    expect(runs).toHaveLength(2);
    runs[1].done();
    await new Promise((r) => setTimeout(r, 0));
    expect(most).toBe(1);
  });
});
