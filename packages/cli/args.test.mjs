import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import { CLI_FLAGS, cliArgs } from "./lib.mjs";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "cli.mjs");
// thư mục rỗng: lệnh nào lỡ chạy thật thì báo lỗi workspace chứ không đụng repo này
const empty = mkdtempSync(join(tmpdir(), "cli-args-"));
after(() => rmSync(empty, { recursive: true, force: true }));
const run = (...args) =>
  spawnSync(process.execPath, [CLI, ...args], { cwd: empty, encoding: "utf8", timeout: 20000 });

describe("cliArgs", () => {
  it("`--help` / `-h` ở bất kỳ chỗ nào là trợ giúp, trước mọi soát cờ", () => {
    assert.deepEqual(cliArgs(["check", "--help"]), { cmd: "check", help: true });
    assert.deepEqual(cliArgs(["check", "--bogus", "-h"]), { cmd: "check", help: true });
    assert.deepEqual(cliArgs(["--help"]), { cmd: "--help", help: true });
  });

  it("cờ của lệnh, cờ nhận giá trị, thư mục đứng riêng", () => {
    assert.deepEqual(
      cliArgs(["check", "..", "--scene", "^a$", "--held", "--jobs", "2", "--time"]),
      { cmd: "check" },
    );
    assert.deepEqual(cliArgs(["retime", "--mark", "a:b=1", "--mark", "a:c=2", "--dry-run"]), {
      cmd: "retime",
    });
    assert.deepEqual(cliArgs(["studio", "--dir", "x", "--port", "5181"]), { cmd: "studio" });
    for (const cmd of Object.keys(CLI_FLAGS)) assert.deepEqual(cliArgs([cmd]), { cmd });
  });

  it("cờ lạ, cờ của lệnh khác, cờ thiếu giá trị: lỗi kèm danh sách cờ", () => {
    const a = cliArgs(["check", "--bogus"]);
    assert.match(a.error, /`stickman check` không nhận `--bogus`/);
    assert.match(a.error, /--scene <…>/);
    assert.match(a.error, /--held/);
    assert.match(cliArgs(["check", "--force"]).error, /không nhận `--force`/);
    assert.match(cliArgs(["init", "-f"]).error, /không nhận `-f`/);
    assert.match(cliArgs(["reseat", "--before"]).error, /--before cần một giá trị/);
    assert.match(cliArgs(["check", "--scene", "--held"]).error, /--scene cần một giá trị/);
  });

  it("lệnh không có", () => {
    assert.deepEqual(cliArgs(["nope"]), { cmd: "nope", unknown: true });
    assert.deepEqual(cliArgs([]), { cmd: undefined, unknown: true });
  });
});

describe("stickman: trợ giúp và cờ lạ không chạy lệnh", () => {
  it("`check --help`, `check -h` in cách dùng và cờ của `check`, thoát 0", () => {
    for (const h of ["--help", "-h"]) {
      const r = run("check", h);
      assert.equal(r.status, 0, r.stderr);
      assert.match(r.stdout, /^stickman check \[thư mục\] \[cờ\]/);
      assert.match(r.stdout, /--save-baseline/);
      assert.match(r.stdout, /Cờ: --held, --time/);
      assert.doesNotMatch(r.stdout, /migrate-held/);
    }
  });

  it("trợ giúp của từng lệnh, và của cả bộ khi không có lệnh", () => {
    for (const cmd of Object.keys(CLI_FLAGS)) {
      const r = run(cmd, "-h");
      assert.equal(r.status, 0, `${cmd}: ${r.stderr}`);
      assert.match(r.stdout, new RegExp(`^stickman ${cmd}`));
      assert.match(r.stdout, /Cờ: /);
    }
    const r = run("--help");
    assert.equal(r.status, 0);
    assert.match(r.stdout, /^stickman <lệnh>/);
  });

  it("cờ lạ: báo lỗi kèm danh sách cờ, thoát 1, không soi workspace", () => {
    const r = run("check", "--bogus");
    assert.equal(r.status, 1);
    assert.equal(r.stdout, "");
    assert.match(r.stderr, /`stickman check` không nhận `--bogus`\. Cờ của lệnh này: --held/);
  });
});
