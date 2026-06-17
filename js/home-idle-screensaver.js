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
  var VIDEO_SRC = urlFn('video') + 'index.html?loop=1&kiosk=1';

  var EXPLORE_DISMISS_MS = 5000;  // glass auto-hides back to the video after 5s

  var idleTimer = null;
  var exploreTimer = null;
  var active = false;          // screensaver showing
  var prompting = false;       // "Let's explore" glass is visible
  var overlay = null;
  var iframe = null;

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.className = 'idle-screensaver';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="idle-screensaver-frame">' +
        '<iframe title="Lightning in Malaysia — attract loop" ' +
          'tabindex="-1" aria-hidden="true" scrolling="no" ' +
          'allow="autoplay; fullscreen"></iframe>' +
      '</div>' +
      // Transparent "glass" prompt — appears on first hover/click; clicking it
      // returns to the main page.
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
    // First interaction surfaces the glass prompt; the next click on it leaves.
    overlay.addEventListener('pointermove', promptExplore, true);
    overlay.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (prompting) { hide(); }      // already prompting → go to main page
      else { promptExplore(); }       // first tap → reveal glass
    }, true);
    overlay.addEventListener('wheel', function (e) { e.stopPropagation(); promptExplore(); },
      { capture: true, passive: true });
    if (explore) {
      explore.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation(); hide();
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
    overlay.classList.remove('is-on');
    overlay.classList.remove('show-explore');
    // free the iframe (stops its rAF/animation + audio) after the fade-out
    window.setTimeout(function () {
      if (!active && iframe) iframe.src = 'about:blank';
    }, 500);
    arm();
  }

  function arm() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(show, IDLE_MS);
  }

  // Global interaction:
  //  - screensaver up  → reveal the "Let's explore" glass (don't leave yet);
  //                      a key press goes straight back to the hub.
  //  - screensaver off → just reset the idle countdown.
  function wake(e) {
    if (active) {
      if (e && e.type === 'keydown') { hide(); return; }
      promptExplore();
      return;
    }
    arm();
  }

  var EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'];
  EVENTS.forEach(function (ev) {
    window.addEventListener(ev, wake, { passive: true, capture: true });
  });

  // Pause the countdown when the tab is hidden; restart it when visible again.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      window.clearTimeout(idleTimer);
    } else {
      if (active) hide();
      arm();
    }
  });

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
