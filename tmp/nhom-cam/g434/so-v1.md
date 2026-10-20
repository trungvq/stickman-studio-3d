# G4-34 — `sheet` `rim`: so trước / sau / v1

Nguồn: `pnpm bang-cam --nhom sheet --mon thu-tom-hum,thu-bao,thu-bo-da` ở video, giây 0,5. Trước = studio `8855d13`
(`truoc/`), sau = thư mục này. v1 = `g4-chuan-v1/muc.md` (`tom-hum#nhac`, `bao#doc`, `bo-da#bung`; ngón trong ngoặc là ngón
ngoài `wrap` của v1). Chỉ ô rig giải ra `rim`. Khe âm là da lún. Hàng `tom-hum` rig chọn `thumb: bottom` (cái dưới đĩa).

## Đổi ở lõi

- `graspSolve.ts` `rim`: thụt `d = max(1, 3,2 − 0,8·t)` (`SHEET_INSET.rim` 3,2, `RIM_OUT` 0,8, `RIM_MIN` 1); tâm nắm cách mặt
  ngón cái `F` `RIM_TOP` 1,9 (tấm mỏng hơn 3,8 thì giữa bề dày). Dáng hoà theo bề dày **thật ở chỗ ngón ôm**: `thickAt` đo vật
  liệu dọc `F` ở 1 vào trong tâm nắm (`RIM_PROBE`, 24 mẫu) — vành đĩa tôm hùm ~1 dù hộp bao dày 5,4. `GraspContact.thick`,
  `ContactInput.shape` mới; `basePose` đọc `thick` khi `by: "thick"`.
- `graspGroups.ts`: `PoseRef.tip` (gập thêm đốt ngọn bốn ngón, như `knuckle`). `rim` dáng đóng `edge` + gốc 45° + ngọn 65° +
  ngón cái `RIM_THUMB [25, 20, 10, 25]`, dáng mở `edge`, khoảng `[0,05·A, 0,2·A]` (cũ `[0,05, 0,45]`, đóng = mở = `edge`).
  Vai trò: cái `press`, trỏ `wrap`, giữa `press`, áp út, út `support`, lòng `press` (cũ: mọi ngón `press`).
- Tâm nắm khung vẫn của tên dáng `edge`. Ngón cái `RIM_THUMB` chọn để `handGripOf` (luật `grip` của `check`, hoà
  `HAND_GRIPS` theo góc ngón) còn ở kẽ cái–trỏ: ngón cái nằm thấp hơn (`[15, 10, 10, 10]`) thì tâm nắm `check` tụt vào giữa nắm
  tay, "nắm" 5–8 → báo `grip` giả.
- Fixture (`graspSolve.test.ts`): `tom-hum#nhac` 1,5 → 0,71 (test ≤ 0,75), `bao#doc` 2,0 → 0,01 (≤ 0,1), `bo-da#bung` 0,00 →
  0,05 (≤ 0,1); góc 0,00°. `bang-gia#doc` < 0,3° giữ (code `pinch` không đổi).
- Test mới "`sheet` `rim` trên da": tấm mỏng (báo 0,24, phiếu 0,6) hai cỡ tay, hai tay, `slant` 0/22,5/45 — ngón cái trên
  mặt `F`, trỏ dưới, khe cái ≤ 1,1, trỏ ≤ 0,4, lún ≤ 0,35; dáng theo bề dày chỗ ôm (vành đĩa gần đóng, tấm đặc 3,9 mở); tấm
  dày 3,9 và vành đĩa lún ≤ 0,1, trỏ ≤ 0,4. Test thụt sửa theo công thức mới.

## Bảng (tay phải trừ khi ghi T)

| Món | Hàng | Người | | Chỗ cầm | Lún | Cái | Trỏ | Giữa | Áp út | Út | Lòng | Nắm | Cổ tay vượt | Luật |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tom-hum | biến thể rim | sakura | trước | bottom/front/0,25/22,5 | 0.00 | 8.2 | 0.2 | 6.1 | 7.6 | 10.8 | 3.7 | 4.0 | 0 | role |
| | | | sau | (như trên) | 0.00 | 0.8 | 0.1 | 1.2 | 4.8 | 8.9 | 3.8 | 3.9 | 0 | — |
| | | | v1 | fixture | −0.1 | 0.3 | 0.1 | (6.8) | (10.1) | (12.5) | 5.1 | 0.5 | — | loose,reach |
| tom-hum | biến thể rim | kuroiwa | trước | bottom/front/0,25/0 | 0.00 | 0.3 | 0.2 | 3.3 | 6.9 | 8.4 | 5.7 | 4.0 | 0 | role |
| | | | sau | (như trên) | 0.00 | 0.5 | 0.4 | 0.6 | 5.4 | 10.0 | 5.1 | 4.1 | 0 | — |
| | | | v1 | fixture | −0.2 | 0.2 | 0.2 | (7.9) | (11.3) | (14.1) | 5.8 | 0.5 | — | loose,reach |
| bao | biến thể rim | sakura | trước | front/right/0,75/22,5 | 0.00 | 0.9 | 4.2 | 6.0 | 9.0 | 11.4 | 3.7 | 0.0 | 0 | role |
| | | | sau | (như trên) | 0.12 | −0.1 | 0.2 | 3.1 | 6.4 | 8.9 | 3.1 | 0.2 | 0 | role |
| | | | v1 | fixture | −0.1 | 0.2 | 0.1 | (3.7) | (6.6) | (8.4) | 0.4 | −0.1 | — | — |
| bao | mặc định = biến thể rim | kuroiwa | trước | front/right/0,75/22,5 | 0.00 | 1.2 | 5.0 | 6.9 | 10.2 | 12.9 | 4.3 | 0.0 | 0 | loose |
| | | | sau | (như trên) | 0.09 | −0.0 | 0.3 | 3.6 | 7.3 | 10.1 | 3.5 | 0.3 | 0 | role |
| | | | v1 | fixture | −0.2 | 0.3 | 0.2 | (4.7) | (7.7) | (9.6) | 0.8 | −0.1 | — | face |
| bao | khoe một tay (= trên dưới, tay P) | sakura | trước | front/bottom/0,5/−22,5 | 0.11 | 1.6 | −0.1 | 0.3 | 0.2 | 1.4 | 9.2 | 0.8 | 27.2 | wrist,role,reach,arm |
| | | | sau | (như trên) | 0.07 | 2.9 | −0.1 | 0.2 | 0.8 | 4.5 | 8.8 | 2.7 | 27.2 | wrist,role,reach,arm |
| bao | khoe một tay (= trên dưới, tay P) | kuroiwa | trước | front/bottom/0,5/−22,5 | 0.00 | 3.2 | 7.5 | 11.1 | 15.4 | 19.7 | 14.7 | 6.7 | 26.3 | wrist,grip,loose |
| | | | sau | (như trên) | 0.00 | 3.6 | 3.9 | 8.6 | 13.6 | 17.9 | 13.9 | 5.4 | 24.2 | wrist,grip,loose |
| bao | khoe hai tay hai bên | sakura | trước | front/left/0,25/−22,5 | 0.00 | 1.1 | 0.2 | 0.1 | 4.2 | 8.8 | 9.1 | 0.2 | 0 | wrist,role |
| | | | sau | (như trên) | 0.02 | 2.0 | −0.0 | 1.7 | 6.0 | 10.2 | 8.9 | 0.4 | 0.7 | wrist,role |
| | | | trước T | front/right/0,25/−22,5 | 0.00 | 0.6 | 0.2 | 0.2 | 3.6 | 8.1 | 9.1 | −0.0 | 0 | |
| | | | sau T | (như trên) | 0.04 | 1.2 | −0.0 | 0.8 | 5.1 | 9.4 | 8.9 | 3.1 | 0.7 | |
| | | | v1 P / T | fixture | −0.1 / −0.1 | 0.2 / 0.1 | 0.1 / 0.1 | (3.7) / (3.6) | (6.6) / (6.9) | (8.4) / (8.7) | | | | |
| bo-da | biến thể rim | sakura | trước | bottom/front/0,5/−22,5 | 0.00 | 0.2 | 0.2 | 0.1 | 1.8 | 5.6 | 5.8 | −0.7 | 0 | role |
| | | | sau | bottom/left/0,5/0 | 0.00 | 0.0 | 0.2 | 0.2 | 4.0 | 5.7 | 2.8 | 0.7 | 0 | — |
| | | | v1 | fixture | 0.4 | −0.4 | 0.2 | 0.1 | (7.2) | (9.6) | 2.5 | −1.0 | — | — |
| bo-da | biến thể rim | kuroiwa | trước | bottom/left/0,5/0 | 0.00 | 0.1 | 0.1 | 0.2 | 0.2 | 7.0 | 4.7 | −0.7 | 0 | role |
| | | | sau | bottom/left/0,5/−22,5 | 0.00 | 0.2 | 0.2 | 0.2 | 1.7 | 5.5 | 6.0 | 0.7 | 0 | — |
| | | | v1 | fixture | 0.5 | −0.5 | 0.2 | 0.1 | (8.4) | (11.1) | 3.1 | −1.0 | — | — |
| bo-da | khoe hai tay hai bên (P = T) | sakura | trước | top/left/0,5/0 | 0.00 | 0.1 | 0.2 | 4.0 | 7.6 | 10.5 | 5.9 | −0.6 | 0 | role |
| | | | sau | (như trên) | 0.15 | −0.2 | 0.1 | 0.2 | 6.2 | 9.4 | 4.7 | −1.0 | 0 | — |
| bo-da | khoe hai tay hai bên (P = T) | kuroiwa | trước | top/left/0,25/0 | 0.00 | 0.2 | 0.2 | 4.7 | 8.6 | 12.1 | 6.9 | −0.6 | 0 | role |
| | | | sau | (như trên) | 0.00 | 0.0 | 0.1 | 0.2 | 7.4 | 11.0 | 5.7 | −1.0 | 0 | — |

Chỗ cầm đúng như fixture v1 (lõi, không cánh tay; `viz.mts`): `bao` `right/front/along 0,17/slant 36,9` sakura 0.1 / 0.3 /
4.9 / 6.5, kuroiwa 0.1 / 0.4 / 5.6 / 7.6 (trỏ / giữa / áp út / út; v1 0.1 / (3.7) / (6.6) / (8.4) và 0.2 / (4.7) / (7.7) /
(9.6)); `tom-hum` `left/top/slant 21,8` sakura 0.3 / 3.2 / 6.4 / 9.5, kuroiwa 0.2 / 3.9 / 7.6 / 11.2 — mọi ngón kín hơn v1.

## Theo đầu ra

| Đầu ra | Kết quả |
|---|---|
| Trỏ ≤ v1 + 0,3 | đạt mọi ô (0.0–0.4); trừ `bao` khoe một tay kuroiwa 3.9 (cổ tay vượt 24°, tay vẽ lệch chỗ cầm — trước 7.5) |
| Giữa `bo-da` (v1 0.1, bắt buộc) ≤ 0,4 | đạt (0.2) |
| Ngón v1 trong ngoặc không hở hơn v1 | đạt mọi ô `tom-hum`, `bo-da`, và `bao` ở chỗ cầm của fixture. **Không đạt** ở ô `bao` rig chọn `slant` 22,5 / −22,5: út 8.9 / 10.1 / 10.2 / 9.4 (v1 8.4 / 9.6 / 8.4 / 8.7, hơn 0,5–1,8) — v1 đo ở `slant` 36,9, `slant` nhỏ thì hàng ngón xếp sâu dưới tấm hơn |
| Lún ≤ 0,65 | đạt (≤ 0,15) |
| Lún ≤ v1 + 0,1 | đạt `tom-hum`, `bo-da` P; `bao` 0.07–0.12 và `bo-da` T 0.15 hơn v1 (v1 −0.1 / −0.2: ngón v1 không chạm) — là đích ép `HELD_FIT.touch` của ngón `press`/`wrap` |
| Fixture `rim` ≤ 1, ≤ 5° | 0.71 / 0.01 / 0.05, 0.00° |
| Fixture `bang-gia#doc` ≤ 0,3°; số `pinch` G4-33 | giữ (code `pinch` không đổi; 19/21 ô không `rim` trong bảng này trùng từng số, 2 ô khác là tay trái `pinch` của hàng "khoe hai tay trên dưới" vì tay phải `rim` đổi chỗ) |
| Luật | `role` hết ở `tom-hum`, `bo-da`; `bao` còn `role` (giữa `press` không chạm tấm mỏng, khe 3.1–3.6); không thêm `grip`; khoe một tay giữ `wrist`/`reach`/`arm` (giới hạn khớp) |

## Ảnh — nhận xét

`../duyet/g4-sheet-rim-truoc-sau.jpg` (sakura: tom-hum, bao biến thể rim, bao khoe một tay, bo-da; hàng trên trước, dưới sau),
bảng đủ `thu-*.jpg`.

- **Báo (mỏng)**: trước bàn tay dựng kiểu giơ ngón cái cạnh mép, ngón duỗi, không chạm tờ. Sau là nắm tay khép, mép báo kẹp
  giữa ngón cái (mặt trước) và cạnh ngón trỏ cuộn phía sau — đọc ra là cầm mép báo. Bốn ngón cuộn **dưới mép**, nhưng chỉ
  trỏ chạm mặt sau; giữa–út xếp chồng sau trỏ, không đỡ mặt sau (khung `rim` của fixture xếp hàng ngón vuông góc tấm). Ngón cái
  có đè mặt trước nhưng chếch lên, không nằm dẹt.
- **Đĩa tôm hùm**: trước bàn tay xoè úp trên vành; sau bốn ngón cuộn ôm vành, trông bám vành. Rig chọn `thumb: bottom` nên
  ngón cái ở **dưới** đĩa, bốn ngón cuộn qua vành vào lòng đĩa — không phải "cái trên, ngón đỡ dưới".
- **Đĩa bò (dày 6,5)**: dáng mở: lòng tay áp cạnh, trỏ–giữa áp mặt cạnh, ngón cái trên mặt trên — đỡ được; áp út, út duỗi
  thõng dưới đáy, không cuộn vào đáy (tấm dày, không ngón nào với tới đáy).
- **Khoe một tay**: như trước — cổ tay vượt 27°, tay vẽ lệch chỗ cầm, không nhìn ra cầm (giới hạn khớp, rủi ro 11).
- `slant` âm (rig chọn ở mọi hàng khoe `bao`) làm ngón chếch về mặt `F`: trỏ sang mặt trước, ngón cái sang sau, tờ báo lọt giữa
  trỏ và giữa — có từ trước, không sửa ở job này (xem dưới).

## Cần quyết / cho docs (G4-37)

- docs/11 nhóm 1 `rim`: thụt `max(1, 3,2 − 0,8·t)` (bỏ "rim 1"); tâm nắm cách mặt `F` 1,9 (tấm mỏng: giữa bề dày); dáng
  đóng `edge` + gốc 45° + ngọn 65° + ngón cái `[25, 20, 10, 25]`, mở `edge`, theo bề dày đo ở chỗ ngón ôm trong
  `[0,05·A, 0,2·A]`; vai trò: cái `press`, trỏ `wrap`, giữa `press`, áp út–út `support`, lòng `press`. docs/11 mục 6 hay mục
  3 "Kiểu dữ liệu": `PoseRef.tip`, `GraspContact.thick`.
- **`slant` âm của `rim`** đặt sai phía ngón (thấy ở ảnh): thử thu miền về `[0, 45]` thì hàng khoe `bao` vượt cổ tay 19–65° và
  tay vẽ lệch 10–20 (tệ hơn nhiều), nên giữ `[−45, 45]`. Cần chủ dự án quyết: thu miền + chấp nhận khoe dùng biến thể khác, hay
  đường khác cho `slant` âm.
- Luật `grip` của `check` đọc tâm nắm từ `handGripOf` (hoà `HAND_GRIPS` theo góc ngón) — dáng cuộn lạ bảng thì tâm nắm lệch
  5–8 so với khung. Muốn ngón cái nằm dẹt hơn thì cần dáng tay mới (`key`, có `HAND_GRIPS` riêng ở `hand.ts`) — ngoài phạm vi.
- `thumb` của `rim` trên đĩa: rig chọn `bottom` ở hàng `tom-hum` (giá cánh tay) — nếu muốn "cái trên" thì giá chọn `thumb` cần
  biết mặt trên (G4-35 / chọn lựa chọn).

## Kiểm

- Studio: `typecheck`, `lint`, `format:check`, `test` (rig 1026, sketch 245, fx 44 …), `build` xanh (`*.log`).
- Video `pnpm test` xanh (`video-test.log`).
- `check ^t02-` so `check-held-clash-g315.json`: 0 mới, 0 nặng hơn, 0 đã hết (`check-t02.log`).
- `check ^thu-nhom-cam`: 1 lỗi (`wrist` tay phải 2,2 s, đã biết), 1 cảnh báo (thân ↔ bảng 5,6, đã biết) (`check-thu-nhom-cam.log`).
- Script đo: `do/` (`probe.mts`, `eval.mts`, `explore.mts`, `viz.mts`, `rimskin.mts`, `gripof.mts`; chạy `node do/run.mjs <script>`).
