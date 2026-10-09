#!/usr/bin/env python3
"""Dựng các bè tiếng lặp trong `assets/audio/sfx/`.

    pnpm sfx-loop                     # bè của repo + bè thư viện đang được dùng
    pnpm sfx-loop --only=sfx-buoc-vua
    pnpm sfx-loop list

Một bè lặp thay cho cả chuỗi cue rời: cue khai `loop` (độ dài một vòng) cùng `dur` thì
`<Loop>` của Remotion chỉ giữ **một** thẻ `<audio>` trên cây, thay vì hàng trăm thẻ.

Hai cách dựng một vòng:

- **lát**: xếp các tiếng rời đang có (mã của `sfx.py` / `sfx-el.py`) theo nhịp. Đuôi tiếng
  tràn qua mốc cuối vòng được cộng ngược về đầu, nên phát lại không nghe thấy chỗ nối.
- **cắt**: lấy thẳng một đoạn dài từ bản ghi thật — nhịp lệch nhau tự nhiên, không nghe ra
  máy. Hai đầu vòng đặt ở chỗ lặng giữa hai nhịp, nối bằng crossfade `XFADE`, rồi chuẩn
  hoá về `lufs`.

Ghi ra `.wav` chứ không `.mp3`: mp3 có khoảng đệm của bộ mã hoá, lặp lại là hụt một nhịp.
Độ dài vòng phải tròn frame ở fps đang dùng, và `episodes/*.json` khai đúng số ấy ở `loop`.

Bè thư viện là `LIBRARY` trong file này; bè của repo ở `sfx/loops.json`, `stickman upgrade`
không đụng, trùng tên thì bản của repo đè. Bè thư viện chỉ dựng khi `episodes/*.json` nhắc
tới nó.

    { "loops": {
        "sfx-khau": { "length": 0.8,
                      "hits": [{ "files": ["sfx-khau-1", "sfx-khau-2"], "every": 0.2, "count": 4 }] },
        "sfx-vo-canh": { "length": 12.8,
                         "cut": { "file": "sfx-vo-canh-nen.mp3", "start": 0.91, "lufs": -22.3,
                                  "license": "CC0 — …" } } } }

`hits[]`: `count` tiếng cách nhau `every` giây, xoay vòng qua `files` (tên trong
`assets/audio/sfx/`, không đuôi), bắt đầu ở `at` giây, nhân `gain`. `cut.file` tính từ
`assets/audio/sfx/`. Cần ffmpeg và ffprobe.
"""

import array
import json
import math
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
A = ROOT / "assets/audio/sfx"  # tiếng động dùng chung giữa các tập
TABLE = ROOT / "sfx/loops.json"
# Chừa 1 dB dưới trần; tổng nhiều tiếng chồng nhau dễ vượt 1.0 và bị kẹp
PEAK_DB = -1.0
XFADE = 0.03
SR = 48000


def hits(files, every=0.0, count=1, gain=1.0, at=0.0):
    return {"files": files, "every": every, "count": count, "gain": gain, "at": at}


BUOC = ["sfx-buoc-1", "sfx-buoc-2"]

# 60 fps: 0,9 · 1,2 · 1,5 s đều tròn frame
LIBRARY = {
    # bước chân chậm: một bước mỗi 0,5 s, hai mẫu xoay vòng
    "sfx-buoc-cham": {"length": 1.5, "hits": [hits(BUOC, 0.5, 3)]},
    # bước vừa: bước mạnh mỗi 0,4 s, bước nhẹ lệch nửa nhịp — ra hai người
    "sfx-buoc-vua": {"length": 1.2, "hits": [hits(BUOC, 0.4, 3), hits(BUOC[::-1], 0.4, 3, 0.6, 0.2)]},
    # bước nhanh: mỗi 0,3 s, kèm bước lệch 15 ms cho ra hai người đi sát nhau
    "sfx-buoc-nhanh": {"length": 0.9, "hits": [hits(BUOC, 0.3, 3), hits(BUOC, 0.3, 3, 0.6, 0.015)]},
}


def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


def load_table():
    if not TABLE.exists():
        return {}
    try:
        raw = json.loads(TABLE.read_text(encoding="utf8"))
    except json.JSONDecodeError as e:
        die(f"{TABLE.relative_to(ROOT)}: JSON hỏng — {e}")
    own = {}
    for name, spec in (raw.get("loops") or {}).items():
        if not spec.get("length") or ("hits" in spec) == ("cut" in spec):
            die(f"{TABLE.relative_to(ROOT)}: {name} phải có `length` và đúng một trong `hits`, `cut`")
        if "hits" in spec:
            spec = {**spec, "hits": [hits(**h) for h in spec["hits"]]}
        own[name] = spec
    return own


def expand(groups):
    """[(mã nguồn, giây trong vòng, hệ số biên độ)]"""
    return [
        (g["files"][i % len(g["files"])], g["at"] + i * g["every"], g["gain"])
        for g in groups
        for i in range(g["count"])
    ]


def build(name, L, tiles, gain=1.0):
    ins, parts, labels = [], [], []
    for i, (f, t, g) in enumerate(tiles):
        ins += ["-i", str(A / f"{f}.mp3")]
        parts.append(f"[{i}:a]adelay={round(t * 1000)}:all=1,volume={g * gain}[a{i}]")
        labels.append(f"[a{i}]")
    parts.append(
        f"{''.join(labels)}amix=inputs={len(tiles)}:duration=longest:normalize=0,"
        f"apad=whole_dur={2 * L},atrim=0:{2 * L}[bed]"
    )
    parts.append("[bed]asplit=2[b1][b2]")
    parts.append(f"[b1]atrim=0:{L},asetpts=PTS-STARTPTS[h]")
    parts.append(f"[b2]atrim={L}:{2 * L},asetpts=PTS-STARTPTS[t]")
    parts.append("[h][t]amix=inputs=2:duration=longest:normalize=0[out]")
    out = A / f"{name}.wav"
    ff = ["ffmpeg", "-y", "-v", "error", *ins, "-filter_complex", ";".join(parts), "-map", "[out]",
          "-ac", "1", "-ar", str(SR)]
    # đo đỉnh thật ở float: viết thẳng s16 thì tổng vượt 1.0 bị kẹp, đo ra -0.0 dB giả
    probe = subprocess.run([*ff, "-c:a", "pcm_f32le", "-f", "wav", "-"], capture_output=True)
    subprocess.run([*ff, "-c:a", "pcm_s16le", str(out)], check=True)
    return out, probe.stdout


def peak_float(wav_bytes):
    i = wav_bytes.find(b"data")
    pcm = wav_bytes[i + 8 :]
    a = array.array("f")
    a.frombytes(pcm[: len(pcm) // 4 * 4])
    return max((abs(x) for x in a), default=0.0)


def build_tiles(name, L, groups):
    tiles = expand(groups)
    missing = sorted({f for f, _, _ in tiles if not (A / f"{f}.mp3").exists()})
    if missing:
        print(f"{name:16} bỏ qua — thiếu {', '.join(missing)} (`pnpm sfx --only={','.join(missing)}`)")
        return
    target = 10 ** (PEAK_DB / 20)
    out, raw = build(name, L, tiles)
    m = peak_float(raw)
    if m > target:
        out, raw = build(name, L, tiles, gain=target / m)
        m = peak_float(raw)
    db = round(20 * math.log10(m), 1) if m else None
    print(f"{name:16} vòng={L}s  file={duration(out):.3f}s  đỉnh={db} dB  "
          f"{os.path.getsize(out) // 1024} KB  ({len(tiles)} tiếng)")


def build_cut(name, L, cut):
    src = A / cut["file"]
    if not src.exists():
        print(f"{name:16} bỏ qua — thiếu {src.relative_to(ROOT)}")
        return
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-ss", str(cut.get("start", 0)), "-t", str(L + XFADE), "-i", str(src),
         "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        capture_output=True, check=True,
    ).stdout
    x = array.array("f")
    x.frombytes(raw[: len(raw) // 4 * 4])
    n, k = round(L * SR), round(XFADE * SR)
    if len(x) < n + k:
        die(f"{name}: {cut['file']} không đủ dài cho một vòng {L}s từ giây {cut.get('start', 0)}")
    loop = x[:n]
    # vòng liền mối: phần tràn qua mốc L mờ dần, đè lên đầu vòng đang rõ dần
    for i in range(k):
        r = math.sin(math.pi / 2 * i / (k - 1)) ** 2
        loop[i] = loop[i] * r + x[n + i] * (1 - r)
    out = A / f"{name}.wav"
    lufs = cut.get("lufs", -23.0)
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "pipe:0",
         "-af", f"loudnorm=I={lufs}:TP={PEAK_DB}:LRA=20:linear=true", "-ar", str(SR),
         "-c:a", "pcm_s16le", str(out)],
        input=loop.tobytes(), check=True,
    )
    (A / f"{name}.json").write_text(
        json.dumps(
            {"file": out.name, "source": "tools/sfx-loop.py", "from": cut["file"], "start": cut.get("start", 0),
             "loop": L, "lufs": lufs, "license": cut.get("license")},
            ensure_ascii=False, indent=2,
        ) + "\n",
        encoding="utf8",
    )
    print(f"{name:16} vòng={L}s  cắt từ {cut['file']} @ {cut.get('start', 0)}s  {lufs} LUFS")


def duration(p):
    return float(subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
        capture_output=True, text=True,
    ).stdout.strip())


def referenced(names):
    text = "".join(p.read_text(encoding="utf8") for p in sorted((ROOT / "episodes").glob("*.json")))
    return {n for n in names if re.search(rf"(?<![\w-]){re.escape(n)}(?![\w-])", text)}


def main():
    args = sys.argv[1:]
    if "--help" in args or "-h" in args:
        print(__doc__)
        return
    own = load_table()
    loops = {**LIBRARY, **own}
    if args and args[0] == "list":
        for name, spec in loops.items():
            kind = "cắt" if "cut" in spec else "lát"
            have = "có file" if (A / f"{name}.wav").exists() else "chưa dựng"
            print(f"{name:16} {'repo' if name in own else 'thư viện':9s} {kind}  vòng={spec['length']}s  {have}")
        return
    only = next((a[len("--only=") :].split(",") for a in args if a.startswith("--only=")), None)
    if only:
        missing = sorted(set(only) - set(loops))
        if missing:
            die(f"không có bè {', '.join(missing)} — `pnpm sfx-loop list` để xem")
        wanted = only
    else:
        wanted = [n for n in loops if n in own or n in referenced(LIBRARY)]
        if not wanted:
            print("chưa có bè nào để dựng: repo chưa khai sfx/loops.json, episodes/ chưa nhắc bè thư viện nào")
            return
    A.mkdir(parents=True, exist_ok=True)
    for name in wanted:
        spec = loops[name]
        if "cut" in spec:
            build_cut(name, spec["length"], spec["cut"])
        else:
            build_tiles(name, spec["length"], spec["hits"])


if __name__ == "__main__":
    main()
