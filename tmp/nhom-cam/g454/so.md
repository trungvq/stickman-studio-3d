# G4-54 — tay phụ khác nhóm (`support.place`) — số đo

Nguồn: bản sao `bang-cam` có thêm một hàng `both` tay dẫn (`bang-cam-g454.mjs`, chạy ở video với `G454=1`; tay phải
`to: chest, offset [40, 10, 30], point: grip, hold { item, group, both: true }`, giây 0,5). Hàng mẫu `both` thật là G4-56.
Ảnh: `thu-chai-dia.jpg`, `thu-dien-thoai.jpg`, `thu-khay.jpg` (hai hàng đầu mỗi tờ là ca của job; các hàng còn lại là
tổ hợp nhóm × món khác do `--nhom` sinh ra, không thuộc job). Số đủ: `do.json`. Chạy lại không `both` (`G454_NOBOTH=1`):
số tay dẫn y hệt, nên tay phụ không đụng tay dẫn.

Lún = da lún sâu nhất (`max(0, −min khe)`); khe ngón đo trên da, âm là lún. "Lòng" = khe da lòng tay. Cổ tay: tay dẫn là
`grasp.arm.wrist.over`; tay phụ (tay dẫn không có báo của bộ giải cho nó) là lệch lòng / ngón còn lại sau kẹp cổ tay của
`actAim` (0 = tới đúng khung).

| Ca | Người (tay) | Tay | Chỗ (rig) | Lún | Cái | Trỏ | Giữa | Áp út | Út | Lòng | Cổ tay |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `chai-dia@cylinder both` | sakura (1,61) | P dẫn | wrap, than, along 0,5 | 0,12 | −0,1 | 0,0 | 0,0 | 0,0 | −0,1 | 0,61 | vượt 0 |
| | | T phụ | đáy `than`, cạnh `back`, ψ 0, tâm giữa đáy | 0,39 | 0,4 | −0,1 | −0,4 | −0,4 | 0,1 | 0,16 | lệch lòng 6,5° / ngón 24° |
| | kuroiwa (2,16) | P dẫn | như trên | 0,13 | −0,1 | 0,0 | 0,0 | 0,0 | −0,1 | 0,53 | vượt 0 |
| | | T phụ | như trên | 0,38 | 1,4 | −0,1 | −0,3 | −0,4 | −0,4 | 0,25 | lệch 1,5° / 13° |
| `dien-thoai@palmBox both` | sakura | P dẫn | thumb right, along 0,4, tilt 20 | **0,71** | −0,7 | 0,1 | 0,2 | 0,2 | 6,5 | −0,62 | vượt 0 |
| | | T phụ | mặt sau, cạnh `bottom`, ψ 0, tâm trên tay dẫn | 0 | 0,1 | 0,1 | 0,6 | 0,2 | 0,1 | 0,27 | lệch 0,3° / 0° |
| | kuroiwa | P dẫn | như trên | 0,04 | 0,0 | 0,2 | 0,3 | 0,2 | 6,8 | 0,22 | vượt 0 |
| | | T phụ | như trên | 0 | 0,3 | 1,5 | 2,1 | 1,2 | 0,3 | 0,29 | lệch 0° / 0° |
| `khay@platform both` | sakura | P dẫn | đáy, cạnh right, ψ 90 | 0,04 | 0,0 | 0,0 | 0,0 | 0,0 | 0,1 | 0,15 | vượt 0 (xoay kẹp −90) |
| | | T phụ | cạnh left (đối) | 0,20 | −0,2 | 0,3 | 0,0 | 0,0 | 0,3 | 0,00 | lệch 1,3° / 6,7° |
| | kuroiwa | P dẫn | như trên | 0 | 0,2 | 0,4 | 0,2 | 0,1 | 0,0 | 0,15 | vượt 0 (xoay kẹp −90) |
| | | T phụ | cạnh left | 0 | 0,1 | 0,4 | 0,2 | 0,1 | 0,1 | 0,08 | lệch 0,5° / 0,1° |

## Đọc

- Tay phụ cả ba ca: lún ≤ 0,39 (dưới `HELD_SINK` 0,65), lòng áp mặt (0–0,3), khe tay phụ tới chỗ ≤ 0,04. Luật `held` không báo
  gì ở tay phụ.
- Lún 0,71 của tay dẫn điện thoại (sakura) là `palmBox` sẵn có (ngón cái gò, `tilt` 20) — chạy không `both` ra đúng số ấy.
- Ảnh chai: tay trái ngửa dưới đáy, ngón chĩa ra trước, tay phải ôm thân. Đạt.
- Ảnh điện thoại: tay trái đỡ mặt sau phía trên tay dẫn; **đầu ngón thò quá cạnh trên** một đoạn (kuroiwa trỏ–áp út hở
  1,2–2,1 vì đốt ngọn ra ngoài máy). Không lún, không chồng tay dẫn; nhìn hơi dài ngón — chủ dự án xem có chấp nhận không.
- Ảnh khay: hai lòng tay ngửa hai cạnh đối, ngón chĩa ra xa. Đạt (hành vi của G4-53, chỉ thêm kiểm).
