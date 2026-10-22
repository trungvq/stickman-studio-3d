# T02-PHAN — gốc lỗi các lần cầm `sua-moi` và kế hoạch sửa

Nguồn: 60 dòng `de_xuat: "sua-moi"` trong `soi/lo1..5.json`. Ảnh chụp lúc 11:03–13:21 ngày 22/10, sau commit rig 53aac4a, nên là rig hiện hành. Khoá đọc từ working tree của repo video (một job khác đang trả túi Erika về khoá cũ ở s001–s028; các lần cầm đó không có ở đây).

**Đếm theo gốc:** a cảnh 33 · b rig 24 · c đồ đặt video 3 · d chỉ thiếu ảnh 0 (6 lần cầm cần chụp bù, ghi ở cột ghi chú).

## Hai chỗ người soi chấm khác nhau

**Đũa.** Lô 3 đúng cho s032, s034; lô 4 đúng cho s049 (0–4.37s). Rig dùng dáng kẹp thật (6451634 là tổ tiên HEAD, ảnh chụp sau 53aac4a) và ba cảnh cùng khoá `hold` (`along 0.245`, `face tip→forward tilt −30`). Khác ở cánh tay: s049 có `elbow [0.2,0.8,1]` nên lòng tay "ra trước 75°", đũa xiên qua các ngón, khớp g4-chopsticks-truoc-sau đã duyệt; s032/s034 không có `elbow`, lòng tay "vào thân 59–69°", đũa dựng đứng trong nắm như dao găm. Lỗi do cảnh: thêm `elbow` như s049, thêm `roll` hai que ngang theo spec §3.4.

**Khay hai tay Yota/Chiaki.** Theo khay-hai-tay đã duyệt (ngón cái trên vành, bốn ngón luồn dưới đáy, khuỷu ~90°), lô 5 đúng: Yota s054–s055 và Chiaki s055–s060 đỡ hai lòng xoè dưới đáy (`platform palm`, ngón cái `free`). Lô 4 chấm đạt Yota s053 cùng khoá, nên sửa luôn để liền mạch. Không khoá cảnh nào ra dáng mẫu: `platform` chỉ có `palm`, `sheet rim` ở mép dày ra nắm giơ ngón cái (s030 Yoshie). Cần R2.

Hai chỗ chấm khác nhau nữa cũng gặp khi soát:

- s009 (lô 1 chấm lỗi máy lăn 35°) và s015 (lô 2 chấm đạt) cùng khoá, ảnh trùng từng pixel. Lô 1 đúng, vì vậy C3 soát lại s011, s015, s016, s023, s024, s027, s028.
- s011 lô 1 chấm đạt, nhưng 3.14s ra cùng nắm giơ ngón cái như s054. Đây là lỗi palmBox (R1).

## Bảng lần cầm

| Lô | Cảnh | Người | Tay | Món@nhóm | Gốc | Bằng chứng | Hướng sửa | Job | Ghi chú |
|---|---|---|---|---|---|---|---|---|---|
| 1 | s006a-bai-xe | takumi | trái | tui | a · cảnh | check đo túi lấn đùi 34 ở 5.72s khi bước ra xe; mốc @cua+1.1 `to: hip, offset [4,30,48]` kéo túi sát chân | dời túi ra ngoài/trước (offset ngang lớn hơn, `elbow` ra ngoài) quanh @cua+0.6…+1.6, hay lùi mốc tay sau bước chân | C3 | 0.3s, 4.88s trong xe bị che: chụp lại góc khác (d) |
| 1 | s006a-bai-xe | erika | trái | dien-thoai | a · cảnh | @cua+2.9 `to: chin, offset [60,-8,50]`, `face back→forward` + look-up: máy sát má; ở 6.15s máy xuyên bậu cửa khi tay còn trong xe | hạ máy trước ngực/cằm xa mặt hơn (giảm offset ngang, tăng tiến), `face back` về toà nhà theo hướng nhìn; lùi mốc giơ máy sau khi tay ra khỏi xe | C3 ← R1 |  |
| 1 | s008-truoc-cua | erika | trái | dien-thoai | a · cảnh | cùng khoá @cua+2.9 của s006a (chin [60,-8,50]) + đầu ngửa nhìn toà nhà → máy sát má, lệch | như s006a: đưa máy ra trước, hướng lưng máy về toà nhà; giữ liền mạch với s006a/s009 | C3 ← R1 |  |
| 1 | s009-nhan-khach | erika | trái | dien-thoai | a · cảnh | `to: eye [45,45,-10]`, `elbow [-0.3,1,-0.2]`, `roll top→up` mà máy vẫn lăn ~35° (cổ tay kẹp); ảnh s009 trùng từng pixel với s015 (lô 2 chấm đạt) — cùng khoá | đổi chỗ tay/khuỷu cho cổ tay đạt `roll` (hạ khuỷu, đưa máy ra trước, khớp s011 `to: chin [40,16,8]`, `elbow [-0.3,1,1]`); soát `check` báo `wrist` | C3 ← R1 | cùng bộ khoá ở s011, s015, s016, s023, s024, s027, s028 (người soi chấm đạt): áp cùng cách sửa để liền mạch |
| 1 | s010-xac-nhan | erika | trái | dien-thoai | a · cảnh | `to: eye [45,45,-10]`, `elbow [-0.3,1,-0.2]`, `roll top→up` mà máy vẫn lăn ~35° (cổ tay kẹp); ảnh s009 trùng từng pixel với s015 (lô 2 chấm đạt) — cùng khoá | đổi chỗ tay/khuỷu cho cổ tay đạt `roll` (hạ khuỷu, đưa máy ra trước, khớp s011 `to: chin [40,16,8]`, `elbow [-0.3,1,1]`); soát `check` báo `wrist` | C3 ← R1 | cùng bộ khoá ở s011, s015, s016, s023, s024, s027, s028 (người soi chấm đạt): áp cùng cách sửa để liền mạch |
| 1 | s012-chia-khoa | erika | trái | dien-thoai | a · cảnh | `to: eye [45,45,-10]`, `elbow [-0.3,1,-0.2]`, `roll top→up` mà máy vẫn lăn ~35° (cổ tay kẹp); ảnh s009 trùng từng pixel với s015 (lô 2 chấm đạt) — cùng khoá | đổi chỗ tay/khuỷu cho cổ tay đạt `roll` (hạ khuỷu, đưa máy ra trước, khớp s011 `to: chin [40,16,8]`, `elbow [-0.3,1,1]`); soát `check` báo `wrist` | C3 ← R1 | cùng bộ khoá ở s011, s015, s016, s023, s024, s027, s028 (người soi chấm đạt): áp cùng cách sửa để liền mạch |
| 1 | s013-khoe | takumi | phải | the-phong | a · cảnh | mốc t=0 `edge bottom, up front, roll top→forward` rồi 0.8s `to: hip` `edge top`… — khác dáng cuối s012 (thẻ kẹp bên dựng xiên trước bụng) | mốc đầu s013 chép đúng khoá cuối s012 (at/elbow/edge/thumb/hướng), chỉ đổi sang dáng hông sau 0.8s | C3 |  |
| 1 | s013-khoe | erika | trái | dien-thoai | a · cảnh | như s009–s012 (cùng khoá eye/roll), máy lăn ~35° | như s009 | C3 ← R1 |  |
| 2 | s022-cup | yota | trái | ong-nghe-ban | a · cảnh | giữa mốc 1.15 (áp tai, `roll` [-0.3,-1,0]) và 1.3 (`at` [668,-305,1235], bỏ `roll`, `face → head`) ống nghe xoay ngang lún má | giữ áp tai tới khi cúi xong (thêm mốc áp tai muộn hơn), mốc 1.3 giữ `roll` dọc tai–miệng rồi mới hạ; hay tách xa đầu trước khi xoay | C1 |  |
| 2 | s025-chi-the | erika | trái | dien-thoai | a · cảnh | mốc 2.6 `to: chest [38,45,15]`, `face screen→back`: màn hình quay vào bụng, máy sát quai túi | `face screen` về người được chỉ (hay `holderFace` nếu tự xem), đưa máy ra trước/lên (giảm y, tăng tiến), tách quai túi | C3 ← R1 |  |
| 2 | s026-tra-ten | takumi | phải | dien-thoai | a · cảnh | @rut+0.55 `left: null` mà hold `touch self.handL`: tay trái thành nắm đấm tì đầu máy, không ngón nào chạm màn | thêm mốc tay trái `point: tip` lên màn (như tay trái s034), hướng ngón trỏ xuống màn; giữ `touch` | C3 ← R1 | góc trước bị che cả ba giây: chụp lại góc khác (d) |
| 3 | s029-mong-cho | takumi | phải | the-phong | a · cảnh | `to: hip [18,0,36]`, `face holderFace`, `roll bottom→forward`: thẻ chĩa ra trước chọc song gỗ quầy, kẹp như giơ | cầm buông: `roll` mép xa → xuống/ra ngoài đùi (thẻ treo dọc đùi) hay lùi tay khỏi quầy; giữ liền mạch với s028 | C1 |  |
| 3 | s030-khai-vi | yoshie-di | hai tay | khay-suat | b · rig | sheet rim ở mép dày (đáy khay 3–4, đĩa bò 3,9 + chân) ra nắm tay giơ ngón cái, ngón cái không nằm trên vành, bốn ngón không luồn dưới đáy (ảnh s030 sau, g4-sheet-rim bò đá); platform `palm` theo spec ngón cái `free`, `tips` để sau — không biến thể nào ra khay-hai-tay | sau R2: khoá `rim` (hay biến thể mới) hai cạnh ngắn, khay trước bụng, khuỷu ~90° như khay-hai-tay; tách mép sau khay khỏi tạp dề | C4 ← R2 |  |
| 3 | s030-khai-vi | erika | phải | dien-thoai | b · rig | palmBox máy nằm ngửa trước ngực ra nắm đấm kẹp một đầu, ngón không đỡ lưng — cùng khung palmBox với lỗi dáng đọc; hướng máy/va chạm là phần cảnh | sau R1: `face screen → holderFace` với `tilt` cho màn về mắt, lưng máy (camera) về món; tách đầu máy khỏi tay Yoshie | C4 ← R1 |  |
| 3 | s031-bong-tay | erika | phải | dien-thoai | b · rig | palmBox máy nằm ngửa trước ngực ra nắm đấm kẹp một đầu, ngón không đỡ lưng — cùng khung palmBox với lỗi dáng đọc; hướng máy/va chạm là phần cảnh; đầu máy lấn obi Yoshie | như s030; lùi/xoay máy khỏi Yoshie | C4 ← R1 |  |
| 3 | s032-sach | erika | phải | dua | a · cảnh | cùng khoá đũa với s049 (đạt) nhưng thiếu `elbow` và `at` thấp/sát: lòng tay "vào thân 64°" → nắm đứng như dao găm; s049 có `elbow [0.2,0.8,1]` ra "ra trước 75°" khớp g4-chopsticks-truoc-sau; 3.52s @dat+0.4 vẫn cầm, tay hạ → đũa xuyên nồi | thêm `elbow` như s049, chỉnh `at` cho ngọn ra trước chúc 30° (thêm `roll` hai que ngang theo spec); ở @dat thả đũa (`hold: null`) hay đặt lên gác đũa, không hạ tay khi còn cầm | C1 |  |
| 3 | s033-ruou-tang | takumi | phải | chen | a · cảnh | 0–0.5s `to: mouth [10,6.5,0]` không `elbow`: khuỷu nâng ngang vai | thêm `elbow` sát sườn (kiểu chen-ruou-2), đưa offset ra trước hơn; ngón theo `bowl pinch` đã duyệt (#4) | C1 |  |
| 3 | s033-ruou-tang | takumi | phải | chai-dia | a · cảnh | @toreru+0.25 `at [-372,-180,572]` đặt chai lên đĩa nước chấm/lấn nồi đất; 4.27/5.71s đáy chai sát ngón tay trái | dời chỗ đặt (`at`) sang mặt bàn trống, nâng chai khi qua tay trái (y), `elbow` hạ khi nghiêng rót | C1 |  |
| 3 | s034-goi-them | takumi | phải | dua | a · cảnh | như s032: thiếu `elbow`, lòng "vào thân 59–69°", đũa dựng đứng | thêm `elbow` như s049, chỉnh `at`; ngọn ra trước chúc 30° | C1 |  |
| 3 | s034-goi-them | takumi | phải | thuc-don | a · cảnh | `sheet pinch` `edge bottom`, `thumb: back` — spec §3.1: ngón cái mặt sau vượt kẹp cổ tay 17–25°, nên tay xoè phẳng; ngón trỏ tay trái chỉ ra ngoài mép | `thumb: front`, cạnh/góc cùng bên tay (chốt "một tay cầm góc cùng bên", `sideAlong`), `pinch`; tay trái `point: tip` đúng dòng món | C1 | liền mạch với s035, s036 (s036 thuộc job trả-về-cũ) |
| 3 | s035-gia | takumi | phải | thuc-don | a · cảnh | cùng khoá s034 (pinch, thumb back); nắm tay Yoshie chỉ dí vào khớp ngón Takumi | như s034; dời đích ngón chỉ của Yoshie lên dòng giá, xa tay Takumi | C1 |  |
| 3 | s036-lay-het | erika | phải | dien-thoai | b · rig | palmBox máy nằm ngửa trước ngực ra nắm đấm kẹp một đầu, ngón không đỡ lưng — cùng khung palmBox với lỗi dáng đọc; hướng máy/va chạm là phần cảnh; tay duỗi ngang vai | sau R1: hạ khuỷu, đưa máy gần hơn; tách khỏi tay Yoshie | C4 ← R1 |  |
| 3 | s038-tom | yoshie | hai tay | tom-hum | a · cảnh | `rim` ở vành đạt; râu tôm (phần `mon-an`) cong vào cẳng tay trái; mốc @dat chỉ hạ y −162→−154, đĩa còn treo trên bàn | xoay đĩa (`roll` trục `duoi`) hay `slant`/khuỷu cho râu tránh cẳng tay; @dat hạ đáy đĩa tới mặt bàn | C4 |  |
| 3 | s038-tom | erika | phải | dien-thoai | b · rig | palmBox máy nằm ngửa trước ngực ra nắm đấm kẹp một đầu, ngón không đỡ lưng — cùng khung palmBox với lỗi dáng đọc; hướng máy/va chạm là phần cảnh; đầu máy chạm râu tôm; 1.0→1.3s máy lật từ dựng sang nằm | sau R1: một hướng máy suốt cảnh, tách khỏi râu tôm | C4 ← R1 |  |
| 3 | s039-dat-lai-1 | yoshie | hai tay | tom-hum | a · cảnh | như s038: râu tôm vào cẳng tay trái | như s038 | C4 |  |
| 3 | s039-dat-lai-1 | erika | phải | dien-thoai | b · rig | palmBox máy nằm ngửa trước ngực ra nắm đấm kẹp một đầu, ngón không đỡ lưng — cùng khung palmBox với lỗi dáng đọc; hướng máy/va chạm là phần cảnh; đầu máy đè râu tôm; tay duỗi ngang vai | như s038 | C4 ← R1 |  |
| 3 | s040-dat-lai-2 | yoshie | hai tay | tom-hum | a · cảnh | như s038: râu tôm vào cẳng tay trái ở 0.6s | như s038 | C4 |  |
| 3 | s040-dat-lai-2 | erika | phải | dien-thoai | b · rig | palmBox máy nằm ngửa trước ngực ra nắm đấm kẹp một đầu, ngón không đỡ lưng — cùng khung palmBox với lỗi dáng đọc; hướng máy/va chạm là phần cảnh; đầu máy đè râu tôm | như s038 | C4 ← R1 |  |
| 4 | s041-nguoi | yoshie | hai tay | tom-hum | c · đồ đặt video | 0.15, 0.3s đặt: đĩa và đuôi tôm chìm dưới khăn trải bàn ở đầu bàn (`DAU_BAN`, `CHO_DIA`); đĩa thả hạ về `Y_BAN` (`haXuong`, src/khoi3d/t02.ts:494, :515) và mốc tay `item:bottom` y −147/−143 — không tính bề dày/rủ của khăn (`src/objects/ban-an.ts:57`) | đặt mặt đỡ đĩa ở đầu bàn bằng mặt trên khăn (hằng số y riêng cho đầu bàn hay dời `CHO_DIA` vào trong khăn); sửa y `item:bottom` các mốc đặt/nhấc trong ba cảnh cho khớp | V1 |  |
| 4 | s042-lam-lai | yoshie | hai tay | tom-hum | c · đồ đặt video | 2.15s nhấc: đĩa và đuôi tôm chìm dưới khăn trải bàn ở đầu bàn (`DAU_BAN`, `CHO_DIA`); đĩa thả hạ về `Y_BAN` (`haXuong`, src/khoi3d/t02.ts:494, :515) và mốc tay `item:bottom` y −147/−143 — không tính bề dày/rủ của khăn (`src/objects/ban-an.ts:57`) | đặt mặt đỡ đĩa ở đầu bàn bằng mặt trên khăn (hằng số y riêng cho đầu bàn hay dời `CHO_DIA` vào trong khăn); sửa y `item:bottom` các mốc đặt/nhấc trong ba cảnh cho khớp | V1 |  |
| 4 | s045-cui | yoshie | hai tay | tom-hum | c · đồ đặt video | 0.47s đặt: đĩa và đuôi tôm chìm dưới khăn trải bàn ở đầu bàn (`DAU_BAN`, `CHO_DIA`); đĩa thả hạ về `Y_BAN` (`haXuong`, src/khoi3d/t02.ts:494, :515) và mốc tay `item:bottom` y −147/−143 — không tính bề dày/rủ của khăn (`src/objects/ban-an.ts:57`) | đặt mặt đỡ đĩa ở đầu bàn bằng mặt trên khăn (hằng số y riêng cho đầu bàn hay dời `CHO_DIA` vào trong khăn); sửa y `item:bottom` các mốc đặt/nhấc trong ba cảnh cho khớp | V1 |  |
| 4 | s049-da-trong | erika | phải | dua | a · cảnh | 2.38/4.37s đạt (khớp g4-chopsticks-truoc-sau); @nedan (4.72) dời tay xuống bát `at [-195,-158,700]`, thả ở @nedan+0.05 → 4.77s cổ tay gập, đũa dựng | giữ hướng đũa tới lúc thả (thêm `face`/`roll` hay bớt hạ y ở @nedan), đặt đũa nằm lên bát/gác đũa | C1 |  |
| 4 | s051-bep-3 | yoshie | hai tay | bo-da | b · rig | sheet rim ở mép dày (đáy khay 3–4, đĩa bò 3,9 + chân) ra nắm tay giơ ngón cái, ngón cái không nằm trên vành, bốn ngón không luồn dưới đáy (ảnh s030 sau, g4-sheet-rim bò đá); platform `palm` theo spec ngón cái `free`, `tips` để sau — không biến thể nào ra khay-hai-tay | sau R2: chép khoá mới; bếp đá nặng: bốn ngón dưới đáy, ngón cái trên vành | C5 ← R2 |  |
| 4 | s053-hanh-lang | erika | trái | dien-thoai | b · rig | palmBox dọc trước cằm/màn về mắt ra nắm tay giơ ngón cái kẹp mép đáy, ngón không tì lưng máy; cùng dáng ở s011 (lô 1 chấm đạt) và hàng "đọc ngang mặt" của g4-palmBox-thu-dien-thoai (mọi tilt/thumb) — khoá cảnh (thumb, tilt 0–25, along) không đổi được | sau R1: giữ `to: chin` `face back → yota`; soát lại dáng | C5 ← R1 | Yota khay s053 (lô 4 chấm đạt, cùng khoá platform với s054) sửa cùng để liền mạch |
| 5 | s054-xin-loi | yota | hai tay | khay | b · rig | platform `palm` hiện hành: hai lòng xoè dưới đáy, không ngón cái trên vành; sheet rim ở mép dày (đáy khay 3–4, đĩa bò 3,9 + chân) ra nắm tay giơ ngón cái, ngón cái không nằm trên vành, bốn ngón không luồn dưới đáy (ảnh s030 sau, g4-sheet-rim bò đá); platform `palm` theo spec ngón cái `free`, `tips` để sau — không biến thể nào ra khay-hai-tay | sau R2: đổi sang biến thể mới (ngón cái trên vành cạnh ngắn, bốn ngón dưới đáy), khay trước bụng, khuỷu ~90° | C5 ← R2 |  |
| 5 | s054-xin-loi | erika | trái | dien-thoai | b · rig | palmBox dọc trước cằm/màn về mắt ra nắm tay giơ ngón cái kẹp mép đáy, ngón không tì lưng máy; cùng dáng ở s011 (lô 1 chấm đạt) và hàng "đọc ngang mặt" của g4-palmBox-thu-dien-thoai (mọi tilt/thumb) — khoá cảnh (thumb, tilt 0–25, along) không đổi được | sau R1: giữ khoá hiện hành, soát lại | C5 ← R1 |  |
| 5 | s055-nhan-viec | yota | hai tay | khay | b · rig | platform `palm` hiện hành: hai lòng xoè dưới đáy, không ngón cái trên vành; sheet rim ở mép dày (đáy khay 3–4, đĩa bò 3,9 + chân) ra nắm tay giơ ngón cái, ngón cái không nằm trên vành, bốn ngón không luồn dưới đáy (ảnh s030 sau, g4-sheet-rim bò đá); platform `palm` theo spec ngón cái `free`, `tips` để sau — không biến thể nào ra khay-hai-tay | sau R2: đổi sang biến thể mới (ngón cái trên vành cạnh ngắn, bốn ngón dưới đáy), khay trước bụng, khuỷu ~90° | C5 ← R2 |  |
| 5 | s055-nhan-viec | chiaki-nhan | hai tay | khay | b · rig | platform `palm` hiện hành (cùng khoá Yota): lòng xoè dưới đáy; sheet rim ở mép dày (đáy khay 3–4, đĩa bò 3,9 + chân) ra nắm tay giơ ngón cái, ngón cái không nằm trên vành, bốn ngón không luồn dưới đáy (ảnh s030 sau, g4-sheet-rim bò đá); platform `palm` theo spec ngón cái `free`, `tips` để sau — không biến thể nào ra khay-hai-tay | như Yota s054 | C5 ← R2 | chiaki-nhan ẩn tới 3.725s: chụp lại ở giây ≥ 3.73 (d) |
| 5 | s055-nhan-viec | erika | trái | dien-thoai | b · rig | palmBox dọc trước cằm/màn về mắt ra nắm tay giơ ngón cái kẹp mép đáy, ngón không tì lưng máy; cùng dáng ở s011 (lô 1 chấm đạt) và hàng "đọc ngang mặt" của g4-palmBox-thu-dien-thoai (mọi tilt/thumb) — khoá cảnh (thumb, tilt 0–25, along) không đổi được | sau R1: giữ khoá hiện hành, soát lại | C5 ← R1 |  |
| 5 | s056-bieu | chiaki-nhan | hai tay | khay | b · rig | platform `palm` hiện hành (cùng khoá Yota): lòng xoè dưới đáy; sheet rim ở mép dày (đáy khay 3–4, đĩa bò 3,9 + chân) ra nắm tay giơ ngón cái, ngón cái không nằm trên vành, bốn ngón không luồn dưới đáy (ảnh s030 sau, g4-sheet-rim bò đá); platform `palm` theo spec ngón cái `free`, `tips` để sau — không biến thể nào ra khay-hai-tay | như Yota s054 | C5 ← R2 |  |
| 5 | s056-bieu | erika | trái | dien-thoai | b · rig | palmBox dọc trước cằm/màn về mắt ra nắm tay giơ ngón cái kẹp mép đáy, ngón không tì lưng máy; cùng dáng ở s011 (lô 1 chấm đạt) và hàng "đọc ngang mặt" của g4-palmBox-thu-dien-thoai (mọi tilt/thumb) — khoá cảnh (thumb, tilt 0–25, along) không đổi được | sau R1: giữ khoá hiện hành, soát lại | C5 ← R1 |  |
| 5 | s057-moi | chiaki-nhan | hai tay | khay | b · rig | platform `palm` hiện hành (cùng khoá Yota): lòng xoè dưới đáy; sheet rim ở mép dày (đáy khay 3–4, đĩa bò 3,9 + chân) ra nắm tay giơ ngón cái, ngón cái không nằm trên vành, bốn ngón không luồn dưới đáy (ảnh s030 sau, g4-sheet-rim bò đá); platform `palm` theo spec ngón cái `free`, `tips` để sau — không biến thể nào ra khay-hai-tay | như Yota s054 | C5 ← R2 |  |
| 5 | s057-moi | erika | trái | dien-thoai | b · rig | palmBox dọc trước cằm/màn về mắt ra nắm tay giơ ngón cái kẹp mép đáy, ngón không tì lưng máy; cùng dáng ở s011 (lô 1 chấm đạt) và hàng "đọc ngang mặt" của g4-palmBox-thu-dien-thoai (mọi tilt/thumb) — khoá cảnh (thumb, tilt 0–25, along) không đổi được; 3.54s (mốc 1.35 `at [134,-288,-160]`, `elbow [0.83,1,-0.55]`) máy úp ngực, khuỷu dang | sau R1; thêm: đổi mốc 1.35 thành tay hạ cầm máy trước bụng (hay giữ dáng quay dưới cằm), khuỷu sát sườn | C5 ← R1 |  |
| 5 | s058-quan-truoc | chiaki-nhan | hai tay | khay | b · rig | platform `palm` hiện hành (cùng khoá Yota): lòng xoè dưới đáy; sheet rim ở mép dày (đáy khay 3–4, đĩa bò 3,9 + chân) ra nắm tay giơ ngón cái, ngón cái không nằm trên vành, bốn ngón không luồn dưới đáy (ảnh s030 sau, g4-sheet-rim bò đá); platform `palm` theo spec ngón cái `free`, `tips` để sau — không biến thể nào ra khay-hai-tay | như Yota s054 | C5 ← R2 |  |
| 5 | s058-quan-truoc | erika | trái | dien-thoai | b · rig | palmBox dọc trước cằm/màn về mắt ra nắm tay giơ ngón cái kẹp mép đáy, ngón không tì lưng máy; cùng dáng ở s011 (lô 1 chấm đạt) và hàng "đọc ngang mặt" của g4-palmBox-thu-dien-thoai (mọi tilt/thumb) — khoá cảnh (thumb, tilt 0–25, along) không đổi được; `at [134,-288,-160]` `elbow [0.83,1,-0.55]` dí máy vào xương quai xanh, khuỷu dang | sau R1; thêm: đưa máy ra trước cằm (`to: chin` như s054–s056) hay hạ trước bụng, khuỷu sát sườn | C5 ← R1 |  |
| 5 | s059-gia-da-bao | chiaki-nhan | hai tay | khay | b · rig | platform `palm` hiện hành (cùng khoá Yota): lòng xoè dưới đáy; sheet rim ở mép dày (đáy khay 3–4, đĩa bò 3,9 + chân) ra nắm tay giơ ngón cái, ngón cái không nằm trên vành, bốn ngón không luồn dưới đáy (ảnh s030 sau, g4-sheet-rim bò đá); platform `palm` theo spec ngón cái `free`, `tips` để sau — không biến thể nào ra khay-hai-tay | như Yota s054 | C5 ← R2 |  |
| 5 | s059-gia-da-bao | erika | trái | dien-thoai | b · rig | palmBox dọc trước cằm/màn về mắt ra nắm tay giơ ngón cái kẹp mép đáy, ngón không tì lưng máy; cùng dáng ở s011 (lô 1 chấm đạt) và hàng "đọc ngang mặt" của g4-palmBox-thu-dien-thoai (mọi tilt/thumb) — khoá cảnh (thumb, tilt 0–25, along) không đổi được; `at [134,-288,-160]` `elbow [0.83,1,-0.55]` dí máy vào xương quai xanh, khuỷu dang | sau R1; thêm: đưa máy ra trước cằm (`to: chin` như s054–s056) hay hạ trước bụng, khuỷu sát sườn | C5 ← R1 |  |
| 5 | s060-mot-dem | chiaki-nhan | hai tay | khay | b · rig | platform `palm` hiện hành (cùng khoá Yota): lòng xoè dưới đáy; sheet rim ở mép dày (đáy khay 3–4, đĩa bò 3,9 + chân) ra nắm tay giơ ngón cái, ngón cái không nằm trên vành, bốn ngón không luồn dưới đáy (ảnh s030 sau, g4-sheet-rim bò đá); platform `palm` theo spec ngón cái `free`, `tips` để sau — không biến thể nào ra khay-hai-tay | như Yota s054 | C5 ← R2 | chụp thêm lúc cúi chào @dong+0.1 ≈ 6.6s (d) |
| 5 | s060-mot-dem | erika | trái | dien-thoai | b · rig | palmBox dọc trước cằm/màn về mắt ra nắm tay giơ ngón cái kẹp mép đáy, ngón không tì lưng máy; cùng dáng ở s011 (lô 1 chấm đạt) và hàng "đọc ngang mặt" của g4-palmBox-thu-dien-thoai (mọi tilt/thumb) — khoá cảnh (thumb, tilt 0–25, along) không đổi được; 0.3–0.4s máy áp phẳng ngực/bụng, cẳng tay vắt ngang | sau R1; thêm: mốc 0/0.25 nối từ dáng cuối s059, không ép máy vào thân | C5 ← R1 |  |
| 5 | s061-sang | erika | trái | tui-hieu | a · cảnh | `carry on: elbow`, `to: shoulder [48,34,50]`, `elbow [0,1,1.5]`: cẳng tay chĩa ra ngoài; bản HEAD [38,18,34]/[-0.5,1,1] ở cảnh này cẳng tay dựng đứng, túi lấn bụng; s003 [48,50,50]/[0,1,1.5] được chấm đạt | chỉnh offset/elbow tới khi cẳng tay ra trước gần ngang, túi treo ngoài hông, quai không lấn bụng (mẫu tui-xach-khuyu); thử từ s003 [48,50,50], `elbow` hướng xuống-ra trước | C2 |  |
| 5 | s061-sang | ong-khach | hai tay | bao | a · cảnh | `sheet rim` hai cạnh, `slant 36.6` → nắm đấm giơ ngón cái quanh mép (cùng lỗi rim ở g4-sheet-rim "thu-bao"); đọc báo cần kẹp mép | đổi `variant: pinch`, `thumb: front` (mặt quay về người đọc, như bang-gia-doc đã duyệt), hai cạnh trái/phải, bỏ `slant` lớn; rim chờ R2 nếu pinch không đạt | C2 |  |
| 5 | s062-hoa-don | erika | trái | tui-hieu | a · cảnh | `carry on: elbow`, `to: shoulder [48,34,50]`, `elbow [0,1,1.5]`: cẳng tay chĩa ra ngoài; bản HEAD [38,18,34]/[-0.5,1,1] ở cảnh này cẳng tay dựng đứng, túi lấn bụng; s003 [48,50,50]/[0,1,1.5] được chấm đạt | chỉnh offset/elbow tới khi cẳng tay ra trước gần ngang, túi treo ngoài hông, quai không lấn bụng (mẫu tui-xach-khuyu); thử từ s003 [48,50,50], `elbow` hướng xuống-ra trước | C2 |  |
| 5 | s062-hoa-don | ong-khach | hai tay | bao | a · cảnh | `sheet rim` hai cạnh, `slant 36.6` → nắm đấm giơ ngón cái quanh mép (cùng lỗi rim ở g4-sheet-rim "thu-bao"); đọc báo cần kẹp mép | đổi `variant: pinch`, `thumb: front` (mặt quay về người đọc, như bang-gia-doc đã duyệt), hai cạnh trái/phải, bỏ `slant` lớn; rim chờ R2 nếu pinch không đạt | C2 |  |
| 5 | s063-hoa-don | erika | trái | tui-hieu | a · cảnh | `carry on: elbow`, `to: shoulder [48,34,50]`, `elbow [0,1,1.5]`: cẳng tay chĩa ra ngoài; bản HEAD [38,18,34]/[-0.5,1,1] ở cảnh này cẳng tay dựng đứng, túi lấn bụng; s003 [48,50,50]/[0,1,1.5] được chấm đạt | chỉnh offset/elbow tới khi cẳng tay ra trước gần ngang, túi treo ngoài hông, quai không lấn bụng (mẫu tui-xach-khuyu); thử từ s003 [48,50,50], `elbow` hướng xuống-ra trước | C2 |  |
| 5 | s063-hoa-don | ong-khach | hai tay | bao | a · cảnh | `sheet rim` hai cạnh, `slant 36.6` → nắm đấm giơ ngón cái quanh mép (cùng lỗi rim ở g4-sheet-rim "thu-bao"); đọc báo cần kẹp mép | đổi `variant: pinch`, `thumb: front` (mặt quay về người đọc, như bang-gia-doc đã duyệt), hai cạnh trái/phải, bỏ `slant` lớn; rim chờ R2 nếu pinch không đạt | C2 |  |
| 5 | s064-tat-ca | takumi | hai tay | hoa-don | a · cảnh | `sheet flat` hai tay cùng cạnh `bottom`: lòng ngửa đỡ mép giấy (chốt: giấy mỏng không đặt trên lòng tay), cổ tay bẻ ngửa | `variant: pinch`, `thumb: front` (đọc), hai tay hai cạnh trái/phải hay hai góc dưới cùng bên tay | C2 | góc trước đen hoàn toàn: chụp lại (d) |
| 5 | s064-tat-ca | erika | trái | tui-hieu | a · cảnh | `carry on: elbow`, `to: shoulder [48,34,50]`, `elbow [0,1,1.5]`: cẳng tay chĩa ra ngoài; bản HEAD [38,18,34]/[-0.5,1,1] ở cảnh này cẳng tay dựng đứng, túi lấn bụng; s003 [48,50,50]/[0,1,1.5] được chấm đạt | chỉnh offset/elbow tới khi cẳng tay ra trước gần ngang, túi treo ngoài hông, quai không lấn bụng (mẫu tui-xach-khuyu); thử từ s003 [48,50,50], `elbow` hướng xuống-ra trước | C2 |  |
| 5 | s065-ghi-ro | erika | trái | tui-hieu | a · cảnh | `carry on: elbow`, `to: shoulder [48,34,50]`, `elbow [0,1,1.5]`: cẳng tay chĩa ra ngoài; bản HEAD [38,18,34]/[-0.5,1,1] ở cảnh này cẳng tay dựng đứng, túi lấn bụng; s003 [48,50,50]/[0,1,1.5] được chấm đạt | chỉnh offset/elbow tới khi cẳng tay ra trước gần ngang, túi treo ngoài hông, quai không lấn bụng (mẫu tui-xach-khuyu); thử từ s003 [48,50,50], `elbow` hướng xuống-ra trước | C2 |  |
| 5 | s066-day-lai | erika | trái | tui-hieu | a · cảnh | `carry on: elbow`, `to: shoulder [48,34,50]`, `elbow [0,1,1.5]`: cẳng tay chĩa ra ngoài; bản HEAD [38,18,34]/[-0.5,1,1] ở cảnh này cẳng tay dựng đứng, túi lấn bụng; s003 [48,50,50]/[0,1,1.5] được chấm đạt | chỉnh offset/elbow tới khi cẳng tay ra trước gần ngang, túi treo ngoài hông, quai không lấn bụng (mẫu tui-xach-khuyu); thử từ s003 [48,50,50], `elbow` hướng xuống-ra trước | C2 |  |
| 5 | s066-day-lai | ong-khach | hai tay | bao | a · cảnh | `sheet rim` hai cạnh, `slant 36.6` → nắm đấm giơ ngón cái quanh mép (cùng lỗi rim ở g4-sheet-rim "thu-bao"); đọc báo cần kẹp mép | đổi `variant: pinch`, `thumb: front` (mặt quay về người đọc, như bang-gia-doc đã duyệt), hai cạnh trái/phải, bỏ `slant` lớn; rim chờ R2 nếu pinch không đạt | C2 |  |

## Job đề xuất

Thứ tự: R1 → R2 (cùng `graspSolve.ts`, `graspGroups.ts`: chạy lần lượt). V1, C1, C2 chạy song song ngay, không đụng file của nhau. C3, C4, C5 chờ job rig mà chúng cần; C3 và s036 còn chờ job trả về cũ xong, vì cùng file cảnh.

### R1 — rig · palmBox

Dáng palmBox "đọc/quay dọc" theo mẫu dien-thoai-doc: trỏ–giữa–áp út tì lưng máy, út đỡ cạnh đáy, ngón cái phía màn hình sát cạnh bên; không ra nắm tay giơ ngón cái khi máy dọc trước cằm (màn về mắt) hay nằm ngửa trước ngực. Thử: hàng "đọc ngang mặt", "khoe một tay" của g4-palmBox-thu-dien-thoai; cảnh s054 0.3s, s036 2.7s, s011 3.14s.
- Code: `packages/rig/src/core/graspSolve.ts (palmBox :444, BOX_RISE/BOX_SHIFT/BOX_GAP :206)`; `packages/rig/src/core/graspGroups.ts (palmBox :841, roles/tilt)`; `packages/rig/src/core/hand.ts (dáng span)`; `packages/rig/src/core/heldFit.ts`; `docs/11-nhom-cam.md §3.9`

### R2 — rig · sheet rim / platform

Bê khay/đĩa nặng hai tay theo mẫu khay-hai-tay, dia-thuc-an-hai-tay: ngón cái nằm trên mặt trên sát mép (vành), bốn ngón cong ôm cạnh và luồn dưới đáy, lòng ngửa chếch vào món. Hiện `rim` ở mép dày (khay 3–4, đĩa bò 3,9 + chân) ra nắm giơ ngón cái; `platform palm` để ngón cái `free`. Sửa `rim` cho mép dày (dáng theo bề dày thật, RIM_THUMB) hay thêm biến thể platform có ngón cái trên vành; giữ tôm hùm `rim` vành mỏng (đạt). Thử: khay (cạnh ngắn), khay-suat (vành 4×4), bo-da.
- Phụ thuộc: R1 (cùng graspSolve.ts, chạy sau)
- Code: `packages/rig/src/core/graspSolve.ts (rim: RIM_TOP/RIM_OUT/RIM_MIN :195–204, thickAt)`; `packages/rig/src/core/graspGroups.ts (sheet rim RIM_THUMB, platform palm)`; `docs/11-nhom-cam.md §3.1 rim, §3.10`

### V1 — video-src

Đĩa tôm hùm chìm khăn trải bàn ở đầu bàn khi đặt/nhấc: mặt đỡ ở `DAU_BAN`/`CHO_DIA` và `haXuong(… Y_BAN)` không tính khăn; sửa y mặt đỡ (src) và y `item:bottom` trong ba cảnh.
- Cảnh (3): s041-nguoi, s042-lam-lai, s045-cui
- Lần cầm: 3
- Code: `src/khoi3d/t02.ts (:417 MAT_BAN_CAP, :460 CHO_DIA, :494 haXuong, :515 tomTrenBan)`; `src/objects/ban-an.ts (:57 khăn)`

### C1 — canh

Ống nghe, thẻ hông, đũa, chén/chai, thực đơn: chỉ khoá cảnh.
- Cảnh (7): s022-cup, s029-mong-cho, s032-sach, s033-ruou-tang, s034-goi-them, s035-gia, s049-da-trong
- Lần cầm: 9

### C2 — canh

Túi Erika khoác khuỷu, báo ông khách (pinch), hoá đơn Takumi (pinch).
- Cảnh (6): s061-sang, s062-hoa-don, s063-hoa-don, s064-tat-ca, s065-ghi-ro, s066-day-lai
- Lần cầm: 11

### C3 — canh

Điện thoại Erika/Takumi lô đầu (roll, sát má, màn quay bụng, tay trái tra tên), túi Takumi s006a, thẻ s013. Sau khi xong, soát lại s011, s015, s016, s023, s024, s027, s028 cùng bộ khoá máy.
- Cảnh (8): s006a-bai-xe, s008-truoc-cua, s009-nhan-khach, s010-xac-nhan, s012-chia-khoa, s013-khoe, s025-chi-the, s026-tra-ten
- Lần cầm: 10
- Phụ thuộc: R1; job trả-về-cũ đang chạy (cùng file cảnh: túi Erika ở cả 8 cảnh) phải xong trước

### C4 — canh

Máy quay món của Erika, râu tôm hùm, khay khai vị.
- Cảnh (6): s030-khai-vi, s031-bong-tay, s036-lay-het, s038-tom, s039-dat-lai-1, s040-dat-lai-2
- Lần cầm: 10
- Phụ thuộc: R1; R2 (s030 khay-suat); s036: job trả-về-cũ (thực đơn Takumi) xong trước

### C5 — canh

Khay quà Yota/Chiaki theo khay-hai-tay, bếp đá, máy quay lén của Erika; chụp bù s055 ≥ 3.73s, s060 ≈ 6.6s.
- Cảnh (9): s051-bep-3, s053-hanh-lang, s054-xin-loi, s055-nhan-viec, s056-bieu, s057-moi, s058-quan-truoc, s059-gia-da-bao, s060-mot-dem
- Lần cầm: 17
- Phụ thuộc: R1; R2

## Cần chủ dự án quyết

Không có. Các chỗ đã chọn mặc định (mỗi chỗ một dòng):

- Khay quà chở chai 1.8L (s053–s060) cầm theo khay-hai-tay, không giữ hai lòng ngửa kiểu dâng quà.
- Đọc báo, đọc hoá đơn dùng `sheet pinch` với ngón cái ở mặt hướng về người đọc (như bang-gia-doc). Ngón cái mặt sau thì cổ tay vượt kẹp (spec §3.1).
- Thực đơn một tay cầm góc cùng bên tay, ngón cái mặt trước (theo chốt "một tay cầm góc cùng bên").
