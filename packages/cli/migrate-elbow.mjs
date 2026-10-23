// `stickman migrate-elbow`: `elbow` của mốc `world.hands` không có `at` khai theo thế giới (schema trước 34) quay về hệ thân
// người ấy ở giây của mốc, nên dáng ở mốc không đổi. docs/03-scene.md#đích-bàn-tay-thế-giới
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as rig from "@stickman3d/sketch";
import { castRuntime, worldData } from "./lib.mjs";
import { patchJsonText } from "./rawjson.mjs";

/**
 * Chuyển các cảnh ở `scenes/` (hay cảnh có tên khớp `scene`, regex): mỗi `elbow` thế giới trên mốc không có `at`
 * (`legacyElbows`) quay về hệ thân bằng hướng thân ở giây của mốc (`migrateLegacyElbows`), `schemaVersion` lên bản hiện
 * hành; vá chữ của file, giữ phần còn lại. File không ghi `schemaVersion` coi như đời cũ. Cảnh khớp `stickman.frozen` cũng
 * chuyển: không chuyển thì không nạp được.
 * Trả `{ dir, scenes: [{ file, moves, wrote }], problems }`
 */
export function migrateElbow({ dir = ".", scene, dryRun = false } = {}) {
  const root = resolve(dir);
  const sdir = join(root, "scenes");
  const out = { dir: root, scenes: [], problems: [] };
  if (!existsSync(sdir)) return { ...out, problems: [`không có thư mục ${sdir}`] };
  const re = scene ? new RegExp(scene) : undefined;
  let data;
  for (const f of readdirSync(sdir)
    .filter((x) => x.endsWith(".json"))
    .sort()) {
    const name = f.replace(/\.json$/, "");
    if (re && !re.test(name)) continue;
    const file = `scenes/${f}`;
    const text = readFileSync(join(sdir, f), "utf8");
    let raw;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      out.problems.push(`${file}: ${e.message}`);
      continue;
    }
    const v = typeof raw.schemaVersion === "number" ? raw.schemaVersion : 0;
    if (v >= rig.SCENE_VERSION || !rig.legacyElbows(raw).length) continue;
    const r = rig.parseScene(rig.stripLegacyElbows(raw));
    if (!r.success) {
      out.problems.push(`${file}: ${r.error.issues.map((i) => i.message).join("; ")}`);
      continue;
    }
    data ??= worldData(root);
    let moved;
    try {
      const rt = castRuntime(
        r.data,
        data.actions,
        data.animals,
        data.props,
        data.characters,
        data.held,
        data.hands,
      );
      moved = rig.migrateLegacyElbows(raw, rt);
    } catch (e) {
      out.problems.push(`${file}: ${e.message}`);
      continue;
    }
    // file đời trước còn phép nâng khác ngoài `elbow`: viết lại cả file đã nâng, không vá từng chỗ
    const stripped = rig.stripLegacyElbows(raw);
    const all = rig.migrateScene(stripped);
    const same =
      JSON.stringify({ ...stripped, schemaVersion: rig.SCENE_VERSION }) === JSON.stringify(all);
    let body;
    if (same) body = patchJsonText(text, moved.json);
    else {
      for (const m of moved.moves) {
        const h = all.cast[m.cast].world.hands[m.key][m.side];
        h.elbow = m.to;
        const lock = raw.cast[m.cast].world.hands[m.key][m.side].elbowLock;
        if (lock !== undefined) h.elbowLock = lock;
      }
      body = `${JSON.stringify(all, null, 2)}\n`;
    }
    const check = rig.parseScene(JSON.parse(body));
    if (!check.success) {
      out.problems.push(
        `${file} sau khi chuyển không nạp lại được: ${check.error.issues[0]?.message}`,
      );
      continue;
    }
    if (!dryRun) writeFileSync(join(sdir, f), body);
    out.scenes.push({
      file,
      moves: moved.moves,
      wrote: !dryRun,
      rewritten: !same,
      ...(typeof raw.schemaVersion !== "number" && { unversioned: true }),
    });
  }
  return out;
}

const vec = (v) => `[${v.map((x) => +x.toFixed(3)).join(", ")}]`;

/** Bảng chữ của kết quả `migrateElbow` */
export function migrateElbowTable(r) {
  const lines = [];
  for (const s of r.scenes) {
    const tags = [
      s.unversioned && "không ghi schemaVersion: coi như đời cũ",
      s.rewritten && "viết lại cả file: còn phép nâng schema khác",
    ].filter(Boolean);
    lines.push(`${s.file}${tags.length ? ` (${tags.join("; ")})` : ""}`);
    for (const m of s.moves)
      lines.push(
        `  ${m.id} ${m.side === "right" ? "phải" : "trái"} t=${+m.t.toFixed(3)}: elbow ${vec(m.from)} (thế giới) → ${vec(m.to)} (hệ thân)`,
      );
  }
  return lines.join("\n");
}
