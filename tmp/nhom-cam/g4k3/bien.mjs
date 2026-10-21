// node bien.mjs — biến thể cảnh đổi đường: mốc món cuối (3,3 s) đổi chỗ, ghi /tmp/v-<i>.json
import { readFileSync, writeFileSync } from "node:fs";
const base = JSON.parse(readFileSync(new URL("../g4k2/thu-nhom-cam-doi-duong.json", import.meta.url), "utf8"));
const vs = process.env.VS ? JSON.parse(process.env.VS) : [
  ["chest", [40, -6, 6]],
  ["chest", [38, -30, 8]],
  ["neck", [40, 10, 6]],
  ["chest", [30, -40, 12]],
  ["eye", [46, 30, 4]],
];
vs.forEach(([to, offset], i) => {
  const d = structuredClone(base);
  Object.assign(d.items[2], { to, offset });
  writeFileSync(`/tmp/v-${i}.json`, JSON.stringify(d));
  console.log(i, to, JSON.stringify(offset));
});
