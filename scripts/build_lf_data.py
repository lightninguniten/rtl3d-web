"""Convert LF localization .dat files to web-friendly JSON."""
import json
import os
import re
from datetime import datetime, timezone

ORIGIN_LAT = 2.726931
ORIGIN_LON = 102.249010

SITES = [
    {"code": "MKPL", "name": "MET Kuala Pilah", "lon": 102.249010, "lat": 2.726931, "alt_m": 129},
    {"code": "UTNL", "name": "UNITEN Putrajaya Campus", "lon": 101.728753, "lat": 2.969325, "alt_m": 68},
    {"code": "DAML", "name": "DID Batu Dam", "lon": 101.684435, "lat": 3.275989, "alt_m": 104},
    {"code": "PJWL", "name": "DID Padang Jawa", "lon": 101.491347, "lat": 3.045798, "alt_m": 9},
    {"code": "PBSL", "name": "Pulau Besar", "lon": 102.334112, "lat": 2.113398, "alt_m": 14.5},
    {"code": "KUTL", "name": "Kolej UNITI, Port Dickson", "lon": 101.964720, "lat": 2.404219, "alt_m": 10},
    {"code": "FLKL", "name": "Falak Astronomy Complex", "lon": 102.083391, "lat": 2.293866, "alt_m": 28},
    {"code": "UTML", "name": "UTeM Malacca", "lon": 102.318442, "lat": 2.313962, "alt_m": 90},
    {"code": "UJSL", "name": "UiTM Jasin Campus", "lon": 102.458225, "lat": 2.228043, "alt_m": 29},
]

EPOCH_MS = 1000.0
FLASH_END_MS = 800.0
FLASH_START_MS = 200.0
FLASH_MAX_GAP_MS = 700.0
MAX_POINTS = 1800

DAT_FILES = [
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753221753.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753221754.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753222265.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753222266.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753222308.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753222309.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753222453.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753222454.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753222594.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753222595.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753222872.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753222873.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753222959.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753222960.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753223119.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753223120.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753223346.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753223347.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753223403.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753223404.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753223769.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753223770.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753225815.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753225816.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753225817.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753225903.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753225904.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753226335.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753226336.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753226480.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753226481.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753226506.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753226507.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753226570.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753226580.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753226581.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753226600.0.dat",
    r"C:\Project\03_Research\06_Journal\Journal1\data\results\ResultLocation_Multiworker_nonjit\4\20250723\auto3D_Corr_1753226601.0.dat",
]


def km_offset(lat, lon):
    """Approximate km offsets from origin (matches pyproj usage in reference script)."""
    import math
    lat_km = (lat - ORIGIN_LAT) * 111.32
    lon_km = (lon - ORIGIN_LON) * 111.32 * math.cos(math.radians(ORIGIN_LAT))
    return round(lon_km, 3), round(lat_km, 3)


def epoch_from_path(path):
    m = re.search(r"auto3D_Corr_(\d+\.?\d*)\.dat", os.path.basename(path))
    return float(m.group(1)) if m else None


def read_time_span(path):
    t_vals = []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        f.readline()
        for line in f:
            if len(line) < 48:
                break
            t_vals.append(float(line[13:23]) * 1000.0)
    if not t_vals:
        return None, None
    return min(t_vals), max(t_vals)


def read_location_dat(path):
    x, y, z, t = [], [], [], []
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        f.readline()
        for line in f:
            if len(line) < 48:
                break
            t.append(float(line[13:23]) * 1000.0)
            y.append(float(line[24:32]))
            x.append(float(line[33:41]))
            z.append(float(line[42:47]))
    return x, y, z, t


def is_flash_continuation(path_a, path_b):
    t_min_a, t_max_a = read_time_span(path_a)
    t_min_b, t_max_b = read_time_span(path_b)
    if t_min_a is None or t_min_b is None:
        return False
    ea = epoch_from_path(path_a)
    eb = epoch_from_path(path_b)
    if ea is None or eb is None or abs(eb - ea - 1.0) > 0.01:
        return False
    gap = (EPOCH_MS - t_max_a) + t_min_b
    if t_max_a >= FLASH_END_MS and t_min_b <= FLASH_START_MS:
        return True
    return gap <= FLASH_MAX_GAP_MS


def build_flash_groups(paths):
    items = [(p, epoch_from_path(p)) for p in paths]
    items = [(p, e) for p, e in items if e is not None]
    items.sort(key=lambda x: x[1])
    groups, i = [], 0
    while i < len(items):
        group = [items[i][0]]
        j = i
        while j + 1 < len(items):
            if abs(items[j + 1][1] - items[j][1] - 1.0) > 0.01:
                break
            if not is_flash_continuation(items[j][0], items[j + 1][0]):
                break
            group.append(items[j + 1][0])
            j += 1
        groups.append(group)
        i = j + 1
    return groups


def merge_flash(paths):
    x_all, y_all, z_all, t_all, epochs = [], [], [], [], []
    n_rows = 0
    for i, path in enumerate(paths):
        x, y, z, t = read_location_dat(path)
        n_rows += len(x)
        epochs.append(epoch_from_path(path))
        offset = i * EPOCH_MS
        t_all.extend([v + offset for v in t])
        x_all.extend(x)
        y_all.extend(y)
        z_all.extend(z)
    return x_all, y_all, z_all, t_all, epochs, n_rows


def downsample(x, y, z, t, max_pts=MAX_POINTS):
    n = len(x)
    if n <= max_pts:
        return x, y, z, t
    step = max(1, n // max_pts)
    idx = list(range(0, n, step))[:max_pts]
    return [x[i] for i in idx], [y[i] for i in idx], [z[i] for i in idx], [t[i] for i in idx]


def utc_label(epochs):
    t0 = datetime.fromtimestamp(epochs[0], timezone.utc)
    if len(epochs) == 1:
        return t0.strftime("%Y-%m-%d %H:%M:%S UTC")
    t1 = datetime.fromtimestamp(epochs[-1], timezone.utc)
    return f"{t0.strftime('%Y-%m-%d %H:%M:%S')} – {t1.strftime('%H:%M:%S')} UTC ({len(epochs)} s)"


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "data", "lf")
    os.makedirs(out_dir, exist_ok=True)

    sites_out = []
    for s in SITES:
        x_km, y_km = km_offset(s["lat"], s["lon"])
        sites_out.append({
            "code": s["code"],
            "name": s["name"],
            "lat": s["lat"],
            "lon": s["lon"],
            "x_km": x_km,
            "y_km": y_km,
            "alt_km": round(s["alt_m"] / 1000.0, 3),
        })

    groups = build_flash_groups(DAT_FILES)
    flashes = []
    for i, group in enumerate(groups):
        x, y, z, t, epochs, n_rows = merge_flash(group)
        if not x:
            continue
        x, y, z, t = downsample(x, y, z, t)
        flashes.append({
            "id": i,
            "label": f"Flash {i + 1} — {utc_label(epochs)}",
            "utc": utc_label(epochs),
            "duration_s": len(epochs),
            "n_sources_total": n_rows,
            "n_sources_plot": len(x),
            "epochs": epochs,
            "files": [os.path.basename(p) for p in group],
            "x": [round(v, 2) for v in x],
            "y": [round(v, 2) for v in y],
            "z": [round(v, 2) for v in z],
            "t": [round(v, 1) for v in t],
        })

    sites_payload = {"origin": {"lat": ORIGIN_LAT, "lon": ORIGIN_LON}, "sites": sites_out}

    with open(os.path.join(out_dir, "sites.json"), "w", encoding="utf-8") as f:
        json.dump(sites_payload, f, indent=2)

    with open(os.path.join(out_dir, "flashes.json"), "w", encoding="utf-8") as f:
        json.dump({"flashes": flashes, "count": len(flashes)}, f)

    js_path = os.path.join(out_dir, "lf-data.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("/* Auto-generated — do not edit. Run scripts/build_lf_data.py to rebuild. */\n")
        f.write("window.LF_DATA=")
        json.dump({"sites": sites_payload, "flashes": flashes}, f, separators=(",", ":"))
        f.write(";\n")

    print(f"Wrote {len(sites_out)} sites, {len(flashes)} flash groups to {out_dir}")
    print(f"  + {js_path} (for file:// and offline use)")


if __name__ == "__main__":
    main()
