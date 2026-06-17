#!/usr/bin/env python3
"""Generate lightning-lesson narration MP3s via Gemini TTS.

LOCKED (do not regenerate / retune without approval): en, ms.
Active language work: ja.

See video/LESSON-I18N-LOCK.md

Requires: pip install google-genai
API key: set GEMINI_API_KEY in the environment (never commit keys).

Outputs:
  video/narration-en.mp3
  video/narration-ms.mp3
  video/narration-ja.mp3

The on-page lesson is an HTML+GSAP composition (HyperFrames-style seekable
timeline). These audio tracks sync to the same scene timing as narration.mp3.
"""

from __future__ import annotations

import json
import mimetypes
import os
import struct
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TRANSCRIPTS = ROOT / "video" / "transcripts.json"
OUT_DIR = ROOT / "video"

MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-3.1-flash-tts-preview")

# Per-language voice and director notes tuned for natural delivery.
VOICE = {
    "en": "Algenib",
    "ms": "Aoede",
    "ja": "Kore",
}

DIRECTOR = {
    "en": (
        "Style: Premium cinematic trailer / IMAX science documentary. "
        "Pace: Dramatic with purposeful pauses at em-dashes and paragraph breaks. "
        "Accent: Neutral international English. Tone: bold, immersive, high-stakes — "
        "like a storm is approaching. Emphasise RTL3D and Real-Time Lightning 3D."
    ),
    "ms": (
        "Gaya: Promo / hype dokumentari sains premium — dramatik seperti versi Inggeris. "
        "Rentak: Perlahan dan jelas; berhenti seketika pada sempang dan setiap perenggan baru. "
        "Loghat: Bahasa Melayu baku Malaysia (bukan Indonesia). "
        "Nada: berwibawa, mendebarkan, seperti ribut menghampiri. "
        "Baca SETIAP ayat dalam transkrip dengan LENGKAP — jangan langkau, ringkaskan, atau gabungkan ayat. "
        "Tekankan nombor dan perkataan penting: seratus, lapan juta, tiga puluh ribu, SATREPS, LF, VHF. "
        "Pada perenggan lima dan enam sahaja, sebut RTL3D sebagai singkatan. "
        "Jangan sebut Real-Time Lightning three-D atau frasa Inggeris lain. "
        "JANGAN tambah selamat datang. Baca transkrip verbatim sahaja."
    ),
    "ja": (
        "スタイル：英語版・マレー語版と同じくらいドラマチックなシネマティック科学ドキュメンタリー。 "
        "テンポ：マレー語版と同程度の長さで、ゆっくり丁寧に。句読点と段落の区切りで十分な間を取る。 "
        "トランスクリプトの全文を省略せず読む。要約や言い換え禁止。 "
        "RTL3Dは第五・第六段落でのみ略称として発音。英語の Real-Time Lightning three-D は読まない。 "
        "挨拶やようこそは付け加えない。テキストのみ読む。"
    ),
}


def strip_wav_header(data: bytes) -> bytes:
    """Return PCM payload, stripping a RIFF/WAVE header if present."""
    if len(data) > 44 and data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return data[44:]
    return data


def merge_audio_chunks(chunks: list[bytes], mime: str) -> bytes:
    """Merge streamed audio chunks into one playable WAV."""
    pcm_parts: list[bytes] = []
    for chunk in chunks:
        if chunk[:4] == b"RIFF":
            pcm_parts.append(strip_wav_header(chunk))
        else:
            pcm_parts.append(chunk)
    pcm = b"".join(pcm_parts)
    return convert_to_wav(pcm, mime or "audio/L16;rate=24000")


def convert_to_wav(audio_data: bytes, mime_type: str) -> bytes:
    parameters = parse_audio_mime_type(mime_type)
    bits_per_sample = parameters["bits_per_sample"]
    sample_rate = parameters["rate"]
    num_channels = 1
    data_size = len(audio_data)
    bytes_per_sample = bits_per_sample // 8
    block_align = num_channels * bytes_per_sample
    byte_rate = sample_rate * block_align
    chunk_size = 36 + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        chunk_size,
        b"WAVE",
        b"fmt ",
        16,
        1,
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        bits_per_sample,
        b"data",
        data_size,
    )
    return header + audio_data


def parse_audio_mime_type(mime_type: str) -> dict[str, int]:
    bits_per_sample = 16
    rate = 24000
    for param in mime_type.split(";"):
        param = param.strip()
        if param.lower().startswith("rate="):
            try:
                rate = int(param.split("=", 1)[1])
            except (ValueError, IndexError):
                pass
        elif param.startswith("audio/L"):
            try:
                bits_per_sample = int(param.split("L", 1)[1])
            except (ValueError, IndexError):
                pass
    return {"bits_per_sample": bits_per_sample, "rate": rate}


def build_prompt(lang: str, transcript: str, *, paragraph: bool = False) -> str:
    director = DIRECTOR[lang]
    sample = {
        "ja": (
            "Premium science documentary. Measured, dramatic pacing — pause at each "
            "sentence end. Same overall length as the Malay narration track."
        ),
    }.get(lang, (
        "Premium commercial. Dynamic pacing—starts intrigued, ends punchy. "
        "Tone is polished, persuasive, and inviting."
    ))
    scope = "paragraph" if paragraph else "transcript"
    return (
        "Read the following transcript based on the audio profile and director's note.\n\n"
        "# Audio Profile\n"
        "A smooth, premium commercial voice.\n\n"
        "# Director's note\n"
        f"{director}\n\n"
        "## Scene:\n"
        "The Sound Stage Booth.\n\n"
        "## Sample Context:\n"
        f"{sample}\n\n"
        "# CRITICAL\n"
        f"Read ONLY the {scope} below — verbatim, no extra words. "
        "Do NOT add welcome, greeting, or introduction. "
        "Begin with the very first word of the transcript.\n\n"
        "## Transcript:\n"
        f"{transcript}"
    )


def _tts_config(voice_name: str):
    from google.genai import types

    return types.GenerateContentConfig(
        temperature=1,
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
            )
        ),
    )


def synthesize_audio(client, lang: str, text: str, voice_name: str) -> bytes:
    from google.genai import types

    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=build_prompt(lang, text, paragraph=True))],
        )
    ]
    chunks: list[bytes] = []
    mime = "audio/wav"
    for attempt in range(6):
        chunks.clear()
        try:
            for chunk in client.models.generate_content_stream(
                model=MODEL, contents=contents, config=_tts_config(voice_name)
            ):
                if not chunk.parts:
                    continue
                part = chunk.parts[0]
                if part.inline_data and part.inline_data.data:
                    mime = part.inline_data.mime_type or mime
                    data = part.inline_data.data
                    if mimetypes.guess_extension(mime) is None:
                        data = convert_to_wav(data, mime)
                        mime = "audio/wav"
                    chunks.append(data)
                elif chunk.text:
                    print(chunk.text, end="")
            break
        except Exception as exc:
            msg = str(exc)
            if "429" not in msg and "RESOURCE_EXHAUSTED" not in msg:
                raise
            wait = 22 * (attempt + 1)
            print(f"\n  rate limit — wait {wait}s…", file=sys.stderr)
            time.sleep(wait)
    if not chunks:
        raise RuntimeError(f"No audio returned for language {lang}")
    return merge_audio_chunks(chunks, mime)


def generate_lang(client, lang: str, transcript: str) -> Path:
    import shutil
    import subprocess

    voice_name = VOICE.get(lang, VOICE["en"])
    out_base = OUT_DIR / f"narration-{lang}"
    scene_durs: list[float] | None = None

    if lang == "ja":
        paras = [p.strip() for p in transcript.split("\n\n") if p.strip()]
        if len(paras) != EXPECTED_PARAS:
            raise RuntimeError(f"ja: expected {EXPECTED_PARAS} paragraphs, got {len(paras)}")
        parts_dir = OUT_DIR / "_tts_ja_parts"
        parts_dir.mkdir(exist_ok=True)
        part_paths: list[Path] = []
        scene_durs = []
        for i, para in enumerate(paras):
            part_path = parts_dir / f"scene_{i + 1:02d}.wav"
            if part_path.is_file() and part_path.stat().st_size > 1000:
                print(f"  ja scene {i + 1}/{len(paras)} (cached)")
            else:
                print(f"  ja scene {i + 1}/{len(paras)}…")
                wav = synthesize_audio(client, lang, para, voice_name)
                part_path.write_bytes(wav)
                if i + 1 < len(paras):
                    time.sleep(22)
            part_paths.append(part_path)
            scene_durs.append(round(ffprobe_duration(part_path), 2))
        out_path = out_base.with_suffix(".wav")
        list_path = parts_dir / "concat.txt"
        list_path.write_text(
            "\n".join(f"file '{p.resolve().as_posix()}'" for p in part_paths),
            encoding="utf-8",
        )
        ffmpeg = shutil.which("ffmpeg")
        if not ffmpeg:
            raise RuntimeError("ffmpeg required for paragraph merge")
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(list_path),
                "-c",
                "copy",
                str(out_path),
            ],
            check=True,
            capture_output=True,
        )
        print(f"Saved {out_path} ({out_path.stat().st_size} bytes)")
        print(f"ja per-scene ({sum(scene_durs):.2f}s): {scene_durs}")
    else:
        from google.genai import types

        contents = [
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=build_prompt(lang, transcript))],
            )
        ]
        chunks: list[bytes] = []
        mime = "audio/wav"
        for chunk in client.models.generate_content_stream(
            model=MODEL, contents=contents, config=_tts_config(voice_name)
        ):
            if not chunk.parts:
                continue
            part = chunk.parts[0]
            if part.inline_data and part.inline_data.data:
                mime = part.inline_data.mime_type or mime
                data = part.inline_data.data
                if mimetypes.guess_extension(mime) is None:
                    data = convert_to_wav(data, mime)
                    mime = "audio/wav"
                chunks.append(data)
            elif chunk.text:
                print(chunk.text, end="")
        if not chunks:
            raise RuntimeError(f"No audio returned for language {lang}")
        data_buffer = merge_audio_chunks(chunks, mime)
        out_path = out_base.with_suffix(".wav")
        out_path.write_bytes(data_buffer)
        print(f"Saved {out_path} ({len(data_buffer)} bytes)")

    mp3_path = out_base.with_suffix(".mp3")
    ffmpeg = shutil.which("ffmpeg")
    if ffmpeg:
        cmd = [ffmpeg, "-y", "-i", str(out_path)]
        if lang in ("ms", "ja"):
            cmd += ["-af", "loudnorm=I=-16:TP=-1.5:LRA=11"]
        cmd += ["-codec:a", "libmp3lame", "-qscale:a", "2", str(mp3_path)]
        subprocess.run(cmd, check=True, capture_output=True)
        print(f"Converted {mp3_path}")
        update_lang_scene_timing(lang, mp3_path, transcript, scene_durs=scene_durs)
        return mp3_path
    return out_path


EXPECTED_PARAS = 11

EN_SCENE_DUR = [6.4, 8.6, 10.6, 12.3, 10.5, 8.7, 11.9, 9.9, 8.6, 11.3, 5.0]
EN_ANIM_REF = EN_SCENE_DUR  # GSAP keyframes tuned against these lengths
TIMING_JSON = ROOT / "video" / "scene-timing.json"
EXPLAINER_JS = ROOT / "js" / "video-explainer.js"


def ffprobe_duration(path: Path) -> float:
    import subprocess

    out = subprocess.check_output(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        text=True,
    ).strip()
    return float(out)


def scale_scene_durations(total_sec: float, base: list[float] | None = None) -> list[float]:
    base = base or EN_SCENE_DUR
    base_sum = sum(base)
    durs = [round(d * total_sec / base_sum, 2) for d in base]
    durs[-1] = round(total_sec - sum(durs[:-1]), 2)
    return durs


def weighted_scene_durations(text: str, total_sec: float, min_last: float = 4.0) -> list[float]:
    """Derive scene lengths from paragraph size (matches narration density)."""
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    if len(paras) != EXPECTED_PARAS:
        return scale_scene_durations(total_sec)
    weights = [float(len(p)) for p in paras]
    raw = [w * total_sec / sum(weights) for w in weights]
    raw[-1] = max(min_last, raw[-1])
    head = sum(raw[:-1])
    tail = raw[-1]
    scale = (total_sec - tail) / head if head else 1.0
    durs = [round(w * scale, 2) for w in raw[:-1]] + [round(tail, 2)]
    durs[-1] = round(total_sec - sum(durs[:-1]), 2)
    return durs


def update_lang_scene_timing(
    lang: str,
    mp3_path: Path,
    transcript: str,
    *,
    scene_durs: list[float] | None = None,
) -> None:
    import re

    total = ffprobe_duration(mp3_path)
    if scene_durs is not None:
        durs = scene_durs
        durs[-1] = round(total - sum(durs[:-1]), 2)
    elif lang in ("en", "ja"):
        durs = weighted_scene_durations(transcript, total)
    else:
        durs = scale_scene_durations(total)
    print(f"{lang} scene timing ({total:.2f}s): {durs}")

    if TIMING_JSON.is_file():
        data = json.loads(TIMING_JSON.read_text(encoding="utf-8"))
        data[lang] = durs
        TIMING_JSON.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    if EXPLAINER_JS.is_file():
        text = EXPLAINER_JS.read_text(encoding="utf-8")
        block = f"{lang}: [" + ", ".join(f"{d:.2f}" for d in durs) + "]"
        text, n = re.subn(rf"{re.escape(lang)}: \[[^\]]+\]", block, text, count=1)
        if n == 1:
            EXPLAINER_JS.write_text(text, encoding="utf-8")


def review_transcript(lang: str, text: str) -> list[str]:
    paras = [p.strip() for p in text.split("\n\n") if p.strip()]
    title = {"en": "Review", "ms": "Semak skrip", "ja": "スクリプト確認"}.get(lang, lang)
    print(f"\n--- {title} {lang} ({len(paras)} paragraphs) ---")
    for i, para in enumerate(paras, 1):
        preview = para if len(para) <= 100 else para[:97] + "..."
        try:
            print(f"  {i:2d}. {preview}")
        except UnicodeEncodeError:
            print(f"  {i:2d}. [{len(para)} chars]")
    if len(paras) != EXPECTED_PARAS:
        print(
            f"AMARAN: jangka {EXPECTED_PARAS} perenggan (satu setiap babak), dapat {len(paras)}.",
            file=sys.stderr,
        )
    return paras


def main() -> int:
    api_key = os.environ.get("GEMINI_API_KEY")
    args = [a for a in sys.argv[1:] if a != "--review-only"]
    review_only = "--review-only" in sys.argv

    if not review_only and not api_key:
        print("Set GEMINI_API_KEY in the environment.", file=sys.stderr)
        return 1

    if not TRANSCRIPTS.is_file():
        print(f"Missing {TRANSCRIPTS}", file=sys.stderr)
        return 1

    transcripts: dict[str, str] = json.loads(TRANSCRIPTS.read_text(encoding="utf-8"))
    langs = args or list(transcripts.keys())

    ok = True
    for lang in langs:
        if lang not in transcripts:
            print(f"Unknown language: {lang}", file=sys.stderr)
            return 1
        paras = review_transcript(lang, transcripts[lang])
        if len(paras) != EXPECTED_PARAS:
            ok = False

    if review_only:
        return 0 if ok else 1

    from google import genai

    client = genai.Client(api_key=api_key)

    for lang in langs:
        if lang in ("en", "ms"):
            print(f"SKIP {lang}: locked — see video/LESSON-I18N-LOCK.md", file=sys.stderr)
            continue
        print(f"\nGenerating narration-{lang}…")
        generate_lang(client, lang, transcripts[lang])

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
