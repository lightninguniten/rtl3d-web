(function () {
  'use strict';

  /** Must match scripts/build_osm_water_data.py */
  const WATER_BBOX = { s: 2.0, w: 101.3, n: 3.5, e: 102.65 };
  const LOCAL_OSM_WATER_URL = 'data/osm/water-infrastructure.json';
  const LOCAL_OSM_WATER_CORE_URL = 'data/osm/water-layers-core.json';
  const LOCAL_OSM_WATER_DETAIL_URL = 'data/osm/water-layers-detail.json';
  const LOCAL_OSM_WATER_RISK_URL = 'data/osm/water-risk-index.json';
  const OSM_WATER_CACHE_VERSION = 3;
  const WATER_LAYER_CHUNK_SIZE = 1200;
  const WATER_LAYER_LOAD_ORDER = [
    'water-dam',
    'water-reservoir',
    'water-lake',
    'water-river',
    'water-basin',
    'water-pond',
    'water-canal',
    'water-stream',
    'water-body',
  ];

  const WATER_CORE_LAYER_IDS = [
    'water-dam',
    'water-reservoir',
    'water-lake',
    'water-river',
    'water-basin',
  ];

  const WATER_DETAIL_LAYER_IDS = [
    'water-pond',
    'water-canal',
    'water-stream',
    'water-body',
  ];

  const WATER_LAYER_IDS = [
    'water-dam',
    'water-river',
    'water-stream',
    'water-canal',
    'water-lake',
    'water-reservoir',
    'water-pond',
    'water-basin',
    'water-body',
  ];

  const WATER_LAYERS = {
    'water-dam': {
      label: 'Dams',
      shortLabel: 'Dams',
      color: '#92400e',
      kind: 'point',
      minZoom: 10,
      pointRadius: 6,
    },
    'water-river': {
      label: 'Rivers',
      shortLabel: 'Rivers',
      color: '#6d28d9',
      kind: 'line',
      minZoom: 9,
      weight: 3.5,
      opacity: 0.9,
    },
    'water-stream': {
      label: 'Streams & tributaries',
      shortLabel: 'Streams',
      color: '#15803d',
      kind: 'line',
      minZoom: 11,
      weight: 2.5,
      opacity: 0.88,
      dashArray: '4 5',
    },
    'water-canal': {
      label: 'Canals & drains',
      shortLabel: 'Canals',
      color: '#c2410c',
      kind: 'line',
      minZoom: 12,
      weight: 2,
      opacity: 0.88,
      dashArray: '6 4',
    },
    'water-lake': {
      label: 'Lakes',
      shortLabel: 'Lakes',
      color: '#0f766e',
      kind: 'area',
      minZoom: 10,
      weight: 2,
      fillOpacity: 0.4,
    },
    'water-reservoir': {
      label: 'Reservoirs',
      shortLabel: 'Reservoirs',
      color: '#7e22ce',
      kind: 'area',
      minZoom: 10,
      weight: 2,
      fillOpacity: 0.42,
    },
    'water-pond': {
      label: 'Ponds',
      shortLabel: 'Ponds',
      color: '#65a30d',
      kind: 'area',
      minZoom: 12,
      weight: 1.5,
      fillOpacity: 0.38,
    },
    'water-basin': {
      label: 'Basins & retention',
      shortLabel: 'Basins',
      color: '#be185d',
      kind: 'area',
      minZoom: 12,
      weight: 1.5,
      fillOpacity: 0.35,
      dashArray: '5 4',
    },
    'water-body': {
      label: 'Other water bodies',
      shortLabel: 'Water body',
      color: '#57534e',
      kind: 'area',
      minZoom: 11,
      weight: 1.5,
      fillOpacity: 0.32,
    },
  };

  const LINE_WATERWAY = new Set([
    'river', 'stream', 'tributary', 'canal', 'drain', 'ditch', 'fairway',
  ]);

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  function displayName(tags) {
    return (
      tags.name ||
      tags['name:en'] ||
      tags['name:ms'] ||
      tags.ref ||
      null
    );
  }

  function displayEnglishName(tags) {
    const primary = tags.name || tags.ref;
    const en = tags['name:en'];
    if (en && en !== primary) return en;
    return null;
  }

  function formatCoords(latlng) {
    if (!latlng) return null;
    const lat = latlng.lat != null ? latlng.lat : latlng[0];
    const lng = latlng.lng != null ? latlng.lng : latlng[1];
    if (lat == null || lng == null) return null;
    const latHem = lat >= 0 ? 'N' : 'S';
    const lngHem = lng >= 0 ? 'E' : 'W';
    return Math.abs(lat).toFixed(5) + '°' + latHem + ', ' + Math.abs(lng).toFixed(5) + '°' + lngHem;
  }

  function popupAnchorLatLng(layer) {
    if (!layer) return null;
    if (typeof layer.getLatLng === 'function') {
      const ll = layer.getLatLng();
      if (ll) return ll;
    }
    if (typeof layer.getBounds === 'function') {
      const bounds = layer.getBounds();
      if (bounds && bounds.isValid()) return bounds.getCenter();
    }
    return null;
  }

  function isLineWaterLayer(layerId) {
    return WATER_LAYERS[layerId]?.kind === 'line';
  }

  function waterwayKindLabel(props) {
    if (props.waterway) return formatTagLabel(props.waterway);
    return null;
  }

  function buildLineWaterwayPopupHtml(props, layerId, latlng) {
    const meta = WATER_LAYERS[layerId];
    const parts = [];
    const name = displayName(props);
    const english = displayEnglishName(props);
    const kind = waterwayKindLabel(props) || meta.shortLabel;

    if (name) {
      parts.push('<strong class="pwr-popup-name">' + escapeHtml(name) + '</strong>');
      if (english) {
        parts.push('<span class="pwr-popup-subtitle">' + escapeHtml(english) + '</span>');
      }
    } else {
      parts.push('<strong class="pwr-popup-name">Unnamed ' + escapeHtml(kind) + '</strong>');
    }

    parts.push('<strong>' + escapeHtml(meta.shortLabel) + '</strong>');

    const coords = formatCoords(latlng);
    if (coords) parts.push('Coordinates: ' + escapeHtml(coords));

    if (props.waterway) {
      parts.push('Waterway: ' + escapeHtml(formatTagLabel(props.waterway)));
    }
    if (props['name:ms'] && props['name:ms'] !== name && props['name:ms'] !== english) {
      parts.push('Malay: ' + escapeHtml(props['name:ms']));
    }
    if (props.ref && props.ref !== name) {
      parts.push('Ref: ' + escapeHtml(props.ref));
    }
    if (props.operator) parts.push('Operator: ' + escapeHtml(props.operator));
    if (props.intermittent === 'yes') parts.push('Flow: Intermittent');
    if (props.seasonal === 'yes') parts.push('Flow: Seasonal');
    if (props.destination) parts.push('Destination: ' + escapeHtml(formatTagLabel(props.destination)));
    if (props.network) parts.push('Network: ' + escapeHtml(props.network));

    return parts.join('<br>');
  }

  function formatTagLabel(value) {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function classifyWaterLayer(tags) {
    if (!tags) return null;
    if (tags.man_made === 'dam' || tags.waterway === 'dam') return 'water-dam';
    if (tags.landuse === 'reservoir' || tags.water === 'reservoir') return 'water-reservoir';
    if (tags.basin === 'retention' || tags.basin === 'detention' || tags.water === 'basin') {
      return 'water-basin';
    }

    const ww = tags.waterway;
    if (ww === 'river') return 'water-river';
    if (ww === 'stream' || ww === 'tributary') return 'water-stream';
    if (ww === 'canal' || ww === 'drain' || ww === 'ditch') return 'water-canal';
    if (LINE_WATERWAY.has(ww)) return 'water-stream';

    const w = tags.water;
    if (w === 'lake') return 'water-lake';
    if (w === 'pond' || w === 'fishpond' || w === 'lagoon') return 'water-pond';
    if (w === 'reservoir') return 'water-reservoir';
    if (tags.natural === 'water' || w) {
      if (w === 'river') return 'water-river';
      return 'water-body';
    }
    if (tags.landuse === 'reservoir') return 'water-reservoir';

    return null;
  }

  function closeRing(coords) {
    if (coords.length < 3) return coords;
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) return coords;
    return coords.concat([first]);
  }

  function isClosedWay(el) {
    const nodes = el.nodes || [];
    return nodes.length >= 4 && nodes[0] === nodes[nodes.length - 1];
  }

  function wayIsArea(el, tags) {
    if (tags.area === 'yes') return true;
    if (tags.area === 'no') return false;
    if (tags.natural === 'water' || tags.landuse === 'reservoir' || tags.water) return true;
    if (tags.waterway === 'dam' || tags.man_made === 'dam') return false;
    if (tags.waterway && LINE_WATERWAY.has(tags.waterway)) return false;
    return isClosedWay(el);
  }

  function lineStyle(layerId) {
    const meta = WATER_LAYERS[layerId];
    const style = {
      color: meta.color,
      weight: meta.weight || 2,
      opacity: meta.opacity || 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    };
    if (meta.dashArray) style.dashArray = meta.dashArray;
    return style;
  }

  function areaStyle(layerId) {
    const meta = WATER_LAYERS[layerId];
    const style = {
      color: meta.color,
      weight: meta.weight || 2,
      opacity: 0.9,
      fillColor: meta.color,
      fillOpacity: meta.fillOpacity || 0.3,
    };
    if (meta.dashArray) style.dashArray = meta.dashArray;
    return style;
  }

  function buildPopupHtml(props, layerId, latlng) {
    if (isLineWaterLayer(layerId)) {
      return buildLineWaterwayPopupHtml(props, layerId, latlng);
    }

    const meta = WATER_LAYERS[layerId];
    const parts = [];
    const name = displayName(props);
    const english = displayEnglishName(props);
    if (name) {
      parts.push('<strong class="pwr-popup-name">' + escapeHtml(name) + '</strong>');
      if (english) {
        parts.push('<span class="pwr-popup-subtitle">' + escapeHtml(english) + '</span>');
      }
    } else {
      parts.push('<strong class="pwr-popup-name">' + escapeHtml(meta.shortLabel) + '</strong>');
    }
    parts.push('<strong>' + escapeHtml(meta.label) + '</strong>');
    if (props.waterway) parts.push('Waterway: ' + escapeHtml(formatTagLabel(props.waterway)));
    if (props.water) parts.push('Water: ' + escapeHtml(formatTagLabel(props.water)));
    if (props.natural) parts.push('Natural: ' + escapeHtml(formatTagLabel(props.natural)));
    if (props.man_made) parts.push('Structure: ' + escapeHtml(formatTagLabel(props.man_made)));
    if (props.operator) parts.push('Operator: ' + escapeHtml(props.operator));
    return parts.join('<br>');
  }

  function featureCentroid(feature) {
    const geom = feature.geometry;
    if (!geom) return null;
    if (geom.type === 'Point') {
      return { lat: geom.coordinates[1], lng: geom.coordinates[0] };
    }
    if (geom.type === 'LineString') {
      const mid = Math.floor(geom.coordinates.length / 2);
      const c = geom.coordinates[mid];
      return c ? { lat: c[1], lng: c[0] } : null;
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
    return null;
  }

  /** Storage / control assets used to gate river, stream, and drain alerts. */
  const WATER_RISK_ANCHOR_IDS = [
    'water-dam',
    'water-reservoir',
    'water-lake',
    'water-pond',
    'water-basin',
  ];

  /** Point/area layers always checked within the radiation zone. */
  const WATER_RISK_STORAGE_IDS = [
    'water-dam',
    'water-reservoir',
    'water-lake',
    'water-pond',
    'water-basin',
    'water-body',
  ];

  /** Line layers: rivers (flood), streams/canals/drains near storage (inflow & drainage). */
  const WATER_RISK_LINE_IDS = ['water-river', 'water-stream', 'water-canal'];

  const LINE_NEAR_STORAGE_KM = 3;
  const STREAM_NEAR_STORAGE_KM = 2;

  const WATER_RISK_EFFECT = {
    control: 'control & direct strike',
    storage: 'storage & storm inflow',
    drainage: 'drainage & retention',
    flood: 'flood routing',
  };

  function distanceKm(a, b) {
    const earthR = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * earthR * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function closestPointOnSegment(center, a, b) {
    const cosLat = Math.cos((center.lat * Math.PI) / 180);
    const ax = a.lng * cosLat;
    const ay = a.lat;
    const bx = b.lng * cosLat;
    const by = b.lat;
    const px = center.lng * cosLat;
    const py = center.lat;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const lat = ay + t * dy;
    const lng = cosLat === 0 ? center.lng : (ax + t * dx) / cosLat;
    return { lat, lng, distanceKm: distanceKm(center, { lat, lng }) };
  }

  function distancePointToLineFeature(point, feature) {
    const coords = feature.geometry && feature.geometry.coordinates;
    if (!coords || coords.length < 2) return Infinity;
    let best = Infinity;
    for (let i = 0; i < coords.length - 1; i++) {
      const a = { lat: coords[i][1], lng: coords[i][0] };
      const b = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
      const hit = closestPointOnSegment(point, a, b);
      if (hit.distanceKm < best) best = hit.distanceKm;
    }
    return best;
  }

  function collectWaterRiskAnchors(waterByLayer) {
    const anchors = [];
    WATER_RISK_ANCHOR_IDS.forEach((layerId) => {
      (waterByLayer[layerId] || []).forEach((feature) => {
        const center = featureCentroid(feature);
        if (center) anchors.push(center);
      });
    });
    return anchors;
  }

  function minDistanceLineToAnchors(feature, anchors) {
    if (!anchors.length) return Infinity;
    let best = Infinity;
    anchors.forEach((anchor) => {
      const d = distancePointToLineFeature(anchor, feature);
      if (d < best) best = d;
    });
    return best;
  }

  function storageRiskEffect(layerId) {
    if (layerId === 'water-dam') return 'control';
    if (layerId === 'water-basin' || layerId === 'water-pond') return 'drainage';
    return 'storage';
  }

  function typeLabelWithEffect(shortLabel, effectKey) {
    const effect = WATER_RISK_EFFECT[effectKey];
    return effect ? shortLabel + ' · ' + effect : shortLabel;
  }

  function lineDisplayName(props, meta) {
    return displayName(props) || meta.shortLabel + ' reach';
  }

  /** Include line waterway in alerts only when it can affect storage, flood routing, or drainage. */
  function lineWaterRiskMeta(layerId, props, feature, anchors) {
    const named = !!displayName(props);
    const ww = props.waterway || '';

    if (layerId === 'water-river') {
      return { effect: 'flood' };
    }

    if (layerId === 'water-stream') {
      if (named) return { effect: 'flood' };
      if (minDistanceLineToAnchors(feature, anchors) <= STREAM_NEAR_STORAGE_KM) {
        return { effect: 'flood' };
      }
      return null;
    }

    if (layerId === 'water-canal') {
      if (named) return { effect: 'drainage' };
      if (ww === 'canal') return { effect: 'drainage' };
      if (minDistanceLineToAnchors(feature, anchors) <= LINE_NEAR_STORAGE_KM) {
        return { effect: 'drainage' };
      }
      return null;
    }

    return null;
  }

  function osmWaterByLayer(osmData) {
    const layers = {};
    WATER_LAYER_IDS.forEach((id) => {
      layers[id] = [];
    });

    (osmData.elements || []).forEach((el) => {
      const tags = el.tags || {};
      const layerId = classifyWaterLayer(tags);
      if (!layerId) return;

      const meta = WATER_LAYERS[layerId];

      if (el.type === 'node' && el.lat != null && el.lon != null) {
        if (meta.kind === 'line') return;
        layers[layerId].push({
          type: 'Feature',
          properties: { ...tags, _layerId: layerId },
          geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
        });
        return;
      }

      if (el.type === 'way' && el.geometry && el.geometry.length >= 2) {
        if (meta.kind === 'point' && layerId === 'water-dam') {
          const p = el.geometry[0];
          layers[layerId].push({
            type: 'Feature',
            properties: { ...tags, _layerId: layerId },
            geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          });
          return;
        }
        if (wayIsArea(el, tags) && meta.kind !== 'line') {
          const ring = closeRing(el.geometry.map((p) => [p.lon, p.lat]));
          if (ring.length >= 4) {
            layers[layerId].push({
              type: 'Feature',
              properties: { ...tags, _layerId: layerId },
              geometry: { type: 'Polygon', coordinates: [ring] },
            });
          }
          return;
        }
        if (meta.kind === 'line' || tags.waterway || layerId === 'water-river' || layerId === 'water-stream' || layerId === 'water-canal') {
          const lineId = classifyWaterLayer(tags);
          if (!lineId || WATER_LAYERS[lineId].kind !== 'line') return;
          layers[lineId].push({
            type: 'Feature',
            properties: { ...tags, _layerId: lineId },
            geometry: {
              type: 'LineString',
              coordinates: el.geometry.map((p) => [p.lon, p.lat]),
            },
          });
        }
        return;
      }

      if (el.type === 'relation' && el.members && el.members.length) {
        (el.members || []).forEach((member) => {
          if (!member.geometry || member.geometry.length < 2) return;
          const isOuter = !member.role || member.role === 'outer';
          if (!isOuter) return;
          if (meta.kind === 'area' || tags.natural === 'water' || tags.landuse === 'reservoir') {
            const ring = closeRing(member.geometry.map((p) => [p.lon, p.lat]));
            if (ring.length >= 4) {
              layers[layerId].push({
                type: 'Feature',
                properties: { ...tags, _layerId: layerId },
                geometry: { type: 'Polygon', coordinates: [ring] },
              });
            }
          }
        });
      }
    });

    return layers;
  }

  function buildWaterRiskIndex(waterByLayer) {
    const targets = [];
    const anchors = collectWaterRiskAnchors(waterByLayer);

    WATER_RISK_STORAGE_IDS.forEach((layerId) => {
      const meta = WATER_LAYERS[layerId];
      const effect = storageRiskEffect(layerId);
      (waterByLayer[layerId] || []).forEach((feature) => {
        const center = featureCentroid(feature);
        if (!center) return;
        const props = feature.properties || {};
        targets.push({
          kind: 'point',
          lat: center.lat,
          lng: center.lng,
          name: displayName(props) || meta.shortLabel,
          type: props.waterway || props.water || props.man_made || layerId.replace('water-', ''),
          typeLabel: typeLabelWithEffect(meta.shortLabel, effect),
          riskEffect: effect,
          layerId,
        });
      });
    });

    WATER_RISK_LINE_IDS.forEach((layerId) => {
      const meta = WATER_LAYERS[layerId];
      (waterByLayer[layerId] || []).forEach((feature) => {
        const props = feature.properties || {};
        const riskMeta = lineWaterRiskMeta(layerId, props, feature, anchors);
        if (!riskMeta) return;
        targets.push({
          kind: 'line',
          feature,
          name: lineDisplayName(props, meta),
          type: props.waterway || props.water || layerId.replace('water-', ''),
          typeLabel: typeLabelWithEffect(meta.shortLabel, riskMeta.effect),
          riskEffect: riskMeta.effect,
          layerId,
        });
      });
    });

    return targets;
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
      refresh();
    }

    map.on('zoomend', refresh);
    return { refresh, setVisible, visibility };
  }

  function swatchStyle(meta) {
    if (meta.dashArray) return 'border-color:' + meta.color;
    if (meta.kind === 'area') return 'background:' + meta.color;
    return 'background:' + meta.color;
  }

  function createWaterLayersControl(map, layerRefs, visibilityCtrl) {
    const Control = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-control power-layers-control water-layers-control');
        const toggle = L.DomUtil.create('button', 'power-layers-toggle', container);
        toggle.type = 'button';
        toggle.title = 'Water layers';
        toggle.setAttribute('aria-label', 'Toggle water layers');
        toggle.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
          '<path fill="currentColor" d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2C20 10.48 17.33 6.55 12 2zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z"/>' +
          '</svg>';

        const panel = L.DomUtil.create('div', 'power-layers-panel', container);
        panel.setAttribute('data-no-drag-scroll', '');
        L.DomUtil.create('div', 'power-layers-title', panel).textContent = 'Water layers';

        const checkboxes = [];
        const sections = [
          { heading: 'Structures', ids: ['water-dam'] },
          { heading: 'Rivers & channels', ids: ['water-river', 'water-stream', 'water-canal'] },
          { heading: 'Lakes & storage', ids: ['water-lake', 'water-reservoir', 'water-pond', 'water-basin', 'water-body'] },
        ];

        sections.forEach((section) => {
          L.DomUtil.create('div', 'power-layers-heading', panel).textContent = section.heading;
          section.ids.forEach((id) => {
            const meta = WATER_LAYERS[id];
            const row = L.DomUtil.create('label', 'power-layers-row', panel);
            const cb = L.DomUtil.create('input', '', row);
            cb.type = 'checkbox';
            cb.checked = !!layerRefs[id];
            cb.dataset.layerId = id;
            cb.disabled = !layerRefs[id];

            const swatch = L.DomUtil.create('span', 'power-layers-swatch' + (meta.dashArray ? ' dashed' : meta.kind === 'area' ? ' area' : ''), row);
            swatch.style.cssText = swatchStyle(meta);
            L.DomUtil.create('span', 'power-layers-label', row).textContent = meta.shortLabel;

            cb.addEventListener('change', () => {
              visibilityCtrl.setVisible(id, cb.checked);
            });
            checkboxes.push(cb);
          });
        });

        if (layerRefs.stations) {
          L.DomUtil.create('div', 'power-layers-heading', panel).textContent = 'Stations';
          const row = L.DomUtil.create('label', 'power-layers-row', panel);
          const cb = L.DomUtil.create('input', '', row);
          cb.type = 'checkbox';
          cb.checked = true;
          cb.dataset.layerId = 'stations';
          L.DomUtil.create('span', 'power-layers-swatch station', row);
          L.DomUtil.create('span', 'power-layers-label', row).textContent = 'Observation stations';
          cb.addEventListener('change', () => visibilityCtrl.setVisible('stations', cb.checked));
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
            if (!cb.disabled) {
              cb.checked = true;
              visibilityCtrl.setVisible(cb.dataset.layerId, true);
            }
          });
        });
        noneBtn.addEventListener('click', () => {
          checkboxes.forEach((cb) => {
            cb.checked = false;
            visibilityCtrl.setVisible(cb.dataset.layerId, false);
          });
        });

        L.DomEvent.on(toggle, 'click', L.DomEvent.stopPropagation)
          .on(toggle, 'click', L.DomEvent.preventDefault)
          .on(toggle, 'click', () => container.classList.toggle('expanded'));

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);
        return container;
      },
    });
    return new Control();
  }

  function updateWaterLegend(mapEl, usedIds) {
    const legend = mapEl.closest('.map-wrap')?.querySelector('.map-legend-water');
    if (!legend) return;
    const used = new Set(usedIds);
    const spans = WATER_LAYER_IDS.filter((id) => used.has(id)).map((id) => {
      const meta = WATER_LAYERS[id];
      const dash = meta.dashArray ? ' dashed' : '';
      const area = meta.kind === 'area' ? ' area' : '';
      return (
        '<span><i class="leg water-v' + dash + area + '" style="' + swatchStyle(meta) + '"></i>' +
        escapeHtml(meta.shortLabel) +
        '</span>'
      );
    });
    legend.innerHTML =
      (spans.length ? '<div class="map-legend-group">' + spans.join('') + '</div>' : '') +
      '<span><i class="leg lf-vhf"></i> Observation stations</span>';
    if (typeof window.initDragScroll === 'function') window.initDragScroll(legend);
  }

  function bboxMatchesCached(metaBbox, bbox) {
    if (!metaBbox) return true;
    return ['s', 'w', 'n', 'e'].every((k) => Math.abs(Number(metaBbox[k]) - Number(bbox[k])) < 1e-6);
  }

  function emptyWaterByLayer() {
    const waterByLayer = {};
    WATER_LAYER_IDS.forEach((id) => {
      waterByLayer[id] = [];
    });
    return waterByLayer;
  }

  function mergeLayerPayload(waterByLayer, data) {
    if (!data?.layers) return;
    Object.keys(data.layers).forEach((id) => {
      if (waterByLayer[id]) waterByLayer[id] = data.layers[id] || [];
    });
  }

  function validateWaterMeta(meta, bbox) {
    if (!meta) return false;
    if (meta.cacheVersion && meta.cacheVersion !== OSM_WATER_CACHE_VERSION) return false;
    return bboxMatchesCached(meta.bbox, bbox);
  }

  function normalizeSplitCorePayload(coreData, riskData, bbox) {
    if (!coreData?.layers || !validateWaterMeta(coreData.meta, bbox)) return null;
    const waterByLayer = emptyWaterByLayer();
    mergeLayerPayload(waterByLayer, coreData);
    const featureCount = Object.values(waterByLayer).reduce((n, f) => n + f.length, 0);
    const riskTargets =
      riskData?.targets && validateWaterMeta(riskData.meta, bbox) ? riskData.targets : null;
    return {
      waterByLayer,
      featureCount,
      riskTargets,
      _fromLocalFile: true,
      _splitBundle: true,
    };
  }

  let waterCorePromise = null;
  let waterDetailPromise = null;
  let waterRiskPromise = null;
  let waterCanvasRenderer = null;

  function ensureWaterCorePromise() {
    if (!waterCorePromise) {
      waterCorePromise = fetch(LOCAL_OSM_WATER_CORE_URL)
        .then((resp) => (resp.ok ? resp.json() : null))
        .catch(() => null);
    }
    return waterCorePromise;
  }

  function ensureWaterRiskPromise() {
    if (!waterRiskPromise) {
      waterRiskPromise = fetch(LOCAL_OSM_WATER_RISK_URL)
        .then((resp) => (resp.ok ? resp.json() : null))
        .catch(() => null);
    }
    return waterRiskPromise;
  }

  function ensureWaterDetailPromise() {
    if (!waterDetailPromise) {
      waterDetailPromise = fetch(LOCAL_OSM_WATER_DETAIL_URL)
        .then((resp) => (resp.ok ? resp.json() : null))
        .catch(() => null);
    }
    return waterDetailPromise;
  }

  async function loadWaterData(bbox) {
    const coreData = await ensureWaterCorePromise();
    const splitPayload = normalizeSplitCorePayload(coreData, null, bbox);
    if (splitPayload) {
      splitPayload._needsDeferredRisk = true;
      return splitPayload;
    }

    const rawResp = await fetch(LOCAL_OSM_WATER_URL).catch(() => null);
    if (rawResp?.ok) {
      const rawData = await rawResp.json();
      if (rawData.elements?.length && validateWaterMeta(rawData.meta, bbox)) {
        const waterByLayer = osmWaterByLayer(rawData);
        const featureCount = Object.values(waterByLayer).reduce((n, f) => n + f.length, 0);
        return { waterByLayer, featureCount, riskTargets: null, _fromLocalFile: true, _splitBundle: false };
      }
    }

    throw new Error('Water cache files missing. Run build-osm-water-data.bat');
  }

  let waterDataPromise = null;

  function prefetchWaterData(bbox) {
    if (!waterDataPromise) {
      waterDataPromise = loadWaterData(bbox || WATER_BBOX);
    }
    return waterDataPromise;
  }

  function nextFrame() {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(resolve);
      else setTimeout(resolve, 0);
    });
  }

  function getWaterCanvasRenderer(map, waterPane) {
    if (!waterCanvasRenderer) {
      waterCanvasRenderer = L.canvas({ padding: 0.5, pane: waterPane || undefined });
    }
    return waterCanvasRenderer;
  }

  function bindFeaturePopup(layerRef, props, layerId, map) {
    layerRef.on('click', function (e) {
      L.popup({ maxWidth: 280, className: 'power-feature-popup water-line-popup' })
        .setLatLng(e.latlng)
        .setContent(buildPopupHtml(props, layerId, e.latlng))
        .openOn(map);
      L.DomEvent.stopPropagation(e);
    });
  }

  function createGeoJsonSubLayer(features, layerId, map, waterPane) {
    const meta = WATER_LAYERS[layerId];
    const useCanvas = meta.kind === 'line' || meta.kind === 'area';
    const renderer = useCanvas ? getWaterCanvasRenderer(map, waterPane) : undefined;
    return L.geoJSON(
      { type: 'FeatureCollection', features },
      {
        pane: waterPane || undefined,
        renderer,
        style(f) {
          const id = f.properties._layerId || layerId;
          return meta.kind === 'line' ? lineStyle(id) : areaStyle(id);
        },
        pointToLayer(f, latlng) {
          const m = WATER_LAYERS[f.properties._layerId || layerId];
          return L.circleMarker(latlng, {
            radius: m.pointRadius || 5,
            color: m.color,
            fillColor: m.color,
            fillOpacity: 0.9,
            weight: 2,
            pane: waterPane || undefined,
          });
        },
        onEachFeature(f, layerRef) {
          bindFeaturePopup(layerRef, f.properties, f.properties._layerId || layerId, map);
        },
      }
    );
  }

  function extendLayerBounds(bounds, layer) {
    if (!layer || typeof layer.getBounds !== 'function') return;
    const layerBounds = layer.getBounds();
    if (layerBounds && layerBounds.isValid()) bounds.extend(layerBounds);
  }

  async function buildGeoJsonLayerChunked(features, layerId, map, waterPane) {
    const group = L.featureGroup([], { pane: waterPane || undefined });
    if (!features.length) return group;

    if (features.length <= WATER_LAYER_CHUNK_SIZE) {
      group.addLayer(createGeoJsonSubLayer(features, layerId, map, waterPane));
      return group;
    }

    for (let i = 0; i < features.length; i += WATER_LAYER_CHUNK_SIZE) {
      const chunk = features.slice(i, i + WATER_LAYER_CHUNK_SIZE);
      group.addLayer(createGeoJsonSubLayer(chunk, layerId, map, waterPane));
      if (i + WATER_LAYER_CHUNK_SIZE < features.length) await nextFrame();
    }
    return group;
  }

  function applyRiskIndex(mapEl, riskTargets, waterByLayer) {
    const targets = riskTargets || buildWaterRiskIndex(waterByLayer);
    mapEl._infraRiskTargets = targets;
    mapEl.dispatchEvent(
      new CustomEvent('rtl3d:infra-risk-index', { detail: { targets, kind: 'water' } })
    );
  }

  function publishRiskIndex(mapEl, riskTargets, waterByLayer) {
    if (riskTargets?.length) {
      applyRiskIndex(mapEl, riskTargets, waterByLayer);
      return;
    }
    const run = () => applyRiskIndex(mapEl, null, waterByLayer);
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 3000 });
    else setTimeout(run, 100);
  }

  function setLoadStatus(mapEl, message) {
    let el = mapEl.querySelector('.water-infra-status');
    if (!message) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.className = 'water-infra-status power-lines-status';
      mapEl.appendChild(el);
    }
    el.textContent = message;
  }

  async function buildLayerTier(layerIds, waterByLayer, map, waterPane, layerRefs, layerMeta, usedIds, bounds) {
    for (let i = 0; i < layerIds.length; i++) {
      const layerId = layerIds[i];
      const features = waterByLayer[layerId] || [];
      layerMeta[layerId] = WATER_LAYERS[layerId];

      if (!features.length) {
        if (!layerRefs[layerId]) layerRefs[layerId] = L.featureGroup([], { pane: waterPane || undefined });
        continue;
      }

      if (!usedIds.includes(layerId)) usedIds.push(layerId);
      layerRefs[layerId] = await buildGeoJsonLayerChunked(features, layerId, map, waterPane);
      extendLayerBounds(bounds, layerRefs[layerId]);

      if (i < layerIds.length - 1) await nextFrame();
    }
  }

  async function addWaterInfrastructureLayer(map, mapEl, stationsLayer, onLoaded) {
    setLoadStatus(mapEl, 'Loading water map…');
    const previousTapTolerance = map.options.tapTolerance;
    map.options.tapTolerance = Math.max(previousTapTolerance || 15, 18);

    try {
      const payload = await prefetchWaterData(WATER_BBOX);
      const waterByLayer = payload.waterByLayer;
      const layerRefs = {};
      const layerMeta = {};
      const usedIds = [];
      const bounds = L.latLngBounds([]);
      let featureCount = payload.featureCount || 0;

      let waterPane = 'waterInfra';
      if (mapEl.dataset.lightningMap === 'true') {
        if (!map.getPane(waterPane)) {
          map.createPane(waterPane);
          map.getPane(waterPane).style.zIndex = 505;
        }
      }

      WATER_LAYER_IDS.forEach((layerId) => {
        layerRefs[layerId] = L.featureGroup([], { pane: waterPane || undefined });
        layerMeta[layerId] = WATER_LAYERS[layerId];
      });

      const visibilityCtrl = createLayerVisibilityController(map, layerRefs, layerMeta);
      let layersControl = null;

      const tierIds = payload._splitBundle
        ? WATER_CORE_LAYER_IDS
        : WATER_LAYER_LOAD_ORDER;

      await buildLayerTier(tierIds, waterByLayer, map, waterPane, layerRefs, layerMeta, usedIds, bounds);

      if (stationsLayer) {
        layerRefs.stations = stationsLayer;
        layerMeta.stations = { minZoom: 0 };
      }

      visibilityCtrl.refresh();
      layersControl = createWaterLayersControl(map, layerRefs, visibilityCtrl);
      layersControl.addTo(map);
      updateWaterLegend(mapEl, usedIds);
      setLoadStatus(mapEl, null);

      const applyDeferredRisk = (riskData) => {
        if (riskData?.targets && validateWaterMeta(riskData.meta, WATER_BBOX)) {
          applyRiskIndex(mapEl, riskData.targets, waterByLayer);
        } else {
          publishRiskIndex(mapEl, null, waterByLayer);
        }
      };

      if (payload._needsDeferredRisk) {
        const loadRisk = () => {
          ensureWaterRiskPromise()
            .then(applyDeferredRisk)
            .catch(() => publishRiskIndex(mapEl, null, waterByLayer));
        };
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(() => { loadRisk(); }, { timeout: 800 });
        } else {
          setTimeout(loadRisk, 120);
        }
      } else if (payload._riskPromise) {
        payload._riskPromise.then(applyDeferredRisk).catch(() => publishRiskIndex(mapEl, null, waterByLayer));
      } else {
        publishRiskIndex(mapEl, payload.riskTargets, waterByLayer);
      }

      if (bounds.isValid()) {
        if (onLoaded) onLoaded(bounds);
      } else if (onLoaded) {
        onLoaded(null);
      }

      if (payload._splitBundle) {
        const loadDetail = async () => {
          const detailData = await ensureWaterDetailPromise();
          if (!detailData?.layers || !validateWaterMeta(detailData.meta, WATER_BBOX)) return;

          mergeLayerPayload(waterByLayer, detailData);
          featureCount = Object.values(waterByLayer).reduce((n, f) => n + f.length, 0);
          await buildLayerTier(
            WATER_DETAIL_LAYER_IDS,
            waterByLayer,
            map,
            waterPane,
            layerRefs,
            layerMeta,
            usedIds,
            bounds
          );
          visibilityCtrl.refresh();
          updateWaterLegend(mapEl, usedIds);
          if (bounds.isValid() && onLoaded) onLoaded(bounds);
        };

        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(() => { loadDetail().catch(() => {}); }, { timeout: 500 });
        } else {
          setTimeout(() => { loadDetail().catch(() => {}); }, 80);
        }
      }

      if (!featureCount) {
        setLoadStatus(mapEl, 'No water features found in OSM for this area.');
      }
    } catch (err) {
      console.warn('OSM water infrastructure:', err);
      setLoadStatus(mapEl, 'Could not load water data. Run build-osm-water-data.bat');
      map.options.tapTolerance = previousTapTolerance;
      if (onLoaded) onLoaded(null);
    }
  }

  window.addWaterInfrastructureLayer = addWaterInfrastructureLayer;
  window.WATER_BBOX = WATER_BBOX;
  window.prefetchWaterData = prefetchWaterData;
})();
