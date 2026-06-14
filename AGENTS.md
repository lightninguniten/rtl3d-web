# RTL3D Interactive Web — Workspace Index

Static multi-page site for **Real-Time Lightning 3D Imaging & Forecasting** (SATREPS Malaysia–Japan).  
Serve from this folder only (`file://` breaks fetch for JSON data).

## Run locally

```bat
start-server.bat
```

→ `http://127.0.0.1:8765/`

## Site map (pages)

| Page | File | `data-page` | Notes |
|------|------|-------------|--------|
| Home hub | `index.html` | `home` | Section nav from `RTL3D_PAGES` |
| Our Mission | `our-mission.html` | `mission` | |
| Research Framework | `research-framework.html` | `framework` | |
| Observation Network | `observation-network.html` | `network` | |
| LF Network | `lf.html` | `lf` | Plotly 3D/2D, `lf-page.js` |
| 3D Charge Imaging | `charge-imaging.html` | `imaging` | |
| Social Impact | `social-impact.html` | `impact` | Links to TNB |
| **TNB Power** | `tnb-power.html` | `tnb` | Leaflet map, lightning, OSM grid |
| Study Area Map | `study-area.html` | `study-area` | Leaflet, observation sites |
| Partners | `partners.html` | `partners` | |
| Contact | `contact.html` | `contact` | |

Page registry: `js/site-pages.js` (`RTL3D_PAGES`, `RTL3D_EXTRA`).

## JavaScript modules

| File | Role |
|------|------|
| `js/site-pages.js` | Page list / navigation metadata |
| `js/page-common.js` | Shared page behaviour, back button |
| `js/viewport.js` | 19:6 viewport scaling, resize events |
| `js/home-nav.js` | Home hub section cards |
| `js/drag-scroll.js` | Click-drag scroll (`data-drag-scroll`, `window.initDragScroll`) |
| `js/osm-sites-map.js` | Leaflet map, OSM power lines + infrastructure, layer control |
| `js/lightning-map-layer.js` | LF flash scatter, radiation zones, grid risk warnings |
| `js/lf-page.js` | LF modal: Plotly plots, sensor table, animation |
| `js/facebook-qr.js` | Facebook QR overlay |

## Data files

| Path | Source | Purpose |
|------|--------|---------|
| `data/lf/flashes.json` | `scripts/build_lf_data.py` | Lightning source x,y,z,t per flash event |
| `data/lf/sites.json` | same | LF observation network sites |
| `data/lf/lf-data.js` | same | `window.LF_DATA` embed for offline |
| `data/osm/power-infrastructure.json` | `scripts/build_osm_power_data.py` | Cached Overpass power features (~14k elements) |

**Rebuild data:**

```bat
py -3 scripts\build_lf_data.py
build-osm-data.bat
```

## TNB map (`tnb-power.html`) — key behaviour

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

Single stylesheet: `css/style.css`. TNB split layout: `.tnb-page-split`, toolbar `.tnb-lightning-toolbar`, sidebar `.tnb-page-sidebar`.

## Conventions for edits

- Vanilla JS IIFEs, no bundler. Keep script order in HTML as declared.
- Do not commit secrets. Large JSON caches are generated, not hand-edited.
- Map popups: click only (no hover labels). Infrastructure popups include coordinates.
- Prefer extending existing modules over new frameworks.
- **No outbound hyperlinks** in page body content (papers, vendors, external sites). Citations as plain text only; keep explanations on-page. See `.cursor/rules/interactive-web-no-outbound-links.mdc`.
- Run `start-server.bat` to test fetch-based features.

## Related project paths

- LF `.dat` results: `03_Research/06_Journal/Journal1/data/results/...`
- Production LF code: `01_Code/bandTOACal_20260226_prod.py`
