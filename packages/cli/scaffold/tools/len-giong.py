#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy", "praat-parselmouth"]
# ///
"""Nâng giọng cuối câu hỏi cho một file wav (PSOLA của Praat), ghi đè tại chỗ hoặc ra file khác.

    uv run tools/len-giong.py <vào.wav> [<ra.wav>] [--st=5] [--dai=0.2]

Engine TTS hay đọc 「？」 như câu kể: mora cuối hạ giọng, và tag ngữ điệu hay cách viết
khác (「？？」, 「いいー？」) không cứu được. Nên chỉnh cao độ sau khi gen.

Cách làm: tìm đoạn hữu thanh cuối cùng, trong `--dai` giây cuối của nó kéo F0 lên dần tới
`--st` bán cung (đường cong êm, không bậc), giữ nguyên độ dài và phần còn lại của câu.
`tts-blocks.py` tự gọi tool này cho cue khai `(len: <bán cung>)`. Đọc wav PCM 16-bit mono.
"""

import sys
import wave

import numpy as np
import parselmouth
from parselmouth.praat import call

args = [a for a in sys.argv[1:] if not a.startswith("--")]
if not args or "--help" in sys.argv:
    print(__doc__)
    sys.exit(0 if args else 1)


def flag(name, default):
    for a in sys.argv[1:]:
        if a.startswith(f"--{name}="):
            return float(a.split("=", 1)[1])
    return default


src, dst = args[0], args[1] if len(args) > 1 else args[0]
ST, DAI = flag("st", 5.0), flag("dai", 0.2)

w = wave.open(src)
sr, n = w.getframerate(), w.getnframes()
x = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float64) / 32768
w.close()
snd = parselmouth.Sound(x, sampling_frequency=sr)

pitch = snd.to_pitch_ac(time_step=0.01, pitch_floor=60, pitch_ceiling=350)
f = pitch.selected_array["frequency"]
t = pitch.xs()
voiced = np.nonzero(f > 0)[0]
if not len(voiced):
    sys.exit(f"{src}: không thấy đoạn hữu thanh")
t_het = t[voiced[-1]]
t_dau = t_het - DAI

man = call(snd, "To Manipulation", 0.01, 60, 350)
tier = call(man, "Extract pitch tier")
m = call(tier, "Get number of points")
pts = [(call(tier, "Get time from index", i), call(tier, "Get value at index", i)) for i in range(1, m + 1)]
call(tier, "Remove points between", t_dau, t[-1] + 1)
for tt, v in pts:
    if tt >= t_dau:
        u = min((tt - t_dau) / DAI, 1.0)
        call(tier, "Add point", tt, v * 2 ** (ST * (u * u * (3 - 2 * u)) / 12))
call([tier, man], "Replace pitch tier")
out = call(man, "Get resynthesis (overlap-add)")

y = np.clip(out.values[0], -1, 1)
o = wave.open(dst, "wb")
o.setnchannels(1)
o.setsampwidth(2)
o.setframerate(sr)
o.writeframes((y * 32767).astype(np.int16).tobytes())
o.close()
print(f"{dst}: +{ST:g} st trong {DAI:g}s cuối (hết tiếng ở {t_het:.2f}s)")
