(function () {
  'use strict';

  window.RTL3D_PAGES = [
    { id: 'home', slug: '', title: 'Home', icon: '🏠' },
    { id: 'mission', slug: 'our-mission', title: 'Our Mission', icon: '🎯', desc: 'Vision, goals & societal impact' },
    { id: 'framework', slug: 'research-framework', title: 'Research Framework', icon: '📊', desc: 'Methods & technical approach' },
    { id: 'network', slug: 'observation-network', title: 'Observation Network', icon: '📡', desc: 'LF, VHF & multi-site layout' },
    { id: 'imaging', slug: 'charge-imaging', title: '3D Charge Imaging', icon: '🧊', desc: 'Thundercloud charge structure' },
    { id: 'impact', slug: 'social-impact', title: 'Social Impact', icon: '⚡', desc: 'Energy, warning & public safety' },
    { id: 'study-area', slug: 'study-area', title: 'Study Area Map', icon: '🗺️', desc: 'Interactive site map' },
    { id: 'partners', slug: 'partners', title: 'Partners', icon: '🤝', desc: 'Malaysia–Japan collaboration' },
    { id: 'contact', slug: 'contact', title: 'Contact', icon: '📬', desc: 'Connect with the team' },
  ];

  window.RTL3D_EXTRA = [
    { id: 'lf', slug: 'lf', title: 'LF Network', parent: 'network' },
    { id: 'vhf', slug: 'vhf', title: 'VHF Network', parent: 'network' },
    { id: 'efield', slug: 'electric-field', title: 'Electric Field', parent: 'network' },
    { id: 'gamma', slug: 'gamma-radon', title: 'Gamma-ray & Radon', parent: 'network' },
    { id: 'hsv', slug: 'high-speed-video', title: 'High-Speed Video', parent: 'network' },
    { id: 'tnb', slug: 'tnb-power', title: 'TNB Power Supply', parent: 'impact' },
    { id: 'did-met', slug: 'did-met-alert', title: 'DID & MET Early Warning', parent: 'impact' },
    { id: 'public-safety', slug: 'public-safety', title: 'Public Safety — Aviation & Maritime', parent: 'impact' },
    { id: 'public-safety-industry', slug: 'public-safety-industry', title: 'Public Safety — Industry & Tourism', parent: 'impact' },
  ];

  window.RTL3D_INTERACTIVE = [
    { id: 'tnb', slug: 'tnb-power', title: 'TNB Grid Risk Map', desc: 'Flashes × power lines in real time', icon: '⚡', theme: 'power' },
    { id: 'study-area', slug: 'study-area', title: 'Study Area Map', desc: 'Observation network sites', icon: '🗺️', theme: 'map' },
    { id: 'lf', slug: 'lf', title: 'LF Network', desc: 'Animate a flash in 3D space', icon: '📡', theme: 'lf' },
    { id: 'did-met', slug: 'did-met-alert', title: 'DID & MET Early Warning', desc: 'Rainfall nowcasting & alerts', icon: '🛡️', theme: 'did-met' },
    { id: 'public-safety', slug: 'public-safety', title: 'Aviation & Maritime', desc: 'Airports, routes & lightning risk', icon: '✈️', theme: 'safety' },
    { id: 'public-safety-industry', slug: 'public-safety-industry', title: 'Industry & Tourism', desc: 'Open-venue lightning radar', icon: '🏭', theme: 'industry' },
  ];

  const urlFn = window.RTL3D_URL?.page || function (slug) {
    if (!slug) return './';
    return slug + '/';
  };

  [window.RTL3D_PAGES, window.RTL3D_EXTRA, window.RTL3D_INTERACTIVE].forEach(function (list) {
    list.forEach(function (entry) {
      entry.file = urlFn(entry.slug);
    });
  });
})();
