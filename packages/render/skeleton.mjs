// Que xương không nền của người 3D: lưới sàn và viền đồ khối chiếu qua `scene.lens`, khung xương của
// khung hiện tại theo bên giải phẫu, và ô nhìn từ trên xuống. docs/04-mcp.md#người-3d
import React from "react";
import * as rig from "@stickman3d/sketch";
import * as FX from "@stickman3d/fx";
import { BONE_SEGS } from "./trails.mjs";

/** Màu bên giải phẫu: phải, trái, giữa */
export const SIDE_COLOR = { R: "#c2185b", L: "#00838f", C: "#333" };
const GRID = "#b4ad9c";
const AXIS = "#7a7262";
const BOX = "#6d6658";
/** Ô lưới sàn, đơn vị thế giới */
export const GRID_STEP = 100;
/** Lưới phủ quá chỗ người đứng ngần này mỗi phía */
const GRID_PAD = 400;
/** Độ sâu gần nhất còn vẽ: đoạn cắt ở đây thay vì chiếu ra vô cực */
const NEAR = 5;
/** Chênh độ sâu với hông (đơn vị thế giới) ứng với nét to / nhỏ nhất */
const DEPTH_SPAN = 40;

const f2 = (v) => +v.toFixed(2);
const lerp3 = (a, b, s) => [
  a[0] + (b[0] - a[0]) * s,
  a[1] + (b[1] - a[1]) * s,
  a[2] + (b[2] - a[2]) * s,
];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Đoạn thế giới `a → b` trên khung, cắt ở mặt phẳng `NEAR`; khuất hẳn thì `null` */
export function clipSeg(lens, a, b) {
  const da = rig.depthAt(lens, a);
  const db = rig.depthAt(lens, b);
  if (da < NEAR && db < NEAR) return null;
  if (da < NEAR) a = lerp3(a, b, (NEAR - da) / (db - da));
  else if (db < NEAR) b = lerp3(a, b, (NEAR - da) / (db - da));
  return [...rig.project(lens, a), ...rig.project(lens, b)];
}

/** Mọi điểm `at` của người 3D: chỗ đứng, các mốc `path` */
const worldSpots = (rt) =>
  rt.cast.flatMap((m) => (m.world ? (m.world.path ?? [{ at: m.world.at, sit: m.world.sit }]) : []));

/** Độ cao sàn của cảnh: `at` của mốc đứng, `floor` của người ngồi; không người đứng nào thì `0` */
export function floorLevels(rt) {
  const ys = new Set();
  for (const k of worldSpots(rt)) if (!k.sit) ys.add(Math.round(k.at[1]));
  for (const m of rt.cast) if (m.world?.floor !== undefined) ys.add(Math.round(m.world.floor));
  return ys.size ? [...ys] : [0];
}

/** Ô sàn có lưới: hộp x–z quanh mọi chỗ người 3D đứng, nới `GRID_PAD`, khớp bậc `GRID_STEP` */
export function floorExtent(rt) {
  const pts = worldSpots(rt).map((k) => k.at);
  if (!pts.length) pts.push([0, 0, 0]);
  const lo = (v) => Math.floor((v - GRID_PAD) / GRID_STEP) * GRID_STEP;
  const hi = (v) => Math.ceil((v + GRID_PAD) / GRID_STEP) * GRID_STEP;
  return {
    x0: lo(Math.min(...pts.map((p) => p[0]))),
    x1: hi(Math.max(...pts.map((p) => p[0]))),
    z0: lo(Math.min(...pts.map((p) => p[2]))),
    z1: hi(Math.max(...pts.map((p) => p[2]))),
  };
}

/** Lưới sàn chiếu qua `lens`: mỗi đường một mục `{ a, b, p, axis }`, `p` là đoạn trên khung đã cắt */
export function floorGrid(rt, lens = rt.lens) {
  if (!lens) return [];
  const { x0, x1, z0, z1 } = floorExtent(rt);
  const out = [];
  for (const y of floorLevels(rt)) {
    const line = (a, b, axis) => {
      const p = clipSeg(lens, a, b);
      if (p) out.push({ a, b, p, axis });
    };
    for (let x = x0; x <= x1; x += GRID_STEP) line([x, y, z0], [x, y, z1], x === 0 ? "z" : null);
    for (let z = z0; z <= z1; z += GRID_STEP) line([x0, y, z], [x1, y, z], z === 0 ? "x" : null);
  }
  return out;
}

/** Mười hai cạnh của khối tám đỉnh: bốn đỉnh đáy theo vòng rồi bốn đỉnh trên tương ứng */
const hullEdges = (v) =>
  [0, 1, 2, 3].flatMap((i) => [
    [v[i], v[(i + 1) % 4]],
    [v[i + 4], v[((i + 1) % 4) + 4]],
    [v[i], v[i + 4]],
  ]);

/** Khối của đồ khối lớp vẽ code (`solids`) ở giây `t`, đỉnh trong thế giới rig: `{ name, edges }` */
export function solidBoxes(rt, t, { codeLayers = [], url = () => undefined } = {}) {
  if (!rt.lens) return [];
  const ctx = {
    name: rt.name,
    t,
    cam: rig.cameraAt(rt, t),
    marks: rt.marks,
    url,
    lens: rt.lens,
    anchor: () => null,
  };
  return codeLayers
    .filter((l) => FX.layerCovers(l, rt.name))
    .flatMap((l) => l.solids?.(ctx) ?? [])
    .flatMap((item) =>
      item.parts.map((part) => ({
        name: item.name,
        edges: hullEdges(part.v.map((p) => rig.place3(item.at, p))),
      })),
    );
}

/**
 * Hộp bao từng vật cản của cảnh three `stickman.world` ở giây `t` (`worldScene` của cli): `pose(t)` rồi
 * `colliders` như `check`, hộp three đổi về thế giới rig
 */
export function worldBoxes(on, t) {
  const { scene, colliders, U } = on;
  scene.pose(t);
  scene.root.updateMatrixWorld(true);
  return colliders(scene.root).map((c) => {
    const { min: a, max: b } = c.box;
    const v = [
      [a.x, a.y, a.z],
      [b.x, a.y, a.z],
      [b.x, a.y, b.z],
      [a.x, a.y, b.z],
      [a.x, b.y, a.z],
      [b.x, b.y, a.z],
      [b.x, b.y, b.z],
      [a.x, b.y, b.z],
    ].map(([x, y, z]) => [x / U, -y / U, -z / U]);
    return { name: c.name, edges: hullEdges(v) };
  });
}

/** Hướng mặt của `yaw` (radian, 0 là +x, π/2 là −z) */
const facing = (yaw) => [Math.cos(yaw), 0, -Math.sin(yaw)];

/**
 * Khung xương của từng người 3D ở giây `t`: mỗi đoạn `[khớp đầu, khớp cuối, bên]` của `BONE_SEGS` với
 * toạ độ chỗ vẽ (`stageJoints`), độ sâu giữa đoạn và `rel` — gần ống kính hơn hông là dương, kẹp `±1`
 */
export function skeletonData(rt, { t, sampler, only }) {
  const out = [];
  for (const id of sampler.ids) {
    if (only && id !== only) continue;
    const s = sampler.at(id, t);
    if (!s.pts) continue;
    const segs = BONE_SEGS.map(([ja, jb, side]) => {
      const depth = (s.depth[ja] + s.depth[jb]) / 2;
      return {
        ja,
        jb,
        side,
        x1: s.pts[ja][0],
        y1: s.pts[ja][1],
        x2: s.pts[jb][0],
        y2: s.pts[jb][1],
        depth,
        rel: clamp((s.depth.hip - depth) / (DEPTH_SPAN * s.s), -1, 1),
      };
    }).sort((a, b) => b.depth - a.depth);
    const head = s.world.head;
    const r = 0.45 * Math.hypot(...head.map((v, i) => v - s.world.neck[i]));
    const nose = clipSeg(rt.lens, head, rig.add3(head, rig.scale3(facing(s.yaw), 2.2 * r)));
    out.push({
      id,
      segs,
      head: { x: s.pts.head[0], y: s.pts.head[1], r: r * rig.scaleAt(rt.lens, head) },
      nose,
    });
  }
  return out;
}

/** Lớp SVG của `skeletonData`; `u` là một đơn vị nét trên hệ chỗ vẽ */
export function skeletonOverlay(data, u) {
  return React.createElement(
    "g",
    { key: "skeleton", "data-skeleton": "", strokeLinecap: "round", fill: "none" },
    data.map((P) =>
      React.createElement(
        "g",
        { key: P.id, "data-cast": P.id },
        P.segs.map((g, i) =>
          React.createElement("line", {
            key: i,
            "data-bone": `${g.ja}-${g.jb}`,
            x1: f2(g.x1),
            y1: f2(g.y1),
            x2: f2(g.x2),
            y2: f2(g.y2),
            stroke: SIDE_COLOR[g.side],
            strokeWidth: f2(u * 2.6 * (1 + 0.55 * g.rel)),
            strokeOpacity: f2(0.78 + 0.22 * g.rel),
          }),
        ),
        React.createElement("circle", {
          key: "head",
          cx: f2(P.head.x),
          cy: f2(P.head.y),
          r: f2(P.head.r),
          stroke: SIDE_COLOR.C,
          strokeWidth: f2(1.4 * u),
        }),
        P.nose
          ? React.createElement("line", {
              key: "nose",
              x1: f2(P.nose[0]),
              y1: f2(P.nose[1]),
              x2: f2(P.nose[2]),
              y2: f2(P.nose[3]),
              stroke: SIDE_COLOR.C,
              strokeWidth: f2(1.4 * u),
            })
          : null,
        React.createElement(
          "text",
          {
            key: "id",
            x: f2(P.head.x + P.head.r + 2 * u),
            y: f2(P.head.y - P.head.r),
            fontSize: f2(7 * u),
            fontFamily: "monospace",
            fill: "#555",
            stroke: "none",
          },
          P.id,
        ),
      ),
    ),
  );
}

/** Lưới sàn và viền hộp đồ khối trên khung */
export function floorOverlay({ grid, boxes, lens }, u) {
  const kids = grid.map((g, i) =>
    React.createElement("line", {
      key: `g${i}`,
      x1: f2(g.p[0]),
      y1: f2(g.p[1]),
      x2: f2(g.p[2]),
      y2: f2(g.p[3]),
      stroke: g.axis ? AXIS : GRID,
      strokeOpacity: g.axis ? 0.7 : 0.45,
      strokeWidth: f2((g.axis ? 0.8 : 0.5) * u),
    }),
  );
  boxes.forEach((b, i) =>
    b.edges.forEach(([a, c], k) => {
      const p = clipSeg(lens, a, c);
      if (p)
        kids.push(
          React.createElement("line", {
            key: `b${i}-${k}`,
            x1: f2(p[0]),
            y1: f2(p[1]),
            x2: f2(p[2]),
            y2: f2(p[3]),
            stroke: BOX,
            strokeOpacity: 0.4,
            strokeWidth: f2(0.6 * u),
          }),
        );
    }),
  );
  return React.createElement("g", { key: "floor", "data-floor": "" }, kids);
}

/** Chú giải hai màu bên, đặt ở góc dưới ô `box` */
export function sideLegend(box) {
  const fs = Math.min(30, box.w / 14);
  const y = box.y + box.h - fs * 0.8;
  return React.createElement(
    "text",
    { key: "legend", x: box.x + 16, y, fontSize: fs, fontFamily: "monospace" },
    React.createElement("tspan", { fill: SIDE_COLOR.R }, "━ phải"),
    React.createElement("tspan", { fill: SIDE_COLOR.L, dx: fs }, "━ trái"),
  );
}

/**
 * Ô nhìn từ trên xuống: chiếu bằng lên mặt sàn x–z (x phải, z sâu lên trên) vừa khít `box`. Lưới sàn,
 * đáy hộp đồ khối, ống kính và góc nhìn, vệt hông và hai bàn chân cả cảnh (mờ) và trong `t ± span`
 * (chấm mỗi khung), que xương và hướng mặt ở `t`
 */
export function topView({ rt, t, sampler, boxes = [], box, span = 1, fps = 30, only }) {
  const ext = floorExtent(rt);
  const eye = rt.lens?.eye;
  // Khung ôm lưới sàn; ống kính nằm ngoài thì chỉ thấy hai mép góc nhìn cắt qua mép ô
  const { x0, x1, z0, z1 } = ext;
  const k = Math.min((box.w * 0.88) / (x1 - x0 || 1), (box.h * 0.8) / (z1 - z0 || 1));
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2 + box.h * 0.03;
  const P = (p) => [cx + (p[0] - (x0 + x1) / 2) * k, cy - (p[2] - (z0 + z1) / 2) * k];
  const u = box.w / 300;
  const line = (key, a, b, stroke, w, op = 1) => {
    const [p, q] = [P(a), P(b)];
    return React.createElement("line", {
      key,
      x1: f2(p[0]),
      y1: f2(p[1]),
      x2: f2(q[0]),
      y2: f2(q[1]),
      stroke,
      strokeWidth: f2(w),
      strokeOpacity: op,
    });
  };
  const kids = [];
  for (let x = ext.x0; x <= ext.x1; x += GRID_STEP)
    kids.push(line(`gx${x}`, [x, 0, ext.z0], [x, 0, ext.z1], x ? GRID : AXIS, 0.5 * u, 0.6));
  for (let z = ext.z0; z <= ext.z1; z += GRID_STEP)
    kids.push(line(`gz${z}`, [ext.x0, 0, z], [ext.x1, 0, z], z ? GRID : AXIS, 0.5 * u, 0.6));
  boxes.forEach((b, i) =>
    b.edges.forEach(([a, c], j) => kids.push(line(`b${i}-${j}`, a, c, BOX, 0.6 * u, 0.4))),
  );
  if (eye && rt.lens) {
    // Hai mép góc nhìn ngang theo bề ngang khung cắt của camera ở `t`
    const view = rig.cameraAt(rt, t).view;
    const reach =
      Math.hypot(x1 - x0, z1 - z0) + Math.hypot(eye[0] - (x0 + x1) / 2, eye[2] - (z0 + z1) / 2);
    for (const sx of [view.x, view.x + view.w]) {
      const far = rig.unproject(rt.lens, [sx, rt.lens.cy], reach);
      kids.push(line(`fov${sx}`, eye, far, AXIS, 0.6 * u, 0.6));
    }
    const [ex, ey] = P(eye);
    kids.push(
      React.createElement("circle", {
        key: "eye",
        cx: f2(ex),
        cy: f2(ey),
        r: f2(2.4 * u),
        fill: AXIS,
      }),
    );
  }
  const lo = Math.max(0, Math.ceil((t - span) * fps - 1e-6));
  const hi = Math.min(Math.floor(rt.duration * fps + 1e-6), Math.floor((t + span) * fps + 1e-6));
  const whole = Math.floor(rt.duration * fps + 1e-6);
  for (const id of sampler.ids) {
    if (only && id !== only) continue;
    for (const [joint, color] of [
      ["hip", SIDE_COLOR.C],
      ["footR", SIDE_COLOR.R],
      ["footL", SIDE_COLOR.L],
    ]) {
      const path = (a, b) => {
        const pts = [];
        for (let i = a; i <= b; i++) {
          const w = sampler.at(id, i / fps).world?.[joint];
          if (w) pts.push(P(w));
        }
        return pts;
      };
      const all = path(0, whole);
      if (all.length > 1)
        kids.push(
          React.createElement("polyline", {
            key: `w-${id}-${joint}`,
            points: all.map(([x, y]) => `${f2(x)},${f2(y)}`).join(" "),
            fill: "none",
            stroke: color,
            strokeOpacity: 0.25,
            strokeWidth: f2(0.6 * u),
          }),
        );
      path(lo, hi).forEach(([x, y], i) =>
        kids.push(
          React.createElement("circle", {
            key: `d-${id}-${joint}-${i}`,
            cx: f2(x),
            cy: f2(y),
            r: f2(0.9 * u),
            fill: color,
            fillOpacity: 0.7,
          }),
        ),
      );
    }
    const s = sampler.at(id, t);
    if (!s.pts) continue;
    BONE_SEGS.forEach(([ja, jb, side], i) =>
      kids.push(line(`s-${id}-${i}`, s.world[ja], s.world[jb], SIDE_COLOR[side], 1.8 * u)),
    );
    const hip = s.world.hip;
    kids.push(
      line(
        `f-${id}`,
        hip,
        rig.add3(hip, rig.scale3(facing(s.yaw), 60 * s.s)),
        SIDE_COLOR.C,
        1.2 * u,
      ),
    );
    const [hx, hy] = P(hip);
    kids.push(
      React.createElement(
        "text",
        {
          key: `id-${id}`,
          x: f2(hx + 4 * u),
          y: f2(hy - 4 * u),
          fontSize: f2(7 * u),
          fontFamily: "monospace",
          fill: "#555",
        },
        id,
      ),
    );
  }
  return React.createElement("g", { key: "top", "data-top": "" }, kids);
}
