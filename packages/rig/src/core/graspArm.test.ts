import { describe, expect, it } from "vitest";
import { markShape, trunk3, type ActInput } from "./act3";
import { ARM_SOFT, prefPole, softReach } from "./elbow";
import {
  armInput,
  armSeg,
  elbowInward,
  evalPhi,
  IN_FREE,
  phiAt,
  phiBasis,
  phiChain,
  solvePhi,
  wristAngles,
  type ArmInput,
  type ArmSeg,
  type ArmSol,
} from "./graspArm";
import { wristTurn } from "./hand";
import { HELD_ELBOW } from "./heldAudit";
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
const D2R = Math.PI / 180;
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

  it("giải φ bằng 23 lần thử (22 nút lưới cố định 10° phủ ±90° quanh khuỷu ưu tiên, rồi lấy liền), tất định", () => {
    const { Wp, Rw } = handOf(fx.ca.c1, RIGHT);
    const a = solvePhi(inR, Wp, Rw);
    const b = solvePhi(inR, Wp, Rw);
    expect(a.tries).toBe(23);
    expect(b).toEqual(a);
  });

  it("ca c1 của bước 0: khuỷu gần hướng ưu tiên, cổ tay trong tầm, không lấn", () => {
    const { Wp, Rw } = handOf(fx.ca.c1, RIGHT);
    const x = solvePhi(inR, Wp, Rw);
    expect(Math.abs(x.phi)).toBeLessThan(15);
    expect(x.wrist.over).toEqual({ turn: 0, bend: 0, dev: 0 });
    expect(x.inward).toBeLessThan(0);
    expect(x.gap).toBe(0);
    expect(x.body).toBe(0);
  });

  it("ca c2 của bước 0: khung bàn tay ấy chỉ với tới bằng khuỷu gập ngược — khuỷu giữ dáng tự nhiên, cổ tay kẹp, `check` báo `wrist`", () => {
    const { Wp, Rw } = handOf(fx.ca.c2, RIGHT);
    const x = solvePhi(inR, Wp, Rw);
    expect(x.inward).toBeLessThan(HELD_ELBOW);
    expect(Math.abs(x.phi)).toBeLessThan(15);
    expect(x.wrist.over.turn + x.wrist.over.dev).toBeGreaterThan(30);
    // khuỷu gập ngược mới với tới khung bàn tay ấy
    expect(evalPhi(inR, Wp, Rw, fx.ca.c2.phi).inward).toBeGreaterThan(-0.1);
  });

  it("ngoài tầm với: khe dương, cánh tay duỗi theo soft IK về cổ tay", () => {
    const fwd = matVec(T.Rr, [0, 0, 1]);
    const Wp: V3 = [inR.S[0] + fwd[0] * 2, inR.S[1] + fwd[1] * 2 - 0.3, inR.S[2] + fwd[2] * 2];
    const x = solvePhi(inR, Wp, T.Rr);
    const L = inR.l1 + inR.l2;
    const d = len(sub(Wp, inR.S));
    expect(x.gap).toBeCloseTo((d - softReach(d, L, ARM_SOFT * L)) * 100, 6);
    expect(x.gap).toBeGreaterThan((d - L) * 100);
    expect(len(sub(x.reach, inR.S))).toBeLessThan(L);
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
    // không trừ mức nền thì bắp tay buông lấn thân (tới mức nền của tay buông thẳng)
    const bare: ArmInput = { ...inR, rest: inR.rest.map(() => 0) };
    const b = evalPhi(bare, Wp, Rsh, x.phi).body;
    expect(b).toBeGreaterThan(1);
    expect(b).toBeLessThanOrEqual(fx.ca.restAllowMax + 0.05);
  });

  it("tay trượt (ca 5, tay trái): hai mẫu liền lệch ≤ 4°, đổi đều", () => {
    const L = fx.ca.c5Left;
    const at = (t: number) => {
      const i = Math.round(t / HOLD_SLEW_STEP);
      const h = L[i];
      const other: ArmSeg = { S: inR.S, E: pt(h.other.elbow), W: pt(h.other.wrist) };
      return { inp: inL, ...handOf(h, LEFT), other };
    };
    const chain = phiChain(0, 0.6, at);
    expect(chain).toHaveLength(L.length);
    const step = (i: number) => wrapD(chain[i].sol.phi - chain[i - 1].sol.phi);
    for (let i = 1; i < chain.length; i++) {
      expect(Math.abs(step(i))).toBeLessThanOrEqual(4);
      if (i > 1) expect(Math.abs(step(i) - step(i - 1))).toBeLessThanOrEqual(1.5);
      expect(chain[i].sol.terms.cont).toBeGreaterThanOrEqual(0);
    }
    expect(chain[0].sol.terms.cont).toBe(0);
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

describe("chuỗi φ và gốc φ", () => {
  const at = (phi: number) => ({ phi }) as ArmSol;
  const ang = (a: V3, b: V3) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) / D2R;

  it("`phiAt` qua ranh ±180° đi đường ngắn nhất", () => {
    const chain = [
      { t: 0, sol: at(170) },
      { t: HOLD_SLEW_STEP, sol: at(-170) },
    ];
    expect(Math.abs(phiAt(chain, HOLD_SLEW_STEP / 2))).toBeCloseTo(180, 9);
    expect(phiAt(chain, HOLD_SLEW_STEP / 4)).toBeCloseTo(175, 9);
    expect(phiAt(chain, (3 * HOLD_SLEW_STEP) / 4)).toBeCloseTo(-175, 9);
  });

  it("`phiChain`: `t1` không chia hết bước thì mẫu cuối là mẫu đầu tiên không trước `t1`", () => {
    const q = { inp: inL, ...handOf(fx.ca.c5Left[0], LEFT) };
    const [t0, t1] = [0.2, 0.2 + 2.5 * HOLD_SLEW_STEP];
    const chain = phiChain(t0, t1, () => q);
    expect(chain).toHaveLength(4);
    chain.forEach((c, i) => expect(c.t).toBeCloseTo(t0 + i * HOLD_SLEW_STEP, 12));
    expect(chain[3].t).toBeGreaterThanOrEqual(t1);
    expect(chain[2].t).toBeLessThan(t1);
  });

  it("gốc `φ` là khuỷu ưu tiên của cổ tay, đổi êm khi trục vai → cổ tay đi qua phương đứng", () => {
    const r = 0.8 * (inR.l1 + inR.l2);
    const pole = (a: number, az: number) => {
      const h = matVec(T.Rr, [Math.sin(az * D2R), 0, Math.cos(az * D2R)]);
      const c = Math.sqrt(1 - a * a);
      const n: V3 = [h[0] * a, -c + h[1] * a, h[2] * a];
      const Wp: V3 = [inR.S[0] + n[0] * r, inR.S[1] + n[1] * r, inR.S[2] + n[2] * r];
      const x = evalPhi(inR, Wp, T.Rr, 0);
      expect(Number.isFinite(x.E)).toBe(true);
      return { n, p: x.pole, Wp };
    };
    for (let az = 0; az < 360; az += 45) {
      const { n, p, Wp } = pole(0.35, az);
      const want = prefPole(inR.Rr, inR.side, inR.S, Wp, inR.l1 + inR.l2);
      const d = sub(want, n.map((v) => v * dot(want, n)) as V3);
      expect(ang(p, d)).toBeLessThan(1e-4);
      expect(ang(phiBasis(inR, Wp).d0, d)).toBeLessThan(1e-4);
    }
    // trục ngả ra trước, sang hai bên, qua phương đứng: gốc `φ` đổi dần, không nhảy
    for (const az of [0, 90, -90, 180]) {
      let prev = pole(0, az).p;
      for (let a = 0.01; a <= 0.4; a += 0.01) {
        const { p } = pole(a, az);
        expect(ang(p, prev)).toBeLessThan(5);
        prev = p;
      }
    }
  });

  it("khuỷu gập ngược: `inward` dương khi khuỷu lệch vào giữa thân hay lên trên; cổ tay dưới vai thì phạt `W_IN` phần vượt khuỷu ưu tiên", () => {
    const { Wp, Rw } = handOf(fx.ca.c1, RIGHT);
    const x0 = evalPhi(inR, Wp, Rw, 0);
    let hi = -Infinity;
    for (let p = -180; p < 180; p += 5) {
      const x = evalPhi(inR, Wp, Rw, p);
      expect(x.inward).toBeCloseTo(elbowInward(inR, Wp, x.elbow), 9);
      hi = Math.max(hi, x.inward);
      // phạt chỉ phần vượt độ lệch của khuỷu ưu tiên (`IN_FREE` ở đây vì khuỷu ưu tiên không gập ngược)
      if (x.inward <= Math.max(IN_FREE, x0.inward)) expect(x.terms.inward).toBe(0);
      else expect(x.terms.inward).toBeGreaterThan(0);
    }
    // khuỷu ưu tiên thõng ra ngoài; xoay nửa vòng thì khuỷu chĩa vào trong hay lên
    expect(x0.inward).toBeLessThan(0);
    expect(hi).toBeGreaterThan(0.3);
  });
});
