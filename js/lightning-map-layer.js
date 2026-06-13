(function () {
  'use strict';

  const ORIGIN_LAT = 2.726931;
  const ORIGIN_LON = 102.24901;
  const ORIGIN_LAT_RAD = (ORIGIN_LAT * Math.PI) / 180;

  /** Radiation zone reach (km) and levels: inner black → red → outer yellow. */
  const RADIATION_RADIUS_KM = 15;
  const RADIATION_ZONES = [
    {
      km: 15,
      fillColor: '#facc15',
      color: '#ca8a04',
      label: '10–15 km',
      className: 'lf-radiation-zone-yellow',
      fillOpacity: 0.14,
      strokeOpacity: 0.75,
    },
    {
      km: 10,
      fillColor: '#ef4444',
      color: '#dc2626',
      label: '5–10 km',
      className: 'lf-radiation-zone-red',
      fillOpacity: 0.22,
      strokeOpacity: 0.85,
    },
    {
      km: 5,
      fillColor: '#111111',
      color: '#000000',
      label: '≤5 km',
      className: 'lf-radiation-zone-black',
      fillOpacity: 0.38,
      strokeOpacity: 0.95,
    },
  ];

  /** Plotly-compatible Jet stops (time → colour). */
  const JET_STOPS = [
    [0, [0, 0, 131]],
    [0.125, [0, 60, 170]],
    [0.375, [5, 255, 255]],
    [0.625, [255, 255, 0]],
    [0.875, [255, 0, 0]],
    [1, [128, 0, 0]],
  ];

  const MARKER_STYLE_BASE = {
    radius: 4,
    weight: 0,
    fillOpacity: 0.65,
    opacity: 0.9,
  };

  function rgbToHex(r, g, b) {
    return (
      '#' +
      [r, g, b]
        .map((v) => {
          const h = Math.round(v).toString(16);
          return h.length === 1 ? '0' + h : h;
        })
        .join('')
    );
  }

  function jetColor(u) {
    const t = Math.max(0, Math.min(1, u));
    for (let i = 0; i < JET_STOPS.length - 1; i++) {
      const [u0, c0] = JET_STOPS[i];
      const [u1, c1] = JET_STOPS[i + 1];
      if (t >= u0 && t <= u1) {
        const f = u1 === u0 ? 0 : (t - u0) / (u1 - u0);
        return rgbToHex(
          c0[0] + (c1[0] - c0[0]) * f,
          c0[1] + (c1[1] - c0[1]) * f,
          c0[2] + (c1[2] - c0[2]) * f
        );
      }
    }
    const last = JET_STOPS[JET_STOPS.length - 1][1];
    return rgbToHex(last[0], last[1], last[2]);
  }

  function flashTimeRange(flash) {
    if (!flash.t || !flash.t.length) return { tMin: 0, tMax: 1 };
    let tMin = flash.t[0];
    let tMax = flash.t[0];
    for (let i = 1; i < flash.t.length; i++) {
      if (flash.t[i] < tMin) tMin = flash.t[i];
      if (flash.t[i] > tMax) tMax = flash.t[i];
    }
    return { tMin, tMax };
  }

  function timeToJetColor(t, tMin, tMax) {
    const span = tMax - tMin;
    const u = span > 0 ? (t - tMin) / span : 0.5;
    return jetColor(u);
  }

  function kmToLatLng(xKm, yKm) {
    const lat = ORIGIN_LAT + yKm / 111.32;
    const lon = ORIGIN_LON + xKm / (111.32 * Math.cos(ORIGIN_LAT_RAD));
    return [lat, lon];
  }

  function formatCoords(lat, lon) {
    const latHem = lat >= 0 ? 'N' : 'S';
    const lngHem = lon >= 0 ? 'E' : 'W';
    return (
      Math.abs(lat).toFixed(5) +
      '\u00b0' +
      latHem +
      ', ' +
      Math.abs(lon).toFixed(5) +
      '\u00b0' +
      lngHem
    );
  }

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const lat = cy;
    const lng = cosLat === 0 ? center.lng : cx / cosLat;
    return { lat, lng, distanceKm: distanceKm(center, { lat, lng }) };
  }

  function distanceToLineFeature(center, feature) {
    const geom = feature.geometry;
    if (!geom || !geom.coordinates) {
      return { lat: center.lat, lng: center.lng, distanceKm: Infinity };
    }
    if (geom.type === 'MultiLineString') {
      let best = null;
      geom.coordinates.forEach((line) => {
        const hit = distanceToLineCoords(center, line);
        if (!best || hit.distanceKm < best.distanceKm) best = hit;
      });
      return best || { lat: center.lat, lng: center.lng, distanceKm: Infinity };
    }
    const coords = geom.coordinates;
    if (!coords || coords.length < 2) {
      return { lat: center.lat, lng: center.lng, distanceKm: Infinity };
    }
    return distanceToLineCoords(center, coords);
  }

  function distanceToLineCoords(center, coords) {
    if (!coords || coords.length < 2) {
      return { lat: center.lat, lng: center.lng, distanceKm: Infinity };
    }
    let best = null;
    for (let i = 0; i < coords.length - 1; i++) {
      const a = { lat: coords[i][1], lng: coords[i][0] };
      const b = { lat: coords[i + 1][1], lng: coords[i + 1][0] };
      const hit = closestPointOnSegment(center, a, b);
      if (!best || hit.distanceKm < best.distanceKm) best = hit;
    }
    return best;
  }

  function targetDistance(center, target) {
    if (target.kind === 'line') {
      if (target.coords && target.coords.length >= 2) {
        return distanceToLineCoords(center, target.coords);
      }
      if (target.feature) {
        return distanceToLineFeature(center, target.feature);
      }
      return { lat: center.lat, lng: center.lng, distanceKm: Infinity };
    }
    return {
      lat: target.lat,
      lng: target.lng,
      distanceKm: distanceKm(center, target),
    };
  }

  /** Radiation origin: centroid of sources at/below this height (km) — CG-dominated band. */
  const RADIATION_CG_MAX_HEIGHT_KM = 2;

  function flashCentroidAll(flash) {
    if (!flash.x || !flash.x.length) return null;
    let xSum = 0;
    let ySum = 0;
    for (let i = 0; i < flash.x.length; i++) {
      xSum += flash.x[i];
      ySum += flash.y[i];
    }
    const n = flash.x.length;
    const latlng = kmToLatLng(xSum / n, ySum / n);
    return { lat: latlng[0], lng: latlng[1] };
  }

  function flashRadiationCenter(flash) {
    if (!flash.x || !flash.x.length || !flash.z || !flash.z.length) return null;

    function centroidForFilter(testFn) {
      let xSum = 0;
      let ySum = 0;
      let count = 0;
      for (let i = 0; i < flash.x.length; i++) {
        if (!testFn(flash.z[i])) continue;
        xSum += flash.x[i];
        ySum += flash.y[i];
        count++;
      }
      if (!count) return null;
      const latlng = kmToLatLng(xSum / count, ySum / count);
      return { lat: latlng[0], lng: latlng[1], cgSources: count };
    }

    const cgCenter = centroidForFilter((z) => z <= RADIATION_CG_MAX_HEIGHT_KM);
    if (cgCenter) return cgCenter;

    let zMin = flash.z[0];
    for (let i = 1; i < flash.z.length; i++) {
      if (flash.z[i] < zMin) zMin = flash.z[i];
    }
    const zCeil = zMin + RADIATION_CG_MAX_HEIGHT_KM;
    const bandCenter = centroidForFilter((z) => z <= zCeil);
    if (bandCenter) return bandCenter;

    const fallback = flashCentroidAll(flash);
    return fallback ? { ...fallback, cgSources: 0 } : null;
  }

  function riskZoneForDistance(distanceKm) {
    if (distanceKm <= 5) {
      return {
        label: '≤5 km · critical',
        className: 'tnb-risk-zone-black',
        highlight: '#111111',
        ring: '#000000',
      };
    }
    if (distanceKm <= 10) {
      return {
        label: '5–10 km · high',
        className: 'tnb-risk-zone-red',
        highlight: '#ef4444',
        ring: '#dc2626',
      };
    }
    return {
      label: '10–15 km · moderate',
      className: 'tnb-risk-zone-yellow',
      highlight: '#facc15',
      ring: '#ca8a04',
    };
  }

  function ensureLightningPanes(map) {
    if (!map.getPane('lfRadiation')) {
      map.createPane('lfRadiation');
      map.getPane('lfRadiation').style.zIndex = 385;
    }
    if (!map.getPane('lfLightning')) {
      map.createPane('lfLightning');
      map.getPane('lfLightning').style.zIndex = 395;
    }
    if (!map.getPane('lfRiskHighlight')) {
      map.createPane('lfRiskHighlight');
      map.getPane('lfRiskHighlight').style.zIndex = 520;
    }
  }

  function buildRadiationLayer(map, center) {
    ensureLightningPanes(map);
    const group = L.layerGroup();

    RADIATION_ZONES.forEach((zone) => {
      const ring = L.circle([center.lat, center.lng], {
        pane: 'lfRadiation',
        radius: zone.km * 1000,
        color: zone.color,
        weight: 2,
        opacity: zone.strokeOpacity,
        fillColor: zone.fillColor,
        fillOpacity: zone.fillOpacity,
        className: 'lf-radiation-ring ' + zone.className,
        interactive: false,
      });
      ring.addTo(group);
    });

    const core = L.circleMarker([center.lat, center.lng], {
      pane: 'lfRadiation',
      radius: 5,
      color: '#000000',
      weight: 2,
      fillColor: '#111111',
      fillOpacity: 0.95,
      className: 'lf-radiation-core',
      interactive: false,
    });
    core.addTo(group);
    return group;
  }

  function findAllAtRiskAssets(center, targets, radiusKm) {
    if (!targets || !targets.length) return [];
    const hits = [];
    targets.forEach((target) => {
      const hit = targetDistance(center, target);
      if (hit.distanceKm > radiusKm) return;
      hits.push({ ...target, ...hit });
    });
    hits.sort((a, b) => a.distanceKm - b.distanceKm);
    return hits;
  }

  function buildRiskHighlightLayer(map, targets) {
    ensureLightningPanes(map);
    const group = L.layerGroup();
    const list = Array.isArray(targets) ? targets : [targets];
    const many = list.length > 24;
    const ringRadius = many ? 550 : 900;
    const markerRadius = many ? 5 : 8;

    list.forEach((target) => {
      const latlng = [target.lat, target.lng];
      const zone = riskZoneForDistance(target.distanceKm);
      L.circle(latlng, {
        pane: 'lfRiskHighlight',
        radius: ringRadius,
        color: zone.ring,
        weight: many ? 2 : 3,
        opacity: 0.9,
        fillColor: zone.highlight,
        fillOpacity: many ? 0.1 : 0.16,
        className: 'lf-risk-pulse-ring',
        interactive: false,
      }).addTo(group);

      L.circleMarker(latlng, {
        pane: 'lfRiskHighlight',
        radius: markerRadius,
        color: zone.ring,
        weight: 1.5,
        fillColor: zone.highlight,
        fillOpacity: 0.95,
        className: 'lf-risk-marker',
        interactive: false,
      }).addTo(group);
    });

    return group;
  }

  function buildPopupHtml(flash, index, lat, lon) {
    const z = flash.z[index];
    const t = flash.t[index];
    const parts = [
      '<strong class="lf-popup-title">Lightning source</strong>',
      '<div class="lf-popup-event">' + escapeHtml(flash.label) + '</div>',
      '<div class="lf-popup-row"><span>Height</span><strong>' + z.toFixed(2) + ' km</strong></div>',
      '<div class="lf-popup-row"><span>Time offset</span><strong>' + t.toFixed(1) + ' ms</strong></div>',
      '<div class="lf-popup-row"><span>Plan position</span><strong>' +
        flash.x[index].toFixed(2) +
        ' km E, ' +
        flash.y[index].toFixed(2) +
        ' km N</strong></div>',
      '<div class="lf-popup-row"><span>Coordinates</span><strong>' +
        formatCoords(lat, lon) +
        '</strong></div>',
    ];
    if (flash.n_sources_total) {
      parts.push(
        '<div class="lf-popup-meta">' +
          flash.n_sources_plot +
          ' of ' +
          flash.n_sources_total +
          ' localized sources (downsampled for display)</div>'
      );
    }
    return parts.join('');
  }

  function flashToLayer(flash) {
    const { tMin, tMax } = flashTimeRange(flash);
    const features = [];
    for (let i = 0; i < flash.x.length; i++) {
      const latlng = kmToLatLng(flash.x[i], flash.y[i]);
      features.push({
        type: 'Feature',
        properties: { i, t: flash.t[i] },
        geometry: { type: 'Point', coordinates: [latlng[1], latlng[0]] },
      });
    }

    return L.geoJSON(
      { type: 'FeatureCollection', features },
      {
        pane: 'lfLightning',
        pointToLayer(feature, latlng) {
          const fillColor = timeToJetColor(feature.properties.t, tMin, tMax);
          return L.circleMarker(latlng, {
            ...MARKER_STYLE_BASE,
            pane: 'lfLightning',
            color: fillColor,
            fillColor,
          });
        },
        onEachFeature(feature, layer) {
          const i = feature.properties.i;
          const ll = layer.getLatLng();
          layer.bindPopup(buildPopupHtml(flash, i, ll.lat, ll.lng), {
            closeButton: true,
            autoClose: true,
            className: 'lf-source-popup',
          });
        },
      }
    );
  }

  function lightningPrefix(mapEl) {
    return mapEl.dataset.lightningPrefix || 'tnb';
  }

  function lightningControl(mapEl, suffix) {
    const id = lightningPrefix(mapEl) + '-' + suffix;
    const panel = mapEl.closest('.tnb-map-panel');
    if (panel) {
      const inPanel = panel.querySelector('#' + id);
      if (inPanel) return inPanel;
    }
    return document.getElementById(id);
  }

  function usesInfraRisk(mapEl) {
    return mapEl.dataset.powerLines === 'true' || mapEl.dataset.waterInfrastructure === 'true';
  }

  function usesTransportRisk(mapEl) {
    return mapEl.dataset.aviationRoutes === 'true';
  }

  function bindRiskWarningToggle(warningEl) {
    if (!warningEl || warningEl.dataset.riskToggleBound === '1') return;
    warningEl.dataset.riskToggleBound = '1';

    function toggleCollapsed() {
      if (!warningEl.classList.contains('is-active') || !warningEl.classList.contains('is-multi')) {
        return;
      }
      warningEl.classList.toggle('is-collapsed');
      const expanded = !warningEl.classList.contains('is-collapsed');
      warningEl.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    warningEl.addEventListener('click', (event) => {
      if (!warningEl.classList.contains('is-active') || !warningEl.classList.contains('is-multi')) {
        return;
      }
      if (warningEl.classList.contains('is-collapsed')) {
        toggleCollapsed();
        return;
      }
      if (event.target.closest('.tnb-risk-head')) {
        toggleCollapsed();
      }
    });

    warningEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (!warningEl.classList.contains('is-active') || !warningEl.classList.contains('is-multi')) {
        return;
      }
      event.preventDefault();
      toggleCollapsed();
    });
  }

  function formatFlashEventTime(flash) {
    if (!flash) return null;
    if (flash.utc) return flash.utc;
    if (flash.label) {
      const stripped = flash.label.replace(/^Flash\s+\d+\s*[—–-]\s*/i, '').trim();
      return stripped || flash.label;
    }
    return null;
  }

  function buildRiskListItemHtml(item, opts) {
    const zone = riskZoneForDistance(item.distanceKm);
    let html =
      '<li class="' +
      zone.className +
      '"><span class="tnb-risk-zone-badge">' +
      escapeHtml(zone.label) +
      '</span> <strong>' +
      escapeHtml(item.name) +
      '</strong> <span class="tnb-risk-item-type">(' +
      escapeHtml(item.typeLabel) +
      ')</span> — ' +
      item.distanceKm.toFixed(1) +
      ' km<br><span class="tnb-risk-item-coords">' +
      escapeHtml(formatCoords(item.lat, item.lng)) +
      '</span>';

    const eventTime = opts.delayEventTime;
    const showDelay =
      eventTime &&
      (!opts.delayForRoutesOnly ||
        (item.layerId && item.layerId.indexOf('aviation-route') === 0));
    if (showDelay) {
      html +=
        '<br><span class="tnb-risk-item-delay">Time delay may occur at the lightning event time (' +
        escapeHtml(eventTime) +
        ').</span>';
    }

    return html + '</li>';
  }

  function renderRiskWarning(warningEl, mapBannerEl, opts) {
    if (!warningEl) return;
    const atRisk = Array.isArray(opts.atRisk) ? opts.atRisk : opts.atRisk ? [opts.atRisk] : [];
    const infraReady = opts.ready !== false;
    const assets = opts.assetPhrase || 'assets';
    const safePrefix = opts.safePrefix || 'No assets';
    const loadingSector = opts.loadingSector || 'infrastructure';
    const themeClass = opts.themeClass || '';

    if (!infraReady) {
      warningEl.hidden = false;
      warningEl.className = 'tnb-risk-warning' + (themeClass ? ' ' + themeClass : '');
      warningEl.removeAttribute('role');
      warningEl.removeAttribute('tabindex');
      warningEl.removeAttribute('aria-expanded');
      warningEl.innerHTML =
        '<span class="tnb-risk-badge tnb-risk-badge-pending">…</span>' +
        '<span class="tnb-risk-text">Loading ' +
        loadingSector +
        ' for radiation check (' +
        assets +
        ')…</span>';
      if (mapBannerEl) mapBannerEl.hidden = true;
      return;
    }

    if (!atRisk.length) {
      warningEl.hidden = false;
      warningEl.className = 'tnb-risk-warning is-safe' + (themeClass ? ' ' + themeClass : '');
      warningEl.removeAttribute('role');
      warningEl.removeAttribute('tabindex');
      warningEl.removeAttribute('aria-expanded');
      warningEl.innerHTML =
        '<span class="tnb-risk-badge tnb-risk-badge-safe">Clear</span>' +
        '<span class="tnb-risk-text">' +
        safePrefix +
        ' within ' +
        RADIATION_RADIUS_KM +
        ' km radiation zone.</span>';
      if (mapBannerEl) mapBannerEl.hidden = true;
      return;
    }

    const listItems = atRisk.map((item) => buildRiskListItemHtml(item, opts)).join('');

    warningEl.hidden = false;
    warningEl.className =
      'tnb-risk-warning is-active is-multi is-collapsed' + (themeClass ? ' ' + themeClass : '');
    warningEl.setAttribute('role', 'button');
    warningEl.setAttribute('tabindex', '0');
    warningEl.setAttribute('aria-expanded', 'false');
    warningEl.innerHTML =
      '<div class="tnb-risk-head">' +
      '<span class="tnb-risk-badge">WARNING</span>' +
      '<span class="tnb-risk-summary">' +
      atRisk.length +
      ' asset' +
      (atRisk.length === 1 ? '' : 's') +
      ' within ' +
      RADIATION_RADIUS_KM +
      ' km radiation zone</span>' +
      '<span class="tnb-risk-chevron" aria-hidden="true">▼</span>' +
      '</div>' +
      '<div class="tnb-risk-list-wrap" data-drag-scroll>' +
      '<ul class="tnb-risk-list">' +
      listItems +
      '</ul></div>';

    const riskScroll = warningEl.querySelector('.tnb-risk-list-wrap');
    if (riskScroll && typeof window.initDragScroll === 'function') {
      window.initDragScroll(riskScroll);
    }

    if (mapBannerEl) {
      mapBannerEl.hidden = false;
      mapBannerEl.className = 'tnb-map-risk-banner is-active' + (themeClass ? ' ' + themeClass : '');
      const preview = atRisk
        .slice(0, 3)
        .map(
          (item) =>
            escapeHtml(item.name) +
            ' (' +
            escapeHtml(item.typeLabel) +
            ', ' +
            item.distanceKm.toFixed(1) +
            ' km, ' +
            escapeHtml(formatCoords(item.lat, item.lng)) +
            ')'
        )
        .join('; ');
      const extra = atRisk.length > 3 ? '; +' + (atRisk.length - 3) + ' more' : '';
      mapBannerEl.innerHTML =
        '<span class="tnb-map-risk-badge">WARNING</span> ' +
        atRisk.length +
        ' at risk: ' +
        preview +
        extra;
    }
  }

  function updateTimeColorbar(flash, mapEl) {
    const bar = lightningControl(mapEl, 'flash-colorbar');
    const minEl = lightningControl(mapEl, 'flash-tmin');
    const maxEl = lightningControl(mapEl, 'flash-tmax');
    if (!bar || !minEl || !maxEl) return;
    const { tMin, tMax } = flashTimeRange(flash);
    minEl.textContent = tMin.toFixed(0) + ' ms';
    maxEl.textContent = tMax.toFixed(0) + ' ms';
    bar.style.visibility = flash.t && flash.t.length ? 'visible' : 'hidden';
  }

  async function loadFlashes() {
    if (window.LF_DATA && window.LF_DATA.flashes) {
      return window.LF_DATA.flashes;
    }
    const response = await fetch('data/lf/flashes.json', { cache: 'force-cache' });
    if (!response.ok) throw new Error('Lightning data unavailable');
    const payload = await response.json();
    return payload.flashes || [];
  }

  function populateFlashSelect(select, flashes) {
    select.innerHTML = '';
    flashes.forEach((flash, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = flash.label || 'Flash ' + (index + 1);
      select.appendChild(option);
    });
  }

  function initLightningMapLayer(map, mapEl) {
    const select = lightningControl(mapEl, 'flash-select');
    const showCheckbox = lightningControl(mapEl, 'flash-show');
    const statusEl = lightningControl(mapEl, 'flash-status');
    const warningEl = lightningControl(mapEl, 'risk-warning');
    const mapBannerEl = lightningControl(mapEl, 'map-risk-banner');
    const maritimeWarningEl = lightningControl(mapEl, 'maritime-risk-warning');
    const aviationWarningEl = lightningControl(mapEl, 'aviation-risk-warning');
    const maritimeMapBannerEl = lightningControl(mapEl, 'maritime-map-risk-banner');
    const aviationMapBannerEl = lightningControl(mapEl, 'aviation-map-risk-banner');
    const checkInfraRisk = usesInfraRisk(mapEl);
    const checkTransportRisk = usesTransportRisk(mapEl);
    const waterRisk = mapEl.dataset.waterInfrastructure === 'true';
    if (!select) return;

    let flashes = [];
    let currentLayer = null;
    let radiationLayer = null;
    let riskHighlightLayer = null;
    let currentIndex = 0;
    let ready = false;
    let infraTargets = mapEl._infraRiskTargets || [];
    let infraIndexLoaded = !checkInfraRisk;
    let maritimeTargets = (mapEl._transportRiskIndex && mapEl._transportRiskIndex.maritime) || [];
    let aviationTargets = (mapEl._transportRiskIndex && mapEl._transportRiskIndex.aviation) || [];
    let transportIndexLoaded = !checkTransportRisk;

    [warningEl, maritimeWarningEl, aviationWarningEl].forEach(bindRiskWarningToggle);

    function setStatus(message, isError) {
      if (!statusEl) return;
      statusEl.textContent = message || '';
      statusEl.classList.toggle('is-error', !!isError);
    }

    function riskAssetPhrase() {
      return waterRisk
        ? 'dams, reservoirs, lakes, rivers, or drainage channels affecting water areas'
        : 'transmission lines, towers, transformers, or substations';
    }

    function setRiskWarning(atRiskList, infraReady) {
      if (!checkInfraRisk) return;
      renderRiskWarning(warningEl, mapBannerEl, {
        atRisk: atRiskList,
        ready: infraReady,
        loadingSector: waterRisk ? 'water assets' : 'grid assets',
        assetPhrase: riskAssetPhrase(),
        safePrefix: 'No ' + riskAssetPhrase(),
      });
    }

    function setTransportRiskWarnings(center, flash) {
      if (!checkTransportRisk) return [];
      const maritimeAtRisk =
        center && transportIndexLoaded
          ? findAllAtRiskAssets(center, maritimeTargets, RADIATION_RADIUS_KM)
          : [];
      const aviationAtRisk =
        center && transportIndexLoaded
          ? findAllAtRiskAssets(center, aviationTargets, RADIATION_RADIUS_KM)
          : [];
      const eventTime = formatFlashEventTime(flash);

      renderRiskWarning(maritimeWarningEl, maritimeMapBannerEl, {
        atRisk: maritimeAtRisk,
        ready: transportIndexLoaded,
        loadingSector: 'maritime routes',
        assetPhrase: 'ferry routes and shipping corridors',
        safePrefix: 'No maritime routes',
        themeClass: 'tnb-risk-warning-maritime',
      });
      renderRiskWarning(aviationWarningEl, aviationMapBannerEl, {
        atRisk: aviationAtRisk,
        ready: transportIndexLoaded,
        loadingSector: 'aviation routes',
        assetPhrase: 'flight routes and airports',
        safePrefix: 'No aviation routes or airports',
        themeClass: 'tnb-risk-warning-aviation',
        delayEventTime: eventTime,
        delayForRoutesOnly: true,
      });

      return maritimeAtRisk.concat(aviationAtRisk);
    }

    function hideTransportRiskWarnings() {
      if (maritimeWarningEl) maritimeWarningEl.hidden = true;
      if (aviationWarningEl) aviationWarningEl.hidden = true;
      if (maritimeMapBannerEl) maritimeMapBannerEl.hidden = true;
      if (aviationMapBannerEl) aviationMapBannerEl.hidden = true;
    }

    function clearRadiationAndRisk() {
      if (radiationLayer && map.hasLayer(radiationLayer)) {
        map.removeLayer(radiationLayer);
      }
      if (riskHighlightLayer && map.hasLayer(riskHighlightLayer)) {
        map.removeLayer(riskHighlightLayer);
      }
      radiationLayer = null;
      riskHighlightLayer = null;
    }

    function clearLayer() {
      clearRadiationAndRisk();
      if (currentLayer && map.hasLayer(currentLayer)) {
        map.removeLayer(currentLayer);
      }
      currentLayer = null;
    }

    function updateFlashStatus(center) {
      if (!statusEl || !flashes.length) return;
      let base;
      if (checkInfraRisk) {
        base =
          flashes.length +
          ' events — Jet = time; radiation centre = CG sources ≤' +
          RADIATION_CG_MAX_HEIGHT_KM +
          ' km height.';
      } else if (checkTransportRisk) {
        base =
          flashes.length +
          ' events — Jet = time; radiation checks maritime & aviation routes within 15 km.';
      } else {
        base =
          flashes.length +
          ' events — Jet = time; rings = 15 km radiation zones from near-ground sources (≤' +
          RADIATION_CG_MAX_HEIGHT_KM +
          ' km).';
      }
      if (!center || center.cgSources == null) {
        statusEl.textContent = base;
        return;
      }
      if (center.cgSources > 0) {
        statusEl.textContent = base + ' (' + center.cgSources + ' near-ground sources this flash.)';
      } else {
        statusEl.textContent = base + ' (fallback centroid — no sources ≤' + RADIATION_CG_MAX_HEIGHT_KM + ' km.)';
      }
    }

    function updateRiskAssessment(flash) {
      const center = flashRadiationCenter(flash);
      if (!center) {
        if (checkInfraRisk) setRiskWarning([], infraIndexLoaded);
        if (checkTransportRisk) setTransportRiskWarnings(null);
        return;
      }

      radiationLayer = buildRadiationLayer(map, center);
      radiationLayer.addTo(map);

      let atRisk = [];

      if (checkInfraRisk) {
        atRisk = infraIndexLoaded
          ? findAllAtRiskAssets(center, infraTargets, RADIATION_RADIUS_KM)
          : [];
        setRiskWarning(atRisk, infraIndexLoaded);
      } else {
        if (warningEl) warningEl.hidden = true;
        if (mapBannerEl) mapBannerEl.hidden = true;
      }

      if (checkTransportRisk) {
        const transportAtRisk = setTransportRiskWarnings(center, flash);
        atRisk = atRisk.concat(transportAtRisk);
      }

      if (!checkInfraRisk && !checkTransportRisk) {
        if (warningEl) warningEl.hidden = true;
        if (mapBannerEl) mapBannerEl.hidden = true;
        updateFlashStatus(center);
        return;
      }

      if (atRisk.length) {
        riskHighlightLayer = buildRiskHighlightLayer(map, atRisk);
        riskHighlightLayer.addTo(map);
      }

      updateFlashStatus(center);
    }

    function applyFlash() {
      if (!ready || !flashes.length) return;
      clearLayer();
      if (!showCheckbox || !showCheckbox.checked) {
        if (warningEl) warningEl.hidden = true;
        if (mapBannerEl) mapBannerEl.hidden = true;
        hideTransportRiskWarnings();
        return;
      }

      const flash = flashes[currentIndex];
      if (!flash || !flash.x || !flash.x.length) return;

      updateRiskAssessment(flash);

      currentLayer = flashToLayer(flash);
      currentLayer.addTo(map);
      updateTimeColorbar(flash, mapEl);
    }

    function onFlashChange() {
      currentIndex = parseInt(select.value, 10) || 0;
      applyFlash();
    }

    function onInfraIndexReady(event) {
      infraTargets = (event.detail && event.detail.targets) || mapEl._infraRiskTargets || [];
      infraIndexLoaded = true;
      if (ready && showCheckbox && showCheckbox.checked) {
        applyFlash();
      }
    }

    if (showCheckbox) {
      showCheckbox.addEventListener('change', () => applyFlash());
    }

    function onTransportIndexReady(event) {
      const detail = event.detail || mapEl._transportRiskIndex || {};
      maritimeTargets = detail.maritime || [];
      aviationTargets = detail.aviation || [];
      transportIndexLoaded = true;
      if (ready && showCheckbox && showCheckbox.checked) {
        applyFlash();
      }
    }

    if (checkInfraRisk) {
      mapEl.addEventListener('rtl3d:infra-risk-index', onInfraIndexReady);
    }

    if (checkTransportRisk) {
      mapEl.addEventListener('rtl3d:transport-risk-index', onTransportIndexReady);
    }

    setStatus('Loading lightning events\u2026');

    loadFlashes()
      .then((data) => {
        flashes = data;
        if (!flashes.length) {
          setStatus('No lightning events in dataset.', true);
          select.disabled = true;
          return;
        }
        populateFlashSelect(select, flashes);
        select.addEventListener('change', onFlashChange);
        ready = true;
        setStatus(
          flashes.length +
            (checkInfraRisk
              ? waterRisk
                ? ' events — Jet = time; radiation checks dams, storage, rivers & drains within 15 km.'
                : ' events — Jet = time; radiation checks grid assets within 15 km.'
              : checkTransportRisk
                ? ' events — Jet = time; radiation checks maritime & aviation routes within 15 km.'
                : ' events — Jet = time; shaded rings show 15 km radiation zones.')
        );
        applyFlash();
      })
      .catch((err) => {
        console.warn('Lightning layer:', err);
        setStatus('Could not load lightning data.', true);
        select.disabled = true;
      });
  }

  window.initLightningMapLayer = initLightningMapLayer;
})();
