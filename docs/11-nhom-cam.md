# 11 — Nhóm cầm

> **Lõi chạy mười nhóm `sheet`, `card`, `pen`, `chopsticks`, `cylinder`, `bowl`, `handle`, `palmBox`, `platform`, `carry`; bốn nhóm `round`, `hug`, `clamp`, `soft` để sau (`later`).** Cầm đồ của rig bàn tay theo **nhóm hình
> dáng**: món `held/<món>.json` khai hình, cảnh khai chỗ cầm `món@nhóm`. Các quyết định chủ dự án ghi như luật; các điểm
> chọn giữa các phương án ở [Đã chốt](#10-đã-chốt). Hằng số của bàn tay từ món ở mục [5](#5-giải-tay-theo-món); chỗ tiếp
> xúc, dáng và ngưỡng từng nhóm ở mục [3](#3-schema-nhóm-rig-grip_groups).

Nhóm cầm tách ba lớp: **nhóm cầm** ở rig, **hình món** ở `held/`, **lựa chọn và ý định** ở cảnh; rig tự tìm chỗ tiếp xúc
trên hình và tự chọn phương án ít vặn tay nhất. Cùng một cách bám khai một lần ở nhóm, đúng cho mọi món đạt điều kiện của
nhóm và cho cả hai tay.

## 1. Tổng quan

### Ba lớp

| Lớp | Nằm ở | Khai gì | Không khai gì |
|---|---|---|---|
| **Nhóm cầm** | Rig, dữ liệu TypeScript (`GRIP_GROUPS`) | Nhóm cần gì ở hình; cách đặt bàn tay lên chỗ tiếp xúc; dáng mở, dáng đóng theo cỡ; vai trò từng ngón; các lựa chọn, miền và mặc định; một hay hai tay, tay phụ mặc định; hướng món mặc định | Món cụ thể |
| **Món** | `held/<món>.json` (repo video) | Hình va chạm (`shape`) và số đo, mặt trước, đầu trên, phần có tên khi món không đều, phần không được cầm, khối chi tiết, mốc cho hướng món và `item:` | Cách cầm, dáng ngón, lòng tay, tay trái |
| **Cảnh** | `items` (món ở đâu, quay về đâu) và `cast[].world.hands[].hold` (mỗi tay cầm chỗ nào) | Chỗ và hướng món theo thời gian; nhóm, cạnh, vị trí dọc cạnh, mặt ngón cái… của từng tay theo thời gian | Cổ tay, khuỷu, dáng ngón |

**Món đặt trước, tay theo món.** Cảnh nói món nằm đâu (bảng giá ngang ngực, mặt về mặt người đọc) và tay cầm chỗ nào
(cạnh hông, một phần ba dưới); rig tính ra bàn tay trên chỗ cầm, cổ tay, ngón ôm theo hình và khuỷu tự nhiên. Cả món lẫn chỗ
cầm đi theo thời gian: nhát cuốc là mốc món đổi theo nhát, tay sau trượt dọc cán là `along` đổi giữa hai mốc tay. Lựa chọn cảnh
không khai thì rig tự giải trên món đã đứng yên ở chỗ khai (mục [5](#5-giải-tay-theo-món)).

Đọc, đưa, khoe, rót, xem, áp tai là **chỗ và hướng món**, không phải nhóm. Một món nhận nhiều nhóm; mỗi nhóm tiếp xúc ở chỗ
khác trên cùng hình: điện thoại xem thì bám hai cạnh dài (`palmBox`), đưa cho người khác thì kẹp mép (`sheet`), bê ngửa
trên lòng tay thì đỡ dưới (`platform`).

**Đường chọn theo từng lần cầm.** Lần cầm có mốc món (`items`, cùng món, cùng người cầm) trong khoảng của nó là **món đặt
trước**; không có là **tay dẫn**: mốc tay đặt bàn tay như nay (`to`/`at`, `point`), món gắn vào bàn tay theo chỗ cầm, hướng món
là ý định cổ tay cố đạt trong giới hạn khớp. Một món trong một cảnh đổi đường được giữa hai lần cầm: nhặt bút theo mốc, rồi
`regrip` sang tay dẫn để viết. Bút, đũa, điện thoại không có luật riêng.

**Lần cầm một tay theo mốc.** Đồ nhỏ cầm một tay chỉ cần vài mốc món (giơ ra, đặt xuống bàn, nhặt lên nhìn): rig giải bàn
tay, cổ tay, khuỷu ở từng mốc, giữa hai mốc bàn tay hoà trong hệ thân người cầm và **món đi theo bàn tay** — vẫn là đồ theo tay,
nhưng ở mốc món nằm đúng chỗ khai. Cầm hai tay thì món ở đúng `itemAt` mỗi khung, hai bàn tay giải theo món (mục
[5](#lần-cầm-theo-mốc)).

### Luồng dữ liệu

```
held/<món>.json ──► itemGeom(spec)            phần có tên → khối hình: slab, disc, rod, lathe, box, face
                                              (một lần mỗi món, WeakMap; bỏ khối chi tiết)
GRIP_GROUPS[nhóm] ─► needs · contact · pose · roles · choices · support · intent
                                                        │
scene: items (chỗ, hướng món theo t) ───────────────────┤
scene: hands[].hold (nhóm, chỗ cầm theo t) ─────────────┤
tư thế thân người ở t (sceneAt, hành động) ──────────────┤
cỡ tay người (k, long, s) ───────────────────────────────┘
                                                        ▼
       itemPose(t)          món trong thế giới (mục 4); tay dẫn: từ bàn tay
                                                        ▼
       graspAt(t)           chỗ cầm của từng tay; lựa chọn thiếu giải một lần mỗi lần cầm (mục 5)
                                                        ▼
       graspFrame(k, long, s) → GripFrame (món trong khung bàn tay)          ← graspSolve.ts
                                                        ▼
       bàn tay = món · GripFrame⁻¹  →  cổ tay  →  khuỷu tự nhiên (mục 5)    ← graspArm.ts, act3.ts
                                                        ▼
       dáng ngón = hoà(open, closed, w) ─► heldFit(roles) ngón ôm theo hình  ← heldFit.ts
```

`itemGeom`, `GRIP_GROUPS`, `graspAt`, `graspFrame` là **một nguồn** cho bộ giải tay (`act3.ts`), gắn món three
(`attach.ts`, `world.ts`), `check` (`heldAudit.ts`, `held.ts`), `scene_probe` và MCP (`packages/mcp/server.mjs`), bảng
`bang-cam`. Lớp liên kết tay ↔ món `holdLink.ts` là chỗ duy nhất dựng liên kết của chỗ cầm nhóm (`món@nhóm`) cho bàn
tay: `act3.ts` và `attach.ts` đọc liên kết qua nó. Code dựng lưới món của repo vẫn đọc mốc từ chính
`held/<món>.json` (`src/objects/cam.ts` của repo video).

| File lõi (`packages/rig/src/core/`) | Việc |
|---|---|
| `heldItem.ts` | Schema món (`HELD_VERSION` 3), `SceneHoldSchema` hai dạng, `graspLink` (bàn tay cầm → `GripFrame`), `ReachHold`, `HoldGrasp`, `HOLD_BLEND` |
| `heldGeom.ts` | `itemGeom`: phần, khối hình, miền bám, tên cạnh và mặt; `handDims` |
| `graspGroups.ts` | `GRIP_GROUPS`: điều kiện, biến thể, lựa chọn, tay phụ, hướng mặc định; `variantOf` (biến thể gốc hay kiểu cầm có tên của món) |
| `graspSolve.ts` | `graspFrame`, `chooseMissing` (giải lựa chọn thiếu), `graspAt`, `GraspReport`; `CONTACTS` là chỗ tiếp xúc của từng nhóm |
| `graspArm.ts` | Khuỷu tự nhiên `E(φ)` (`W_DOWN`, `W_BODY`, `W_CONT`), chuỗi `φ` |
| `arm3.ts` | Khung xương, luật đọc góc, IK, thân `Trunk3` — mô-đun lá mà `act3.ts` và các file trên cùng đọc; `act3.ts` xuất lại |
| `holdLink.ts` | Liên kết tay ↔ món của chỗ cầm nhóm cho `act3` và `attach` |
| `scene.ts` | `items`, `itemAt`, `graspAtTime`, `ReachHold.solve`, `holdBlending`, `checkHolds` |
| `heldFit.ts`, `heldAudit.ts` | Ngón theo vai trò, `skinDepth`; luật `check` |

### Phạm vi: bản đầu làm, để sau

Định nghĩa đủ 14 nhóm và hai lớp động tác (chủ dự án đã chốt danh sách), nhưng **bản đầu chỉ làm những gì cảnh đang
dùng**: mười nhóm chạy, bốn nhóm `round`, `hug`, `clamp`, `soft` là `later` (`needs` không bao giờ đạt, `check` báo "chưa làm"). Phần "để sau" giữ định nghĩa trong bản này để schema và tên không phải đổi khi làm tới.

| | Bản đầu | Để sau |
|---|---|---|
| Nhóm | `sheet` (`pinch`, `flat`, `rim`), `card` (`lateral`), `pen` (`grip`), `chopsticks` (`grip`), `cylinder` (`wrap`, `flat`), `bowl` (`pinch`, `side`), `handle` (`hook`), `palmBox`, `platform` (`palm`), `carry` | `round`, `hug`, `clamp`, `soft`; biến thể `card.between`, `cylinder.index`, `handle.wrap`, `handle.ring`, `platform.tips`, `bowl.base` |
| Khối hình | `slab`, `disc`, `rod`, `lathe`, `box`, `face` | `path` (quai cong), `ball` |
| Món | `shape` + `part` + `detail`, `parts` (kể cả quai `strap`), `front`, `top`, `anchors`, `seats`, `touch`, `hang` | `joints` (que trên của đũa), `soft`; `seats` thay bằng điểm treo rig chọn trên quai |
| Cảnh | `items` (cả mốc món nằm `rest`); `hold` có chỗ cầm, `"món@nhóm"`, `both`, `touch`, `regrip`; tay dẫn với ý định, `keep` | `write`, `pick`, lớp không cầm (`contact`) |
| Rig | Bàn tay từ món, khuỷu tự nhiên, giải lựa chọn thiếu, `heldFit` theo vai trò và tự hiệu chỉnh da, đo lún trên da, nhớ `heldFit` theo lần cầm | Thân người nghiêng, với theo khi món ngoài tầm |

## 2. Schema món (`held/<món>.json`, `HELD_VERSION` 3)

`schemaVersion` bắt buộc và là `3` (`HELD_VERSION`). Bản `2` nạp như bản `3` (`migrateHeldItem` chỉ nâng số; bản 3 thêm
`base`, `note` của [kiểu cầm có tên](#kiểu-cầm-có-tên)). File thiếu `schemaVersion` hay khai `1` là món bản 1 (kiểu cầm
khai theo món): zod báo lỗi kèm lệnh `stickman migrate-held` (mục [8](#8-chuyển-đổi)); số mới hơn rig cũng là lỗi zod.

### Trường

| Trường | Nghĩa |
|---|---|
| `size` | Hộp bao, đơn vị rig |
| `shape` | Hình va chạm: hợp các khối `box` / `cyl` / `ball` (`HeldShapeSchema`, [01](01-rig.md#hình-va-chạm-của-món)). **Bắt buộc**. Mỗi khối thêm `part?: "<tên>"` và `detail?: true` |
| `front` | Mặt trước: tên mốc có `dir` (màn, mặt chữ, nhãn) hay vectơ khung món. Bỏ trống là `+z` |
| `top` | Đầu trên: tên mốc có `dir` hay vectơ. Bỏ trống là `+y`; món có miệng (`lathe` có `wall`) thì bỏ trống là hướng miệng |
| `anchors` | Mốc có tên `{ at, dir? }`: trục ý định (`screen`, `nhan`, `mouth`, `speaker`, `tip`) và điểm `item:<mốc>` |
| `parts` | Thuộc tính phần (các khối cùng nhãn `part`): `grip: false` (không được cầm), `as` + `axis` (ép kiểu khối hình khi rig suy sai), `strap: true` (quai của món treo: không thuộc thân món, không vào khối hình; rig dời món tới khi quai tựa lên người — [01](01-rig.md#món-treo)) |
| `seats` | Chỗ treo của nhóm `carry`: `{ "elbow"?: mốc, "shoulder"?: mốc }` (đỉnh quai, mặt trong) |
| `touch` | Phần người được lấn vào món khi cầm, cộng với bàn tay, cẳng tay cầm (mặc định); `touch` của chỗ cầm ở cảnh cộng thêm |
| `hang` | Nhóm con thõng theo trọng lực |
| `joints`, `soft` | Que xoay được trong tay (gắp); vật mềm — để sau |
| `authored` | Kiểu cầm soạn tay theo `nhóm` rồi `biến thể` hay tên kiểu cầm: bàn tay, dáng ngón người chỉnh bằng mắt trong studio 3D, rig dùng thay chỗ tiếp xúc của nhóm ([bên dưới](#kiểu-cầm-soạn-tay-authored)). Ngoại lệ duy nhất của "món không khai cách cầm" |

- Khối không gắn nhãn thuộc phần ngầm `body`. Món đều (điện thoại, phiếu, thẻ) không cần nhãn phần.
- **`detail: true`** đánh dấu khối chi tiết (nút sườn, cụm camera, kẹp bút): rig **bỏ khi suy khối hình**, nhưng vẫn tính
  khi ngón ôm (`heldFit`), khi đo `sink`, `pierce`, và khi đo lồng vào người. Khai thẳng trong JSON, không suy theo thể tích
  (một ngưỡng thể tích không bỏ được kẹp bút mà lại bỏ được tôm hùm nằm cùng phần với đĩa).
- **Một trục, một nguồn.** Món có miệng (`lathe` có khối `wall` ở một đầu) lấy đầu trên từ miệng; khai thêm `top` lệch
  hướng miệng quá `10°` là lỗi parse.

### Khối hình rig suy ra (`itemGeom`)

Rig đọc mỗi phần (bỏ khối `detail`) rồi suy các khối hình. Một phần có thể ra nhiều khối hình; mỗi nhóm lấy loại nó cần.
Đơn vị là đơn vị rig của món.

| Khối hình | Suy từ | Số đo |
|---|---|---|
| `slab` (tấm) | Hộp bao của phần (trục khung món) có cạnh ngắn nhất `t ≤ 0,25 ×` cạnh giữa; phần gồm từ hai khối trở lên thì các khối phải lấp đầy `≥ 0,5` hộp bao (lấy mẫu lưới `20³`): đũa không ra `slab` | Tâm, pháp tuyến hai mặt lớn, bề dày `t`, bốn cạnh có tên (dưới) |
| `lathe` (trụ tiện) | **Một** `lathe` cho mỗi phần, và chỉ khi **mọi** khối `cyl` của phần đồng trục: trục song song (lệch `≤ 2°`) và khoảng cách giữa hai trục `≤ 0,1 · r` (r bán kính lớn hơn của hai khối), bắc cầu. Một khối lệch trục thì phần ấy không ra `lathe` | Trục (trung bình các trục), bán kính theo chiều dài `r(s)` (tuyến tính từng khúc), miệng (khối có `wall` ở một đầu) |
| `disc` (đĩa) | `lathe` dài `≤ 0,3 ×` bán kính lớn nhất | Tâm, trục, bán kính vành, bề dày; vành là cạnh tròn |
| `rod` (thanh) | **Từng khối** (không phải hộp bao cả phần): khối `cyl` của phần không ra `lathe`, với `2r ≤ 0,5 ×` dài (như hộp: trụ ngắn béo không phải thanh); khối `box` có tiết diện (hai cạnh ngắn `a ≤ b`) với `b / a ≤ 3` và `b ≤ 0,5 ×` cạnh dài | Trục; `r` = nửa cạnh ngắn của tiết diện (bán kính `cyl`); `R` = nửa cạnh dài (`cyl`: `R = r`); `gap` = khe sau thanh (dưới) |
| `box` (hộp) | Mọi phần | Hộp bao, sáu mặt |
| `face` (mặt) | Mỗi mặt của `box`, mặt đáy của `lathe` | Tâm, pháp tuyến ra ngoài, hai nửa cạnh |

Hệ quả kiểm được trên món hiện có: biên lai (`0,3 × 20 × 48`, tiết diện 66 : 1) và điện thoại (`2,88 × 18,45`, 6,4 : 1)
không ra `rod`, nên không cầm được bằng nhóm `cylinder`; đũa ra hai `rod` (mỗi que một khối `cyl`); đĩa tôm hùm (hai bộ trụ côn
lệch trục 2 đơn vị, bán kính 21–35) ra một `lathe` vì `2 ≤ 0,1 · 21`; tay cầm ống nghe máy bàn (`box 18 × 6 × 44`, tiết diện
3 : 1) ra `rod` `r 3`, `R 9`.

**Khe sau thanh** (`RodFeature.gap`, `rodGap`): khoảng từ mặt thanh tới các khối khác của món (mọi khối ngoài `blocks` của thanh),
cho ngón móc quanh thanh. Từ mặt thanh theo `ρ(θ)` dò cầu (`heldDistance`) tới khối khác; `θ` lấy `GAP_AROUND` = 24 hướng quanh trục
và lấy **hẹp nhất** (ngón luồn qua phía nào cũng phải có chỗ), rồi trên mỗi đoạn bám liền lấy `GAP_ALONG` = 9 điểm dọc trục và lấy
**rộng nhất** (một điểm đủ chỗ cho bàn tay). Món không có khối nào khác ngoài thanh, hay tia không chạm
khối nào, thì `gap = Infinity`.

Miền bám của một khối hình trừ vùng nằm trong hộp bao của phần `grip: false` (cộng một bán kính ngón): ống nghe bám được
thân, không bám được hai đầu loa, mic. **Đoạn bám liền** (`gripSpan`) là chuỗi khối đồng trục nối nhau, cắt ở phần `grip: false`;
hộp chạm sát đầu đoạn (miệng chai nối cổ) tính là cắt. Mỗi đầu đoạn nhớ phần cắt nó (`GripSegment.cut`); đầu của chính khối
thì không có phần cắt.

**Điểm dọc trục** (`axialAt(geom, f, along, around)`, cho `lathe` và `rod`): `along` 0 và 1 là hai đầu của đoạn bám liền chồng
nhiều nhất lên khối (không phải hai đầu khối: phần `grip: false` đã cắt), nên chai nối cổ–vai–thân là một đoạn. `around` (độ)
quay hướng bán kính `ρ` quanh trục `a` (về phía `U`):

- `ρ(0)` là `front` chiếu lên mặt vuông góc trục (`ItemGeom.hasFront`: món khai `front`); món không khai `front`, hay `front`
  dọc trục, thì `ρ(0)` là `b0` của khối hình. `ρ(90) = a × ρ(0)`. `ρ(θ)` không phụ thuộc `along`.
- `r` là khoảng từ trục tới mặt món theo `ρ`, lấy ở khối đồng trục chứa điểm (lớn nhất ở chỗ nối): `lathe` theo `r(s)`, `rod` tròn
  theo `r`, `rod` hộp tới mặt tiết diện theo `ρ` (`R / |cos|` hay `r / |cos|`, lấy nhỏ hơn), nên thanh dẹt có `r` khác nhau theo `around`.
- Tuỳ chọn `clear` kẹp `along` cho điểm cách phần cắt `grip: false` ít nhất `clear` dọc trục (`alongRoom`); đoạn ngắn quá thì giữa
  đoạn. Kết quả mang `along` đã kẹp. Phần `grip: false` che hết khối thì ném lỗi.

**Tên cạnh, tên mặt của tấm.** Từ `front` (F) và `top` (U), `right = U × F` (bên phải khi nhìn vào mặt trước).

- Tấm đứng (pháp tuyến mặt lớn lệch U từ `45°`): hai mặt `front`, `back`; bốn cạnh `top`, `bottom`, `left`, `right`.
- Tấm nằm (pháp tuyến mặt lớn lệch U dưới `45°` — khay, đĩa, phiếu đặt ngửa): hai mặt `top`, `bottom`; bốn cạnh `front`,
  `back`, `left`, `right`.
- Đĩa: cạnh là góc (độ, từ `front` — hay `top` với đĩa đứng — về `right`); các tên trên ứng với `0`, `90`, `180`, `270`.

**Đầu thấp, đầu cao của một cạnh** (cho `along`): cạnh của tấm xét theo hướng món trong thế giới, luật ở
[mục 4](#chỗ-cầm-worldhandshold). Trục của `lathe`/`rod` thấp là phía ngược U.

### Ví dụ

```jsonc
// held/dien-thoai.json — món đều: không nhãn phần; cụm camera, hai nút sườn là chi tiết
{
  "schemaVersion": 3,
  "size": [18.45, 37.8, 2.88],
  "front": "screen",
  "top": "top",
  "anchors": {
    "screen": { "at": [0, 0, 1.44], "dir": [0, 0, 1] },
    "back": { "at": [0, 0, -1.44], "dir": [0, 0, -1] },
    "top": { "at": [0, 18.9, 0], "dir": [0, 1, 0] },
    "bottom": { "at": [0, -18.9, 0], "dir": [0, -1, 0] },
    "speaker": { "at": [0, 17, 1.44], "dir": [0, 0, 1] }
  },
  "shape": [
    { "box": [12.69, 37.8, 2.88] },
    { "box": [18.45, 32.04, 2.88] },
    { "cyl": 2.88, "from": [-6.34, -16.02, -1.44], "to": [-6.34, -16.02, 1.44] },
    // … ba góc bo còn lại
    { "box": [6.84, 7.02, 0.81], "at": [4.18, 13.77, -1.85], "detail": true },
    { "cyl": 1.44, "from": [5.72, 15.21, -2.25], "to": [5.72, 15.21, -3.24], "detail": true },
    { "cyl": 1.44, "from": [5.72, 12.24, -2.25], "to": [5.72, 12.24, -3.24], "detail": true },
    { "box": [0.45, 4.5, 1.44], "at": [-9.45, 11.7, 0], "detail": true },
    { "box": [0.45, 4.05, 1.44], "at": [9.45, 9.9, 0], "detail": true }
  ]
}
// suy ra: slab (tấm đứng, t 2,88; cạnh top/bottom 18,45, left/right 37,8) · box (hai mặt dài cách 18,45) · face
// nhóm áp được (cỡ tay 1,61 – 2,16): sheet, card, palmBox, platform
```

```jsonc
// held/chai-dia.json — món không đều: thân, vai, cổ là phần; miệng không được cầm
{
  "schemaVersion": 3,
  "size": [20.4, 76, 20.4],
  "front": "nhan",
  "top": "mouth",
  "anchors": {
    "mouth": { "at": [0, 76, 0], "dir": [0, 1, 0] },
    "shoulder": { "at": [0, 56, 0] },
    "nhan": { "at": [0, 22, 10.45], "dir": [0, 0, 1] },
    "base": { "at": [0, 0, 0], "dir": [0, -1, 0] }
  },
  "shape": [
    { "cyl": 9.4, "from": [0, 0, 0], "to": [0, 0.8, 0], "r2": 10.2, "part": "than" },
    { "cyl": 10.2, "from": [0, 0.8, 0], "to": [0, 40, 0], "part": "than" },
    { "cyl": 10.2, "from": [0, 40, 0], "to": [0, 44, 0], "r2": 9.8, "part": "vai" },
    // … khối 3–7 "vai" (r 9,8 → 4,4, y 44–61)
    { "cyl": 4.4, "from": [0, 61, 0], "to": [0, 68.5, 0], "part": "co" },
    { "cyl": 5.1, "from": [0, 68.5, 0], "to": [0, 76, 0], "part": "mieng" }
  ],
  "parts": { "mieng": { "grip": false } },
  "hang": ["dong-ruou"]
}
// suy ra: than lathe r 10,2 (y 0–40) · vai lathe r 10,2 → 4,4 (y 40–61) · co lathe r 4,4 (y 61–68,5) · face đáy
// đoạn bám liền: than + vai + co, y 0–68,5 (miệng loại)
```

```jsonc
// held/tui-hieu.json — món treo: chỗ treo theo `on`; `shape` là thân túi, không gồm quai
{
  "schemaVersion": 3,
  "size": [65.6, 94.1, 23],
  "front": "mat",
  "top": "quai",
  "anchors": {
    "quai": { "at": [0, 91.1, 0], "dir": [0, 1, 0] },
    "treoKhuyu": { "at": [0, 87.1, -14] },
    "mat": { "at": [0, 16.5, 9.18], "dir": [0, 0, 1] }
  },
  "seats": { "elbow": "treoKhuyu", "shoulder": "quai" },
  "shape": [ /* thân túi */ ]
}
```

`parseHeldItem` báo: `front`/`top`/`seats` trỏ mốc không có hay không `dir`, `top` lệch miệng, `as: "rod"` thiếu `axis`,
mọi khối đều `grip: false` hay `detail`, khoá `authored` không phải nhóm cầm; kiểu cầm có tên sai tên, thiếu `base`, `base`
không phải biến thể gốc của nhóm, hay `base` khai ở khoá là biến thể gốc ([bên dưới](#kiểu-cầm-có-tên)).

### Kiểu cầm soạn tay (`authored`)

Bộ giải đặt bàn tay theo chỗ tiếp xúc của nhóm; có kiểu cầm nó giải sai mà người nhìn là thấy (đũa ngược đầu, chén không có
gì kẹp). `apps/studio3d` cho người soạn kiểu cầm bằng mắt: món × nhóm × biến thể, tay phải, ở cỡ tay của một người trong cảnh.
Bản soạn lưu vào chính món, dùng cho **mọi cảnh** cầm món ấy bằng nhóm × biến thể ấy, cả hai tay, mọi cỡ tay.

```jsonc
// held/thuc-don.json — thêm vào món, phần còn lại giữ nguyên
"authored": {
  "sheet": {                                   // nhóm
    "flat": {                                  // biến thể (`palmBox`: `default`)
      "item": { "p": [0.038, -0.18654, 0.17496], "q": [-0.52583, -0.52583, -0.47277, 0.47277] },
      "anchor": "edge",                        // tâm nắm neo (`HAND_GRIPS`)
      "fingers": [72, 29, 5, 5, 58.5, 6, 55.5, 8, 1, 0],   // `HAND_DOF` bỏ `turn`, `bend`
      "fit": [0, 0, 4, 6, 0, 0, 8, 12, 0, 0],  // tuỳ chọn: `HAND_FIT` từng đốt
      "curl": 10,                              // tuỳ chọn: tầm `heldFit` thêm, mặc định `AUTHORED_CURL` = 10
      "choice": { "part": "body", "featureIndex": 0, "edge": "left", "along": 0.306, "thumb": "front", "slant": 70.3 }
    }
  }
}
```

- **`item`** là món trong khung bàn tay **phải** cỡ `1` (`k = long = 1`), người cỡ `1`: `GripFrame` với `u = 0,01`, `p` three,
  `q` quaternion `[x, y, z, w]` của `R`. Tay cỡ khác giãn quanh tâm nắm của dáng `anchor` như `graspLink` (điểm món ở tâm nắm
  ấy đứng yên trên món), món không đổi cỡ. `anchor` mặc định là dáng đóng của biến thể, nên tâm nắm mà `act3`, `holdLinkFrame`
  đọc (`gripCenter(hand.pose)`) khớp khung.
- **Dáng gốc** của khung cầm là `[0, 0, …fingers, …fit]` (`HandVec` kèm `HAND_FIT`, `authoredPose`). `heldFit` tính độ gập thêm
  **từ** `fit` và trả kết quả gồm nó; `Hand.heldV` mang cả mười số ấy, `poseHand` lấy `fit` của `heldFit` khi có. Vai trò ngón
  của biến thể giữ nguyên cho luật `check`, trừ `free` đổi sang `extend` (không hoà về dáng nghỉ, chỉ mở khi lún); tầm cuộn là
  `curl` của bản soạn (`GraspFrame.curl`, `frameCurl`), đủ để ngón chạm khít ở tay cỡ khác mà không phá dáng soạn.
- **Neo theo chỗ tiếp xúc.** `choice` là lựa chọn lúc soạn (trường cảnh khai cộng trường rig giải, cả `high` khi khác mặc
  định). Cảnh cầm ở lựa chọn khác (`along`, cạnh, `around`…) thì bàn tay đi theo chỗ tiếp xúc của bộ giải từ lựa chọn lúc soạn
  sang lựa chọn ấy (`slideHand`): giữ nguyên bàn tay trong khung (tâm nắm, lòng tay, ngón) của chỗ tiếp xúc. Cùng lựa chọn thì
  đúng bản soạn, không phụ thuộc hằng số của chỗ tiếp xúc. Bộ giải lựa chọn thiếu (`chooseMissing`) chấm giá trên chính bàn tay
  soạn.
- **Tay trái** là gương của độ lệch giữa bản soạn và chỗ tiếp xúc tay phải của bộ giải ở lựa chọn lúc soạn, đặt lên chỗ tiếp
  xúc tay trái (`mirrorHand`): phản xạ qua mặt (lòng tay, ngón) của chỗ tiếp xúc — mặt đối xứng cục bộ của món mà nhóm dùng.
  Bản soạn trùng bộ giải tay phải thì tay trái trùng bộ giải tay trái. Lựa chọn lúc soạn không dựng lại được (món đã đổi hình)
  thì gương theo khung `nf` / `nt` của biến thể và không dời.
- Món không có `authored` cho nhóm × biến thể đang dùng thì `graspFrame` như cũ (`raw` bỏ qua bản soạn). Khung cầm từ bản soạn
  mang `authored: true`.

#### Kiểu cầm có tên

Khoá của `authored.<nhóm>` là biến thể gốc của nhóm (`GRIP_GROUPS[nhóm].variants`, cũng là `GROUP_VARIANTS` của
`heldItem.ts`) hay **tên** một kiểu cầm riêng của món. Bản soạn ở khoá biến thể gốc là mặc định của nhóm × biến thể ấy cho
mọi cảnh; kiểu cầm có tên chỉ dùng khi cảnh gọi tên nó.

```jsonc
// held/thuc-don.json
"authored": {
  "sheet": {
    "flat": { "item": { … }, "anchor": "edge", "fingers": [ … ], "choice": { … } },   // mặc định của sheet × flat
    "kep-mep-doc": {
      "base": "flat",
      "note": "Kẹp mép dọc giữa ngón cái và ngón trỏ, tấm đứng thẳng, mặt về khách — đưa thực đơn",
      "item": { "p": [ … ], "q": [ … ] }, "anchor": "edge", "fingers": [ … ], "curl": 6,
      "choice": { "part": "body", "featureIndex": 0, "edge": "left", "along": 0.31, "thumb": "front", "slant": 70 }
    }
  }
}
```

- **Tên** viết `[a-z0-9-]+`, không trùng biến thể gốc của nhóm. **`base`** là biến thể gốc nó mượn: bắt buộc ở khoá có tên,
  cấm ở khoá là biến thể gốc, nên tên trùng một biến thể gốc (cả biến thể rig thêm sau) là lỗi `parseHeldItem`: đổi tên kiểu
  cầm. **`note`** (mọi khoá, tuỳ chọn) là mô tả cho người và agent; `list({ kind: "held" })` (`named`) và `describe_held` của
  MCP trả nó cùng tên và `base`, [`bang-cam`](#bang-cam-theo-nhóm) in nó dưới tên hàng.
- **Cảnh gọi** bằng `variant` sẵn có của chỗ cầm, hay dạng tắt `"món@nhóm/tên"`:

  ```jsonc
  "right": { "at": [-388, -240, 568], "point": "grip",
             "hold": { "item": "thuc-don", "group": "sheet", "variant": "kep-mep-doc",
                       "face": { "axis": "front", "toward": { "cast": "yoshie" } } } }
  ```

- **Mượn biến thể gốc.** Mọi chỗ tra bảng biến thể theo `variant` (`graspFrame`, `chooseMissing`, `checkChoice`, ý định
  `thumbToward` của tay dẫn, ngưỡng `grip`) đi qua `variantOf(món, nhóm, variant)` → `{ base, spec, authored }`: chỗ tiếp xúc,
  dáng, vai trò, `choices` và miền theo `base`; khung cầm theo bản soạn của chính tên ấy. Tay trái, cỡ tay khác, trượt theo
  chỗ tiếp xúc như mọi bản soạn (`mirrorHand`, `slideHand` qua chỗ tiếp xúc của `base`). `choice.variant` của khung cầm và
  của `GraspReport` là tên cảnh gọi, `base` mang biến thể gốc.
- **Rig không tự chọn kiểu cầm có tên.** `chooseMissing` chỉ thử biến thể gốc; cảnh không khai `variant` thì như món không có
  kiểu cầm có tên.
- **Tên lạ** (không phải biến thể gốc, không có trong `authored.<nhóm>` của món) là lỗi `choice` của `checkHolds` lúc
  `resolveScene` (và của `check`): dòng báo nêu món, nhóm, tên, biến thể gốc và các kiểu cầm có tên của món.
- Mỗi kiểu cầm thuộc một món; chép sang món khác là việc của studio.

Code ở `core/heldAuthored.ts` (`authoredFrom` dựng bản soạn từ khung cầm studio đang thấy, `authoredHand`, `mirrorHand`,
`slideHand`, `authoredPose`), nối vào `graspFrame` (`authoredPlace`); `variantOf`, `namedVariants` ở `core/graspGroups.ts`;
test `heldAuthored.test.ts`.

## 3. Schema nhóm (rig, `GRIP_GROUPS`)

### Cỡ tay

Mọi ngưỡng tính theo cỡ bàn tay của chính người cầm, đơn vị rig của món (cỡ người `s` triệt tiêu). Ba số, tính một lần mỗi
cỡ (`handDims(k, long)`) từ `HAND_BONES` và `handFrames` (`hand.ts:159`, `:210`):

| Số | Nghĩa | Ở cỡ `1` |
|---|---|---|
| `W` | Bề ngang lòng bàn tay (`2 · palm.half[1] · k`) | 8,4 · k |
| `A` | Khe đầu ngón cái – đầu ngón trỏ ở dáng `open` | 9,76 · k |
| `L` | Cổ tay tới đầu ngón trỏ, dáng nghỉ | 17,9 · long |

Bàn tay không nhân theo chiều cao người. Hai người có tay nhỏ nhất và lớn nhất trong repo video có `k 1,75` / `long 1,545` và `k 2` / `long 1,813`: `W` từ 14,7 tới 16,8. `bang-cam` xếp người theo `k · height` (1,61 / 2,16), không phải cỡ tay.

**Phụ thuộc ngón cái.** Ngón cái có gốc `[0,019, −0,033, 0,030]`, hai đốt `0,048`, `0,040` (`hand.ts:161`). `W`, `A`, `L`,
`P` và hệ số lòng tay `sheet pinch` đo trên bàn tay ấy; độ thụt `d` của
`sheet` ở nhóm 1 (bên dưới); khung chuẩn các nhóm khác là fixture của nhóm (`fixture`).

### Kiểu dữ liệu

```ts
type GroupId =
  | "sheet" | "card" | "pen" | "chopsticks" | "cylinder" | "round" | "bowl"
  | "handle" | "palmBox" | "platform" | "hug" | "clamp" | "carry" | "soft";

type FeatureKind = "slab" | "disc" | "rod" | "lathe" | "box" | "face" | "path" | "ball";

/** Vai trò một ngón (và lòng tay) với món — map vào `heldFit` ở mục 6 */
type FingerRole = "press" | "wrap" | "tip" | "support" | "free" | "extend";

interface GroupSpec {
  label: string;                                  // tiếng Việt, cho dòng báo
  needs: FeatureNeed[];                           // điều kiện hình học, theo cỡ tay
  frame: "nf" | "nt";                             // hai trục nhóm khai; trục thứ ba suy theo bên tay
  contact: (f: Feature, c: GraspChoice, h: HandDims) => Contact;   // at, palm, fingers|thumb trong khung món
  pose: Record<string, { open: PoseRef; closed: PoseRef; by: "thick" | "radius" | "width"; range: [number, number] }>;
  roles: Record<HeldFinger | "palm", FingerRole>;  // theo biến thể nếu khác
  choices: ChoiceSpec;                            // bậc tự do rời và liên tục, miền, giá trị mặc định
  hands: "one" | "two" | "either";
  support?: SupportSpec;                          // tay phụ mặc định khi cảnh khai `both`
  intent?: HoldIntentSpec;                        // hướng món mặc định (trục theo `front` / `top` / miệng của món)
  fixture?: string;                               // tên fixture GripFrame chuẩn trong test (mục 9)
  variantOf?: (f: Feature, g: ItemGeom, around: number | undefined, h: HandDims) => string;  // biến thể khi cảnh không khai và nhóm không có mặc định
  motion?: "write" | "pick";                      // động tác trong tay (để sau)
  later?: true;                                   // để sau: `needs` không bao giờ đạt, `check` báo "chưa làm"
}
```

**Tay trái không soi gương món.** Khung bàn tay hai bên có ngón cái về `+z`, lòng tay về `−side · x` (`hand.ts:6`,
`:216`–`:221`), nên phía ngón cái là `t = side · (n × f)` với `n` pháp tuyến lòng tay, `f` hướng ngón. Nhóm khai hai trong ba
trục theo **vai trò**, trục thứ ba suy theo bên tay:

- `frame: "nf"` — nhóm khai lòng tay và hướng ngón (tấm `pinch`, `flat`; hộp cỡ lòng tay; đỡ dưới; quai): ngón cái tự sang
  phía kia với tay trái, như tay người.
- `frame: "nt"` — nhóm khai lòng tay và phía ngón cái (thân trụ, chén: ngón trỏ, ngón cái về đầu trên; tấm `rim`: ngón cái
  về mặt có ngón cái): `f = side · (t × n)`, nên ngón quấn quanh trụ ngược chiều ở tay trái.

Món không bao giờ lật gương (`graspLink`), và món không khai gì riêng cho tay trái.

**Khung chuẩn của nhóm.** `contact` viết theo khung của khối hình (cạnh: `m` pháp tuyến ngoài của cạnh trong mặt tấm, `e`
dọc cạnh về đầu cao, `F` pháp tuyến mặt có ngón cái; trụ: trục `a`, hướng bán kính `ρ(θ)`), với hệ số rút từ một liên kết
chuẩn đã duyệt. Khung chuẩn đứng trên **fixture**: liên kết (`GripFrame`) chuẩn của từng biến thể dựng trên **bàn tay hiện
tại**, lưu ở `core/__fixtures__/grip-frames.json`; nhóm trỏ fixture bằng `fixture`. Ví dụ `sheet` `pinch` từ fixture
`bang-gia#doc`: `palm ≈ 0,7654 · F + 0,6436 · f` (với `f = [−0,94, 0, −0,34]` ra đúng `[−0,6, 0,76, −0,22]` của fixture, dư
0,005).

### Bảng tóm tắt

| # | `id` | Nhóm | Khối hình | Tay | Món ở repo | Phạm vi |
|---|---|---|---|---|---|---|
| 1 | `sheet` | Tấm kẹp mép (cả bê hai cạnh vật mỏng) | `slab`, `disc` | một / hai | bảng giá, hoá đơn, biên lai, phiếu ×3, thực đơn, báo, bìa hồ sơ, đĩa bò, đĩa tôm hùm, điện thoại (đưa) | bản đầu |
| 2 | `card` | Tấm nhỏ kẹp giữa ngón cái và sườn ngón trỏ, hay kẹp đầu ngón qua hai mép | `slab` mỏng | một | thẻ, thẻ phòng, giấy tờ | bản đầu (`lateral`, `edges`) |
| 3 | `pen` | Bút | `rod`/`lathe` mảnh + `tip` | một | bút | bản đầu (`grip`) |
| 4 | `chopsticks` | Đũa | hai `rod` mảnh + `tip` | một | đũa | bản đầu (`grip`) |
| 5 | `cylinder` | Thân trụ | `lathe`, `rod` | một / hai | chai ×2, bình, bộ đàm, ống nghe ×2 | bản đầu (`wrap`, `flat`) |
| 6 | `round` | Khối tròn | `ball`, `lathe` ngắn | một | — | để sau |
| 7 | `bowl` | Chén không quai | `lathe` có miệng | một / hai | chén | bản đầu (`pinch`, `side`) |
| 8 | `handle` | Quai | `rod` có khe sau (`path` để sau) | một | túi, cốc bia, vali, vòng chìa | bản đầu (`hook`) |
| 9 | `palmBox` | Hộp cỡ lòng tay | `box` | một | điện thoại | bản đầu |
| 10 | `platform` | Đỡ dưới | `face` | một / hai | khay ×3, chồng khăn, phiếu, sổ tay, đĩa | bản đầu (`palm`) |
| 11 | `hug` | Ôm vào thân | `slab`, `box` to | một | bìa hồ sơ (ôm ngực) | để sau |
| 12 | `clamp` | Ép hai lòng tay | `box` (hai mặt đối) | hai | chồng khăn | để sau |
| 13 | `carry` | Treo | `seats` + thân | một (cánh tay) | túi hiệu | bản đầu |
| 14 | `soft` | Vật mềm | `soft` | một | khăn | để sau |

### Từng nhóm

Ngưỡng chỉnh trên bảng `bang-cam`. "Lựa chọn" là các trường chỗ cầm cảnh khai; thiếu thì
món đặt trước để rig giải, tay dẫn lấy giá trị in đậm (mục [5](#lựa-chọn-cảnh-không-khai)). **Hướng mặc định** là hướng món
khi mốc món không khai `face`/`up` (món đặt trước), hay ý định cổ tay khi `hold` không khai (tay dẫn).

#### 1. `sheet` — tấm kẹp mép (bản đầu)

- **Cần**: `slab` hay `disc` có bề dày `t ≤ 0,45 · A`; cạnh được cầm dài `≥ 0,6 · W`.
- **Chỗ tiếp xúc**: một điểm trên cạnh, ở `along`; tâm nắm thụt vào trong tấm `d` và đặt theo bề dày `t` của tấm (đơn vị
  rig của món, cố định ở mọi cỡ tay). `pinch`, `flat` lấy `t` và hai mặt **thật ở mép**: `spanAt` đo đoạn có vật liệu dọc
  `F` ở `SHEET_INSET` của biến thể vào trong mép (24 mẫu trên bề dày hộp bao) — tấm có chân, đĩa vành mỏng đặt theo vật
  liệu ở mép, không theo hộp bao; tấm phẳng một khối ra đúng hộp bao. `t` ấy cũng là `GraspContact.thick` mà dáng hoà theo.
  `flat`: giữa bề dày thật, `d` = 5 (`SHEET_INSET.flat`). `pinch`: cách mặt bốn ngón thật `PINCH_BACK` = 0,5,
  `d = max(0; 2,5 − 1,3 · (t − 1))` với `t` đo ở 2,5 trong mép (`SHEET_INSET.pinch`, `PINCH_OUT`; tấm dày hơn 1 thì tâm nắm
  lùi ra mép). `rim`: cách mặt ngón cái `F` `RIM_TOP` = 1,9 (tấm mỏng hơn 3,8 thì giữa bề dày), `d = max(1; 3,2 − 0,8 · t)`
  (`SHEET_INSET.rim`, `RIM_OUT`, `RIM_MIN`).
- **Biến thể**:
  - **`pinch`** (fixture `bang-gia#doc`, `frame: "nf"`): bốn ngón khép gập chừng 40° đè mặt kia, ngón cái đè mặt có ngón cái
    `F`; `n = 0,7654 · F + 0,6436 · f`, `f` = hướng vào trong tấm (`−m`) quay `slant` trong mặt tấm. Dáng mở → đóng: `sheet`
    với gốc ngón gập 30° → `sheet`, theo `t` trong `[0,05 · A, 0,45 · A]` (tấm dày thì mở). Ngón cái ở cả hai dáng là
    `PINCH_THUMB = [0, 10, 10, −20]` (`PoseRef.thumb`, góc bốn khớp ngón cái): khép theo trỏ, ngọn duỗi ngược để đầu ngón
    đè mặt `F` mà đốt gốc (da phình) tránh mép. Ngón cái ở mặt sau (`thumb` đổi mặt, quay π quanh `m`) đặt cổ tay bên kia
    mặt phẳng tấm vì lòng tay nghiêng 40°: vượt kẹp cổ tay 17–25° ở `slant` 30° (`bang-gia`, hai cỡ tay) — giới hạn khớp,
    `check` báo `wrist`; cầm bằng ngón cái mặt trước, `flat` hay `rim`.
  - `flat` (fixture `phieu-lien#cam`, `thuc-don#khoe`; `frame: "nf"`): lòng tay và ngón áp phẳng mặt kia, ngón cái vắt qua
    mép đè mặt `F`; `n = F`, `f = −m` quay `slant`. Dáng `edge`. Chỉ áp khi bề dày thật ở mép (`edgeThick`: giữa cạnh, 5
    vào trong) ≤ `FLAT_MAX · W` = 0,24 · W (`thickMax` của biến thể) — khe đệm ngón cái dáng `edge` tới mặt lòng tay (0,24 · W
    ở cỡ k 1,75 dọc 1,545; 0,25 · W ở k 2 dọc 1,813): dày hơn thì ngón cái không vắt qua mép. `chooseMissing` không thử
    `flat` ở cạnh quá dày; cảnh khai `variant: flat` thì `checkChoice` báo lỗi `choice` kèm bề dày và biến thể dùng được.
  - `rim` (fixture `tom-hum#nhac`, `bo-da#bung`, `bao#doc`; `frame: "nt"`): lòng tay áp mép, ngón cái trên mặt `F`, ngón dưới
    mặt kia — bê vành đĩa, cầm hai bên tờ báo; `n = −m`, `t = F`, ngón chúc `slant` quanh `m`. Dáng mở `edge`; dáng đóng
    `edge` cuộn thêm gốc ngón `PoseRef.knuckle` 45° và ngọn `PoseRef.tip` 65° (gập thêm đốt ngọn bốn ngón) với ngón cái
    `RIM_THUMB = [25, 20, 10, 25]` (chọn để `handGripOf` của dáng đóng còn ở kẽ cái–trỏ, không thì luật `grip` báo giả),
    theo `t` trong `[0,05 · A, 0,2 · A]`. Dáng hoà theo bề dày **thật ở chỗ ngón ôm**, không phải bề dày hộp bao: `thickAt`
    đo vật liệu dọc `F` ở `RIM_PROBE` = 1 vào trong tâm nắm (`RIM_STEPS` = 24 mẫu), ra `GraspContact.thick` mà dáng đọc
    khi `by: "thick"` — vành đĩa mỏng cuộn gần kín dù hộp bao dày.
- **Vai trò**: `pinch`: ngón cái `press` (mặt `F`), bốn ngón `press` (mặt kia), lòng tay `free`. `flat`: ngón cái `press`,
  bốn ngón `support`, lòng tay `press`. `rim`: ngón cái `press`, trỏ `wrap`, giữa `press`, áp út và út `support`, lòng tay
  `press`.
- **Lựa chọn**: `edge` (cạnh dài ≥ 0,6 · W trong bốn cạnh; đĩa: góc `0..330` bước 30° (`DISC_STEP`), `0` ở `front` — hay
  `top` với đĩa đứng — tăng về `right`; tay dẫn: tấm đứng `bottom` (đĩa đứng 180), tấm nằm cạnh phía tay ấy
  `right`/`left` (đĩa nằm 90 tay phải, 270 tay trái)); `along` ∈ [0, 1], **0,5** — tấm đứng cầm một tay (không `both`) thì
  góc cùng bên tay (tay phải góc phải người đọc): tay dẫn cách giữa cạnh ngang `SIDE_ALONG` = 0,25 lần dài cạnh về phía tay ấy
  nhìn từ mặt `front` (`sideAlong`; cạnh đứng giữ 0,5), món đặt trước cộng giá góc (mục 5); `thumb` — mặt có ngón cái: tấm đứng
  {`front`, `back`}, tấm nằm {`top`, `bottom`}; đổi bằng quay π quanh `m` (giữ chiều bàn tay). `rim` không khai `thumb` thì
  ngón cái ở mặt trên: món khai `top` và tấm nằm trong khung món thì mặt `top`, không thì mặt hướng lên trong thế giới khi
  lệch phương thẳng đứng dưới 45°; tấm đứng (cả trong thế giới) thì rig thử hai mặt. Mặc định (tay dẫn): mặt của
  tấm quay về người cầm ở mốc bắt đầu lần cầm — tấm đứng `front` hay `back` theo `F · (hướng tới tâm đầu người cầm) > 0`, tấm
  nằm `top`; món đặt trước đã giải. `variant` ∈
  {**`pinch`**, `flat`, `rim`}; `slant` ∈ [−60°, 60°] (`pinch`), [−90°, 90°] (`flat`; ±90 là ngón chạy dọc mép), [−45°, 45°]
  (`rim`).
- **Tay**: một hay hai. Tay phụ mặc định: cùng nhóm, cùng biến thể, cùng `thumb`, cạnh đối diện (tấm: cạnh có pháp tuyến
  ngoài ngược nhất; đĩa: góc + 180), cùng `along`. Hai tay
  cùng cạnh (hoá đơn hai tay cầm mép dưới) thì cảnh khai chỗ cầm từng tay.
- **Hướng mặc định**: `face: { axis: <front>, toward: "holderFace" }`, `roll: { axis: <top>, toward: "up" }`.

#### 2. `card` — tấm nhỏ kẹp bên (bản đầu: `lateral`, `edges`)

- **Cần**: `slab` có `t ≤ 0,2 · W`. Không giới hạn cỡ tấm. `edges` thêm điều kiện theo cạnh: bề rộng tấm từ cạnh có ngón cái
  sang cạnh đối diện (`acrossOf`) trong `EDGES_ACROSS` = [0,9; 1,35] · `W` (`VariantSpec.across`, `acrossMiss`) — thẻ phòng
  28 × 17,6 kẹp được qua hai cạnh dài (17,6 = 1,05–1,2 · `W`), không kẹp được qua hai cạnh ngắn (28).
- **Chỗ tiếp xúc** `lateral` (`frame: "nf"`, dựng từ hình học bàn tay, không fixture): kẹp bên (Feix #16) — đệm đốt ngọn ngón cái
  nằm phẳng trên mặt `F`, mặt kia tựa sườn ngón trỏ đang cuộn; thẻ chạy ra khỏi chỗ kẹp, nắm tay chỉ chạm một góc nhỏ gần mép.
  Hai hằng của khung bàn tay (lòng, ngón, phía ngón cái): `CARD_NORMAL` = (0,111, −0,687, 0,718) — pháp tuyến thẻ từ sườn
  trỏ sang đệm ngón cái, ngược hướng gập của đốt ngọn ngón cái — và `CARD_OUT` = (0,546, 0,646, 0,533) — hướng thẻ chạy ra
  khỏi chỗ kẹp (lòng tay, đầu ngón và phía ngón cái cùng góp). Khung cầm là phép quay đưa `CARD_NORMAL` về `F` và phần của
  `CARD_OUT` vuông góc với nó về `f` (`−m` quay `slant` trong mặt tấm). `thumb` kia là quay π quanh `m`.
  - Chỗ kẹp (`HAND_GRIPS.card`, giữa bề dày thẻ ngay dưới đệm ngón cái) thụt vào trong mép `CARD_INSET` = 0,12 · `W`, giữa
    bề dày thật (`spanAt`).
- **Chỗ tiếp xúc** `edges` (`frame: "nf"`, `cardEdges`, dựng từ da bàn tay ở dáng gốc, không fixture): kẹp đầu ngón qua hai
  mép (nhặt thẻ nằm trên bàn) — bàn tay úp phía mặt `thumb`, lòng tay chúc xuống mặt ấy mà không chạm; da đốt ngọn ngón cái tì
  cạnh `edge`, da đốt ngọn ngón trỏ tì cạnh đối diện; đường kẹp chạy ngang tấm (`−m` quay `slant` về đầu cao trong mặt tấm).
  - Đường kẹp trong khung bàn tay: từ điểm da ngón cái xa nhất về phía trỏ tới điểm da trỏ xa nhất về phía ngón cái (hai vòng).
    Khung cầm đưa đường ấy về đường kẹp của tấm, phần vuông góc của lòng tay về `−F`, rồi quay `tilt` quanh đường kẹp (dương:
    phía ngón cái nâng lên), rồi nghiêng đường kẹp quanh trục vuông góc nó cho điểm da thấp nhất của ngón cái và của trỏ cùng tầm.
  - Tầm: điểm da thấp nhất cách mặt kia của tấm (mặt bàn) `EDGES_LIFT` = 0,1; bề dày thật đo ở 0,5 vào trong mép (`spanAt`).
    Ngang tấm: trong các điểm da không cao hơn mặt `F`, điểm trong nhất của ngón cái và của trỏ cách hai mép đều nhau. Dọc
    cạnh: giữa hai chỗ chạm ở `along` (đường kẹp xiên thì chỗ chạm trỏ lệch `bề rộng · tan slant`).
  - Bề rộng kẹp (`bề rộng / cos slant`) ra `GraspContact.width`, dáng hoà theo nó (`by: "width"`).
- **Dáng** `edges`: `edgePinch` (`HAND_POSES.edgePinch`: ngón cái dạng 55°, đối 55°, gập gốc 5°, ngọn 15°, xoay sấp 35°; trỏ,
  giữa, áp út, út 50° và 40°, xoè 0) hoà sang dáng mở `edgePinch` với gốc bốn ngón duỗi 25°, ngọn 5° và ngón cái `[85, 25, 0, 5]`,
  theo bề rộng kẹp trong `EDGES_RANGE` = [−0,07; 1,38] · `W` — khe da đệm cái – đệm trỏ dọc đường kẹp gần bằng bề rộng ở 1,05 – 1,2
  · `W` (cỡ tay 1,75 – 2). Giữa, áp út, út co cùng trỏ, ở ngoài mép xa, không chạm tấm. Tâm nắm (`HAND_GRIPS.edgePinch`) giữa đầu
  ngón cái và đầu trỏ; `edgePinch` thuộc `HELD_PINCHES` (luật `grip` ngưỡng 5).
- **Dáng** `lateral`: `card` (`HAND_POSES.card`), một dáng cho mọi bề dày: ngón cái khép dọc sườn trỏ, đệm xoay về phía các ngón
  (`thumbRoll` 45°); trỏ cuộn mạnh ở đốt ngọn; giữa–út co lỏng dưới thẻ. Nang của đốt ngọn ngón cái và của trỏ chạm hai mặt
  thẻ ở dáng gốc (cỡ tay 1,61 – 2,16), không nang nào lún vào thẻ, nên `heldFit` gần như không đổi dáng.
- **Vai trò** `lateral`: cái `press`, trỏ – út `support`, lòng tay `free`; `curl` 15 — ngón cái chỉ ép thêm tới vừa chạm. Luật
  `oppose` xét ngón cái: đệm cái đối sườn trỏ qua thẻ (180°). `edges`: cái, trỏ `press`, giữa – út `support`, lòng tay `free`;
  `curl` 20. Luật `oppose`: đệm cái đối đệm trỏ qua thẻ (122–180°).
- **Biến thể**: **`lateral`**, `edges` (`VARIANT_COST` như mọi biến thể khác mặc định). Để sau: `between` (kẹp giữa trỏ và giữa, #23).
- **Lựa chọn**: `part`, `edge`, `along` (**0,5**), `thumb` (như `sheet`; `edges`: mặt mà bàn tay úp lên), `variant` ∈
  {**`lateral`**, `edges`}, `slant` ∈ [−90°, 90°] (`edges` [−30°, 30°]; **0**), `tilt` (chỉ `edges`, [−30°, 15°], **0**).
  Món đặt trước: rig giải `edge`, `thumb`, `along`, `variant`, `slant`, `tilt`; `slant` của `lateral` rig thử trên lưới riêng
  `[−40, 0, 40]` (`RangeChoice.grid`) — xoay xa hơn thì nắm tay che nhiều mặt thẻ hơn. `edges` có lưới riêng
  (`RangeChoice.gridByVariant`): `along` chỉ `0,5` (ngón cái, ngón trỏ ở trung điểm hai cạnh), `slant` `[−15, 0, 15]` (chỗ chạm
  trỏ lệch ≤ 4,7 khỏi trung điểm cạnh đối của thẻ phòng; thẳng góc thì cẳng tay sấp sát 90° ở thẻ trước bụng), `tilt`
  `[−20, −10, 0]` — `tilt` dương hạ áp út, út và mép lòng tay xuống mặt thẻ. `edges` có `sink`: ứng viên cộng giá lún như
  `palmBox` (mục 5). Biến thể có `upright` (`lateral`): ứng viên mà thân thẻ treo dưới bàn tay bị cộng giá (mục 5), nên thẻ
  dựng quay mặt ra người khác thì rig kẹp mép dưới hay mép bên, thẻ ở trên hay ngang nắm tay.
- **Ba cách cầm của cùng một biến thể** — khác nhau ở hướng thẻ, cảnh khai bằng ý định của tay dẫn hay chỗ đặt món:
  - *Xem*: thẻ trước ngực, mặt về mắt người cầm (hướng mặc định của nhóm); thẻ chạy từ nắm tay vào giữa.
  - *Khoe*: kẹp mép dưới, ngón cái ở mặt quay vào người cầm (`thumb: back` khi khoe mặt trước), `face: front → forward`
    (hay `camera`), `roll: top → up` — thẻ dựng trên nắm tay, mặt trước ra người xem.
  - *Đưa qua quầy*: tay duỗi ra trước, kẹp một mép, ngón cái ở mặt trên (`thumb` là mặt quay lên), `face: <mặt ấy> → up`,
    `roll: <mép xa> → forward` — thẻ gần ngang, chìa ra trước nắm tay.
  - Cầm buông ở hông: `face: holderFace`, `roll: <mép xa> → forward` — thẻ chĩa ra trước, xuống, ngoài đùi (hướng mặt
    mặc định của nhóm là cho thẻ trước ngực, đi với `roll` ấy thì lệch ~80°). Không ý định (`keep`) thì thẻ theo
    khung cầm, chĩa vào trong đùi.
  - Thẻ nằm phẳng trên mặt bàn (`lateral`): ngón cái ở mặt trên, nắm tay ở dưới mặt thẻ nên lún vào mặt bàn lúc đặt hay nhặt
    (chừng một nắm tay); nhặt thẻ nằm trên bàn là `edges`.
- **Nhặt thẻ nằm trên bàn** (`edges`): thẻ ngửa trước bụng (mốc món `face: front → up`, `roll: top → forward`), cảnh không khai
  gì: rig chọn `edges` (`lateral` đắt hơn nó cả khi `edges` mang `VARIANT_COST`: kẹp bên ở thẻ nằm cộng giá `upright` chừng 1),
  bàn tay phía mặt trên, ngón cái ở mép gần người, `along` 0,5, cổ tay không vượt kẹp (người mẫu `nguoi-cam-bang`, thẻ ngang
  hông, cách hông 55–75; `bang-cam` hàng nhặt trên bàn: cả hai cỡ tay, hai tay, không luật nào báo). Thẻ dựng (*xem*, *khoe*) rig vẫn chọn `lateral`. Thẻ sát người
  (cách hông 35) không có mặt đỡ thì rig chọn `lateral` với nắm tay dưới mặt thẻ (da dưới mặt 12,7); mốc món nằm (`rest`, mục
  [4](#mốc-món-items)) cộng giá mặt đỡ (mục [5](#mặt-đỡ)) nên rig chọn `edges` từ phía trên (da dưới mặt ≤ 0,2).
- **Tay**: một. **Hướng mặc định**: `face: { axis: <front>, toward: [−cos 20°, −sin 20°, 0] }` (hệ thân người cầm: mặt thẻ lùi
  về người cầm, ngửa `CARD_RISE` = 20°), `roll: { axis: <top>, toward: "up" }` — thẻ dựng xiên như ảnh mẫu `the-phong-xem`.
  Không dùng `holderFace` của `sheet`: thẻ trước ngực người chibi ngửa tới 45° thì kẹp bên chỉ với tới bằng khuỷu gập ngược
  (mục 5) hay cổ tay vượt kẹp; ngửa ≤ 20° thì bàn tay giữa ngực ra khuỷu thấp sát sườn, cổ tay gần thẳng.
- **Độ khớp** `lateral`: khe ngón cái ≤ 0,3, sườn ngón trỏ ≤ 1,0, lực đối 180° (sườn trỏ), lún ≤ 0,4, không xuyên, da trỏ – út
  chiếu lên ≤ 20% mặt thẻ phòng (7–17%) — hai cỡ tay, hai tay, ngón cái hai mặt, `slant` −40 / 0 / 40. `edges` trên thẻ phòng
  (cạnh dài): khe đầu ngón cái tới mép 0,43–0,51, đầu trỏ 0,22–0,45, lực đối cái – trỏ 122–180°, lòng tay cách mặt thẻ 5,9–10,
  điểm da thấp nhất trên mặt bàn 0,04–0,26, không lún, không xuyên (trục nang cách 2,4–2,7), tâm nắm cách thẻ ≤ 0,84 — hai cỡ tay
  (1,75 và 2, dọc 1,68), hai tay, bàn tay hai mặt, ngón cái hai cạnh, `tilt` −20 / −10 / 0.

#### 3. `pen` — bút (bản đầu: cầm; `write` để sau)

- **Cần**: `rod` hay `lathe`, bán kính `≤ 0,12 · W`, dài `≥ 1,2 · W`, mốc `tip` có `dir`; không có thanh song song cùng phần (cặp
  que là `chopsticks`, không phải một cây bút).
- **Chỗ tiếp xúc** `grip` (`CONTACTS.pen.grip`, `penGrip`; `frame: "nf"`, fixture `but#viet`): điểm trên trục ở `along`
  ([0,15, 0,45], **0,3**) của đoạn bám, đo **từ đầu đoạn bám gần mốc `tip`** (`ContactInput.tip`; thân bút, không tính ngòi
  `grip: false`). Lăn quanh trục cố định `0` (que tròn; kẹp bút là `detail`). Khung tại điểm trục: `d` trục từ ngòi về đuôi, `ρ`
  (`around` 0), `σ = d × ρ` (tay phải; tay trái đổi dấu). Lòng tay `PEN_PALM` = `[−0,7739, 0,4869, −0,4049]`, hướng ngón
  `PEN_FINGERS` = `[−0,4092, −0,8725, −0,2671]` (chiếu vuông góc lòng tay), tâm nắm cách điểm trục `PEN_OFF` · `W` với
  `PEN_OFF` = `[−0,11, 0,1852, −0,1555]`; ba vectơ là toạ độ theo `(d, ρ, σ)`. Thân bút ngả về khe ngón cái – ngón trỏ.
- **Tay trái là bản soi gương của tay phải** qua mặt chứa `d` và `ρ` (bút đối xứng qua trục): `at` và `palm` đổi dấu thành phần
  `σ`, `det` khung +1. Fixture tay trái của `grip-frames.json` có ngón cái ở phía xa thân bút và bút tì áp út — không phải cầm
  bút — nên test so tay trái với fixture tay phải soi gương.
- **Dáng**: `tripod` (soạn tay, ngón cái `[28, 45, 0, 0]` khép sát trỏ — mục [6](#6-ngón), [01](01-rig.md#bàn-tay); `by: "radius"` trong
  [0, 0,12] · `W`, cả hai đầu cùng dáng). **Vai trò**: cái, trỏ `press`; giữa `support`; áp út, út `free`. **`curl` 15**: ngón cuộn
  tới món tối đa 15° (mục 6 điểm 4).
- **Tay**: một. Món không có hướng mặc định: cảnh đặt bút trước ngực với `face` (ngòi ra trước chúc xuống, hệ thân
  `[tiến, y xuống, ngang phải]` ≈ `[0,8, 0,6, −0,2]`). Bút dựng đứng ngòi xuống (khung `held/`) thì kẹp ngón cái – ngón trỏ cần
  lệch cổ tay chừng 98°, vượt kẹp 72–78° và `check` báo `wrist`. Tay dẫn (`point: "item:tip"`) lấy hướng ngòi làm ý định cổ tay
  (ngòi xuống mặt bàn); đường đi của ngòi do cảnh khai.
- **Độ khớp**: fixture `but#viet` lệch 0,04° với hai bàn tay người thật và hai tay chuẩn cỡ 1,61 / 2,16 (vị trí lệch 0,20 – 0,22 với tay
  người thật, 0,45 – 0,51 với tay chuẩn); trên da, khe cái, trỏ, giữa ≤ khe của fixture + 0,3, lún ≤ 0,25, không xuyên.

#### 4. `chopsticks` — đũa (bản đầu: cầm; `pick` để sau)

- **Cần**: hai `rod` mảnh (`r ≤ 0,15 · W`) trong cùng phần, gần song song (lệch `≤ 15°`), mốc `tip`. Que đũa `r 1,5` ứng với
  `0,11 · W` ở tay nhỏ nhất.
- **Chỗ tiếp xúc** `grip` (`CONTACTS.chopsticks.grip`, `chopGrip`; `frame: "nf"`; ảnh mẫu `dua-an-can`): que đang xét là **que trên**,
  que bạn (cùng phần, lệch `≤ 15°`, gần nhất) là **que dưới**; tâm nắm ở **đường giữa hai que**. `along` ([0,15, 0,5], **0,35**) đo
  **từ đầu xa mốc `tip`** (`ContactInput.tip`; đầu cầm) dọc cả hai que. Khung tay phải đặt lên đường giữa: `CHOP_D` hướng que về ngọn,
  `CHOP_B` từ que dưới sang que trên, toạ độ khung bàn tay (lòng, dọc bàn tay, phía ngón cái) `[0,6387, −0,171, −0,7502]` và
  `[0,6252, −0,4531, 0,6355]`: hai que chạy ngang mặt lòng các ngón, ngọn ra ngoài phía áp út – út, đầu cầm nhô sau kẽ cái – trỏ.
  Tay trái soi gương tay phải qua mặt hai que. Đổi que đang xét là quay bàn tay nửa vòng quanh đường giữa: món đặt trước để rig
  chọn que trên theo cánh tay (`chooseMissing` thử cả hai que), tay dẫn lấy que đầu.
- **Dáng**: `chopsticks` (soạn tay; `by: "radius"` trong [0, 0,15] · `W`, cả hai đầu cùng dáng), tâm nắm `HAND_GRIPS.chopsticks` giữa
  hai que ở tầm đệm ngón. Que trên kẹp giữa đệm ngón cái và đệm trỏ, đốt ngọn ngón giữa ở dưới; que dưới tựa kẽ cái – trỏ và sườn
  đốt ngọn áp út; lòng tay không chạm que trên. **Vai trò**: cái, trỏ, giữa, áp út `press`; út, lòng tay `free`. **`curl` 15**: ngón
  cuộn tới món tối đa 15° (mục [6](#6-ngón) điểm 4).
- **Tay**: một. Món không có hướng mặc định: cảnh đặt món trước ngực với `face` (ngọn ra trước, chúc 30°) và `roll` (hai que nằm
  ngang); hướng khác thì tay theo khung cầm phải nâng khuỷu hay vượt kẹp cổ tay và `check` báo `elbow`, `wrist`. Tay dẫn lấy hướng
  món làm ý định cổ tay.
- **Độ khớp** (tay `1,75` / `2`, hai tay, hai que): trên da, que trên cách ngón cái ≤ 0,4, trỏ ≤ 0,6, giữa ≤ 1,3; que dưới cách kẽ
  cái – trỏ ≤ 0,25, áp út ≤ 0,3; đốt ngọn trỏ không chạm que dưới, áp út không chạm que trên; lún ≤ 0,25, lực đối ≥ 120°.

#### 5. `cylinder` — thân trụ (bản đầu: `wrap`, `flat`)

- **Cần**: `lathe` hay `rod` có `r ∈ [0,06 · W, 0,95 · W]` (với `rod` xét cả `R ≤ 0,95 · W`). **Đoạn bám liền** (mục 2) dài
  `≥ 0,6 · W` (ba ngón trỏ, giữa, áp út) và chứa được tâm nắm cách phần `grip: false` `≥ 0,3 · W` (`GRIP_CLEAR`; `alongRoom`).
  Cổ `chai-dia` (r 4,4, dài 7,5) qua vì nối với vai. Từ `0,8 · W` thì cảnh báo `size` (nắm không kín).
- **Chỗ tiếp xúc** `wrap` (`frame: "nt"`, fixture `chai-dia#co` — kiểu này nắm ở mốc `shoulder`, tức **vai**). Điểm trên trục
  là `axialAt` ở `along`, `around` (mục 2) với `clear = GRIP_CLEAR · W`, nên `along` khai sát phần `grip: false` bị kẹp về miền
  `alongRoom`. Lòng tay `n = −ρ`: `ρ` là hướng bán kính tại điểm, thanh hộp áp **mặt tiết diện gần `ρ` nhất** (`faceRho`; ống nghe
  `around` 150–210 cùng áp mặt lưng như 180). Phía ngón cái `t = ±a` (`thumb` `up` là `+a`, về đầu cao), hướng ngón `f₀ = t × n` (đổi dấu theo tay).
  - **Trụ to nằm chéo lòng tay**: hướng ngón chếch `slant` độ về phía ngón cái (`f = f₀ · cos + t · sin`), đủ khi số đo ngón cái
    (bên dưới) từ `0,42 · W`, hoà tuyến tính từ `0,36 · W` (`WRAP_BIG`); trụ mảnh hơn giữ `f = f₀`. Trục món đi từ gò út sang gốc
    ngón trỏ như tay người nắm chai: chỉ khi ấy mặt gập của ngón cái mới vòng quanh thân (trục vuông góc ngón thì ngón cái gập dọc
    trục). Chai đứng thì cẳng tay chếch lên tới bàn tay (ảnh mẫu `chai-than`). Mặc định `WRAP_SLANT` = 25°; cổ tay lệch quá kẹp
    (tay dẫn thấp trước bụng, cẳng tay ngang) thì cảnh khai `slant: 0`; rig giải thử cả `0` (`gridByVariant`), có giá lệch.
  - Lòng tay ngả theo **dốc mặt món**: đo bán kính ngoài ở 5 điểm (`WRAP_STEPS`) trên `±WRAP_HALF · W` = 0,3·W dọc trục, lòng nghiêng
    `WRAP_GAIN` = 1,6 lần góc dốc về phía `a`, tối đa `WRAP_TILT_MAX` = 45° (vai chai nghiêng 16,8° ra 26,8°, khớp fixture).
  - Tâm nắm dời ra theo `ρ` tới khi **da lòng tay** của dáng gốc (`palmSkin`, đỉnh có trọng số lớn nhất ở lòng tay, dáng đã hoà theo
    `r` tại chỗ cầm) còn cách hình `WRAP_GAP` = 0,7 (đơn vị món; fixture hở lòng 0,6–0,9); không có hình thì dời tới `r`.
- **Dáng** (`by: "radius"`, `unit: "W"`, `range [0,06, 0,95]`): mở → đóng là `grip` → `fist` hoà theo bán kính **tại chỗ cầm**
  (`r(s)` của `lathe` ở `axialAt`, không phải `rMax`: cầm cổ chai thì khép theo cổ), `rod` theo `R` (thanh dẹt nắm theo cạnh dài).
  Dáng gốc mở hơn chỗ chạm để `heldFit` cuộn tới: gập gốc, gập ngọn thêm của bốn ngón là `WRAP_OPEN` = `[−20, −80]` ở dáng mở và
  `WRAP_CLOSED` = `[−35, −85]` ở dáng đóng (`PoseRef.knuckle`, `tip`); đóng hơn thì đốt ngọn lún vào thân.
- **Ngón cái** (`PoseSpec.thumb`): tra bảng góc `[dạng, đối, gập gốc, gập ngọn]` theo số đo, nội suy tuyến tính, ngoài bảng lấy đầu
  gần; đè ngón cái của dáng hoà. Số đo của `cylinder` là bán kính **nhỏ hơn** của chỗ cầm và của chỗ cách `WRAP_THUMB_AHEAD` = 0,5·W
  về phía ngón cái (vai chai thắt lại; `thumbRadius`); `rod` dùng `R`. Hai họ, hoà ở `0,36–0,42 · W` cùng với độ chếch:
  - **Mảnh** (`r ≤ 0,36 · W`): đối hết, nằm dọc trục chồng lên trỏ–giữa về phía út.
  - **To** (`r ≥ 0,42 · W`): dạng hết, đối, vòng quanh thân về phía đối các ngón — đầu ngón cái và đầu ngón trỏ ở hai phía mặt phẳng
    qua trục và lòng tay, kẹp thân giữa ngón cái và các ngón (luật `oppose` ≥ `HELD_OPPOSE` tới `r` 0,7·W; trụ từ `SIZE_WARN · W`
    nắm không kín).

  | `WRAP_THUMB` (`r / W`) | 0,17 | 0,30 | 0,36 | 0,42 |
  |---|---|---|---|---|
  | `[dạng, đối, gập gốc, gập ngọn]` | 60, 60, 45, 60 | 60, 90, 45, 10 | 60, 90, 45, 10 | 100, 90, 0, 30 |

- **Vai trò** `wrap`: mọi ngón `wrap`, lòng tay `press`. Để sau: `index` (ngón trỏ duỗi dọc thân, #17).
- **Biến thể `flat`** (`kinds: ["rod"]`, `frame: "nf"`, fixture `dien-thoai#doc`): thanh hộp rộng hơn lòng tay thì cầm như điện
  thoại — thân trong lòng tay, ngón cái dọc một cạnh, bốn ngón ngang thân tì cạnh kia, kẹp giữa ngón cái và bốn ngón (ảnh mẫu
  `ong-nghe-tai`: ngón trỏ cao nhất ngay dưới loa).
  - **Khi nào rig chọn**: chỗ cầm không khai `variant` thì `variantOf` (`cylinderVariant`) trả `flat` khi khối hình là `rod` hộp có
    mặt rộng `2R ≥ FLAT_WIDE · W` (`FLAT_WIDE` = 1) và lòng tay áp đúng mặt rộng ấy: mặt gần `ρ(around)` nhất (`faceRho`) có
    pháp tuyến có `|cos|` với trục cạnh dài dưới 0,5 (ống nghe mặt lưng hay mặt trước ra `flat`, mặt hông ra `wrap`).
    Thanh tròn, trụ tiện (chai) và thanh hộp hẹp hơn lòng tay luôn `wrap`. `around` lấy của cảnh, không khai thì mặc định của
    nhóm. Cảnh khai `variant` thì giữ nguyên.
  - **Chỗ tiếp xúc** (`flatRod`): lòng tay `n = −ρ` với `ρ` là pháp tuyến mặt rộng áp (`faceRho`), phía ngón cái `t = ±a` (`thumb`
    `up` về `+a`, `down` ngược) như `wrap`, hướng ngón `f₀ = t × n` ngang thân chếch `BOX_RISE` = 20° về phía ngón cái như
    `palmBox`; không ngả theo dốc. Điểm trên trục và kẹp `along` như `wrap` (`axialAt`, `clear = GRIP_CLEAR · W`), dời
    `BOX_SHIFT` = 2 theo `f₀` về cạnh đầu ngón, rồi dời ra theo `ρ` tới khi da lòng tay còn cách hình `WRAP_GAP` = 0,7 (không có
    hình thì dời tới `r`).
  - **Dáng**: `span` ở cả hai đầu (không hoà theo bán kính; ngón cái dạng dọc cạnh); `by: "radius"` trong `[0,06, 0,95] · W` như
    `wrap`. Dáng kẹp đầu ngón nên `grip` dùng `HELD_GRIP_PINCH` (mục 7).
  - **Vai trò**: ngón cái, trỏ, giữa, áp út và lòng tay `press`, út `support`.
- **Lựa chọn**: `part` (phần có khối trụ, bám được; mặc định **phần có khối hình dài nhất**, `from: "longest"` — thân chai, không
  phải vai hay cổ), `along` ∈ {`low`, **`mid`**, `high`} hay số, `around` ∈ [0°, 360°) (mục 2; tay dẫn
  không khai thì `0`), `thumb` ∈ {**`up`**, `down`}, `slant` ∈ [0°, 25°] (**25**, `wrap`), `variant` ∈ {`wrap`, `flat`} (không khai thì rig suy theo `around`, xem `flat`). `along` trải **cả đoạn bám liền**, nên `part` chọn khối cho đặc trưng (số đo,
  mặt) còn `along` chạy qua mọi khối nối nhau. Tay trượt dọc thanh đổi `along` giữa hai mốc tay (mục 4).
  - Cảnh không khai `part`: rig chỉ giải trên phần mặc định (cầm vai, cổ chai thì cảnh khai). Rig giải `along`: lưới ¼, ½, ¾ của
    đoạn bám kẹp vào **chính khối hình** của ứng viên (`ownAlong`, giao miền `alongRoom`), nên thân chai không trượt sang vai cùng
    đoạn bám; tay dẫn lấy `along` 0,5 của đoạn bám.
  - Rig giải `thumb: "down"` (bàn tay ngược với món: ngón trỏ về đầu dưới) hay `slant` khác 25 cộng `OFF_COST` = 1 (`cost` của
    lựa chọn, mục [5](#lựa-chọn-cảnh-không-khai)): ống nghe ngón cái về loa, chai ngón cái ôm thân trừ khi cổ tay không theo được.
  - `along` khai sát phần `grip: false` quá `GRIP_CLEAR · W` thì rig kẹp tâm nắm về miền `alongRoom` và `check` báo **cảnh báo**
    `choice` (mục 7): nêu phần cắt, khoảng cách và `along` rig kẹp về.
  - Ống nghe máy bàn, máy tường, bộ đàm: `rod` của tay cầm, đầu cao là loa (`top`). Áp tai là lòng tay áp mặt lưng của thân
    (`around 180`; mặt trước nhô loa, mic), rig suy ra `flat`: ngón cái dọc cạnh về loa, ngón ngang thân; cổ tay kẹp thì ống nghe
    nghiêng theo bàn tay, chếch theo đường tai – miệng. Ý định loa vào tai ở cảnh. Trước ngực rig giải `wrap` ở mặt hông, ngón cái
    về loa (ảnh mẫu `ong-nghe-cam`).
- **Tay**: một hay hai. Tay phụ mặc định: `platform` ở mặt đáy (`place: "bottom"`; rót có tay đỡ, mục [5](#tay-phụ-both)). Chai đứng
  thẳng thì lòng ngửa của tay đỡ đáy cần xoay cẳng tay quá ±90°: đặt chai nghiêng nhẹ (`up` lệch về trước và về phía tay đỡ).
- **Hướng mặc định**: `up: <top>`. Rót không có chỗ nắm riêng: mốc món đặt miệng chai, nghiêng trục miệng về cốc; cảnh khai
  `part` (thân hay vai), không khai thì rig giải trên chai đã đứng yên (mục [5](#lựa-chọn-cảnh-không-khai)).

#### 6. `round` — khối tròn (để sau)

`ball`, hay `lathe` ngắn béo; biến thể `palm` (ôm cả lòng, #11; dáng mới `ball`) và `top` (đầu ngón úp từ trên, #12 — núm,
nắp; dáng mới `claw`). Lựa chọn: hướng tiếp cận, biến thể. Một tay.

#### 7. `bowl` — chén không quai (bản đầu: `pinch`, `side`)

- **Cần**: `lathe` có miệng, bán kính lớn nhất `≤ 1,3 · W`.
- **Biến thể**: chén có bán kính lớn nhất `≤ BOWL_PINCH_MAX · W` (`0,7`; chén rượu `r 8` với `W` 14,7–16,8 là 0,48–0,54) mặc định
  **`pinch`** (kẹp đầu ngón), to hơn mặc định **`side`** (`variantOf` của nhóm; cảnh khai `variant` thì giữ). Để sau: `base` (đáy trên đầu
  ngón, ngón cái gác miệng — chén cơm kiểu Nhật).
- **Chỗ tiếp xúc** `pinch` (`CONTACTS.bowl.pinch`, `bowlPinch`; `frame: "nt"`, dựng từ hình học bàn tay, không fixture): chén nằm trong
  vòng ngón cái – trỏ – giữa, ngón cái áp thành phía cổ tay, trỏ – giữa ôm thành phía đối diện; tầm cầm (giữa chỗ chạm ngón cái
  và chỗ chạm trỏ – giữa) ở `along` **tính từ miệng** (`PINCH_ALONG` = [0,4, 0,5], rig kẹp vào miền ấy — `low` mặc định 0,25
  thành 0,4): trỏ ôm phần trên thành, giữa phần dưới, ngón cái giữa hai ngón ấy và da ngón cái quanh chén dưới miệng; lòng tay
  không chạm chén. Phía ngón cái (chỗ chạm cái trừ trung điểm chỗ chạm trỏ – giữa) ở **`ρ(around)`**: dựng với lòng tay chiếu
  vuông góc trục về `−ρ(around)`, phía ngón cái về miệng, rồi quay cả chỗ cầm quanh trục chén cho phía ngón cái trùng `ρ(around)`.
  Trục chén đặt trong bàn tay sao cho đỉnh da gần nhất của đốt ngọn ngón cái và của đốt ngọn trỏ – giữa (dáng gốc) cùng cách
  thành `PINCH_GAP` = −0,2 (đơn vị món, âm là ép nhẹ), phía xa lòng tay: dựng trên mặt cắt rồi Newton hai ẩn trên hình thật (thành thuôn);
  trục chén nghiêng trong bàn tay tối đa `PINCH_TILT_MAX` = 25° cho chỗ chạm ngón cái ngang trung điểm chỗ chạm trỏ và giữa
  (hai vòng). Da lòng tay còn
  cách thành dưới `CUP_PALM_MIN` = 1 thì đẩy trục chén ra xa lòng tay, da ngón cái lún quá `PINCH_GAP` thì lùi khỏi ngón cái.
- **Dáng** `pinch`: `cupPinch` (`HAND_POSES.cupPinch`: ngón cái dạng 60°, đối 103°, gốc duỗi ngược 8°, ngọn duỗi ngược 15°, xoay
  sấp 45° (`thumbRoll`, [01](01-rig.md#bàn-tay)) — nằm ngang trước lòng tay, đệm quay vào thành; trỏ gập 32° ở gốc, 25° ở đốt ngọn;
  giữa, áp út, út 45° và 12°), dáng mở (`PINCH_OPEN`) duỗi gốc trỏ – út thêm 40°, ngọn 18° (`by: "radius"`, `[0,3, 0,7] · W`):
  chén `r 8` ở tay sakura hoà 0,6 về dáng mở, kuroiwa 0,45. Không xoay ngón cái thì đệm úp xuống, thành chén chỉ chạm sườn ngón cái
  ở đầu ngón. Tâm nắm (`HAND_GRIPS.cupPinch`) ở trục chén ngang tầm cầm. Ngón ôm chỉ cuộn thêm `curl` = 10° (khép khe, gỡ lún):
  cuộn nhiều hơn thì bước gỡ lún của `heldFit` gập ngón cái đi chỗ khác (độ lồi da gò ngón cái của `skinBulge`).
- **Vai trò** `pinch`: cái, trỏ, giữa `press`; áp út, út `support`; lòng tay `free`.
- **Hướng ngón cái** `pinch` (`thumbToward: "back"` của biến thể): phía ngón cái về thân người cầm, trỏ – giữa vắt ngang mặt chén
  quay ra ngoài (ảnh mẫu `chen-ruou-2`). Tay dẫn: thành ý định `roll` của lần cầm — trục `ρ(around)` của món về `back` hệ thân
  (cảnh khai `roll` hay `keep` thì thôi; `around` khai chỉ xoay chén quanh trục, ngón cái vẫn về thân). Món đặt trước mà cảnh không
  khai `around`: rig chỉ thử `around` trong `THUMB_TOWARD_SPAN` = ±60° (bước `THUMB_TOWARD_STEP` = 15°) quanh hướng về thân (ngang,
  dọc hướng mặt người, vuông góc `across`); hướng tốt nhất ấy vượt cổ tay mà cả vòng `around` có hướng vượt ít hơn quá `THUMB_OVER`
  = 1° thì lấy hướng ấy. Cảnh khai `around` thì giữ.
- **Độ khớp** `pinch` (chén `r 6–8`, cao 9; hai cỡ tay, hai tay, `along` 0,4 / 0,45 / 0,5): da lún ≤ 0,22, khe cái – trỏ – giữa ≤ 0,3,
  lòng tay cách thành 1,7–2,1, lực đối (mục 7) 154–155°, đệm đốt ngọn ngón cái lệch pháp tuyến vào trong của thành 43–45°
  (không xoay: 94–96°), da ngón cái quanh chén dưới miệng 0,3–1,2. Vùng da cách thành ≤ 0,5 dài: sakura cái 5,7, trỏ 5,7–6,4,
  giữa 4,7 (đốt ngọn 6,2 / 5,7 / 5,2); kuroiwa cái 5,4–6,1, trỏ 6,7 (`along` 0,5: 3,9), giữa 4,0–5,2 (đốt ngọn 7,3 / 6,7 / 6,1)
  — cái, giữa và trỏ kuroiwa ở 0,5 chưa đủ trọn đốt ngọn: chén `r 8` to gần gấp đôi chén mẫu so với bàn tay, ngón không vòng
  theo thành được hết đốt. Test giữ vùng chạm (da trong `SKIN_NEAR` của khe nhỏ nhất) ngón cái > 0,6 đốt ngọn của nó, trỏ hay
  giữa > 0,55, đệm ngón cái lệch ≤ 50°, lực đối ≥ 150°, lòng tay ≥ 1.
- **Chỗ tiếp xúc** `side` (`CONTACTS.bowl.side`, fixture `chen#kep`: lòng tay ôm thân, dáng `clasp`, `frame: "nt"` như trụ, phía ngón cái về
  miệng): điểm trên trục là `axialAt` ở `along` (tính từ đáy), `around` (mục 2); lòng tay `n = −ρ(around)`,
  ngả theo dốc thành (`slopeAt`, dùng chung với `wrap`) tối đa `BOWL_TILT_MAX` = 4° (fixture `chen#kep` lòng song song trục); hướng
  ngón theo `up` = trục miệng (`mouth: "lo"` thì ngược), phía ngón cái về miệng. Tâm nắm dời ra theo `ρ` tới khi **da lòng tay**
  (`palmSkin`) cách hình `BOWL_GAP` = −0,6 (đơn vị món; âm là áp lún nhẹ); không có hình thì dời tới `r`.
- **Dáng** `side`: `clasp` ở cả hai đầu, hoà theo `r` tại chỗ cầm (`by: "radius"`, `[0, 1,3] · W`). Ngón cái `BOWL_THUMB` = `[15, 50, −30, 20]`:
  ít dạng, đối nhiều, gốc duỗi ngược, nằm vắt trên vành chén phía lòng tay.
- **Vai trò** `side`: cái, trỏ, giữa `wrap`; lòng tay `press`; áp út, út `support`.
- **Độ khớp** `side`: fixture `chen#kep` (`around` 180, `along` 1/6) lệch 4,0° ở mọi cỡ tay và 1,45 (sakura) / 0,79 (kuroiwa) đơn vị, trong ngưỡng
  1,5 của test: fixture đặt tâm nắm `clasp` trên trục chén nên lòng tay lún 2,0 / 1,4, còn nhóm lún da 0,3–0,5 (≤ 0,65); ép lệch ≤ 1 thì lòng tay
  sakura lún ≥ 0,86. Khe cái–trỏ–giữa ≤ 0,9 (cái gác miệng chén hở nhẹ khi `along` 0,5).
- **Lựa chọn**: `part`, `variant`, `around` ∈ [0°, 360°), `along` ∈ [0, 0,5] (tên `low` = 0,25 là **mặc định**, `mid` = 0,5; `side` tính từ đáy,
  `pinch` tính từ miệng trong [0,4, 0,5]). Miền `side` dừng ở nửa dưới thành: cao hơn thì lòng tay trùm miệng chén và áp út, út không còn đỡ
  dưới; `pinch` cao hơn 0,4 thì da ngón cái trồi trên miệng, sâu hơn 0,5 thì trỏ hở ở tay to. `around` của `side` là phía lòng tay,
  của `pinch` là phía ngón cái. `around` còn bị cổ tay giới hạn: `side` 45 vượt 14–25°, 270 xuyên vào thân chén ở tay nhỏ; chén
  trước ngực mặt `front` ra trước, `pinch` 180 (ngón cái về thân) trong giới hạn ở tay nhỏ, `pinch` 90 vượt 48°.
- **Tay**: một hay hai; tay phụ mặc định `platform` dưới đáy (`place: "bottom"`, mục [5](#tay-phụ-both)): lòng ngửa đỡ đáy, ngón cái tay phụ
  `free`. Tay phụ ngửa xoay cẳng tay sát −90°: `check` báo `wrist` (cảnh báo, vượt 0,0°) dù chén nghiêng nhẹ (`up` lệch về trước và phía tay đỡ); món đặt trước ngực thì tay kẹp ở tay nhỏ vượt cổ tay chừng 2–3°.
  **Hướng mặc định**: `up` = trục miệng (một nguồn: miệng suy từ `wall`), miệng ngửa.

#### 8. `handle` — quai (bản đầu: `hook`)

- **Cần**: `rod` có `R ≤ 0,3 · W`, trục lệch `top` của món từ `HOOK_TILT` = 45° trở lên (thanh nghiêng ít hơn là quai đứng, quai đeo:
  không phải chỗ móc ngón), đoạn bám dài `≥ 0,8 · W`, khe sau thanh `gap ≥ HOOK_GAP · W` với `HOOK_GAP` = 2 · bán kính ngón trỏ / `W` ≈ 0,357
  (mục 2 "Khe sau thanh"; ngón trỏ là ngón to nhất). Quai cong (`path`, cốc bia) để sau; vành khay (thanh sát đáy) và quai
  trên của vali (khe 0) không đạt.
- **Biến thể**: **`hook`** (fixture `tui#xach`: móc bốn ngón). Để sau: `wrap` (nắm kín), `ring` (luồn ngón trỏ).
- **Chỗ tiếp xúc** `hook` (`CONTACTS.handle.hook`, `frame: "nf"`): tâm nắm trên trục thanh ở `along` (`axialAt`, `around` 0); ngón vuông
  góc thanh về phía `−top` (món treo dưới tay) luồn qua khe sau thanh, lòng tay về `ρ(0)` chiếu vuông góc với ngón. Fixture `tui#xach`
  ở `0°`, `0` đơn vị.
- **Dáng**: `hook` (`HAND_POSES.hook`) với `HOOK` = gốc ngón `−40°`, đốt ngọn `−10°` (`PoseRef.knuckle`, `tip`; gốc duỗi, ngọn gập
  chừng 90° móc dưới quai; dáng gốc gập 28–32° đẩy đốt gốc vào quai dày), `by: "radius"` trong `[0, 0,3] · W`, cả hai đầu cùng dáng.
  **Vai trò**: trỏ–út `wrap`, cái `free`.
- **Độ khớp**: fixture `tui#xach` lệch ≤ 5° / 1 đơn vị; trên da lún 0 (không xuyên), khe trỏ–út ≤ 0,25 (≤ khe của fixture + 0,3), lệch cổ tay −18,8° ở
  cỡ tay 1,61 và 2,16 (sát kẹp ±20°).
- **Lựa chọn**: `part`, `along` (**0,5**). **Tay**: một. **Hướng mặc định**: `up: <top>` (quai lên).
- **Chỗ đặt món**: túi hạ xuống dưới tay, quai ngang tầm tay buông. Đặt trước ngực thì quai cao hơn đầu tay với, cổ tay vượt kẹp
  35–46°; `bang-cam` đặt ngang hông (`to: "hip"`) và thêm tay dẫn: tay buông xách (không khai đích, tay ở tư thế đứng, món theo
  bàn tay).

#### 9. `palmBox` — hộp cỡ lòng tay (bản đầu)

- **Cần**: `box` có hai mặt dài song song cách nhau `w ∈ [0,7 · W, 1,9 · W]`, dày `≤ 0,6 · W`, dài `≥ 1,2 · W`.
- **Chỗ tiếp xúc** (`frame: "nf"`, fixture `dien-thoai#doc`): lòng tay áp mặt sau (`n` = pháp tuyến mặt trước), ngón cái
  dựng dọc một cạnh dài, đầu các ngón tì cạnh dài kia: `f` từ cạnh có ngón cái sang cạnh kia; điểm ở `along` dọc cạnh dài;
  lòng tay chếch `tilt` quanh trục dọc máy.
- **Dáng mở → đóng**: `span` → `span` khép bớt, theo `w`.
- **Vai trò**: cái `press` (cạnh), trỏ–áp út `press` (vòng ra sau, cuộn cả hai đốt tới tì cạnh kia), út `support` (đỡ
  góc dưới), lòng tay `press`.
- **Lựa chọn**: `thumb` ∈ {`left`, `right`} (cạnh dài có ngón cái; mặc định **cùng bên với tay**), `along` (**0,4**), `tilt`
  ∈ [0°, 25°] (**20°**). `tilt` từ 15° trở lên gò ngón cái ép cạnh có ngón cái (lún 0,3–1,4 ở cỡ tay 1,61), ≤ 10°
  không lún ở cỡ 1,61–2,16: rig giải `tilt` với giá lún (mục 5).
- **Khoe một tay** (màn ra người xem, tay trước ngực): mọi `thumb` × `tilt` × `along` đều vượt kẹp cổ tay (nhỏ nhất 12–14°,
  `thumb` khác bên tay, `tilt` 25°, `along` 1) — giới hạn khớp, `check` báo `wrist`; khoe bằng hai tay hay nhóm `sheet`.
- **Tay**: một; `both` được vì nhóm có `support: { group: "platform", place: "back" }`: tay phụ đặt lòng tay lên mặt sau (pháp tuyến
  `−front`) của máy, tay tới từ cạnh sau ngón (mục [5](#tay-phụ-both)). Hai tay ôm điện thoại trước ngực, màn về người cầm.
- **Hướng mặc định**: `face: { axis: <front>, toward: "holderFace" }`, không có `roll`: xem màn hình trước mặt thì cảnh khai
  `roll` và đặt máy ngang cằm ([mốc món](#mốc-món-items)). Áp tai: cùng nhóm, cùng chỗ bám, ý định màn vào má
  (`toward: { mark: "head" }`), cảnh đặt tay cạnh tai.

#### 10. `platform` — đỡ dưới (bản đầu: `palm`)

- **Cần**: một `face` chứa được `0,4 · W × 0,6 · L` (`2 · min(half) ≥ 0,4 · W`, `2 · max(half) ≥ 0,6 · L`).
- **Chỗ tiếp xúc** (`frame: "nf"`, fixture `khay#bung`, `phieu#do`): lòng tay ngửa áp mặt (`n` ngược pháp tuyến ngoài của mặt), ngón
  duỗi `PLATFORM_FLAT`. Tay đến từ cạnh `edge` của mặt (`FaceFeature.edges`: `name`, `inward`, `at`, `len`).
  - **`ψ`**: hướng ngón đo từ pháp tuyến trong của cạnh quay về đầu cao của cạnh: `0` ngón chĩa vuông góc vào trong mặt, `+90°`
    ngón chạy dọc cạnh về đầu cao, `−90°` về đầu thấp. Đầu cao theo `edgeHigh` (như đầu thấp của `along`,
    mục 4 "Vị trí dọc cạnh", đảo lại); không có hướng món trong thế giới (`graspFrame` thiếu `high`) thì đầu về `−front`, cạnh
    vuông góc `front` thì về `top`.
  - **`inset`**: khoảng từ cạnh tới tâm nắm theo pháp tuyến trong; mặc định vừa đủ cho bàn tay nằm trọn trong mặt,
    `inset₀(ψ) = ½ · (W · |sin ψ| + P · |cos ψ|)` (`platformInset`), `P` dài lòng bàn tay (10,1 · long). Fixture `khay#bung` (tay sát
    vành trái, phải; ngón về phía xa, `ψ = ±90°`) cho `inset₀ = W / 2` ≈ 6,7 ở cỡ `1,61`.
  - **`along`** kẹp cho bàn tay nằm trong cạnh: gót lòng `P` sau tâm nắm, đầu ngón `L − P` trước, ngang `W`, quay theo `ψ`; cạnh ngắn
    hơn bàn tay thì tâm nắm ở giữa cạnh.
  - Tâm nắm hạ theo pháp tuyến mặt tới khi da lòng tay cách hình `PLATFORM_GAP` = 0,15 (đơn vị món; không có hình thì đặt đúng mặt).
  - **Dáng** `PLATFORM_FLAT` = `flat` cộng gập gốc 30°, gập ngọn 5° (đệm ngón chạm mặt ngang gò lòng tay, da lòng dày hơn ngón), ở
    cả hai đầu dáng.
- **Chọn mặt** (không có trường cảnh cho mặt): `part`, `feature`, `featureIndex` khai thì giữ; không thì trong các mặt đạt `needs`,
  món đặt trước lấy mặt có pháp tuyến ngoài chúc xuống nhất ở mốc bắt đầu, tay dẫn lấy mặt gần `−top`; hoà thì gần `−front`
  (`supportFaces`).
- **Vai trò**: lòng tay `press`, ngón `support`, ngón cái `free`. Để sau: `tips` (đầu ngón đỡ, khay cao ngang vai).
- **Lựa chọn**: `part`, `edge`, `along` (**0,5**), `psi` ∈ [−90°, 90°] (**90°**), `inset` (cảnh khai thì đè; rig không giải). Rig
  giải `psi` trên lưới 5 điểm đều `−90, −45, 0, 45, 90` và `edge` từng cạnh của mặt (mục 5).
- **Tay**: một hay hai (`hands: "either"`). Tay phụ `support: { group: "platform", edge: "opposite" }`: cùng mặt, cạnh đối diện
  của cạnh tay dẫn (`oppositeEdge`: theo tên `left` ↔ `right`, `top` ↔ `bottom`, `front` ↔ `back`).
- **Hướng mặc định**: `face: { axis: "support", toward: "up" }`; trục `support` là ngược pháp tuyến mặt lớn (diện tích
  `≥ ½` mặt lớn nhất; gần `−top`, hoà gần `−front`) nên mặt đỡ ngửa lên: khay `top` lên, phiếu đỡ mặt sau `front` lên.
- **Giới hạn khớp**: lòng ngửa nằm sát kẹp xoay cẳng tay ±90°. Món sát ngực cần 93–108° và `check` báo `wrist`; món đặt xa ngực
  và thấp hơn (`to: "chest"`, `offset: [80, 20, 0]`) thì khay vừa kẹp, phiếu còn vượt vài độ. `bang-cam` đặt `platform` ở chỗ này.

#### 11. `hug` — ôm vào thân (để sau)

`slab` hay `box` có mặt lớn `≥ 2 · W × 2 · W`; mặt lớn áp ngực hay sườn, cẳng tay vắt ngang mặt kia, bàn tay khum mép xa.
Món gắn vào **cẳng tay** — cần thêm chỗ gắn cẳng tay ở rig (như `carry` gắn khuỷu, `carrySeat` của `attach.ts`).

#### 12. `clamp` — ép hai lòng tay (để sau)

`box` có hai mặt đối cách `w ∈ [1,2 · W, 2 ×` bề rộng vai`]`; hai tay bắt buộc; hai lòng tay áp hai mặt cùng độ cao, dáng
`flat`.

#### 13. `carry` — treo (bản đầu)

Món treo trên cánh tay, không nằm trong bàn tay — túi khoác khuỷu, túi đeo vai. Cảnh khai `group: "carry"` với `on`
(`elbow` | `shoulder`), `yaw?`, `touch?`; món khai `seats` và `shape` (thân; quai cứng khai thành phần `strap`). Không có lòng tay, ngón, ý
định; bàn tay theo hành động. Món áp được nhóm khi có ít nhất một chỗ treo trong `seats`; `on` bắt buộc và `seats[on]`
phải có. `carrySpecOf` đổi chỗ cầm ra spec treo `{ on, at: seats[on], yaw, touch }` (`touch` của món cộng của cảnh) mà
`carryFrame` (`heldCarry.ts`) nhận; cách treo mỗi khung ở [01](01-rig.md#món-treo). Quai `strap` tựa lên người: rig dời
món tới khi không viên quai nào trong cẳng tay, cánh tay trên, vỏ thân áo. **Để sau**: bỏ `seats`, rig chọn điểm treo
trên quai `strap` theo `on` (mặt trong quai cho khuỷu, đỉnh quai cho vai), một mốc cho mọi cách treo.

#### 14. `soft` — vật mềm (để sau)

Món `soft: true`, hình tĩnh. Kẹp góc dùng `card` `lateral`, vò trong nắm dùng `round` `palm`.

### Hai lớp không phải nhóm cầm (để sau)

| Lớp | Động tác | Khai ở cảnh | Rig cần thêm |
|---|---|---|---|
| **Không cầm** | `press` (úp tay ép phiếu), `push` (đẩy khay trượt), `tap` (bấm chuông, bấm màn bằng tay kia), `point` (chỉ) | Mốc `world.hands` như nay (`at`/`to`, `palm`, dáng), cộng `contact: { item, mark?, mode }` | Món không gắn vào tay (trừ `push`). `check` đo khe lòng tay (`press`), đầu ngón trỏ (`tap`) tới món, như dòng `(bấm)` của `cam-do`. `push`: món dời `Δ = cổ tay(t) − cổ tay(t₀)` chiếu lên mặt món nằm, `cổ tay(t₀)` lấy từ tư thế ở mốc (tất định), chỗ món lúc `t` là chỗ `extra` đặt cộng `Δ`. Lau cần `soft` |
| **Trong tay** | `write` (nhóm `pen`), `pick` (nhóm `chopsticks`) | Mốc tay cầm thêm `write: { size, rate }` hay `pick: 0..1` (nội suy như `w`) | `write`: điểm `item:tip` cộng một đường nguệch ngoạc tất định theo `t` trên mặt giấy. `pick`: món khai `joints.<que>`, lưới tách que trên thành nút có tên; rig xoay nút ấy và cộng gập vào gốc ngón trỏ, giữa |

Bản đầu: các động tác này đi đường hiện có (đích, dáng, hành động như `cam-dt-3d`).

## 4. Schema cảnh

Hai đường, theo **từng lần cầm** có mốc món trong khoảng của nó hay không. Khoảng của lần cầm là từ mốc tay mở nó (`since`)
tới mốc tay đầu tiên mở lần cầm khác hay buông (không gồm mốc ấy); mốc món tính khi cùng món và cùng người cầm (`cast`).

| Đường | Khi nào | Cảnh khai | Rig tính |
|---|---|---|---|
| **Món đặt trước** | Lần cầm có mốc món trong khoảng | Chỗ, hướng món (`items`); chỗ cầm từng tay (`hold`) | Bàn tay trên chỗ cầm, cổ tay, khuỷu, ngón |
| **Tay dẫn** | Lần cầm không có mốc món (bút đang viết, đũa, điện thoại áp tai) | Đích bàn tay như nay (`to`/`at`, `offset`, `point`); chỗ cầm; ý định hướng món | Món theo bàn tay; cổ tay cố đạt ý định trong giới hạn khớp |

Món đặt trước có hai cách theo số tay:

- **Cầm một tay theo mốc** (`grasp.keyed`): không `both`, tay kia không cầm cùng món trong lần cầm. Bàn tay giải ở từng mốc
  món, giữa hai mốc hoà trong hệ thân; món vẽ theo bàn tay đã vẽ (mục [5](#lần-cầm-theo-mốc)).
- **Cầm hai tay**: món ở `itemAt` mỗi khung, mỗi tay giải `φ` theo chuỗi mẫu.

### Mốc món (`items[]`)

`items` nằm ở cấp cảnh, cạnh `cast`: một món đi qua tay nhiều người (đưa, đổi tay) là một chuỗi mốc, mỗi mốc nêu người cầm
(`cast`). Chỗ cầm vẫn ở mốc tay của từng người (`cast[].world.hands[].hold`); ví dụ dưới viết gọn `"cast"` trong dòng tay thay
cho việc lồng vào `cast[].world.hands`.

```ts
const SceneItemMarkSchema = z.strictObject({
  t: TimeRefSchema,                                  // giây hay mốc tên, như world.hands
  cast: z.string(),                                  // người cầm: `to`, `offset`, `holderFace` tính theo người ấy
  item: z.string(),                                  // tên món, cả tên thể hiện `vali:2`
  to: z.enum(BODY_MARKS).optional(),                 // mốc thân người cầm
  at: v3.optional(),                                 // hay toạ độ thế giới
  offset: v3.optional(),                             // [tiến, y, ngang], ngang dương về phía tay phải người cầm
  point: z.string().optional(),                      // mốc của món đặt vào chỗ ấy; bỏ trống là tâm hộp bao
  face: z.union([AxisIntentSchema, IntentTargetSchema]).optional(),   // trục món quay về đích, `tilt` nghiêng khỏi đích
  up: z.union([z.string(), v3]).optional(),
  roll: AxisIntentSchema.optional(),
  ease: z.enum(EASE_NAMES).optional(),              // đường hoà vào mốc này; bỏ trống là `smooth`
  bezier: z.tuple([unit, unit, unit, unit]).optional(),   // điểm điều khiển của `ease: "bezier"`
  rest: z.literal(true).optional(),                  // món nằm trên một mặt ở mốc này; bỏ `at`/`to` là chỗ thả gần nhất
});
```

- **Hướng món là luật cứng**: `face`, `up`, `roll` cho trọn phép quay của món; bàn tay theo món. Không khai thì lấy hướng mặc
  định của nhóm tay đang cầm (mục 3: tấm `front → holderFace`, `roll: top → up`; trụ, chén, quai `up: top`; đỡ dưới: mặt đỡ
  ngửa). Hai tay cầm khác nhóm thì lấy nhóm của tay phải. Thiếu trục nào lấy trục ấy của nhóm. `check` lỗi `item`, rig không
  tự đổi: đích của trục phụ lệch đích của trục chính dưới 18° (|cos| > 0,95), dòng báo gợi `roll` khác; đích của một trục
  trùng chỗ món (trục ấy không cho hướng); `face` là đích trần mà nhóm tay đang cầm không có trục mặc định — biết tay cầm
  thì lỗi lúc nạp, `itemAt` ném `ItemAxisError`.
- **Người cầm thật**: mốc thân, `holderFace` và thân người cầm dựng trên JSON nhân vật của người ấy (`chars` của `itemAt`,
  `graspAtTime`, `sceneItemProblems`); thiếu là `HolderCharError`, không dựng trên người mẫu.
- **Hệ trục**: vectơ của `toward` và `up` ở hệ thân người cầm `[tiến, y xuống, ngang phải]`, như `HoldTarget.v`
  (`HoldTarget` của `heldItem.ts`); `at` là thế giới rig.
- **`holderFace`** là hướng từ chỗ món về người cầm: hướng ngang về tâm sọ, ngẩng tới tầm giữa hai mắt, góc ngẩng kẹp ở 45°
  so với mặt ngang hệ thân (người chibi, món ngang ngực mà không kẹp thì mặt bảng gần ngửa); nghiêng khác thì `tilt`.
- **Món giơ trước mặt** (xem điện thoại, đọc thẻ): đầu người que to so với tay, món ngang mắt thì tay duỗi thẳng và cổ tay
  vặn tới kẹp. Đặt món ngang cằm, lệch về phía tay cầm — `to: "eye"`, `offset` chừng `[45, 45, 10]` —, khuỷu gập, `holderFace`
  ngửa mặt món lên về mắt. Nhóm không có `roll` mặc định (`palmBox`) thì khai `roll: { axis: "top", toward: "up" }`, bỏ trống
  là đầu món có thể chúc xuống.
- **Giữa hai mốc** (`itemAt`): chỗ món hoà theo `ease` của mốc sau (bỏ trống là `smooth`; `bezier` theo `bezier` của mốc,
  bỏ trống là `BEZIER_DEFAULT`) trong khung mốc thân ở chính `t` (người cúi thì món đi theo người), hướng món hoà cầu
  (`slerp`) giữa hai phép quay giải ở hai mốc. Đích của `face` (người khác, mốc thân) đọc ở `t`.
- **`auto`** nối các mốc liền nhau của món cùng mang `auto` thành một chuỗi (mốc nằm không khai chỗ không thuộc chuỗi); đầu,
  cuối chuỗi và mốc kề không phải `auto` có tiếp tuyến `0`, hai mốc đơn lẻ là đúng `smoothstep`. Chỗ món, mốc đặt của món và
  cỡ bậc ba đơn điệu từng thành phần qua bốn mốc kề, mỗi mốc giải ở chính `t`. Hướng món: góc trắc địa giữa hai mốc kề
  cộng dồn dọc chuỗi, nội suy bậc ba ra phần của đoạn, rồi `slerp` trong đoạn — vận tốc góc liền qua mốc giữa. Trước mốc
  món đầu và sau mốc cuối, món giữ ở mốc gần nhất (kẹp như `world.hands`). Lần cầm một tay theo mốc không vẽ món ở `itemAt`
  giữa hai mốc: bộ giải chỉ đọc `itemAt` ở chính các mốc, món vẽ theo bàn tay (mục [5](#lần-cầm-theo-mốc)).
- Mốc món chỉ hợp lệ khi có tay cầm món ấy ở `t` (`check` lỗi `ref`). Món rời tay mà cảnh còn cần thì là đồ của cảnh, như nay.
- **Món nằm** (`rest: true`): món nằm trên một mặt ở mốc này (quầy, bàn). Cảnh không khai mặt đỡ: rig lấy mặt ngang qua điểm
  thấp nhất của khối hình món ở mốc (mục [5](#mặt-đỡ)). Hai dạng:
  - **Khai chỗ** (`at` / `to`, hướng như mọi mốc): đặt món xuống chỗ ấy.
  - **Không khai chỗ**: chỗ và hướng món là **lúc thả gần nhất** không sau `t` của món ấy (`itemReleased` của `scene.ts`) — bất
    kỳ người nào, tay nào, tay dẫn hay theo mốc: món người thả đã vẽ ngay trước mốc thả (`RELEASE_EPS` = 0,001 s), tức bàn tay
    đã vẽ · khung cầm (`actHeld`). Lúc thả là mốc tay mà không ai mang món, ngay trước đó có người cầm trong bàn tay (gỡ món treo
    không tính). Không khai được `point`, `face`, `up`, `roll` (zod). Nhân vật người thả lấy ở `rt.chars` (`buildWorld` điền từ
    `cast`, mặc theo `equip` lúc thả), không có thì `chars` của lời gọi; thiếu cả hai là `HolderCharError`. Không có lần thả
    nào trước mốc: `check` lỗi `ref` (`sceneItemHoldProblems`), `itemAt` ném `ItemRestError`. `cast.released` của cảnh three
    ([03](03-scene.md#đồ-cầm-tay)) đọc cùng hàm, nên món `extra` giữ ở chỗ thả trùng món người nhặt cầm lên.
  - Món không hoà **tới** mốc nằm không khai chỗ (giữa mốc trước và nó, `itemAt` giữ mốc trước): trước mốc ấy món còn trong tay
    người thả hay đã rời tay.
  - `rest` chỉ có nghĩa với lần cầm theo mốc (mục [5](#lần-cầm-theo-mốc)); lần cầm hai tay vẫn nhận giá mặt đỡ ở mốc nằm trong
    `chooseMissing`.

### Chỗ cầm (`cast[].world.hands[].hold`)

```ts
const SceneHoldSchema = z.union([
  z.string().regex(/^[^@#/]+@[a-zA-Z]+(\/[a-z0-9-]+)?$/),   // viết tắt "món@nhóm" (mọi lựa chọn rig giải hay lấy mặc định), "món@nhóm/kiểu" (= variant)
  z.strictObject({
    item: z.string(),
    group: z.enum(GROUP_IDS),
    // chỗ cầm — chỉ các trường của nhóm ấy; thiếu trường nào thì mục 5
    part: z.string().optional(),
    edge: z.union([z.enum(["top", "bottom", "left", "right", "front", "back"]), z.number()]).optional(),
    along: z.union([z.enum(["corner", "low", "mid", "high"]), z.number().min(0).max(1)]).optional(),
    thumb: z.enum(["front", "back", "top", "bottom", "left", "right", "up", "down"]).optional(),
    slant: z.union([z.enum(["in", "low", "high"]), z.number().min(-90).max(90)]).optional(),   // hướng ngón trên mặt tấm
    around: z.number().optional(),                  // độ, quanh trục trụ
    tilt: z.number().optional(),                    // palmBox
    psi: z.number().optional(), inset: z.number().optional(),   // platform
    variant: z.string().optional(),                 // biến thể gốc hay tên kiểu cầm của món (mục 2)
    // chỉ đường tay dẫn — ý định của món (01 § Món cầm tay)
    face: z.union([AxisIntentSchema, IntentTargetSchema]).optional(),
    up: z.union([z.string(), v3]).optional(),
    roll: AxisIntentSchema.optional(),
    keep: z.literal(true).optional(),               // không ý định: cổ tay theo hành động
    both: z.union([z.literal(true), SupportOverride]).optional(),   // tay kia cầm chỗ mặc định của nhóm (mục 3), object đè từng phần
    touch: z.array(TouchSchema).optional(),         // cộng vào `touch` của món
    regrip: z.literal(true).optional(),             // mở lần cầm mới ở mốc này dù không đổi gì
    on: z.enum(CARRY_ON).optional(),                // chỉ `carry`
    yaw: z.number().optional(),                     // chỉ `carry`
  }),
]);
// SupportOverride: { group?, part?, edge?, along?, thumb?, slant?, variant?, psi?, inset? }
```

- **Món đặt trước**: mốc tay của lần cầm có mốc món không khai đích (`to`, `at`, `offset`, `point`), không khai ý định (`face`,
  `up`, `roll`, `keep`) — chỗ bàn tay suy từ món; lần cầm tay dẫn của cùng món thì khai như tay dẫn. Được khai `elbow` để đè hướng khuỷu tự nhiên. Mốc ấy (chỉ
  `hold`, không `at`/`to`/`palm`/`fingers`) không phải mốc đích của tay tự do: đích tay tự do ở mốc ấy lấy của mốc có đích gần
  nhất trước nó (`lend` trong `handAt` của `scene.ts`), nên trước mốc cầm và trong quãng hoà `enter` bàn tay đi từ đích đã khai
  tới món, không rơi về tư thế của hành động (nhặt món trên quầy: tay lên qua mép quầy bằng mốc đích trước mốc cầm). Mỗi tay khai chỗ cầm của nó; `both` là viết
  tắt cho tay kia. `both` mà tay kia cũng có `hold` ở cùng `t` là lỗi `choice`. Tay có `both` giải trước (lead), tay phụ giải
  sau với số hạng lấn của tay lead.
- **Tay trượt**: các trường số (`along`, `slant`, `around`, `tilt`, `psi`, `inset`) hoà theo `ease` của mốc tay sau giữa hai mốc
  `hold` của cùng lần cầm (`auto` bậc ba trên chuỗi mốc `hold` của lần cầm) — tay trượt dọc cạnh, dọc cán, xoay quanh trụ. **Một lần cầm** là chuỗi mốc cùng món, cùng nhóm, cùng các trường rời (`part`,
  `edge`, `thumb`, `variant`), không `regrip`; đổi trường rời là lần cầm mới, liên kết tay ↔ món hoà trong `HOLD_BLEND`.
- **Vị trí dọc cạnh**: tên (`corner` ≈ nửa bàn tay từ đầu thấp, `low` 0,25, `mid` 0,5, `high` 0,75) hay tỉ lệ 0–1 từ đầu thấp. Đầu thấp
  của cạnh xét một lần ở mốc bắt đầu lần cầm: cạnh dốc ≥ 30° so với mặt ngang thì là đầu dưới; cạnh gần ngang chạy ngang
  thân hơn chạy trước–sau thì là đầu về phía tay ấy (ngang hệ thân), nên cùng tên ở hai tay của một cạnh ngang cho vị trí đối
  xứng; cạnh gần ngang chạy trước–sau (tấm nằm cầm cạnh `left`/`right`) thì là đầu gần người cầm (`−tiến`), như nhau ở hai tay
  và hai `thumb`. Giữ nguyên tới hết lần cầm dù món quay.
- **Tay dẫn không khai chỗ cầm** lấy mặc định của nhóm (mục 3); `thumb` của tấm và thẻ là mặt quay về tâm đầu người cầm ở mốc bắt
  đầu lần cầm, `edge` không khai thì tấm đứng `bottom`, tấm nằm cạnh phía tay ấy (`right`, `left`).
- **Đổi tay**, **đưa người khác**: mốc món đổi `cast` khi tay người nhận đã cầm; tay người đưa `hold: null` sau đó. Tay dẫn giữ luật
  hiện có (`holdRoles` của `act3.ts`).
- **Buông**: `hold: null`. `right: null` vẫn chỉ thả đích. `point: "item:<mốc>"` của tay dẫn giữ nguyên.
- **Hai dạng `hold`** (`SceneHoldSchema`): chuỗi `"món@nhóm"` hay `"món@nhóm/kiểu"` (`kiểu` là `variant`: biến thể gốc
  hay [kiểu cầm có tên](#kiểu-cầm-có-tên) của món) và `{ item, group, … }`. Dạng khác (chuỗi có `#`, object có `grip`) là
  lỗi zod kèm lệnh `stickman migrate-held` (mục [8](#8-chuyển-đổi)); `migrateScene` không tự chuyển.

### Ví dụ

```jsonc
// đọc, bảng giá ngang ngực, mặt về mặt người đọc (`holderFace` kẹp ngẩng 45°); tay phải cạnh hông phải, một phần ba dưới
"items": [{ "t": 1.0, "cast": "nguoi-a", "item": "bang-gia", "to": "chest", "offset": [30, 5, 0],
            "face": { "axis": "front", "toward": "holderFace" } }],
"hands": [{ "t": 1.0, "cast": "nguoi-a",
            "right": { "hold": { "item": "bang-gia", "group": "sheet", "edge": "right", "along": 0.33, "thumb": "front" } } }]

// đọc, bảng giá ngang mặt, song song với mặt; tay phải cạnh dưới
"items": [{ "t": 1.0, "cast": "nguoi-a", "item": "bang-gia", "to": "eye", "offset": [32, 0, 0],
            "face": { "axis": "front", "toward": "back" }, "roll": { "axis": "top", "toward": "up" } }],
"hands": [{ "t": 1.0, "cast": "nguoi-a", "right": { "hold": { "item": "bang-gia", "group": "sheet", "edge": "bottom" } } }]
//   (món lồng vào đầu thì `check` nhóm `clash` bắt; khe tối thiểu giữa món và đầu do cảnh lo qua `offset`)

// khoe hai tay, hai cạnh bên (cùng một mốc món: mặt bảng về khách)
"items": [{ "t": 2.0, "cast": "nguoi-a", "item": "bang-gia", "to": "chest", "offset": [35, 0, 0],
            "face": { "axis": "front", "toward": { "cast": "khach" } }, "roll": { "axis": "top", "toward": "up" } }],
"hands": [{ "t": 2.0, "cast": "nguoi-a",
            "right": { "hold": { "item": "bang-gia", "group": "sheet", "edge": "left" } },
            "left":  { "hold": { "item": "bang-gia", "group": "sheet", "edge": "right" } } }]
//   (mặt trước quay ra khách nên cạnh phải của bảng nằm bên tay trái người cầm)

// khoe, một tay đỡ cạnh dưới, một tay giữ cạnh trên — cùng mốc món, chỉ khác dòng tay
"hands": [{ "t": 2.0, "cast": "nguoi-a",
            "right": { "hold": { "item": "bang-gia", "group": "sheet", "edge": "bottom" } },
            "left":  { "hold": { "item": "bang-gia", "group": "sheet", "edge": "top", "along": 0.3 } } }]

// cuốc đất: mốc món theo nhát cuốc, tay phải ở đuôi cán, tay trái trượt từ giữa cán xuống gần lưỡi
"items": [{ "t": 0.0, "cast": "ong", "item": "cuoc", "point": "luoi", "to": "shoulder", "offset": [10, -40, 20],
            "up": "luoi" },
          { "t": 0.6, "cast": "ong", "item": "cuoc", "point": "luoi", "at": [120, 0, 300],
            "face": { "axis": "luoi", "toward": "down" } }],
"hands": [{ "t": 0.0, "cast": "ong",
            "right": { "hold": { "item": "cuoc", "group": "cylinder", "part": "can", "along": 0.95 } },
            "left":  { "hold": { "item": "cuoc", "group": "cylinder", "part": "can", "along": 0.55 } } },
          { "t": 0.6, "cast": "ong",
            "left":  { "hold": { "item": "cuoc", "group": "cylinder", "part": "can", "along": 0.25 } } }]

// rót: miệng chai nghiêng về cốc (`toward` ở hệ thân người cầm, `at` ở thế giới), tay phải nắm thân, tay trái đỡ đáy
"items": [{ "t": 4.0, "cast": "nguoi-b", "item": "chai-dia", "point": "mouth", "at": [-300, -150, 575],
            "face": { "axis": "mouth", "toward": [1, 0.6, 0.58] } }],
"hands": [{ "t": 4.0, "cast": "nguoi-b",
            "right": { "hold": { "item": "chai-dia", "group": "cylinder", "part": "than", "both": { "group": "platform" } } } }]

// tay dẫn: điện thoại xem (hướng mặc định của nhóm: màn về mặt người cầm), rồi áp tai
{ "t": 0, "left": { "to": "chest", "offset": [30, 20, 20], "point": "grip", "hold": "dien-thoai@palmBox" } }
{ "t": 3.2, "left": { "to": "ear", "point": "item:speaker",
                      "hold": { "item": "dien-thoai", "group": "palmBox",
                                "face": { "axis": "screen", "toward": { "mark": "head" } }, "touch": ["self.head"] } } }

// tay dẫn: cầm bút, ngòi xuống giấy (đường viết do các mốc `at` khai, như nay)
{ "t": 2.0, "right": { "at": [708, -136, 1265], "point": "item:tip", "hold": { "item": "but", "group": "pen" } } }

// túi khoác khuỷu
{ "t": 0, "left": { "to": "shoulder", "offset": [38, 18, 34], "point": "wrist", "elbow": [-0.5, 1, 1],
                    "hold": { "item": "tui-hieu", "group": "carry", "on": "elbow" } } }
```

## 5. Giải tay theo món

### Món trong thế giới

Hai chỗ của món, tách rõ:

- **Chỗ món ở mốc** — `itemPose(t)` (`itemAt`) từ hai mốc món kề `t` (mục 4): bộ giải đọc. Lần cầm theo mốc chỉ đọc ở chính các
  mốc; cầm hai tay đọc mỗi khung.
- **Chỗ món vẽ** — renderer (`world.ts`), `check` và `scene_probe` đọc trên cảnh three. Cầm hai tay: `itemAt`. Lần cầm theo mốc
  và tay dẫn: `bàn tay đã vẽ · GripFrame` (`actHeld` của lõi, nhánh liên kết của `world.ts`), nên món dính tay cả khi cổ tay
  vượt kẹp hay tay không với tới. Ở mốc trong tầm và trong kẹp, hai chỗ trùng nhau.

### Bàn tay từ món

`graspFrame` dựng chỗ tiếp xúc của nhóm (`contact` ở mục 3) trên khối hình theo chỗ cầm ở `t`, ra `GripFrame` (món trong khung
bàn tay). Bàn tay `= itemPose(t) · GripFrame⁻¹`: cổ tay có chỗ và hướng cố định. Cánh tay còn đúng một bậc tự do: góc xoay
khuỷu `φ` quanh trục vai → cổ tay. Với tay của món đặt trước, `act3` nhận `Wp`, `Rw`, `φ` đã giải làm cứng: không `aimWrist`,
không dò xoay khuỷu, không `HOLD_SLEW`.

**Một nguồn nghiệm.** `sceneAt` gắn vào `ReachHold` của món đặt trước hàm `solve(c, T)` (`PlacedSolve`) gọi `graspAtTime` với
nhân vật thật `c` và thân `T` mà `act3` đã dựng; `act3`, `attach`/`world` (gắn món three), `check` và `scene_probe` đều đọc
nghiệm từ đó, nên lựa chọn rig giải, khung cầm và `φ` chỉ có một chỗ tính (nhớ theo runtime và nhân vật). `ReachHold.grasp`
mang trường cảnh khai; lựa chọn rig giải chỉ ở `graspAtTime`.

### Khuỷu tự nhiên

```
E(φ) = ½ (turn/90)² + (bend/50)² + ½ (dev/20)²                     cổ tay ứng với cẳng tay ở φ (thang thoải mái, không phải kẹp)
     + 10 · Σ (vượt giới hạn / nửa tầm phía ấy)²                    phạt nặng phần vượt `AIM_BEND`, `AIM_DEV`, xoay cẳng tay
     + w_down · (1 − cos(φ − φ₀)) / 2                               khuỷu thõng: φ₀ từ `REACH_ELBOW` hay `elbow` của mốc tay
     + w_body · Σ (lấn / r_tay)²                                    bắp tay, cẳng tay lấn vào thân (`across`, `front` của
                                                                    `markShape`, arm3.ts), đầu, tay kia
     + w_cont · ((φ − φ_trước) / 30°)²                              liền với mẫu trước của lần cầm
     + w_in · max(0, inward − IN_FREE)²                             khuỷu gập ngược (vào trong, chĩa lên)
```

- **`φ`** quanh trục vai → cổ tay: `0` là khuỷu thõng (hình chiếu của hướng xuống lên mặt phẳng vuông góc trục), dương ra
  ngoài phía tay ấy; trục gần thẳng đứng thì gốc hoà sang hình chiếu của `−tiến`: chiếu `k · xuống + (1 − k) · (−tiến)` với
  `k` đi từ 0 tới 1 khi `|xuống⊥|` (sin góc trục với phương đứng) đi từ 0,1 tới 0,3 (`PHI_DOWN`). `elbow` của mốc tay đổi ra
  `φ₀` bằng cùng phép chiếu (`phiToward`).
- **Khuỷu khoá** (`elbowLock` của mốc `hold`, [03](03-scene.md#đích-bàn-tay-thế-giới)): mẫu có phần khoá `1` không tìm `φ`
  mà lấy `φ = φ(elbow)` — hướng `elbow` của lần cầm ở giây ấy (`runLock`: đều trên mặt cầu giữa hai mốc `hold` kề, mốc không
  khai lấy của mốc kia) chiếu như `φ₀`; `E(φ)` chỉ còn để báo. Phần khoá giữa `0` và `1` (từ mốc khoá sang mốc không khoá) thì
  mẫu giải như thường. Khung vẽ lấy `φ` của chuỗi (hay của lần cầm theo mốc) rồi kéo về `φ(elbow)` theo phần khoá, đường ngắn
  trên vòng (`lockPhi`): phần khoá `1` là đúng hướng khoá dù giây ấy không trùng mẫu hay mốc món. Lựa chọn chỗ cầm
  (`chooseMissing`) vẫn giải với khuỷu tự do.
- Hằng số: `w_down 0,3`, `w_body 10`, `w_cont 2` (khuỷu của tay trượt đổi ≤ 2,5° mỗi mẫu), `w_in 20`, `IN_FREE 0`.
- **`inward`** (`elbowInward`): khuỷu lệch khỏi đường vai → cổ tay, chiếu vuông góc đường ấy, chia `l₁`; lấy số lớn hơn
  của hai phần: phần lên trên `u`, và phần về giữa thân (ngược hướng ra ngoài phía tay ấy của hông) nhân sin góc trục với
  phương đứng rồi cộng `min(0, u)`. Tay buông thõng mà cẳng tay chạy ra ngoài (viết ở bàn bên cạnh) không tính; khuỷu nằm dưới
  đường ấy nhiều hơn lệch vào trong (áp ống nghe vào tai, xem điện thoại — khuỷu thấp trước ngực) cũng không. Dương là khuỷu gập ngược: nằm
  phía trong ngang đường ấy hay chĩa lên, cẳng tay chạy ra ngoài hay xuống tới bàn tay; khuỷu thõng hay ra ngoài là âm. Cẳng tay xoay sẵn theo
  bàn tay ở khuỷu ấy nên số hạng cổ tay rẻ; thiếu số hạng này `E(φ)` chọn nó. `chooseMissing` cộng `min_φ E` nên lựa chọn chỉ
  với tới được bằng khuỷu ngược cũng đắt lên và rig đổi `edge` / `thumb` / `slant`. Mọi lựa chọn đều cần khuỷu ngược thì rig
  vẫn chọn nghiệm rẻ nhất, `check` báo `elbow`.
- **`w_body`** lấy mẫu dọc tay từ `1,5 · cap` của vai trở đi (`cap` là bán kính nắp vai, `ArmRoom.cap`). Lấn bắp tay trừ mức
  nền của tay buông thõng ở cùng phần dọc bắp tay (đo một lần mỗi người, mỗi tư thế thân; áo có thể tới 4,4).
- Tìm `φ`: lưới 10° cả vòng, rồi chia đôi `±5°`, `±2,5°` (40 lần thử). Mỗi lần thử chỉ dựng hai đoạn tay và đọc góc cổ tay,
  không giải lại cả người: 0,008 ms một lần thử, 0,38 ms giải `φ` một mẫu.
- **Tất định**: lần cầm hai tay giải `φ` ở các mẫu cách `HOLD_SLEW_STEP` (`heldItem.ts`) tính từ đầu lần cầm, `φ_trước` là mẫu
  liền trước; `φ(t)` hoà giữa hai mẫu kề. Lần cầm theo mốc giải `φ` ở từng mốc (mục [Lần cầm theo mốc](#lần-cầm-theo-mốc)). Mẫu đầu của một lần cầm lấy `φ_trước` là mẫu cuối của lần cầm liền trước trên cùng
  tay (nếu có; lần cầm trước theo mốc thì `φ` của nó ở ranh giới); lần cầm đầu tiên thì bỏ số hạng. Nhớ theo runtime (`graspRuns`, một `WeakMap<SceneRuntime, …>` trong `scene.ts`); Remotion
  vẽ khung nhảy cóc thì tính lại chuỗi từ đầu lần cầm, ra cùng số.
- **Ngoài tầm với** (`|vai → cổ tay| > l₁ + l₂`): cánh tay duỗi thẳng về cổ tay đã giải, bàn tay vẽ ở đầu cẳng tay với hướng
  `Rw` đã giải và dáng ngón của lần cầm (ngón không `heldFit` lại). Cầm hai tay thì món vẫn ở chỗ khai — khe lộ trên hình; lần
  cầm theo mốc thì món theo bàn tay duỗi. `check` báo `reach` với khe. Rig không kéo món lại gần.
- **Cổ tay vượt giới hạn** ở `φ` tốt nhất: rig giữ kẹp hiện có (xoay cẳng tay ±90°, gập `AIM_BEND` `−60..70`, lệch `AIM_DEV` `−30..20`); bàn tay vẽ
  theo kẹp, khuỷu giữ `φ` đã giải; cầm hai tay thì món vẫn ở chỗ khai, lần cầm theo mốc thì món theo bàn tay đã kẹp. `check`
  báo `wrist` kèm độ vượt và độ lệch giữa bàn tay và chỗ cầm.
- Hai tay giải trên cùng `itemPose`: tay có `both` (lead) trước, tay kia sau; không có `both` thì tay phải trước. Tay giải sau
  tính tay đã đặt vào số hạng lấn: ở phía cảnh (`scene.ts`, `placedOther`) tay trái tính tay phải đã đặt trên món.
- Tay dẫn giữ đường giải hiện có (`aimWrist`, `HOLD_SLEW`, dò khuỷu của `act3.ts`, không có số hạng `inward`; khuỷu ngược ở tay
  dẫn do đích tay hay `elbow` cảnh khai, `check` báo `elbow`; mốc khoá khuỷu thì phần khoá bỏ dò khuỷu và không theo
  `HOLD_SWIVEL_SLEW`: góc dò nhân `1 − phần khoá`) và cũng có `grasp` (`mode: "hand"`, mục
  [Báo](#báo)): lựa chọn là trường cảnh khai cộng mặc định nhóm, cánh tay đọc trên bàn tay đã vẽ.

### Lần cầm theo mốc

Lần cầm một tay có mốc món (mục 4) không giải từng khung trên `itemAt`:

1. **Lựa chọn một lần** (`graspStart`): `chooseMissing` giải ở mốc món đầu của lần cầm, cộng các mốc món sau trong cả lần cầm
   (mục [Lựa chọn cảnh không khai](#lựa-chọn-cảnh-không-khai)); nối ngay sau lần cầm cùng món, cùng nhóm, cùng tay thì ưu tiên
   giữ lựa chọn của lần cầm ấy (`keep`).
2. **Ở mỗi mốc `t_k`**: khung cầm, `Wp`, `Rw` từ món ở mốc (thân người cầm ở `t_k`); `φ` bằng `solvePhi` với `φ_trước` là mốc
   trước (mốc đầu: `φ` cuối của lần cầm theo món liền trước trên cùng tay) và `elbow` của mốc tay nếu có — phần khoá `1`
   (`elbowLock`) thì `φ = φ(elbow)`, không tìm. Nghiệm lưu **trong
   hệ thân**: cổ tay so với vai bên ấy và khung bàn tay, cả hai qua `Rr` của thân; `φ`; góc cổ tay đã kẹp và phần vượt kẹp.
3. **Giữa hai mốc**: hệ số `f` theo `ease` của mốc sau (như `itemAt`); cổ tay dời thẳng và bàn tay quay đường ngắn nhất
   (`mixRotation`) trong hệ thân, đổi ra thế giới bằng thân ở chính `t` — người cúi, đi giữa hai mốc thì tay theo thân; `φ` đi
   đường ngắn nhất trên vòng; góc cổ tay đã kẹp hoà thẳng (như `solveActing` hoà hai nghiệm). `auto` thì bậc ba đơn điệu qua
   bốn mốc kề như `itemAt`: cổ tay và góc cổ tay từng thành phần, `φ` đã mở vòng, bàn tay theo góc trắc địa cộng dồn. Trước mốc đầu và sau mốc cuối giữ
   mốc gần nhất trong hệ thân. Khung cầm đọc ở `t` (trường số của tay trượt hoà như mục 4); dáng ngón theo khung cầm.
4. **Món** vẽ ở `bàn tay đã vẽ · GripFrame`: dính tay suốt lần cầm, ở mốc trùng chỗ khai (trừ khi ngoài tầm hay vượt kẹp).
5. **Món nằm chờ tay**: trước mốc món đầu khi mốc ấy là mốc nằm (`rest`), và sau mốc món cuối khi mốc ấy là mốc nằm, món đứng ở
   mốc ấy (`itemAt` ở giây mốc), không theo bàn tay — bàn tay đang tới món (hoà từ tay tự do, `enter`) hay vừa đặt xuống
   (`HoldGrasp.rest`, `GraspSolution.still`; `actHeld` và `world.ts` cùng đọc). Nhặt món người khác vừa thả: mốc tay mở lần
   cầm sớm hơn mốc nằm ít nhất `HOLD_BLEND` để bàn tay tới món đúng lúc mốc; món nằm ở chỗ thả suốt quãng ấy nên không nhảy
   lúc gắn. Đặt xuống: mốc nằm khai chỗ trước mốc thả; từ mốc nằm tới lúc thả món đứng ở chỗ khai, nên chỗ thả là chỗ khai.

`graspAtTime` trả nghiệm đã hoà, `act3` đọc như nghiệm của món đặt trước. Mỗi khung chỉ một `evalPhi`, không chuỗi mẫu: 0,3–0,5
ms/khung cho `sceneAt` + `actAim`; khung nhảy cóc ở giây 2,9 dựng từ đầu mất chừng 10 ms. Nhớ theo runtime và nhân vật như
`graspRuns`; cùng `t` ra cùng số dù gọi theo thứ tự nào.

### Lựa chọn cảnh không khai

Cảnh thường khai đủ chỗ cầm. Thiếu trường nào:

- **Món đặt trước**: rig giải **một lần cho mỗi lần cầm**, ở mốc bắt đầu (lần cầm theo mốc: mốc món đầu), trên món đã đứng
  yên ở chỗ khai, với nhân vật thật của người cầm. Lựa chọn rig giải chỉ đọc ở `graspAtTime`; `ReachHold.grasp.choice` của `sceneAt` chỉ mang trường
  cảnh khai. Hai bậc: giải rời trước (`edge`, `thumb`, `variant`, `part`) với trường liên tục ở mặc định; rồi lưới liên
  tục quanh ứng viên rời tốt nhất, và quanh ứng viên rời tốt nhất của `variant.default` khi rig giải `variant` (`along` 3
  điểm ở ¼, ½, ¾ miền của nhóm (đũa: 0,2375, 0,325, 0,4125; bút: 0,225, 0,3, 0,375; chén: 0,125, 0,25, 0,375; `pinch` 0,425, 0,45, 0,475; trụ: trên chính khối hình, mục 3 nhóm 5), `slant` 3 (hay `RangeChoice.grid` / `gridByVariant` của nhóm, giá trị trùng gộp một), `around` 12 (biến thể có `thumbToward`: 9 điểm ±60° quanh hướng ngón cái về thân, nhóm 7), `tilt` 6 đều gồm hai đầu, `psi` 5 điểm đều gồm hai đầu). `slant` lấy ba điểm `−½`, `0`, `+½` miền của biến thể
  (`pinch` ±30°, `flat` ±45°, `rim` ±22,5°). Giá của một ứng viên là `min_φ E(φ)` cộng `(khe tầm với / AIM_GAP)²`, cộng ở
  mốc bắt đầu và các mốc món sau còn cùng người cầm, cùng cỡ, mốc sau trọng số 0,5 (`LATER_W`): lần cầm theo mốc xét mọi mốc
  của lần cầm, tối đa 8 mốc sau mốc đầu (`KEYED_MAX`); lần cầm hai tay xét các mốc trong 1,5 s sau (`LATER_SPAN`, tối đa 4); lệch khỏi mặc
  định nhóm cộng `0,05 · (số trường lệch mặc định) / (số trường thiếu có mặc định)`, `variant` khác `variant.default` của
  nhóm cộng thêm `VARIANT_COST` = 0,5. Biến thể có `upright` (`card` `lateral`) cộng `UPRIGHT_W · s²` (`UPRIGHT_W` = 4, `s = (1 − u) / 2`, `u` là sin góc ngẩng của hướng từ tâm nắm tới tâm khối hình): thân món ở trên bàn tay rẻ nhất, ngang tay cộng ¼, treo dưới tay cộng đủ. Tấm đứng `sheet` không `both`, thiếu `edge` hay `along`, cộng `SIDE_W · ((1 − x) / 2)²` (`SIDE_W` = 2, `x` ∈ [−1, 1] là tâm nắm theo ngang thân người cầm về phía tay ấy, lần nửa bề ngang tấm): góc cùng bên tay rẻ nhất, giữa cạnh cộng ¼, góc bên kia cộng đủ — một tay không với sang góc bên kia, hai tay cùng tấm không bắt chéo. `palmBox`, `cylinder` (`SINK_GROUPS`) và biến thể có `sink` (`card` `edges`) cộng thêm giá lún `(lún / HELD_SINK)²`: lún da (như luật
  `sink`) của bàn tay đúng khung cầm, ngón ôm theo vai trò (`heldFit`), nhớ theo khung; ứng viên đã đắt hơn ứng viên tốt nhất thì
  không đo. Ở `cylinder` giá ấy bắt ngón cái áp thân đâm vào khối `grip: false` nhô ra. Mốc món nằm cộng giá mặt đỡ
  ([bên dưới](#mặt-đỡ)). Lấy ứng viên
  rẻ nhất; hoà thì theo thứ tự ứng viên: `part`, khối hình theo `FeatureKind`, `edge`, `thumb`, `variant`, `along`,
  `slant`, rồi `around`, `tilt`, `psi` (rời theo thứ tự miền khai, liên tục tăng dần). Giải 3–42 ứng viên mất 3–17 ms; `cylinder`
  (29–146 ứng viên, có đo lún) mất 40–200 ms mỗi tay.
- **Trường có giá lệch** (`cost` của lựa chọn; `cylinder` `thumb`, `slant`): ứng viên lấy giá trị khác mặc định (`default`, hay
  `from` của trường) cộng giá ấy. Lưới liên tục chạy cả quanh ứng viên rời tốt nhất giữ mọi trường ấy ở mặc định khi nó khác ứng
  viên rời tốt nhất: ở bậc rời trường liên tục còn ở mặc định, nên một giá trị mặc định có thể đắt chỉ vì `around` mặc định
  (ống nghe đứng trước ngực, ngón cái về loa chỉ rẻ ở mặt hông).
- **`variant` của trụ** (`cylinder`, không có `choices.variant`) không giải thành một ô riêng: `chooseMissing` để `graspFrame` suy
  biến thể của từng ứng viên theo khối hình và `around` của nó (`variantOf`, mục 3 nhóm 5), nên lưới `around` của ống nghe đi qua cả
  `flat` (mặt rộng) lẫn `wrap` (mặt hông). Cảnh khai `variant` thì giữ nguyên, kể cả `wrap` trên mặt trước.
- **Loại `around` của trụ** (`BULGE` = 0,1): nhóm có `clear` bỏ khỏi lưới (bậc rời lẫn lưới liên tục) mọi `around` mà phần `grip: false`
  kề đoạn bám nhô khỏi mặt khối quá `0,1 · W` về phía lòng tay (`bulgeToward`, đo bằng điểm xa nhất của từng khối; thanh hộp:
  mặt lòng tay áp là mặt gần `ρ` nhất). Ống nghe loại mặt trước (0°, 30°, 330°: loa, mic nhô); 60°, 90°, 180°, 270° giữ. Mọi `around`
  của lưới đều nhô thì không loại. Cảnh khai `around` thì giữ nguyên.
- **`variant`** rig giải chỉ trên biến thể gốc của nhóm, không bao giờ ra [kiểu cầm có tên](#kiểu-cầm-có-tên) của món; cảnh
  gọi tên thì tên ấy giữ nguyên, các trường khác giải trên bàn tay soạn của nó.
- **`variant`** của tấm giải trên cả `pinch`, `flat`, `rim`: `flat` và `rim` mất `VARIANT_COST`, nên chỉ thắng khi `pinch`
  đắt hơn chúng quá 0,5 — ở cạnh dưới `pinch` gãy cổ tay (bend 51°, dev 39°), `rim` đỡ được.
- **`edges` của thẻ**: ở bậc rời rig bỏ cặp (`edge`, `edges`) mà bề rộng tấm qua hai mép ngoài `across` của biến thể, trừ khi
  cảnh khai cả `variant` lẫn `edge` (khi ấy lỗi `choice`). Giá ứng viên là tổng các số hạng trên, cộng trong `run` của
  `chooseMissing`.
- **Vành đĩa**: `edge` của `disc` giải trên lưới góc `0..330` bước 30 (`DISC_STEP`). Góc khai bằng số chỉ hợp khối `disc`
  (`edgeOk`), nên phần ra cả `slab` (hộp bao) lẫn `disc` thì khai góc chọn `disc`. `rim` không khai `thumb` chỉ thử mặt
  trên (mục 3, nhóm 1).
- **Tay dẫn**: lấy mặc định của nhóm (mục 3), không giải; `thumb` của tấm và thẻ (`sheet`, `card`) theo mặt quay về người cầm ở mốc bắt đầu
  lần cầm, `edge` `bottom` (tấm đứng) hay cạnh phía tay ấy (tấm nằm), tấm đứng một tay `along` về góc phía tay (mục 3, nhóm 1, 2).
- **Tay dẫn nối ngay sau lần cầm theo mốc** cùng món, cùng nhóm, cùng tay (`regrip`, đổi trường số): trường không khai lấy lựa
  chọn rig đã giải của lần cầm theo mốc ngay trước ranh giới (`graspAtTime`, kể cả `featureIndex` và đầu cao `high`), không lấy
  mặc định nhóm, nên món không xoay trong tay khi sang tay dẫn. Trường cảnh khai thắng; khai `part`, `edge` hay `thumb` khác thì
  khối hình và đầu cao tìm lại theo trường khai. Lựa chọn ấy giải trên nhân vật thật: `ReachHold.grasp.inherit` mang hàm giải,
  `act3` và `world.ts` điền vào `grasp.choice` (`inheritHold`), nhớ theo runtime và nhân vật. Đổi nhóm thì lấy mặc định nhóm.
- **Lần cầm theo mốc nối ngay sau lần cầm** cùng món, cùng nhóm, cùng tay (tay dẫn hay theo mốc, `regrip`): bộ giải vẫn chạy
  đủ hai bậc nhưng **ưu tiên giữ lựa chọn đang có** ngay trước ranh giới (`GraspOpts.keep`, `priorChoice` của `scene.ts`) — lần
  cầm trước theo món thì lựa chọn đã giải (`graspAtTime`) và đầu cao `high`; tay dẫn thì lựa chọn kế thừa (`inherit`), không có
  thì trường khai cộng mặc định nhóm. Ứng viên khác nó ở trường rời (`part`, khối hình, `edge`, `thumb`, `variant`) cộng
  `KEEP_COST` = 2; trùng trường rời mà lấy đầu cao của chính nó khác đầu cao đang giữ cũng tính là khác (món quay nửa vòng
  trong tay); trùng trường rời chỉ khác trường liên tục cộng `KEEP_SLIDE` = 1. Ứng viên trùng trường rời thử luôn trường liên
  tục đang giữ (cả ở bậc rời lẫn trong lưới liên tục), và lưới liên tục chạy cả quanh ứng viên giữ tốt nhất. `KEEP_COST` = 2 là
  cỡ giá cổ tay vượt kẹp chừng 45% giới hạn (`10 · 0,45²`) hay khe tầm với 1,4 `AIM_GAP`: rig chỉ đổi khi lựa chọn cũ không với
  tới hay gãy cổ tay rõ ở các mốc của lần cầm mới, khi ấy món vẫn xoay trong tay suốt `HOLD_BLEND` (điện thoại ngang mắt cầm
  `thumb` cũ lệch cổ tay 91°: đổi mặt ngón cái, món quay 140°; cảnh muốn khác thì hạ mốc món hay khai `thumb`). Không ép giữ:
  ép thì bàn tay vượt kẹp và món theo bàn tay đã kẹp, lệch chỗ khai ở mốc. Trường cảnh khai thắng (không xét ở `keep`).
  Lần cầm từ giây 0, tay phụ của `both`, khác món hay khác nhóm thì giải như thường.

### Mặt đỡ

Món nằm trên một mặt (mốc `rest`, mục [4](#mốc-món-items)) thì cảnh không khai mặt đỡ: rig suy nó từ món — mặt ngang qua
**điểm thấp nhất của khối hình món** ở mốc ấy (`ItemPose.rest`; hàm tựa `shapeSupport` của `heldFit.ts` theo hướng xuống thế
giới trong khung món, gồm cả khối `detail`). Da bàn tay dưới mặt ấy là lún vào quầy, bàn.

```
under = max(0, max_p (p · d − h(d))) · s        d: hướng xuống thế giới trong khung món (hàng giữa của R rig)
                                                 h: hàm tựa của hình món; p: đỉnh da đã ôm theo vai trò, khung món
cost += REST_W · (under / REST_REF)²            REST_W = 1, REST_REF = 0,65 (= HELD_SINK, ngưỡng luật `rest`)
```

- Da là bàn tay ở đúng khung cầm, ngón ôm theo vai trò như giá lún (`heldFit`, tầm cuộn của biến thể), nhớ theo món và khung
  (`restUnder` của `graspSolve.ts`, dùng chung da với giá lún). Cộng ở mốc bắt đầu (trọng số 1) và ở các mốc sau là mốc nằm
  (`LATER_W`); ứng viên đã đắt hơn ứng viên tốt nhất thì không đo.
- Thẻ phòng nằm ngửa: `lateral` có nắm tay dưới mặt thẻ chừng 9,7–12,7 → giá 220–380; `edges` từ phía trên dưới mặt ≤ 0,2 → giá
  ≤ 0,1. Thẻ sát người (cách hông 35) không mặt đỡ chọn `lateral`, có mặt đỡ chọn `edges`.
- `E(φ)` không có số hạng cẳng tay dưới mặt đỡ: bàn tay ở trên mặt, cổ tay nối bàn tay nên chỉ phần cẳng tay gần khuỷu có thể
  xuống dưới mặt khi mặt đỡ cao hơn khuỷu; `check` không đo cẳng tay.
- **Món sát mép mặt đỡ**: mặt đỡ là mặt phẳng vô tận, nên ngón vòng qua mép quầy để nhặt món nằm sát mép (hợp lý ngoài đời) vẫn
  bị phạt và `check` báo `rest`. Chấp nhận: dời món vào trong hay khai `variant` / `thumb`.
- Lần cầm hai tay cũng nhận giá ở mốc nằm (mỗi tay giải `chooseMissing` trên `itemAt` có `rest`).

### Tay phụ (`both`)

Cảnh khai `both` ở tay lead; tay kia là tay phụ. Nhóm của tay phụ là `support.group` của nhóm lead (hay `both.group`); nhóm chưa
có chỗ tiếp xúc, hay khác nhóm mà không có `support.place`, thì không có tay phụ. Chỗ cầm tay phụ (`supportChoice`) là mặc định của
`support`, rồi object `both` của cảnh đè từng trường:

- **Cùng nhóm** (`platform`, `sheet` `rim`): giữ `part` và khối hình của lead, `keep` của `support`, `edge` đối (`opposite`) hay cùng
  (`same`) cạnh lead. Trường còn lại do bộ giải hay mặc định nhóm.
- **Khác nhóm** (`support.place`; `cylinder`, `bowl`, `palmBox` → `platform`): `placeChoice` đặt lòng tay lên mặt hộp có pháp tuyến ngoài
  `−top` (`bottom`: đáy chai) hay `−front` (`back`: mặt sau máy), xa nhất theo hướng ấy, ở phần cầm được (không `grip: false`).
  Ngón theo `top` chiếu lên mặt (mặt vuông `top` thì theo `front`), tay tới từ cạnh sau ngón (`psi` 0), tâm nắm giữa mặt, `along` 0,5.
  Tay lead úp lòng lên mặt ấy (`lead.palm · n < −0,5`, cách mặt không quá `W`) thì tâm nắm dời theo ngón tới khi gót lòng qua bàn tay lead (né tay lead); lòng tay lead ôm thành bên (chén, chai) không làm tay phụ lệch đáy. Món
  không có mặt như thế thì tay phụ lấy mặc định của nhóm.
- **Món đặt trước**: tay `both` giải trước (không có `both` thì tay phải); tay phụ giải sau ở cùng mốc bắt đầu: `supportChoice`
  trên khung tay lead, khối hình cố định bằng `featureIndex`, trường còn thiếu `chooseMissing` giải như tay lead (cùng giá, số hạng
  lấn gồm tay lead đã đặt) và khuỷu `E(φ)` riêng. Tay phụ khác nhóm để `psi` cho bộ giải, trừ khi `both.psi` khai. Tay lead chọn
  chỗ cầm không xét tay phụ: chỗ lệch một bên thì tay phụ có thể vượt kẹp cổ tay.
- **Tay dẫn**: tay phụ đặt theo khung tay lead đã vẽ, `psi` 0 với tay phụ khác nhóm.

### Đổi lần cầm

Hai đường, theo lần cầm:

- **Món đặt trước.** Ở ranh giới hai lần cầm, bàn tay hoà từ nghiệm cũ sang nghiệm mới trong `HOLD_BLEND` (`0,3 s`). Nghiệm cũ
  là nghiệm **đóng băng ngay trước ranh giới** của lần cầm trước, mang ở `ReachHold.was` (`{ k, solve }`, `k` phần còn lại của
  nghiệm cũ, giảm theo `smoothstep`): chạy tiếp chuỗi `φ` cũ qua ranh giới thì nhảy nhánh. Lần cầm món mới trên tay không có
  `was` hoà từ tay tự do (bàn tay của hành động, không cầm; `ReachHold.enter`). Lần cầm tay dẫn sang lần cầm theo món của
  cùng món (`regrip`): `was` là bàn tay tay dẫn đã vẽ ngay trước ranh giới (`actHandAt` trên tư thế của `sceneAt` lúc ấy); nhả tay ra `hold: null` thì `sceneAt` mang một `ReachHold` chỉ có
  `was` và `released: true` (không vai trò, không món, không dáng ngón) cho tới hết quãng hoà. Từng thành phần hoà thẳng từ cũ
  sang mới (`solveActing` của `act3.ts`):
  cổ tay `Wp` dời thẳng; bàn tay `Rw` đi đường ngắn nhất (`mixRotation`); khuỷu `φ` đi đường ngắn nhất trên vòng;
  góc cổ tay (xoay, gập, lệch, đã kẹp) và dáng ngón hoà tuyến tính. Lần cầm từ giây 0 không hoà.
- **Tay dẫn.** Liên kết tay ↔ món hoà từ cũ sang mới (`ReachHold.from`, `mixGrip`: quay đường ngắn nhất, dời
  thẳng); ý định hoà theo. Lần cầm cũ theo món của cùng món thì bàn tay còn hoà từ nghiệm cũ (`was`), và liên kết cũ là khung
  cầm của nghiệm ấy (`from.grasp.frame`, `act3` và `world.ts` điền từ `was`). Lần cầm cũ theo mốc cùng nhóm thì liên kết mới
  dựng trên lựa chọn kế thừa của nó ([Lựa chọn cảnh không khai](#lựa-chọn-cảnh-không-khai)): hai liên kết trùng, món đứng yên
  trong tay suốt quãng hoà.
- **Món theo bàn tay ở cả hai phía** của ranh giới theo mốc ↔ tay dẫn: lần cầm theo mốc mới cũng hoà liên kết từ tay dẫn
  (`leadGrip`), nên món trong khung bàn tay đi liền qua ranh giới.

Hai phép quay lệch đúng nửa vòng (đổi `thumb` của tấm là quay π quanh `m`): `mixRotation` quay quanh trục là cột lớn nhất của
`D + I`, không chọn chiều vòng qua mép ngoài cạnh.

### Báo

`AimReport.hold` mang `grasp` (`GraspReport`):

```ts
grasp: {
  item: string; group: GroupId; mode: "item" | "hand"; keyed?: true; t0: number;
  choice: GraspChoice;                               // part, feature, featureIndex, edge, along, thumb, variant, slant, around, tilt, psi, inset
  by: Partial<Record<keyof GraspChoice, "scene" | "rig" | "default">>;
  arm: { phi: number; wrist: { turn: number; bend: number; dev: number; over: number; off: number }; body: number; inward?: number; gap: number };
}
```

`keyed`: lần cầm một tay theo mốc (món theo bàn tay). `wrist.over` là độ vượt kẹp, `wrist.off` là độ lệch giữa bàn tay vẽ và chỗ cầm (đơn vị rig; tay dẫn luôn `0`, bàn tay là
chính chỗ đã vẽ). `by` của tay dẫn chỉ có `scene` (cảnh khai) và `default` (mặc định nhóm), không có `rig`. `arm` của món
đặt trước thêm `bodyRatio`, `bodyPart` (lấn chia bán kính tay ở chỗ lấn); cả hai đường thêm `inward` (khuỷu lệch vào giữa
thân, mục 5). `check` (dòng `reach`, `wrist`, `arm`, `elbow`),
`scene_probe` (`world.held.<tay>.grasp`) và MCP đọc nó.

### Báo tay cho studio

Hai hàm đọc của `scene.ts` (cửa `@stickman3d/rig/core`), không đổi hình:

- **`holdRuns(rt, id)`** → `{ right, left }`: mỗi tay giải phẫu một danh sách lần cầm theo thời gian,
  `{ since, until, item, group, variant?, mode, handKeys, itemKeys, lead? }`. Nhớ theo runtime.
  - Lần cầm như mục 4 (cùng món, cùng nhóm, cùng trường rời, không `regrip`). `since`, `until` là giây đã giải (mốc tên quy
    ra số); `until` là mốc mở lần cầm khác hay buông (không gồm nó), tới hết cảnh là `rt.duration`.
  - `mode`: `hand` (tay dẫn, món theo bàn tay), `keyed` (một tay theo mốc món), `both` (hai tay trên mốc món).
  - `handKeys`: chỉ số vào `cast[].world.hands` của JSON — mốc trong `[since, until)` khai tay ấy, cả mốc chỉ có đích hay
    `null`. `itemKeys`: chỉ số vào `scene.items` của JSON. `resolveScene` giữ thứ tự hai mảng, nên chỉ số vá thẳng JSON gốc.
  - Tay phụ của `both` là một lần cầm riêng có `lead` (tay dẫn): `mode` theo lần cầm tay dẫn, `handKeys` là mốc tay dẫn khai
    `hold`, `variant` lấy ở object `both`.
- **`handReport(rt, id, side, t, o?)`**: tay `side` (`right` / `left` giải phẫu) như người 3D vẽ ở `t`, cùng lần giải với
  `act` và `actJoints` (`actArm` của `act3.ts`). Toạ độ thế giới rig. `o.char` là nhân vật như vẽ (`Figure.body`), thiếu
  thì `rt.chars[id]`; `o.eye` là mắt ống kính cho ý định `camera`.
  - `mode` (`free` khi không cầm), `run` (phần tử của `holdRuns`), `blending` (trong `HOLD_BLEND`, như `holdBlending`).
  - `phi`: `φ` của khuỷu đang vẽ (`phiOf`). `phi0`: `φ` của hướng khuỷu khởi đầu — món đặt trước là `φ₀` của `E(φ)`; tay
    dẫn và tay tự do là hướng bộ giải xuất phát (`elbow` của mốc, không khai là `REACH_ELBOW`); tay không đích là `null`.
    `elbowLock`: khuỷu nằm đúng hướng `elbow` của mốc khoá — phần khoá (`elbowLockAt`) là `1`: ở mốc khoá, giữa hai mốc
    khoá, trước mốc đầu, sau mốc cuối khi mốc ấy khoá.
  - `wrist.drawn`: xoay, gập, lệch như vẽ (sau kẹp). `wrist.raw` (trước kẹp): món đặt trước là góc bàn tay của nghiệm trên
    cẳng tay (theo mốc: bàn tay đã hoà giữa hai mốc); tay dẫn, tay tự do là nghiệm ý định trước `HOLD_SLEW` — ý định giải
    trong miền khớp nên không vượt; không ý định là `null`. `wrist.over`: phần vượt miền, món đặt trước lấy của bộ giải, còn
    lại đo trên góc vẽ. `wrist.clamped`: khớp ở giới hạn. `wrist.err`: tay dẫn có ý định, góc lệch còn lại của trục món.
  - `joints` (vai, khuỷu, cổ tay), `axis` (vai → cổ tay), `ring`: khuỷu ở `φ` là `center + radius · (cos φ · d0 + sin φ · o0)`.
  - `cost`: `E(φ)` ở `φ` = −180, −170 … 170 (`evalPhi`, không số hạng liền mẫu trước). Món đặt trước: đúng đầu vào bộ giải
    dùng ở giây ấy (đầu vào nhớ theo nghiệm của `graspAtTime`); tay dẫn: cổ tay, bàn tay, tay kia như vẽ và hướng khuỷu khởi
    đầu. Tay tự do: `null`.
  - `grip`: tâm nắm, điểm `grip` của bàn tay đang vẽ (chỗ đích `point: "grip"` đặt vào). `grasp`: `GraspReport` của tay ấy.
  - Ngoài `HOLD_BLEND`, góc cổ tay và phần vượt trùng `AimReport.hold.grasp` (`heldHands` đọc nó): tay dẫn và theo mốc ở
    `drawn`, hai tay ở `raw`. Trong quãng hoà `drawn` là góc đang vẽ, `grasp` là nghiệm đích.
  - Mỗi lần gọi là `sceneAt`, một lần giải như `act` và 36 `evalPhi`, không dựng lại runtime. Tay dẫn mang món đi từ mẫu
    trước (`ReachHold.prior`, nhớ theo khung): gọi theo `t` tăng thì mỗi khung chỉ giải một mẫu. Lún, khe, món vẽ đọc ở
    three (`heldHands`).

## 6. Ngón

1. **Dáng gốc**: `hoà(open, closed, w)` của biến thể đã chọn, `w` theo số đo của khối hình trong `range` của nhóm (`mixHand`,
   `hand.ts:143`). Tâm nắm đọc từ dáng đã hoà (`handGripOf`, `hand.ts:271`), không từ một tên dáng.
2. **Ngón ôm** (`heldFit` của `heldFit.ts`) nhận `roles` của nhóm:

| Vai trò | `heldFit` |
|---|---|
| `press` (đè một mặt) | Cuộn tới chạm, tối đa `40°` mỗi đốt |
| `wrap` (ôm quanh) | Cuộn tới chạm rồi đốt ngọn cuộn tiếp qua cạnh, tối đa `HELD_FIT.curl` |
| `tip` (chạm bằng đầu ngón) | Chỉ đốt ngọn cuộn, đốt gốc giữ dáng; tối đa `30°` |
| `support` (đỡ) | Không cuộn; chỉ gỡ khi lún |
| `free` (tự do) | Không cuộn; hoà nửa về dáng nghỉ (`HAND_RELAXED`, `hand.ts:23`) rồi gỡ khi lún |
| `extend` (duỗi) | Không cuộn; gỡ khi lún chỉ bằng cách mở |

3. **Tự hiệu chỉnh da.** `heldFit` nhắm khe `HELD_FIT.touch` (`−0,15`) trên nang **chưa phình** (`pieceRadius`), trong khi da ở
   khớp lồi ra ngoài nang ấy; đo trên da thì ngón vừa chạm đã lún chừng 0,5. Với mỗi lần cầm có `roles`, `skinBulge` đo một
   lần độ lồi da `δ` của từng đốt ở dáng gốc (khoảng lớn nhất từ đỉnh da có trọng số lớn nhất ở
   đốt ấy tới mặt nang của đốt, `handSkin`, `handMesh.ts:287`) và `heldFit` nhắm `touch` trên nang bán kính `r + δ`. Ngón ôm và `check`
   cùng đo một mặt da. Cùng `δ` ấy dùng khi đặt lòng tay lên mặt trụ, mặt tấm (`contact`).
4. **Bút, đũa** có dáng soạn tay (`tripod`, `chopsticks`, trong `HAND_POSES`, `hand.ts:31`; nhóm `pen`, `chopsticks`): hai đốt mỗi ngón không ôm theo
   que mảnh bằng cách cuộn tới chạm, nên vai trò ở đây là `press`/`support` với tầm cuộn nhỏ (`curl ≤ 15°`, `THIN_CURL`) — chỉ để khép khe và gỡ
   lún. Viết, gắp là động tác (để sau).
5. **Ngón hoà khi đổi lần cầm**: món đặt trước hoà ngón tuyến tính từ nghiệm cũ sang mới trong `HOLD_BLEND` (mục 5, Đổi lần
   cầm).
6. **Nhớ theo lần cầm.** `heldFit` đo 1,75–4,16 ms một bàn tay một khung (cỡ `1,61`, fixture `bang-gia#doc` 1,75, `tom-hum#nhac`
   2,66, `dien-thoai#doc` 2,84, `chai-dia#co` 4,16). `fitHolding` (`attach.ts`) nhớ kết quả theo bàn tay, khoá lần cầm và chỗ
   món trong khung bàn tay đã lượng tử hoá (`FIT_Q`; tối đa 8 mục mỗi tay), độ lồi da `skinBulge` nhớ theo dáng gốc: tay mang
   món giữ liên kết cố định thì chỉ tính một lần mỗi lần cầm.

## 7. Luật `check` nhóm `held`

Lần cầm có khoá `món@nhóm/…` (chỗ cầm nhóm) đi qua `groupHits` của `heldAudit.ts`; đường cũ (`hold` gọi tay, không chỗ cầm
nhóm) giữ bộ luật của [03](03-scene.md#đồ-cầm-tay) (`pose`, `drift`, `grip` theo `HELD_PINCHES`). Mỗi luật nhóm là một dòng
báo trỏ về **chỗ cầm và hướng món** (của cảnh hay của rig). **Cửa sổ hoà**: tay còn trong `HOLD_BLEND`
của một ranh giới lần cầm (`holdBlending` của `scene.ts`: vừa cầm, đổi chỗ cầm, vừa buông) đang đi tới món, nên `grip`,
`loose`, `role`, `oppose` im; các luật còn lại vẫn đo. `touch` của chỗ cầm là của mốc `hold` đang hiệu lực ở giây đo, kể cả mốc sau
trong cùng lần cầm (`regrip` cùng khoá), như `scene_probe`.

| Luật | Áp cho | Kêu khi | Mức |
|---|---|---|---|
| `pierce` | mọi chỗ cầm nhóm | `pierce.core` — trục nang ngón, lòng tay vào trong hình quá `HELD_PIERCE_FIT` (`0,5`); đo trên trục nang (`capsuleClearance`), không đo trên da | cảnh báo |
| `sink` | mọi chỗ cầm nhóm | Da lún quá `HELD_SINK` (`|HELD_FIT.touch| + 0,5` = `0,65`), đo trên **da** ([bên dưới](#đo-lún-trên-da)); ngón ôm đã nhắm trên da nên không gỡ được là lỗi dáng nhóm | cảnh báo |
| `rest` | mốc món nằm (`items[].rest`) | Ở chính giây mốc, bàn tay người cầm (`cast` của mốc) mang món mà da xuống dưới mặt ngang qua điểm thấp nhất của món quá `HELD_REST` (`0,65`, = `REST_REF` của [mặt đỡ](#mặt-đỡ)); đo trên đỉnh da đang vẽ (`HeldHand.under` của `heldHands`), dòng báo nêu độ sâu. Món sát mép mặt đỡ mà ngón vòng qua mép cũng bị báo | cảnh báo |
| `loose` | mọi chỗ cầm nhóm | Không vùng da nào của vai trò bắt buộc (`press`, `wrap`, `tip`, lòng tay `press`; không vai trò nào bắt buộc thì xét cả bàn tay) cách hình dưới `HELD_TOUCH` (`1`) | cảnh báo |
| `role` | mọi chỗ cầm nhóm | Ngón có vai trò `press` / `wrap` / `tip` còn cách hình quá `HELD_WRAP` (`1,5`), đo trên da | cảnh báo |
| `oppose` | chỗ cầm nhóm có ngón cái vai trò `press` / `wrap` / `tip` | Ngón cái chạm (khe ≤ `HELD_TOUCH`) và có phần đối đang chạm — ngón vai trò `press` / `wrap` / `tip` / `support`, lòng tay `press` — mà góc lớn nhất giữa pháp tuyến hình món (`heldNormal`, građien của `heldDistance`) ở vùng da chạm của ngón cái và ở vùng da chạm của phần đối dưới `HELD_OPPOSE` (`120°`): không có gì kẹp món phía bên kia ngón cái. Vùng da chạm của một phần là các đỉnh cách hình không quá khe nhỏ nhất của phần ấy (hay `0`) cộng `SKIN_NEAR` (`0,3`), lấy mẫu tối đa 24 pháp tuyến mỗi phần (`heldOppose`). Ngón cái không chạm hay không phần đối nào chạm thì luật im (việc của `loose`, `role`); `platform`, `carry`, `handle` `hook` (ngón cái `free` / `support`) không xét | cảnh báo |
| `grip` | mọi chỗ cầm nhóm | Tâm nắm cách **hình** (`shape`) quá ngưỡng của nhóm (`groupGripMax`: nhóm hay biến thể có dáng kẹp đầu ngón `HELD_PINCHES` dùng `HELD_GRIP_PINCH` `5`, còn lại `HELD_GRIP` `3`; tay dẫn lấy biến thể cảnh khai: `cylinder` không khai `variant` lấy `5` vì `flat` có dáng `span`, `wrap` khai rõ lấy `3`). `grip` khai ở `package.json` thì thắng ngưỡng nhóm, cả khi nhỏ hơn (`gripDeclared`) | cảnh báo |
| `reach` | món đặt trước | Tay duỗi hết vẫn không tới chỗ cầm: khe tầm với `arm.gap` quá `AIM_GAP · s` | **lỗi** |
| `wrist` | món đặt trước | Ở khuỷu tốt nhất cổ tay vượt `TURN_MAX`, `AIM_BEND` hay `AIM_DEV` (`heldWristMargin` dương) — lỗi, kèm độ vượt và độ lệch bàn tay – chỗ cầm; còn cách giới hạn dưới `HELD_WRIST` (`5°`) — cảnh báo. Dòng báo gợi đổi `edge`/`thumb` hay hướng món | lỗi / cảnh báo |
| `arm` | món đặt trước; lấn đầu: mọi chỗ cầm nhóm | Bắp tay, cẳng tay lấn vào thân, đầu hay tay kia quá `HELD_ARM` (`0,3`) lần bán kính tay ở chỗ lấn (`bodyRatio`). Lấn đầu (`bodyPart` `*.head`) là lỗi, cả ở tay dẫn | cảnh báo / **lỗi** |
| `elbow` | mọi chỗ cầm nhóm | Khuỷu gập ngược: `arm.inward` (mục 5) quá `HELD_ELBOW` (`0,3` lần cánh tay trên) — khuỷu nằm phía giữa thân hay chĩa lên so với đường vai → cổ tay, cẳng tay chạy ra ngoài hay xuống tới bàn tay. Dòng báo gợi đổi `edge` / `thumb`, hướng món hay khai `elbow` | **lỗi** |
| `size` | món đặt trước | Số đo khối hình đã chọn từ `SIZE_WARN · W` (`0,8`) trở lên (thân `chai-dac-tuyen` `r 13,2` với tay `W 14,7`: `0,90 · W`) | cảnh báo |
| `up`, `face`, `reach` (tay phụ, `item:`) | tay dẫn | Ý định trục chính còn lệch quá `HELD_UP` (`up`) hay `HELD_FACE` (`face`) (`AimReport.hold`); tay phụ hay điểm `item:<mốc>` còn cách đích quá `AIM_GAP · s` | cảnh báo |
| `jump`, `seat`, `body`, cầm món không ai `provide` | cả hai | Như [03](03-scene.md#đồ-cầm-tay); `jump` có loại "đổi chỗ cầm" giữa hai lần cầm cùng món | như 03 |
| lỗi `ref` `group` | `resolveScene` | Món không có khối hình nào cho nhóm với cỡ tay của người khai (`checkHolds` của `scene.ts`); dòng báo nêu khối hình món có, và phần khác còn vừa nếu có: `` `<món>` phần `than` (r 15) quá tầm nắm của tay `<người>` (0,95 · W = 14,0): khai `part: "vai"` hay hai tay `` | lỗi |
| lỗi `ref` `choice` | `resolveScene` | Chỗ cầm không hợp lệ: trường không thuộc nhóm, `edge`/`thumb` không có trên khối hình, biến thể quá bề dày ở mép (`flat` trên tấm dày hơn `FLAT_MAX · W`), biến thể kẹp qua hai mép mà bề rộng tấm ở cạnh khai (hay mọi cạnh) ngoài `across` (`card` `edges`), biến thể không áp trên loại khối hình (`flat` của `cylinder` chỉ trên `rod`; chai, trụ tiện báo lỗi kèm khối hình món có), `part` không có hay `grip: false`, `along` ngoài 0–1, `both` với nhóm một tay không có `support`, `both` mà tay kia cũng có `hold` ở cùng `t`, `on`/`yaw` ngoài `carry`, `carry` thiếu `on` hay món không có `seats[on]`, nhóm `later`; lần cầm có mốc món ở `items` mà mốc tay khai đích (`to`, `at`, `offset`, `point`) hay ý định (`face`, `up`, `roll`, `keep`); mốc món ở `t` không tay nào cầm món ấy | lỗi |
| cảnh báo `ref` `choice` | `sceneHoldProblems` (`choiceWarnings`) | Chỗ cầm hợp lệ mà `along` cảnh khai sát phần `grip: false` quá `clear · W` của nhóm (`cylinder`: `GRIP_CLEAR` = 0,3): tâm nắm cách phần ấy dưới ngưỡng. Dòng báo nêu phần cắt, khoảng cách dọc trục, `along` rig kẹp về (`alongRoom`) và `along` nên khai; cỡ tay lấy theo người cầm. Không chặn | cảnh báo |
| lỗi `ref` `item` | `resolveScene` | Mốc món có đích của trục phụ lệch đích của trục chính dưới 18° (cos tuyệt đối > 0,95): hướng món suy biến, dòng báo gợi `roll` khác; đích của một trục trùng chỗ món; `face` trần không có trục (mốc không khai, nhóm không có mặc định). Rig không tự đổi | lỗi |

Khuỷu khoá (`elbowLock`) đi qua cùng các luật `arm`, `elbow`, `wrist` ở chỗ khoá: rig không dời khuỷu khoá ra khỏi thân hay
khỏi thế gập ngược. Khuỷu khoá xoay quá nhanh báo ở nhóm `move` ([03](03-scene.md#giật-trên-hình)).

Ngưỡng số cấu hình ở `package.json` `stickman.held` ([05](05-repo-video.md#nhóm-luật)): `pierce`, `touch`, `wrap`, `grip`,
`reach`, `sink`, `wrist`, `arm`, `elbow`, `oppose`, `rest`, `hold`.

### Đo lún trên da

Lún và khe của chỗ cầm có `shape` đo trên **đỉnh da đang vẽ** (`skinDepth` của `heldFit.ts`, `heldHands` của `held.ts` gọi
nó). `pierce.core` vẫn đo trên trục nang (`capsuleClearance`). Lún đo trên nang bàn
tay đã nới (`handCaps`, `collide.ts:249`; `fitCapsules`, `handMesh.ts:420`) là **vỏ bao ngoài** của da: nang phình tới
mọi đỉnh da lòi ra, nên một chỗ phình (khớp gốc ngón khi bốn ngón gập 40° của dáng `sheet`) làm cả dải dày lên và lún đo trên nang lớn hơn lún thật
của da (tấm kẹp mép `sheet`: nang 4,2, da 0,48).

Bàn tay three đã có da dời theo dáng và độ gập thêm (`h.geo.attributes.position`, khung cổ tay — cùng mảng `handCaps` đọc,
`collide.ts:252`), 1 400 đỉnh mỗi bàn tay ở mọi cỡ (450 với `low`):

```
skinDepth(pos, piece, IF, shape):         # piece: đốt trọng số lớn nhất của từng đỉnh (một lần mỗi HandSkin)
  for each vertex p:
    d = heldDistance(shape, toItem(IF, p))     # gồm cả khối `detail`
    depth = max(depth, −d); gap[piece[p]] = min(gap[piece[p]], d)
  near[part] = đỉnh của phần cách hình ≤ max(gap[part], 0) + SKIN_NEAR
  return { depth, gaps, near }                 # gaps theo ngón và lòng tay cho `role`, `loose`; near cho `oppose`
```

Chi phí (cỡ `1,61`): 0,3–1,7 ms một bàn tay, mỗi `0,1 s` của `check`. Hàm thuần đặt ở lõi (`heldFit.ts`).

## 8. Chuyển đổi

Rig chỉ nạp món bản 2, 3 (`HELD_VERSION` 3) và `hold` dạng nhóm. Repo còn món bản 1 (kiểu cầm khai theo món) hay
`hold` dạng `món#kiểu` / `{ item, grip }` thì zod báo lỗi kèm lệnh `stickman migrate-held`: tool chuyển món bản 1 sang món
v2 và `hold` của cảnh sang chỗ cầm nhóm `{ item, group, … }`.

1. **Nhãn phần ghi tay.** Nhãn phần không suy ra được từ kiểu cầm bản 1: agent gắn `part`, `detail`, `parts`, `front`, `top`,
   `seats` vào từng món v2 (khối hình suy ra soi bằng `describe_held` của MCP và `pnpm bang-cam --mon <món>`), để ở thư mục
   riêng khi `held/` còn bản 1. Không viết quy tắc theo chỉ số khối: món nhiều khối đổi thứ tự là gãy.
2. **`stickman migrate-held`** đọc món bản 1 ở `held/` (cùng lớp chung, bằng schema riêng của tool), món v2 có nhãn phần ở
   `--held-dir` (mặc định `held`), nhân vật ở `characters/`. Chạy `--dry-run` trước: chỉ in bảng, không ghi gì; `--out
   <file.md>` ghi bảng kèm kết quả JSON cạnh nó; `--scene <regex>` chỉ cảnh có id khớp.
   - **Món.** Món v2 nhận `seats` từ kiểu treo và `touch` chung của mọi kiểu cầm bằng tay; tool chỉ ghi file ở `--held-dir`
     khi `seats` hay `touch` lệch món v2 sẵn có, còn lại báo `khớp`. `touch` mà nhóm tự cho lấn (`self.hand`, `self.foreArm`)
     bỏ; nhóm chỉ cho lấn bên cầm (hai bên khi `both`), nên bên kia (`self.handL`, `self.foreArmL` hay `R`) ghi xuống `touch`
     của chỗ cầm trong cảnh. `touch` riêng của một kiểu cầm không lên món mà xuống `touch` của chỗ cầm trong cảnh; món có một kiểu cầm bằng tay
     thì mọi `touch` của nó xuống cảnh.
   - **Cảnh.** Mỗi `hold` bản 1 → `{ item, group, … }` theo bảng kiểu → nhóm `HOLD_MAP` của `packages/cli/migrate-held.mjs`;
     `--map <file>` đè hay thêm dòng `{ group, part?, variant? }` theo khoá kiểu cầm; kiểu không có trong bảng là lỗi. Kiểu
     treo → `carry` với `on`, `yaw` của kiểu treo, không dò. `hold` đã là nhóm, hay `null`, giữ nguyên. Cảnh chuyển đi đường
     **tay dẫn** (mốc tay giữ đích).
   - **Ý định** của kiểu cầm ghi ra chỉ khi khác mặc định của nhóm trên món; kiểu cầm không có ý định mà nhóm có mặc định thì
     `keep: true`. Nhóm thêm trục mà kiểu cầm không chốt thì bảng ghi chú.
   - **`both`.** Tay dẫn của kiểu cầm hai tay mang `both: true` (hay đè tay phụ khi mặc định của nhóm lệch tay kia quá ngưỡng
     và có đè bớt lệch hẳn); tay kia thành `hold: null`.
   - **`regrip`.** Hai lần cầm liền nhau khác kiểu cầm mà chỗ cầm mới trùng khoá thì lần sau mang `regrip: true`, giữ ranh
     giới lần cầm.
3. **Chỗ cầm tương đương.** Với mỗi lần cầm tay (không phải treo): dựng liên kết bản 1 bằng **bàn tay thật của người cầm**
   (cỡ theo nhân vật và trang phục của thành viên cảnh), quét lựa chọn của nhóm (phần, cạnh, mặt ngón cái, biến thể, các
   trường liên tục) qua chính đường tay dẫn của rig (`holdHand`, `graspLink`), lấy chỗ cầm có góc quay `/ 5°` cộng khoảng dời
   `/ 1` đơn vị nhỏ nhất, và **ghi đủ mọi trường** vào cảnh, không để rig giải. Không có nhân vật của thành viên thì không
   ghi cảnh. In bảng `cảnh · người · tay · t₀ · kiểu cầm · chỗ cầm · góc, khoảng lệch món trong tay`: góc là phép quay món
   trong bàn tay, khoảng là độ dời của điểm món ở tâm nắm bản 1; lệch quá `5°` hay `1` đơn vị đánh dấu **!**, là shot đổi
   hình, chủ dự án duyệt. Dòng tay phụ của `both` đo so với tay kia của kiểu cầm. Lần cầm có chỗ cầm không qua `checkChoice`
   hay cảnh sau chuyển không qua schema là lỗi.
   - **Chưa ghi.** Nhóm `later` (`round`, `hug`, `clamp`, `soft`): bảng ghi `chờ nhóm`, `hold` chỉ mang `item`, `group`, phần và
     biến thể ép. Cảnh còn lần cầm `chờ nhóm` hay lỗi thì **cả cảnh không ghi** (không ghi nửa cảnh). Có lỗi hay lỗi nạp thì
     lệnh thoát mã `1`.
4. **Thay `held/` và kiểm.** Chạy tool thật rồi mới thay `held/` bằng bản v2 (tool đọc bản 1 ở `held/`). Sau đó
   `stickman check --only ref,held`, `pnpm bang-cam`, soi các shot đánh dấu **!**. Chuyển cảnh sang món đặt trước là việc
   soạn lại từng cảnh, không do tool.

### `bang-cam` theo nhóm

`pnpm bang-cam [--nhom <nhóm,…>] [--mon <món,…>]` (`bang-cam.mjs`, `packages/cli/scaffold/tools/`): hàng là **nhóm × món ×
chỗ cầm mẫu × hai cỡ tay**, cột là ba góc (trước, chéo, ngang) với ống kính sát bàn tay như `pnpm can-tay`. `--nhom` bỏ
trống là mọi nhóm chạy được (có chỗ tiếp xúc trong `CONTACTS`, không `later`, cùng `carry`); `--mon` bỏ trống là mọi món
của `held/`.

- Người đứng `stand-3d` ở `--at`, quay `--yaw`; món đặt trước ngực bằng `items` theo hướng mặc định của nhóm, chỗ cầm nhóm
  do rig giải (`món@nhóm`). Hai cỡ tay: người có bàn tay nhỏ nhất và lớn nhất trong `characters/` (`--ai` đổi người).
- Hàng mẫu: chỗ cầm mặc định (nhãn in biến thể rig chọn), từng biến thể của nhóm và từng [kiểu cầm có
  tên](#kiểu-cầm-có-tên) của món ở nhóm ấy (`namedVariants`; hàng `kiểu <tên> (gốc <biến thể>)`, món đặt như hàng mặc định,
  `note` in dưới tên hàng ở nhãn ô, `index.md` và `index.html`); `sheet` thêm ngón cái trước / sau, đọc
  ngang mặt, khoe một tay, khoe hai tay hai cạnh bên, khoe hai tay trên dưới (bỏ khi hai cạnh cách nhau dưới 1,3·`W` của cỡ
  tay đang vẽ), và với đĩa hay tấm nằm trong khung món thì bê hai tay hai vành (`rim`, `both`, tay phụ cạnh đối); `palmBox` thêm đọc ngang mặt, khoe một tay, áp tai (tay dẫn); `card` thêm cầm xem (thẻ trước ngực trên, `offset [70, −70, 15]`, rig chọn, tay phải và tay trái), khoe đặt trước (thẻ
  ấy quay mặt ra trước, rig chọn), khoe thẻ (tay dẫn phải và trái, `edge: bottom`, `thumb: back`, `face: front → forward`),
  đưa thẻ qua quầy (tay dẫn duỗi `offset [95, −20, 15]`, mép ngắn `left`, thẻ ngửa, mép `edgeR` ra trước), tay dẫn, và nhặt trên bàn (thẻ nằm ngửa trước bụng `to: belly`, `offset [40, 20, ±10]` lệch về tay cầm, `face: front → up`,
  `roll: top → forward`: rig chọn, khai `edges`, khai `lateral` để so — tay phải và tay trái); `platform` đặt món ngang bụng, xa ngực
  hơn hàng chung (`offset [80, 20, 0]`) và thêm `ψ` 0 / 90 và tay dẫn; `chopsticks` đặt đũa trước ngực (`offset [35, −5, 12]`) có hướng (`face: tip → forward, tilt −30`, `roll` trục que bạn về bên phải: hai que nằm ngang), thêm `along` 0,15 / 0,45, tay dẫn phải và trái (cùng `face`); `pen` đặt bút trước ngực (`offset [44, 16, 25]`) ngòi ra trước chúc xuống (`face: tip → [0,8, 0,6, −0,2]`), thêm `along` 0,15 / 0,45, tay dẫn phải và trái (`offset [40, 30, ±25]`, `point: item:tip`, `face: tip → [0,5, 0,866, 0]`); `handle` đặt túi ngang hông (`to: hip`, `offset [0, 65, 30]`: quai ngang tầm tay buông, cách thân ra phía tay phải để cẳng tay không vào thân), thêm `along` 0,2 / 0,7 và tay buông xách phải / trái (tay dẫn không khai đích, món theo bàn tay); `bowl` đặt chén trước ngực, thêm `along` 0,4 / 0,5 (`pinch`: cao nhất, sâu nhất), `side` `along` giữa (0,5), `around` 180 và 90 (`pinch`: ngón cái về thân, hàng giới hạn cổ tay), tay dẫn phải và trái (miệng ngửa) và tay dẫn hai tay đỡ đáy;
  `platform`, `cylinder` (chai đứng hơi nghiêng), `bowl` (chén nghiêng nhẹ) và `palmBox` thêm hàng hai
  tay `both` món đặt trước (tay phụ cạnh đối, đỡ đáy, đỡ mặt sau); `carry` chỉ hai
  hàng treo khuỷu (khuỷu gập chữ V, cổ tay trước vai) và treo vai (cổ tay theo vai `offset [0, 95, 65]` — tay dang ngoài túi, co giãn theo người —, cảnh khai `touch` cho vai), món không
  đặt trước ngực, ô ảnh lấy cả món và đoạn tay, `do.json` giữ
  `seat`, `body`, `swing` (và `bend`, `rise` của khuỷu).
- Hàng `sheet` hay `card` khai `edge` hay `thumb` không có trên khối hình tấm hay đĩa của món, hay cần mốc món (`front`, `bottom`) mà món không có,
  bị lọc trước khi giải; hàng `both` mà món không có mặt đáy / sau có cạnh cho tay phụ cũng bị lọc; `do.json` (`loc`) và `index.md`
  kê hàng lọc kèm lý do. Cặp (món, `platform`) mà mặt đỡ chọn ra (chúc xuống nhất) không có cạnh (đáy chai tròn) bị bỏ cả cặp (`bo`).
- Hàng giải ra cùng chỗ cầm, đặt món cùng vị trí với một hàng đứng trước nó thì bị bỏ; `do.json` (`trung`) và `index.md`
  kê hàng bỏ.
- Cặp (món, nhóm, người) mà món không có khối hình đạt `needs` của nhóm với cỡ tay ấy bị bỏ; lý do ở `do.json` (`bo`) và dòng
  in ra.
- Nhãn in chỗ cầm rig chọn, `lún` trên da, `role` từng ngón (khe tới món, vai trò), cổ tay vượt kẹp, `size`; `do.json` giữ thêm
  `sink`, `roles`, `gaps`, `pierce`, `grip`, `grasp`.
- `--so`, `--luu-chuan`, `--chuan` so hồi quy ([03](03-scene.md#bảng-duyệt-nhóm-cầm)): bảng chuẩn là bảng vừa duyệt bằng mắt,
  cũng là chuẩn so cho fixture của nhóm.

## 9. Code

Mỗi nhóm chạy có chỗ tiếp xúc (`CONTACTS`), dáng mở/đóng, vai trò, khung chuẩn khớp fixture
(`core/__fixtures__/grip-frames.json`), test và hàng `bang-cam` (mục 8); chi tiết từng nhóm ở mục 3. Theo file:

1. `core/heldItem.ts` — `HeldItemSchema`, `GROUP_VARIANTS`, `SceneHoldSchema`, `graspLink`, `ReachHold` (`grasp`, `solve`, `was`, `released`,
   `from`, `enter`), `HoldGrasp`.
2. `core/heldGeom.ts` — `itemGeom`, `handDims`.
3. `core/graspGroups.ts` — `GRIP_GROUPS` đủ 14 nhóm; mười nhóm chạy, bốn nhóm kia `later` (`check` báo "chưa làm");
   `variantOf`, `namedVariants` (kiểu cầm có tên).
4. `core/graspSolve.ts`, `core/graspArm.ts` — `graspFrame`, bàn tay từ món, khuỷu `E(φ)` và chuỗi mẫu, giải lựa chọn thiếu,
   `GraspReport`, giá mặt đỡ (`restUnder`).
5. `core/scene.ts` — `items`, `itemAt`, đường theo lần cầm (`runMarks`), lần cầm theo mốc (`keyedArm`), `graspAtTime` (nhớ
   theo runtime và nhân vật), `ReachHold.solve`, hoà vào/ra lần cầm (`placedWas`), `holdBlending`, `checkHolds`, `sceneItemProblems`,
   lần thả và mốc món nằm (`itemReleases`, `itemReleased`, `restingMark`), báo cho studio (`holdRuns`, `handReport`).
6. `core/arm3.ts` (lá), `core/act3.ts`, `core/holdLink.ts` — đường món đặt trước (`solveActing`), tay dẫn qua `holdLink`,
   `AimReport.hold.grasp`; `actJoints` khớp `act` (`act3.test.ts`); `actArm` (tay vẽ kèm vết bộ giải, `ArmTrace`).
7. `core/heldFit.ts` — `roles`, `skinBulge`, `skinDepth`, `heldNormal`, `shapeSupport`, `skinUnder`; `core/heldCarry.ts` — `carrySpecOf`, `carryFrame`;
   `core/heldAuthored.ts` — kiểu cầm soạn tay (mục [2](#kiểu-cầm-soạn-tay-authored)).
8. `src/attach.ts`, `src/world.ts` — gắn món qua `holdLink`, `fitHolding` nhớ theo lần cầm; `Hand.heldV` (`human.ts`) mang dáng
   nhóm đã hoà.
9. `core/heldAudit.ts`, `src/held.ts` — luật mục 7 (`heldOppose`), `skinDepth` cho mọi chỗ cầm có `shape`, `HeldHand.grasp`, `HeldHand.oppose`, `HeldHand.under` (luật `rest`).
10. `packages/mcp/server.mjs` — `schema(held)`, `list(held)` (`groups`, `named`), `describe_held`, `scene_probe` `grasp`; `packages/cli` —
    `heldOptions` (`sink`, `wrist`, `arm`, `oppose`, `rest`, `grip`), `heldRows` đọc lỗi `reach`/`wrist`, `bang-cam`, `migrate-held` (mục 8).

Phần "để sau" (mục 1) làm khi có cảnh cần.

## 10. Đã chốt

Chủ dự án chốt:

1. **Món đặt trước, tay theo món.** Cảnh khai món ở đâu, quay về đâu và mỗi tay cầm chỗ nào; rig tính bàn tay, cổ tay, ngón và
   khuỷu tự nhiên. Rig không chọn chỗ cầm bằng một hàm chi phí trên bàn tay đã đặt.
2. **Cảnh thường khai đủ chỗ cầm**; thiếu trường nào thì rig tự giải trên món đã đứng yên ở chỗ khai (mục
   [5](#lựa-chọn-cảnh-không-khai)).
3. **Ngoài tầm với thì `check` báo**; rig không kéo món lại gần.
4. **Món và chỗ cầm cùng đi theo thời gian**: mốc món cho món đi, trường số của chỗ cầm hoà giữa hai mốc tay cho tay trượt (cuốc
   đất: tay trượt dọc cán).
5. **Hướng món mặc định theo nhóm** (tấm, thẻ, hộp cỡ lòng tay: mặt trước về mặt người cầm; trụ, chén, quai, đỡ dưới: đứng);
   tay dẫn tắt bằng `keep: true`.
6. **Có viết tắt `"món@nhóm"`**, và `"món@nhóm/kiểu"` khi cảnh gọi một biến thể hay kiểu cầm có tên.
7. **Món to so với tay**: nhận tới `0,95 · W`, cảnh báo `size` từ `0,8 · W`; quá nữa là lỗi `group`, dòng lỗi gợi phần khác
   còn vừa hay hai tay.
8. **Đũa**: dáng `chopsticks` và chỗ tiếp xúc `grip` cầm đũa thật theo ảnh mẫu `dua-an-can`; `pick` và tách que trên làm khi có shot cần gắp.
9. **Kiểu cầm có tên nằm trong món** (`authored.<nhóm>.<tên>`, có `base` và `note`); cảnh gọi qua `variant`. Bản theo nhóm ×
   biến thể gốc vẫn là mặc định; rig không tự chọn kiểu cầm có tên.
