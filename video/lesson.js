/* When Thunder Roars — cinematic, narration-paced lesson driver.
 *
 * No MP4, no recorded voice. The script is DATA: each scene is a list of
 * narration "beats" (phrases) with a time `at` and a `hold`. The engine
 * reveals each phrase phrase-by-phrase, in spoken rhythm (~140 wpm), so the
 * words arrive the way a reporter would say them — never all at once, never
 * dead air. The lightning channel is the through-line. EN + Malay.
 */
(function () {
  'use strict';

  // ===================================================================
  //  SCRIPT  (the thing that was broken before — now a real narration)
  //  Each scene: { id, ask, art, dur, beats:[ {t, hold, html} ] }
  //  - `t`     seconds from scene start when the phrase appears
  //  - `hold`  how long it stays before the next caption swaps in (visual)
  //  - phrases use <b> for KEY words (gold) and <i> for blue science words.
  //  Pacing target ≈ 140 spoken words/min → ~2.3 words/sec.
  // ===================================================================
  // Voice: science communicator for 8-12 year olds. Every scene opens with a
  // QUESTION, lands a concrete NUMBER, uses a COMPARISON a kid can feel, and
  // ends on a REVEAL/surprise. No poetry, no marketing. Each scene must pass:
  // "Would a child say wow?"  <b>=key number/word (gold), <i>=science word (blue).
  // NOTE on art-index coupling: counter art counts on beat[2]; shelter cards
  // land on beats [0,1,2]=wrong spots, [3]=safe house; rocket climbs on beat[2].
  var SCRIPT = {
    en: {
      poster: { sub: '5 questions about lightning. Most grown-ups get them wrong.', play: 'Play with sound' },
      credit: 'Music: bgmusic — RTL3D outreach',
      replay: 'Watch again', quiz: 'Take the quiz →',
      scenes: [
        // ---- 0 · HOOK ---- surprise: 800 strikes while you watched
        { id: 'intro', art: 'globe', ask: '',
          beats: [
            { hold: 3.2, html: 'How many times does lightning hit Earth every <b>second</b>?' },
            { hold: 2.6, html: 'About <b>100</b> times.' },
            { hold: 3.4, html: 'So in the time you’ve watched this… it struck around <b>800</b> times.' },
            { hold: 3.2, html: 'And <b>Malaysia</b> gets hit more than almost anywhere on Earth.' }
          ] },
        // ---- 1 · HOW ---- surprise: same as a sock zap, but Sun-hot
        { id: 's-how', art: 'crystals', ask: 'So what IS lightning?',
          beats: [
            { hold: 3.4, html: 'You know the tiny zap when you rub your socks on a carpet?' },
            { hold: 3.0, html: 'Lightning is the <b>same thing</b> — just billions of times bigger.' },
            { hold: 3.2, html: 'Up in the cloud, bits of ice rub together until a spark jumps.' },
            { hold: 3.6, html: 'That spark hits <b>30,000°C</b> — <b>5× hotter</b> than the surface of the Sun.' }
          ] },
        // ---- 2 · WHO ---- surprise: it's not luck, it's you
        { id: 's-who', art: 'figure', ask: 'Why does it hit some people and not others?',
          beats: [
            { hold: 2.6, html: 'It’s <b>not</b> bad luck.' },
            { hold: 3.0, html: 'Lightning takes the <b>shortest path</b> to the ground.' },
            { hold: 3.2, html: 'In an open field, the shortest path is the <b>tallest thing</b>.' },
            { hold: 3.0, html: 'Stand up straight out there… and that’s <b>you</b>.' }
          ] },
        // ---- 3 · TWICE (counter on beat[2]) ---- surprise: 7 hits / 40 min
        { id: 's-twice', art: 'counter', ask: 'Can it really strike the same spot twice?',
          beats: [
            { hold: 3.0, html: 'People say lightning never hits the same place twice.' },
            { hold: 2.4, html: '<b>Totally wrong.</b>' },
            { hold: 4.2, html: 'One tower got struck <b>7 times</b> — in just <b>40 minutes</b>.' },
            { hold: 3.0, html: 'That’s a hit every <b>6 minutes</b>. It keeps coming back.' }
          ] },
        // ---- 4 · SAFE (cards on beats 0,1,2 wrong; 3 = house) ----
        // surprise: a tree is the WORST; a building works like a metal cage
        { id: 's-safe', art: 'shelters', ask: 'Quick — where would you hide?',
          beats: [
            { hold: 3.2, html: 'Under a tree? <b>Worst</b> spot — it hits the tree, then jumps into you.' },
            { hold: 2.4, html: 'A tent? It’s just cloth. No help.' },
            { hold: 2.8, html: 'Open field? Now <b>you’re</b> the tallest thing.' },
            { hold: 3.6, html: 'Get inside a <b>building</b> — its walls and wires carry the strike around you.' },
            { hold: 2.8, html: 'The rule: <b>when thunder roars, go indoors.</b>' }
          ] },
        // ---- 5 · TWIST (rocket climbs on beat[2]) ---- biggest surprise
        { id: 's-twist', art: 'rocket', ask: 'Here’s the part that sounds impossible…',
          beats: [
            { hold: 3.0, html: 'We can make lightning strike <b>exactly where we want</b>.' },
            { hold: 2.8, html: 'How? Watch.' },
            { hold: 4.2, html: 'Fire a tiny rocket pulling a thin wire up at the cloud — the bolt follows it <b>straight down</b>.' },
            { hold: 3.4, html: 'Real scientists did this. <b>Melaka, Malaysia. 2026.</b>' }
          ] },
        // ---- 6 · ENDING ---- surprise: one bolt could power a house a month
        { id: 's-end', art: 'outro', ask: '',
          beats: [
            { hold: 3.2, html: 'Lightning isn’t magic. It’s just electricity.' },
            { hold: 3.4, html: 'But one bolt holds enough energy to power a house for a <b>month</b>.' },
            { hold: 2.8, html: 'So — how much do you actually remember?' }
          ] }
      ]
    },
    ms: {
      poster: { sub: '5 soalan tentang kilat. Kebanyakan orang dewasa silap.', play: 'Main dengan bunyi' },
      credit: 'Muzik: bgmusic — jangkauan RTL3D',
      replay: 'Tonton semula', quiz: 'Mula kuiz →',
      scenes: [
        { id: 'intro', art: 'globe', ask: '',
          beats: [
            { hold: 3.2, html: 'Berapa kali kilat menyambar Bumi setiap <b>saat</b>?' },
            { hold: 2.6, html: 'Kira-kira <b>100</b> kali.' },
            { hold: 3.4, html: 'Jadi sepanjang anda menonton ini… ia menyambar kira-kira <b>800</b> kali.' },
            { hold: 3.2, html: 'Dan <b>Malaysia</b> disambar lebih kerap daripada hampir mana-mana tempat di dunia.' }
          ] },
        { id: 's-how', art: 'crystals', ask: 'Jadi, apa sebenarnya kilat?',
          beats: [
            { hold: 3.4, html: 'Tahu kejutan kecil bila anda gosok stoking pada permaidani?' },
            { hold: 3.0, html: 'Kilat <b>benda yang sama</b> — cuma berbilion kali lebih besar.' },
            { hold: 3.2, html: 'Dalam awan, cebisan ais bergeser sehingga percikan melompat.' },
            { hold: 3.6, html: 'Percikan itu mencecah <b>30,000°C</b> — <b>5× lebih panas</b> daripada permukaan Matahari.' }
          ] },
        { id: 's-who', art: 'figure', ask: 'Kenapa sesetengah orang disambar?',
          beats: [
            { hold: 2.6, html: 'Ia <b>bukan</b> nasib malang.' },
            { hold: 3.0, html: 'Kilat ambil <b>jalan terpendek</b> ke tanah.' },
            { hold: 3.2, html: 'Di padang lapang, jalan terpendek ialah <b>benda paling tinggi</b>.' },
            { hold: 3.0, html: 'Berdiri tegak di situ… dan itulah <b>anda</b>.' }
          ] },
        { id: 's-twice', art: 'counter', ask: 'Betulkah ia menyambar tempat sama dua kali?',
          beats: [
            { hold: 3.0, html: 'Kata orang, kilat tak menyambar tempat sama dua kali.' },
            { hold: 2.4, html: '<b>Salah sama sekali.</b>' },
            { hold: 4.2, html: 'Satu menara disambar <b>7 kali</b> — dalam <b>40 minit</b> sahaja.' },
            { hold: 3.0, html: 'Itu sekali setiap <b>6 minit</b>. Ia terus kembali.' }
          ] },
        { id: 's-safe', art: 'shelters', ask: 'Cepat — di mana anda akan berlindung?',
          beats: [
            { hold: 3.2, html: 'Bawah pokok? Tempat <b>paling teruk</b> — ia kena pokok, kemudian melompat ke anda.' },
            { hold: 2.4, html: 'Khemah? Cuma kain. Tak membantu.' },
            { hold: 2.8, html: 'Padang lapang? Kini <b>anda</b> benda paling tinggi.' },
            { hold: 3.6, html: 'Masuk ke <b>bangunan</b> — dinding dan wayarnya mengalirkan kilat mengelilingi anda.' },
            { hold: 2.8, html: 'Peraturannya: <b>bila guruh berdentum, masuk ke dalam.</b>' }
          ] },
        { id: 's-twist', art: 'rocket', ask: 'Inilah bahagian yang bunyinya mustahil…',
          beats: [
            { hold: 3.0, html: 'Kita boleh buat kilat menyambar <b>tepat di tempat kita mahu</b>.' },
            { hold: 2.8, html: 'Bagaimana? Tengok.' },
            { hold: 4.2, html: 'Lancarkan roket kecil menarik wayar halus ke awan — kilat ikut wayar itu <b>terus ke bawah</b>.' },
            { hold: 3.4, html: 'Saintis betul-betul lakukannya. <b>Melaka, Malaysia. 2026.</b>' }
          ] },
        { id: 's-end', art: 'outro', ask: '',
          beats: [
            { hold: 3.2, html: 'Kilat bukan sihir. Ia cuma elektrik.' },
            { hold: 3.4, html: 'Tapi satu kilat simpan tenaga cukup untuk kuasakan rumah selama <b>sebulan</b>.' },
            { hold: 2.8, html: 'Jadi — berapa banyak anda masih ingat?' }
          ] }
      ]
    }
  };

  function curLang() {
    var l = (window.RTL3Di18n && window.RTL3Di18n.lang) || document.documentElement.lang || 'en';
    return SCRIPT[l] ? l : 'en';
  }

  // ---- seeded PRNG so every bolt path is reproducible ------------------
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function boltPath(seed, x0, y0, targetY, spread) {
    var r = rng(seed), cx = x0, cy = y0, d = 'M ' + cx + ' ' + cy.toFixed(1);
    while (cy < targetY) { cx += (r() - 0.5) * spread; cy += 22 + r() * 40; d += ' L ' + cx.toFixed(1) + ' ' + cy.toFixed(1); }
    return d;
  }

  // per-art bolt depth/spread defaults (x position is chosen randomly left/right)
  var CHANNEL = {
    globe:    { seed: 10, targetY: 220, spread: 125, y0: 0 },
    crystals: { seed: 11, targetY: 270, spread: 110, y0: 0 },
    figure:   { seed: 22, targetY: 340, spread: 95, y0: 0 },
    counter:  { seed: 33, targetY: 370, spread: 75, y0: 0 },
    shelters: { seed: 44, targetY: 330, spread: 100, y0: 0 },
    rocket:   { seed: 55, targetY: 280, spread: 85, y0: 0 },
    outro:    { seed: 66, targetY: 240, spread: 115, y0: 0 }
  };

  // Side-frame strike: reproducible random x on left or right, never top-center.
  function channelSpec(art, sceneIndex) {
    var base = CHANNEL[art] || { seed: 10, targetY: 260, spread: 110, y0: 0 };
    var r = rng(base.seed + sceneIndex * 41);
    var onLeft = r() >= 0.5;
    var x0 = onLeft ? (80 + r() * 120) : (800 + r() * 100);
    var y0 = (base.y0 != null ? base.y0 : 0) + r() * 28;
    var targetY = base.targetY + (r() - 0.5) * 65;
    var spread = base.spread * (0.78 + r() * 0.42);
    return [base.seed + sceneIndex, x0, y0, targetY, spread];
  }

  var CH, flash, stage, fill, bgm, poster, scenesRoot, progressBar, playPause, vidGrid;
  var timeline = null;
  var SCENES_EL = [];   // generated scene DOM nodes, in order
  var SCENE_AT = [];    // absolute start time (s) of each scene — for chapter seek
  var CONTENT_END = 0;  // time the last content scene ends (the progress-bar extent)
  var paused = false;   // user-toggled play/pause state
  // ---- scrubbing (drag the progress bar like a video) ----------------
  var CAP_FRAMES = [];  // {start,end,sc,html,ask} — the caption visible in each window
  var scrubbing = false;
  var scrubWasPlaying = false;
  var lastPreviewT = 0;
  var EASE = 'power3.out';

  // ---- voice narration (one continuous track per language) -------------
  // generate_tts.py writes one narration-<lang>.mp3; align_vo.py measures where
  // each line is spoken and stores per-line `starts` in the manifest:
  //   { <lang>: { file, duration, keys:[...], starts:[...] } }
  // When `starts` exist the captions are placed at those real spoken times, so
  // the on-screen text TRACKS the voice. The track restarts with the timeline,
  // so replay stays in step. No file/starts => fall back to hand-set holds.
  var VO = null;
  var voTracks = {};        // lang -> HTMLAudioElement (the narration)
  // The page sets <base href="../">, so all relative URLs resolve from the site
  // root. The voice assets live under video/voice/, so reference them from root.
  var VO_DIR = 'video/voice/';
  function loadVoiceManifest() {
    return fetch(VO_DIR + 'vo-manifest.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { VO = j; })
      .catch(function () { VO = null; });
  }
  // absolute spoken start time (s) for a beat key, or null if not aligned.
  function voStart(lang, key) {
    var m = VO && VO[lang];
    if (!m || !m.starts || !m.keys) return null;
    var i = m.keys.indexOf(key);
    return i >= 0 ? m.starts[i] : null;
  }
  function voAligned(lang) { return !!(VO && VO[lang] && VO[lang].starts); }
  function plan_at(plans, i) { return plans[i] && plans[i].at != null ? plans[i].at : null; }
  function voTrack(lang) {
    if (!(VO && VO[lang] && VO[lang].file)) return null;
    if (!voTracks[lang]) {
      var a = new Audio(VO_DIR + VO[lang].file);
      a.preload = 'auto';
      voTracks[lang] = a;
    }
    return voTracks[lang];
  }
  // start the narration at `offset` seconds, locked to the timeline position.
  function startVo(lang, offset) {
    stopAllVo();
    var a = voTrack(lang);
    if (!a) return;
    try { a.currentTime = offset || 0; a.play().catch(function () {}); } catch (_) {}
  }
  function stopAllVo() {
    Object.keys(voTracks).forEach(function (l) {
      try { voTracks[l].pause(); voTracks[l].currentTime = 0; } catch (_) {}
    });
  }

  // ---- build the visual prop for a given art type --------------------
  function buildArt(art) {
    var wrap = document.createElement('div');
    wrap.className = 'prop art-' + art;
    if (art === 'globe') {
      wrap.innerHTML =
        '<div class="globe-strikes" aria-hidden="true">' +
          '<span class="g-strike"></span><span class="g-strike"></span><span class="g-strike"></span>' +
          '<span class="g-strike"></span><span class="g-strike"></span><span class="g-strike"></span>' +
          '<span class="g-strike"></span><span class="g-strike"></span><span class="g-strike"></span>' +
        '</div>' +
        '<div class="globe" aria-hidden="true">🌍</div>';
    }
    else if (art === 'crystals') {
      wrap.innerHTML =
        '<svg class="crystal-arc" viewBox="0 0 120 80" aria-hidden="true">' +
          '<path class="arc-path" d="M25 55 Q60 8 95 55"/>' +
        '</svg>' +
        '<div class="crystals"><span class="spark a">❄️</span><span class="spark b">💧</span></div>' +
        '<div class="crystal-burst" aria-hidden="true"></div>';
    }
    else if (art === 'figure') {
      wrap.innerHTML =
        '<div class="fig-ground" aria-hidden="true"></div>' +
        '<div class="fig-danger-ring" aria-hidden="true"></div>' +
        '<div class="fig-shadow" aria-hidden="true"></div>' +
        '<div class="figure" aria-hidden="true">🧍</div>';
    }
    else if (art === 'counter') {
      wrap.className = 'vid-hero-wrap';
      wrap.innerHTML = '<div class="strike-rings" aria-hidden="true"><span class="sr"></span><span class="sr"></span><span class="sr"></span></div><div class="vid-hero">0</div>';
    }
    else if (art === 'shelters') {
      wrap.className = 'shelters';
      wrap.innerHTML =
        '<div class="shelter bad"><span class="ic">🌳</span><span class="nm" data-sh="tree"></span><span class="vd">✕</span></div>' +
        '<div class="shelter bad"><span class="ic">⛺</span><span class="nm" data-sh="tent"></span><span class="vd">✕</span></div>' +
        '<div class="shelter bad"><span class="ic">🏟️</span><span class="nm" data-sh="field"></span><span class="vd">✕</span></div>' +
        '<div class="shelter good"><span class="ic">🏠</span><span class="nm" data-sh="house"></span><span class="vd">✓</span></div>';
    }
    else if (art === 'rocket') {
      wrap.className = 'rocket-wrap';
      wrap.innerHTML =
        '<div class="rocket-cloud" aria-hidden="true">☁️</div>' +
        '<svg class="rocket-bolt" viewBox="0 0 40 200" preserveAspectRatio="none" aria-hidden="true">' +
          '<path class="rb-glow" d="M20 200 L27 158 L13 116 L28 74 L15 40 L21 0"/>' +
          '<path class="rb-mid"  d="M20 200 L27 158 L13 116 L28 74 L15 40 L21 0"/>' +
          '<path class="rb-core" d="M20 200 L27 158 L13 116 L28 74 L15 40 L21 0"/>' +
        '</svg>' +
        '<span class="rocket-wire"></span>' +
        '<div class="rocket-ship" aria-hidden="true">' +
          '<span class="rocket">🚀</span>' +
        '</div>';
    }
    else if (art === 'outro') {
      wrap.className = 'logo-lockup';
      wrap.innerHTML =
        '<div class="logo-rings" aria-hidden="true"><span class="lr"></span><span class="lr"></span></div>' +
        '<span class="mk">⚡</span> RTL3D';
    }
    return wrap;
  }

  // shelter labels per language
  var SH = {
    en: { tree: 'Under a tree', tent: 'In a tent', field: 'Open ground', house: 'Inside a house' },
    ms: { tree: 'Bawah pokok', tent: 'Dalam khemah', field: 'Tanah lapang', house: 'Dalam rumah' }
  };

  // ---- (re)build all scene DOM for the active language ---------------
  function buildScenes() {
    var L = SCRIPT[curLang()];
    scenesRoot.innerHTML = '';
    SCENES_EL = [];
    L.scenes.forEach(function (sc) {
      var scene = document.createElement('section');
      scene.className = 'vid-scene';
      scene.style.visibility = 'hidden';

      var art = document.createElement('div'); art.className = 'vid-art';
      var glow = document.createElement('div');
      glow.className = 'vid-art-glow glow-' + sc.art;
      art.appendChild(glow);
      if (sc.ask) {
        var ask = document.createElement('div'); ask.className = 'vid-ask'; ask.textContent = sc.ask;
        art.appendChild(ask);
      }
      var core = document.createElement('div');
      core.className = 'vid-art-core';
      core.appendChild(buildArt(sc.art));
      art.appendChild(core);
      scene.appendChild(art);

      var cap = document.createElement('div'); cap.className = 'vid-caption';
      var line = document.createElement('div'); line.className = 'vid-cap-line';
      cap.appendChild(line);
      scene.appendChild(cap);

      scenesRoot.appendChild(scene);
      SCENES_EL.push(scene);
    });
    // fill shelter labels
    var sh = SH[curLang()];
    scenesRoot.querySelectorAll('[data-sh]').forEach(function (el) { el.textContent = sh[el.getAttribute('data-sh')]; });
  }

  // ---- the through-line bolt ----------------------------------------
  function setChannel(art, sceneIndex) {
    var spec = channelSpec(art, sceneIndex);
    var d = boltPath(spec[0], spec[1], spec[2], spec[3], spec[4]);
    [CH.halo, CH.mid, CH.body, CH.core].forEach(function (p) {
      p.setAttribute('d', d);
    });
    var len = CH.core.getTotalLength ? CH.core.getTotalLength() : 1000;
    [CH.halo, CH.mid, CH.body, CH.core].forEach(function (p) {
      p.style.strokeDasharray = len; p.style.strokeDashoffset = len; p.style.opacity = '0';
    });
    return len;
  }
  function screenShake(tl, at, px) {
    if (!stage) return;
    tl.fromTo(stage, { x: 0 }, { x: px, duration: 0.035, ease: 'none', yoyo: true, repeat: 7 }, at);
    tl.set(stage, { x: 0 }, at + 0.32);
  }
  function flashPop(tl, at, strength, dur) {
    if (!flash) return;
    tl.fromTo(flash, { opacity: 0 }, { opacity: strength || 0.5, duration: 0.05, ease: 'none' }, at);
    tl.to(flash, { opacity: 0, duration: dur || 0.4, ease: 'power2.in' }, at + 0.05);
  }
  function drawChannel(tl, at, art, sceneIndex) {
    var len = setChannel(art, sceneIndex);
    tl.call(function () { setChannel(art, sceneIndex); }, null, at);
    tl.fromTo(CH.core, { strokeDashoffset: len, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 0.32, ease: 'power4.in' }, at);
    tl.fromTo(CH.body, { strokeDashoffset: len, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 0.26, ease: 'power3.in' }, at + 0.07);
    tl.fromTo(CH.mid,  { strokeDashoffset: len, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 0.3,  ease: 'power2.in' }, at + 0.13);
    tl.fromTo(CH.halo, { strokeDashoffset: len, opacity: 0 }, { strokeDashoffset: 0, opacity: 1, duration: 0.38, ease: 'power2.out' }, at + 0.18);
    tl.fromTo(flash, { opacity: 0 }, { opacity: 0.7, duration: 0.04, ease: 'none' }, at + 0.4);
    tl.to(flash, { opacity: 0.12, duration: 0.04 }, at + 0.44);
    tl.to(flash, { opacity: 0.6, duration: 0.04 }, at + 0.5);
    tl.to(flash, { opacity: 0, duration: 0.45, ease: 'power2.in' }, at + 0.54);
    screenShake(tl, at + 0.42, 5);
    tl.to([CH.core, CH.body, CH.mid], { opacity: 0.35, duration: 0.05, yoyo: true, repeat: 5, ease: 'none' }, at + 0.62);
    tl.to([CH.halo, CH.mid, CH.body, CH.core], { opacity: 0, duration: 1.0, ease: 'power2.out' }, at + 0.88);
  }

  // ---- one caption beat owns its WHOLE lifecycle: words come IN, hold,
  //      then words go OUT — and the line is empty for a gap before the
  //      next beat. The out always finishes inside `hold`, so phrases never
  //      overlap and the reader gets a clean breath between lines. --------
  var IN_STAGGER = 0.05;   // per-word delay coming in
  var OUT_STAGGER = 0.035; // per-word delay going out (a touch faster)
  var WORD_IN = 0.4;
  var WORD_OUT = 0.28;

  function revealBeat(tl, lineEl, at, beat, holdUntil) {
    var holder = document.createElement('div');
    holder.className = 'beat';
    holder.style.opacity = '1';
    holder.innerHTML = wrapWords(beat.html);

    // IN: insert + stagger the words up into place
    tl.call(function () {
      lineEl.appendChild(holder);
      var words = holder.querySelectorAll('.ph');
      gsap.killTweensOf(words);
      gsap.fromTo(words, { opacity: 0, y: 26, filter: 'blur(4px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: WORD_IN, ease: 'back.out(1.3)', stagger: IN_STAGGER });
    }, null, at);

    // OUT: lift the words away, then remove. In aligned mode the line stays up
    // until `holdUntil` (when the next line is spoken); otherwise it uses its
    // own scaled hold. Either way the exit completes before that moment.
    var nWords = (beat.html.replace(/<[^>]+>/g, '').trim().split(/\s+/).length) || 1;
    var outDur = WORD_OUT + OUT_STAGGER * (nWords - 1);
    var endAt = (holdUntil != null) ? holdUntil : at + beat.hold * HOLD_SCALE;
    var outAt = endAt - outDur;
    tl.call(function () {
      var words = holder.querySelectorAll('.ph');
      gsap.killTweensOf(words);
      gsap.to(words, { opacity: 0, y: -22, filter: 'blur(4px)', duration: WORD_OUT, ease: 'power2.in',
        stagger: OUT_STAGGER,
        onComplete: function () { if (holder.parentNode) holder.parentNode.removeChild(holder); } });
    }, null, Math.max(at + 0.2, outAt));
  }

  // The scene's question gets a full beat of its own: it reveals word-by-word
  // big in the caption line (like narration), holds, lifts out, and as it goes
  // the gold header tag fades in so the question stays on screen as context.
  function revealAsk(tl, lineEl, askEl, at, askText, leadDur) {
    var holder = document.createElement('div');
    holder.className = 'beat ask-beat';
    holder.innerHTML = wrapWords(askText);
    var nWords = askText.trim().split(/\s+/).length || 1;
    var outDur = WORD_OUT + OUT_STAGGER * (nWords - 1);
    var outAt = at + (leadDur || ASK_LEAD) - outDur;

    tl.call(function () {
      lineEl.appendChild(holder);
      var words = holder.querySelectorAll('.ph');
      gsap.killTweensOf(words);
      gsap.fromTo(words, { opacity: 0, y: 26, filter: 'blur(4px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: ASK_REVEAL, ease: 'back.out(1.3)', stagger: IN_STAGGER });
    }, null, at);

    tl.call(function () {
      var words = holder.querySelectorAll('.ph');
      gsap.killTweensOf(words);
      gsap.to(words, { opacity: 0, y: -22, filter: 'blur(4px)', duration: WORD_OUT, ease: 'power2.in',
        stagger: OUT_STAGGER,
        onComplete: function () { if (holder.parentNode) holder.parentNode.removeChild(holder); } });
    }, null, outAt);

    // header tag fades in as the big question lifts away, then stays
    tl.fromTo(askEl, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, ease: EASE }, outAt);
  }

  // wrap each word of an HTML phrase in <span class="ph ...">; <b>=key, <i>=blue
  function wrapWords(html) {
    // tokenize keeping <b>/<i> markers
    var out = '';
    // split into segments by tags
    var re = /(<b>.*?<\/b>|<i>.*?<\/i>|[^<]+)/g, m;
    while ((m = re.exec(html))) {
      var seg = m[0], cls = '';
      var text = seg;
      if (seg.indexOf('<b>') === 0) { cls = ' key'; text = seg.replace(/<\/?b>/g, ''); }
      else if (seg.indexOf('<i>') === 0) { cls = ' blue'; text = seg.replace(/<\/?i>/g, ''); }
      text.split(/(\s+)/).forEach(function (w) {
        if (/^\s+$/.test(w)) { out += ' '; }
        else if (w.length) { out += '<span class="ph' + cls + '">' + w + '</span>'; }
      });
    }
    return out;
  }

  // ---- build the master timeline ------------------------------------
  // lead-in before the first phrase of each scene (lets the bolt + art land)
  var LEAD_IN = 0.8;
  var GAP = 0.28;          // empty breath between phrases (after out, before next in)
  var TAIL = 0.55;         // quiet beat after the last phrase exits
  var HOLD_SCALE = 1.0;    // single knob for overall pace; lower = snappier
  var ASK_LEAD = 1.7;      // time the question owns up front (reveal + settle)
  var ASK_REVEAL = 0.9;    // big-question reveal before it shrinks to the header

  // Per scene: the absolute (scene-relative) time each beat comes IN, plus the
  // scene's total duration — derived from the in/hold/out cycle so phrases
  // never overlap and there is always a clean gap between them.
  function planScene(sc) {
    var beatIn = [];
    // scenes that pose a question spend ASK_LEAD up front letting the big
    // question reveal word-by-word and settle into the header first.
    var askAt = sc.ask ? LEAD_IN : 0;
    var t = LEAD_IN + (sc.ask ? ASK_LEAD : 0);
    sc.beats.forEach(function (b) {
      beatIn.push(t);
      var nWords = (b.html.replace(/<[^>]+>/g, '').trim().split(/\s+/).length) || 1;
      var inSpan = WORD_IN + IN_STAGGER * (nWords - 1);
      var outSpan = WORD_OUT + OUT_STAGGER * (nWords - 1);
      t += inSpan + b.hold * HOLD_SCALE + outSpan + GAP; // in + readable hold + out + gap
    });
    return { beatIn: beatIn, dur: t + TAIL, askAt: askAt };
  }

  // Build per-scene plans from the VOICE timing: every caption is placed at its
  // measured spoken start, so the text tracks the narrator. Each scene's
  // absolute start `at` is the spoken time of its first element; relative
  // beatIn/askAt are offsets from that; `dur` runs to the next scene's start.
  function planScenesAligned(scenes, lang) {
    // absolute start time of each scene = spoken start of its first element
    var sceneAt = scenes.map(function (sc) {
      var firstKey = sc.ask ? sc.id + '-a' : sc.id + '-0';
      var s = voStart(lang, firstKey);
      return s != null ? s : 0;
    });
    var total = (VO[lang] && VO[lang].duration) || (sceneAt[sceneAt.length - 1] + 4);
    return scenes.map(function (sc, i) {
      var at = sceneAt[i];
      var nextAt = (i < scenes.length - 1) ? sceneAt[i + 1] : total + TAIL;
      var askAt = sc.ask ? Math.max(0, (voStart(lang, sc.id + '-a') || at) - at) : 0;
      var beatIn = sc.beats.map(function (_b, bi) {
        var s = voStart(lang, sc.id + '-' + bi);
        return s != null ? Math.max(0, s - at) : 0;
      });
      return { beatIn: beatIn, dur: nextAt - at, askAt: askAt, at: at };
    });
  }

  function buildTimeline() {
    var L = SCRIPT[curLang()];
    var lang = curLang();
    // plan every scene up front so we know durations + the progress baseline.
    // When the voice track is aligned, pace everything to the spoken times.
    var plans = voAligned(lang) ? planScenesAligned(L.scenes, lang)
                                : L.scenes.map(planScene);
    var totalDur = 0;
    for (var k = 0; k < plans.length; k++) totalDur += plans[k].dur;
    CONTENT_END = totalDur;
    SCENE_AT = [];
    CAP_FRAMES = [];

    var tl = gsap.timeline({
      paused: true,
      onUpdate: function () { if (fill) fill.style.width = (Math.min(1, tl.time() / CONTENT_END) * 100) + '%'; }
    });

    var aligned = voAligned(lang);
    var cursor = 0;
    L.scenes.forEach(function (sc, i) {
      var sceneEl = SCENES_EL[i];
      // aligned mode places scenes at their absolute spoken times.
      var at = (aligned && plan_at(plans, i) != null) ? plan_at(plans, i) : cursor;
      SCENE_AT[i] = at;
      var askEl = sceneEl.querySelector('.vid-ask');
      var lineEl = sceneEl.querySelector('.vid-cap-line');
      var plan = plans[i];

      tl.call(function () {
        sceneEl.style.visibility = 'visible';
        gsap.set(sceneEl, { clearProps: 'scale,filter,x' });
        setDot(i);
      }, null, at);
      buildSceneEntrance(tl, sceneEl, sc, at, plan.dur);
      drawChannel(tl, at, sc.art, i);

      // ask (question) appears first, like a reporter posing it: it reveals
      // word-by-word BIG in the caption line, holds, then settles up into the
      // gold header tag — so it reads as a clear moving subtitle.
      if (askEl && sc.ask) {
        // in aligned mode the big question holds until the first line is spoken
        var askLead = aligned && plan.beatIn.length
          ? Math.max(ASK_REVEAL + 0.3, plan.beatIn[0] - plan.askAt) : ASK_LEAD;
        revealAsk(tl, lineEl, askEl, at + plan.askAt, sc.ask, askLead);
        CAP_FRAMES.push({ start: at + plan.askAt, end: at + plan.askAt + askLead,
                          sc: i, html: sc.ask, ask: true });
      }

      // art set-piece entrance — aligned to its narration beat where it matters
      buildArtEntrance(tl, sceneEl, sc, at, plan.beatIn, plan.dur);

      // narration beats. In aligned mode a line stays up until the NEXT line is
      // spoken (or scene end); otherwise it uses its own hand-set hold.
      sc.beats.forEach(function (b, bi) {
        var inAt = at + plan.beatIn[bi];
        var holdUntil = null;
        if (aligned) {
          var nextIn = (bi + 1 < plan.beatIn.length) ? at + plan.beatIn[bi + 1]
                                                      : at + plan.dur;
          holdUntil = nextIn;
        }
        revealBeat(tl, lineEl, inAt, b, holdUntil);
        var endAt = (holdUntil != null) ? holdUntil : inAt + b.hold * HOLD_SCALE;
        CAP_FRAMES.push({ start: inAt, end: endAt, sc: i, html: b.html, ask: false });
      });

      // scene crossfade out (except last)
      if (i < L.scenes.length - 1) {
        var fade = 0.65;
        tl.to(sceneEl, { opacity: 0, scale: 0.985, filter: 'blur(3px)', duration: fade, ease: 'power3.in' }, at + plan.dur - fade);
        tl.call(function () {
          sceneEl.style.visibility = 'hidden';
          var l = sceneEl.querySelector('.vid-cap-line');
          if (l) l.innerHTML = '';
        }, null, at + plan.dur - 0.02);
      } else {
        buildOutroActions(tl, sceneEl, at + plan.dur - 2.6);
      }
      cursor += plan.dur;
    });

    tl.to({}, { duration: 0.01 }, cursor - 0.01);
    return tl;
  }

  // Scene-level motion (art + backdrop only — captions untouched).
  function buildSceneEntrance(tl, sceneEl, sc, at, dur) {
    var art = sceneEl.querySelector('.vid-art');
    var core = sceneEl.querySelector('.vid-art-core');
    var glow = sceneEl.querySelector('.vid-art-glow');
    gsap.set(sceneEl, { scale: 0.98, filter: 'blur(4px)' });
    tl.fromTo(sceneEl, { opacity: 0, scale: 0.98, filter: 'blur(4px)' },
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.75, ease: 'power3.out' }, at);
    if (glow) {
      tl.fromTo(glow, { opacity: 0, scale: 0.65 }, { opacity: 1, scale: 1, duration: 1.0, ease: 'power2.out' }, at + 0.12);
      tl.to(glow, { scale: 1.08, opacity: 0.8, duration: dur * 0.38, ease: 'sine.inOut', yoyo: true, repeat: 1 }, at + 0.55);
    }
    if (core) {
      tl.fromTo(core, { scale: 0.82, y: 24 }, { scale: 1, y: 0, duration: 0.95, ease: 'back.out(1.4)' }, at + 0.08);
      tl.to(core, { scale: 1.025, duration: Math.max(2.2, dur * 0.32), ease: 'sine.inOut', yoyo: true, repeat: 1 }, at + 0.85);
    } else if (art) {
      tl.fromTo(art, { y: 12 }, { y: 0, duration: 0.75, ease: 'power2.out' }, at + 0.1);
    }
    if (dur > 8) {
      [dur * 0.38, dur * 0.65].forEach(function (ft) {
        flashPop(tl, at + ft, 0.16, 0.22);
      });
    }
  }

  // `beatIn` holds the scene-relative IN time of each narration beat, so art
  // set-pieces can be choreographed to land ON the line that describes them.
  function buildArtEntrance(tl, sceneEl, sc, at, beatIn, sceneDur) {
    var art = sc.art;
    var sel = function (s) { return sceneEl.querySelector(s); };
    var beat = function (i) { return at + (beatIn[i] != null ? beatIn[i] : 1.0); };
    var dur = sceneDur || (beatIn.length ? beatIn[beatIn.length - 1] + 5 : 6);
    if (art === 'globe') {
      var globeWrap = sel('.art-globe');
      tl.fromTo(globeWrap, { opacity: 0, scale: 0.55, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 1.05, ease: 'back.out(1.55)' }, at + 0.35);
      tl.fromTo(sel('.globe'), { rotation: -6, scale: 0.92 }, { rotation: 14, scale: 1, duration: dur - 0.8, ease: 'sine.inOut' }, at + 0.9);
      // lightning pops across the whole intro — more strikes, spaced until scene end
      var strikes = sceneEl.querySelectorAll('.g-strike');
      var n = strikes.length || 1;
      var strikeStart = 0.9;
      var strikeEnd = dur - 0.35;
      var interval = Math.max(0.95, (strikeEnd - strikeStart) / n);
      strikes.forEach(function (st, si) {
        var stAt = at + strikeStart + si * interval;
        if (stAt > at + strikeEnd) return;
        tl.fromTo(st, { opacity: 0, scale: 0.12, y: -12 }, { opacity: 1, scale: 1.05, y: 0, duration: 0.28, ease: 'back.out(2.2)' }, stAt);
        tl.to(st, { opacity: 0.85, duration: 0.35, ease: 'none' }, stAt + 0.28);
        tl.to(st, { opacity: 0, scale: 1.55, duration: 0.5, ease: 'power2.out' }, stAt + 0.65);
        flashPop(tl, stAt + 0.04, 0.14 + (si % 4) * 0.04, 0.2);
      });
    } else if (art === 'crystals') {
      tl.fromTo(sel('.prop'), { opacity: 0, scale: 0.45, rotation: -8 }, { opacity: 1, scale: 1, rotation: 0, duration: 1.0, ease: 'back.out(1.65)' }, at + 0.5);
      var sparkA = sceneEl.querySelector('.spark.a');
      var sparkB = sceneEl.querySelector('.spark.b');
      var arc = sel('.arc-path');
      var burst = sel('.crystal-burst');
      if (arc) {
        var arcLen = arc.getTotalLength ? arc.getTotalLength() : 100;
        gsap.set(arc, { strokeDasharray: arcLen, strokeDashoffset: arcLen, opacity: 0.8 });
        tl.to(arc, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.inOut' }, at + 1.2);
        tl.to(arc, { opacity: 0.2, duration: 0.4, yoyo: true, repeat: 6, ease: 'sine.inOut' }, at + 2.0);
      }
      tl.to(sparkA, { x: 22, rotation: 12, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 }, at + 1.3);
      tl.to(sparkB, { x: -22, rotation: -12, duration: 1.1, ease: 'sine.inOut', yoyo: true, repeat: -1 }, at + 1.3);
      tl.fromTo(burst, { scale: 0.3, opacity: 0 }, { scale: 1.6, opacity: 0.7, duration: 0.35, ease: 'power2.out' }, beat(2));
      tl.to(burst, { scale: 2.2, opacity: 0, duration: 0.5, ease: 'power2.in' }, beat(2) + 0.35);
      flashPop(tl, beat(2) + 0.1, 0.35, 0.35);
    } else if (art === 'figure') {
      tl.fromTo(sel('.fig-ground'), { scaleX: 0.2, opacity: 0 }, { scaleX: 1, opacity: 1, duration: 0.65, ease: 'power3.out' }, at + 0.45);
      tl.fromTo(sel('.prop'), { opacity: 0, y: 50, scale: 0.75 }, { opacity: 1, y: 0, scale: 1, duration: 1.0, ease: 'back.out(1.5)' }, at + 0.6);
      tl.fromTo(sel('.fig-shadow'), { scaleX: 0.4, opacity: 0 }, { scaleX: 1, opacity: 0.55, duration: 1.2, ease: 'power1.inOut' }, at + 1.0);
      tl.to(sel('.fig-shadow'), { scaleX: 1.5, scaleY: 1.2, opacity: 0.75, duration: beat(3) - at - 1.2, ease: 'power1.in' }, at + 1.2);
      tl.fromTo(sel('.fig-danger-ring'), { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 0.85, duration: 0.6, ease: 'back.out(1.5)' }, beat(2) - 0.3);
      tl.to(sel('.fig-danger-ring'), { scale: 1.35, opacity: 0, duration: 0.8, ease: 'power2.out' }, beat(2) + 0.3);
      tl.to(sel('.figure'), { y: -4, duration: 0.6, ease: 'sine.inOut', yoyo: true, repeat: 3 }, beat(2));
      flashPop(tl, beat(3) - 0.1, 0.28, 0.3);
    } else if (art === 'counter') {
      var num = sel('.vid-hero');
      var rings = sceneEl.querySelectorAll('.strike-rings .sr');
      var c2 = { v: 0 };
      var countAt = beat(2);
      tl.fromTo(num, { opacity: 0, scale: 0.45, y: 16 }, { opacity: 1, scale: 1, y: 0, duration: 0.7, ease: 'back.out(1.65)' }, countAt - 0.45);
      tl.to(c2, { v: 7, duration: 2.8, ease: 'power1.inOut',
        onUpdate: function () { num.textContent = Math.round(c2.v); gsap.set(num, { scale: 0.78 + (c2.v / 7) * 0.55 }); } }, countAt);
      [0.6, 1.5, 2.5].forEach(function (ft, ri) {
        var rAt = countAt + ft;
        tl.fromTo(rings[ri], { scale: 0.2, opacity: 0.85 }, { scale: 3.2, opacity: 0, duration: 0.75, ease: 'power2.out' }, rAt);
        flashPop(tl, rAt, 0.35, 0.32);
        screenShake(tl, rAt, 3);
      });
      tl.to(num, { opacity: 0, scale: 0.85, duration: 0.6, ease: 'power2.in' }, beat(3) - 0.2);
    } else if (art === 'shelters') {
      var bad = sceneEl.querySelectorAll('.shelter.bad');
      var good = sceneEl.querySelector('.shelter.good');
      // 2×2 grid: tree | tent  /  field | house — one card per beat
      tl.fromTo(bad[0], { opacity: 0, y: 28, scale: 0.82 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.55)' }, beat(0));
      tl.to(bad[0], { x: 3, duration: 0.07, yoyo: true, repeat: 3, ease: 'none' }, beat(0) + 0.45);
      flashPop(tl, beat(0) + 0.12, 0.2, 0.18);
      tl.fromTo(bad[1], { opacity: 0, y: 28, scale: 0.82 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.55)' }, beat(1));
      tl.to(bad[1], { y: 2, duration: 0.08, yoyo: true, repeat: 2, ease: 'sine.inOut' }, beat(1) + 0.35);
      tl.fromTo(bad[2], { opacity: 0, y: 28, scale: 0.82 }, { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.55)' }, beat(2));
      tl.to(bad, { opacity: 0.5, scale: 0.94, duration: 0.45, ease: 'power2.inOut' }, beat(3) - 0.15);
      tl.fromTo(good, { opacity: 0, scale: 0.75 }, { opacity: 1, scale: 1.06, duration: 0.7, ease: 'back.out(2)' }, beat(3));
      tl.call(function () { good.classList.add('is-glow'); }, null, beat(3) + 0.45);
      tl.to(good, { scale: 1.08, duration: 0.5, ease: 'sine.inOut', yoyo: true, repeat: 3 }, beat(3) + 0.55);
      flashPop(tl, beat(3) + 0.15, 0.28, 0.3);
    } else if (art === 'rocket') {
      var wrap = sel('.rocket-wrap'), ship = sel('.rocket-ship'),
          wire = sel('.rocket-wire'), bolt = sel('.rocket-bolt'),
          cloud = sel('.rocket-cloud');
      var climbAt = beat(2);
      var strikeAt = climbAt + 2.6;
      tl.call(function () { gsap.set(ship, { xPercent: -50, left: '50%', y: 0, opacity: 1 }); }, null, at + 0.5);
      tl.fromTo(wrap, { opacity: 0, y: 16, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.65, ease: 'power2.out' }, at + 0.5);
      tl.fromTo(cloud, { opacity: 0, y: -16, scale: 0.7 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.5)' }, at + 0.8);
      tl.to(cloud, { x: 6, duration: 2.5, ease: 'sine.inOut', yoyo: true, repeat: -1 }, at + 1.5);
      var climb = 0;
      tl.call(function () {
        var r = wrap.getBoundingClientRect();
        climb = r.height * 0.85 || 180;
        gsap.set(wire, { height: 0, opacity: 1 });
        gsap.set(bolt, { height: 0, opacity: 0 });
      }, null, climbAt - 0.3);
      tl.to(ship, { y: function () { return -climb; }, duration: 2.6, ease: 'power1.in' }, climbAt);
      tl.to(wire, { height: function () { return climb; }, duration: 2.6, ease: 'power1.in' }, climbAt);
      tl.to(cloud, { scale: 1.15, duration: 0.3, ease: 'power2.in' }, strikeAt - 0.2);
      tl.set(bolt, { height: function () { return climb; } }, strikeAt);
      tl.fromTo(bolt, { opacity: 0 }, { opacity: 1, duration: 0.05 }, strikeAt);
      tl.to(bolt, { opacity: 0.25, duration: 0.05 }, strikeAt + 0.08);
      tl.to(bolt, { opacity: 1, duration: 0.05 }, strikeAt + 0.14);
      tl.to(bolt, { opacity: 0, duration: 0.55, ease: 'power2.out' }, strikeAt + 0.32);
      flashPop(tl, strikeAt, 0.85, 0.55);
      screenShake(tl, strikeAt, 8);
      tl.to(cloud, { scale: 1.35, opacity: 0.5, duration: 0.4, ease: 'power2.out' }, strikeAt + 0.1);
      tl.to(ship, { opacity: 0, duration: 0.4 }, strikeAt + 0.15);
      tl.to(wire, { opacity: 0, duration: 0.5 }, strikeAt + 0.3);
    } else if (art === 'outro') {
      var logo = sel('.logo-lockup');
      var lrs = sceneEl.querySelectorAll('.logo-rings .lr');
      tl.fromTo(logo, { opacity: 0, scale: 0.55, rotation: -6 }, { opacity: 1, scale: 1, rotation: 0, duration: 1.05, ease: 'back.out(1.65)' }, at + 0.25);
      tl.fromTo(lrs[0], { scale: 0.5, opacity: 0.7 }, { scale: 2.2, opacity: 0, duration: 1.8, ease: 'power2.out' }, at + 0.6);
      tl.fromTo(lrs[1], { scale: 0.5, opacity: 0.5 }, { scale: 2.8, opacity: 0, duration: 2.2, ease: 'power2.out' }, at + 1.2);
      tl.to(logo, { scale: 1.06, duration: 1.2, ease: 'sine.inOut', yoyo: true, repeat: -1 }, at + 1.5);
      flashPop(tl, at + 0.5, 0.4, 0.45);
    }
  }

  function buildOutroActions(tl, sceneEl, at) {
    var L = SCRIPT[curLang()];
    var cap = sceneEl.querySelector('.vid-caption');
    var actions = document.createElement('div');
    actions.className = 'vid-outro-actions';
    actions.innerHTML =
      '<button type="button" class="vid-replay" id="vid-replay"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg> <span>' + L.replay + '</span></button>' +
      '<a class="vid-quiz-link" href="quiz/">' + L.quiz + '</a>';
    cap.appendChild(actions);
    tl.fromTo(actions, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.9, ease: EASE }, at);
    tl.to(actions.querySelector('.vid-quiz-link'), { scale: 1.05, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: 4 }, at + 1.0);
    actions.querySelector('#vid-replay').addEventListener('click', function () {
      play();   // restarts video AND music together from the top
    });
  }

  // ---- dots (removed from UI — progress bar handles seek) ------------
  function buildDots() {}
  function setDot() {}

  // ---- play / reset --------------------------------------------------
  function resetChannel() {
    [CH.halo, CH.mid, CH.body, CH.core].forEach(function (p) { p.style.opacity = '0'; });
    if (flash) gsap.set(flash, { opacity: 0 });
    if (stage) gsap.set(stage, { x: 0 });
  }

  // single source of truth for the background music level (kept low so the
  // on-screen narration is what the viewer reads, music is just atmosphere).
  var BGM_VOLUME = 0.10;
  // start the music at `offset` seconds so it stays locked to the timeline.
  function restartBgm(offset) {
    if (!bgm) return;
    bgm.volume = BGM_VOLUME;
    var t = offset || 0;
    var d = bgm.duration;
    try { bgm.currentTime = (d && t > d) ? (t % d) : t; } catch (_) {}
    bgm.play().catch(function () {});
  }

  // play() always starts the timeline at 0; startRun(t) starts it part-way
  // through. The audio is set to the same offset, so video and sound stay
  // locked together on first play, replay, language change AND when scrubbing.
  function play() { startRun(0, true); }

  // Build a fresh run and place the playhead (plus audio) at `fromTime`.
  // `playAfter` true => keep playing; false => land on that frame, paused.
  function startRun(fromTime, playAfter) {
    var t = Math.max(0, Math.min(CONTENT_END || 1e9, fromTime || 0));
    if (timeline) timeline.kill();
    buildScenes();
    buildDots();
    resetChannel();
    applyStaticStrings();
    timeline = buildTimeline();
    // Fast-forward THROUGH the timeline with events enabled (suppressEvents =
    // false) so every caption append/remove fires in order and the DOM lands in
    // the exact state for time t — this is what makes mid-scene seeks precise
    // instead of dumping you on an empty caption.
    timeline.pause();
    timeline.time(t, false);
    cleanupStaleBeats();
    paused = !playAfter;
    if (playAfter) {
      restartBgm(t);
      startVo(curLang(), t);
      showPlayPause(false);
      timeline.play();
    } else {
      if (bgm) { try { bgm.currentTime = (bgm.duration && t > bgm.duration) ? (t % bgm.duration) : t; } catch (_) {} bgm.pause(); }
      var a = voTrack(curLang()); if (a) { try { a.currentTime = t; } catch (_) {} a.pause(); }
      showPlayPause(true);
    }
    updateFill(t);
  }

  // After an events-enabled seek the spawned word tweens settle in real time and
  // a few past-beat nodes may still be mid-removal; keep only the last caption
  // per line and force it fully visible so the landed frame is clean.
  function cleanupStaleBeats() {
    SCENES_EL.forEach(function (el) {
      var line = el.querySelector('.vid-cap-line');
      if (!line) return;
      var beats = line.querySelectorAll('.beat');
      for (var i = 0; i < beats.length - 1; i++) { if (beats[i].parentNode) beats[i].parentNode.removeChild(beats[i]); }
      var last = beats[beats.length - 1];
      if (last) {
        last.style.opacity = '1';
        last.querySelectorAll('.ph').forEach(function (w) { w.style.opacity = '1'; w.style.transform = 'none'; w.style.filter = 'none'; });
      }
    });
  }

  function updateFill(t) {
    if (fill && CONTENT_END) fill.style.width = (Math.min(1, t / CONTENT_END) * 100) + '%';
  }

  // ---- play / pause toggle (click anywhere on the stage) -------------
  function togglePlay() {
    if (!timeline) return;
    // if the run already finished, a click starts it over from the top
    if (timeline.progress() >= 1) { play(); return; }
    if (paused) {
      timeline.resume();
      if (bgm) bgm.play().catch(function () {});
      var a = voTrack(curLang()); if (a) a.play().catch(function () {});
      paused = false;
      showPlayPause(false);
    } else {
      timeline.pause();
      if (bgm) bgm.pause();
      var a2 = voTrack(curLang()); if (a2) a2.pause();
      paused = true;
      showPlayPause(true);
    }
  }

  // ---- scrub: drag the progress bar like a video player --------------
  // exact time under the pointer, clamped to the seekable range
  function timeFromEvent(e) {
    if (!progressBar || !CONTENT_END) return null;
    var rect = progressBar.getBoundingClientRect();
    var cx = (e.clientX != null) ? e.clientX
           : (e.touches && e.touches[0]) ? e.touches[0].clientX
           : (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : null;
    if (cx == null || !rect.width) return null;
    var frac = Math.max(0, Math.min(1, (cx - rect.left) / rect.width));
    return frac * CONTENT_END;
  }

  function activeSceneIndex(t) {
    var idx = 0;
    for (var i = 0; i < SCENE_AT.length; i++) { if (SCENE_AT[i] <= t + 0.0001) idx = i; }
    return idx;
  }

  // Render a frozen frame at time t WITHOUT a rebuild — cheap enough to run on
  // every pointermove so the lesson visibly follows the drag. Art/channel come
  // from the timeline (suppressed time-jump); scene visibility + the caption are
  // driven by hand from CAP_FRAMES so they update live as you cross scenes.
  function previewFrame(t) {
    if (!timeline) return;
    t = Math.max(0, Math.min(CONTENT_END, t));
    lastPreviewT = t;
    timeline.pause();
    timeline.time(t, true);            // render tween states; no caption-call spam
    var si = activeSceneIndex(t);
    SCENES_EL.forEach(function (el, i) {
      el.style.visibility = (i === si) ? 'visible' : 'hidden';
      el.style.opacity = (i === si) ? '1' : '0';
    });
    setDot(si);
    var frame = null;
    for (var f = 0; f < CAP_FRAMES.length; f++) {
      var fr = CAP_FRAMES[f];
      if (fr.sc === si && t >= fr.start && t < fr.end) { frame = fr; break; }
    }
    var line = SCENES_EL[si] && SCENES_EL[si].querySelector('.vid-cap-line');
    if (line) {
      if (frame) {
        line.innerHTML = '<div class="beat' + (frame.ask ? ' ask-beat' : '') + '"></div>';
        var holder = line.firstChild;
        holder.style.opacity = '1';
        holder.innerHTML = wrapWords(frame.html);
        holder.querySelectorAll('.ph').forEach(function (w) { w.style.opacity = '1'; w.style.transform = 'none'; w.style.filter = 'none'; });
      } else {
        line.innerHTML = '';
      }
    }
    updateFill(t);
  }

  function beginScrub(e) {
    if (!timeline || !CONTENT_END) return;
    if (poster && !poster.classList.contains('is-hidden')) return;  // not started yet
    scrubbing = true;
    scrubWasPlaying = !paused && timeline.progress() < 1;
    if (progressBar) progressBar.classList.add('is-scrubbing');
    if (bgm) bgm.pause();
    var a = voTrack(curLang()); if (a) a.pause();
    showPlayPause(false);
    var t = timeFromEvent(e); if (t != null) previewFrame(t);
    if (e.cancelable) e.preventDefault();
  }
  function moveScrub(e) {
    if (!scrubbing) return;
    var t = timeFromEvent(e); if (t != null) previewFrame(t);
    if (e.cancelable) e.preventDefault();
  }
  function endScrub(e) {
    if (!scrubbing) return;
    scrubbing = false;
    if (progressBar) progressBar.classList.remove('is-scrubbing');
    var t = timeFromEvent(e);
    if (t == null) t = lastPreviewT;
    // commit precisely to where the pointer was released; resume only if we
    // were playing before the grab (otherwise stay parked on that frame)
    startRun(t, scrubWasPlaying);
  }

  // brief on-screen play/pause cue. `isPaused` true => leave the ▶ showing.
  function showPlayPause(isPaused) {
    if (!playPause) return;
    if (showPlayPause._t) { clearTimeout(showPlayPause._t); showPlayPause._t = null; }
    if (isPaused) {
      playPause.textContent = '▶';            // ▶
      playPause.classList.add('show');
    } else {
      playPause.textContent = '❚❚';      // ❚❚
      playPause.classList.add('show');
      showPlayPause._t = setTimeout(function () { playPause.classList.remove('show'); }, 550);
    }
  }

  function applyStaticStrings() {
    var L = SCRIPT[curLang()];
    var sub = document.getElementById('poster-sub'); if (sub) sub.textContent = L.poster.sub;
    var pl = document.getElementById('poster-play'); if (pl) pl.textContent = L.poster.play;
    var cr = document.getElementById('vid-credit'); if (cr) cr.textContent = L.credit;
  }

  // ---- boot ----------------------------------------------------------
  function init() {
    CH = { halo: document.getElementById('ch-halo'), mid: document.getElementById('ch-mid'),
           body: document.getElementById('ch-body'), core: document.getElementById('ch-core') };
    flash = document.getElementById('vid-flash');
    stage = document.getElementById('vid-stage');
    fill = document.getElementById('vid-progress-fill');
    bgm = document.getElementById('vid-bgm');
    poster = document.getElementById('vid-poster');
    scenesRoot = document.getElementById('vid-scenes');
    progressBar = stage.querySelector('.vid-progress');
    playPause = document.getElementById('vid-playpause');
    vidGrid = document.querySelector('.vid-grid');
    if (vidGrid) gsap.to(vidGrid, { opacity: 0.55, duration: 3, ease: 'sine.inOut', yoyo: true, repeat: -1 });

    applyStaticStrings();
    // load voice durations first so the timeline is paced to the spoken clips,
    // then build a still first frame behind the poster. (No manifest => silent.)
    loadVoiceManifest().then(function () {
      buildScenes(); buildDots();
      timeline = buildTimeline(); timeline.progress(0);
    });

    poster.addEventListener('click', function () {
      poster.classList.add('is-hidden');
      play();   // play() restarts the music in lock-step with the timeline
      try { localStorage.setItem('rtl3d-watched-video', '1'); } catch (_) {}
    });

    // click anywhere on the stage toggles play/pause — but never when the click
    // lands on a real control (progress bar, dots, outro buttons/links) or the
    // poster is still up (lesson not started yet).
    stage.addEventListener('click', function (e) {
      if (poster && !poster.classList.contains('is-hidden')) return;
      if (e.target.closest('.vid-progress, .vid-outro-actions, a, button')) return;
      togglePlay();
    });

    // scrub: press + drag the progress bar (mouse or touch) like a video player.
    // A plain click is just a press+release in place, so it seeks precisely too.
    if (progressBar) {
      if (window.PointerEvent) {
        progressBar.addEventListener('pointerdown', function (e) {
          e.stopPropagation();
          beginScrub(e);
          try { progressBar.setPointerCapture(e.pointerId); } catch (_) {}
        });
        progressBar.addEventListener('pointermove', moveScrub);
        progressBar.addEventListener('pointerup', function (e) { endScrub(e); });
        progressBar.addEventListener('pointercancel', function (e) { endScrub(e); });
      } else {
        // legacy mouse + touch fallback
        progressBar.addEventListener('mousedown', function (e) { e.stopPropagation(); beginScrub(e); });
        window.addEventListener('mousemove', moveScrub);
        window.addEventListener('mouseup', endScrub);
        progressBar.addEventListener('touchstart', function (e) { e.stopPropagation(); beginScrub(e); }, { passive: false });
        progressBar.addEventListener('touchmove', moveScrub, { passive: false });
        progressBar.addEventListener('touchend', endScrub);
      }
      // swallow the click that follows a press so the stage toggle never fires
      progressBar.addEventListener('click', function (e) { e.stopPropagation(); });
    }

    document.addEventListener('rtl3d:langchange', function () {
      applyStaticStrings();
      // if a run is in progress, restart it in the new language from the top
      if (poster.classList.contains('is-hidden')) play();
    });

    window.RTL3D_LESSON = { play: play };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
