# 11 — Nhóm cầm (bản nháp)

> **Thiết kế đã duyệt, chưa có code.** Mô tả cách dựng lại phần cầm đồ của rig bàn tay theo **nhóm hình dáng**, thay cho
> "kiểu cầm khai theo món" (`held/<món>.json` `grips`, [01](01-rig.md#kiểu-cầm)). Các quyết định chủ dự án đã chốt
> (2026-10-19) ghi như luật; bảy điểm chọn giữa các phương án ở [Đã chốt](#10-đã-chốt). Hằng số của bàn tay từ món ở mục
> [5](#5-giải-tay-theo-món); ngưỡng của từng nhóm còn chỉnh ở giai đoạn 4 (mục [9](#9-kế-hoạch-code)). Phần nhắc cảnh của một tập cụ thể nằm ở [Phụ lục A](#phụ-lục-a--chuyển-cảnh-t02-tạm), xoá
> khỏi bộ docs khi đã chuyển xong.

Hiện trạng ngắn: kiểu cầm là một liên kết cứng tay ↔ món soạn tay cho từng món (`GripSpecSchema`,
`packages/rig/src/core/heldItem.ts:103`), đặt tên theo việc (đọc, khoe, rót…). Cùng một cách bám khai lại ở nhiều món,
nhiều cặp kiểu cầm chỉ khác cạnh bám hay ý định, tay trái khai `left` riêng (`heldItem.ts:107`, `:318`). Bản này tách ba
lớp: **nhóm cầm** ở rig, **hình món** ở `held/`, **lựa chọn và ý định** ở cảnh; rig tự tìm chỗ tiếp xúc trên hình và tự chọn
phương án ít vặn tay nhất.

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

**Tay dẫn** giữ cho đồ nhỏ đi theo bàn tay (bút, đũa, điện thoại áp tai): món không có mốc ở `items` thì mốc tay đặt
bàn tay như nay (`to`/`at`, `point`), món gắn vào bàn tay theo chỗ cầm, hướng món là ý định cổ tay cố đạt trong giới hạn khớp.

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
       graspFrame(k, long, s) → GripFrame (món trong khung bàn tay)          ← thay gripFrame (heldItem.ts:362)
                                                        ▼
       bàn tay = món · GripFrame⁻¹  →  cổ tay  →  khuỷu tự nhiên (mục 5)    ← act3.ts
                                                        ▼
       dáng ngón = hoà(open, closed, w) ─► heldFit(roles) ngón ôm theo hình  ← heldFit.ts:267
```

`itemGeom`, `GRIP_GROUPS`, `graspAt`, `graspFrame` là **một nguồn** cho bộ giải tay (`act3.ts`), gắn món three
(`attach.ts`, `world.ts`), `check` (`heldAudit.ts`, `held.ts`), `scene_probe` và MCP (`packages/mcp/server.mjs`), bảng
`bang-cam`. Code dựng lưới món của repo vẫn đọc mốc từ chính `held/<món>.json` (`src/objects/cam.ts:14` của repo video).

### Phạm vi: bản đầu làm, để sau

Định nghĩa đủ 14 nhóm và hai lớp động tác (chủ dự án đã chốt danh sách), nhưng **bản đầu chỉ làm những gì cảnh đang
dùng**. Phần "để sau" giữ định nghĩa trong bản này để schema và tên không phải đổi khi làm tới.

| | Bản đầu | Để sau |
|---|---|---|
| Nhóm | `sheet` (`pinch`, `flat`, `rim`), `card` (`pad`), `pen` (dáng), `chopsticks` (dáng), `cylinder` (`wrap`), `bowl` (`side`), `handle` (`hook`), `palmBox`, `platform` (`palm`), `carry` | `round`, `hug`, `clamp`, `soft`; biến thể `card.lateral`, `card.between`, `cylinder.index`, `handle.wrap`, `handle.ring`, `platform.tips`, `bowl.base` |
| Khối hình | `slab`, `disc`, `rod`, `lathe`, `box`, `face` | `path` (quai cong), `ball` |
| Món | `shape` + `part` + `detail`, `parts`, `front`, `top`, `anchors`, `seats`, `touch`, `hang` | `joints` (que trên của đũa), `soft`; `seats` thay bằng khai hình quai |
| Cảnh | `items`; `hold` có chỗ cầm, `"món@nhóm"`, `both`, `touch`, `regrip`; tay dẫn với ý định, `keep` | `write`, `pick`, lớp không cầm (`contact`) |
| Rig | Bàn tay từ món, khuỷu tự nhiên, giải lựa chọn thiếu, `heldFit` theo vai trò và tự hiệu chỉnh da, đo lún trên da, nhớ `heldFit` theo lần cầm | Thân người nghiêng, với theo khi món ngoài tầm |

## 2. Schema món (`held/<món>.json`, `HELD_VERSION` 2)

### Trường

| Trường | Nghĩa | Đổi so với v1 |
|---|---|---|
| `size` | Hộp bao, đơn vị rig | Giữ |
| `shape` | Hình va chạm: hợp các khối `box` / `cyl` / `ball` (`heldItem.ts:149`). **Bắt buộc**. Mỗi khối thêm `part?: "<tên>"` và `detail?: true` | Bắt buộc; thêm `part`, `detail` |
| `front` | Mặt trước: tên mốc có `dir` (màn, mặt chữ, nhãn) hay vectơ khung món. Bỏ trống là `+z` | Mới |
| `top` | Đầu trên: tên mốc có `dir` hay vectơ. Bỏ trống là `+y`; món có miệng (`lathe` có `wall`) thì bỏ trống là hướng miệng | Mới |
| `anchors` | Mốc có tên `{ at, dir? }`: trục ý định (`screen`, `nhan`, `mouth`, `speaker`, `tip`) và điểm `item:<mốc>` | Giữ |
| `parts` | Thuộc tính phần (các khối cùng nhãn `part`): `grip: false` (không được cầm), `as` + `axis` (ép kiểu khối hình khi rig suy sai) | Mới |
| `seats` | Chỗ treo của nhóm `carry`: `{ "elbow"?: mốc, "shoulder"?: mốc }` (đỉnh quai, mặt trong) | Thay `grips.<kiểu>.on/at` (`heldItem.ts:121`) |
| `touch` | Phần người được lấn vào món khi cầm, cộng với bàn tay, cẳng tay cầm (mặc định) | Từ từng kiểu cầm lên món; cảnh cộng thêm |
| `hang` | Nhóm con thõng theo trọng lực (`heldItem.ts:178`) | Giữ |
| `joints`, `soft` | Que xoay được trong tay (gắp); vật mềm | Để sau |
| `grips` | — | **Bỏ** |

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
| `slab` (tấm) | Hộp bao của phần (trục khung món) có cạnh ngắn nhất `t ≤ 0,25 ×` cạnh giữa | Tâm, pháp tuyến hai mặt lớn, bề dày `t`, bốn cạnh có tên (dưới) |
| `lathe` (trụ tiện) | Các khối `cyl` của phần **đồng trục**: trục song song (lệch `≤ 2°`) và khoảng cách giữa hai trục `≤ 0,1 · r` (r bán kính lớn hơn của hai khối) | Trục (trung bình các trục), bán kính theo chiều dài `r(s)` (tuyến tính từng khúc), miệng (khối có `wall` ở một đầu) |
| `disc` (đĩa) | `lathe` dài `≤ 0,3 ×` bán kính lớn nhất | Tâm, trục, bán kính vành, bề dày; vành là cạnh tròn |
| `rod` (thanh) | **Từng khối** (không phải hộp bao cả phần): khối `cyl` không thuộc `lathe` nào; khối `box` có tiết diện (hai cạnh ngắn `a ≤ b`) với `b / a ≤ 3` và `b ≤ 0,5 ×` cạnh dài | Trục; `r` = nửa cạnh ngắn của tiết diện (bán kính `cyl`); `R` = nửa cạnh dài (`cyl`: `R = r`) |
| `box` (hộp) | Mọi phần | Hộp bao, sáu mặt |
| `face` (mặt) | Mỗi mặt của `box`, mặt đáy của `lathe` | Tâm, pháp tuyến ra ngoài, hai nửa cạnh |

Hệ quả kiểm được trên món hiện có: biên lai (`0,3 × 20 × 48`, tiết diện 66 : 1) và điện thoại (`2,88 × 18,45`, 6,4 : 1)
không ra `rod`, nên không cầm được kiểu `cylinder`; đũa ra hai `rod` (mỗi que một khối `cyl`); đĩa tôm hùm (hai bộ trụ côn
lệch trục 2 đơn vị, bán kính 21–35) ra một `lathe` vì `2 ≤ 0,1 · 21`; tay cầm ống nghe máy bàn (`box 18 × 6 × 44`, tiết diện
3 : 1) ra `rod` `r 3`, `R 9`.

Miền bám của một khối hình trừ vùng nằm trong hộp bao của phần `grip: false` (cộng một bán kính ngón): ống nghe bám được
thân, không bám được hai đầu loa, mic.

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
  "schemaVersion": 2,
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
  "schemaVersion": 2,
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
  "schemaVersion": 2,
  "size": [65.6, 94.1, 23],
  "front": "mat",
  "top": "quai",
  "anchors": {
    "quai": { "at": [0, 91.1, 0], "dir": [0, 1, 0] },
    "treoKhuyu": { "at": [0, 87.1, -14] },
    "mat": { "at": [0, 16.5, 9.18], "dir": [0, 0, 1] }
  },
  "seats": { "elbow": "treoKhuyu", "shoulder": "quai" },
  "shape": [ /* thân túi như v1 */ ]
}
```

Nhãn phần của 34 món hiện có: [Phụ lục A](#nhãn-phần-34-món).

`parseHeldItem` v2 báo: `front`/`top`/`seats` trỏ mốc không có hay không `dir`, `top` lệch miệng, `as: "rod"` thiếu `axis`,
mọi khối đều `grip: false` hay `detail`. File v1 (`grips`) ra lỗi kèm hướng dẫn chuyển (mục [8](#8-chuyển-đổi)) — không nâng
tự động được, vì nhãn phần không suy ra được từ kiểu cầm cũ.

## 3. Schema nhóm (rig, `GRIP_GROUPS`)

### Cỡ tay

Mọi ngưỡng tính theo cỡ bàn tay của chính người cầm, đơn vị rig của món (cỡ người `s` triệt tiêu). Ba số, tính một lần mỗi
cỡ (`handDims(k, long)`) từ `HAND_BONES` và `handFrames` (`hand.ts:159`, `:210`):

| Số | Nghĩa | Ở cỡ `1` (đo 2026-10-19, ngón cái giai đoạn 1) |
|---|---|---|
| `W` | Bề ngang lòng bàn tay (`2 · palm.half[1] · k`) | 8,4 · k |
| `A` | Khe đầu ngón cái – đầu ngón trỏ ở dáng `open` | 9,76 · k |
| `L` | Cổ tay tới đầu ngón trỏ, dáng nghỉ | 17,9 · long |

Bàn tay không nhân theo chiều cao người. Người trong repo có tay nhỏ nhất `t01-sakura` (`k 1,75`, `long 1,545`), lớn nhất
`kuroiwa` (`k 2`, `long 1,813`): `W` từ 14,7 tới 16,8. `bang-cam` xếp người theo `k · height` (1,61 / 2,16), không phải cỡ tay.

**Phụ thuộc ngón cái.** Ngón cái vừa sửa ở giai đoạn 1 (gốc `[0,019, −0,033, 0,030]`, hai đốt `0,048`, `0,040`,
`hand.ts:161`; chủ dự án duyệt). `W`, `A`, `L`, `P` và hệ số lòng tay `sheet pinch` đo trên bàn tay mới; độ thụt `d` của
`sheet` ở nhóm 1 (bên dưới); khung chuẩn các nhóm khác đặt ở giai đoạn 4 theo ảnh.

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

Món không bao giờ lật gương (giữ tinh thần `gripFrame`, `heldItem.ts:359`); không còn khối `left`.

**Khung chuẩn của nhóm.** `contact` viết theo khung của khối hình (cạnh: `m` pháp tuyến ngoài của cạnh trong mặt tấm, `e`
dọc cạnh về đầu cao, `F` pháp tuyến mặt có ngón cái; trụ: trục `a`, hướng bán kính `ρ(θ)`), với hệ số rút từ một kiểu cầm
đã duyệt. Kiểu cầm cũ sẽ mất cùng `grips`, nên trước khi xoá chúng, giai đoạn 3 chụp **fixture**: liên kết (`GripFrame`) của
kiểu cũ dựng lại trên **bàn tay mới**, lưu trong test của rig; nhóm trỏ fixture bằng `fixture`. Ví dụ `sheet` `pinch` từ
`bang-gia#doc`: `palm ≈ 0,7654 · F + 0,6436 · f` (với `f = [−0,94, 0, −0,34]` ra đúng `[−0,6, 0,76, −0,22]` của kiểu cũ, dư
0,005).

### Bảng tóm tắt

| # | `id` | Nhóm | Khối hình | Tay | Món ở repo | Phạm vi |
|---|---|---|---|---|---|---|
| 1 | `sheet` | Tấm kẹp mép (cả bê hai cạnh vật mỏng) | `slab`, `disc` | một / hai | bảng giá, hoá đơn, biên lai, phiếu ×3, thực đơn, báo, bìa hồ sơ, đĩa bò, đĩa tôm hùm, điện thoại (đưa) | bản đầu |
| 2 | `card` | Tấm nhỏ kẹp đầu ngón | `slab` mỏng | một | thẻ, thẻ phòng, giấy tờ | bản đầu (`pad`) |
| 3 | `pen` | Bút | `rod`/`lathe` mảnh + `tip` | một | bút | bản đầu (dáng) |
| 4 | `chopsticks` | Đũa | hai `rod` mảnh + `tip` | một | đũa | bản đầu (dáng) |
| 5 | `cylinder` | Thân trụ | `lathe`, `rod` | một / hai | chai ×2, bình, bộ đàm, ống nghe ×2 | bản đầu (`wrap`) |
| 6 | `round` | Khối tròn | `ball`, `lathe` ngắn | một | — | để sau |
| 7 | `bowl` | Chén không quai | `lathe` có miệng | một / hai | chén | bản đầu (`side`) |
| 8 | `handle` | Quai | `rod` có khe sau (`path` để sau) | một | túi, cốc bia, vali, vòng chìa | bản đầu (`hook`) |
| 9 | `palmBox` | Hộp cỡ lòng tay | `box` | một | điện thoại | bản đầu |
| 10 | `platform` | Đỡ dưới | `face` | một / hai | khay ×3, chồng khăn, phiếu, sổ tay, đĩa | bản đầu (`palm`) |
| 11 | `hug` | Ôm vào thân | `slab`, `box` to | một | bìa hồ sơ (ôm ngực) | để sau |
| 12 | `clamp` | Ép hai lòng tay | `box` (hai mặt đối) | hai | chồng khăn | để sau |
| 13 | `carry` | Treo | `seats` + thân | một (cánh tay) | túi hiệu | bản đầu |
| 14 | `soft` | Vật mềm | `soft` | một | khăn | để sau |

### Từng nhóm

Ngưỡng là điểm xuất phát, chỉnh ở giai đoạn 4 trên bảng `bang-cam`. "Lựa chọn" là các trường chỗ cầm cảnh khai; thiếu thì
món đặt trước để rig giải, tay dẫn lấy giá trị in đậm (mục [5](#lựa-chọn-cảnh-không-khai)). **Hướng mặc định** là hướng món
khi mốc món không khai `face`/`up` (món đặt trước), hay ý định cổ tay khi `hold` không khai (tay dẫn).

#### 1. `sheet` — tấm kẹp mép (bản đầu)

- **Cần**: `slab` hay `disc` có bề dày `t ≤ 0,45 · A`; cạnh được cầm dài `≥ 0,6 · W`.
- **Chỗ tiếp xúc**: một điểm trên cạnh, ở `along`; tâm nắm thụt vào trong tấm `d`, giữa bề dày. `d` cố định ở mọi cỡ tay,
  theo fixture của biến thể: `pinch` 2,5, `flat` 5, `rim` 1.
- **Biến thể**:
  - **`pinch`** (fixture `bang-gia#doc`, `frame: "nf"`): bốn ngón khép gập chừng 40° đè mặt kia, ngón cái đè mặt có ngón cái
    `F`; `n = 0,7654 · F + 0,6436 · f`, `f` = hướng vào trong tấm (`−m`) quay `slant` trong mặt tấm. Dáng mở → đóng: `sheet`
    với gốc ngón gập 30° → `sheet`, theo `t` trong `[0,05 · A, 0,45 · A]` (tấm dày thì mở).
  - `flat` (fixture `phieu-lien#cam`, `thuc-don#khoe`; `frame: "nf"`): lòng tay và ngón áp phẳng mặt kia, ngón cái vắt qua
    mép đè mặt `F`; `n = F`, `f = −m` quay `slant`. Dáng `edge`.
  - `rim` (fixture `tom-hum#nhac`, `bo-da#bung`, `bao#doc`; `frame: "nt"`): lòng tay áp mép, ngón cái trên mặt `F`, ngón dưới
    mặt kia — bê vành đĩa, cầm hai bên tờ báo; `n = −m`, `t = F`, ngón chúc `slant` quanh `m`. Dáng `edge` phải cuộn ngón qua mép theo bề dày tấm
    (giai đoạn 4).
- **Vai trò**: ngón cái `press` (mặt `F`); trỏ–út `press` (mặt kia; `flat` thì `support`); lòng tay `free` (`flat`, `rim`:
  `press`).
- **Lựa chọn**: `edge` (bốn cạnh; đĩa: góc, lưới 30°); `along` ∈ [0, 1], **0,5**; `thumb` — mặt có ngón cái: tấm đứng
  {`front`, `back`}, tấm nằm {`top`, `bottom`}; đổi bằng quay π quanh `m` (giữ chiều bàn tay). Mặc định (tay dẫn): mặt của
  tấm quay về người cầm ở mốc bắt đầu lần cầm — tấm đứng `front` hay `back` theo `F · (hướng tới mặt người cầm) > 0`, tấm
  nằm `top`; món đặt trước đã giải. `variant` ∈
  {**`pinch`**, `flat`, `rim`}; `slant` ∈ [−60°, 60°] (`pinch`), [−90°, 90°] (`flat`; ±90 là ngón chạy dọc mép), [−45°, 45°]
  (`rim`).
- **Tay**: một hay hai. Tay phụ mặc định: cùng nhóm, cùng biến thể, cùng `thumb`, cạnh đối diện, cùng `along`. Hai tay
  cùng cạnh (hoá đơn hai tay cầm mép dưới) thì cảnh khai chỗ cầm từng tay.
- **Hướng mặc định**: `face: { axis: <front>, toward: "holderFace" }`, `roll: { axis: <top>, toward: "up" }`.

#### 2. `card` — tấm nhỏ kẹp đầu ngón (bản đầu: `pad`)

- **Cần**: `slab` có `t ≤ 0,2 · W`. Không giới hạn cỡ tấm.
- **Chỗ tiếp xúc**: điểm trên cạnh, thụt vào `0,15 · W`; đệm ngón cái và đệm ngón trỏ kẹp hai mặt. Khung chuẩn từ fixture
  `the-phong#kep` (phía `thumb` lấy theo mặt mà đệm ngón cái chạm ở kiểu ấy, đo ở giai đoạn 4); `thumb` kia là quay π quanh `m`.
- **Biến thể**: **`pad`** (dáng `pinch`, Feix #9). Để sau: `lateral` (ngón cái ép tấm lên cạnh ngón trỏ, #16), `between`
  (kẹp giữa trỏ và giữa, #23).
- **Vai trò** (`pad`): cái, trỏ `tip`; giữa–út `free`.
- **Lựa chọn**: `edge`, `along` (**0,5**), `thumb` (như `sheet`), `slant` ∈ [−45°, 45°].
- **Tay**: một. **Hướng mặc định**: như `sheet`.

#### 3. `pen` — bút (bản đầu: cầm; `write` để sau)

- **Cần**: `rod` hay `lathe`, bán kính `≤ 0,12 · W`, dài `≥ 1,2 · W`, mốc `tip` có `dir`.
- **Chỗ tiếp xúc**: điểm trên trục cách `tip` một khoảng `along` ([0,15, 0,45] chiều dài, **0,3**), khung chuẩn từ fixture
  `but#viet`. Lăn quanh trục cố định `0` (que tròn; kẹp bút là `detail`).
- **Dáng**: `tripod` (mới, soạn tay — mục [6](#6-ngón)). **Vai trò**: cái, trỏ `press`; giữa `support`; áp út, út `free`.
- **Tay**: một. Đường đi của ngòi do cảnh khai (`point: "item:tip"` theo mốc), như nay.

#### 4. `chopsticks` — đũa (bản đầu: cầm; `pick` để sau)

- **Cần**: hai `rod` mảnh (`r ≤ 0,15 · W`) trong cùng phần, gần song song (lệch `≤ 15°`), mốc `tip`. Que đũa `r 1,5` ứng với
  `0,11 · W` ở tay nhỏ nhất.
- **Chỗ tiếp xúc**: khung chuẩn từ fixture `dua#cam`, dời dọc que `along` (từ đầu cầm, [0,15, 0,45], **0,25**).
- **Dáng**: `chopsticks` (mới, soạn tay). **Vai trò**: cái, trỏ `press`; giữa, áp út `support`; út `free`.
- **Tay**: một.

#### 5. `cylinder` — thân trụ (bản đầu: `wrap`)

- **Cần**: `lathe` hay `rod` có `r ∈ [0,06 · W, 0,95 · W]` (với `rod` xét cả `R ≤ 0,95 · W`). **Đoạn bám liền** quanh chỗ
  tiếp xúc — các khối hình trụ nối nhau, cắt ở phần `grip: false` — dài `≥ 0,6 · W` (ba ngón trỏ, giữa, áp út), và tâm nắm
  cách phần `grip: false` `≥ 0,3 · W`. Cổ `chai-dia` (r 4,4, dài 7,5) qua vì nối với vai. Từ `0,8 · W` thì cảnh báo `size`
  (nắm không kín).
- **Chỗ tiếp xúc** (`frame: "nt"`, fixture `chai-dia#co` — kiểu này nắm ở mốc `shoulder`, tức **vai**): điểm trên trục ở
  `along`, quay `around` (θ) quanh trục; lòng tay `n = −ρ(θ)` áp mặt trụ (tâm nắm dời ra cho da lòng tay vừa chạm mặt,
  theo `r(s)`, dùng độ lệch da của mục 6); phía ngón cái `t = ±a`.
- **Dáng mở → đóng**: `grip` với ngón mở bớt (`r = 0,95 · W`) → `fist` (`r = 0,06 · W`), theo `R` (thanh dẹt nắm theo cạnh
  dài). `rod` có `r < 0,2 · W` cần dáng khép hơn `fist`; đặt ở giai đoạn 4 theo ảnh.
- **Vai trò**: mọi ngón `wrap`, lòng tay `press`. Để sau: `index` (ngón trỏ duỗi dọc thân, #17).
- **Lựa chọn**: `part` (phần có khối trụ, bám được), `along` ∈ {`low`, **`mid`**, `high`} hay số, `around` ∈ [0°, 360°),
  `thumb` ∈ {**`up`**, `down`}.
- **Tay**: một hay hai. Tay phụ mặc định: `platform` ở mặt đáy (rót có tay đỡ)
- **Hướng mặc định**: `up: <top>`. Rót không có chỗ nắm riêng: mốc món đặt miệng chai, nghiêng trục miệng về cốc; cảnh khai
  `part` (thân hay vai), không khai thì rig giải trên chai đã đứng yên (mục [5](#lựa-chọn-cảnh-không-khai)).
- Ống nghe máy bàn, máy tường, bộ đàm: `rod` của tay cầm, ý định loa vào tai ở cảnh.

#### 6. `round` — khối tròn (để sau)

`ball`, hay `lathe` ngắn béo; biến thể `palm` (ôm cả lòng, #11; dáng mới `ball`) và `top` (đầu ngón úp từ trên, #12 — núm,
nắp; dáng mới `claw`). Lựa chọn: hướng tiếp cận, biến thể. Một tay.

#### 7. `bowl` — chén không quai (bản đầu: `side`)

- **Cần**: `lathe` có miệng, bán kính lớn nhất `≤ 1,3 · W`.
- **Biến thể**: **`side`** (fixture `chen#kep`: lòng tay ôm thân, dáng `clasp`, `frame: "nt"` như trụ, phía ngón cái về
  miệng). Để sau: `base` (đáy trên đầu ngón, ngón cái gác miệng — chén cơm kiểu Nhật).
- **Vai trò**: cái, trỏ, giữa `wrap`; áp út, út `support`.
- **Lựa chọn**: `around`, `along` (độ cao trên thành, **`low`**).
- **Tay**: một hay hai; tay phụ mặc định `platform` dưới đáy. **Hướng mặc định**: `up` = trục miệng (một nguồn: miệng suy
  từ `wall`).

#### 8. `handle` — quai (bản đầu: `hook`)

- **Cần**: `rod` có `R ≤ 0,3 · W`, đoạn bám dài `≥ 0,8 · W`, khe sau thanh (từ thanh tới phần còn lại của món, theo hướng ngón
  luồn) `≥ 2 ×` bán kính ngón. Quai cong (`path`, cốc bia) để sau.
- **Biến thể**: **`hook`** (fixture `tui#xach`: móc bốn ngón, dáng `hook`). Để sau: `wrap` (nắm kín), `ring` (luồn ngón trỏ).
- **Chỗ tiếp xúc** (`frame: "nf"`): điểm trên thanh ở `along`; ngón vuông góc thanh, luồn qua khe.
- **Vai trò** (`hook`): trỏ–út `wrap`, cái `free`.
- **Lựa chọn**: `part`, `along` (**0,5**). **Tay**: một. **Hướng mặc định**: `up: <top>`.

#### 9. `palmBox` — hộp cỡ lòng tay (bản đầu)

- **Cần**: `box` có hai mặt dài song song cách nhau `w ∈ [0,7 · W, 1,9 · W]`, dày `≤ 0,6 · W`, dài `≥ 1,2 · W`.
- **Chỗ tiếp xúc** (`frame: "nf"`, fixture `dien-thoai#doc`): lòng tay áp mặt sau (`n` = pháp tuyến mặt trước), ngón cái
  dựng dọc một cạnh dài, đầu các ngón tì cạnh dài kia: `f` từ cạnh có ngón cái sang cạnh kia; điểm ở `along` dọc cạnh dài;
  lòng tay chếch `tilt` quanh trục dọc máy.
- **Dáng mở → đóng**: `span` → `span` khép bớt, theo `w`.
- **Vai trò**: cái `press` (cạnh), trỏ–áp út `tip` (cạnh kia), út `support`, lòng tay `press`.
- **Lựa chọn**: `thumb` ∈ {`left`, `right`} (cạnh dài có ngón cái; mặc định **cùng bên với tay**), `along` (**0,4**), `tilt`
  ∈ [0°, 25°] (**20°**).
- **Tay**: một; hai tay ôm trước ngực thì tay phụ mặc định `platform` ở mặt sau.
- **Hướng mặc định**: `face: { axis: <front>, toward: "holderFace" }`. Áp tai: cùng nhóm, cùng chỗ bám, ý định màn vào má
  (`toward: { mark: "head" }`), cảnh đặt tay cạnh tai.

#### 10. `platform` — đỡ dưới (bản đầu: `palm`)

- **Cần**: một `face` có diện tích `≥ 0,4 · W × 0,6 · L`.
- **Chỗ tiếp xúc** (`frame: "nf"`, fixture `khay#bung`, `phieu#do`): giữa lòng tay áp mặt (`n` ngược pháp tuyến ngoài của
  mặt). Tay đến từ cạnh `edge`, hướng ngón `ψ` đo từ pháp tuyến trong của cạnh ấy (`0` = ngón chĩa vuông góc vào trong mặt,
  `±90°` = ngón chạy dọc cạnh). `inset` là khoảng từ cạnh tới tâm nắm theo pháp tuyến trong; mặc định vừa đủ cho bàn tay
  nằm trọn trong mặt: `inset₀(ψ) = ½ · (W · |sin ψ| + P · |cos ψ|)`, `P` dài lòng bàn tay (10,1 · long). Fixture
  `khay#bung` (tay sát vành trái, phải; ngón về phía xa, `ψ = ±90°`) cho `inset₀ = W / 2` ≈ 6,7 ở cỡ `1,61`, khớp tâm nắm
  cách vành 6 của kiểu cũ (`x = ±40` trên nửa rộng 46).
- **Vai trò**: lòng tay `press`, ngón `support`, ngón cái `free`. Để sau: `tips` (đầu ngón đỡ, khay cao ngang vai).
- **Lựa chọn**: mặt (mặc định mặt có pháp tuyến gần `−top`), `edge`, `along`, `ψ` (lưới 45°), `inset` (quanh `inset₀`).
- **Tay**: một hay hai; tay phụ mặc định cùng nhóm, cạnh đối diện. **Hướng mặc định**: trục ngược pháp tuyến mặt đỡ hướng
  lên (khay: `top` lên; phiếu đỡ mặt sau: `front` lên).

#### 11. `hug` — ôm vào thân (để sau)

`slab` hay `box` có mặt lớn `≥ 2 · W × 2 · W`; mặt lớn áp ngực hay sườn, cẳng tay vắt ngang mặt kia, bàn tay khum mép xa.
Món gắn vào **cẳng tay** — cần thêm chỗ gắn cẳng tay ở rig (như `carry` gắn khuỷu, `attach.ts:422`).

#### 12. `clamp` — ép hai lòng tay (để sau)

`box` có hai mặt đối cách `w ∈ [1,2 · W, 2 ×` bề rộng vai`]`; hai tay bắt buộc; hai lòng tay áp hai mặt cùng độ cao, dáng
`flat`.

#### 13. `carry` — treo (bản đầu)

Giữ nguyên hành vi của kiểu treo ([01](01-rig.md#kiểu-treo), `heldCarry.ts`): cảnh khai `group: "carry", on`, món khai `seats`
và `shape` (thân). Không có lòng tay, ngón, ý định; bàn tay theo hành động. `yaw` chuyển từ món lên cảnh. **Để sau**: thay
`seats` bằng khai hình quai (phần `quai`, khối `path`) và để rig chọn điểm treo trên quai theo `on` (mặt trong quai cho
khuỷu, đỉnh quai cho vai) — sạch hơn vì không còn mốc riêng cho từng cách treo.

#### 14. `soft` — vật mềm (để sau)

Món `soft: true`, hình tĩnh. Kẹp góc dùng `card` `pad`, vò trong nắm dùng `round` `palm`.

### Hai lớp không phải nhóm cầm (để sau)

| Lớp | Động tác | Khai ở cảnh | Rig cần thêm |
|---|---|---|---|
| **Không cầm** | `press` (úp tay ép phiếu), `push` (đẩy khay trượt), `tap` (bấm chuông, bấm màn bằng tay kia), `point` (chỉ) | Mốc `world.hands` như nay (`at`/`to`, `palm`, dáng), cộng `contact: { item, mark?, mode }` | Món không gắn vào tay (trừ `push`). `check` đo khe lòng tay (`press`), đầu ngón trỏ (`tap`) tới món, như dòng `(bấm)` của `cam-do`. `push`: món dời `Δ = cổ tay(t) − cổ tay(t₀)` chiếu lên mặt món nằm, `cổ tay(t₀)` lấy từ tư thế ở mốc (tất định), chỗ món lúc `t` là chỗ `extra` đặt cộng `Δ`. Lau cần `soft` |
| **Trong tay** | `write` (nhóm `pen`), `pick` (nhóm `chopsticks`) | Mốc tay cầm thêm `write: { size, rate }` hay `pick: 0..1` (nội suy như `w`) | `write`: điểm `item:tip` cộng một đường nguệch ngoạc tất định theo `t` trên mặt giấy. `pick`: món khai `joints.<que>`, lưới tách que trên thành nút có tên; rig xoay nút ấy và cộng gập vào gốc ngón trỏ, giữa |

Bản đầu: các động tác này đi đường hiện có (đích, dáng, hành động như `cam-dt-3d`).

## 4. Schema cảnh

Hai đường, theo món có mốc ở `items` hay không:

| Đường | Khi nào | Cảnh khai | Rig tính |
|---|---|---|---|
| **Món đặt trước** | Món có mốc ở `items` | Chỗ, hướng món (`items`); chỗ cầm từng tay (`hold`) | Bàn tay trên chỗ cầm, cổ tay, khuỷu, ngón |
| **Tay dẫn** | Món không có mốc ở `items` (bút, đũa, điện thoại áp tai) | Đích bàn tay như nay (`to`/`at`, `offset`, `point`); chỗ cầm; ý định hướng món | Món theo bàn tay; cổ tay cố đạt ý định trong giới hạn khớp |

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
  ease: EaseSchema.optional(),
});
```

- **Hướng món là luật cứng**: `face`, `up`, `roll` cho trọn phép quay của món; bàn tay theo món. Không khai thì lấy hướng mặc
  định của nhóm tay đang cầm (mục 3: tấm `front → holderFace`, `roll: top → up`; trụ, chén, quai `up: top`; đỡ dưới: mặt đỡ
  ngửa). Hai tay cầm khác nhóm thì lấy nhóm của tay phải. Thiếu trục nào lấy trục ấy của nhóm. Đích của trục phụ lệch đích
  của trục chính dưới 18° (|cos| > 0,95) thì `check` lỗi `item`, dòng báo gợi `roll` khác; rig không tự đổi.
- **Hệ trục**: vectơ của `toward` và `up` ở hệ thân người cầm `[tiến, y xuống, ngang phải]`, như `HoldTarget.v`
  (`heldItem.ts:408`); `at` là thế giới rig.
- **`holderFace`** là hướng từ chỗ món tới giữa hai mắt người cầm, góc ngẩng kẹp ở 45° so với mặt ngang hệ thân (người chibi,
  món ngang ngực mà không kẹp thì mặt bảng gần ngửa); nghiêng khác thì `tilt`.
- **Giữa hai mốc**: chỗ món hoà theo `ease` trong khung mốc thân ở chính `t` (người cúi thì món đi theo người), hướng món hoà
  cầu (`slerp`) giữa hai phép quay giải ở hai mốc. Đích của `face` (người khác, mốc thân) đọc ở `t`. Trước mốc món đầu và sau
  mốc cuối của một lần cầm, món giữ ở mốc gần nhất (kẹp như `world.hands`).
- Mốc món chỉ hợp lệ khi có tay cầm món ấy ở `t` (`check` lỗi `ref`). Món rời tay mà cảnh còn cần thì là đồ của cảnh, như nay.

### Chỗ cầm (`cast[].world.hands[].hold`)

```ts
const SceneHoldSchema = z.union([
  z.string().regex(/^[^@#]+@[a-zA-Z]+$/),          // viết tắt "món@nhóm": mọi lựa chọn rig giải hay lấy mặc định
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
    variant: z.string().optional(),
    // chỉ đường tay dẫn — ý định như rig 7.x
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

- **Món đặt trước**: mốc tay có `hold` không khai đích (`to`, `at`, `offset`, `point`), không khai ý định (`face`, `up`, `roll`,
  `keep`) — chỗ bàn tay suy từ món. Được khai `elbow` để đè hướng khuỷu tự nhiên. Mỗi tay khai chỗ cầm của nó; `both` là viết
  tắt cho tay kia. `both` mà tay kia cũng có `hold` ở cùng `t` là lỗi `choice`. Tay có `both` giải trước (lead), tay phụ giải
  sau với số hạng lấn của tay lead.
- **Tay trượt**: các trường số (`along`, `slant`, `around`, `tilt`, `psi`, `inset`) hoà theo `ease` giữa hai mốc tay của cùng lần
  cầm — tay trượt dọc cạnh, dọc cán, xoay quanh trụ. **Một lần cầm** là chuỗi mốc cùng món, cùng nhóm, cùng các trường rời (`part`,
  `edge`, `thumb`, `variant`), không `regrip`; đổi trường rời là lần cầm mới, liên kết tay ↔ món hoà trong `HOLD_BLEND`.
- **Vị trí dọc cạnh**: tên (`corner` ≈ nửa bàn tay từ đầu thấp, `low` 0,25, `mid` 0,5, `high` 0,75) hay tỉ lệ 0–1 từ đầu thấp. Đầu thấp
  của cạnh xét một lần ở mốc bắt đầu lần cầm: cạnh dốc ≥ 30° so với mặt ngang thì là đầu dưới; cạnh gần ngang thì là đầu về
  phía tay ấy (ngang hệ thân), nên cùng tên ở hai tay của một cạnh ngang cho vị trí đối xứng. Giữ nguyên tới hết lần cầm dù
  món quay.
- **Đổi tay**, **đưa người khác**: mốc món đổi `cast` khi tay người nhận đã cầm; tay người đưa `hold: null` sau đó. Tay dẫn giữ luật
  hiện có (`holdRoles`, `act3.ts:1251`).
- **Buông**: `hold: null`. `right: null` vẫn chỉ thả đích. `point: "item:<mốc>"` của tay dẫn giữ nguyên.
- Đường `"món#kiểu"` bị xoá: chuỗi có `#` là lỗi kèm hướng dẫn chuyển.

### Ví dụ

```jsonc
// đọc, bảng giá ngang ngực, mặt về mặt người đọc (`holderFace` kẹp ngẩng 45°); tay phải cạnh hông phải, một phần ba dưới
"items": [{ "t": 1.0, "cast": "takumi", "item": "bang-gia", "to": "chest", "offset": [30, 5, 0],
            "face": { "axis": "front", "toward": "holderFace" } }],
"hands": [{ "t": 1.0, "cast": "takumi",
            "right": { "hold": { "item": "bang-gia", "group": "sheet", "edge": "right", "along": 0.33, "thumb": "front" } } }]

// đọc, bảng giá ngang mặt, song song với mặt; tay phải cạnh dưới
"items": [{ "t": 1.0, "cast": "takumi", "item": "bang-gia", "to": "eye", "offset": [32, 0, 0],
            "face": { "axis": "front", "toward": "back" }, "roll": { "axis": "top", "toward": "up" } }],
"hands": [{ "t": 1.0, "cast": "takumi", "right": { "hold": { "item": "bang-gia", "group": "sheet", "edge": "bottom" } } }]
//   (món lồng vào đầu thì `check` nhóm `clash` bắt; khe tối thiểu giữa món và đầu do cảnh lo qua `offset`)

// khoe hai tay, hai cạnh bên (cùng một mốc món: mặt bảng về khách)
"items": [{ "t": 2.0, "cast": "takumi", "item": "bang-gia", "to": "chest", "offset": [35, 0, 0],
            "face": { "axis": "front", "toward": { "cast": "khach" } }, "roll": { "axis": "top", "toward": "up" } }],
"hands": [{ "t": 2.0, "cast": "takumi",
            "right": { "hold": { "item": "bang-gia", "group": "sheet", "edge": "left" } },
            "left":  { "hold": { "item": "bang-gia", "group": "sheet", "edge": "right" } } }]
//   (mặt trước quay ra khách nên cạnh phải của bảng nằm bên tay trái người cầm)

// khoe, một tay đỡ cạnh dưới, một tay giữ cạnh trên — cùng mốc món, chỉ khác dòng tay
"hands": [{ "t": 2.0, "cast": "takumi",
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
"items": [{ "t": 4.0, "cast": "yota", "item": "chai-dia", "point": "mouth", "at": [-300, -150, 575],
            "face": { "axis": "mouth", "toward": [1, 0.6, 0.58] } }],
"hands": [{ "t": 4.0, "cast": "yota",
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

`itemPose(t)`: món đặt trước thì từ hai mốc món kề `t` (mục 4); tay dẫn thì `bàn tay(t) · GripFrame` như nay.

### Bàn tay từ món

`graspFrame` dựng chỗ tiếp xúc của nhóm (`contact` ở mục 3) trên khối hình theo chỗ cầm ở `t`, ra `GripFrame` (món trong khung
bàn tay). Bàn tay `= itemPose(t) · GripFrame⁻¹`: cổ tay có chỗ và hướng cố định. Cánh tay còn đúng một bậc tự do: góc xoay
khuỷu `φ` quanh trục vai → cổ tay. Với tay của món đặt trước, `act3` nhận `Wp`, `Rw`, `φ` đã giải làm cứng: không `aimWrist`,
không dò xoay khuỷu, không `HOLD_SLEW`.

### Khuỷu tự nhiên

```
E(φ) = ½ (turn/90)² + (bend/AIM_BEND)² + ½ (dev/AIM_DEV)²         cổ tay ứng với cẳng tay ở φ
     + 10 · Σ (vượt giới hạn / giới hạn)²                           phạt nặng phần vượt `AIM_BEND`, `AIM_DEV`, xoay cẳng tay
     + w_down · (1 − cos(φ − φ₀)) / 2                               khuỷu thõng: φ₀ từ `REACH_ELBOW` hay `elbow` của mốc tay
     + w_body · Σ (lấn / r_tay)²                                    bắp tay, cẳng tay lấn vào thân (`across`, `front` của
                                                                    `markShape`, act3.ts:836), đầu, tay kia
     + w_cont · ((φ − φ_trước) / 30°)²                              liền với mẫu trước của lần cầm
```

- **`φ`** quanh trục vai → cổ tay: `0` là khuỷu thõng (hình chiếu của hướng xuống lên mặt phẳng vuông góc trục), dương ra
  ngoài phía tay ấy; trục gần thẳng đứng thì gốc lấy hình chiếu của `−tiến`. `elbow` của mốc tay đổi ra `φ₀` bằng cùng phép
  chiếu.
- Hằng số: `w_down 0,3`, `w_body 10`, `w_cont 2` (khuỷu của tay trượt đổi ≤ 2,5° mỗi mẫu).
- **`w_body`** lấy mẫu dọc tay từ `1,5 · cap` của vai trở đi (`cap` là bán kính nắp vai, `ArmRoom.cap`). Lấn bắp tay trừ mức
  nền của tay buông thõng ở cùng phần dọc bắp tay (đo một lần mỗi người, mỗi tư thế thân; áo có thể tới 4,4).
- Tìm `φ`: lưới 10° cả vòng, rồi chia đôi `±5°`, `±2,5°` (40 lần thử). Mỗi lần thử chỉ dựng hai đoạn tay và đọc góc cổ tay,
  không giải lại cả người: 0,008 ms một lần thử, 0,38 ms giải `φ` một mẫu.
- **Tất định**: mỗi lần cầm giải `φ` ở các mẫu cách `HOLD_SLEW_STEP` (`heldItem.ts:460`) tính từ đầu lần cầm, `φ_trước` là mẫu
  liền trước; `φ(t)` hoà giữa hai mẫu kề. Mẫu đầu của một lần cầm lấy `φ_trước` là mẫu cuối của lần cầm liền trước trên cùng
  tay (nếu có); lần cầm đầu tiên thì bỏ số hạng. Nhớ theo runtime (`WeakMap<SceneRuntime, …>` cạnh `keyPose`, `scene.ts:1549`); Remotion
  vẽ khung nhảy cóc thì tính lại chuỗi từ đầu lần cầm, ra cùng số.
- **Ngoài tầm với** (`|vai → cổ tay| > l₁ + l₂`): cánh tay duỗi thẳng về cổ tay đã giải, bàn tay vẽ ở đầu cẳng tay với hướng
  `Rw` đã giải và dáng ngón của lần cầm (ngón không `heldFit` lại), món vẫn ở chỗ khai — khe lộ trên hình, `check` báo `reach`
  với khe. Rig không kéo món lại gần.
- **Cổ tay vượt giới hạn** ở `φ` tốt nhất: rig giữ kẹp hiện có (xoay cẳng tay ±90°, ±`AIM_BEND`, ±`AIM_DEV`); bàn tay vẽ
  theo kẹp, khuỷu giữ `φ` đã giải, món vẫn ở chỗ khai. `check` báo `wrist` kèm độ vượt và độ lệch giữa bàn tay và chỗ cầm.
- Hai tay giải trên cùng `itemPose`: tay có `both` (lead) trước, tay kia sau; không có `both` thì tay phải trước. Tay giải sau
  tính tay đã đặt vào số hạng lấn.
- Tay dẫn giữ đường giải hiện có (`aimWrist`, `HOLD_SLEW`, dò khuỷu `act3.ts:1718`–`:1764`).

### Lựa chọn cảnh không khai

Cảnh thường khai đủ chỗ cầm. Thiếu trường nào:

- **Món đặt trước**: rig giải **một lần cho mỗi lần cầm**, ở mốc bắt đầu, trên món đã đứng yên ở chỗ khai. Hai bậc: giải rời
  trước (`edge`, `thumb`, `variant`, `part`) với trường liên tục ở mặc định; rồi lưới liên tục chỉ quanh ứng viên rời tốt
  nhất (`along` 3 điểm, `slant` 3, `around` 12, `tilt` 2, `psi` 8). `slant` lấy ba điểm `−½`, `0`, `+½` miền của biến thể
  (`pinch` ±30°, `flat` ±45°, `rim` ±22,5°). Giá của một ứng viên là `min_φ E(φ)` cộng `(khe tầm với / AIM_GAP)²`, cộng ở mốc
  bắt đầu và các mốc món trong 1,5 s sau (tối đa 4, mốc sau trọng số 0,5); lệch khỏi mặc định nhóm cộng `0,05 · (số trường
  lệch mặc định) / (số trường thiếu có mặc định)`. Lấy ứng viên rẻ nhất; hoà thì theo thứ tự ứng viên: `part`, khối hình
  theo `FeatureKind`, `edge`, `thumb`, `variant`, `along`, `slant`, rồi `around`, `tilt`, `psi` (rời theo thứ tự miền khai,
  liên tục tăng dần). Giải 3–18 ứng viên mất 3–9 ms.
- **`variant`** của tấm luôn có `flat` và `rim` trong miền giải: `pinch` ở cạnh dưới gãy cổ tay (bend 51°, dev 39°), `rim`
  đỡ được. Dáng `rim` cuộn ngón theo bề dày làm ở giai đoạn 4.
- **Tay dẫn**: lấy mặc định của nhóm (mục 3), không giải; `thumb` của tấm theo mặt quay về người cầm ở mốc bắt đầu lần cầm
  (mục 3, nhóm 1).

### Đổi lần cầm

Ở ranh giới hai lần cầm, liên kết hoà từ cũ sang mới trong `HOLD_BLEND` (`ReachHold.from` mang **nghiệm** cũ). `mixRotation`
(`heldItem.ts:482`) đi đường ngắn nhất; hai liên kết lệch đúng nửa vòng (đổi `thumb` của tấm là quay π quanh `m`) thì nghiệm mang
`path`: hoà quanh `m`, chiều quay sao cho bàn tay vòng qua mép ngoài cạnh, không quét xuyên tấm.

### Báo

`AimReport.hold` (`act3.ts:1116`) thêm `grasp`, bỏ `alts` theo tên kiểu cầm:

```ts
grasp: {
  item: string; group: GroupId; mode: "item" | "hand"; t0: number;
  choice: GraspChoice;                               // part, feature, edge, along, thumb, variant, slant, around, tilt, psi, inset
  by: Partial<Record<keyof GraspChoice, "scene" | "rig" | "default">>;
  arm: { phi: number; wrist: { turn: number; bend: number; dev: number; over: number; off: number }; body: number; gap: number };
}
```

`wrist.over` là độ vượt kẹp, `wrist.off` là độ lệch giữa bàn tay vẽ và chỗ cầm (đơn vị rig). `check` (dòng `reach`, `wrist`,
`arm`), `scene_probe` (`world.held.<tay>.grasp`) và MCP đọc nó.

## 6. Ngón

1. **Dáng gốc**: `hoà(open, closed, w)` của biến thể đã chọn, `w` theo số đo của khối hình trong `range` của nhóm (`mixHand`,
   `hand.ts:143`). Tâm nắm đọc từ dáng đã hoà (`handGripOf`, `hand.ts:271`), không từ một tên dáng (`gripCenter`,
   `heldItem.ts:343`).
2. **Ngón ôm** (`heldFit`, `heldFit.ts:267`) nhận `roles` thay cho `wrap`:

| Vai trò | `heldFit` |
|---|---|
| `press` (đè một mặt) | Cuộn tới chạm, tối đa `40°` mỗi đốt |
| `wrap` (ôm quanh) | Như `wrap` nay: cuộn tới chạm rồi đốt ngọn cuộn tiếp qua cạnh (`heldFit.ts:373`–`:377`), tối đa `HELD_FIT.curl` |
| `tip` (chạm bằng đầu ngón) | Chỉ đốt ngọn cuộn, đốt gốc giữ dáng; tối đa `30°` |
| `support` (đỡ) | Không cuộn; chỉ gỡ khi lún |
| `free` (tự do) | Không cuộn; hoà nửa về dáng nghỉ (`HAND_RELAXED`, `hand.ts:23`) rồi gỡ khi lún |
| `extend` (duỗi) | Không cuộn; gỡ khi lún chỉ bằng cách mở |

3. **Tự hiệu chỉnh da.** `heldFit` nhắm khe `HELD_FIT.touch` (`−0,15`) trên nang **chưa phình** (`pieceRadius`,
   `heldFit.ts:209`), trong khi da ở khớp lồi ra ngoài nang ấy; đo trên da thì ngón vừa chạm đã lún chừng 0,5. Bản mới: với
   mỗi lần cầm, `heldFit` đo một lần độ lồi da `δ` của từng đốt ở dáng gốc (khoảng lớn nhất từ đỉnh da có trọng số lớn nhất ở
   đốt ấy tới mặt nang của đốt, `handSkin`, `handMesh.ts:287`) và nhắm `touch` trên nang bán kính `r + δ`. Ngón ôm và `check`
   cùng đo một mặt da. Cùng `δ` ấy dùng khi đặt lòng tay lên mặt trụ, mặt tấm (`contact`).
4. **Bút, đũa** có dáng soạn tay (`tripod`, `chopsticks`, thêm vào `HAND_POSES`, `hand.ts:31`): hai đốt mỗi ngón không ôm theo
   que mảnh bằng cách cuộn tới chạm, nên vai trò ở đây là `press`/`support` với tầm cuộn nhỏ (`≤ 15°`) — chỉ để khép khe và gỡ
   lún. Viết, gắp là động tác (để sau).
5. **Ngón hoà khi đổi lần cầm**: trong `HOLD_BLEND` dáng gốc hoà từ dáng cũ (nay đổi ngay ở mốc).
6. **Rẻ hơn**: `heldFit` đo 1,75–4,16 ms một bàn tay một khung (2026-10-19, cỡ `1,61`: `bang-gia#doc` 1,75, `tom-hum#nhac`
   2,66, `dien-thoai#doc` 2,84, `chai-dia#co` 4,16) và đang chạy mỗi khung cho mọi tay cầm (`world.ts:386`–`:389`,
   `attach.ts:163`). Tay chính trong một lần cầm (ngoài quãng hoà) có liên kết cố định nên kết quả nhớ theo lần cầm. Tay phụ
   bản đầu vẫn tính mỗi khung; nhớ theo liên kết lượng tử hoá để sau.

## 7. Luật `check` nhóm `held`

| | Luật | Đổi gì |
|---|---|---|
| Giữ | `pierce` | Trục nang ngón, lòng tay vào trong hình quá `HELD_PIERCE_FIT` (`heldAudit.ts:36`) — bắt được ngón cắt qua tấm mỏng |
| Giữ | `up`, `face` (tay dẫn), `jump`, `seat`, `body`, cầm món không ai `provide` | Đọc `AimReport` như nay; dòng báo trỏ về **chỗ cầm và hướng món** (của cảnh hay của rig), không về `held/<món>.json#kiểu`. `jump` thêm loại "đổi chỗ cầm" giữa hai lần cầm cùng món |
| Đổi | `reach` | Món đặt trước: tay duỗi hết vẫn không tới chỗ cầm — lỗi, nêu khe và mốc món. Tay dẫn: như nay |
| Thêm | `wrist` | Món đặt trước: ở khuỷu tốt nhất cổ tay vẫn vượt `AIM_BEND`, `AIM_DEV` hay giới hạn xoay cẳng tay — lỗi, kèm độ vượt và độ lệch bàn tay – chỗ cầm; trong `5°` sát giới hạn — cảnh báo. Dòng báo gợi đổi `edge`/`thumb` hay hướng món |
| Thêm | `arm` | Bắp tay, cẳng tay lấn vào thân, đầu hay tay kia quá `0,3 · r_tay` |
| Đổi | `wrap` → `role` | Ngón có vai trò `press`/`wrap`/`tip` mà hở quá `HELD_WRAP` (`heldAudit.ts:40`), đo trên da |
| Đổi | `loose` | Không vùng da nào của vai trò bắt buộc (`press`, `wrap`, `tip`, lòng tay `press`) chạm món |
| Đổi | `grip` | Tâm nắm đo tới **hình** (`shape`); ngưỡng theo nhóm thay `HELD_PINCHES` (`heldAudit.ts:63`) |
| Thêm | `sink` | Da lún quá `HELD_SINK` — đo trên **da** (dưới). `HELD_SINK = |HELD_FIT.touch| + 0,5` (0,65, chỉnh ở giai đoạn 4), vì `heldFit` đã nhắm trên da (mục 6.3) |
| Thêm | `size` | Khối hình được chọn ngoài dải thoải mái của nhóm với cỡ tay người này (thân `chai-dac-tuyen` `r 13,2` với tay `W 14,7`: `0,90 · W`) — cảnh báo |
| Thêm, lỗi `ref` | `group` | Món không có khối hình nào cho nhóm với cỡ tay của người khai (`resolveScene`, như `checkHolds` `scene.ts:3294`); dòng báo nêu khối hình món có, và phần khác còn vừa nếu có: `` `<món>` phần `than` (r 15) quá tầm nắm của tay `<người>` (0,95 · W = 14,0): khai `part: "vai"` hay hai tay `` |
| Thêm, lỗi `ref` | `choice` | Chỗ cầm không hợp lệ: trường không thuộc nhóm, `edge`/`thumb` không có trên khối hình, `part` không có hay `grip: false`, `along` ngoài 0–1, `both` với nhóm một tay, `both` mà tay kia cũng có `hold` ở cùng `t`, `on`/`yaw` ngoài `carry`, nhóm `later`; món có mốc ở `items` mà mốc tay khai đích (`to`, `at`, `offset`, `point`) hay ý định (`face`, `up`, `roll`, `keep`); mốc món ở `t` không tay nào cầm món ấy |
| Thêm, lỗi `ref` | `item` | Mốc món có đích của trục phụ lệch đích của trục chính dưới 18° (cos tuyệt đối > 0,95): hướng món suy biến; dòng báo gợi `roll` khác, rig không tự đổi |
| Bỏ | `pose`, `drift` | Chỉ còn cho đường cũ (`hold` không qua `held/`, `legacy`) |

### Đo lún trên da

Hiện nay lún đo bằng nang bàn tay đã nới (`handCaps`, `collide.ts:249`; `fitCapsules`, `handMesh.ts:420`): mỗi đỉnh da lòi ra
ngoài nang gần nó thì nang ấy phình tới đỉnh ấy, nên nang là **vỏ bao ngoài** của da. Dải lòng tay phình ở một chỗ (khớp gốc
ngón khi bốn ngón gập 40° của dáng `sheet`) thì cả dải dày lên suốt chiều dài, và lún đo trên nang lớn hơn lún thật của da:
`bang-gia#khoe` báo lún 4,2 khi da chỉ lún 0,48.

Cách mới: đo trên **đỉnh da đang vẽ**. Bàn tay three đã có da dời theo dáng và độ gập thêm (`h.geo.attributes.position`, khung
cổ tay — cùng mảng `handCaps` đọc, `collide.ts:252`), 1 400 đỉnh mỗi bàn tay ở mọi cỡ (450 với `low`; đếm 2026-10-19):

```
skinDepth(pos, piece, IF, shape):         # piece: đốt trọng số lớn nhất của từng đỉnh (một lần mỗi HandSkin)
  for each vertex p:
    d = heldDistance(shape, toItem(IF, p))     # heldFit.ts:90, :103 — gồm cả khối `detail`
    depth = max(depth, −d); gap[piece[p]] = min(gap[piece[p]], d)
  return { depth, piece, gaps }               # gaps theo ngón cho `role`, `loose`
```

Chi phí đo 2026-10-19 (cỡ `1,61`): 0,3–1,7 ms một bàn tay, mỗi `0,1 s` của `check`. `pierce` vẫn đo trên trục nang
(`capsuleClearance`, `heldFit.ts:123`). Hàm thuần đặt ở lõi (`heldFit.ts`), `held.ts:87` gọi nó thay vòng `handCaps`.

## 8. Chuyển đổi

Chuyển một lần, không giữ đường cũ song song ở cảnh (đã chốt). Bảng cho cảnh t02 ở [Phụ lục A](#phụ-lục-a--chuyển-cảnh-t02-tạm).

1. **Nhãn phần ghi thẳng vào `held/` một lần.** Không viết bảng quy tắc theo chỉ số khối trong tool (giòn với `tom-hum` 62
   khối, `khay-suat` 24, `vali` 13). Agent gắn `part`, `detail`, `parts`, `front`, `top`, `seats` vào từng file, soi bằng
   `describe_held` (MCP mới) và `pnpm bang-cam --mon <món>`; `tools/held-moc.mjs` của repo (`pnpm test`) kiểm: mọi phần có tên
   trong `parts` có khối, mốc `front`/`top`/`seats` có thật, khối hình suy ra khớp kỳ vọng ghi trong test của repo (ví dụ
   `dua` có hai `rod`).
2. **Tool `stickman migrate-held`** chỉ lo phần máy làm được: bỏ `grips`; `seats` từ kiểu treo cũ; `touch` chung lên món,
   `touch` riêng (như `self.head` của `tai`) xuống cảnh; với cảnh: mỗi `hold` cũ → `{ item, group, … }` theo bảng ánh xạ kiểu
   cũ → nhóm (Phụ lục A), ý định của kiểu cũ (`holdIntent`, `heldItem.ts:538`) ghi ra khi khác mặc định nhóm (không có thì
   `keep: true`), `both` → `both: true` (cộng đè tay phụ khi khác mặc định). Cảnh cũ đi đường **tay dẫn** (mốc tay giữ đích).
3. **Chỗ cầm tương đương.** Với mỗi lần cầm: dựng liên kết cũ, tìm chỗ cầm của nhóm gần nó nhất (góc quay + khoảng dời nhỏ
   nhất) và **ghi đủ mọi trường** vào cảnh, không để rig giải. In bảng `cảnh · người · tay · t₀ · cũ · chỗ cầm · góc, khoảng lệch
   món trong tay`; lệch quá `5°` hay `1` đơn vị là shot đổi hình, chủ dự án duyệt.
4. **Kiểm.** `stickman check --only ref,held` trên `^t02-`, `pnpm bang-cam` bản mới, `pnpm frames` các shot đổi hình cho chủ dự
   án duyệt. Cảnh nào chuyển sang món đặt trước là việc soạn lại từng cảnh khi chủ dự án muốn, không do tool.

### Thứ gãy ngoài lõi

| Chỗ | Vì sao | Làm gì |
|---|---|---|
| `tools/held-moc.mjs` (repo video), dòng 199–236 | Đọc `spec.grips` (kể kiểu cầm, nhận món treo) | Đọc `seats`, `parts`; kiểm nhãn phần (bước 1) |
| `packages/rig/src/grip.test.ts`, `holdWorld.test.ts`, `core/heldItem.test.ts`, `core/heldFit.test.ts`, `core/heldCarry.test.ts`, `core/heldAudit.test.ts`, `core/holdScene.test.ts` | Dựng món bằng `grips`, `món#kiểu` | Viết lại theo nhóm; fixture `GripFrame` (mục 3) thay so sánh với kiểu cầm |
| Món mẫu lớp chung `apps/studio/public/held/coc.json`, `tui.json` (và `dist/`) | Schema v1 | Chuyển v2 cùng bản phát hành; `schema(held)` của MCP trả món mẫu ấy |
| `GroupSpec.seed` (bản nháp trước) | Trỏ vào kiểu cầm sẽ không còn | Đổi thành `fixture` (mục 3) |
| `src/objects/cam.ts`, `luoi-mon.ts` (repo video) | Đọc mốc, không đọc `grips` | Không đổi |

### `bang-cam` theo nhóm

`bang-cam.mjs` (`packages/cli/scaffold/tools/bang-cam.mjs`) đổi trục từ "món × kiểu × hai cỡ tay" sang **nhóm × món đại diện ×
biến thể × hai cỡ tay**, ba góc như nay:

- Món đại diện: `sheet` — `bang-gia` (`pinch`, `flat`; `thumb` front, back), `hoa-don` (hai tay), `tom-hum` (`rim`); `card` —
  `the-phong`; `pen` — `but`; `chopsticks` — `dua`; `cylinder` — `chai-dia` (thân, vai), `ong-nghe-ban`; `bowl` — `chen`;
  `handle` — `tui`; `palmBox` — `dien-thoai`; `platform` — `khay` (hai tay), `phieu` (một tay); `carry` — `tui-hieu`.
- Mỗi hàng: tư thế đứng chuẩn, món đặt trước ngực theo hướng mặc định của nhóm; thêm hàng mẫu cho `sheet`, `palmBox` (đọc
  ngang ngực, đọc ngang mặt, khoe một tay, khoe hai tay hai cạnh bên, khoe hai tay trên dưới, áp tai).
- Nhãn in lựa chọn, `by`, số đo `held` mới (`lún` trên da, `role`, `size`). `--mon <món>`: mọi nhóm áp được cho món ấy.
- `--so`, `--luu-chuan` giữ nguyên; bảng chuẩn cũ hết hiệu lực, chủ dự án duyệt và lưu chuẩn mới một lần sau chuyển. Bảng chuẩn
  mới cũng là chuẩn so cho fixture của nhóm.

## 9. Kế hoạch code

### Bước 0 — prototype bàn tay từ món (xong)

Prototype ngoài `act3.ts`, trên rig hiện có, không đổi schema; kiểm cơ chế của mục 4–5 và chốt hằng số của mục 5. Gồm
`graspFrame` cho `sheet` (`pinch`, `flat`, `rim`) và `cylinder` `wrap` trên `rod`; bàn tay từ món; khuỷu tự nhiên `E(φ)`;
giải lựa chọn thiếu. Bàn tay vẽ qua đường `act3` thật, mốc tay khai `elbow` để vẽ đúng `φ` đã giải: khuỷu lệch ≤ 0,05, lòng
tay lệch ≤ 0,09° (trừ tay xoay cẳng tay quá 90°, mục 5). Năm ca:

| Ca | Rig chọn | Cổ tay turn / bend / dev |
|---|---|---|
| Đọc ngang ngực | `pinch`, `slant` 30° | −79 / −11 / −2 |
| Đọc ngang mặt | `pinch`, `thumb: front`, `along` 0,25, `slant` −30° | −27,5 / 18 / −2 |
| Khoe hai cạnh bên | `pinch`, `thumb: back` | −42 / 3,5 / −0,6 |
| Khoe dưới và trên | `rim` cả hai tay | phải −103 (vượt) / 12 / −16; trái 5 / 3 / −6 |
| Cán chéo, tay trái trượt | `around` 300° → 30° | trái −51 / 34 / 17 → −79 / 28 / −2 |

Các hằng số ở mục [5](#5-giải-tay-theo-món); độ thụt `d` ở nhóm 1 (mục 3).

### Giai đoạn 3 — lõi (theo thứ tự file)

1. `packages/rig/src/core/heldItem.ts` — `HeldItemSchema` v2 (`part`, `detail`, `parts`, `front`, `top`, `seats`, `touch`; bỏ
   `grips`, `GripSpecSchema`, `GripHandSchema`, `holdRef`, `gripOf`, `gripSpec`, `gripHand`, `heldGrip`), `SceneHoldSchema` v2,
   `holdIntent` theo nhóm; giữ `GripFrame`, `gripPoint`, `mixGrip` (thêm đường hoà quanh trục cho trước), `rotAxis`, schema ý
   định. `ReachHold` mang `grasp`, `support`, `from: { grasp, k }`.
2. `core/heldGeom.ts` (mới) — `itemGeom`: phần, bỏ `detail`, khối hình, miền bám trừ `grip: false`, đoạn bám liền, tên cạnh,
   tên mặt, đầu thấp/cao; `handDims`. Test trên 34 món: khối hình kỳ vọng (biên lai, điện thoại không ra `rod`; đũa hai `rod`;
   đĩa tôm hùm một `lathe`; tay cầm ống nghe `rod`).
3. `core/graspGroups.ts` (mới) — `GroupSpec`, `GRIP_GROUPS` đủ 14 (nhóm để sau là `later`), nhãn, miền, mặc định, hướng mặc
   định, tay phụ mặc định.
4. `core/graspSolve.ts` (mới) — `contact` → `graspFrame` (thay `gripFrame`), bàn tay từ món, khuỷu tự nhiên `E(φ)` và chuỗi mẫu,
   giải lựa chọn thiếu, `GraspReport`. Test: tất định theo thứ tự hỏi khung và giữa hai runtime; tay trái không lật món; fixture
   ra lại trong `1` đơn vị và `5°`; năm ca của bước 0; ngoài tầm với, cổ tay vượt giới hạn.
5. `core/scene.ts` — `items` (schema, `itemAt` theo thang bậc, hoà chỗ trong khung mốc thân, `slerp` hướng); `holdRun` theo
   `runKey` mới, hoà trường số giữa hai mốc tay; `graspAt` nhớ theo runtime; `handAt` dựng `ReachHold` mới (`scene.ts:3128`);
   `checkHolds` (`scene.ts:3294`) báo `group`, `choice`; `sceneHoldProblems` theo `both` mới.
6. `core/act3.ts` — đường món đặt trước: cổ tay từ `graspSolve`, cánh tay theo `φ`; tay dẫn: `holdRoles` đọc `both` của cảnh,
   `leadGrip`, `supportFrom` đọc nghiệm, tay phụ với tới chỗ tiếp xúc của nó (`act3.ts:1412`–`:1464`); ngón theo dáng đã hoà
   thay `HAND_POSES[role.hand.pose]` (`act3.ts:1472`); bỏ `alts` (`act3.ts:1806`–`:1820`); `AimReport.hold.grasp`.
7. `core/heldFit.ts` — `roles`, tầm cuộn theo vai trò, tự hiệu chỉnh `δ`; `skinDepth`.
8. `core/hand.ts` — khung cho dáng mới (`tripod`, `chopsticks`; giá trị soạn ở giai đoạn 4).
9. `src/attach.ts`, `src/world.ts` — `holdGrip`, `fitHolding` (nhớ theo lần cầm), `carry`/`regrip`/`take` theo nghiệm.
10. `core/heldAudit.ts`, `src/held.ts` — luật mới, `skinDepth` thay `handCaps` ở `held.ts:87`; `HeldHand.hold` thành `grasp`.
11. `packages/mcp/server.mjs` — `schema(held)` v2, chuỗi mô tả `held` (`server.mjs:533`), `list(held)` kèm nhóm áp được, tool
    mới `describe_held({ item, ai? })`, `scene_probe` thêm `grasp` (`server.mjs:1363`, `:1406`).
12. `packages/cli` — `stickman migrate-held`, `heldFrame`/`heldOptions` (`lib.mjs:1532`,
    `:1566`), `bang-cam.mjs` bản nhóm; món mẫu lớp chung v2; các test ở bảng "Thứ gãy".
13. Docs — 01 § Kiểu cầm, § Hình va chạm, § Ngón ôm, § Kiểu treo trỏ về đây; 03 § Đồ cầm tay (`items`), § Bảng duyệt; 04;
    05 § Nhóm luật; bản này bỏ chữ "nháp".

Lõi xong khi `sheet` (`pinch`) và `palmBox` chạy đủ hai đường (món đặt trước, tay dẫn): gắn, ngón, khuỷu, `check`, `scene_probe`, `bang-cam`.

### Giai đoạn 4 — từng nhóm

Theo số cặp cảnh–kiểu ở t02 (Phụ lục A); mỗi nhóm: khung chuẩn từ fixture, ngưỡng `needs`, dáng mở/đóng (dáng mới nếu cần),
vai trò, test, hàng `bang-cam` cho chủ dự án duyệt:

1. `palmBox` (34) — gồm áp tai.
2. `carry` (25) — chỉ đổi cách khai (`seats`, `on` ở cảnh); hành vi không đổi.
3. `sheet` (18) — `pinch`, `flat`, `rim`; một và hai tay; đĩa tròn.
4. `cylinder` (11) — `lathe` và `rod` (ống nghe); tay trượt dọc thanh; tay phụ `platform`.
5. `platform` (10) — một và hai tay.
6. `card` (7) — `pad`.
7. `chopsticks` (6) — dáng `chopsticks`.
8. `pen` (4) — dáng `tripod`.
9. `handle` (3) — `hook`.
10. `bowl` (1) — `side`.

Xong mười nhóm thì chuyển cảnh t02 một lần, xoá đường `món#kiểu` cùng bản phát hành (rig `8.0.0`: đổi schema `held/` và
`hold`). Phần "để sau" (mục 1) làm khi có cảnh cần.

## 10. Đã chốt

Chủ dự án duyệt 2026-10-19 và 2026-10-20:

1. **Món đặt trước, tay theo món.** Cảnh khai món ở đâu, quay về đâu và mỗi tay cầm chỗ nào; rig tính bàn tay, cổ tay, ngón và
   khuỷu tự nhiên. Rig không chọn chỗ cầm bằng một hàm chi phí trên bàn tay đã đặt.
2. **Cảnh thường khai đủ chỗ cầm**; thiếu trường nào thì rig tự giải trên món đã đứng yên ở chỗ khai (mục
   [5](#lựa-chọn-cảnh-không-khai)).
3. **Ngoài tầm với thì `check` báo**; rig không kéo món lại gần.
4. **Món và chỗ cầm cùng đi theo thời gian**: mốc món cho món đi, trường số của chỗ cầm hoà giữa hai mốc tay cho tay trượt (cuốc
   đất: tay trượt dọc cán).
5. **Hướng món mặc định theo nhóm** (tấm, thẻ, hộp cỡ lòng tay: mặt trước về mặt người cầm; trụ, chén, quai, đỡ dưới: đứng);
   tay dẫn tắt bằng `keep: true`.
6. **Có viết tắt `"món@nhóm"`**.
7. **Món to so với tay**: nhận tới `0,95 · W`, cảnh báo `size` từ `0,8 · W`; quá nữa là lỗi `group`, dòng lỗi gợi phần khác
   còn vừa hay hai tay.
8. **Đũa**: giai đoạn 4 chỉ làm dáng `chopsticks`; `pick` và tách que trên làm khi có shot cần gắp thật.

## Phụ lục A — chuyển cảnh t02 (tạm)

> Ghi chú của một tập cụ thể; xoá khỏi docs khi đã chuyển.

### 25 kiểu cầm, 119 cặp cảnh–kiểu

Đếm bằng cách quét mọi `hold` trong `scenes/t02-*.json` (2026-10-19); 27 cặp có đè ý định ở cảnh. "Lựa chọn tương đương" ước
từ liên kết cũ; tool đo lại. "Ý định ghi" là ý định của kiểu cũ ghi vào cảnh khi khác mặc định nhóm.

| Kiểu cũ | Cặp | Nhóm | Lựa chọn tương đương | Ý định ghi | Đè ở cảnh (giữ) |
|---|---|---|---|---|---|
| `dien-thoai#doc` | 31 | `palmBox` | `thumb` cùng bên tay, `along` ≈ 0,42, `tilt` 20° | — | `face` ở 19 cặp |
| `tui-hieu#khuyu` | 25 | `carry`, `on: elbow` | `seats.elbow = treoKhuyu` | — | — |
| `tom-hum#nhac` | 8 | `sheet` `rim`, `both` | vành trái/phải, `thumb: top` | `up: top`, `roll: duoi → forward` | — |
| `khay#bung` | 8 | `platform`, `both` | `edge` left/right, `ψ` ngón về `back` | `roll: far → forward` | — |
| `dua#cam` | 6 | `chopsticks` | fixture | `face: tip → forward, tilt −30` | — |
| `ong-nghe-ban#tai` | 5 | `cylinder`, `part: tay` | lòng tay áp `back`, `thumb: up` | `face: front → {mark: head}`; `touch: self.head` | 1 cặp |
| `but#viet` | 4 | `pen` | fixture | `face: tip → [0,5, 0,866, 0]` | — |
| `ong-nghe#tai` | 4 | `cylinder`, `part: tay` | như trên | như trên | — |
| `bao#doc` | 4 | `sheet` `rim`, `both` | `edge` right/left, `along` ≈ 0,17 | `face: front → back, tilt 10`, `roll: top → up` | — |
| `tui#xach` | 3 | `handle` `hook` | `along: mid` | — | — |
| `the-phong#kep` | 3 | `card` | `edge: bottom` | `face: front → up`, `roll: top → forward` | — |
| `the-phong#cam` | 3 | `card` | `edge: top`, `thumb` mặt kia | `keep: true` | — |
| `thuc-don#khoe` | 3 | `sheet` `flat` | `edge: left` (tay phải), `slant: high`, `along` ≈ 0,31 | `face: front → forward`, `roll: top → up` | 3 cặp |
| `the-phong#dua` | 1 | `card` | `edge: top` | `face: front → up`, `roll: bottom → forward` | — |
| `dien-thoai#khoe` | 1 | `palmBox` | `tilt` 0 | `roll: top → up` | 1 cặp |
| `dien-thoai#bam` | 1 | `palmBox` | `along` ≈ 0,4 | — | — |
| `khay-suat#bung` | 1 | `platform`, `both` | `edge` left/right | `roll: [0,0,−1] → forward` | — |
| `chen#kep` | 1 | `bowl` `side` | — | — | — |
| `chai-dia#xem` | 1 | `cylinder`, `part: vai` | `around` bên hông, `thumb: up` | `face: nhan → holderFace`, `roll: mouth → up` | 1 cặp |
| `phieu#do` | 1 | `platform` | mặt `back`, ngón về cạnh `top` | — | — |
| `bo-da#bung` | 1 | `sheet` `rim`, `both` | `edge` left/right | `up: top`, `roll: front → forward` | — |
| `phieu-lien#cam` | 1 | `sheet` `flat` | `edge: right`, `slant: in` | — | — |
| `chai-dac-tuyen#xem` | 1 | `cylinder`, `part: vai` | như `chai-dia#xem` | như trên | 1 cặp |
| `dien-thoai#cam` | 1 | `palmBox` | như `khoe` | `keep: true` | — |
| `hoa-don#hai` | 1 | `sheet` `flat`, `both` | cả hai tay một cạnh, `along` ≈ 0,23 hai phía | — | 1 cặp |

Theo nhóm: `palmBox` 34, `carry` 25, `sheet` 18, `cylinder` 11, `platform` 10, `card` 7, `chopsticks` 6, `pen` 4, `handle` 3,
`bowl` 1 — mười nhóm, cộng 119. Ghi chú: "tấm nằm" xét theo khung món, không theo cảnh — món có `top` là pháp tuyến mặt lớn (khay, đĩa bò, đĩa tôm hùm)
dùng tên mặt `top`/`bottom` và tên cạnh `front`/`back`/`left`/`right` (mục 2); thẻ, phiếu, bảng giá có `top` nằm trong mặt
tấm nên là tấm đứng dù cảnh đặt ngửa.

### Nhãn phần 34 món

| Món | `front` / `top` | Phần, chi tiết |
|---|---|---|
| `bang-gia`, `bien-lai`, `hoa-don`, `phieu`, `phieu-doi-phong`, `phieu-lien`, `thuc-don`, `the-phong`, `the`, `giay-to`, `so-tay`, `bao`, `kep-ho-so` | `front` (`cover`) / `top` (`edgeT`) | Không (`so-tay`, `kep-ho-so`: gáy, trang là `detail` hay phần thường) |
| `dien-thoai` | `screen` / `top` | `detail`: cụm camera, hai nút sườn |
| `chai-dia`, `chai-dac-tuyen`, `binh` | `nhan` (bình: không) / `mouth` | `than`, `vai`, `co`, `mieng` (`grip: false`) |
| `chen` | — / — (miệng suy từ `wall`) | Không |
| `ly-bia` | — / — (miệng) | `than`, `quai` (`path`, để sau) |
| `but` | — / `cap` | `ngoi` (`grip: false`), `than`; kẹp `detail` |
| `dua` | — / — | `que` (hai khối), `nut` (`grip: false`) |
| `ong-nghe-ban`, `ong-nghe` | `front` / `top` | `tay`; `loa`, `mic` (`grip: false`) |
| `bo-dam` | `front` / `top` | `than`; ăng-ten (`grip: false`) |
| `khay`, `khay-suat`, `khay-tra`, `chong-khan` | — / `top` | `day`, `vanh`; đồ trên khay (`grip: false`) |
| `tom-hum`, `bo-da` | `front` (bò) / `top` | `dia`; món ăn (`grip: false`) |
| `tui` | `mat` / `quai` | `than`, `quai`, `day` (`grip: false`) |
| `tui-hieu` | `mat` / `quai` | `seats` |
| `vali` | — / `handleTop` | `than`, `can` (quai), ống kéo |
| `chia` | — / — | `vong`, `chia` (`grip: false`) |
| `khan` | — / `top` | `soft: true` (để sau) |
