#!/usr/bin/env node
/**
 * GPU / compositor audit for every RTL3D page.
 * Uses Puppeteer + CDP tracing (GPU raster tasks) and in-page probes.
 *
 * Usage: node scripts/gpu-audit.js [baseUrl]
 * Default baseUrl: http://127.0.0.1:8765
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = process.argv[2] || 'http://127.0.0.1:8765';
const OUT_DIR = path.join(__dirname, '..', 'logs', 'performance');
const SETTLE_MS = 2500;
const TRACE_MS = 3000;
const NAV_TIMEOUT = 90000;

const PAGES = [
  '/',
  '/our-mission/',
  '/research-framework/',
  '/observation-network/',
  '/lf/',
  '/electric-field/',
  '/gamma-radon/',
  '/charge-imaging/',
  '/social-impact/',
  '/tnb-power/',
  '/did-met-alert/',
  '/public-safety/',
  '/public-safety-industry/',
  '/study-area/',
  '/partners/',
  '/contact/',
  '/vhf/',
  '/high-speed-video/',
  '/video/',
  '/social/',
  '/quiz/',
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseTraceGpuMs(traceEvents) {
  let gpuMs = 0;
  let rasterMs = 0;
  let paintMs = 0;
  let compositeMs = 0;
  let gpuEvents = 0;
  let rasterEvents = 0;

  for (const ev of traceEvents) {
    if (!ev || typeof ev.dur !== 'number') continue;
    const ms = ev.dur / 1000;
    const name = ev.name || '';
    const cat = ev.cat || '';

    if (name === 'GPUTask' || cat.includes('gpu')) {
      gpuMs += ms;
      gpuEvents += 1;
    }
    if (name === 'RasterTask' || name === 'Rasterize' || name.includes('Raster')) {
      rasterMs += ms;
      rasterEvents += 1;
    }
    if (name === 'Paint' || name === 'PaintImage' || name === 'PaintSetup') {
      paintMs += ms;
    }
    if (name === 'CompositeLayers' || name === 'UpdateLayer') {
      compositeMs += ms;
    }
  }

  return { gpuMs, rasterMs, paintMs, compositeMs, gpuEvents, rasterEvents };
}

async function probePage(page) {
  return page.evaluate(async (settleMs) => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(settleMs);

    const canvases = Array.from(document.querySelectorAll('canvas'));
    let webgl2d = 0;
    let webgl = 0;
    let canvasPixels = 0;

    for (const c of canvases) {
      canvasPixels += (c.width || 0) * (c.height || 0);
      try {
        const gl2 = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
        if (gl2) { webgl += 1; continue; }
      } catch (_) {}
      try {
        const gl1 = c.getContext('webgl', { failIfMajorPerformanceCaveat: true });
        if (gl1) { webgl += 1; continue; }
      } catch (_) {}
      try {
        const ctx2d = c.getContext('2d');
        if (ctx2d) webgl2d += 1;
      } catch (_) {}
    }

    const maps = document.querySelectorAll('.leaflet-container').length;
    const plotly = document.querySelectorAll('.js-plotly-plot, .plotly').length;
    const videos = document.querySelectorAll('video').length;
    const lightningCanvas = !!document.getElementById('lightning-canvas');

    const cssAnimations = Array.from(document.querySelectorAll('*')).filter((el) => {
      const s = getComputedStyle(el);
      return (s.animationName && s.animationName !== 'none')
        || (s.transitionProperty && s.transitionProperty !== 'all' && s.transitionProperty !== 'none');
    }).length;

    const fps = await new Promise((resolve) => {
      let frames = 0;
      const start = performance.now();
      function tick() {
        frames += 1;
        if (performance.now() - start < 2000) requestAnimationFrame(tick);
        else resolve(frames / 2);
      }
      requestAnimationFrame(tick);
    });

    const longTasks = performance.getEntriesByType('longtask').length;

    return {
      canvasCount: canvases.length,
      canvas2d: webgl2d,
      webgl,
      canvasPixels,
      canvasMpixels: Math.round(canvasPixels / 1e6 * 100) / 100,
      maps,
      plotly,
      videos,
      lightningCanvas,
      cssAnimations,
      fps: Math.round(fps * 10) / 10,
      longTasks,
      hidden: document.hidden,
    };
  }, SETTLE_MS);
}

async function traceGpu(page) {
  const client = await page.createCDPSession();
  const chunks = [];

  client.on('Tracing.dataCollected', (data) => {
    if (data && data.value) chunks.push(...data.value);
  });

  await client.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: {
      recordMode: 'recordUntilFull',
      includedCategories: [
        'devtools.timeline',
        'disabled-by-default-devtools.timeline.frame',
        'disabled-by-default-devtools.timeline.layers',
        'disabled-by-default-devtools.timeline.paint',
        'disabled-by-default-devtools.timeline',
        'cc',
        'gpu',
      ],
    },
  });

  await sleep(TRACE_MS);
  await client.send('Tracing.end');
  await sleep(500);

  return parseTraceGpuMs(chunks);
}

async function getLayerCount(page) {
  const client = await page.createCDPSession();
  try {
    await client.send('LayerTree.enable');
    const { layerTreeId } = await client.send('LayerTree.compositingReasons', { layerId: 1 }).catch(() => ({}));
    void layerTreeId;
    const snapshot = await client.send('LayerTree.snapshot', { layerId: 1 }).catch(() => null);
    await client.send('LayerTree.disable').catch(() => {});
    return snapshot ? 1 : null;
  } catch (_) {
    return null;
  }
}

function gpuTier(row) {
  const score =
    (row.gpuMs || 0) * 2 +
    (row.rasterMs || 0) +
    (row.canvasMpixels || 0) * 8 +
    (row.webgl || 0) * 40 +
    (row.maps || 0) * 30 +
    (row.plotly || 0) * 25 +
    (row.lightningCanvas ? 12 : 0) +
    Math.max(0, 60 - (row.fps || 60));

  if (score >= 120) return 'HIGH';
  if (score >= 55) return 'MEDIUM';
  return 'LOW';
}

async function auditPage(browser, route) {
  const url = `${BASE.replace(/\/$/, '')}${route}`;
  const page = await browser.newPage();
  const result = {
    route,
    url,
    error: null,
  };

  try {
    await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await sleep(1500);

    const trace = await traceGpu(page);
    const probe = await probePage(page);

    Object.assign(result, probe, trace);
    result.gpuTier = gpuTier(result);
  } catch (err) {
    result.error = String(err.message || err);
    result.gpuTier = 'ERROR';
  } finally {
    await page.close().catch(() => {});
  }

  return result;
}

function renderMarkdown(rows) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `# RTL3D GPU Usage Audit`,
    ``,
    `**Date:** ${date}`,
    `**Base URL:** ${BASE}`,
    `**Method:** Puppeteer (Chromium, GPU enabled) + CDP trace (${TRACE_MS / 1000}s per page) + in-page canvas/RAF probes`,
    ``,
    `## Summary`,
    ``,
    `| Tier | Pages |`,
    `|------|-------|`,
  ];

  const tiers = { HIGH: 0, MEDIUM: 0, LOW: 0, ERROR: 0 };
  for (const r of rows) tiers[r.gpuTier] = (tiers[r.gpuTier] || 0) + 1;
  for (const [t, n] of Object.entries(tiers)) {
    if (n) lines.push(`| ${t} | ${n} |`);
  }

  lines.push(
    ``,
    `## Per-page results`,
    ``,
    `| Page | Tier | FPS | Canvases (2D/WebGL) | Canvas MPx | Maps | Plotly | Lightning BG | GPU ms | Raster ms | Paint ms |`,
    `|------|------|-----|---------------------|------------|------|--------|--------------|--------|-----------|----------|`,
  );

  for (const r of rows) {
    const name = r.route === '/' ? 'home' : r.route.replace(/\//g, '');
    if (r.error) {
      lines.push(`| ${name} | ERROR | — | — | — | — | — | — | — | — | — |`);
      continue;
    }
    lines.push(
      `| ${name} | ${r.gpuTier} | ${r.fps} | ${r.canvasCount} (${r.canvas2d}/${r.webgl}) | ${r.canvasMpixels} | ${r.maps} | ${r.plotly} | ${r.lightningCanvas ? 'yes' : 'no'} | ${Math.round(r.gpuMs)} | ${Math.round(r.rasterMs)} | ${Math.round(r.paintMs)} |`,
    );
  }

  lines.push(
    ``,
    `## Notes`,
    ``,
    `- **GPU ms / Raster ms / Paint ms** — summed CDP trace durations over ${TRACE_MS / 1000}s after ${SETTLE_MS / 1000}s settle time.`,
    `- **Lightning BG** — continuous 2D canvas RAF in \`page-common.js\` (present on most pages).`,
    `- **Maps** — Leaflet containers; map pages also run tile compositing and optional radar canvas layers.`,
    `- **Plotly** — WebGL/SVG chart rendering; heaviest on \`/lf/\` and \`/vhf/\`.`,
    `- Tier is a composite score (trace cost + canvas area + map/plotly presence), not OS-level GPU %.`,
    ``,
  );

  return lines.join('\n');
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--use-angle=default',
      '--enable-webgl',
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
    defaultViewport: null,
  });

  const rows = [];
  console.log(`GPU audit: ${PAGES.length} pages @ ${BASE}\n`);

  for (const route of PAGES) {
    process.stdout.write(`  ${route} ... `);
    const row = await auditPage(browser, route);
    rows.push(row);
    if (row.error) console.log(`ERROR: ${row.error}`);
    else console.log(`${row.gpuTier} | fps=${row.fps} gpu=${Math.round(row.gpuMs)}ms raster=${Math.round(row.rasterMs)}ms canvases=${row.canvasCount}`);
  }

  await browser.close();

  const jsonPath = path.join(OUT_DIR, 'gpu-audit.json');
  const mdPath = path.join(OUT_DIR, `GPU-AUDIT-${new Date().toISOString().slice(0, 10)}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify({ base: BASE, pages: rows }, null, 2));
  fs.writeFileSync(mdPath, renderMarkdown(rows));

  console.log(`\nWrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
