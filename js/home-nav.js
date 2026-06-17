(function () {
  'use strict';

  const pages = window.RTL3D_PAGES || [];
  const sectionNav = document.getElementById('section-nav');
  if (!sectionNav) return;

  const glowIds = new Set(['network', 'imaging', 'impact', 'study-area']);

  pages.forEach((page, i) => {
    if (i === 0) return;
    const link = document.createElement('a');
    link.href = page.file;
    link.dataset.pageId = page.id;
    link.className = 'nav-box nav-box-unvisited' + (glowIds.has(page.id) ? ' nav-box-glow' : '');
    link.setAttribute('aria-label', page.desc ? `${page.title} — ${page.desc}` : `Open ${page.title}`);
    link.innerHTML =
      '<span class="nav-box-head">' +
      `<span class="nav-box-icon">${page.icon || '•'}</span>` +
      `<span class="nav-box-num">${String(i).padStart(2, '0')}</span>` +
      '</span>' +
      `<span class="nav-box-title" data-i18n="page.${page.id}.title">${page.title}</span>` +
      (page.desc ? `<span class="nav-box-desc" data-i18n="page.${page.id}.desc">${page.desc}</span>` : '');
    sectionNav.appendChild(link);
  });

  window.dispatchEvent(new CustomEvent('rtl3d:home-nav-ready'));
  if (window.RTL3DPageVisits?.refreshHome) {
    window.RTL3DPageVisits.refreshHome();
  }
})();
