#!/usr/bin/env python3
"""Build mission gallery manifest from feed.json — one image per real post, all topics."""

from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FEED_JSON = ROOT / "data" / "social" / "feed.json"
MANIFEST = ROOT / "data" / "mission" / "gallery-manifest.json"
FB_DIR = ROOT / "images" / "social" / "fb"

MAX_ITEMS = 10
MAX_PER_TOPIC = 2

FALLBACK_PHRASES = (
    "night-time lightning over the rtl3d study region",
    "lightning localization seminar — 2d and 3d mapping progress",
    "lf and vhf observation network field work",
    "rtl3d field campaign preparations",
    "rogowski coil and current sensors verified",
    "satreps malaysia–japan team advancing",
)

TOPIC_PRIORITY = [
    ("Rogowski coil", re.compile(r"rogowski|tm bukit gasing.*current\s+sensor", re.I)),
    ("Rocket-triggered lightning", re.compile(r"rtl[\s-]?campaign|rocket[\s-]?trigger|rtl site|rtl-3d", re.I)),
    ("Observation network", re.compile(r"equipment\s+handed|\blf\b.*\bvhf\b|observation\s+network|jcc.*meeting|site\s+visit.*met", re.I)),
    ("3D lightning mapping", re.compile(r"3\s*d\s*|localization|mapping|lightning\s+seminar|falma|iclp|lightning\s+protection", re.I)),
]

EXCLUDE = re.compile(r"eid\s*mubarak|hari\s*raya|aidilfitri|selamat\s*raya", re.I)

CURATED_FB = [
    {
        "source": "images/social/fb/01.jpg",
        "min_bytes": 150_000,
        "topic": "3D lightning mapping",
        "platform": "facebook",
        "caption": "Night-time lightning flash over the RTL3D study region — natural cloud-to-ground activity in the research area.",
        "fixed_topic": True,
    },
]


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"[✨⚡️∎🔥🤝]", "", text)
    return re.sub(r"\s+", " ", text).strip()


def figure_caption(text: str, max_len: int = 220) -> str:
    text = normalize(text)
    if len(text) <= max_len:
        return text
    return text[:max_len].rsplit(" ", 1)[0] + "…"


def caption_key(text: str) -> str:
    return normalize(text).lower()[:100]


def is_real_post(text: str) -> bool:
    norm = normalize(text)
    if len(norm) < 22:
        return False
    low = norm.lower()
    if EXCLUDE.search(low):
        return False
    return not any(p in low for p in FALLBACK_PHRASES)


def topic_for(text: str) -> str:
    norm = normalize(text)
    if re.search(r"seminar", norm, re.I) and re.search(r"localization|3\s*d|mapping|falma", norm, re.I):
        return "3D lightning mapping"
    for name, pat in TOPIC_PRIORITY:
        if pat.search(norm):
            return name
    return "3D lightning mapping"


def slug(text: str, n: int) -> str:
    words = re.findall(r"[a-z0-9]{3,}", normalize(text).lower())
    base = "-".join(words[:4]) or "mission"
    return f"{base[:42]}-{n:02d}"


def load_posts() -> list[dict]:
    posts: list[dict] = []
    if FEED_JSON.exists():
        feed = json.loads(FEED_JSON.read_text(encoding="utf-8"))
        for platform in ("facebook", "instagram"):
            for entry in feed.get(platform, []):
                text = entry.get("text", "")
                image = entry.get("image", "")
                if not image or not is_real_post(text):
                    continue
                if not (ROOT / image).exists():
                    continue
                cap = figure_caption(text)
                posts.append({
                    "source": image,
                    "text": cap,
                    "topic": topic_for(text),
                    "platform": platform,
                    "score": len(cap),
                })

    for entry in CURATED_FB:
        path = ROOT / entry["source"]
        if path.exists() and path.stat().st_size >= entry.get("min_bytes", 0):
            posts.append({
                "source": entry["source"],
                "text": entry["caption"],
                "topic": entry["topic"],
                "platform": entry["platform"],
                "score": 500,
                "fixed_topic": entry.get("fixed_topic", False),
            })

    return posts


def pick_manifest(posts: list[dict]) -> list[dict]:
    seen: set[str] = set()
    topic_count: dict[str, int] = {}
    items: list[dict] = []

    def add(post: dict, topic: str) -> bool:
        if post.get("fixed_topic"):
            topic = post["topic"]
        if topic_count.get(topic, 0) >= MAX_PER_TOPIC:
            return False
        ck = caption_key(post["text"])
        if ck in seen:
            return False
        seen.add(ck)
        topic_count[topic] = topic_count.get(topic, 0) + 1
        items.append({
            "source": post["source"],
            "id": slug(post["text"], len(items) + 1),
            "topic": topic,
            "platform": post["platform"],
            "caption": post["text"],
        })
        return True

    for topic, pat in TOPIC_PRIORITY:
        for post in sorted(posts, key=lambda p: p["score"], reverse=True):
            if post["topic"] != topic and not pat.search(post["text"]):
                continue
            if add(post, topic):
                break

    for post in sorted(posts, key=lambda p: p["score"], reverse=True):
        if len(items) >= MAX_ITEMS:
            break
        if topic_count.get(post["topic"], 0) >= MAX_PER_TOPIC:
            continue
        add(post, post["topic"])

    return items


def main() -> None:
    posts = load_posts()
    items = pick_manifest(posts)
    if not items:
        print("No mission posts found")
        return
    MANIFEST.write_text(
        json.dumps({"items": items}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(items)} manifest items -> {MANIFEST}")
    for item in items:
        print(f"  [{item['topic']}] {item['platform']} {item['source']}")


if __name__ == "__main__":
    main()
