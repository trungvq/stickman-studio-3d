// Bảng duyệt hành động: `pnpm bang-hanh-dong [--hanh-dong a,b*] [--ai a,b] [--goc front,near,side] [--out dir] [--tab N]`
//
// Hàng là hành động × người, cột là góc máy × bốn khung (đầu, giữa, đỉnh hay khác, cuối). Mỗi hàng là đúng cảnh xem thử
// của Thư viện Studio 3D (`previewScene` / `previewWorld` của rig): nền theo `stage`, ghế, đệm seiza, quầy, món của
// `preview.hold`, người kia của `preview.partner` (thu phóng cho cao bằng người diễn). Cạnh mỗi hàng là dòng `stickman check --only move,clash` đo trên chính
// cảnh ấy. Khung đỉnh là giây trong một lượt mà khớp người (so với hông) xa dáng giây 0 nhất, trùng khung giữa hay cuối thì
// thay bằng khung khác (dáng xa ba khung kia nhất); hành động `wrap` lấy khung cuối ở ¾ lượt (cuối lượt trùng đầu lượt).
// Tất định: cùng code, cùng dữ liệu là cùng pixel. docs/07-lam-tap.md § Bảng duyệt hành động.
// Ra
//
//   <out>/<hành động>.jpg   một bảng mỗi hành động: hàng là người, cột là góc × khung; nhãn in giây và số dòng check
//   <out>/index.md          mọi hàng: hành động, người, stage, nền, giây từng khung, dòng `check`
//   <out>/index.html        cùng nội dung, ô ảnh đặt cạnh dòng `check`
//   <out>/o/…png            ảnh từng ô, cái mà lệnh so đọc
//   <out>/do.json           khung và dòng `check` từng hàng
//
// So hồi quy (sau mỗi lần nâng rig, khi đã có bảng chuẩn):
//
//   pnpm bang-hanh-dong --luu-chuan   chép bảng vừa sinh ở <out> sang <chuẩn> — chỉ chạy sau khi đã duyệt bảng bằng mắt
//   pnpm bang-hanh-dong --so          sinh lại bảng rồi so từng ô với <chuẩn>: in ô đổi (số pixel khác, dòng check trước
//                                     → sau), ảnh khác biệt ở <out>/khac/; chưa có chuẩn thì báo rồi thoát (mã 2)
//
//   --chuan       thư mục bảng chuẩn (mặc định tmp/bang-hanh-dong-chuan), ngoài git
//   --hanh-dong   hành động, phẩy ngăn, `*` khớp mọi chuỗi (`bow-*`); mặc định mọi hành động người có token `3d` trong tên
//   --ai          file nhân vật (không đuôi), phẩy ngăn; mặc định bốn người mẫu `sample-*`
//   --goc         góc máy, phẩy ngăn (`PREVIEW_ANGLES`: front, near, far, side, back); mặc định front,near,side
//   --khong-check bỏ đo `check`
//   --tab         số tab song song (mặc định nửa số nhân)
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import * as rig from "@stickman3d/rig/core";
import { castRuntime, checkScenes, worldData } from "@stickman3d/cli";
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
const outDir = resolve(flag("out", "tmp/bang-hanh-dong"));
const chuanDir = resolve(flag("chuan", "tmp/bang-hanh-dong-chuan"));
const hdXin = flag("hanh-dong")?.split(",");
const aiXin = flag("ai")?.split(",");
const GOC = flag("goc", "front,near,side").split(",");
const tabs = Number(flag("tab", defaultTabs()));
const khongCheck = bool("khong-check");
const luuChuan = bool("luu-chuan");
const so = bool("so");
if (argv.length || GOC.some((g) => !rig.PREVIEW_ANGLES.includes(g))) {
  console.error(
    "dùng: pnpm bang-hanh-dong [--hanh-dong a,b*] [--ai a,b] [--goc front,near,side] [--khong-check] [--out dir] [--tab N]\n" +
      "      pnpm bang-hanh-dong --luu-chuan [--out dir] [--chuan dir]\n" +
      "      pnpm bang-hanh-dong --so [--chuan dir] [...]",
  );
  process.exit(1);
}
const rel = (p) => relative(root, p) || ".";

// ---- lưu chuẩn: chép bảng đã sinh, không vẽ gì ----
if (luuChuan) {
  if (!existsSync(join(outDir, "do.json"))) {
    console.error(
      `chưa có bảng ở ${rel(outDir)} — chạy \`pnpm bang-hanh-dong\`, duyệt, rồi mới lưu chuẩn`,
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
    `chưa có bảng chuẩn (${rel(chuanDir)}) — duyệt bảng \`pnpm bang-hanh-dong\` rồi \`pnpm bang-hanh-dong --luu-chuan\`; không so gì`,
  );
  process.exit(2);
}

// ---- dữ liệu ----
const data = worldData(root);
const has = (n) => Object.hasOwn(data.actions, n);
const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
const glob = (p) => new RegExp(`^${p.split("*").map(esc).join(".*")}$`);
const human = Object.keys(data.actions)
  .filter((n) => rig.actionKind(data.actions[n]) === "character")
  .sort();
const actions = hdXin
  ? hdXin.flatMap((p) => {
      const hit = human.filter((n) => glob(p).test(n));
      if (!hit.length) throw new Error(`không có hành động người nào khớp \`${p}\``);
      return hit;
    })
  : human.filter((n) => n.split("-").includes("3d"));
const SAMPLES = ["sample-man", "sample-woman", "sample-heavy", "sample-kimono"];
const fileOf = (n) => (n.endsWith(".json") ? n : `${n}.json`);
const people = (aiXin ?? SAMPLES.filter((n) => data.characters[fileOf(n)])).map(fileOf);
if (!people.length) throw new Error("không có người mẫu `sample-*`: chỉ định người bằng --ai");
for (const p of people) if (!data.characters[p]) throw new Error(`không có characters/${p}`);
/** Người thứ hai của `preview.partner`: người đầu danh sách khác người diễn, như Thư viện */
const partners = [...people, ...SAMPLES.map(fileOf), ...Object.keys(data.characters).sort()];
const partnerOf = (p) => partners.find((f) => f !== p && data.characters[f]);

// ---- cảnh xem thử và khung ----
const YAW = 90;
const FPS = 60;
const KHUNG = ["dau", "giua", "dinh", "cuoi"];
const KHUNG_VN = { dau: "đầu", giua: "giữa", dinh: "đỉnh", cuoi: "cuối" };
/** Tên khung trên nhãn: khung thứ ba là `đỉnh` hay `khác` (`thirdOf`) */
const tenKhung = (c, k) =>
  k === "dinh" ? { dinh: "đỉnh", khac: "khác", tinh: "tĩnh" }[c.third] : KHUNG_VN[k];
const GOC_VN = { front: "trước", near: "3/4 gần", far: "3/4 xa", side: "nghiêng", back: "sau" };
const onFrame = (t) => Math.round(t * FPS) / FPS;
const slug = (s) => s.replace(/[^a-zA-Z0-9-]+/g, "-");

/**
 * Khung thứ ba trong `[0, d]`: giây mà khớp người diễn (so với hông) xa dáng giây 0 nhất (`đỉnh`). Đỉnh trùng khung giữa
 * hay cuối (cách dưới 0,1 lượt, hay dáng lệch dưới 0,1 độ dời của đỉnh) thì lấy giây có dáng xa ba khung kia nhất
 * (`khác`); người đứng yên cả lượt thì giữa lượt (`tĩnh`)
 */
function thirdOf(rt, c, d, giua, cuoi) {
  const h = c.rig.height;
  const local = (t) => {
    const J = rig.actJoints(c, rig.sceneAt(rt, rig.PREVIEW_ACTOR, t, h));
    if (!J) return undefined;
    const hip = J.hip;
    return Object.values(J).map((p) => p.map((v, i) => v - hip[i]));
  };
  const dist = (a, b) => a.reduce((s, p, j) => s + Math.hypot(...p.map((x, i) => x - b[j][i])), 0);
  const ts = [];
  for (let k = 1; k / 30 <= d + 1e-9; k++) ts.push(k / 30);
  const poses = new Map(ts.map((t) => [t, local(t)]));
  const a = local(0);
  if (!a || ts.some((t) => !poses.get(t))) return { t: giua, k: "dinh" };
  const best = (score) =>
    ts.reduce(
      (b, t) => {
        const v = score(poses.get(t));
        return v > b.v + 1e-6 ? { t, v } : b;
      },
      { t: giua, v: 1 },
    );
  const peak = best((p) => dist(p, a));
  // tổng khoảng dời mọi khớp dưới 1 đơn vị rig: người đứng yên cả lượt
  if (peak.v <= 1) return { t: giua, k: "tinh" };
  const [mid, end] = [local(giua), local(cuoi)];
  const near = Math.max(0.1 * d, 2 / FPS);
  const same = (t, q) => Math.abs(peak.t - t) < near || dist(poses.get(peak.t), q) < 0.1 * peak.v;
  if (!same(giua, mid) && !same(cuoi, end)) return { t: peak.t, k: "dinh" };
  return { t: best((p) => Math.min(...[a, mid, end].map((o) => dist(p, o)))).t, k: "khac" };
}

const cells = [];
const scenes = {};
const preview = {};
const sceneKey = new Map();
for (const name of actions) {
  const a = data.actions[name];
  const stage = rig.previewStage(name, a);
  for (const person of people) {
    const c = data.characters[person];
    const who = person.replace(/\.json$/, "");
    const id = `${slug(name)}--${slug(who)}`;
    const partner = partnerOf(person);
    const opts = {
      yaw: YAW,
      height: c.rig.height,
      has,
      partner,
      partnerHeight: partner && data.characters[partner].rig.height,
    };
    const look = { stage, yaw: YAW, height: c.rig.height };
    const cell = { id, action: name, person: who, stage, look, angles: {} };
    // `stage` suy từ tên, không khai ở `preview`: bảng in kèm để người duyệt biết khối có thể thiếu
    if (!a.preview?.stage) cell.guess = true;
    cells.push(cell);
    try {
      for (const g of GOC) {
        const json = rig.previewScene(name, a, person, { ...opts, angle: g });
        // góc chỉ khác ống kính thì chung một cảnh: tab Remotion không dựng lại
        const k = JSON.stringify({ ...json, lens: undefined });
        if (!sceneKey.has(k)) {
          const sid = `bang-hanh-dong-${id}-${sceneKey.size}`;
          sceneKey.set(k, sid);
          scenes[sid] = json;
          preview[sid] = look;
        }
        cell.angles[g] = { scene: sceneKey.get(k), json };
      }
      const first = cell.angles[GOC[0]].json;
      // người dời chỗ đo ở góc nghiêng: máy của cảnh đứng yên, đi về phía máy thì người tới sát ống kính
      const path = first.cast[0].world.path;
      if (
        path &&
        !path.some((k) => k.sit) &&
        (path.at(-1).at[0] !== path[0].at[0] || path.at(-1).at[2] !== path[0].at[2])
      )
        cell.side = rig.previewScene(name, a, person, { ...opts, angle: "side" });
      const parsed = rig.parseScene(first);
      if (!parsed.success) throw new Error(`scene hỏng: ${parsed.error.issues?.[0]?.message}`);
      const rt = castRuntime(parsed.data, data.actions, data.characters, data.held, data.hands);
      const base = first.cast[0].tracks.find((t) => t.name === "base");
      cell.base = base?.clips.map((x) => x.action).join(" → ") ?? "—";
      cell.duration = first.duration;
      const d = a.duration;
      const giua = d / 2;
      const cuoi = a.end === "wrap" ? (3 * d) / 4 : d;
      const ba = thirdOf(rt, c, d, giua, cuoi);
      const t = { dau: 0, giua, dinh: ba.t, cuoi };
      cell.third = ba.k;
      cell.times = Object.fromEntries(KHUNG.map((k) => [k, onFrame(t[k])]));
    } catch (e) {
      cell.error = e.message;
    }
  }
}
if (!cells.length) throw new Error("không có hàng nào: không có hành động hay người");

// ---- đo: `check --only move,clash` trên cảnh xem thử ----
if (!khongCheck) {
  // một cảnh mỗi hàng: người dời chỗ ở góc nghiêng, còn lại góc mà người kia không bị ẩn (ẩn ở góc người kia che người diễn)
  const pick = (cell) =>
    (cell.side && { json: cell.side }) ??
    Object.values(cell.angles).find((x) => !x.json.cast[1]?.fade) ??
    Object.values(cell.angles)[0];
  const todo = cells.filter((c) => !c.error);
  const byId = Object.fromEntries(todo.map((c) => [c.id, pick(c)]));
  const res = await checkScenes({
    dir: root,
    scenes: Object.fromEntries(todo.map((c) => [c.id, byId[c.id].json])),
    groups: ["move", "clash"],
    spec: (id, R) => {
      const c = todo.find((x) => x.id === id);
      return R.previewWorld(byId[id].json, c.stage, data.held, c.look);
    },
  });
  for (const c of todo) c.lines = (res.get(c.id) ?? []).map((r) => `${r.group}: ${r.msg}`);
}

// ---- vẽ ----
const W = 600;
const H = 450;
const jobs = [];
for (const c of cells) {
  if (c.error) continue;
  c.tiles = [];
  for (const g of GOC)
    for (const k of KHUNG) {
      const { scene, json } = c.angles[g];
      const t = c.times[k];
      const file = join("o", slug(c.action), `${slug(c.person)}-${g}-${k}.png`);
      jobs.push({ scene, t, lens: rig.previewLens(json, t), file });
      c.tiles.push({ g, k, t, file });
    }
}
rmSync(join(outDir, "o"), { recursive: true, force: true });
rmSync(join(outDir, "khac"), { recursive: true, force: true });
for (const a of actions) mkdirSync(join(outDir, "o", slug(a)), { recursive: true });
const soi = await openSoi([]);
try {
  await renderSoi(soi, {
    jobs: jobs.map(({ scene, t, lens }) => ({ scene, t, lens })),
    scenes,
    preview,
    w: W,
    h: H,
    tabs,
    onJob: (_, png, i) => writeFileSync(join(outDir, jobs[i].file), png),
  });
} finally {
  await soi.close();
}

// ---- bảng mỗi hành động ----
const TILE = 300;
const dem = (c) => {
  const n = {};
  for (const l of c.lines ?? []) {
    const g = l.split(":")[0];
    n[g] = (n[g] ?? 0) + 1;
  }
  return Object.entries(n)
    .map(([g, k]) => `${g} ${k}`)
    .join(", ");
};
const sheets = [];
for (const a of actions) {
  const cs = cells.filter((c) => c.action === a);
  const tiles = [];
  for (const c of cs)
    for (const g of GOC)
      for (const k of KHUNG) {
        const t = c.tiles?.find((x) => x.g === g && x.k === k);
        const head = `${c.person} · ${GOC_VN[g]} · ${tenKhung(c, k)}${t ? ` ${t.t.toFixed(2)} s` : ""}`;
        const bad = c.error
          ? `\nLỖI ${c.error.slice(0, 50)}`
          : c.lines?.length
            ? `\n!! ${dem(c)}`
            : "";
        tiles.push(
          "-label",
          head + bad,
          t && existsSync(join(outDir, t.file)) ? join(outDir, t.file) : "xc:#ddd",
        );
      }
  const sheet = join(outDir, `${slug(a)}.jpg`);
  execFileSync("magick", [
    "montage",
    "-font",
    "Noto-Sans-Regular",
    "-pointsize",
    "12",
    "-background",
    "#f5f0e5",
    ...tiles,
    "-tile",
    `${GOC.length * KHUNG.length}x`,
    "-geometry",
    `${TILE}x${(TILE * H) / W}+4+4`,
    "-quality",
    "85",
    sheet,
  ]);
  sheets.push({ a, file: `${slug(a)}.jpg`, n: cs.length });
}

// ---- mục lục ----
const rigVersion = (() => {
  try {
    return JSON.parse(readFileSync(join(root, "node_modules/@stickman3d/rig/package.json"), "utf8"))
      .version;
  } catch {
    return "?";
  }
})();
const khungText = (c) =>
  c.error
    ? `LỖI ${c.error}`
    : KHUNG.map((k) => `${tenKhung(c, k)} ${c.times[k].toFixed(2)}`).join(" · ");
const md = [
  "# Bảng duyệt hành động",
  "",
  `Rig \`${rigVersion}\` · người: ${people.map((p) => `\`${p.replace(/\.json$/, "")}\``).join(", ")} · ${cells.length} hàng × ${GOC.length} góc (${GOC.map((g) => GOC_VN[g]).join(", ")}) × ${KHUNG.length} khung.`,
  "Cảnh là cảnh xem thử của Thư viện Studio 3D. Khung: đầu là giây 0, giữa là nửa lượt, đỉnh là giây khớp người (so với hông) xa dáng giây 0 nhất — trùng khung giữa hay cuối thì thay bằng khác, giây có dáng xa ba khung kia nhất; đứng yên cả lượt là tĩnh —, cuối là hết lượt (`wrap`: ¾ lượt). Bấm ô để mở ảnh cỡ thật. `check` là `move`, `clash` đo trên cảnh ấy" +
    (khongCheck ? " (bỏ, `--khong-check`)." : "."),
  "",
  "| Hành động | Người | Stage | Nền | Khung (giây) | `check` |",
  "|---|---|---|---|---|---|",
  ...cells.map(
    (c) =>
      `| \`${c.action}\` | ${c.person} | ${c.stage}${c.guess ? " (suy từ tên)" : ""} | ${c.base ?? "—"} | ${khungText(c)} | ${(c.lines ?? []).map((l) => l.replace(/\|/g, "\\|")).join("<br>") || "—"} |`,
  ),
  "",
  "## Bảng ảnh",
  "",
  ...sheets.map((s) => `- [\`${s.a}\`](${s.file}) — ${s.n} người`),
  "",
];
writeFileSync(join(outDir, "index.md"), md.join("\n"));
const e = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const head =
  `<tr><th class=who>Người · check</th>` +
  GOC.map((g) => `<th colspan=${KHUNG.length}>${GOC_VN[g]}</th>`).join("") +
  `</tr>`;
writeFileSync(
  join(outDir, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Bảng hành động</title><style>body{font:13px sans-serif;margin:16px;background:#f5f0e5}td,th{border:1px solid #ccc;padding:2px 4px;vertical-align:top}table{border-collapse:collapse}.who{min-width:160px;max-width:300px;position:sticky;left:0;z-index:1;background:#f5f0e5}.bad{color:#b00}.ok{color:#888}td.o{padding:0;text-align:center;font-size:11px}td.o img{width:160px;display:block}h2{margin-top:24px}</style>` +
    `<h1>Bảng duyệt hành động</h1><p>${e(md[2]).replace(/`/g, "")}</p><p>${e(md[3]).replace(/`/g, "")}</p>` +
    `<p>${actions.map((a) => `<a href="#${slug(a)}">${e(a)}</a>`).join(" · ")}</p>` +
    actions
      .map((a) => {
        const cs = cells.filter((c) => c.action === a);
        return (
          `<h2 id="${slug(a)}">${e(a)} <small>· ${e(cs[0].stage)}${cs[0].guess ? ` <span class=ok>(suy từ tên, hành động không khai preview.stage)</span>` : ""} · nền ${e(cs[0].base ?? "—")} · <a href="${slug(a)}.jpg">bảng ảnh</a></small></h2><table>${head}` +
          cs
            .map(
              (c) =>
                `<tr><td class=who><b>${e(c.person)}</b><br>${c.error ? `<span class=bad>LỖI ${e(c.error)}</span>` : c.lines?.length ? `<details><summary class=bad>check: ${e(dem(c))}</summary><span class=bad>${c.lines.map(e).join("<br>")}</span></details>` : `<span class=ok>check: —</span>`}</td>` +
                (c.tiles ?? [])
                  .map(
                    (t) =>
                      `<td class=o><a href="${t.file}"><img src="${t.file}" loading=lazy></a>${GOC_VN[t.g]} · ${tenKhung(c, t.k)} ${t.t.toFixed(2)}</td>`,
                  )
                  .join("") +
                `</tr>`,
            )
            .join("") +
          `</table>`
        );
      })
      .join(""),
);
const doJson = {
  goc: GOC,
  people,
  cells: cells.map((c) => ({
    id: c.id,
    action: c.action,
    person: c.person,
    stage: c.stage,
    base: c.base,
    ...(c.error && { error: c.error }),
    times: c.times,
    lines: c.lines ?? [],
    tiles: c.tiles?.map((x) => x.file),
  })),
};
writeFileSync(join(outDir, "do.json"), JSON.stringify(doJson, null, 1));
const loi = cells.filter((c) => c.error);
const bao = cells.filter((c) => c.lines?.length);
console.log(
  `${cells.length} hàng, ${jobs.length} ô → ${rel(outDir)}/index.html (${sheets.length} bảng); ${bao.length} hàng có dòng check${loi.length ? `, ${loi.length} hàng LỖI` : ""}`,
);
for (const c of loi) console.log(`  LỖI ${c.action} ${c.person}: ${c.error}`);
for (const c of bao)
  for (const l of c.lines) console.log(`  ${c.action} ${c.person}: ${l.replace(/\n/g, " ")}`);

// ---- so với chuẩn ----
if (so) {
  const chuan = JSON.parse(readFileSync(join(chuanDir, "do.json"), "utf8"));
  // `--hanh-dong`, `--ai` lọc cả bảng chuẩn: hàng ngoài phạm vi không tính là mất
  const inScope = (c) => actions.includes(c.action) && people.includes(fileOf(c.person));
  const truoc = new Map(chuan.cells.filter(inScope).map((c) => [c.id, c]));
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
    // `--khong-check` không đo: không so dòng check
    const soDo = (c) => (c.error ? `LỖI ${c.error}` : khongCheck ? "" : c.lines.join(" | "));
    const khacSo = soDo(a) !== soDo(b) || JSON.stringify(a.times) !== JSON.stringify(b.times);
    const khacAnh = [];
    for (const f of new Set([...(a.tiles ?? []), ...(b.tiles ?? [])])) {
      const pa = join(chuanDir, f);
      const pb = join(outDir, f);
      const o = f
        .replace(/\.png$/, "")
        .split("/")
        .slice(1)
        .join("-");
      if (!existsSync(pa) || !existsSync(pb)) {
        khacAnh.push(`${o} thiếu ảnh`);
        continue;
      }
      let px;
      try {
        execFileSync("magick", ["compare", "-metric", "AE", pa, pb, "null:"], { stdio: "pipe" });
        px = 0;
      } catch (err) {
        px = Number(String(err.stderr).trim().split(/\s/)[0]);
        if (!Number.isFinite(px)) px = -1;
      }
      if (px === 0) continue;
      const diff = join(outDir, "khac", `${o}.png`);
      // chuẩn | mới | chỗ khác (đỏ trên bản mờ của `magick compare`)
      const hl = `${diff}.hl.png`;
      try {
        execFileSync("magick", ["compare", pa, pb, hl], { stdio: "pipe" });
      } catch {
        // `compare` thoát 1 khi hai ảnh khác — ảnh tô chỗ khác vẫn ghi ra
      }
      execFileSync("magick", [pa, pb, hl, "+append", "-resize", "1200x", diff]);
      rmSync(hl, { force: true });
      khacAnh.push(`${o} ${px < 0 ? "?" : Math.round(px)} px khác → ${rel(diff)}`);
    }
    if (!khacSo && !khacAnh.length) continue;
    doi++;
    console.log(`ĐỔI ${a.action} ${a.person}`);
    if (khacSo)
      console.log(
        `   khung ${JSON.stringify(a.times)} → ${JSON.stringify(b.times)}\n   check: ${soDo(a) || "—"}\n       → ${soDo(b) || "—"}`,
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
