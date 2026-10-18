import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { bundleScope, cliScope, parseTokens, thumbIds } from "./scaffold/tools/scope.mjs";

const roots = [];
after(() => roots.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** Workspace giả: thư mục `t\d+` và `thu`; tập `t01-full` gọi cảnh ngoài thư mục `thu-nen` và có thumbnail hai biến thể */
function fake() {
  const root = mkdtempSync(join(tmpdir(), "scope-test-"));
  roots.push(root);
  const write = (p, j) => {
    mkdirSync(join(root, p, ".."), { recursive: true });
    writeFileSync(join(root, p), JSON.stringify(j));
  };
  write("package.json", { stickman: { folders: "^(t\\d+|thu)", scope: "t02" } });
  for (const s of ["t01-s1", "t01-s2", "t02-s1", "thu-nen", "thu-khac", "ban-do"])
    write(`scenes/${s}.json`, {});
  write("episodes/t01-full.json", {
    shots: [{ scene: "t01-s1", audio: [{ file: "t01/a.mp3" }] }, { scene: "thu-nen" }],
    audio: [{ file: "sfx/mua.mp3" }],
    thumbnail: { scene: "t01-s2", variants: { a: {}, b: { scene: "ban-do" } } },
  });
  write("episodes/t02-full.json", { shots: [{ scene: "t02-s1", audio: [{ file: "t02/b.mp3" }] }] });
  return root;
}

const pick = (root, s) => ({
  scenes: ["t01-s1", "t01-s2", "t02-s1", "thu-nen", "thu-khac", "ban-do"].filter(s.scene),
  episodes: ["t01-full", "t02-full"].filter(s.episode),
});

describe("phạm vi bundle", () => {
  it("id cảnh: cảnh cùng thư mục, không tập, không tiếng", () => {
    const root = fake();
    const s = bundleScope(root, ["t01-s1"]);
    assert.deepEqual(pick(root, s), { scenes: ["t01-s1", "t01-s2"], episodes: [] });
    assert.equal(s.audio("t01/a.mp3"), false);
  });

  it("id tập: cảnh nó gọi ở thư mục khác, cảnh cùng thư mục, file cue và bản lồng tiếng", () => {
    const root = fake();
    const s = bundleScope(root, ["t01-full"]);
    assert.deepEqual(pick(root, s), {
      scenes: ["t01-s1", "t01-s2", "thu-nen", "ban-do"],
      episodes: ["t01-full"],
    });
    assert.ok(s.audio("t01/a.mp3"));
    assert.ok(s.audio("t01/en/a.mp3"));
    assert.ok(s.audio("sfx/mua.mp3"));
    assert.equal(s.audio("t01/khac.mp3"), false);
    assert.equal(s.audio("t02/b.mp3"), false);
    // webpack chỉ duyệt tổ tiên của file cue và thư mục lồng tiếng của chúng
    assert.ok(s.audioVisit("t01") && s.audioVisit("t01/a.mp3") && s.audioVisit("t01/en/a.mp3"));
    assert.equal(s.audioVisit("t02/b.mp3"), false);
    assert.equal(s.audioVisit("t01/en/sau/x.mp3"), false);
    assert.equal(s.audio("t01/khoi/a.mp3"), false);
    assert.equal(s.audioVisit("t01/khoi/a.mp3"), false);
  });

  it("id thumbnail kéo theo tập của nó", () => {
    const root = fake();
    assert.deepEqual(thumbIds(root, "t01-full"), ["t01-full-thumb-a", "t01-full-thumb-b"]);
    const s = bundleScope(root, ["t01-full-thumb-b"], { audio: "none" });
    assert.deepEqual(pick(root, s).episodes, ["t01-full"]);
    assert.equal(s.audio("t01/a.mp3"), false);
  });

  it("thư mục: mọi cảnh và tập của nó; `dirs` mang cả thư mục tiếng", () => {
    const root = fake();
    const s = bundleScope(root, ["t02"], { audio: "dirs" });
    assert.deepEqual(pick(root, s), { scenes: ["t02-s1"], episodes: ["t02-full"] });
    assert.ok(s.audio("t02/moi-gen.mp3"));
    assert.equal(s.audio("t01/a.mp3"), false);
    assert.deepEqual(bundleScope(root, ["t03", "t02"]).unknown, ["t03"]);
  });

  it("`*` là cả workspace; khoá khác nhau ra key khác nhau", () => {
    const root = fake();
    const all = bundleScope(root, ["*"]);
    assert.equal(pick(root, all).scenes.length, 6);
    assert.equal(pick(root, all).episodes.length, 2);
    assert.ok(all.audio("t02/b.mp3"));
    assert.notEqual(bundleScope(root, ["t01"]).key, bundleScope(root, ["t02"]).key);
    assert.deepEqual(parseTokens(" t01, thu  t02"), ["t01", "thu", "t02"]);
  });

  it("dòng lệnh remotion: id gõ vào, `still` không tiếng, Studio theo `stickman.scope`", () => {
    const root = fake();
    const prev = process.env.STICKMAN_SCOPE;
    delete process.env.STICKMAN_SCOPE;
    try {
      const still = cliScope(root, [
        "node",
        "remotion",
        "still",
        "t01-full",
        "out.png",
        "--frame=3",
      ]);
      assert.deepEqual(still.tokens, ["t01-full"]);
      assert.equal(still.audio("t01/a.mp3"), false);
      const render = cliScope(root, ["node", "remotion", "render", "src/index.ts", "t01-full"]);
      assert.ok(render.audio("t01/a.mp3"));
      assert.deepEqual(cliScope(root, ["node", "remotion", "studio"]).tokens, ["t02"]);
      process.env.STICKMAN_SCOPE = "t01";
      assert.deepEqual(cliScope(root, ["node", "remotion", "render", "t02-full"]).tokens, ["t01"]);
    } finally {
      if (prev === undefined) delete process.env.STICKMAN_SCOPE;
      else process.env.STICKMAN_SCOPE = prev;
    }
  });
});
