(function () {
  'use strict';

  var modal = null;
  var qrContainer = null;
  var titleEl = null;
  var nameEl = null;
  var logoEl = null;

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
      '<p class="fb-qr-name" id="partner-qr-name"></p>' +
      '<p class="fb-qr-hint">Scan with your phone camera to visit the website</p>' +
      '</div>';

    document.body.appendChild(modal);
    qrContainer = modal.querySelector('#partner-qr-box');
    titleEl = modal.querySelector('#partner-qr-title');
    nameEl = modal.querySelector('#partner-qr-name');
    logoEl = modal.querySelector('#partner-qr-logo');

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
    createModal();
    titleEl.textContent = opts.title || 'University website';
    nameEl.textContent = opts.label || opts.url || '';
    logoEl.innerHTML = opts.logoSrc
      ? '<img src="' + opts.logoSrc + '" alt="">'
      : '';
    renderQr(opts.url);
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
