// `stickman gen <kiểu>`: sinh một hành động cho đúng một cảnh của repo video từ chỗ người và đồ trong cảnh ấy, tự kiểm
// bằng `gen-check.mjs` rồi mới ghi `actions/`. Kiểu `pour` (rót), `sit` (ngồi); đồ của cảnh tìm theo vai trò (slot của
// `GEN_KINDS`) — docs/05-repo-video.md#sinh-hành-động-theo-cảnh, docs/13-vai-tro-do.md mục 6.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as rig from "@stickman3d/rig/core";
import prettier from "prettier";
import {
  checkFailed,
  checkRows,
  checkTable,
  coreChecks,
  restChecks,
  sampleTimes,
  worldChecks,
} from "./gen-check.mjs";
import { GEN_PAGES } from "./gen-pages.mjs";
import {
  POUR_ALONG,
  POUR_DURATION,
  POUR_STYLES,
  POUR_T,
  POUR_TIMING,
  flip,
  handOf,
  linkFrom,
  measuredLink,
  pourAction,
  pourHold,
  pourerOf,
} from "./gen-pour.mjs";
import {
  ARMREST,
  BACK_GAP,
  BACK_KINDS,
  BACK_STYLES,
  DANGLE_MIN,
  FEET_KINDS,
  FOLD,
  FOREARM_REST,
  HAND_DROOP,
  HAND_KINDS,
  LEG_KINDS,
  LEG_STYLES,
  RECLINE,
  SIT_DURATION,
  THIGH_FLOOR,
  THIGH_OUT,
  THIGH_RANGE,
  THIGH_REACH,
  THIGH_SIDE,
  THIGH_SINK,
  TOP_KINDS,
  backExtra,
  dangleLeg,
  shinClear,
  frameOf,
  shoeAt,
  sitAction,
  sitArms,
  sitKeys,
  soleDrop,
  solveLeg,
  thighLow,
  thighSink,
} from "./gen-sit.mjs";
import { CLASH_EVERY, castRuntime, worldData, worldScene } from "./lib.mjs";
import { formatLike, sha, writeWithBak } from "./rawjson.mjs";
import {
  HOLD_MIN,
  REST_BEFORE,
  TURN_TIME_RANGE,
  WALK_DEFAULTS,
  naturalSpeed,
  parsePoints,
  planWalk,
  pointsText,
} from "./gen-walk.mjs";
import { backPlane, entryName, inPoly, rectHolds, rectLocal, roleMoved } from "./roles-check.mjs";
import { loadWorld, worldEntry } from "@stickman3d/render";

const D = Math.PI / 180;
const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const mul = (a, k) => a.map((v) => v * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(...a);
const r1 = (v) => Math.round(v * 10) / 10;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;
const sec = (t) => +t.toFixed(2);
const comma = (v) => String(r1(v)).replace(".", ",");
const rigOf = (p) => [p[0] * 100, -p[1] * 100, -p[2] * 100];
const matVec = (M, v) => [
  M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
  M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
  M[6] * v[0] + M[7] * v[1] + M[8] * v[2],
];
/** `R` của `ActHeld` (trục khung món trong thế giới three) → khung món → thế giới rig */
const rigRot = (R) => [R[0], R[1], R[2], -R[3], -R[4], -R[5], -R[6], -R[7], -R[8]];

/** Số vòng dời `lip` theo sai số trung bình đo được, và sai số trung bình coi là hội tụ */
const LIP_ROUNDS = 6;
const LIP_EPS = 0.05;
/** Hướng rót thử quanh hướng đã chọn khi hướng ấy không đạt, độ */
const DIR_TRIES = [0, -10, 10, -20, 20, -30, 30, -45, 45];

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const rel = (root, p) => (p.startsWith(root) ? p.slice(root.length + 1) : p);
const pretty = async (data, file) =>
  prettier.format(JSON.stringify(data), {
    ...(await prettier.resolveConfig(file)),
    parser: "json",
  });

export class GenError extends Error {}
const fail = (msg) => {
  throw new GenError(msg);
};

/**
 * Cảnh `o.scene` nạp một lần (docs/14-di-muot.md mục 5.5): bytes của `scenes/<id>.json` và `hash` của chúng, JSON thô (`raw`),
 * cảnh đã parse, người `o.cast` (người 3D), nhân vật theo `id`, dữ liệu hai lớp và runtime của cảnh như đang có. Sân khấu thử
 * `o.stage` (`{ sceneJson, held, spec }`, docs/13 mục 9.3) thay file cảnh bằng `sceneJson`, món `held` đè mọi lớp của `held/`
 * (file cùng tên không đọc); `o.sceneJson` (không có `o.stage`) là JSON cảnh trong bộ nhớ thay file — cả hai không có `hash`.
 * `o.scene` chỉ để gọi tên
 */
export function sceneData(root, o) {
  const data = worldData(root, { held: o.stage?.held });
  const json = o.stage?.sceneJson ?? o.sceneJson;
  const file = join(root, "scenes", `${o.scene}.json`);
  let raw = json;
  let bytes;
  if (!json) {
    if (!existsSync(file)) fail(`không có scenes/${o.scene}.json`);
    bytes = readFileSync(file);
    try {
      raw = JSON.parse(bytes.toString("utf8"));
    } catch (e) {
      fail(`scenes/${o.scene}.json hỏng: ${e.message}`);
    }
  }
  const parsed = rig.parseScene(raw);
  if (!parsed.success)
    fail(
      `${json ? `cảnh ${o.scene}` : `scenes/${o.scene}.json`} hỏng: ${parsed.error.issues?.[0]?.message}`,
    );
  const scene = parsed.data;
  const member =
    scene.cast.find((m) => m.id === o.cast) ?? fail(`cảnh không có người \`${o.cast}\``);
  if (!member.world) fail(`\`${o.cast}\` không phải người 3D (thiếu \`cast[].world\`)`);
  const chars = Object.fromEntries(
    scene.cast.map((m) => [
      m.id,
      (m.character && data.characters[m.character]) || rig.defaultCharacter(),
    ]),
  );
  const runtimeOf = (sc, actions = data.actions) =>
    castRuntime(sc, actions, data.characters, data.held, data.hands);
  const rt0 = runtimeOf(scene);
  return {
    data,
    raw,
    ...(bytes && { bytes, hash: sha(bytes), file }),
    scene,
    member,
    chars,
    c: chars[o.cast],
    runtimeOf,
    rt0,
    marks: rt0.marks,
  };
}

/**
 * Cảnh của `sceneData` cho bộ sinh hành động: người `o.cast` phải là người mặc đồ có bàn tay, `at` phải trong cảnh
 */
function sceneFor(root, o, at) {
  const sd = sceneData(root, o);
  if (!sd.c.palette?.clad) fail(`\`${o.cast}\` phải là người mặc đồ có bàn tay (\`palette.clad\`)`);
  if (at > sd.rt0.duration) fail(`--at ${at} quá độ dài cảnh ${sd.rt0.duration} s`);
  return sd;
}

/**
 * `o.stage` của `run` từ sân khấu thử của một trang (`GEN_PAGES[kiểu].stage`): `{ scene, props, held, h }` →
 * `{ sceneJson, held, spec }`, `spec(id, rig, ctx)` dựng `propWorld(props)` bằng `rig` được nạp, món `world.hands` qua
 * `previewExtra` — cùng hợp đồng `checkScenes({ spec })`
 */
export function stageRun(st) {
  return {
    sceneJson: st.scene,
    held: st.held ?? {},
    spec: (_id, R, ctx) => ({
      ...R.propWorld(st.props ?? [], { h: st.h ?? 1 }),
      ...(ctx?.scene && { extra: R.previewExtra(ctx.scene, { ...ctx.held, ...st.held }) }),
    }),
  };
}

/**
 * Cảnh three của cảnh `scene` để tìm đồ theo vai trò: `{ propsAt(t) }` (`rolesOf` trên cảnh đã `pose(t)`, nhớ theo giây),
 * hay `{ none }` kèm lý do khi không có cảnh three. Có `o.stage` thì dựng `buildWorld(o.stage.spec)` bằng `@stickman3d/rig`
 * của repo, không đọc `stickman.world`
 */
async function sceneThree(root, o, scene, data) {
  const st = o.stage;
  let world;
  try {
    world = await loadWorld(root, { bare: !!st });
  } catch (e) {
    fail(`không nạp được \`stickman.world\`: ${e.message}`);
  }
  if (!world) return { none: "repo không khai `stickman.world`" };
  if (st?.spec) {
    const R = world.rig;
    world = {
      ...world,
      worldOf: (_name, c) => R.buildWorld(c.scene, c.runtime, st.spec(c.id, R, c), c),
    };
  }
  if (typeof world.rig?.rolesOf !== "function")
    return { none: "`@stickman3d/rig` của repo chưa có `rolesOf` (vai trò của đồ)" };
  const runtime = castRuntime(scene, data.actions, data.characters, data.held, data.hands);
  const where = st ? "sân khấu thử" : rel(root, worldEntry(root));
  const on = worldScene(world, { id: o.scene, scene, runtime, ...data }, where);
  if (!on) return { none: `\`worldOf("${o.scene}")\` của \`stickman.world\` trả null` };
  if (on.error) fail(on.error);
  const cache = new Map();
  return {
    propsAt(t) {
      const k = +t.toFixed(4);
      if (!cache.has(k)) {
        on.scene.pose(k);
        on.scene.root.updateMatrixWorld(true);
        cache.set(k, world.rig.rolesOf(on.scene.root));
      }
      return cache.get(k);
    },
  };
}

/** Mục vai trò `role` của các vật `props`: `{ prop, index, role }` */
const entriesOf = (props, role) =>
  props.flatMap((prop) =>
    prop.roles.flatMap((r, index) => (r.role === role ? [{ prop, index, role: r }] : [])),
  );

/** Tên các vật mang vai trò `role` (không trùng) */
const carriers = (props, role) => [...new Set(entriesOf(props, role).map((e) => e.prop.name))];

/** Danh sách vật mang vai trò cho dòng lỗi */
const carrierList = (props, role) => {
  const have = carriers(props, role);
  return have.length
    ? `vật có: ${have.join(", ")}`
    : `cảnh không vật nào khai \`${role}\` (\`Item.roles\` / \`withRoles\`)`;
};

/** Giá trị cờ của slot: `none`, số, tên vật (`vật`, `vật#mục`), hay `undefined` khi không có cờ */
function flagOf(slot, o) {
  const v = slot.flag && o[slot.flag];
  if (v === undefined || v === null || v === "") return undefined;
  if (String(v) === "none") return { none: true };
  const n = String(v).split(",").map(Number);
  if (n.every(Number.isFinite)) return { numbers: n };
  return { name: String(v) };
}

/**
 * Mục của slot theo tên vật ở cờ (`vật`, `vật#mục`): tên không có, vật không mang vai trò, nhiều mục mà slot cần một là
 * lỗi kèm danh sách. Slot `per: "side"` nhận tên vật, trả mọi mục của vật ấy
 */
function namedEntries(props, slot, value, none) {
  const flag = `--${slot.flag} ${value}`;
  if (none)
    fail(
      `${flag}: là tên vật nhưng ${none} — truyền số thế giới rig thay cho tên, hay khai cảnh three có vai trò`,
    );
  const [thing, item] = value.split("#");
  if (item !== undefined && slot.per === "side")
    fail(
      `${flag}: cờ \`--${slot.flag}\` nhận tên vật, không nhận \`#mục\` — mỗi bên lấy đúng một mục \`${slot.role}\` của vật ấy`,
    );
  const same = props.filter((p) => p.name === thing);
  // vật không khai vai trò nào thì `rolesOf` không thấy: cùng một dòng với vật thiếu đúng vai trò này
  if (!same.length)
    fail(`${flag}: vật không khai vai trò \`${slot.role}\`; ${carrierList(props, slot.role)}`);
  const broken = same.filter((p) => p.errors.length);
  if (broken.length === same.length)
    fail(`${flag}: vai trò của vật \`${thing}\` hỏng — ${broken[0].errors.join("; ")}`);
  let list = entriesOf(same, slot.role);
  if (!list.length)
    fail(`${flag}: vật không khai vai trò \`${slot.role}\`; ${carrierList(props, slot.role)}`);
  if (item !== undefined) {
    const all = list;
    list = all.filter((e) => e.role.name === item);
    if (!list.length)
      fail(
        `${flag}: vật \`${thing}\` không có mục \`${item}\` của vai trò \`${slot.role}\`; có: ${all.map((e) => entryName(e.prop, e.role)).join(", ")}`,
      );
  }
  if (slot.per !== "side" && list.length > 1)
    fail(
      `${flag}: vật \`${thing}\` có ${list.length} mục \`${slot.role}\` (${list.map((e) => entryName(e.prop, e.role)).join(", ")}) — chỉ một bằng \`--${slot.flag} ${thing}#<mục>\``,
    );
  return list;
}

/**
 * Đồ ảo của cờ số (docs/13 mục 6.3): mục vai trò thế giới rig dựng trong bộ nhớ, qua đúng `RoleSchema` (`parseRoles`), rồi
 * đi chung đường với vật thật. Trả các mục `{ prop, index, role }`
 */
export function virtualEntries(name, roles) {
  const parsed = rig.parseRoles(roles);
  if (!parsed.success)
    throw new Error(`đồ ảo ${name} hỏng: ${rig.roleIssueLines(parsed.error).join("; ")}`);
  const prop = {
    name,
    virtual: true,
    local: parsed.data,
    roles: rig.placeRoles(rig.resolveRoles(parsed.data), { at: [0, 0, 0], yaw: 0, s: 1 }),
    errors: [],
  };
  return prop.roles.map((role, index) => ({ prop, index, role }));
}

/** Cùng một vật (chủ): cùng nút và cùng số thứ tự `Item` */
const sameOwner = (a, b) => a.node === b.node && a.owner === b.owner;

/**
 * Bám danh tính một mục (chủ cộng mục) qua các giây: `at(t)` là hình của chính mục ấy ở giây `t` (vật ẩn thì `undefined`),
 * `moved` là mục dời xa nhất trong `window` so với giây đầu. Vật không dời thì đọc một lần
 */
function trackEntry(e, three, window) {
  if (e.prop.virtual || !three?.propsAt) return { ...e, at: () => e.role, moved: 0 };
  const read = (t) => {
    const p = three.propsAt(t).find((q) => sameOwner(q, e.prop));
    const r = p?.roles[e.index];
    return r && r.role === e.role.role ? r : undefined;
  };
  let moved = 0;
  for (const t of sampleTimes(window[0], window[1], CLASH_EVERY)) {
    const r = read(t);
    moved = Math.max(moved, r ? roleMoved(e.role, r) : Infinity);
  }
  return { ...e, at: moved < 1e-6 ? () => e.role : read, moved };
}

/** Dòng cảnh báo khi mục bám dời quá `1` trong quãng */
const movedLine = (k, what) =>
  k.moved > 1
    ? `cảnh báo: ${what} \`${entryName(k.prop, k.role)}\` dời ${Number.isFinite(k.moved) ? r1(k.moved) : "khỏi cảnh"} trong quãng — tự kiểm đo theo chỗ của từng giây`
    : undefined;

/**
 * Ghi `action` của `stickman gen <kind>` vào `out` trừ khi tự kiểm không đạt (`failed`, `--force` thì vẫn ghi) hay chạy khô; file có sẵn chỉ đè khi
 * `note` của nó ghi chính lệnh ấy. Nối dòng kết quả vào `lines`, `hints` (bỏ qua mục rỗng) vào dòng lỗi. Trả đã ghi chưa
 */
async function emit(root, kind, o, out, action, failed, lines, hints = []) {
  if (failed && !o.force) {
    const more = hints.filter(Boolean).map((h) => `; ${h}`);
    lines.push(
      `lỗi: tự kiểm không đạt — không ghi ${rel(root, out)} (ghi kèm cảnh báo bằng --force${more.join("")})`,
    );
    return false;
  }
  if (o.dryRun) {
    lines.push(`chạy khô: không ghi ${rel(root, out)}`);
    return false;
  }
  if (existsSync(out) && !o.force) {
    const old = readJson(out);
    if (!(old.note ?? "").includes(`\`stickman gen ${kind}\``))
      fail(
        `${rel(root, out)} đã có và không phải file \`stickman gen\` sinh — đổi --name hay --force để đè`,
      );
  }
  mkdirSync(join(root, "actions"), { recursive: true });
  writeFileSync(out, await pretty(action, out));
  lines.push(
    `${failed ? "cảnh báo: tự kiểm không đạt, --force nên vẫn ghi" : "đã ghi"} ${rel(root, out)}`,
  );
  return true;
}

/** `right` / `left` của mốc `world.hands` gần nhất không sau `time` có khai `hold` (kể cả `null`) cho tay `side` */
function holdAt(hands, side, time, marks) {
  let found;
  for (const k of hands ?? []) {
    if (rig.markTime(k.t, marks) > time + 1e-9) continue;
    const h = k[side];
    if (h && typeof h === "object" && "hold" in h) found = h.hold;
  }
  return found ? rig.groupHold(found) : undefined;
}

/** Thêm một mốc `world.hands` đúng chỗ theo giây */
function insertHand(member, key, marks) {
  const hands = [...(member.world.hands ?? [])];
  const t = rig.markTime(key.t, marks);
  let i = hands.findIndex((k) => rig.markTime(k.t, marks) > t);
  if (i < 0) i = hands.length;
  hands.splice(i, 0, key);
  member.world.hands = hands;
}

/** `stage` của `preview`: theo clip nền của người ấy đang chạy ở `time` */
function stageAt(member, time, marks) {
  const names = member.tracks.flatMap((tr) =>
    tr.clips
      .filter((c) => c.action && rig.markTime(c.start ?? 0, marks) <= time)
      .map((c) => c.action),
  );
  const words = names.join("-").split("-");
  if (words.includes("seiza") || words.includes("kneel")) return "floor";
  if (words.includes("sit") || words.includes("seated")) return "chair";
  return "stand";
}

/**
 * Sinh hành động rót cho `cast` trong cảnh `scene` lúc `at` giây, đích rót ở `cup`: `<người>` (cầm món mang `vessel`),
 * `<người>:<món>`, `<món>` của `items[]`, `<vật>` của cảnh three mang `vessel`, hay `x,y,z` thế giới rig. Bình là món tay
 * phải giải phẫu đang cầm (không thì `item`, mặc định `binh`), phải mang `pourer`. `style` `single` | `serve`, `tilt` góc
 * nghiêng hết, `pourDir` hướng rót (độ, từ ra ngoài về trước), `name` tên file. `stage`: sân khấu thử (`sceneFor`). Trả
 * `{ ok, action, name, scene, checks, file, wrote, lines, ... }` (`scene` là cảnh đã có clip, `checks` dòng tự kiểm của
 * `checkRows`); sai đầu vào hay ngoài tầm thì ném `GenError`
 */
export async function genPour(o) {
  const root = resolve(o.dir ?? ".");
  const style = o.style ?? "single";
  const K0 = POUR_STYLES[style] ?? fail(`--style nhận single | serve, không phải \`${style}\``);
  const at = Number(o.at);
  if (!o.scene) fail("thiếu --scene <id cảnh>");
  if (!o.cast) fail("thiếu --cast <id người rót>");
  if (!(at >= 0)) fail("thiếu --at <giây bắt đầu rót> (số ≥ 0)");
  if (!o.cup) fail("thiếu --cup <người | người:món | món | vật | x,y,z>");
  const tiltMax = o.tilt === undefined ? K0.tilt[1] : Number(o.tilt);
  if (!(tiltMax > K0.tilt[0] && tiltMax <= 150))
    fail(`--tilt phải trong (${K0.tilt[0]}, 150], không phải \`${o.tilt}\``);
  const dir0 = o.pourDir === undefined ? K0.dir : Number(o.pourDir);
  if (!Number.isFinite(dir0)) fail(`--pour-dir phải là số độ, không phải \`${o.pourDir}\``);

  const { data, scene, member, chars, c, runtimeOf, rt0, marks } = sceneFor(root, o, at);
  const end = at + POUR_DURATION;

  // bình (slot `bottle`, `heldRight`): món tay phải giải phẫu đang cầm, không thì `--item`; vật rót đọc từ vai trò `pourer`
  const K = { ...K0, tilt: [K0.tilt[0], tiltMax] };
  let hold = holdAt(member.world.hands, "right", at, marks);
  const holdFromScene = !!hold;
  const itemName = hold?.item ?? o.item ?? "binh";
  const base = rig.heldBase(itemName);
  const bottle = data.held[base] ?? fail(`không có held/${base}.json`);
  if (hold && !hold.keep)
    fail(
      `chỗ cầm tay phải của \`${o.cast}\` ở giây ${at} là ${JSON.stringify(hold)} — bộ rót cần \`keep: true\` (bình theo cổ tay của hành động)`,
    );
  let pour;
  try {
    pour = pourerOf(bottle, { k: K, dims: handOf(c), part: hold?.part, name: base });
  } catch (e) {
    fail(e.message);
  }
  if (!hold)
    hold = pourHold(K, itemName, { part: pour.part, along: POUR_ALONG, around: pour.around });

  // đích rót theo thời gian, thế giới rig
  let three;
  const threeOf = async () => (three ??= await sceneThree(root, o, scene, data));
  const cup = await cupTarget(o.cup, { scene, rt: rt0, data, chars, at, end, marks, threeOf });

  const name = o.name ?? `pour${style === "serve" ? "-serve" : ""}-${o.scene}-${o.cast}-3d`;
  /** Cảnh có clip rót `name` (`withClip` tắt: chỉ chèn chỗ cầm — cảnh "trước" để so `check`) */
  const sceneWith = (withClip) => {
    const sc = structuredClone(scene);
    const m = sc.cast.find((x) => x.id === o.cast);
    // sinh lại: clip của chính hành động này đã dán trong cảnh thì bỏ, kẻo chạy chồng hai bản
    for (const tr of m.tracks) tr.clips = tr.clips.filter((k) => k.action !== name);
    m.tracks = m.tracks.filter((tr) => tr.clips.length);
    if (withClip) m.tracks.push({ name: "gen", clips: [{ action: name, start: at }] });
    // chưa khai thì cầm từ đầu cảnh: `check` không báo món nhảy vào tay giữa chừng
    if (!holdFromScene) insertHand(m, { t: 0, right: { hold } }, marks);
    // qua zod lần nữa cho clip và mốc vừa chèn nhận mặc định (`phase`, `ease`…)
    const r = rig.parseScene(sc);
    if (!r.success) fail(`cảnh thêm clip rót không qua zod: ${r.error.issues?.[0]?.message}`);
    return r.data;
  };
  const h = c.rig.height;
  // đo trên người: điểm rót là `lip`, trục bình là trục món, vòi là `spout` đã giải (khung món)
  const probe = (rt, t) => {
    const sp = rig.sceneAt(rt, o.cast, t, h, rt.bodies[o.cast]);
    const P = rig.actPalms(c, sp)?.R;
    const H = rig.actHeld(c, sp).R;
    const arm = rig.actArm(c, sp, -1);
    if (!P || !H || !arm) return undefined;
    const Rr = rigRot(H.R);
    const s = sp.world.s;
    const chest = rig.bodyMarkAt(c, sp, { to: "chest" }, "R");
    const body = (v) => [dot(v, P.forward), v[1], dot(v, P.out)];
    return {
      sp,
      s,
      mouth: add(H.at, mul(matVec(Rr, pour.lip), s)),
      grip: rigOf(arm.grip),
      palm: P.palm,
      finger: P.finger,
      axis: matVec(Rr, pour.axis),
      spout: matVec(Rr, pour.spout),
      /** điểm thế giới → hệ thân `[tiến, y xuống, ra ngoài]` so với mốc `chest`, đơn vị rig */
      toBody: (p) => body(mul(sub(p, chest), 1 / s)),
      dirBody: body,
      shoulder: rigOf(arm.S),
    };
  };
  const contactTimes = sampleTimes(
    at + POUR_T.at * POUR_DURATION,
    at + POUR_T.back * POUR_DURATION,
  );
  const build = (lip, dir, link) =>
    rig.parseAction({
      schemaVersion: rig.ACTION_VERSION,
      ...pourAction({ ...K, dir, lip }, link, { name }),
    }).data;
  const runWith = (action) => runtimeOf(sceneWith(true), { ...data.actions, [name]: action });

  // 1. ước lượng `lip` từ cảnh chưa có hành động, 2. đo liên kết tay–bình trên chính người này, 3. dời `lip` tới khi điểm
  // rót trùng đích; mỗi hướng rót một lượt
  const lipGuess = () => {
    const pts = [];
    for (const t of contactTimes) {
      const sp = rig.sceneAt(rt0, o.cast, t, h, rt0.bodies[o.cast]);
      const P = rig.actPalms(c, sp)?.R;
      const target = cup.at(t);
      if (!P || !target) continue;
      const chest = rig.bodyMarkAt(c, sp, { to: "chest" }, "R");
      const d = mul(sub(target, chest), 1 / sp.world.s);
      pts.push([dot(d, P.forward), d[1], dot(d, P.out)]);
    }
    if (!pts.length) fail("không đo được đích rót trong quãng rót");
    return pts.reduce((a, b) => add(a, b)).map((v) => v / pts.length);
  };
  const measureLink = (rt) => {
    const t = at + ((POUR_T.full + POUR_T.hold) / 2) * POUR_DURATION;
    const p = probe(rt, t) ?? fail(`không đo được bình trong tay \`${o.cast}\` ở giây ${sec(t)}`);
    const up = (v) => flip(p.dirBody(v));
    return linkFrom({
      palm: up(p.palm),
      fingers: up(p.finger),
      axis: up(p.axis),
      spout: up(p.spout),
      v: flip(p.dirBody(mul(sub(p.mouth, p.grip), 1 / p.s))),
    });
  };
  const solve = (dir, link, lip0) => {
    let lip = lip0;
    let best;
    for (let i = 0; i < LIP_ROUNDS; i++) {
      const action = build(lip, dir, link);
      const rt = runWith(action);
      const es = [];
      for (const t of contactTimes) {
        const p = probe(rt, t);
        const target = cup.at(t);
        if (!p || !target) continue;
        es.push(p.dirBody(mul(sub(target, p.mouth), 1 / p.s)));
      }
      if (!es.length) fail("không đo được điểm rót của bình trong quãng rót");
      const mean = es.reduce((a, b) => add(a, b)).map((v) => v / es.length);
      const err = Math.max(...es.map(len));
      // vòng mới không bớt được ≥ 30 % sai số thì dừng (tay không với tới thì dời `lip` không cứu được), giữ vòng tốt nhất
      const stale = best && err > 0.7 * best.err;
      if (!best || err < best.err) best = { lip, action, rt, err };
      if (stale) break;
      // sai số trung bình là phần dời được; phần còn lại là điểm rót lắc giữa hai mốc
      if (len(mean) < LIP_EPS) break;
      lip = add(lip, mean);
    }
    return best;
  };
  /** Hình chiếu của điểm rót lên mặt miệng cách tâm miệng bao xa (đích là vật đựng) */
  const offMouth = (rt, t) => {
    const m = cup.mouthAt?.(t);
    const p = probe(rt, t)?.mouth;
    if (!m || !p) return undefined;
    const q = sub(p, m.at);
    return len(sub(q, mul(m.dir, dot(q, m.dir))));
  };
  const checksOf = (rt) => {
    const rows = coreChecks(rt, chars, {
      id: o.cast,
      side: "right",
      window: [at, end],
      contact: {
        from: contactTimes[0],
        to: contactTimes.at(-1),
        label: "điểm rót của bình trên đích rót",
        target: (t) => cup.at(t),
        probe: (t) => probe(rt, t)?.mouth,
      },
      monotone: [
        {
          from: at + POUR_T.at * POUR_DURATION,
          to: at + POUR_T.full * POUR_DURATION,
          label: "nâng đuôi bình",
        },
        {
          from: at + POUR_T.hold * POUR_DURATION,
          to: at + POUR_T.back * POUR_DURATION,
          label: "dựng lại",
        },
      ],
    });
    // điểm rót trong miệng: chỉ khi đích là vật đựng; cảnh báo, không chặn
    if (cup.mouthAt) {
      let worst = { d: 0, t: contactTimes[0], r: cup.mouthAt(contactTimes[0])?.r ?? 0 };
      let first = true;
      for (const t of contactTimes) {
        const d = offMouth(rt, t);
        const r = cup.mouthAt(t)?.r ?? 0;
        if (d !== undefined && (first || d - r > worst.d - worst.r)) worst = { d, t, r };
        if (d !== undefined) first = false;
      }
      const out = worst.d > worst.r;
      rows.push({
        rule: "mouth",
        level: out ? "cảnh báo" : "ok",
        worst: r2(Math.max(0, worst.d)),
        t: worst.t,
        limit: `≤ r ${r1(worst.r)}`,
        msg: out
          ? `điểm rót ra ngoài miệng ${cup.label}: cách tâm miệng ${r2(worst.d)} ở giây ${sec(worst.t)}`
          : `điểm rót trong miệng (cách tâm nhiều nhất ${r2(Math.max(0, worst.d))})`,
      });
    }
    return rows;
  };

  const lip0 = lipGuess();
  const first = solve(
    dir0,
    measuredLink({ gripR: pour.gripR, mouth: pour.mouth, around: hold.around ?? pour.around }),
    lip0,
  );
  const link = measureLink(first.rt);
  const tried = [];
  let best;
  for (const d of DIR_TRIES) {
    const dir = dir0 + d;
    const s = solve(dir, link, best?.lip ?? first.lip);
    const core = checksOf(s.rt);
    const bad = core.filter((r) => r.level === "lỗi");
    tried.push({ dir, bad: bad.map((r) => r.msg) });
    if (!best || bad.length < best.bad.length) best = { ...s, dir, core, bad };
    if (!bad.length) break;
    // ngoài tầm thì không hướng nào cứu được
    if (bad.some((r) => r.rule === "reach")) break;
  }
  const lipRound = best.lip.map(r1);
  if (
    best.bad.some((r) => r.rule === "reach" || (r.rule === "contact" && best.err > rig.AIM_GAP))
  ) {
    const p = probe(best.rt, best.core.find((r) => r.rule === "reach")?.t ?? contactTimes[0]);
    fail(outOfReach(o, p, cup, best.core, lip0.map(r1)));
  }

  // kiểm trên cảnh three của repo (hay sân khấu thử): so với chính cảnh ấy chưa có clip (chỗ cầm chèn vào cả hai)
  const world = await worldChecks({
    dir: root,
    before: sceneWith(false),
    after: sceneWith(true),
    actions: { [name]: best.action },
    ...(o.stage && { spec: o.stage.spec, held: o.stage.held }),
  });
  const ignore = softRow({
    id: o.cast,
    bottle: hold.item,
    cup,
    holdFromScene,
    window: [
      at + POUR_T.over * POUR_DURATION - CLASH_EVERY,
      at + POUR_T.lift * POUR_DURATION + CLASH_EVERY,
    ],
  });
  const failed = checkFailed(best.core, world, ignore);
  const table = checkTable(best.core, world, ignore);
  const selfClash = world.rows.some((r) => !ignore(r) && r.group === "clash");

  const chosen = o.pourDir === undefined ? "mặc định" : "đã chọn";
  const dirNote =
    best.dir === dir0
      ? `${best.dir}° (${chosen})`
      : `${best.dir}° — ${chosen} ${dir0}° không đạt (${tried[0].bad.join("; ")}), ${best.bad.length ? "không hướng lân cận nào đạt, giữ hướng ít lỗi nhất" : "hướng gần nhất làm được"}`;
  const cupNote = `${cup.label}, hệ thân so với mốc \`chest\` của người rót [${lipRound.join(", ")}]`;
  const holdJson = JSON.stringify(hold);
  const note =
    `Rót ${style === "serve" ? "mời khách hai tay" : "một tay"} sinh bằng \`stickman gen pour\` cho cảnh \`${o.scene}\`, người \`${o.cast}\` từ giây ${at}: đích rót ${cupNote}; hướng rót ${best.dir}°, bình nghiêng ${K.tilt[0]} → ${K.tilt[1]}°; ${POUR_TIMING}. ` +
    `Ghi ${K.support ? "hai tay" : "tay phải"}, \`hand\`, \`torso\`; \`sides: "anatomical"\`; món ở \`world.hands[].hold\` tay phải: ${holdJson}. ` +
    `Cốc hay người rót đổi chỗ thì sinh lại, không sửa tay.`;
  const preview = { stage: stageAt(member, at, marks), hold: { right: hold } };
  const action = rig.parseAction({
    schemaVersion: rig.ACTION_VERSION,
    ...pourAction({ ...K, dir: best.dir, lip: best.lip }, link, { name, note, preview }),
  }).data;

  const out = join(root, "actions", `${name}.json`);
  const lines = [
    `pour ${style}: cảnh ${o.scene}, ${o.cast} rót từ giây ${at} (sự kiện \`pour\` ${sec(at + POUR_T.full * POUR_DURATION)} s), đích rót: ${cupNote}`,
    `bình \`${base}\` (vai trò \`pourer\`): điểm rót [${pour.lip.map(r1).join(", ")}], hướng rót [${pour.spout.map(r2).join(", ")}], phần cầm \`${pour.part}\`, along ${hold.along ?? POUR_ALONG}, around ${r1(hold.around ?? pour.around)}`,
    `hướng rót ${dirNote}; nghiêng ${K.tilt[0]} → ${K.tilt[1]}°; chỗ cầm ${holdFromScene ? "của cảnh" : "mặc định (cảnh chưa khai)"}: ${holdJson}`,
    `điểm rót đo trên người rót còn lệch đích ${r2(best.err)} sau khi dời \`lip\``,
    ...pour.warnings.map((w) => `cảnh báo: \`${base}\`: ${w}`),
    ...(cup.notes ?? []),
    "tự kiểm:",
    table,
  ];
  if (cup.moved > rig.HELD_TOUCH)
    lines.push(`cảnh báo: đích rót dời ${r1(cup.moved)} trong quãng rót — rót theo chỗ trung bình`);
  const snippet = {
    clip: { action: name, start: at },
    ...(!holdFromScene && { hand: { t: 0, right: { hold } } }),
  };
  const reach = best.core.find((r) => r.rule === "reach");
  const wrote = await emit(root, "pour", o, out, action, failed, lines, [
    selfClash && `tay lấn thân hay đồ thì thử --pour-dir khác ${best.dir} hay --tilt nhỏ hơn`,
    best.bad.some((r) => r.rule === "contact") &&
      reach?.worst > 0 &&
      `gần hết tầm với (bàn tay còn cách đích ${reach.worst}): dời người rót lại gần cốc`,
  ]);
  lines.push(
    `dán vào track của \`${o.cast}\`: ${JSON.stringify(snippet.clip)}` +
      (snippet.hand
        ? `\nvà vào \`world.hands\` của \`${o.cast}\`: ${JSON.stringify(snippet.hand)}`
        : ""),
  );
  return {
    ok: !failed,
    wrote,
    file: rel(root, out),
    action,
    lip: lipRound,
    dir: best.dir,
    tried,
    core: best.core,
    world,
    snippet,
    pourer: pour,
    name,
    scene: sceneWith(true),
    checks: checkRows(best.core, world, ignore),
    lines,
    text: lines.join("\n"),
  };
}

/** Vật đựng của món `spec` (đã `parseHeldItem`): mục `vessel` khai hay suy (`heldRoles`), hay `undefined` */
const vesselOf = (spec) => spec && rig.heldRoles(spec).roles.find((r) => r.role === "vessel");

/**
 * Đích rót theo thời gian (slot `cup`, `point: true`): `{ at(t) → V3 | undefined, mouthAt?(t) → { at, dir, r }, label,
 * moved, holder?, hand?, item?, notes? }`. Điểm `x,y,z` không có miệng; vật đựng (món trong tay người, món của `items[]`,
 * vật của cảnh three) lấy tâm miệng `mouth.at` của vai trò `vessel`. `moved` là đích dời bao nhiêu trong quãng rót;
 * `holder` người cầm cốc, `hand` `R` | `L` tay cầm, `item` tên món hay vật
 */
async function cupTarget(spec, { scene, rt, data, chars, at, end, marks, threeOf }) {
  const nums = String(spec).split(",").map(Number);
  if (nums.length === 3 && nums.every(Number.isFinite))
    return { at: () => nums, label: `điểm thế giới [${nums.join(", ")}]`, moved: 0 };
  const [who, want] = String(spec).split(":");
  const recv = scene.cast.find((m) => m.id === who);
  const tFull = at + POUR_T.full * POUR_DURATION;
  /** Món mang `vessel` trong cảnh (tay người ở giây rót, `items[]`) và vật cảnh three mang `vessel`, cho dòng lỗi */
  const vesselList = async () => {
    const names = new Set();
    for (const m of scene.cast)
      for (const side of ["right", "left"]) {
        const k = m.world && holdAt(m.world.hands, side, tFull, marks);
        if (k && vesselOf(data.held[rig.heldBase(k.item)])) names.add(`${m.id}:${k.item}`);
      }
    for (const k of scene.items ?? [])
      if (vesselOf(data.held[rig.heldBase(k.item)])) names.add(k.item);
    const three = await threeOf();
    if (!three.none) for (const n of carriers(three.propsAt(at), "vessel")) names.add(n);
    return names.size
      ? `món, vật mang \`vessel\`: ${[...names].join(", ")}`
      : 'cảnh không món, vật nào mang `vessel` — khai `roles: [{ role: "vessel", mouth: … }]` cho món, hay rót vào điểm x,y,z';
  };
  /** Đích từ miệng `m` (khung món) qua phép đặt món ở giây `t` (`P`, `R` thế giới rig, cỡ `s`) */
  const mouthWorld = (m, place) => ({
    at: add(place.P, mul(matVec(place.R, m.mouth.at), place.s)),
    dir: matVec(place.R, m.mouth.dir),
    r: m.mouth.r * place.s,
  });
  let mouthAt;
  let label;
  let holder;
  let hand;
  let cupItem;
  const notes = [];
  if (recv) {
    if (!recv.world) fail(`\`${who}\` không phải người 3D`);
    const c = chars[who];
    const picks = [];
    const holding = [];
    for (const side of ["right", "left"]) {
      const k = holdAt(recv.world.hands, side, tFull, marks);
      if (!k) continue;
      holding.push(k.item);
      if (want && k.item !== want && rig.heldBase(k.item) !== want) continue;
      const v = vesselOf(data.held[rig.heldBase(k.item)]);
      if (v) picks.push({ side, item: k.item, v });
    }
    if (!picks.length)
      fail(
        want
          ? holding.some((x) => x === want || rig.heldBase(x) === want)
            ? `--cup ${spec}: món \`${want}\` không mang vai trò \`vessel\`; ${await vesselList()}`
            : `\`${who}\` không cầm \`${want}\` trong quãng rót (giây ${at}–${sec(end)})`
          : `--cup ${spec}: \`${who}\` không cầm món mang \`vessel\` trong quãng rót${holding.length ? ` (đang cầm ${holding.join(", ")})` : ""}; ${await vesselList()}`,
      );
    if (picks.length > 1)
      notes.push(
        `\`${who}\` cầm món mang \`vessel\` ở cả hai tay: lấy tay phải (\`${picks[0].item}\`)`,
      );
    const p = picks[0];
    const tag = p.side === "right" ? "R" : "L";
    const h = c.rig.height;
    mouthAt = (t) => {
      const sp = rig.sceneAt(rt, who, t, h, rt.bodies[who]);
      const H = rig.actHeld(c, sp)[tag];
      return H && mouthWorld(p.v, { P: H.at, R: rigRot(H.R), s: H.s });
    };
    label = `\`${who}\` cầm ${p.item} tay ${p.side === "right" ? "phải" : "trái"} (miệng vai trò \`vessel\`)`;
    holder = who;
    hand = tag;
    cupItem = p.item;
  } else if (scene.items?.some((k) => k.item === spec)) {
    const held = data.held[rig.heldBase(spec)] ?? fail(`không có held/${rig.heldBase(spec)}.json`);
    const v = vesselOf(held);
    if (!v) fail(`--cup ${spec}: món không mang vai trò \`vessel\`; ${await vesselList()}`);
    mouthAt = (t) => {
      const p = rig.itemAt(rt, spec, t, { chars });
      return p && mouthWorld(v, p);
    };
    label = `món \`${spec}\` của \`items[]\` (miệng vai trò \`vessel\`)`;
    cupItem = spec;
  } else {
    const three = await threeOf();
    const props = three.none ? [] : three.propsAt(at);
    if (three.none || !props.some((p) => p.name === spec.split("#")[0]))
      fail(
        `--cup \`${spec}\` không phải người trong cảnh, món ở \`items[]\`, vật của cảnh three hay điểm x,y,z; ${await vesselList()}`,
      );
    const [e] = namedEntries(props, { role: "vessel", flag: "cup" }, spec);
    const k = trackEntry(e, three, [
      at + POUR_T.at * POUR_DURATION,
      at + POUR_T.back * POUR_DURATION,
    ]);
    mouthAt = (t) => k.at(t)?.mouth;
    label = `vật \`${entryName(e.prop, e.role)}\` của cảnh three (miệng vai trò \`vessel\`)`;
    cupItem = e.prop.name;
  }
  const fn = (t) => mouthAt(t)?.at;
  const pts = sampleTimes(at + POUR_T.at * POUR_DURATION, at + POUR_T.back * POUR_DURATION)
    .map(fn)
    .filter(Boolean);
  const mean = pts.length ? pts.reduce((a, b) => add(a, b)).map((v) => v / pts.length) : null;
  const moved = mean ? Math.max(...pts.map((p) => len(sub(p, mean)))) : 0;
  return { at: fn, mouthAt, label, moved, holder, hand, item: cupItem, notes };
}

/** Luật `held` thuộc chỗ cầm và nhóm cầm, hành động không đổi được: chỉ báo, không chặn */
const HOLD_RULES = new Set([
  "pose",
  "pierce",
  "loose",
  "grip",
  "up",
  "face",
  "role",
  "oppose",
  "sink",
  "rest",
  "size",
]);

/**
 * Dòng `check` chỉ báo chứ không chặn ghi: luật `held` về độ ôm của chỗ cầm (`HOLD_RULES`); bình chưa `provide` hay nhảy
 * vào tay khi cảnh chưa khai `hold` (việc của cảnh); bình lấn bàn tay đang cầm cốc và bàn tay cầm bình lấn cốc khi mọi
 * quãng lấn nằm trong `window` (bình ở trên cốc) — chỗ tiếp xúc của chính động tác rót. Cẳng tay, thân, đầu người cầm cốc,
 * thân người rót, người khác, đồ khối, hay lấn ngoài quãng ấy thì chặn
 */
function softRow({ id, bottle, cup, holdFromScene, window }) {
  const holder = cup.holder;
  const inWindow = (spans) =>
    spans.split(", ").every((s) => {
      const [a, b = a] = s.split("–").map(Number);
      return a >= window[0] && b <= window[1];
    });
  return (r) => {
    const rule = /^held:([a-z]+)\|([^|]*)\|/.exec(r.key ?? "");
    if (rule) {
      if (HOLD_RULES.has(rule[1])) return true;
      if (!holdFromScene && (rule[1] === "provide" || rule[1] === "jump") && rule[2] === id)
        return true;
      return false;
    }
    if (r.group !== "clash") return false;
    const m = /— ([^\s.]+)\.(\S+) ↔ (\S+) lấn [\d.]+ ở giây [\d.]+ · giây (.*)$/.exec(r.msg);
    if (!m || !inWindow(m[4])) return false;
    const [, who, part, thing] = m;
    if (holder && who === holder && part === `hand${cup.hand}` && thing === bottle) return true;
    if (who === id && part === "handR" && cup.item && thing === cup.item) return true;
    return false;
  };
}

/** Dòng lỗi ngoài tầm kèm gợi ý theo chỗ cốc so với vai người rót */
function outOfReach(o, p, cup, core, lip) {
  const reach = core.find((r) => r.rule === "reach");
  const contact = core.find((r) => r.rule === "contact");
  const gap = reach?.level === "lỗi" ? reach.worst : contact?.worst;
  const t = reach?.level === "lỗi" ? reach.t : contact?.t;
  const hints = [];
  if (p) {
    const target = cup.at(t);
    if (target) {
      const d = sub(p.toBody(target), p.toBody(p.shoulder));
      const [fwd, down, out] = d.map(r1);
      if (down < -10) hints.push(`cốc cao hơn vai ${-down}: hạ cốc hay cho người rót ngồi thấp`);
      if (fwd > 0) hints.push(`cốc ở trước vai ${fwd}: dời người rót lại gần ~${r1(gap)}`);
      if (Math.abs(out) > 25)
        hints.push(
          `cốc lệch ${Math.abs(out)} về bên ${out > 0 ? "phải" : "trái"} người rót: xoay người rót về phía cốc`,
        );
    }
  }
  return (
    `ngoài tầm: ${o.cast} không với tới miệng cốc ở giây ${sec(t)} — còn cách ${r1(gap)} (miệng cốc ở hệ thân so với \`chest\` [${lip.join(", ")}]). ` +
    (hints.length ? `Gợi ý: ${hints.join("; ")}.` : "Dời cốc hay người rót lại gần.") +
    " Không ghi file."
  );
}

/** Tên chân, lưng, tay cho dòng in và `note` */
const LEG_LABEL = {
  bent: "chân co (bàn chân lùi dưới mép ghế, gót nhấc)",
  square: "chân vuông góc (ống chân đứng)",
  straight: "chân duỗi (cẳng chân đưa ra trước, gót trên sàn)",
  staggered: "chân so le",
};
/** Tên ngắn của kiểu chân trong dòng in */
const LEG_WORD = { bent: "co", square: "vuông", straight: "duỗi" };
const BACK_LABEL = {
  upright: "lưng thẳng",
  recline: "tựa ra sau",
  forward: "nghiêng về trước",
};
const HAND_LABEL = {
  thighs: "hai tay úp trên đùi",
  table: "hai tay đặt trên bàn",
  armrest: "hai khuỷu, cẳng tay trên tay vịn",
  fold: "khuỷu trên tay vịn, hai bàn tay chồng trước bụng",
};
/** Lòng tay trên mặt bàn: khe từ điểm thấp nhất của bàn tay tới mặt trong tầm này */
const HAND_REST = [-2, 4];
/** Giữa lòng tay trên đùi: khe tới mặt đùi trong `range`, lòng tay lệch khỏi pháp tuyến mặt đùi không quá `angle` độ */
const PALM_THIGH = { range: [-3, 3], angle: 30 };
/** Điểm thấp nhất của lòng tay đặt trên mặt bàn cao hơn mặt ngần này (rig, nhân `s`) */
const HAND_LIFT = 0.3;
/** Lòng tay trên đùi lùi về phía hông tới ngần này khi tay không với tới (dời khỏi mốc `thigh`) */
const THIGH_REACH_MIN = -24;
/** Lòng tay trên đùi ra ngoài thêm tới ngần này, rồi về phía gối thêm tới `THIGH_AHEAD_MORE`, khi cẳng tay lấn bụng */
const THIGH_OUT_MORE = 16;
const THIGH_AHEAD_MORE = 24;
/**
 * Tay trên bàn: giữa lòng tay vào trong mép bàn ngần này (rig ở `height` 1), xa thêm tới `TABLE_DEEP`; không với tới thì
 * sát mép tới `TABLE_IN_MIN`
 */
const TABLE_IN = 14;
const TABLE_IN_MIN = 6;
const TABLE_DEEP = 40;
/** Tay trên bàn trước vai, khép vào phần này bề rộng vai; cánh tay lấn ngực thì dang dần ra */
const TABLE_SPREAD = [0.8, 0.95, 1.1];
/** Khuỷu tay trên bàn gập ít nhất ngần này (độ, `0` là tay thẳng): ít hơn là tay duỗi chống bàn */
const ELBOW_BEND = 40;
/** Khuỷu tay trên bàn cao hơn cổ tay ngần này (rig, nhân `s`) — như `handsOn` */
const ELBOW_LIFT = 3;
/** Chân thõng: ống chân cách mép trước mặt ngồi thêm ngần này ngoài bán kính ở gối (rig, nhân `s`; ống quần, khối ghế) */
const DANGLE_EDGE = 4;
/** Đế giày trên mặt đỡ: lún tới ngần này (góc làm tròn `0,1°`) */
const SOLE_SINK = 0.5;
/**
 * Luật mặt ngồi (docs/13 mục 3.3, nhân `s`): điểm ngồi lệch mặt ngồi quá `warn` là cảnh báo, từ `error` là lỗi; hình chiếu
 * nới `grow` quanh mép; đuôi mông ra ngoài mép sau mà cách mặt lưng ghế quá `touch` là lỗi (không chạm lưng ghế)
 */
const SEAT_RULE = { warn: 1, error: 3, grow: 2, touch: 2 };
/** Ngồi nông: hông tới mép trước dưới phần này của đùi (`RIG.thigh · hs`) là cảnh báo */
const SHALLOW = 1 / 3;
/** Đuôi mông: khối thân ở tầm hông, tới phần này chiều dài thân trên hông */
const TAIL_SPAN = [0, 0.05, 0.1];
/** Bàn trước mặt (`ahead`, rig ở `height` 1): mép gần trước hông dưới `near`, mặt trên cao hơn mặt ngồi `up`, dò ngang `across` */
const AHEAD = { near: 150, up: [20, 90], across: [-20, -10, 0, 10, 20] };
/** Thanh để chân: `sâu` dưới ngần này (nhân `s`) là thanh, rộng hơn là bệ */
const FOOT_BAR = 40;
/** Đồ ảo của cờ số (docs/13 mục 6.3, rig ở `height` 1): bàn, tay vịn, lưng ghế, bệ để chân */
const VIRTUAL = {
  table: { near: 80, deep: 90, wide: 220, thick: 6 },
  armrest: { back: 110, width: 12 },
  backrest: { from: 24, to: 80, width: 200 },
  footrest: { size: 400 },
};

/**
 * Sinh dáng ngồi nền cho `cast` trong cảnh `scene` từ giây `at`, theo đúng mặt ngồi, sàn, cỡ người của cảnh: `legs`
 * `bent` | `square` | `straight` | `staggered` (chân `tuck` co, chân kia duỗi), `feet` `free` | `floor` (không chạm được thì
 * chân thõng hay lỗi; hông không dời), `back` `upright` | `recline` | `forward`, `hands` `thighs` | `table` | `armrest` |
 * `fold` (`elbow` dời khuỷu dọc tay vịn, `top` bàn tay nằm trên). Đồ tìm theo vai trò (slot của `GEN_KINDS.sit`): mặt ngồi dưới hông, lưng ghế,
 * tay vịn, để chân của cùng ghế, bàn trước mặt; `table`, `armrest`, `backrest`, `footrest` là tên vật (`vật`, `vật#mục`)
 * của cảnh three, số thế giới rig (đồ ảo) hay `none`. `stage`: sân khấu thử (`sceneFor`). Trả như `genPour`; sai đầu vào
 * hay không ngồi được thì ném `GenError`
 */
export async function genSit(o) {
  const root = resolve(o.dir ?? ".");
  const legs = o.legs ?? "square";
  const back = o.back ?? "upright";
  const hands = o.hands ?? "thighs";
  const tuck = o.tuck ?? "far";
  const feet = o.feet ?? "free";
  const top = o.top ?? "near";
  const onArmrest = hands === "armrest" || hands === "fold";
  if (!LEG_KINDS.includes(legs))
    fail(`--legs nhận ${LEG_KINDS.join(" | ")}, không phải \`${legs}\``);
  if (!BACK_KINDS.includes(back))
    fail(`--back nhận ${BACK_KINDS.join(" | ")}, không phải \`${back}\``);
  if (!HAND_KINDS.includes(hands))
    fail(`--hands nhận ${HAND_KINDS.join(" | ")}, không phải \`${hands}\``);
  if (!["near", "far"].includes(tuck)) fail(`--tuck nhận near | far, không phải \`${tuck}\``);
  if (o.tuck !== undefined && legs !== "staggered")
    fail(`--tuck chỉ đi với --legs staggered (chân co là chân nào), không với \`${legs}\``);
  if (!FEET_KINDS.includes(feet))
    fail(`--feet nhận ${FEET_KINDS.join(" | ")}, không phải \`${feet}\``);
  if (!TOP_KINDS.includes(top)) fail(`--top nhận ${TOP_KINDS.join(" | ")}, không phải \`${top}\``);
  if (o.top !== undefined && hands !== "fold")
    fail(`--top chỉ đi với --hands fold (bàn tay nào nằm trên), không với \`${hands}\``);
  const elbowAt = o.elbow === undefined ? 0 : Number(o.elbow);
  if (!Number.isFinite(elbowAt))
    fail(`--elbow phải là số (rig, dương ra trước), không phải \`${o.elbow}\``);
  if (o.elbow !== undefined && !onArmrest)
    fail(`--elbow chỉ đi với --hands armrest | fold (khuỷu trên tay vịn), không với \`${hands}\``);
  const at = o.at === undefined ? 0 : Number(o.at);
  if (!o.scene) fail("thiếu --scene <id cảnh>");
  if (!o.cast) fail("thiếu --cast <id người ngồi>");
  if (!(at >= 0)) fail(`--at phải là số giây ≥ 0, không phải \`${o.at}\``);
  const SLOTS = Object.fromEntries(GEN_KINDS.sit.roles.map((k) => [k.slot, k]));
  const flags = Object.fromEntries(
    Object.values(SLOTS).map((k) => [k.slot, k.flag ? flagOf(k, o) : undefined]),
  );
  const needed = (k) =>
    k.need === "always" ||
    (typeof k.need === "object" &&
      Object.entries(k.need).every(([p, v]) => [v].flat().includes({ hands }[p])));
  for (const k of Object.values(SLOTS))
    if (flags[k.slot]?.none && needed(k))
      fail(`--${k.flag} none: --hands ${hands} cần ${ROLE_LABEL[k.role]} (vai trò \`${k.role}\`)`);

  const { data, scene, member, chars, c, runtimeOf, rt0 } = sceneFor(root, o, at);
  const marks = rt0.marks;
  const h = c.rig.height;
  const sp0 = rig.sceneAt(rt0, o.cast, at, h, rt0.bodies[o.cast]);
  const W = sp0.world;
  if (!W?.seated)
    fail(
      `\`${o.cast}\` không ngồi ở giây ${at}: khai \`world.sit\` (hay mốc \`sit\` của \`world.path\`) cho giây ấy`,
    );
  const s = W.s;
  const hs = h * s;
  const legHalf = rt0.bodies[o.cast].legHalf;
  const fr = frameOf(W.hip, W.yaw);
  /** Điểm ngồi (docs/13 mục 6.6) so với hông (lên dương), và thế giới */
  const seatUp = -legHalf * s;
  const seatY = W.hip[1] + legHalf * s;
  const sitAt = [W.hip[0], seatY, W.hip[2]];
  const window0 = [at, Math.min(at + SIT_DURATION, rt0.duration)];

  // đồ của cảnh theo vai trò ở giây `at`; cờ tên vật cần cảnh three, cờ số là đồ ảo
  const three = await sceneThree(root, o, scene, data);
  const props = three.none ? [] : three.propsAt(at);
  const used = {};
  const slotLines = [];
  /** Mục của cờ (tên vật hay đồ ảo) cho slot, hay `undefined` khi cờ không có / `none` */
  const fromFlag = (k, virtual) => {
    const f = flags[k.slot];
    if (!f || f.none) return undefined;
    if (f.numbers) return { list: virtual(f.numbers), how: "số" };
    return { list: namedEntries(props, k, f.name, three.none), how: "cờ" };
  };
  const track = (e) => trackEntry(e, three, window0);
  const skip = (k, why) => slotLines.push(`${ROLE_LABEL[k.role]}: ${why}`);

  // mặt ngồi (`underHip`): mặt chứa hình chiếu điểm ngồi (nới `2 · s`), lệch độ cao dưới `3 · s`
  let seat;
  {
    const k = SLOTS.seat;
    const under = entriesOf(props, "seat").filter((e) =>
      rectHolds(e.role, sitAt, SEAT_RULE.grow * s),
    );
    const near = under.filter((e) => Math.abs(sitAt[1] - e.role.at[1]) < SEAT_RULE.error * s);
    if (near.length > 1)
      fail(
        `mặt ngồi chồng nhau dưới \`${o.cast}\`: ${near.map((e) => `\`${entryName(e.prop, e.role)}\``).join(", ")} — sửa vai trò`,
      );
    if (!near.length && under.length) {
      const e = under.sort(
        (a, b) => Math.abs(sitAt[1] - a.role.at[1]) - Math.abs(sitAt[1] - b.role.at[1]),
      )[0];
      const dy = sitAt[1] - e.role.at[1];
      fail(
        `người ${dy < 0 ? "lơ lửng trên" : "lún"} mặt ngồi \`${entryName(e.prop, e.role)}\` ${comma(Math.abs(dy))} (quá ${comma(SEAT_RULE.error * s)}): đặt điểm ngồi \`world.at[1]\` (hay mốc \`sit\` của \`path\`) = ${comma(e.role.at[1])}. Không ghi file.`,
      );
    }
    if (near.length) {
      seat = track(near[0]);
      used.seat = seat;
    } else
      skip(
        k,
        three.none
          ? `không có (${three.none}): mặt ngang qua điểm ngồi, không kiểm mép`
          : "không có mặt ngồi khai vai trò: không kiểm mép",
      );
  }
  /** Mục của cùng chủ với mặt ngồi, vai trò `role`, đúng phía `ok(role)` */
  const sameAsSeat = (k, ok) => {
    if (!seat) return [];
    const list = entriesOf(props, k.role).filter((e) => sameOwner(e.prop, seat.prop) && ok(e.role));
    return list;
  };
  const one = (k, list) => {
    if (list.length > 1)
      fail(
        `${ROLE_LABEL[k.role]} của \`${seat.prop.name}\` có ${list.length} mục đúng phía (${list.map((e) => `\`${entryName(e.prop, e.role)}\``).join(", ")}) — chỉ một bằng --${k.flag} ${seat.prop.name}#<mục>`,
      );
    return list[0];
  };

  // mặt đỡ bàn chân: để chân (cờ, hay của cùng ghế, dưới mặt ngồi), không thì `world.floor`
  let support;
  {
    const k = SLOTS.footrest;
    const got = fromFlag(k, (n) => {
      if (n.length !== 1) fail(`--footrest nhận <vật | y | none>, không phải \`${o.footrest}\``);
      const S = VIRTUAL.footrest.size * hs;
      return virtualEntries(`bệ để chân y ${n[0]}`, [
        {
          role: "footrest",
          at: [W.hip[0], n[0], W.hip[2]],
          size: [S, S],
          front: [fr.F[0], 0, fr.F[2]],
        },
      ]);
    });
    const e =
      got?.list[0] ??
      (flags.footrest?.none
        ? undefined
        : one(
            k,
            sameAsSeat(k, (r) => r.at[1] > seatY + 10 * s),
          ));
    if (e) {
      const f = track(e);
      used.footrest = f;
      const r = e.role;
      const fwd = rig.rectCorners(r).map(([x, z]) => fr.local([x, r.at[1], z])[0]);
      support = {
        y: r.at[1],
        yAt: (t) => f.at(t)?.at[1],
        rectAt: (t) => f.at(t),
        label: e.prop.virtual
          ? e.prop.name
          : `để chân \`${entryName(e.prop, r)}\` (mặt trên y ${r1(r.at[1])})`,
        ...(r.size[0] < FOOT_BAR * s && { bar: [Math.min(...fwd), Math.max(...fwd)] }),
      };
      if (support.y <= W.hip[1])
        fail(`${support.label} không thấp hơn hông \`${o.cast}\`: kiểm vai trò \`footrest\``);
    } else {
      if (!flags.footrest?.none) skip(k, "không có: bàn chân trên `world.floor`");
      if (W.floor === undefined)
        fail(
          `\`${o.cast}\` thiếu \`world.floor\` (y sàn dưới chân, thường 0): bộ ngồi đặt bàn chân lên sàn ấy — khai trong cảnh, hay --footrest <vật | y>`,
        );
      support = { y: W.floor, yAt: () => W.floor, label: `sàn y ${W.floor}` };
    }
  }
  const drop = support.y - W.hip[1];
  const B = rig.bones3(h);
  const T = B.thigh * 100 * s;
  const S = B.shin * 100 * s;
  const ra = 0.8 * rig.limbHalf(c).leg * s;
  // thanh để chân hẹp: thanh nằm dưới đế giày, giữa gót và mũi
  const foot =
    support.bar &&
    ((ankle, phi) => {
      const sh = shoeAt(c, phi, s);
      const mid = (support.bar[0] + support.bar[1]) / 2;
      return mid >= ankle + sh.heel[0] && mid <= ankle + Math.min(sh.toe[0], 2 * ra);
    });
  const styleOf = (side) => (legs === "staggered" ? (side === tuck ? "bent" : "straight") : legs);
  /** Bên phải người (`+1`) hay trái của chân, tay `near` / `far` */
  const rightOf = (side) => ((side === "near") !== !!W.flip ? 1 : -1);
  const lh = rig.limbHalf(c).leg;
  const thighR = { r0: rig.CLAD_TAPER.leg[0] * lh * s, rk: rig.CLAD_TAPER.leg[1] * lh * s, T };
  const hipHalf = rig.body3(c).hipHalf * s;
  /** Mép trước mặt ngồi `r` trước khớp hông chân `side` (theo hướng mặt người), và độ thấp hơn khớp hông */
  const edgeOf = (r, side, hip = W.hip) => {
    const p = fr.world([0, 0, rightOf(side) * hipHalf]).map((v, i) => v - W.hip[i] + hip[i]);
    const q0 = rectLocal(r, p);
    const q1 = rectLocal(r, add(p, fr.F));
    const v = [q1.d - q0.d, q1.w - q0.w];
    let t = Infinity;
    for (const [x, vx, half] of [
      [q0.d, v[0], r.size[0] / 2],
      [q0.w, v[1], r.size[1] / 2],
    ])
      if (Math.abs(vx) > 1e-9) t = Math.min(t, ((vx > 0 ? half : -half) - x) / vx);
    return { edge: Math.max(0, t), down: r.at[1] - hip[1] };
  };
  // đùi chúi xuống tới khi mặt dưới đùi lún mép trước mặt ngồi `THIGH_SINK`; không có mặt ngồi khai vai trò thì tới
  // `THIGH_RANGE[0]`
  const lowOf = (side) =>
    seat
      ? thighLow({ ...thighR, ...edgeOf(seat.role, side), sink: THIGH_SINK * s })
      : THIGH_RANGE[0];
  /** Góc đùi nằm trên mặt ngồi (mặt dưới đùi vừa chạm mép trước) khi chân thõng */
  const restOf = (side) =>
    seat ? thighLow({ ...thighR, ...edgeOf(seat.role, side), sink: 0 }) : 90;
  const sideName = (side) => (side === "near" ? "gần" : "xa");
  /**
   * Chân `side` kiểu `style`: góc cho đế giày chạm mặt đỡ (`note` khi ống chân ngoài tầm kiểu); chân `square` với `free`
   * không chạm được thì thõng; không được thì `{ ok: false }` kèm tầm của kiểu
   */
  const legFor = (side, style) => {
    const low = lowOf(side);
    const r = solveLeg({ c, s, T, S, drop, style, foot, low });
    if (r.ok)
      return {
        ...r,
        style,
        low,
        ...(r.out && {
          note: `chân ${sideName(side)}: ống chân ${LEG_WORD[style]} dựng tới ${comma(r.shin)}° (ngoài tầm kiểu)`,
        }),
      };
    const high = drop > r.hi;
    if (style !== "square" || !(high || support.bar) || feet !== "free")
      return { ...r, style, low, high };
    const rim = seat && { ...edgeOf(seat.role, side), r: thighR.rk + DANGLE_EDGE * s };
    const floorDrop = support.bar ? W.floor - W.hip[1] : drop;
    if (!Number.isFinite(floorDrop)) fail("Chân thõng cần world.floor để đo khe tới sàn thật");
    const d = dangleLeg({ c, s, T, S, drop: floorDrop, thigh: restOf(side), ...rim });
    if (!d.ok)
      fail(
        `Chân ${sideName(side)}: ${d.why}. Gợi ý: đặt điểm ngồi gần mép trước hơn. Không ghi file.`,
      );
    return {
      ...d,
      style,
      low,
      note: `chân ${sideName(side)} thõng: đế giày hở ${comma(d.gap)} trên ${support.bar ? `sàn y ${W.floor}` : support.label}${d.gap < DANGLE_MIN * s ? ` (dưới ${comma(DANGLE_MIN * s)}: trông như hụt chân)` : ""}`,
    };
  };
  /** Vì sao chân `side` kiểu `f.style` không đặt được và gợi ý */
  const legError = (side, f) => {
    const { style, low, high, lo, hi, shin } = f;
    const others = Object.keys(LEG_STYLES).filter(
      (k) => k !== style && solveLeg({ c, s, T, S, drop, style: k, foot, low }).ok,
    );
    // đùi bị mép trước giữ lại: chạm được nếu đùi chúi tới `THIGH_FLOOR`
    const held = seat && low > THIGH_FLOOR + 1e-6;
    const deeper = held && solveLeg({ c, s, T, S, drop, style, foot, low: THIGH_FLOOR });
    const e = seat && edgeOf(seat.role, side).edge;
    const edgeName = seat && `\`${entryName(seat.prop, seat.role)}\``;
    const why = high
      ? deeper?.ok
        ? `chân kiểu \`${style}\` chạm ${support.label} thì đùi phải chúi ${r1(90 - deeper.thigh)}° dưới phương ngang, mà mép trước ${edgeName} cách khớp hông ${r1(e)} chỉ cho chúi tới ${r1(90 - low)}° (mặt dưới đùi lún mép quá ${comma(THIGH_SINK * s)}) — ở đó đế giày còn hở ${r1(drop - hi)} (ống chân ${r1(shin)}°)`
        : `mặt ngồi cao hơn tầm chân kiểu \`${style}\` ${r1(drop - hi)} (hông cao ${r1(drop)} trên ${support.label}, chân với tới ${r1(hi)} ở ống chân ${r1(shin)}°, đùi chúi ${r1(90 - low)}° dưới phương ngang${held ? ` — mép trước ${edgeName} cách khớp hông ${r1(e)} chỉ cho chúi tới đó` : ""})`
      : drop < lo
        ? `mặt ngồi thấp hơn tầm chân kiểu \`${style}\` ${r1(lo - drop)} (hông cao ${r1(drop)} trên ${support.label}, gối gập tới ${r1(lo)})`
        : `bàn chân kiểu \`${style}\` không đặt lên được ${support.label} (thanh ở trước hông ${support.bar.map(r1).join("–")})`;
    const use = others.length ? `dùng --legs ${others.join(" hay ")}` : null;
    const dangle =
      high &&
      !support.bar &&
      !others.includes("square") &&
      (style !== "square"
        ? `--legs square${feet === "floor" ? " --feet free" : ""} (chân thõng)`
        : feet === "floor" && "--feet free (chân thõng)");
    const fix = high
      ? [
          dangle,
          "hạ mặt ngồi hay --footrest <vật | y>",
          held && "đặt điểm ngồi gần mép trước hơn (đùi chúi được nhiều hơn)",
        ]
      : [drop < lo ? "nâng mặt ngồi" : "dời thanh để chân hay ghế"];
    return { why, fix: [use, ...fix].filter(Boolean).join("; ") };
  };
  const leg = {};
  for (const side of ["near", "far"]) leg[side] = legFor(side, styleOf(side));
  // chân so le: chân không chạm được về vuông khi chân kia giữ được kiểu
  if (legs === "staggered" && leg.near.ok !== leg.far.ok) {
    const side = leg.near.ok ? "far" : "near";
    const sq = legFor(side, "square");
    if (sq.ok)
      leg[side] = {
        ...sq,
        note: `chân ${sideName(side)} về vuông: kiểu \`${leg[side].style}\` không chạm ${support.label}${sq.note ? `, ${sq.note.replace(/^chân (gần|xa) /, "")}` : ""}`,
      };
  }
  const bad = ["near", "far"].filter((side) => !leg[side].ok);
  if (bad.length) {
    const errs = bad.map((side) => legError(side, leg[side]));
    const why =
      legs === "staggered"
        ? `${LEG_LABEL.staggered}: ${bad.map((side, i) => `chân ${sideName(side)} — ${errs[i].why}`).join("; ")}`
        : errs[0].why;
    fail(`${why}. Gợi ý: ${errs[0].fix}. Không ghi file.`);
  }
  const feetNote = ["near", "far"].map((side) => leg[side].note).filter(Boolean);

  // lưng ghế: cờ, hay của cùng ghế ở sau hông; phép tính dùng khi `recline`, còn lại chỉ để kiểm lấn
  let rest;
  {
    const k = SLOTS.backrest;
    const got = fromFlag(k, (n) => {
      if (n.length !== 1 || !(n[0] > 0))
        fail(`--backrest nhận <vật | khoảng sau hông | none>, không phải \`${o.backrest}\``);
      const V = VIRTUAL.backrest;
      const at2 = (up) => fr.world([-n[0], seatUp + up * hs, 0]);
      return virtualEntries(`lưng ghế sau hông ${n[0]}`, [
        {
          role: "backrest",
          from: at2(V.from),
          to: at2(V.to),
          width: V.width * hs,
          front: [fr.F[0], 0, fr.F[2]],
        },
      ]);
    });
    const e =
      got?.list[0] ??
      (flags.backrest?.none
        ? undefined
        : one(
            k,
            sameAsSeat(k, (r) => backPlane(r).at(W.hip).gap > 0),
          ));
    if (e) {
      const b = track(e);
      used.backrest = b;
      rest = {
        ...b,
        label: e.prop.virtual ? e.prop.name : `lưng ghế \`${entryName(e.prop, e.role)}\``,
        strict: !!got || back === "recline",
      };
    } else if (!flags.backrest?.none) skip(k, "không có: lưng không tựa");
  }
  const torsoLen = rig.RIG.torso * h;
  /** Điểm sau lưng (khối thân cộng đai, nút obi) ở phần `k` chiều dài thân trên hông, thế giới rig */
  const backAt = (Tr, Sh, k) => {
    const y = -k * torsoLen;
    const d = Sh.across(y)[1] + backExtra(c, -y);
    return rigOf(Tr.at(Tr.hips, Tr.Rs, [0, -y / 100, -d / 100]));
  };
  /** Khe nhỏ nhất từ mặt lưng (mỗi `5 %` chiều dài thân) tới mặt trước lưng ghế `r` trong dải cao và bề rộng của nó */
  const backGap = (sp, r = rest.role) => {
    const Tr = rig.trunk3(c, sp);
    const Sh = rig.markShape(Tr);
    const P = backPlane(r);
    let gap = Infinity;
    for (let k = 0; k <= 0.95; k += 0.05) {
      const q = P.at(backAt(Tr, Sh, k));
      if (q.u >= 0 && q.u <= 1 && Math.abs(q.w) <= r.width / 2) gap = Math.min(gap, q.gap);
    }
    return gap;
  };
  const leanTo = (torso) => ({ ...sp0, pose: { ...sp0.pose, torso, lean: 0 } });
  let torso = BACK_STYLES[back].torso;
  if (rest) {
    if (back === "recline") {
      const g = (a) => backGap(leanTo(a));
      if (g(RECLINE[1]) < BACK_GAP * s)
        fail(
          `${rest.label} lấn lưng ngay khi ngả ${RECLINE[1]}°: --back upright hay dời lưng ghế ra sau. Không ghi file.`,
        );
      if (g(RECLINE[0]) > BACK_GAP * s)
        fail(
          `${rest.label} xa: ngả tới ${RECLINE[0]}° lưng vẫn cách ${r1(g(RECLINE[0]))} — dời lưng ghế lại gần, ngồi lùi vào, hay --backrest none (ngả ${BACK_STYLES.recline.torso}°). Không ghi file.`,
        );
      let [lo, hi] = RECLINE;
      for (let i = 0; i < 30; i++) {
        const m = (lo + hi) / 2;
        if (g(m) < BACK_GAP * s) lo = m;
        else hi = m;
      }
      torso = Math.ceil(hi * 10) / 10;
    } else if (rest.strict && backGap(leanTo(torso)) < 0)
      fail(
        `${rest.label} lấn lưng khi ${BACK_LABEL[back]} (${r1(backGap(leanTo(torso)))}): dời lưng ghế ra sau hay ngồi ra trước. Không ghi file.`,
      );
  }
  let head = BACK_STYLES[back].head * torso;

  const name = o.name ?? `sit-${o.scene}-${o.cast}-3d`;
  const base = member.tracks[0];
  const replaced = base?.clips.find(
    (k) => k.action !== name && Math.abs(rig.markTime(k.start ?? 0, marks) - at) < 1e-6,
  );
  /** Cảnh có clip `name` thay clip nền ở giây `at` (`withClip` tắt: cảnh như đang có, bỏ clip `name` cũ) */
  const sceneWith = (withClip) => {
    const sc = structuredClone(scene);
    const m = sc.cast.find((x) => x.id === o.cast);
    for (const tr of m.tracks) tr.clips = tr.clips.filter((k) => k.action !== name);
    if (withClip) {
      if (!m.tracks.length) m.tracks.push({ name: "nen", clips: [] });
      const t0 = m.tracks[0];
      t0.clips = t0.clips.filter((k) => Math.abs(rig.markTime(k.start ?? 0, marks) - at) >= 1e-6);
      t0.clips.push({
        action: name,
        start: at,
        ...(replaced?.blend !== undefined && { blend: replaced.blend }),
      });
      t0.clips.sort(
        (a, b) => rig.markTime(a.start ?? 0, marks) - rig.markTime(b.start ?? 0, marks),
      );
    }
    m.tracks = m.tracks.filter((tr) => tr.clips.length);
    const r = rig.parseScene(sc);
    if (!r.success) fail(`cảnh thêm clip ngồi không qua zod: ${r.error.issues?.[0]?.message}`);
    return r.data;
  };
  const legPose = { near: leg.near.leg, far: leg.far.leg };
  const build = (arms, extra = {}) =>
    rig.parseAction({
      schemaVersion: rig.ACTION_VERSION,
      ...sitAction({
        name,
        head,
        keys: sitKeys({ legs: legPose, torso, head, ...arms }),
        ...extra,
      }),
    }).data;
  const runWith = (action) => runtimeOf(sceneWith(true), { ...data.actions, [name]: action });

  // bàn: cờ, không thì vật trước mặt trong tầm (`ahead`); phép tính dùng khi `--hands table`, còn lại chỉ để kiểm gối
  let table;
  {
    const k = SLOTS.table;
    const got = fromFlag(k, (n) => {
      if (n.length > 2)
        fail(`--table nhận <vật | y | y,mép gần | none>, không phải \`${o.table}\``);
      const V = VIRTUAL.table;
      const near = n[1] ?? V.near * hs;
      const far = near + V.deep * hs;
      const half = (V.wide / 2) * hs;
      const up = W.hip[1] - n[0];
      const poly = [
        [near, -half],
        [far, -half],
        [far, half],
        [near, half],
      ].map(([f, r]) => {
        const p = fr.world([f, up, r]);
        return [p[0], p[2]];
      });
      return virtualEntries(`bàn y ${n[0]}, mép gần trước hông ${r1(near)}`, [
        { role: "tabletop", y: n[0], poly, thick: V.thick * hs },
      ]);
    });
    let e = got?.list[0];
    if (!e && !flags.table?.none) {
      const found = [];
      for (const x of entriesOf(props, "tabletop")) {
        const up = W.hip[1] - x.role.y;
        const above = up - seatUp;
        if (above < AHEAD.up[0] * hs || above > AHEAD.up[1] * hs) continue;
        let near = Infinity;
        for (const lat of AHEAD.across)
          for (let f = 0; f <= AHEAD.near * hs && f < near; f += s) {
            const p = fr.world([f, up, lat * hs]);
            if (inPoly(x.role.poly, [p[0], p[2]])) {
              near = f;
              break;
            }
          }
        if (near <= AHEAD.near * hs) found.push({ ...x, near });
      }
      found.sort((a, b) => a.near - b.near);
      if (found.length > 1 && found[1].near - found[0].near < 0.1 * found[0].near)
        fail(
          `hai bàn trước mặt \`${o.cast}\` gần ngang nhau: ${found
            .slice(0, 2)
            .map((x) => `\`${entryName(x.prop, x.role)}\` (mép gần ${r1(x.near)})`)
            .join(", ")} — chọn bằng --table <vật>`,
        );
      e = found[0];
    }
    if (e) {
      const b = track(e);
      used.table = b;
      const r = e.role;
      table = {
        ...b,
        y: r.y,
        poly: r.poly,
        under: W.hip[1] - (r.y + r.thick),
        strict: hands === "table" || !!got,
        label: e.prop.virtual
          ? e.prop.name
          : `bàn \`${entryName(e.prop, r)}\` (mặt trên y ${r1(r.y)}, cao hơn mặt ngồi ${r1(W.hip[1] - r.y - seatUp)})`,
      };
    } else if (hands === "table")
      fail(
        flags.table?.none
          ? "--table none: --hands table cần mặt bàn"
          : `--hands table: không thấy bàn trước mặt \`${o.cast}\` (vật mang \`tabletop\`, mép gần trước hông dưới ${r1(AHEAD.near * hs)}, mặt trên cao hơn mặt ngồi ${r1(AHEAD.up[0] * hs)}…${r1(AHEAD.up[1] * hs)})${three.none ? ` — ${three.none}` : ""}; ${carrierList(props, "tabletop")}; hay --table <vật | y | y,mép gần>`,
      );
    else if (!flags.table?.none) skip(k, "không có bàn trước mặt");
  }

  // tay vịn: cờ, hay hai tay vịn của cùng ghế (mỗi bên đúng một mục). Tay không đặt lên tay vịn thì chỉ giải cờ: tên
  // vật, số sai vẫn là lỗi, tay vịn của cờ ghi vào kết quả
  let arm;
  const armGot = fromFlag(SLOTS.armrest, (n) => {
    if (n.length !== 3) fail(`--armrest nhận <vật | x,y,z>, không phải \`${o.armrest}\``);
    const V = VIRTUAL.armrest;
    const q = fr.local(n);
    const pair = [q[2], -q[2]].map((r, i) => ({
      role: "armrest",
      name: i ? "doi-xung" : "co",
      from: fr.world([q[0] - V.back * hs, q[1], r]),
      to: fr.world([q[0], q[1], r]),
      width: V.width * s,
    }));
    return virtualEntries(`tay vịn đầu trước ở [${n.join(", ")}]`, pair);
  });
  if (onArmrest || armGot) {
    const k = SLOTS.armrest;
    const list = armGot?.list ?? sameAsSeat(k, () => true);
    if (!list.length)
      fail(
        `--hands ${hands}: ${seat ? `ghế \`${seat.prop.name}\` không khai \`armrest\`` : "không có mặt ngồi khai vai trò để tìm tay vịn cùng ghế"}; ${carrierList(props, "armrest")}; hay --armrest <vật | x,y,z>`,
      );
    const center = seat ? seat.role.at : W.hip;
    const sideOf = (r) => {
      const mid = r.from.map((v, i) => (v + r.to[i]) / 2);
      return dot(sub(mid, center), fr.R) > 0 ? "right" : "left";
    };
    const sides = {};
    const owner = list[0].prop.virtual ? "tay vịn ảo" : `\`${list[0].prop.name}\``;
    const who = onArmrest ? `--hands ${hands}` : `--armrest ${o.armrest}`;
    for (const side of ["right", "left"]) {
      const own = list.filter((x) => sideOf(x.role) === side);
      if (own.length > 1)
        fail(
          `${owner} có ${own.length} tay vịn bên ${side === "right" ? "phải" : "trái"} (${own.map((x) => `\`${entryName(x.prop, x.role)}\``).join(", ")}): mỗi bên một mục \`armrest\``,
        );
      if (!own.length)
        fail(
          `${owner} chỉ có tay vịn bên ${side === "right" ? "trái" : "phải"}: ${who} cần tay vịn hai bên`,
        );
      sides[side] = track(own[0]);
    }
    used.armrest = sides.right;
    used.armrestLeft = sides.left;
    const midUp = (r) => W.hip[1] - (r.from[1] + r.to[1]) / 2 - seatUp;
    const tops = [...new Set(["right", "left"].map((x) => r1(midUp(sides[x].role))))];
    arm = {
      sides,
      label: `${list[0].prop.virtual ? list[0].prop.name : `tay vịn ${["right", "left"].map((x) => `\`${entryName(sides[x].prop, sides[x].role)}\``).join(", ")}`} (mặt trên cao hơn mặt ngồi ${tops.join(" / ")})`,
    };
    if (!onArmrest) skip(k, `chỉ giải cờ --armrest — --hands ${hands} không đặt tay lên tay vịn`);
  }

  // tay: đùi theo mốc thân; bàn, tay vịn đo trên vai trò rồi đổi ra đích hệ thân ở giây `at`
  const bare = runWith(build({}));
  const sp1 = rig.sceneAt(bare, o.cast, at, h, bare.bodies[o.cast]);
  const chOf = (side) => ((side === "right") !== sp1.world.flip ? "near" : "far");
  let arms;
  let armNote;
  /** Bàn hay ghế phải dời lại gần ngần này cho khuỷu gập tới `ELBOW_BEND` */
  let closer;
  /** Dáng ở giây `at` và giữa nhịp thở của bộ tay `arms` */
  const breath = (arms) => {
    const rt1 = runWith(build(arms));
    return [at, at + SIT_DURATION / 2].map((t) =>
      rig.sceneAt(rt1, o.cast, t, h, rt1.bodies[o.cast]),
    );
  };
  const reachGap = (sps) =>
    Math.max(
      ...sps.flatMap((sp) => [-1, 1].map((k) => rig.actArm(c, sp, k)?.report.reach?.gap ?? 0)),
    );
  /** Khuỷu gập ít nhất (độ) của hai tay */
  const bend = (sps) =>
    Math.min(
      ...sps.flatMap((sp) => {
        const J = rig.actJoints(c, sp);
        return ["R", "L"].map((k) => {
          const u = J[`elbow${k}`].map((v, i) => v - J[`shoulder${k}`][i]);
          const w = J[`wrist${k}`].map((v, i) => v - J[`elbow${k}`][i]);
          const cos = u.reduce((a, v, i) => a + v * w[i], 0) / Math.hypot(...u) / Math.hypot(...w);
          return Math.acos(Math.min(1, cos)) / D;
        });
      }),
    );
  /** Tay lấn thân mình sâu nhất */
  const pierce = (sps) =>
    Math.max(0, ...sps.flatMap((sp) => rig.armPierce(c, sp).map((p) => p.depth)));
  const B3 = rig.bones3(h);
  const L1 = B3.upperArm * 100 * s;
  const L2 = B3.foreArm * 100 * s;
  const armHalf = rig.limbHalf(c).arm * s;
  const [TE, TW] = [rig.CLAD_TAPER.arm[1], rig.CLAD_TAPER.arm[2]];
  /** Bán kính cẳng tay ở phần `u` từ khuỷu tới cổ tay */
  const foreR = (u) => armHalf * (TE + (TW - TE) * u);
  const ER = foreR(0);
  const tagOf = (side) => (side === "right" ? "R" : "L");
  /** Hệ người ngồi `[tiến, lên, phải]` → vectơ hệ thân `[tiến, y xuống, ra ngoài]` của tay `side` */
  const bodyVec = (v, side) => {
    const k = Math.hypot(...v) || 1;
    return [v[0] / k, -v[1] / k, ((side === "right" ? 1 : -1) * v[2]) / k].map(
      (x) => Math.round(x * 1000) / 1000 || 0,
    );
  };
  /**
   * Khung của tay vịn `r` trong hệ người ngồi: `of` đổi điểm ra `[dọc từ đầu sau, vào trong (về phía thân), lên]`, `to`
   * đổi ngược; `top(a)` độ cao mặt trên ở dọc `a`
   */
  const restFrame = (r) => {
    const A = fr.local(r.from);
    const Bq = fr.local(r.to);
    const len = Math.hypot(Bq[0] - A[0], Bq[2] - A[2]);
    const u = [(Bq[0] - A[0]) / len, (Bq[2] - A[2]) / len];
    let v = [-u[1], u[0]];
    if (v[0] * (A[0] + Bq[0]) + v[1] * (A[2] + Bq[2]) > 0) v = [-v[0], -v[1]];
    return {
      len,
      width: r.width,
      slope: (Bq[1] - A[1]) / len,
      top: (a) => A[1] + (Bq[1] - A[1]) * Math.min(1, Math.max(0, a / len)),
      of: (p) => {
        const q = [p[0] - A[0], p[2] - A[2]];
        return [q[0] * u[0] + q[1] * u[1], q[0] * v[0] + q[1] * v[1], p[1]];
      },
      to: ([a, x, y]) => [A[0] + u[0] * a + v[0] * x, y, A[2] + u[1] * a + v[1] * x],
    };
  };
  /** Khuỷu cao hơn mặt tay vịn ở chỗ vào trong `x`: mặt dưới cẳng tay chạm mặt, qua mép trong thì tì lên mép */
  const restUp = (x, w) =>
    (Math.abs(x) <= w / 2 ? ER : Math.sqrt(Math.max(0, ER * ER - (Math.abs(x) - w / 2) ** 2))) -
    ARMREST.sink * s;
  const shoulderCache = new Map();
  /** Vai bên `side` (hệ người ngồi) ở góc thân `theta` */
  const shoulderAt = (theta, side) => {
    if (!shoulderCache.has(theta)) shoulderCache.set(theta, rig.actJoints(c, leanTo(theta)));
    return fr.local(shoulderCache.get(theta)[`shoulder${tagOf(side)}`]);
  };
  /**
   * Khuỷu bên `side` trên tay vịn ở góc thân `theta`: cách vai đúng cánh tay trên, cẳng tay tựa mặt. Không `want` thì chỗ
   * tự nhiên — vào trong ít nhất (từ `xFrom`) mà với tới, trước vai; có `want` thì đúng dọc ấy, vào trong gần `xFrom` nhất.
   * Trả `{ a, x, y }` (khung `restFrame`) hay `{ why }`: `low` (vai cao, xa quá cánh tay trên), `high` (cánh tay trên dốc quá
   * `ARMREST.raise`), `along` (ra ngoài đoạn tay vịn)
   */
  const elbowOn = (side, theta, want, xFrom = 0) => {
    const F = armFrames[side];
    const w = F.width;
    const [aS, xS, yS] = F.of(shoulderAt(theta, side));
    const yE = (x, a) => F.top(a) + restUp(x, w);
    const rho2 = (x, a) => L1 * L1 - (x - xS) ** 2 - (yE(x, a) - yS) ** 2;
    const xMax = w / 2 + ARMREST.edge * ER;
    const judge = (a, x) => {
      const y = yE(x, a);
      if (yS - y < L1 * Math.cos(ARMREST.raise * D)) return { why: "high" };
      if (a < ARMREST.end * s || a > F.len - ARMREST.end * s) return { why: "along", a };
      return { a, x, y };
    };
    let rejected;
    if (want === undefined) {
      for (let x = xFrom; x <= xMax + 1e-9; x += 0.25 * s) {
        let a = aS;
        let ok = true;
        for (let i = 0; i < 3 && ok; i++) {
          const r2 = rho2(x, a);
          if (r2 < 0) ok = false;
          else a = aS + Math.sqrt(r2);
        }
        if (ok) {
          const candidate = judge(a, x);
          if (!candidate.why) return candidate;
          rejected = candidate;
        }
      }
      return rejected ?? { why: "low" };
    }
    const q2 = (want - aS) ** 2;
    let prev;
    let best;
    for (let x = -w / 4; x <= xMax + 1e-9; x += 0.25 * s) {
      const d = rho2(x, want) - q2;
      if (prev && (d === 0 || Math.sign(d) !== Math.sign(prev.d))) {
        const xx = prev.x + ((x - prev.x) * prev.d) / (prev.d - d);
        const candidate = judge(want, xx);
        if (candidate.why) rejected = candidate;
        else if (best === undefined || Math.abs(xx - xFrom) < Math.abs(best - xFrom)) best = xx;
      }
      prev = { x, d };
    }
    return best === undefined ? (rejected ?? { why: "range" }) : judge(want, best);
  };
  /** Các dọc khuỷu bên `side` đặt được ở góc thân `theta` (mẫu theo chỗ vào trong, hai phía vai) */
  const elbowSpan = (side, theta) => {
    const F = armFrames[side];
    const [aS, xS, yS] = F.of(shoulderAt(theta, side));
    const out = [];
    for (let x = -F.width / 4; x <= F.width / 2 + ARMREST.edge * ER + 1e-9; x += 0.25 * s) {
      const y = F.top(aS) + restUp(x, F.width);
      if (yS - y < L1 * Math.cos(ARMREST.raise * D)) continue;
      const r2 = L1 * L1 - (x - xS) ** 2 - (y - yS) ** 2;
      if (r2 < 0) continue;
      for (const a of [aS - Math.sqrt(r2), aS + Math.sqrt(r2)])
        if (a >= ARMREST.end * s && a <= F.len - ARMREST.end * s) out.push(a);
    }
    return out;
  };
  let armFrames;
  /** Cổ tay, lòng tay, ngón của tay vịn và `fold` theo khuỷu: cặp mốc `[0, 0,5]` của nhịp thở */
  const armrestArms = () => {
    armFrames = { right: restFrame(arm.sides.right.role), left: restFrame(arm.sides.left.role) };
    const fold = hands === "fold";
    const xFrom = (side) => (fold ? -armFrames[side].width / 2 - FOLD.out * ER : 0);
    const band =
      rest && back === "recline"
        ? [torso, torso]
        : [Math.min(torso, BACK_STYLES[back].band[0]), Math.max(torso, BACK_STYLES[back].band[1])];
    const thetas = [torso];
    for (let d = 0.5; torso - d >= band[0] || torso + d <= band[1]; d += 0.5) {
      if (torso + d <= band[1]) thetas.push(torso + d);
      if (torso - d >= band[0]) thetas.push(torso - d);
    }
    // lưng ghế sau lưng: không ngả quá chỗ chạm
    const free = (theta) => !rest || theta >= torso || backGap(leanTo(theta)) >= 0;
    const both = (theta, want) => {
      const out = {};
      for (const side of ["right", "left"]) {
        const e = elbowOn(side, theta, want?.[side], xFrom(side));
        if (e.why) return { why: e.why, side };
        out[side] = e;
      }
      return out;
    };
    let first;
    let pick;
    for (const theta of thetas) {
      if (!free(theta)) continue;
      const e = both(theta);
      first ??= e;
      if (!e.why) {
        pick = { theta, e };
        break;
      }
    }
    const whereText = arm.label;
    if (!pick) {
      const why = first?.why;
      fail(
        why === "high"
          ? `${whereText}: cao quá vai — khuỷu đặt lên thì cánh tay trên dốc quá ${ARMREST.raise}° (nhún vai). Gợi ý: hạ tay vịn, --hands thighs. Không ghi file.`
          : why === "along"
            ? `${whereText}: khuỷu rơi ra ngoài đoạn tay vịn (tay vịn ngắn hay lệch khỏi vai). Gợi ý: dời ghế hay người, --hands thighs. Không ghi file.`
            : `${whereText}: khuỷu không với tới mặt tay vịn — vai cao, xa quá cánh tay trên ${r1(L1)} kể cả khi khuỷu tì mép trong và thân trong ${r1(band[0])}…${r1(band[1])}° (tay vịn thấp hay rộng so với vai). Gợi ý: nâng tay vịn, dời tay vịn vào gần thân, --hands thighs. Không ghi file.`,
      );
    }
    const a0 = { right: pick.e.right.a, left: pick.e.left.a };
    if (elbowAt) {
      const want = { right: a0.right + elbowAt * hs, left: a0.left + elbowAt * hs };
      pick = undefined;
      for (const theta of thetas) {
        if (!free(theta)) continue;
        const e = both(theta, want);
        if (!e.why) {
          pick = { theta, e };
          break;
        }
      }
      if (!pick) {
        // đoạn liền (mẫu cách nhau dưới `1 · s`) chứa chỗ mặc định, chung hai bên
        let lo = -Infinity;
        let hi = Infinity;
        for (const side of ["right", "left"]) {
          const all = thetas
            .filter(free)
            .flatMap((theta) => elbowSpan(side, theta))
            .sort((x, y) => x - y);
          let l = a0[side];
          let u = a0[side];
          for (const v of all) if (v > u && v - u < s) u = v;
          for (const v of [...all].reverse()) if (v < l && l - v < s) l = v;
          lo = Math.max(lo, (l - a0[side]) / hs);
          hi = Math.min(hi, (u - a0[side]) / hs);
        }
        fail(
          `--elbow ${o.elbow}: khuỷu không đặt được trên ${whereText} ở chỗ ấy (cánh tay trên ${r1(L1)} với góc thân ${r1(band[0])}…${r1(band[1])}°${rest && back === "recline" ? " — tựa lưng ghế nên thân cố định" : ""}). ${lo <= hi ? `Dời được trong ${comma(Math.ceil(lo * 10) / 10)}…${comma(Math.floor(hi * 10) / 10)}` : "Không dời được"}. Không ghi file.`,
        );
      }
    }
    torso = pick.theta;
    head = BACK_STYLES[back].head * torso;
    const keys = [pick.e];
    {
      const want = { right: pick.e.right.a, left: pick.e.left.a };
      const e = both(torso + 1, want);
      keys.push(e.why ? both(torso + 1) : e);
      if (keys[1].why) keys[1] = pick.e;
    }
    const J1 = rig.actJoints(c, sp1);
    const P1 = rig.actPalms(c, sp1);
    const handLen = len(sub(P1.R.skin[6], J1.wristR));
    const alpha = Math.asin(Math.min(1, (ER - foreR(1)) / L2));
    /** Đích tay `side` theo khuỷu, cổ tay (hệ người ngồi) ở góc thân `theta` */
    const reachOf = (side, theta, E, Wl) => {
      const ch = chOf(side) === "near" ? "armNear" : "armFar";
      const S = shoulderAt(theta, side);
      const mid = S.map((v, i) => (v + Wl[i]) / 2);
      return {
        at: rig.worldToReach(sp1.world, ch, fr.world(Wl), h).map(r1),
        elbow: rig
          .worldToReach(sp1.world, ch, fr.world(sub(E, mid)), h)
          .map((v) => Math.round(v * 1000) / 1000),
      };
    };
    const out = { arms: [], hand: [] };
    let note;
    for (const [i, K] of keys.entries()) {
      const theta = torso + i;
      const E = {};
      for (const side of ["right", "left"]) {
        const F = armFrames[side];
        E[side] = F.to([K[side].a, K[side].x, K[side].y]);
      }
      const A = {};
      const Hd = {};
      if (!fold) {
        for (const side of ["right", "left"]) {
          const F = armFrames[side];
          const k = K[side];
          // cẳng tay chìa quá đầu tay vịn thì xoay vào trong (qua mép trong) cho bàn tay buông trước đùi
          const over = k.a + L2 - F.len;
          const psi = ARMREST.turn * Math.min(1, Math.max(0, (over - 0.3 * L2) / (0.4 * L2))) * D;
          const tilt = Math.atan(F.slope * Math.cos(psi)) - alpha;
          const aW = k.a + L2 * Math.cos(tilt) * Math.cos(psi);
          const xW = k.x + L2 * Math.cos(tilt) * Math.sin(psi);
          const Wl = F.to([aW, xW, k.y + L2 * Math.sin(tilt)]);
          const off = Math.min(F.len - aW, F.width / 2 + ER - xW);
          const beta = HAND_DROOP * Math.min(1, Math.max(0, 1 - off / (0.5 * handLen)));
          const cb = Math.cos(beta * D);
          const sb = Math.sin(beta * D);
          const d = sub(F.to([Math.cos(psi), Math.sin(psi), 0]), F.to([0, 0, 0]));
          A[chOf(side)] = reachOf(side, theta, E[side], Wl);
          Hd[chOf(side)] = {
            pose: "open",
            w: 0.5,
            palm: bodyVec([-sb * d[0], -cb, -sb * d[2]], side),
          };
        }
        note ??= `khuỷu trên tay vịn ở dọc ${["right", "left"].map((x) => comma(K[x].a)).join(" / ")} từ đầu sau, cẳng tay dọc tay vịn${elbowAt ? ` (--elbow ${o.elbow})` : ""}`;
      } else {
        const f = foldAt(theta, E, i === 0 ? undefined : out.foldPick);
        out.foldPick ??= f.pick;
        Object.assign(A, f.arms);
        Object.assign(Hd, f.hand);
        note ??= `khuỷu trên tay vịn ở dọc ${["right", "left"].map((x) => comma(K[x].a)).join(" / ")} từ đầu sau, bàn tay ${top === "near" ? "gần" : "xa"} nằm trên mu bàn tay kia${elbowAt ? ` (--elbow ${o.elbow})` : ""}`;
      }
      out.arms.push(A);
      out.hand.push(Hd);
    }
    return { arms: { arms: out.arms, hand: out.hand }, note, elbows: keys[0] };

    /**
     * `fold`: lòng tay dưới ở trước bụng, lòng tay trên áp mu tay dưới; kiểm cả hai khuỷu và da bàn tay.
     * `keep` ưu tiên đích của mốc trước
     */
    function foldAt(theta, E, keep) {
      const sideOf = (ch) => ((ch === "near") !== !!sp1.world.flip ? "right" : "left");
      const tSide = sideOf(top);
      const bSide = tSide === "right" ? "left" : "right";
      const bc = chOf(bSide),
        tc = chOf(tSide);
      const bt = tagOf(bSide),
        tt = tagOf(tSide);
      const hand = {
        [bc]: { pose: "flat", w: 0.7, palm: "back", fingers: "in" },
        [tc]: { pose: "flat", w: 0.7, palm: "back", fingers: "in" },
      };
      const Eb = E[bSide],
        Et = E[tSide];
      const initial = keep ? [keep] : [];
      const tries = [...initial];
      for (const up of FOLD.up)
        for (let forward = FOLD.front[0]; forward <= FOLD.front[1]; forward += 2)
          for (const lateral of [0, -4, 4, -8, 8, -12, 12]) tries.push({ up, forward, lateral });
      let best;
      let refined = false;
      for (const pick of tries) {
        const target = [pick.forward * hs, pick.up * hs, (pick.lateral ?? 0) * hs];
        const lower = { ...reachOf(bSide, theta, Eb, target), point: "palm" };
        const upper = {
          to: "otherBack",
          point: "palm",
          elbow: reachOf(tSide, theta, Et, target).elbow,
        };
        const arms = { [bc]: lower, [tc]: upper };
        let sp, J;
        for (let iteration = 0; iteration < 3; iteration++) {
          if (iteration === 0) {
            const rt = runWith(build({ arms, hand }));
            sp = rig.sceneAt(
              rt,
              o.cast,
              at + ((theta - torso) * SIT_DURATION) / 2,
              h,
              rt.bodies[o.cast],
            );
          } else {
            const reach = { ...sp.pose.reach };
            for (const side of [bSide, tSide]) {
              const key = chOf(side) === "near" ? "an" : "af";
              reach[key] = { ...reach[key], elbow: arms[chOf(side)].elbow };
            }
            sp = { ...sp, pose: { ...sp.pose, reach } };
          }
          J = rig.actJoints(c, sp);
          if (iteration < 2)
            for (const side of [bSide, tSide])
              arms[chOf(side)].elbow = reachOf(
                side,
                theta,
                E[side],
                fr.local(J[`wrist${tagOf(side)}`]),
              ).elbow;
        }
        const P = rig.actPalms(c, sp);
        const contact = len(sub(P[tt].skin[0], P[bt].skin[1]));
        const elbows = Math.max(
          ...[bSide, tSide].map((side) => {
            const F = armFrames[side];
            const [a, x, y] = F.of(fr.local(J[`elbow${tagOf(side)}`]));
            if (
              a < ARMREST.end * s ||
              a > F.len - ARMREST.end * s ||
              Math.abs(x) > F.width / 2 + FOLD.out * ER
            )
              return Infinity;
            return Math.abs(Math.hypot(Math.max(0, Math.abs(x) - F.width / 2), y - F.top(a)) - ER);
          }),
        );
        let rail = 0;
        for (const side of [bSide, tSide]) {
          const F = armFrames[side];
          const A = F.of(fr.local(J[`elbow${tagOf(side)}`]));
          const B = F.of(fr.local(J[`wrist${tagOf(side)}`]));
          for (let u = 0; u <= 1; u += 0.1) {
            const [along, across, y] = A.map((v, i) => v + (B[i] - v) * u);
            if (along < 0 || along > F.len) continue;
            const distance = Math.hypot(
              Math.max(0, Math.abs(across) - F.width / 2),
              Math.max(0, y - F.top(along)),
            );
            rail = Math.max(rail, foreR(u) - distance);
          }
        }
        const depth = Math.max(pierce([sp]), rail);
        const score = elbows + contact + depth * 4;
        if (!best || score < best.score) best = { score, elbows, contact, depth, arms, hand, pick };
        if (elbows < FOLD.elbow * s && contact < FOLD.contact * s && depth < FOLD.pierce * s)
          return { arms, hand, pick };
        if (!refined && pick === tries.at(-1)) {
          refined = true;
          const center = best.pick;
          for (let up = center.up - 3; up <= center.up + 3; up++)
            for (let forward = center.forward - 2; forward <= center.forward + 2; forward++)
              for (let lateral = center.lateral - 2; lateral <= center.lateral + 2; lateral++)
                tries.push({ up, forward, lateral });
        }
      }
      fail(
        `--hands fold: hai bàn tay không chồng được khi khuỷu tì tay vịn (khe khuỷu ${r1(best.elbows)}, khe tay ${r1(best.contact)}, lấn thân ${r1(best.depth)}). Gợi ý: dời tay vịn vào gần thân, nâng tay vịn hay --elbow. Không ghi file.`,
      );
    }
  };
  if (hands === "table") {
    // giữa lòng tay trước vai (khép vào), vào trong mép bàn `TABLE_IN` rồi xa thêm tới khi khuỷu cao hơn cổ tay — gần
    // hơn thì cẳng tay dốc lên từ dưới mặt, xuyên mép; khuỷu gập chưa tới `ELBOW_BEND` thì lùi dần về `TABLE_IN_MIN`.
    // Cánh tay lấn ngực thì hai tay dang ra
    const J = rig.actJoints(c, sp1);
    const tableUp = W.hip[1] - table.y;
    const shoulder = (side) => fr.local(J[`shoulder${side === "right" ? "R" : "L"}`])[2];
    /** Lòng tay hai bên ở độ dang `spread`: `[tiến, lên, phải]` ở chỗ vào trong mép `TABLE_IN_MIN`, xa thêm `d` */
    const handsAt = (spread) => {
      const edge = {};
      for (const side of ["right", "left"]) {
        const r = shoulder(side) * spread;
        for (let f = 0; f <= 400 * hs; f += s) {
          const p = fr.world([f, tableUp, r]);
          if (inPoly(table.poly, [p[0], p[2]], TABLE_IN_MIN * hs)) {
            edge[side] = (d) => [f + d, tableUp + HAND_LIFT * s, r];
            break;
          }
        }
        if (!edge[side])
          fail(`${table.label}: không đặt được hai tay lên mặt bàn — bàn không ở trước mặt?`);
      }
      return (d) => {
        const p = {};
        for (const side of ["right", "left"])
          p[chOf(side)] = rig.worldToReach(
            sp1.world,
            chOf(side) === "near" ? "armNear" : "armFar",
            fr.world(edge[side](d)),
            h,
          );
        return sitArms("table", { at: p });
      };
    };
    /** Khuỷu cao hơn cổ tay ít nhất (rig): âm là cẳng tay dốc lên tới mặt bàn */
    const lift = (sps) =>
      Math.min(
        ...sps.flatMap((sp) => {
          const Jt = rig.actJoints(c, sp);
          return ["R", "L"].map((k) => Jt[`wrist${k}`][1] - Jt[`elbow${k}`][1]);
        }),
      );
    const d0 = (TABLE_IN - TABLE_IN_MIN) * hs;
    let pick;
    for (const spread of TABLE_SPREAD) {
      const armsAt = handsAt(spread);
      const tryAt = (d) => {
        const cand = armsAt(d);
        const sps = breath(cand);
        return { arms: cand, tryAt, lift: lift(sps), depth: pierce(sps), bend: bend(sps) };
      };
      let best;
      for (let d = d0; d <= d0 + TABLE_DEEP * hs; d += 2 * s) {
        const k = tryAt(d);
        if (k.bend < ELBOW_BEND) break;
        if (!best || k.lift > best.lift) best = k;
        if (k.lift >= ELBOW_LIFT * s) break;
      }
      for (let d = d0 - 2 * s; !best; d -= 2 * s) {
        const k = tryAt(Math.max(0, d));
        if (k.bend >= ELBOW_BEND || d <= 0) best = k;
      }
      const bent = (k) => k.bend >= ELBOW_BEND;
      if (!pick || (bent(best) === bent(pick) ? best.depth < pick.depth : bent(best))) pick = best;
      if (bent(pick) && pick.depth <= rig.PIERCE_TOL / 2) break;
    }
    arms = pick.arms;
    // khuỷu chưa đủ gập ở sát mép: lòng tay ra ngoài mép tới khi đủ, khoảng ấy là bàn phải dời lại gần
    if (pick.bend < ELBOW_BEND) {
      closer = 2 * s;
      while (closer < 200 * hs && pick.tryAt(-closer).bend < ELBOW_BEND) closer += 2 * s;
    }
  } else if (onArmrest) {
    const placed = armrestArms();
    arms = placed.arms;
    armNote = placed.note;
  } else {
    // lòng tay về phía gối nhất mà hai tay còn với tới (tựa sau thì vai lùi xa đùi), rồi ra ngoài, về phía gối tới khi cẳng
    // tay không lấn bụng mà vẫn với tới; lòng tay theo mặt trên đùi từng bên
    const thighs = { near: leg.near.thigh, far: leg.far.thigh };
    const r = ((rig.CLAD_TAPER.leg[0] + rig.CLAD_TAPER.leg[1]) / 2) * lh;
    let f = THIGH_REACH[back];
    while (
      f > THIGH_REACH_MIN &&
      reachGap(breath(sitArms("thighs", { back, reach: f, thighs, r }))) > 1
    )
      f -= 4;
    let best;
    search: for (let ahead = 0; ahead <= THIGH_AHEAD_MORE; ahead += 6)
      for (let out = THIGH_OUT[back]; out <= THIGH_OUT[back] + THIGH_OUT_MORE; out += 4) {
        const side = out > THIGH_OUT[back] ? THIGH_SIDE.side : THIGH_SIDE.top;
        const cand = sitArms("thighs", { back, reach: f + ahead, out, thighs, r, side });
        const sps = breath(cand);
        const k = { arms: cand, depth: pierce(sps), held: reachGap(sps) <= 1 };
        if (!best || (k.held === best.held ? k.depth < best.depth : k.held)) best = k;
        if (k.held && k.depth <= rig.PIERCE_TOL / 2) break search;
      }
    arms = best.arms;
  }
  /** Mặt bàn (y thế giới) ở giây `t` */
  const surfaceY = (side, p, t = at) => table.at(t)?.y;
  // bàn: hạ hay nâng đích cho điểm thấp nhất của bàn tay vẽ ra nằm trên mặt
  if (hands === "table")
    for (let i = 0; i < 3; i++) {
      const rt1 = runWith(build(arms));
      const sp = rig.sceneAt(rt1, o.cast, at, h, rt1.bodies[o.cast]);
      const P = rig.actPalms(c, sp);
      let moved = 0;
      for (const [tag, side] of [
        ["R", "right"],
        ["L", "left"],
      ]) {
        const low = Math.min(...P[tag].skin.map((p) => -p[1]));
        const top = -surfaceY(side, P[tag].at);
        const d = (low - top - HAND_LIFT * s) / hs;
        const r = arms.arms[chOf(side)];
        arms.arms[chOf(side)] = { ...r, at: [r.at[0], r1(r.at[1] + d), r.at[2]] };
        moved = Math.max(moved, Math.abs(d));
      }
      if (moved < 0.1) break;
    }

  const draft = build(arms);
  const rt = runWith(draft);
  const end = Math.min(at + SIT_DURATION, rt.duration);
  const window = [at, end];
  const times = sampleTimes(at, end);
  const spAt = (t) => rig.sceneAt(rt, o.cast, t, h, rt.bodies[o.cast]);
  for (const t of times)
    if (!spAt(t).world?.seated)
      fail(
        `\`${o.cast}\` đứng dậy ở giây ${sec(t)}, trước khi hết một nhịp thở (${SIT_DURATION} s) — đặt --at sớm hơn hay kéo dài quãng ngồi`,
      );

  // tự kiểm
  const core = ["right", "left"].flatMap((side) =>
    coreChecks(rt, chars, { id: o.cast, side, window }).map((r) => ({
      ...r,
      msg: `tay ${side === "right" ? "phải" : "trái"}: ${r.msg}`,
    })),
  );
  const joints = (t) => rig.actJoints(c, spAt(t));
  /** Góc ống chân (độ, dương ra trước) và cổ chân hệ người ngồi của chân `tag` */
  const shinOf = (J, tag) => {
    const knee = fr.local(J[`knee${tag}`]);
    const ankle = fr.local(J[`foot${tag}`]);
    return { ankle, phi: Math.atan2(ankle[0] - knee[0], knee[1] - ankle[1]) / D };
  };
  const soleGap = (J, tag, t) => {
    const { ankle, phi } = shinOf(J, tag);
    const y = support.yAt(t);
    return y === undefined ? undefined : ankle[1] - soleDrop(c, phi, s) - (W.hip[1] - y);
  };
  /**
   * Đế giày trên để chân ở giây `t` (docs/13 mục 3.6): bệ thì gót, mũi chiếu xuống trong mặt đỡ; thanh thì thanh nằm dưới
   * đế giày, giữa gót và mũi (mũi tới `2 · ra` như phép đặt), cổ chân trong bề ngang thanh
   */
  const onFootrest = (J, tag, t) => {
    const r = support.rectAt(t);
    if (!r) return false;
    const { ankle, phi } = shinOf(J, tag);
    const sh = shoeAt(c, phi, s);
    const toe = support.bar ? Math.min(sh.toe[0], 2 * ra) : sh.toe[0];
    const [heel, tip] = [sh.heel[0], toe].map((f) => fr.world([ankle[0] + f, ankle[1], ankle[2]]));
    if (!support.bar) return rectHolds(r, heel) && rectHolds(r, tip);
    const [a, b] = [rectLocal(r, heel), rectLocal(r, tip)];
    return (
      Math.min(a.d, b.d) <= 0 &&
      Math.max(a.d, b.d) >= 0 &&
      Math.abs(rectLocal(r, fr.world(ankle)).w) <= r.size[1] / 2
    );
  };
  const rests = [];
  const clears = [];
  const sideOfTag = (tag) => ((tag === "R") !== !!W.flip ? "near" : "far");
  const dangling = [];
  for (const [tag, label] of [
    ["R", "đế giày phải"],
    ["L", "đế giày trái"],
  ])
    if (leg[sideOfTag(tag)].dangle) dangling.push([tag, label]);
    else
      rests.push({
        label: `${label} trên ${support.label}`,
        gap: (t) => soleGap(joints(t), tag, t),
        ...(support.rectAt && { inside: (t) => onFootrest(joints(t), tag, t) }),
        range: [-SOLE_SINK, rig.HELD_TOUCH],
        drift: (t) => joints(t)[`foot${tag}`],
      });
  const palmLow = (t, tag) => {
    const P = rig.actPalms(c, spAt(t))?.[tag];
    return P && { low: Math.min(...P.skin.map((p) => -p[1])), at: P.at };
  };
  /** Khoảng từ điểm `p` tới đoạn `a → b`, và phần dọc đoạn */
  const toSegment = (p, a, b) => {
    const d = sub(b, a);
    const u = Math.min(1, Math.max(0, dot(sub(p, a), d) / dot(d, d)));
    return { dist: len(sub(p, add(a, mul(d, u)))), u };
  };
  const hipJoint = (J, tag) =>
    fr.world([fr.local(J.hip)[0], fr.local(J.hip)[1], (tag === "R" ? 1 : -1) * hipHalf]);
  if (hands === "thighs")
    for (const [tag, label] of [
      ["R", "lòng tay phải"],
      ["L", "lòng tay trái"],
    ])
      rests.push({
        // giữa lòng tay tới mặt đùi cùng bên (ống đùi thon `CLAD_TAPER.leg`), lệch hướng lòng tay khỏi pháp tuyến mặt đùi
        label: `${label} trên đùi`,
        gap: (t) => {
          const sp = spAt(t);
          const P = rig.actPalms(c, sp)?.[tag];
          const J = rig.actJoints(c, sp);
          if (!P || !J) return undefined;
          const a = hipJoint(J, tag);
          const q = toSegment(P.skin[0], a, J[`knee${tag}`]);
          return q.dist - (thighR.r0 + (thighR.rk - thighR.r0) * q.u);
        },
        inside: (t) => {
          const sp = spAt(t);
          const P = rig.actPalms(c, sp)?.[tag];
          const J = rig.actJoints(c, sp);
          if (!P || !J) return false;
          // pháp tuyến mặt đùi ở chỗ lòng tay: từ trục đùi ra giữa lòng tay
          const a = hipJoint(J, tag);
          const d = sub(J[`knee${tag}`], a);
          const q = toSegment(P.skin[0], a, J[`knee${tag}`]);
          const n = sub(P.skin[0], add(a, mul(d, q.u)));
          return dot(P.palm, mul(n, -1 / len(n))) >= Math.cos(PALM_THIGH.angle * D);
        },
        range: PALM_THIGH.range,
      });
  if (hands === "table")
    for (const [tag, label] of [
      ["R", "bàn tay phải"],
      ["L", "bàn tay trái"],
    ])
      rests.push({
        label: `${label} trên mặt bàn`,
        gap: (t) => {
          const P = palmLow(t, tag);
          const r = table.at(t);
          return P && r && P.low - -r.y;
        },
        inside: (t) => {
          const P = palmLow(t, tag);
          const r = table.at(t);
          return !!P && !!r && inPoly(r.poly, [P.at[0], P.at[2]]);
        },
        range: HAND_REST,
        drift: (t) => rig.actPalms(c, spAt(t))?.[tag].at,
      });
  /** Khe mặt dưới cẳng tay `tag` tới mặt tay vịn `r` (tì mép trong: tới mép), phần cẳng tay nằm trên đoạn */
  const foreOnRest = (J, tag, r) => {
    const F = restFrame(r);
    const E = F.of(fr.local(J[`elbow${tag}`]));
    const Wr = F.of(fr.local(J[`wrist${tag}`]));
    let g;
    const take = (v) => {
      const violation = (x) => Math.max(FOREARM_REST[0] * s - x, x - FOREARM_REST[1] * s);
      if (g === undefined || violation(v) > violation(g)) g = v;
    };
    let on = false;
    for (let u = 0; u <= (hands === "fold" ? 0 : 1.0001); u += 0.05) {
      const [a, x, y] = E.map((v, i) => v + (Wr[i] - v) * u);
      if (a < 0 || a > F.len) continue;
      const half = F.width / 2;
      if (Math.abs(x) <= half) {
        take((y - F.top(a)) / Math.hypot(1, F.slope) - foreR(u));
        on = true;
      } else if (u === 0 && Math.abs(x) < half + foreR(u)) {
        take(Math.hypot(Math.abs(x) - half, (y - F.top(a)) / Math.hypot(1, F.slope)) - foreR(u));
        on = true;
      }
    }
    return on ? g : undefined;
  };
  if (onArmrest)
    for (const [tag, side, label] of [
      ["R", "right", "cẳng tay phải"],
      ["L", "left", "cẳng tay trái"],
    ]) {
      const k = arm.sides[side];
      rests.push({
        label: `${label} trên tay vịn`,
        gap: (t) => {
          const r = k.at(t);
          return r && foreOnRest(joints(t), tag, r);
        },
        inside: (t) => {
          const r = k.at(t);
          if (!r) return false;
          const F = restFrame(r);
          const [a, x] = F.of(fr.local(joints(t)[`elbow${tag}`]));
          return a >= 0 && a <= F.len && Math.abs(x) <= F.width / 2 + ARMREST.edge * ER;
        },
        range: FOREARM_REST.map((v) => v * s),
      });
    }
  if (hands === "fold") {
    const tTag = (top === "near") !== !!W.flip ? "R" : "L";
    const bTag = tTag === "R" ? "L" : "R";
    rests.push({
      label: `lòng bàn tay ${top === "near" ? "gần" : "xa"} trên mu bàn tay kia`,
      gap: (t) => {
        const P = rig.actPalms(c, spAt(t));
        return len(sub(P[tTag].skin[0], P[bTag].skin[1]));
      },
      range: [0, FOLD.contact * s],
    });
  }
  if (table) {
    const legR = rig.limbHalf(c).leg * s;
    clears.push({
      label: `gối, đùi dưới mặt ${table.label}`,
      gap: (t) => {
        const r = table.at(t);
        if (!r) return undefined;
        const under = W.hip[1] - (r.y + r.thick);
        const J = joints(t);
        let g = Infinity;
        for (const tag of ["R", "L"])
          for (let u = 0; u <= 1; u += 0.125) {
            const p = J.hip.map((v, i) => v + (J[`knee${tag}`][i] - v) * u);
            if (!inPoly(r.poly, [p[0], p[2]], -legR)) continue;
            g = Math.min(g, under - (fr.local(p)[1] + legR));
          }
        return g;
      },
      min: 0,
      soft: !table.strict,
    });
  }
  if (rest)
    clears.push({
      label: `lưng với ${rest.label}`,
      gap: (t) => {
        const r = rest.at(t);
        return r ? backGap(spAt(t), r) : undefined;
      },
      min: 0,
      soft: !rest.strict,
    });
  core.push(...restChecks({ window, rest: rests, clear: clears }));
  // chân thõng: đế giày không lún mặt đỡ; hở dưới `DANGLE_MIN` là cảnh báo (trông như hụt chân)
  for (const [tag, label] of dangling) {
    let lo = { g: Infinity, t: at };
    for (const t of times) {
      const J = joints(t);
      const { ankle, phi } = shinOf(J, tag);
      const g = support.bar
        ? W.floor - W.hip[1] + ankle[1] - soleDrop(c, phi, s)
        : soleGap(J, tag, t);
      const r = seat?.at(t);
      if (r) {
        const H = fr.local(hipJoint(J, tag));
        const K = fr.local(J[`knee${tag}`]);
        const thigh = Math.atan2(K[0] - H[0], H[1] - K[1]) / D;
        if (
          !shinClear({
            T,
            S,
            thigh,
            phi,
            ...edgeOf(r, sideOfTag(tag), spAt(t).world.hip),
            r: thighR.rk + DANGLE_EDGE * s,
          })
        )
          core.push({
            rule: "dangle-edge",
            level: "lỗi",
            t,
            msg: `${label}: ống chân không qua mép trước mặt ngồi`,
          });
      }
      if (g !== undefined && g < lo.g) lo = { g, t };
    }
    core.push({
      rule: "dangle",
      level: lo.g < 0 ? "lỗi" : lo.g < DANGLE_MIN * s ? "cảnh báo" : "ok",
      worst: r2(lo.g),
      t: lo.t,
      limit: `hở ≥ ${r1(DANGLE_MIN * s)}`,
      msg:
        lo.g < 0
          ? `${label} thõng mà lún ${support.label} ${comma(-lo.g)} ở giây ${sec(lo.t)}`
          : `${label} thõng, hở ${comma(lo.g)} trên ${support.bar ? `sàn y ${W.floor}` : support.label}${lo.g < DANGLE_MIN * s ? " — hở nhỏ trông như hụt chân: --feet floor, --footrest hay đổi độ cao ghế" : ""}`,
    });
  }
  // đùi lún mép trước mặt ngồi (docs/13 mục 3.3)
  if (seat) {
    let worst = { k: -Infinity, t: at, tag: "R" };
    for (const t of sampleTimes(at, end, CLASH_EVERY)) {
      const r = seat.at(t);
      if (!r) continue;
      const J = joints(t);
      for (const tag of ["R", "L"]) {
        const hj = hipJoint(J, tag);
        const L = fr.local(hj);
        const K = fr.local(J[`knee${tag}`]);
        const { edge, down } = edgeOf(r, sideOfTag(tag), spAt(t).world.hip);
        const beta = Math.atan2(L[1] - K[1], K[0] - L[0]) / D;
        const k = thighSink({ ...thighR, T: len(sub(K, L)), beta, edge, down });
        if (k > worst.k) worst = { k, t, tag };
      }
    }
    const bad = worst.k > THIGH_SINK * s + 0.1;
    core.push({
      rule: "thigh",
      level: bad ? "lỗi" : "ok",
      worst: r2(Math.max(0, worst.k)),
      t: worst.t,
      limit: `lún ≤ ${r1(THIGH_SINK * s)}`,
      msg: bad
        ? `đùi ${worst.tag === "R" ? "phải" : "trái"} lún mép trước \`${entryName(seat.prop, seat.role)}\` ${comma(worst.k)} ở giây ${sec(worst.t)} — hạ mặt ngồi hay ngồi ra gần mép`
        : `đùi trên mép trước \`${entryName(seat.prop, seat.role)}\` (${worst.k > 0 ? `lún ${comma(worst.k)}` : `hở ${comma(-worst.k)}`})`,
    });
  }
  if (hands === "table") {
    const k = r1(bend(times.map(spAt)));
    core.push({
      rule: "bend",
      level: k < ELBOW_BEND ? "lỗi" : "ok",
      worst: k,
      t: at,
      limit: `gập ≥ ${ELBOW_BEND}°`,
      msg:
        k < ELBOW_BEND
          ? `hai tay: khuỷu chỉ gập ${k}° dù lòng tay sát mép bàn (vào trong ${TABLE_IN_MIN}) — tay duỗi chống bàn`
          : `hai tay: khuỷu gập ít nhất ${k}°`,
    });
  }
  // luật mặt ngồi (docs/13 mục 3.3): đo trên mục mặt ngồi và điểm ngồi của từng giây mẫu, giữ giây tệ nhất
  let seatNoteLine;
  if (seat) {
    const sr = seat.role;
    const nm = `\`${entryName(seat.prop, sr)}\``;
    const halfSide = (rig.body3(c).hipHalf + rig.limbHalf(c).leg) * s;
    let gone;
    let lift = { dy: 0, t: at };
    let tail = { out: -Infinity, t: at };
    let side = { room: Infinity, w: 0, t: at };
    let front = { d: Infinity, t: at };
    for (const t of sampleTimes(at, end, CLASH_EVERY)) {
      const r = seat.at(t);
      if (!r) {
        gone ??= t;
        continue;
      }
      const sp = spAt(t);
      const hip = sp.world.hip;
      const dy = hip[1] + legHalf * s - r.at[1];
      if (Math.abs(dy) > Math.abs(lift.dy)) lift = { dy, t };
      const q = rectLocal(r, hip);
      const room = r.size[1] / 2 - Math.abs(q.w) - halfSide;
      if (room < side.room) side = { room, w: q.w, t };
      if (r.size[0] / 2 - q.d < front.d) front = { d: r.size[0] / 2 - q.d, t };
      // đuôi mông so với mép sau (trừ khi chạm lưng ghế)
      const Tr = rig.trunk3(c, sp);
      const Sh = rig.markShape(Tr);
      const rb = rest?.at(t);
      for (const k of TAIL_SPAN) {
        const p = backAt(Tr, Sh, k);
        const out = -(r.size[0] / 2 + rectLocal(r, p).d);
        if (out <= 0 || out <= tail.out) continue;
        if (rb && backPlane(rb).at(p).gap <= SEAT_RULE.touch * s) continue;
        tail = { out, t };
      }
    }
    const gonePart =
      gone !== undefined && `mặt ngồi ${nm} không còn trong cảnh ở giây ${sec(gone)}`;
    const dy = lift.dy;
    const far = Math.abs(dy) > SEAT_RULE.error * s;
    const off = Math.abs(dy) > SEAT_RULE.warn * s;
    core.push({
      rule: "seat",
      level: gonePart || far ? "lỗi" : off ? "cảnh báo" : "ok",
      worst: r2(Math.abs(dy)),
      t: gone ?? lift.t,
      limit: `lệch ≤ ${r1(SEAT_RULE.warn * s)}`,
      msg: gonePart
        ? `${gonePart} — tự kiểm mất mặt ngồi`
        : off
          ? `điểm ngồi ${dy < 0 ? "lơ lửng trên" : "lún vào"} mặt ngồi ${nm} ${comma(Math.abs(dy))} ở giây ${sec(lift.t)}: đặt \`world.at[1]\` = ${comma(seat.at(lift.t).at[1])}`
          : `điểm ngồi trên mặt ngồi ${nm} (lệch ${r2(Math.abs(dy))})`,
    });
    const bad = [
      tail.out > 0 &&
        `đuôi mông ra ngoài mép sau ${comma(tail.out)} ở giây ${sec(tail.t)} mà không chạm lưng ghế`,
      side.room < 0 &&
        `hông cộng đùi ra ngoài mép ${side.w > 0 ? "phải" : "trái"} ${comma(-side.room)} ở giây ${sec(side.t)}`,
    ].filter(Boolean);
    core.push({
      rule: "seat",
      level: bad.length ? "lỗi" : "ok",
      worst: r2(Math.max(0, tail.out, -side.room)),
      t: tail.out > 0 ? tail.t : side.room < 0 ? side.t : at,
      limit: "trong mép",
      msg: bad.length
        ? `mông lọt mép ${nm}: ${bad.join("; ")} — dời điểm ngồi vào giữa mặt ngồi`
        : `mông trong mép ${nm} (hai bên còn ${r1(side.room)})`,
    });
    const shallow = front.d < SHALLOW * rig.RIG.thigh * hs;
    core.push({
      rule: "seat",
      level: shallow ? "cảnh báo" : "ok",
      worst: r2(front.d),
      t: front.t,
      limit: `hông tới mép trước ≥ ${r1(SHALLOW * rig.RIG.thigh * hs)}`,
      msg: shallow
        ? `ngồi nông trên ${nm}: hông cách mép trước ${comma(front.d)} ở giây ${sec(front.t)} (dưới ⅓ đùi) — ngồi lùi vào`
        : `hông cách mép trước ${nm} ${r1(front.d)}`,
    });
    const hipQ = rectLocal(sr, W.hip);
    const toFront = sr.size[0] / 2 - hipQ.d;
    const toRight = sr.size[1] / 2 - hipQ.w;
    const toLeft = sr.size[1] / 2 + hipQ.w;
    seatNoteLine = `ngồi trên ${nm}, hông cách mép trước ${comma(toFront)}, cách mép sau ${comma(sr.size[0] / 2 + hipQ.d)}, cách mép ${toRight < toLeft ? "phải" : "trái"} ${comma(Math.min(toRight, toLeft))}`;
  }

  const world = await worldChecks({
    dir: root,
    before: sceneWith(false),
    after: sceneWith(true),
    actions: { [name]: draft },
    groups: ["move", "clash", "held", "roles"],
    ...(o.stage && { spec: o.stage.spec, held: o.stage.held }),
  });
  const ignore = (r) => {
    const m = /^held:([a-z]+)\|/.exec(r.key ?? "");
    return !!m && HOLD_RULES.has(m[1]);
  };
  const failed = checkFailed(core, world, ignore);
  const table_ = checkTable(core, world, ignore);

  const legText = (side) => `[${legPose[side].join(", ")}]`;
  const legNote =
    (legs === "staggered"
      ? `${LEG_LABEL.staggered}: ${[tuck, tuck === "near" ? "far" : "near"].map((k) => `chân ${sideName(k)} ${LEG_WORD[leg[k].style]} ${legText(k)}`).join(", ")}`
      : `${LEG_LABEL[legs]} ${legText("near")}`) +
    (feetNote.length ? ` (${feetNote.join("; ")})` : "");
  const seatNote = `mặt ngồi y ${r1(seatY)}, hông cao ${r1(drop)} trên ${support.label}`;
  const handNote =
    hands === "thighs"
      ? `${HAND_LABEL.thighs} (lòng tay ở mốc \`thigh\` dời ${arms.arms.near.offset[0]} về phía gối)`
      : hands === "table"
        ? `${HAND_LABEL.table} (${table.label}, giữa lòng tay hệ thân [${arms.arms.near.at.join(", ")}])`
        : `${HAND_LABEL[hands]} (${arm.label}, ${armNote})`;
  const backNote = `${BACK_LABEL[back]}, thân ${r1(torso)} ↔ ${r1(torso + 1)} mỗi ${String(SIT_DURATION).replace(".", ",")} s (lặp)${rest ? ` — ${rest.label}` : ""}${head ? `, đầu gật bù ${r1(head)}` : ""}`;
  const note =
    `Ngồi sinh bằng \`stickman gen sit\` cho cảnh \`${o.scene}\`, người \`${o.cast}\` từ giây ${at}: ${legNote}; ${backNote}; ${handNote}; ${seatNote}. ` +
    `Ghi tay, chân, thân, bàn tay${head ? ", đầu" : ""}. Nền: \`world.sit\` của cảnh ấy; chồng track đầu, nét mặt, một tay lên trên. ` +
    `Ghế, sàn hay người đổi thì sinh lại, không sửa tay.`;
  const stage = hands === "table" ? "desk" : onArmrest ? "armchair" : "chair";
  const action = build(arms, { note, preview: { stage } });

  const out = join(root, "actions", `${name}.json`);
  const found = Object.entries(used)
    .filter(([k]) => k !== "armrestLeft")
    .map(([k, e]) => {
      const nm = e.prop.virtual
        ? e.prop.name
        : k === "armrest"
          ? `\`${e.prop.name}\``
          : `\`${entryName(e.prop, e.role)}\``;
      return `${ROLE_LABEL[SLOTS[k].role]} ${nm}${flags[k] ? " (cờ)" : ""}`;
    });
  const lines = [
    `sit: cảnh ${o.scene}, ${o.cast} từ giây ${at}; ${seatNote}`,
    ...(seatNoteLine ? [seatNoteLine] : []),
    ...(found.length ? [`đồ theo vai trò: ${found.join("; ")}`] : []),
    ...slotLines,
    `chân: ${legNote}; lưng: ${backNote}`,
    `tay: ${handNote}`,
    ...Object.entries(used)
      .map(([k, e]) => movedLine(e, ROLE_LABEL[SLOTS[k === "armrestLeft" ? "armrest" : k].role]))
      .filter(Boolean),
    "tự kiểm:",
    table_,
  ];
  if (back === "recline" && !rest)
    lines.push(
      `cảnh báo: tựa ra sau mà không có lưng ghế (vai trò \`backrest\` của ghế hay --backrest) — ngả ${r1(torso)}° không có gì đỡ lưng`,
    );
  const snippet = {
    clip: {
      action: name,
      start: at,
      ...(replaced?.blend !== undefined && { blend: replaced.blend }),
    },
  };
  const wrote = await emit(
    root,
    "sit",
    o,
    out,
    action,
    failed,
    lines,
    sitHints({
      core,
      rows: world.rows.filter((r) => !ignore(r)),
      cast: o.cast,
      legs,
      back,
      hands,
      closer,
    }),
  );
  lines.push(
    replaced
      ? `thay clip \`${replaced.action}\` (giây ${at}) ở track \`${base.name ?? 0}\` của \`${o.cast}\` bằng: ${JSON.stringify(snippet.clip)}`
      : `dán vào track nền (track đầu) của \`${o.cast}\`: ${JSON.stringify(snippet.clip)}`,
  );
  return {
    ok: !failed,
    wrote,
    file: rel(root, out),
    action,
    legs: legPose,
    torso,
    core,
    world,
    snippet,
    roles: Object.fromEntries(
      Object.entries(used).map(([k, e]) => [
        k,
        { name: e.prop.name, entry: entryName(e.prop, e.role), virtual: !!e.prop.virtual },
      ]),
    ),
    name,
    scene: sceneWith(true),
    checks: checkRows(core, world, ignore),
    lines,
    text: lines.join("\n"),
  };
}

/**
 * Gợi ý của `gen sit` khi tự kiểm không đạt, theo đúng nguyên nhân: `core` dòng lõi, `rows` dòng `check` mới (đã bỏ dòng
 * chỉ báo), `cast` người ngồi, `closer` bàn hay ghế phải dời lại gần bao nhiêu cho khuỷu gập đủ (`undefined` là đủ)
 */
export function sitHints({ core, rows, cast, legs, back, hands, closer }) {
  const handRest = core.filter(
    (r) => r.rule === "rest" && r.level === "lỗi" && /^(bàn tay|cẳng tay|lòng tay)/.test(r.msg),
  );
  const reach = core.filter((r) => r.rule === "reach" && r.level === "lỗi");
  const issue = (k) => !reach.length && handRest.some((r) => r.issues?.includes(k));
  const surface = hands === "table" ? "mặt bàn" : hands === "thighs" ? "đùi" : "tay vịn";
  const clashes = rows.filter((r) => r.group === "clash");
  const self = clashes.filter((r) => r.msg.includes(`tay xuyên thân — ${cast}.`));
  const bend = core.some((r) => r.rule === "bend" && r.level === "lỗi");
  const by = r1(Math.max(closer ?? 0, ...reach.map((r) => r.worst)));
  return [
    (issue("missing") || issue("sink") || issue("gap")) &&
      `bàn tay không chạm ${surface} đo được: kiểm --${hands} đúng vật chưa (cảnh three có mặt trên của nó ở đúng chỗ?)`,
    issue("outside") &&
      (hands === "table"
        ? "lòng tay ra ngoài mép bàn: bàn hẹp hay lệch khỏi trước mặt — dời người ra giữa bàn"
        : hands === "thighs"
          ? "lòng tay không áp mặt đùi: thử --back khác hay --legs square"
          : "khuỷu ra ngoài tay vịn: tay vịn ngắn, hẹp hay lệch vai — dời người vào giữa ghế, hay --elbow"),
    core.some((r) => r.rule === "thigh" && r.level === "lỗi") &&
      `đùi lún mép trước mặt ngồi: hạ mặt ngồi, đặt điểm ngồi gần mép trước hơn, hay ${legs === "square" ? "" : "--legs square "}--feet free (chân thõng)`,
    issue("drift") &&
      `lòng tay trôi trên ${surface} khi thở ở dáng này: thử --back hay --legs khác`,
    core.some(
      (r) => r.rule === "rest" && r.msg.startsWith("đế giày") && r.issues?.includes("outside"),
    ) &&
      "bàn chân ra ngoài để chân: dời để chân hay ghế cho nó nằm dưới bàn chân, đổi --legs, hay --footrest none",
    hands === "table" &&
      (reach.length > 0 || bend) &&
      `${reach.length ? "tay không với tới mặt bàn" : "tay duỗi thẳng mới tới mặt bàn"}: dời bàn hay ghế lại gần ~${by}${back === "recline" ? ", hay --back upright (ngả lưng thì vai lùi sau hông)" : ""}`,
    hands !== "table" &&
      reach.length > 0 &&
      (hands === "thighs"
        ? "tay không với tới đùi: --back upright hay forward"
        : back === "recline"
          ? "ngả lưng thì tay không với tới tay vịn: --back upright"
          : "tay không với tới tay vịn: kiểm --armrest đúng vật chưa, hay --elbow"),
    core.some((r) => r.rule === "clear" && r.level === "lỗi" && r.msg.includes("mặt bàn")) &&
      `gối chạm mặt dưới bàn: ${legs === "square" ? "--legs bent hay straight (gối thấp hơn), " : ""}hạ mặt ngồi hay nâng bàn`,
    self.length > 0 &&
      `tay lấn thân mình: thử --hands khác${hands === "thighs" ? " hay --legs square / bent (đùi cao, lòng tay xa bụng)" : ""}`,
    clashes.length > self.length &&
      "người lấn ghế, bàn: đổi --legs / --back, hay khai `touch` cho chỗ chạm của vật",
    rows.some((r) => r.group === "move") && "giật lúc vào clip: đặt `blend` ~0,4 cho clip",
  ].filter(Boolean);
}

// ——— walk

/** Lỗi ghi: file cảnh đổi trên đĩa so với bản lúc nạp (Studio trả 409), kèm hash mới */
export class GenConflict extends GenError {
  constructor(message, hash) {
    super(message);
    this.conflict = true;
    this.hash = hash;
  }
}

/** Giây của cờ: số, chữ số hay `@mốc±s` (`markTime`); trống là `undefined` */
function timeOf(v, marks, flag) {
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v === "string" && v.startsWith("@")) {
    try {
      return rig.markTime(v, marks);
    } catch (e) {
      fail(`${flag} ${v}: ${e.message.replace(/^scene: /, "")}`);
    }
  }
  const n = Number(v);
  if (!Number.isFinite(n)) fail(`${flag} là số giây hay \`@mốc±s\`, không phải \`${v}\``);
  return n;
}

/** Số của cờ `flag` (trống là `dflt`), phải qua `ok` — sai thì lỗi kèm `want` */
function numFlag(v, dflt, flag, ok, want) {
  if (v === undefined || v === null || v === "") return dflt;
  const n = Number(v);
  if (!Number.isFinite(n) || !ok(n)) fail(`${flag} phải ${want}, không phải \`${v}\``);
  return n;
}

/**
 * Cảnh `disk` (JSON thô) với `cast[id]` nhận `path` (mảng mốc; rỗng thì người đứng ở `at` / `yaw`, bỏ `path`) và `tracks`;
 * phần khác của cảnh giữ nguyên. docs/14-di-muot.md mục 5.5
 */
export function sceneWithWalk(disk, id, { path, at, yaw, tracks }) {
  const next = structuredClone(disk);
  const m = next.cast.find((x) => x.id === id);
  if (path.length) {
    m.world.path = path;
    delete m.world.at;
    delete m.world.yaw;
  } else {
    m.world.at = at;
    m.world.yaw = yaw;
    delete m.world.path;
  }
  m.tracks = tracks;
  // `-0` của phép tính thành `0`: JSON không giữ dấu ấy
  return JSON.parse(JSON.stringify(next));
}

/** Ngưỡng số đo đi của repo (`stickman.gait` của `package.json`), thiếu là `{}` */
function gaitLimits(root) {
  try {
    const g = readJson(join(root, "package.json")).stickman?.gait;
    return g && typeof g === "object" ? g : {};
  } catch {
    return {};
  }
}

const GAIT_UNIT = {
  dip: "%",
  surge: "%",
  accel: "/s",
  omega: "°/s",
  omegaTurn: "°/s",
  alpha: "°/s²",
  rateJump: "/s",
  ratePeak: "×",
  facing: "°",
  stopSpeed: "×",
  stopLift: "×",
};
const gaitNum = (k, v) =>
  k === "dip" || k === "surge"
    ? `${Math.round(v * 100)}%`
    : `${Math.abs(v) < 10 ? r2(v) : Math.round(v)}${GAIT_UNIT[k] && GAIT_UNIT[k] !== "%" ? ` ${GAIT_UNIT[k]}` : ""}`;

/** Dòng tự kiểm của một số đo đi (`gaitMetrics`): quá ngưỡng là cảnh báo — chưa chặn ghi (docs/14 mục 5.6) */
function gaitRow(r) {
  const at = ` (giây ${sec(r.t)}${r.label ? `, ${r.label}` : ""})`;
  const cmp = ["feetCross", "feetGap"].includes(r.key) ? "≥" : "≤";
  return {
    rule: r.key,
    level: r.ok ? "ok" : "cảnh báo",
    worst: r.value,
    t: r.t,
    limit: `${cmp} ${gaitNum(r.key, r.limit)}${r.diag ? " · chẩn đoán" : ""}`,
    msg: r.missing
      ? `thiếu dữ liệu ở ${r.missing} lần dừng (không có trọn một chu kỳ đi ngay trước)`
      : `${gaitNum(r.key, r.value)}${at}`,
  };
}

const EV_WORD = { corner: "re", arc: "cung", stop: "dung", turn: "quay" };

/** Bàn chân người đi lún mặt sàn tới ngần này (nhân `world.s`) là đế giày của bước đi chạm sàn, không chặn ghi */
const FOOT_SINK = 4;

/**
 * Dòng `clash` chỉ báo của `gen walk`: bàn chân của người `id` lún không quá `FOOT_SINK · s` qua mặt trên phẳng ở cao độ
 * sàn của người (`floor` của `check`); lấn tường, cạnh đồ vẫn chặn
 */
export const footSink = (id, s) => (r) => {
  if (r.group !== "clash" || !r.floor || !(r.measure <= FOOT_SINK * s)) return false;
  const [kind, part] = (r.key ?? "").split("|");
  return kind === "người" && (part === `${id}.footL` || part === `${id}.footR`);
};

/** Dòng sự kiện của đoạn sinh */
function eventText(e) {
  const side = (x) => (x > 0 ? "phải" : "trái");
  if (e.kind === "corner")
    return `góc mềm ${Math.round(Math.abs(e.theta))}° ${side(e.theta)} (giây ${e.t.toFixed(3)})`;
  if (e.kind === "arc")
    return `cung ${Math.round(Math.abs(e.theta))}° ${side(e.theta)} bán kính ${r1(e.r)} (giây ${e.t.toFixed(3)}–${e.t1.toFixed(3)})`;
  if (e.kind === "turn")
    return `quay tại chỗ ${Math.round(Math.abs(e.delta))}° ${side(e.delta)} (giây ${e.t.toFixed(3)}–${e.t1.toFixed(3)})`;
  return `dừng ở giây ${e.t.toFixed(3)}`;
}

/**
 * Cửa sổ dải khung dày của một sự kiện (docs/14-di-muot.md mục 4): `{ label, from, to, times }`, `times` cho ô nhìn từ trên
 */
function stripOf(e, c, duration) {
  const clamp = (x) => r2(Math.min(duration, Math.max(0, x)));
  const [from, to] =
    e.kind === "corner"
      ? [e.t - rig.STEER_AHEAD - 0.25, e.t + Math.abs(e.theta) / rig.TURN_WALK + rig.TRACK_ALONG]
      : e.kind === "arc"
        ? [e.t - 0.6, e.t1 + 0.6]
        : e.kind === "stop"
          ? [e.t - c / 2 - 0.3, e.t + 0.6]
          : [e.t - 0.2, e.t1 + 0.6];
  const times =
    e.kind === "corner" || e.kind === "stop"
      ? [e.t - 0.4, e.t, e.t + 0.4]
      : [e.t, (e.t + e.t1) / 2, e.t1];
  return {
    label: `${EV_WORD[e.kind]}-${e.t.toFixed(2)}`,
    from: clamp(from),
    to: clamp(to),
    times: times.map(clamp),
  };
}

/**
 * `stickman gen walk` (docs/14-di-muot.md mục 5): người `o.cast` của cảnh `o.scene` đi qua các điểm `o.to` từ giây `o.at`
 * (số hay `@mốc±s`). Bộ sinh viết mốc `path` và clip đi / đứng của một track theo luật thời gian, thay phần từ `--at` trở
 * đi, tự kiểm (số đo đi, `check` move/clash/held so với cảnh trước khi vá) rồi vá JSON thô `scenes/<id>.json` — bytes trên
 * đĩa phải đúng `hash` lúc nạp (`o.hash` của MCP cũng vậy), bản cũ ở `.bak`. Trả `{ ok, scene, path, clips, checks, metrics,
 * strips, hash, wrote, lines, text }`; sai đầu vào, lỗi cấu trúc thì ném `GenError`, file đổi thì `GenConflict`
 */
export async function genWalk(o) {
  const root = resolve(o.dir ?? ".");
  if (!o.scene) fail("thiếu --scene <id cảnh>");
  if (!o.cast) fail("thiếu --cast <id người đi>");
  const pts = parsePoints(o.to, fail);
  const sd = sceneData(root, o);
  const { data, raw, scene, member, runtimeOf, rt0, marks } = sd;
  const rel = `scenes/${o.scene}.json`;
  if (o.hash !== undefined && o.hash !== null && sd.hash !== undefined && o.hash !== sd.hash)
    throw new GenConflict(
      `${rel} đã đổi trên đĩa so với bản đã có (hash ${String(o.hash).slice(0, 12)}…) — đọc lại cảnh rồi sinh lại`,
      sd.hash,
    );
  const id = o.cast;
  const m0 = rt0.cast.find((x) => x.id === id);
  const h = rt0.heights[id] ?? 1;
  const s = member.world.s ?? 1;

  // cờ
  const start = o.start ?? WALK_DEFAULTS.start;
  if (!["rest", "moving"].includes(start))
    fail(`--start nhận rest | moving, không phải \`${start}\``);
  const turnSide = o.turnSide ?? "auto";
  if (!["auto", "right", "left"].includes(turnSide))
    fail(`--turn-side nhận auto | right | left, không phải \`${turnSide}\``);
  const actionName = o.action ?? "walk";
  const afterName = o.after ?? "stand-3d";
  const A =
    data.actions[actionName] ??
    fail(`không có hành động \`${actionName}\` (actions/ của repo hay bộ chung)`);
  const B =
    data.actions[afterName] ??
    fail(`không có hành động \`${afterName}\` (actions/ của repo hay bộ chung)`);
  const bothLegs = (a) => ["legFar", "legNear"].every((k) => rig.actionMask(a).includes(k));
  const stride = rig.actionStride(A, m0.base);
  if (!(stride > rig.STRIDE_MIN))
    fail(
      `--action ${actionName}: ${stride < -rig.STRIDE_MIN ? "đi lùi" : "không có sải chân"} (sải ${r1(stride)}) — gen walk cần hành động đi tới`,
    );
  if (!bothLegs(A)) fail(`--action ${actionName} phải ghi cả hai chân (\`legFar\`, \`legNear\`)`);
  if (Math.abs(rig.actionStride(B, m0.base)) > rig.STRIDE_MIN)
    fail(`--after ${afterName} có sải chân — cần hành động đứng`);
  if (!bothLegs(B)) fail(`--after ${afterName} phải ghi cả hai chân để chặn chân của clip đi`);
  const vNat = naturalSpeed(A, h, s, m0.base);
  const v = numFlag(o.speed, vNat, "--speed", (x) => x > 0, "là số > 0");
  const radius = numFlag(o.radius, 0, "--radius", (x) => x >= 0, "là số ≥ 0");
  const [tt0, tt1] = TURN_TIME_RANGE;
  const turnTime = numFlag(
    o.turnTime,
    WALK_DEFAULTS.turnTime,
    "--turn-time",
    (x) => x >= tt0 && x <= tt1,
    `trong ${tt0}…${tt1} giây mỗi 90°`,
  );
  const hold = numFlag(o.hold, WALK_DEFAULTS.hold, "--hold", (x) => x >= HOLD_MIN, `≥ ${HOLD_MIN}`);
  const blend = numFlag(
    o.blend,
    WALK_DEFAULTS.blend,
    "--blend",
    (x) => x >= 0 && x <= 1,
    "trong 0…1",
  );
  const c = +((stride * h * s) / v).toFixed(3);

  // chỗ đứng lúc `--at`
  const rawM = raw.cast.find((x) => x.id === id);
  const keys0 = m0.world.path;
  const atIn = timeOf(o.at, marks, "--at");
  if (atIn === undefined && keys0)
    fail(`--at bắt buộc khi \`${id}\` đã có \`world.path\` (giây hay \`@mốc±s\` bắt đầu đoạn đi)`);
  const at = atIn ?? 0;
  if (at < 0 || at > rt0.duration) fail(`--at ${at} ngoài cảnh (0 … ${rt0.duration} s)`);
  let P0;
  let yaw0;
  if (keys0) {
    let i = 0;
    while (i + 1 < keys0.length && keys0[i + 1].t <= at + 1e-9) i++;
    const a = keys0[i];
    const b = a.t < at - 1e-9 ? keys0[i + 1] : undefined;
    if (a.sit || b?.sit) fail(`\`${id}\` đang ngồi lúc giây ${at} — gen walk cần người đứng`);
    if (b && (b.at[0] !== a.at[0] || b.at[2] !== a.at[2]))
      fail(
        `\`${id}\` đang đi lúc giây ${at} (mốc \`path\` giây ${a.t} → ${b.t}) — chọn --at ở một mốc đứng, hay sau mốc dừng`,
      );
    if (b && b.yaw !== a.yaw)
      fail(
        `\`${id}\` đang quay tại chỗ lúc giây ${at} (giây ${a.t} → ${b.t}) — chọn --at ở mốc cuối cú quay`,
      );
    [P0, yaw0] = [a.at, a.yaw];
  } else {
    if (member.world.sit) fail(`\`${id}\` đang ngồi (\`world.sit\`) — gen walk cần người đứng`);
    [P0, yaw0] = [member.world.at, member.world.yaw ?? 0];
  }
  const rawPath = rawM.world.path ?? [];
  const timeAt = (v2) => rig.markTime(v2, marks);
  const keptPath = rawPath.filter((k) => timeAt(k.t) < at - 1e-9);
  const dropped = rawPath.filter((k) => timeAt(k.t) >= at - 1e-9);
  if (dropped.some((k) => k.sit))
    fail(
      `mốc \`path\` từ giây ${at} có mốc ngồi (\`sit\`) — gen walk không thay mốc ngồi; chọn --at sau đoạn ngồi`,
    );
  if (start === "moving" && keys0?.some((k) => k.t < at - 1e-9))
    fail(
      `--start moving: \`${id}\` đã có mốc \`path\` trước giây ${at} — vào cảnh đang đi chỉ khi chưa có \`path\` trước --at; nối sau một đoạn thì --start rest`,
    );

  // track ghi clip
  const rawTracks = rawM.tracks ?? [];
  const T =
    o.track !== undefined
      ? rawTracks.findIndex((tr) => tr.name === o.track)
      : (rig.legSourceAt(rt0, id, at)?.track ?? -1);
  const trackName = T >= 0 ? (rawTracks[T].name ?? `#${T}`) : (o.track ?? "chan");
  const keptClips = T >= 0 ? rawTracks[T].clips.filter((k) => timeAt(k.start) < at - 1e-9) : [];
  const gone = T >= 0 ? rawTracks[T].clips.filter((k) => timeAt(k.start) >= at - 1e-9) : [];
  const equip = gone.find((k) => k.equip);
  if (equip)
    fail(
      `clip \`${equip.action ?? "rỗng"}\` giây ${equip.start} của track \`${trackName}\` có \`equip\` — gen walk thay mọi clip từ --at; dời \`equip\` sang track khác`,
    );
  const tracksWith = (clips) => {
    const out = rawTracks.map((tr, k) => (k === T ? { ...tr, clips } : tr));
    if (T < 0) out.unshift({ name: trackName, clips });
    return out.filter((tr) => tr.clips.length);
  };

  // khởi hành từ đứng (luật 11): đo trên cảnh đã bỏ phần sẽ thay
  if (start === "rest") {
    const prefix = sceneWithWalk(raw, id, {
      path: keptPath,
      at: P0,
      yaw: yaw0,
      tracks: tracksWith(keptClips),
    });
    const parsed = rig.parseScene(prefix);
    let rtP;
    try {
      rtP = parsed.success ? runtimeOf(parsed.data) : undefined;
    } catch {
      rtP = undefined;
    }
    const still = (rt, keys, t) =>
      !rig.walkerTable(rt, id, h)?.clipAt(t) &&
      !(keys ?? []).some(
        (k, i) =>
          keys[i + 1] &&
          (keys[i + 1].at[0] !== k.at[0] || keys[i + 1].at[2] !== k.at[2]) &&
          k.t < t - 1e-9 &&
          keys[i + 1].t > t - REST_BEFORE + 1e-9,
      );
    if (rtP && !still(rtP, keys0, at)) {
      let ok;
      for (let t = at; t <= rt0.duration + 1e-9 && ok === undefined; t = +(t + 0.01).toFixed(2))
        if (still(rt0, keys0, t)) ok = t;
      fail(
        `--start rest: \`${id}\` chưa đứng yên lúc giây ${at} (clip đi còn lái chân hay \`path\` vừa dời chỗ dưới ${REST_BEFORE} s trước)${ok !== undefined ? ` — giây sớm nhất hợp lệ ${ok}` : ""}`,
      );
    }
  }
  const afterAtStart = !(keptClips.length && keptClips[keptClips.length - 1].action === afterName);
  // clip đầu của track ở giây 0 không hoà: hoà từ track trống là tư thế nền, không soạn ở `side`
  const afterBlend = keptClips.length || at > 0 ? blend : 0;
  // giây `path` đã đứng yên trước `--at`: từ mốc dời chỗ cuối, không có thì từ đầu cảnh
  let rested = at;
  (keys0 ?? []).forEach((k, i) => {
    const n = keys0[i + 1];
    if (n && n.t <= at + 1e-9 && (n.at[0] !== k.at[0] || n.at[2] !== k.at[2])) rested = at - n.t;
  });

  // lập timeline
  const eye = rt0.lens && [rt0.lens.eye[0], rt0.lens.eye[2]];
  const plan = planWalk({
    at,
    start,
    P0,
    yaw0,
    pts,
    v,
    c,
    b: blend,
    s,
    radius,
    turnTime,
    turnSide,
    eye,
    action: actionName,
    after: afterName,
    afterAtStart,
    afterBlend,
    rested,
    fail,
  });
  const head =
    !keys0 && at > 0 && start === "rest"
      ? [{ t: 0, at: rawM.world.at, yaw: rawM.world.yaw ?? 0 }]
      : [];
  const pathOut = [...keptPath, ...head, ...plan.keys];
  const next = sceneWithWalk(raw, id, {
    path: pathOut,
    tracks: tracksWith([...keptClips, ...plan.clips]),
  });
  const parsedA = rig.parseScene(next);
  if (!parsedA.success)
    fail(`cảnh sau khi sinh không qua schema: ${parsedA.error.issues?.[0]?.message}`);
  let rtA;
  try {
    rtA = runtimeOf(parsedA.data);
  } catch (e) {
    fail(`cảnh sau khi sinh không dựng được: ${e.message}`);
  }
  const until = plan.end + hold;

  // nguồn chân hiệu dụng trong quãng phải là track ghi clip
  const Tnew = T >= 0 ? T : 0;
  const foreign = new Map();
  for (const t of sampleTimes(at, Math.min(until, rtA.duration))) {
    const src = rig.legSourceAt(rtA, id, t);
    if (!src || src.track === Tnew) continue;
    const tr = parsedA.data.cast.find((x) => x.id === id).tracks[src.track];
    const k = `${src.track}:${src.clip}`;
    if (!foreign.has(k))
      foreign.set(
        k,
        `track \`${tr.name ?? `#${src.track}`}\` clip \`${tr.clips[src.clip].action ?? "rỗng"}\` từ giây ${sec(t)}`,
      );
  }
  if (foreign.size)
    fail(
      `track khác ghi chân trong quãng ${at}–${r3(until)} s, đè clip đi của track \`${trackName}\`: ${[...foreign.values()].join("; ")} — dời clip ấy, thu \`mask\` của nó khỏi chân, hay --track <track ấy>`,
    );
  if (rtA.duration < until - 1e-9)
    fail(
      `cảnh hết ở giây ${r3(rtA.duration)}, cần tới ${r3(until)} — khai \`duration\` cho cảnh, chọn --after dài hơn hay giảm --hold`,
    );

  // tự kiểm
  const metrics = (() => {
    const tr = rig.gaitTrace(
      rtA,
      id,
      h,
      rtA.bodies[id],
      Math.max(0, at - 0.5),
      Math.min(until, rtA.duration),
    );
    return tr ? rig.gaitMetrics(tr, gaitLimits(root)) : [];
  })();
  const gait = metrics.filter((r) => !r.off && (r.n > 0 || r.missing)).map(gaitRow);
  const holds = (rawM.world.hands ?? []).some((k) => k.right?.hold || k.left?.hold);
  const world = await worldChecks({
    dir: root,
    before: scene,
    after: parsedA.data,
    groups: ["move", "clash", ...(holds ? ["held"] : [])],
    ...(o.stage && { spec: o.stage.spec, held: o.stage.held }),
  });
  const ignore = footSink(id, s);
  const failed = checkFailed([], world, ignore);
  const checks = checkRows(gait, world, ignore);
  const strips = plan.events.map((e) => stripOf(e, c, rtA.duration));

  // dòng in
  const opt = (flag, val) =>
    val === undefined || val === null || val === "" ? "" : ` --${flag} ${val}`;
  const again =
    `pnpm exec stickman gen walk --scene ${o.scene} --cast ${id} --at ${at} --start ${start} --to "${pointsText(pts)}"` +
    opt("speed", o.speed) +
    opt("action", o.action) +
    opt("radius", o.radius) +
    opt("turn-time", o.turnTime) +
    opt("turn-side", o.turnSide) +
    opt("hold", o.hold) +
    opt("track", o.track) +
    opt("after", o.after) +
    opt("blend", o.blend);
  const out = (name) => `tmp/walk/${o.scene}-${id}-${name}.png`;
  const lines = [
    `gen walk \`${id}\` trong ${o.scene}: ${pts.length} điểm, ${plan.events.map(eventText).join(", ")}, ${r1(v)} đơn vị/s (${actionName}, cycle ${c.toFixed(3)} s)`,
    `  path: ${plan.keys.length} mốc (thay ${dropped.length}) · track \`${trackName}\`: ${plan.clips.map((k) => `${k.action} ${k.start}`).join(" → ")}`,
    ...plan.notes.map((n) => `  ${n}`),
    ...plan.warnings.map((w) => `  cảnh báo: ${w}`),
    "  tự kiểm:",
    checkTable(gait, world, ignore)
      .split("\n")
      .map((l) => `  ${l}`)
      .join("\n"),
    "  dải khung:",
    ...strips.flatMap((st) => [
      `    pnpm exec stickman-render --scene ${rel} --from ${st.from} --to ${st.to} --every 0.05 --cols 12 --out ${out(st.label)}`,
      `    pnpm exec stickman-render --scene ${rel} --skeleton --views top --times ${st.times.join(",")} --trails hip,feet --span 0.6 --cast ${id} --out ${out(`${st.label}-top`)}`,
    ]),
    `  chạy lại: ${again}`,
  ];

  // ghi
  let wrote = null;
  if (failed && !o.force) {
    const groups = new Set(world.rows.filter((r) => !ignore(r)).map((r) => r.group));
    const hints = [
      groups.has("move") &&
        "giật, trượt: bo góc bằng --radius, giảm --speed, hay đổi --start và hướng quãng đầu",
      groups.has("clash") && "đi vào đồ: chọn điểm khác",
    ].filter(Boolean);
    lines.push(
      `lỗi: tự kiểm không đạt — không ghi ${rel} (ghi kèm cảnh báo bằng --force${hints.map((x) => `; ${x}`).join("")})`,
    );
  } else if (o.dryRun || !sd.bytes) {
    lines.push(
      `chạy khô: không ghi ${rel}`,
      `  path: ${JSON.stringify(plan.keys)}`,
      `  clip của track \`${trackName}\`: ${JSON.stringify(plan.clips)}`,
    );
  } else {
    const text = sd.bytes.toString("utf8");
    const body = await formatLike(text, next, async (t) =>
      prettier.format(t, {
        ...(await prettier.resolveConfig(sd.file)),
        filepath: sd.file,
        parser: "json",
      }),
    );
    // đọc lại, so, ghi liền một mạch không `await`
    const now = readFileSync(sd.file);
    if (sha(now) !== sd.hash)
      throw new GenConflict(`${rel} đổi trên đĩa trong lúc sinh — chạy lại`, sha(now));
    if (body === text) {
      wrote = { file: rel, hash: sd.hash, same: true };
      lines.push(`không đổi ${rel}: file đã đúng bản sinh`);
    } else {
      writeWithBak(sd.file, body, now);
      wrote = { file: rel, hash: sha(body) };
      lines.push(
        `${failed ? "cảnh báo: tự kiểm không đạt, --force nên vẫn ghi" : "đã ghi"} ${rel} (bản cũ ${rel}.bak)`,
      );
    }
  }
  return {
    ok: !failed,
    wrote,
    file: rel,
    name: `${actionName} · ${id}`,
    scene: next,
    path: plan.keys,
    clips: plan.clips,
    track: trackName,
    events: plan.events,
    checks,
    metrics,
    strips,
    world,
    ...(sd.hash && { hash: sd.hash }),
    lines,
    text: lines.join("\n"),
  };
}

/** Tên vai trò cho dòng in */
const ROLE_LABEL = {
  pourer: "bình rót",
  vessel: "vật đựng",
  seat: "mặt ngồi",
  armrest: "tay vịn",
  backrest: "lưng ghế",
  footrest: "để chân",
  tabletop: "mặt bàn",
};

/**
 * Các kiểu của `stickman gen`: `run` chạy, `describe` một dòng, `roles` các slot (chỗ trong phép tính cần một vật mang vai
 * trò, docs/13 mục 6.1), `page` bản mô tả trang soi (`GEN_PAGES`). `need`: `always`, `auto`, hay điều kiện theo tham số;
 * `find`: cách tìm khi không có cờ; `flag`: cờ CLI (và tham số MCP cùng tên); `per: "side"` mỗi bên người một mục;
 * `point: true` nhận cả một điểm thế giới
 */
export const GEN_KINDS = {
  pour: {
    run: genPour,
    describe: "rót: điểm rót của bình đứng yên trên đích rót của cảnh khi nâng đuôi bình",
    roles: [
      { slot: "bottle", role: "pourer", need: "always", find: "heldRight", flag: "item" },
      { slot: "cup", role: "vessel", need: "always", find: "flag", flag: "cup", point: true },
    ],
    page: GEN_PAGES.pour,
  },
  sit: {
    run: genSit,
    describe: "dáng ngồi nền theo đúng ghế của cảnh: chân, lưng, tay chọn kiểu, bàn chân trên sàn",
    roles: [
      { slot: "seat", role: "seat", need: "auto", find: "underHip" },
      { slot: "backrest", role: "backrest", need: "auto", find: "sameAsSeat", flag: "backrest" },
      {
        slot: "armrest",
        role: "armrest",
        need: { hands: ["armrest", "fold"] },
        find: "sameAsSeat",
        flag: "armrest",
        per: "side",
      },
      { slot: "table", role: "tabletop", need: { hands: "table" }, find: "ahead", flag: "table" },
      { slot: "footrest", role: "footrest", need: "auto", find: "sameAsSeat", flag: "footrest" },
    ],
    page: GEN_PAGES.sit,
  },
  walk: {
    run: genWalk,
    describe:
      "đi theo các điểm sàn: mốc `path` và clip đi / đứng ghi vào cảnh, rẽ khi đang đi, dừng, quay tại chỗ (docs/14)",
    roles: [],
    page: GEN_PAGES.walk,
  },
};

/** Nghĩa của `find` cho bảng slot */
const FIND_LABEL = {
  underHip: "mặt ngồi chứa hình chiếu điểm ngồi",
  sameAsSeat: "của cùng ghế (cùng chủ với mặt ngồi), đúng phía",
  ahead: "vật trước mặt trong tầm, gần nhất",
  heldRight: "món tay phải giải phẫu đang cầm, không thì --item (mặc định binh)",
  flag: "chỉ theo cờ",
};
/** Cờ của slot nhận gì */
const FLAG_VALUE = {
  item: "<món>",
  cup: "<người | người:món | món | vật | x,y,z>",
  backrest: "<vật | vật#mục | khoảng sau hông | none>",
  armrest: "<vật | x,y,z>",
  table: "<vật | vật#mục | y | y,mép gần | none>",
  footrest: "<vật | vật#mục | y | none>",
};

/** Bảng slot của kiểu `kind` (dòng chữ cho `stickman gen <kiểu> --help` và tool `gen` của MCP) */
export function slotTable(kind) {
  const k = GEN_KINDS[kind];
  if (!k) return "";
  const need = (x) =>
    x.need === "always"
      ? "bắt buộc"
      : x.need === "auto"
        ? "dùng nếu có"
        : `bắt buộc khi ${Object.entries(x.need)
            .map(([p, v]) => `--${p} ${[v].flat().join(" | ")}`)
            .join(", ")}, không thì dùng nếu có`;
  if (!k.roles.length) return `gen ${kind} không cần vai trò của đồ`;
  return [
    `vai trò cần (slot) của gen ${kind}:`,
    ...k.roles.map(
      (x) =>
        `  ${x.slot.padEnd(9)} \`${x.role}\` (${ROLE_LABEL[x.role]}) — ${need(x)}; tìm: ${FIND_LABEL[x.find]}${x.flag ? `; cờ --${x.flag} ${FLAG_VALUE[x.flag] ?? "<vật>"}` : ""}${x.per === "side" ? "; mỗi bên một mục" : ""}${x.point ? "; nhận cả điểm x,y,z" : ""}`,
    ),
  ].join("\n");
}

/** `stickman gen <kind>`: chạy kiểu `kind` với tham số `o` */
export async function genWorkspace({ kind, ...o }) {
  const k =
    GEN_KINDS[kind] ??
    fail(`\`stickman gen\` chưa có kiểu \`${kind}\`; có: ${Object.keys(GEN_KINDS).join(", ")}`);
  return k.run(o);
}
