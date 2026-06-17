(function () {
  'use strict';

  if (document.body.dataset.page !== 'home') return;

  const hub = document.querySelector('.hero.hub');
  if (!hub) return;

  const cinemaPanel = hub.querySelector('.hub-cinema-panel');
  const title = hub.querySelector('.hub-title');

  function flashLightning() {
    if (typeof window.RTL3DLightningBg?.flash === 'function') {
      window.RTL3DLightningBg.flash();
    }
  }

  if (title) {
    title.classList.add('is-revealed');
    title.querySelectorAll('.line').forEach((line, i) => {
      line.style.animationDelay = `${0.18 + i * 0.14}s`;
    });
    window.setTimeout(flashLightning, 480);
  }

  if (cinemaPanel) {
    hub.addEventListener('mousemove', (e) => {
      const rect = hub.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      cinemaPanel.style.transform =
        `perspective(900px) rotateX(${y * -2.2}deg) rotateY(${x * 2.8}deg)`;
    });

    hub.addEventListener('mouseleave', () => {
      cinemaPanel.style.transform = '';
    });
  }

  const hook = hub.querySelector('.hub-hook');
  if (hook) {
    const phrases = [
      'Where does the next strike land?',
      'What is hidden inside the thundercloud?',
      'Can we warn the grid before the flash?',
    ];
    let idx = 0;
    hook.classList.add('is-ready');
    const hookInterval = window.setInterval(() => {
      idx = (idx + 1) % phrases.length;
      hook.classList.remove('is-ready');
      flashLightning();
      window.requestAnimationFrame(() => {
        hook.textContent = phrases[idx];
        hook.classList.add('is-ready');
      });
    }, 4500);
    window.addEventListener('pagehide', () => window.clearInterval(hookInterval), { once: true });
  }
})();
