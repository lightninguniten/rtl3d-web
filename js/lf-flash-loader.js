(function () {
  'use strict';

  const INDEX_URL = 'data/lf/flashes-index.json';
  const LEGACY_URL = 'data/lf/flashes.json';
  const SOURCE_URL = (id) => `data/lf/flashes/${id}.json`;

  let indexPromise = null;
  const sourceCache = new Map();

  function stripSources(flash) {
    if (!flash) return flash;
    const { x, y, z, t, ...meta } = flash;
    return meta;
  }

  function loadFlashIndex() {
    if (window.LF_DATA && Array.isArray(window.LF_DATA.flashes)) {
      return Promise.resolve(window.LF_DATA.flashes.map(stripSources));
    }
    if (!indexPromise) {
      indexPromise = fetch(INDEX_URL, { cache: 'force-cache' })
        .then((resp) => (resp.ok ? resp.json() : null))
        .then((payload) => {
          if (payload && Array.isArray(payload.flashes)) return payload.flashes;
          return fetch(LEGACY_URL, { cache: 'force-cache' })
            .then((r) => (r.ok ? r.json() : null))
            .then((legacy) => (legacy?.flashes || []).map(stripSources));
        })
        .catch(() => []);
    }
    return indexPromise;
  }

  function loadFlashSources(id) {
    if (window.LF_DATA && Array.isArray(window.LF_DATA.flashes)) {
      const embedded = window.LF_DATA.flashes.find((f) => f.id === id);
      if (embedded) return Promise.resolve(embedded);
    }
    if (sourceCache.has(id)) return sourceCache.get(id);
    const promise = fetch(SOURCE_URL(id), { cache: 'force-cache' })
      .then((resp) => (resp.ok ? resp.json() : null))
      .catch(() => null);
    sourceCache.set(id, promise);
    return promise;
  }

  function loadFlashEntry(meta) {
    if (!meta) return Promise.resolve(null);
    return loadFlashSources(meta.id).then((sources) => {
      if (!sources) return { ...meta };
      return { ...meta, ...sources };
    });
  }

  function loadAllFlashEntries() {
    return loadFlashIndex().then((index) => Promise.all(index.map((meta) => loadFlashEntry(meta))));
  }

  window.RTL3DFlashLoader = {
    loadFlashIndex,
    loadFlashSources,
    loadFlashEntry,
    loadAllFlashEntries,
  };
})();
