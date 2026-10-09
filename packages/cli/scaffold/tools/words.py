#!/usr/bin/env python
"""Mốc từng chữ của một file tiếng bằng faster-whisper, in JSON ra stdout:
`[{ "w": "chữ", "s": 0.34, "e": 0.66 }, …]`, giây tính từ đầu file.

    .venv/bin/python tools/words.py <file tiếng> [--model=small] [--lang=vi]

`pnpm lipsync` gọi file này; chạy tay khi cần mốc chữ cho việc khác (camera, chữ hiện
theo lời). Cần `faster-whisper` trong `.venv`; model tải về cache của Hugging Face ở lần
chạy đầu.
"""

import json
import sys


def main():
    args = sys.argv[1:]
    files = [a for a in args if not a.startswith("--")]
    if "--help" in args or "-h" in args or len(files) != 1:
        print(__doc__, file=sys.stderr)
        sys.exit(0 if "--help" in args or "-h" in args else 1)
    opt = dict(a[2:].split("=", 1) for a in args if a.startswith("--") and "=" in a)
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        sys.exit("thiếu faster-whisper — `.venv/bin/pip install faster-whisper`")
    model = WhisperModel(opt.get("model", "small"), device="cpu", compute_type="int8")
    segments, _ = model.transcribe(files[0], language=opt.get("lang", "vi"), word_timestamps=True, beam_size=5)
    words = [
        {"w": w.word.strip(), "s": round(w.start, 3), "e": round(w.end, 3)}
        for seg in segments
        for w in seg.words
        if w.word.strip()
    ]
    json.dump(words, sys.stdout, ensure_ascii=False)
    print()


if __name__ == "__main__":
    main()
