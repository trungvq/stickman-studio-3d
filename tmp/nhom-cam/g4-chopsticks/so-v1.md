# G4-75+76 `chopsticks` hàng mẫu — v2 so với v1 (`dua#cam`)

Ngưỡng như G4-74: khe cái, trỏ ≤ v1 + 0,3 (sakura 0,7 / 2,7; kuroiwa 0,9 / 3,3), hay ≲ 0,15·W (2,2 / 2,5); lún ≤ 0,65; không xuyên. Luật `role` báo khi trỏ hở > 1,5 (ngưỡng chung của `held`); v1 (`dua#cam`) đo trỏ 2,4 / 3,0.

| Người | Hàng | Along | Lún | Xuyên | Nắm | Cái | Trỏ | Giữa | Áp út | Út | Lòng | Luật |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| sakura | v1 `dua#cam` | — | -0.4 | — | -1.1 | 0.4 | (2.4) | (5.6) | (9.6) | (13.4) | 11.3/30° | — |
| sakura | v2 mặc định (grip) | 0,38 | 0 | -2.6 | -1.3 | 0.1 | 1.9 | 5.7 | 9.5 | 14.1 | 7.3 | role |
| sakura | v2 along thấp (0,15) | 0,15 | 0 | -2.8 | -0.9 | 0.4 | 1.8 | 5.5 | 9.3 | 14 | 7.4 | role |
| sakura | v2 along cao (0,45) | 0,45 | 0 | -2.5 | -1.4 | 0 | 2 | 5.7 | 9.6 | 14.2 | 7.3 | role |
| sakura | v2 tay dẫn | 0,25 | 0 | -2.7 | -1.1 | 0.3 | 1.9 | 5.6 | 9.4 | 14 | 7.4 | role |
| sakura | v2 tay dẫn trái | 0,25 | 0 | -2.7 | -1.1 | 0.3 | 1.9 | 5.6 | 9.4 | 14 | 7.4 | role |
| kuroiwa | v1 `dua#cam` | — | -0.6 | — | -1.1 | 0.6 | (3.0) | (6.9) | (11.4) | (15.8) | 13.2/34° | — |
| kuroiwa | v2 mặc định (grip) | 0,38 | 0.3 | -2.6 | -1.3 | -0.3 | 2.4 | 6.9 | 11.4 | 16.7 | 8.5 | role |
| kuroiwa | v2 along thấp (0,15) | 0,15 | 0.1 | -2.8 | -0.9 | -0.1 | 2.4 | 6.7 | 11.2 | 16.5 | 9.1 | role |
| kuroiwa | v2 along cao (0,45) | 0,45 | 0.4 | -2.5 | -1.4 | -0.4 | 2.5 | 6.9 | 11.5 | 16.7 | 8.5 | role |
| kuroiwa | v2 tay dẫn | 0,25 | 0.2 | -2.7 | -1.1 | -0.2 | 2.4 | 6.8 | 11.3 | 16.6 | 8.5 | role |
| kuroiwa | v2 tay dẫn trái | 0,25 | 0.2 | -2.7 | -1.1 | -0.2 | 2.4 | 6.8 | 11.3 | 16.6 | 8.5 | role |

- Đạt ở mọi hàng: lún ≤ 0,4, cái ≤ 0,4, trỏ ≤ v1 (sakura 1,8–2,0 so 2,4; kuroiwa 2,4–2,5 so 3,0), xuyên −2,5 tới −2,8; không `wrist`, `sink`, `grip`, `loose`. Còn `role` (trỏ hở > 1,5) — dáng `chopsticks` không khép trỏ hơn (trỏ 1,8–2,5 đúng bằng đo G4-74).
- Hàng mặc định đặt đũa `offset [45, -3, 0]`, `face: tip → forward, tilt -30`, `roll`: trục x món (hai que cạnh nhau) về `[0, cos30°, -sin30°]` (xuống, sang trái). Dò: không `roll` thì cẳng tay xoay -121° (vượt 30,7°); `roll` -30 tới -15 hết vượt; ở `[30, -3, 0]` bắp tay vào đầu lấn 3,1–7,1 (luật `arm`), từ `[45, -3, 0]` hết.
- Ảnh: `thu-dua.jpg` (sakura rồi kuroiwa; hàng: mặc định, along 0,15, 0,45, tay dẫn, tay dẫn trái). Nhận xét: mặc định và `along` như tay dẫn — nắm đấm đặt trên đầu cầm, ngón cái đè hai que, hai que chạy dưới bàn tay chúc xuống trước; không xuyên, không hở lộ, hai ngón cái–trỏ chạm que. KHÔNG phải cầm đũa thật (que dưới không nằm khe cái–trỏ), như G4-74; khung fixture giữ ngang v1. `along` 0,15 / 0,45 dời bàn tay dọc đũa thấy được ở góc chéo (0,15 sát đầu cầm, 0,45 lùi về giữa).
- Tay dẫn trái giống tay dẫn phải số từng chữ (soi gương); chỉ khác ảnh.
