# 14 — Đi mượt

Người 3D đi theo `path` mượt cả khi đi thẳng lẫn khi đổi hướng: rẽ khi đang đi là một mốc giữa đường, không phải
dừng – xoay – đi. Spec này đặt năm kịch bản chuẩn, số đo độ mượt kèm ngưỡng, dải khung dày quanh chỗ rẽ, và bộ sinh
`stickman gen walk` ghi `path` cùng clip đi vào cảnh. Tên ghi **MỚI** là thứ chưa có trong code; tên khác trích từ code.

## 1. Tổng quan

### Một công thức đi

Chuyển động đi chỉ có một chỗ tính: `sceneAt` của lõi (`core/scene.ts`), từ hành động có sải chân (`walk`, `walk-short`,
`run-3d` — `gen: walkCycle`, `core/walk.ts`) và `cast[].world.path` của cảnh ([03](03-scene.md#đi-theo-path)). Không có
hệ đi thứ hai: không nướng chân, hông vào JSON hành động riêng cho từng cú rẽ. Sửa độ mượt là sửa `sceneAt`, mọi cảnh có
`path` cùng đổi.

Bộ sinh `gen walk` không tính chuyển động. Nó viết **hình học** (`path`: điểm, `yaw`, cung bo góc) và **thời gian** (giây
của từng mốc, chỗ bắt đầu, kết thúc clip đi, độ dài cú quay) sao cho rig đi vào đúng nhánh mượt của nó — đích mềm ở mốc giữa
đường, bước dừng ở mốc dừng, quay rồi đi ở cú quay tại chỗ.

### Ba lớp

| Lớp | Nằm ở | Lo gì | Không lo gì |
|---|---|---|---|
| **Rig** | `sceneAt` (`bakeWalker`, `stopWalks`, `turnWalks`), lõi | Hông suy từ bàn chân trụ, nhịp chân co giãn, thân nhìn trước, bo góc `path`, bước dừng, quay tại chỗ, quay rồi đi; số đo độ mượt (`gaitTrace`, `core/gait.ts`) | Chọn điểm đi, giây của mốc |
| **Bộ sinh** | `@stickman3d/cli`, `GEN_KINDS.walk`: `genWalk` (`gen.mjs`, đọc, tự kiểm, vá file) và phần thuần `gen-walk.mjs` (`parsePoints`, `planWalk`) | Từ danh sách điểm và tốc độ: mốc `path`, `yaw` từng mốc, cung bo góc, clip đi / đứng trên track, cú quay tại chỗ; tự kiểm; vá file cảnh | Góc chân, chỗ hông từng khung |
| **Trang soi** | `GEN_PAGES.walk` (`gen-pages.mjs`), trang chung của Studio 3D | Sân khấu thử năm kịch bản, chạy khô bộ sinh, biểu đồ số đo, bảng tự kiểm bấm tới giây | Ghi vào repo |

### Luồng dữ liệu

```
stickman gen walk --to "…" ── điểm, tốc độ, dừng / quay ──┐
GEN_PAGES.walk.stage(p, who) ── cảnh thử, người đứng ─────┤
                                                         ▼
     planWalk: mốc path + clip (luật thời gian 5.3); genWalk: thay ở --at (5.4)
                                                         ▼
       resolveScene → sceneAt (rig: hông, chân, thân) ── gaitTrace (số đo, mục 3)
                                                         ▼
          tự kiểm: số đo đi + worldChecks (move, clash, held) so với cảnh trước khi vá
                                                         ▼
     dry run: in bảng, mốc, clip, lệnh dải khung │ ghi: vá JSON thô scenes/<id>.json, giữ .bak
```

## 2. Năm kịch bản

### 2.1 Hệ đo chung

- Thế giới rig: `x` phải, `y` xuống, `z` sâu vào cảnh; `yaw` `0` mặt hướng `+x`, `90` hướng `−z`; **`yaw` tăng là quay
  phải** ([03](03-scene.md#quay-tại-chỗ)). Một mét là `RIG_PER_METRE` = `250` đơn vị.
- Toạ độ mẫu dưới đây ở `height` `1`, `world.s` `1`, sàn `y = 0`, người xuất phát ở gốc, hướng `+x`.
- `walk`: `actionStride` ≈ `277,6` đơn vị mỗi chu kỳ (ở `height` `1`, nền `idle`), `duration` `1,1 s` → tốc độ tự nhiên
  ≈ `252` đơn vị/s (~1 m/s). Kịch bản dùng `--speed 250`; clip khai `cycle` = `277,6 / 250` = `1,110 s` (luật 5), một bước
  (nửa chu kỳ) dài ≈ `139`.
- Khối JSON dưới đây là mảnh: `path` nằm trong `cast[].world`, clip trong `cast[].tracks[].clips`. Mốc đúng
  `WorldKeySchema` (`t`, `at`, `yaw`, `sit`, `ease`, `steps`), clip đúng `ClipSchema` (`action`, `start`, `cycle`, `blend`).
- Cửa sổ dừng của rig: clip đi kết thúc trong `[mốc dừng − cycle/2, mốc dừng + cycle/4]` ([Dừng ở
  mốc](03-scene.md#dừng-ở-mốc)); bộ sinh đặt ở `mốc dừng − cycle/4` = `−0,2775 s`, tròn xuống `0,001 s`.

### 2.2 K1 — Đi thẳng

Vào cảnh đang đi, đi `750` (3 m) rồi dừng.

```jsonc
"path": [
  { "t": 0, "at": [0, 0, 0], "yaw": 0 },
  { "t": 3, "at": [750, 0, 0], "yaw": 0 }                    // mốc dừng: hết path
],
"clips": [
  { "action": "walk", "start": 0, "cycle": 1.11, "blend": 0 },   // vào cảnh đang đi: không hoà (luật 12)
  { "action": "stand-3d", "start": 2.722, "blend": 0.3 }     // 3 − 1,110/4
]
```

```bash
pnpm exec stickman gen walk --scene canh --cast a --at 0 --start moving --to "750,0" --speed 250
```

Biến thể **đứng rồi đi**: `--start rest`, người đứng ở gốc `stand-3d` từ `0` (`--at 0` thay clip ấy). Bộ sinh ghi nền đứng
`stand-3d` ở `0` không hoà (clip đầu track ở giây `0`), `path` đứng yên `0,3 s` rồi rời chỗ, clip đi hoà từ nền ấy (luật 11):

```jsonc
"path": [
  { "t": 0, "at": [0, 0, 0], "yaw": 0 },
  { "t": 0.3, "at": [0, 0, 0], "yaw": 0 },                   // đứng yên trước khi rời chỗ
  { "t": 3.3, "at": [750, 0, 0], "yaw": 0 }
],
"clips": [
  { "action": "stand-3d", "start": 0, "blend": 0 },          // nền đứng 3D
  { "action": "walk", "start": 0.3, "cycle": 1.11, "blend": 0.3 },
  { "action": "stand-3d", "start": 3.022, "blend": 0.3 }
]
```

Hướng quãng đầu trùng `yaw` đứng (lệch dưới `15°`) nên không có cú quay để ghép quay rồi đi — xem giả thuyết H5
([mục 7](#7-phạm-vi-và-giả-thuyết-ở-rig)).

```bash
pnpm exec stickman gen walk --scene canh --cast a --at 0 --start rest --to "750,0" --speed 250
```

### 2.3 K2 — Rẽ nhẹ

Đi `500`, rẽ phải `25°` khi đang đi, đi tiếp `500`, dừng. Mốc giữa đường là đích mềm, `yaw` là phân giác hai hướng.

```jsonc
"path": [
  { "t": 0, "at": [0, 0, 0], "yaw": 0 },
  { "t": 2, "at": [500, 0, 0], "yaw": 12.5 },                // đích mềm: hông bo qua
  { "t": 4, "at": [953.2, 0, -211.3], "yaw": 25 }            // 500 · (cos 25°, −sin 25°)
],
"clips": [
  { "action": "walk", "start": 0, "cycle": 1.11, "blend": 0 },   // vào cảnh đang đi: không hoà (luật 12)
  { "action": "stand-3d", "start": 3.722, "blend": 0.3 }
]
```

```bash
pnpm exec stickman gen walk --scene canh --cast a --at 0 --start moving --to "500,0 953.2,-211.3" --speed 250
```

Giả thuyết cần đo: `25°` ở trần `150°/s` (`TURN_WALK`) chỉ cần `0,17 s` nên thân không chạm trần; thời gian chạm trần thật
đọc từ `ω` của M2.

### 2.4 K3 — Rẽ 90° khi đang đi

```jsonc
"path": [
  { "t": 0, "at": [0, 0, 0], "yaw": 0 },
  { "t": 2, "at": [500, 0, 0], "yaw": 45 },
  { "t": 4, "at": [500, 0, -500], "yaw": 90 }
],
"clips": [
  { "action": "walk", "start": 0, "cycle": 1.11, "blend": 0 },   // vào cảnh đang đi: không hoà (luật 12)
  { "action": "stand-3d", "start": 3.722, "blend": 0.3 }
]
```

```bash
pnpm exec stickman gen walk --scene canh --cast a --at 0 --start moving --to "500,0 500,-500" --speed 250
```

Thân quay ở trần `150°/s` thì `90°` mất ít nhất `0,6 s` (`150` đơn vị đường đi): hông cắt góc. Mặc định là đích mềm tới `100°`
([mục 8](#8-câu-hỏi-mở), câu 1); bo cung bằng `--radius 125` (mốc cung như [K5](#26-k5--vòng-chữ-u-không-dừng)).

### 2.5 K4 — Đi tới, dừng, quay 180° tại chỗ, đi về

Quay trái (`--turn-side left`); `yaw` ghi liền nên quãng về mang `−180`.

```jsonc
"path": [
  { "t": 0, "at": [0, 0, 0], "yaw": 0 },
  { "t": 2, "at": [500, 0, 0], "yaw": 0 },                     // mốc dừng, giữ hướng quãng tới
  { "t": 2.3, "at": [500, 0, 0], "yaw": 0 },                   // đứng 0,3 s: bước khép, clip đi hoà ra xong
  { "t": 3.9, "at": [500, 0, 0], "yaw": -180, "steps": 2 },    // quay 180° trong 1,6 s, hai nhịp 0,8 s
  { "t": 5.9, "at": [0, 0, 0], "yaw": -180 }                   // đi về, dừng
],
"clips": [
  { "action": "walk", "start": 0, "cycle": 1.11, "blend": 0 },   // vào cảnh đang đi: không hoà (luật 12)
  { "action": "stand-3d", "start": 1.722, "blend": 0.3 },      // 2 − 0,2775; hoà ra xong 2,022 < 2,3
  { "action": "walk", "start": 3.5, "cycle": 1.11, "blend": 0.3 },  // giữa nhịp cuối [3,1; 3,9]
  { "action": "stand-3d", "start": 5.622, "blend": 0.3 }
]
```

```bash
pnpm exec stickman gen walk --scene canh --cast a --at 0 --start moving --to "500,0! 0,0" --speed 250 --turn-side left
```

- Mốc đứng `2,3`: cú quay nối đi thì rig **không** ghép bước khép vào cú quay, và clip đi trước phải hết hẳn — kể cả lúc
  hoà ra — trước mốc đầu cú quay ([Quay tại chỗ](03-scene.md#quay-tại-chỗ)); luật 7.
- Chiều quay theo luật dấu H9 ([7.2](#72-giả-thuyết-cần-đo)): cặp mốc lệch đúng `180°` quay theo dấu lệch thô, `yaw` mốc
  cuối `+180` là quay phải, `−180` quay trái — một cú `steps: 2`, nhịp cuối (nối đi) là chân phía quay. Hai cú `90°` liền
  nhau mỗi cú `steps: 1` **không** tương đương: nhịp đếm lại ở mỗi cú (`turnLead`), một chân bước cả hai nhịp, chân kia
  xoay cả hai.
- Biến thể chuẩn: K4 quay trái và K4 quay phải; dải khung kiểm chân bước từng nhịp theo bên giải phẫu.
- `yaw` mốc cuối của cú quay là hướng quãng về, nên rig không phải bẻ thêm (`sceneLaunchProblems` kêu khi còn lệch
  quá `10°`).

### 2.6 K5 — Vòng chữ U không dừng

Đi `400`, vòng phải nửa đường tròn bán kính `125` (0,5 m), đi về `400` trên làn song song cách `250`. Bộ sinh bo hai góc
`90°` liền nhau (`--radius 125`) thành cung, mỗi `30°` hướng một mốc, `yaw` tiếp tuyến. Tâm cung `[400, 0, −125]`,
`at(ψ) = tâm + 125 · (sin ψ, 0, cos ψ)`, `ψ` là `yaw`. Rig đi theo dây cung thẳng giữa hai mốc, nên giây tính theo dây
cung: mỗi `30°` dài `2 · 125 · sin 15°` = `64,7` → `0,2588 s`.

```jsonc
"path": [
  { "t": 0,     "at": [0, 0, 0],          "yaw": 0 },
  { "t": 1.6,   "at": [400, 0, 0],        "yaw": 0 },
  { "t": 1.859, "at": [462.5, 0, -16.7],  "yaw": 30 },
  { "t": 2.118, "at": [508.3, 0, -62.5],  "yaw": 60 },
  { "t": 2.377, "at": [525, 0, -125],     "yaw": 90 },
  { "t": 2.635, "at": [508.3, 0, -187.5], "yaw": 120 },
  { "t": 2.894, "at": [462.5, 0, -233.3], "yaw": 150 },
  { "t": 3.153, "at": [400, 0, -250],     "yaw": 180 },
  { "t": 4.753, "at": [0, 0, -250],       "yaw": 180 }
],
"clips": [
  { "action": "walk", "start": 0, "cycle": 1.11, "blend": 0 },   // vào cảnh đang đi: không hoà (luật 12)
  { "action": "stand-3d", "start": 4.475, "blend": 0.3 }
]
```

```bash
pnpm exec stickman gen walk --scene canh --cast a --at 0 --start moving --to "525,0 525,-250 0,-250" --speed 250 --radius 125
```

Tốc quay trên cung `180° / 1,553 s` ≈ `116°/s`, dưới trần `150°/s`. Bán kính nhỏ nhất bộ sinh nhận ở tốc độ `v` là
`v / ω_c`, `ω_c` = `120°/s` = `2,094 rad/s` (`WALK_TURN_RATE` của `gen-walk.mjs`): `250` đơn vị/s → `119,4`. Gấp hơn thì lỗi, gợi
dừng – quay ([K4](#25-k4--đi-tới-dừng-quay-180-tại-chỗ-đi-về)) hay bán kính lớn hơn. Biến thể chuẩn: K5 vòng phải và vòng
trái.

### 2.7 Trang soi `walk`

`GEN_PAGES.walk`: `label` `Đi`, `roles: []` ở `GEN_KINDS.walk`. `stage(p, who)` dựng cảnh `STAGE_SCENE`, người
`PREVIEW_ACTOR` đứng hướng `+x` (`world.at`) ở chỗ để hộp đường đi nằm giữa phòng thử (`PROP_ROOM`, tròn `10`), track
`chan` có `stand-3d` từ `0`, `props: []`, `held: {}`; ống kính đứng yên ôm hộp của cả đường đi theo góc máy `angle` của Thư
viện tính từ phía ngoài chỗ rẽ — `front` nhìn hộp từ phía ngược chiều rẽ (`yaw` gốc `−90 · σ`, `straight` và `back` lấy
`σ = 1`), người đi ngang khung (`lensAround` của `core/preview.ts` với tâm hộp, `far` hai lần nửa đường chéo hộp cộng lề
`60 · h`; `lensAround`, `PREVIEW_ORBIT` xuất ra từ lõi). `who` của trang là `{ name, character, actions }`
(hành động hai lớp cho tốc độ tự nhiên). `call(p, stage)` đổi tham số ra cờ của `run` ([5.1](#51-cờ)) với `--at 0`, luôn
`dryRun`; clip `stand-3d` ở `0` bị thay theo luật mục == `--at` ([5.4](#54-chỗ-thay-ở---at)), `rest` ghi lại nền đứng ấy (luật 11). `auto(p, who)` giải đúng như
`run`: `walkSpeed` là tốc độ tự nhiên `actionStride(action, base) · height · s / duration` của hành động đang chọn cho người
đang chọn; `radius` là `max(125 · s, v / ω_c)` với `uturn` và với `corner` khi góc quá `100°`, còn lại `0`; `turnTime`
là `0,8` (giây mỗi `90°`, cùng đơn vị với `--turn-time`).

| `key` | `label` | Kiểu | Mặc định | Khoảng | `when` |
|---|---|---|---|---|---|
| `shape` | Kịch bản | `enum` `straight` \| `bend` \| `corner` \| `back` \| `uturn` (`names`: đi thẳng, rẽ nhẹ, rẽ góc, dừng – quay – về, vòng chữ U) | `corner` | | |
| `walkAction` | Hành động | `enum` `walk` \| `walk-short` \| `run-3d` | `walk` | | |
| `start` | Bắt đầu | `enum` `moving` (vào cảnh đang đi) \| `rest` (đứng rồi đi) | `moving` | | |
| `walkSpeed` | Tốc độ | `number`, `unit` đơn vị/s | `auto` | `100…500`, `step` `10` | |
| `lead` | Quãng trước chỗ rẽ | `number`, đơn vị | `500` | `150…1500`, `step` `10` | |
| `after` | Quãng sau chỗ rẽ | `number`, đơn vị | `500` | `150…1500`, `step` `10` | `shape` `bend`, `corner`, `uturn` (`back` luôn về chỗ đứng) |
| `bendTurn` | Góc rẽ | `number`, độ | `25` | `5…45` | `shape` `bend` |
| `cornerTurn` | Góc rẽ | `number`, độ | `90` | `45…135` | `shape` `corner` |
| `side` | Phía | `enum` `right` (`yaw` tăng) \| `left` | `right` | | `shape` `bend`, `corner`, `uturn` |
| `radius` | Bán kính bo | `number`, đơn vị | `auto` | `0…400`, `step` `5` | `shape` `corner`, `uturn` |
| `turnTime` | Thời gian quay | `number`, `unit` giây mỗi 90° | `auto` | `0,5…2`, `step` `0,05` | `shape` `back` |
| `turnSide` | Chiều quay nửa vòng | `enum` `auto` (quay về phía ống kính) \| `right` \| `left` | `auto` | | `shape` `back` |
| `hold` | Đứng ở mốc cuối | `number`, giây | `0,6` | `0,2…2` | |

Hành động, tốc độ là khoá `walkAction`, `walkSpeed` (`action`, `speed` là khoá URL của Thư viện), `call` đổi ra cờ
`--action`, `--speed`. Góc rẽ là hai khoá theo `when` (cùng nhãn), mỗi khoá một khoảng; `angle` là góc máy của Thư viện, `paramProblems` kiểm nó
riêng. `uturn` có bán kính dưới `v / ω_c` thì `stage` báo lỗi như `run`.

Điểm của từng `shape` (tính từ chỗ đứng, hướng `+x`, `σ` = `+1` với `right`, `−1` với `left`; quay phải là về `−z`; `θ` là `bendTurn`
hay `cornerTurn`):

| `shape` | `--to` |
|---|---|
| `straight` | `lead,0` |
| `bend`, `corner` | `lead,0` · `lead + after·cos θ, −σ·after·sin θ` |
| `back` | `lead,0!` · `0,0` |
| `uturn` | `lead + r,0` · `lead + r, −σ·2r` · `lead − after, −σ·2r` với `--radius r` |

## 3. Số đo độ mượt

### 3.1 Lấy mẫu và nhãn

`gaitTrace(rt, id, height, body, from, to)` (lõi, `core/gait.ts`): một mẫu mỗi bước của bảng `Walker` (`w.step` =
`duration / ceil(duration / TRAVEL_STEP)`, ≈ `1/120 s`) trên **toàn** `[from; to]`, cộng `0,1 s` hai bên cho sai phân. Mặc
định `from`, `to` là cả cảnh; bộ sinh đưa `[--at − 0,5; mốc cuối + --hold]`.

Mỗi mẫu: `t`; hông `world.hip`; `yaw` thân thật (`world.yaw`, độ, gỡ vòng) và hướng thân nhắm (`yaw0`); nhịp chân `rate`
= `(clock[k] − clock[k−1]) / step` — nhịp cuối của đồng hồ, sau sải và phần bù, không phải `rT` hay `r`; pha clip không cuộn
(`clockPhase`); phần sải `stride`; bàn chân chịu lực (luật `standing` / `nextBearing` của `travel.ts`) và chỗ hai bàn chân
`feet3`; điểm `path` lúc ấy `P(t)` (`keyAt`), tiếp tuyến `T(t)` và tốc độ `path` `vRef` = `|dP/dt|`; clip chủ (track, chỉ
số clip của `strideClip`, kể cả đuôi hoà); chỉ số đoạn `path` (`legOf`); và **nhãn**:

| Nhãn | Quãng |
|---|---|
| `launch` | Quay rồi đi: từ đầu nhịp cuối của cú quay tới mốc cuối `+ 0,5 s`. Khởi hành từ đứng không quay: từ lúc `path` rời chỗ đứng tới `+ 0,5 s` |
| `stop` | Dừng ở mốc: từ lúc sải bắt đầu co (một bước trước lúc hông giảm tốc) tới lúc bước khép xong (kế hoạch dừng của `Walker`) |
| `turn` | Quay tại chỗ: giữa hai mốc của cú quay (`turnOf`), ngoài phần đã là `launch`, `stop` |
| `cruise` | Có clip sải chân lái chân, ngoài ba nhãn trên |
| `still` | Còn lại (đứng yên) |
| `sit` | Đoạn có mốc ngồi; không đo |

Chồng nhau thì ưu tiên `sit` > `launch` > `stop` > `turn` > `cruise` > `still`. Một **lượt** là chuỗi mẫu liền cùng nhãn,
cùng clip chủ, cùng đoạn `path` với `cruise` ở cung bo thì không tách theo đoạn. Mọi sai phân, trung bình trượt chỉ lấy
trong một lượt: không trừ qua biên nhãn, biên clip hay chỗ `Walker` tự căn pha. Số đọc từ chính bảng của `Walker` (`x`, `z`,
`yaw`, `clock`, `stride`) và `sceneAt`, không đo lại bằng cách khác, nên `check`, bộ sinh và trang soi thấy cùng một số.

### 3.2 Bảng số đo

Ngưỡng là **đề xuất tạm**: đo hiện trạng năm kịch bản (cả biến thể trái / phải) trên bốn người mẫu
(`common/characters/sample-*.json`) trước, chủ dự án xem dải khung, rồi mới chốt ([mục 7](#7-phạm-vi-và-giả-thuyết-ở-rig)).
`s` là `world.s`; độ dài tính bằng đơn vị rig nhân `s`. Cột khoá là trường của `stickman.gait` ([3.3](#33-chỗ-hiện)); `—`
là ngưỡng cố định.

| # | Số đo | Nhãn | Định nghĩa | Ngưỡng đề xuất | Khoá | Đã có / mới |
|---|---|---|---|---|---|---|
| M1 | Tốc hông trên sàn | `cruise` | `v` = ` | Δ hip_xz | / step`. Cửa sổ dài một bước ở tốc `path` (`actionStride · height · s / (2 · vRef)`), chỉ cửa sổ nằm trọn trong một lượt, bỏ cửa sổ có `vRef`trung bình dưới`60 · height · s`/s; `ρ`=`Σv / ΣvRef`của cửa sổ. Tụt`1 − min ρ`, vọt `max ρ − 1`, gia tốc `max | Δρ | / Δt`(cửa sổ dời`1/60 s`) | tụt `≤ 10%`, vọt `≤ 15%`, gia tốc `≤ 1,0`/s | `dip`, `surge`, `accel` | **mới** |
| | Trễ dọc đường | `cruise`, `launch` | `(P(t) − hip) · T(t)` trên sàn | ` | trễ | ≤ 40 · s` | `lag` | **mới** |
| M2 | Quay thân | mọi nhãn trừ `still`, `sit` | `ω` = sai phân trung tâm của `yaw` thật bước `1/60 s`; `α` = sai phân trung tâm của `ω` bước `1/60 s` | ` | ω | `: `cruise`, `stop` `≤ 150°/s · 1,02` (`TURN_WALK`); `turn`, `launch` `≤ 300°/s` (`TURN_JERK`). ` | α | ≤ 1200°/s²`trên`cruise`, `stop`, `launch` | `alpha` (`ω`: —) | `ω` ở `turn`: có (`sceneTurnProblems`); còn lại **mới** |
| M3 | Trượt chân trụ | `cruise`, `stop`; `launch` từ mốc cuối của cú quay (khởi hành từ đứng: cả quãng) | Pha trụ đơn: đúng một bàn chân chịu lực, cùng bàn chân giải phẫu (đổi kênh khi lật); hai chân cùng chạm là hết pha (gót – mũi lăn). Lệch = `max | p(t) − p(t₀) | `trên sàn,`p`là`feet3`của chân ấy,`t₀`đầu pha — đúng`stanceSlip`của`walk3d.test.ts`. Mỗi khung: `max | p(t) − p(t − 1/60) | ` | lệch `≤ 2 · s` (`cruise`), `≤ 3 · s` (`stop`, `launch`); mỗi khung `≤ 0,5 · s` | `slip`, `slipJoin`, `slipFrame` | **mới** (luật thô `sceneSlideProblems` giữ nguyên) |
| M4 | Nhịp chân | `cruise` | `rate` như 3.1. Nhảy `max | rate(t + 0,05) − rate(t − 0,05) | / 0,1`; đỉnh `max rate` | nhảy `≤ 1,5`/s; đỉnh `≤ 1,6` (`RATE_MAX` là `2,5`) | `rateJump`, `ratePeak` | **mới** |
| M5 | Giật trên hình | mọi nhãn | `sceneSnaps` (`snap.ts`): khớp `actJoints` chiếu qua `lens`, px video theo `cameraAt`, nền trung vị ±2 khung | kịch bản chuẩn trên sân khấu thử: không dòng nào; cảnh của repo: không dòng mới so với cảnh trước khi vá | `stickman.snap` (có) | có |
| M6 | Bám đường | `cruise` | Khoảng cách sàn từ hông tới **nhánh gần theo thời gian** của `path`: các đoạn có quãng giây giao `[t − 1; t + 1]` (vòng chữ U không nhận nhầm làn về). Vùng góc mềm, vùng cung là cửa sổ của sự kiện ấy ở [mục 4](#4-dải-khung-dày-quanh-chỗ-rẽ); còn lại là đoạn thẳng | thẳng `≤ 5 · s`; góc mềm `θ` `≤ 50 · s · sin(θ/2) / sin 45°`; cung `≤ 20 · s` | `devStraight`, `devCorner`, `devArc` | **mới** |
| | Tới mốc dừng | — | Hông cách `at` của mốc dừng khi đứng yên | `≤ 20 · s` (`ARRIVE_MAX`) | — | có (`sceneSlideProblems`) |
| M7 | Luật `move` của người đi | — | `sceneSlideProblems`, `sceneLaunchProblems`, `sceneStopProblems`, `sceneTurnProblems` | không dòng nào | — | có |
| M8 | Hướng thân so hướng đi | `cruise` | ` | wrap180(yaw thật − hướng của vận tốc hông) | `, vận tốc trung bình một bước; bỏ mẫu có tốc dưới `0,3 · vRef` | `≤ 45°` | `facing` | **mới**, chẩn đoán |
| M9 | Hai chân | mọi nhãn trừ `sit` | Khoảng ngang (theo hướng thân thật) từ cổ chân trái tới cổ chân phải giải phẫu — âm là bắt chéo; khoảng cách nhỏ nhất giữa hai đoạn gối – cổ chân | ngang `≥ 0`; hai cẳng chân cách nhau `≥ 2 · legHalf · height · s` (`BODY3.legHalf` của người) | `feet` | **mới**, chẩn đoán |
| M10 | Bước dừng | `stop` | Bàn chân bay: đỉnh tốc ngang và độ nhấc cao nhất, so với đỉnh của chính chân ấy trên lượt `cruise` ngay trước | `≤ 1,1 ×` cả hai | `stopSwing` | **mới**, chẩn đoán |

- M1 lấy trung bình một bước vì tốc hông trong một bước dao động theo chân trụ. Cú tụt ngắn hơn một bước bị lọc đi, nên
  trace giữ cả `v` chưa lọc cho biểu đồ, và cú khựng ngắn còn được M5 bắt trên hình.
- M2 tính `α` vì trần tốc quay chặn `ω` mà không chặn lúc bật lên, tắt đi: quay êm `90°` trong `0,8 s` (đường
  `smoothstep`) có `α` đỉnh `6 · 90 / 0,8²` ≈ `844°/s²`; trần bật tắt trong một bước `1/120 s` là `18000°/s²`. `ω` của
  `cruise` lấy trần của rig nên vượt nó là lỗi rig, không phải lựa chọn ngưỡng; `launch` bỏ trần `TURN_WALK` có chủ ý (cú
  quay của chỗ nối không chặn tốc).
- M3 không đo chân xoay của `turn` và của nhịp cuối trước mốc cuối cú quay: chúng trượt trên sàn có chủ ý. Test hiện giữ
  lệch dưới `1` cho đi thẳng, đi cong (`walk3d.test.ts`), dưới `3` qua chỗ nối quay rồi đi, dừng — hai ngưỡng `2`, `3` có
  chừa khoảng cho người mẫu khác `height`.
- M8–M10 là **chẩn đoán** ở bản đầu: có trong trace, biểu đồ và bảng tự kiểm (cột `chẩn đoán`), không chặn ghi, không thành
  dòng `check` tới khi bước 3 của [7.1](#71-thứ-tự) hiệu chuẩn. Ảnh nhìn từ trên xuống ([mục 4](#4-dải-khung-dày-quanh-chỗ-rẽ))
  là chỗ xem chúng.

### 3.3 Chỗ hiện

- **`check`**, nhóm `move`: `sceneGaitProblems(rt, o)` (lõi, `core/gait.ts`; `check` chưa gọi — nối sau khi bước 3 của
  [7.1](#71-thứ-tự) chốt ngưỡng) — M1, M2 (phần mới), M3, M4, M6; mức cảnh báo như giật trên hình. Các dòng sát nhau gộp một dòng, báo ở giây tệ nhất, kèm nhãn, mốc `path` gần nhất và lý do đọc từ timeline (rẽ
  khi đang đi, đích mềm, cú quay nối đi, clip đi bắt đầu, kết thúc):

  ```
  scenes/canh.json: `a` giây 1.62–2.31: hông chậm còn 78% tốc độ `path` quanh mốc giây 2.00 (rẽ 90° khi đang đi) — ngưỡng 90%
  scenes/canh.json: `a` giây 1.65: thân quay tăng tốc 9400°/s² (ngưỡng 1200°/s²) khi bắt đầu rẽ quanh mốc giây 2.00
  ```

- **Ngưỡng** ở `package.json` của repo video, như `stickman.snap`; trường thiếu lấy mặc định ở [3.2](#32-bảng-số-đo),
  `false` là không đo:

  ```json
  "stickman": { "gait": {
    "dip": 0.1, "surge": 0.15, "accel": 1.0, "lag": 40, "alpha": 1200,
    "slip": 2, "slipJoin": 3, "slipFrame": 0.5, "rateJump": 1.5, "ratePeak": 1.6,
    "devStraight": 5, "devCorner": 50, "devArc": 20,
    "facing": 45, "feet": true, "stopSwing": 1.1
  } }
  ```

- **`gen walk`**: mỗi số đo một dòng của bảng tự kiểm (`checkRows`; `RULE_LABEL` thêm nhãn), `t` là giây tệ nhất.
- **Trang soi**: dòng tự kiểm bấm tới giây; dưới bảng tự kiểm (`genWalkChart.ts`) ô nhìn từ trên xuống — đường gấp khúc
  của `path`, mốc, vệt hông, chỗ đặt bàn chân trụ theo bên — và ba dải theo thời gian chung trục giây: `v / vRef` chưa lọc,
  `ω`, `rate`, có vạch ngưỡng, vạch đứng ở giây các mốc `path`, nền tô theo nhãn `stop`, `turn`, `launch`; rê chuột hiện số,
  bấm là tới giây ấy. Vẽ từ `gaitTrace` chạy trong trình duyệt trên `scene` mà `/api/gen` trả về. Dải `α`, trượt chân trụ,
  góc M8 và vạch chỗ bắt đầu, kết thúc clip chưa có ([7.3](#73-ngoài-phạm-vi)).
- **MCP**: `gen` trả `metrics` (M1–M10, giây tệ nhất, nhãn); `scene_probe` nhận `gait: { from, to }` (**MỚI**) trả cùng bảng
  cho một người.

## 4. Dải khung dày quanh chỗ rẽ

Mỗi sự kiện một cửa sổ (`c` là `cycle`, `θ` góc rẽ, `ω` = `TURN_WALK`). Cửa sổ góc mềm và cung cũng là vùng của M6.

| Sự kiện | Cửa sổ | Bước |
|---|---|---|
| Rẽ khi đang đi, mốc giây `t_c` | `[t_c − STEER_AHEAD − 0,25; t_c + | θ | / ω + TRACK_ALONG]`—`90°`: `[t_c − 0,6; t_c + 1,1]` | `0,05 s` |
| Cung bo `[t_a; t_b]` | `[t_a − 0,6; t_b + 0,6]` | `0,05 s` |
| Mốc dừng `t_s` | `[t_s − c/2 − 0,3; t_s + 0,6]` | `0,05 s` |
| Quay tại chỗ `[t_1; t_2]`, nối đi | `[t_1 − 0,2; t_2 + 0,6]` (cửa sổ của `sceneLaunchProblems`) | `0,05 s` |

Lệnh có sẵn:

```bash
# ảnh three thật, 12 cột
pnpm exec stickman-render --scene scenes/canh.json --from 1.4 --to 3.1 --every 0.05 --cols 12 \
  --out tmp/walk/canh-re-2.00.png
# que xương trên lưới sàn, thêm ô nhìn từ trên xuống, vệt hông và hai bàn chân ±0,6 s
pnpm exec stickman-render --scene scenes/canh.json --skeleton --views top --times 1.6,2.0,2.4 \
  --trails hip,feet --span 0.6 --cast a --out tmp/walk/canh-re-2.00-top.png
```

MCP: `render_scene` với `times` (giây của cửa sổ theo bước) và `trails`, `skeleton` ([04](04-mcp.md#người-3d)). `gen walk`
in sẵn hai lệnh trên cho từng sự kiện của đoạn nó sinh, đúng cửa sổ và tên file. Trên trang soi thì dải biểu đồ và ô nhìn
từ trên xuống thay cho dải ảnh; dải ảnh dùng khi chủ dự án duyệt.

## 5. `gen walk`

### 5.1 Cờ

```bash
pnpm exec stickman gen walk --scene <id> --cast <người> --to "<điểm> …" [--at <giây | @mốc±s>] [--speed <v>]
  [--action walk] [--start rest|moving] [--radius <r>] [--turn-time <giây mỗi 90°>] [--turn-side auto|right|left]
  [--hold <giây>] [--track <tên>] [--after stand-3d] [--blend 0.3] [--dry-run] [--force]
```

| Cờ | Làm gì |
|---|---|
| `--scene`, `--cast` | Cảnh, người đi (người 3D có `world`); bắt buộc |
| `--at` | Giây bắt đầu (số hay `"@mốc+0.4"`, `markTime`). Bắt buộc khi người đã có `path`; người đứng ở `world.at` thì mặc định `0`. Đầu ra in lệnh đầy đủ với `--at` đã giải để chạy lại |
| `--to` | Các điểm sàn `x,z` thế giới rig, cách nhau bằng dấu cách ([5.2](#52-điểm)); bắt buộc |
| `--speed` | Đơn vị thế giới mỗi giây dọc đường, số hữu hạn `> 0`; mặc định tốc độ tự nhiên `actionStride(action, base) · height · s / duration` của `--action` cho người ấy |
| `--action` | Hành động đi tới, hai lớp; mặc định `walk`. Phải có sải dương (`actionStride` trên nền của người `> STRIDE_MIN`) và ghi cả hai kênh chân (`legFar`, `legNear`); đi lùi, không sải là lỗi |
| `--start` | `rest`: người đứng yên ở `--at` rồi khởi hành; `moving`: `path` bắt đầu ở `--at` đúng tốc độ, clip đi chạy từ `--at` (vào cảnh đang đi). Mặc định `rest` |
| `--radius` | Bán kính bo các góc rẽ khi đang đi, đơn vị thế giới, `≥ 0`; `0` (mặc định) để mốc giữa đường là đích mềm (luật 3) |
| `--turn-time` | Giây cho mỗi `90°` quay tại chỗ, `0,5…2`; mặc định `0,8` ([03](03-scene.md#đi-theo-path)) |
| `--turn-side` | Chiều cú quay đúng `180°` (luật 9): `auto`, `right`, `left`; mặc định `auto` |
| `--hold` | Giây đứng yên ở điểm cuối, `≥ 0,2`; mặc định `0,6` (cửa sổ của `sceneStopProblems`). Luật 14 |
| `--track` | Track ghi clip; mặc định track của nguồn chân hiệu dụng lúc `--at` (track **sau cùng** có clip đang chạy ghi chân, `writesLegs`), không có thì track mới `chan` ở đầu |
| `--after` | Hành động sau mỗi mốc dừng, hai lớp; mặc định `stand-3d`. Phải không có sải (` | actionStride | ≤ STRIDE_MIN`) và ghi cả hai kênh chân, để nó chặn chân của clip đi |
| `--blend` | `blend` của clip đi và clip sau, `0…1`; mặc định `0,3` |
| `--dry-run`, `--force` | Chỉ tính và in; ghi dù tự kiểm không đạt (kèm cảnh báo). `--force` không bỏ qua lỗi cấu trúc ([5.4](#54-chỗ-thay-ở---at)), hash, schema, hết cảnh |

`stickman gen walk --help` in cờ; bảng slot in "không cần vai trò của đồ" (`slotTable` với `roles: []`).

### 5.2 Điểm

```
điểm := x,z            mốc giữa đường (đích mềm, hay bo cung theo --radius); điểm cuối luôn là mốc dừng
      | x,z!           mốc dừng giữa đường: quay tại chỗ tới hướng quãng sau rồi đi (luật 7)
      | x,z!yaw        chỉ ở điểm cuối: mốc dừng rồi quay tại chỗ tới yaw — nhìn ai đó (luật 8)
```

Lỗi: điểm cách điểm trước dưới `10 · s`, `yaw` không phải số, `!yaw` giữa đường, hai điểm `!` liền nhau cùng chỗ. Độ cao
`y` lấy từ mốc đang đứng; đổi sàn giữa đường chưa có ([mục 7](#7-phạm-vi-và-giả-thuyết-ở-rig)). MCP nhận cả mảng
`{ at: [x, z], stop?, yaw? }` (`yaw` chỉ ở phần tử cuối).

Ví dụ dừng rồi quay ở điểm cuối, `--to "500,0!90" --speed 250 --at 0 --start moving` (cú quay `90°` dài
`max(0,8; 1,5 · 90 / 300 + 0,1)` = `0,8 s`, rig ghép bước khép vào nửa đầu):

```jsonc
"path": [
  { "t": 0, "at": [0, 0, 0], "yaw": 0 },
  { "t": 2, "at": [500, 0, 0], "yaw": 0 },                   // mốc dừng, giữ hướng quãng tới
  { "t": 2.8, "at": [500, 0, 0], "yaw": 90, "steps": 1 }     // cú quay là mốc riêng
],
"clips": [
  { "action": "walk", "start": 0, "cycle": 1.11, "blend": 0 },   // vào cảnh đang đi: không hoà (luật 12)
  { "action": "stand-3d", "start": 1.722, "blend": 0.3 }      // cảnh cần tới ít nhất 2,8 + 0,6
]
```

Dừng giữa đường rồi quay về là [K4](#25-k4--đi-tới-dừng-quay-180-tại-chỗ-đi-về).

### 5.3 Luật thời gian

Bộ sinh lo hết những luật dưới đây; rig lo chuyển động giữa các mốc. `v` là `--speed`, `c` là `cycle` của clip đi, `b` là
`--blend`, `h_in` / `h_out` hướng quãng tới / quãng sau.

1. **Toạ độ, giây**: điểm và mốc cung tròn `0,1`; giây của mốc là quãng cộng dồn theo **dây cung thật** giữa các mốc đã
   tròn, chia `v`, tròn `0,001 s` (sai tốc mỗi quãng dưới `0,5%`). Mọi quãng đi cùng tốc độ. Hai mốc dời chỗ liền nhau cách
   dưới `0,05 s` là lỗi.
2. **`yaw`**: ghi liền — mỗi `yaw` là `yaw` trước cộng `wrap180` của phần đổi, trừ cú quay `180°` (luật 9). Mốc đầu: hướng
   quãng đầu (`moving`) hay `yaw` đang đứng (`rest`). Mốc giữa đường: phân giác hai hướng kề (mốc cung cũng vậy, là tiếp
   tuyến). Mốc dừng: `h_in`. Mốc cuối cú quay: `h_out`, hay `yaw` khai của `!yaw`. Hướng thân rig nhắm và `yaw` khai do đó
   lệch nhau dưới `60°` (`STEER_BACK`).
3. **Góc rẽ khi đang đi**: `|θ| ≤ 100°` với `--radius 0` là đích mềm; `100° < |θ| ≤ 135°` với `--radius 0` thì bo cung
   `r = max(125 · s, v / ω_c)` và in số ấy; `|θ| > 135°` là lỗi (gợi `x,z!`, hay vòng chữ U bằng hai góc `90°` như K5). Hai
   góc kề nhau cách nhau dưới `(|θ₁| + |θ₂|) / (2 · 0,8 · TURN_WALK)` giây thì cảnh báo (cú quay chồng nhau).
4. **Cung bo**: `r ≥ v / ω_c` (`ω_c` tính bằng rad/s), không thì lỗi. Mỗi cạnh kề góc mất `r · tan(θ/2)` cho cung, hai góc
   kề chia cạnh chung; không đủ là lỗi; phần thẳng còn lại dưới `1 · s` thì gộp hai mốc. Cung chia đều, mỗi phần tới `30°`
   hướng (`ARC_STEP`).
5. **Nhịp clip đi**: clip đi khai `cycle` = `actionStride(action, base) · height · s / v`, tròn `0,001 s` — đúng sải rig
   gán cho clip (`c.stride`) nhân `height · s`, nên nhịp gốc khớp `path`, `rate` quanh `1` ở mọi `height`. Không khai
   `speed` (`ClipSchema.speed` suy `cycle` không nhân `height`). Clip đi, clip sau khai `blend` = `b`, trừ clip đi vào cảnh
   đang đi (luật 12).
6. **Dừng**: clip `--after` bắt đầu ở `mốc dừng − c/4` (tròn xuống `0,001 s`); người đứng yên ở mốc ít nhất `0,1 s` (luật 7,
   8, hay `--hold`).
7. **Dừng giữa đường (`x,z!`)**: mốc dừng `{ t_s, P, h_in }`; mốc đứng `{ t_s + d, P, h_in }` với
   `d = max(0,3; b − c/4 + 0,05)` để clip đi hoà ra xong trước mốc đầu cú quay; rồi cú quay `{ t_s + d + T, P, h_out }`
   (luật 9) và quay rồi đi (luật 10). `h_out` lệch `h_in` dưới `15°` thì không quay: sau mốc đứng `path` rời chỗ, clip đi
   bắt đầu ở `t_s + d` (khởi hành từ đứng, H5).
8. **Dừng rồi quay ở điểm cuối (`x,z!yaw`)**: mốc dừng `{ t_s, P, h_in }`, mốc cuối `{ t_s + T, P, yaw, steps }` với
   `T = max(--turn-time · |Δ| / 90; 1,5 · |Δ| / 300 + 0,1)` để rig ghép bước khép vào nửa đầu cú quay ([Dừng ở
   mốc](03-scene.md#dừng-ở-mốc)); không chèn mốc đứng. `|Δ|` dưới `15°` thì khai `steps: 1`.
9. **Cú quay tại chỗ**: dài `T = --turn-time · |Δ| / 90`, `steps` ghi rõ `ceil(|Δ| / 90)`. `|Δ|` trong `0,5°` quanh `180°` là
   quay nửa vòng: một cú `steps: 2` tới `yaw` trước `+ 180` (`right`) hay `− 180` (`left`) — rig quay theo dấu lệch thô
   (H9), nhịp cuối nối đi là chân phía quay ([K4](#25-k4--đi-tới-dừng-quay-180-tại-chỗ-đi-về)). `auto` chọn
   chiều mà giữa cú quay mặt hướng về `lens.eye` (tích vô hướng của hướng thân giữa cú quay với `lens.eye − P` lớn hơn); hai
   chiều chênh dưới `0,05` (máy thẳng trục đi, nhìn từ trên) thì `left`.
10. **Quay rồi đi**: clip đi bắt đầu ở `mốc cuối − nhịp / 2`, `nhịp = T / steps ≥ 0,12 s` (`TURN_JOIN_BEAT`), không thì lỗi
    (gợi `--turn-time` lớn hơn).
11. **Khởi hành từ đứng** (`--start rest`): lúc `--at` người đứng yên — không clip sải chân nào lái chân kể cả đuôi hoà, `path`
    đứng yên từ ít nhất `0,1 s` trước, không ngồi —, không thì lỗi kèm giây sớm nhất hợp lệ. Clip đang chạy trên track lúc
    `--at` không phải `--after` thì bộ sinh ghi nền đứng `--after` ở `--at`, `blend` = `b` (clip đầu track ở giây `0`:
    `blend: 0`, vì hoà từ track trống là tư thế nền không soạn ở `side`). Quãng đầu lệch `yaw` đứng từ `15°` thì cú quay bắt
    đầu ở `--at` (luật 9, 10). Lệch dưới `15°` thì clip đi bắt đầu lúc `path` rời chỗ (H5): có nền đứng mới thì sau
    `max(0,3; blend nền + 0,05)` giây (mốc đứng thêm ở đó), không thì ở `--at` — `path` đứng yên dưới `0,1 s` trước `--at`
    (đầu cảnh) thì lùi tới đủ `0,1 s`. Nhờ vậy `check` thấy khởi hành từ đứng, không phải vào cảnh đang đi (H10).
12. **Vào cảnh đang đi** (`--start moving`): người không có mốc `path` trước `--at`; mốc đầu ở `--at`, `yaw` là hướng quãng
    đầu; clip đi bắt đầu ở `--at` với `blend: 0` — `path` đã đủ tốc, clip hoà vào từ dáng đứng là người đứng sững rồi lao theo
    (H10, `sceneWalkInProblems` của `check`). Người đứng ở `world.at` thì không thêm mốc `t: 0`.
13. **Chỗ thay**: [5.4](#54-chỗ-thay-ở---at).
14. **Hết cảnh**: sau khi vá, `rt.duration ≥ mốc cuối + --hold` (đo trên runtime, cả khi cảnh không khai `duration` và độ dài
    suy từ clip cuối); không thì lỗi "cảnh hết ở giây X, cần tới Y — khai `duration` cho cảnh, chọn `--after` dài hơn hay
    giảm `--hold`". Bộ sinh không tự đổi `duration`. Với `stand-3d` (`3,2 s`, bắt đầu `c/4` trước mốc dừng) đủ cho
    `--hold ≤ 2` khi `c ≤ 4,8 s`.

### 5.4 Chỗ thay ở `--at`

Giây so bằng `markTime` (clip, mốc khai `@mốc` giải ra số). `T` là track ghi clip (`--track`).

- **`path` của người**: giữ mốc `t < at`; bỏ mọi mốc `t ≥ at` (mục đúng `at` bị thay, hậu tố bị bỏ); nối các mốc sinh, mốc
  đầu đúng `at`. Người đứng ở `world.at` thì đổi sang `path`: mốc `{ t: 0, at, yaw }` khi `at > 0`, bỏ `at` / `yaw` của
  `world`; các trường khác của `world` (`s`, `hands`, …) giữ nguyên.
- **Track `T`**: giữ clip `start < at`; bỏ mọi clip `start ≥ at`; nối các clip sinh. Clip tiền tố đang chạy lúc `at` hết ở
  clip sinh đầu tiên, `blend` của clip ấy lo phần hoà. Track khác không đổi.
- **Nguồn chân hiệu dụng**: trên `[at; mốc cuối + --hold]`, ở mọi mẫu, clip lái chân của người (track sau đè track trước,
  kể cả đuôi hoà) phải là clip của `T`. Track khác có clip ghi chân trong quãng ấy là lỗi kèm danh sách (track, clip, giây).
- **Lỗi cấu trúc** (không có `--force` nào bỏ qua): mốc bị bỏ có `sit`, hay người đang ngồi lúc `at`; clip bị bỏ có `equip`
  (dời nó sang track khác); người đang đi lúc `at` (khác luật 11, 12); nguồn chân như trên.
- **Chạy lại** cùng lệnh, cùng `--at` trên file đã vá: tiền tố giữ nguyên, phần sinh thay đúng phần cũ → file giống từng
  byte. Nối thêm một đoạn đi là lệnh mới với `--at` sau đoạn trước.

Sân khấu thử có `stand-3d` ở `0`: `--at 0 --start moving` thay nó bằng clip đi; `--start rest` thay nó bằng `--after` ở `0`
`blend: 0` (luật 11). Test: sân khấu ấy với cả hai `start`; nối một đoạn sau mốc cuối của đoạn trước trên track đang
có clip đi và `stand-3d`; chạy lại cùng lệnh không thêm mục nào; track khác ghi chân trong quãng là lỗi.

### 5.5 Vá cảnh

Như Studio 3D ghi cảnh (`studio3d.mjs`, [05](05-repo-video.md#studio-3d-đọc-repo-video)):

- **Nạp**: `sceneData(root, o)` (`gen.mjs`) đọc bytes `scenes/<id>.json` một lần, `hash` =
  `sha(bytes)`, parse, dữ liệu hai lớp, runtime; không đòi `palette.clad`. `sceneFor` gọi nó rồi kiểm bàn tay cho `pour`,
  `sit`. Sân khấu thử (`o.stage.sceneJson`) không có file, không có `hash`.
- **Tính và tự kiểm** trong bộ nhớ: `worldChecks({ dir, before, after, groups, spec, held })` của `gen-check.mjs` (nó gọi
  `checkScenes({ scenes: { "gen-truoc", "gen-sau" } })`), không ghi đĩa, không có `actions` mới.
- **Bản mới**: `sceneWithWalk(disk, id, { path, at, yaw, tracks })` (cùng lối `sceneWithHands`) từ JSON thô trên đĩa chỉ
  đổi `cast[id].world.path` (và bỏ `world.at` / `world.yaw` khi đổi sang `path`) cùng `cast[id].tracks`; mọi khác biệt ngoài
  hai chỗ ấy thì từ chối. Bản mới qua `parseScene` trước khi ghi; object đã điền mặc định không được ghi.
- **Ghi**: `formatLike(text, next, format)` của `rawjson.mjs` (vá JSON thô: phần không đổi giữ từng byte; file đúng lối
  prettier thì chạy prettier); rồi đọc lại bytes, so với `hash` lúc nạp, ghi bằng `writeWithBak(file, out, now)` liền một
  mạch không `await` giữa đọc lại và ghi. Khác là lỗi "`scenes/<id>.json` đổi trên đĩa trong lúc sinh — chạy lại", không
  ghi (Studio trả `409` kèm hash mới, như `fresh`). Bản cũ ở `scenes/<id>.json.bak`, ghi qua file tạm.
- `sha`, `writeWithBak` ở `rawjson.mjs` (`gen.mjs` không nhập server); `studio3d.mjs` nhập lại từ đó, hàng ghi theo file
  (`serial`) ở server.
- Bản mới trùng từng byte với file trên đĩa thì không ghi: `wrote: { file, hash, same: true }`, dòng "không đổi".
- Kết quả mang `hash` lúc nạp và `wrote: { file, hash }` sau khi ghi.

### 5.6 Tự kiểm

Chạy trên cảnh đã vá trong bộ nhớ, cùng `gen-check.mjs` của `pour`, `sit`, trên quãng `[--at − 0,5; mốc cuối + --hold]`:

| Luật | Đo | Chặn ghi |
|---|---|---|
| Số đo đi | M1–M4, M6 theo nhãn ([3.2](#32-bảng-số-đo)) | không — quá ngưỡng `stickman.gait` là cảnh báo tới khi bước 3 của [7.1](#71-thứ-tự) chốt ngưỡng (năm kịch bản hiện quá `α`, tụt ở góc `90°`) |
| Chẩn đoán | M8–M10 | không |
| Giật trên hình | M5, `sceneSnaps` | dòng mới so với cảnh trước khi vá; trên sân khấu thử: dòng nào |
| `check` | `worldChecks`: nhóm `move`, thêm `clash` khi có cảnh three (`stickman.world` của repo, hay `spec` của sân khấu thử — gồm người tự xuyên thân), `held` khi người đang cầm đồ trong quãng; `compareBaseline` so với cảnh trước khi vá | dòng mới hay nặng hơn, trừ bàn chân người đi lún mặt sàn tới `4 · s` (`FOOT_SINK`: đế giày của bước đi chạm sàn — dòng `clash` có `floor`: ở mọi chỗ lấn, mặt gần bàn chân nhất của vật là mặt ngang dưới nó, cách sàn của người không quá `4 · s` — `soleOnFloor` của `lib.mjs`) — dòng chỉ báo; lấn tường, cạnh đồ vẫn chặn |

Không đạt thì thoát mã `1`, không ghi, in lý do và gợi ý theo luật trượt: hông tụt ở góc → bo `--radius` hay giảm `--speed`;
cung gấp → bán kính lớn hơn; khởi hành giật → `--start` và hướng quãng đầu; đi vào đồ → điểm khác.

### 5.7 Đầu ra

```text
gen walk `a` trong canh: 2 điểm, góc mềm 90° phải (giây 2.000), dừng ở giây 4.000, 250 đơn vị/s (walk, cycle 1.110 s)
  path: 3 mốc (thay 0) · track `chan`: walk 0 → stand-3d 3.722
  tự kiểm:
    hông tụt                     cảnh báo: 23% (giây 2.17, cruise)  [≤ 10%]
    hông vọt                     đạt: 10% (giây 2.72, cruise)  [≤ 15%]
    …
    thân quay tăng tốc           cảnh báo: 4548 °/s² (giây 2.42, cruise)  [≤ 1200 °/s²]
    chân trụ trượt               đạt: 0 (giây 1.02, cruise)  [≤ 2]
    …
    cắt góc                      đạt: 32 (giây 2.29, cruise)  [≤ 50]
    hướng thân                   đạt: 15 ° (giây 2.09, cruise)  [≤ 45 ° · chẩn đoán]
    …
    check move/clash/held/roles  đạt: không dòng nào mới (0 dòng như trước)  [không dòng mới]
  dải khung:
    pnpm exec stickman-render --scene scenes/canh.json --from 1.4 --to 3.1 --every 0.05 --cols 12 --out tmp/walk/canh-a-re-2.00.png
    pnpm exec stickman-render --scene scenes/canh.json --skeleton --views top --times 1.6,2,2.4 --trails hip,feet --span 0.6 --cast a --out tmp/walk/canh-a-re-2.00-top.png
    pnpm exec stickman-render --scene scenes/canh.json --from 3.15 --to 4.6 --every 0.05 --cols 12 --out tmp/walk/canh-a-dung-4.00.png
    pnpm exec stickman-render --scene scenes/canh.json --skeleton --views top --times 3.6,4,4.4 --trails hip,feet --span 0.6 --cast a --out tmp/walk/canh-a-dung-4.00-top.png
  chạy lại: pnpm exec stickman gen walk --scene canh --cast a --at 0 --start moving --to "500,0 500,-500" --speed 250
đã ghi scenes/canh.json (bản cũ scenes/canh.json.bak)
```

Mỗi số đo một dòng (`checkRows`, nhãn ở `RULE_LABEL` của `gen-check.mjs`), giây tệ nhất và nhãn trong ngoặc. Chạy khô in
thêm `path` và clip dạng JSON để xem; không ghi gì. Kết quả của `run` như `genPour`: `{ ok, scene, checks, lines, wrote, … }`,
thêm `path`, `clips`, `track`, `events`, `metrics`, `strips`, `hash`.

### 5.8 MCP và hai lớp

- **MCP**: tool `gen` mở `kind` thành `"pour" | "sit" | "walk"`; `at` thành số hay chuỗi `@mốc±s` (giải bằng `markTime`, mọi
  kiểu). Kiểu `walk` thêm `to` (chuỗi như cờ, hay mảng `{ at: [x, z], stop?, yaw? }`), `speed`, `action`, `start`,
  `radius`, `turnTime` (giây mỗi `90°`), `turnSide`, `hold`, `track`, `after`, `blend`, `dryRun`, `force`, và `hash` tuỳ
  chọn: sha của file cảnh agent đã có (lấy từ `hash` / `wrote.hash` của lần gọi trước), khác bytes trên đĩa là lỗi như 409.
  Trả `path`, `clips`, `checks`, `metrics`, `strips`, `hash`, `wrote`.
- **Hai lớp**: `--action`, `--after` và nhân vật đọc qua hai lớp (`walk` của repo đè bộ chung, [05](05-repo-video.md#hai-lớp));
  cảnh chỉ có ở repo video, ghi vào `scenes/` của repo. Ngưỡng `stickman.gait` ở `package.json` của repo. Không có bản
  chung sinh từ `gen walk`.
- **Studio**: trang soi chỉ chạy khô; nút **Ghi vào repo** để sau, khi có thì đi `POST` kèm hash lúc nạp, 409 khi file đổi.

## 6. Hướng dẫn cho agent dựng tập (phác)

Ý chính sẽ vào [03](03-scene.md#đi-theo-path) và [07](07-lam-tap.md):

- **Rẽ khi đang đi là một mốc giữa đường**, không phải dừng – xoay – đi. Một `path`, một clip `walk` chạy suốt, mốc ở chỗ rẽ
  với `yaw` là phân giác; không đặt `stand-3d` ở góc.
- **Quay đầu khi đang đi là vòng chữ U** bán kính từ `0,5 m`, không phải một mốc gấp `180°`.
- **Dừng – quay – đi chỉ khi câu chuyện dừng**: nhìn, nói, nhận đồ; hay chỗ hẹp không vòng được.
- **Dùng `gen walk`** thay cho viết tay mốc và clip: nó lo giây của mốc, chỗ kết thúc clip đi, độ dài cú quay, chỗ bắt đầu
  clip đi sau cú quay. Sửa đường thì chạy lại lệnh với cùng `--at`, đừng sửa tay một mốc giữa chuỗi.
- Sau khi vá: `stickman check --scene <id> --only move,clash`, rồi dải khung dày ở từng chỗ rẽ trước khi render video.

## 7. Phạm vi và giả thuyết ở rig

### 7.1 Thứ tự

1. `gaitTrace`, `sceneGaitProblems`, ngưỡng `stickman.gait`; test năm kịch bản (cả biến thể trái / phải) trên bốn người mẫu ở
   `walk3d.test.ts` ghi số hiện trạng (chưa chặn). H9 ([mục 8](#8-câu-hỏi-mở), câu 6).
2. `gen walk` (CLI, MCP) và `GEN_PAGES.walk`: dựng năm kịch bản bằng chính bộ sinh, đo, dải khung, đưa chủ dự án xem. Test
   chỗ thay ([5.4](#54-chỗ-thay-ở---at)); K4 từ trang và từ CLI ra cùng timeline.
3. Sửa `sceneAt` theo giả thuyết nào số đo xác nhận — gồm H5, vì khởi hành từ đứng là một phần của đi mượt; chỉnh ngưỡng
   theo số đo và mắt chủ dự án, quyết M8–M10 có chặn không; test năm kịch bản chặn.
4. Biểu đồ đủ số đo của trang soi (`α`, trượt chân trụ, góc M8, vạch clip); nối `sceneGaitProblems` vào `check`.

### 7.2 Giả thuyết cần đo

Chưa đo; mỗi giả thuyết nêu chỗ code và số đo xác nhận nó.

| # | Giả thuyết | Chỗ (`core/scene.ts`, `bakeWalker`) | Số đo | Hướng sửa |
|---|---|---|---|---|
| H1 | Hông chậm lại ở chỗ rẽ rồi vọt lên: nhịp chân đích là tốc `path` chiếu lên hướng thân (`want = V·F + along / TRACK_ALONG`), thân lệch hướng `path` `δ` thì nhịp tụt theo `cos δ`; phần tụt dồn lại thành `along`, bù trong `TRACK_ALONG` `0,5 s`. `rT` còn qua lọc `RATE_TAU`, sải và phần bù sải trước khi thành `rate` | quanh `want`, `rT` (dòng ~3210–3216) | M1 tụt / vọt / trễ, M4 đỉnh `rate` | Nhịp đích theo tốc dọc đường (` | V | `) khi đang lái, phần lệch ngang để lái thân lo |
| H2 | Thân bật quay, tắt quay đột ngột: tốc quay chặn cứng `TURN_WALK` `150°/s` (`Math.max(-turn, Math.min(turn, dy))`), không chặn gia tốc; hướng lái lọc bậc một `RATE_TAU` `0,15 s` (cú quay nối đi bỏ trần, đứng dùng `720°/s`) | dòng ~3269–3271, `steer += (sT − steer) · ease` (~3239) | M2 `α` | Lái bậc hai (giảm chấn tới hạn) có trần `α` (**MỚI** `TURN_ACCEL`) |
| H3 | `yaw` mốc giữa đường không theo hướng `path` (viết tay, mọi mốc `yaw: 0`) làm thân lái nửa vời: hướng tới chỗ nhìn trước lệch `yaw` khai quá `60°` thì lái nhạt dần, `120°` thì thôi (`STEER_BACK`) | `behind` (dòng ~3222–3233) | M8, M6, M2 trên K3 viết tay `yaw` `0` | `gen walk` đặt `yaw`; `check` kêu mốc lệch hướng `path` quá `45°` (`sceneWalkYawProblems`) |
| H4 | Vận tốc `path` gãy ở mốc: `keyAt` nội suy thẳng từng đoạn (đoạn `ease` theo `smoothstep`), hướng (và tốc, khi hai đoạn khác tốc) đổi trong một bước | `legOf`, `keyAt` (dòng ~2162–2186) | M1 gia tốc, M4 nhảy quanh mốc | Bộ sinh giữ tốc đều; nếu còn gãy: nội suy cong qua mốc giữa đường (đổi nghĩa `path` — breaking) |
| H5 | Khởi hành từ đứng không quay không có nhịp khởi hành: `turnOf` trả rỗng khi lệch `0` (kể cả khai `steps`) nên `turnWalks` không có chỗ nối, `path` rời chỗ ở đủ tốc, hông tụt rồi đuổi; `sceneLaunchProblems` chỉ đo sau cú quay | `turnOf` (dòng ~2208–2212), `turnWalks` (~2363) | M1 trễ, M4 đỉnh `rate`, nhãn `launch` trên K1 `--start rest` | Mở rộng chỗ nối quay rồi đi cho cú "đứng rồi đi" lệch `0`; `sceneLaunchProblems` đo cả nó |
| H6 | Trần `150°/s` hẹp cho vòng chữ U ở tốc đi thường: bán kính nhỏ nhất `v / ω` = `250 / 2,618` ≈ `95,5` ở `250` đơn vị/s | `TURN_WALK` | M2 thời gian chạm trần, M6 trên K5 với `r` `100` | Giữ trần, bộ sinh đòi `r ≥ v / ω_c` (`120°/s` → `119,4`); hay nâng trần nếu chân trụ không trượt (M3) và hình ổn |
| H7 | Nhìn trước `0,35 s` (`STEER_AHEAD`) làm thân rẽ sớm và cắt góc (`thu-khoi-z` của [03](03-scene.md#đi-theo-path): tới `~40`) | `ahead = keyAt(keys, t + STEER_AHEAD)` (~3217) | M6, M8 trên K3 | Nhìn trước theo quãng đường thay vì giây, hay nhỏ lại khi có cung bo |
| H8 | Luật trượt của `check` thô: cửa sổ `0,4 s`, kêu khi độ lớn tổng vector trượt quá nửa khoảng hông dời giữa hai đầu cửa sổ cộng `8` (`SLIDE_WINDOW`, `SLIDE_MIN`) — đi thẳng đều `250` đơn vị/s là `58` đơn vị, không thấy chân trụ trượt vài đơn vị | `sceneSlideProblems` (~1713–1792) | M3 so với dòng `check` | Giữ luật thô cho người đứng; M3 cho người đi |
| H9 | Cú quay đúng `180°`: chiều quay theo dấu lệch thô | `yawDelta` (`turnOf`, `keyAt`) | — (luật) | Có ở rig ([03](03-scene.md#quay-tại-chỗ)): lệch thô `b.yaw − a.yaw` đúng `±180` giữ dấu ấy, `0 → 180` quay phải, `0 → −180` quay trái. Breaking (`feat(rig)!:`): cảnh khai `0 → 180` quay phải |
| H10 | Clip đi đầu tiên khai `blend` > 0 ở giây `path` đã đủ tốc: người đứng `idle` rồi lao theo | `resolveTrack` (`tau`), `bakeWalker` | M1 trễ, vọt; M5 trên K1 `blend 0.3` / `0` (đo: trễ 61 → −2, giật `handL` 67 px → không) | `gen walk` `--start moving` ghi clip đi `blend 0`; `check` kêu clip đi hoà vào khi `path` đã chạy (`sceneWalkInProblems`) |

Hằng có thể đổi: `STEER_AHEAD`, `TURN_WALK`, `RATE_TAU`, `TRACK_ALONG`, `STEER_BACK`, `RATE_MAX`; thêm `TURN_ACCEL`. Đổi
hằng nào thì cập nhật số ở [03](03-scene.md#đi-theo-path) (các gạch đầu dòng nhịp chân, thân nhìn, đích mềm) và
[01](01-rig.md#chu-kỳ-đi) nếu đụng chu kỳ đi; đổi đường hông của cảnh có `path` là breaking (`feat(rig)!:`), commit nói rõ cảnh
đã căn có thể lệch chỗ hông giữa đường (mốc dừng không đổi).

### 7.3 Ngoài phạm vi

| | Bản đầu | Để sau |
|---|---|---|
| Đường đi | Điểm sàn cùng độ cao, góc mềm, cung bo, dừng, quay tại chỗ, quay rồi đi, đứng rồi đi | Lên xuống bậc, dốc; đổi tốc giữa chừng (`--speed` mỗi quãng); đi lùi, đi ngang; dừng giữa đường để làm việc khác (hai lệnh, `--at` sau) |
| Người | Một người mỗi lệnh | Hai người đi cạnh nhau giữ khoảng cách; né người khác |
| Trang soi | Năm kịch bản, chạy khô, bảng tự kiểm; ô nhìn từ trên, dải `v / vRef`, `ω`, `rate` ([3.3](#33-chỗ-hiện)) | Ghi vào repo; kéo điểm trên sàn bằng chuột; dải `α`, trượt chân trụ, góc M8, vạch clip |

## 8. Câu hỏi mở

Mỗi câu kèm đề xuất mặc định. Câu 1–6 đã chốt theo đề xuất (bộ sinh và rig làm đúng thế).

1. Rẽ `90°` khi đang đi: mặc định để rig bo đích mềm (`--radius 0`) hay bộ sinh luôn bo cung (`r` `125`)? Đề xuất: đích mềm tới
   `100°`, chốt sau khi so hai dải khung K3.
2. Bán kính vòng chữ U mặc định `0,5 m` (`125`)? Đề xuất: có (nhỏ nhất `119,4` ở `250` đơn vị/s).
3. Quay `180°` tại chỗ mặc định quay về phía ống kính (`--turn-side auto`)? Đề xuất: có; máy thẳng trục thì quay trái.
4. `gen walk` có ghi `scene.marks` cho giây dừng, giây rẽ (`a-dung-1`…) để tiếng, hình bám theo và `retime` dời được, hay chỉ
   ghi số? Đề xuất: chỉ ghi số ở bản đầu — ghi `marks` thì phạm vi vá mở thêm `scene.marks`.
5. Biểu đồ số đo và ô nhìn từ trên xuống trên trang soi có ở bản đầu không? Đề xuất: có — chúng là chỗ thấy khựng mà bảng
   số không chỉ ra được.
6. H9 — luật dấu cho cú quay đúng `180°` (breaking nhỏ: cảnh khai `0 → 180` quay phải). Đề xuất: làm, để quay phải nửa
   vòng là một cú hai nhịp chân luân phiên.
