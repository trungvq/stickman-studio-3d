# Giai đoạn 4: kế hoạch job cho mười nhóm cầm

> Nguồn: `docs/11-nhom-cam.md` (mục 3, 5–9, Phụ lục A), `tien-do.md` (Việc dồn, Đã tự quyết, Cần chủ dự án), code lõi ở HEAD
> `7fc58c6`. Thứ tự nhóm theo spec mục 9. Xong khi cả mười nhóm bỏ `later` (trừ `round`, `hug`, `clamp`, `soft`), mỗi nhóm có
> khung chuẩn khớp fixture, hàng `bang-cam --nhom` cho chủ dự án duyệt, và đường v1 (`món#kiểu`, `held/` v1) vẫn chạy nguyên số.
> Studio `~/Work/Dev/stickman-studio-3d-nhom-cam` (`feat/nhom-cam`); video `~/Work/Dev/youtube-video/jp-sukatto-nhom-cam`
> (`auto/nhom-cam`). Không job nào chạy song song (cột "song song" chỉ ghi job nào không đụng chung file).

## 0. Chung cho mọi nhóm

**Đã có ở lõi**: `itemGeom` đủ sáu khối hình (`heldGeom.ts`), `gripSpan` (đoạn bám liền, cắt `grip: false`), `GRIP_GROUPS`
đủ 14 nhóm (`graspGroups.ts`, mười hai nhóm `later`), `graspFrame`/`chooseMissing`/`graspAt` (`graspSolve.ts`, `CONTACTS` chỉ có
`sheet`, `palmBox`), `heldFit` theo vai trò, `skinDepth`, luật `check` nhóm (`heldAudit.ts` `groupHits`, `heldGripMax`), tay phụ cùng
nhóm (`holdLink.ts` `supportOf`, chỉ cùng nhóm + cạnh đối), `bang-cam --nhom` (hàng mẫu riêng chỉ cho `sheet`, `palmBox`).

**Còn thiếu dùng chung** (làm ở nhóm đầu tiên cần nó):

| Thiếu | Chỗ | Nhóm cần | Job |
|---|---|---|---|
| `ContactInput` không có `around`, `psi`, `inset`; `graspFrame` không truyền | `graspSolve.ts` `graspFrame`, `ContactInput` | cylinder, platform, bowl, pen, chopsticks, handle | G4-42 |
| Điểm trên trục ở `along` của đoạn bám liền, bán kính `r(s)`, hướng `ρ(θ)` | `heldGeom.ts` (`gripSpan`, `latheRadius`, `radialDir`) → hàm mới `axialAt` | như trên | G4-42 |
| Tầm cuộn theo biến thể (bút, đũa `≤ 15°`); `HELD_ROLE_CURL` cố định | `heldFit.ts` `HeldFitInput`, `graspGroups.ts` `VariantSpec`, `holdLink.ts`, `src/attach.ts` `fitHolding` | pen, chopsticks | G4-72 |
| Tay phụ khác nhóm (`support.place: bottom/back` → `platform`) | `holdLink.ts` `supportOf` (nay `c = {}` khi khác nhóm) | cylinder, bowl, palmBox | G4-54 |
| `both` trên món đặt trước: tay phụ chỉ với tới qua `holdRoles`, không giải `E(φ)`; thứ tự giải luôn tay phải trước | `scene.ts` `graspStart`, `placedOther` | platform, sheet, cylinder | G4-55 |
| Hàng mẫu `bang-cam` của tám nhóm còn lại | `packages/cli/scaffold/tools/bang-cam.mjs` `hangMau`; chép sang `tools/bang-cam.mjs` của video | mọi nhóm | G4-x6 |

**Mức "không được TĂNG"**: `grip-frames.json` chỉ có khung (`R`, `p`, dáng), không có lún/khe. Số lún/khe trên da của kiểu v1 lấy
từ `bang-cam` chế độ kiểu cầm: đã có `video/tmp/bang-cam-cu/do.json` (`bang-gia`, `dien-thoai`, `tui-hieu`); G4-00 chạy thêm cho
các món fixture còn lại. Mỗi job render của nhóm so ô v2 với ô v1 cùng người, cùng tay: `sink` v2 ≤ lún v1 + 0,1 (và ≤ `HELD_SINK`),
khe ngón có vai trò bắt buộc ≤ khe v1 + 0,3, tâm nắm không xa hơn.

**Món đại diện**: `bang-cam --nhom` đọc `held/` của video, nên mỗi nhóm cần `held/thu-<món>.json` (v2) ở video: chép **`shape`
của món v1 hiện tại** (không chép từ fixture — `bang-gia`, `tom-hum` đã lệch), gắn `part`/`detail`/`parts`/`front`/`top`/`seats` theo
Phụ lục A, `schemaVersion: 2`, bỏ `grips`; thêm một dòng bí danh vào `src/objects/luoi-mon.ts` (`"thu-<món>": () => <lưới món v1>`);
`pnpm test` (held-moc) xanh. Soi bằng MCP `describe_held` (khối hình, nhóm áp được) trước khi dùng.

## 1. Từng nhóm

### 1. `palmBox` (34 cặp)

| | |
|---|---|
| Người thật cầm | Lưng máy tựa lòng tay và gốc ngón, ngón cái dựng dọc một cạnh dài, trỏ–áp út vòng ra sau tì đầu ngón vào cạnh dài kia, út đỡ góc dưới; cổ tay thẳng hay ngửa nhẹ, màn chếch về mặt |
| Món đại diện | `thu-dien-thoai` (có sẵn ở video). Không soạn thêm |
| Kiểu v1 → fixture | `dien-thoai#doc` 31, `#khoe` 1, `#bam` 1, `#cam` 1. Fixture `dien-thoai#doc` (dáng `span`, `wrap` cái–áp út) |
| Mức v1 (`bang-cam-cu`) | `#doc` sakura: lún 0,79 (R) / −0,12 (L), nắm 2,8, khe cái −0,8, trỏ 0,1, giữa 0,2, áp út 0,1, út 6,5, lòng 1,5; kuroiwa lún −0,18, khe trỏ–áp út ≤ 0,3. `#khoe` lòng 3,1–3,3, khe ≤ 0,4 |
| Lõi thiếu | Vai trò trỏ–áp út `tip` (chỉ đốt ngọn ≤ 30°) ra khe 4,9–6,2, v1 cuộn hai đốt ra 0,1–0,3 → đổi vai trò (`graspGroups.ts` `palmBox.variants.default.roles`), xem lại `BOX_SHIFT`/`BOX_GAP`/`BOX_RISE` (`graspSolve.ts`). Hàng khoe một tay vượt cổ tay 36° (sakura): xác minh `chooseMissing` đã thử đủ `thumb` hai bên × `tilt` |
| Việc dồn | `tip` hở 4,9–6,2; khoe một tay vượt 36°. (Lún 1,1–1,3 và cái sau xuyên 0,9 trên điện thoại là `sheet` `pinch` → nhóm 3; hai tay chồng nhau → nhóm 3; tay phụ `platform` mặt sau → G4-54) |

### 2. `carry` (25 cặp)

| | |
|---|---|
| Người thật cầm | Khoác khuỷu: quai vắt mặt trong khuỷu gập ~90°, cẳng tay ngóc trước ngực, bàn tay thả lỏng, thân túi thõng sát hông ngoài. Khoác vai: quai trên đỉnh vai, tay luồn ngoài quai, túi kẹp sườn |
| Món đại diện | **Soạn** `held/thu-tui-hieu.json`: `shape` của `tui-hieu.json` v1 (trùng fixture `held-v2/tui-hieu.json`), `front: mat`, `top: quai`, `seats { elbow: treoKhuyu, shoulder: quai }`; **không** để `touch` của kiểu `vai` lên món (xem rủi ro 7) |
| Kiểu v1 → fixture | `tui-hieu#khuyu` 25. Không có GripFrame (kiểu treo); chuẩn là `carryFrame` của v1 và `bang-cam-cu` `tui-hieu#khuyu`/`#vai` |
| Lõi thiếu | `carry` còn `later`, `needs` chỉ `box` (`graspGroups.ts`); `seats` chưa ai đọc. `attach.ts` `carry()` gọi `heldGrip` (v1) → cần `carrySpecOf(spec, hold)` (`heldCarry.ts`): `{ on, at: seats[on], yaw: hold.yaw, touch: hold.touch }`; `held.ts` `heldCarries` (khoá `hold`/`key` dạng `món@carry`); `scene.ts` ~3961 (`point: item:` với treo v2 — đang dùng `isCarry(spec.grips…)`) và `checkHolds` (`on` bắt buộc, `seats[on]` có thật); `checkChoice` báo thiếu `on` |
| Việc dồn | — |

### 3. `sheet` (18 cặp)

| | |
|---|---|
| Người thật cầm | `pinch` (đọc): mép tấm kẹp giữa đệm ngón cái duỗi gần thẳng trên mặt trước và đốt giữa–ngọn bốn ngón khép sau mặt kia, gốc ngón gập ~40°, tâm nắm sát mép, cổ tay thẳng. `flat`: lòng tay và ngón áp phẳng mặt sau, ngón cái vắt qua mép đè mặt trước. `rim`: gốc ngón/lòng tay áp mép (vành đĩa, mép báo), ngón cái đè mặt trên, bốn ngón cuộn qua mép đỡ mặt dưới |
| Món đại diện | `thu-bang-gia` (có, `pinch`). **Soạn**: `thu-thuc-don` (`flat`, `front` cover / `top` edgeT), `thu-tom-hum` (`rim` trên đĩa; phần `dia`, `mon-an` `grip: false`; `top: top`; gắn nhãn lại trên `shape` v1 hiện tại, 62 khối), `thu-bao` (`rim` hai tay, tấm 200 × 136 × 0,96). Tuỳ chọn: `thu-bo-da` (`rim`, `front`), `thu-hoa-don` (`flat` hai tay cùng cạnh) |
| Kiểu v1 → fixture | `tom-hum#nhac` 8, `bao#doc` 4, `thuc-don#khoe` 3, `bo-da#bung` 1, `phieu-lien#cam` 1, `hoa-don#hai` 1. Fixture `bang-gia#doc` (pinch), `phieu-lien#cam`, `thuc-don#khoe` (flat), `tom-hum#nhac`, `bo-da#bung`, `bao#doc` (rim) |
| Mức v1 | `bang-gia#doc`: lún 0,50 / 0,49, khe cái 0,3 / 0,5, ngón ≤ 0, lòng 6,3 / 7,8. Còn lại từ G4-00 |
| Lõi thiếu | (a) Giá biến thể: rig chọn `flat` ở hàng mặc định (`chooseMissing` chỉ cộng `DEV_COST` 0,05 khi lệch mặc định — quá nhỏ so với `E`). (b) `rim`: ngón hở 5,5–12,4, bàn tay lơ lửng — vai trò trỏ–út `press` không cuộn qua mép; thụt `SHEET_INSET.rim` 1 lệch fixture (`tom-hum` tâm nắm cao hơn giữa bề dày 1,5; `bao` thụt 3). (c) `pinch`: ngón cái hở 2,5–3,6; cái sau vượt cổ tay 17–25°, nắm 5,5–6,6 (`PINCH_PALM`, dáng `sheet` + `knuckle`). (d) Đĩa: `edge` chỉ bốn tên vành (`chooseMissing` `dom("edge")` dùng `f.rim`), spec là góc lưới 30° (nợ review G3) |
| Việc dồn | `flat` được chọn thay `pinch`; `rim` hở; `pinch` cái hở/cái sau vượt; điện thoại `pinch` lún 1,1–1,3, cái sau xuyên 0,9; khoe hai tay hai bên với điện thoại hai bàn tay chồng nhau; lật tấm 180° (`thu-nhom-cam` lỗi `wrist` 2,0–2,3 s, vùng chết 65–125°); đổi `thumb` hoà quanh trục cố định; `bang-cam` hàng `biến thể flat` trùng `mặc định`; `holdBlending` không làm im `pierce`/`sink`; 9 `loose` của `tom-hum#nhac` trong baseline (v1, không vá) |

### 4. `cylinder` (11 cặp)

| | |
|---|---|
| Người thật cầm | Lòng tay áp mặt trụ, bốn ngón quấn quanh phía kia, trục chéo trong lòng tay từ gốc ngón trỏ tới mô út; ngón cái quấn ngược chồng lên trỏ–giữa (trụ mảnh) hay áp dọc thân (trụ to), về phía đầu trên; cổ tay thẳng. Ống nghe: lòng tay áp lưng tay cầm, ngón cái dọc phía trên |
| Món đại diện | **Soạn**: `thu-chai-dia` (phần `than`, `vai`, `co`, `mieng` `grip: false`; `front: nhan`, `top: mouth`; trùng fixture), `thu-ong-nghe-ban` (`tay`; `loa`, `mic` `grip: false`; trùng fixture), `thu-chai-dac-tuyen` (phần như `chai-dia`; thân r 13,2 cho cảnh báo `size`) |
| Kiểu v1 → fixture | `ong-nghe-ban#tai` 5, `ong-nghe#tai` 4, `chai-dia#xem` 1, `chai-dac-tuyen#xem` 1. Fixture `chai-dia#co` (dáng `grip`, nắm ở vai); ống nghe không có fixture → chuẩn từ G4-00 |
| Lõi thiếu | `CONTACTS.cylinder.wrap` (`frame: "nt"`): điểm trên trục ở `along` của đoạn bám liền (`gripSpan`), tâm nắm dời ra `r(s) + δ` da lòng tay, `n = −ρ(θ)`, ngón cái `±a`; `ContactInput.around` (G4-42). `needs`: tâm nắm cách phần `grip: false` ≥ 0,3·W (chưa có; nay chỉ `span ≥ 0,6·W`). Dáng `grip → fist` theo `R`; thanh `r < 0,2·W` cần dáng khép hơn `fist` (bước 0: `fist` lún 1,47 trên cán r 2,5; fixture cổ chai 0,39). Quy ước `around = 0` (rủi ro 5). Trượt dọc thanh: xác minh `along` hoà giữa hai mốc tay trên `rod`/`lathe`. Tay phụ `platform` đáy → G4-54 |
| Việc dồn | `fist` lún 1,47 (bước 0) |

### 5. `platform` (10 cặp)

| | |
|---|---|
| Người thật cầm | Lòng tay ngửa áp mặt đáy, ngón duỗi hơi xoè đỡ, ngón cái ngoài vành; cẳng tay ngang, cổ tay ngửa; bê khay hai tay ở hai cạnh trái/phải, ngón chĩa ra xa người. Đỡ phiếu: phiếu nằm trên lòng tay ngửa |
| Món đại diện | **Soạn**: `thu-khay` (phần `day`, `vanh`; đồ trên khay `grip: false` nếu có; `top: top`), `thu-phieu` (`front` cover / `top` edgeT; đỡ mặt `back`). Tuỳ chọn `thu-khay-suat` |
| Kiểu v1 → fixture | `khay#bung` 8, `khay-suat#bung` 1, `phieu#do` 1. Fixture `khay#bung` (`both`, lead phải), `phieu#do` (dáng `flat`) |
| Lõi thiếu | `face` chưa có tên cạnh (`heldGeom.ts` `FaceFeature` chỉ `u`, `v`, `half`) → cạnh của mặt theo tên khung món. `CONTACTS.platform.palm`: tâm nắm từ `edge` thụt `inset` (mặc định `inset₀(ψ) = ½(W·|sin ψ| + P·|cos ψ|)`), ở `along`, ngón quay `ψ`, `n = −face.n`. Chọn mặt (không có trường cảnh, rủi ro 6). Lưới `psi` (`grid`: `ring(8)` trên [−90, 90] ra bước 22,5°, spec ghi lưới 45°). Tay phụ cùng nhóm cạnh đối trên `face` (`oppositeEdge` chỉ biết `slab`/`disc`). `support.place` cho nhóm khác. `both` món đặt trước (G4-55) |
| Việc dồn | — |

### 6. `card` (7 cặp)

| | |
|---|---|
| Người thật cầm | Thẻ kẹp giữa đệm ngón cái (một mặt) và đệm ngón trỏ (mặt kia) gần mép, thẻ nhô khỏi đầu ngón; giữa–út co lỏng; cổ tay thẳng |
| Món đại diện | **Soạn** `thu-the-phong` (`front` cover / `top` edgeT — thành tấm đứng; không phần) |
| Kiểu v1 → fixture | `the-phong#kep` 3, `#cam` 3, `#dua` 1. Fixture `the-phong#kep` (dáng `pinch`, `wrap` cái, trỏ) |
| Lõi thiếu | `CONTACTS.card.pad`: điểm trên cạnh thụt `0,15·W`, khung chuẩn từ fixture, phía `thumb` đo theo mặt đệm ngón cái chạm ở fixture; bỏ `later`; mặc định `edge` của tay dẫn như `sheet` (`lead` trong `chooseMissing` chỉ có cho `sheet`) |
| Việc dồn | — |

### 7. `chopsticks` (6 cặp)

| | |
|---|---|
| Người thật cầm | Que dưới tì khe cái–trỏ và đầu ngón áp út, đứng yên; que trên kẹp như bút giữa đầu ngón cái, trỏ, giữa; út co theo áp út; cầm ở 1/4–1/3 từ đầu trên, hai ngọn chụm |
| Món đại diện | **Soạn** `thu-dua` (`que` hai khối, `nut` `grip: false`; mốc `tip` có `dir`; trùng fixture) |
| Kiểu v1 → fixture | `dua#cam` 6. Fixture `dua#cam` (dáng `pinch`, `wrap` cái) |
| Lõi thiếu | Dáng `chopsticks` (`hand.ts` `HAND_POSES`, `HAND_POSE_LABELS`, `HAND_GRIPS`; bỏ khỏi `PlannedPose` của `graspGroups.ts`). `CONTACTS.chopsticks.grip`: khung fixture dời dọc đường giữa hai que, `along` từ đầu cầm (0,25). Tầm cuộn `≤ 15°` (G4-72). `HELD_PINCHES` chưa có dáng mới (ngưỡng `grip`) |
| Việc dồn | — |

### 8. `pen` (4 cặp)

| | |
|---|---|
| Người thật cầm | Kẹp ba điểm: thân bút tựa cạnh đốt ngọn ngón giữa, đệm ngón cái và đệm ngón trỏ ép hai phía, cách ngòi ~1/3; thân ngả về khe cái–trỏ; áp út, út co lỏng; mép út tì giấy |
| Món đại diện | **Soạn** `thu-but` (`ngoi` `grip: false`, `than`; kẹp bút `detail`; `top: cap`; mốc `tip` có `dir`) |
| Kiểu v1 → fixture | `but#viet` 4. Fixture `but#viet` (dáng `cup`) |
| Lõi thiếu | Dáng `tripod` (như trên). `CONTACTS.pen.grip`: điểm trên trục cách `tip` `along` (0,3) chiều dài, lăn quanh trục 0, khung fixture; tầm cuộn `≤ 15°`; bỏ `later` |
| Việc dồn | — |

### 9. `handle` (3 cặp)

| | |
|---|---|
| Người thật cầm | Quai nằm ngang qua đốt giữa bốn ngón, ngón gập ~90° móc qua quai, lòng tay quay vào đùi, ngón cái thả ngoài; tay buông, cổ tay thẳng, túi treo dưới |
| Món đại diện | **Soạn** `thu-tui` (`than`, `quai`, `day` `grip: false`; `front: mat`, `top: quai`) |
| Kiểu v1 → fixture | `tui#xach` 3. Fixture `tui#xach` (dáng `hook`, `wrap` trỏ–út) |
| Lõi thiếu | `needs` thiếu "khe sau thanh ≥ 2 × bán kính ngón" (`graspGroups.ts` `handle` chỉ `R`, `span`) → đo khe ở `heldGeom.ts`. `CONTACTS.handle.hook` (`frame: "nf"`): điểm trên thanh ở `along`, ngón vuông góc thanh luồn qua khe; bỏ `later` |
| Việc dồn | — |

### 10. `bowl` (1 cặp)

| | |
|---|---|
| Người thật cầm | Lòng tay và ngón ôm thành chén từ một bên, ngón cái gác gần miệng, trỏ–giữa vòng thân, áp út–út đỡ dưới; miệng ngửa |
| Món đại diện | **Soạn** `thu-chen` (không phần; miệng suy từ `wall`) |
| Kiểu v1 → fixture | `chen#kep` 1. Fixture `chen#kep` (dáng `clasp`) |
| Lõi thiếu | `CONTACTS.bowl.side` (`frame: "nt"`, dùng lại trục của G4-42, ngón cái về miệng, `along` thấp 0,25); bỏ `later`; tay phụ `platform` đáy (G4-54) |
| Việc dồn | — |

## 2. Danh sách job

O: Opus (khó), S: Sonnet (đơn giản). "Render" = ở video `pnpm bang-cam --nhom <nhóm> --mon <món> --out tmp/bang-cam-g4-<nhóm>`
(hai cỡ tay mặc định: sakura 1,61, kuroiwa 2,16), chép `*.jpg`, `do.json`, `index.md` sang studio `tmp/nhom-cam/g4-<nhóm>/`, in
bảng so với mức v1 (`sink`, khe từng ngón, nắm, cổ tay vượt, luật báo) ra `g4-<nhóm>/so-v1.md`. Agent chính tự mở ảnh.

| Job | Việc | File | Đầu ra kiểm được | Test | Phụ thuộc | M |
|---|---|---|---|---|---|---|
| **G4-00** | Mức v1 | video: chạy `pnpm bang-cam --mon tom-hum,bao,thuc-don,phieu-lien,bo-da,hoa-don,the-phong,but,dua,chai-dia,chai-dac-tuyen,ong-nghe-ban,ong-nghe,khay,khay-suat,phieu,tui,chen --out tmp/bang-cam-cu-g4` | studio `tmp/nhom-cam/g4-chuan-v1/{do.json,muc.md}`: kiểu × người × tay → lún, nắm, khe từng ngón, lòng (gộp cả `tmp/bang-cam-cu`) | — | — | S |
| **palmBox** | | | | | | |
| G4-11 | Ngón `palmBox` | `graspGroups.ts` (vai trò), `graspSolve.ts` (`BOX_*` nếu cần), `graspSolve.test.ts`, `heldFitRoles.test.ts` | `dien-thoai@palmBox` hai cỡ, hai tay: khe trỏ–áp út ≤ v1 + 0,3, lún ≤ 0,65, fixture vẫn ≤ 1°/0,8 | ca mới cạnh ca `dien-thoai#doc` | 00 | O |
| G4-12 | Khoe một tay | `graspSolve.ts` (miền `thumb`×`tilt` khi giải), test | hàng `khoe-1-tay` hết vượt cổ tay, hay chứng minh mọi ứng viên vượt (bảng số trong `g4-palmBox/khoe.md`) → rủi ro 2 | `graspAt.test.ts` | 11 | O |
| G4-13 | Docs | `docs/11` nhóm 9, dòng đầu | vai trò, hằng số khớp code | `pnpm format:check` | 12 | S |
| G4-14 | Render | — | `g4-palmBox/` (`thu-dien-thoai`, gồm áp tai) | — | 13 | S |
| **carry** | | | | | | |
| G4-21 | Món thử | video `held/thu-tui-hieu.json`, `luoi-mon.ts` | `describe_held` ra `seats`; `pnpm test` xanh | held-moc | — | S |
| G4-22 | Treo v2 ở lõi | `graspGroups.ts` (`carry`: bỏ `later`, `needs` có `seats`), `heldCarry.ts` (`carrySpecOf`), `scene.ts` (`checkHolds`, `point: item:`), `holdLink.ts` | `checkChoice` báo thiếu `on`, `seats[on]` không có | `heldCarry.test.ts` khối mới | — | O |
| G4-23 | Treo v2 ở three | `src/attach.ts` `carry`, `src/held.ts` `heldCarries`, `src/world.ts` | `tui-hieu@carry` `on: elbow` / `shoulder` ra cùng `carryFrame` (≤ 1e-9) và cùng `heldCarries` (seat, body, swing) như `tui-hieu#khuyu` / `#vai` | `holdWorldV2.test.ts` khối mới | 22 | O |
| G4-24 | Hàng mẫu | `bang-cam.mjs` `hangMau` (treo khuỷu, treo vai, tư thế tay như chế độ kiểu cầm); chép sang video | `--nhom carry` ra 2 hàng × 2 cỡ | chạy hai chế độ | 23 | S |
| G4-25 | Docs + render | `docs/11` nhóm 13; `g4-carry/` | `so-v1.md`: seat, body không đổi | — | 21, 24 | S |
| **sheet** | | | | | | |
| G4-31 | Món thử | video `held/thu-thuc-don.json`, `thu-tom-hum.json`, `thu-bao.json` (+ tuỳ chọn `thu-bo-da`, `thu-hoa-don`), `luoi-mon.ts` | `describe_held`: `thuc-don`, `bao` tấm đứng; `tom-hum` ra `slab` nằm + `disc`, `mon-an` không bám | held-moc | — | S |
| G4-32 | Giá biến thể | `graspSolve.ts` `chooseMissing` (giá cho biến thể ≠ mặc định, rủi ro 1) | hàng mặc định `thu-bang-gia` ra `pinch` ở đọc ngang ngực; ca bước 0 "khoe dưới–trên" vẫn ra `rim` | `graspAt.test.ts` | 00 | O |
| G4-33 | `pinch` | `graspSolve.ts` (`PINCH_PALM`, thụt), `graspGroups.ts` (dáng, `knuckle`, vai trò ngón cái) | `bang-gia`: khe cái ≤ v1 + 0,3 (≤ 0,8), lún ≤ 0,6; cái sau: vượt cổ tay giảm, nắm ≤ `HELD_GRIP_PINCH`; điện thoại lún ≤ 0,65 | fixture `bang-gia#doc` vẫn ≤ 0,3° | 32 | O |
| G4-34 | `rim` | `graspSolve.ts` (`rim`, thụt theo bề dày), `graspGroups.ts` (vai trò trỏ–út, dáng) | `tom-hum`, `bao`, `bo-da`: khe trỏ–út ≤ v1 + 0,3; fixture lệch ≤ 1 đơn vị (nay 1,5 / 2,0) | ca fixture `rim` siết dung sai | 31, 33 | O |
| G4-35 | Vành đĩa theo góc | `graspSolve.ts` `dom("edge")` (đĩa: 0–330 bước 30), `graspGroups.ts` `checkChoice`, `holdLink.ts` `oppositeEdge` | `thu-tom-hum@sheet` giải ra `edge` số; `both` cạnh đối = +180 | `graspAt.test.ts` | 34 | S |
| G4-36 | Hàng mẫu | `bang-cam.mjs`: hàng mặc định in biến thể rig chọn, bỏ hàng trùng; tấm nằm/đĩa thêm "bê hai tay hai vành"; bỏ hàng hai tay khi hai cạnh cách < 1,2·W (rủi ro 9); chép sang video | `--nhom sheet` không còn hàng trùng | chạy | 35 | S |
| G4-37 | Docs + render | `docs/11` nhóm 1, mục 5 (giá biến thể, vành đĩa); `g4-sheet/` (`thu-bang-gia`, `thu-thuc-don`, `thu-tom-hum`, `thu-bao`, `thu-dien-thoai`) | `so-v1.md` | — | 36 | S |
| **cylinder** | | | | | | |
| G4-41 | Món thử | video `held/thu-chai-dia.json`, `thu-ong-nghe-ban.json`, `thu-chai-dac-tuyen.json`, `luoi-mon.ts` | `chai-dia` đoạn bám y 0–68,5; ống nghe `rod` r 3, R 9 | held-moc | — | S |
| G4-42 | Trục chung | `heldGeom.ts` (`axialAt(geom, f, along, around)`: điểm, `a`, `ρ`, `r(s)` trên đoạn bám liền), `graspSolve.ts` (`ContactInput` thêm `around`, `psi`, `inset`; `graspFrame` truyền) | `along` 0/1 là hai đầu đoạn bám (cắt `grip: false`), `r(s)` khớp `latheRadius` | `heldGeom.test.ts` | — | O |
| G4-43 | Chỗ tiếp xúc trụ | `graspSolve.ts` `CONTACTS.cylinder.wrap`, `graspGroups.ts` (bỏ `later`) | fixture `chai-dia#co` ≤ 5° / 1 đơn vị hai cỡ, hai tay; tay trái `det` +1, ngón quấn ngược | `graspSolve.test.ts` ca mới | 42 | O |
| G4-44 | Dáng theo bán kính | `graspGroups.ts` (`pose` của `wrap`; thanh mảnh, rủi ro 8) | `chai-dia` vai: lún ≤ 0,39 + 0,1; cán r 2,5: lún ≤ 0,65; khe ngón `wrap` ≤ 1,5 | `heldFitRoles.test.ts` | 43 | O |
| G4-45 | Biên `grip: false` | `graspGroups.ts` `needs`, `graspSolve.ts` (kẹp `along`), `checkChoice` | `ong-nghe-ban`: tâm nắm cách `loa`/`mic` ≥ 0,3·W; `along` sát loa bị kẹp, có dòng báo | `graspGroups.test.ts` | 43 | S |
| G4-46 | Trượt dọc thanh | `holdPlaced.test.ts` (chỉ test, sửa `scene.ts` nếu hỏng) | `along` 0,25 → 0,75 trên `rod`: khuỷu ≤ 2,5°/mẫu, món không giật | test | 43 | S |
| G4-47 | Hàng mẫu | `bang-cam.mjs`: mặc định, `along` low/high, `thumb: down`, `part` vai/cổ, ống nghe áp tai (tay dẫn, `around` lưng); chép sang video | | chạy | 44, 45 | S |
| G4-48 | Docs + render | `docs/11` nhóm 5; `g4-cylinder/` | `so-v1.md`; `chai-dac-tuyen` có cảnh báo `size` | — | 41, 46, 47 | S |
| **platform** | | | | | | |
| G4-51 | Món thử | video `held/thu-khay.json`, `thu-phieu.json` (+ tuỳ chọn `thu-khay-suat`), `luoi-mon.ts` | `khay` mặt đáy `day` đạt `needs` | held-moc | — | S |
| G4-52 | Cạnh của mặt | `heldGeom.ts` (`FaceFeature.edges`: tên, pháp tuyến trong, dài) | tên cạnh đáy khay `front/back/left/right` theo khung món | `heldGeom.test.ts` | — | S |
| G4-53 | Chỗ tiếp xúc đỡ | `graspSolve.ts` `CONTACTS.platform.palm` (`inset₀`, `ψ`, chọn mặt rủi ro 6, lưới `psi` rủi ro 6), `graspGroups.ts` (bỏ `later`) | fixture `khay#bung` (`ψ = ±90°`, `inset₀ ≈ W/2`), `phieu#do` ≤ 5° / 1 | `graspSolve.test.ts` | 42, 52 | O |
| G4-54 | Tay phụ khác nhóm | `holdLink.ts` `supportOf` (`place: bottom/back`, cạnh đối trên `face`) | `chai-dia@cylinder both` tay trái đỡ đáy; `dien-thoai@palmBox both` đỡ mặt sau; `khay@platform both` cạnh đối | `holdLink.test.ts` | 53 | O |
| G4-55 | `both` món đặt trước | `scene.ts` `graspStart`, `placedOther` (tay `both` giải trước, tay phụ giải `chooseMissing` với lấn của tay lead) | `actJoints` khớp `graspAtTime` cả tay phụ; t02 không đổi (v1) | `holdPlaced.test.ts` | 54 | O |
| G4-56 | Hàng mẫu | `bang-cam.mjs`: mặc định, hai tay `both`, `ψ` 0/90; thêm hàng `both` cho `cylinder` (rót đỡ đáy), `palmBox` (hai tay ôm); chép sang video | | chạy | 55 | S |
| G4-57 | Docs + render | `docs/11` nhóm 10, mục 5 (tay phụ món đặt trước), lưới `psi`; `g4-platform/` + render lại hàng `both` của `cylinder`, `palmBox` | `so-v1.md` (`khay#bung`, `phieu#do`) | — | 51, 56 | S |
| **card** | | | | | | |
| G4-61 | Món thử | video `held/thu-the-phong.json`, `luoi-mon.ts` | tấm đứng, `card`+`sheet` đạt | held-moc | — | S |
| G4-62 | Chỗ tiếp xúc thẻ | `graspSolve.ts` `CONTACTS.card.pad` (+ `edge` mặc định tay dẫn), `graspGroups.ts` (bỏ `later`) | fixture `the-phong#kep` ≤ 5° / 1; khe cái, trỏ ≤ v1 + 0,3 | `graspSolve.test.ts` | 00 | O |
| G4-63 | Hàng mẫu | `bang-cam.mjs`: mặc định (`edge: bottom`), `edge: top`, `thumb` mặt kia, tay dẫn đưa (`face: front → up`); chép | | chạy | 62 | S |
| G4-64 | Docs + render | `docs/11` nhóm 2; `g4-card/` | `so-v1.md` | — | 61, 63 | S |
| **chopsticks** | | | | | | |
| G4-71 | Món thử | video `held/thu-dua.json`, `luoi-mon.ts` | hai `rod` `que` | held-moc | — | S |
| G4-72 | Tầm cuộn theo biến thể | `heldFit.ts` (`HeldFitInput.curl`), `graspGroups.ts` (`VariantSpec.curl`), `holdLink.ts`, `src/attach.ts`, `src/held.ts` | không khai `curl` thì `heldFit` ra y số cũ (1 170 ca ngẫu nhiên của G3-06) | `heldFitRoles.test.ts` | — | O |
| G4-73 | Dáng `chopsticks` | `hand.ts` (`HAND_POSES`, `HAND_POSE_LABELS`, `HAND_GRIPS`), `graspGroups.ts` (`PlannedPose`), `heldAudit.ts` (`HELD_PINCHES`, rủi ro 10), `hand.test.ts`, `docs/01` bảng dáng, `docs/00` nếu đếm dáng | ảnh `pnpm can-tay`/`bang-cam` cho agent chính (đi cùng G4-77) | `hand.test.ts` | — | O |
| G4-74 | Chỗ tiếp xúc đũa | `graspSolve.ts` `CONTACTS.chopsticks.grip` (đường giữa hai que, `along` từ đầu cầm), `graspGroups.ts` (bỏ `later`, `curl ≤ 15`) | fixture `dua#cam` ≤ 5° / 1; khe cái, trỏ ≤ v1 + 0,3; lún ≤ 0,65 | `graspSolve.test.ts` | 42, 72, 73 | O |
| G4-75 | Hàng mẫu | `bang-cam.mjs`: tay dẫn trước ngực, ngọn chúc (`face: tip → forward, tilt −30`); chép | | chạy | 74 | S |
| G4-76 | Docs + render | `docs/11` nhóm 4, mục 6 điểm 4; `g4-chopsticks/` | `so-v1.md` | — | 71, 75 | S |
| **pen** | | | | | | |
| G4-81 | Món thử | video `held/thu-but.json`, `luoi-mon.ts` | `than` ra `lathe`/`rod` mảnh, `ngoi` không bám, `tip` có `dir` | held-moc | — | S |
| G4-82 | Dáng `tripod` | như G4-73 | như G4-73 | `hand.test.ts` | 73 | O |
| G4-83 | Chỗ tiếp xúc bút | `graspSolve.ts` `CONTACTS.pen.grip`, `graspGroups.ts` (bỏ `later`, `curl ≤ 15`) | fixture `but#viet` ≤ 5° / 1; lún ≤ 0,65 | `graspSolve.test.ts` | 42, 72, 82 | O |
| G4-84 | Hàng mẫu | `bang-cam.mjs`: tay dẫn ngòi xuống mặt bàn (`point: item:tip`, `face: tip → [0,5, 0,866, 0]`); chép | | chạy | 83 | S |
| G4-85 | Docs + render | `docs/11` nhóm 3; `g4-pen/` | `so-v1.md` | — | 81, 84 | S |
| **handle** | | | | | | |
| G4-91 | Món thử | video `held/thu-tui.json`, `luoi-mon.ts` | quai ra `rod`, `day` không bám | held-moc | — | S |
| G4-92 | Khe sau thanh | `heldGeom.ts` (khe từ thanh tới phần còn lại theo hướng ngón luồn), `graspGroups.ts` `handle.needs` | `tui` quai đạt, vành khay (`khay` `rod` sát đáy) không đạt | `heldGeom.test.ts`, `graspGroups.test.ts` | 42 | O |
| G4-93 | Chỗ tiếp xúc quai | `graspSolve.ts` `CONTACTS.handle.hook`, `graspGroups.ts` (bỏ `later`) | fixture `tui#xach` ≤ 5° / 1; khe trỏ–út ≤ v1 + 0,3 | `graspSolve.test.ts` | 92 | O |
| G4-94 | Hàng mẫu | `bang-cam.mjs`: tay buông xách (tay dẫn), món đặt trước ngang hông; chép | | chạy | 93 | S |
| G4-95 | Docs + render | `docs/11` nhóm 8; `g4-handle/` | `so-v1.md` | — | 91, 94 | S |
| **bowl** | | | | | | |
| G4-A1 | Món thử | video `held/thu-chen.json`, `luoi-mon.ts` | `lathe` có miệng | held-moc | — | S |
| G4-A2 | Chỗ tiếp xúc chén | `graspSolve.ts` `CONTACTS.bowl.side` (trục G4-42, cái về miệng), `graspGroups.ts` (bỏ `later`) | fixture `chen#kep` ≤ 5° / 1; khe cái–giữa ≤ v1 + 0,3 | `graspSolve.test.ts` | 42, 54 | O |
| G4-A3 | Hàng mẫu | `bang-cam.mjs`: mặc định, `around`, hai tay đỡ đáy; chép | | chạy | A2 | S |
| G4-A4 | Docs + render | `docs/11` nhóm 7; `g4-bowl/` | `so-v1.md` | — | A1, A3 | S |
| **cuối** | | | | | | |
| G4-Z1 | Docs tổng | `docs/11` dòng đầu (mười nhóm chạy, bốn nhóm để sau), mục 1 "Phạm vi", mục 9 giai đoạn 4 thành trạng thái; `docs/04` nếu `describe_held` đổi | không còn câu "`later`" sai, không câu lịch sử | `pnpm format:check` | mọi job | S |
| G4-Z2 | Kiểm cuối | — | mục 3 đủ; `thu-nhom-cam` ≤ 1 lỗi; MCP `describe_held` trên 13 món `thu-*` không còn `later` ở mười nhóm | — | Z1 | S |

**Song song được** (không chung file; theo luật worktree vẫn chạy lần lượt): mọi job "Món thử" (chỉ repo video) với job lõi cùng
nhóm; G4-72 với G4-73; G4-52 với G4-42. Mọi job đụng `graspSolve.ts`, `graspGroups.ts` hay `bang-cam.mjs` là tuần tự.

**Thứ tự chạy**: 00 · 11 12 13 14 · 21 22 23 24 25 · 31 32 33 34 35 36 37 · 41 42 43 44 45 46 47 48 · 51 52 53 54 55 56 57 · 61 62 63
64 · 71 72 73 74 75 76 · 81 82 83 84 85 · 91 92 93 94 95 · A1 A2 A3 A4 · Z1 Z2. Tổng 58 job (O 22, S 36).

## 3. Mốc commit và kiểm

Studio (`feat/nhom-cam`), một dòng, tiếng Anh:

| Mốc | Sau job | Commit studio | Commit video |
|---|---|---|---|
| M4-1 | 11–14 | `feat(rig): close palmBox finger gaps with pressing fingers along the far edge` | — |
| M4-2 | 21–25 | `feat(rig,cli): hang group carry holds from item seats` | `feat(held): add a v2 shopping bag test item with seats` · `chore(tools): copy bang-cam with carry sample rows` |
| M4-3 | 31–37 | `feat(rig,cli): prefer the default sheet variant, curl rim fingers over the edge and grip discs by rim angle` | `feat(held): add v2 menu, lobster plate and newspaper test items` · `chore(tools): …` |
| M4-4 | 41–48 | `feat(rig,cli): grasp cylinders and rods along their continuous grip span` | `feat(held): add v2 bottle and handset test items` · `chore(tools): …` |
| M4-5 | 51–57 | `feat(rig,cli): support items on an open palm and solve support hands of placed items` | `feat(held): add v2 tray and slip test items` · `chore(tools): …` |
| M4-6 | 61–64 | `feat(rig,cli): pinch cards between thumb and index pads` | `feat(held): add a v2 room card test item` · … |
| M4-7 | 71–76 | `feat(rig,cli): add a chopsticks hand pose and per-variant curl limits for chopstick holds` | `feat(held): add v2 chopsticks test item` · … |
| M4-8 | 81–85 | `feat(rig,cli): add a tripod hand pose for pen holds` | `feat(held): add a v2 pen test item` · … |
| M4-9 | 91–95 | `feat(rig,cli): hook bag handles with a finger gap check behind the bar` | `feat(held): add a v2 handbag test item` · … |
| M4-10 | A1–A4 | `feat(rig,cli): clasp bowls from the side with the thumb at the rim` | `feat(held): add a v2 cup test item` · … |
| M4-Z | Z1 | `docs: describe ten running grip groups` | — |

Thêm dáng tay (M4-7, M4-8) không đổi hằng số hình học, không cần ghi breaking. Video không commit `package.json`,
`pnpm-lock.yaml`, `remotion.config.ts`.

**Kiểm sau mỗi mốc** (log vào `tmp/nhom-cam/g4-m<số>-*.log`):

```bash
# studio
pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build
# video (sau pnpm build ở studio; đường link: đọc dist)
pnpm test
pnpm exec stickman check --scene '^t02-' --only ref,held,clash \
  --baseline ~/Work/Dev/stickman-studio-3d-nhom-cam/tmp/nhom-cam/baseline/check-held-clash-g315.json   # 0 mới, 0 nặng hơn
pnpm exec stickman check --scene '^thu-nhom-cam'                                                      # ≤ 1 lỗi (wrist 2,0–2,3 s)
```

Đường v1 giữ nguyên tới giai đoạn 6: t02 khác baseline là lỗi của job vừa làm (thủ phạm hay gặp: `heldFit` mặc định, `HAND_POSES`,
`HELD_PINCHES`, `holdLink` cho v1) — không nâng baseline ở giai đoạn 4.

## 4. Rủi ro, chỗ cần quyết (mặc định đề xuất)

1. **Giá biến thể `sheet`** (G4-32): cộng `VARIANT_COST` cho biến thể khác mặc định khi rig giải, tách khỏi `DEV_COST`. **Mặc
   định 0,5**, chỉnh theo bảng; sửa spec mục 5.
2. **`palmBox` khoe một tay vượt 36°** (G4-12): nếu mọi `thumb`×`tilt` đều vượt thì là giới hạn khớp; **mặc định** `check` báo,
   khoe mặt ra khách dùng hai tay hay `sheet`; không nới miền `tilt`.
3. **Vai trò `palmBox`** trỏ–áp út `tip` → `press` (khớp v1 `wrap` hai đốt): đổi spec mục 3 nhóm 9. **Mặc định `press`**.
4. **Lật tấm 180°, đổi `thumb`** (`thu-nhom-cam` lỗi `wrist`): **mặc định** giữ `mixRotation` (spec mục 5 hiện tại), không làm đường
   quay quanh `m`; vùng chết 65–125° là giới hạn khớp, cảnh lo bằng hai tay/đổi tay. Lỗi của cảnh thử ở lại.
5. **Quy ước `around = 0`** của `rod`/`lathe`: **mặc định** `ρ(0)` = hình chiếu của `front` lên mặt vuông góc trục (không có
   `front` thì `b0` của `heldGeom`); lòng tay ở `+ρ(θ)`. Ống nghe "lòng áp lưng" là `around 180`. Ghi spec mục 3 nhóm 5.
6. **Chọn mặt `platform`** (không có trường cảnh; `face` của `hold` là ý định): **mặc định** không thêm trường — món đặt trước: mặt
   có pháp tuyến ngoài hướng xuống nhất ở mốc bắt đầu; tay dẫn: gần `−top`. **Lưới `psi`**: [−90, 90] bước 45° (5 điểm), sửa
   spec mục 5 ("`psi` 8").
7. **`touch` của treo vai**: fixture `tui-hieu` để `touch` (`upperArm`, `torso` 5) ở món → treo khuỷu v2 nhận thêm phần lấn mà v1 không
   có. **Mặc định** món không khai, cảnh `on: shoulder` khai `touch` (như `migrate-held` mục 8 bước 2); G4-23 so bằng cảnh khai.
8. **Thanh mảnh `r < 0,2·W`**: **mặc định** dáng `fist` cộng gập gốc (`knuckle`) theo ảnh, không thêm dáng.
9. **Hai tay trên món nhỏ** (điện thoại khoe hai bên chồng tay): **mặc định** `bang-cam` bỏ hàng hai tay khi hai cạnh cách < 1,2·W;
   không thêm luật `check`.
10. **`HELD_PINCHES`** thêm `tripod`, `chopsticks` (ngưỡng `grip` 5): **mặc định có**; v1 không dùng hai dáng này nên t02 không đổi.
11. **Xoay cẳng tay quá ±90** (chờ chủ dự án từ giai đoạn 3; `rim` cạnh dưới cần −103): **mặc định** giữ kẹp, `check` báo `wrist`.
12. **`both` món đặt trước** (G4-55) đổi thứ tự giải (tay `both` trước): chỉ cảnh v2 bị ảnh hưởng; `thu-nhom-cam` phải giữ số.
13. **Nhóm trùng khối hình**: `dua` đạt cả `pen`, `cylinder`, `handle`; `tui-hieu` đạt `cylinder`; `ong-nghe-ban` đạt `palmBox`.
    Cảnh khai nhóm nên không sai; **mặc định** không siết `needs`, chỉ `pen` cần đúng một thanh (không có thanh song song cùng phần)
    nếu `describe_held` gây nhầm.
14. Dáng mới hiện ở studio (`ActionPanel`), MCP `handPoses`; người 2D bỏ qua dáng lạ (AGENTS). `docs/00` câu đếm dáng phải sửa.
15. `w_cont` ở mẫu đầu lần cầm và `holdBlending` không làm im `pierce`/`sink`: chỉ xem lại khi bảng/cảnh thử báo giả.

## 5. Không làm ở giai đoạn 4

- **Giai đoạn 5**: `held/` sang v2 cho cả 34 món (giai đoạn 4 chỉ thêm `held/thu-*.json` đại diện); `tools/held-moc.mjs` kiểm nhãn
  phần, khối hình kỳ vọng; vá `held/tom-hum.json` v1 (9 `loose`).
- **Giai đoạn 6**: `stickman migrate-held`, chuyển cảnh t02 sang `hold` v2, xoá đường `món#kiểu`/`grips`/`gripFrame`, món mẫu
  `coc`/`tui` v2, nâng `SCENE_VERSION`, rig `8.0.0`, xoá Phụ lục A, baseline mới.
- **Để sau** (spec mục 1): nhóm `round`, `hug`, `clamp`, `soft`; biến thể `card.lateral`/`between`, `cylinder.index`, `handle.wrap`/`ring`,
  `platform.tips`, `bowl.base`; khối `path`, `ball`; `joints`; động tác `write`, `pick`; lớp không cầm (`press`, `push`, `tap`,
  `point`); `seats` thay bằng hình quai; thân người nghiêng, với theo món ngoài tầm.
- Không `pnpm shots`, không `tools/so-svg.mjs`; ảnh duyệt chỉ từ `bang-cam` (và `pnpm can-tay`/`frames` khi agent chính cần).
