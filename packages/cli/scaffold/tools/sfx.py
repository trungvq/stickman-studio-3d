#!/usr/bin/env python
"""Dựng tiếng động từ mẫu thu thật CC0: tải gói nguồn (kiểm sha256), cắt, chồng lớp,
chuẩn hoá đỉnh, ghi mp3 kèm xuất xứ và giấy phép từng lớp. Va chạm không tổng hợp
được — gỗ, nước có hàng trăm mode tắt không đều; chỉ nhiễu (rè, gió), chuông nhỏ và
tiếng máy (phím cao su, bíp) mới tổng hợp.

    pnpm sfx                  # gen mã còn thiếu: mọi mã của repo + mã thư viện đang được dùng
    pnpm sfx --force          # gen lại những mã ấy
    pnpm sfx --only=sfx-tom   # một hay vài mã bất kỳ, kể cả mã thư viện chưa ai dùng
    pnpm sfx --all            # cả thư viện
    pnpm sfx list             # mọi mã, của thư viện hay của repo, đã có file chưa
    pnpm sfx --wav            # giữ cả wav trong tmp/ để soi

Hai lớp công thức. **Thư viện** là `LIBRARY` trong file này — tiếng dùng lại được ở mọi
tập, `stickman upgrade` chép lại. **Của repo** là `sfx/recipes.json`, upgrade không đụng;
trùng mã thì bản của repo đè. Mã thư viện chỉ gen khi có chỗ nhắc tới nó: một cue trong
`episodes/*.json`, hay một nguồn trong `sfx/*.json`.

    { "packs": { "<gói>": { "url": "…zip", "sha256": "…", "license": "CC0 — …" } },
      "local": { "<gói>": { "file": "<tên gốc>", "sha256": "…", "url": "<trang nguồn>",
                            "license": "CC-BY — …" } },
      "sfx": {
        "sfx-coc": { "note": "gõ búa vào gỗ",
                     "layers": [{ "pack": "kenney-impact", "sample": "Audio/….ogg",
                                  "start": 0, "end": null, "gain": 1, "delay": 0 }],
                     "post": [{ "fn": "fade", "rise": 0, "fall": 0.2 }] },
        "sfx-bip": { "note": "bíp", "synth": { "fn": "calc_beep" } } } }

`layers` là các lớp mẫu (cắt từ `start` tới `end` giây, nhân `gain`, trễ `delay` so với lớp
đầu); `synth` gọi một hàm trong `SYNTH`; `post` là chuỗi hàm trong `POST`, chạy theo thứ tự.
Tham số của hàm khai cùng object với `fn`.

Gói nguồn tải về `tmp/sfx-src/` (đã gitignore); chỉ mp3 thành phẩm nằm trong repo. Ra
`assets/audio/sfx/<mã>.mp3` + `<mã>.json`, cùng hình dạng với lời dẫn của `tts.py`.
**Mẫu âm bắt đầu ngay tại mẫu 0**: `start` của mỗi lớp cắt sạch khoảng lặng đầu file gốc,
vì cue đặt đúng frame chạm và mọi khoảng trống ở đầu là một cái trễ không ai khai báo.
Mốc cue lấy từ `sceneEvents()` (docs/07), không đo tay.

Cần numpy và ffmpeg. Gói `local` tải tay (vd. Freesound đòi đăng nhập) vào
`tmp/sfx-src/<gói>/<file>`, giữ tên gốc vì nó mang ID tìm ngược được về nguồn; CC-BY thì
phải ghi công trong mô tả video, và `<mã>.json` là chỗ nhớ điều đó.
"""

import hashlib
import json
import re
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

try:
    import numpy as np
except ImportError:
    np = None

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "assets/audio/sfx"  # tiếng động dùng chung giữa các tập
TMP = ROOT / "tmp"
SRC = TMP / "sfx-src"
RECIPES = ROOT / "sfx/recipes.json"
SR = 48000
# Đỉnh sau chuẩn hoá, dBFS. Tiếng động để cao hơn lời dẫn vì nó ngắn; phần chìm nổi
# chỉnh bằng `volume` của cue, không phải ở đây.
PEAK_DB = -1.0

PACKS = {
    "kenney-rpg": {
        "url": "https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip",
        "sha256": "6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b",
        "license": "CC0 — Kenney, kenney.nl/assets/rpg-audio",
    },
    "kenney-impact": {
        "url": "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip",
        "sha256": "029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8",
        "license": "CC0 — Kenney, kenney.nl/assets/impact-sounds",
    },
    "oga-water": {
        "url": "https://opengameart.org/sites/default/files/water-splash-slime-sfx.zip",
        "sha256": "7cd39abb49d4362a37ba18dc0e454c7dc1d08029d4e5b683149046bc237b2eba",
        "license": "CC0 — rubberduck, opengameart.org/content/40-cc0-water-splash-slime-sfx",
    },
    "kenney-jingles": {
        "url": "https://kenney.nl/media/pages/assets/music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip",
        "sha256": "b729ba57959bd58793d2c5cafa348aaf2655d354f3da35ec4729e03ec77197b8",
        "license": "CC0 — Kenney, kenney.nl/assets/music-jingles",
    },
    "oga-keyboard": {
        "url": "https://opengameart.org/sites/default/files/unicae_games_keyboard_soundpack_1_0.zip",
        "sha256": "935eae2fa5c3742eacdd38c4ea0e9047f3887faa0701996498492c256db1b351",
        "license": "CC0 — Unicae Games, opengameart.org/content/keyboard-soundpack-1-typing-and-single-keystrokes",
    },
}
LOCAL = {}


def layer(pack, sample, start=0.0, end=None, gain=1.0, delay=0.0):
    return {"pack": pack, "sample": sample, "start": start, "end": end, "gain": gain, "delay": delay}


# Chọn mẫu bằng số đo (trọng tâm phổ, năng lượng dưới 500 Hz) trước khi nghe: nhát rìu =
# lưỡi cắt thớ (sáng) + khúc gỗ dội (trầm); cú tõm = nước rẽ (ngắn) + bong bóng "tủm" (cao
# độ đi lên).
LIBRARY = {
    "sfx-bo": {
        "note": "nhát rìu bổ vào khúc gỗ",
        "layers": [
            layer("kenney-rpg", "Audio/chop.ogg", 0.045),
            layer("kenney-impact", "Audio/impactWood_medium_000.ogg", gain=0.75, delay=0.004),
        ],
    },
    "sfx-coc": {
        "note": "gõ búa vào gỗ, cốc — khúc gỗ dội, không có lưỡi cắt",
        "layers": [layer("kenney-impact", "Audio/impactWood_medium_000.ogg")],
    },
    "sfx-tom": {
        "note": "vật rơi xuống nước, tõm rồi lặng",
        "layers": [
            layer("oga-water", "splash_10.ogg", 0.020, gain=0.70),
            layer("oga-water", "bubble_02.ogg", 0.050, delay=0.02),
        ],
    },
    "sfx-coong": {
        "note": "vật cứng đập vào nhựa dày (mũ bảo hộ) — bốp rỗng, không ngân",
        "layers": [layer("kenney-impact", "Audio/impactPlank_medium_000.ogg")],
    },
    "sfx-nut": {
        "note": "click UI, bấm nút pause / play — cắt cụt đuôi ngân",
        "layers": [layer("kenney-rpg", "Audio/metalLatch.ogg", end=0.08)],
    },
    "sfx-tiep-dat": {
        "note": "người rơi xuống đất: thân cộp + cỏ sột",
        "layers": [
            layer("kenney-impact", "Audio/impactPunch_medium_000.ogg"),
            layer("kenney-impact", "Audio/footstep_grass_003.ogg", gain=0.55),
        ],
    },
    # Nhiều mẫu luân phiên cho một chuỗi bước, không thì bốn bước một giây nghe ra máy khâu
    "sfx-buoc-1": {
        "note": "bước chân trên cỏ, tối",
        "layers": [layer("kenney-impact", "Audio/footstep_grass_000.ogg")],
    },
    "sfx-buoc-2": {
        "note": "bước chân trên cỏ, sáng",
        "layers": [layer("kenney-impact", "Audio/footstep_grass_001.ogg")],
    },
    "sfx-buoc-da-1": {
        "note": "bước chân trên đá lát, tối",
        "layers": [layer("kenney-impact", "Audio/footstep_concrete_000.ogg")],
    },
    "sfx-buoc-da-2": {
        "note": "bước chân trên đá lát, sáng",
        "layers": [layer("kenney-impact", "Audio/footstep_concrete_001.ogg")],
    },
    "sfx-buoc-da-3": {
        "note": "bước chân trên đá lát, vừa",
        "layers": [layer("kenney-impact", "Audio/footstep_concrete_003.ogg")],
    },
    # Mẫu phím thật có cả nhịp nhấn lẫn nhịp nhả (~0,08 s sau) nên ra cạch-cạch của phím cơ.
    # Ba phím chữ luân phiên cho khỏi đều như máy; phím cách là mẫu trầm nhất của gói.
    "sfx-phim-1": {
        "note": "gõ một phím chữ bàn phím cơ, sáng",
        "layers": [layer("oga-keyboard", "Single Keys/keypress-017.wav", 0.006)],
    },
    "sfx-phim-2": {
        "note": "gõ một phím chữ bàn phím cơ, vừa",
        "layers": [layer("oga-keyboard", "Single Keys/keypress-006.wav", 0.007)],
    },
    "sfx-phim-3": {
        "note": "gõ một phím chữ bàn phím cơ, tối",
        "layers": [layer("oga-keyboard", "Single Keys/keypress-030.wav", 0.018)],
    },
    "sfx-phim-cach": {
        "note": "gõ phím cách bàn phím cơ, trầm",
        "layers": [layer("oga-keyboard", "Single Keys/keypress-028.wav", 0.015)],
    },
    "sfx-het": {
        "note": "sting tấm HẾT, pizzicato kiểu phim cũ",
        "layers": [layer("kenney-jingles", "Audio/Pizzicato jingles/jingles_PIZZI07.ogg")],
    },
    "sfx-het-dut": {
        "note": "cùng sting ấy bị hãm băng lại",
        "layers": [layer("kenney-jingles", "Audio/Pizzicato jingles/jingles_PIZZI07.ogg")],
        "post": [{"fn": "tape_stop", "hold": 0.12, "brake": 0.55}],
    },
    # Băng 120–2400 Hz là máy chiếu trong phòng tối, không phải đài lạc sóng; nhiễu băng rộng
    # hơn bị nén AAC băm thành lắc rắc. Đường bao vào/ra để `volume` của cue lo.
    "sfx-re": {
        "note": "rè máy chiếu, nền cho tấm credit hay iris",
        "synth": {"fn": "static", "seed": 23, "lo": 120, "hi": 2400, "crackle_per_s": 9,
                  "hum_gain": 0.02, "mod": 0.30, "seconds": 6.0},
    },
    # Gió nướng sẵn đường bao vào file: to lên thì phải sáng lên theo, `volume` chỉ vặn được
    # âm lượng. `seconds` khớp `span` của hiệu ứng `gust`; đổi bên kia thì gen lại
    "sfx-gio": {
        "note": "một cơn gió thổi qua",
        "synth": {"fn": "wind", "seed": 16, "lo": 140, "hi": 1900, "rise": 1.3, "fall": 1.8,
                  "mod": 0.35, "seconds": 4.8},
    },
    "sfx-ting": {
        "note": "chuông nhỏ, chữ ký kết kênh",
        "synth": {"fn": "ting", "f0": 2093, "partials": [[1, 1.0], [2.76, 0.4], [5.40, 0.18]],
                  "decays": [1.1, 0.45, 0.18], "strike": 0.35, "seconds": 1.6},
    },
    # Không trượt cao độ: chuỗi pop liên tiếp không nghe thành "chiu chiu"
    "sfx-pop": {
        "note": "pop nhẹ, ngắn, trầm — món hiện ra trong bong bóng thoại",
        "synth": {"fn": "soft_pop"},
    },
    "sfx-bam": {
        "note": "bấm phím máy tính bỏ túi, cạch",
        "synth": {"fn": "key_click"},
    },
    "sfx-so-chay": {
        "note": "số trên màn máy tính chạy loạn, tích tích nhỏ dần",
        "synth": {"fn": "digit_roll", "seconds": 0.85, "rate": 30},
    },
    "sfx-bip": {
        "note": "bíp máy tính báo tràn số",
        "synth": {"fn": "calc_beep"},
    },
}


def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


def pack(name):
    """Tải gói nếu chưa có, kiểm sha256, giải nén vào `tmp/sfx-src/<mã>/`."""
    if name in LOCAL:
        spec = LOCAL[name]
        root = SRC / name
        f = root / spec["file"]
        if not f.exists():
            die(f"{name}: thiếu {f}\n  Tải tay ở {spec['url']} rồi chép vào {root}/")
        got = hashlib.sha256(f.read_bytes()).hexdigest()
        if got != spec["sha256"]:
            die(f"{name}: sha256 lệch\n  chờ {spec['sha256']}\n  được {got}\n  ({f})")
        return root
    if name not in PACKS:
        die(f"không có gói {name} — khai ở `packs` hay `local` của {RECIPES.relative_to(ROOT)}")
    spec = PACKS[name]
    root = SRC / name
    if root.exists():
        return root
    SRC.mkdir(parents=True, exist_ok=True)
    zip_path = SRC / f"{name}.zip"
    if not zip_path.exists():
        print(f"… tải {name}", file=sys.stderr)
        urllib.request.urlretrieve(spec["url"], zip_path)
    got = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    if got != spec["sha256"]:
        die(f"{name}: sha256 lệch\n  chờ {spec['sha256']}\n  được {got}\n  ({spec['url']})")
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(root)
    return root


def license_of(name):
    return (PACKS.get(name) or LOCAL.get(name) or {}).get("license")


def load(path, start, end, gain):
    """Đọc một file mẫu qua ffmpeg → mono 48k float, cắt và nhân biên độ."""
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", str(path), "-f", "s16le", "-ac", "1", "-ar", str(SR), "-"],
        capture_output=True,
        check=True,
    ).stdout
    x = np.frombuffer(raw, "<i2").astype(float) / 32768
    return x[int(start * SR) : int(end * SR) if end else len(x)] * gain


def peak(x, db=PEAK_DB):
    """Chuẩn hoá đỉnh. `build()` đã chuẩn một lần *trước* hậu xử lý, nên chuỗi `post` nào
    cộng thêm năng lượng (`weight`) phải kết bằng `peak`, không thì `write_audio()` kẹp
    mất đỉnh."""
    return x / np.abs(x).max() * 10 ** (db / 20)


def trim(x, seconds):
    return x[: int(seconds * SR)]


def fade(x, rise=0.0, fall=0.0):
    """Vào/ra bằng nửa chu kỳ cos: mép cắt của mẫu thu thật không còn cạch."""
    y = x.copy()
    k = int(rise * SR)
    if k:
        y[:k] *= np.sin(0.5 * np.pi * np.arange(k) / k) ** 2
    k = int(fall * SR)
    if k:
        y[-k:] *= np.cos(0.5 * np.pi * np.arange(k) / k) ** 2
    return y


def ramp(x, seconds, floor):
    """Dâng từ `floor` lên 1 trong `seconds` giây rồi giữ — nền dày lên theo hình."""
    t = np.arange(len(x)) / SR
    return x * (floor + (1 - floor) * np.clip(t / seconds, 0, 1))


def band(x, lo, hi):
    """Lọc băng bằng FFT: dốc bậc hai đầu thấp, bậc bốn đầu cao. Không cần scipy."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X * ((f / lo) ** 2 / (1 + (f / lo) ** 2)) * (1 / (1 + (f / hi) ** 4)), n=len(x))


def weight(x, gain, lo=20, hi=170):
    """Kệ trầm: cộng lại phần dưới `hi` rút từ chính tín hiệu, `gain` lần. Bản thu ở xa (mẫu
    gen bằng ElevenLabs hay thế) chỉ còn 6-13 % năng lượng dưới 300 Hz, nghe ra sỏi lạo xạo
    chứ không ra móng guốc — vật nặng bao nhiêu nằm ở cái kệ này."""
    return x + gain * band(x, lo, hi)


def tape_stop(x, hold, brake):
    """Băng bị hãm: chạy đúng tốc độ `hold` giây rồi phanh đều về 0 trong `brake` giây. Đọc
    lại nguồn bằng hàm thời gian cong nên cao độ tụt theo tốc độ — giảm biên độ suông chỉ
    ra nhỏ dần. Cả cú phanh chỉ ăn `brake / 2` giây tiếng gốc."""
    n = int((hold + brake) * SR)
    tau = np.arange(n) / SR
    u = np.clip(tau - hold, 0, brake) / brake
    src = np.minimum(tau, hold) + brake * (u - u * u / 2)
    y = np.interp(src * SR, np.arange(len(x)), x, right=0.0)
    k = int(0.04 * SR)
    y[-k:] *= np.linspace(1, 0, k)
    return y


def retime(x, period, min_gap=0.4, thresh=0.25):
    """Kéo từng sải về đúng `period` giây: dò mốc sải bằng đường bao 5 ms (vượt `thresh`
    của đỉnh sau ít nhất `min_gap` giây im hơn), rồi resample từng đoạn mốc→mốc cho dài
    đúng `period`. Cao độ đi theo tốc độ — kéo dài ra là trầm và nặng đi. Mẫu 0 là cú chạm
    đầu tiên; sải cuối bỏ vì không có mốc đóng."""
    n = int(0.005 * SR)
    k = len(x) // n
    e = np.sqrt((x[: k * n].reshape(k, n) ** 2).mean(1))
    th = thresh * e.max()
    marks, last = [], -1
    for i in range(1, k):
        if e[i] > th and e[i - 1] <= th and (last < 0 or i - last >= int(min_gap / n * SR)):
            marks.append(i * n)
            last = i
    if len(marks) < 2:
        die(f"retime: chỉ dò được {len(marks)} mốc sải, hạ `thresh` hay `min_gap`")
    L = int(period * SR)
    out = []
    for a, b in zip(marks, marks[1:]):
        seg = x[a:b]
        out.append(np.interp(np.linspace(0, len(seg) - 1, L), np.arange(len(seg)), seg))
    return np.concatenate(out)


def tile(x, seconds):
    """Lát bản thân cho đủ dài. Dùng sau `retime`: mối nối rơi đúng mốc sải nên nhịp không
    hụt, và cú chạm che chỗ nối."""
    return np.tile(x, int(seconds * SR) // len(x) + 1)[: int(seconds * SR)]


def static(seed, lo, hi, crackle_per_s, hum_gain, mod, seconds):
    """Tiếng rè: nhiễu lọc băng (`lo/hi` quyết định đang nghe cái máy gì), đường bao chậm
    (`mod`, thiếu là phẳng lì như máy lạnh), hạt lụp bụp thưa, và 50 Hz điện lưới rất nhỏ
    cho ra đồ điện chứ không ra gió."""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    x = band(rng.standard_normal(n), lo, hi)
    x = x / np.abs(x).max()
    e = band(rng.standard_normal(n), 0.05, 3.5)
    x *= (1 - mod) + mod * (0.5 + 0.5 * e / np.abs(e).max())
    pops = np.zeros(n)
    for i in rng.choice(n, size=int(crackle_per_s * seconds), replace=False):
        L = min(int(0.024 * SR), n - i)
        if L <= 0:
            continue
        pops[i : i + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (0.004 * SR)) * rng.uniform(0.3, 1.0)
    x += band(pops, 1500, 9000) * 0.55
    if hum_gain:
        t = np.arange(n) / SR
        x += hum_gain * (np.sin(2 * np.pi * 50 * t) + 0.4 * np.sin(2 * np.pi * 100 * t) + 0.2 * np.sin(2 * np.pi * 150 * t))
    return peak(x)


def wind(seed, lo, hi, rise, fall, mod, seconds):
    """Gió: hai lớp từ một nguồn nhiễu — thân trầm và rít sáng — lớp rít nhân đường bao mũ
    1.5 nên **to lên thì sáng lên**, đó là chỗ tai nghe ra gió chứ không ra máy sấy.
    Không hum, không hạt: hai dấu hiệu của đồ điện."""
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    src = rng.standard_normal(n)
    body = band(src, lo, lo * 3)
    hiss = band(src, lo * 2.5, hi)
    body /= np.abs(body).max()
    hiss /= np.abs(hiss).max()
    t = np.arange(n) / SR
    env = np.ones(n)
    k = t < rise
    env[k] = np.sin(0.5 * np.pi * t[k] / rise) ** 2
    k = t > seconds - fall
    env[k] = np.cos(0.5 * np.pi * (t[k] - (seconds - fall)) / fall) ** 2
    e = band(rng.standard_normal(n), 0.3, 2.5)
    env *= (1 - mod) + mod * (0.5 + 0.5 * e / np.abs(e).max())
    x = env * (body + 0.9 * hiss * env**1.5)
    k = int(0.04 * SR)
    x[-k:] *= np.linspace(1, 0, k)
    return peak(x)


def ting(f0, partials, decays, strike, seconds):
    """Chuông nhỏ: vài thành phần tắt theo hàm mũ với tỉ số không nguyên (bộ thanh gõ
    1 / 2.76 / 5.40), mỗi cái chồng thêm bản lệch 0.3% cho hai mode đập vào nhau, cộng
    20 ms nhiễu sáng ở đầu — thiếu cú gõ ấy chuông vào như ai vặn volume lên."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for (ratio, gain), tau in zip(partials, decays):
        f = f0 * ratio
        x += gain * np.exp(-t / tau) * (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.003 * t))
    rng = np.random.default_rng(11)
    k = int(0.02 * SR)
    x[:k] += strike * band(rng.standard_normal(k) * np.exp(-np.arange(k) / (0.002 * SR)), 3000, 12000)
    k = int(0.03 * SR)
    x[-k:] *= np.linspace(1, 0, k)
    return peak(x)


def soft_pop(freq=360, seconds=0.075, db=-12):
    """Bụp ngắn: thân `freq` Hz tắt nhanh, chút hơi lọc tối, vào mềm 1 ms. Đỉnh riêng thấp
    để cue mặc định vẫn nhẹ khi bật liên tiếp mỗi 100 ms."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    attack = 1 - np.exp(-t / 0.001)
    x = np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.009)
    rng = np.random.default_rng(7)
    breath = band(rng.standard_normal(n), 250, 1400)
    breath /= np.abs(breath).max()
    x = attack * (x + 0.22 * breath * np.exp(-t / 0.006))
    k = int(0.01 * SR)
    x[-k:] *= np.linspace(1, 0, k)
    return peak(x, db)


def key_click(db=-8):
    """Cạch phím cao su: 25 ms nhiễu lọc 1,5–6 kHz tắt rất nhanh, cộng cú thụp 180 Hz mờ của
    vỏ nhựa. Không có cao độ để bấm 10 lần/giây không nghe thành giai điệu."""
    n = int(0.05 * SR)
    t = np.arange(n) / SR
    rng = np.random.default_rng(31)
    click = band(rng.standard_normal(n), 1500, 6000) * np.exp(-t / 0.003)
    click /= np.abs(click).max()
    x = click + 0.5 * np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.008)
    k = int(0.01 * SR)
    x[-k:] *= np.linspace(1, 0, k)
    return peak(x, db)


def digit_roll(seconds, rate, db=-10):
    """Chuỗi tích nhỏ đều nhịp `rate`/s, mỗi tích là click ngắn 6 ms, nhỏ dần về cuối."""
    n = int(seconds * SR)
    x = np.zeros(n)
    rng = np.random.default_rng(5)
    k = int(0.006 * SR)
    tk = np.arange(k) / SR
    count = int(seconds * rate)
    for i in range(count):
        s = int(i / rate * SR)
        tick = band(rng.standard_normal(k), 2500, 8000) * np.exp(-tk / 0.0012)
        tick /= np.abs(tick).max()
        x[s : s + k] += tick[: n - s] * (1 - 0.5 * i / (seconds * rate))
    return peak(x, db)


def calc_beep(freq=1200, db=-6):
    """Hai nốt vuông 90 ms và 140 ms cách 40 ms, lọc bớt răng cưa, như loa áp điện của máy
    tính rẻ tiền."""

    def note(dur):
        t = np.arange(int(dur * SR)) / SR
        y = band(np.sign(np.sin(2 * np.pi * freq * t)), 300, 5000)
        return y * np.minimum(1, t / 0.004) * np.minimum(1, (dur - t) / 0.01)

    return peak(np.concatenate([note(0.09), np.zeros(int(0.04 * SR)), note(0.14)]), db)


SYNTH = {f.__name__: f for f in (static, wind, ting, soft_pop, key_click, digit_roll, calc_beep)}
POST = {f.__name__: f for f in (peak, trim, fade, ramp, band, weight, tape_stop, retime, tile)}


def build(layers):
    parts = [(load(pack(l["pack"]) / l["sample"], l["start"], l["end"], l["gain"]), l["delay"]) for l in layers]
    n = max(len(x) + int(d * SR) for x, d in parts)
    out = np.zeros(n)
    for x, d in parts:
        i = int(d * SR)
        out[i : i + len(x)] += x
    return peak(out)


def call(table, spec, code):
    fn = table.get(spec.get("fn"))
    if not fn:
        die(f"{code}: không có hàm `{spec.get('fn')}` — có: {', '.join(table)}")
    kw = {k: v for k, v in spec.items() if k != "fn"}
    return lambda *x: fn(*x, **kw)


def write_audio(x, path, bitrate=None):
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", str(SR), "-ac", "1",
         "-i", "pipe:0", *(["-b:a", bitrate] if bitrate else []), str(path)],
        input=pcm.tobytes(),
        check=True,
    )


def load_recipes():
    """Công thức của repo: gói thêm vào `PACKS` / `LOCAL`, mã đè lên `LIBRARY`."""
    if not RECIPES.exists():
        return {}
    try:
        raw = json.loads(RECIPES.read_text(encoding="utf8"))
    except json.JSONDecodeError as e:
        die(f"{RECIPES.relative_to(ROOT)}: JSON hỏng — {e}")
    PACKS.update(raw.get("packs") or {})
    LOCAL.update(raw.get("local") or {})
    own = {}
    for code, r in (raw.get("sfx") or {}).items():
        if ("layers" in r) == ("synth" in r):
            die(f"{RECIPES.relative_to(ROOT)}: {code} phải có đúng một trong `layers` và `synth`")
        own[code] = {**r, "layers": [layer(**l) for l in r["layers"]]} if "layers" in r else r
    return own


def referenced(codes):
    """Mã được nhắc tới trong `episodes/*.json` hay `sfx/*.json`."""
    text = "".join(
        p.read_text(encoding="utf8")
        for d in (ROOT / "episodes", ROOT / "sfx")
        if d.exists()
        for p in sorted(d.glob("*.json"))
    )
    return {c for c in codes if re.search(rf"(?<![\w-]){re.escape(c)}(?![\w-])", text)}


def main():
    args = sys.argv[1:]
    if "--help" in args or "-h" in args:
        print(__doc__)
        return
    own = load_recipes()
    recipes = {**LIBRARY, **own}
    if args and args[0] == "list":
        for code, r in recipes.items():
            where = "repo" if code in own else "thư viện"
            have = "có file" if (AUDIO / f"{code}.mp3").exists() else "chưa gen"
            print(f"{code:16s} {where:9s} {have:9s} {r['note']}")
        return
    only = next((a[len("--only=") :].split(",") for a in args if a.startswith("--only=")), None)
    if only:
        missing = sorted(set(only) - set(recipes))
        if missing:
            die(f"không có mã {', '.join(missing)} — `pnpm sfx list` để xem")
        wanted = only
    elif "--all" in args:
        wanted = list(recipes)
    else:
        wanted = [c for c in recipes if c in own or c in referenced(LIBRARY)]
        if not wanted:
            print("chưa có mã nào để gen: repo chưa khai sfx/recipes.json, episodes/ chưa nhắc mã thư viện nào"
                  " — `pnpm sfx list` xem thư viện, `--only=<mã>` gen một mã")
            return
    if np is None:
        die("thiếu numpy — chạy bằng `.venv/bin/python` (`pnpm sfx` đã trỏ sẵn)")
    force = "--force" in args
    keep_wav = "--wav" in args
    AUDIO.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(exist_ok=True)

    for code in wanted:
        r = recipes[code]
        mp3 = AUDIO / f"{code}.mp3"
        if mp3.exists() and not force:
            print(f"· {code}  đã có, bỏ qua")
            continue
        x = call(SYNTH, r["synth"], code)() if "synth" in r else build(r["layers"])
        for step in r.get("post") or []:
            x = call(POST, step, code)(x)
        write_audio(x, mp3, "192k")
        if keep_wav:
            write_audio(x, TMP / f"{code}.wav")
        meta = {
            "file": f"{code}.mp3",
            "note": r["note"],
            "source": "sfx/recipes.json" if code in own else "tools/sfx.py",
            "duration": len(x) / SR,
            **(
                {"synth": r["synth"], "license": "CC0 — tự sinh, seed cố định"}
                if "synth" in r
                else {"layers": [{**l, "license": license_of(l["pack"])} for l in r["layers"]]}
            ),
            **({"post": r["post"]} if r.get("post") else {}),
        }
        (AUDIO / f"{code}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
        print(f"✓ {code}  {len(x) / SR:.2f}s  {r['note']}")


if __name__ == "__main__":
    main()
