// Đo khuỷu tay theo khung: node harness.mjs <repo> <regex cảnh> [--fps 60] [--unlock] [--dump id:side] [--out file.json]
// Mỗi khung, mỗi người 3D, mỗi tay: vai/khuỷu/cổ tay (actArm, đúng như vẽ), xoắn khuỷu có dấu quanh trục vai→cổ tay giữa hai
// khung (như `swivel` của snap.ts), góc cổ tay, inward (elbowInward), tỉ lệ tầm với, lấn thân (evalPhi ở φ đang vẽ), px video.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const flag = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  if (i < 0) return d;
  const v = argv[i + 1];
  argv.splice(i, 2);
  return v;
};
const bool = (k) => {
  const i = argv.indexOf(`--${k}`);
  if (i < 0) return false;
  argv.splice(i, 1);
  return true;
};
const FPS = +flag("fps", 60);
const UNLOCK = bool("unlock");
const DUMP = flag("dump");
const OUT = flag("out");
const SCENES = flag("scenes");
const [repo, re] = argv;
const root = resolve(repo);
const STUDIO = process.env.STICKMAN_STUDIO ?? new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const lib = await import(join(STUDIO, "packages/cli/lib.mjs"));
const rig = await import(join(STUDIO, "packages/sketch/dist/index.js"));

const names = readdirSync(SCENES ?? join(root, "scenes"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.slice(0, -5))
  .filter((n) => new RegExp(re).test(n));
const ctx = await lib.deepContext({ dir: root, names: [], groups: [] });
// held, hands không trả ra: nạp lại như deepContext
const COMMON = lib.COMMON ?? null;

const D = 180 / Math.PI;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const unit = (a) => mul(a, 1 / (len(a) || 1));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Xoắn khuỷu có dấu (độ) từ mẫu a sang b quanh trục vai→cổ tay của b, khung trôi theo trục (như snap.ts swivel) */
function swivelSigned(a, b) {
  const [n0, n1] = [unit(sub(a.W, a.S)), unit(sub(b.W, b.S))];
  const k = cross(n0, n1);
  const s = len(k);
  const c = dot(n0, n1);
  let e = sub(a.E, a.S);
  if (s > 1e-12) {
    const u = mul(k, 1 / s);
    const kx = cross(u, e);
    e = [0, 1, 2].map((i) => e[i] * c + kx[i] * s + u[i] * dot(u, e) * (1 - c));
  }
  const flat = (v) => sub(v, mul(n1, dot(v, n1)));
  const [p, q] = [flat(e), flat(sub(b.E, b.S))];
  const r = Math.min(len(p), len(q)) / (len(e) || 1);
  if (r < 0.1) return { deg: 0, straight: true };
  const cs = dot(p, q) / (len(p) * len(q) || 1);
  const sg = Math.sign(dot(cross(p, q), n1)) || 1;
  return { deg: sg * Math.acos(Math.max(-1, Math.min(1, cs))) * D, straight: false };
}

function loadScene(name) {
  const raw = JSON.parse(readFileSync(join(SCENES ?? join(root, "scenes"), `${name}.json`), "utf8"));
  let locks = 0;
  if (UNLOCK)
    for (const m of raw.cast ?? [])
      for (const k of m.world?.hands ?? [])
        for (const sd of ["right", "left"])
          if (k[sd] && typeof k[sd] === "object" && k[sd].elbowLock) {
            delete k[sd].elbowLock;
            locks++;
          }
  const r = rig.parseScene(raw);
  if (!r.success) throw new Error(`${name}: parse ${r.error?.message?.slice(0, 200)}`);
  return { scene: r.data, locks };
}

ctx.heldByName = lib.loadHeld([join(root, "held"), lib.COMMON.held]);
ctx.handsByName = lib.loadHands([join(root, "hands"), lib.COMMON.hands]);

const results = [];
for (const name of names) {
  const t0 = performance.now();
  let scene, locks;
  try {
    ({ scene, locks } = loadScene(name));
  } catch (e) {
    results.push({ name, error: String(e.message) });
    continue;
  }
  let rt;
  try {
    rt = lib.castRuntime(scene, ctx.actionsByName, ctx.animalsByName, ctx.props, ctx.charactersByName, ctx.heldByName, ctx.handsByName);
  } catch (e) {
    results.push({ name, error: "runtime " + String(e.message).slice(0, 200) });
    continue;
  }
  const n = Math.floor(rt.duration * FPS + 1e-6);
  const video = rt.frame.video.w;
  const tracks = [];
  for (const m of rt.cast) {
    if (!m.world) continue;
    const base = m.character ? ctx.charactersByName[m.character] : rig.defaultCharacter();
    if (!base) continue;
    const c = rig.castCharacter(m, base);
    const b = rig.body3(c);
    const H = c.rig.height;
    for (const [hand, side] of [["right", -1], ["left", 1]]) {
      const ser = [];
      for (let i = 0; i <= n; i++) {
        const t = i / FPS;
        let sp, A;
        try {
          sp = rig.sceneAt(rt, m.id, t, H, b);
          A = rig.actArm(c, sp, side);
        } catch (e) {
          ser.push(null);
          continue;
        }
        if (!A) {
          ser.push(null);
          continue;
        }
        const inp = A.inp;
        const W = A.W, E = A.E, S = A.S;
        const sc = inp.s; // three → rig: *100 / s ≈ đơn vị rig của người
        const ratio = len(sub(W, S)) / (inp.l1 + inp.l2);
        let inward = NaN, bodyRatio = NaN, bodyPart, phi = NaN;
        try {
          phi = rig.phiOf(inp, W, E);
          inward = rig.elbowInward(inp, W, E);
          const ev = rig.evalPhi(inp, W, A.Rw, phi, undefined, A.other);
          bodyRatio = ev.bodyRatio;
          bodyPart = ev.bodyPart;
        } catch {}
        // px video của khuỷu, cổ tay
        let pxE, pxW, onScreen = false;
        try {
          const st = rig.stageJoints(c, sp);
          const cam = rig.cameraAt(rt, t);
          const k = video / cam.view.w;
          const tag = side === -1 ? "R" : "L";
          if (st?.front) {
            pxE = [st.pts[`elbow${tag}`][0] * k, st.pts[`elbow${tag}`][1] * k];
            pxW = [st.pts[`wrist${tag}`][0] * k, st.pts[`wrist${tag}`][1] * k];
            const v = cam.view;
            const [x, y] = st.pts[`elbow${tag}`];
            onScreen = sp.opacity > 0.5 && x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h;
          }
        } catch {}
        const lock = rig.elbowLockAt(rt, m.id, hand, t);
        const hw = sp.world?.hands?.[side === (sp.world.flip ? 1 : -1) ? "near" : "far"];
        ser.push({
          t,
          S, E, W,
          sc,
          ratio,
          inward,
          bodyRatio,
          bodyPart,
          phi,
          wrist: A.wrist,
          lock,
          drive: hw && hw.w > 0 ? "world" : (A.trace?.elbow0 ? "body" : "fk"),
          hold: !!hw?.hold,
          placed: !!A.trace?.placed,
          aim: !!A.trace?.aim,
          pxE, pxW, onScreen,
        });
      }
      // phân tích
      const rows = [];
      for (let i = 0; i <= n; i++) {
        const a = ser[i - 1], q = ser[i];
        if (!q) { rows.push(null); continue; }
        const sw = a ? swivelSigned(a, q) : { deg: 0, straight: false };
        const toRig = 100 / q.sc;
        const dW = a ? len(sub(q.W, a.W)) * toRig : 0;
        const dE = a ? len(sub(q.E, a.E)) * toRig : 0;
        const relE = a ? len(sub(sub(q.E, q.S), sub(a.E, a.S))) * toRig : 0;
        const relW = a ? len(sub(sub(q.W, q.S), sub(a.W, a.S))) * toRig : 0;
        const pxE = a && a.pxE && q.pxE ? Math.hypot(q.pxE[0] - a.pxE[0], q.pxE[1] - a.pxE[1]) : NaN;
        const dTurn = a ? Math.abs(q.wrist[0] - a.wrist[0]) : 0;
        rows.push({ ...q, sw: sw.deg, straight: sw.straight, dW, dE, relE, relW, pxEd: pxE, dTurn });
      }
      // jitter: đổi dấu xoắn khuỷu liên tục trong cửa sổ 0,5 s khi cổ tay (so với vai) gần đứng
      const ev = { jitter: [], flip: [], inward: [], reach: [], body: [], turnJump: [] };
      const W = Math.round(FPS * 0.5);
      for (let i = 2; i <= n; i++) {
        const r = rows[i];
        if (!r) continue;
        // lật: tổng xoắn trong 6 khung (0,1 s) quá 60°
        let cum = 0;
        for (let j = Math.max(1, i - Math.round(FPS / 10) + 1); j <= i; j++) if (rows[j]) cum += rows[j].sw;
        if (Math.abs(cum) > 60) ev.flip.push({ t: r.t, cum, lock: r.lock, drive: r.drive, hold: r.hold, placed: r.placed });
        if (r.dTurn > 45) ev.turnJump.push({ t: r.t, dTurn: r.dTurn, turn: r.wrist[0] });
        if (r.inward > 0.05 && !r.straight) ev.inward.push({ t: r.t, inward: r.inward });
        if (r.drive !== "fk" && (r.ratio > 0.97 || r.ratio < 0.35)) ev.reach.push({ t: r.t, ratio: r.ratio });
        if (r.bodyRatio > 0.5) ev.body.push({ t: r.t, bodyRatio: r.bodyRatio, part: r.bodyPart });
      }
      for (let i = W; i <= n; i++) {
        const win = rows.slice(i - W + 1, i + 1);
        if (win.some((x) => !x)) continue;
        let rev = 0, absSw = 0, relW = 0, relE = 0, px = 0, pxn = 0, on = 0;
        for (let j = 1; j < win.length; j++) {
          const [p, q] = [win[j - 1], win[j]];
          if (Math.abs(p.sw) > 0.3 && Math.abs(q.sw) > 0.3 && Math.sign(p.sw) !== Math.sign(q.sw)) rev++;
          absSw += Math.abs(q.sw);
          relW += q.relW;
          relE += q.relE;
          if (Number.isFinite(q.pxEd)) { px += q.pxEd; pxn++; }
          if (q.onScreen) on++;
        }
        // net xoắn trong cửa sổ so với tổng |xoắn|: dao động thì net nhỏ
        const net = Math.abs(win.reduce((s, x) => s + x.sw, 0));
        win.netSw = net;
        const maxSw = Math.max(...win.map((x) => Math.abs(x.sw)));
        if (rev >= 3 && absSw > 4 && maxSw <= 25 && net < 0.5 * absSw)
          ev.jitter.push({ t: win[win.length - 1].t, rev, absSw, net, maxSw, relW, relE, px: pxn ? px / pxn : NaN, on: on / (W - 1), lock: win[W - 1].lock, drive: win[W - 1].drive, hold: win[W - 1].hold, placed: win[W - 1].placed, aim: win[W - 1].aim });
      }
      // gộp sự kiện liên tiếp thành quãng
      const spans = (xs, key) => {
        const out = [];
        for (const x of xs) {
          const l = out[out.length - 1];
          if (l && x.t - l.to <= 3 / FPS) {
            l.to = x.t;
            if (Math.abs(x[key]) > Math.abs(l.peak)) [l.peak, l.at] = [x[key], x];
          } else out.push({ from: x.t, to: x.t, peak: x[key], at: x });
        }
        return out;
      };
      const valid = rows.filter(Boolean);
      const anyTarget = valid.some((r) => r.drive !== "fk");
      tracks.push({
        id: m.id,
        hand,
        frames: valid.length,
        target: valid.filter((r) => r.drive !== "fk").length,
        onScreen: valid.filter((r) => r.onScreen).length,
        lockFrames: valid.filter((r) => r.lock > 0).length,
        maxInward: Math.max(...valid.filter((r) => !r.straight).map((r) => r.inward).filter(Number.isFinite), -9),
        jitter: spans(ev.jitter, "absSw"),
        flip: spans(ev.flip, "cum"),
        turnJump: spans(ev.turnJump, "dTurn"),
        inward: spans(ev.inward, "inward"),
        reach: spans(ev.reach, "ratio"),
        body: spans(ev.body, "bodyRatio"),
        anyTarget,
      });
      if (DUMP && (DUMP === `${m.id}:${hand}` || (DUMP === "all" && anyTarget))) {
        const f = `${STUDIO}/tmp/khuyu/d/dump-${name}-${m.id}-${hand}${UNLOCK ? "-unlock" : ""}.tsv`;
        writeFileSync(
          f,
          "t\tsw\tphi\tturn\tbend\tdev\tinward\tratio\tbody\trelW\trelE\tpxE\tlock\tdrive\thold\tplaced\taim\ton\n" +
            rows.filter(Boolean).map((r) => [r.t.toFixed(4), r.sw.toFixed(3), r.phi.toFixed(2), r.wrist.map((x) => x.toFixed(2)).join("\t"), r.inward.toFixed(3), r.ratio.toFixed(3), (r.bodyRatio ?? 0).toFixed(2), r.relW.toFixed(3), r.relE.toFixed(3), (r.pxEd ?? NaN).toFixed(2), r.lock.toFixed(2), r.drive, +r.hold, +r.placed, +r.aim, +r.onScreen].join("\t")).join("\n"),
        );
      }
    }
  }
  results.push({ name, locks, duration: rt.duration, ms: Math.round(performance.now() - t0), tracks });
  process.stderr.write(`${name} ${Math.round(performance.now() - t0)} ms\n`);
}
const s = JSON.stringify({ fps: FPS, unlock: UNLOCK, results }, (k, v) => (["S", "E", "W", "pxE", "pxW"].includes(k) ? undefined : typeof v === "number" ? +v.toFixed(4) : v));
if (OUT) writeFileSync(OUT, s);
else console.log(s);
