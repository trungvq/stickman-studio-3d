import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { lensCamera } from "@stickman3d/rig";
import {
  lensOf,
  readView,
  toRig,
  viewNote,
  writeView,
  type NoteInput,
  type ViewState,
} from "./share";

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

describe("lensOf: camera three ra `scene.lens`", () => {
  const stage = { w: 1280, h: 720 };
  it("ngược lensCamera: cùng mắt, hướng, fov", () => {
    const pos: [number, number, number] = [1.5, 1.6, -4];
    const dir = new THREE.Vector3(-0.3, -0.25, 1).normalize();
    const l = lensOf(pos, dir.toArray(), 32, stage, 16 / 9);
    const c = lensCamera(l, stage);
    expect(c.eye.distanceTo(new THREE.Vector3(...pos))).toBeLessThan(0.002);
    expect(c.fwd.angleTo(dir)).toBeLessThan(0.001);
    expect(c.fov).toBeCloseTo(32, 1);
    expect(l.pitch).toBeGreaterThan(0);
  });

  it("sân khấu dọc trong khung 16:9 giữ bề cao, sân khấu rộng hơn khung giữ bề ngang", () => {
    const tall = { w: 405, h: 720 };
    expect(lensCamera(lensOf([0, 1, 5], [0, 0, -1], 40, tall, 16 / 9), tall).fov).toBeCloseTo(
      40,
      1,
    );
    const f = lensOf([0, 1, 5], [0, 0, -1], 40, stage, 1).f;
    expect(f).toBeCloseTo(1280 / 2 / Math.tan((20 * Math.PI) / 180), 0);
  });
});

describe("viewNote", () => {
  const base: NoteInput = {
    root: "/repo",
    scene: "s1",
    from: "world",
    t: 1.2,
    dur: 4,
    marks: { nam: 1.1, xa: 3 },
    url: "http://localhost:5180/?scene=s1",
    png: "/repo/tmp/studio3d/s1-1.20s.png",
    view: { scene: "s1", t: 1.2, cam: "scene" },
    stage: { w: 1280, h: 720 },
    shot: {
      lens: { eye: [0, -150, -800], yaw: 0, pitch: 5, f: 1100, cx: 0, cy: 0 },
      lensFrom: "scene",
      crop: { x: 20, y: 0, zoom: 1.25 },
    },
    hands: ["an tay phải: coc@grip/side — !!pierce 2.0"],
    dirty: false,
  };

  it("camera cảnh: file, ống kính hệ rig, khung cắt, mốc gần, ảnh, link, lệnh vẽ lại", () => {
    const n = viewNote(base);
    expect(n).toContain("scenes/s1.json");
    expect(n).toContain(
      '`"lens": {"eye":[0,-150,-800],"yaw":0,"pitch":5,"f":1100,"cx":0,"cy":0}` (`scene.lens`)',
    );
    expect(n).toContain("x 20, y 0, zoom 1.25 (khung sân khấu 1280×720)");
    expect(n).toContain("@nam = 1.10 s");
    expect(n).toContain(base.png);
    expect(n).toContain(base.url);
    expect(n).toContain("--times 1.2");
    expect(n).toContain("!!pierce");
    expect(n).not.toContain("chưa lưu");
  });

  it("camera tự do: ống kính quy sẵn, tâm xoay hai hệ, không lệnh vẽ lại; bàn tay đang chọn, chưa lưu", () => {
    const n = viewNote({
      ...base,
      shot: undefined,
      freeLens: { eye: [100, -200, -300], yaw: 180, pitch: 10, f: 1300 },
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
    expect(n).toContain('`"lens": {"eye":[100,-200,-300],"yaw":180,"pitch":10,"f":1300}`');
    expect(n).toContain("dán làm `scene.lens`");
    expect(n).toContain("ở (1.00, 2.00, 3.00), tâm xoay (0.50, 1.00, -0.20), fov 28°");
    expect(n).toContain("tâm xoay hệ rig (50, -100, 20)");
    expect(n).not.toContain("khung cắt `cameraAt`");
    expect(n).not.toContain("stickman-render");
    expect(n).not.toContain("mốc gần");
    expect(n).toContain("không lưu được (hỏng)");
    expect(n).toContain("Chỉ người này: bật");
    expect(n).toContain("  dòng 2");
    expect(n).toContain("chưa lưu");
  });
});
