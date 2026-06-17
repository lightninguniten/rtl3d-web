(function () {
  'use strict';

  if (typeof gsap === 'undefined') {
    console.warn('[video-explainer] GSAP failed to load — animation skipped.');
    return;
  }

  var EASE = 'power3.out';

  var fill = document.getElementById('vid-progress-fill');
  var chapterEl = document.getElementById('vid-chapter');
  var audio = document.getElementById('vid-audio');
  var poster = document.getElementById('vid-poster');
  var flashEl = document.querySelector('.vid-flash');
  var outroReplay = document.getElementById('vid-outro-replay');

  // Scene timing is matched to the voice-over (narration.mp3 ≈ 104 s).
  // `dur` = seconds the scene is on screen (entrance + hold).
  var SCENES = [
    { id: 'scene-1',  chapter: '',                     dur: 6.4,  build: introScene },
    { id: 'scene-2',  chapter: 'How lightning works',  dur: 8.6,  build: factScene },
    { id: 'scene-3',  chapter: 'How lightning works',  dur: 10.6, build: factScene },
    { id: 'scene-4',  chapter: 'How lightning works',  dur: 12.3, build: malaysiaScene },
    { id: 'scene-5',  chapter: 'The RTL3D project',    dur: 10.5, build: acronymScene },
    { id: 'scene-6',  chapter: 'The RTL3D project',    dur: 8.7,  build: factScene },
    { id: 'scene-7',  chapter: 'Stay safe',            dur: 11.9, build: factScene },
    { id: 'scene-8',  chapter: 'Stay safe',            dur: 9.9,  build: factScene },
    { id: 'scene-9',  chapter: 'Stay safe',            dur: 8.6,  build: factScene },
    { id: 'scene-10', chapter: 'Stay safe',            dur: 11.3, build: dontsScene },
    { id: 'scene-11', chapter: '',                     dur: 5.0,  build: outroScene }
  ];

  // ---- helpers ----------------------------------------------------------

  function show(id) { document.getElementById(id).style.visibility = 'visible'; }
  function hide(id) { document.getElementById(id).style.visibility = 'hidden'; }

  function setChapter(text) {
    if (!chapterEl || text === chapterEl.textContent) return;
    chapterEl.textContent = text;
  }

  // A quick global lightning "pop" on the flash layer for emphasis beats.
  function flashPop(tl, at, strength) {
    if (!flashEl) return;
    var s = strength || 0.5;
    tl.fromTo(flashEl, { opacity: 0 },
      { opacity: s, duration: 0.12, ease: 'power2.out' }, at);
    tl.to(flashEl, { opacity: 0, duration: 0.5, ease: 'power2.in' }, at + 0.12);
  }

  // Gentle continuous drift so a held scene never feels frozen.
  function breathe(tl, sel, at, dur) {
    tl.fromTo(sel, { scale: 1 },
      { scale: 1.012, duration: dur, ease: 'sine.inOut', yoyo: true, repeat: 1 }, at);
  }

  // ---- per-scene entrance builders --------------------------------------

  function introScene(tl, at, sel) {
    flashPop(tl, at + 0.05, 0.7);
    tl.fromTo(sel + '.vid-bolt', { opacity: 0, scale: 0.3, y: 12, rotate: -12 },
      { opacity: 1, scale: 1, y: 0, rotate: 0, duration: 1.0, ease: 'back.out(2.2)' }, at + 0.15);
    tl.fromTo(sel + '.vid-kicker', { opacity: 0, y: 18, letterSpacing: '0.7em' },
      { opacity: 1, y: 0, letterSpacing: '0.42em', duration: 0.9, ease: EASE }, at + 0.55);
    tl.fromTo(sel + '.vid-title .word', { opacity: 0, y: 70, rotateX: -55 },
      { opacity: 1, y: 0, rotateX: 0, duration: 1.1, ease: EASE, stagger: 0.14 }, at + 0.75);
    tl.fromTo(sel + '.vid-subtitle', { opacity: 0, y: 22 },
      { opacity: 1, y: 0, duration: 0.9, ease: EASE }, at + 1.6);
    tl.to(sel + '.vid-bolt', { y: -6, duration: (4.0), ease: 'sine.inOut', yoyo: true, repeat: 1 }, at + 1.6);
  }

  function factScene(tl, at, sel) {
    flashPop(tl, at + 0.05, 0.35);
    tl.fromTo(sel + '.vid-fact-icon', { opacity: 0, scale: 0.4, y: 16 },
      { opacity: 1, scale: 1, y: 0, duration: 0.85, ease: 'back.out(1.9)' }, at + 0.1);
    tl.fromTo(sel + '.vid-fact-stat', { opacity: 0, scale: 0.65, y: 22 },
      { opacity: 1, scale: 1, y: 0, duration: 0.95, ease: 'back.out(1.7)' }, at + 0.4);
    tl.fromTo(sel + '.vid-fact-line', { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: 0.9, ease: EASE }, at + 0.95);
    tl.to(sel + '.vid-fact-icon', { y: -7, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: 99 }, at + 1.0);
  }

  function malaysiaScene(tl, at, sel) {
    tl.fromTo(sel + '.vid-map', { opacity: 0, scale: 0.85, x: -45 },
      { opacity: 1, scale: 1, x: 0, duration: 1.0, ease: EASE }, at + 0.1);
    tl.fromTo(sel + '.vid-hotspot', { scale: 0 },
      { scale: 1, duration: 0.55, ease: 'back.out(3)' }, at + 0.7);
    // pulsing hotspot to feel "live"
    tl.to(sel + '.vid-hotspot', { scale: 1.5, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: 99 }, at + 1.3);
    tl.fromTo(sel + '.vid-ring', { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 1.2, ease: EASE, stagger: 0.2 }, at + 0.7);
    flashPop(tl, at + 0.8, 0.3);
    tl.fromTo(sel + '.vid-map-label', { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.6, ease: EASE }, at + 1.3);
    tl.fromTo(sel + '.vid-stat-tag', { opacity: 0, x: 32 },
      { opacity: 1, x: 0, duration: 0.7, ease: EASE }, at + 0.9);
    tl.fromTo(sel + '.vid-stat-num', { opacity: 0, scale: 0.55, y: 22 },
      { opacity: 1, scale: 1, y: 0, duration: 1.0, ease: 'back.out(1.9)' }, at + 1.1);
    tl.fromTo(sel + '.vid-data-line .line', { opacity: 0, y: 28 },
      { opacity: 1, y: 0, duration: 0.75, ease: EASE, stagger: 0.25 }, at + 1.6);
  }

  function acronymScene(tl, at, sel) {
    tl.fromTo(sel + '.vid-acronym .ac', { opacity: 0, y: 60, scale: 0.5, rotateX: -40 },
      { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 0.7, ease: 'back.out(2.2)', stagger: 0.12 }, at + 0.15);
    flashPop(tl, at + 0.15, 0.4);
    tl.fromTo(sel + '.vid-acronym-expand .aw', { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.55, ease: EASE, stagger: 0.14 }, at + 1.1);
    tl.fromTo(sel + '.vid-fact-line', { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.8, ease: EASE }, at + 2.0);
  }

  function dontsScene(tl, at, sel) {
    tl.fromTo(sel + '.vid-fact-icon', { opacity: 0, scale: 0.4, rotate: -10 },
      { opacity: 1, scale: 1, rotate: 0, duration: 0.7, ease: 'back.out(1.9)' }, at + 0.1);
    tl.fromTo(sel + '.vid-donts-title', { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.7, ease: EASE }, at + 0.4);
    tl.fromTo(sel + '.vid-donts .dont', { opacity: 0, x: -32 },
      { opacity: 1, x: 0, duration: 0.65, ease: EASE, stagger: 0.5 }, at + 0.8);
  }

  function outroScene(tl, at, sel) {
    flashPop(tl, at + 0.1, 0.6);
    tl.fromTo(sel + '.vid-outro-logo', { opacity: 0, scale: 0.65 },
      { opacity: 1, scale: 1, duration: 0.85, ease: 'back.out(1.8)' }, at + 0.2);
    tl.fromTo(sel + '.vid-cta', { opacity: 0, y: 44 },
      { opacity: 1, y: 0, duration: 1.0, ease: EASE }, at + 0.6);
    tl.fromTo(sel + '.vid-outro-sub', { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 0.85, ease: EASE }, at + 1.1);
    tl.to(sel + '.vid-cta', { scale: 1.02, duration: 1.6, ease: 'sine.inOut', yoyo: true, repeat: 99 }, at + 1.6);
  }

  // ---- assemble master timeline -----------------------------------------

  var TOTAL = 0;

  var loopParam = false, kioskParam = false, autoplayParam = false;
  try {
    var q = new URLSearchParams(window.location.search);
    loopParam = q.get('loop') === '1';
    kioskParam = q.get('kiosk') === '1';
    autoplayParam = q.get('autoplay') === '1';
  } catch (_) {}

  function markWatched() {
    try { localStorage.setItem('rtl3d-watched-video', '1'); } catch (_) {}
  }

  // In looping (screensaver) mode the audio should loop with the visuals.
  if (loopParam && document.getElementById('vid-audio')) {
    document.getElementById('vid-audio').loop = true;
  }

  function resetAll() {
    SCENES.forEach(function (sc) { hide(sc.id); });
    gsap.set(SCENES.map(function (sc) { return '#' + sc.id; }), { opacity: 1, y: 0 });
    if (flashEl) gsap.set(flashEl, { opacity: 0 });
  }

  // Start time of the final "Stay Safe, Stay Informed" outro scene. The
  // progress bar fills over the lesson and reads 100% the moment it appears.
  var OUTRO_AT = 0;
  for (var si = 0; si < SCENES.length - 1; si++) OUTRO_AT += SCENES[si].dur;

  function buildTimeline() {
    var tl = gsap.timeline({
      paused: true,
      repeat: loopParam ? -1 : 0,
      onRepeat: resetAll,
      onUpdate: function () {
        if (!fill) return;
        // Map the bar to the lesson (0 → outro start) so it's full at the outro
        // and doesn't keep creeping during the outro hold.
        var p = OUTRO_AT > 0 ? Math.min(1, tl.time() / OUTRO_AT) : tl.progress();
        fill.style.width = (p * 100) + '%';
      },
      onComplete: markWatched
    });

    var cursor = 0;
    SCENES.forEach(function (sc, i) {
      var sel = '#' + sc.id + ' ';
      var at = cursor;

      tl.call(function () { show(sc.id); setChapter(sc.chapter); }, null, at);
      if (sc.chapter) {
        tl.fromTo(chapterEl, { opacity: 0, y: -8 },
          { opacity: 0.85, y: 0, duration: 0.6, ease: EASE }, at);
      } else {
        tl.to(chapterEl, { opacity: 0, duration: 0.3 }, at);
      }

      sc.build(tl, at, sel);

      if (i < SCENES.length - 1) {
        var exitAt = at + sc.dur - 0.55;
        tl.to('#' + sc.id, { opacity: 0, y: -30, duration: 0.55, ease: 'power2.in' }, exitAt);
        tl.call(function () { hide(sc.id); }, null, at + sc.dur - 0.02);
      }

      cursor += sc.dur;
    });

    TOTAL = cursor;
    tl.to({}, { duration: 0.01 }, TOTAL - 0.01);
    return tl;
  }

  var timeline = buildTimeline();

  // ---- audio sync -------------------------------------------------------
  // The visuals are the timekeeper; audio rides alongside. We start both
  // together. If they drift apart by > 0.25 s, nudge the timeline to the audio.
  var audioOn = false;

  function syncToAudio() {
    if (!audioOn || !audio || audio.paused) return;
    var t = audio.currentTime;
    if (t <= TOTAL && Math.abs(timeline.time() - t) > 0.25) {
      timeline.time(t);
    }
  }
  if (audio) audio.addEventListener('timeupdate', syncToAudio);

  function playWithAudio() {
    resetAll();
    audioOn = true;
    timeline.restart();
    if (audio) {
      audio.currentTime = 0;
      audio.muted = false;
      audio.play().catch(function () {/* autoplay may be blocked; visuals still run */});
    }
  }

  function playMutedAudio() {
    resetAll();
    audioOn = true;
    timeline.restart();
    if (audio) {
      audio.currentTime = 0;
      audio.muted = true;
      audio.play().catch(function () {/* muted autoplay blocked in some embeds */});
    }
  }

  function playSilent() {
    resetAll();
    audioOn = false;
    timeline.restart();
  }

  // poster → start everything with sound (user gesture satisfies autoplay rules)
  if (poster && !kioskParam) {
    poster.addEventListener('click', function () {
      poster.classList.add('is-hidden');
      playWithAudio();
    });
  } else if (poster) {
    poster.classList.add('is-hidden');
  }

  // "Replay video" button lives in the outro (next to the quiz link); it
  // appears with the "Stay Safe, Stay Informed" scene and restarts the lesson.
  if (outroReplay) outroReplay.addEventListener('click', function () {
    if (audioOn) playWithAudio(); else playSilent();
  });

  if (kioskParam) document.body.classList.add('vid-kiosk');

  // ---- boot -------------------------------------------------------------
  // Optional ?seek=SECONDS — jump to a fixed frame (verification/thumbnails).
  var seekParam = null;
  try { seekParam = new URLSearchParams(window.location.search).get('seek'); } catch (_) {}

  function seekTo(seconds) {
    resetAll();
    var t = Math.max(0, Math.min(TOTAL, seconds));
    var acc = 0, current = SCENES[0].id, chap = SCENES[0].chapter;
    for (var i = 0; i < SCENES.length; i++) {
      if (t < acc + SCENES[i].dur) { current = SCENES[i].id; chap = SCENES[i].chapter; break; }
      acc += SCENES[i].dur;
    }
    SCENES.forEach(function (sc) { sc.id === current ? show(sc.id) : hide(sc.id); });
    if (poster) { poster.classList.add('is-hidden'); poster.style.display = 'none'; }
    setChapter(chap);
    timeline.progress(0).pause();
    timeline.time(t, false);
  }

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      if (seekParam !== null && !isNaN(parseFloat(seekParam))) {
        seekTo(parseFloat(seekParam));
      } else if (kioskParam) {
        // Screensaver / attract-loop: no poster. Visuals always start; audio
        // may be blocked until a tap (especially inside an iframe with no
        // prior gesture). Try unmuted first, then muted, then silent.
        if (poster) poster.classList.add('is-hidden');
        var inIframe = window.self !== window.top;
        if (inIframe) {
          playMutedAudio();
          if (audio) {
            audio.muted = false;
            audio.play().catch(function () { /* keep muted timeline */ });
          }
        } else {
          playWithAudio();
        }
      } else if (autoplayParam) {
        // opened from the quiz prompt → start immediately WITH audio
        // (the modal button click satisfies the autoplay gesture rule).
        if (poster) poster.classList.add('is-hidden');
        playWithAudio();
      } else {
        // normal page: show poster, hold on frame 0 until the user taps Play
        resetAll();
        show(SCENES[0].id);
        timeline.pause();
      }
    });
  });

  window.RTL3D_VIDEO = {
    playWithAudio: playWithAudio, playSilent: playSilent, seek: seekTo,
    timeline: timeline, total: function () { return TOTAL; }
  };
})();
