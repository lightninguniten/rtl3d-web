(function () {
  'use strict';

  const STORAGE_KEY = 'rtl3d-visits';
  const TTL_MS = 10 * 60 * 1000;

  function loadVisits() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function saveVisits(visits) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(visits));
    } catch (_) {}
  }

  function prune(visits) {
    const now = Date.now();
    let changed = false;
    Object.keys(visits).forEach((id) => {
      if (now - visits[id] > TTL_MS) {
        delete visits[id];
        changed = true;
      }
    });
    return changed;
  }

  function isVisited(pageId) {
    if (!pageId) return false;
    const visits = loadVisits();
    const t = visits[pageId];
    if (!t) return false;
    if (Date.now() - t > TTL_MS) {
      delete visits[pageId];
      saveVisits(visits);
      return false;
    }
    return true;
  }

  function markVisited(pageId) {
    if (!pageId || pageId === 'home') return;
    const visits = loadVisits();
    if (prune(visits)) saveVisits(visits);
    visits[pageId] = Date.now();
    saveVisits(visits);
  }

  function markVisitedPage(pageId) {
    if (!pageId || pageId === 'home') return;
    markVisited(pageId);
    const extra = (window.RTL3D_EXTRA || []).find((p) => p.id === pageId);
    if (extra?.parent) markVisited(extra.parent);
  }

  function fileToId(href) {
    if (!href) return null;
    const pages = window.RTL3D_PAGES || [];
    const extra = window.RTL3D_EXTRA || [];
    const slug = href.split('?')[0].split('#')[0].replace(/\/+$/, '').split('/').pop();
    if (!slug) return null;
    const match = [...pages, ...extra].find((p) => p.slug && p.slug === slug);
    return match ? match.id : null;
  }

  function linkPageId(el) {
    return el.dataset.pageId || fileToId(el.getAttribute('href'));
  }

  function setVisitState(el, pageId) {
    const visited = isVisited(pageId);
    el.classList.toggle('nav-box-visited', visited);
    el.classList.toggle('nav-box-unvisited', !visited);
    el.classList.toggle('hub-link-visited', visited);
    el.classList.toggle('hub-link-unvisited', !visited);
  }

  function decorateLink(el) {
    const pageId = linkPageId(el);
    if (!pageId) return;
    if (!el.dataset.pageId) el.dataset.pageId = pageId;
    setVisitState(el, pageId);
  }

  function decorateHome() {
    document
      .querySelectorAll('#section-nav a.nav-box, a.hub-featured-card[href]')
      .forEach(decorateLink);
  }

  let refreshTimer = null;
  let homeClicksBound = false;

  function bindHomeClicks() {
    if (document.body.dataset.page !== 'home') return;

    const nav = document.getElementById('section-nav');
    if (nav && !homeClicksBound) {
      homeClicksBound = true;
      nav.addEventListener('click', (e) => {
        const link = e.target.closest('a.nav-box');
        if (!link) return;
        const pageId = linkPageId(link);
        if (pageId) markVisitedPage(pageId);
      });
    }

    document.querySelectorAll('a.hub-featured-card[href]').forEach((el) => {
      if (el.dataset.visitClickBound === '1') return;
      el.dataset.visitClickBound = '1';
      el.addEventListener('click', () => {
        const pageId = linkPageId(el);
        if (pageId) markVisitedPage(pageId);
      });
    });
  }

  function scheduleHomeRefresh() {
    if (document.body.dataset.page !== 'home') return;
    if (refreshTimer) window.clearTimeout(refreshTimer);

    const visits = loadVisits();
    if (prune(visits)) saveVisits(visits);

    let next = TTL_MS;
    const now = Date.now();
    Object.values(visits).forEach((t) => {
      const remaining = TTL_MS - (now - t);
      if (remaining > 0 && remaining < next) next = remaining;
    });

    if (!Object.keys(visits).length) return;

    refreshTimer = window.setTimeout(() => {
      decorateHome();
      scheduleHomeRefresh();
    }, next + 100);
  }

  function refreshHome() {
    if (document.body.dataset.page !== 'home') return;
    decorateHome();
    bindHomeClicks();
    scheduleHomeRefresh();
  }

  window.RTL3DPageVisits = {
    markVisited,
    markVisitedPage,
    isVisited,
    decorateHome,
    refreshHome,
    scheduleHomeRefresh,
    TTL_MS,
  };

  function initHomeVisits() {
    if (document.body.dataset.page !== 'home') return;
    refreshHome();
    window.addEventListener('pageshow', refreshHome);
    window.addEventListener('rtl3d:home-nav-ready', refreshHome);
    window.addEventListener('rtl3d:featured-ready', refreshHome);
  }

  initHomeVisits();
})();
