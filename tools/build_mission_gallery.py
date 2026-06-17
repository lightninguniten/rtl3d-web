#!/usr/bin/env python3
"""Build mission gallery from a curated manifest (correct image ↔ topic ↔ caption)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MISSION_DIR = ROOT / "images" / "mission"
GALLERY_JSON = ROOT / "data" / "mission" / "gallery.json"
MANIFEST = ROOT / "data" / "mission" / "gallery-manifest.json"
FEED_JSON = ROOT / "data" / "social" / "feed.json"

# Our Mission gallery — Facebook images only (no Instagram).
DEFAULT_MANIFEST = {
    "items": [
        {
            "source": "images/social/fb/02.jpg",
            "id": "lightning-flash-study-area",
            "topic": "3D lightning mapping",
            "platform": "facebook",
            "caption": "Night-time lightning flash over the RTL3D study region — natural CG activity monitored by the Peninsular LF observation network."
        },
        {
            "source": "images/social/fb/03.jpg",
            "id": "seminar-3d-localization",
            "topic": "3D lightning mapping",
            "platform": "facebook"
        },
        {
            "source": "images/social/fb/05.jpg",
            "id": "project-coordination-briefing",
            "topic": "Observation network",
            "platform": "facebook",
            "caption": "SATREPS project coordination briefing — Malaysia–Japan lightning observation network progress and international collaboration."
        }
    ]
}


def figure_caption(text: str, max_len: int = 220) -> str:
    import re
    import unicodedata
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[✨⚡️∎🔥🤝]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= max_len:
        return text
    return text[:max_len].rsplit(" ", 1)[0] + "…"


def load_feed_captions() -> dict[str, str]:
    if not FEED_JSON.exists():
        return {}
    feed = json.loads(FEED_JSON.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for platform in ("instagram", "facebook"):
        for entry in feed.get(platform, []):
            image = entry.get("image")
            text = entry.get("text", "")
            if image and text:
                out[image] = figure_caption(text)
    return out


def caption_for_entry(entry: dict, feed_caps: dict[str, str]) -> str:
    if entry.get("caption"):
        return entry["caption"]
    return feed_caps.get(entry["source"], entry.get("topic", ""))


def _pixel_is_border(rgb: tuple[int, int, int]) -> bool:
    r, g, b = rgb
    if r >= 248 and g >= 248 and b >= 248:
        return True
    if r <= 12 and g <= 12 and b <= 12:
        return True
    return False


def trim_letterbox_borders(src: Path, dest: Path) -> None:
    """Crop white/black letterbox padding from scraped social images."""
    from PIL import Image

    im = Image.open(src).convert("RGB")
    pixels = im.load()
    width, height = im.size

    def row_border(y: int) -> bool:
        hits = sum(1 for x in range(width) if _pixel_is_border(pixels[x, y]))
        return hits >= width * 0.97

    def col_border(x: int) -> bool:
        hits = sum(1 for y in range(height) if _pixel_is_border(pixels[x, y]))
        return hits >= height * 0.97

    top = 0
    while top < height and row_border(top):
        top += 1
    bottom = height - 1
    while bottom > top and row_border(bottom):
        bottom -= 1
    left = 0
    while left < width and col_border(left):
        left += 1
    right = width - 1
    while right > left and col_border(right):
        right -= 1

    if right > left and bottom > top:
        im = im.crop((left, top, right + 1, bottom + 1))

    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, format="JPEG", quality=92, optimize=True)


def jpeg_dimensions(path: Path) -> tuple[int, int] | None:
    """Read width/height from JPEG SOF marker (no Pillow required)."""
    try:
        data = path.read_bytes()
    except OSError:
        return None
    if len(data) < 4 or data[0:2] != b"\xff\xd8":
        return None
    i = 2
    while i < len(data) - 9:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            height = (data[i + 5] << 8) + data[i + 6]
            width = (data[i + 7] << 8) + data[i + 8]
            return width, height
        if marker == 0xD9:
            break
        length = (data[i + 2] << 8) + data[i + 3]
        i += 2 + length
    return None


def main() -> None:
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    else:
        manifest = DEFAULT_MANIFEST
        MANIFEST.parent.mkdir(parents=True, exist_ok=True)
        MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    MISSION_DIR.mkdir(parents=True, exist_ok=True)
    gallery_items: list[dict] = []
    feed_caps = load_feed_captions()

    active_ids: set[str] = set()

    for entry in manifest.get("items", []):
        src_rel = entry.get("source", "")
        if entry.get("platform", "facebook") not in ("facebook", "instagram"):
            print(f"SKIP unsupported platform: {src_rel}")
            continue
        src = ROOT / src_rel
        if not src.exists():
            print(f"SKIP missing: {src_rel}")
            continue
        dest = MISSION_DIR / f"{entry['id']}.jpg"
        trim_letterbox_borders(src, dest)
        active_ids.add(entry["id"])
        caption = caption_for_entry(entry, feed_caps)
        item: dict = {
            "id": entry["id"],
            "topic": entry["topic"],
            "platform": entry.get("platform", "facebook"),
            "image": str(dest.relative_to(ROOT)).replace("\\", "/"),
            "caption": caption,
        }
        dims = jpeg_dimensions(dest)
        if dims:
            item["width"], item["height"] = dims
        gallery_items.append(item)
        print(f"OK [{entry['topic']}] {entry['id']}")

    for old in MISSION_DIR.glob("*.jpg"):
        if old.stem not in active_ids:
            old.unlink()
            print(f"REMOVED old mission image: {old.name}")

    version = datetime.now(timezone.utc).strftime("%Y%m%d%H%M")
    GALLERY_JSON.write_text(
        json.dumps({"version": version, "items": gallery_items}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"\nWrote {len(gallery_items)} items -> {GALLERY_JSON}")


if __name__ == "__main__":
    main()
