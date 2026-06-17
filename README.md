# RTL3D Interactive Web

Static web front-end for **Real-Time Lightning 3D Imaging & Forecasting** (SATREPS Malaysia–Japan).  
Includes LF observation maps, TNB grid risk views, DID & MET water alerting, and public-safety radar views.

## Live demo

https://lightninguniten.github.io/rtl3d-web/

## Run locally

```bat
start-server.bat
```

Open `http://127.0.0.1:8765/` (do not open HTML files directly with `file://` — JSON fetch will fail).

Use clean paths in the browser, e.g. `http://127.0.0.1:8765/tnb-power/` (trailing slash).

## Rebuild cached map data

```bat
build-osm-data.bat
build-osm-water-data.bat
py -3 scripts\build_lf_data.py
py -3 scripts\check_water_cache.py
```

## Acknowledgements

This research work is supported by **SATREPS Real-Time Lightning 3D Imaging and Forecasting Project for Sustainable and Reliable Supply of Energy and Storm Disaster Early Warning** (20230901JICA, 20230902JICA, 20230903JICA, 20230904JICA, 20230905JICA), a collaboration between Japan Science and Technology Agency (**JST**, JPMJSA2210), Japan International Cooperation Agency (**JICA**), and the Ministry of Higher Education (**MOHE**) of Malaysia.

**Lightning lesson music:** “Cinematic Trailer” by Hans Williamson (Music for Video Library, YouTube). See [CREDITS.md](CREDITS.md) for full attribution and usage notes.

## License

[MIT License](LICENSE) — see file for third-party data notices (OpenStreetMap, Leaflet, etc.).

## Project structure

| Path | Purpose |
|------|---------|
| `index.html` | Home hub |
| `{slug}/index.html` | Canonical pages (clean URLs) |
| `{slug}.html` | Legacy redirect stubs only |
| `data/lf/` | Lightning flash and site JSON |
| `data/osm/` | Cached OpenStreetMap power & water layers |
| `js/` | Map layers, lightning UI, navigation |
| `scripts/` | Python builders for offline JSON caches |
| `scripts/build_pages.py` | Archived HTML templates — do not run |

See `AGENTS.md` for the full page list and module index.
