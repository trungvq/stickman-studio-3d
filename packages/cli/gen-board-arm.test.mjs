import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import * as rig from "@stickman3d/rig/core";
import {
  armAngles,
  clampWrist,
  cross3,
  elbowAt,
  perp3,
  poleDeg,
  shoulderOf,
  sub3,
  unit3,
} from "./gen-board-arm.mjs";

const raw = JSON.parse(
  readFileSync(new URL("../../common/characters/sample-man.json", import.meta.url), "utf8"),
);
const parsed = rig.parseCharacter(raw);
const c = parsed.success ? parsed.data : raw;

/** Số ngẫu nhiên lặp lại được */
const rand = (() => {
  let x = 7;
  return (lo, hi) => {
    x = (x * 16807) % 2147483647;
    return lo + ((x - 1) / 2147483646) * (hi - lo);
  };
})();
const turnDiff = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const dist = (a, b) => Math.hypot(...sub3(a, b));

/** Người ngồi, hai tay góc ngẫu nhiên (đã nhấc kênh), bàn tay xoay, gập ngẫu nhiên */
function randomSp() {
  const arm = () => [rand(-40, 85), rand(5, 140), rand(-25, 15), rand(-10, 50), rand(-60, 60)];
  const hand = () => [rand(-80, 80), rand(-50, 60), ...rig.HAND_REST.slice(2)];
  const [ar, al] = [arm(), arm()];
  const [hr, hl] = [hand(), hand()];
  return {
    want: { [-1]: [...ar, hr[0], hr[1]], 1: [...al, hl[0], hl[1]] },
    sp: {
      pose: {
        ar,
        al,
        lr: [90, -90, 0],
        ll: [80, -80, 5],
        torso: rand(-10, 30),
        lean: rand(-10, 10),
        head: [0, 0, 0],
        stretch: [1, 1, 1, 1],
        lift: { ar: true, al: true, lr: true, ll: true },
        hand: { ar: hr, al: hl },
      },
      world: {
        hip: [rand(-100, 100), -100, rand(-100, 100)],
        yaw: rand(0, 360),
        s: rand(0.8, 1.2),
        seated: true,
      },
    },
  };
}

describe("gen-board-arm", () => {
  it("nghịch phép dựng tay của rig: khớp rig vẽ → góc khuỷu (`poleDeg`) → `elbowAt` → góc tay, bàn tay như đã đặt", () => {
    for (let n = 0; n < 60; n++) {
      const { want, sp } = randomSp();
      const T = rig.trunk3(c, sp);
      for (const side of [-1, 1]) {
        const A = rig.actArm(c, sp, side);
        assert.ok(dist(shoulderOf(T, side).S, A.S) < 1e-6, "vai như `arm3`");
        const e = elbowAt(T, side, A.W, A.Rw, poleDeg(T, side, A.W, A.E));
        assert.ok(dist(e.E, A.E) < 1e-6, "khuỷu đúng chỗ rig vẽ");
        assert.ok(e.miss < 1e-6);
        const w = want[side];
        const got = [...armAngles(T, side, e.f, e.w.dev, [w[0], w[3]]), e.w.turn, e.w.bend];
        got.forEach((v, i) => assert.ok(turnDiff(v, w[i]) < 1e-3, `${side} #${i}: ${w} → ${got}`));
      }
    }
  });
  it("khuỷu quanh trục vai → cổ tay: `poleDeg` nghịch `elbowAt` ở mọi góc", () => {
    const { sp } = randomSp();
    const T = rig.trunk3(c, sp);
    const A = rig.actArm(c, sp, -1);
    for (let deg = -170; deg < 180; deg += 20) {
      const e = elbowAt(T, -1, A.W, A.Rw, deg);
      assert.ok(turnDiff(poleDeg(T, -1, e.W, e.E), deg) < 1e-6, `${deg}`);
    }
  });
  it("cổ tay vượt tầm thì kẹp: góc trong tầm rig, khung bàn tay đúng như rig dựng lại, lệch khỏi đích bằng phần kẹp", () => {
    const { sp } = randomSp();
    const T = rig.trunk3(c, sp);
    const A = rig.actArm(c, sp, 1);
    const e0 = elbowAt(T, 1, A.W, A.Rw, poleDeg(T, 1, A.W, A.E));
    assert.equal(clampWrist(e0, A.Rw, 1).off, 0);
    // đích bàn tay quay thêm quanh trục cẳng tay quá tầm xoay
    const Re = rig.matMul(e0.f.R, rig.rotX(-e0.f.b));
    const R = rig.matMul(Re, rig.wristTurn(rig.TURN_MAX + 20, 10, 0, 1));
    const e = elbowAt(T, 1, A.W, R, e0.deg);
    assert.ok(e.wOver > 19);
    const k = clampWrist(e, R, 1);
    assert.ok(
      Math.abs(k.w.turn) <= rig.TURN_MAX &&
        k.w.bend <= rig.AIM_BEND[1] &&
        k.w.dev >= rig.AIM_DEV[0],
    );
    assert.ok(Math.abs(k.off - 20.5) < 0.6, `${k.off}`);
    const back = rig.matMul(Re, rig.wristTurn(k.w.turn, k.w.bend, k.w.dev, 1));
    back.forEach((v, i) => assert.ok(Math.abs(v - k.Rw[i]) < 1e-9));
  });
  it("hàm vectơ: `perp3`, `cross3` vuông góc", () => {
    const n = unit3([1, 2, 3]);
    const p = perp3([0, 1, 0], n);
    assert.ok(Math.abs(p[0] * n[0] + p[1] * n[1] + p[2] * n[2]) < 1e-12);
    const q = cross3(n, p);
    assert.ok(Math.abs(q[0] * p[0] + q[1] * p[1] + q[2] * p[2]) < 1e-12);
  });
});
