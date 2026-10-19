# Bước 0 — đo A: bàn tay mới (ngón cái giai đoạn 1)

Nguồn: `packages/rig/src/core/*.ts` (mã nguồn, gói esbuild — không có `tsx`), `held/` của `jp-sukatto` (`auto/t02-build`). Đơn vị rig, cỡ người `s = 1`. Số đủ ở `do-a.json`, fixture ở `fixtures.json`.

## Cỡ

| Khoá | k | long | ghi chú |
| --- | --- | --- | --- |
| `1` | 1,0000 | 1,0000 | long = k |
| `1.61` | 1,6100 | 1,6100 | long = k |
| `2.16` | 2,1600 | 2,1600 | long = k |
| `t01-sakura` | 1,7500 | 1,5446 | người thật, k·height = 1.610 |
| `kuroiwa` | 2,0000 | 1,8133 | người thật, k·height = 2.160 |

## 1. W, A, L, P

| Cỡ | W | W/k | A tâm–tâm | A/k (spec 9,76) | A mặt nang | A da (min) | L tâm | L/long (spec 17,9) | L da/long | P/long (spec 10,1) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `1` | 8,40 | 8,40 | 9,76 | 9,762 | 6,72 | 6,16 | 17,89 | 17,888 | 19,144 | 10,10 |
| `1.61` | 13,52 | 8,40 | 15,72 | 9,762 | 10,82 | 9,92 | 28,80 | 17,888 | 19,144 | 10,10 |
| `2.16` | 18,14 | 8,40 | 21,09 | 9,762 | 14,52 | 13,31 | 38,64 | 17,888 | 19,144 | 10,10 |
| `t01-sakura` | 14,70 | 8,40 | 15,25 | 8,714 | 9,93 | 9,44 | 27,72 | 17,946 | 19,376 | 10,10 |
| `kuroiwa` | 16,80 | 8,40 | 17,86 | 8,928 | 11,78 | 10,91 | 32,52 | 17,933 | 19,283 | 10,10 |

A tâm–tâm: tâm đầu đốt ngọn ngón cái ↔ ngón trỏ (`handFrames`, dáng `open`); mặt nang: trừ hai `pieceRadius`; da: đỉnh da gần nhau nhất của nửa ngoài hai đốt ngọn. L da: đỉnh da `index1` xa cổ tay nhất, dáng nghỉ.

## 2. `sheet`: độ thụt của `bang-gia#doc` (tay phải; tay trái trùng)

| Cỡ | W | Tâm nắm (= `at`) | ÷ W | Ngón cái: khe da | sâu | Đầu ngón cái | Đầu trỏ | Đầu giữa | Gốc trỏ | Ngón chạm: sâu nhất | trung bình | ÷ W |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `1` | 8,40 | 2,50 | 0,298 | 0,32 | 3,57 | 3,75 | 6,63 | 7,29 | -0,61 | 8,18 | 4,26 | 0,974 |
| `1.61` | 13,52 | 2,50 | 0,185 | 0,83 | 4,23 | 4,51 | 9,15 | 10,21 | -2,50 | 11,46 | 5,79 | 0,848 |
| `2.16` | 18,14 | 2,50 | 0,138 | 1,28 | 4,82 | 5,20 | 11,43 | 12,84 | -4,21 | 13,78 | 6,89 | 0,760 |
| `t01-sakura` | 14,70 | 2,50 | 0,170 | 0,30 | 3,62 | 4,16 | 8,41 | 9,58 | -2,78 | 10,78 | 4,96 | 0,733 |
| `kuroiwa` | 16,80 | 2,50 | 0,149 | 0,55 | 0,64 | 4,52 | 9,56 | 10,89 | -3,57 | 12,34 | 5,98 | 0,735 |

Sâu = khoảng từ mép `edgeR` vào trong tấm (âm là ngoài mép). Ngón chạm: đỉnh da trỏ–út cách tấm ≤ 0,3, sau `heldFit`. Ngón cái không có đỉnh da nào ≤ 0,3 ở mọi cỡ trừ `t01-sakura` (1 đỉnh).

## 3. Hệ số lòng tay `sheet pinch` từ `bang-gia#doc`

| Tay | n (khung món) | F | f chiếu lên mặt tấm | a | b | dư | góc tấm–lòng tay | slant (từ −m) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| phải | [-0,6042; 0,7654; -0,2216] | [0; 1; 0] (`front`) | [-0,9414; 0,0000; -0,3372] | 0,7654 | 0,6436 | 0,0048 | 40,1° | -19,7° |
| trái | [0,6042; 0,7654; -0,2216] | [0; 1; 0] (`front`) | [0,9414; 0,0000; -0,3372] | 0,7654 | 0,6436 | 0,0048 | 40,1° | 19,7° |

Không phụ thuộc cỡ tay: phép quay của `GripFrame` chỉ đọc `palm`, `fingers` của JSON.

## 4. δ lồi da từng đốt ở dáng gốc

Đỉnh da có trọng số lớn nhất ở đốt → mặt nang chưa phình (`pieceRadius`; lòng tay: năm dải + gò ngón cái của `handCapsules` với bán kính chưa phình). Lấy max mỗi dáng, rồi min–max qua 9 dáng của các fixture (`sheet edge pinch cup grip clasp hook span flat`), hai tay.

| Đốt | `1` | `1.61` | `2.16` | `t01-sakura` | `kuroiwa` | max ÷ k (`2.16`) | phía lòng tay, max (`2.16`) | t ở max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `palm` | 0,90–1,29 | 1,44–2,08 | 1,94–2,79 | 1,77–2,23 | 1,77–2,67 | 1,29 | 2,48 | 0,75–1,06 |
| `thumb0` | 1,28–1,85 | 2,07–2,98 | 2,77–3,99 | 2,36–3,21 | 2,32–3,90 | 1,85 | 3,56 | 0,32–0,62 |
| `thumb1` | -0,00–0,69 | -0,00–1,11 | -0,00–1,49 | -0,00–1,18 | 0,00–1,34 | 0,69 | 1,49 | 0,00–1,01 |
| `index0` | 0,14–0,31 | 0,22–0,50 | 0,30–0,67 | 0,24–0,55 | 0,25–0,62 | 0,31 | 0,40 | -0,07–0,07 |
| `index1` | -0,00–0,25 | -0,01–0,41 | -0,01–0,55 | -0,01–0,48 | -0,01–0,54 | 0,25 | 0,24 | 0,03–0,38 |
| `middle0` | 0,20–0,26 | 0,32–0,42 | 0,43–0,57 | 0,34–0,50 | 0,34–0,55 | 0,26 | 0,53 | -0,16–0,42 |
| `middle1` | -0,03–0,23 | -0,04–0,36 | -0,05–0,49 | -0,06–0,37 | -0,07–0,41 | 0,23 | 0,21 | -0,02–0,37 |
| `ring0` | 0,32–0,40 | 0,51–0,65 | 0,68–0,87 | 0,56–0,78 | 0,54–0,68 | 0,40 | 0,68 | -0,04–0,08 |
| `ring1` | -0,03–0,18 | -0,05–0,28 | -0,07–0,38 | -0,07–0,26 | -0,07–0,32 | 0,18 | 0,38 | 0,00–0,79 |
| `pinky0` | 0,12–0,32 | 0,19–0,52 | 0,26–0,70 | 0,36–0,72 | 0,54–0,70 | 0,32 | 0,68 | 0,13–0,59 |
| `pinky1` | -0,01–0,21 | -0,01–0,33 | -0,02–0,45 | -0,01–0,28 | -0,01–0,37 | 0,21 | 0,45 | 0,01–0,88 |

t: vị trí dọc đốt của đỉnh lồi nhất (0 gốc, 1 ngọn; lòng tay: từ cổ tay tới hàng khớp gốc ngón).

## 5. Baseline `heldFit` hiện có

`heldFit` một lần với dáng của kiểu cầm, rồi đo: lún trên da (mục 7 bản mới, đỉnh da sâu nhất trong hình), khe nang đã nới (`fitCapsules`, như `check` nay) nhỏ nhất theo nhóm, `pierce` (trục nang vào hình, `core`). ms: trung vị 15 lần, một bàn tay. Cột theo cỡ `1.61` / `t01-sakura` / `kuroiwa`.

| Kiểu | Tay | Dáng | Vai | Lún da (đốt) 1,61 | sakura | kuroiwa | Nang nới min (nhóm) 1,61 | pierce core 1,61 | ms 1,61 | ms sakura | ms kuroiwa |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `bang-gia#doc` | P | sheet | one | 0,49 (pinky1) | 0,50 (pinky0) | 0,49 (pinky1) | -1,87 (palm) | -0,88 | 2,19 | 1,54 | 1,79 |
| `bang-gia#doc` | T | sheet | one | 0,49 (pinky1) | 0,50 (pinky0) | 0,49 (pinky1) | -1,87 (palm) | -0,88 | 2,15 | 1,50 | 1,82 |
| `phieu-lien#cam` | P | edge | one | -0,13 (middle1) | -0,01 (thumb1) | -0,14 (index1) | -1,45 (thumb) | -2,06 | 1,00 | 0,84 | 1,00 |
| `phieu-lien#cam` | T | edge | one | -0,13 (middle1) | -0,01 (thumb1) | -0,14 (index1) | -1,45 (thumb) | -2,06 | 1,01 | 0,85 | 1,00 |
| `thuc-don#khoe` | P | edge | one | 0,12 (thumb1) | 0,12 (thumb1) | 0,09 (thumb1) | -2,39 (thumb) | -2,05 | 1,33 | 1,29 | 1,30 |
| `thuc-don#khoe` | T | edge | one | 0,12 (thumb1) | 0,12 (thumb1) | 0,09 (thumb1) | -2,39 (thumb) | -2,05 | 1,31 | 1,29 | 1,29 |
| `tom-hum#nhac` | P | edge | lead | -0,13 (thumb1) | -0,12 (index1) | -0,16 (index1) | -1,27 (thumb) | -2,13 | 4,49 | 4,36 | 4,21 |
| `tom-hum#nhac` | T | edge | other | -1,49 (thumb0) | -1,49 (thumb0) | -2,02 (thumb0) | -0,18 (thumb) | -4,67 | 1,73 | 1,65 | 1,73 |
| `the-phong#kep` | P | pinch | one | 0,22 (middle1) | -0,02 (index1) | -0,03 (index1) | -0,67 (index) | -1,97 | 1,72 | 1,12 | 1,12 |
| `the-phong#kep` | T | pinch | one | 0,22 (middle1) | -0,02 (index1) | -0,03 (index1) | -0,67 (index) | -1,97 | 1,65 | 1,11 | 1,13 |
| `but#viet` | P | cup | one | 0,20 (thumb1) | 0,17 (thumb1) | 0,20 (thumb1) | -1,12 (thumb) | -2,05 | 1,38 | 1,43 | 1,48 |
| `but#viet` | T | cup | one | 1,15 (palm) | 1,27 (palm) | 0,94 (palm) | -3,28 (fingers) | 0,73 | 1,35 | 1,44 | 1,41 |
| `dua#cam` | P | pinch | one | -0,52 (thumb1) | -0,44 (thumb1) | -0,57 (thumb1) | -0,59 (thumb) | -2,93 | 0,87 | 0,61 | 0,60 |
| `dua#cam` | T | pinch | one | -0,52 (thumb1) | -0,44 (thumb1) | -0,57 (thumb1) | -0,59 (thumb) | -2,93 | 0,87 | 0,60 | 0,60 |
| `chai-dia#co` | P | grip | one | 0,62 (thumb1) | 0,80 (thumb1) | 0,36 (thumb1) | -2,31 (thumb) | -1,48 | 5,84 | 5,66 | 5,58 |
| `chai-dia#co` | T | grip | one | 0,62 (thumb1) | 0,80 (thumb1) | 0,36 (thumb1) | -2,31 (thumb) | -1,48 | 5,83 | 5,60 | 5,64 |
| `chen#kep` | P | clasp | one | 2,36 (palm) | 2,03 (palm) | 1,50 (palm) | -3,74 (palm) | -0,35 | 2,13 | 2,23 | 2,24 |
| `chen#kep` | T | clasp | one | 2,36 (palm) | 2,03 (palm) | 1,50 (palm) | -3,74 (palm) | -0,35 | 2,16 | 2,22 | 2,24 |
| `tui#xach` | P | hook | one | 1,06 (pinky1) | 0,94 (pinky1) | 0,60 (pinky1) | -1,72 (fingers) | -0,12 | 11,25 | 12,29 | 11,91 |
| `tui#xach` | T | hook | one | 1,06 (pinky1) | 0,94 (pinky1) | 0,60 (pinky1) | -1,72 (fingers) | -0,12 | 11,16 | 12,02 | 12,04 |
| `dien-thoai#doc` | P | span | one | 0,90 (thumb0) | 1,24 (thumb0) | 0,48 (thumb0) | -3,22 (thumb) | -1,53 | 3,25 | 4,20 | 3,29 |
| `dien-thoai#doc` | T | span | one | 0,90 (thumb0) | 1,24 (thumb0) | 0,47 (thumb0) | -3,22 (thumb) | -1,53 | 3,36 | 4,01 | 3,25 |
| `khay#bung` | P | flat | lead | 1,42 (palm) | 1,40 (palm) | 1,50 (palm) | -2,04 (thumb) | -1,71 | 0,58 | 0,55 | 0,56 |
| `khay#bung` | T | flat | other | 1,42 (palm) | 1,40 (palm) | 1,50 (palm) | -2,04 (thumb) | -1,71 | 0,55 | 0,55 | 0,57 |
| `phieu#do` | P | flat | one | -0,56 (thumb0) | -0,42 (thumb0) | -0,25 (palm) | -0,09 (thumb) | -3,57 | 0,29 | 0,29 | 0,31 |
| `phieu#do` | T | flat | one | -0,56 (thumb0) | -0,42 (thumb0) | -0,25 (palm) | -0,09 (thumb) | -3,57 | 0,29 | 0,29 | 0,29 |
| `bo-da#bung` | P | edge | lead | 0,21 (thumb1) | 0,40 (thumb1) | 0,53 (thumb1) | -2,15 (thumb) | -2,07 | 3,18 | 3,19 | 3,24 |
| `bo-da#bung` | T | edge | other | -0,18 (thumb0) | -0,18 (thumb0) | -0,55 (thumb0) | -1,59 (thumb) | -3,26 | 0,58 | 0,62 | 0,59 |
| `bao#doc` | P | edge | lead | 0,06 (palm) | 0,12 (palm) | 0,02 (palm) | -2,94 (palm) | -2,14 | 2,09 | 1,77 | 1,82 |
| `bao#doc` | T | edge | other | -0,06 (palm) | 0,12 (palm) | 0,02 (palm) | -2,93 (palm) | -2,14 | 1,00 | 1,00 | 1,01 |

Lún da dương là da trong hình; âm là khe (không đỉnh nào chạm). `pierce` dương là trục nang vào trong hình (ngưỡng `HELD_PIERCE_FIT` 0,5).

## Fixture

`fixtures.json`: 15 kiểu, mỗi kiểu `size`, `hands` (`one`/`both`, `lead`), và theo từng khoá cỡ `{ right, left: GripFrame + pose, role, wrap, centre { hand, item }, palm, fingers }, pose, centre, k, long }`. Kiểu hai tay: tay `lead` là `gripHand`, tay kia `both.other` (đích của bộ giải, món theo tay `lead`). Thiếu: không.

## Lệch so với spec

- `1,61`, `2,16` của spec là `k · height` (cách `bang-cam` xếp người), không phải cỡ tay: người thật là `t01-sakura` `k 1,75, long 1,545` và `kuroiwa` `k 2, long 1,813`. Món và bàn tay cùng nhân `s`, chiều cao không nhân bàn tay, nên so với món `W` là 14,7 / 16,8, không phải 13,5 / 18,1.
- `A` lẫn bề ngang (`k`) và dọc (`long`): `9,76 · k` chỉ đúng khi `long = k`; tay thật ra 8,71 · k và 8,93 · k.
- `bang-gia#doc` đặt tâm nắm cố định 2,5 từ mép ở mọi cỡ (`d / W` = 0,30 → 0,14), không tỉ lệ `W`. Không định nghĩa nào trong bảng 2 ra lại 3 / 5,75 / 6,25; gần nhất là sâu của đầu ngón cái (3,75 / 4,16 sakura / 4,52 kuroiwa).
- Ngón cái không chạm tấm ở `bang-gia#doc`: khe da 0,30–1,28, `heldFit` (thumb trong `wrap`) không tìm được góc cuộn chạm trong 75°. Khung nang nới (`check` nay) vẫn báo ngón cái lún tới 0,2 ở cỡ `1` và sakura.
- `but#viet` tay trái (không có `left`): bút xuyên lòng tay, da lún 0,9–1,3, `pierce` core 0,2–0,7.
- `chen#kep`: lòng tay lún 1,5–3,5 trên da ở mọi cỡ. `chai-dia#co`: `thumb1` lún 0,36–1,44. `khay#bung`: lòng tay lún 1,4–1,5.
- δ lớn nhất ở `thumb0` (gò ngón cái, 1,3–1,85 · k) và lòng tay (0,9–1,3 · k, ở hàng khớp gốc ngón); đốt ngọn gần 0 ở dáng duỗi, tới 0,7 · k ở `pinch`. δ không tỉ lệ đều theo `k` khi `long < k`.
- `heldFit` chậm nhất `tui#xach` 11–12 ms (10 khối hình), `chai-dia#co` 5,6–5,8, `tom-hum#nhac` 4,2–4,5 — cao hơn số 1,75–4,16 của spec mục 6.6.

