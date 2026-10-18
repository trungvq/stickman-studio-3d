import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { MARK, MAX_AGE, openEntries, sweepTmp } from "./scaffold/tools/sweep.mjs";

const NOW = Date.now();
const OLD = (NOW - MAX_AGE - 3600e3) / 1000;
const FRESH = (NOW - 3600e3) / 1000;
const roots = [];
after(() => roots.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** Thư mục tạm giả: `{ tên: { kind: "dir" | "file", age: "old" | "fresh", pid?, childAge? } }` */
function fake(spec) {
  const root = mkdtempSync(join(tmpdir(), "sweep-test-"));
  roots.push(root);
  for (const [name, s] of Object.entries(spec)) {
    const path = join(root, name);
    const t = s.age === "old" ? OLD : FRESH;
    if (s.kind === "file") {
      writeFileSync(path, "x");
      utimesSync(path, t, t);
      continue;
    }
    mkdirSync(path);
    const child = join(path, "bundle.js");
    writeFileSync(child, "x");
    if (s.pid !== undefined) writeFileSync(join(path, MARK), String(s.pid));
    const ct = (s.childAge ?? s.age) === "old" ? OLD : FRESH;
    for (const f of readdirSync(path)) utimesSync(join(path, f), ct, ct);
    utimesSync(path, t, t);
  }
  return root;
}

const deadPid = spawnSync(process.execPath, ["-e", ""]).pid;
const sweep = (dir, opts = {}) =>
  sweepTmp({ dir, now: NOW, inUse: () => new Set(), ...opts }).sort();

describe("sweepTmp", () => {
  it("bundle có dấu pid: xoá khi chủ đã chết, giữ khi chủ còn chạy dù cũ", () => {
    const dir = fake({
      "remotion-webpack-bundle-dead": { age: "fresh", pid: deadPid },
      "remotion-webpack-bundle-live": { age: "old", pid: process.pid },
    });
    assert.deepEqual(sweep(dir), ["remotion-webpack-bundle-dead"]);
    assert.ok(existsSync(join(dir, "remotion-webpack-bundle-live")));
  });

  it("bundle không dấu và thứ Remotion để lại: xoá khi cũ hơn ngưỡng, giữ khi mới", () => {
    const dir = fake({
      "remotion-webpack-bundle-old": { age: "old" },
      "remotion-webpack-bundle-new": { age: "fresh" },
      "remotion-v4.0.518-assetsabc": { age: "old" },
      "remotion-v4.0.518-assetsdef": { age: "fresh" },
      "react-motion-renderXyZ": { age: "old" },
      "remotion-filelist-1": { age: "old" },
    });
    assert.deepEqual(sweep(dir), [
      "react-motion-renderXyZ",
      "remotion-filelist-1",
      "remotion-v4.0.518-assetsabc",
      "remotion-webpack-bundle-old",
    ]);
  });

  it("thư mục cũ mà có mục mới bên trong thì giữ", () => {
    const dir = fake({ "remotion-webpack-bundle-busy": { age: "old", childAge: "fresh" } });
    assert.deepEqual(sweep(dir), []);
  });

  it("đồ Chrome chỉ xoá ở thư mục tạm riêng; thứ lạ không bao giờ đụng", () => {
    const spec = {
      ".com.google.Chrome.aB12cd": { kind: "file", age: "old" },
      ".org.chromium.Chromium.Ef34gh": { kind: "file", age: "old" },
      ".org.chromium.Chromium.fresh1": { kind: "file", age: "fresh" },
      "com.google.Chrome.frAABx": { age: "old" },
      "puppeteer_dev_chrome_profile-1": { age: "old" },
      "node-compile-cache": { age: "old" },
      "vscode-typescript1000": { age: "old" },
      "remotion-notes.txt": { kind: "file", age: "old" },
    };
    assert.deepEqual(sweep(fake(spec)), []);
    assert.deepEqual(sweep(fake(spec), { own: true }), [
      ".com.google.Chrome.aB12cd",
      ".org.chromium.Chromium.Ef34gh",
      "com.google.Chrome.frAABx",
      "puppeteer_dev_chrome_profile-1",
    ]);
  });

  it("thứ đang có tiến trình mở thì giữ dù cũ", () => {
    const dir = fake({
      "react-motion-renderOpen": { age: "old" },
      "react-motion-renderShut": { age: "old" },
    });
    const gone = sweep(dir, { inUse: () => new Set(["react-motion-renderOpen"]) });
    assert.deepEqual(gone, ["react-motion-renderShut"]);
  });

  it("thư mục không tồn tại thì không làm gì", () => {
    assert.deepEqual(sweepTmp({ dir: join(tmpdir(), "khong-co-thu-muc-nay-123") }), []);
  });
});

describe("openEntries", { skip: !existsSync("/proc/self/fd") }, () => {
  it("thấy mục có file đang mở của chính tiến trình này", () => {
    const dir = fake({
      "react-motion-renderHeld": { age: "old" },
      "react-motion-renderIdle": { age: "old" },
    });
    const fd = openSync(join(dir, "react-motion-renderHeld", "bundle.js"), "r");
    try {
      const open = openEntries(dir);
      assert.ok(open.has("react-motion-renderHeld"));
      assert.ok(!open.has("react-motion-renderIdle"));
      assert.deepEqual(sweepTmp({ dir, now: NOW }), ["react-motion-renderIdle"]);
    } finally {
      closeSync(fd);
    }
  });
});
