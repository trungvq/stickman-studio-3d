// Đề xuất đổi `ease` của các hành động mẫu mà người 3D đọc sang `auto` và đo độ lệch so với bản cũ.
// node tools/ease-auto.mjs [--dir apps/studio/public/actions] [--write]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import * as prettier from "prettier";
import { createServer } from "vite";

const ROOT = resolve(import.meta.dirname, "..");
const { values: args } = parseArgs({
  options: {
    dir: { type: "string", default: "apps/studio/public/actions" },
    write: { type: "boolean", default: false },
  },
});

const EVENT_NEAR = 0.02;
/** Kênh người 3D đọc ở mọi hành động, không cần `authoredAt: "side"` */
const WORLD_FREE = new Set(["torso", "head", "hand", "face"]);
const SAMPLES = 400;
const FLAG_DEG = 15;
const STOP_DEG = 2;

const vite = await createServer({
  root: ROOT,
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  optimizeDeps: { noDiscovery: true, include: [] },
});
const rig = await vite.ssrLoadModule("/packages/rig/src/core/index.ts");
const { ACTION_VERSION, actionKind, actionPose, animalActionDelta, parseAction } = rig;

/** Người 3D đọc hành động này: soạn ở `side`, hay `mask` chỉ gồm kênh không phải tay chân */
const readBy3d = (a) =>
  actionKind(a) !== "animal" &&
  (a.authoredAt === "side" || (!!a.mask?.length && a.mask.every((c) => WORLD_FREE.has(c))));

/** Mọi số góc của tư thế tại pha `u`: tay chân, thân, đầu, bàn tay; đích cổ tay và `stretch` không phải góc */
function angles(a, u) {
  if (actionKind(a) === "animal") return flatten(animalActionDelta(a, u, undefined));
  const p = actionPose(a, u);
  for (const k of ["reach", "aim", "stretch", "lift"]) delete p[k];
  return flatten(p);
}

function flatten(o, pre = "", out = {}) {
  for (const [k, v] of Object.entries(o ?? {})) {
    const key = pre ? `${pre}.${k}` : k;
    if (typeof v === "number") {
      if (Number.isFinite(v)) out[key] = v;
    } else if (v && typeof v === "object") flatten(v, key, out);
  }
  return out;
}

/** Mốc nào giữ `ease` cũ và vì sao; còn lại `linear` / `smooth` → `auto` */
function propose(a) {
  const keys = a.keys;
  const events = a.events.map((e) => e.t);
  const n = keys.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const ease = keys[i].ease;
    if (ease !== "linear" && ease !== "smooth") {
      out.push({ ease, keep: true });
      continue;
    }
    const last = i === n - 1;
    if (last && a.end === "hold") {
      out.push({ ease, keep: true });
      continue;
    }
    const next = last ? keys[0].t + 1 : keys[i + 1].t;
    const hit = events.some((e) => [e, e + 1].some((x) => Math.abs(next - x) <= EVENT_NEAR));
    out.push(hit ? { ease, keep: true, event: true } : { ease: "auto", keep: false, from: ease });
  }
  return out;
}

/** Mốc giữa mà `smooth` đang tạo chỗ dừng: góc đi cùng chiều hai bên mốc, `auto` sẽ trôi qua */
function smoothStops(a, plan) {
  const keys = a.keys;
  const n = keys.length;
  const stops = [];
  for (let i = 0; i < n; i++) {
    const p = a.end === "wrap" ? (i - 1 + n) % n : i - 1;
    const q = a.end === "wrap" ? (i + 1) % n : i + 1;
    if (p < 0 || q >= n || p === i || q === i) continue;
    if (!(plan[p].ease === "auto" && plan[i].ease === "auto")) continue;
    if (keys[p].ease !== "smooth" && keys[i].ease !== "smooth") continue;
    const [x, y, z] = [p, i, q].map((k) => angles(a, keys[k].t));
    if (
      Object.keys(y).some((c) => {
        const d0 = y[c] - (x[c] ?? y[c]);
        const d1 = (z[c] ?? y[c]) - y[c];
        return d0 * d1 > 0 && Math.abs(d0) > STOP_DEG && Math.abs(d1) > STOP_DEG;
      })
    )
      stops.push(keys[i].t);
  }
  return stops;
}

function maxDiff(a, b) {
  let worst = 0;
  let where = "";
  for (let i = 0; i < SAMPLES; i++) {
    const u = a.end === "hold" ? i / (SAMPLES - 1) : i / SAMPLES;
    const x = angles(a, u);
    const y = angles(b, u);
    for (const c of Object.keys(x)) {
      const d = Math.abs(x[c] - (y[c] ?? x[c]));
      if (d > worst) [worst, where] = [d, `${c}@${u.toFixed(3)}`];
    }
  }
  return { worst, where };
}

const dir = resolve(ROOT, args.dir);
const rows = [];
let skipped = 0;
for (const f of readdirSync(dir).sort()) {
  if (!f.endsWith(".json") || f === "index.json") continue;
  const path = join(dir, f);
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!raw.keys) continue;
  const old = parseAction(raw);
  if (!old.success) {
    rows.push({ file: f, note: `lỗi schema: ${old.error.issues[0]?.message}` });
    continue;
  }
  const a = old.data;
  if (!readBy3d(a)) {
    skipped++;
    continue;
  }
  const row = {
    file: f,
    keys: a.keys.length,
    side: a.authoredAt === "side" ? "side" : `mask:${a.mask.join("+")}`,
    changed: 0,
    flags: [],
  };
  rows.push(row);
  if (a.snap) {
    row.note = "bỏ qua (snap)";
    continue;
  }
  const plan = propose(a);
  row.changed = plan.filter((p) => !p.keep).length;
  if (!row.changed) {
    row.note = "không đổi";
    continue;
  }
  const next = structuredClone(raw);
  next.schemaVersion = ACTION_VERSION;
  plan.forEach((p, i) => {
    if (!p.keep) next.keys[i].ease = "auto";
  });
  const neu = parseAction(next);
  if (!neu.success) {
    row.note = `bản đề xuất lỗi schema: ${neu.error.issues[0]?.message}`;
    continue;
  }
  const { worst, where } = maxDiff(a, neu.data);
  row.diff = worst;
  row.where = where;
  if (a.events.length) row.flags.push(`events(${plan.filter((p) => p.event).length} giữ)`);
  if (worst > FLAG_DEG) row.flags.push(`lệch>${FLAG_DEG}°`);
  const stops = smoothStops(a, plan);
  if (stops.length) row.flags.push(`smooth-dừng t=${stops.map((t) => +t.toFixed(3)).join(",")}`);
  if (a.keys.some((k) => k.reach)) row.flags.push("reach(smoothstep)");
  if (args.write) {
    const text = await prettier.format(JSON.stringify(next), {
      ...(await prettier.resolveConfig(path)),
      filepath: path,
    });
    writeFileSync(path, text);
    row.note = "đã ghi";
  }
}
await vite.close();

const pad = (s, w) => String(s).padEnd(w);
console.log(
  [
    pad("file", 26),
    pad("mốc", 4),
    pad("đọc", 22),
    pad("đổi", 4),
    pad("lệch°", 7),
    pad("ở", 18),
    "cờ / ghi chú",
  ].join(" "),
);
for (const r of rows)
  console.log(
    [
      pad(r.file, 26),
      pad(r.keys ?? "", 4),
      pad(r.side ?? "", 22),
      pad(r.changed ?? "", 4),
      pad(r.diff === undefined ? "" : r.diff.toFixed(1), 7),
      pad(r.where ?? "", 18),
      [...(r.flags ?? []), r.note ?? ""].filter(Boolean).join("; "),
    ].join(" "),
  );
const touched = rows.filter((r) => r.diff !== undefined);
const flagged = touched.filter((r) => r.flags.length);
console.log(
  `\n${rows.length} file người 3D đọc (bỏ ${skipped} file 2D), ${touched.length} file có mốc đổi sang auto, ${flagged.length} cần soi${args.write ? "" : " — chưa ghi gì, thêm --write để ghi"}`,
);
