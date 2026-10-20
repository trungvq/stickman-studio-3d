# Bảng duyệt kiểu cầm

Rig `7.15.0` · giây 0.5 · người: `t01-sakura.json` (tay 1.61), `kuroiwa.json` (tay 2.16) · 18 hàng × 3 góc.
Số đo (đơn vị rig, góc độ): `lún` da lún sâu nhất vào món (âm là khe), `hở` ngón khai `wrap` còn cách món, `nắm` tâm nắm tới mặt món (âm là trong món), `lòng` khe/góc lòng tay (không đo với dáng kẹp `edge`, `pinch`, `hook`), `up`/`face` góc lệch ý định và khớp cổ tay kẹp, `tới` khe tay phụ hay `item:` tới đích; món treo: `quai` đỉnh quai tới chỗ treo, `khuỷu` góc gập/độ ngóc cẳng tay, `thân` khe thân món tới phần người gần nhất, `đẩy` góc lệch khỏi phương đứng. `!!` là luật `held` của `check` báo trên cảnh này.

Chỗ cầm nhóm: dòng đầu là lựa chọn rig giải (`variant`, `edge`, `along`, `thumb`…), dòng hai `lún` da lún sâu nhất vào món, `xuyên` trục nang tới mặt món (âm là còn ngoài), `nắm` tâm nắm tới hình, `cỡ` khối hình / `W` tay, `cổ tay vượt` độ vượt kẹp, `hở` ngón có vai trò chạm mà còn cách món; dòng ba là khe từng ngón tới món (âm là lún) và vai trò (`press`, `wrap`, `tip`, `support`, `free`).


| Món#kiểu | Tay | Người | Dáng lấy từ | Số đo | `check` |
|---|---|---|---|---|---|
| `thu-chen@bowl mặc định (side)` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant side along 0.3
   lún 0.4 · xuyên -1.2 · nắm -0.7
   cái(wrap) -0.4 trỏ(wrap) 0.1 giữa(wrap) 0.3
   áp út(support) 0.4 út(support) 4 lòng(press) -0.4 | — |
| `thu-chen@bowl along thấp (0,1)` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant side along 0.1
   lún 0.5 · xuyên -1.1 · nắm -2.1
   cái(wrap) -0.5 trỏ(wrap) -0.1 giữa(wrap) 0.3
   áp út(support) 1.7 út(support) 5.4 lòng(press) -0.5 | — |
| `thu-chen@bowl along giữa (0,5)` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant side along 0.5
   lún 0.3 · xuyên -2.2 · nắm 1.5
   cái(wrap) 0.6 trỏ(wrap) 0.2 giữa(wrap) 0.3
   áp út(support) 0.2 út(support) 1.8 lòng(press) -0.3 | — |
| `thu-chen@bowl around 0` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant side along 0.3
   lún 0.4 · xuyên -1.2 · nắm -0.7
   cái(wrap) -0.4 trỏ(wrap) 0.1 giữa(wrap) 0.3
   áp út(support) 0.4 út(support) 4 lòng(press) -0.4 | — |
| `thu-chen@bowl around 45 (giới hạn cổ tay)` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant side along 0.4
   lún 0 · xuyên -2.4 · nắm -0.4 · cổ tay vượt 25.3°
   cái(wrap) 0.3 trỏ(wrap) 0.2 giữa(wrap) 0.3
   áp út(support) 1.4 út(support) 4.8 lòng(press) 2.4 | cổ tay vượt giới hạn — `cam` tay phải cầm thu-chen: xoay -55°/±90, gập 75°/±50, lệch 16°/±20 — vượt 25.3°, bàn tay vẽ lệch chỗ cầm 7.5 (chỗ cầm `thu-chen@bowl` (part body (mặc định), along 0.38 (rig chọn), variant side (mặc định), around 45)); đổi `edge` / `thumb` hay hướng món (`face` / `roll` của mốc món `thu-chen` ở `items`) ở giây 0.30 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-chen@bowl` (part body (mặc định), along 0.38 (rig chọn), variant side (mặc định), around 45) (dáng clasp) · khe 0.3 · ôm 3/3 (cái, trỏ, giữa–út) · ngón cái (wrap) 0.3, trỏ (wrap) 0.2, giữa (wrap) 0.3, áp út (support) 1.4, út (support) 4.8, lòng (press) 2.4 · tâm nắm trong món 0.4 · lòng tay cách 5.2 góc 19° · cổ tay xoay -55°, gập 75°, lệch 16° (vượt kẹp 25.3°, bàn tay lệch chỗ cầm 7.5) · khuỷu φ 80°. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-chen@bowl tay dẫn, miệng ngửa` | tay phải | t01-sakura | hàng mẫu (tay dẫn) | P: variant side along 0.3 (tay dẫn)
   lún 0.4 · xuyên -1.2 · nắm -0.7
   cái(wrap) -0.4 trỏ(wrap) 0.1 giữa(wrap) 0.3
   áp út(support) 0.4 út(support) 4 lòng(press) -0.4 | — |
| `thu-chen@bowl tay dẫn trái, miệng ngửa` | tay trái | t01-sakura | hàng mẫu (tay dẫn) | T: variant side along 0.3 (tay dẫn)
   lún 0.4 · xuyên -1.2 · nắm -0.7
   cái(wrap) -0.4 trỏ(wrap) 0.1 giữa(wrap) 0.3
   áp út(support) 0.4 út(support) 4 lòng(press) -0.4 | — |
| `thu-chen@bowl tay dẫn hai tay đỡ đáy` | hai tay | t01-sakura | hàng mẫu (tay dẫn) | P: variant side along 0.3 (tay dẫn)
   lún 0.4 · xuyên -1.2 · nắm -0.7
   cái(wrap) -0.4 trỏ(wrap) 0.1 giữa(wrap) 0.3
   áp út(support) 0.4 út(support) 4 lòng(press) -0.4<br>T: (không có báo của bộ giải)
   lún 0.2 · xuyên -1.7 · nắm -1.6
   cái(free) 2.2 trỏ(support) -0.2 giữa(support) 0
   áp út(support) 0 út(support) 0 lòng(press) 0.2 | — |
| `thu-chen@bowl hai tay (món đặt trước)` | hai tay | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant side along 0.3
   lún 0.4 · xuyên -1.2 · nắm -0.7
   cái(wrap) -0.4 trỏ(wrap) 0.1 giữa(wrap) 0.3
   áp út(support) 0.4 út(support) 4 lòng(press) -0.4<br>T: variant palm edge back along 0.5
   lún 0.2 · xuyên -1.6 · nắm -1.6
   cái(free) 2.2 trỏ(support) -0.2 giữa(support) 0
   áp út(support) 0 út(support) 0 lòng(press) 0.2 | cổ tay vượt giới hạn — `cam` tay trái cầm thu-chen: xoay -90°/±90, gập 3°/±50, lệch -3°/±20 — vượt 0.0°, bàn tay vẽ lệch chỗ cầm 0.0 (chỗ cầm `thu-chen@platform` (part body, edge back, along 0.5, variant palm (mặc định), psi 45 (rig chọn))); đổi `edge` / `thumb` hay hướng món (`face` / `roll` của mốc món `thu-chen` ở `items`) ở giây 0.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-chen@platform` (part body, edge back, along 0.5, variant palm (mặc định), psi 45 (rig chọn)) (dáng flat) · da lún 0.0 ở đầu ngón út · ôm 2/3 (trỏ, giữa–út, lòng) · ngón cái (free) 2.2, trỏ (support) -0.2, giữa (support) 0.0, áp út (support) 0.0, út (support) 0.0, lòng (press) 0.2 · tâm nắm trong món 1.6 · lòng tay cách 4.7 góc 78° · cổ tay xoay -90°, gập 3°, lệch -3° (vượt kẹp 0.0°, bàn tay lệch chỗ cầm 0.0) · khuỷu φ 23°. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held)<br>cổ tay sát giới hạn — `cam` tay phải cầm thu-chen: xoay -20°/±90, gập 15°/±50, lệch 15°/±20 — còn 4.8° tới kẹp (chỗ cầm `thu-chen@bowl` (part body (mặc định), along 0.25 (rig chọn), variant side (mặc định), around 300 (rig chọn))); đổi `edge` / `thumb` hay hướng món (`face` / `roll` của mốc món `thu-chen` ở `items`) ở giây 1.00 · giây 0.80–1.00. Lúc ấy: chỗ cầm `thu-chen@bowl` (part body (mặc định), along 0.25 (rig chọn), variant side (mặc định), around 300 (rig chọn)) (dáng clasp) · da lún 0.4 ở đầu ngón cái · ôm 3/3 (cái, trỏ, giữa–út, lòng) · ngón cái (wrap) -0.4, trỏ (wrap) 0.1, giữa (wrap) 0.3, áp út (support) 0.4, út (support) 4.0, lòng (press) -0.4 · tâm nắm trong món 0.7 · lòng tay cách 3.7 góc 57° · cổ tay xoay -20°, gập 15°, lệch 15° · khuỷu φ 18° · tay lấn 0.0 (bắp tay vào thân). Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-chen@bowl mặc định (side)` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant side along 0.3
   lún 0.3 · xuyên -2.5 · nắm -0.1
   cái(wrap) -0.2 trỏ(wrap) 0 giữa(wrap) 0.4
   áp út(support) 0.7 út(support) 4.8 lòng(press) -0.3 | — |
| `thu-chen@bowl along thấp (0,1)` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant side along 0.1
   lún 0.4 · xuyên -1.7 · nắm -1.5
   cái(wrap) -0.3 trỏ(wrap) -0.1 giữa(wrap) 0.4
   áp út(support) 2 út(support) 6.2 lòng(press) -0.4 | — |
| `thu-chen@bowl along giữa (0,5)` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant side along 0.5
   lún 0.3 · xuyên -2.5 · nắm 2.1
   cái(wrap) 0.9 trỏ(wrap) 0.1 giữa(wrap) 0.4
   áp út(support) 0.3 út(support) 2.6 lòng(press) -0.3 | — |
| `thu-chen@bowl around 0` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant side along 0.3
   lún 0.3 · xuyên -2.5 · nắm -0.1
   cái(wrap) -0.2 trỏ(wrap) 0 giữa(wrap) 0.4
   áp út(support) 0.7 út(support) 4.8 lòng(press) -0.3 | — |
| `thu-chen@bowl around 45 (giới hạn cổ tay)` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant side along 0.3
   lún 0 · xuyên -2.8 · nắm -1.2 · cổ tay vượt 14.1°
   cái(wrap) 0.2 trỏ(wrap) 0 giữa(wrap) 0
   áp út(support) 1.6 út(support) 5.6 lòng(press) 2.2 | cổ tay vượt giới hạn — `cam` tay phải cầm thu-chen: xoay -59°/±90, gập 64°/±50, lệch 18°/±20 — vượt 14.2°, bàn tay vẽ lệch chỗ cầm 4.9 (chỗ cầm `thu-chen@bowl` (part body (mặc định), along 0.25 (rig chọn), variant side (mặc định), around 45)); đổi `edge` / `thumb` hay hướng món (`face` / `roll` của mốc món `thu-chen` ở `items`) ở giây 0.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-chen@bowl` (part body (mặc định), along 0.25 (rig chọn), variant side (mặc định), around 45) (dáng clasp) · khe 0.0 · ôm 3/3 (cái, trỏ, giữa–út) · ngón cái (wrap) 0.3, trỏ (wrap) 0.0, giữa (wrap) 0.0, áp út (support) 1.6, út (support) 5.6, lòng (press) 2.2 · tâm nắm trong món 1.2 · lòng tay cách 5.4 góc 42° · cổ tay xoay -59°, gập 64°, lệch 18° (vượt kẹp 14.2°, bàn tay lệch chỗ cầm 4.9) · khuỷu φ 88°. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-chen@bowl tay dẫn, miệng ngửa` | tay phải | kuroiwa | hàng mẫu (tay dẫn) | P: variant side along 0.3 (tay dẫn)
   lún 0.3 · xuyên -2.5 · nắm -0.1
   cái(wrap) -0.2 trỏ(wrap) 0 giữa(wrap) 0.4
   áp út(support) 0.7 út(support) 4.8 lòng(press) -0.3 | — |
| `thu-chen@bowl tay dẫn trái, miệng ngửa` | tay trái | kuroiwa | hàng mẫu (tay dẫn) | T: variant side along 0.3 (tay dẫn)
   lún 0.3 · xuyên -2.5 · nắm -0.1
   cái(wrap) -0.2 trỏ(wrap) 0 giữa(wrap) 0.4
   áp út(support) 0.7 út(support) 4.8 lòng(press) -0.3 | — |
| `thu-chen@bowl tay dẫn hai tay đỡ đáy` | hai tay | kuroiwa | hàng mẫu (tay dẫn) | P: variant side along 0.3 (tay dẫn)
   lún 0.3 · xuyên -2.5 · nắm -0.1
   cái(wrap) -0.2 trỏ(wrap) 0 giữa(wrap) 0.4
   áp út(support) 0.7 út(support) 4.8 lòng(press) -0.3<br>T: (không có báo của bộ giải)
   lún 0.2 · xuyên -2 · nắm -2.2
   cái(free) 1.5 trỏ(support) 0.4 giữa(support) -0.2
   áp út(support) 0 út(support) 0 lòng(press) 0.1 | — |
| `thu-chen@bowl hai tay (món đặt trước)` | hai tay | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant side along 0.3
   lún 0.3 · xuyên -2.5 · nắm -0.1
   cái(wrap) -0.2 trỏ(wrap) 0 giữa(wrap) 0.4
   áp út(support) 0.7 út(support) 4.8 lòng(press) -0.3<br>T: variant palm edge back along 0.5
   lún 0.2 · xuyên -2 · nắm -2.1
   cái(free) 1.5 trỏ(support) 0.4 giữa(support) -0.2
   áp út(support) 0 út(support) 0 lòng(press) 0.1 | — |

## Bảng ảnh

- [`thu-chen`](thu-chen.jpg) — 18 hàng
