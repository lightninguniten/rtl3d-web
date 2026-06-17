(function () {
  'use strict';

  var CARTESIAN = 'js/vendor/plotly-cartesian-2.35.2.min.js';
  var FULL = 'js/vendor/plotly-2.35.2.min.js';
  var cartesianPromise = null;
  var fullPromise = null;
  var fullDirectPromise = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.defer = true;
      s.onload = function () { resolve(window.Plotly); };
      s.onerror = function () { reject(new Error('Failed to load Plotly: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function waitForCartesian() {
    if (window.Plotly) return Promise.resolve(window.Plotly);
    var el = document.querySelector('script[src*="plotly-cartesian"]');
    if (el) {
      return new Promise(function (resolve, reject) {
        function done() {
          if (window.Plotly) resolve(window.Plotly);
          else reject(new Error('Plotly cartesian loaded without Plotly global'));
        }
        if (el.getAttribute('data-loaded') === '1') return done();
        el.addEventListener('load', function () {
          el.setAttribute('data-loaded', '1');
          done();
        });
        el.addEventListener('error', function () {
          reject(new Error('Failed to load Plotly cartesian'));
        });
      });
    }
    return loadScript(CARTESIAN);
  }

  /** 2D plots (scatter, bar, …) — ~1.3 MB vs ~4.4 MB full bundle. */
  window.ensurePlotly2d = function () {
    if (window.Plotly) return Promise.resolve(window.Plotly);
    if (!cartesianPromise) cartesianPromise = waitForCartesian();
    return cartesianPromise;
  };

  function waitForFullPlotly() {
    if (window.Plotly) {
      window.__RTL3D_PLOTLY_FULL = true;
      return Promise.resolve(window.Plotly);
    }
    var el = document.querySelector('script[src*="plotly-2.35.2.min.js"]');
    if (el) {
      return new Promise(function (resolve, reject) {
        function done() {
          if (window.Plotly) {
            window.__RTL3D_PLOTLY_FULL = true;
            resolve(window.Plotly);
          } else {
            reject(new Error('Plotly full bundle loaded without Plotly global'));
          }
        }
        if (el.getAttribute('data-loaded') === '1') return done();
        el.addEventListener('load', function () {
          el.setAttribute('data-loaded', '1');
          done();
        });
        el.addEventListener('error', function () {
          reject(new Error('Failed to load Plotly full bundle'));
        });
      });
    }
    return loadScript(FULL).then(function (plotly) {
      window.__RTL3D_PLOTLY_FULL = true;
      return plotly;
    });
  }

  /** Full Plotly in one load — LF page always needs 3D on init. */
  window.ensurePlotlyFull = function () {
    if (window.__RTL3D_PLOTLY_FULL && window.Plotly) return Promise.resolve(window.Plotly);
    if (!fullDirectPromise) fullDirectPromise = waitForFullPlotly();
    return fullDirectPromise;
  };

  /** 3D scatter — loads full Plotly on first use (never double-injects the bundle). */
  window.ensurePlotly3d = function () {
    if (window.__RTL3D_PLOTLY_FULL && window.Plotly) return Promise.resolve(window.Plotly);
    if (!fullPromise) fullPromise = waitForFullPlotly();
    return fullPromise;
  };

  var page = document.body && document.body.getAttribute('data-page');
  if (page === 'lf') {
    window.ensurePlotlyFull();
  } else if (page === 'vhf') {
    window.ensurePlotly2d();
  }
})();
