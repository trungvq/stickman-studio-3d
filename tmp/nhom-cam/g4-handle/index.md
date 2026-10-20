# Bảng duyệt kiểu cầm

Rig `7.15.0` · giây 0.5 · người: `t01-sakura.json` (tay 1.61), `kuroiwa.json` (tay 2.16) · 10 hàng × 3 góc.
Số đo (đơn vị rig, góc độ): `lún` da lún sâu nhất vào món (âm là khe), `hở` ngón khai `wrap` còn cách món, `nắm` tâm nắm tới mặt món (âm là trong món), `lòng` khe/góc lòng tay (không đo với dáng kẹp `edge`, `pinch`, `hook`), `up`/`face` góc lệch ý định và khớp cổ tay kẹp, `tới` khe tay phụ hay `item:` tới đích; món treo: `quai` đỉnh quai tới chỗ treo, `khuỷu` góc gập/độ ngóc cẳng tay, `thân` khe thân món tới phần người gần nhất, `đẩy` góc lệch khỏi phương đứng. `!!` là luật `held` của `check` báo trên cảnh này.

Chỗ cầm nhóm: dòng đầu là lựa chọn rig giải (`variant`, `edge`, `along`, `thumb`…), dòng hai `lún` da lún sâu nhất vào món, `xuyên` trục nang tới mặt món (âm là còn ngoài), `nắm` tâm nắm tới hình, `cỡ` khối hình / `W` tay, `cổ tay vượt` độ vượt kẹp, `hở` ngón có vai trò chạm mà còn cách món; dòng ba là khe từng ngón tới món (âm là lún) và vai trò (`press`, `wrap`, `tip`, `support`, `free`).


| Món#kiểu | Tay | Người | Dáng lấy từ | Số đo | `check` |
|---|---|---|---|---|---|
| `thu-tui@handle mặc định (hook)` | tay phải | t01-sakura | hàng mẫu (món đặt ngang hông) | P: variant hook part quai along 0.5
   lún 0 · xuyên -1.7 · nắm -1.5
   cái(free) 0.2 trỏ(wrap) 0.1 giữa(wrap) 0.1
   áp út(wrap) 0.2 út(wrap) 0 lòng(free) 1.3 | — |
| `thu-tui@handle along thấp (0,2)` | tay phải | t01-sakura | hàng mẫu (món đặt ngang hông) | P: variant hook part quai along 0.2
   lún 0 · xuyên -1.7 · nắm -1.5
   cái(free) 0.2 trỏ(wrap) 0 giữa(wrap) 0.1
   áp út(wrap) 0.2 út(wrap) 0 lòng(free) 1.3 | — |
| `thu-tui@handle along cao (0,7)` | tay phải | t01-sakura | hàng mẫu (món đặt ngang hông) | P: variant hook part quai along 0.7
   lún 0.2 · xuyên -1.6 · nắm -1.5
   cái(free) 0.2 trỏ(wrap) 0.1 giữa(wrap) 0.1
   áp út(wrap) 0.2 út(wrap) -0.2 lòng(free) 1.3 | — |
| `thu-tui@handle tay buông xách` | tay phải | t01-sakura | hàng mẫu (tay dẫn) | P: variant hook part quai along 0.5 (tay dẫn)
   lún 0 · xuyên -1.7 · nắm -1.5
   cái(free) 0.2 trỏ(wrap) 0.1 giữa(wrap) 0.1
   áp út(wrap) 0.2 út(wrap) 0 lòng(free) 1.3 | — |
| `thu-tui@handle tay buông xách (trái)` | tay trái | t01-sakura | hàng mẫu (tay dẫn) | T: variant hook part quai along 0.5 (tay dẫn)
   lún 0 · xuyên -1.7 · nắm -1.5
   cái(free) 0.2 trỏ(wrap) 0.1 giữa(wrap) 0.1
   áp út(wrap) 0.2 út(wrap) 0 lòng(free) 1.3 | — |
| `thu-tui@handle mặc định (hook)` | tay phải | kuroiwa | hàng mẫu (món đặt ngang hông) | P: variant hook part quai along 0.8
   lún 0.1 · xuyên -2 · nắm -1.5
   cái(free) 0.3 trỏ(wrap) 0.2 giữa(wrap) 0.2
   áp út(wrap) -0.1 út(wrap) 0 lòng(free) 1.9 | — |
| `thu-tui@handle along thấp (0,2)` | tay phải | kuroiwa | hàng mẫu (món đặt ngang hông) | P: variant hook part quai along 0.2
   lún 0 · xuyên -2 · nắm -1.5
   cái(free) 0.1 trỏ(wrap) 0.3 giữa(wrap) 0
   áp út(wrap) 0.1 út(wrap) 0.2 lòng(free) 1.9 | — |
| `thu-tui@handle along cao (0,7)` | tay phải | kuroiwa | hàng mẫu (món đặt ngang hông) | P: variant hook part quai along 0.7
   lún 0.1 · xuyên -1.9 · nắm -1.5
   cái(free) 0.3 trỏ(wrap) 0.2 giữa(wrap) 0.2
   áp út(wrap) 0.1 út(wrap) -0.1 lòng(free) 1.9 | — |
| `thu-tui@handle tay buông xách` | tay phải | kuroiwa | hàng mẫu (tay dẫn) | P: variant hook part quai along 0.5 (tay dẫn)
   lún 0 · xuyên -2 · nắm -1.5
   cái(free) 0.3 trỏ(wrap) 0.2 giữa(wrap) 0.2
   áp út(wrap) 0.1 út(wrap) 0.2 lòng(free) 1.9 | — |
| `thu-tui@handle tay buông xách (trái)` | tay trái | kuroiwa | hàng mẫu (tay dẫn) | T: variant hook part quai along 0.5 (tay dẫn)
   lún 0 · xuyên -2 · nắm -1.5
   cái(free) 0.3 trỏ(wrap) 0.2 giữa(wrap) 0.2
   áp út(wrap) 0.1 út(wrap) 0.2 lòng(free) 1.9 | — |

## Bảng ảnh

- [`thu-tui`](thu-tui.jpg) — 10 hàng
