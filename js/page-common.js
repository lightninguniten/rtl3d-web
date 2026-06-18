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

  // --- Adaptive quality -----------------------------------------------------
  // The effect is NEVER turned off — we keep the bolts glowing on every device
  // and instead make each frame cheaper so even a very weak PC stays smooth.
  //   scale   : canvas backing-store size (CSS stretches it back to full, so
  //             the look is identical; fewer pixels = far less fill cost).
  //   frameMs : minimum ms between drawn frames (0 = follow the display).
  // We start from a static guess based on the device, then a runtime FPS
  // governor downshifts only if the machine actually can't keep up — and never
  // below a level where the animation still clearly reads.
  const QUALITY_TIERS = [
    { scale: 1.0, frameMs: 0 },   // 0 — full
    { scale: 0.75, frameMs: 0 },  // 1
    { scale: 0.6, frameMs: 33 },  // 2 — ~30 fps
    { scale: 0.5, frameMs: 40 },  // 3 — ~25 fps, floor (still alive)
  ];
  const reducedMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dpr = window.devicePixelRatio || 1;
  let qualityIndex = 0;
  // Coarse static hint: few cores / little RAM / save-data → start lower.
  if ((navigator.hardwareConcurrency || 8) <= 4
    || (navigator.deviceMemory || 8) <= 4
    || navigator.connection?.saveData
    || reducedMotion) {
    qualityIndex = 2;
  }
  let quality = QUALITY_TIERS[qualityIndex];

  function downshiftQuality() {
    if (qualityIndex >= QUALITY_TIERS.length - 1) return false;
    qualityIndex += 1;
    quality = QUALITY_TIERS[qualityIndex];
    resizeCanvas();
    return true;
  }

  function resizeCanvas() {
    const vp = document.getElementById('viewport-169');
    const w = vp ? vp.clientWidth : window.innerWidth;
    const h = vp ? vp.clientHeight : window.innerHeight;
    // Clamp for HiDPI: never allocate more than ~1.5× CSS pixels, then apply
    // the adaptive scale. CSS keeps the canvas at full display size.
    const px = Math.min(dpr, 1.5) * quality.scale;
    canvas.width = Math.max(1, Math.round(w * px));
    canvas.height = Math.max(1, Math.round(h * px));
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

  let lastDrawMs = 0;
  let slowFrames = 0;
  function drawBolts(now) {
    if (!animating) { rafId = null; return; }
    const t = now || performance.now();

    // Frame cap: on lower tiers we draw at most every quality.frameMs, leaving
    // the GPU idle in between instead of repainting faster than the eye needs.
    if (quality.frameMs && lastDrawMs && t - lastDrawMs < quality.frameMs) {
      rafId = requestAnimationFrame(drawBolts);
      return;
    }
    // Runtime governor: if frames keep arriving slower than the current tier's
    // budget (the machine can't hold the target), step down one tier. Only ever
    // downshifts, so it settles and never thrashes.
    if (lastDrawMs) {
      const budget = quality.frameMs || (1000 / 60);
      if (t - lastDrawMs > budget * 1.6) {
        if (++slowFrames >= 12) { slowFrames = 0; downshiftQuality(); }
      } else if (slowFrames > 0) {
        slowFrames -= 1;
      }
    }
    lastDrawMs = t;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const prevComposite = ctx.globalCompositeOperation;
    // Additive blending makes overlapping passes glow like glass, not stick.
    // The layered translucent strokes below build the glow on their own — we
    // deliberately avoid ctx.shadowBlur, which is by far the most expensive 2D
    // canvas op and forced this full-screen loop off the GPU fast path.
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
      ctx.strokeStyle = `rgba(96, 165, 250, ${alpha * 0.14})`;
      ctx.lineWidth = 11;
      ctx.stroke();

      // 2) Mid halo — fills the gap left by dropping the blur.
      trace();
      ctx.strokeStyle = `rgba(125, 185, 253, ${alpha * 0.22})`;
      ctx.lineWidth = 6;
      ctx.stroke();

      // 3) Translucent coloured body of the tube.
      trace();
      ctx.strokeStyle = `rgba(147, 197, 253, ${alpha * 0.5})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      // 4) Bright glossy white core highlight — gives the "glass" sheen.
      trace();
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.92})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      return true;
    });
    ctx.globalCompositeOperation = prevComposite;
    if (Math.random() < 0.008 && bolts.length < 3) bolts.push(createBolt());
    // Idle-pause: when nothing is alive, stop the RAF loop entirely instead of
    // clearing a blank full-screen buffer every frame forever. The flash
    // interval (and visibility/flash calls) kick it back on via kickAnimation.
    if (bolts.length === 0) { rafId = null; return; }
    rafId = requestAnimationFrame(drawBolts);
  }

  function kickAnimation() {
    if (animating && rafId == null) rafId = requestAnimationFrame(drawBolts);
  }

  function startBoltAnimation() {
    animating = true;
    kickAnimation();
  }

  function stopBoltAnimation() {
    animating = false;
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    lastDrawMs = 0;
    slowFrames = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bolts = [];
  }

  function flashBolts(count) {
    const n = Math.min(count || 2, 5 - bolts.length);
    for (let i = 0; i < n; i += 1) bolts.push(createBolt());
    kickAnimation();
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

  // While a video is actually playing, pausing the full-screen bg RAF stops the
  // browser from recompositing the animated canvas over every decoded video
  // frame — the dominant GPU cost on pages like /high-speed-video/. The bolts
  // resume the moment the video pauses or ends.
  let videosPlaying = 0;
  document.querySelectorAll('video').forEach((v) => {
    v.addEventListener('playing', () => {
      videosPlaying += 1;
      stopBoltAnimation();
    });
    const onIdle = () => {
      videosPlaying = Math.max(0, videosPlaying - 1);
      if (videosPlaying === 0 && !document.hidden) startBoltAnimation();
    };
    v.addEventListener('pause', onIdle);
    v.addEventListener('ended', onIdle);
    // page-common.js is the last deferred script, so an autoplay video may
    // already be playing before the listener attached — catch that case.
    if (!v.paused && !v.ended && v.readyState >= 3) {
      videosPlaying += 1;
      stopBoltAnimation();
    }
  });

  scheduleResizeCanvas();
  window.addEventListener('resize', scheduleResizeCanvas);
  const vp = document.getElementById('viewport-169');
  if (vp && window.ResizeObserver) new ResizeObserver(scheduleResizeCanvas).observe(vp);
  window.addEventListener('rtl3d:viewport-resize', scheduleResizeCanvas);
  if (animating) kickAnimation();
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
