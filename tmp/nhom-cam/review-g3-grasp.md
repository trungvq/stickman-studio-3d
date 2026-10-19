# Review Fable — `graspSolve` / mốc món `items` (HEAD `130b188`)

Tổng quan: hệ trục, dấu, tay trái không soi gương, `rim` (`nt`), `handFromItem`, `edgeHigh` ngưỡng 30°, `E(φ)`, `phiChain`/`phiAt`,
`itemAt` hoà cầu và `checkItems` khớp spec mục 3–5 và act3. Các điểm dưới là chỗ còn sai hoặc dễ gãy khi nối.

## 1. Lỗi đúng/sai
1. `graspSolve.ts:216-220` · `edgeHigh` suy biến với cạnh ngang chạy trước–sau (tấm nằm cầm cạnh `left`/`right`: `w ⊥ across`, `dot = 0`,
   trả `e` thô = `m × F` → đầu thấp đổi theo `thumb`). Sửa: khi `|dot(w, across)| < ε` lấy đầu thấp theo `−tiến` (đầu gần người cầm);
   ghi spec mục 4 "Vị trí dọc cạnh".
2. `graspSolve.ts:614-626` + `:235-255` · `graspFrame` nhận `part` + `kind` rồi `pickFeature` lấy khối đầu tiên; món có hai `slab` cùng
   phần → ứng viên thứ hai dựng trên khối thứ nhất. Sửa: `graspFrame` nhận thẳng `Feature` (hay chỉ số), `GraspChoice` có định danh khối.
3. `graspSolve.ts:631-634` · Mốc món sau dựng trên `frame.G` của `t0`; `handFromItem` ném khi mốc sau đổi `cast` sang người cỡ khác, và
   mốc của người khác bị cộng vào giá. Sửa: lọc `later` theo `pose.cast`.
4. `scene.ts` `itemIntent` (~3560) · `face` trần bị nuốt khi không có mặc định nhóm → món lấy `T.Rr`, không lỗi. Sửa: ném khi đích trần
   không có trục; G3-11 gọi `sceneItemProblems` sau khi biết `hold`.
5. `graspArm.ts:230-231` · `phiBasis` ngưỡng `1e-6`: tay gần thẳng đứng → hình chiếu `down` rất ngắn, φ nhảy. Sửa: hoà `d0` giữa hình
   chiếu `down` và `−tiến` theo `|down⊥|` trong dải 0,1–0,3.
6. `graspSolve.ts:644-648`, `:716-723` · Hoà ứng viên liên tục không theo thứ tự tăng dần (nghiệm thô được ưu tiên). Sửa: điểm lưới trùng
   mặc định đi lại lưới, so theo thứ tự lưới.
7. `scene.ts` `solveItemMark` (~3590) · Đích trùng chỗ món báo nhầm "suy biến 0°". Sửa: tách lỗi "đích trùng chỗ món".
8. `scene.ts` `holderFace` (~3503) · Dưới 45° hướng ngang về mắt, trên 45° về tâm sọ → giật ở ranh. Sửa: luôn hướng ngang về tâm sọ, chỉ
   kẹp góc ngẩng; sửa spec mục 4.
9. `graspSolve.ts:614` · `opts.high` dùng chung mọi `edge`. Sửa: ném nếu `opts.high` mà `edge` chưa khai.
10. `graspSolve.ts:668-671` · Tay dẫn `"bang-gia@sheet"` lấy cạnh đầu tiên của `f.edges` (thứ tự do `heldGeom`). Sửa: định mặc định.
11. `graspSolve.ts:132`, `graspArm.ts:27`, `aimWrist` · ba bản `TURN_MAX = 90`. Export một hằng.

## 2. Lệch spec mục 4–5
- `graspGroups.ts:191-195` — `needs` của `sheet` đo cạnh dài nhất, spec đo cạnh được cầm (≥ 0,6·W). Spec đúng: lọc `edge` theo `len ≥ 0,6·W`.
- `graspSolve.ts:665` — đĩa chỉ 4 tên vành; spec "góc, lưới 30°". Dời giai đoạn 4, ghi nợ.
- `holderFace` — code lấy tâm sọ cho hướng ngang; spec viết "giữa hai mắt". Code đúng, sửa spec.
- `graspSolve.ts:374`, `:396` — `thumb` mặc định tay dẫn theo tâm đầu; ghi vào spec.

## 3. Thiếu test
1. `edgeHigh` cạnh ngang trước–sau của tấm nằm, hai tay, hai `thumb`.
2. `chooseMissing` trên món hai khối cùng `part` + `kind`; `later` có `cast`/`s` khác.
3. `handFromItem` vòng kín với `s ≠ 1`, `k ≠ long`, tay trái.
4. `phiAt` qua ranh ±180°; `phiChain` khi `t1` không chia hết `HOLD_SLEW_STEP`; `evalPhi` cổ tay thẳng dưới vai.
5. `itemAt` với `at` + `point`, `tilt`, `camera`; `sceneItemProblems`; `checkItems` bắt `t` không tăng.

## 4. Rủi ro khi nối act3 / world
1. Vòng import `act3 ↔ graspArm/graspSolve` (`markShape`, `twoBone3`, `armFrame`, `AIM_*`): tách sang file lá trước G3-13.
2. Chi phí mỗi khung: `itemAt` dựng `trunk3` cho mỗi mốc kề mỗi khung; nhớ `GraspSolution` và trunk theo `WeakMap<SceneRuntime>`,
   truyền trunk đã có vào `itemAt`.
3. `ItemOptions.chars` tuỳ chọn, thiếu thì `sampleChar(height)` → `check`/MCP ra số khác world. Bắt buộc `chars` ở mọi đường, hay bỏ fallback.

## Quyết định của agent chính
- Nhận hết. Điểm 10: tay dẫn `sheet` không khai `edge` → tấm đứng `bottom`; tấm nằm cạnh về phía tay ấy (`right`/`left`).
- Sửa chia hai job: R1 (`graspSolve`, `graspArm`, `graspGroups`, file lá cho act3; điểm 1, 2, 3, 5, 6, 9, 10, 11, lệch spec `needs`, test
  1–4, rủi ro 1); R2 sau G3-11 (`scene.ts` điểm 4, 7, 8, rủi ro 2–3, test 5, spec mục 4).
