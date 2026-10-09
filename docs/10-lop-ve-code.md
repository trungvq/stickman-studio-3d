# 10 — Lớp vẽ code

Bối cảnh vẽ bằng code thay cho tấm nền, cú rung máy, và phép đẩy chỗ đứng của
người / thú / đạo cụ. Repo video giữ mã ấy; hợp đồng (`CodeLayer`, `LayerCtx`,
`Offset`) và chỗ gọi năm móc là **`<SceneWorld>` của `@stickman3d/fx`** — dải khung
`--stage`, `stickman-video`, MCP và `Scene.tsx` của app Remotion cùng vẽ bằng nó.

## Ranh giới với `scene.fx`

`scene.fx` là catalog đóng của `@stickman3d/fx`: khai bằng JSON, mười ba `kind`, agent
sửa được bằng `patch`. Đó là chỗ mặc định.

Lớp vẽ code là chỗ cho ba thứ `SceneFx` **không làm được**, vì fx chỉ vẽ, không
được sờ vào `sceneAt` / `propAt` / `animalAt` và không được bọc `<svg>`:

| | |
|---|---|
| `bg` | tự vẽ CẢ bối cảnh, thay cả chồng `scene.bg[]`, tắt luôn vạch đất |
| `shake` | bọc cả khung, nền và người cùng xê dịch |
| `place` | đẩy chỗ đứng: người đứng trên mặt nước đang dâng, cây dâng cùng núi |

`back` và `front` chỉ là chỗ vẽ thêm quanh dàn diễn — thứ khai được bằng `fx` thì
khai ở `fx`. Bong bóng thoại chứa icon vẽ code thì dựng bằng `<Bubble>` / `<Pop>` của
gói, không chép lại khung ([09](09-hieu-ung.md#bong-bóng-trong-lớp-vẽ-code)).

## Khai một lớp

`package.json` của repo video trỏ tới entry (`stickman init` đã trỏ sẵn
`src/lop.tsx`):

```json
"stickman": { "layers": "src/lop.tsx" }
```

Entry `export const CODE_LAYERS: CodeLayer[]` là **mảng lớp, và thứ tự mảng là
thứ tự vẽ**:

```tsx
import type { CodeLayer } from "@stickman3d/fx";

export const CODE_LAYERS: CodeLayer[] = [
  {
    name: "tran-lu",
    scenes: new Set(["canh-04-lu", "canh-05-nui"]),
    bg: ({ t }) => <TranLuNen t={t} />,
    front: ({ t }) => <TranLuTruoc t={t} />,
    place: ({ t }, id, spot) => (id === "st" ? { dx: 0, dy: mucNuoc(t) } : null),
  },
];
```

| trường | |
|---|---|
| `name` | để đọc lỗi và làm `key` của React |
| `scenes` | `Set` hay mảng **tên cảnh** bật lớp này |
| `z` | `{ back?, front? }` — nấc của hai móc trên trục `z` của cảnh; bỏ trống là `-500` / `500`, tức băng `fx` cùng tên |
| `bg(ctx)` | vẽ cả bối cảnh. Nhiều lớp cùng khai thì lớp đứng trước thắng |
| `back(ctx)` | vẽ ở `z.back`: mặc định sau nền, **trước** `fx` lớp `back` |
| `front(ctx)` | vẽ ở `z.front`: mặc định sau dàn diễn, **trước** `fx` lớp `front` |
| `shake(ctx)` | `{dx, dy}` hay `null`. Nhiều lớp thì cộng dồn |
| `place(ctx, id, spot)` | phần lệch của một `id`, hay `null` |

`ctx` là `LayerCtx` `{ name, t, cam, marks, url, lens, anchor }`: tên cảnh, giây scene,
khung camera tại giây ấy (`cameraAt`), bảng `scene.marks`, `url(file)` trả ảnh của một
file trong `pieces/`, ống kính 3D nếu cảnh có, và `anchor(cast, mốc, t)` — mốc trên người
hay thú như `fx` bám ([09](09-hieu-ung.md#bám-vào-người-anchor)), `null` khi không có ai
tên ấy. Component nằm sâu không cầm `ctx` thì đọc cùng hàm ấy qua context `SceneAnchor`
của `@stickman3d/fx`; `<SceneWorld>` cấp nó ở mọi đường vẽ, cảnh lồng trong cảnh thì cảnh
trong cấp của nó. **Lấy ảnh qua `url`**, đừng import thẳng — mỗi đường render
nhúng ảnh một kiểu. **Neo thời gian vào `marks`** (`const t0 = marks["nui-dang"]`),
đừng ghim số: `stickman retime` dời mốc thì lớp đi theo, số ghim thì không
([03](03-scene.md#mốc-có-tên)).

`spot` là `Spot` `{ x, groundY }` mà `sceneAt` / `propAt` / `animalAt` vừa trả.
`place` trả `Offset` `{ dx, dy, spin?, ring? }`:

- `spin: { deg, x, y }` nghiêng **cả người** quanh một điểm sân khấu — người ngã,
  người bị hất văng. Bọc ngoài `<Character>`, không phải một khớp gập lại. Tâm
  quay lớp tự chọn, thường là hông, hỏi `anchorAt`. `anchorAt` không biết phần
  nghiêng này; người nằm yên cả cảnh thì khai `cast[].rotate`
  ([03](03-scene.md#nằm-và-xoay-cả-người)), mốc đo ra đúng người nằm.
- `ring(feet, scale)` vẽ thêm quanh hai bàn chân — vòng sóng ôm chân người đứng
  trên nước. `feet` là `[footNear, footFar]` **đã cộng phần lệch**.
- `spin` và `ring` chỉ có ở người; đạo cụ và động vật chỉ nhận `dx` / `dy`.
- Người 3D (`cast[].world` trong cảnh có `lens`) không qua `place`: chỗ đứng của họ ở thế
  giới, đẩy trên mặt khung là tách họ khỏi đồ khối che họ. Dời họ bằng `world.at` / `world.path`.

Mỗi lớp thấy `spot` đã cộng phần lệch của lớp trước, và cộng thẳng vào chính
object ấy — `sceneAt` và bạn trả object mới mỗi lượt gọi nên sửa được.

## Hợp đồng: thuần theo `t`

Như `@stickman3d/fx` (docs/09): không trạng thái sống qua frame, không
`Math.random`, không đọc đồng hồ. Seek tới khung nào cũng ra đúng hình ấy.

**Không `import` Remotion.** `stickman-render` và MCP gọi lớp ngoài Remotion nên
`useCurrentFrame` không tồn tại ở đó; bundler chặn thẳng lúc gói. Giây vào bằng
`ctx.t`, khung camera bằng `ctx.cam`.

`react`, `@stickman3d/sketch` và `@stickman3d/fx` dùng chung với chỗ render, không gói
lại. Mọi thứ còn lại — module nội bộ, ảnh import thẳng — gói vào bundle. Bundle
dựng lại khi file nguồn đổi, nên vòng sửa → soi không phải khởi động lại MCP.

## Thứ tự vẽ

`<SceneWorld>` vẽ, dưới lên, trong `<svg viewBox={cam.viewBox}>`:

```
shake  ┬ bg của lớp  (hay các lớp scene.bg[] theo bgOrder, hay vạch đất)
       └ một trục z chung, tăng dần:
           back / front của từng lớp   ở z.back / z.front   (mặc định −500 / 500)
           mỗi mục fx                  ở fx.z               (mặc định băng của layer)
           dàn diễn theo sceneOrder    ở z của mục, mỗi mục qua place
```

Hoà `z` thì lớp vẽ code trước, rồi `fx`, rồi dàn diễn; trong cùng loại giữ thứ tự
mảng. Hai lớp cùng bật trong một cảnh xếp ngược nhau được bằng `z` — không cần
đảo `CODE_LAYERS`. Xem [03 — Trục z](03-scene.md#trục-z).

`shake` bọc tất cả, kể cả nền: `viewBox` vẫn là của `cameraAt`, cú rung không
phải chuyện của camera trong scene.

## Đồ khối

Cảnh có `scene.lens` thì lớp khai được `solids: (ctx) => SolidItem[]`: mỗi món là vài khối lồi tám
đỉnh (`Part`: bốn đỉnh đáy theo vòng rồi bốn đỉnh trên; `box`, `bar`, `slab` dựng sẵn, `lathe`
dựng cả món [tròn xoay](#khối-tròn-xoay)) trong toạ độ của món, đặt bằng `at: { at, yaw, s }`
(`place3`), nét viền `sw` (mặc định 3 nhân cỡ món tại gốc), màu nét `ink`, tên `name` cho báo cáo của
`check` và `touch` là phần người được phép lấn vào món ([Người lồng vào đồ](#người-lồng-vào-đồ)).
`ctx.lens` là ống kính của cảnh. Mặt khối một màu phẳng theo pháp tuyến: ngửa lên lấy `tone.top`, mặt đứng quay về trái
khung lấy `tone.lit`, còn lại `tone.side`; `marks` là vân vẽ trên một mặt.

`<SceneWorld>` gom đồ của mọi lớp bật và khối từng phần của người 3D ([03](03-scene.md#người-3d))
rồi vẽ bằng `<SolidWorld lens furniture people>` (người là `solidFigure(id, props của <Character>)`;
`@stickman3d/render` vẽ người ngồi một mình trên ghế cũng bằng nó), `solidOrder` sắp chung mỗi khung:

- Hai khối lồi rời nhau (hay áp mặt) thì một mặt của khối này để cả khối kia ở phía ngoài; mắt cùng
  phía ấy thì khối kia gần hơn. Hai mặt tách cho hai kết luận ngược nhau là hai khối không che nhau.
- Mảnh đồ không tách được với một phần người thì chặt theo mặt phẳng đứng qua tâm phần ấy, vuông góc
  với tia nhìn tới nó. Hai bóng chỉ chồng nhau khi chồng nhau thật trên khung (trục tách bỏ cạnh bóng
  dài gần bằng không). Đáy khối ống chân gần đứng nằm ngang đúng cao độ bàn chân, nên người đứng trên
  mặt sàn khối tách được với sàn ở mọi bước chân, sàn không bị chặt quanh chân.
- Trong một người: đầu luôn trên thân (lượt thân mang cả mảng tóc sau). Đoạn tay giữ góc 2D
  (`fig3.flat`) nằm phẳng ở độ sâu vai, nên nó với đầu và với nhau theo thứ tự vẽ 2D (`drawSteps`, tức
  lớp tay): tay `front` che mặt. Đoạn tay 3D với thân không qua phép che (cánh tay mọc từ vai trong khối
  thân, tách được hay không đổi theo từng độ nghiêng), mà theo **phần trục của nó nằm trong bóng khối
  thân** trên khung: phần trước chỗ tia nhìn vào khối là trước, phần sau chỗ tia ra là sau. Điểm lọt
  trong khối (tay xuyên thân — hộp nhô ra ngoài thân vẽ ra ở bốn góc, tay ấy thường nằm sát mặt ngoài)
  là trước khi mặt khối gần nó nhất quay ra mắt, hay nó nằm nửa gần của dây cung tia cắt khối: tay
  khoanh, cầm sổ sát ngực nằm trên thân, tay sát lưng nằm dưới khi nhìn từ trước. Cẳng tay có cổ tay
  hẳn trước hay hẳn sau khối thì theo phía cổ tay — bàn tay và đồ đang cầm phải đúng chỗ. Còn lại hai
  phía đo bằng độ dài trên khung; một phía dài hơn gấp đôi phía kia (`ARM_SIDE`) thì cả đoạn trên hay
  dưới thân theo phía ấy, bất kể lớp — gốc tay xa sau vai còn khuỷu chìa ra ngoài bóng thân thì dưới
  thân; không phía nào trội, hay đoạn không chồng bóng thân, thì theo lớp tay. Đoạn tay đã xếp sau thân
  thì cạnh của nó với đồ là luật quy ước: vòng gốc tay sau thân, thân sau bàn, khuỷu trên mặt bàn bỏ
  cạnh tay–bàn, tay không bị kéo lên đè thân. Còn lại hai phần xuyên nhau ở khớp thì đầu đè mọi phần
  trừ cẳng tay 3D thật; thân với chi (gốc chi nằm trong khối thân) theo thứ tự vẽ 2D, lấy lượt thân
  áo, cánh tay trên theo lượt sau hơn của nó và cẳng tay — thân đè chân, tay xa `back` dưới thân, tay
  `mid` / `front` trên thân; ngoài ra theo độ sâu tâm. Tóc và tà áo vẽ ra rộng hơn khối đầu, khối
  thân, nên thân và đầu có thứ tự với mọi phần cùng người kể cả khi hai khối không chồng nhau trên
  khung — cặp ấy chỉ theo các luật quy ước trên, không qua phép che.
- Vòng (khối đan nhau) chỉ phá trong một vòng nguồn — thành phần liên thông mạnh không còn chờ nút
  nào ngoài nó —, không bao giờ rút trước một nút chỉ đang chờ vòng ở chỗ khác. Trong vòng ấy bỏ cạnh
  của luật quy ước trước (lớp tay, thứ tự vẽ 2D, độ sâu tâm, đầu đè phần khác, người với người, tay sau
  thân với đồ), còn vòng thì vẽ trước nút xa mắt nhất của vòng.
- **Váy trên đùi** (`lap`, chỉ người ngồi mặc [váy dựng khối](02-trang-phuc.md#váy-dựng-khối)): phần
  váy phủ đùi trước mặt trước khối thân có khối riêng (`fig3.lap`) — lăng trụ từ mặt trước khối thân tới
  mút phần váy phủ đùi, đáy là mặt dưới đùi, đỉnh dốc từ cạp xuống mặt trên đùi. Nó xếp với đồ khối và
  người khác bằng khối ấy (không chặt mảnh đồ), với phần cùng người y như thân, với thân theo lớp `hem`.
  Sắp xong thứ tự không có nó rồi mới chèn nó vào chỗ hợp mọi cạnh, gần thân nhất, nên phần khác giữ
  nguyên thứ tự; chèn không được thì sắp lại cả nó. Chỉ khi một thứ chồng lên vùng nó vẽ nằm giữa nó với
  thân thì váy mới tách hai lượt — lượt `lap` vẽ vùng đã chiếu của khối (thêm gấu rủ, nét viền), lượt
  thân vẽ phần còn lại, ranh giới bằng mặt nạ; không thì thân vẽ cả váy như người không tách. Bàn che
  đùi thì che được váy trên đùi, cạp vẫn theo thân.

Không luật riêng nào cho mặt ngồi hay mặt bàn: người ngồi có mông và đùi nằm trên mặt ngồi, tay đặt
lên bàn có cẳng tay trên mặt bàn (`world.hands` đặt bằng `handsOn`, [03](03-scene.md#đích-bàn-tay-thế-giới)),
nên hình học tự xếp đúng. Người lồng vào khối đồ thì hình sai mà không gì chặn lúc vẽ —
[Người lồng vào đồ](#người-lồng-vào-đồ). Bóng đồ trên sàn vẽ ở `bg` của lớp.

Phần chỉ phụ thuộc ống kính và món được nhớ, mỗi khung chỉ tính phần dính tới người:

- **Theo món** (`WeakMap` khoá bằng object `SolidItem`): khối đã đặt và đã giấu mặt áp kín, khung bao
  của cả món. Dùng lại khi ống kính và `at` cùng giá trị, `parts`, `sw`, `ink` cùng tham chiếu.
- **Theo cặp món**: cạnh của đồ thị thứ tự giữa hai khối đồ, kể cả hai khối cùng món.
- **Theo khối** (`Solid`): bóng lồi trên khung, và phần tử `<path>` của `SolidPaths` (khoá thêm
  `ink`).

Mỗi khung còn lại: đoạn người nào chặt mảnh đồ nào, cạnh của mảnh bị chặt và của phần người, rồi sắp
tô-pô. Khối không bị chặt dùng cạnh đã nhớ. Kết quả trùng với tính lại từ đầu, kể cả thứ tự khi hoà.

Muốn trúng cache thì **dựng món một lần, ngoài `solids`**, và `solids(ctx)` trả lại đúng các object ấy;
ẩn một món thì lọc nó khỏi mảng trả về. Món dựng mới mỗi khung (đồ đi theo tay) vẫn đúng, chỉ là tính lại
mỗi khung. Đổi hình một món thì tạo object mới, hoặc gán `parts` một mảng mới — sửa thẳng phần tử
trong `parts` cũ thì cache không biết.

### Khối tròn xoay

`lathe(spec, lens, at, sw?)` dựng đĩa, bát, cốc, món đắp vòm thành `Part[]`: mỗi đai giữa hai vòng
liền nhau chia `n` múi từ sát trục ra vỏ. Múi không có cạnh viền (`w: 0`), chỉ để xếp lớp và tô.
Viền là vân tính trên mặt tròn xoay thật cho đúng ống kính và chỗ đặt: đường bao dọc là đường sinh
tiếp xúc tia nhìn; cung vòng chạy đúng đoạn mà mặt trên và mặt dưới vòng một bên thấy một bên khuất,
hay đoạn mép gãy quá 40° có ít nhất một bên thấy — đầu đường bao trùng đầu cung. Mỗi khúc viền gắn vào
múi chứa nó, neo trên một mặt múi đang quay ra mắt; đường bao vẽ thêm ở múi kề.

| trường `Lathe` | |
|---|---|
| `rings` | các vòng `[y, r]` xếp **từ đáy lên**, `y` âm là lên; hai vòng liền nhau cùng `y` là một bậc phẳng |
| `tone` | một `Tone` cho cả món, hay mảng: màu đai giữa vòng k và k + 1 |
| `sx`, `sz` | kéo bán kính theo x, z: món bầu dục |
| `n` | số múi, mặc định 12 |
| `tilt` | nghiêng quanh trục z của món qua gốc, radian; dương là đỉnh ngả sang +x |
| `w` | bề dày viền, nhân `sw` |
| `top` | vân trên mặt đỉnh (`Mark` không có `n`), toạ độ món ở `y = 0`; `lathe` đặt lên vòng trên cùng |
| `beads` | hạt tròn trên mặt đỉnh (cà chua bi): tâm `d: [x, z][]`, cỡ `w` nhân `sw`, `color` |
| `ink` | màu viền, mặc định `INK` |

- **Chọn `n`:** đỉnh múi đặt ra ngoài vòng cho cạnh đa giác lệch đều hai phía vòng thật, mỗi phía
  `r · (1 − cos π/n) / (1 + cos π/n)`. Độ lệch ấy phải dưới nửa bề ngang viền (đơn vị món) thì viền
  phủ kín mép múi: đĩa r 43 lấy 12, món r 25–30 lấy 10, cốc r 17 lấy 8.
- **`sw`** cùng nghĩa `SolidItem.sw` (px trên khung): truyền đúng `sw` của món, bỏ trống là mặc định
  như món (3 nhân cỡ món). Nó đổi ra đơn vị món để tính cỡ hạt và bề ngang dải vân.
- **Vân `top` dày** (`w` quá `0,4 + 1/u`, `u` là `sw` đổi ra đơn vị món; `sw` mặc định thì ngưỡng là 0,73)
  thành dải các nét mảnh 0,4 song song nằm trên mặt đỉnh: co theo phối cảnh như mặt, nhìn xiên không
  tràn qua viền. Vân mảnh giữ nguyên.
- Trong một múi vẽ vân `top`, rồi viền, rồi hạt. Hạt (đĩa mực rồi đĩa màu) vẽ lại ở **mọi** múi của
  đai trên cùng, nên múi vẽ sau cùng để hạt nằm trên.
- **Viền phụ thuộc ống kính và chỗ đặt.** Đổi `lens`, `at` hay `tilt` thì dựng lại `parts`; món tĩnh
  dựng một lần ngoài `solids` cho trúng cache.
- Mỗi múi là một khối của `solidOrder`: một món có `(rings.length − 1) · n` khối. Món sống dựng lại mỗi
  khung thì đắt hơn hẳn — giữ `n` nhỏ.

```ts
import { lathe, lensKey, type Lathe, type SolidItem } from "@stickman3d/fx";
import type { Place3 } from "@stickman3d/sketch";

const COC: Lathe = { rings: [[0, 12], [-52, 16.2], [-62, 17]], tone: { top: "#e8b47a", lit: "#d48f4c", side: "#b8702f" }, n: 8 };
const at: Place3 = { at: [120, -74, 40], yaw: 0.3 };
let coc: { key: string; item: SolidItem } | undefined;

// trong lớp: ống kính đổi thì dựng lại, còn lại trả đúng object cũ
solids: ({ lens }) => {
  if (coc?.key !== lensKey(lens))
    coc = { key: lensKey(lens), item: { parts: lathe(COC, lens, at), at } };
  return [coc.item];
},
```

## Người lồng vào đồ

Rig không đẩy người ra khỏi đồ và lúc vẽ không báo gì khi khối một phần người lồng vào khối đồ. Mảnh
đồ không tách được với phần người ấy bị chặt theo mặt phẳng đứng qua tâm phần người, nửa trước vẽ đè
lên người: cẳng tay chìm dưới mặt bàn thì mép bàn cắt ngang tay, ghế kê sát quá thì mép bàn đâm vào
bụng, cốc kê sâu vào mặt thì miệng cốc che nửa mặt. Chỗ phải sửa là chỗ đặt người, đồ hay đích tay.

`stickman check` đo cho mỗi cảnh có `lens` và người `world` (trừ cảnh khớp `stickman.frozen`):

- dựng đúng khối mà `<SceneWorld>` xếp lớp — khối từng phần người (`fig3.solids`, như
  `solidFigure`) và khối đồ của các lớp bật cho cảnh (`itemSolids` của `solids(ctx)`);
- chỉ đo cặp mà `solidOrder` không tách được (bóng trên khung chồng nhau, không mặt nào của khối này
  để cả khối kia ở ngoài), và cặp phần người của hai người khác nhau. Hai phần cùng một người thì chỉ
  đo tay với thân ([Tay xuyên thân](#tay-xuyên-thân)): chúng xuyên nhau ở khớp là bình thường;
- độ lấn là quãng ngắn nhất phải đẩy phần người ra cho hai khối lồi rời nhau (độ chồm nhỏ nhất trên
  pháp tuyến mặt của hai khối và tích từng cặp cạnh — đúng, không lấy mẫu hướng), đơn vị thế giới.
  Chạm (đùi trên mặt ngồi, cẳng tay trên mặt bàn) là `0`;
- lấy mẫu mỗi `0,25 s` giây cảnh, chia đôi quãng nào có đỉnh khối người dời quá `4` đơn vị cho tới
  một khung `1/30 s`, nên tay quét qua mép bàn trong vài khung vẫn bị bắt;
- bỏ phần người có bóng nằm ngoài khung camera lúc ấy, và người đã mờ hẳn. Bị rèm hay vật khác che
  thì vẫn báo — `check` không biết khung còn gì đè lên;
- lấn quá ngưỡng mới kêu: mặc định `2`, khai `"stickman": { "clash": { "tol": 3 } }` trong
  `package.json` để đổi.

Mỗi cặp (phần người, món) — hay (phần người, phần người của người kia) — một dòng cảnh báo, sâu nhất
trước: chỗ lấn sâu nhất, mảnh nào (chỉ số khối trong `parts` của món), ở giây nào, và các quãng giây
liền nhau đang lấn. Món gộp theo `name`; món không có `name` thì gọi `món #k` theo thứ tự trong các
mảng `solids` của mọi lớp bật cho cảnh — lớp ẩn bớt món giữa cảnh là `k` dời, nên đặt `name` cho món.

```
scenes/quan.json: người lồng vào đồ — a.head ↔ coc (mảnh 0) lấn 33.0 ở giây 0.00 · giây 0.00–2.75
scenes/quan.json: người lồng vào đồ — b.forearmFar ↔ ban (mảnh 0) lấn 10.8 ở giây 14.59 · giây 7.19, 14.59
scenes/hop.json: người lồng vào đồ — a.head ↔ b.head lấn 40.7 ở giây 3.78 · giây 2.19–4.09
```

`scene_probe` của MCP trả cùng phép đo ở từng mốc hỏi (`clashes`).

**Lấn có chủ ý thì khai `touch` trên món**: tên phần người (`BODY_PARTS`: `head`, `torso`,
`forearmNear`…) cho mọi người, hay `id.phần` cho một người. Cốc kề miệng là `touch: ["a.head"]`,
loa cầm sát mặt là `touch: ["head"]`. Chuỗi là lấn bao nhiêu cũng không báo; `{ "part": "a.legNear",
"max": 6 }` nâng ngưỡng của phần ấy với món ấy lên `max` (không dưới `tol`), lấn sâu hơn vẫn báo —
dùng khi phần người phải tựa sát món (đùi trên mặt ngồi, lưng vào trụ tựa) mà lún sâu là hình lộ.
Hai mục cùng khớp một phần thì lấy ngưỡng lớn hơn. `touch` chỉ đổi báo cáo, không đổi cách vẽ: miệng
cốc vẫn vẽ đè lên mặt đúng như lúc chưa khai.

**Tay đặt lên bàn thì lấy đích từ `handsOn`** ([03](03-scene.md#đích-bàn-tay-thế-giới)): cổ tay cao hơn
mặt nửa bề dày tay, khuỷu cao hơn cổ tay, cẳng tay nằm trên mặt bàn. Đích tự viết đặt sát người hay
thấp hơn mặt là cẳng tay dốc xuyên mép bàn. Dời ghế hay bàn thì gọi lại `handsOn`.

Tự đo trong code: `sceneClashes(rt, t, { characterOf, codeLayers, tol, self })` của `@stickman3d/fx`
cho một khung của cảnh (cả tay xuyên thân), `solidClashes(lens, items, people, { tol, view })` cho khối
đã dựng, `armPierce(character, pose, { tol })` của lõi cho tay với thân ở một tư thế, `penetration(a, b)`
cho hai khối lồi.
Chúng chỉ để kiểm — đường vẽ không gọi.

## Tay xuyên thân

Người 3D vẽ tay đúng theo đích cổ tay và khuỷu, không tránh thân mình: đích cổ tay đặt sát quá trước
ngực (cốc cầm sát người), với chéo qua người tới đồ nằm phía tay kia, hay buông tay từ một đích ở phía
bên kia người là cẳng tay hay cánh tay xuyên qua thân. `stickman check` đo đoạn tay (`armNear`,
`armFar`, `forearmNear`, `forearmFar`) với thân áo của chính người ấy, cùng các giây lấy mẫu với
[Người lồng vào đồ](#người-lồng-vào-đồ), bằng `armPierce` của lõi:

- tay và thân đúng như three vẽ, không theo khối người của `<SceneWorld>`: tay là khớp `actJoints`
  (cùng khung xương, cùng IK với `act`), thân là khối tròn xoay dẹt của `torsoMesh` — nửa rộng theo
  `profile` của áo, tiết diện ngang ellipse dẹt `TORSO_DEPTH`, dựng theo trục hông → cổ. Khối hộp của
  `solidBody` vuông góc và đặt tay theo đường vẽ 2D, đo trên nó thì tay chắp trước bụng cũng thành
  xuyên thân;
- bỏ `30%` cánh tay phía vai (khớp vai nằm trong thân ở mọi tư thế) và `20%` cẳng tay phía cổ tay
  (tay đặt lên ngực, chống hông chỉ chạm ở cổ tay) — `PIERCE_TRIM`; lõi tay lấy nửa bán kính tay
  (`PIERCE_CORE`), nên tay áp sát mặt áo không tính;
- ngưỡng riêng, mặc định `4` (`PIERCE_TOL`): tay khoanh, ôm ngực đã lấn vài đơn vị, còn tay xuyên thật
  lấn hàng chục. Đổi bằng `"stickman": { "clash": { "self": 6 } }`, `false` là không đo;
- bỏ người có thân ngoài khung camera, và người đã mờ hẳn.

```
scenes/pantry.json: tay xuyên thân — haru.forearmNear lấn vào haru.torso 17.6 ở giây 0.75 · giây 0.69–0.88
```

Cách sửa: cổ tay cầm đồ trước ngực đưa ra trước đủ xa (thân người 3D dày, cổ tay cách trục thân dưới
khoảng `50` là cẳng tay chạm ngực); đồ nằm phía tay kia thì quay người về phía đồ thay vì với chéo; buông
tay từ một đích xa thì thêm một mốc kéo cổ tay về trước người rồi mới buông (`null`); khuỷu khép vào
sườn thì đẩy ra bằng `elbow`.

## Đồ lồng vào đồ

Đồ khối cũng không đẩy nhau ra: cốc đặt thẳng xuống mặt quầy trong khi khay nhỏ giọt của máy cao hơn
mặt quầy là đáy cốc chìm trong khay; phóng to một món mà không giãn chỗ là nó lồng vào món bên cạnh.
`stickman check` đo từng cặp món của các lớp bật cho cảnh (`solids(ctx)`), cùng các giây lấy mẫu:

- độ lấn là quãng ngắn nhất phải đẩy cho hai khối lấn sâu nhất của hai món rời nhau, như người lồng
  vào đồ;
- phần thể tích: ước bằng lưới điểm trong từng khối, phần thể tích của **món nhỏ hơn** nằm trong món
  kia;
- kêu khi **cả hai** vượt ngưỡng: lấn quá `stickman.clash.tol` và phần thể tích quá
  `stickman.clash.items` (mặc định `0,1`, `false` là không đo). Đồ đặt lên mặt món khác lấn `0`; tờ giấy
  mỏng lún chút vào mặt bàn thì phần thể tích lớn mà độ lấn nhỏ, không kêu;
- bỏ hai món cùng chỗ đặt, cùng hướng, cùng cỡ — một vật dựng thành nhiều món (thân cốc và quai) — và
  cặp có cả hai bóng ngoài khung camera;
- món đứng yên chỉ đo một lần cho cả cảnh; món dựng lại theo `t` đo lại ở mỗi giây lấy mẫu.

```
scenes/pantry.json: đồ lồng vào đồ — mayPha (mảnh 10) ↔ cocVoi (mảnh 2) lấn 13.0, 48% thể tích cocVoi ở giây 0.00 · giây 0.00–13.50
```

**Lồng có chủ ý thì khai tên món kia trong `touch`** của một trong hai món: bút trong ống bút là
`touch: ["ong-but"]` trên món bút. Tên món là `name` mà lớp đặt cho món.

Tự đo trong code: `sceneItemClashes(rt, t, { codeLayers, tol, ratio })` cho một khung của cảnh,
`solidItemClashes(lens, items, { tol, ratio, view })` cho các món đã dựng.

## Vẽ sai thứ tự

`stickman check` soi thêm chính thứ tự `solidOrder` vừa xếp, cho mỗi cảnh và mỗi giây mẫu như
[Người lồng vào đồ](#người-lồng-vào-đồ), cùng ngưỡng `stickman.clash.tol`: lấy tâm và các đỉnh co
về tâm của từng phần người, điểm nào nằm trong một mặt nhìn thấy của mảnh đồ trên khung thì so độ sâu
của mặt ấy với điểm dọc tia nhìn. Mảnh vẽ sau phần người mà nằm sau nó, hay mảnh vẽ trước mà nằm
trước nó, quá ngưỡng thì kêu — hình là mặt sàn cắt cụt chân, hay người vẽ đè lên quầy đứng trước.
Bỏ cặp lồng nhau sâu hơn ngưỡng (đã báo ở mục trên), phần người khai bằng chuỗi trong `touch` của món, và điểm
ngoài khung camera. Mỗi cặp (phần người, món, chiều đè) một dòng:

```
scenes/coffee.json: vẽ sai thứ tự — bucSan (mảnh 0) đè lên b.shinNear dù nằm sau 46.2 ở giây 3.50 · giây 3.50, 3.75
scenes/quay.json: vẽ sai thứ tự — b.legNear đè lên quay (mảnh 0) dù nằm sau 12.4 ở giây 1.00 · giây 0.75–1.25
```

Dòng này là lỗi của rig, không phải của cảnh: chụp đúng khung ấy và báo về rig. Tự đo trong code:
`sceneOverdraws(rt, t, { characterOf, codeLayers, tol })` của `@stickman3d/fx` cho một khung của cảnh,
`solidOverdraws(lens, items, people, { tol, view, order })` cho khối đã dựng. Chúng chỉ để kiểm —
đường vẽ không gọi.

## Soi bằng ảnh

`render_scene` với `stage: true` (và `stickman-render --scene --stage`) vẽ lớp;
dải ảnh thân người thì không — nó cố ý bỏ nền, camera và chỗ đứng. `times: [...]`
chỉ đích danh mốc, `around: { cast, anchor, pad }` cắt quanh một mốc trên người.
Bundle lớp nằm trong bộ nhớ của MCP server và chỉ gói lại khi file nguồn đổi, nên
vòng sửa → soi là một lượt `render_scene`, không phải một lượt bundle Remotion.

`stickman check` gói thử entry lớp và đối chiếu `scenes` của từng lớp với
`scene.name` có thật — tên sai là lỗi, lớp không có chỗ móc nào là cảnh báo.

## Bẫy

- **Đường render mới vẽ bằng `<SceneWorld>`**, không tự gọi từng móc: chỗ chèn
  chỉ có một, thiếu một móc hay một lớp `fx` là không thể.
- **`scenes` là `scene.name`, không phải tên file.** Lúc vẽ, tên sai chỉ làm lớp
  không hiện; `stickman check` mới là chỗ báo.
- **`place` cộng vào `spot`, không thay `cast[].x`.** Số trong JSON vẫn là chỗ
  đứng lúc lớp chưa đẩy gì; `scene_probe` trả số chưa cộng.
- **`bg` tắt vạch đất.** Lớp nào vẽ nền thì tự lo đường chân trời.
- **Đồ khối nhớ theo object món.** Sửa thẳng `parts` của món đã vẽ thì hình giữ khối
  cũ; dựng món mới mỗi khung thì đúng nhưng mất cache.
- **Người lồng vào khối đồ không bị đẩy ra.** Đồ bị chặt qua người rồi vẽ đè lên; chỉ
  `stickman check` báo ([Người lồng vào đồ](#người-lồng-vào-đồ)).
- **Khối `lathe` chỉ đúng cho ống kính và chỗ đặt đã dựng nó.** Dùng lại ở ống kính hay
  `at` khác thì viền lệch khỏi mép mà không có gì báo.
- **`Scene.tsx` của repo chỉ đưa bộ nạp ảnh cho `<SceneWorld>`.** Tự xếp lớp lại
  trong đó là bản mp4 cuối khác dải ảnh vừa soi. Context riêng của repo đặt ở
  `src/scene-wrap.tsx` ([05](05-repo-video.md#nâng-lên-bộ-rig-mới)); nó chỉ có trong
  app Remotion, nên lớp đọc nó phải chịu được giá trị mặc định ở studio và MCP.
