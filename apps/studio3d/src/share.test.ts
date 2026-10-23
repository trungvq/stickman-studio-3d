import { describe, expect, it } from "vitest";
import { readView, toRig, viewNote, writeView, type NoteInput, type ViewState } from "./share";

describe("view trong URL", () => {
  it("ghi rồi đọc lại đủ: camera tự do, bàn tay, Chỉ người này, Dáng tay; giữ tham số khác", () => {
    const v: ViewState = {
      scene: "t02-s036",
      t: 3.2,
      cam: "free",
      free: { pos: [1.23456, 1.5, -3], at: [0, 1.1, 0.25], fov: 30 },
      hand: { id: "an:2", side: "right" },
      solo: true,
      ed: "hands",
    };
    const p = writeView(new URLSearchParams("x=1&pos=9,9,9"), v);
    expect(p.get("x")).toBe("1");
    expect(p.get("pos")).toBe("1.235,1.5,-3");
    expect(readView(new URLSearchParams(p.toString()))).toEqual({
      ...v,
      free: { ...v.free!, pos: [1.235, 1.5, -3] },
    });
  });

  it("camera cảnh không ghi chỗ đứng; khoá sai thì bỏ khoá ấy", () => {
    const p = writeView(new URLSearchParams("hand=x&solo=1"), {
      scene: "a",
      t: 1,
      cam: "scene",
      free: { pos: [0, 0, 0], at: [0, 0, 1], fov: 30 },
    });
    expect([...p.keys()]).toEqual(["scene", "t", "cam"]);
    expect(readView(new URLSearchParams("cam=free&pos=1,2&at=0,0,0&hand=an&t=-2&fov=0"))).toEqual({
      t: 0,
      cam: "free",
    });
    expect(readView(new URLSearchParams("cam=free&pos=1,2,3&at=0,0,0&fov=abc")).free).toEqual({
      pos: [1, 2, 3],
      at: [0, 0, 0],
      fov: 30,
    });
  });

  it("toRig ngược toThree: nhân 100, đảo y và z", () => {
    expect(toRig([1, 2, 3])).toEqual([100, -200, -300]);
  });
});

describe("viewNote", () => {
  const base: NoteInput = {
    root: "/repo",
    scene: "s1",
    from: "world",
    t: 1.2,
    fps: 30,
    dur: 4,
    marks: { nam: 1.1, xa: 3 },
    url: "http://localhost:5180/?scene=s1",
    png: "/repo/tmp/studio3d/s1-1.20s.png",
    view: { scene: "s1", t: 1.2, cam: "scene" },
    camera: { pos: [0, 1, 5], dir: [0, 0, -1], fov: 30 },
    hands: ["an tay phải: coc@grip/side — !!pierce 2.0"],
    dirty: false,
  };

  it("camera cảnh: file, khung, mốc gần, ảnh, link, lệnh vẽ lại", () => {
    const n = viewNote(base);
    expect(n).toContain("scenes/s1.json");
    expect(n).toContain("khung 36 ở 30 fps");
    expect(n).toContain("@nam = 1.10 s");
    expect(n).toContain(base.png);
    expect(n).toContain(base.url);
    expect(n).toContain("--three --times 1.2");
    expect(n).toContain("!!pierce");
    expect(n).not.toContain("chưa lưu");
  });

  it("camera tự do: chỗ đứng, tâm xoay hai hệ, không lệnh vẽ lại; bàn tay đang chọn, chưa lưu", () => {
    const n = viewNote({
      ...base,
      marks: {},
      png: undefined,
      pngError: "hỏng",
      view: {
        ...base.view,
        cam: "free",
        free: { pos: [1, 2, 3], at: [0.5, 1, -0.2], fov: 28 },
        solo: true,
      },
      hand: { label: "an · tay phải · coc@grip/side", measure: ["dòng 1", "dòng 2"] },
      dirty: true,
    });
    expect(n).toContain("ở (1.00, 2.00, 3.00) nhìn tới tâm xoay (0.50, 1.00, -0.20), fov 28°");
    expect(n).toContain("hệ rig (50, -100, 20)");
    expect(n).not.toContain("stickman-render");
    expect(n).not.toContain("mốc gần");
    expect(n).toContain("không lưu được (hỏng)");
    expect(n).toContain("Chỉ người này: bật");
    expect(n).toContain("  dòng 2");
    expect(n).toContain("chưa lưu");
  });
});
