// Lệnh (từ gốc worktree studio, một lệnh, cả đo, vẽ và ghép tờ):
//   node tmp/nhom-cam/b0/hinh/ve.mjs [ca.json] [thư mục ra]
//   mặc định ca.json = tmp/nhom-cam/b0/ca.json, thư mục ra = tmp/nhom-cam/b0/hinh/vong2; ra do.json, o/*.png, to-*.jpg
//   biến VIDEO đổi worktree video (mặc định ~/Work/Dev/youtube-video/jp-sukatto-nhom-cam); TABS số tab Chrome
//
// Tờ ảnh bước 0 (nhóm cầm) từ số đã giải trong ca.json, KHÔNG giải lại. Mỗi ca (ca 5: bốn mẫu t = 0; 0,2; 0,4; 0,6) là một
// cảnh dựng tạm từ t02-s023-bang-gia (chỉ takumi, tên `bang-cam` để cảnh three đăng ký món), chụp ở giây 1,0:
//   - mốc tay `world.hands`: `at` = wrist, `point: "wrist"`, `elbow` = véc tơ đã xuất, `hold` = `<món>#_b0-…`
//   - kiểu cầm `_b0-*` không khai `intent` → rig không dò lại khuỷu (holdSolve không có trục), bàn tay tay mang món lấy
//     từ hành động tạm `actions/_b0-<ô>.json` (`hand.turn/bend`, lệch ở kênh nâng `[0, 0, dev]`); tay phụ (tay trái
//     ca 3, 4, 5) rig đặt lên mốc của nó trên món và tự giải cổ tay (aimWrist, có kẹp) — số đo báo lệch nếu có
//   - món `_b0-can` không có lưới trong `src/objects/luoi-mon.ts`: trang Remotion đi entry tạm `tools/_b0-soi.tsx` (thêm
//     lưới trụ vào LUOI_MON rồi nạp `soi.tsx`), đo trong Node dựng `buildWorld` của rig với cùng lưới trụ
// File tạm trong repo video: tools/_b0-ve.mjs, tools/_b0-soi.tsx, actions/_b0-*.json, held/_b0-can.json, và các kiểu cầm
// `_b0-*` ghi tạm vào held/bang-gia.json. Luôn xoá / trả lại khi thoát.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIDEO = process.env.VIDEO ?? "/home/trungvq/Work/Dev/youtube-video/jp-sukatto-nhom-cam";

if (!process.env.B0_INNER) {
  // ---- vỏ: chép mình sang repo video, chạy ở đó, dọn, rồi ghép tờ ----
  const ca = resolve(process.argv[2] ?? join(HERE, "../ca.json"));
  const out = resolve(process.argv[3] ?? join(HERE, "vong2"));
  const tmpFiles = [join(VIDEO, "tools/_b0-ve.mjs"), join(VIDEO, "tools/_b0-soi.tsx")];
  const clean = () => tmpFiles.forEach((f) => rmSync(f, { force: true }));
  process.once("exit", clean);
  copyFileSync(fileURLToPath(import.meta.url), tmpFiles[0]);
  writeFileSync(tmpFiles[1], SOI_TSX());
  const r = spawnSync(process.execPath, ["tools/_b0-ve.mjs", ca, out], { cwd: VIDEO, stdio: "inherit", env: { ...process.env, B0_INNER: "1" } });
  clean();
  const st = execFileSync("git", ["status", "--short"], { cwd: VIDEO, encoding: "utf8" });
  const extra = st.split("\n").filter((l) => l && !/ (package\.json|pnpm-lock\.yaml|remotion\.config\.ts)$/.test(l));
  if (extra.length) console.error(`!! repo video còn thay đổi ngoài 3 file:\n${extra.join("\n")}`);
  if (r.status !== 0) process.exit(r.status ?? 1);
  execFileSync("python3", [join(HERE, "sheet.py"), out], { stdio: "inherit" });
  process.exit(0);
}

function SOI_TSX() {
  return `// Tạm (tmp/nhom-cam/b0/hinh/ve.mjs): lưới trụ cho món \`_b0-can\`, rồi đúng entry soi.tsx
import * as THREE from "three";
import { npr } from "@stickman3d/rig";
import { LUOI_MON } from "../src/objects/luoi-mon";
import "./soi"; // registerRoot ở soi.tsx (bundler chỉ dò chữ này trong entry)
(LUOI_MON as Record<string, () => THREE.Object3D>)["_b0-can"] = () => {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 20).translate(0, 0.6, 0), npr({ color: "#c98a3c", stipple: 0 }));
  m.name = "_b0-can";
  const dau = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 20).translate(0, 1.18, 0), npr({ color: "#3c6fc9", stipple: 0 }));
  g.add(m, dau);
  g.name = "_b0-can";
  return g;
};
`;
}

// ================= phần chạy trong repo video =================
const [caPath, OUT] = process.argv.slice(2);
const root = resolve(".");
const rig = await import("@stickman3d/sketch");
const RIG = await import("@stickman3d/rig");
const { deepContext, heldFrame, heldOptions, worldData, worldScene } = await import("@stickman3d/cli");
const { openBrowser } = await import("@remotion/renderer");
const { ownBundle } = await import(pathToFileURL(join(root, "tools/bundle.mjs")).href);
const { bundleScope } = await import(pathToFileURL(join(root, "tools/scope.mjs")).href);
const { chromiumOptions, envVariables, renderSoi, defaultTabs } = await import(pathToFileURL(join(root, "tools/soi.mjs")).href);
// cùng bản three với rig (instanceof, Matrix4 …): gói three nằm cạnh rig
const rigDir = dirname(dirname(realpathSync(fileURLToPath(import.meta.resolve("@stickman3d/rig")))));
const THREE = await import(pathToFileURL(join(realpathSync(join(rigDir, "node_modules/three")), "build/three.module.js")).href);

const CA = JSON.parse(readFileSync(caPath, "utf8"));
mkdirSync(join(OUT, "o"), { recursive: true });
const T = CA.holder.t;
const WHO = CA.holder.cast;
const base = JSON.parse(readFileSync(join(root, "scenes", `${CA.holder.scene}.json`), "utf8"));
const tk = base.cast.find((m) => m.id === WHO);

// ---- ô: ca 1–4 một ô; ca 5 bốn mẫu ----
const C5T = [0, 0.2, 0.4, 0.6];
const cells = [];
for (const c of CA.cases) {
  if (!c.samples) cells.push({ key: c.id, c, hands: c.hands, views: "full" });
  else
    for (const t of C5T) {
      const s = c.samples.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
      cells.push({ key: `${c.id}-t${String(t).replace(".", "")}`, c, s, sampleT: s.t, alongL: s.alongL, hands: s.hands, views: t === 0 ? "full" : "short" });
    }
}

// ---- file tạm trong repo video, trả lại khi thoát ----
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" });
if (git("status", "--short", "held", "actions").trim()) throw new Error(`held/ hay actions/ đang có thay đổi — không chạy:\n${git("status", "--short", "held", "actions")}`);
const ORIG = {};
const MADE = [];
const restore = () => {
  for (const [p, buf] of Object.entries(ORIG)) writeFileSync(p, buf);
  for (const p of MADE) rmSync(p, { force: true });
};
process.once("exit", restore);
for (const sig of ["SIGINT", "SIGTERM"]) process.once(sig, () => { restore(); process.exit(130); });
const put = (p, j) => {
  if (existsSync(p) && !ORIG[p] && !MADE.includes(p)) ORIG[p] = readFileSync(p);
  else if (!existsSync(p)) MADE.push(p);
  writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
};
const byItem = {};
for (const cell of cells)
  for (const h of cell.hands) (byItem[cell.c.item] ??= {})[h.gripSpec.name] = h.gripSpec.spec;
for (const [item, grips] of Object.entries(byItem)) {
  const p = join(root, "held", `${item}.json`);
  const j = CA.items[item] ? structuredClone(CA.items[item]) : JSON.parse(readFileSync(p, "utf8"));
  j.grips = { ...j.grips, ...grips };
  put(p, j);
}
const RCH = "armFar", LCH = "armNear"; // takumi lật (`world.flip`): tay phải là kênh xa
for (const cell of cells) {
  const pose = {}, hand = {};
  for (const h of cell.hands) {
    const ch = h.hand === "right" ? RCH : LCH;
    pose[ch] = [0, 0, h.wristAngles.dev];
    hand[ch] = { turn: Math.max(-90, Math.min(90, h.wristAngles.turn)), bend: h.wristAngles.bend };
  }
  cell.action = `_b0-${cell.key}`;
  put(join(root, "actions", `${cell.action}.json`), { schemaVersion: 18, name: cell.action, duration: 1, end: "hold", authoredAt: "side", note: "tạm, tmp/nhom-cam/b0/hinh/ve.mjs", mask: [...Object.keys(pose), "hand"], keys: [{ t: 0, pose, hand }] });
  const key = { t: 0 };
  for (const h of cell.hands) key[h.hand] = { at: h.wrist, point: "wrist", elbow: h.elbow, hold: `${cell.c.item}#${h.gripSpec.name}` };
  if (!key.left && tk.world.hands?.[0]?.left) key.left = tk.world.hands[0].left;
  // tay mang món đặt cổ tay bằng hành động (xoay kẹp ±90 ở schema): tay có xoay vượt 90 mà tay kia không thì cho tay kia
  // mang món — tay ấy khai `hold` trước (`since` nhỏ hơn), tay vượt cầm sau 0,1 s và làm tay phụ (rig tự giải cổ tay)
  const over = (h) => !!h && (h.turnOver90 || Math.abs(h.wristAngles.turn) > 90);
  const R0 = cell.hands.find((h) => h.hand === "right"), L0 = cell.hands.find((h) => h.hand === "left");
  cell.lead = L0 && over(R0) && !over(L0) ? "left" : R0 ? "right" : "left";
  const keys = [key];
  if (cell.lead === "left" && R0) {
    const { hold, ...free } = key.right;
    keys.push({ t: 0.1, right: key.right });
    key.right = free;
  }
  cell.id = `_b0-${cell.key}`;
  cell.scene = {
    ...base,
    name: "bang-cam",
    duration: 2,
    cast: [{ ...tk, world: { ...tk.world, hands: keys }, tracks: [...tk.tracks, { name: "_b0", clips: [{ start: 0, action: cell.action }] }] }],
  };
}

try {
  const data = worldData(root);
  for (const [item, grips] of Object.entries(byItem))
    for (const g of Object.keys(grips)) if (!data.held[item]?.grips[g]) throw new Error(`held/${item}.json không nạp được kiểu ${g}`);
  const held = heldOptions(root);
  const ctx = await deepContext({ dir: root, names: [], groups: ["held"], held });
  const CH = data.characters[tk.character];
  const heights = { [WHO]: CH.rig.height }, bodies = { [WHO]: rig.body3(CH) };
  // ---- món không có lưới trong repo: cảnh three dựng bằng rig, cùng lưới trụ như entry tạm ----
  const canMesh = () => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.2, 20).translate(0, 0.6, 0), RIG.npr({ color: "#c98a3c", stipple: 0 }));
    m.name = "_b0-can";
    g.add(m);
    g.name = "_b0-can";
    return g;
  };
  const ownWorld = (sc, rt) => {
    const spec = {
      set: () => RIG.plainRoom(),
      still: [],
      extra: (_m, cast) => {
        // như dangKyMon + thuTheoScene của repo video: món nằm ẩn trong chỗ chờ tới khi rig gắn vào tay
        const g = new THREE.Group();
        const cho = new THREE.Group();
        const o = canMesh();
        cho.add(o);
        cast.provide("_b0-can", o, WHO);
        cho.visible = false;
        g.add(cho);
        return { group: g };
      },
    };
    return { U: RIG.U, heldHands: RIG.heldHands, heldCarries: RIG.heldCarries, scene: RIG.buildWorld(sc, rt, spec, { characters: data.characters, heights, bodies }) };
  };

  let FIXTURE = null;
  /** Điểm gần nhất trên tam giác abc tới p (Ericson, Real-Time Collision Detection 5.1.5) */
  const closest = (p, a, b, c) => {
    const sb = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]], dt = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const ab = sb(b, a), ac = sb(c, a), ap = sb(p, a);
    const d1 = dt(ab, ap), d2 = dt(ac, ap);
    if (d1 <= 0 && d2 <= 0) return a;
    const bp = sb(p, b), d3_ = dt(ab, bp), d4 = dt(ac, bp);
    if (d3_ >= 0 && d4 <= d3_) return b;
    const vc = d1 * d4 - d3_ * d2;
    if (vc <= 0 && d1 >= 0 && d3_ <= 0) { const v = d1 / (d1 - d3_); return [a[0] + ab[0] * v, a[1] + ab[1] * v, a[2] + ab[2] * v]; }
    const cp = sb(p, c), d5 = dt(ab, cp), d6 = dt(ac, cp);
    if (d6 >= 0 && d5 <= d6) return c;
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) { const v = d2 / (d2 - d6); return [a[0] + ac[0] * v, a[1] + ac[1] * v, a[2] + ac[2] * v]; }
    const va = d3_ * d6 - d5 * d4;
    if (va <= 0 && d4 - d3_ >= 0 && d5 - d6 >= 0) { const v = (d4 - d3_) / (d4 - d3_ + (d5 - d6)); return [b[0] + (c[0] - b[0]) * v, b[1] + (c[1] - b[1]) * v, b[2] + (c[2] - b[2]) * v]; }
    const den = 1 / (va + vb + vc), v = vb * den, ww = vc * den;
    return [a[0] + ab[0] * v + ac[0] * ww, a[1] + ab[1] * v + ac[1] * ww, a[2] + ab[2] * v + ac[2] * ww];
  };
  const visMeshes = (o, keep) => {
    const out = [];
    o.traverseVisible((m) => {
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      if (mats.every((x) => x.side === THREE.BackSide)) return;
      if (keep(m)) out.push(m);
    });
    return out;
  };
  /** Khe (đơn vị rig, âm là đỉnh đầu nằm trong hộp lưới món) từ từng phần đầu tới lưới món `obj` */
  const headGap = (fig, obj, U) => {
    fig.root.updateWorldMatrix(true, true);
    obj.updateWorldMatrix(true, true);
    const tris = [];
    const inv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const m of visMeshes(obj, () => true)) {
      const g = m.geometry, P = g.attributes.position, idx = g.index;
      const v = (i) => { const x = new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); const l = x.clone().applyMatrix4(inv); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], l.getComponent(k)); hi[k] = Math.max(hi[k], l.getComponent(k)); } return [x.x, x.y, x.z]; };
      const n = idx ? idx.count : P.count;
      const W = Array.from({ length: P.count }, (_, i) => v(i));
      for (let i = 0; i < n; i += 3) tris.push([W[idx ? idx.getX(i) : i], W[idx ? idx.getX(i + 1) : i + 1], W[idx ? idx.getX(i + 2) : i + 2]]);
    }
    const part = (m) => (m.userData.hair ? "toc" : m.userData.inkGap ? "tai" : m.userData.noCollide ? "mat" : "so");
    const out = {};
    for (const m of visMeshes(fig.head, (x) => x.userData.body)) {
      const k = part(m), P = m.geometry.attributes.position;
      const o = (out[k] ??= { gap: Infinity, inside: 0, n: 0 });
      for (let i = 0; i < P.count; i++) {
        const x = new THREE.Vector3().fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld);
        const l = x.clone().applyMatrix4(inv);
        const p = [x.x, x.y, x.z];
        let best = Infinity;
        for (const [a, b, c] of tris) { const q = closest(p, a, b, c); best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); }
        const inBox = [0, 1, 2].every((k2) => l.getComponent(k2) >= lo[k2] && l.getComponent(k2) <= hi[k2]);
        o.n++;
        if (inBox) o.inside++;
        o.gap = Math.min(o.gap, (inBox ? -best : best) / U);
      }
    }
    for (const v of Object.values(out)) v.gap = r2(v.gap);
    return out;
  };
  const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const ang = (a, b) => {
    const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    return (Math.atan2(Math.hypot(...c), a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) * 180) / Math.PI;
  };
  const r2 = (n) => Math.round(n * 100) / 100;
  const r3 = (n) => Math.round(n * 1000) / 1000;

  for (const cell of cells) {
    const parsed = rig.parseScene(cell.scene);
    if (!parsed.success) throw new Error(`${cell.key}: scene hỏng ${parsed.error.message}`);
    const sc = parsed.data;
    const rt = rig.resolveScene(sc, data.actions, data.animals, data.props, heights, bodies, data.held);
    // khớp như act đặt: khuỷu, cổ tay, lòng tay, ngón so với ca.json
    const SP = rig.sceneAt(rt, WHO, T, CH.rig.height, rig.body3(CH));
    const J = rig.actJoints(CH, SP), P = rig.actPalms(CH, SP);
    const w = cell.c.item === "_b0-can" ? ownWorld(sc, rt) : worldScene(ctx.world, { id: cell.id, scene: sc, runtime: rt, characters: data.characters, actions: data.actions, animals: data.animals, props: data.props }, cell.id);
    if (!w || w.error) throw new Error(`${cell.key}: ${w?.error ?? "không có cảnh three"}`);
    const frame = heldFrame(rt, w, (t, e) => { throw e; });
    const rows = (frame(T) ?? []).filter((s) => s.id === WHO);
    const U = w.U;
    const toRig = (v) => [v.x / U, -v.y / U, -v.z / U];
    const dirRig = (v) => [v.x, -v.y, -v.z];
    cell.out = {};
    for (const h of cell.hands) {
      const tag = h.hand === "right" ? "R" : "L";
      const s = rows.find((x) => x.hand === tag);
      const o = { joints: { elbow: r3(d3(J[`elbow${tag}`], h.elbowAt)), wrist: r3(d3(J[`wrist${tag}`], h.wristReached)), palm: r2(ang(P[tag].palm, h.handAxes.palm)), fingers: r2(ang(P[tag].finger, h.handAxes.fingers)) }, elbowAt: J[`elbow${tag}`].map(r2), wristAt: J[`wrist${tag}`].map(r2) };
      if (s) {
        const obj = w.scene.root.getObjectById(s.obj);
        if (obj) {
          obj.updateWorldMatrix(true, false);
          const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc3 = new THREE.Vector3();
          obj.matrixWorld.decompose(p, q, sc3);
          const ax = (x, y, z) => dirRig(new THREE.Vector3(x, y, z).applyQuaternion(q));
          const it = h.item;
          o.item = { origin: r2(d3(toRig(p), it.origin)), x: r2(ang(ax(1, 0, 0), it.axes.x)), y: r2(ang(ax(0, 1, 0), it.axes.y)), z: r2(ang(ax(0, 0, 1), it.axes.z)) };
        }
        o.held = {
          hold: s.hold, pose: s.pose,
          pierce: { depth: r2(s.pierce.depth), core: r2(s.pierce.core), piece: s.pierce.piece },
          gaps: Object.fromEntries(Object.entries(s.gaps).map(([k, v]) => [k, r2(v)])),
          ...(s.fingers && { fingers: Object.fromEntries(Object.entries(s.fingers).map(([k, v]) => [k, r2(v)])) }),
          ...(s.wrap && { wrap: s.wrap }),
          grip: r2(s.grip),
          palm: { gap: r2(s.palm.gap), angle: r2(s.palm.angle) },
          at: s.at.map(r2),
          ...(s.intent && { intent: s.intent }),
          ...(s.reach && { reach: { kind: s.reach.kind, gap: r2(s.reach.gap) } }),
        };
      } else o.held = null;
      cell.out[h.hand] = o;
    }
    // khe thật món ↔ đầu: đỉnh lưới đầu (sọ, mặt, tai, tóc) tới tam giác lưới món, trên cảnh three đã đặt dáng ở giây T
    if (cell.c.item === "bang-gia") {
      const s0 = rows[0];
      const fig = w.scene.pose(T)?.[WHO];
      const obj = s0 && w.scene.root.getObjectById(s0.obj);
      if (fig && obj) cell.headGap = headGap(fig, obj, U);
    }
    const issues = rig.sceneHeld(rt, { ...held, frame });
    cell.lines = issues.map((x) => rig.heldLine(x));
    console.log(cell.key, JSON.stringify(Object.fromEntries(Object.entries(cell.out).map(([k, v]) => [k, { ...v.joints, item: v.item, pierce: v.held?.pierce?.depth, grip: v.held?.grip }]))), cell.lines.length ? `| check: ${cell.lines.join(" / ")}` : "");
  }

  // ---- fixture: chai-dia#co ở cổ tay phải ca 5 (cùng người, cùng cỡ tay), chỉ đo lún ----
  const c5 = cells.find((c) => c.c.item === "_b0-can");
  if (c5 && data.held["chai-dia"]?.grips.co) {
    try {
      const h = c5.hands.find((x) => x.hand === "right");
      const sc0 = { ...c5.scene, cast: [{ ...c5.scene.cast[0], world: { ...c5.scene.cast[0].world, hands: [{ t: 0, right: { at: h.wrist, point: "wrist", elbow: h.elbow, hold: "chai-dia#co" }, left: null }] } }] };
      const sc = rig.parseScene(sc0).data;
      const rt = rig.resolveScene(sc, data.actions, data.animals, data.props, heights, bodies, data.held);
      const w = worldScene(ctx.world, { id: "_b0-fx", scene: sc, runtime: rt, characters: data.characters, actions: data.actions, animals: data.animals, props: data.props }, "_b0-fx");
      const s = (heldFrame(rt, w, (t, e) => { throw e; })(T) ?? []).find((x) => x.id === WHO && x.hand === "R");
      if (s) FIXTURE = { hold: s.hold, pierce: { depth: r2(s.pierce.depth), core: r2(s.pierce.core), piece: s.pierce.piece }, fingers: s.fingers && Object.fromEntries(Object.entries(s.fingers).map(([k, v]) => [k, r2(v)])), grip: r2(s.grip) };
      console.log("fixture chai-dia#co", JSON.stringify(FIXTURE));
    } catch (e) {
      console.error("fixture chai-dia#co không đo được:", e.message);
    }
  }

  // ---- ống kính ----
  const RAD = Math.PI / 180;
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const mul = (a, k) => a.map((v) => v * k);
  const norm = (a) => mul(a, 1 / Math.hypot(...a));
  const UP = [0, -1, 0];
  const yawW = (tk.world.yaw ?? 0) * RAD;
  const F = [Math.cos(yawW), 0, -Math.sin(yawW)];
  const sh = CA.holder.shoulders;
  const RT = norm(sub(sh.right, sh.left)); // phía tay phải người cầm
  const mid = [(sh.right[0] + sh.left[0]) / 2, -320, (sh.right[2] + sh.left[2]) / 2 + 15];
  const hipY = CA.holder.stillness?.[0]?.hip?.[1] ?? -180;
  const lens = (eye, target, khung, dist) => {
    const [dx, dy, dz] = sub(target, eye);
    return { eye: eye.map(r2), yaw: r2(Math.atan2(dx, dz) / RAD), pitch: r2(Math.atan2(dy, Math.hypot(dx, dz)) / RAD), f: r2((720 * dist) / khung), cx: 0, cy: 0 };
  };
  // trước-chéo đặt gần: xa hơn ~450 là ra ngoài vỏ phòng `sanh` (ảnh trống)
  const XA = 700, XF = 360, KHUNG = 380, XC = 300, KC = 95;
  const VIEWS = {
    "truoc-cheo": { vn: "trước-chéo", lens: () => { const d = norm(add(add(F, mul(RT, 0.75)), mul(UP, 0.2))); return lens(add(mid, mul(d, XF)), mid, KHUNG, XF); } },
    "ngang-hong": { vn: "ngang, mắt ở hông", lens: () => { const e = [mid[0] + RT[0] * XA, hipY, mid[2] + RT[2] * XA + 40]; return lens(e, mid, KHUNG, d3(e, mid)); } },
    "tren-cheo": { vn: "trên-chéo", lens: () => { const d = norm(add(add(mul(F, 0.8), mul(RT, 0.45)), mul(UP, 1.1))); return lens(add(mid, mul(d, XA)), mid, KHUNG, XA); } },
  };
  const jobs = [];
  for (const cell of cells) {
    const names = cell.views === "full" ? Object.keys(VIEWS) : ["truoc-cheo", "tren-cheo"];
    cell.tiles = [];
    for (const g of names) {
      const file = join(OUT, "o", `${cell.key}-${g}.png`);
      jobs.push({ scene: cell.id, t: T, lens: VIEWS[g].lens(), file });
      cell.tiles.push({ g, vn: VIEWS[g].vn, file });
    }
    const closeHands = cell.views === "full" ? cell.hands : cell.hands.filter((h) => h.hand === "left");
    for (const h of closeHands) {
      const side = h.hand === "right" ? 1 : -1;
      const tgt = h.gripCenter;
      const d = norm(add(add(mul(F, 0.5), mul(RT, side)), mul(UP, 0.25)));
      const g = `can-${h.hand === "right" ? "P" : "T"}`;
      const file = join(OUT, "o", `${cell.key}-${g}.png`);
      jobs.push({ scene: cell.id, t: T, lens: lens(add(tgt, mul(d, XC)), tgt, KC, XC), file });
      cell.tiles.push({ g, vn: `cận tay ${h.hand === "right" ? "phải" : "trái"}`, file });
    }
  }

  // ---- vẽ: bundle entry tạm (lưới trụ) + soi.tsx ----
  const scope = bundleScope(root, [], { audio: "none" });
  const { serveUrl, drop } = await ownBundle(join(root, "tools/_b0-soi.tsx"), { scope });
  let browser;
  try {
    browser = await openBrowser("chrome", { chromiumOptions });
    const soi = { base: { serveUrl, chromiumOptions, envVariables, puppeteerInstance: browser } };
    await renderSoi(soi, {
      jobs: jobs.map(({ scene, t, lens }) => ({ scene, t, lens })),
      scenes: Object.fromEntries(cells.map((c) => [c.id, c.scene])),
      w: 800,
      h: 800,
      tabs: Number(process.env.TABS ?? defaultTabs()),
      onJob: (_, png, i) => writeFileSync(jobs[i].file, png),
    });
  } finally {
    await browser?.close({ silent: true }).catch(() => {});
    drop();
  }
  const miss = jobs.filter((j) => !existsSync(j.file));
  if (miss.length) throw new Error(`thiếu ảnh: ${miss.map((j) => j.file).join(", ")}`);
  writeFileSync(
    join(OUT, "do.json"),
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        ca: caPath,
        holder: { cast: WHO, scene: CA.holder.scene, t: T },
        fixture: FIXTURE && { "chai-dia#co": FIXTURE, note: "takumi, cổ tay phải ở chỗ tay phải ca 5 (t0), cùng người cùng cỡ tay; chỉ đo" },
        note: "joints: lệch khuỷu/cổ tay (đơn vị rig) và lòng tay/ngón (độ) của act so với ca.json; item: lệch gốc món (rig) và trục x/y/z (độ) trên cảnh three; held: số đo heldHands như `check`; lines: dòng `check` nhóm held",
        cells: cells.map((c) => ({
          key: c.key, ca: c.c.id, label: c.c.label, item: c.c.item, ...(c.sampleT !== undefined && { t: c.sampleT, alongL: c.alongL }),
          hands: c.hands.map((h) => ({ hand: h.hand, grip: h.gripSpec.name, turnOver90: !!h.turnOver90, gripSpec: h.gripSpec.spec, choice: h.choice, by: h.by, phi: h.phi, phi0: h.phi0, wristAngles: h.wristAngles, lan: h.body?.max, lanAt: h.body?.at, E: h.E, ...c.out[h.hand] })),
          lines: c.lines,
          lead: c.lead,
          ...(c.headGap && { headGap: c.headGap }),
          tiles: c.tiles.map((t) => ({ g: t.g, vn: t.vn, file: t.file })),
          scene: c.scene,
        })),
      },
      null,
      1,
    ),
  );
  console.log(`${jobs.length} ảnh → ${OUT}/o`);
} finally {
  restore();
}
