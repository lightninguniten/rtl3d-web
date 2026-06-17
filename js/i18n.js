(function () {
  'use strict';

  // Supported languages. `label` is shown in the header switcher button,
  // `html` is the value written to <html lang> for accessibility/SEO.
  const LANGS = [
    { code: 'en', label: 'EN', name: 'English', html: 'en' },
    { code: 'ms', label: 'BM', name: 'Bahasa Melayu', html: 'ms' },
    { code: 'ja', label: '日本語', name: '日本語', html: 'ja' },
  ];
  const STORE_KEY = 'rtl3d-lang';
  const dict = window.RTL3D_I18N || {};

  function isValid(code) {
    return LANGS.some((l) => l.code === code);
  }

  function readStored() {
    try {
      const s = localStorage.getItem(STORE_KEY);
      if (s && isValid(s)) return s;
    } catch (_) {}
    return null;
  }

  function detect() {
    const stored = readStored();
    if (stored) return stored;
    const nav = (navigator.language || 'en').toLowerCase();
    if (nav.startsWith('ms')) return 'ms';
    if (nav.startsWith('ja')) return 'ja';
    return 'en';
  }

  let current = detect();

  function t(key, lang) {
    lang = lang || current;
    const entry = dict[key];
    if (!entry) return null;
    return entry[lang] != null ? entry[lang] : entry.en;
  }

  function translateTree(root, lang) {
    lang = lang || current;
    const scope = root || document;

    scope.querySelectorAll('[data-i18n]').forEach((el) => {
      const v = t(el.getAttribute('data-i18n'), lang);
      if (v != null) el.textContent = v;
    });

    scope.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const v = t(el.getAttribute('data-i18n-html'), lang);
      if (v != null) el.innerHTML = v;
    });

    // data-i18n-attr="title:some.key;aria-label:other.key"
    scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
      el.getAttribute('data-i18n-attr').split(';').forEach((pair) => {
        const idx = pair.indexOf(':');
        if (idx < 0) return;
        const attr = pair.slice(0, idx).trim();
        const key = pair.slice(idx + 1).trim();
        if (!attr || !key) return;
        const v = t(key, lang);
        if (v != null) el.setAttribute(attr, v);
      });
    });
  }

  function apply(lang) {
    current = lang;
    const meta = LANGS.find((l) => l.code === lang) || LANGS[0];
    document.documentElement.setAttribute('lang', meta.html);
    translateTree(document, lang);
    syncSwitcher(lang);
    document.dispatchEvent(new CustomEvent('rtl3d:langchange', { detail: { lang } }));
  }

  function setLang(lang) {
    if (!isValid(lang)) return;
    try {
      localStorage.setItem(STORE_KEY, lang);
    } catch (_) {}
    apply(lang);
  }

  // ---- Header language switcher -------------------------------------------

  let switcherEl = null;

  function syncSwitcher(lang) {
    if (!switcherEl) return;
    const meta = LANGS.find((l) => l.code === lang) || LANGS[0];
    const labelEl = switcherEl.querySelector('.lang-current');
    if (labelEl) labelEl.textContent = meta.label;
    switcherEl.querySelectorAll('.lang-option').forEach((opt) => {
      opt.classList.toggle('is-active', opt.dataset.lang === lang);
      opt.setAttribute('aria-checked', opt.dataset.lang === lang ? 'true' : 'false');
    });
  }

  function buildSwitcher() {
    const actions = document.querySelector('.top-actions');
    if (!actions || document.querySelector('.lang-switcher')) return;

    const wrap = document.createElement('div');
    wrap.className = 'lang-switcher';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-icon lang-toggle';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Change language');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></svg>' +
      '<span class="lang-current">EN</span>';

    const menu = document.createElement('div');
    menu.className = 'lang-menu';
    menu.setAttribute('role', 'radiogroup');
    menu.hidden = true;
    LANGS.forEach((l) => {
      const opt = document.createElement('button');
      opt.type = 'button';
      opt.className = 'lang-option';
      opt.dataset.lang = l.code;
      opt.setAttribute('role', 'radio');
      opt.textContent = l.name;
      opt.addEventListener('click', () => {
        setLang(l.code);
        closeMenu();
      });
      menu.appendChild(opt);
    });

    function openMenu() {
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      document.addEventListener('click', onDocClick, true);
    }
    function closeMenu() {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', onDocClick, true);
    }
    function onDocClick(e) {
      if (!wrap.contains(e.target)) closeMenu();
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu.hidden) openMenu();
      else closeMenu();
    });

    wrap.appendChild(btn);
    wrap.appendChild(menu);
    // Place the switcher first in the actions cluster.
    actions.insertBefore(wrap, actions.firstChild);
    switcherEl = wrap;
  }

  window.RTL3Di18n = {
    t: t,
    apply: apply,
    setLang: setLang,
    translateTree: translateTree,
    get lang() {
      return current;
    },
    langs: LANGS,
  };

  function init() {
    buildSwitcher();
    apply(current);
  }

  // Defer scripts execute while readyState is already "interactive", before
  // DOMContentLoaded fires — and before later defer scripts (nav, featured)
  // build their content. Wait for DOMContentLoaded so generated nodes carrying
  // data-i18n are present when we first apply().
  if (document.readyState === 'complete') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }
})();
