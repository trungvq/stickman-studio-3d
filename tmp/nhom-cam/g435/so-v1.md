# G4-35 — `sheet`: vành đĩa theo góc, ngón cái `rim` về mặt trên — so trước / sau / v1

Nguồn: `pnpm bang-cam --nhom sheet --mon thu-tom-hum,thu-bo-da` ở video, giây 0,5. Trước = studio `ec5329a` (`truoc/`), sau =
thư mục này. v1 = `g4-chuan-v1/muc.md` (`tom-hum#nhac`, `bo-da#bung`; ngón trong ngoặc là ngón ngoài `wrap` của v1).
Ở `bang-cam` món đặt **đứng** trước ngực, mặt `top` (mặt có thức ăn) quay ra trước, mặt `bottom` quay về người cầm.

## Đổi ở lõi

- `graspSolve.ts` `chooseMissing`: miền `edge` của đĩa là góc `0, 30, …, 330` (`DISC_STEP`), thay bốn tên vành. Tay dẫn
  (`solve: false`) không khai `edge` trên đĩa lấy góc: đĩa nằm `90` (tay phải) / `270` (tay trái), đĩa đứng `180`.
- `rim` không khai `thumb`: chỉ thử mặt trên — món khai `top` và tấm nằm theo khung món thì mặt `top`; không thì mặt có
  pháp tuyến hướng lên trong thế giới khi nó lệch phương đứng dưới 45° (`RIM_UP`); tấm đứng trong thế giới mà món không khai
  `top` thì không ràng. Ràng buộc miền (bỏ ứng viên), không thêm giá. `pinch`, `flat` giữ hai mặt.
- `edge` cảnh khai chỉ xét khối hình có cạnh ấy (`edgeOk`, nay export) ở cả ba chỗ chọn khối hình: `chooseMissing`,
  `holdLink.fillChoice`, `scene.handChoice`. Trước đó `edge: 60` trên `tom-hum` (phần `dia` ra cả `slab` lẫn `disc`) ném lỗi
  "tấm `dia` không có cạnh `60`" vì `slab` đứng trước.
- `holdLink.ts`: `leadEdge` đĩa ra góc; `oppositeEdge` góc `+180` chuẩn về `[0, 360)` (cả góc âm). `checkChoice` đã nhận
  `edge` số cho đĩa, tên vành vẫn nhận — chỉ thêm test.
- Quy ước góc (đã có ở docs/11 mục 2 và `radialBasis` của `heldGeom.ts`): `0` ở `front` (đĩa đứng: `top`), tăng về `right`;
  `front`/`right`/`back`/`left` = `0`/`90`/`180`/`270`. Nhìn từ mặt `top` của đĩa nằm (U lên, F ra trước) thì `F → R` là chiều
  kim đồng hồ.

## Bảng (tay phải; `edge` / `thumb` / `along` / `slant`; khối hình)

| Món | Hàng | Người | | Chỗ cầm | Lún | Cái | Trỏ | Giữa | Áp út | Út | Lòng | Nắm | Luật |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tom-hum | mặc định (`pinch`) | sakura | trước | disc right/bottom/0,5/−30 | 0 | 1.4 | 0.2 | 0.2 | 0.3 | 3.1 | 1.2 | −0.1 | ngón hở |
| | | | sau | disc **60**/bottom/0,5/0 | 0 | 1.4 | 0.2 | 0.2 | 0.4 | 0.1 | 2.6 | −0.1 | — |
| tom-hum | mặc định (`pinch`) | kuroiwa | trước | disc right/bottom/0,5/−30 | 0 | 1.5 | 0.5 | 0.2 | 0.3 | 3.2 | 1.6 | −0.1 | ngón hở |
| | | | sau | disc **60**/bottom/0,5/0 | 0 | 1.5 | 0.3 | 0.2 | 0.3 | 0.0 | 3.1 | −0.1 | ngón hở (cái) |
| tom-hum | biến thể flat | sakura | trước | disc front/bottom/0,5/45 | 2.4 | −0.4 | −1.9 | −1.9 | −2.4 | −2.2 | −2.4 | −0.5 | xuyên, lún |
| | | | sau | disc **60**/bottom/0,5/0 | 0.3 | 0.3 | 0.3 | 0.0 | 0.1 | 0.0 | −0.3 | −0.6 | — |
| tom-hum | biến thể flat | kuroiwa | trước | disc right/bottom/0,5/−45 | 1.3 | 0.4 | 0.0 | −1.3 | −0.2 | 1.6 | −0.5 | −0.6 | lún |
| | | | sau | disc **60**/bottom/0,5/0 | 0.8 | 0.4 | −0.8 | 0.4 | −0.2 | 0.2 | −0.3 | −0.6 | lún |
| tom-hum | biến thể rim | sakura | trước | slab front/bottom/0,25/22,5 | 0 | 0.8 | 0.1 | 1.2 | 4.8 | 8.9 | 7.5 | 3.9 | — |
| | | | sau | disc **120/top**/0,5/−22,5 | 0 | 1.2 | 0.0 | 0.7 | 4.6 | 9.1 | 4.5 | 0.0 | — |
| | | | v1 | fixture | −0.1 | 0.3 | 0.1 | (6.8) | (10.1) | (12.5) | 5.1 | 0.5 | loose,reach |
| tom-hum | biến thể rim | kuroiwa | trước | slab front/bottom/0,25/0 | 0 | 0.5 | 0.4 | 0.6 | 5.4 | 10.0 | 7.5 | 4.1 | — |
| | | | sau | disc **150/top**/0,5/−22,5 | 0 | 1.8 | 0.0 | 1.0 | 5.9 | 11.0 | 5.6 | 0.7 | ngón hở (cái) |
| | | | v1 | fixture | −0.2 | 0.2 | 0.2 | (7.9) | (11.3) | (14.1) | 5.8 | 0.5 | loose,reach |
| bo-da | biến thể rim | sakura | trước | slab left/bottom/0,5/0 | 0 | 0.0 | 0.2 | 0.2 | 4.0 | 5.7 | 0.3 | 0.7 | — |
| | | | sau | slab right/**top**/0,25/−22,5 | 0 | 0.4 | 0.4 | 0.1 | 2.5 | 6.7 | 2.5 | −1.0 | — |
| | | | v1 | fixture | 0.4 | −0.4 | 0.2 | 0.1 | (7.2) | (9.6) | 2.5 | −1.0 | — |
| bo-da | biến thể rim | kuroiwa | trước | slab left/bottom/0,5/−22,5 | 0 | 0.2 | 0.2 | 0.2 | 1.7 | 5.5 | 1.6 | 0.7 | — |
| | | | sau | slab back/**top**/0,75/−22,5 | 0.4 | −0.4 | 0.4 | 0.2 | 3.0 | 7.2 | 1.5 | −1.0 | — |
| | | | v1 | fixture | 0.5 | −0.5 | 0.2 | 0.1 | (8.4) | (11.1) | 3.1 | −1.0 | — |

Các ô khác (`bo-da` mặc định, flat, khoe hai tay hai bên) trùng từng số với trước — `bo-da` chỉ ra `slab`, và hàng khoe đã
khai `edge`, rig chọn `thumb: top` từ trước. Hàng `pinch · cái trước/sau`, `đọc ngang mặt`, `khoe một tay`, `khoe hai tay
trên dưới` của hai đĩa vẫn lỗi `choice` (`thumb: front`, `edge: bottom` không có trên tấm nằm) và hàng `khoe hai tay hai bên`
của tôm lỗi thiếu mốc `front` — do `bang-cam.mjs` soạn hàng theo tấm đứng (việc của G4-36).

## Theo đầu ra

| Đầu ra | Kết quả |
|---|---|
| `thu-tom-hum@sheet` (đĩa) giải ra `edge` số | đạt: mọi ô tôm do rig giải ra `disc` với góc (60, 120, 150); `by.edge` = `rig` |
| `both` tay phụ ở cạnh đối = +180 | đạt ở test (`holdLink.test.ts`: tay dẫn `edge` 60 → tay phụ 240, 300 → 120, lệch hướng bán kính < 5°). Hàng hai tay của tôm ở `bang-cam` không chạy được (lỗi hàng, G4-36); `both` của món đặt trước chưa có (G4-55) |
| Hàng mặc định tôm: ngón cái ở mặt trên | **không đạt** — hàng mặc định giải ra `pinch` (biến thể mặc định), `thumb: bottom`: ngón cái ở mặt sau (phía người cầm), bốn ngón đè mặt có tôm. Luật mặt trên chỉ áp cho `rim` theo phạm vi job ("không đổi `pinch`/`flat`"). Hàng `biến thể rim` đạt: ngón cái ở mặt `top` cả hai người |
| Fixture `rim`/`pinch` giữ số | đạt: code khung (`graspFrame`, `CONTACTS`) không đổi; test fixture (`tom-hum#nhac` ≤ 0,75 đo 0,71, `bao#doc`, `bo-da#bung`, `bang-gia#doc` ≤ 0,3°) xanh |
| Test mới | `graspAt.test.ts` "chooseMissing: vành đĩa" (3 test: lưới góc, mặt trên của `rim` cả món không khai `top`, tên vành và tay dẫn), `holdLink.test.ts` (cạnh đối +180), `graspGroups.test.ts` (+1 dòng: tên vành vẫn hợp lệ) |

## Ảnh — nhận xét

`../duyet/g4-sheet-dia-truoc-sau.jpg` (tôm sakura: mặc định trước/sau, biến thể rim trước/sau), bảng đủ `thu-*.jpg`, bản
trước ở `truoc/`.

- **Tôm `rim` (sakura)**: trước bàn tay nắm mép trên đĩa, ngón cái phía người cầm, bốn ngón móc qua vành vào lòng đĩa trên
  con tôm. Sau tay ở vành dưới bên phải người cầm (góc 120), **ngón cái đè mặt có tôm, bốn ngón cuộn ra sau đỡ mặt dưới** — đúng
  cách bê đĩa. Nhìn chéo và ngang đọc rõ; nhìn thẳng ngón cái lẫn vào càng tôm. Áp út, út vẫn hở 4,6–9,1 (như G4-34, khung `rim`
  xếp hàng ngón vuông góc tấm).
- **Tôm `rim` (kuroiwa)**: như trên ở góc 150; ngón cái hở 1,8 nên `check` báo ngón hở (trước 0,5 ở mặt sau) — mặt trên đĩa
  tôm dốc vào lòng ngay sau vành nên đệm ngón cái `RIM_THUMB` không chạm hết ở tay to.
- **Tôm mặc định (`pinch`)**: chỉ đổi chỗ, góc 60 (mép trên phải), `slant` 0; út hết hở (3,1 → 0,1). Ngón cái vẫn sau đĩa,
  bốn ngón trên mặt có tôm — **chưa phải cái trên**.
- **Tôm `flat`**: hết xuyên/lún nặng (2,4 → 0,3 ở sakura) nhờ góc 60 thay `front`.
- **Bò `rim`**: ngón cái chuyển sang mặt có thịt (mặt `top`), bốn ngón sau; lún kuroiwa 0,4 (v1 0,5).

## Cần quyết / cho docs (G4-37)

- **Mâu thuẫn đầu ra**: "hàng mặc định ngón cái ở mặt trên" cần đổi `pinch` (hay giá biến thể) mà job cấm. Hai hướng: (a) áp
  luật mặt trên cho mọi biến thể khi tấm là đĩa/tấm nằm theo khung món (món có `top`); (b) để `pinch` tự do, coi hàng mặc định
  của đĩa đứng ở `bang-cam` là đúng (tay kẹp đĩa đưa ra như đưa bảng). Cần chủ dự án chọn.
- docs/11 mục 3 nhóm 1 `sheet`, "Lựa chọn": `rim` không khai `thumb` thì ngón cái ở mặt trên — món khai `top` và tấm nằm theo
  khung món: mặt `top`; không thì mặt hướng lên trong thế giới khi lệch phương đứng < 45°; tấm đứng (cả trong thế giới) thì rig
  giải hai mặt. Mục 5 "Lựa chọn cảnh không khai": miền `edge` của đĩa 12 góc bước 30 (`0..330`), tay dẫn trên đĩa lấy góc
  `90`/`270` (nằm) hay `180` (đứng); số ứng viên tăng (đĩa tôm không khai gì: 98 thay 66).
- docs/11 mục 2 đã có quy ước góc; nên thêm "nhìn từ `top` của đĩa nằm là chiều kim đồng hồ" và "`both` trên đĩa: góc + 180".
- Phần `dia` của tôm ra cả `slab` (hộp bao) lẫn `disc`; rig chọn khối hình theo giá nên có lúc ra `slab` với tên cạnh
  (`along` ≠ 0,5 trên cạnh hộp bao là điểm ngoài vành tròn). Đề xuất (ngoài phạm vi): phần đã ra `disc` thì không ra `slab`.

## Kiểm

- Studio: `typecheck`, `lint`, `format:check`, `test` (rig 1030, sketch 245, fx 44 …), `build` xanh (`*.log`).
- Video `pnpm test` xanh (`video-test.log`).
- `check ^t02-` so `check-held-clash-g315.json`: 0 mới, 0 nặng hơn, 0 đã hết (`check-t02.log`).
- `check ^thu-nhom-cam`: 1 lỗi (`wrist` tay phải 2,2 s, đã biết), 1 cảnh báo (thân ↔ bảng 5,6, đã biết) (`check-thu-nhom-cam.log`).
