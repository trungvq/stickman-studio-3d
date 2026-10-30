// Vệt quỹ đạo khớp và bóng que xương vẽ đè lên ô sân khấu — cùng khớp và phép chiếu với đo giật
// của `check` (`stageJoints`), kèm hướng dẫn đọc và bảng số đo bằng chữ. docs/04-mcp.md#người-3d
import React from "react";
import * as rig from "@stickman3d/rig/core";

const KEYWORDS = {
  hands: ["wristR", "wristL"],
  feet: ["footR", "footL"],
  all: rig.SNAP_JOINTS_3D,
};
const NAMES = new Set([...rig.SNAP_JOINTS_3D, "hip", "shoulderR", "shoulderL", "neck"]);
export const TRAIL_NAMES = [...Object.keys(KEYWORDS), ...NAMES];

/** Màu bên giải phẫu: phải, trái, giữa — que xương và vệt dùng chung */
export const SIDE_COLOR = { R: "#c2185b", L: "#00838f", C: "#333" };
export const sideOf = (joint) => (/R$/.test(joint) ? "R" : /L$/.test(joint) ? "L" : "C");

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

/** Sàn của tốc độ chạy, pixel video mỗi khung */
const MIN_PX = 1;
const GHOST = "#444";

/**
 * Ngưỡng sự kiện trên vệt. `run` là tốc độ chạy của vệt: bước nhanh nhất của chính nó, bỏ bước giật, pixel
 * video mỗi khung. Giật không ở đây — nó là `sceneSnaps` của `check`. docs/04-mcp.md#người-3d
 */
export const TRAIL_EVENT = {
  /** `run` dưới ngần này pixel video mỗi giây: vệt gần đứng yên, chỉ xét giật */
  still: 200,
  /** Khung chậm: tốc độ dưới phần này của `run` */
  slow: 0.15,
  /** Khung đang chạy: tốc độ từ phần này của `run` */
  move: 0.4,
  /** Khựng dài nhất, giây; dừng lâu hơn là giữ tư thế */
  hitch: 0.6,
  /** Hai bên chỗ dừng phải có khung đang chạy trong ngần này giây */
  near: 0.3,
  /** Hướng đi trước và sau chỗ dừng lệch dưới ngần này độ: đi tiếp đường cũ, là khựng */
  same: 60,
  /** Hai bước liền nhau đều đang chạy mà đổi hướng quá ngần này độ: quay gắt */
  turn: 120,
  /**
   * Vào / dừng gắt: bước dưới `rest` phần `run` kề bước từ `burst` phần `run` (hay cách một bước chạy một phần)
   * mà bước xa hơn nữa không nhanh quá `cruise` lần — đã ở tốc độ đều, không phải đang tăng tốc êm
   */
  rest: 0.1,
  burst: 0.5,
  cruise: 1.08,
};

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

const sorted = (xs) => xs.filter(Number.isFinite).sort((a, b) => a - b);
const median = (xs) => {
  const s = sorted(xs);
  return s.length ? s[s.length >> 1] : NaN;
};

/**
 * Bộ lấy mẫu khớp người 3D, nhớ theo giây nên các ô chồng cửa sổ không tính lại. `characterOf(m)` trả
 * JSON nhân vật đã parse, `undefined` là bỏ người ấy.
 */
export function jointSampler(rt, characterOf) {
  const people = new Map();
  for (const m of rt.cast) {
    const base = characterOf(m);
    if (!base) continue;
    const c = base;
    people.set(m.id, { m, base, c, h: c.rig.height, b: rig.body3(c), memo: new Map() });
  }
  return {
    ids: [...people.keys()],
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
    /** Giật trên hình của một người cả cảnh, đúng `sceneSnaps` của `check` ở nhịp `fps`, ngưỡng `snap` `{ px, k }` */
    snaps(id, fps, snap) {
      const P = people.get(id);
      const key = `snap|${fps}|${snap?.px}|${snap?.k}`;
      if (!P.memo.has(key))
        P.memo.set(
          key,
          rig.sceneSnaps(rt, {
            characterOf: (m) => (m.id === id ? P.base : undefined),
            fps,
            px: snap?.px ?? rig.SNAP_PX,
            k: snap?.k ?? rig.SNAP_K,
          }),
        );
      return P.memo.get(key);
    },
  };
}

const angleOf = (a, b) => {
  const n = Math.hypot(...a) * Math.hypot(...b);
  return n > 0
    ? (Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / n))) * 180) / Math.PI
    : NaN;
};
const step = (pts, a, b) => (pts[a] && pts[b] ? [pts[b].x - pts[a].x, pts[b].y - pts[a].y] : null);

/**
 * Sự kiện trên một vệt (`pts` mỗi khung, `v` px video mỗi khung, `null` là khuất): `jerk` (giật — `snaps`
 * của `sceneSnaps` có khớp này), `hitch` (khựng), `turn` (quay gắt), `start` / `stop` (vào / dừng gắt).
 * `gait` là bàn chân người đang đi: chạm đất đứng yên là nhịp bước, chỉ xét giật. Ngưỡng ở `TRAIL_EVENT`.
 */
export function trailEvents(pts, { fps, joint, snaps = [], gait = false }) {
  const E = TRAIL_EVENT;
  const out = [];
  const ok = (i) => Number.isFinite(pts[i]?.v);
  const v = (i) => pts[i].v;
  const jerks = [];
  for (const s of snaps) {
    if (s.joint !== joint && !s.also.includes(joint)) continue;
    const i = pts.findIndex((p) => p && Math.abs(p.t - s.t) < 1e-6);
    if (i < 1 || !ok(i)) continue;
    const near = [];
    for (let k = i - 2; k <= i + 2; k++) if (ok(k)) near.push(v(k));
    jerks.push(i);
    out.push({ kind: "jerk", t: pts[i].t, from: i - 1, to: i, px: v(i), base: median(near) });
  }
  let run = MIN_PX;
  pts.forEach((p, i) => {
    if (ok(i) && !jerks.some((j) => Math.abs(j - i) <= 1)) run = Math.max(run, p.v);
  });
  if (run * fps < E.still) return { run, events: out };
  const clear = (i) => !jerks.some((j) => Math.abs(j - i) <= 2);
  const slow = (i) => ok(i) && v(i) < E.slow * run;
  const moving = (a, b) => {
    for (let k = Math.max(1, a); k <= Math.min(pts.length - 1, b); k++)
      if (ok(k) && v(k) >= E.move * run) return true;
    return false;
  };
  // bàn chân chạm, rời sàn vốn khởi và dừng gắt; người đi theo `path` thì chạm đất đứng yên là nhịp bước
  const foot = joint.startsWith("foot");
  if (!gait) {
    const reach = Math.max(1, Math.round(E.near * fps));
    for (let i = 1; i < pts.length; i++) {
      if (!slow(i)) continue;
      let j = i;
      while (slow(j + 1)) j++;
      const dur = (j - i + 1) / fps;
      if (
        dur <= E.hitch + 1e-9 &&
        moving(i - reach, i - 1) &&
        moving(j + 1, j + reach) &&
        clear(i) &&
        clear(j)
      ) {
        const a = step(pts, Math.max(0, i - 4), i - 1);
        const b = step(pts, j, Math.min(pts.length - 1, j + 3));
        const deg = a && b ? angleOf(a, b) : NaN;
        if (deg < E.same)
          out.push({ kind: "hitch", t: pts[i - 1].t, end: pts[j].t, dur, from: i - 1, to: j });
      }
      i = j;
    }
    // tốc độ đều ngay sau bước nghỉ; khung lệch mốc thì bước đầu chỉ chạy một phần nên xét tới bước thứ hai.
    // Bước sau còn nhanh thêm là đang tăng tốc êm; mép cửa sổ không đủ bước thì không kết luận
    const at = (i) => (ok(i) ? v(i) : NaN);
    const abrupt = (a, b, c) =>
      (a >= E.burst * run && b <= E.cruise * a) ||
      (a >= E.rest * run && b >= E.burst * run && c <= E.cruise * b);
    for (let i = 1; i < pts.length && !foot; i++) {
      if (!ok(i) || v(i) >= E.rest * run) continue;
      if (clear(i + 1) && abrupt(at(i + 1), at(i + 2), at(i + 3)))
        out.push({ kind: "start", t: pts[i].t, at: i });
      if (i >= 2 && clear(i - 1) && abrupt(at(i - 1), at(i - 2), at(i - 3)))
        out.push({ kind: "stop", t: pts[i - 1].t, at: i - 1 });
    }
    const fast = Math.max(E.move * run, 2);
    for (let i = 1; i + 1 < pts.length; i++) {
      if (!ok(i) || !ok(i + 1) || v(i) < fast || v(i + 1) < fast || !clear(i)) continue;
      const deg = angleOf(step(pts, i - 1, i), step(pts, i, i + 1));
      if (deg > E.turn) out.push({ kind: "turn", t: pts[i].t, at: i, deg });
    }
  }
  return { run, events: out.sort((a, b) => a.t - b.t) };
}

/**
 * Số của lớp phủ ở ô giây `t`: mỗi người một mục — vệt của từng khớp trong `t ± span` lấy mẫu mỗi
 * `1/fps` (toạ độ chỗ vẽ, `v` là pixel video mỗi khung theo khung cắt `cameraAt`), tốc độ chạy `run`,
 * sự kiện (`trailEvents`; giật đo bằng `sceneSnaps` với ngưỡng `snap` `{ px, k }`), mốc đầu clip, quãng
 * hông dời trong cửa sổ (`travel`, px video), và `ghosts` khung que xương mỗi phía cách nhau `ghostStep`
 * giây. `relative` trừ phần dời của hông so với khung `t`.
 */
export function motionData(
  rt,
  {
    t,
    sampler,
    trails,
    span = 1,
    fps = 30,
    relative = false,
    ghosts = 0,
    ghostStep = 0.1,
    only,
    snap,
  },
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
    const m = sampler.member(id);
    const joints = trails ? trailJoints(trails) : [];
    const snaps = joints.length ? sampler.snaps(id, fps, snap) : [];
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
      const gait = !!m.world.path && joint.startsWith("foot");
      return {
        joint,
        side: sideOf(joint),
        pts,
        ...trailEvents(pts, { fps, joint, snaps, gait }),
        now: cur ? { x: cur[0], y: cur[1] } : null,
      };
    });
    const [t0, t1] = [frames[0]?.t, frames[frames.length - 1]?.t];
    const marks = [];
    for (const tr of m.tracks)
      for (const c of tr.clips)
        // clip mở đầu cảnh không phải chỗ chuyển
        if (c.start > 1e-9 && c.start >= t0 - 1e-9 && c.start <= t1 + 1e-9)
          marks.push({ t: c.start, name: c.file ?? c.action?.name ?? "" });
    marks.sort((a, b) => a.t - b.t);
    const hips = frames.filter((f) => f.s.pts?.hip);
    const travel =
      hips.length > 1
        ? Math.hypot(
            hips[hips.length - 1].s.pts.hip[0] - hips[0].s.pts.hip[0],
            hips[hips.length - 1].s.pts.hip[1] - hips[0].s.pts.hip[1],
          ) * hips[0].k
        : 0;
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
    // thân người ở khung của ô: số sự kiện tránh đè lên nó
    const body = now.pts
      ? {
          segs: [...BONE_SEGS, ["hip", "shoulderR"], ["hip", "shoulderL"]].map(([a, b]) => [
            ...now.pts[a],
            ...now.pts[b],
          ]),
          head: now.pts.head,
          neck: now.pts.neck,
        }
      : null;
    out.push({
      id,
      lines,
      marks,
      ghosts: ghost,
      n: ghosts,
      window: [t0, t1],
      travel,
      relative,
      body,
    });
  }
  return out;
}

const f2 = (v) => +v.toFixed(2);
const sec = (v) => `${+v.toFixed(2)}`;
const unit = (x, y) => {
  const n = Math.hypot(x, y);
  return n > 0 ? [x / n, y / n] : null;
};

/** Hướng đi quanh chấm `i`: dò ra hai phía tới khi đoạn đủ dài để thấy hướng */
function heading(pts, i, min) {
  for (let r = 1; r < 6; r++) {
    const [a, b] = [pts[Math.max(0, i - r)], pts[Math.min(pts.length - 1, i + r)]];
    if (a && b) {
      const d = unit(b.x - a.x, b.y - a.y);
      if (d && Math.hypot(b.x - a.x, b.y - a.y) >= min) return d;
    }
  }
  return null;
}

/** Hướng của bước chạy cuối cùng tính tới chấm `last`: vệt đứng yên ở cuối vẫn chỉ đúng chiều vừa đi */
function lastHeading(pts, last, min) {
  for (let k = last; k >= 1; k--) {
    const [a, b] = [pts[k - 1], pts[k]];
    if (a && b && Math.hypot(b.x - a.x, b.y - a.y) >= min) return unit(b.x - a.x, b.y - a.y);
  }
  return null;
}

/** Chữ trên ảnh có viền trắng để đọc được trên nền nào cũng vậy */
const tag = (key, x, y, text, size, fill, u, extra = {}) =>
  React.createElement(
    "text",
    {
      key,
      x: f2(x),
      y: f2(y),
      fontSize: f2(size),
      fontFamily: "monospace",
      fill,
      stroke: "#fff",
      strokeWidth: f2(0.9 * u),
      strokeOpacity: 0.9,
      paintOrder: "stroke",
      strokeLinejoin: "round",
      ...extra,
    },
    text,
  );

/** Mũi tên tam giác đầu ở `p + d·size` */
const arrow = (key, p, d, size, fill, op) => {
  const [nx, ny] = [-d[1], d[0]];
  const tip = [p.x + d[0] * size, p.y + d[1] * size];
  const back = [p.x - d[0] * size * 0.5, p.y - d[1] * size * 0.5];
  const pts = [
    tip,
    [back[0] + nx * size * 0.7, back[1] + ny * size * 0.7],
    [back[0] - nx * size * 0.7, back[1] - ny * size * 0.7],
  ];
  return React.createElement("polygon", {
    key,
    points: pts.map(([x, y]) => `${f2(x)},${f2(y)}`).join(" "),
    fill,
    fillOpacity: op,
    stroke: "#fff",
    strokeOpacity: op,
    strokeWidth: f2(size * 0.18),
    strokeLinejoin: "round",
  });
};

/** Các khúc liền (không vướng chấm khuất) của `pts` trong `a..b` */
const runs = (pts, a, b) => {
  const out = [];
  let cur = [];
  for (let i = a; i <= b; i++) {
    if (pts[i]) cur.push(pts[i]);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out.filter((r) => r.length > 1);
};
const poly = (key, list, props) =>
  React.createElement("polyline", {
    key,
    points: list.map((p) => `${f2(p.x)},${f2(p.y)}`).join(" "),
    fill: "none",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props,
  });

const KIND_ORDER = ["jerk", "hitch", "turn", "start", "stop"];
const KIND_NAME = {
  hitch: "khựng",
  jerk: "giật",
  turn: "quay gắt",
  start: "vào gắt",
  stop: "dừng gắt",
};

/** Quãng giây cảnh của sự kiện: khựng từ khung cuối còn chạy tới khung cuối còn chậm, giật là bước vọt */
const spanOf = (e, fps) =>
  e.kind === "hitch" ? [e.t, e.end] : e.kind === "jerk" ? [e.t - 1 / fps, e.t] : [e.t, e.t];
const sizeOf = (e) => e.px ?? e.dur ?? e.deg ?? 0;

/**
 * Đánh số sự kiện của cả tờ: cùng người, cùng loại, quãng giây chạm nhau (lệch tới 1.5 khung) là một sự kiện,
 * dù hiện ở nhiều ô hay nhiều khớp. Gắn `n` vào từng sự kiện của `cells` (`[{ t, data }]` của `motionData`); trả các
 * nhóm theo giây: `{ n, id, kind, from, to, joints: Map<khớp, sự kiện lớn nhất>, cells }`
 */
export function numberEvents(cells, fps = 30) {
  const all = [];
  for (const { t, data } of cells)
    for (const P of data)
      for (const L of P.lines)
        for (const e of L.events) all.push({ cell: t, id: P.id, joint: L.joint, e });
  all.sort((a, b) => a.e.t - b.e.t);
  const tol = 1.5 / fps;
  const groups = [];
  for (const x of all) {
    const [a, b] = spanOf(x.e, fps);
    let g = groups.find(
      (q) => q.id === x.id && q.kind === x.e.kind && a <= q.to + tol && b >= q.from - tol,
    );
    if (!g)
      groups.push((g = { id: x.id, kind: x.e.kind, from: a, to: b, joints: new Map(), cells: [] }));
    g.from = Math.min(g.from, a);
    g.to = Math.max(g.to, b);
    const prev = g.joints.get(x.joint);
    if (!prev || sizeOf(x.e) > sizeOf(prev)) g.joints.set(x.joint, x.e);
    if (!g.cells.includes(x.cell)) g.cells.push(x.cell);
    x.g = g;
  }
  groups.sort(
    (a, b) =>
      a.from - b.from ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) ||
      KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );
  groups.forEach((g, i) => (g.n = i + 1));
  for (const x of all) x.e.n = x.g.n;
  return groups;
}

/** Một vệt: đuôi mảnh nét đứt (đã qua) tới đầu mập nét liền (sắp tới), mũi tên theo chiều đi */
function trailMarks(P, L, named, t, u, fps, fs, names, labels, spots) {
  const color = SIDE_COLOR[L.side];
  const pts = L.pts;
  const n = pts.length;
  const ring = L.now
    ? React.createElement("circle", {
        key: "now",
        "data-now": "",
        cx: f2(L.now.x),
        cy: f2(L.now.y),
        r: f2(3.4 * u),
        fill: "none",
        stroke: "#111",
        strokeWidth: f2(1 * u),
      })
    : null;
  // khớp gần đứng yên: chấm chồng một chỗ chỉ thêm rối, còn vòng khung của ô (nhiều vệt thì bỏ cả vòng);
  // số đo vẫn ở bảng chữ
  if (isStill(L, fps)) return ring && names ? [ring] : [];
  let split = pts.findIndex((p) => p && p.t >= t - 1e-9);
  if (split < 0) split = n;
  const kids = [];
  const past = runs(pts, 0, Math.min(n - 1, split));
  const future = runs(pts, split, n - 1);
  for (const [k, r] of past.entries()) {
    kids.push(poly(`hp${k}`, r, { stroke: "#fff", strokeOpacity: 0.5, strokeWidth: f2(2.4 * u) }));
    kids.push(
      poly(`p${k}`, r, {
        stroke: color,
        strokeOpacity: 0.7,
        strokeWidth: f2(0.9 * u),
        strokeDasharray: `${f2(2 * u)} ${f2(1.6 * u)}`,
      }),
    );
  }
  for (const [k, r] of future.entries()) {
    kids.push(poly(`hf${k}`, r, { stroke: "#fff", strokeOpacity: 0.7, strokeWidth: f2(3.2 * u) }));
    kids.push(poly(`f${k}`, r, { stroke: color, strokeOpacity: 0.95, strokeWidth: f2(1.4 * u) }));
  }
  pts.forEach((p, i) => {
    if (!p) return;
    const r = u * (0.6 + 1.2 * (n > 1 ? i / (n - 1) : 1));
    const before = i < split;
    kids.push(
      React.createElement("circle", {
        key: `d${i}`,
        "data-frame": f2(p.t),
        cx: f2(p.x),
        cy: f2(p.y),
        r: f2(r),
        fill: before ? "#fff" : color,
        fillOpacity: before ? 0.8 : 0.95,
        stroke: before ? color : "#fff",
        strokeOpacity: before ? 0.8 : 0.95,
        strokeWidth: f2((before ? 0.4 : 0.3) * u),
      }),
    );
  });
  // mũi tên cách đều theo thời gian, neo ở khung của ô
  const every = Math.max(2, Math.round(fps / 4));
  for (let i = 0; i + 1 < n; i++) {
    const [a, b] = [pts[i], pts[i + 1]];
    if (!a || !b || (i - split) % every !== 0 || i === split) continue;
    const d = unit(b.x - a.x, b.y - a.y);
    if (!d || Math.hypot(b.x - a.x, b.y - a.y) < 3 * u) continue;
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    kids.push(arrow(`a${i}`, mid, d, 2 * u, color, i < split ? 0.6 : 0.95));
  }
  let last = n - 1;
  while (last >= 0 && !pts[last]) last--;
  if (last >= 0) {
    const d = lastHeading(pts, last, 0.5 * u) ?? [1, 0];
    const tip = { x: pts[last].x + d[0] * 2 * u, y: pts[last].y + d[1] * 2 * u };
    kids.push(arrow("end", tip, d, 3.4 * u, color, 1));
    const at = { x: tip.x + d[0] * 5 * u, y: tip.y + d[1] * 5 * u };
    if (names)
      labels.push({
        key: "name",
        x: at.x,
        y: at.y + 1.5 * u,
        text: L.joint,
        size: fs(4.5),
        fill: color,
        rank: 1,
        end: d[0] < 0,
      });
  }
  P.marks.forEach((mk, k) => {
    const i = pts.reduce(
      (b, p, j) => (p && (b < 0 || Math.abs(p.t - mk.t) < Math.abs(pts[b].t - mk.t)) ? j : b),
      -1,
    );
    if (i < 0) return;
    const d = heading(pts, i, 1.5 * u) ?? [1, 0];
    const [nx, ny] = [-d[1], d[0]];
    const p = pts[i];
    kids.push(
      React.createElement("line", {
        key: `m${k}`,
        x1: f2(p.x - nx * 4.5 * u),
        y1: f2(p.y - ny * 4.5 * u),
        x2: f2(p.x + nx * 4.5 * u),
        y2: f2(p.y + ny * 4.5 * u),
        stroke: "#111",
        strokeWidth: f2(1 * u),
      }),
    );
    if (named && mk.name)
      labels.push({
        key: `mn${k}`,
        x: p.x + nx * 5.5 * u,
        y: p.y + ny * 5.5 * u + 1.4 * u,
        text: mk.name,
        size: fs(4),
        fill: "#111",
        rank: 2,
        end: nx < 0,
      });
  });
  // sự kiện trùng chỗ (dừng rồi vào lại ở cùng điểm) chung một vòng, một số
  const notes = [];
  for (const [k, e] of L.events.entries()) {
    let at;
    if (e.kind === "hitch") {
      const run = pts.slice(e.from, e.to + 1).filter(Boolean);
      at = {
        x: run.reduce((s, p) => s + p.x, 0) / run.length,
        y: run.reduce((s, p) => s + p.y, 0) / run.length,
      };
    } else if (e.kind === "jerk") {
      const [a, b] = [pts[e.from], pts[e.to]];
      kids.push(
        React.createElement("line", {
          key: `ej${k}`,
          x1: f2(a.x),
          y1: f2(a.y),
          x2: f2(b.x),
          y2: f2(b.y),
          stroke: "#111",
          strokeWidth: f2(1.8 * u),
          strokeLinecap: "round",
        }),
      );
      at = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    } else at = pts[e.at];
    const same = notes.find((q) => Math.hypot(q.at.x - at.x, q.at.y - at.y) < 4 * u);
    if (same) {
      if (!same.n.includes(e.n)) same.n.push(e.n);
    } else notes.push({ at, n: [e.n] });
  }
  for (const [k, q] of notes.entries()) {
    kids.push(
      React.createElement("circle", {
        key: `er${k}`,
        "data-event": q.n.join(","),
        cx: f2(q.at.x),
        cy: f2(q.at.y),
        r: f2(3 * u),
        fill: "none",
        stroke: "#111",
        strokeWidth: f2(0.6 * u),
        strokeDasharray: `${f2(1.1 * u)} ${f2(0.8 * u)}`,
      }),
    );
    spots.push({ x: q.at.x, y: q.at.y, text: q.n.join(","), color });
  }
  if (ring) kids.push(ring);
  return kids;
}

const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/**
 * Nhãn chữ đè lên nhau (hay đè số sự kiện trong `placed`) thì dời dọc từng nấc một dòng, xen dưới / trên, theo
 * thứ tự `rank` (tên khớp, tên clip); hết chỗ thì giữ chỗ gốc. Hộp chữ ước theo chữ đơn cách `0.6em`
 */
function layout(labels, u, placed = []) {
  const box = (l, y) => {
    const w = 0.6 * l.size * l.text.length;
    const x0 = l.end ? l.x - w : l.x;
    return [x0, y - 0.8 * l.size, x0 + w, y + 0.25 * l.size];
  };
  return labels
    .map((l, i) => ({ ...l, i }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((l) => {
      let y = l.y;
      for (let n = 0; n <= 8; n++) {
        const dy = (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 1.1 * l.size;
        if (!placed.some((b) => hit(b, box(l, l.y + dy)))) {
          y = l.y + dy;
          break;
        }
      }
      placed.push(box(l, y));
      return tag(`${l.key}-${l.i}`, l.x, y, l.text, l.size, l.fill, u, {
        textAnchor: l.end ? "end" : undefined,
      });
    });
}

const segDist = (x, y, [x1, y1, x2, y2]) => {
  const [dx, dy] = [x2 - x1, y2 - y1];
  const n = dx * dx + dy * dy;
  const k = n > 0 ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / n)) : 0;
  return Math.hypot(x - x1 - k * dx, y - y1 - k * dy);
};

/** Thân người ở khung của ô thành các khúc tròn đầu: xương dày theo chiều cao người trên hình, đầu tròn */
function bodyCaps(data) {
  const caps = [];
  for (const P of data) {
    const B = P.body;
    if (!B) continue;
    const ys = B.segs.flatMap((s) => [s[1], s[3]]);
    const h = Math.max(...ys) - Math.min(...ys);
    for (const s of B.segs) caps.push({ s, r: 0.05 * h });
    const r = Math.max(1.05 * Math.hypot(B.head[0] - B.neck[0], B.head[1] - B.neck[1]), 0.08 * h);
    caps.push({ s: [...B.head, ...B.head], r });
  }
  return caps;
}

/**
 * Số sự kiện cạnh vòng đứt của nó: dò vòng ra xa dần quanh vòng, chọn chỗ gần nhất không đè thân người, số khác,
 * vòng sự kiện khác và không ra ngoài `bounds`; ít đè chấm vệt hơn thì tốt hơn. Xa vòng thì có nét dẫn
 */
function placeBadges(spots, data, u, size, bounds) {
  const caps = bodyCaps(data);
  const dots = data.flatMap((P) => P.lines.flatMap((L) => L.pts.filter(Boolean)));
  const placed = [];
  const kids = [];
  const ring = 3 * u;
  spots.forEach((s, k) => {
    const [w, h] = [0.62 * size * s.text.length + 0.7 * size, 1.3 * size];
    const d0 = ring + 0.55 * Math.hypot(w, h);
    let best;
    for (let step = 0; step < 8; step++) {
      const d = d0 + step * 0.8 * size;
      for (let a = 0; a < 16; a++) {
        // trên phải trước, rồi xoay xen hai phía
        const ang = -Math.PI / 4 + (a % 2 ? -1 : 1) * Math.ceil(a / 2) * (Math.PI / 8);
        const [cx, cy] = [s.x + Math.cos(ang) * d, s.y + Math.sin(ang) * d];
        const b = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
        let cost = d / u + a * 0.05;
        const probe = [];
        for (let i = 0; i <= 3; i++)
          for (let j = 0; j <= 3; j++)
            probe.push([b[0] + ((b[2] - b[0]) * i) / 3, b[1] + ((b[3] - b[1]) * j) / 3]);
        if (caps.some((c) => probe.some(([x, y]) => segDist(x, y, c.s) < c.r))) cost += 1000;
        if (placed.some((q) => hit(q, b))) cost += 2000;
        if (
          spots.some(
            (o, i) => i !== k && probe.some(([x, y]) => Math.hypot(x - o.x, y - o.y) < ring),
          )
        )
          cost += 40;
        if (
          bounds &&
          (b[0] < bounds.x ||
            b[1] < bounds.y ||
            b[2] > bounds.x + bounds.w ||
            b[3] > bounds.y + bounds.h)
        )
          cost += 500;
        cost += 2 * dots.filter((p) => p.x > b[0] && p.x < b[2] && p.y > b[1] && p.y < b[3]).length;
        if (!best || cost < best.cost) best = { cost, cx, cy, b, ang, d };
      }
      if (best.cost < 1000 && step >= 1) break;
    }
    placed.push(best.b);
    const g = [];
    if (best.d > d0 + 0.4 * size) {
      const [ux, uy] = [Math.cos(best.ang), Math.sin(best.ang)];
      const end = best.d - 0.5 * Math.min(w, h);
      g.push(
        React.createElement("line", {
          key: "lead",
          x1: f2(s.x + ux * ring),
          y1: f2(s.y + uy * ring),
          x2: f2(s.x + ux * end),
          y2: f2(s.y + uy * end),
          stroke: "#111",
          strokeWidth: f2(0.5 * u),
        }),
      );
    }
    g.push(
      React.createElement("rect", {
        key: "box",
        x: f2(best.b[0]),
        y: f2(best.b[1]),
        width: f2(w),
        height: f2(h),
        rx: f2(h / 2),
        fill: "#111",
        stroke: "#fff",
        strokeWidth: f2(0.4 * u),
      }),
      React.createElement(
        "text",
        {
          key: "n",
          x: f2(best.cx),
          y: f2(best.cy + 0.36 * size),
          fontSize: f2(size),
          fontFamily: "monospace",
          fontWeight: "bold",
          textAnchor: "middle",
          fill: "#fff",
        },
        s.text,
      ),
    );
    kids.push(React.createElement("g", { key: `b${k}`, "data-badge": s.text }, g));
  });
  return { kids, placed };
}

const isStill = (L, fps) => L.run * fps < TRAIL_EVENT.still && !L.events.length;

/**
 * Lớp phủ SVG từ `motionData`, `u` là một đơn vị nét trên hệ chỗ vẽ; `px` là số pixel PNG của một đơn vị ấy
 * — chữ không nhỏ dưới `10` px; `bounds` là vùng ô thấy trong hệ chỗ vẽ, số sự kiện không ra ngoài. Sự kiện chưa
 * đánh số (`numberEvents` của cả tờ) thì đánh số trong ô này
 */
export function motionOverlay(data, t, u, { fps = 30, px = Infinity, bounds } = {}) {
  if (data.some((P) => P.lines.some((L) => L.events.some((e) => e.n === undefined))))
    numberEvents([{ t, data }], fps);
  const fs = (k) => Math.max(k * u, 10 / px);
  const kids = [];
  const labels = [];
  const spots = [];
  for (const P of data) {
    const moving = P.lines.filter((L) => !isStill(L, fps));
    const named = P.lines.indexOf(moving[0]);
    // nhiều vệt một người thì tên khớp chồng lên nhau: bỏ tên, bảng chữ kể đủ từng vệt
    const names = moving.length <= 4;
    for (const g of P.ghosts) {
      const op = (0.7 * (P.n - g.k + 1)) / P.n;
      kids.push(
        React.createElement(
          "g",
          {
            key: `g-${P.id}-${g.dir}-${g.k}`,
            "data-ghost": `${P.id}@${g.t}`,
            stroke: GHOST,
            strokeOpacity: f2(op),
            strokeWidth: f2(0.9 * u),
            strokeLinecap: "round",
            strokeDasharray: g.dir < 0 ? `${f2(1.6 * u)} ${f2(1.4 * u)}` : undefined,
            fill: "none",
          },
          g.bones.map(([x1, y1, x2, y2], i) =>
            React.createElement("line", { key: i, x1: f2(x1), y1: f2(y1), x2: f2(x2), y2: f2(y2) }),
          ),
        ),
      );
    }
    P.lines.forEach((L, li) =>
      kids.push(
        React.createElement(
          "g",
          { key: `t-${P.id}-${L.joint}`, "data-trail": `${P.id}.${L.joint}` },
          trailMarks(P, L, li === named, t, u, fps, fs, names, labels, spots),
        ),
      ),
    );
  }
  const badges = placeBadges(spots, data, u, fs(5), bounds);
  if (badges.kids.length) kids.push(React.createElement("g", { key: "events" }, badges.kids));
  if (labels.length)
    kids.push(React.createElement("g", { key: "labels" }, layout(labels, u, badges.placed)));
  return kids.length ? React.createElement("g", { key: "motion", "data-motion": "" }, kids) : null;
}

const num1 = (v) => (Number.isFinite(v) ? `${+v.toFixed(1)}` : "—");
/** Giá trị kênh góc của một mốc thành dãy số; `undefined` là mốc không ghi kênh ấy */
const anglesOf = (k, ch) => {
  const v = rig.keyDelta(k)?.[ch];
  return v == null ? undefined : typeof v === "number" ? [v] : v;
};
const diffOf = (v, w) => {
  let m = 0;
  for (let j = 0; j < Math.max(v.length, w.length); j++)
    if (v[j] !== null && w[j] !== null) m = Math.max(m, Math.abs((v[j] ?? 0) - (w[j] ?? 0)));
  return m;
};
const partName = (ch, j) => {
  const name = rig.CHANNEL_PARTS[ch]?.[j];
  return `\`${ch}[${j}]\`${name ? ` ${name}` : ""}`;
};
const easeOf = (k) => k.ease ?? "linear";

/** Clip đang chạy ở giây `time` của một track, như `sceneAt`: clip cuối đã tới lượt, `-1` là chưa có */
const activeAt = (tr, time) => {
  let i = -1;
  for (let k = 0; k < tr.clips.length && tr.clips[k].start <= time + 1e-9; k++) i = k;
  return i;
};

/** Mốc bao quanh pha `[ua, ub]`: mốc cuối tới `ua`, các mốc giữa, mốc đầu từ `ub` */
function bracket(list, ua, ub) {
  let lo = -1;
  for (let i = 0; i < list.length; i++) if (list[i].t <= ua + 1e-9) lo = i;
  let hi = list.findIndex((x) => (ub > ua ? x.t >= ub - 1e-9 : x.t > ub + 1e-9));
  if (hi < 0) hi = list.length - 1;
  return list.slice(Math.max(0, lo), hi + 1);
}

/**
 * Các clip của người `m` chạy trong quãng `[a, b]` giây cảnh, mỗi clip kèm pha, mốc kẹp và các số đổi đáng kể
 * (từ `5°`) giữa các mốc ấy; quãng chạm đoạn hoà vào một clip thì có cả clip trước — nó còn chạy trong lúc hoà
 */
function clipsAround(m, a, b, fps) {
  const out = [];
  m.tracks.forEach((tr, ti) => {
    const ib = activeAt(tr, b);
    if (ib < 0) return;
    let ia = Math.max(0, activeAt(tr, a));
    if (ia > 0 && a < tr.clips[ia].start + tr.clips[ia].tau) ia--;
    for (let i = ia; i <= ib; i++) {
      const c = tr.clips[i];
      const next = tr.clips[i + 1];
      const x = { ti, track: tr.name, i, c, name: c.file ?? c.action?.name ?? "—" };
      // nối vào clip này: không phải clip mở đầu cảnh, quãng chạm `[start, start + blend]`
      x.blendIn = (i > 0 || c.start > 1e-9) && b >= c.start - 1e-9 && a <= c.start + c.tau + 1e-9;
      x.blendOut = !!next && b >= next.start - 1e-9 && a <= next.start + next.tau + 1e-9;
      if (next) [x.next, x.nextStart] = [next.file ?? next.action?.name ?? "—", next.start];
      const A = c.action;
      if (A?.keys?.length && !(c.stride && m.world?.path)) {
        const at = (time) =>
          rig.phaseOf(A, (Math.max(time, c.start) - c.start) / c.cycle + c.phase);
        Object.assign(x, { A, ua: at(a), ub: at(b) });
        x.ue = x.ub;
        const keys = A.keys.map((k, idx) => ({ idx, t: k.t, k }));
        // mốc kẹp tính trên quãng nới một khung mỗi phía: thấy cả mốc kề của bước vọt
        const [wa, wb] = [at(a - 1 / fps), at(b + 1 / fps)];
        x.keys = bracket(keys, wa, wb);
        const mask = rig.actionMask(A).filter((ch) => !c.mask || c.mask.includes(ch));
        x.chans = [];
        x.changes = [];
        for (const ch of Object.keys(rig.CHANNEL_PARTS)) {
          if (!mask.includes(ch)) continue;
          const ks = keys.flatMap((q) => {
            const v = anglesOf(q.k, ch);
            return v ? [{ ...q, v }] : [];
          });
          if (!ks.length) continue;
          const sel = bracket(ks, wa, wb);
          x.chans.push({ ch, ks, sel });
          const len = Math.max(...sel.map((q) => q.v.length));
          for (let j = 0; j < len; j++) {
            const vals = sel.map((q) => q.v[j]);
            if (vals.some((v) => v === null)) continue;
            const nums = vals.map((v) => v ?? 0);
            const range = Math.max(...nums) - Math.min(...nums);
            if (range >= 5) x.changes.push({ ch, j, range, sel, nums });
          }
        }
        x.changes.sort((p, q) => q.range - p.range);
      }
      // giây cảnh của pha `u` gần quãng sự kiện nhất
      x.when = (u) => b + (u - (x.ub ?? 0)) * c.cycle;
      out.push(x);
    }
  });
  return out;
}

/** Gợi ý theo dấu hiệu, thận trọng; không thấy dấu nào thì `không rõ` */
function hintOf(kind, clips, a, b, fps) {
  const fr = 1 / fps;
  const out = [];
  const keyed = clips.filter((x) => x.chans);
  const ref = (q, x) => `keys[${q.idx}] (t ${q.t}, ${sec(q.t * x.A.duration)} s)`;
  if (kind === "hitch") {
    for (const x of keyed)
      for (const { ch, ks } of x.chans)
        for (let j = 0; j + 1 < ks.length; j++) {
          const [p, q] = [ks[j], ks[j + 1]];
          const gap = (q.t - p.t) * x.c.cycle;
          const [tp, tq] = [x.when(p.t), x.when(q.t)];
          const d = diffOf(p.v, q.v);
          const around = [ks[j - 1], ks[j + 2]].filter(Boolean);
          if (gap > 0.1 && d <= 3 && tp <= b + 2 * fr && tq >= a - 2 * fr)
            if (around.some((r) => Math.max(diffOf(r.v, p.v), diffOf(r.v, q.v)) >= 10))
              out.push(
                `${ref(p, x)} và ${ref(q, x)} của \`${x.name}\` gần trùng tư thế ở \`${ch}\` (lệch tối đa ${num1(d)}°) mà cách nhau ${sec(gap)} s giữa đoạn đang đi — khựng do mốc thừa; bỏ một trong hai mốc`,
              );
        }
    if (!out.length)
      for (const x of keyed)
        for (const { ch, ks } of x.chans)
          for (let j = 1; j + 1 < ks.length; j++) {
            const q = ks[j];
            const tq = x.when(q.t);
            if (tq < a - 2 * fr || tq > b + 2 * fr) continue;
            if (easeOf(q.k) === "smooth" || easeOf(ks[j - 1].k) === "smooth")
              out.push(
                `\`ease: "smooth"\` quanh ${ref(q, x)} của \`${x.name}\` (\`${ch}\`) về vận tốc 0 ở mốc giữa — khựng; \`auto\` đi liền qua mốc`,
              );
          }
  }
  if (kind === "jerk") {
    for (const x of clips)
      if (x.blendIn && x.c.start >= a - 1e-9 && x.c.start <= b + 1e-9 && x.c.tau < 2 * fr)
        out.push(
          `giật ở chỗ nối clip: \`${x.name}\` (track ${x.ti}) vào ở giây ${sec(x.c.start)} với blend ${sec(x.c.tau)} s — tư thế đổi trong chưa tới hai khung; tăng \`blend\` của clip ấy (hay bỏ \`blend\` để rig tự tính)`,
        );
    const stray = [];
    for (const x of keyed)
      for (const { ch, ks } of x.chans)
        for (let j = 1; j + 1 < ks.length; j++) {
          const [p, q, r] = [ks[j - 1], ks[j], ks[j + 1]];
          const tq = x.when(q.t);
          if (tq < a - 2 * fr || tq > b + 2 * fr) continue;
          const [g1, g2] = [(q.t - p.t) * x.c.cycle, (r.t - q.t) * x.c.cycle];
          if (Math.min(g1, g2) > 2.5 * fr) continue;
          const f = (q.t - p.t) / (r.t - p.t);
          let dev = 0;
          let at = 0;
          for (let i = 0; i < q.v.length; i++) {
            if (q.v[i] === null || p.v[i] === null || r.v[i] === null) continue;
            const line = (p.v[i] ?? 0) + ((r.v[i] ?? 0) - (p.v[i] ?? 0)) * f;
            const e = Math.abs((q.v[i] ?? 0) - line);
            if (e > dev) [dev, at] = [e, i];
          }
          if (dev >= 10)
            stray.push({
              x,
              ch,
              q,
              dev,
              at,
              both: Math.max(g1, g2) <= 2.5 * fr,
              gap: Math.min(g1, g2),
            });
        }
    stray.sort((p, q) => q.both - p.both || q.dev - p.dev);
    for (const s of stray.slice(0, 1))
      out.push(
        `${ref(s.q, s.x)} của \`${s.x.name}\` chỉ cách mốc kề ${sec(s.gap)} s mà ${partName(s.ch, s.at)} lệch ${num1(s.dev)}° khỏi đường nối hai mốc kề — giật do mốc lạc; xoá mốc ấy`,
      );
    if (!out.length)
      for (const x of keyed)
        for (const { ch, ks } of x.chans)
          for (let j = 0; j + 1 < ks.length; j++) {
            const [p, q] = [ks[j], ks[j + 1]];
            const gap = (q.t - p.t) * x.c.cycle;
            const d = diffOf(p.v, q.v);
            if (gap <= 2 * fr && d >= 15 && x.when(q.t) >= a - fr && x.when(p.t) <= b + fr)
              out.push(
                `${ref(p, x)} → ${ref(q, x)} của \`${x.name}\` đổi \`${ch}\` ${num1(d)}° trong ${sec(gap)} s — cắt cứng; giãn hai mốc ra`,
              );
          }
    if (!out.length) {
      const blend = clips.find((x) => x.blendIn);
      if (blend)
        out.push(
          `không rõ — rơi vào đoạn hoà vào \`${blend.name}\` (giây ${sec(blend.c.start)}→${sec(blend.c.start + blend.c.tau)}), không thấy mốc lạc`,
        );
    }
  }
  if (kind === "start" || kind === "stop" || kind === "turn")
    for (const x of keyed)
      for (const { ch, ks } of x.chans)
        for (let j = 0; j < ks.length; j++) {
          const q = ks[j];
          if (Math.abs(x.when(q.t) - a) > 2 * fr) continue;
          const segs =
            kind === "start"
              ? [[q, ks[j + 1]]]
              : kind === "stop"
                ? [[ks[j - 1], q]]
                : [
                    [ks[j - 1], q],
                    [q, ks[j + 1]],
                  ];
          if (segs.some(([p, r]) => !p || !r || diffOf(p.v, r.v) < 3 || easeOf(p.k) !== "linear"))
            continue;
          const [p, r] = segs[kind === "stop" ? 0 : segs.length - 1];
          out.push(
            kind === "turn"
              ? `\`${ch}\` đổi chiều ở ${ref(q, x)} của \`${x.name}\` giữa hai đoạn \`linear\` — không chậm lại; \`auto\` hay \`smooth\``
              : `đoạn ${ref(p, x)} → ${ref(r, x)} của \`${x.name}\` ở \`${ch}\` là \`linear\`${p.k.ease ? "" : " (`ease` bỏ trống)"} — ${kind === "start" ? "vào" : "dừng"} gắt ở ${ref(q, x)}; cân nhắc \`auto\``,
          );
        }
  const uniq = [...new Set(out)];
  return uniq.length ? uniq.slice(0, 2).join("; ") : "không rõ";
}

const JOINT_SIZE = {
  hitch: (e) => `${sec(e.dur)} s`,
  jerk: (e) => `${Math.round(e.px)} px (nền ${Number.isFinite(e.base) ? e.base.toFixed(1) : "?"})`,
  turn: (e) => `${Math.round(e.deg)}°`,
  start: () => "",
  stop: () => "",
};

/** Một sự kiện của bảng: dòng đầu, rồi clip đang chạy, mốc kẹp, số đổi, gợi ý */
function eventRows(rt, g, fps) {
  const [a, b] = [g.from, g.to];
  const when = a === b ? `giây cảnh ${sec(a)}` : `giây cảnh ${sec(a)}→${sec(b)}`;
  const joints = [...g.joints.entries()]
    .map(([j, e]) => `${j}${JOINT_SIZE[g.kind](e) ? ` ${JOINT_SIZE[g.kind](e)}` : ""}`)
    .join(", ");
  const rows = [
    `#${g.n} ${KIND_NAME[g.kind]} — \`${g.id}\`: ${joints}; ${when}${g.kind === "hitch" ? ` (${sec(b - a)} s)` : ""}; ô ${g.cells.map((t) => `${sec(t)}s`).join(", ")}`,
  ];
  const m = rt?.cast.find((c) => c.id === g.id);
  if (!m) return rows;
  const clips = clipsAround(m, a, b, fps);
  for (const x of clips) {
    const blend = x.blendIn
      ? x.c.tau > 1e-9
        ? ` — sự kiện trong đoạn hoà vào clip này (${sec(x.c.start)}→${sec(x.c.start + x.c.tau)})`
        : " — sự kiện ở chỗ nối vào clip này, không hoà"
      : x.blendOut
        ? ` — clip sau \`${x.next}\` tiếp quản ở giây ${sec(x.nextStart)}`
        : "";
    const head = `track ${x.ti}${x.track ? ` \`${x.track}\`` : ""} \`${x.name}\` bắt đầu ${sec(x.c.start)} s, blend ${sec(x.c.tau)} s${blend}`;
    if (!x.A) {
      rows.push(
        `  · ${head}${x.c.action ? " (không tra mốc: sinh bằng `gen` hay đi theo nhịp `path`)" : ""}`,
      );
      continue;
    }
    const [sa, sb] = [x.ua * x.A.duration, x.ub * x.A.duration];
    const span = (p, q, f) => (Math.abs(p - q) < 1e-9 ? f(p) : `${f(p)}→${f(q)}`);
    rows.push(
      `  · ${head}; giây hành động ${span(sa, sb, sec)} / duration ${sec(x.A.duration)} s = t ${span(x.ua, x.ub, (v) => `${+v.toFixed(4)}`)}${Math.abs(x.c.cycle - x.A.duration) > 1e-6 ? ` (clip chạy chu kỳ ${sec(x.c.cycle)} s)` : ""}${x.A.end === "hold" && x.ua >= 1 - 1e-9 ? " — đã hết hành động, giữ mốc cuối" : ""}`,
    );
    if (!x.changes.length) {
      rows.push("    không kênh góc nào đổi quanh sự kiện");
      continue;
    }
    rows.push(
      `    mốc kẹp: ${x.keys.map((q) => `keys[${q.idx}] t ${q.t} (${sec(q.t * x.A.duration)} s, ${easeOf(q.k)})`).join(" · ")}`,
    );
    for (const c of x.changes.slice(0, 4))
      rows.push(
        `    ${partName(c.ch, c.j)}: ${c.sel.map((q, i) => `keys[${q.idx}] ${num1(c.nums[i])}`).join(" · ")}`,
      );
  }
  rows.push(`  gợi ý: ${hintOf(g.kind, clips, a, b, fps)}`);
  return rows;
}

/**
 * Phần chữ đi kèm ảnh: cách đọc ngắn, bảng sự kiện (số trên ảnh, clip, mốc kẹp, số đổi, gợi ý) và số đo mỗi ô ×
 * vệt. `cells` là `[{ t, data }]` của `motionData`, `rt` để tra clip và mốc. MCP trả kèm ảnh, CLI in ra stdout.
 * docs/04-mcp.md#người-3d
 */
export function motionText(
  cells,
  {
    rt,
    fps = 30,
    span = 1,
    relative = false,
    ghosts = 0,
    ghostStep = 0.1,
    skeleton = false,
    video,
  },
) {
  const trails = cells.some((c) => c.data.some((P) => P.lines.length));
  const lines = ["Cách đọc (ngưỡng và chi tiết: mục Vệt chuyển động của `stickman docs 04`):"];
  if (trails)
    lines.push(
      `- Chấm = chỗ khớp ở một khung (1/${fps} s): dồn là chậm, thưa là nhanh. Vệt phủ ±${sec(span)} s quanh giây của ô (dải trên ô).`,
      "- Chấm nhỏ rỗng, nét đứt = đã qua → chấm to đặc, nét liền = sắp tới; mũi tên chỉ chiều đi; vòng đen = khớp ở giây của ô.",
      "- Màu: hồng = bên phải, xanh lục lam = bên trái, xám = giữa. Gạch ngang kèm tên = một clip bắt đầu.",
      "- Vòng đứt kèm số n = sự kiện #n của bảng dưới (nét đen đậm = bước giật); cùng số ở nhiều ô, nhiều khớp là một sự kiện.",
      "- `keys[i]` là phần tử thứ i (đếm từ 0) của `keys` trong file hành động; `t` = giây hành động / `duration`.",
    );
  if (ghosts)
    lines.push(
      `- Bóng que xương xám: ${ghosts} khung mỗi phía cách ${sec(ghostStep)} s; nét đứt là trước giây của ô, nét liền là sau.`,
    );
  if (skeleton)
    lines.push(
      "- Que xương: hồng phải, xanh lục lam trái, xám cột sống; đoạn gần ống kính hơn hông nét to; gạch từ đầu là hướng mặt; lưới sàn ô 100.",
    );
  if (relative) lines.push("- `relative`: vệt đã trừ phần dời của hông so với khung của ô.");
  if (!trails) return lines.join("\n");
  const groups = numberEvents(cells, fps);
  lines.push("", groups.length ? "Sự kiện:" : "Sự kiện: không có.");
  for (const g of groups) lines.push(...eventRows(rt, g, fps));
  lines.push(
    "",
    `Số đo (px/khung trên video ${video ?? "?"} ngang):`,
    "| ô (cửa sổ) | khớp | min | trung vị | max | sự kiện |",
    "|---|---|---|---|---|---|",
  );
  const hints = [];
  for (const { t, data } of cells)
    for (const P of data) {
      for (const L of P.lines) {
        const s = sorted(L.pts.map((p) => p?.v));
        const ev = [...new Set(L.events.map((e) => `#${e.n}`))].join(", ") || "—";
        lines.push(
          `| ${sec(t)}s (${sec(P.window[0])}–${sec(P.window[1])}) | ${P.id}.${L.joint} | ${num1(s[0])} | ${num1(median(s))} | ${num1(s[s.length - 1])} | ${ev} |`,
        );
      }
      if (P.lines.length && !P.relative && P.travel > 60)
        hints.push(
          `\`${P.id}\` dời ${Math.round(P.travel)} px trong cửa sổ ô ${sec(t)}s — vệt tay chân gồm cả đường đi; thêm \`relative\` để thấy cung tay chân tại chỗ.`,
        );
    }
  if (hints.length) lines.push("", ...hints);
  return lines.join("\n");
}
