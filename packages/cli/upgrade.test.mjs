import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { initWorkspace, upgradeWorkspace } from "./lib.mjs";

const SEEDS = ["src/lop.tsx", "src/parts.tsx", "src/scene-wrap.tsx"];
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
    s.files["src/parts.tsx"] = "0000000000000000";
    writeFileSync(join(dir, "stickman.json"), JSON.stringify(s));
    writeFileSync(join(dir, "src/parts.tsx"), "export const CODE_PARTS = { a: 1 };\n");
    const r = await upgradeWorkspace({ dir, decide: async () => "đè" });
    assert.deepEqual(r.conflicts, []);
    assert.match(readFileSync(join(dir, "src/parts.tsx"), "utf8"), /a: 1/);
    assert.equal(stamp(dir).files["src/parts.tsx"], undefined);
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
