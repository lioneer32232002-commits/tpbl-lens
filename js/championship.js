/* championship.js — 夢想家冠軍戰分析頁 */
(function () {
  'use strict';

  var DATA_URL = '/data/championship_2526.json';
  var D = null;          // full data
  var currentOpp = null; // 'kings' | 'leopards'
  var effChart = null;

  /* ── 載入資料 ── */
  fetch(DATA_URL)
    .then(function (r) { return r.json(); })
    .then(function (d) {
      D = d;
      var initial = d.active_opponent || 'kings';
      setOpp(initial);
      bindToggle();
    })
    .catch(function (e) { console.error('Championship data load failed', e); });

  /* ── 對手切換按鈕 ── */
  function bindToggle() {
    document.querySelectorAll('.opp-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setOpp(btn.dataset.opp); });
    });
  }

  function setOpp(oppKey) {
    currentOpp = oppKey;
    var opp = D[oppKey];

    // CSS 變數 —— 對手顏色
    var oppColor = opp.color;
    var root = document.documentElement;
    root.style.setProperty('--opp-color', oppColor);
    var rgb = hexToRgb(oppColor);
    root.style.setProperty('--opp-rgb', rgb);

    // 按鈕狀態
    document.querySelectorAll('.opp-btn').forEach(function (b) {
      b.classList.remove('active', 'pending');
      b.classList.add(b.dataset.opp === oppKey ? 'active' : 'pending');
    });

    // 是否已確認對手
    var confirmed = !!D.active_opponent;
    var notice = document.getElementById('pending-notice');
    var status = document.getElementById('opp-status');
    if (confirmed) {
      notice.classList.remove('show');
      status.textContent = '✅ 對手已確認';
      status.style.color = 'var(--accent)';
    } else {
      notice.classList.add('show');
      status.textContent = '等待今晚確認對手…';
      status.style.color = 'var(--accent2)';
    }

    renderAll(opp, oppKey);
  }

  /* ── 全部區塊重繪 ── */
  function renderAll(opp, oppKey) {
    var fm = D.formosa;
    var h2h = D['h2h_' + oppKey];
    renderHero(fm, opp);
    renderEfficiency(fm, opp);
    renderH2H(h2h, opp);
    renderScoring(fm, opp);
    renderHomeAway(fm, opp);
    renderQuarter(fm, opp);
    renderPlayers(fm, opp);
    renderPrediction(fm, opp, h2h);
  }

  /* ① 英雄區塊 */
  function renderHero(fm, opp) {
    document.getElementById('hero-opp-fullname').textContent = opp.name;
    document.getElementById('hero-opp-short').textContent = opp.short;
    document.getElementById('hero-record-o').textContent = opp.wins + ' 勝 ' + opp.losses + ' 敗';
    var netSign = opp.netrtg >= 0 ? '+' : '';
    document.getElementById('hero-netrtg-o').innerHTML =
      'Net Rtg <span style="color:var(--opp-color)">' + netSign + opp.netrtg + '</span>';
  }

  /* ② 效率比較 */
  function renderEfficiency(fm, opp) {
    var stats = [
      { label: '進攻效率 ORtg', f: fm.ortg, o: opp.ortg, higherBetter: true },
      { label: '防守效率 DRtg', f: fm.drtg, o: opp.drtg, higherBetter: false },
      { label: 'Net Rating',    f: fm.netrtg, o: opp.netrtg, higherBetter: true },
      { label: '場均得分',      f: fm.avg_pts, o: opp.avg_pts, higherBetter: true },
      { label: '場均失分',      f: fm.avg_opp_pts, o: opp.avg_opp_pts, higherBetter: false },
    ];

    var grid = document.getElementById('eff-compare');
    grid.innerHTML = '';
    stats.forEach(function (s) {
      var fBetter = s.higherBetter ? s.f >= s.o : s.f <= s.o;
      var fClass = fBetter ? 'better' : '';
      var oClass = !fBetter ? 'better' : '';

      var fVal = div('cmp-val-f ' + fClass, s.f);
      var label = div('cmp-label', s.label);
      var oVal = div('cmp-val-o ' + oClass, s.o);

      grid.appendChild(fVal); grid.appendChild(label); grid.appendChild(oVal);

      // bar
      var total = Math.abs(s.f) + Math.abs(s.o);
      var fPct = total > 0 ? (Math.abs(s.f) / total * 100).toFixed(1) : 50;
      var oPct = (100 - fPct).toFixed(1);
      var barRow = document.createElement('div');
      barRow.className = 'cmp-bar-row';
      barRow.innerHTML = '<div class="cmp-bar-f" style="width:' + fPct + '%"></div>' +
                         '<div class="cmp-bar-o" style="width:' + oPct + '%"></div>';
      grid.appendChild(barRow);
    });

    // Chart
    renderEffChart(fm, opp);
  }

  function renderEffChart(fm, opp) {
    var ctx = document.getElementById('chart-eff').getContext('2d');
    var labels = ['ORtg', 'DRtg (越低越好)', 'NetRtg'];
    var fData = [fm.ortg, fm.drtg, fm.netrtg];
    var oData = [opp.ortg, opp.drtg, opp.netrtg];

    if (effChart) { effChart.destroy(); }
    effChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '夢想家',
            data: fData,
            backgroundColor: 'rgba(0,229,255,.7)',
            borderColor: 'rgba(0,229,255,1)',
            borderWidth: 1,
          },
          {
            label: opp.short,
            data: oData,
            backgroundColor: hexToRgba(opp.color, .65),
            borderColor: opp.color,
            borderWidth: 1,
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#8fa3b8', font: { size: 12 } } },
          tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + c.raw; } } }
        },
        scales: {
          x: { ticks: { color: '#8fa3b8' }, grid: { color: 'rgba(255,255,255,.05)' } },
          y: { ticks: { color: '#8fa3b8' }, grid: { color: 'rgba(255,255,255,.05)' } }
        }
      }
    });
  }

  /* ③ 交手紀錄 */
  function renderH2H(h2h, opp) {
    var wins = h2h.filter(function (g) { return g.won; }).length;
    var losses = h2h.length - wins;

    // 小結
    var summary = document.getElementById('h2h-summary');
    summary.innerHTML =
      '<div style="font-size:.95rem">' +
        '<span style="font-weight:900;font-size:1.3rem;color:var(--accent)">' + wins + '</span>' +
        '<span style="color:var(--text2);margin:0 .3rem">勝</span>' +
        '<span style="font-weight:900;font-size:1.3rem;color:var(--accent2)">' + losses + '</span>' +
        '<span style="color:var(--text2);margin-left:.3rem">敗</span>' +
      '</div>' +
      '<div style="font-size:.82rem;color:var(--text2)">夢想家 vs ' + opp.short + ' 例行賽</div>';

    var avgF = avg(h2h.map(function (g) { return g.formosa_score; }));
    var avgO = avg(h2h.map(function (g) { return g.opp_score; }));
    summary.innerHTML +=
      '<div style="font-size:.82rem;color:var(--text2)">夢想家均分 ' +
        '<strong style="color:var(--accent)">' + avgF.toFixed(1) + '</strong>' +
        '　對手均分 ' +
        '<strong style="color:var(--opp-color)">' + avgO.toFixed(1) + '</strong>' +
      '</div>';

    // 表格
    document.getElementById('h2h-opp-col').textContent = opp.short;
    var tbody = document.getElementById('h2h-tbody');
    tbody.innerHTML = '';
    h2h.forEach(function (g) {
      var dateStr = g.date.slice(0, 4) + '/' + g.date.slice(4, 6) + '/' + g.date.slice(6);
      var homeTag = g.formosa_home
        ? '<span class="h2h-home-tag">主</span>'
        : '<span class="h2h-home-tag">客</span>';
      var badge = g.won
        ? '<span class="h2h-badge h2h-w">勝</span>'
        : '<span class="h2h-badge h2h-l">敗</span>';
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + dateStr + '</td>' +
        '<td style="font-weight:700;color:' + (g.won ? 'var(--accent)' : 'var(--accent2)') + '">' + g.formosa_score + '</td>' +
        '<td style="color:var(--text2)">:</td>' +
        '<td style="font-weight:700">' + g.opp_score + '</td>' +
        '<td>' + homeTag + '</td>' +
        '<td>' + badge + '</td>';
      tbody.appendChild(tr);
    });
  }

  /* ④ 得分來源 */
  function renderScoring(fm, opp) {
    var container = document.getElementById('scoring-bars');
    container.innerHTML = '';

    [
      { label: '夢想家', cls: 'formosa', s: fm.scoring },
      { label: opp.short, cls: 'opponent', s: opp.scoring }
    ].forEach(function (item) {
      var total = item.s.total;
      var threePct  = (item.s.three  / total * 100).toFixed(1);
      var midPct    = (item.s.mid    / total * 100).toFixed(1);
      var paintPct  = (item.s.paint  / total * 100).toFixed(1);
      var ftPct     = (100 - +threePct - +midPct - +paintPct).toFixed(1);

      var row = document.createElement('div');
      row.className = 'score-src-row';
      row.innerHTML =
        '<div class="score-src-label">' +
          '<strong>' + item.label + '</strong>' +
          '<span>三分 ' + item.s.three + '　中距 ' + item.s.mid + '　禁區 ' + item.s.paint + '　罰球 ' + item.s.ft + '　共 ' + total + ' 分</span>' +
        '</div>' +
        '<div class="score-src-bar">' +
          '<div class="src-three"  title="三分 ' + item.s.three + '" style="width:' + threePct  + '%"></div>' +
          '<div class="src-mid"    title="中距 ' + item.s.mid   + '" style="width:' + midPct    + '%"></div>' +
          '<div class="src-paint"  title="禁區 ' + item.s.paint + '" style="width:' + paintPct  + '%"></div>' +
          '<div class="src-ft"     title="罰球 ' + item.s.ft    + '" style="width:' + ftPct     + '%"></div>' +
        '</div>';
      container.appendChild(row);
    });
  }

  /* ⑤ 主客場 */
  function renderHomeAway(fm, opp) {
    var container = document.getElementById('ha-compare');
    container.innerHTML = '';

    [
      { label: '夢想家', data: fm, colorVar: 'var(--accent)' },
      { label: opp.short, data: opp, colorVar: 'var(--opp-color)' }
    ].forEach(function (item) {
      var d = item.data;
      var card = document.createElement('div');
      card.className = 'ha-card';
      card.innerHTML =
        '<div class="ha-team-name" style="color:' + item.colorVar + ';font-weight:700">' + item.label + '</div>' +
        haRow('主場', d.home.wins + 'W ' + d.home.losses + 'L　' + pct(d.home.win_rate)) +
        haRow('　　得/失分', d.home.avg_pts.toFixed(1) + ' / ' + d.home.avg_opp.toFixed(1)) +
        haRow('客場', d.away.wins + 'W ' + d.away.losses + 'L　' + pct(d.away.win_rate)) +
        haRow('　　得/失分', d.away.avg_pts.toFixed(1) + ' / ' + d.away.avg_opp.toFixed(1));
      container.appendChild(card);
    });
  }

  function haRow(label, value) {
    return '<div class="ha-row"><span class="label">' + label + '</span><span class="value">' + value + '</span></div>';
  }

  /* ⑥ 節次分析 */
  function renderQuarter(fm, opp) {
    var container = document.getElementById('quarter-grid');
    container.innerHTML = '';
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(function (q) {
      var fq = fm.quarter[q];
      var oq = opp.quarter[q];
      var fBetter = fq.avg_score >= oq.avg_score;
      var card = document.createElement('div');
      card.className = 'quarter-card';
      card.innerHTML =
        '<div class="quarter-name">' + q + '</div>' +
        '<div class="quarter-scores">' +
          '<div class="quarter-team">' +
            '<div class="quarter-score formosa" style="color:' + (fBetter ? 'var(--accent)' : 'var(--text)') + '">' + fq.avg_score.toFixed(1) + '</div>' +
            '<div style="font-size:.65rem;color:var(--text2)">夢想家</div>' +
          '</div>' +
          '<div class="quarter-sep">—</div>' +
          '<div class="quarter-team">' +
            '<div class="quarter-score opponent" style="color:' + (!fBetter ? 'var(--opp-color)' : 'var(--text)') + '">' + oq.avg_score.toFixed(1) + '</div>' +
            '<div style="font-size:.65rem;color:var(--text2)">' + opp.short + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="quarter-winrate">夢 節勝率 ' + pct(fq.win_rate) + '</div>';
      container.appendChild(card);
    });
  }

  /* ⑦ 球員比較 */
  function renderPlayers(fm, opp) {
    var container = document.getElementById('player-compare');
    container.innerHTML = '';

    [
      { label: '夢想家', cls: 'formosa', players: fm.players },
      { label: opp.short, cls: 'opponent', players: opp.players }
    ].forEach(function (item) {
      var panel = document.createElement('div');
      panel.className = 'player-panel';
      var header = document.createElement('h3');
      header.className = item.cls;
      header.textContent = item.label + ' 主力球員';
      panel.appendChild(header);

      var wrap = document.createElement('div');
      wrap.style.overflowX = 'auto';
      var table = document.createElement('table');
      table.className = 'data-nums';
      table.innerHTML =
        '<thead><tr>' +
        '<th>球員</th><th>得</th><th>籃</th><th>助</th><th>抄</th><th>蓋</th><th>失</th><th>效率</th><th>USG</th>' +
        '</tr></thead>';
      var tbody = document.createElement('tbody');
      item.players.forEach(function (p) {
        var tr = document.createElement('tr');
        tr.innerHTML =
          '<td style="white-space:nowrap">' + p.name + '<span style="font-size:.65rem;color:var(--text2);margin-left:.25rem">(' + p.gp + '場)</span></td>' +
          td(p.pts) + td(p.reb) + td(p.ast) + td(p.stl) + td(p.blk) + td(p.tov) + td(p.eff) + td(p.usg + '%');
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      panel.appendChild(wrap);
      container.appendChild(panel);
    });
  }

  /* ⑧ 勝負預測 */
  function renderPrediction(fm, opp, h2h) {
    document.getElementById('pred-opp-label').textContent = opp.short;

    var wins = h2h.filter(function (g) { return g.won; }).length;
    var h2hWinRate = wins / h2h.length;

    // Net Rtg 換算勝率（Pythagorean approximation）
    var netDiff = fm.netrtg - opp.netrtg;
    var netProb = 0.5 + netDiff * 0.025;
    netProb = Math.min(0.82, Math.max(0.18, netProb));

    // 加權：Net Rtg 60%，H2H 40%
    var combined = netProb * 0.6 + h2hWinRate * 0.4;
    combined = Math.min(0.80, Math.max(0.20, combined));

    var fPct = Math.round(combined * 100);
    var oPct = 100 - fPct;

    var fillF = document.getElementById('pred-fill-f');
    var fillO = document.getElementById('pred-fill-o');
    fillF.style.width = fPct + '%';
    fillO.style.width = oPct + '%';
    fillF.textContent = fPct + '%';
    fillO.textContent = oPct + '%';

    // 文字說明
    var noteTxt =
      'Net Rating 差距 ' + (netDiff >= 0 ? '+' : '') + netDiff.toFixed(1) +
      '，例行賽 H2H ' + wins + ' 勝 ' + (h2h.length - wins) + ' 敗。' +
      '加權預測（Net Rtg 60% + H2H 40%）夢想家單場勝率約 ' + fPct + '%。' +
      '僅供參考，季後賽強度與陣容調整可能顯著影響結果。';
    document.getElementById('pred-note').textContent = noteTxt;

    // 優劣因子
    var factors = [
      { name: '整體效率 NetRtg', fVal: fm.netrtg, oVal: opp.netrtg, higherBetter: true, fmt: function (v) { return (v >= 0 ? '+' : '') + v; } },
      { name: '進攻效率 ORtg',   fVal: fm.ortg,   oVal: opp.ortg,   higherBetter: true, fmt: function (v) { return v; } },
      { name: '防守效率 DRtg',   fVal: fm.drtg,   oVal: opp.drtg,   higherBetter: false, fmt: function (v) { return v; } },
      { name: '主場勝率',        fVal: fm.home.win_rate,  oVal: opp.home.win_rate,  higherBetter: true, fmt: pct },
      { name: '例行賽 H2H',      fVal: wins, oVal: h2h.length - wins, higherBetter: true, fmt: function (v) { return v + 'W'; } },
    ];

    var fcont = document.getElementById('pred-factors');
    fcont.innerHTML = '';
    factors.forEach(function (f) {
      var fBetter = f.higherBetter ? f.fVal > f.oVal : f.fVal < f.oVal;
      var tie = f.fVal === f.oVal;
      var edgeCls = tie ? 'edge-tie' : (fBetter ? 'edge-f' : 'edge-o');
      var edgeLabel = tie ? '平手' : (fBetter ? '夢想家 ▲' : opp.short + ' ▲');
      var card = document.createElement('div');
      card.className = 'factor-card';
      card.innerHTML =
        '<div class="factor-name">' + f.name + '</div>' +
        '<div style="font-size:.78rem;color:var(--text2);margin-bottom:.15rem">' +
          '夢 ' + f.fmt(f.fVal) + '　vs　' + opp.short + ' ' + f.fmt(f.oVal) +
        '</div>' +
        '<div class="factor-edge ' + edgeCls + '">' + edgeLabel + '</div>';
      fcont.appendChild(card);
    });
  }

  /* ── 工具函式 ── */
  function div(cls, text) {
    var el = document.createElement('div');
    el.className = cls;
    el.textContent = text;
    return el;
  }

  function td(val) {
    return '<td>' + val + '</td>';
  }

  function pct(rate) {
    return (rate * 100).toFixed(1) + '%';
  }

  function avg(arr) {
    return arr.reduce(function (s, v) { return s + v; }, 0) / arr.length;
  }

  function hexToRgb(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return r + ',' + g + ',' + b;
  }

  function hexToRgba(hex, alpha) {
    return 'rgba(' + hexToRgb(hex) + ',' + alpha + ')';
  }
})();
