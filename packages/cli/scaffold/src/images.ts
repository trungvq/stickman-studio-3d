import { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";

// Sống theo vòng đời tab, mà Remotion seek bằng cách render lại cùng trang — cảnh thứ hai
// trở đi không chờ lại. Xem docs/03 § Remotion.
const ASPECTS: Record<string, number> = {};

/** Số ảnh gọi `decode()` cùng lúc. Gọi cho cả trăm ảnh một lượt thì Chrome xếp hàng chúng
 *  lại và tấm cuối chờ hàng giây — chính chỗ ấy đẻ ra khung thiếu ảnh ở cú cắt khi render
 *  nhiều tab: mỗi tab giành CPU của nhau nên giải mã không kịp hạn chờ. */
const SONG_SONG = 6;

/** Hạn chót cho MỘT ảnh, chỉ để trang không treo khi `decode()` không bao giờ trả lời.
 *  Giải mã theo lô rồi thì không lô nào chạm tới nó — đừng hạ xuống cho "nhanh": hạ là
 *  gate mở lúc ảnh chưa vẽ được, và cú cắt sang cảnh có tấm nền mới lòi ra một khung
 *  thiếu sạch ảnh (chỉ còn phần vẽ bằng code trên nền giấy). Đo trên một tập 43 shot:
 *  hạn 1,5 s cho khung hỏng lặp đúng mỗi `concurrency` khung sau mỗi cú cắt như thế. */
const HAN_CHO = 10_000;

/** Ảnh giải mã xong phải CÒN NGƯỜI GIỮ thì bản giải mã mới nằm lại trong bộ nhớ Chrome.
 *  Gỡ thẻ `<img>` ra khỏi DOM là bản ấy có thể bị dọn, và `<image>` của SVG ở cảnh sau
 *  phải giải mã lại — đúng lúc Remotion chụp khung. Ô này sống hết đời tab. */
let kho: HTMLDivElement | null = null;
const oGiu = () => {
  if (!kho) {
    kho = document.createElement("div");
    kho.style.cssText =
      "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none";
    document.body.appendChild(kho);
  }
  return kho;
};

/** Chờ ảnh về (`onload` là tải xong) rồi đo tỉ lệ khung. Mạng chạy song song cả bộ —
 *  chỗ phải xếp hàng là bước giải mã, không phải bước tải. */
const tai = (file: string, url: string, o: HTMLDivElement) =>
  new Promise<HTMLImageElement | null>((xong) => {
    const img = new Image();
    img.onload = () => {
      ASPECTS[file] = img.naturalWidth / img.naturalHeight || 1;
      xong(img);
    };
    img.onerror = () => {
      ASPECTS[file] = 1;
      xong(null);
    };
    o.appendChild(img);
    img.src = url;
  });

/** `decode()` mới là "vẽ được ngay"; `onload` chỉ là "đã về". Thiếu bước này thì khung đầu
 *  tiên dùng tới ảnh vẫn trống. Kèm hạn chờ vì `decode()` của ảnh rời có thể không bao giờ
 *  trả lời lúc trang đang bận (đo ở Studio: 80/81 ảnh treo dù `onload` đủ cả 81 — ảnh gắn
 *  vào DOM ở `oGiu` là lớp chống thứ hai cho đúng cảnh ấy). */
const giaiMa = (img: HTMLImageElement) =>
  img.decode
    ? Promise.race([
        img.decode().catch(() => {}),
        new Promise<void>((xong) => setTimeout(xong, HAN_CHO)),
      ])
    : Promise.resolve();

/**
 * Gác `<image>` của SVG — thứ Remotion không tự chờ — và đo tỉ lệ khung của từng ảnh, đúng
 * như `mount()` của render và studio vẫn làm. Trả `null` khi chưa xong.
 * `files` khoá theo tên file mảnh, đúng khoá mà `applyAspects` cần.
 */
export const useImagesReady = (files: Readonly<Record<string, string>>) => {
  // `delayRender` phải gọi trong lượt render: tới lúc `useEffect` chạy thì Remotion đã chụp được rồi
  const [pending] = useState(() => {
    const missing = Object.entries(files).filter(([f, u]) => u && ASPECTS[f] === undefined);
    return missing.length
      ? { id: delayRender(`ảnh trong SVG (${missing.length})`), missing }
      : null;
  });
  const [ready, setReady] = useState(!pending);

  useEffect(() => {
    if (!pending) return;
    let huy = false;
    const o = oGiu();
    // Thả hết `src` một lượt — tải chạy song song — rồi mới xếp hàng giải mã theo lô
    const ve = pending.missing.map(([file, url]) => tai(file, url, o));
    (async () => {
      const anh = (await Promise.all(ve)).filter((i): i is HTMLImageElement => i !== null);
      const hang = [...anh];
      const to = async () => {
        while (hang.length && !huy) await giaiMa(hang.shift()!);
      };
      await Promise.all(Array.from({ length: Math.min(SONG_SONG, hang.length) }, to));
      if (huy) return;
      setReady(true);
      continueRender(pending.id);
    })();
    return () => {
      huy = true;
    };
  }, [pending]);

  return ready ? ASPECTS : null;
};
