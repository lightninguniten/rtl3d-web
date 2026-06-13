(function () {
  'use strict';

  const RATIO = 16 / 9;

  function fitViewport() {
    const shell = document.querySelector('.viewport-shell');
    const frame = document.getElementById('viewport-frame');
    const vp = document.getElementById('viewport-169');
    const bar = document.querySelector('.top-bar');
    if (!shell || !vp) return;

    const vv = window.visualViewport;
    const vw = vv?.width ?? window.innerWidth;
    const vh = vv?.height ?? window.innerHeight;
    const barH = bar ? bar.offsetHeight : 0;

    let availW = vw;
    let availH = Math.max(vh - barH, 80);

    if (frame) {
      frame.style.width = '100%';
      frame.style.flex = '1 1 auto';
      availW = frame.clientWidth || availW;
      availH = frame.clientHeight || availH;
    }

    availW = Math.max(availW, 160);
    availH = Math.max(availH, 90);

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

    const wPx = Math.floor(w);
    const hPx = Math.floor(h);

    vp.style.width = wPx + 'px';
    vp.style.height = hPx + 'px';
    vp.style.maxWidth = '100%';
    vp.style.maxHeight = '100%';

    document.documentElement.style.setProperty('--viewport-w', wPx + 'px');
    document.documentElement.style.setProperty('--viewport-h', hPx + 'px');
    document.documentElement.style.setProperty('--top-bar-h', barH + 'px');
    document.documentElement.style.setProperty('--frame-h', availH + 'px');

    window.dispatchEvent(new CustomEvent('rtl3d:viewport-resize'));
  }

  fitViewport();
  requestAnimationFrame(fitViewport);
  window.addEventListener('resize', fitViewport);
  document.addEventListener('fullscreenchange', fitViewport);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitViewport);
  }

  const frame = document.getElementById('viewport-frame');
  if (frame && window.ResizeObserver) {
    new ResizeObserver(fitViewport).observe(frame);
  }

  window.RTL3DViewport = { fit: fitViewport };
})();
