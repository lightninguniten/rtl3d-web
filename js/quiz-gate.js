(function () {
  'use strict';

  // On the home hub and social-impact page, intercept quiz links: ask whether
  // the visitor has watched the explainer first. If not, offer to play it.
  var page = document.body.dataset.page;
  if (page !== 'home' && page !== 'impact') return;

  var urlFn = (window.RTL3D_URL && window.RTL3D_URL.page) || function (s) { return s + '/'; };
  var QUIZ_URL = urlFn('quiz');
  // autoplay=1 → the video page starts immediately WITH audio (the modal
  // button click is the user gesture that lets the browser allow sound).
  var VIDEO_URL = urlFn('video') + 'index.html?autoplay=1';
  var WATCHED_KEY = 'rtl3d-watched-video';

  function hasWatched() {
    try { return localStorage.getItem(WATCHED_KEY) === '1'; } catch (_) { return false; }
  }

  var modal = null;

  function buildModal() {
    modal = document.createElement('div');
    modal.className = 'quiz-gate';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'quiz-gate-title');
    modal.innerHTML =
      '<div class="quiz-gate-card">' +
        '<div class="quiz-gate-bolt" aria-hidden="true">⚡</div>' +
        '<h2 id="quiz-gate-title" class="quiz-gate-title">Before the quiz…</h2>' +
        '<p class="quiz-gate-text">Have you watched the 1-minute lightning lesson yet? ' +
          'It covers every answer you’ll need.</p>' +
        '<div class="quiz-gate-actions">' +
          '<button type="button" class="quiz-gate-btn primary" data-act="watch">▶ Watch the video</button>' +
          '<button type="button" class="quiz-gate-btn" data-act="quiz">Skip — start the quiz</button>' +
        '</div>' +
        '<button type="button" class="quiz-gate-close" data-act="close" aria-label="Close">✕</button>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
      var act = (e.target.closest('[data-act]') || {}).dataset
        ? e.target.closest('[data-act]').dataset.act : null;
      // click on the dim backdrop (outside the card) closes
      if (e.target === modal) { close(); return; }
      if (!act) return;
      if (act === 'watch') { window.location.href = VIDEO_URL; }
      else if (act === 'quiz') { markWatched(); window.location.href = QUIZ_URL; }
      else if (act === 'close') { close(); }
    });

    document.addEventListener('keydown', function (e) {
      if (modal && modal.classList.contains('is-open') && e.key === 'Escape') close();
    });
  }

  function open() {
    if (!modal) buildModal();
    requestAnimationFrame(function () { modal.classList.add('is-open'); });
    var first = modal.querySelector('.quiz-gate-btn.primary');
    if (first) first.focus();
  }

  function close() {
    if (modal) modal.classList.remove('is-open');
  }

  function markWatched() {
    try { localStorage.setItem(WATCHED_KEY, '1'); } catch (_) {}
  }

  // Intercept the quiz tile (and any other quiz links on the hub).
  // Always ask — every time — whether to watch the video or skip to the quiz.
  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[data-page-id="quiz"], a[href$="quiz/"]');
    if (!link) return;
    e.preventDefault();
    e.stopPropagation();
    open();
  }, true);

  window.RTL3D_QUIZ_GATE = { open: open, close: close, reset: function () {
    try { localStorage.removeItem(WATCHED_KEY); } catch (_) {}
  } };

  // ?gate=1 → preview the prompt immediately (demo/testing).
  try {
    if (new URLSearchParams(window.location.search).get('gate') === '1') {
      window.setTimeout(open, 300);
    }
  } catch (_) {}
})();
