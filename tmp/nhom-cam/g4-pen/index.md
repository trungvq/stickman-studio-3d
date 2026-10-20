# Bảng duyệt kiểu cầm

Rig `7.15.0` · giây 0.5 · người: `t01-sakura.json` (tay 1.61), `kuroiwa.json` (tay 2.16) · 10 hàng × 3 góc.
Số đo (đơn vị rig, góc độ): `lún` da lún sâu nhất vào món (âm là khe), `hở` ngón khai `wrap` còn cách món, `nắm` tâm nắm tới mặt món (âm là trong món), `lòng` khe/góc lòng tay (không đo với dáng kẹp `edge`, `pinch`, `hook`), `up`/`face` góc lệch ý định và khớp cổ tay kẹp, `tới` khe tay phụ hay `item:` tới đích; món treo: `quai` đỉnh quai tới chỗ treo, `khuỷu` góc gập/độ ngóc cẳng tay, `thân` khe thân món tới phần người gần nhất, `đẩy` góc lệch khỏi phương đứng. `!!` là luật `held` của `check` báo trên cảnh này.

Chỗ cầm nhóm: dòng đầu là lựa chọn rig giải (`variant`, `edge`, `along`, `thumb`…), dòng hai `lún` da lún sâu nhất vào món, `xuyên` trục nang tới mặt món (âm là còn ngoài), `nắm` tâm nắm tới hình, `cỡ` khối hình / `W` tay, `cổ tay vượt` độ vượt kẹp, `hở` ngón có vai trò chạm mà còn cách món; dòng ba là khe từng ngón tới món (âm là lún) và vai trò (`press`, `wrap`, `tip`, `support`, `free`).


| Món#kiểu | Tay | Người | Dáng lấy từ | Số đo | `check` |
|---|---|---|---|---|---|
| `thu-but@pen mặc định (grip)` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant grip part than along 0.3
   lún 0.3 · xuyên -2.3 · nắm 2.3
   cái(press) -0.3 trỏ(press) 0 giữa(support) 0.3
   áp út(free) 3.4 út(free) 7.1 lòng(free) -0.1 | — |
| `thu-but@pen along thấp (0,15)` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant grip part than along 0.2
   lún 0.2 · xuyên -2.3 · nắm 2.3
   cái(press) -0.2 trỏ(press) 0 giữa(support) 0.1
   áp út(free) 3.7 út(free) 7.1 lòng(free) -0.1 | — |
| `thu-but@pen along cao (0,45)` | tay phải | t01-sakura | hàng mẫu (món đặt trước ngực) | P: variant grip part than along 0.5
   lún 0.3 · xuyên -2.3 · nắm 2.3
   cái(press) -0.3 trỏ(press) 0.1 giữa(support) 0.3
   áp út(free) 3.4 út(free) 7.1 lòng(free) -0.2 | — |
| `thu-but@pen tay dẫn, ngòi xuống mặt bàn` | tay phải | t01-sakura | hàng mẫu (tay dẫn) | P: variant grip part than along 0.3 (tay dẫn)
   lún 0.3 · xuyên -2.3 · nắm 2.3
   cái(press) -0.3 trỏ(press) 0 giữa(support) 0.3
   áp út(free) 3.4 út(free) 7.1 lòng(free) -0.1 | — |
| `thu-but@pen tay dẫn trái, ngòi xuống mặt bàn` | tay trái | t01-sakura | hàng mẫu (tay dẫn) | T: variant grip part than along 0.3 (tay dẫn)
   lún 0.3 · xuyên -2.3 · nắm 2.3
   cái(press) -0.3 trỏ(press) 0 giữa(support) 0.3
   áp út(free) 3.4 út(free) 7.1 lòng(free) -0.1 | — |
| `thu-but@pen mặc định (grip)` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant grip part than along 0.3
   lún 0 · xuyên -2.6 · nắm 2.8
   cái(press) 0.1 trỏ(press) 0.1 giữa(support) 0.1
   áp út(free) 4.2 út(free) 8.3 lòng(free) 0.2 | — |
| `thu-but@pen along thấp (0,15)` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant grip part than along 0.2
   lún 0 · xuyên -2.6 · nắm 2.8
   cái(press) 0.1 trỏ(press) 0.1 giữa(support) 0.1
   áp út(free) 4.5 út(free) 8.4 lòng(free) 0.2 | — |
| `thu-but@pen along cao (0,45)` | tay phải | kuroiwa | hàng mẫu (món đặt trước ngực) | P: variant grip part than along 0.5
   lún 0 · xuyên -2.6 · nắm 2.8
   cái(press) 0 trỏ(press) 0.1 giữa(support) 0.1
   áp út(free) 4.2 út(free) 8.3 lòng(free) 0.1 | — |
| `thu-but@pen tay dẫn, ngòi xuống mặt bàn` | tay phải | kuroiwa | hàng mẫu (tay dẫn) | P: variant grip part than along 0.3 (tay dẫn)
   lún 0 · xuyên -2.6 · nắm 2.8
   cái(press) 0.1 trỏ(press) 0.1 giữa(support) 0.1
   áp út(free) 4.2 út(free) 8.3 lòng(free) 0.2 | — |
| `thu-but@pen tay dẫn trái, ngòi xuống mặt bàn` | tay trái | kuroiwa | hàng mẫu (tay dẫn) | T: variant grip part than along 0.3 (tay dẫn)
   lún 0 · xuyên -2.6 · nắm 2.8
   cái(press) 0.1 trỏ(press) 0.1 giữa(support) 0.1
   áp út(free) 4.2 út(free) 8.3 lòng(free) 0.2 | — |

## Bảng ảnh

- [`thu-but`](thu-but.jpg) — 10 hàng
