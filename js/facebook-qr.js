(function () {
  'use strict';

  var FB_URL = 'https://www.facebook.com/rtl3d';
  var FB_NAME = 'RTL3D · facebook.com/rtl3d';

  var modal = null;
  var qrContainer = null;

  function fbIconSvg() {
    return (
      '<svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28">' +
      '<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>' +
      '</svg>'
    );
  }

  function createModal() {
    if (modal) return;

    modal = document.createElement('div');
    modal.id = 'fb-qr-modal';
    modal.className = 'fb-qr-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'fb-qr-title');
    modal.hidden = true;

    modal.innerHTML =
      '<div class="fb-qr-backdrop" data-fb-close tabindex="-1"></div>' +
      '<div class="fb-qr-panel">' +
      '<button type="button" class="fb-qr-close" data-fb-close aria-label="Close">&times;</button>' +
      '<div class="fb-qr-icon" aria-hidden="true">' + fbIconSvg() + '</div>' +
      '<h2 id="fb-qr-title" class="fb-qr-title">Follow us on Facebook</h2>' +
      '<div class="fb-qr-box" id="fb-qr-box" aria-hidden="true"></div>' +
      '<p class="fb-qr-name">' + FB_NAME + '</p>' +
      '<p class="fb-qr-hint">Scan with your phone camera to visit our page</p>' +
      '</div>';

    document.body.appendChild(modal);
    qrContainer = modal.querySelector('#fb-qr-box');

    modal.querySelectorAll('[data-fb-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
  }

  function renderQr() {
    if (!qrContainer || typeof QRCode === 'undefined') return;
    qrContainer.innerHTML = '';
    new QRCode(qrContainer, {
      text: FB_URL,
      width: 200,
      height: 200,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M,
    });
  }

  function openModal() {
    createModal();
    renderQr();
    modal.hidden = false;
    requestAnimationFrame(function () {
      modal.classList.add('open');
    });
    document.body.classList.add('modal-open');
    var closeBtn = modal.querySelector('.fb-qr-close');
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('open');
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function bindTriggers() {
    document.querySelectorAll('[data-fb-qr]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openModal();
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

  window.RTL3D_FB_QR = { open: openModal, close: closeModal };
})();
