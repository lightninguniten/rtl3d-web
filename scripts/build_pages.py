"""RTL3D page templates (reference only).

Live HTML is under {slug}/index.html with root *.html redirect stubs.
Do not run this script — it would overwrite redirect stubs with flat pages.
Edit slug/index.html files directly, or refactor this module before regenerating.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE_BASE = "https://lightninguniten.github.io/rtl3d-web"

SEO_META = """  <meta name="robots" content="index, follow">
  <link rel="canonical" href="{canonical}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="RTL3D">
  <meta property="og:title" content="{og_title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:locale" content="en_US">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{og_title}">
  <meta name="twitter:description" content="{desc}">"""

HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.88em' x='.12em' font-size='82'%3E⚡%3C/text%3E%3C/svg%3E">
  <meta name="description" content="{desc}">
{seo_meta}
  <title>{page_title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
{extra_head}
</head>
<body data-page="{page_id}">
  <div class="viewport-shell">
    <header class="top-bar">
      <div class="top-left">
        <a id="back-btn" class="btn-icon btn-nav" href="#" title="Back" aria-label="Previous page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          <span class="btn-label">Back</span>
        </a>
        <a id="home-btn" href="./" class="btn-icon btn-nav" title="Home" aria-label="Home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
          <span class="btn-label">Home</span>
        </a>
        <div class="brand">
          <span class="brand-icon">⚡</span>
          <span class="brand-text">{brand}</span>
        </div>
      </div>
      <div class="top-actions">
        <button type="button" class="btn-icon" data-fb-qr title="Facebook" aria-label="Show Facebook QR code">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        </button>
      </div>
    </header>
    <div class="viewport-frame" id="viewport-frame">
      <div class="viewport-169" id="viewport-169">
        <div class="lightning-bg" aria-hidden="true">
          <canvas id="lightning-canvas"></canvas>
          <div class="grid-overlay"></div>
        </div>
        <main class="page-view">
{content}
        </main>
      </div>
    </div>
  </div>
{extra_scripts}
  <script src="js/site-urls.js"></script>
  <script src="js/site-pages.js"></script>
  <script src="js/qrcode.min.js"></script>
  <script src="js/facebook-qr.js"></script>
  <script src="js/drag-scroll.js"></script>
  <script src="js/viewport.js"></script>
  <script src="js/page-visits.js"></script>
  <script src="js/page-common.js"></script>
{extra_page_scripts}
</body>
</html>
"""

HOME = """
          <div class="slide-inner hero hub">
            <div class="hub-spotlight" aria-hidden="true">
              <span class="hub-mesh"></span>
              <span class="hub-aurora"></span>
              <span class="hub-spotlight-orb hub-spotlight-orb-a"></span>
              <span class="hub-spotlight-orb hub-spotlight-orb-b"></span>
              <span class="hub-spotlight-orb hub-spotlight-orb-c"></span>
              <span class="hub-radar-ring"></span>
              <span class="hub-radar-ring hub-radar-ring-delay"></span>
              <span class="hub-scanbeam"></span>
            </div>
            <div class="hub-vignette" aria-hidden="true"></div>
            <div class="hub-film-grain" aria-hidden="true"></div>
            <div class="partner-logos mobile-snap" aria-label="Partner universities">
              <button type="button" class="partner-logo" data-partner-qr data-qr-url="https://www.uniten.edu.my/" data-qr-title="UNITEN — Universiti Tenaga Nasional" data-qr-label="uniten.edu.my" aria-label="Show UNITEN website QR code">
                <img src="images/logos/uniten.png" alt="" width="160" height="113" loading="eager">
              </button>
              <button type="button" class="partner-logo" data-partner-qr data-qr-url="https://www.utem.edu.my/" data-qr-title="UTeM — Universiti Teknikal Malaysia Melaka" data-qr-label="utem.edu.my" aria-label="Show UTeM website QR code">
                <img src="images/logos/utem.jpg" alt="" width="160" height="93" loading="eager">
              </button>
              <button type="button" class="partner-logo" data-partner-qr data-qr-url="https://www.kindai.ac.jp/english/" data-qr-title="Kindai University" data-qr-label="kindai.ac.jp" aria-label="Show Kindai University website QR code">
                <img src="images/logos/kindai.svg" alt="" width="200" height="53" loading="eager">
              </button>
            </div>
            <div class="hub-cinema mobile-snap mobile-snap-intro">
              <div class="hub-hero-panel liquid-glass hub-cinema-panel">
                <div class="hero-badge hub-badge-glow">SATREPS · Malaysia–Japan Joint Research</div>
                <p class="hub-hook is-ready">Where does the next strike land?</p>
                <h1 class="hero-title hub-title" id="hub-title">
                  <span class="line">Real-Time Lightning</span>
                  <span class="line accent hub-shimmer">3D Imaging &amp; Forecasting</span>
                </h1>
                <p class="hero-sub hub-tagline hub-intro-lead">Peel back the thundercloud — watch charge build, flashes propagate, and risk close in on the grid before the storm arrives.</p>
                <div class="hero-stats hub-stats" aria-label="Project highlights">
                  <div class="stat">
                    <span class="stat-num">3D</span>
                    <span class="stat-label">Live imaging</span>
                  </div>
                  <div class="stat">
                    <span class="stat-num">MY–JP</span>
                    <span class="stat-label">SATREPS</span>
                  </div>
                  <div class="stat">
                    <span class="stat-num">15+</span>
                    <span class="stat-label">Sensor sites</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="hub-lower">
              <div class="hub-featured mobile-snap" aria-label="Featured interactive tools">
                <p class="hub-section-label"><span class="hub-live-dot" aria-hidden="true"></span> Interactive previews</p>
                <div class="hub-featured-roulette" id="hub-featured-roulette">
                  <div class="hub-featured-viewport" id="hub-featured-viewport">
                    <div class="hub-featured-track" id="hub-featured-track" aria-live="polite"></div>
                  </div>
                </div>
              </div>
              <div class="hub-nav-wrap mobile-snap">
                <p class="hub-section-label">Explore the research</p>
                <nav id="section-nav" class="section-nav hub-bento" aria-label="Jump to section"></nav>
              </div>
            </div>
          </div>
"""

MISSION = """
          <div class="slide-inner split">
            <div class="split-text">
              <span class="section-tag">Our Mission</span>
              <h2>Seeing lightning in three dimensions — in real time</h2>
              <p>For lightning activity in the Straits of Malacca, a <strong>3D lightning observation network</strong> reveals where a discharge initiates, how it progresses, and where it terminates.</p>
              <p>Real-time estimation of <strong>charge distribution</strong> inside thunderclouds and <strong>nowcasting</strong> information is delivered to relevant institutions — contributing to stable electric power supply and early warning for severe weather disasters.</p>
              <div class="pill-row">
                <span class="pill">Energy Security</span>
                <span class="pill">Disaster Risk Reduction</span>
                <span class="pill">Science Diplomacy</span>
              </div>
            </div>
            <div class="split-visual">
              <div class="cloud-viz">
                <div class="cloud-layer"></div>
                <div class="charge positive"></div>
                <div class="charge negative"></div>
                <svg class="flash-path" viewBox="0 0 200 300">
                  <path d="M100 20 L120 100 L95 100 L130 200 L105 200 L115 280" fill="none" stroke="url(#flashGrad)" stroke-width="3"/>
                  <defs>
                    <linearGradient id="flashGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="#60a5fa"/>
                      <stop offset="100%" stop-color="#fbbf24"/>
                    </linearGradient>
                  </defs>
                </svg>
                <div class="viz-label top">Charge distribution</div>
                <div class="viz-label bottom">Lightning channel</div>
              </div>
            </div>
          </div>
"""

FRAMEWORK = """
          <div class="slide-inner">
            <span class="section-tag center">Research Framework</span>
            <h2 class="center-title">Three pillars of inquiry</h2>
            <div class="cards three">
              <article class="card">
                <div class="card-num">01</div>
                <h3>What kind of lightning?</h3>
                <p>High-resolution observation of lightning channel development through electromagnetic measurement across multiple frequency bands.</p>
                <ul>
                  <li>LF network — channel imaging &gt;100 km</li>
                  <li>VHF network — leader development</li>
                  <li>E-field, γ-ray &amp; video sensors</li>
                </ul>
              </article>
              <article class="card featured">
                <div class="card-num">02</div>
                <h3>What kind of thundercloud?</h3>
                <p>Real-time 3D imaging and estimation of charge distribution inside thunderclouds — location and quantity of charge.</p>
                <ul>
                  <li>500 m spatial resolution in 5 min</li>
                  <li>0.01 C charge resolution</li>
                  <li>Validated via RTL experiments</li>
                </ul>
              </article>
              <article class="card">
                <div class="card-num">03</div>
                <h3>What will happen next?</h3>
                <p>Short-time forecasting of cloud-to-ground (CG) lightning and correlation between lightning activity and heavy rainfall.</p>
                <ul>
                  <li>CG forecast: 50% hit rate, 5 min lead</li>
                  <li>Heavy rain (&gt;50 mm/h) alert: 15 min</li>
                  <li>IoT lightning protection systems</li>
                </ul>
              </article>
            </div>
          </div>
"""

NETWORK = """
          <div class="slide-inner">
            <span class="section-tag center">Output 1</span>
            <h2 class="center-title">Lightning observation network</h2>
            <div class="network-grid">
              <a href="lf/" class="net-item net-item-clickable" aria-label="Open Low Frequency network details">
                <div class="net-icon lf">LF</div>
                <h4>Low Frequency</h4>
                <p class="net-count">&gt;9 stations</p>
                <p>Lightning channel imaging over <strong>&gt;120 km</strong> coverage. 100 m resolution in 1 minute.</p>
                <span class="net-tap-hint">Tap for details →</span>
              </a>
              <div class="net-item">
                <div class="net-icon vhf">VHF</div>
                <h4>Very High Frequency</h4>
                <p class="net-count">&gt;6 stations</p>
                <p>Leader development imaging across tens of kilometers with high temporal resolution.</p>
              </div>
              <a href="gamma-radon/" class="net-item net-item-clickable" aria-label="Open Gamma-ray and Radon network details">
                <div class="net-icon gamma">γ</div>
                <h4>Gamma-ray &amp; Radon</h4>
                <p class="net-count">3 monitors</p>
                <p>High-energy radiation observation linked to thunderstorm electrification.</p>
                <span class="net-tap-hint">Tap for details →</span>
              </a>
              <a href="electric-field/" class="net-item net-item-clickable" aria-label="Open Electric Field network details">
                <div class="net-icon efield">E</div>
                <h4>Electric Field</h4>
                <p class="net-count">5 sensor sets</p>
                <p>Near-field measurements supporting charge estimation and validation.</p>
                <span class="net-tap-hint">Tap for details →</span>
              </a>
              <div class="net-item">
                <div class="net-icon video">▶</div>
                <h4>High-Speed Video</h4>
                <p class="net-count">2 cameras</p>
                <p>Visual confirmation of lightning channel structure and development.</p>
              </div>
              <div class="net-item">
                <div class="net-icon rtl">🚀</div>
                <h4>Rocket-Triggered Lightning</h4>
                <p class="net-count">40 events</p>
                <p>Controlled experiments in Japan (2023–) and Malaysia (2025–) for model validation.</p>
              </div>
            </div>
          </div>
"""

IMAGING = """
          <div class="slide-inner split">
            <div class="split-text">
              <span class="section-tag">Output 2</span>
              <h2>Real-time 3D charge imaging</h2>
              <p>Hundreds of times more lightning information compared to conventional 2D detection — mapped in full three dimensions.</p>
              <div class="metric-list">
                <div class="metric">
                  <span class="metric-val">500 m</span>
                  <span class="metric-desc">Spatial resolution (5 min update)</span>
                </div>
                <div class="metric">
                  <span class="metric-val">0.01 C</span>
                  <span class="metric-desc">Charge quantity resolution</span>
                </div>
                <div class="metric">
                  <span class="metric-val">100 m</span>
                  <span class="metric-desc">Channel resolution (1 min update)</span>
                </div>
              </div>
              <p class="note">3D leader channels and charge distribution serve as <em>immediate predictive information</em> for upcoming lightning and thunderstorm activity.</p>
            </div>
            <div class="split-visual">
              <div class="cube-scene">
                <div class="cube">
                  <div class="cube-face front"></div>
                  <div class="cube-face back"></div>
                  <div class="cube-face right"></div>
                  <div class="cube-face left"></div>
                  <div class="cube-face top"></div>
                  <div class="cube-face bottom"></div>
                </div>
                <div class="charge-points">
                  <span style="--x:20%;--y:30%;--z:40%;--c:positive">+2.0 C</span>
                  <span style="--x:60%;--y:25%;--z:55%;--c:negative">−1.1 C</span>
                  <span style="--x:45%;--y:55%;--z:35%;--c:positive">+0.6 C</span>
                  <span style="--x:75%;--y:45%;--z:60%;--c:negative">−0.5 C</span>
                  <span style="--x:30%;--y:70%;--z:50%;--c:positive">+0.1 C</span>
                </div>
                <p class="cube-caption">Integrated 3D charge distribution</p>
              </div>
            </div>
          </div>
"""

IMPACT = """
          <div class="slide-inner">
            <span class="section-tag center">Output 3</span>
            <h2 class="center-title">From observation to social impact</h2>
            <div class="flow">
              <div class="flow-step">
                <div class="flow-icon">📡</div>
                <h4>Observe</h4>
                <p>Multi-sensor network captures lightning channels and cloud charge in real time</p>
              </div>
              <div class="flow-arrow">→</div>
              <div class="flow-step">
                <div class="flow-icon">🧊</div>
                <h4>Image</h4>
                <p>3D charge distribution reconstructed — positive &amp; negative density mapped</p>
              </div>
              <div class="flow-arrow">→</div>
              <div class="flow-step highlight">
                <div class="flow-icon">⚡</div>
                <h4>Forecast</h4>
                <p>Real-time 3D imaging ≈ CG lightning forecast. 50% hit rate, 5 min lead time</p>
              </div>
              <div class="flow-arrow">→</div>
              <div class="flow-step">
                <div class="flow-icon">🛡️</div>
                <h4>Protect</h4>
                <p>Alert systems, IoT countermeasures, workshops for TNB &amp; MET</p>
              </div>
            </div>
            <div class="impact-row">
              <a href="did-met-alert/" class="impact impact-clickable impact-did-met" aria-label="Open DID and MET early warning map">
                <span class="impact-click-top">
                  <span class="impact-click-icon" aria-hidden="true">🛡️</span>
                  <span class="impact-click-body"><strong>DID &amp; MET</strong> — Early warning &amp; alert systems</span>
                </span>
                <span class="impact-hint">Click to view map →</span>
              </a>
              <a href="tnb-power/" class="impact impact-clickable impact-tnb" aria-label="Open TNB power supply map">
                <span class="impact-click-top">
                  <span class="impact-click-icon" aria-hidden="true">⚡</span>
                  <span class="impact-click-body"><strong>TNB</strong> — Stable electric power supply</span>
                </span>
                <span class="impact-hint">Click to view map →</span>
              </a>
              <a href="public-safety/" class="impact impact-clickable impact-public-safety" aria-label="Open aviation and maritime public safety map">
                <span class="impact-click-top">
                  <span class="impact-click-icon" aria-hidden="true">✈️</span>
                  <span class="impact-click-body"><strong>Public safety</strong> — Aviation &amp; maritime</span>
                </span>
                <span class="impact-hint">Click to view map →</span>
              </a>
              <a href="public-safety-industry/" class="impact impact-clickable impact-public-safety-industry" aria-label="Open industry and tourism lightning radar">
                <span class="impact-click-top">
                  <span class="impact-click-icon" aria-hidden="true">🏭</span>
                  <span class="impact-click-body"><strong>Public safety</strong> — Industry &amp; tourism</span>
                </span>
                <span class="impact-hint">Click to view nowcast →</span>
              </a>
            </div>
          </div>
"""

STUDY = """
          <div class="slide-inner split study-area-page">
            <div class="split-text">
              <span class="section-tag">Study Area</span>
              <h2>Observation sites across Malacca</h2>
              <p>A distributed network spanning the Straits of Malacca region, with stations operated by UTeM and UNITEN teams.</p>
              <ul class="site-list">
                <li><span class="dot lf-vhf"></span> UNITEN Putrajaya Campus</li>
                <li><span class="dot lf-vhf"></span> DID Batu Dam &amp; Padang Jawa</li>
                <li><span class="dot lf"></span> MET Kuala Pilah</li>
                <li><span class="dot lf-vhf"></span> UTeM Malacca &amp; Falak Astronomy</li>
                <li><span class="dot lf-vhf"></span> UiTM Jasin Campus</li>
                <li><span class="dot lf-vhf"></span> Pulau Besar</li>
                <li><span class="dot lf"></span> Kolej UNITI, Port Dickson</li>
              </ul>
            </div>
            <div class="split-visual map-wrap">
              <div id="study-area-map" class="study-area-map" data-osm-sites-map role="img" aria-label="OpenStreetMap showing LF observation sites"></div>
              <div class="map-legend">
                <span><i class="leg lf-vhf"></i> LF + VHF</span>
                <span><i class="leg lf"></i> LF only</span>
                <span><i class="leg ring"></i> &gt;120 km coverage</span>
              </div>
            </div>
          </div>
"""

PARTNERS = """
          <div class="slide-inner">
            <span class="section-tag center">Collaboration</span>
            <h2 class="center-title">International research partnership</h2>
            <div class="acknowledgement-block">
              <h3 class="acknowledgement-title">Acknowledgements</h3>
              <p class="satreps-note">This research work is supported by <strong>SATREPS Real-Time Lightning 3D Imaging and Forecasting Project for Sustainable and Reliable Supply of Energy and Storm Disaster Early Warning</strong> (20230901JICA, 20230902JICA, 20230903JICA, 20230904JICA, 20230905JICA), a collaboration between Japan Science and Technology Agency (<strong>JST</strong>, JPMJSA2210), Japan International Cooperation Agency (<strong>JICA</strong>), and the Ministry of Higher Education (<strong>MOHE</strong>) of Malaysia.</p>
            </div>
            <div class="partners">
              <div class="partner-col">
                <h4>🇯🇵 Japan</h4>
                <ul>
                  <li>Kindai University <small>Imaging, RTL, VHF/LF</small></li>
                  <li>Chubu University <small>Current measurement, RTL</small></li>
                  <li>University of Fukui <small>γ-ray observation</small></li>
                  <li>Gifu University <small>LF, video, imaging</small></li>
                  <li>UEC Tokyo <small>VHF, imaging</small></li>
                  <li>OTOWA Electric <small>E-field, protection</small></li>
                </ul>
              </div>
              <div class="partner-col">
                <h4>🇲🇾 Malaysia</h4>
                <ul>
                  <li>UTeM <small>LF, VHF, imaging, RTL</small></li>
                  <li>UNITEN <small>VHF, γ-ray, current, RTL</small></li>
                  <li>TNB <small>Energy sector user</small></li>
                  <li>DID &amp; MET <small>Early warning</small></li>
                </ul>
              </div>
              <div class="partner-col leads">
                <h4>Lead Researchers</h4>
                <ul class="lead-list">
                  <li>T. Morimoto <small>Kindai Univ.</small></li>
                  <li>K. Yamamoto <small>Chubu Univ.</small></li>
                  <li>T. Kudo <small>OTOWA Electric</small></li>
                  <li>T. Torii <small>Univ. of Fukui</small></li>
                  <li>D. Wang <small>Gifu Univ.</small></li>
                  <li>M. Akita <small>UEC</small></li>
                </ul>
              </div>
            </div>
          </div>
"""

CONTACT = """
          <div class="slide-inner hero contact-slide">
            <span class="section-tag">Get Involved</span>
            <h2>Join us in building a safer, smarter future</h2>
            <p class="contact-text">We welcome your support, cooperation, suggestions, questions, and requests. Follow our progress and connect with the research community.</p>
            <div class="contact-actions">
              <button type="button" class="btn primary" data-fb-qr>
                <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Follow on Facebook
              </button>
              <a href="mailto:morimoto@ele.kindai.ac.jp" class="btn secondary">
                morimoto@ele.kindai.ac.jp
              </a>
            </div>
            <div class="goal-box">
              <p><strong>Overall Goal:</strong> Real-time lightning 3D imaging and nowcasting utilized to reduce lightning damages and electric failures — expanding across Malaysia and neighboring countries.</p>
            </div>
          </div>
"""

PAGES = [
    ("index.html", "home", "RTL3D — Real-Time Lightning 3D Imaging & Forecasting", "Real-Time Lightning 3D Imaging and Forecasting — SATREPS Malaysia-Japan research", "RTL3D", HOME, "", "  <script src=\"js/home-nav.js\"></script>\n  <script src=\"js/home-featured.js\"></script>\n  <script src=\"js/home-hub.js\"></script>\n  <script src=\"js/partner-logo-qr.js\"></script>"),
    ("our-mission.html", "mission", "Our Mission — RTL3D", "Our Mission — RTL3D lightning research", "RTL3D", MISSION, "", ""),
    ("research-framework.html", "framework", "Research Framework — RTL3D", "Research Framework — RTL3D", "RTL3D", FRAMEWORK, "", ""),
    ("observation-network.html", "network", "Observation Network — RTL3D", "Observation Network — RTL3D", "RTL3D", NETWORK, "", ""),
    ("charge-imaging.html", "imaging", "3D Charge Imaging — RTL3D", "3D Charge Imaging — RTL3D", "RTL3D", IMAGING, "", ""),
    ("social-impact.html", "impact", "Social Impact — RTL3D", "Social Impact — RTL3D", "RTL3D", IMPACT, "", ""),
    ("study-area.html", "study-area", "Study Area Map — RTL3D", "Study Area Map — RTL3D", "RTL3D", STUDY,
     "  <link rel=\"stylesheet\" href=\"css/leaflet.css\">",
     "  <script src=\"js/leaflet.js\"></script>\n  <script src=\"js/osm-sites-map.js\"></script>"),
    ("partners.html", "partners", "Partners — RTL3D", "Partners — RTL3D", "RTL3D", PARTNERS, "", ""),
    ("contact.html", "contact", "Contact — RTL3D", "Contact — RTL3D", "RTL3D", CONTACT, "", ""),
]


def canonical_url(page_file: str) -> str:
    if page_file == "index.html":
        return f"{SITE_BASE}/"
    slug = page_file.replace(".html", "")
    return f"{SITE_BASE}/{slug}/"


def seo_meta(page_file: str, page_title: str, desc: str) -> str:
    og_title = page_title.replace("&", "&amp;")
    safe_desc = desc.replace("&", "&amp;")
    return SEO_META.format(
        canonical=canonical_url(page_file),
        og_title=og_title,
        desc=safe_desc,
    )


def render(page_file, page_id, page_title, desc, brand, content, extra_head, extra_page_scripts):
    return HEAD.format(
        desc=desc,
        seo_meta=seo_meta(page_file, page_title, desc),
        page_title=page_title,
        page_id=page_id,
        brand=brand,
        extra_head=extra_head,
        content=content,
        extra_scripts="",
        extra_page_scripts=extra_page_scripts,
    )


def main():
    raise SystemExit(
        "build_pages.py is archived template content only. "
        "Edit {slug}/index.html in the repo root; running this would break clean URLs."
    )


if __name__ == "__main__":
    main()
