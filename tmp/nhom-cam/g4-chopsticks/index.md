# Bảng duyệt kiểu cầm

Rig `7.15.0` · giây 0.5 · người: `t01-sakura.json` (tay 1.61), `kuroiwa.json` (tay 2.16) · 10 hàng × 3 góc.
Số đo (đơn vị rig, góc độ): `lún` da lún sâu nhất vào món (âm là khe), `hở` ngón khai `wrap` còn cách món, `nắm` tâm nắm tới mặt món (âm là trong món), `lòng` khe/góc lòng tay (không đo với dáng kẹp `edge`, `pinch`, `hook`), `up`/`face` góc lệch ý định và khớp cổ tay kẹp, `tới` khe tay phụ hay `item:` tới đích; món treo: `quai` đỉnh quai tới chỗ treo, `khuỷu` góc gập/độ ngóc cẳng tay, `thân` khe thân món tới phần người gần nhất, `đẩy` góc lệch khỏi phương đứng. `!!` là luật `held` của `check` báo trên cảnh này.

Chỗ cầm nhóm: dòng đầu là lựa chọn rig giải (`variant`, `edge`, `along`, `thumb`…), dòng hai `lún` da lún sâu nhất vào món, `xuyên` trục nang tới mặt món (âm là còn ngoài), `nắm` tâm nắm tới hình, `cỡ` khối hình / `W` tay, `cổ tay vượt` độ vượt kẹp, `hở` ngón có vai trò chạm mà còn cách món; dòng ba là khe từng ngón tới món (âm là lún) và vai trò (`press`, `wrap`, `tip`, `support`, `free`).


| Món#kiểu | Tay | Người | Dáng lấy từ | Số đo | `check` |
|---|---|---|---|---|---|
| `thu-dua@chopsticks mặc định (grip)` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant grip part que along 0.4
   lún 0 · xuyên -2.6 · nắm -1.3
   hở trỏ 1.9
   cái(press) 0.1 trỏ(press) 1.9 giữa(support) 5.7
   áp út(support) 9.5 út(free) 14.1 lòng(free) 7.3 | ngón không chạm món — `cam` tay phải cầm thu-dua: ngón trỏ (`press`) cách món 1.9 (chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.38 (rig chọn), variant grip (mặc định))); dáng ngón của nhóm chưa khép tới món — đổi `variant` hay `edge`, không thì là việc của dáng nhóm ở rig ở giây 1.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.38 (rig chọn), variant grip (mặc định)) (dáng chopsticks) · khe 0.1 · ôm 1/3 (cái) · ngón cái (press) 0.1, trỏ (press) 1.9, giữa (support) 5.7, áp út (support) 9.5, út (free) 14.1, lòng (free) 7.3 · tâm nắm trong món 1.3 · lòng tay cách 11.5 góc 32° · cổ tay xoay -64°, gập -8°, lệch -2° · khuỷu φ -130°. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-dua@chopsticks along thấp (0,15)` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant grip part que along 0.2
   lún 0 · xuyên -2.8 · nắm -0.9
   hở trỏ 1.8
   cái(press) 0.4 trỏ(press) 1.8 giữa(support) 5.5
   áp út(support) 9.3 út(free) 14 lòng(free) 7.4 | ngón không chạm món — `cam` tay phải cầm thu-dua: ngón trỏ (`press`) cách món 1.8 (chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.15, variant grip (mặc định))); dáng ngón của nhóm chưa khép tới món — đổi `variant` hay `edge`, không thì là việc của dáng nhóm ở rig ở giây 0.20 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.15, variant grip (mặc định)) (dáng chopsticks) · khe 0.4 · ôm 1/3 (cái) · ngón cái (press) 0.4, trỏ (press) 1.8, giữa (support) 5.5, áp út (support) 9.3, út (free) 14.0, lòng (free) 7.4 · tâm nắm trong món 0.9 · lòng tay cách 11.5 góc 30° · cổ tay xoay -70°, gập -8°, lệch 11° · khuỷu φ -117°. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-dua@chopsticks along cao (0,45)` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant grip part que along 0.5
   lún 0 · xuyên -2.5 · nắm -1.4
   hở trỏ 2
   cái(press) 0 trỏ(press) 2 giữa(support) 5.7
   áp út(support) 9.6 út(free) 14.2 lòng(free) 7.3 | ngón không chạm món — `cam` tay phải cầm thu-dua: ngón trỏ (`press`) cách món 2.0 (chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.45, variant grip (mặc định))); dáng ngón của nhóm chưa khép tới món — đổi `variant` hay `edge`, không thì là việc của dáng nhóm ở rig ở giây 0.10 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.45, variant grip (mặc định)) (dáng chopsticks) · khe 0.0 · ôm 1/3 (cái) · ngón cái (press) 0.0, trỏ (press) 2.0, giữa (support) 5.7, áp út (support) 9.6, út (free) 14.2, lòng (free) 7.3 · tâm nắm trong món 1.4 · lòng tay cách 11.5 góc 33° · cổ tay xoay -61°, gập -7°, lệch -3° · khuỷu φ -132°. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-dua@chopsticks tay dẫn` | tay phải | t01-sakura | hàng mẫu (tay dẫn) | P: variant grip part que along 0.3 (tay dẫn)
   lún 0 · xuyên -2.7 · nắm -1.1
   hở trỏ 1.9
   cái(press) 0.3 trỏ(press) 1.9 giữa(support) 5.6
   áp út(support) 9.4 út(free) 14 lòng(free) 7.4 | ngón không chạm món — `cam` tay phải cầm thu-dua: ngón trỏ (`press`) cách món 1.9 (chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.25 (mặc định), variant grip (mặc định))); dáng ngón của nhóm chưa khép tới món — đổi `variant` hay `edge`, không thì là việc của dáng nhóm ở rig ở giây 0.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.25 (mặc định), variant grip (mặc định)) (dáng chopsticks) · khe 0.3 · ôm 1/3 (cái) · ngón cái (press) 0.3, trỏ (press) 1.9, giữa (support) 5.6, áp út (support) 9.4, út (free) 14.0, lòng (free) 7.4 · tâm nắm trong món 1.1 · lòng tay cách 11.5 góc 31° · ý định về forward lệch 9° (kẹp bend, dev). Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-dua@chopsticks tay dẫn trái` | tay trái | t01-sakura | hàng mẫu (tay dẫn) | T: variant grip part que along 0.3 (tay dẫn)
   lún 0 · xuyên -2.7 · nắm -1.1
   hở trỏ 1.9
   cái(press) 0.3 trỏ(press) 1.9 giữa(support) 5.6
   áp út(support) 9.4 út(free) 14 lòng(free) 7.4 | ngón không chạm món — `cam` tay trái cầm thu-dua: ngón trỏ (`press`) cách món 1.9 (chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.25 (mặc định), variant grip (mặc định))); dáng ngón của nhóm chưa khép tới món — đổi `variant` hay `edge`, không thì là việc của dáng nhóm ở rig ở giây 0.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.25 (mặc định), variant grip (mặc định)) (dáng chopsticks) · khe 0.3 · ôm 1/3 (cái) · ngón cái (press) 0.3, trỏ (press) 1.9, giữa (support) 5.6, áp út (support) 9.4, út (free) 14.0, lòng (free) 7.4 · tâm nắm trong món 1.1 · lòng tay cách 11.5 góc 31° · ý định về forward lệch 9° (kẹp bend, dev). Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-dua@chopsticks mặc định (grip)` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant grip part que along 0.4
   lún 0.3 · xuyên -2.6 · nắm -1.3
   hở trỏ 2.4
   cái(press) -0.3 trỏ(press) 2.4 giữa(support) 6.9
   áp út(support) 11.4 út(free) 16.7 lòng(free) 8.5 | ngón không chạm món — `cam` tay phải cầm thu-dua: ngón trỏ (`press`) cách món 2.4 (chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.38 (rig chọn), variant grip (mặc định))); dáng ngón của nhóm chưa khép tới món — đổi `variant` hay `edge`, không thì là việc của dáng nhóm ở rig ở giây 0.40 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.38 (rig chọn), variant grip (mặc định)) (dáng chopsticks) · da lún 0.3 ở đầu ngón cái · ôm 1/3 (cái) · ngón cái (press) -0.3, trỏ (press) 2.4, giữa (support) 6.9, áp út (support) 11.4, út (free) 16.7, lòng (free) 8.5 · tâm nắm trong món 1.3 · lòng tay cách 13.4 góc 36° · cổ tay xoay -67°, gập -7°, lệch -1° · khuỷu φ -127° · tay lấn 1.1 (bắp tay vào đầu). Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-dua@chopsticks along thấp (0,15)` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant grip part que along 0.2
   lún 0.1 · xuyên -2.8 · nắm -0.9
   hở trỏ 2.4
   cái(press) -0.1 trỏ(press) 2.4 giữa(support) 6.7
   áp út(support) 11.2 út(free) 16.5 lòng(free) 9.1 | ngón không chạm món — `cam` tay phải cầm thu-dua: ngón trỏ (`press`) cách món 2.4 (chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.15, variant grip (mặc định))); dáng ngón của nhóm chưa khép tới món — đổi `variant` hay `edge`, không thì là việc của dáng nhóm ở rig ở giây 0.80 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.15, variant grip (mặc định)) (dáng chopsticks) · da lún 0.1 ở đầu ngón cái · ôm 1/3 (cái) · ngón cái (press) -0.1, trỏ (press) 2.4, giữa (support) 6.7, áp út (support) 11.2, út (free) 16.5, lòng (free) 9.1 · tâm nắm trong món 0.9 · lòng tay cách 13.4 góc 34° · cổ tay xoay -71°, gập -3°, lệch 8° · khuỷu φ -120°. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-dua@chopsticks along cao (0,45)` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant grip part que along 0.5
   lún 0.4 · xuyên -2.5 · nắm -1.4
   hở trỏ 2.5
   cái(press) -0.4 trỏ(press) 2.5 giữa(support) 6.9
   áp út(support) 11.5 út(free) 16.7 lòng(free) 8.5 | ngón không chạm món — `cam` tay phải cầm thu-dua: ngón trỏ (`press`) cách món 2.5 (chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.45, variant grip (mặc định))); dáng ngón của nhóm chưa khép tới món — đổi `variant` hay `edge`, không thì là việc của dáng nhóm ở rig ở giây 0.80 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.45, variant grip (mặc định)) (dáng chopsticks) · da lún 0.4 ở đầu ngón cái · ôm 1/3 (cái) · ngón cái (press) -0.4, trỏ (press) 2.5, giữa (support) 6.9, áp út (support) 11.5, út (free) 16.7, lòng (free) 8.5 · tâm nắm trong món 1.4 · lòng tay cách 13.4 góc 36° · cổ tay xoay -66°, gập -7°, lệch -3° · khuỷu φ -130°. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-dua@chopsticks tay dẫn` | tay phải | kuroiwa | hàng mẫu (tay dẫn) | P: variant grip part que along 0.3 (tay dẫn)
   lún 0.2 · xuyên -2.7 · nắm -1.1
   hở trỏ 2.4
   cái(press) -0.2 trỏ(press) 2.4 giữa(support) 6.8
   áp út(support) 11.3 út(free) 16.6 lòng(free) 8.5 | ngón không chạm món — `cam` tay phải cầm thu-dua: ngón trỏ (`press`) cách món 2.4 (chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.25 (mặc định), variant grip (mặc định))); dáng ngón của nhóm chưa khép tới món — đổi `variant` hay `edge`, không thì là việc của dáng nhóm ở rig ở giây 0.60 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.25 (mặc định), variant grip (mặc định)) (dáng chopsticks) · da lún 0.2 ở đầu ngón cái · ôm 1/3 (cái) · ngón cái (press) -0.2, trỏ (press) 2.4, giữa (support) 6.8, áp út (support) 11.3, út (free) 16.6, lòng (free) 8.5 · tâm nắm trong món 1.1 · lòng tay cách 13.4 góc 35° · ý định về forward lệch 19° (kẹp bend, dev). Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-dua@chopsticks tay dẫn trái` | tay trái | kuroiwa | hàng mẫu (tay dẫn) | T: variant grip part que along 0.3 (tay dẫn)
   lún 0.2 · xuyên -2.7 · nắm -1.1
   hở trỏ 2.4
   cái(press) -0.2 trỏ(press) 2.4 giữa(support) 6.8
   áp út(support) 11.3 út(free) 16.6 lòng(free) 8.5 | ngón không chạm món — `cam` tay trái cầm thu-dua: ngón trỏ (`press`) cách món 2.4 (chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.25 (mặc định), variant grip (mặc định))); dáng ngón của nhóm chưa khép tới món — đổi `variant` hay `edge`, không thì là việc của dáng nhóm ở rig ở giây 0.50 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-dua@chopsticks` (part que (mặc định), along 0.25 (mặc định), variant grip (mặc định)) (dáng chopsticks) · da lún 0.2 ở đầu ngón cái · ôm 1/3 (cái) · ngón cái (press) -0.2, trỏ (press) 2.4, giữa (support) 6.8, áp út (support) 11.3, út (free) 16.6, lòng (free) 8.5 · tâm nắm trong món 1.1 · lòng tay cách 13.4 góc 35° · ý định về forward lệch 19° (kẹp bend, dev). Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |

## Bảng ảnh

- [`thu-dua`](thu-dua.jpg) — 10 hàng
