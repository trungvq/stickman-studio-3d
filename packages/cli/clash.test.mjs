import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import * as rig from "@stickman3d/sketch";
import { checkWorkspace } from "./lib.mjs";

const TOP = -150;
const SEAT = -94.5;
const X = -230;
const LENS = { eye: [-500, -300, -700], yaw: 21, pitch: 12, f: 800, cx: 0, cy: 0 };
const SIT = {
  name: "ngoi-3d",
  duration: 2,
  authoredAt: "side",
  mask: ["armFar", "armNear", "legFar", "legNear", "torso"],
  keys: [
    {
      t: 0,
      pose: {
        armFar: [11, 42, 0],
        armNear: [11, 42, 0],
        legFar: [90, -90],
        legNear: [90, -90],
        torso: 3,
      },
    },
  ],
};
// Bàn mặt trên y −150, ghế mặt ngồi y −94,5 dưới hông; `touch` của cốc cho phép đầu kề miệng cốc
const LOP = `
import { bar, box } from "@stickman3d/fx";
const TONE = { top: "#a00", lit: "#0a0", side: "#00a" };
const ban = {
  name: "ban",
  at: { at: [0, 0, 0] },
  parts: [
    { v: box(-150, 150, ${TOP}, ${TOP + 6}, -80, 80), tone: TONE },
    { v: bar([-140, 0, -70], [-140, ${TOP + 6}, -70], 4), tone: TONE },
  ],
};
const ghe = {
  name: "ghe",
  at: { at: [${X}, 0, 0] },
  parts: [{ v: box(-30, 30, ${SEAT}, ${SEAT + 6}, -30, 30), tone: TONE }],
};
export const CODE_LAYERS = [
  { name: "phong", scenes: ["lan", "dung", "old-lan"], solids: () => [ban, ghe] },
];
`;

function scene(name, hands) {
  return {
    name,
    duration: 1,
    lens: LENS,
    cast: [
      {
        id: "a",
        base: "sit",
        world: { at: [X, SEAT, 0], yaw: 0, sit: true, hands: [{ t: 0, ...hands }] },
        tracks: [{ clips: [{ action: "ngoi-3d", start: 0 }] }],
      },
    ],
  };
}

/** Đích hai tay trên mặt bàn bằng `handsOn`; `dy` hạ cổ tay xuống dưới mặt */
function hands(dy = 0) {
  const bare = scene("x", {});
  bare.cast[0].world = { at: [X, SEAT, 0], yaw: 0, sit: true };
  const r = rig.parseScene(bare);
  const rt = rig.resolveScene(r.data, { "ngoi-3d": rig.parseAction(SIT).data });
  const c = rig.defaultCharacter();
  const sp = rig.sceneAt(rt, "a", 0, c.rig.height, rig.body3(c));
  const on = rig.handsOn(c, sp.pose, sp.world, {
    y: TOP,
    poly: [
      [-150, -80],
      [150, -80],
      [150, 80],
      [-150, 80],
    ],
  });
  const at = (h) => ({ at: [h.at[0], h.at[1] + dy, h.at[2]] });
  return { right: at(on.right), left: at(on.left) };
}

function workspace(stickman = {}) {
  const dir = mkdtempSync(join(tmpdir(), "stickman-clash-"));
  for (const d of ["scenes", "actions", "characters", "pieces", "src"])
    mkdirSync(join(dir, d), { recursive: true });
  const json = (rel, v) => writeFileSync(join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
  json("package.json", {
    name: "thu",
    stickman: { layers: "src/lop.ts", frozen: "^old-", ...stickman },
  });
  writeFileSync(join(dir, "src/lop.ts"), LOP);
  json("actions/ngoi-3d.json", SIT);
  json("scenes/lan.json", scene("lan", hands(30)));
  json("scenes/old-lan.json", scene("old-lan", hands(30)));
  json("scenes/dung.json", scene("dung", hands()));
  return dir;
}

const clashes = (r) => r.problems.filter((p) => p.msg.includes("người lồng vào đồ"));

describe("check: người 3D lồng vào đồ", () => {
  it("báo cẳng tay xuyên mặt bàn; tay đặt bằng `handsOn` và cảnh đóng băng thì im", async () => {
    const r = await checkWorkspace({ dir: workspace() });
    const got = clashes(r);
    assert.ok(got.length > 0, JSON.stringify(r.problems, null, 2));
    for (const p of got) {
      assert.equal(p.level, "cảnh báo");
      assert.match(
        p.msg,
        /^scenes\/lan\.json: người lồng vào đồ — a\.forearm(Near|Far) ↔ ban \(mảnh 0\) lấn \d+\.\d ở giây \d\.\d\d · giây 0\.00–1\.00$/,
      );
    }
  });

  it("`stickman.clash.tol` nâng ngưỡng", async () => {
    assert.deepEqual(clashes(await checkWorkspace({ dir: workspace({ clash: { tol: 50 } }) })), []);
  });

  it("người ngồi bàn: đo được người 3D với đồ khối, kể cả cảnh tay xuyên bàn", async () => {
    const r = await checkWorkspace({ dir: workspace() });
    assert.ok(!r.problems.some((p) => p.msg.includes("không đo được")));
  });

  it("`scene` chỉ soi cảnh khớp; không khớp cảnh nào là lỗi", async () => {
    const dir = workspace();
    const lan = await checkWorkspace({ dir, scene: "^lan$" });
    assert.deepEqual(lan.scenes, ["lan"]);
    assert.ok(clashes(lan).length > 0);
    assert.ok(
      lan.problems.every((p) => p.msg.startsWith("scenes/lan.json")),
      lan.problems,
    );
    assert.deepEqual((await checkWorkspace({ dir, scene: "^dung$" })).problems, []);
    const none = await checkWorkspace({ dir, scene: "^khong$" });
    assert.deepEqual(
      none.problems.map((p) => p.level),
      ["lỗi"],
    );
  });
});

const RIG = resolve(dirname(fileURLToPath(import.meta.url)), "../rig");

// Cảnh three của repo: sổ kẹp ngang cẳng tay phải giây 0,5–1, cốc ôm cẳng tay trái cả cảnh nhưng
// khai `touch` (kèm tên vật và một tên lạ). `Path2D` như code canvas của repo. Cảnh `bay`: túi bay ngang qua đầu trong quãng giữa hai
// mẫu 0,25 s. Cảnh `hong`: `pose` ném từ giây 1. Cảnh khác trả `null`
const WORLD = `
import * as THREE from "three";
import { act, addItem, Batch, box, castCharacter, defaultCharacter, fromCharacter, sceneAt } from "@stickman3d/rig";
import { Ghi } from "./Ghi";

const cube = (name: string, touch?: string[]) => {
  const b = new Batch();
  addItem(b, { name, touch, at: { at: [0, 0, 0] }, parts: [{ v: box(-3, 3, -3, 3, -3, 3), tone: { top: "#888", lit: "#888" } }] });
  return b.build();
};

export function worldOf(name: string, rt: any) {
  if (!["cam", "bay", "hong"].includes(name)) return null;
  const root = new THREE.Group();
  const figs: Record<string, any> = {};
  for (const m of rt.runtime.cast) {
    const f = fromCharacter(castCharacter(m, m.character ? rt.characters[m.character] : defaultCharacter()));
    root.add(f.root);
    figs[m.id] = f;
  }
  const so = cube("so");
  const coc = cube("coc", ["a.foreArmL", "so", "a.tay"]);
  const tui = cube("tui");
  root.add(so, coc, tui);
  const mid = (arm: any) => {
    const e = arm.elbow.getWorldPosition(new THREE.Vector3());
    return e.add(arm.wrist.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5);
  };
  return {
    root,
    pose(t: number) {
      if (name === "hong" && t >= 1) throw new Error("hỏng");
      new Path2D("M0 0").lineTo(1, 1);
      for (const [id, f] of Object.entries(figs)) act(f, sceneAt(rt.runtime, id, t, rt.heights[id], rt.bodies[id]), t);
      root.updateMatrixWorld(true);
      so.position.copy(mid(figs.a.arms[-1]));
      so.visible = name !== "bay" && t >= 0.5 && t <= 1 && Ghi !== undefined;
      coc.position.copy(mid(figs.a.arms[1]));
      const u = Math.min(1, Math.max(0, (t - 0.3) / 0.15));
      tui.position.copy(figs.a.head.getWorldPosition(new THREE.Vector3()));
      tui.position.x += (2 * u - 1) * 20;
      tui.visible = name === "bay";
      return figs;
    },
  };
}
`;
// Component Remotion nằm chung file với thứ cảnh three cần
const GHI = `
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { memo } from "react";
export const Ghi = memo(() => <AbsoluteFill>{useCurrentFrame()}</AbsoluteFill>);
`;
// Hộp lớp vẽ code ngang ngực: cảnh có cảnh three thì không đo nó nữa
const HOP = `
import { box } from "@stickman3d/fx";
const TONE = { top: "#a00", lit: "#0a0", side: "#00a" };
export const CODE_LAYERS = [
  {
    name: "hop",
    scenes: ["cam", "le"],
    solids: () => [{ name: "hop", at: { at: [${X}, 0, 0] }, parts: [{ v: box(-40, 40, -300, -260, -40, 40), tone: TONE }] }],
  },
];
`;

function worldspace() {
  const dir = mkdtempSync(join(tmpdir(), "stickman-world-"));
  for (const d of ["scenes", "actions", "characters", "pieces", "src", "node_modules/@stickman3d"])
    mkdirSync(join(dir, d), { recursive: true });
  // như repo video đã cài rig và three
  symlinkSync(RIG, join(dir, "node_modules/@stickman3d/rig"), "dir");
  symlinkSync(
    realpathSync(join(RIG, "node_modules/three")),
    join(dir, "node_modules/three"),
    "dir",
  );
  const json = (rel, v) => writeFileSync(join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
  json("package.json", { name: "thu", stickman: { layers: "src/lop.ts", world: "src/world.ts" } });
  writeFileSync(join(dir, "src/world.ts"), WORLD);
  writeFileSync(join(dir, "src/Ghi.tsx"), GHI);
  writeFileSync(join(dir, "src/lop.ts"), HOP);
  const stand = (name, ids = ["a"]) => ({
    name,
    duration: 2,
    lens: LENS,
    cast: ids.map((id) => ({ id, world: { at: [X, 0, 0], yaw: 0 } })),
  });
  json("scenes/cam.json", stand("cam"));
  json("scenes/le.json", stand("le"));
  json("scenes/bay.json", stand("bay"));
  json("scenes/hong.json", stand("hong", ["a", "b"]));
  return dir;
}

describe("check: người lồng vào vật trên cảnh three (`stickman.world`)", () => {
  it("báo món xuyên cẳng tay đúng người, bộ phận, món, quãng giây; món khai `touch` và hộp lớp vẽ code thì im; cảnh `null` đi đường cũ", async () => {
    const t0 = performance.now();
    const r = await checkWorkspace({ dir: worldspace() });
    const ms = performance.now() - t0;
    assert.ok(ms < 30000, `check mất ${ms} ms`);
    const got = clashes(r).map((p) => p.msg);
    const cam = got.filter((m) => m.startsWith("scenes/cam.json"));
    assert.equal(cam.length, 1, JSON.stringify(r.problems, null, 2));
    assert.ok(!r.problems.some((p) => p.msg.includes("ném lỗi") && p.msg.startsWith("scenes/cam")));
    assert.match(
      cam[0],
      /^scenes\/cam\.json: người lồng vào đồ — a\.foreArmR ↔ so lấn \d+\.\d ở giây \d\.\d\d · giây 0\.50–1\.00$/,
    );
    const le = got.filter((m) => m.startsWith("scenes/le.json"));
    assert.ok(le.length > 0, JSON.stringify(r.problems, null, 2));
    for (const m of le) assert.match(m, /↔ hop \(mảnh 0\)/);
    assert.ok(!r.problems.some((p) => p.level === "lỗi"), JSON.stringify(r.problems, null, 2));
    // `touch` lạ báo một lần cho cả check; tên vật trong `touch` không báo
    const lạ = r.problems.filter((p) => p.msg.includes("`touch`"));
    assert.deepEqual(
      lạ.map((p) => p.msg.replace(/^scenes\/\w+\.json: /, "")),
      [
        '`touch` "a.tay" của vật coc không phải phần người nào — bỏ qua (docs/10-lop-ve-code.md#đo-trên-cảnh-three)',
      ],
    );
  });

  it("chia nhỏ mẫu khi vật dời nhanh: túi bay qua đầu giữa hai mẫu vẫn bị bắt", async () => {
    const r = await checkWorkspace({ dir: worldspace(), scene: "^bay$" });
    const got = clashes(r).map((p) => p.msg);
    assert.equal(got.length, 1, JSON.stringify(r.problems, null, 2));
    assert.match(
      got[0],
      /^scenes\/bay\.json: người lồng vào đồ — a\.head ↔ tui lấn \d+\.\d ở giây 0\.3\d · /,
    );
  });

  it("`pose` ném thì cảnh báo một dòng, phép đo khác của cảnh vẫn chạy", async () => {
    const r = await checkWorkspace({ dir: worldspace(), scene: "^hong$" });
    const msgs = r.problems.map((p) => p.msg);
    const err = msgs.filter((m) => m.includes("ném lỗi"));
    assert.deepEqual(err, [
      "scenes/hong.json: src/world.ts: cảnh three ném lỗi ở giây 1.00 — hỏng; bỏ đo người lồng vào vật của cảnh three",
    ]);
    assert.ok(!msgs.some((m) => m.includes("không đo được")), JSON.stringify(msgs, null, 2));
    // người với người vẫn đo bằng khối của `<SceneWorld>`, sổ trước giây 1 vẫn báo
    assert.ok(
      msgs.some((m) => / — a\.\w+ ↔ b\.\w+ lấn /.test(m)),
      JSON.stringify(msgs, null, 2),
    );
    assert.ok(
      msgs.some((m) => / — a\.foreArmR ↔ so lấn .* giây 0\.50–0\.75$/.test(m)),
      JSON.stringify(msgs, null, 2),
    );
  });
});
