(function () {
  'use strict';

  const CLIPS = [
    {
      file: 'Y20260515H152823_CINE1_427_CC_2RL.mp4',
      label: '15 May 2026 — CINE1 (cloud-to-ground, 2 return leaders)',
      caption: 'Cloud-to-ground flash with two return leaders — Phantom T2410, RTL3D observation network.',
    },
    {
      file: 'Y202606 6H065544_CINE24_447_cloudactivity.mp4',
      label: '6 Jun 2026 — CINE24 (cloud activity)',
      caption: 'Pre-discharge cloud activity preceding a lightning event — RTL3D observation network.',
    },
    {
      file: 'Y20260612H184527_CINE4_450_NCGDL.mp4',
      label: '12 Jun 2026 — CINE4 (negative CG dart leader)',
      caption: 'Negative cloud-to-ground flash with dart-leader restrike — RTL3D observation network.',
    },
    {
      file: 'Y20260612H184902_CINE7_451_NCGDL.mp4',
      label: '12 Jun 2026 — CINE7 (negative CG dart leader)',
      caption: 'Negative cloud-to-ground flash — stepped leader and return stroke resolved at 30 fps playback.',
    },
    {
      file: 'Y20260612H185048_CINE9_453_NCGDL.mp4',
      label: '12 Jun 2026 — CINE9 (negative CG dart leader)',
      caption: 'Negative cloud-to-ground flash with channel branching — RTL3D observation network, Peninsular Malaysia.',
    },
  ];

  const select = document.getElementById('hsv-clip-select');
  const video = document.getElementById('hsv-video');
  const source = document.getElementById('hsv-video-source');
  const caption = document.getElementById('hsv-video-caption');
  if (!select || !video || !source || !caption) return;

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
})();
