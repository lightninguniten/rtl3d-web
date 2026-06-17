"""Download OSM power infrastructure from Overpass and save for offline/fast map load.

Usage (from repo or 04_interactiveweb):
  py -3 scripts/build_osm_power_data.py

Output:
  data/osm/power-infrastructure.json          (full bundle — legacy fallback)
  data/osm/power-infrastructure-core.json     (transmission + key substations — fast first paint)
  data/osm/power-infrastructure-detail.json   (distribution lines, towers — background load)

The TNB map loads core first; detail merges on idle. If split files are missing, falls back
to the monolith or live Overpass API.
Re-run periodically to refresh OSM data (e.g. monthly or after grid edits).
"""
from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

# Must match js/osm-sites-map.js POWER_BBOX and cache version
POWER_BBOX = {"s": 2.0, "w": 101.3, "n": 3.5, "e": 102.65}
CACHE_VERSION = 7

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

POWER_OVERPASS_SELECTOR = 'nwr["power"]'

LINE_POWER = frozenset({"line", "cable", "minor_line", "small_line"})
TX_MIN_VOLTAGE = 132_000
LV_VOLTAGE_VALUES = frozenset({230, 240, 380, 400, 415, 440, 480, 600, 690})
CORE_INFRA_POWER = frozenset({"substation", "plant", "transformer", "converter"})
GENERATOR_POWER = frozenset({"generator", "inverter", "solar_photovoltaic_panel"})


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


def normalize_voltage_volts(raw: float | int | None) -> int | None:
    if raw is None:
        return None
    n = int(round(float(raw)))
    if n >= 1000:
        return n
    if n in LV_VOLTAGE_VALUES:
        return n
    if 6 <= n <= 999:
        return n * 1000
    if n < 6:
        return n * 1000
    return n


def parse_max_voltage(voltage_str: str | None) -> int | None:
    if voltage_str is None or voltage_str == "":
        return None
    values: list[int] = []
    for part in re.split(r"[/;|,\s]+", str(voltage_str)):
        for num in re.findall(r"\d+(?:\.\d+)?", part):
            v = normalize_voltage_volts(float(num))
            if v is not None:
                values.append(v)
    return max(values) if values else None


def is_core_element(el: dict) -> bool:
    tags = el.get("tags") or {}
    power = tags.get("power", "line")

    if power in CORE_INFRA_POWER or power in GENERATOR_POWER:
        return True
    if el.get("type") == "relation" and power in ("substation", "plant"):
        return True

    if power in LINE_POWER:
        max_v = parse_max_voltage(tags.get("voltage"))
        if max_v is not None and max_v >= TX_MIN_VOLTAGE:
            return True
        return False

    return False


def split_elements(elements: list[dict]) -> tuple[list[dict], list[dict]]:
    core: list[dict] = []
    detail: list[dict] = []
    for el in elements:
        (core if is_core_element(el) else detail).append(el)
    return core, detail


def bundle_meta(generated_at: str, total: int, count: int, bundle: str) -> dict:
    return {
        "cacheVersion": CACHE_VERSION,
        "bbox": POWER_BBOX,
        "generatedAt": generated_at,
        "elementCount": count,
        "totalElementCount": total,
        "bundle": bundle,
        "source": "OpenStreetMap via Overpass API",
    }


def write_json(path: str, payload: dict) -> float:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    return os.path.getsize(path) / (1024 * 1024)


def write_bundles(out_dir: str, elements: list[dict], generated_at: str) -> None:
    core_elements, detail_elements = split_elements(elements)
    full_path = os.path.join(out_dir, "power-infrastructure.json")
    core_path = os.path.join(out_dir, "power-infrastructure-core.json")
    detail_path = os.path.join(out_dir, "power-infrastructure-detail.json")

    full_mb = write_json(
        full_path,
        {
            "meta": bundle_meta(generated_at, len(elements), len(elements), "full"),
            "elements": elements,
        },
    )
    core_mb = write_json(
        core_path,
        {
            "meta": bundle_meta(generated_at, len(elements), len(core_elements), "core"),
            "elements": core_elements,
        },
    )
    detail_mb = write_json(
        detail_path,
        {
            "meta": bundle_meta(generated_at, len(elements), len(detail_elements), "detail"),
            "elements": detail_elements,
        },
    )

    print(f"Wrote {len(elements)} elements to {full_path} ({full_mb:.2f} MB)")
    print(f"Wrote {len(core_elements)} core elements -> {core_path} ({core_mb:.2f} MB)")
    print(f"Wrote {len(detail_elements)} detail elements -> {detail_path} ({detail_mb:.2f} MB)")


def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    web_root = os.path.dirname(script_dir)
    out_dir = os.path.join(web_root, "data", "osm")
    os.makedirs(out_dir, exist_ok=True)

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    monolith_path = os.path.join(out_dir, "power-infrastructure.json")
    if len(sys.argv) > 1 and sys.argv[1] == "--split-only":
        if not os.path.isfile(monolith_path):
            print(f"No monolith at {monolith_path}", file=sys.stderr)
            sys.exit(1)
        with open(monolith_path, encoding="utf-8") as f:
            data = json.load(f)
        elements = data.get("elements", [])
        print(f"Splitting {len(elements)} elements from existing monolith…")
        write_bundles(out_dir, elements, data.get("meta", {}).get("generatedAt", generated_at))
        return

    print(f"Query bbox: S={POWER_BBOX['s']} W={POWER_BBOX['w']} N={POWER_BBOX['n']} E={POWER_BBOX['e']}")
    print("Fetching from Overpass (may take 1–2 minutes)…")
    query = build_query(POWER_BBOX)
    overpass = fetch_overpass(query)
    elements = overpass.get("elements", [])
    write_bundles(out_dir, elements, generated_at)
    print("Restart or refresh the TNB map — core loads first, detail on idle.")


if __name__ == "__main__":
    main()
