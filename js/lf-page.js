(function () {
  'use strict';

  const flashSelect = document.getElementById('lf-flash-select');
  const flashMeta = document.getElementById('lf-flash-meta');
  const siteList = document.getElementById('lf-site-list');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const play3dBtn = document.getElementById('lf-3d-play');
  const repeat3dBtn = document.getElementById('lf-3d-repeat');

  let sitesData = null;
  let flashesData = null;
  let loadPromise = null;

  const plot2dIds = ['lf-plot-plan', 'lf-plot-time', 'lf-plot-xz', 'lf-plot-zy'];
  const plot3dId = 'lf-plot-3d';
  const PLAYBACK_SPEED = 0.5;
  const ROTATION_SPEED = 0.022 * PLAYBACK_SPEED;
  const MIN_PLAYBACK_MS = 2500;

  const fixedCamera3d = {
    eye: { x: 42.5, y: -39, z: 20 },
    center: { x: 0, y: 0, z: 0 },
    up: { x: 0, y: 0, z: 1 },
  };

  function eyeToOrbit(eye) {
    const radius = Math.hypot(eye.x, eye.y, eye.z) || 1;
    const horiz = Math.hypot(eye.x, eye.y) || 1e-6;
    return {
      radius,
      azimuth: Math.atan2(eye.y, eye.x),
      elevation: Math.atan2(eye.z, horiz),
    };
  }

  function clampElevation(el) {
    return Math.min(1.52, Math.max(0.08, el));
  }

  function defaultOrbit() {
    return eyeToOrbit(fixedCamera3d.eye);
  }

  let anim3d = {
    playing: false,
    rafId: null,
    angle: 0,
    timeData: null,
    revealCount: 0,
    playbackStartMs: 0,
    playbackDurationMs: MIN_PLAYBACK_MS,
    repeat: true,
    pivot: null,
    siteBase: null,
    boxBase: null,
    orbit: null,
    pan: { x: 0, y: 0, z: 0 },
    zoomFactor: 1,
    ready: false,
  };

  function rotateLineXY(xs, ys, angle, cx, cy) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nx = new Array(xs.length);
    const ny = new Array(ys.length);
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] == null || ys[i] == null) {
        nx[i] = null;
        ny[i] = null;
        continue;
      }
      const dx = xs[i] - cx;
      const dy = ys[i] - cy;
      nx[i] = cx + dx * cos - dy * sin;
      ny[i] = cy + dx * sin + dy * cos;
    }
    return { x: nx, y: ny };
  }

  function rotateAroundVertical(xs, ys, angle, cx, cy) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const nx = new Array(xs.length);
    const ny = new Array(ys.length);
    for (let i = 0; i < xs.length; i++) {
      const dx = xs[i] - cx;
      const dy = ys[i] - cy;
      nx[i] = cx + dx * cos - dy * sin;
      ny[i] = cy + dx * sin + dy * cos;
    }
    return { x: nx, y: ny };
  }

  function buildBoxGeometry(lim) {
    const [x0, x1] = lim.x;
    const [y0, y1] = lim.y;
    const [z0, z1] = lim.z;

    const lx = [];
    const ly = [];
    const lz = [];

    function line(xa, ya, za, xb, yb, zb) {
      lx.push(xa, xb, null);
      ly.push(ya, yb, null);
      lz.push(za, zb, null);
    }

    const corners = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    const edges = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    edges.forEach(([a, b]) => line(...corners[a], ...corners[b]));

    return { lines: { x: lx, y: ly, z: lz } };
  }

  const hiddenSceneAxis = {
    showgrid: false,
    showticklabels: false,
    showline: false,
    showbackground: false,
    showspikes: false,
    zeroline: false,
    title: '',
  };

  const plotFont = { family: 'DM Sans, sans-serif', color: '#94a3b8', size: 13 };

  const plotLayout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(15,23,42,0.5)',
    font: plotFont,
    margin: { l: 42, r: 12, t: 28, b: 36 },
    xaxis: { gridcolor: 'rgba(96,165,250,0.12)', zerolinecolor: 'rgba(96,165,250,0.2)' },
    yaxis: { gridcolor: 'rgba(96,165,250,0.12)', zerolinecolor: 'rgba(96,165,250,0.2)' },
  };

  function applyData(sites, flashes) {
    sitesData = sites;
    flashesData = Array.isArray(flashes) ? flashes : [];
    populateFlashSelect();
    populateSiteList();
  }

  function loadData() {
    if (loadPromise) return loadPromise;

    if (window.LF_DATA) {
      applyData(window.LF_DATA.sites, window.LF_DATA.flashes);
      return Promise.resolve();
    }

    if (location.protocol === 'file:') {
      flashesData = [];
      if (flashMeta) {
        flashMeta.textContent = 'Data file missing. Run: py scripts/build_lf_data.py';
      }
      return Promise.resolve();
    }

    loadPromise = Promise.all([
      fetch('data/lf/sites.json').then((r) => r.json()),
      fetch('data/lf/flashes.json').then((r) => r.json()),
    ]).then(([sites, payload]) => {
      applyData(sites, payload.flashes);
    }).catch(() => {
      flashesData = [];
      if (flashMeta) flashMeta.textContent = 'Could not load lightning data.';
    });
    return loadPromise;
  }

  function populateSiteList() {
    if (!sitesData?.sites) return;
    siteList.innerHTML = sitesData.sites.map((s) =>
      `<li><span class="site-code">${s.code}</span> ${s.name}` +
      `<small>${s.x_km}, ${s.y_km} km</small></li>`
    ).join('');
    window.RTL3DDragScroll?.scan?.(siteList);
  }

  function populateFlashSelect() {
    if (!flashSelect) return;
    flashSelect.innerHTML = '';
    if (!flashesData?.length) return;
    flashesData.forEach((f, i) => {
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = f.label;
      flashSelect.appendChild(opt);
    });
  }

  function percentile(arr, p) {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const idx = (s.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return s[lo];
    return s[lo] + (s[hi] - s[lo]) * (idx - lo);
  }

  function calcPlanLimits(x, y) {
    const xMin = percentile(x, 0.005);
    const xMax = percentile(x, 0.995);
    const yMin = percentile(y, 0.005);
    const yMax = percentile(y, 0.995);
    const xC = 0.5 * (xMin + xMax);
    const yC = 0.5 * (yMin + yMax);
    const sideInt = Math.ceil(Math.max(xMax - xMin, yMax - yMin, 1) + 4);
    const half = 0.5 * sideInt;
    const xLo = Math.floor(xC - half);
    const yLo = Math.floor(yC - half);
    return { x: [xLo, xLo + sideInt], y: [yLo, yLo + sideInt], span: sideInt };
  }

  function calcNetworkPlanLimits(x, y, sites) {
    const xs = x.slice();
    const ys = y.slice();
    sites.forEach((s) => {
      xs.push(s.x_km);
      ys.push(s.y_km);
    });
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const xC = 0.5 * (xMin + xMax);
    const yC = 0.5 * (yMin + yMax);
    const sideInt = Math.ceil(Math.max(xMax - xMin, yMax - yMin, 1) + 6);
    const half = 0.5 * sideInt;
    const xLo = Math.floor(xC - half);
    const yLo = Math.floor(yC - half);
    return { x: [xLo, xLo + sideInt], y: [yLo, yLo + sideInt], span: sideInt };
  }

  const planPlotId = 'lf-plot-plan';
  let planZoom = {
    wide: null,
    tight: null,
    showingWide: true,
  };

  function applyPlanViewAxes(showingWide) {
    if (!window.Plotly || !planZoom.wide || !planZoom.tight) return;
    const lim = showingWide ? planZoom.wide : planZoom.tight;
    const step = chooseKmTickStep(lim.span);
    const ticksX = kmTicks(lim.x[0], lim.x[1], step);
    const ticksY = kmTicks(lim.y[0], lim.y[1], step);
    Plotly.relayout(planPlotId, {
      'xaxis.range': lim.x,
      'yaxis.range': lim.y,
      'xaxis.tickvals': ticksX,
      'xaxis.ticktext': ticksX.map(String),
      'yaxis.tickvals': ticksY,
      'yaxis.ticktext': ticksY.map(String),
    });
  }

  function togglePlanViewZoom() {
    planZoom.showingWide = !planZoom.showingWide;
    applyPlanViewAxes(planZoom.showingWide);
  }

  function bindPlanViewClick() {
    const el = document.getElementById(planPlotId);
    if (!el || el.dataset.planZoomBound) return;
    el.dataset.planZoomBound = '1';
    el.addEventListener('click', (e) => {
      if (e.target.closest('.modebar')) return;
      togglePlanViewZoom();
    });
  }

  function chooseKmTickStep(spanKm, targetTicks) {
    targetTicks = targetTicks || 8;
    if (spanKm <= 0) return 1;
    const ideal = spanKm / Math.max(targetTicks - 1, 1);
    const magnitude = Math.pow(10, Math.floor(Math.log10(ideal)));
    const normalized = ideal / magnitude;
    const candidates = [1, 2, 2.5, 5, 10];
    let best = candidates[0];
    candidates.forEach((c) => {
      if (Math.abs(c - normalized) < Math.abs(best - normalized)) best = c;
    });
    return Math.max(1, Math.round(best * magnitude));
  }

  function kmTicks(min, max, step) {
    const start = Math.ceil(min / step) * step;
    const end = Math.floor(max / step) * step;
    const ticks = [];
    for (let v = start; v <= end + step * 0.01; v += step) ticks.push(Math.round(v));
    return ticks.length ? ticks : [Math.round(min), Math.round(max)];
  }

  function calcCrossSectionLimits(hMin, hMax, zMin, zMax) {
    const zLo = Math.max(0, zMin - 0.5);
    const zHi = zMax + 0.5;
    const spanInt = Math.ceil(Math.max(hMax - hMin, zHi - zLo, 1) + 4);
    const half = 0.5 * spanInt;
    const hStart = Math.floor(0.5 * (hMin + hMax) - half);
    let zStart = Math.floor(0.5 * (zLo + zHi) - half);
    if (zStart < 0) zStart = 0;
    return { h: [hStart, hStart + spanInt], z: [zStart, zStart + spanInt], span: spanInt };
  }

  function applyEqualKmAxes(layout, xRange, yRange, tickStep) {
    const xTicks = kmTicks(xRange[0], xRange[1], tickStep);
    const yTicks = kmTicks(yRange[0], yRange[1], tickStep);
    layout.xaxis.range = xRange;
    layout.yaxis.range = yRange;
    layout.xaxis.tickmode = 'array';
    layout.xaxis.tickvals = xTicks;
    layout.xaxis.ticktext = xTicks.map(String);
    layout.xaxis.constrain = 'domain';
    layout.yaxis.tickmode = 'array';
    layout.yaxis.tickvals = yTicks;
    layout.yaxis.ticktext = yTicks.map(String);
    layout.yaxis.scaleanchor = 'x';
    layout.yaxis.scaleratio = 1;
  }

  function calcLimits(x, y, z) {
    const xMin = percentile(x, 0.005);
    const xMax = percentile(x, 0.995);
    const yMin = percentile(y, 0.005);
    const yMax = percentile(y, 0.995);
    const zMin = Math.max(0, percentile(z, 0.005) - 0.5);
    const zMax = percentile(z, 0.995) + 0.5;
    const side = Math.max(xMax - xMin, yMax - yMin, zMax - zMin, 1) + 4;
    const half = 0.5 * side;
    const xC = 0.5 * (xMin + xMax);
    const yC = 0.5 * (yMin + yMax);
    const zC = 0.5 * (zMin + zMax);
    return {
      x: [Math.floor(xC - half), Math.ceil(xC + half)],
      y: [Math.floor(yC - half), Math.ceil(yC + half)],
      z: [Math.max(0, Math.floor(zC - half)), Math.ceil(zC + half)],
    };
  }

  function scatterTrace(x, y, t, name) {
    return {
      x, y, mode: 'markers', type: 'scatter', name,
      showlegend: false,
      marker: { size: 4, color: t, colorscale: 'Jet', opacity: 0.65, line: { width: 0 } },
      hovertemplate: '%{x:.1f}, %{y:.1f}<br>t=%{marker.color:.0f} ms<extra></extra>',
    };
  }

  function buildTimeOrderedData(x, y, z, t) {
    const n = x.length;
    if (!n) return { x: [], y: [], z: [], t: [], tMin: 0, tMax: 0 };
    const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => t[a] - t[b]);
    const sx = order.map((i) => x[i]);
    const sy = order.map((i) => y[i]);
    const sz = order.map((i) => z[i]);
    const st = order.map((i) => t[i]);
    return { x: sx, y: sy, z: sz, t: st, tMin: st[0], tMax: st[st.length - 1] };
  }

  function updateTimeReveal(now) {
    const d = anim3d.timeData;
    if (!d?.t.length) return;
    if (!anim3d.playbackStartMs) anim3d.playbackStartMs = now;
    const span = d.tMax - d.tMin || 1;
    const elapsed = now - anim3d.playbackStartMs;

    if (elapsed >= anim3d.playbackDurationMs) {
      if (anim3d.repeat) {
        anim3d.playbackStartMs = now;
        anim3d.revealCount = 0;
        return;
      }
      anim3d.revealCount = d.t.length;
      return;
    }

    const playT = d.tMin + (elapsed / anim3d.playbackDurationMs) * span;

    let lo = 0;
    let hi = d.t.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (d.t[mid] <= playT) lo = mid + 1;
      else hi = mid;
    }
    anim3d.revealCount = lo;
  }

  function getRevealedSlice() {
    const d = anim3d.timeData;
    if (!d) return { x: [], y: [], z: [], t: [] };
    const n = Math.min(anim3d.revealCount, d.x.length);
    return {
      x: d.x.slice(0, n),
      y: d.y.slice(0, n),
      z: d.z.slice(0, n),
      t: d.t.slice(0, n),
    };
  }

  function stop3dAnimation() {
    anim3d.playing = false;
    if (anim3d.rafId) {
      cancelAnimationFrame(anim3d.rafId);
      anim3d.rafId = null;
    }
    play3dBtn?.classList.remove('playing');
    play3dBtn?.setAttribute('aria-label', 'Play 3D animation');
  }

  function setPlayButtonState(playing) {
    if (!play3dBtn) return;
    play3dBtn.classList.toggle('playing', playing);
    play3dBtn.setAttribute('aria-label', playing ? 'Pause 3D animation' : 'Play 3D animation');
  }

  function apply3dView() {
    if (!anim3d.ready || !anim3d.pivot || !anim3d.boxBase || !window.Plotly) return;
    const revealed = getRevealedSlice();
    const { x, y, z, t } = revealed;
    const { cx, cy } = anim3d.pivot;
    const src = rotateAroundVertical(x, y, anim3d.angle, cx, cy);
    const sites = rotateAroundVertical(anim3d.siteBase.x, anim3d.siteBase.y, anim3d.angle, cx, cy);
    const boxLines = rotateLineXY(anim3d.boxBase.lines.x, anim3d.boxBase.lines.y, anim3d.angle, cx, cy);

    Plotly.restyle(plot3dId, {
      x: [src.x, sites.x, boxLines.x],
      y: [src.y, sites.y, boxLines.y],
      z: [z, anim3d.siteBase.z, anim3d.boxBase.lines.z],
    }, [0, 1, 2]);
    if (t.length) {
      Plotly.restyle(plot3dId, { 'marker.color': [t] }, [0]);
    }
  }

  function tick3dAnimation(now) {
    if (!anim3d.playing) return;

    updateTimeReveal(now);
    anim3d.angle += ROTATION_SPEED;
    apply3dView();
    anim3d.rafId = requestAnimationFrame(tick3dAnimation);
  }

  function start3dAnimation() {
    if (!anim3d.timeData?.t.length || !window.Plotly) return;
    stop3dAnimation();
    anim3d.playing = true;
    anim3d.playbackStartMs = 0;
    anim3d.revealCount = 0;
    setPlayButtonState(true);
    anim3d.rafId = requestAnimationFrame(tick3dAnimation);
  }

  function toggle3dAnimation() {
    if (anim3d.playing) stop3dAnimation();
    else start3dAnimation();
  }

  function setRepeatButtonState(on) {
    if (!repeat3dBtn) return;
    repeat3dBtn.classList.toggle('active', on);
    repeat3dBtn.setAttribute('aria-label', on ? 'Stop 3D repeat' : 'Repeat 3D animation');
    repeat3dBtn.title = on ? 'Repeat 3D on' : 'Repeat 3D off';
  }

  function toggle3dRepeat() {
    anim3d.repeat = !anim3d.repeat;
    setRepeatButtonState(anim3d.repeat);
  }

  function render3dPlot(flash, lim) {
    if (!flash || !window.Plotly || !sitesData?.sites) return;
    const sites = sitesData.sites;
    const spanX = lim.x[1] - lim.x[0];
    const spanY = lim.y[1] - lim.y[0];
    const spanZ = lim.z[1] - lim.z[0];

    anim3d.angle = 0;
    anim3d.revealCount = 0;
    anim3d.playbackStartMs = 0;
    anim3d.ready = false;
    anim3d.pivot = {
      cx: 0.5 * (lim.x[0] + lim.x[1]),
      cy: 0.5 * (lim.y[0] + lim.y[1]),
    };
    anim3d.zoomFactor = 1;
    anim3d.orbit = defaultOrbit();
    anim3d.pan = { x: 0, y: 0, z: 0 };
    anim3d.siteBase = {
      x: sites.map((s) => s.x_km),
      y: sites.map((s) => s.y_km),
      z: sites.map((s) => s.alt_km || 0),
      text: sites.map((s) => s.code),
    };
    anim3d.boxBase = buildBoxGeometry(lim);

    const boxLines = anim3d.boxBase.lines;
    const empty = { x: [], y: [], z: [], t: [] };

    const sources3d = {
      type: 'scatter3d',
      mode: 'markers',
      name: 'Sources',
      x: empty.x,
      y: empty.y,
      z: empty.z,
      marker: {
        size: 2.5,
        color: empty.t,
        colorscale: 'Jet',
        opacity: 0.75,
        line: { width: 0 },
      },
      hovertemplate: 'WE %{x:.1f}, SN %{y:.1f}, H %{z:.1f} km<br>t=%{marker.color:.0f} ms<extra></extra>',
    };

    const sites3d = {
      type: 'scatter3d',
      mode: 'markers+text',
      name: 'LF sites',
      x: sites.map((s) => s.x_km),
      y: sites.map((s) => s.y_km),
      z: sites.map((s) => s.alt_km || 0),
      text: sites.map((s) => s.code),
      textposition: 'top center',
      textfont: { family: 'DM Sans, sans-serif', size: 12, color: '#e2e8f0' },
      marker: {
        symbol: 'square',
        size: 4,
        color: '#fbbf24',
        line: { color: '#0f172a', width: 1 },
      },
      hovertemplate: '%{text}<extra></extra>',
    };

    const box3d = {
      type: 'scatter3d',
      mode: 'lines',
      name: 'Box',
      x: boxLines.x,
      y: boxLines.y,
      z: boxLines.z,
      line: { color: 'rgba(96,165,250,0.55)', width: 2 },
      hoverinfo: 'skip',
    };

    const layout = {
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(15,23,42,0.5)',
      font: { family: 'DM Sans, sans-serif', color: '#94a3b8', size: 13 },
      margin: { l: 0, r: 0, t: 28, b: 0 },
      title: { text: '3D view (rotating)', font: { family: 'DM Sans, sans-serif', size: 14, color: '#e2e8f0' } },
      showlegend: false,
      scene: {
        xaxis: { ...hiddenSceneAxis, range: lim.x },
        yaxis: { ...hiddenSceneAxis, range: lim.y },
        zaxis: { ...hiddenSceneAxis, range: lim.z },
        aspectmode: 'manual',
        aspectratio: { x: spanX || 1, y: spanY || 1, z: spanZ || 1 },
        dragmode: false,
        camera: fixedCamera3d,
        bgcolor: 'rgba(15,23,42,0.4)',
      },
    };

    Plotly.react(plot3dId, [sources3d, sites3d, box3d], layout, {
      responsive: true,
      displayModeBar: false,
      scrollZoom: false,
    })
      .then(() => {
        anim3d.ready = true;
        apply3dCamera();
        Plotly.Plots.resize(plot3dId);
        start3dAnimation();
      });
  }

  function renderPlots(flash) {
    if (!flash || !window.Plotly) return;
    stop3dAnimation();
    const { x, y, z, t } = flash;
    const xMin = percentile(x, 0.005);
    const xMax = percentile(x, 0.995);
    const yMin = percentile(y, 0.005);
    const yMax = percentile(y, 0.995);
    const zMin = Math.max(0, percentile(z, 0.005));
    const zMax = percentile(z, 0.995);
    const lim = calcLimits(x, y, z);
    const sites = sitesData.sites;
    const planLim = calcPlanLimits(x, y);
    const networkPlanLim = calcNetworkPlanLimits(x, y, sites);
    planZoom.wide = networkPlanLim;
    planZoom.tight = planLim;
    planZoom.showingWide = true;
    const activePlanLim = planZoom.showingWide ? networkPlanLim : planLim;
    const xzLim = calcCrossSectionLimits(xMin, xMax, zMin, zMax);
    const zyLim = calcCrossSectionLimits(yMin, yMax, zMin, zMax);
    const planTickStep = chooseKmTickStep(activePlanLim.span);
    const crossTickStep = chooseKmTickStep(Math.max(xzLim.span, zyLim.span));
    const planTicksX = kmTicks(activePlanLim.x[0], activePlanLim.x[1], planTickStep);
    const planTicksY = kmTicks(activePlanLim.y[0], activePlanLim.y[1], planTickStep);

    anim3d.timeData = buildTimeOrderedData(x, y, z, t);
    const timeSpan = anim3d.timeData.tMax - anim3d.timeData.tMin;
    anim3d.playbackDurationMs = Math.max(timeSpan, MIN_PLAYBACK_MS) / PLAYBACK_SPEED;
    anim3d.revealCount = 0;
    anim3d.playbackStartMs = 0;

    const planSites = {
      x: sites.map((s) => s.x_km),
      y: sites.map((s) => s.y_km),
      mode: 'markers+text', type: 'scatter', name: 'LF sites',
      showlegend: false,
      marker: { symbol: 'square', size: 10, color: '#fbbf24', line: { color: '#0f172a', width: 1 } },
      text: sites.map((s) => s.code),
      textposition: 'top center',
      textfont: { family: 'DM Sans, sans-serif', size: 11, color: '#e2e8f0' },
      hovertemplate: '%{text}<extra></extra>',
    };

    const traces = {
      plan: [scatterTrace(x, y, t, 'Sources'), planSites],
      time: [scatterTrace(t, z, t, 'Time vs height')],
      xz: [scatterTrace(x, z, t, 'West-East vs height')],
      zy: [scatterTrace(y, z, t, 'Height vs South-North')],
    };

    const titles = [
      'Plan view (colored by time)',
      'Time vs height',
      'Height vs West-East',
      'Height vs South-North',
    ];
    const axes = [
      { key: 'plan', x: 'West-East (km)', y: 'South-North (km)', lim: { x: activePlanLim.x, y: activePlanLim.y }, plan: true },
      { key: 'time', x: 'Time (ms)', y: 'Height (km)', lim: { x: [Math.min(...t), Math.max(...t)], y: lim.z } },
      { key: 'xz', x: 'West-East (km)', y: 'Height (km)', equalKm: true, xRange: xzLim.h, yRange: xzLim.z },
      { key: 'zy', x: 'South-North (km)', y: 'Height (km)', equalKm: true, xRange: zyLim.h, yRange: zyLim.z },
    ];

    plot2dIds.forEach((id, i) => {
      const cfg = axes[i];
      if (!cfg) return;
      const layout = {
        ...plotLayout,
        title: { text: titles[i], font: { family: 'DM Sans, sans-serif', size: 14, color: '#e2e8f0' } },
        xaxis: { ...plotLayout.xaxis, title: cfg.x, range: cfg.lim?.x || cfg.xRange },
        yaxis: { ...plotLayout.yaxis, title: cfg.y, range: cfg.lim?.y || cfg.yRange },
        showlegend: false,
      };
      if (cfg.plan) {
        layout.xaxis.tickmode = 'array';
        layout.xaxis.tickvals = planTicksX;
        layout.xaxis.ticktext = planTicksX.map(String);
        layout.xaxis.constrain = 'domain';
        layout.yaxis.tickmode = 'array';
        layout.yaxis.tickvals = planTicksY;
        layout.yaxis.ticktext = planTicksY.map(String);
        layout.yaxis.scaleanchor = 'x';
        layout.yaxis.scaleratio = 1;
      }
      if (cfg.equalKm) applyEqualKmAxes(layout, cfg.xRange, cfg.yRange, crossTickStep);
      Plotly.react(id, traces[cfg.key], layout, { responsive: true, displayModeBar: false });
    });

    render3dPlot(flash, lim);

    flashMeta.innerHTML =
      `<strong>${flash.utc}</strong> · ${flash.duration_s} s flash · ` +
      `${flash.n_sources_total.toLocaleString()} localized sources · ` +
      `showing ${flash.n_sources_plot.toLocaleString()} points`;
    requestAnimationFrame(() => window.RTL3DDragScroll?.refresh?.());
  }

  function initPlots() {
    if (flashesData?.length) renderPlots(flashesData[0]);
    else if (flashMeta) flashMeta.textContent = 'No lightning events available.';
  }

  function onPlotResize() {
    if (!window.Plotly) return;
    plot2dIds.forEach((id) => {
      if (document.getElementById(id)) Plotly.Plots.resize(id);
    });
    const plot3dEl = document.getElementById(plot3dId);
    if (plot3dEl?.querySelector('.plotly')) Plotly.Plots.resize(plot3dId);
    window.RTL3DDragScroll?.refresh?.();
  }

  function clamp3dZoom(z) {
    return Math.min(5, Math.max(0.15, z));
  }

  function apply3dCamera() {
    if (!window.Plotly || !anim3d.orbit) return;
    const { radius, azimuth, elevation } = anim3d.orbit;
    const r = radius * anim3d.zoomFactor;
    const cosEl = Math.cos(elevation);
    const p = anim3d.pan;
    Plotly.relayout(plot3dId, {
      'scene.camera.center': { x: p.x, y: p.y, z: p.z },
      'scene.camera.eye': {
        x: p.x + r * cosEl * Math.cos(azimuth),
        y: p.y + r * cosEl * Math.sin(azimuth),
        z: p.z + r * Math.sin(elevation),
      },
      'scene.camera.up': fixedCamera3d.up,
    });
  }

  function bind3dInteraction() {
    const wrap = document.querySelector('.lf-plot-3d-wrap');
    if (!wrap || wrap.dataset.lf3dBound) return;
    wrap.dataset.lf3dBound = '1';

    const ORBIT_AZ_SENS = 0.009;
    const ORBIT_EL_SENS = 0.009;
    let pinchDist = 0;
    let orbiting = false;
    let orbitPending = null;
    let orbitStartX = 0;
    let orbitStartY = 0;
    let orbitOrigin = { azimuth: 0, elevation: 0 };

    function isControlBtn(target) {
      return target?.closest?.('.lf-3d-play') || target?.closest?.('.lf-3d-repeat');
    }

    function beginOrbit(clientX, clientY) {
      if (!anim3d.orbit) return;
      orbiting = true;
      orbitStartX = clientX;
      orbitStartY = clientY;
      orbitOrigin = {
        azimuth: anim3d.orbit.azimuth,
        elevation: anim3d.orbit.elevation,
      };
      wrap.classList.add('is-panning');
    }

    function moveOrbit(clientX, clientY) {
      if (!orbiting || !anim3d.orbit) return;
      const dx = clientX - orbitStartX;
      const dy = clientY - orbitStartY;
      anim3d.orbit.azimuth = orbitOrigin.azimuth - dx * ORBIT_AZ_SENS;
      anim3d.orbit.elevation = clampElevation(orbitOrigin.elevation + dy * ORBIT_EL_SENS);
      apply3dCamera();
    }

    function endOrbit() {
      orbiting = false;
      wrap.classList.remove('is-panning');
    }

    wrap.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const scale = e.deltaY > 0 ? 1.07 : 0.93;
      anim3d.zoomFactor = clamp3dZoom(anim3d.zoomFactor * scale);
      apply3dCamera();
    }, { passive: false });

    wrap.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || isControlBtn(e.target)) return;
      orbitPending = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mousemove', (e) => {
      if (orbitPending && !orbiting) {
        const dx = e.clientX - orbitPending.x;
        const dy = e.clientY - orbitPending.y;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          orbitPending = null;
          return;
        }
        e.preventDefault();
        beginOrbit(orbitPending.x, orbitPending.y);
        orbitPending = null;
        moveOrbit(e.clientX, e.clientY);
        return;
      }
      if (!orbiting) return;
      e.preventDefault();
      moveOrbit(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', () => {
      orbitPending = null;
      if (orbiting) endOrbit();
    });

    wrap.addEventListener('touchstart', (e) => {
      if (isControlBtn(e.target)) return;
      if (e.touches.length === 1) {
        pinchDist = 0;
        beginOrbit(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        endOrbit();
        pinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    wrap.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && orbiting) {
        e.preventDefault();
        moveOrbit(e.touches[0].clientX, e.touches[0].clientY);
        return;
      }
      if (e.touches.length !== 2 || !pinchDist) return;
      e.preventDefault();
      endOrbit();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      anim3d.zoomFactor = clamp3dZoom(anim3d.zoomFactor * (dist / pinchDist));
      pinchDist = dist;
      apply3dCamera();
    }, { passive: false });

    wrap.addEventListener('touchend', (e) => {
      if (e.touches.length === 0) {
        pinchDist = 0;
        endOrbit();
      } else if (e.touches.length === 1) {
        pinchDist = 0;
        beginOrbit(e.touches[0].clientX, e.touches[0].clientY);
      }
    });
  }

  function bindEvents() {
    flashSelect.addEventListener('change', () => {
      const idx = parseInt(flashSelect.value, 10);
      if (!Number.isNaN(idx) && flashesData?.[idx]) renderPlots(flashesData[idx]);
    });

    window.addEventListener('resize', onPlotResize);
    window.addEventListener('rtl3d:viewport-resize', onPlotResize);
    const vp = document.getElementById('viewport-169');
    if (vp && window.ResizeObserver) new ResizeObserver(onPlotResize).observe(vp);

    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
        else document.exitFullscreen?.();
      });
      document.addEventListener('fullscreenchange', () => {
        document.body.classList.toggle('fullscreen', !!document.fullscreenElement);
      });
    }

    play3dBtn?.addEventListener('click', toggle3dAnimation);
    repeat3dBtn?.addEventListener('click', toggle3dRepeat);
    setRepeatButtonState(true);
    bind3dInteraction();
    bindPlanViewClick();
  }

  function start() {
    loadData().then(() => {
      if (window.Plotly) initPlots();
      else window.addEventListener('load', initPlots, { once: true });
    });
    bindEvents();
  }

  start();
})();
