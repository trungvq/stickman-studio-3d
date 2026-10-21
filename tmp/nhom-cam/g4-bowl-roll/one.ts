// Một dáng (`X` như `opt.ts`) đo ở mọi ca; `CURL` đè tầm cuộn
import { run, fmt } from "./do";
import { GRIP_GROUPS, PINCH_ALONG } from "../../../packages/rig/src/core/graspGroups";
import { HAND_POSES, THUMB_ROLL } from "../../../packages/rig/src/core/hand";
(PINCH_ALONG as any)[0] = 0; (PINCH_ALONG as any)[1] = 0.8;
const LIM = JSON.parse(process.env.LIM ?? "[-15,45]");
(THUMB_ROLL as any)[0] = LIM[0]; (THUMB_ROLL as any)[1] = LIM[1];
const P = HAND_POSES.cupPinch as any;
const V = (GRIP_GROUPS.bowl.variants as any).pinch;
const S = V.pose;
const x = JSON.parse(process.env.X!);
P.thumb = x.slice(0, 4); P.thumbRoll = x[4]; P.index = [x[5], x[6]]; P.fingers = [x[7], x[8]];
S.closed = { pose: "cupPinch", knuckle: x[9], tip: x[10] }; S.open = { pose: "cupPinch", knuckle: x[11], tip: x[12] };
if (process.env.CURL) V.curl = Number(process.env.CURL);
if (process.env.ROLES) Object.assign(V.roles, JSON.parse(process.env.ROLES));
const ALONGS = JSON.parse(process.env.ALONGS ?? "[0.35,0.45,0.55]");
const SIDES = JSON.parse(process.env.SIDES ?? "[-1]");
for (const [name, k, l] of [["sakura", 1.75, 1.545], ["kuroiwa", 2, 1.813]] as const) for (const side of SIDES) for (const a of ALONGS) {
  const r = run(k, l, side, a, !!process.env.NOFIT);
  console.log(`${name} ${side < 0 ? "P" : "T"} ${a} | ${fmt(r)} | fit ${r.fit.map((v: number) => v.toFixed(0)).join(",")}`);
}
