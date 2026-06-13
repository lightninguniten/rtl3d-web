(function () {
  'use strict';

  const DRAG_THRESHOLD = 4;
  const DRAG_SCROLL_SELECTOR = '[data-drag-scroll], .drag-scroll';

  function isScrollableY(el) {
    return el.scrollHeight > el.clientHeight + 1;
  }

  function isScrollableX(el) {
    return el.scrollWidth > el.clientWidth + 1;
  }

  function isScrollable(el) {
    return isScrollableY(el) || isScrollableX(el);
  }

  function isInteractiveTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest(
      'input, button, select, textarea, option, a[href], label, [data-no-drag-scroll]'
    );
  }

  function initDragScroll(el) {
    if (!el || el.nodeType !== 1 || el.dataset.dragScrollInit === 'true') return;
    el.dataset.dragScrollInit = 'true';

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startScrollTop = 0;
    let startScrollLeft = 0;
    let pointerId = null;
    let axis = null;

    function refreshScrollable() {
      el.classList.toggle('drag-scroll-active', isScrollable(el));
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      axis = null;
      pointerId = null;
      el.classList.remove('is-drag-scrolling');
      if (moved) {
        el.dataset.dragMoved = 'true';
        window.setTimeout(() => {
          delete el.dataset.dragMoved;
        }, 0);
      }
    }

    el.addEventListener(
      'wheel',
      (e) => {
        if (isScrollable(el)) e.stopPropagation();
      },
      { passive: true }
    );

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !isScrollable(el) || isInteractiveTarget(e.target)) return;
      const scrollY = isScrollableY(el);
      const scrollX = isScrollableX(el);
      dragging = true;
      moved = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startScrollTop = el.scrollTop;
      startScrollLeft = el.scrollLeft;
      axis = scrollY && scrollX ? null : scrollY ? 'y' : 'x';
    });

    el.addEventListener('pointermove', (e) => {
      if (!dragging || e.pointerId !== pointerId) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const useY = axis !== 'x' && (axis === 'y' || Math.abs(dy) >= Math.abs(dx));
      const delta = useY ? dy : dx;
      if (!moved && Math.abs(delta) < DRAG_THRESHOLD) return;
      if (!moved) {
        moved = true;
        el.classList.add('is-drag-scrolling');
        if (!el.hasPointerCapture(pointerId)) {
          el.setPointerCapture(pointerId);
        }
      }
      e.preventDefault();
      if (useY) {
        el.scrollTop = startScrollTop - dy;
      } else {
        el.scrollLeft = startScrollLeft - dx;
      }
    });

    el.addEventListener('pointerup', (e) => {
      if (e.pointerId !== pointerId) return;
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      endDrag();
    });

    el.addEventListener('pointercancel', (e) => {
      if (e.pointerId !== pointerId) return;
      endDrag();
    });

    el.addEventListener(
      'click',
      (e) => {
        if (el.dataset.dragMoved === 'true') {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );

    refreshScrollable();
    window.addEventListener('rtl3d:viewport-resize', refreshScrollable);
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(refreshScrollable);
      ro.observe(el);
    }
  }

  function initAllDragScroll(root) {
    const scope = root && root.nodeType === 1 ? root : document;
    if (scope !== document && scope.matches?.(DRAG_SCROLL_SELECTOR)) {
      initDragScroll(scope);
    }
    scope.querySelectorAll(DRAG_SCROLL_SELECTOR).forEach(initDragScroll);
  }

  function observeDragScroll() {
    if (typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-drag-scroll' &&
          mutation.target.nodeType === 1
        ) {
          initDragScroll(mutation.target);
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) initAllDragScroll(node);
        });
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-drag-scroll'],
    });
  }

  initAllDragScroll(document);
  observeDragScroll();

  window.initDragScroll = initDragScroll;
  window.initAllDragScroll = initAllDragScroll;
  window.RTL3DDragScroll = {
    init: initDragScroll,
    scan: initAllDragScroll,
  };
})();
