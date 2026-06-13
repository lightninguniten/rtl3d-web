"""Validate water OSM cache files match js/osm-water-layers.js expectations."""
from __future__ import annotations

import json
import os
import sys

WEB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OSM = os.path.join(WEB, "data", "osm")
EXPECTED_CV = 3
BBOX = {"s": 2.0, "w": 101.3, "n": 3.5, "e": 102.65}
CORE_IDS = ["water-dam", "water-reservoir", "water-lake", "water-river", "water-basin"]
DETAIL_IDS = ["water-stream", "water-canal", "water-pond", "water-body"]


def load(name: str) -> dict | None:
    path = os.path.join(OSM, name)
    if not os.path.isfile(path):
        print(f"FAIL: missing {name}")
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def check_meta(meta: dict | None, label: str, errors: list[str]) -> None:
    if not meta:
        errors.append(f"{label}: missing meta")
        return
    if meta.get("cacheVersion") != EXPECTED_CV:
        errors.append(f"{label}: cacheVersion {meta.get('cacheVersion')} != {EXPECTED_CV}")
    bb = meta.get("bbox") or {}
    for key, val in BBOX.items():
        if abs(float(bb.get(key, 0)) - val) > 1e-6:
            errors.append(f"{label}: bbox mismatch on {key}")
            break


def main() -> int:
    errors: list[str] = []

    raw = load("water-infrastructure.json")
    core = load("water-layers-core.json")
    detail = load("water-layers-detail.json")
    risk = load("water-risk-index.json")

    if not all([raw, core, detail, risk]):
        return 1

    check_meta(raw.get("meta"), "raw", errors)
    check_meta(core.get("meta"), "core", errors)
    check_meta(detail.get("meta"), "detail", errors)
    check_meta(risk.get("meta"), "risk", errors)

    cl = core.get("layers", {})
    dl = detail.get("layers", {})
    core_n = sum(len(cl.get(i, [])) for i in CORE_IDS)
    detail_n = sum(len(dl.get(i, [])) for i in DETAIL_IDS)

    if core_n != core["meta"].get("featureCount"):
        errors.append(f"core count {core_n} != meta {core['meta'].get('featureCount')}")
    if detail_n != detail["meta"].get("featureCount"):
        errors.append(f"detail count {detail_n} != meta {detail['meta'].get('featureCount')}")

    targets = risk.get("targets", [])
    if len(targets) != risk["meta"].get("targetCount"):
        errors.append(f"risk len {len(targets)} != meta {risk['meta'].get('targetCount')}")

    for t in targets:
        if t.get("kind") == "line" and (not t.get("coords") or len(t["coords"]) < 2):
            errors.append("line risk target missing coords")
            break
        if t.get("kind") == "point" and (t.get("lat") is None or t.get("lng") is None):
            errors.append("point risk target missing lat/lng")
            break

    for label, bundle in ("core", core), ("detail", detail):
        for lid, feats in bundle.get("layers", {}).items():
            for feat in feats:
                geom = feat.get("geometry")
                if not geom or not geom.get("coordinates"):
                    errors.append(f"{label}/{lid}: feature without geometry")
                    break

    def mb(name: str) -> float:
        return os.path.getsize(os.path.join(OSM, name)) / (1024 * 1024)

    print(f"raw:  {raw['meta']['elementCount']} elements, {mb('water-infrastructure.json'):.2f} MB")
    print(f"core: {core_n} features, {mb('water-layers-core.json'):.2f} MB")
    print(f"detail: {detail_n} features, {mb('water-layers-detail.json'):.2f} MB")
    print(f"risk: {len(targets)} targets, {mb('water-risk-index.json'):.2f} MB")
    print(f"total: {core_n + detail_n} map features")

    if errors:
        print("CHECK FAILED:")
        for err in errors:
            print(f"  - {err}")
        return 1

    print("CHECK OK: cacheVersion=3, bbox, counts, geometries, risk targets")
    return 0


if __name__ == "__main__":
    sys.exit(main())
