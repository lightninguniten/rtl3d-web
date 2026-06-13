(function () {
  'use strict';

  const pages = window.RTL3D_PAGES || [];
  const sectionNav = document.getElementById('section-nav');
  if (!sectionNav) return;

  pages.forEach((page, i) => {
    if (i === 0) return;
    const link = document.createElement('a');
    link.href = page.file;
    link.className = 'nav-box';
    link.setAttribute('aria-label', `Open ${page.title}`);
    link.innerHTML =
      `<span class="nav-box-icon">${page.icon || '•'}</span>` +
      `<span class="nav-box-title">${page.title}</span>` +
      `<span class="nav-box-num">${String(i).padStart(2, '0')}</span>`;
    sectionNav.appendChild(link);
  });
})();
