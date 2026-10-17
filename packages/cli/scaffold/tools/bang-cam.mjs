// Bảng duyệt kiểu cầm: `pnpm bang-cam [--mon a,b] [--ai a,b] [--out dir] [--tab N]`
//
// Mỗi món của `held/` × mỗi kiểu cầm × hai cỡ tay (người có bàn tay nhỏ nhất và lớn nhất trong `characters/`) × ba góc
// (trước, chéo, ngang): một người đứng cầm món bằng kiểu ấy, ống kính đặt sát bàn tay như `pnpm can-tay`, kèm số đo luật
// `held` của `check` ở đúng khung ấy. Kiểu một tay có khai `left` thì thêm hàng tay trái. Ra
//
//   <out>/<món>.jpg      một bảng mỗi món: hàng là kiểu cầm × tay × người, cột là góc; nhãn in số đo
//   <out>/index.md       mọi ô: món#kiểu, tay, người, dáng lấy từ đâu, số đo, dòng `check` báo
//   <out>/index.html     cùng nội dung, kèm ảnh bảng
//   <out>/o/…png         ảnh từng ô (800×800), cái mà lệnh so đọc
//   <out>/do.json        số đo từng ô
//
// Dáng tay: mốc `world.hands` đầu tiên trong `scenes/` cầm đúng `món#kiểu` ấy (ưu tiên `thu-grip*`, rồi `thu-*`, rồi cảnh
// khác; cùng hạng thì tên cảnh, giây), bỏ phần đè ý định để soi ý định mặc định của kiểu cầm. Không cảnh nào dùng thì
// tay đặt trước ngực; kiểu treo thì khuỷu gập chữ V (cổ tay trước vai) hay tay dang ngoài túi đeo vai, ảnh lấy cả món và
// đoạn tay. Người đứng `stand-3d` ở `--at` (mặc định `0,0,0`), quay `--yaw` (mặc định 90), ống kính chính diện cách 720. Cảnh dựng tạm mang tên `bang-cam`: repo khai `CANH_3D["bang-cam"]` (`src/khoi3d/canh.ts`) đăng ký lưới
// cho mọi món mà người trong cảnh khai `hold` (`cast.provide(món, lưới, id người)`). Tất định: cùng code, cùng dữ liệu
// là cùng pixel.
//
// So hồi quy (sau mỗi lần nâng rig, khi đã có bảng chuẩn):
//
//   pnpm bang-cam --luu-chuan   chép bảng vừa sinh ở <out> sang <chuẩn> — chỉ chạy sau khi đã duyệt bảng bằng mắt
//   pnpm bang-cam --so          sinh lại bảng rồi so từng ô với <chuẩn>: in ô đổi (số pixel khác, số đo trước → sau),
//                               ảnh khác biệt ở <out>/khac/; chưa có chuẩn thì báo rồi thoát (mã 2), không sinh gì
//
//   --chuan  thư mục bảng chuẩn (mặc định tmp/bang-cam-chuan), ngoài git
//   --mon    món, phẩy ngăn (mặc định mọi file của `held/` trong repo)
//   --ai     file nhân vật (không đuôi), phẩy ngăn — thay cho cặp tay nhỏ nhất / lớn nhất
//   --at     chỗ đứng `x,y,z` (thế giới rig); --yaw góc quay người
//   --t      giây chụp và đo (mặc định 0.5; cảnh dài 1 s, cầm từ giây 0)
//   --tab    số tab song song (mặc định nửa số nhân)
//
// docs/05-repo-video.md § Bảng kiểu cầm, docs/01-rig.md § Kiểu cầm.
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import * as rig from "@stickman3d/sketch";
import {
  deepContext,
  heldFrame,
  heldItemsFrame,
  heldOptions,
  worldData,
  worldScene,
} from "@stickman3d/cli";
import { defaultTabs, openSoi, renderSoi } from "./soi.mjs";

const argv = process.argv.slice(2);
const flag = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i < 0 ? d : argv.splice(i, 2)[1];
};
const bool = (k) => {
  const i = argv.indexOf(`--${k}`);
  if (i >= 0) argv.splice(i, 1);
  return i >= 0;
};
const root = resolve(".");
const outDir = resolve(flag("out", "tmp/bang-cam"));
const chuanDir = resolve(flag("chuan", "tmp/bang-cam-chuan"));
const monXin = flag("mon")?.split(",");
const aiXin = flag("ai")?.split(",");
const AT = (flag("at", "0,0,0") ?? "").split(",").map(Number);
const YAW = Number(flag("yaw", 90));
const T = Number(flag("t", 0.5));
const tabs = Number(flag("tab", defaultTabs()));
const luuChuan = bool("luu-chuan");
const so = bool("so");
if (
  argv.length ||
  AT.length !== 3 ||
  AT.some((v) => !Number.isFinite(v)) ||
  !Number.isFinite(YAW)
) {
  console.error(
    "dùng: pnpm bang-cam [--mon a,b] [--ai a,b] [--at x,y,z] [--yaw 90] [--t 0.5] [--out dir] [--tab N]\n" +
      "      pnpm bang-cam --luu-chuan [--out dir] [--chuan dir]\n" +
      "      pnpm bang-cam --so [--chuan dir] [...]",
  );
  process.exit(1);
}
const rel = (p) => relative(root, p) || ".";

// ---- lưu chuẩn: chép bảng đã sinh, không vẽ gì ----
if (luuChuan) {
  if (!existsSync(join(outDir, "do.json"))) {
    console.error(
      `chưa có bảng ở ${rel(outDir)} — chạy \`pnpm bang-cam\`, duyệt, rồi mới lưu chuẩn`,
    );
    process.exit(1);
  }
  rmSync(chuanDir, { recursive: true, force: true });
  mkdirSync(chuanDir, { recursive: true });
  for (const f of ["o", "do.json", "index.md"])
    if (existsSync(join(outDir, f)))
      cpSync(join(outDir, f), join(chuanDir, f), { recursive: true });
  const n = JSON.parse(readFileSync(join(chuanDir, "do.json"), "utf8")).cells.length;
  console.log(`đã lưu bảng chuẩn: ${n} hàng → ${rel(chuanDir)}`);
  process.exit(0);
}
if (so && !existsSync(join(chuanDir, "do.json"))) {
  console.error(
    `chưa có bảng chuẩn (${rel(chuanDir)}) — duyệt bảng \`pnpm bang-cam\` rồi \`pnpm bang-cam --luu-chuan\`; không so gì`,
  );
  process.exit(2);
}

// ---- dữ liệu ----
const data = worldData(root);
const listJson = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
    : [];
const heldRepo = listJson(join(root, "held")).map((f) => f.replace(/\.json$/, ""));
const items = monXin ?? heldRepo;
for (const m of items)
  if (!data.held[m]) throw new Error(`không có held/${m}.json (hay file hỏng)`);

/** Cỡ bàn tay của một nhân vật (đơn vị rig): bề ngang `k` của `cladHand` nhân chiều cao; người không mặc đồ thì `1` */
const handSize = (c) => {
  if (!c.palette.clad) return c.rig.height;
  const w = rig.limbWidths(c.palette);
  return rig.cladHand(w.sleeve, c.rig.stroke, rig.RIG.foreArm ?? 100).k * c.rig.height;
};
const people = (() => {
  if (aiXin)
    return aiXin.map((n) => {
      const file = n.endsWith(".json") ? n : `${n}.json`;
      if (!data.characters[file]) throw new Error(`không có characters/${file}`);
      return { file, size: handSize(data.characters[file]) };
    });
  const all = listJson(join(root, "characters"))
    .filter((f) => data.characters[f])
    .map((file) => ({ file, size: handSize(data.characters[file]) }))
    .sort((a, b) => a.size - b.size || a.file.localeCompare(b.file));
  if (!all.length) throw new Error("characters/ trống: chỉ định người bằng --ai");
  return all.length === 1 ? all : [all[0], all[all.length - 1]];
})();

// ---- dáng tay: mốc đầu tiên trong scenes/ cầm đúng món#kiểu ----
const RAD = Math.PI / 180;
const fwd = (yaw) => [Math.cos(yaw * RAD), 0, -Math.sin(yaw * RAD)];
const rgt = (yaw) => [-Math.sin(yaw * RAD), 0, -Math.cos(yaw * RAD)];
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const r2 = (n) => Math.round(n * 100) / 100;
/** Hướng / điểm thế giới của người đứng ở `at0` quay `yaw0` sang người ở `at1` quay `yaw1`; `flip` soi gương trái–phải */
const moveDir = (d, yaw0, yaw1, flip) => {
  const f = dot(d, fwd(yaw0));
  const r = dot(d, rgt(yaw0)) * (flip ? -1 : 1);
  return fwd(yaw1).map((v, i) => r2(v * f + rgt(yaw1)[i] * r + (i === 1 ? d[1] : 0)));
};
const holdKey = (h) => (typeof h === "string" ? h : h && `${h.item}#${h.grip}`);
const baseKey = (k) => k && k.replace(/^([^#:]+):[^#]*/, "$1");
const rank = (name) => (name.startsWith("thu-grip") ? 0 : name.startsWith("thu-") ? 1 : 2);
const sceneFiles = listJson(join(root, "scenes"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
const sources = new Map(); // "món#kiểu|side" → { scene, id, t, at, yaw, hands: { right?, left? } }
for (const name of sceneFiles) {
  let j;
  try {
    j = JSON.parse(readFileSync(join(root, "scenes", `${name}.json`), "utf8"));
  } catch {
    continue;
  }
  for (const c of j.cast ?? [])
    for (const k of c.world?.hands ?? [])
      for (const side of ["right", "left"]) {
        const key = baseKey(holdKey(k[side]?.hold));
        if (!key || sources.has(`${key}|${side}`)) continue;
        const other = side === "right" ? "left" : "right";
        // tay kia chỉ chép khi nó là tay phụ của cùng món (kiểu `both`): cùng tên đủ (`vali:2` là món khác)
        const g = data.held[key.split("#")[0]]?.grips[key.split("#")[1]];
        const same = !!g?.both && holdKey(k[other]?.hold) === holdKey(k[side].hold);
        sources.set(`${key}|${side}`, {
          scene: name,
          id: c.id,
          t: k.t,
          at: c.world.at ?? [0, 0, 0],
          yaw: c.world.yaw ?? 0,
          hands: { [side]: k[side], ...(same && { [other]: k[other] }) },
        });
      }
}

/** Một tay của mốc nguồn sang người của bảng: bỏ đè ý định, đổi `at` / `elbow` theo chỗ đứng, soi gương nếu đổi tay */
const copyHand = (h, src, key, flip) => {
  const out = {};
  for (const f of ["to", "side", "offset", "point", "stretch", "bend"])
    if (h[f] !== undefined) out[f] = h[f];
  if (h.at) {
    const d = h.at.map((v, i) => v - src.at[i]);
    out.at = moveDir(d, src.yaw, YAW, flip).map((v, i) => r2(v + AT[i]));
  }
  if (h.elbow) out.elbow = moveDir(h.elbow, src.yaw, YAW, flip);
  out.hold = key;
  return out;
};

/** Mốc tay của ô `key` (món#kiểu) cầm bằng tay `side`: từ cảnh, hay mặc định trước ngực */
function handsFor(key, side) {
  const other = side === "right" ? "left" : "right";
  const own = sources.get(`${key}|${side}`);
  const mir = !own && sources.get(`${key}|${other}`);
  const src = own || mir;
  if (src) {
    const hands = {};
    for (const [s, h] of Object.entries(src.hands)) {
      const to = mir ? (s === "right" ? "left" : "right") : s;
      hands[to] = copyHand(h, src, key, !!mir);
    }
    return { hands, from: `${src.scene} ${src.id} ${src.t}s${mir ? " (soi gương)" : ""}` };
  }
  const lr = side === "right" ? -1 : 1;
  // kiểu treo: bàn tay tự do, cánh tay đặt cho chỗ treo — khuỷu gập chữ V (cổ tay trước vai), hay tay dang ngoài túi đeo vai
  const on = data.held[key.split("#")[0]]?.grips[key.split("#")[1]]?.on;
  if (on === "elbow")
    return {
      hands: {
        [side]: {
          to: "shoulder",
          offset: [36, 30, 0],
          point: "wrist",
          elbow: moveDir([0.7 * lr, 1, -0.2], 90, YAW, false),
          hold: key,
        },
      },
      from: "mặc định (khuỷu gập, cổ tay trước vai)",
    };
  if (on === "shoulder")
    return {
      hands: {
        [side]: {
          at: moveDir([90 * lr, -185, -10], 90, YAW, false).map((v, i) => r2(v + AT[i])),
          point: "wrist",
          elbow: moveDir([0.6 * lr, 1, 0], 90, YAW, false),
          hold: key,
        },
      },
      from: "mặc định (tay dang ngoài túi)",
    };
  return {
    hands: {
      [side]: {
        to: "chest",
        offset: [55, 40, 22],
        point: "grip",
        elbow: moveDir([0, 1, 0.4 * lr], 90, YAW, false),
        hold: key,
      },
    },
    from: "mặc định (trước ngực)",
  };
}

// ---- ô ----
const slug = (s) => s.replace(/[^a-zA-Z0-9-]+/g, "-");
const cells = [];
for (const item of items) {
  const spec = data.held[item];
  for (const [grip, g] of Object.entries(spec.grips)) {
    const sides = g.both ? [g.both.lead] : g.left ? ["right", "left"] : ["right"];
    for (const side of sides)
      for (const p of people) {
        const key = `${item}#${grip}`;
        const { hands, from } = handsFor(key, side);
        const id = `bang-cam-${slug(item)}-${slug(grip)}-${side === "right" ? "P" : "T"}-${slug(p.file.replace(/\.json$/, ""))}`;
        const eye = fwd(YAW).map((v, i) => r2(AT[i] + v * 720 + (i === 1 ? -330 : 0)));
        const scene = {
          name: "bang-cam",
          frame: "wide",
          duration: 1,
          camera: [{ t: 0, x: 0, y: 0, zoom: 1 }],
          lens: {
            eye,
            yaw: r2(Math.atan2(AT[0] - eye[0], AT[2] - eye[2]) / RAD),
            pitch: 4,
            f: 560,
            cx: 0,
            cy: 0,
          },
          cast: [
            {
              id: "cam",
              character: p.file,
              tracks: [{ name: "than", clips: [{ action: "stand-3d", start: 0 }] }],
              world: { at: AT, yaw: YAW, hands: [{ t: 0, ...hands }] },
            },
          ],
        };
        cells.push({
          id,
          item,
          grip,
          key,
          side,
          person: p.file.replace(/\.json$/, ""),
          size: r2(p.size),
          from,
          two: !!g.both,
          carry: !!g.on && g.on !== "hand",
          scene,
        });
      }
  }
}
if (!cells.length) throw new Error("không có ô nào: held/ trống?");

// ---- đo: cảnh three trong Node, luật `held` như `check` ----
const held = heldOptions(root);
if (held.error) throw new Error(held.error);
const ctx = await deepContext({ dir: root, names: [], groups: ["held"], held });
if (!ctx.world)
  throw new Error("repo không khai `stickman.world` hay nạp hỏng — không dựng được cảnh three");
const r1 = (n) => Math.round(n * 10) / 10;
const VN = { thumb: "cái", index: "trỏ", middle: "giữa", ring: "áp út", pinky: "út" };
const RULE = {
  pierce: "xuyên",
  wrap: "ôm hở",
  loose: "lỏng",
  grip: "nắm xa",
  up: "up lệch",
  face: "mặt lệch",
  reach: "không tới",
  seat: "quai rời chỗ treo",
  body: "lồng người",
  jump: "nhảy",
  pose: "dáng",
  drift: "trôi",
};

/** Số đo một bàn tay (hay một món treo): chuỗi ngắn cho nhãn */
const tomTat = (s) => {
  if (s.on)
    return [
      `treo ${s.on === "elbow" ? "khuỷu" : "vai"}`,
      `quai ${r1(s.seat)}`,
      ...(s.bend !== undefined ? [`khuỷu ${Math.round(s.bend)}°/${Math.round(s.rise)}°`] : []),
      `thân ${r1(s.body.gap)} ${s.body.part}`,
      `đẩy ${Math.round(s.swing)}°`,
    ].join(" · ");
  const a = [`lún ${r1(s.pierce.depth)}`];
  const open = s.wrap && s.fingers ? rig.heldOpen(s) : [];
  if (open.length) a.push(`hở ${open.map((f) => `${VN[f]} ${r1(s.fingers[f])}`).join(", ")}`);
  a.push(`nắm ${r1(s.grip)}`);
  if (!["edge", "pinch", "hook"].includes(s.pose))
    a.push(`lòng ${r1(s.palm.gap)}/${Math.round(s.palm.angle)}°`);
  if (s.intent)
    a.push(
      `${s.intent.rule} ${Math.round(s.intent.err)}°${s.intent.clamped.length ? ` kẹp ${s.intent.clamped.join("+")}` : ""}`,
    );
  if (s.reach) a.push(`tới ${r1(s.reach.gap)}`);
  return a.join(" · ");
};

for (const c of cells) {
  const parsed = rig.parseScene(c.scene);
  if (!parsed.success) {
    c.error = `scene hỏng: ${parsed.error.issues?.[0]?.message ?? parsed.error}`;
    continue;
  }
  const sc = parsed.data;
  const ch = data.characters[`${c.person}.json`];
  const heights = { cam: ch.rig.height };
  const bodies = { cam: rig.body3(ch) };
  let rt;
  try {
    rt = rig.resolveScene(sc, data.actions, data.animals, data.props, heights, bodies, data.held);
  } catch (e) {
    c.error = `resolveScene: ${e.message}`;
    continue;
  }
  const w = worldScene(
    ctx.world,
    {
      id: c.id,
      scene: sc,
      runtime: rt,
      characters: data.characters,
      actions: data.actions,
      animals: data.animals,
      props: data.props,
    },
    "bang-cam",
  );
  if (!w || w.error) {
    c.error =
      w?.error ??
      'không có `CANH_3D["bang-cam"]` (src/khoi3d/canh.ts): repo phải khai cảnh three cho bảng';
    continue;
  }
  const frame = heldFrame(
    rt,
    w,
    (t, e) => (c.error = `cảnh three ném lỗi ở giây ${t}: ${e.message}`),
  );
  const items3 = heldItemsFrame(w);
  try {
    const issues = rig.sceneHeld(rt, { ...held, frame, ...(items3 && { items: items3 }) });
    c.lines = issues.map((s) => rig.heldLine(s));
    c.rules = [...new Set(issues.map((s) => s.rule))];
  } catch (e) {
    c.error = `sceneHeld: ${e.message}`;
  }
  const rows = frame(T) ?? [];
  w.scene.root.updateMatrixWorld(true);
  const order = (h) => (h === (c.side === "right" ? "R" : "L") ? 0 : 1);
  c.hands = rows
    .filter((s) => s.id === "cam")
    .sort((a, b) => order(a.hand) - order(b.hand))
    .map((s) => ({
      hand: s.hand,
      // món treo: tâm khung ảnh giữa chỗ treo và đáy món
      at: (s.on ? s.at.map((v, i) => v + (i === 1 ? data.held[c.item].size[1] / 2 : 0)) : s.at).map(
        r2,
      ),
      text: tomTat(s),
      raw: s.on
        ? { on: s.on, seat: s.seat, bend: s.bend, rise: s.rise, body: s.body, swing: s.swing }
        : {
            pierce: s.pierce,
            fingers: s.fingers,
            wrap: s.wrap,
            grip: s.grip,
            palm: s.palm,
            up: s.up,
            face: s.face,
            intent: s.intent && {
              rule: s.intent.rule,
              err: s.intent.err,
              clamped: s.intent.clamped,
              alts: s.intent.alts,
            },
            reach: s.reach,
          },
    }));
  if (!c.hands.length && !c.error) c.error = "không bàn tay nào cầm món ở giây chụp";
}

// ---- ống kính sát bàn tay (như can-tay) ----
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, k) => a.map((v) => v * k);
const norm = (a) => mul(a, 1 / Math.hypot(...a));
const UP = [0, -1, 0];
const XA = 260;
const GOC = ["truoc", "cheo", "ngang"];
const GOC_VN = { truoc: "trước", cheo: "chéo", ngang: "ngang" };
const nhin = (eye, target, khung) => {
  const [dx, dy, dz] = sub(target, eye);
  return {
    eye: eye.map(r2),
    yaw: r2(Math.atan2(dx, dz) / RAD),
    pitch: r2(Math.atan2(dy, Math.hypot(dx, dz)) / RAD),
    f: r2((720 * XA) / khung),
    cx: 0,
    cy: 0,
  };
};
const jobs = [];
for (const c of cells) {
  if (!c.hands?.length) continue;
  const spec = data.held[c.item];
  const big = Math.max(...spec.size);
  const pts = c.hands.map((h) => h.at);
  const mid = mul(pts.reduce(add), 1 / pts.length);
  const span = pts.length > 1 ? Math.hypot(...sub(pts[0], pts[1])) : 0;
  const khung = Math.round(
    Math.min(220, Math.max(70, big * (c.carry ? 1.7 : 1.5), span * 1.6 + 30)),
  );
  const ben = c.two ? 1 : c.side === "right" ? 1 : -1;
  const F = fwd(YAW);
  const R = rgt(YAW);
  const dirs = { truoc: F, cheo: norm(add(F, mul(R, ben))), ngang: mul(R, ben) };
  c.khung = khung;
  c.tiles = GOC.map((g) => {
    const tilt = norm(add(dirs[g], mul(UP, 0.35)));
    const file = join("o", c.item, `${c.id}-${g}.png`);
    jobs.push({
      scene: c.id,
      t: T,
      lens: nhin(add(mid, mul(tilt, XA)), mid, khung),
      file,
      cell: c,
    });
    return { g, file };
  });
}

// ---- vẽ ----
const TILE = 400;
const DRAW = 2 * TILE;
rmSync(join(outDir, "o"), { recursive: true, force: true });
rmSync(join(outDir, "khac"), { recursive: true, force: true });
for (const it of items) mkdirSync(join(outDir, "o", it), { recursive: true });
const soi = await openSoi();
try {
  await renderSoi(soi, {
    jobs: jobs.map(({ scene, t, lens }) => ({ scene, t, lens })),
    scenes: Object.fromEntries(cells.filter((c) => c.tiles).map((c) => [c.id, c.scene])),
    w: DRAW,
    h: DRAW,
    tabs,
    onJob: (_, png, i) => writeFileSync(join(outDir, jobs[i].file), png),
  });
} finally {
  await soi.close();
}

// ---- bảng mỗi món ----
const tay = (c) => `${c.two ? "hai tay" : c.side === "right" ? "tay phải" : "tay trái"}`;
const nhanHang = (c) =>
  `${c.key} · ${tay(c)} · ${c.person} (tay ${c.size})` +
  (c.error
    ? `\nLỖI ${c.error}`
    : `\n${c.hands.map((h) => `${h.hand === "R" ? "P" : "T"}: ${h.text}`).join("\n")}`) +
  (c.rules?.length ? `\n!! ${c.rules.map((r) => RULE[r] ?? r).join(", ")}` : "");
const sheets = [];
for (const it of items) {
  const cs = cells.filter((c) => c.item === it);
  const tiles = [];
  for (const c of cs)
    for (const g of GOC) {
      const t = c.tiles?.find((x) => x.g === g);
      const label = `${GOC_VN[g]} · ${nhanHang(c)}`;
      tiles.push(
        "-label",
        label,
        t && existsSync(join(outDir, t.file)) ? join(outDir, t.file) : "xc:#ddd",
      );
    }
  const sheet = join(outDir, `${it}.jpg`);
  execFileSync("magick", [
    "montage",
    "-font",
    "Noto-Sans-Regular",
    "-pointsize",
    "13",
    "-background",
    "#f5f0e5",
    ...tiles,
    "-tile",
    `${GOC.length}x`,
    "-geometry",
    `${TILE}x${TILE}+6+6`,
    "-quality",
    "88",
    sheet,
  ]);
  sheets.push({ it, sheet, n: cs.length });
}

// ---- mục lục ----
const md = [
  "# Bảng duyệt kiểu cầm",
  "",
  `Rig \`${rig.RIG_VERSION ?? JSON.parse(readFileSync(join(root, "node_modules/@stickman3d/rig/package.json"), "utf8")).version}\` · giây ${T} · người: ${people.map((p) => `\`${p.file}\` (tay ${r2(p.size)})`).join(", ")} · ${cells.length} hàng × ${GOC.length} góc.`,
  "Số đo (đơn vị rig, góc độ): `lún` da lún sâu nhất vào món (âm là khe), `hở` ngón khai `wrap` còn cách món, `nắm` tâm nắm tới mặt món (âm là trong món), `lòng` khe/góc lòng tay (không đo với dáng kẹp `edge`, `pinch`, `hook`), `up`/`face` góc lệch ý định và khớp cổ tay kẹp, `tới` khe tay phụ hay `item:` tới đích; món treo: `quai` đỉnh quai tới chỗ treo, `khuỷu` góc gập/độ ngóc cẳng tay, `thân` khe thân món tới phần người gần nhất, `đẩy` góc lệch khỏi phương đứng. `!!` là luật `held` của `check` báo trên cảnh này.",
  "",
  "| Món#kiểu | Tay | Người | Dáng lấy từ | Số đo | `check` |",
  "|---|---|---|---|---|---|",
  ...cells.map(
    (c) =>
      `| \`${c.key}\` | ${tay(c)} | ${c.person} | ${c.from} | ${c.error ? `LỖI ${c.error}` : c.hands.map((h) => `${h.hand === "R" ? "P" : "T"}: ${h.text}`).join("<br>")} | ${(c.lines ?? []).map((l) => l.replace(/\|/g, "\\|")).join("<br>") || "—"} |`,
  ),
  "",
  "## Bảng ảnh",
  "",
  ...sheets.map((s) => `- [\`${s.it}\`](${s.it}.jpg) — ${s.n} hàng`),
  "",
];
writeFileSync(join(outDir, "index.md"), md.join("\n"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Bảng kiểu cầm</title><style>body{font:14px sans-serif;margin:20px;background:#f5f0e5}td,th{border:1px solid #ccc;padding:3px 6px;vertical-align:top}table{border-collapse:collapse}.bad{color:#b00}img{max-width:100%}</style>` +
    `<h1>Bảng duyệt kiểu cầm</h1><p>${esc(md[2])}</p><p>${esc(md[3])}</p>` +
    `<p>${sheets.map((s) => `<a href="#${s.it}">${s.it}</a>`).join(" · ")}</p>` +
    `<table><tr><th>Món#kiểu</th><th>Tay</th><th>Người</th><th>Dáng lấy từ</th><th>Số đo</th><th>check</th></tr>` +
    cells
      .map(
        (c) =>
          `<tr><td>${esc(c.key)}</td><td>${tay(c)}</td><td>${esc(c.person)}</td><td>${esc(c.from)}</td><td>${c.error ? `<span class=bad>LỖI ${esc(c.error)}</span>` : c.hands.map((h) => `${h.hand === "R" ? "P" : "T"}: ${esc(h.text)}`).join("<br>")}</td><td class=bad>${(c.lines ?? []).map(esc).join("<br>")}</td></tr>`,
      )
      .join("") +
    `</table>` +
    sheets.map((s) => `<h2 id="${s.it}">${s.it}</h2><img src="${s.it}.jpg">`).join(""),
);
const doJson = {
  t: T,
  people,
  // bỏ JSON cảnh dựng tạm: dựng lại được từ dữ liệu, `do.json` chỉ giữ số đo
  cells: cells.map((c) => ({ ...c, scene: undefined, tiles: c.tiles?.map((x) => x.file) })),
};
writeFileSync(join(outDir, "do.json"), JSON.stringify(doJson, null, 1));
const loi = cells.filter((c) => c.error);
const bao = cells.filter((c) => c.rules?.length);
console.log(
  `${cells.length} hàng, ${jobs.length} ô → ${rel(outDir)}/index.html (${sheets.length} bảng); ${bao.length} hàng có luật \`held\` báo${loi.length ? `, ${loi.length} hàng LỖI` : ""}`,
);
for (const c of loi) console.log(`  LỖI ${c.key} ${tay(c)} ${c.person}: ${c.error}`);

// ---- so với chuẩn ----
if (so) {
  const chuan = JSON.parse(readFileSync(join(chuanDir, "do.json"), "utf8"));
  const truoc = new Map(chuan.cells.map((c) => [c.id, c]));
  const sau = new Map(doJson.cells.map((c) => [c.id, c]));
  mkdirSync(join(outDir, "khac"), { recursive: true });
  let doi = 0;
  for (const id of new Set([...truoc.keys(), ...sau.keys()])) {
    const a = truoc.get(id);
    const b = sau.get(id);
    if (!a || !b) {
      doi++;
      console.log(`${a ? "MẤT" : "MỚI"} ${id}`);
      continue;
    }
    const soDo = (c) => (c.error ? `LỖI ${c.error}` : c.hands.map((h) => h.text).join(" | "));
    const khacSo = soDo(a) !== soDo(b) || (a.rules ?? []).join() !== (b.rules ?? []).join();
    const khacAnh = [];
    for (const f of new Set([...(a.tiles ?? []), ...(b.tiles ?? [])])) {
      const pa = join(chuanDir, f);
      const pb = join(outDir, f);
      if (!existsSync(pa) || !existsSync(pb)) {
        khacAnh.push(`${f.split("-").pop()} thiếu ảnh`);
        continue;
      }
      let px;
      try {
        execFileSync("magick", ["compare", "-metric", "AE", pa, pb, "null:"], { stdio: "pipe" });
        px = 0;
      } catch (e) {
        px = Number(String(e.stderr).trim().split(/\s/)[0]);
        if (!Number.isFinite(px)) px = -1;
      }
      if (px === 0) continue;
      const g = f
        .replace(/\.png$/, "")
        .split("-")
        .pop();
      const diff = join(outDir, "khac", `${id}-${g}.png`);
      // chuẩn | mới | chỗ khác (đỏ trên bản mờ của `magick compare`)
      const hl = `${diff}.hl.png`;
      try {
        execFileSync("magick", ["compare", pa, pb, hl], { stdio: "pipe" });
      } catch {
        // `compare` thoát 1 khi hai ảnh khác — ảnh tô chỗ khác vẫn ghi ra
      }
      execFileSync("magick", [pa, pb, hl, "+append", "-resize", "1200x", diff]);
      rmSync(hl, { force: true });
      khacAnh.push(`${GOC_VN[g] ?? g} ${px < 0 ? "?" : Math.round(px)} px khác → ${rel(diff)}`);
    }
    if (!khacSo && !khacAnh.length) continue;
    doi++;
    console.log(`ĐỔI ${a.key} ${tay(a)} ${a.person}`);
    if (khacSo)
      console.log(
        `   số đo: ${soDo(a)} [${(a.rules ?? []).join(",")}]\n       → ${soDo(b)} [${(b.rules ?? []).join(",")}]`,
      );
    for (const k of khacAnh) console.log(`   ảnh ${k}`);
  }
  console.log(
    doi
      ? `${doi} hàng đổi so với chuẩn ${rel(chuanDir)}`
      : `trùng chuẩn: ${truoc.size} hàng, mọi ô trùng pixel`,
  );
  if (doi) process.exitCode = 1;
}
