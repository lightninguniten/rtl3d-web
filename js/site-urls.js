(function () {
  'use strict';

  function detectPrefix() {
    const el = document.querySelector('script[src*="site-pages.js"]');
    if (!el) return '';
    const src = el.getAttribute('src') || '';
    const m = src.match(/^((?:\.\.\/)+)/);
    return m ? m[1] : '';
  }

  const prefix = detectPrefix();

  function slugFromRef(ref) {
    if (!ref || ref === 'home' || ref === './' || ref === '/' || ref === 'index.html') return '';
    return String(ref)
      .replace(/^\.\//, '')
      .replace(/\.html$/i, '')
      .replace(/\/$/, '');
  }

  function pageUrl(ref) {
    const slug = slugFromRef(ref);
    if (!slug) return prefix || './';
    return prefix + slug + '/';
  }

  window.RTL3D_URL = {
    prefix: prefix,
    page: pageUrl,
    slug: slugFromRef,
  };
})();
