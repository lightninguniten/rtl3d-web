(function () {
  'use strict';

  var modal = document.getElementById('efield-guide-modal');
  if (!modal) return;

  var slides = modal.querySelectorAll('.efield-carousel-slide');
  var dots = modal.querySelectorAll('.efield-carousel-dot');
  var titleEl = modal.querySelector('#efield-carousel-title');
  var counterEl = modal.querySelector('#efield-carousel-counter');
  var prevBtn = modal.querySelector('[data-efield-prev]');
  var nextBtn = modal.querySelector('[data-efield-next]');
  var openBtn = document.getElementById('efield-open-guide');
  var previewBtns = document.querySelectorAll('[data-efield-slide]');
  var current = 0;
  var titles = [];

  var titleKeys = [];
  slides.forEach(function (slide, i) {
    titleKeys[i] = slide.getAttribute('data-title-key') || '';
    titles[i] = slide.getAttribute('data-title') || ('Step ' + (i + 1));
  });

  function slideTitle(i) {
    if (titleKeys[i] && window.RTL3Di18n) {
      var v = window.RTL3Di18n.t(titleKeys[i]);
      if (v != null) return v;
    }
    return titles[i];
  }

  function setSlide(index) {
    if (!slides.length) return;
    current = (index + slides.length) % slides.length;
    slides.forEach(function (slide, i) {
      slide.classList.toggle('is-active', i === current);
      slide.hidden = i !== current;
    });
    dots.forEach(function (dot, i) {
      dot.classList.toggle('is-active', i === current);
      dot.setAttribute('aria-selected', i === current ? 'true' : 'false');
    });
    if (titleEl) titleEl.textContent = slideTitle(current);
    if (counterEl) counterEl.textContent = (current + 1) + ' / ' + slides.length;
    if (prevBtn) prevBtn.disabled = slides.length <= 1;
    if (nextBtn) nextBtn.disabled = slides.length <= 1;
  }

  function openModal(index) {
    setSlide(typeof index === 'number' ? index : 0);
    modal.hidden = false;
    requestAnimationFrame(function () {
      modal.classList.add('open');
    });
    document.body.classList.add('modal-open');
    modal.querySelector('.efield-guide-close')?.focus();
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.hidden = true;
    document.body.classList.remove('modal-open');
  }

  function step(delta) {
    setSlide(current + delta);
  }

  prevBtn?.addEventListener('click', function () { step(-1); });
  nextBtn?.addEventListener('click', function () { step(1); });
  openBtn?.addEventListener('click', function () { openModal(0); });

  previewBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var idx = parseInt(btn.getAttribute('data-efield-slide'), 10);
      openModal(isNaN(idx) ? 0 : idx);
    });
  });

  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () { setSlide(i); });
  });

  modal.querySelectorAll('[data-efield-close]').forEach(function (el) {
    el.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') closeModal();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  setSlide(0);

  // Refresh the modal title when the language changes (the carousel title is
  // set from JS, so the engine's DOM pass won't catch it).
  document.addEventListener('rtl3d:langchange', function () {
    if (titleEl) titleEl.textContent = slideTitle(current);
  });
})();
