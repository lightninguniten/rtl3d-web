(function () {
  'use strict';

  // Universal "fit text to its box" — every text element prefers its big
  // CSS size, but shrinks (never grows past CSS) until it no longer
  // overflows the nearest clipping box. Guarantees text can't exceed its box.

  const BLOCK_SEL =
    'h1,h2,h3,h4,h5,h6,p,li,figcaption,blockquote,button,label,dt,dd,td,th,caption,legend,summary';
  const LEAF_SEL = 'span,a,small,strong,em,b,i,time,code,cite,abbr,mark';

  // Min shrink ratio — never go below this fraction of the CSS-preferred size.
  const MIN_RATIO = 0.45;
  const ABS_MIN_PX = 8;
  const STEPS = 7; // binary-search steps → ~0.8% resolution

  let frame = null;
  let scheduled = false;

  function isSkippable(el) {
    if (!el || el.nodeType !== 1) return true;
    // Plotly / SVG / media manage their own text.
    if (el.closest('svg, .js-plotly-plot, .modebar, canvas')) return true;
    if (el.hasAttribute('data-no-fit')) return true;
    if (el.closest('[data-no-fit]')) return true;
    return false;
  }

  // Nearest ancestor that CLIPS (overflow hidden) — that is the box text
  // must fit inside. Scroll containers (auto/scroll) are allowed to scroll.
  function clipAncestor(el) {
    let p = el.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      const cs = getComputedStyle(p);
      if (cs.overflowX === 'hidden' || cs.overflowY === 'hidden') return p;
      p = p.parentElement;
    }
    return null;
  }

  function overflows(el, clip, clipRect) {
    // Own horizontal overflow (nowrap titles / long unbreakable words).
    if (el.scrollWidth > el.clientWidth + 1) return true;
    if (clip && clipRect) {
      const r = el.getBoundingClientRect();
      if (r.bottom > clipRect.bottom + 1) return true;
      if (r.right > clipRect.right + 1) return true;
    }
    return false;
  }

  function fitOne(el) {
    if (isSkippable(el)) return;
    if (!el.textContent || !el.textContent.trim()) return;

    // Reset to the CSS-preferred (big) size first so we re-evaluate on grow.
    el.style.fontSize = '';

    const base = parseFloat(getComputedStyle(el).fontSize);
    if (!base) return;

    const clip = clipAncestor(el);
    const clipRect = clip ? clip.getBoundingClientRect() : null;

    if (!overflows(el, clip, clipRect)) return; // fits big — leave it.

    const min = Math.max(ABS_MIN_PX, base * MIN_RATIO);
    let lo = min;
    let hi = base;
    let best = min;

    for (let i = 0; i < STEPS; i += 1) {
      const mid = (lo + hi) / 2;
      el.style.fontSize = mid + 'px';
      if (overflows(el, clip, clipRect)) {
        hi = mid;
      } else {
        best = mid;
        lo = mid;
      }
    }
    el.style.fontSize = best + 'px';
  }

  function collectTargets(root) {
    const blocks = Array.from(root.querySelectorAll(BLOCK_SEL));
    const blockSet = new Set(blocks);

    // Standalone leaf text (e.g. label spans, .stat-num) not already inside
    // a fitted block — those inherit the block's fitted size instead.
    const leaves = Array.from(root.querySelectorAll(LEAF_SEL)).filter((el) => {
      if (el.querySelector('*')) return false; // not a leaf
      if (!el.textContent || !el.textContent.trim()) return false;
      let p = el.parentElement;
      while (p) {
        if (blockSet.has(p)) return false;
        p = p.parentElement;
      }
      return true;
    });

    return blocks.concat(leaves);
  }

  function fitAll() {
    scheduled = false;
    const targets = collectTargets(document.body);
    // Innermost first so shrinking children relieves parent clip boxes.
    targets.sort((a, b) => {
      if (a.contains(b)) return 1;
      if (b.contains(a)) return -1;
      return 0;
    });
    for (let i = 0; i < targets.length; i += 1) fitOne(targets[i]);
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      // Two rAFs: let layout settle (clamp/cqh recompute) before measuring.
      frame = requestAnimationFrame(fitAll);
    });
  }

  let debounce = null;
  function scheduleDebounced() {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(schedule, 160);
  }

  // Initial run + after web fonts load (metrics change once DM Sans is ready).
  schedule();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(schedule).catch(function () {});
  }
  window.addEventListener('load', schedule);

  // Re-fit on any size change.
  window.addEventListener('resize', scheduleDebounced);
  window.addEventListener('rtl3d:viewport-resize', scheduleDebounced);
  window.addEventListener('orientationchange', scheduleDebounced);

  const vp = document.getElementById('viewport-169');
  if (vp && window.ResizeObserver) {
    new ResizeObserver(scheduleDebounced).observe(vp);
  }

  // Re-fit when JS injects content (home carousel/nav, network cards, lists…).
  if (window.MutationObserver) {
    const mo = new MutationObserver((muts) => {
      for (let i = 0; i < muts.length; i += 1) {
        if (muts[i].addedNodes && muts[i].addedNodes.length) {
          scheduleDebounced();
          return;
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  window.RTL3DFitText = { refit: schedule };
})();
