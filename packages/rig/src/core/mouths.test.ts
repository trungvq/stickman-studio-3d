import { describe, expect, it } from "vitest";
import { ACTION_VERSION, actionFace, composeFace, parseAction } from "./action";
import { blendFace } from "./blend";
import {
  humanMouthGlyph,
  humanMouthKind,
  humanMouthMarks,
  humanMouthTop,
  MOUTH_GLYPHS,
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
const strokeColors = (m: FaceMark): string[] =>
  "clip" in m
    ? []
    : [
        ...(m.stroke && m.stroke !== "none" ? [m.stroke] : []),
        ...("group" in m ? m.group.flatMap(strokeColors) : []),
      ];
/** Khoang: path tô màu khoang */
const CAVITY = "#b9534b";
const TOOTH = "#fbf7f1";
const RIM = "#7a3029";
const cavity = (m: FaceMark): FaceMark | undefined =>
  "clip" in m
    ? undefined
    : m.fill === CAVITY
      ? m
      : "group" in m
        ? m.group.map(cavity).find(Boolean)
        : undefined;

const poseOf = (k: (typeof MOUTH_KINDS)[number]) => mouthPose(k)!;
const POSED = MOUTH_KINDS.filter(humanMouthKind);
/** Răng chỉ ở cười lớn, rạng rỡ, nanh, nghiến, quát, hét như bảng tham chiếu */
const TOOTHY = ["talkAngryA", "talkAngryB", "grit", "grin", "fang", "shout", "beam"];

describe("dáng mồm anime", () => {
  it("mọi dáng đủ trường; nam không màu môi, nữ có; trẻ em nhỏ và tròn; người già trễ khoé, có nếp", () => {
    for (const k of MOUTH_SHAPE_KINDS)
      expect(Object.keys(MOUTH_SHAPES[k]).sort(), k).toEqual([...MOUTH_SHAPE_FIELDS].sort());
    const { male, female, child, elder } = MOUTH_SHAPES;
    expect(male.tint).toBe(0);
    expect(female.tint).toBeGreaterThan(0);
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

describe("khẩu hình anime", () => {
  it("mọi khẩu hình có đúng một trong hai: bộ số (`MOUTH_POSES`) hay nét riêng (`MOUTH_GLYPHS`)", () => {
    expect(Object.keys(MOUTH_POSES).filter((k) => !MOUTH_KINDS.includes(k as never))).toEqual([]);
    for (const k of MOUTH_KINDS) expect(humanMouthKind(k) !== k in MOUTH_GLYPHS, k).toBe(true);
    for (const k of MOUTH_KINDS.filter((k) => !humanMouthKind(k))) {
      expect(mouthPose(k)).toBeUndefined();
      expect(points(humanMouthGlyph(k, MOUTH_SHAPES.male, 0, 0)!).length, k).toBeGreaterThan(0);
    }
    expect(humanMouthGlyph("talkA", MOUTH_SHAPES.male, 0, 0)).toBeUndefined();
  });

  it("khoang không viền, không xuống quá `MOUTH_LIMIT`; nét nằm gọn trong lớp mồm", () => {
    for (const s of MOUTH_SHAPE_KINDS)
      for (const k of POSED) {
        const m = humanMouthMarks(MOUTH_SHAPES[s], poseOf(k), 0, 0);
        const c = cavity(m);
        if (c) {
          expect("stroke" in c && c.stroke, `${s} ${k}`).toBeFalsy();
          expect(Math.max(...points(c).map((p) => p[1])), `${s} ${k}`).toBeLessThanOrEqual(
            MOUTH_LIMIT + 1e-6,
          );
        }
        const ps = points(m);
        expect(Math.max(...ps.map((p) => Math.abs(p[0]))), `${s} ${k}`).toBeLessThan(30);
        expect(Math.min(...ps.map((p) => p[1])), `${s} ${k}`).toBeGreaterThan(-14);
        expect(Math.max(...ps.map((p) => p[1])), `${s} ${k}`).toBeLessThan(MOUTH_LIMIT + 2);
      }
  });

  it("răng chỉ ở khẩu hình khai răng, ở mọi dáng; ngậm không có khoang", () => {
    for (const s of MOUTH_SHAPE_KINDS) {
      const toothy = POSED.filter((k) =>
        fills(humanMouthMarks(MOUTH_SHAPES[s], poseOf(k), 0, 0)).includes(TOOTH),
      );
      expect(toothy.sort(), s).toEqual([...TOOTHY].sort());
      expect(fills(humanMouthMarks(MOUTH_SHAPES[s], poseOf("closed"), 0, 0))).not.toContain(CAVITY);
    }
  });

  it("chỗ hở dưới `TEETH_MIN` thì không vẽ răng, kể cả khẩu hình khai răng", () => {
    const S = MOUTH_SHAPES.male;
    const at = (open: number) => fills(humanMouthMarks(S, { ...poseOf("grin"), open }, 0, 0));
    expect(at(0.15)).not.toContain(TOOTH);
    expect(at(0.7)).toContain(TOOTH);
  });

  it("nghiến là khối răng kín khoang có vạch giữa", () => {
    const m = humanMouthMarks(MOUTH_SHAPES.male, poseOf("grit"), 0, 0);
    const rect = (x: FaceMark): boolean =>
      "clip" in x
        ? false
        : ("rect" in x && x.fill === TOOTH) || ("group" in x && x.group.some(rect));
    expect(rect(m)).toBe(true);
  });

  it("nữ viền ngả màu môi, nam viền nâu đỏ", () => {
    const rims = (s: "male" | "female") =>
      strokeColors(humanMouthMarks(MOUTH_SHAPES[s], poseOf("talkA"), 0, 0));
    expect(rims("male")).toContain(RIM);
    expect(rims("female")).not.toContain(RIM);
  });

  it("`humanMouthTop` ở trên mọi nét môi: ria mép không đè lên mồm", () => {
    for (const s of MOUTH_SHAPE_KINDS)
      for (const k of POSED) {
        const S = MOUTH_SHAPES[s];
        const m = humanMouthMarks(S, poseOf(k), 0, 0);
        expect(humanMouthTop(S, poseOf(k)), `${s} ${k}`).toBeLessThanOrEqual(
          Math.min(...points(m).map((p) => p[1])) + 0.05,
        );
      }
  });
});

describe("chuyển khẩu hình", () => {
  it("nội suy bộ số theo nấc `MOUTH_MIX.steps`; dính nét riêng thì không nội suy", () => {
    const a = poseOf("closed");
    const b = poseOf("talkB");
    const mid = mouthPose("talkB", { from: "closed", to: "talkB", f: 0.45 })!;
    expect(mid.open).toBeCloseTo(a.open + (b.open - a.open) * 0.5, 6);
    expect(mouthPose("talkB", { from: "closed", to: "talkB", f: 0.1 })!.open).toBe(0);
    expect(mouthPose("talkB", { from: "closed", to: "talkB", f: 0.95 })!.open).toBe(b.open);
    expect(mouthPose("chew", { from: "closed", to: "chew", f: 0.5 })).toBeUndefined();
    expect(mouthPose("closed", { from: "chew", to: "closed", f: 0.5 })).toEqual(a);
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
