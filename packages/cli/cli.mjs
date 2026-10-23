#!/usr/bin/env node
// stickman init | upgrade | check | docs | retime | reseat | migrate-held | studio | studio2d — dựng, nâng, soi và mở workspace của một repo video.
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import {
  CHECK_GROUPS,
  CHECK_TIMES,
  CLI_FLAGS,
  checkWorkspace,
  cliArgs,
  cliFlagList,
  initWorkspace,
  listDocs,
  parseCheckArgs,
  readDoc,
  reseatWorkspace,
  retimeWorkspace,
  upgradeWorkspace,
} from "./lib.mjs";
import { migrateHeld, migrateTable, writeMigrateReport } from "./migrate-held.mjs";
import { serveStudio } from "./serve.mjs";
import { serveStudio3d } from "./studio3d.mjs";

const args = process.argv.slice(2);
const cmd = args[0];
const flag = (name) => args.includes(`--${name}`);
const value = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i < 0 ? dflt : args[i + 1];
};
const dir = args[1] && !args[1].startsWith("--") ? args[1] : value("dir", ".");

const USAGE = `stickman <lệnh> [thư mục]

  init          dựng workspace: thư mục, bộ mẫu, app Remotion, file cho agent
  upgrade       chép lại app Remotion và file agent theo bộ đang cài, trộn số version
                vào package.json. File sửa tay thì hỏi.
  docs [tên]    in spec rig của version đang cài; không có tên thì in mục lục
  check         soi workspace: JSON hỏng, file trỏ tới không có, người 3D trượt, công cụ ngoài;
                --scene <regex> chỉ soi cảnh có id khớp (cảnh báo của chúng + mọi lỗi),
                bỏ tập, tiếng, git — nhanh, dùng sau khi sửa một cảnh
                --uses <tên,…> chỉ soi cảnh dùng hành động, nhân vật, đạo cụ, động vật ấy
                (đi chung --scene thì lấy cảnh khớp cả hai)
                --only <nhóm,…> / --skip <nhóm,…> chọn nhóm luật: ref (JSON, tham chiếu),
                move (trượt, thân quay, giật), hands (tay, lòng tay), held (đồ cầm),
                legacy (đồ cầm còn đi đường cũ), clash (lồng vào đồ, vào người, tay xuyên
                thân), episode (tập, tiếng, git, công cụ ngoài); nhóm không chạy thì không
                dựng thứ nó cần
                --held tên tắt của --only held
                --baseline <file> chỉ in cảnh báo mới hay nặng hơn file ấy (kèm mọi lỗi)
                --save-baseline <file> ghi cảnh báo lượt này vào file (gộp cảnh không chạy lại)
                --time in thời gian từng nhóm và phần dựng chung
                --jobs <số> số luồng đo sâu các cảnh (mặc định nửa số nhân, không quá số GB
                RAM trống)
  retime        đo lại tiếng rồi ghi số vào cue khai \`after\` và mốc khai ở \`shot.marks\`;
                --mark <cảnh>:<tên>=<giây> đặt tay một mốc
  reseat        rig đổi độ dài chân: dời \`y\` của người ngồi 2D để hông ở đúng chỗ cũ, người
                đứng giữ chân trên đất, người đi giãn \`cycle\` để giữ quãng đi; bỏ qua cảnh
                khớp stickman.frozen.
                --before <ref> đọc actions/ đời trước ở commit ấy
  migrate-held  chuyển món bản 1 (kiểu cầm khai theo món) sang v2 và \`hold\` \`món#kiểu\` của cảnh sang chỗ cầm nhóm
                \`{ item, group, … }\` (tay dẫn), chỗ cầm gần liên kết cũ nhất; in bảng lệch từng lần cầm.
                --scene <regex> chỉ cảnh có id khớp
                --held-dir <thư mục> món v2 có nhãn phần (mặc định held); món bản 1 đọc ở held/
                --map <file> JSON \`{ "món#kiểu": { group, part?, variant? } }\` đè bảng ánh xạ
                --out <file.md> ghi bảng và kết quả JSON (cùng tên, đuôi .json)
                --dry-run chỉ in, không ghi cảnh hay món
  studio        mở Studio 3D trên repo này (dev server Vite): xem cảnh three, soạn kiểu cầm;
                ghi thẳng scenes/ và held/ (kiểm hash lúc nạp, bản cũ ở <file>.json.bak)
  studio2d      mở character studio 2D (app tĩnh) đọc sẵn workspace này: nhân vật, hành động, mảnh;
                ghi thì bấm Mở thư mục

  --force       đè file có sẵn (chỉ init)
  --port <số>   studio: cổng (mặc định 5180); studio2d: cổng (mặc định 5173)
  --host <địa chỉ>  studio: nghe địa chỉ ấy thay cho localhost — mở cả đường ghi scenes/, held/ ra mạng ấy
  --name <tên>  tên project trong package.json (mặc định: tên thư mục)
  --yes         upgrade: đè hết, không hỏi
  --skip-modified  upgrade: giữ nguyên mọi file đã sửa tay, không hỏi
  --dry-run     upgrade / retime / reseat / migrate-held: chỉ in ra sẽ làm gì

Nội dung của repo — characters, actions, scenes, props, pieces — upgrade không đụng tới;
chỉ reseat, migrate-held và Lưu của studio ghi vào scenes/, và chỉ khi gọi chúng.
`;

/** Phần của lệnh `c` trong `USAGE` cộng danh sách cờ */
const usageOf = (c) => {
  const lines = USAGE.split("\n");
  const i = lines.findIndex((l) => l.startsWith(`  ${c} `));
  let j = i + 1;
  while (j < lines.length && /^ {3,}\S/.test(lines[j])) j++;
  const head = lines[i].trim().split(/\s{2,}/)[0];
  return `stickman ${head}${head === c ? " [thư mục]" : ""} [cờ]\n\n${lines.slice(i, j).join("\n")}\n\nCờ: ${cliFlagList(c)}`;
};

const list = (label, files) =>
  files.length ? `${label} (${files.length}):\n  ${files.join("\n  ")}` : "";

const parsed = cliArgs(args);
if (parsed.help) console.log(Object.hasOwn(CLI_FLAGS, cmd) ? usageOf(cmd) : USAGE);
else if (parsed.error) {
  console.error(parsed.error);
  process.exitCode = 1;
} else if (cmd === "init") {
  const r = initWorkspace({ dir, force: flag("force"), name: value("name") });
  console.log(`Workspace: ${r.dir}`);
  console.log(`Rig: @stickman3d/rig@${r.versions.rig} — spec đọc bằng \`stickman docs\`.`);
  console.log(list("Đã ghi", r.wrote));
  if (r.skipped.length) console.log(`Bỏ qua ${r.skipped.length} file đã có (dùng --force để đè).`);
  console.log("\nTiếp: pnpm install, rồi `pnpm exec stickman check`. Đọc stickman.md.");
} else if (cmd === "upgrade") {
  const auto = flag("yes") ? "đè" : flag("skip-modified") ? "bỏ qua" : null;
  const dryRun = flag("dry-run");
  if (!auto && !dryRun && !process.stdin.isTTY) {
    console.error("Không có bàn phím để hỏi — chạy lại với --yes, --skip-modified hoặc --dry-run.");
    process.exitCode = 1;
  } else {
    const rl =
      auto || dryRun ? null : createInterface({ input: process.stdin, output: process.stdout });
    const decide = auto
      ? () => auto
      : dryRun
        ? () => "bỏ qua"
        : async (file) => {
            const a = (await rl.question(`${file} đã sửa tay — [đ]è / [b]ỏ qua / [q] dừng? `))
              .trim()
              .toLowerCase();
            return a === "đ" || a === "d" ? "đè" : a === "q" ? "dừng" : "bỏ qua";
          };
    const r = await upgradeWorkspace({ dir, decide, dryRun });
    rl?.close();
    if (r.aborted) console.log("Đã dừng, chưa file nào bị đụng.");
    else {
      console.log(`${r.dir}\n@stickman3d/rig ${r.from?.rig ?? "?"} → ${r.versions.rig}`);
      const wrote = dryRun ? r.plan.map((x) => `${x.file} (${x.why})`) : r.wrote;
      if (wrote.length) console.log(list(dryRun ? "Sẽ ghi" : "Đã ghi", wrote));
      if (r.pkg.length) console.log(`package.json: ${r.pkg.join(", ")}`);
      const kept = r.conflicts.filter((c) => c.answer !== "đè").map((c) => c.file);
      if (kept.length)
        console.log(list(dryRun ? "Đã sửa tay, sẽ hỏi" : "Giữ nguyên bản sửa tay", kept));
      if (r.kept.length) console.log(`${r.kept.length} file sửa tay, mẫu chưa đổi, giữ nguyên.`);
      if (r.agentsMd) console.log(r.agentsMd);
      if (r.legs) console.log(r.legs);
      console.log(`${r.same.length} file đã đúng bản mới.`);
    }
  }
} else if (cmd === "docs") {
  // Tên file đứng ngay sau lệnh, không phải thư mục — `dir` ở trên không dùng cho lệnh này
  const name = args[1] && !args[1].startsWith("--") ? args[1] : null;
  if (!name) for (const d of listDocs()) console.log(`  ${d.file.padEnd(20)}${d.title}`);
  else {
    const body = readDoc(name);
    if (body) console.log(body);
    else {
      console.error(`Không có docs ${name}. Chạy \`stickman docs\` để xem mục lục.`);
      process.exitCode = 1;
    }
  }
} else if (cmd === "check") {
  const o = parseCheckArgs(args.slice(1));
  if (o.error) {
    console.error(o.error);
    process.exit(1);
  }
  const r = await checkWorkspace({ dir, ...o });
  const n = Object.entries(r.counts)
    .filter(([k]) => k !== "common")
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
  console.log(
    `${r.dir}\n${n}${r.counts.common === undefined ? "" : `, + ${r.counts.common} file bộ chung của studio`}\n` +
      `pin @${r.stamped ?? "?"}, rig ${r.rig ? `@${r.rig}` : "chưa cài"}` +
      (r.groups && r.groups.length < CHECK_GROUPS.length
        ? `\nchỉ chạy nhóm: ${r.groups.join(", ")}`
        : "") +
      (r.scenes ? `\nchỉ soi ${r.scenes.length} cảnh: ${r.scenes.join(", ")}` : ""),
  );
  if (o.time && r.time) {
    const s = (ms) => (ms / 1000).toFixed(1).padStart(7);
    console.log("thời gian (giây, cộng dồn mọi cảnh và mọi luồng):");
    for (const [k, label] of Object.entries(CHECK_TIMES))
      if (r.time[k] !== undefined) console.log(`  ${label.padEnd(38)}${s(r.time[k])}`);
    console.log(`  ${"cả lượt (đồng hồ)".padEnd(38)}${s(r.wall)}`);
  }
  for (const g of r.baseline?.gone ?? []) console.log(`đã hết: ${g.msg}`);
  // Lỗi in **sau cùng** rồi mới tới dòng đếm: soi `check` bằng `tail` là chuyện thường, và
  // lỗi mới là thứ chặn — in xuôi thì một lỗi lọt lên đầu đống cảnh báo là không ai thấy.
  const errors = r.problems.filter((p) => p.level === "lỗi");
  const warnings = r.problems.filter((p) => p.level !== "lỗi");
  const delta = (p) =>
    p.delta === "mới"
      ? " (mới)"
      : p.delta === "nặng hơn"
        ? p.now.count > p.was.count
          ? ` (nặng hơn: ${p.was.count} → ${p.now.count} dòng)`
          : ` (nặng hơn: ${p.was.measure} → ${p.now.measure})`
        : "";
  for (const p of [...warnings, ...errors]) console.log(`${p.level}${delta(p)}: ${p.msg}`);
  const b = r.baseline;
  console.log(
    (r.problems.length
      ? `${errors.length} lỗi, ${warnings.length} cảnh báo.`
      : "Không thấy vấn đề gì.") +
      (b
        ? ` So với ${b.file}${b.missing ? " (chưa có file, mọi cảnh báo là mới)" : ""}: ${b.fresh} mới, ${b.worse} nặng hơn, ${b.gone.length} đã hết.`
        : "") +
      (r.saved ? ` Đã ghi ${r.saved.warnings} cảnh báo vào ${r.saved.file}.` : "") +
      (r.frozen ? ` Bỏ qua ${r.frozen} của cảnh, tập, lớp khớp stickman.frozen.` : ""),
  );
  if (errors.length) process.exitCode = 1;
} else if (cmd === "retime") {
  const set = [];
  for (let i = 0; i < args.length; i++)
    if (args[i] === "--mark") {
      const m = /^([^:=]+):([A-Za-z0-9_-]+)=(\d+(?:\.\d+)?)$/.exec(args[i + 1] ?? "");
      if (!m) {
        console.error(`--mark viết <cảnh>:<tên>=<giây>, không phải \`${args[i + 1] ?? ""}\``);
        process.exitCode = 1;
      } else set.push({ scene: m[1], mark: m[2], seconds: Number(m[3]) });
    }
  if (!process.exitCode) {
    const r = retimeWorkspace({ dir, set, dryRun: flag("dry-run") });
    for (const ch of r.changes)
      console.log(`${ch.file}: ${ch.path} ${ch.from ?? "trống"} → ${ch.to}  (${ch.why})`);
    for (const p of r.problems) console.log(`lỗi: ${p}`);
    if (!r.changes.length && !r.problems.length) console.log("Mọi số đã khớp tiếng.");
    else if (flag("dry-run")) console.log(`${r.changes.length} số sẽ đổi (chưa ghi).`);
    else console.log(`Đã ghi ${r.wrote.length} file, ${r.changes.length} số.`);
    if (r.problems.length) process.exitCode = 1;
  }
} else if (cmd === "reseat") {
  const dryRun = flag("dry-run");
  const r = await reseatWorkspace({ dir, before: value("before"), dryRun });
  const legs = (l) => `đùi ${l.thigh} / cẳng ${l.shin}`;
  console.log(`${r.dir}\nChân ${legs(r.from)} → ${legs(r.to)}`);
  const px = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
  for (const ch of r.changes)
    console.log(
      ch.kind === "nhịp"
        ? `${ch.file}: ${ch.id} ${ch.action} cycle ${ch.cycle.from} → ${ch.cycle.to} (giữ quãng đi)`
        : ch.kind === "path"
          ? `${ch.file}: ${ch.id} path ${ch.path.length} mốc y (${ch.path.map((k) => `${k.t}s ${k.y}`).join(", ")})`
          : `${ch.file}: ${ch.id} y ${ch.y.from} → ${ch.y.to}${ch.x ? `, x ${ch.x.from} → ${ch.x.to}` : ""} (${px(ch.dy)} px${ch.props.length ? `, đạo cụ theo: ${ch.props.map((p) => p.id).join(", ")}` : ""})`,
    );
  for (const m of r.manual) console.log(`soi tay: ${m.file}${m.id ? `: ${m.id}` : ""} — ${m.why}`);
  for (const p of r.problems) console.log(`lỗi: ${p}`);
  if (r.from.thigh === r.to.thigh && r.from.shin === r.to.shin)
    console.log("Cảnh đã dựng cho chân đang cài, không có gì để dời.");
  else if (r.problems.length) console.log("Chưa ghi gì — sửa lỗi nạp rồi chạy lại.");
  else
    console.log(
      `${dryRun ? `${r.changes.length} chỗ sẽ đổi (chưa ghi)` : `Đã ghi ${r.wrote.length} cảnh, ${r.changes.length} chỗ; stickman.json ghi chân mới`}.` +
        (r.frozen ? ` Bỏ qua ${r.frozen} cảnh khớp stickman.frozen.` : ""),
    );
  if (r.problems.length) process.exitCode = 1;
} else if (cmd === "migrate-held") {
  const dryRun = flag("dry-run");
  const mapFile = value("map");
  const r = migrateHeld({
    dir,
    scene: value("scene"),
    heldDir: value("held-dir", "held"),
    map: mapFile ? JSON.parse(readFileSync(mapFile, "utf8")) : undefined,
    dryRun,
  });
  const out = value("out");
  if (out) {
    const w = writeMigrateReport(r, out);
    console.log(`Đã ghi ${w.md}, ${w.json}`);
  } else console.log(migrateTable(r));
  const s = r.summary;
  console.log(
    `${s.holds} lần cầm: ${s.ok} chuyển được, ${s.pending} chờ nhóm, ${s.error} lỗi; ${s.flag} lệch quá ngưỡng.` +
      (dryRun
        ? " Chạy khô, chưa ghi gì."
        : ` Đã ghi ${r.scenes.filter((x) => x.wrote).length} cảnh, ${r.items.filter((x) => x.wrote).length} món; ${r.scenes.filter((x) => x.blocked).length} cảnh chưa ghi vì còn lần cầm chưa chuyển được.`),
  );
  for (const p of r.problems) console.log(`lỗi: ${p}`);
  if (s.error || r.problems.length) process.exitCode = 1;
} else if (cmd === "studio") {
  const r = await serveStudio3d({
    dir,
    port: Number(value("port", 5180)),
    host: value("host", "localhost"),
  });
  console.log(`Studio 3D đọc ${r.root}, ghi scenes/ và ${r.heldOut ?? "held/"}`);
  for (const u of r.urls?.local ?? []) console.log(`  Local:   ${u}`);
  for (const u of r.urls?.network ?? []) console.log(`  Network: ${u}`);
} else if (cmd === "studio2d") {
  const r = await serveStudio({ dir, port: Number(value("port", 5173)) });
  console.log(`Studio đọc ${r.root}
  Local:   ${r.local}`);
  for (const u of r.lan) console.log(`  Network: ${u}`);
  console.log(
    "Ghi JSON thì bấm Mở thư mục và trỏ vào chính thư mục này (chỉ localhost mới có nút ấy).",
  );
} else {
  console.log(USAGE);
  if (cmd) process.exitCode = 1;
}
