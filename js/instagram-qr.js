(function () {
  'use strict';

  var IG_URL = 'https://www.instagram.com/satreps_rtl3d';
  var IG_NAME = 'RTL3D · instagram.com/satreps_rtl3d';

  var modal = null;
  var qrContainer = null;

  function igIconSvg() {
    return (
      '<svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">' +
      '<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>' +
      '</svg>'
    );
  }

  function createModal() {
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'ig-qr-modal';
    modal.className = 'fb-qr-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'ig-qr-title');
    modal.hidden = true;

    modal.innerHTML =
      '<div class="fb-qr-backdrop" data-ig-close tabindex="-1"></div>' +
      '<div class="fb-qr-panel">' +
      '<button type="button" class="fb-qr-close" data-ig-close aria-label="Close">&times;</button>' +
      '<div class="fb-qr-icon ig-qr-icon" aria-hidden="true">' + igIconSvg() + '</div>' +
      '<h2 id="ig-qr-title" class="fb-qr-title" data-i18n="qr.ig.title">Follow us on Instagram</h2>' +
      '<div class="fb-qr-box" id="ig-qr-box" aria-hidden="true"></div>' +
      '<a class="fb-qr-handle" href="' + IG_URL + '" target="_blank" rel="noopener noreferrer">' + IG_NAME + '</a>' +
      '<a class="btn primary fb-qr-visit" href="' + IG_URL + '" target="_blank" rel="noopener noreferrer">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>' +
      '<span data-i18n="qr.ig.visit">Open Instagram</span>' +
      '</a>' +
      '<p class="fb-qr-hint" data-i18n="qr.hint">Scan the code, or open the page on this device</p>' +
      '</div>';

    document.body.appendChild(modal);
    qrContainer = modal.querySelector('#ig-qr-box');
    if (window.RTL3Di18n) window.RTL3Di18n.translateTree(modal);

    modal.querySelectorAll('[data-ig-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
  }

  function renderQr() {
    if (!qrContainer || typeof QRCode === 'undefined') return;
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: IG_URL,
      width: 200,
      height: 200,
      colorDark: '#001A3A',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  function openModal() {
    var show = function () {
      createModal();
      renderQr();
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
    document.querySelectorAll('[data-ig-qr]').forEach(function (el) {
      function open(e) {
        e.preventDefault();
        e.stopPropagation();
        openModal();
      }
      el.addEventListener('click', open);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') open(e);
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

  window.RTL3D_IG_QR = { open: openModal, close: closeModal };
})();
