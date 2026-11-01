import { describe, expect, it } from "vitest";
import { actArm, type ActInput } from "./act3";
import { body3 } from "./figure3d";
import { gimbalBlend, wristOver, yawFrame } from "./graspArm";
import { matMul, matVec, type M3, type V3 } from "./lens";
import { parseScene, resolveScene, sceneAt } from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";

// Ý định nhường ở giới hạn cổ tay (docs/11-nhom-cam.md § Khuỷu tự nhiên)

const parsed = parseCharacter(fx.character);
if (!parsed.success) throw new Error("nguoi");
const NGUOI = parsed.data;
const H = NGUOI.rig.height;
const DIMS = body3(NGUOI);
const D = Math.PI / 180;

function runtime(yaw: number, hands: unknown[], duration = 3) {
  const r = parseScene({
    duration,
    lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
    cast: [{ id: "nguoi", world: { at: [250, 0, 506], yaw, hands } }],
  });
  if (!r.success) throw new Error(r.error.message);
  const rt = resolveScene(r.data, {}, { nguoi: H }, { nguoi: DIMS });
  rt.chars = { nguoi: NGUOI };
  return rt;
}

const tr = (R: M3): M3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];
const sub = (a: readonly number[], b: readonly number[]): V3 => [
  a[0] - b[0],
  a[1] - b[1],
  a[2] - b[2],
];
const len = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);
const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
const rotDeg = (A: M3, B: M3) => {
  const M = matMul(tr(A), B);
  return Math.acos(Math.max(-1, Math.min(1, (M[0] + M[4] + M[8] - 1) / 2))) / D;
};
const overOf = (w: readonly number[]) => {
  const o = wristOver(...gimbalBlend([wrap(w[0]), w[1], wrap(w[2])]));
  return Math.max(o.turn, o.bend, o.dev);
};

/** Tay phải ở `t`: khuỷu, cổ tay (so với vai) và khung bàn tay trong hệ thân (three), góc cổ tay vẽ, độ nhường */
function arm(rt: ReturnType<typeof runtime>, t: number) {
  const sp = sceneAt(rt, "nguoi", t, H, DIMS) as ActInput;
  const a = actArm(NGUOI, sp, -1)!;
  const Rr = yawFrame(sp.world!.yaw);
  const body = (p: V3) => matVec(tr(Rr), sub(p, a.S));
  return {
    E: body(a.E),
    W: body(a.W),
    R: matMul(tr(Rr), a.Rw),
    wrist: a.wrist,
    yield: a.trace?.yield ?? 0,
  };
}

// lòng tay ngửa, ngón về sau ở trước ngực: cẳng tay không xoay tới, ý định phải nhường
const FAR = { to: "chest", offset: [38, 10, 18], point: "grip", palm: "up", fingers: "back" };

describe("ý định nhường ở giới hạn cổ tay", () => {
  it("ý định quá tầm: bàn tay nhường về trong giới hạn, điểm bàn tay vẫn đúng đích", () => {
    const rt = runtime(270, [{ t: 0, right: FAR }]);
    const a = arm(rt, 0);
    expect(a.yield).toBeGreaterThan(15);
    expect(overOf(a.wrist)).toBeLessThan(1);
    const sp = sceneAt(rt, "nguoi", 0, H, DIMS) as ActInput;
    expect(actArm(NGUOI, sp, -1)!.report.reach!.gap).toBeLessThan(0.5);
  });

  it("không phụ thuộc hướng người trong thế giới: cùng đích hệ thân, cùng ý định ra cùng tay ở mọi `yaw`", () => {
    const ref = arm(runtime(270, [{ t: 0, right: FAR }]), 0);
    for (const yaw of [0, 37, 155, 200, 315]) {
      const a = arm(runtime(yaw, [{ t: 0, right: FAR }]), 0);
      expect(len(sub(a.E, ref.E)), `${yaw}`).toBeLessThan(1e-6);
      expect(len(sub(a.W, ref.W)), `${yaw}`).toBeLessThan(1e-6);
      expect(rotDeg(a.R, ref.R), `${yaw}`).toBeLessThan(1e-4);
    }
  });

  it("liền qua ranh mốc: bàn tay nhường không nhảy ở mốc", () => {
    const rt = runtime(270, [
      { t: 0, right: { ...FAR, offset: [30, 0, 10] } },
      { t: 1, right: FAR },
      { t: 2, right: { ...FAR, offset: [42, 20, 25], fingers: "out" } },
    ]);
    for (const t0 of [1, 2]) {
      const [a, b, c] = [arm(rt, t0 - 1e-4), arm(rt, t0), arm(rt, t0 + 1e-4)];
      expect(rotDeg(a.R, b.R), `${t0}`).toBeLessThan(0.05);
      expect(rotDeg(b.R, c.R), `${t0}`).toBeLessThan(0.05);
      expect(len(sub(a.E, c.E)), `${t0}`).toBeLessThan(0.01);
    }
  });

  /** Bước quay lớn nhất (độ) của bàn tay vẽ giữa hai khung 60 fps trong 2 s, độ nhường lớn nhất, độ vượt lớn nhất */
  function sweep(hands: unknown[]) {
    const rt = runtime(270, hands);
    let prev = arm(rt, 0);
    const out = { step: 0, yield: 0, over: 0 };
    for (let i = 1; i <= 120; i++) {
      const a = arm(rt, i / 60);
      out.step = Math.max(out.step, rotDeg(prev.R, a.R));
      out.yield = Math.max(out.yield, a.yield);
      out.over = Math.max(out.over, overOf(a.wrist));
      prev = a;
    }
    return out;
  }
  const at = { to: "chest", offset: [40, 5, 22], point: "grip", fingers: "forward" };

  it("ý định đi qua giới hạn từ từ: bàn tay quay liền theo ý định, không nhảy khi bắt đầu nhường, cổ tay vẽ trong giới hạn", () => {
    // lòng tay từ úp (trong tầm) quay 63° về ra ngoài chếch xuống (quá tầm xoay)
    const r = sweep([
      { t: 0, right: { ...at, palm: "down" } },
      { t: 2, right: { ...at, palm: [0, 0.5, 1] } },
    ]);
    expect(r.yield).toBeGreaterThan(10);
    expect(r.over).toBeLessThan(1);
    // ý định quay 63° theo `smoothstep` trong 120 khung (trung bình 0,53°, đỉnh 0,8° một khung); khuỷu xoay theo nên bàn tay
    // nhanh hơn chút, không có cú nhảy
    expect(r.step).toBeLessThan(2);
  });

  it("ý định đòi ngược hẳn tầm xoay: bàn tay về dần giữa tầm, không lật mép này sang mép kia", () => {
    const r = sweep([
      { t: 0, right: { ...at, palm: "down" } },
      { t: 2, right: { ...at, palm: "out" } },
    ]);
    expect(r.yield).toBeGreaterThan(20);
    expect(r.over).toBeLessThan(1);
    expect(r.step).toBeLessThan(10);
  });
});
