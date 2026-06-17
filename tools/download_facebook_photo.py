#!/usr/bin/env python3
"""Download Facebook photo(s) from a photo viewer URL — CDN extraction + next-photo navigation."""

from __future__ import annotations

import json
import re
import ssl
import sys
import urllib.request
from pathlib import Path
from urllib.parse import unquote

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "images" / "social" / "fb"
LOG_JSON = ROOT / "data" / "social" / "fb-photo-download-log.json"

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

NEXT_SELECTORS = [
    '[aria-label="Next photo"]',
    '[aria-label="Next"]',
    'div[role="button"] i.x13vifvy',
]

MIN_BYTES = 8_000


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.facebook.com/"})
    try:
        with urllib.request.urlopen(req, timeout=45, context=ssl.create_default_context()) as resp:
            return resp.read()
    except Exception:
        return b""


def hi_res_variants(url: str) -> list[str]:
    if not url:
        return []
    out: list[str] = []
    stripped = re.sub(r"&stp=[^&]*", "", url)
    stripped = re.sub(r"&ctp=[^&]*", "", stripped)
    stripped = re.sub(r"\?&", "?", stripped).rstrip("?&")
    out.append(stripped)
    for ctp in ("p2048x2048", "p1080x1080", "s1080x1080", "p960x960"):
        out.append(re.sub(r"ctp=[^&]*", f"ctp={ctp}", url))
    if url not in out:
        out.append(url)
    seen: set[str] = set()
    unique: list[str] = []
    for u in out:
        if u and u not in seen:
            seen.add(u)
            unique.append(u)
    return unique


def download_best(url: str, dest: Path) -> int:
    dest.parent.mkdir(parents=True, exist_ok=True)
    best = b""
    best_url = url
    for variant in hi_res_variants(url):
        data = fetch_bytes(variant)
        if len(data) > len(best):
            best = data
            best_url = variant
    if len(best) < MIN_BYTES:
        return 0
    dest.write_bytes(best)
    print(f"  saved {dest.name} ({len(best):,} bytes)")
    print(f"    from {best_url[:90]}…")
    return len(best)


def dismiss_banners(page) -> None:
    for label in ("Allow all cookies", "Accept All", "Decline optional cookies", "Not now", "Accept"):
        try:
            page.get_by_role("button", name=re.compile(label, re.I)).first.click(timeout=1000)
            page.wait_for_timeout(300)
        except Exception:
            pass


def collect_cdn_urls(page) -> list[str]:
    urls: list[str] = []
    try:
        og = page.locator('meta[property="og:image"]').first.get_attribute("content")
        if og and "fbcdn" in og:
            urls.append(og)
    except Exception:
        pass
    for img in page.locator('img[src*="scontent"], img[src*="fbcdn.net"]').all():
        src = img.get_attribute("src") or ""
        if src and "emoji" not in src and "rsrc.php" not in src:
            urls.append(src)
    seen: set[str] = set()
    out: list[str] = []
    for u in urls:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def best_image_url(page) -> str | None:
    urls = collect_cdn_urls(page)
    if not urls:
        return None
    best_url, best_score = urls[0], 0
    for url in urls:
        score = 0
        m = re.search(r"(\d+)x(\d+)", url)
        if m:
            score = int(m.group(1)) * int(m.group(2))
        elif "p2048" in url or "s2048" in url:
            score = 4_000_000
        elif "p1080" in url:
            score = 1_000_000
        data = fetch_bytes(url)
        score = max(score, len(data) // 100)
        if score > best_score:
            best_score = score
            best_url = url
    return best_url


def click_next(page) -> bool:
    prev_url = page.url
    for sel in NEXT_SELECTORS:
        try:
            loc = page.locator(sel).first
            if loc.count() and loc.is_visible(timeout=500):
                loc.click(timeout=2000)
                page.wait_for_timeout(1500)
                if page.url != prev_url:
                    return True
        except Exception:
            pass
    try:
        page.keyboard.press("ArrowRight")
        page.wait_for_timeout(1500)
        if page.url != prev_url:
            return True
    except Exception:
        pass
    try:
        clicked = page.evaluate(
            """() => {
            const sels = [
              '[aria-label="Next photo"]',
              '[aria-label="Next"]',
            ];
            for (const s of sels) {
              const el = document.querySelector(s);
              if (el) { el.click(); return true; }
            }
            const btns = document.querySelectorAll('div[role="button"]');
            for (const b of btns) {
              const label = (b.getAttribute('aria-label') || '').toLowerCase();
              if (label.includes('next')) { b.click(); return true; }
            }
            return false;
          }"""
        )
        if clicked:
            page.wait_for_timeout(1500)
            return page.url != prev_url
    except Exception:
        pass
    return False


def discover_album_photo_urls(page, set_url: str) -> list[str]:
    """Collect fbid links from album/set page when viewer Next is blocked."""
    import re as _re
    from urllib.parse import urljoin

    album_url = set_url
    if "set=pb." in set_url:
        m = _re.search(r"set=(pb\.\d+\.-?\d+)", set_url)
        if m:
            page_id = _re.search(r"pb\.(\d+)", m.group(1))
            if page_id:
                album_url = f"https://www.facebook.com/{page_id.group(1)}/photos_albums"

    found: list[str] = []
    try:
        page.goto(album_url, wait_until="domcontentloaded", timeout=45000)
        page.wait_for_timeout(2500)
        dismiss_banners(page)
        for _ in range(8):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(700)
        html = page.content()
        for fbid in _re.findall(r"fbid=(\d+)", html):
            found.append(f"https://www.facebook.com/photo/?fbid={fbid}")
    except Exception:
        pass
    seen: set[str] = set()
    out: list[str] = []
    for u in found:
        if u not in seen:
            seen.add(u)
            out.append(u)
    return out


def scrape_photo_set(photo_url: str, max_photos: int = 50) -> list[dict]:
    results: list[dict] = []
    seen_urls: set[str] = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=UA, viewport={"width": 1400, "height": 900})
        page = context.new_page()

        cdn_from_network: list[str] = []

        def on_response(resp):
            u = resp.url
            if "scontent" in u and ("fbcdn.net" in u) and re.search(r"\.(jpg|jpeg|webp)(\?|$)", u, re.I):
                cdn_from_network.append(u)

        page.on("response", on_response)

        print(f"Loading {photo_url}")
        page.goto(photo_url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(3500)
        dismiss_banners(page)

        for idx in range(max_photos):
            page.wait_for_timeout(800)
            img_url = best_image_url(page)
            if not img_url:
                for u in reversed(cdn_from_network):
                    if u not in seen_urls:
                        img_url = u
                        break
            if not img_url or img_url in seen_urls:
                if idx == 0:
                    print("  no CDN image found on first photo")
                break
            seen_urls.add(img_url)

            fbid_m = re.search(r"fbid=(\d+)", page.url) or re.search(r"fbid=(\d+)", photo_url)
            fbid = fbid_m.group(1) if fbid_m else f"{idx + 1:02d}"
            dest = OUT_DIR / f"photo-{fbid}.jpg"

            nbytes = download_best(img_url, dest)
            entry = {
                "index": idx + 1,
                "fbid": fbid,
                "page_url": page.url,
                "cdn_url": img_url,
                "file": str(dest.relative_to(ROOT)).replace("\\", "/"),
                "bytes": nbytes,
            }
            results.append(entry)
            print(f"Photo {idx + 1}: fbid={fbid}")

            if not click_next(page):
                print("  no more photos (Next not found)")
                break

        # Fallback: discover album URLs if viewer navigation stopped early.
        if len(results) < max_photos:
            extra_urls = discover_album_photo_urls(page, photo_url)
            for photo_link in extra_urls:
                if len(results) >= max_photos:
                    break
                fbid_m = re.search(r"fbid=(\d+)", photo_link)
                fbid = fbid_m.group(1) if fbid_m else ""
                if any(r.get("fbid") == fbid for r in results):
                    continue
                try:
                    page.goto(photo_link, wait_until="domcontentloaded", timeout=35000)
                    page.wait_for_timeout(2000)
                except Exception:
                    continue
                img_url = best_image_url(page)
                if not img_url or img_url in seen_urls:
                    continue
                seen_urls.add(img_url)
                dest = OUT_DIR / f"photo-{fbid}.jpg"
                nbytes = download_best(img_url, dest)
                results.append({
                    "index": len(results) + 1,
                    "fbid": fbid,
                    "page_url": photo_link,
                    "cdn_url": img_url,
                    "file": str(dest.relative_to(ROOT)).replace("\\", "/"),
                    "bytes": nbytes,
                    "source": "album-discovery",
                })
                print(f"Photo {len(results)}: fbid={fbid} (album)")

        browser.close()

    return results


def main() -> int:
    url = (
        sys.argv[1]
        if len(sys.argv) > 1
        else "https://www.facebook.com/photo/?fbid=122296999934069357&set=pb.61552080731596.-2207520000"
    )
    max_photos = int(sys.argv[2]) if len(sys.argv) > 2 else 50

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    results = scrape_photo_set(unquote(url), max_photos=max_photos)

    LOG_JSON.parent.mkdir(parents=True, exist_ok=True)
    LOG_JSON.write_text(json.dumps({"source_url": url, "downloads": results}, indent=2), encoding="utf-8")
    print(f"\nDone: {len(results)} image(s) -> {OUT_DIR}")
    print(f"Log: {LOG_JSON}")
    return 0 if results else 1


if __name__ == "__main__":
    raise SystemExit(main())
