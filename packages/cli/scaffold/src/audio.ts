import { useEffect, useMemo, useState } from "react";
import { getRemotionEnvironment } from "remotion";

// Sống theo vòng đời tab như bảng tỉ lệ ảnh ở `images.ts`: Remotion seek bằng cách render lại
// cùng trang, nên cảnh thứ hai trở đi không phải đo lại.
//
// **Khoá theo URL, không theo tên file.** Bundler băm nội dung vào tên URL, nên gen lại một
// cue cùng tên là ra URL mới và phải đo lại; khoá theo tên thì tab Studio đang mở vẫn cắt cue
// theo độ dài cũ — bản gen dài hơn là cụt đuôi câu.
const DURATIONS: Record<string, number> = {};

/**
 * Đo độ dài từng file tiếng, để `<Sequence>` của mỗi cue có `durationInFrames`: **hết tiếng là
 * tháo thẻ `<audio>` ra khỏi cây**. Không có nó thì cue nào đã kêu là sống tới hết shot — shot
 * dày tiếng bước chân có hơn trăm thẻ cùng lúc và preview tụt xuống 3-4 khung/giây.
 *
 * Đo từ chính file như `useImagesReady` đo tỉ lệ ảnh, không khai số trong JSON: số khai tay sẽ
 * cũ đi lúc thay file tiếng.
 *
 * Khác `useImagesReady` ở chỗ **không gác `delayRender`**: độ dài tiếng không đổi hình của khung
 * nào. Chưa đo xong thì cue giữ nếp cũ (sống tới hết shot), đo xong lượt render sau mới cắt.
 *
 * **Lúc render thì không đo, cue nào cũng sống tới hết shot.** Remotion nhận ra một cue là cùng
 * một tiếng qua id có `durationInFrames` của `<Sequence>` bọc nó. Mỗi tab render đo xong ở một
 * lúc khác nhau (tab còn đụng trần WebMediaPlayer của Chrome), nên cùng một cue khung này có độ
 * dài, khung kia không: id đổi, Remotion cắt cue thành nhiều mẩu, mỗi mẩu resample riêng lệch
 * nhau ~16 mẫu — chỗ nối nổ lách tách. Render không
 * phát thẻ `<audio>` nào nên thẻ thừa không tốn gì.
 */
export const useAudioDurations = (files: Readonly<Record<string, string>>) => {
  const [tick, bump] = useState(0);
  const rendering = getRemotionEnvironment().isRendering;

  useEffect(() => {
    if (rendering) return;
    const missing = Object.values(files).filter((u) => u && DURATIONS[u] === undefined);
    if (!missing.length) return;
    let left = missing.length;
    const done = (url: string, seconds: number) => {
      DURATIONS[url] = seconds;
      if (--left === 0) bump((n) => n + 1);
    };
    const els = missing.map((url) => {
      const el = new Audio();
      el.preload = "metadata";
      // File hỏng hay không đo được thì ghi 0: coi như không biết, cue quay về nếp cũ
      el.onloadedmetadata = () => done(url, Number.isFinite(el.duration) ? el.duration : 0);
      el.onerror = () => done(url, 0);
      el.src = url;
      return el;
    });
    return () => {
      for (const el of els) {
        el.onloadedmetadata = null;
        el.onerror = null;
        el.src = "";
      }
    };
  }, [files, rendering]);

  // Trả bảng theo tên file cho `Episode.tsx`, nhưng số lấy qua URL hiện tại của tên ấy
  return useMemo(
    () =>
      Object.fromEntries(
        Object.entries(files).map(([f, u]) => [f, rendering ? undefined : DURATIONS[u]]),
      ) as Record<string, number | undefined>,
    // `tick` chỉ để tính lại sau mỗi lượt đo xong
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files, tick, rendering],
  );
};
