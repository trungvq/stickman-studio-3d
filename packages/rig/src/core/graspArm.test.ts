import { describe, expect, it } from "vitest";
import { markShape, trunk3, type ActInput } from "./act3";
import {
  armInput,
  armSeg,
  evalPhi,
  phiAt,
  phiChain,
  solvePhi,
  wristAngles,
  type ArmInput,
  type ArmSeg,
} from "./graspArm";
import { wristTurn } from "./hand";
import { HOLD_SLEW_STEP } from "./heldItem";
import { fromColumns, matMul, matVec, rotZ, type V3 } from "./lens";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";

// người mẫu đứng cầm bảng ở t = 1, số đối chiếu của prototype bước 0 (docs/11-nhom-cam.md § Khuỷu tự nhiên)
const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const T = trunk3(parsed.data, { pose: fx.pose, world: fx.world } as unknown as ActInput)!;
const shape = markShape(T);
const RIGHT = -1;
const LEFT = 1;
const inR = armInput(T, RIGHT, shape);
const inL = armInput(T, LEFT, shape);

const pt = (p: readonly number[]): V3 => [p[0] / 100, -p[1] / 100, -p[2] / 100];
const dir = (d: readonly number[]): V3 => [d[0], -d[1], -d[2]];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const wrapD = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

/** Cổ tay và khung bàn tay của một bản ghi `ca.json`: lòng tay `Rw·[−side, 0, 0]`, ngón `Rw·[0, −1, 0]`, cạnh cái `Rw·z` */
function handOf(h: { wrist: number[]; palm: number[]; fingers: number[] }, side: number) {
  const x = unit(dir(h.palm).map((v) => -side * v) as V3);
  const y0 = dir(h.fingers).map((v) => -v) as V3;
  const y = unit(sub(y0, x.map((v) => v * dot(y0, x)) as V3));
  return { Wp: pt(h.wrist), Rw: fromColumns(x, y, cross(x, y)) };
}

describe("graspArm", () => {
  it("dựng vai và mức nền lấn như prototype", () => {
    const S = fx.ca.shoulders;
    for (const [inp, s] of [
      [inR, S.right],
      [inL, S.left],
    ] as const)
      for (let i = 0; i < 3; i++) expect(Math.abs(inp.S[i] - pt(s)[i]) * 100).toBeLessThan(0.05);
    expect(Math.max(...inR.rest)).toBeCloseTo(fx.ca.restAllowMax, 1);
    expect(Math.max(...inL.rest)).toBeCloseTo(fx.ca.restAllowMax, 1);
  });

  it("tách góc cổ tay đúng nghịch của wristTurn", () => {
    for (const side of [RIGHT, LEFT])
      for (const [t, b, d] of [
        [30, -20, 10],
        [-75, 40, -15],
        [120, 10, 5],
      ]) {
        const a = wristAngles(wristTurn(t, b, d, side), side);
        expect(a.turn).toBeCloseTo(t, 6);
        expect(a.bend).toBeCloseTo(b, 6);
        expect(a.dev).toBeCloseTo(d, 6);
      }
  });

  it("giải φ bằng đúng 40 lần thử, tất định", () => {
    const { Wp, Rw } = handOf(fx.ca.c1, RIGHT);
    const a = solvePhi(inR, Wp, Rw);
    const b = solvePhi(inR, Wp, Rw);
    expect(a.tries).toBe(40);
    expect(b).toEqual(a);
  });

  it.each([
    ["c1", fx.ca.c1],
    ["c2", fx.ca.c2],
  ] as const)("ra lại ca %s của bước 0", (_, c) => {
    const { Wp, Rw } = handOf(c, RIGHT);
    const x = solvePhi(inR, Wp, Rw);
    expect(Math.abs(wrapD(x.phi - c.phi))).toBeLessThanOrEqual(2.5);
    const [turn, bend, dev] = c.wristAngles;
    expect(Math.abs(x.wrist.turn - turn)).toBeLessThanOrEqual(3);
    expect(Math.abs(x.wrist.bend - bend)).toBeLessThanOrEqual(3);
    expect(Math.abs(x.wrist.dev - dev)).toBeLessThanOrEqual(3);
    expect(x.gap).toBe(0);
    expect(x.body).toBe(0);
  });

  it("ngoài tầm với: khe dương, cánh tay duỗi thẳng về cổ tay", () => {
    const fwd = matVec(T.Rr, [0, 0, 1]);
    const Wp: V3 = [inR.S[0] + fwd[0] * 2, inR.S[1] + fwd[1] * 2 - 0.3, inR.S[2] + fwd[2] * 2];
    const x = solvePhi(inR, Wp, T.Rr);
    expect(x.gap).toBeCloseTo((len(sub(Wp, inR.S)) - inR.l1 - inR.l2) * 100, 6);
    expect(x.gap).toBeGreaterThan(0);
    const reach = len(sub(x.elbow, inR.S)) + len(sub(x.reach, x.elbow));
    expect(len(sub(x.reach, inR.S))).toBeCloseTo(reach, 9);
    expect(dot(unit(sub(x.reach, inR.S)), unit(sub(Wp, inR.S)))).toBeCloseTo(1, 9);
  });

  it("xoay cẳng tay quá 90° báo over.turn", () => {
    const { Wp } = handOf(fx.ca.c1, RIGHT);
    const base = evalPhi(inR, Wp, T.Rr, 30);
    const Rw = matMul(base.fore, wristTurn(120, 10, 5, RIGHT));
    const x = evalPhi(inR, Wp, Rw, 30);
    expect(x.wrist.turn).toBeCloseTo(120, 6);
    expect(x.wrist.over.turn).toBeCloseTo(30, 6);
    expect(x.wrist.over.bend).toBe(0);
    expect(x.terms.over).toBeGreaterThan(0);
  });

  it("tay buông thõng không lấn sau khi trừ mức nền", () => {
    const Rsh = matMul(T.Rs, rotZ(RIGHT * T.roots.splay));
    const down = matVec(Rsh, [0, -1, 0]);
    const Wp = inR.S.map((v, i) => v + down[i] * (inR.l1 + inR.l2)) as V3;
    const x = solvePhi(inR, Wp, Rsh);
    expect(x.body).toBeLessThan(0.05);
    const bare: ArmInput = { ...inR, rest: inR.rest.map(() => 0) };
    expect(evalPhi(bare, Wp, Rsh, x.phi).body).toBeCloseTo(fx.ca.restAllowMax, 1);
  });

  it("tay trượt (ca 5, tay trái): hai mẫu liền lệch ≤ 2,5°, khớp bước 0", () => {
    const L = fx.ca.c5Left;
    const at = (t: number) => {
      const i = Math.round(t / HOLD_SLEW_STEP);
      const h = L[i];
      const other: ArmSeg = { S: inR.S, E: pt(h.other.elbow), W: pt(h.other.wrist) };
      return { inp: inL, ...handOf(h, LEFT), other };
    };
    const chain = phiChain(0, 0.6, at);
    expect(chain).toHaveLength(L.length);
    for (let i = 1; i < chain.length; i++) {
      expect(Math.abs(wrapD(chain[i].sol.phi - chain[i - 1].sol.phi))).toBeLessThanOrEqual(2.5);
      expect(chain[i].sol.terms.cont).toBeGreaterThanOrEqual(0);
    }
    expect(chain[0].sol.terms.cont).toBe(0);
    chain.forEach((c, i) => expect(Math.abs(wrapD(c.sol.phi - L[i].phi))).toBeLessThanOrEqual(2.5));
    expect(phiChain(0, 0.6, at)).toEqual(chain);
    const mid = phiAt(chain, 1.5 * HOLD_SLEW_STEP);
    expect(mid).toBeCloseTo((chain[1].sol.phi + chain[2].sol.phi) / 2, 9);
  });

  it("tay giải sau tính tay đã đặt vào lấn", () => {
    const h = fx.ca.c5Left[0];
    const { Wp, Rw } = handOf(h, LEFT);
    const sR = solvePhi(inR, pt(h.other.wrist), T.Rr);
    const other = armSeg(inR, sR);
    expect(other).toEqual({ S: inR.S, E: sR.elbow, W: sR.reach });
    const x = evalPhi(inL, Wp, Rw, 12.5, undefined, other);
    const y = evalPhi(inL, Wp, Rw, 12.5);
    expect(x.terms.body).toBeGreaterThanOrEqual(y.terms.body);
    const far: ArmSeg = { S: [9, 9, 9], E: [9, 9, 10], W: [9, 9, 11] };
    expect(evalPhi(inL, Wp, Rw, 12.5, undefined, far).E).toBe(y.E);
  });
});
