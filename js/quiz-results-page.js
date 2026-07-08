(function () {
  'use strict';

  var REFRESH_MS = 30000;

  function el(id) { return document.getElementById(id); }

  function endpoint() {
    return (window.RTL3D_QUIZ_ENDPOINT || '').trim();
  }

  function sheetUrlFallback() {
    return (window.RTL3D_QUIZ_SHEET_URL || '').trim();
  }

  function loadLocal() {
    try {
      return JSON.parse(localStorage.getItem('rtl3d-quiz-results') || '[]');
    } catch (_) {
      return [];
    }
  }

  function localToRows(all) {
    return all.slice().reverse().map(function (r) {
      return {
        timestamp: r.timestamp,
        name: r.name,
        school: r.school,
        score: r.score,
        total: r.total,
        percent: r.percent
      };
    });
  }

  function fetchRemote(cb) {
    var ep = endpoint();
    if (!ep) {
      cb(null, 'Quiz endpoint is not configured.');
      return;
    }

    var cbName = '_rtl3dQuizResults_' + Date.now();
    var timer = window.setTimeout(function () {
      cleanup();
      cb(null, 'Timed out. Redeploy Apps Script from tools/quiz-sheet.gs (needs doGet).');
    }, 15000);

    var script = document.createElement('script');

    function cleanup() {
      window.clearTimeout(timer);
      try { delete window[cbName]; } catch (_) {}
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[cbName] = function (data) {
      cleanup();
      if (data && data.ok) cb(data, null);
      else cb(null, (data && data.error) || 'Could not read quiz results.');
    };

    script.src = ep + (ep.indexOf('?') >= 0 ? '&' : '?') +
      'action=results&callback=' + encodeURIComponent(cbName);
    script.onerror = function () {
      cleanup();
      cb(null, 'Apps Script needs the latest doGet handler (tools/quiz-sheet.gs).');
    };
    document.head.appendChild(script);
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function renderRows(rows, source) {
    var tbody = el('quiz-results-body');
    var meta = el('quiz-results-meta');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="6">No submissions yet.</td></tr>';
      if (meta) meta.textContent = source ? ('Source: ' + source) : '';
      return;
    }

    tbody.innerHTML = rows.map(function (r) {
      var pct = r.percent;
      if (pct != null && String(pct).indexOf('%') < 0) pct = pct + '%';
      return '<tr><td>' + esc(r.timestamp) + '</td><td>' + esc(r.name) + '</td><td>' +
        esc(r.school) + '</td><td>' + esc(r.score) + '</td><td>' + esc(r.total) +
        '</td><td>' + esc(pct) + '</td></tr>';
    }).join('');

    if (meta) meta.textContent = rows.length + ' submission(s)' + (source ? (' · ' + source) : '');
  }

  function setSheetLink(url) {
    var a = el('quiz-results-sheet-link');
    if (!a) return;
    if (url) {
      a.href = url;
      a.hidden = false;
    } else {
      a.hidden = true;
    }
  }

  function setStatus(msg, isErr) {
    var s = el('quiz-results-status');
    if (!s) return;
    s.textContent = msg || '';
    s.classList.toggle('is-error', !!isErr);
  }

  function refresh() {
    setStatus('Loading…', false);
    fetchRemote(function (data, err) {
      if (data) {
        setStatus('Auto-refresh every ' + (REFRESH_MS / 1000) + ' seconds', false);
        renderRows(data.rows || [], 'Google Sheet');
        setSheetLink(data.sheetUrl || sheetUrlFallback());
        return;
      }

      var local = localToRows(loadLocal());
      if (local.length) {
        setStatus(err + ' Showing submissions saved on this device only.', true);
        renderRows(local, 'this browser');
      } else {
        setStatus(err, true);
        renderRows([], '');
      }
      setSheetLink(sheetUrlFallback());
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var btn = el('quiz-results-refresh');
    if (btn) btn.addEventListener('click', refresh);
    refresh();
    window.setInterval(refresh, REFRESH_MS);
  });
})();
