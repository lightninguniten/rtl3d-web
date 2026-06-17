"""Parse Lighthouse JSON reports into logs/performance/metrics-summary.json."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

WEB_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = WEB_ROOT / "logs" / "performance"


def page_metrics(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    audits = data.get("audits", {})
    perf = data.get("categories", {}).get("performance", {})
    page_id = path.stem.replace("lighthouse-", "")

    def ms(key: str) -> int:
        value = audits.get(key, {}).get("numericValue")
        return int(round(value)) if value is not None else 0

    transfer = audits.get("total-byte-weight", {}).get("numericValue") or 0
    requests = audits.get("network-requests", {}).get("details", {}).get("items", [])

    return {
        "id": page_id,
        "url": data.get("requestedUrl") or data.get("finalUrl"),
        "score": int(round((perf.get("score") or 0) * 100)),
        "fcp_ms": ms("first-contentful-paint"),
        "lcp_ms": ms("largest-contentful-paint"),
        "tbt_ms": ms("total-blocking-time"),
        "cls": round(audits.get("cumulative-layout-shift", {}).get("numericValue") or 0, 3),
        "speed_index_ms": ms("speed-index"),
        "tti_ms": ms("interactive"),
        "transfer_kb": int(round(transfer / 1024)),
        "requests": len(requests),
        "report": path.name,
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    reports = sorted(OUT_DIR.glob("lighthouse-*.json"))
    if not reports:
        print("No lighthouse-*.json files found.", file=sys.stderr)
        sys.exit(1)

    payload = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pages": [page_metrics(path) for path in reports],
    }

    out_path = OUT_DIR / "metrics-summary.json"
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {len(payload['pages'])} page metrics to {out_path}")

    for page in payload["pages"]:
        print(
            f"  {page['id']}: score={page['score']} "
            f"LCP={page['lcp_ms']}ms transfer={page['transfer_kb']}KB"
        )


if __name__ == "__main__":
    main()
