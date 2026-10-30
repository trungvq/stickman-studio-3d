// Năm kịch bản đi của docs/14-di-muot.md mục 2, viết tay đúng JSON của spec, cho test số đo và video.
// Toạ độ dời vào giữa `plainRoom()` (x −700…700, z −300…900) để tường không che; ống kính đứng yên góc 3/4.
import { D } from "../constants";

type Key = { t: number; at: [number, number, number]; yaw: number; steps?: number };

export interface WalkScene {
  name: string;
  title: string;
  /** Mốc dừng, góc, cung, quay tại chỗ: cửa sổ dải khung dày của mục 4 */
  strips: { label: string; from: number; to: number }[];
  scene: (height: number, character: string) => unknown;
}

/** Sải mỗi chu kỳ của `walk` chung ở `height` 1, nền `idle` (`actionStride`) */
export const WALK_STRIDE = 277.6;
export const WALK_SPEED = 250;

const r1 = (x: number) => Math.round(x * 10) / 10;
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const floor3 = (x: number) => Math.floor(x * 1000 + 1e-6) / 1000;
const cycleOf = (height: number) => r3((WALK_STRIDE * height) / WALK_SPEED);

/** Mốc theo dây cung thật giữa các điểm đã tròn, cùng tốc `WALK_SPEED` (luật 1) */
function timed(points: { at: [number, number]; yaw: number }[], t0 = 0): Key[] {
  let t = t0;
  const at = points.map((p) => [r1(p.at[0]), r1(p.at[1])]);
  return points.map((p, i) => {
    if (i) t += Math.hypot(at[i][0] - at[i - 1][0], at[i][1] - at[i - 1][1]) / WALK_SPEED;
    return { t: r3(t), at: [at[i][0], 0, at[i][1]], yaw: p.yaw };
  });
}

/** Cung tâm `c` bán kính `r` từ yaw `y0` tới `y1`, mỗi `30°` một mốc, yaw tiếp tuyến; `sigma` `+1` vòng phải (về −z) */
function arc(c: [number, number], r: number, y0: number, y1: number, sigma = 1) {
  const n = Math.ceil(Math.abs(y1 - y0) / 30 - 1e-9);
  return Array.from({ length: n + 1 }, (_, i) => {
    const psi = y0 + ((y1 - y0) * i) / n;
    return {
      at: [c[0] + r * Math.sin(psi * D), c[1] + sigma * r * Math.cos(psi * D)] as [number, number],
      yaw: psi,
    };
  });
}

/** Ống kính đứng yên nhìn trọn hộp đường đi từ phía trước – trái, cúi xuống `pitch` độ */
function lensFor(path: Key[], height: number) {
  const xs = path.map((k) => k.at[0]);
  const zs = path.map((k) => k.at[2]);
  const top = -440 * height;
  const pad = 40;
  const box = [
    Math.min(...xs) - pad,
    Math.max(...xs) + pad,
    Math.min(...zs) - pad,
    Math.max(...zs) + pad,
  ];
  const c: [number, number, number] = [(box[0] + box[1]) / 2, top / 2, (box[2] + box[3]) / 2];
  const az = -35 * D;
  const pitch = 24;
  const f = 1100;
  const dirH = [Math.sin(az), -Math.cos(az)];
  const corners: [number, number, number][] = [];
  for (const x of [box[0], box[1]])
    for (const z of [box[2], box[3]]) for (const y of [0, top]) corners.push([x, y, z]);
  const lensAt = (d: number) => {
    const flat = d * Math.cos(pitch * D);
    const eye: [number, number, number] = [
      c[0] + dirH[0] * flat,
      c[1] - d * Math.sin(pitch * D),
      c[2] + dirH[1] * flat,
    ];
    return { eye, yaw: Math.atan2(c[0] - eye[0], c[2] - eye[2]) / D, pitch, f, cx: 0, cy: 0 };
  };
  const fits = (d: number) => {
    const L = lensAt(d);
    const [cy, sy] = [Math.cos(L.yaw * D), Math.sin(L.yaw * D)];
    const [cp, sp] = [Math.cos(pitch * D), Math.sin(pitch * D)];
    return corners.every((p) => {
      const v = [p[0] - L.eye[0], p[1] - L.eye[1], p[2] - L.eye[2]];
      const x = v[0] * cy - v[2] * sy;
      const zz = v[0] * sy + v[2] * cy;
      const y = v[1] * cp - zz * sp;
      const z = v[1] * sp + zz * cp;
      return Math.abs((f * x) / z) < 0.47 * 1280 && Math.abs((f * y) / z) < 0.46 * 720;
    });
  };
  let d = 600;
  while (!fits(d) && d < 8000) d += 25;
  const L = lensAt(d);
  return { ...L, eye: L.eye.map(r1), yaw: r1(L.yaw) };
}

function sceneOf(
  name: string,
  path: Key[],
  clips: { action: string; start: number; cycle?: number; blend?: number }[],
  height: number,
  character: string,
  hold = 0.6,
) {
  const [dx, dz] = OFFSET[name] ?? [0, 0];
  const moved = path.map((k) => ({ ...k, at: [r1(k.at[0] + dx), 0, r1(k.at[2] + dz)] }));
  return {
    lens: lensFor(moved as Key[], height),
    duration: r3(path[path.length - 1].t + hold),
    cast: [
      {
        id: "a",
        character,
        world: { path: moved },
        tracks: [{ name: "chan", clips: clips.map((c) => ({ blend: 0.3, ...c })) }],
      },
    ],
  };
}

/** Dời toạ độ mỗi kịch bản vào giữa phòng (tâm hộp đường đi về `[0, 300]`) */
const OFFSET: Record<string, [number, number]> = {
  "K1-di-thang": [-375, 300],
  "K1-di-thang-blend0": [-375, 300],
  "K1-dung-roi-di": [-375, 300],
  "K2-re-nhe": [-477, 405],
  "K2-re-nhe-trai": [-477, 194],
  "K3-re-90": [-250, 550],
  "K3-re-90-yaw0": [-250, 550],
  "K3-re-90-yaw0-het": [-250, 550],
  "K3-re-90-trai": [-250, 50],
  "K3-re-90-cung": [-250, 550],
  "K4-quay-trai": [-250, 300],
  "K4-quay-phai": [-250, 300],
  "K5-vong-phai": [-262, 425],
  "K5-vong-trai": [-262, 175],
};

const walkClip = (start: number, height: number) => ({
  action: "walk",
  start,
  cycle: cycleOf(height),
});
const stand = (stop: number, height: number) => ({
  action: "stand-3d",
  start: floor3(stop - cycleOf(height) / 4),
});

/** Cửa sổ dải khung của mục 4 */
const cornerWin = (t: number, theta: number) => ({
  label: `re-${t.toFixed(2)}`,
  from: r3(t - 0.35 - 0.25),
  to: r3(t + Math.abs(theta) / 150 + 0.5),
});
const stopWin = (t: number, c = 1.11) => ({
  label: `dung-${t.toFixed(2)}`,
  from: r3(t - c / 2 - 0.3),
  to: r3(t + 0.6),
});

/** Rẽ 90° ở giây 2: `sigma` `+1` phải (về −z); `yaw` mốc giữa, mốc cuối khai tay */
const k3 =
  (yawMid: number, yawEnd = 90, sigma = 1) =>
  (h: number, ch: string, name: string) =>
    sceneOf(
      name,
      [
        { t: 0, at: [0, 0, 0], yaw: 0 },
        { t: 2, at: [500, 0, 0], yaw: sigma * yawMid },
        { t: 4, at: [500, 0, -500 * sigma], yaw: sigma * yawEnd },
      ],
      [walkClip(0, h), stand(4, h)],
      h,
      ch,
    );

const k5 = (sigma: number) => (h: number, ch: string, name: string) => {
  const pts = [
    { at: [0, 0] as [number, number], yaw: 0 },
    ...arc([400, -125 * sigma], 125, 0, 180, sigma).map((p) => ({ ...p, yaw: sigma * p.yaw })),
    { at: [0, -250 * sigma] as [number, number], yaw: 180 * sigma },
  ];
  const path = timed(pts);
  const end = path[path.length - 1].t;
  return sceneOf(name, path, [walkClip(0, h), stand(end, h)], h, ch);
};

const k3arc = (h: number, ch: string, name: string) => {
  const path = timed([
    { at: [0, 0], yaw: 0 },
    ...arc([375, -125], 125, 0, 90),
    { at: [500, -500], yaw: 90 },
  ]);
  const end = path[path.length - 1].t;
  return sceneOf(name, path, [walkClip(0, h), stand(end, h)], h, ch);
};

/** Cú quay tại chỗ của `k4`: từ giây 2,3 tới 3,9 */
export const K4_TURN: [number, number] = [2.3, 3.9];

/**
 * Đi `500` theo hướng `yaw0`, dừng ở giây 2, quay tại chỗ `turn` độ (dương là quay phải) từ giây 2,3 tới 3,9 — `parts`
 * cú liền nhau chia đều góc và thời gian, mỗi cú `steps` nhịp (`0` là bỏ trống) —, rồi đi `500` theo hướng mới (`walk`,
 * clip đi bắt đầu `0,4 s` trước mốc cuối, không sớm hơn giữa nhịp cuối) hay đứng yên
 */
export const k4 =
  (turn: number, steps = 2, walk = true, { yaw0 = 0, parts = 1 } = {}) =>
  (h: number, ch: string, name: string) => {
    const [T0, T1] = K4_TURN;
    const dir = (y: number): [number, number] => [500 * Math.cos(y * D), -500 * Math.sin(y * D)];
    const [x1, z1] = dir(yaw0).map((v) => r1(v) + 0);
    const [dx, dz] = dir(yaw0 + turn);
    const stop: [number, number, number] = [x1, 0, z1];
    const end: [number, number, number] = [r1(x1 + dx) + 0, 0, r1(z1 + dz) + 0];
    const turns = Array.from({ length: parts }, (_, i) => ({
      t: r3(T0 + ((T1 - T0) * (i + 1)) / parts),
      at: stop,
      yaw: yaw0 + (turn * (i + 1)) / parts,
      ...(steps ? { steps } : {}),
    }));
    const beats = Math.max(steps, Math.ceil(Math.abs(turn / parts) / 90));
    const go = r3(T1 - Math.min(0.4, (T1 - T0) / parts / beats / 2));
    return sceneOf(
      name,
      [
        { t: 0, at: [0, 0, 0], yaw: yaw0 },
        { t: 2, at: stop, yaw: yaw0 },
        { t: T0, at: stop, yaw: yaw0 },
        ...turns,
        ...(walk ? [{ t: 5.9, at: end, yaw: yaw0 + turn }] : []),
      ],
      [walkClip(0, h), stand(2, h), ...(walk ? [walkClip(go, h), stand(5.9, h)] : [])],
      h,
      ch,
    );
  };

const named =
  (name: string, f: (h: number, ch: string, name: string) => unknown) => (h: number, ch: string) =>
    f(h, ch, name);

export const WALK_SCENES: WalkScene[] = [
  {
    name: "K1-di-thang",
    title: "K1 — đi thẳng 3 m rồi dừng",
    strips: [stopWin(3)],
    scene: named("K1-di-thang", (h, ch, name) =>
      sceneOf(
        name,
        [
          { t: 0, at: [0, 0, 0], yaw: 0 },
          { t: 3, at: [750, 0, 0], yaw: 0 },
        ],
        [walkClip(0, h), stand(3, h)],
        h,
        ch,
      ),
    ),
  },
  {
    name: "K1-di-thang-blend0",
    title: "K1 — đi thẳng, clip đi đầu blend 0 (đối chứng vào cảnh)",
    strips: [{ label: "vao-0.00", from: 0, to: 1.2 }],
    scene: named("K1-di-thang-blend0", (h, ch, name) =>
      sceneOf(
        name,
        [
          { t: 0, at: [0, 0, 0], yaw: 0 },
          { t: 3, at: [750, 0, 0], yaw: 0 },
        ],
        [{ ...walkClip(0, h), blend: 0 }, stand(3, h)],
        h,
        ch,
      ),
    ),
  },
  {
    name: "K1-dung-roi-di",
    title: "K1 — đứng rồi đi (start rest)",
    strips: [{ label: "khoi-hanh-0.50", from: 0.3, to: 1.5 }, stopWin(3.5)],
    scene: named("K1-dung-roi-di", (h, ch, name) =>
      sceneOf(
        name,
        [
          { t: 0, at: [0, 0, 0], yaw: 0 },
          { t: 0.5, at: [0, 0, 0], yaw: 0 },
          { t: 3.5, at: [750, 0, 0], yaw: 0 },
        ],
        [{ action: "stand-3d", start: 0 }, walkClip(0.5, h), stand(3.5, h)],
        h,
        ch,
      ),
    ),
  },
  {
    name: "K2-re-nhe",
    title: "K2 — rẽ phải 25° khi đang đi",
    strips: [cornerWin(2, 25), stopWin(4)],
    scene: named("K2-re-nhe", (h, ch, name) =>
      sceneOf(
        name,
        [
          { t: 0, at: [0, 0, 0], yaw: 0 },
          { t: 2, at: [500, 0, 0], yaw: 12.5 },
          { t: 4, at: [953.2, 0, -211.3], yaw: 25 },
        ],
        [walkClip(0, h), stand(4, h)],
        h,
        ch,
      ),
    ),
  },
  {
    name: "K2-re-nhe-trai",
    title: "K2 — rẽ trái 25° khi đang đi",
    strips: [cornerWin(2, 25)],
    scene: named("K2-re-nhe-trai", (h, ch, name) =>
      sceneOf(
        name,
        [
          { t: 0, at: [0, 0, 0], yaw: 0 },
          { t: 2, at: [500, 0, 0], yaw: -12.5 },
          { t: 4, at: [953.2, 0, 211.3], yaw: -25 },
        ],
        [walkClip(0, h), stand(4, h)],
        h,
        ch,
      ),
    ),
  },
  {
    name: "K3-re-90",
    title: "K3 — rẽ 90° khi đang đi (đích mềm)",
    strips: [cornerWin(2, 90), stopWin(4)],
    scene: named("K3-re-90", k3(45)),
  },
  {
    name: "K3-re-90-yaw0",
    title: "K3 — rẽ 90°, mốc giữa viết tay yaw 0",
    strips: [cornerWin(2, 90)],
    scene: named("K3-re-90-yaw0", k3(0)),
  },
  {
    name: "K3-re-90-yaw0-het",
    title: "K3 — rẽ 90°, mọi mốc viết tay yaw 0 (H3)",
    strips: [cornerWin(2, 90), stopWin(4)],
    scene: named("K3-re-90-yaw0-het", k3(0, 0)),
  },
  {
    name: "K3-re-90-trai",
    title: "K3 — rẽ trái 90° khi đang đi (đích mềm)",
    strips: [cornerWin(2, 90)],
    scene: named("K3-re-90-trai", k3(45, 90, -1)),
  },
  {
    name: "K3-re-90-cung",
    title: "K3 — rẽ 90° bo cung r 125",
    strips: [{ label: "cung-1.50", from: 0.9, to: 2.876 }],
    scene: named("K3-re-90-cung", k3arc),
  },
  {
    name: "K4-quay-trai",
    title: "K4 — đi, dừng, quay trái 180° tại chỗ, đi về",
    strips: [stopWin(2), { label: "quay-2.30", from: 2.1, to: 4.5 }, stopWin(5.9)],
    scene: named("K4-quay-trai", k4(-180)),
  },
  {
    name: "K4-quay-phai",
    title: "K4 — đi, dừng, quay phải 180° tại chỗ, đi về",
    strips: [{ label: "quay-2.30", from: 2.1, to: 4.5 }],
    scene: named("K4-quay-phai", k4(180)),
  },
  {
    name: "K5-vong-phai",
    title: "K5 — vòng chữ U phải r 125, không dừng",
    strips: [{ label: "cung-1.60", from: 1.0, to: 3.753 }, stopWin(4.753)],
    scene: named("K5-vong-phai", k5(1)),
  },
  {
    name: "K5-vong-trai",
    title: "K5 — vòng chữ U trái r 125, không dừng",
    strips: [{ label: "cung-1.60", from: 1.0, to: 3.753 }],
    scene: named("K5-vong-trai", k5(-1)),
  },
];
