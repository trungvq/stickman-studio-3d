// Phần thuần của `stickman gen walk` (docs/14-di-muot.md mục 5): cú pháp điểm, luật thời gian, cung bo góc, cú quay tại
// chỗ — ra mốc `path` và clip đi / đứng của track. Chỉ nhập lõi rig: trang soi (`gen-pages.mjs`) nạp được trong trình duyệt.
import * as rig from "@stickman3d/rig/core";

const D = Math.PI / 180;
/** Tốc quay thân lớn nhất bộ sinh nhận trên cung bo, độ mỗi giây: bán kính nhỏ nhất là `v / ω_c` */
export const WALK_TURN_RATE = 120;
/** Cung bo chia đều, mỗi phần tới ngần này độ hướng */
export const ARC_STEP = 30;
/** Bán kính bo mặc định (vòng chữ U, góc quá `SOFT_MAX`), đơn vị rig nhân `world.s` — 0,5 m */
export const ARC_RADIUS = 125;
/** Góc rẽ khi đang đi tới ngần này độ là đích mềm, tới `CORNER_MAX` thì tự bo cung, quá nữa là lỗi */
export const SOFT_MAX = 100;
export const CORNER_MAX = 135;
/** Mặc định: giây mỗi `90°` quay tại chỗ, giây đứng ở điểm cuối, `blend` của clip */
export const WALK_DEFAULTS = { turnTime: 0.8, hold: 0.6, blend: 0.3, start: "rest" };
export const TURN_TIME_RANGE = [0.5, 2];
export const HOLD_MIN = 0.2;
/** Quay tại chỗ dưới ngần này độ thì không quay (đứng rồi đi thẳng) */
export const TURN_MIN = 15;
/** Điểm cách điểm trước dưới ngần này (nhân `world.s`) là lỗi; hai mốc dời chỗ liền nhau cách dưới `KEY_GAP` giây là lỗi */
export const POINT_MIN = 10;
export const KEY_GAP = 0.05;
/** Nhịp cuối của cú quay ngắn nhất để rig ghép quay rồi đi (`TURN_JOIN_BEAT` của lõi) */
export const JOIN_BEAT = 0.12;
/** Mốc dừng giữa đường: đứng ít nhất ngần này giây trước cú quay */
const STAND_MIN = 0.3;
/** Khởi hành từ đứng: `path` đứng yên ít nhất ngần này giây trước khi rời chỗ (`LAUNCH_REST` của lõi) */
export const REST_BEFORE = 0.1;
/** Hai góc liền nhau cách dưới `(|θ₁| + |θ₂|) / (2 · OVERLAP · TURN_WALK)` giây thì cảnh báo */
const OVERLAP = 0.8;

const r1 = (v) => Math.round(v * 10) / 10 + 0;
const r3 = (v) => Math.round(v * 1000) / 1000 + 0;
const floor3 = (v) => Math.floor(v * 1000 + 1e-6) / 1000 + 0;
const wrap180 = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
/** Yaw (độ) của hướng sàn `[dx, dz]`: `0` là `+x`, `90` là `−z` */
const heading = (dx, dz) => Math.atan2(-dz, dx) / D;
/** Hướng sàn `[x, z]` của yaw (độ) */
const unit = (yaw) => [Math.cos(yaw * D), -Math.sin(yaw * D)];
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const num = (v) => String(r1(v));

/** Bán kính bo nhỏ nhất ở tốc độ `v` (đơn vị thế giới mỗi giây) */
export const arcMin = (v) => v / (WALK_TURN_RATE * D);

/** Bán kính bo tự chọn: `max(125 · s, v / ω_c)` */
export const arcAuto = (v, s = 1) => Math.max(r1(ARC_RADIUS * s), Math.ceil(arcMin(v) * 10) / 10);

/**
 * Tốc độ tự nhiên của hành động đi `a` (đã `parseAction`) cho người cao `h`, `world.s` `s`, nền `base`:
 * `actionStride · h · s / duration`, đơn vị thế giới mỗi giây
 */
export const naturalSpeed = (a, h = 1, s = 1, base) =>
  (rig.actionStride(a, base) * h * s) / a.duration;

const POINT = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:(!)(.*))?$/;

/**
 * Điểm của `--to`: chuỗi `x,z` / `x,z!` / `x,z!yaw` cách nhau bằng dấu cách, hay mảng `{ at: [x, z], stop?, yaw? }` (MCP).
 * Trả `[{ at, stop, yaw? }]`; sai cú pháp, `yaw` không phải số, `!yaw` giữa đường thì gọi `fail`
 */
export function parsePoints(to, fail) {
  let list;
  if (typeof to === "string") {
    const toks = to.trim().split(/\s+/).filter(Boolean);
    list = toks.map((tok) => {
      const m = POINT.exec(tok);
      if (!m) fail(`--to: \`${tok}\` không phải \`x,z\`, \`x,z!\` hay \`x,z!yaw\``);
      const yaw = m[4];
      if (m[3] && yaw !== "" && !Number.isFinite(Number(yaw)))
        fail(`--to: \`yaw\` của \`${tok}\` không phải số`);
      return {
        at: [Number(m[1]), Number(m[2])],
        stop: !!m[3],
        ...(m[3] && yaw !== "" && { yaw: Number(yaw) }),
      };
    });
  } else if (Array.isArray(to))
    list = to.map((p, i) => {
      const at = p?.at;
      if (!Array.isArray(at) || at.length !== 2 || !at.every(Number.isFinite))
        fail(`to[${i}].at phải là hai số [x, z]`);
      if (p.yaw !== undefined && !Number.isFinite(p.yaw))
        fail(`to[${i}].yaw phải là số, không phải \`${p.yaw}\``);
      return {
        at: [at[0], at[1]],
        stop: !!p.stop || p.yaw !== undefined,
        ...(p.yaw !== undefined && { yaw: p.yaw }),
      };
    });
  else fail('thiếu --to "<x,z> …" (điểm sàn thế giới rig)');
  if (!list.length) fail('--to chưa có điểm nào: "<x,z> …"');
  list.forEach((p, i) => {
    if (p.yaw !== undefined && i < list.length - 1)
      fail(`--to: \`!yaw\` chỉ ở điểm cuối, không ở điểm ${i + 1} — giữa đường dùng \`x,z!\``);
  });
  return list;
}

/** Chữ `--to` của các điểm đã parse — dòng "chạy lại" */
export const pointsText = (pts) =>
  pts
    .map((p, i) => {
      const xz = `${num(p.at[0])},${num(p.at[1])}`;
      if (p.yaw !== undefined) return `${xz}!${p.yaw}`;
      return p.stop && i < pts.length - 1 ? `${xz}!` : xz;
    })
    .join(" ");

/**
 * Lập timeline đi (docs/14-di-muot.md mục 5.3): từ chỗ đứng `P0` (`[x, y, z]`), `yaw0` lúc `at` và các điểm `pts`, ra mốc
 * `path` (`{ t, at, yaw, steps? }`), clip của track (`{ action, start, cycle?, blend }`) và sự kiện (góc mềm, cung, dừng,
 * quay tại chỗ). `o`: `at`, `start` `rest` | `moving`, `v` tốc độ, `c` `cycle` của clip đi, `b` `blend`, `s` `world.s`,
 * `radius`, `turnTime` (giây mỗi `90°`), `turnSide` `auto` | `right` | `left`, `eye` (`[x, z]` của mắt ống kính, cho
 * `auto`), `action`, `after`, `afterAtStart` (khởi hành cần clip `after` ở `at`), `afterBlend` (`blend` của clip ấy),
 * `rested` (giây `path` đã đứng yên trước `at`), `fail(msg)`
 */
export function planWalk(o) {
  const { at, start, P0, pts, v, c, b, s, fail } = o;
  const y = P0[1];
  const keys = [];
  const clips = [];
  const events = [];
  const warnings = [];
  const notes = [];
  const rmin = arcMin(v);
  let pos = [P0[0], P0[2]];
  let yaw = o.yaw0;

  const key = (t, xz, yw, steps) => {
    const k = { t: r3(t), at: [r1(xz[0]), y, r1(xz[1])], yaw: r1(yw), ...(steps && { steps }) };
    const prev = keys[keys.length - 1];
    if (prev && k.t <= prev.t)
      fail(`mốc \`path\` giây ${k.t} không sau mốc trước (${prev.t}) — điểm quá gần hay quá nhanh`);
    keys.push(k);
    return k;
  };
  const clip = (action, t, extra) => {
    const prev = clips[clips.length - 1];
    if (prev && t <= prev.start)
      fail(
        `clip \`${action}\` ở giây ${t} không sau clip \`${prev.action}\` ở giây ${prev.start} — quãng đi quá ngắn cho một bước: dời điểm xa hơn hay giảm --speed`,
      );
    clips.push({ action, start: t, ...extra });
  };
  const walkClip = (t, blend) => clip(o.action, r3(t), { cycle: c, blend });

  /** Chiều quay nửa vòng: giữa cú quay mặt hướng về mắt ống kính; máy thẳng trục thì trái */
  const autoSide = () => {
    if (!o.eye) return "left";
    const e = [o.eye[0] - pos[0], o.eye[1] - pos[1]];
    const n = Math.hypot(e[0], e[1]) || 1;
    const dot = (yw) => (unit(yw)[0] * e[0] + unit(yw)[1] * e[1]) / n;
    const [l, r] = [dot(yaw - 90), dot(yaw + 90)];
    return Math.abs(l - r) < 0.05 ? "left" : r > l ? "right" : "left";
  };

  /** Cú quay tại chỗ từ `t0` tới `target` (luật 8, 9): `{ end, beat }`, hay `undefined` khi không cần quay */
  const turn = (target, t0, final = false) => {
    let delta = wrap180(target - yaw);
    if (Math.abs(delta) < (final ? 0.5 : TURN_MIN)) return undefined;
    let side = delta > 0 ? "right" : "left";
    const half = Math.abs(Math.abs(delta) - 180) <= 0.5;
    if (half) {
      side = o.turnSide === "auto" ? autoSide() : o.turnSide;
      delta = side === "right" ? 180 : -180;
    }
    const A = Math.abs(delta);
    const T = final
      ? Math.max((o.turnTime * A) / 90, (1.5 * A) / 300 + 0.1)
      : (o.turnTime * A) / 90;
    const steps = Math.max(1, Math.ceil(A / 90 - 1e-9));
    key(t0 + T, pos, yaw + delta, steps);
    yaw += delta;
    events.push({ kind: "turn", t: r3(t0), t1: r3(t0 + T), delta, ...(half && { side }) });
    return { end: r3(t0 + T), beat: T / steps };
  };
  /** Quay rồi đi (luật 10): clip đi bắt đầu giữa nhịp cuối */
  const join = (tr) => {
    if (tr.beat < JOIN_BEAT - 1e-9)
      fail(
        `nhịp cuối của cú quay ${r3(tr.beat)} s, dưới ${JOIN_BEAT} s nên rig không ghép quay rồi đi — tăng --turn-time`,
      );
    walkClip(tr.end - tr.beat / 2, b);
  };

  /** Đi một chặng từ `pos` qua các điểm `run` tới mốc dừng (điểm cuối của chặng) từ giây `t0`; trả giây mốc dừng */
  const walkRun = (run, t0) => {
    const P = [pos, ...run.map((p) => [r1(p.at[0]), r1(p.at[1])])];
    for (let j = 1; j < P.length; j++)
      if (dist(P[j - 1], P[j]) < POINT_MIN * s)
        fail(
          `--to: điểm ${num(P[j][0])},${num(P[j][1])} cách điểm trước ${r1(dist(P[j - 1], P[j]))}, dưới ${r1(POINT_MIN * s)}`,
        );
    const n = P.length - 1;
    const hs = [];
    for (let j = 0; j < n; j++) hs.push(heading(P[j + 1][0] - P[j][0], P[j + 1][1] - P[j][1]));
    const hc = [yaw + wrap180(hs[0] - yaw)];
    for (let j = 1; j < n; j++) hc.push(hc[j - 1] + wrap180(hs[j] - hs[j - 1]));
    // góc ở P[j] (j = 1 … n−1): bán kính, phần cạnh cung lấy
    const R = [0];
    const L = [0];
    for (let j = 1; j < n; j++) {
      const theta = hc[j] - hc[j - 1];
      const A = Math.abs(theta);
      if (A > CORNER_MAX)
        fail(
          `góc rẽ ${Math.round(A)}° ở ${num(P[j][0])},${num(P[j][1])} quá ${CORNER_MAX}° khi đang đi — dừng rồi quay (\`x,z!\`) hay vòng chữ U bằng hai góc 90° với --radius`,
        );
      let r = 0;
      if (o.radius > 0 && A >= 0.5) r = o.radius;
      else if (A > SOFT_MAX) {
        r = arcAuto(v, s);
        notes.push(
          `góc ${Math.round(A)}° ở ${num(P[j][0])},${num(P[j][1])} quá ${SOFT_MAX}°: bo cung bán kính ${r}`,
        );
      }
      if (r > 0 && r < rmin - 1e-6)
        fail(
          `bán kính bo ${r} dưới ${r1(rmin)} (tốc ${r1(v)} đơn vị/s chia ${WALK_TURN_RATE}°/s): bán kính lớn hơn, giảm --speed, hay dừng rồi quay (\`x,z!\`)`,
        );
      R.push(r);
      L.push(r * Math.tan((A / 2) * D));
    }
    R.push(0);
    L.push(0);
    for (let j = 0; j < n; j++) {
      const len = dist(P[j], P[j + 1]);
      if (L[j] + L[j + 1] > len + 1e-6)
        fail(
          `cạnh ${num(P[j][0])},${num(P[j][1])} → ${num(P[j + 1][0])},${num(P[j + 1][1])} dài ${r1(len)}, không đủ cho cung bo (cần ${r1(L[j] + L[j + 1])}) — bán kính nhỏ hơn hay điểm xa hơn`,
        );
    }
    // dãy điểm của chặng: góc mềm một mốc, cung là mốc đầu cung, các mốc giữa cung, mốc cuối cung
    const route = [];
    let arcAtStart = false;
    const lastXz = () => (route.length ? route[route.length - 1].xz : pos);
    for (let j = 1; j < n; j++) {
      const theta = hc[j] - hc[j - 1];
      if (!R[j]) {
        route.push({ xz: P[j], yaw: (hc[j - 1] + hc[j]) / 2, corner: theta });
        continue;
      }
      const [ui, uo] = [unit(hs[j - 1]), unit(hs[j])];
      const A = [P[j][0] - L[j] * ui[0], P[j][1] - L[j] * ui[1]];
      const B = [P[j][0] + L[j] * uo[0], P[j][1] + L[j] * uo[1]];
      const glued = dist(lastXz(), A) < 1 * s;
      if (!glued) route.push({ xz: A, yaw: hc[j - 1], arc: "from", theta });
      else if (route.length) route[route.length - 1].arc = "mid";
      else arcAtStart = true;
      const sigma = Math.sign(theta);
      const nArc = Math.ceil(Math.abs(theta) / ARC_STEP - 1e-9);
      const ua = unit(hc[j - 1] + 90);
      const C = [A[0] + sigma * R[j] * ua[0], A[1] + sigma * R[j] * ua[1]];
      for (let q = 1; q < nArc; q++) {
        const psi = hc[j - 1] + (theta * q) / nArc;
        const u = unit(psi + 90);
        route.push({ xz: [C[0] - sigma * R[j] * u[0], C[1] - sigma * R[j] * u[1]], yaw: psi });
      }
      route.push({ xz: B, yaw: hc[j], arc: "to", theta, r: R[j] });
    }
    const end = P[n];
    const tail =
      route.length && route[route.length - 1].arc === "to" && dist(lastXz(), end) < 1 * s
        ? route.pop()
        : undefined;
    route.push({
      xz: end,
      yaw: hc[n - 1],
      ...(tail && { arc: "to", theta: tail.theta, r: tail.r }),
    });
    // giây theo dây cung thật giữa các mốc đã tròn, cùng tốc độ
    let cum = 0;
    let prev = [r1(pos[0]), r1(pos[1])];
    let prevT = t0;
    let arc = arcAtStart ? { kind: "arc", t: t0, theta: 0, r: 0 } : undefined;
    for (const p of route) {
      const xz = [r1(p.xz[0]), r1(p.xz[1])];
      cum += dist(prev, xz);
      const t = r3(t0 + cum / v);
      if (t - prevT < KEY_GAP - 1e-9)
        fail(
          `hai mốc dời chỗ cách ${r3(t - prevT)} s (dưới ${KEY_GAP} s) ở ${num(xz[0])},${num(xz[1])} — bán kính, điểm xa hơn hay giảm --speed`,
        );
      key(t, xz, p.yaw);
      if (p.corner !== undefined && Math.abs(p.corner) >= 0.5)
        events.push({ kind: "corner", t, theta: p.corner });
      if (p.arc === "from") arc = { kind: "arc", t, theta: 0, r: 0 };
      if (p.arc === "to" || p.arc === "mid") {
        arc.theta += p.theta;
        arc.r = Math.max(arc.r, p.r);
      }
      if (p.arc === "to") {
        events.push({ ...arc, t1: t });
        arc = undefined;
      }
      [prev, prevT] = [xz, t];
    }
    pos = end;
    yaw = hc[n - 1];
    return prevT;
  };

  const runs = [];
  let cur = [];
  pts.forEach((p, i) => {
    cur.push(p);
    if (p.stop || i === pts.length - 1) {
      runs.push(cur);
      cur = [];
    }
  });
  let t = at;
  runs.forEach((run, r) => {
    const h1 = heading(r1(run[0].at[0]) - pos[0], r1(run[0].at[1]) - pos[1]);
    if (r === 0 && start === "moving") {
      yaw = h1;
      key(t, pos, yaw);
      walkClip(t, 0);
    } else {
      if (r === 0) key(t, pos, yaw);
      const t0 = t;
      const tr = turn(h1, t);
      const base = r === 0 && o.afterAtStart;
      if (base) clip(o.after, r3(t0), { blend: o.afterBlend ?? b });
      if (tr) {
        join(tr);
        t = tr.end;
      } else {
        // không quay (luật 11): clip đi hoà từ nền đứng, `path` rời chỗ sau khi đứng yên đủ `REST_BEFORE`
        const lead = base
          ? Math.max(STAND_MIN, (o.afterBlend ?? b) + 0.05)
          : r === 0
            ? Math.max(0, REST_BEFORE - (o.rested ?? Infinity))
            : 0;
        if (lead > 0) {
          t = r3(t + lead);
          key(t, pos, yaw);
        }
        walkClip(t, b);
      }
    }
    const ts = walkRun(run, t);
    events.push({ kind: "stop", t: ts });
    clip(o.after, floor3(ts - c / 4), { blend: b });
    const last = run[run.length - 1];
    if (r < runs.length - 1) {
      t = r3(ts + Math.max(STAND_MIN, b - c / 4 + 0.05));
      key(t, pos, yaw);
    } else if (last.yaw !== undefined) t = turn(last.yaw, ts, true)?.end ?? ts;
    else t = ts;
  });
  // góc, cung liền nhau quay chồng nhau
  const bends = events.filter((e) => e.kind === "corner" || e.kind === "arc");
  for (let i = 1; i < bends.length; i++) {
    const [p, q] = [bends[i - 1], bends[i]];
    const need = (Math.abs(p.theta) + Math.abs(q.theta)) / (2 * OVERLAP * rig.TURN_WALK);
    if (q.t - (p.t1 ?? p.t) < need - 1e-9)
      warnings.push(
        `góc rẽ giây ${p.t} và giây ${q.t} cách ${r3(q.t - (p.t1 ?? p.t))} s, dưới ${r3(need)} s: hai cú quay thân chồng nhau — dời điểm xa hơn hay giảm --speed`,
      );
  }
  events.sort((a, b2) => a.t - b2.t);
  return { keys, clips, events, warnings, notes, end: keys[keys.length - 1].t, yaw };
}

/**
 * Điểm `--to` của từng kịch bản trang soi (docs/14 mục 2.7) cho người đứng ở `at` (`[x, z]`) hướng `+x`: `lead`, `after`, góc
 * `theta`, `sigma` `±1`, bán kính `r`
 */
export function shapePoints(shape, { lead, after, theta, sigma, r, at = [0, 0] }) {
  const xz = (x, z) => `${num(at[0] + x)},${num(at[1] + z)}`;
  if (shape === "straight") return xz(lead, 0);
  if (shape === "back") return `${xz(lead, 0)}! ${xz(0, 0)}`;
  if (shape === "uturn")
    return `${xz(lead + r, 0)} ${xz(lead + r, -sigma * 2 * r)} ${xz(lead - after, -sigma * 2 * r)}`;
  return `${xz(lead, 0)} ${xz(lead + after * Math.cos(theta * D), -sigma * after * Math.sin(theta * D))}`;
}
