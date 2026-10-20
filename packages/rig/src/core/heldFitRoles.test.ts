import { describe, expect, it } from "vitest";
import { fingerVec, HAND_FIT, HAND_PIECES, HAND_POSES, HAND_REST, type HandPose } from "./hand";
import { handSkin, skinHand } from "./handMesh";
import {
  FINGER_ROLES,
  fingerClearance,
  HELD_FIT,
  heldFit,
  HELD_ROLE_CURL,
  skinBulge,
  skinDepth,
  skinPieces,
  type FingerRole,
  type FingerRoles,
  type HeldFitInput,
} from "./heldFit";
import { graspFrame } from "./graspSolve";
import { HELD_SINK } from "./heldAudit";
import { handDims, itemGeom } from "./heldGeom";
import { parseHeldItem } from "./heldItem";
import type { V3 } from "./lens";
import grip from "./__fixtures__/grip-frames.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";

const I = [1, 0, 0, 0, 1, 0, 0, 0, 1] as HeldFitInput["G"]["R"];
const FINGERS = ["thumb", "index", "middle", "ring", "pinky"] as const;
const all = (r: FingerRole) => Object.fromEntries(FINGERS.map((f) => [f, r]));
const rodZ = (r: number): HeldFitInput["shape"] => [{ cyl: r, from: [0, 0, -15], to: [0, 0, 15] }];

/** Bàn tay phải cỡ `1` dáng `pose`, món đặt không xoay ở `p` (khung bàn tay) */
const hold = (pose: HandPose, shape: HeldFitInput["shape"], p: V3): HeldFitInput => ({
  v: [0, 0, ...fingerVec(HAND_POSES[pose])],
  side: -1,
  k: 1,
  long: 1,
  shape,
  G: { R: I, p, u: 0.01 },
});

describe("heldFit không có `roles`: đường `wrap` cũ, cùng số", () => {
  const cases: [HeldFitInput, number[]][] = [
    [
      {
        ...hold("grip", rodZ(2.5), [0.04, -0.088, 0]),
        wrap: ["thumb", "index", "middle", "ring", "pinky"],
      },
      [54.765625, 0, 0, -19.765625, 0, -20.078125, 0, -48.90625, -21.09375, -52.96875],
    ],
    [
      {
        ...hold("grip", rodZ(0.8), [-0.05, -0.1, 0]),
        side: 1,
        k: 1.3,
        long: 1.15,
        wrap: ["index", "middle"],
      },
      [0, 0, 3.046875, 3.046875, 2.65625, 2.65625, 0, -7.734375, 0, -43.828125],
    ],
    [
      {
        ...hold("sheet", [{ box: [0.4, 20, 30], at: [0, -5, 0] }], [0.045, -0.13, 0]),
        wrap: ["thumb", "index", "middle", "ring", "pinky"],
      },
      [-11.171875, -32.890625, 0, 0, 0, 0, 0, 0, 0, -18],
    ],
    [
      {
        ...hold("edge", rodZ(1.2), [0.035, -0.2, 0]),
        k: 1.75,
        long: 1.5446,
        G: { R: I, p: [0.035, -0.2, 0], u: 0.0175 },
        wrap: ["thumb", "index"],
      },
      [0, 0, -21.25, 54.453125, -23.828125, 0, -22.265625, 0, -18.046875, -17.96875],
    ],
  ];

  it("số chụp từ đường cũ", () => {
    for (const [inp, want] of cases) expect(heldFit(inp)).toEqual(want);
  });

  it("`roles` chỉ có `wrap`/`support`, không `bulge`: trùng đường `wrap`", () => {
    for (const [inp, want] of cases) {
      const roles = Object.fromEntries((inp.wrap ?? []).map((f) => [f, "wrap" as const]));
      expect(heldFit({ ...inp, wrap: undefined, roles })).toEqual(want);
    }
  });
});

describe("heldFit theo vai trò", () => {
  it("bảng tầm cuộn theo vai trò", () => {
    expect(FINGER_ROLES.map((r) => HELD_ROLE_CURL[r])).toEqual([40, 75, 30, 0, 0, 0]);
  });

  it("`press`: cuộn tới chạm, mỗi đốt không quá 40°; `wrap` cùng chỗ cuộn quá", () => {
    const inp = hold("open", rodZ(0.8), [0.03, -0.12, 0]);
    const wrap = heldFit({ ...inp, roles: all("wrap") });
    const press = heldFit({ ...inp, roles: all("press") });
    expect(Math.max(...wrap)).toBeGreaterThan(HELD_ROLE_CURL.press);
    for (const x of press) expect(x).toBeLessThanOrEqual(HELD_ROLE_CURL.press + 1e-9);
    expect(press[HAND_FIT.indexOf("index0")]).toBeGreaterThan(0);
  });

  it("`tip`: đốt gốc giữ dáng, chỉ đốt ngọn cuộn, không quá 30°", () => {
    const inp = hold("open", rodZ(0.8), [0.03, -0.16, 0]);
    const tip = heldFit({ ...inp, roles: all("tip") });
    HAND_FIT.forEach((n, i) => {
      if (n.endsWith("0")) expect(tip[i], n).toBe(0);
      else expect(tip[i], n).toBeLessThanOrEqual(HELD_ROLE_CURL.tip + 1e-9);
    });
    expect(tip[HAND_FIT.indexOf("index1")]).toBeGreaterThan(0);
  });

  it("`support`, `free`, `extend` không cuộn khi món ở xa; `free` hoà nửa về dáng nghỉ", () => {
    const far = hold("grip", rodZ(0.8), [0.5, -0.12, 0]);
    expect(heldFit({ ...far, roles: all("support") })).toEqual(HAND_FIT.map(() => 0));
    expect(heldFit({ ...far, roles: all("extend") })).toEqual(HAND_FIT.map(() => 0));
    const free = heldFit({ ...far, roles: all("free") });
    const base = { thumb: 4, index: 6, middle: 8, ring: 8, pinky: 8 };
    FINGERS.forEach((f, j) =>
      [0, 1].forEach((s) => {
        const i = base[f] + s;
        expect(free[2 * j + s], `${f}${s}`).toBeCloseTo((HAND_REST[i] - far.v[i]) / 2, 9);
      }),
    );
  });

  it("`extend` gỡ lún chỉ bằng mở; `support` cùng chỗ gập", () => {
    const inp = hold("open", rodZ(2), [0.01, -0.14, 0]);
    const support = heldFit({ ...inp, roles: all("support") });
    const extend = heldFit({ ...inp, roles: all("extend") });
    expect(Math.max(...support)).toBeGreaterThan(0);
    for (const x of extend) expect(x).toBeLessThanOrEqual(0);
    expect(Math.min(...extend)).toBeLessThan(0);
  });

  it("vai trò lẻ: ngón không khai là `support`; lòng tay không đổi số", () => {
    const inp = hold("open", rodZ(0.8), [0.03, -0.12, 0]);
    const a = heldFit({ ...inp, roles: { index: "press" } });
    const b = heldFit({ ...inp, roles: { ...all("support"), index: "press", palm: "press" } });
    expect(a).toEqual(b);
  });
});

describe("tự hiệu chỉnh da", () => {
  const skin = handSkin(-1, 1, 1);

  it("`skinBulge` cỡ `1` khớp số đo bước 0 (đơn vị rig)", () => {
    const sheet = skinBulge(skin, [0, 0, ...fingerVec(HAND_POSES.sheet)]);
    const pinch = skinBulge(skin, [0, 0, ...fingerVec(HAND_POSES.pinch)]);
    const rig = (b: Record<string, number>, n: string) => b[n] / 0.01;
    expect(rig(sheet, "palm")).toBeGreaterThan(0.9);
    expect(rig(sheet, "palm")).toBeLessThan(1.3);
    expect(rig(sheet, "thumb0")).toBeGreaterThan(1.28);
    expect(rig(sheet, "thumb0")).toBeLessThan(1.86);
    expect(rig(pinch, "thumb1")).toBeCloseTo(0.69, 1);
    for (const n of HAND_PIECES) expect(rig(pinch, n), n).toBeLessThan(1.9);
  });

  it("`bulge`: ngón ôm nhắm `touch` trên nang phình thêm `δ`; không `roles` thì bỏ qua", () => {
    const inp = hold("open", rodZ(0.8), [0.04, -0.12, 0]);
    const bulge = Object.fromEntries(HAND_PIECES.map((n) => [n, 0.005]));
    const roles = { index: "wrap" } as const;
    const plain = heldFit({ ...inp, roles });
    const fat = heldFit({ ...inp, roles, bulge });
    const bare = (fit: number[]) => Math.min(...fingerClearance(inp, [...inp.v, ...fit]).index);
    expect(fat[HAND_FIT.indexOf("index0")]).toBeLessThan(plain[HAND_FIT.indexOf("index0")]);
    expect(bare(plain)).toBeCloseTo(HELD_FIT.touch, 1);
    expect(bare(fat)).toBeCloseTo(HELD_FIT.touch + 0.5, 1);
    expect(heldFit({ ...inp, wrap: ["index"], bulge })).toEqual(
      heldFit({ ...inp, wrap: ["index"] }),
    );
  });
});

describe("`skinDepth`: lún đo trên đỉnh da", () => {
  it("điểm biết trước dưới tấm phẳng", () => {
    const plate: HeldFitInput["shape"] = [{ box: [40, 1, 40] }];
    const pos = [0, 0.003, 0, 0, 0.012, 0, 0, -0.002, 0.05];
    const piece = [HAND_PIECES.indexOf("index1"), HAND_PIECES.indexOf("palm"), 0];
    const { depth, gaps } = skinDepth(pos, piece, { R: I, p: [0, 0, 0], u: 0.01 }, plate);
    expect(depth).toBeCloseTo(0.3, 9);
    expect(gaps.index).toBeCloseTo(-0.2, 9);
    expect(gaps.palm).toBeCloseTo(-0.3, 9);
    expect(gaps.thumb).toBe(Infinity);
  });

  it("da bàn tay ép lên tấm nghiêng: lún 0,5 ±0,05", () => {
    const skin = handSkin(-1, 1.3, 1.15);
    const pos = new Float32Array(skin.pos.length);
    skinHand(skin, [0, 0, ...fingerVec(HAND_POSES.sheet)], pos);
    const piece = skinPieces(skin);
    expect(piece.length).toBe(pos.length / 3);
    const l = Math.hypot(1, -0.4, 0.3);
    const n: V3 = [1 / l, -0.4 / l, 0.3 / l];
    // khung món: trục x là pháp tuyến `n`, hai trục kia vuông góc
    const t0 = Math.hypot(n[0], n[1]);
    const b: V3 = [-n[1] / t0, n[0] / t0, 0];
    const c: V3 = [n[1] * b[2] - n[2] * b[1], n[2] * b[0] - n[0] * b[2], n[0] * b[1] - n[1] * b[0]];
    let top = -Infinity;
    for (let i = 0; i < pos.length; i += 3)
      top = Math.max(top, n[0] * pos[i] + n[1] * pos[i + 1] + n[2] * pos[i + 2]);
    const u = 0.01;
    const plane = top - 0.5 * u;
    const IF = {
      R: [n[0], b[0], c[0], n[1], b[1], c[1], n[2], b[2], c[2]] as HeldFitInput["G"]["R"],
      p: [n[0] * plane, n[1] * plane, n[2] * plane] as V3,
      u,
    };
    const { depth, gaps } = skinDepth(pos, piece, IF, [{ box: [20, 400, 400], at: [10, 0, 0] }]);
    expect(Math.abs(depth - 0.5)).toBeLessThan(0.05);
    expect(Math.min(...Object.values(gaps))).toBeCloseTo(-depth, 9);
  });
});

describe("`palmBox` mặc định trên điện thoại: trỏ–áp út `press` tì cạnh kia", () => {
  const phone = parseHeldItem(dienThoai);
  if (!phone.success) throw new Error(phone.error.message);
  const spec = phone.data;
  const geom = itemGeom(spec);
  const fix = (grip as unknown as Record<string, Record<string, { k: number; long: number }>>)[
    "dien-thoai#doc"
  ];
  /** Khe da từng ngón và lún da sâu nhất (0 khi không lún), đơn vị món */
  const measure = (size: string, side: number, roles?: FingerRoles) => {
    const { k, long } = fix[size];
    const g = graspFrame(spec, geom, { group: "palmBox" }, side, handDims(k, long), k, long);
    const skin = handSkin(side, k, long);
    const fit = heldFit({
      v: g.pose,
      side,
      k,
      long,
      shape: spec.shape!,
      G: g.G,
      roles: roles ?? g.roles,
      bulge: skinBulge(skin, g.pose),
    });
    const pos = new Float32Array(skin.pos.length);
    skinHand(skin, [...g.pose, ...fit], pos);
    const { gaps } = skinDepth(pos, skinPieces(skin), g.G, spec.shape!);
    return { gaps, sink: Math.max(0, -Math.min(...Object.values(gaps))) };
  };
  // khe trỏ, giữa, áp út của kiểu v1 `dien-thoai#doc` (bang-cam, giây 0,5)
  const v1 = { "t01-sakura": [0.1, 0.2, 0.1], kuroiwa: [0.2, 0.3, 0.2] } as const;

  it("khe trỏ–áp út không quá mức v1 + 0,3, hai cỡ tay, hai tay", () => {
    for (const size of ["t01-sakura", "kuroiwa"] as const)
      for (const side of [-1, 1]) {
        const { gaps } = measure(size, side);
        (["index", "middle", "ring"] as const).forEach((f, i) =>
          expect(gaps[f], `${size} ${side} ${f}`).toBeLessThanOrEqual(v1[size][i] + 0.3),
        );
      }
  });

  it("lún da không quá vai trò `tip` + 0,1; tay lớn không quá `HELD_SINK`", () => {
    const tip = {
      thumb: "press",
      index: "tip",
      middle: "tip",
      ring: "tip",
      palm: "press",
    } as const;
    for (const size of ["t01-sakura", "kuroiwa"])
      for (const side of [-1, 1]) {
        const a = measure(size, side);
        expect(a.sink, `${size} ${side}`).toBeLessThanOrEqual(measure(size, side, tip).sink + 0.1);
        if (size === "kuroiwa") expect(a.sink).toBeLessThanOrEqual(HELD_SINK);
      }
  });
});
