import { describe, expect, it } from "vitest";
import { ACTION_VERSION, actionFace, composeFace, parseAction } from "./action";
import { blendFace } from "./blend";
import {
  humanMouthKind,
  humanMouthMarks,
  humanMouthTop,
  MOUTH_KINDS,
  MOUTH_LIMIT,
  MOUTH_MIX,
  MOUTH_POSES,
  MOUTH_SHAPE_FIELDS,
  MOUTH_SHAPE_KINDS,
  MOUTH_SHAPES,
  mouthPose,
  mouthShape,
  type FaceMark,
} from "./face";
import { parseCharacter } from "./schema";

/** Mọi điểm của các path (cặp số) và hình bầu dục của nét; nét cắt trong khoang (`clipped`) không tính */
function points(m: FaceMark): [number, number][] {
  if ("clip" in m || m.clipped) return [];
  if ("group" in m) return m.group.flatMap(points);
  if ("path" in m)
    return [...m.path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(([, x, y]) => [+x, +y]);
  if ("ellipse" in m) {
    const [x, y, rx, ry] = m.ellipse;
    return [
      [x - rx, y - ry],
      [x + rx, y + ry],
    ];
  }
  return [];
}
const fills = (m: FaceMark): string[] =>
  "clip" in m ? [] : [...(m.fill ? [m.fill] : []), ...("group" in m ? m.group.flatMap(fills) : [])];
/** Nét có viền (stroke) mà không phải nét mảnh của nếp khoé, bóng dưới môi hay vạch răng */
const strokes = (m: FaceMark): number[] =>
  "clip" in m
    ? []
    : [
        ...(m.stroke && m.stroke !== "none" ? [m.strokeWidth ?? 1] : []),
        ...("group" in m ? m.group.flatMap(strokes) : []),
      ];
/** Khoang: path tô màu khoang */
const cavity = (m: FaceMark): FaceMark | undefined =>
  "clip" in m
    ? undefined
    : m.fill === "#7a2b22"
      ? m
      : "group" in m
        ? m.group.map(cavity).find(Boolean)
        : undefined;

const MANGA = ["pain", "wry", "puffed", "fang"];
const poseOf = (k: (typeof MOUTH_KINDS)[number]) => mouthPose(k)!;

describe("dáng mồm người", () => {
  it("mọi dáng đủ trường; nam không màu môi, nữ có môi dưới và màu; trẻ em nhỏ và tròn; người già trễ khoé, có nếp", () => {
    for (const k of MOUTH_SHAPE_KINDS)
      expect(Object.keys(MOUTH_SHAPES[k]).sort(), k).toEqual([...MOUTH_SHAPE_FIELDS].sort());
    const { male, female, child, elder } = MOUTH_SHAPES;
    expect(male.tint).toBe(0);
    expect(male.lower).toBe(0);
    expect(female.tint).toBeGreaterThan(0);
    expect(female.lower).toBeGreaterThan(0);
    expect(child.half).toBeLessThan(Math.min(male.half, female.half, elder.half));
    expect(child.round).toBeGreaterThan(male.round);
    expect(elder.droop).toBeGreaterThan(0);
    expect(elder.fold).toBeGreaterThan(0);
  });

  it("số đè thắng số của dáng", () => {
    expect(mouthShape("child")).toEqual(MOUTH_SHAPES.child);
    expect(mouthShape("elder", { fold: 0 }).fold).toBe(0);
  });

  it("JSON nhân vật nhận `face.mouthShape` và `face.mouth`, bỏ trống thì không ghi gì", () => {
    const r = parseCharacter({ name: "a", face: { mouthShape: "elder", mouth: { droop: 2 } } });
    expect(r.success && r.data.face.mouthShape).toBe("elder");
    expect(r.success && r.data.face.mouth).toEqual({ droop: 2 });
    const d = parseCharacter({ name: "b" });
    expect(d.success && d.data.face.mouthShape).toBeUndefined();
    expect(parseCharacter({ name: "c", face: { mouthShape: "robot" } }).success).toBe(false);
  });
});

describe("khẩu hình người", () => {
  it("mọi khẩu hình có bộ số, trừ bốn ký hiệu manga", () => {
    expect(MOUTH_KINDS.filter((k) => !humanMouthKind(k))).toEqual(MANGA);
    expect(Object.keys(MOUTH_POSES).filter((k) => !MOUTH_KINDS.includes(k as never))).toEqual([]);
    for (const k of MANGA) expect(mouthPose(k as never)).toBeUndefined();
  });

  it("khoang không viền, không xuống quá `MOUTH_LIMIT`; nét nằm gọn trong lớp mồm", () => {
    for (const s of MOUTH_SHAPE_KINDS)
      for (const k of MOUTH_KINDS.filter(humanMouthKind)) {
        const m = humanMouthMarks(MOUTH_SHAPES[s], poseOf(k), 0, 0);
        const c = cavity(m);
        if (c) {
          expect("stroke" in c && c.stroke, `${s} ${k}`).toBeFalsy();
          expect(Math.max(...points(c).map((p) => p[1])), `${s} ${k}`).toBeLessThanOrEqual(
            MOUTH_LIMIT + 1e-6,
          );
        }
        // viền chỉ còn nét mảnh: nếp khoé, bóng dưới môi, vạch răng
        for (const w of strokes(m)) expect(w, `${s} ${k}`).toBeLessThanOrEqual(1.1);
        const ps = points(m);
        expect(Math.max(...ps.map((p) => Math.abs(p[0]))), `${s} ${k}`).toBeLessThan(24);
        expect(Math.min(...ps.map((p) => p[1])), `${s} ${k}`).toBeGreaterThan(-12);
        expect(Math.max(...ps.map((p) => p[1])), `${s} ${k}`).toBeLessThan(20);
      }
  });

  it("răng chỉ hiện khi đủ há, lưỡi chỉ khi há to", () => {
    const S = MOUTH_SHAPES.male;
    const at = (open: number) =>
      fills(humanMouthMarks(S, { ...poseOf("closed"), open, upper: 1, lower: 1 }, 0, 0));
    expect(at(0.05)).not.toContain("#f7f2e6");
    expect(at(0.3)).toContain("#f7f2e6");
    expect(at(0.4)).not.toContain("#c8605a");
    expect(at(0.9)).toContain("#c8605a");
    expect(fills(humanMouthMarks(S, poseOf("closed"), 0, 0))).not.toContain("#7a2b22");
  });

  it("hét nhỏ hơn hết cỡ cũ, mồm há nào cũng thấp hơn `MOUTH_LIMIT`; nữ có màu môi, nam không", () => {
    const shout = points(humanMouthMarks(MOUTH_SHAPES.male, poseOf("shout"), 0, 0));
    expect(Math.max(...shout.map((p) => Math.abs(p[0])))).toBeLessThan(20);
    const tinted = (s: "male" | "female") =>
      fills(humanMouthMarks(MOUTH_SHAPES[s], poseOf("talkA"), 0, 0)).filter((f) =>
        f.startsWith("rgba(2"),
      );
    expect(tinted("male")).toEqual([]);
    expect(tinted("female").length).toBeGreaterThan(0);
  });

  it("`humanMouthTop` ở trên mọi nét môi: ria mép không đè lên mồm", () => {
    for (const s of MOUTH_SHAPE_KINDS)
      for (const k of MOUTH_KINDS.filter(humanMouthKind)) {
        const S = MOUTH_SHAPES[s];
        const m = humanMouthMarks(S, poseOf(k), 0, 0);
        expect(humanMouthTop(S, poseOf(k)), `${s} ${k}`).toBeLessThanOrEqual(
          Math.min(...points(m).map((p) => p[1])) + 0.05,
        );
      }
  });
});

describe("chuyển khẩu hình", () => {
  it("nội suy bộ số theo nấc `MOUTH_MIX.steps`; dính ký hiệu manga thì không nội suy", () => {
    const a = poseOf("closed");
    const b = poseOf("talkB");
    const mid = mouthPose("talkB", { from: "closed", to: "talkB", f: 0.45 })!;
    expect(mid.open).toBeCloseTo(a.open + (b.open - a.open) * 0.5, 6);
    expect(mouthPose("talkB", { from: "closed", to: "talkB", f: 0.1 })!.open).toBe(0);
    expect(mouthPose("talkB", { from: "closed", to: "talkB", f: 0.95 })!.open).toBe(b.open);
    expect(mouthPose("pain", { from: "closed", to: "pain", f: 0.5 })).toBeUndefined();
    expect(mouthPose("closed", { from: "pain", to: "closed", f: 0.5 })).toEqual(a);
  });

  const act = () => {
    const r = parseAction({
      schemaVersion: ACTION_VERSION,
      name: "nhep",
      duration: 2,
      end: "hold",
      mask: ["face"],
      keys: [
        { t: 0, pose: {}, face: { mouth: "closed" } },
        { t: 0.5, pose: {}, face: { mouth: "talkA" } },
        { t: 0.6, pose: {}, face: { mouth: "talkA", brow: "sad" } },
        { t: 0.75, pose: {}, face: { mouth: "talkO" } },
      ],
    });
    if (!r.success) throw new Error(r.error.message);
    return r.data;
  };

  it("`actionFace` kèm `mouthTween` trong `MOUTH_MIX.secs` giây sau mốc đổi khẩu hình", () => {
    const a = act();
    const f = actionFace(a, 0.5 + 0.035 / 2);
    expect(f.mouth).toBe("talkA");
    expect(f.mouthTween?.from).toBe("closed");
    expect(f.mouthTween?.to).toBe("talkA");
    expect(f.mouthTween?.f).toBeCloseTo(0.035 / MOUTH_MIX.secs, 6);
    expect(actionFace(a, 0.5 + (MOUTH_MIX.secs + 0.01) / 2).mouthTween).toBeUndefined();
    // mốc ghi lại cùng khẩu hình không mở lần chuyển mới
    expect(actionFace(a, 0.6 + 0.01 / 2).mouthTween).toBeUndefined();
    expect(actionFace(a, 0.75 + 0.01 / 2).mouthTween).toMatchObject({ from: "talkA", to: "talkO" });
    // một vòng dài hơn thì cùng pha là nhiều giây hơn
    expect(actionFace(a, 0.5 + 0.035 / 2, 20).mouthTween).toBeUndefined();
    expect(actionFace(a, 0.2).mouthTween).toBeUndefined();
  });

  it("lớp trên ghi khẩu hình thì bỏ lần chuyển của lớp dưới; hoà hai clip thì mồm chuyển suốt đoạn", () => {
    const under = {
      mouth: "talkA" as const,
      mouthTween: { from: "closed", to: "talkA", f: 0.3 } as const,
    };
    expect(composeFace(under, { mouth: "smile" }).mouthTween).toBeUndefined();
    expect(composeFace(under, { brow: "sad" }).mouthTween).toEqual(under.mouthTween);
    const b = blendFace({ mouth: "closed" }, { mouth: "grin" }, 0.3);
    expect(b.mouth).toBe("closed");
    expect(b.mouthTween).toEqual({ from: "closed", to: "grin", f: 0.3 });
    expect(blendFace({ mouth: "smile" }, { mouth: "smile" }, 0.3).mouthTween).toBeUndefined();
  });
});
