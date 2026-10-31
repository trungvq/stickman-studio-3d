// Ghi hành động sinh từ bảng vào lớp chung — docs/01-rig.md#biến-thể-sinh-từ-bảng. Cần `pnpm --filter @stickman3d/rig build`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import {
  ACTION_VERSION,
  POSES,
  actionPose,
  composePose,
  feet,
  nextBearing,
  parseAction,
  standing,
} from "../../packages/rig/dist/core/index.js";

const DIR = fileURLToPath(new URL("../../common/actions/", import.meta.url));

const pretty = async (data, file) =>
  prettier.format(JSON.stringify(data), {
    ...(await prettier.resolveConfig(file)),
    parser: "json",
  });

/** Ghi từng hành động qua `parseAction` và prettier, thêm tên file vào `index.json` */
export async function emit(actions) {
  for (const a of actions) {
    const r = parseAction({ schemaVersion: ACTION_VERSION, ...a });
    if (!r.success) throw new Error(`${a.name}: ${r.error.message}`);
    const file = `${DIR}${a.name}.json`;
    writeFileSync(file, await pretty(r.data, file));
    console.log(`${a.name}.json`);
  }
  const index = `${DIR}index.json`;
  const names = JSON.parse(readFileSync(index, "utf8"));
  const all = [...new Set([...names, ...actions.map((a) => `${a.name}.json`)])].sort();
  writeFileSync(index, await pretty(all, index));
}

/** Pha `step` của một lượt: lúc một bàn chân mới nhận lực, đúng luật chân chịu lực của trôi ngang — docs/01-rig.md#mốc-sự-kiện */
export function footfalls(a) {
  const n = 1000;
  const at = (u) =>
    feet({ ...composePose(POSES.idle, actionPose(a, u)), lift: { ll: true, lr: true } }, 1, true);
  const wrap = a.end === "wrap";
  let prev = at(0);
  let bearing = standing(prev.map((p) => p[1]));
  const out = [];
  // lượt lặp chạy hai vòng, lấy vòng sau: chân chịu lực lúc vào vòng là chân của cuối vòng trước
  for (let k = 1; k <= (wrap ? 2 : 1) * n; k++) {
    const u = wrap ? (k % n) / n : k / n;
    const cur = at(u);
    const next = nextBearing(
      bearing,
      cur.map((p) => p[1]),
      cur.map((p, i) => p[0] - prev[i][0]),
    );
    if ((!wrap || k > n) && u > 0.02 && next.some((i) => !bearing.includes(i))) out.push(u);
    bearing = next;
    prev = cur;
  }
  return out.map((t) => ({ name: "step", t }));
}
