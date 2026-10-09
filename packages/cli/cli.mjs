#!/usr/bin/env node
// stickman init | upgrade | check | docs | retime | reseat | studio — dựng, nâng, soi và mở workspace của một repo video.
import { createInterface } from "node:readline/promises";
import {
  checkWorkspace,
  initWorkspace,
  listDocs,
  readDoc,
  reseatWorkspace,
  retimeWorkspace,
  upgradeWorkspace,
} from "./lib.mjs";
import { serveStudio } from "./serve.mjs";

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
  check         soi workspace: JSON hỏng, mảnh thiếu, PNG không alpha, công cụ ngoài;
                --scene <regex> chỉ soi cảnh có id khớp (cảnh báo của chúng + mọi lỗi),
                bỏ tập, tiếng, mảnh, git — nhanh, dùng sau khi sửa một cảnh
  retime        đo lại tiếng rồi ghi số vào cue khai \`after\` và mốc khai ở \`shot.marks\`;
                --mark <cảnh>:<tên>=<giây> đặt tay một mốc
  reseat        rig đổi độ dài chân: dời \`y\` của người ngồi 2D để hông ở đúng chỗ cũ, người
                đứng giữ chân trên đất, người đi giãn \`cycle\` để giữ quãng đi; bỏ qua cảnh
                khớp stickman.frozen.
                --before <ref> đọc actions/ đời trước ở commit ấy
  studio        mở character studio (app tĩnh) đọc sẵn workspace này; ghi thì bấm Mở thư mục

  --force       đè file có sẵn (chỉ init)
  --port <số>   studio: cổng (mặc định 5173)
  --name <tên>  tên project trong package.json (mặc định: tên thư mục)
  --yes         upgrade: đè hết, không hỏi
  --skip-modified  upgrade: giữ nguyên mọi file đã sửa tay, không hỏi
  --dry-run     upgrade / retime / reseat: chỉ in ra sẽ làm gì

Nội dung của repo — characters, actions, scenes, props, pieces — upgrade không đụng tới;
chỉ reseat ghi vào scenes/, và chỉ khi gọi nó.
`;

const list = (label, files) =>
  files.length ? `${label} (${files.length}):\n  ${files.join("\n  ")}` : "";

if (cmd === "init") {
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
  const r = await checkWorkspace({ dir, scene: value("scene") });
  const n = Object.entries(r.counts)
    .filter(([k]) => k !== "common")
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
  console.log(
    `${r.dir}\n${n}${r.counts.common === undefined ? "" : `, + ${r.counts.common} file bộ chung của studio`}\n` +
      `pin @${r.stamped ?? "?"}, rig ${r.rig ? `@${r.rig}` : "chưa cài"}` +
      (r.scenes ? `\nchỉ soi ${r.scenes.length} cảnh: ${r.scenes.join(", ")}` : ""),
  );
  // Lỗi in **sau cùng** rồi mới tới dòng đếm: soi `check` bằng `tail` là chuyện thường, và
  // lỗi mới là thứ chặn — in xuôi thì một lỗi lọt lên đầu đống cảnh báo là không ai thấy.
  const errors = r.problems.filter((p) => p.level === "lỗi");
  const warnings = r.problems.filter((p) => p.level !== "lỗi");
  for (const p of [...warnings, ...errors]) console.log(`${p.level}: ${p.msg}`);
  console.log(
    (r.problems.length
      ? `${errors.length} lỗi, ${warnings.length} cảnh báo.`
      : "Không thấy vấn đề gì.") +
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
} else if (cmd === "studio") {
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
