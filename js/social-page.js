(function () {
  'use strict';

  if (document.body.dataset.page !== 'social') return;

  var DRAG_THRESHOLD = 3;

  function refreshScrollable(viewport) {
    var scrollable = viewport.scrollHeight > viewport.clientHeight + 1;
    viewport.classList.toggle('drag-scroll-active', scrollable);
  }

  function syncInnerHeight(viewport) {
    var inner = viewport.querySelector('.social-embed-inner');
    if (!inner) return;
    inner.style.minHeight = '';
    refreshScrollable(viewport);
  }

  function initDragPreview(viewport, shield) {
    var dragging = false;
    var moved = false;
    var pointerId = null;
    var startY = 0;
    var startScroll = 0;

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      pointerId = null;
      viewport.classList.remove('is-drag-scrolling');
      shield.classList.remove('is-drag-scrolling');
    }

    shield.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      dragging = true;
      moved = false;
      pointerId = e.pointerId;
      startY = e.clientY;
      startScroll = viewport.scrollTop;
      try { shield.setPointerCapture(e.pointerId); } catch (_) {}
    });

    shield.addEventListener('pointermove', function (e) {
      if (!dragging || e.pointerId !== pointerId) return;
      var dy = e.clientY - startY;
      if (!moved && Math.abs(dy) < DRAG_THRESHOLD) return;
      moved = true;
      e.preventDefault();
      e.stopPropagation();
      viewport.classList.add('is-drag-scrolling');
      shield.classList.add('is-drag-scrolling');
      viewport.scrollTop = startScroll - dy;
    });

    function onPointerEnd(e) {
      if (!dragging || e.pointerId !== pointerId) return;
      e.stopPropagation();
      try {
        if (shield.hasPointerCapture(e.pointerId)) shield.releasePointerCapture(e.pointerId);
      } catch (_) {}
      endDrag();
    }

    shield.addEventListener('pointerup', onPointerEnd);
    shield.addEventListener('pointercancel', onPointerEnd);

    shield.addEventListener('wheel', function (e) {
      e.preventDefault();
      e.stopPropagation();
      viewport.scrollTop += e.deltaY;
    }, { passive: false });
  }

  function initViewport(viewport) {
    if (!viewport || viewport.dataset.socialEmbedInit === '1') return;
    viewport.dataset.socialEmbedInit = '1';

    var shield = viewport.querySelector('.social-embed-shield');
    if (shield) initDragPreview(viewport, shield);

    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(function () { refreshScrollable(viewport); }).observe(viewport);
      var inner = viewport.querySelector('.social-embed-inner');
      if (inner) {
        new ResizeObserver(function () { refreshScrollable(viewport); }).observe(inner);
      }
    }

    refreshScrollable(viewport);
  }

  function boot() {
    document.querySelectorAll('.social-embed-viewport').forEach(initViewport);
    document.querySelectorAll('.social-embed-viewport').forEach(syncInnerHeight);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  document.addEventListener('rtl3d:social-feed-rendered', function () {
    document.querySelectorAll('.social-embed-viewport').forEach(function (viewport) {
      refreshScrollable(viewport);
      viewport.querySelectorAll('img').forEach(function (img) {
        if (!img.dataset.socialFeedBound) {
          img.dataset.socialFeedBound = '1';
          img.addEventListener('load', function () { refreshScrollable(viewport); });
        }
      });
    });
  });

  window.addEventListener('rtl3d:viewport-resize', boot);
})();
