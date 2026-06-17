#!/usr/bin/env python3
"""Scrape Facebook / Instagram post images with Playwright for the social feed."""

from __future__ import annotations

import json
import re
import urllib.request
from html import unescape
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "images" / "social"
FEED_JSON = ROOT / "data" / "social" / "feed.json"

FB_URL = "https://www.facebook.com/rtl3d"
IG_URL = "https://www.instagram.com/satreps_rtl3d/"

MAX_FB = 8
MAX_IG = 10
MIN_BYTES = 22_000
MIN_WIDTH = 280

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )
}


def download(url: str, dest: Path) -> int:
    """Download image; return byte size or 0 on failure."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(
        url,
        headers={**HEADERS, "Referer": "https://www.instagram.com/"},
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            data = resp.read()
        if len(data) < MIN_BYTES:
            return 0
        dest.write_bytes(data)
        return len(data)
    except Exception:
        return 0


def unique(seq: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in seq:
        if item and item not in seen:
            seen.add(item)
            out.append(item)
    return out


def merge_feed(platform: str, scraped: list[dict], existing: dict) -> list[dict]:
    old = existing.get(platform, [])
    merged: list[dict] = []
    for i, item in enumerate(scraped):
        entry = {k: v for k, v in item.items() if k != "source"}
        if platform != "facebook":
            if i < len(old):
                if old[i].get("date") and not entry.get("date"):
                    entry["date"] = old[i]["date"]
                if old[i].get("text") and not entry.get("text"):
                    entry["text"] = old[i]["text"]
        if not entry.get("image") and i < len(old) and old[i].get("image"):
            entry["image"] = old[i]["image"]
        if entry.get("image") or entry.get("text"):
            merged.append(entry)
    return merged or old


def dismiss_banners(page) -> None:
    for label in (
        "Allow all cookies",
        "Accept All",
        "Allow essential and optional cookies",
        "Decline optional cookies",
        "Not now",
        "Not Now",
        "Accept",
    ):
        try:
            page.get_by_role("button", name=re.compile(label, re.I)).first.click(timeout=1200)
            page.wait_for_timeout(500)
        except Exception:
            pass


def collect_img_candidates(page, selectors: str) -> list[tuple[str, int, int]]:
    out: list[tuple[str, int, int]] = []
    for img in page.locator(selectors).all():
        try:
            src = img.get_attribute("src") or ""
            if not src or "emoji" in src or "rsrc.php" in src or "static.xx.fbcdn.net/rsrc" in src:
                continue
            w, h = img.evaluate(
                "el => [el.naturalWidth || el.width || 0, el.naturalHeight || el.height || 0]"
            )
            if w >= MIN_WIDTH and h >= MIN_WIDTH:
                out.append((src, int(w), int(h)))
        except Exception:
            continue
    return out


def scrape_facebook(page) -> list[dict]:
    print("Loading Facebook…")
    page.goto(FB_URL, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(3500)
    dismiss_banners(page)

    for frac in (0.25, 0.5, 0.75, 1.0, 1.25):
        page.evaluate(f"window.scrollTo(0, document.body.scrollHeight * {frac})")
        page.wait_for_timeout(1500)

    candidates = collect_img_candidates(
        page,
        '[role="article"] img, [data-pagelet*="Feed"] img, img[src*="scontent"]',
    )
    candidates.sort(key=lambda t: t[1] * t[2], reverse=True)
    image_urls = unique([c[0] for c in candidates])
    print(f"  FB candidate images: {len(image_urls)}")

    items: list[dict] = []
    used = 0
    for src in image_urls:
        if used >= MAX_FB:
            break
        local = OUT_DIR / "fb" / f"{used + 1:02d}.jpg"
        size = download(src, local)
        if not size:
            continue
        used += 1
        image_path = str(local.relative_to(ROOT)).replace("\\", "/")
        print(f"  saved {image_path} ({size // 1024} KB)")
        items.append({"date": "", "text": "", "image": image_path})
    return items


def clean_ig_caption(raw: str | None) -> str | None:
    if not raw:
        return None
    match = re.search(r':\s*"(.+)', raw, re.S)
    text = match.group(1).rstrip('"') if match else raw
    text = text.replace("\\n", "\n").strip()
    return text[:480] or None


def ig_post_image(page, post_url: str) -> tuple[str | None, str | None]:
    try:
        page.goto(post_url, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(2200)
        og = page.locator('meta[property="og:image"]').first.get_attribute("content")
        caption = page.locator('meta[property="og:description"]').first.get_attribute("content")
        if og:
            return unescape(og), (caption or "").strip() or None
        for img in page.locator('img[src*="cdninstagram"], img[src*="scontent"]').all():
            src = img.get_attribute("src") or ""
            w = img.evaluate("el => el.naturalWidth || el.width || 0")
            if src and w >= MIN_WIDTH:
                return src, (caption or "").strip() or None
    except Exception:
        return None, None
    return None, None


def scrape_instagram(page) -> list[dict]:
    print("Loading Instagram…")
    page.goto(IG_URL, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(3000)
    dismiss_banners(page)

    for _ in range(5):
        page.evaluate("window.scrollBy(0, window.innerHeight * 0.85)")
        page.wait_for_timeout(1000)

    html = page.content()
    codes = unique(re.findall(r"/p/([A-Za-z0-9_-]{5,})/", html))
    codes = [c for c in codes if c.lower() != "satreps_rtl3d"][:MAX_IG]
    post_urls = [f"https://www.instagram.com/p/{c}/" for c in codes]
    print(f"  IG post URLs: {len(post_urls)}")

    items: list[dict] = []
    for i, post_url in enumerate(post_urls):
        img_url, caption = ig_post_image(page, post_url)
        local = OUT_DIR / "ig" / f"{i + 1:02d}.jpg"
        image_path = None
        if img_url:
            size = download(img_url, local)
            if size:
                image_path = str(local.relative_to(ROOT)).replace("\\", "/")
                print(f"  saved {image_path} ({size // 1024} KB)")
        entry = {"date": "", "text": "", "image": image_path}
        if caption:
            entry["text"] = clean_ig_caption(caption) or ""
        items.append(entry)

    return [x for x in items if x.get("image")]


def main() -> None:
    existing = {"facebook": [], "instagram": []}
    if FEED_JSON.exists():
        existing = json.loads(FEED_JSON.read_text(encoding="utf-8"))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=HEADERS["User-Agent"],
            locale="en-US",
        )
        page = context.new_page()
        try:
            ig_items = scrape_instagram(page)
            fb_page = context.new_page()
            try:
                fb_items = scrape_facebook(fb_page)
            except Exception as exc:
                print(f"Facebook scrape failed: {exc}")
                fb_items = []
            finally:
                fb_page.close()
        finally:
            browser.close()

    feed = {
        "facebook": merge_feed("facebook", fb_items, existing),
        "instagram": merge_feed("instagram", ig_items, existing),
    }

    FEED_JSON.parent.mkdir(parents=True, exist_ok=True)
    FEED_JSON.write_text(json.dumps(feed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {FEED_JSON}")
    print(f"  Facebook: {sum(1 for x in feed['facebook'] if x.get('image'))} images")
    print(f"  Instagram: {sum(1 for x in feed['instagram'] if x.get('image'))} images")


if __name__ == "__main__":
    main()
