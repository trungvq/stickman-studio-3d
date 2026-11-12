import { describe, expect, it } from "vitest";
import {
  BROW_KINDS,
  browMarks,
  EYE_KINDS,
  EYE_R,
  eyeMarks,
  eyeShape,
  FACE_REST,
  faceRest,
  type FaceMark,
} from "./face";
import { parseCharacter } from "./schema";

const group = (m: FaceMark) => ("group" in m ? m.group : []);
/** Tung độ của điểm đầu path `M x y …` */
const startY = (m: FaceMark) => ("path" in m ? Number(m.path.split(" ")[2]) : NaN);
const dots = (m: FaceMark) => group(m).filter((d) => "ellipse" in d) as { ellipse: number[] }[];

describe("nét mặt nghỉ của nhân vật", () => {
  const rest = faceRest();

  it("mặc định cho đúng nét chung", () => {
    for (const k of EYE_KINDS) {
      const o = { squash: 0.75, pupil: 0.85 };
      const r = { ...o, lid: rest.lid, shine: rest.shine };
      expect(eyeMarks(k, 3, 10, 44, r)).toEqual(eyeMarks(k, 3, 10, 44, o));
      const h = { ...o, shape: eyeShape() };
      expect(eyeMarks(k, 3, 10, 44, { ...h, lid: rest.lid, shine: rest.shine })).toEqual(
        eyeMarks(k, 3, 10, 44, h),
      );
    }
    for (const k of BROW_KINDS)
      expect(browMarks(k, 3, 7, 44, { width: rest.browWidth, tilt: rest.browTilt })).toEqual(
        browMarks(k, 3, 7, 44),
      );
    expect(eyeMarks("open", 0, 0, 0, { only: 1, squash: 1 })).toEqual({
      group: [{ ellipse: [0, 0, EYE_R, EYE_R], fill: "#22201d" }],
    });
    expect(group(eyeMarks("squint", 0, 0, 0, { only: 1, squash: 0.5 }))[0]).toMatchObject({
      path: "M -3 0 A 3 6 0 0 0 3 0 Z",
    });
  });

  it("`lid` cắt ngang mắt mở từ đỉnh; `squint` lấy số lớn hơn", () => {
    const eye = (k: "open" | "squint" | "wink", lid: number) =>
      group(eyeMarks(k, 0, 0, 0, { only: 1, lid }))[0];
    expect(startY(eye("open", 0.4))).toBeCloseTo(-EYE_R * 0.2);
    expect(startY(eye("wink", 0.4))).toBeCloseTo(-EYE_R * 0.2);
    expect(startY(eye("squint", 0.3))).toBeCloseTo(0);
    expect(startY(eye("squint", 0.6))).toBeCloseTo(EYE_R * 0.2);
    expect(eye("happy" as "open", 0.4)).toEqual(group(eyeMarks("happy", 0, 0, 0, { only: 1 }))[0]);
  });

  it("`shine` nhân đốm sáng của mắt người, `0` bỏ đốm", () => {
    const shape = eyeShape();
    const white = (shine: number) =>
      dots(group(eyeMarks("open", 0, 0, 0, { only: 1, shape, shine }))[0]).filter(
        (d) => (d as { fill?: string }).fill === "#f7f2e6",
      );
    expect(white(0)).toEqual([]);
    const [base] = white(1);
    expect(white(1.5)[0].ellipse[3]).toBeCloseTo(base.ellipse[3] * 1.5);
  });

  it("`browWidth` nhân bề dày, `browTilt` nhấc đầu trong của cả hai nét", () => {
    expect(browMarks("neutral", 0, 0, 40, { width: 1.5 })).toMatchObject({ strokeWidth: 6 });
    /** Đầu trong cao hơn đầu ngoài bấy nhiêu px, mỗi bên */
    const lift = (tilt: number) =>
      group(browMarks("flat", 0, 0, 40, { tilt })).map((m) => {
        const n = "path" in m ? m.path.split(" ").map(Number) : [];
        return n[2] - n[n.length - 1];
      });
    expect(lift(0)).toEqual([0, 0]);
    expect(lift(3)).toEqual([6, 6]);
    expect(lift(-3)).toEqual([-6, -6]);
  });

  it("schema: mặc định theo `FACE_REST`, ngoài khoảng thì báo lỗi", () => {
    const r = parseCharacter({});
    expect(r.success && faceRest(r.data.face)).toEqual(rest);
    expect(r.success && r.data.face.lid).toBe(FACE_REST.lid.def);
    expect(parseCharacter({ face: { lid: 0.3, browTilt: -3 } }).success).toBe(true);
    expect(parseCharacter({ face: { lid: 0.9 } }).success).toBe(false);
  });
});
