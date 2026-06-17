(function () {
  'use strict';

  const ORIGIN_LAT = 2.726931;
  const ORIGIN_LON = 102.24901;
  const ORIGIN_LAT_RAD = (ORIGIN_LAT * Math.PI) / 180;

  /** Near-ground horizontal slice altitude (km). */
  const SLICE_ALT_KM = 2;
  const SLICE_SIGMA_KM = 1.2;

  const CG_MAX_HEIGHT_KM = 2;

  const FRAME_MINUTES = 5;
  const FRAME_MS = FRAME_MINUTES * 60 * 1000;
  const FRAME_ADVANCE_MS = 2800;
  /** Mock nowcast lead times: +5 … +30 min (5 min steps). */
  const NOWCAST_STEPS = 6;
  const NOWCAST_LEAD_MAX_MIN = 30;
  const NOWCAST_DECAY = 0.86;

  const GRID_SIZE = 320;
  const STRIKE_SAMPLE_MAX = 1200;
  const BLUR_SIGMA_KM = 4.8;
  const GRID_BLUR_PASSES = 2;

  /** Lightning activity intensity range (dBZ). */
  const DBZ_MIN = 5;
  const DBZ_MAX = 50;
  const DBZ_FLOOR = 5;

  /** Softer weather-radar-style palette with smooth alpha falloff at weak echoes. */
  const DBZ_COLOR_STOPS = [
    { dbz: 5, rgba: [12, 52, 115, 0.1] },
    { dbz: 10, rgba: [22, 88, 155, 0.26] },
    { dbz: 15, rgba: [30, 128, 185, 0.4] },
    { dbz: 20, rgba: [38, 165, 118, 0.52] },
    { dbz: 25, rgba: [68, 192, 88, 0.64] },
    { dbz: 30, rgba: [148, 210, 62, 0.74] },
    { dbz: 35, rgba: [232, 208, 58, 0.84] },
    { dbz: 40, rgba: [244, 156, 48, 0.9] },
    { dbz: 45, rgba: [236, 92, 72, 0.94] },
    { dbz: 50, rgba: [188, 36, 88, 0.97] },
  ];

  function dbzToRgba(dbz) {
    if (dbz < DBZ_FLOOR) return [0, 0, 0, 0];
    if (dbz >= DBZ_MAX) return DBZ_COLOR_STOPS[DBZ_COLOR_STOPS.length - 1].rgba.slice();
    for (let i = 0; i < DBZ_COLOR_STOPS.length - 1; i++) {
      const a = DBZ_COLOR_STOPS[i];
      const b = DBZ_COLOR_STOPS[i + 1];
      if (dbz >= a.dbz && dbz <= b.dbz) {
        const f = (dbz - a.dbz) / (b.dbz - a.dbz);
        return [
          Math.round(a.rgba[0] + (b.rgba[0] - a.rgba[0]) * f),
          Math.round(a.rgba[1] + (b.rgba[1] - a.rgba[1]) * f),
          Math.round(a.rgba[2] + (b.rgba[2] - a.rgba[2]) * f),
          a.rgba[3] + (b.rgba[3] - a.rgba[3]) * f,
        ];
      }
    }
    return [0, 0, 0, 0];
  }

  function kmToLatLng(xKm, yKm) {
    const lat = ORIGIN_LAT + yKm / 111.32;
    const lon = ORIGIN_LON + xKm / (111.32 * Math.cos(ORIGIN_LAT_RAD));
    return { lat, lng: lon };
  }

  function latLngToKm(lat, lng) {
    return {
      xKm: (lng - ORIGIN_LON) * 111.32 * Math.cos(ORIGIN_LAT_RAD),
      yKm: (lat - ORIGIN_LAT) * 111.32,
    };
  }

  function formatUtcRange(startMs, endMs) {
    const fmt = (ms) => new Date(ms).toISOString().slice(11, 19) + ' UTC';
    return fmt(startMs) + ' – ' + fmt(endMs);
  }

  function frameCentroid(strikes) {
    if (!strikes || !strikes.length) return null;
    let wSum = 0;
    let latSum = 0;
    let lngSum = 0;
    strikes.forEach((s) => {
      const w = s.weight * (s.isCG ? 1.4 : 1);
      latSum += s.lat * w;
      lngSum += s.lng * w;
      wSum += w;
    });
    if (wSum <= 0) return null;
    return { lat: latSum / wSum, lng: lngSum / wSum };
  }

  function estimateMotionKmPerMin(observedFrames) {
    const n = Math.min(4, observedFrames.length);
    if (n < 2) return { vx: 0, vy: 0 };
    const slice = observedFrames.slice(-n);
    const pts = slice
      .map((f) => {
        const src = f.strikes && f.strikes.length ? f.strikes : f.displayStrikes;
        const c = frameCentroid(src);
        return c ? latLngToKm(c.lat, c.lng) : null;
      })
      .filter(Boolean);
    if (pts.length < 2) return { vx: 0, vy: 0 };
    const first = pts[0];
    const last = pts[pts.length - 1];
    const dtMin = (pts.length - 1) * FRAME_MINUTES;
    return {
      vx: (last.xKm - first.xKm) / dtMin,
      vy: (last.yKm - first.yKm) / dtMin,
    };
  }

  function shiftStrike(s, dxKm, dyKm, decay) {
    const km = latLngToKm(s.lat, s.lng);
    const ll = kmToLatLng(km.xKm + dxKm, km.yKm + dyKm);
    return {
      lat: ll.lat,
      lng: ll.lng,
      z: s.z,
      absMs: s.absMs,
      isCG: s.isCG,
      weight: s.weight * decay,
      isNowcast: true,
    };
  }

  function buildNowcastFrames(observedFrames) {
    if (!observedFrames.length) return [];
    const motion = estimateMotionKmPerMin(observedFrames);
    const last = observedFrames[observedFrames.length - 1];
    const seedStrikes =
      last.strikes && last.strikes.length
        ? last.strikes
        : last.displayStrikes && last.displayStrikes.length
          ? last.displayStrikes
          : last.strikes;
    const anchorEndMs = last.endMs;
    const out = [];
    for (let k = 1; k <= NOWCAST_STEPS; k++) {
      const shiftX = motion.vx * FRAME_MINUTES * k;
      const shiftY = motion.vy * FRAME_MINUTES * k;
      const decay = Math.pow(NOWCAST_DECAY, k);
      const strikes = seedStrikes.map((s) => shiftStrike(s, shiftX, shiftY, decay));
      const c = frameCentroid(seedStrikes);
      if (c) {
        const cKm = latLngToKm(c.lat, c.lng);
        const lead = kmToLatLng(cKm.xKm + shiftX * 1.12, cKm.yKm + shiftY * 1.12);
        strikes.push({
          lat: lead.lat,
          lng: lead.lng,
          z: 1.2,
          absMs: anchorEndMs + k * FRAME_MS,
          isCG: true,
          weight: 0.72 * decay,
          isNowcast: true,
        });
      }
      out.push({
        startMs: anchorEndMs + (k - 1) * FRAME_MS,
        endMs: anchorEndMs + k * FRAME_MS,
        strikes,
        isNowcast: true,
        nowcastLeadMin: FRAME_MINUTES * k,
      });
    }
    return out;
  }

  function buildPlaybackFrames(strikes) {
    const observed = buildTimeFrames(strikes).map((f) => ({ ...f, isNowcast: false }));
    const nowcast = buildNowcastFrames(observed);
    return { observed, nowcast, all: observed.concat(nowcast) };
  }

  function displayTimesForFrame(frame) {
    if (!frame.isNowcast) {
      return {
        startMs: frame.startMs,
        endMs: frame.endMs,
        isLive: true,
        isNowcast: false,
        leadMin: 0,
      };
    }
    return {
      startMs: frame.startMs,
      endMs: frame.endMs,
      isLive: false,
      isNowcast: true,
      leadMin: frame.nowcastLeadMin || FRAME_MINUTES,
    };
  }

  function strikesForDraw(frame) {
    if (frame.isNowcast) return frame.strikes || [];
    return frame.displayStrikes || frame.strikes || [];
  }

  /** Height weight for near-ground activity slice at SLICE_ALT_KM. */
  function sliceWeight(zKm) {
    const dz = zKm - SLICE_ALT_KM;
    return Math.exp(-(dz * dz) / (2 * SLICE_SIGMA_KM * SLICE_SIGMA_KM));
  }

  function buildStrikeCatalog(flashes) {
    const strikes = [];
    flashes.forEach((flash, flashIdx) => {
      const epoch0 =
        flash.epochs && flash.epochs.length ? flash.epochs[0] : 1753221753 + flashIdx * 300;
      const n = flash.x ? flash.x.length : 0;
      for (let i = 0; i < n; i++) {
        const ll = kmToLatLng(flash.x[i], flash.y[i]);
        const z = flash.z[i];
        const w = sliceWeight(z);
        if (w < 0.08) continue;
        strikes.push({
          lat: ll.lat,
          lng: ll.lng,
          z,
          absMs: epoch0 * 1000 + (flash.t[i] || 0),
          isCG: z <= CG_MAX_HEIGHT_KM,
          weight: w,
        });
      }
    });
    strikes.sort((a, b) => a.absMs - b.absMs);
    return strikes;
  }

  function buildTimeFrames(strikes) {
    if (!strikes.length) return [];
    const t0 = Math.floor(strikes[0].absMs / FRAME_MS) * FRAME_MS;
    const t1 = strikes[strikes.length - 1].absMs;
    const frames = [];
    const cumulative = [];
    for (let start = t0; start <= t1; start += FRAME_MS) {
      const end = start + FRAME_MS;
      const inFrame = strikes.filter((s) => s.absMs >= start && s.absMs < end);
      inFrame.forEach((s) => cumulative.push(s));
      frames.push({
        startMs: start,
        endMs: end,
        strikes: inFrame,
        displayStrikes: cumulative.slice(),
      });
    }
    return frames;
  }

  function sampleStrikes(strikes, maxCount) {
    if (strikes.length <= maxCount) return strikes;
    const out = [];
    const step = strikes.length / maxCount;
    for (let i = 0; i < maxCount; i++) {
      out.push(strikes[Math.floor(i * step)]);
    }
    return out;
  }

  /** Map smoothed source density to pseudo-dBZ (5–50), max density → 50 dBZ. */
  function densityToDbz(density, refMax) {
    if (density <= 0 || refMax <= 0) return DBZ_FLOOR - 1;
    const norm = Math.min(1, density / refMax);
    const eased = Math.pow(norm, 0.82);
    return DBZ_MIN + (DBZ_MAX - DBZ_MIN) * eased;
  }

  function blurGrid(grid, size, passes) {
    const tmp = new Float32Array(grid.length);
    const w = [1, 2, 1];
    const norm = 4;
    for (let p = 0; p < passes; p++) {
      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          let sum = 0;
          for (let di = -1; di <= 1; di++) {
            const ni = Math.min(size - 1, Math.max(0, i + di));
            sum += grid[j * size + ni] * w[di + 1];
          }
          tmp[j * size + i] = sum / norm;
        }
      }
      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          let sum = 0;
          for (let dj = -1; dj <= 1; dj++) {
            const nj = Math.min(size - 1, Math.max(0, j + dj));
            sum += tmp[nj * size + i] * w[dj + 1];
          }
          grid[j * size + i] = sum / norm;
        }
      }
    }
  }

  function buildReflectivityGrid(strikes, nw, se) {
    const grid = new Float32Array(GRID_SIZE * GRID_SIZE);
    const latSpan = nw.lat - se.lat;
    const lngSpan = se.lng - nw.lng;
    if (latSpan === 0 || lngSpan === 0) return { grid, refMax: 0 };

    const sigma2 = BLUR_SIGMA_KM * BLUR_SIGMA_KM;
    const cellLatKm = Math.abs(latSpan) * 111.32 / GRID_SIZE;
    const cellLngKm = Math.abs(lngSpan) * 111.32 * Math.cos(ORIGIN_LAT_RAD) / GRID_SIZE;
    const cellKm = Math.max(cellLatKm, cellLngKm, 0.5);
    const radius = Math.ceil((BLUR_SIGMA_KM * 3) / cellKm);

    sampleStrikes(strikes, STRIKE_SAMPLE_MAX).forEach((s) => {
      const { xKm, yKm } = latLngToKm(s.lat, s.lng);
      const gx = ((s.lng - nw.lng) / lngSpan) * (GRID_SIZE - 1);
      const gy = ((nw.lat - s.lat) / latSpan) * (GRID_SIZE - 1);
      const i0 = Math.max(0, Math.floor(gx - radius));
      const i1 = Math.min(GRID_SIZE - 1, Math.ceil(gx + radius));
      const j0 = Math.max(0, Math.floor(gy - radius));
      const j1 = Math.min(GRID_SIZE - 1, Math.ceil(gy + radius));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const cellLng = nw.lng + (i / (GRID_SIZE - 1)) * lngSpan;
          const cellLat = nw.lat - (j / (GRID_SIZE - 1)) * latSpan;
          const cellKmPt = latLngToKm(cellLat, cellLng);
          const dx = cellKmPt.xKm - xKm;
          const dy = cellKmPt.yKm - yKm;
          grid[j * GRID_SIZE + i] += s.weight * Math.exp(-(dx * dx + dy * dy) / (2 * sigma2));
        }
      }
    });

    let refMax = 0;
    for (let k = 0; k < grid.length; k++) {
      if (grid[k] > refMax) refMax = grid[k];
    }
    if (refMax > 0) blurGrid(grid, GRID_SIZE, GRID_BLUR_PASSES);
    return { grid, refMax };
  }

  const LightningRadarLayer = L.Layer.extend({
    initialize(options) {
      L.setOptions(this, options);
      this._playing = true;
      this._frameIdx = 0;
      this._frameTimer = null;
      this._observedCount = 0;
      this._allStrikes = null;
    },

    onAdd(map) {
      this._map = map;
      if (!map.getPane('lfRadar')) map.createPane('lfRadar');
      const pane = map.getPane('lfRadar');
      pane.style.zIndex = 450;
      pane.style.pointerEvents = 'none';
      this._canvas = L.DomUtil.create('canvas', 'leaflet-lightning-radar-canvas');
      pane.appendChild(this._canvas);
      this._ctx = this._canvas.getContext('2d', { alpha: true });
      map.on('moveend zoomend resize', this._reset, this);
      this._reset();
      this._startFrameLoop();
    },

    onRemove(map) {
      this._stopFrameLoop();
      map.off('moveend zoomend resize', this._reset, this);
      L.DomUtil.remove(this._canvas);
    },

    getEvents() {
      return { zoomanim: this._animateZoom };
    },

    _animateZoom(e) {
      const scale = this._map.getZoomScale(e.zoom);
      const offset = this._map._latLngToLayerPoint(e.center).subtract(
        this._map._latLngToLayerPoint(this._map.getBounds().getCenter())
      );
      L.DomUtil.setTransform(this._canvas, offset, scale);
    },

    _reset() {
      const size = this._map.getSize();
      const dpr = window.devicePixelRatio || 1;
      this._dpr = dpr;
      this._canvas.width = Math.floor(size.x * dpr);
      this._canvas.height = Math.floor(size.y * dpr);
      this._canvas.style.width = size.x + 'px';
      this._canvas.style.height = size.y + 'px';
      L.DomUtil.setTransform(this._canvas, new L.Point(0, 0), 1);
      this._topLeft = this._map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(this._canvas, this._topLeft);
      this._draw();
    },

    setFrames(playback, strikes) {
      this._observedCount = playback.observed.length;
      this._frames = playback.all || [];
      this._allStrikes = strikes;
      this._frameIdx = 0;
      this._draw();
      if (this.options.onFrameChange) {
        this.options.onFrameChange(this._frames[this._frameIdx], this._frameIdx, this);
      }
    },

    refreshNowcast() {
      if (!this._allStrikes) return;
      const playback = buildPlaybackFrames(this._allStrikes);
      this._observedCount = playback.observed.length;
      this._frames = playback.all;
    },

    setPlaying(playing) {
      this._playing = !!playing;
      if (this._playing) this._startFrameLoop();
      else this._stopFrameLoop();
    },

    _advanceFrame() {
      if (!this._frames || !this._frames.length) return;
      if (this._frameIdx >= this._frames.length - 1) {
        this.refreshNowcast();
        this._frameIdx = 0;
      } else {
        this._frameIdx += 1;
      }
      if (this.options.onFrameChange) {
        this.options.onFrameChange(this._frames[this._frameIdx], this._frameIdx, this);
      }
      this._draw();
    },

    _startFrameLoop() {
      this._stopFrameLoop();
      if (!this._playing) return;
      this._frameTimer = setInterval(() => this._advanceFrame(), FRAME_ADVANCE_MS);
    },

    _stopFrameLoop() {
      if (this._frameTimer) {
        clearInterval(this._frameTimer);
        this._frameTimer = null;
      }
    },

    stepFrame() {
      this._advanceFrame();
    },

    goToFrame(idx) {
      if (!this._frames || !this._frames.length) return;
      this._frameIdx = Math.max(0, Math.min(this._frames.length - 1, idx));
      if (this.options.onFrameChange) {
        this.options.onFrameChange(this._frames[this._frameIdx], this._frameIdx, this);
      }
      this._draw();
    },

    _draw() {
      if (!this._ctx || !this._frames || !this._frames.length) return;
      const ctx = this._ctx;
      const w = this._canvas.width;
      const h = this._canvas.height;
      const dpr = this._dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const frame = this._frames[this._frameIdx];
      const bounds = this._map.getBounds();
      const nw = bounds.getNorthWest();
      const se = bounds.getSouthEast();
      const isNowcast = !!frame.isNowcast;
      const drawStrikes = strikesForDraw(frame);

      this._drawReflectivityField(ctx, dpr, nw, se, drawStrikes, isNowcast);
      if (isNowcast) this._drawNowcastHint(ctx, w, h, dpr, frame);
    },

    _drawReflectivityField(ctx, dpr, nw, se, strikes, isNowcast) {
      const { grid, refMax } = buildReflectivityGrid(strikes, nw, se);
      if (refMax <= 0) return;

      const alphaScale = isNowcast ? 0.76 : 1;
      const small = document.createElement('canvas');
      small.width = GRID_SIZE;
      small.height = GRID_SIZE;
      const sctx = small.getContext('2d');
      const img = sctx.createImageData(GRID_SIZE, GRID_SIZE);
      const data = img.data;

      for (let j = 0; j < GRID_SIZE; j++) {
        for (let i = 0; i < GRID_SIZE; i++) {
          const density = grid[j * GRID_SIZE + i];
          const dbz = densityToDbz(density, refMax);
          const rgba = dbzToRgba(dbz);
          const p = (j * GRID_SIZE + i) * 4;
          let r = rgba[0];
          let g = rgba[1];
          let b = rgba[2];
          if (isNowcast) {
            r = Math.round(r * 0.88 + 36 * 0.12);
            g = Math.round(g * 0.88 + 18 * 0.12);
            b = Math.round(b * 0.88 + 72 * 0.12);
          }
          data[p] = r;
          data[p + 1] = g;
          data[p + 2] = b;
          data[p + 3] = Math.round(rgba[3] * alphaScale * 255);
        }
      }
      sctx.putImageData(img, 0, 0);

      const nwPt = this._map.latLngToContainerPoint(nw);
      const sePt = this._map.latLngToContainerPoint(se);
      ctx.imageSmoothingEnabled = true;
      if (ctx.imageSmoothingQuality) ctx.imageSmoothingQuality = 'high';
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(
        small,
        nwPt.x * dpr,
        nwPt.y * dpr,
        (sePt.x - nwPt.x) * dpr,
        (sePt.y - nwPt.y) * dpr
      );
    },

    _drawNowcastHint(ctx, w, h, dpr, frame) {
      const lead = frame.nowcastLeadMin || FRAME_MINUTES;
      const pad = 10 * dpr;
      const text = 'Mock nowcast · +' + lead + ' min';
      ctx.font = '600 ' + 11 * dpr + 'px "DM Sans", sans-serif';
      const tw = ctx.measureText(text).width;
      const bx = w - tw - pad * 2 - 8 * dpr;
      const by = h - pad - 20 * dpr;
      const bw = tw + pad * 2;
      const bh = 20 * dpr;
      ctx.fillStyle = 'rgba(88, 28, 135, 0.88)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = 'rgba(216, 180, 254, 0.65)';
      ctx.lineWidth = 1 * dpr;
      ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      ctx.fillStyle = '#f3e8ff';
      ctx.fillText(text, bx + pad, by + 14 * dpr);
    },
  });

  function formatTimelineClock(ms) {
    return new Date(ms).toISOString().slice(11, 16);
  }

  const RadarTimelineControl = L.Control.extend({
    options: {
      position: 'bottomleft',
    },

    initialize(playback, callbacks) {
      this._playback = playback;
      this._callbacks = callbacks;
      this._total = (playback.all || []).length;
      this._obsCount = playback.observed.length;
    },

    onAdd(map) {
      this._map = map;
      const playback = this._playback;
      const all = playback.all || [];
      const obsCount = playback.observed.length;
      const total = all.length;
      if (!total) return L.DomUtil.create('div');

      const startMs = all[0].startMs;
      const endMs = all[all.length - 1].endMs;
      const livePct = (obsCount / total) * 100;

      const root = L.DomUtil.create(
        'div',
        'leaflet-control leaflet-control-radar-timeline tnb-radar-timeline'
      );
      root.setAttribute('role', 'group');
      root.setAttribute('aria-label', 'Radar playback timeline');
      root.innerHTML =
        '<button type="button" class="tnb-radar-timeline-play" aria-label="Pause playback" aria-pressed="true">' +
        '<svg class="icon-pause" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>' +
        '<svg class="icon-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>' +
        '</button>' +
        '<div class="tnb-radar-timeline-main">' +
        '<div class="tnb-radar-timeline-track-wrap">' +
        '<div class="tnb-radar-timeline-track">' +
        '<div class="tnb-radar-timeline-segment tnb-radar-timeline-segment--live" style="width:' +
        livePct +
        '%"></div>' +
        '<div class="tnb-radar-timeline-segment tnb-radar-timeline-segment--nowcast" style="width:' +
        (100 - livePct) +
        '%"></div>' +
        '<div class="tnb-radar-timeline-boundary" style="left:' +
        livePct +
        '%"><span>LIVE</span></div>' +
        '<div class="tnb-radar-timeline-ticks"></div>' +
        '<div class="tnb-radar-timeline-playhead"><span class="tnb-radar-timeline-playhead-knob"></span></div>' +
        '</div></div>' +
        '<div class="tnb-radar-timeline-meta">' +
        '<span class="tnb-radar-timeline-range-start">' +
        formatTimelineClock(startMs) +
        '</span>' +
        '<span class="tnb-radar-timeline-current">—</span>' +
        '<span class="tnb-radar-timeline-range-end">' +
        formatTimelineClock(endMs) +
        ' UTC</span>' +
        '</div></div>';

      const ticksEl = root.querySelector('.tnb-radar-timeline-ticks');
      all.forEach((frame, i) => {
        const tick = document.createElement('span');
        tick.className =
          'tnb-radar-timeline-tick' +
          (frame.isNowcast ? ' is-nowcast' : ' is-live') +
          (i === obsCount - 1 ? ' is-boundary' : '');
        tick.style.left = ((i + 0.5) / total) * 100 + '%';
        tick.setAttribute('aria-hidden', 'true');
        ticksEl.appendChild(tick);
      });

      const track = root.querySelector('.tnb-radar-timeline-track');
      const playBtn = root.querySelector('.tnb-radar-timeline-play');
      const callbacks = this._callbacks;

      playBtn.addEventListener('click', (e) => {
        L.DomEvent.stop(e);
        callbacks.onPlayToggle?.();
      });

      const frameFromClientX = (clientX) => {
        const rect = track.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.min(total - 1, Math.max(0, Math.floor(ratio * total)));
      };

      const scrubTo = (clientX) => {
        callbacks.onScrub?.(frameFromClientX(clientX));
      };

      track.addEventListener('click', (e) => {
        L.DomEvent.stop(e);
        scrubTo(e.clientX);
      });

      let dragging = false;
      track.addEventListener('pointerdown', (e) => {
        dragging = true;
        track.setPointerCapture(e.pointerId);
        root.classList.add('is-scrubbing');
        scrubTo(e.clientX);
      });
      track.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        scrubTo(e.clientX);
      });
      const endDrag = () => {
        dragging = false;
        root.classList.remove('is-scrubbing');
      };
      track.addEventListener('pointerup', endDrag);
      track.addEventListener('pointercancel', endDrag);

      L.DomEvent.disableClickPropagation(root);
      L.DomEvent.disableScrollPropagation(root);

      this._ui = {
        root,
        playBtn,
        playhead: root.querySelector('.tnb-radar-timeline-playhead'),
        currentEl: root.querySelector('.tnb-radar-timeline-current'),
        total,
        obsCount,
      };

      return root;
    },

    getUi() {
      return this._ui || null;
    },
  });

  function addRadarTimelineControl(map, playback, callbacks) {
    if (map._radarTimelineControl) {
      return map._radarTimelineControl.getUi();
    }
    const control = new RadarTimelineControl(playback, callbacks);
    control.addTo(map);
    map._radarTimelineControl = control;
    return control.getUi();
  }

  function updateRadarTimeline(timeline, idx, frame, playing) {
    if (!timeline || !timeline.root) return;
    const pct = ((idx + 0.5) / timeline.total) * 100;
    timeline.playhead.style.left = pct + '%';
    timeline.root.classList.toggle('is-nowcast', !!frame?.isNowcast);
    timeline.root.classList.toggle('is-live', frame && !frame.isNowcast);
    timeline.playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    timeline.playBtn.setAttribute('aria-label', playing ? 'Pause playback' : 'Play playback');

    if (timeline.currentEl && frame) {
      const times = displayTimesForFrame(frame);
      const clock = formatTimelineClock(times.endMs);
      if (times.isNowcast) {
        timeline.currentEl.textContent = clock + ' UTC · NOWCAST +' + times.leadMin + ' min';
      } else {
        timeline.currentEl.textContent = clock + ' UTC · LIVE';
      }
    }
  }

  function radarControl(mapEl, suffix) {
    const prefix = mapEl.dataset.lightningRadarPrefix || 'ps-industry';
    const id = prefix + '-' + suffix;
    const panel = mapEl.closest('.tnb-map-panel');
    if (panel) {
      const el = panel.querySelector('#' + id);
      if (el) return el;
    }
    return document.getElementById(id);
  }

  async function loadFlashes() {
    const loader = window.RTL3DFlashLoader;
    if (loader) return loader.loadAllFlashEntries();
    if (window.LF_DATA && window.LF_DATA.flashes) return window.LF_DATA.flashes;
    const response = await fetch('data/lf/flashes.json', { cache: 'force-cache' });
    if (!response.ok) throw new Error('Lightning data unavailable');
    const payload = await response.json();
    return payload.flashes || [];
  }

  function initLightningRadarLayer(map, mapEl) {
    const statusEl = radarControl(mapEl, 'radar-status');
    const timeEl = radarControl(mapEl, 'radar-time');
    const frameEl = radarControl(mapEl, 'radar-frame');
    const playBtn = radarControl(mapEl, 'radar-play');
    const showCheckbox = radarControl(mapEl, 'radar-show');

    let radarLayer = null;
    let playback = null;
    let playing = true;
    let timeline = null;

    function setStatus(msg, isError) {
      if (!statusEl) return;
      statusEl.textContent = msg || '';
      statusEl.classList.toggle('is-error', !!isError);
    }

    function updateFrameLabel(frame, idx, layer) {
      if (!frame || !layer) return;
      const allFrames = layer._frames || [];
      const times = displayTimesForFrame(frame);
      const range = formatUtcRange(times.startMs, times.endMs);
      if (timeEl) timeEl.textContent = range;
      if (frameEl && allFrames.length) {
        const obsCount = layer._observedCount;
        let tag = times.isNowcast ? 'nowcast' : 'live';
        frameEl.textContent =
          tag +
          ' · ' +
          (idx + 1) +
          ' / ' +
          allFrames.length +
          ' (' +
          obsCount +
          ' live + ' +
          (allFrames.length - obsCount) +
          ' nowcast)';
      }
      updateRadarTimeline(timeline, idx, frame, playing);
    }

    function applyVisibility() {
      const want = showCheckbox ? showCheckbox.checked : true;
      if (!radarLayer) return;
      if (want && !map.hasLayer(radarLayer)) map.addLayer(radarLayer);
      else if (!want && map.hasLayer(radarLayer)) map.removeLayer(radarLayer);
    }

    function setPlaying(next) {
      playing = next;
      if (radarLayer) radarLayer.setPlaying(playing);
      if (playBtn) {
        playBtn.textContent = playing ? 'Pause' : 'Play';
        playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      }
      if (timeline && radarLayer) {
        const frame = radarLayer._frames?.[radarLayer._frameIdx];
        updateRadarTimeline(timeline, radarLayer._frameIdx, frame, playing);
      }
    }

    loadFlashes()
      .then((flashes) => {
        if (!flashes.length) {
          setStatus('No lightning events in dataset.', true);
          return;
        }
        const strikes = buildStrikeCatalog(flashes);
        playback = buildPlaybackFrames(strikes);
        if (!playback.all.length) {
          setStatus('No lightning volumes could be built.', true);
          return;
        }

        radarLayer = new LightningRadarLayer({ onFrameChange: updateFrameLabel });
        radarLayer.setFrames(playback, strikes);
        radarLayer.setPlaying(playing);
        applyVisibility();
        mapEl._lightningRadarLayer = radarLayer;

        timeline = addRadarTimelineControl(map, playback, {
          onPlayToggle: () => setPlaying(!playing),
          onScrub: (idx) => radarLayer.goToFrame(idx),
        });
        updateRadarTimeline(
          timeline,
          radarLayer._frameIdx,
          radarLayer._frames[radarLayer._frameIdx],
          playing
        );

        setStatus(
          playback.observed.length +
            ' live volumes (5 min, mock ~1 hr feed) + ' +
            playback.nowcast.length +
            ' nowcast steps (+5–+' +
            NOWCAST_LEAD_MAX_MIN +
            ' min from last volume) · 5–' +
            DBZ_MAX +
            ' dBZ.'
        );
      })
      .catch((err) => {
        console.warn('Lightning radar:', err);
        setStatus('Could not load lightning data.', true);
      });

    if (showCheckbox) showCheckbox.addEventListener('change', applyVisibility);
    if (playBtn) playBtn.addEventListener('click', () => setPlaying(!playing));
  }

  window.initLightningRadarLayer = initLightningRadarLayer;
})();
