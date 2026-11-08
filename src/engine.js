(function () {
  'use strict';

  var Q = window.__QUIZ__;
  var stage = document.getElementById('stage');
  var state = { i: 0, picks: [] };
  var current = null;

  var el = {
    coverTitle: document.querySelector('[data-cover-title]'),
    question: document.querySelector('[data-question]'),
    options: document.querySelector('[data-options]'),
    idx: document.querySelector('[data-idx]'),
    total: document.querySelector('[data-total]'),
    bar: document.querySelector('[data-progress-bar]'),
    seal: document.querySelector('[data-seal]'),
    dossier: document.querySelector('[data-dossier]'),
    traits: document.querySelector('[data-traits]'),
    tags: document.querySelector('[data-tags]'),
    dims: document.querySelector('[data-dims]'),
    desc: document.querySelector('[data-desc]'),
    second: document.querySelector('[data-second]'),
    same: document.querySelector('[data-same]'),
    loadingText: document.querySelector('[data-loading-text]'),
    loadingLine: document.querySelector('[data-loading-line]'),
    poster: document.querySelector('[data-poster]')
  };

  var KEY_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function pad(n) { return String(n).length < 2 ? '0' + n : String(n); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function comma(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  // 主题通用：文案一律从 meta 走路径取，模板里不写死任何主题相关字样
  function getPath(obj, path) {
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function bindText(el, value) {
    el.textContent = value == null ? '' : value;
  }

  function replay(root) {
    var nodes = root.querySelectorAll('*');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n.style || getComputedStyle(n).animationName === 'none') continue;
      n.style.animation = 'none';
      void n.offsetWidth;
      n.style.animation = '';
    }
  }

  function go(name) {
    var cur = $('.screen.is-active');
    var next = $('[data-screen="' + name + '"]');
    if (cur === next) return;
    if (cur) {
      cur.classList.add('is-leaving');
      cur.classList.remove('is-active');
      setTimeout(function () { cur.classList.remove('is-leaving'); }, 420);
    }
    next.classList.add('is-active');
    replay(next);
  }

  function applyTheme(theme) {
    if (theme && theme.accent) stage.style.setProperty('--accent', theme.accent);
  }

  /* ---------- 伪递增的已测人数 ---------- */
  // 纯静态无后端，用「基数 + 天数 × 日增速」保证任何人任何时刻看到的数字单调递增
  var base = 0;
  var rate = 0;
  var total = 0;

  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  function initCount() {
    var seed = hashStr(Q.meta.slug || Q.meta.title);
    base = 9000 + (seed % 21000);
    rate = 80 + (seed % 220);
    var from = Date.parse(Q.deployedAt || Q.meta.deployedAt || '');
    if (isNaN(from)) from = Date.now();
    var days = Math.max(0, Math.floor((Date.now() - from) / 86400000));
    total = base + Math.floor(days * rate);
  }

  /* ---------- 数据自检 ---------- */
  function validate() {
    var errs = [];
    var ids = Q.types.map(function (t) { return t.id; });
    Q.questions.forEach(function (q, qi) {
      if (q.opts.length !== 4) errs.push('第 ' + (qi + 1) + ' 题选项数不是 4');
      q.opts.forEach(function (o) {
        Object.keys(o.w || {}).forEach(function (k) {
          if (ids.indexOf(k) === -1) errs.push('第 ' + (qi + 1) + ' 题引用了未知类型 ' + k);
        });
      });
    });
    if (errs.length) console.warn('[quiz] 数据问题:\n' + errs.join('\n'));
  }

  /* ---------- 封面 ---------- */
  function renderCover() {
    var meta = Q.meta;
    var lines = meta.titleLines && meta.titleLines.length ? meta.titleLines : [meta.title];
    el.coverTitle.innerHTML = lines.map(function (l) {
      return '<span>' + escapeHtml(l) + '</span>';
    }).join('');

    var binds = document.querySelectorAll('.screen--cover [data-bind]');
    for (var i = 0; i < binds.length; i++) {
      var key = binds[i].getAttribute('data-bind');
      if (key === 'hook') {
        binds[i].textContent = '已有 ' + comma(total) + ' 人完成';
      } else {
        bindText(binds[i], getPath(meta, key));
      }
    }
    document.title = meta.title;
    el.total.textContent = Q.questions.length;
    if (meta.theme) applyTheme(meta.theme);
  }

  /* ---------- 答题 ---------- */
  function renderQuestion() {
    var q = Q.questions[state.i];
    el.question.textContent = q.q;
    el.idx.textContent = pad(state.i + 1);
    el.bar.style.width = (state.i / Q.questions.length * 100) + '%';

    el.options.innerHTML = '';
    q.opts.forEach(function (o, oi) {
      var btn = document.createElement('button');
      btn.className = 'opt';
      btn.innerHTML = '<span class="opt__key">' + KEY_LABELS[oi] + '</span><span>' + escapeHtml(o.t) + '</span>';
      btn.addEventListener('click', function () { pick(oi, btn); });
      el.options.appendChild(btn);
    });
  }

  function pick(oi, btn) {
    var box = btn.parentNode;
    if (box.dataset.locked === '1') return;
    box.dataset.locked = '1';

    var all = el.options.querySelectorAll('.opt');
    for (var i = 0; i < all.length; i++) all[i].classList.add('is-dim');
    btn.classList.remove('is-dim');
    btn.classList.add('is-picked');

    state.picks[state.i] = oi;
    setTimeout(function () {
      box.dataset.locked = '0';
      if (state.i + 1 < Q.questions.length) {
        state.i++;
        renderQuestion();
      } else {
        el.bar.style.width = '100%';
        startLoading();
      }
    }, 300);
  }

  function stepBack() {
    if (state.i === 0) return;
    state.i--;
    renderQuestion();
  }

  /* ---------- 计算 ---------- */
  function compute() {
    var typeScore = {};
    var dimScore = {};
    var dimCeil = {};

    Q.dims.forEach(function (d) { dimScore[d.key] = 0; dimCeil[d.key] = 0; });

    Q.questions.forEach(function (q, qi) {
      var maxD = {};
      q.opts.forEach(function (o) {
        Object.keys(o.d || {}).forEach(function (k) {
          maxD[k] = Math.max(maxD[k] || 0, o.d[k]);
        });
      });
      Object.keys(maxD).forEach(function (k) { dimCeil[k] = (dimCeil[k] || 0) + maxD[k]; });

      var choice = q.opts[state.picks[qi]] || q.opts[0];
      Object.keys(choice.w || {}).forEach(function (k) {
        typeScore[k] = (typeScore[k] || 0) + choice.w[k];
      });
      Object.keys(choice.d || {}).forEach(function (k) {
        dimScore[k] = (dimScore[k] || 0) + choice.d[k];
      });
    });

    var ranked = Q.types.map(function (t) {
      // rarityFactor < 1 让该类型更难胜出，用于制造稀缺感
      var raw = typeScore[t.id] || 0;
      return { type: t, score: raw * (t.rarityFactor == null ? 1 : t.rarityFactor) };
    }).sort(function (a, b) { return b.score - a.score; });

    // 并列时随机，否则数组顺序会造成系统性偏置
    var top = ranked.filter(function (r) { return r.score === ranked[0].score; });
    var winner = top[Math.floor(Math.random() * top.length)].type;
    var second = ranked.filter(function (r) { return r.type.id !== winner.id; })[0];

    var dims = Q.dims.map(function (d) {
      var ceil = dimCeil[d.key] || 1;
      var pct = Math.round((0.15 + (dimScore[d.key] / ceil) * 0.85) * 100);
      return { key: d.key, label: d.label, raw: dimScore[d.key], pct: Math.min(99, pct) };
    });

    return { type: winner, second: second ? second.type : null, dims: dims };
  }

  function buildTraits(result) {
    var sorted = result.dims.slice().sort(function (a, b) { return b.raw - a.raw; });
    var maxDim = sorted[0].key;
    var minDim = sorted[sorted.length - 1].key;
    var out = [];
    if (Q.traits && Q.traits.high && Q.traits.high[maxDim]) out.push(Q.traits.high[maxDim]);
    if (Q.traits && Q.traits.low && Q.traits.low[minDim]) out.push(Q.traits.low[minDim]);
    if (result.type.misread) out.push(result.type.misread);
    return out;
  }

  function dossierNo() {
    var h = 0;
    for (var i = 0; i < state.picks.length; i++) h = (h * 33 + state.picks[i] + i) >>> 0;
    return 'No.' + (1000 + (h % 9000));
  }

  /* ---------- 加载 ---------- */
  function startLoading() {
    go('loading');
    var steps = Q.meta.loadingSteps || ['正在计算…', '比对结果…', '马上出结果…'];
    var i = 0;
    el.loadingText.textContent = steps[0];
    el.loadingLine.textContent = '';
    var timer = setInterval(function () {
      i++;
      if (i >= steps.length) {
        clearInterval(timer);
        setTimeout(showResult, 560);
        return;
      }
      el.loadingLine.textContent = steps[i];
    }, 780);
  }

  /* ---------- 结果 ---------- */
  function showResult() {
    current = compute();
    var t = current.type;
    if (t.theme) applyTheme(t.theme);

    var binds = document.querySelectorAll('.screen--result [data-bind]');
    for (var i = 0; i < binds.length; i++) {
      var key = binds[i].getAttribute('data-bind');
      if (key.indexOf('layout.') === 0) bindText(binds[i], getPath(Q.meta, key));
      else bindText(binds[i], t[key]);
    }

    // 副信息行（年代/身份等）是主题相关的，没有就整行不显示
    var eraRow = document.querySelector('.card__era');
    if (eraRow) eraRow.style.display = (!t.era && !t.role) ? 'none' : '';

    el.dossier.textContent = dossierNo();

    var pct = Q.stats && Q.stats[t.id];
    el.seal.innerHTML = '<b>' + (pct != null
      ? (Q.meta.rarityText || '全国仅 {pct}%').replace('{pct}', pct)
      : '稀缺') + '</b>';

    var traits = buildTraits(current);
    el.traits.innerHTML = traits.map(function (x) {
      return '<li>' + escapeHtml(x) + '</li>';
    }).join('');

    el.tags.innerHTML = t.tags.map(function (x) { return '<span>' + escapeHtml(x) + '</span>'; }).join('');

    el.desc.innerHTML = t.desc.map(function (p) { return '<p>' + escapeHtml(p) + '</p>'; }).join('');

    el.dims.innerHTML = current.dims.map(function (d) {
      return '<div class="dim"><span class="dim__label">' + escapeHtml(d.label) + '</span>' +
        '<span class="dim__track"><i class="dim__fill" data-w="' + d.pct + '"></i></span>' +
        '<span class="dim__val">' + d.pct + '</span></div>';
    }).join('');

    if (current.second) {
      el.second.innerHTML = '<span class="second__name">' + escapeHtml(current.second.name) + '</span>' +
        '<span class="second__title">' + escapeHtml(current.second.title) + '</span>';
    }

    // 同类型人数必须与稀有度自洽，否则眼尖的用户会发现「稀有的反而更多人」
    var sameN = pct != null ? Math.round(total * pct / 100) : 0;
    el.same.innerHTML = '和你测出同一个人的，全国大约有 <b>' + comma(sameN) + '</b> 人。';

    go('result');
    setTimeout(function () {
      var fills = el.dims.querySelectorAll('.dim__fill');
      for (var i = 0; i < fills.length; i++) fills[i].style.width = fills[i].dataset.w + '%';
    }, 240);
  }

  /* ---------- 海报 ---------- */
  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function wrapText(ctx, text, cx, y, maxW, lh) {
    var line = '';
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, y);
        line = text[i];
        y += lh;
      } else {
        line = test;
      }
    }
    if (line) { ctx.fillText(line, cx, y); return y + lh; }
    return y;
  }

  var PAPER = '#FDFCFA';
  var INK = '#1A1714';
  var INK2 = '#5C554D';
  var INK3 = '#9A9288';

  function buildPoster() {
    if (!current) return;
    var t = current.type;
    var accent = (t.theme && t.theme.accent) || '#A63A50';
    var W = 750, H = 1240, cx = W / 2;
    var c = el.poster;
    c.width = W; c.height = H;
    var x = c.getContext('2d');

    x.fillStyle = PAPER;
    x.fillRect(0, 0, W, H);

    x.strokeStyle = 'rgba(26,23,20,.1)';
    x.lineWidth = 1;
    x.strokeRect(30, 30, W - 60, H - 60);

    x.textAlign = 'center';

    var L = (Q.meta.layout && Q.meta.layout.poster) || {};

    x.fillStyle = accent;
    x.font = '500 22px "PingFang SC","Microsoft YaHei",sans-serif';
    x.fillText(L.kicker || Q.meta.kicker || '', cx, 112);

    x.fillStyle = INK3;
    x.font = '400 21px "PingFang SC","Microsoft YaHei",sans-serif';
    x.fillText(L.lead || '', cx, 196);

    x.fillStyle = INK;
    var nameSize = t.name.length > 3 ? 100 : 126;
    x.font = '700 ' + nameSize + 'px "Songti SC","SimSun",serif';
    x.fillText(t.name, cx, 322);

    x.fillStyle = INK2;
    x.font = '400 34px "Songti SC","SimSun",serif';
    x.fillText(t.title, cx, 390);

    x.fillStyle = INK3;
    x.font = '400 20px "PingFang SC","Microsoft YaHei",sans-serif';
    x.fillText(t.era + '　' + t.role, cx, 436);

    var pct = Q.stats && Q.stats[t.id];
    if (pct != null) {
      var sealTxt = '全国仅 ' + pct + '% 的人属于这一类';
      x.font = '400 21px "PingFang SC","Microsoft YaHei",sans-serif';
      var sw = x.measureText(sealTxt).width + 52;
      x.strokeStyle = accent;
      x.lineWidth = 1.4;
      x.strokeRect(cx - sw / 2, 474, sw, 54);
      x.fillStyle = accent;
      x.fillText(sealTxt, cx, 509);
    }

    x.fillStyle = INK;
    x.font = '400 30px "Songti SC","SimSun",serif';
    wrapText(x, '「' + t.quote + '」', cx, 620, W - 200, 52);

    var traitY = 716;
    var traits = buildTraits(current).slice(0, 3);
    traits.forEach(function (txt, i) {
      var y = traitY + i * 78;
      x.strokeStyle = accent;
      x.lineWidth = 1.4;
      x.beginPath();
      x.moveTo(110, y - 8);
      x.lineTo(132, y - 8);
      x.stroke();

      x.textAlign = 'left';
      x.fillStyle = INK2;
      x.font = '400 22px "PingFang SC","Microsoft YaHei",sans-serif';
      var end = wrapText(x, txt, 146, y, W - 260, 38);
      x.textAlign = 'center';
      traitY = Math.max(traitY, end - 78);
    });

    var barY = 1018;
    var barW = W - 300;
    var barX = 220;
    current.dims.forEach(function (d, i) {
      var y = barY + i * 44;
      x.textAlign = 'left';
      x.fillStyle = INK3;
      x.font = '400 20px "Songti SC","SimSun",serif';
      x.fillText(d.label, 110, y + 7);

      x.fillStyle = 'rgba(26,23,20,.08)';
      x.fillRect(barX, y, barW, 4);
      x.fillStyle = accent;
      x.fillRect(barX, y, barW * (d.pct / 100), 4);

      x.textAlign = 'right';
      x.fillStyle = INK3;
      x.font = '400 19px "Songti SC","SimSun",serif';
      x.fillText(d.pct, W - 110, y + 7);
      x.textAlign = 'center';
    });

    x.strokeStyle = 'rgba(26,23,20,.12)';
    x.beginPath(); x.moveTo(110, 1150); x.lineTo(W - 110, 1150); x.stroke();

    x.fillStyle = INK2;
    x.font = '400 22px "PingFang SC","Microsoft YaHei",sans-serif';
    x.fillText(L.title || (Q.meta.title + '？'), cx, 1192);
    x.fillStyle = INK3;
    x.font = '400 18px "PingFang SC","Microsoft YaHei",sans-serif';
    x.fillText(L.foot || '', cx, 1224);

    go('poster');
  }

  /* ---------- 启动 ---------- */
  function reset() {
    state = { i: 0, picks: [] };
    applyTheme(Q.meta.theme);
    renderCover();
    renderQuestion();
    go('cover');
  }

  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    if (act === 'start') { state.i = 0; state.picks = []; renderQuestion(); go('quiz'); }
    else if (act === 'back') stepBack();
    else if (act === 'restart') { reset(); }
    else if (act === 'poster') buildPoster();
    else if (act === 'back-result') go('result');
  });

  initCount();
  validate();
  reset();
})();
