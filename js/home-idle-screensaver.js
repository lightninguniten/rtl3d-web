(function () {
  'use strict';

  // Idle "screensaver" for the home hub: after a period with no interaction,
  // an attract-loop of the lightning lesson takes over the screen. The first
  // touch / click / key / scroll dismisses it and returns to the hub.
  if (document.body.dataset.page !== 'home') return;

  var IDLE_MS = 60 * 1000;
  var urlFn = (window.RTL3D_URL && window.RTL3D_URL.page) || function (s) { return s + '/'; };
  var VIDEO_SRC = urlFn('video') + 'index.html?kiosk=1&cycle=1&silent=1&lang=en';

  var EXPLORE_DISMISS_MS = 5000;
  var AUDIO_CACHE = '15';
  var LANGS = ['en', 'ms', 'ja'];
  var NARRATION = {
    en: 'video/narration-en.mp3',
    ms: 'video/narration-ms.mp3',
    ja: 'video/narration-ja.mp3'
  };
  var BGM_SRC = 'bgmusic.mp3';
  var BGM_LANGS = { ms: true, ja: true };
  var BGM_VOLUME = { ms: 0.18, ja: 0.28 };

  var idleTimer = null;
  var exploreTimer = null;
  var active = false;
  var prompting = false;
  var overlay = null;
  var iframe = null;
  var narrationEl = null;
  var bgmEl = null;
  var currentLang = 'en';
  var cycleAdvanceLock = false;

  var TAP_HINT =
    'Click to explore / Tekan untuk lanjut / タップして探索';

  function postToIframe(data) {
    if (!iframe || !iframe.contentWindow) return;
    try {
      iframe.contentWindow.postMessage(data, window.location.origin);
    } catch (_) {}
  }

  function forcePlay(el) {
    if (!el) return;
    el.muted = false;
    var tries = 0;
    (function go() {
      var p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () {
          if (++tries < 80) window.setTimeout(go, 80);
        });
      }
    })();
  }

  function ensureParentAudio() {
    if (narrationEl) return;
    narrationEl = document.createElement('audio');
    narrationEl.id = 'idle-narration';
    narrationEl.preload = 'auto';
    narrationEl.setAttribute('playsinline', '');
    bgmEl = document.createElement('audio');
    bgmEl.id = 'idle-bgm';
    bgmEl.preload = 'auto';
    bgmEl.loop = true;
    bgmEl.setAttribute('playsinline', '');
    overlay.appendChild(narrationEl);
    overlay.appendChild(bgmEl);

    narrationEl.addEventListener('timeupdate', function () {
      postToIframe({ type: 'rtl3d-sync', t: narrationEl.currentTime });
      syncParentBgm();
    });

    narrationEl.addEventListener('ended', function () {
      if (!active || cycleAdvanceLock) return;
      cycleAdvanceLock = true;
      var i = LANGS.indexOf(currentLang);
      var next = LANGS[(i + 1) % LANGS.length];
      setParentLang(next, true);
      window.setTimeout(function () { cycleAdvanceLock = false; }, 400);
    });
  }

  function syncParentBgm() {
    if (!bgmEl || !BGM_LANGS[currentLang] || !narrationEl) return;
    var dur = bgmEl.duration;
    if (!dur || !isFinite(dur)) return;
    var target = narrationEl.currentTime % dur;
    if (Math.abs(bgmEl.currentTime - target) > 0.35) {
      try { bgmEl.currentTime = target; } catch (_) {}
    }
    if (bgmEl.paused) forcePlay(bgmEl);
  }

  function setParentLang(lang, autoplay) {
    currentLang = lang;
    if (!narrationEl) return;
    narrationEl.src = NARRATION[lang] + '?v=' + AUDIO_CACHE;
    narrationEl.load();
    if (autoplay) {
      narrationEl.currentTime = 0;
      forcePlay(narrationEl);
    }
    if (BGM_LANGS[lang]) {
      bgmEl.src = BGM_SRC + '?v=' + AUDIO_CACHE;
      bgmEl.volume = BGM_VOLUME[lang] != null ? BGM_VOLUME[lang] : 0.28;
      bgmEl.load();
      forcePlay(bgmEl);
    } else if (bgmEl) {
      bgmEl.pause();
      try { bgmEl.currentTime = 0; } catch (_) {}
    }
    postToIframe({ type: 'rtl3d-set-lang', lang: lang });
    postToIframe({ type: 'rtl3d-sync', t: 0 });
  }

  function startParentAudio() {
    ensureParentAudio();
    cycleAdvanceLock = false;
    setParentLang('en', true);
  }

  function stopParentAudio() {
    if (narrationEl) {
      narrationEl.pause();
      try { narrationEl.currentTime = 0; } catch (_) {}
    }
    if (bgmEl) {
      bgmEl.pause();
      try { bgmEl.currentTime = 0; } catch (_) {}
    }
  }

  function stopIframeMedia() {
    postToIframe({ type: 'rtl3d-video-stop' });
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
            'allow="autoplay *; fullscreen; encrypted-media" ' +
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
    iframe.addEventListener('load', function () {
      if (!active) return;
      postToIframe({ type: 'rtl3d-set-lang', lang: currentLang });
      postToIframe({ type: 'rtl3d-sync', t: narrationEl ? narrationEl.currentTime : 0 });
    });

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
    startParentAudio();
    iframe.src = VIDEO_SRC;
    requestAnimationFrame(function () { overlay.classList.add('is-on'); });
  }

  function promptExplore() {
    if (!active) return;
    if (!prompting) {
      prompting = true;
      overlay.classList.add('show-explore');
    }
    window.clearTimeout(exploreTimer);
    exploreTimer = window.setTimeout(dismissExplore, EXPLORE_DISMISS_MS);
  }

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
    stopParentAudio();
    stopIframeMedia();
    overlay.classList.remove('is-on');
    overlay.classList.remove('show-explore');
    arm();
  }

  function arm() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(show, IDLE_MS);
  }

  function resetIdle() {
    if (!active) arm();
  }

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

  window.addEventListener('scroll', resetIdle, { passive: true, capture: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      window.clearTimeout(idleTimer);
    } else {
      if (active) hide();
      arm();
    }
  });

  window.addEventListener('keydown', wake, { passive: true, capture: true });

  arm();

  try {
    var qs = new URLSearchParams(window.location.search);
    var idleOverride = parseFloat(qs.get('idle'));
    if (!isNaN(idleOverride)) { IDLE_MS = idleOverride * 1000; arm(); }
    if (qs.get('screensaver') === '1') { window.setTimeout(show, 400); }
  } catch (_) {}

  window.RTL3D_IDLE = {
    show: show,
    hide: hide,
    setTimeoutMs: function (ms) { IDLE_MS = ms; arm(); }
  };
})();
