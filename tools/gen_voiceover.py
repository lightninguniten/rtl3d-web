"""Generate the RTL3D lightning-lesson voice-over with Gemini TTS.

Usage:
    set GEMINI_API_KEY=...      (do NOT hard-code the key)
    py tools/gen_voiceover.py

Writes: tools/_voiceover.wav   (24 kHz mono PCM wrapped as WAV)

The transcript is written to track the video timeline (~55 s) scene by scene.
"""

import mimetypes
import os
import struct
import sys
from google import genai
from google.genai import types

OUT = os.path.join(os.path.dirname(__file__), "_voiceover.wav")

# One continuous narration, paced to the 11 scenes of the video.
# Ellipses / line breaks give the TTS natural beats between scenes.
TRANSCRIPT = """Lightning in Malaysia.

Here's everything you need to know — to stay safe.

Around the world, lightning strikes about a hundred times every second. That's eight million bolts, every single day.

Each bolt is staggering. Thirty thousand degrees — five times hotter than the surface of the Sun. That violent burst of heat? That's the thunder you hear.

And Malaysia sits right in the strike zone. The Klang Valley, around Subang Jaya, sees around two hundred and forty thunderstorm days a year — one of the most lightning-prone places on Earth.

That's why we built RTL3D. Real-Time Lightning, in three dimensions. A Malaysia–Japan research project, imaging lightning live.

Using L-F and V-H-F radio antennas, RTL3D maps an entire lightning channel — and rebuilds it in three dimensions.

So how do you stay safe? Start with flash to bang. Count the seconds from the flash to the thunder. Divide by three for kilometres. Under thirty seconds — it's already too close.

Remember the thirty-thirty rule. Thunder within thirty seconds? Get inside. Then wait a full thirty minutes after the last thunder before heading back out.

And when thunder roars — go indoors. There is no safe place outside. A building, or a hard-top car, is your shelter.

Avoid tall trees and open fields. Drop the umbrella and the golf club. And indoors, stay away from taps and wired phones — because lightning travels through pipes and wiring.

Stay safe. Stay informed. RTL3D."""


def parse_audio_mime_type(mime_type: str):
    bits_per_sample, rate = 16, 24000
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
    return bits_per_sample, rate


def to_wav(pcm: bytes, mime_type: str) -> bytes:
    bits, rate = parse_audio_mime_type(mime_type)
    num_channels = 1
    bytes_per_sample = bits // 8
    block_align = num_channels * bytes_per_sample
    byte_rate = rate * block_align
    data_size = len(pcm)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE", b"fmt ", 16, 1,
        num_channels, rate, byte_rate, block_align, bits, b"data", data_size,
    )
    return header + pcm


def main():
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        print("ERROR: set GEMINI_API_KEY in the environment first.", file=sys.stderr)
        sys.exit(1)

    client = genai.Client(api_key=key)
    model = "gemini-3.1-flash-tts-preview"

    prompt = (
        "Read the following transcript based on the audio profile and director's note.\n\n"
        "# Audio Profile\nA smooth, premium commercial voice.\n\n"
        "# Director's note\nStyle: Promo/Hype. Pace: Natural. Accent: American (Gen).\n\n"
        "## Scene:\nThe Sound Stage Booth.\n\n"
        "## Sample Context:\nPremium commercial. Dynamic pacing—starts intrigued, ends punchy. "
        "Tone is polished, persuasive, and inviting.\n\n"
        "## Transcript:\n" + TRANSCRIPT
    )

    config = types.GenerateContentConfig(
        temperature=1,
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Algenib")
            )
        ),
    )

    pcm = bytearray()
    mime = "audio/L16;rate=24000"
    for chunk in client.models.generate_content_stream(
        model=model,
        contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
        config=config,
    ):
        if not chunk.parts:
            continue
        part = chunk.parts[0]
        if part.inline_data and part.inline_data.data:
            pcm.extend(part.inline_data.data)
            if part.inline_data.mime_type:
                mime = part.inline_data.mime_type
        elif getattr(chunk, "text", None):
            print(chunk.text)

    if not pcm:
        print("ERROR: no audio returned.", file=sys.stderr)
        sys.exit(2)

    with open(OUT, "wb") as f:
        f.write(to_wav(bytes(pcm), mime))
    print(f"Saved {OUT}  ({len(pcm)} PCM bytes)")


if __name__ == "__main__":
    main()
