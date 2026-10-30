// Bộ tự kiểm dùng chung của `stickman gen`: chạy hành động vừa sinh trong chính cảnh (runtime thật, đúng giây cảnh sẽ gọi)
// rồi đo bằng phép đo của `check`: cổ tay so với kẹp, tầm với, khuỷu đi một chiều, điểm tiếp xúc trôi, và các nhóm
// `move` / `clash` / `held` trên cảnh three của repo so với cảnh chưa có hành động. Mỗi kiểu của `gen` khai một `GenSpec`.
// docs/05-repo-video.md#sinh-hành-động-theo-cảnh
import * as rig from "@stickman3d/rig/core";
import { baselineEntries, checkScenes, compareBaseline, lineKey } from "./lib.mjs";

/** Mẫu đo của phần lõi: một khung video `1/30 s` */
export const GEN_STEP = 1 / 30;
/** Khuỷu được lùi tối đa ngần này độ (`φ` quanh trục vai → cổ tay) trong quãng phải đi một chiều */
export const ELBOW_BACK = 2;

/**
 * Một lượt tự kiểm: `id` người diễn, `side` tay mang món, `window` quãng giây cảnh của hành động; `contact`: điểm trên món
 * (`probe(t)`) phải nằm trên đích (`target(t)`) trong `[from, to]`, lệch quá `tol` (mặc định `HELD_TOUCH`) là lỗi; `monotone`:
 * các quãng khuỷu phải đi một chiều. Mọi hàm trả toạ độ thế giới rig, `undefined` khi không đo được
 */
const sub = (a, b) => a.map((v, i) => v - b[i]);
const len = (a) => Math.hypot(...a);
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const sec = (t) => t.toFixed(2);

/** Các giây mẫu `[from, to]` mỗi `step`, luôn có hai đầu */
export function sampleTimes(from, to, step = GEN_STEP) {
  const out = [];
  for (let t = from; t < to - 1e-9; t += step) out.push(+t.toFixed(4));
  out.push(+to.toFixed(4));
  return out;
}

/** Khuỷu lùi tổng cộng bao nhiêu độ ngược chiều đi chính (đầu → cuối) của chuỗi `φ` */
export function backtrack(phis) {
  if (phis.length < 2) return 0;
  const dir = Math.sign(phis.at(-1) - phis[0]) || 1;
  let back = 0;
  let worst = 0;
  for (let i = 1; i < phis.length; i++) {
    const d = (phis[i] - phis[i - 1]) * dir;
    back = d < 0 ? back - d : 0;
    worst = Math.max(worst, back);
  }
  return worst;
}

/**
 * Phần lõi của bộ tự kiểm trên runtime `rt` (nhân vật thật ở `chars`): mỗi luật một dòng `{ rule, level, worst, t, limit, msg }`,
 * `level` là `lỗi`, `cảnh báo` hay `ok`. Ngưỡng lấy của `check`: cổ tay vượt kẹp là lỗi, còn cách kẹp dưới `HELD_WRIST` là cảnh
 * báo; khe tới đích quá `AIM_GAP · s` là ngoài tầm; điểm tiếp xúc trôi quá `tol`; khuỷu lùi quá `ELBOW_BACK`
 */
export function coreChecks(rt, chars, spec) {
  const { id, side = "right", window, step = GEN_STEP } = spec;
  const c = chars[id];
  if (!c) throw new Error(`không có nhân vật của \`${id}\``);
  const sign = side === "right" ? -1 : 1;
  const h = rt.heights[id] ?? 1;
  const at = (t) => rig.sceneAt(rt, id, t, h, rt.bodies[id]);
  const rows = [];
  const times = sampleTimes(window[0], Math.min(window[1], rt.duration), step);

  // cổ tay và tầm với trên từng khung
  let wrist = { m: -Infinity, t: window[0], w: null };
  let reach = { gap: 0, t: window[0], s: 1 };
  for (const t of times) {
    const sp = at(t);
    const hr = rig.handReport(rt, id, side, t, { char: c });
    if (hr) {
      const m = rig.heldWristMargin(hr.wrist.drawn);
      if (m > wrist.m) wrist = { m, t, w: hr.wrist.drawn };
    }
    const arm = rig.actArm(c, sp, sign);
    const gap = arm?.report.reach?.gap ?? 0;
    if (gap > reach.gap) reach = { gap, t, s: sp.world?.s ?? 1 };
  }
  const wristLimit = rig.HELD_WRIST;
  const w = wrist.w;
  rows.push({
    rule: "wrist",
    level: wrist.m > 0 ? "lỗi" : wrist.m > -wristLimit ? "cảnh báo" : "ok",
    worst: r2(wrist.m),
    t: wrist.t,
    limit: `còn ≥ ${wristLimit}° tới kẹp`,
    msg: w
      ? `cổ tay ${wrist.m > 0 ? "vượt kẹp" : "còn cách kẹp"} ${r2(Math.abs(wrist.m))}° ở giây ${sec(wrist.t)} (xoay ${Math.round(w.turn)}°, gập ${Math.round(w.bend)}°, lệch ${Math.round(w.dev)}°; kẹp ±${rig.TURN_MAX}, ${rig.AIM_BEND.join("..")}, ${rig.AIM_DEV.join("..")})`
      : "không đo được cổ tay",
  });
  const reachLimit = rig.AIM_GAP * reach.s;
  rows.push({
    rule: "reach",
    level: reach.gap > reachLimit ? "lỗi" : "ok",
    worst: r1(reach.gap),
    t: reach.t,
    limit: `khe ≤ ${r1(reachLimit)}`,
    msg:
      reach.gap > reachLimit
        ? `ngoài tầm: bàn tay còn cách đích ${r1(reach.gap)} ở giây ${sec(reach.t)}`
        : `bàn tay tới đích (khe lớn nhất ${r1(reach.gap)})`,
  });

  // khuỷu đi một chiều trong từng quãng khai
  for (const m of spec.monotone ?? []) {
    const ts = sampleTimes(m.from, Math.min(m.to, rt.duration), step);
    const phis = ts.map((t) => rig.handReport(rt, id, side, t, { char: c })?.phi ?? NaN);
    const ok = phis.every(Number.isFinite);
    const back = ok ? backtrack(phis) : Infinity;
    rows.push({
      rule: "elbow",
      level: back > ELBOW_BACK ? "lỗi" : "ok",
      worst: r1(back),
      t: m.from,
      limit: `lùi ≤ ${ELBOW_BACK}°`,
      msg: ok
        ? `${m.label}: khuỷu φ ${r1(phis[0])}° → ${r1(phis.at(-1))}°, lùi nhiều nhất ${r1(back)}°`
        : `${m.label}: không đo được khuỷu`,
    });
  }

  // điểm tiếp xúc
  const ct = spec.contact;
  if (ct) {
    const tol = ct.tol ?? rig.HELD_TOUCH;
    let worst = { d: -1, t: ct.from };
    let missing;
    for (const t of sampleTimes(ct.from, Math.min(ct.to, rt.duration), step)) {
      const a = ct.target(t);
      const b = ct.probe(t);
      if (!a || !b) {
        missing ??= t;
        continue;
      }
      const d = len(sub(a, b));
      if (d > worst.d) worst = { d, t };
    }
    rows.push({
      rule: "contact",
      level: missing !== undefined || worst.d > tol ? "lỗi" : "ok",
      worst: r2(Math.max(0, worst.d)),
      t: worst.t,
      limit: `≤ ${tol}`,
      msg:
        missing !== undefined
          ? `${ct.label}: không đo được ở giây ${sec(missing)}`
          : `${ct.label}: lệch nhiều nhất ${r2(worst.d)} ở giây ${sec(worst.t)}`,
    });
  }
  return rows;
}

/**
 * Luật đặt lên mặt và không lấn, mỗi khung `step` trong `window`. `rest`: `{ label, gap(t), range, inside?(t), drift?(t) }` —
 * khe từ chỗ chạm tới mặt (dương là hở, âm là lún) phải trong `range`, `inside` sai là ra ngoài mặt, điểm `drift(t)` dời quá
 * `HELD_TOUCH` so với đầu quãng là trôi; dòng `rest` kèm `issues` — `missing` | `outside` | `sink` | `gap` | `drift`.
 * `clear`: `{ label, gap(t), min, soft? }` — khe dưới `min` là lấn (`soft`: vật chỉ tự tìm để kiểm, lấn là cảnh báo). `gap`
 * trả `undefined` là không đo được. Dòng như `coreChecks`
 */
export function restChecks({ window, step = GEN_STEP, rest = [], clear = [] }) {
  const times = sampleTimes(window[0], window[1], step);
  const rows = [];
  for (const r of rest) {
    let lo = { g: Infinity, t: window[0] };
    let hi = { g: -Infinity, t: window[0] };
    let missing;
    let outside;
    let drift = { d: 0, t: window[0] };
    const p0 = r.drift?.(window[0]);
    for (const t of times) {
      const g = r.gap(t);
      if (!Number.isFinite(g)) {
        missing ??= t;
        continue;
      }
      if (g < lo.g) lo = { g, t };
      if (g > hi.g) hi = { g, t };
      if (r.inside && outside === undefined && !r.inside(t)) outside = t;
      const p = p0 && r.drift(t);
      if (p && len(sub(p, p0)) > drift.d) drift = { d: len(sub(p, p0)), t };
    }
    const [min, max] = r.range;
    const tol = rig.HELD_TOUCH;
    const found = [
      ["missing", missing !== undefined && `không đo được ở giây ${sec(missing)}`],
      ["outside", outside !== undefined && `ra ngoài mặt ở giây ${sec(outside)}`],
      ["sink", lo.g < min && `lún ${r2(-lo.g)} ở giây ${sec(lo.t)}`],
      ["gap", hi.g > max && `hở ${r2(hi.g)} ở giây ${sec(hi.t)}`],
      ["drift", drift.d > tol && `trôi ${r2(drift.d)} tới giây ${sec(drift.t)}`],
    ].filter(([, m]) => m);
    const bad = found.map(([, m]) => m);
    rows.push({
      rule: "rest",
      level: bad.length ? "lỗi" : "ok",
      worst: r2(Math.max(min - lo.g, hi.g - max, drift.d - tol, 0)),
      t: lo.g < min ? lo.t : hi.t,
      limit: `khe ${r2(min)}…${r2(max)}, trôi ≤ ${tol}`,
      issues: found.map(([k]) => k),
      msg: bad.length
        ? `${r.label}: ${bad.join(", ")}`
        : `${r.label}: khe ${r2(lo.g)}…${r2(hi.g)}${r.drift ? `, trôi ${r2(drift.d)}` : ""}`,
    });
  }
  for (const r of clear) {
    let worst = { g: Infinity, t: window[0] };
    let missing;
    for (const t of times) {
      const g = r.gap(t);
      if (g === undefined || Number.isNaN(g)) missing ??= t;
      else if (g < worst.g) worst = { g, t };
    }
    const bad = missing !== undefined || worst.g < r.min;
    rows.push({
      rule: "clear",
      level: bad ? (r.soft ? "cảnh báo" : "lỗi") : "ok",
      worst: r2(Number.isFinite(worst.g) ? worst.g : 0),
      t: worst.t,
      limit: `khe ≥ ${r.min}`,
      msg:
        missing !== undefined
          ? `${r.label}: không đo được ở giây ${sec(missing)}`
          : !Number.isFinite(worst.g)
            ? `${r.label}: không chạm vùng ấy`
            : `${r.label}: ${worst.g < r.min ? "lấn" : "khe nhỏ nhất"} ${r2(Math.abs(worst.g))} ở giây ${sec(worst.t)}`,
    });
  }
  return rows;
}

/**
 * Nhóm `move`, `clash`, `held`, `roles` của `check` trên cảnh three của repo (`stickman.world`): chạy trên cảnh `after` (có
 * hành động, hành động chưa ghi đĩa đưa ở `actions`) và cảnh `before` (chưa có), chỉ giữ dòng mới hay nặng hơn
 * (`compareBaseline`), dòng mang `t` (giây đầu quãng) khi đo được. Không có `stickman.world` thì chỉ còn nhóm `move`. Sân
 * khấu thử (`o.stage` của bộ sinh): `spec` dựng cảnh three thay `worldOf` của repo, `held` đè món của `held/` — như
 * `checkScenes`. Trả `{ rows, total }`
 */
export async function worldChecks({
  dir,
  before,
  after,
  actions,
  groups = ["move", "clash", "held", "roles"],
  spec,
  held,
}) {
  const res = await checkScenes({
    dir,
    scenes: { "gen-truoc": before, "gen-sau": after },
    groups,
    actions,
    ...(spec && { spec }),
    ...(held && { held }),
  });
  const norm = (list) =>
    (list ?? []).map((r) => ({
      group: r.group,
      key: r.key ?? lineKey(r.msg),
      measure: r.measure,
      msg: r.msg,
      ...(r.t !== undefined && { t: r.t }),
      ...(r.error && { error: true }),
      ...(r.floor && { floor: true }),
    }));
  const was = norm(res.get("gen-truoc"));
  const now = norm(res.get("gen-sau"));
  const cmp = compareBaseline(now, baselineEntries(was), () => true);
  const rows = [];
  for (const r of now) {
    const delta = cmp.fresh.has(r.key) ? "mới" : cmp.worse.has(r.key) ? "nặng hơn" : null;
    if (delta && !rows.some((x) => x.key === r.key)) rows.push({ ...r, delta });
  }
  return { rows, total: now.length };
}

/** Có dòng lỗi không: phần lõi `lỗi`, hay dòng `check` mới / nặng hơn (trừ khoá bị `ignore`) */
export function checkFailed(core, world, ignore = () => false) {
  return core.some((r) => r.level === "lỗi") || (world?.rows ?? []).some((r) => !ignore(r));
}

/** Tên luật của bảng tự kiểm */
const RULE_LABEL = {
  wrist: "cổ tay",
  reach: "tầm với",
  bend: "khuỷu gập",
  elbow: "khuỷu một chiều",
  contact: "điểm tiếp xúc",
  mouth: "điểm rót trong miệng",
  rest: "đặt trên mặt",
  clear: "không lấn",
  seat: "mặt ngồi",
  dip: "hông tụt",
  surge: "hông vọt",
  accel: "tốc hông đổi",
  lag: "hông trễ",
  omega: "thân quay khi đi",
  omegaTurn: "thân quay tại chỗ",
  alpha: "thân quay tăng tốc",
  slip: "chân trụ trượt",
  slipJoin: "chân trụ ở chỗ nối",
  slipFrame: "chân trụ mỗi khung",
  rateJump: "nhịp chân nhảy",
  ratePeak: "nhịp chân đỉnh",
  devStraight: "lệch đường thẳng",
  devCorner: "cắt góc",
  devArc: "lệch cung",
  facing: "hướng thân",
  feetCross: "hai chân bắt chéo",
  feetGap: "hai cẳng chân",
  stopSpeed: "bước dừng: tốc",
  stopLift: "bước dừng: nhấc",
};

/**
 * Dòng tự kiểm có cấu trúc (bảng của `checkTable`, bảng tự kiểm của trang soi): `{ rule, label, level, msg, limit?, t? }`;
 * dòng `check` mới hay nặng hơn mang `group`, `delta`, `ignored` và `sub: true` (nằm dưới dòng tổng `check`)
 */
export function checkRows(core, world, ignore = () => false) {
  const rows = core.map((r) => ({
    rule: r.rule,
    label: RULE_LABEL[r.rule] ?? r.rule,
    level: r.level,
    msg: r.msg,
    ...(r.limit !== undefined && { limit: r.limit }),
    ...(r.t !== undefined && { t: r.t }),
  }));
  if (world) {
    const bad = world.rows.filter((r) => !ignore(r));
    const soft = world.rows.filter((r) => ignore(r));
    rows.push({
      rule: "check",
      label: "check move/clash/held/roles",
      level: bad.length ? "lỗi" : "ok",
      msg: bad.length
        ? `${bad.length} dòng mới hay nặng hơn`
        : `không dòng nào mới (${world.total} dòng như trước)`,
      limit: "không dòng mới",
    });
    for (const r of [...bad, ...soft]) {
      const ignored = ignore(r);
      rows.push({
        rule: "check",
        label: "",
        level: ignored ? "bỏ qua" : "lỗi",
        msg: `${r.delta}${ignored ? " (bỏ qua)" : ""}: ${r.group}: ${r.msg}`,
        group: r.group,
        delta: r.delta,
        ignored,
        sub: true,
        ...(r.t !== undefined && { t: r.t }),
      });
    }
  }
  return rows;
}

/** Bảng ngắn: luật, kết quả, ngưỡng */
export function checkTable(core, world, ignore = () => false) {
  const lines = checkRows(core, world, ignore).map((r) => [
    r.label,
    r.sub ? r.msg : `${r.level === "ok" ? "đạt" : r.level}: ${r.msg}`,
    r.limit ?? "",
  ]);
  const w0 = Math.max(...lines.map((l) => l[0].length));
  return lines.map(([a, b, c]) => `  ${a.padEnd(w0)}  ${b}${c ? `  [${c}]` : ""}`).join("\n");
}
