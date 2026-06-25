# RTL3D Interactive Web — Workspace Index

Static multi-page site for **Real-Time Lightning 3D Imaging & Forecasting** (SATREPS Malaysia–Japan).  
Serve from this folder only (`file://` breaks fetch for JSON data).

## Run locally

```bat
start-server.bat
```

→ `http://127.0.0.1:8765/`

## URL layout

- **Home:** `/` → `index.html`
- **Pages:** `/{slug}/` → `{slug}/index.html` (clean URLs, no `.html` in the address bar)
- **Legacy:** root `{slug}.html` files are thin redirect stubs only (bookmarks / old links)

Page registry and nav URLs: `js/site-pages.js` + `js/site-urls.js`.

## Site map

| Page | Path | `data-page` | Notes |
|------|------|-------------|--------|
| Home hub | `/` | `home` | Section nav from `RTL3D_PAGES` |
| Our Mission | `our-mission/` | `mission` | |
| Research Framework | `research-framework/` | `framework` | |
| Observation Network | `observation-network/` | `network` | |
| LF Network | `lf/` | `lf` | Plotly 3D/2D, `lf-page.js` |
| Electric Field | `electric-field/` | `efield` | Observation detail |
| Gamma-ray & Radon | `gamma-radon/` | `gamma` | Observation detail |
| 3D Charge Imaging | `charge-imaging/` | `imaging` | |
| Social Impact | `social-impact/` | `impact` | Links to map pages |
| TNB Power | `tnb-power/` | `tnb` | Leaflet, lightning, OSM grid |
| DID & MET | `did-met-alert/` | `did-met` | Water + lightning map |
| Public Safety | `public-safety/` | `public-safety` | Aviation & maritime |
| Industry & Tourism | `public-safety-industry/` | `public-safety-industry` | Radar view |
| Study Area Map | `study-area/` | `study-area` | Leaflet, observation sites |
| Partners | `partners/` | `partners` | |
| Contact | `contact/` | `contact` | |

## JavaScript modules

| File | Role |
|------|------|
| `js/site-urls.js` | Resolve clean page URLs from any depth |
| `js/site-pages.js` | Page list / navigation metadata |
| `js/page-common.js` | Shared page behaviour, back button, lightning bg |
| `js/page-visits.js` | Visit tracking / home hub highlights |
| `js/viewport.js` | 16:9 viewport scaling, resize events |
| `js/drag-scroll.js` | Click-drag scroll |
| `js/home-nav.js` | Home hub section cards |
| `js/home-featured.js` | Home interactive preview roulette |
| `js/home-hub.js` | Home hub cinema / motion |
| `js/partner-logo-qr.js` | Partner logo QR overlays |
| `js/osm-sites-map.js` | Leaflet map, OSM power lines + infrastructure |
| `js/lightning-map-layer.js` | LF flash scatter, radiation zones, grid risk |
| `js/osm-water-layers.js` | DID/MET water layers |
| `js/osm-aviation-layers.js` | Aviation infrastructure |
| `js/lightning-radar-layer.js` | Industry radar layer |
| `js/map-fullscreen.js` | Leaflet fullscreen helper |
| `js/lf-page.js` | LF modal: Plotly plots, sensor table |
| `js/efield-page.js` | Electric field guide carousel |
| `js/gamma-radon-page.js` | Gamma/radon guide carousel |
| `js/facebook-qr.js` | Facebook QR overlay |
| `js/qrcode-loader.js` | Lazy-load `qrcode.min.js` on first QR open |
| `js/plotly-loader.js` | Lazy-load self-hosted Plotly (LF/VHF) |

## Data files

| Path | Source | Purpose |
|------|--------|---------|
| `data/lf/flashes.json` | `scripts/build_lf_data.py` | Lightning source x,y,z,t per flash event |
| `data/lf/sites.json` | same | LF observation network sites |
| `data/lf/lf-data.js` | same | `window.LF_DATA` embed for offline |
| `data/osm/power-infrastructure.json` | `scripts/build_osm_power_data.py` | Cached Overpass power features |
| `data/osm/water-layers-core.json` | `scripts/build_osm_water_data.py` | Water layers (fast load) |
| `data/osm/water-layers-detail.json` | same | Water detail layers |
| `data/osm/water-risk-index.json` | same | Water risk targets |

**Rebuild data:**

```bat
py -3 scripts\build_lf_data.py
build-osm-data.bat
build-osm-water-data.bat
```

## TNB map (`tnb-power/`) — key behaviour

- Map element: `#tnb-map` with `data-osm-sites-map data-power-lines="true" data-lightning-map="true"`.
- **Lightning**: Jet-coloured scatter by time; event selector in fixed toolbar (`#tnb-flash-select`).
- **Radiation centre**: centroid of sources with height $z \le 2\,\mathrm{km}$ (CG band).
- **Radiation zones**: $\le 5\,\mathrm{km}$ black, $5\text{–}10\,\mathrm{km}$ red, $10\text{–}15\,\mathrm{km}$ yellow.
- **Risk warnings**: all grid assets in 15 km zone (lines, towers with inferred kV, transformers, substations).
- **Layer z-order**: infrastructure/power lines on `powerInfra` pane above lightning scatter; radiation/risk overlays are click-through.
- **OSM load order**: local JSON → sessionStorage → live Overpass API.

## Coordinate conventions (LF / lightning)

Origin: MKPL ($2.726931°\mathrm{N}$, $102.24901°\mathrm{E}$).

$$\mathrm{lat} = \mathrm{lat}_0 + y_{\mathrm{km}}/111.32,\quad
\mathrm{lon} = \mathrm{lon}_0 + x_{\mathrm{km}}/(111.32\cos\mathrm{lat}_0)$$

## CSS

Source of truth is the ordered partials in `css/parts/` (`01-tokens-base.css` …
`16-overrides.css`); they are concatenated in filename order. Edit the relevant
partial, then run `build-web-assets.bat` to regenerate both the `css/style.css`
bundle and the minified `css/style.min.css` (linked by all pages). Do not hand-edit
`css/style.css` — it is a generated bundle. Partials concatenate in cascade order,
so keep order-dependent overrides in the later-numbered files. TNB split layout:
`.tnb-page-split`, toolbar `.tnb-lightning-toolbar`, sidebar `.tnb-page-sidebar`.

Cache-busting is automatic: `build-web-assets.bat` stamps every page's
`css/style.min.css?v=<hash>` with a content hash of the minified CSS, so the token
changes only when the CSS does. Do not hand-edit the `?v=` strings.

## Shared page &lt;head&gt;

The invariant head tags for every `{slug}/index.html` (charset, viewport, robots,
Open Graph / Twitter scaffold, canonical domain, favicon wrapper, stylesheet links)
are owned by a single template in `scripts/build_head.py`. Edit that template and
run `py -3 scripts/build_head.py` to propagate to all 20 sub-pages. Per-page values
(title, description, favicon glyph, og/twitter copy, and page-specific extras such
as Leaflet links, preloads, inline `<style>`, and scripts) live in each page and are
preserved across regeneration. The home page `index.html` is hand-maintained (it has
unique SEO tags: sitemap, og:image, site verification).

## Linting & formatting

Dev-only tooling (no bundler, no runtime impact). One-time `npm install`, then:

```bash
npm run lint      # eslint (js/) + stylelint (css/parts/)
npm run format    # prettier --write
npm run fix       # format + eslint --fix + stylelint --fix
```

Configs: `eslint.config.js`, `.stylelintrc.json`, `.prettierrc.json`, `.editorconfig`.
Vendored libraries (`js/vendor/`, Leaflet, GSAP, qrcode) and generated bundles
(`css/style.css`, `css/style.min.css`) are ignored. Rules are intentionally light so
the existing code passes; warnings are advisory.

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` stages a clean `_site/` with
`rsync -a --exclude-from=.deployignore ./ _site/` and publishes only that, so the
public site never ships build tooling, dev artifacts, CSS source, configs, or
internal docs. To change what is public, edit `.deployignore` (rsync-style patterns;
`LICENSE` is intentionally kept). Anything a page actually fetches must NOT be listed
there.

## Conventions for edits

- Vanilla JS IIFEs, no bundler. Keep script order in HTML as declared.
- Do not commit secrets. Large JSON caches are generated, not hand-edited.
- Map popups: click only (no hover labels). Infrastructure popups include coordinates.
- Prefer extending existing modules over new frameworks.
- **No outbound hyperlinks** in page body content (papers, vendors, external sites). Citations as plain text only.
- Edit `{slug}/index.html` for page content — do not run `scripts/build_pages.py` (archived templates only).
- Run `start-server.bat` to test fetch-based features.

## Related project paths

- LF `.dat` results: `03_Research/06_Journal/Journal1/data/results/...`
- Production LF code: `01_Code/bandTOACal_20260226_prod.py`
