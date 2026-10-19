// Bảng ảnh bước 0 (do-b): vẽ các ô của cells.json (cands.mts) bằng đường của `tools/bang-cam.mjs` trong repo video.
// Chép file này vào <video>/tools/_b0-ve.mjs rồi chạy từ gốc repo video: node tools/_b0-ve.mjs <cells.json> <out dir>
// Tạm ghi kiểu cầm `_b0-*` vào held/bang-gia.json, held/chai-dia.json; luôn trả lại bản gốc khi thoát.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as rig from "@stickman3d/sketch";
import { deepContext, heldFrame, heldOptions, worldData, worldScene } from "@stickman3d/cli";
import { openSoi, renderSoi } from "./soi.mjs";

const [cellsPath, outArg] = process.argv.slice(2);
const OUT = resolve(outArg);
const root = resolve(".");
const C = JSON.parse(readFileSync(cellsPath, "utf8"));
mkdirSync(join(OUT, "o"), { recursive: true });

// ---- kiểu cầm tạm trong held/, trả lại khi thoát ----
const ORIG = {};
for (const item of Object.keys(C.grips)) {
  const p = join(root, "held", `${item}.json`);
  ORIG[p] = readFileSync(p);
  writeFileSync(join(OUT, `bak-${item}.json`), ORIG[p]);
}
const restore = () => {
  for (const [p, buf] of Object.entries(ORIG)) writeFileSync(p, buf);
};
process.once("exit", restore);
for (const sig of ["SIGINT", "SIGTERM"]) process.once(sig, () => { restore(); process.exit(130); });
for (const [item, grips] of Object.entries(C.grips)) {
  const p = join(root, "held", `${item}.json`);
  const j = JSON.parse(ORIG[p].toString("utf8"));
  j.grips = { ...j.grips, ...grips };
  writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
}

try {
  // ---- đo: cảnh three trong Node, luật `held` như `check` ----
  const data = worldData(root);
  for (const item of Object.keys(C.grips))
    for (const g of Object.keys(C.grips[item]))
      if (!data.held[item]?.grips[g]) throw new Error(`held/${item}.json không nạp được kiểu ${g}`);
  const held = heldOptions(root);
  const ctx = await deepContext({ dir: root, names: [], groups: ["held"], held });
  const T = 0;
  const r1 = (n) => Math.round(n * 10) / 10;
  for (const c of C.cells) {
    c.id = `bang-cam-b0-${c.key}`;
    // ý định không nhắm khách (ca A, D): bỏ khách khỏi cảnh vẽ cho ống kính trước không lọt vào người khách
    if (!c.key.startsWith("B-")) c.scene = { ...c.scene, cast: c.scene.cast.filter((p) => p.id !== "khach") };
    const parsed = rig.parseScene(c.scene);
    if (!parsed.success) throw new Error(`${c.key}: scene hỏng ${parsed.error.message}`);
    const sc = parsed.data;
    const chars = { yota: data.characters["yota.json"], khach: data.characters["takumi.json"] };
    const rt = rig.resolveScene(sc, data.actions, data.animals, data.props,
      { yota: chars.yota.rig.height, khach: chars.khach.rig.height },
      { yota: rig.body3(chars.yota), khach: rig.body3(chars.khach) }, data.held);
    const w = worldScene(ctx.world, { id: c.id, scene: sc, runtime: rt, characters: data.characters, actions: data.actions, animals: data.animals, props: data.props }, "b0");
    if (!w || w.error) throw new Error(`${c.key}: ${w?.error ?? "không có cảnh three bang-cam"}`);
    const frame = heldFrame(rt, w, (t, e) => { throw e; });
    const issues = rig.sceneHeld(rt, { ...held, frame });
    c.lines = issues.map((s) => rig.heldLine(s));
    const rows = (frame(T) ?? []).filter((s) => s.id === "yota" && s.hand === "R");
    const s = rows[0];
    if (!s) throw new Error(`${c.key}: không có tay phải cầm món ở giây ${T}`);
    c.three = {
      at: s.at,
      intent: s.intent && { rule: s.intent.rule, err: r1(s.intent.err), clamped: s.intent.clamped },
      pierce: r1(s.pierce?.depth ?? 0),
      grip: r1(s.grip ?? 0),
      reach: s.reach && r1(s.reach.gap),
    };
    console.log(c.key, JSON.stringify(c.three), c.lines.length ? `| check: ${c.lines.join(" / ")}` : "");
  }

  // ---- ống kính: cả thân trên và món ----
  const RAD = Math.PI / 180;
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const mul = (a, k) => a.map((v) => v * k);
  const norm = (a) => mul(a, 1 / Math.hypot(...a));
  const r2 = (n) => Math.round(n * 100) / 100;
  const YAW = 90;
  const F = [Math.cos(YAW * RAD), 0, -Math.sin(YAW * RAD)];
  const R = [-Math.sin(YAW * RAD), 0, -Math.cos(YAW * RAD)];
  const UP = [0, -1, 0];
  const XA = 270;
  const H = 430 * 1.05;
  const GOC = [["truoc", "trước", F], ["cheo", "chéo 3/4", norm(add(F, R))], ["ngang", "ngang", R]];
  const jobs = [];
  for (const c of C.cells) {
    const chest = [C.at[0], -0.86 * H, C.at[2]];
    const mid = add(mul(c.three.at, 0.5), mul(chest, 0.5));
    const khung = c.item === "chai-dia" ? 360 : 330;
    c.tiles = GOC.map(([g, vn, d]) => {
      const tilt = norm(add(d, mul(UP, 0.3)));
      const eye = add(mid, mul(tilt, XA));
      const [dx, dy, dz] = sub(mid, eye);
      const file = join(OUT, "o", `${c.key}-${g}.png`);
      jobs.push({ scene: c.id, t: T, lens: { eye: eye.map(r2), yaw: r2(Math.atan2(dx, dz) / RAD), pitch: r2(Math.atan2(dy, Math.hypot(dx, dz)) / RAD), f: r2((720 * XA) / khung), cx: 0, cy: 0 }, file });
      return { g, vn, file };
    });
  }
  // `scene.name` của cảnh dựng tạm phải là `bang-cam` (CANH_3D); id việc là id ô
  const soi = await openSoi([]);
  try {
    await renderSoi(soi, {
      jobs: jobs.map(({ scene, t, lens }) => ({ scene, t, lens })),
      scenes: Object.fromEntries(C.cells.map((c) => [c.id, c.scene])),
      w: 800,
      h: 800,
      tabs: 4,
      onJob: (_, png, i) => writeFileSync(jobs[i].file, png),
    });
  } finally {
    await soi.close();
  }
  writeFileSync(join(OUT, "do.json"), JSON.stringify(C.cells.map((c) => ({ ...c, scene: undefined })), null, 1));
  console.log(`${jobs.length} ảnh → ${OUT}/o`);
} finally {
  restore();
}
