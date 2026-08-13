(function () {
  'use strict';

  var modal = null;
  var qrContainer = null;
  var titleEl = null;
  var nameEl = null;
  var logoEl = null;
  var visitEl = null;

  function createModal() {
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'partner-qr-modal';
    modal.className = 'fb-qr-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'partner-qr-title');
    modal.hidden = true;

    modal.innerHTML =
      '<div class="fb-qr-backdrop" data-partner-qr-close tabindex="-1"></div>' +
      '<div class="fb-qr-panel partner-qr-panel">' +
      '<button type="button" class="fb-qr-close" data-partner-qr-close aria-label="Close">&times;</button>' +
      '<div class="partner-qr-logo" id="partner-qr-logo" aria-hidden="true"></div>' +
      '<h2 id="partner-qr-title" class="fb-qr-title"></h2>' +
      '<div class="fb-qr-box partner-qr-box" id="partner-qr-box" aria-hidden="true"></div>' +
      '<a class="fb-qr-handle" id="partner-qr-name" href="#" target="_blank" rel="noopener noreferrer"></a>' +
      '<a class="btn primary fb-qr-visit" id="partner-qr-visit" href="#" target="_blank" rel="noopener noreferrer">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
      '<span data-i18n="qr.partner.visit">Open website</span>' +
      '</a>' +
      '<p class="fb-qr-hint" data-i18n="qr.hint">Scan the code, or open the page on this device</p>' +
      '</div>';

    document.body.appendChild(modal);
    qrContainer = modal.querySelector('#partner-qr-box');
    titleEl = modal.querySelector('#partner-qr-title');
    nameEl = modal.querySelector('#partner-qr-name');
    logoEl = modal.querySelector('#partner-qr-logo');
    visitEl = modal.querySelector('#partner-qr-visit');
    if (window.RTL3Di18n) window.RTL3Di18n.translateTree(modal);

    modal.querySelectorAll('[data-partner-qr-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
  }

  function renderQr(url) {
    if (!qrContainer || typeof QRCode === 'undefined') return;
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: url,
      width: 200,
      height: 200,
      colorDark: '#001A3A',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  function openModal(opts) {
    var show = function () {
      createModal();
      var url = opts.url || '#';
      titleEl.textContent = opts.title || 'University website';
      nameEl.textContent = opts.label || url;
      nameEl.href = url;
      visitEl.href = url;
      logoEl.innerHTML = opts.logoSrc
        ? '<img src="' + opts.logoSrc + '" alt="">'
        : '';
      renderQr(url);
      if (window.RTL3Di18n) window.RTL3Di18n.translateTree(modal);
      modal.hidden = false;
      requestAnimationFrame(function () {
        modal.classList.add('open');
      });
      document.body.classList.add('modal-open');
      var closeBtn = modal.querySelector('.fb-qr-close');
      if (closeBtn) closeBtn.focus();
    };
    if (window.ensureQRCode) {
      window.ensureQRCode().then(show);
    } else {
      show();
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function bindTriggers() {
    document.querySelectorAll('[data-partner-qr]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var img = el.querySelector('img');
        openModal({
          url: el.getAttribute('data-qr-url') || '',
          title: el.getAttribute('data-qr-title') || '',
          label: el.getAttribute('data-qr-label') || '',
          logoSrc: img ? img.getAttribute('src') : '',
        });
      });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindTriggers);
  } else {
    bindTriggers();
  }
})();
