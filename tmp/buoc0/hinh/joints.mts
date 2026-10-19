import fs from "node:fs";
import { actJoints } from "../../../packages/rig/src/core/act3";
import { parseScene, resolveScene, sceneAt } from "../../../packages/rig/src/core/scene";
import { parseCharacter } from "../../../packages/rig/src/core/schema";
import { parseAction } from "../../../packages/rig/src/core/action";
import { body3 } from "../../../packages/rig/src/core/figure3d";
import { parseHeldItem } from "../../../packages/rig/src/core/heldItem";
const V = "/home/trungvq/Work/Dev/youtube-video/jp-sukatto";
const rj = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));
const C = rj(new URL("./cells.json", import.meta.url).pathname);
const ch: any = { yota: parseCharacter(rj(`${V}/characters/yota.json`)).data, khach: parseCharacter(rj(`${V}/characters/takumi.json`)).data };
const st = parseAction(rj("/home/trungvq/Work/Dev/stickman-studio-3d/apps/studio/public/actions/stand-3d.json")).data!;
const held: any = {};
for (const it of ["bang-gia", "chai-dia"]) { const raw = rj(`${V}/held/${it}.json`); raw.grips = { ...raw.grips, ...C.grips[it] }; held[it] = parseHeldItem(raw).data; }
for (const c of C.cells) {
  const sc = parseScene(c.scene).data!;
  const rt = resolveScene(sc, { "stand-3d": st }, {}, {}, { yota: ch.yota.rig.height, khach: ch.khach.rig.height }, { yota: body3(ch.yota), khach: body3(ch.khach) }, held);
  const sp: any = sceneAt(rt, "yota", 0, ch.yota.rig.height, body3(ch.yota));
  const j: any = actJoints(ch.yota, sp);
  const keys = Object.keys(j);
  const pick = (re: RegExp) => keys.filter((k) => re.test(k));
  const o: any = {};
  for (const k of [...pick(/R/i)].slice(0, 0)) o[k] = j[k];
  const rel = (p: number[]) => p.map((v, i) => Math.round(v - [C.at[0], 0, C.at[2]][i]));
  console.log(c.key, Object.fromEntries(keys.filter((k) => /shoulder|elbow|wrist|chest|neck|hip/i.test(k)).map((k) => [k, rel(j[k])])));
}
