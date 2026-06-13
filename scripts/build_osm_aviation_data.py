"""Download OSM aeroway/ferry features and build pre-processed transport layer caches.

Aviation route sources:
  - OpenStreetMap: aeroway features + rare route=flight ways
  - RTL3D curated illustrative corridors (FLIGHT_ROUTES)
  - OpenFlights routes.dat: commercial airport pairs (ODbL, non-commercial OK)
    https://openflights.org/data  |  https://github.com/jpatokal/openflights

Usage:
  py -3 scripts/build_osm_aviation_data.py
  py -3 scripts/build_osm_aviation_data.py --from-cache

Output:
  data/osm/aviation-infrastructure.json   (raw Overpass archive)
  data/osm/aviation-layers-core.json        (routes + airports — fast first paint)
  data/osm/aviation-layers-detail.json      (runways — background load)
"""
from __future__ import annotations

import csv
import json
import math
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

# Must match js/osm-aviation-layers.js
AVIATION_BBOX = {"s": 2.0, "w": 101.3, "n": 3.5, "e": 102.65}
CACHE_VERSION = 9
COORD_DP = 5

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

OPENFLIGHTS_AIRPORTS_URL = (
    "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat"
)
OPENFLIGHTS_ROUTES_URL = (
    "https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat"
)

# Malaysia peninsular + nearby hubs for route filtering.
PENINSULAR_ROUTE_COUNTRIES = frozenset({"Malaysia", "Singapore", "Thailand", "Indonesia"})
PENINSULAR_EXTRA_IATA = frozenset(
    {"SIN", "BKK", "DMK", "CGK", "SUB", "DPS", "PNH", "REP", "HAN", "SGN", "RGN", "BWN"}
)
OPENFLIGHTS_ROUTE_ID_START = -3001

TRANSPORT_LAYER_IDS = [
    "maritime-route",
    "aviation-route-domestic",
    "aviation-route-international",
    "aviation-route-approach",
    "aviation-route-corridor",
    "aviation-runway",
    "aviation-airport",
]

CORE_LAYER_IDS = [
    "maritime-route",
    "aviation-route-domestic",
    "aviation-route-international",
    "aviation-route-approach",
    "aviation-route-corridor",
    "aviation-airport",
]

DETAIL_LAYER_IDS = [
    "aviation-runway",
]

AIRPORT_AEROWAYS = frozenset({"aerodrome", "heliport", "helipad"})
RUNWAY_AEROWAYS = frozenset({"runway", "stopway"})

POPUP_TAG_KEYS = (
    "name",
    "name:en",
    "name:ms",
    "ref",
    "icao",
    "iata",
    "aeroway",
    "route",
    "_rtl3d_flight_route",
    "_rtl3d_openflights_route",
    "_rtl3d_maritime_route",
    "rtl3d_route_class",
)

# ICAO/AIP-aligned route classes for map layers (see Annex 11 ATS routes; AIP route_use).
FLIGHT_ROUTE_CLASS_TO_LAYER = {
    "domestic": "aviation-route-domestic",
    "international": "aviation-route-international",
    "approach": "aviation-route-approach",
    "corridor": "aviation-route-corridor",
}

ROUTE_CLASS_LABEL = {
    "domestic": "Domestic scheduled",
    "international": "International scheduled",
    "approach": "Approach & departure",
    "corridor": "Illustrative corridor",
}

FLIGHT_ROUTES = [
    {
        "id": -1001,
        "ref": "A1",
        "name": "KLIA – Malacca (WMKK–WMKM)",
        "route_class": "corridor",
        "geometry": [
            (2.745556, 101.709917),
            (2.62, 101.82),
            (2.45, 101.98),
            (2.263389, 102.250639),
        ],
    },
    {
        "id": -1002,
        "ref": "A2",
        "name": "KLIA – Subang (WMKK–WMSA)",
        "route_class": "corridor",
        "geometry": [
            (2.745556, 101.709917),
            (2.92, 101.64),
            (3.130583, 101.549333),
        ],
    },
    {
        "id": -1003,
        "ref": "A3",
        "name": "KLIA – Klang (WMKK–WMKF)",
        "route_class": "corridor",
        "geometry": [
            (2.745556, 101.709917),
            (2.88, 101.52),
            (3.001667, 101.398333),
        ],
    },
    {
        "id": -1004,
        "ref": "A4",
        "name": "Kuala Pilah – KLIA southern approach sector",
        "route_class": "approach",
        "geometry": [
            (2.726931, 102.24901),
            (2.72, 102.05),
            (2.73, 101.88),
            (2.745556, 101.709917),
        ],
    },
    {
        "id": -1005,
        "ref": "A5",
        "name": "Port Dickson – KLIA coastal corridor",
        "route_class": "approach",
        "geometry": [
            (2.404219, 101.96472),
            (2.52, 101.86),
            (2.64, 101.78),
            (2.745556, 101.709917),
        ],
    },
]

MARITIME_ROUTES = [
    {
        "id": -2001,
        "ref": "M1",
        "name": "Malacca Strait main shipping lane",
        "geometry": [
            (2.15, 101.15),
            (2.2, 101.55),
            (2.28, 102.0),
            (2.32, 102.45),
            (2.35, 102.62),
        ],
    },
    {
        "id": -2002,
        "ref": "M2",
        "name": "Port Klang – Port Dickson coastal traffic",
        "geometry": [
            (3.001667, 101.398333),
            (2.82, 101.55),
            (2.62, 101.72),
            (2.404219, 101.96472),
        ],
    },
    {
        "id": -2003,
        "ref": "M3",
        "name": "Pulau Besar – Malacca (ferry / local craft)",
        "geometry": [
            (2.113398, 102.334112),
            (2.17, 102.3),
            (2.22, 102.27),
            (2.263389, 102.250639),
        ],
    },
    {
        "id": -2004,
        "ref": "M4",
        "name": "Malacca – offshore patrol sector",
        "geometry": [
            (2.263389, 102.250639),
            (2.2, 102.38),
            (2.15, 102.48),
            (2.12, 102.55),
        ],
    },
    {
        "id": -2005,
        "ref": "M5",
        "name": "Dungun – Kuantan coastal passage (southbound lane)",
        "geometry": [
            (3.35, 102.45),
            (3.05, 102.35),
            (2.75, 102.28),
            (2.45, 102.22),
        ],
    },
    {
        "id": -2006,
        "ref": "M6",
        "name": "Kuala Linggi – Malacca river mouth approach",
        "geometry": [
            (2.398, 101.978),
            (2.34, 102.05),
            (2.29, 102.15),
            (2.263389, 102.250639),
        ],
    },
]

# Peninsula coast (lat, lon) for trimming land-touching maritime segments.
WEST_COASTLINE = (
    (3.5, 101.35),
    (3.0, 101.38),
    (2.8, 101.48),
    (2.6, 101.62),
    (2.4, 101.85),
    (2.2, 102.08),
    (2.0, 102.30),
)
EAST_COASTLINE = (
    (3.5, 102.48),
    (3.0, 102.50),
    (2.8, 102.52),
    (2.6, 102.55),
    (2.4, 102.58),
    (2.2, 102.60),
    (2.0, 102.62),
)
WATER_COAST_MARGIN_DEG = 0.012
PORT_KLANG_LAND_BOX = (101.375, 101.395, 2.99, 3.03)
PENINSULA_INLAND_MARGIN_DEG = 0.05
# Long OSM ferry chords — keep continuous strait geometry (no mid-sea splits).
INTERNATIONAL_FERRY_LON_SPAN_DEG = 0.18
INTERNATIONAL_FERRY_LAT_SPAN_DEG = 0.32


def build_query(bbox: dict) -> str:
    b = f"{bbox['s']},{bbox['w']},{bbox['n']},{bbox['e']}"
    return (
        f"[out:json][timeout:180];"
        f"("
        f'nwr["aeroway"]({b});'
        f'way["route"="flight"]({b});'
        f'relation["route"="flight"]({b});'
        f'way["route"="ferry"]({b});'
        f'relation["route"="ferry"]({b});'
        f");out geom tags;"
    )


def fetch_overpass(query: str) -> dict:
    body = urllib.parse.urlencode({"data": query}).encode("utf-8")
    headers = {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "Accept": "application/json",
        "User-Agent": "RTL3D-web/1.0 (aviation transport cache builder)",
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


def close_ring(coords: list[list[float]]) -> list[list[float]]:
    if len(coords) < 3:
        return coords
    if coords[0] == coords[-1]:
        return coords
    return coords + [coords[0]]


def round_geometry(geom: dict) -> dict:
    gtype = geom.get("type")
    coords = geom.get("coordinates")
    if not coords:
        return geom
    if gtype == "Point":
        return {"type": "Point", "coordinates": round_coords([coords])[0]}
    if gtype == "LineString":
        return {"type": "LineString", "coordinates": round_coords(coords)}
    if gtype == "Polygon":
        return {"type": "Polygon", "coordinates": [round_coords(ring) for ring in coords]}
    if gtype == "MultiLineString":
        return {
            "type": "MultiLineString",
            "coordinates": [round_coords(line) for line in coords],
        }
    return geom


def slim_tags(tags: dict, layer_id: str) -> dict:
    props = {"_layerId": layer_id}
    for key in POPUP_TAG_KEYS:
        if key in tags:
            props[key] = tags[key]
    return props


def classify_flight_layer_id(tags: dict) -> str:
    route_class = tags.get("rtl3d_route_class")
    if route_class in FLIGHT_ROUTE_CLASS_TO_LAYER:
        return FLIGHT_ROUTE_CLASS_TO_LAYER[route_class]
    return "aviation-route-corridor"


def classify_transport(tags: dict | None) -> str | None:
    if not tags:
        return None
    if tags.get("_rtl3d_maritime_route") == "true" or tags.get("route") == "ferry":
        return "maritime-route"
    if tags.get("route") == "flight" or tags.get("_rtl3d_flight_route") == "true":
        return classify_flight_layer_id(tags)
    aw = tags.get("aeroway")
    if aw in AIRPORT_AEROWAYS:
        return "aviation-airport"
    if aw in RUNWAY_AEROWAYS:
        return "aviation-runway"
    return None


def line_coords_from_geometry(pts: list[dict]) -> list[list[float]]:
    return [[p["lon"], p["lat"]] for p in pts]


def interpolate_coast_lon(lat: float, coastline: tuple[tuple[float, float], ...]) -> float:
    if lat >= coastline[0][0]:
        return coastline[0][1]
    if lat <= coastline[-1][0]:
        return coastline[-1][1]
    for i in range(len(coastline) - 1):
        lat_hi, lon_hi = coastline[i]
        lat_lo, lon_lo = coastline[i + 1]
        if lat_lo <= lat <= lat_hi:
            if lat_hi == lat_lo:
                return (lon_hi + lon_lo) / 2
            t = (lat - lat_lo) / (lat_hi - lat_lo)
            return lon_lo + t * (lon_hi - lon_lo)
    return coastline[-1][1]


def line_bbox_spans(coords: list[list[float]]) -> tuple[float, float]:
    lons = [c[0] for c in coords]
    lats = [c[1] for c in coords]
    return max(lons) - min(lons), max(lats) - min(lats)


def in_port_klang_land(lon: float, lat: float) -> bool:
    lon_min, lon_max, lat_min, lat_max = PORT_KLANG_LAND_BOX
    return lon_min <= lon <= lon_max and lat_min <= lat <= lat_max


def is_land_point(lon: float, lat: float, *, interior_only: bool = True) -> bool:
    if in_port_klang_land(lon, lat):
        return True
    # Open strait / South China Sea side inside the study map.
    if lon >= 102.25:
        return False
    west = interpolate_coast_lon(lat, WEST_COASTLINE)
    east = interpolate_coast_lon(lat, EAST_COASTLINE)
    # Malacca Strait waters west of the peninsula.
    if lon <= west + 0.03:
        return False
    if interior_only:
        west += PENINSULA_INLAND_MARGIN_DEG
        east -= PENINSULA_INLAND_MARGIN_DEG
    return west < lon < east


def is_water_point(lon: float, lat: float, *, interior_only: bool = True) -> bool:
    return not is_land_point(lon, lat, interior_only=interior_only)


def is_international_ferry(coords: list[list[float]], props: dict) -> bool:
    if props.get("_rtl3d_maritime_route") == "true":
        return False
    lon_span, lat_span = line_bbox_spans(coords)
    if lon_span >= INTERNATIONAL_FERRY_LON_SPAN_DEG or lat_span >= INTERNATIONAL_FERRY_LAT_SPAN_DEG:
        return True
    label = " ".join(
        str(props.get(key) or "")
        for key in ("name", "name:en", "name:ms")
    ).lower()
    return any(
        token in label
        for token in (
            "sumatra",
            "indonesia",
            "batam",
            "belawan",
            "tanjung balai",
            "dumai",
        )
    )


def trim_local_ferry_coords(coords: list[list[float]]) -> list[list[float]]:
    trimmed = [pt for pt in coords if not in_port_klang_land(pt[0], pt[1])]
    return trimmed if len(trimmed) >= 2 else []


def edge_crosses_land(
    a: list[float], b: list[float], *, interior_only: bool = True
) -> bool:
    mid_lon = (a[0] + b[0]) / 2
    mid_lat = (a[1] + b[1]) / 2
    return not is_water_point(mid_lon, mid_lat, interior_only=interior_only)


def water_only_segments(
    coords: list[list[float]], *, interior_only: bool = True
) -> list[list[list[float]]]:
    if len(coords) < 2:
        return []
    segments: list[list[list[float]]] = []
    current: list[list[float]] = []
    for pt in coords:
        if not is_water_point(pt[0], pt[1], interior_only=interior_only):
            if len(current) >= 2:
                segments.append(current)
            current = []
            continue
        if current and edge_crosses_land(current[-1], pt, interior_only=interior_only):
            if len(current) >= 2:
                segments.append(current)
            current = [pt]
        else:
            current.append(pt)
    if len(current) >= 2:
        segments.append(current)
    return segments


def geometry_from_water_segments(segments: list[list[list[float]]]) -> dict | None:
    if not segments:
        return None
    if len(segments) == 1:
        return {"type": "LineString", "coordinates": segments[0]}
    return {"type": "MultiLineString", "coordinates": segments}


def maritime_geometry_from_coords(
    coords: list[list[float]], *, interior_only: bool = True
) -> dict | None:
    return geometry_from_water_segments(
        water_only_segments(coords, interior_only=interior_only)
    )


def build_maritime_geometry(
    coords: list[list[float]], props: dict
) -> dict | None:
    if len(coords) < 2:
        return None

    label = " ".join(
        str(props.get(key) or "")
        for key in ("name", "name:en", "name:ms")
    ).strip()
    is_synthetic = props.get("_rtl3d_maritime_route") == "true"

    if is_synthetic:
        geom = maritime_geometry_from_coords(coords, interior_only=True)
        if geom:
            return geom
        return {"type": "LineString", "coordinates": coords}

    if is_international_ferry(coords, props):
        return {"type": "LineString", "coordinates": coords}

    if not label:
        lon_span, lat_span = line_bbox_spans(coords)
        if len(coords) <= 8 and lon_span < 0.03 and lat_span < 0.03:
            return None

    trimmed = trim_local_ferry_coords(coords)
    if len(trimmed) >= 2:
        return {"type": "LineString", "coordinates": trimmed}
    return None


def append_maritime_feature(
    layers: dict[str, list[dict]],
    props: dict,
    coords: list[list[float]],
) -> None:
    geom = build_maritime_geometry(coords, props)
    if not geom:
        return
    layers["maritime-route"].append(
        {
            "type": "Feature",
            "properties": props,
            "geometry": round_geometry(geom),
        }
    )


def fetch_url(url: str, timeout: int = 120) -> bytes:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "RTL3D-web/1.0 (aviation transport cache builder)"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def ensure_openflights_cache(web_root: str) -> tuple[str, str]:
    cache_dir = os.path.join(web_root, "data", "openflights")
    os.makedirs(cache_dir, exist_ok=True)
    airports_path = os.path.join(cache_dir, "airports.dat")
    routes_path = os.path.join(cache_dir, "routes.dat")
    for path, url in (
        (airports_path, OPENFLIGHTS_AIRPORTS_URL),
        (routes_path, OPENFLIGHTS_ROUTES_URL),
    ):
        if not os.path.isfile(path) or os.path.getsize(path) < 1000:
            print(f"Downloading OpenFlights data: {url}")
            data = fetch_url(url)
            with open(path, "wb") as f:
                f.write(data)
    return airports_path, routes_path


def parse_openflights_airports(path: str) -> dict[str, dict]:
    airports: dict[str, dict] = {}
    with open(path, encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 8:
                continue
            airport_id = row[0].strip()
            iata = row[4].strip()
            if not iata or iata == r"\N":
                continue
            try:
                lat = float(row[6])
                lon = float(row[7])
            except ValueError:
                continue
            airports[airport_id] = {
                "id": airport_id,
                "name": row[1].strip(),
                "city": row[2].strip(),
                "country": row[3].strip(),
                "iata": iata,
                "icao": row[5].strip() if row[5].strip() != r"\N" else "",
                "lat": lat,
                "lon": lon,
            }
            airports[iata] = airports[airport_id]
    return airports


def point_in_bbox(lon: float, lat: float, bbox: dict) -> bool:
    return bbox["w"] <= lon <= bbox["e"] and bbox["s"] <= lat <= bbox["n"]


def route_touches_study_bbox(a: dict, b: dict, bbox: dict) -> bool:
    if point_in_bbox(a["lon"], a["lat"], bbox) or point_in_bbox(b["lon"], b["lat"], bbox):
        return True
    for step in range(9):
        t = step / 8
        lat = a["lat"] + t * (b["lat"] - a["lat"])
        lon = a["lon"] + t * (b["lon"] - a["lon"])
        if point_in_bbox(lon, lat, bbox):
            return True
    return False


def peninsular_airport(airport: dict) -> bool:
    if airport["country"] in PENINSULAR_ROUTE_COUNTRIES:
        return True
    return airport["iata"] in PENINSULAR_EXTRA_IATA


def great_circle_points(
    lat1: float, lon1: float, lat2: float, lon2: float, segments: int = 6
) -> list[tuple[float, float]]:
    if segments < 2:
        segments = 2
    phi1 = math.radians(lat1)
    lam1 = math.radians(lon1)
    phi2 = math.radians(lat2)
    lam2 = math.radians(lon2)
    d = 2 * math.asin(
        math.sqrt(
            math.sin((phi2 - phi1) / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin((lam2 - lam1) / 2) ** 2
        )
    )
    if d == 0:
        return [(lat1, lon1), (lat2, lon2)]
    out = []
    for i in range(segments + 1):
        f = i / segments
        a = math.sin((1 - f) * d) / math.sin(d)
        b = math.sin(f * d) / math.sin(d)
        x = a * math.cos(phi1) * math.cos(lam1) + b * math.cos(phi2) * math.cos(lam2)
        y = a * math.cos(phi1) * math.sin(lam1) + b * math.cos(phi2) * math.sin(lam2)
        z = a * math.sin(phi1) + b * math.sin(phi2)
        lat = math.degrees(math.atan2(z, math.sqrt(x * x + y * y)))
        lon = math.degrees(math.atan2(y, x))
        out.append((lat, lon))
    return out


def curated_route_pairs() -> set[frozenset[str]]:
    pairs: set[frozenset[str]] = set()
    for route in FLIGHT_ROUTES:
        parts = route["name"].split("–")
        if len(parts) < 2:
            continue
        left = parts[0].strip().split("(")[-1].replace(")", "").strip()
        right = parts[1].strip().split("(")[-1].replace(")", "").strip()
        if len(left) == 4 and len(right) == 4:
            pairs.add(frozenset({left, right}))
    return pairs


def build_openflights_flight_elements(web_root: str) -> list[dict]:
    airports_path, routes_path = ensure_openflights_cache(web_root)
    airports = parse_openflights_airports(airports_path)
    curated_pairs = curated_route_pairs()
    seen_pairs: set[frozenset[str]] = set()
    elements: list[dict] = []
    next_id = OPENFLIGHTS_ROUTE_ID_START

    with open(routes_path, encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 6:
                continue
            src_iata = row[2].strip()
            dst_iata = row[4].strip()
            if not src_iata or not dst_iata or src_iata == r"\N" or dst_iata == r"\N":
                continue
            if src_iata == dst_iata:
                continue
            src = airports.get(src_iata)
            dst = airports.get(dst_iata)
            if not src or not dst:
                continue
            if not peninsular_airport(src) and not peninsular_airport(dst):
                continue
            if not route_touches_study_bbox(src, dst, AVIATION_BBOX):
                continue
            pair = frozenset({src_iata, dst_iata})
            if pair in seen_pairs or pair in curated_pairs:
                continue
            seen_pairs.add(pair)

            geometry = [
                {"lat": lat, "lon": lon}
                for lat, lon in great_circle_points(
                    src["lat"], src["lon"], dst["lat"], dst["lon"], segments=5
                )
            ]
            name = f"{src['iata']} ({src['city']}) – {dst['iata']} ({dst['city']})"
            route_class = (
                "domestic"
                if src["country"] == dst["country"] == "Malaysia"
                else "international"
            )
            elements.append(
                {
                    "type": "way",
                    "id": next_id,
                    "tags": {
                        "route": "flight",
                        "_rtl3d_flight_route": "true",
                        "_rtl3d_openflights_route": "true",
                        "rtl3d_route_class": route_class,
                        "name": name,
                        "ref": f"{src['iata']}-{dst['iata']}",
                        "from": src["iata"],
                        "to": dst["iata"],
                        "source": "OpenFlights",
                    },
                    "geometry": geometry,
                }
            )
            next_id -= 1

    print(f"OpenFlights: added {len(elements)} peninsular route pairs")
    return elements


def refresh_synthetic_elements(elements: list[dict], web_root: str) -> list[dict]:
    kept = [
        el
        for el in elements
        if not (
            (el.get("tags") or {}).get("_rtl3d_flight_route") == "true"
            or (el.get("tags") or {}).get("_rtl3d_maritime_route") == "true"
            or (el.get("tags") or {}).get("_rtl3d_openflights_route") == "true"
        )
    ]
    kept.extend(synthetic_elements(FLIGHT_ROUTES, "flight", "_rtl3d_flight_route"))
    kept.extend(synthetic_elements(MARITIME_ROUTES, "ferry", "_rtl3d_maritime_route"))
    kept.extend(build_openflights_flight_elements(web_root))
    return kept


def synthetic_elements(routes: list[dict], route_type: str, tag_key: str) -> list[dict]:
    out = []
    for route in routes:
        tags = {
            "route": route_type,
            tag_key: "true",
            "name": route["name"],
            "ref": route["ref"],
        }
        if route_type == "flight" and route.get("route_class"):
            tags["rtl3d_route_class"] = route["route_class"]
        out.append(
            {
                "type": "way",
                "id": route["id"],
                "tags": tags,
                "geometry": [{"lat": lat, "lon": lon} for lat, lon in route["geometry"]],
            }
        )
    return out


def osm_transport_by_layer(elements: list[dict]) -> dict[str, list[dict]]:
    layers: dict[str, list[dict]] = {layer_id: [] for layer_id in TRANSPORT_LAYER_IDS}

    for el in elements:
        tags = el.get("tags") or {}
        layer_id = classify_transport(tags)
        if not layer_id:
            continue
        props = slim_tags(tags, layer_id)

        if el.get("type") == "node" and el.get("lat") is not None and el.get("lon") is not None:
            geom = {"type": "Point", "coordinates": [el["lon"], el["lat"]]}
            layers[layer_id].append(
                {
                    "type": "Feature",
                    "properties": props,
                    "geometry": round_geometry(geom),
                }
            )
            continue

        if el.get("type") == "way" and el.get("geometry") and len(el["geometry"]) >= 2:
            pts = el["geometry"]
            if layer_id == "maritime-route":
                append_maritime_feature(
                    layers,
                    props,
                    line_coords_from_geometry(pts),
                )
                continue
            if layer_id == "aviation-airport" and len(pts) >= 3:
                ring = close_ring([[p["lon"], p["lat"]] for p in pts])
                if len(ring) >= 4:
                    geom = {"type": "Polygon", "coordinates": [ring]}
                    layers[layer_id].append(
                        {
                            "type": "Feature",
                            "properties": props,
                            "geometry": round_geometry(geom),
                        }
                    )
                continue
            geom = {
                "type": "LineString",
                "coordinates": [[p["lon"], p["lat"]] for p in pts],
            }
            layers[layer_id].append(
                {
                    "type": "Feature",
                    "properties": props,
                    "geometry": round_geometry(geom),
                }
            )
            continue

        if el.get("type") == "relation" and el.get("members"):
            lines = []
            for member in el.get("members") or []:
                if member.get("type") != "way" or not member.get("geometry"):
                    continue
                if len(member["geometry"]) < 2:
                    continue
                lines.append([[p["lon"], p["lat"]] for p in member["geometry"]])
            if not lines:
                continue
            if layer_id == "maritime-route":
                flat = [pt for line in lines for pt in line]
                append_maritime_feature(layers, props, flat)
                continue
            geom = (
                {"type": "LineString", "coordinates": lines[0]}
                if len(lines) == 1
                else {"type": "MultiLineString", "coordinates": lines}
            )
            layers[layer_id].append(
                {
                    "type": "Feature",
                    "properties": props,
                    "geometry": round_geometry(geom),
                }
            )

    return layers


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
        "bbox": AVIATION_BBOX,
        "generatedAt": generated_at,
        "featureCount": feature_count,
        "elementCount": element_count,
        "source": "OpenStreetMap + OpenFlights + RTL3D curated corridors",
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
    raw_path = os.path.join(out_dir, "aviation-infrastructure.json")
    core_path = os.path.join(out_dir, "aviation-layers-core.json")
    detail_path = os.path.join(out_dir, "aviation-layers-detail.json")

    os.makedirs(out_dir, exist_ok=True)
    from_cache = "--from-cache" in sys.argv

    if from_cache:
        if not os.path.isfile(raw_path):
            print(f"Missing {raw_path}; run without --from-cache first.", file=sys.stderr)
            sys.exit(1)
        print(f"Rebuilding from cached raw file: {raw_path}")
        with open(raw_path, encoding="utf-8") as f:
            elements = json.load(f).get("elements", [])
        elements = refresh_synthetic_elements(elements, web_root)
    else:
        print(
            f"Query bbox: S={AVIATION_BBOX['s']} W={AVIATION_BBOX['w']} "
            f"N={AVIATION_BBOX['n']} E={AVIATION_BBOX['e']}"
        )
        print("Fetching aeroway and ferry data from Overpass…")
        overpass = fetch_overpass(build_query(AVIATION_BBOX))
        elements = list(overpass.get("elements", []))
        elements = refresh_synthetic_elements(elements, web_root)

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if not from_cache:
        raw_payload = {
            "meta": {
                "cacheVersion": CACHE_VERSION,
                "bbox": AVIATION_BBOX,
                "generatedAt": generated_at,
                "elementCount": len(elements),
                "flightRouteCount": len(FLIGHT_ROUTES),
                "openFlightsRouteCount": sum(
                    1
                    for el in elements
                    if (el.get("tags") or {}).get("_rtl3d_openflights_route") == "true"
                ),
                "maritimeRouteCount": len(MARITIME_ROUTES),
                "source": "OpenStreetMap + OpenFlights + RTL3D curated corridors",
            },
            "elements": elements,
        }
        raw_mb = write_json(raw_path, raw_payload)
        print(f"Wrote {len(elements)} raw elements -> {raw_path} ({raw_mb:.2f} MB)")

    print("Building pre-processed transport GeoJSON layers…")
    layers = osm_transport_by_layer(elements)
    feature_count = sum(len(feats) for feats in layers.values())
    core_layers, detail_layers = split_layers(layers)
    core_count = sum(len(v) for v in core_layers.values())
    detail_count = sum(len(v) for v in detail_layers.values())

    core_payload = {
        "meta": layer_meta_payload(generated_at, len(elements), core_count, "core"),
        "layers": core_layers,
    }
    detail_payload = {
        "meta": layer_meta_payload(generated_at, len(elements), detail_count, "detail"),
        "layers": detail_layers,
    }

    core_mb = write_json(core_path, core_payload)
    detail_mb = write_json(detail_path, detail_payload)

    print(f"Wrote {core_count} core features -> {core_path} ({core_mb:.2f} MB)")
    print(f"Wrote {detail_count} detail features -> {detail_path} ({detail_mb:.2f} MB)")
    print(f"Total map features: {feature_count}")
    for layer_id in TRANSPORT_LAYER_IDS:
        count = len(layers[layer_id])
        if count:
            print(f"  {layer_id}: {count}")
    print("Refresh the Public Safety page to load cached transport data.")


if __name__ == "__main__":
    main()
