# RTL3D Interactive Web — Performance Review

**Date:** 2026-06-17  
**Reviewer:** Automated audit (Lighthouse 13.4.0 + asset inventory)  
**Environment:** Local dev server (`py -3 -m http.server 8765`, no gzip/Brotli)  
**Target:** `http://127.0.0.1:8765/`  
**Production reference:** [lightninguniten.github.io/rtl3d-web](https://lightninguniten.github.io/rtl3d-web/) (GitHub Pages — gzip enabled)

---

## 1. Executive summary

| Tier | Pages | Lighthouse performance |
|------|-------|------------------------|
| Good | Home, Our Mission | 80–89 |
| Poor | TNB Power, DID & MET | 47–56 |
| Critical | LF Network | 28 |

The site is a **static, vanilla-JS multi-page app** with no bundler. Content pages perform well. **Map and visualization pages are bottlenecked by large JSON payloads and main-thread JavaScript**, not by HTML/CSS weight.

**Top three issues (by user impact):**

1. **LF page** — `lf-page.js` + Plotly render five charts on load (~19 s script evaluation, TTI ~27 s).
2. **DID & MET map** — ~15 MB water OSM JSON fetched eagerly on script load (core + detail + risk), despite detail layers being deferred for rendering.
3. **All pages** — render-blocking Google Fonts CSS; home loads 15 synchronous `<script>` tags with no `defer`.

**What already works well:**

- Split water bundle with `requestIdleCallback` for detail-layer rendering.
- `sessionStorage` fallback for live Overpass fetches on map pages.
- LF offline embed (`data/lf/lf-data.js`) avoids a second network round-trip.
- `preload` hints on DID-MET and public-safety map pages.
- `prefers-reduced-motion` respected in hub animations.
- High-speed video uses `preload="metadata"` (not full 30+ MB files).

---

## 2. Methodology

### Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Lighthouse CLI | 13.4.0 | Core Web Vitals, network waterfall, main-thread breakdown |
| PowerShell | — | Asset size inventory, JSON report parsing |

### Pages audited

Representative routes covering page archetypes:

| Archetype | URL | Scripts | Heavy data |
|-----------|-----|---------|------------|
| Home hub | `/` | 15 | Canvas RAF, featured roulette |
| Content | `/our-mission/` | 10 | Mission gallery JSON |
| TNB map | `/tnb-power/` | 14 | power-infrastructure.json (3.5 MB), flashes.json (985 KB) |
| Water map | `/did-met-alert/` | 15 | water layers (~15 MB total) |
| Plotly viz | `/lf/` | 12 + CDN Plotly | lf-data.js (849 KB), 5 Plotly charts |

### Reproduce

```bat
cd c:\Project\04_interactiveweb
start-server.bat

npx lighthouse http://127.0.0.1:8765/ --only-categories=performance --output=json --output-path=logs/performance/lighthouse-home.json
```

Raw Lighthouse JSON reports are stored alongside this file (`lighthouse-*.json`).

### Caveats

- **Local server has no compression.** GitHub Pages serves gzip; production transfer sizes will be ~60–75% smaller for JSON/text.
- Lighthouse uses **simulated mobile throttling** by default; absolute ms values are pessimistic vs. desktop LAN.
- Map pages fetch **live OSM raster tiles**; tile latency varies with network and is outside repo control.
- Scores are a **point-in-time snapshot**; re-run after changes.

---

## 3. Lighthouse results

### 3.1 Summary table

| Page | Score | FCP | LCP | TBT | CLS | Speed Index | TTI | Transfer | Requests |
|------|------:|----:|----:|----:|----:|------------:|----:|---------:|---------:|
| Home | **80** | 2.7 s | 4.5 s | 0 ms | 0.014 | 2.7 s | 4.5 s | 611 KB | 23 |
| Our Mission | **89** | 2.4 s | 3.2 s | 0 ms | 0.052 | 2.4 s | 3.2 s | 366 KB | 16 |
| TNB Power | **47** | 4.1 s | 29.4 s | 540 ms | 0.124 | 4.1 s | 29.4 s | 5.4 MB | 36 |
| DID & MET | **56** | 3.0 s | 90.9 s | 255 ms | 0.178 | 3.2 s | 90.9 s | 17.4 MB | 46 |
| LF Network | **28** | 6.9 s | 6.9 s | 7.4 s | 0.000 | 9.9 s | 27.5 s | 2.5 MB | 17 |

**Targets (Google “good” thresholds):** LCP ≤ 2.5 s · INP ≤ 200 ms · CLS ≤ 0.1

### 3.2 Network payload — heaviest resources

**TNB Power (`/tnb-power/`)**

| Size | Resource |
|------|----------|
| 3.5 MB | `data/osm/power-infrastructure.json` |
| 985 KB | `data/lf/flashes.json` |
| 190 KB | `css/style.css` |
| 144 KB | `js/leaflet.js` |
| 60 KB | `js/osm-sites-map.js` |
| ~30 KB each | OSM map tiles (×6+) |

**DID & MET (`/did-met-alert/`)**

| Size | Resource |
|------|----------|
| 5.6 MB | `data/osm/water-layers-detail.json` |
| 5.3 MB | `data/osm/water-layers-core.json` |
| 4.6 MB | `data/osm/water-risk-index.json` |
| 985 KB | `data/lf/flashes.json` |
| 190 KB | `css/style.css` |

**LF Network (`/lf/`)**

| Script time | Resource |
|-------------|----------|
| **18.5 s** | `js/lf-page.js` (Plotly chart creation) |
| 466 ms | `cdn.plot.ly/plotly-2.35.2.min.js` |
| 102 ms | `js/page-common.js` (canvas RAF loop) |
| 65 ms | `data/lf/lf-data.js` parse |

### 3.3 Main-thread breakdown (high impact)

| Page | Dominant cost | Notes |
|------|---------------|-------|
| LF | `scriptEvaluation` 19.1 s | Five `Plotly.newPlot` calls on first paint |
| TNB | `osm-sites-map.js` 996 ms scripting | GeoJSON → Leaflet layer build after JSON parse |
| DID-MET | `page-common.js` 539 ms + water JSON parse | Three JSON files parsed before map is interactive |
| Home | Render-blocking CSS font ~2 s (Lighthouse est.) | 15 blocking scripts, but small individual size |

---

## 4. Asset inventory

### 4.1 Repository totals (excl. `node_modules`)

| Type | Files | Total size |
|------|------:|-----------:|
| JSON (data) | 15 | **44.6 MB** |
| JavaScript | 36 | 1.4 MB |
| HTML | 38 | 270 KB |
| CSS | 3 | 206 KB |

### 4.2 Largest files (top 10)

| Size | Path |
|------|------|
| 33.5 MB | `videos/highspeedvideos/…cloudactivity.mp4` |
| 24.7 MB | `data/osm/water-infrastructure.json` (legacy monolith) |
| 16.9 MB | `videos/highspeedvideos/…NCGDL.mp4` |
| 11.2 MB | `videos/highspeedvideos/…NCGDL.mp4` |
| 6.7 MB | `bgmusic.mp3` |
| 5.6 MB | `data/osm/water-layers-detail.json` |
| 5.3 MB | `data/osm/water-layers-core.json` |
| 4.6 MB | `data/osm/water-risk-index.json` |
| 3.6 MB | `data/osm/power-infrastructure.json` |
| 849 KB | `data/lf/lf-data.js` |

### 4.3 Largest JavaScript modules

| Size | File | Loaded on |
|------|------|-----------|
| 144 KB | `leaflet.js` | All map pages |
| 71 KB | `gsap.min.js` | Quiz / video pages only |
| 60 KB | `osm-sites-map.js` | Map pages |
| 38 KB | `osm-water-layers.js` | Water map pages |
| 31 KB | `lightning-map-layer.js` | Lightning map pages |
| 28 KB | `lf-page.js` | LF page (high CPU, not size) |

### 4.4 Stylesheet

- `css/style.css` — **190 KB** unminified, single file for entire site.
- Lighthouse flags ~147 KB unused CSS rules on home (expected for monolithic sheet).

---

## 5. Runtime behaviour audit

### 5.1 Continuous work (every page)

`js/page-common.js` runs a **`requestAnimationFrame` lightning canvas loop** on all pages that include `#lightning-canvas`. Cost is modest per frame but never pauses when the tab is visible.

**Recommendation:** Pause RAF when `document.hidden` or when `prefers-reduced-motion: reduce`.

### 5.2 Home hub

| Feature | Cost |
|---------|------|
| 15 synchronous scripts | Parse blocking; no `defer`/`type=module` |
| `home-featured.js` | Continuous vertical glide RAF |
| `home-hub.js` | `setInterval` hook rotation (4.5 s) + mousemove 3D tilt |
| `home-idle-screensaver.js` | After 60 s idle, loads full `/video/` iframe |

### 5.3 Map pages

| Pattern | Assessment |
|---------|------------|
| `startWaterPrefetch()` at module load | Fetches core + detail + risk **immediately** when `osm-water-layers.js` parses — conflicts with deferred rendering intent |
| `buildLayerTier` + `nextFrame()` | Good — yields main thread between GeoJSON chunks |
| `sessionStorage` OSM cache | Good — avoids repeat Overpass on revisit |
| Live Overpass fallback | Risk on slow networks; local JSON preferred |

### 5.4 LF / VHF Plotly pages

- Plotly loaded from CDN with `defer` (good).
- `lf-page.js` also `defer` (good).
- **Problem:** All five 2D/3D plots built synchronously on first event selection / init — dominates TTI.

---

## 6. Findings by category

### P0 — Critical (fix before kiosk / mobile rollout)

| ID | Finding | Evidence | Suggested fix |
|----|---------|----------|---------------|
| P0-1 | LF page main-thread blocked ~19 s | Lighthouse bootup: `lf-page.js` 18.5 s scripting | Lazy-init plots (viewport / `IntersectionObserver`); render plan view first; defer 3D until user interaction |
| P0-2 | Water JSON ~15 MB eager fetch | `startWaterPrefetch()` fires detail+risk at parse time; HTML `preload` triples priority | Remove detail/risk from initial prefetch; fetch detail only in `loadDetail()`; drop redundant `<link rel=preload>` for detail |
| P0-3 | DID-MET LCP ~91 s | Dominated by JSON download + parse before map paint | Load core only for first paint; show map shell + stations before water layers |

### P1 — High (meaningful score gains)

| ID | Finding | Evidence | Suggested fix |
|----|---------|----------|---------------|
| P1-1 | Render-blocking Google Fonts | Lighthouse `render-blocking-insight` ~2 s on home | Self-host subset WOFF2; or `font-display: swap` + async load |
| P1-2 | 15 blocking scripts on home | `index.html` lines 122–136 | Add `defer` to all non-critical scripts; keep order |
| P1-3 | TNB power JSON 3.5 MB | Single fetch blocks map interactivity | Split by voltage tier or bbox tiles (mirror water split); or compress + stream parse |
| P1-4 | `flashes.json` 985 KB on every lightning map | Fetched per map page | Embed minimal event index in JS; lazy-load per-event source arrays |
| P1-5 | Monolithic 190 KB CSS | All rules on every page | Split map-specific rules; purge unused for content pages |

### P2 — Medium (polish / sustained performance)

| ID | Finding | Evidence | Suggested fix |
|----|---------|----------|---------------|
| P2-1 | Canvas RAF never pauses | `page-common.js` `drawBolts()` | `visibilitychange` pause |
| P2-2 | Leaflet 144 KB on all map routes | No tree-shaking | Acceptable; ensure not loaded on content pages (currently correct) |
| P2-3 | Mission gallery images ~207 KB each | `images/mission/*.jpg` | WebP/AVIF variants + `srcset` |
| P2-4 | No service worker / HTTP cache headers | `python -m http.server` | On GitHub Pages, set long-cache for hashed assets if build step added |
| P2-5 | Idle screensaver loads full video page | `home-idle-screensaver.js` | Preconnect to `/video/`; consider lightweight loop video instead of iframe |

### P3 — Low / informational

| ID | Finding | Notes |
|----|---------|-------|
| P3-1 | `water-infrastructure.json` 24.7 MB legacy file | Superseded by split bundles; confirm not referenced |
| P3-2 | `bgmusic.mp3` 6.7 MB | Only if used on video page — verify lazy load |
| P3-3 | `qrcode.min.js` 19.5 KB on every page | Defer until QR button clicked |
| P3-4 | Multiple PIDs on port 8765 | Dev environment only — restart clean server before benchmarks |

---

## 7. Page archetype budgets (recommended)

| Archetype | Target LCP | Max transfer (gzip est.) | Max JS exec |
|-----------|-----------|--------------------------|-------------|
| Content | < 2.5 s | < 400 KB | < 200 ms |
| Home hub | < 3.0 s | < 800 KB | < 300 ms |
| Map (power) | < 5.0 s | < 2 MB initial | < 1.5 s |
| Map (water) | < 5.0 s | < 1.5 MB initial | < 1.5 s |
| Plotly viz | < 4.0 s | < 1.5 MB | < 2 s (progressive) |

---

## 8. Recommended action plan

### Sprint 1 — Quick wins (1–2 days)

1. Add `defer` to all bottom-of-body scripts site-wide (preserve order).
2. Change `startWaterPrefetch()` to fetch **core only**; move detail/risk fetch into deferred paths.
3. Remove `<link rel="preload">` for `water-layers-detail.json` on DID-MET (keep core + risk if needed for warnings).
4. Pause lightning canvas when `document.hidden`.

### Sprint 2 — Map data (3–5 days)

1. Split `power-infrastructure.json` into core (transmission) + detail (distribution), matching water pattern.
2. Lazy-load flash source arrays per selected event.
3. Self-host DM Sans WOFF2 subset (~30 KB vs. CSS + font round-trips).

### Sprint 3 — LF / Plotly (3–5 days)

1. Render plan + time plots first; 3D on button click.
2. Use `Plotly.react` for updates instead of full `newPlot` where possible.
3. Consider vendoring a minimal Plotly bundle (scatter3d + scatter only).

### Sprint 4 — Tooling (ongoing)

1. Add `scripts/perf-audit.bat` wrapping Lighthouse on key routes.
2. Track scores in this folder (`PERFORMANCE-REVIEW-YYYY-MM-DD.md`).
3. Optional: run `build-web-assets.bat` for CSS minify (`css/style.min.css`); optional `--gzip-json` for data caches (not used by fetch yet).

---

## 9. Positive patterns (keep)

- Vanilla IIFE modules — no bundler complexity; easy to reason about load order.
- Generated data caches (`build_osm_*_data.py`) — avoids runtime Overpass dependency.
- Chunked GeoJSON → Leaflet layer construction with frame yields.
- `prefers-reduced-motion` in hub and featured carousel.
- Clean URL structure with `<base href>` — no path bugs on nested pages.
- LF offline `lf-data.js` embed for exhibition/kiosk without network.

---

## 10. Files generated by this audit

```
logs/performance/
├── PERFORMANCE-REVIEW-2026-06-17.md   ← this report
├── lighthouse-home.json
├── lighthouse-our-mission.json
├── lighthouse-tnb-power.json
├── lighthouse-did-met-alert.json
└── lighthouse-lf.json
```

---

## 11. Changelog

| Date | Action |
|------|--------|
| 2026-06-17 | Initial baseline audit — 5 routes, Lighthouse 13.4.0, local server |
| 2026-06-17 | **Sprint 1 complete** — `defer` on all scripts; water prefetch core-only; DID-MET detail preload removed; canvas pauses on `document.hidden` |
| 2026-06-17 | **Sprint 2 complete** — split power OSM bundles (core/detail); lazy flash index + per-event sources; self-hosted DM Sans (`css/dm-sans.css`, `fonts/`) |
| 2026-06-17 | **Sprint 3 complete** — LF page progressive rendering: plan+time first, cross-sections deferred to idle, 3D Plotly scene created only on Play (`js/lf-page.js`). Lighthouse `/lf/` perf: **28 → 65** (LCP **6.9 s → 2.7 s**) |
| 2026-06-17 | **Sprint 3.1 + 4 polish** — cross-section plots load on viewport (`IntersectionObserver`); same pattern on VHF; water risk JSON deferred (no preload); fixed self-hosted font `<link>` markup; `scripts/parse_perf_metrics.py` + `perf-audit.bat` now writes `metrics-summary.json`. LF score **70**, TBT **~1.0 s** (was ~1.8 s) |
| 2026-06-18 | **Sprint 5 (optional follow-ups)** — lazy `qrcode.min.js` via `js/qrcode-loader.js` (removed from all pages); self-hosted Plotly (`js/vendor/`) with `js/plotly-loader.js` (cartesian ~1.3 MB for 2D, full ~4.4 MB on 3D Play); CSS minify `build-web-assets.bat` → `css/style.min.css` (~192 KB → ~150 KB); all pages link `style.min.css` |
