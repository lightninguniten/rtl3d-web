(function () {
  'use strict';

  if (document.body.dataset.page !== 'mission') return;

  var GALLERY_URL = 'data/mission/gallery.json';
  var AUTO_MS = 7000;

  var FALLBACK_ITEMS = [
    {
      topic: '3D lightning mapping',
      image: 'images/mission/night-time-lightning-over-02.jpg',
      caption: 'Night-time lightning over the RTL3D study region — CG activity monitored by the Peninsular LF network.'
    },
    {
      topic: '3D lightning mapping',
      image: 'images/mission/lightning-localization-seminar-and-03.jpg',
      caption: 'Lightning localization seminar — 2D and 3D mapping progress using Malaysian FALMA observation data.'
    },
    {
      topic: 'Observation network',
      image: 'images/mission/and-vhf-observation-network-04.jpg',
      caption: 'LF and VHF observation network field work — site checks ahead of the monsoon lightning season.'
    },
    {
      topic: 'Rocket-triggered lightning',
      image: 'images/mission/rtl3d-field-campaign-preparations-05.jpg',
      caption: 'RTL3D field campaign preparations — rocket-triggered lightning research in Malaysia.'
    }
  ];

  var root = document.querySelector('[data-mission-gallery]');
  if (!root) return;

  var track = root.querySelector('.mission-gallery-track');
  var captionEl = root.querySelector('.mission-gallery-caption');
  var topicEl = root.querySelector('.mission-gallery-topic');
  var captionTextEl = root.querySelector('.mission-gallery-caption-text');
  var dotsEl = root.querySelector('.mission-gallery-dots');
  var prevBtn = root.querySelector('.mission-gallery-prev');
  var nextBtn = root.querySelector('.mission-gallery-next');

  var items = [];
  var index = 0;
  var timer = null;
  var galleryVersion = '';
  var viewport = root.querySelector('.mission-gallery-viewport');

  function imageUrl(path) {
    if (!path) return path;
    return galleryVersion ? path + '?v=' + galleryVersion : path;
  }

  /** Set frosted-glass letterbox backdrop from the slide image (always contain, never crop). */
  function applySlideBackdrop(img) {
    if (!img) return;
    var slide = img.closest('.mission-gallery-slide');
    if (!slide) return;

    slide.style.setProperty('--slide-bg', 'url("' + (img.currentSrc || img.src) + '")');

    var nw = img.naturalWidth || parseInt(img.getAttribute('width'), 10);
    var nh = img.naturalHeight || parseInt(img.getAttribute('height'), 10);
    if (nw && nh) {
      var orient = nh > nw * 1.08 ? 'portrait' : (nw > nh * 1.08 ? 'landscape' : 'square');
      slide.dataset.orientation = orient;
    }
  }

  function refreshSlideBackdrops() {
    if (!track) return;
    track.querySelectorAll('.mission-gallery-slide img').forEach(applySlideBackdrop);
  }

  function bindImageBackdrop(img) {
    function run() { applySlideBackdrop(img); }
    img.addEventListener('load', run);
    if (img.complete) run();
  }

  function setCaption(item) {
    var topic = item.topic || '';
    if (topicEl) {
      topicEl.textContent = topic;
      topicEl.dataset.topic = topic;
      topicEl.hidden = !topic;
    }
    if (captionTextEl) {
      captionTextEl.textContent = item.caption || '';
    } else if (captionEl) {
      captionEl.textContent = item.caption || '';
    }
  }

  function showSlide(i) {
    if (!items.length) return;
    index = (i + items.length) % items.length;
    var slides = track.querySelectorAll('.mission-gallery-slide');
    slides.forEach(function (slide, n) {
      slide.classList.toggle('is-active', n === index);
      slide.hidden = n !== index;
    });
    dotsEl.querySelectorAll('.mission-gallery-dot').forEach(function (dot, n) {
      dot.classList.toggle('is-active', n === index);
      dot.setAttribute('aria-selected', n === index ? 'true' : 'false');
    });
    setCaption(items[index]);
    var activeImg = slides[index] && slides[index].querySelector('img');
    if (activeImg) applySlideBackdrop(activeImg);
    restartAuto();
  }

  function restartAuto() {
    if (timer) clearInterval(timer);
    if (items.length < 2) return;
    timer = setInterval(function () {
      showSlide(index + 1);
    }, AUTO_MS);
  }

  function buildSlides(list) {
    items = list.filter(function (item) { return item && item.image; });
    track.innerHTML = '';
    dotsEl.innerHTML = '';

    items.forEach(function (item, n) {
      var slide = document.createElement('figure');
      slide.className = 'mission-gallery-slide';
      slide.hidden = n !== 0;
      if (n === 0) slide.classList.add('is-active');

      var img = document.createElement('img');
      img.src = imageUrl(item.image);
      img.alt = item.caption || item.topic || ('Mission figure ' + (n + 1));
      img.loading = n === 0 ? 'eager' : 'lazy';
      img.decoding = 'async';
      if (item.width && item.height) {
        img.width = item.width;
        img.height = item.height;
      }
      bindImageBackdrop(img);
      slide.appendChild(img);
      track.appendChild(slide);

      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'mission-gallery-dot' + (n === 0 ? ' is-active' : '');
      dot.setAttribute('aria-label', 'Show image ' + (n + 1));
      dot.setAttribute('aria-selected', n === 0 ? 'true' : 'false');
      dot.addEventListener('click', function () { showSlide(n); });
      dotsEl.appendChild(dot);
    });

    if (items.length) {
      showSlide(0);
    } else {
      setCaption({ topic: '', caption: 'Gallery images will appear here after running build-mission-gallery.bat.' });
    }
  }

  function bindNav() {
    if (prevBtn) prevBtn.addEventListener('click', function () { showSlide(index - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { showSlide(index + 1); });
    root.addEventListener('pointerenter', function () {
      if (timer) clearInterval(timer);
    });
    root.addEventListener('pointerleave', restartAuto);
  }

  function loadGallery() {
    fetch(GALLERY_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('gallery fetch failed');
        return res.json();
      })
      .then(function (data) {
        galleryVersion = data.version || '';
        buildSlides(data.items || []);
      })
      .catch(function () {
        buildSlides(FALLBACK_ITEMS);
      });
  }

  bindNav();
  window.addEventListener('rtl3d:viewport-resize', refreshSlideBackdrops);
  if (viewport && window.ResizeObserver) {
    new ResizeObserver(refreshSlideBackdrops).observe(viewport);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGallery);
  } else {
    loadGallery();
  }
})();
