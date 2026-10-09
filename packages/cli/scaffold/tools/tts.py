#!/usr/bin/env python
"""Gen lời dẫn bằng VieNeu-TTS chạy local. Một lượt thoại một file — khoảng nghỉ phục
vụ diễn xuất nằm trong timeline tập, không phụ thuộc khoảng nghỉ TTS tạo ra (docs/07).

    pnpm tts voices                          # liệt giọng preset
    pnpm tts thu "câu để nghe thử"           # gen ra tmp/, không đụng assets/
    pnpm tts                                 # gen mọi cue còn thiếu trong episodes/*.json
    pnpm tts --only=cue-01.mp3,cue-04.mp3
    pnpm tts --force                         # gen lại cả cue đã có
    pnpm tts --list=assets/audio/thoai.json  # đọc bảng thoại ở chỗ khác
    pnpm tts --voice="Kim Thanh" --atempo=0.9 --temperature=0.95
    pnpm tts --ref=assets/audio/ref-giong.wav   # clone giọng từ clip mẫu

Câu chữ đọc từ `shots[].audio[]` và `audio[]` của mọi file trong `episodes/` — `text`
nằm cùng chỗ với `file` nên chỉ có một bản, phụ đề (`pnpm srt`) cũng đọc từ đó.
Ra `assets/audio/<file>` cộng `<file>.json` (câu chữ, giọng, độ dài).

Chạy bằng interpreter của `.venv` (`pnpm tts` đã trỏ sẵn), cần `vieneu`, `soundfile`
và `ffmpeg` trên PATH. Sau khi chốt giọng và đã căn timeline, **không gen lại** file
đã căn; đổi nhịp thì dùng `--atempo`.
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "assets/audio"
EPISODES = ROOT / "episodes"
TMP = ROOT / "tmp"

# Một giọng cho cả kênh — đổi ở đây là đổi mọi tập. Chọn bằng cách nghe và đo âm tiết/giây.
VOICE = "Đức Trí"
# Hệ số ffmpeg `atempo` (giữ cao độ, kéo trục thời gian); VieNeu không có núm tốc độ nào khác
ATEMPO = 1.0
# Nhiệt độ lấy mẫu: cao hơn là ngữ điệu lên xuống nhiều hơn nhưng dễ vấp; mặc định của model 0.8
TEMPERATURE = 0.8
# Clip mẫu để clone giọng, tương đối gốc repo; None là dùng giọng preset ở `VOICE`
REF = None


def die(msg):
    print(msg, file=sys.stderr)
    sys.exit(1)


def cues_of(j):
    """Cả ba hình dạng: `{ cues: [...] }`, `episode.json` (`shots[].audio[]` + `audio[]`)."""
    raw = list(j.get("cues") or [])
    for s in j.get("shots", []):
        raw += s.get("audio", [])
    raw += j.get("audio", [])
    return [c for c in raw if c.get("file") and c.get("text")]


def read_cues(file=None):
    if file:
        cues = cues_of(json.loads((ROOT / file).read_text(encoding="utf8")))
    else:
        cues = []
        for p in sorted(EPISODES.glob("*.json")):
            cues += cues_of(json.loads(p.read_text(encoding="utf8")))
    if not cues:
        die("không có cue nào có cả `file` và `text`")
    seen, dup, out = set(), set(), []
    for c in cues:
        if c["file"] in seen:
            dup.add(c["file"])
            continue
        seen.add(c["file"])
        out.append(c)
    # Cùng một file phải cùng một câu — hai câu khác nhau chung tên là cue sau ghi đè cue trước
    texts = {}
    for c in cues:
        if texts.setdefault(c["file"], c["text"]) != c["text"]:
            die(f"{c['file']}: hai câu khác nhau chung một tên file")
    return out


def to_mp3(wav, mp3, atempo):
    filt = [] if atempo == 1.0 else ["-filter:a", f"atempo={atempo}"]
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), *filt, "-b:a", "192k", str(mp3)],
        check=True,
    )


def duration(path):
    import soundfile as sf

    return sf.info(str(path)).duration


args = sys.argv[1:]


def flag(name, default=None):
    for a in args:
        if a.startswith(f"--{name}="):
            return a[len(name) + 3 :]
    return default


cmd = next((a for a in args if not a.startswith("--")), None)
voice = flag("voice", VOICE)
atempo = float(flag("atempo", ATEMPO))
temperature = float(flag("temperature", TEMPERATURE))
ref = flag("ref", REF)

from vieneu import Vieneu  # noqa: E402  — import chậm, để sau khi parse cờ

tts = Vieneu()
TMP.mkdir(exist_ok=True)

if ref:
    ref_path = ROOT / ref
    if not ref_path.exists():
        die(f"không thấy clip mẫu: {ref_path}")
    # Chuẩn hoá âm lượng trước khi enroll: denoiser của model khử trên tín hiệu yếu kém hơn hẳn
    norm = TMP / "ref-norm.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(ref_path),
         "-af", "loudnorm=I=-20:TP=-3:LRA=11", "-ar", "48000", "-ac", "1", str(norm)],
        check=True,
    )
    voice = tts.add_voice("clone", norm, description=f"clone từ {ref}")

if cmd == "voices":
    for label, name in tts.list_preset_voices():
        print(f"{name:<14} {label}")
    sys.exit(0)

if cmd == "thu":
    text = next((a for a in args if a != "thu" and not a.startswith("--")), "Ngày xửa ngày xưa.")
    wav = TMP / f"thu-{voice.replace(' ', '-')}.wav"
    tts.save(tts.infer(text, voice=voice, temperature=temperature, apply_watermark=False), wav)
    mp3 = wav.with_suffix(".mp3")
    to_mp3(wav, mp3, atempo)
    print(f"{mp3}  {duration(mp3):.2f}s  ({voice}, atempo={atempo}, temp={temperature})")
    sys.exit(0)

cues = read_cues(flag("list"))
only = [s.strip() for s in flag("only").split(",")] if flag("only") else None
force = "--force" in args

AUDIO.mkdir(parents=True, exist_ok=True)
total = 0.0
for cue in cues:
    if only and cue["file"] not in only:
        continue
    mp3 = AUDIO / (cue["file"] if "." in cue["file"] else f"{cue['file']}.mp3")
    meta = mp3.with_suffix(".json")
    if mp3.exists() and not force:
        d = json.loads(meta.read_text(encoding="utf8")).get("duration", 0) if meta.exists() else 0
        print(f"· {mp3.name}  đã có, bỏ qua  ({d:.2f}s)")
        total += d
        continue
    wav = TMP / f"{mp3.stem}.wav"
    tts.save(tts.infer(cue["text"], voice=voice, temperature=temperature, apply_watermark=False), wav)
    to_mp3(wav, mp3, atempo)
    d = duration(mp3)
    meta.write_text(
        json.dumps(
            {
                "file": mp3.name,
                "text": cue["text"],
                "voice": voice,
                "ref": ref,
                "model": "VieNeu-TTS",
                "atempo": atempo,
                "temperature": temperature,
                "duration": d,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf8",
    )
    syl = len(cue["text"].replace(".", " ").replace(",", " ").split())
    print(f"✓ {mp3.name}  {d:.2f}s  {syl / d:.2f} âm tiết/s")
    total += d

print(f"\ntổng lời dẫn: {total:.1f}s")
