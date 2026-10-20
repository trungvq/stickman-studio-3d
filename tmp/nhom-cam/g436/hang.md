# G4-36 hàng mẫu `bang-cam --nhom sheet` (vòng 2)

Sáu món × hai cỡ tay (sakura W 14,7; kuroiwa W 16,8). Hàng: 108 trước G4-36, 88 sau (vòng 1: 111). Ô LỖI: 22 trước, 0 sau. Chế độ cũ (`--mon bang-gia`, không `--nhom`) vẫn 10 hàng, số đo và luật báo trùng với trước.

Bộ đủ (món tấm đứng, cả hai cỡ tay): `mặc định (<biến thể rig chọn>)` · `biến thể flat` · `biến thể rim` · `pinch · cái trước` · `pinch · cái sau` · `đọc ngang mặt` · `khoe một tay` · `khoe hai tay hai bên` · `khoe hai tay trên dưới`

| Món | Người | Hàng sau |
|---|---|---|
| thu-bang-gia, thu-thuc-don | cả hai | bộ đủ, 9 hàng |
| thu-bao | sakura | bộ đủ, 9 hàng |
| thu-bao | kuroiwa | rig chọn `rim`: `mặc định (rim)` · `biến thể pinch` · `biến thể flat` + 6 hàng sau, 9 hàng (`biến thể rim` bỏ vì trùng) |
| thu-dien-thoai | cả hai | bộ đủ trừ `khoe hai tay hai bên`, 8 hàng |
| thu-tom-hum (đĩa) | cả hai | `mặc định (pinch)` · `biến thể flat` · `biến thể rim` · `bê hai tay hai vành`, 4 hàng |
| thu-bo-da (tấm nằm) | cả hai | `mặc định (pinch)` · `biến thể flat` · `biến thể rim` · `khoe hai tay hai bên` · `bê hai tay hai vành`, 5 hàng |

## Hàng bỏ và vì sao

- **Trùng** (kê ở `do.json` `trung`): `biến thể pinch` giống `mặc định (pinch)` ở mọi món (12 hàng, trừ thu-bao kuroiwa); `biến thể rim` của thu-bao kuroiwa giống `mặc định (rim)`.
- **Hai cạnh cách < 1,3·W** (không có trong `loc`): `khoe hai tay hai bên` của thu-dien-thoai cả hai cỡ tay (bề ngang 18,45 < 19,1 và 21,8).
- **Không áp được cho món** (`do.json` `loc`, 22 hàng, trước đây là ô LỖI):
  - thu-tom-hum, mỗi cỡ tay 6 hàng: `pinch · cái trước/sau` (`thumb front/back`), `đọc ngang mặt`, `khoe một tay`, `khoe hai tay trên dưới` (`edge bottom`), `khoe hai tay hai bên` (món không có mốc `front`).
  - thu-bo-da, mỗi cỡ tay 5 hàng: `pinch · cái trước/sau`, `đọc ngang mặt`, `khoe một tay`, `khoe hai tay trên dưới`.

## Hàng thêm

- `bê hai tay hai vành` (`rim`, `both`; đĩa `edge` 270 và phụ 90, tấm nằm `edge left`; mặt trên hướng lên): thu-tom-hum và thu-bo-da, hai cỡ tay.

## Ô lỗi còn lại

Không có (0 trên 88 hàng).
