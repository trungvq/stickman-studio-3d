import { describe, expect, it } from "vitest";
import { GEN_PAGES } from "@stickman3d/cli/gen-pages";
import {
  coerce,
  fieldsOf,
  genKeys,
  isGen,
  readGen,
  setValue,
  shown,
  valueOf,
  writeGen,
} from "./genPage";
import { readLibrary, writeLibrary } from "./libraryList";
import { readView, writeView } from "./share";

const q = (s: string) => new URLSearchParams(s);
const param = (kind: string, key: string) => GEN_PAGES[kind].params.find((x) => x.key === key)!;

describe("URL ↔ tham số", () => {
  it("đọc đúng kiểu, bỏ giá trị sai và giá trị bằng mặc định", () => {
    const v = readGen(
      q("gen=sit&legs=bent&seat=95&armrest=1&desk=0&depth=999&hands=xx&footrest=true"),
      GEN_PAGES,
    );
    expect(v).toEqual({
      kind: "sit",
      values: { legs: "bent", seat: 95, armrest: true, footrest: true },
    });
    expect(isGen(q("gen=sit"))).toBe(true);
    expect(isGen(q("library=1"))).toBe(false);
  });

  it("bộ sinh lạ về bộ đầu tiên; `auto` và điểm chỉ nhận ở tham số cho phép", () => {
    expect(readGen(q("gen=khong-co"), GEN_PAGES).kind).toBe(Object.keys(GEN_PAGES)[0]);
    const v = readGen(q("gen=pour&tilt=auto&cupR=auto&cupAt=40,%2018,-6&cup=0"), GEN_PAGES);
    expect(v.values).toEqual({ cupAt: "40,18,-6", cup: false });
    expect(coerce(param("pour", "cupAt"), "1,2")).toBeUndefined();
    expect(coerce(param("pour", "cupAt"), "auto")).toBe("auto");
    expect(coerce(param("pour", "tilt"), "120")).toBe(120);
    expect(coerce(param("pour", "tilt"), "200")).toBeUndefined();
  });

  it("ghi chỉ tham số khác mặc định, đọc lại ra đúng bản ấy; đổi trang không sót khoá trang kia", () => {
    const view = {
      kind: "sit",
      values: { legs: "staggered", tuck: "right", seat: 100, desk: true },
    };
    const p = writeGen(q("gen=pour&cupR=9&t=1.5&who=sample-man"), view, GEN_PAGES);
    expect(p.get("cupR")).toBeNull();
    expect(p.get("t")).toBe("1.5");
    expect(p.get("who")).toBe("sample-man");
    expect(p.get("desk")).toBe("1");
    expect(readGen(p, GEN_PAGES)).toEqual(view);
    const same = writeGen(q(""), { kind: "pour", values: { cup: true, cupR: 7 } }, GEN_PAGES);
    expect(same.toString()).toBe("gen=pour");
  });

  it("khoá tham số không trùng khoá của view và của Thư viện", () => {
    const view = writeView(q(""), {
      scene: "x",
      t: 1,
      cam: "free",
      free: { pos: [1, 2, 3], at: [0, 0, 0], fov: 30 },
      hand: { id: "a", side: "right" },
      solo: true,
      ed: "hands",
    });
    const lib = writeLibrary(q(""), {
      ...readLibrary(q("")),
      action: "a",
      who: "b",
      speed: 0.25,
      loop: false,
      mouth: true,
    });
    const taken = new Set([...view.keys(), ...lib.keys()]);
    for (const k of genKeys(GEN_PAGES).filter((k) => k !== "gen"))
      expect(taken.has(k), k).toBe(false);
    // ghi tham số không đụng view
    const p = writeGen(view, { kind: "sit", values: { seat: 99 } }, GEN_PAGES);
    expect(readView(p).free?.pos).toEqual([1, 2, 3]);
  });
});

describe("form từ `params`", () => {
  const sit = GEN_PAGES.sit.params;

  it("`when`: ô phụ hiện khi tham số kia bằng giá trị", () => {
    const keys = (values: Record<string, unknown>) =>
      fieldsOf(sit, values as never).map((f) => f.param.key);
    expect(keys({})).not.toContain("tuck");
    expect(keys({})).not.toContain("armTop");
    expect(keys({ legs: "staggered" })).toContain("tuck");
    expect(keys({ armrest: true, desk: true, footrest: true })).toEqual(
      expect.arrayContaining(["armTop", "armOut", "armFront", "deskNear", "deskTop", "footY"]),
    );
    // `when` so bật / tắt như chữ của URL
    expect(shown(sit, { armrest: "1" } as never, param("sit", "armTop"))).toBe(true);
    expect(shown(GEN_PAGES.pour.params, {}, param("pour", "cupR"))).toBe(true);
    expect(shown(GEN_PAGES.pour.params, { cup: false }, param("pour", "cupR"))).toBe(false);
    // `when` là danh sách: một trong số ấy
    expect(keys({})).not.toContain("elbow");
    expect(keys({ hands: "armrest" })).toContain("elbow");
    expect(keys({ hands: "fold" })).toEqual(expect.arrayContaining(["elbow", "top"]));
    expect(keys({ hands: "armrest" })).not.toContain("top");
  });

  it("ô mang giá trị đang dùng, `auto`, đổi khác mặc định", () => {
    const f = fieldsOf(GEN_PAGES.pour.params, { cupR: 9 });
    const by = Object.fromEntries(f.map((x) => [x.param.key, x]));
    expect(by.tilt).toMatchObject({ value: "auto", auto: true, changed: false });
    expect(by.cupR).toMatchObject({ value: 9, auto: false, changed: true });
    expect(by.style.value).toBe("single");
    // mọi tham số của mọi trang có nhãn tiếng Việt, enum có tên cho từng giá trị
    for (const page of Object.values(GEN_PAGES))
      for (const x of page.params) {
        expect(x.label, x.key).toBeTruthy();
        if (x.type === "enum")
          for (const v of x.values!) expect(x.names?.[v], `${x.key}=${v}`).toBeTruthy();
        if (x.type === "number") expect(x.min! < x.max!, x.key).toBe(true);
      }
  });

  it("đặt giá trị bằng mặc định là bỏ khoá; `auto` của trang `pour` theo kiểu rót", () => {
    let v = setValue(sit, {}, "seat", 100);
    expect(v).toEqual({ seat: 100 });
    v = setValue(sit, v, "seat", valueOf(sit, {}, "seat"));
    expect(v).toEqual({});
    expect(GEN_PAGES.pour.auto!({})).toMatchObject({ tilt: 100, pourDir: 180 });
    expect(GEN_PAGES.pour.auto!({ style: "serve" })).toMatchObject({ tilt: 88, pourDir: 30 });
  });
});
