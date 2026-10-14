// `bundle()` của Remotion cho tool của repo: bundle (~100 MB trong `TMPDIR`) ghi pid tiến trình chủ vào
// `.stickman-pid`, xoá khi tiến trình thoát; trước khi bundle thì xoá bundle của tiến trình đã chết (bị
// giết cứng nên không kịp dọn). Bundle không có `.stickman-pid` (của `remotion render`, `remotion still`)
// không đụng tới.
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { webpackOverride } from "./webpack.mjs";

const PREFIX = "remotion-webpack-bundle-";
const MARK = ".stickman-pid";

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};

/** Xoá bundle trong `TMPDIR` mà tiến trình ghi trong `.stickman-pid` không còn chạy */
export function sweepBundles(dir = tmpdir()) {
  let names = [];
  try {
    names = readdirSync(dir).filter((f) => f.startsWith(PREFIX));
  } catch {
    return;
  }
  for (const f of names) {
    let pid;
    try {
      pid = Number(readFileSync(join(dir, f, MARK), "utf8"));
    } catch {
      continue;
    }
    if (Number.isInteger(pid) && pid > 0 && !alive(pid))
      rmSync(join(dir, f), { recursive: true, force: true });
  }
}

/** Bundle `entryPoint` (alias chung của `webpack.mjs`); `drop()` xoá nó, thoát hay Ctrl-C cũng tự xoá */
export async function ownBundle(entryPoint) {
  sweepBundles();
  let made = null;
  const drop = () => made && rmSync(made, { recursive: true, force: true });
  process.once("exit", drop);
  for (const sig of ["SIGINT", "SIGTERM"])
    process.once(sig, () => {
      drop();
      process.exit(130);
    });
  const serveUrl = await bundle({
    entryPoint,
    webpackOverride,
    onDirectoryCreated: (d) => {
      made = d;
      writeFileSync(join(d, MARK), String(process.pid));
    },
  });
  return { serveUrl, drop };
}
