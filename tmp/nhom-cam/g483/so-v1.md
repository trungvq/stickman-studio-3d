# G4-83 `pen` `grip` — v2 so với v1 (`but#viet`)

Ngưỡng: khe cái, trỏ, giữa ≤ v1 + 0,3 (sakura 0,13 / 0,38 / 0,41; kuroiwa 0,1 / 0,28 / 0,41), hay ≲ 0,15·W (2,2 / 2,5); lún ≤ 0,65; không xuyên.

| Người | Hàng | Lún | Nắm | Cái | Trỏ | Giữa | Áp út | Út | Lòng | Luật |
|---|---|---|---|---|---|---|---|---|---|---|
| sakura | v1 `but#viet` (cup) | -0.1 | 2.0 | -0.17 | 0.08 | 0.11 | (6.9) | (9.9) | 8.8/90° | — |
| sakura | v2 tay dẫn, ngòi xuống bàn (tripod, along 0,3) | 0.25 | 2.3 | -0.25 | -0.03 | 0.25 | 3.4 | 7.1 | 8.7/91° | — |
| sakura | v2 tay dẫn trái | 0.25 | 2.3 | -0.25 | -0.03 | 0.25 | 3.4 | 7.1 | 8.7/91° | — |
| sakura | v2 hàng chung mặc định (món đặt trước, bút đứng) | 0 | 18.0 | 9.1 | 18.8 | 20.7 | 24.8 | 26.6 | 18.4/88° | `wrist` (vượt 77,7°, lệch 21,5), `grip`, `loose` |
| kuroiwa | v1 `but#viet` (cup) | -0.1 | 2.0 | -0.20 | -0.02 | 0.11 | (7.6) | (11.1) | 10.2/92° | — |
| kuroiwa | v2 tay dẫn, ngòi xuống bàn | 0 | 2.8 | 0.08 | 0.12 | 0.14 | 4.2 | 8.3 | 10.4/91° | — |
| kuroiwa | v2 tay dẫn trái | 0 | 2.8 | 0.08 | 0.12 | 0.14 | 4.2 | 8.3 | 10.4/91° | — |
| kuroiwa | v2 hàng chung mặc định | 0 | 19.5 | 10.2 | 20.3 | 22.7 | 27.6 | 30.0 | 20.8/87° | `wrist` (vượt 71,6°, lệch 23,5), `grip`, `loose` |

- Khung fixture (test): lệch 0,04°, vị trí 0,20 (sakura) / 0,22 (kuroiwa) / 0,45 (1,61) / 0,51 (2,16), `along` 0,3. Tay trái so với fixture tay phải soi gương qua `x = 0`: fixture tay trái của `grip-frames.json` không soi gương món (ngón cái ở phía kia thân bút — cái hở 4,9–5,8, bút tì áp út), không phải cách cầm bút.
- Dáng `tripod` (không giữ `cup`): ở khung fixture `cup` lún 1,0–1,1 (ngón cái xuyên da), giữa hở 3,4–3,8. `tripod` cũ (cái `[52, 60, 10, 8]`) đệm cái hở 1,35 / 2,0 (ảnh: ngón cái treo ngoài bút); khép cái `[28, 45, 0, 0]` thì cái −0,25 / 0,08.
- Nhận xét ảnh (`../duyet/g4-pen.jpg`, `thu-but-tay-dan-thu.jpg` góc `trong`, `tren`): thân bút nằm ở khe cái–trỏ, ngả về khe; ngón cái ép một bên, trỏ cuộn ép bên kia, ngòi ra giữa đầu ngón cái và trỏ — đọc được là cầm bút. Không xuyên, không hở lộ. Nhìn mu bàn tay thì giống nắm lỏng hơn kẹp viết: giữa, áp út, út cuộn sát dưới (dáng chung `fingers` 48/76), ngón trỏ không duỗi dọc thân như kẹp ba điểm thật; ngón giữa đỡ mặt dưới khuất. So với v1 (cup): ngón khép hơn, ngón cái tì bút rõ hơn; dáng chung gần nhau ở góc trước/chéo.
- Hàng chung hỏng vì chỗ đặt món: bút đứng thẳng ngòi xuống trước ngực, nhóm không có hướng mặc định; kẹp `tripod` cần lệch cổ tay 98° → kẹp ±20, bàn tay lệch chỗ cầm 21–23. Không phải lỗi chỗ tiếp xúc (G4-84: mốc món ngòi chúc ra trước như Phụ lục A).
- Hàng thử vẽ bằng bản chép `tmp/g483-tools/bang-cam.mjs` của repo video (thêm hai hàng tay dẫn `point: item:tip`, `face: tip → [±0,5, 0,866, 0]`, thêm góc `trong`, `tren`).
