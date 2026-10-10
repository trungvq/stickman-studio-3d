# 09 — Hiệu ứng

`@stickman3d/fx`: hào quang, nước mắt, sủi tăm, vật rời tay, lá bay, chữ diễn, nút
điều khiển, iris, bong bóng thoại, thẻ chữ gõ, ngày đêm trôi. Khai trong `scene.fx[]`, rig chỉ mang danh sách theo; gói này
kiểm (`parseFx`) và vẽ (`<SceneFx>`). Cả ba đường render — dải khung `--stage`,
`stickman-video`, app Remotion — gọi cùng một component, nên thứ agent soi bằng ảnh
là thứ khán giả thấy.

## Hợp đồng: thuần theo `t`

Mọi hiệu ứng là hàm của giây scene `t`. Không có trạng thái sống qua frame, không
`Math.random`, không tích luỹ: seek tới frame nào cũng ra đúng hình ấy, ba đường
render cùng một khung. Nhiễu lấy ở `hash(i)` — cùng số thứ tự luôn ra cùng số;
hai lớp cần khác nhịp thì khác `seed`. Cái gì "sinh ra rồi sống một đời" (giọt,
bong bóng) tính theo công thức *phần tử thứ `i` sinh ở `from + i × every`*, rồi
mỗi frame chỉ duyệt những phần tử còn sống.

## Hình dạng JSON

```json
"fx": [
  { "kind": "glow", "x": -120, "y": 260, "from": 1.6, "to": 10.4, "rise": 1.3, "fall": 2.6,
    "r": 132, "ray": 300, "rays": 14, "spin": 11, "up": 1 },
  { "kind": "throw", "part": "gold-bar", "t0": 8.97, "flight": 1.5,
    "x0": -527, "y0": 120, "vx": 667, "vy": -1092, "g": 1567, "deg0": -276, "spin": 600,
    "w": 40, "h": 104, "shrink": 0.13, "splash": 0.35, "ripple": 1 },
  { "kind": "tears", "cast": "tp", "from": 10.15, "to": 13.8 },
  { "kind": "caption", "lines": [{ "text": "KHÔNG PHẢI.", "at": 13.68 }],
    "x": -330, "y": 115, "align": "middle", "size": 46, "tilt": -2, "until": 15.3 },
  { "kind": "iris", "x": 0, "y": 41, "from": 18.2, "to": 19.4, "r": 80, "close": 21.05 },
  { "kind": "bubble", "cast": "anh", "anchor": "head", "dx": -40, "dy": -60,
    "open": "@ke", "shut": "@ke-xong", "box": { "dx": -180, "dy": -200, "w": 400, "h": 145 },
    "items": [
      { "part": "gold-bar", "x": -120, "w": 70, "h": 105, "at": "@ke+0.2" },
      { "text": "=", "size": 70, "at": "@ke+0.6" },
      { "text": "$$$", "x": 120, "size": 50, "fill": "#c98a1b", "at": "@ke+1" }
    ] },
  { "kind": "bubble", "style": "shout", "cast": "em", "dx": -40, "dy": -60, "open": 15.9, "shut": 18.9,
    "box": { "dx": -250, "dy": -215, "w": 352, "h": 168 }, "grawlix": {} },
  { "kind": "typewriter", "frame": "camera", "text": "1 NĂM SAU", "from": 0, "until": 2.2,
    "size": 130, "bg": "#f4f1e8", "shadow": "#c9bb98" },
  { "kind": "dayNight", "from": 0.9, "to": 4.7, "days": 2,
    "x0": -560, "y0": -170, "x1": 40, "y1": -170, "arc": -150 }
]
```

Mọi mốc là **giây scene**, mọi toạ độ là **hệ toạ độ scene** (cùng hệ `cast[].x`),
trừ chỗ ghi rõ đơn vị nhân vật. Mọi `kind` nhận bốn trường chung:

| | |
|---|---|
| `layer` | `back` / `front` / `ui`, mặc định theo `kind` (bảng dưới) |
| `z` | nấc trên trục chung với người, đạo cụ, động vật ([03](03-scene.md#trục-z)); bỏ trống là băng của `layer` |
| `frame` | `stage` (mặc định) hay `camera`: gốc toạ độ ở **tâm khung máy quay** tại `t`, mục lia theo máy — mưa, bụi, chữ dán lên kính. `(0, 0)` là giữa màn hình, không đổi theo `zoom` |
| `clip` | `name` của một mục `kind: "clip"` cùng cảnh: mục này chỉ vẽ trong hình ấy. Hình cắt khai ở hệ sân khấu, không trôi theo mục `frame: "camera"` | Bảng đầy đủ từng trường nằm trong zod của
`packages/fx/src/schema.ts` (MCP: `schema`), đây chỉ là nghĩa và bẫy.

| `kind` | Là gì | Lớp mặc định |
|---|---|---|
| `clip` | Hình cắt dùng chung, không vẽ gì: `name` cộng `rect: { x, y, w, h }` hay `path` (chuỗi `d`). Mục khác trỏ `clip: name` — hai mục cùng nằm gọn trong một cửa sổ mà không chép hình cắt hai lần. `frame: "camera"` thì hình cắt lia theo máy | `back` |
| `glow` | Hào quang. `style: "rays"` cho nguồn sáng ở **một chỗ** (quầng + nan tia + vũng sáng dẹt); `"sparkle"` cho **một vật đang cầm** (vành khuyên + sao nhỏ chớp lệch pha). `up: 1` dồn tia lên trên — nguồn dưới mặt nước không chiếu xuống đáy | `back` |
| `tears` | Nước mắt bắn hai bên, bám **đúng con mắt** của `cast` qua `anchorAt`, tính lại theo lúc từng giọt sinh ra. `dx`/`dy`/`vx`/`vy`/`r` là đơn vị nhân vật, nhân `scale` lúc vẽ | `front` |
| `fizz` | Sủi tăm quanh `(x, y)`. `from` âm là đã sủi từ trước khi cảnh mở; `thin` là giây bắt đầu thưa dần | `front` |
| `throw` | Vật rời tay bay parabol, xoay, chạm rồi tóe (`splash`) và loang sóng (`ripple`); `0` là không có mặt nước. `throwLanding(fx)` trả điểm và giây chạm để bọt, hào quang, tiếng tõm cùng trỏ một chỗ | `front` |
| `fly` | Vật bay có phép giữa hai bàn tay theo cung `arc`, kèm vành sáng; cỡ và góc nội suy giữa hai đầu | `front` |
| `pausedThrow` | Vật bay theo cung rồi **đứng hình** trong `hold`, bay tiếp, chạm và loé; `bounce` là bật ra khỏi khung | `front` |
| `gust` | Cơn gió: vệt gió rời chạy thẳng, lá đi theo đường ba đoạn (cung vào, một vòng tròn bán kính `r` trên điểm `lx/ly`, cung ra). Lá không tự xoay — mũi lá theo tiếp tuyến | `front` |
| `caption` | Chữ diễn burn lên hình, `lines[]` hiện dần; `blow` là bị thổi bay thay vì tắt. `size` là đơn vị scene ở zoom 1 | `front` |
| `buttons` | Nút PAUSE / PLAY loé lên rồi tắt ở `presses[]`; có `cursor` là con trỏ chuột trượt tới rồi click | `ui` |
| `iris` | Iris khép: thu từ ngoài khung về `r` quanh `(x, y)` trong `from → to`, giữ tới `close`, đóng hẳn trong `shut` | `ui` |
| `bubble` | Bong bóng thoại giấy viền mực, không đổ bóng — nó nằm trong cảnh, không dán trên giấy. `style`: `speech` (đuôi cong nhọn, `curl: 0` là thẳng), `thought` (bọt dẹt to dần về phía thân thay đuôi), `shout` (viền răng cưa một đường kín, đuôi là một răng kéo dài, phập phồng và rung). `shape` là thân của hai kiểu đầu: `round` (bo góc `r`; `r` từ nửa cạnh ngắn là viên thuốc, hộp vuông thành tròn), `oval`, `cloud` — mặc định `round` cho `speech`, `cloud` cho `thought`. `width: 0` là mảng phẳng không viền. Bật ra ở `open`, co lại trước `shut`; `items[]` là ảnh trong `pieces/`, bộ phận `PARTS` hay chữ, mỗi món bật ra ở `at` riêng; `grawlix` là dãy `#%&$¥€` đổi mặt mỗi `every` giây | `front` |
| `typewriter` | Thẻ chữ gõ dần: hiện ở `from`, mỗi phím một ký tự (hay `keys[]` đích danh, gõ kiểu Telex), con trỏ đứng yên lúc gõ rồi nhấp nháy; `bg` là nền kín khung. `typewriterKeys(fx)` trả giây từng phím để tầng tập neo tiếng gõ | `front` |
| `dayNight` | Ngày đêm trôi `days` vòng trong `from → to`: mặt trời đi cung `(x0, y0) → (x1, y1)` vồng `arc`, chạng vạng thì trời sập tối phủ cả khung, trăng lưỡi liềm và sao đi nửa đêm | `front` |

## Ba lớp, ba chỗ chèn

`layer` là `back` (trước cả cast), `front` (sau cast, trước UI) hay `ui` (trên tất
cả) — ba băng `-500` / `500` / `1000` trên trục `z` của cảnh. Muốn hào quang quanh
vật cầm tay nằm **trước** người thì đổi `layer` của mục đó; muốn nó chen vào
**giữa** hai người thì khai `z` — không đổi thứ tự vẽ ở chỗ render.

Chỗ chèn chỉ có một: `<SceneWorld>` của gói này — render, MCP và `Scene.tsx` của
scaffold đều vẽ qua nó. Đường render mới cũng vẽ bằng nó, đừng tự chèn từng lớp.

Cái gì không có `kind`, hoặc cần thứ `SceneFx` không nhận — vẽ cả bối cảnh, rung
cả khung, đẩy chỗ đứng của người / thú / đạo cụ — thì là **lớp vẽ code** của repo
video, xem [docs/10](10-lop-ve-code.md).

## Bám vào người: `anchor`

`tears` cần biết con mắt ở đâu, `bubble` có `cast` cần biết mũi đuôi chĩa vào đâu.
`<SceneFx anchor>` nhận `FxAnchor` — dựng bằng `sceneAnchor(rt, characterOf)`, bên
trong gọi `anchorAt` (người) hay `animalAnchorAt` (id trong `animals[]`) của rig và
kèm `scale` của nó. Đây là đường duy nhất; không chép chuỗi biến hình của
`<Character>`.

Mũi đuôi `bubble` là mốc `anchor` (mặc định `head`; con vật thì `muzzle`, `poll`…)
cộng `dx` / `dy` đơn vị nhân vật, đọc **một lần lúc `open`** để bong bóng đứng yên
khi đầu gật; `follow: true` thì đọc mỗi frame. Tên mốc sai loại (`head` cho con vật)
là lỗi lúc vẽ. Không có `cast` thì khai `tip: { x, y }` toạ độ scene.

Các hiệu ứng khác khai toạ độ cứng: lấy số bằng `scene_probe` với
`anchors: ["handNear"]` đúng frame rời tay (`x0`/`y0`/`deg0` của `throw` là tâm
và góc SVG của mốc ấy), không đọc bằng mắt và không render hai lượt trừ ảnh.

## Ảnh của vật rời tay

`throw` / `fly` / `pausedThrow` và món của `bubble` chọn đúng một nguồn:
`piece` là file trong `pieces/`, hoặc `part` là tên có trong `PARTS` (ví dụ
`gold-bar`). Món bong bóng cũng nhận `text`, không khai cùng nguồn hình.
Cả hai nguồn hình vừa khung `w`/`h` và giữ tỉ lệ; `fly` dùng `w0`/`h0`,
`w1`/`h1`. Bộ phận dùng màu mặc định trắng, nét `#1a1a1a`, độ dày `6`;
châu báu và rổ giữ bảng màu riêng.
`fxFiles(fx)` liệt kê chúng; chỗ render gom `urls` từ đó — render qua
`mountPiece`, Remotion qua `pieceUrl` của `data.ts`. `stickman check` báo file
thiếu ở cả hai lớp mảnh. Mốc `t0` phải khớp mốc `equip` tắt socket ấy: sai một
nhịp là hai cái rìu hoặc không cái nào.

## Bong bóng trong lớp vẽ code

Món vẽ bằng code không khai được trong JSON, nhưng khung thì không phải chép lại:
`<Bubble>` là chính component mục `bubble` vẽ bằng, nhận `children` gốc ở tâm hộp,
và `<Pop t at x y scale>` bật từng món ra như `items[]`.

```tsx
import { Bubble, Pop } from "@stickman3d/fx";

front: ({ t, marks, cam }) => (
  <Bubble t={t} open={marks["ke"]} shut={marks["ke-xong"]} zoom={cam.zoom}
    tip={{ x: -120, y: 30 }} box={{ dx: -60, dy: -160, w: 400, h: 145 }}>
    <Pop t={t} at={marks["ke"] + 0.2} x={-120}><CaiRiu /></Pop>
    <Pop t={t} at={marks["ke"] + 0.6} scale={1.3}><DauBang /></Pop>
  </Bubble>
),
```

`bubbleScale(t, open, shut)` và `popScale(t, at)` là hai đường cong ấy dạng số, cho
thứ tự vẽ riêng mà vẫn mở / tan cùng nhịp.

Đầu thật của nhân vật trong bong bóng hay trên slide giải thích là `<ChanDung>` của app Remotion
(`src/khoi3d/ChanDung.tsx`): chân dung người 3D chụp lúc chạy, nền trong suốt
([01](01-rig.md#chân-dung)).

```tsx
<Pop t={t} at={marks["ke"]}><ChanDung character="haru.json" x={0} y={0} r={60} round shot={{ frame: "bust", yaw: 20 }} /></Pop>
```

## Tiếng theo hình: mốc tính từ JSON

Hiệu ứng không phát tiếng; tầng tập neo tiếng vào mốc do chính gói này tính từ JSON,
để hình và tiếng không lệch khi sửa một bên: `throwLanding(fx)` cho tiếng tõm,
`typewriterKeys(fx)` cho từng tiếng phím (`[{ t, text }]`, giây scene).

## Bẫy

- **Vành khuyên, không phải quầng đặc** quanh vật đang cầm: đậm nhất ở lưng
  chừng bán kính, giữa để trống. Quầng đặc tẩy trắng đúng cái vật cú cận dựng ra
  để nhìn. `sparkle` và vành sáng của `fly` đều thế.
- **Kiểu `rays` không dùng ở cỡ cận.** Nan tia dài `ray` đơn vị scene, ở zoom 3–4×
  là nửa khung; hào quang cầm tay phải gọn trong lòng bàn tay, sáng bằng độ chói
  và nhịp chớp — đó là `sparkle`.
- **Chữ chia cho zoom.** `caption` nằm trong `viewBox` nên bám nhân vật khi máy
  quay phóng; `<SceneFx zoom>` nhận `cameraAt(rt, t).zoom`, quên là chữ tự to
  gấp mấy lần.
- **`from` âm cho thứ phải có sẵn ở frame đầu.** Bọt đã sủi từ cảnh trước thì
  `from: -1`; để `0` là mặt nước trống rồi bọt lục tục nổi lên đúng chỗ cắt.
- **Mốc bám lời thì đo, không gõ.** `at` của chữ, `from` của hào quang bám câu
  thoại lấy từ `silencedetect` trên chính file tiếng ([07](07-lam-tap.md#lời-dẫn)).
- **Bong bóng chia zoom quanh mũi đuôi.** `box`, `items`, nét viền đều là đơn vị scene
  ở zoom 1, như `size` của `caption`: máy quay cắt vào cận mặt thì cả bong bóng thu
  về phía mũi, cỡ trên màn hình giữ nguyên. Hộp vì thế khai **tính từ mũi**
  (`box.dx` / `box.dy`), không phải toạ độ scene; `items[].x` / `y` tính từ tâm hộp.
- **Đuôi tự chọn cạnh.** Chân đuôi `speech` nằm trên cạnh hộp gần mũi nhất, trượt
  theo mũi nhưng không lấn vào góc bo; mũi nằm trong hộp là không có đuôi. Muốn đuôi
  xuôi xuống thì đặt hộp cao hơn mũi, đừng đẩy hộp sang ngang. Bụng đuôi cong quay về
  phía tâm hộp.
- **Chừa chỗ cho bọt `thought`.** Bọt là elip dẹt nằm ngang, cỡ theo cạnh ngắn của
  hộp, to nhất sát thân và cách nhau rõ; không đủ chỗ tới mũi thì bớt bọt nhỏ chứ không
  bóp cả chuỗi. Muốn đủ `dots` bọt thì đẩy hộp xa mũi.
- **`box` là chỗ của ruột, thân bọc ra ngoài.** `round` khít `box`; `oval` phình
  `1,2 ×`, `cloud` đặt hõm giữa các vòm lên cạnh `box` và cho vòm mọc ra ngoài — nên
  cùng một `box` thì mây và elip to hơn hộp trên màn hình. Ruột sát góc `box` vẫn có thể
  chạm viền `oval`.
- **Dãy `grawlix` phải lọt hõm răng cưa.** Hõm hẹp nhất cách tâm chừng `0,74 × w / 2`;
  nửa bề ngang dãy là `(count − 1) × gap / 2` cộng nửa ký tự rộng nhất. Hộp hẹp thì
  bớt `count`, không thì `&` và `@` đội ra ngoài viền.
- **Chữ bắt đầu bằng `@` là mốc.** `text` của `items[]` hay `typewriter` viết
  `"@ten"` thì bị đọc thành tham chiếu `marks` ([03](03-scene.md#mốc-có-tên)).
- **`typewriter` giữ cả dòng.** Phần chưa gõ vẫn nằm trong dòng, tô trong suốt, nên
  chữ không xô khi dài ra và con trỏ đứng đúng sau chữ cuối mà không đo font. `keys[]`
  thì chữ của phím cuối phải là `text`, không thì dòng xếp theo một chuỗi khác chữ
  hiện ra.
- **Màn đêm và nền thẻ phủ cả khung.** `dayNight` ở `front` tối cả người; muốn người
  sáng thì đặt `z` dưới dàn diễn, hay cắt bằng `clip`.
- **Nút và iris là UI**: vẽ phẳng, không nét mực, không đổ bóng, chỉ loé rồi tắt.
  Trạng thái "đang dừng" do cảnh đứng im nói hộ, không phải icon treo suốt.
