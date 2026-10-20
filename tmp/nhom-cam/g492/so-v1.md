# G4-92+93 `handle` `hook` so với v1 `tui#xach`

Nguồn: `pnpm bang-cam --nhom handle --mon thu-tui` (hàng chung, `g492/`), bản chép tạm `tay/bang-cam.mjs` thêm hai hàng
"tay buông xách" (tay dẫn, tay theo hành động đứng, `g492/tay/`), v1 `pnpm bang-cam --mon tui` (`g492/v1/`). Giây 0,5.

| Ô | Người | Tay | Lún | Xuyên (trục) | Cái | Trỏ | Giữa | Áp út | Út | Cổ tay (xoay/gập/lệch) |
|---|---|---|---|---|---|---|---|---|---|---|
| v1 `tui#xach` | sakura | P | 0,9 | — | (0,2) | 0,2 | 0,4 | 0,0 | −0,9 | — |
| v2 tay buông | sakura | P, T | 0 | −1,74 | (0,16) | 0,06 | 0,08 | 0,17 | 0,03 | −1,9 / 11,6 / −18,8 |
| v1 `tui#xach` | kuroiwa | P | 0,6 | — | (0,3) | 0,4 | 0,5 | 0,2 | −0,6 | — |
| v2 tay buông | kuroiwa | P, T | 0 | −2,02 | (0,28) | 0,20 | 0,17 | 0,09 | 0,25 | −0,9 / 5,3 / −18,8 |
| v2 hàng chung (túi trước ngực) | sakura | P | 0 | −5,3 | 2,6 | 8,5 | 9,7 | 9,8 | 10,6 | vượt 34,9°, lệch chỗ cầm 13,8 |
| v2 hàng chung (túi trước ngực) | kuroiwa | P | 0 | −3,0 | 0,1 | 4,6 | 6,4 | 7,8 | 9,2 | vượt 46,0°, lệch chỗ cầm 9,0 |

- Tay buông: lún 0,9/0,6 → 0, khe trỏ–út ≤ 0,25 (≤ v1 + 0,3 mọi ngón), không xuyên. Khung = fixture `tui#xach` (0°, 0
  đơn vị); khác v1 chỉ ở dáng: `hook` gập gốc −40°, ngọn −10° (`HOOK`), sau `heldFit` trỏ, giữa gốc −12/−8°, ngọn 86–91°.
- Hàng chung đặt túi trước ngực (`NGUC`): quai cao hơn đầu tay với, cổ tay vượt kẹp 35–46° — giới hạn khớp của chỗ đặt, không
  phải của khung. Hàng mẫu `handle` (G4-94) cần đặt túi ngang hông, quai dưới tay buông.
