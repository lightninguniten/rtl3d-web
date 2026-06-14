(function () {
  'use strict';

  window.RTL3D_PAGES = [
    { id: 'home', file: 'index.html', title: 'Home', icon: '🏠' },
    { id: 'mission', file: 'our-mission.html', title: 'Our Mission', icon: '🎯', desc: 'Vision, goals & societal impact' },
    { id: 'framework', file: 'research-framework.html', title: 'Research Framework', icon: '📊', desc: 'Methods & technical approach' },
    { id: 'network', file: 'observation-network.html', title: 'Observation Network', icon: '📡', desc: 'LF, VHF & multi-site layout' },
    { id: 'imaging', file: 'charge-imaging.html', title: '3D Charge Imaging', icon: '🧊', desc: 'Thundercloud charge structure' },
    { id: 'impact', file: 'social-impact.html', title: 'Social Impact', icon: '⚡', desc: 'Energy, warning & public safety' },
    { id: 'study-area', file: 'study-area.html', title: 'Study Area Map', icon: '🗺️', desc: 'Interactive site map' },
    { id: 'partners', file: 'partners.html', title: 'Partners', icon: '🤝', desc: 'Malaysia–Japan collaboration' },
    { id: 'contact', file: 'contact.html', title: 'Contact', icon: '📬', desc: 'Connect with the team' },
  ];

  window.RTL3D_EXTRA = [
    { id: 'lf', file: 'lf.html', title: 'LF Network', parent: 'network' },
    { id: 'tnb', file: 'tnb-power.html', title: 'TNB Power Supply', parent: 'impact' },
    { id: 'did-met', file: 'did-met-alert.html', title: 'DID & MET Early Warning', parent: 'impact' },
    { id: 'public-safety', file: 'public-safety.html', title: 'Public Safety — Aviation & Maritime', parent: 'impact' },
    { id: 'public-safety-industry', file: 'public-safety-industry.html', title: 'Public Safety — Industry & Tourism', parent: 'impact' },
  ];

  window.RTL3D_INTERACTIVE = [
    { id: 'tnb', file: 'tnb-power.html', title: 'TNB Grid Risk Map', desc: 'Flashes × power lines in real time', icon: '⚡', theme: 'power' },
    { id: 'study-area', file: 'study-area.html', title: 'Study Area Map', desc: 'Observation network sites', icon: '🗺️', theme: 'map' },
    { id: 'lf', file: 'lf.html', title: 'LF Network', desc: 'Animate a flash in 3D space', icon: '📡', theme: 'lf' },
    { id: 'did-met', file: 'did-met-alert.html', title: 'DID & MET Early Warning', desc: 'Rainfall nowcasting & alerts', icon: '🛡️', theme: 'did-met' },
    { id: 'public-safety', file: 'public-safety.html', title: 'Aviation & Maritime', desc: 'Airports, routes & lightning risk', icon: '✈️', theme: 'safety' },
    { id: 'public-safety-industry', file: 'public-safety-industry.html', title: 'Industry & Tourism', desc: 'Open-venue lightning radar', icon: '🏭', theme: 'industry' },
  ];
})();
