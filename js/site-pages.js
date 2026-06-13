(function () {
  'use strict';

  window.RTL3D_PAGES = [
    { id: 'home', file: 'index.html', title: 'Home', icon: '🏠' },
    { id: 'mission', file: 'our-mission.html', title: 'Our Mission', icon: '🎯' },
    { id: 'framework', file: 'research-framework.html', title: 'Research Framework', icon: '📊' },
    { id: 'network', file: 'observation-network.html', title: 'Observation Network', icon: '📡' },
    { id: 'imaging', file: 'charge-imaging.html', title: '3D Charge Imaging', icon: '🧊' },
    { id: 'impact', file: 'social-impact.html', title: 'Social Impact', icon: '⚡' },
    { id: 'study-area', file: 'study-area.html', title: 'Study Area Map', icon: '🗺️' },
    { id: 'partners', file: 'partners.html', title: 'Partners', icon: '🤝' },
    { id: 'contact', file: 'contact.html', title: 'Contact', icon: '📬' },
  ];

  window.RTL3D_EXTRA = [
    { id: 'lf', file: 'lf.html', title: 'LF Network', parent: 'network' },
    { id: 'tnb', file: 'tnb-power.html', title: 'TNB Power Supply', parent: 'impact' },
    { id: 'did-met', file: 'did-met-alert.html', title: 'DID & MET Early Warning', parent: 'impact' },
    { id: 'public-safety', file: 'public-safety.html', title: 'Public Safety — Aviation & Maritime', parent: 'impact' },
    { id: 'public-safety-industry', file: 'public-safety-industry.html', title: 'Public Safety — Industry & Tourism', parent: 'impact' },
  ];
})();
