(function () {
  'use strict';

  const PHONE_MQ = window.matchMedia('(max-width: 900px)');

  function isPhoneLayout() {
    return PHONE_MQ.matches || document.documentElement.classList.contains('portrait-mobile');
  }

  function isMapFullscreen(map, panel) {
    return !!(
      map?._isFullscreen ||
      panel?.classList.contains('map-leaflet-fs-panel') ||
      panel?.classList.contains('leaflet-pseudo-fullscreen') ||
      document.fullscreenElement === panel
    );
  }

  function enableMapInteraction(map) {
    if (!map) return;
    if (map.dragging) map.dragging.enable();
    if (map.touchZoom) map.touchZoom.enable();
    if (map.doubleClickZoom) map.doubleClickZoom.enable();
    if (map.scrollWheelZoom) map.scrollWheelZoom.enable();
    if (map.boxZoom) map.boxZoom.enable();
    if (map.tap) map.tap.disable();
    const container = map.getContainer?.();
    if (container) {
      container.style.pointerEvents = 'auto';
      container.style.touchAction = 'none';
    }
  }

  function refreshMap(mapEl, map, refit) {
    if (!map) return;
    map.invalidateSize({ animate: false, pan: false });
    if (refit) {
      const bounds = mapEl.rtl3dStudyBounds;
      if (bounds && bounds.isValid && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: 10, animate: false });
      }
    }
    enableMapInteraction(map);
  }

  function setFullscreenUi(panel, open) {
    document.body.classList.toggle('map-leaflet-fs', open);
    panel.classList.toggle('map-leaflet-fs-panel', open);
    panel.classList.toggle('map-leaflet-locked', !open && isPhoneLayout());
  }

  function mountPanelToBody(panel) {
    if (panel.dataset.mapFsMounted === '1') return;
    const parent = panel.parentNode;
    if (!parent) return;
    const anchor = document.createComment('map-fs-anchor');
    parent.insertBefore(anchor, panel);
    panel._mapFsAnchor = anchor;
    panel._mapFsParent = parent;
    document.body.appendChild(panel);
    panel.dataset.mapFsMounted = '1';
  }

  function restorePanel(panel) {
    if (panel.dataset.mapFsMounted !== '1') return;
    const parent = panel._mapFsParent;
    const anchor = panel._mapFsAnchor;
    if (parent && anchor?.parentNode === parent) {
      parent.insertBefore(panel, anchor);
      anchor.remove();
    }
    delete panel._mapFsAnchor;
    delete panel._mapFsParent;
    delete panel.dataset.mapFsMounted;
  }

  function initLightningMapFullscreen(mapEl, map) {
    if (mapEl.dataset.leafletFsInit === '1') return;
    if (!map || !window.L?.Control?.FullScreen) return;
    mapEl.dataset.leafletFsInit = '1';

    const panel = mapEl.closest('.tnb-map-panel');
    if (!panel) return;

    let wrap = mapEl.parentElement;
    if (!wrap?.classList.contains('map-leaflet-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'map-leaflet-wrap';
      mapEl.parentNode.insertBefore(wrap, mapEl);
      wrap.appendChild(mapEl);
    }

    const gate = document.createElement('button');
    gate.type = 'button';
    gate.className = 'map-leaflet-phone-gate';
    gate.setAttribute('aria-label', 'Open fullscreen map to interact');
    gate.innerHTML =
      '<span class="map-leaflet-phone-gate-icon leaflet-fullscreen-icon" aria-hidden="true"></span>' +
      '<span class="map-leaflet-phone-gate-label">Tap for fullscreen map</span>';
    wrap.appendChild(gate);

    map.addControl(
      new L.Control.FullScreen({
        position: 'topright',
        title: 'Fullscreen map',
        titleCancel: 'Exit fullscreen map',
        fullscreenElement: panel,
        forceSeparateButton: true,
        forcePseudoFullscreen: true,
      })
    );

    function showGate() {
      if (!gate.isConnected) wrap.appendChild(gate);
      gate.hidden = false;
    }

    function hideGate() {
      gate.hidden = true;
      if (gate.parentNode) gate.parentNode.removeChild(gate);
    }

    function applyPhoneState() {
      const phone = isPhoneLayout();
      const open = isMapFullscreen(map, panel);
      panel.classList.toggle('map-leaflet-phone', phone);

      if (open) {
        hideGate();
        setFullscreenUi(panel, true);
        enableMapInteraction(map);
        return;
      }

      setFullscreenUi(panel, false);
      if (phone) showGate();
      else hideGate();
    }

    function onEnterFullscreen() {
      hideGate();
      mountPanelToBody(panel);
      setFullscreenUi(panel, true);
      requestAnimationFrame(() => {
        refreshMap(mapEl, map, true);
        setTimeout(() => refreshMap(mapEl, map, false), 150);
      });
    }

    function onExitFullscreen() {
      setFullscreenUi(panel, false);
      restorePanel(panel);
      applyPhoneState();
      requestAnimationFrame(() => refreshMap(mapEl, map, true));
    }

    map.on('enterFullscreen', onEnterFullscreen);
    map.on('exitFullscreen', onExitFullscreen);

    gate.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      map.fullscreenControl?.toggleFullScreen?.();
    });

    PHONE_MQ.addEventListener('change', applyPhoneState);

    applyPhoneState();
    enableMapInteraction(map);
  }

  function isFullscreenMapEl(mapEl) {
    return (
      mapEl.dataset.lightningMap === 'true' || mapEl.dataset.lightningRadar === 'true'
    );
  }

  window.addEventListener('rtl3d:map-ready', (ev) => {
    const { mapEl, map } = ev.detail || {};
    if (!mapEl || !map || !isFullscreenMapEl(mapEl)) return;
    initLightningMapFullscreen(mapEl, map);
  });
})();
