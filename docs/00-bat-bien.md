# 00 — Bất biến, đừng phá

Những chỗ mà làm sai thì **không có gì báo** — không lỗi biên dịch, không lỗi
zod, hình chỉ sai hoặc thiếu. Đọc mục của vùng mình sắp đụng trước khi sửa; mỗi
mục trỏ tiếp tới file spec đầy đủ.

## Dấu góc và hình học

**Quy ước góc**: `0°` = đoạn chỉ thẳng xuống, dương = xoay về `+x`, khớp con
(khuỷu, gối) đo **tương đối** so với khớp cha. Người quay mặt sang trái khung (`flip`) không đổi dấu góc.

**Quy ước góc ngược dấu với `rotate()` của SVG.** `deg` mà `anchorAt` trả là độ SVG; vẽ
đè một hình nằm dọc đoạn ở góc rig `θ` là `rotate(−θ)`. Sai dấu chỗ này không lộ ra ở chu
kỳ đi (góc nhỏ), chỉ lộ ở pose góc lớn — kiểm bằng `shrug`, đừng kiểm bằng `walk`.

**Tay giơ quá ngang thì khuỷu cùng dấu vai.** Dấu vai là chiều cánh tay quét lên
(vì thế slider vai chạy tới `±270°`), và khuỷu gập tiếp theo chiều ấy: cẳng tay
cuộn về phía đầu. `|vai| > 120` mà khuỷu ngược dấu là cẳng tay quay ngược lại,
khuỷu gập ra ngoài — `armFoldProblems` kêu ở `check` và `validate`. Cùng một bàn tay trên đỉnh đầu, `[195, −25]` gập ngược còn
`[171, 25]` thì không.

**`palette.limbCurve` chỉ làm tròn khuỷu và gối.** Điểm hai đầu và tiếp tuyến ở
hai đầu của chi y hệt đoạn thẳng, nên đồ cầm tay — treo vào cổ tay — không cần biết
tới độ cong; đừng bù trừ gì cho nó. Mặc định `1`; hạ về `0` thì chi trở lại hai đoạn
thẳng. Xem [01](01-rig.md#vẽ-chi).

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
người 3D cũng vậy (`bones3`), vì hông 3D lấy từ `world.hip` đặt theo chân đã nhân; bề
ngang thân, độ dày nét và đầu giữ nguyên. Nhân cả vào bề ngang là mỗi lần chỉnh cao lại
phải căn lại thân áo.

**Thân áo đổi gốc vai của cả nhân vật.** Vai người 3D nằm trên tâm nét viền thân áo
(`roots3`, `garmentShoulder`), không ở `rig.shoulderHalf` — áo có `ease` lớn thì rộng hơn, thân
trần hẹp hơn áo phông `CLOTH`; hành động căn cho hai tay chạm nhau giữa ngực phải thử lại trên
nhân vật ấy. Công thức đọc thân áo của nhân vật đã `equip` — thay áo giữa cảnh là đổi luôn chỗ
vai. Xem [12](12-trang-phuc-3d.md#thân-áo-dựng-khối).

**Mảng áo mặt trước, mặt sau đo `x` dọc mặt khối, không trên hình nhìn thẳng.** `garment.panels` với `side` `front` /
`back` / `both` đo `x` theo cung tiết diện từ đường giữa; quá phần tư chu vi ở độ cao ấy thì dồn về kinh độ `±90` thành dải
không bề rộng — mảng đặt ngoài thân biến mất, không gì báo. Đo trên hình nhìn thẳng (nửa rộng ngang ngực người mặc đồ chỉ
chừng `28`–`30` px) là đặt mảng lệch vào trong. Mảng `fill: "skin"` của người mặc đồ là da thật (ghi độ sâu, vật liệu da tay
trần): mảng màu, hoạ tiết, hình in dưới nó bị che. Xem [12](12-trang-phuc-3d.md#mảng-áo-và-hoạ-tiết).

**Người 3D mặc đồ treo đồ cầm ở tâm nắm, không ở mút nét.** `palette.clad` dời khung `hand` vào
giữa lòng bàn tay và các ngón của dáng `grip` (`handGrip`, lệch về phía lòng tay) và `hold` giữ dáng `grip` (hay
`HoldOptions.pose`, đồ dời tới tâm nắm của dáng ấy — `gripShift`) ở ngón; đồ căn `offset` cho người que lùi vào vài px. Khung `hand` quay theo cổ tay — xoay cẳng tay, gập và lệch
cổ tay quay cả đồ cầm. Nó ngồi
trên gốc đùi `cladThigh`, không trên `limbHalf`, nên `sceneAt` phải nhận `body3(nhân vật)` — truyền
`legHalf` cứng là người ngồi lún hay lơ lửng trên ghế. Xem [01](01-rig.md#người-3d-mặc-đồ).

**Mốc mặt của `anchorAt` không nằm đúng chỗ chiếu thật trên sọ.** `face`, `eyeNear`, `eyeFar`,
`mouth` chạy theo đường cong ăn gian của `faceYaw`: thật tới `FACE_TRUE`, chậm hơn đầu tới
`FACE_REAL_FROM`, rồi trượt dần về chỗ chiếu thật. Bám hiệu ứng vào mặt thì hỏi đúng các mốc ấy,
đừng tự chiếu tâm sọ. Xem [01](01-rig.md#mặt-người-3d).

**Khẩu hình mới phải khai đúng mép trên / dưới ở `extent` trong `MOUTHS`** (`core/face.ts`):
lớp mồm của người 3D (`MOUTH_BOX`) phải phủ hết `extent` của mọi khẩu hình, không thì mồm bị cắt
mép — `face.test.ts` giữ hai bên khớp. Xem [01](01-rig.md#khẩu-hình-và-mắt).

**Nét mặt là kênh `face` riêng trong `mask`, không phải góc đầu.** Kênh `head` là ba góc
`[nghiêng, lắc, gật]`. Khẩu hình, lông mày và kiểu mắt khai ở `keys[].face`, lấy mẫu kiểu
bậc thang như `equip`, không nội suy — đổi nét mặt không đụng góc đầu của hành động đang
chạy. Riêng `keys[].face.blush` là số, nội suy như góc và cộng vào `face.blush` của nhân vật.
Xem [01](01-rig.md#đầu-và-nét-mặt).

**Sải chân khi đi suy từ bàn chân, không dời hông riêng.** Chân bám đất dịch bao nhiêu so với hông
thì người đi bấy nhiêu — `bakeTravel` tích phân thành bảng, `actionStride` (nhịp của `clips[].speed`)
đọc nó. Nhún của `walkCycle` là y của bàn chân trụ, giải bằng IK, nên không làm
chân trượt; dời hông mà không đổi bàn chân thì trượt. Chân trụ phải quét về sau đều tốc: góc clip đổ thẳng vào rig que
là người phóng rồi khựng mỗi bước. Gót sau phải rời dải chạm đất trước lúc nhấc và
chân vung phải nhấc dốc, kẻo luật chân chịu lực còn tính nó và kéo tốc độ người
xuống — [01](01-rig.md#chu-kỳ-đi).

## Đồ mang theo

**Đồ mang theo tách khỏi hình dáng: `pieces` là đồ nền, `items` là vật gọi tên
được.** Một nhân vật đi suốt tập mà thay mấy bộ đồ thì vẫn là **một file**
— áo khoác, mũ, kính mỗi thứ một mục trong `items`, mỗi mục khai config cho từng
socket nó cắm được. Scene và hành động gọi
tên bằng `equip`: tên vật là mặc vào, `null` là để trống socket, `"base"` là về
đồ nền, socket không nhắc tới thì giữ nguyên. Cắm sẵn đồ vào `pieces` rồi cảnh
nào cũng gỡ ra, hay tách thành nhiều file nhân vật, đều là đi sai đường.

**Đổi chỗ một vật giữa chừng là đổi socket giữ nó.** Gài kính lên nẹp áo: một vật kính
khai cả `faceAcc` lẫn `neck`, rồi `keys[].equip` của hành động cho socket này `null` và socket
kia nhận vật. Lấy mẫu bậc thang như `keys[].face`,
nhưng **không đi qua `mask`** (mặc gì không phải khớp) và **không hoà** — và ở
scene nó là **công tắc**: thứ một clip ghi giữ nguyên qua clip sau, nhả track
không trả kính về mặt, tháo kính là một hành động khác nói ngược lại. Chỗ mở màn khai
ở `cast[].equip`, mốc đổi giữa cảnh là `clips[].equip` (một con số trong
scene, không phải một file hành động rỗng cho mỗi lần đổi); `outfits` chỉ là
cách viết gọn cho nhiều socket một lúc. Xem [01](01-rig.md) và [03](03-scene.md).

**Công tắc thì phải khai cả hai chiều, và chỉ một track được ghi một socket.** Hai
lỗi này không nổ ở đâu cả — hình chỉ thiếu: mốc `{ faceAcc: null }` ở `t: 0.45`
mà không có mốc bật ở `t: 0` là vật **không hiện ra ở frame nào**, vì `end` giữ
trạng thái mốc cuối sang lượt sau; và track sau đè track trước kể cả với `equip`,
nên cái tháo kính ở track trước bị track sau đè lại. `equipSwitchProblems` và
`sceneEquipProblems` của rig là chỗ chúng kêu — `stickman check` và `validate` gọi
vào đó.

## Hành động

**Hình dáng và chuyển động là hai file.** Nhân vật không mang tham số chu kỳ
đi; hành động không biết nhân vật nào. Muốn một nhân vật đi nhanh hơn thì thêm
`actions/walk-fast.json`, đừng nhét `walk` vào JSON nhân vật.

**Một file hành động có đúng một nguồn số: `gen` hoặc `keys`.** `gen` là bộ sinh
dựng sẵn trong rig (code, kèm bảng tham số), `keys` là
chuỗi mốc (data, người dùng soạn được). Ghép nhiều hành động cùng lúc là việc
của scene, không phải của file: mỗi hành động chỉ ghi những khớp trong `mask`
của nó, hành động sau **đè** hành động trước ở đúng những khớp ấy. Cộng góc lại
là khuỷu qua `0` thành gập ngược. Mốc ghi kênh mà
`mask` không gọi tên là giá trị vứt im lặng — `keys[].face` khai nụ cười mà `mask`
thiếu `face` thì không bao giờ cười; `maskProblems` kêu.

**Mốc `t: 0` là hình đầu tiên của hành động, không phải tư thế trước nó.** Vẫy tay
bắt đầu ở tay đã giơ; đoạn đưa tay lên là chỗ nối, thuộc về scene. Sampler *gán*
mốc `t: 0` chứ không tiến tới nó, nên mốc đầu ghi `idle` là cắt cứng **không**
frame khi clip trước để lại tay ở chỗ khác — `ease` không chữa được, nó chỉ ăn
bên trong đoạn giữa hai mốc. Scene nối bằng `blendPose` /
`blendDuration`, và phải suy đoạn hoà từ timeline chứ không nhớ tư thế lúc
chuyển — nhớ là Remotion seek sai. Mốc *cuối* thì ngược lại, cứ giữ: tay hạ
xuống sau khi vẫy là chuyển động có tác giả. Xem [01](01-rig.md).

**`head` đè theo từng góc, góc `null` là không ghi.** Hành động ghi `head: [10, 0, 0]` xoá cái
lắc của `turn-head-*` ở track khác dù chỉ định nghiêng đầu; hành động đầu khi nói ghi
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

**Người 3D chỉ đọc tay chân soạn ở `side`.** Sân khấu three vẽ kênh tay chân không có cờ nâng ở
dáng nghỉ, và cờ không hoà được: hoà giữa hành động `side` với hành động không soạn ở `side`, với clip rỗng hay
với tư thế nền là tay chân nhảy một khung giữa đoạn hoà — `check` báo lỗi hành động không soạn ở `side`, báo giật cho
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

**Mọi người trong `cast` là người 3D: `world` bắt buộc.** Người ấy suy chỗ đứng, cỡ và hướng từ
`scene.lens` mỗi khung. Cảnh có người mà thiếu `lens` là lỗi lúc nạp; `cast` rỗng là cảnh chỉ có nền,
lớp vẽ code và `fx`, khai `duration` vì không clip nào để suy. Người ngồi
thì `at` là **điểm trên mặt ngồi**, không phải hông: khai hông là người lún nửa bề dày đùi vào ghế.
Góc của kênh tay chân chỉ đọc 3D khi hành động khai `authoredAt: "side"`. [03](03-scene.md#người-3d)

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

**Chỗ vẽ hay đo người 3D gọi `sceneAt(rt, id, t, height, body3(nhân vật))`.** Bước chân của người
đi theo `path` nướng theo `height` và nửa khoảng hai gốc chân của tham số ấy; chỗ vẽ và chỗ đo truyền
khác nhau là bàn chân vẽ ra lệch khỏi chỗ đo, không gì báo. Pha của clip có sải chân ở người ấy chạy
theo đồng hồ riêng, không phải `(t − start) / cycle` — sự kiện hỏi qua `sceneEvents`, đừng tự giải
ngược. **Hông người đi theo `path` suy từ bàn chân, không phải nội suy mốc**: mốc giữa đường là đích
mềm, clip đi phải kết thúc từ nửa `cycle` trước tới một phần tư `cycle` sau mốc dừng (rig tự khép chân ở mốc) và clip ngồi
bắt đầu đúng mốc đứng trước mốc ngồi, nếu không người dừng lệch chỗ hay chân đứng sững — `check` kêu. [03](03-scene.md#đi-theo-path)

**Nhịp của clip khai bằng `cycle` hoặc `speed`, không cả hai.** `speed` là đơn vị
thế giới mỗi giây: rig lấy sải chân của chính hành động ở `height = 1`
(`actionStride`, đo bằng `bakeTravel`) nhân `world.s` của người rồi chia ra `cycle`. Hành động
không có sải chân thì không có `speed` — lỗi lúc nạp, không phải đứng im.

**Muốn biết một mốc trên người ở đâu trên khung thì gọi `anchorAt(rt, id, tên, t,
nhân_vật)`** — trả `{x, y, deg, w, h, flip}` trong đúng hệ toạ độ chỗ vẽ, cho hai
chục mốc khớp và mặt của người 3D (`ANCHOR_NAMES`; khớp cổ tên là `collar`). Từ MCP là `scene_probe` với `anchors: [...]`. Không tự chiếu khớp
người ra khung ở ngoài rig. Xem
[03 — Hỏi mốc trên người](03-scene.md#hỏi-mốc-trên-người).

**Cỡ khung là `scene.frame`, tra ở `FRAMES` của rig — `wide` cho tập, `tall` cho
short.** Hai khung cùng cao `720`, chỉ khác bề ngang (`1280` so
với `405`); bù lại bề ngang khung dọc chỉ hơn một sải chân `walk`. Cỡ khung đọc ở
`rt.frame` hay `cam.frame`, **đừng lấy hằng số** — lấy `SCENE_CANVAS` ở chỗ vẽ là short vẫn
ra hình ngang mà không gì báo. `bg[].scale` đo theo bề ngang khung, nên cùng một tấm nền ở
hai khung là hai số. Mọi shot của một tập phải cùng khung. Xem [03](03-scene.md#khung-hình).

**Khung là của camera trong scene, và chỉ có một hàm trả nó: `cameraAt(rt, t)`.**
`scene.camera[]` là chuỗi mốc `{t, x, y, zoom, move}`; `move` mặc định `cut` (giữ mốc
trước rồi nhảy) vì **mặc định là cắt, chạy máy chỉ khi cái chạy tự nó có nghĩa**. Mọi
đường render gọi chính hàm ấy — gõ `viewBox` bằng tay ở chỗ vẽ là tự tách mình ra
khỏi các đường kia. Camera nằm trong scene (chứ không ở tầng tập) để dải ảnh thấy đúng
khung. Soi bằng `stickman-render --scene …` hay `render_scene`.
Xem [03](03-scene.md#camera).

**Hiệu ứng là `scene.fx[]`, vẽ bằng `<SceneFx>` của `@stickman3d/fx`, và thuần theo
`t`.** Không trạng thái qua frame, không `Math.random`, nhiễu lấy ở `hash(i)`. Ba
lớp `back` / `front` / `ui` chèn ở đúng một chỗ, `<SceneWorld>` của `@stickman3d/fx`;
đường render nào cũng vẽ qua nó. Bám vào người qua
`sceneAnchor` (tức `anchorAt`); toạ độ cứng lấy từ `scene_probe`. Xem
[09](09-hieu-ung.md).

**Lớp vẽ code và `fx` xếp chung một trục `z`, chỉ trong `<SceneWorld>`.** `fx[].z` và
`z: { back, front }` của lớp vẽ code là chỗ trên trục ấy; bỏ trống thì `back` của lớp code
ở `SCENE_Z.fxBack`, `front` ở `SCENE_Z.fxFront`, `fx` theo băng của `layer` nó. Số nhỏ ở sau;
hoà thì lớp code trước `fx`, trong cùng loại giữ thứ tự mảng. Nền chưa vào trục — băng `bg`
là chỗ `bgOrder` xếp các lớp nền với nhau. Xem [03](03-scene.md#trục-z).

**Thời gian trong scene viết được `"@mốc+0.4"` theo `scene.marks`, và JSON giữ nguyên
tham chiếu.** Chỉ `resolveScene` (qua `unmarkScene`) mới ra số; đọc `SceneData` thô
rồi làm toán trên `start` / `t` là gặp chuỗi. Thời điểm mà tiếng, hình và lớp vẽ code
cùng khớp thì đặt một mốc, đừng chép cùng một số ra ba chỗ — `stickman retime` chỉ dời
được mốc. Xem [03](03-scene.md#mốc-có-tên).

**Nền là `scene.bg[]`, một mảng lớp** (ảnh trong `assets/bg/`): thứ tự vẽ lấy ở `bgOrder()`, các ô
vẽ của một lớp ở `bgTiles(lớp, cam)`, `aspect` **đo từng file một** ở mọi đường render.
**Hộp nền phụ thuộc mốc camera** vì `bg[].parallax` trôi lớp ấy theo máy
quay (`1` là dán vào sân khấu, `0` là đứng im trên màn hình); nhớ hộp lại giữa các khung
hay tự cộng phần trôi ở chỗ vẽ là mỗi đường render ra một khung khác. **Số ô của `bg[].repeat`
cũng suy từ hộp camera, và chỉ suy ở `bgTiles`** — đường render nào tự nhân ô ra hai bên là
tự tách khỏi các đường kia; `tiles` chỉ là chặn trên, không phải số ô người dùng đếm. Cả chồng
nền vẽ trước lớp code và `fx` nên `z` của lớp nền chỉ sắp các lớp nền với
nhau — khai ra khỏi băng nền là im lặng không có gì đổi.

## Tập

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
  gọi bốn móc (`bg`, `back`, `front`, `shake`) và chèn ba lớp `fx`. Tự
  gọi từng móc ở chỗ khác là thiếu một chỗ mà không có gì báo.
- Lớp không được `import` Remotion: `stickman-render` và MCP gọi nó ngoài
  Remotion. Giây vào bằng `ctx.t`, khung camera bằng `ctx.cam`.
- Đồ khối nhớ theo **object món**: sửa thẳng `parts` hay một `Part` của món đã vẽ
  thì hình giữ khối cũ, không có gì báo. Đổi hình thì tạo món hay mảng `parts`
  mới — docs/10 § Đồ khối.
- Khối của `lathe` mang viền tính cho **một** ống kính và một chỗ đặt: dùng lại cho ống
  kính khác, `at` khác hay `tilt` khác thì viền lệch khỏi mép, không có gì báo. Đổi một
  trong ba thì dựng lại — docs/10 § Khối tròn xoay.

## Ràng buộc hình ảnh

- Giữ vai ở `±shoulderHalf` (người 3D: trên viền áo), hông ở `±hipHalf`; đổi bề
  ngang hông thì chỉnh lại góc chân trong `POSES`.
- Thân áo chỉ có một đường: [thân áo dựng khối](12-trang-phuc-3d.md#thân-áo-dựng-khối) theo
  bảng `GARMENT_STYLES`; đừng dựng khối thân riêng ngoài bảng ấy.
- Khuỷu của chu kỳ đi không được âm.
- Áo không tô tối hơn chừng `#5b5f7d`: tay nét `#1a1a1a` đứng trước thân áo sẽ mất.
