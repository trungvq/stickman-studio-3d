import { describe, expect, it } from "vitest";
import { trunk3, type ActInput } from "./act3";
import { body3 } from "./figure3d";
import { checkChoice, GRIP_GROUPS, namedVariants, variantOf } from "./graspGroups";
import {
  authoredFromSide,
  chooseMissing,
  frameCurl,
  graspCtx,
  graspFrame,
  graspReport,
  type GraspChoice,
} from "./graspSolve";
import { HAND_DOF, HAND_FIT, handVec } from "./hand";
import {
  AUTHORED_CURL,
  authoredFrom,
  authoredHand,
  m3Quat,
  mirrorHand,
  quatM3,
  slideHand,
} from "./heldAuthored";
import { heldFit } from "./heldFit";
import { handDims, itemGeom } from "./heldGeom";
import {
  GROUP_IDS,
  GROUP_VARIANTS,
  groupHold,
  HELD_VERSION,
  holdRunKey,
  parseHeldItem,
  SceneHoldSchema,
  sceneHoldRef,
  type GroupId,
  type HeldItemSpec,
} from "./heldItem";
import { cross3, dot3, fromColumns, matMul, type V3 } from "./lens";
import { parseScene, resolveScene, type ItemPose } from "./scene";
import { parseCharacter } from "./schema";
import fx from "./__fixtures__/nguoi-cam-bang.json";
import bangGia from "./__fixtures__/held-v2/bang-gia.json";
import dua from "./__fixtures__/held-v2/dua.json";
import dienThoai from "./__fixtures__/held-v2/dien-thoai.json";
import ongNghe from "./__fixtures__/held-v2/ong-nghe-ban.json";

const item = (json: unknown): HeldItemSpec => {
  const r = parseHeldItem(json);
  if (!r.success) throw new Error(r.error.message);
  return r.data;
};
const close = (a: readonly number[], b: readonly number[], d = 1e-4) =>
  a.forEach((x, i) => expect(Math.abs(x - b[i])).toBeLessThanOrEqual(d));

const K = 1.75;
const LONG = 1.545;
const dims = handDims(K, LONG);
type Pick = GraspChoice & { group: GroupId };

/** Món kèm bản soạn dựng từ khung `fr` của tay phải (như studio lưu): đúng khung bộ giải, ngón gập thêm `fit` */
function withAuthored(
  spec: HeldItemSpec,
  pick: Pick,
  fit?: number[],
  curl?: number,
  high?: V3,
): { spec: HeldItemSpec; variant: string } {
  const fr = graspFrame(spec, itemGeom(spec), pick, -1, dims, K, LONG, 1, high);
  const variant = fr.choice.variant!;
  const v = [...fr.pose, ...(fit ?? [])];
  const au = authoredFrom(
    fr.G,
    fr.hand.pose,
    K,
    LONG,
    v,
    { ...fr.choice, ...(high && { high }) } as never,
    curl,
  );
  const json = { ...structuredClone(spec), authored: { [pick.group]: { [variant]: au } } };
  return { spec: item(json), variant };
}

describe("kiểu cầm soạn tay (`authored`)", () => {
  it("schema: nhận bản soạn theo nhóm × biến thể, báo nhóm lạ; món không có `authored` parse như cũ", () => {
    const au = {
      item: { p: [0.03, -0.11, 0.01], q: [0, 0, 0, 1] },
      anchor: "pinch",
      fingers: [46, 46, 6, 22, 45, 35, 70, 70, 0, 0],
    };
    expect(parseHeldItem({ ...bangGia, authored: { sheet: { pinch: au } } }).success).toBe(true);
    const bad = parseHeldItem({ ...bangGia, authored: { cam: { pinch: au } } });
    expect(bad.success).toBe(false);
    expect(bad.error?.message).toMatch(/không phải nhóm cầm/);
    expect(
      parseHeldItem({ ...bangGia, authored: { sheet: { pinch: { ...au, fingers: [1] } } } })
        .success,
    ).toBe(false);
    expect(item(bangGia).authored).toBeUndefined();
  });

  it("quaternion ↔ ma trận quay đi về đúng", () => {
    const q = [0.3, -0.5, 0.2, 0.787];
    const n = Math.hypot(...q);
    close(
      m3Quat(quatM3(q)),
      q.map((x) => x / n),
      1e-9,
    );
  });

  it("bản soạn đúng khung bộ giải dựng lại đúng khung ấy, ở cỡ tay soạn và cả tay trái; dáng, `curl`, `authored` theo bản soạn", () => {
    const BANG = item(bangGia);
    const pick: Pick = {
      group: "sheet",
      variant: "pinch",
      edge: "bottom",
      thumb: "front",
      along: 0.3,
    };
    const fit = [0, 0, 4, 6, 0, 0, 8, 12, 0, 0];
    const { spec } = withAuthored(BANG, pick, fit, 0);
    for (const side of [-1, 1]) {
      const rig = graspFrame(BANG, itemGeom(BANG), pick, side, dims, K, LONG, 1.3);
      const au = graspFrame(spec, itemGeom(spec), pick, side, dims, K, LONG, 1.3);
      close(au.G.R, rig.G.R);
      close(au.G.p, rig.G.p, 1e-5);
      expect(au.G.u).toBe(rig.G.u);
      expect(au.authored).toBe(true);
      expect(au.curl).toBe(0);
      expect(frameCurl("sheet", au)).toBe(0);
      close(au.pose.slice(2, HAND_DOF.length), rig.pose.slice(2), 1e-4);
      close(au.pose.slice(HAND_DOF.length), fit);
      // `raw` bỏ qua bản soạn
      const raw = graspFrame(spec, itemGeom(spec), pick, side, dims, K, LONG, 1.3, undefined, true);
      expect(raw.authored).toBeUndefined();
      close(raw.G.p, rig.G.p, 1e-9);
    }
  });

  it("món không có bản soạn cho biến thể đang dùng thì bộ giải như cũ", () => {
    const BANG = item(bangGia);
    const { spec } = withAuthored(BANG, {
      group: "sheet",
      variant: "pinch",
      edge: "bottom",
      thumb: "front",
    });
    const pick: Pick = { group: "sheet", variant: "flat", edge: "bottom", thumb: "front" };
    const a = graspFrame(spec, itemGeom(spec), pick, -1, dims, K, LONG);
    const b = graspFrame(BANG, itemGeom(BANG), pick, -1, dims, K, LONG);
    expect(a).toEqual(b);
  });

  it("tay trái: bản soạn trùng bộ giải tay phải thì tay trái trùng bộ giải tay trái — cả khi chỗ tiếp xúc hai tay không là gương đơn giản (ống nghe `around` 150)", () => {
    const ONG = item(ongNghe);
    const pick: Pick = {
      group: "cylinder",
      variant: "flat",
      part: "tay",
      along: 0.32,
      around: 150,
      thumb: "up",
    };
    const { spec } = withAuthored(ONG, pick);
    const rig = graspFrame(ONG, itemGeom(ONG), pick, 1, dims, K, LONG);
    const au = graspFrame(spec, itemGeom(spec), pick, 1, dims, K, LONG);
    expect(au.authored).toBe(true);
    close(au.G.R, rig.G.R, 1e-4);
    close(au.G.p, rig.G.p, 2e-5);
  });

  it("gương tay trái là phản xạ bàn tay soạn qua mặt (lòng tay, ngón) của chỗ tiếp xúc", () => {
    const c = { at: [1, 2, 3] as V3, palm: [0, 0, 1] as V3, fingers: [0, -1, 0] as V3 };
    const h = { at: [1.5, 2.2, 3.4] as V3, palm: [0.6, 0, 0.8] as V3, fingers: [0, -1, 0] as V3 };
    const m = mirrorHand(h, c, c);
    // mặt phản xạ: qua `c.at`, pháp tuyến lòng tay × ngón = trục x
    close(m.at, [0.5, 2.2, 3.4], 1e-12);
    close(m.palm, [-0.6, 0, 0.8], 1e-12);
    close(m.fingers, [0, -1, 0], 1e-12);
    // trùng chỗ tiếp xúc tay phải thì ra đúng chỗ tiếp xúc tay trái
    const l = { at: [0, 1, 0] as V3, palm: [1, 0, 0] as V3, fingers: [0, 0, -1] as V3 };
    const x = mirrorHand(c, c, l);
    close(x.at, l.at, 1e-12);
    close(x.palm, l.palm, 1e-12);
    close(x.fingers, l.fingers, 1e-12);
    // đường dự phòng (`authoredHand`): `nf` giữ lòng tay, ngón; `nt` giữ lòng tay, đổi chiều ngón
    const a = authoredFrom(
      { R: quatM3([0.2, 0.4, -0.1, 0.9]), p: [0.05, -0.1, 0.02], u: 0.01 },
      "grip",
      1,
      1,
      handVec("grip"),
    );
    const r = authoredHand(a, -1, "nf");
    close(authoredHand(a, 1, "nf").fingers, r.fingers, 1e-9);
    close(
      authoredHand(a, 1, "nt").fingers,
      r.fingers.map((v) => -v),
      1e-9,
    );
    close([dot3(cross3(r.palm, r.fingers), r.palm)], [0], 1e-9);
  });

  it("cảnh cầm ở `along` khác lúc soạn: bàn tay dời đúng như chỗ tiếp xúc của bộ giải", () => {
    const DUA = item(dua);
    const pick: Pick = { group: "chopsticks", along: 0.3 };
    const { spec } = withAuthored(DUA, pick);
    const at = (s: HeldItemSpec, along: number) =>
      graspFrame(s, itemGeom(s), { ...pick, along }, -1, dims, K, LONG);
    for (const along of [0.25, 0.4]) {
      const a = at(spec, along);
      const b = at(DUA, along);
      // bản soạn trùng khung bộ giải ở lựa chọn lúc soạn, nên ở lựa chọn khác cũng trùng
      // bản soạn lưu 5 số lẻ (1e-5 three = 1e-3 đơn vị món)
      close(a.hand.at, b.hand.at, 2e-3);
      close(a.G.R, b.G.R, 1e-4);
    }
  });

  it("dời theo chỗ tiếp xúc giữ bàn tay trong khung của chỗ tiếp xúc", () => {
    const from = { at: [1, 2, 3] as V3, palm: [1, 0, 0] as V3, fingers: [0, -1, 0] as V3 };
    const to = { at: [4, 0, 0] as V3, palm: [0, 1, 0] as V3, fingers: [1, 0, 0] as V3 };
    const h = { at: [1.5, 2, 3] as V3, palm: [0, 0, 1] as V3, fingers: [1, 0, 0] as V3 };
    const s = slideHand(h, from, to);
    // điểm lệch nửa đơn vị theo lòng tay của chỗ tiếp xúc
    close(s.at, [4, 0.5, 0], 1e-12);
    close([dot3(s.palm, s.fingers)], [0], 1e-12);
    close(slideHand(h, from, from).at, h.at, 1e-12);
  });

  it("`heldFit` tính từ độ gập sẵn có của dáng soạn; dáng không kèm `HAND_FIT` như cũ", () => {
    const PHONE = item(dienThoai);
    const fr = graspFrame(PHONE, itemGeom(PHONE), { group: "palmBox" }, -1, dims, K, LONG);
    const inp = { side: -1, k: K, long: LONG, shape: PHONE.shape!, G: fr.G, roles: fr.roles };
    const base = heldFit({ ...inp, v: fr.pose });
    expect(base).toHaveLength(HAND_FIT.length);
    // dáng kèm `HAND_FIT` toàn 0: đúng như không kèm
    expect(heldFit({ ...inp, v: [...fr.pose, ...new Array(HAND_FIT.length).fill(0)] })).toEqual(
      base,
    );
    // ngón út (`support`, không cuộn) mang 10° gập sẵn: kết quả giữ nguyên phần ấy
    const given = new Array(HAND_FIT.length).fill(0);
    given[8] = 10;
    const out = heldFit({ ...inp, v: [...fr.pose, ...given], curl: 0 });
    expect(out[8]).toBeGreaterThanOrEqual(10 - 1e-9);
  });

  it("soạn ở tay trái (`authoredFromSide`): bản soạn ghi tay phải, tay trái dựng lại đúng khung đang thấy; mở rồi lưu không đổi", () => {
    const PHONE = item(dienThoai);
    const geom = itemGeom(PHONE);
    const pick = { group: "palmBox", along: 0.419, thumb: "left", tilt: 20.6 } as Pick;
    const raw = graspFrame(PHONE, geom, pick, 1, dims, K, LONG, 1.3);
    const choice = { ...raw.choice, group: pick.group, variant: raw.choice.variant! };
    const save = (G: typeof raw.G, curl?: number) =>
      authoredFromSide(
        PHONE,
        geom,
        choice,
        1,
        G,
        raw.hand.pose,
        K,
        LONG,
        raw.pose,
        undefined,
        curl,
      );
    const withAu = (au: ReturnType<typeof save>) =>
      item({ ...structuredClone(dienThoai), authored: { palmBox: { [choice.variant]: au } } });
    // chưa chỉnh: bản soạn trùng bộ giải tay phải, tay trái trùng bộ giải tay trái
    const a0 = withAu(save(raw.G));
    for (const side of [-1, 1]) {
      const want = graspFrame(PHONE, geom, pick, side, dims, K, LONG, 1.3);
      const got = graspFrame(a0, itemGeom(a0), pick, side, dims, K, LONG, 1.3);
      expect(got.authored).toBe(true);
      close(got.G.R, want.G.R, 1e-4);
      close(got.G.p, want.G.p, 2e-5);
    }
    // đã chỉnh: món xoay, dời trong khung bàn tay trái; tay trái dựng lại đúng khung ấy
    const turn = quatM3([0.12, -0.2, 0.07, 0.97]);
    const G = {
      R: matMul(turn, raw.G.R),
      p: [raw.G.p[0] + 0.004, raw.G.p[1] - 0.006, raw.G.p[2] + 0.003] as V3,
      u: raw.G.u,
    };
    const au = save(G, 4);
    const a1 = withAu(au);
    const left = graspFrame(a1, itemGeom(a1), pick, 1, dims, K, LONG, 1.3);
    close(left.G.R, G.R, 1e-4);
    close(left.G.p, G.p, 2e-5);
    // mở lại ở tay trái rồi lưu không đổi gì: cùng bản soạn
    const again = authoredFromSide(
      a1,
      itemGeom(a1),
      choice,
      1,
      left.G,
      left.hand.pose,
      K,
      LONG,
      left.pose,
      undefined,
      4,
    );
    close(again.item.p, au.item.p, 2e-5);
    close(again.item.q, au.item.q, 2e-5);
    expect(again.choice).toEqual(au.choice);
  });

  it("`AUTHORED_CURL` khi bản soạn không khai `curl`", () => {
    const BANG = item(bangGia);
    const pick: Pick = { group: "sheet", variant: "pinch", edge: "bottom", thumb: "front" };
    const { spec } = withAuthored(BANG, pick);
    expect(graspFrame(spec, itemGeom(spec), pick, -1, dims, K, LONG).curl).toBe(AUTHORED_CURL);
  });
});

/** Món kèm kiểu cầm có tên `name` (mượn biến thể của `pick`), bàn tay dựng từ khung bộ giải của `pick` cộng `fit` */
function withNamed(spec: HeldItemSpec, pick: Pick, name: string, fit?: number[]) {
  const { spec: atBase, variant } = withAuthored(spec, pick, fit);
  const au = atBase.authored![pick.group]![variant];
  const named = item({
    ...structuredClone(spec),
    authored: { [pick.group]: { [name]: { base: variant, note: "thử", ...au } } },
  });
  return { named, atBase, base: variant };
}

describe("kiểu cầm có tên (`authored.<nhóm>.<tên>`, `base`, `note`)", () => {
  const BANG = item(bangGia);
  const au = {
    item: { p: [0.03, -0.11, 0.01], q: [0, 0, 0, 1] },
    anchor: "edge",
    fingers: [46, 46, 6, 22, 45, 35, 70, 70, 0, 0],
  };
  const withKey = (key: string, a: object) => ({ ...bangGia, authored: { sheet: { [key]: a } } });
  const errs = (j: unknown) => {
    const r = parseHeldItem(j);
    expect(r.success).toBe(false);
    return r.error!.issues.map((i) => i.message).join("; ");
  };

  it("schema: tên cần `base` là biến thể gốc; khoá biến thể gốc không khai `base`; tên `[a-z0-9-]+`", () => {
    const ok = item(withKey("kep-mep-doc", { ...au, base: "flat", note: "kẹp mép dọc" }));
    expect(ok.authored!.sheet!["kep-mep-doc"]).toMatchObject({ base: "flat", note: "kẹp mép dọc" });
    expect(item(withKey("flat", { ...au, note: "mặc định" })).authored!.sheet!.flat.note).toBe(
      "mặc định",
    );
    expect(errs(withKey("kep-mep-doc", { ...au, base: "kep" }))).toMatch(
      /`base: kep` không phải biến thể gốc của nhóm `sheet` \(pinch, flat, rim\)/,
    );
    expect(errs(withKey("kep-mep-doc", au))).toMatch(/`kep-mep-doc` cần `base`/);
    // tên trùng biến thể gốc là khoá biến thể gốc: không khai `base`
    expect(errs(withKey("flat", { ...au, base: "pinch" }))).toMatch(
      /`flat` là biến thể gốc của nhóm `sheet`, không khai `base`/,
    );
    expect(errs(withKey("Kep_Doc", { ...au, base: "flat" }))).toMatch(/a–z, 0–9/);
    expect(errs(withKey("kep", { ...au, base: "flat", note: "" }))).toBeTruthy();
    // món bản 2 có kiểu cầm có tên: nạp như bản hiện hành
    expect(
      item({ ...withKey("kep", { ...au, base: "flat" }), schemaVersion: 2 }).schemaVersion,
    ).toBe(HELD_VERSION);
  });

  it("`variantOf`, `namedVariants`: tên ra biến thể gốc và bản soạn của chính tên ấy; `GROUP_VARIANTS` khớp `GRIP_GROUPS`", () => {
    const m = item({
      ...bangGia,
      authored: {
        sheet: { flat: au, "kep-mep-doc": { ...au, base: "flat", note: "đưa thực đơn" } },
      },
    });
    const r = variantOf(m, "sheet", "kep-mep-doc")!;
    expect(r.base).toBe("flat");
    expect(r.authored).toBe(m.authored!.sheet!["kep-mep-doc"]);
    expect(variantOf(m, "sheet", "flat")!.authored).toBe(m.authored!.sheet!.flat);
    expect(variantOf(m, "sheet", "pinch")).toMatchObject({ base: "pinch" });
    expect(variantOf(m, "sheet", "pinch")!.authored).toBeUndefined();
    expect(variantOf(m, "sheet", "kep")).toBeUndefined();
    expect(variantOf(m, "card", "kep-mep-doc")).toBeUndefined();
    expect(namedVariants(m, "sheet")).toEqual([
      { name: "kep-mep-doc", base: "flat", note: "đưa thực đơn" },
    ]);
    expect(namedVariants(BANG, "sheet")).toEqual([]);
    for (const g of GROUP_IDS)
      expect(Object.keys(GRIP_GROUPS[g].variants)).toEqual(GROUP_VARIANTS[g]);
  });

  it("tên mượn đúng `base`: khung cầm trùng bản soạn ấy đặt ở khoá biến thể gốc — cả tay trái, cỡ tay khác, `along` khác", () => {
    const pick: Pick = {
      group: "sheet",
      variant: "flat",
      edge: "bottom",
      thumb: "front",
      along: 0.3,
    };
    const fit = [0, 0, 4, 6, 0, 0, 8, 12, 0, 0];
    const { named, atBase, base } = withNamed(BANG, pick, "kep-mep-doc", fit);
    expect(base).toBe("flat");
    for (const side of [-1, 1])
      for (const [k, along] of [
        [K, 0.3],
        [K * 1.2, 0.3],
        [K, 0.6],
      ]) {
        const at = (s: HeldItemSpec, variant: string) =>
          graspFrame(s, itemGeom(s), { ...pick, along, variant }, side, dims, k, k * 0.9, 1.3);
        const a = at(named, "kep-mep-doc");
        const b = at(atBase, "flat");
        expect(a.authored).toBe(true);
        expect(a.base).toBe("flat");
        expect(b.base).toBeUndefined();
        expect(a.choice).toEqual({ ...b.choice, variant: "kep-mep-doc" });
        expect({ ...a, base: undefined, choice: undefined }).toEqual({
          ...b,
          choice: undefined,
        });
        // biến thể gốc của món có tên không đổi: bộ giải như món không có bản soạn
        expect(at(named, "flat")).toEqual(at(BANG, "flat"));
      }
    expect(frameCurl("sheet", { choice: { variant: "kep-mep-doc" }, base: "flat" })).toBe(
      frameCurl("sheet", { choice: { variant: "flat" } }),
    );
  });

  it("tay trái gương: kiểu cầm có tên trùng bộ giải tay phải thì tay trái trùng bộ giải tay trái (ống nghe `around` 150)", () => {
    const ONG = item(ongNghe);
    const pick: Pick = {
      group: "cylinder",
      variant: "flat",
      part: "tay",
      along: 0.32,
      around: 150,
      thumb: "up",
    };
    const { named } = withNamed(ONG, pick, "ap-tai");
    const rig = graspFrame(ONG, itemGeom(ONG), pick, 1, dims, K, LONG);
    const au = graspFrame(named, itemGeom(named), { ...pick, variant: "ap-tai" }, 1, dims, K, LONG);
    expect(au.authored).toBe(true);
    close(au.G.R, rig.G.R, 1e-4);
    close(au.G.p, rig.G.p, 2e-5);
  });

  describe("`chooseMissing`", () => {
    const parsed = parseCharacter(fx.character);
    if (!parsed.success) throw new Error("nguoi");
    const T = trunk3(parsed.data, { pose: fx.pose, world: fx.world } as unknown as ActInput)!;
    const m = fx.ca.items.c1;
    const pose: ItemPose = {
      R: fromColumns(m.x as V3, m.y as V3, m.z as V3),
      P: m.P as V3,
      cast: "nguoi",
      s: 1,
    };
    const PHONE = item(dienThoai);
    const ONG = item(ongNghe);
    // kiểu cầm có tên lệch hẳn bộ giải (ngón gập thêm): rig mà chọn nó thì kết quả khác
    const fit = [0, 0, 20, 20, 0, 0, 20, 20, 0, 0];
    const cases: [string, HeldItemSpec, Pick][] = [
      [
        "bang-gia@sheet",
        BANG,
        { group: "sheet", variant: "pinch", edge: "bottom", thumb: "front" },
      ],
      ["bang-gia@sheet", BANG, { group: "sheet", variant: "rim", edge: "bottom", thumb: "front" }],
      ["dien-thoai@palmBox", PHONE, { group: "palmBox" }],
      [
        "ong-nghe-ban@cylinder",
        ONG,
        { group: "cylinder", variant: "wrap", part: "tay", around: 90 },
      ],
    ];

    it("không bao giờ chọn tên: cảnh không khai `variant` thì trùng từng số như món không có kiểu cầm có tên", () => {
      for (const [hold, spec, pick] of cases) {
        const name = hold.split("@")[0];
        const { named } = withNamed(spec, pick, "kieu-rieng", fit);
        for (const side of [-1, 1]) {
          const a = chooseMissing(graspCtx(T, { [name]: named }), hold, pose, side);
          const b = chooseMissing(graspCtx(T, { [name]: spec }), hold, pose, side);
          expect(a).toEqual(b);
          expect(a.choice.variant).not.toBe("kieu-rieng");
        }
      }
    });

    it("cảnh khai tên (dạng tắt `món@nhóm/tên`): giữ tên, khung cầm theo bản soạn, báo kèm `base`", () => {
      const pick: Pick = { group: "sheet", variant: "flat", edge: "bottom", thumb: "front" };
      const { named, atBase } = withNamed(BANG, pick, "kep-mep-doc", fit);
      const ctx = graspCtx(T, { "bang-gia": named });
      const sol = chooseMissing(ctx, "bang-gia@sheet/kep-mep-doc", pose, -1);
      expect(sol.choice.variant).toBe("kep-mep-doc");
      expect(sol.by.variant).toBe("scene");
      expect(sol.frame.authored).toBe(true);
      expect(sol.frame.base).toBe("flat");
      expect(graspReport(sol, 0).base).toBe("flat");
      const obj = chooseMissing(
        ctx,
        { item: "bang-gia", group: "sheet", variant: "kep-mep-doc" },
        pose,
        -1,
      );
      expect(obj).toEqual(sol);
      // cùng lựa chọn, món có bản soạn ấy ở khoá `flat`: cùng khung cầm
      const flat = graspFrame(
        atBase,
        itemGeom(atBase),
        { ...sol.choice, group: "sheet", variant: "flat" },
        -1,
        ctx.dims,
        ctx.k * ctx.s,
        ctx.long * ctx.s,
        pose.s,
        sol.high,
      );
      close(sol.frame.G.R, flat.G.R, 1e-9);
      close(sol.frame.G.p, flat.G.p, 1e-9);
    });
  });

  it("`variant` lạ là lỗi `choice`: nêu món, tên, biến thể gốc và kiểu cầm có tên của món — ở `checkChoice` và lúc `resolveScene`", () => {
    const { named } = withNamed(
      BANG,
      { group: "sheet", variant: "flat", edge: "bottom" },
      "kep-mep-doc",
    );
    const geom = itemGeom(named);
    const hold = {
      item: "bang-gia",
      group: "sheet",
      edge: "bottom",
      variant: "kep-ngang",
    } as const;
    const lines = checkChoice(
      "sheet",
      geom,
      hold,
      dims,
      named.anchors,
      named.shape,
      named.authored,
    );
    expect(lines.join()).toMatch(
      /`bang-gia@sheet`: biến thể `kep-ngang` không có ở nhóm `sheet` \(gốc: pinch, flat, rim; kiểu cầm của món: kep-mep-doc\)/,
    );
    const ok = { ...hold, variant: "kep-mep-doc" };
    expect(
      checkChoice("sheet", geom, ok, dims, named.anchors, named.shape, named.authored),
    ).toEqual([]);
    // không đưa `authored` của món: tên ấy là lạ
    expect(checkChoice("sheet", geom, ok, dims, named.anchors, named.shape).join()).toMatch(
      /biến thể `kep-mep-doc` không có/,
    );

    const parsed = parseCharacter(fx.character);
    if (!parsed.success) throw new Error("nguoi");
    const run = (h: unknown) => {
      const r = parseScene({
        duration: 2,
        lens: { eye: [0, -400, -900], yaw: 0, pitch: 0, f: 1000 },
        cast: [
          {
            id: "nguoi",
            world: {
              at: [250, 0, 506],
              yaw: 270,
              hands: [
                { t: 0, right: { to: "chest", offset: [30, 20, 20], point: "grip", hold: h } },
              ],
            },
          },
        ],
      });
      if (!r.success) throw new Error(r.error.message);
      return resolveScene(
        r.data,
        {},
        { nguoi: parsed.data.rig.height },
        { nguoi: body3(parsed.data) },
        { "bang-gia": named },
      );
    };
    expect(() => run("bang-gia@sheet/kep-ngang")).toThrow(
      /lỗi `choice`: `bang-gia@sheet`: biến thể `kep-ngang` không có/,
    );
    expect(() => run("bang-gia@sheet/kep-mep-doc")).not.toThrow();
  });

  it("dạng tắt `món@nhóm/tên`", () => {
    expect(groupHold("thuc-don@sheet/kep-mep-doc")).toEqual({
      item: "thuc-don",
      group: "sheet",
      variant: "kep-mep-doc",
    });
    expect(groupHold("thuc-don@sheet")).toEqual({ item: "thuc-don", group: "sheet" });
    expect(groupHold("coc@cylinder/wrap")).toEqual({
      item: "coc",
      group: "cylinder",
      variant: "wrap",
    });
    expect(holdRunKey("thuc-don@sheet/kep-mep-doc")).toBe(
      holdRunKey({ item: "thuc-don", group: "sheet", variant: "kep-mep-doc" }),
    );
    expect(sceneHoldRef("thuc-don@sheet/kep-mep-doc").grip).toBe("@sheet/kep-mep-doc///");
    expect(SceneHoldSchema.safeParse("thuc-don@sheet/kep-mep-doc").success).toBe(true);
    for (const bad of [
      "thuc-don@sheet/Kep",
      "thuc-don@sheet/",
      "a/b@sheet",
      "a@sheet/x/y",
      "a@sheet/x_y",
    ]) {
      const r = SceneHoldSchema.safeParse(bad);
      expect(r.success, bad).toBe(false);
      expect(r.error!.issues[0].message).toMatch(/món@nhóm\/kiểu/);
      expect(() => groupHold(bad)).toThrow(/món@nhóm\/kiểu/);
    }
    expect(SceneHoldSchema.safeParse("thuc-don@cam/kep").error!.issues[0].message).toMatch(
      /`cam` không phải nhóm cầm/,
    );
    expect(SceneHoldSchema.safeParse("dien-thoai#doc").error!.issues[0].message).toMatch(
      /stickman migrate-held/,
    );
  });
});
