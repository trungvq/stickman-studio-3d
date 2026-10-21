// node s012-moi.mjs <ra.json> — cảnh s012 chuyển thẻ phòng sang mốc món (yota đặt xuống quầy, takumi nhặt lên) từ bản gốc
import { readFileSync, writeFileSync } from "node:fs";
const d = JSON.parse(readFileSync(new URL("./t02-s012-chia-khoa.goc.json", import.meta.url), "utf8"));
const CARD = { item: "the-phong", group: "card", part: "body" };
// mặt quầy y −200 (`CAO.quay` của repo video); thẻ nằm ngửa, cạnh dưới chĩa về khách
const LIE = { point: "back", up: "front", roll: { axis: "bottom", toward: "forward" } };
const env = (k, v) => (process.env[k] ? JSON.parse(process.env[k]) : v);
const yota = d.cast.find((c) => c.id === "yota");
yota.world.hands = [
  // tay trái đưa ra trước khi thẻ hiện (cắt cận ở `@kochira` 5,45): mốc chỉ mang chỗ cầm giữ đích của mốc trước
  { t: 5.0, left: null },
  { t: 5.4, left: { at: [292, -258, 704], point: "grip", elbow: [-0.4, 0.6, 1] } },
  { t: 5.45, left: { hold: { ...CARD } } },
  { t: 6.08, left: { at: [256, -205, 651], point: "grip", elbow: [-0.4, 0.6, 1], hold: null } },
  ...yota.world.hands.filter((k) => k.t > 6.1),
];
const takumi = d.cast.find((c) => c.id === "takumi");
takumi.world.hands = [
  ...takumi.world.hands.filter((k) => k.t < 6.2),
  // tay phải lên trước mặt quầy rồi qua mép quầy, tới thẻ đúng mốc nằm 6,7
  ...env("TAKUMI_UP", [
    { t: 6.1, right: null },
    { t: 6.26, right: { at: [306, -192, 540], point: "grip", elbow: [-0.4, 1, 0.5] } },
    { t: 6.38, right: { at: [270, -232, 600], point: "grip", elbow: [-0.4, 1, 0.5] } },
  ]),
  { t: 6.4, right: { hold: { ...CARD } } },
];
d.items = [
  { t: 5.45, cast: "yota", item: "the-phong", at: [290, -262, 700], ...LIE },
  { t: 5.8, cast: "yota", item: "the-phong", at: [258, -214, 650], ...LIE },
  { t: 6.02, cast: "yota", item: "the-phong", at: env("REST_AT", [256, -200, 644]), ...LIE, rest: true },
  { t: 6.7, cast: "takumi", item: "the-phong", rest: true },
  { t: 7.2, cast: "takumi", item: "the-phong", ...env("LIFT", { to: "chest", offset: [36, -10, 4], face: { axis: "front", toward: "holderFace", tilt: 25 }, roll: { axis: "top", toward: "forward" } }) },
];
// `items` cạnh `cast`
const out = {};
for (const [k, v] of Object.entries(d)) {
  out[k] = v;
  if (k === "cast") out.items = d.items;
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 2) + "\n");
