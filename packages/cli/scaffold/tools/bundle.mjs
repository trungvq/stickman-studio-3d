// `bundle()` của Remotion cho tool của repo: bundle (~100 MB trong `TMPDIR`) ghi pid tiến trình chủ vào
// `.stickman-pid`, xoá khi tiến trình thoát; trước khi bundle thì dọn `TMPDIR` (`sweep.mjs`): bundle của tiến
// trình đã chết (bị giết cứng nên không kịp dọn) và thứ Remotion, Chrome để lại quá `MAX_AGE`.
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { MARK, sweepAndReport } from "./sweep.mjs";
import { ownTmpdir, webpackOverride } from "./webpack.mjs";

/**
 * Bundle `entryPoint` (alias chung của `webpack.mjs`); `drop()` xoá nó, thoát hay Ctrl-C cũng tự xoá. `scope` (`bundleScope`
 * của `scope.mjs`) chọn cảnh, tập, tiếng vào bundle; bỏ trống là phạm vi mặc định. `public/` nối bằng symlink, không chép.
 */
export async function ownBundle(entryPoint, { scope } = {}) {
  sweepAndReport({ own: ownTmpdir !== null });
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
    webpackOverride: (c) => webpackOverride(c, scope),
    symlinkPublicDir: true,
    onDirectoryCreated: (d) => {
      made = d;
      writeFileSync(join(d, MARK), String(process.pid));
    },
  });
  return { serveUrl, drop };
}
