(function () {
  'use strict';

  const pages = window.RTL3D_PAGES || [];
  const extraPages = window.RTL3D_EXTRA || [];
  const pageId = document.body.dataset.page;
  const pageIndex = pages.findIndex((p) => p.id === pageId);
  const backBtn = document.getElementById('back-btn');
  const homeBtn = document.getElementById('home-btn');

  document.getElementById('fullscreen-btn')?.remove();
  document.body.classList.remove('fullscreen');
  document.documentElement.classList.remove('rtl3d-fs');
  try {
    sessionStorage.removeItem('rtl3d-fs');
  } catch (_) {}

  if (pageId && window.RTL3DPageVisits) {
    if (window.RTL3DPageVisits.markVisitedPage) {
      window.RTL3DPageVisits.markVisitedPage(pageId);
    } else {
      window.RTL3DPageVisits.markVisited(pageId);
    }
  }

  function sameOriginReferrer() {
    if (!document.referrer) return false;
    try {
      return new URL(document.referrer).origin === window.location.origin;
    } catch (_) {
      return false;
    }
  }

  function backFallbackUrl() {
    const extra = extraPages.find((p) => p.id === pageId);
    if (extra?.parent) {
      const parent = pages.find((p) => p.id === extra.parent);
      if (parent) return parent.file;
    }
    return null;
  }

  function canGoBack() {
    return sameOriginReferrer();
  }

  function goToPreviousPage() {
    if (canGoBack()) {
      window.history.back();
      return;
    }
    const fallback = backFallbackUrl();
    if (fallback) {
      window.location.href = fallback;
    }
  }

  function refreshBackButton() {
    if (!backBtn) return;
    const enabled = canGoBack() || !!backFallbackUrl();
    backBtn.classList.toggle('disabled', !enabled);
    if (enabled) backBtn.removeAttribute('aria-disabled');
    else backBtn.setAttribute('aria-disabled', 'true');
  }

  if (backBtn) {
    backBtn.setAttribute('href', '#');
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (backBtn.classList.contains('disabled')) return;
      goToPreviousPage();
    });
    refreshBackButton();
  }

  if (homeBtn && pageIndex === 0) {
    homeBtn.classList.add('disabled');
    homeBtn.setAttribute('aria-disabled', 'true');
  }

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea, .leaflet-container, .study-area-map')) return;
    if (pageIndex < 0) return;

    if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && pageIndex < pages.length - 1) {
      e.preventDefault();
      window.location.href = pages[pageIndex + 1].file;
    } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowUp') && pageIndex > 0) {
      e.preventDefault();
      window.location.href = pages[pageIndex - 1].file;
    } else if (e.key === 'Home') {
      e.preventDefault();
      window.location.href = pages[0].file;
    } else if (e.key === 'End') {
      e.preventDefault();
      window.location.href = pages[pages.length - 1].file;
    }
  });

  const canvas = document.getElementById('lightning-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let bolts = [];
  let rafId = null;
  // Always animate the background bolts (the old behaviour) — the effect is
  // subtle and is the signature look of the site.
  let animating = true;

  function resizeCanvas() {
    const vp = document.getElementById('viewport-169');
    const w = vp ? vp.clientWidth : window.innerWidth;
    const h = vp ? vp.clientHeight : window.innerHeight;
    canvas.width = w;
    canvas.height = h;
  }

  let resizeCanvasQueued = false;
  function scheduleResizeCanvas() {
    if (resizeCanvasQueued) return;
    resizeCanvasQueued = true;
    requestAnimationFrame(function () {
      resizeCanvasQueued = false;
      resizeCanvas();
    });
  }

  function createBolt() {
    const x = Math.random() * canvas.width;
    const segments = [];
    let cx = x;
    let cy = 0;
    const targetY = canvas.height * (0.3 + Math.random() * 0.5);
    while (cy < targetY) {
      const nx = cx + (Math.random() - 0.5) * 80;
      const ny = cy + 20 + Math.random() * 40;
      segments.push({ x1: cx, y1: cy, x2: nx, y2: ny });
      cx = nx;
      cy = ny;
    }
    return { segments, life: 1, maxLife: 0.15 + Math.random() * 0.1 };
  }

  function drawBolts() {
    if (!animating) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const prevComposite = ctx.globalCompositeOperation;
    // Additive blending makes overlapping passes glow like glass, not stick.
    ctx.globalCompositeOperation = 'lighter';
    bolts = bolts.filter((b) => {
      b.life -= 0.02;
      if (b.life <= 0) return false;
      const alpha = b.life / b.maxLife;

      // Trace the bolt path once, then stroke it in layered passes.
      const trace = () => {
        ctx.beginPath();
        b.segments.forEach((s, i) => {
          if (i === 0) ctx.moveTo(s.x1, s.y1);
          ctx.lineTo(s.x2, s.y2);
        });
      };

      // 1) Soft wide halo — the diffuse glow around the glass tube.
      trace();
      ctx.strokeStyle = `rgba(96, 165, 250, ${alpha * 0.16})`;
      ctx.lineWidth = 7;
      ctx.shadowColor = 'rgba(147, 197, 253, 0.9)';
      ctx.shadowBlur = 18 * alpha;
      ctx.stroke();

      // 2) Translucent coloured body of the tube.
      trace();
      ctx.strokeStyle = `rgba(147, 197, 253, ${alpha * 0.5})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(191, 219, 254, 0.8)';
      ctx.shadowBlur = 10 * alpha;
      ctx.stroke();

      // 3) Bright glossy white core highlight — gives the "glass" sheen.
      trace();
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.92})`;
      ctx.lineWidth = 1;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
      ctx.shadowBlur = 6 * alpha;
      ctx.stroke();

      ctx.shadowBlur = 0;
      return true;
    });
    ctx.globalCompositeOperation = prevComposite;
    if (Math.random() < 0.008 && bolts.length < 3) bolts.push(createBolt());
    rafId = requestAnimationFrame(drawBolts);
  }

  function startBoltAnimation() {
    if (animating) return;
    animating = true;
    drawBolts();
  }

  function stopBoltAnimation() {
    animating = false;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bolts = [];
  }

  function flashBolts(count) {
    const n = Math.min(count || 2, 5 - bolts.length);
    for (let i = 0; i < n; i += 1) bolts.push(createBolt());
  }

  window.RTL3DLightningBg = {
    flash: flashBolts,
  };

  // Periodic lightning flashes on every page (not just home) so the
  // animated background stays visibly alive throughout the site.
  const flashInterval = window.setInterval(() => {
    if (animating && Math.random() < 0.35) flashBolts(1);
  }, 2200);
  window.addEventListener('pagehide', () => {
    window.clearInterval(flashInterval);
  }, { once: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopBoltAnimation();
    else startBoltAnimation();
  });

  scheduleResizeCanvas();
  window.addEventListener('resize', scheduleResizeCanvas);
  const vp = document.getElementById('viewport-169');
  if (vp && window.ResizeObserver) new ResizeObserver(scheduleResizeCanvas).observe(vp);
  window.addEventListener('rtl3d:viewport-resize', scheduleResizeCanvas);
  if (animating) drawBolts();
})();

// Load the universal text auto-fit on every page (page-common.js is included
// site-wide, so this keeps the behaviour in one place — no per-page edits).
(function () {
  'use strict';
  if (window.__rtl3dFitLoaded) return;

  function loadFitText() {
    if (window.__rtl3dFitLoaded) return;
    window.__rtl3dFitLoaded = true;
    const s = document.createElement('script');
    s.src = 'js/auto-fit-text.js?v=2';
    s.defer = true;
    document.head.appendChild(s);
  }

  if (document.body.dataset.page === 'home' && 'requestIdleCallback' in window) {
    requestIdleCallback(loadFitText, { timeout: 3000 });
  } else {
    loadFitText();
  }
})();
