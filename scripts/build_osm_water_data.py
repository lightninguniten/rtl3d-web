"""Download OSM water infrastructure from Overpass and save for offline map load.

Usage:
  py -3 scripts/build_osm_water_data.py
  py -3 scripts/build_osm_water_data.py --from-cache

Output:
  data/osm/water-infrastructure.json   (raw Overpass archive)
  data/osm/water-layers-core.json        (dams, lakes, rivers — fast first paint)
  data/osm/water-layers-detail.json      (streams, canals, ponds — background load)
  data/osm/water-risk-index.json         (pre-built radiation alert targets)
"""
from __future__ import annotations

import json
import math
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

# Must match js/osm-water-layers.js WATER_BBOX and cache version
WATER_BBOX = {"s": 2.0, "w": 101.3, "n": 3.5, "e": 102.65}
CACHE_VERSION = 3
COORD_DP = 5

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

SELECTORS = [
    'way["waterway"]',
    'relation["waterway"]',
    'way["natural"="water"]',
    'relation["natural"="water"]',
    'node["natural"="water"]',
    'way["landuse"="reservoir"]',
    'relation["landuse"="reservoir"]',
    'way["water"]',
    'relation["water"]',
    'node["water"]',
    'way["man_made"="dam"]',
    'node["man_made"="dam"]',
    'node["waterway"="dam"]',
    'way["basin"]',
    'relation["basin"]',
]

WATER_LAYER_IDS = [
    "water-dam",
    "water-river",
    "water-stream",
    "water-canal",
    "water-lake",
    "water-reservoir",
    "water-pond",
    "water-basin",
    "water-body",
]

CORE_LAYER_IDS = [
    "water-dam",
    "water-reservoir",
    "water-lake",
    "water-river",
    "water-basin",
]

DETAIL_LAYER_IDS = [
    "water-stream",
    "water-canal",
    "water-pond",
    "water-body",
]

LAYER_KIND = {
    "water-dam": "point",
    "water-river": "line",
    "water-stream": "line",
    "water-canal": "line",
    "water-lake": "area",
    "water-reservoir": "area",
    "water-pond": "area",
    "water-basin": "area",
    "water-body": "area",
}

LAYER_SHORT = {
    "water-dam": "Dams",
    "water-river": "Rivers",
    "water-stream": "Streams",
    "water-canal": "Canals",
    "water-lake": "Lakes",
    "water-reservoir": "Reservoirs",
    "water-pond": "Ponds",
    "water-basin": "Basins",
    "water-body": "Water body",
}

LINE_WATERWAY = frozenset(
    {"river", "stream", "tributary", "canal", "drain", "ditch", "fairway"}
)

WATER_RISK_ANCHOR_IDS = [
    "water-dam",
    "water-reservoir",
    "water-lake",
    "water-pond",
    "water-basin",
]

WATER_RISK_STORAGE_IDS = [
    "water-dam",
    "water-reservoir",
    "water-lake",
    "water-pond",
    "water-basin",
    "water-body",
]

WATER_RISK_LINE_IDS = ["water-river", "water-stream", "water-canal"]

LINE_NEAR_STORAGE_KM = 3.0
STREAM_NEAR_STORAGE_KM = 2.0
DETAIL_LINE_MAX_PTS = 48
RISK_LINE_MAX_PTS = 20

WATER_RISK_EFFECT = {
    "control": "control & direct strike",
    "storage": "storage & storm inflow",
    "drainage": "drainage & retention",
    "flood": "flood routing",
}

POPUP_TAG_KEYS = (
    "name",
    "name:en",
    "name:ms",
    "ref",
    "waterway",
    "water",
    "natural",
    "man_made",
    "operator",
    "basin",
    "landuse",
    "intermittent",
    "seasonal",
    "destination",
    "network",
)


def build_query(bbox: dict) -> str:
    b = f"{bbox['s']},{bbox['w']},{bbox['n']},{bbox['e']}"
    body = "".join(f"{sel}({b});" for sel in SELECTORS)
    return f"[out:json][timeout:180];({body});out geom;"


def fetch_overpass(query: str) -> dict:
    body = urllib.parse.urlencode({"data": query}).encode("utf-8")
    headers = {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Accept": "application/json",
        "User-Agent": "RTL3D-web/1.0 (water infrastructure cache builder)",
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


def round_scalar(value: float) -> float:
    return round(float(value), COORD_DP)


def round_coords(coords: list[list[float]]) -> list[list[float]]:
    return [[round_scalar(pt[0]), round_scalar(pt[1])] for pt in coords]


def flatten_line_coords(coords) -> list[list[float]]:
    if not coords:
        return []
    if isinstance(coords[0], (int, float)):
        return [coords[:2]]
    if coords and isinstance(coords[0][0], (int, float)):
        return coords
    flat: list[list[float]] = []
    for part in coords:
        flat.extend(flatten_line_coords(part))
    return flat


def decimate_coords(coords: list[list[float]], max_pts: int) -> list[list[float]]:
    line = flatten_line_coords(coords)
    if len(line) <= max_pts:
        return round_coords(line)
    step = max(1, len(line) // max_pts)
    slim = line[::step]
    if slim[-1] != line[-1]:
        slim.append(line[-1])
    return round_coords(slim)


def round_geometry(geom: dict, layer_id: str) -> dict:
    gtype = geom.get("type")
    coords = geom.get("coordinates")
    if not coords:
        return geom
    if gtype == "Point":
        return {"type": "Point", "coordinates": round_coords([coords])[0]}
    if gtype == "LineString":
        if layer_id in ("water-stream", "water-canal"):
            return {"type": "LineString", "coordinates": decimate_coords(coords, DETAIL_LINE_MAX_PTS)}
        return {"type": "LineString", "coordinates": round_coords(coords)}
    if gtype == "Polygon":
        return {
            "type": "Polygon",
            "coordinates": [round_coords(ring) for ring in coords],
        }
    return geom


def classify_water_layer(tags: dict | None) -> str | None:
    if not tags:
        return None
    if tags.get("man_made") == "dam" or tags.get("waterway") == "dam":
        return "water-dam"
    if tags.get("landuse") == "reservoir" or tags.get("water") == "reservoir":
        return "water-reservoir"
    if tags.get("basin") in ("retention", "detention") or tags.get("water") == "basin":
        return "water-basin"

    ww = tags.get("waterway")
    if ww == "river":
        return "water-river"
    if ww in ("stream", "tributary"):
        return "water-stream"
    if ww in ("canal", "drain", "ditch"):
        return "water-canal"
    if ww in LINE_WATERWAY:
        return "water-stream"

    w = tags.get("water")
    if w == "lake":
        return "water-lake"
    if w in ("pond", "fishpond", "lagoon"):
        return "water-pond"
    if w == "reservoir":
        return "water-reservoir"
    if tags.get("natural") == "water" or w:
        if w == "river":
            return "water-river"
        return "water-body"
    if tags.get("landuse") == "reservoir":
        return "water-reservoir"
    return None


def is_closed_way(el: dict) -> bool:
    nodes = el.get("nodes") or []
    return len(nodes) >= 4 and nodes[0] == nodes[-1]


def way_is_area(el: dict, tags: dict) -> bool:
    if tags.get("area") == "yes":
        return True
    if tags.get("area") == "no":
        return False
    if tags.get("natural") == "water" or tags.get("landuse") == "reservoir" or tags.get("water"):
        return True
    if tags.get("waterway") == "dam" or tags.get("man_made") == "dam":
        return False
    if tags.get("waterway") in LINE_WATERWAY:
        return False
    return is_closed_way(el)


def close_ring(coords: list[list[float]]) -> list[list[float]]:
    if len(coords) < 3:
        return coords
    if coords[0] == coords[-1]:
        return coords
    return coords + [coords[0]]


def slim_tags(tags: dict, layer_id: str) -> dict:
    props = {"_layerId": layer_id}
    for key in POPUP_TAG_KEYS:
        if key in tags:
            props[key] = tags[key]
    return props


def format_tag_label(value: str) -> str:
    text = str(value or "").replace("_", " ")
    return " ".join(word.capitalize() for word in text.split())


def display_name(tags: dict) -> str | None:
    return (
        tags.get("name")
        or tags.get("name:en")
        or tags.get("name:ms")
        or tags.get("ref")
    )


def osm_water_by_layer(elements: list[dict]) -> dict[str, list[dict]]:
    layers: dict[str, list[dict]] = {layer_id: [] for layer_id in WATER_LAYER_IDS}

    for el in elements:
        tags = el.get("tags") or {}
        layer_id = classify_water_layer(tags)
        if not layer_id:
            continue

        kind = LAYER_KIND[layer_id]
        props = slim_tags(tags, layer_id)

        if el.get("type") == "node" and el.get("lat") is not None and el.get("lon") is not None:
            if kind == "line":
                continue
            geom = {"type": "Point", "coordinates": [el["lon"], el["lat"]]}
            layers[layer_id].append(
                {
                    "type": "Feature",
                    "properties": props,
                    "geometry": round_geometry(geom, layer_id),
                }
            )
            continue

        if el.get("type") == "way" and el.get("geometry") and len(el["geometry"]) >= 2:
            geom_pts = el["geometry"]
            if kind == "point" and layer_id == "water-dam":
                p = geom_pts[0]
                geom = {"type": "Point", "coordinates": [p["lon"], p["lat"]]}
                layers[layer_id].append(
                    {
                        "type": "Feature",
                        "properties": props,
                        "geometry": round_geometry(geom, layer_id),
                    }
                )
                continue
            if way_is_area(el, tags) and kind != "line":
                ring = close_ring([[p["lon"], p["lat"]] for p in geom_pts])
                if len(ring) >= 4:
                    geom = {"type": "Polygon", "coordinates": [ring]}
                    layers[layer_id].append(
                        {
                            "type": "Feature",
                            "properties": props,
                            "geometry": round_geometry(geom, layer_id),
                        }
                    )
                continue
            if kind == "line" or tags.get("waterway") or layer_id in (
                "water-river",
                "water-stream",
                "water-canal",
            ):
                line_id = classify_water_layer(tags)
                if not line_id or LAYER_KIND.get(line_id) != "line":
                    continue
                line_props = slim_tags(tags, line_id)
                geom = {
                    "type": "LineString",
                    "coordinates": [[p["lon"], p["lat"]] for p in geom_pts],
                }
                layers[line_id].append(
                    {
                        "type": "Feature",
                        "properties": line_props,
                        "geometry": round_geometry(geom, line_id),
                    }
                )
            continue

        if el.get("type") == "relation" and el.get("members"):
            for member in el.get("members") or []:
                if not member.get("geometry") or len(member["geometry"]) < 2:
                    continue
                role = member.get("role") or ""
                if role and role != "outer":
                    continue
                if kind == "area" or tags.get("natural") == "water" or tags.get("landuse") == "reservoir":
                    ring = close_ring([[p["lon"], p["lat"]] for p in member["geometry"]])
                    if len(ring) >= 4:
                        geom = {"type": "Polygon", "coordinates": [ring]}
                        layers[layer_id].append(
                            {
                                "type": "Feature",
                                "properties": props,
                                "geometry": round_geometry(geom, layer_id),
                            }
                        )

    return layers


def feature_centroid(feature: dict) -> dict | None:
    geom = feature.get("geometry") or {}
    gtype = geom.get("type")
    coords = geom.get("coordinates")
    if not coords:
        return None
    if gtype == "Point":
        return {"lat": coords[1], "lng": coords[0]}
    if gtype == "LineString":
        mid = coords[len(coords) // 2]
        return {"lat": mid[1], "lng": mid[0]}
    if gtype == "Polygon":
        ring = coords[0]
        n = max(len(ring) - 1, 1)
        lng_sum = sum(pt[0] for pt in ring[:n])
        lat_sum = sum(pt[1] for pt in ring[:n])
        return {"lat": lat_sum / n, "lng": lng_sum / n}
    return None


def distance_km(a: dict, b: dict) -> float:
    earth_r = 6371.0
    d_lat = math.radians(b["lat"] - a["lat"])
    d_lon = math.radians(b["lng"] - a["lng"])
    lat1 = math.radians(a["lat"])
    lat2 = math.radians(b["lat"])
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    )
    return 2 * earth_r * math.asin(min(1.0, math.sqrt(h)))


def closest_point_on_segment(center: dict, a: dict, b: dict) -> dict:
    cos_lat = math.cos(math.radians(center["lat"]))
    ax, ay = a["lng"] * cos_lat, a["lat"]
    bx, by = b["lng"] * cos_lat, b["lat"]
    px, py = center["lng"] * cos_lat, center["lat"]
    dx, dy = bx - ax, by - ay
    len2 = dx * dx + dy * dy
    t = 0.0 if len2 == 0 else ((px - ax) * dx + (py - ay) * dy) / len2
    t = max(0.0, min(1.0, t))
    lat = ay + t * dy
    lng = center["lng"] if cos_lat == 0 else (ax + t * dx) / cos_lat
    point = {"lat": lat, "lng": lng}
    point["distanceKm"] = distance_km(center, point)
    return point


def distance_point_to_line_coords(point: dict, coords: list[list[float]]) -> float:
    if not coords or len(coords) < 2:
        return float("inf")
    best = float("inf")
    for i in range(len(coords) - 1):
        a = {"lat": coords[i][1], "lng": coords[i][0]}
        b = {"lat": coords[i + 1][1], "lng": coords[i + 1][0]}
        hit = closest_point_on_segment(point, a, b)
        if hit["distanceKm"] < best:
            best = hit["distanceKm"]
    return best


def storage_risk_effect(layer_id: str) -> str:
    if layer_id == "water-dam":
        return "control"
    if layer_id in ("water-basin", "water-pond"):
        return "drainage"
    return "storage"


def type_label_with_effect(short_label: str, effect_key: str) -> str:
    effect = WATER_RISK_EFFECT.get(effect_key)
    return f"{short_label} · {effect}" if effect else short_label


def line_display_name(props: dict, short_label: str) -> str:
    return display_name(props) or f"{short_label} reach"


def line_water_risk_meta(layer_id: str, props: dict, coords: list[list[float]], anchors: list[dict]):
    named = bool(display_name(props))
    ww = props.get("waterway") or ""

    if layer_id == "water-river":
        return {"effect": "flood"}
    if layer_id == "water-stream":
        if named:
            return {"effect": "flood"}
        if any(distance_point_to_line_coords(a, coords) <= STREAM_NEAR_STORAGE_KM for a in anchors):
            return {"effect": "flood"}
        return None
    if layer_id == "water-canal":
        if named or ww == "canal":
            return {"effect": "drainage"}
        if any(distance_point_to_line_coords(a, coords) <= LINE_NEAR_STORAGE_KM for a in anchors):
            return {"effect": "drainage"}
        return None
    return None


def build_water_risk_index(layers: dict[str, list[dict]]) -> list[dict]:
    anchors: list[dict] = []
    for layer_id in WATER_RISK_ANCHOR_IDS:
        for feature in layers.get(layer_id, []):
            center = feature_centroid(feature)
            if center:
                anchors.append(center)

    targets: list[dict] = []

    for layer_id in WATER_RISK_STORAGE_IDS:
        short = LAYER_SHORT[layer_id]
        effect = storage_risk_effect(layer_id)
        for feature in layers.get(layer_id, []):
            center = feature_centroid(feature)
            if not center:
                continue
            props = feature.get("properties") or {}
            targets.append(
                {
                    "kind": "point",
                    "lat": center["lat"],
                    "lng": center["lng"],
                    "name": display_name(props) or short,
                    "typeLabel": type_label_with_effect(short, effect),
                    "riskEffect": effect,
                    "layerId": layer_id,
                }
            )

    for layer_id in WATER_RISK_LINE_IDS:
        short = LAYER_SHORT[layer_id]
        for feature in layers.get(layer_id, []):
            props = feature.get("properties") or {}
            geom = feature.get("geometry") or {}
            coords = geom.get("coordinates") or []
            risk_meta = line_water_risk_meta(layer_id, props, coords, anchors)
            if not risk_meta:
                continue
            targets.append(
                {
                    "kind": "line",
                    "coords": decimate_coords(coords, RISK_LINE_MAX_PTS),
                    "name": line_display_name(props, short),
                    "typeLabel": type_label_with_effect(short, risk_meta["effect"]),
                    "riskEffect": risk_meta["effect"],
                    "layerId": layer_id,
                }
            )

    return targets


def split_layers(layers: dict[str, list[dict]]) -> tuple[dict, dict]:
    core = {layer_id: layers.get(layer_id, []) for layer_id in CORE_LAYER_IDS}
    detail = {layer_id: layers.get(layer_id, []) for layer_id in DETAIL_LAYER_IDS}
    return core, detail


def layer_meta_payload(
    generated_at: str,
    element_count: int,
    feature_count: int,
    bundle: str,
) -> dict:
    return {
        "cacheVersion": CACHE_VERSION,
        "bbox": WATER_BBOX,
        "generatedAt": generated_at,
        "featureCount": feature_count,
        "elementCount": element_count,
        "source": "OpenStreetMap via Overpass API",
        "format": "layers-v2",
        "bundle": bundle,
    }


def write_json(path: str, payload: dict) -> float:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(path) / (1024 * 1024)


def main() -> None:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    web_root = os.path.dirname(script_dir)
    out_dir = os.path.join(web_root, "data", "osm")
    raw_path = os.path.join(out_dir, "water-infrastructure.json")
    core_path = os.path.join(out_dir, "water-layers-core.json")
    detail_path = os.path.join(out_dir, "water-layers-detail.json")
    risk_path = os.path.join(out_dir, "water-risk-index.json")

    os.makedirs(out_dir, exist_ok=True)
    from_cache = "--from-cache" in sys.argv

    if from_cache:
        if not os.path.isfile(raw_path):
            print(f"Missing {raw_path}; run without --from-cache first.", file=sys.stderr)
            sys.exit(1)
        print(f"Rebuilding from cached raw file: {raw_path}")
        with open(raw_path, encoding="utf-8") as f:
            elements = json.load(f).get("elements", [])
    else:
        print(f"Query bbox: S={WATER_BBOX['s']} W={WATER_BBOX['w']} N={WATER_BBOX['n']} E={WATER_BBOX['e']}")
        print("Fetching water features from Overpass (may take 1-3 minutes)...")
        query = build_query(WATER_BBOX)
        overpass = fetch_overpass(query)
        elements = overpass.get("elements", [])

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if not from_cache:
        raw_payload = {
            "meta": {
                "cacheVersion": CACHE_VERSION,
                "bbox": WATER_BBOX,
                "generatedAt": generated_at,
                "elementCount": len(elements),
                "source": "OpenStreetMap via Overpass API",
            },
            "elements": elements,
        }
        raw_mb = write_json(raw_path, raw_payload)
        print(f"Wrote {len(elements)} raw elements -> {raw_path} ({raw_mb:.2f} MB)")

    print("Building pre-processed GeoJSON layers and risk index...")
    layers = osm_water_by_layer(elements)
    feature_count = sum(len(feats) for feats in layers.values())
    core_layers, detail_layers = split_layers(layers)
    core_count = sum(len(v) for v in core_layers.values())
    detail_count = sum(len(v) for v in detail_layers.values())
    risk_targets = build_water_risk_index(layers)

    core_payload = {
        "meta": layer_meta_payload(generated_at, len(elements), core_count, "core"),
        "layers": core_layers,
    }
    detail_payload = {
        "meta": layer_meta_payload(generated_at, len(elements), detail_count, "detail"),
        "layers": detail_layers,
    }
    risk_payload = {
        "meta": {
            "cacheVersion": CACHE_VERSION,
            "bbox": WATER_BBOX,
            "generatedAt": generated_at,
            "targetCount": len(risk_targets),
            "format": "risk-v1",
        },
        "targets": risk_targets,
    }

    core_mb = write_json(core_path, core_payload)
    detail_mb = write_json(detail_path, detail_payload)
    risk_mb = write_json(risk_path, risk_payload)

    print(f"Wrote {core_count} core features -> {core_path} ({core_mb:.2f} MB)")
    print(f"Wrote {detail_count} detail features -> {detail_path} ({detail_mb:.2f} MB)")
    print(f"Wrote {len(risk_targets)} risk targets -> {risk_path} ({risk_mb:.2f} MB)")
    print(f"Total map features: {feature_count}")
    for layer_id in WATER_LAYER_IDS:
        count = len(layers[layer_id])
        if count:
            print(f"  {layer_id}: {count}")
    print("Refresh the DID & MET page to load cached water data.")


if __name__ == "__main__":
    main()
