#!/usr/bin/env python3
"""Scrape Facebook timeline posts — image + caption per article block."""

from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "images" / "social" / "fb"
FEED_JSON = ROOT / "data" / "social" / "feed.json"
FB_PAGE = "https://www.facebook.com/rtl3d"

MAX_POSTS = 12
MIN_BYTES = 18_000
MIN_IMG_WIDTH = 180

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}

EXCLUDE_CAPTION = re.compile(
    r"jcc\s+meeting|joint coordination committee|eid\s+mubarak|hari\s+raya|"
    r"memorandum of understanding|\bmou\b|panel discussion",
    re.I,
)


def download(url: str, dest: Path) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={**HEADERS, "Referer": "https://www.facebook.com/"})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = resp.read()
        if len(data) < MIN_BYTES:
            return 0
        dest.write_bytes(data)
        return len(data)
    except Exception:
        return 0


def dismiss_banners(page) -> None:
    for label in (
        "Allow all cookies", "Accept All", "Decline optional cookies",
        "Not now", "Not Now", "Accept",
    ):
        try:
            page.get_by_role("button", name=re.compile(label, re.I)).first.click(timeout=1200)
            page.wait_for_timeout(350)
        except Exception:
            pass


def clean_caption(raw: str) -> str:
    import unicodedata
    text = unicodedata.normalize("NFKC", raw)
    text = re.sub(r"\s+", " ", text).strip()
    # Drop trailing engagement noise
    text = re.sub(r"^\d+\s+(like|comment|share).*?$", "", text, flags=re.I).strip()
    return text[:480]


def scrape_timeline(page) -> list[dict]:
    page.goto(FB_PAGE, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(4000)
    dismiss_banners(page)

    for frac in (0.15, 0.35, 0.55, 0.75, 0.95, 1.2, 1.5, 1.8):
        page.evaluate(f"window.scrollTo(0, document.body.scrollHeight * {frac})")
        page.wait_for_timeout(1100)

    articles = page.locator('[role="article"]').all()
    print(f"  article blocks: {len(articles)}")

    scraped: list[dict] = []
    seen_src: set[str] = set()

    for article in articles:
        if len(scraped) >= MAX_POSTS:
            break
        try:
            text = clean_caption(article.inner_text())
            if len(text) < 20:
                continue

            best_src = None
            best_area = 0
            for img in article.locator('img[src*="scontent"], img[src*="fbcdn"]').all():
                src = img.get_attribute("src") or ""
                if not src or "emoji" in src or "rsrc.php" in src or src in seen_src:
                    continue
                w, h = img.evaluate(
                    "el => [el.naturalWidth || el.width || 0, el.naturalHeight || el.height || 0]"
                )
                area = int(w) * int(h)
                if w >= MIN_IMG_WIDTH and area > best_area:
                    best_area = area
                    best_src = src

            if not best_src:
                continue
            seen_src.add(best_src)
            scraped.append({"text": text, "image_url": best_src})
        except Exception:
            continue

    return scraped


def save_items(scraped: list[dict]) -> list[dict]:
    items: list[dict] = []
    for i, post in enumerate(scraped):
        local = OUT_DIR / f"{i + 1:02d}.jpg"
        size = download(post["image_url"], local)
        if not size:
            continue
        path = str(local.relative_to(ROOT)).replace("\\", "/")
        caption = post["text"]
        print(f"  [{i + 1:02d}] {path} ({size // 1024} KB)")
        print(f"       {caption[:90]}...")
        items.append({"date": "", "text": caption, "image": path})
    return items


def main() -> None:
    existing_feed = {"facebook": [], "instagram": []}
    if FEED_JSON.exists():
        existing_feed = json.loads(FEED_JSON.read_text(encoding="utf-8"))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=HEADERS["User-Agent"],
            locale="en-US",
        )
        page = context.new_page()
        try:
            print("Scraping Facebook timeline…")
            scraped = scrape_timeline(page)
            print(f"  paired posts: {len(scraped)}")
            fb_items = save_items(scraped)
        finally:
            browser.close()

    # Keep Instagram; replace Facebook with fresh scrape
    feed = dict(existing_feed)
    feed["facebook"] = fb_items

    FEED_JSON.write_text(json.dumps(feed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    log_path = ROOT / "data" / "social" / "fb-scrape-log.json"
    log_path.write_text(json.dumps(fb_items, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {len(fb_items)} Facebook posts -> {FEED_JSON}")


if __name__ == "__main__":
    main()
