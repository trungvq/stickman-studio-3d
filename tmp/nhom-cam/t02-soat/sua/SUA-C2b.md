# SUA-C2b — báo ông khách (s061, s062, s063, s066)

Ảnh sau: `lo5/sau/<cảnh>/` (chụp lại cả Erika cho đủ bảng, Erika không đổi). Ảnh rộng (khung 320): `sua/c2b-anh/`.
Check sau: `lo5/check/<cảnh>-sau.txt`. Góc đo bằng `tools/goc-tay.cjs`.

| Cảnh | Người | Tay | Món | Lỗi người soi | Đã đổi gì | Tự soi (5 câu, góc đo) | Còn lỗi |
|---|---|---|---|---|---|---|---|
| s061, s062, s063, s066 (cùng chỗ ngồi `[-1674,-92,-240]`, `sit-3d`, cùng băng ghế; chỉ lúc gật đầu khác) | ong-khach | hai tay | bao@sheet | Q1: cánh tay phải gần ngang (ra 86, trước 77), khuỷu chĩa ra như cánh gà; tay trái dạng 61°; mép dưới tờ báo chạm đùi | `pinch` cạnh phải/trái slant 45 along 0.831 → `rim` cạnh `bottom`, along 0.1 (phải) / both along 0.9 (trái), thumb front, slant 40; at [-1600,-200,-320] → [-1575,-185,-328]; elbow [0,1,-1] → [0,1,0]; face giữ tilt 10 | 1 cánh tay: phải ra 13–14 / trước 48–50, cẳng tay ra ngoài 24–25°, chếch lên 25–27°, khuỷu 112–114°; trái ra 10 / trước 42–43, cẳng tay ra 10°, lên 32°, khuỷu 100–102° — khuỷu thả sát sườn, cẳng tay chếch lên trước. 2 va chạm: mép dưới tờ báo cách đùi chừng 60 (góc ngang, chéo), không chạm ghế, vali, người khác; check không báo. 3 món: hai tay ở hai góc dưới, ngón cái phía người đọc, bốn ngón vắt qua mép lên mặt ngoài; tờ báo dựng trước mặt cách đầu ~90 (≈35 cm), mặt trong về người đọc. 4 ngữ cảnh: ngồi băng ghế sảnh đọc báo — đúng. 5 liền mạch: bốn cảnh cùng khoá, ảnh gần như trùng (RMSE bảng 1.6–2.8%) | Dáng ngón: `rim` trên tấm mỏng đóng thành dáng cuộn (gốc ngón +45°, ngọn +65°) nên bàn tay nhìn từ trước như nắm tay dưới mép báo — cần rig nếu muốn ngón duỗi áp mặt ngoài như `pinch` |

## Check trước → sau

| Cảnh | Trước (bản SUA-C2) | Sau |
|---|---|---|
| s061 | lòng tay trái ông khách lệch 30° | 0 |
| s062 | yota lơ lửng trên máy in + lòng tay trái ông khách lệch 30° | chỉ yota (có từ trước) |
| s063 | lòng tay trái ông khách lệch 30° | 0 |
| s066 | cẳng tay Takumi lấn quầy + lòng tay trái ông khách lệch 30° | chỉ Takumi (có từ trước) |

## Vì sao bỏ `pinch` (cần rig nếu muốn giữ dáng ngón `pinch` với khuỷu thả)

`pinch` đặt lòng tay quay về người đọc (`n = 0,77·F + 0,64·f`), bàn tay sau tờ báo. Cẳng tay từ dưới lên trước (khuỷu sát
sườn) thì muốn lòng tay quay về mặt phải ngửa quá 90° hay gập cổ tay quá 70°, nên bộ giải chỉ đạt khi nhấc khuỷu ra ngoài
(φ ≈ 72°, chính là cánh gà). Đã thử ~200 tổ hợp trên s061 (at x −1625..−1575, y −235..−160, z −355..−320; elbow
[0,1,0], [−1,1,0], [0,1,−0,4], [0,1,−0,5], [−0,5,1,±0,3], [0,5,1,0]; slant −60..60; along 0,6–0,95; face tilt −30..45; cả cạnh
dưới): khi `upper.ra` ≤ 35 thì cổ tay phải luôn kẹt (xoay −90 hay gập 70, lệch −30), tờ báo lệch ý 15–35°, tay trái hở
24–130 (`loose`, `reach`). `rim` (lòng tay quay vào mép, đúng mô tả `mau/giay-khoe-hai-tay.md`) cạnh dưới cho cổ tay
gập −15, lệch 20, xoay −74, ý lệch 0, tay trái với tới (hở 0). `rim` cạnh bên slant 45: tay phải ra 30 nhưng tay trái ra
62 và lại thành nắm đấm ngón cái dựng (lỗi người soi lần trước) — bỏ.
