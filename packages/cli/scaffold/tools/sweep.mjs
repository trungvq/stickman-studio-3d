// Dọn rác trong `TMPDIR` của repo (docs/05 § Thư mục tạm): gọi trước mỗi lượt bundle (`bundle.mjs`) và mỗi lần
// `remotion render` / `still` / `studio` nạp `remotion.config.ts`. Không import gì của Remotion: config chạy nó trước bundler.
import { lstatSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";

/** File pid tiến trình chủ trong bundle của `ownBundle` */
export const MARK = ".stickman-pid";
/** Tuổi tối thiểu của thứ không có dấu pid trước khi bị xoá: dài hơn hẳn lượt render dài nhất */
export const MAX_AGE = 12 * 3600 * 1000;

const BUNDLE = "remotion-webpack-bundle-";
// Bundle, thư mục tài nguyên một lượt render, hồ sơ Chrome, danh sách file, trộn tiếng — tên Remotion tự đặt
const REMOTION =
  /^(remotion-webpack-bundle-|remotion-v\d[^/]*-assets|react-motion-render|remotion-filelist|remotion-large-audio-mixing)/;
// File, thư mục tạm của Chrome: chỉ dọn ở thư mục tạm riêng, ở `/tmp` chung chúng có thể là của trình duyệt người dùng
const CHROME =
  /^(\.?com\.google\.Chrome\.|\.?org\.chromium\.Chromium\.|puppeteer_dev_chrome_profile-)/;

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};

const markOf = (path) => {
  try {
    const pid = Number(readFileSync(join(path, MARK), "utf8"));
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
};

/** mtime mới nhất của `path` và các mục ngay trong nó, ms */
function newest(path) {
  const st = lstatSync(path);
  let t = st.mtimeMs;
  if (st.isDirectory())
    for (const f of readdirSync(path))
      try {
        t = Math.max(t, lstatSync(join(path, f)).mtimeMs);
      } catch {
        // mục vừa bị xoá
      }
  return t;
}

/** Tên các mục ngay trong `dir` có tiến trình đang mở file bên trong hay đứng trong đó (`/proc`; ngoài Linux là rỗng) */
export function openEntries(dir) {
  const out = new Set();
  let root;
  let pids;
  try {
    root = realpathSync(dir) + sep;
    pids = readdirSync("/proc").filter((p) => /^\d+$/.test(p));
  } catch {
    return out;
  }
  const note = (link) => {
    try {
      const p = readlinkSync(link);
      if (p.startsWith(root))
        out.add(
          p
            .slice(root.length)
            .split(sep)[0]
            .replace(/ \(deleted\)$/, ""),
        );
    } catch {
      // tiến trình của người khác hay vừa thoát
    }
  };
  for (const pid of pids) {
    note(`/proc/${pid}/cwd`);
    let fds;
    try {
      fds = readdirSync(`/proc/${pid}/fd`);
    } catch {
      continue;
    }
    for (const fd of fds) note(`/proc/${pid}/fd/${fd}`);
  }
  return out;
}

/**
 * Dọn `dir`, trả tên các mục đã xoá:
 * - bundle có `.stickman-pid` mà tiến trình ấy đã chết (bundle còn chủ thì giữ, cũ mấy cũng giữ);
 * - thứ Remotion để lại (bundle không dấu, tài nguyên render, hồ sơ Chrome…) và, khi `own`, file, thư mục tạm
 *   của Chrome — chỉ khi mtime của nó và mọi mục ngay trong nó cũ hơn `maxAge` và không tiến trình nào mở.
 * `own`: `dir` là thư mục tạm riêng khai ở `stickman.tmpdir`, không phải `/tmp` chung.
 */
export function sweepTmp({
  dir = tmpdir(),
  own = false,
  maxAge = MAX_AGE,
  now = Date.now(),
  inUse = openEntries,
} = {}) {
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  const dead = [];
  const old = [];
  for (const f of names) {
    const path = join(dir, f);
    if (f.startsWith(BUNDLE)) {
      const pid = markOf(path);
      if (pid !== null) {
        if (!alive(pid)) dead.push(f);
        continue;
      }
    }
    if (!REMOTION.test(f) && !(own && CHROME.test(f))) continue;
    try {
      if (now - newest(path) > maxAge) old.push(f);
    } catch {
      // mục vừa bị xoá
    }
  }
  const busy = old.length ? inUse(dir) : new Set();
  const gone = [];
  for (const f of [...dead, ...old.filter((f) => !busy.has(f))])
    try {
      rmSync(join(dir, f), { recursive: true, force: true });
      gone.push(f);
    } catch {
      // tiến trình khác đang xoá cùng lúc
    }
  return gone;
}

/** `sweepTmp` rồi báo một dòng ra stderr khi có xoá */
export function sweepAndReport(opts) {
  const gone = sweepTmp(opts);
  if (gone.length)
    console.error(
      `dọn ${gone.length} mục tạm cũ của Remotion/Chrome trong ${opts?.dir ?? tmpdir()}`,
    );
  return gone;
}
