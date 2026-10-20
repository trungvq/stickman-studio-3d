# G4-33 — `sheet` `pinch`: so trước (G4-32) / sau / v1

Nguồn: `pnpm bang-cam --nhom sheet --mon thu-bang-gia,thu-dien-thoai` ở video, giây 0,5. Trước = commit studio `f2a0df6`
(`truoc/do.json`, trùng `g432/do.json` ở `thu-bang-gia`); sau = `do.json` ở thư mục này. v1 = `g4-chuan-v1/muc.md`
(`bang-gia#doc`; điện thoại không có kiểu v1 kẹp mép). Khe âm là da lún. Chỉ hàng rig giải ra `pinch`.

## Đổi ở lõi

- `graspGroups.ts`: `PoseRef.thumb` (góc ngón cái thay cho dáng); `sheet.variants.pinch` dùng `PINCH_THUMB = [0, 10, 10, -20]`
  (khép theo trỏ, ngọn duỗi ngược) ở cả dáng mở và đóng. Vai trò giữ nguyên (cái `press`).
- `graspSolve.ts`: `poseVec` đọc `thumb`; khung `pinch` neo tâm nắm cách mặt bốn ngón `PINCH_BACK = 0,5` (thay vì giữa bề
  dày) và thụt `max(0, 2,5 − PINCH_OUT·(t − 1))`, `PINCH_OUT = 1,3`. Tấm dày 1 (fixture) không đổi gì; `PINCH_PALM`,
  `SHEET_INSET.pinch` giữ.
- Fixture `bang-gia#doc`: vẫn dư < 0,3° / < 0,1 (test xanh).
- Test mới (`graspSolve.test.ts`, "`sheet` `pinch` trên da"): bảng — khe cái ≤ 0,8, lún ≤ 0,6 ở hai cỡ tay, hai tay,
  `slant` −30/0/30; điện thoại lún < `HELD_SINK` hai đầu cao, hai mặt ngón cái; tâm nắm theo bề dày.

## Vì sao ngón cái hở 2,8–3,6

Không phải khung: ở khung fixture, dáng `sheet` để đầu ngón cái cách mặt trước ~0,8. `heldFit` theo vai trò nhắm trên nang
phình `skinBulge`; đốt gốc ngón cái phình ~2,7 (da kẽ cái–trỏ), nên nang ấy "lún" vào mép và `free(0)` gập ngón cái ra xa
15–28° (gập ngón cái ở khung này đi ra xa tấm). Dáng mới đặt đốt gốc xa mép, chỉ đầu ngón chạm; khe còn lại 0,6–0,7 là
sàn của nang phình này (thấp hơn phải sửa `skinBulge`/`heldFit`, ngoài phạm vi).

## Bảng

| Món | Hàng | Người | Tay | | Chỗ cầm | Lún | Cái | Trỏ | Giữa | Áp út | Út | Lòng | Nắm | Cổ tay vượt | Luật |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| thu-bang-gia | mặc định | t01-sakura | R | trước | pinch/front/right/30 | 0.49 | 2.8 | 0.1 | -0.0 | -0.4 | -0.5 | 5.8 | -0.5 | 0.0 | wrist,role |
| thu-bang-gia | mặc định | t01-sakura | R | sau | pinch/front/right/30 | 0.49 | 0.6 | 0.1 | -0.0 | -0.4 | -0.5 | 5.8 | -0.5 | 0.0 | wrist |
| | | | | v1 `bang-gia#doc` | fixture | 0.50 | 0.3 | -0.1 | 0.0 | -0.4 | -0.5 | 6.3 | -0.5 | 0 | — |
| thu-bang-gia | pinch · cái trước | t01-sakura | R | trước | pinch/front/right/30 | 0.49 | 2.8 | 0.1 | 0.0 | -0.3 | -0.5 | 5.7 | -0.5 | 1.5 | wrist,role |
| thu-bang-gia | pinch · cái trước | t01-sakura | R | sau | pinch/front/right/30 | 0.49 | 0.6 | 0.1 | 0.0 | -0.3 | -0.5 | 5.7 | -0.5 | 1.5 | wrist |
| | | | | v1 `bang-gia#doc` | fixture | 0.50 | 0.3 | -0.1 | 0.0 | -0.4 | -0.5 | 6.3 | -0.5 | 0 | — |
| thu-bang-gia | pinch · cái sau | t01-sakura | R | trước | pinch/back/right/30 | 0.50 | 2.5 | -0.5 | -0.3 | 0.1 | 2.6 | 10.1 | 6.6 | 24.9 | wrist,grip,role |
| thu-bang-gia | pinch · cái sau | t01-sakura | R | sau | pinch/back/right/30 | 0.50 | 1.8 | -0.5 | -0.3 | 0.1 | 2.6 | 10.1 | 6.6 | 24.9 | wrist,grip,role |
| thu-bang-gia | đọc ngang mặt | t01-sakura | R | trước | pinch/front/bottom/0 | 0.00 | 3.1 | 0.1 | -0.0 | 0.4 | 0.3 | 7.2 | -0.5 | 0.0 | role |
| thu-bang-gia | đọc ngang mặt | t01-sakura | R | sau | pinch/front/bottom/0 | 0.00 | 0.6 | 0.1 | -0.0 | 0.4 | 0.3 | 7.2 | -0.5 | 0.0 | — |
| thu-bang-gia | khoe hai tay hai bên | t01-sakura | R | trước | pinch/back/left/0 | 0.00 | 3.1 | 0.1 | -0.0 | 0.4 | 0.3 | 7.3 | -0.5 | 0.0 | role |
| thu-bang-gia | khoe hai tay hai bên | t01-sakura | R | sau | pinch/back/left/0 | 0.00 | 0.6 | 0.1 | -0.0 | 0.4 | 0.3 | 7.3 | -0.5 | 0.0 | — |
| thu-bang-gia | khoe hai tay hai bên | t01-sakura | L | trước | pinch/back/right/0 | 0.00 | 3.1 | 0.1 | -0.0 | 0.4 | 0.3 | 7.3 | -0.5 | 0.0 | role |
| thu-bang-gia | khoe hai tay hai bên | t01-sakura | L | sau | pinch/back/right/0 | 0.00 | 0.6 | 0.1 | -0.0 | 0.4 | 0.3 | 7.3 | -0.5 | 0.0 | — |
| thu-bang-gia | mặc định | kuroiwa | R | trước | pinch/front/right/30 | 0.49 | 3.6 | 0.3 | -0.1 | -0.1 | -0.5 | 7.1 | -0.5 | 0.0 | role |
| thu-bang-gia | mặc định | kuroiwa | R | sau | pinch/front/right/30 | 0.49 | 0.7 | 0.3 | -0.1 | -0.1 | -0.5 | 7.1 | -0.5 | 0.0 | — |
| | | | | v1 `bang-gia#doc` | fixture | 0.50 | 0.5 | -0.1 | 0.0 | -0.4 | -0.5 | 7.8 | -0.5 | 0 | — |
| thu-bang-gia | pinch · cái trước | kuroiwa | R | trước | pinch/front/right/30 | 0.50 | 3.6 | 0.3 | -0.1 | -0.1 | -0.5 | 7.1 | -0.5 | 0.0 | wrist,role |
| thu-bang-gia | pinch · cái trước | kuroiwa | R | sau | pinch/front/right/30 | 0.50 | 0.7 | 0.3 | -0.1 | -0.1 | -0.5 | 7.1 | -0.5 | 0.0 | wrist |
| | | | | v1 `bang-gia#doc` | fixture | 0.50 | 0.5 | -0.1 | 0.0 | -0.4 | -0.5 | 7.8 | -0.5 | 0 | — |
| thu-bang-gia | pinch · cái sau | kuroiwa | R | trước | pinch/back/right/30 | 0.48 | 2.6 | -0.5 | -0.5 | 0.1 | 2.1 | 11.1 | 5.5 | 17.0 | wrist,grip,role |
| thu-bang-gia | pinch · cái sau | kuroiwa | R | sau | pinch/back/right/30 | 0.48 | 0.7 | -0.5 | -0.5 | 0.1 | 2.1 | 11.1 | 5.5 | 17.0 | wrist,grip,role |
| thu-bang-gia | đọc ngang mặt | kuroiwa | R | trước | pinch/front/bottom/-30 | 0.50 | 3.6 | 0.3 | -0.1 | -0.1 | -0.5 | 7.1 | -0.5 | 0.0 | role |
| thu-bang-gia | đọc ngang mặt | kuroiwa | R | sau | pinch/front/bottom/-30 | 0.50 | 0.7 | 0.3 | -0.1 | -0.1 | -0.5 | 7.1 | -0.5 | 0.0 | — |
| thu-bang-gia | khoe hai tay hai bên | kuroiwa | R | trước | pinch/back/left/0 | 0.06 | 3.6 | 0.4 | -0.1 | 0.2 | 0.5 | 8.9 | -0.5 | 0.0 | role |
| thu-bang-gia | khoe hai tay hai bên | kuroiwa | R | sau | pinch/back/left/0 | 0.06 | 0.7 | 0.4 | -0.1 | 0.2 | 0.5 | 8.9 | -0.5 | 0.0 | — |
| thu-bang-gia | khoe hai tay hai bên | kuroiwa | L | trước | pinch/back/right/0 | 0.06 | 3.6 | 0.4 | -0.1 | 0.2 | 0.5 | 8.9 | -0.5 | 0.0 | role |
| thu-bang-gia | khoe hai tay hai bên | kuroiwa | L | sau | pinch/back/right/0 | 0.06 | 0.7 | 0.4 | -0.1 | 0.2 | 0.5 | 8.9 | -0.5 | 0.0 | — |
| thu-dien-thoai | mặc định | t01-sakura | R | trước | pinch/front/right/30 | 0.61 | 0.6 | 0.2 | -0.1 | -0.5 | 0.5 | 5.0 | -1.3 | 0.0 | — |
| thu-dien-thoai | mặc định | t01-sakura | R | sau | pinch/front/right/30 | 0.00 | 0.5 | 0.1 | 0.1 | 0.2 | 0.2 | 6.3 | 0.9 | 0.0 | wrist |
| thu-dien-thoai | pinch · cái trước | t01-sakura | R | trước | pinch/front/right/30 | 1.07 | 0.6 | 0.2 | -0.1 | -1.1 | -0.9 | 5.0 | -1.3 | 0.0 | wrist,sink |
| thu-dien-thoai | pinch · cái trước | t01-sakura | R | sau | pinch/front/right/30 | 0.00 | 0.5 | 0.1 | 0.1 | 0.2 | 0.3 | 6.3 | 0.9 | 0.0 | wrist |
| thu-dien-thoai | pinch · cái sau | t01-sakura | R | trước | pinch/back/right/30 | 1.29 | 2.0 | -1.3 | -1.2 | 0.4 | 1.5 | 8.2 | 3.0 | 14.5 | wrist,pierce,sink,role |
| thu-dien-thoai | pinch · cái sau | t01-sakura | R | sau | pinch/back/right/30 | 1.22 | 1.5 | -1.2 | -0.1 | 0.3 | 2.9 | 9.3 | 2.1 | 15.0 | wrist,sink,role |
| thu-dien-thoai | đọc ngang mặt | t01-sakura | R | trước | pinch/front/bottom/0 | 0.00 | 2.9 | 0.2 | 0.3 | 0.5 | 0.0 | 6.6 | -0.6 | 0.0 | role |
| thu-dien-thoai | đọc ngang mặt | t01-sakura | R | sau | pinch/front/bottom/0 | 0.01 | -0.0 | 0.2 | 0.1 | 0.1 | 0.2 | 8.3 | 1.8 | 0.0 | — |
| thu-dien-thoai | khoe hai tay hai bên | t01-sakura | R | trước | pinch/back/left/0 | 0.06 | 3.1 | 0.3 | 0.4 | 0.5 | -0.1 | 6.7 | -1.3 | 0.0 | role |
| thu-dien-thoai | khoe hai tay hai bên | t01-sakura | R | sau | pinch/back/left/0 | 0.00 | 0.3 | 0.1 | 0.1 | 0.2 | 0.2 | 8.4 | 0.9 | 0.0 | — |
| thu-dien-thoai | khoe hai tay hai bên | t01-sakura | L | trước | pinch/back/right/0 | 0.06 | 3.1 | 0.3 | 0.4 | 0.5 | -0.1 | 6.7 | -1.3 | 0.0 | role |
| thu-dien-thoai | khoe hai tay hai bên | t01-sakura | L | sau | pinch/back/right/0 | 0.00 | 0.3 | 0.1 | 0.1 | 0.2 | 0.2 | 8.4 | 0.9 | 0.0 | — |
| thu-dien-thoai | mặc định | kuroiwa | R | trước | flat/back/right/0 | 0.00 | 0.9 | 2.3 | 1.9 | 1.2 | 1.6 | 4.6 | -1.3 | 0.0 | — |
| thu-dien-thoai | mặc định | kuroiwa | R | sau | pinch/front/right/30 | 0.00 | 0.5 | 0.3 | 0.2 | 0.0 | -0.0 | 7.7 | 0.9 | 0.0 | — |
| thu-dien-thoai | pinch · cái trước | kuroiwa | R | trước | pinch/front/right/30 | 1.11 | 0.9 | 0.6 | 0.2 | -0.8 | -0.3 | 6.4 | -1.3 | 0.0 | sink |
| thu-dien-thoai | pinch · cái trước | kuroiwa | R | sau | pinch/front/right/30 | 0.00 | 0.5 | 0.3 | 0.2 | 0.0 | 0.5 | 7.7 | 0.9 | 0.0 | — |
| thu-dien-thoai | pinch · cái sau | kuroiwa | R | trước | pinch/back/right/30 | 1.24 | 2.8 | -1.2 | -0.3 | 0.0 | 0.8 | 9.1 | 1.2 | 7.3 | wrist,sink,role |
| thu-dien-thoai | pinch · cái sau | kuroiwa | R | sau | pinch/back/right/30 | 0.00 | 0.9 | 0.1 | 0.3 | 0.2 | 1.9 | 10.6 | 0.6 | 8.1 | wrist,role |
| thu-dien-thoai | đọc ngang mặt | kuroiwa | R | trước | pinch/front/bottom/-30 | 0.82 | 0.6 | 0.5 | 0.3 | -0.6 | -0.8 | 6.4 | -0.6 | 0.0 | sink |
| thu-dien-thoai | đọc ngang mặt | kuroiwa | R | sau | pinch/front/bottom/-30 | 0.00 | 0.7 | 0.0 | 0.2 | 0.0 | 0.6 | 7.7 | 1.8 | 0.0 | — |
| thu-dien-thoai | khoe hai tay hai bên | kuroiwa | R | trước | pinch/back/left/0 | 0.00 | 3.5 | 0.6 | 0.3 | 0.5 | 0.8 | 8.3 | -1.3 | 0.0 | role |
| thu-dien-thoai | khoe hai tay hai bên | kuroiwa | R | sau | pinch/back/left/0 | 0.00 | 0.8 | 0.3 | 0.2 | 0.0 | 0.9 | 10.0 | 0.9 | 0.0 | — |
| thu-dien-thoai | khoe hai tay hai bên | kuroiwa | L | trước | pinch/back/right/0 | 0.00 | 3.5 | 0.6 | 0.3 | 0.5 | 0.8 | 8.3 | -1.3 | 0.0 | role |
| thu-dien-thoai | khoe hai tay hai bên | kuroiwa | L | sau | pinch/back/right/0 | 0.00 | 0.8 | 0.3 | 0.2 | 0.0 | 0.9 | 10.0 | 0.9 | 0.0 | — |

## Tóm tắt theo đầu ra

| Đầu ra | Trước | Sau | Mức | Đạt |
|---|---|---|---|---|
| `thu-bang-gia` pinch, khe cái (mọi hàng `pinch` cái trước, hai cỡ, hai tay) | 2,8–3,6 | 0,6 (sakura) / 0,7 (kuroiwa) | ≤ 0,8 | có |
| `thu-bang-gia` pinch, lún | 0,49–0,50 | 0,49–0,50 | ≤ 0,6 | có |
| `thumb: back` cổ tay vượt | 24,9 / 17,0 | 24,9 / 17,0 | giảm rõ | **không** |
| `thumb: back` nắm | 6,6 / 5,5 | 6,6 / 5,5 | ≤ 5 | **không** |
| `thu-dien-thoai` pinch, lún (cái trước, mặc định, đọc ngang, khoe) | 0,00–1,11 | 0,00–0,20 | ≤ 0,65 | có |
| `thu-dien-thoai` pinch cái sau, lún | 1,29 / 1,24 | 1,22 / 0,00 | ≤ 0,65 | sakura không (cổ tay vượt 15°, tay vẽ lệch chỗ cầm) |
| Fixture `bang-gia#doc` | < 0,3° | < 0,3° | ≤ 0,3° | có |

## `thumb: back` — mâu thuẫn với fixture

Cổ tay vượt do khung: lòng tay nghiêng 40° khỏi mặt tấm (`PINCH_PALM`), đổi `thumb` là quay π quanh `m` nên khi ngón cái ở
mặt sau thì cổ tay nằm bên kia mặt phẳng tấm, cổ tay ngửa 75° (kẹp 50). Không `slant`/`along` nào cứu (dò `slant` −60…60:
vượt nhỏ nhất 24,6°). Dò góc nghiêng (chỉ để đo, đã trả lại 40°):

| Góc nghiêng | cái sau vượt (sakura / kuroiwa) | nắm | khe cái hàng cái trước | lệch fixture |
|---|---|---|---|---|
| 40° (giữ) | 24,9 / 17,0 | 6,6 / 5,5 | 0,6 / 0,7 | < 0,3° |
| 30° | 14 / 6 | 3,6 / 1,6 | 1,3–2,5 / 0,4–0,7 (phải chỉnh lại ngón cái) | 10° |
| 25° | 8 / 0 | 1,9 / −0,4 | 1,7–2,7 / 0,6–0,9 | 15° |

Đổi góc nghiêng là phá mức fixture ≤ 0,3° → để chủ dự án quyết (nới fixture cho `pinch`, hay coi cái sau là giới hạn khớp như
"Đã tự quyết" mục cổ tay).

## Ảnh

- `../duyet/g4-sheet-pinch-truoc-sau.jpg` (hàng trên trước, dưới sau; mặc định sakura, ba góc), `zoom-mac-dinh-sakura-truoc-sau.jpg`,
  `dien-thoai-cai-truoc-sakura-truoc-sau.jpg`, bảng đủ `thu-bang-gia.jpg`, `thu-dien-thoai.jpg`.
- Nhận xét: góc chéo và ngang — trước ngón cái dựng lên cách tấm, sau ngón cái nằm áp mặt trước, mép tấm kẹp giữa ngón cái và
  bốn ngón ở mặt sau: đọc ra là kẹp. Góc chính diện gần như không đổi: mép vẫn lọt sâu vào kẽ cái–trỏ, lòng tay sát mặt sau
  ở mép (lòng lún 0,4–0,5), nên nhìn từ trước vẫn như góc tấm tựa trong lòng tay — đó là khung fixture (tâm nắm thụt 2,5,
  lòng nghiêng 40°), không đổi được khi giữ fixture. Điện thoại: tay ra sát mép, hết ngón lún vào thân máy.
- Khoe hai tay hai bên: bốn ngón ôm mép ở mặt trước, ngón cái sau — ổn. Cái sau: cổ tay gập gãy như trước.

## Kiểm

- Studio: `typecheck`, `lint`, `format:check`, `build` xanh; `test` xanh ở lần chạy riêng (lần đầu 4 test `human`/`skirt3d`/`grip`
  quá 5 s vì máy tải — `studio-checks.log`, `test.log`).
- Video `pnpm test` xanh (`video-test.log`).
- `check ^t02-` so `check-held-clash-g315.json`: 0 mới, 0 nặng hơn, 0 đã hết (`check-t02.log`).
- `check ^thu-nhom-cam`: 1 lỗi (`wrist` tay phải, đã biết), 1 cảnh báo (thân ↔ bảng 5,6 lúc xoay, đã biết); hết cảnh báo ngón
  cái pinch hở (`check-thu-nhom-cam.log`).

## Cho G4-37 (docs/11 nhóm 1)

`pinch`: tâm nắm cách mặt bốn ngón 0,5 (không còn "giữa bề dày"), thụt `max(0, 2,5 − 1,3·(t − 1))`; dáng `sheet` với ngón cái
`[0, 10, 10, −20]`.
