(function () {
  'use strict';

  const NETWORK = {
    origin: { lat: 2.726931, lon: 102.24901 },
    sites: [
      { code: 'MKPL', name: 'MET Kuala Pilah', lat: 2.726931, lon: 102.24901 },
      { code: 'UTNL', name: 'UNITEN Putrajaya Campus', lat: 2.969325, lon: 101.728753 },
      { code: 'DAML', name: 'DID Batu Dam', lat: 3.275989, lon: 101.684435 },
      { code: 'PJWL', name: 'DID Padang Jawa', lat: 3.045798, lon: 101.491347 },
      { code: 'PBSL', name: 'Pulau Besar', lat: 2.113398, lon: 102.334112 },
      { code: 'KUTL', name: 'Kolej UNITI, Port Dickson', lat: 2.404219, lon: 101.96472 },
      { code: 'FLKL', name: 'Falak Astronomy Complex', lat: 2.293866, lon: 102.083391 },
      { code: 'UTML', name: 'UTeM Malacca', lat: 2.313962, lon: 102.318442 },
      { code: 'UJSL', name: 'UiTM Jasin Campus', lat: 2.228043, lon: 102.458225 },
    ],
  };

  const LF_ONLY = new Set(['MKPL', 'KUTL']);
  const COVERAGE_KM = 120;

  /** Study region bbox for OSM power-line query (south, west, north, east) */
  const POWER_BBOX = { s: 2.0, w: 101.3, n: 3.5, e: 102.65 };

  /** Offline cache — run scripts/build_osm_power_data.py to refresh */
  const LOCAL_OSM_POWER_URL = 'data/osm/power-infrastructure.json';
  const OSM_CACHE_VERSION = 6;

  /** Overpass selector — keep in sync with scripts/build_osm_power_data.py */
  const POWER_OVERPASS_SELECTOR = 'nwr["power"]';

  const TX_MIN_VOLTAGE = 132000;
  const SPATIAL_INFERENCE_MAX_M = 750;
  const LV_VOLTAGE_VALUES = new Set([230, 240, 380, 400, 415, 440, 480, 600, 690]);

  /** Voltage tier definitions — colour and line weight by kV class */
  const VOLTAGE_TIERS = {
    'tx-500': { label: '500 kV transmission', color: '#6d28d9', weight: 4, opacity: 0.9, kind: 'transmission' },
    'tx-275': { label: '275 kV transmission', color: '#dc2626', weight: 3.5, opacity: 0.88, kind: 'transmission' },
    'tx-132': { label: '132 kV transmission', color: '#0ea5e9', weight: 3, opacity: 0.92, kind: 'transmission' },
    'tx-other': { label: 'Other HV transmission', color: '#991b1b', weight: 3, opacity: 0.85, kind: 'transmission' },
    'dist-66': { label: '66 kV distribution', color: '#2563eb', weight: 3.5, opacity: 0.92, kind: 'distribution' },
    'dist-33': { label: '33 kV distribution', color: '#0284c7', weight: 3.5, opacity: 0.92, kind: 'distribution' },
    'dist-11': { label: '11 kV distribution', color: '#0d9488', weight: 3.5, opacity: 0.95, kind: 'distribution' },
    'dist-lv': { label: 'LV distribution (<11 kV)', color: '#eab308', weight: 3.5, opacity: 0.95, kind: 'distribution' },
    'dist-minor': { label: 'LV line (minor_line)', color: '#ca8a04', weight: 3.5, opacity: 0.95, kind: 'distribution' },
    'dist-cable': { label: 'Underground cable', color: '#7c3aed', weight: 3, opacity: 0.9, dashArray: '7 5', kind: 'distribution' },
    'dist-unknown': { label: 'MV/LV (voltage not tagged)', color: '#64748b', weight: 3, opacity: 0.9, dashArray: '4 6', kind: 'distribution' },
  };

  function normalizeVoltageVolts(raw) {
    if (raw == null || !Number.isFinite(raw)) return null;
    const n = Math.round(Number(raw));
    if (n >= 1000) return n;
    if (LV_VOLTAGE_VALUES.has(n)) return n;
    if (n >= 6 && n <= 999) return n * 1000;
    if (n < 6) return n * 1000;
    return n;
  }

  function parseAllVoltages(voltageStr) {
    if (voltageStr == null || voltageStr === '') return [];
    const out = [];
    String(voltageStr).split(/[/;|,\s]+/).forEach((part) => {
      const nums = part.match(/\d+(?:\.\d+)?/g);
      if (!nums) return;
      nums.forEach((num) => {
        const v = normalizeVoltageVolts(parseFloat(num));
        if (v != null) out.push(v);
      });
    });
    return out;
  }

  function parseMaxVoltage(voltageStr) {
    const all = parseAllVoltages(voltageStr);
    return all.length ? Math.max(...all) : null;
  }

  function tierIdFromVolts(maxV, tags) {
    const power = tags.power || 'line';
    if (power === 'cable') return 'dist-cable';
    if (power === 'minor_line' || power === 'small_line') return 'dist-minor';
    if (maxV == null) return 'dist-unknown';
    if (maxV >= 500000) return 'tx-500';
    if (maxV >= 275000) return 'tx-275';
    if (maxV >= 132000) return 'tx-132';
    if (maxV >= TX_MIN_VOLTAGE) return 'tx-other';
    if (maxV >= 66000) return 'dist-66';
    if (maxV >= 33000) return 'dist-33';
    if (maxV >= 11000) return 'dist-11';
    return 'dist-lv';
  }

  function getVoltageTierId(tags, maxVOverride) {
    const maxV = maxVOverride != null ? maxVOverride : parseMaxVoltage(tags.voltage);
    return tierIdFromVolts(maxV, tags);
  }

  function getVoltageTier(tags, maxVOverride) {
    const id = getVoltageTierId(tags, maxVOverride);
    return { id, ...VOLTAGE_TIERS[id] };
  }

  function substationDistributionVoltage(voltageStr) {
    const mvs = parseAllVoltages(voltageStr).filter((v) => v >= 11000 && v < TX_MIN_VOLTAGE);
    return mvs.length ? Math.max(...mvs) : null;
  }

  function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function wayCentroidFromGeometry(geometry) {
    if (!geometry || !geometry.length) return null;
    let lat = 0;
    let lon = 0;
    geometry.forEach((p) => {
      lat += p.lat;
      lon += p.lon;
    });
    return { lat: lat / geometry.length, lon: lon / geometry.length };
  }

  function buildPowerVoltageContext(osmData) {
    const nodeVoltage = new Map();
    const wayVoltage = new Map();
    const wayNodesById = new Map();
    const untaggedLineWays = [];
    const substationSites = [];
    const infraNodePowers = new Set(['substation', 'plant', 'transformer', 'generator']);

    function applyNodeVoltage(nodeIds, voltageStr) {
      const v = parseMaxVoltage(voltageStr);
      if (v == null) return;
      nodeIds.forEach((nodeId) => {
        const prev = nodeVoltage.get(nodeId);
        if (prev == null || v > prev) nodeVoltage.set(nodeId, v);
      });
    }

    (osmData.elements || []).forEach((el) => {
      if (el.type === 'way' && el.nodes) wayNodesById.set(el.id, el.nodes);
    });

    (osmData.elements || []).forEach((el) => {
      const tags = el.tags || {};
      if (el.type === 'way') {
        const power = tags.power || 'line';
        if (LINE_POWER.has(power)) {
          const tagged = parseMaxVoltage(tags.voltage);
          if (tagged != null) {
            wayVoltage.set(el.id, tagged);
            applyNodeVoltage(el.nodes || [], tags.voltage);
          } else {
            untaggedLineWays.push(el);
          }
        } else if ((power === 'substation' || power === 'plant') && tags.voltage) {
          applyNodeVoltage(el.nodes || [], tags.voltage);
          const mv = substationDistributionVoltage(tags.voltage);
          const c = wayCentroidFromGeometry(el.geometry);
          if (mv != null && c) substationSites.push({ lat: c.lat, lon: c.lon, mv });
        }
      } else if (el.type === 'node') {
        if (infraNodePowers.has(tags.power) && tags.voltage) {
          applyNodeVoltage([el.id], tags.voltage);
          const mv = substationDistributionVoltage(tags.voltage);
          if (mv != null && el.lat != null && el.lon != null) {
            substationSites.push({ lat: el.lat, lon: el.lon, mv });
          }
        }
      } else if (el.type === 'relation' && (tags.power === 'substation' || tags.power === 'plant') && tags.voltage) {
        const mv = substationDistributionVoltage(tags.voltage);
        const pts = [];
        (el.members || []).forEach((member) => {
          (member.geometry || []).forEach((p) => pts.push(p));
        });
        if (mv != null && pts.length) {
          let lat = 0;
          let lon = 0;
          pts.forEach((p) => {
            lat += p.lat;
            lon += p.lon;
          });
          substationSites.push({ lat: lat / pts.length, lon: lon / pts.length, mv });
        }
        (el.members || []).forEach((member) => {
          if (member.type === 'way' && wayNodesById.has(member.ref)) {
            applyNodeVoltage(wayNodesById.get(member.ref), tags.voltage);
          }
        });
      }
    });

    let changed = true;
    while (changed) {
      changed = false;
      untaggedLineWays.forEach((el) => {
        if (wayVoltage.has(el.id)) return;
        let maxV = null;
        (el.nodes || []).forEach((nodeId) => {
          const v = nodeVoltage.get(nodeId);
          if (v != null && (maxV == null || v > maxV)) maxV = v;
        });
        if (maxV != null) {
          wayVoltage.set(el.id, maxV);
          applyNodeVoltage(el.nodes || [], String(maxV));
          changed = true;
        }
      });
    }

    untaggedLineWays.forEach((el) => {
      if (wayVoltage.has(el.id) || !el.geometry || el.geometry.length < 2) return;
      const endpoints = [el.geometry[0], el.geometry[el.geometry.length - 1]];
      let bestMv = null;
      let bestDist = SPATIAL_INFERENCE_MAX_M + 1;
      endpoints.forEach((ep) => {
        substationSites.forEach((site) => {
          const d = haversineM(ep.lat, ep.lon, site.lat, site.lon);
          if (d < bestDist) {
            bestDist = d;
            bestMv = site.mv;
          }
        });
      });
      if (bestMv != null && bestDist <= SPATIAL_INFERENCE_MAX_M) {
        wayVoltage.set(el.id, bestMv);
      }
    });

    return { nodeVoltage, wayVoltage };
  }

  function mergeNodeVoltageMaps(primary, secondary) {
    const merged = new Map(primary);
    secondary.forEach((v, k) => {
      const prev = merged.get(k);
      if (prev == null || v > prev) merged.set(k, v);
    });
    return merged;
  }

  function tierLineStyle(tier) {
    const style = {
      color: tier.color,
      weight: tier.weight,
      opacity: tier.opacity,
      lineCap: 'round',
      lineJoin: 'round',
    };
    if (tier.dashArray) style.dashArray = tier.dashArray;
    return style;
  }

  function powerLineStyle(props) {
    const tier = getVoltageTier(props);
    return tierLineStyle(tier);
  }

  function powerLineLabel(props) {
    const tier = getVoltageTier(props);
    return tier.label;
  }

  function formatVoltageKv(maxV) {
    if (maxV == null) return null;
    if (maxV >= 1000) return (maxV / 1000) + ' kV';
    return maxV + ' V';
  }

  const LINE_POWER_TYPES = new Set(['line', 'minor_line', 'cable', 'small_line']);

  function buildTowerVoltageByNodeId(osmData) {
    const byNodeId = new Map();
    (osmData.elements || []).forEach((el) => {
      if (el.type !== 'way') return;
      const power = el.tags?.power;
      if (!LINE_POWER_TYPES.has(power)) return;
      const maxV = parseMaxVoltage(el.tags?.voltage);
      if (maxV == null) return;
      (el.nodes || []).forEach((nodeId) => {
        const prev = byNodeId.get(nodeId);
        if (prev == null || maxV > prev) byNodeId.set(nodeId, maxV);
      });
    });
    return byNodeId;
  }

  function towerVoltageValue(props) {
    const tagged = parseMaxVoltage(props.voltage);
    if (tagged != null) return tagged;
    if (props._lineVoltage != null) return props._lineVoltage;
    return null;
  }

  function isTowerPower(props) {
    const p = props.power;
    return p === 'tower' || p === 'pole' || p === 'portal';
  }

  function towerTypeLabel(props) {
    const kind = formatTagLabel(props.power || 'tower');
    const maxV = towerVoltageValue(props);
    if (maxV != null) return formatVoltageKv(maxV) + ' ' + kind;
    return INFRA_LAYERS['infra-tower'].shortLabel;
  }

  function towerDisplayName(props, fallback) {
    const name = infraDisplayName(props);
    if (name) return name;
    const maxV = towerVoltageValue(props);
    const kind = formatTagLabel(props.power || 'tower');
    if (maxV != null) return formatVoltageKv(maxV) + ' ' + kind;
    return fallback;
  }

  function enrichInfraTowerVoltages(infra, voltageByNodeId) {
    (infra['infra-tower'] || []).forEach((feature) => {
      const props = feature.properties || {};
      const nodeId = props._osmNodeId;
      if (nodeId == null) return;
      const lineV = voltageByNodeId.get(nodeId);
      if (lineV == null) return;
      props._lineVoltage = lineV;
      if (!props.voltage) props.voltage = String(lineV);
    });
  }

  function voltageBadgeText(props) {
    const maxV = parseMaxVoltage(props.voltage);
    if (maxV != null) return formatVoltageKv(maxV);
    const power = props.power || 'line';
    if (power === 'cable') return 'Cable';
    if (power === 'minor_line' || power === 'small_line') return 'LV';
    return '?';
  }

  function flattenLatLngs(latlngs, out) {
    if (!latlngs || !latlngs.length) return out || [];
    const list = out || [];
    if (latlngs[0] instanceof L.LatLng) {
      latlngs.forEach((ll) => list.push(ll));
      return list;
    }
    latlngs.forEach((part) => flattenLatLngs(part, list));
    return list;
  }

  function lineMidLatLng(latlngs) {
    const flat = flattenLatLngs(latlngs);
    if (flat.length < 2) return flat[0] || null;
    let total = 0;
    const segLens = [];
    for (let i = 0; i < flat.length - 1; i++) {
      const d = flat[i].distanceTo(flat[i + 1]);
      segLens.push(d);
      total += d;
    }
    if (total <= 0) return flat[Math.floor(flat.length / 2)];
    let half = total / 2;
    for (let i = 0; i < segLens.length; i++) {
      if (half <= segLens[i]) {
        const t = segLens[i] > 0 ? half / segLens[i] : 0;
        return L.latLng(
          flat[i].lat + t * (flat[i + 1].lat - flat[i].lat),
          flat[i].lng + t * (flat[i + 1].lng - flat[i].lng)
        );
      }
      half -= segLens[i];
    }
    return flat[Math.floor(flat.length / 2)];
  }

  function linePixelLength(map, latlngs) {
    const flat = flattenLatLngs(latlngs);
    if (flat.length < 2) return 0;
    let len = 0;
    for (let i = 0; i < flat.length - 1; i++) {
      const a = map.latLngToContainerPoint(flat[i]);
      const b = map.latLngToContainerPoint(flat[i + 1]);
      len += a.distanceTo(b);
    }
    return len;
  }

  const TIER_LABEL_MIN_ZOOM = {
    'tx-500': 12,
    'tx-275': 12,
    'tx-132': 13,
    'tx-other': 13,
    'dist-66': 14,
    'dist-33': 14,
    'dist-11': 15,
    'dist-lv': 15,
    'dist-minor': 15,
    'dist-cable': 15,
    'dist-unknown': 15,
  };

  const TIER_LABEL_PRIORITY = [
    'tx-500', 'tx-275', 'tx-132', 'tx-other',
    'dist-66', 'dist-33', 'dist-11', 'dist-lv', 'dist-minor', 'dist-cable', 'dist-unknown',
  ];

  function makePowerBadgeIcon(text, color) {
    const safe = String(text).replace(/[<>&"]/g, '');
    return L.divIcon({
      className: 'power-line-badge-icon',
      html:
        '<span class="power-line-badge" style="border-color:' + color + ';color:' + color + '">' +
        safe +
        '</span>',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }

  function createPowerLineLabelManager(map, layerRefs) {
    if (!map.getPane('powerLineLabels')) {
      map.createPane('powerLineLabels');
      map.getPane('powerLineLabels').style.zIndex = 650;
    }

    const labelGroup = L.layerGroup([], { pane: 'powerLineLabels' }).addTo(map);
    const lineItems = [];
    let refreshTimer = null;

    function minZoomForTier(tierId) {
      return TIER_LABEL_MIN_ZOOM[tierId] ?? 15;
    }

    function collectFromTierLayer(tierId, geoLayer) {
      geoLayer.eachLayer((polyline) => {
        const props = polyline.feature && polyline.feature.properties;
        if (!props) return;
        const latlngs = polyline.getLatLngs();
        const mid = lineMidLatLng(latlngs);
        if (!mid) return;
        const tier = getVoltageTier(props);
        lineItems.push({
          tierId,
          latlng: mid,
          latlngs,
          text: voltageBadgeText(props),
          color: tier.color,
        });
      });
    }

    function refresh() {
      labelGroup.clearLayers();
      const zoom = map.getZoom();
      const mapBounds = map.getBounds().pad(0.08);
      const placed = [];
      const maxLabels = zoom >= 16 ? 340 : zoom >= 15 ? 280 : zoom >= 14 ? 200 : zoom >= 13 ? 140 : 80;

      const candidates = lineItems.filter((item) => {
        const tierLayer = layerRefs[item.tierId];
        if (!tierLayer || !map.hasLayer(tierLayer)) return false;
        if (zoom < minZoomForTier(item.tierId)) return false;
        if (!mapBounds.contains(item.latlng)) return false;
        if (linePixelLength(map, item.latlngs) < 52) return false;
        return true;
      });

      candidates.sort(
        (a, b) => TIER_LABEL_PRIORITY.indexOf(a.tierId) - TIER_LABEL_PRIORITY.indexOf(b.tierId)
      );

      let count = 0;
      candidates.forEach((item) => {
        if (count >= maxLabels) return;
        const pt = map.latLngToContainerPoint(item.latlng);
        if (placed.some((p) => p.distanceTo(pt) < 30)) return;

        L.marker(item.latlng, {
          icon: makePowerBadgeIcon(item.text, item.color),
          interactive: false,
          keyboard: false,
          pane: 'powerLineLabels',
        }).addTo(labelGroup);

        placed.push(pt);
        count += 1;
      });
    }

    function scheduleRefresh() {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(refresh, 40);
    }

    map.on('zoomend moveend', scheduleRefresh);
    window.addEventListener('rtl3d:viewport-resize', scheduleRefresh);

    return { collectFromTierLayer, refresh, scheduleRefresh };
  }

  /** Infrastructure layer definitions (non-line OSM power features) */
  const INFRA_LAYERS = {
    'infra-substation': {
      label: 'Substations',
      shortLabel: 'Substations',
      color: '#f97316',
      kind: 'area',
      minZoom: 13,
      minZoomPoint: 15,
      weight: 2,
      fillOpacity: 0.22,
      pointRadius: 4,
    },
    'infra-plant': {
      label: 'Power plants',
      shortLabel: 'Power plants',
      color: '#16a34a',
      kind: 'area',
      minZoom: 13,
      minZoomPoint: 15,
      weight: 2,
      fillOpacity: 0.2,
      pointRadius: 4,
    },
    'infra-generator': {
      label: 'Generators',
      shortLabel: 'Generators',
      color: '#22c55e',
      kind: 'point',
      minZoom: 14,
      pointRadius: 5,
    },
    'infra-transformer': {
      label: 'Transformers',
      shortLabel: 'Transformers',
      color: '#a855f7',
      kind: 'point',
      minZoom: 15,
      pointRadius: 4,
    },
    'infra-switch': {
      label: 'Switchgear & terminals',
      shortLabel: 'Switchgear',
      color: '#eab308',
      kind: 'point',
      minZoom: 15,
      pointRadius: 4,
    },
    'infra-tower': {
      label: 'Towers & poles',
      shortLabel: 'Towers/poles',
      color: '#78716c',
      kind: 'point',
      minZoom: 16,
      pointRadius: 2.5,
    },
    'infra-other': {
      label: 'Other power assets',
      shortLabel: 'Other',
      color: '#94a3b8',
      kind: 'point',
      minZoom: 16,
      pointRadius: 3,
    },
  };

  /** Point-only companion layers toggled together with their area parent */
  const INFRA_LINKED = {
    'infra-substation': ['infra-substation-pt'],
    'infra-plant': ['infra-plant-pt'],
  };

  const LINE_POWER = new Set(['line', 'cable', 'minor_line', 'small_line']);
  const INFRA_LAYER_IDS = Object.keys(INFRA_LAYERS);
  const TOWER_POWER_TYPES = new Set([
    'tower', 'pole', 'portal', 'catenary_mast', 'insulator', 'marker', 'guy', 'line_attachment',
    'historic:tower',
  ]);
  const SWITCH_POWER_TYPES = new Set([
    'switch', 'switchgear', 'terminal', 'connection', 'compensator', 'converter',
    'isolator', 'disconnector', 'circuit_breaker', 'busbar', 'bay',
  ]);
  const GENERATOR_POWER_TYPES = new Set(['generator', 'inverter', 'solar_photovoltaic_panel']);

  function getLayerMeta(layerId) {
    if (layerId.endsWith('-pt')) {
      return INFRA_LAYERS[layerId.slice(0, -3)] || null;
    }
    return VOLTAGE_TIERS[layerId] || INFRA_LAYERS[layerId] || null;
  }

  function splitInfraFeatures(features) {
    const polygons = [];
    const points = [];
    features.forEach((f) => {
      if (f.geometry.type === 'Point') points.push(f);
      else polygons.push(f);
    });
    return { polygons, points };
  }

  function classifyInfraLayer(tags) {
    const power = tags.power;
    if (!power || LINE_POWER.has(power)) return null;
    if (power === 'substation') return 'infra-substation';
    if (power === 'plant') return 'infra-plant';
    if (GENERATOR_POWER_TYPES.has(power)) return 'infra-generator';
    if (power === 'transformer') return 'infra-transformer';
    if (TOWER_POWER_TYPES.has(power)) return 'infra-tower';
    if (SWITCH_POWER_TYPES.has(power)) return 'infra-switch';
    return 'infra-other';
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function infraDisplayName(tags) {
    return (
      tags.name ||
      tags['name:en'] ||
      tags['name:ms'] ||
      tags.ref ||
      null
    );
  }

  function formatTagLabel(value) {
    return String(value).replace(/_/g, ' ');
  }

  /** Derive in-service / disused / construction status from OSM lifecycle tags */
  function getOperationalStatus(tags) {
    const keys = Object.keys(tags);

    if (keys.some((k) => k.startsWith('demolished:power'))) {
      return { label: 'Demolished / removed', cssClass: 'pwr-status-demolished' };
    }
    if (keys.some((k) => k.startsWith('construction:power'))) {
      return { label: 'Under construction', cssClass: 'pwr-status-construction' };
    }
    if (keys.some((k) => k.startsWith('disused:power') || k.startsWith('abandoned:power'))) {
      return { label: 'Disused / out of service', cssClass: 'pwr-status-disused' };
    }
    if (tags.disused === 'yes') {
      return { label: 'Disused / out of service', cssClass: 'pwr-status-disused' };
    }
    if (tags.abandoned === 'yes') {
      return { label: 'Abandoned', cssClass: 'pwr-status-disused' };
    }
    if (tags.construction === 'yes' && keys.some((k) => k.includes('power'))) {
      return { label: 'Under construction', cssClass: 'pwr-status-construction' };
    }
    if (tags.operational_status) {
      const raw = String(tags.operational_status).toLowerCase();
      if (/disused|inactive|closed|decommission|retired/.test(raw)) {
        return { label: 'Status: ' + formatTagLabel(tags.operational_status), cssClass: 'pwr-status-disused' };
      }
      if (/construction|planned|proposed/.test(raw)) {
        return { label: 'Status: ' + formatTagLabel(tags.operational_status), cssClass: 'pwr-status-construction' };
      }
      return { label: 'Status: ' + formatTagLabel(tags.operational_status), cssClass: 'pwr-status-active' };
    }
    if (tags.line_management === 'termination') {
      return { label: 'Line terminated / disconnected', cssClass: 'pwr-status-disused' };
    }

    return {
      label: 'In service (no disused tag in OSM)',
      cssClass: 'pwr-status-active',
      assumed: true,
    };
  }

  function statusPopupLine(tags) {
    const status = getOperationalStatus(tags);
    let html = '<span class="pwr-status ' + status.cssClass + '">' + escapeHtml(status.label) + '</span>';
    if (status.assumed) {
      html += '<br><span class="pwr-status-note">OSM mappers often omit status when equipment is active.</span>';
    }
    return html;
  }

  function popupLatLng(layerRef) {
    if (layerRef._latlng) return layerRef._latlng;
    if (layerRef.getLatLng) return layerRef.getLatLng();
    if (layerRef.getBounds && layerRef.getBounds().isValid()) {
      return layerRef.getBounds().getCenter();
    }
    return null;
  }

  function formatCoords(latlng) {
    if (!latlng) return null;
    const lat = latlng.lat;
    const lng = latlng.lng;
    const latHem = lat >= 0 ? 'N' : 'S';
    const lngHem = lng >= 0 ? 'E' : 'W';
    return Math.abs(lat).toFixed(5) + '°' + latHem + ', ' + Math.abs(lng).toFixed(5) + '°' + lngHem;
  }

  function buildInfraPopupHtml(props, latlng) {
    const parts = [];
    const name = infraDisplayName(props);
    const tower = isTowerPower(props);
    const maxV = tower ? towerVoltageValue(props) : parseMaxVoltage(props.voltage);

    if (tower && maxV != null) {
      parts.push(
        '<strong class="pwr-popup-name">' +
          escapeHtml(formatVoltageKv(maxV) + ' ' + formatTagLabel(props.power)) +
          '</strong>'
      );
      if (name) {
        parts.push('Name: ' + escapeHtml(name));
      }
    } else if (name) {
      parts.push('<strong class="pwr-popup-name">' + escapeHtml(name) + '</strong>');
    } else {
      const kind = props.power ? formatTagLabel(props.power) : 'facility';
      parts.push('<strong class="pwr-popup-name">Unnamed ' + escapeHtml(kind) + '</strong>');
    }

    const coords = formatCoords(latlng);
    if (coords) parts.push('Coordinates: ' + escapeHtml(coords));

    parts.push(statusPopupLine(props));

    if (props.power) parts.push('Type: ' + escapeHtml(formatTagLabel(props.power)));
    if (props.substation) {
      parts.push('Role: ' + escapeHtml(formatTagLabel(props.substation)) + ' substation');
    }
    if (maxV != null) {
      parts.push('Voltage: ' + escapeHtml(formatVoltageKv(maxV)));
      if (tower && !parseMaxVoltage(props.voltage) && props._lineVoltage != null) {
        parts.push(
          '<span class="pwr-status-note">Voltage inferred from attached power line in OSM.</span>'
        );
      }
    } else if (props.voltage) {
      parts.push('Voltage: ' + escapeHtml(props.voltage));
    }
    if (props.plant_source) parts.push('Source: ' + escapeHtml(formatTagLabel(props.plant_source)));
    if (props.plant_method) parts.push('Method: ' + escapeHtml(formatTagLabel(props.plant_method)));
    if (props.operator) parts.push('Operator: ' + escapeHtml(props.operator));
    if (props.ref && props.ref !== name) parts.push('Ref: ' + escapeHtml(props.ref));
    if (props.start_date) parts.push('Start date: ' + escapeHtml(props.start_date));
    if (props.end_date) parts.push('End date: ' + escapeHtml(props.end_date));

    return parts.join('<br>');
  }

  function buildPowerLinePopupHtml(props, latlng) {
    const tier = getVoltageTier(props);
    const parts = [];
    const name = infraDisplayName(props);
    if (name) {
      parts.push('<strong class="pwr-popup-name">' + escapeHtml(name) + '</strong>');
    }
    parts.push('<strong>' + escapeHtml(tier.label) + '</strong>');

    const coords = formatCoords(latlng);
    if (coords) parts.push('Coordinates: ' + escapeHtml(coords));

    parts.push(statusPopupLine(props));

    const maxV = parseMaxVoltage(props.voltage);
    if (maxV != null) {
      parts.push('Voltage: ' + escapeHtml(formatVoltageKv(maxV)));
      if (props._voltageInferred) {
        parts.push('<em>Inferred from nearby substation</em>');
      }
    } else if (props.voltage) parts.push('Voltage: ' + escapeHtml(props.voltage));
    if (props.circuits) parts.push('Circuits: ' + escapeHtml(props.circuits));
    if (props.cables) parts.push('Cables: ' + escapeHtml(props.cables));
    if (props.operator) parts.push('Operator: ' + escapeHtml(props.operator));
    if (props.ref && props.ref !== name) parts.push('Ref: ' + escapeHtml(props.ref));

    return parts.join('<br>');
  }

  function bindInfraPopup(layerRef, props) {
    layerRef.bindPopup(function () {
      return buildInfraPopupHtml(props, popupLatLng(this));
    }, { maxWidth: 300, className: 'power-feature-popup' });
  }

  function bindPowerPopup(layerRef, props) {
    if (props._layerId && props._layerId.startsWith('infra-')) {
      bindInfraPopup(layerRef, props);
      return;
    }
    layerRef.bindPopup(function () {
      return buildPowerLinePopupHtml(props, popupLatLng(this));
    }, { maxWidth: 300, className: 'power-feature-popup' });
  }

  function tierShortLabel(label) {
    return label
      .replace(' transmission', ' TX')
      .replace(' distribution', '')
      .replace('Underground cable', 'Cable')
      .replace('LV line (minor_line)', 'LV minor_line')
      .replace('MV/LV (voltage not tagged)', 'Untagged MV/LV');
  }

  function osmWaysByTier(osmData, voltageCtx) {
    const tiers = {};
    Object.keys(VOLTAGE_TIERS).forEach((id) => {
      tiers[id] = [];
    });
    (osmData.elements || []).forEach((el) => {
      if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) return;
      const tags = el.tags || {};
      if (!LINE_POWER.has(tags.power || 'line')) return;
      let maxV = parseMaxVoltage(tags.voltage);
      let inferred = false;
      if (maxV == null && voltageCtx) {
        const inferredV = voltageCtx.wayVoltage.get(el.id);
        if (inferredV != null) {
          maxV = inferredV;
          inferred = true;
        }
      }
      const tier = getVoltageTier(tags, maxV);
      tiers[tier.id].push({
        type: 'Feature',
        properties: {
          ...tags,
          _class: tier.kind,
          _tierId: tier.id,
          ...(inferred && maxV != null
            ? { voltage: String(maxV), _voltageInferred: true }
            : {}),
        },
        geometry: {
          type: 'LineString',
          coordinates: el.geometry.map((p) => [p.lon, p.lat]),
        },
      });
    });
    return tiers;
  }

  function closeRing(coords) {
    if (coords.length < 3) return coords;
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) return coords;
    return coords.concat([first]);
  }

  function wayToAreaFeature(el, tags, layerId) {
    if (!el.geometry || el.geometry.length < 3) return null;
    const ring = closeRing(el.geometry.map((p) => [p.lon, p.lat]));
    return {
      type: 'Feature',
      properties: { ...tags, _layerId: layerId },
      geometry: { type: 'Polygon', coordinates: [ring] },
    };
  }

  function relationToAreaFeatures(el, tags, layerId) {
    if (!el.members || !el.members.length) return [];
    const outers = [];
    el.members.forEach((member) => {
      if (member.role === 'inner') return;
      if (!member.geometry || member.geometry.length < 3) return;
      outers.push(closeRing(member.geometry.map((p) => [p.lon, p.lat])));
    });
    if (!outers.length) return [];
    if (outers.length === 1) {
      return [{
        type: 'Feature',
        properties: { ...tags, _layerId: layerId },
        geometry: { type: 'Polygon', coordinates: outers },
      }];
    }
    return [{
      type: 'Feature',
      properties: { ...tags, _layerId: layerId },
      geometry: { type: 'MultiPolygon', coordinates: outers.map((ring) => [ring]) },
    }];
  }

  function nodeToPointFeature(el, tags, layerId) {
    if (el.lat == null || el.lon == null) return null;
    return {
      type: 'Feature',
      properties: { ...tags, _layerId: layerId, _osmNodeId: el.id },
      geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
    };
  }

  const RISK_INFRA_IDS = [
    'infra-substation',
    'infra-plant',
    'infra-generator',
    'infra-transformer',
    'infra-switch',
    'infra-tower',
  ];

  const RISK_LINE_TIER_IDS = ['tx-500', 'tx-275', 'tx-132', 'tx-other', 'dist-66', 'dist-33'];

  function featureCentroid(feature) {
    const geom = feature.geometry;
    if (!geom) return null;
    if (geom.type === 'Point') {
      return { lat: geom.coordinates[1], lng: geom.coordinates[0] };
    }
    if (geom.type === 'Polygon') {
      const ring = geom.coordinates[0];
      if (!ring || ring.length < 3) return null;
      const n = ring.length - 1;
      let latSum = 0;
      let lngSum = 0;
      for (let i = 0; i < n; i++) {
        lngSum += ring[i][0];
        latSum += ring[i][1];
      }
      return { lat: latSum / n, lng: lngSum / n };
    }
    if (geom.type === 'MultiPolygon') {
      const first = geom.coordinates[0];
      if (!first || !first[0]) return null;
      return featureCentroid({ geometry: { type: 'Polygon', coordinates: first } });
    }
    return null;
  }

  function buildInfraRiskIndex(infra, tiers) {
    const targets = [];
    RISK_INFRA_IDS.forEach((layerId) => {
      const meta = INFRA_LAYERS[layerId];
      (infra[layerId] || []).forEach((feature) => {
        const center = featureCentroid(feature);
        if (!center) return;
        const props = feature.properties || {};
        const isTower = layerId === 'infra-tower';
        const displayName = isTower
          ? towerDisplayName(props, meta.shortLabel)
          : infraDisplayName(props) || meta.shortLabel;
        targets.push({
          kind: 'point',
          lat: center.lat,
          lng: center.lng,
          name: displayName,
          type: props.power || layerId.replace('infra-', ''),
          typeLabel: isTower ? towerTypeLabel(props) : meta.shortLabel,
          layerId,
        });
      });
    });

    RISK_LINE_TIER_IDS.forEach((tierId) => {
      const meta = VOLTAGE_TIERS[tierId];
      if (!meta) return;
      (tiers[tierId] || []).forEach((feature) => {
        const props = feature.properties || {};
        const name = infraDisplayName(props);
        targets.push({
          kind: 'line',
          feature,
          name: name || tierShortLabel(meta.label),
          type: props.power || 'line',
          typeLabel: tierShortLabel(meta.label),
          layerId: tierId,
        });
      });
    });

    return targets;
  }

  function osmInfraByLayer(osmData) {
    const layers = {};
    INFRA_LAYER_IDS.forEach((id) => {
      layers[id] = [];
    });

    (osmData.elements || []).forEach((el) => {
      const tags = el.tags || {};
      const layerId = classifyInfraLayer(tags);
      if (!layerId) return;

      if (el.type === 'node') {
        const feat = nodeToPointFeature(el, tags, layerId);
        if (feat) layers[layerId].push(feat);
      } else if (el.type === 'way') {
        const meta = INFRA_LAYERS[layerId];
        if (meta.kind === 'area') {
          const feat = wayToAreaFeature(el, tags, layerId);
          if (feat) layers[layerId].push(feat);
        } else {
          const feat = nodeToPointFeature(
            { lat: el.geometry[0].lat, lon: el.geometry[0].lon },
            tags,
            layerId
          );
          if (feat) layers[layerId].push(feat);
        }
      } else if (el.type === 'relation') {
        relationToAreaFeatures(el, tags, layerId).forEach((feat) => layers[layerId].push(feat));
      }
    });

    return layers;
  }

  function infraLayerStyle(layerId) {
    const meta = INFRA_LAYERS[layerId];
    return {
      color: meta.color,
      weight: meta.weight || 2,
      opacity: 0.9,
      fillColor: meta.color,
      fillOpacity: meta.fillOpacity || 0.2,
    };
  }

  function infraPointToLayer(feature, latlng, layerId, paneName) {
    const meta = INFRA_LAYERS[layerId];
    let color = meta.color;
    if (layerId === 'infra-tower') {
      const maxV = towerVoltageValue(feature.properties || {});
      if (maxV != null) {
        color = getVoltageTier({ voltage: String(maxV), power: 'line' }).color;
      }
    }
    return L.circleMarker(latlng, {
      radius: meta.pointRadius || meta.radius || 4,
      color,
      fillColor: color,
      fillOpacity: 0.88,
      weight: 1,
      opacity: 0.95,
      pane: paneName || undefined,
    });
  }

  function createInfraPolygonLayer(features, layerId, paneName) {
    if (!features.length) return null;
    return L.geoJSON(
      { type: 'FeatureCollection', features },
      {
        pane: paneName || undefined,
        style: infraLayerStyle(layerId),
        onEachFeature(f, layerRef) {
          bindInfraPopup(layerRef, f.properties);
        },
      }
    );
  }

  function createInfraPointLayer(features, layerId, paneName) {
    if (!features.length) return null;
    return L.geoJSON(
      { type: 'FeatureCollection', features },
      {
        pane: paneName || undefined,
        pointToLayer(f, latlng) {
          return infraPointToLayer(f, latlng, layerId, paneName);
        },
        onEachFeature(f, layerRef) {
          bindInfraPopup(layerRef, f.properties);
        },
      }
    );
  }

  function createGeoJsonLayer(features, layerId, isLine, paneName) {
    if (!features.length) return null;
    if (isLine) {
      return L.geoJSON(
        { type: 'FeatureCollection', features },
        {
          pane: paneName || undefined,
          style(f) {
            return powerLineStyle(f.properties);
          },
          onEachFeature(f, layerRef) {
            bindPowerPopup(layerRef, f.properties);
          },
        }
      );
    }

    if (INFRA_LAYERS[layerId]) {
      const meta = INFRA_LAYERS[layerId];
      if (meta.kind === 'point') return createInfraPointLayer(features, layerId);
      const { polygons } = splitInfraFeatures(features);
      return createInfraPolygonLayer(polygons, layerId);
    }

    return null;
  }

  function createLayerVisibilityController(map, layerRefs, layerMeta) {
    const visibility = {};

    Object.keys(layerRefs).forEach((id) => {
      visibility[id] = true;
    });

    function refresh() {
      const zoom = map.getZoom();
      Object.keys(layerRefs).forEach((id) => {
        const layer = layerRefs[id];
        if (!layer) return;
        const minZoom = layerMeta[id]?.minZoom ?? 0;
        const show = visibility[id] !== false && zoom >= minZoom;
        if (show) {
          if (!map.hasLayer(layer)) map.addLayer(layer);
        } else if (map.hasLayer(layer)) {
          map.removeLayer(layer);
        }
      });
    }

    function setVisible(layerId, visible) {
      visibility[layerId] = visible;
      (INFRA_LINKED[layerId] || []).forEach((linkedId) => {
        visibility[linkedId] = visible;
      });
      refresh();
    }

    map.on('zoomend', refresh);

    return { refresh, setVisible, visibility };
  }

  const TX_TIER_IDS = ['tx-500', 'tx-275', 'tx-132', 'tx-other'];
  const DIST_TIER_IDS = ['dist-66', 'dist-33', 'dist-11', 'dist-lv', 'dist-minor', 'dist-cable', 'dist-unknown'];

  function tierSwatchStyle(tier) {
    if (tier.dashArray) {
      return 'border-color:' + tier.color;
    }
    return 'background:' + tier.color;
  }

  function createPowerLayersControl(map, layerRefs, sections, visibilityCtrl, onLayerChange) {
    const PowerLayersControl = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-control power-layers-control');
        const toggle = L.DomUtil.create('button', 'power-layers-toggle', container);
        toggle.type = 'button';
        toggle.title = 'Layers';
        toggle.setAttribute('aria-label', 'Toggle power line layers');
        toggle.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
          '<path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zm0 7L2 4v3l10 5 10-5V4l-10 5zm0 4.5L2 8.5v3L12 17l10-5.5v-3L12 13.5z"/>' +
          '</svg>';

        const panel = L.DomUtil.create('div', 'power-layers-panel', container);
        panel.setAttribute('data-no-drag-scroll', '');
        const title = L.DomUtil.create('div', 'power-layers-title', panel);
        title.textContent = 'Layers';

        const checkboxes = [];

        function setLayerVisible(layerId, visible) {
          if (!layerRefs[layerId] && !(INFRA_LINKED[layerId] || []).some((id) => layerRefs[id])) return;
          visibilityCtrl.setVisible(layerId, visible);
          if (onLayerChange) onLayerChange();
        }

        sections.forEach((section) => {
          const heading = L.DomUtil.create('div', 'power-layers-heading', panel);
          heading.textContent = section.heading;

          section.ids.forEach((id) => {
            const meta = getLayerMeta(id);
            if (!meta) return;
            const row = L.DomUtil.create('label', 'power-layers-row', panel);
            const cb = L.DomUtil.create('input', '', row);
            cb.type = 'checkbox';
            cb.checked = true;
            cb.dataset.layerId = id;

            let swatchClass = 'power-layers-swatch';
            if (meta.dashArray) swatchClass += ' dashed';
            else if (meta.kind === 'point') swatchClass += ' point';
            else if (meta.kind === 'area') swatchClass += ' area';

            const swatch = L.DomUtil.create('span', swatchClass, row);
            if (meta.kind === 'point') {
              swatch.style.background = meta.color;
            } else {
              swatch.style.cssText = tierSwatchStyle(meta);
            }

            const text = L.DomUtil.create('span', 'power-layers-label', row);
            text.textContent = meta.shortLabel || tierShortLabel(meta.label);

            cb.addEventListener('change', () => setLayerVisible(id, cb.checked));
            checkboxes.push(cb);
          });
        });

        if (layerRefs.stations) {
          const heading = L.DomUtil.create('div', 'power-layers-heading', panel);
          heading.textContent = 'Stations';

          const row = L.DomUtil.create('label', 'power-layers-row', panel);
          const cb = L.DomUtil.create('input', '', row);
          cb.type = 'checkbox';
          cb.checked = true;
          cb.dataset.layerId = 'stations';

          const swatch = L.DomUtil.create('span', 'power-layers-swatch station', row);
          const text = L.DomUtil.create('span', 'power-layers-label', row);
          text.textContent = 'Observation stations';

          cb.addEventListener('change', () => setLayerVisible('stations', cb.checked));
          checkboxes.push(cb);
        }

        const actions = L.DomUtil.create('div', 'power-layers-actions', panel);
        const allBtn = L.DomUtil.create('button', 'power-layers-action', actions);
        allBtn.type = 'button';
        allBtn.textContent = 'All on';
        const noneBtn = L.DomUtil.create('button', 'power-layers-action', actions);
        noneBtn.type = 'button';
        noneBtn.textContent = 'All off';

        allBtn.addEventListener('click', () => {
          checkboxes.forEach((cb) => {
            cb.checked = true;
            setLayerVisible(cb.dataset.layerId, true);
          });
        });
        noneBtn.addEventListener('click', () => {
          checkboxes.forEach((cb) => {
            cb.checked = false;
            setLayerVisible(cb.dataset.layerId, false);
          });
        });

        L.DomEvent.on(toggle, 'click', L.DomEvent.stopPropagation)
          .on(toggle, 'click', L.DomEvent.preventDefault)
          .on(toggle, 'click', () => {
            container.classList.toggle('expanded');
            toggle.setAttribute('aria-expanded', container.classList.contains('expanded') ? 'true' : 'false');
          });

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        return container;
      },
    });

    return new PowerLayersControl();
  }

  function updatePowerLegend(mapEl, usedTierIds) {
    const legend = mapEl.closest('.map-wrap')?.querySelector('.map-legend-power');
    if (!legend) return;

    const used = new Set(usedTierIds);

    function tierSpans(ids) {
      return ids
        .filter((id) => used.has(id))
        .map((id) => {
          const t = VOLTAGE_TIERS[id];
          const isDash = !!t.dashArray;
          const iconClass = 'leg pwr-v' + (isDash ? ' dashed' : '');
          const iconStyle = tierSwatchStyle(t);
          const short = tierShortLabel(t.label);
          return (
            '<span><i class="' + iconClass + '" style="' + iconStyle + '"></i>' + short + '</span>'
          );
        })
        .join('');
    }

    const txHtml = tierSpans(TX_TIER_IDS);
    const distHtml = tierSpans(DIST_TIER_IDS);

    legend.innerHTML =
      (txHtml ? '<div class="map-legend-group"><span class="map-legend-heading">Transmission</span>' + txHtml + '</div>' : '') +
      (distHtml ? '<div class="map-legend-group"><span class="map-legend-heading">Distribution</span>' + distHtml + '</div>' : '') +
      '<span><i class="leg lf-vhf"></i> Observation stations</span>';

    if (typeof window.initDragScroll === 'function') {
      window.initDragScroll(legend);
    }
  }

  function bboxMatchesCached(metaBbox, bbox) {
    if (!metaBbox) return true;
    const keys = ['s', 'w', 'n', 'e'];
    return keys.every((k) => Math.abs(Number(metaBbox[k]) - Number(bbox[k])) < 1e-6);
  }

  function normalizeOsmPayload(data) {
    if (!data) return null;
    if (Array.isArray(data.elements)) {
      return { elements: data.elements, meta: data.meta || null };
    }
    if (data.elements && typeof data.elements === 'object') {
      return { elements: data.elements, meta: data.meta || null };
    }
    return null;
  }

  async function fetchLocalOsmPowerInfrastructure(bbox) {
    try {
      const resp = await fetch(LOCAL_OSM_POWER_URL, { cache: 'force-cache' });
      if (!resp.ok) return null;
      const data = await resp.json();
      const normalized = normalizeOsmPayload(data);
      if (!normalized || !normalized.elements.length) return null;
      const meta = normalized.meta;
      if (meta) {
        if (meta.cacheVersion && meta.cacheVersion !== OSM_CACHE_VERSION) return null;
        if (!bboxMatchesCached(meta.bbox, bbox)) return null;
      }
      return { elements: normalized.elements };
    } catch (_) {
      return null;
    }
  }

  async function fetchOsmPowerInfrastructure(bbox) {
    const cacheKey = `rtl3d-power-v${OSM_CACHE_VERSION}-${bbox.s},${bbox.w},${bbox.n},${bbox.e}`;

    const local = await fetchLocalOsmPowerInfrastructure(bbox);
    if (local) {
      local._fromLocalFile = true;
      return local;
    }

    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) { /* ignore */ }

    const b = `${bbox.s},${bbox.w},${bbox.n},${bbox.e}`;
    const query = `[out:json][timeout:180];${POWER_OVERPASS_SELECTOR}(${b});out geom;`;

    const body = 'data=' + encodeURIComponent(query);
    const endpoints = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter',
    ];
    let lastErr = null;

    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            Accept: 'application/json',
          },
          body,
        });
        if (!resp.ok) throw new Error('Overpass HTTP ' + resp.status);
        const data = await resp.json();
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (_) { /* quota */ }
        return data;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Overpass unavailable');
  }

  function setPowerLoadStatus(mapEl, message) {
    let el = mapEl.querySelector('.power-lines-status');
    if (!message) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.className = 'power-lines-status';
      mapEl.appendChild(el);
    }
    el.textContent = message;
  }

  async function addPowerLinesLayer(map, mapEl, stationsLayer, onLoaded) {
    setPowerLoadStatus(mapEl, 'Loading OSM power infrastructure…');
    try {
      const osmData = await fetchOsmPowerInfrastructure(POWER_BBOX);
      if (osmData._fromLocalFile) {
        setPowerLoadStatus(mapEl, 'Loaded cached OSM power data.');
        setTimeout(() => setPowerLoadStatus(mapEl, null), 1200);
      }
      const voltageCtx = buildPowerVoltageContext(osmData);
      const tiers = osmWaysByTier(osmData, voltageCtx);
      const infra = osmInfraByLayer(osmData);
      const towerVoltageByNodeId = mergeNodeVoltageMaps(
        buildTowerVoltageByNodeId(osmData),
        voltageCtx.nodeVoltage
      );
      enrichInfraTowerVoltages(infra, towerVoltageByNodeId);
      const bounds = L.latLngBounds([]);
      const layerRefs = {};
      const layerMeta = {};
      const usedTierIds = [];
      let featureCount = 0;
      const labelManager = createPowerLineLabelManager(map, layerRefs);
      let infraPane = null;
      if (mapEl.dataset.lightningMap === 'true') {
        infraPane = 'powerInfra';
        if (!map.getPane(infraPane)) {
          map.createPane(infraPane);
          map.getPane(infraPane).style.zIndex = 510;
        }
      }

      Object.keys(VOLTAGE_TIERS).forEach((tierId) => {
        const features = tiers[tierId];
        if (features.length) usedTierIds.push(tierId);
        featureCount += features.length;
        const layer = features.length
          ? createGeoJsonLayer(features, tierId, true, infraPane)
          : L.layerGroup([], { pane: infraPane || undefined });
        if (!layer) return;
        layerRefs[tierId] = layer;
        layerMeta[tierId] = VOLTAGE_TIERS[tierId];
        if (features.length) {
          labelManager.collectFromTierLayer(tierId, layer);
          bounds.extend(layer.getBounds());
        }
      });

      INFRA_LAYER_IDS.forEach((infraId) => {
        const features = infra[infraId];
        if (!features.length) return;
        featureCount += features.length;
        const meta = INFRA_LAYERS[infraId];

        if (meta.kind === 'area') {
          const { polygons, points } = splitInfraFeatures(features);
          if (polygons.length) {
            const layer = createInfraPolygonLayer(polygons, infraId, infraPane);
            layerRefs[infraId] = layer;
            layerMeta[infraId] = { minZoom: meta.minZoom };
            bounds.extend(layer.getBounds());
          }
          if (points.length) {
            const ptId = infraId + '-pt';
            const layer = createInfraPointLayer(points, infraId, infraPane);
            layerRefs[ptId] = layer;
            layerMeta[ptId] = { minZoom: meta.minZoomPoint ?? meta.minZoom + 2 };
            bounds.extend(layer.getBounds());
          }
        } else {
          const layer = createInfraPointLayer(features, infraId, infraPane);
          if (!layer) return;
          layerRefs[infraId] = layer;
          layerMeta[infraId] = { minZoom: meta.minZoom };
          bounds.extend(layer.getBounds());
        }
      });

      if (!featureCount) {
        setPowerLoadStatus(mapEl, 'No power infrastructure found in OSM for this area.');
        if (onLoaded) onLoaded(null);
        return;
      }

      if (stationsLayer) {
        layerRefs.stations = stationsLayer;
        layerMeta.stations = { minZoom: 0 };
      }

      const visibilityCtrl = createLayerVisibilityController(map, layerRefs, layerMeta);
      visibilityCtrl.refresh();

      createPowerLayersControl(map, layerRefs, [
        { heading: 'Transmission', ids: TX_TIER_IDS },
        { heading: 'Distribution', ids: DIST_TIER_IDS },
        { heading: 'Infrastructure', ids: INFRA_LAYER_IDS },
      ], visibilityCtrl, () => labelManager.scheduleRefresh()).addTo(map);

      updatePowerLegend(mapEl, usedTierIds);
      setPowerLoadStatus(mapEl, null);
      labelManager.scheduleRefresh();

      const riskIndex = buildInfraRiskIndex(infra, tiers);
      mapEl._infraRiskTargets = riskIndex;
      mapEl.dispatchEvent(
        new CustomEvent('rtl3d:infra-risk-index', { detail: { targets: riskIndex } })
      );

      if (onLoaded) onLoaded(bounds.isValid() ? bounds : null);
    } catch (err) {
      console.warn('OSM power infrastructure:', err);
      setPowerLoadStatus(mapEl, 'Power infrastructure unavailable (network or Overpass API).');
      if (onLoaded) onLoaded(null);
    }
  }

  function siteClass(code) {
    return LF_ONLY.has(code) ? 'lf' : 'lf-vhf';
  }

  function makeMarkerIcon(code, kind) {
    return L.divIcon({
      className: '',
      html:
        '<div class="study-site-marker ' + kind + '">' +
        '<span class="study-site-dot" aria-hidden="true"></span>' +
        '<span class="study-site-code">' + code + '</span>' +
        '</div>',
      iconSize: [52, 30],
      iconAnchor: [9, 15],
    });
  }

  function circleBounds(lat, lon, radiusKm) {
    const latDelta = radiusKm / 111.32;
    const lonDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
    return L.latLngBounds(
      [lat - latDelta, lon - lonDelta],
      [lat + latDelta, lon + lonDelta]
    );
  }

  function isolateMapNavigation(mapEl) {
    const block = (e) => e.stopPropagation();
    mapEl.addEventListener('wheel', block, { passive: false });
    mapEl.addEventListener('touchstart', block, { passive: true });
    mapEl.addEventListener('touchmove', block, { passive: true });
    mapEl.addEventListener('touchend', block, { passive: true });
    mapEl.addEventListener('mousedown', block);
  }

  function initOsmSitesMap(mapEl) {
    if (typeof L === 'undefined') {
      mapEl.innerHTML = '<p class="study-map-fallback">Map library failed to load.</p>';
      return;
    }

    let map = null;
    let studyBounds = null;
    let fallbackView = null;
    let layoutTimer = null;

    function hasMapSize() {
      const rect = mapEl.getBoundingClientRect();
      return rect.width > 40 && rect.height > 40;
    }

    function refreshMapView() {
      if (!map) return;
      map.invalidateSize({ animate: false, pan: false });
      if (studyBounds && studyBounds.isValid()) {
        map.fitBounds(studyBounds, { padding: [24, 24], maxZoom: 10, animate: false });
      } else if (fallbackView) {
        map.setView(fallbackView, 8, { animate: false });
      }
    }

    function buildMap() {
      const sites = NETWORK.sites;
      const origin = NETWORK.origin;
      fallbackView = [origin.lat, origin.lon];
      const showTnbRegion = mapEl.dataset.tnbRegion === 'true';
      const showPowerLines = mapEl.dataset.powerLines === 'true';
      const showWaterInfra = mapEl.dataset.waterInfrastructure === 'true';
      const showLightning = mapEl.dataset.lightningMap === 'true';

      map = L.map(mapEl, {
        scrollWheelZoom: true,
        dragging: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: false,
        zoomControl: false,
        attributionControl: true,
        zoomSnap: 0.25,
        zoomDelta: 1,
        preferCanvas: showLightning,
      });

      L.control.zoom({ position: 'topleft' }).addTo(map);
      L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const bounds = L.latLngBounds([]);
      const stationsLayer = showPowerLines || showWaterInfra ? L.layerGroup().addTo(map) : null;

      if (showTnbRegion && !showPowerLines) {
        const tnbBounds = L.latLngBounds([1.25, 99.6], [6.75, 104.5]);
        L.rectangle(tnbBounds, {
          color: '#f59e0b',
          weight: 2,
          opacity: 0.75,
          dashArray: '10 6',
          fillColor: '#f59e0b',
          fillOpacity: 0.08,
        })
          .bindTooltip('TNB Peninsular Malaysia grid service area', { sticky: true })
          .addTo(map);
        bounds.extend(tnbBounds);
      }

      sites.forEach((site) => {
        const kind = siteClass(site.code);
        const marker = L.marker([site.lat, site.lon], {
          icon: makeMarkerIcon(site.code, kind),
          alt: site.name,
        });
        marker.bindPopup(
          '<strong>' + site.code + '</strong><br>' + site.name,
          { closeButton: true, autoClose: true }
        );
        if (stationsLayer) marker.addTo(stationsLayer);
        else marker.addTo(map);
        bounds.extend([site.lat, site.lon]);
      });

      if (!showPowerLines && !showWaterInfra) {
        bounds.extend(circleBounds(origin.lat, origin.lon, COVERAGE_KM));
        L.circle([origin.lat, origin.lon], {
          radius: COVERAGE_KM * 1000,
          color: '#2e6ff2',
          weight: 2,
          opacity: 0.65,
          dashArray: '8 6',
          fillColor: '#2e6ff2',
          fillOpacity: 0.06,
        })
          .bindTooltip('>120 km LF nowcasting coverage', { sticky: true })
          .addTo(map);
      }

      studyBounds = bounds;
      isolateMapNavigation(mapEl);

      if (showPowerLines) {
        addPowerLinesLayer(map, mapEl, stationsLayer, (lineBounds) => {
          if (lineBounds && lineBounds.isValid()) studyBounds.extend(lineBounds);
          refreshMapView();
        });
      }

      if (showWaterInfra && typeof window.addWaterInfrastructureLayer === 'function') {
        window.addWaterInfrastructureLayer(map, mapEl, stationsLayer, (waterBounds) => {
          if (waterBounds && waterBounds.isValid()) studyBounds.extend(waterBounds);
          refreshMapView();
        });
      }

      if (showLightning && typeof window.initLightningMapLayer === 'function') {
        window.initLightningMapLayer(map, mapEl);
      }
    }

    function ensureMap(attempt) {
      if (!hasMapSize()) {
        if (attempt < 12) layoutTimer = setTimeout(() => ensureMap(attempt + 1), 80);
        return;
      }
      if (!map) buildMap();
      refreshMapView();
    }

    function scheduleEnsureMap() {
      clearTimeout(layoutTimer);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => ensureMap(0));
      });
    }

    scheduleEnsureMap();
    window.addEventListener('rtl3d:viewport-resize', scheduleEnsureMap);
  }

  document.querySelectorAll('[data-osm-sites-map]').forEach(initOsmSitesMap);
})();
