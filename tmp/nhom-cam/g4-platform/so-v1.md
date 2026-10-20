# G4-56+57 — `platform`: hàng mẫu, docs, render tổng; v2 / v1

Nguồn: `pnpm bang-cam --nhom platform --mon thu-khay,thu-phieu --out tmp/bang-cam-g4-platform` (cùng thư mục: `thu-khay.jpg`,
`thu-phieu.jpg`, `do.json`, `index.md`), `--nhom cylinder --mon thu-chai-dia` (`both-cylinder/`), `--nhom palmBox --mon
thu-dien-thoai` (`both-palmBox/`), giây 0,5. Ghép hàng mặc định + `both`: `../duyet/g4-platform-tong.jpg` (sakura; mỗi hàng ba
góc trước / chéo / ngang; hàng: khay mặc định, khay hai tay, phiếu mặc định, phiếu tay dẫn, chai rót hai tay, điện thoại hai tay).

Hàng mẫu `platform`: món ngang bụng `to: chest, offset [80, 20, 0]` (xa ngực hơn hàng chung 30), `mặc định`, `ψ 0`, `ψ 90`
(bỏ khi trùng mặc định), `tay dẫn` (tay chạm `[40, 10, 30]`, `point: grip`), `hai tay (món đặt trước)` (`both`, cạnh đối). `both`
của `cylinder`: chai `to: chest, offset [25, 20, 10], up [0.3, 1, 0.3]`; của `palmBox`: ngang ngực như hàng mặc định. Quét cả
18 món `thu-*` × `platform, cylinder, palmBox`: 222 hàng, 666 ô, 0 ô LỖI.

Mức v1 từ `g4-chuan-v1/muc.md` (`khay-suat#bung` y số `khay#bung`; bảng mẫu chỉ có `thu-khay`). Lún = da lún sâu nhất; khe
ngón đo trên da, âm là lún; v1 ghi trong ngoặc.

| Món | Người | Chọn (rig) | Lún (v1) | Nắm (v1) | Cái | Trỏ | Giữa | Áp út | Út | Lòng da; nang/góc (v1) | Cổ tay vượt | Luật |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| khay | sakura | đáy, cạnh left, ψ 90, along 0,5 | **0,04** (1,3) | 0,7 (0,0) | 0,0 (−1,3) | 0,0 (2,6) | 0,0 (2,5) | 0,0 (2,1) | 0,1 (2,8) | 0,15; 2,3/0° (0,7/0°) | 0 (xoay −83°) | — |
| khay | kuroiwa | đáy, cạnh left, ψ 90, along 0,73 | **0,00** (1,2) | 0,9 (0,0) | 0,2 (−1,2) | 0,4 (2,8) | 0,2 (2,9) | 0,1 (2,6) | 0,0 (3,0) | 0,15; 2,8/0° (0,8/0°) | 0 (còn 2,1° tới kẹp) | wrist (cảnh báo sát kẹp) |
| phiếu | sakura | mặt body, cạnh left, ψ 90, along 0,5 | **0,54** (0) | 0,1 (2,0) | −0,5 (0,4) | −0,5 (4,6) | −0,1 (4,5) | 0,0 (4,1) | 0,5 (4,8) | −0,46; 2,1/6° (2,7/0°) | 6,6° (xoay −97°) | wrist |
| phiếu | kuroiwa | mặt body, cạnh left, ψ 90, along 0,75 | **0,13** (0) | 0,6 (2,0) | −0,1 (0,3) | −0,1 (4,8) | 0,1 (4,9) | 0,1 (4,6) | 0,1 (5,0) | −0,10; 2,7/2° (2,8/0°) | 2,2° (xoay −92°) | wrist |
| khay `hai tay` | sakura | cạnh left + right (đối) | 0,04 / 0,04 | 0,7 | 0,0 | 0,0 | 0,0 | 0,0 | 0,1 | 0,15 | 0 / 0 | — |
| khay `hai tay` | kuroiwa | cạnh left + right | 0,00 / 0,00 | 0,9 | 0,2 | 0,4 | 0,2 | 0,1 | 0,0 | 0,15 | 0 / 0 | wrist (sát kẹp 2,1°) |
| phiếu `hai tay` | sakura / kuroiwa | cạnh left + right | 0,54 / 0,13 | 0,1 / 0,6 | −0,5 / −0,1 | −0,5 / −0,1 | −0,1 / 0,1 | 0,0 / 0,1 | 0,5 / 0,1 | −0,46 / −0,10 | 6,6° / 2,2° | wrist |
| khay `tay dẫn` | sakura / kuroiwa | cạnh right, ψ 90 | 0,04 / 0,00 | 0,7 / 0,9 | 0,0 / 0,2 | 0,0 / 0,4 | 0,0 / 0,2 | 0,0 / 0,1 | 0,1 / 0,0 | 0,15 | 0 / 0 | — |
| phiếu `tay dẫn` | sakura / kuroiwa | cạnh right, ψ 90 | 0,04 / 0,00 | 0,7 / 0,9 | 0,0 / 0,2 | 0,0 / 0,4 | 0,0 / 0,2 | 0,0 / 0,1 | 0,1 / 0,0 | 0,15 | 0 / 0 | — |
| khay `ψ 0` | sakura / kuroiwa | đáy, cạnh back, along 0,25 | 1,10 / 0,98 | −1,6 / −1,7 | −0,3 / −0,2 | 0,0 / 0,1 | — | −0,4 / −1,0 (giữa–út) | | −1,10 / −0,84 | 11,7° / 5,8° | wrist, sink |
| phiếu `ψ 0` | sakura / kuroiwa | cạnh top, along 0,25 | 0,54 / 0,53 | 1,7 / 1,3 | −0,5 / −0,2 | 0,0 / 0,1 | — | −0,5 / −0,5 (giữa–út) | | −0,54 / −0,45 | 11,6° / 9,2° | wrist |

`both` nhóm khác (số tay dẫn / tay phụ):

| Ca | Người | Tay dẫn: chỗ, lún, vượt | Tay phụ: chỗ, lún, lòng, vượt | Luật |
|---|---|---|---|---|
| `chai-dia@cylinder` | sakura | wrap, than, along 0,75, around 300, cái up; 0,05; 0 | `platform` mặt đáy, ψ 45 (rig); 0,38; lòng 0,3; 0; cái hở 0,6 | — |
| | kuroiwa | như trên; 0,06; 0 | như trên; 0,37; lòng 0,3; 0; cái hở 1,5 | — |
| `dien-thoai@palmBox` | sakura | thumb right, tilt 10, along 0,3; 0; 0 | `platform` mặt sau, cạnh bottom, ψ 90; 0; lòng **1,4**; 0 (sát kẹp 1,5°) | wrist (sát), grip, loose |
| | kuroiwa | thumb right, tilt 15; 0; 0 | như trên; 0; lòng **2,0**; 0 (sát kẹp 4,1°) | wrist (sát), grip, loose, role |

## Đọc (nhìn ảnh)

- **Khay**: lòng ngửa đỡ đáy, ngón duỗi nằm dưới đáy, ngón cái ngoài mép; hai tay cân đối hai cạnh đối. Lún 1,3 → 0,04 / 0,00, khe
  ngón 2,1–3,0 (ngón thõng dưới đáy) → 0,0–0,4. Tốt hơn v1 rõ. Hàng `hai tay` ra cùng số hai tay (khay đối xứng, nghiệm gương).
- **Cổ tay**: món ở `[80, 20, 0]` thì khay không vượt (sakura xoay −83°, kuroiwa −88° còn 2,1° tới kẹp, báo cảnh báo). Phiếu vẫn
  vượt 6,6° (sakura) / 2,2° (kuroiwa) — giảm từ 17,6° / 13,2° ở hàng chung nhưng chưa hết; lỗi `wrist` ở ô phiếu là giới hạn
  khớp của lòng ngửa (rủi ro 11). Nghiệm rất nhạy với chỗ món: dò thêm `offset` `[90,20,0]` phiếu 10,5° / 4,3°, `[100,20,0]` phiếu
  4,6° / 2,2° nhưng khay sakura 2,2°, `[100,25,0]` khay sakura đổi sang cạnh `back` và lún 0,72. Chốt `[80, 20, 0]` vì khay sạch và
  phiếu thấp; không có chỗ chung nào sạch cả hai.
- **Phiếu**: lún 0 → 0,54 (sakura) / 0,13 (kuroiwa), dưới ngưỡng `sink` 0,65, ngón cái và trỏ ngập 0,5 trong tờ. Nhìn trước, góc
  trái dưới của tờ có chấm/khuyết nhỏ do đầu ngón cái, trỏ lộ qua tờ — kém v1 (v1 phiếu hở 4,6 nhưng không lộ). Tay dẫn không
  lộ (lún 0,04): lỗi này đi theo kẹp xoay cẳng tay của món đặt trước, không phải dáng.
- **`ψ 0`** (ngón vào mặt, tay tới từ cạnh sau): khay lún 1,1 (quá `sink`) và vượt 6–12° — rig không chọn nó cho khay đúng; hàng chỉ để
  nhìn. Phiếu `ψ 0` vượt 9–12°, lún cùng mức ψ 90. `ψ 90` trùng mặc định ở sakura (bỏ); kuroiwa khay `ψ 90` lệch `along` 0,5 so mặc
  định 0,73, vượt 2,0°.
- **Chai rót hai tay**: tay phải ôm thân (wrap, cái lên), tay trái ngửa dưới đáy; không báo luật nào. Ngón cái tay đỡ đáy hở 0,6–1,5
  (vai trò `free`, không phải luật). Đạt.
- **Điện thoại hai tay**: tay dẫn ôm hai bên, tay phụ đỡ phía dưới; ảnh đọc được là hai tay cầm máy. Nhưng lòng tay phụ cách mặt sau
  1,4 (sakura) / 2,0 (kuroiwa): `grip` 5,9–8,7 và `loose` báo, tay phụ sát kẹp cổ tay 1,5–4,1°. Chưa đạt như hàng tay dẫn của G4-54
  (lòng 0,27) — chỗ đặt tay phụ của `placeChoice` trên món đặt trước (lõi, ngoài phạm vi job này).
- **Bỏ** (`do.json` `bo`, `loc`): `thu-chai-dia@platform`, `thu-tom-hum@platform`, `thu-chai-dac-tuyen@platform`, `thu-chen@platform`:
  "nhóm `platform` cần `edge`: mặt đỡ của món không có cạnh" (đáy tròn); `thu-but@platform`: không có mặt chứa 0,4·W × 0,6·L;
  `flat` trên `chai-dia`, `chen`, `chai-dac-tuyen`, `but` (cylinder): chỉ áp trên `rod`.

## Kiểm

- Studio: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build` xanh (`studio.log`, 1 096 + 245 + 44 test).
- Video: `pnpm test` xanh (`video-test.log`); `pnpm bang-cam --mon bang-gia` ra 10 hàng, 30 ô (`bang-cam-cu.log`).
