import { describe, expect, it } from "vitest";
import {
  BLINK,
  blinkAt,
  BROW_KINDS,
  BROWS,
  browMarks,
  HUMAN_BROWS,
  wrinkleMarks,
  EYE_LIDS,
  EYE_SHAPE_FIELDS,
  EYE_SHAPE_KINDS,
  EYE_SHAPES,
  eyeBlink,
  eyeLids,
  eyeMarks,
  eyeShape,
  type FaceMark,
} from "./face";
import { parseCharacter } from "./schema";

const group = (m: FaceMark): FaceMark[] => ("group" in m ? m.group : []);
const one = (m: FaceMark) => group(group(m)[0]);
/** Nét mi trên: path viền có bề dày `lash` của dáng */
const upperOf = (marks: FaceMark[], lash: number) =>
  marks.find((m) => "path" in m && m.strokeWidth === lash && m.path.includes(" C ")) as {
    path: string;
  };
const nums = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);

describe("dáng mắt người", () => {
  it("mọi dáng đủ trường; nam không đuôi mắt, không mi dưới; nữ có cả hai", () => {
    for (const k of EYE_SHAPE_KINDS)
      expect(Object.keys(EYE_SHAPES[k]).sort(), k).toEqual([...EYE_SHAPE_FIELDS].sort());
    expect(EYE_SHAPES.male.flick).toBe(0);
    expect(EYE_SHAPES.male.lower).toBe(0);
    expect(EYE_SHAPES.female.flick).toBeGreaterThan(0);
    expect(EYE_SHAPES.female.lower).toBeGreaterThan(0);
    expect(EYE_SHAPES.female.tilt).toBeGreaterThan(0);
    expect(EYE_SHAPES.elder.tilt).toBeLessThan(0);
    expect(EYE_SHAPES.child.crease).toBe(0);
  });

  it("`eyeShape` lấy dáng `male` khi bỏ trống, số đè thay từng trường", () => {
    expect(eyeShape()).toEqual(EYE_SHAPES.male);
    const s = eyeShape("female", { tilt: 0, crease: undefined });
    expect(s).toEqual({ ...EYE_SHAPES.female, tilt: 0 });
  });

  it("schema: `eyeShape` mặc định `male`, `eye` đè từng số; dáng lạ báo lỗi", () => {
    const r = parseCharacter({});
    expect(r.success && r.data.face.eyeShape).toBe("male");
    expect(r.success && r.data.face.eye).toBeUndefined();
    const f = parseCharacter({ face: { eyeShape: "female", eye: { tilt: -0.1, crease: 0 } } });
    expect(f.success && eyeShape(f.data.face.eyeShape, f.data.face.eye)).toEqual({
      ...EYE_SHAPES.female,
      tilt: -0.1,
      crease: 0,
    });
    expect(parseCharacter({ face: { eyeShape: "robot" } }).success).toBe(false);
    expect(parseCharacter({ face: { eye: { tilt: "up" } } }).success).toBe(false);
  });
});

describe("mi của mắt người", () => {
  it("kiểu nhắm đóng hẳn, chớp và mi sụp dồn vào độ nhắm; mắt mở to chỉ ăn nửa mi sụp", () => {
    expect(eyeLids("shut", 1).close).toBe(1);
    expect(eyeLids("happy", 1).close).toBe(1);
    expect(eyeLids("open", 1, 0, 1).close).toBe(1);
    expect(eyeLids("open", 1, 0.4).close).toBeCloseTo(0.4);
    expect(eyeLids("wide", 1, 0.4).close).toBeCloseTo(0.2);
    expect(eyeLids("squint", 1, 0, 0.5).close).toBeCloseTo(1 - 0.75 * (1 - 0.84 * 0.5));
    // mắt nheo tự hạ mi tới mức riêng: mi sụp nghỉ lấy số lớn hơn chứ không cộng chồng
    expect(eyeLids("squint", 1, 0.22).close).toBeCloseTo(0.25);
    expect(eyeLids("squint", 1, 0.4).close).toBeCloseTo(0.4);
    expect(eyeLids("open", 1, 0.22).close).toBeCloseTo(0.22);
    // nấc chớp chưa nhắm hẳn còn khe dưới nét mi trên
    expect(eyeLids("open", 1, 0, 7 / 8).close).toBeLessThan(0.75);
    expect(eyeLids("wink", -1).close).toBe(1);
    expect(eyeLids("wink", 1).close).toBe(0);
  });

  it("mi trên xiên theo mày: giận hạ đầu trong, buồn hạ đầu ngoài", () => {
    expect(eyeLids("open", 1, 0, 0, "angry").slant).toBeGreaterThan(0);
    expect(eyeLids("open", 1, 0, 0, "furrowed").slant).toBeGreaterThan(0);
    expect(eyeLids("open", 1, 0, 0, "sad").slant).toBeLessThan(0);
    expect(eyeLids("open", 1, 0, 0, "neutral").slant).toBe(0);
  });

  it("chớp chỉ ở kiểu mắt đang mở", () => {
    for (const k of ["shut", "happy", "squeezed", "sly"] as const)
      expect(eyeBlink(k, 1), k).toBe(0);
    for (const k of ["open", "wide", "bulge", "squint", "droopy", "wink"] as const)
      expect(eyeBlink(k, 0.5), k).toBe(0.5);
  });

  it("mắt nhắm rộng bằng mắt mở, khoé ngoài về ngang tâm, đường nhắm thấp hơn khoé (cong xuống); `happy` cong lên; nhắm hẳn không còn lòng trắng", () => {
    for (const k of EYE_SHAPE_KINDS) {
      const shape = EYE_SHAPES[k];
      const at = (kind: keyof typeof EYE_LIDS) =>
        one(eyeMarks(kind, 0, 0, 0, { only: 1, shape, squash: 1 }));
      const [open, shut, happy] = [at("open"), at("shut"), at("happy")];
      const a = nums(upperOf(open, shape.lash).path);
      const b = nums(upperOf(shut, shape.lash).path);
      const c = nums(upperOf(happy, shape.lash).path);
      expect([b[0], b[1], b[6]], k).toEqual([a[0], a[1], a[6]]);
      expect(b[7], k).toBe(0);
      expect(Math.min(b[3], b[5]), k).toBeGreaterThan(Math.max(b[1], b[7]));
      expect(Math.max(c[3], c[5]), k).toBeLessThan(Math.min(c[1], c[7]));
      for (const m of [...shut, ...happy]) expect("clip" in m, k).toBe(false);
    }
  });

  it("tròng và con ngươi luôn cắt trong hình mắt", () => {
    for (const kind of Object.keys(EYE_LIDS) as (keyof typeof EYE_LIDS)[])
      for (const k of EYE_SHAPE_KINDS)
        for (const m of one(eyeMarks(kind, 0, 0, 0, { only: 1, shape: EYE_SHAPES[k] })))
          if ("ellipse" in m) expect(m.clipped, `${kind} ${k}`).toBe(true);
  });
});

describe("mày và nếp nhăn của đầu người", () => {
  it("`human` lấy `HUMAN_BROWS`, kiểu khác và đầu `sphere` giữ `BROWS`", () => {
    expect(HUMAN_BROWS.neutral!.tilt).toBe(0);
    expect(BROWS.neutral.tilt).toBeGreaterThan(0);
    for (const k of BROW_KINDS) {
      const h = browMarks(k, 0, 0, 40, { human: true });
      if (k in HUMAN_BROWS) expect(h, k).not.toEqual(browMarks(k, 0, 0, 40));
      else expect(h, k).toEqual(browMarks(k, 0, 0, 40));
      expect(browMarks(k, 0, 0, 40, { human: false }), k).toEqual(browMarks(k, 0, 0, 40));
    }
  });

  it("chân chim của mắt người bắt đầu ngoài khoé ngoài", () => {
    const spec = { kind: "light" as const, color: "#000", width: 1, dy: 0 };
    const feet = (eyeHalf?: number) =>
      group(group(wrinkleMarks(spec, 0, 0, 36, 34, 65, 1, eyeHalf)!)[2]).map((m) =>
        "line" in m ? m.line[0] : NaN,
      );
    expect(feet()).toEqual([25, 25]);
    for (const x of feet(11.5)) expect(x).toBeGreaterThan(18 + 11.5 + 2);
  });

  it("chân chim của mắt người là các nét rời, không chung gốc", () => {
    for (const kind of ["light", "deep"] as const) {
      const spec = { kind, color: "#000", width: 1, dy: 0 };
      const lines = group(
        group(wrinkleMarks(spec, 0, 0, 36, 34, 65, 1, 11.5)!)[kind === "deep" ? 3 : 2],
      )
        .filter((m) => "line" in m)
        .map((m) => ("line" in m ? m.line : [0, 0, 0, 0]));
      expect(lines.length).toBe(kind === "deep" ? 3 : 2);
      for (let i = 1; i < lines.length; i++) {
        const [a, b] = [lines[i - 1], lines[i]];
        expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(2);
        expect(Math.hypot(a[2] - b[2], a[3] - b[3])).toBeGreaterThan(2);
      }
    }
  });
});

describe("chớp mắt vu vơ", () => {
  const frames = Array.from({ length: 60 * 30 }, (_, i) => blinkAt(i / 60, 3));

  it("cùng `t` cùng số, độ nhắm theo nấc `1 / steps`", () => {
    expect(frames).toEqual(Array.from({ length: 60 * 30 }, (_, i) => blinkAt(i / 60, 3)));
    for (const v of frames) expect(Number.isInteger(v * BLINK.steps)).toBe(true);
    expect(Math.max(...frames)).toBe(1);
  });

  it("mỗi lần chớp ngắn hơn tám khung 60 fps, nhắm nhanh hơn mở", () => {
    const runs: number[][] = [];
    frames.forEach((v, i) => {
      if (v > 0 && !(frames[i - 1] > 0)) runs.push([]);
      if (v > 0) runs.at(-1)!.push(v);
    });
    expect(runs.length).toBeGreaterThanOrEqual(30 / BLINK.period - 1);
    for (const r of runs) {
      expect(r.length).toBeLessThanOrEqual(8);
      const top = r.indexOf(Math.max(...r));
      expect(top).toBeLessThan(r.length - 1 - top);
    }
  });
});
