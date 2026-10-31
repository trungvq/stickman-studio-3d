// Đo khuỷu và cổ tay người 3D theo khung trên cảnh của một repo video: luật khuỷu của `check` (`elbowTrack`) trên cả cảnh,
// kèm đường giải của tay mỗi khung, lấn thân, vòng `AIM_ITER` không hội tụ; có / không `elbowLock`, so số vòng.
// node tools/elbows.mjs <repo video> [--scene <regex>] [--fps 60] [--lock on|off|both] [--iter 8[,9,…]] [--jobs n]
//   [--json <file>] [--dump <thư mục>]
import { mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";

const ROOT = resolve(import.meta.dirname, "..");
const CORE = join(ROOT, "packages/rig/dist/core/index.js");
const lib = await import(join(ROOT, "packages/cli/lib.mjs"));
const rig = await import(CORE);

/** Lấn thân quá ngần này lần bán kính tay là một khung lấn (chỉ công cụ này đếm, `check` chỉ đo khi tay co sát) */
const BODY = 0.5;
/** Hai số vòng `AIM_ITER` lệch khuỷu hay cổ tay quá ngần này (đơn vị rig) là khác nhau */
const ITER_TOL = 0.5;
/** Vòng lặp không hội tụ mà bước cuối còn dời quá ngần này (đơn vị rig) là thấy được */
const NC_BIG = 1;

const HANDS = [
  ["right", -1, "R"],
  ["left", 1, "L"],
];

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

/** Mốc `world.hands` của mọi người, bỏ `elbowLock`; trả số khoá đã bỏ */
function unlock(raw) {
  let n = 0;
  for (const m of raw.cast ?? [])
    for (const k of m.world?.hands ?? [])
      for (const hand of ["right", "left"])
        if (k[hand] && typeof k[hand] === "object" && k[hand].elbowLock) {
          delete k[hand].elbowLock;
          n++;
        }
  return n;
}

/** Đường giải đang lái tay ở một khung: món đặt trước, tay cầm món, khuỷu khoá, ý định lòng tay, đích, hay góc hành động */
function pathOf(sample, trace, reach) {
  if (trace?.placed) return "placed";
  if (sample.hold) return "hold";
  if (sample.lock > 0) return "lock";
  if (trace?.aim) return "aim";
  if (reach?.w > 0) return "world";
  if (sample.ik > 0) return "body";
  return "fk";
}

/** Đo một cảnh với `elbowLock` (`locked`) hay không, `iter` vòng: sự kiện theo luật, không hội tụ, chuỗi khớp để so */
function measure(ctx, name, { locked, iter, fps, keep, dump }) {
  rig.setAimIter(iter);
  const raw = JSON.parse(readFileSync(join(ctx.root, "scenes", `${name}.json`), "utf8"));
  const locks = locked ? 0 : unlock(raw);
  const parsed = rig.parseScene(raw);
  if (!parsed.success) return { name, error: `parse: ${parsed.error.message.slice(0, 200)}` };
  let rt;
  try {
    rt = lib.castRuntime(
      parsed.data,
      ctx.actionsByName,
      ctx.charactersByName,
      ctx.heldByName,
      ctx.handsByName,
    );
  } catch (e) {
    return { name, error: `runtime: ${String(e.message).slice(0, 200)}` };
  }
  if (!rt.lens) return { name, duration: rt.duration, locks, tracks: [] };
  const n = Math.floor(rt.duration * fps + 1e-6);
  const cams = Array.from({ length: n + 1 }, (_, i) => rig.cameraAt(rt, i / fps));
  const cuts = rt.camera.filter((k, j) => j > 0 && k.move === "cut").map((k) => k.t);
  const tracks = [];
  for (const m of rt.cast) {
    if (!m.world) continue;
    const base = m.character ? ctx.charactersByName[m.character] : rig.defaultCharacter();
    if (!base) continue;
    const c = base;
    const b = rig.body3(c);
    const windows = rig.snapWindows(m);
    const rows = [];
    for (let i = 0; i <= n; i++) {
      const t = i / fps;
      const sp = rig.sceneAt(rt, m.id, t, c.rig.height, b);
      const st = rig.stageJoints(c, sp);
      const arms = st && rig.elbowSamples(c, sp);
      const el = arms && rig.actElbows(c, sp);
      if (!st?.front || !arms || !el) {
        rows.push(undefined);
        continue;
      }
      const v = cams[i].view;
      const mx = v.w * 0.05;
      const inView = ([x, y]) =>
        x >= v.x - mx && x <= v.x + v.w + mx && y >= v.y - mx && y <= v.y + v.h + mx;
      const visible = st.front && sp.opacity > 0.5;
      rows.push(
        HANDS.map(([hand, , tag], k) => {
          const a = arms[k];
          const e = el[tag];
          const reach = tag === "R" ? sp.world.hands?.right : sp.world.hands?.left;
          const target = a.ik >= 0.5;
          return {
            ...a,
            body: target ? e.body() : a.body,
            path: pathOf(a, e.trace, reach),
            loop: e.trace?.loop,
            visible,
            elbowIn: visible && inView(st.pts[`elbow${tag}`]),
            handIn: visible && inView(st.pts[`hand${tag}`]),
            hand,
          };
        }),
      );
    }
    for (const [hand] of HANDS) {
      const k = hand === "right" ? 0 : 1;
      const frames = rows.map((r, i) => {
        const a = r?.[k];
        if (!a) return undefined;
        const p = rows[i - 1]?.[k];
        const t0 = (i - 1) / fps;
        const t1 = i / fps;
        const pair =
          i > 0 &&
          !!p &&
          !cuts.some((x) => x > t0 + 1e-6 && x <= t1 + 1e-6) &&
          !windows.some((w) => t1 >= w.from && t0 <= w.to && w.classes.has("arm"));
        return {
          ...a,
          pair,
          onElbow: !!(a.elbowIn && p?.visible),
          onHand: !!(a.handIn && p?.visible),
        };
      });
      const valid = frames.filter(Boolean);
      if (!valid.length) continue;
      // đường giải nhiều khung nhất trong quãng
      const pathIn = (from, to) => {
        const tally = {};
        for (let i = Math.round(from * fps); i <= Math.round(to * fps); i++)
          if (frames[i]) tally[frames[i].path] = (tally[frames[i].path] ?? 0) + 1;
        return Object.entries(tally).sort((x, y) => y[1] - x[1])[0]?.[0] ?? "fk";
      };
      const events = rig.elbowTrack(m.id, hand, frames, fps).map((e) => ({
        ...e,
        path: pathIn(e.from, e.to),
      }));
      // lấn thân của tay theo đích, mọi tầm với
      let body;
      frames.forEach((f, i) => {
        if (!f || !(f.ik >= 0.5) || !f.onElbow || !(f.body > BODY)) return;
        if (body && i - Math.round(body.to * fps) <= 3) {
          body.to = i / fps;
          body.worst = Math.max(body.worst, f.body);
        } else {
          body = { id: m.id, hand, rule: "body", from: i / fps, to: i / fps, worst: f.body };
          events.push(body);
        }
      });
      for (const e of events) if (e.rule === "body") e.path = pathIn(e.from, e.to);
      // vòng `AIM_ITER` chạy hết mà cổ tay còn dời
      const nc = { frames: 0, big: 0, worst: 0, at: 0, spans: [] };
      frames.forEach((f, i) => {
        const l = f?.loop;
        if (!l || l.done || l.steps < iter) return;
        nc.frames++;
        if (l.moved > nc.worst) [nc.worst, nc.at] = [l.moved, i / fps];
        if (!(l.moved > NC_BIG)) return;
        nc.big++;
        const s = nc.spans[nc.spans.length - 1];
        if (s && i / fps - s[1] <= 3 / fps + 1e-6) s[1] = i / fps;
        else nc.spans.push([i / fps, i / fps]);
      });
      tracks.push({
        id: m.id,
        hand,
        frames: valid.length,
        target: valid.filter((f) => f.ik >= 0.5).length,
        lockFrames: valid.filter((f) => f.lock > 0).length,
        events,
        nc,
        ...(keep && { joints: frames.map((f) => f && [...f.E, ...f.W]) }),
      });
      if (dump)
        writeFileSync(
          join(dump, `${name}-${m.id}-${hand}${locked ? "" : "-unlock"}-it${iter}.tsv`),
          "t\tturn\tbend\tdev\tinward\tstraight\tbody\tik\tlock\tpath\tpair\tonElbow\tsteps\tmoved\n" +
            frames
              .map((f, i) =>
                f
                  ? [
                      (i / fps).toFixed(4),
                      ...f.wrist.map((x) => x.toFixed(2)),
                      f.inward.toFixed(3),
                      f.straight.toFixed(3),
                      f.body.toFixed(2),
                      f.ik.toFixed(2),
                      f.lock.toFixed(2),
                      f.path,
                      +f.pair,
                      +f.onElbow,
                      f.loop?.steps ?? "",
                      f.loop ? f.loop.moved.toFixed(3) : "",
                    ].join("\t")
                  : `${(i / fps).toFixed(4)}`,
              )
              .join("\n"),
        );
    }
  }
  return { name, duration: rt.duration, locks, tracks };
}

/** Khuỷu, cổ tay lệch nhau giữa hai lượt cùng cảnh (khác số vòng): lệch lớn nhất, số khung quá `ITER_TOL` */
function compare(a, b) {
  const out = [];
  for (const ta of a.tracks ?? []) {
    const tb = b.tracks?.find((x) => x.id === ta.id && x.hand === ta.hand);
    if (!tb) continue;
    let [worst, at, over] = [0, 0, 0];
    ta.joints.forEach((p, i) => {
      const q = tb.joints[i];
      if (!p || !q) return;
      const d = Math.max(len(sub(p.slice(0, 3), q.slice(0, 3))), len(sub(p.slice(3), q.slice(3))));
      if (d > ITER_TOL) over++;
      if (d > worst) [worst, at] = [d, i];
    });
    if (over) out.push({ id: ta.id, hand: ta.hand, worst, at, over });
  }
  return out;
}

async function context(root) {
  const ctx = await lib.deepContext({ dir: root, names: [], groups: [] });
  return { ...ctx, root };
}

/** Mọi lượt của một cảnh: mỗi chế độ khoá × mỗi số vòng; so số vòng thì giữ chuỗi khớp */
function runScene(ctx, name, o) {
  const runs = [];
  for (const locked of o.locks) {
    const byIter = o.iters.map((iter) =>
      measure(ctx, name, { locked, iter, fps: o.fps, keep: o.iters.length > 1, dump: o.dump }),
    );
    const diff = byIter.slice(1).map((r, j) => ({
      iter: [o.iters[0], o.iters[j + 1]],
      tracks: byIter[0].error || r.error ? [] : compare(byIter[0], r),
    }));
    for (const r of byIter) for (const t of r.tracks ?? []) delete t.joints;
    runs.push({ locked, byIter, diff });
  }
  return runs;
}

if (!isMainThread) {
  const ctx = await context(workerData.root);
  for (const name of workerData.names)
    parentPort.postMessage({ name, runs: runScene(ctx, name, workerData.o) });
  parentPort.postMessage({ done: true });
} else {
  const { values: args, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      scene: { type: "string", default: "." },
      fps: { type: "string", default: "60" },
      lock: { type: "string", default: "on" },
      iter: { type: "string" },
      jobs: { type: "string" },
      json: { type: "string" },
      dump: { type: "string" },
    },
  });
  if (!positionals[0]) {
    console.error(
      readFileSync(fileURLToPath(import.meta.url), "utf8")
        .split("\n")
        .slice(0, 4)
        .join("\n"),
    );
    process.exit(1);
  }
  const root = resolve(positionals[0]);
  const re = new RegExp(args.scene);
  const names = readdirSync(join(root, "scenes"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -5))
    .filter((n) => re.test(n))
    .sort();
  const o = {
    fps: +args.fps,
    locks: { on: [true], off: [false], both: [true, false] }[args.lock],
    iters: (args.iter ?? String(rig.AIM_ITER)).split(",").map(Number),
    dump: args.dump && resolve(args.dump),
  };
  if (!o.locks) throw new Error(`--lock on|off|both, không phải ${args.lock}`);
  if (o.dump) mkdirSync(o.dump, { recursive: true });
  const jobs = Math.max(1, Math.min(names.length, +(args.jobs ?? availableParallelism() >> 1)));
  console.log(`rig: ${realpathSync(join(ROOT, "packages/rig"))}`);
  console.log(
    `${names.length} cảnh, ${o.fps} fps, khoá ${args.lock}, vòng ${o.iters.join(",")}, ${jobs} luồng`,
  );
  const t0 = performance.now();
  const results = new Map();
  await Promise.all(
    Array.from({ length: jobs }, (_, j) => {
      const part = names.filter((_n, i) => i % jobs === j);
      return new Promise((done, fail) => {
        const w = new Worker(fileURLToPath(import.meta.url), {
          workerData: { root, names: part, o },
        });
        w.on("message", (msg) => {
          if (msg.done) return done();
          results.set(msg.name, msg.runs);
          process.stderr.write(`${results.size}/${names.length} ${msg.name}\n`);
        });
        w.on("error", fail);
      });
    }),
  );
  const scenes = names.map((name) => ({ name, runs: results.get(name) }));
  const fmt = (v) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2));
  for (const locked of o.locks)
    o.iters.forEach((iter, ii) => {
      const tally = {};
      const add = (k, v = 1) => (tally[k] = (tally[k] ?? 0) + v);
      const lines = [];
      for (const { name, runs } of scenes) {
        const r = runs.find((x) => x.locked === locked).byIter[ii];
        if (r.error) {
          lines.push(`lỗi\t${name}\t${r.error}`);
          continue;
        }
        if (!locked && r.locks) add("khoá đã bỏ", r.locks);
        for (const t of r.tracks) {
          add("khung-tay", t.frames);
          add("khung theo đích", t.target);
          for (const e of t.events) {
            add(e.rule);
            add(`${e.rule}:${e.path}`);
            lines.push(
              [
                e.rule,
                name,
                `${t.id} ${t.hand}`,
                `${e.from.toFixed(2)}–${e.to.toFixed(2)}`,
                fmt(e.worst),
                e.path,
                e.detail ? e.detail.map(fmt).join(" ") : "",
              ].join("\t"),
            );
          }
          if (t.nc.frames) {
            add("không hội tụ: người-tay", 1);
            add("không hội tụ: khung", t.nc.frames);
            add(`không hội tụ: khung dời > ${NC_BIG}`, t.nc.big);
            lines.push(
              [
                "nc",
                name,
                `${t.id} ${t.hand}`,
                t.nc.spans
                  .slice(0, 6)
                  .map(([a, b]) => `${a.toFixed(2)}–${b.toFixed(2)}`)
                  .join(" "),
                fmt(t.nc.worst),
                `${t.nc.frames} khung`,
                `nặng nhất giây ${t.nc.at.toFixed(2)}`,
              ].join("\t"),
            );
          }
        }
      }
      console.log(`\n== khoá ${locked ? "giữ" : "bỏ"}, ${iter} vòng ==`);
      for (const l of lines.sort()) console.log(l);
      console.log(tally);
    });
  if (o.iters.length > 1)
    for (const locked of o.locks) {
      console.log(`\n== khoá ${locked ? "giữ" : "bỏ"}: khuỷu / cổ tay lệch > ${ITER_TOL} rig ==`);
      for (const { name, runs } of scenes)
        for (const d of runs.find((x) => x.locked === locked).diff)
          for (const t of d.tracks)
            console.log(
              [
                `${d.iter[0]}↔${d.iter[1]}`,
                name,
                `${t.id} ${t.hand}`,
                `${t.over} khung`,
                `lệch nhất ${fmt(t.worst)} ở giây ${(t.at / o.fps).toFixed(2)}`,
              ].join("\t"),
            );
    }
  console.log(`\n${((performance.now() - t0) / 1000).toFixed(0)} s`);
  if (args.json) writeFileSync(args.json, JSON.stringify({ ...o, lock: args.lock, scenes }));
}
