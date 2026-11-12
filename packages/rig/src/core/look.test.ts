import { describe, expect, it } from "vitest";
import {
  ACTION_VERSION,
  actionFace,
  blendFace,
  parseAction,
  parseScene,
  resolveScene,
  sceneAt,
  type ActionData,
} from "./index";
import {
  EYE_LIDS,
  EYE_SHAPE_KINDS,
  EYE_SHAPES,
  eyeLids,
  eyeMarks,
  LOOK,
  lookStep,
  type FaceMark,
  type Look,
} from "./face";

function action(json: unknown): ActionData {
  const r = parseAction(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
}

/** Liếc từ trái người sang phải người trong một giây */
const GLANCE = action({
  name: "glance",
  duration: 1,
  end: "hold",
  mask: ["face"],
  keys: [
    { t: 0, pose: {}, face: { eyes: "open", look: [1, 0] } },
    { t: 1, pose: {}, face: { look: [-1, 0.5] } },
  ],
});
const TALK = action({
  name: "talk",
  duration: 1,
  end: "hold",
  mask: ["face"],
  keys: [{ t: 0, pose: {}, face: { mouth: "talkA" } }],
});

describe("kênh `look` của hành động", () => {
  it("bỏ trống là không ghi; ngoài -1..1 báo lỗi; nội suy giữa hai mốc", () => {
    expect("look" in actionFace(TALK, 0.5)).toBe(false);
    expect(parseAction({ keys: [{ t: 0, pose: {}, face: { look: [1.5, 0] } }] }).success).toBe(
      false,
    );
    expect(parseAction({ keys: [{ t: 0, pose: {}, face: { look: [0] } }] }).success).toBe(false);
    expect(actionFace(GLANCE, 0).look).toEqual([1, 0]);
    const mid = actionFace(GLANCE, 0.5).look!;
    expect(mid[0]).toBeCloseTo(0, 6);
    expect(mid[1]).toBeCloseTo(0.25, 6);
  });

  it("file đời 21 nâng lên mà không đổi gì", () => {
    const a = action({ ...TALK, schemaVersion: 21 });
    expect(a.schemaVersion).toBe(ACTION_VERSION);
    expect(a.keys).toEqual(TALK.keys);
  });

  it("`blendFace` hoà hướng nhìn thẳng, bên không ghi là nhìn thẳng", () => {
    const f = blendFace({ look: [1, -1] }, { mouth: "talkA" }, 0.25);
    expect(f.look![0]).toBeCloseTo(0.75, 6);
    expect(f.look![1]).toBeCloseTo(-0.75, 6);
    expect("look" in blendFace({ mouth: "smile" }, { mouth: "talkA" }, 0.5)).toBe(false);
  });
});

describe("`sceneAt` lấy mẫu `look`", () => {
  const at = (tracks: unknown[], t: number) => {
    const r = parseScene({
      lens: { eye: [0, -250, -1400], yaw: 0, pitch: 0, f: 800 },
      cast: [{ id: "a", tracks, world: { at: [0, 0, 400] } }],
    });
    if (!r.success) throw new Error(r.error.message);
    return sceneAt(resolveScene(r.data, { glance: GLANCE, talk: TALK }), "a", t);
  };

  it("không ghi thì bỏ trống; clip soi gương nhìn sang phía kia; track chỉ đổi mồm không xoá hướng nhìn", () => {
    expect(at([], 1).look).toBeUndefined();
    const clip = { action: "glance", start: 0, blend: 0 };
    expect(at([{ clips: [clip] }], 0).look).toEqual([1, 0]);
    expect(at([{ clips: [{ ...clip, mirror: true }] }], 0).look).toEqual([-1, 0]);
    const two = [{ clips: [clip] }, { clips: [{ action: "talk", start: 0, blend: 0 }] }];
    expect(at(two, 0)).toMatchObject({ mouth: "talkA", look: [1, 0] });
  });
});

const group = (m: FaceMark): FaceMark[] => ("group" in m ? m.group : []);
const nums = (d: string) => d.match(/-?\d+(\.\d+)?/g)!.map(Number);

/** Đa giác của đường viền mắt `M p C p p p C p p p Z` */
function outline(d: string): [number, number][] {
  const n = nums(d);
  const out: [number, number][] = [];
  const at = (o: number) => [n[o], n[o + 1]];
  for (const [a, b, c, e] of [
    [0, 2, 4, 6],
    [6, 8, 10, 0],
  ].map((q) => q.map(at)))
    for (let i = 0; i < 40; i++) {
      const t = i / 40,
        u = 1 - t;
      const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t];
      out.push(
        [0, 1].map((j) => w[0] * a[j] + w[1] * b[j] + w[2] * c[j] + w[3] * e[j]) as [
          number,
          number,
        ],
      );
    }
  return out;
}
function inside(poly: [number, number][], x: number, y: number) {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}
/** Phần tròng lộ ra trong hình mắt và tâm tròng của mắt bên `+1` */
function iris(
  shape: (typeof EYE_SHAPES)["male"],
  look: Look,
  kind: keyof typeof EYE_LIDS = "open",
) {
  const marks = group(group(eyeMarks(kind, 0, 0, 0, { only: 1, shape, squash: 1, look }))[0]);
  const clip = marks.find((m) => "clip" in m) as { clip: string };
  const e = marks.find((m) => "ellipse" in m && m.fill === "#4a3426") as {
    ellipse: [number, number, number, number];
  };
  const poly = outline(clip.clip);
  const [cx, cy, rx, ry] = e.ellipse;
  let all = 0,
    seen = 0;
  for (let i = -10; i <= 10; i++)
    for (let j = -10; j <= 10; j++) {
      if (i * i + j * j > 100) continue;
      all++;
      if (inside(poly, cx + (i / 10) * rx, cy + (j / 10) * ry)) seen++;
    }
  return { seen: seen / all, at: [cx, cy], centre: inside(poly, cx, cy) };
}

describe("hướng nhìn của mắt", () => {
  it("`lookStep` làm tròn theo nấc, kéo hướng chéo về vòng tròn đơn vị, bỏ trống là nhìn thẳng", () => {
    expect(lookStep()).toEqual([0, 0]);
    expect(lookStep([0.04, -0.04])).toEqual([0, 0]);
    expect(lookStep([0.31, -0.69])).toEqual([0.3, -0.7]);
    const [x, y] = lookStep([1, 1]);
    expect(Math.hypot(x, y)).toBeLessThanOrEqual(1.01);
    for (const v of lookStep([0.37, 0.92])) expect(Number.isInteger(v * LOOK.steps)).toBe(true);
  });

  it("tròng đi đúng phía: ngang dương về `+x` (bên trái người), dọc dương xuống", () => {
    const S = EYE_SHAPES.male;
    const c = iris(S, [0, 0]).at;
    expect(iris(S, [1, 0]).at[0]).toBeGreaterThan(c[0]);
    expect(iris(S, [-1, 0]).at[0]).toBeLessThan(c[0]);
    expect(iris(S, [0, 1]).at[1]).toBeGreaterThan(c[1]);
    expect(iris(S, [0, -1]).at[1]).toBeLessThan(c[1]);
  });

  it("ở mọi hướng tận cùng tâm tròng vẫn trong hình mắt, tròng còn lộ phần lớn như nhìn thẳng", () => {
    const dirs = Array.from({ length: 8 }, (_, i) =>
      lookStep([Math.cos(i * 0.785), Math.sin(i * 0.785)]),
    );
    for (const k of EYE_SHAPE_KINDS) {
      const S = EYE_SHAPES[k];
      const c = iris(S, [0, 0]).seen;
      for (const l of dirs) {
        const r = iris(S, l);
        expect(r.centre, `${k} ${l}`).toBe(true);
        expect(r.seen, `${k} ${l}`).toBeGreaterThan(0.6 * c);
      }
    }
  });

  it("nhìn xuống mi trên sụp thêm, nhìn lên mi trên mở thêm; kiểu nhắm vẫn nhắm", () => {
    expect(eyeLids("open", 1, 0, 0, undefined, 1).close).toBeCloseTo(LOOK.down);
    expect(eyeLids("open", 1, 0, 0, undefined, -1).open).toBeCloseTo(1 + LOOK.up);
    expect(eyeLids("open", 1, 0, 0, undefined, -1).close).toBe(0);
    expect(eyeLids("shut", 1, 0, 0, undefined, -1).close).toBe(1);
  });

  it("nhìn thẳng vẽ y như bỏ trống `look`, ở cả mắt người lẫn mắt đầu `sphere`", () => {
    for (const kind of ["open", "wide", "bulge", "squint", "wink", "droopy"] as const) {
      expect(eyeMarks(kind, 0, 0, 26, { look: [0, 0] })).toEqual(eyeMarks(kind, 0, 0, 26));
      const o = { shape: EYE_SHAPES.female, squash: 1 };
      expect(eyeMarks(kind, 0, 0, 26, { ...o, look: [0, 0] })).toEqual(eyeMarks(kind, 0, 0, 26, o));
    }
  });

  it("mắt đầu `sphere` dời chấm mắt hay con ngươi theo hướng nhìn", () => {
    const x = (kind: "open" | "bulge", l: Look) => {
      const m = group(eyeMarks(kind, 0, 0, 0, { only: 1, look: l }))[0];
      const all = [m, ...group(m)].filter((q) => "ellipse" in q) as { ellipse: number[] }[];
      return all.at(-1)!.ellipse[0];
    };
    for (const k of ["open", "bulge"] as const) expect(x(k, [1, 0])).toBeGreaterThan(x(k, [0, 0]));
  });
});
