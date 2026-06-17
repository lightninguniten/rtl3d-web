#!/usr/bin/env python3
"""Scrape RTL3D Facebook — many posts via timeline, post URLs, and photos tab."""

from __future__ import annotations

import hashlib
import json
import re
import ssl
import sys
import urllib.request
from html import unescape
from pathlib import Path
from urllib.parse import unquote, urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "images" / "social" / "fb"
FEED_JSON = ROOT / "data" / "social" / "feed.json"
MANIFEST = ROOT / "data" / "mission" / "gallery-manifest.json"
SCRAPE_LOG = ROOT / "data" / "social" / "fb-scrape-log.json"

FB_PAGE = "https://www.facebook.com/rtl3d"
FB_PHOTOS = "https://www.facebook.com/rtl3d/photos"
FB_MOBILE = "https://m.facebook.com/rtl3d"

MAX_IMAGES = 120
MAX_MISSION_GALLERY = 16
MAX_POST_VISITS = 0  # photo-page pass covers unique fbids; post URLs often hang
MAX_PHOTO_PAGE_VISITS = 60
MAX_SCROLL_STEPS = 35
MIN_CAPTION_LEN = 12
MIN_BYTES = 15_000
MIN_IMG_WIDTH = 180
MIN_HI_RES_BYTES = 50_000  # prefer upgraded CDN URLs over feed thumbnails

TOPIC_PRIORITY = [
    ("Rogowski coil", re.compile(r"rogowski|current\s+sensor|lightning\s+current", re.I)),
    ("Rocket-triggered lightning", re.compile(r"rtl[\s-]?campaign|rocket[\s-]?trigger|\brtl\b|rtl-3d", re.I)),
    ("Observation network", re.compile(r"\blf\b|vhf|equipment\s+handed|observation\s+network|field\s+site", re.I)),
    ("3D lightning mapping", re.compile(r"3\s*d\s*|localization|mapping|lightning\s+flash|seminar|falma", re.I)),
]

def log(msg: str) -> None:
    print(msg, flush=True)


UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

MISSION_INCLUDE = re.compile(
    r"rtl3d|rtl[\s-]?3d|\brtl\b|rocket[\s-]?trigger|lightning|kilat|petir|satreps|"
    r"\blf\b|vhf|rogowski|observation|field\s+(site|campaign|season)|"
    r"3\s*d\s*|localization|localisation|mapping|charge\s+imag|falma|thor\s+lab|"
    r"receiver|sensor|calibrat|nowcast|triggered|discharge|seminar|research|"
    r"uniten|utem|kindai|peninsular|monsoon|cg\s+lightning|early\s+warning|jcc|"
    r"coordination|international|malaysia|japan|kindai|observ",
    re.I,
)

MISSION_EXCLUDE = re.compile(
    r"eid\s+mubarak|hari\s+raya|aidilfitri|selamat\s+raya",
    re.I,
)

TOPIC_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"rogowski|current\s+sensor|lightning\s+current", re.I), "Rogowski coil"),
    (re.compile(r"\brtl\b|rocket[\s-]?trigger|triggered\s+lightning", re.I), "Rocket-triggered lightning"),
    (re.compile(r"3\s*d\s*|localization|localisation|mapping|charge\s+imag|reconstruction", re.I), "3D lightning mapping"),
    (re.compile(r"\blf\b|vhf|observation\s+network|receiver|sensor|field\s+site|calibrat", re.I), "Observation network"),
    (re.compile(r"lightning|kilat|petir|satreps|seminar|research|jcc|coordination", re.I), "3D lightning mapping"),
]

FALLBACK_CAPTIONS = [
    ("3D lightning mapping", "Night-time lightning over the RTL3D study region — CG activity monitored by the Peninsular LF network."),
    ("3D lightning mapping", "Lightning localization seminar — 2D and 3D mapping progress using Malaysian FALMA observation data."),
    ("Observation network", "LF and VHF observation network field work — site checks ahead of the monsoon lightning season."),
    ("Rocket-triggered lightning", "RTL3D field campaign preparations — rocket-triggered lightning research in Malaysia."),
    ("Rogowski coil", "Rogowski coil and current sensors verified at observation sites for triggered-lightning measurements."),
    ("3D lightning mapping", "SATREPS Malaysia–Japan team advancing real-time 3D lightning imaging for public safety."),
]


def _fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": "https://www.facebook.com/"})
    try:
        with urllib.request.urlopen(req, timeout=45, context=ssl.create_default_context()) as resp:
            return resp.read()
    except Exception:
        return b""


def hi_res_url_variants(url: str) -> list[str]:
    """Facebook feed thumbnails embed ctp=s590x590 — strip or bump to max CDN size."""
    if not url:
        return []
    variants: list[str] = []
    stripped = re.sub(r"&stp=[^&]*", "", url)
    stripped = re.sub(r"&ctp=[^&]*", "", stripped)
    stripped = re.sub(r"\?&", "?", stripped).rstrip("?&")
    variants.append(stripped)
    cstp = re.search(r"cstp=(mx\d+x\d+)", url)
    if cstp:
        variants.append(re.sub(r"ctp=[^&]*", f"ctp={cstp.group(1)}", url))
    for ctp in ("p2048x2048", "p1080x1080", "s1080x1080", "p960x960"):
        variants.append(re.sub(r"ctp=[^&]*", f"ctp={ctp}", url))
    stripped_stp = re.sub(r"&stp=[^&]*", "", url)
    if stripped_stp not in variants:
        variants.append(stripped_stp)
    if url not in variants:
        variants.append(url)
    return unique(variants)


def download(url: str, dest: Path) -> int:
    """Download the largest available variant of a Facebook CDN image URL."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    best = b""
    for variant in hi_res_url_variants(url):
        data = _fetch_bytes(variant)
        if len(data) > len(best):
            best = data
    if len(best) < MIN_BYTES:
        return 0
    dest.write_bytes(best)
    return len(best)


def dismiss_banners(page) -> None:
    for label in ("Allow all cookies", "Accept All", "Decline optional cookies", "Not now", "Accept"):
        try:
            page.get_by_role("button", name=re.compile(label, re.I)).first.click(timeout=1000)
            page.wait_for_timeout(300)
        except Exception:
            pass


def clean_article_text(raw: str) -> str:
    import unicodedata

    text = unicodedata.normalize("NFKC", raw or "")
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"^RTL3D\s+.*?·\s*", "", text)
    text = re.sub(r"See more.*$", "", text, flags=re.I)
    text = re.sub(r"All reactions:.*$", "", text, flags=re.I)
    text = re.sub(r"Like\s+Comment.*$", "", text, flags=re.I)
    text = re.sub(r"^\d+\s+(like|comment|share)s?\b.*$", "", text, flags=re.I)
    return text.strip()


def figure_caption(text: str, max_len: int = 220) -> str:
    text = clean_article_text(text)
    text = re.sub(r"[✨⚡️∎🔥🤝]", "", text)
    if len(text) <= max_len:
        return text
    return text[:max_len].rsplit(" ", 1)[0] + "…"


def caption_key(text: str) -> str:
    norm = re.sub(r"\s+", " ", clean_article_text(text).lower())[:120]
    return hashlib.md5(norm.encode("utf-8")).hexdigest()[:12]


def post_id_from_url(url: str | None) -> str:
    if not url:
        return ""
    url = unquote(url)
    m = re.search(r"set=pcb\.(\d+)", url)
    if m:
        return f"pcb-{m.group(1)}"
    m = re.search(r"fbid=(\d+)", url)
    if m:
        return f"fbid-{m.group(1)}"
    m = re.search(r"posts/(pfbid[^/?&]+)", url)
    if m:
        return m.group(1)
    return url.split("?")[0][-64:]


def post_permalink(article) -> str | None:
    for pat in (r'/rtl3d/posts/', r'facebook\.com/.+/posts/'):
        try:
            for link in article.locator("a[href]").all():
                href = link.get_attribute("href") or ""
                if re.search(pat, href):
                    return unquote(href.split("&__cft__")[0].split("&__tn__")[0])
        except Exception:
            pass
    return None


def has_real_caption(post: dict) -> bool:
    text = post.get("caption") or post.get("text") or ""
    text = clean_article_text(text)
    if len(text) < MIN_CAPTION_LEN:
        return False
    # Reject generic fallback phrases not tied to a scraped post
    if text in {c for _t, c in FALLBACK_CAPTIONS}:
        return False
    return True


def topic_priority_boost(text: str) -> int:
    boost = 0
    for _topic, pattern in TOPIC_PRIORITY:
        if pattern.search(text):
            boost += 5
    return boost


def mission_score(text: str) -> int:
    text = clean_article_text(text)
    if MISSION_EXCLUDE.search(text):
        return -20
    if len(text) < 8:
        return 0
    score = 1
    for _ in MISSION_INCLUDE.finditer(text):
        score += 2
    if re.search(r"rtl3d|satreps|lightning", text, re.I):
        score += 3
    score += topic_priority_boost(text)
    return score


def topic_from_caption(text: str) -> str:
    for pattern, topic in TOPIC_RULES:
        if pattern.search(text):
            return topic
    return "3D lightning mapping"


def slug_from_caption(text: str, index: int) -> str:
    words = re.findall(r"[a-z0-9]{3,}", clean_article_text(text).lower())
    base = "-".join(words[:4]) or "mission-fb"
    return f"{base[:42]}-{index:02d}"


def unique(seq: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in seq:
        if item and item not in seen:
            seen.add(item)
            out.append(item)
    return out


def deep_scroll(page, steps: int = 22) -> None:
    for i in range(steps):
        frac = 0.08 + i * 0.14
        page.evaluate(f"window.scrollTo(0, document.body.scrollHeight * {frac})")
        page.wait_for_timeout(900)


def expand_see_more(article) -> None:
    try:
        for btn in article.locator('[role="button"]').all():
            if re.search(r"see more", (btn.inner_text() or ""), re.I):
                btn.click(timeout=800)
                return
    except Exception:
        pass


def discover_post_urls(page) -> list[str]:
    html = unescape(page.content())
    patterns = [
        r'href="(https://www\.facebook\.com/rtl3d/posts/[^"?]+)"',
        r'href="(https://www\.facebook\.com/photo/\?fbid=[^"&]+[^"]*)"',
        r'href="(/rtl3d/posts/[^"?]+)"',
        r'href="(/photo/\?fbid=[^"&]+[^"]*)"',
        r'"(https://www\.facebook\.com/rtl3d/posts/pfbid[^"]+)"',
        r'"(https://m\.facebook\.com/story\.php\?[^"]+)"',
    ]
    found: list[str] = []
    for pat in patterns:
        for match in re.findall(pat, html):
            url = match if match.startswith("http") else urljoin("https://www.facebook.com", match)
            url = unquote(url.split("&amp;")[0])
            if "rtl3d" in url or "fbid=" in url:
                found.append(url)
    return unique(found)


def og_meta(page) -> tuple[str | None, str | None]:
    try:
        img = page.locator('meta[property="og:image"]').first.get_attribute("content")
        desc = page.locator('meta[property="og:description"]').first.get_attribute("content")
        return (img or None), clean_article_text(desc or "")
    except Exception:
        return None, ""


def best_article_image(article) -> tuple[str | None, str | None]:
    """Return (thumbnail_url, photo_page_url) for the largest image in a post."""
    best_src, best_area = None, 0
    photo_href = None
    try:
        link = article.locator('a[href*="photo"], a[href*="fbid"]').first
        photo_href = link.get_attribute("href")
    except Exception:
        pass
    for img in article.locator('img[src*="scontent"], img[src*="fbcdn"]').all():
        src = img.get_attribute("src") or ""
        if not src or "emoji" in src or "rsrc.php" in src:
            continue
        w, h = img.evaluate("el => [el.naturalWidth||el.width||0, el.naturalHeight||el.height||0]")
        area = int(w) * int(h)
        if w >= MIN_IMG_WIDTH and area > best_area:
            best_area = area
            best_src = src
    if photo_href:
        photo_href = unquote(photo_href.split("&__cft__")[0])
    return best_src, photo_href


def image_from_photo_page(page, photo_url: str) -> str | None:
    try:
        page.goto(photo_url, wait_until="domcontentloaded", timeout=25000)
        page.wait_for_timeout(1800)
        return page.locator('meta[property="og:image"]').first.get_attribute("content")
    except Exception:
        return None


def collect_bulk_images(page) -> list[tuple[str, int]]:
    bulk: list[tuple[str, int]] = []
    for img in page.locator('img[src*="scontent"]').all():
        src = img.get_attribute("src") or ""
        if not src or "emoji" in src or "rsrc.php" in src:
            continue
        w, h = img.evaluate("el => [el.naturalWidth||el.width||0, el.naturalHeight||el.height||0]")
        if w >= MIN_IMG_WIDTH and h >= MIN_IMG_WIDTH:
            bulk.append((src, int(w) * int(h)))
    bulk.sort(key=lambda t: t[1], reverse=True)
    return bulk


FB_CRAWL_URLS = [
    FB_PAGE,
    FB_PHOTOS,
    f"{FB_PAGE}/photos_by",
    f"{FB_PAGE}/photos_albums",
    FB_MOBILE,
    f"{FB_MOBILE}/photos/",
]


def is_valid_cdn_url(url: str) -> bool:
    if not url or "emoji" in url or "rsrc.php" in url:
        return False
    return "scontent" in url and "fbcdn.net" in url


def discover_photo_urls_from_html(html: str) -> list[str]:
    html = unescape(html)
    found: list[str] = []
    patterns = [
        r'href="(https://www\.facebook\.com/photo/\?fbid=[^"&]+[^"]*)"',
        r'href="(/photo/\?fbid=[^"&]+[^"]*)"',
        r'"(https://www\.facebook\.com/photo/\?fbid=[^"]+)"',
        r'"(https://m\.facebook\.com/photo\.php\?fbid=[^"]+)"',
        r'href="(https://www\.facebook\.com/rtl3d/posts/[^"?]+)"',
        r'href="(/rtl3d/posts/[^"?]+)"',
        r'"(https://www\.facebook\.com/rtl3d/posts/pfbid[^"]+)"',
        r'fbid=(\d{10,})',
    ]
    for pat in patterns:
        for match in re.findall(pat, html):
            if match.isdigit():
                found.append(f"https://www.facebook.com/photo/?fbid={match}")
            else:
                url = match if match.startswith("http") else urljoin("https://www.facebook.com", match)
                found.append(unquote(url.split("&amp;")[0].split("&__cft__")[0]))
    return unique(found)


def heavy_scroll(page, steps: int | None = None) -> None:
    n = steps or MAX_SCROLL_STEPS
    for i in range(n):
        frac = 0.05 + i * (1.8 / max(n, 1))
        page.evaluate(f"window.scrollTo(0, document.body.scrollHeight * {frac})")
        page.wait_for_timeout(650)


def browse_section(page, url: str, cdn_urls: list[str]) -> tuple[list[str], list[dict]]:
    """Load a FB section, scroll deeply, harvest photo links and inline images."""
    photo_links: list[str] = []
    inline_posts: list[dict] = []
    try:
        log(f"  browsing {url}…")
        page.goto(url, wait_until="domcontentloaded", timeout=55000)
        page.wait_for_timeout(2800)
        dismiss_banners(page)
        heavy_scroll(page)
        html = page.content()
        photo_links = discover_photo_urls_from_html(html)
        for src, area in collect_bulk_images(page):
            cdn_urls.append(src)
            inline_posts.append({
                "image_url": src,
                "text": "",
                "caption": "",
                "score": 1,
                "topic": "3D lightning mapping",
                "source": f"browse:{url.split('/')[-1] or 'page'}",
                "post_id": f"cdn-{hashlib.md5(src.encode()).hexdigest()[:10]}",
            })
        log(f"    links={len(photo_links)}, inline images={len(inline_posts)}")
    except Exception as exc:
        log(f"    failed: {exc}")
    return photo_links, inline_posts


def scrape_photo_pages(page, photo_urls: list[str]) -> list[dict]:
    posts: list[dict] = []
    fbid_urls = [u for u in photo_urls if "fbid=" in u]
    other_urls = [u for u in photo_urls if "fbid=" not in u and "/posts/" in u]
    ordered = unique(fbid_urls + other_urls)
    for i, url in enumerate(ordered[:MAX_PHOTO_PAGE_VISITS]):
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=18000)
            page.wait_for_timeout(1000)
            dismiss_banners(page)
            img_url, desc = og_meta(page)
            if not img_url:
                bulk = collect_bulk_images(page)
                img_url = bulk[0][0] if bulk else None
            if not img_url or not is_valid_cdn_url(img_url):
                continue
            pid = post_id_from_url(url)
            caption = figure_caption(desc) if len(desc) >= MIN_CAPTION_LEN else ""
            text = desc or caption
            score = mission_score(text) if text else 1
            posts.append({
                "image_url": img_url,
                "photo_url": url,
                "post_url": url,
                "post_id": pid or f"photo-{i}",
                "text": text,
                "caption": caption or figure_caption(text) if text else "",
                "score": score + 3,
                "topic": topic_from_caption(text) if text else "3D lightning mapping",
                "source": "photo-page",
            })
            if (i + 1) % 10 == 0:
                log(f"    photo pages visited: {i + 1}/{min(len(ordered), MAX_PHOTO_PAGE_VISITS)}")
        except Exception:
            continue
    return posts


def caption_or_fallback(post: dict, index: int) -> str:
    cap = post.get("caption") or post.get("text") or ""
    cap = clean_article_text(cap)
    if len(cap) >= MIN_CAPTION_LEN:
        return figure_caption(cap)
    pid = post.get("post_id") or ""
    if pid.startswith("fbid-"):
        return f"RTL3D Facebook photo ({pid.replace('fbid-', '')})"
    return f"RTL3D project update — photo {index:02d}"


def merge_all_photos(*groups: list[dict]) -> list[dict]:
    """Merge every discovered photo; prefer entries with real captions."""
    merged: list[dict] = []
    seen_post: set[str] = set()
    seen_cdn: set[str] = set()
    seen_cap: set[str] = set()

    all_posts = sorted(
        [p for group in groups for p in group if p.get("image_url")],
        key=lambda p: (
            1 if has_real_caption(p) else 0,
            {"photo-page": 40, "post-page": 30, "timeline": 20}.get(p.get("source", ""), 0),
            p.get("score", 0),
        ),
        reverse=True,
    )

    for post in all_posts:
        pid = post.get("post_id") or post_id_from_url(post.get("post_url")) or post_id_from_url(post.get("photo_url"))
        cdn_key = hashlib.md5((post.get("image_url") or "").encode()).hexdigest()[:16]
        if pid and pid in seen_post:
            continue
        if cdn_key in seen_cdn:
            continue
        cap = post.get("caption") or post.get("text") or ""
        ck = caption_key(cap) if len(clean_article_text(cap)) >= MIN_CAPTION_LEN else ""
        if ck and ck in seen_cap:
            continue
        if pid:
            seen_post.add(pid)
        seen_cdn.add(cdn_key)
        if ck:
            seen_cap.add(ck)
        merged.append(post)
    return merged


def scrape_timeline_articles(page) -> list[dict]:
    posts: list[dict] = []
    for article in page.locator('[role="article"]').all():
        try:
            expand_see_more(article)
            page.wait_for_timeout(200)
            text = clean_article_text(article.inner_text())
            src, photo_href = best_article_image(article)
            permalink = post_permalink(article)
            if not src:
                continue
            score = mission_score(text)
            caption = figure_caption(text) if len(text) >= MIN_CAPTION_LEN else ""
            posts.append({
                "image_url": src,
                "photo_url": photo_href,
                "post_url": permalink,
                "post_id": post_id_from_url(permalink or photo_href) or f"tl-{hashlib.md5(src.encode()).hexdigest()[:10]}",
                "text": text,
                "caption": caption,
                "score": max(score, 1),
                "topic": topic_from_caption(text) if text else "3D lightning mapping",
                "source": "timeline",
            })
        except Exception:
            continue
    return posts


def scrape_post_pages(page, urls: list[str]) -> list[dict]:
    posts: list[dict] = []
    for url in urls:
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=22000)
            page.wait_for_timeout(1200)
            dismiss_banners(page)
            img_url, desc = og_meta(page)
            if not img_url:
                src, _ = best_article_image(page.locator("body"))
                img_url = src
            if not img_url:
                continue
            score = mission_score(desc) if desc else 1
            caption = figure_caption(desc) if len(desc) >= MIN_CAPTION_LEN else ""
            posts.append({
                "image_url": img_url,
                "text": desc,
                "caption": caption,
                "score": score + 2,
                "topic": topic_from_caption(desc) if desc else "3D lightning mapping",
                "source": "post-page",
                "post_url": url,
                "post_id": post_id_from_url(url),
            })
        except Exception:
            continue
    return posts


def merge_posts(*groups: list[dict]) -> list[dict]:
    merged: list[dict] = []
    seen_post: set[str] = set()
    seen_cap: set[str] = set()

    all_posts = sorted(
        [p for group in groups for p in group if has_real_caption(p)],
        key=lambda p: p.get("score", 0),
        reverse=True,
    )

    for post in all_posts:
        pid = post.get("post_id") or post_id_from_url(post.get("post_url")) or post_id_from_url(post.get("photo_url"))
        if pid and pid in seen_post:
            continue
        cap = post.get("caption") or post.get("text") or ""
        ck = caption_key(cap)
        if ck in seen_cap:
            continue
        if pid:
            seen_post.add(pid)
        seen_cap.add(ck)
        merged.append(post)
    return merged


def save_images(posts: list[dict]) -> list[dict]:
    fb_items: list[dict] = []
    for post in posts:
        if len(fb_items) >= MAX_IMAGES:
            break
        local = OUT_DIR / f"{len(fb_items) + 1:02d}.jpg"
        size = download(post["image_url"], local)
        if not size:
            continue
        hi = " HD" if size >= MIN_HI_RES_BYTES else ""
        path = str(local.relative_to(ROOT)).replace("\\", "/")
        caption = caption_or_fallback(post, len(fb_items) + 1)
        log(f"[{len(fb_items)+1:02d}] {path} ({size//1024} KB{hi}) score={post.get('score',0)} [{post.get('topic')}]")
        log(f"      {caption[:95]}...")
        fb_items.append({
            "date": "",
            "text": caption,
            "image": path,
            "topic": post.get("topic", topic_from_caption(post.get("text", ""))),
            "score": post.get("score", 0),
            "source": post.get("source", ""),
            "post_id": post.get("post_id", ""),
            "platform": "facebook",
        })
    return fb_items


def instagram_supplements(existing: list[dict]) -> list[dict]:
    """Add cross-posted IG field photos when FB scrape lacks a topic (RTL, Rogowski, etc.)."""
    if not FEED_JSON.exists():
        return []
    feed = json.loads(FEED_JSON.read_text(encoding="utf-8"))
    covered: dict[str, bool] = {}
    for item in existing:
        topic = item.get("topic", "")
        text = item.get("text", "")
        for tname, pattern in TOPIC_PRIORITY:
            if topic == tname and pattern.search(text):
                covered[tname] = True

    out: list[dict] = []
    seen_cap: set[str] = {caption_key(i.get("text", "")) for i in existing}
    for topic, pattern in TOPIC_PRIORITY:
        if covered.get(topic):
            continue
        for entry in feed.get("instagram", []):
            text = entry.get("text", "")
            image = entry.get("image", "")
            if not image or not text or MISSION_EXCLUDE.search(text):
                continue
            if not pattern.search(text):
                continue
            cap = figure_caption(text)
            ck = caption_key(cap)
            if ck in seen_cap:
                continue
            src = ROOT / image
            if not src.exists():
                continue
            seen_cap.add(ck)
            out.append({
                "date": entry.get("date", ""),
                "text": cap,
                "image": image,
                "topic": topic,
                "score": mission_score(text) + 4,
                "source": "instagram-feed",
                "platform": "instagram",
            })
            covered[topic] = True
            break
    return out


def write_mission_manifest(fb_items: list[dict]) -> int:
    combined = list(fb_items) + instagram_supplements(fb_items)
    manifest_items: list[dict] = []
    used_captions: set[str] = set()
    used_post: set[str] = set()

    # First pass: one slide per priority topic (RTL, Rogowski, …)
    for topic, pattern in TOPIC_PRIORITY:
        if len(manifest_items) >= MAX_MISSION_GALLERY:
            break
        for item in sorted(combined, key=lambda x: x.get("score", 0), reverse=True):
            text = item.get("text", "")
            if item.get("topic") != topic and not pattern.search(text):
                continue
            ck = caption_key(text)
            pid = item.get("post_id") or item.get("image", "")
            if ck in used_captions or pid in used_post:
                continue
            used_captions.add(ck)
            if pid:
                used_post.add(pid)
            platform = item.get("platform", "facebook")
            manifest_items.append({
                "source": item["image"],
                "id": slug_from_caption(text, len(manifest_items) + 1),
                "topic": topic,
                "platform": platform,
                "caption": text,
            })
            break

    # Second pass: fill remaining slots with other unique posts
    for item in sorted(combined, key=lambda x: x.get("score", 0), reverse=True):
        if len(manifest_items) >= MAX_MISSION_GALLERY:
            break
        text = item.get("text", "")
        ck = caption_key(text)
        pid = item.get("post_id") or item.get("image", "")
        if ck in used_captions or pid in used_post:
            continue
        used_captions.add(ck)
        if pid:
            used_post.add(pid)
        manifest_items.append({
            "source": item["image"],
            "id": slug_from_caption(text, len(manifest_items) + 1),
            "topic": item.get("topic") or topic_from_caption(text),
            "platform": item.get("platform", "facebook"),
            "caption": text,
        })

    if not manifest_items:
        return 0

    MANIFEST.write_text(
        json.dumps({"items": manifest_items}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    log(f"\nWrote {len(manifest_items)} mission manifest entries -> {MANIFEST}")
    return len(manifest_items)


def scrape_all(page) -> list[dict]:
    cdn_network: list[str] = []

    def on_response(resp) -> None:
        u = resp.url
        if is_valid_cdn_url(u) and re.search(r"\.(jpg|jpeg|webp|png)(\?|$)", u, re.I):
            cdn_network.append(u)

    page.on("response", on_response)

    all_photo_links: list[str] = []
    inline_posts: list[dict] = []

    for section_url in FB_CRAWL_URLS:
        links, posts = browse_section(page, section_url, cdn_network)
        all_photo_links.extend(links)
        inline_posts.extend(posts)

    all_photo_links = unique(all_photo_links)
    log(f"  total unique photo/post links: {len(all_photo_links)}")

    photo_posts = scrape_photo_pages(page, all_photo_links)
    log(f"  photo-page scrapes: {len(photo_posts)}")

    # Network-captured CDN URLs not yet tied to a post page.
    cdn_posts: list[dict] = []
    for i, src in enumerate(unique(cdn_network)):
        cdn_posts.append({
            "image_url": src,
            "text": "",
            "caption": "",
            "score": 1,
            "topic": "3D lightning mapping",
            "source": "network",
            "post_id": f"net-{hashlib.md5(src.encode()).hexdigest()[:10]}",
        })
    log(f"  network CDN URLs: {len(cdn_network)}")

    # Timeline pass (may overlap — merge dedupes).
    log("  loading timeline (final pass)…")
    page.goto(FB_PAGE, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(3500)
    dismiss_banners(page)
    heavy_scroll(page)
    articles = scrape_timeline_articles(page)
    log(f"    timeline articles: {len(articles)}")

    post_urls = unique(discover_post_urls(page) + all_photo_links)
    post_posts = scrape_post_pages(page, post_urls[:MAX_POST_VISITS])
    log(f"    post-page scrapes: {len(post_posts)}")

    merged = merge_all_photos(photo_posts, articles, post_posts, inline_posts, cdn_posts)
    return merged


def restore_feed_from_disk() -> list[dict]:
    """Fallback when live scrape fails — reuse existing fb/*.jpg with unique captions."""
    items: list[dict] = []
    for i, path in enumerate(sorted(OUT_DIR.glob("*.jpg"))):
        if path.stat().st_size < MIN_BYTES:
            continue
        topic, caption = FALLBACK_CAPTIONS[i % len(FALLBACK_CAPTIONS)]
        rel = str(path.relative_to(ROOT)).replace("\\", "/")
        items.append({
            "date": "",
            "text": caption,
            "image": rel,
            "topic": topic,
            "score": 1,
            "source": "disk",
        })
        if len(items) >= MAX_IMAGES:
            break
    return items


def main() -> None:
    existing = {"facebook": [], "instagram": []}
    if FEED_JSON.exists():
        existing = json.loads(FEED_JSON.read_text(encoding="utf-8"))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1400, "height": 960}, user_agent=UA, locale="en-US")
        page = context.new_page()
        try:
            log("Scraping RTL3D Facebook (all sections + photo pages)…")
            posts = scrape_all(page)
            log(f"  unique photos collected: {len(posts)}")
            fb_items = save_images(posts)
        finally:
            browser.close()

    if not fb_items:
        log("WARNING: live scrape empty — restoring from images/social/fb/*.jpg")
        fb_items = restore_feed_from_disk()

    if not fb_items:
        log("ERROR: no Facebook images available.")
        return

    feed = dict(existing)
    feed["facebook"] = [{"date": i["date"], "text": i["text"], "image": i["image"]} for i in fb_items]
    FEED_JSON.write_text(json.dumps(feed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    SCRAPE_LOG.write_text(json.dumps(fb_items, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    log(f"\nSaved {len(fb_items)} Facebook images -> {FEED_JSON}")
    write_mission_manifest(fb_items)


if __name__ == "__main__":
    main()
