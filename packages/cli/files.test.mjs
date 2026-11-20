import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const pkg = JSON.parse(readFileSync(new URL("package.json", import.meta.url), "utf8"));

describe("gói cli", () => {
  it("mọi file `.mjs` mà file publish import tương đối đều nằm trong `files` (thiếu thì gói cài về không chạy)", () => {
    const listed = new Set(pkg.files);
    const seen = new Set();
    const queue = pkg.files.filter((f) => f.endsWith(".mjs"));
    const missing = [];
    while (queue.length) {
      const f = queue.pop();
      if (seen.has(f)) continue;
      seen.add(f);
      const src = readFileSync(new URL(f, import.meta.url), "utf8");
      for (const [, dep] of src.matchAll(/(?:from|import)\s*\(?\s*["']\.\/([^"'/]+\.mjs)["']/g)) {
        if (!listed.has(dep)) missing.push(`${f} → ${dep}`);
        queue.push(dep);
      }
    }
    assert.deepEqual(missing, []);
  });
});
