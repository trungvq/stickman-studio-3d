# 00 — Bất biến, đừng phá

Những chỗ mà làm sai thì **không có gì báo** — không lỗi biên dịch, không lỗi
zod, hình chỉ sai hoặc thiếu. Đọc mục của vùng mình sắp đụng trước khi sửa; mỗi
mục trỏ tiếp tới file spec đầy đủ.

## Dấu góc và hình học

**Quy ước góc**: `0°` = đoạn chỉ thẳng xuống, dương = xoay về `+x`, khớp con
(khuỷu, gối) đo **tương đối** so với khớp cha. Lật hướng là `scaleX(-1)` trên
nhóm gốc — không đổi dấu góc.

**Quy ước góc ngược dấu với `rotate()` của SVG.** Mảnh ảnh nằm dọc một đoạn ở góc
`θ` phải là `rotate(−θ)`. Sai dấu chỗ này không lộ ra ở chu kỳ đi (góc nhỏ), chỉ
lộ ở pose góc lớn — kiểm bằng `shrug`, đừng kiểm bằng `walk`.

**Dấu góc tay đọc theo vị trí vai**: vai gần ở `−x`, vai xa ở `+x`. Hai tay xoè
đối xứng thì **gần âm, xa dương**. Để tay xa âm là cánh tay trên chui ra sau
thân áo và biến mất — thân áo vẽ đè lên nó.

**Tay giơ quá ngang thì khuỷu cùng dấu vai.** Dấu vai là chiều cánh tay quét lên
(vì thế slider vai chạy tới `±270°`), và khuỷu gập tiếp theo chiều ấy: cẳng tay
cuộn về phía đầu. `|vai| > 120` mà khuỷu ngược dấu là cẳng tay quay ngược lại,
khuỷu gập ra ngoài — `armFoldProblems` kêu ở `check`, `validate` và bảng hành
động của studio. Cùng một bàn tay trên đỉnh đầu, `[195, −25]` gập ngược còn
`[171, 25]` thì không.

**`palette.limbCurve` chỉ làm tròn khuỷu và gối.** Điểm hai đầu và tiếp tuyến ở
hai đầu của nét chi y hệt đoạn thẳng, nên mảnh vai áo và đồ cầm tay — hai thứ
treo vào khớp — không cần biết tới độ cong; đừng bù trừ gì cho chúng. Vẽ một nửa
chi thì phải đưa **đủ ba khớp** kèm `seg`: cắt bằng `pts.slice(…)` rồi vẽ hai
nửa riêng là mất tiếp tuyến chung ở khuỷu, đường cong gãy góc đúng chỗ nối. Mặc
định `1`; hạ về `0` thì chi trở lại hai đoạn thẳng. Xem
[01](01-rig.md#vẽ-chi).

**`stretch` là một kênh riêng, không phải số trong tuple tay.** Số thứ tư của
`armNear` / `armFar` là góc dang của người 3D, không phải hệ số; hệ số dài chi nằm ở
`pose.stretch`: bốn số `[tay xa, tay gần, chân xa, chân gần]`, mỗi số nhân **cả
hai đoạn** của chi ấy, hoặc tám số từng đoạn, hai số một chi, đoạn gốc trước;
mặc định `1`. Bên trong rig (`Pose.stretch`, `F.stretch`) luôn là tám số —
`stretchSegs` trải, `stretchJson` gọn lại — nên đọc theo chỉ số của dạng bốn số là
lấy nhầm đoạn. Hệ số của một chi chỉ ăn khi hành động cũng ghi chính chi ấy; hành
động chỉ ghi `stretch` thì phủ cả bốn chi. Bốn chỗ sai im lặng: tính vị trí bàn
tay bằng lượng giác mà không nhân hệ số của từng đoạn vào đúng đoạn ấy; ghi hệ số
chân trong hành động có ghi tay mà không ghi chân thì hệ số chân bị bỏ, chân giữ hệ
số của lớp dưới; `mask` khai tường minh mà thiếu `stretch` thì mốc có vươn cũng bị
vứt (`maskProblems` kêu); và kéo dài chi của nhân vật đã hạ `palette.limbCurve` về
`0` thì đoạn thẳng dài ra đọc thành sai tỉ lệ chứ không thành tay vươn. Xem
[01](01-rig.md#vươn-chi).

**`Chiều cao` chỉ kéo dọc.** `rig.height` nhân vào sáu đoạn cổ/thân/tay/chân — của
người 3D cũng vậy (`bones3`), vì hông 3D lấy từ `world.hip` đặt theo chân đã nhân — và
vào `boxH` của mảnh ảnh; bề ngang thân, bề ngang hộp ảnh, độ dày nét và đầu giữ
nguyên. Nhân cả vào bề ngang là mỗi lần chỉnh cao lại phải căn lại thân áo.

**Góc nhìn là năm nấc rời rạc, không xoay liên tục.** Thân chọn `front` / `quarter` /
`side` / `rear` / `back` ở `view`, đầu chọn riêng ở `headView` (bỏ trống là theo thân); đổi
góc gọn trong một frame, còn hướng trái/phải vẫn là `flip` (`scaleX(-1)`). Thân áo
và tóc là **hình vẽ riêng cho từng nấc** (`garmentViews.ts`, `hairstyles.ts`), một
tham số xoay chỉ bóp méo hình chính diện chứ không đổi được góc nhìn. Riêng tóc, kính
và thân áo dựng khối (`src: "sculpt"`) không có hình theo nấc: chúng chiếu từ khối theo
góc của nấc. Thân `rear` (3/4 sau) chỉ có ở thân áo dựng khối; thân ảnh hay bộ phận
`PARTS` thì `clampViews` đổi nó thành `back`. Rồi kẹp tổ hợp không vẽ được: thân quay
lưng (`rear`, `back`) với đầu `front` / `quarter` thành đầu cùng nấc thân, đầu `back` /
`rear` trên thân không quay lưng thành `side`. Chưa biết nhân vật (`sceneAt`, studio) thì
`clampViews` giữ thân `rear`; `figureAnchors` kẹp lần cuối theo thân áo của nhân vật đã
`equip` — góc thật sự vẽ ra nằm ở `A.views`. Xem [01](01-rig.md#góc-nhìn).

**`quarter` là mặc định, `front` là chính diện thật.** Mặt `quarter` lệch theo
`face.turn`; mặt `front` bỏ `face.turn`, chỉ còn `lắc` của hành động. Mảnh vẽ tay ở cả hai
nấc vẽ cùng hình chính diện lệch tâm, nên `front` với áo, tóc, mũ vẽ tay là mặt thẳng mà
mảnh vẫn lệch — không có gì báo. Scene đời cũ ghi `"front"` là `quarter` bây giờ;
`migrateScene` đổi hộ khi đọc, nhưng JSON viết tay không khai `schemaVersion` cũng bị coi
là đời cũ, nên muốn chính diện thật thì khai `schemaVersion` hiện hành.

**Hình `side` / `rear` / `back` vẽ trong khung `VIEW_FRAME` và mặt nhìn về `+x`**, `d` chỉ
dùng lệnh **tuyệt đối** `M L C Q Z` đi theo cặp `x y` — `fitPath` nhân xen kẽ hai
trục nên `H`, `V` hay cung `A` hỏng âm thầm. **Thêm một mảnh áo chính diện mới
thì phải khai nó vào bảng `*_OF`**: không có khoá thì `side` lặng lẽ lùi về hình
chính diện (thân áo bóp ngang `SIDE_TORSO`) và `back` lùi về hình bao, không gì
báo. Kiểu tóc không qua bảng nào — mục `HAIRSTYLES` mang sẵn cả bốn góc; góc nào
để trống thì lùi về chỏm rig dựng. Mảnh ảnh PNG không bao giờ có hình góc nhìn —
nó không có tên bộ phận để tra bảng. Xem [02](02-trang-phuc.md#góc-nhìn).

**Hình `side` / `rear` / `back` có bộ chỉnh riêng ở `pieces.<socket>.views`.** `dx` …
`rotate` của mảnh chỉ áp cho hình chính diện (và cho mảnh lùi về hình chính
diện); sửa chúng để căn hình `side` là sửa một số không ai đọc. Mảnh treo trên thân
(tay áo, `neck`, `hem`) ở thân `rear` lấy hình và bộ chỉnh của `back` (`bodyArtView`), nên
`views.rear` của chúng cũng không ai đọc; váy dựng khối không đọc bộ chỉnh nào. Hỏi `tuneOf` / `viewTuned`, studio ghi qua
`wornTune`. Xem
[01](01-rig.md#bộ-chỉnh-theo-góc).

**Kiểu tóc là một mục cắm ở `hair`; `pieces.hairBack` khi ấy bị bỏ qua hẳn.**
Lớp `under` (tóc chính diện sau thân) nằm ở slot `hairBack` nhưng dùng **màu và
bộ chỉnh của `pieces.hair`**, trôi theo `head.followBack`, và mang
`data-piece="hair"`; chỉnh `pieces.hairBack` cho nó là sửa một số không ai đọc.
Mọi góc, kể cả chính diện, đặt theo hộp sọ (`skullBox`: phóng quanh tâm sọ, không
quanh mép trên), nên bộ chỉnh mặc định của kiểu tóc là trung tính — số căn đã
nướng vào path. Ở `side` / `rear` / `back` tóc là **một khối kín** ôm sọ, vẽ ở
slot `hair` trên đầu, dưới mũ; `overHead` hạ cánh tay trên gần đang thõng xuống
dưới khối tóc nghiêng. Xem [02](02-trang-phuc.md#kiểu-tóc).

**Tóc dựng khối đổi nghĩa `lắc` / `gật` của cả nhân vật.** `src: "sculpt"` ở `hair`
bật phép chiếu góc thật cho nét mặt chính diện: cùng một hành động, mặt quay xa
hơn và mày chiếu co theo khối sọ. Tóc phẳng giữ công thức nén `FACE_YAW` /
`FACE_PITCH`. Ở `side` / `rear` nó đưa cả cụm nét mặt vào `frames.face` mang cái gật, nên
`A.face.cx` / `cy` là chỗ trước khi gật — mốc trên mặt thì hỏi `joints.face` / `eyeNear` /
`mouth`, đừng cộng `A.face` vào nhóm đầu. Công thức rẽ ở `figureAnchors`, theo đúng nhân vật
đã `equip` — đọc `A.face`, đừng tự tính lại. Xem [01](01-rig.md#đầu-và-nét-mặt).

**Thân áo dựng khối đổi gốc chi của cả nhân vật.** `src: "sculpt"` ở `torso` thay
`SIDE_SHOULDER` / `SIDE_HIP` bằng vai và hông chiếu từ vành của khối: vai nằm trên tâm nét
viền áo, không ở `rig.shoulderHalf` — áo có `ease` lớn thì rộng hơn, thân trần hẹp hơn áo phông `CLOTH`; hành
động căn cho hai tay chạm nhau giữa ngực phải thử lại trên nhân vật ấy. Ở `side` cả vai lẫn hông
chập về trục giữa, đứng yên hai chân trùng nhau. Ở `rear` hai gốc còn một nửa khoảng cách
và **chi gần sang `+x`** (`Figure.nearSide = +1`): gốc quay ra ống kính nằm phía mặt hướng
tới, `armNear` / `legNear` vẫn là chi gần ống kính. Công thức rẽ ở `computeFigure` theo nhân
vật đã `equip` — mặc vật có thân áo dựng khối giữa cảnh là đổi luôn chỗ vai và hông ở
`side`, và đổi thân `back` thành thân `rear` thật ở `view: "rear"`. `dx` … `rotate`, `aspect`, `views` và `clip` của `torso` bị bỏ qua; hộp mảnh là
hộp bao hình chiếu. Xem [02](02-trang-phuc.md#thân-áo-dựng-khối).

**Mảng áo mặt trước, mặt sau đo `x` dọc mặt khối, không trên hình nhìn thẳng.** `garment.panels` với `side` `front` /
`back` / `both` đo `x` theo cung tiết diện từ đường giữa; quá phần tư chu vi ở độ cao ấy thì dồn về kinh độ `±90` thành dải
không bề rộng — mảng đặt ngoài thân biến mất, không gì báo. Đo trên hình nhìn thẳng (nửa rộng ngang ngực người mặc đồ chỉ
chừng `28`–`30` px) là đặt mảng lệch vào trong. Mảng `fill: "skin"` của người mặc đồ là da thật (ghi độ sâu, vật liệu da tay
trần): mảng màu, hoạ tiết, hình in dưới nó bị che. Xem [02](02-trang-phuc.md#mảng-áo-và-hoạ-tiết).

**Thân người 3D chiếu qua `fig3.torsoLens`, co dọc theo góc cúi.** Tự gọi `torsoPaths` (hay
`skirtPaths`) cho người 3D thì truyền ống kính ấy, không thì nhận thân 2D ở góc `theta`, lệch
viền thật mà không gì báo. Cổ và đầu của người 3D không nằm ở `len.torso + len.neck`: đọc
`A.joints.collar`, `A.frames.head`, đừng tự cộng độ dài. Xem [01](01-rig.md#người-3d).

**Người 3D mặc đồ treo đồ cầm ở tâm nắm, không ở mút nét.** `palette.clad` dời khung `hand` vào
giữa lòng bàn tay và các ngón của dáng `grip` (`handGrip`, lệch về phía lòng tay) và `hold` giữ dáng `grip` (hay
`HoldOptions.pose`, đồ dời tới tâm nắm của dáng ấy — `gripShift`) ở ngón; đồ căn `offset` cho người que lùi vào vài px. Khung `hand` quay theo cổ tay — xoay cẳng tay, gập và lệch
cổ tay quay cả đồ cầm. Nó ngồi
trên gốc đùi `cladThigh`, không trên `limbHalf`, nên `sceneAt` phải nhận `body3(nhân vật)` — truyền
`legHalf` cứng là người ngồi lún hay lơ lửng trên ghế. Xem [01](01-rig.md#người-3d-mặc-đồ).

**Mặt người 3D có tóc dựng khối không theo `views.head`.** Nấc ấy chỉ còn chọn mảnh vẽ theo nấc;
nét mặt quay liên tục theo `theta` và mỗi mắt có thể đã tắt. Tự vẽ hay tự đặt thứ gì lên mặt thì đọc
`A.face.free` (bóp ngang từng nét, `0` là đã tắt; `yaw` là góc của nét mặt) và `A.joints.eyeNear` /
`mouth`, đừng rẽ nhánh theo `side` / `rear`. Mắt và mồm đã quay quá mép nằm **ngoài** viền đầu, nên
mọi nét mặt phải cắt theo viền. Xem [01](01-rig.md#mặt-người-3d).

**Kính dựng khối không bật phép chiếu góc thật.** `src: "sculpt"` ở `faceAcc` chỉ đổi
cách vẽ kính; nét mặt vẫn theo tóc. Kính chiếu theo `A.face.turn` rồi khớp vào tâm mắt
`A.face.cx` / `A.face.cy`, nên đổi chỗ vẽ mắt thì kính đi theo — đừng dời kính bằng
`dx` / `dy`, `glassesPaths` bỏ qua chúng. Xem [02](02-trang-phuc.md#kính-dựng-khối).

**Râu dựng khối khớp khấc vào mồm đã vẽ.** `src: "sculpt"` ở `chin` dời phần râu quay ra
người xem cho khấc trùng `A.face.mouthCx` / `A.face.mouthCy`, phần sát viền bám sọ — đổi
`face.mouthGap` / `face.offsetY` thì râu đi theo, đừng dời râu bằng `dx` / `dy`,
`beardPaths` bỏ qua chúng. Râu dựng khối luôn vẽ ở lớp `under`, dưới mắt, mày, ria và mồm;
`layer` bị bỏ qua. Khấc mở theo khẩu hình qua tham số `mouth` của `figureAnchors`; thêm khẩu
hình mới thì khai đúng mép trên / dưới của nó ở `extent` trong `MOUTHS` (`core/face.ts`), không thì râu đè lên mồm. Khẩu hình nào
cũng có viền mực, không thì chìm trên râu kín (`cover`). Xem
[02](02-trang-phuc.md#râu-dựng-khối).

**Tóc dựng khối rủ chiếm vị trí `hairBack`.** `sculptPaths` trả các path tóc: `cap` trên đầu,
`back` cũng trên đầu nhưng `SculptHair` cắt theo viền đầu, `under` là phần mặt rủ cắt đúng phía sau mặt
phẳng giữa, vẽ ở vị trí `hairBack` đầu tiên — sau cả thân, ở mọi góc thân, kể cả `back` — và
mang `data-piece="hair"`. Nó cần góc xoay nhóm đầu
(`A.frames.head.deg`) để đuôi tóc rủ theo khung hình; gọi thiếu là tóc rủ theo đầu. Ô
mới thêm vào vỏ phải đi qua `quad` cho cùng chiều quấn, không thì chỗ chồng nhau thủng
lỗ và nét viền hiện qua. Viền chỉ vẽ từ phần cạnh (`edge`) của mỗi lớp, tách với ruột
(`fill`): hình mới chỉ đẩy vào `fill` là mất viền ở đó, còn nét ở mối nối vỏ với mặt rủ
mà đẩy vào lớp trên là vạch đen vắt ngang tóc. Đuôi ngựa và búi xếp lớp theo trục từng
đoạn ống, không cắt ô tại `z = 0` như mặt rủ — vạch cắt thành nét chạy dọc đuôi: đoạn sau mặt
cầu bao vỏ xuống `under`, đoạn trước vào `knot`, lớp `SculptHair` vẽ sau cùng. Xem
[02](02-trang-phuc.md#tóc-rủ), [đuôi ngựa và búi](02-trang-phuc.md#đuôi-ngựa-và-búi).

**`layer` của cẳng tay bị `side` / `rear` / `back` ghi đè.** Thân `side` và thân `rear`
khoá cẳng tay xa xuống dưới thân bất kể hành động khai gì, và bỏ luôn mảnh vai áo xa;
thân `back` — cả thân `rear` của thân áo không dựng khối, vì nó vẽ như `back` — đảo lớp — `front` / `mid` xuống dưới thân, `back` lên trên — và hạ cánh tay trên
gần cùng vai áo gần xuống dưới thân. Sửa `keys[].layer` cho
một cảnh quay lưng là sửa một số không ai đọc.

**Tự gọi `figureAnchors` thì phải truyền `views`.** Hộp mảnh, chỗ mắt và chỗ mồm
đều đổi theo góc nhìn, nên bỏ tham số ấy là trả mốc của góc chính diện trong khi
hình vẽ ra ở góc khác. `anchorAt` và `placeAnchor` (qua `Spot.views`) đã đi sẵn
đường ấy — dùng chúng thay vì dựng bảng riêng.

**Đầu `quarter` thì đã hơi quay sẵn**: `face.turn` đẩy nét mặt sang `+x`, nhân vật
nhìn về bên phải. Nên mảnh đội đầu có lưỡi hay vành trước (`crown`) phải vẽ
**chìa sang phải**, chỏm vẫn chính diện để ôm sọ tròn. Vẽ cái lưỡi trai bẹt về
phía người xem là mất luôn thứ nhận dạng cái mũ. Cả sheet phải quay cùng một
chiều — lật là lật cả người, không lật riêng mảnh được.

**Lắc và gật đầu là dịch nét mặt, không xoay hình.** Kênh `head` là ba góc
`[nghiêng, lắc, gật]`; chỉ `nghiêng` mới là `rotate()` thật quanh cổ. Khối đầu và
mảnh tóc không xoay theo yaw — xoay chúng là hình bẹt ngay; muốn thật sự thấy mặt
nghiêng hay gáy thì đổi `headView`, và ở đầu `side` thì `lắc` **hết tác dụng** vì
nét mặt đã ghim ở mép trước. Khẩu hình, lông mày và kiểu
mắt là kênh `face` riêng trong `mask`,
khai ở `keys[].face`, lấy mẫu kiểu bậc thang như `layer`, không nội suy — đổi nét
mặt không đụng góc đầu của hành động đang chạy. Riêng `keys[].face.blush` là số, nội suy
như góc và cộng vào `face.blush` của nhân vật. Xem [01](01-rig.md).

**Nhấp nhô và trôi ngang khi đi suy từ bàn chân, không dời hông riêng.** Mỗi frame tính y
của cả hai bàn chân, lấy chân thấp hơn, dịch `root` cho chân đó chạm ground line.
Trôi ngang thì ngược lại: chân bám đất dịch bao nhiêu so với hông, `root` dịch
ngược lại bấy nhiêu — `bakeTravel` tích phân một lần lúc nạp thành bảng, lúc vẽ
chỉ tra. Nhún của `walkCycle` là y của bàn chân trụ, giải bằng IK, nên không làm
chân trượt; dời hông mà không đổi bàn chân thì trượt. Đừng tích luỹ trong rAF —
Remotion seek sai. Chân trụ phải quét về sau đều tốc: góc clip đổ thẳng vào rig que
là người phóng rồi khựng mỗi bước. Gót sau phải rời dải chạm đất trước lúc nhấc và
chân vung phải nhấc dốc, kẻo luật chân chịu lực còn tính nó và kéo tốc độ người
xuống — [01](01-rig.md#chu-kỳ-đi).

## Mảnh ảnh và lớp

**Cẳng tay đổi lớp được; cánh tay trên *xa* thì không.** Cẳng tay + bàn tay chọn
`back` / `mid` / `front` (dưới thân áo / trên thân áo dưới đầu / trên tất cả),
khai ở `keys[].layer` của từng mốc, không nội suy; mặc định trong
`DEFAULT_LAYERS`. Khúc vai→khuỷu **xa** bị khoá dưới thân áo — đẩy nó lên là hở
đường ghép ở vai. Khúc vai→khuỷu **gần** thì đi theo `layer.armNear`: nó vốn đã
nằm trên thân áo nên nâng tiếp qua đầu không hở gì, và phải nâng — xem
[Ràng buộc hình ảnh](#ràng-buộc-hình-ảnh). Góc nhìn `side` và `back` ghi đè lớp
ấy, xem mục trên. Xem [02](02-trang-phuc.md).

**Đồ cầm tay đi theo lớp cẳng tay, trừ khi `pieces.hand*.layer` là `under`.** Khi
đó nó vẫn treo ở bàn tay nhưng vẽ sau cả chân lẫn thân — đồ vác sau lưng, mũ cầm
buông thõng sau đùi. Là hằng số của nhân vật (hay của vật trong `items`), không
phải của hành động; để `front` mà vật to hơn bàn tay là nó đè lên đùi, đọc ra
thành cái váy.

**Mọi socket đều có `rotate`, mặc định `0`.** Xoay quanh **tâm hộp** — mũ đội
lệch, cà vạt bay — trừ hai mảnh treo vào khớp: vai áo xoay quanh khớp vai (lệch
khỏi khớp là hở đường ghép), đồ cầm tay quanh bàn tay. Nó là *cách đeo*, hằng số
của nhân vật.

**`aspect` đo từ chính file ảnh, không đọc số khai trong JSON.** Cả bốn đường đọc
— studio, `mount()`/`mountProp()` của render, MCP, và `Scene.tsx` của scaffold
Remotion — đo lúc nạp rồi ghi đè; số nằm trong JSON chỉ là cái đệm lại của lần đo
trước. Thêm đường đọc mới mà quên đo là mảnh bị kéo bè ra mà không có gì báo, và
nó chỉ lộ ở đúng đường đọc ấy nên rất lâu mới thấy.

**Mọi chỗ cần tên file ảnh của socket đi qua `pieceFile()`**, bộ phận code qua
`piecePart()`, không đọc thẳng `pieces[k].file` / `.part`. Socket có
`src: none | image | part`; đọc thẳng `file` là bỏ qua trường hợp socket đang
dùng bộ phận vẽ bằng code. Ảnh xếp theo socket `pieces/<socket>/x.png` (hai tay
chung `hand`, qua `pieceDir()`) và `file` mang cả thư mục con; ô chọn mảnh trong
studio chỉ liệt kê đúng thư mục của socket, nên bỏ ảnh sai thư mục là không thấy.

**Alpha nướng sẵn vào PNG, không key nền lúc chạy.** Studio chỉ nạp mảnh đã có
alpha. Thấy nền magenta hiện trong preview là mảnh chưa qua bước xoá nền ở repo
video — xử lý asset bên đó, đừng thêm bộ key vào studio.

**Mảnh trang phục gen ra là ảnh mực đen trắng, không phải ảnh màu.** Prompt đòi
đúng hai màu — nét `#000000`, ruột một tông tối duy nhất — rồi tẩy ruột lên
trắng; màu thật là `pieces[k].color`, rig nhân vào bằng `feColorMatrix` lúc vẽ.
Áo, mũ, râu, tóc đều thế. Để model chọn màu hộ là mỗi mảnh khoá cứng một màu:
bật `color` thì mọi màu bị nhân chung một hệ số, tắt thì cả bộ nhân vật mặc
chung cái áo ấy. Chi tiết phải tối bất kể màu (cà vạt, vành mũ, kính) thì tô
**đen bệt** — đen nhân màu nào cũng ra đen. Chỗ không phải vải mà vẫn bị nhuộm
(mảng da hở) thì đừng gen kiểu ấy. Xem [02](02-trang-phuc.md).

**Bóng khối do rig phủ lúc vẽ, nên mảnh ảnh không được vẽ sẵn bóng.** Vùng sáng
tính từ chính hình bao của mảnh ngay lúc vẽ, một mảng tối nướng sẵn trong PNG sẽ
chồng lên bóng thật và đứng yên khi đầu lắc — prompt gen mảnh đã cấm "gradient,
highlight, bóng hay texture" ([02](02-trang-phuc.md#gen-mảnh-ảnh)). Mảnh muốn
nhận bóng phải nằm trong tập `SHADED` của `Character.tsx` và phải vẽ qua
`piece()`: vẽ riêng ngoài nó là không có bóng, không có gì báo. Ở đầu, bóng phải
nằm **dưới nét viền** — `Head` vẽ hai lượt, ruột trước rồi nét sau, bóng chèn
vào giữa; gộp lại một lượt là bóng phủ luôn lên viền đầu. Chỉ có **một hướng**
cho cả đầu lẫn thân, không có nguồn sáng theo cảnh. Xem
[01](01-rig.md#bóng-khối).

**Trang phục là PNG hoặc một mục `PARTS`, không phải path SVG ước lượng bằng
mắt.** SVG viết thẳng chỉ dành cho thứ thật sự là 3–5 hình cơ bản: đầu, mắt, lông
mày, miệng, ria mép, giọt nước, vòng sóng, các đoạn chi. Đầu **không nhận ảnh** —
nó phải biến đổi cùng mặt. Thư viện `PARTS` (socket `src: "part"`) nhận cả áo vẽ
lại từ một mảnh ảnh, nhưng path ấy **đo từ chính PNG nó thay** và phải qua ngưỡng
của `assets/pieces/compare.py`; gõ một cái áo ra từ trí nhớ là đang đi sai hướng.
Xem [02](02-trang-phuc.md).

**Bộ phận của repo video chỉ có mặt sau `registerParts`.** Tên `part` không có
trong `PARTS` thì `<Character>` để trống socket, không có gì báo. Bốn chỗ vẽ đã
nạp `stickman.parts` ([02](02-trang-phuc.md#bộ-phận-của-repo-video)); đường vẽ
mới phải gọi `loadParts` của render (Node) hay `registerParts` trước lượt vẽ đầu.

**Đổi thứ tự lớp trong `<Character>` thì sửa `drawSteps` cùng lúc.** Người 3D gộp các phần liền
nhau thành một lượt `<Character parts>` theo thứ tự `drawSteps` khai; lệch thứ tự JSX là hình 3D đổi
mà không gì báo. Xem [03](03-scene.md#người-3d).

## Đồ mang theo

**Đồ mang theo tách khỏi hình dáng: `pieces` là mảnh nền, `items` là vật gọi tên
được.** Một nhân vật đi suốt tập mà cầm mấy thứ khác nhau thì vẫn là **một file**
— rìu, nón, áo giáp mỗi thứ một mục trong `items`, mỗi mục khai config cho từng
socket nó cắm được (cách nắm vẫn là hằng số của nhân vật). Scene và hành động gọi
tên bằng `equip`: tên vật là mặc vào, `null` là để trống socket, `"base"` là về
mảnh nền, socket không nhắc tới thì giữ nguyên. Cắm sẵn đồ vào `pieces` rồi cảnh
nào cũng gỡ ra, hay tách thành nhiều file nhân vật, đều là đi sai đường.

**Đổi chỗ một vật giữa chừng là đổi socket giữ nó, không phải dời mảnh.** Mũ đội
lên đầu: một vật `non` khai cả `handFar` lẫn `crown`, rồi `keys[].equip` của hành
động cho socket này `null` và socket kia nhận vật. Lấy mẫu bậc thang như `layer`,
nhưng **không đi qua `mask`** (mặc gì không phải khớp) và **không hoà** — và ở
scene nó là **công tắc**: thứ một clip ghi giữ nguyên qua clip sau, nhả track
không trả mũ về tay, cởi mũ là một hành động khác nói ngược lại. Chỗ mở màn khai
ở `cast[].equip`, mốc đổi tay giữa cảnh là `clips[].equip` (một con số trong
scene, không phải một file hành động rỗng cho mỗi lần trao); `outfits` chỉ là
cách viết gọn cho nhiều socket một lúc. Xem [01](01-rig.md) và [03](03-scene.md).

**Công tắc thì phải khai cả hai chiều, và chỉ một track được ghi một socket.** Hai
lỗi này không nổ ở đâu cả — hình chỉ thiếu: mốc `{ handFar: null }` ở `t: 0.45`
mà không có mốc bật ở `t: 0` là mảnh **không hiện ra ở frame nào**, vì `end` giữ
trạng thái mốc cuối sang lượt sau; và track sau đè track trước kể cả với `equip`,
nên cái gỡ mũ ở track trước bị track sau cầm đồ đè lại. `equipSwitchProblems` và
`sceneEquipProblems` của rig là chỗ chúng kêu — `stickman check` và `validate` gọi
vào đó.

## Hành động

**Hình dáng và chuyển động là hai file.** Nhân vật không mang tham số chu kỳ
đi; hành động không biết nhân vật nào. Muốn một nhân vật đi nhanh hơn thì thêm
`actions/walk-fast.json`, đừng nhét `walk` vào JSON nhân vật.

**Một file hành động có đúng một nguồn số: `gen` hoặc `keys`.** `gen` là bộ sinh
dựng sẵn trong rig (code, kèm bảng tham số để studio tự dựng slider), `keys` là
chuỗi mốc (data, người dùng soạn được). Ghép nhiều hành động cùng lúc là việc
của scene, không phải của file: mỗi hành động chỉ ghi những khớp trong `mask`
của nó, hành động sau **đè** hành động trước ở đúng những khớp ấy. Cộng góc lại
là khuỷu qua `0` thành gập ngược và tay xa về `−x` thành mất tay. Mốc ghi kênh mà
`mask` không gọi tên là giá trị vứt im lặng — `keys[].face` khai nụ cười mà `mask`
thiếu `face` thì không bao giờ cười; `maskProblems` kêu.

**Mốc `t: 0` là hình đầu tiên của hành động, không phải tư thế trước nó.** `wave`
bắt đầu ở tay đã giơ; đoạn đưa tay lên là chỗ nối, thuộc về scene. Sampler *gán*
mốc `t: 0` chứ không tiến tới nó, nên mốc đầu ghi `idle` là cắt cứng **không**
frame khi clip trước để lại tay ở chỗ khác — `ease` không chữa được, nó chỉ ăn
bên trong đoạn giữa hai mốc. Scene nối bằng `blendPose` / `blendLayers` /
`blendDuration`, và phải suy đoạn hoà từ timeline chứ không nhớ tư thế lúc
chuyển — nhớ là Remotion seek sai. Mốc *cuối* thì ngược lại, cứ giữ: tay hạ
xuống sau khi vẫy là chuyển động có tác giả. Xem [01](01-rig.md).

**`head` đè theo từng góc, góc `null` là không ghi.** Hành động ghi `head: [10, 0, 0]` xoá cái
lắc `−29` của `look-camera` ở track khác dù chỉ định nghiêng đầu; hành động đầu khi nói ghi
`null` ở góc nó không lo. Chỗ nào tự ghép `Pose` một phần thì đi qua `composePose` / `blendPose`:
góc để trống nằm đó dưới dạng `NaN`. Xem [01](01-rig.md#đầu-và-nét-mặt).

**Tay nói giơ một lần rồi giữ.** `end: "hold"`, `ease: "smooth"`, mốc cuối là đích; không
`wrap`, không `spring` cho điệu bộ khi nói — tay nhấp theo nhịp đều nhìn giật. Buông bằng clip
rỗng. Xem [01](01-rig.md#điệu-bộ-khi-nói).

**`auto` và `smooth` hãm lại trước mốc cuối chuỗi.** Đoạn lao vào mốc va chạm (mốc trùng `events[]`)
để `auto` hay `smooth` là cú đập chậm dần rồi mới chạm; dùng `linear` hoặc `bezier` tăng tốc. Xem
[01](01-rig.md#đường-giữa-hai-mốc).

**Thời lượng và số lần lặp thuộc scene, không thuộc file hành động.** `t` trong
file là tỉ lệ chu kỳ `0 → 1`, `duration` chỉ là nhịp mặc định. Thứ *phải* nằm
trong file là `end` (`wrap`/`hold`) — đó là ngữ nghĩa lấy mẫu qua mốc cuối, chỉ
file mới biết.

**Pha va chạm là `events[]` của hành động, không phải hằng số đo tay ở repo
video.** `{ "name": "hit", "t": 0.445 }` không ghi khớp nào, không đi qua `mask`;
`sceneEvents(rt)` đổi cả cảnh ra giây scene (`phase` và `cycle` của clip tính sẵn,
clip lặp thì sự kiện lặp), MCP là `scene_events`. Số ấy đo bằng chính rig — pha
bàn tay xuống thấp nhất, pha bàn chân nhận lực theo đúng luật `bakeTravel` — chứ
không đo bằng mắt, và đo một lần ở bộ chung thì mọi tập sau khỏi đo lại.

**Cách nắm thuộc nhân vật, cổ tay thuộc hành động.** Tay là
`[vai, khuỷu, cổ tay]` (cộng số dang và xoắn vai của người 3D); cổ tay xoay đồ cầm tay (rig 2D không vẽ bàn
tay, người 3D lệch bàn tay theo nó), còn `pieces.hand*.rotate` là thế nắm cố định. Gộp hai thứ vào một là `chop` phải
chọn một góc rìu duy nhất cho cả chu kỳ — không góc nào đúng cả lúc giơ lẫn lúc
bổ. Ảnh đồ cầm để đầu xa ở **mép dưới**; vẽ lưỡi ở mép trên là cầm ngược.

**Người 3D chỉ đọc tay chân soạn ở `side`.** Sân khấu three vẽ kênh tay chân không có cờ nâng ở
dáng nghỉ, và cờ không hoà được: hoà giữa hành động `side` với hành động 2D, với clip rỗng hay với
tư thế nền là tay chân nhảy một khung giữa đoạn hoà — `check` báo lỗi hành động 2D, báo giật cho
phần còn lại. Xem [03](03-scene.md#hành-động-cho-người-3d).

**Đọc tuple tay chân theo chỉ số, đừng theo độ dài.** Tay ba, bốn hay năm số, chân hai hay ba, `torso`
một số hay `[cúi, nghiêng]` — số dang, xoắn vai và nghiêng là của người 3D, thiếu là `0`. Nội suy hai mốc
khác độ dài bằng `mixAngles`, góc cúi của `torso` trong JSON lấy bằng `torsoBend`; `a.map((v, i) =>
… b[i])` ra `NaN`. Chân dang không chạm sàn nếu không vươn `1 / cos(dang)`.
[01](01-rig.md#dang-và-nghiêng-ngang)

**Dáng tay là góc khớp, một bảng: `HAND_POSES` (`core/hand.ts`).** Dáng soạn được là các khoá của
bảng, dáng nghỉ `HAND_RELAXED` ngoài bảng — mốc bỏ trống `pose` là nó. Bàn tay năm ngón của người 3D mặc đồ là một mặt da liền
buộc vào các đốt, da dời theo góc; hoà dáng là hoà góc (`HandVec`), không đổi lưới, nên không có dáng nào bật tắt.
Đổi khung xương hay `HAND_BIND` thì lưới dựng lại theo — đừng ghép thêm khối rời vào bàn tay, mối nối là nét viền
bên trong.
Bàn tay ở kênh `hand` của `mask`, tách khỏi kênh tay: mốc ghi `keys[].hand` mà `mask` thiếu `hand` là bị bỏ
im lặng (`maskProblems` kêu), và clip thu `mask` mà bỏ `hand` thì bàn tay về dáng nghỉ. Đang cầm đồ thì ngón
theo dáng cầm, hành động chỉ còn xoay và gập cổ tay; đồ ngồi ở tâm nắm của dáng ấy (`HAND_GRIPS`), chỗ treo vẫn là tâm
nắm của `grip`. Xem [01](01-rig.md#bàn-tay).

**Chạm người thì khai mốc thân, lòng tay thì khai ý định.** Đích toạ độ hệ thân và `turn` thô chỉ đúng với nhân vật, dáng
thân và hướng khuỷu lúc đo: đổi người chibi, bụng phệ, cúi hay ngồi là tay rơi khỏi mồm, lòng tay quay sai mà không gì báo.
`reach.to` (mốc thân), `point`, `palm` / `fingers` thì rig giải mỗi khung trên chính người ấy (`resolveActing`) — `act`, `actJoints`,
`actPalms`, `figure3d` cùng một phép giải; ai tự dựng người three thì đi qua `act` (nó đọc `Figure.body`), đừng đặt khớp tay
bằng tay. `palm` thắng `turn`. Với không tới, xoay không tới thì `check` báo. Xem [01](01-rig.md#đích-theo-mốc).

**Khuỷu IK là bản lề.** Tay theo đích quay vai theo trục bản lề của `twoBone3` (`armFrame`), khuỷu chỉ gập —
đừng quay đoạn chi theo phép quay ngắn nhất từ phương rủ (`setFromUnitVectors`): cẳng tay và bàn tay lật nửa
vòng khi cánh tay qua đỉnh đầu, và lệch với `actJoints`. Xem [01](01-rig.md#đích-bàn-tay).

**Đo giật trên đúng hình vẽ ra.** `actJoints` của lõi và `act` của three dùng chung khung xương,
luật đọc góc và IK (`core/arm3.ts`, `core/act3.ts`), cả xoắn vai, ba góc cổ tay và tâm nắm (`hand*`); đổi một bên mà không
đổi bên kia thì `check` đo một hình khác hình lên phim — `act3.test.ts` giữ chúng trùng. Chỗ cố ý giật khai `snap`, đừng nới ngưỡng cả repo.
Xem [01](01-rig.md#khớp-người-3d-vẽ-ra).

## Scene

**Người khai `cast[].world` bỏ hết số 2D của mình.** `x`, `y`, `scale`, `view`, `headView`,
`flip`, `zParts` vẫn hợp lệ trong JSON nhưng không còn được đọc: chỗ đứng, cỡ, góc nhìn và lớp
suy từ `scene.lens` mỗi khung; `z` chỉ còn đặt cả lượt người 3D trên trục `z` của cảnh. `world` mà cảnh thiếu `lens`, hay đi
cùng `mount`, `sit`, `path` 2D, là lỗi lúc nạp; đạo cụ không `follow` được người 3D (cầm đồ bằng `equip`). Người ngồi thì `at` là **điểm trên mặt ngồi**, không phải hông: khai hông là người lún nửa
bề dày đùi vào ghế. Góc của kênh tay chân chỉ đọc 3D khi hành động khai `authoredAt: "side"`; hành
động cũ trên người 3D vẫn là góc trên mặt khung. [03](03-scene.md#người-3d)

**Đích cổ tay hệ thân có `ra ngoài` dương về phía chính tay ấy**, không phải trục phải `R` của thân:
`keys[].reach` của hai tay đối xứng là cùng một bộ số. **`world.hands` thì theo tay phải / trái**,
toạ độ thế giới, và đè tay của mọi hành động khi phần đích là `1` — clip vẫy tay chồng lên không
nhúc nhích tay ấy cho tới mốc `null`. Đích hệ thân giả định bàn cao hơn hông ngồi ~`51`; dàn cảnh
khác cao mà không đặt `world.hands` thì cổ tay lơ lửng hay chìm vào bàn, không gì báo.
[01](01-rig.md#đích-bàn-tay)

**Rig không đẩy người 3D ra khỏi đồ khối.** Phần người lồng vào mảnh đồ thì mảnh bị chặt qua tâm
phần người và nửa trước vẽ đè lên: tay xuyên mép bàn, mép bàn đâm vào bụng. Lúc vẽ không gì báo,
`stickman check` thì báo; tay lên bàn thì đặt bằng `handsOn`, lấn có chủ ý thì khai `touch` trên món
hay vật three. Đồ repo dựng thẳng bằng three chỉ được đo khi repo khai `stickman.world`.
[10](10-lop-ve-code.md#người-lồng-vào-đồ)

**Chỗ vẽ hay đo người 3D gọi `sceneAt(rt, id, t, height, body3(nhân vật))`.** Trôi ngang của người
đi theo `path` nướng theo `height` và nửa khoảng hai gốc chân của tham số ấy; chỗ vẽ và chỗ đo truyền
khác nhau là bàn chân vẽ ra lệch khỏi chỗ đo, không gì báo. Chỗ tự dựng bảng `figureAnchors` thì
truyền cả `world` của `sceneAt` (tham số thứ năm) — thiếu nó, mốc đo theo tư thế 2D chưa chiếu.
Pha của clip có sải chân ở người ấy chạy
theo đồng hồ riêng, không phải `(t − start) / cycle` — sự kiện hỏi qua `sceneEvents`, đừng tự giải
ngược. **Hông người đi theo `path` suy từ bàn chân, không phải nội suy mốc**: mốc giữa đường là đích
mềm, clip đi phải kết thúc từ nửa `cycle` trước tới một phần tư `cycle` sau mốc dừng (rig tự khép chân ở mốc) và clip ngồi
bắt đầu đúng mốc đứng trước mốc ngồi, nếu không người dừng lệch chỗ hay chân đứng sững — `check` kêu. [03](03-scene.md#đi-theo-path)

**Nhịp của clip khai bằng `cycle` hoặc `speed`, không cả hai.** `speed` là đơn vị
scene mỗi giây cho người `height = 1`: rig lấy sải chân của chính hành động
(`actionStride`, đo bằng `bakeTravel`) nhân `scale` rồi chia ra `cycle`, nên số ấy
không lệch với trôi ngang lúc vẽ. Hành động không trôi ngang thì không có `speed`
— lỗi lúc nạp, không phải đứng im.

**Muốn biết một mốc trên người ở đâu trên khung thì gọi `anchorAt(rt, id, tên, t,
nhân_vật)`** — trả `{x, y, deg, w, h, flip}` trong đúng hệ toạ độ chỗ vẽ, cho hai
chục khớp và cả 13 socket mảnh; từ MCP là `scene_probe` với `anchors: [...]`.
Không chép chuỗi biến hình của `<Character>` ra ngoài rig để tự tính. Trùng tên
thì socket thắng, nên khớp cổ tên là `collar`. Xem
[03 — Hỏi mốc trên người](03-scene.md#hỏi-mốc-trên-người).

**Cỡ khung là `scene.frame`, tra ở `FRAMES` của rig — `wide` cho tập, `tall` cho
short.** Hai khung cùng cao `720` và cùng `ground` `260`, chỉ khác bề ngang (`1280` so
với `405`), nên đổi khung không đụng `scale`, `y` hay `path` của ai; bù lại bề ngang
khung dọc chỉ hơn một sải chân `walk`. Cỡ khung đọc ở `rt.frame` hay `cam.frame`,
**đừng lấy hằng số** — lấy `SCENE_CANVAS` ở chỗ vẽ là short vẫn ra hình ngang mà không
gì báo. `bg[].scale` đo theo bề ngang khung, nên cùng một tấm nền ở hai khung là hai
số. Mọi shot của một tập phải cùng khung. Xem [03](03-scene.md#khung-hình).

**Khung là của camera trong scene, và chỉ có một hàm trả nó: `cameraAt(rt, t)`.**
`scene.camera[]` là chuỗi mốc `{t, x, y, zoom, move}`; `move` mặc định `cut` (giữ mốc
trước rồi nhảy) vì **mặc định là cắt, chạy máy chỉ khi cái chạy tự nó có nghĩa**. Cả
ba đường render gọi chính hàm ấy — gõ `viewBox` bằng tay ở chỗ vẽ là tự tách mình ra
khỏi hai đường kia. Camera nằm trong scene (chứ không ở tầng tập) để dải ảnh và
`stickman-video` thấy đúng khung. Soi bằng
`stickman-render --scene … --stage` hay `render_scene` với `stage: true`.
Xem [03](03-scene.md#camera).

**Hiệu ứng là `scene.fx[]`, vẽ bằng `<SceneFx>` của `@stickman3d/fx`, và thuần theo
`t`.** Không trạng thái qua frame, không `Math.random`, nhiễu lấy ở `hash(i)`. Ba
lớp `back` / `front` / `ui` chèn ở đúng một chỗ, `<SceneWorld>` của `@stickman3d/fx`;
đường render nào cũng vẽ qua nó. Bám vào người qua
`sceneAnchor` (tức `anchorAt`); toạ độ cứng lấy từ `scene_probe`. Xem
[09](09-hieu-ung.md).

**Thứ tự vẽ cả cảnh chỉ có một hàm: `sceneOrder(rt)`, và nó sắp theo `z` ở các tầng
lồng nhau, không sắp phẳng.** Tầng sân khấu là nhóm (`groups[]`), cùng người không ngồi, con
vật không chủ và đạo cụ không `follow` chưa vào nhóm nào; trong một nhóm thì thành viên sắp
theo `z` cục bộ và cả nhóm dời theo `z` của nhóm; trong một cụm thì chủ ở `z` cục bộ `0` và đạo cụ theo nó xếp
quanh, cả cụm dời theo `z` của chủ; trong một đạo cụ có người ngồi thì những người ấy
sắp theo `z` cục bộ của họ. Số nhỏ ở sau, hoà thì giữ thứ tự mảng. Bỏ trống `z` là
bảng `SCENE_Z`, dựng lại đúng thứ tự cứng vốn có — **`layer` chỉ còn là đường tắt, và
nó ánh xạ hai kiểu**: đứng rời thì ra băng toàn cục, `follow` thì ra hai giá trị cục
bộ `∓1` quanh chủ. **Trục dừng ở tầng sân khấu**: con vật có chủ (vẽ ở `slots`) và
chỗ cắt hai nửa `part` của đạo cụ có người ngồi không nhận `z`, khai ở đó là im lặng
không có gì đổi. **`fx[].z` và `z: { back, front }`
của lớp vẽ code xen vào cùng trục ấy**, bỏ trống là băng `fx` của `layer`; hoà thì lớp
code, rồi `fx`, rồi dàn diễn. Nền chưa vào trục — băng `bg` là chỗ `bgOrder` xếp các
lớp nền với nhau. Xem [03](03-scene.md#trục-z).

**Một người ra nhiều mục của `sceneOrder` khi khai `cast[].zParts`**, mỗi mục một lượt
`<Character parts>`; chỗ vẽ mới phải truyền `parts` và đặt `key` theo nó, không thì người ấy vẽ
nguyên khối hai lần. Tự dựng `parts` thì `legNear` chỉ còn đùi: muốn cả chân phải kèm
`shinNear` (tay cũng thế với `forearm*`). **Chỗ đứng của thành viên một nhóm đã quy ra sân khấu ở `resolveScene`** —
`rt.cast[].x` là số sân khấu, số tương đối chỉ còn trong `SceneData`; đừng cộng gốc nhóm thêm
lần nữa ở chỗ vẽ. Xem [03 — Tách người theo `z`](03-scene.md#tách-người-theo-z),
[03 — Nhóm](03-scene.md#nhóm).

**Thời gian trong scene viết được `"@mốc+0.4"` theo `scene.marks`, và JSON giữ nguyên
tham chiếu.** Chỉ `resolveScene` (qua `unmarkScene`) mới ra số; đọc `SceneData` thô
rồi làm toán trên `start` / `t` là gặp chuỗi. Thời điểm mà tiếng, hình và lớp vẽ code
cùng khớp thì đặt một mốc, đừng chép cùng một số ra ba chỗ — `stickman retime` chỉ dời
được mốc. Xem [03](03-scene.md#mốc-có-tên).

**Đường đất là `scene.ground`, một số cho cả cảnh.** `cast[].y` và `props[].y` không
khai thì đi theo nó, nên ghép nền vào một cảnh đã dựng xong là sửa **một** số. Nền là
`scene.bg[]`, **một mảng lớp** (ảnh trong `assets/bg/`): thứ tự vẽ lấy ở `bgOrder()`, các ô
vẽ của một lớp ở `bgTiles(lớp, cam)`, `aspect` **đo từng file một** ở cả ba đường render như
mảnh nhân vật. **Hộp nền phụ thuộc mốc camera** vì `bg[].parallax` trôi lớp ấy theo máy
quay (`1` là dán vào sân khấu, `0` là đứng im trên màn hình); nhớ hộp lại giữa các khung
hay tự cộng phần trôi ở chỗ vẽ là mỗi đường render ra một khung khác. **Số ô của `bg[].repeat`
cũng suy từ hộp camera, và chỉ suy ở `bgTiles`** — đường render nào tự nhân ô ra hai bên là
tự tách khỏi hai đường kia; `tiles` chỉ là chặn trên, không phải số ô người dùng đếm. Cả chồng nền là bước trước `sceneOrder` nên `z` của lớp nền chỉ sắp các lớp nền với
nhau — khai ra khỏi băng nền là im lặng không có gì đổi. Mảng rỗng
thì chỗ vẽ kẻ vạch đường đất, nên **điều kiện ấy là mảng rỗng, không phải thiếu trường**.

**Quay giữa cảnh là `cast[].flip` khai chuỗi mốc `[{ t, v }]`** — công tắc bậc
thang như `equip`, không hoà, trước mốc đầu là chưa lật, và cú quay gọn đúng một
frame vì không có góc ¾ nào để đi qua; lật lúc hai chân chụm thì đỡ lộ. **Sign của trôi ngang phải nằm trong
tích phân**: `spotAt` cộng dồn `Σₖ dirₖ · (T(min(t, tₖ₊₁)) − T(tₖ))`, viết
`dir(t) · T(t)` cho gọn là lật một cái người nhảy `2 · T(t)`. Hướng lấy ở
`sceneAt().flip` hoặc `flipAt(rt, id, t)`, **đừng đọc `m.flip`** — nó là chuỗi mốc
chưa lấy mẫu. Xem [03](03-scene.md#quay-hướng).

**Góc nhìn của một người là `cast[].view` và `cast[].headView`** — một chuỗi hay
một dãy mốc bậc thang như `flip`, trước mốc đầu là `quarter`. Đọc qua
`sceneAt()`, **đừng đọc `m.view`**: nó là chuỗi mốc chưa lấy mẫu, và `sceneAt` còn
kẹp tổ hợp hộ trước khi `<Character view headView>` nhận. **Trôi ngang suy từ bàn
chân không đổi theo góc nhìn** — người quay lưng vẫn đi ngang chứ không đi vào
trong; muốn nó lùi xa dần thì khai `path` (và `scale` nếu cảnh có phối cảnh). Xem
[03](03-scene.md#góc-nhìn).

**Nằm là `cast[].rotate`: xoay cả người quanh gốc `(x, y)` — chỗ chạm đất giữa hai bàn
chân — theo chiều rig, lật theo `flip`.** `90` là nằm ngửa ở cả hai hướng; `flip` chọn đầu
bên trái hay bên phải, đừng đổi dấu để lật. Gốc ở bàn chân nên `x` là bàn chân, `y` là
độ cao khớp hông, không phải mặt nệm. Nằm thẳng (`base` đứng) thì đầu to hơn bề dày thân nên
sau đầu tụt dưới nệm: nằm gối đầu là `base: "lie"`, và track trên người nằm chỉ ghi `face` —
hành động ghi `head` đè góc cúi của `lie`, đầu chìm vào gối. Phép xoay nằm ở hai chỗ phải khớp nhau: transform của
`<Character>` và `onStage` trong `anchor.ts` (`anchorIn`, con vật trong tay) — `Spot` thiếu
`rotate` là mốc đo ra người đứng trong khi hình vẽ người nằm, không gì báo. Dải ảnh dựng người
đứng lại; `spin` của lớp vẽ code không đi vào `anchorAt`. Xem
[03](03-scene.md#nằm-và-xoay-cả-người).

**Người trong scene diễn bằng `castCharacter(m, c)`, không bằng JSON nhân vật thô** —
`cast[].turn` đè `face.turn` ở đó. `<SceneWorld>`, `anchorAt`, `animalAnchorAt`, dải ảnh
của render và `scene_probe` đã đi qua nó; đường mới nào vẽ hay đo người của scene mà gọi
thẳng `figureAnchors` / `<Character>` với JSON thô thì người `turn` lệch khỏi chỗ đo, không
gì báo. Xem [03](03-scene.md#xoay-quarter-trong-một-cảnh).

## Động vật

**Động vật là loại thứ ba, không phải nhân vật cũng không phải đạo cụ.** `animals/*.json`
qua `AnimalSchema`: bộ xương hông→vai, hai hoặc bốn chân hai đoạn, thân/cổ/đầu/cánh/đuôi
vẽ code bám trục sống. Nét mặt chỉ có mỏ và mắt (`mouth` / `eyes`, cùng tên với người; mỏ
chỉ đầu `beak` vẽ), không `equip`, không thư viện tư thế. Hành động của động vật nằm chung
`actions/`: bộ sinh phân biệt bằng **tên** (`ANIMAL_GENERATORS`), hành động mốc bằng
`actor: "animal"` — `actionKind` đọc cả hai, `actor` đi cùng `gen` là lỗi. Mốc động vật ghi
`ANIMAL_JOINT_CHANNELS` cộng `face`, `mask` gọi tên bộ kênh ấy. Xem [08](08-dong-vat.md).

**Bốn đoạn dọc thân đo bằng độ dốc so với phương ngang, dương là ngẩng lên** — không
phải góc rig của chi, và đo so với đoạn cha. Chân thì ngược lại: **hai đoạn**, đúng quy
ước góc của chi người, và **không** đi theo độ dốc thân, y như chân người không theo
`torso`. Chân trước treo ở vai, chân sau ở `rig.hindAt` dọc thân — con hai chân để nó
quanh `0.4`, chân dưới giữa thân; để `0` là con vật ngã về đuôi. Chi là **nét que** một màu một bề dày (`palette.leg` / `legWidth`) — nhận diện
con vật là việc của đầu và thân.

**Khớp giữa của chân là khớp lộ dưới bụng, và đứng thì bốn chân gần thẳng.** Móng guốc:
chân trước `forward` (đầu gối trước), chân sau `back` (cổ chân sau); voi `forward` cả bốn.
Khuỷu và đầu gối sau chìm trong thân, không vẽ — kéo `upper` ngắn cho khớp chìm vào thân
là vẽ nhầm khớp ấy, con nào cũng thành con chó ngồi. `legStretch` quanh `0.93`, voi
`0.96`; thấp hơn `0.85` là ngồi xổm.

**Hộp socket ảnh của động vật lấy nguyên từ bộ xương, nên không có `aspect`.** Đây là chỗ
khác hẳn mảnh nhân vật: bề ngang là tham số hình dáng thật (`body.depth`, `head.depth`),
không đo từ tấm ảnh. Ảnh ở `pieces/animalBody/` … theo `animalPieceDir`, tiền tố `animal`
để không đụng socket cùng tên của nhân vật. Socket có ảnh thì hình code của **đúng bộ
phận ấy** không vẽ nữa, bộ phận khác giữ nguyên.

**Dáng đi dựng từ đường đi của bàn chân rồi suy ngược ra góc bằng IK**, không phải từ
góc khớp. Hông đi như **con lắc ngược**: mỗi khung cao bằng chỗ xa nhất mà mọi chân còn
với tới, nên chân chịu lực dựng thẳng giữa nhịp — giữ hông cố định là kiểu đi khom. Hai
chỗ bị kẹp lại và cả hai đều im lặng nếu bỏ: **sải chân** kẹp theo
`maxStride` của chính con vật (vượt qua là IK duỗi hết cỡ và bàn chân trượt — giới hạn
với tới đâu thuộc con vật, như giới hạn khớp của nhân vật), và **nhịp đạp** kẹp xuống
không thấp hơn quãng hở giữa hai lần chạm đất, vì dáng đi ở đây **không có pha bay**:
không chân nào chạm đất thì `bakeFeetTravel` giữ đà bằng chân vừa nhấc, tức kéo lùi.

**Chân duỗi hết khi đứng là hỏng, dù hình đứng vẫn đúng.** `legStretch` trên `0.97`
là hết chỗ doãng, sải chân bị cắt cụt và bàn chân trượt. `animalProblems` là chỗ kêu, ở cột
Động vật của studio.

**Chân cổ chìm dưới thùng thân, khối đầu nổi lên trên; chân gần của con bốn chân nổi
trên thân nhưng chìm dưới đầu và cánh gần.** Con hai chân vẽ cả hai chân dưới thân
để gốc chân chìm trong bụng. Động vật cổ ngắn có đầu nằm ngay trước ngực; vẽ thân sau đầu là
mất luôn cái đầu. Tai voi rủ xuống đè lên chân trước, cánh gà phủ lên đùi.

**Cánh là bộ phận hai đoạn treo trên thân, không phải chi và không phải họ riêng.**
`parts.wing` như `tail`: `len: 0` là không có, có thì vẽ cả hai bên; kênh `wing: [gốc,
chóp]` cộng vào `pitch` / `fold` nghỉ, đưa cánh ra trước mặt là dốc thêm gần `200°` vì cánh
mọc ngược trục thân. Cánh và số chân là hai trục độc lập — ngựa gắn cánh vẫn là một
`animals/*.json`. **Bay là `airborne`** (`animalFly`, hay `airborne: true` ở hành động
mốc): gốc là khớp hông, chỗ đứng hạ đúng `rig.hipY`, không bóng, không nướng trôi ngang —
đường bay là `path` của scene, `speed` trên clip bay là lỗi.

**Trong scene, con vật là `animals[]`, nhưng cưỡi và xách là thuộc tính của *người*:
`cast[].mount` và `cast[].carry[]`.** Con vật có chủ vẽ **trong** `<Character>` qua
`slots` (`mount` chen giữa chi xa và chân gần, `handNear`/`handFar` trong khung cổ tay)
và **không có lớp riêng** trong `sceneOrder` — vẽ nó rời nữa là hai con; `animals[].z`
ở đó bị bỏ qua. Ba đường render
dựng khe bằng `castSlots`, đừng tự đặt `<Animal>`. Người cưỡi treo ở hông: `sceneAt`
trả `root: "hip"`, và `anchorIn` phải nhận cùng `root` ấy — quên là mọi mốc trên người
cưỡi lệch đúng một chiều dài chân.

**`resolveScene` cần JSON con vật, không chỉ hành động.** Trôi ngang của người nướng cho
`height = 1` rồi nhân sau, nhưng sải chân của con vật kẹp theo chính nó, nên bảng travel
phải nướng từ đúng con ấy. Quên đưa `animals` vào là lỗi ngay lúc nạp, không phải hình sai.
Con vật có `tracks[]` như người; **chân cắt cứng** ở `start` của clip, chỉ thân, cổ, đầu,
đuôi, cánh và mặt hoà: góc chân là kết quả IK, hoà là bàn chân trượt. Clip trên cùng đang
ghi chân quyết định con vật có trên không hay không.

## Đạo cụ và tập

**Xe cộ là đạo cụ, không phải một loại nhân vật.** `props/*.json` qua `PropSchema`:
một thân thay được (ảnh hai màu hoặc bộ phận code `sockets: ["prop"]`) và bánh
vẽ code — bánh sau tuỳ, bánh trước chỉ có khi có bánh sau, **không có bánh xa**.
Gốc toạ độ là điểm bánh sau chạm đất, thân treo vào trục bánh sau nên to bánh là
xe tự nâng; không bánh (khúc gỗ, hòn đá) thì trục ấy nằm ngay mặt đất và đáy
thân đặt lên đất — đừng khai bánh vô hình.
Bánh quay là hệ quả: `roll / (r · scale)` rad với `roll` là `x` trên màn hình —
không có tham số tốc độ, không tích luỹ. Đặt lên sân khấu ở `scene.props[]`,
`follow` để đi theo một người (độ lệch tính trong hệ của người ấy); thứ tự vẽ
lấy ở `sceneOrder(rt)` cho cả ba đường render, và `z` của một đạo cụ `follow` là
**cục bộ** quanh chủ nó, không ra khỏi cụm ấy được. Tay không tự tìm càng — tư thế
tay là hành động (`push.json`), `props[].x` đưa càng tới tay, soi bằng
`scene_probe`. Xem [06](06-dao-cu.md).

**Ngồi trong xe là `cast[].sit`, thuộc người, và đạo cụ ấy vẽ làm hai nửa.** Hông
đặt vào `propSeat(prop)` — `seat` trong JSON, không thì của bộ phận thân; thân
ảnh không khai là không ngồi được, lỗi lúc nạp. `sceneOrder` thay mục đạo cụ bằng
`part: "back"`, người ngồi (sắp theo `z` cục bộ của họ), `part: "front"`, và người
ngồi **không** có lớp `cast` riêng — đường render nào bỏ qua `part` là vẽ xe hai lần
đè lên người. Chỗ cắt hai nửa ấy là `propSeat` cắt hình, không phải một nấc `z`. Vách gần
phải **khoét lỗ** (`evenodd`), vẽ cửa sổ tối lên trên là người biến mất.
`resolveScene` cần JSON đạo cụ và `heights` khi có ai ngồi; đạo cụ theo người mà
nâng lên (`y` khác `0`) không đổ bóng. Xem [03](03-scene.md#ngồi-trong-đạo-cụ).

**Một tập là `episodes/*.json` ở repo video, không phải một scene to.** Scene là đơn vị
dựng, tập là đơn vị xem: `shots[]` xếp cảnh (và cả shot hiệu ứng không có `cast`) lên
một trục, cộng `audio` và `slow`. Code ở `src/` của repo video —
`episode.ts` (schema), `shots.ts` (xếp, thuần, **cộng dồn bằng frame**), `Episode.tsx`
(vẽ); hai đồng hồ slow-mo đọc chung `warpTable` của rig — hai công thức rời nhau lệch
`0,005 s` là hai cây rìu trong một khung. Shot xếp **ngược** trong DOM để `overlap` chạy
sau lưng shot trước mà không đè lên nó. Camera thì không ở đây, nó ở trong scene.
Xem [07](07-lam-tap.md#bảng-thời-gian-của-cả-tập).

## Lớp vẽ code

- Lớp bật theo **`scene.name`**, không phải tên file; sai tên thì lớp chỉ không
  vẽ, không có gì báo — docs/10.
- Đường render mới vẽ bằng **`<SceneWorld>` của `@stickman3d/fx`**, chỗ duy nhất
  gọi năm móc (`bg`, `back`, `front`, `shake`, `place`) và chèn ba lớp `fx`. Tự
  gọi từng móc ở chỗ khác là thiếu một chỗ mà không có gì báo.
- `place` cộng vào chỗ đứng lúc vẽ, **không** đổi `cast[].x`: `scene_probe` và
  `anchorAt` trả số chưa cộng.
- Lớp khai `bg` thì **vạch đất tắt theo** — lớp tự lo đường chân trời.
- Lớp không được `import` Remotion: `stickman-render` và MCP gọi nó ngoài
  Remotion. Giây vào bằng `ctx.t`, khung camera bằng `ctx.cam`.
- Đồ khối nhớ theo **object món**: sửa thẳng `parts` hay một `Part` của món đã vẽ
  thì hình giữ khối cũ, không có gì báo. Đổi hình thì tạo món hay mảng `parts`
  mới — docs/10 § Đồ khối.
- Khối của `lathe` mang viền tính cho **một** ống kính và một chỗ đặt: dùng lại cho ống
  kính khác, `at` khác hay `tilt` khác thì viền lệch khỏi mép, không có gì báo. Đổi một
  trong ba thì dựng lại — docs/10 § Khối tròn xoay.

## Ràng buộc hình ảnh

- Giữ vai ở `±shoulderHalf` (thân áo dựng khối: trên viền áo), hông ở `±hipHalf`; đổi bề
  ngang hông thì chỉnh lại góc chân trong `POSES`.
- Mọi nhân vật phải có mảnh `torso`. Khối thân vẽ bằng code chỉ có một đường: [thân áo
  dựng khối](02-trang-phuc.md#thân-áo-dựng-khối); đừng gõ path thân áo bằng mắt.
- Nếu dùng mảnh vai áo, tách `sleeveNear` và `sleeveFar`, bật
  `sleeveFit.hideUpperArm`, đặt hộp đúng đoạn vai→khuỷu và không hẹp hơn nét tay.
- Khuỷu của chu kỳ đi không được âm.
- Tay đi qua đầu hoặc mặt dùng lớp `front`; tay gần có góc vai `117°`–`204°`
  cũng cần `layer.armNear: "front"`.
- Hai tay gặp nhau trước ngực phải giữ khuỷu rộng như `POSES.hold`.
- Thân áo rộng hơn vai thì không cảnh nào để người ấy chỉ đứng `idle`: tay buông sát
  người lọt vào bóng áo thành người không tay. Đè một track tay — [02](02-trang-phuc.md#trang-phục-việt-xưa).
- Áo không tô tối hơn chừng `#5b5f7d`: tay nét `#1a1a1a` đứng trước thân áo sẽ mất.
- Đo nét trong ảnh rồi chỉnh `Dày nét`; không yêu cầu model bám một độ dày nét
  tuyệt đối.
