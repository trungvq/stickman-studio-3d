// `stickman migrate-held`: chuyển món bản 1 (`grips`) và `hold` `món#kiểu` của cảnh sang món v2 và chỗ cầm nhóm
// `{ item, group, … }`, đi đường tay dẫn. Rig chỉ nạp món v2: món bản 1 đọc bằng schema riêng ở đây. docs/11-nhom-cam.md mục 8
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import * as rig from "@stickman3d/rig/core";
import { COMMON } from "./lib.mjs";

/**
 * Bảng kiểu cũ → nhóm mặc định: `group`, phần và biến thể ép khi tìm chỗ cầm. `--map <file>` đè hay thêm dòng
 */
export const HOLD_MAP = {
  "dien-thoai#doc": { group: "palmBox" },
  "dien-thoai#khoe": { group: "palmBox" },
  "dien-thoai#bam": { group: "palmBox" },
  "dien-thoai#cam": { group: "palmBox" },
  "tui-hieu#khuyu": { group: "carry" },
  "tom-hum#nhac": { group: "sheet", variant: "rim" },
  "bo-da#bung": { group: "sheet", variant: "rim" },
  "bao#doc": { group: "sheet", variant: "rim" },
  "thuc-don#khoe": { group: "sheet", variant: "flat" },
  "phieu-lien#cam": { group: "sheet", variant: "flat" },
  "hoa-don#hai": { group: "sheet", variant: "flat" },
  "khay#bung": { group: "platform" },
  "khay-suat#bung": { group: "platform" },
  "phieu#do": { group: "platform" },
  "dua#cam": { group: "chopsticks" },
  "ong-nghe-ban#tai": { group: "cylinder", part: "tay" },
  "ong-nghe#tai": { group: "cylinder", part: "tay" },
  "chai-dia#xem": { group: "cylinder", part: "vai" },
  "chai-dac-tuyen#xem": { group: "cylinder", part: "vai" },
  "but#viet": { group: "pen" },
  "tui#xach": { group: "handle", variant: "hook" },
  "chen#kep": { group: "bowl", variant: "side" },
  "the-phong#kep": { group: "card" },
  "the-phong#cam": { group: "card" },
  "the-phong#dua": { group: "card" },
};

// ── Món bản 1 (`grips`) ─────────────────────────────────────────────────────────────────────────────────────────────

const CARRY_ON = ["elbow", "shoulder"];
const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const isV3 = (x) => Array.isArray(x) && x.length === 3 && x.every(isNum);
const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);

/** Lỗi cấu trúc của một món bản 1: mốc, kiểu cầm (bàn tay hay treo), tham chiếu mốc; rỗng là đọc được */
function v1Problems(o) {
  const out = [];
  const bad = (path, msg) => out.push(`${path}: ${msg}`);
  if (!isV3(o.size)) bad("size", "cần ba số");
  if (!isObj(o.anchors)) return [...out, "anchors: cần object mốc"];
  for (const [n, a] of Object.entries(o.anchors))
    if (!isObj(a) || !isV3(a.at) || (a.dir !== undefined && !isV3(a.dir)))
      bad(`anchors.${n}`, "cần `{ at, dir? }`");
  const has = (n) => typeof n === "string" && n in o.anchors;
  const ref = (r, path) => {
    const n = typeof r === "string" ? r : isObj(r) ? r.anchor : undefined;
    if (!has(n)) bad(path, `không có mốc \`${n}\``);
    else if (isObj(r) && r.offset !== undefined && !isV3(r.offset)) bad(path, "`offset` cần ba số");
  };
  const dir = (d, path) => {
    if (isV3(d)) return;
    const e = isObj(d) ? Object.entries(d) : [];
    if (e.length !== 1 || !["into", "along", "toward"].includes(e[0][0]) || !has(e[0][1]))
      bad(path, "cần vectơ hay `{ into | along | toward: mốc }`");
  };
  const hand = (h, path, partial = false) => {
    if (!isObj(h)) return bad(path, "cần object");
    if (h.pose !== undefined || !partial)
      if (typeof h.pose !== "string") bad(`${path}.pose`, "cần tên dáng");
    for (const k of ["at", "palm", "fingers"])
      if (h[k] !== undefined || !partial) (k === "at" ? ref : dir)(h[k], `${path}.${k}`);
  };
  if (!isObj(o.grips) || !Object.keys(o.grips).length)
    return [...out, "grips: cần ít nhất một kiểu cầm"];
  for (const [n, g] of Object.entries(o.grips)) {
    const path = `grips.${n}`;
    if (!isObj(g)) {
      bad(path, "cần object");
      continue;
    }
    if (g.on !== undefined && g.on !== "hand") {
      if (!CARRY_ON.includes(g.on)) bad(`${path}.on`, `cần ${CARRY_ON.join(" | ")}`);
      ref(g.at, `${path}.at`);
      continue;
    }
    hand(g, path);
    if (g.left !== undefined) hand(g.left, `${path}.left`, true);
    if (g.both !== undefined) {
      if (!isObj(g.both) || !["right", "left"].includes(g.both.lead))
        bad(`${path}.both`, "cần `{ lead: right | left, other }`");
      else hand(g.both.other, `${path}.both.other`);
    }
  }
  return out;
}

/** Món bản 1 (`schemaVersion` 1 hay không khai, có `grips`): `{ success, data }` hay `{ success: false, problems }` */
export function parseV1Item(json) {
  if (!isObj(json)) return { success: false, problems: ["không phải object"] };
  if (json.schemaVersion !== undefined && json.schemaVersion !== 1)
    return { success: false, problems: [`schemaVersion ${json.schemaVersion}`] };
  const problems = v1Problems(json);
  return problems.length
    ? { success: false, problems }
    : { success: true, data: { ...structuredClone(json), schemaVersion: 1 } };
}

/** Kiểu treo (`on` là `elbow` / `shoulder`), không phải kiểu cầm bằng bàn tay */
const isCarry = (g) => !!g && g.on !== undefined && g.on !== "hand";

/** Bên giải phẫu (`-1` phải) của `both.lead` */
const leadSide = (lead) => (lead === "right" ? -1 : 1);

/** Kiểu cầm `kieu` của món bản 1, hay ném lỗi có tên */
function v1Grip(v1, kieu, name) {
  const g = v1.grips?.[kieu];
  if (!g) throw new Error(`\`${name}\` không có kiểu cầm \`${kieu}\``);
  return g;
}

/** Bàn tay của kiểu cầm cho tay bên `side` (`-1` phải): tay trái lấy phần `left` đè lên */
const gripHand = (g, side) => {
  const h = { pose: g.pose, at: g.at, palm: g.palm, fingers: g.fingers };
  return side > 0 && g.left ? { ...h, ...g.left } : h;
};

const unit = (v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};

/** Hướng khung món của `palm` / `fingers` bản 1: vectơ, `into` ngược pháp tuyến mốc, `along` theo nó, `toward` tới mốc */
function v1Dir(v1, d, from) {
  if (Array.isArray(d)) return unit(d);
  if ("into" in d) return rig.heldAxis(v1, d.into).map((x) => -x);
  if ("along" in d) return rig.heldAxis(v1, d.along);
  const p = rig.heldPoint(v1, d.toward);
  const v = [p[0] - from[0], p[1] - from[1], p[2] - from[2]];
  if (Math.hypot(...v) < 1e-9) throw new Error(`\`toward: ${d.toward}\` trùng điểm nắm`);
  return unit(v);
}

/** Liên kết cứng của bàn tay kiểu cầm bản 1 `h`: quy mốc ra vectơ khung món rồi `graspLink` của rig */
function v1Link(v1, h, side, k, long) {
  const at = rig.heldPoint(v1, h.at);
  const hand = { pose: h.pose, at, palm: v1Dir(v1, h.palm, at), fingers: v1Dir(v1, h.fingers, at) };
  return rig.graspLink(hand, side, k, long, 1);
}

/** `hold` của cảnh là kiểu cầm bản 1: chuỗi `món#kiểu`, object `{ item, grip, … }` */
const isV1Hold = (h) =>
  typeof h === "string" ? !h.includes("@") : !!h && typeof h === "object" && !("group" in h);

/**
 * Ý định của mốc `hold` bản 1: ý định mặc định của kiểu cầm, `face` / `up` / `roll` của mốc đè lên; `face` khai đích trần
 * lấy trục chính của ý định mặc định
 */
export function v1Intent(v1, h) {
  const kieu = typeof h === "string" ? h.slice(h.indexOf("#") + 1) : h.grip;
  const g = v1Grip(v1, kieu, "món");
  if (isCarry(g)) return {};
  const d = g.intent;
  let face = d?.face ?? (d?.up !== undefined ? { axis: d.up, toward: "up" } : undefined);
  let roll = d?.roll;
  if (typeof h === "object") {
    if (h.up !== undefined) face = { axis: h.up, toward: "up" };
    else if (h.face !== undefined) {
      if (isObj(h.face) && "axis" in h.face) face = h.face;
      else {
        if (!face)
          throw new Error(`\`${kieu}\` không có trục ý định mặc định cho \`face\` khai đích trần`);
        face = { axis: face.axis, toward: h.face };
      }
    }
    if (h.roll) roll = h.roll;
  }
  return { ...(face && { face }), ...(roll && { roll }) };
}

/** Món bản 1 qua các lớp (lớp sau đè lớp trước theo tên file); file không đọc được bỏ qua */
function loadV1(layers) {
  const out = {};
  for (const dir of layers)
    for (const f of listJson(dir)) {
      const r = parseV1Item(readJson(join(dir, f)));
      if (r.success) out[f.replace(/\.json$/, "")] = r.data;
    }
  return out;
}

/** Lệch quá ngần này là shot đổi hình, chủ dự án duyệt */
export const MIGRATE_ANGLE = 5;
export const MIGRATE_SHIFT = 1;

/** Tay phụ đè mặc định của nhóm chỉ khi bớt lệch ít nhất ngần này (giá của `nearest`: 1 là 5° hay 1 đơn vị) */
const SUPPORT_GAIN = 0.1;
/** Hai ứng viên lệch giá dưới ngần này coi như hoà: giữ ứng viên trước (phần, cạnh theo thứ tự của món) */
const TIE = 1e-3;

/** Phần người v2 tự cho lấn khi cầm (bàn tay, cẳng tay cầm): không ghi lại vào `touch` */
const TOUCH_DEFAULT = new Set(["self.hand", "self.foreArm"]);

const CONT = ["along", "slant", "around", "tilt", "psi", "inset"];
const PLACE = [
  "part",
  "edge",
  "along",
  "thumb",
  "variant",
  "slant",
  "around",
  "tilt",
  "psi",
  "inset",
];
const SUPPORT_PLACE = ["part", "edge", "along", "thumb", "variant", "slant", "psi", "inset"];

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const listJson = (d) =>
  existsSync(d)
    ? readdirSync(d)
        .filter((f) => /\.json$/.test(f) && f !== "index.json")
        .sort()
    : [];
const r3 = (x) => Math.round(x * 1000) / 1000;
const r1 = (x) => Math.round(x * 10) / 10;
const fmt = (x, d = 1) => x.toFixed(d).replace(".", ",");

const geoms = new WeakMap();
const geomOf = (spec) => {
  let g = geoms.get(spec);
  if (!g) geoms.set(spec, (g = rig.itemGeom(spec)));
  return g;
};

/** Bàn tay của người cầm: `k`, `long` như `trunk3`; người không mặc đồ lấy cỡ `1` (rig: `1 / world.s`) */
export function handOf(c) {
  const pal = rig.wornPalette(c);
  if (!pal.clad) return { k: 1, long: 1 };
  const { k, long } = rig.cladHand(
    rig.limbWidths(pal).sleeve,
    c.rig.stroke,
    rig.bones3(c.rig.height).foreArm * 100,
  );
  return { k, long };
}

/** Nhóm đã có chỗ tiếp xúc: tìm được chỗ cầm; `carry` không cần */
const groupReady = (group) =>
  group === "carry" || (!rig.GRIP_GROUPS[group]?.later && !!rig.CONTACTS[group]);

/** Bàn tay dẫn và tay phụ v2 của `hold` như rig dựng ở đường tay dẫn (`holdHand`), khung `G` theo cỡ tay */
function v2Hand(spec, hold, side, hand) {
  const geom = geomOf(spec);
  const gs = rig.GRIP_GROUPS[hold.group];
  const dims = rig.handDims(hand.k, hand.long);
  const kinds = new Set(gs.needs.flatMap((n) => n.kinds));
  const ok = (f) =>
    kinds.has(f.kind) &&
    (hold.part === undefined || f.part === hold.part) &&
    rig.edgeOk(f, hold.edge);
  const f = rig.groupNeeds(geom, gs, dims, spec.anchors).find(ok) ?? geom.features.find(ok);
  const choice = { ...(f && { part: f.part, feature: f.kind }) };
  for (const k of PLACE) if (hold[k] !== undefined) choice[k] = hold[k];
  const rh = {
    item: hold.item,
    grip: rig.sceneHoldRef(hold).grip,
    spec,
    since: 0,
    grasp: { hold, mode: "hand", choice, t0: 0 },
  };
  const x = rig.holdHand(rh, side, dims);
  if (!x?.frame) throw new Error(`\`${hold.item}@${hold.group}\` không cầm bằng bàn tay`);
  return {
    G: rig.graspLink(x.frame.hand, side, hand.k, hand.long, 1),
    choice: x.frame.choice,
    ...(x.both && {
      support: rig.graspLink(x.both.other, -side, hand.k, hand.long, 1),
    }),
  };
}

/** Góc (độ) giữa hai liên kết và khoảng dời (đơn vị rig) của điểm món `q` (tâm nắm cũ) trong bàn tay */
export function gripDelta(A, B, q) {
  let tr = 0;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) tr += A.R[3 * j + i] * B.R[3 * j + i];
  const angle = (Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) * 180) / Math.PI;
  const pa = rig.gripPoint(A, q);
  const pb = rig.gripPoint(B, q);
  const shift = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]) / A.u;
  return { angle, shift };
}

const cost = (d) => d.angle / MIGRATE_ANGLE + d.shift / MIGRATE_SHIFT;

/** Lưới thô của trường liên tục trong miền `[lo, hi]` */
function coarse(key, lo, hi) {
  if (key === "around") return Array.from({ length: 12 }, (_, i) => i * 30);
  const n = key === "along" || key === "slant" ? 5 : key === "tilt" ? 6 : 7;
  return Array.from({ length: n }, (_, i) =>
    key === "along" ? lo + ((hi - lo) * (i + 0.5)) / n : lo + ((hi - lo) * i) / (n - 1),
  );
}

/** Miền của trường liên tục `key` ở biến thể `variant`; miền hở (`inset`) dò tới `1,5·W` */
function rangeOf(gs, key, variant, dims) {
  const c = gs.choices[key];
  if (c?.kind !== "range") return undefined;
  const [lo, hi] = c.byVariant?.[variant] ?? [c.min, c.max];
  return [lo, Number.isFinite(hi) ? hi : lo + 1.5 * dims.W];
}

/** Ứng viên rời của nhóm trên món: phần, cạnh, mặt ngón cái, biến thể (đã qua `want` ép phần, biến thể) */
function discrete(spec, group, hand, want, fields = PLACE) {
  const geom = geomOf(spec);
  const gs = rig.GRIP_GROUPS[group];
  const dims = rig.handDims(hand.k, hand.long);
  const kinds = new Set(gs.needs.flatMap((n) => n.kinds));
  let feats = rig.groupNeeds(geom, gs, dims, spec.anchors);
  if (!feats.length) feats = geom.features.filter((f) => kinds.has(f.kind));
  if (want.part !== undefined) feats = feats.filter((f) => f.part === want.part);
  const has = (k) => fields.includes(k) && gs.choices[k];
  const contacts = rig.CONTACTS[group] ?? {};
  const variants =
    want.variant !== undefined
      ? [want.variant]
      : gs.choices.variant?.kind === "names" && gs.choices.variant.values
        ? gs.choices.variant.values.filter((v) => contacts[v] && gs.variants[v]?.pose)
        : gs.variantOf
          ? Object.keys(gs.variants).filter((v) => contacts[v] && gs.variants[v]?.pose)
          : [undefined];
  const out = [];
  const seen = new Set();
  for (const f of feats) {
    let edges = [undefined];
    if (has("edge")) {
      if (f.kind === "slab" || f.kind === "face") edges = f.edges.map((e) => e.name);
      else if (f.kind === "disc") edges = Array.from({ length: 12 }, (_, i) => i * 30);
    }
    let thumbs = [undefined];
    if (has("thumb")) {
      const c = gs.choices.thumb;
      if (c.values) thumbs = [...c.values];
      else if (f.kind === "slab" || f.kind === "disc") thumbs = f.faces.map((x) => x.name);
    }
    for (const edge of edges)
      for (const thumb of thumbs)
        for (const variant of variants) {
          const c = {
            ...(fields.includes("part") && { part: f.part }),
            ...(edge !== undefined && { edge }),
            ...(thumb !== undefined && { thumb }),
            ...(variant !== undefined && { variant }),
          };
          const key = JSON.stringify(c);
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(c);
        }
  }
  return out;
}

/** Trường số của một ứng viên: `edge` số (vành đĩa) cùng các trường liên tục của nhóm */
function numericKeys(gs, c, fields) {
  const keys = CONT.filter((k) => fields.includes(k) && gs.choices[k]?.kind === "range");
  return typeof c.edge === "number" ? ["edge", ...keys] : keys;
}

const STEP = { along: [0.1, 0.004], edge: [15, 0.5], tilt: [5, 0.5], inset: [1, 0.05] };
const stepOf = (k) => STEP[k] ?? [15, 0.5];

/**
 * Chỗ cầm gần liên kết `target` nhất (góc / `MIGRATE_ANGLE` + khoảng / `MIGRATE_SHIFT` nhỏ nhất): quét ứng viên rời với lưới thô
 * của trường số, rồi dò từng trường quanh sáu ứng viên tốt nhất. `make(c)` dựng chỗ cầm, `measure(hold)` ra liên kết
 */
function nearest({ spec, group, hand, want, fields, make, measure, q, target }) {
  const gs = rig.GRIP_GROUPS[group];
  const dims = rig.handDims(hand.k, hand.long);
  const score = (c) => {
    try {
      const d = gripDelta(target, measure(make(c)), q);
      return { c, d, cost: cost(d) };
    } catch {
      return undefined;
    }
  };
  const all = [];
  for (const base of discrete(spec, group, hand, want, fields)) {
    const keys = numericKeys(gs, base, fields);
    let grid = [base];
    for (const k of keys) {
      const [lo, hi] = k === "edge" ? [0, 330] : rangeOf(gs, k, base.variant, dims);
      const vals = k === "edge" ? [base.edge] : coarse(k, lo, hi);
      grid = grid.flatMap((c) => vals.map((v) => ({ ...c, [k]: v })));
    }
    for (const c of grid) {
      const s = score(c);
      if (s) all.push({ ...s, i: all.length });
    }
  }
  if (!all.length) return undefined;
  const top = [...all].sort((a, b) => a.cost - b.cost || a.i - b.i).slice(0, 6);
  let best;
  for (let s of top) {
    const keys = numericKeys(gs, s.c, fields);
    for (const k of keys) {
      const [lo, hi] =
        k === "edge" || k === "around" ? [-Infinity, Infinity] : rangeOf(gs, k, s.c.variant, dims);
      const wrap = (v) => (k === "edge" || k === "around" ? ((v % 360) + 360) % 360 : v);
      for (let st = stepOf(k)[0]; st >= stepOf(k)[1]; st /= 2)
        for (let moved = true; moved;) {
          moved = false;
          for (const dv of [st, -st]) {
            const v = s.c[k] + dv;
            if (v < lo - 1e-9 || v > hi + 1e-9) continue;
            const n = score({ ...s.c, [k]: wrap(v) });
            if (n && n.cost < s.cost - TIE) {
              s = n;
              moved = true;
            }
          }
        }
    }
    if (!best || s.cost < best.cost - TIE) best = s;
  }
  return best;
}

/** Trường chỗ cầm của khung đã dựng, làm tròn: tỉ lệ 3 chữ số, góc 1 chữ số */
function placeOf(choice, fields) {
  const out = {};
  for (const k of fields) {
    const v = choice[k];
    if (v === undefined) continue;
    out[k] = typeof v !== "number" ? v : k === "along" ? r3(v) : r1(v);
  }
  return out;
}

/** Hai trục trùng hướng trên món v2; trục trỏ mốc món v2 không có thì coi là khác (`checkChoice`, `check` báo) */
const sameAxis = (spec, a, b) => {
  try {
    const u = rig.heldAxis(spec, a);
    const v = rig.heldAxis(spec, b);
    return u[0] * v[0] + u[1] * v[1] + u[2] * v[2] > 1 - 1e-6;
  } catch {
    return false;
  }
};
const sameIntent = (spec, a, b) =>
  !!a &&
  !!b &&
  sameAxis(spec, a.axis, b.axis) &&
  JSON.stringify(a.toward) === JSON.stringify(b.toward) &&
  (a.tilt ?? 0) === (b.tilt ?? 0);

/**
 * Ý định của kiểu cũ (`v1Intent`, đè của cảnh đã gộp) ghi vào chỗ cầm v2 khi khác mặc định của nhóm: không có ý định thì
 * `keep: true`. `note` khi v2 không diễn được đúng (nhóm thêm trục v1 không chốt)
 */
export function intentFields(v1, v2, oldHold, group) {
  const old = v1Intent(v1, oldHold);
  if (group === "carry") return { fields: {} };
  const def = rig.groupIntent(group, { item: "x", group }, geomOf(v2));
  if (!old.face && !old.roll) return { fields: def.face || def.roll ? { keep: true } : {} };
  const fields = {};
  const notes = [];
  if (old.face && !sameIntent(v2, old.face, def.face))
    Object.assign(
      fields,
      old.face.toward === "up" && old.face.tilt === undefined
        ? { up: old.face.axis }
        : { face: old.face },
    );
  if (!old.face && def.face) notes.push("v1 không có trục chính, nhóm thêm `face` mặc định");
  if (old.roll && !sameIntent(v2, old.roll, def.roll)) fields.roll = old.roll;
  if (!old.roll && def.roll) notes.push("v1 không chốt lăn, nhóm thêm `roll` mặc định");
  return { fields, ...(notes.length && { note: notes.join("; ") }) };
}

/** `touch` chung của món v1 (mọi kiểu cầm bằng tay, trừ phần v2 tự cho lấn) và `touch` riêng của từng kiểu */
export function touchSplit(v1) {
  const own = {};
  for (const [name, g] of Object.entries(v1.grips ?? {}))
    own[name] = (g.touch ?? []).filter((t) => typeof t !== "string" || !TOUCH_DEFAULT.has(t));
  const hands = Object.entries(v1.grips ?? {})
    .filter(([, g]) => !isCarry(g))
    .map(([n]) => n);
  const key = (t) => JSON.stringify(t);
  // một kiểu cầm thì mọi `touch` là của kiểu ấy (tai, ôm): xuống cảnh
  const common =
    hands.length < 2
      ? []
      : own[hands[0]].filter((t) => hands.every((n) => own[n].some((x) => key(x) === key(t))));
  const shared = new Set(common.map(key));
  const rest = {};
  for (const [n, list] of Object.entries(own)) rest[n] = list.filter((t) => !shared.has(key(t)));
  return { common, own: rest };
}

/**
 * Mục `touch` không bên (`self.hand`, `self.foreArm`) của kiểu cầm `g` miễn cả hai tay; v2 chỉ tự miễn bên cầm (hai bên khi
 * `both`): ghi bên kia của tay cầm `side` (`"right"`/`"left"`) xuống `touch` của chỗ cầm. Kiểu treo không xét
 */
export function touchOther(g, side) {
  if (g.both || isCarry(g)) return [];
  const other = side === "right" ? "L" : "R";
  return (g.touch ?? [])
    .filter((t) => typeof t === "string" && TOUCH_DEFAULT.has(t))
    .map((t) => `${t}${other}`);
}

/** Món v2 từ món v1: bỏ `grips`, `seats` từ kiểu treo, `touch` chung; nhãn phần lấy từ `labels` (món v2 sẵn có) */
export function migrateItem(v1, labels) {
  const seats = {};
  const problems = [];
  for (const [n, g] of Object.entries(v1.grips ?? {}))
    if (isCarry(g)) {
      if (typeof g.at !== "string") problems.push(`kiểu treo \`${n}\`: \`at\` không phải tên mốc`);
      else seats[g.on] = g.at;
    }
  const { common } = touchSplit(v1);
  const out = { ...structuredClone(labels ?? v1), schemaVersion: rig.HELD_VERSION };
  delete out.grips;
  if (Object.keys(seats).length) out.seats = { ...(labels?.seats ?? {}), ...seats };
  if (common.length) out.touch = common;
  else delete out.touch;
  return { item: out, seats, touch: common, problems };
}

const short = (v) =>
  typeof v === "string"
    ? v
    : Array.isArray(v)
      ? `[${v.join(", ")}]`
      : "axis" in v
        ? `${short(v.axis)} → ${short(v.toward)}${v.tilt ? ` ${v.tilt}°` : ""}`
        : JSON.stringify(v);

/** Chỗ cầm v2 viết gọn cho bảng */
function holdLabel(h) {
  const parts = [h.group];
  for (const k of [...PLACE, "on", "yaw"]) if (h[k] !== undefined) parts.push(`${k} ${h[k]}`);
  if (h.both)
    parts.push(
      h.both === true
        ? "both"
        : `both {${Object.entries(h.both)
            .map(([k, v]) => `${k} ${v}`)
            .join(", ")}}`,
    );
  for (const k of ["up", "face", "roll"])
    if (h[k] !== undefined) parts.push(`${k}: ${short(h[k])}`);
  if (h.keep) parts.push("keep");
  if (h.touch) parts.push(`touch ${h.touch.map(short).join(", ")}`);
  if (h.regrip) parts.push("regrip");
  return parts.join(" · ");
}

/** Chỗ cầm nhóm cho một kiểu cũ trên tay `side` của người có bàn tay `hand`: chỗ cầm, lệch, tay phụ */
function convertGrip({ item, kieu, v1, v2, side, hand, want }) {
  const g = v1Grip(v1, kieu, item);
  const group = want.group;
  if (group === "carry") {
    if (!isCarry(g)) return { status: "lỗi", note: `\`${item}#${kieu}\` không phải kiểu treo` };
    const seat = v2.seats?.[g.on];
    const same = typeof g.at === "string" && seat === g.at;
    return {
      status: "ok",
      place: { on: g.on, ...(g.yaw !== undefined && { yaw: g.yaw }) },
      lead: { angle: 0, shift: 0 },
      ...(!same && {
        note: `\`seats.${g.on}\` của món v2 là \`${seat}\`, kiểu treo cũ treo ở \`${JSON.stringify(g.at)}\``,
      }),
    };
  }
  if (!groupReady(group)) return { status: "chờ nhóm" };
  if (isCarry(g)) return { status: "lỗi", note: `\`${item}#${kieu}\` là kiểu treo` };
  const L = g.both ? leadSide(g.both.lead) : side;
  const hh = gripHand(g, L);
  const target = v1Link(v1, hh, L, hand.k, hand.long);
  const q = rig.heldPoint(v1, hh.at);
  const make = (c) => ({ item, group, ...c, ...(g.both && { both: true }) });
  const best = nearest({
    spec: v2,
    group,
    hand,
    want,
    fields: PLACE,
    make,
    measure: (h) => v2Hand(v2, h, L, hand).G,
    q,
    target,
  });
  if (!best) return { status: "lỗi", note: `không dựng được chỗ cầm \`${group}\` nào trên món v2` };
  const gs = rig.GRIP_GROUPS[group];
  const place = placeOf(
    v2Hand(v2, make(best.c), L, hand).choice,
    gs.choices.variant || gs.variantOf ? PLACE : PLACE.filter((k) => k !== "variant"),
  );
  const hold = make(place);
  const lead = gripDelta(target, v2Hand(v2, hold, L, hand).G, q);
  const dims = rig.handDims(hand.k, hand.long);
  const errs = rig.checkChoice(group, geomOf(v2), hold, dims, v2.anchors, v2.shape);
  const res = {
    status: errs.length ? "lỗi" : "ok",
    place,
    lead,
    ...(errs.length && { note: errs.join("; ") }),
  };
  if (!g.both) return res;
  // tay phụ: `both: true` khi mặc định của nhóm đủ gần tay kia của kiểu cũ, không thì đè bằng chỗ gần nhất
  const ho = g.both.other;
  const tOther = v1Link(v1, ho, -L, hand.k, hand.long);
  const qo = rig.heldPoint(v1, ho.at);
  const dflt = gripDelta(tOther, v2Hand(v2, hold, L, hand).support, qo);
  if (dflt.angle <= MIGRATE_ANGLE && dflt.shift <= MIGRATE_SHIFT)
    return { ...res, both: true, supportDelta: dflt };
  const sg = rig.supportGroup(hold);
  const sb = nearest({
    spec: v2,
    group: sg,
    hand,
    want: {},
    fields: SUPPORT_PLACE,
    make: (c) => ({ ...hold, both: { ...(sg !== group && { group: sg }), ...c } }),
    measure: (h) => v2Hand(v2, h, L, hand).support,
    q: qo,
    target: tOther,
  });
  if (!sb || sb.cost > cost(dflt) - SUPPORT_GAIN) return { ...res, both: true, supportDelta: dflt };
  const ov = { ...(sg !== group && { group: sg }), ...placeOf(sb.c, SUPPORT_PLACE) };
  const sup = gripDelta(tOther, v2Hand(v2, { ...hold, both: ov }, L, hand).support, qo);
  return { ...res, both: ov, supportDelta: sup };
}

const refOf = (h) => (typeof h === "string" ? h : `${h.item}#${h.grip}`);
const baseRef = (ref) => {
  const [item, kieu] = ref.split("#");
  return `${rig.heldBase(item)}#${kieu}`;
};
/** Giây của mốc: số giữ nguyên, `@mốc` kèm giây tra được */
const timeOf = (t, marks) => {
  if (typeof t === "number") return t;
  try {
    return `${t} = ${+rig.markTime(t, marks ?? {}).toFixed(3)}`;
  } catch {
    return t;
  }
};
const over = (d) => !!d && (d.angle > MIGRATE_ANGLE || d.shift > MIGRATE_SHIFT);

/** Nạp món v1 (`held/` cùng lớp chung), món v2 (`heldDir`), nhân vật (lớp chung và repo) */
function loadWorkspace(root, heldDir) {
  const v1 = loadV1([COMMON.held, join(root, "held")]);
  const v2 = {};
  for (const f of listJson(resolve(root, heldDir))) {
    const r = rig.parseHeldItem(readJson(join(resolve(root, heldDir), f)));
    if (r.success) v2[f.replace(/\.json$/, "")] = r.data;
  }
  const characters = {};
  for (const d of [COMMON.characters, join(root, "characters")])
    for (const f of listJson(d)) {
      const r = rig.parseCharacter(readJson(join(d, f)));
      if (r.success) characters[f] = r.data;
    }
  return { v1, v2, characters };
}

/**
 * Chuyển `hold` v1 của các cảnh khớp `scene` sang chỗ cầm nhóm và món v1 sang v2. `heldDir` là thư mục món v2 (nhãn phần);
 * món v1 đọc ở `held/` cùng lớp chung; `map` đè `HOLD_MAP`. `dryRun` không ghi gì; cảnh còn lần cầm chưa chuyển được không
 * ghi. Trả bảng từng lần cầm, món, cảnh
 */
export function migrateHeld({ dir = ".", scene, heldDir = "held", map, dryRun = false } = {}) {
  const root = resolve(dir);
  const table = { ...HOLD_MAP, ...(map ?? {}) };
  const ws = loadWorkspace(root, heldDir);
  const focus =
    scene === undefined ? undefined : scene instanceof RegExp ? scene : new RegExp(scene);
  const files = listJson(join(root, "scenes")).filter(
    (f) => !focus || focus.test(f.replace(/\.json$/, "")),
  );
  const rows = [];
  const problems = [];
  const used = new Map();
  const cache = new Map();
  const scenes = [];

  /** Kết quả chuyển một kiểu cũ trên tay `sd` của người có bàn tay `hand` (nhớ theo món, kiểu, tay dẫn, cỡ tay) */
  const resolveGrip = (ref, sd, hand) => {
    const [item, kieu] = ref.split("#");
    const base = rig.heldBase(item);
    const v1 = ws.v1[base];
    const v2 = ws.v2[base];
    const want = table[baseRef(ref)];
    if (v1) used.set(base, v1);
    if (!want) return { status: "lỗi", note: `\`${baseRef(ref)}\` không có trong bảng ánh xạ` };
    if (!v1) return { status: "lỗi", note: `không có món v1 \`${base}\`` };
    if (!v2) return { status: "lỗi", note: `không có món v2 \`${base}\` ở ${heldDir}/` };
    const g = v1.grips?.[kieu];
    if (!g) return { status: "lỗi", note: `\`${base}\` không có kiểu \`${kieu}\`` };
    const L = g.both ? leadSide(g.both.lead) : sd;
    const ck = JSON.stringify([base, kieu, L, hand.k, hand.long]);
    if (!cache.has(ck))
      cache.set(ck, convertGrip({ item: base, kieu, v1, v2, side: L, hand, want }));
    return { ...cache.get(ck), v1, v2, g, want, support: !!g.both && L !== sd };
  };

  for (const file of files) {
    const id = file.replace(/\.json$/, "");
    const raw = readJson(join(root, "scenes", file));
    const out = structuredClone(raw);
    const changes = [];
    let blocked = false;
    for (const [mi, m] of (raw.cast ?? []).entries()) {
      const keys = m.world?.hands;
      if (!keys?.length) continue;
      const c0 = m.character ? ws.characters[m.character] : rig.defaultCharacter();
      if (!c0) {
        problems.push(`${id}: ${m.id}: không có characters/${m.character}`);
        blocked = true;
        continue;
      }
      const hand = handOf(c0);
      const okeys = out.cast[mi].world.hands;
      const runs = { right: null, left: null };
      for (const [ki, k] of keys.entries())
        for (const side of ["right", "left"]) {
          const h = k[side]?.hold;
          if (h === undefined) continue;
          if (h === null || !isV1Hold(h)) {
            runs[side] = null;
            continue;
          }
          const ref = refOf(h);
          const item = ref.split("#")[0];
          const fresh = runs[side]?.ref !== ref;
          const res = resolveGrip(ref, side === "right" ? -1 : 1, hand);
          const row = {
            scene: id,
            cast: m.id,
            side,
            t: timeOf(k.t, raw.marks),
            old: ref,
            status: res.status,
          };
          if (res.support) row.role = "tay phụ";
          let hold;
          if (res.want && res.status !== "lỗi" && !res.support) {
            const intent = intentFields(res.v1, res.v2, h, res.want.group);
            const touch = [
              ...(touchSplit(res.v1).own[ref.split("#")[1]] ?? []),
              ...touchOther(res.g, side),
            ];
            const pending = res.status === "chờ nhóm";
            hold = {
              item,
              group: res.want.group,
              ...(pending
                ? {
                    ...(res.want.part && { part: res.want.part }),
                    ...(res.want.variant && { variant: res.want.variant }),
                  }
                : res.place),
              ...intent.fields,
              ...(res.g.both && { both: res.both ?? true }),
              ...(touch.length && { touch }),
            };
            if (intent.note) row.intent = intent.note;
            // kiểu cũ đổi mà chỗ cầm mới trùng khoá: giữ ranh giới lần cầm
            const key = rig.holdRunKey(hold);
            if (fresh && runs[side]?.key === key) hold.regrip = true;
            const v = rig.SceneHoldSchema.safeParse(hold);
            if (!v.success) {
              row.status = "lỗi";
              row.note = v.error.issues.map((i) => i.message).join("; ");
            }
          }
          if (fresh) {
            row.hold = res.support ? "(tay phụ của `both`)" : hold ? holdLabel(hold) : undefined;
            if (res.support) row.lead = res.supportDelta;
            else {
              if (res.lead) row.lead = res.lead;
              if (res.supportDelta) row.support = res.supportDelta;
            }
            if (res.note) row.note = [res.note, row.note].filter(Boolean).join("; ");
            if (over(row.lead) || over(row.support)) row.flag = true;
            rows.push(row);
          }
          runs[side] = { ref, key: hold && rig.holdRunKey(hold) };
          if (row.status !== "ok") blocked = true;
          const o = okeys[ki][side];
          if (res.support && res.status !== "lỗi") {
            // tay phụ của `both` không cầm: tay dẫn mang `both`
            o.hold = null;
            changes.push({ cast: m.id, t: k.t, side, from: h, to: null });
          } else if (hold) {
            o.hold = hold;
            changes.push({ cast: m.id, t: k.t, side, from: h, to: hold });
          }
        }
    }
    if (!changes.length && !blocked) continue;
    const parsed = rig.parseScene(out);
    if (!parsed.success) {
      problems.push(
        `${id}: cảnh sau khi chuyển không qua schema: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
      blocked = true;
    }
    const write = !dryRun && !blocked;
    if (write) writeFileSync(join(root, "scenes", file), `${JSON.stringify(out, null, 2)}\n`);
    scenes.push({ file: `scenes/${file}`, changes, wrote: write, ...(blocked && { blocked }) });
  }

  const items = [];
  for (const [name, v1] of [...used].sort(([a], [b]) => a.localeCompare(b))) {
    const v2 = ws.v2[name];
    const m = migrateItem(v1, v2);
    const notes = [...m.problems];
    let state;
    if (v2) {
      for (const [on, at] of Object.entries(m.seats))
        if (v2.seats?.[on] !== at)
          notes.push(`\`seats.${on}\` cần \`${at}\`, món v2 có \`${v2.seats?.[on]}\``);
      const want = JSON.stringify([...m.touch].map((t) => JSON.stringify(t)).sort());
      const have = JSON.stringify((v2.touch ?? []).map((t) => JSON.stringify(t)).sort());
      if (want !== have)
        notes.push(
          `\`touch\` cần ${JSON.stringify(m.touch)}, món v2 có ${JSON.stringify(v2.touch ?? [])}`,
        );
      state = notes.length ? "lệch" : "khớp";
    } else state = "chuyển (chưa nhãn phần)";
    const parsed = rig.parseHeldItem(m.item);
    if (!parsed.success)
      notes.push(
        `món v2 không qua schema: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      );
    const file = join(resolve(root, heldDir), `${name}.json`);
    const write = !dryRun && state !== "khớp" && !m.problems.length && parsed.success;
    if (write) writeFileSync(file, `${JSON.stringify(m.item, null, 2)}\n`);
    items.push({
      item: name,
      state,
      seats: m.seats,
      touch: m.touch,
      ...(notes.length && { notes }),
      wrote: write,
    });
  }
  return { dir: root, heldDir, rows, items, scenes, problems, summary: summarize(rows) };
}

/** Số đếm của bảng: lần cầm, chuyển được, chờ nhóm, lỗi, lệch quá ngưỡng, theo kiểu cũ */
function summarize(rows) {
  const lead = rows.filter((r) => r.role !== "tay phụ");
  const by = {};
  for (const r of lead) {
    const b = (by[baseRef(r.old)] ??= { holds: 0, ok: 0, pending: 0, error: 0, flag: 0 });
    b.holds++;
    if (r.status === "ok") b.ok++;
    else if (r.status === "chờ nhóm") b.pending++;
    else b.error++;
    if (r.flag) b.flag++;
  }
  const count = (f) => lead.filter(f).length;
  return {
    holds: lead.length,
    support: rows.length - lead.length,
    ok: count((r) => r.status === "ok"),
    pending: count((r) => r.status === "chờ nhóm"),
    error: count((r) => r.status === "lỗi"),
    flag: count((r) => r.flag),
    byKind: Object.fromEntries(Object.entries(by).sort((a, b) => b[1].holds - a[1].holds)),
  };
}

const dCell = (d, k) =>
  d
    ? `${fmt(d[k], k === "angle" ? 1 : 2)}${d[k] > (k === "angle" ? MIGRATE_ANGLE : MIGRATE_SHIFT) ? " **!**" : ""}`
    : "";

/** Bảng markdown của `migrateHeld` */
export function migrateTable(r) {
  const s = r.summary;
  const lines = [
    `# migrate-held — ${r.dir}`,
    "",
    `Món v2: \`${r.heldDir}/\`. ${s.holds} lần cầm (+ ${s.support} dòng tay phụ của \`both\`): ${s.ok} chuyển được, ${s.pending} chờ nhóm, ${s.error} lỗi; ${s.flag} lệch quá ${MIGRATE_ANGLE}° hay ${MIGRATE_SHIFT} đơn vị.`,
    "",
    "Góc: phép quay món trong bàn tay, cũ → mới. Khoảng: điểm món ở tâm nắm cũ dời bao nhiêu trong bàn tay (đơn vị rig). Tay phụ: so với tay kia của kiểu hai tay cũ.",
    "",
    "## Theo kiểu cũ",
    "",
    "| Kiểu cũ | Lần cầm | Chuyển | Chờ nhóm | Lỗi | Lệch quá ngưỡng |",
    "|---|---|---|---|---|---|",
    ...Object.entries(s.byKind).map(
      ([k, b]) => `| \`${k}\` | ${b.holds} | ${b.ok} | ${b.pending} | ${b.error} | ${b.flag} |`,
    ),
    "",
    "## Món",
    "",
    "| Món | Trạng thái | `seats` | `touch` | Ghi chú |",
    "|---|---|---|---|---|",
    ...r.items.map(
      (i) =>
        `| \`${i.item}\` | ${i.state} | ${Object.entries(i.seats)
          .map(([k, v]) => `${k}: ${v}`)
          .join(
            ", ",
          )} | ${i.touch.map((t) => JSON.stringify(t)).join(", ")} | ${(i.notes ?? []).join("; ")} |`,
    ),
    "",
    "## Lần cầm",
    "",
    "| Cảnh | Người | Tay | t₀ | Cũ | Chỗ cầm | Góc lệch | Khoảng lệch | Tay phụ (góc / khoảng) | Ghi chú |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...r.rows.map(
      (x) =>
        `| ${x.scene} | ${x.cast} | ${x.side === "right" ? "phải" : "trái"}${x.role ? ` (${x.role})` : ""} | ${x.t} | \`${x.old}\` | ${x.status === "ok" ? (x.hold ?? "") : `${x.status}${x.hold ? `: ${x.hold}` : ""}`} | ${dCell(x.lead, "angle")} | ${dCell(x.lead, "shift")} | ${x.support ? `${dCell(x.support, "angle")} / ${dCell(x.support, "shift")}` : ""} | ${[x.note, x.intent].filter(Boolean).join("; ")} |`,
    ),
  ];
  if (r.problems.length) lines.push("", "## Lỗi nạp", "", ...r.problems.map((p) => `- ${p}`));
  return `${lines.join("\n")}\n`;
}

/** Ghi bảng ra `out` (`.md`) và kết quả JSON cạnh nó (`.json`) */
export function writeMigrateReport(r, out) {
  const md = extname(out) === ".md" ? out : `${out}.md`;
  const json = join(dirname(md), `${basename(md, ".md")}.json`);
  writeFileSync(md, migrateTable(r));
  writeFileSync(json, `${JSON.stringify(r, null, 2)}\n`);
  return { md, json };
}
