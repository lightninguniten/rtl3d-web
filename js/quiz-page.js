(function () {
  'use strict';

  var QUESTIONS = [
    {
      q: 'You are outside when you see lightning. How long should you wait after the LAST thunder before it is safe to go back outside?',
      opts: ['5 minutes', '15 minutes', '30 minutes', '1 hour'],
      ans: 2,
      explain: 'The 30-30 rule: wait at least 30 minutes after the last thunder clap before resuming outdoor activities. Lightning can strike far from the storm centre.'
    },
    {
      q: 'Which of the following is the SAFEST place to shelter during a thunderstorm?',
      opts: ['Under a tall tree', 'Inside a fully enclosed building or hard-top vehicle', 'In an open field, crouching low', 'Near a metal fence'],
      ans: 1,
      explain: 'A fully enclosed building with plumbing and wiring acts as a Faraday cage, safely conducting lightning to the ground. Avoid trees, open areas, and metal structures.'
    },
    {
      q: 'What is the "Flash-to-Bang" method used for?',
      opts: ['Measuring rainfall intensity', 'Estimating how far away a lightning strike is', 'Counting how many strikes have occurred', 'Predicting where the next strike will land'],
      ans: 1,
      explain: 'Count the seconds between the lightning flash and the thunder, then divide by 3 to get the distance in kilometres (or divide by 5 for miles). Under 30 seconds means seek shelter immediately.'
    },
    {
      q: 'Lightning can travel through which of the following inside a building?',
      opts: ['Wooden furniture', 'Plumbing and water pipes', 'Thick curtains', 'Carpet flooring'],
      ans: 1,
      explain: 'Lightning can travel through plumbing, water pipes, and electrical wiring. Avoid showering, washing dishes, or using corded devices during a thunderstorm.'
    },
    {
      q: 'Which of these activities is DANGEROUS during a lightning storm?',
      opts: ['Sitting in a car with windows up', 'Playing golf or holding an umbrella outdoors', 'Watching from inside a house', 'Talking on a mobile phone indoors'],
      ans: 1,
      explain: 'Golf clubs, fishing rods, umbrellas, and similar objects extend your height and attract lightning. Never hold objects above your head in a storm. Talking on a mobile phone outdoors is also dangerous — indoors is fine.'
    },
    {
      q: 'What does the RTL3D project stand for?',
      opts: ['Radar Tracking of Lightning in 3 Dimensions', 'Real-Time Lightning 3D Imaging & Forecasting', 'Remote Thunder-Locator Device', 'Radiated Thunder and Lightning Detection'],
      ans: 1,
      explain: 'RTL3D is a Malaysia–Japan SATREPS research project focused on Real-Time Lightning 3D Imaging and Forecasting to protect lives and power infrastructure.'
    },
    {
      q: 'On average, how many lightning flashes strike the Earth every second?',
      opts: ['About 10', 'About 45', 'About 100', 'About 500'],
      ans: 2,
      explain: 'Earth experiences roughly 100 lightning flashes every second — about 8 million per day. Malaysia sits near the equator and is one of the most lightning-prone countries on Earth: the Klang Valley (around Subang Jaya) gets about 240 thunderstorm days a year.'
    },
    {
      q: 'You are caught outdoors when a storm hits. What is the BEST thing to do?',
      opts: ['Crouch low on the balls of your feet and wait it out', 'Lie flat on the ground', 'Get inside a building or hard-top vehicle as fast as safely possible', 'Shelter under the nearest tall tree'],
      ans: 2,
      explain: 'There is NO safe place outdoors in a storm. Modern advice (NWS) is simply: "When thunder roars, go indoors." Head for a fully enclosed building or a hard-top car. The old "lightning crouch" was dropped in 2008 — it does not protect you. If you are stuck outside, keep moving toward shelter and avoid hilltops, open fields, water and isolated trees.'
    },
    {
      q: 'Which sensor type does the RTL3D network use to image lightning channels in 3D?',
      opts: ['Infrared cameras only', 'LF (Low Frequency) and VHF (Very High Frequency) antennas', 'Doppler radar only', 'Laser rangefinders'],
      ans: 1,
      explain: 'RTL3D uses a network of LF and VHF radio receivers spread across multiple sites. LF sensors detect return strokes; VHF sensors map the full channel development in 3D.'
    },
    {
      q: 'A lightning bolt can heat the air around it to approximately how hot?',
      opts: ['1,000 °C (hotter than boiling water)', '5,000 °C (same as the Sun\'s surface)', '30,000 °C (five times hotter than the Sun\'s surface)', '100 °C (same as boiling water)'],
      ans: 2,
      explain: 'A lightning channel heats the surrounding air to around 30,000 °C — roughly five times the temperature of the Sun\'s surface. This rapid heating causes the explosive expansion we hear as thunder.'
    },
    {
      q: 'About how many thunderstorm days does the Klang Valley (around Subang Jaya) experience each year?',
      opts: ['About 30 days', 'About 90 days', 'About 240 days', 'About 365 days'],
      ans: 2,
      explain: 'The Klang Valley records roughly 240 thunderstorm days a year, making Subang Jaya one of the most lightning-prone towns in the world. (The global record for flash density belongs to Lake Maracaibo, Venezuela — but Malaysia is firmly among the top hotspots.)'
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

  function render() {
    var q = QUESTIONS[state.current];
    el('quiz-progress').textContent = 'Question ' + (state.current + 1) + ' of ' + QUESTIONS.length;
    el('quiz-progress-bar-fill').style.width = (((state.current) / QUESTIONS.length) * 100) + '%';
    var scoreLive = el('quiz-score-live');
    if (scoreLive) scoreLive.textContent = 'Score: ' + state.score;
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
      nextBtn.textContent = (state.current + 1 < QUESTIONS.length) ? 'Next question →' : 'See results →';
    } else {
      nextBtn.hidden = true;
    }
  }

  function answer(i) {
    if (state.answered) return;
    state.answered = true;
    state.userAns = i;
    if (i === QUESTIONS[state.current].ans) state.score++;
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

  function showResult() {
    state.finished = true;
    var pct = Math.round((state.score / QUESTIONS.length) * 100);
    var grade, msg;
    if (pct === 100) {
      grade = 'Lightning Expert!';
      msg = 'Perfect score — you are ready to weather any storm!';
    } else if (pct >= 70) {
      grade = 'Storm-Smart';
      msg = 'Great job! Review the questions you missed to stay safe.';
    } else if (pct >= 40) {
      grade = 'Learning the Ropes';
      msg = 'Good effort! Lightning safety is serious — keep practising.';
    } else {
      grade = 'Stay Indoors!';
      msg = 'Lightning is dangerous — please review the safety tips and try again.';
    }

    el('quiz-body').hidden = true;
    var res = el('quiz-result');
    res.hidden = false;
    el('quiz-result-score').textContent = state.score + ' / ' + QUESTIONS.length;
    el('quiz-result-pct').textContent = pct + '%';
    el('quiz-result-grade').textContent = grade;
    el('quiz-result-msg').textContent = msg;
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
      if (saveEl) saveEl.textContent = 'Result saved on this device.';
      return;
    }

    if (saveEl) saveEl.textContent = 'Saving your result…';
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
      if (saveEl) saveEl.textContent = '✓ Result saved.';
    }).catch(function () {
      if (saveEl) saveEl.textContent = 'Saved on this device (could not reach the server).';
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

  window.RTL3D_QUIZ = { exportCsv: exportCsv };
})();
