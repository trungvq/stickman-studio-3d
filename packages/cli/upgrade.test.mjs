import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { initWorkspace, upgradeWorkspace } from "./lib.mjs";

const SEEDS = ["src/lop.tsx", "src/scene-wrap.tsx"];
const stamp = (dir) => JSON.parse(readFileSync(join(dir, "stickman.json"), "utf8"));
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), "stickman-upgrade-"));
  initWorkspace({ dir, name: "thu" });
  return dir;
};

describe("upgrade: file seed là của repo", () => {
  it("init dựng seed nhưng không ghi băm của nó", () => {
    const dir = fresh();
    for (const f of SEEDS) assert.ok(existsSync(join(dir, f)), f);
    for (const f of SEEDS) assert.equal(stamp(dir).files[f], undefined, f);
    assert.ok(stamp(dir).files["src/Scene.tsx"]);
  });

  it("seed sửa tay không thành xung đột; seed thiếu thì dựng lại", async () => {
    const dir = fresh();
    writeFileSync(join(dir, "src/lop.tsx"), "export const CODE_LAYERS = [1];\n");
    rmSync(join(dir, "src/scene-wrap.tsx"));
    const asked = [];
    const r = await upgradeWorkspace({ dir, decide: async (f) => (asked.push(f), "bỏ qua") });
    assert.deepEqual(asked, []);
    assert.deepEqual(r.conflicts, []);
    assert.equal(
      readFileSync(join(dir, "src/lop.tsx"), "utf8"),
      "export const CODE_LAYERS = [1];\n",
    );
    assert.ok(existsSync(join(dir, "src/scene-wrap.tsx")));
    assert.equal(stamp(dir).files["src/scene-wrap.tsx"], undefined);
  });

  it("repo cũ còn băm của seed: bỏ băm, không hỏi", async () => {
    const dir = fresh();
    const s = stamp(dir);
    s.files["src/lop.tsx"] = "0000000000000000";
    writeFileSync(join(dir, "stickman.json"), JSON.stringify(s));
    writeFileSync(join(dir, "src/lop.tsx"), "export const CODE_LAYERS = [2];\n");
    const r = await upgradeWorkspace({ dir, decide: async () => "đè" });
    assert.deepEqual(r.conflicts, []);
    assert.match(readFileSync(join(dir, "src/lop.tsx"), "utf8"), /\[2\]/);
    assert.equal(stamp(dir).files["src/lop.tsx"], undefined);
  });
});

describe("upgrade: script của package.json", () => {
  it("gỡ script của lệnh không còn khi còn đúng bản mẫu, giữ bản sửa tay", async () => {
    const pkgOf = (dir) => JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const withScript = (cmd) => {
      const dir = fresh();
      const pkg = pkgOf(dir);
      pkg.scripts.studio2d = cmd;
      writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
      return dir;
    };
    const stale = withScript("stickman studio2d");
    await upgradeWorkspace({ dir: stale, decide: async () => "bỏ qua" });
    assert.equal(pkgOf(stale).scripts.studio2d, undefined);
    const own = withScript("vite --port 5173");
    await upgradeWorkspace({ dir: own, decide: async () => "bỏ qua" });
    assert.equal(pkgOf(own).scripts.studio2d, "vite --port 5173");
  });

  it("gỡ entry `stickman.parts` khi còn đúng bản mẫu, giữ bản sửa tay", async () => {
    const pkgOf = (dir) => JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const withParts = (rel) => {
      const dir = fresh();
      const pkg = pkgOf(dir);
      pkg.stickman.parts = rel;
      writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
      return dir;
    };
    const stale = withParts("src/parts.tsx");
    const r = await upgradeWorkspace({ dir: stale, decide: async () => "bỏ qua" });
    assert.equal(pkgOf(stale).stickman.parts, undefined);
    assert.ok(r.pkg.includes("stickman.parts (gỡ)"), r.pkg.join("; "));
    const own = withParts("src/bo-phan.tsx");
    await upgradeWorkspace({ dir: own, decide: async () => "bỏ qua" });
    assert.equal(pkgOf(own).stickman.parts, "src/bo-phan.tsx");
  });
});

describe("upgrade: dependency của package.json", () => {
  it("gỡ `@stickman3d/sketch`: gói không còn phát hành", async () => {
    const dir = fresh();
    const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    pkg.dependencies["@stickman3d/sketch"] = "link:../stickman-studio-3d/packages/sketch";
    writeFileSync(join(dir, "package.json"), JSON.stringify(pkg));
    const r = await upgradeWorkspace({ dir, decide: async () => "bỏ qua" });
    const deps = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).dependencies;
    assert.equal(deps["@stickman3d/sketch"], undefined);
    assert.ok(deps["@stickman3d/rig"]);
    assert.ok(r.pkg.includes("@stickman3d/sketch (gỡ)"), r.pkg.join("; "));
  });
});

describe("upgrade: thư mục app Remotion đọc", () => {
  it("dựng `hands/` thiếu kèm `.gitkeep`", async () => {
    const dir = fresh();
    assert.ok(existsSync(join(dir, "hands/.gitkeep")));
    rmSync(join(dir, "hands"), { recursive: true });
    await upgradeWorkspace({ dir, decide: async () => "bỏ qua" });
    assert.ok(existsSync(join(dir, "hands/.gitkeep")));
  });
});
