(function () {
  'use strict';

  const RATIO = 16 / 9;
  const PORTRAIT_FILL_MAX_WIDTH = 900;

  function isPortraitMobile(vw, vh) {
    return vw <= 600 || (vh > vw && vw <= PORTRAIT_FILL_MAX_WIDTH);
  }

  function isObservationDetailPage() {
    const page = document.body.dataset.page;
    return page === 'efield' || page === 'gamma';
  }

  function isScrollContentPage() {
    const page = document.body.dataset.page;
    return page === 'home' || isObservationDetailPage();
  }

  function fitViewport() {
    if (document.body.classList.contains('map-leaflet-fs')) return;

    const frame = document.getElementById('viewport-frame');
    const vp = document.getElementById('viewport-169');
    const bar = document.querySelector('.top-bar');
    if (!vp) return;

    const vv = window.visualViewport;
    const vw = Math.round(vv?.width ?? window.innerWidth);
    const vh = Math.round(vv?.height ?? window.innerHeight);
    const barH = bar ? bar.offsetHeight : 0;

    const availW = Math.max(vw, 160);
    const availH = Math.max(vh - barH, 90);

    const portraitMobile = isPortraitMobile(availW, availH);
    const scrollContent = isScrollContentPage();
    const fillFrame = portraitMobile;
    document.documentElement.classList.toggle('portrait-mobile', portraitMobile);
    document.documentElement.classList.toggle('observation-detail-page', isObservationDetailPage());
    document.documentElement.classList.toggle('content-scroll-page', scrollContent);

    if (fillFrame) {
      vp.style.width = '100%';
      vp.style.height = '100%';
      vp.style.maxWidth = '100%';
      vp.style.maxHeight = '100%';
      if (frame) {
        frame.style.width = '100%';
        frame.style.flex = '1 1 auto';
      }
    } else {
      let w;
      let h;
      if (availW / availH >= RATIO) {
        h = availH;
        w = h * RATIO;
      } else {
        w = availW;
        h = w / RATIO;
      }
      w = Math.min(w, availW);
      h = Math.min(h, availH);
      vp.style.width = Math.floor(w) + 'px';
      vp.style.height = Math.floor(h) + 'px';
      vp.style.maxWidth = '100%';
      vp.style.maxHeight = '100%';
    }

    document.documentElement.style.setProperty('--viewport-w', availW + 'px');
    document.documentElement.style.setProperty('--viewport-h', availH + 'px');
    document.documentElement.style.setProperty('--viewport-ratio', String(RATIO));
    document.documentElement.style.setProperty('--top-bar-h', barH + 'px');
    document.documentElement.style.setProperty('--frame-h', availH + 'px');

    window.dispatchEvent(new CustomEvent('rtl3d:viewport-resize'));
  }

  fitViewport();
  requestAnimationFrame(fitViewport);
  window.addEventListener('resize', fitViewport);
  window.addEventListener('orientationchange', function () {
    window.setTimeout(fitViewport, 100);
  });
  document.addEventListener('fullscreenchange', fitViewport);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitViewport);
    window.visualViewport.addEventListener('scroll', fitViewport);
  }

  const frame = document.getElementById('viewport-frame');
  if (frame && window.ResizeObserver) {
    new ResizeObserver(fitViewport).observe(frame);
  }

  window.RTL3DViewport = { fit: fitViewport, ratio: RATIO };
})();
