# Bước 0 — kết quả

Prototype `grasp.mts` (graspFrame `sheet` pinch/flat/rim, `cylinder` wrap trên `rod`; bàn tay từ món; khuỷu E(φ) đúng spec mục 5; giải lựa
chọn thiếu). Render `hinh/ve.mjs` đi đường act3 thật: khuỷu lệch ≤ 0,05, lòng tay ≤ 0,09° (trừ tay xoay cẳng tay > 90°).

## Chốt
- Trọng số: `w_down 0,3`, `w_body 10`, **`w_cont 2`** (0,2 cho khuỷu nhảy 50°/mẫu ở ca tay trượt; 2 → 2,5°).
- Thụt `d` theo fixture, cố định mọi cỡ: pinch 2,5 (= 0,155·W ở cỡ takumi), flat 5, rim 1.
- slant lưới 3 điểm = nửa miền: pinch ±30, flat ±45, rim ±22,5. Thứ tự ứng viên: edge, thumb, variant, along, slant.
- Chi phí: một lần thử φ 0,008 ms; giải φ một mẫu (40 lần thử) 0,38 ms; giải lựa chọn thiếu 3–18 ứng viên 3–9 ms.

## Năm ca (vòng 2, `hinh/vong2/to-{1,2,3}.jpg`)
| Ca | Rig chọn | Cổ tay turn/bend/dev | Ảnh |
|---|---|---|---|
| 1 đọc ngang ngực | pinch, slant 30 | −79 / −11 / −2 | ổn, khuỷu dang vừa |
| 2 đọc ngang mặt | pinch, thumb front, along 0,25, slant −30 | −27,5 / 18 / −2 | ổn, khuỷu trước ngực, bảng cách mặt 26 |
| 3 khoe hai cạnh bên | pinch, **thumb back** | −42 / 3,5 / −0,6 | đẹp nhất |
| 4 khoe dưới + trên | **rim** cả hai; phải thumb front, trái back | P −103 (vượt) / 12 / −16; T 5 / 3 / −6 | P đỡ ngửa, ngón hở 5,8–10,9; T khuỷu khá cao |
| 5 cán chéo, tay trái trượt | around 300 / 30 | T t0 −51/34/17 → t0,6 −79/28/−2 | tự nhiên; khuỷu nhảy ≤ 2,5°/mẫu |

## Phát hiện cho spec / giai đoạn sau
1. `holderFace` suy biến với người chibi: từ ngực+30 tới giữa hai mắt ngẩng 84° → bảng gần ngửa. Ca 1 phải khai thẳng hướng.
2. Mặc định `thumb: front` sai khi mặt món quay ra xa người cầm (khoe): rig chọn `back`. Mặc định nên phụ thuộc hướng món, hay
   để rig giải (món đặt trước đã giải).
3. "Đỡ cạnh dưới" của tấm: `pinch` gãy cổ tay (bend 51, dev 39); `rim` tốt hơn nhưng dáng `edge` chỉ cái + trỏ chạm, ba ngón hở.
4. Cán `rod` r 2,5 với dáng `fist`: lún 1,47 (fixture `chai-dia#co` cùng tay 0,39); tâm nắm ngoài cán 1,5 → giai đoạn 4 `cylinder` cần
   dáng theo bán kính.
5. Rig hiện kẹp xoay cẳng tay ±90 và schema hành động chặn quá ±90: tay giải ra |turn| > 90 thì khuỷu bị rig xoay lại ~10.
   Spec mục 5 cần nói rõ: E phạt vượt, nhưng nghiệm cuối vẫn có thể vượt → `check` báo `wrist`, và cánh tay vẽ theo kẹp nào.
6. Lấn thân tay buông thõng của chính rig đã 4,4 ở bắp tay (áo) → số hạng `w_body` phải trừ mức nền ấy.
