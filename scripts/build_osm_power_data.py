"""Download OSM power infrastructure from Overpass and save for offline/fast map load.

Usage (from repo or 04_interactiveweb):
  py -3 scripts/build_osm_power_data.py

Output:
  data/osm/power-infrastructure.json

The TNB map loads this file first; if missing, it falls back to live Overpass API.
Re-run periodically to refresh OSM data (e.g. monthly or after grid edits).
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

# Must match js/osm-sites-map.js POWER_BBOX and cache version
POWER_BBOX = {"s": 2.0, "w": 101.3, "n": 3.5, "e": 102.65}
CACHE_VERSION = 6

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

# All nodes, ways, and relations tagged power=* in the study bbox
POWER_OVERPASS_SELECTOR = 'nwr["power"]'


def build_query(bbox: dict) -> str:
    b = f"{bbox['s']},{bbox['w']},{bbox['n']},{bbox['e']}"
    return f"[out:json][timeout:180];{POWER_OVERPASS_SELECTOR}({b});out geom;"


def fetch_overpass(query: str) -> dict:
    body = urllib.parse.urlencode({"data": query}).encode("utf-8")
    headers = {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Accept": "application/json",
        "User-Agent": "RTL3D-web/1.0 (power infrastructure cache builder)",
    }
    last_err = None
    for url in OVERPASS_ENDPOINTS:
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=240) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            if "elements" not in payload:
                raise ValueError("Overpass response missing elements")
            return payload
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError) as err:
            last_err = err
            print(f"  Overpass failed ({url}): {err}", file=sys.stderr)
    raise RuntimeError(f"All Overpass endpoints failed: {last_err}")


def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    web_root = os.path.dirname(script_dir)
    out_dir = os.path.join(web_root, "data", "osm")
    out_path = os.path.join(out_dir, "power-infrastructure.json")

    os.makedirs(out_dir, exist_ok=True)

    print(f"Query bbox: S={POWER_BBOX['s']} W={POWER_BBOX['w']} N={POWER_BBOX['n']} E={POWER_BBOX['e']}")
    print("Fetching from Overpass (may take 1–2 minutes)…")
    query = build_query(POWER_BBOX)
    overpass = fetch_overpass(query)
    elements = overpass.get("elements", [])

    payload = {
        "meta": {
            "cacheVersion": CACHE_VERSION,
            "bbox": POWER_BBOX,
            "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "elementCount": len(elements),
            "source": "OpenStreetMap via Overpass API",
        },
        "elements": elements,
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)

    size_mb = os.path.getsize(out_path) / (1024 * 1024)
    print(f"Wrote {len(elements)} elements to {out_path} ({size_mb:.2f} MB)")
    print("Restart or refresh the TNB map — it will load this file instead of Overpass.")


if __name__ == "__main__":
    main()
