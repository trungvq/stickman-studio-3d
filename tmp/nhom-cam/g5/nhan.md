# G5-1 — nhãn phần 35 món (held-v2/)

35 món v1 trong `held/` (không tính `thu-*`; bảng "34 món" của Phụ lục A đếm thiếu một). 18 món có sẵn `held/thu-*.json`: bản v2 chép từng byte (trừ `touch` của `thu-dien-thoai`), 17 món mới gắn nhãn theo Phụ lục A. Cột "khớp lưới" là lệch lớn nhất (đơn vị rig) giữa lưới món và `shape`, hai chiều (lưới lồi ra ngoài hình, hình thừa ra ngoài lưới), đo ở chỗ cầm / cả món; ngưỡng hỏng 1,5. `(x)` là phần `grip: false`; số sau tên là số khối.

| Món | Phần (số khối) | front / top | seats | Khối hình suy ra | Nhóm Phụ lục A | Khớp lưới (chỗ cầm / cả món) | Ghi chú |
|---|---|---|---|---|---|---|---|
| `bang-gia` | body 1 | front / top |  | body=slab | sheet, card (suy) | 0.12 / 0.12 |  |
| `bao` | body 3 | front / top |  | body=slab | sheet `rim`, both | 0.67 / 0.67 |  |
| `bien-lai` | body 1 | front / top |  | body=slab | sheet (suy) | 0.12 / 0.12 |  |
| `binh` | than 2, vai 2, co 1, mieng (x) 1 | (+z) / mouth |  | than=lathe vai=lathe co=lathe | cylinder (suy) | 0.16 / 0.16 |  |
| `bo-da` | dia 3, mon-an (x) 4 | front / top |  | dia=slab+rod+rod | sheet `rim`, both | 0.08 / 14.56 |  |
| `bo-dam` | than 2, ang-ten (x) 2, 4 detail | front / top |  | than=rod+rod | palmBox, cylinder (suy) | 0.50 / 0.50 | **cần xem**: chọn `detail`: nút sườn, kẹp lưng, núm trên; `ang-ten` = đế + cần ăng-ten (khối 5, 6) |
| `but` | ngoi (x) 1, than 2, 1 detail | (+z) / cap |  | than=lathe | pen | 0.69 / 0.69 |  |
| `chai-dac-tuyen` | than 2, vai 6, co 3, mieng (x) 1 | nhan / mouth |  | than=lathe vai=lathe co=lathe | cylinder (`vai`) | 0.30 / 0.30 |  |
| `chai-dia` | than 2, vai 6, co 1, mieng (x) 1 | nhan / mouth |  | than=lathe vai=lathe co=lathe | cylinder (`vai`) | 0.30 / 0.30 |  |
| `chen` | body 2 | (+z) / (miệng) |  | body=lathe | bowl `side` | 0.10 / 0.10 |  |
| `chia` | vong 1, chia (x) 3 | (+z) / (+y) |  | vong=slab+disc+lathe | handle, card (suy) | 1.32 / 41.98 | **cần xem**: `vong` ra slab + disc + lathe (vòng thấp); hai nhãn `vong`/`chia` theo bảng; mốc `tag` ở đầu chùm nằm ngoài `shape` |
| `chong-khan` | day 3, vanh 6 | (+z) / top |  | day=box vanh=rod+rod+rod+rod+rod+rod | platform (suy) | 1.72 / 1.72 | **cần xem**: bảng gán `day`/`vanh` nhưng món là chồng khăn (không khay): `day` = ba khối giữa (chỉ ra `box`), `vanh` = sáu khối mép gấp (sáu `rod`) |
| `dien-thoai` | body 6, 5 detail | screen / top |  | body=slab | palmBox (34 cặp), sheet, card, platform | 1.20 / 1.20 | **cần xem**: `thu-dien-thoai` có thêm `touch` (self.head, self.torso); bản này bỏ `touch` (việc của `migrate-held` / cảnh) |
| `dua` | que 2, nut (x) 1 | (+z) / (+y) |  | que=rod+rod | chopsticks | 0.62 / 0.62 |  |
| `giay-to` | body 2 | front / edgeT |  | body=slab | sheet, card (suy) | 0.25 / 0.25 |  |
| `hoa-don` | body 1 | front / top |  | body=slab | sheet `flat`, both | 0.02 / 0.02 |  |
| `kep-ho-so` | body 1 | cover / top |  | body=slab | sheet (suy) | 1.00 / 1.00 | **cần xem**: một khối, không nhãn |
| `khan` | body 1 | (+z) / top |  | body=slab | soft (để sau) | 0.50 / 0.50 |  |
| `khay-suat` | day 1, vanh 4, mon-an (x) 19 | (+z) / top |  | day=slab vanh=rod+rod+rod+rod | platform, both | 1.43 / 2.00 |  |
| `khay-tra` | day 1, do-tra (x) 10 | (+z) / top |  | day=slab | platform, both (suy) | 0.69 / 0.69 | **cần xem**: không có thành khay nên chỉ `day`; ấm, chén, nắp là `do-tra` (`grip: false`) |
| `khay` | day 1, vanh 2 | (+z) / top |  | day=slab vanh=rod+rod | platform, both | 0.00 / 0.00 |  |
| `ly-bia` | than 7, quai 5 | (+z) / (+y) |  | than=lathe quai=rod | handle (suy) | 1.33 / 1.33 | **cần xem**: `quai` là đường cong năm trụ (`path` để sau): chỉ đoạn thẳng giữa ra `rod` |
| `ong-nghe-ban` | tay 1, mic (x) 1, loa (x) 1 | front / top |  | tay=rod | cylinder (`tay`) | 0.00 / 0.00 |  |
| `ong-nghe` | tay 2, 4 detail | front / top |  | tay=rod | cylinder (`tay`) | 0.80 / 0.80 | **cần xem**: bảng gán `loa`, `mic` (`grip: false`) nhưng v1 chỉ có tấm mỏng 0,8 (phím, màn, khe loa) và núm đầu: để `detail`; `tay` = hai khối thân |
| `phieu-doi-phong` | body 1 | front / top |  | body=slab | sheet, platform (suy) | 0.12 / 0.12 |  |
| `phieu-lien` | body 1 | front / top |  | body=slab | sheet `flat` | 0.02 / 0.02 |  |
| `phieu` | body 1 | front / top |  | body=slab | platform | 0.02 / 0.02 |  |
| `so-tay` | body 3 | front / top |  | body=slab | sheet (suy) | 0.96 / 0.96 | **cần xem**: bảng cho phép không nhãn: để một phần `body` (bìa + hai khối trang) |
| `the-phong` | body 1 | front / top |  | body=slab | card | 0.15 / 0.15 |  |
| `the` | body 1 | front / edgeT |  | body=slab | card (suy) | 0.20 / 0.20 |  |
| `thuc-don` | body 1 | front / top |  | body=slab | sheet `flat` | 0.12 / 0.12 |  |
| `tom-hum` | dia 6, mon-an (x) 56 | (+z) / top |  | dia=slab+disc+lathe | sheet `rim`, both | 8.26 / 43.13 |  |
| `tui-hieu` | body 7 | mat / quai | elbow=treoKhuyu, shoulder=quai | body=rod+rod+rod+rod+rod+rod | carry (`seats`) | 1.50 / 1.50 |  |
| `tui` | day (x) 1, than 4, quai 5 | mat / quai |  | than=rod quai=rod+rod+rod+rod+rod | handle `hook` | 0.35 / 0.35 |  |
| `vali` | can 1, ong 2, than 9, quai 1 | (+z) / handleTop |  | can=rod ong=rod+rod than=rod+rod quai=rod | handle (suy) | 2.93 / 2.93 | **cần xem**: bảng: `than`, `can`, ống kéo; thêm `quai` cho khối 8 (quai xách trên nắp, ngoài bảng); bánh xe nằm trong `than` |

## Lệch lưới lớn (chỉ báo, lưới không sửa)

Test (`tools/held-moc.mjs`, bảng `LECH_BIET`) giữ mức tối đa từng món; vượt là hỏng.

| Món | Chỗ cầm | Cả món | Vì sao |
|---|---|---|---|
| `tom-hum` | 8,26 | 43,13 | đuôi, càng tôm thò quá mép đĩa (lưới z ±50, đĩa bán kính 35); đồ ăn ngoài vài khối `mon-an` |
| `chia` | 1,32 | 41,98 | thẻ và dây thõng của chùm chìa (tới y −54) không có trong hình |
| `bo-da` | 0 | 14,56 | thịt bò đá vẽ ra ngoài các khối `mon-an` |
| `vali` | 2,93 | 2,93 | bánh xe vẽ lớn hơn trụ hình |
| `khay-suat` | 1,43 | 2,00 | đồ trên khay vẽ lồi ra ngoài hình |
| `chong-khan` | 1,72 | 1,72 | mép gấp khăn lồi ra ngoài hộp hình |
| `dien-thoai` | 1,20 | 1,20 | dưới ngưỡng hỏng (cảnh báo `~`): lưới vẽ ×0,9 so với hình bộ giải, lệch ở góc bo / mép trên |
| `tui-hieu` | 1,50 | 1,50 | sát ngưỡng; quai, khoen ở trên đỉnh hình không tính (hình chỉ là thân túi) |
| `ly-bia` | 1,33 | 1,33 | quai cong |
