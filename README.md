# RTL3D Interactive Web

Static web front-end for **Real-Time Lightning 3D Imaging & Forecasting** (SATREPS Malaysia–Japan).  
Includes LF observation maps, TNB grid risk views, and DID & MET water-infrastructure alerting.

## Live demo

https://lightninguniten.github.io/rtl3d-web/

## Run locally

```bat
start-server.bat
```

Open `http://127.0.0.1:8765/` (do not open HTML files directly with `file://` — JSON fetch will fail).

## Rebuild cached map data

```bat
build-osm-data.bat
build-osm-water-data.bat
py -3 scripts\build_lf_data.py
py -3 scripts\check_water_cache.py
```

## Acknowledgements

This research work is supported by **SATREPS Real-Time Lightning 3D Imaging and Forecasting Project for Sustainable and Reliable Supply of Energy and Storm Disaster Early Warning** (20230901JICA, 20230902JICA, 20230903JICA, 20230904JICA, 20230905JICA), a collaboration between Japan Science and Technology Agency (**JST**, JPMJSA2210), Japan International Cooperation Agency (**JICA**), and the Ministry of Higher Education (**MOHE**) of Malaysia.

## License

[MIT License](LICENSE) — see file for third-party data notices (OpenStreetMap, Leaflet, etc.).

## Project structure

| Path | Purpose |
|------|---------|
| `index.html` | Home hub |
| `tnb-power.html` | TNB grid + lightning map |
| `did-met-alert.html` | DID & MET water + lightning map |
| `data/lf/` | Lightning flash and site JSON |
| `data/osm/` | Cached OpenStreetMap power & water layers |
| `js/` | Map layers, lightning UI, navigation |
| `scripts/` | Python builders for offline JSON caches |
