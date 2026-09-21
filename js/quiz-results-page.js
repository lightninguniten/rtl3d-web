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

  // The Sheet answers with a head row plus plain arrays, so the local copy is
  // reshaped the same way and both paths render through one function.
  var LOCAL_HEAD = ['Timestamp', 'Name', 'School/University', 'Score', 'Total', 'Percent'];
  var LOCAL_KEYS = ['timestamp', 'name', 'school', 'score', 'total', 'percent'];

  function localTable(all) {
    var extra = [];
    all.forEach(function (r) {
      Object.keys(r).forEach(function (k) {
        if (/^q\d+$/.test(k) && extra.indexOf(k) < 0) extra.push(k);
      });
    });
    extra.sort(function (a, b) { return parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10); });

    var keys = LOCAL_KEYS.concat(extra);
    var head = LOCAL_HEAD.concat(extra.map(function (k) { return k.toUpperCase(); }));
    var rows = all.slice().reverse().map(function (r) {
      return keys.map(function (k) { return r[k] == null ? '' : String(r[k]); });
    });
    return { head: head, rows: rows };
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

  function renderRows(head, rows, source) {
    var thead = el('quiz-results-head-row');
    var tbody = el('quiz-results-body');
    var meta = el('quiz-results-meta');
    if (!tbody) return;

    var cols = (head && head.length) ? head : LOCAL_HEAD;
    if (thead) {
      thead.innerHTML = cols.map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('');
    }

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="' + cols.length + '">No submissions yet.</td></tr>';
      if (meta) meta.textContent = source ? ('Source: ' + source) : '';
      return;
    }

    tbody.innerHTML = rows.map(function (r) {
      var cells = '';
      for (var i = 0; i < cols.length; i++) cells += '<td>' + esc(r[i]) + '</td>';
      return '<tr>' + cells + '</tr>';
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
        renderRows(data.head || [], data.rows || [], 'Google Sheet');
        setSheetLink(data.sheetUrl || sheetUrlFallback());
        return;
      }

      var local = localTable(loadLocal());
      if (local.rows.length) {
        setStatus(err + ' Showing submissions saved on this device only.', true);
        renderRows(local.head, local.rows, 'this browser');
      } else {
        setStatus(err, true);
        renderRows(local.head, [], '');
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
