# Bàn giao G4-11 — ngón `palmBox`

## Xong
- `graspGroups.ts`: `palmBox.variants.default.roles` trỏ–áp út `tip` → `press` (cái, lòng tay `press`, út `support` giữ).
  `BOX_*` giữ nguyên. Spec docs/11 mục 3 nhóm 9 sửa vai trò.
- Test mới: `graspSolve.test.ts` (vai trò mặc định `palmBox`), `heldFitRoles.test.ts` (điện thoại hai cỡ sakura/kuroiwa ×
  hai tay: khe trỏ–áp út ≤ v1 + 0,3; lún ≤ lún vai trò `tip` + 0,1; kuroiwa ≤ `HELD_SINK`).
- Studio xanh (`g411-{typecheck,lint,format,test,build}.log`; rig 998, sketch 245, fx 44, cli 67). t02
  `check --only ref,held,clash` so `-g315`: 0 mới, 0 nặng hơn, 0 đã hết (`g411-check-t02.txt`).
- Render + bảng số: `g4-palmBox/` (`thu-dien-thoai.jpg`, `do.json`, `so-v1.md`).

## Không đạt: lún ≤ 0,65 ở sakura (1,20), và lún tăng nhẹ
- Hàng mặc định sakura lún 1,20 (không đổi), kuroiwa 0,47 → 0,50; áp tai sakura 0,60 → 0,71 (thành cảnh báo `sink`).
- Lún là gò/đốt gốc ngón cái tì vào cạnh dài phía ngón cái, do khung bàn tay (`G`) — không do vai trò ngón. Đã thử (số ở
  `so-v1.md`, công cụ `g411/do.mts`, `g411/scan.mts`, `g411/mid.mts`; chạy `node tmp/nhom-cam/g411/run.mjs <file>.mts`):
  1. Đổi vai trò ngón cái (`support`/`free`/`extend`/`wrap`): không đổi lún.
  2. Dáng gốc ngón cái (`thumbAbd` 20–100, `thumbOpp` −20–40): lún 0,9–1,4.
  3. `BOX_SHIFT`/`BOX_GAP`/`BOX_RISE`/`tilt` trong ngân sách fixture (dư ≤ 0,05 với `along` fixture, ≤ 1°): 1,13–1,22 /
     0,29–0,37. Đạt ≤ 0,65 cần dư ≥ 0,93 (vd `BOX_SHIFT` 1,4, `BOX_GAP` 3,0, `tilt` mặc định 19,5: lún 0,60 / 0,06, dư
     0,92° / 1,00) — phá test cũ `dien-thoai#doc` (0,05) và mục tiêu 0,8.
- Phần tăng 0,03–0,1: da gò ngón cái (trọng số `palm`/`thumb0`) kéo theo khi ngón giữa gập (`handMesh`, ngoài phạm vi).

## Đề xuất bước kế (cần chủ dự án chọn)
1. Ở G4-12 (chọn `thumb` × `tilt`): cảnh chọn `tilt` 25 (lún 1,4 lõi); `tilt` ≤ 10° hết lún cả hai cỡ, ngón vẫn khép
   0,1–0,3. Thêm lún vào giá chọn `tilt`, hay thu miền `tilt` về [0°, 10°] — fixture `dien-thoai#doc` (`tilt` 20) khi ấy
   chỉ còn là khung chuẩn của ứng viên đầu.
2. Hay chấp nhận lệch fixture: `BOX_SHIFT` 1,4, `BOX_GAP` 3,0, `tilt` 19,5 và nới ngưỡng hai test fixture `dien-thoai#doc`.
3. Hay coi lún gò ngón cái ở cạnh máy là da mềm (v1 `#doc` sakura cũng lún 0,8 ở ngón cái) và nới `sink` riêng cho lòng
   tay/gò ngón cái.
- Dòng docs/11 mục 9 "Để giai đoạn 4: … `palmBox` ngón `tip` hở" nay đã cũ (ngoài phạm vi sửa của job — mục 3).
