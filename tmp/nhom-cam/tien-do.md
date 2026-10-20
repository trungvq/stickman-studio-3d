# Tiến độ nhóm cầm

Worktree studio: `~/Work/Dev/stickman-studio-3d-nhom-cam` (nhánh `feat/nhom-cam`)
Worktree video: `~/Work/Dev/youtube-video/jp-sukatto-nhom-cam` (nhánh `auto/nhom-cam`, từ `origin/auto/t02-build`)

## Giai đoạn 3 — XONG (2026-10-20 09:30)
- Lõi chạy đủ hai đường cho `sheet` và `palmBox`: món đặt trước (`items` cấp cảnh, `graspAtTime` một nguồn nghiệm, khuỷu E(φ), hoà vào/ra lần cầm bằng nghiệm cũ đóng băng) và tay dẫn (`holdLink`); `món#kiểu` v1 chạy song song nguyên số.
- Gắn món three qua `holdLink`, `fitHolding` nhớ theo tay; đo lún trên da (`skinDepth`); luật `check` nhóm (`reach`/`wrist` lỗi, `arm`, `role`, `sink`, `grip` theo nhóm, im trong cửa sổ hoà).
- MCP `describe_held`, `scene_probe` `grasp` (cả tay dẫn); CLI ngưỡng mới; `bang-cam --nhom`; docs 01/03/04/05/07/11.
- Kiểm cuối (`g3-cuoi/`): t02 `ref` 0 lỗi; `held,clash` 0 mới/0 nặng hơn so `baseline/check-held-clash-g315.json`; s023 0 lỗi 1 cảnh báo; `thu-nhom-cam` 1 lỗi (`wrist` lúc lật bảng — để nhóm `sheet` giai đoạn 4) 4 cảnh báo ngón.
- Test studio: rig 990, sketch 245, fx 44, cli 67 — xanh; video `pnpm test` xanh.
- Ảnh duyệt: `duyet/g3-thu-nhom-cam-frames.jpg`, `duyet/g3-thu-nhom-cam-can-tay.jpg`, `duyet/g3-bang-cam-nhom-thu-{bang-gia,dien-thoai}.jpg`.
- Hình t02 không đổi ở giai đoạn 3 (chỉ đường v2 mới vẽ khác); baseline đổi vì thước da, xem "Đã tự quyết".

## Đang làm
Giai đoạn 4 — từng nhóm theo docs/11 mục 9 (palmBox → carry → sheet → cylinder → platform → card → chopsticks → pen → handle → bowl). Kế hoạch: `tmp/nhom-cam/gd4-ke-hoach.md`.
Chủ dự án (2026-10-20): KHÔNG cần review Fable nữa.

## Tóm tắt bước 0 (xong)
- Prototype `b0/grasp.mts`: graspFrame `sheet` pinch/flat/rim (khớp fixture ≤ 0,27°), `cylinder` wrap trên rod; bàn tay từ món; khuỷu E(φ); giải lựa chọn thiếu.
- Render đi đường act3 thật (`b0/hinh/ve.mjs`), hai vòng; ảnh duyệt `duyet/b0-vong2-{1,2,3}.jpg`.
- Chốt `w_down 0,3`, `w_body 10`, `w_cont 2`; thụt pinch 2,5 / flat 5 / rim 1; chi phí φ 0,38 ms/mẫu.
- Rig tự chọn `thumb: back` khi khoe (mặt ra khách), `rim` cho đỡ cạnh dưới.
- Còn cho giai đoạn 4: ngón `rim` hở 5,8–10,9; `fist` lún 1,47 trên cán r 2,5 (fixture cổ chai 0,39).
- Review Fable một vòng → `review-b0.md`; spec đã sửa đủ 14 + 6 điểm.

## Dựng worktree (xong 2026-10-20 02:10)
- Studio: `pnpm install`, `pnpm build` xanh.
- Video: `pnpm install`, `pnpm rig local ../../stickman-studio-3d-nhom-cam` → `pnpm rig` báo link; `pnpm check --scene '^t02-s023'` chạy được (0 lỗi, 1 cảnh báo `takumi.handL ↔ quay lấn 5.1`).
- File bị gitignore: symlink TỪNG FILE từ checkout chính (`assets/audio/**`, `.env`, `research/data/**`; 3578 symlink). Không symlink thư mục vì mẫu ignore có `/` nên git thấy symlink thư mục là untracked. Không có `.venv` ở checkout chính.
- 3 file cấm commit ở video: `package.json`, `pnpm-lock.yaml`, `remotion.config.ts`.
- `pnpm check --help` KHÔNG in help mà chạy check cả workspace — đọc usage ở `packages/cli/cli.mjs:27`.

## Job
| Job | Trạng thái | Đầu ra |
|---|---|---|
| B0a prototype graspFrame + khuỷu E(φ), bảng số 5 ca | xong (3 vòng) | `tmp/nhom-cam/b0/grasp.mts`, `ca.json` |
| B0b render vòng 1 | xong: `b0/hinh/vong1/to-{1,2,3}.jpg`. Đã xem: c1–c3 ổn; c4 gãy cổ tay (chỉ có `pinch`); c5 cán chọc đầu, tay trái ép ngực, khuỷu nhảy 50°/mẫu. Lún 0,89 (bảng), 1,47 (cán r 2,5) |
| B0a vòng 3 + B0b render vòng 2 | xong — chốt trọng số, kết quả ở `b0/ket-qua.md`, ảnh `b0/hinh/vong2/` |
| Review Fable spec mục 4–5 + ảnh bước 0 (T3 task `nhom-cam-b0-review-1`) | xong: 14 lỗ hổng + 6 câu chữ, nhận hết | `review-b0.md` |
| B0c sửa spec theo review | xong |
| G3-01 schema món v1+v2 | xong, xanh (thêm `!` ở 7 chỗ test cũ cho typecheck, không đổi logic) | `heldItem.ts` |
| G3-02 chỗ cầm v2, khoá lần cầm | xong, xanh | `heldItem.ts` |
| G3-10 mốc món `items` cấp cảnh, `itemAt` | xong, xanh; `sceneItemProblems` chưa nối vào `check` (để G3-16/18) | `scene.ts`, `sceneItems.test.ts` |
| G3-03 fixture test | xong: 15 GripFrame, 8 món v2 (ngưỡng trực chuẩn 2e-6 vì số làm tròn 6 chữ số; `tom-hum` không có mốc `front`) | `core/__fixtures__/` |
| G3-04 khối hình `heldGeom.ts` | xong: handDims cỡ 1 W 8,40 A 9,76 L 17,89 P 10,10 | `heldGeom.ts` |
| G3-07 bảng nhóm `graspGroups.ts` (+ luật lấp đầy slab, nối `topProblems`) | xong; `ong-nghe-ban` khớp cả `palmBox` (xem lại ở giai đoạn 4) | `graspGroups.ts` |
| Mốc M1+M2 (+G3-10): t02 `check --only ref,held,clash` so baseline: 0 mới, 0 nặng hơn | commit `89553f2` | |
| G3-08 `graspFrame` sheet + palmBox | xong: `bang-gia#doc` 0,27°/0; `dien-thoai#doc` 0,43°/0; rim `tom-hum#nhac` lệch 1,5, `bao#doc` 2,0 (thụt rim) | `graspSolve.ts` |
| G3-09 `graspAt`, giải lựa chọn, `GraspReport` | xong: ca1–ca4 khớp `ca.json` (cả φ); giải đủ thiếu 10 ms (33 ứng viên) | `graspSolve.ts`, `graspAt.test.ts` |
| Mốc M3 | commit `130b188` | |
| G3-11 nối chỗ cầm nhóm vào `scene.ts` | xong: t02 0 mới; `graspAtTime` nhớ theo runtime; `AIM_GAP` sang `constants.ts` | `scene.ts`, `holdSceneV2.test.ts` |
| Review Fable `graspSolve` + `items` (T3 task `nhom-cam-g3-review-grasp-1`) | xong: 11 lỗi, 4 lệch spec, 5 test, 3 rủi ro — nhận hết | `review-g3-grasp.md` |
| G3-R1 sửa review phần graspSolve/graspArm/graspGroups + file lá act3 | xong: `core/arm3.ts` lá (không vòng import); 19 test thêm; ca1–ca4 giữ | |
| G3-R2 sửa review phần `items` của `scene.ts` + một nguồn nghiệm (`graspAtTime` với nhân vật thật) | xong: t02 0 mới; khung ấm 0,054 ms | |
| Mốc M4 (G3-11, R1, R2) | commit `66a34cb` | |
| G3-12 act3 tay dẫn v2 + `holdLink.ts` | xong: t02 0 mới; `dien-thoai@palmBox` lòng tay 0,42°; `both` tay phụ khe 0,73; commit cùng mốc M5a | `holdLink.ts`, `holdLink.test.ts` |
| G3-13 act3 món đặt trước | xong: `actJoints` khớp graspAtTime (khuỷu 1e-13, lòng tay 1e-6°); t02 0 mới/0 nặng hơn; `thu-nhom-cam` 0 lỗi 9 cảnh báo (tay xuyên thân 25–30 ở 2,2–4,5 s và 5,6–5,9 s; φ nhảy 57,5→−167,5 khi bảng quay `holderFace`→`camera`; nhảy 140 px ở 2,50/4,50 s vì chưa hoà vào/ra lần cầm). Commit `55fd3d8` (M5) | `ReachHold.solve`, `holdPlaced.test.ts`, `actPlaced.test.ts` |
| G3-14 gắn món three qua `holdLink` | xong (chờ commit cùng G3-13b): món đặt trước ở `itemAt` ≤ 0,01; tay dẫn theo `holdLinkFrame` < 1e-6; `fitHolding` nhớ theo tay (≤ 8 mục), ms/khung 2,55→0,91 (đặt trước), 5,68→3,73 (tay dẫn); thêm `Hand.heldV` ở `human.ts` (2 dòng, ngoài phạm vi, nhận). Khung render `thu-nhom-cam` là người 2D, không có món — cảnh thử chưa phải cảnh 3D → G3-21b | `attach.ts`, `world.ts`, `holdWorldV2.test.ts`, `g314-*` |
| G3-13b hoà vào/ra lần cầm món đặt trước + chẩn đoán cảnh thử | xong: hoà `HOLD_BLEND` từ nghiệm cũ ĐÓNG BĂNG ngay trước ranh giới (`ReachHold.was`, nhả tay ra `hold: null` mang hold giả `released: true`); bước lớn nhất ≤ 0,25 tổng quãng; nhảy cóc = tuần tự (<1e-9). φ nhảy 2,0–2,5 s và tay trái xuyên thân là do cảnh soạn (bảng quay 180° mà tay giữ chỗ cầm → lệch cổ tay 142°; `offset` ngoài âm kéo tay qua người) → sửa `scenes/thu-nhom-cam.json`. `thu-nhom-cam` sạch; t02 0 mới. Commit M6a | `holdBlend.test.ts`, `g313b-*` |
| G3-21b cảnh thử vẽ 3D | xong: `src/khoi3d/thu-grip.ts` thêm `thu-nhom-cam` (sân `sanh`, `luoiMon` hai món); check 0 lỗi 5 cảnh báo (ngón hở 1,9–7,2; tay trái 2,50–2,70 tâm nắm cách món 94 — đang hoà vào lần cầm; thân lấn bảng 5,6 lúc xoay 2,09–2,16). Ảnh `duyet/g3-thu-nhom-cam-can-tay.jpg`: món trong tay, điện thoại áp tai; kẹp bảng ra nắm đấm, ngón hở (giai đoạn 4). Video commit `bfd1f34` | `g321b/` |
| G3-15 `held.ts` đo trên da | xong: kiểu cầm có `shape` đo lún/khe bằng `skinDepth`; `HeldHand.grasp`; `bang-gia@sheet` lún 0,50 (nang cũ 3,27). t02: 9 `loose` mới, đều `tom-hum#nhac` (khe 1,5–2,0; s042 8,0) — thước da lộ chỗ hở thật, hình không đổi → baseline mới `baseline/check-held-clash-g315.json` (= cũ + đúng 9 dòng ấy; 1 số đo `wrap` s041 5,58→6,34). Ngón cái `sheet` pinch hở 3,07 (giai đoạn 4) | `held.ts`, `heldSkin.test.ts`, `g315-*` |
| G3-16 luật `check` nhóm | xong: v2 (`@` trong khoá) có `pierce`, `sink` (`HELD_SINK` 0,65), `loose`, `role`, `grip` theo nhóm; món đặt trước thêm `reach`/`wrist` (lỗi khi vượt), `arm`; im trong cửa sổ hoà (`holdBlending`); dòng báo trỏ chỗ cầm ở cảnh. t02 0 mới so `-g315`. `thu-nhom-cam` 5 cảnh báo: thân↔bảng 5,6 lúc xoay (cảnh), `wrist` tay phải vượt 29° ở 2,0–2,3 (cảnh: bảng quay 90° trước khi đổi chỗ cầm lúc 2,25), ngón cái pinch hở 3,1 ×2, ngón `tip` palmBox hở 5,6–6,2 (giai đoạn 4). Còn cho G3-18: `heldRows` đọc `HeldIssue.error`, `heldOptions` thêm `sink`/`wrist`/`arm`, ngưỡng `grip` theo nhóm bỏ qua `package.json` | `heldAuditGroup.test.ts`, `g316-*` |
| G3-17 MCP | xong: `describe_held` (phần, khối hình, mốc, nhóm áp được + miền + mặc định, `unfit`/`later`), `list`/`schema(held)` v2, `scene_probe` `world.held.<tay>.grasp` (giây 1: choice, by scene/rig/default, arm φ 57,5). Thiếu: tay dẫn v2 chưa có `grasp` → G3-16b | `server.mjs`, `docs/04`, `g317/` |
| G3-18 CLI | xong: `heldRows` đọc `HeldIssue.error` (`reach`, `wrist` vượt → lỗi), `heldOptions` `sink`/`wrist`/`arm`; `held.test.mjs` 6 ca (thêm vào script test cli). t02 0 mới, 0 lỗi so `-g315`. `thu-nhom-cam` 1 lỗi (`wrist` tay phải vượt 29° 2,0–2,3 s, do cảnh) 4 cảnh báo. Thiếu: `groupHits` không đọc `o.grip` (khai nhỏ hơn ngưỡng nhóm vô tác dụng) → G3-16b | `lib.mjs`, `held.test.mjs`, `g318-*` |
| G3-19 `bang-cam --nhom` | xong: nhóm × món v2 × hàng mẫu × hai cỡ tay (sakura W 14,7, kuroiwa W 16,8), `do.json` có `sink`/`roles`/`gaps`/`grasp`/`bo`; không cờ giữ chế độ cũ, bỏ món v2. Video: chép đè `tools/bang-cam.mjs` (bản cũ đổ ở `grips`). Sheet: 44 hàng, 36 có luật báo, 0 lỗi. Ảnh `duyet/g3-bang-cam-nhom-*.jpg` | `scaffold/tools/bang-cam.mjs` |
| G3-16b báo `grasp` tay dẫn + `grip` hai chiều | xong: tay dẫn v2 có `grasp.mode: "hand"` (`by` chỉ scene/default; cổ tay đọc từ tay vẽ); `HeldOptions.gripDeclared` (khai thì thắng, hai chiều); `size` chỉ xét món đặt trước. t02 0 mới, 0 lỗi | `holdLeadGrasp.test.ts`, `g316b/` |
| G3-20 docs | xong: docs/11 (file lõi, luật `itemGeom`, `HELD_VERSION`, một nguồn nghiệm, `was`/`released`, luật `check`, con trỏ dòng → tên hàm, tên người trung tính), docs/01, 03, 04, 05, 07, README, `AGENTS.md` dòng bố cục | `docs/` |
| G3-21c/d sửa lật bảng ở cảnh thử | không nhận: c tắc (vùng chết 65–125° khi bảng giữa ngực); d đạt 0 lỗi nhưng đổi tay 3 lần trong 0,9 s và bắt chéo cẳng tay lúc khoe (ảnh `g321d/thu-nhom-cam.jpg`) → giữ cảnh đã commit (1 lỗi `wrist` 2,0–2,3 s). Bản tung hứng lưu `g321d/thu-nhom-cam.tung-hung.json` | `ban-giao-g3-21c.md` |
| G4-00 mức v1 | xong: 21 món, 60 kiểu, 206 dòng tay (lún, nắm, khe từng ngón, lòng) | `g4-chuan-v1/{muc.md,do.json}` |
| G4-X1 món thử v2 | xong: 16 `held/thu-*.json` (shape v1 hiện tại + nhãn Phụ lục A), bí danh `luoi-mon.ts`, `describe_held` khớp kế hoạch; video commit `ea27a14`. Lưu ý: `thu-tui` phần `day` là cả hộp thân dưới (v1 không có đáy riêng) — G4-92 có thể cần tách | `g4-x1/` |
| G4-52 cạnh của mặt | xong: `FaceFeature.edges` (`name`, `inward`, `at`, `len`); fixture trung tính `held-v2/khay.json`; đáy khay 4 cạnh đúng | `heldGeom.ts`, `g452-*` |
| G4-73+82 dáng `tripod`, `chopsticks` | xong: `HAND_POSES` 15 dáng, `HELD_PINCHES`; khe cái–trỏ tripod 2,96; que khớp nang không lún; t02 0 mới. Ảnh `g4-dang/` — không món thì như tay cuộn lỏng, đánh giá lại khi có món (G4-74, G4-83) | `hand.ts`, `g473-*` |
| G4-11 ngón palmBox | phần: trỏ–áp út `tip` → `press`, khe 4,9–6,5 → 0,2–0,4 (v1 0,1–0,3); út còn thõng (6,9/8,2). Lún sakura 1,20 (v1 0,8, ngưỡng 0,65) do gốc ngón cái ép cạnh gần khi `tilt` 25; tay trái áp tai lún 0,60 → 0,71. Fixture 0,43°/0,78 giữ. Quyết: G4-12 thêm lún vào giá chọn `tilt` / thu miền `tilt` (tilt ≤ 10 hết lún), không nới fixture | `g4-palmBox/`, `ban-giao-g4-11.md` |
| G4-22 carry v2 lõi | xong (chưa commit, chờ G4-12 cùng file `graspGroups.ts`): `carry` bỏ `later`, `needs` theo `seats` (`ItemGeom.seats`), `carrySpecOf`, lỗi thiếu `on`/`seats[on]`; khung treo v2 = v1 ≤ 1e-9; t02 0 mới | `heldCarry.ts`, `g422/` |
| G4-23 carry v2 three | xong (chưa commit): `attach.carry`, `heldCarries` (`hold: món@carry`), `world.ts` khoá treo theo `carrySpecOf` (đổi `on` treo lại); khớp v1 ≤ 1e-9; t02 0 mới | `holdWorldV2.test.ts`, `g423-*` |
| G4-12 palmBox tilt theo lún | xong: giá `(sink/HELD_SINK)²` đo trên da ở `chooseMissing`, lưới `tilt` 6 điểm; mặc định sakura tilt 10 lún 1,20→0, kuroiwa tilt 15 lún 0,50→0; khe trỏ–áp út 0,2–0,5. Khoe một tay vượt cổ tay mọi ứng viên (tối thiểu 13,8°/11,9°) → `check` báo `wrist` (`g4-palmBox/khoe.md`). Đọc ngang mặt: cảnh đặt máy xa (khe ≥ 6,3). Commit `ac8d513` (M4-1) | `g4-palmBox/`, `duyet/g4-palmBox-*.jpg` |
| G4-24 hàng mẫu carry + gợi ý v2 | xong: `--nhom carry` 2 hàng × 2 cỡ, 12 ô trùng từng byte với v1; `heldAudit` gợi ý tên món đúng cho v2. Commit `838b9f9` (M4-2 cùng G4-22, 23); video `07b1b71` | `g4-carry/`, `duyet/g4-carry-*.jpg` |
| G4-72 `curl` theo biến thể | xong: `HeldFitInput.curl`, `VariantSpec.curl?`, truyền qua `holdLink`/`holdRoles`/`fitHolding`; không khai thì y số cũ (1 170 ca); t02 0 mới. Còn: `frameSink` của `graspSolve.ts` chưa truyền `curl` — làm ở G4-74/83. Commit cùng tên `feat(rig): cap finger curl…` | `heldFitRoles.test.ts`, `g472-*` |
| G4-32 giá biến thể `sheet` | xong: `VARIANT_COST 0,5` + lưới quanh ứng viên rời tốt nhất của biến thể mặc định; hàng mặc định `thu-bang-gia` flat → `pinch` (cả hai cỡ), "khoe dưới–trên" vẫn `rim`; 1 test cũ đổi số đếm ứng viên (12+9 → 12+9+9). Ngón cái pinch hở 2,8/3,6 (G4-33). Ảnh `duyet/g4-sheet-mac-dinh-sakura-truoc-sau.jpg` | `g432/` |
| G4-33 `sheet` `pinch` | xong: `PoseRef.thumb`, `PINCH_THUMB [0,10,10,−20]`; tâm nắm cách mặt bốn ngón `PINCH_BACK` 0,5; thụt `max(0, 2,5 − 1,3·(t−1))` (tấm dày 1 không đổi). Khe cái 2,8/3,6 → 0,6/0,7 (v1 0,3/0,5), lún 0,50 giữ; điện thoại `pinch` lún 1,11 → ≤ 0,20; fixture < 0,3°. `thumb: back` vẫn vượt cổ tay 24,9/17,0°, nắm 6,6/5,5 (do nghiêng lòng 40° của `PINCH_PALM`; nghiêng 25° hết vượt nhưng fixture lệch 15°) → giới hạn khớp. t02 0 mới; `thu-nhom-cam` 1 lỗi 1 cảnh báo | `g433/`, `duyet/g4-sheet-pinch-truoc-sau.jpg` |
| G4-34 `sheet` `rim` | xong: thụt `max(1, 3,2 − 0,8·t)`, tâm nắm dưới mặt cái 1,9 (`RIM_TOP`), cuộn ngón theo bề dày thật chỗ ngón ôm (`thickAt`, `GraspContact.thick`); `PoseRef.tip`; dáng đóng `edge` knuckle +45 tip +65, vai trò cái/giữa `press`, trỏ `wrap`, áp út–út `support`. Fixture `tom-hum#nhac`/`bao#doc`/`bo-da#bung` 0,71/0,01/0,05, 0°. Khe trỏ 4,2–5,0 → 0–0,4; lún ≤ 0,15. Chưa đạt: út báo hở 0,5–1,8 hơn v1 ở `slant` ±22,5; khoe báo một tay kuroiwa trỏ 3,9 (cổ tay vượt 24°); đĩa tôm ngón cái nằm mặt dưới; `slant` âm ngón đảo phía. t02 0 mới | `g434/`, `duyet/g4-sheet-rim-truoc-sau.jpg` |
| G4-35 vành đĩa theo góc + cái `rim` mặt trên | xong: `disc` `edge` lưới 0–330 bước 30 (0 = `front`, tăng về `right`); tay dẫn đĩa nằm 90/270, đĩa đứng 180; `oppositeEdge` +180; `rim` không khai `thumb` chỉ thử mặt `top` (tấm nằm trong khung món) hay mặt hướng lên ≤ 45°. Sửa thêm: `edgeOk` chọn đúng `disc` khi phần ra cả `slab` lẫn `disc` (`chooseMissing`, `holdLink.fillChoice`, `scene.handChoice`). Tôm `rim` cái mặt trên, lòng 7,5 → 4,5; `flat` lún 2,4 → 0,3. t02 0 mới | `g435/`, `duyet/g4-sheet-dia-truoc-sau.jpg` |
| G4-36 hàng mẫu `sheet` | xong: nhãn `mặc định (<biến thể>)`, bỏ hàng trùng sau giải, lọc hàng không áp được (`edge`/`thumb` không có trên đĩa/tấm nằm, thiếu mốc `front`), hàng "bê hai tay hai vành", bỏ hai tay khi hai cạnh < 1,3·W (1,2·W còn chồng tay điện thoại sakura). 108 → 88 hàng, 0 ô lỗi. Commit `07ad22d`, video `9b13333` | `g436/` |
| G4-37a docs `sheet` | xong, commit `000aed4` | `docs/11` |
| G4-42 trục chung | xong: `axialAt(geom, f, along, around)` (along 0/1 hai đầu đoạn bám, ρ(0) = `front` chiếu, ρ(90) = a × ρ(0), `r` lathe theo `latheRadius`, rod hộp đo theo ρ), `ItemGeom.hasFront`, `ContactInput.around/psi/inset`. Commit `17d281a` | `heldGeom.ts` |
| G4-37b render tổng `sheet` | xong ở `17d281a`: 88 hàng; lộ ngón cái `pinch` chỉ khớp tấm dày 1 (thực đơn 1,4 lún 0,66–0,70, cái hở 1,6–2,2; báo cái 2,4), `rim` cái hở 1,2–3,6, `flat` tấm dày 3,9 lún 3,1 → G4-38 | `g4-sheet/` |
| G4-38 ngón cái theo bề dày | TẮC (dừng sau ~2 giờ, lõi trả về HEAD): ngón cái `pinch` không ép xuống được trong khung (gập ngón cái nhấc khỏi mặt `F`), `free()` gỡ lún đẩy ngón cái ra ngoài mép ở tấm dày; nang gốc ngón cái phình δ 2,7 là sàn khe; lún thực đơn 0,66–0,70 là út và lòng tay ở `slant` 30, không phải ngón cái; báo sakura hở do cổ tay vượt 32–68°. Đo bề dày thật ở mép (`spanAt`) giúp đĩa (tôm 1,41 → 0,8). Không bộ góc `PINCH_THUMB` nào giữ khe ≤ 0,8 mọi `slant` khi tấm ≥ 2 | `ban-giao-g4-38.md`, `g438/thu/` (công cụ đo nhanh 45 s, đầu dò) |
| G4-38b bề dày thật ở mép | xong: `spanAt`/`edgeThick`/`tooThick` (`graspGroups.ts`, cùng `SHEET_INSET`); `pinch`/`flat` dùng bề dày thật dọc `F` ở mép cho thụt, tâm nắm, dáng (tấm một khối y số cũ); `VariantSpec.thickMax`, `FLAT_MAX = 0,24·W` (khe đệm cái–lòng ở dáng `edge`); `chooseMissing` bỏ `flat` khi mép dày quá, cảnh khai thì `checkChoice` (nhận thêm `shape`) báo `choice`. Tôm `pinch` cái 1,41/1,55 → 0,82/1,02; bò 1,63/1,74 → 1,08/1,31; tôm `flat` kuroiwa lún 0,84 → 0,34; bò `flat` lún 3,1 → không vẽ (lỗi `choice`). Bảng giá, thực đơn, điện thoại y nguyên. t02 0 mới | `g438b/`, `duyet/g4-sheet-be-day-mep-truoc-sau.jpg` |
| G4-43 `cylinder` `wrap` | xong: `CONTACTS.cylinder.wrap` (`nt`): điểm trục `axialAt`, ρ(around), rod hộp bám mặt gần nhất; lòng nghiêng `WRAP_GAIN` 1,6 × dốc mặt (±`WRAP_HALF` 0,3·W, tối đa 45°); tâm nắm dời ra tới da lòng (`palmSkin`) cách món `WRAP_GAP` 0,7; bỏ `later`; miền `part`, `thumb` up/down, `along` 3, `around` 12. Fixture `chai-dia#co` 1,7°/0,72 (sakura), 3,2°/0,89 (kuroiwa). Ảnh: lòng áp thân, bốn ngón quấn; ngón cái không quấn ngược mà lún 2,2–5,4 (chai đặc tuyến xuyên, ống nghe lún 3) → G4-44. t02 0 mới | `g443/`, `duyet/g4-cylinder-wrap.jpg` |
| G4-44 `cylinder` dáng theo bán kính | xong: dáng hoà theo r tại chỗ cầm (không `rMax`), `PoseSpec.thumb` bảng góc ngón cái theo bán kính (trụ mảnh: cái dọc trục chồng trỏ–giữa; trụ to: dọc thân hướng lên; chuyển 0,36–0,42·W), `WRAP_OPEN`/`WRAP_CLOSED` mở rồi `heldFit` khép; cái lấy r nhỏ hơn giữa chỗ cầm và 0,5·W về phía cái (`WRAP_THUMB_AHEAD`). Chai dĩa lún 2,45 → 0,14; chai đặc tuyến 4,5–5,4 → 0,07–0,10 (hết xuyên); cán r 2,5 lún 0,30/0,41. Fixture `chai-dia#co` 0,64/0,63. Không theo rủi ro 8 (`fist` + knuckle lún 0,7–0,9). Ống nghe còn lún 3,4–3,9 vào khối loa (`grip: false`) ở `around 0` → G4-45/47 | `g444/`, `duyet/g4-cylinder-cai-truoc-sau.jpg` |
| G4-46 trượt dọc thanh | xong (chỉ test): `along` 0,25 → 0,75 trên `ong-nghe-ban`, 30 fps: φ ≤ 2,5°/mẫu, khuỷu vẽ 2,9°, lòng 4,0°, cổ tay 1,2 px, món 0,15 px; `scene.ts` không đổi | `holdPlaced.test.ts`, `g446/` |
| G3-21 cảnh thử ở repo video (soạn sớm) | dữ liệu xong, commit video; `check` 0 lỗi, 5 cảnh báo do `cli/lib.mjs` ~:2257 còn gọi `heldGrip` (G3-18 sửa) | `scenes/thu-nhom-cam.json` |
| G3-05 khuỷu tự nhiên `graspArm.ts` | xong: ca 1, 2, chuỗi ca 5 khớp prototype; 0,24 ms/mẫu; fixture `core/__fixtures__/takumi-bang-gia.json` | `graspArm.ts` |
| G3-06 ngón theo vai trò `heldFit.ts` | xong: đường cũ y hệt trên 1 170 ca ngẫu nhiên; `skinBulge` khớp `do-a.md`; `skinDepth` | `heldFit.ts`, `heldFitRoles.test.ts` | `docs/11-nhom-cam.md` |
| T0 ảnh "trước" mọi lần cầm t02 (`cam-do`, `can-tay`) | xong: 142 lần cầm / 61 cảnh, 160 cặp (cảnh, giây); góc `cheo` dùng được, `truoc` 50/407 ô đen; `cam-do` 14 `!!` đều `but-bi#cup` (cờ cũ) | `tmp/nhom-cam/truoc/` |
| Baseline `check --scene ^t02- --only held,clash` | xong: 0 lỗi, 193 cảnh báo, 2m16 | `tmp/nhom-cam/baseline/check-held-clash.{json,txt}` |

## Đã tự quyết
- G4-11: lún `palmBox` vượt v1 xử lý ở chọn `tilt` (G4-12: lún da vào giá ứng viên, hay miền `tilt` 0–10), KHÔNG dời khỏi fixture `dien-thoai#doc` hay nới ngưỡng `sink`.
- Giai đoạn 4 (mặc định của `gd4-ke-hoach.md` mục 4, nhận hết): giá riêng cho biến thể `sheet` ≠ mặc định 0,5; `palmBox` trỏ–áp út `tip` → `press` (sửa spec mục 3); mọi ứng viên vượt cổ tay thì coi là giới hạn khớp, `check` báo; lật tấm 180° khi cầm giữ `mixRotation`, coi là giới hạn khớp (lỗi `wrist` ở `thu-nhom-cam` 2,0–2,3 s giữ); `around = 0` trên trụ = hướng `front` chiếu lên mặt phẳng vuông trục; `platform` đỡ mặt chúc xuống nhất ở đầu lần cầm (tay dẫn: gần `−top`), lưới `psi` 5 điểm bước 45°; `touch` khoác vai do cảnh khai, không để trên món; thanh mảnh < 0,2·W dùng `fist` + cuộn thêm; `bang-cam` bỏ hàng hai tay khi hai cạnh cách < 1,2·W; thêm `tripod`, `chopsticks` vào `HELD_PINCHES`.
- Gộp mọi job "Món thử" (G4-21/31/41/51/61/71/81/91/A1) thành một job G4-X1 vì cùng sửa `luoi-mon.ts`.
- Từ G3-15, `check` t02 so baseline `tmp/nhom-cam/baseline/check-held-clash-g315.json` (baseline cũ + 9 `loose` của `tom-hum#nhac`). Lý do: thước da (spec mục 7) đúng hơn nang; nang phình che chỗ hở thật (lòng tay cách 5, s042 cách 15); hình vẽ không đổi. Sửa ở giai đoạn 4 (nhóm `sheet` `rim`/`lathe` của tôm) hay giai đoạn 6 (chuyển `tom-hum` sang v2), không vá `held/tom-hum.json` v1.
- Nghiệm cũ khi đổi lần cầm mang ở trường mới `ReachHold.was` (đóng băng ngay trước ranh giới), không ở `from` như spec viết: chạy tiếp chuỗi φ cũ qua ranh giới thì nhảy nhánh (24–31 px). G3-20 ghi `was`/`released` vào spec mục 5 "Đổi lần cầm".
- `w_cont` ở mẫu đầu lần cầm vẫn so φ cuối của lần cầm trước (theo spec) dù φ ấy là tư thế bất khả — có thể kéo rig chọn sai `thumb`. Giữ theo spec; xem lại ở giai đoạn 4 nếu gặp ở cảnh thật.
- `human.ts` thêm `Hand.heldV` (G3-14, ngoài phạm vi job) — nhận: tay 3D cần dáng v2 đã hoà + fit, không thì tính da hai lần mỗi khung.
- `edgeHigh` cạnh gần ngang: so độ chạy ngang thân với trước–sau (chia 45°), trước–sau thì đầu thấp là đầu gần người cầm.
- Tay dẫn `sheet` không khai `edge`: tấm đứng `bottom`; tấm nằm cạnh về phía tay ấy.
- `tilt` của `palmBox` lưới 2 điểm = hai đầu miền (0°, 25°); nghiệm rời tốt nhất vẫn giữ mặc định 20° làm ứng viên đầu.
- Mặt người cầm cho `thumb` mặc định (tay dẫn) lấy tâm đầu.
- Thụt `rim` giữ 1 (theo spec); fixture `tom-hum#nhac` (tâm nắm cao hơn giữa bề dày 1,5) và `bao#doc` (thụt 3) lệch vị trí → chỉnh ở giai đoạn 4 nhóm `sheet` theo ảnh.
- Fixture test của rig không mang tên nhân vật/cảnh của tập: `takumi-bang-gia.json` → `nguoi-cam-bang.json` (biên giới AGENTS.md).
- `SCENE_VERSION` không nâng ở giai đoạn 3–5; nâng cùng bản 8.0.0 ở giai đoạn 6 (cảnh chuyển sang `hold` v2).
- `holderFace` kẹp ngẩng 45° và lấy hướng ngang về tâm sọ (không về mắt) — mắt takumi nằm trước bảng nên hướng về mắt làm bảng quay ra ngoài.
- `itemGeom`: một `lathe` cho mỗi phần chỉ khi mọi trụ của phần đồng trục; trụ thành `rod` cần `2r ≤ 0,5·dài` (như hộp); `slab` từ bao nhiều khối cần lấp đầy ≥ 0,5 (đũa không ra `slab`). Cần ghi vào spec mục 2 ở G3-20.
- Mốc món `items` đặt ở CẤP CẢNH (cạnh `cast`), mỗi mốc có `cast`; `hands` vẫn ở `cast[].world.hands` (schema hiện có). Spec mục 4 đã ghi.
- Giai đoạn 3–5 chạy song song đường cũ: `HeldItemSchema` nhận v1 (`grips`) và v2, `SceneHoldSchema` nhận `món#kiểu` và `món@nhóm`/`{group}`; test cũ phải xanh nguyên. Giai đoạn 6 mới xoá v1.
- Dời sang giai đoạn 4: dáng `tripod`/`chopsticks` (`hand.ts`). Dời sang giai đoạn 6: `migrate-held`, món mẫu `coc`/`tui` v2.
- Xoay cẳng tay vượt ±90 (ca đỡ đáy tấm cần −103): GIỮ kẹp hiện có của rig (±90, ±`AIM_BEND`, ±`AIM_DEV`); nghiệm vượt vẽ theo kẹp, khuỷu giữ φ, `check` báo `wrist`.
- Bước 0 dừng ở vòng 2 (không cần vòng 3): khuỷu, cổ tay ổn ở ca 1, 2, 3, 5; ca 4 còn vượt xoay cẳng tay (thành cảnh báo `wrist` theo spec) và ngón hở — việc của dáng ngón giai đoạn 4. Chốt `w_down 0,3`, `w_body 10`, `w_cont 2`.
- Bước 0 vòng 2: `w_cont` 0,2 → 2 (khuỷu nhảy 50°/mẫu ở ca 5). Ca 5 đặt cán chéo trước người kiểu cầm chổi thay vì đứng sát vai (ví dụ cuốc của spec chọc vào đầu chibi). Ca 1 nâng bảng lên giữa ngực, ca 2 đẩy bảng xa mặt ≥ 8 — chỗ đặt món là việc của cảnh, không đổi bộ giải.
- Ca 1 bước 0: `holderFace` từ ngực+30 lên mắt ngẩng 84° (đầu chibi to) → bảng gần ngửa, trục suy biến. Khai thẳng hướng hệ thân `[−1,−1,0]` (lùi, lên 45°). Ghi vào review spec: `holderFace` cần định nghĩa lại hay giới hạn góc ngẩng.
- `d` của `sheet` viết `c·W`, `c = 0,1553` (khớp `bang-gia#doc` ở cỡ takumi, W 16,1).
- Giới hạn xoay cẳng tay 90° lấy theo kẹp trong `aimWrist` (lõi chưa export hằng số).
- Ảnh "trước" (673 MB, `tmp/nhom-cam/truoc/can-tay/`) không commit; chỉ commit `lan-cam.{json,md}`, `cam-do.txt`. Phiên khác mất ảnh thì chụp lại từ commit `c925657` của rig.

- G4-33: `pinch` ngón cái mặt sau (`thumb: back`) vượt cổ tay 17–25° là giới hạn khớp (cùng luật "mọi ứng viên vượt"); giữ fixture `bang-gia#doc` ≤ 0,3°, không giảm nghiêng lòng `PINCH_PALM`. `check` báo `wrist`; điện thoại cái sau sakura lún 1,22 đi kèm.

- G4-34: `rim` giữ miền `slant` cả âm (thu [0,45] làm khoe báo vượt cổ tay 19–65°); ngón cái nằm dẹt (dáng `key`) không thêm ở giai đoạn 4.

- G4-36: ngưỡng bỏ hàng hai tay 1,3·W (thay mặc định 1,2·W của kế hoạch) vì điện thoại sakura 18,45 ≥ 17,6 vẫn chồng tay.
- G4-35: luật ngón cái mặt trên chỉ cho `rim`; `pinch` mặc định trên đĩa đứng giữ cái mặt sau (đĩa ở cảnh khai `rim`, Phụ lục A). Phần `dia` ra cả `slab` lẫn `disc` giữ nguyên, xem lại ở giai đoạn 5 (`held-moc`).

- Chủ dự án (2026-10-20): món mỏng hở/lún chút không sao nếu không lộ. Đích job cầm đồ theo mức lộ: khe ngón cái ≲ 0,15·W, lún không xuyên món, mở ảnh kiểm; không viết lại `heldFit` để gỡ vài phần mười. G4-38b chỉ: bề dày thật ở mép cho `pinch`/`flat` (`spanAt`), `flat` không áp được trên tấm quá dày.

## Cần chủ dự án
- Có nới kẹp xoay cẳng tay quá ±90 không? Ca "khoe, một tay đỡ cạnh dưới" (bước 0 ca 4, `rim`) cần −103; hiện thành cảnh báo `wrist` và bàn tay lệch chỗ cầm chút ít. Ảnh: `tmp/nhom-cam/b0/hinh/vong2/to-2.jpg`.

## Việc dồn cho giai đoạn 4 (từ ảnh/số giai đoạn 3)
- `sheet` mặc định: rig chọn `flat` (lòng tay úp lên mép trên tấm) thay vì `pinch` mặc định nhóm — trông không như người đọc bảng; xem lại giá chọn biến thể.
- `rim`: bàn tay lơ lửng, giữa/áp út/út hở 5,5–12,4 (cả khoe một tay, khoe hai tay trên dưới).
- `pinch`: ngón cái hở 2,5–3,6; `pinch` cái sau cổ tay vượt 17–25°, nắm 5,5–6,6.
- `palmBox`: ngón `tip` hở 4,9–6,2; khoe một tay cổ tay vượt 36° (sakura); điện thoại `pinch` lún 1,1–1,3, cái sau xuyên +0,9.
- Khoe hai tay hai bên với điện thoại: hai bàn tay chồng nhau.
- Lật tấm 180° khi đang cầm (cảnh thử 2,0–2,3 s, lỗi `wrist`): cần đường hoà `path` quanh `m` / trượt tay theo cạnh; vùng chết 65–125° khi tấm giữa ngực (`ban-giao-g3-21c.md`, công cụ dò `g321d/tools/`).
- Đổi `thumb` của tấm (lệch nửa vòng) chưa hoà theo `path` quanh `m` (spec cũ); `mixRotation` quay quanh trục cố định — làm ở nhóm `sheet`, cập nhật docs/11 mục 5 khi xong.
- `holdBlending` chỉ làm im `grip`/`loose`/`role`; `pierce`/`sink` trong cửa sổ hoà vẫn đo — xem lại nếu gặp báo giả ở cảnh thật.
- Món vẽ ở `bang-cam` nhỏ hơn hình bộ giải dùng (điện thoại ×0,9): lõi đo lún 1,22 thì `check` đo 0,71 — kiểm lại khớp lưới món ↔ `shape` ở giai đoạn 5 (`held/` v2, `held-moc`).
- Tay dẫn `palmBox` áp tai lấy `tilt` mặc định 20 → lún 0,71 (ngưỡng 0,65). Xem lại mặc định khi chuyển cảnh.
- `bang-cam`: hàng `biến thể flat` trùng `mặc định` khi rig chọn `flat`.
- `bang-cam`: hàng `checkChoice` báo lỗi (bò `flat` quá dày) còn vẽ ô LỖI xám, chữ chồng — lọc như hàng không áp được ở job `bang-cam` kế (G4-47).
- `FLAT_MAX` lấy theo tay nhỏ (0,24·W); `checkHolds` kiểm bằng tay mẫu W ≈ 14,7 nên cảnh khai `flat` trên tấm 3,5–4 báo cho mọi cỡ tay.
- `cylinder` chai dĩa: ngón cái dọc thân hướng lên, nhìn trước như "giơ ngón cái" cạnh chai. Vùng chuyển dáng cái 0,36–0,42·W lòng tay nhấc 1,3–2,2 (vai chai). Cán r 2,5 bốn ngón chưa khép qua đỉnh thanh (thanh sát gốc ngón; dời chỗ cầm vỡ fixture).
- Trượt dọc thanh: φ theo lưới 2,5° dao nấc (lòng 2–4°/mẫu), cổ tay nhảy 0,8 px ở `along` 0,58.
- Hàng "bê hai vành" đĩa: ngón cái hơi dựng, hở 1,6–2,9.
- `rim` `slant` âm: ngón nghiêng về mặt cái, tấm kẹp giữa trỏ và giữa (khoe báo). Út hở hơn v1 0,5–1,8 ở `slant` ±22,5.

## Bước kế
0. Phiên tiếp tục (2026-10-20) sau khi chủ dự án chốt hướng G4-38b. Worktree sạch, mọi việc xanh đã commit và push. Studio xem `git log`, video `9b13333`.
1. Nhóm `sheet` xong (M4-3). Cylinder: 42, 43, 44, 46 xong → 45 (biên `grip: false`, ống nghe lún vào loa) → 47 → 48.
3. Rồi cylinder 43–48 (42 xong), platform 53–57, card 62–64, chopsticks 74–76 (nhớ `frameSink` truyền `curl`), pen 83–85, handle 92–95, bowl A2–A4, Z1, Z2 theo `gd4-ke-hoach.md`. Đã xong/gộp: 00, X1, 11–14, 22–25, 32–37, 42, 52, 72, 73, 82.
4. Giai đoạn 5 → 6.
