(function () {

  'use strict';



  var LANGS = ['en', 'ms', 'ja'];

  var NARRATION = {

    en: 'video/narration-en.mp3',

    ms: 'video/narration-ms.mp3',

    ja: 'video/narration-ja.mp3',

  };

  var FALLBACK_NARRATION = 'video/narration.mp3';

  var BGM_SRC = 'bgmusic.mp3';

  var BGM_LANGS = { ms: true, ja: true };

  var AUDIO_CACHE = '15';



  var current = 'en';



  function whenCanPlay(el, timeoutMs) {

    timeoutMs = timeoutMs || 12000;

    return new Promise(function (resolve) {

      if (!el) return resolve(false);

      if (el.readyState >= 3 && !el.error) return resolve(true);

      var settled = false;

      function finish(ok) {

        if (settled) return;

        settled = true;

        el.removeEventListener('canplaythrough', onReady);

        el.removeEventListener('error', onErr);

        resolve(ok);

      }

      function onReady() { finish(!el.error); }

      function onErr() { finish(false); }

      el.addEventListener('canplaythrough', onReady);

      el.addEventListener('error', onErr);

      setTimeout(function () { finish(el.readyState >= 2 && !el.error); }, timeoutMs);

    });

  }



  function assignBgmSrc(bgm) {
    if (!bgm) return;
    var path = BGM_SRC.split('/').pop();
    if (bgm.dataset.srcName === path && bgm.src) return;
    bgm.src = BGM_SRC + '?v=' + AUDIO_CACHE;
    bgm.dataset.srcName = path;
    try { bgm.load(); } catch (_) {}
  }

  function prepareBgm() {

    var bgm = document.getElementById('vid-bgm');

    if (!bgm) return Promise.resolve(false);

    assignBgmSrc(bgm);

    if (bgm.preload === 'none') bgm.preload = 'auto';

    return whenCanPlay(bgm, 8000);

  }



  function assignNarrationSrc(audio, lang) {

    var src = narrationSrc(lang);

    var path = src.split('/').pop();

    audio.src = src + '?v=' + AUDIO_CACHE;

    audio.dataset.lang = lang;

    audio.dataset.srcName = path;

    delete audio.dataset.fallbackTried;

    try { audio.load(); } catch (_) {}

  }



  function prepareAudio(lang) {

    lang = resolveLang(lang);

    var audio = document.getElementById('vid-audio');

    if (!audio) return Promise.resolve(false);

    var path = narrationSrc(lang).split('/').pop();

    var needSwitch = audio.dataset.lang !== lang || audio.dataset.srcName !== path;

    if (needSwitch) {

      audio.pause();

      assignNarrationSrc(audio, lang);

    } else if (audio.readyState < 2) {

      try { audio.load(); } catch (_) {}

    }

    return whenCanPlay(audio).then(function (ok) {

      if (!ok || !BGM_LANGS[lang]) return ok;

      return prepareBgm().then(function () { return ok; });

    });

  }



  function t(key, lang) {

    if (window.RTL3Di18n) {

      var v = window.RTL3Di18n.t(key, lang);

      if (v != null) return v;

    }

    return '';

  }



  function resolveLang(code) {

    return LANGS.indexOf(code) >= 0 ? code : 'en';

  }



  function isCycleMode() {

    try {

      var q = new URLSearchParams(window.location.search);

      return q.get('cycle') === '1' || q.get('kiosk') === '1';

    } catch (_) {

      return false;

    }

  }



  function narrationSrc(lang) {

    lang = resolveLang(lang);

    return NARRATION[lang] || FALLBACK_NARRATION;

  }



  function stopBgmElement() {

    var bgm = document.getElementById('vid-bgm');

    if (!bgm) return;

    bgm.pause();

    try { bgm.currentTime = 0; } catch (_) {}

  }



  function setAudio(lang) {

    var audio = document.getElementById('vid-audio');

    if (!audio) return;

    lang = resolveLang(lang);

    var path = narrationSrc(lang).split('/').pop();

    if (audio.dataset.lang === lang && audio.dataset.srcName === path) return;

    audio.pause();

    if (!BGM_LANGS[lang]) stopBgmElement();

    assignNarrationSrc(audio, lang);

  }



  function applyScene1Kicker(lang) {

    var kicker = document.querySelector('#scene-1 .vid-kicker');

    if (!kicker) return;

    var text = (t('video.s1.kicker', lang) || '').trim();

    if (text) {

      kicker.textContent = text;

      kicker.style.display = '';

      kicker.removeAttribute('aria-hidden');

    } else {

      kicker.textContent = '';

      kicker.style.display = 'none';

      kicker.setAttribute('aria-hidden', 'true');

    }

  }



  function applyScene1Words(lang) {

    var keys = ['video.s1.w1', 'video.s1.w2', 'video.s1.w3'];

    var words = document.querySelectorAll('#scene-1 .vid-title .word');

    keys.forEach(function (key, i) {

      if (!words[i]) return;

      var v = t(key, lang);

      if (v != null) words[i].textContent = v;

    });

  }



  function applyScene6Num(lang) {

    var el = document.querySelector('#scene-6 .vid-fact-stat .num');

    if (!el) return;

    var html = t('video.s6.num', lang);

    if (html) el.innerHTML = html;

  }



  function translateVideo(lang) {

    lang = resolveLang(lang);

    var stage = document.getElementById('vid-stage');

    var root = (isCycleMode() && stage) ? stage : document;

    if (window.RTL3Di18n && window.RTL3Di18n.translateTree) {

      window.RTL3Di18n.translateTree(root, lang);

    }

    applyScene1Kicker(lang);

    applyScene1Words(lang);

    applyScene6Num(lang);

  }



  function apply(lang) {

    lang = resolveLang(lang);

    current = lang;

    translateVideo(lang);

    setAudio(lang);
    if (BGM_LANGS[lang]) prepareBgm();
  }

  function chapterText(key, lang) {

    return t(key, lang);

  }



  function nextLang(lang) {

    lang = resolveLang(lang || current);

    var i = LANGS.indexOf(lang);

    return LANGS[(i + 1) % LANGS.length];

  }



  function initialLang(opts) {

    opts = opts || {};

    if (opts.cycle) return 'en';

    if (opts.langParam) return resolveLang(opts.langParam);

    if (window.RTL3Di18n && window.RTL3Di18n.lang) {

      return resolveLang(window.RTL3Di18n.lang);

    }

    return 'en';

  }



  window.RTL3D_VIDEO_I18N = {

    langs: LANGS,

    apply: apply,

    chapter: chapterText,

    narrationSrc: narrationSrc,

    prepareAudio: prepareAudio,

    nextLang: nextLang,

    initialLang: initialLang,

    isCycleMode: isCycleMode,

    get lang() {

      return current;

    },

  };



  var audioEl = document.getElementById('vid-audio');

  if (audioEl) {

    audioEl.addEventListener('error', function () {

      var lang = audioEl.dataset.lang || 'en';

      if (lang === 'ms' || lang === 'ja') {

        console.error('[video-i18n] Narration failed to load:', audioEl.src);

        return;

      }

      if (audioEl.dataset.fallbackTried === '1') return;

      audioEl.dataset.fallbackTried = '1';

      audioEl.src = FALLBACK_NARRATION + '?v=' + AUDIO_CACHE;

      audioEl.load();

      audioEl.play().catch(function () {});

    });

  }



  var bgmEl = document.getElementById('vid-bgm');

  if (bgmEl) {

    bgmEl.addEventListener('error', function () {

      console.error('[video-i18n] BGM failed to load:', bgmEl.src);

    });

  }



  document.addEventListener('rtl3d:langchange', function (e) {

    if (document.body.dataset.page !== 'video') return;

    try {

      var qs = new URLSearchParams(window.location.search);

      if (qs.get('kiosk') === '1' || qs.get('cycle') === '1') return;

    } catch (_) {}

    if (!e.detail || !e.detail.lang) return;

    apply(e.detail.lang);

    var poster = document.getElementById('vid-poster');

    if (poster && !poster.classList.contains('is-hidden') && window.RTL3D_VIDEO) {

      return;

    }

    if (window.RTL3D_VIDEO && window.RTL3D_VIDEO.playWithAudio) {

      window.RTL3D_VIDEO.playWithAudio();

    }

  });

})();

