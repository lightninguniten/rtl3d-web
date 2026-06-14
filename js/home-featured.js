(function () {
  'use strict';

  if (document.body.dataset.page !== 'home') return;

  const track = document.getElementById('hub-featured-track');
  const viewport = document.getElementById('hub-featured-viewport');
  const roulette = document.getElementById('hub-featured-roulette');
  if (!track || !viewport || !roulette) return;

  const items = window.RTL3D_INTERACTIVE || [];
  if (!items.length) return;

  const VISIBLE_MIN = 3;
  const CARD_MIN_PX = 40;
  const TRANSITION_MS = 700;
  const GLIDE_MS_PER_ROW = 2000;
  const DRAG_THRESHOLD = 6;
  const FALLBACK_ROW_STEP = 44;
  const BOOT_MAX_FRAMES = 180;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const glideMsPerRow = prefersReduced ? GLIDE_MS_PER_ROW * 2.5 : GLIDE_MS_PER_ROW;

  let rowStep = 0;
  let index = 0;
  let count = items.length;
  let glideOffset = 0;
  let glideRaf = null;
  let lastGlideTs = 0;
  let pointerId = null;
  let pointerDown = false;
  let dragging = false;
  let dragStartY = 0;
  let dragStartOffset = 0;
  let dragMoved = false;
  let booted = false;
  let bootFrames = 0;

  function cardHtml(item) {
    return (
      '<span class="hub-featured-glow" aria-hidden="true"></span>' +
      `<span class="hub-featured-icon-wrap"><span class="hub-featured-icon" aria-hidden="true">${item.icon || '•'}</span></span>` +
      '<span class="hub-featured-copy">' +
      `<span class="hub-featured-title">${item.title}</span>` +
      `<span class="hub-featured-desc">${item.desc || ''}</span>` +
      '</span>' +
      '<span class="hub-featured-cta">Enter <span class="hub-arrow" aria-hidden="true">→</span></span>'
    );
  }

  function buildCards() {
    track.innerHTML = '';
    const render = (list) => {
      list.forEach((item) => {
        const a = document.createElement('a');
        a.href = item.file;
        a.className =
          `hub-featured-card liquid-glass hub-featured-card-${item.theme || 'map'} hub-link-unvisited`;
        a.dataset.pageId = item.id;
        a.setAttribute('aria-label', `Open ${item.title}`);
        a.innerHTML = cardHtml(item);
        track.appendChild(a);
      });
    };
    render(items);
    render(items);
    count = items.length;
  }

  function parseTransformY(transform) {
    if (!transform || transform === 'none') return 0;
    if (transform.startsWith('matrix3d')) {
      const parts = transform
        .slice(9, -1)
        .split(',')
        .map((s) => parseFloat(s.trim()));
      return Math.abs(parts[13] || 0);
    }
    if (transform.startsWith('matrix')) {
      const parts = transform
        .slice(7, -1)
        .split(',')
        .map((s) => parseFloat(s.trim()));
      return Math.abs(parts[5] || 0);
    }
    return 0;
  }

  function getCurrentOffsetY() {
    return parseTransformY(getComputedStyle(track).transform);
  }

  function indexFromOffset(y) {
    const i = Math.round(y / rowStep);
    return ((i % count) + count) % count;
  }

  function syncFromVisual() {
    const y = getCurrentOffsetY();
    index = indexFromOffset(y);
    glideOffset = Math.max(0, y - index * rowStep);
    if (glideOffset >= rowStep) glideOffset = 0;
  }

  function visibleCountForHeight(vpH, gap) {
    const maxVisible = Math.max(VISIBLE_MIN, Math.min(count, Math.floor((vpH + gap) / (CARD_MIN_PX + gap))));
    return maxVisible;
  }

  function ensureLayout() {
    const cards = track.querySelectorAll('.hub-featured-card');
    const card = cards[0];
    if (!card) return false;

    const gap = parseFloat(getComputedStyle(track).rowGap || getComputedStyle(track).gap) || 0;
    const vpH = viewport.clientHeight;
    if (vpH < 48) return false;

    const visible = visibleCountForHeight(vpH, gap);
    const cardH = Math.max(CARD_MIN_PX, (vpH - (visible - 1) * gap) / visible);
    rowStep = cardH + gap;

    cards.forEach((el) => {
      el.style.height = `${cardH}px`;
      el.style.minHeight = `${cardH}px`;
    });

    viewport.style.height = '';
    return rowStep > 0;
  }

  function renderPosition(animate) {
    track.style.transition = animate
      ? `transform ${TRANSITION_MS}ms cubic-bezier(0.4, 0, 0.15, 1)`
      : 'none';
    track.style.transform = `translate3d(0, ${-(index * rowStep + glideOffset)}px, 0)`;
  }

  function canAutoGlide() {
    return !dragging && !pointerDown && rowStep > 0;
  }

  function tickGlide(ts) {
    glideRaf = window.requestAnimationFrame(tickGlide);
    if (!canAutoGlide()) {
      lastGlideTs = 0;
      return;
    }

    if (!lastGlideTs) lastGlideTs = ts;

    const dt = Math.min(ts - lastGlideTs, 48);
    lastGlideTs = ts;
    glideOffset += (rowStep / glideMsPerRow) * dt;

    while (glideOffset >= rowStep) {
      glideOffset -= rowStep;
      index = (index + 1) % count;
    }

    renderPosition(false);
  }

  function startGlide() {
    if (!rowStep || glideRaf) return;
    lastGlideTs = 0;
    glideRaf = window.requestAnimationFrame(tickGlide);
  }

  function stepManual(dir) {
    if (!rowStep || dragging) return;
    syncFromVisual();
    index = ((index + dir) % count + count) % count;
    glideOffset = 0;
    renderPosition(true);
  }

  function boot() {
    if (!ensureLayout()) return false;

    if (!booted) {
      booted = true;
      window.dispatchEvent(new CustomEvent('rtl3d:featured-ready'));
      if (window.RTL3DPageVisits?.refreshHome) window.RTL3DPageVisits.refreshHome();
    }

    renderPosition(false);
    startGlide();
    return true;
  }

  function tryBoot() {
    bootFrames += 1;
    if (boot()) return;
    if (bootFrames < BOOT_MAX_FRAMES) {
      window.requestAnimationFrame(tryBoot);
      return;
    }
    rowStep = FALLBACK_ROW_STEP;
    viewport.style.height = '';
    boot();
  }

  function onWheel(e) {
    if (!rowStep) return;
    e.preventDefault();
    e.stopPropagation();
    stepManual(e.deltaY > 0 ? 1 : -1);
  }

  function relayout() {
    if (!ensureLayout()) return;
    glideOffset = Math.min(glideOffset, rowStep - 0.01);
    renderPosition(false);
    if (!glideRaf) startGlide();
  }

  roulette.setAttribute(
    'aria-label',
    'Interactive previews — drag or scroll to browse; auto-rotates continuously'
  );
  buildCards();
  window.requestAnimationFrame(tryBoot);

  window.addEventListener('resize', relayout);
  window.addEventListener('rtl3d:viewport-resize', relayout);
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(relayout);
    ro.observe(viewport);
    ro.observe(track);
    if (roulette) ro.observe(roulette);
  }

  roulette.addEventListener('wheel', onWheel, { passive: false });
  viewport.addEventListener('wheel', onWheel, { passive: false });

  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !rowStep) return;
    pointerId = e.pointerId;
    pointerDown = true;
    dragging = false;
    dragMoved = false;
    dragStartY = e.clientY;
    syncFromVisual();
    dragStartOffset = index * rowStep + glideOffset;
  });

  viewport.addEventListener('pointermove', (e) => {
    if (!pointerDown || e.pointerId !== pointerId || !rowStep) return;

    const dy = e.clientY - dragStartY;
    if (!dragging) {
      if (Math.abs(dy) < DRAG_THRESHOLD) return;
      dragging = true;
      dragMoved = true;
      syncFromVisual();
      dragStartOffset = index * rowStep + glideOffset;
      viewport.setPointerCapture(e.pointerId);
      e.preventDefault();
    }

    const dragY = dragStartOffset - dy;
    track.style.transition = 'none';
    track.style.transform = `translate3d(0, ${-dragY}px, 0)`;
  });

  function endPointer(e) {
    if (!pointerDown || e.pointerId !== pointerId) return;

    if (dragging) {
      try {
        if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId);
      } catch (_) {}

      const dy = e.clientY - dragStartY;
      const pos = dragStartOffset - dy;
      index = indexFromOffset(pos);
      glideOffset = 0;
      renderPosition(true);
      window.setTimeout(() => {
        dragMoved = false;
      }, 0);
    }

    pointerDown = false;
    dragging = false;
    pointerId = null;
  }

  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);

  viewport.addEventListener(
    'click',
    (e) => {
      if (!dragMoved) return;
      e.preventDefault();
      e.stopPropagation();
      dragMoved = false;
    },
    true
  );

  track.addEventListener('click', (e) => {
    const link = e.target.closest('a.hub-featured-card');
    if (!link || dragMoved) return;
    e.preventDefault();
    if (window.RTL3DPageVisits?.markVisitedPage) {
      const pageId = link.dataset.pageId;
      if (pageId) window.RTL3DPageVisits.markVisitedPage(pageId);
    }
    window.location.href = link.getAttribute('href') || link.href;
  });
})();
