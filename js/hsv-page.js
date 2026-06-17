(function () {
  'use strict';

  const CLIPS = [
    {
      file: 'Y20260515H152823_CINE1_427_CC_2RL.mp4',
      labelKey: 'hsv.clip0.label',
      captionKey: 'hsv.caption',
    },
    {
      file: 'Y202606 6H065544_CINE24_447_cloudactivity.mp4',
      labelKey: 'hsv.clip1.label',
      captionKey: 'hsv.clip1.caption',
    },
    {
      file: 'Y20260612H184527_CINE4_450_NCGDL.mp4',
      labelKey: 'hsv.clip2.label',
      captionKey: 'hsv.clip2.caption',
    },
    {
      file: 'Y20260612H184902_CINE7_451_NCGDL.mp4',
      labelKey: 'hsv.clip3.label',
      captionKey: 'hsv.clip3.caption',
    },
    {
      file: 'Y20260612H185048_CINE9_453_NCGDL.mp4',
      labelKey: 'hsv.clip4.label',
      captionKey: 'hsv.clip4.caption',
    },
  ];

  const select = document.getElementById('hsv-clip-select');
  const video = document.getElementById('hsv-video');
  const source = document.getElementById('hsv-video-source');
  const caption = document.getElementById('hsv-video-caption');
  const page = document.querySelector('.hsv-page');
  const theater = document.getElementById('hsv-theater');
  const theaterToggle = document.getElementById('hsv-theater-toggle');
  if (!select || !video || !source || !caption) return;

  const THEATER_KEY = 'rtl3d-hsv-theater';
  const base = 'videos/highspeedvideos/';

  function t(key) {
    if (window.RTL3Di18n) {
      const v = window.RTL3Di18n.t(key);
      if (v != null) return v;
    }
    return null;
  }

  function clipLabel(index) {
    const clip = CLIPS[index];
    if (!clip) return '';
    return t(clip.labelKey) || clip.labelKey;
  }

  function clipCaption(index) {
    const clip = CLIPS[index];
    if (!clip) return '';
    return t(clip.captionKey) || clip.captionKey;
  }

  function clipUrl(file) {
    return base + encodeURI(file);
  }

  function populateSelect() {
    const idx = Number(select.value);
    const current = Number.isFinite(idx) ? idx : 0;
    select.innerHTML = CLIPS.map(function (clip, i) {
      return '<option value="' + i + '">' + clipLabel(i) + '</option>';
    }).join('');
    select.value = String(current);
  }

  function playWhenReady() {
    function tryPlay() {
      video.play().catch(function () {});
    }
    if (video.readyState >= 2) {
      tryPlay();
    } else {
      video.addEventListener('canplay', tryPlay, { once: true });
    }
  }

  function loadClip(index, reloadVideo) {
    const clip = CLIPS[index];
    if (!clip) return;
    if (reloadVideo) {
      video.pause();
      source.src = clipUrl(clip.file);
      video.load();
      playWhenReady();
    }
    caption.textContent = clipCaption(index);
  }

  function syncTheaterLabels() {
    if (!theaterToggle || !page) return;
    const active = page.classList.contains('hsv-theater-active');
    const label = t(active ? 'hsv.theater.exit' : 'hsv.theater.enter');
    if (label != null) {
      theaterToggle.setAttribute('aria-label', label);
      theaterToggle.title = label;
    }
  }

  function refreshClipUi(reloadVideo) {
    const idx = Number(select.value);
    populateSelect();
    loadClip(Number.isFinite(idx) ? idx : 0, reloadVideo);
    syncTheaterLabels();
  }

  select.addEventListener('change', function () {
    loadClip(Number(select.value), true);
  });

  function setTheater(active) {
    if (!page || !theaterToggle) return;
    page.classList.toggle('hsv-theater-active', active);
    theaterToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
    syncTheaterLabels();
    try {
      sessionStorage.setItem(THEATER_KEY, active ? '1' : '0');
    } catch (e) {}
    if (active && theater) {
      theater.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  if (theaterToggle) {
    let theaterOn = page.classList.contains('hsv-theater-active');
    try {
      const stored = sessionStorage.getItem(THEATER_KEY);
      if (stored === '1' || stored === '0') {
        theaterOn = stored === '1';
        setTheater(theaterOn);
      }
    } catch (e) {}

    theaterToggle.addEventListener('click', function () {
      setTheater(!page.classList.contains('hsv-theater-active'));
    });
  }

  let clipUiReady = false;

  document.addEventListener('DOMContentLoaded', function () {
    refreshClipUi(true);
    clipUiReady = true;
  });

  document.addEventListener('rtl3d:langchange', function () {
    if (!clipUiReady) return;
    refreshClipUi(false);
  });
})();
