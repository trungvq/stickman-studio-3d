# stickman-studio-3d

Người que 3D trên three.js — `@stickman3d/rig` và app xem thử. Quy tắc của repo ở
[AGENTS.md](AGENTS.md).

```bash
pnpm install
pnpm dev        # tsup --watch cho rig, vite cho app xem thử
pnpm typecheck
pnpm shots      # chụp app xem thử ra tmp/shots/
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
| `demo=light` | Phòng thử đèn: đèn trần, nắng qua cửa sổ, bàn có đèn bàn, hai người que (`apps/viewer/src/demo-light.js`) |
| `spot`, `lamp=0\|1` | Với `demo=light`: bật đèn rọi sân khấu (bật trong 0,3 s, quét từ người đứng sang người ngồi ở giây 1–2,5, phòng tối bớt); bật/tắt đèn bàn (mặc định bật khi không phải `day`, `evening`) |
| `grade=flashback\|dim\|vhs` | Hậu kỳ toàn khung: hồi tưởng (nhoè, giảm bão hoà), tối nền, băng tua ngược |

Cảnh `demo=` là scene JSON dựng trong `apps/viewer/src/demos.js`, `@stickman/rig` lấy mẫu
bằng `sceneAt`, người 3D diễn theo bằng `act`. Hành động ở `apps/viewer/actions/` chép từ
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
