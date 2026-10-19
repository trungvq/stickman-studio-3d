# Giai đoạn 3: kế hoạch job cho lõi nhóm cầm

> Nguồn: `docs/11-nhom-cam.md` (mục 1–3, 5–7, 9), `tmp/nhom-cam/b0/ket-qua.md`, `tmp/nhom-cam/review-b0.md`, `tmp/nhom-cam/b0/grasp.mts`.
> Xong khi `sheet` (`pinch`) và `palmBox` chạy đủ hai đường (món đặt trước, tay dẫn): gắn món, ngón, khuỷu, `check`, `scene_probe`,
> `bang-cam`. Đường `món#kiểu` và `held/` v1 vẫn chạy tới giai đoạn 6.
> Agent chính đã chốt: mốc món `items` đặt ở **cấp cảnh** (cạnh `cast`), mỗi mốc có `cast`; `hands` vẫn ở `cast[].world.hands`.

## 1. Chạy song song đường cũ (giai đoạn 3–5)

**`HELD_VERSION`**
- `HELD_VERSION = 2` là bản mới nhất rig hiểu. Thêm `HELD_MIN = 1`.
- `schemaVersion: z.union([z.literal(1), z.literal(2)], { error: "JSON món cầm thuộc phiên bản schema khác; cần bản @stickman3d/rig khớp với nó" })`. File số 3 trở lên vẫn bị zod báo lỗi phiên bản.
- `migrateHeldItem` (`heldItem.ts:256-263`) **không được nâng 1 thành 2** (code hiện ghi đè `schemaVersion = HELD_VERSION`). Luật mới: thiếu số thì là 1, số 1 giữ 1, số lớn hơn `HELD_VERSION` trả nguyên để zod báo lỗi.
- Giai đoạn 6: `HELD_MIN = 2`, v1 ra lỗi kèm hướng dẫn chuyển.

**`HeldItemSchema`: một object, rẽ theo phiên bản trong `superRefine`**
- `grips` thành tuỳ chọn. Thêm `front`, `top`, `parts`, `seats`, `touch` (tuỳ chọn). Mỗi khối `shape` thêm `part?`, `detail?`.
- v1: bắt buộc `grips` (≥ 1, tên kiểu không bắt đầu bằng `@`), cấm các trường chỉ có ở v2.
- v2: bắt buộc `shape`, cấm `grips` ("chỗ cầm khai ở cảnh: docs/11 mục 4"), cộng các kiểm của spec mục 2.
- Thêm `isHeldV2(spec)`. `heldGrip`, `gripSpec`, `gripOf` đọc `spec.grips?.[g]`; gặp món v2 thì lỗi có tên: "món v2 không có kiểu cầm, khai `món@nhóm`".

**`SceneHoldSchema`: hợp bốn dạng**
- Chuỗi `^[^#@]+#[^#@]+$` (v1); chuỗi `^[^@#]+@[a-zA-Z]+$` (v2); `strictObject{item, grip, face?, up?, roll?}` (v1); `strictObject{item, group, …}` (v2, spec mục 4).
- `holdKind(h): "grip" | "group"`; `groupHold(h)` đổi chuỗi `món@nhóm` ra object.

**Chỗ nối duy nhất là khoá lần cầm.** `sceneHoldRef(h)` vẫn trả `{ item, grip }`. Với v2, `grip` là khoá dựng từ các trường rời theo thứ tự
cố định: `@<group>/<variant>/<part>/<edge>/<thumb>` (thiếu để trống). Trường số không vào khoá. Mọi chỗ đang so `grip` chạy được với v2:
`holdRun.since` (`scene.ts:3018-3022`); `regrip`/`from` (`scene.ts:3158-3168`); ý định khớp lần cầm (`act3.ts:1530-1533`, `world.ts:296`);
`Holding.grip`; khoá `jump` của `heldAudit`; `holdKey` của `bang-cam`; `render/lib.mjs:456`. `regrip: true` mở lần cầm mới trong `holdRun`.

**Lớp liên kết `core/holdLink.ts` (mới): chỗ duy nhất rẽ v1/v2 cho bàn tay**
```ts
holdHand(h: ReachHold, side, dims): { hand: GripHand; pose: HandVec; roles?: Roles; both?: SupportSpec } // v1: gripHand(gripOf) · v2: graspFrame → GripHand tổng hợp
holdLinkFrame(h, side, k, long, s): { G: GripFrame; center: V3 }   // thay gripFrame+gripCenter ở leadGrip, world.regrip, attach.holdGrip
isCarryHold(spec, h): boolean                                       // v1 isCarry(grips[g]) · v2 group === "carry"
```
Prototype đã đi đường này: chỗ tiếp xúc ra một `GripHand` tổng hợp (`grasp.mts:254`, `gripHandOf`). `gripAxes`/`gripFrame` nhận `at` là
điểm `V3` trong khung món, ngoài `AnchorRef`. Tay dẫn v2 dùng lại bộ máy v1. Chỉ món đặt trước có đường riêng (cổ tay, `φ` cứng).

**Chỗ rẽ nhánh theo `hold`**

| Chỗ | `món#kiểu` / `{grip}` | `món@nhóm` / `{group}` |
|---|---|---|
| `scene.ts` `checkHolds` (`:3294`) | `heldGrip` + `holdIntent` | `checkChoice` (lỗi `group`, `choice`) + `groupIntent` |
| `scene.ts` `holdAim` (`:3108`) | `holdIntent` | `groupIntent(spec, hold)` |
| `scene.ts` `handAt` (`:3128`) | như nay | `ReachHold.grasp = { hold, mode: "item" \| "hand", choice }`; món có mốc ở `items` thì `mode: "item"` |
| `scene.ts` `sceneHoldProblems` (`:3054`) | `gripOf().both` | `hold.both` |
| `act3.ts` `holdRoles`, `leadGrip`, `supportFrom`, dáng ngón (`:1208-1282`, `:1472`) | qua `holdLink` | qua `holdLink`; `mode: "item"` không qua `holdSolve`/`aimWrist`/`HOLD_SLEW` |
| `act3.ts` `alts` (`:1806-1820`) | như nay | bỏ qua |
| `world.ts:227`, `:331-348`, `attach.ts:312-352`, `:521` | như nay | qua `holdLink` / `isCarryHold` |

Từ G3-01: mọi test ở bảng "Thứ gãy" (spec mục 8) **xanh nguyên, không sửa test**. Test mới ở file riêng hay khối `describe` mới.

## 2. Danh sách job (O Opus, S Sonnet; độ khó 1–3; mọi file lõi mới xuất ở `@stickman3d/rig/core`)

| Job | File | Xuất ra | Test | Phụ thuộc | Mô hình |
|---|---|---|---|---|---|
| **G3-01** schema món v1+v2 | `core/heldItem.ts`, test | `HELD_VERSION=2`, `HELD_MIN=1`, `isHeldV2`, `HeldShape.part/detail`, `front/top/parts/seats/touch`, `migrateHeldItem` mới; grep `\.grips` mọi gói → `?.` | `coc`, `tui` v1 không đổi; ba ví dụ v2 của spec parse; lỗi: v2 có `grips`, v1 thiếu `grips`, `schemaVersion: 3`, v1 có `front`, mốc `front/top/seats` không có hay không có `dir`, `as: "rod"` thiếu `axis`, mọi khối `grip:false`/`detail`; thiếu `schemaVersion` ra 1 | — | S/2 |
| **G3-02** chỗ cầm v2, khoá lần cầm | `core/heldItem.ts`, test | `GROUP_IDS`, `GroupId`, `SceneHoldSchema` bốn dạng, `holdKind`, `groupHold`, `holdRunKey`, `sceneHoldRef`, `SupportOverride` | bốn dạng; chuỗi có cả `#` và `@` lỗi; `along` khác cùng khoá, `edge` khác khác khoá; khoá v1 không đổi | 01 | S/2 |
| **G3-03** fixture test | `core/__fixtures__/grip-frames.json` (từ `tmp/buoc0/fixtures.json`), `core/__fixtures__/held-v2/*.json`, `core/fixtures.test.ts` | — | 15 kiểu, `R` trực chuẩn ≤ 1e-6, `det` +1; tám món v2 parse: `bang-gia`, `dien-thoai`, `bien-lai`, `dua`, `tom-hum`, `ong-nghe-ban`, `chai-dia`, `tui-hieu` (nhãn phần theo Phụ lục A) | 01 | S/1 |
| **G3-04** khối hình | `core/heldGeom.ts`, test | `itemGeom(spec)` (WeakMap), `Feature` (`slab/disc/rod/lathe/box/face`), `edgeFrame(slab, edge, thumb)`, `gripSpan`, `handDims(k, long): {W,A,L,P}` | `bien-lai`, `dien-thoai` không ra `rod`; `dua` hai `rod`; `tom-hum` một `lathe`; `ong-nghe-ban` `rod` r 3, R 9; `chai-dia` đoạn bám y 0–68,5; cỡ 1: W 8,4, A 9,76, L 17,9, P 10,1 (±0,05); tên cạnh tấm đứng/nằm ngưỡng 45° | 01, 03 | O/3 |
| **G3-05** khuỷu tự nhiên | `core/graspArm.ts`, test; `act3.ts` export `trunk3`, `markShape`, `markAt` | `armInput(T, side)`, `evalPhi`, `solvePhi(inp, Wp, Rw, phiPrev?, other?) → ArmSol`, `phiChain`; `W_DOWN 0,3`, `W_BODY 10`, `W_CONT 2`; φ theo spec mục 5; lấn trừ mức nền | lưới 10° + chia đôi = 40 lần thử; tất định; ngoài tầm: `gap > 0`, tay thẳng; `over.turn` khi \|turn\| > 90; hai mẫu liền lệch ≤ 2,5°; tay buông `body` ≈ 0 | — | O/3 |
| **G3-06** ngón theo vai trò | `core/heldFit.ts`, test | `FingerRole`, `heldFit({…, roles})` (`wrap` cũ map sang roles), tầm cuộn theo vai trò, `skinBulge`, `δ`, `skinDepth(pos, piece, IF, shape)` | kiểu cũ ra cùng số; `press` ≤ 40°/đốt; `tip` chỉ đốt ngọn ≤ 30°; `free` hoà nửa về `HAND_RELAXED`; `skinDepth` trên tấm phẳng ±0,05 | — | O/2 |
| **G3-07** bảng nhóm | `core/graspGroups.ts`, test | `GroupSpec` (không `contact`), `GRIP_GROUPS` 14 (GĐ3: chỉ `sheet`, `palmBox` không `later`), `groupNeeds`, `groupIntent`, `checkChoice`, `holdDefaults` | 14 khoá có nhãn; mặc định trong miền; `bang-gia` ra `sheet`; `dien-thoai` ra `sheet`, `palmBox`; `bien-lai` không `palmBox`; `checkChoice` báo các ca lỗi | 02, 04 | S/2 |
| **G3-08** khung cầm | `core/graspSolve.ts`, test | `CONTACTS` (`sheet` pinch/flat/rim, `palmBox`), `graspFrame(...) → { G, hand, pose, roles }`, `edgeHigh` | fixture `bang-gia#doc`, `dien-thoai#doc` trong 1 đv và 5°; tay trái `det` +1; đổi `thumb` = quay π quanh `m`; `flat` `n = F` | 04, 07, 03 | O/3 |
| **G3-09** giải chỗ cầm | `core/graspSolve.ts`, test | `handFromItem`, `graspAt(...) → GraspSolution`, `chooseMissing` (rời trước, lưới quanh nghiệm rời), `GraspReport` | bốn ca `sheet` bước 0 cổ tay ±3° so `b0/ca.json`; ca3 chọn `thumb: back`; ca4 `rim`, tay phải `wrist` vượt; tất định; `by` đúng; tay trượt `along` 0,2→0,8 khuỷu ≤ 2,5°/mẫu | 05, 08 | O/3 |
| **G3-10** mốc món | `core/scene.ts` (schema `items` cấp cảnh + `itemAt`), `core/sceneItems.test.ts` | `SceneItemMarkSchema`, `itemAt(rt, item, t)`: hoà trong khung mốc thân, `slerp`, giữ hai đầu, `holderFace` kẹp ngẩng 45°, vectơ hệ thân | điểm giữa đúng `ease`; `slerp` đường ngắn; giữ mốc đầu; lỗi `item` < 18°; ca1 ngẩng ≤ 45° | 02 | O/2 |
| **G3-11** cảnh nối chỗ cầm | `core/scene.ts` (`holdRun`, `handAt`, `checkHolds`, `sceneHoldProblems`, `holdAim`), `core/holdSceneV2.test.ts` | `ReachHold.grasp`, `from` mang `grasp`, hoà trường số, nhớ `graspAt` theo runtime | `món#kiểu` ra `ReachHold` như cũ; tay dẫn `mode: "hand"`; có mốc món `mode: "item"`; lỗi `choice`; `regrip`; `along` hoà | 07, 09, 10 | O/3 |
| **G3-12** act3 tay dẫn v2 | `core/holdLink.ts`, `core/act3.ts`, test | `holdHand`, `holdLinkFrame`, `isCarryHold` | `act3.test.ts`, `holdScene.test.ts` xanh; `dien-thoai@palmBox` lòng tay áp mặt sau ≤ 5°; `sheet` `both: true` tay phụ cạnh đối diện khe ≤ 1 | 11 | O/3 |
| **G3-13** act3 món đặt trước | `core/act3.ts`, test | `Wp`, `Rw`, `φ` cứng (không `aimWrist`, `HOLD_SLEW`, dò khuỷu); `AimReport.hold.grasp` | `actJoints` khớp: khuỷu ≤ 0,05, lòng tay ≤ 0,1°; ngoài tầm: tay thẳng, `reach.gap > 0`; tay trái tính tay phải vào lấn | 12 | O/3 |
| **G3-14** gắn món three | `src/attach.ts`, `src/world.ts`, `src/holdWorldV2.test.ts` | qua `holdLink`; `fitHolding` nhớ theo lần cầm, nhận `roles` | `grip.test.ts`, `holdWorld.test.ts` xanh; món đặt trước trùng `itemAt` ≤ 0,01; tay dẫn món theo bàn tay | 06, 13 | O/2 |
| **G3-15** số đo held | `src/held.ts`, test | `skinDepth` thay `handCaps` (`held.ts:87`); `HeldHand.grasp` | `held.test.ts` xanh; lún `bang-gia` dáng `sheet` trên da 0,48 ±0,1 | 06, 14 | S/2 |
| **G3-16** luật `check` | `core/heldAudit.ts`, test | `reach`, `wrist`, `arm`, `role`, `loose`, `sink`, `size`, `grip` theo nhóm; v1 giữ `pose`, `drift` | test cũ xanh; mỗi luật một ca kêu một ca im; dòng báo v2 trỏ chỗ cầm | 13, 15 | O/2 |
| **G3-17** MCP | `packages/mcp/server.mjs` | `schema(held)` v2; chuỗi `held` (`:533`); `list(held)` nhóm áp được (`:537`, `:725`); `describe_held`; `scene_probe` `grasp` | kiểm tay qua stdio | 07, 16 | S/2 |
| **G3-18** CLI | `packages/cli/lib.mjs` (`:1532`, `:1566`), `cli/held.test.mjs` | ngưỡng `sink`, `size`, `arm`; `heldFrame` trả `grasp` | v1 cùng `HeldHand`; v2 có `grasp.choice` | 16 | S/1 |
| **G3-19** `bang-cam` theo nhóm | `packages/cli/scaffold/tools/bang-cam.mjs` | `--nhom`; hàng mẫu `sheet`/`palmBox`; không cờ giữ v1; `.grips` (`:183`, `:226`, `:271`) bỏ qua v2 | chạy hai chế độ trên repo video | 18 | S/2 |
| **G3-20** docs | `docs/01`, `03`, `04`, `05`, `11` | hai đường như trạng thái hiện tại | `pnpm format:check` | 17, 19 | S/1 |
| **G3-21** cảnh thử repo video | `held/thu-bang-gia.json`, `held/thu-dien-thoai.json` (v2), bí danh `src/objects/luoi-mon.ts:29`, `scenes/thu-nhom-cam.json`; `tools/held-moc.mjs` (`:199-236`) bỏ qua v2 | món đặt trước (đọc ngang ngực, khoe hai cạnh) + tay dẫn (xem, áp tai) | `pnpm test` repo video xanh | 14, 16 | S/1 |

Gộp/bỏ so với spec: bước 8 (`hand.ts` `tripod`/`chopsticks`) sang giai đoạn 4; `migrate-held`, món mẫu `coc`/`tui` v2 sang giai đoạn 6;
`contact` tách khỏi `GroupSpec` thành `CONTACTS` trong `graspSolve.ts` (tránh vòng import).

**Đợt**: 1: 01, 05, 06 · 2: 02, 03, 10 · 3: 04 · 4: 07 · 5: 08 · 6: 09 · 7: 11 · 8: 12 · 9: 13 · 10: 14 · 11: 15 · 12: 16 · 13: 17, 18 · 14: 19, 20, 21

## 3. Mốc commit

| Mốc | Sau job | Commit |
|---|---|---|
| M1 | 01, 02, 03 | `feat(rig): accept held schema v2 and group holds alongside grips` |
| M2 | 04, 05, 06, 07 | `feat(rig): derive item features, grip groups, natural elbow and role-based finger fit` |
| M3 | 08, 09 | `feat(rig): solve grasp frames and missing grip choices for sheet and palmBox` |
| M4 | 10, 11 | `feat(rig): place items in scenes and resolve group holds per run` |
| M5 | 12, 13 | `feat(rig): drive hands from placed items and lead group holds in act3` — kiểm t02 ngay |
| M6 | 14, 15, 16 | `feat(rig): attach and audit group holds on skin` |
| M7 | 17, 18, 19 | `feat(mcp,cli): describe_held, grasp probe and group bang-cam` |
| M8 | 20 (+21 ở repo video) | `docs: …` |

**Kiểm cuối** (repo video):
```bash
pnpm exec stickman check --scene '^t02-' --only ref                       # 0 lỗi
pnpm exec stickman check --scene '^t02-' --only held,clash \
  --baseline ../../stickman-studio-3d-nhom-cam/tmp/nhom-cam/baseline/check-held-clash.json   # 0 lỗi, 0 cảnh báo mới
pnpm exec stickman check --scene '^t02-s023'                              # 0 lỗi, 1 cảnh báo
pnpm exec stickman check --scene '^thu-nhom-cam'
pnpm bang-cam --mon bang-gia,dien-thoai,tui-hieu
pnpm bang-cam --nhom sheet,palmBox --mon thu-bang-gia,thu-dien-thoai
pnpm frames thu-nhom-cam
```
Cộng `scene_probe` trên `thu-nhom-cam`: có `world.held.right.grasp.choice` và `by`.

## 4. Rủi ro
1. (Đã chốt) `items` ở cấp cảnh.
2. `.grips` đổ khi gặp v2: `world.ts:227`, `scene.ts:3157`, `:3334`, `act3.ts:1811`, `server.mjs:537`, `:725`, `bang-cam.mjs:183`, `:226`, `:271`, `tools/held-moc.mjs` của repo video. G3-01 grep hết.
3. `migrateHeldItem` nâng phiên bản mù (`heldItem.ts:260-261`).
4. Regex `SceneHoldSchema` (`heldItem.ts:516`): cấm `@` trong dạng v1; thông điệp lỗi có tên từng dạng.
5. Vòng import: `trunk3`, `markShape`, `markAt` private (`act3.ts:617`, `:836`, `:863`); `graspArm` nhận `ArmInput`. Kiểm `pnpm build` ở M2.
6. Món đặt trước lọt vào `priorWrist`/`HOLD_SLEW` (`act3.ts:1706-1714`, `:1786-1793`): nhánh `mode: "item"` thoát trước `slew`.
7. Đầu thấp của cạnh ở tay dẫn: theo hướng mặc định nhóm ở mốc đầu lần cầm.
8. `holderFace` kẹp ngẩng 45° trong G3-10.
9. Xoay cẳng tay > ±90: giữ kẹp, báo `wrist` (chờ chủ dự án).
10. Hiệu năng: nhớ theo lần cầm (G3-14) bắt buộc trước khi đo t02.
11. `check` t02 đổi số mà không sửa v1: thủ phạm hay gặp là G3-06 đổi `heldFit` mặc định; `roles` thiếu thì giữ y đường `wrap` cũ (`heldFit.ts:326`, `:374`).
