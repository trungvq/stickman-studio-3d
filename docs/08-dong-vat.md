# 08 — Rig động vật

Động vật bốn chân và động vật hai chân, nhìn ngang. Động vật **không phải nhân vật**: không
có `equip`, không có thư viện tư thế, không có lớp cẳng tay; nét mặt chỉ có **mỏ và mắt**
([Nét mặt](#nét-mặt)). Cũng **không phải đạo cụ**: nó có bộ xương, có bàn chân bám đất,
có dáng đi và có thể bay.

File nằm ở `animals/`, đi qua `AnimalSchema` / `parseAnimal`, `schemaVersion: 6`;
như `actions/`, thư mục này đi hai lớp — bộ mẫu đi theo studio làm lớp dưới,
`animals/` của repo video đè lên ([05](05-repo-video.md#hai-lớp)). Thiếu
`markings` thì lấy lông trơn khi parse. Hành động là file trong `actions/` như của
người: bộ sinh phân biệt bằng **tên**, hành động mốc bằng `actor: "animal"` — xem
[Hành động của động vật](#hành-động-của-động-vật).

Vẽ bằng `<Animal>`. **Chi là nét que như chi người** — động vật không cầm nắm gì nên
chân chỉ hai đoạn, và nhận diện con vật là việc của đầu với thân chứ không phải
của chân. Thân, cổ, đầu, tai, cánh và đuôi mỗi thứ có một **hộp bám bộ xương**: có
ảnh thì dán ảnh vào hộp ấy, không thì vẽ hình code — xem [Socket ảnh](#socket-ảnh).

## Hệ toạ độ và bộ xương

Gốc toạ độ đặt ở **khớp hông** — mút sau đoạn thân. Trục y hướng xuống, theo quy ước
SVG. `<Animal groundY>` là chỗ bàn chân thấp nhất chạm, như `<Character>`.

```
khớp hông     (0, 0)              gốc
gốc chân sau  hông + body × rig.hindAt
khớp vai      hông + body         chân trước treo ở đây
gáy           vai  + neck.len     gốc khối đầu
mõm           gáy  + head.len
gốc đuôi      hông − body.rear × 0.9    mút sau thùng thân
mặt đất       y = rig.hipY
```

`rig.hipY` là **chiều cao đứng** đo ở khớp hông, và cũng là đơn vị của sải chân —
xem [Dáng đi](#dáng-đi).

`saddle` là **chỗ ngồi trên lưng**: `at` dọc trục hông→vai (`0` hông, `1` vai), `dx`
lệch về phía lưng theo bề dày thân, bỏ trống là đúng mép lưng (`body.back`). Ngựa ngồi
quanh `0.55`, voi ngồi sát vai. Scene đặt hông người cưỡi vào đúng điểm này qua
`cast[].mount` — xem [03](03-scene.md#động-vật); hỏi bằng `animalAnchorAt(rt, id,
"saddle", t)`.

### Độ dốc thay cho góc rig

Bốn đoạn dọc thân — thân, cổ, đầu, đuôi — đo bằng **độ dốc so với phương ngang**,
dương là ngẩng lên, chứ không bằng góc rig của chi. Nhìn ngang thì "dốc bao nhiêu
so với mặt đất" là thứ đọc được, còn "lệch bao nhiêu so với phương thẳng đứng"
thì không. `pitchDeg()` trong `animalGeometry.ts` là chỗ duy nhất đổi qua lại.

Dốc đo **so với đoạn cha**, cộng dồn xuống: cổ so với thân, đầu so với cổ, tai so
với đầu. Gằn thân tới trước thì cả cổ, đầu và tai đi theo, không phải trừ tay.

| Đoạn | Trường | Ý nghĩa của số dương |
|---|---|---|
| thân | `rig.pitch` | vai cao hơn hông |
| cổ | `neck.pitch` | cổ ngẩng lên so với trục thân |
| đầu | `head.pitch` | mõm hếch lên so với trục cổ |
| tai | `parts.ear.pitch` | tai vểnh lên so với trục đầu |
| cánh | `parts.wing.pitch` | cánh dựng lên (cánh mọc **ngược** trục thân, như đuôi) |
| chóp cánh | `parts.wing.fold` | chóp gập về phía lưng so với đoạn gốc cánh |
| đuôi | `parts.tail.pitch` | đuôi vểnh lên (đuôi mọc **ngược** trục thân) |

Tư thế (`AnimalPose`) **cộng thêm** vào các dốc nghỉ này: `spine`, `neck`, `head` một số;
`tail` và `wing` hai số `[gốc, ngọn]`; chân là góc tuyệt đối. `composeAnimalPose(base,
...parts)` ghép tư thế một phần lên nền như `composePose` của người.

Đầu ngựa chúi xuống nên `head.pitch` là số âm lớn; vòi voi rủ thẳng đứng nên
`head.pitch` còn âm hơn nữa.

### Chân

**Hai đoạn**: `upper`, `lower`. Đúng như chân người — rig không vẽ bàn chân, và
động vật thì không cầm nắm gì nên không có đoạn thứ ba. Góc theo **đúng quy ước góc
của chi người**: `0°` là chỉ thẳng xuống, dương xoay về `+x`, khớp con đo tương
đối so với khớp cha.

Chi vẽ bằng một **nét que** duy nhất, màu `palette.leg` và dày `palette.legWidth`
cho cả bốn chân — không có viền, không có màu lông, không có móng. Bề dày là một
số cho cả con, như `palette.trouserWidth` của người.

Chân **không đi theo độ dốc thân**, đúng như chân người không đi theo `torso`:
chúng treo ở khớp và với xuống đất, gằn thân tới trước mà chân đi theo là con vật
lún xuống đất.

`knee` chọn khớp giữa gập về đâu. Khớp giữa là **khớp lộ dưới bụng**, không phải
khớp sát thân: khuỷu và đầu gối sau của thú bốn chân chìm trong thùng thân, không
vẽ. Móng guốc: chân trước `forward` (đầu gối trước chìa ra trước), chân sau `back`
(cổ chân sau chìa ra sau) — đó là bóng dáng đặc trưng của ngựa, bò. Voi gập
`forward` cả bốn chân. Chim hai chân gập `back`: chỗ trông như đầu gối ngược ấy
cũng là cổ chân.

`rig.spread` đẩy hai chân **xa** về trước bấy nhiêu, để nhìn ngang vẫn đếm được
bốn chân.

`rig.hindAt` là chỗ treo chân sau dọc trục hông→vai, `0` là khớp hông, `1` là khớp
vai. Thú bốn chân để `0`: chân sau ở mút sau thùng thân. Động vật hai chân đặt quanh
`0.4` — thân của chim nằm cả trước lẫn sau cặp chân, treo ở hông là con vật ngã về
đuôi. Chân trước luôn ở vai.

### Đứng: chân gần thẳng, khớp giữa dưới bụng

Động vật bốn chân đứng **bốn chân gần thẳng**, không có chân nào gập kiểu chữ Z:
độ gập của thú thật chia cho ba khớp, còn rig chỉ có một khớp giữa nên bao nhiêu
gập đều dồn vào đó. Hai hệ quả:

- **`legStretch` quanh `0.93`** cho cả chân trước lẫn chân sau; con chân cột như voi
  tới `0.96`. Thấp hơn `0.85` là con vật ngồi xổm. Phần chưa duỗi là chỗ để chân
  doãng ra khi đi — xem [Dáng đi](#dáng-đi).
- **Khớp giữa nằm dưới bụng**, ở khoảng nửa dưới của chân: `upper` là hông→cổ chân
  hoặc vai→đầu gối trước, dài hơn `lower` một chút ở chân trước và xấp xỉ nhau ở
  chân sau. Kéo `upper` ngắn cho khớp chìm vào thân là vẽ khuỷu thay cho đầu gối,
  con nào cũng thành con chó ngồi.

### Thùng thân

Một khối bám dọc đoạn hông→vai, sáu số:

| Trường | Ý nghĩa |
|---|---|
| `depth` | Bề dày ở giữa thân |
| `back` | Phần bề dày nằm **trên** trục sống; phần còn lại là bụng |
| `rump` / `chest` | Bề dày ở mông và ở ngực, so với giữa thân |
| `rear` / `front` | Thân thò ra sau khớp hông và ra trước khớp vai |

`palette.belly` bật một mảng sáng màu ở nửa dưới; bỏ trống là thân một màu.
`palette.head` tô cổ và khối đầu khác màu thân — lông mã và đầu gà; bỏ trống là
cùng màu lông.

### Đầu và bộ phận code

Đầu `blunt` có vòm trán và má tròn, mắt nằm về mép trước. Tai `fan` xoè về phía
gáy, mép dưới có thuỳ rủ. Vòi treo ở mép trước mõm, thuôn dần và cuộn chóp về phía
gáy; ngà là hai mảnh cong chìa về phía trước, ngà xa nằm sau vòi và khối đầu,
ngà gần nằm phía trước. Đầu `beak` là sọ tròn đường kính `head.depth`, tâm lùi về gáy vừa đủ
để phủ trọn chân cổ rộng `neck.tip` nên góc cổ không ló ra dù đầu hếch bao nhiêu; mỏ hai
mũi nhọn màu `horn` chung khớp ở mép trước sọ, chìa tới mõm (`head.len` phải dài hơn
`depth`), mỏ dưới há theo `mouth`; mào ba múi tròn bám vòm sọ cùng màu `crest`, và yếm —
giọt rủ dưới cằm — **chỉ đi cùng mào `comb`**: `crest.len: 0` là không mào không yếm.
Bờm `parts.mane.kind: "ridge"` chạy dọc sống cổ, `len` là bề cao; kiểu `ruff`
bao quanh đầu, `len` nới ra theo bề dày đầu và `width` nới theo chiều gáy→mõm.
Bờm `ruff` bám trục đầu, nằm trên thân và chân gần nhưng dưới hai tai và khối đầu;
`color` lấy màu bờm, `len: 0` tắt cả hai kiểu. Mặc định là `ridge`.

Đầu `tapered` có trán tròn, mõm thuôn dài về chóp mũi đen và hàm dưới gọn;
`head.len` đo từ gáy tới mũi, `head.depth` là bề dày sọ. Mảng mõm lấy màu
`palette.belly`, mắt nằm trên má phía sau gốc mõm — chó, cáo.

Đầu `round` có sọ bầu, mõm ngắn sáng màu theo `palette.belly`, mũi và miệng đen;
phối với tai `round` để dựng mèo hoặc hổ. Tai `round` có vành tròn và lòng tai màu
`palette.belly` (không khai thì lấy màu nét). Đuôi `smooth` là nét cong đều bề dày
`width`, không có túm lông, đi theo hai đoạn xương đuôi.

`markings.kind: "stripes"` bật vằn thuôn trên thân, cổ, đầu và khoang ngang trên
đuôi `smooth`; màu là `markings.color`. Vằn cắt theo bóng từng bộ phận, bám cùng
phép biến hình của bộ phận đó và chỉ vẽ trên hình code. Mặc định `kind: "none"`
là lông trơn. Các kiểu đầu, tai, đuôi và vằn chọn độc lập với tên con vật.

Đuôi `tuft` là một khối lông liền từ gốc tới chóp, thuôn hai đầu và uốn theo hai
đoạn xương đuôi; `len` là toàn bộ chiều dài, `width` điều chỉnh bề rộng khối lông.
Đuôi `rope` có cuống mảnh và chóp hình lá; đuôi `fan` không có cuống: năm lông liềm
chung một gốc ở mút mông, lông trên cùng dài nhất, mỗi lông là một cung gập 100°
về phía sau nên dựng `pitch` gần thẳng đứng thì lông vươn lên rồi cụp ra sau — gà
trống. Kích thước theo `head` và `parts`, màu theo `partColor`; không chọn hình
theo tên con vật.

Mào `parts.crest.kind` chọn `comb` (múi tròn, có yếm) hoặc `plume` (ba lông
vuốt dài về gáy, không yếm). `len` đo chiều dài lông, `width` là bề ngang gốc mào.
Đuôi `ribbon` gồm năm dải lông thuôn, uốn theo cả hai đoạn xương đuôi;
`width` điều chỉnh độ xoè, `accent` tùy chọn tô dải màu dọc lông.
Cánh có `accent` tùy chọn tô mảng lông phụ trên chóp, cắt theo viền chóp.
Các trường màu này chỉ áp dụng hình code. Kiểu mào, đuôi và màu bộ phận chỉnh
trong cột Động vật của studio.

### Cánh

Cánh là **bộ phận hai đoạn treo trên thùng thân**: đoạn gốc từ vai tới khớp giữa
(`WING_ELBOW = 0.45` của `len`), chóp thuôn ra ngọn, mép sau chia lông. Viền cánh
là biên ngoài của hai đoạn chồng nhau tại khớp. Tô cả hai đoạn sau khi viền để
che nét nằm trong phần chồng; nét trong mỗi đoạn không nối xuyên qua khớp.
Mọc ở `at` dọc
trục hông→vai, lệch `dx` về phía lưng (theo bề dày thân), xoè **ngược trục thân** về phía
mông như đuôi; `pitch` dựng cả cánh lên, `fold` gập chóp về phía lưng. Kênh tư thế `wing:
[gốc, chóp]` cộng thêm vào hai số ấy — vỗ cánh là `wing[0]` dao động, đưa cánh ra trước
mặt là dốc thêm gần `200°` vì cánh mọc ngược. `len: 0` là không có cánh. Vẽ **cả hai
bên**: cánh gần đè lên thân, cánh xa nằm sau thân và dựng cao hơn `14°` để thò ra khỏi
lưng. Mốc `wingTip` là chóp cánh gần — đạo cụ neo vào đó khi con vật đưa đồ
([03](03-scene.md#động-vật)).

Gà, chim có cánh; ngựa gắn cánh là ngựa có cánh — cánh và số chân là hai trục
độc lập, không có "họ chim" riêng. Bay là một bộ sinh: xem [Bay](#bay).

**Thứ tự vẽ của con bốn chân, từ sau ra trước:** chân xa, đuôi, cánh xa, cổ, thân, bờm, **chân
gần**, khối đầu cùng hai tai, cánh gần. Chân cổ chìm dưới thùng thân, còn khối đầu
thì nổi lên trên: voi cổ ngắn có đầu nằm ngay trước ngực — vẽ thân sau đầu là mất
luôn cái đầu. Hệ quả: thấy một góc cổ nhô ra khỏi lưng thì kéo `body.front` cho
tới khi thân trùm hết chân cổ. Chân gần của con bốn chân nổi trên thân nhưng chìm
dưới đầu và cánh gần: tai voi rủ
xuống đè lên chân trước. Con hai chân đứng thì vẽ cả hai chân dưới thân, để gốc chân chìm
trong bụng ngay cả khi cánh nâng lên; đang bay thì chân gần lên trên thân
(`<Animal legLayer="over">`, `animalAt` trả sẵn) — chân xếp nằm gọn trong bóng thân,
vẽ dưới là con vật đọc ra không có chân.

## Nét mặt

`<Animal mouth eyes>` nhận **cùng bộ tên với người** (`MouthKind`, `EyeKind`), không có lông
mày; `AnimalFace` là `{ mouth, eyes }`, mặc định `DEFAULT_ANIMAL_FACE` là ngậm, mở. Mắt vẽ
trên mọi kiểu đầu theo `head.eye`: `open` chấm, `shut` vạch dọc trục đầu, `wide` có lòng
trắng, `squint` nửa phía cằm, `happy` cung vồng lên đỉnh đầu, `squeezed` nhắm chặt
dạng nét gấp, `droopy` có mi rũ, `wink` khép cong con mắt nhìn thấy trong góc nghiêng.
**Mỏ chỉ đầu `beak` vẽ**; mỗi tên miệng là một độ há của mỏ dưới quanh khớp mỏ — `closed 0°`, `talkTeeth 4°`, `talkA 10°`, `talkB 24°`,
`o 14°`, `wide 34°`, miệng mím `pursed`, `puffed`, `meh` khép `0°`, các tên còn lại ở giữa — nên hành động nhép miệng của người
(`mouth.json`) đặt lên chim là chim nói. Đầu khác `beak` bỏ qua `mouth`. Ảnh `pieces.head`
thay trọn khối đầu nên cũng thay luôn mỏ và mắt: mặt cử động chỉ có với đầu vẽ code.

## Dáng đi

**Dáng đi dựng từ đường đi của bàn chân, không phải từ góc khớp.** Nửa chu kỳ
đạp thì bàn chân nằm yên trên mặt đất và lùi đều so với khớp gốc; nửa vung thì
nhấc lên và đưa tới trước. Góc hai đoạn suy ngược bằng IK (`ik2`).

Nhờ vậy chân **không trượt**, và `bakeFeetTravel` tích ra đúng `sải / nhịp đạp`
mỗi chu kỳ — cùng một hàm nướng trôi ngang mà người hai chân đang dùng, chỉ khác
số bàn chân.

| Tham số | Ý nghĩa |
|---|---|
| `stride` | Sải chân — quãng một bàn chân lùi trong nửa đạp, **tính theo `rig.hipY`** |
| `lift` | Nhấc chân, cũng theo `rig.hipY` |
| `duty` | Phần chu kỳ mà bàn chân chạm đất |
| `bob` | Thân nhún lên xuống, theo `rig.hipY` |
| `sway` | Thân chồm trước/sau, độ |
| `nod` | Cổ gật theo nhịp, độ |
| `swish` | Đuôi ve vẩy, độ |

Sải chân và nhấc chân đo theo chiều cao hông nên **một file dùng chung cho ngựa
lẫn voi**; con nào chân ngắn thì tự bước ngắn hơn.

**Hông đi như con lắc ngược.** Chiều cao hông mỗi khung là chỗ xa nhất mà **mọi**
chân còn với tới với bàn chân ở vị trí hiện tại: chân chịu lực dựng thẳng giữa nhịp
đạp thì thân nhổm lên, chân doãng ra hai đầu nhịp thì thân hạ về `rig.hipY`. Không
chân nào phải gập để giữ hông ở một độ cao cố định — giữ cố định là kiểu đi khom,
con vật trông như ngồi xổm suốt chu kỳ.

`bob` cộng thêm vào đó, là độ nhún của **thân so với bàn chân đang chạm đất**:
bàn chân vẫn đứng nguyên chỗ, chỉ thân hạ xuống. Nó không phải cái tham số bob bị
cấm ở [00](00-bat-bien.md) — cái bị cấm là dịch `root` mà bàn chân đứng yên, ở đây
ngược lại, `root` vẫn suy ra từ bàn chân thấp nhất.

Hai bộ sinh, cả hai đều là **bốn nhịp**, không có dáng đứng nào giữa chừng:

| `gen` | Thứ tự chạm đất | Đọc ra |
|---|---|---|
| `animalWalk` | sau-gần, trước-gần, sau-xa, trước-xa, mỗi nhịp cách nhau ¼ chu kỳ | Đi bộ |
| `animalRun` | sau-xa, rồi cặp chéo, rồi trước-gần | Phi nước kiệu |

Động vật hai chân thì cả hai bộ sinh đều là hai nhịp so le nửa chu kỳ.

### Hai chỗ bị kẹp, và vì sao

**Sải chân kẹp theo `maxStride(b)` của chính con vật.** Hành động không biết ai
diễn, còn với được tới đâu thì thuộc con vật — đúng chỗ mà nhân vật để giới hạn
khớp. Vượt qua là IK duỗi hết cỡ, bàn chân không tới được chỗ phải tới, và mỗi
chân trượt một kiểu. Sải bị kẹp bao nhiêu thì `lift` co lại bấy nhiêu: con chân
cột bước ngắn mà nhấc cao là giậm chân tại chỗ.

**Nhịp đạp kẹp xuống không thấp hơn quãng hở lớn nhất giữa hai lần chạm đất.**
Dáng đi ở đây **không có pha bay**: `<Animal>` dựng chỗ đứng từ bàn chân thấp
nhất, không chân nào chạm đất thì không có gì đỡ con vật lên, và `bakeFeetTravel`
giữ đà bằng chính cái chân vừa nhấc — tức là kéo lùi.

### `animalProblems` là chỗ kêu

Chân với không tới đất, hoặc *vừa đủ* tới đất, đều không nổ ở đâu cả — hình chỉ
sai. `legStretch(b, front)` trả phần chiều dài chân đã dùng hết khi đứng yên,
`maxStride(b)` trả sải chân lớn nhất còn với tới. Cột Động vật của studio in cả hai và
danh sách của `animalProblems`.

`animalProblems` kêu khi chân **với không tới đất**, và khi sải chân còn lại
**dưới `0.25`** — lúc ấy dáng đi thành giậm chân tại chỗ. Chữa bằng cách kéo dài
`upper`/`lower` hoặc hạ `hipY`; con vật vẫn cao ngần ấy, chỉ là chân gập nhiều
hơn khi đứng. Con chân cột như voi thì sải ngắn là **đúng**, không phải lỗi.

## Bay

`animalFly` là bộ sinh **trên không** (`airborne`), nhận hình dáng con vật để đặt thân
nằm ngang và cánh vỗ quanh dốc `raise` với biên độ `flap`, độc lập với góc nghỉ.
Chu kỳ bắt đầu ở cánh cao nhất: đập xuống chiếm `0.42` chu kỳ, thu lên chiếm `0.58`;
chóp trễ theo `lag` và gập thêm lúc thu lên. `flap: 0` giữ cánh lượn khi `lag: 0`.
Chân xếp ra sau `tuck` và khớp dưới gập `curl` so với đoạn trên (mặc định `−80°` và
`60°`): bàn chân thu về sát bụng nhưng vẫn **chìa ra khỏi bóng thân** phía mông, và
chân gần vẽ trên thân, nên nhìn ngang vẫn thấy cặp chân co. Gập hết cỡ (`curl` quanh
`−2.5 × tuck`) là bàn chân lọt hẳn vào trong bụng và con vật mất chân. Thân chồm `sway`, cổ hạ `0.65` góc nghỉ và đầu bù góc
để giữ hướng nhìn; đuôi vẫy `swish`. Không bàn chân nào chạm đất. `actionAirborne(a)` là `airborne` của file,
không có thì của bộ sinh; hành động mốc khai `airborne: true` khi tự dựng dáng lượn.

Trên không thì **gốc là khớp hông** (`root: "hip"`), chân gần vẽ trên thân, không có bóng,
và chỗ đứng hạ đúng `rig.hipY` để hông cao ngang lúc đứng — cất cánh tại chỗ không nhảy, bay lên là `path.y`
của scene. Trôi ngang **không nướng**: `bakeFeetTravel` gặp lúc không bàn chân nào là đứng
yên chứ không giữ đà, và `speed` trên clip bay là lỗi lúc nạp vì không có sải chân để
chia. Người cưỡi treo theo yên như thường — [03](03-scene.md#động-vật).

`animalIdle` là dáng đứng thở: thân phập phồng, cổ gật, đuôi và cánh nhích; bàn chân dựng
lại bằng IK nên đứng nguyên chỗ. Chim đậu là con chim đứng — không có dáng riêng.

## Hành động của động vật

Cùng `ActionSchema`, cùng thư mục `actions/`, cùng `stickman check`. Ai diễn được suy
bằng `actionKind(a)`: có `gen` thì theo **tên bộ sinh** (`ANIMAL_GENERATORS`: `animalWalk`,
`animalRun`, `animalFly`, `animalIdle`) — một cái tên chỉ nằm trong đúng một bảng; có
`keys` thì theo `actor`, bỏ trống là của người. `actor` đi cùng `gen` là lỗi: hai nguồn
cho một chuyện.

Hành động mốc của động vật ghi góc theo `ANIMAL_JOINT_CHANNELS` (`spine`, `neck`, `head`,
`tail`, `wing`, `legFrontNear`, `legFrontFar`, `legHindNear`, `legHindFar`) cộng kênh `face`
(`keys[].face.mouth` / `.eyes`); `mask` gọi tên bộ kênh ấy, bỏ trống thì suy từ mốc. Mốc
không gọi được tên pose người, không có `layer`, không có `equip`. `keys[].pose` dùng
chung một ô với mốc người: hai schema `strictObject`, khoá lạ rơi sang schema kia chứ
không bị bỏ lặng.

`animalActionPose(a, t, b)` trả **tư thế một phần** trong mặt nạ — bộ sinh nhận cả con vật
vì sải chân kẹp theo chân nó — ghép lên `animalStand(b)` (hay track dưới) bằng
`composeAnimalPose`; `animalActionFace(a, t)` trả mỏ và mắt. Chiều ngược lại im lặng mà
đúng: `actionMask` và `actionDelta` của hành động động vật trả rỗng, nạp nhầm vào
`<Character>` là nhân vật đứng yên chứ không nổ; hành động của người nạp vào `<Animal>`
thì `animalActionPose` trả `null`. Studio lọc sẵn hai danh sách.

```json
{ "schemaVersion": 10, "name": "animal-walk", "duration": 0.96, "end": "wrap",
  "gen": "animalWalk",
  "params": { "stride": 0.7, "lift": 0.2, "duty": 0.62,
              "bob": 0.03, "sway": 1.5, "nod": 4, "swish": 5 } }
```

```json
{ "schemaVersion": 10, "name": "animal-talk", "duration": 0.32, "end": "wrap",
  "actor": "animal", "mask": ["head", "face"],
  "keys": [{ "t": 0,   "pose": { "head": 5 },  "face": { "mouth": "talkA" } },
           { "t": 0.5, "pose": { "head": -3 }, "face": { "mouth": "talkB" } }] }
```

## Socket ảnh

Sáu socket, mỗi cái một hộp bám bộ xương: `body`, `neck`, `head`, `ear`, `wing`,
`tail`.
Ảnh để ở `pieces/animalBody/`, `pieces/animalNeck/`, … theo `animalPieceDir` — tiền
tố `animal` là để không đụng tên socket của nhân vật (`neck`, `head` đã có chủ).

**Hộp lấy nguyên từ bộ xương**: dài theo đoạn, rộng theo bề dày đã khai. Vì thế
socket động vật **không có `aspect`** — bề ngang là tham số hình dáng thật
(`body.depth`, `head.depth`, `neck.base`…), không suy ra từ tỉ lệ tấm ảnh. Ảnh dán
vào bị kéo cho vừa hộp; muốn khung khác thì kéo chính mấy số ấy, cộng `widthScale`.
Đây là chỗ **khác hẳn mảnh nhân vật**, đừng chép luật của bên kia sang.

| Socket | Hộp | Hệ toạ độ |
|---|---|---|
| `body` | `rear + rig.body + front` × `body.depth` | trục sống, `+y` từ mông ra ngực |
| `neck` | `neck.len` × `max(base, tip)` | trục cổ, `+y` từ vai lên gáy |
| `head` | `head.len` × `head.depth` | trục đầu, `+y` từ gáy ra mõm |
| `ear` | `ear.len` × `ear.width` | trục tai |
| `wing` | `wing.len` × `wing.width` | trục cánh, `+y` từ gốc ra chóp; cùng một ảnh cho hai bên |
| `tail` | `tail.len` × `tail.width` | trục đuôi, **không gập** ở khớp giữa |

Ảnh `wing` dán cả cánh làm **một khối cứng** đi theo đoạn gốc: vỗ được, không gập chóp.

`dx`/`dy` dời hộp, `scale` phóng cả hai chiều, `widthScale` nhân thêm bề ngang,
`rotate` xoay quanh tâm hộp (chiều rig, ngược dấu `rotate()` của SVG). `color`
nhân vào ảnh mực đen trắng bằng `feColorMatrix`, đúng luật của
[02](02-trang-phuc.md) — bỏ trống thì để nguyên ảnh.

**Socket có ảnh thì hình code của đúng bộ phận ấy không vẽ nữa**, các bộ phận
khác giữ nguyên. Bộ phận nào đã vẽ sẵn trong ảnh (cánh nằm trên thân, đuôi dính
vào thân) thì đặt `len: 0` cho bản code — nó không cử động được nữa, đổi lại
không có mối ghép nào phải căn.

**Gen chung, cắt ở khớp.** Cổ và đầu gen trong một hình, thân và đuôi gen trong
một hình, rồi cắt theo socket: mảnh đầu lấy thêm một đoạn cổ dưới gáy với mép
dưới mờ dần, mảnh cổ lấy từ trên gáy một chút xuống tới chân cổ. Hai mảnh chồng
lên nhau đúng pixel ở tư thế nghỉ, đầu vẽ trên nên che phần chờm; `nod` chỉ
xoay đầu vài độ so với cổ, mép mờ nuốt độ lệch ấy. Chân cổ kéo dài quá vai để
chìm sau ngực. Ghép hai mảnh gen rời nhau thì nét và cỡ không cùng tay vẽ, không
căn nào khớp được. Riêng ảnh `head` thay trọn khối đầu code, gồm cả mỏ, mắt, vòi,
ngà, sừng và mào; vì vậy ảnh phải tự vẽ mọi chi tiết đầu cần có. Ảnh động vật nhiều
màu phải bỏ trống `color` để giữ nguyên màu gốc.

**Chi tiết ngang người que.** Con vật đứng cạnh một hình que hai tông, nên mỗi mảnh
chỉ vài tông phẳng, không nét trong ruột, không bóng, không lông vẽ từng sợi; bóng
ngoài mượt, chỉ vài mấu to (mào ba múi, đuôi vài lông); viền dày bằng nét rig **sau
khi** ảnh đã co vào hộp, nên vẽ dày hơn khi ảnh lớn hơn hộp. Mắt là một chấm mực.

## Bộ mẫu

Lớp chung có tám con, đủ cả hai dạng xương và cả năm kiểu đầu; repo video thấy
chúng qua `list` của MCP và studio mà không chép file:


| | |
|---|---|
| `dog` | Bốn chân que, thân nâu vàng bụng kem, đầu `tapered` mõm nhọn, tai `floppy` nâu sẫm, đuôi `smooth` vểnh; không bờm, không vằn |
| `horse` | Bốn chân que, thân nâu, đầu `muzzle`, tai `perk`, bờm dọc cổ và đuôi `tuft`, toàn bộ vẽ bằng code |
| `elephant` | Bốn chân que, thân xám; đầu `blunt`, tai `fan`, vòi cuộn vào trong, hai ngà trắng và đuôi `rope`, toàn bộ vẽ bằng code |
| `lion` | Cùng form thân và chân với hổ, lông vàng nâu, bụng kem, không vằn; đầu và tai `round`, bờm `ruff` nâu, đuôi `rope` có túm lông nâu |
| `tiger` | Bốn chân que, thân cam bụng kem, vằn đen; đầu `round`, tai `round`, đuôi `smooth`, toàn bộ vẽ bằng code |
| `chicken` | Hai chân, đầu `beak` với mào, mỏ, yếm; cổ và đầu tô `palette.head`, đuôi `fan`, cánh nâu gập ôm sườn — toàn bộ vẽ bằng code |
| `bird` | Chim xanh hai chân, đầu `beak` không mào, cánh dài, đuôi `fan` ngắn; con để bay, đậu, nói và cho người cưỡi khi `scale` lớn |
| `phoenix` | Phượng hoàng đỏ–vàng, mào `plume`, cánh hai màu, đuôi `ribbon` năm dải dài; toàn bộ vẽ bằng code, mỏ và cánh cử động được |

Hành động mẫu của động vật: `animal-walk`, `animal-run`, `animal-fly`, `animal-idle`,
`animal-call` (bộ sinh) và `animal-talk`, `animal-point`, `animal-give`, `animal-shock`,
`animal-look-down`, `animal-peer`, `animal-peck`, `animal-peck-low`, `animal-crouch`,
`animal-tuck-legs`, cùng hai nét mặt `animal-gasp`, `animal-unbothered` (mốc). `animal-give` đưa cánh theo cung thấp: gốc quay theo chiều âm, chóp gập khi
quét xuống và chỉ mở khi cánh đã ở trước ngực. Đạo cụ bám `wingTip` theo cùng
đường này; tư thế cuối giữ nguyên để trao đồ. `animal-shock` là giật mình: cổ vống
lên, mỏ há `wide` rồi về `o`, mắt `wide`, cánh bung rồi hạ và giữ — chỉ ghi `neck`,
`head`, `wing`, `tail` và `face` nên chân là của track dưới, con không cánh vẫn diễn
được bằng cổ và đuôi.

Dựng con mới thì ghép bộ phận: `head.kind` × `ear.kind` × `crest.kind` × `tail.kind`,
cộng `horn` / `tusk` / `trunk` / `crest` / `mane` — đặt `len` về `0` là bỏ bộ phận ấy
đi. Mỗi bộ phận có `color` riêng, bỏ trống thì lấy màu chung của loại
(`partColor`).

## Trên sân khấu

Đặt vào cảnh ở `scene.animals[]` với một chồng `tracks[]` như người — bay ở track dưới,
nói ở track trên; người cưỡi là `cast[].mount`, người xách là `cast[].carry[]` — cả hai
thuộc người, con vật chỉ cần có `saddle`. Chim chở người phải to chừng **2,3 lần
`scale` của người cưỡi** mới đọc ra là chở được; dưới ngưỡng ấy nhìn ra người cưỡi con
gà. Khi nền đã kịch khung, lấy tỉ lệ từ phía thu nhỏ người chứ đừng phóng con chim; đạo cụ trong cánh là `props[].follow` +
`anchor: "wingTip"`. Chi tiết ở [03 — Động vật](03-scene.md#động-vật). Studio không đọc
scene; soi bằng dải ảnh và khung thật của `stickman-render`.

## Chỗ chưa dựng

- **Không có mảnh đeo cho con vật**: yên, cương, hàng thồ chưa có socket. Người cưỡi
  ngồi thẳng lên lưng.
- **Dáng đi không có pha bay**, xem [Hai chỗ bị kẹp](#hai-chỗ-bị-kẹp-và-vì-sao): phi nước
  đại bốn chân rời đất là chuyện khác với [bay](#bay).
