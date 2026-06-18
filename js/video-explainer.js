(function () {
  'use strict';

  if (typeof gsap === 'undefined') {
    console.warn('[video-explainer] GSAP failed to load — animation skipped.');
    return;
  }

  var EASE = 'power3.out';
  var vi18n = function () { return window.RTL3D_VIDEO_I18N; };

  var fill = document.getElementById('vid-progress-fill');
  var chapterEl = document.getElementById('vid-chapter');
  var audio = document.getElementById('vid-audio');
  var bgm = document.getElementById('vid-bgm');
  var poster = document.getElementById('vid-poster');
  var flashEl = document.querySelector('.vid-flash');
  var outroReplay = document.getElementById('vid-outro-replay');

  var SCENES = [
    { id: 'scene-1',  chapterKey: '',                    dur: 6.4,  build: introScene },
    { id: 'scene-2',  chapterKey: 'video.chapter.how',   dur: 8.6,  build: factScene },
    { id: 'scene-3',  chapterKey: 'video.chapter.how',   dur: 10.6, build: factScene },
    { id: 'scene-4',  chapterKey: 'video.chapter.how',   dur: 12.3, build: malaysiaScene },
    { id: 'scene-5',  chapterKey: 'video.chapter.rtl3d', dur: 10.5, build: acronymScene },
    { id: 'scene-6',  chapterKey: 'video.chapter.rtl3d', dur: 8.7,  build: factScene },
    { id: 'scene-7',  chapterKey: 'video.chapter.safe',  dur: 11.9, build: factScene },
    { id: 'scene-8',  chapterKey: 'video.chapter.safe',  dur: 9.9,  build: factScene },
    { id: 'scene-9',  chapterKey: 'video.chapter.safe',  dur: 8.6,  build: factScene },
    { id: 'scene-10', chapterKey: 'video.chapter.safe',  dur: 11.3, build: dontsScene },
    { id: 'scene-11', chapterKey: '',                    dur: 5.0,  build: outroScene }
  ];

  var SCENE_DUR = {
    en: [8.14, 6.81, 11.29, 9.96, 12.48, 9.12, 9.19, 8.98, 12.14, 11.64, 4.01],
    ms: [8.35, 7.62, 17.41, 10.60, 19.13, 11.35, 15.52, 12.91, 11.21, 14.74, 6.52],
    ja: [9.44, 10.64, 16.96, 13.88, 21.48, 13.88, 12.88, 12.92, 18.48, 20.64, 6.08]
  };

  var _sceneIdx = 0;
  var _builtLang = null;

  function animLang() {
    var api = vi18n();
    return api ? api.lang : 'en';
  }

  var LOCKED_LANGS = { en: true, ms: true, ja: true };

  function kfPack(sceneType) {
    var all = window.RTL3D_VIDEO_KEYFRAMES;
    var lang = animLang();
    if (all && all[lang] && all[lang][sceneType]) return all[lang][sceneType];
    if (!LOCKED_LANGS[lang] && all && all.en && all.en[sceneType]) return all.en[sceneType];
    return {};
  }

  /** Scenes 6–9: use each language's own factMid pack when defined. */
  function factKeyframeId() {
    var lang = animLang();
    if (_sceneIdx >= 5) {
      var all = window.RTL3D_VIDEO_KEYFRAMES;
      if (all && all[lang] && all[lang].factMid) return 'factMid';
    }
    return 'fact';
  }

  /** Keyframe time = fraction × current scene duration. */
  function kt(sceneType, key) {
    var pack = kfPack(sceneType);
    var frac = pack[key];
    if (frac == null) return 0;
    return frac * SCENES[_sceneIdx].dur;
  }

  /** Keyframe tween duration = fraction × current scene duration. */
  function kd(sceneType, key) {
    var pack = kfPack(sceneType);
    var frac = pack[key];
    if (frac == null) return 0.5;
    return Math.max(0.35, frac * SCENES[_sceneIdx].dur);
  }

  function exitFade(dur) {
    return Math.min(0.55, Math.max(0.35, dur * 0.1));
  }

  function applySceneDurations(lang) {
    var durs = SCENE_DUR[lang];
    if (!durs && LOCKED_LANGS[lang]) {
      console.warn('[video] Missing scene timing for locked lang:', lang);
      return;
    }
    durs = durs || SCENE_DUR.en;
    for (var i = 0; i < SCENES.length && i < durs.length; i++) {
      SCENES[i].dur = durs[i];
    }
  }

  function resetAnimatedElements() {
    gsap.set('.vid-acronym .ac', { opacity: 0, y: 60, scale: 0.5, rotateX: -40 });
    gsap.set('.vid-kicker, .vid-title .word, .vid-subtitle, .vid-bolt', { opacity: 0 });
    gsap.set('.vid-fact-line, .vid-fact-icon, .vid-fact-stat, .vid-donts-title, .vid-donts .dont', { opacity: 0 });
    gsap.set('.vid-outro-logo, .vid-cta, .vid-outro-sub', { opacity: 0 });
    gsap.set('.vid-map, .vid-map-label, .vid-stat-tag, .vid-stat-num, .vid-data-line .line', { opacity: 0 });
    gsap.set('.vid-hotspot, .vid-ring', { opacity: 0, scale: 0 });
    gsap.set('.vid-acronym-expand .aw', { opacity: 0, y: 18 });
  }

  function show(id) { document.getElementById(id).style.visibility = 'visible'; }
  function hide(id) { document.getElementById(id).style.visibility = 'hidden'; }

  function chapterLabel(key) {
    if (!key) return '';
    var api = vi18n();
    return api ? api.chapter(key) : '';
  }

  function setChapter(text) {
    if (!chapterEl || text === chapterEl.textContent) return;
    chapterEl.textContent = text;
  }

  function flashPop(tl, at, strength) {
    if (!flashEl) return;
    var s = strength || 0.5;
    tl.fromTo(flashEl, { opacity: 0 },
      { opacity: s, duration: 0.12, ease: 'power2.out' }, at);
    tl.to(flashEl, { opacity: 0, duration: 0.5, ease: 'power2.in' }, at + 0.12);
  }

  function introLang() {
    var api = vi18n();
    return api ? api.lang : 'en';
  }

  function introScene(tl, at, sel) {
    var K = 'intro';
    var withKicker = introLang() === 'en';
    flashPop(tl, at + kt(K, 'flash'), 0.7);
    tl.fromTo(sel + '.vid-bolt', { opacity: 0, scale: 0.3, y: 12, rotate: -12 },
      { opacity: 1, scale: 1, y: 0, rotate: 0, duration: kd(K, 'boltDur'), ease: 'back.out(2.2)' }, at + kt(K, 'bolt'));
    if (withKicker) {
      tl.fromTo(sel + '.vid-kicker', { opacity: 0, y: 18, letterSpacing: '0.7em' },
        { opacity: 1, y: 0, letterSpacing: '0.42em', duration: kd(K, 'kickerDur'), ease: EASE }, at + kt(K, 'kicker'));
    }
    var titleAt = withKicker ? at + kt(K, 'titleK') : at + kt(K, 'title');
    var subAt = withKicker ? at + kt(K, 'subtitleK') : at + kt(K, 'subtitle');
    tl.fromTo(sel + '.vid-title .word', { opacity: 0, y: 70, rotateX: -55 },
      { opacity: 1, y: 0, rotateX: 0, duration: kd(K, 'titleDur'), ease: EASE, stagger: kt(K, 'titleStagger') }, titleAt);
    tl.fromTo(sel + '.vid-subtitle', { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: kd(K, 'subtitleDur'), ease: EASE }, subAt);
    tl.to(sel + '.vid-bolt', { y: -6, duration: kd(K, 'boltFloatDur'), ease: 'sine.inOut', yoyo: true, repeat: 1 }, subAt);
  }

  function factScene(tl, at, sel) {
    var K = factKeyframeId();
    flashPop(tl, at + kt(K, 'flash'), 0.35);
    tl.fromTo(sel + '.vid-fact-icon', { opacity: 0, scale: 0.4, y: 16 },
      { opacity: 1, scale: 1, y: 0, duration: kd(K, 'iconDur'), ease: 'back.out(1.9)' }, at + kt(K, 'icon'));
    tl.fromTo(sel + '.vid-fact-stat', { opacity: 0, scale: 0.65, y: 22 },
      { opacity: 1, scale: 1, y: 0, duration: kd(K, 'statDur'), ease: 'back.out(1.7)' }, at + kt(K, 'stat'));
    tl.fromTo(sel + '.vid-fact-line', { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: kd(K, 'lineDur'), ease: EASE }, at + kt(K, 'line'));
    tl.to(sel + '.vid-fact-icon', { y: -7, duration: kd(K, 'floatDur'), ease: 'sine.inOut', yoyo: true, repeat: 99 }, at + kt(K, 'float'));
  }

  function malaysiaScene(tl, at, sel) {
    var K = 'malaysia';
    tl.fromTo(sel + '.vid-map', { opacity: 0, scale: 0.85, x: -45 },
      { opacity: 1, scale: 1, x: 0, duration: kd(K, 'mapDur'), ease: EASE }, at + kt(K, 'map'));
    tl.fromTo(sel + '.vid-hotspot', { scale: 0 },
      { scale: 1, duration: kd(K, 'hotspotDur'), ease: 'back.out(3)' }, at + kt(K, 'hotspot'));
    tl.to(sel + '.vid-hotspot', { scale: 1.5, duration: kd(K, 'hotspotPulseDur'), ease: 'sine.inOut', yoyo: true, repeat: 99 }, at + kt(K, 'hotspotPulse'));
    tl.fromTo(sel + '.vid-ring', { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: kd(K, 'ringDur'), ease: EASE, stagger: kt(K, 'ringStagger') }, at + kt(K, 'ring'));
    flashPop(tl, at + kt(K, 'flash'), 0.3);
    tl.fromTo(sel + '.vid-map-label', { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: kd(K, 'mapLabelDur'), ease: EASE }, at + kt(K, 'mapLabel'));
    tl.fromTo(sel + '.vid-stat-tag', { opacity: 0, x: 32 },
      { opacity: 1, x: 0, duration: kd(K, 'statTagDur'), ease: EASE }, at + kt(K, 'statTag'));
    tl.fromTo(sel + '.vid-stat-num', { opacity: 0, scale: 0.55, y: 22 },
      { opacity: 1, scale: 1, y: 0, duration: kd(K, 'statNumDur'), ease: 'back.out(1.9)' }, at + kt(K, 'statNum'));
    tl.fromTo(sel + '.vid-data-line .line', { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: kd(K, 'dataLinesDur'), ease: EASE, stagger: kt(K, 'dataStagger') }, at + kt(K, 'dataLines'));
  }

  function acronymScene(tl, at, sel) {
    var K = 'acronym';
    tl.fromTo(sel + '.vid-acronym .ac', { opacity: 0, y: 60, scale: 0.5, rotateX: -40 },
      { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: kd(K, 'lettersDur'), ease: 'back.out(2.2)', stagger: kt(K, 'letterStagger') }, at + kt(K, 'letters'));
    flashPop(tl, at + kt(K, 'flash'), 0.4);
    tl.fromTo(sel + '.vid-acronym-expand .aw', { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: kd(K, 'expandDur'), ease: EASE, stagger: kt(K, 'expandStagger') }, at + kt(K, 'expand'));
    tl.fromTo(sel + '.vid-fact-line', { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: kd(K, 'factLineDur'), ease: EASE }, at + kt(K, 'factLine'));
  }

  function dontsScene(tl, at, sel) {
    var K = 'donts';
    tl.fromTo(sel + '.vid-fact-icon', { opacity: 0, scale: 0.4, rotate: -10 },
      { opacity: 1, scale: 1, rotate: 0, duration: kd(K, 'iconDur'), ease: 'back.out(1.9)' }, at + kt(K, 'icon'));
    tl.fromTo(sel + '.vid-donts-title', { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: kd(K, 'titleDur'), ease: EASE }, at + kt(K, 'title'));
    tl.fromTo(sel + '.vid-donts .dont', { opacity: 0, x: -32 },
      { opacity: 1, x: 0, duration: kd(K, 'itemsDur'), ease: EASE, stagger: kt(K, 'itemStagger') }, at + kt(K, 'items'));
  }

  function outroScene(tl, at, sel) {
    var K = 'outro';
    flashPop(tl, at + kt(K, 'flash'), 0.6);
    tl.fromTo(sel + '.vid-outro-logo', { opacity: 0, scale: 0.65 },
      { opacity: 1, scale: 1, duration: kd(K, 'logoDur'), ease: 'back.out(1.8)' }, at + kt(K, 'logo'));
    tl.fromTo(sel + '.vid-cta', { opacity: 0, y: 44 },
      { opacity: 1, y: 0, duration: kd(K, 'ctaDur'), ease: EASE }, at + kt(K, 'cta'));
    tl.fromTo(sel + '.vid-outro-sub', { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: kd(K, 'subDur'), ease: EASE }, at + kt(K, 'sub'));
    tl.to(sel + '.vid-cta', { scale: 1.02, duration: kd(K, 'ctaPulseDur'), ease: 'sine.inOut', yoyo: true, repeat: 99 }, at + kt(K, 'ctaPulse'));
  }

  var TOTAL = 0;
  var loopParam = false;
  var kioskParam = false;
  var cycleParam = false;
  var autoplayParam = false;
  var silentParam = false;
  var langParam = null;
  var externalSync = false;

  try {
    var q = new URLSearchParams(window.location.search);
    loopParam = q.get('loop') === '1';
    kioskParam = q.get('kiosk') === '1';
    cycleParam = q.get('cycle') === '1' || (kioskParam && q.get('cycle') !== '0');
    autoplayParam = q.get('autoplay') === '1';
    silentParam = q.get('silent') === '1';
    langParam = q.get('lang');
  } catch (_) {}

  if (cycleParam) loopParam = false;

  function markWatched() {
    try { localStorage.setItem('rtl3d-watched-video', '1'); } catch (_) {}
  }

  function resetAll() {
    SCENES.forEach(function (sc) { hide(sc.id); });
    gsap.set(SCENES.map(function (sc) { return '#' + sc.id; }), { opacity: 1, y: 0 });
    if (flashEl) gsap.set(flashEl, { opacity: 0 });
    resetAnimatedElements();
  }

  var OUTRO_AT = 0;
  for (var si = 0; si < SCENES.length - 1; si++) OUTRO_AT += SCENES[si].dur;

  var onLessonComplete = null;
  var timeline = null;
  var cycleAdvanceLock = false;

  function finishLesson() {
    markWatched();
    if (onLessonComplete) onLessonComplete();
  }

  /** Screensaver / kiosk: en → ms → ja → en … */
  function advanceCycle() {
    if (!cycleParam || cycleAdvanceLock) return;
    cycleAdvanceLock = true;
    markWatched();
    var api = vi18n();
    if (!api) {
      cycleAdvanceLock = false;
      return;
    }
    var next = api.nextLang();
    applyVideoLang(next);
    window.setTimeout(function () {
      cycleAdvanceLock = false;
      playWithAudio();
    }, 600);
  }

  function rebuildTimeline() {
    if (timeline) timeline.kill();
    OUTRO_AT = 0;
    for (var sj = 0; sj < SCENES.length - 1; sj++) OUTRO_AT += SCENES[sj].dur;
    timeline = buildTimeline();
    if (window.RTL3D_VIDEO) window.RTL3D_VIDEO.timeline = timeline;
  }

  function buildTimeline() {
    var tl = gsap.timeline({
      paused: true,
      repeat: loopParam ? -1 : 0,
      onRepeat: resetAll,
      onUpdate: function () {
        if (!fill) return;
        var p = OUTRO_AT > 0 ? Math.min(1, tl.time() / OUTRO_AT) : tl.progress();
        fill.style.width = (p * 100) + '%';
      },
      onComplete: function () {
        if (silentParam) {
          if (cycleParam) {
            try {
              window.parent.postMessage({ type: 'rtl3d-lesson-ended' }, window.location.origin);
            } catch (_) {}
          }
          return;
        }
        if (cycleParam) advanceCycle();
        else finishLesson();
      }
    });

    var cursor = 0;
    SCENES.forEach(function (sc, i) {
      var sel = '#' + sc.id + ' ';
      var at = cursor;
      var chap = chapterLabel(sc.chapterKey);

      tl.call(function () { show(sc.id); setChapter(chap); }, null, at);
      if (chap) {
        tl.fromTo(chapterEl, { opacity: 0, y: -8 },
          { opacity: 0.85, y: 0, duration: 0.6, ease: EASE }, at);
      } else {
        tl.to(chapterEl, { opacity: 0, duration: 0.3 }, at);
      }

      _sceneIdx = i;
      sc.build(tl, at, sel);

      if (i < SCENES.length - 1) {
        var fade = exitFade(sc.dur);
        var exitAt = at + sc.dur - fade;
        tl.to('#' + sc.id, { opacity: 0, y: -30, duration: fade, ease: 'power2.in' }, exitAt);
        tl.call(function () { hide(sc.id); }, null, at + sc.dur - 0.02);
      }

      cursor += sc.dur;
    });

    TOTAL = cursor;
    tl.to({}, { duration: 0.01 }, TOTAL - 0.01);
    return tl;
  }

  var audioOn = false;

  var BGM_LANGS = { ms: true, ja: true };
  var BGM_VOLUME = { ms: 0.18, ja: 0.28 };
  var NARRATION_VOLUME = { ms: 1.0, ja: 1.0, en: 1.0 };

  function bgmVolumeFor(lang) {
    lang = lang || currentLang();
    return BGM_VOLUME[lang] != null ? BGM_VOLUME[lang] : 0.28;
  }

  function narrationVolumeFor(lang) {
    lang = lang || currentLang();
    return NARRATION_VOLUME[lang] != null ? NARRATION_VOLUME[lang] : 1.0;
  }

  function applyNarrationVolume(lang) {
    if (!audio) return;
    audio.volume = narrationVolumeFor(lang);
  }

  function currentLang() {
    var api = vi18n();
    return api ? api.lang : 'en';
  }

  function usesBgm() {
    return !!BGM_LANGS[currentLang()];
  }

  function stopBgm() {
    if (!bgm) return;
    bgm.pause();
    try { bgm.currentTime = 0; } catch (_) {}
  }

  function startBgm() {
    if (!bgm || !usesBgm()) return;
    if (bgm.preload === 'none') bgm.preload = 'auto';
    bgm.volume = bgmVolumeFor();
    bgm.loop = true;
    bgm.muted = false;
    if (bgm.readyState < 2) {
      try { bgm.load(); } catch (_) {}
    }
    if (audio && audio.duration && isFinite(audio.duration)) {
      var dur = bgm.duration;
      if (dur && isFinite(dur)) {
        try { bgm.currentTime = audio.currentTime % dur; } catch (_) {}
      }
    }
    bgm.play().catch(function (err) {
      console.warn('[video] BGM play failed', err);
    });
  }

  function syncBgmToNarration() {
    if (!bgm || !usesBgm() || !audio || audio.paused) return;
    var dur = bgm.duration;
    if (!dur || !isFinite(dur)) return;
    var target = audio.currentTime % dur;
    if (Math.abs(bgm.currentTime - target) > 0.35) {
      try { bgm.currentTime = target; } catch (_) {}
    }
    if (bgm.paused) bgm.play().catch(function () {});
  }

  function syncToAudio() {
    if (!audioOn || !audio || audio.paused || !timeline) return;
    var t = audio.currentTime;
    var cap = TOTAL;
    if (audio.duration && isFinite(audio.duration) && Math.abs(audio.duration - TOTAL) > 0.5) {
      cap = audio.duration;
    }
    if (t <= cap && Math.abs(timeline.time() - t) > 0.2) {
      timeline.time(t);
    }
    syncBgmToNarration();
  }
  if (audio) {
    audio.addEventListener('timeupdate', syncToAudio);
    audio.addEventListener('play', function () {
      if (audioOn && usesBgm()) startBgm();
    });
    audio.addEventListener('pause', function () {
      if (bgm) bgm.pause();
    });
    audio.addEventListener('ended', function () {
      stopBgm();
      if (silentParam) return;
      if (cycleParam) advanceCycle();
    });
  }

  function unlockAudio() {
    if (audio) audio.muted = false;
    if (bgm) bgm.muted = false;
  }

  function beginPlayback() {
    if (!audio) return;
    audio.currentTime = 0;
    audio.muted = false;
    audio.loop = false;
    if (audio.error) {
      console.error('[video] Narration not available', audio.error, audio.src);
      return;
    }
    audio.play().then(null, function () {
      var tries = 0;
      (function retry() {
        if (++tries > 80 || !audioOn) return;
        audio.play().then(null, function () { window.setTimeout(retry, 80); });
      })();
    });
    if (usesBgm()) startBgm();
    else stopBgm();
  }

  function playWithAudio() {
    var lang = currentLang();
    // The GSAP timeline (scene durations + keyframe timing) is per-language.
    // If the language changed since the timeline was last built, rebuild it so
    // the animation matches the narration length — otherwise visuals run on the
    // previous language's (shorter) timeline and race ahead of the voice.
    if (lang !== _builtLang) applyVideoLang(lang);
    resetAll();
    audioOn = true;
    cycleAdvanceLock = false;
    applyNarrationVolume(lang);
    timeline.restart();
    var api = vi18n();
    var ready = api && api.prepareAudio ? api.prepareAudio(lang) : Promise.resolve(true);
    ready.then(function (ok) {
      if (!ok) console.error('[video] Audio not ready for', lang);
      beginPlayback();
    });
  }

  function playSilent() {
    resetAll();
    audioOn = false;
    timeline.restart();
    stopBgm();
  }

  function applyVideoLang(lang) {
    var api = vi18n();
    if (api) api.apply(lang);
    lang = lang || currentLang();
    applySceneDurations(lang);
    applyNarrationVolume(lang);
    resetAnimatedElements();
    rebuildTimeline();
    _builtLang = lang;
    if (!usesBgm()) stopBgm();
    else if (audioOn && audio && !audio.paused) startBgm();
  }

  function stopAllPlayback() {
    audioOn = false;
    if (audio) {
      audio.pause();
      try { audio.currentTime = 0; } catch (_) {}
    }
    stopBgm();
    if (timeline) timeline.pause();
  }

  function applyExternalLang(lang) {
    applyVideoLang(lang);
    resetAll();
    show(SCENES[0].id);
    if (timeline) {
      timeline.time(0);
      timeline.play();
    }
  }

  function syncExternalTime(t) {
    if (!timeline || t == null || isNaN(t)) return;
    t = Math.max(0, Math.min(TOTAL, t));
    if (Math.abs(timeline.time() - t) > 0.35) timeline.time(t);
  }

  function bootSilentKiosk() {
    externalSync = true;
    audioOn = false;
    if (poster) poster.classList.add('is-hidden');
    resetAll();
    show(SCENES[0].id);
    if (timeline) {
      timeline.time(0);
      timeline.play();
    }
  }

  window.addEventListener('message', function (e) {
    if (!e || !e.data) return;
    if (e.data.type === 'rtl3d-video-stop') stopAllPlayback();
    if (e.data.type === 'rtl3d-video-play') playWithAudio();
    if (silentParam && e.data.type === 'rtl3d-sync') syncExternalTime(e.data.t);
    if (silentParam && e.data.type === 'rtl3d-set-lang' && e.data.lang) {
      applyExternalLang(e.data.lang);
    }
  });

  if (cycleParam && !silentParam) {
    onLessonComplete = advanceCycle;
  }

  if (poster && !kioskParam) {
    poster.addEventListener('click', function () {
      poster.classList.add('is-hidden');
      playWithAudio();
    });
  } else if (poster) {
    poster.classList.add('is-hidden');
  }

  if (outroReplay) {
    outroReplay.addEventListener('click', function () {
      if (audioOn) playWithAudio();
      else playSilent();
    });
  }

  if (kioskParam) document.body.classList.add('vid-kiosk');

  var seekParam = null;
  try { seekParam = new URLSearchParams(window.location.search).get('seek'); } catch (_) {}

  function seekTo(seconds) {
    resetAll();
    var t = Math.max(0, Math.min(TOTAL, seconds));
    var acc = 0;
    var current = SCENES[0].id;
    var chap = chapterLabel(SCENES[0].chapterKey);
    for (var i = 0; i < SCENES.length; i++) {
      if (t < acc + SCENES[i].dur) {
        current = SCENES[i].id;
        chap = chapterLabel(SCENES[i].chapterKey);
        break;
      }
      acc += SCENES[i].dur;
    }
    SCENES.forEach(function (sc) { sc.id === current ? show(sc.id) : hide(sc.id); });
    if (poster) { poster.classList.add('is-hidden'); poster.style.display = 'none'; }
    setChapter(chap);
    timeline.progress(0).pause();
    timeline.time(t, false);
  }

  function boot() {
    var api = vi18n();
    var lang = api ? api.initialLang({ cycle: cycleParam, langParam: langParam }) : 'en';
    applyVideoLang(lang);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (seekParam !== null && !isNaN(parseFloat(seekParam))) {
          seekTo(parseFloat(seekParam));
        } else if (kioskParam || cycleParam) {
          if (poster) poster.classList.add('is-hidden');
          if (silentParam) bootSilentKiosk();
          else playWithAudio();
        } else if (autoplayParam) {
          if (poster) poster.classList.add('is-hidden');
          playWithAudio();
        } else {
          resetAll();
          show(SCENES[0].id);
          timeline.pause();
        }
      });
    });
  }

  if (document.readyState === 'complete') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }

  window.RTL3D_VIDEO = {
    playWithAudio: playWithAudio,
    playSilent: playSilent,
    seek: seekTo,
    timeline: timeline,
    total: function () { return TOTAL; },
    setLang: applyVideoLang,
    usesBgm: usesBgm,
    stopBgm: stopBgm,
    stopAll: stopAllPlayback,
    unlockAudio: unlockAudio
  };
})();
