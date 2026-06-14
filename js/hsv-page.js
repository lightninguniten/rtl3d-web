(function () {
  'use strict';

  const CLIPS = [
    {
      file: 'Y20260515H152823_CINE1_427_CC_2RL.mp4',
      label: '15 May 2026 — Cloud-To-Cloud Flash With Recoil Leaders',
      caption: 'Cloud-to-cloud flash showing recoil leaders propagating along decaying leader channels — Phantom T2410, RTL3D observation network.',
    },
    {
      file: 'Y202606 6H065544_CINE24_447_cloudactivity.mp4',
      label: '6 Jun 2026 — Preliminary Breakdown',
      caption: 'Preliminary breakdown in the cloud before stepped-leader initiation — RTL3D observation network.',
    },
    {
      file: 'Y20260612H184527_CINE4_450_NCGDL.mp4',
      label: '12 Jun 2026 18:45 — Negative Cloud-To-Ground Dart Leader And Return Stroke',
      caption: 'Subsequent stroke of a negative cloud-to-ground flash — dart leader followed by return stroke.',
    },
    {
      file: 'Y20260612H184902_CINE7_451_NCGDL.mp4',
      label: '12 Jun 2026 18:49 — Negative Cloud-To-Ground Dart Leader And Return Stroke',
      caption: 'Dart leader and return stroke in a negative cloud-to-ground flash — stepped-leader structure resolved at 30 fps playback.',
    },
    {
      file: 'Y20260612H185048_CINE9_453_NCGDL.mp4',
      label: '12 Jun 2026 18:50 — Negative Cloud-To-Ground Dart Leader And Return Stroke',
      caption: 'Negative cloud-to-ground flash with dart leader, return stroke, and channel branching — RTL3D observation network, Peninsular Malaysia.',
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

  function clipUrl(file) {
    return base + encodeURI(file);
  }

  function populateSelect() {
    select.innerHTML = CLIPS.map(function (clip, i) {
      return '<option value="' + i + '">' + clip.label + '</option>';
    }).join('');
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

  function loadClip(index) {
    const clip = CLIPS[index];
    if (!clip) return;
    video.pause();
    source.src = clipUrl(clip.file);
    video.load();
    caption.textContent = clip.caption;
    playWhenReady();
  }

  populateSelect();
  loadClip(0);

  select.addEventListener('change', function () {
    loadClip(Number(select.value));
  });

  function setTheater(active) {
    if (!page || !theaterToggle) return;
    page.classList.toggle('hsv-theater-active', active);
    theaterToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
    theaterToggle.setAttribute('aria-label', active ? 'Exit theater mode' : 'Expand theater mode');
    theaterToggle.title = active ? 'Exit theater mode' : 'Theater mode';
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
})();
