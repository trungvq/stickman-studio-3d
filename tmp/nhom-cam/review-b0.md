## 1. Lỗ hổng / mâu thuẫn / mơ hồ ở mục 4–5
1. Mục 4 "Mốc món" · hệ trục của `toward` vectơ không nói · `face: { toward: [1, 0.6, 0.58] }` trong ví dụ rót và `[1,-1,-0.8]` prototype là hệ thân người cầm (`bodyDirR`, như `HoldTarget.v` hiện có), còn `at` là thế giới rig. · Thêm sau dòng "Hướng món là luật cứng": "Vectơ của `toward` và `up` ở hệ thân người cầm `[tiến, y xuống, ngang phải]`, như `HoldTarget.v` (`heldItem.ts:408`); `at` và `point` là thế giới rig."
2. Mục 4 "Vị trí dọc cạnh" · "đầu thấp" không định nghĩa ngưỡng và đổi theo thời gian · Thay câu "Cùng tên ở hai tay…" bằng: "Đầu thấp của cạnh xét một lần ở mốc bắt đầu lần cầm: cạnh dốc ≥ 30° so với mặt ngang thì là đầu dưới; cạnh gần ngang thì là đầu về phía tay ấy (ngang hệ thân). Giữ nguyên tới hết lần cầm dù món quay." (giữ ý cùng tên hai tay đối xứng)
3. Mục 5 "Khuỷu tự nhiên" · φ không có gốc, dấu, suy biến · Thêm: "`φ` quanh trục vai → cổ tay: `0` là khuỷu thõng (hình chiếu của hướng xuống), dương ra ngoài phía tay ấy; trục gần thẳng đứng thì gốc lấy hình chiếu của `−tiến`. `elbow` của mốc tay đổi ra `φ₀` bằng cùng phép chiếu."
4. Mục 5 "Ngoài tầm với" · tự mâu thuẫn · Thay bằng: "cánh tay duỗi thẳng về cổ tay đã giải, bàn tay vẽ ở đầu cẳng tay với hướng `Rw` đã giải và dáng ngón của lần cầm (ngón không `heldFit` lại), món vẫn ở chỗ khai — khe lộ trên hình, `check` báo `reach` với khe."
5. Mục 5 "Cổ tay vượt giới hạn" · xem B.
6. Mục 5 "Tất định" · Thêm: "Mẫu đầu của một lần cầm lấy `φ_trước` là mẫu cuối của lần cầm liền trước trên cùng tay (nếu có); lần cầm đầu tiên thì bỏ số hạng."
7. Mục 5 "Lựa chọn cảnh không khai" · tích đầy đủ 216 ứng viên (~90 ms) · Thêm hai bậc: "Giải rời trước (`edge`, `thumb`, `variant`, `part`) với trường liên tục ở mặc định; rồi lưới liên tục chỉ quanh ứng viên rời tốt nhất." Và công thức lệch mặc định: "`0,05 · (số trường lệch mặc định) / (số trường thiếu có mặc định)`" thay "≤ 0,05".
8. Mục 4 "Chỗ cầm" · `both` khi tay kia cũng khai `hold` · "`both` mà tay kia cũng có `hold` ở cùng `t` là lỗi `choice`." (thêm cả vào bảng mục 7 dòng `choice`) và "tay có `both` giải trước (lead), tay phụ giải sau với số hạng lấn của tay lead."
9. Mục 4 "Mốc món" · Thêm: "Trước mốc món đầu và sau mốc cuối của một lần cầm, món giữ ở mốc gần nhất (kẹp như `world.hands`)."
10. Mục 4 "Mốc món" · Thêm: "Thiếu trục nào lấy trục ấy của nhóm. Trục phụ lệch đích chính dưới 18° (|cos| > 0,95) thì `check` lỗi `item`, dòng báo gợi `roll` khác; rig không tự đổi." (thêm dòng `item` vào bảng mục 7, lỗi `ref`)
11. Mục 5 · `w_cont` = 2 (xem D).
12. Mục 5 số hạng `w_body`: "lấy mẫu dọc tay từ `1,5 · cap` của vai trở đi; trừ mức nền (B.6)."
13. Mục 5 "Đổi lần cầm" · Thay bằng: "chiều quay sao cho bàn tay vòng qua mép ngoài cạnh, không quét xuyên tấm."
14. Mục 5 "Bàn tay từ món" · Thêm: "Với tay của món đặt trước, `act3` nhận `Wp`, `Rw`, `φ` đã giải làm cứng: không `aimWrist`, không dò xoay khuỷu, không `HOLD_SLEW`."
## 2. Sáu phát hiện bước 0 → câu chữ spec
1. `holderFace` (mục 4): "`holderFace` là hướng từ chỗ món tới giữa hai mắt, góc ngẩng kẹp ở 45° so với mặt ngang hệ thân (người chibi, món ngang ngực mà không kẹp thì bảng gần ngửa); nghiêng khác thì `tilt`." Sửa ví dụ 1 cho khớp.
2. Mặc định `thumb` (mục 3 nhóm 1, mục 5 "Tay dẫn"): món đặt trước đã giải; tay dẫn thay in đậm `front` bằng: "`thumb`: mặt của tấm quay về người cầm ở mốc bắt đầu lần cầm (tấm đứng: `front`/`back` theo `F · (hướng tới mặt người cầm) > 0`; tấm nằm: `top`)."
3. Đỡ cạnh dưới: mục 5 thêm: "`variant` có `rim`/`flat` trong miền vì `pinch` ở cạnh dưới gãy cổ tay (bend 51, dev 39)". Dáng `rim` cuộn ngón theo bề dày: giai đoạn 4.
4. `fist` lún 1,47 trên cán r 2,5: mục 3 nhóm 5 dáng mở→đóng thêm: "`rod` r < 0,2·W cần dáng khép hơn `fist`; đặt ở giai đoạn 4 theo ảnh."
5. Xoay cẳng tay > 90: xem B.
6. Mức nền lấn thân (mục 5 `w_body`): "Lấn bắp tay trừ mức nền của tay buông thõng ở cùng phần dọc bắp tay (đo một lần mỗi người, mỗi tư thế thân; áo có thể tới 4,4)."
