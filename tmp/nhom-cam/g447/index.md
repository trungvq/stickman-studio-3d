# Bảng duyệt kiểu cầm

Rig `7.15.0` · giây 0.5 · người: `t01-sakura.json` (tay 1.61), `kuroiwa.json` (tay 2.16) · 26 hàng × 3 góc.
Số đo (đơn vị rig, góc độ): `lún` da lún sâu nhất vào món (âm là khe), `hở` ngón khai `wrap` còn cách món, `nắm` tâm nắm tới mặt món (âm là trong món), `lòng` khe/góc lòng tay (không đo với dáng kẹp `edge`, `pinch`, `hook`), `up`/`face` góc lệch ý định và khớp cổ tay kẹp, `tới` khe tay phụ hay `item:` tới đích; món treo: `quai` đỉnh quai tới chỗ treo, `khuỷu` góc gập/độ ngóc cẳng tay, `thân` khe thân món tới phần người gần nhất, `đẩy` góc lệch khỏi phương đứng. `!!` là luật `held` của `check` báo trên cảnh này.

Chỗ cầm nhóm: dòng đầu là lựa chọn rig giải (`variant`, `edge`, `along`, `thumb`…), dòng hai `lún` da lún sâu nhất vào món, `xuyên` trục nang tới mặt món (âm là còn ngoài), `nắm` tâm nắm tới hình, `cỡ` khối hình / `W` tay, `cổ tay vượt` độ vượt kẹp, `hở` ngón có vai trò chạm mà còn cách món; dòng ba là khe từng ngón tới món (âm là lún) và vai trò (`press`, `wrap`, `tip`, `support`, `free`).

Bỏ (giải ra cùng chỗ cầm, cùng vị trí món với hàng trước):
- `thu-chai-dia@cylinder along thấp` t01-sakura: giống `bang-cam-thu-chai-dia-cylinder-mac-dinh-P-t01-sakura`
- `thu-chai-dia@cylinder along thấp` kuroiwa: giống `bang-cam-thu-chai-dia-cylinder-mac-dinh-P-kuroiwa`
- `thu-ong-nghe-ban@cylinder along cao` t01-sakura: giống `bang-cam-thu-ong-nghe-ban-cylinder-mac-dinh-P-t01-sakura`
- `thu-ong-nghe-ban@cylinder ngón cái xuống` t01-sakura: giống `bang-cam-thu-ong-nghe-ban-cylinder-mac-dinh-P-t01-sakura`
- `thu-ong-nghe-ban@cylinder along cao` kuroiwa: giống `bang-cam-thu-ong-nghe-ban-cylinder-mac-dinh-P-kuroiwa`
- `thu-ong-nghe-ban@cylinder ngón cái xuống` kuroiwa: giống `bang-cam-thu-ong-nghe-ban-cylinder-mac-dinh-P-kuroiwa`
- `thu-chai-dac-tuyen@cylinder along thấp` t01-sakura: giống `bang-cam-thu-chai-dac-tuyen-cylinder-mac-dinh-P-t01-sakura`
- `thu-chai-dac-tuyen@cylinder along thấp` kuroiwa: giống `bang-cam-thu-chai-dac-tuyen-cylinder-mac-dinh-P-kuroiwa`


| Món#kiểu | Tay | Người | Dáng lấy từ | Số đo | `check` |
|---|---|---|---|---|---|
| `thu-chai-dia@cylinder mặc định (wrap)` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant wrap part than along 0.3 thumb up
   lún 0.1 · xuyên -1.7 · nắm -2 · cỡ 0.69·W
   cái(wrap) -0.1 trỏ(wrap) 0 giữa(wrap) 0
   áp út(wrap) 0 út(wrap) -0.1 lòng(press) 0.6 | — |
| `thu-chai-dia@cylinder along cao` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant wrap part than along 0.8 thumb up
   lún 0.1 · xuyên -1.8 · nắm -1 · cỡ 0.69·W
   cái(wrap) 0 trỏ(wrap) -0.1 giữa(wrap) 0
   áp út(wrap) 0 út(wrap) 0 lòng(press) 0.9 | — |
| `thu-chai-dia@cylinder ngón cái xuống` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant wrap part than along 0.8 thumb down
   lún 0.3 · xuyên -1.8 · nắm 1.7 · cỡ 0.69·W
   cái(wrap) -0.1 trỏ(wrap) 0.1 giữa(wrap) 0
   áp út(wrap) 0 út(wrap) -0.3 lòng(press) 0.6 | — |
| `thu-chai-dia@cylinder nắm phần vai` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant wrap part vai along 0.7 thumb up
   lún 0.1 · xuyên -1.8 · nắm -1.1 · cỡ 0.69·W
   cái(wrap) 0 trỏ(wrap) -0.1 giữa(wrap) 0.1
   áp út(wrap) 0 út(wrap) 0 lòng(press) 0.9 | — |
| `thu-chai-dia@cylinder nắm phần co` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant wrap part co along 0.9 thumb up
   lún 0.3 · xuyên -1.7 · nắm -1.1 · cỡ 0.3·W
   cái(wrap) 0.4 trỏ(wrap) -0.1 giữa(wrap) -0.1
   áp út(wrap) -0.1 út(wrap) -0.3 lòng(press) 0.4 | — |
| `thu-chai-dia@cylinder mặc định (wrap)` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant wrap part than along 0.3 thumb up
   lún 0.2 · xuyên -2 · nắm -1 · cỡ 0.61·W
   cái(wrap) -0.2 trỏ(wrap) 0 giữa(wrap) 0
   áp út(wrap) 0 út(wrap) -0.1 lòng(press) 0.5 | — |
| `thu-chai-dia@cylinder along cao` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant wrap part than along 0.8 thumb up
   lún 0.1 · xuyên -2.1 · nắm -1 · cỡ 0.61·W
   cái(wrap) -0.1 trỏ(wrap) 0 giữa(wrap) 0
   áp út(wrap) 0 út(wrap) -0.1 lòng(press) 1.1 | — |
| `thu-chai-dia@cylinder ngón cái xuống` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant wrap part than along 0.8 thumb down
   lún 0.2 · xuyên -2.1 · nắm 2.1 · cỡ 0.61·W
   cái(wrap) -0.2 trỏ(wrap) 0 giữa(wrap) 0
   áp út(wrap) -0.1 út(wrap) -0.1 lòng(press) 0.5 | — |
| `thu-chai-dia@cylinder nắm phần vai` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant wrap part vai along 0.7 thumb up
   lún 0.1 · xuyên -2.1 · nắm -1.1 · cỡ 0.61·W
   cái(wrap) -0.1 trỏ(wrap) 0 giữa(wrap) 0
   áp út(wrap) 0 út(wrap) 0 lòng(press) 1 | — |
| `thu-chai-dia@cylinder nắm phần co` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant wrap part co along 0.9 thumb up
   lún 0.4 · xuyên -2 · nắm -0.8 · cỡ 0.26·W
   cái(wrap) 0.7 trỏ(wrap) 0.2 giữa(wrap) -0.1
   áp út(wrap) -0.2 út(wrap) -0.4 lòng(press) 1 | — |
| `thu-ong-nghe-ban@cylinder mặc định (wrap)` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant wrap part tay along 0.8 thumb down
   lún 0.7 · xuyên -0.9 · nắm 1.4 · cỡ 0.61·W · cổ tay vượt 20°
   cái(wrap) 0.1 trỏ(wrap) -0.1 giữa(wrap) -0.7
   áp út(wrap) 0 út(wrap) -0.4 lòng(press) 1 | cổ tay vượt giới hạn — `cam` tay phải cầm thu-ong-nghe-ban: xoay 111°/±90, gập -1°/±50, lệch -11°/±20 — vượt 20.6°, bàn tay vẽ lệch chỗ cầm 2.0 (chỗ cầm `thu-ong-nghe-ban@cylinder` (part tay (mặc định), along 0.75 (rig chọn), thumb down (rig chọn), variant wrap (mặc định), around 150 (rig chọn))); đổi `edge` / `thumb` hay hướng món (`face` / `roll` của mốc món `thu-ong-nghe-ban` ở `items`) ở giây 1.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-ong-nghe-ban@cylinder` (part tay (mặc định), along 0.75 (rig chọn), thumb down (rig chọn), variant wrap (mặc định), around 150 (rig chọn)) (dáng fist) · da lún 0.7 ở đầu ngón giữa · ôm 3/3 (cái, trỏ, giữa–út, lòng) · ngón cái (wrap) 0.1, trỏ (wrap) -0.1, giữa (wrap) -0.7, áp út (wrap) 0.0, út (wrap) -0.4, lòng (press) 0.9 · tâm nắm cách món 1.4 · lòng tay cách 2.6 góc 21° · cổ tay xoay 111°, gập -1°, lệch -11° (vượt kẹp 20.6°, bàn tay lệch chỗ cầm 2.0) · khuỷu φ 93° · cỡ 9.0 = 0.61 · W. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held)<br>da lún vào món — `cam` tay phải cầm thu-ong-nghe-ban: lún 0.7 (quá 0.7) (chỗ cầm `thu-ong-nghe-ban@cylinder` (part tay (mặc định), along 0.75 (rig chọn), thumb down (rig chọn), variant wrap (mặc định), around 150 (rig chọn))); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là việc của dáng nhóm ở rig ở giây 1.00 · giây 0.40–1.00. Lúc ấy: chỗ cầm `thu-ong-nghe-ban@cylinder` (part tay (mặc định), along 0.75 (rig chọn), thumb down (rig chọn), variant wrap (mặc định), around 150 (rig chọn)) (dáng fist) · da lún 0.7 ở đầu ngón giữa · ôm 3/3 (cái, trỏ, giữa–út, lòng) · ngón cái (wrap) 0.1, trỏ (wrap) -0.1, giữa (wrap) -0.7, áp út (wrap) 0.0, út (wrap) -0.4, lòng (press) 0.9 · tâm nắm cách món 1.4 · lòng tay cách 2.6 góc 21° · cổ tay xoay 111°, gập -1°, lệch -11° (vượt kẹp 20.6°, bàn tay lệch chỗ cầm 2.0) · khuỷu φ 93° · cỡ 9.0 = 0.61 · W. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-ong-nghe-ban@cylinder along thấp` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant wrap part tay along 0.3 thumb down
   lún 0.5 · xuyên -1.5 · nắm 1 · cỡ 0.61·W · cổ tay vượt 28.6°
   cái(wrap) 0.4 trỏ(wrap) -0.5 giữa(wrap) -0.1
   áp út(wrap) 0.1 út(wrap) 0 lòng(press) -0.2 | cổ tay vượt giới hạn — `cam` tay phải cầm thu-ong-nghe-ban: xoay 119°/±90, gập -1°/±50, lệch -18°/±20 — vượt 29.0°, bàn tay vẽ lệch chỗ cầm 3.3 (chỗ cầm `thu-ong-nghe-ban@cylinder` (part tay (mặc định), along 0.25, thumb down (rig chọn), variant wrap (mặc định), around 150 (rig chọn))); đổi `edge` / `thumb` hay hướng món (`face` / `roll` của mốc món `thu-ong-nghe-ban` ở `items`) ở giây 1.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-ong-nghe-ban@cylinder` (part tay (mặc định), along 0.25, thumb down (rig chọn), variant wrap (mặc định), around 150 (rig chọn)) (dáng fist) · da lún 0.6 ở đầu ngón trỏ · ôm 3/3 (cái, trỏ, giữa–út, lòng) · ngón cái (wrap) 0.4, trỏ (wrap) -0.6, giữa (wrap) -0.1, áp út (wrap) 0.2, út (wrap) -0.1, lòng (press) -0.2 · tâm nắm cách món 1.0 · lòng tay cách 2.2 góc 29° · cổ tay xoay 119°, gập -1°, lệch -18° (vượt kẹp 29.0°, bàn tay lệch chỗ cầm 3.3) · khuỷu φ 95° · cỡ 9.0 = 0.61 · W. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-ong-nghe-ban@cylinder áp tai` | tay trái | t01-sakura | hàng mẫu (tay dẫn) | T: variant wrap part tay along 0.5 thumb up (tay dẫn)
   lún 0.3 · xuyên -1.7 · nắm 0.5 · cỡ 0.61·W
   cái(wrap) 0 trỏ(wrap) -0.2 giữa(wrap) 0.3
   áp út(wrap) -0.3 út(wrap) 0 lòng(press) 0.5 | — |
| `thu-ong-nghe-ban@cylinder mặc định (wrap)` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant wrap part tay along 0.8 thumb down
   lún 0.6 · xuyên -1.7 · nắm 2 · cỡ 0.54·W · cổ tay vượt 19.5°
   cái(wrap) 0.1 trỏ(wrap) 0 giữa(wrap) -0.6
   áp út(wrap) 0 út(wrap) -0.2 lòng(press) 1 | cổ tay vượt giới hạn — `cam` tay phải cầm thu-ong-nghe-ban: xoay 110°/±90, gập 8°/±50, lệch -10°/±20 — vượt 20.0°, bàn tay vẽ lệch chỗ cầm 2.9 (chỗ cầm `thu-ong-nghe-ban@cylinder` (part tay (mặc định), along 0.75 (rig chọn), thumb down (rig chọn), variant wrap (mặc định), around 150 (rig chọn))); đổi `edge` / `thumb` hay hướng món (`face` / `roll` của mốc món `thu-ong-nghe-ban` ở `items`) ở giây 1.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-ong-nghe-ban@cylinder` (part tay (mặc định), along 0.75 (rig chọn), thumb down (rig chọn), variant wrap (mặc định), around 150 (rig chọn)) (dáng fist) · da lún 0.1 ở đầu ngón út · ôm 3/3 (cái, trỏ, giữa–út) · ngón cái (wrap) 0.2, trỏ (wrap) 0.0, giữa (wrap) -0.1, áp út (wrap) 0.0, út (wrap) -0.1, lòng (press) 1.0 · tâm nắm cách món 2.0 · lòng tay cách 2.8 góc 20° · cổ tay xoay 110°, gập 8°, lệch -10° (vượt kẹp 20.0°, bàn tay lệch chỗ cầm 2.9) · khuỷu φ 93° · cỡ 9.0 = 0.54 · W. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-ong-nghe-ban@cylinder along thấp` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant wrap part tay along 0.3 thumb down
   lún 0.2 · xuyên -2.2 · nắm 1.4 · cỡ 0.54·W · cổ tay vượt 26.9°
   cái(wrap) 0.4 trỏ(wrap) -0.2 giữa(wrap) 0.2
   áp út(wrap) 0.4 út(wrap) 0.1 lòng(press) 0 | cổ tay vượt giới hạn — `cam` tay phải cầm thu-ong-nghe-ban: xoay 117°/±90, gập 8°/±50, lệch -17°/±20 — vượt 27.3°, bàn tay vẽ lệch chỗ cầm 4.3 (chỗ cầm `thu-ong-nghe-ban@cylinder` (part tay (mặc định), along 0.25, thumb down (rig chọn), variant wrap (mặc định), around 150 (rig chọn))); đổi `edge` / `thumb` hay hướng món (`face` / `roll` của mốc món `thu-ong-nghe-ban` ở `items`) ở giây 1.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-ong-nghe-ban@cylinder` (part tay (mặc định), along 0.25, thumb down (rig chọn), variant wrap (mặc định), around 150 (rig chọn)) (dáng fist) · da lún 0.2 ở đầu ngón trỏ · ôm 3/3 (cái, trỏ, giữa–út, lòng) · ngón cái (wrap) 0.4, trỏ (wrap) -0.2, giữa (wrap) 0.2, áp út (wrap) 0.4, út (wrap) 0.1, lòng (press) -0.1 · tâm nắm cách món 1.4 · lòng tay cách 2.5 góc 27° · cổ tay xoay 117°, gập 8°, lệch -17° (vượt kẹp 27.3°, bàn tay lệch chỗ cầm 4.3) · khuỷu φ 95° · cỡ 9.0 = 0.54 · W. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-ong-nghe-ban@cylinder áp tai` | tay trái | kuroiwa | hàng mẫu (tay dẫn) | T: variant wrap part tay along 0.5 thumb up (tay dẫn)
   lún 0.7 · xuyên -1.3 · nắm 1.5 · cỡ 0.54·W
   cái(wrap) -0.2 trỏ(wrap) -0.1 giữa(wrap) 0
   áp út(wrap) -0.3 út(wrap) -0.7 lòng(press) 0.6 | da lún vào món — `cam` tay trái cầm thu-ong-nghe-ban: lún 0.7 (quá 0.7) (chỗ cầm `thu-ong-nghe-ban@cylinder` (part tay (mặc định), along 0.5 (mặc định), thumb up (mặc định), variant wrap (mặc định), around 180)); ngón ôm không gỡ được — đổi `variant` / `slant`, không thì là việc của dáng nhóm ở rig ở giây 0.50 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-ong-nghe-ban@cylinder` (part tay (mặc định), along 0.5 (mặc định), thumb up (mặc định), variant wrap (mặc định), around 180) (dáng fist) · da lún 0.7 ở đầu ngón út · ôm 3/3 (cái, trỏ, giữa–út, lòng) · ngón cái (wrap) -0.2, trỏ (wrap) -0.1, giữa (wrap) 0.0, áp út (wrap) -0.3, út (wrap) -0.7, lòng (press) 0.6 · tâm nắm cách món 1.5 · lòng tay cách 3.0 góc 0° · ý định về head lệch 0° (kẹp turn, dev) · cỡ 9.0 = 0.54 · W. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-chai-dac-tuyen@cylinder mặc định (wrap)` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant wrap part than along 0.3 thumb up
   lún 0.1 · xuyên -1.7 · nắm -2.3 · cỡ 0.9·W
   cái(wrap) -0.1 trỏ(wrap) 0 giữa(wrap) 0.1
   áp út(wrap) 0 út(wrap) 0.1 lòng(press) 0.6 | món quá cỡ tay — `cam` tay phải cầm thu-chai-dac-tuyen: khối hình đã chọn cỡ 13.2 = 0.90 · W (W 14.7, từ 0.8 · W nắm không kín) (chỗ cầm `thu-chai-dac-tuyen@cylinder` (part than (rig chọn), along 0.25 (rig chọn), thumb up (rig chọn), variant wrap (mặc định), around 300 (rig chọn))); khai `part` khác hay cầm hai tay (`both`) ở giây 0.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-chai-dac-tuyen@cylinder` (part than (rig chọn), along 0.25 (rig chọn), thumb up (rig chọn), variant wrap (mặc định), around 300 (rig chọn)) (dáng fist) · khe 0.1 · ôm 3/3 (cái, trỏ, giữa–út, lòng) · ngón cái (wrap) -0.1, trỏ (wrap) 0.0, giữa (wrap) 0.1, áp út (wrap) 0.0, út (wrap) 0.1, lòng (press) 0.6 · tâm nắm trong món 2.3 · lòng tay cách 1.4 góc 21° · cổ tay xoay -24°, gập -1°, lệch -3° · khuỷu φ 33° · cỡ 13.2 = 0.90 · W. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-chai-dac-tuyen@cylinder along cao` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant wrap part than along 0.8 thumb up
   lún 0.1 · xuyên -1.8 · nắm -1.9 · cỡ 0.9·W
   cái(wrap) -0.1 trỏ(wrap) 0 giữa(wrap) 0.1
   áp út(wrap) 0.1 út(wrap) 0.1 lòng(press) 0.8 | món quá cỡ tay — `cam` tay phải cầm thu-chai-dac-tuyen: khối hình đã chọn cỡ 13.2 = 0.90 · W (W 14.7, từ 0.8 · W nắm không kín) (chỗ cầm `thu-chai-dac-tuyen@cylinder` (part than (rig chọn), along 0.75, thumb up (rig chọn), variant wrap (mặc định), around 330 (rig chọn))); khai `part` khác hay cầm hai tay (`both`) ở giây 0.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-chai-dac-tuyen@cylinder` (part than (rig chọn), along 0.75, thumb up (rig chọn), variant wrap (mặc định), around 330 (rig chọn)) (dáng fist) · khe 0.1 · ôm 3/3 (cái, trỏ, giữa–út, lòng) · ngón cái (wrap) -0.1, trỏ (wrap) 0.0, giữa (wrap) 0.1, áp út (wrap) 0.1, út (wrap) 0.1, lòng (press) 0.8 · tâm nắm trong món 1.9 · lòng tay cách 2.4 góc 19° · cổ tay xoay -49°, gập -2°, lệch -4° · khuỷu φ 85° · cỡ 13.2 = 0.90 · W. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-chai-dac-tuyen@cylinder ngón cái xuống` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant wrap part than along 0.8 thumb down
   lún 0.1 · xuyên -1.7 · nắm 0.7 · cỡ 0.9·W
   cái(wrap) 0 trỏ(wrap) 0.1 giữa(wrap) 0.2
   áp út(wrap) 0 út(wrap) -0.1 lòng(press) 0.6 | món quá cỡ tay — `cam` tay phải cầm thu-chai-dac-tuyen: khối hình đã chọn cỡ 13.2 = 0.90 · W (W 14.7, từ 0.8 · W nắm không kín) (chỗ cầm `thu-chai-dac-tuyen@cylinder` (part than (rig chọn), along 0.75 (rig chọn), thumb down, variant wrap (mặc định), around 180 (rig chọn))); khai `part` khác hay cầm hai tay (`both`) ở giây 0.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-chai-dac-tuyen@cylinder` (part than (rig chọn), along 0.75 (rig chọn), thumb down, variant wrap (mặc định), around 180 (rig chọn)) (dáng fist) · da lún 0.1 ở đầu ngón út · ôm 3/3 (cái, trỏ, giữa–út, lòng) · ngón cái (wrap) 0.0, trỏ (wrap) 0.1, giữa (wrap) 0.2, áp út (wrap) 0.0, út (wrap) -0.1, lòng (press) 0.6 · tâm nắm cách món 0.7 · lòng tay cách 2.3 góc 27° · cổ tay xoay 59°, gập 2°, lệch 0° · khuỷu φ 88° · cỡ 13.2 = 0.90 · W. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-chai-dac-tuyen@cylinder nắm phần vai` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant wrap part vai along 0.8 thumb up
   lún 0.5 · xuyên -2.1 · nắm -0.4 · cỡ 0.9·W
   hở út 3.4
   cái(wrap) -0.5 trỏ(wrap) 0 giữa(wrap) 0.1
   áp út(wrap) 0 út(wrap) 3.4 lòng(press) 1.4 | ngón không chạm món — `cam` tay phải cầm thu-chai-dac-tuyen: ngón út (`wrap`) cách món 3.4 (chỗ cầm `thu-chai-dac-tuyen@cylinder` (part vai, along 0.79, thumb up (rig chọn), variant wrap (mặc định), around 330 (rig chọn))); dáng ngón của nhóm chưa khép tới món — đổi `variant` hay `edge`, không thì là việc của dáng nhóm ở rig ở giây 0.10 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-chai-dac-tuyen@cylinder` (part vai, along 0.79, thumb up (rig chọn), variant wrap (mặc định), around 330 (rig chọn)) (dáng fist) · khe 0.0 · ôm 3/3 (cái, trỏ, giữa–út) · ngón cái (wrap) -0.5, trỏ (wrap) 0.0, giữa (wrap) 0.1, áp út (wrap) 0.0, út (wrap) 3.4, lòng (press) 1.4 · tâm nắm trong món 0.4 · lòng tay cách 3.9 góc 19° · cổ tay xoay -44°, gập -1°, lệch -5° · khuỷu φ 88° · cỡ 13.2 = 0.90 · W. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held)<br>món quá cỡ tay — `cam` tay phải cầm thu-chai-dac-tuyen: khối hình đã chọn cỡ 13.2 = 0.90 · W (W 14.7, từ 0.8 · W nắm không kín) (chỗ cầm `thu-chai-dac-tuyen@cylinder` (part vai, along 0.79, thumb up (rig chọn), variant wrap (mặc định), around 330 (rig chọn))); khai `part` khác hay cầm hai tay (`both`) ở giây 0.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-chai-dac-tuyen@cylinder` (part vai, along 0.79, thumb up (rig chọn), variant wrap (mặc định), around 330 (rig chọn)) (dáng fist) · khe 0.0 · ôm 3/3 (cái, trỏ, giữa–út) · ngón cái (wrap) -0.5, trỏ (wrap) 0.0, giữa (wrap) 0.1, áp út (wrap) 0.0, út (wrap) 3.4, lòng (press) 1.4 · tâm nắm trong món 0.4 · lòng tay cách 3.9 góc 19° · cổ tay xoay -44°, gập -1°, lệch -5° · khuỷu φ 88° · cỡ 13.2 = 0.90 · W. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-chai-dac-tuyen@cylinder nắm phần co` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant wrap part co along 0.9 thumb up
   lún 0.5 · xuyên -1.5 · nắm -0.7 · cỡ 0.35·W · cổ tay vượt 0.5°
   cái(wrap) 0.1 trỏ(wrap) 0 giữa(wrap) -0.1
   áp út(wrap) -0.1 út(wrap) -0.5 lòng(press) 0.5 | cổ tay vượt giới hạn — `cam` tay phải cầm thu-chai-dac-tuyen: xoay -91°/±90, gập -10°/±50, lệch -4°/±20 — vượt 0.8°, bàn tay vẽ lệch chỗ cầm 0.0 (chỗ cầm `thu-chai-dac-tuyen@cylinder` (part co, along 0.93, thumb up (rig chọn), variant wrap (mặc định), around 330 (rig chọn))); đổi `edge` / `thumb` hay hướng món (`face` / `roll` của mốc món `thu-chai-dac-tuyen` ở `items`) ở giây 0.00 · giây 0.00–1.00. Lúc ấy: chỗ cầm `thu-chai-dac-tuyen@cylinder` (part co, along 0.93, thumb up (rig chọn), variant wrap (mặc định), around 330 (rig chọn)) (dáng fist) · da lún 0.5 ở đầu ngón út · ôm 3/3 (cái, trỏ, giữa–út, lòng) · ngón cái (wrap) 0.1, trỏ (wrap) 0.0, giữa (wrap) -0.1, áp út (wrap) -0.1, út (wrap) -0.5, lòng (press) 0.5 · tâm nắm trong món 0.7 · lòng tay cách 3.0 góc 40° · cổ tay xoay -91°, gập -10°, lệch -4° (vượt kẹp 0.8°, bàn tay lệch chỗ cầm 0.0) · khuỷu φ 93° · cỡ 5.2 = 0.35 · W. Clip đang chạy: stand-3d (than) (docs/11-nhom-cam.md#7-luật-check-nhóm-held) |
| `thu-chai-dac-tuyen@cylinder mặc định (wrap)` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant wrap part than along 0.3 thumb up
   lún 0.1 · xuyên -2 · nắm -2.6 · cỡ 0.79·W
   cái(wrap) -0.1 trỏ(wrap) 0 giữa(wrap) 0.1
   áp út(wrap) 0 út(wrap) 0 lòng(press) 0.6 | — |
| `thu-chai-dac-tuyen@cylinder along cao` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant wrap part than along 0.8 thumb up
   lún 0 · xuyên -2.1 · nắm -1.5 · cỡ 0.79·W
   cái(wrap) 0.3 trỏ(wrap) 0 giữa(wrap) 0.1
   áp út(wrap) 0 út(wrap) 0.2 lòng(press) 0.9 | — |
| `thu-chai-dac-tuyen@cylinder ngón cái xuống` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant wrap part than along 0.8 thumb down
   lún 0.1 · xuyên -2 · nắm 0.8 · cỡ 0.79·W
   cái(wrap) 0 trỏ(wrap) 0.1 giữa(wrap) 0
   áp út(wrap) 0 út(wrap) -0.1 lòng(press) 0.6 | — |
| `thu-chai-dac-tuyen@cylinder nắm phần vai` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant wrap part vai along 0.8 thumb up
   lún 0.5 · xuyên -2.1 · nắm -0.5 · cỡ 0.79·W
   cái(wrap) -0.5 trỏ(wrap) 0 giữa(wrap) 0
   áp út(wrap) 0.1 út(wrap) 0.1 lòng(press) 0.9 | — |
| `thu-chai-dac-tuyen@cylinder nắm phần co` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant wrap part co along 0.9 thumb up
   lún 0.3 · xuyên -2 · nắm -0.3 · cỡ 0.31·W
   cái(wrap) 0.2 trỏ(wrap) 0 giữa(wrap) -0.1
   áp út(wrap) -0.2 út(wrap) -0.3 lòng(press) 0.4 | — |

## Bảng ảnh

- [`thu-chai-dia`](thu-chai-dia.jpg) — 10 hàng
- [`thu-ong-nghe-ban`](thu-ong-nghe-ban.jpg) — 6 hàng
- [`thu-chai-dac-tuyen`](thu-chai-dac-tuyen.jpg) — 10 hàng
