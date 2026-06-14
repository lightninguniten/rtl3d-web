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
    return sameOriginReferrer() || window.history.length > 1;
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

  function resizeCanvas() {
    const vp = document.getElementById('viewport-169');
    const w = vp ? vp.clientWidth : window.innerWidth;
    const h = vp ? vp.clientHeight : window.innerHeight;
    canvas.width = w;
    canvas.height = h;
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    bolts = bolts.filter((b) => {
      b.life -= 0.02;
      if (b.life <= 0) return false;
      const alpha = b.life / b.maxLife;
      ctx.strokeStyle = `rgba(147, 197, 253, ${alpha * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12 * alpha;
      b.segments.forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      });
      ctx.shadowBlur = 0;
      return true;
    });
    if (Math.random() < 0.008 && bolts.length < 3) bolts.push(createBolt());
    requestAnimationFrame(drawBolts);
  }

  function flashBolts(count) {
    const n = Math.min(count || 2, 5 - bolts.length);
    for (let i = 0; i < n; i += 1) bolts.push(createBolt());
  }

  window.RTL3DLightningBg = {
    flash: flashBolts,
  };

  if (document.body.dataset.page === 'home') {
    const homeInterval = window.setInterval(() => {
      if (Math.random() < 0.35) flashBolts(1);
    }, 2200);
    window.addEventListener('pagehide', () => window.clearInterval(homeInterval), { once: true });
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  const vp = document.getElementById('viewport-169');
  if (vp && window.ResizeObserver) new ResizeObserver(resizeCanvas).observe(vp);
  window.addEventListener('rtl3d:viewport-resize', resizeCanvas);
  drawBolts();
})();
