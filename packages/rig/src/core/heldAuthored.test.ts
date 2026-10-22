import { describe, expect, it } from "vitest";
import { frameCurl, graspFrame, type GraspChoice } from "./graspSolve";
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
import { parseHeldItem, type GroupId, type HeldItemSpec } from "./heldItem";
import { cross3, dot3, type V3 } from "./lens";
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

  it("`AUTHORED_CURL` khi bản soạn không khai `curl`", () => {
    const BANG = item(bangGia);
    const pick: Pick = { group: "sheet", variant: "pinch", edge: "bottom", thumb: "front" };
    const { spec } = withAuthored(BANG, pick);
    expect(graspFrame(spec, itemGeom(spec), pick, -1, dims, K, LONG).curl).toBe(AUTHORED_CURL);
  });
});
