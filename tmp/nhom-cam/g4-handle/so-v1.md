# G4-94+95 `handle` `hook` so với v1 `tui#xach`

Nguồn: `pnpm bang-cam --nhom handle --mon thu-tui` (10 hàng, 30 ô, `thu-tui.jpg`), v1 `pnpm bang-cam --mon tui` (`../g492/v1/`). Giây 0,5.
Hàng đặt túi ngang hông (`to: hip`, `offset [0, 65, 30]`) và hai hàng tay buông xách (tay dẫn phải / trái, không khai đích).

| Ô | Người | `along` | Lún | Xuyên (trục) | Cái | Trỏ | Giữa | Áp út | Út | Cổ tay (xoay/gập/lệch) |
|---|---|---|---|---|---|---|---|---|---|---|
| v1 `tui#xach` | sakura | — | 0,9 | — | (0,2) | 0,2 | 0,4 | 0,0 | −0,9 | — |
| v2 mặc định (hông) | sakura | 0,5 | 0 | −1,74 | (0,16) | 0,06 | 0,08 | 0,17 | 0,03 | 8,8 / 6,5 / 0,5 |
| v2 `along` 0,2 | sakura | 0,2 | 0,03 | −1,74 | (0,17) | −0,03 | 0,08 | 0,17 | 0,03 | 7,7 / 6,9 / −9,1 |
| v2 `along` 0,7 | sakura | 0,7 | 0,18 | −1,59 | (0,16) | 0,06 | 0,08 | 0,17 | −0,18 | 8,0 / 5,3 / 7,9 |
| v2 tay buông (P, T) | sakura | 0,5 | 0 | −1,74 | (0,16) | 0,06 | 0,08 | 0,17 | 0,03 | −1,9 / 11,6 / −18,8 |
| v1 `tui#xach` | kuroiwa | — | 0,6 | — | (0,3) | 0,4 | 0,5 | 0,2 | −0,6 | — |
| v2 mặc định (hông) | kuroiwa | 0,75 | 0,06 | −2,02 | (0,28) | 0,20 | 0,18 | −0,06 | 0 | 8,4 / 8,7 / −11,7 |
| v2 `along` 0,2 | kuroiwa | 0,2 | 0,03 | −2,02 | (0,08) | 0,25 | −0,03 | 0,09 | 0,25 | 46,8 / 31,0 / −12,8 |
| v2 `along` 0,7 | kuroiwa | 0,7 | 0,09 | −1,87 | (0,28) | 0,20 | 0,17 | 0,10 | −0,09 | 10,2 / 9,9 / −12,8 |
| v2 tay buông (P, T) | kuroiwa | 0,5 | 0 | −2,02 | (0,28) | 0,20 | 0,17 | 0,09 | 0,25 | −0,9 / 5,3 / −18,8 |

- Mười hàng, không luật `held` nào báo (hàng chung "túi trước ngực" của g492 vượt cổ tay 35–46°). Lún ≤ 0,18, không xuyên, khe ngón ≤ 0,25
  (kuroiwa `along` 0,2: khe giữa −0,03 là lún nhẹ, trỏ 0,25).
- Hàng tay buông giữ lệch cổ tay −18,8° (sát kẹp ±20°) như g492; hàng đặt hông lệch ≤ 13°.
- Kuroiwa `along` 0,2 xoay cẳng tay 47° và gập 31° (trong kẹp, không báo): bàn tay với quai ở đầu xa nhất, cẳng tay chéo hơn.
- Đặt hông: túi quay mặt về phía trước người (quai ngang trước đùi), không quay ngang như hàng tay buông (túi ngang đùi, quai trước–sau).
  Quay túi ngang (`face: mat → ngang`) làm xoay cẳng tay −44° tới −81° ở kuroiwa: không dùng.
