import { readFileSync, readdirSync } from "node:fs";
import * as THREE from "three";
import { previewExtra, previewHeld, previewProps, previewSet, type Cast3D } from "@stickman3d/rig";
import {
  D,
  RIG,
  dirOf,
  heldDistance,
  parseAction,
  parseHeldItem,
  place3,
  PREVIEW_ARMREST,
  PREVIEW_COUNTER,
  PREVIEW_DESK,
  PREVIEW_LOUNGE,
  PREVIEW_SEAT,
  previewScene,
  type V3,
} from "@stickman3d/rig/core";
import { describe, expect, it } from "vitest";

/** Đỉnh mọi khối của món ra thế giới rig, kèm khoảng theo hướng mặt `fwd` */
const world = (stage: Parameters<typeof previewProps>[0], yaw: number, height: number) =>
  previewProps(stage, { yaw, height }).flatMap((it) =>
    (it.parts ?? []).map((p) => p.v.map((v) => place3(it.at, v))),
  );
const ys = (ps: V3[]) => ps.map((p) => p[1]);
const along = (ps: V3[], f: V3) => ps.map((p) => p[0] * f[0] + p[2] * f[2]);

describe("previewProps", () => {
  it("đứng không có khối nào", () => {
    expect(previewProps("stand")).toEqual([]);
  });

  for (const yaw of [0, 90, 200])
    for (const height of [1, 1.15]) {
      const fwd = dirOf(yaw * D);
      it(`ghế: mặt ngồi đúng world.sit, tựa lưng sau hông, chân chạm sàn (yaw ${yaw}, h ${height})`, () => {
        for (const stage of ["chair", "sit-down", "stand-up", "armchair", "desk"] as const) {
          // `propOf`: mặt ngồi, bốn chân, lưng ghế, hai trụ lưng xuống mặt ngồi
          const [seat, l0, l1, l2, l3, back, p0, p1] = world(stage, yaw, height);
          expect(Math.min(...ys(seat))).toBeCloseTo(-PREVIEW_SEAT.chair * height);
          // mặt ngồi ôm hông và chưa tới chỗ đứng trước ghế
          expect(Math.min(...along(seat, fwd))).toBeLessThan(0);
          expect(Math.max(...along(seat, fwd))).toBeGreaterThan(0);
          expect(Math.max(...along(seat, fwd))).toBeLessThan(RIG.thigh * height);
          if (stage === "armchair")
            expect(Math.max(...along(seat, fwd))).toBeLessThan(
              (RIG.thigh - PREVIEW_LOUNGE) * height,
            );
          expect(Math.max(...along(back, fwd))).toBeLessThan(Math.min(...along(seat, fwd)) + 1e-6);
          expect(Math.min(...ys(back))).toBeLessThan(-PREVIEW_SEAT.chair * height - 60 * height);
          for (const l of [l0, l1, l2, l3]) expect(Math.max(...ys(l))).toBeCloseTo(0);
          for (const p of [p0, p1]) {
            expect(Math.max(...ys(p))).toBeCloseTo(-(PREVIEW_SEAT.chair - 6) * height);
            expect(Math.max(...along(p, fwd))).toBeLessThan(Math.min(...along(seat, fwd)) + 1e-6);
          }
        }
      });
      it(`ghế bành: hai tay vịn PREVIEW_ARMREST trên mặt ngồi, hai bên hông, cột trước chạm sàn (yaw ${yaw}, h ${height})`, () => {
        const side = dirOf((yaw + 90) * D);
        expect(world("chair", yaw, height)).toHaveLength(8);
        for (const stage of ["armchair", "sit-down", "stand-up"] as const) {
          const parts = world(stage, yaw, height);
          expect(parts).toHaveLength(12);
          const rests = [parts[8], parts[10]];
          const outs = rests.map((r) => along(r, side).reduce((a, b) => a + b, 0) / r.length);
          expect(outs.map(Math.abs)).toEqual([
            expect.closeTo(PREVIEW_ARMREST.out * height, 6),
            expect.closeTo(PREVIEW_ARMREST.out * height, 6),
          ]);
          expect(Math.sign(outs[0])).toBe(-Math.sign(outs[1]));
          for (const r of rests) {
            expect(Math.min(...ys(r))).toBeCloseTo(
              -(PREVIEW_SEAT.chair + PREVIEW_ARMREST.top) * height,
            );
            const lounge = stage === "armchair" ? PREVIEW_LOUNGE : 0;
            expect(Math.max(...along(r, fwd))).toBeCloseTo(
              (PREVIEW_ARMREST.front - lounge) * height,
            );
          }
          for (const post of [parts[9], parts[11]]) expect(Math.max(...ys(post))).toBeCloseTo(0);
        }
      });
      it(`bàn của desk: mặt bàn PREVIEW_DESK trên mặt ngồi, mép gần trước hông, chân chạm sàn (yaw ${yaw}, h ${height})`, () => {
        const [top, ...legs] = previewProps("desk", { yaw, height })[1].parts!.map((p) =>
          p.v.map((v) => place3(previewProps("desk", { yaw, height })[1].at, v)),
        );
        expect(Math.min(...ys(top))).toBeCloseTo(-(PREVIEW_SEAT.chair + PREVIEW_DESK.top) * height);
        expect(Math.min(...along(top, fwd))).toBeCloseTo(PREVIEW_DESK.near * height);
        for (const l of legs) expect(Math.max(...ys(l))).toBeCloseTo(0);
      });
      it(`đệm seiza nằm trên sàn, dưới hông và gối (yaw ${yaw}, h ${height})`, () => {
        const [pad] = world("floor", yaw, height);
        expect(Math.max(...ys(pad))).toBeCloseTo(0);
        expect(Math.min(...ys(pad))).toBeGreaterThan(-PREVIEW_SEAT.floor * height);
        expect(Math.min(...along(pad, fwd))).toBeLessThan(0);
        expect(Math.max(...along(pad, fwd))).toBeGreaterThan(RIG.thigh * height);
      });
      it(`quầy trước mặt, mặt quầy cao PREVIEW_COUNTER (yaw ${yaw}, h ${height})`, () => {
        const [top, body] = world("counter", yaw, height);
        expect(Math.min(...ys(top))).toBeCloseTo(-PREVIEW_COUNTER * height);
        expect(Math.max(...ys(body))).toBeCloseTo(0);
        expect(Math.min(...along(top, fwd))).toBeGreaterThan(0);
      });
    }
});

describe("previewSet", () => {
  it("thêm đúng một nhóm khối vào plainRoom khi stage có khối", () => {
    const plain = previewSet("stand").group.children.length;
    const chair = previewSet("chair").group;
    expect(chair.children.length).toBe(plain + 1);
    const names = (chair.children.at(-1)!.userData.colliders as { name?: string }[]).map(
      (c) => c.name,
    );
    expect(new Set(names)).toEqual(new Set(["chair"]));
  });
});

const heldOf = (name: string) =>
  parseHeldItem(
    JSON.parse(readFileSync(new URL(`../../../common/held/${name}.json`, import.meta.url), "utf8")),
  ).data!;

const common = readdirSync(new URL("../../../common/held/", import.meta.url)).map((f) =>
  f.replace(/\.json$/, ""),
);

describe("món chung", () => {
  it("đủ các món mẫu, mốc có `dir` nằm trên mặt hình va chạm (lệch dưới 2)", () => {
    expect(common).toEqual(
      expect.arrayContaining([
        "coc",
        "tui",
        "tui-du-lich",
        "tui-deo",
        "dien-thoai",
        "khay",
        "ly",
        "chen",
        "binh",
        "kep-ho-so",
        "but",
        "vali",
      ]),
    );
    for (const name of common) {
      const spec = heldOf(name);
      expect(spec, name).toBeDefined();
      for (const [k, a] of Object.entries(spec.anchors))
        if (a.dir && !Object.values(spec.seats ?? {}).includes(k))
          expect(Math.abs(heldDistance(spec.shape!, a.at as V3)), `${name}.${k}`).toBeLessThan(2);
    }
  });
});

describe("previewHeld", () => {
  it("khối món ôm đúng `size`, ở gốc khung món, đơn vị rig × 0,01", () => {
    // `tui`: hình va chạm chỉ có thân, quai mảnh thêm từ đỉnh thân lên mốc treo `quai` cho đủ `size`; khối `detail` nhô
    // khỏi hộp bao
    for (const name of common) {
      const spec = heldOf(name);
      if (spec.shape?.some((b) => b.detail)) continue;
      const want = spec.size;
      const g = previewHeld(spec);
      const b = new THREE.Box3();
      for (const m of g.children)
        if (m instanceof THREE.Mesh && !m.userData.noShadow && m.material.side !== THREE.BackSide)
          b.expandByObject(m);
      const size = b.getSize(new THREE.Vector3()).multiplyScalar(100);
      expect(size.x).toBeCloseTo(want[0], 0);
      expect(size.y).toBeCloseTo(want[1], 0);
      expect(size.z).toBeCloseTo(want[2], 0);
      if (name === "coc" || name === "tui") expect(b.min.y * 100).toBeCloseTo(0, 0);
    }
  });

  it("món không có `shape` là một hộp `size` đứng trên gốc", () => {
    const spec = { ...heldOf("tui"), shape: undefined };
    const b = new THREE.Box3().setFromObject(previewHeld(spec));
    expect(b.min.y).toBeLessThan(0.001);
    expect(b.max.y * 100).toBeGreaterThan(spec.size[1] - 1);
  });
});

describe("previewExtra", () => {
  it("đăng ký khối của mỗi món `preview.hold` cầm, bỏ món không có trong held", () => {
    const a = parseAction({
      name: "x",
      keys: [{ t: 0, pose: {} }],
      preview: { hold: { right: "coc:2@cylinder", left: "khong-co@handle" } },
    }).data!;
    const scene = previewScene("x", a, undefined);
    const extra = previewExtra(scene, { coc: heldOf("coc") })!;
    const got: [string, THREE.Object3D, string | undefined][] = [];
    const cast = { provide: (i: string, o: THREE.Object3D, w?: string) => got.push([i, o, w]) };
    const { group } = extra({}, cast as unknown as Cast3D);
    expect(got.map(([i, , w]) => [i, w])).toEqual([["coc:2", undefined]]);
    expect(got[0][1].parent).toBe(group);
    expect(
      previewExtra(previewScene("x", parseAction({ ...a, preview: {} }).data!, undefined), {}),
    ).toBeUndefined();
  });
});
