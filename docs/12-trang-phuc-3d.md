# 12 — Trang phục 3D

Đồ của người 3D không cần ảnh: tóc, kính, mũ, trâm, bông tai, thân áo, đồ bám thân áo
và váy là khối dựng thẳng từ bảng kiểu ở lõi (`SCULPT_STYLES` của `core/sculpt.ts`,
`GLASSES_PRESETS` / `glassesFrame` của `core/glasses.ts`, `GARMENT_STYLES` của `core/torso.ts`…),
khai ở socket của nhân vật với `src: "sculpt"`, quay theo đầu hay theo thân ở mọi góc.
Người 3D đọc đủ mọi trường của bảng kiểu.

## Tóc dựng khối

`pieces.hair` với `src: "sculpt"` là tóc dựng khối: mảng tóc là một vỏ
ôm sọ đơn vị, quay theo đầu khi lắc, gật. Một bộ số cho ra mọi góc, repo video viết
thẳng trong JSON nhân vật:

```json
"hair": { "src": "sculpt", "color": "#2b2320", "sculpt": { "part": 30, "fringe": 10 } }
```

Chân tóc là vĩ độ theo kinh độ (độ; kinh độ `0` giữa mặt, dương về `+x`): ngang trán
ở `front`, hõm nhẹ ở thái dương, hạ xuống vòng trên tai ở `ear`, xuống gáy ở `nape`;
tóc mai là dải hẹp trước tai tới `sideburn`; mái hạ thêm `fringe` từ đường ngôi `part`
quét sang tới thái dương bên kia, gặp mảng tóc bên tai thành góc. Vỏ sát da ở chân tóc, phồng lên `volume` lần bán kính từ hàng thứ
ba. `hairline` ở `core/sculpt.ts`; người 3D dựng lưới bằng `sculptMesh` (`sculpt.ts`).

| Trường | Mặc định | Nghĩa |
|---|---:|---|
| `front` / `ear` / `nape` / `sideburn` | 42 / 16 / −22 / 0 | Vĩ độ chân tóc giữa trán, vòng trên tai, gáy, mút tóc mai |
| `part` | 35 | Kinh độ đường ngôi |
| `fringe` | 15 | Chân tóc hạ xuống trán bấy nhiêu độ, từ ngôi sang tới thái dương bên kia |
| `volume` | 0.07 | Độ phồng của vỏ, lần bán kính sọ |
| `bang` | 0 | Mái lệch rủ dưới chân tóc trán bấy nhiêu độ ở chỗ sâu nhất; `0` là không có |
| `bangTo` | −50 | Kinh độ chỗ mái lệch rủ sâu nhất |
| `bangThick` | 0.1 | Bề dày mép mái lệch, lần bán kính sọ |
| `length` | 0 | Đuôi tóc dưới tâm đầu bấy nhiêu lần bán kính, đo theo trọng lực; `0` là tóc không rủ |
| `style` | `plain` | Kiểu: `plain` vỏ trơn, `neat` chải gọn có rãnh ngôi và lọn chải, `spiky` mọc gai và mái răng cưa, `round` mái bằng khối tròn phồng, `center` ngôi giữa mái rẽ hai bên, `bob` đuôi cụp, `shoulder` ngang vai gợn sóng, `slick` trán cao vuốt ngược, `curly` xoăn búp, `bald` hói đỉnh chỉ còn vành tóc, `pony` đuôi ngựa, `bun` búi, `messy` ngắn xù mái răng cưa đuôi so le, `afro` xoăn bồng ôm cả đầu, `buzz` đầu đinh sát da, `crop` tròn ngắn có lọn xoáy, `quiff` mái dựng vuốt ngược, `anime` lọn dẹt nhọn chảy từ xoáy; hình của kiểu ở bảng `SCULPT_STYLES` |
| `spike` | 1 | Hệ số nhân chiều dài gai, lọn vuốt và lọn dẹt của kiểu; `0` tắt cả ba |
| `crownSide` / `crownBack` | 22 / 32 | Kiểu hói: vĩ độ mép trên vành tóc ở hai bên, sau gáy |
| `crownFrom` / `crownEase` | 80 / 12 | Kiểu hói: kinh độ mũi trước của vành, và số độ kinh từ mũi tới chỗ vành mở hết bề cao |
| `tie` | 55 | Đuôi ngựa, búi: vĩ độ chỗ buộc sau gáy (kinh độ 180) |
| `tail` | 1.3 | Đuôi ngựa: đuôi rủ tới bấy nhiêu lần bán kính sọ dưới chỗ buộc, theo trọng lực |
| `tieLon` | 180 | Đuôi ngựa, búi: kinh độ chỗ buộc; `180` giữa gáy, `−140` lệch về bên phải người |
| `knotSize` | 1 | Đuôi ngựa, búi: hệ số nhân bán kính búi và bề ngang đuôi |
| `ahoge` | 0 | Số [lọn vểnh](#lọn-vểnh) trên đỉnh; `0` là không có |
| `ahogeLength` / `ahogeHeading` / `ahogeBend` | 0.5 / 0 / 120 | Lọn vểnh: dài (lần bán kính), hướng cong (`0` ra trước mặt, `90` về `+x`), ngọn ngả khỏi phương dựng đứng bấy nhiêu độ |
| `recede` / `recedeAt` | 0 / 40 | [Hói chữ M](#hói-chữ-m): chân tóc hai bên trán lùi lên bấy nhiêu độ, sâu nhất ở kinh độ `±recedeAt` |
| `accentTo` / `accentFrom` | 0.45 / 70 | [Màu phụ](#màu-phụ) `pieces.hair.accent`: phủ từ chân tóc lên bấy nhiêu phần chiều cao vỏ, từ kinh độ `±accentFrom` ra sau |

Mặc định là tóc ngắn rẽ ngôi lệch của nam. `SCULPT_PRESETS` là bộ số mẫu — `short`
(tóc nam ngắn), `buzz` (đầu đinh, `style: "buzz"`), `crop` (tròn ngắn, `style: "crop"`), `quiff` (mái dựng vuốt ngược, `style: "quiff"`), `spiky` (rối gai, `style: "spiky"`), `neat` (rẽ ngôi chải gọn,
`style: "neat"`), `slick` (vuốt ngược, `style: "slick"`), `curly` (xoăn búp, `style: "curly"`), `afro` (xoăn bồng, `style: "afro"`), `bald` (hói đỉnh, `style: "bald"`), `baldLight` (hói nhẹ), `baldFront` (hói trán), `ponyHigh` (đuôi ngựa buộc cao, `style: "pony"`), `ponyLow` (đuôi ngựa buộc thấp), `bun` (búi cao, `style: "bun"`), `messy` (ngắn xù, `style: "messy"`, `length` 1.05), `round` (mái bằng tròn, `style: "round"`), `bang` (mái lệch), `bob`
(ngang cằm, `style: "bob"`, `length` 0.91), `shoulder`
(ngang vai mái lệch, `style: "shoulder"`, `length` 1.35), `center` (ngôi giữa dài, `style: "center"`), `anime` (anime lởm chởm, `style: "anime"`); áp mẫu là
thay cả `sculpt`. `sculptPresetOf` cho biết bộ số đang đúng bằng mẫu nào.

- Mép vỏ ở chân tóc là một **vách** từ da lên tới vỏ, nên mép có bề dày bằng độ nổi của
  vỏ ở hàng đầu.
- Mép mái đặt cao hơn mày `raised` khi ngước: mày nằm ở vĩ độ khoảng `16°`, nhướng thêm khoảng `7°`.

### Mái lệch

Mép mái chéo từ đường ngôi `part` xuống `bangTo`, sâu dần tới `bang` độ dưới chân tóc
trán; quá `bangTo` mép đi ngang ra sau tới chỗ chân tóc bên tai thấp hơn nó. Hàng đầu
của vỏ ở đó nổi `bangThick` lần bán kính khỏi da, nên vách chân tóc thành mép mái dày —
thấy rõ khi lắc về phía mái và khi ngước. Bề dày mỏng hết trong `SCULPT_BANG_TIP` độ
quá `bangTo`. Mái rủ về phía `−x` thì chỉ thấy trọn khi lắc dương: lắc âm là bên ấy
quay ra sau.

### Tóc chải gọn

Kiểu `neat` là **hai khối tách nhau bởi nếp ngôi**, phủ lọn dẹt chải từ ngôi ra. Hình hard code
trong `SCULPT_STYLES.neat`; mọi thứ tính từ đường ngôi sang phía mái nên đổi dấu `part` là
lật gương cả kiểu.

- **Ngôi là mặt phẳng dọc**, qua chân tóc ở kinh độ `part`, về sau thì xa dần mặt phẳng giữa
  đầu theo `lean` (`partPlane`). Ngôi theo kinh tuyến thì chụm vào đỉnh đầu, không chạm
  được bóng đầu; ngôi phẳng chạy qua đỉnh nên khía thành khấc trên bóng đầu như tóc vẽ.
- **Nếp ngôi** (`crease`): vỏ lõm còn `1 − depth` dọc mặt phẳng ngôi, tắt dần sau đỉnh.
  Đường ngôi đi theo mặt phẳng ấy từ chân tóc qua đỉnh.
- **Hai khối** là hai bướu (`puff`): vỏ phồng thêm quanh một điểm trên sọ, giảm theo góc cầu.
  Đo bằng góc chứ không theo kinh độ và vĩ độ: ở đỉnh mọi kinh độ gặp nhau, bướu đo theo
  kinh độ làm vỏ nhúm thành khấc. Khối bên mái to và cao hơn khối bên ngôi.
- **Lọn bên ngôi** (`lock`): chân tóc bên kia ngôi rủ xuống, mép khối tròn ra tới tai.
- **Lọn chải** là lọn dẹt (`locks`, như [tóc anime](#tóc-anime)): bốn lọn bên mái mọc ngay
  bên ngôi từ trán về đỉnh, chải ngang qua đầu sang mái và ngả dần ra sau; hai lọn bên ngôi
  ngắn chải ngược lại. Chân lọn bên mái nằm dưới nếp ngôi nên không lộ gờ; ngọn chìm vào
  vỏ (`sink`) trên chân tóc thái dương. Sau đầu không có lọn: gáy là một khối liền.

Nét ngôi là đường trên mặt vỏ (`lines` của `sculptMesh`): vỏ và bướu che nó như mọi khối —
bướu bên ngôi có thể che đường ngôi ngay trên nửa trước. Mẩu ngắn hơn một phần tư
nét bị bỏ. Ngôi mẫu đặt gần giữa (`part` 20) để khối bên ngôi quay ra trước đủ cho nét hiện.

### Tóc vuốt ngược

Kiểu `slick` để trán cao, tóc chải ngược ra sau thành một khối liền. Mẫu có `front` 58,
`part` −30, `fringe` 10, `ear` 20, `sideburn` 8, `volume` 0.1; `bang` và `length` bằng 0. Bảng
`SCULPT_STYLES.slick` giữ hình của kiểu:

- Mép mái quét trong `reach` 95°, `rim` 0.3. `partRise` bằng 0 để chân tóc không nhô tại ngôi;
  mặc định của trường là 4°.
- Vỏ dày dần trong 70% số hàng từ chân tóc (`ease` 0.7): nhìn nghiêng mặt trước ngả theo sọ
  thành đường cong ra sau, không dựng vách ở chân tóc. Một `puff` ở vĩ độ 80 bên mái cho đỉnh
  phồng, một `puff` thấp sau thái dương bên ngôi.
- Bốn lọn dẹt (`locks`) mọc cao hơn chân tóc trán 12–14°, chải ngược qua đỉnh, ngọn dừng
  ngay sau xoáy; lọn bên mái ngả dần về phía mái. Hai lọn mảnh trên thái dương chải ngang ra
  sau, ngọn bắt đầu chìm trước kinh độ ±90 nên nhìn từ sau chỉ gợn nhẹ trên viền đầu. Mọi lọn
  trồi trong 40% chiều dài đầu và chìm ngọn vào vỏ trong 60% cuối; sau gáy là vỏ trơn.
- Chân lọn đặt xa góc mái bên thái dương: vỏ ở đó còn mỏng mà mép mái `sweep` gặp chân tóc bên
  tai thành mấu, lọn nằm trên góc ấy phóng mấu thành cục.
- `swept` là hai lọn vuốt trên đỉnh bên mái, ngả về phía sau; lưới riêng dùng tiết diện của lọn
  gai, chân chìm dưới đúng mặt vỏ có `puff`. Kinh độ đo từ ngôi theo `fromPart`, hướng ngả cũng
  lật theo dấu `part`. `sweptArch` 0.12 đặt điểm điều khiển gần chân để lọn nằm sát vỏ; số này
  là phần chiều dài lọn, mặc định 0.55 như gai. `spike` nhân chiều dài cả gai, lọn vuốt và lọn
  dẹt.

### Tóc xoăn

Kiểu `curly` là vỏ phủ **búp xoăn**. Mẫu có `front` 46, `ear` 20, `sideburn` 14,
`fringe` 0, `volume` 0.14; bảng `SCULPT_STYLES.curly` giữ hình của kiểu:

- `curls: [radius, height, count]` rải `count` búp đều trên cả mặt cầu theo xoắn
  Fibonacci, không theo ngôi. Mỗi búp là chỏm bán kính góc `radius`, cao `height`
  lần bán kính, profile `(1 − d²)^0.7`. Vỏ lấy **búp cao nhất** tại mỗi điểm chứ
  không cộng, nên giữa hai búp là khe và bóng tóc thành viền mây ở mọi góc. Búp
  tròn cần `height` xấp xỉ `radius` đổi ra radian; thấp hơn nhiều thì chỉ còn gợn.
  Profile `0.5` cho sườn dựng đứng, lưới thưa ở mép dưới chiếu ra gai.
- `scallop: [width, depth]` khoét chân tóc quanh đầu thành múi tròn rộng `width`
  độ kinh, sâu `depth` độ. `width` chia hết 360; đặt bằng cỡ búp để mép trán khớp
  viền trên.
- `curlArc: [at, from, to]` vẽ nét khe: cung quanh tâm mỗi búp ở `at` lần bán kính
  búp, từ góc `from` tới `to` (`0` về `+kinh độ`, `90` lên). Mẫu dùng `[0.75, 190,
  300]`, cung chữ C mở lên phải. Cung sát mép búp (`at` gần 1) bị búp bên cạnh che
  gần hết, chỉ còn gạch vụn. Nét bỏ phần dưới chân tóc cộng 3°.

Kiểu `afro` là cùng máy búp xoăn trên một **khối tóc bồng ôm cả đầu**. Mẫu có `front` 52,
`ear` −35, `nape` −50, `sideburn` −35, `fringe` 0, `volume` 0.45: vỏ phồng gần nửa bán
kính, chân tóc hai bên xuống ngang cằm nên khối tóc bao quanh mặt. Bảng
`SCULPT_STYLES.afro`: `curls` `[20, 0.28, 50]` — búp nhỏ và dày hơn `curly` cho viền mây
gợn đều trên khối lớn; `curlArc` `[0.7, 210, 270]` nét khe ngắn; `scallop` `[24, 6]`;
`rim` 0.25 để vỏ vát dần vào da ở chân tóc, không dựng thành vách nhô trên trán.

### Hói đỉnh

Kiểu `bald` trọc trán và đỉnh, chỉ còn **vành tóc móng ngựa** quanh hai bên và sau gáy.
Ba mẫu chung `ear` 6, `nape` −24, `sideburn` −8, `fringe` 0, `volume` 0.08, khác nhau ở
bốn số của vành:

| Mẫu | `crownSide` | `crownBack` | `crownFrom` | `crownEase` |
|---|---:|---:|---:|---:|
| `bald` (hói đỉnh) | 22 | 32 | 80 | 12 |
| `baldLight` (hói nhẹ) | 52 | 60 | 45 | 22 |
| `baldFront` (hói trán) | 64 | 70 | 30 | 25 |

- Mép trên của vỏ ở vĩ độ `crownSide` hai bên, lên dần tới `crownBack` sau gáy. Vành bắt
  đầu ở kinh độ `crownFrom` tính từ giữa mặt, mép trên hạ xuống gặp chân tóc ở đó và mở
  hết bề cao sau `crownEase` độ. Cột lưới có mép trên không cao hơn chân tóc quá nửa độ thì
  không vẽ. Vành cao hơn là chỗ hói trên đỉnh nhỏ lại; `crownFrom` nhỏ thì vành vòng ra
  trước, mũi vành nằm ở góc trán theo chân tóc `front`, còn lại mảng hói trán. Kiểu khác
  bỏ qua bốn số này.
- Hàng vỏ trải đều từ chân tóc tới mép trên. Vỏ phồng theo khoảng cách tới **cả hai
  mép**, đủ `volume` khi cách mỗi mép `CROWN_EASE` (10°), nên mép trên mỏng như mép dưới
  và mũi vành thon dần. Mép trên cũng có vách từ da lên vỏ như chân tóc.
- `sideburn` âm để mũi vành rủ xuống thành tóc mai trước tai; dương thì mũi chĩa ngang ra
  trước mặt khi nhìn nghiêng. Kiểu không vẽ đường ngôi.

### Mái bằng và ngôi giữa

Mép mái của kiểu là trường `fringe` trong `SCULPT_STYLES`: `sweep` (mặc định) quét từ ngôi
sang một bên, `split` rẽ đều hai bên ngôi, `flat` bằng ngang trán. `reach` là số độ kinh
tính từ ngôi mà mái hạ hết `fringe`.

- **`round`**: mái `flat` nằm ở `front`, không hõm thái dương, không vẽ đường ngôi. Mái
  có một **đường cắt** (`cut`): lọn phía mái rủ thấp hơn ở chỗ cắt, bên kia vểnh lên, và một
  nét rời mũi lọn chéo về phía mái rồi dựng lên. Đỉnh có **nếp gấp** là `crease` của ngôi
  `part` (mẫu đặt 15) cùng hai bướu, khối bên mái cao hơn — nhìn chính diện thành khấc trên
  bóng đầu; kiểu có `fringe` thì nếp không vẽ đường ngôi. Chân tóc bên tai hạ thấp (`ear`)
  để hai bên ôm xuống ngang mắt. Vỏ dày ngay ở chân tóc (`rim` 0.8 phần `volume`, mặc định
  0.3) nên mép mái thành gờ tròn.
- **`center`**: mái `split` nhọn ở ngôi — mép hạ theo `1 − (1 − u)²` của khoảng cách tới
  ngôi — xuống thái dương sau `reach` 70°; không vẽ đường ngôi. Mẫu đặt `part` 0.

Tóc rủ của kiểu có thể đổi `flare` thay `SCULPT_FLARE` (`center` xoè 0.14), và `tips` chia đuôi thành lọn nhọn: mỗi lọn rộng bấy nhiêu độ kinh, mũi lọn
chạm `length`, giữa hai lọn ngắn hơn một khoảng theo `|·|^0.7` của khoảng cách tới mũi —
mũi nhọn, chỗ giữa hai lọn thành chữ V. Phần tử thứ ba của `tips` là `true` thì
độ ngắn dùng `sin²(πu/width)`, cho đuôi lượn tròn. Phần tử thứ tư `jitter` làm lọn so le:
mũi mỗi lọn ngắn đi `jitter × hash(lọn)` lần bán kính, `hash` giả ngẫu nhiên `0…1` cố
định theo thứ tự lọn tính từ ngôi; độ ngắn nhân với `1 −` độ ngắn của chữ V nên về `0` ở
chỗ giữa hai lọn, mép đuôi liền. Có `jitter` thì mũi dài nhất ngắn hơn `length`. Vị trí đo từ ngôi bằng `fromPart`;
bề rộng lọn phải chia hết 360 để gáy không lệch.

### Tóc gai

Vị trí lọn là **bản sắc của kiểu**, không nằm trong JSON: `SCULPT_STYLES[style]` là bảng
lọn hard code, mỗi lọn ghi kinh độ, vĩ độ chân, chiều dài tính từ vỏ (lần bán kính), hướng
ngả trên mặt sọ (`0` lên đỉnh, `90` về `+kinh độ`, `180` xuống chân tóc), góc ngả khỏi pháp
tuyến và bề rộng chân. JSON chỉ chọn `style` và nhân chiều dài bằng `spike`.

Mỗi lọn là một **khối riêng**, không phải chỗ vỏ bị đẩy lên: ống dẹt thon tới mũi, trục
là Bézier bậc hai rời chân theo pháp tuyến rồi cong về hướng ngả. Chân chìm dưới mặt vỏ.
Vỏ của kiểu gai vẫn trơn —
đẩy vỏ theo gai gần nhất làm hướng đẩy nhảy cóc giữa hai gai, ô gập ngược và thủng lỗ.

Kiểu có `jag` thì mái là **răng cưa**: mỗi lọn một mũi nhọn chĩa xuống ở kinh độ của
bảng, sâu `fringe` × độ sâu của lọn, cạnh lõm vào nên hai lọn kề nhau gặp nhau thành vòm
cong lên. Hai lọn ngoài cùng ở thái dương sâu hơn làm tóc mai nhọn; mẫu `spiky` nâng
`sideburn` lên cho lọn ấy tự làm mũi, không thì tóc mai mặc định cộng lọn thành nanh dài
sát tai. Kiểu gai không vẽ đường ngôi.

Thêm kiểu mới là thêm một mục vào `SCULPT_STYLE_NAMES` và `SCULPT_STYLES`, rồi soi bằng
dải ảnh ở đủ góc; chỉnh số bằng mắt cho khớp chính diện của kiểu tóc muốn thay.

### Tóc anime

Kiểu `anime` là vỏ trơn phủ bởi **lọn dẹt** (`locks` của bảng kiểu), dáng tóc nam anime. Mỗi lọn ghi độ kinh tính từ ngôi về phía mái, vĩ độ chân,
chiều dài (độ cung trên sọ, nhân `spike`), hướng đi trên mặt sọ (`0` lên đỉnh, `90` về phía
mái, `180` xuống chân tóc), độ hất ngọn khỏi vỏ (lần bán kính, tăng theo bình phương chiều
dài), nửa bề rộng chân, số độ hướng đi xoay thêm tới ngọn, và hai số tuỳ chọn `rise`, `sink`.
Như lọn vuốt, đổi dấu `part` là lật gương cả lọn.

- Trục lọn đi theo cung lớn trên sọ, nằm sát mặt vỏ; qua khỏi chân tóc thì nằm trên da,
  nên mái là lọn rủ đè lên trán chứ không phải chân tóc hạ xuống. Chân chìm dưới vỏ.
- Tiết diện dẹt theo pháp tuyến sọ, dày `0.3` bề rộng; bề rộng giữ gần đủ tới hai phần ba
  rồi thon nhọn. Mép lọn có nét nhờ độ sâu gãy và cạnh gấp ở hậu kỳ.
- Chân lọn chìm dưới vỏ rồi trồi lên dần trong `rise` phần chiều dài đầu (mặc định 0.35):
  trồi gắt thì chân lọn thành gờ sắc, nhiều chân gần nhau thành một vòng gờ quanh đỉnh.
  Chân mọc từ chân tóc trên bướu dốc thì trồi chậm cắt mặt vỏ một vệt dài, nét viền vỡ vụn.
- `sink` > 0 thì ngọn chìm dưới vỏ trong bấy nhiêu phần chiều dài cuối: lọn hoà vào khối thay
  vì thon nhọn nằm trên vỏ. Ngọn nhọn trên vỏ trơn đọc thành tam giác rời; lọn ở sau đầu
  của tóc ngắn để khối liền, hoặc chìm ngọn.
- Bảng `anime`: năm lọn mái lớn và hai lọn mái nhỏ chèn giữa, mũi so le trên mày; sườn hai
  lớp lọn chồng, lớp dưới hất ra (`lift` tới 0.2); lọn đỉnh nằm sát vỏ chảy ra trước; một
  sợi vểnh. Gáy không có lọn: sau đầu là một khối liền. Một `puff` sau gáy cho đầu tròn ra
  sau. Mẫu `anime` có `front` 46, `ear` 10, `sideburn` 8, `nape` −14, `part` 0 (`puff` và lọn
  đo từ ngôi), `fringe` 0, `volume` 0.16.

### Tóc rủ

`length > 0` thì kinh độ từ `hangFrom` của kiểu (mặc định `SCULPT_HANG_FROM`, thái dương) vòng ra sau gáy là **mảng
rủ**. Ở đó vỏ không dừng ở chân tóc mà phủ xuống tới **chỗ rời sọ** — vĩ độ mà pháp
tuyến của sọ vuông góc với trọng lực, nơi sọ phình ra rộng nhất theo phương ngang — rồi
nối một **mặt rủ** buông thẳng theo trọng lực tới `length` lần bán kính dưới tâm đầu.
Trong `hangEase` độ kinh trước mép mảng rủ (mặc định 15), chân tóc hạ xuống chỗ rời sọ theo
`u³` của quãng ấy: rời chân tóc êm, tới mép mảng rủ thì gần như đổ thẳng, nên mép thái dương
nối vào mép dọc của phần buông không gãy khúc.

- Chỗ rời sọ và mặt rủ quay theo lắc, gật của đầu; hướng buông là trọng lực đo trong
  nhóm đầu, tức ngược với góc xoay của nhóm ấy (thân rồi nghiêng cổ), nên đuôi tóc
  luôn rủ thẳng xuống khung hình và bằng ngang. Mặt rủ nối từ trụ dọc ôm sọ;
  phần dưới uốn theo `curl` và `wave` của kiểu, không xuyên đầu. Đuôi xoè theo `flare`
  (mặc định `SCULPT_FLARE`) lần bán kính.
- **Nhìn nghiêng mỏng hơn nhìn thẳng.** Mọi co giãn dưới đây chỉ theo trục trước–sau của
  đầu, nên chính diện không đổi. Vỏ phía sau mặt phẳng qua hai tai phồng giảm dần tới
  `SCULPT_DEPTH` phần ở gáy; xoè, `curl` và `wave` của mặt rủ theo chiều trước–sau cũng chỉ
  bằng `SCULPT_DEPTH` phần chiều ngang. Phần trước mặt phẳng ấy co về nó: vỏ thấp ở thái
  dương co `SCULPT_TEMPLE` phần ở chỗ rời sọ, hết co ở vĩ độ 40°; mặt rủ co thêm theo
  `1 − (1 − v)²` của quãng buông tới `SCULPT_TUCK` phần ở đuôi. Mép trước mảng rủ nhìn
  nghiêng nên đi chéo từ thái dương ra sau xuống đuôi, rời chỗ nối vỏ không gãy khúc.
- Mặt rủ có hai lớp: ngoài nối vỏ, trong sát sọ. Mép trước mảng rủ và đuôi tóc là vách
  nối hai lớp, nên mảng rủ dày bằng `volume`.

### Bob và ngang vai mái lệch

`SCULPT_STYLES` giữ hình dáng đuôi, JSON chỉ chọn kiểu và các hệ số chung:

| Trường của kiểu | Nghĩa |
|---|---|
| `hangFrom` | Kinh độ mép trước mảng rủ; `bob` 60°, `shoulder` 66°; chọn theo bước lưới 3° |
| `hangEase` | Chân tóc hạ xuống chỗ rời sọ trong bấy nhiêu độ kinh trước `hangFrom`; mặc định 15, `bob` 35 cho mép mái lượn liền xuống má |
| `curl: [from, bend, turn]` | Từ phần `from` của chiều dài, dịch bán kính tới `bend` ở 85%; âm là cụp vào. Trong 15% cuối, uốn trở lại `turn` (mặc định 0) |
| `wave: [width, depth]` | Sóng liên tục quanh mặt rủ, rộng `width` độ kinh, biên độ `depth` lần bán kính; tắt ở chỗ rời sọ và mép đuôi |
| `tips: [width, depth, rounded, jitter]` | Chia đuôi theo kinh độ từ ngôi; `rounded: true` cho mép lượn tròn; `jitter` cắt ngắn mỗi mũi lọn một khoảng giả ngẫu nhiên tới bấy nhiêu lần bán kính |
| `cut: [u, depth, width, rise]` | Khấc liền mép mái ở `u` từ ngôi; nét hất lên `rise` độ, mặc định 12; dùng với cả mái bằng và mái quét |

Mặt rủ lấy 24 hàng. `curl` và `wave` dịch cả lớp trong lẫn ngoài theo phương vuông góc
với trọng lực; `length` vẫn là độ rủ dưới tâm đầu. Sóng quấn vòng theo `fromPart`;
`width` phải chia hết 360 để kín gáy. Đây là dáng của cả mặt rủ; lọn nổi trên mặt
phải có lưới riêng.

- **Bob ngang cằm** (`bob`): `front` 48, `part` 35, `fringe` 0, `bang` 16,
  `bangTo` −55, `volume` 0.07, `length` 0.91. Mái cao hơi chéo, hai bên ôm má;
  `flare` 0.03 và `curl: [0.35, −0.08]` cho đuôi cụp vào.
- **Ngang vai mái lệch** (`shoulder`): `front` 60, `part` −28, `fringe` 14,
  `volume` 0.12, `length` 1.35. Khối mái dùng `puff: [[35, 62, 42, 0.24]]`,
  nếp ngôi `crease: [0.65, 0.055, 0.3]`, bên ngôi rủ `lock` 28; khấc mái
  `cut: [38, 3, 8, 4]`. Đuôi hất với `flare` 0.04, `curl: [0.25, 0.2, 0.12]`,
  gợn `wave: [60, 0.035]` và mép tròn `tips: [60, 0.1, true]`.

### Đuôi ngựa và búi

Kiểu `pony` và `bun` là vỏ trơn cộng **một khối buộc** ở kinh độ `tieLon` (mặc định 180, giữa
gáy), vĩ độ `tie`; không vẽ đường ngôi. Khối là ống có lưới riêng: mỗi vòng tiết diện `KNOT_RING_3D` (28)
đỉnh để búi to không thành đa giác khi cận; đuôi ngựa `PONY_SEG` (24)
đoạn dọc trục, búi `BUN_SEG` (12). `knotSize` nhân bán kính búi và bề ngang đuôi (`width` của bảng).
`knotFrame` cho pháp tuyến, tâm, bán kính và nửa chiều cao khối ở hệ sọ đơn vị — trâm cài búi đọc nó.

| Trường của kiểu | Nghĩa |
|---|---|
| `pony: [width, arch, flat]` | Bán kính ống lớn nhất và độ vồng khỏi gáy theo pháp tuyến, cả hai lần bán kính sọ; tiết diện dẹt còn `flat` phần theo chiều trước–sau của đuôi. Bảng: `[0.3, 0.4, 0.75]` |
| `bun: [radius, squash]` | Bán kính khối; chiều cao theo pháp tuyến bằng `squash` phần bán kính. Bảng: `[0.34, 0.8]` |

- **Đuôi ngựa** gốc trên da ở chỗ buộc. Trục là Bézier bậc ba `P0` gốc,
  `P1 = P0 + n·arch`, `P2 = P0 + n·1.1·arch + g·0.45·tail`, `P3 = P0 + n·0.8·arch + g·tail`:
  `n` pháp tuyến sọ ở chỗ buộc, `g` trọng lực trong nhóm đầu như [mặt rủ](#tóc-rủ). Đuôi
  rời gáy, vồng ra rồi buông thẳng xuống khung hình dù đầu lắc, gật hay nhóm đầu xoay.
  Bán kính `width·(0.3 + 0.7·smoothstep(0, 0.3, v))·(1 − v³)`: thắt ở chỗ buộc, phồng ra
  rồi thon nhọn tới mũi.
- **Đuôi ôm gáy**: điểm trục lọt vào mặt cầu bán kính `1 + volume + 0.9·r(v)` bị đẩy ra
  theo bán kính bằng softplus độ mềm 0.05, nên đuôi buộc cao trượt theo sau đầu chứ không
  xuyên sọ, và không gãy khúc chỗ bắt đầu đẩy. Lực đẩy tăng dần trong `v` 0.04…0.2 để gốc
  vẫn chìm dưới vỏ.
- **Búi** là khối tròn xoay dẹt dọc pháp tuyến, tâm cao `volume + 0.35·h` khỏi da
  (`h = squash·radius`), nên chân chìm vào vỏ.
- **Lệch tâm**: `tieLon` khác 180 thì chỗ buộc dời quanh đầu, trục tiết diện là hướng ngang trên
  mặt sọ ở chỗ ấy (`knotEast`). Búi thấp lệch nằm sau tai; đuôi ngựa lệch vẫn vồng ra theo pháp tuyến
  rồi buông theo trọng lực, đẩy ra khỏi sọ như đuôi giữa gáy.

| Mẫu | `front` | `part` | `fringe` | `volume` | `tie` | `tail` |
|---|---:|---:|---:|---:|---:|---:|
| `ponyHigh` (đuôi ngựa buộc cao) | 50 | 20 | 12 | 0.08 | 62 | 1.4 |
| `ponyLow` (đuôi ngựa buộc thấp) | 52 | 0 | 0 | 0.07 | 15 | 0.65 |

Đuôi của hai mẫu ngắn vừa đủ để mũi đuôi không thò xuống dưới đáy đầu ở mọi góc lắc, gật
±25°: nhìn trước đuôi nằm gọn sau đầu, nhìn nghiêng và sau lưng mới thấy. Buộc thấp đặt
`tie` 15 chứ không sát gáy, vì gốc sát gáy thì đuôi ngắn mấy cũng lòi dưới đầu.
| `bun` (búi cao) | 52 | 0 | 0 | 0.07 | 72 | — |

Búi thấp to: `bun` với `tie` quanh 5–10 và `knotSize` 1.4 — khối rủ tới ngang gáy mà còn cách cổ áo.

### Ngắn xù

Kiểu `messy` là tóc ngắn rủ quá gáy, lởm chởm ở mọi mép. Mẫu `messy` có `front` 50,
`fringe` 16, `volume` 0.12, `length` 1.05; bảng `SCULPT_STYLES.messy` giữ hình:

- Mái răng cưa `jag` sáu răng sâu nông không đều, giữ trong ±48° quanh giữa trán; răng
  đặt vào quãng `hangEase` (41°…66°) thì chồng lên chỗ chân tóc hạ xuống mảng rủ. Có `jag`
  nên không vẽ đường ngôi.
- Sáu lọn gai ngắn (dài 0.12…0.16) rải trên đỉnh và hai bên, ngả về phía chân tóc và bật
  khỏi pháp tuyến 55…70°, thành lọn vểnh; một `puff` rộng phồng đỉnh.
- Mảng rủ từ `hangFrom` 66, `hangEase` 25; đuôi xoè `flare` 0.12, hất ra từ nửa chiều dài
  (`curl: [0.55, 0.1]`), gợn dày `wave: [30, 0.06]`, chia lọn hẹp nhọn so le
  `tips: [18, 0.2, false, 0.2]`.

### Đầu đinh, tròn ngắn và mái dựng

Ba kiểu tóc nam ngắn, mái `flat` nên không hõm thái dương và không gờ ở ngôi.

- **`buzz`**: vỏ mỏng đều, `rim` 1 nên chân tóc là gờ bằng đúng bề dày vỏ. Mẫu có `front`
  36, `ear` 12, `sideburn` 4, `nape` −24, `fringe` 0, `volume` 0.04; không bướu, không nét.
- **`crop`**: `jag` ba răng — một răng hẹp ở kinh độ −12 là lọn xoáy chúc xuống trán, hai
  răng rộng ±58 hạ chân tóc dần về thái dương cho mép trán cong vòm khi nhìn chính diện.
  Tám lọn dẹt mọc quanh đỉnh rủ ra trước và hai bên; lọn mái giữa dài hơn, xoắn về mũi răng
  −12 thành lọn xoáy, các lọn mái khác dừng ngay trên mép vỏ để mép trán vẫn là đường răng của
  `jag`; hai lọn bên tai chìm ngọn vào vỏ. Sau đầu không có lọn.
  Hai `puff`, khối bên `+x` cao hơn.
  Mẫu có `part` 0, `front` 46, `fringe` 10 (độ sâu răng), `ear` 8, `sideburn` 2, `volume`
  0.11. Có `jag` nên không vẽ đường ngôi.
- **`quiff`**: mái vồng thấp vuốt ra sau. Vỏ dày dần trong 70% số hàng từ chân tóc (`ease`
  0.7, mặc định 0.25 của trường) nên mặt trước ngả theo sọ thành đường cong ra sau thay vì
  dựng vách ngay chân tóc; một `puff` nhỏ ở vĩ độ 80 bên mái và một `puff` rất thấp ở đỉnh.
  Bốn lọn dẹt mọc ngay trên chân tóc trán, chéo về phía mái và cong dần ra sau qua đỉnh
  (`turn` khoảng 20°), chân trồi trong 25% chiều dài, ngọn chìm vào vỏ sau đỉnh (`sink` 0.6).
  Sườn và sau đầu không có lọn. Mẫu có `part` −20, `front` 40, `fringe` 0, `ear` 18,
  `sideburn` −10 (tóc mai dài xuống trước tai), `volume` 0.1.

### Lọn vểnh

`ahoge` > 0 mọc bấy nhiêu **lọn vểnh** (アホ毛) từ xoáy trên đỉnh (`AHOGE_ROOT`: kinh độ 180, vĩ độ
80), trên mọi kiểu tóc; mặc định không có, nên bản cảnh sau tắt lọn chỉ cần một vật `items` thay
`hair` với `ahoge: 0`. `ahogeRings` ra lưới.

- Mỗi lọn là dải dẹt: rời vỏ theo pháp tuyến, trục quay dần về `ahogeHeading` trên mặt sọ, góc ngả
  khỏi pháp tuyến tăng theo `v^1.4` tới `ahogeBend` ở ngọn — `90` ngọn nằm ngang, `120` cụp xuống thành
  móc. Dài `ahogeLength` lần bán kính, chân chìm nửa bề rộng dưới vỏ.
- Bản rộng (`AHOGE_WIDTH` 0.06) nằm ngang với mặt phẳng cong, dày `0.45` bề rộng: nhìn thẳng thấy dải,
  nhìn nghiêng thấy nét cong. Rộng nhất quãng giữa, thon nhọn ở ngọn.
- Nhiều lọn toả ra `AHOGE_FAN` (32°) mỗi lọn quanh hướng giữa, chân dời 9° kinh độ, lọn ngoài ngắn hơn.
- Có mũ dựng khối thì lọn có chân trong lòng mũ bị bỏ.

### Hói chữ M

`recede` > 0 cho chân tóc hai bên trán lùi lên (`recession`, cộng vào `hairline`), dùng được với
mọi kiểu, kể cả `slick`. Từ giữa trán chân tóc lùi theo `sin` của kinh độ tới đủ `recede` ở
`±recedeAt`, nên giữa trán còn mũi nhọn; quá đó về lại chân tóc thường trong `1.1·recedeAt` độ kinh,
trước tai không đổi. Lọn gai, lọn vuốt và lọn dẹt của bảng kiểu dời chân lên theo (`recededLat`):
sát chân tóc dời đủ, lên tới đỉnh thì không dời, nên lọn không mọc trên chỗ hói.

Vuốt ngược hói chữ M: mẫu `slick` cộng `recede` 16, hạ `front` còn 54 cho mũi giữa trán rõ hơn.

### Màu phụ

`pieces.hair.accent` tô màu thứ hai lên phần dưới của vỏ — tóc mai bạc, hai bên muối tiêu. Vùng
tính theo cột kinh độ (`accentAt`): từ chân tóc lên `accentTo` phần chiều cao vỏ (kiểu hói là chiều cao
vành), đủ từ kinh độ `±accentFrom` ra sau gáy, mỏng dần về `0` trong `ACCENT_EASE` (25°) trước đó nên
trán và mái giữ màu chính.

- Có màu phụ thì mỗi cột vỏ đặt một hàng lưới đúng mép vùng: `accentTo · NJ` hàng dưới, còn lại ở
  trên, nên ranh giới là đường trơn chạy song song chân tóc, không bậc thang. Không có thì lưới y như
  thường.
- Hai màu là một vật liệu màu theo đỉnh (`npr({ tint })`, thuộc tính `tint` của lưới): nét bóng dáng
  hậu kỳ coi cả tóc là một vật, chỗ giáp hai màu không có nét. Lọn, búi và mặt rủ giữ màu chính.

## Kính dựng khối

`pieces.faceAcc` với `src: "sculpt"` là kính dựng khối: hai mắt kính,
cầu và hai càng dựng quanh hai mắt trên sọ đơn vị rồi quay theo đầu như
[tóc dựng khối](#tóc-dựng-khối). Một bộ số cho mọi góc, lắc và gật:

```json
"faceAcc": { "src": "sculpt", "color": "#2d2d2d", "glasses": { "shape": "rect" } }
```

| Trường | Mặc định | Nghĩa |
|---|---:|---|
| `shape` | `round` | `round` mắt tròn, `rect` chữ nhật bo góc |
| `tint` | `false` | Kính râm: mắt kính tô `color`, gọng vẽ màu nét. Không có thì gọng màu `color`, mắt kính rỗng |
| `size` | 0.19 | Nửa chiều cao mắt kính, lần bán kính sọ |
| `spread` | 0.03 | Tâm mắt kính xa trục giữa mặt hơn tâm mắt bấy nhiêu, lần bán kính |
| `rise` | 0 | Tâm mắt kính cao hơn tâm mắt, lần bán kính |
| `stand` | 0.12 | Mặt kính đứng trước mắt, lần bán kính |
| `thick` | 0.34 | Bề dày gọng, phần nét viền |

`GLASSES_PRESETS` là bộ mẫu — `round` (kính tròn), `rect` (chữ nhật), `sun` (kính
râm), `bold` (gọng dày chữ nhật); áp mẫu là thay cả `glasses`. `glassesPresetOf` cho biết bộ số
đang đúng bằng mẫu nào. Kính dựng khối cắm được vào vật (`items`), nên đeo tháo bằng
`equip` như mọi phụ kiện.

- Tâm mắt đọc từ `face.eyeGap` / `face.offsetY` như nét mặt; mắt kính theo mắt của
  từng nhân vật. Mỗi mắt kính là một mặt phẳng ngả về phía tai `WRAP` độ, nên lắc mạnh
  thì mắt kính xa bóp lại còn mắt kính gần vẫn mở.
- Càng rời mép ngoài mắt kính ở `HINGE` nửa chiều cao, về sát sọ trong 40% đầu, ôm
  thái dương tới tai ở kinh độ `EAR` rồi móc xuống sau tai. Càng nổi `ARM_LIFT` khỏi
  sọ.

`glassesFrame` (`core/glasses.ts`) dựng gọng, `glassesMesh` (`glasses.ts`) ra khối của người 3D.

## Mũ dựng khối

`pieces.crown` với `src: "sculpt"` là mũ của **người 3D**, không cần ảnh: một khối ôm sọ và vỏ tóc
dưới nó, quay theo đầu.

```json
"crown": { "src": "sculpt", "color": "#F3EBDD", "hat": { "height": 0.6 } }
```

Hai dáng (`shape`):

- `drum` — trụ thấp hở đáy, đỉnh phẳng bo mép: mũ đầu bếp Nhật 和帽子, mũ thợ.
- `peaked` — mũ kê-pi có lưỡi trai (制帽 của cảnh sát Nhật): băng quanh chân, chóp loe rộng hơn băng tới đỉnh
  phẳng, lưỡi trai nửa elip chúc xuống trước trán, dây quai ngang băng trên lưỡi trai, hai nút ở đầu quai,
  huy hiệu giữa trán chỗ chóp gặp băng (sao năm cánh trong vòng lá hở đỉnh, trên đế tròn).

Góc theo độ, dài theo bán kính sọ. Ô có hai số cách bằng `·` là `drum` · `peaked`: JSON bỏ trống thì lấy theo dáng
(`HAT_SHAPE_DEFAULTS`, đọc qua `hatSpec`).

| Trường | Mặc định | Nghĩa |
|---|---:|---|
| `shape` | `drum` | `drum` hay `peaked` |
| `front` / `back` | 32 / 18 · 24 / 14 | Vĩ độ miệng mũ ở giữa trán, ở gáy: miệng là mặt phẳng qua hai điểm ấy |
| `height` | 0.62 · 0.66 | Thân cao bấy nhiêu tính từ miệng theo trục mũ |
| `ease` | 0.03 | Khoảng hở giữa thân mũ và tóc (hay sọ); âm là ôm chặt hơn |
| `round` | 0.12 · 0.05 | Bán kính bo mép đỉnh |
| `flare` | 0 · 0.24 | `drum`: miệng nở ra bấy nhiêu phần bán kính thân, nhỏ dần tới mép bo. `peaked`: chóp nở dần từ mép trên băng, tới đỉnh rộng hơn băng bấy nhiêu phần |
| `folds` | `[0.32]` · `[]` | Nếp gấp ngang: mỗi số là một vòng nét mực ở bấy nhiêu phần chiều cao thân (`peaked`: phần chóp trên băng); `[]` là trơn |
| `band` | 0.24 | `peaked`: băng cao bấy nhiêu tính từ miệng |
| `bandColor` | `#16171b` | `peaked`: màu băng, cũng là màu đế huy hiệu |
| `brim` | 0.5 | `peaked`: lưỡi trai chìa ra trước miệng mũ bấy nhiêu ở giữa trán; `0` là không có |
| `droop` | 24 | `peaked`: lưỡi trai chúc xuống bấy nhiêu độ so với mặt miệng mũ |
| `brimColor` | `#101114` | `peaked`: màu lưỡi trai |
| `strap` | 0.055 | `peaked`: bản dây quai; `0` là không có quai và nút |
| `strapColor` | `#222327` | `peaked`: màu dây quai |
| `badge` | 0.13 | `peaked`: bán kính huy hiệu (không quá nửa phần chóp trên băng); `0` là không có |
| `badgeColor` | `#d8aa3c` | `peaked`: màu huy hiệu và hai nút ở đầu quai |

- **Cỡ mũ đo trên đầu** (`hatFit`): lấy mẫu sọ và vỏ tóc (`shellAt`, như hàng vỏ khi đầu thẳng) mỗi
  `3°`, giữ điểm trên miệng mũ (và dải `0.03` dưới nó). Thân là ống elip cùng tâm nhỏ nhất ôm mọi điểm
  ấy, nở thêm `ease`: đầu đinh thì mũ ôm sát, tóc bồng thì mũ to theo. Thân cao ít nhất tới trên đỉnh tóc
  `ease` cộng một phần bo, nên đỉnh mũ không cắt tóc. Băng của `peaked` là chính ống ấy; chóp loe ra ngoài nó.
- **Tóc dưới mũ không lòi ra**: vỏ tóc nằm trong ống nên mũ che; lọn gai, lọn dẹt, lọn vểnh, búi, đuôi
  ngựa có chân trong lòng mũ (`insideHat`) bị bỏ cả khối (`sculptMesh` nhận `cut`). Phần tóc dưới miệng
  mũ — mai, gáy — vẫn hiện.
- **Lưỡi trai của `peaked`** là tấm dày hình lưỡi liềm: mép trong theo miệng mũ nửa trước (hai đầu ngang
  thái dương), mép ngoài nửa elip chìa `brim`, mỗi điểm chúc `droop` quanh chân của nó trên miệng mũ. Nó gắn
  vào khối đầu như cả mũ nên gật, lắc đầu không xuyên mặt; phần chìa ra luôn nằm ngoài sọ (miệng mũ ở nửa trên,
  nơi đầu `human` trùng mặt cầu).
- **Nét mực**: mũ là vật riêng có nét bóng dáng hậu kỳ dày `0.03` (`npr({ ink })`), nên miệng mũ có nét
  rõ trên trán, mũ trắng trên áo trắng vẫn tách khối. Nếp gấp là ống mực mảnh nổi nhẹ khỏi thân; `peaked`
  có thêm một vòng ở đường nối băng với chóp. Các phần của `peaked` là một vật liệu tô màu theo tam giác
  (khe sâu `inkGap` `0.06`): quai và huy hiệu nổi sát băng không bị nét của băng phủ, mép lưỡi trai và chóp loe
  vẫn có nét.
- Mũ vẽ hai mặt: nhìn từ dưới thấy lòng mũ cùng màu. Đỉnh mũ là đỉnh đầu của `headFit`, nên socket
  `crown` của đồ gắn và nhãn bám đỉnh đầu nằm trên mũ.
- `hatMesh` ra tam giác từng phần (`tris` thân, `band`, `seat` đế huy hiệu, `brim`, `strap`, `badge`) và vòng
  nét ở hệ sọ đơn vị; người 3D phóng theo khối đầu như tóc. Mũ không dời theo `humanHair`: miệng mũ nằm ở nửa
  trên sọ, nơi đầu `human` trùng mặt cầu.
- Màu thân là `pieces.crown.color`, bỏ trống thì lấy màu áo.

Cảnh sát đồn khu vực (地域警察官), mũ mùa đông: thân cùng màu áo đông 濃紺 ("xanh than đậm"), băng, quai,
lưỡi trai đen, huy hiệu vàng — đúng mặc định của `peaked`, chỉ cần màu thân:

```json
"crown": { "src": "sculpt", "color": "#1e2638", "hat": { "shape": "peaked" } }
```

Cảnh sát giao thông đang điều khiển, bắt lỗi: bọc mũ trắng (白色帽子おおい) và quai trắng (白色あごひも); băng,
lưỡi trai, huy hiệu giữ nguyên — chỉ đổi màu:

```json
"crown": { "src": "sculpt", "color": "#f4f2ec", "hat": { "shape": "peaked", "strapColor": "#f4f2ec" } }
```

Màu theo [`警察官の服制に関する規則`](https://laws.e-gov.go.jp/law/331M50400000004) (国家公安委員会規則第4号, 別表): mũ đông cùng màu áo đông (濃紺色); lưỡi trai và
quai bằng nhựa đen; huy hiệu 日章 vàng trong vòng hoa anh đào vàng, đế đen; băng (帯章) vải đen, từ 警部補 trở lên dệt
thêm sọc vàng hay xanh theo cấp — rig không vẽ sọc, 巡査 / 巡査部長 là băng đen trơn. Mũ hè, mũ giao mùa màu 藍色
("chàm"). Quai trắng và bọc mũ trắng của cảnh sát giao thông theo quy định của từng tỉnh (ví dụ [quy định của cảnh
sát Gunma](https://www.pref.gunma.jp/uploaded/attachment/153572.pdf), điều 6).

## Trâm cài búi

`pieces.headAcc` với `src: "sculpt"` là trâm (簪) của **người 3D**: một que mảnh xuyên khối buộc của tóc
dựng khối, một hạt tròn ở đầu que.

```json
"headAcc": { "src": "sculpt", "color": "#3A2A22", "accent": "#D9573B", "pin": { "angle": 40 } }
```

| Trường | Mặc định | Nghĩa |
|---|---:|---|
| `angle` | 40 | Hướng đầu có hạt trên mặt búi: `0` ngang về `+x`, `90` thẳng lên, `180` ngang về `−x` |
| `lean` | 15 | Đầu có hạt chếch ra khỏi mặt búi bấy nhiêu độ |
| `length` | 0.95 | Dài cả que |
| `reach` | 0.6 | Phần que phía hạt, tính từ chỗ xuyên |
| `thick` | 0.02 | Bán kính que (đầu kia thon còn `0.7`) |
| `bead` | 0.065 | Bán kính hạt |

- Que đặt theo `knotFrame` của tóc: xuyên điểm cao `0.2·h` trên tâm khối dọc pháp tuyến, nên búi lệch
  (`tieLon`) hay búi to (`knotSize`) đều mang trâm theo. Mặt búi có hai tiếp tuyến: "lên" là hướng
  thẳng đứng chiếu lên mặt búi (búi trên đỉnh thì là hướng về gáy), "ngang" vuông góc với nó, chọn chiều
  về `+x`. Tóc không có khối buộc thì trâm cắm ở chỗ buộc trên vỏ.
- Que màu `pieces.headAcc.color`, hạt màu `pieces.headAcc.accent` (bỏ trống thì cùng màu que); đầu
  `human` thì trâm dời theo `humanHair` như tóc. Nét bóng dáng hậu kỳ mảnh `0.014`.
- `pinMesh` ra tam giác que và hạt ở hệ sọ đơn vị.

## Bông tai

`pieces.headAcc.earrings` với `src: "sculpt"` là một cặp bông tai của **người 3D**, mỗi tai một chiếc ở dái tai. Cùng
socket với [trâm](#trâm-cài-búi): một mảnh mang được cả hai.

```json
"headAcc": { "src": "sculpt", "earrings": { "shape": "drop", "gem": "#B3243A" } }
```

Dài theo bán kính sọ.

| Trường | Mặc định | Nghĩa |
|---|---:|---|
| `shape` | `stud` | `stud` nụ dẹt áp dái tai, `hoop` vòng tròn xỏ qua dái tai, `drop` hạt ở dái tai, sợi thõng và viên giọt nước ở đáy |
| `color` | `#d9b44a` | Màu kim loại: vòng, sợi, hạt |
| `gem` | màu kim loại | Màu viên: nụ, viên ở đáy bông dài |
| `size` | `0.06` / `0.15` / `0.07` | Bán kính nụ / bán kính vòng / bán kính viên đáy, theo `shape` |
| `length` | 0.36 | Bông dài: từ chỗ treo tới đáy viên |
| `thick` | 0.014 | Bán kính sợi kim loại; vòng dày `1.3` lần |

- **Cỡ hơi to hơn thật** (nụ thật chừng `0.02`, vòng `0.11` bán kính sọ): ở trung cảnh cả đầu chỉ vài chục điểm ảnh, cỡ
  thật thì bông tai còn một hai điểm ảnh, lẫn vào nét viền đầu. Cỡ mặc định to chừng gấp rưỡi tới gấp ba cho đọc được như
  hoạt hình; cận mặt muốn thật hơn thì hạ `size`.
- **Chỗ đeo đọc từ tai của đầu `human`** (`HUMAN_HEAD.ear`, đặt và quay như tai của người 3D): `earLobe` cho lỗ xỏ giữa bề
  dày dái tai và mặt ngoài dái tai. Đầu cầu không vẽ tai, bông tai đeo ở cùng chỗ trên mặt cầu.
- **Tóc phủ tai thì che bông tai** như thật: không có luật ẩn riêng, vỏ tóc nằm ngoài nên che phần trong nó; vòng và bông
  dài thõng dưới mép tóc thì lộ phần dưới.
- **Phần thõng theo trọng lực.** Vòng và sợi + viên của bông dài là nhóm quay quanh chỗ treo (`userData.dangle` trong nhóm
  đầu): `act` gọi `hangJewelry` sau khi đặt khớp, quay nhóm cho trục `−y` của nó chỉ thẳng xuống thế giới — nghiêng đầu,
  cúi chào thì bông vẫn rủ. Cảnh tự đặt khớp (không qua `act`) thì gọi `hangJewelry(fig)` sau `updateMatrixWorld`. Không
  đung đưa theo thời gian.
- `pieces.headAcc` dựng khối chỉ có `earrings` thì không cắm trâm mặc định; muốn cả trâm thì khai `pin`.
- Nét bóng dáng hậu kỳ mảnh `0.012`; vật `userData.noEdge` (xem [Dây chuyền](#dây-chuyền)).
- `earringMesh` ra tam giác kim loại, viên và phần thõng (tính từ chỗ treo) ở hệ sọ đơn vị.

## Thân áo dựng khối

`pieces.torso` với `src: "sculpt"` là thân áo dựng khối: áo là vài đặc điểm
mô tả bằng số trên bề mặt một khối thân, quay theo thân như
[tóc dựng khối](#tóc-dựng-khối) quay theo đầu. Một bộ số cho mọi góc:

```json
"torso": { "src": "sculpt", "color": "#5b6ea8", "garment": { "style": "tshirt", "hem": 12 } }
```

Khối thân là chồng các tiết diện ngang ellipse đồng dạng, bề dày trước–sau bằng
`TORSO_DEPTH` lần bề ngang; người 3D tách bề sâu khỏi bề ngang ở nửa trên
([ngực và lưng nhìn nghiêng](#ngực-và-lưng-nhìn-nghiêng)). Mặt cắt dọc đi từ mép trên (cao hơn khớp cổ `rise`, nửa rộng
`NECK_TOP · neck`) vát xuống vành vai (nửa rộng `rig.shoulderHalf + ease`, thấp hơn mép
trên `slope` px mỗi px vát ra ngang, không thấp hơn khớp vai), bo góc `round`, rồi thon
xuống gấu (nửa rộng `rig.hipHalf + fit · (shoulderHalf − hipHalf) + ease`, thấp hơn hông
`hem`, bo góc `hemRound`); eo co vào `waist` theo một vòm sâu nhất giữa vành vai và gấu.
Mọi kiểu theo cùng một dáng: không chỏm vai, gấu võng bo góc, eo co nhẹ, tay mọc ra từ viền
thân. `torsoMesh` (`torso.ts`) dựng khối từ bảng kiểu và hàm của `core/torso.ts`.

| Trường | `bare` | `tshirt` | `shirt` | `polo` | `sweater` | `suit` | `hoodie` | `blouse` | Nghĩa |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `style` | | | | | | | | | Tên kiểu; mặc định `tshirt` |
| `ease` | 9 | 11 | 11 | 11 | 11 | 11 | 11 | 9 | Vải rộng hơn thân bấy nhiêu px mỗi bên |
| `fit` | 0.7 | 0.7 | 0.7 | 0.7 | 0.7 | 0.8 | 0.7 | 1 | Độ suông: gấu rộng bằng hông ở `0`, bằng vai ở `1` |
| `waist` | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 10 | Eo co vào bấy nhiêu px mỗi bên |
| `hem` | −4 | 1 | 5 | 3.5 | 2 | 10 | 5.5 | 8 | Gấu thấp hơn hông bấy nhiêu px, nhân `rig.height`; giữa gấu còn võng thêm |
| `rise` | 6 | 6 | 6 | 6 | 6 | 6 | 6 | 6 | Mép trên của khối cao hơn khớp cổ bấy nhiêu px; áo có cổ đứng quanh cổ |
| `neck` | 17 | 20 | 20 | 20 | 20 | 20 | 20 | 19 | Nửa rộng miệng cổ áo, chỗ viền cổ chạm mặt vát hai bên |
| `neckFront` | 0 | 7 | 10 | 9 | 12 | 76 | 8 | 8 | Viền cổ trước thấp hơn chỗ chạm hai bên bấy nhiêu px trên mặt khối; âm là cao hơn |
| `neckBack` | 0 | 0 | 0 | 0 | 0 | 0 | 8 | 0 | Như `neckFront`, phía sau |
| `slope` | 0.6 | 0.6 | 0.6 | 0.6 | 0.6 | 0.6 | 0.7 | 0.6 | Vát vai hạ bấy nhiêu px mỗi px ra ngang |
| `cladSlope` | 0.4 | 0.4 | 0.4 | 0.4 | 0.4 | 0.4 | 0.5 | 0.4 | Như `slope` cho nhân vật `palette.clad`: vai thoải để tay to buông thẳng |
| `round` | 16 | 16 | 16 | 16 | 16 | 16 | 16 | 16 | Bán kính bo góc giữa vát vai và thân |
| `hemRound` | 8 | 8 | 8 | 8 | 8 | 8 | 8 | 8 | Bán kính bo góc gấu |

**Một dáng thân người cho mọi kiểu.** `bare` là thân người (`BODY` ở `core/torso.ts`): số của áo phông, nhỏ hơn `CLOTH`
(`2` px) mỗi bên, mép trên cùng độ cao với mép trên áo phông, miệng cổ hẹp hơn cổ người 3D để cổ mọc liền từ mặt vát. Áo là
lớp vải ngoài thân ấy: cởi áo phông ra, người mặc đồ hẹp đi chừng `1`–`2` px, gốc vai lùi vào chừng `2` px, cổ lộ ra bằng
nhau. Kiểu khác (`blazer` `ease` `8`, `cardigan` `12`…) là áo rộng, chật hơn áo phông bấy nhiêu.

Trường bỏ trống lấy số của kiểu ở bảng `GARMENT_STYLES`; `garmentOf` trả bộ số đã đủ. `collarUp` ([cổ dựng](#cổ-dựng)), `belly`
([bụng phệ](#bụng-phệ)) và `bust` ([ngực nở](#ngực-nở)) không thuộc bảng kiểu: bỏ trống là `0` ở mọi kiểu. `neckline`, `marks`
([dáng cổ và đặc điểm của kiểu](#dáng-cổ-và-đặc-điểm-của-kiểu)), `panels` ([mảng áo và hoạ tiết](#mảng-áo-và-hoạ-tiết)) và
`inner` ([áo trong và cà vạt](#áo-trong-và-cà-vạt)) cũng không thuộc bảng kiểu.
Kiểu mang cả những đặc điểm không có số, đặt theo số đo đã đủ nên đè `neck`, `hem`… thì
chúng đi theo:

| Kiểu | Cổ | Đặc điểm |
|---|---|---|
| `bare` ngực trần | | Hai nét ngực, xương ức, rốn, hai bả vai và sống lưng ở thắt lưng dưới bả vai, mảnh và nhạt (`ink` `0.3`) chỉ gợi khối; người 3D mặc đồ có thân màu da (`color` trùng `palette.skin`) dùng chính vật liệu da tay trần: vai liền tay không nét |
| `tshirt` áo phông | U, gân nổi khối | |
| `shirt` sơ mi | V, cổ bẻ nổi khối | Lá cổ nhọn, nẹp chạy tới gấu, ba cúc |
| `polo` áo polo | V, cổ bẻ nổi khối | Lá cổ ngắn hơn, nẹp ngắn khép đáy, một cúc |
| `sweater` áo len | U, gân nổi khối có vạch | Bo gấu 13 px có vạch quanh khối |
| `suit` vest cà vạt | V sâu, ve áo nổi khối | Cà vạt màu nét dài quá đáy cổ, cắt theo chữ V như luồn dưới vạt; không áo trong (thân áo lộ giữa hai ve) trừ khi khai `inner.color`; nẹp, hai cúc, hai vạt bo ở gấu; sau lưng là dải cổ |
| `hoodie` | V, mũ trùm nổi khối | Dây rút mọc từ mép mũ, túi trước, bo gấu 12 px |
| `blouse` cổ lá sen | U, lá sen nổi khối | Lá sen ba cánh màu kem cố định `#f6efe4`, nơ màu nhấn, đường eo, nếp vạt quanh khối |
| `wrap` cổ chéo | Chéo vạt trái đè vạt phải, dải cổ nổi khối | Cổ lót, đai, dây buộc, khoá và nút đai — [Áo cổ chéo](#áo-cổ-chéo); có `wrap.open` thì hai vạt mở — [Áo khoác vạt mở](#áo-khoác-vạt-mở) |

Bốn kiểu áo nữ dùng cùng khối thân và bộ chỉnh:

| Kiểu | Số khác áo phông | Đặc điểm |
|---|---|---|
| `blazer` | `ease: 8`, `waist: 11`, `fit: 0.85`, `hem: 0`, `neckFront: 73` | Ve gập có khấc, áo trong màu `accent`, hai cúc lệch bên, túi ngang |
| `cardigan` | `ease: 12`, `waist: 3`, `hem: 6`, `neckFront: 52` | Cổ V viền gân, áo trong màu `accent`, ba cúc, bo gấu |
| `bowShirt` | `ease: 8`, `waist: 5`, `hem: 3`, `neckFront: 17` | Cổ bẻ nhỏ, nơ màu `accent` với hai dải rủ, nẹp giữa |
| `squareNeck` | `ease: 9`, `waist: 10`, `fit: 1`, `hem: 9`, `neck: 23`, `neckFront: 19` | Cổ vuông bo nhẹ, đường eo cao, vạt xòe với nếp lớn |

Áo trong, nơ, cúc và túi chiếu trên mặt khối, khuất khi quay lưng; ve và viền cổ
có bề dày riêng. `accent` của blazer và cardigan là màu áo trong. Áo trong phủ cả miệng
cổ chữ V từ mép trên khối tới đáy chữ V, liền viền cổ, không viền, không trải xuống vạt bụng
([áo trong và cà vạt](#áo-trong-và-cà-vạt)); cúc và túi đặt theo khoảng từ đáy
cổ tới gấu. Bộ phối váy ngắn dùng `garment.hem: -18` để áo dừng ở eo, trên cạp của
[váy dựng khối](#váy-dựng-khối) với số mặc định.

Không có chỏm vai: tay áo là ống `palette.sleeve*` của người mặc đồ ([01](01-rig.md#người-3d-mặc-đồ)).

| Hằng số | Giá trị | Nghĩa |
|---|---:|---|
| `TORSO_DEPTH` | 0.78 | Bề dày trước–sau, lần bề ngang ở cùng độ cao |

- **Viền cổ là đường trên mặt khối**: chạm mặt vát ở hai bên cách trục `neck`, võng
  `neckFront` phía trước và `neckBack` phía sau theo hình cos, mỗi điểm nằm trên tiết diện
  ở độ cao ấy. Nhìn thẳng thấy chữ U phía trước, nhìn sau thấy nửa sau nông, nghiêng thấy
  nửa gần thành dải gần ngang chúc xuống phía trước.
- **Cổ `V`** thẳng từ hai chỗ chạm xuống giữa ngực sâu `neckFront`; nửa sau vẫn võng
  theo hình cos.
- **Đặc điểm trên mặt khối** đặt bằng kinh độ và `y` của nhóm thân, hoặc bằng `x` cách
  trục ở mặt trước / mặt sau (đổi ra kinh độ theo nửa rộng ở độ cao ấy). Ba loại: nét,
  chấm và mảng kín. Chúng dán trên mặt khối, không có bề dày, nên nhìn nghiêng dồn về viền
  bóng: thứ phải nhô khỏi hình bao (cổ bẻ, viền cổ gân, mũ trùm) là tấm lưới. Nét, chấm nhạt (`ink` dưới `1`) pha màu
  nét về màu thân bấy nhiêu; người 3D dựng chúng thành hình in bám mặt khối như mảng áo (dải thon hai đầu như nét bút,
  chấm tròn), không nổi khối, không nhận nét hậu kỳ, nên không cắt viền bóng.
- **Mảng kín** tô màu áo, màu nét, màu nhấn (`torso.accent`, bỏ trống là màu áo tối đi `0.3`),
  màu da (`skin`) hay một mã màu cố định.
- **Cổ bẻ nổi khối** (`collar` của kiểu) là hai tấm lưới, không phải đặc điểm dán. Chân
  cổ dựng từ viền cổ lên `stand` px ở nửa sau, thấp dần theo `|sin|` về `0` ở giữa ngực.
  Lá cổ gập từ đỉnh chân cổ xuống mép ngoài: quanh lưng rộng `band` px trên mặt khối, hai
  bên cổ `side`, phía trước đi thẳng trên hình phẳng `x`–`y` qua các điểm `flap` về đáy cổ
  giữa ngực. Mép thẳng được lấy mẫu dày: chèn điểm theo kinh độ thì đoạn sát bên cổ phồng
  ra ngoài mặt khối. Mỗi điểm lá cổ nằm trên mặt khối, nổi theo pháp tuyến từ `lift[0]` ở
  nếp gập tới `lift[1]` ở mép ngoài; mép ngoài vểnh thêm tới `tip` ở điểm `flap[tipAt]`
  (bỏ trống là điểm cuối), nhạt dần về hai phía. Pháp tuyến lấy đạo hàm mặt cắt dọc trên
  ±4 px: mặt cắt là đường gấp khúc, lá cổ nổi cao khuếch đại chỗ nhảy bậc thành răng cưa.
  Nửa sau cổ áo nâng lên `0.35` px mỗi px lùi sau trục (`COLLAR_LEAN`, vuốt mềm quanh trục)
  như cổ đổ về trước: nhìn nghiêng dải cổ chéo từ gáy xuống mũi cổ.

  | Kiểu | `stand` | `band` | `side` | `flap` | `lift` | `tip` | Màu |
  |---|---:|---:|---:|---|---|---:|---|
  | `shirt` | 6 | 9 | 6 | `(16, neckFront + 11)` | 5 → 2 | 9 | áo |
  | `polo` | 6 | 8 | 6 | `(16, neckFront + 9)` | 5 → 2 | 8 | áo |
  | `suit` | 6 | 7 | 6 | `(27, 38)`, `(8, neckFront − 8)`; vểnh ở đỉnh ve | 7 → 1.5 | 4 | áo |
  | `blouse` | 2 | 6 | 3 | cánh bên: cung elip tâm `(14.5, 8)`, bán trục `6.5 × 6`, `−45°` → `165°`; nửa cánh giữa: tâm `(0, 11)`, `8 × 7`, `−35°` → `90°`; vểnh ở cánh bên | 3 → 2 | 2 | kem `#f6efe4` |

  `y` của `flap` tính từ chỗ viền cổ chạm mặt vát. Mép ngoài chạm trục giữa trước đáy cổ
  (cánh giữa của lá sen) thì dừng ở đó: hai nửa gặp nhau ở một điểm, cánh giữa không bị nét
  chẻ đôi. Chân cổ thường nằm dưới đầu, thứ nhìn thấy là lá cổ.
- **Viền cổ gân nổi khối** (`rib` của kiểu) là một tấm lưới vòng quanh viền cổ, từ viền cổ
  xuống viền cổ nở rộng và hạ `width` px. Mỗi điểm nổi theo pháp tuyến từ `lift[0]` ở mép cổ
  tới `lift[1]` ở mép dưới: mép dưới là đường may sát mặt vải, nên chỗ vòng cắt viền bóng
  không thành nêm. Mép cổ dựng thêm `stand` px ở nửa sau; cả độ dựng lẫn độ nổi nhạt dần
  theo `sin²` về giữa ngực, độ dựng về `0`, độ nổi về `0.3` lần (`RIB_FRONT`) — mép cổ trước
  nổi cao là bị đầu che; nhạt theo `|sin|` thì mép cổ gãy nhọn ở giữa ngực. Nửa sau nâng `lean` px mỗi px lùi sau
  trục (bỏ trống là `COLLAR_LEAN` như cổ bẻ): nhìn nghiêng mép vòng gồ lên sau gáy. Áo phông viền nằm sát quanh chân cổ,
  không dựng, không nâng. `line` là nét viền, lần nét thân. Vạch gân (`ticks`) mỗi `step` độ
  quanh trục cổ, từ `0.2` tới `0.8` bề rộng vòng.

  | Kiểu | `width` | `stand` | `lift` | `lean` | `line` | Vạch gân |
  |---|---:|---:|---|---:|---:|---|
  | `tshirt` | 6 | 0 | 1.2 → 0.3 | 0 | 0.8 | |
  | `sweater` | 8 | 4 | 4.5 → 0.4 | `COLLAR_LEAN` | 0.78 | mỗi 15°, nét 0.56 |

  **Da trong miệng cổ.** Người 3D mặc đồ (`palette.clad`), mọi kiểu áo, có lưới màu da phủ mặt khối từ viền cổ lên mép
  trên khối và nắp đỉnh khối, nổi `0.3` px (`NECK_SKIN`, dưới viền gân, cổ bẻ, áo trong và mảng áo): miệng cổ áo lộ da chứ
  không phải màu áo — cổ chữ V của sơ mi, polo là ngực trên. Lưới dùng chính vật liệu ống cổ, không nét hậu kỳ: chỗ nối
  với cổ liền, mép dưới khuất dưới nét mép cổ của viền gân, cổ bẻ.
- **Mũ trùm nổi khối** (`hood` của kiểu) là một tấm lưới dải hở, từ đuôi vạt `+x` vòng qua
  lưng tới đuôi vạt `−x`. Mép cổ là viền cổ chữ V, nửa sau trễ xuống `neckBack`. Mỗi vạt
  vắt qua giữa ngực `tuck` độ quanh trục cổ: mép cổ chữ V đi thẳng tiếp xuống nên hai vạt
  chéo nhau, còn mép dưới của đuôi vạt trùng mép dưới của vạt kia. Vạt `−x` đè lên
  đuôi vạt `+x`. Mép dưới thấp hơn chỗ
  viền cổ chạm mặt vát `drop` px, nút theo góc quanh trục cổ từ giữa trước tới giữa sau, đối
  xứng hai bên: vạt trước ôm sát cổ, cao nhất trên vai, rủ chữ U sau lưng. Đuôi vạt không
  được thấp quá mép dưới: `neckFront · (1 + sin tuck)` nhỏ hơn `drop` ở góc `tuck`.
  Mỗi điểm nổi theo pháp tuyến từ `lift[0]` ở mép cổ tới `lift[1]` ở mép dưới (phía trước
  nhạt về `RIB_FRONT` như viền cổ gân), cộng đống vải `pile · 16 v² (1 − v)²` với `v` từ mép
  cổ (`0`) xuống mép dưới (`1`), `pile` từ `pile[0]` giữa trước lên `pile[1]` giữa sau theo
  `sin⁴(φ/2)`. Đống vải nằm giữa bề rộng tấm, chỗ lưng dựng đứng: pháp tuyến ở đó hướng ra
  sau nên nhìn nghiêng nhô khỏi lưng. Sát mép cổ pháp tuyến chếch lên, phồng ở đó thì mũ
  dựng lên chạm đầu và nhìn sau gờ đống vải che mép cổ. Mũ không dựng và không nâng theo
  `COLLAR_LEAN`.
  Đường may giữa lưng là vạch trên tấm từ `0.05` tới `0.9` bề rộng. Dây rút là đặc điểm dán,
  đầu trên nằm dưới mép mũ.

  | `drop` (`φ`: px) | `tuck` | `lift` | `pile` | Nét viền | Đường may |
  |---|---:|---|---|---:|---:|
  | 0: 16, 35: 13, 70: 9, 100: 10, 125: 22, 150: 40, 180: 50 | 30° | 4 → 0.3 | 2 → 12 | 1 | 0.67 |
- **Vạt áo người 3D ngồi** (`seated`, `lapFold` của lõi). Gấu thấp hơn hông thì khối thân không buông thẳng
  xuyên đùi xuống ghế. Chỗ gập cao hơn hông bằng chỗ cao nhất của mặt đùi khi gối gập vuông — đùi cong vồng
  theo `bendLimb` (điểm điều khiển thứ hai nhô `limbCurve / 6` ống chân) và thon dần về gối — gồm vỏ viền,
  cộng 1 px. Dưới chỗ gập, áo dài (gấu thấp hơn hông từ `LAP_FLAP` = 20 px: yukata, kimono, áo khoác dài) có
  nửa trước nằm ngang trên đùi: vành xa chỗ gập bao nhiêu thì nửa sâu thêm bấy nhiêu dọc đùi, không hẹp lại ở
  góc bo của gấu, nên các vành lồng nhau thành vạt nửa ellipse mép trơn. Áo ngắn hơn (sơ mi, polo, len) không
  trải vạt: nửa trước giữ chỗ cũ và dừng ở đường gập, bụng bo xuống mặt đùi. Nửa sau, hai sườn và tâm nắp gấu buông tới mặt ghế (`legHalf` dưới hông) rồi dừng; kinh độ trước ±`0.3`
  (`cos`) chuyển dần từ buông sang gập. Nửa trước không thấp hơn đường qua chỗ gập theo hướng đùi: thân ngả
  trước thì bụng dừng trên đùi. Nét, chấm, mảng giữ khoảng nổi khỏi mặt khối. Hướng đùi là hướng đùi trung
  bình trong mặt dọc của thân; `act` gập lại khi nó đổi quá nửa độ, người nền `lod: 'low'` gập sẵn chếch
  lên `0.1` một lần. Người ngồi mặc váy dựng khối thì thân áo dưới cạp dồn lên cạp, khuất trong váy.
- Thân áo dựng khối cắm được vào vật (`items`), đổi bằng `equip` như mọi thân áo.

### Áo cổ chéo

`style: "wrap"` là thân áo vạt chéo — kimono, yukata, áo làm việc, áo bếp — một kiểu, nhiều bộ số.
Số khác áo phông: `ease: 10`, `fit: 0.85`, `waist: 2`, `hem: 5`, `neck: 18`, `neckFront: 30`,
`hemRound: 6`. Cổ chéo, dải cổ và đai khai ở `garment.wrap`; `wrapParts` của lõi dựng chúng,
`torsoMesh` ra khối.

```json
"torso": { "src": "sculpt", "garment": { "style": "wrap", "hem": -36, "neckBack": 8,
  "wrap": { "band": 5, "under": 3, "underColor": "#fff8ec",
    "obi": { "color": "#efe4cf", "y": 56, "width": 34, "cord": 3, "cordColor": "#d9573b", "clasp": 7, "knot": "taiko" } } } }
```

- **Vạt trái người mặc đè vạt phải (右前)**, cố định, không có số đảo: mặc ngược là cách mặc cho
  người chết. Mép vạt trên đi từ bên cổ phía `+x` (vai trái người mặc; bên `−1` là tay phải) chéo
  qua giữa ngực, thấp hơn chỗ viền cổ chạm mặt vát `neckFront` px, đi tiếp sang `−x` tới `−overlap`
  rồi bẻ thẳng xuống gấu trong khoảng `WRAP_BEND` px. Nhìn chính diện, mép ấy là nét dài của chữ
  "y": từ bên phải khung xuống bên trái. Vạt dưới đối xứng qua trục, chỉ lộ phía trên chỗ giao —
  nét ngắn của chữ "y". `human.test.ts` khoá chiều này.
- **Độ dài** là `hem` như mọi thân áo: `-36` dừng trên cạp váy dựng khối có `rise` `46` (đai che
  chỗ nối), `5` tới hông, `40` tới giữa đùi. Mép vạt trên chạy tiếp tới gấu.
- **Dải cổ** (衿) là tấm lưới nổi khối dọc mép vạt trên từ gấu lên bên cổ, vòng sau gáy, xuống mép
  vạt dưới tới chỗ nó lọt dưới vạt trên. Phía trước rộng `band` px vuông góc với mép vạt trên hình
  phẳng; sát bên cổ, chỗ khối hẹp hơn, điểm trượt xuống mặt vát tới chỗ đủ rộng; sau gáy là viền
  cổ nở rộng như viền cổ gân. Nổi `WRAP_LIFT` `2.4` px ở mép vạt, `1.4` px ở mép ngoài; nét viền
  `0.6` lần nét thân ở hai mép. **Cổ lót** (半衿) rộng `under` px nằm phía trong dải cổ, nổi `1.6`
  px, nét ở mép trong. Sau gáy viền cổ hạ `neckBack` px (衣紋, cổ sau hạ khỏi gáy).
- **Da trong miệng cổ** là tấm lưới màu da nhân vật nổi `1` px, từ mép vạt lên tới mép trên khối:
  phía trước là chữ V, quanh gáy là dải trên viền cổ. Hàng lưới dày (`33` hàng): mặt cắt dọc gãy
  khúc ở mép mặt vát, hàng thưa thì dây cung chui xuống dưới mặt khối và nét bóng dáng của thân lòi
  qua thành vệt.
- **Đai** (帯) là khối vòng kín ôm thân, tâm cao hơn hông `y · rig.height`, bản rộng
  `width · rig.height`. Tiết diện ngang là ellipse nửa rộng, nửa sâu lớn nhất của khối trong bản
  đai cộng `lift` (đai là trụ, không theo eo lõm), tiết diện dọc là chữ nhật bo góc từ `2` px trong
  mặt khối ra `lift` px ngoài. Đai che chỗ nối thân áo với váy: khối kín còn một phần trên cạp váy thì
  giữ nguyên, không cắt theo cạp như nét và mảng.
- **Dây buộc đai** (帯締め) là vòng tiết diện tròn đường kính `cord` quanh giữa bản đai, tâm nổi
  khỏi mặt đai `0.2 · cord`. **Khoá đai** (帯留) là khối dẹt trên dây giữa bụng, rộng `clasp`, cao
  `max(1.4 · cord, 0.64 · clasp)`, dày `max(2, 0.35 · clasp)`.
- **Nút sau lưng** là khối dẹt bo cạnh: mặt trong theo mặt ngoài của đai, mặt ngoài phẳng; khối
  cứng gắn thân, không rủ, không lắc. `A` là nửa rộng mặt ngoài đai:

  | `knot` | Khối |
  |---|---|
  | `none` | Không có |
  | `taiko` | お太鼓: rộng `1.6 · A`, từ trên mép đai `4` px xuống `12 · rig.height` px dưới hông (không cao hơn mép dưới đai `8` px), bo góc `7`; dày `3.5` px ở mép trên tới `6.5` px ở mép dưới |
  | `kai` | 貝の口: `0.72 · A` × `1.05` bản đai, chếch `−14°`, dày `4`; bỏ trống `knotX` thì lệch `0.3 · A` về `+x` |
  | `bunko` | 文庫: hai cánh `0.6 · A` × `1.15` bản đai chếch `±10°`, dày `6`, cách tâm `0.3 · A`; nút giữa `0.18 · A` × `0.8` bản, dày `9` |

- Khối kín (đai, dây, khoá, nút) có vỏ viền như khối thân; người mặc đồ thêm nét bóng dáng hậu kỳ.
  Người ngồi: dải cổ, đai và vạt gập theo đùi cùng khối thân (`lapFold`).
- Tay áo là ống `palette.sleeve*` của người mặc đồ. Tay áo rộng dần về cổ tay của kimono, yukata là
  `palette.sleeveFlare` ([01](01-rig.md#người-3d-mặc-đồ)): ống tay áo phủ ngoài tay, miệng mở, bàn tay giữ cỡ
  theo `sleeveWidth`. `sleeveWidth` lớn thì cả tay lẫn bàn tay to theo. Không có vạt tay rủ (袂).

| Trường của `wrap` | Mặc định | Nghĩa |
|---|---:|---|
| `overlap` | 22 | Mép vạt trên chạy xuống gấu lệch sang bên phải người mặc nhiều nhất bấy nhiêu px |
| `band` | 6 | Dải cổ rộng bấy nhiêu px; `0` là không có |
| `bandColor` | màu áo | Màu dải cổ |
| `under` | 0 | Cổ lót lộ một dải bấy nhiêu px phía trong dải cổ; `0` là không có |
| `underColor` | `#f6efe4` | Màu cổ lót |
| `obi` | | Đai; bỏ trống là không đai |
| `open` | | Hai vạt mở, [Áo khoác vạt mở](#áo-khoác-vạt-mở); bỏ trống là cổ chéo |
| `letters` | | Chữ dọc trên dải cổ, [Chữ trên dải cổ](#chữ-trên-dải-cổ) |

| Trường của `wrap.obi` | Mặc định | Nghĩa |
|---|---:|---|
| `color` | `torso.accent` | Màu đai; `accent` bỏ trống là màu áo tối đi `0.3` |
| `y` | 52 | Tâm đai cao hơn hông bấy nhiêu px, nhân `rig.height` |
| `width` | 30 | Bản rộng, nhân `rig.height` |
| `lift` | 4 | Đai nổi khỏi thân áo bấy nhiêu px |
| `cord` | 0 | Dây buộc đai dày bấy nhiêu px; `0` là không có |
| `cordColor` | màu đai | |
| `clasp` | 0 | Khoá đai rộng bấy nhiêu px; `0` là không có |
| `claspColor` | màu dây | |
| `knot` | `none` | Nút sau lưng: `none`, `taiko`, `kai`, `bunko` |
| `knotColor` | màu đai | |
| `knotX` | 0 | Tâm nút lệch khỏi giữa lưng bấy nhiêu px về `+x` (bên trái người mặc); `kai` bỏ trống thì `0.3 · A` |

Bộ số hay dùng, `rig.height = 1`:

| Áo | `garment` | Ghi chú |
|---|---|---|
| Kimono thân trên | `{ "style": "wrap", "hem": -36, "neckBack": 8, "wrap": { "band": 5, "under": 3, "obi": { "y": 56, "width": 34, "cord": 3, "clasp": 7, "knot": "taiko" } } }` | Phối váy dựng khối `rise` `46`; đai cao, bản rộng |
| Áo làm việc tới hông | `{ "style": "wrap" }` | Không đai, quần cùng màu |
| Áo bếp tới hông | `{ "style": "wrap", "hem": 8 }` | Cổ cùng màu; tay xắn: `palette.sleeveLength` `0.5` |
| Yukata ngồi tới đùi | `{ "style": "wrap", "hem": 40, "wrap": { "bandColor": "…", "obi": { "y": 14, "width": 14, "lift": 3, "knot": "kai" } } }` | Đai thấp bản hẹp; ống chân cùng màu vải: `palette.trouser` (yukata là vật thay áo thì khai ở `torso.palette`, xem dưới) |
| Yukata đứng | `{ "style": "wrap", "hem": 5, "wrap": { "bandColor": "…", "obi": { "y": 30, "width": 16, "lift": 3, "knot": "kai" } } }` | Phối [vạt dài quấn](#vạt-dài-quấn) `rise` `27`: đai che chỗ nối; tay loe `palette.sleeveFlare` `12` |

Khách đổi đồ Tây sang yukata của quán là vật thay `torso` (và `hem`) trong `items`; tay áo dài loe, ống chân cùng màu
vải là của bộ yukata nên khai ở `palette` của thân áo ấy, đè `palette` nhân vật khi đang mặc
([01](01-rig.md#đồ-thay-được-items-và-equip)):

```json
"yukata-ngoi": { "torso": { "src": "sculpt", "color": "#EFE4CF",
  "garment": { "style": "wrap", "hem": 40, "wrap": { "bandColor": "#2B3A67", "obi": { "color": "#9C5A3C", "y": 14, "width": 14, "lift": 3, "knot": "kai" } } },
  "palette": { "sleeve": "#EFE4CF", "sleeveLength": 1, "sleeveFlare": 12, "trouser": "#EFE4CF", "trouserLength": 1 } } }
```

### Cổ dựng

`garment.collarUp` (`0..1`, mặc định `0`) dựng lá cổ bẻ lên ôm gáy — polo, sơ mi dựng cổ. Có ở mọi kiểu có cổ bẻ
nổi khối (`shirt`, `polo`, `bowShirt`, `suit`, `blazer`, `blouse`).

```json
"garment": { "style": "polo", "collarUp": 1 }
```

- Lá cổ quay quanh nếp gập (đỉnh chân cổ): mỗi điểm giữ khoảng cách tới nếp gập, hướng đi từ hướng gập xuống sang
  hướng dựng phần `collarUp`. Hướng dựng là thẳng lên, chếch ra ngoài theo pháp tuyến ngang của mặt khối ở chân cổ
  `COLLAR_POP_FLARE[0]` (`0.25`) lần ở sau gáy, tới `[1]` (`1.5`) lần ở giữa ngực: sau gáy là vành đứng ôm cổ, hai mũi
  cổ trước ngực xoè ra hai bên cằm thay vì đâm lên.
- `0` là lá cổ gập đúng như không khai. Lá cổ dựng cao bằng chân cổ cộng bề rộng lá cổ; tóc dài rủ gáy có thể lấn vào.

### Ngực và lưng nhìn nghiêng

Người 3D (`torsoMesh`, `torsoSection` của lõi) không lấy bề sâu thân theo bề ngang ở nửa trên: vành vai rộng mà
mỏng, từ chân cổ mặt trước đi xuống ngực theo một dốc dài, lưng đầy sớm hơn ngực.

| Hằng số | Giá trị | Nghĩa |
|---|---:|---|
| `CHEST.at` | 0.7 | Ngang ngực cao hơn hông bấy nhiêu phần thân (nhân `rig.height`): nửa trước đầy nhất ở đây; mốc `chest` cũng ở đây |
| `CHEST.back` | 0.6 | Nửa sau đầy sau bấy nhiêu phần quãng từ mép trên xuống ngang ngực |
| `CHEST.step` | 3 | Trên ngang ngực, hàng mặt cắt cách nhau không quá bấy nhiêu px |

- `chestDepth` nhận nửa bề sâu theo bề ngang (`TORSO_DEPTH` lần nửa rộng, người mặc đồ theo `cladProfile`) và trả
  nửa sau (`depth`) và nửa trước (`front`): từ ngang ngực xuống giữ nguyên; trên đó mỗi nửa đi từ bề sâu ở mép trên tới
  bề sâu ở đích theo dốc Hermite `u + u² − u³` — ở mép trên dốc bằng dốc trung bình, tới đích thì đứng —, đích của nửa
  trước là ngang ngực, của nửa sau là `CHEST.back` quãng ấy. Không nửa nào sâu hơn bề sâu theo bề ngang ở cùng độ cao.
- Nửa trước cộng [bụng phệ](#bụng-phệ) và [ngực nở](#ngực-nở). Mọi chỗ đọc mặt thân 3D đi qua `torsoSection`: khối thân, nét, mảng, cổ áo, khăn,
  kính gài nẹp, dây chuyền, mốc người (`markAt`), lấn thân của bộ giải khuỷu, `armPierce`.

### Bụng phệ

`garment.belly` (px, mặc định `0`) làm khối thân rộng nhất ở bụng — dáng quả lê của người bụng phệ:

```json
"garment": { "style": "polo", "collarUp": 1, "belly": 22, "bellySide": 0.15 }
```

- Phần nhô theo độ cao là hình chuông `bellyAt`: đỉnh `1` cao hơn hông `BELLY.at` (`0.3`) thân, rộng `BELLY.spread`
  (`0.3`) thân, nhân `rig.height`; vai, ngực gần như không đổi. Mặt cắt dọc nở ra hai bên `garment.bellySide` lần
  `belly` (bỏ trống là `BELLY.side`, `0.45`) và nhô ra trước đủ `belly`:
  tiết diện ngang là nửa ellipse trước sâu hơn nửa sau, hai nửa liền mạch ở hai sườn, nên bụng tròn mượt, lưng giữ phẳng.
- **Bụng ra trước là chính**: `bellySide` nhỏ (`0.1..0.2`) giữ bụng nhô to mà sườn áo gần như thẳng, tay buông choãi
  ít; `0` là chỉ nhô ra trước, tay buông như người không bụng. Nhìn chính diện thì `bellySide` nhỏ đọc ra người gầy hơn —
  bụng to đọc ở góc nghiêng.
- Thân áo có `front` (nửa sâu nửa trước) cạnh `depth`; khối thân, nét, mảng, cổ bẻ, cổ chéo đặt trên mặt ấy, vạt áo
  người ngồi gập theo nó (`lapFold`).
- **Tay buông choãi ra ngoài bụng**: `roots3` choãi tay tới khi mép trong tay cách sườn áo không bụng (đã lùi theo tay)
  cộng phần bụng nở hai bên một `CLAD_GAP`, nên sườn áo không bị tay cắt mất bụng ([01](01-rig.md#người-3d-mặc-đồ)).
  Tay tránh phần bụng chứ không tránh cả thân áo chưa lùi: `polo` `belly` `24` người mặc đồ mặc định choãi chừng `15°`
  (người không bụng `6°`), `bellySide` `0.15` chừng `9°`.
  Góc choãi là của cả tay; cẳng tay ôm theo bụng là việc của hành động (gập khuỷu vài độ ở dáng đứng).
- **Đai trên bụng phệ** ([áo cổ chéo](#áo-cổ-chéo)) không còn là trụ ở chỗ rộng nhất mà ôm bao lồi của thân trong bản
  đai, riêng bề ngang, nửa sâu trước, nửa sâu sau: mép trên mép dưới của đai không hở khỏi bụng, đai dưới bụng nghiêng
  theo bụng.
- Khối hông, váy, vạt dài, tạp dề đọc nửa sau (`depth`) như cũ: phối bụng phệ với quần là đủ; váy, vạt dài dưới bụng thì
  gấu áo nhô ra trước cạp.
- Đặt cùng `belly` cho mọi thân áo của một người (`items` thay áo): bụng là số của thân áo, không của `rig`.

### Ngực nở

`garment.bust` (px, mặc định `0`) phồng nửa trước của thân 3D quanh ngang ngực — nhìn nghiêng đọc ra dáng người nữ:

```json
"garment": { "style": "blouse", "bust": 6 }
```

- Phần phồng theo độ cao là hình chuông `bustAt`: đỉnh `1` ở ngang ngực (`CHEST.at`), rộng `BUST.up` (`0.25`) thân phía
  trên, `BUST.down` (`0.15`) thân phía dưới, nhân `rig.height` — phía trên liền vào dốc cổ–ngực, phía dưới thu về thân gọn
  hơn. Cộng vào nửa trước (`front`) như [bụng phệ](#bụng-phệ): một khối liền ngang ngực, không chia hai bầu, tắt dần ra hai
  sườn theo nửa ellipse trước; bề ngang và nửa sau không đổi, tay buông không choãi thêm.
- Mức hợp người que là `4..8`; khối thân, nét, mảng, cổ áo, khăn, mốc `chest`, lấn thân của bộ giải khuỷu và `armPierce`
  đọc cùng mặt ấy ([ngực và lưng nhìn nghiêng](#ngực-và-lưng-nhìn-nghiêng)), nên tay ôm đồ trước ngực không xuyên thân.

## Khăn vắt vai và kính gài nẹp

Socket `neck` với `src: "sculpt"` là đồ dựng khối bám thân áo của người 3D, cắm được qua `items` như mọi socket. Một mảnh mang được cả khăn, kính và [dây chuyền](#dây-chuyền).

### Khăn vắt vai

`neck.drape`: dải vải phẳng vắt qua một vai, buông trước ngực và sau lưng; màu `neck.color` (bỏ trống là màu áo).

```json
"neck": { "src": "sculpt", "color": "#2B3A67", "drape": { "side": "left", "width": 16, "front": 90, "back": 70 } }
```

| Trường | Mặc định | Nghĩa |
|---|---:|---|
| `side` | `left` | Vai trái người mặc (`+x` hệ thân) hay `right` |
| `width` | 16 | Bản rộng, px |
| `front` / `back` | 70 / 60 | Dài phía trước, phía sau tính từ đỉnh vai, px dọc khăn, nhân `rig.height` |
| `thick` | 2.5 | Dày, px |
| `at` | 0.5 | Tâm khăn trên vai: `0` sát cổ áo, `1` ở gốc tay |

- Khối cứng trong nhóm thân, không rủ, không lắc: cúi chào thì khăn theo thân. Mỗi lát dọc của khăn (mặt phẳng cách
  trục một `x`) là bao của thân áo và nắp vai (`garmentSocket`, bán kính gốc ống tay) nở `DRAPE_GAP` (`1.5` px), nhìn từ
  một tâm trong thân ngang gốc vai; dưới tâm ấy vải rủ thẳng — xuống tới đâu cũng không lùi vào gần thân hơn chỗ nhô
  nhất phía trên, nên khăn buông thẳng qua ngực, qua bụng phệ. Hai mút cắt vuông, có vỏ viền như đai.
- Tay buông nằm ngoài khăn. Tay khoanh, cánh tay đưa ra trước ở phía có khăn phải cách ngực hơn `DRAPE_GAP + thick`
  (chừng 4 px), không thì lấn vào khăn: hành động khoanh tay cho người vắt khăn soạn cẳng tay xa ngực hơn thường.
- Người ngồi: phần khăn dưới chỗ gập gập theo đùi cùng thân áo.

### Kính gài nẹp

`neck.shades`: kính râm treo ở nẹp áo bằng một gọng — hai mắt kính, cầu kính và gọng gài lên đáy cổ áo, dán trên mặt
thân. Mắt kính màu `lens`, cầu và gọng màu mực, mỗi phần một khối dẹt có vỏ viền.

```json
"neck": { "src": "sculpt", "shades": { "side": "left" } }
```

| Trường | Mặc định | Nghĩa |
|---|---:|---|
| `shape` | `rect` | `rect` chữ nhật bo góc, `round` tròn |
| `size` | 7 | Nửa chiều cao mắt kính, px |
| `y` | 6 | Bản lề gọng thấp hơn đáy cổ áo (`neckFront` dưới chỗ viền cổ chạm mặt vát) bấy nhiêu px |
| `side` | `left` | Gọng gài ở bên trái người mặc (`+x`) hay `right`; mắt kính bên kia trễ xuống |
| `tilt` | 14 | Nghiêng, độ |
| `lens` | `#2a2b33` | Màu mắt kính |

Kính đeo trên mặt và kính gài nẹp là hai vật khác socket: đổi giữa chừng bằng `equip` (`{ "faceAcc": "kinh-ram", "neck":
null }`).

### Dây chuyền

`neck.necklace`: dây mảnh hay chuỗi ngọc vòng quanh chân cổ, nằm trên mặt thân áo, võng xuống trước ngực, mặt dây ở chỗ
thấp nhất. Màu ở chính `necklace`, không đọc `neck.color` (màu khăn).

```json
"neck": { "src": "sculpt", "necklace": { "pendant": "drop", "gem": "#B3243A" } }
```

```json
"neck": { "src": "sculpt", "necklace": { "style": "pearl", "pendant": "none", "drop": 16 } }
```

| Trường | Mặc định | Nghĩa |
|---|---:|---|
| `style` | `chain` | `chain` dây liền, `pearl` chuỗi hạt tròn sát nhau |
| `color` | `#d9b44a` / `#f4ede0` | Màu dây (vàng) / màu hạt (trắng ngà) |
| `drop` | 20 | Chỗ thấp nhất giữa ngực thấp hơn chân cổ bấy nhiêu px |
| `thick` | 0.75 / 1.9 | Bán kính dây / bán kính hạt, px |
| `pendant` | `round` | Mặt dây: `none` không có, `round` hạt tròn dẹt, `drop` giọt nước đầu nhọn quay lên |
| `size` | 3.6 | Bán kính mặt dây, px |
| `gem` | màu dây | Màu mặt dây |

- **Theo viền cổ áo đang mặc.** Sau gáy và hai bên, dây chạy theo viền cổ (`Surface.neck`) lùi vào trong `NECKLACE_INSET`
  (`1.2` px cộng bán kính dây): nằm trên da giữa cổ và mép cổ, trong viền gân của áo phông, dưới chân cổ bẻ của sơ mi. Ống
  cổ (`NECK_TUBE`) lùi sau và nở ở chân nên sau gáy nó nhô khỏi mặt khối: với áo viền gân, chỗ nào tâm dây không cách trục
  ống cổ được bán kính ống ở chân cộng bán kính dây và `NECKLACE_LIFT` thì dây lùi ít hơn, thiếu nữa thì vắt lên viền gân
  (tối đa hết bề rộng viền). Độ lùi sau gáy đi trơn theo `(−cos φ)^p` với `p` lớn nhất mà mọi góc vẫn tránh được ống cổ,
  nên dây võng nhẹ qua viền ở giữa lưng thay vì gãy khấc. Phía
  trước dây võng theo `cos^k` của góc quanh cổ (`k` `1.7` có mặt dây, `1.3` không), cùng một vòng cho cổ U, cổ V, cổ vuông:
  cổ vuông thì dây nằm trong khoảng hở, cổ V hẹp thì dây vắt qua vạt, cổ bẻ, lá sen che chỗ chúng phủ.
- Mỗi điểm dây nổi khỏi mặt khối bán kính dây cộng `NECKLACE_LIFT` (`0.35` px). Đoạn dây nằm trên viền gân (tâm dây
  thấp hơn viền cổ quá một bán kính dây về phía trong, chuyển dần trong một bán kính) nổi thêm độ nổi mép cổ của viền ở góc
  ấy (`rib.lift[0]`, nhạt về `RIB_FRONT` ở giữa ngực như viền) để dây vắt qua viền không chìm. Khối cứng trong nhóm thân: cúi chào thì dây theo thân, không
  rủ khỏi ngực.
- **Cỡ hơi to hơn thật**: dây thật một hai ly còn chưa tới một điểm ảnh ở trung cảnh; dây mặc định dày `1.5` px, mặt dây
  bán kính `3.6` px, hạt ngọc `1.9` px để đọc được như hoạt hình. Cận ngực muốn mảnh hơn thì hạ `thick`, `size`.
- **Nét**: vỏ viền mảnh riêng (`ink` của khối kín, px: dây `0.3`, hạt `0.4`, mặt dây `0.6`). Khối thân áo có `ink` là đồ
  nhỏ: lưới mang `userData.noEdge`, pipeline không vẽ nét hậu kỳ dò từ độ sâu, pháp tuyến, không chấm bóng tiếp xúc và
  không cho nét bóng dáng của vật khác loang lên nó — dây vài điểm ảnh mà nhận nét hai mép hay nét bóng dáng thân áo (dây
  nằm cách thân chưa tới ba lần bề dày nét) thì đen kín.
- Hạt ngọc đếm theo chu vi, cách nhau chừng `2.05` lần bán kính; khoen nối mặt dây chỉ có ở `chain`.
- `necklaceSolids` ra khối kín hệ nhóm thân như `drapeSolid`, `shadesSolids`.

### Áo khoác vạt mở

Có `wrap.open` thì kiểu `wrap` là áo khoác vạt mở — 法被, 羽織: hai vạt không chéo nhau mà buông thẳng, chừa khe giữa
thấy áo trong. Vạt là chính khối thân, cứng, không bay không rủ; tay áo là ống `palette.sleeve*` như mọi người mặc đồ.

```json
"torso": { "src": "sculpt", "accent": "#f3ebdd", "garment": { "style": "wrap", "hem": 12, "ease": 12,
  "wrap": { "band": 7, "bandColor": "#3a2a22", "open": { "gap": 8 } } } }
```

- **Mép vạt** trái người mặc đi từ bên cổ phía `+x` chéo xuống như mép vạt trên của cổ chéo (dốc theo `neck` và
  `neckFront`), tới `gap / 2` thì bẻ thẳng xuống gấu trong khoảng `WRAP_BEND` px; mép vạt phải đối xứng qua trục. Hai mép
  không gặp nhau: khe giữa rộng `gap` px chỗ buông thẳng. `overlap` không dùng cho vạt; `neckFront` lớn thì chữ V sâu
  hơn (羽織 bẻ ve: `44`).
- **Dải cổ** rộng `band` px, màu `bandColor`, chạy từ gấu vạt trái lên bên cổ, vòng sau gáy, xuống suốt mép vạt phải tới
  gấu; nổi khối và có nét viền như dải cổ chéo.
- **Áo trong** là tấm màu `torso.accent` (bỏ trống là màu áo tối đi `0.3`) nổi `OPEN_FILL_LIFT` `0.6` px phủ khe giữa hai
  mép vạt, từ miệng cổ áo trong tới gấu, lấn dưới dải cổ một px. Miệng cổ áo trong là cổ tròn hạ `OPEN_CREW` `4` px ở
  giữa ngực; `cross > 0` thì là chữ V của cổ chéo 右前 giao ở `cross` px dưới chỗ viền cổ chạm mặt vát, kèm cổ lót
  `under` px màu `underColor` dọc hai mép cổ chéo — chỉ phần lộ giữa hai mép vạt, phần còn lại dồn vào dưới dải cổ. Da
  trong miệng cổ như cổ chéo.
- **Đai** (`wrap.obi`) chỉ còn cung giữa hai mép vạt ở độ cao đai, bịt hai đầu; dây buộc và khoá đai như cổ chéo, không có
  nút sau lưng. Đai nằm dưới vạt: `lift` nhỏ hơn độ nổi dải cổ (`1.5`) thì mép vạt đè lên đầu đai.
- **Dây buộc trước ngực** (羽織紐, `tie > 0`): mỗi bên một ống tròn đường kính `tie` từ giữa dải cổ ở độ cao `tieY` võng
  xuống `3` px tới nút tròn đường kính `1.7 · tie` giữa khe, nổi trên dải cổ.
- Người ngồi: vạt, dải cổ, áo trong gập theo đùi cùng khối thân.

| Trường của `wrap.open` | Mặc định | Nghĩa |
|---|---:|---|
| `gap` | 12 | Khe giữa hai mép vạt chỗ buông thẳng rộng bấy nhiêu px |
| `cross` | 0 | Áo trong cổ chéo giao thấp hơn chỗ viền cổ chạm mặt vát bấy nhiêu px; `0` là áo trong cổ tròn |
| `tie` | 0 | Dây buộc trước ngực dày bấy nhiêu px; `0` là không có |
| `tieY` | 80 | Dây buộc cao hơn hông bấy nhiêu px, nhân `rig.height` |
| `tieColor` | `#f6efe4` | |

| Áo | `garment` | Ghi chú |
|---|---|---|
| 法被 tới hông | `{ "style": "wrap", "hem": 12, "ease": 12, "wrap": { "band": 7, "bandColor": "…", "open": { "gap": 8 } } }` | Áo trong `torso.accent`; tay ôm |
| 羽織 tới giữa đùi | `{ "style": "wrap", "hem": 36, "ease": 13, "neckFront": 44, "wrap": { "band": 7, "under": 3, "open": { "gap": 18, "cross": 24, "tie": 1.8, "tieY": 86 }, "obi": { "y": 56, "width": 30, "lift": 1.5 } } }` | Khoác ngoài kimono: `accent` màu kimono, cổ lót kem trong khe, đai lộ giữa khe |

### Chữ trên dải cổ

`wrap.letters` in chữ xếp dọc lên dải cổ phía trước (衿文字), mỗi bên một chuỗi. Chữ là texture vẽ bằng canvas trên một
lưới bám đúng mặt dải cổ, nổi trên dải `0.15` px: cong theo thân, khuất khi quay đi. Chuỗi chạy dọc dải theo độ cao, nên
đặt ở đoạn dải buông thẳng; ở đoạn chéo gần cổ chữ bị kéo xiên. Áo cổ chéo khép chỉ in `left` (dải bên phải khuất dưới
vạt trên). Canvas vẽ bằng phông hệ thống (`Noto Serif CJK JP`, `Noto Sans CJK JP` qua fontconfig, rồi `serif`,
`sans-serif`); Node trần không có canvas thì không có chữ, hình khối vẫn đủ.

```json
"wrap": { "band": 7, "bandColor": "#3a2a22", "open": { "gap": 8 }, "letters": { "left": "楓荘", "color": "#ffffff" } }
```

| Trường của `wrap.letters` | Mặc định | Nghĩa |
|---|---:|---|
| `left` | `""` | Chuỗi trên dải cổ bên trái người mặc (`+x`, bên phải người xem) |
| `right` | `""` | Bên phải người mặc |
| `color` | `#ffffff` | |
| `size` | `0.8 · band` | Cỡ một chữ, px; chuỗi dài `size` nhân số chữ |
| `y` | 66 | Tâm chuỗi cao hơn hông bấy nhiêu px, nhân `rig.height` |
| `font` | `serif` | `serif` (明朝) hay `sans` (ゴシック), đậm |

### Hình in trên áo

`garment.prints` là danh sách hình in lên mặt khối của **mọi kiểu** thân áo dựng khối (背紋 giữa lưng, chữ to sau lưng,
dấu nhỏ trước ngực). Mỗi hình là một khung `size` × `size` px (chữ: một ô mỗi chữ, xếp dọc hay ngang) chiếu thẳng từ
trước hay sau lên mặt khối, nổi `PRINT_LIFT` `0.8` px: nhìn thẳng thì không méo, cong theo thân, khuất khi quay đi, gập
theo đùi khi ngồi. Rig không biết tên quán nào: hình là chuỗi chữ, path SVG trong JSON, hay một hình có tên trong
`PRINT_SHAPES` (`core/print.ts`).

```json
"garment": { "style": "wrap", "prints": [{ "side": "back", "shape": "maple", "size": 66, "y": 70, "color": "#fff8ec" }] }
```

| Trường của `prints[]` | Mặc định | Nghĩa |
|---|---:|---|
| `side` | `back` | `back` giữa lưng, `front` trước ngực |
| `x` | 0 | Tâm lệch khỏi giữa thân bấy nhiêu px về `+x` (bên trái người mặc) |
| `y` | 72 | Tâm cao hơn hông bấy nhiêu px, nhân `rig.height` |
| `size` | 40 | Cạnh khung của hình, hay cỡ một chữ, px |
| `color` | `#fff8ec` | |
| `text` | | Chữ in; có thì bỏ qua `path`, `shape` |
| `font` | `serif` | Như `letters.font` |
| `vertical` | `true` | Chữ xếp dọc từ trên xuống; `false` là một dòng ngang |
| `path` | | Path SVG trong hộp `0…100`, `y` xuống, tô evenodd; có thì bỏ qua `shape` |
| `shape` | `circle` | Hình có tên: `maple` lá phong năm thuỳ có cuống, `circle` tròn, `ring` vành khuyên, `diamond` thoi |
| `rotate` | 0 | Xoay theo chiều kim đồng hồ khi nhìn thẳng vào hình, độ |

### Thẻ tên

`garment.badge` dán một thẻ chữ nhật bo góc lên ngực trái người mặc, trên **mọi kiểu** thân áo dựng khối. Thẻ là hình in
bám mặt khối như `prints`, nổi `lift` px: nền `color`, viền mực mảnh ngoài cùng rồi viền `edge`, chữ `text` một dòng
ngang chữ không chân đậm, co lại cho vừa thẻ. `wakaba` thêm dấu lá non 若葉マーク ở đầu trái: hình mũi tên chúc xuống chia
đôi, nửa trái vàng `#f2c200`, nửa phải xanh lá `#1e9a48` khi nhìn thẳng, viền màu `edge`. Ở trung cảnh thẻ chỉ đọc
được là một mảng sáng có chấm màu; chữ để cận cảnh. Bật tắt thẻ hay dấu theo cảnh: hai mục `items` của socket `torso`
cùng `garment`, khác `badge` ([Đồ thay được](01-rig.md#đồ-thay-được-items-và-equip)).

| Trường của `badge` | Mặc định | Nghĩa |
|---|---:|---|
| `x` | 19 | Tâm lệch khỏi giữa ngực bấy nhiêu px về `+x` (ngực trái người mặc) |
| `y` | 86 | Tâm cao hơn hông bấy nhiêu px, nhân `rig.height` |
| `width`, `height` | 12, 6 | px |
| `round` | 1.2 | Bán kính bo góc, px |
| `lift` | 0.8 | Thẻ nổi khỏi mặt khối bấy nhiêu px; dán lên dải cổ thì nâng quá độ nổi của dải (`3`) |
| `color` | `#fff8ec` | Nền thẻ |
| `edge` | `#3a2a22` | Viền thẻ, viền dấu lá non |
| `text` | `""` | |
| `textColor` | `#1c1c1e` | |
| `wakaba` | `false` | Dấu lá non |

Thân người mặc đồ hẹp (nửa ngang ngực chừng `30`–`34` px): thẻ quá `x + width / 2 ≈ 26` thì lấn sang sườn, méo theo mặt
khối. Áo khoác vạt mở có dải cổ tới `gap / 2 + band` px: đặt thẻ ngoài khoảng ấy.

### Dáng cổ và đặc điểm của kiểu

`garment.neckline` (`round` chữ U, `v` chữ V, `square` cổ vuông) đè dáng viền cổ trước của kiểu: viền cổ gân,
cổ bẻ, áo trong, `clip` của mảng áo đều theo viền cổ đã đè. Áo phông cổ V sâu là `tshirt` với `neckline: "v"` và
`neckFront` lớn.

`garment.marks: false` bỏ mọi đặc điểm dán của kiểu (nét, chấm, mảng: nẹp, cúc, túi, áo trong, cà vạt, ngực trần); cổ bẻ,
viền gân, mũ trùm, cổ chéo vẫn dựng. Thân trơn để tự vẽ bằng [mảng áo](#mảng-áo-và-hoạ-tiết): `{ "style": "bare", "marks":
false }` là thân ôm không cổ áo.

### Áo trong và cà vạt

`garment.inner` chỉnh áo trong lộ giữa hai vạt cổ chữ V và cà vạt của `blazer`, `cardigan`, `suit`. Áo trong phủ cả miệng cổ
chữ V, từ mép trên khối xuống đáy chữ V, liền viền cổ: không có dải màu áo khoác giữa viền cổ và áo trong. Cà vạt có nút sát
viền cổ, bản rộng dần, cắt theo chữ V như luồn dưới vạt nên phần dưới đáy chữ V khuất; đáy chữ V là chỗ cài cúc trên của
áo khoác. Chỉ người 3D nổi chúng khỏi mặt khối (áo trong `1` px, cà vạt `1.05` px): vỏ viền cổ người cắm xiên qua mặt vát,
nổi thấp thì vỏ ấy lòi qua thành chấm mực.

```json
"garment": { "style": "blazer", "neckFront": 90, "inner": { "color": "#A9C8E8", "tie": { "color": "#1A2236" } } }
```

| Trường của `inner` | Mặc định | Nghĩa |
|---|---:|---|
| `color` | `accent` (blazer, cardigan), không có (suit) | Màu áo trong; màu tô như mảng áo: `color`, `line`, `accent`, `skin` hay mã màu |
| `line` | 0 | Nét viền áo trong, lần nét thân |
| `tie` | không có (blazer, cardigan), cà vạt màu nét (suit) | Cà vạt; `false` bỏ cà vạt của suit |

| Trường của `inner.tie` | Mặc định | Nghĩa |
|---|---:|---|
| `color` | `line` | Màu cà vạt |
| `width` | 1 | Nhân bề ngang |
| `length` | 102 | Mũi cà vạt thấp hơn chỗ viền cổ chạm mặt vát bấy nhiêu px |
| `line` | 0 | Nét viền, lần nét thân |

### Mảng áo và hoạ tiết

`garment.panels` là danh sách mảng màu kín trên mặt khối của **mọi kiểu** thân áo dựng khối: phối màu từng mảng, sọc ngang,
sọc dọc, kẻ ô, chấm bi, chỗ khoét lộ da. Mỗi mảng là một polygon (hay path SVG) chiếu thẳng từ trước, từ sau, hay trải quanh
khối, tô một màu, có viền và hoạ tiết tuỳ chọn; bỏ trống `pts` và `path` là cả thân. Mảng bám mặt khối như hình in: cong theo
thân, khuất khi quay đi, gập theo đùi khi ngồi. `panelParts` của lõi dựng chúng, `torsoMesh` ra lưới.

```json
"garment": { "style": "tshirt", "panels": [{ "pattern": { "color": "#f4efe6", "width": 6, "gap": 7 } }] }
```

| Trường của `panels[]` | Mặc định | Nghĩa |
|---|---:|---|
| `fill` | | Màu nền: `color` màu áo, `line` màu nét, `accent` màu nhấn, `skin` màu da, hay mã màu `#rrggbb`; bỏ trống là không tô (chỉ hoạ tiết, viền) |
| `side` | `front` | `front` chiếu từ trước, `back` từ sau, `both` cùng `pts` cả trước lẫn sau, `around` trải quanh khối |
| `pts` | | Đỉnh polygon `[x, y]`: `x` px cách trục về `+x` (bên trái người mặc) — với `around` là kinh độ, độ (`0` giữa ngực, `180` giữa lưng) —, `y` theo `from` |
| `path` | | Path SVG trong hộp `0…100` (`y` xuống), tâm `x`, `y`, khung `width` × `height`; mỗi đường con tô kín riêng (không khoét lỗ). Chỉ nhận `M L H V C Q Z`; có thì bỏ qua `pts` |
| `x`, `y` | 0, 0 | Tâm của `path` |
| `size` | 40 | Cạnh khung của `path`, px; `width`, `height` đè từng chiều |
| `rotate` | 0 | Xoay `path` theo chiều kim đồng hồ khi nhìn thẳng, độ |
| `from` | `hip` | `y` đo từ đâu: `hip` cao hơn hông bấy nhiêu px, nhân `rig.height`; `neck` thấp hơn chỗ viền cổ chạm mặt vát bấy nhiêu px (âm là cao hơn) |
| `mirror` | `false` | Thêm bản lật qua trục giữa |
| `clip` | `none` | `neck` chỉ giữ phần trong miệng cổ (trên viền cổ), `body` chỉ giữ phần dưới viền cổ |
| `line` | 0 | Nét viền, lần nét thân |
| `pattern` | | Hoạ tiết lặp trong mảng |
| `layer` | `over` | `under` dưới đặc điểm của kiểu (áo trong, cà vạt), `over` trên |

| Trường của `pattern` | Mặc định | Nghĩa |
|---|---:|---|
| `kind` | `stripes` | `stripes` sọc, `check` kẻ ô (sọc hai chiều vuông góc), `dots` chấm bi so le |
| `color` | `#ffffff` | Màu sọc, chấm; màu tô như `fill` |
| `width` | 6 | Bề rộng sọc, đường kính chấm, px |
| `gap` | 6 | Khoảng trống giữa hai sọc, hai chấm, px |
| `angle` | 0 | `0` sọc ngang, `90` sọc dọc; dương là đầu phải của sọc ngóc lên khi nhìn thẳng, độ |
| `offset` | 0 | Dời cả hoạ tiết theo pháp tuyến của sọc, px |
| `cross` | `color` | Kẻ ô: màu ô hai sọc chéo nhau |

- **Ba hệ toạ độ.** `front` / `back` đo `x` px dọc mặt khối từ đường giữa trước / giữa sau, theo cung tiết diện ở độ cao
  ấy (cùng chiều `+x` bên trái người mặc, nên nhìn từ sau thì hình lật ngang): mảng đặt theo px trên mặt vải, gần đường giữa
  trùng hình nhìn thẳng, ra sườn không dồn lại. `x` quá phần tư chu vi tiết diện thì dồn về sườn (kinh độ `±90`): mảng mặt
  trước không bao giờ tràn sang lưng. Người mặc đồ ngang ngực nửa rộng chừng `28`–`30` px nhưng từ đường giữa ra sườn chừng
  `44` px vải, nên phù hiệu ngực ở `x` `±30` vẫn nằm trên ngực. Trên mặt vát vai tiết diện nhỏ dần lên cổ: dây vai ở `x` cố
  định vắt qua đỉnh vai sát cổ hơn ở ngực. `around` đo theo kinh độ nên trải quanh khối liền mạch. Hoạ tiết đo bằng px trong
  hệ của mảng; với `around` kinh độ đổi ra px ở nửa rộng ngang ngực. Gốc hoạ tiết ở giữa thân, ngang chỗ viền cổ chạm mặt
  vát. Sọc dọc cả thân nên đặt trên mảng cả thân (hay `around`): sọc theo kinh tuyến, chụm dần lên vai như đường may, nở theo
  sườn áo ở vạt. Lưới hình in cắt ô theo cả từng hàng của mặt cắt nên bám đúng góc bo gấu và bo vai.
- `y` dưới mép trên khối hay quá gấu thì dồn về mép ấy; mép trên, gấu, sườn (chỗ mặt trước gặp mặt sau) và đường nối sau lưng
  của mảng cả thân không có nét viền dù `line > 0`. Chỗ cắt theo viền cổ (`clip`) có nét.
- **Lớp.** Mảng sau trong danh sách nằm trên mảng trước cùng lớp; hoạ tiết trên nền của chính mảng ấy. Nền và hoạ tiết vẽ
  như hình in: không ghi độ sâu, nổi `0.36` px (lớp `over`, mỗi mảng sau thêm `0.03`) hay `0.16` px (lớp `under`) — nét bóng
  dáng hậu kỳ của thân không viền quanh từng sọc. Hình in và thẻ tên nằm trên mọi mảng. Mảng `fill: "skin"` nổi ít nhất
  `1` px như áo trong. Nét, chấm của kiểu (nẹp, cúc) là ống nổi trên mặt khối, luôn thấy trên mảng.
- **Da của người mặc đồ là da thật, không phải hình in.** Ở người `palette.clad`, mảng `fill: "skin"` là lưới kín ghi độ sâu,
  cùng vật liệu với tay chân trần: vai trần liền tay không nét, mép khoét có nét bóng dáng hậu kỳ như mép tay áo, mảng màu và
  hoạ tiết nằm dưới nó bị che. Người que vẫn vẽ nó như hình in.
- Tay áo, cổ bẻ, viền gân, mũ trùm, dải cổ chéo tô màu riêng của chúng, không nhận hoạ tiết: áo sọc tay dài thì tay áo một
  màu (`palette.sleeve`).

#### Khoét: áo ba lỗ, áo hai dây, cổ V sâu

Chỗ khoét là mảng `fill: "skin"` trên [dáng thân chung](#thân-áo-dựng-khối): áo khoét dựng trên `bare` bỏ đặc điểm
(`{ "style": "bare", "marks": false }`), nên thân áo đúng bằng thân trần và bằng áo phông trừ `CLOTH`, vai trần không phồng,
cổ lộ ra như áo phông. Khối thân không bị cắt: mảng da phủ lên nó bằng vật liệu da tay trần (người mặc đồ), mép khoét có nét
hậu kỳ, không cần `line`; người que cần `line` (`0.6`) cho mép sạch. Tay trần là `palette.sleeveLength: 0`.

Khoét thật — thân da dưới một lớp vải thủng — cho cùng hình: vải chỉ dày `CLOTH`, bậc ở mép khoét dưới `2` px, còn vai liền
tay và nét mép khoét thì mảng da đã có. Vì thế không có lớp vải riêng: gốc tay, khối hông, cổ, vạt người ngồi và va chạm
(`collide`, `check`) vẫn đặt theo một khối thân.

Áo ba lỗ — cổ khoét tròn sâu phía trước, nông phía sau, dây vai `x` từ `21` tới `29`, nách khoét sâu, trước và sau như nhau:

```json
"garment": { "style": "bare", "marks": false, "panels": [
  { "fill": "skin", "from": "neck",
    "pts": [[-21, -16], [21, -16], [21, 4], [18, 17], [10, 26], [0, 28], [-10, 26], [-18, 17], [-21, 4]] },
  { "side": "back", "fill": "skin", "from": "neck",
    "pts": [[-21, -16], [21, -16], [21, 3], [14, 10], [0, 12], [-14, 10], [-21, 3]] },
  { "side": "both", "mirror": true, "fill": "skin", "from": "neck",
    "pts": [[29, -16], [90, -16], [90, 50], [44, 44], [34, 34], [30, 16]] }] }
```

Áo hai dây — khoét giữa hai dây xuống ngực, trước và sau như nhau, và khoét ngoài dây xuống nách; dây là khoảng `x` từ `21`
tới `25` còn lại:

```json
"garment": { "style": "bare", "marks": false, "hem": 2, "panels": [
  { "side": "both", "fill": "skin", "from": "neck",
    "pts": [[-21, -16], [21, -16], [21, 22], [10, 30], [0, 32], [-10, 30], [-21, 22]] },
  { "side": "both", "mirror": true, "fill": "skin", "from": "neck",
    "pts": [[25, -16], [90, -16], [90, 50], [38, 42], [28, 22]] }] }
```

Cổ V sâu — viền gân theo chữ V, miệng cổ lộ da:

```json
"garment": { "style": "tshirt", "neckline": "v", "neckFront": 46, "panels": [{ "fill": "skin", "clip": "neck" }] }
```

#### Mẫu

| Áo | `garment` |
|---|---|
| Áo phông sọc ngang | `{ "style": "tshirt", "panels": [{ "pattern": { "color": "#f4efe6", "width": 6, "gap": 7 } }] }` |
| Sơ mi sọc dọc | `{ "style": "shirt", "panels": [{ "pattern": { "color": "#3a6ea8", "width": 3, "gap": 6, "angle": 90 } }] }` |
| Sơ mi kẻ ô | `{ "style": "shirt", "panels": [{ "pattern": { "kind": "check", "color": "#c23b3b", "width": 4, "gap": 9, "cross": "#7a1f1f" } }] }` |
| Phối màu: cầu vai, mảng trước, chấm bi | `{ "style": "tshirt", "panels": [{ "side": "around", "fill": "#e0b23a", "pts": [[-180, 140], [180, 140], [180, 95], [-180, 95]], "line": 0.45 }, { "fill": "#c8663a", "pts": [[-60, 60], [0, 60], [0, -10], [-60, -10]] }, { "pts": [[2, 60], [60, 60], [60, -10], [2, -10]], "pattern": { "kind": "dots", "color": "#ffffff", "width": 4, "gap": 5 } }] }` |

Đồng phục cảnh sát khu vực mùa đông (người mặc đồ `rig.height` `1.1`, áo khoác xanh than ve gập `pieces.torso.color`
`#1E2638`, tay áo, quần cùng màu): sơ mi xanh nhạt liền từ cổ, cà vạt xanh than từ nút cổ tới chỗ cài cúc, thắt lưng quanh
eo có khoá, bao súng bên phải:

```json
"torso": { "src": "sculpt", "color": "#1E2638", "garment": {
  "style": "blazer", "fit": 0.8, "waist": 4, "hem": 10, "neckFront": 90,
  "inner": { "color": "#A9C8E8", "tie": { "color": "#1A2236" } },
  "panels": [
    { "side": "around", "fill": "#0E0E10", "pts": [[-180, 29], [180, 29], [180, 19], [-180, 19]] },
    { "fill": "#C9CCD1", "pts": [[-4, 28], [4, 28], [4, 20], [-4, 20]] },
    { "fill": "#0E0E10", "pts": [[-2, 26], [2, 26], [2, 22], [-2, 22]] },
    { "fill": "#0E0E10", "x": -30, "y": 11, "size": 26, "path": "M22 0 H78 V70 Q78 96 50 98 Q22 96 22 70 Z", "line": 0.4 }
  ] } }
```

## Quần và váy

Người 3D tô quần, tay áo bằng `palette.clad`: `trouserLength` / `sleeveLength` là phần chi phủ màu
tính từ gốc, phần còn lại màu da; quần áo che hông là khối hông cùng màu quần
([01](01-rig.md#người-3d-mặc-đồ)).

### Váy dựng khối

`pieces.hem` với `src: "sculpt"` là váy dựng khối, quay theo thân như
[thân áo dựng khối](#thân-áo-dựng-khối):

```json
"hem": { "src": "sculpt", "color": "#3a4256", "skirt": { "length": 52 } }
```

Khối là hình nón cụt treo ở hông, trong nhóm thân nên nghiêng theo thân. Cạp là tiết diện
ellipse nửa rộng `waist`, sâu `TORSO_DEPTH` lần như khối thân, cao hơn hông `rise`; gấu là
vành cạp nở đều `flare` ra mọi phía — nhìn nghiêng váy xoè gần bằng nhìn thẳng — thấp hơn
cạp `length`. Khối là bao lồi của hai vành ấy cùng hai đùi, nên một bộ số khớp khối thân ở
mọi góc, không có bộ chỉnh theo góc.
Người 3D, người que lẫn người mặc đồ, không đọc `waist`: cạp liền mặt thân áo dựng khối ở độ cao cạp, cả bề
ngang lẫn bề sâu, nhô nửa px, và khối thân áo dừng `1` px dưới cạp, trong váy — thân đi xuống váy không gờ, vạt áo
không lòi qua mặt váy.

| Trường | Mặc định | Nghĩa |
|---|---:|---|
| `rise` | 27 | Cạp cao hơn hông bấy nhiêu px, nhân `rig.height` |
| `waist` | 40 | Nửa rộng cạp; khối `cone` của người 3D cạp theo thân áo |
| `length` | 52 | Gấu thấp hơn cạp bấy nhiêu px khi đùi buông thẳng, nhân `rig.height` |
| `flare` | 12 | Gấu rộng hơn cạp bấy nhiêu px mỗi bên; âm là gấu hẹp hơn cạp |
| `pleats` | 8 | Số nếp chia đều quanh khối; `0` là trơn |
| `style` | `cone` | `cone` là khối mô tả ở đây; `wrap` là [vạt dài quấn](#vạt-dài-quấn), `apron` là [tạp dề](#tạp-dề) — hai kiểu treo ở hông |

- **Gấu rủ theo đùi.** Gọi `α` là trung bình góc hai đùi so với trục thân; gấu thấp hơn
  cạp `length · max(0, cos α)` và xoè `flare · max(0, cos α)`. Vành gấu không hẹp hơn ống đùi ở mút
  phần váy phủ: nửa rộng gấu không dưới `hipHalf` cộng bán kính ống ấy, nửa sâu không dưới bán kính ấy
  (`skirtSpread`), nên `flare` âm không cho chân xuyên ra gấu. Đứng, đi bộ (hai đùi ngược
  dấu) là váy buông đủ; ngồi đùi ngang thì vành gấu co về sát cạp, không rủ xuống ghế. Người 3D
  lấy góc đùi thật so với trục thân, không lấy góc trên khung: người ngồi quay mặt vào ống kính có
  đùi chiếu ra ngắn mà váy vẫn nằm trên lòng.
- **Đùi nằm trong váy.** Mỗi đùi là một ống nửa rộng nửa nét chân cộng `SKIRT_EASE`, từ
  hông dọc đùi tới chỗ gấu buông thẳng chạm (`(length − rise) / cos` góc đùi), không quá
  `length` và không quá tầm vạt `lt · (SKIRT_REACH + (1 − SKIRT_REACH) · min(1, (length − rise) / lt))`
  với `lt` chiều dài đùi đang vẽ (`skirtCover`): đứng thẳng ống luôn tới gấu, váy ngắn ngồi vẫn lộ
  gối, váy tới gối thì phủ tới gối, không bao giờ quá gối. Người 3D mặc đồ có ống thon như đùi, gốc
  `cladThigh`, gối theo `CLAD_TAPER`. Ở mút ống gấu rủ khỏi đùi thêm
  `SKIRT_FALL · max(0, flare) · (1 − max(0, cos α)) · k`, `k` từ `0` khi vạt phủ không quá `SKIRT_REACH`
  đùi lên `1` khi tới gối (`skirtFall`): váy ngắn ngồi nằm trên đùi, không rủ xuống mặt ghế. Sải chân thì váy giãn theo
  đùi trước và đùi sau, chân không xuyên ra hai bên; ngồi thì váy phủ lên lòng tới quá nửa
  đùi.
  Người 3D đứng, đi còn trùm thêm mọi khúc đùi, đầu gối tròn và ống chân cao hơn gấu, cong như chân vẽ
  (`palette.limbCurve`): ngang nở như ống đùi, trước sau cách chân `4,5` px, nên váy ngang gối lúc bước không lộ
  gối qua mặt váy.
  Người 3D ngồi thì lòng váy theo mặt đùi cong như chân vẽ tới tầm phủ, trùm mút tròn gốc đùi chĩa ra sau hông và ống
  chân nằm dưới phần đùi váy phủ: gối gập quá `120°`, đủ ở `150°` (`LAP_FOLD`, quỳ 正座) thì cả khúc ống chân ấy, không
  thì chỉ khúc lấn vào ống váy; vạt phủ quá mút đùi trừ bán kính gối (`lt − r`, đủ ở `lt − r / 2`) thì trùm cả đầu
  gối tròn và đầu ống chân dưới gối. Mặt trên lòng váy và chỗ phủ ống chân cách chân `4,5` px như trước sau lúc đi, mặt
  dưới đùi (trên mặt ghế) giữ như ống đùi. Phần ấy vào dần khi đùi trung bình lệch trục thân từ `30°` tới `60°`
  (`LAP_SEAT`): đứng, đi không đổi, ngồi xuống không nhảy hình.
- **Nếp** là đoạn thẳng trên mặt nón từ `0.3` tới `0.9` quãng cạp–gấu, ở kinh độ giữa hai
  nếp chia đều. Vành gấu co hết (đùi ngang) thì không còn nếp; lòng váy lúc ngồi trơn.
- Cắm được vào vật (`items`), đổi bằng `equip` như mọi `hem`.
- **Tay buông nằm ngoài váy.** Người 3D đứng nghỉ choãi tay thêm tới khi cẳng tay và bàn tay cách hình bao
  váy một `CLAD_GAP` (`roots3`, [01](01-rig.md#người-3d-mặc-đồ)); `flare` lớn là tay xoè như chim cánh cụt.
  `actJoints` đọc cùng váy nên `check` đo đúng khớp vẽ ra.
- `pieces.hem` không phải `src: "sculpt"` thì người 3D không mặc váy dựng khối, kể cả khi còn sót `skirt`.

Dáng hay dùng, `rig.height = 1` (đùi `78`, cạp mặc định `rise` `27`):

| Dáng | `skirt` | Ghi chú |
|---|---|---|
| Chữ A ngắn xếp ly | `{}` | Mặc định: gấu `25` dưới hông, xoè `12` |
| Thẳng ngang gối | `{ "length": 100, "flare": 0, "pleats": 0 }` | Gấu `73` dưới hông, ngay trên gối; `length` `105` là đúng gối |
| Bút chì | `{ "length": 100, "flare": -8, "pleats": 0 }` | Thon từ hông về gấu; người mặc đồ đùi to thì gấu dừng ở bề ngang hai đùi |

Gấu của váy thẳng hay bút chì không hẹp hơn hai đùi, nên với người mặc đồ đùi đầy cả hai đều phình ở
hông rồi thon về gấu theo ống đùi. `flare` âm quá mức ấy không đổi gì thêm.

| Hằng số | Giá trị | Nghĩa |
|---|---:|---|
| `SKIRT_EASE` | 4 | Ống phủ đùi rộng hơn nửa nét chân bấy nhiêu px |
| `SKIRT_REACH` | 0.7 | Vạt váy ngắn phủ dọc đùi không quá bấy nhiêu phần đùi; gấu đứng thẳng càng thấp thì vạt càng tới gần gối |
| `SKIRT_FALL` | 0.5 | Đùi càng ngang, gấu ở mút đùi rủ thêm bấy nhiêu lần `flare`, váy càng gần gối càng rủ đủ |

Không mô phỏng vải: khối váy là **một bao lồi**, nên không có dáng lõm — váy đuôi cá, váy tầng, eo
thắt giữa vạt đều không dựng được; hai chân sải rộng thì váy giãn thành một khối căng giữa hai đùi chứ
không xếp nếp. Lòng váy lúc ngồi ôm theo ống chân gập bên dưới; đùi chĩa lên quá ngang thì váy chỉ còn ôm hông. Váy dài quá gối lúc ngồi chỉ phủ lòng tới gối: phần vải
rủ từ gối xuống không dựng.

### Vạt dài quấn

`skirt.style: "wrap"`: vạt thẳng không nếp từ hông xuống bắp chân hay mắt cá, quấn kín vòng, mép vạt trên chạy dọc
phía trước — phần dưới của kimono, yukata. Khác khối `cone`, vạt **treo ở nhóm hông**, không ở nhóm thân: cạp và phần
thân áo dưới cạp nghiêng theo thân, còn từ hông xuống vạt buông theo hai chân, nên cúi chào `30°`, `45°` vạt vẫn rủ
thẳng, không văng ra sau theo thân.

```json
"hem": { "src": "sculpt", "color": "#2B3A67",
         "skirt": { "style": "wrap", "length": 192, "flare": -4, "pleats": 0, "wrap": { "overlap": 22 } } }
```

Khối là bao lồi của vành cạp (`rise`, liền mặt thân áo như `cone`), các vành thân áo dưới cạp và khối hông (theo thân),
hai ống chân cong đúng như chân người 3D vẽ (`palette.limbCurve`) từ hông tới tầm vạt phủ, và vành gấu nửa rộng
`waist + flare` ở giữa hai mút ống chân. `length` vẫn tính từ cạp: đứng thẳng gấu ở `length − rise` dưới hông; tầm ấy
đo dọc chân (`hemReach`), nên khi bước gấu đi theo hai cổ chân và chân không xuyên ra vạt. `pleats` bị bỏ qua.

| Trường `skirt.wrap` | Mặc định | Nghĩa |
|---|---:|---|
| `overlap` | 22 | Mép vạt trên ở cạp lệch sang bên phải người mặc (`−x` hệ thân) bấy nhiêu px — để bằng `overlap` cổ chéo của thân áo thì mép vạt nối liền mép áo |
| `slant` | 6 | Tới gấu mép lệch thêm bấy nhiêu px về bên phải người mặc |

- **Vạt trái đè vạt phải (右前).** Mép vạt trên luôn ở bên phải người mặc: nhìn chính diện nó nằm bên trái khung. Nét
  mép nằm trên mặt trước của khối, từ cạp tới gấu (`wrapHemEdge`).
- **Ống chân chỉ phủ khi chân buông.** Đùi lệch phương đứng dưới `HEM_HANG[0]` (`35°`) thì vạt phủ đủ tầm, quá
  `HEM_HANG[1]` (`70°`) thì chỉ phủ đùi tới hết đầu gối (`hemHang`): ngồi ghế, quỳ 正座 vạt dừng ở gối, ống chân là ống
  quần — đặt `palette.trouser` cùng màu vải thì đọc như vạt rủ. Không dựng phần vải rủ từ gối xuống lúc ngồi. Vành gấu
  co theo cùng tỉ lệ.
- **Cạp thấp hơn hông** (`rise` âm, cạp giấu dưới áo khoác dài): điểm khối hông và ống chân cao hơn cạp mà còn trong
  thân áo nở `SKIRT_EASE` không vào bao, nên vạt không lên trên cạp nằm sát dưới mặt áo. Ngồi thì phần đùi chĩa ra
  khỏi thân áo vẫn vào bao: vạt phủ lòng. Thân áo dài quá cạp, kể cả áo khoác vạt mở, dừng ở cạp trong vạt như `cone`.
- Tay buông choãi tới khi nằm ngoài vạt đứng thẳng, như `cone` (`skirtSide`, [01](01-rig.md#người-3d-mặc-đồ)).

Dáng hay dùng, người mặc đồ, `rig.height = 1`, `rise` `27`:

| Dáng | `skirt` |
|---|---|
| Kimono tới mắt cá, gấu ôm | `{ "style": "wrap", "length": 192, "flare": -4, "pleats": 0 }` |
| Yukata tới bắp chân | `{ "style": "wrap", "length": 150, "flare": 0, "pleats": 0 }` |

**Đi sải ngắn.** `walk` mặc định sải `28°` làm vạt dài căng thành khối nêm giữa hai cổ chân; người mặc vạt dài đi bằng
`walk-short` của lớp chung, một hành động `walkCycle` sải ngắn, chu kỳ `1` s:

```json
{ "gen": "walkCycle", "duration": 1, "end": "wrap", "authoredAt": "side",
  "params": { "hip": 14, "knee": 40, "stance": 0.65, "arm": 10, "elbow": 18, "lean": 1, "crouch": 0, "dip": 0.5 } }
```

Quãng một chu kỳ đổi theo `hip`, `knee`, `stance` — đo bằng `actionStride` rồi viết `path` theo nó
([01](01-rig.md#chu-kỳ-đi)).

### Tạp dề

`skirt.style: "apron"`: tấm phẳng phía trước từ dây cạp xuống, mặc ngoài quần, dây cạp quanh eo và nơ buộc sau lưng.

```json
"hem": { "src": "sculpt", "color": "#F3EBDD",
         "skirt": { "style": "apron", "length": 100, "apron": { "tieColor": "#D9573B" } } }
```

Mỗi cột của tấm là một đường vải buông từ dây cạp phủ qua mặt người (`drape`): cắt dọc khối gồm thân áo dưới cạp,
khối hông và hai ống chân (như [vạt dài quấn](#vạt-dài-quấn), nở thêm `APRON_LIFT` `5` px), vải đi từ dây cạp vòng
phía trước tới chỗ rời người rồi rủ thẳng. Đứng, cúi chào thì tấm rủ thẳng từ dây cạp trước hai đùi; bước thì gối trước
đẩy tấm ra; ngồi thì tấm nằm trên đùi và dừng ở gối — phần rủ tự do dưới chỗ rời người nhân `hemHang` của góc đùi.
`length` là chiều dài tấm đo dọc vải; mép dưới thẳng khi đứng.

| Trường `skirt.apron` | Mặc định | Nghĩa |
|---|---:|---|
| `width` | 38 | Nửa rộng tấm, không quá nửa rộng cạp |
| `band` | 5 | Dây cạp dày bấy nhiêu px, vòng quanh cạp ở `rise`; `0` là không có |
| `tieColor` | màu tấm | Màu dây cạp và nơ |
| `bow` | 13 | Mỗi cánh nơ sau lưng dài bấy nhiêu px: hai cánh, nút, hai đuôi ngắn chĩa xuống (`apronBow`), khối cứng không rủ; `0` là không nơ |

- Thân áo, khối hông, vạt áo người ngồi dựng như không có váy: thân áo không dừng ở cạp, khối hông màu quần.
- Tay không choãi vì tạp dề.
- `rise`, `waist` như `cone`; `flare`, `pleats` bị bỏ qua.
- Tạp dề và vạt dài quấn cùng socket `hem`: một người không mặc cả hai.
