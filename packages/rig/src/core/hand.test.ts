import { describe, expect, it } from "vitest";

import {
  ACTION_VERSION,
  actionHand,
  actionMask,
  actionPose,
  blendDuration,
  blendPose,
  composePose,
  fingerVec,
  HAND_DOF,
  HAND_BIND,
  HAND_BONES,
  HAND_PIECES,
  HAND_POSE_KINDS,
  HAND_POSE_LABELS,
  HAND_POSES,
  HAND_RELAXED,
  HAND_REST,
  fitCapsules,
  handCapsules,
  handFrames,
  handGrip,
  handSkin,
  skinHand,
  handVec,
  maskProblems,
  parseAction,
  parseScene,
  POSES,
  resolveScene,
  sceneAt,
  smoothstep,
  type ActionData,
  type HandPiece,
  type V3,
} from "./index";

const action = (json: object): ActionData => {
  const r = parseAction(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const tipOf = (v: readonly number[], f: HandPiece, side = -1): V3 => {
  const F = handFrames(v, side)[f];
  return [F.o[0] - F.R[1] * F.len, F.o[1] - F.R[4] * F.len, F.o[2] - F.R[7] * F.len];
};
const vec = (p: keyof typeof HAND_POSES | "rest") => [
  0,
  0,
  ...fingerVec(p === "rest" ? HAND_RELAXED : HAND_POSES[p]),
];

describe("bảng dáng tay", () => {
  it("đúng bốn dáng soạn được, mỗi dáng đủ chín góc ngón, có nhãn; dáng nghỉ ngoài bảng; `HAND_DOF` là xoay, gập cổ tay rồi chín góc ngón", () => {
    expect(HAND_POSE_KINDS).toEqual(Object.keys(HAND_POSES));
    expect([...HAND_POSE_KINDS].sort()).toEqual(["fist", "grip", "open", "point"]);
    for (const k of HAND_POSE_KINDS) {
      expect(fingerVec(HAND_POSES[k]).length).toBe(9);
      expect(fingerVec(HAND_POSES[k]).every(Number.isFinite)).toBe(true);
      expect(HAND_POSE_LABELS[k]).toBeTruthy();
    }
    expect(HAND_DOF.length).toBe(11);
    expect(HAND_REST).toEqual(vec("rest"));
    expect(fingerVec(HAND_RELAXED).length).toBe(9);
  });

  it("dáng đọc ra đúng: chỉ thì trỏ duỗi còn các ngón khác cuộn, nắm thì mọi đầu ngón về lòng tay, xoè thì mọi ngón duỗi", () => {
    const reach = (v: number[], f: HandPiece) => -tipOf(v, f)[1];
    expect(reach(vec("point"), "index1")).toBeGreaterThan(0.17);
    expect(reach(vec("point"), "middle1")).toBeLessThan(0.12);
    for (const f of ["index1", "middle1", "thumb1"] as const)
      expect(reach(vec("fist"), f)).toBeLessThan(0.12);
    for (const f of ["index1", "middle1"] as const)
      expect(reach(vec("open"), f)).toBeGreaterThan(0.165);
    // dáng nghỉ: ngón cong nhẹ, ngón cái khép sát cạnh ngón trỏ (không hở chữ C)
    const r = vec("rest");
    expect(reach(r, "index1")).toBeGreaterThan(0.165);
    expect(dist(tipOf(r, "thumb1"), tipOf(r, "index1"))).toBeLessThan(0.1);
    // nắm: đầu ngón cái vắt trước mặt lòng bàn tay, ngang chỗ các ngón đã cuộn
    expect(tipOf(vec("fist"), "thumb1")[0]).toBeGreaterThan(HAND_BONES.palm.half[0]);
  });

  it("hai bàn tay soi gương qua mặt phẳng giữa; lòng tay quay về phía thân", () => {
    for (const k of HAND_POSE_KINDS)
      for (const f of ["thumb1", "index1", "middle1"] as const) {
        const [r, l] = [tipOf(vec(k), f, -1), tipOf(vec(k), f, 1)];
        expect(l[0]).toBeCloseTo(-r[0], 12);
        expect(l[1]).toBeCloseTo(r[1], 12);
        expect(l[2]).toBeCloseTo(r[2], 12);
      }
    // tay phải (−x) cuộn ngón về +x
    expect(tipOf(vec("fist"), "index1", -1)[0]).toBeGreaterThan(0);
    expect(handGrip(-1)[0]).toBeGreaterThan(0);
    expect(handGrip(1)[0]).toBeLessThan(0);
  });

  it("`handVec`: tên dáng, phần `w` hoà từ dáng nghỉ, không có dáng là dáng nghỉ", () => {
    expect(handVec("fist")).toEqual(vec("fist"));
    expect(handVec({ pose: "fist", w: 0 })).toEqual(vec("rest"));
    expect(handVec({ turn: 30 })).toEqual([30, ...vec("rest").slice(1)]);
    const half = handVec({ pose: "fist", w: 0.5, turn: 40, bend: -10 });
    expect(half.slice(0, 2)).toEqual([40, -10]);
    half
      .slice(2)
      .forEach((v, i) => expect(v).toBeCloseTo((vec("rest")[i + 2] + vec("fist")[i + 2]) / 2, 12));
  });

  it("nang va chạm đi theo dáng: trỏ duỗi thì nang trỏ dài, nắm thì mọi nang gọn trong lòng tay", () => {
    const span = (v: number[]) =>
      Math.max(...handCapsules(v, -1).map(([a, b]) => Math.max(-a[1], -b[1])));
    expect(span(vec("point"))).toBeGreaterThan(0.16);
    expect(span(vec("fist"))).toBeLessThan(0.115);
  });
});

const WAVE = {
  name: "wave-hand",
  duration: 1,
  end: "hold",
  mask: ["hand"],
  keys: [
    { t: 0, pose: {}, hand: { armNear: {} }, ease: "smooth" },
    { t: 1, pose: {}, hand: { armNear: { pose: "fist", turn: 80 } } },
  ],
};

describe("kênh `hand` của hành động", () => {
  it(`đời ${ACTION_VERSION}: nội suy góc khớp giữa hai mốc theo \`ease\``, () => {
    const a = action(WAVE);
    expect(ACTION_VERSION).toBe(18);
    const mid = actionHand(a, 0.3).an!;
    const f = smoothstep(0.3);
    const want = vec("rest").map((v, i) => v + ((i === 0 ? 80 : vec("fist")[i]) - v) * f);
    mid.forEach((v, i) => expect(v).toBeCloseTo(want[i], 9));
    expect(actionHand(a, 0.3).af).toBeUndefined();
    expect(actionPose(a, 1).hand?.an?.[0]).toBe(80);
  });

  it("mốc ghi bàn tay tự thêm `hand` vào `mask`; `mask` khai tường minh mà thiếu `hand` thì kêu và không ghi", () => {
    const free = { ...WAVE, mask: undefined };
    expect(actionMask(action(free))).toContain("hand");
    const bad = action({ ...WAVE, mask: ["armNear"] });
    expect(maskProblems(bad).join()).toMatch(/`hand`/);
    expect(actionHand(bad, 0.5)).toEqual({});
  });

  it("xoay cẳng tay, gập cổ tay quá `±90` là lỗi; tay năm số (xoắn vai) hợp lệ, sáu số thì không", () => {
    const k = (hand: object) => ({ keys: [{ t: 0, pose: {}, hand: { armNear: hand } }] });
    expect(parseAction(k({ turn: 95 })).success).toBe(false);
    expect(parseAction(k({ bend: -100 })).success).toBe(false);
    expect(parseAction(k({ pose: "wave" })).success).toBe(false);
    // dáng nghỉ không soạn được: bỏ trống `pose`; không có góc ngón thô
    for (const v of ["relaxed", "pinch", "thumbsUp"]) {
      expect(parseAction(k({ pose: v })).success).toBe(false);
      expect(parseAction({ keys: [{ t: 0, pose: {}, hand: { armNear: v } }] }).success).toBe(false);
    }
    expect(parseAction(k({ fingers: [0, 0, 0, 0, 0, 0, 0, 0, 0] })).success).toBe(false);
    expect(parseAction(k({})).success).toBe(true);
    expect(parseAction({ keys: [{ t: 0, pose: { armNear: [0, 90, 0, 90, 90] } }] }).success).toBe(
      true,
    );
    expect(
      parseAction({ keys: [{ t: 0, pose: { armNear: [0, 90, 0, 90, 90, 1] } }] }).success,
    ).toBe(false);
  });

  it("file đời 17 nâng lên mà không đổi gì", () => {
    const old = {
      ...WAVE,
      schemaVersion: 17,
      mask: ["armNear"],
      keys: [{ t: 0, pose: { armNear: [0, 0, 0] } }],
    };
    const a = action(old);
    expect(a.schemaVersion).toBe(ACTION_VERSION);
    expect(a.keys![0].pose).toEqual({ armNear: [0, 0, 0] });
  });
});

describe("ghép và hoà bàn tay", () => {
  const fist = vec("fist");
  const point = vec("point");

  it("track ghi bàn tay một bên không xoá bàn tay bên kia của track dưới; track không ghi thì giữ", () => {
    const p = composePose(
      POSES.idle,
      { hand: { af: fist, an: fist } },
      { hand: { an: point } },
      {},
    );
    expect(p.hand).toEqual({ af: fist, an: point });
  });

  it("hoà trên góc khớp theo smoothstep; bên không ghi lấy của track dưới, không có thì thả lỏng", () => {
    const base = { ...POSES.idle, hand: { af: point } };
    const o = blendPose(base, { hand: { an: fist } }, { hand: { an: point, af: fist } }, 0.5);
    o.hand!.an!.forEach((v, i) => expect(v).toBeCloseTo((fist[i] + point[i]) / 2, 9));
    o.hand!.af!.forEach((v, i) => expect(v).toBeCloseTo((point[i] + fist[i]) / 2, 9));
    const rest = blendPose(POSES.idle, {}, { hand: { an: fist } }, 0.25).hand!.an!;
    rest.forEach((v, i) =>
      expect(v).toBeCloseTo(HAND_REST[i] + (fist[i] - HAND_REST[i]) * smoothstep(0.25), 9),
    );
    expect(blendDuration(POSES.idle, {}, { hand: { an: fist } })).toBeGreaterThan(0.12);
  });

  it("scene: clip sau đổi dáng tay hoà dần, không nhảy; `clips[].mask` cắt được kênh `hand`", () => {
    const ACTIONS = {
      a: action({
        name: "a",
        duration: 1,
        end: "hold",
        keys: [{ t: 0, pose: {}, hand: { armNear: "open" } }],
      }),
      b: action({
        name: "b",
        duration: 1,
        end: "hold",
        keys: [{ t: 0, pose: {}, hand: { armNear: "fist" } }],
      }),
    };
    const scene = (mask?: string[]) => {
      const r = parseScene({
        name: "s",
        cast: [
          {
            id: "x",
            character: "x.json",
            tracks: [
              {
                clips: [
                  { action: "a", start: 0 },
                  { action: "b", start: 1, blend: 0.4, ...(mask && { mask }) },
                ],
              },
            ],
          },
        ],
      });
      if (!r.success) throw new Error(r.error.message);
      return resolveScene(r.data, ACTIONS, {}, {});
    };
    const rt = scene();
    let prev = sceneAt(rt, "x", 0.9).pose.hand!.an!;
    expect(prev).toEqual(vec("open"));
    for (let t = 0.92; t < 1.6; t += 1 / 30) {
      const v = sceneAt(rt, "x", t).pose.hand!.an!;
      expect(Math.max(...v.map((x, i) => Math.abs(x - prev[i])))).toBeLessThan(20);
      prev = v;
    }
    expect(prev).toEqual(vec("fist"));
    // clip sau thu `mask` không có `hand`: track không còn ghi bàn tay, người 3D về thả lỏng
    expect(sceneAt(scene(["armNear"]), "x", 2).pose.hand).toBeUndefined();
  });
});

describe("lưới bàn tay liền", () => {
  const sizes = [
    [1, 1, false],
    [1.75, 1.52, false],
    [1.75, 1.52, true],
  ] as const;

  it("một lưới kín, mặt quay ra ngoài, trọng số mỗi đỉnh cộng lại bằng 1; dựng một lần rồi giữ", () => {
    for (const [k, long, low] of sizes) {
      const s = handSkin(-1, k, long, low);
      expect(handSkin(-1, k, long, low)).toBe(s);
      const half = new Set<string>();
      for (let i = 0; i < s.index.length; i += 3)
        for (let e = 0; e < 3; e++) half.add(`${s.index[i + e]},${s.index[i + ((e + 1) % 3)]}`);
      for (const h of half) expect(half.has(h.split(",").reverse().join(","))).toBe(true);
      let vol = 0;
      const P = s.pos;
      for (let i = 0; i < s.index.length; i += 3) {
        const [a, b, c] = [s.index[i] * 3, s.index[i + 1] * 3, s.index[i + 2] * 3];
        vol +=
          P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) -
          P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c]) +
          P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
      }
      expect(vol).toBeGreaterThan(0);
      for (let v = 0; v < s.pos.length / 3; v++) {
        let sum = 0;
        for (let b = 0; b < HAND_PIECES.length; b++) sum += s.weights[v * HAND_PIECES.length + b];
        expect(sum).toBeCloseTo(1, 5);
      }
      expect(s.pos.length / 3).toBeLessThan(low ? 1000 : 3000);
    }
  });

  it("đủ năm chuỗi đốt; năm đầu ngón riêng ở dáng xoè; ngón út ngắn và cuộn sâu nhất khi nắm", () => {
    expect(HAND_PIECES).toEqual([
      "palm",
      "thumb0",
      "thumb1",
      "index0",
      "index1",
      "middle0",
      "middle1",
      "ring0",
      "ring1",
      "pinky0",
      "pinky1",
    ]);
    const tips = (["index1", "middle1", "ring1", "pinky1"] as const).map((f) =>
      tipOf(vec("open"), f),
    );
    // xoè: bốn đầu ngón xếp theo z từ phía ngón cái sang út, ngón giữa dài nhất, út ngắn nhất
    for (let i = 1; i < 4; i++) expect(tips[i][2]).toBeLessThan(tips[i - 1][2]);
    expect(-tips[1][1]).toBeGreaterThan(-tips[2][1]);
    expect(-tips[3][1]).toBeLessThan(-tips[2][1]);
  });

  it("da ở dáng gốc là chính lưới; tay trái soi gương tay phải", () => {
    const s = handSkin(-1, 1.75, 1.52);
    const out = new Float32Array(s.pos.length);
    skinHand(s, HAND_BIND, out);
    out.forEach((v, i) => expect(v).toBeCloseTo(s.pos[i], 4));
    const l = handSkin(1, 1.75, 1.52);
    for (let i = 0; i < s.pos.length; i += 3) expect(l.pos[i]).toBeCloseTo(-s.pos[i], 6);
  });

  it("nắm tay thì da co về lòng bàn tay, đầu ngón không văng: mọi đỉnh trong tầm khung xương", () => {
    const s = handSkin(-1, 1, 1);
    const out = new Float32Array(s.pos.length);
    skinHand(s, vec("fist"), out);
    let low = 0;
    for (let i = 1; i < out.length; i += 3) low = Math.min(low, out[i]);
    expect(-low).toBeLessThan(0.13);
    skinHand(s, vec("point"), out);
    low = 0;
    for (let i = 1; i < out.length; i += 3) low = Math.min(low, out[i]);
    expect(-low).toBeGreaterThan(0.17);
  });

  it("nang va chạm ôm da ở mọi dáng: lòi dưới 1,5 % cỡ trước khi nới, `fitCapsules` nới chừng ấy là không đỉnh nào lòi", () => {
    const seg = (p: V3, a: V3, b: V3) => {
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const w = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
      const t = Math.min(
        1,
        Math.max(
          0,
          (w[0] * d[0] + w[1] * d[1] + w[2] * d[2]) / (d[0] ** 2 + d[1] ** 2 + d[2] ** 2),
        ),
      );
      return Math.hypot(w[0] - t * d[0], w[1] - t * d[1], w[2] - t * d[2]);
    };
    const worst = (caps: [V3, V3, number][], pos: Float32Array) => {
      let m = -Infinity;
      for (let i = 0; i < pos.length; i += 3) {
        const p: V3 = [pos[i], pos[i + 1], pos[i + 2]];
        m = Math.max(m, Math.min(...caps.map(([a, b, r]) => seg(p, a, b) - r)));
      }
      return m;
    };
    const poses = [vec("rest"), ...HAND_POSE_KINDS.map(vec), handVec({ pose: "fist", w: 0.5 })];
    for (const [k, long] of [
      [1, 1],
      [1.75, 1.52],
    ])
      for (const side of [-1, 1]) {
        const s = handSkin(side, k, long);
        const out = new Float32Array(s.pos.length);
        for (const v of poses) {
          skinHand(s, v, out);
          const caps = handCapsules(v, side, k, long);
          expect(worst(caps, out)).toBeLessThan(0.015 * k);
          const fit = fitCapsules(caps, out);
          expect(worst(fit, out)).toBeLessThan(1e-9);
          fit.forEach(([, , r], i) => expect(r - caps[i][2]).toBeLessThan(0.015 * k));
        }
      }
  });
});
