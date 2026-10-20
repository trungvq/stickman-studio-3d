# G6-5 — xoá đường cầm đồ v1

## Đã xoá
- `core/heldItem.ts`: `GripHandSchema`/`GripHand`, `ItemDirSchema`/`ItemDir`, `AnchorRefSchema` (giữ type `AnchorRef`), `HoldIntentSchema`, `GripSpecSchema`/`GripSpec`, `CarrySpecSchema` (→ interface `CarrySpec`), `HeldGripSpec`, `isCarry`, `HELD_MIN`, `isHeldV2`, `holdRef`, `heldDir`, `gripHand`, `heldGrip`, `gripSpec`, `gripOf`, `holdKind`, `holdIntent`, `leadSide`; `SceneHoldSchema` dạng `món#kiểu` và `{ item, grip }`; trường `grips` của `HeldItemSchema` (chỉ `schemaVersion` 2).
- `gripFrame(item, h, …)` → `graspLink(h, side, k, long, s)`; `GraspHand` toàn vectơ khung món; `gripAxes(h)`.
- `core/holdLink.ts`: nhánh v1 của `holdHand`, `holdLinkFrame` (bỏ tham số `hand`), `holdFrom`, `isCarryHold(h)`.
- `core/heldCarry.ts`: nhánh v1 của `carrySpecOf`.
- `core/act3.ts`: `HOLD_ALT`, `AimReport.hold.alts` (dò kiểu cầm khác); `leadGrip(h, side, …)`.
- `core/scene.ts`: mọi nhánh `holdKind`/v1 (`sceneHoldProblems`, `holdAim`, `handAt`, `checkHolds`, `placedRun`, `carryRef`).
- `core/heldAudit.ts`: luật `wrap`, `heldOpen`, `HeldHand.wrap`, `intent.alts`, nhánh kiểu cầm cứng v1 (ý định, `reach`, gợi "sửa kiểu cầm"); `heldGripMax` → `groupGripMax`.
- `src/attach.ts`: `gripIntent`, nhánh v1 của `holdGrip`, `carry`; `src/held.ts`: tên kiểu treo v1, `wrap`.
- MCP: `list(held)`/`describe_held` phần v1, `schema(held).defaultsV1` → `sample`, `scene_probe` `hug`/`open`/`alts`, ví dụ `hold` → `coc@cylinder`.
- `bang-cam` (scaffold, chép đè sang video `tools/bang-cam.mjs`): chế độ kiểu cầm; không `--nhom` = mọi nhóm chạy được.
- Món mẫu `apps/studio/public/held/coc.json`, `tui.json` → v2; `apps/viewer/src/demo-carry.js` cầm `coc@cylinder`, `tui` `carry`.
- Test v1 (~20 test), fixture `hold-v1-reach.json`; `grip-frames.json` giữ dữ liệu.
- Docs: Phụ lục A, "Thứ gãy khi xoá v1", "hai đường cùng chạy", mọi nhắc `món#kiểu`/`grips`/`gripFrame` ở 01, 03, 04, 05, 06, 07, 10, 11, README; templates cli.

## `SCENE_VERSION`
29 → 30 (`core/scene.ts`). `migrateScene` không tự chuyển: `hold` `món#kiểu` / `{ item, grip }` để zod báo kèm "chuyển cảnh cũ bằng `stickman migrate-held`". Món thiếu `schemaVersion`/bản 1: zod báo "món cầm bản 1 … `stickman migrate-held`". Cảnh video (ghi version 26) để `migrateScene` lo, không sửa file nào.

## Cố ý giữ
- `stickman migrate-held`: schema bản 1 riêng trong tool (`parseV1Item`, `v1Intent`, `v1Link` → `rig.graspLink`), `HOLD_MAP` trong tool; test của nó xanh.
- Đường cũ không có `held/` (`follow`/`offset`, luật `legacy`): không phải v1 `grips`.
- Món v2 khai thêm khoá `grips` thì bị bỏ (zod `object` lọc khoá lạ), không báo.
- Video `tools/held-moc.mjs` còn dòng kiểm `spec.grips` (chết, không gọi API đã xoá) — không sửa.

## Kiểm
- Studio: `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm build` xanh (rig 1107, sketch 245, fx 44, cli 70) — `g65-studio.log`.
- grep `gripFrame|heldGrip|grips` (trừ `dist`, `node_modules`): chỉ `packages/cli/migrate-held.mjs`, `migrate.test.mjs`.
- Video: `pnpm test` 53/53 (`g65-video-test.log`); `check --scene '^t02-' --only ref,held,clash` 0 lỗi 226 cảnh báo, log trước/sau trùng từng byte (`g65-check-truoc.log`, `g65-check-sau.log`; cảnh t02 không đổi giữa hai lần, `g65-scenes-truoc.md5`); `check --only ref` toàn repo không vấn đề (`g65-check-ref.log`); `pnpm bang-cam --nhom sheet --mon thu-bang-gia --out tmp/bang-cam-g65` chạy, 18 hàng 54 ô (`g65-bang-cam.log`).
