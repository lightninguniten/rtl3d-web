(function () {
  'use strict';

  /** Must match scripts/build_osm_aviation_data.py */
  const AVIATION_BBOX = { s: 2.0, w: 101.3, n: 3.5, e: 102.65 };
  const LOCAL_OSM_AVIATION_URL = 'data/osm/aviation-infrastructure.json';
  const LOCAL_OSM_AVIATION_CORE_URL = 'data/osm/aviation-layers-core.json';
  const LOCAL_OSM_AVIATION_DETAIL_URL = 'data/osm/aviation-layers-detail.json';
  const OSM_AVIATION_CACHE_VERSION = 9;

  const FLIGHT_ROUTE_LAYER_IDS = [
    'aviation-route-domestic',
    'aviation-route-international',
    'aviation-route-approach',
    'aviation-route-corridor',
  ];

  const ROUTE_CLASS_LABEL = {
    domestic: 'Domestic scheduled',
    international: 'International scheduled',
    approach: 'Approach & departure',
    corridor: 'Illustrative corridor',
  };

  const CORE_LAYER_IDS = [
    'maritime-route',
    ...FLIGHT_ROUTE_LAYER_IDS,
    'aviation-airport',
  ];
  const DETAIL_LAYER_IDS = ['aviation-runway'];

  const TRANSPORT_LAYER_IDS = [
    'maritime-route',
    ...FLIGHT_ROUTE_LAYER_IDS,
    'aviation-runway',
    'aviation-airport',
  ];

  const TRANSPORT_LAYERS = {
    'maritime-route': {
      label: 'Maritime routes',
      shortLabel: 'Maritime route',
      color: '#f97316',
      kind: 'line',
      minZoom: 8,
      weight: 4,
      opacity: 0.94,
      dashArray: '8 5',
      group: 'maritime',
    },
    'aviation-route-domestic': {
      label: 'Domestic scheduled routes',
      shortLabel: 'Domestic scheduled',
      color: '#38bdf8',
      kind: 'line',
      minZoom: 8,
      weight: 3,
      opacity: 0.92,
      dashArray: '10 7',
      group: 'aviation',
    },
    'aviation-route-international': {
      label: 'International scheduled routes',
      shortLabel: 'International scheduled',
      color: '#6366f1',
      kind: 'line',
      minZoom: 8,
      weight: 3,
      opacity: 0.92,
      dashArray: '14 6',
      group: 'aviation',
    },
    'aviation-route-approach': {
      label: 'Approach & departure sectors',
      shortLabel: 'Approach & departure',
      color: '#e879f9',
      kind: 'line',
      minZoom: 8,
      weight: 3,
      opacity: 0.9,
      dashArray: '6 5',
      group: 'aviation',
    },
    'aviation-route-corridor': {
      label: 'Illustrative corridors',
      shortLabel: 'Illustrative corridor',
      color: '#22d3ee',
      kind: 'line',
      minZoom: 8,
      weight: 3,
      opacity: 0.88,
      dashArray: '4 6',
      group: 'aviation',
    },
    'aviation-runway': {
      label: 'Runways',
      shortLabel: 'Runway',
      color: '#f8fafc',
      kind: 'line',
      minZoom: 11,
      weight: 5,
      opacity: 0.95,
      group: 'aviation',
    },
    'aviation-airport': {
      label: 'Airports & helipads',
      shortLabel: 'Airport',
      color: '#0891b2',
      kind: 'point',
      minZoom: 8,
      pointRadius: 7,
      group: 'aviation',
    },
  };

  const AIRPORT_AEROWAYS = new Set(['aerodrome', 'heliport', 'helipad']);
  const RUNWAY_AEROWAYS = new Set(['runway', 'stopway']);

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
    return tags.name || tags['name:en'] || tags.ref || tags.icao || tags.iata || null;
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

  function buildTransportRiskIndex(transportByLayer) {
    const maritime = [];
    const aviation = [];

    (transportByLayer['maritime-route'] || []).forEach((feature) => {
      const props = feature.properties || {};
      maritime.push({
        kind: 'line',
        feature,
        name: displayName(props) || 'Maritime route',
        type: props.route || 'ferry',
        typeLabel: TRANSPORT_LAYERS['maritime-route'].shortLabel,
        layerId: 'maritime-route',
      });
    });

    FLIGHT_ROUTE_LAYER_IDS.forEach((layerId) => {
      (transportByLayer[layerId] || []).forEach((feature) => {
        const props = feature.properties || {};
        const routeClass = props.rtl3d_route_class || '';
        aviation.push({
          kind: 'line',
          feature,
          name: displayName(props) || 'Flight route',
          type: props.route || 'flight',
          typeLabel: ROUTE_CLASS_LABEL[routeClass] || TRANSPORT_LAYERS[layerId].shortLabel,
          layerId,
        });
      });
    });

    (transportByLayer['aviation-airport'] || []).forEach((feature) => {
      const props = feature.properties || {};
      const center = featureCentroid(feature);
      if (!center) return;
      aviation.push({
        kind: 'point',
        lat: center.lat,
        lng: center.lng,
        name: displayName(props) || 'Airport',
        type: props.aeroway || 'aerodrome',
        typeLabel: TRANSPORT_LAYERS['aviation-airport'].shortLabel,
        layerId: 'aviation-airport',
      });
    });

    return { maritime, aviation };
  }

  function publishTransportRiskIndex(mapEl, transportByLayer) {
    const index = buildTransportRiskIndex(transportByLayer);
    mapEl._transportRiskIndex = index;
    mapEl.dispatchEvent(
      new CustomEvent('rtl3d:transport-risk-index', { detail: index })
    );
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

  function classifyFlightLayerId(tags) {
    const routeClass = tags.rtl3d_route_class;
    if (routeClass === 'domestic') return 'aviation-route-domestic';
    if (routeClass === 'international') return 'aviation-route-international';
    if (routeClass === 'approach') return 'aviation-route-approach';
    if (routeClass === 'corridor') return 'aviation-route-corridor';
    return 'aviation-route-corridor';
  }

  function classifyTransportElement(el) {
    const tags = el.tags || {};
    if (tags._rtl3d_maritime_route === 'true' || tags.route === 'ferry') return 'maritime-route';
    if (tags.route === 'flight' || tags._rtl3d_flight_route === 'true') {
      return classifyFlightLayerId(tags);
    }
    const aw = tags.aeroway;
    if (AIRPORT_AEROWAYS.has(aw)) return 'aviation-airport';
    if (RUNWAY_AEROWAYS.has(aw)) return 'aviation-runway';
    return null;
  }

  function lineFromGeometry(geometry) {
    if (!geometry || geometry.length < 2) return null;
    return geometry.map((p) => [p.lat, p.lon]);
  }

  function ringFromGeometry(geometry) {
    const line = lineFromGeometry(geometry);
    if (!line || line.length < 3) return null;
    const first = line[0];
    const last = line[line.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) line.push(first);
    return [line];
  }

  function elementToFeatures(el) {
    const layerId = classifyTransportElement(el);
    if (!layerId) return [];
    const tags = el.tags || {};
    const props = { ...tags, _layerId: layerId };

    if (el.type === 'node' && el.lat != null && el.lon != null) {
      return [{
        type: 'Feature',
        properties: props,
        geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
      }];
    }

    if (el.type === 'way' && el.geometry) {
      if (layerId === 'aviation-airport') {
        const ring = ringFromGeometry(el.geometry);
        if (ring) {
          return [{
            type: 'Feature',
            properties: props,
            geometry: { type: 'Polygon', coordinates: ring.map((ringLine) => ringLine.map(([lat, lon]) => [lon, lat])) },
          }];
        }
      }
      const line = lineFromGeometry(el.geometry);
      if (!line) return [];
      return [{
        type: 'Feature',
        properties: props,
        geometry: { type: 'LineString', coordinates: line.map(([lat, lon]) => [lon, lat]) },
      }];
    }

    if (el.type === 'relation' && el.members) {
      const lines = [];
      (el.members || []).forEach((member) => {
        if (member.type === 'way' && member.geometry) {
          const line = lineFromGeometry(member.geometry);
          if (line) lines.push(line.map(([lat, lon]) => [lon, lat]));
        }
      });
      if (!lines.length) return [];
      return [{
        type: 'Feature',
        properties: props,
        geometry: lines.length === 1
          ? { type: 'LineString', coordinates: lines[0] }
          : { type: 'MultiLineString', coordinates: lines },
      }];
    }

    return [];
  }

  function osmByLayer(osmData) {
    const byLayer = {};
    TRANSPORT_LAYER_IDS.forEach((id) => { byLayer[id] = []; });
    (osmData.elements || []).forEach((el) => {
      elementToFeatures(el).forEach((feature) => {
        const id = feature.properties._layerId;
        if (byLayer[id]) byLayer[id].push(feature);
      });
    });
    return byLayer;
  }

  function emptyTransportByLayer() {
    const byLayer = {};
    TRANSPORT_LAYER_IDS.forEach((id) => { byLayer[id] = []; });
    return byLayer;
  }

  function mergeLayerPayload(byLayer, data) {
    if (!data?.layers) return;
    Object.keys(data.layers).forEach((id) => {
      if (byLayer[id]) {
        byLayer[id] = data.layers[id] || [];
      }
    });
    // Migrate cache v8 single aviation-route bucket into typed layers.
    const legacy = data.layers['aviation-route'];
    if (legacy?.length) {
      legacy.forEach((feature) => {
        const props = feature.properties || {};
        const layerId = classifyFlightLayerId(props);
        if (byLayer[layerId]) byLayer[layerId].push(feature);
      });
    }
  }

  function bboxMatchesCached(metaBbox, bbox) {
    if (!metaBbox) return true;
    return ['s', 'w', 'n', 'e'].every((k) => Math.abs(Number(metaBbox[k]) - Number(bbox[k])) < 1e-6);
  }

  function validateTransportMeta(meta, bbox) {
    if (!meta) return false;
    if (meta.cacheVersion && meta.cacheVersion !== OSM_AVIATION_CACHE_VERSION) return false;
    return bboxMatchesCached(meta.bbox, bbox);
  }

  function normalizeSplitCorePayload(coreData, bbox) {
    if (!coreData?.layers || !validateTransportMeta(coreData.meta, bbox)) return null;
    const transportByLayer = emptyTransportByLayer();
    mergeLayerPayload(transportByLayer, coreData);
    const featureCount = coreData.meta?.featureCount ||
      Object.values(transportByLayer).reduce((n, f) => n + f.length, 0);
    return {
      transportByLayer,
      featureCount,
      _fromLocalFile: true,
      _splitBundle: true,
    };
  }

  let aviationCorePromise = null;
  let aviationDetailPromise = null;
  let aviationRawPromise = null;
  let aviationDataPromise = null;

  function startAviationPrefetch() {
    if (aviationCorePromise) return;
    aviationCorePromise = fetch(LOCAL_OSM_AVIATION_CORE_URL)
      .then((resp) => (resp.ok ? resp.json() : null))
      .catch(() => null);
    aviationDetailPromise = fetch(LOCAL_OSM_AVIATION_DETAIL_URL)
      .then((resp) => (resp.ok ? resp.json() : null))
      .catch(() => null);
    aviationRawPromise = fetch(LOCAL_OSM_AVIATION_URL)
      .then((resp) => (resp.ok ? resp.json() : null))
      .catch(() => null);
  }

  async function loadAviationData(bbox) {
    startAviationPrefetch();
    const coreData = await aviationCorePromise;
    const splitPayload = normalizeSplitCorePayload(coreData, bbox);
    if (splitPayload) {
      splitPayload._detailPromise = aviationDetailPromise;
      return splitPayload;
    }

    const rawData = await aviationRawPromise;
    if (rawData?.elements?.length && validateTransportMeta(rawData.meta, bbox)) {
      const transportByLayer = osmByLayer(rawData);
      const featureCount = Object.values(transportByLayer).reduce((n, f) => n + f.length, 0);
      return {
        transportByLayer,
        featureCount,
        _fromLocalFile: true,
        _splitBundle: false,
      };
    }

    throw new Error('Transport cache files missing. Run build-osm-aviation-data.bat');
  }

  function prefetchAviationData(bbox) {
    if (!aviationDataPromise) {
      aviationDataPromise = loadAviationData(bbox || AVIATION_BBOX);
    }
    return aviationDataPromise;
  }

  function nextFrame() {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(resolve);
      else setTimeout(resolve, 0);
    });
  }

  function buildPopupHtml(props, layerId, latlng) {
    const meta = TRANSPORT_LAYERS[layerId];
    const parts = [];
    const name = displayName(props);
    if (name) parts.push('<strong class="pwr-popup-name">' + escapeHtml(name) + '</strong>');
    else parts.push('<strong class="pwr-popup-name">' + escapeHtml(meta.shortLabel) + '</strong>');
    parts.push('<span class="pwr-popup-subtitle">' + escapeHtml(meta.label) + '</span>');
    if (props.rtl3d_route_class && ROUTE_CLASS_LABEL[props.rtl3d_route_class]) {
      parts.push('Route class: ' + escapeHtml(ROUTE_CLASS_LABEL[props.rtl3d_route_class]));
    }
    if (props.icao) parts.push('ICAO: ' + escapeHtml(props.icao));
    if (props.iata) parts.push('IATA: ' + escapeHtml(props.iata));
    if (props.ref && props.ref !== name) parts.push('Ref: ' + escapeHtml(props.ref));
    if (props.aeroway) parts.push('Aeroway: ' + escapeHtml(props.aeroway));
    const coords = formatCoords(latlng);
    if (coords) parts.push('Coordinates: ' + escapeHtml(coords));
    if (props._rtl3d_flight_route === 'true') {
      parts.push('<em>Illustrative corridor — not an official IFR chart.</em>');
    }
    if (props._rtl3d_openflights_route === 'true') {
      parts.push('<em>Scheduled airline route (OpenFlights) — illustrative great-circle path.</em>');
    }
    if (props._rtl3d_maritime_route === 'true') {
      parts.push('<em>Illustrative shipping corridor — not an official navigation chart.</em>');
    }
    return parts.join('<br>');
  }

  function createGeoJsonLayer(features, layerId, pane, map) {
    const meta = TRANSPORT_LAYERS[layerId];
    return L.geoJSON(
      { type: 'FeatureCollection', features },
      {
        pane: pane || undefined,
        pointToLayer(feature, latlng) {
          return L.circleMarker(latlng, {
            pane: pane || undefined,
            radius: meta.pointRadius || 6,
            color: '#0c4a6e',
            weight: 2,
            fillColor: meta.color,
            fillOpacity: 0.88,
            opacity: 0.95,
          });
        },
        style() {
          return {
            pane: pane || undefined,
            color: meta.color,
            weight: meta.weight || 3,
            opacity: meta.opacity || 0.9,
            dashArray: meta.dashArray || null,
            fillColor: meta.color,
            fillOpacity: layerId === 'aviation-airport' ? 0.15 : 0,
          };
        },
        onEachFeature(feature, layer) {
          layer.on('click', (e) => {
            L.popup({ className: 'lf-source-popup', maxWidth: 280 })
              .setLatLng(e.latlng)
              .setContent(buildPopupHtml(feature.properties || {}, layerId, e.latlng))
              .openOn(map);
          });
        },
      }
    );
  }

  function createLayerVisibilityController(map, layerRefs, layerMeta) {
    function setVisible(layerId, visible) {
      const layer = layerRefs[layerId];
      const meta = layerMeta[layerId];
      if (!layer || !meta) return;
      if (visible) {
        if (!map.hasLayer(layer)) map.addLayer(layer);
      } else if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    }

    function refresh() {
      const zoom = map.getZoom();
      TRANSPORT_LAYER_IDS.forEach((id) => {
        const meta = layerMeta[id];
        const layer = layerRefs[id];
        if (!meta || !layer) return;
        const cb = document.querySelector(`input[data-aviation-layer-id="${id}"]`);
        const want = cb ? cb.checked : true;
        const okZoom = zoom >= (meta.minZoom || 0);
        setVisible(id, want && okZoom);
      });
      if (layerRefs.stations) {
        const cb = document.querySelector('input[data-aviation-layer-id="stations"]');
        const want = cb ? cb.checked : true;
        setVisible('stations', want);
      }
    }

    map.on('zoomend', refresh);
    return { refresh, setVisible };
  }

  function addLayerRows(panel, layerIds, visibilityCtrl) {
    layerIds.forEach((id) => {
      const meta = TRANSPORT_LAYERS[id];
      const row = L.DomUtil.create('label', 'power-layers-row', panel);
      const cb = L.DomUtil.create('input', '', row);
      cb.type = 'checkbox';
      cb.checked = true;
      cb.dataset.aviationLayerId = id;

      const swatch = L.DomUtil.create('span', 'power-layers-swatch', row);
      if (id === 'maritime-route') {
        swatch.className += ' maritime-swatch';
        swatch.style.cssText =
          'border-top:3px dashed #f97316;background:transparent;height:0;width:14px;';
      } else {
        swatch.style.cssText =
          meta.dashArray
            ? `border-top:3px dashed ${meta.color};background:transparent;height:0;width:14px;`
            : `background:${meta.color};`;
      }

      const text = L.DomUtil.create('span', 'power-layers-label', row);
      text.textContent = meta.shortLabel;
      cb.addEventListener('change', () => visibilityCtrl.refresh());
    });
  }

  function createAviationLayersControl(map, layerRefs, visibilityCtrl) {
    const Control = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const container = L.DomUtil.create('div', 'power-layers-control water-layers-control aviation-layers-control');
        const toggle = L.DomUtil.create('button', 'power-layers-toggle', container);
        toggle.type = 'button';
        toggle.title = 'Layers';
        toggle.setAttribute('aria-label', 'Toggle transport layers');
        toggle.innerHTML =
          '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">' +
          '<path fill="currentColor" d="M12 2L2 7l10 5 10-5-10-5zm0 7L2 4v3l10 5 10-5V4l-10 5zm0 4.5L2 8.5v3L12 17l10-5.5v-3L12 13.5z"/>' +
          '</svg>';

        const panel = L.DomUtil.create('div', 'power-layers-panel', container);
        panel.setAttribute('data-no-drag-scroll', '');
        L.DomUtil.create('div', 'power-layers-title', panel).textContent = 'Layers';

        const maritimeHeading = L.DomUtil.create('div', 'power-layers-heading', panel);
        maritimeHeading.textContent = 'Maritime';
        addLayerRows(panel, ['maritime-route'], visibilityCtrl);

        const aviationHeading = L.DomUtil.create('div', 'power-layers-heading', panel);
        aviationHeading.textContent = 'Aviation';
        const routesHeading = L.DomUtil.create('div', 'power-layers-subheading', panel);
        routesHeading.textContent = 'Flight routes';
        addLayerRows(panel, FLIGHT_ROUTE_LAYER_IDS, visibilityCtrl);
        const infraHeading = L.DomUtil.create('div', 'power-layers-subheading', panel);
        infraHeading.textContent = 'Infrastructure';
        addLayerRows(panel, ['aviation-runway', 'aviation-airport'], visibilityCtrl);

        if (layerRefs.stations) {
          const stationsHeading = L.DomUtil.create('div', 'power-layers-heading', panel);
          stationsHeading.textContent = 'Stations';
          const row = L.DomUtil.create('label', 'power-layers-row', panel);
          const cb = L.DomUtil.create('input', '', row);
          cb.type = 'checkbox';
          cb.checked = true;
          cb.dataset.aviationLayerId = 'stations';
          L.DomUtil.create('span', 'power-layers-swatch station', row);
          const text = L.DomUtil.create('span', 'power-layers-label', row);
          text.textContent = 'Observation stations';
          cb.addEventListener('change', () => visibilityCtrl.refresh());
        }

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

  function legendSwatchStyle(layerId, meta) {
    if (layerId === 'maritime-route') {
      return 'border-top:3px dashed #f97316;background:transparent;height:0;width:14px;';
    }
    if (meta.dashArray) {
      return `border-top:3px dashed ${meta.color};background:transparent;height:0;width:14px;`;
    }
    return `background:${meta.color};`;
  }

  function updateAviationLegend(mapEl, usedIds) {
    const legend = mapEl.closest('.map-wrap')?.querySelector('.map-legend-aviation, .map-legend-safety');
    if (!legend) return;
    const used = new Set(usedIds);
    const spans = TRANSPORT_LAYER_IDS.filter((id) => used.has(id)).map((id) => {
      const meta = TRANSPORT_LAYERS[id];
      const legClass = id === 'maritime-route' ? 'maritime-v dashed' : (meta.dashArray ? 'aviation-v dashed' : 'aviation-v');
      return (
        '<span><i class="leg ' + legClass + '" style="' + legendSwatchStyle(id, meta) + '"></i>' +
        escapeHtml(meta.shortLabel) +
        '</span>'
      );
    });
    legend.innerHTML =
      (spans.length ? '<div class="map-legend-group">' + spans.join('') + '</div>' : '') +
      '<span><i class="leg lf-vhf"></i> Observation stations</span>' +
      '<span><i class="leg jet"></i> Lightning (Jet = time)</span>' +
      '<span><i class="leg rad"></i> 15 km radiation zone</span>';
    if (typeof window.initDragScroll === 'function') window.initDragScroll(legend);
  }

  function setLoadStatus(mapEl, message) {
    let el = mapEl.querySelector('.aviation-infra-status');
    if (!message) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.className = 'aviation-infra-status power-lines-status';
      mapEl.appendChild(el);
    }
    el.textContent = message;
  }

  async function buildLayerTier(layerIds, transportByLayer, map, panes, layerRefs, layerMeta, usedIds) {
    for (let i = 0; i < layerIds.length; i++) {
      const layerId = layerIds[i];
      const features = transportByLayer[layerId] || [];
      layerMeta[layerId] = TRANSPORT_LAYERS[layerId];
      const pane = layerId === 'maritime-route' ? panes.maritime : panes.aviation;

      if (!features.length) {
        if (!layerRefs[layerId]) {
          layerRefs[layerId] = L.layerGroup([], { pane: pane || undefined });
        }
        continue;
      }

      if (!usedIds.includes(layerId)) usedIds.push(layerId);
      layerRefs[layerId] = createGeoJsonLayer(features, layerId, pane, map);
      if (i < layerIds.length - 1) await nextFrame();
    }
  }

  async function addAviationRoutesLayer(map, mapEl, stationsLayer, onLoaded) {
    setLoadStatus(mapEl, 'Loading transport map…');
    try {
      const payload = await prefetchAviationData(AVIATION_BBOX);
      const transportByLayer = payload.transportByLayer;
      const layerRefs = {};
      const layerMeta = {};
      const usedIds = [];

      const panes = { maritime: null, aviation: null };
      if (mapEl.dataset.lightningMap === 'true') {
        panes.maritime = 'maritimeInfra';
        panes.aviation = 'aviationInfra';
        if (!map.getPane(panes.maritime)) {
          map.createPane(panes.maritime);
          map.getPane(panes.maritime).style.zIndex = 506;
        }
        if (!map.getPane(panes.aviation)) {
          map.createPane(panes.aviation);
          map.getPane(panes.aviation).style.zIndex = 508;
        }
      }

      TRANSPORT_LAYER_IDS.forEach((layerId) => {
        const pane = layerId === 'maritime-route' ? panes.maritime : panes.aviation;
        layerRefs[layerId] = L.layerGroup([], { pane: pane || undefined });
        layerMeta[layerId] = TRANSPORT_LAYERS[layerId];
      });

      const tierIds = payload._splitBundle ? CORE_LAYER_IDS : TRANSPORT_LAYER_IDS;
      await buildLayerTier(tierIds, transportByLayer, map, panes, layerRefs, layerMeta, usedIds);

      if (stationsLayer) {
        layerRefs.stations = stationsLayer;
        layerMeta.stations = { minZoom: 0 };
      }

      const visibilityCtrl = createLayerVisibilityController(map, layerRefs, layerMeta);
      visibilityCtrl.refresh();
      createAviationLayersControl(map, layerRefs, visibilityCtrl).addTo(map);
      updateAviationLegend(mapEl, usedIds);
      publishTransportRiskIndex(mapEl, transportByLayer);

      if (payload._fromLocalFile) {
        setLoadStatus(mapEl, 'Loaded cached transport data.');
        setTimeout(() => setLoadStatus(mapEl, null), 1200);
      } else {
        setLoadStatus(mapEl, null);
      }

      if (onLoaded) onLoaded();

      if (payload._splitBundle) {
        const loadDetail = async () => {
          const detailData = await payload._detailPromise;
          if (!detailData?.layers || !validateTransportMeta(detailData.meta, AVIATION_BBOX)) return;

          mergeLayerPayload(transportByLayer, detailData);
          await buildLayerTier(
            DETAIL_LAYER_IDS,
            transportByLayer,
            map,
            panes,
            layerRefs,
            layerMeta,
            usedIds
          );
          visibilityCtrl.refresh();
          updateAviationLegend(mapEl, usedIds);
          publishTransportRiskIndex(mapEl, transportByLayer);
        };

        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(() => { loadDetail().catch(() => {}); }, { timeout: 500 });
        } else {
          setTimeout(() => { loadDetail().catch(() => {}); }, 80);
        }
      }
    } catch (err) {
      setLoadStatus(mapEl, 'Could not load transport data. Run build-osm-aviation-data.bat');
      console.warn('OSM transport layers:', err);
      if (onLoaded) onLoaded();
    }
  }

  startAviationPrefetch();

  window.addAviationRoutesLayer = addAviationRoutesLayer;
  window.prefetchAviationData = prefetchAviationData;
})();
