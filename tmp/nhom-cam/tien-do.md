# Tiến độ nhóm cầm

Worktree studio: `~/Work/Dev/stickman-studio-3d-nhom-cam` (nhánh `feat/nhom-cam`)
Worktree video: `~/Work/Dev/youtube-video/jp-sukatto-nhom-cam` (nhánh `auto/nhom-cam`, từ `origin/auto/t02-build`)

## Đang làm
Giai đoạn 3 — lõi. Kế hoạch job: `tmp/nhom-cam/gd3-ke-hoach.md` (21 job G3-01…G3-21, 14 đợt, mốc commit M1–M8).

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
| B0a prototype graspFrame + khuỷu E(φ), bảng số 5 ca | vòng 1 xong (fixture `bang-gia#doc` lệch 0,27°/0,07; φ một mẫu 0,38 ms; giải lựa chọn 8 ứng viên 3 ms). Vòng 2 đang chạy: rig giải trường không khai, soát khung ca 4 (`dev −134` nghi lỗi) | `tmp/nhom-cam/b0/grasp.mts`, `ca.json` |
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
| Mốc M4 (G3-11, R1, R2) | commit | |
| G3-05 khuỷu tự nhiên `graspArm.ts` | xong: ca 1, 2, chuỗi ca 5 khớp prototype; 0,24 ms/mẫu; fixture `core/__fixtures__/takumi-bang-gia.json` | `graspArm.ts` |
| G3-06 ngón theo vai trò `heldFit.ts` | xong: đường cũ y hệt trên 1 170 ca ngẫu nhiên; `skinBulge` khớp `do-a.md`; `skinDepth` | `heldFit.ts`, `heldFitRoles.test.ts` | `docs/11-nhom-cam.md` |
| T0 ảnh "trước" mọi lần cầm t02 (`cam-do`, `can-tay`) | xong: 142 lần cầm / 61 cảnh, 160 cặp (cảnh, giây); góc `cheo` dùng được, `truoc` 50/407 ô đen; `cam-do` 14 `!!` đều `but-bi#cup` (cờ cũ) | `tmp/nhom-cam/truoc/` |
| Baseline `check --scene ^t02- --only held,clash` | xong: 0 lỗi, 193 cảnh báo, 2m16 | `tmp/nhom-cam/baseline/check-held-clash.{json,txt}` |

## Đã tự quyết
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

## Cần chủ dự án
- Có nới kẹp xoay cẳng tay quá ±90 không? Ca "khoe, một tay đỡ cạnh dưới" (bước 0 ca 4, `rim`) cần −103; hiện thành cảnh báo `wrist` và bàn tay lệch chỗ cầm chút ít. Ảnh: `tmp/nhom-cam/b0/hinh/vong2/to-2.jpg`.

## Bước kế
