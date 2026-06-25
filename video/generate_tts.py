"""Generate per-beat voice narration for the "When Thunder Roars" lesson.

ONE-TIME LOCAL BUILD STEP. The API key must NEVER ship to the browser, so this
runs on your machine, reads the script text straight out of lesson.js (single
source of truth), and writes one audio clip per narration beat plus a manifest
of measured durations that lesson.js consumes at runtime.

Usage (PowerShell):
    $env:GEMINI_API_KEY = "<your rotated key>"
    py generate_tts.py            # both languages
    py generate_tts.py --lang en  # one language
    py generate_tts.py --dry-run  # show what WOULD be spoken, no API calls

Output, next to this file:
    voice/vo-<lang>-<scene>-<beat>.wav   per-beat clips (b = question = "ask")
    voice/vo-manifest.json               { lang: { "scene-beat": seconds } }

Requires: pip install google-genai   and   ffprobe on PATH (for durations).
"""

import argparse
import json
import os
import re
import struct
import subprocess
import sys
import time
import wave
from pathlib import Path

HERE = Path(__file__).parent
LESSON_JS = HERE / "lesson.js"
OUT_DIR = HERE / "voice"

MODEL = "gemini-3.1-flash-tts-preview"

# Per-language voice. ms uses a warm female voice, hard-directed (below) to
# sound like a natural Malaysian woman speaking Bahasa Malaysia.
VOICES = {"en": "Charon", "ms": "Aoede"}

# Per-language director's note. Both ask for CONNECTED, flowing delivery with
# only short clean pauses between sentences (the long gaps are then also capped
# in post via trim_silence). ms hard-pushes a Malaysian-woman delivery.
_DIRECTOR = {
    "en": (
        "Style: Premium cinematic science documentary, like a great nature film. "
        "Professional, warm, and authoritative with clear broadcast articulation. "
        "Pace: natural and flowing with momentum. Keep sentences connected, with "
        "only short, clean breaths between them. Do NOT pause long between "
        "sentences. Land key numbers and facts with genuine wonder, give questions "
        "a bright curious rising lift, let short punchy lines hit with weight. "
        "Finish every final word fully and cleanly. Accent: Neutral international."
    ),
    "ms": (
        "Style: Seorang wanita Malaysia yang mesra, hangat dan yakin sedang bercerita "
        "tentang kilat kepada kanak-kanak. Suara perempuan Malaysia yang natural dan "
        "ramah, seperti seorang cikgu atau pengacara TV Malaysia. "
        "PENTING: gunakan sebutan dan intonasi Bahasa Malaysia (Bahasa Melayu Malaysia) "
        "yang natural, BUKAN loghat Indonesia dan BUKAN terlalu kaku seperti pembaca berita. "
        "Rentak: mengalir dan bersambung dengan tenaga; hanya jeda pendek dan bersih "
        "antara ayat. JANGAN berhenti lama antara ayat. "
        "Naik sedikit nada bila fakta mengejutkan, lembut dan prihatin pada nasihat "
        "keselamatan. Sebut setiap perkataan akhir dengan lengkap dan jelas. "
        "(English: speak as a warm, natural Malaysian woman in Malaysian Malay, not "
        "Indonesian; flowing connected pace, only short clean pauses, never long gaps.)"
    ),
}

_PROFILE = {
    "en": ("A clear, confident, engaging science narrator for a short film about "
           "lightning, aimed at curious children aged 8 to 12. Warm and authoritative."),
    "ms": ("A warm, friendly Malaysian woman narrating a short film about lightning "
           "for curious children aged 8 to 12. Natural Malaysian-Malay voice, caring "
           "and engaging, like a beloved Malaysian teacher."),
}


def build_prompt(lang: str) -> str:
    """Structured director's-note prompt for one language (prefix before the
    transcript lines, which main() appends)."""
    return (
        "Read the following transcript based on the audio profile and director's note.\n\n"
        "# Audio Profile\n" + _PROFILE.get(lang, _PROFILE["en"]) + "\n\n"
        "# Director's note\n" + _DIRECTOR.get(lang, _DIRECTOR["en"]) + "\n\n"
        "## Scene:\n"
        "A cinematic science explainer. Dramatic lightning storms, a glowing globe, a "
        "tall tower struck again and again, a rocket trailing a wire into a thundercloud.\n\n"
        "## Sample Context:\n"
        "Educational science narration. Each line is a short, vivid beat. Clean studio "
        "sound, no background noise, no sound effects, no music. Read only the transcript.\n\n"
        "## Transcript:\n"
    )


def strip_tags(html: str) -> str:
    """Drop <b>/<i> markers; normalize punctuation the TTS reads cleanly."""
    t = re.sub(r"<[^>]+>", "", html)
    t = t.replace("’", "'").replace("—", ", ").replace("…", "...")
    return re.sub(r"\s+", " ", t).strip()


def parse_beats(lang: str):
    """Pull (scene_id, beat_index_or_ask, spoken_text) tuples out of lesson.js.

    We read the file as text rather than importing it; the SCRIPT object is plain
    data so a couple of focused regexes are enough and avoid a JS runtime.
    Returns list of dicts: {scene, idx, key, text} where key is "<i>-<j>" and
    idx 'a' marks the scene question (ask).
    """
    src = LESSON_JS.read_text(encoding="utf-8")
    # isolate the  <lang>: { ... scenes: [ ... ] }  block
    m = re.search(r"\b%s:\s*\{" % re.escape(lang), src)
    if not m:
        raise SystemExit(f"language '{lang}' not found in lesson.js")
    # find the scenes array for this language (first 'scenes:' after the lang key)
    sm = re.search(r"scenes:\s*\[", src[m.end():])
    if not sm:
        raise SystemExit(f"no scenes for '{lang}'")
    start = m.end() + sm.end() - 1  # at the '['
    # walk brackets to find the matching ']'
    depth, i = 0, start
    while i < len(src):
        c = src[i]
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                break
        i += 1
    scenes_src = src[start:i + 1]

    beats = []
    # each scene object: { id: '...', art: '...', ask: '...', beats: [ {hold,html}... ] }
    for sm2 in re.finditer(r"\{\s*id:\s*'([^']*)'.*?beats:\s*\[(.*?)\]\s*\}", scenes_src, re.S):
        scene_id, beats_src = sm2.group(1), sm2.group(2)
        ask_m = re.search(r"ask:\s*'((?:[^'\\]|\\.)*)'", sm2.group(0))
        ask = ask_m.group(1).replace("\\'", "'") if ask_m else ""
        if ask.strip():
            beats.append({"scene": scene_id, "key": "%s-a" % scene_id, "text": strip_tags(ask)})
        for bi, hm in enumerate(re.finditer(r"html:\s*'((?:[^'\\]|\\.)*)'", beats_src)):
            html = hm.group(1).replace("\\'", "'")
            beats.append({"scene": scene_id, "key": "%s-%d" % (scene_id, bi), "text": strip_tags(html)})
    if not beats:
        raise SystemExit(f"parsed 0 beats for '{lang}' — lesson.js shape changed?")
    return beats


def wav_duration(path: Path) -> float:
    """Seconds, read from the WAV header (no ffprobe needed)."""
    with wave.open(str(path), "rb") as w:
        return round(w.getnframes() / float(w.getframerate()), 3)


def detect_silences(path: Path, noise_db: int = -35, min_sil: float = 0.40):
    """Return [(start,end)] of silent gaps via ffmpeg silencedetect."""
    p = subprocess.run(
        ["ffmpeg", "-i", str(path), "-af",
         f"silencedetect=noise={noise_db}dB:d={min_sil}", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    log = p.stderr
    starts = [float(m) for m in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(m) for m in re.findall(r"silence_end: ([\d.]+)", log)]
    return list(zip(starts, ends))


def split_on_silence(full: Path, keys, out_tmpl):
    """Cut `full` into len(keys) clips at the gaps between speech.

    Uses the MIDPOINT of each detected silent gap as a cut point. If the gap
    count doesn't match (model paused oddly), we fall back to the longest gaps.
    Returns {key: duration} and writes each clip via out_tmpl(key).
    """
    total = wav_duration(full)
    gaps = detect_silences(full)
    # ignore a leading/trailing silence at the very ends
    gaps = [(s, e) for (s, e) in gaps if e < total - 0.05 and s > 0.05]
    need = len(keys) - 1  # cut points between N clips
    if len(gaps) < need:
        raise SystemExit(
            f"found {len(gaps)} usable gaps but need {need} for {len(keys)} lines. "
            f"Try a different noise threshold, or generate per-line.")
    # keep the `need` longest gaps, in time order, cut at each gap's midpoint
    longest = sorted(gaps, key=lambda g: g[1] - g[0], reverse=True)[:need]
    cuts = sorted((s + e) / 2 for (s, e) in longest)
    bounds = [0.0] + cuts + [total]
    durations = {}
    for i, key in enumerate(keys):
        a, b = bounds[i], bounds[i + 1]
        out = out_tmpl(key)
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(full), "-ss", f"{a:.3f}", "-to", f"{b:.3f}",
             "-c", "copy", str(out)],
            capture_output=True, text=True,
        )
        durations[key] = round(wav_duration(out), 3)
    return durations


def pcm_to_wav(pcm: bytes, mime: str) -> bytes:
    rate = 24000
    bits = 16
    for p in mime.split(";"):
        p = p.strip()
        if p.lower().startswith("rate="):
            try:
                rate = int(p.split("=", 1)[1])
            except ValueError:
                pass
        elif p.startswith("audio/L"):
            try:
                bits = int(p.split("L", 1)[1])
            except ValueError:
                pass
    ch = 1
    bps = bits // 8
    block = ch * bps
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI", b"RIFF", 36 + len(pcm), b"WAVE", b"fmt ", 16, 1,
        ch, rate, rate * block, block, bits, b"data", len(pcm),
    )
    return header + pcm


# When the whole script is read in ONE request, lines are joined with this so
# the model leaves a clean, detectable pause between beats that ffmpeg can split
# on. A leading marker word also helps the reader reset cadence per line.
LINE_SEP = "\n\n"


def synth(client, text: str, voice: str, retries: int = 6) -> bytes:
    """Return WAV bytes for a prompt in the given voice, retrying on 429."""
    from google.genai import types
    from google.genai import errors
    parts = []
    for attempt in range(retries):
        try:
            parts = _stream(client, types, text, voice)
            break
        except errors.ClientError as e:
            if getattr(e, "code", None) == 429 and attempt < retries - 1:
                wait = 22 * (attempt + 1)
                print(f"    rate-limited, waiting {wait}s ...")
                time.sleep(wait)
                continue
            raise
    if not parts:
        raise RuntimeError("no audio returned")
    pcm = b"".join(d for d, _ in parts)
    return pcm_to_wav(pcm, parts[0][1])


def _stream(client, types, text, voice):
    parts = []
    for chunk in client.models.generate_content_stream(
        model=MODEL,
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=text)])],
        config=types.GenerateContentConfig(
            temperature=1,
            response_modalities=["audio"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
                )
            ),
        ),
    ):
        if not chunk.parts:
            continue
        inline = chunk.parts[0].inline_data
        if inline and inline.data:
            parts.append((inline.data, inline.mime_type))
    return parts


def group_scenes(beats):
    """Group the flat beat list into ordered scenes (one chunk per scene)."""
    scenes = []
    cur = None
    for b in beats:
        if cur is None or b["scene"] != cur["scene"]:
            cur = {"scene": b["scene"], "keys": [], "texts": []}
            scenes.append(cur)
        cur["keys"].append(b["key"])
        cur["texts"].append(b["text"])
    return scenes


def place_lines(clip: Path, texts):
    """Within ONE scene clip, return each line's start time (clip-relative).

    The scene boundaries are already exact (separate clips), so this only has to
    place a handful of lines inside a short clip. Uses silence where available,
    proportional-by-length as the fallback, so it never bunches.
    """
    total = wav_duration(clip)
    n = len(texts)
    if n == 1:
        return [0.0]
    need = n - 1
    gaps = []
    for noise, d in [(-33, 0.26), (-33, 0.20), (-30, 0.18), (-27, 0.15)]:
        g = detect_silences(clip, noise, d)
        interior = [x for x in g if x[1] < total - 0.05 and x[0] > 0.05]
        if len(interior) >= need:
            gaps = g
            break
        gaps = g
    speech_start = gaps[0][1] if gaps and gaps[0][0] <= 0.05 else 0.0
    cuts = sorted((s + e) / 2 for (s, e) in gaps
                  if e < total - 0.05 and s > speech_start + 0.05)
    weights = [max(len(t), 1) for t in texts]
    span = total - speech_start
    acc, exp = 0, []
    for w in weights:
        acc += w
        exp.append(speech_start + span * acc / sum(weights))
    chosen, ci = [], 0
    for ec in exp[:-1]:
        best, bestd = None, 1e9
        for j in range(ci, len(cuts)):
            dd = abs(cuts[j] - ec)
            if dd < bestd:
                bestd, best = dd, j
            elif cuts[j] > ec:
                break
        if best is None:
            chosen.append(ec)
        else:
            chosen.append(cuts[best])
            ci = best + 1
    starts = [round(speech_start, 3)] + [round(c, 3) for c in chosen]
    for i in range(1, len(starts)):
        if starts[i] <= starts[i - 1]:
            starts[i] = round(starts[i - 1] + 0.2, 3)
    return starts


def trim_silence(src: Path, dst: Path):
    """Tighten pauses: drop leading silence and cap any gap longer than 0.4s
    down to a clean ~0.22s breath. Natural short pauses are left untouched."""
    flt = ("silenceremove="
           "start_periods=1:start_duration=0.05:start_threshold=-38dB:"
           "stop_periods=-1:stop_duration=0.4:stop_silence=0.22:stop_threshold=-38dB")
    subprocess.run(["ffmpeg", "-y", "-i", str(src), "-af", flt, str(dst)],
                   capture_output=True, text=True)


def concat_wavs(wavs, out_wav: Path):
    """Loss-lessly join scene WAVs in order (ffmpeg concat demuxer)."""
    lst = out_wav.with_suffix(".txt")
    lst.write_text("\n".join(f"file '{w.resolve().as_posix()}'" for w in wavs),
                   encoding="utf-8")
    subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-c", "copy", str(out_wav)], capture_output=True, text=True)
    lst.unlink(missing_ok=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=["en", "ms"], action="append")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    langs = args.lang or ["en", "ms"]

    if args.dry_run:
        for lang in langs:
            print(f"\n=== {lang} ===")
            for sc in group_scenes(parse_beats(lang)):
                print(f"  [{sc['scene']}]")
                for k, t in zip(sc["keys"], sc["texts"]):
                    print(f"    {k:14s} {t}")
        return

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("Set GEMINI_API_KEY in your environment first (do not hardcode it).")

    from google import genai
    client = genai.Client(api_key=key)
    OUT_DIR.mkdir(exist_ok=True)
    # space scene requests out on a free-tier key; 0 with a paid/higher-quota key.
    gap = float(os.environ.get("GEMINI_TTS_GAP", "0"))

    mf_path = OUT_DIR / "vo-manifest.json"
    manifest = json.loads(mf_path.read_text(encoding="utf-8")) if mf_path.exists() else {}
    for lang in langs:
        scenes = group_scenes(parse_beats(lang))
        parts = OUT_DIR / f"_parts_{lang}"
        parts.mkdir(exist_ok=True)
        print(f"\n=== {lang}: {len(scenes)} scene chunks ===")
        scene_wavs, keys_all, starts_all, cursor = [], [], [], 0.0
        for si, sc in enumerate(scenes):
            raw = parts / f"scene_{si:02d}.wav"
            if raw.is_file() and raw.stat().st_size > 1000:
                print(f"  scene {si} [{sc['scene']}] (cached)", end="")
            else:
                raw.write_bytes(synth(client, build_prompt(lang) + "\n\n".join(sc["texts"]),
                                      VOICES[lang]))
                print(f"  scene {si} [{sc['scene']}]", end="")
                if gap:
                    time.sleep(gap)
            # trim long pauses, then time + concat from the trimmed clip
            clip = parts / f"scene_{si:02d}_trim.wav"
            trim_silence(raw, clip)
            dur = wav_duration(clip)
            for key_, off in zip(sc["keys"], place_lines(clip, sc["texts"])):
                keys_all.append(key_)
                starts_all.append(round(cursor + off, 3))
            print(f"  {wav_duration(raw):5.1f}s -> {dur:5.1f}s trimmed  ({len(sc['keys'])} lines)")
            cursor += dur
            scene_wavs.append(clip)

        full_wav = OUT_DIR / f"narration-{lang}.wav"
        mp3 = OUT_DIR / f"narration-{lang}.mp3"
        concat_wavs(scene_wavs, full_wav)
        subprocess.run(["ffmpeg", "-y", "-i", str(full_wav), "-b:a", "128k", str(mp3)],
                       capture_output=True, text=True)
        total = wav_duration(full_wav)
        full_wav.unlink(missing_ok=True)
        manifest[lang] = {"file": mp3.name, "duration": round(total, 2),
                          "keys": keys_all, "starts": starts_all}
        mf_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        print(f"  -> {mp3.name}  {total:.1f}s, {len(keys_all)} lines aligned")

    print(f"\nWrote {mf_path}")


if __name__ == "__main__":
    main()
