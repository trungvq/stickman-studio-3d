File trung gian của nhánh `feat/khuyu`, xoá trước khi squash merge (xem `KHUYU.md`). Script khảo sát ở `khuyu-harness/tuong-tac/`.

# Khảo sát tương tác tay với đồ: t01 + t02, đề xuất thư viện hành động chung

## Tóm tắt

- **Quy mô:** quét 274 cảnh t01/t02 ra 2.847 mốc `world.hands`.
  - 1.208 mốc là toạ độ thế giới `at`. Dời người hay dời quầy là các mốc này vỡ.
  - 1.370 mốc khai `elbow` bằng tay.
  - 67 mốc `elbowLock` (vá), dồn ở 21 cặp người–cảnh t02. Nặng nhất: s066 có 12, s044 có 11.
- **Lỗi lặp lại** thấy trong 91 commit `fix`:
  - điện thoại và ống nghe: 31 commit;
  - giấy, hoá đơn: 11;
  - khuỷu lật hay giật: 12 + 7;
  - tay hay món lún vào thân, quầy: 14;
  - túi: 9.
- **Hành động có sẵn ít được dùng lại:**
  - Hành động tương tác của repo phần lớn chỉ chạy ở 1–7 cảnh, vì số đích tinh chỉnh theo một người, một độ cao quầy.
  - Hành động 3D chung của studio gần như không dùng (`phone-ear-3d`, `cover-mouth-3d`, `arms-on-table-3d`, `hands-behind-3d`, `clap-3d`: 0 cảnh). Repo đã chép lại bản riêng.
  - Nhiều cặp chỉ để đổi tay: `-gan`/`-xa`, `-nguoc`.
- **Giới hạn rig lớn nhất:** hành động không mang được món (`hold`), không nhắm được mốc món (`item:*`), mặt quầy hay người khác, và clip không nhận tham số. Vì vậy mọi chuỗi với → cầm → đưa → thả đều phải viết tay trong `world.hands` của từng cảnh.
- **Có một đường dùng được ngay:** mốc cảnh chỉ khai `hold` mà không khai đích thì chỗ tay theo hành động, món gắn vào tay (docs 03 § Đồ cầm tay).
- **Đề xuất ba bước:**
  - A. Khoảng 45 hành động chung chỉ đặt dáng, đích theo mốc thân và lòng tay theo ý. Làm được ngay.
  - B. Một công cụ "công thức tương tác" sinh `world.hands` và `items` từ hàm rig, kèm đo tầm với.
  - C. Mở schema để hành động mang `slots` (món, người nhận, mặt đỡ), `hold` theo pha, và `point: item:*`.

## Bảng thống kê (top 30)

"người-cảnh" là một người trong một cảnh.

| # | Tương tác | Món × nhóm | Ngữ cảnh | Tần suất | Cảnh mẫu | Thủ công / lỗi |
|---|---|---|---|---|---|---|
| 1 | Hai tay chồng trước bụng (chờ, tiếp khách) | – (`belly` + `otherBack`) | đứng | 396 clip, ~229 người-cảnh | t02-s030-khai-vi, t01-s038-chia | d6f9e75: ngón lồng nhau |
| 2 | Tay úp trên đùi | – (`thigh`, palm down) | seiza, ghế | `seiza-tay-dui` 310 clip; 198 mốc tay | t01-s001-dt (đoàn), t01-s105-tiec | |
| 3 | Tay tì tay vịn hay mặt bàn khi ngồi | – (`at`, palm down) | ghế bành, bàn | 278 mốc, 70 người-cảnh | t01-s042-bao-gia | Q106: bụng che tay |
| 4 | Tay úp trên quầy: tì, ép giấy, đẩy | – / giấy | đứng, quầy | 143 mốc `at`, 37 người-cảnh; `t02-tay-ep` 13 cảnh | t02-s066-day-lai, t01-s009 | Q115: cẳng tay lấn quầy; 8a51835: khuỷu bật |
| 5 | Cầm điện thoại xem, bấm trước ngực | dien-thoai@palmBox | đứng, ngồi | t02: 42 lần cầm, 38 cảnh; t01: 13 cảnh + ~110 người-cảnh đoàn | t02-s009, t02-s041, t01-s001 | S62 ngón gõ ra ngoài máy; 2f6047d cổ tay quất |
| 6 | Áp tai: điện thoại, ống nghe | dien-thoai, ong-nghe(-ban)@cylinder | đứng, ngồi | `ear` 75 mốc, ~45 cảnh; t01 `ong` 13 cảnh | t02-s017-goi (50 mốc), t02-s136 (47) | cbb1aeb rung; Q121/Q124 gác máy |
| 7 | Túi khoác khuỷu | tui-hieu@carry/elbow | đứng | 50 lần treo, 49 cảnh | t02-s093-live, t02-s105 | Q64 túi lấn người; Q15/Q91 một tay không giữ được hai món |
| 8 | Xách túi quai thõng | tui@handle | đứng, đi | 25 lần, 25 cảnh; 42 mốc `hip`+hold | t02-s003b, t02-s102-vao | 94998d4 túi lún đùi; 390aa3e, b02707e lòng tay ngửa |
| 9 | Chắp tay sau lưng | – | đứng, đi | 98 clip, 50 cảnh | t02 ông khách | trùng `hands-behind-3d` |
| 10 | Khoanh tay (nay cấm) | – | đứng | ~105 clip, 52 cảnh (chỉ t01) | t01 | cẳng tay thò ra |
| 11 | Đọc báo hai tay | bao@sheet (rim) | ngồi | 23 lần, 24 cảnh | t02-s109, t02-s082 | Q129, ac2f9c6 |
| 12 | Chống nạnh | – (`hip`, palm in) | đứng | 27 clip + 23 mốc thủ công | t02-s066 (khoá 12) | 8a51835 |
| 13 | Cúi chào kèm tay bụng | – | đứng | ~45 clip, ~38 cảnh | t02-s054 | |
| 14 | Bưng rồi đặt đĩa xuống bàn | tom-hum, bo-da@sheet/rim | đứng → bàn | 94 mốc, 11 cảnh | t02-s040b-tua (63 mốc: đặt–lùi–tiến lặp 8 lần) | 0c84032 đĩa lún; 57b7f8a bỏ dáng cúi |
| 15 | Đưa, nhận giấy tờ hay thẻ | giay-to, the, the-phong@card | quầy, tay người | 22 lần; chỉ **1 cảnh** đổi `cast` thật | t02-s009, t02-s122, t02-s028 | 6813a8a, 59c2a93: khuỷu với thẻ |
| 16 | Hoá đơn, biên lai: đặt, đẩy, cầm đọc | bien-lai, hoa-don, phieu@sheet | quầy | 13 lần (36 mốc); t01 phieu 14 cảnh | t02-s116, t02-s062, t01-s129 | 263a8ee; f9f6f05 kiểu cầm lệch qua cú cắt |
| 17 | Viết bút | but@pen (+ phiếu platform) | quầy, tay đỡ | 5 lần nhưng 31/26/19 mốc | t02-s017, t02-s050, t02-s136 | 3b90b47 tay viết rung |
| 18 | Ăn đũa | dua@chopsticks | ngồi bàn | 7 lần, 41 mốc | t02-s034 (13), t02-s048 | fe444c9 khuỷu; 9347dbb đũa xuyên bàn |
| 19 | Khay: bưng, ôm, đỡ | khay@platform | đứng, đi | 9 lần + `om-khay` 12 cảnh + `bung-khay` 5 cảnh | t02-s053, t02-s054 | Q40 khuỷu bật khi cúi |
| 20 | Bộ đàm | bo-dam@cylinder | đứng | 15 lần, 15 cảnh | t02-s102-vao | |
| 21 | Rót rượu, cầm chén | chai-dia@cylinder, chen@bowl | seiza, bàn | t01 14 cảnh; t02-s033 | t01-s105, t02-s033 | a4aee9f khuỷu khi nhấp; khoá 2 |
| 22 | Uống, nâng ly | chen, ly-bia | ngồi | `nang-ly` 19 clip; `uong` 2; `mouth`+hold 4 | t01 tiệc, t02-s033 | |
| 23 | Cầm máy quay, phát trực tiếp | dien-thoai (cằm, hai tay) | đứng | `quay-dt` 12 cảnh; `chin`+hold 10 | t02-s093-live | 09fe14f |
| 24 | Tay áp ngực | – (`chest`) | đứng | ~30 mốc + `vo-nguc` | t02-s105, t02-s114 | b3c4007: dáng **khấn phật** (palm in, fingers up) |
| 25 | Che miệng, tay lên cằm, xoa cổ | – (`mouth`, `chin`) | đứng, ngồi | 16 mốc + `che-mieng` 4 cảnh | t02-s046, t02-s066 | xoa cổ phải khoá khuỷu |
| 26 | Chỉ, mời tay | – (`tip`) | đứng | ~110 mốc `tip` thủ công | t01-s109, t02-s095 | `moi-tay-xa` 0b893dd khuỷu vào thân |
| 27 | Cúi với qua quầy, cúi đặt | – | đứng, quầy | `cui-dat` 11, `voi-quay` 7, `t02-nga-day` 2 cảnh | t02-s002/s081 | Q115 |
| 28 | Ôm, mở kẹp hồ sơ | kep-ho-so (đường cũ) | đứng | `om-ho-so` 17, `mo-ho-so` 5 cảnh | t01 課長 | nhóm `hug` chưa làm |
| 29 | Vỗ tay | – | đứng, ngồi | 30 clip, 3 cảnh | t01-s039, s107 | trùng `clap-3d` |
| 30 | Gõ cổ tay "trễ rồi" | – (`otherWrist`, tip) | ngồi | 26 mốc, khoá 11 | t02-s044-cham | đúng mẫu đồng hồ tập 3 |

Còn lặt vặt: kéo vali (2), nhặt túi dưới sàn (1), lau bàn thấp (1), lật cá (1), đẩy kính (1).

Các cảnh khai tay dài nhất: t02-s040b-tua (yoshie 126 mốc), s050-them-bo (54), t01-s006 (53), t02-s017-goi (50), s136 (47), s041 (38). Chỉ 35 cảnh dùng `items[]`; còn lại đi đường tay dẫn hoặc đường cũ của t01 (`dtTheoLich`, `vatTheoLich`, `giayTheoLich` trong `src/khoi3d/canh.ts`).

## Hành động sẵn có và lỗ hổng

**Repo video.** 556 file, trong đó ~330 file máy sinh (`lip-*`, `thoai-*`, `face-*`). Phần soạn tay chia ba loại:
- **Dùng nhiều, nên đưa lên studio:** `dung-tay-bung(-vay)`, `seiza-tay-dui`, `chap-tay-sau`, `chong-nanh*` (anatomical), `khoac-tui-khuyu-*` (anatomical), `om-ho-so`, `om-khay`, `quay-dt`, `t02-tay-ep`, `cui-dat`, `voi-quay`, họ `ojigi*`.
- **Dùng 1–7 cảnh:** `cam-dt`, `uong`, `nang-ly`, `quy-rot-ruou`, `viet`, `gap-so`, `bung-khay`, `xach-tui`, `nhac-tui`, `keo-vali`, `lau-ban`, `lat-ca`, `ap-tai`/`ha-tai` (0). Các hành động này đặt đích `at` hệ thân tinh chỉnh cho một người, một quầy (ví dụ `uong` [70,−100,40]→[66,−150,14]; `bung-khay` "ngang eo").
- **Dáng riêng nhân vật:** `dung-bung` (bụng phệ), `khoanh-tay-phe*`, `ngoi-nga`, `bat-day`, `ngoi-phich` (ghế bành), `chong-khuyu-quay`.

**Trùng nhau:**
- Repo với studio: `ap-tai`↔`phone-ear-3d`, `che-mieng`↔`cover-mouth-3d`, `chap-tay-sau`↔`hands-behind-3d`, `tay-dat`↔`arms-on-table-3d`, `vo-tay`↔`clap-3d`, `cui-than`↔`bow-3d`.
- Cặp chỉ để đổi tay: `kep-chen-gan/xa`, `tay-tro-gan/xa`, `ngon-tro-gan/xa`, `tay-mo-gan/xa`, `ghe-tai/-gan`, `moi-tay/-xa`, `cam-dt-3d/-nguoc`, `t02-cam-dt-*-nguoc`, `t02-phay-tay-xa`.
- Hành động chỉ ghi bàn tay (`tay-*`, `kep-chen-*`, `chi-*`) thực chất là dáng ngón, đúng ra thuộc `hands/`.

**Hành động mang món được không:** không. Schema hành động (`packages/rig/src/core/action.ts`) mỗi mốc chỉ có:
- `pose`;
- `reach.{armNear,armFar}` gồm `at` (hệ thân, `height`=1) hoặc `to` mốc thân, `side`, `offset`, `point` thuộc `wrist|palm|back|grip|tip`, `elbow`;
- `hand` gồm `pose` (chỉ `HAND_POSE_KINDS`), `w`, `turn`, `bend`, `palm`, `fingers`;
- `face`, `equip`, `layer`, `events`.

Không có `hold`, không có `item:*`, không có ý định hướng món, không có `elbowLock`. Mốc `other*` chỉ trỏ tay kia của chính người ấy.

## Giới hạn rig cần mở

1. **`hold` trong hành động, có `slots`.** Hành động khai `slots: { item: { groups: [...] }, to: "cast", surface }`, mốc khai `hold.armNear: { item: "$item", group, edge… }` mở hay đóng lần cầm ở một pha. Clip khai `bind: { item: "hoa-don", to: "khach", surface: "quay" }`. Rig nở ra thành đúng `world.hands` + `items` (một nguồn), nên `check held` vẫn đo được.
2. **`point: "item:<mốc>"` và ý định món** (`face`, `up`, `roll`, `toward: { cast: "$to" }`) trong `reach` của hành động.
3. **Đích ngoài thân:**
   - `to: "surface"` (mặt khai ở clip hay ở đạo cụ của cảnh, độ cao + mép gần), để làm declarative cái `handsOn` hiện chỉ là hàm JS;
   - `to: "other:<mốc>"` (tay hay ngực người nhận) cho đưa–nhận.
4. **Tham số clip:** `params` (tầm với, cao độ, lệch ngang) và `mirror: true`, xoá được các cặp `-gan`/`-xa`/`-nguoc`.
5. **Mốc thời gian theo sự kiện clip** (`"@clip:<track>/<event>"`), để `hold` của cảnh khớp pha "chạm" của hành động.
6. **Khuỷu tự nhiên `E(φ)` cho cả tay không cầm gì** (hiện chỉ cho món đặt trước), kèm giới hạn tốc độ xoay. Bỏ được phần lớn 67 mốc `elbowLock`.
7. **"Thân nghiêng, với theo khi ngoài tầm"** (docs 11 đang ghi để sau): kênh `torso` tự cúi tới khi tầm với ≤ 0,85, quá trần thì báo cần bước.
8. **Các nhóm và lớp đang để sau mà tập sau cần:**
   - `hug`: ôm hồ sơ, 17 cảnh.
   - `clamp`: chồng khăn, hộp.
   - `soft`: khăn.
   - `round`: hộp tròn, cuộn.
   - lớp "không cầm" `press`/`push`/`tap`: ép giấy (13 cảnh), đẩy hoá đơn, bấm máy.
   - `write`, `pick`.
   - Một tay vừa treo túi vừa cầm món (Q15/Q91).

**Dùng được ngay không cần mở rig:** mốc cảnh `{ hold: "món@nhóm" }` không đích thì tay theo hành động và món gắn tay. Hành động chung lo đường tay qua mốc thân, cảnh chỉ khai `hold` mở và `hold: null` đóng.

## Thư viện đề xuất (studio, tên tiếng Anh như bộ chung)

**Quy ước chung cho mọi mục:**
- `authoredAt: side`.
- Đích bằng mốc thân, lòng tay bằng ý định (`palm`/`fingers`, không dùng `turn`), không dùng `elbowLock`.
- Mặc định `sides: anatomical` cho dáng giữ, gần/xa cho cử chỉ hướng về người đối diện.

Ưu tiên P1 là tần suất cao × nhiều lỗi.

| Ưu tiên | Tên | Pha, mô tả | Nhóm cầm | Đích | Thay cho | Rủi ro |
|---|---|---|---|---|---|---|
| **A. Tay lên thân (dáng chờ)** | | | | | | |
| P1 | `hands-stack-belly-3d` (+`-skirt`) | hai bàn chồng trước bụng, giữ | – | `belly`, `otherBack`, palm back | `dung-tay-bung*` | bụng phệ, ngực áo nữ |
| P1 | `hand-on-chest-3d` | áp ngực: palm **back**, fingers **in**, khuỷu xuống-ra | – | `chest` | b3c4007, t02-s105 | dáng khấn |
| P1 | `hands-on-hips-3d` (`-r`/`-l`/`-both`) | chống nạnh | – | `hip`, palm in | `chong-nanh*` | khuỷu lật khi rời ra |
| P1 | `hands-behind-3d` (gộp bản repo) | chắp sau lưng | – | `back`, `otherWrist` | `chap-tay-sau` | |
| P2 | `hand-to-mouth-3d`, `chin-touch-3d`, `neck-rub-3d` | che miệng, chạm cằm, xoa gáy có nhịp | – | `mouth`, `chin`, `nape` | `che-mieng`, s066 | khuỷu lên cao |
| P2 | `wrist-tap-3d` | gõ cổ tay kia (sốt ruột, xem đồng hồ) | – | `otherWrist`, tip | t02-s044 (11 khoá) | khuỷu ngón chỉ |
| **B. Tay trên mặt** (`surface`: quầy đứng, bàn ăn, bàn thấp, tay vịn) | | | | | | |
| P1 | `hands-on-surface-3d` | hai tay úp trên mặt, cẳng tay trên mép | – | `surface`, r≈0,6 | `tay-dat`, `arms-on-table`, 143 + 278 mốc `at` | cẳng tay lẹm mép |
| P1 | `press-on-surface-3d` | lòng tay ép giấy, đẩy trượt `d` | (`press`/`push`) | `surface`/`item` | `t02-tay-ep`, `t02-nga-day` | Q115 |
| P1 | `seated-hands-thighs-3d`, `seated-hands-armrest-3d` | đùi (seiza, ghế), tay vịn | – | `thigh`, `surface` | `seiza-tay-dui`, t01 | bụng che |
| P2 | `lean-on-counter-3d`, `elbows-on-counter-3d` | tì, ngả qua quầy | – | `surface` + `torso` | `chung-vai`, `chong-khuyu-quay` | thân xuyên quầy |
| **C. Đưa / nhận** | | | | | | |
| P1 | `give-across-3d` | nhấc từ bụng → giơ ra (r 0,75–0,85, cao `chest`) → giữ tới `handoff` → buông, có cúi 10–20° nếu xa | sheet, card, palmBox, platform | `$to` (ngực người nhận) | t02-s009, s028, s122 | ngoài tầm, khuỷu lật |
| P1 | `receive-across-3d` | với ra, mở tay, nắm ở `handoff`, kéo về đọc | sheet, card | `$item` | như trên | đồng bộ hai người |
| P1 | `give-two-hands-3d` | đưa hai tay kiểu Nhật (danh thiếp, hoá đơn) kèm cúi đầu | sheet, card, platform | `chest` + `$to` | lễ tân | hai tay chạm nhau |
| P2 | `slide-across-3d` | đẩy giấy hay thẻ trượt trên quầy về phía khách | `push` | `surface` | s002, s081 | |
| P2 | `present-item-3d` | khoe món, mặt món về `$to` | palmBox, sheet, box | `chest`+offset | `gio-dt`, `khoe-dt` | cổ tay quất |
| **D. Cầm đọc / xem** | | | | | | |
| P1 | `phone-view-3d` (`-tap`) | điện thoại ngang cằm, `holderFace`, tay kia gõ | palmBox | `eye` [45,45,10] | `cam-dt*`, 42 lần cầm | ngón gõ ra ngoài |
| P1 | `read-sheet-3d` (một hay hai tay) | phiếu, hoá đơn ngang ngực | sheet, card | `chest` | hoá đơn, biên lai | |
| P1 | `read-newspaper-seated-3d` | báo hai cạnh, `rim` | sheet | `chest` | ông khách 24 cảnh | khuỷu ép thân |
| P2 | `film-phone-3d`, `live-phone-chin-3d` | quay ngang hai tay; giữ máy ở cằm | palmBox | `chin`, `otherGrip` | `quay-dt`, s093 | |
| P2 | `hug-folder-3d`, `open-folder-3d` | ôm, mở kẹp hồ sơ | `hug` (cần mở) | `chest` | `om-ho-so`, `mo-ho-so` | |
| **E. Điện thoại, ống nghe** | | | | | | |
| P1 | `phone-raise-ear-3d`, `phone-lower-3d` | từ xem lên tai (`item:speaker`→`ear`, face→`head`), hạ xuống | palmBox, cylinder | `ear` | `ap-tai`/`ha-tai`, `phone-ear-3d` | rung (cbb1aeb) |
| P1 | `handset-pickup-3d`, `handset-hangup-3d` | nhấc từ giá: với → nắm → lên tai; gác ngược lại | cylinder | `$item` (giá), `ear` | s017, s022, s080 | Q121/Q124 |
| P2 | `radio-talk-3d` | bộ đàm tới miệng, nói, hạ xuống | cylinder | `mouth` | cảnh sát 15 cảnh | |
| **F. Đặt / nhấc** (đứng: quầy; ngồi: bàn thấp, sàn tatami) | | | | | | |
| P1 | `place-on-surface-3d` | mang → hạ (`rest`) → buông → rút tay | sheet/rim, platform, bowl, cylinder | `surface` | t02-s040b (63 mốc), s038 | đĩa lún, tầm |
| P1 | `pick-from-surface-3d` | với → cầm → nhấc lên ngực | mọi nhóm một tay | `$item` | s080, s121 | món bay vào tay |
| P2 | `place-kneeling-3d`, `pick-kneeling-3d` | như trên, người seiza với bàn thấp, sàn | như trên | `surface` thấp | rượu, trà t01 | hông, gối |
| P2 | `pick-from-floor-3d` | khuỵu gối, cúi nhặt túi | handle | `$item` | `nhac-tui` | chân |
| **G. Ăn uống, rót** | | | | | | |
| P1 | `drink-cup-3d` | nâng chén, ly → môi (`item:rim`, face→`head`) → hạ | bowl, cylinder, handle | `mouth` | `uong`, `nang-ly`, s033 | khuỷu (a4aee9f) |
| P1 | `eat-chopsticks-3d` | gắp từ bát → miệng → về | chopsticks (+ `pick`) | `$item`, `mouth` | s034, s048 | khuỷu, đũa xuyên bàn |
| P1 | `pour-bottle-3d` (`-kneel`) | rót hai tay (đỡ đáy), miệng chai về chén `$to` | cylinder + platform | `$to` | `quy-rot-ruou`, t01 | tầm |
| P2 | `offer-cup-3d` | chìa chén nhận rượu | bowl | `chest`→`$to` | `dua-ly` | |
| P2 | `toast-3d` | cạn ly, nâng ngang mặt | bowl, cylinder | `eye` | `nang-ly` | |
| **H. Xách, khoác, bưng** | | | | | | |
| P1 | `carry-elbow-bag-3d` (r/l) | khoác khuỷu, cổ tay trước vai | carry/elbow | `shoulder` | `khoac-tui-khuyu-*` | lấn người khi gập |
| P1 | `carry-handle-3d` (r/l) | xách quai, lòng tay **về đùi**, tay thõng | handle | `hip`, palm in | `xach-tui`, 25 cảnh | túi lún đùi |
| P1 | `carry-tray-3d`, `hold-tray-front-3d` | bưng ngang eo; ôm khay trống dựng | platform, sheet | `belly` | `bung-khay`, `om-khay` | khuỷu bật khi cúi |
| P2 | `shoulder-bag-3d`, `pull-suitcase-3d` (+hai vali) | đeo vai; kéo vali sau lưng | carry/shoulder, handle | `shoulder`, `hip` | `deo-tui-vai`, `keo-vali` | |
| **I. Viết, ký, thanh toán** | | | | | | |
| P1 | `write-on-surface-3d` | cầm bút, ngòi xuống giấy, tay kia giữ giấy | pen (+`write`) | `surface` | `viet`, s017 (31 mốc) | tay rung |
| P2 | `write-on-palm-pad-3d` | ghi phiếu đỡ trên lòng tay kia | pen + platform | `otherPalm` | t01-s042 | |
| P2 | `sign-receipt-3d`, `card-pay-3d` | ký hoá đơn; đưa thẻ, cắm hay quẹt máy | pen, card | `surface`, `$item` | t01 thẻ | |
| **J. Chỉ, mời** | | | | | | |
| P1 | `invite-gesture-3d` | tay mời ngửa, ra phía `$dir` | – | `belly` → dir | `moi-tay*` | khuỷu vào thân |
| P2 | `point-at-3d`, `point-down-surface-3d` | chỉ người hay vật; chỉ dòng trên giấy | – | `$to`, `surface` | ~110 mốc `tip` | |
| **K. Cúi chào kèm đồ** | | | | | | |
| P2 | `bow-holding-3d` | cúi 15/30/45° khi đang cầm khay, đồ: món theo thân | mọi nhóm | thân | `t02-cui-khay`, Q40 | khuỷu bật |
| **L. Tập 3 (đồng hồ) và bối cảnh xoay vòng** | | | | | | |
| P1 (t03) | `watch-inspect-3d` | cầm đồng hồ hai ngón, xoay xem mặt, lật đáy | `round`/card mới (`dong-ho`) | `eye` | – | món nhỏ, ngón |
| P1 (t03) | `loupe-inspect-3d` | kính lúp tới mắt, cúi sát món trên khay | cylinder + `$item` | `eye`, `surface` | – | đầu lấn món |
| P1 (t03) | `place-on-tray-3d` | đặt đồng hồ lên khay nhung (phiên bản của `place-on-surface`) | – | `surface` | – | |
| P2 (t03) | `try-on-watch-3d` | đeo thử vào cổ tay kia | – | `otherWrist` | – | hai tay quấn nhau |
| P2 (t03) | `open-box-3d`, `hand-tool-work-3d` | mở hộp nắp; tua vít, nhíp trên bàn kỹ thuật ngồi | `clamp`, pen | `surface` | – | |
| P2 | `serve-plate-table-3d`, `bouquet-hold-3d`, `key-hand-over-3d` | nhà hàng, tiệc cưới, khách sạn | platform, hug, card | | | |

Đề cương tập 3 đặt quầy và bàn kỹ thuật làm chỗ chính, và có cảnh phiếu nhận đặt trước mặt, cầm bút ký nhận. Vì vậy nhóm B (tay trên mặt), C (đưa/nhận), F (đặt/nhấc), I (viết) và L là bộ cần có trước tập 3.

## Tham số hoá tầm với

1. **Đích theo vai, đơn vị chiều dài tay.**
   - L = (cánh tay trên + cẳng tay) · `stretch` · `height`.
   - Đích = vai + r·L·hướng(phương vị, ngẩng).
   - r thoải mái 0,55–0,80; 0,85 là trần trước khi cúi; dưới 0,45 là quá sát, tay lòi ra trước hay lún vào thân.
   - Như vậy đúng cho cả t01-sakura (nhỏ nhất) lẫn kuroiwa (lớn nhất), kể cả chibi.
2. **Khoảng cách tối thiểu với thân.** Gốc phía trước đặt ở mốc `chest`/`belly` (mặt áo thật, đã tính bụng phệ, ngực áo nữ), cộng bán kính cẳng tay và nửa bề dày món. Không đo từ tâm hông.
3. **Cao độ mặt theo khớp:**
   - quầy = khuỷu − 8 (như `CAO.quay`); bàn ăn = gối + 50; bàn thấp = 0,8·gối.
   - Hành động khai `surface: "elbow-0.1L"`; cảnh khác cao thì bind số thật, rig giải lại khoảng tiến d = √((rL)² − Δy²).
4. **Ngoài tầm** (r > 0,85):
   - (a) cúi thân θ đủ đưa r về 0,8, trần 30° (`voi-quay` 20–30° là mẫu);
   - (b) quá nữa thì `check` báo "cần bước Δ" để cảnh dời chỗ đứng; không tự kéo món lại gần (khớp luật docs 11 § Đã chốt 3).
5. **Khuỷu mặc định theo loại:**
   - mặt đỡ: [−0,3, 0,3, 1];
   - cầm trước ngực: `REACH_ELBOW`;
   - treo, xách: [−0,5, 1, 1].
   - Sau đó để `E(φ)` tự chọn, giới hạn xoay 5° mỗi 1/30 s.
6. **Lòng tay chuẩn theo loại:** ngực = back + fingers in; xách = in (về đùi); khay = up; quầy = down. Viết vào `note` và vào test.

## Cách duyệt: `bang-hanh-dong` (theo mẫu `bang-cam`)

- **Lưới:** mỗi hành động × 4 người (t01-sakura nhỏ nhất, kuroiwa lớn nhất, saito bụng phệ, erika có ngực áo) × tư thế (đứng / ghế / seiza / ghế bành) × mặt (quầy / bàn ăn / bàn thấp / sàn, chỉ khi hành động có `surface`) × 3 góc (trước, 3/4, ngang; thêm sau lưng cho tay sau).
- **Ảnh:** chụp ở từng `event` của hành động (`grab`, `handoff`, `rest`…).
- **Số đo trên mỗi ô:**
  - r tầm với;
  - khe cẳng tay–thân và cẳng tay–mặt;
  - khuỷu gập ngược (`w_in`);
  - `palmOff` / `fingersOff`;
  - lỗi `held`;
  - bước nhảy cổ tay và khuỷu lớn nhất mỗi khung.
- Chạy `check --only move,clash,held` trên các cảnh sân thử `bang-hd-*`.
- **Đầu ra:** `tmp/bang-hanh-dong/index.html`, kèm mp4 ngắn mỗi hành động.
- **So sau nâng rig:** `--so` so từng ô với bảng chuẩn chủ dự án đã duyệt (`--luu-chuan` chỉ chủ dự án chạy). Sau mỗi lần nâng rig chỉ in ô đổi.

---

Không sửa file nào trong repo. Script khảo sát nằm ở `/tmp/tuongtac/` (`stat.mjs`, `seg.mjs`, `body.mjs`, `at.mjs`, `dump.mjs`); chạy lại bằng `node /tmp/tuongtac/<file>`. Các file chính đã đọc:
- `/home/trungvq/Work/Dev/stickman-studio-3d/packages/rig/src/core/action.ts` (schema hành động)
- `/home/trungvq/Work/Dev/stickman-studio-3d/docs/11-nhom-cam.md`, `docs/03-scene.md` § Đích bàn tay thế giới, § Đồ cầm tay
- `/home/trungvq/Work/Dev/youtube-video/jp-sukatto/src/khoi3d/ti-le.ts` (`CAO`, `SAU_VOI`)
- `/home/trungvq/Work/Dev/youtube-video/jp-sukatto/videos/03-tokei/outline.md`
