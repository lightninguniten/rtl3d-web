(function () {
  'use strict';

  var QUESTIONS = [
    {
      q: 'What makes lightning happen in the sky?',
      opts: ['Supernatural power', 'Ice and water drops rubbing', 'God is angry', 'Clouds bumping'],
      ans: 1,
      explain: 'Lots of tiny pieces of ice and drops of water bump and rub into each other in the cloud as they move around. This rubbing builds up static electricity — just like when you rub your socks on a carpet!'
    },
    {
      q: 'Why do some people get hit by lightning?',
      opts: ['Because they are bad luck', 'Because they wear bright clothes', 'Because they stand in open places', 'Because they have things made of iron'],
      ans: 2,
      explain: 'People are more likely to be hit by lightning when they are in open areas, where they become the tallest object nearby. Iron things do not attract lightning — lightning is so strong that it can strike anything nearby.'
    },
    {
      q: 'Does lightning strike the same place twice?',
      opts: ['Yes, it can strike the same place again', 'No, it never strikes the same place again'],
      ans: 0,
      explain: 'Lightning can strike the same place again and again. For example, one mobile phone tower was hit by lightning 7 times in just 40 minutes!'
    },
    {
      q: 'Where is the safe place to avoid lightning strikes?',
      opts: ['On a sports ground', 'Under a tree', 'In a tent on a campsite', 'Inside a house'],
      ans: 3,
      explain: 'Lightning looks for the easiest and fastest path to the ground. Being inside a house or building keeps you safe because the walls and roof protect you. Open fields, trees, and tents do not protect you — lightning can easily strike there. We are building a website and phone app to tell you where lightning strikes.'
    },
    {
      q: 'Can we change the place where lightning strikes?',
      opts: ['Yes, we can change where the lightning strikes', 'No, we cannot change where the lightning strikes'],
      ans: 0,
      explain: 'We can send a small rocket into the sky with a long wire attached to it. As the rocket flies up, the wire stretches from the ground into the clouds. Lightning likes an easy path — and the wire becomes that path, so lightning follows the wire down to the ground. We did this Rocket-Triggered Lightning for the first time in Melaka, Malaysia, in 2026!'
    }
  ];

  var state = {
    current: 0,
    score: 0,
    answered: false,
    userAns: -1,
    finished: false
  };

  function el(id) { return document.getElementById(id); }

  var LETTERS = ['A', 'B', 'C', 'D'];

  // Pull a UI string from the shared i18n dictionary, with {placeholder} fill.
  function tt(key, vars) {
    var s = (window.RTL3Di18n && window.RTL3Di18n.t(key));
    if (s == null) s = key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }

  // Return the question set for the active language, falling back to English.
  function getQuestions() {
    var lang = window.RTL3Di18n && window.RTL3Di18n.lang;
    var loc = lang && window.RTL3D_QUIZ_I18N && window.RTL3D_QUIZ_I18N[lang];
    return (loc && loc.length === QUESTIONS.length) ? loc : QUESTIONS;
  }

  function render() {
    var q = getQuestions()[state.current];
    el('quiz-progress').textContent = tt('quiz.progress', { n: state.current + 1, total: QUESTIONS.length });
    el('quiz-progress-bar-fill').style.width = (((state.current) / QUESTIONS.length) * 100) + '%';
    var scoreLive = el('quiz-score-live');
    if (scoreLive) scoreLive.textContent = tt('quiz.scoreLive', { n: state.score });
    el('quiz-question').textContent = q.q;
    var optsEl = el('quiz-options');
    optsEl.innerHTML = '';
    q.opts.forEach(function (opt, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-opt';
      btn.setAttribute('aria-label', LETTERS[i] + ': ' + opt);

      var letterEl = document.createElement('span');
      letterEl.className = 'quiz-opt-letter';
      letterEl.textContent = LETTERS[i];

      var textEl = document.createElement('span');
      textEl.textContent = opt;

      btn.appendChild(letterEl);
      btn.appendChild(textEl);

      if (state.answered) {
        if (i === q.ans) {
          btn.classList.add('quiz-opt-correct');
        } else if (i === state.userAns && i !== q.ans) {
          btn.classList.add('quiz-opt-wrong');
        }
        btn.disabled = true;
      } else {
        btn.addEventListener('click', function () { answer(i); });
      }
      optsEl.appendChild(btn);
    });

    var expEl = el('quiz-explain');
    if (state.answered) {
      expEl.textContent = q.explain;
      expEl.hidden = false;
    } else {
      expEl.hidden = true;
    }

    var nextBtn = el('quiz-next');
    if (state.answered) {
      nextBtn.hidden = false;
      nextBtn.textContent = (state.current + 1 < QUESTIONS.length) ? tt('quiz.next') : tt('quiz.seeResults');
    } else {
      nextBtn.hidden = true;
    }
  }

  function answer(i) {
    if (state.answered) return;
    state.answered = true;
    state.userAns = i;
    if (i === getQuestions()[state.current].ans) state.score++;
    render();
  }

  function next() {
    if (state.current + 1 >= QUESTIONS.length) {
      showResult();
      return;
    }
    state.current++;
    state.answered = false;
    state.userAns = -1;
    render();
  }

  function gradeKeys(pct) {
    if (pct === 100) return { grade: 'quiz.grade.expert', msg: 'quiz.msg.expert' };
    if (pct >= 70) return { grade: 'quiz.grade.smart', msg: 'quiz.msg.smart' };
    if (pct >= 40) return { grade: 'quiz.grade.learning', msg: 'quiz.msg.learning' };
    return { grade: 'quiz.grade.indoors', msg: 'quiz.msg.indoors' };
  }

  // Fill the result panel text from current state (re-runnable on lang change).
  function renderResult() {
    var pct = Math.round((state.score / QUESTIONS.length) * 100);
    var keys = gradeKeys(pct);
    el('quiz-result-score').textContent = state.score + ' / ' + QUESTIONS.length;
    el('quiz-result-pct').textContent = pct + '%';
    el('quiz-result-grade').textContent = tt(keys.grade);
    el('quiz-result-msg').textContent = tt(keys.msg);
  }

  function showResult() {
    state.finished = true;
    var pct = Math.round((state.score / QUESTIONS.length) * 100);

    el('quiz-body').hidden = true;
    el('quiz-result').hidden = false;
    renderResult();
    el('quiz-progress-bar-fill').style.width = '100%';

    submitResult(pct);
  }

  // ---- save the result (name + school + score) to the Google Sheet ------
  function submitResult(pct) {
    var saveEl = el('quiz-result-save');
    var row = {
      name: state.name || '',
      school: state.school || '',
      score: state.score,
      total: QUESTIONS.length,
      percent: pct,
      timestamp: new Date().toISOString()
    };

    // Always keep a local copy too (so nothing is ever lost on a kiosk).
    try {
      var all = JSON.parse(localStorage.getItem('rtl3d-quiz-results') || '[]');
      all.push(row);
      localStorage.setItem('rtl3d-quiz-results', JSON.stringify(all));
    } catch (_) {}

    var endpoint = window.RTL3D_QUIZ_ENDPOINT;
    if (!endpoint) {
      if (saveEl) saveEl.textContent = tt('quiz.save.local');
      return;
    }

    if (saveEl) saveEl.textContent = tt('quiz.save.saving');
    // Apps Script web-apps don't send CORS headers, so use no-cors: the POST
    // still reaches the script; we just can't read the response. URL-encoded
    // body avoids a CORS preflight.
    var body = Object.keys(row).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(row[k]);
    }).join('&');

    fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body
    }).then(function () {
      if (saveEl) saveEl.textContent = tt('quiz.save.done');
    }).catch(function () {
      if (saveEl) saveEl.textContent = tt('quiz.save.offline');
    });
  }

  // Export everything collected on this device as a CSV download.
  function exportCsv() {
    var all;
    try { all = JSON.parse(localStorage.getItem('rtl3d-quiz-results') || '[]'); }
    catch (_) { all = []; }
    var head = ['name', 'school', 'score', 'total', 'percent', 'timestamp'];
    var esc = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var lines = [head.join(',')].concat(all.map(function (r) {
      return head.map(function (k) { return esc(r[k]); }).join(',');
    }));
    var blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rtl3d-quiz-results.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function restart() {
    var name = state.name, school = state.school;
    state = { current: 0, score: 0, answered: false, userAns: -1, finished: false, name: name, school: school };
    el('quiz-result').hidden = true;
    el('quiz-body').hidden = false;
    render();
  }

  function startQuiz(name, school) {
    state.name = name;
    state.school = school;
    el('quiz-intake').hidden = true;
    el('quiz-body').hidden = false;
    render();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = el('quiz-intake');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = el('quiz-name').value.trim();
      var school = el('quiz-school').value.trim();
      var err = el('quiz-intake-error');
      if (!name || !school) { if (err) err.hidden = false; return; }
      if (err) err.hidden = true;
      startQuiz(name, school);
    });

    render();
    el('quiz-next').addEventListener('click', next);
    el('quiz-restart').addEventListener('click', restart);
  });

  // Re-render the active view when the language changes so questions, options,
  // and result text update in place.
  document.addEventListener('rtl3d:langchange', function () {
    if (state.finished) {
      renderResult();
    } else if (!el('quiz-body').hidden) {
      render();
    }
  });

  window.RTL3D_QUIZ = { exportCsv: exportCsv };
})();
