import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  CHECK_GROUPS,
  checkGroups,
  checkWorkspace,
  compareBaseline,
  lineKey,
  mergeBaseline,
  parseCheckArgs,
  sceneUses,
} from "./lib.mjs";

describe("check: tham số và nhóm luật", () => {
  it("`--only`, `--skip` phẩy ngăn, lặp thì cộng dồn; `--held` là `--only held`", () => {
    const o = parseCheckArgs(["--only", "move,hands", "--skip", "hands", "--only", "clash"]);
    assert.deepEqual(o.only, ["move", "hands", "clash"]);
    assert.deepEqual(o.skip, ["hands"]);
    assert.deepEqual(checkGroups(o).groups, ["move", "clash"]);
    assert.deepEqual(parseCheckArgs(["--held"]).only, ["held"]);
    assert.deepEqual(checkGroups(parseCheckArgs(["--held", "--only", "ref"])).groups, [
      "ref",
      "held",
    ]);
    assert.deepEqual(checkGroups({}).groups, CHECK_GROUPS);
    assert.equal(checkGroups({}).all, true);
  });

  it("các cờ còn lại: `--scene`, `--uses`, `--baseline`, `--save-baseline`, `--time`, `--jobs`", () => {
    assert.deepEqual(
      parseCheckArgs([
        ".",
        "--scene",
        "^t01",
        "--uses",
        "ngoi-3d,yota.json",
        "--baseline",
        "b.json",
        "--save-baseline",
        "c.json",
        "--time",
        "--jobs",
        "3.7",
      ]),
      {
        scene: "^t01",
        uses: ["ngoi-3d", "yota.json"],
        baseline: "b.json",
        saveBaseline: "c.json",
        time: true,
        jobs: 3,
      },
    );
  });

  it("tên nhóm sai, bỏ hết nhóm, thiếu giá trị, `--jobs` không dương là lỗi kèm danh sách nhóm", () => {
    assert.match(
      parseCheckArgs(["--only", "hand,move"]).error,
      /không có nhóm `hand` — nhóm của check: ref, move, hands, held, clash, episode/,
    );
    assert.match(
      parseCheckArgs(["--skip", "ref,move,hands,held,clash,episode"]).error,
      /không còn nhóm/,
    );
    assert.match(parseCheckArgs(["--only"]).error, /--only cần một giá trị/);
    assert.match(parseCheckArgs(["--uses", "--time"]).error, /--uses cần một giá trị/);
    assert.match(parseCheckArgs(["--jobs", "0"]).error, /--jobs phải là số nguyên dương/);
  });

  it("`sceneUses`: hành động của người và động vật, nhân vật, đạo cụ, động vật, bỏ đuôi `.json`", () => {
    const used = sceneUses({
      cast: [{ character: "yota.json", tracks: [{ clips: [{ action: "ngoi-3d" }, {}] }] }],
      props: [{ prop: "xe.json" }],
      animals: [{ animal: "dog.json", tracks: [{ clips: [{ action: "dog-walk" }] }] }],
    });
    assert.deepEqual([...used].sort(), ["dog", "dog-walk", "ngoi-3d", "xe", "yota"]);
  });
});

describe("check: baseline", () => {
  const row = (key, measure, scene = "a", group = "clash") => ({
    scene,
    group,
    key,
    measure,
    msg: `scenes/${scene}.json: ${key}`,
  });
  const base = [
    { scene: "a", group: "clash", key: "lấn", count: 1, measure: 3, msg: "lấn" },
    { scene: "a", group: "clash", key: "nhẹ", count: 1, measure: 0.5, msg: "nhẹ" },
    { scene: "a", group: "move", key: "giật", count: 1, measure: 40, msg: "giật" },
    { scene: "a", group: "hands", key: "hết", count: 1, msg: "hết" },
    { scene: "b", group: "hands", key: "cảnh khác", count: 1, msg: "cảnh khác" },
  ];
  const inScope = (e) => e.scene === "a";

  it("khoá dòng chữ: số đứng riêng thành `#`, tên có số và clip đang chạy giữ khoá ổn định", () => {
    const a = lineKey(
      "scenes/t01-s005.json: `yota` giây 1.20–1.60: chân trụ trượt 35 đơn vị (docs/03-scene.md#x). Clip đang chạy: walk-3d",
    );
    const b = lineKey(
      "scenes/t01-s005.json: `yota` giây 2.00–2.40: chân trụ trượt 41 đơn vị (docs/03-scene.md#x). Clip đang chạy: idle",
    );
    assert.equal(a, b);
    assert.match(
      a,
      /^scenes\/t01-s005\.json: `yota` giây #–#: chân trụ trượt # đơn vị \(docs\/03-scene\.md#x\)$/,
    );
  });

  it("mới, nặng hơn (gấp 1,25 lần và hơn 1, hay thêm dòng), đã hết chỉ trong phạm vi lượt chạy", () => {
    const cmp = compareBaseline(
      [row("lấn", 3.5), row("nhẹ", 0.9), row("giật", 52), row("giật", 41), row("mới", 2)],
      base,
      inScope,
    );
    assert.deepEqual([...cmp.fresh], ["mới"]);
    // 3 → 3,5 chưa đủ 1,25 lần, 0,5 → 0,9 chưa hơn 1; `giật` thêm một dòng
    assert.deepEqual([...cmp.worse.keys()], ["giật"]);
    assert.deepEqual(
      cmp.gone.map((e) => e.key),
      ["hết"],
    );
    const big = compareBaseline([row("lấn", 4)], base, inScope);
    assert.deepEqual([...big.worse.keys()], ["lấn"]);
  });

  it("ghi: mục trong phạm vi thay bằng lượt này, mục ngoài phạm vi giữ, thứ tự ổn định", () => {
    const merged = mergeBaseline(base, [row("mới", 2), row("lấn", 3.04), row("lấn", 2)], inScope);
    assert.deepEqual(
      merged.map((e) => [e.scene, e.group, e.key, e.count, e.measure]),
      [
        ["a", "clash", "lấn", 2, 3.04],
        ["a", "clash", "mới", 1, 2],
        ["b", "hands", "cảnh khác", 1, undefined],
      ],
    );
  });
});

const RIG = resolve(dirname(fileURLToPath(import.meta.url)), "../rig");
const LENS = { eye: [-500, -300, -700], yaw: 21, pitch: 12, f: 800, cx: 0, cy: 0 };
const X = -230;

// Cảnh three: sổ kẹp ngang cẳng tay phải cả cảnh; cảnh khác `null`
const WORLD = `
import * as THREE from "three";
import { act, addItem, Batch, box, castCharacter, defaultCharacter, fromCharacter, sceneAt } from "@stickman3d/rig";
__HONG__
export function worldOf(name: string, rt: any) {
  if (!["cam", "ngoi"].includes(name)) return null;
  const root = new THREE.Group();
  const figs: Record<string, any> = {};
  for (const m of rt.runtime.cast) {
    const f = fromCharacter(castCharacter(m, m.character ? rt.characters[m.character] : defaultCharacter()));
    root.add(f.root);
    figs[m.id] = f;
  }
  const b = new Batch();
  addItem(b, { name: "so", at: { at: [0, 0, 0] }, parts: [{ v: box(-3, 3, -3, 3, -3, 3), tone: { top: "#888", lit: "#888" } }] });
  const so = b.build();
  root.add(so);
  return {
    root,
    pose(t: number) {
      for (const [id, f] of Object.entries(figs)) act(f, sceneAt(rt.runtime, id, t, rt.heights[id], rt.bodies[id]), t);
      root.updateMatrixWorld(true);
      const arm = figs.a.arms[-1];
      const e = arm.elbow.getWorldPosition(new THREE.Vector3());
      so.position.copy(e.add(arm.wrist.getWorldPosition(new THREE.Vector3())).multiplyScalar(0.5));
      return figs;
    },
  };
}
`;
// Hành động ngồi soạn ở `side`, dùng ở cảnh `ngoi`
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

const stand = (name, ids = ["a", "b"], dx = 0) => ({
  name,
  duration: 2,
  lens: LENS,
  cast: ids.map((id, i) => ({ id, world: { at: [X + i * (60 + dx), 0, 0], yaw: 0 } })),
});

function space({ hong = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "stickman-groups-"));
  for (const d of ["scenes", "actions", "characters", "pieces", "src", "node_modules/@stickman3d"])
    mkdirSync(join(dir, d), { recursive: true });
  symlinkSync(RIG, join(dir, "node_modules/@stickman3d/rig"), "dir");
  symlinkSync(
    realpathSync(join(RIG, "node_modules/three")),
    join(dir, "node_modules/three"),
    "dir",
  );
  const json = (rel, v) => writeFileSync(join(dir, rel), `${JSON.stringify(v, null, 2)}\n`);
  json("package.json", { name: "thu", stickman: { world: "src/world.ts" } });
  writeFileSync(
    join(dir, "src/world.ts"),
    WORLD.replace("__HONG__", hong ? 'throw new Error("module hỏng");' : ""),
  );
  json("actions/ngoi-3d.json", SIT);
  json("scenes/cam.json", stand("cam"));
  json("scenes/le.json", stand("le", ["a"]));
  const ngoi = stand("ngoi", ["a"]);
  ngoi.cast[0].tracks = [{ clips: [{ action: "ngoi-3d", start: 0 }] }];
  json("scenes/ngoi.json", ngoi);
  return dir;
}

const msgs = (r) => r.problems.map((p) => `${p.level}: ${p.msg}`);

describe("check: chạy theo nhóm", () => {
  it("hợp các lượt `--only` từng nhóm bằng lượt đủ; mỗi dòng mang nhóm của nó", async () => {
    const dir = space();
    const full = await checkWorkspace({ dir, jobs: 1 });
    assert.ok(
      full.problems.some((p) => p.group === "clash"),
      msgs(full).join("\n"),
    );
    const parts = [];
    for (const g of CHECK_GROUPS) {
      const r = await checkWorkspace({ dir, jobs: 1, only: g });
      assert.deepEqual(r.groups, [g]);
      for (const p of r.problems) {
        if (p.level !== "lỗi") assert.equal(p.group, g, p.msg);
        parts.push(`${p.level}: ${p.msg}`);
      }
    }
    assert.deepEqual([...new Set(parts)].sort(), [...new Set(msgs(full))].sort());
  });

  it("nhóm không chạy thì không dựng thứ nó cần: `ref`, `move` không nạp cảnh three, `held` không đo va chạm", async () => {
    const hong = space({ hong: true });
    const all = await checkWorkspace({ dir: hong, jobs: 1 });
    assert.ok(
      msgs(all).some((m) => m.includes("module hỏng")),
      msgs(all).join("\n"),
    );
    for (const only of ["ref", "move", "ref,move,episode"]) {
      const r = await checkWorkspace({ dir: hong, jobs: 1, only });
      assert.ok(!msgs(r).some((m) => m.includes("module hỏng")), `${only}: ${msgs(r).join("\n")}`);
      assert.equal(r.time.worldModule, undefined);
      assert.equal(r.time.three, undefined);
    }
    const dir = space();
    const ref = await checkWorkspace({ dir, jobs: 1, only: "ref" });
    for (const k of ["move", "hands", "held", "clash", "threads", "three"])
      assert.equal(ref.time[k], undefined, k);
    const held = await checkWorkspace({ dir, jobs: 1, only: "held" });
    assert.ok(held.time.three > 0);
    assert.equal(held.time.clash, undefined);
    assert.equal(held.time.move, undefined);
    const skip = await checkWorkspace({ dir, jobs: 1, skip: "clash,hands,held" });
    assert.equal(skip.time.three, undefined);
    assert.ok(skip.time.move > 0);
  });

  it("`uses` chọn cảnh dùng hành động, giao với `scene`; không cảnh nào hay tên lạ là lỗi", async () => {
    const dir = space();
    const r = await checkWorkspace({ dir, uses: "ngoi-3d", only: "ref" });
    assert.deepEqual(r.scenes, ["ngoi"]);
    const none = await checkWorkspace({ dir, uses: "ngoi-3d", scene: "^cam$", only: "ref" });
    assert.match(
      none.problems.at(-1).msg,
      /không cảnh nào vừa khớp scene `\^cam\$` vừa dùng ngoi-3d/,
    );
    const lạ = await checkWorkspace({ dir, uses: "khong-co" });
    assert.match(lạ.problems[0].msg, /--uses: không có .* tên `khong-co`/);
  });

  it("baseline: lưu rồi so — chỉ còn cảnh báo mới; sửa xong thì đã hết", async () => {
    const dir = space();
    const first = await checkWorkspace({ dir, jobs: 1, saveBaseline: "baseline.json" });
    const saved = JSON.parse(readFileSync(join(dir, "baseline.json"), "utf8"));
    assert.equal(saved.stickman, "check-baseline");
    assert.equal(
      saved.warnings.length,
      new Set(first.problems.filter((p) => p.level !== "lỗi").map((p) => p.msg)).size,
    );
    const same = await checkWorkspace({ dir, jobs: 1, baseline: "baseline.json" });
    assert.deepEqual(same.problems, []);
    assert.deepEqual(
      [same.baseline.fresh, same.baseline.worse, same.baseline.gone.length],
      [0, 0, 0],
    );
    // dồn hai người vào nhau ở cảnh `le`: chỉ thấy cảnh báo mới của cảnh ấy
    writeFileSync(join(dir, "scenes/le.json"), JSON.stringify(stand("le", ["a", "b"], -55)));
    const moved = await checkWorkspace({ dir, jobs: 1, scene: "^le$", baseline: "baseline.json" });
    assert.ok(moved.problems.length > 0);
    for (const p of moved.problems) {
      assert.equal(p.delta, "mới", p.msg);
      assert.match(p.msg, /^scenes\/le\.json: /);
    }
    assert.equal(moved.baseline.fresh, moved.problems.length);
    // lưu lượt một cảnh: cảnh khác giữ nguyên trong file
    await checkWorkspace({ dir, jobs: 1, scene: "^le$", saveBaseline: "baseline.json" });
    const after = JSON.parse(readFileSync(join(dir, "baseline.json"), "utf8"));
    for (const e of saved.warnings.filter((e) => e.scene !== "le"))
      assert.ok(
        after.warnings.some((x) => x.key === e.key),
        e.key,
      );
    writeFileSync(join(dir, "scenes/le.json"), JSON.stringify(stand("le", ["a"])));
    const back = await checkWorkspace({ dir, jobs: 1, scene: "^le$", baseline: "baseline.json" });
    assert.deepEqual(back.problems, []);
    assert.ok(back.baseline.gone.length > 0);
  });
});
