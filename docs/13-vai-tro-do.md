# 13 — Vai trò của đồ

Đồ khai mình làm được gì trong một động tác (**vai trò**: vật rót, vật đựng, mặt ngồi, tay vịn, lưng ghế, để chân, mặt
bàn) kèm số đo bắt buộc của vai trò; bộ sinh hành động (`stickman gen <kiểu>`) khai mình cần vai trò nào; đồ đủ trường của
vai trò thì ghép được với bộ sinh.

## 1. Tổng quan

### Vai trò khác nhóm cầm

| | Nhóm cầm ([11](11-nhom-cam.md)) | Vai trò |
|---|---|---|
| Trả lời | Bàn tay ôm món thế nào | Món làm được gì trong một động tác |
| Ai dùng | Bộ giải tay của rig (`graspFrame`, `heldFit`) | Bộ sinh hành động (`gen pour`, `gen sit`) và luật kiểm của nó |
| Nguồn | Rig **suy từ hình** (`itemGeom`); món không khai cách cầm | Món hay đồ của cảnh **khai**; vài vai trò rig suy được từ hình ([mục 4](#4-suy-và-khai)) |
| Ví dụ | `cylinder` trên thân chai, `handle` trên quai cốc | Chai là vật rót: miệng rót ở đâu, rót về hướng nào |

Vai trò không nói tay đặt ở đâu (món không khai cách cầm). Vật rót nói miệng rót và hướng rót; chỗ cầm là
`world.hands[].hold` của cảnh hay chỗ cầm mặc định của bộ sinh, rig giải tay theo nhóm cầm.

**Một món nhiều vai trò.** Ấm là vật rót và vật đựng; ghế bành là mặt ngồi, hai tay vịn và lưng ghế; ghế bar là mặt ngồi
và để chân. Vai trò không phải phân loại món: không có "nhóm ghế", chỉ có các mục vai trò gắn vào một vật.

**Chỉ thêm vai trò khi có bộ sinh dùng nó.** Bảng vai trò là đúng những gì `gen pour` và `gen sit` đọc. Bộ sinh mới cần
vai trò mới thì thêm vai trò ấy cùng lúc, kèm [trang soi](#9-trang-soi-bộ-sinh) của bộ sinh ([mục 8](#8-thêm-vai-trò-thêm-bộ-sinh)).

### Ba lớp

| Lớp | Nằm ở | Khai gì | Không khai gì |
|---|---|---|---|
| **Vai trò** | Rig, `core/roles.ts` (`ROLES`) | Trường bắt buộc và tuỳ chọn, kiểu hình học của từng trường, vật nào mang được (món cầm tay, đồ của cảnh), luật zod, cách suy từ hình | Món hay ghế cụ thể; bộ sinh nào dùng |
| **Đồ** | `held/<món>.json` (`roles`), đồ của cảnh trong `stickman.world` (`Item.roles`, `withRoles`) | Các mục vai trò của chính nó, trong khung của nó | Động tác, chỗ tay |
| **Bộ sinh** | `@stickman3d/cli`, `GEN_KINDS[kiểu].roles` | Chỗ cần vai trò (`slot`): vai trò nào, bắt buộc khi nào, tìm trong cảnh thế nào, cờ CLI nào chỉ đích danh | Số đo của đồ |

### Luồng dữ liệu

```
held/<món>.json ── roles (khai) ─┐
                 shape (lathe có wall) ── suy ─┤
                                                ├─► heldRoles(spec)        khung món
stickman.world ── pose(t) ── Item.roles / withRoles ──────► rolesOf(root)  thế giới rig ở t, kèm chủ
cờ CLI là số (--table 80, --armrest x,y,z) ── đồ ảo ──────► cùng RoleSchema
                                                ▼
GEN_KINDS[kiểu].roles (slot) ── tìm theo vai trò + chỗ so với người ─► đồ cho từng slot
                                                ▼
                     phép tính của bộ sinh (gen-pour.mjs, gen-sit.mjs) ── tự kiểm (gen-check.mjs)
```

## 2. Hệ toạ độ và kiểu hình học

Mỗi mục vai trò viết trong **khung của vật mang nó**, đơn vị rig; bộ đọc vai trò đổi ra thế giới rig ở giây đang xét, bộ
sinh chiếu tiếp sang hệ của nó.

| Vật mang | Khung | Trục | Đổi ra thế giới |
|---|---|---|---|
| Món cầm tay (`held/`) | Khung món, như `anchors` | y lên, +z mặt trước món, đơn vị rig | Như mốc món: `actHeld` (món trong tay), `itemAt` (mốc món của `items[]`), nhân cỡ món |
| Món khối (`Item` của `khoi.ts`) | Toạ độ món của `parts` | Hệ rig: y **xuống**, +x là hướng mặt của món (ghế: hướng người ngồi nhìn), đơn vị rig | `place3(item.at, p)` rồi khung nút nhóm `Batch.build()` |
| Nút three khai bằng `withRoles` | Như `Item`, gốc ở gốc nút | Như `Item` | `toThree(p)` trong hệ local của nút, nhân `matrixWorld`, đổi ngược `toThree` về thế giới rig |

| Bộ sinh | Hệ | Gốc |
|---|---|---|
| `gen sit` | `[tiến, lên, phải]` (`frameOf` của `gen-sit.mjs`) | Hông người ngồi |
| `gen pour` | Hệ thân `[tiến, y xuống, ra ngoài]` (như `SINGLE.lip`, `SERVE.lip`) | Mốc `chest` của người rót, chia `world.s` |

**Phép đặt được nhận.** Từ khung vật ra thế giới chỉ gồm tịnh tiến, quay quanh trục đứng và cỡ đồng đều dương (`Place3`
có `yaw`, `s`; nút cha cũng vậy). `rolesOf` gặp nghiêng, cỡ không đều hay lật thì báo lỗi cho vật ấy, không đọc vai trò của
nó: mặt ngồi tròn thành ellipse, `Rect` ngang thành nghiêng là thứ bộ sinh không xử lý. Điểm đi qua cả phép đặt; hướng chỉ
quay; độ dài (`size`, `width`, `thick`, `r`) nhân cỡ.

**Bẫy:** khung món cầm tay y lên, khung `Item` y xuống. Cùng một chén khai làm món cầm tay và làm món khối trên bàn thì số
y ngược dấu. Trong khung `Item`, bên phải người nhìn theo +x là **−z**; bên của tay vịn rig tự suy ([3.4](#34-armrest--tay-vịn)),
không khai.

Kiểu hình học dùng chung (`core/roles.ts`):

| Kiểu | Dạng | Ghi chú |
|---|---|---|
| `Point` | `[x, y, z]`; ở món cầm tay thêm tên mốc hay `{ anchor, offset }` (`AnchorRef` của `heldItem.ts`) | |
| `Dir` | Vectơ khung; ở món cầm tay thêm tên mốc có `dir` (như `front`, `top` của món) | Chuẩn hoá khi đọc; vectơ không là lỗi |
| `Rect` | `{ at, size: [sâu, rộng], front? }` | Hình chữ nhật nằm ngang: tâm `at` trên mặt, cạnh `sâu` dọc `front`, `rộng` ngang. `front` ngang, bỏ trống là +x của `Item` |
| `Segment` | `{ from, to, width }` | Đoạn trên một mặt kèm bề rộng mặt ấy |
| `Poly` | `{ y, poly: [[x, z], …] }` | Đa giác lồi nằm ngang ở độ cao `y`, đỉnh xếp vòng |

## 3. Bảng vai trò

Mỗi mục là `{ "role": "<id>", "name"?: "<tên>", …trường }`. `name` (`[a-z0-9-]+`) phân biệt hai mục cùng vai trò trên một
vật (hai tay vịn) và để cờ CLI gọi đích danh (`ban-an#tren`), duy nhất trong một vật; bỏ trống thì mục gọi bằng tên vật.

| Vai trò | Nghĩa | Vật mang | Bắt buộc | Tuỳ chọn | Suy từ hình | Bộ sinh |
|---|---|---|---|---|---|---|
| `pourer` | Vật rót | Món cầm tay | `lip` | `spout` | `spout` từ `lip` lệch trục | `gen pour` (bình) |
| `vessel` | Vật đựng | Món cầm tay, đồ của cảnh | `mouth.at`, `mouth.r` | `mouth.dir` | Cả mục, từ `lathe` có `wall` | `gen pour` (đích rót) |
| `seat` | Mặt ngồi | Đồ của cảnh | `at`, `size` | `front` | — | `gen sit` |
| `armrest` | Tay vịn | Đồ của cảnh | `from`, `to`, `width` | — | — | `gen sit --hands armrest` |
| `backrest` | Lưng ghế | Đồ của cảnh | `from`, `to`, `width` | `front` | — | `gen sit` (`recline`, kiểm lấn) |
| `footrest` | Để chân | Đồ của cảnh | `at`, `size` | `front` | — | `gen sit` (mặt đỡ bàn chân) |
| `tabletop` | Mặt bàn | Đồ của cảnh | `y`, `poly`, `thick` | — | — | `gen sit --hands table`, kiểm gối |

Vai trò của đồ của cảnh không khai được trên món cầm tay ở bản đầu (zod: "vai trò `seat` chỉ khai ở đồ của cảnh").

### 3.1 `pourer` — vật rót

| Trường | Kiểu | Nghĩa |
|---|---|---|
| `lip` | `Point` | Điểm dòng chảy rời món: mép vòi, mép miệng phía rót |
| `spout` | `Dir` | Hướng dòng rời `lip` khi nghiêng. Bỏ trống: hướng từ trục tới `lip`. Khai hay suy, bộ rót đều chiếu `spout` lên mặt vuông góc trục rồi chuẩn hoá |

Bộ rót giải bốn thứ theo thứ tự, mỗi bước một nghiệm:

1. **Phần cầm.** Cảnh khai `world.hands[].hold.part` thì lấy phần ấy. Không thì xét mọi đoạn bám liền (`gripSpan` của
   [11](11-nhom-cam.md#khối-hình-rig-suy-ra-itemgeom)) trên khối `lathe` không chứa `lip` và đạt `needs` của nhóm
   `cylinder` với cỡ tay người rót; lấy đoạn dài nhất. Hai đoạn dài lệch dưới `1` là lỗi kèm tên phần: "chỉ phần cầm bằng
   `world.hands[].hold.part`". Phần cầm mặc định là phần của khối ở đầu dưới đoạn (phía ngược `top`). Điều kiện cầm phụ
   thuộc cỡ tay nên kiểm lúc chạy, không phải zod. Rót bằng quai (`handle`) để sau.
2. **Trục món** là trục của khối `lathe` ấy, hướng lên về phía `top` của món.
3. **`along`** mặc định là hằng của bộ rót `POUR_ALONG` (`0,3` của đoạn bám, chỗ thân thẳng dưới vai bình), không mang tên món.
4. **`around`** mặc định là `around` của kiểu (`SINGLE`, `SERVE`, đo với vòi ở `ρ(0)`) cộng góc quay quanh trục từ `ρ(0)`
   tới `spout` (cùng chiều `ρ(90) = a × ρ(0)` của [11](11-nhom-cam.md#khối-hình-rig-suy-ra-itemgeom)). Ấm vòi `+x` vì vậy
   cầm đúng như chai vòi `+z`.

zod (`superRefine` của `HeldItemSchema` gọi `itemGeom` để có trục, như luật `top` lệch miệng):

- thiếu `lip` — "vai trò `pourer` cần `lip` (điểm rót: mốc hay điểm khung món)";
- `lip` nằm trên trục mà không khai `spout` — "`pourer`: `lip` nằm trên trục món, khai `spout` (hướng rót)";
- `spout` lệch trục dưới `45°` — lỗi. Từ `45°` trở lên thì chiếu như trên; `spout` khai lệch hướng suy quá `30°` là cảnh báo
  ([mục 4](#4-suy-và-khai)), không lỗi.

```jsonc
// held/binh.json — thêm vào món
"roles": [{ "role": "pourer", "lip": "mouth" }]
// mốc mouth [0, 17, 6], trục y: spout suy ra +z
```

### 3.2 `vessel` — vật đựng

| Trường | Kiểu | Nghĩa |
|---|---|---|
| `mouth.at` | `Point` | Tâm miệng |
| `mouth.r` | số `> 0` | Bán kính trong của miệng |
| `mouth.dir` | `Dir` | Hướng ra của miệng; bỏ trống là `top` của món (món khối: lên) |

- **Suy từ hình** (món cầm tay): phần có `lathe` với khối `wall` ở đúng một đầu (miệng mà `itemGeom` đã tìm) cho cả mục —
  `at` là tâm đầu ấy, `r` là bán kính ngoài ở đầu ấy trừ `wall`, `dir` là trục hướng ra đầu ấy. `held/chen.json` không phải
  khai gì: miệng `[0, 4.5, 0]`, `r` `7`. Món có hai miệng suy được là lỗi ("khai `vessel` cho miệng dùng").
- Món có miệng suy được mà khai thêm `vessel`: khai phải trùng miệng suy (tâm lệch tới `0,1 · r`, bán kính lệch tới `10 %`,
  hướng lệch tới `10°`), lệch hơn là lỗi parse — một miệng, một nguồn, như luật `top` lệch miệng của [11](11-nhom-cam.md#trường).
- Món không có `wall` (cốc, ly đặc) thì khai. Đồ của cảnh (chén khối trên bàn) thì khai, không suy.
- Một món một `vessel` ở bản đầu.

```jsonc
// held/coc.json
"roles": [{ "role": "vessel", "mouth": { "at": "rim", "r": 7.5 } }]
// held/ly.json
"roles": [{ "role": "vessel", "mouth": { "at": "mouth", "r": 10.8 } }]
```

### 3.3 `seat` — mặt ngồi

| Trường | Kiểu | Nghĩa |
|---|---|---|
| `at`, `size`, `front` | `Rect` | Mặt trên chỗ ngồi; `size` `[sâu, rộng]`; `front` là hướng người ngồi nhìn |

Ghế dài là một `seat` rộng, không chia chỗ ([6.6](#66-điểm-ngồi-và-ghế-dài)).

Bộ ngồi đọc từ mặt ngồi: độ cao, mép trước, mép sau, hai mép bên. Luật của tự kiểm (`s` là `world.s` của người ngồi, nửa
đùi là `limbHalf(c).leg · s`):

| Luật | Đo | Ngưỡng |
|---|---|---|
| ngồi trên mặt | điểm ngồi ([6.6](#66-điểm-ngồi-và-ghế-dài)) so với mặt ngồi chứa nó | lệch độ cao quá `1 · s`: cảnh báo; quá `3 · s`: lỗi ("người lơ lửng / lún mặt ngồi 4,2: đặt `world.at[1]` = −87,5") |
| mông lọt mép | đuôi mông sau hông (khối thân `markShape` ở tầm hông, cộng phần nhô sau của áo `backExtra`) so với mép sau; hông `± (hipHalf + nửa đùi)` so với hai mép bên | ra ngoài mép sau mà không chạm lưng ghế, hay ra ngoài mép bên: lỗi |
| ngồi nông | hông tới mép trước | dưới `⅓` đùi (`RIG.thigh · hs`): cảnh báo |
| đùi lún mép trước | mép trước (theo hướng mặt người, từ từng khớp hông) so với mặt dưới đùi (ống thon `CLAD_TAPER.leg` từ khớp hông tới gối) | lún quá `THIGH_SINK` `4 · s`: lỗi |

Bộ ngồi không dời hông. Đùi chỉ chúi xuống tới khi mặt dưới đùi lún mép trước `THIGH_SINK` (`thighLow`): hông càng gần mép
trước thì đùi càng chúi được. Chân co, chân duỗi thử góc ống chân trong tầm kiểu rồi dựng dần về phương đứng tới `±10°`;
vẫn không với tới sàn thì lỗi, kể cả `--feet free`; chân so le thì chân không với tới về vuông. Chỉ chân vuông thõng (với
`--feet free`) — đùi nằm trên mặt ngồi (vừa chạm mép), ống chân đứng, không cắt mép trước —, `--feet floor` thì lỗi. Không có `seat` thì đùi chúi tới
`THIGH_RANGE[0]` (`60°` từ phương đứng) như ghế không mép.

### 3.4 `armrest` — tay vịn

| Trường | Kiểu | Nghĩa |
|---|---|---|
| `from`, `to`, `width` | `Segment` | Đường giữa mặt trên, đầu sau → đầu trước; bề rộng mặt trên |

- Bên (phải, trái người ngồi) rig suy từ chỗ đoạn so với mặt ngồi cùng vật, không khai.
- Tay vịn gần ngang. zod: `from` trùng `to`; đoạn dốc quá `10°` so với mặt ngang. Bề rộng đo theo hướng ngang
  vuông góc đoạn; độ cao mặt tay vịn ở một điểm là độ cao của đoạn tại đó.
- Người nghỉ tay trên tay vịn bằng **cẳng tay**, không bằng bàn tay. Bộ ngồi đặt **khuỷu**: cách vai đúng cánh tay trên
  (`bones3`), mặt dưới cẳng tay ở khuỷu chạm mặt tay vịn (lún `ARMREST.sink`); chỗ tự nhiên là giao của mặt cầu ấy với mặt
  tay vịn, phía trước vai, khuỷu trên đường giữa tay vịn hay lệch vào trong ít nhất mà với tới (qua mép trong tới
  `0,7` bán kính cẳng tay thì cẳng tay tì mép trong). Không với tới ở góc thân của kiểu lưng thì thân nghiêng dần trong tầm
  `BACK_STYLES[back].band` (tựa lưng ghế thì thân cố định). Cánh tay trên dốc quá `60°`, khuỷu cách hai đầu đoạn dưới `4 · s`
  hay không với tới là lỗi.
- Cẳng tay nằm dọc tay vịn về trước, mặt dưới song song mặt; khuỷu gần đầu trước (cẳng tay chìa quá `to` hơn `0,3`
  cẳng tay — thân nghiêng về trước) thì cẳng tay xoay vào trong qua mép trong, tới `ARMREST.turn` `35°` khi chìa `0,7`. Bàn
  tay thả, lòng tay úp, ra khỏi tay vịn thì buông xuống tới `HAND_DROOP` `35°`. `fold` chồng hai bàn tay trước bụng, lòng tay trên áp mu tay dưới; khuỷu được lòi qua mép ngoài tới `0,5` bán kính khuỷu (docs/05).
- `--elbow <d>` dời khuỷu dọc tay vịn `d · hs` (dương ra trước). Cách bù: chỗ khuỷu trên bề ngang tay vịn trước (gần chỗ
  mặc định nhất), rồi góc thân trong `band`. Không đặt được là lỗi nêu tầm dời được.
- Luật "đặt trên mặt": khe từ mặt dưới cẳng tay (ống thon `CLAD_TAPER.arm`, nhiều điểm dọc phần nằm trên mặt) tới mặt tay vịn (qua mép
  trong thì tới mép) trong `FOREARM_REST` `−4…2` (nhân `s`); khuỷu nằm trong đoạn, cách đường giữa không quá
  `width / 2 + 0,7` bán kính cẳng tay.

### 3.5 `backrest` — lưng ghế

| Trường | Kiểu | Nghĩa |
|---|---|---|
| `from`, `to`, `width` | `Segment` | Trên mặt trước: giữa mép dưới → giữa mép trên; lưng ngả thì `to` lùi sau `from` |
| `front` | `Dir` | Phía người tựa; bỏ trống là `front` của mặt ngồi cùng vật, không có thì +x của `Item` |

- Mặt trước là mặt chứa đoạn `from → to` và hướng ngang vuông góc `front`; pháp tuyến về phía `front`.
- `recline` ngả tới khi mặt lưng cách **mặt nghiêng ấy** `BACK_GAP`, trong dải cao `from`–`to`; lưng thẳng, nghiêng về
  trước thì kiểm lấn với cùng mặt.
- Không bắt buộc với mọi ghế: ghế đẩu không khai, `recline` khi đó ngả `−12°` kèm cảnh báo (không gì đỡ lưng).

### 3.6 `footrest` — để chân

| Trường | Kiểu | Nghĩa |
|---|---|---|
| `at`, `size`, `front` | `Rect` | Mặt đỡ bàn chân |

- `sâu` dưới `40 · s` là **thanh** (ghế bar): bàn chân đặt sao cho thanh nằm dưới đế giày, giữa gót và mũi; rộng hơn là
  **bệ**: đế giày đặt trên mặt.
- Vòng để chân của ghế bar khai bằng đoạn trước của vòng (một `Rect` hẹp). Vòng tròn đúng hình để sau.

### 3.7 `tabletop` — mặt bàn

| Trường | Kiểu | Nghĩa |
|---|---|---|
| `y`, `poly` | `Poly` | Mặt trên: đa giác lồi ở độ cao `y` (bàn chữ nhật là bốn đỉnh; bàn tròn, bàn góc là đa giác nội tiếp) |
| `thick` | số `> 0` | Bề dày tấm mặt: mặt dưới là `y + thick` (y xuống) |

- zod: `poly` ít nhất ba đỉnh, lồi, không trùng đỉnh.
- Bộ ngồi kiểm gối, đùi dưới mặt dưới trong đa giác; `--hands table` đặt lòng tay vào trong mép gần như luật bàn của
  [05](05-repo-video.md#ngồi-theo-ghế-của-cảnh). Đặt đồ lên bàn dùng lại vai trò này khi có bộ sinh ấy.

### Luật zod chung

`RoleSchema` là `z.discriminatedUnion("role", …)` của bảy vai trò; `RolesSchema` là mảng của nó. Dòng báo nêu chỗ khai,
đường dẫn (`roles[2].width`), vai trò và nghĩa của trường thiếu — nghĩa lấy từ `describe` của trường trong `ROLES`, chung cho
zod, form của trang soi và MCP. Đồ của cảnh không biết file code của từng vật: dòng báo mang entry `stickman.world` và tên vật.

```
held/coc.json: roles[0]: vai trò `vessel` cần `mouth.r` (bán kính trong của miệng)
held/coc.json: roles[0]: vai trò lạ `cup`; có: pourer, vessel, seat, armrest, backrest, footrest, tabletop
src/khoi3d/index.ts → vật `ghe-banh`: roles[3]: `armrest` có `from` trùng `to`
```

- Hai mục cùng vai trò trên một món cầm tay là lỗi; trên đồ của cảnh thì được, `name` phải khác nhau.
- Trường lạ trong mục là lỗi (`strictObject`): gõ sai tên trường không lặng lẽ thành mặc định.

## 4. Suy và khai

| Vai trò | Suy được | Khai lệch hình |
|---|---|---|
| `vessel` của món cầm tay có `lathe` + `wall` | Cả mục | Tâm quá `0,1 · r`, bán kính quá `10 %`, hướng quá `10°`: lỗi parse ([3.2](#32-vessel--vật-đựng)) |
| `pourer` | `spout` từ `lip` lệch trục | `spout` lệch trục dưới `45°`: lỗi parse; lệch hướng suy quá `30°`: cảnh báo của `describe_held` / `check` (vòi cong có thể rót lệch) |
| Mọi vai trò của đồ của cảnh | Không | `check` cảnh báo ([mục 7](#7-check-mcp-hai-lớp)) |

- **Món cầm tay không suy `vessel` từ mốc tên `mouth`, `rim`**: chén có mốc `mouth`, chai cũng có, nghĩa khác nhau; tên mốc
  không phải vai trò. Bộ rót đọc vai trò, không đọc tên mốc.
- **Đồ của cảnh không suy** mặt ngồi, tay vịn, lưng ghế từ khối: khối của đồ cảnh là vật cản cho `collide`, không mang
  nghĩa. Bộ sinh không đoán vai trò theo tên và chỗ khối.
- `heldRoles(spec)` trả mục khai cộng mục suy, mỗi mục mang `source: "declared" | "inferred"`.

## 5. Khai ở đâu

### 5.1 Món cầm tay: `held/<món>.json` → `roles`

`roles` (mảng `RoleSchema`, chỉ vai trò mang được trên món cầm tay) là trường của `HeldItemSchema`, kiểm trong `superRefine`
cùng các luật mốc: `Point` là tên mốc thì mốc phải có, `Dir` là tên mốc thì mốc phải có `dir`.

**`HELD_VERSION` 4.** Bất biến "file đời mới hơn rig thì zod báo lỗi phiên bản": `HeldItemSchema` là `z.object` thường, rig
bản 3 nạp món có `roles` sẽ lặng lẽ bỏ trường ấy. Món có `roles` phải ghi `schemaVersion: 4`. `migrateHeldItem` nâng `2`, `3`
lên `4` chỉ đổi số (không sinh `roles` từ mốc, vì tên mốc không nói vai trò); file bản `2`, `3` mà có `roles` thì giữ số, zod
báo "`roles` cần `schemaVersion` 4". Studio 3D vá JSON thô: lưu món bản 3 không có `roles` thì số giữ `3` (`heldWithAuthored`
chỉ nâng số khi file mang trường của bản mới hơn); `stickman check` không báo món bản 3.

### 5.2 Đồ của cảnh

Đồ của cảnh là code three trong `stickman.world` của repo video (`addItem` của món khối, lưới three dựng tay). Vai trò khai
ngay cạnh hình, một nguồn; vật dời, ẩn theo `t` thì vai trò theo, vì `rolesOf` đọc trên cảnh three đã `pose(t)`:

| Khai ở | Cho | Khung |
|---|---|---|
| `Item.roles` — lối chính | Món khối qua `addItem` | Khung `Item` |
| `withRoles(obj, roles)` của rig (kiểu TypeScript, gọi `parseRoles`) | Nút three không qua `addItem`: lưới dựng tay, mô hình nạp vào | Khung local của nút |

**Mỗi vật một bản ghi có chủ.** Một nhóm `Batch.build()` gộp hình của nhiều `Item` (nhiều ghế, bàn), nên vai trò không gắn
vào nhóm như một vật:

| Nguồn | Ghi ở | Bản ghi |
|---|---|---|
| `addItem` của `Item` có `roles` | `Batch` giữ, `build()` chép ra `userData.itemRoles` của nhóm (cạnh `userData.colliders`) | Mỗi `Item` một bản ghi `{ owner, name, place, roles }`: `owner` là số thứ tự `Item` trong `Batch`, `place` là `Item.at`, `roles` trong khung `Item` |
| `withRoles(obj, roles)` | `userData.roles` của chính nút | Nút là chủ; `roles` trong khung local của nút |

`addItem` gắn cùng `owner` vào khối `collide` của `Item` (`SolidTag`), để luật lệch hình đo vai trò với đúng khối của vật ấy.
`Item` trong cùng một `Batch` dời, ẩn cùng nhóm.

Bộ đọc `rolesOf(root)` của rig (cạnh `colliders` của `collide.ts`) đi cây như `colliders`: bỏ nhánh ẩn, đổi mỗi bản ghi ra thế
giới rig một chỗ (`place3` rồi `matrixWorld`, giới hạn phép đặt ở [mục 2](#2-hệ-toạ-độ-và-kiểu-hình-học)), trả mỗi mục kèm chủ
(nút cộng `owner`), tên vật (`Item.name`, không thì `name` của nút gần nhất có tên, như dòng báo của `collide`), toạ độ thế
giới rig, lỗi zod nếu có. JSON vai trò viết trong code vẫn đi qua zod — `rolesOf` gọi `parseRoles`, không dùng object thô.

```ts
// src/khoi3d/phong.ts của repo video — ghế bành, khung Item (+x hướng mặt, y xuống, mặt ngồi ở y 0)
const gheBanh: Item = {
  name: "ghe-banh",
  at: { at: [-240, -87.5, 0], yaw: 0 },
  touch: ["thigh", "torso"],
  parts: [/* mặt ngồi, lưng, tay vịn, chân */],
  roles: [
    { role: "seat", at: [3.5, 0, 0], size: [117, 96] },
    { role: "backrest", from: [-55, -24, 0], to: [-60, -80, 0], width: 96 },
    { role: "armrest", name: "phai", from: [-61, -62, -63], to: [62, -62, -63], width: 10 },
    { role: "armrest", name: "trai", from: [-61, -62, 63], to: [62, -62, 63], width: 10 },
  ],
};
```

Ghế, bàn, ghế bành của `previewProps` (Thư viện) mang `roles` như đồ thật ([9.2](#92-đồ-thử-dựng-bằng-chính-khai-báo-vai-trò)).

## 6. Bộ sinh khai vai trò cần

### 6.1 `GEN_KINDS[kiểu].roles`

Mỗi bộ sinh khai danh sách **slot**: chỗ trong phép tính cần một vật mang vai trò.

```js
// packages/cli/gen.mjs
sit: {
  run: genSit,
  roles: [
    { slot: "seat",     role: "seat",     need: "auto",                         find: "underHip" },
    { slot: "backrest", role: "backrest", need: "auto",                         find: "sameAsSeat", flag: "backrest" },
    { slot: "armrest",  role: "armrest",  need: { hands: ["armrest", "fold"] }, find: "sameAsSeat", flag: "armrest", per: "side" },
    { slot: "table",    role: "tabletop", need: { hands: "table" },              find: "ahead",      flag: "table" },
    { slot: "footrest", role: "footrest", need: "auto",                         find: "sameAsSeat", flag: "footrest" },
  ],
},
pour: {
  run: genPour,
  roles: [
    { slot: "bottle", role: "pourer", need: "always", find: "heldRight", flag: "item" },
    { slot: "cup",    role: "vessel", need: "always", find: "flag",      flag: "cup", point: true },
  ],
},
```

| Trường slot | Nghĩa |
|---|---|
| `need` | `always`; `auto` (dùng nếu tìm thấy, không thì phép tính đi nhánh không có); hay điều kiện theo tham số (`{ hands: "table" }`; danh sách `{ hands: ["armrest", "fold"] }` là một trong số ấy) — đúng điều kiện thì bắt buộc, sai thì như `auto` |
| `find` | Cách tìm khi không có cờ ([6.2](#62-tìm-đồ-trong-cảnh)) |
| `flag` | Cờ CLI (và tham số MCP cùng tên) chỉ đích danh |
| `per: "side"` | Slot lấy đúng một mục mỗi bên người (tay vịn) |
| `point: true` | Slot nhận một điểm thế giới hoặc một vật mang vai trò: đích rót là một điểm, vật đựng thêm cỡ miệng ([6.4](#64-gen-pour)). Điểm không qua `RoleSchema`, không phải đồ ảo |

`stickman gen <kiểu> --help` và tool `gen` của MCP in bảng slot từ đây.

### 6.2 Tìm đồ trong cảnh

Bộ sinh chọn mục cho mỗi slot ở giây `--at`, trên cảnh three đã `pose(--at)`, rồi giữ **danh tính** mục ấy (chủ cộng mục);
phép đo của tự kiểm đọc lại hình của chính mục ấy ở từng giây mẫu. Mục dời quá `1` trong quãng thì cảnh báo, như cốc dời trong
quãng rót. Thứ tự cho mỗi slot:

1. **Cờ** có giá trị: tên vật (`ghe-banh`), tên vật kèm tên mục (`ban-an#tren`), số ([6.3](#63-cờ-là-số-đồ-ảo)), hay
   `none` (bỏ slot `auto`; `none` chỉ tắt vai trò, không tắt va chạm của vật). Tên vật không mang vai trò của slot là lỗi kèm
   danh sách vật mang vai trò ấy trong cảnh: `--table ban-tra: vật không khai vai trò \`tabletop\`; vật có: ban-an, quay`.
   Tên vật có nhiều mục của vai trò mà slot cần một thì lỗi kèm tên các mục. Slot `per: "side"` nhận tên vật, không nhận
   `#mục`: mỗi bên lấy đúng một mục `armrest` của vật ấy.
2. **Tìm theo vai trò**, trong hệ người ngồi hay người rót:
   - `underHip`: mặt ngồi chứa hình chiếu của điểm ngồi (nới `2 · s` quanh mép), độ cao lệch điểm ngồi dưới `3 · s`. Hai mặt
     ngồi cùng đạt là lỗi kèm tên cả hai ("mặt ngồi chồng nhau: sửa vai trò"). Có mặt ngồi chứa hình chiếu mà độ cao lệch từ
     `3 · s` là lỗi "ngồi trên mặt" ([3.3](#33-seat--mặt-ngồi)).
   - `sameAsSeat`: mục của **cùng chủ** với mặt ngồi đã chọn (so chủ, không so tên vật hay nhóm), đúng phía (lưng ghế sau
     hông, tay vịn hai bên hông, để chân dưới mặt ngồi). Nhiều mục đúng phía là lỗi kèm tên mục. Vật khác không được chọn
     ngầm: ghế đẩu đặt sát tường không mượn tường làm lưng ghế.
   - `ahead`: vật trước mặt trong tầm (mép gần trước hông dưới `150 · hs`, mặt trên cao hơn mặt ngồi `20…90 · hs`), gần
     nhất. Hai vật cách nhau dưới `10 %` khoảng gần nhất là lỗi kèm tên cả hai: chọn bằng cờ.
   - `heldRight`: món trong tay phải (`world.hands[].right.hold`) của người rót ở giây
     ấy, không thì món `--item` (mặc định `binh`).
   - `flag`: chỉ theo cờ (đích rót là ý định của cảnh, không đoán).
3. Không thấy: slot `always` hay đúng điều kiện là lỗi; `auto` đi nhánh không có kèm một dòng in (mặt ngồi: mặt ngang qua
   điểm ngồi, không kiểm mép; lưng không tựa; bàn chân trên `world.floor`).
4. **Tay vịn**: slot `per: "side"` thiếu một bên là lỗi ("`ghe-don` chỉ có tay vịn bên phải"); rig không dựng bên đối xứng
   từ vai trò khai trên đồ thật.

**Mức của luật kiểm lấn.** Vật mà phép tính dùng (lưng ghế khi `recline`, bàn khi `--hands table`, tay vịn khi
`--hands armrest`) hay vật chỉ đích danh bằng cờ: luật lấn của nó là lỗi. Vật chỉ tự tìm để kiểm (lưng ghế khi `upright`,
`forward`; bàn trước mặt khi tay không đặt lên bàn): luật lấn của nó là cảnh báo. Lấn thật vẫn ra dòng `clash` của `check`.

Vật không khai vai trò thì không có vai trò. Phép đo của bộ sinh đọc mục vai trò, không đọc khối: khe gối dưới bàn đo trên
`tabletop`.

### 6.3 Cờ là số: đồ ảo

Cờ số của `gen sit` dựng một mục vai trò trong bộ nhớ, qua đúng `RoleSchema`, rồi đi chung đường với vật thật — không có nhánh
tính riêng cho số. Mọi số dưới đây ở hệ người ngồi, nhân `hs` = `height · s` trừ khi ghi `s`; mặt ngồi là điểm ngồi.

| Cờ | Mục dựng ra |
|---|---|
| `--table <y \| y,mép gần>` | `tabletop` bốn đỉnh ở `y` thế giới: mép gần trước hông `near` (mặc định `80`), sâu `90`, rộng `220` đối xứng qua hông, `thick` `6` |
| `--armrest <x,y,z>` | Hai `armrest` đối xứng qua mặt dọc qua hông: `to` ở điểm ấy (và điểm đối xứng), `from` lùi `110` theo hướng tiến, `width` `12 · s` |
| `--backrest <khoảng>` | `backrest` đứng, mặt trước sau hông ngần ấy, `from` cao hơn mặt ngồi `24`, `to` cao `80`, `width` `200` (không giới hạn ngang trong tầm thân) |
| `--footrest <y>` | `footrest` bệ ở độ cao `y` thế giới, tâm dưới hông, `size` `[400, 400]` (phủ mọi chỗ bàn chân với tới: mặt đỡ không giới hạn như sàn) |

`--cup x,y,z` của `gen pour` là **điểm đích**, không dựng đồ ảo (slot `point`, [6.4](#64-gen-pour)).

### 6.4 `gen pour`

- **Bình**: món của slot `bottle` phải có `pourer`. Bộ rót dùng `lip` ở mọi chỗ cần miệng bình (liên kết tay–bình đo `lip`
  trên người rót, luật điểm tiếp xúc so `lip` với đích). Thiếu: "món `am-tra` không khai vai trò `pourer` — thêm
  `roles: [{ role: "pourer", lip: … }]` vào held/am-tra.json".
- **Đích rót** (slot `cup`, `point: true`) là điểm hoặc vật mang `vessel`; `vessel` luôn có `mouth.r`:
  - **Vật đựng**: `--cup <người>` lấy món mang `vessel` trong tay người ấy (hai tay đều mang thì lấy tay phải, kèm dòng in);
    `<người>:<món>`; `<món>` của `items[]`; `<vật>` của cảnh three mang `vessel` (đọc ở từng giây mẫu). Đích là tâm miệng
    `mouth.at`. Món, vật không mang `vessel` là lỗi kèm danh sách món mang `vessel` trong cảnh.
  - **Điểm**: `--cup x,y,z` thế giới rig. Không có miệng nên không có luật miệng.
- **Luật điểm rót trong miệng** (chỉ khi đích là vật đựng): hình chiếu của `lip` lên mặt miệng nằm trong `r` suốt quãng
  tiếp xúc; ra ngoài là cảnh báo. Luật đo một điểm, không đo cỡ vòi: không kết luận vòi lọt hay không lọt miệng.
- **Liên kết vòng một.** Vòng một ước lượng liên kết tay–bình từ vai trò của món — `gripR` là bán kính thân
  ở `along` của đoạn bám, `mouth` là `lip` so với điểm cầm chiếu lên trục (dọc) và lên `spout` (ngang), `around` như
  [3.1](#31-pourer--vật-rót). Vòng hai đo lại liên kết trên chính người rót (`measureLink`), nên vòng một chỉ cần gần đúng.
- **Đo trên người**: `probe` lấy trục bình là trục món ([3.1](#31-pourer--vật-rót)) và vòi là `spout` đã giải, qua `actHeld`.

### 6.5 `gen sit`

- Mặt ngồi là slot `seat` (`auto`, `underHip`); độ cao mặt ngồi đọc từ `seat`, so với điểm ngồi theo luật "ngồi trên mặt"
  ([3.3](#33-seat--mặt-ngồi)). Không có `seat` thì mặt ngồi là mặt ngang qua điểm ngồi (hông trừ `legHalf · s`), không có
  luật mép, kèm dòng in "không có mặt ngồi khai vai trò: không kiểm mép".
- Lưng ghế, tay vịn, để chân của chính ghế dùng tự động (`auto`, `sameAsSeat`): ghế có lưng thì `recline` ngả tới lưng ghế
  không cần `--backrest`; ghế bar có để chân thì đặt bàn chân lên đó, `--footrest none` để đặt xuống sàn.
- Bàn: `--hands table` tìm `ahead` khi không có `--table`; `--hands` khác vẫn tìm `ahead` để kiểm gối, đùi dưới bàn (mức cảnh
  báo, [6.2](#62-tìm-đồ-trong-cảnh)).
- Tay vịn bắt buộc khi `--hands armrest | fold` (`need: { hands: ["armrest", "fold"] }`: danh sách là một trong số ấy).
- Mép trước của `seat` giới hạn góc đùi; đùi lún mép là luật tự kiểm ([3.3](#33-seat--mặt-ngồi)).
- Dòng in thêm chỗ ngồi khi có `seat`: "ngồi trên `ghe-dai`, hông cách mép trước 38, cách mép sau 61, cách mép trái 40".

### 6.6 Điểm ngồi và ghế dài

- **Điểm ngồi** là điểm trên mặt ngồi dưới khớp hông của người ở giây xét, theo `sceneAt(...).world`: `world.at` với
  `world.sit: true`, hay mốc `sit` của `path` đã nội suy ([03](03-scene.md#người-3d)). Cảnh không trỏ tên ghế: `sceneAt` ở lõi
  không thấy cảnh three, nên không giải được chỗ từ tên vật.
- Ghế dài là **một** `seat` rộng, không chia chỗ. Luật "mông lọt mép" đo mép ngoài của cả mặt ngồi.
- Hai người ngồi sát nhau đo bằng `clash` của `check` như người với người, không phải luật vai trò.
- Ngồi sâu, nông, lệch trái, phải là chỗ của điểm ngồi trên mặt ngồi; bộ ngồi đọc ra và kiểm, không dời người.
  Trang soi đặt `world.at` từ tham số "chỗ ngồi trên ghế".

## 7. `check`, MCP, hai lớp

**Hai lớp.** Vai trò của món cầm tay nằm trong `held/<món>.json` nên đi hai lớp như món ([05](05-repo-video.md#hai-lớp)):
bộ chung khai `pourer` cho `binh`, `vessel` cho `coc`, `ly` (`chen` suy được); repo video đè món cùng tên là đè cả `roles`.
Đồ của cảnh không có lớp dưới: nó là code của repo video; đồ chung duy nhất là `previewProps` của rig.

**`check`.** Nhóm **`roles`** riêng (trong `CHECK_GROUPS` và nhóm cần cảnh three `WORLD_GROUPS`, lọc bằng `--groups`), dùng chung lượt dựng cảnh
three với `clash`, `held` (cùng `worldOf`, cùng `pose(t)`). Ngưỡng của đồ cảnh là đơn vị rig thế giới, không nhân `s` của
người:

| Luật | Mức |
|---|---|
| `roles` của đồ cảnh hỏng zod, hay vật có vai trò mà phép đặt ngoài giới hạn ([mục 2](#2-hệ-toạ-độ-và-kiểu-hình-học)) | lỗi |
| Vai trò lệch hình: `seat`, `armrest`, `footrest`, mặt trên `tabletop` không nằm trên mặt trên của khối cùng chủ (dò dọc xuống, khe quá `2`); mặt trước `backrest` cách mặt khối cùng chủ quá `2` | cảnh báo |
| Người ngồi có điểm ngồi chiếu vào trong một mặt ngồi (nới `2 · s`) mà độ cao lệch quá `1 · s` | cảnh báo |

Người ngồi trên đồ không khai `seat` (đệm seiza, bệ cửa sổ, mép giường) không ra dòng nào. `roles` của món cầm tay hỏng là lỗi
zod của `held/`, như mọi JSON. Tự kiểm của `gen sit` chạy cả nhóm `roles` trong `worldChecks`.

**MCP** ([04](04-mcp.md#tool)):

- `describe_held` trả `roles`: mục khai và suy (`source`), giá trị đã giải ra khung món (`lip`, `spout`, `mouth`), cảnh báo
  lệch.
- `list({ kind: "held", role: "vessel" })` lọc món theo vai trò.
- `scene_probe` trả `roles` của cảnh three ở giây hỏi: vật, chủ, mục, vai trò, toạ độ thế giới — agent chọn `--table`, `--cup`
  từ đây.
- `gen`: tham số như cờ CLI; giá trị `none` cho slot `auto`; lỗi tìm slot trả danh sách vật mang vai trò.
- Mô tả `held` của `schema` ghi `schemaVersion: 4` và trường `roles`.

## 8. Thêm vai trò, thêm bộ sinh

Một bộ sinh mới là một gói việc:

1. Vai trò nó cần mà chưa có: thêm vào `ROLES` (trường, `describe`, vật mang, suy nếu có), test zod; hình thử của vai trò
   trong `propOf`.
2. Slot trong `GEN_KINDS[kiểu].roles`.
3. Khai vai trò cho món, đồ chung có liên quan (`common/held/`, `previewProps`).
4. Trang soi của bộ sinh ([mục 9](#9-trang-soi-bộ-sinh)): bản mô tả trong `GEN_PAGES`.
5. Bảng vai trò ở [mục 3](#3-bảng-vai-trò) thêm cột bộ sinh.

Vai trò không có bộ sinh nào dùng thì không thêm.

## 9. Trang soi bộ sinh

Mỗi bộ sinh một trang trong Studio 3D: form tham số, sân khấu thử, phát hành động sinh ra (chạy khô) trên người 3D, bảng
tự kiểm bấm dòng thì nhảy tới giây ấy. Một trang chung vẽ mọi bộ sinh từ **bản mô tả** của nó; không viết tay từng trang.

### 9.1 Bản mô tả trang

`GEN_PAGES` ở module thuần `packages/cli/gen-pages.mjs` (chỉ nhập `gen-sit.mjs`, `gen-pour.mjs`, `@stickman3d/rig/core`;
không `node:fs`, không `three`), ra cửa `@stickman3d/cli/gen-pages` (`exports` của `package.json`). Studio 3D nhập cửa ấy;
server nhập qua `GEN_KINDS[kiểu].page`. `gen.mjs` (có `node:fs`, `prettier`, `@stickman3d/render`) không vào trình duyệt.

| Trường | | Nghĩa |
|---|---|---|
| `label` | bắt buộc | Tên trang tiếng Việt: dòng trong ô chọn bộ sinh (`Ngồi · sit`), tiêu đề trang |
| `params` | bắt buộc | Danh sách tham số. Bắt buộc: `key`, `label` (tiếng Việt), `type` (`number`, `enum`, `bool`, `point`), `default` (giá trị, hay `"auto"`: bộ sinh tự chọn); `values` với `enum` (lấy từ bảng kiểu của bộ sinh: `LEG_KINDS`…). Tuỳ chọn: `min`/`max`/`step`/`unit` (`number`; `unit` cả `point`), `names` (`enum`: tên tiếng Việt từng giá trị, form hiện `tên (id)`; thiếu thì hiện id), `when` (hiện khi tham số khác bằng giá trị, hay một trong danh sách giá trị) |
| `stage(p, who)` | bắt buộc | Dựng **sân khấu thử** (JSON thuần) từ tham số và nhân vật đang chọn: `scene` (JSON cảnh: người ở đâu, ngồi hay đứng, `world.hands`), `props: [{ name, place, roles }]` (đồ thử chỉ bằng mục vai trò), `held: { tên: spec }` (món cầm tay thử). Tham số `"auto"` mà sân khấu cần giải ở đây thành số cụ thể |
| `call(p, stage)` | bắt buộc | Tham số gọi `run` của bộ sinh: cờ như CLI, luôn `dryRun`; sân khấu đưa riêng ([9.3](#93-chạy)). Tham số `"auto"` mà sân khấu không cần thì bỏ cờ: `run` lấy mặc định của nó |
| `auto(p)` | tuỳ chọn | `{ key: giá trị }` mà từng tham số đang `"auto"` giải ra với tham số `p` (số; `point` là chữ `x,y,z`). Form hiện nó trong ô **tự động**, bỏ tự động thì ô bắt đầu từ số ấy. Phải trùng cách `stage` và `run` giải `"auto"`: đặt đúng số ấy thì ra cùng sân khấu và cùng hành động (`pour`: `tilt` là `tilt[1]` của kiểu, `pourDir` là `dir` của kiểu, `cupAt` là `lip` của kiểu). Thiếu thì ô tự động để trống, bỏ tự động thì bắt đầu giữa tầm |

### 9.2 Đồ thử dựng bằng chính khai báo vai trò

Hình của đồ thử dựng từ mục vai trò bằng `propOf(name, place, roles, { floor, h })` của rig (`packages/rig/src/roles.ts`),
ra một `Item` mang đúng `roles` ấy. Hình phụ không có trong vai trò lấy hằng của `propOf`, nhân `h` (`rig.height`):

| Vai trò | Hình | Hình phụ |
|---|---|---|
| `seat` | Tấm mặt ngồi | Dày `6`; bốn chân xuống sàn `floor` |
| `backrest` | Tấm theo `from → to`, rộng `width` | Dày `6`; hai trụ xuống mặt ngồi cùng chủ |
| `armrest` | Thanh theo đoạn, rộng `width` | Dày `6`; trụ đầu trước xuống sàn |
| `tabletop` | Tấm theo `poly`, dày `thick` | Bốn chân xuống sàn |
| `footrest` | Thanh hay bệ theo `Rect` | Dày `4`; thanh có hai trụ xuống sàn |
| `vessel` (đồ cảnh) | Trụ đặc bán kính `r`, đỉnh ở miệng | Cao `1,2 · r` |

`touch` theo vai trò: mặt ngồi, lưng ghế `["thigh", "torso"]`; mặt bàn `{ part: "hand", max: 4 }`,
`{ part: "foreArm", max: 7 }`; tay vịn cả hai bộ ấy (đùi, thân chạm khung ghế; bàn tay, cẳng tay tì lên mặt); để chân
`foot`. Ngưỡng lún của bàn tay, cẳng tay là chỗ lún nhỏ không thấy trên hình.

**Một nguồn cho ghế, bàn thử.** Ghế, ghế bành, bàn của `previewProps` (Thư viện), đồ của trang soi và của tờ thử đều là
`propOf` của mục vai trò: Thư viện khai mục vai trò của ghế xem thử (từ `PREVIEW_SEAT`, `PREVIEW_ARMREST`, `PREVIEW_DESK`,
lưng ghế sau hông `55`), trang soi và tờ thử khai theo tham số. Hình ghế, bàn của Thư viện là hình `propOf`; sửa `propOf` thì
chụp `pnpm shots` Thư viện trước và sau, khi chủ dự án cho phép.

**Tầm của bảo đảm.** Bộ sinh tìm đồ thử qua `rolesOf` như đồ thật, nên **phép giải theo vai trò** trên trang trùng phép giải với
đồ thật khai cùng vai trò. Va chạm (`clash`) đo trên hình thật của từng vật: đồ thật khác hình thử có thể thêm dòng `clash`.

Món cầm tay thử (chai) là JSON `held` dựng từ tham số, qua `parseHeldItem`, mang `roles` như món thật.

### 9.3 Chạy

- Trang dựng sân khấu từ `stage` (cảnh qua `parseScene` → `resolveScene` → `buildWorld` với `propWorld(props)` của rig làm
  `WorldSpec`, món thử qua `previewHeld`, như Thư viện), gửi `POST /api/gen` `{ kind, params, who }`.
- Server (`packages/cli/studio3d.mjs`) dựng lại cùng `stage`, gọi `run` với `o.stage` = `{ sceneJson, held, spec }`:
  `held` đè mọi lớp của `held/` (file cùng tên không đọc), `spec(id, rig)` trả `propWorld(props)` dựng bằng `rig` được
  nạp — cùng hợp đồng `checkScenes({ spec })`. Không ghi `actions/`; nút **Ghi vào repo** để sau.
- **Một sân khấu xuyên suốt.** `o.stage` đi vào mọi chỗ bộ sinh cần cảnh: dựng runtime (`sceneFor` dùng `held` thử), tìm vai
  trò (`rolesOf` trên `buildWorld(spec)` đã `pose(t)`), đo liên kết tay–bình, và cả hai lượt `worldChecks` trước/sau
  (`checkScenes({ spec, held })`). Trên trang soi, bộ sinh không đọc `stickman.world` hay `held/binh.json` của repo.
  Repo không khai `stickman.world` thì `loadWorld` nạp riêng `@stickman3d/rig` của repo (cùng một bản `three`) để có `rig`
  dựng `spec`. Mọi bước chạy trong tiến trình server (`checkScenes` không qua luồng phụ).
- Mỗi dòng tự kiểm mang `t` (giây tệ nhất; dòng `check` mang giây đầu quãng). Bấm dòng: thanh tua nhảy tới `t`, dừng phát.
- Tham số trong URL (`?gen=sit&legs=bent&seat=95…`) như Thư viện; đổi tham số thì chạy lại sau khi ngừng gõ.

### 9.4 Hai trang của bản đầu

| `pour` | Kiểu | Mặc định |
|---|---|---|
| `style`, `tilt`, `pourDir` | như cờ | như cờ |
| Có chén | bool | bật |
| Chỗ chén | `point`, hệ thân `[tiến, y xuống, ra ngoài]` của người rót so với mốc `chest`, rig ở `world.s` 1 | `auto`: `lip` của kiểu (`SINGLE.lip` / `SERVE.lip`), cùng hệ |
| Bán kính chén | number `3…20` | `7` |
| Chai: thân `r`, thân cao, cổ `r`, cổ cao | number | `13`, `36`, `4`, `19` (đáy ở y `−38`, miệng ở y `17` như `held/binh.json`) |

`stage` đổi chỗ chén ra thế giới bằng mốc `chest` của người rót trong cảnh thử không có hành động (lõi: `sceneAt`,
`bodyMarkAt`) nhân `world.s`. Chai thử là hai trụ (thân, cổ) cộng `pourer` có `lip` ở mép cổ phía `+z`; chén thử là `vessel`
của đồ cảnh, `--cup` là tên nó. Tắt chén: `--cup` là điểm thế giới của chỗ chén (đích dạng điểm), để soi đường tay và cổ tay.

| `sit` | Kiểu | Mặc định |
|---|---|---|
| `legs`, `tuck`, `feet`, `back`, `hands`, `top` | enum | như cờ; `top` khi `hands` `fold` |
| Dời khuỷu dọc tay vịn | number `−60…60` khi `hands` `armrest` hay `fold` (`when` nhận danh sách) | `0` (không cờ `--elbow`) |
| Độ cao mặt ngồi | number | `PREVIEW_SEAT.chair` |
| Chỗ ngồi trên ghế | number, hông tới mép sau | chỗ của ghế xem thử |
| Lưng ghế, tay vịn | bool | bật, tắt |
| Có bàn; mép gần trước hông; mặt bàn cao hơn mặt ngồi | bool; number; number | tắt; `PREVIEW_DESK` |
| Để chân; độ cao | bool; number | tắt |

Ghế luôn có. Nhân vật và góc máy như Thư viện. Đồ của trang `sit` là vật có tên, nên bộ sinh tìm chúng bằng slot
(`underHip`, `sameAsSeat`, `ahead`), không qua cờ số.

**Tờ thử** (`gen sit --sheet`) dựng mỗi ô bằng `page.stage` của bộ sinh với tham số của ô và gọi `run` với `o.stage` như
server; ảnh của ô vẽ cùng `props` ấy. `CHAIR_BACK`, `PREVIEW_DESK`, `PREVIEW_ARMREST` là mặc định trong `params` của trang;
trang và tờ ra cùng sân khấu.

## 10. Tác động lên repo video

**Breaking change** (`feat(cli)!:`, `feat(rig)!:`):

| Repo video có | Phải làm |
|---|---|
| Ghế, bàn, ghế bar dựng bằng code mà `gen sit` gọi theo tên (`--table ban-tra`, `--armrest`, `--backrest`, `--footrest`) | Khai `roles` cho `Item` (hay `withRoles` cho nút three); thiếu thì lệnh lỗi "vật không khai vai trò" |
| Ghế dưới người mà `gen sit` sinh dáng | Không bắt buộc: không có `seat` thì mặt ngồi như mặt ngang qua điểm ngồi, không kiểm mép. Khai `seat` để có luật mép và để lưng, tay vịn, để chân của ghế tự dùng |
| Ghế có lưng khai `backrest`, sinh lại dáng | `recline` tự tựa lưng ghế (góc ngả khác dáng cũ); `upright`, `forward` thêm cảnh báo lấn lưng nếu lưng sát |
| Bàn trước người ngồi khai `tabletop`, sinh lại dáng | Thêm cảnh báo gối, đùi lấn mặt dưới bàn dù tay không đặt lên bàn |
| Món làm bình rót của riêng repo (`am-tra`, chai bia) | `roles: [{ role: "pourer", lip: … }]`, `schemaVersion: 4` |
| Món làm cốc của riêng repo mà `--cup` trỏ tới | Có `lathe` + `wall` thì không phải làm; không thì khai `vessel` (`schemaVersion: 4`). Thiếu thì lệnh lỗi kèm danh sách món mang `vessel` |
| `held/` bản 3 không có `roles` | Không phải sửa: nạp như bản 4 |
| Hành động `gen` đã ghi trong `actions/` | Giữ nguyên, chạy được; chỉ lần sinh lại mới cần vai trò |
| Cờ số (`--table 80`, `--armrest x,y,z`, `--backrest 55`, `--footrest 40`, `--cup x,y,z`) | Cùng nghĩa |
| Tờ thử của repo (`gen sit --sheet`) | Ô có thêm dòng `clash` với ghế, bàn thử: ô đạt có thể thành không đạt |

`check` nhóm `roles` cảnh báo người ngồi lệch mặt ngồi chỉ ở chỗ có `seat`, nên repo chưa khai không thêm dòng.

## 11. Phạm vi

| | Bản đầu | Để sau |
|---|---|---|
| Vai trò | Bảy vai trò của [mục 3](#3-bảng-vai-trò) | Vai trò của bộ sinh mới (uống, đặt đồ lên bàn, mở cửa…) khi có bộ sinh |
| Món cầm tay | `roles`, `HELD_VERSION` 4, suy `vessel` từ `wall`, `spout` từ `lip` | Rót bằng quai (`handle`); món nhiều miệng; mặt ngồi trên món cầm tay (ghế gấp xách đi) |
| Đồ của cảnh | `Item.roles`, `withRoles`, `rolesOf` có chủ; `previewProps` qua `propOf`; ghế dài là một `seat` liền | File `furniture/`; suy vai trò từ khối; chia chỗ trên ghế dài; mặt ngồi nghiêng; tay vịn dốc; vòng để chân tròn; phép đặt nghiêng, co giãn không đều |
| Bộ sinh | Slot trong `GEN_KINDS`; tìm theo vai trò; cờ số thành đồ ảo; đích rót điểm hay vật mang `vessel`; luật mặt ngồi; luật điểm rót trong miệng (cảnh báo); luật lấn: vật tự tìm cảnh báo, vật phép tính dùng hay chỉ đích danh lỗi | `--place`, `--depth` của `gen sit` in `world.at` để dán; `BINH` của bộ chung đọc từ `held/binh.json` |
| `check`, MCP | Nhóm `roles`; `describe_held`, `list` theo vai trò, `scene_probe` trả `roles` | |
| Trang soi | `GEN_PAGES` của `pour`, `sit`; trang chung; `POST /api/gen`; sân khấu thử xuyên suốt; tờ thử dựng qua `page.stage` | Ghi vào repo từ trang; soạn vai trò của đồ thật bằng mắt trong Studio |

Việc đi cùng bản đầu:

- Đo luật mặt ngồi (lệch độ cao `1 · s` / `3 · s`, ngồi nông dưới `⅓` đùi, đuôi mông theo `markShape` cộng `backExtra`) trên
  bốn người mẫu `common/characters/sample-*.json`, xác nhận số của [3.3](#33-seat--mặt-ngồi) trước khi phát hành.
- `previewProps` dựng ghế, ghế bành, bàn qua `propOf`: đổi hình Thư viện, chụp `pnpm shots` trước và sau khi chủ dự án cho
  phép, mở tờ gộp và nhìn.

Code: `packages/rig/src/core/roles.ts` (`ROLES`, `RoleSchema`, `parseRoles`, kiểu hình học, đổi khung), `core/heldRoles.ts`
(`heldRoles`, `pourSpans`: phần cầm và trục món của vật rót),
`packages/rig/src/roles.ts` (`rolesOf`, `withRoles`, `propOf`, `propWorld`), `heldItem.ts` (`roles`, `HELD_VERSION`,
`migrateHeldItem`), `khoi.ts` (`Item.roles`, `addItem`, `Batch`, `SolidTag.owner`), `preview.ts`; `packages/cli/gen.mjs` (slot,
tìm, `o.stage`), `gen-pour.mjs`, `gen-sit.mjs`, `gen-pages.mjs`, `gen-sheet.mjs`, `gen-check.mjs` (`worldChecks` nhận `spec`,
`held`), `lib.mjs` (`checkScenes`, `deepContext` nhận `held`; nhóm `roles`), `roles-check.mjs` (hình học mục đã giải, luật
nhóm `roles`), `studio3d.mjs`, `package.json` (`exports`); `collide.ts` của rig (`Collider.item`: chủ của khối);
`packages/render` (`loadWorld` khi không có `stickman.world`, ảnh tờ thử theo `props`); `apps/studio3d` (trang chung:
`genPage.ts`, `genUi.ts`);
`packages/mcp/server.mjs` (mô tả `held`, `describe_held`, `list`, `scene_probe`, `gen`).

Tài liệu đi cùng: [11](11-nhom-cam.md) mục 2 (tiêu đề `HELD_VERSION` 4, trường `roles`) và mọi link tới tiêu đề ấy
([01](01-rig.md), [04](04-mcp.md)); [01](01-rig.md) đoạn món cầm tay (`schemaVersion` 4); [05](05-repo-video.md) (`schemaVersion`
của món, cờ `--cup`, tên vật của `gen sit`, tờ thử); [04](04-mcp.md) (`describe_held`, `list`, `scene_probe`, `gen`); nhóm
`roles` của `check`.
