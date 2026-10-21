import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import * as rig from "@stickman3d/sketch";
import { loadScene, pngSize, renderThree } from "./lib.mjs";
import { findChrome, threeData, threeShots, threeSize } from "./three.mjs";

const COMMON = resolve(import.meta.dirname, "../../apps/studio/public");
const SCENE = rig.parseScene({
  name: "thu-three",
  duration: 2,
  lens: { eye: [0, -423, -1057], yaw: 0, pitch: 16, f: 800, cx: 0, cy: 120 },
  cast: [
    {
      id: "a",
      character: "code.json",
      world: { at: [0, 0, 0], yaw: 40 },
      tracks: [
        {
          clips: [
            { action: "stand-3d", start: 0 },
            { action: "talk-forward-3d", start: 0.5, blend: 0.3 },
          ],
        },
      ],
    },
  ],
}).data;
const loaded = loadScene(
  SCENE,
  [join(COMMON, "actions")],
  [],
  [],
  [join(COMMON, "characters")],
  [join(COMMON, "held")],
);
const characters = {
  "code.json": rig.parseCharacter(
    JSON.parse(readFileSync(join(COMMON, "characters/code.json"), "utf8")),
  ).data,
};
const data = { characters, ...loaded };
// Thư mục rỗng làm repo video: không `stickman.world`, rig lấy theo CLI — cảnh vẽ trong `plainRoom()`
const root = mkdtempSync(join(tmpdir(), "stickman-three-"));
after(() => rmSync(root, { recursive: true, force: true }));
// SwiftShader cỡ nhỏ: chạy được cả trên máy không GPU
const size = threeSize("320", loaded.rt.frame);
const skip = findChrome() ? false : "không có Chromium";

describe("ảnh three", { skip }, () => {
  it("cùng giây là cùng ảnh từng byte, trong một lượt và giữa hai lượt Chromium", async () => {
    const job = {
      id: "thu-three",
      scene: SCENE,
      data: threeData(SCENE, data),
      times: [1, 0.25, 1],
    };
    const a = await threeShots({ root, size, software: true, jobs: [job] });
    const b = await threeShots({ root, size, software: true, jobs: [{ ...job, times: [1] }] });
    const [x, y, z] = a.jobs[0].frames;
    assert.equal(a.jobs[0].from, "plain");
    assert.deepEqual(pngSize(x.png), { w: size.w, h: size.h });
    assert.ok(x.png.equals(z.png), "vẽ giây khác ở giữa không đổi ảnh của giây 1");
    assert.ok(x.png.equals(b.jobs[0].frames[0].png), "hai lượt Chromium ra cùng ảnh");
    assert.ok(!x.png.equals(y.png), "giây khác là ảnh khác");
  });

  it("dải có vệt: mỗi ô là một khung three, vệt đè cùng hệ chỗ vẽ", async () => {
    const out = join(root, "dai.png");
    const r = await renderThree({
      root,
      id: "thu-three",
      scene: SCENE,
      data,
      rt: loaded.rt,
      times: [0.5, 1.5],
      size: "320",
      software: true,
      out,
      cols: 2,
      motion: { trails: "hands", span: 0.5, fps: 10 },
      loadCharacter: () => ({ character: characters["code.json"], urls: {} }),
    });
    assert.equal(r.frames.length, 2);
    assert.deepEqual(pngSize(readFileSync(out)), { w: 2 * size.w, h: size.h });
    const svg = readFileSync(out.replace(/\.png$/, ".svg"), "utf8");
    assert.equal(svg.split("<image").length - 1, 2);
    assert.match(svg, /href="dai\/0\.5s\.png"/);
    assert.ok(svg.split("<circle").length > 4, "có chấm vệt");
    assert.ok(r.warnings.some((w) => w.includes("plainRoom")));
  });

  it("size lệch tỉ lệ khung cảnh thì báo", () => {
    assert.throws(() => threeSize("640x640", loaded.rt.frame), /tỉ lệ/);
    assert.deepEqual(threeSize("1280x720", loaded.rt.frame), { w: 1280, h: 720 });
  });
});
