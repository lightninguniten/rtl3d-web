(function () {
  'use strict';

  // Idle "screensaver" for the home hub: after a period with no interaction,
  // an attract-loop of the lightning lesson takes over the screen. The first
  // touch / click / key / scroll dismisses it and returns to the hub.
  if (document.body.dataset.page !== 'home') return;

  var IDLE_MS = 60 * 1000;            // 1 minute (kiosk attract-loop)
  // Point at index.html explicitly so it works both over HTTP and from file://
  // (a bare "video/" path shows a directory listing on the file: scheme).
  var urlFn = (window.RTL3D_URL && window.RTL3D_URL.page) || function (s) { return s + '/'; };
  var VIDEO_SRC = urlFn('video') + 'index.html?kiosk=1&cycle=1&lang=en';

  var EXPLORE_DISMISS_MS = 5000;  // glass auto-hides back to the video after 5s

  var idleTimer = null;
  var exploreTimer = null;
  var active = false;          // screensaver showing
  var prompting = false;       // "Let's explore" glass is visible
  var overlay = null;
  var iframe = null;

  var TAP_HINT =
    'Click to explore / Tekan untuk lanjut / タップして探索';

  function stopIframeMedia() {
    if (!iframe) return;
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: 'rtl3d-video-stop' }, window.location.origin);
      }
    } catch (_) {}
    try { iframe.src = 'about:blank'; } catch (_) {}
  }

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'idle-screensaver';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="idle-screensaver-frame">' +
        '<div class="idle-screensaver-video">' +
          '<iframe title="Lightning in Malaysia — attract loop" ' +
            'tabindex="-1" aria-hidden="true" scrolling="no" ' +
            'allow="autoplay; fullscreen; encrypted-media" ' +
            'referrerpolicy="same-origin"></iframe>' +
        '</div>' +
        '<button type="button" class="idle-tap-hint">' + TAP_HINT + '</button>' +
      '</div>' +
      '<button type="button" class="idle-explore" aria-label="Return to the home page">' +
        '<span class="idle-explore-glass">' +
          '<span class="idle-explore-bolt" aria-hidden="true">⚡</span>' +
          '<span class="idle-explore-text">Let’s explore</span>' +
          '<span class="idle-explore-sub">Tap anywhere to enter</span>' +
        '</span>' +
      '</button>';
    document.body.appendChild(overlay);
    iframe = overlay.querySelector('iframe');

    var explore = overlay.querySelector('.idle-explore');
    var tapHint = overlay.querySelector('.idle-tap-hint');

    function onExploreTap(e) {
      e.preventDefault();
      e.stopPropagation();
      if (prompting) { hide(); }
      else { promptExplore(); }
    }

    if (tapHint) {
      tapHint.addEventListener('click', onExploreTap);
    }

    overlay.addEventListener('pointerdown', function (e) {
      if (e.target.closest('.idle-tap-hint') || e.target.closest('.idle-explore-glass')) return;
      e.preventDefault();
      e.stopPropagation();
      if (prompting) { hide(); }
      else { promptExplore(); }
    }, true);

    overlay.addEventListener('wheel', function (e) {
      e.stopPropagation();
      if (!prompting) promptExplore();
    }, { capture: true, passive: true });

    if (explore) {
      explore.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        hide();
      });
    }
  }

  function show() {
    if (active) return;
    active = true;
    prompting = false;
    if (!overlay) buildOverlay();
    overlay.classList.remove('show-explore');
    // (Re)load the looping, chrome-less lesson fresh each time it appears.
    iframe.src = VIDEO_SRC;
    requestAnimationFrame(function () { overlay.classList.add('is-on'); });
  }

  // Reveal the "Let's explore" glass without leaving yet. If the visitor
  // doesn't tap it within EXPLORE_DISMISS_MS, slip back to the looping video.
  function promptExplore() {
    if (!active) return;
    if (!prompting) {
      prompting = true;
      overlay.classList.add('show-explore');
    }
    // (re)start the auto-dismiss countdown on every bit of activity
    window.clearTimeout(exploreTimer);
    exploreTimer = window.setTimeout(dismissExplore, EXPLORE_DISMISS_MS);
  }

  // Hide the glass but keep the screensaver video running.
  function dismissExplore() {
    if (!active || !prompting) return;
    prompting = false;
    window.clearTimeout(exploreTimer);
    overlay.classList.remove('show-explore');
  }

  function hide() {
    if (!active) return;
    active = false;
    prompting = false;
    window.clearTimeout(exploreTimer);
    stopIframeMedia();
    overlay.classList.remove('is-on');
    overlay.classList.remove('show-explore');
    arm();
  }

  function arm() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(show, IDLE_MS);
  }

  // Only deliberate interactions reset the idle countdown while the
  // screensaver is off. pointermove is intentionally excluded — on desktop
  // Chrome, simply moving the mouse over the page would otherwise reset the
  // timer forever and the attract-loop would never start.
  function resetIdle() {
    if (!active) arm();
  }

  // Global interaction while screensaver is showing:
  //  - keydown → go straight back to the hub
  //  - anything else → reveal the "Let's explore" glass (don't leave yet)
  function wake(e) {
    if (active) {
      if (e && e.type === 'keydown') { hide(); return; }
      promptExplore();
      return;
    }
    resetIdle();
  }

  var IDLE_RESET_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
  IDLE_RESET_EVENTS.forEach(function (ev) {
    window.addEventListener(ev, resetIdle, { passive: true, capture: true });
  });

  // Scroll only when the visitor actually scrolls page content (not ambient
  // pointer drift). Capture phase so nested .page-view scroll counts.
  window.addEventListener('scroll', resetIdle, { passive: true, capture: true });

  // Pause the countdown when the tab is hidden; restart it when visible again.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      window.clearTimeout(idleTimer);
    } else {
      if (active) hide();
      arm();
    }
  });

  // While the screensaver is up, key presses dismiss immediately.
  window.addEventListener('keydown', wake, { passive: true, capture: true });

  arm();

  // ?screensaver=1 → preview the attract loop right away (for demos/testing).
  // ?idle=SECONDS  → override the idle timeout (e.g. ?idle=8).
  try {
    var qs = new URLSearchParams(window.location.search);
    var idleOverride = parseFloat(qs.get('idle'));
    if (!isNaN(idleOverride)) { IDLE_MS = idleOverride * 1000; arm(); }
    if (qs.get('screensaver') === '1') { window.setTimeout(show, 400); }
  } catch (_) {}

  // expose for tuning/testing from the console
  window.RTL3D_IDLE = {
    show: show,
    hide: hide,
    setTimeoutMs: function (ms) { IDLE_MS = ms; arm(); }
  };
})();
