(function () {
  'use strict';

  if (document.body.dataset.page !== 'social') return;

  var FEED_URL = 'data/social/feed.json';

  var FALLBACK_FEED = {
    facebook: [
      { date: 'Mar 2026', text: 'SATREPS RTL3D field season underway — LF network sites checked and calibrated ahead of the monsoon lightning campaign.', image: 'images/gallery/workshop.jpg' },
      { date: 'Feb 2026', text: 'Malaysia–Japan research team at UNITEN. Real-time 3D lightning imaging brings observation, modelling, and public safety together.', image: 'images/gallery/team-group.jpg' },
      { date: 'Jan 2026', text: 'CG lightning source reconstruction from the Peninsular network — height–time structure resolved in the cloud band.', image: 'images/gallery/lightning-strike.png' },
      { date: 'Nov 2025', text: 'Memorandum of understanding signed with industry partners to extend lightning risk mapping for grid infrastructure.', image: 'images/gallery/mou-signing.jpg' },
      { date: 'Oct 2025', text: 'Research update presented to Japanese collaborators — progress on 3D charge imaging and multi-sensor fusion.', image: 'images/gallery/jp-presentation.jpg' },
      { date: 'Sep 2025', text: 'Panel discussion on lightning early warning for energy utilities, aviation, and disaster management agencies.', image: 'images/gallery/panel.jpg' },
      { date: 'Aug 2025', text: 'Workshop with stakeholders on translating RTL3D forecasts into operational public-safety guidance.', image: 'images/gallery/discussion.jpg' }
    ],
    instagram: [
      { date: 'Mar 2026', text: 'Monsoon watch ⚡ LF sensors online across the study area.', image: 'images/gallery/lightning-strike.png' },
      { date: 'Feb 2026', text: 'On site with the RTL3D observation team — calibration day at the network hub.', image: 'images/gallery/two-researchers.jpg' },
      { date: 'Feb 2026', text: 'Sharing latest results on 3D charge structure and radiation zones with project partners.', image: 'images/gallery/presentation-lady.jpg' },
      { date: 'Jan 2026', text: 'Science–policy dialogue: from flash detection to actionable warnings.', image: 'images/gallery/presentation-lady2.jpg' },
      { date: 'Nov 2025', text: 'Partnership milestone 🤝 strengthening links between research and industry.', image: 'images/gallery/mou-signing.jpg' },
      { date: 'Oct 2025', text: 'Japan–Malaysia collaboration session — SATREPS RTL3D progress review.', image: 'images/gallery/jp-presentation.jpg' },
      { date: 'Sep 2025', text: 'Team photo from the annual project meeting — thank you to all observers and engineers.', image: 'images/gallery/team-group2.jpg' },
      { date: 'Aug 2025', text: 'Field training workshop for graduate researchers joining the lightning network.', image: 'images/gallery/workshop.jpg' }
    ]
  };

  var PAGE_META = {
    facebook: { name: 'RTL3D', handle: 'facebook.com/rtl3d' },
    instagram: { name: 'satreps_rtl3d', handle: 'instagram.com/satreps_rtl3d' }
  };

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildCard(post, platform) {
    var meta = PAGE_META[platform];
    var card = document.createElement('article');
    card.className = 'social-feed-card social-feed-card--' + platform;

    var head = document.createElement('header');
    head.className = 'social-feed-card-head';
    head.innerHTML =
      '<span class="social-feed-card-avatar" aria-hidden="true"></span>' +
      '<span class="social-feed-card-meta">' +
        '<span class="social-feed-card-name">' + escapeHtml(meta.name) + '</span>' +
        '<span class="social-feed-card-date">' + escapeHtml(post.date || '') + '</span>' +
      '</span>';

    card.appendChild(head);

    if (post.image) {
      var figure = document.createElement('figure');
      figure.className = 'social-feed-card-media';
      var img = document.createElement('img');
      img.src = post.image;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      figure.appendChild(img);
      card.appendChild(figure);
    }

    if (post.text) {
      var body = document.createElement('p');
      body.className = 'social-feed-card-text';
      body.textContent = post.text;
      card.appendChild(body);
    }

    return card;
  }

  function renderFeed(platform, posts, container) {
    if (!container || !Array.isArray(posts)) return;
    container.innerHTML = '';
    posts.forEach(function (post) {
      container.appendChild(buildCard(post, platform));
    });
    document.dispatchEvent(new CustomEvent('rtl3d:social-feed-rendered', { detail: { platform: platform } }));
  }

  function loadFeed() {
    var fbList = document.querySelector('[data-social-feed="facebook"]');
    var igList = document.querySelector('[data-social-feed="instagram"]');
    if (!fbList && !igList) return;

    fetch(FEED_URL, { cache: 'no-cache' })
      .then(function (res) {
        if (!res.ok) throw new Error('feed fetch failed');
        return res.json();
      })
      .then(function (data) {
        renderFeed('facebook', data.facebook, fbList);
        renderFeed('instagram', data.instagram, igList);
      })
      .catch(function () {
        renderFeed('facebook', FALLBACK_FEED.facebook, fbList);
        renderFeed('instagram', FALLBACK_FEED.instagram, igList);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFeed);
  } else {
    loadFeed();
  }
})();
