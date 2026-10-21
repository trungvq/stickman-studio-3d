// Vệt quỹ đạo khớp và bóng que xương vẽ đè lên ô sân khấu — cùng khớp và phép chiếu với đo giật
// của `check` (`stageJoints`). docs/04-mcp.md#người-3d
import React from "react";
import * as rig from "@stickman3d/sketch";

const KEYWORDS = {
  hands: ["wristR", "wristL"],
  feet: ["footR", "footL"],
  all: rig.SNAP_JOINTS_3D,
};
const NAMES = new Set([...rig.SNAP_JOINTS_3D, "hip", "shoulderR", "shoulderL", "neck"]);
export const TRAIL_NAMES = [...Object.keys(KEYWORDS), ...NAMES];

/** Que xương người 3D: chuỗi khớp và bên giải phẫu (`R` phải, `L` trái, `C` giữa) */
export const BONES = [
  { side: "R", chain: ["hip", "kneeR", "footR"] },
  { side: "L", chain: ["hip", "kneeL", "footL"] },
  { side: "C", chain: ["hip", "neck", "head"] },
  { side: "R", chain: ["neck", "shoulderR", "elbowR", "wristR", "handR"] },
  { side: "L", chain: ["neck", "shoulderL", "elbowL", "wristL", "handL"] },
];

/** Từng đoạn xương `[khớp đầu, khớp cuối, bên]` */
export const BONE_SEGS = BONES.flatMap(({ side, chain }) =>
  chain.slice(1).map((j, i) => [chain[i], j, side]),
);

const PAST = "#2a6fdb";
/** Sàn của thang màu tốc độ, pixel video mỗi khung: khớp gần đứng yên không đỏ lên vì rung nhỏ */
const MIN_PX = 1;
const FUTURE = "#d9462b";

/** Tên khớp và từ khoá (`hands`, `feet`, `all`) ra khớp của người 3D; tên lạ thì ném lỗi */
export function trailJoints(spec) {
  const list = typeof spec === "string" ? spec.split(",") : (spec ?? []);
  const out = [];
  for (const raw of list) {
    const k = raw.trim();
    if (!k) continue;
    if (KEYWORDS[k]) out.push(...KEYWORDS[k]);
    else if (NAMES.has(k)) out.push(k);
    else throw new Error(`trails: khớp lạ \`${k}\` — có ${TRAIL_NAMES.join(", ")}`);
  }
  return [...new Set(out)];
}

const p90 = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.9))] : 0;
};

/**
 * Bộ lấy mẫu khớp người 3D, nhớ theo giây nên các ô chồng cửa sổ không tính lại. `characterOf(m)` trả
 * JSON nhân vật đã parse, `undefined` là bỏ người ấy; người không có `world` thì bỏ, kèm một dòng ở `warnings`.
 */
export function jointSampler(rt, characterOf) {
  const people = new Map();
  const warnings = [];
  for (const m of rt.cast) {
    if (!m.world || !rt.lens) {
      warnings.push(`\`${m.id}\` không phải người 3D (thiếu \`world\`) — vệt và que xương bỏ qua`);
      continue;
    }
    const base = characterOf(m);
    if (!base) continue;
    const c = rig.castCharacter(m, base);
    people.set(m.id, { m, c, h: c.rig.height, b: rig.body3(c), memo: new Map() });
  }
  return {
    ids: [...people.keys()],
    warnings,
    at(id, t) {
      const P = people.get(id);
      const key = t.toFixed(6);
      let s = P.memo.get(key);
      if (!s) {
        const sp = rig.sceneAt(rt, id, t, P.h, P.b);
        const j = rig.stageJoints(P.c, sp);
        const on = j?.front && sp.opacity > 0.5;
        s = on
          ? { pts: j.pts, depth: j.depth, world: j.world, yaw: sp.world.yaw, s: sp.world.s }
          : { pts: null };
        P.memo.set(key, s);
      }
      return s;
    },
    member: (id) => people.get(id).m,
  };
}

/**
 * Số của lớp phủ ở ô giây `t`: mỗi người một mục — vệt của từng khớp trong `t ± span` lấy mẫu mỗi
 * `1/fps` (toạ độ chỗ vẽ, `v` là pixel video mỗi khung theo khung cắt `cameraAt`), mốc đầu clip, và
 * `ghosts` khung que xương mỗi phía cách nhau `ghostStep` giây. `relative` trừ phần dời của hông so
 * với khung `t`.
 */
export function motionData(
  rt,
  { t, sampler, trails, span = 1, fps = 30, relative = false, ghosts = 0, ghostStep = 0.1, only },
) {
  const video = rt.frame.video.w;
  const out = [];
  for (const id of sampler.ids) {
    if (only && id !== only) continue;
    const now = sampler.at(id, t);
    const hip0 = now.pts?.hip;
    const shift = (s) =>
      relative && hip0 && s.pts?.hip ? [s.pts.hip[0] - hip0[0], s.pts.hip[1] - hip0[1]] : [0, 0];
    const lo = Math.max(0, Math.ceil((t - span) * fps - 1e-6));
    const hi = Math.min(Math.floor(rt.duration * fps + 1e-6), Math.floor((t + span) * fps + 1e-6));
    const frames = [];
    for (let i = lo; i <= hi; i++) {
      const ft = i / fps;
      const s = sampler.at(id, ft);
      frames.push({ t: ft, s, d: shift(s), k: video / rig.cameraAt(rt, ft).view.w });
    }
    const joints = trails ? trailJoints(trails) : [];
    const lines = joints.map((joint) => {
      const pts = frames.map((f) =>
        f.s.pts?.[joint]
          ? { t: f.t, x: f.s.pts[joint][0] - f.d[0], y: f.s.pts[joint][1] - f.d[1], k: f.k }
          : null,
      );
      pts.forEach((p, i) => {
        if (!p) return;
        const q = pts[i - 1];
        p.v = q ? Math.hypot(p.x - q.x, p.y - q.y) * p.k : NaN;
      });
      const cur = now.pts?.[joint];
      return {
        joint,
        pts,
        p90: Math.max(MIN_PX, p90(pts.map((p) => p?.v))),
        now: cur ? { x: cur[0], y: cur[1] } : null,
      };
    });
    const m = sampler.member(id);
    const marks = m.tracks
      .flatMap((tr) => tr.clips.map((c) => c.start))
      .filter((s) => s >= frames[0]?.t - 1e-9 && s <= frames[frames.length - 1]?.t + 1e-9);
    const ghost = [];
    for (const dir of [-1, 1])
      for (let k = ghosts; k >= 1; k--) {
        const gt = +(t + dir * k * ghostStep).toFixed(6);
        if (gt < -1e-9 || gt > rt.duration + 1e-9) continue;
        const s = sampler.at(id, gt);
        if (!s.pts) continue;
        const d = shift(s);
        const bones = [];
        for (const [ja, jb] of BONE_SEGS) {
          const [a, b] = [s.pts[ja], s.pts[jb]];
          bones.push([a[0] - d[0], a[1] - d[1], b[0] - d[0], b[1] - d[1]]);
        }
        ghost.push({ t: gt, dir, k, bones });
      }
    out.push({ id, lines, marks, ghosts: ghost, n: ghosts });
  }
  return out;
}

const f2 = (v) => +v.toFixed(2);
const hue = (r) => `hsl(${Math.round(220 * (1 - Math.min(1, Math.max(0, r))))}, 85%, 45%)`;

/** Lớp phủ SVG từ `motionData`, `u` là một đơn vị nét trên hệ chỗ vẽ */
export function motionOverlay(data, t, u) {
  const kids = [];
  for (const P of data) {
    for (const g of P.ghosts) {
      const op = (0.75 * (P.n - g.k + 1)) / P.n;
      kids.push(
        React.createElement(
          "g",
          {
            key: `g-${P.id}-${g.dir}-${g.k}`,
            "data-ghost": `${P.id}@${g.t}`,
            stroke: g.dir < 0 ? PAST : FUTURE,
            strokeOpacity: f2(op),
            strokeWidth: f2(0.9 * u),
            strokeLinecap: "round",
            fill: "none",
          },
          g.bones.map(([x1, y1, x2, y2], i) =>
            React.createElement("line", { key: i, x1: f2(x1), y1: f2(y1), x2: f2(x2), y2: f2(y2) }),
          ),
        ),
      );
    }
    for (const L of P.lines) {
      const segs = [];
      const dots = [];
      L.pts.forEach((p, i) => {
        if (!p) return;
        const past = p.t < t - 1e-9;
        const color = hue(L.p90 > 0 ? p.v / L.p90 : 0);
        const op = past ? 0.4 : 0.95;
        const q = L.pts[i - 1];
        if (q)
          segs.push(
            React.createElement("line", {
              key: i,
              x1: f2(q.x),
              y1: f2(q.y),
              x2: f2(p.x),
              y2: f2(p.y),
              stroke: color,
              strokeOpacity: op,
            }),
          );
        dots.push(
          React.createElement("circle", {
            key: i,
            cx: f2(p.x),
            cy: f2(p.y),
            r: f2(1.2 * u),
            fill: color,
            fillOpacity: op,
            stroke: "#fff",
            strokeOpacity: op,
            strokeWidth: f2(0.35 * u),
          }),
        );
      });
      const marks = P.marks
        .map((s) =>
          L.pts.reduce(
            (b, p) => (p && (!b || Math.abs(p.t - s) < Math.abs(b.t - s)) ? p : b),
            null,
          ),
        )
        .filter(Boolean)
        .map((p, i) =>
          React.createElement("rect", {
            key: `m${i}`,
            x: f2(p.x - 1.6 * u),
            y: f2(p.y - 1.6 * u),
            width: f2(3.2 * u),
            height: f2(3.2 * u),
            fill: "none",
            stroke: "#111",
            strokeWidth: f2(0.6 * u),
          }),
        );
      kids.push(
        React.createElement(
          "g",
          {
            key: `t-${P.id}-${L.joint}`,
            "data-trail": `${P.id}.${L.joint}`,
            strokeWidth: f2(0.9 * u),
            strokeLinecap: "round",
          },
          segs,
          dots,
          marks,
          L.now
            ? React.createElement("circle", {
                key: "now",
                cx: f2(L.now.x),
                cy: f2(L.now.y),
                r: f2(2.6 * u),
                fill: "none",
                stroke: "#111",
                strokeWidth: f2(0.8 * u),
              })
            : null,
        ),
      );
    }
  }
  return kids.length ? React.createElement("g", { key: "motion", "data-motion": "" }, kids) : null;
}
