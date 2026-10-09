import { describe, expect, it } from "vitest";

import { figureAnchors } from "./anchor";
import { D, QUARTER, SCENE_CANVAS } from "./constants";
import { FRONT_MIN, HEAD_LOOK, dirOf, facing, figure3d, limbHalf, type World } from "./figure3d";
import { lengths } from "./geometry";
import { orbit, project, type Lens, type V3 } from "./lens";
import { POSES } from "./poses";
import { defaultCharacter } from "./schema";
import { torsoPaths } from "./torso";
import type { Pose } from "./types";

const c = defaultCharacter();
const lens = orbit({ target: [0, -120, 0], dist: 750, yaw: 45 * D, pitch: 16 * D, f: 800 });
const SEAT = -127;
const sit: Pose = {
  ...POSES.sit,
  lf: [90, -90],
  ln: [90, -90],
  af: [11, 42, 0],
  an: [11, 42, 0],
  torso: 3,
  lift: { af: true, an: true, lf: true, ln: true },
};
const worldAt = (yaw: number, hip: V3): World => {
  const f = facing(lens, hip, yaw);
  return { lens, hip, yaw: f.yaw, s: 1, flip: f.flip, theta: f.theta };
};
const seated = (yaw: number) => worldAt(yaw, [0, SEAT - limbHalf(c).leg, 0]);

describe("người 3D", () => {
  it("không có góc chính diện tuyệt đối: thân quay thẳng vào ống kính bị đẩy ra FRONT_MIN", () => {
    const toCam = Math.atan2(-(lens.eye[2] - 0), lens.eye[0] - 0);
    const f = facing(lens, [0, 0, 0], toCam);
    expect(f.theta).toBeCloseTo(FRONT_MIN, 6);
    expect(f.flip).toBe(false);
    // quay lưng thẳng không khoá
    expect(facing(lens, [0, 0, 0], toCam + Math.PI).theta).toBeCloseTo(180, 6);
  });

  it("ngồi đúng: đùi nằm ngang trên mặt ngồi, mặt dưới đùi chạm mặt ghế", () => {
    for (const yaw of [0, Math.PI / 2, -Math.PI / 2]) {
      const f3 = figure3d(c, sit, seated(yaw));
      const leg = f3.solids.filter((s) => s.part === "legNear" || s.part === "legFar");
      for (const s of leg) expect(Math.max(...s.v.map((p) => p[1]))).toBeCloseTo(SEAT, 6);
      const torso = f3.solids.find((s) => s.part === "torso")!;
      expect(Math.max(...torso.v.map((p) => p[1]))).toBeCloseTo(SEAT, 6);
    }
  });

  it("đứng chân choãi: đáy ống chân nằm ngang đúng cao độ bàn chân, không lún qua sàn", () => {
    const stand: Pose = { ...POSES.idle, lf: [-12, 0], ln: [14, 0] };
    const f3 = figure3d(c, stand, worldAt(0, [0, -200, 0]));
    for (const [part, foot] of [
      ["shinNear", f3.joints.footNear],
      ["shinFar", f3.joints.footFar],
    ] as const) {
      const v = f3.solids.find((s) => s.part === part)!.v;
      for (const p of v.slice(4)) expect(p[1]).toBeCloseTo(foot[1], 9);
      expect(Math.max(...v.map((p) => p[1]))).toBeCloseTo(foot[1], 9);
    }
  });

  it("chuỗi chi đã vẽ: đầu chi đúng chỗ chiếu thật, gốc ở vành thân, hình chuỗi đồng dạng hình chiếu", () => {
    const w = seated(0);
    const fa = figureAnchors(c, sit, { body: "rear", head: "rear" }, "closed", w);
    const f3 = fa.fig3!;
    const [hx, hy] = project(lens, w.hip);
    const P = (j: keyof typeof f3.joints) => project(lens, f3.joints[j]);
    const drawn = fa.fig.legN;
    const k = f3.k;
    const [fx, fy] = P("footNear");
    expect(drawn[2][0]).toBeCloseTo((fx - hx) / k, 6);
    expect(drawn[2][1]).toBeCloseTo((fy - hy) / k, 6);
    expect(drawn[0]).toEqual(f3.legN[0]);
    // góc giữa đùi và dây gốc → đầu chi giữ như hình chiếu
    const ang = (a: number[], b: number[], c2: number[]) =>
      Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.atan2(c2[1] - a[1], c2[0] - a[0]);
    expect(ang(drawn[0], drawn[1], drawn[2])).toBeCloseTo(
      ang(P("hipNear"), P("kneeNear"), P("footNear")),
      6,
    );
  });

  it("kênh không nâng giữ 2D: góc trên mặt khung như rig 2D", () => {
    const w = seated(0);
    const flat: Pose = { ...sit, lift: { lf: true, ln: true } };
    const fa = figureAnchors(c, flat, { body: "rear", head: "rear" }, "closed", w);
    const [sh, el] = fa.fig.armN;
    const a = Math.atan2(el[0] - sh[0], el[1] - sh[1]) / D;
    expect(a).toBeCloseTo(flat.an[0], 6);
  });

  describe("gốc chi, cổ, đầu trên khung là điểm thật đã chiếu", () => {
    // px khung 1920 cho một đơn vị sân khấu
    const PX = SCENE_CANVAS.video.w / SCENE_CANVAS.w;
    const lensAt = (pitch: number) =>
      orbit({ target: [0, -120, 0], dist: 750, yaw: 45 * D, pitch: pitch * D, f: 800 });
    const turned = (L: Lens, theta: number, side: number): World => {
      const hip: V3 = [0, SEAT - limbHalf(c).leg, 0];
      const toCam = Math.atan2(-(L.eye[2] - hip[2]), L.eye[0] - hip[0]);
      const f = facing(L, hip, toCam + side * theta * D);
      return { lens: L, hip, yaw: f.yaw, s: 1, flip: f.flip, theta: f.theta };
    };
    const px = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1]) * PX;
    const cases = [0, 16, 30, 50].flatMap((pitch) =>
      [45, 90, 135].flatMap((theta) => [1, -1].map((side) => ({ pitch, theta, side }))),
    );
    const sculpt = {
      ...c,
      pieces: { ...c.pieces, torso: { ...c.pieces.torso, src: "sculpt" as const } },
    };
    // khoảng cách có dấu tới hình bao, dương ở trong
    const inside = (poly: number[][], [x, y]: number[]) => {
      let n = false;
      let d = Infinity;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [ax, ay] = poly[j];
        const [bx, by] = poly[i];
        if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) n = !n;
        const [ex, ey] = [bx - ax, by - ay];
        const u = Math.max(
          0,
          Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1)),
        );
        d = Math.min(d, Math.hypot(ax + u * ex - x, ay + u * ey - y));
      }
      return n ? d : -d;
    };

    it.each(cases)("cúi $pitch°, θ $theta° ($side)", ({ pitch, theta, side }) => {
      const L = lensAt(pitch);
      const w = turned(L, theta, side);
      for (const ch of [c, sculpt]) {
        const fa = figureAnchors(ch, sit, { body: "side", head: "side" }, "closed", w);
        const f3 = fa.fig3!;
        const mx = w.flip ? -1 : 1;
        const deg = fa.frames.torso.deg * D;
        const fromTorso = ([x, y]: number[]) => [
          x * Math.cos(deg) - y * Math.sin(deg),
          x * Math.sin(deg) + y * Math.cos(deg),
        ];
        const onScreen = ([x, y]: number[]) => [
          f3.screen[0] + mx * f3.k * x,
          f3.screen[1] + f3.k * y,
        ];
        const real = (j: keyof typeof f3.joints) => project(L, f3.joints[j]);
        expect(px(onScreen(fa.fig.legN[0]), real("hipNear"))).toBeLessThanOrEqual(3);
        expect(px(onScreen(fa.fig.legF[0]), real("hipFar"))).toBeLessThanOrEqual(3);
        expect(px(onScreen(fromTorso(fa.fig.shN)), real("shoulderNear"))).toBeLessThanOrEqual(3);
        expect(px(onScreen(fromTorso(fa.fig.shF)), real("shoulderFar"))).toBeLessThanOrEqual(3);
        // cổ và tâm đầu: thân co theo góc cúi, đầu hạ theo
        const at = (f: { x: number; y: number }) => onScreen([f.x, f.y]);
        expect(px(at(fa.joints.collar.frame), real("neck"))).toBeLessThanOrEqual(3);
        expect(px(at(fa.joints.head.frame), real("head"))).toBeLessThanOrEqual(3);
      }
    });

    it("hai gốc vai, hai gốc chân nằm trong viền thân áo dựng khối chiếu thật", () => {
      // hình bao đã co vào nửa nét, nét viền vẽ dày gấp đôi bên dưới: mép ngoài của viền cách nó `stroke`
      const edge = -sculpt.rig.stroke;
      for (const { pitch, theta, side } of cases) {
        const w = turned(lensAt(pitch), theta, side);
        const fa = figureAnchors(sculpt, sit, { body: "rear", head: "rear" }, "closed", w);
        const body = torsoPaths(sculpt, fa.bodyYaw, sculpt.rig.stroke, fa.fig3!.torsoLens)
          .body.slice(1, -1)
          .split("L")
          .map((q) => q.trim().split(/\s+/).map(Number));
        const deg = fa.frames.torso.deg * D;
        for (const p of [fa.fig.shN, fa.fig.shF]) expect(inside(body, p)).toBeGreaterThan(edge);
        for (const [x, y] of [fa.fig.legN[0], fa.fig.legF[0]])
          expect(
            inside(body, [
              x * Math.cos(deg) + y * Math.sin(deg),
              -x * Math.sin(deg) + y * Math.cos(deg),
            ]),
          ).toBeGreaterThan(edge);
      }
    });

    it("sọ nhận `HEAD_LOOK` phần góc ống kính nhìn xuống đầu", () => {
      const look = (pitch: number) => {
        const w = turned(lensAt(pitch), 90, 1);
        const fa = figureAnchors(sculpt, sit, QUARTER, "closed", w);
        const h = fa.fig3!.joints.head;
        const e = w.lens.eye;
        const down = Math.atan2(h[1] - e[1], Math.hypot(h[0] - e[0], h[2] - e[2])) / D;
        return { got: fa.face.turn.look!, want: HEAD_LOOK * down };
      };
      for (const pitch of [0, 16, 30, 50]) {
        const { got, want } = look(pitch);
        expect(got).toBeCloseTo(want, 0);
      }
      expect(look(50).got).toBeGreaterThan(look(16).got);
    });

    it("người 2D không đổi: không có `world` thì thân nhìn từ `TORSO_TILT`, cổ đủ dài, sọ không nhận `look`", () => {
      const len = lengths(sculpt.rig.height);
      for (const view of ["front", "quarter", "side", "rear", "back"] as const) {
        const fa = figureAnchors(sculpt, { ...sit, torso: 0 }, { body: view, head: view });
        expect(fa.fig3).toBeUndefined();
        expect(fa.face.turn.look).toBeUndefined();
        expect(fa.joints.collar.frame.y).toBeCloseTo(-(len.torso + len.neck), 9);
        expect(fa.frames.head.y).toBeCloseTo(-(len.torso + len.neck), 9);
        expect(fa.slots.torso.box).toEqual(torsoPaths(sculpt, fa.bodyYaw, sculpt.rig.stroke).box);
      }
    });

    it("người sát mặt phẳng ống kính: gốc chi không chiếu ra vô cực", () => {
      const L = lensAt(16);
      const w = turned(L, 90, 1);
      const F = dirOf(w.yaw);
      // mắt ngay cạnh vai gần, nhìn dọc theo hướng mặt của người
      const eye: V3 = [w.hip[0] + F[0] * 5, w.hip[1] - 90, w.hip[2] + F[2] * 5];
      const near: Lens = { ...L, eye, yaw: Math.atan2(F[0], F[2]), pitch: 0 };
      const f3 = figure3d(c, sit, { ...w, lens: near });
      for (const p of [f3.shN, f3.shF, f3.legN[0], f3.legF[0]])
        for (const v of p) expect(Math.abs(v)).toBeLessThan(200);
    });
  });
});

describe("mặt người 3D", () => {
  const solid = {
    ...c,
    pieces: { ...c.pieces, hair: { ...c.pieces.hair, src: "sculpt" as const } },
  };
  const toCam = Math.atan2(-lens.eye[2], lens.eye[0]);
  // Quay dần từ chính diện ra sau lưng, mặt luôn hướng sang phải khung
  const sweep = Array.from({ length: 161 }, (_, i) => {
    const w = worldAt(toCam - (20 + i) * D, [0, 0, 0]);
    const A = figureAnchors(solid, POSES.idle, QUARTER, "closed", w);
    const F = A.face;
    return {
      theta: w.theta,
      flip: w.flip,
      free: F.free!,
      near: F.cx - F.eyeGap / 2 - F.headCx,
      far: F.cx + F.eyeGap / 2 - F.headCx,
      mouth: F.mouthCx - F.headCx,
    };
  });
  const at = (theta: number) =>
    sweep.reduce((a, b) => (Math.abs(b.theta - theta) < Math.abs(a.theta - theta) ? b : a));

  it("chỉ người 3D có tóc dựng khối mới quay mặt liên tục", () => {
    const w = worldAt(toCam - 60 * D, [0, 0, 0]);
    expect(figureAnchors(c, POSES.idle, QUARTER, "closed", w).face.free).toBeUndefined();
    expect(figureAnchors(solid, POSES.idle, QUARTER).face.free).toBeUndefined();
    expect(sweep.every((s) => !s.flip)).toBe(true);
  });

  it("mắt và mồm đi một chiều suốt vòng quay, không giật ngược", () => {
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i].theta).toBeGreaterThan(sweep[i - 1].theta);
      for (const k of ["near", "far", "mouth"] as const)
        expect(sweep[i][k]).toBeGreaterThanOrEqual(sweep[i - 1][k] - 1e-6);
    }
  });

  it("mắt xa tắt quanh 70°, mắt gần quanh 108°, và tắt rồi thì không hiện lại", () => {
    expect(at(60).free.far).toBeGreaterThan(0);
    expect(at(75).free.far).toBe(0);
    expect(at(100).free.near).toBeGreaterThan(0);
    expect(at(115).free.near).toBe(0);
    for (const k of ["near", "far"] as const) {
      const off = sweep.findIndex((s) => s.free[k] === 0);
      expect(sweep.slice(off).every((s) => s.free[k] === 0)).toBe(true);
    }
  });

  it("mắt gần giữ oval của đầu `side` quanh 90°", () => {
    expect(at(90).free.near).toBeGreaterThanOrEqual(0.7);
  });
});
