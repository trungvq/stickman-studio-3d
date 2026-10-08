# stickman-studio-3d

Người que 3D trên three.js — `@stickman3d/rig` và app xem thử. Quy tắc của repo ở
[AGENTS.md](AGENTS.md).

```bash
pnpm install
pnpm dev        # tsup --watch cho rig, vite cho app xem thử
pnpm typecheck
pnpm shots      # chụp app xem thử ra tmp/shots/
pnpm bench      # đo ms/khung ở 1920×1080
```

## Xem thử

`apps/viewer` — hai người que mẫu đứng nói chuyện trên sàn phẳng. Tham số URL:

| | |
|---|---|
| `t=4.6` | Đứng ở giây 4,6, dừng thời gian |
| `time=evening\|dusk\|night\|dim` | Giờ trong ngày (mặc định `day`): chiều nắng xiên, 18:30 trời đã tối đèn tầng còn bật, đêm tắt đèn trần, phòng họp tối 17:30 |
| `az=20&el=8&dist=14` | Góc máy: phương vị (0 là chính diện), độ cao (độ), khoảng cách |
| `look=x,y,z` | Điểm camera nhìn vào (three) |
| `aa=off\|ss1.5\|ss2` | Siêu lấy mẫu |
| `pixel`, `noink`, `nohud` | Chế độ pixel, tắt nét mực, ẩn HUD |
| `demo=walk\|sit\|faces\|look` | Cảnh diễn hành động thay cho cảnh nói chuyện: đi theo `path`, ngồi đặt tay lên bàn và cúi chào, bảng nét mặt, quay đầu về ống kính |
| `demo=hold` | Cầm đồ và đội đồ: một người đi bưng khay hai tay, đeo thẻ ngực; một cô thấp hơn cầm cốc, đội mũ cảnh sát; một người đeo kính râm, đội mũ, cầm tờ giấy; một hàng người nền `lod: 'low'` đóng băng ngồi bàn, người thứ tư ngồi lấn vào bàn. Góc trên trái là bảng va chạm của khung và số mesh, tam giác theo LOD |
| `noreport` | Ẩn bảng va chạm của `demo=hold` |
| `demo=camera` | Ống kính `scene.lens` và mốc `camera[]` của scene: máy đẩy vào người đang đi, lia theo, lùi ra. Nhãn và bong bóng 2D bám đỉnh đầu, mồm qua `screenOf` (chấm đỏ là đúng điểm mốc); góc máy xoay tay tắt |
| `demo=light` | Phòng thử đèn: đèn trần, nắng qua cửa sổ, bàn có đèn bàn, hai người que (`apps/viewer/src/demo-light.js`) |
| `spot`, `lamp=0\|1` | Với `demo=light`: bật đèn rọi sân khấu (bật trong 0,3 s, quét từ người đứng sang người ngồi ở giây 1–2,5, phòng tối bớt); bật/tắt đèn bàn (mặc định bật khi không phải `day`, `evening`) |
| `grade=flashback\|dim\|vhs` | Hậu kỳ toàn khung: hồi tưởng (nhoè, giảm bão hoà), tối nền, băng tua ngược |

Cảnh `demo=` là scene JSON dựng trong `apps/viewer/src/demos.js` (`demo=hold` ở `demo-hold.js`, kèm đồ mẫu chung), `@stickman/rig` lấy mẫu
bằng `sceneAt`, người 3D diễn theo bằng `act`. Cảnh có ống kính riêng (`SHOTS` trong `demos.js`) thì
camera theo `cameraAt`. Hành động ở `apps/viewer/actions/` chép từ
bộ chung của `@stickman/cli`.

Phím: `O` nét mực, `P` pixel, `A` khử răng cưa, `T` đổi giờ, `H` ẩn HUD,
`Space` dừng.

## Chụp ảnh để so

```bash
pnpm shots                      # tmp/shots/<commit>[-dirty]/ và tờ gộp tmp/shots/<commit>.png
pnpm shots --out truoc          # đặt tên lượt chụp
pnpm shots --out sau --vs truoc # ghép từng ảnh cạnh ảnh cùng tên: tmp/shots/sau-vs-truoc/
pnpm shots --only can-nguoi,chieu
```

Bộ khung cố định ở `SHOTS` trong `tools/shots.mjs`. Ảnh chụp bằng Chromium headless trên
GPU thật (`CHROME=` để chỉ trình duyệt khác, `--soft` vẽ bằng SwiftShader khi máy không có
GPU). Cùng máy, cùng code thì hai lượt chụp giống nhau từng pixel.

Cách so một thay đổi: chụp `--out truoc` ở commit gốc, sửa, chụp `--out sau --vs truoc`,
rồi đưa thư mục `sau-vs-truoc` cho chủ dự án xem.

## Dùng ở repo video

Repo video pin một version đã phát hành:

```jsonc
"@stickman3d/rig": "0.1.0",
"three": "0.186.0"
```

Trong lúc vừa sửa rig vừa dựng tập thì **đừng đi qua registry** — trỏ `link:` sang cây
nguồn, chạy `pnpm dev` ở repo này cho tsup build lại:

```jsonc
"@stickman3d/rig": "link:../../stickman-studio-3d/packages/rig"
```

Đi đường `link:` thì alias `three` về bản của repo video trong `remotion.config.ts` (và
`vite.config` nếu có), không thì symlink làm bundler tìm `three` ở repo này — hai bản
`three` là vật liệu hỏng mà không báo lỗi. Chốt một mốc thì publish rồi pin lại version.

## Sân khấu

`createStage` dựng một lần scene, camera và pipeline; mỗi khung `draw(t, view)` đặt camera theo ống kính và khung
cắt, gọi `update(t)` rồi vẽ **đồng bộ**. Không đọc đồng hồ: cùng `t`, cùng `view` là cùng ảnh.

```ts
const stage = createStage({
  size: { w: 1920, h: 1080 }, aa: 'ss2',
  lens: scene.lens,                                  // `scene.lens` của rig: eye, yaw, pitch, f, cx, cy
  light: () => setPalette('day'),                    // uniform chung G của riêng sân khấu này
  update: (t, st) => { pose(t); room.cull(st.camera); },
});
stage.scene.add(room.group, ...people.map((p) => p.root));
stage.draw(t, { crop: cameraAt(rt, t) });            // khung cắt 2D của rig, nội suy cut/linear/ease bên rig
const p = screenOf(stage, haru, 'mouth');            // px khung, toạ độ sân khấu, độ sâu, cỡ, có trong khung không
stage.dispose();
```

- **Camera.** `lens` cố định cho cả cảnh hay đổi theo khung (`draw(t, { lens })`). `crop` là kết quả `cameraAt(rt, t)`
  của `@stickman/rig` — nội suy và easing của mốc `camera[]` nằm ở đó, package không chép lại. Khung hình khác tỉ lệ
  sân khấu thì khung cắt nới quanh cùng tâm. Không có `lens` thì camera để tự do (app xem thử xoay tay).
- **`G` theo sân khấu.** Uniform chung `G` là của sân khấu dựng, `relight` hay vẽ gần nhất; sân khấu khác vẽ thì
  lấy lại `G` của nó. Hai `<Sequence>` chồng nhau, một ngày một chiều, vẽ đúng bảng màu và bản đồ bóng của từng cái.
  Đổi `G` của một sân khấu thì đổi trong `light` hay `stage.relight(fn)`.
- **Ảnh tĩnh.** `stage.still(t, view, canvas?)` vẽ rồi chép sang canvas 2D: khung chia đôi (hai sân khấu nửa khung
  hay một sân khấu hai lần `still`), nền làm tối (`filter: brightness(…)` trên canvas ảnh), năm ảnh nhanh (một sân
  khấu, năm `still`, rồi `dispose`). Cần texture thì `new THREE.CanvasTexture(stage.still(t))`.
- **Bám người.** `screenOf(stage, figure, mốc)` hay `screenOf(stage, điểm)` gọi sau `draw`/`pose` của đúng khung ấy.
  Mốc: `root`, `hip`, `chest`, `collar`, `head`, `headTop`, `face`, `mouth`, `wristR/L`, `footR/L`, và
  `wristNear/Far`, `footNear/Far` chọn bên gần ống kính như `anchorAt` 2D. Trả `x`, `y` px khung; `stage` toạ độ
  sân khấu (vẽ vào SVG `viewBox` của `cameraAt`); `scale` px khung cho một đơn vị rig ở độ sâu ấy; `behind`,
  `inFrame`; `occluded` khi truyền `{ occluders: [stage.scene] }`. Điểm thế giới rig là `Vec3`, điểm three là `Vector3`.
- **Renderer.** Không truyền `renderer` thì sân khấu tự dựng trên canvas mới (`stage.canvas`), `pixelRatio` 1,
  `preserveDrawingBuffer`, và `dispose` bỏ luôn context. Truyền `renderer` có sẵn thì sân khấu không huỷ nó.
  `stage.gpu` là tên GPU WebGL — có `SwiftShader` là Chromium đang vẽ phần mềm.

## Dùng trong Remotion

Repo video giữ một component mỏng. Mỗi lần mount là **một canvas mới**: context đã `dispose` không dựng lại được
trên canvas cũ, và `StrictMode` chạy effect hai lần.

```tsx
export const Scene3D = ({ scene }: { scene: SceneData }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const host = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLDivElement>(null);
  const world = useRef<{ stage: Stage; room: Room } | null>(null);
  const [wait] = useState(() => delayRender('cảnh 3D'));
  const rt = useMemo(() => resolveScene(scene, ACTIONS, ANIMALS, PROPS, castHeights(scene), castBodies(scene)), [scene]);

  const draw = (t: number) => {
    const w = world.current;
    if (!w) return;
    w.stage.draw(t, { crop: cameraAt(rt, t) });
    const p = screenOf(w.stage, w.room.people.haru, 'headTop');
    tag.current!.style.transform = `translate(${p.x}px, ${p.y}px)`;
    tag.current!.style.visibility = p.inFrame ? 'visible' : 'hidden';
  };

  useLayoutEffect(() => {
    let dead = false;
    // phông, ảnh decal: nạp xong mới dựng, vẽ khung hiện tại rồi mới nhả Remotion
    loadAssets(scene).then((assets) => {
      if (dead) return;
      const room = buildRoom(scene, rt, assets);
      const stage = createStage({
        size: { w: width, h: height }, aa: 'ss2', lens: scene.lens,
        light: () => setPalette('day'),
        update: (t, st) => room.pose(t, st.camera),
      });
      if (/SwiftShader/.test(stage.gpu)) throw new Error(`không có GPU: ${stage.gpu}`);
      stage.scene.add(room.group);
      host.current!.prepend(stage.canvas);
      world.current = { stage, room };
      draw(frame / fps);
      continueRender(wait);
    });
    return () => {
      dead = true;
      world.current?.stage.dispose();
      world.current?.stage.canvas.remove();
      world.current = null;
    };
  }, [scene, width, height]);

  useLayoutEffect(() => draw(frame / fps), [frame, fps]);

  return <AbsoluteFill ref={host}><div ref={tag} className="tag">12:00 社食</div></AbsoluteFill>;
};
```

Chữ 2D bám người ghi thẳng vào `style` qua ref trong cùng `useLayoutEffect` với `draw`: Remotion chụp sau
layout effect nên chữ và ảnh 3D cùng một khung, không qua state.

**Context WebGL.** Mỗi `Scene3D` đang mount là một context, `dispose` khi unmount. Chromium giữ tối đa 16 context
mỗi trang, quá thì context cũ nhất mất và cảnh ấy ra trống; mỗi tab của `--concurrency` là một trang riêng nên giới
hạn tính theo tab. Số cảnh 3D cùng mount (các `<Sequence>` chồng nhau cộng `premountFor`) phải dưới 16 — một tập
thường chỉ hai, ba. Quên `dispose` thì sau vài chục lần mount Chromium báo `Too many active WebGL contexts`. Mỗi lần
mount dựng lại shader của context mới, vài chục ms một cảnh.

**Renderer OpenGL của Chromium.** Đặt trong `remotion.config.ts` của repo video:

```ts
// GPU thật qua ANGLE trên Vulkan; không có Vulkan thì tạo context lỗi ngay chứ không âm thầm vẽ phần mềm
Config.setChromiumOpenGlRenderer('vulkan');
Config.setConcurrency(4);
```

Hay `--gl=vulkan` trên dòng lệnh. `angle` cũng chạy GPU (chrome-headless-shell của Remotion chọn Vulkan làm
backend) nhưng rơi về SwiftShader khi không có GPU mà không báo. `swangle` (mặc định của Lambda) và `swiftshader`
là vẽ phần mềm, chậm ~100 lần. `egl`, `angle-egl` không tạo được context với chrome-headless-shell của Remotion
trên máy dựng. Kiểm bằng `pnpm bench --gl vulkan,angle,swangle` với `CHROME=` trỏ vào
`node_modules/.remotion/chrome-headless-shell/…/chrome-headless-shell` của repo video.

## Đo thời gian render

```bash
pnpm bench                                   # cast, walk, camera × off, ss1.5, ss2; GPU qua Vulkan
pnpm bench --scene walk --aa ss2 --gl vulkan,angle --frames 200 --total 41000
```

Mở app xem thử ở 1920×1080, vẽ từng khung đồng bộ rồi đọc một pixel để chờ GPU xong. `chụp` là
`Page.captureScreenshot` JPEG như Remotion chụp mỗi khung. Bảng cuối ước số phút cho `--total` khung: chỉ phần vẽ
3D, và vẽ cộng chụp trên một tab — các tab của `--concurrency` chia nhau phần chụp, GPU thì dùng chung.
## Đèn trong nhà

Đèn lấy từ hai chỗ: giờ trong ngày `setPalette(name)` (màu nắng, đèn trần, bóng, trời) và bộ đèn
của phòng `setLights(rig)` (toạ độ rig). Phòng khai một lần; đèn chạy theo `t` thì gọi lại
`setLights` mỗi khung trước `render`:

```ts
setLights({
  ceiling: { y: -780 },                                    // đèn trần: bóng mềm, gần như rơi thẳng xuống
  window: { at: [-800, -450, 0], normal: [1, 0, 0], width: 500, height: 360, bars: [2, 2] },
  lamps: [{ at: [660, -322, 186], target: [600, -137, 140], angle: 34, color: '#ffc77a', intensity: 1.5, range: 320 }],
  bounds: { min: [-820, -800, -700], max: [820, 20, 620] }, // hộp phòng: hộp bóng tự tính không ra ngoài
});
pipe.render(scene, camera, { t, grade: { desaturate: 0.65, blur: 0.45 } });
```

Không có `ceiling` là ngoài trời: mặt trời của bảng màu là đèn chính. Nắng qua cửa chỉ sáng
chỗ tia lọt qua ô kính và có bản đồ bóng riêng; tường chứa cửa và vật ngoài phòng không che.
Tối đa `MAX_LAMPS` đèn cục bộ, `MAX_LAMP_SHADOWS` đèn rọi đầu có bóng; `angle` từ 80 trở lên
là đèn điểm, không bóng. Chao đèn bọc bóng đèn phải `userData.noShadow`. Bóng tiếp xúc (SSAO)
dò từ độ sâu ở lượt hậu kỳ, chỉnh bằng `ao` của bộ đèn.

## Diễn theo hành động 2D

Package không đọc JSON hành động hay scene. Repo video lấy mẫu bằng `@stickman/rig` rồi
đưa thẳng kết quả cho `act`:

```ts
const rt = resolveScene(scene, ACTIONS, ANIMALS, PROPS, castHeights(scene), castBodies(scene));
// mỗi khung
act(fig, sceneAt(rt, id, t, heights[id], bodies[id]), t);
```

`act` đặt người theo `world` (tâm hông, hướng, ngồi), đọc góc tay chân của hành động soạn
ở `side` (`stand-3d`, `sit-3d`, `walk`, `bow-3d`…), đích cổ tay (`reach`, `world.hands`),
góc thân, góc đầu và nét mặt (`mouth`, `brow`, `eyes`), tự chớp mắt theo `t`. Kênh tay chân
soạn trên mặt khung 2D không được đọc: người đứng nghỉ ở kênh ấy.

## Cầm đồ, đội đồ, người nền, va chạm

Mỗi người có `sockets`: `hand[-1|1]` ở mút cẳng tay (−y dọc cẳng tay), `crown` ở đỉnh đầu kể cả tóc, `face` ở mặt
trước sọ ngang mắt, `chest` trên mặt áo ở ngực trái (+z là pháp tuyến, y lên); `sockets.head` là số đo đầu
(`rest(r)`: cao độ một vành bán kính `r` trùm xuống đầu và tóc thì dừng — để mũ ôm vừa đầu). `torsoSocket(fig, x, y)`
mở thêm khung trên mặt áo.

```ts
hold(fig, tray, { hand: 'both' });                       // giữa hai mút tay, mặt ngang; 'tilt' nghiêng theo hai tay
hold(fig, mug, { hand: -1, follow: 'level', offset: [0, -0.1, 0.15] }); // đứng thẳng, quay theo người
hold(fig, pen, { hand: 1 });                              // cứng theo cổ tay
wear(fig, 'crown', cap); wear(fig, 'chest', badge);
```

Đồ gọi tên theo `items` của JSON nhân vật: repo video cấp hàm dựng theo tên, package không chứa đồ của tập nào.

```ts
const fig = fromCharacter(json, { items: { cup: (ctx) => ({ object: mug(), hold: { follow: 'level' } }), cap: policeCap } });
// mỗi khung, sau act:
dress(fig, equipMap(json, sp.equip), sp.world?.flip);    // equipMap của @stickman/rig; handNear là tay act gọi là tay gần
```

Đồ cầm bám tay **tự cập nhật** khi three tính ma trận (lúc render, hay `fig.root.updateMatrixWorld()`), nên thứ tự
chỉ là: `act` → `dress` → render. Đồ nằm trong `root` nên to nhỏ theo `root.scale`. `hideHair: ['spikes']` trong
`ItemBuild` giấu lọn gai khi đội mũ.

Người nền: `stickman({ lod: 'low' })` ít mặt lưới, gộp khối tĩnh theo vật liệu, nét mặt dùng chung và đứng yên
(18 mesh, ~27k tam giác so với 26 mesh, ~36k của người đầy đủ, áo sơ mi tóc gai). Người không diễn thì đặt dáng một
lần rồi `freeze([...])`: cả đám thành một mesh mỗi vật liệu — năm người ngồi bàn còn 21 mesh thay vì 90.

Va chạm thay cho `stickman check`, gọi ở từng `t` đã lấy mẫu sau `act`:

```ts
const cols = [...colliders(tableItem, 'bàn'), ...colliders(new THREE.Box3(...), 'tủ'), ...colliders(batchGroup, 'phòng')];
collide({ haru: fig1, aya: fig2 }, cols, { people: true });
// [{ who: 'haru', part: 'thigh', side: -1, collider: 'bàn', depth: 0.06, at: Vector3 }] — depth ×100 là px rig
```

Món khối `Item` và `Box3` là khối lồi, bắt cả nét nằm lọt trong vật; `Object3D` (như đầu ra của `Batch`) là lưới tam
giác, chỉ bắt nét cắt qua mặt. Người ngồi thì đùi lún nửa nét vào mặt ghế (hông 2D là tâm nét): lọc chỗ chạm ấy ở
phía gọi.

## Phát hành một version

Registry là GitLab package registry, endpoint cấp project (scope `@stickman3d` không trùng
namespace gốc `trungvq`). Trước lần phát hành đầu: tạo project GitLab cho repo này, thay
`<PROJECT_ID>` trong `.npmrc` và `publishConfig` của `packages/rig/package.json`, rồi đặt
token một lần:

```bash
pnpm config set "//gitlab.com/api/v4/projects/<PROJECT_ID>/packages/npm/:_authToken" <PAT scope api>
```

Mỗi lần phát hành: bump `version` trong `packages/rig/package.json`, `pnpm release`.
GitLab từ chối version đã có — luôn bump trước.
