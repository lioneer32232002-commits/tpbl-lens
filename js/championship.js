/* championship.js — TPBL 冠軍戰分析頁 */
(function () {
  'use strict';

  var DATA_URL = '/data/championship_2526.json';
  var D = null;
  var currentOpp = null;
  var effChart = null;
  var scenarioChart = null;
  var usgChart = null;

  /* ── 載入資料 ── */
  fetch(DATA_URL)
    .then(function (r) { return r.json(); })
    .then(function (d) {
      D = d;
      setOpp('kings');
      bindLocks();
    })
    .catch(function (e) { console.error('Championship data load failed', e); });

  function setOpp(oppKey) {
    currentOpp = oppKey;
    var opp = D[oppKey];

    var root = document.documentElement;
    root.style.setProperty('--opp-color', opp.color);
    root.style.setProperty('--opp-rgb', hexToRgb(opp.color));

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
    renderMHU(fm, opp, oppKey);
    renderScenario(fm, opp, oppKey);
    renderUSGScatter(fm, opp, oppKey);
    renderPrediction(fm, opp, h2h);
    renderHeatmaps(fm, opp, oppKey);
    // 觸發所有 bar 動畫
    animateBars('.cmp-bar-f, .cmp-bar-o, .mhu-bar-fill, .mini-bar-fill');
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
  var SCORE_COLORS = {
    formosa:  ['#00e5ff', '#0091b8', '#005f80', '#80f0ff'],
    opponent: ['#ffd700', '#e8a020', '#b07800', '#ffe980']
  };

  function renderScoring(fm, opp) {
    var container = document.getElementById('scoring-bars');
    container.innerHTML = '';

    [
      { label: '夢想家', s: fm.scoring,  colors: SCORE_COLORS.formosa },
      { label: opp.short, s: opp.scoring, colors: SCORE_COLORS.opponent }
    ].forEach(function (item) {
      var total = item.s.total;
      var threePct = (item.s.three / total * 100).toFixed(1);
      var midPct   = (item.s.mid   / total * 100).toFixed(1);
      var paintPct = (item.s.paint / total * 100).toFixed(1);
      var ftPct    = (100 - +threePct - +midPct - +paintPct).toFixed(1);
      var c = item.colors;

      var row = document.createElement('div');
      row.className = 'score-src-row';
      row.innerHTML =
        '<div class="score-src-label">' +
          '<strong>' + item.label + '</strong>' +
          '<span>三分 ' + item.s.three + '　中距 ' + item.s.mid + '　禁區 ' + item.s.paint + '　罰球 ' + item.s.ft + '　共 ' + total + ' 分</span>' +
        '</div>' +
        '<div class="score-src-bar">' +
          '<div style="width:' + threePct + '%;background:' + c[0] + '" title="三分 ' + item.s.three + '"></div>' +
          '<div style="width:' + midPct   + '%;background:' + c[1] + '" title="中距 ' + item.s.mid   + '"></div>' +
          '<div style="width:' + paintPct + '%;background:' + c[2] + '" title="禁區 ' + item.s.paint + '"></div>' +
          '<div style="width:' + ftPct    + '%;background:' + c[3] + '" title="罰球 ' + item.s.ft    + '"></div>' +
        '</div>';
      container.appendChild(row);
    });

    var legend = document.getElementById('scoring-legend');
    if (legend) {
      legend.innerHTML =
        scoreLegendGroup('夢想家', SCORE_COLORS.formosa) +
        scoreLegendGroup(opp.short, SCORE_COLORS.opponent);
    }
  }

  function scoreLegendGroup(teamLabel, colors) {
    var labels = ['三分', '中距', '禁區', '罰球'];
    var dots = labels.map(function (l, i) {
      return '<span><span class="legend-dot" style="background:' + colors[i] + '"></span>' + l + '</span>';
    }).join('');
    return '<span style="font-size:.7rem;font-weight:700;color:var(--text2);margin-right:.4rem">' + teamLabel + '：</span>' + dots + '　';
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

  /* ⑧ Mann-Whitney 勝負關鍵指標 */
  function renderMHU(fm, opp, oppKey) {
    var fmMhu = D.formosa_mhu;
    var oppMhu = D[oppKey + '_mhu'];
    var container = document.getElementById('mhu-compare');
    container.innerHTML = '';

    [
      { label: '夢想家', mhu: fmMhu, cls: 'formosa', colorVar: 'var(--accent)' },
      { label: opp.short, mhu: oppMhu, cls: 'opponent', colorVar: 'var(--opp-color)' }
    ].forEach(function (item) {
      var panel = document.createElement('div');
      panel.className = 'mhu-panel';

      var title = document.createElement('div');
      title.className = 'mhu-panel-title';
      title.style.color = item.colorVar;
      title.textContent = item.label + ' — 勝場關鍵因子';
      panel.appendChild(title);

      var maxDiff = 0;
      item.mhu.forEach(function (s) {
        var d = Math.abs(s.w_med - s.l_med);
        if (d > maxDiff) maxDiff = d;
      });

      item.mhu.forEach(function (s) {
        var diff = s.w_med - s.l_med;
        var pct = maxDiff > 0 ? Math.min(100, Math.abs(diff) / maxDiff * 100).toFixed(1) : 0;
        var sigStar = s.sig ? ' ★' : '';
        var fillColor = s.sig ? item.colorVar : 'rgba(143,163,184,.4)';

        var row = document.createElement('div');
        row.className = 'mhu-row';
        row.title = '勝場中位數 ' + s.w_med + ' vs 敗場 ' + s.l_med + ' (p=' + s.p.toFixed(3) + ')';
        row.innerHTML =
          '<div class="mhu-stat-name">' + s.stat + (s.sig ? '<span class="mhu-sig-star"> ★</span>' : '') + '</div>' +
          '<div class="mhu-bar-track">' +
            '<div class="mhu-bar-fill" style="width:' + pct + '%;background:' + fillColor + '"></div>' +
          '</div>' +
          '<div class="mhu-val" style="color:' + (s.sig ? item.colorVar : 'var(--text2)') + '">' +
            (diff >= 0 ? '+' : '') + diff.toFixed(1) +
          '</div>';
        panel.appendChild(row);
      });

      container.appendChild(panel);
    });
  }

  /* ⑨ 情境分析 */
  function renderScenario(fm, opp, oppKey) {
    var fmS = D.formosa_scenario;
    var oppS = D[oppKey + '_scenario'];
    var labels = fmS.map(function (s) { return s.label; });

    if (scenarioChart) { scenarioChart.destroy(); }
    var ctx = document.getElementById('chart-scenario').getContext('2d');
    scenarioChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '夢想家 勝率',
            data: fmS.map(function (s) { return (s.win_rate * 100).toFixed(1); }),
            backgroundColor: 'rgba(0,229,255,.7)',
            borderColor: 'rgba(0,229,255,1)',
            borderWidth: 1,
            yAxisID: 'y',
          },
          {
            label: opp.short + ' 勝率',
            data: oppS.map(function (s) { return (s.win_rate * 100).toFixed(1); }),
            backgroundColor: hexToRgba(opp.color, .65),
            borderColor: opp.color,
            borderWidth: 1,
            yAxisID: 'y',
          },
          {
            label: '夢想家 均分',
            data: fmS.map(function (s) { return s.team_mean.toFixed(1); }),
            type: 'line',
            borderColor: 'rgba(0,229,255,.5)',
            borderDash: [4, 3],
            pointBackgroundColor: 'rgba(0,229,255,.9)',
            fill: false,
            tension: 0.3,
            yAxisID: 'y2',
          },
          {
            label: opp.short + ' 均分',
            data: oppS.map(function (s) { return s.team_mean.toFixed(1); }),
            type: 'line',
            borderColor: hexToRgba(opp.color, .5),
            borderDash: [4, 3],
            pointBackgroundColor: hexToRgba(opp.color, .9),
            fill: false,
            tension: 0.3,
            yAxisID: 'y2',
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#8fa3b8', font: { size: 11 } } },
          tooltip: { mode: 'index', intersect: false }
        },
        scales: {
          x: { ticks: { color: '#8fa3b8' }, grid: { color: 'rgba(255,255,255,.05)' } },
          y: {
            position: 'left',
            min: 0, max: 110,
            ticks: { color: '#8fa3b8', callback: function (v) { return v + '%'; } },
            grid: { color: 'rgba(255,255,255,.05)' },
            title: { display: true, text: '勝率 %', color: '#8fa3b8', font: { size: 11 } }
          },
          y2: {
            position: 'right',
            ticks: { color: '#8fa3b8' },
            grid: { drawOnChartArea: false },
            title: { display: true, text: '均分', color: '#8fa3b8', font: { size: 11 } }
          }
        }
      }
    });

    // 情境 table
    var tbl = document.getElementById('scenario-table');
    var rows = labels.map(function (lbl, i) {
      var fs = fmS[i], os = oppS[i];
      return '<tr>' +
        '<td style="font-weight:700;color:var(--text)">' + lbl + '</td>' +
        '<td style="color:var(--accent)">' + (fs.win_rate * 100).toFixed(0) + '%</td>' +
        '<td>' + fs.team_mean.toFixed(1) + ' 分</td>' +
        '<td style="color:var(--opp-color)">' + (os.win_rate * 100).toFixed(0) + '%</td>' +
        '<td>' + os.team_mean.toFixed(1) + ' 分</td>' +
        '</tr>';
    }).join('');
    tbl.innerHTML =
      '<table class="scenario-tbl">' +
        '<thead><tr><th>情境</th><th>夢想家勝率</th><th>夢想家均分</th>' +
          '<th>' + opp.short + '勝率</th><th>' + opp.short + '均分</th></tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';
  }

  /* ⑩ USG% vs TS% 散點圖 */
  function renderUSGScatter(fm, opp, oppKey) {
    var fmPlayers = D.formosa_usg;
    var oppPlayers = D[oppKey + '_usg'];

    var fmData = fmPlayers.map(function (p) {
      return { x: p.usg, y: p.tsp, r: Math.max(5, p.pts * 0.7), label: p.name, gp: p.gp };
    });
    var oppData = oppPlayers.map(function (p) {
      return { x: p.usg, y: p.tsp, r: Math.max(5, p.pts * 0.7), label: p.name, gp: p.gp };
    });

    if (usgChart) { usgChart.destroy(); }
    var ctx = document.getElementById('chart-usg-ts').getContext('2d');
    usgChart = new Chart(ctx, {
      type: 'bubble',
      data: {
        datasets: [
          {
            label: '夢想家',
            data: fmData,
            backgroundColor: 'rgba(0,229,255,.55)',
            borderColor: 'rgba(0,229,255,.9)',
            borderWidth: 1.5,
          },
          {
            label: opp.short,
            data: oppData,
            backgroundColor: hexToRgba(opp.color, .5),
            borderColor: opp.color,
            borderWidth: 1.5,
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#8fa3b8', font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: function (c) {
                var d = c.raw;
                return d.label + ' USG ' + d.x + '% / TS ' + d.y + '% (' + d.gp + '場)';
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'USG% (用球率)', color: '#8fa3b8', font: { size: 11 } },
            ticks: { color: '#8fa3b8' },
            grid: { color: 'rgba(255,255,255,.05)' }
          },
          y: {
            title: { display: true, text: 'TS% (真實命中率)', color: '#8fa3b8', font: { size: 11 } },
            ticks: { color: '#8fa3b8' },
            grid: { color: 'rgba(255,255,255,.05)' }
          }
        }
      }
    });
  }

  /* ⑫ Plus/Minus 與 PPP 熱力圖（折疊）*/
  function renderHeatmaps(fm, opp, oppKey) {
    var fmPM  = D['formosa_hm_' + oppKey];
    var oppPM = D[oppKey + '_hm_formosa'];
    var fmPPP  = D['formosa_ppp_' + oppKey];
    var oppPPP = D[oppKey + '_ppp_formosa'];

    renderMiniBar('pm-compare', fmPM, oppPM, fm, opp, 'pm', 'var(--accent)', 'var(--opp-color)');
    renderMiniBar('ppp-compare', fmPPP, oppPPP, fm, opp, 'ppp', 'var(--accent)', 'var(--opp-color)');
  }

  function renderMiniBar(containerId, fmData, oppData, fm, opp, field, fColor, oColor) {
    var container = document.getElementById(containerId);
    container.innerHTML = '';

    [
      { label: '夢想家', data: fmData, color: fColor },
      { label: opp.short, data: oppData, color: oColor }
    ].forEach(function (item) {
      var panel = document.createElement('div');
      panel.className = 'hm-panel';

      var title = document.createElement('div');
      title.className = 'hm-panel-title';
      title.style.color = item.color;
      title.textContent = item.label;
      panel.appendChild(title);

      var maxAbs = 0;
      item.data.forEach(function (p) {
        var v = Math.abs(p[field] || 0);
        if (v > maxAbs) maxAbs = v;
      });

      item.data.forEach(function (p) {
        var val = p[field] || 0;
        var pct = maxAbs > 0 ? Math.min(50, Math.abs(val) / maxAbs * 50).toFixed(1) : 0;
        var isPos = val >= 0;
        var row = document.createElement('div');
        row.className = 'mini-bar-row';
        row.innerHTML =
          '<div class="mini-bar-name">' + p.player + '</div>' +
          '<div class="mini-bar-track">' +
            '<div class="mini-bar-axis"></div>' +
            '<div class="mini-bar-fill ' + (isPos ? 'mini-bar-pos' : 'mini-bar-neg') + '" style="width:' + pct + '%;background:' + (isPos ? 'rgba(0,229,255,.75)' : 'rgba(240,98,146,.75)') + '"></div>' +
          '</div>' +
          '<div class="mini-bar-val" style="color:' + (isPos ? 'var(--accent)' : 'var(--accent2)') + '">' +
            (isPos ? '+' : '') + val.toFixed(field === 'ppp' ? 2 : 1) +
          '</div>';
        panel.appendChild(row);
      });

      container.appendChild(panel);
    });
  }

  /* ── 賽程（7戰4勝，夢想家主場優勢）── */
  var SERIES_SCHEDULE = ['h','h','a','a','h','a','h'];
  var SERIES_GAMES = [
    { label: 'G1', date: '5/24', home: 'f', tbd: false },
    { label: 'G2', date: '5/26', home: 'f', tbd: false },
    { label: 'G3', date: '5/29', home: 'o', tbd: false },
    { label: 'G4', date: '5/31', home: 'o', tbd: false },
    { label: 'G5', date: '6/2',  home: 'f', tbd: true },
    { label: 'G6', date: '6/4',  home: 'o', tbd: true },
    { label: 'G7', date: '6/6',  home: 'f', tbd: true }
  ];

  /* Monte Carlo 模擬（指定主客場勝率） */
  function simSeries(pHome, pAway, sched, fNeed, kNeed) {
    var N = 60000;
    var wins = 0;
    for (var i = 0; i < N; i++) {
      var f = 0, k = 0, g = 0;
      while (f < fNeed && k < kNeed) {
        var p = sched[g] === 'h' ? pHome : pAway;
        if (Math.random() < p) { f++; } else { k++; }
        g++;
      }
      if (f >= fNeed) { wins++; }
    }
    return wins / N;
  }

  function computePaths(pHome, pAway, sched) {
    var N = 60000;
    var f = [0,0,0,0], k = [0,0,0,0];
    for (var i = 0; i < N; i++) {
      var fw = 0, kw = 0, g = 0;
      while (fw < 4 && kw < 4) {
        var p = sched[g] === 'h' ? pHome : pAway;
        if (Math.random() < p) { fw++; } else { kw++; }
        g++;
      }
      if (fw >= 4) { f[kw]++; } else { k[fw]++; }
    }
    for (var j = 0; j < 4; j++) { f[j] /= N; k[j] /= N; }
    return { f: f, k: k };
  }

  /* ⑪ 勝負預測 */
  function renderPrediction(fm, opp, h2h) {
    var card = document.getElementById('pred-card');
    if (!card) { return; }
    card.innerHTML = '';

    var wins = h2h.filter(function (g) { return g.won; }).length;
    var h2hWinRate = wins / h2h.length;
    var netDiff = fm.netrtg - opp.netrtg;
    var netProb = Math.min(0.82, Math.max(0.18, 0.5 + netDiff * 0.025));
    var gameProb = Math.min(0.78, Math.max(0.22, netProb * 0.6 + h2hWinRate * 0.4));
    var HOME_BOOST = 0.10;
    var pH = Math.min(0.82, gameProb + HOME_BOOST);
    var pA = Math.max(0.18, gameProb - HOME_BOOST);

    var seriesProb = simSeries(pH, pA, SERIES_SCHEDULE, 4, 4);
    var fPct = Math.round(seriesProb * 100);
    var oPct = 100 - fPct;

    // G1 條件機率（G1 在夢主場，pH）
    var schedG2on = SERIES_SCHEDULE.slice(1);
    var afterWin  = simSeries(pH, pA, schedG2on, 3, 4);
    var afterLose = simSeries(pH, pA, schedG2on, 4, 3);
    var g1WinPct   = Math.round(pH * 100);
    var afterWinPct  = Math.round(afterWin  * 100);
    var afterLosePct = Math.round(afterLose * 100);

    // 路徑分佈
    var paths = computePaths(pH, pA, SERIES_SCHEDULE);
    var allP = paths.f.concat(paths.k);
    var maxP = Math.max.apply(null, allP.map(function(v){ return v*100; }));

    var html = '';

    // ── 賽程圓點 ──
    html += '<div class="pred-schedule">';
    SERIES_GAMES.forEach(function (g) {
      var cls = g.tbd ? 'tbd' : (g.home === 'f' ? 'home-f' : 'home-o');
      var homeTag = g.home === 'f' ? '夢主場' : opp.short + '主';
      html +=
        '<div class="pred-game-dot ' + cls + '" title="' + g.label + ' ' + (g.tbd ? '如需要' : g.date + ' ' + homeTag) + '">' +
          '<span>' + g.label + '</span>' +
          '<span style="font-size:.5rem;opacity:.8">' + (g.tbd ? '待定' : g.date) + '</span>' +
        '</div>';
    });
    html += '</div>';

    // ── 大機率數字 ──
    html +=
      '<div class="pred-prob-big">' +
        '<div class="pred-prob-team">' +
          '<div class="pred-prob-num" style="color:var(--accent)">' + fPct + '%</div>' +
          '<div class="pred-prob-label">福爾摩沙夢想家</div>' +
        '</div>' +
        '<div class="pred-vs-sep">vs</div>' +
        '<div class="pred-prob-team">' +
          '<div class="pred-prob-num" style="color:var(--opp-color)">' + oPct + '%</div>' +
          '<div class="pred-prob-label">' + opp.name + '</div>' +
        '</div>' +
      '</div>';

    // ── G1 效應 ──
    html +=
      '<div class="pred-g1-card">' +
        '<div class="pred-g1-title">G1 效應・第一場的重量（5/24 夢想家主場 台中）</div>' +
        '<div class="pred-g1-row">' +
          '<div class="pred-g1-item">' +
            '<div class="pred-g1-num" style="color:var(--accent)">' + g1WinPct + '%</div>' +
            '<div class="pred-g1-sub">夢 G1 主場勝率</div>' +
          '</div>' +
          '<div style="color:var(--text2);font-size:1.1rem;align-self:center">⟶</div>' +
          '<div class="pred-g1-item">' +
            '<div class="pred-g1-num" style="color:var(--accent)">' + afterWinPct + '%</div>' +
            '<div class="pred-g1-sub">贏 G1 後<br>奪冠機率</div>' +
          '</div>' +
          '<div style="color:var(--text2);font-size:.85rem;align-self:center">╱</div>' +
          '<div class="pred-g1-item">' +
            '<div class="pred-g1-num" style="color:var(--accent2)">' + afterLosePct + '%</div>' +
            '<div class="pred-g1-sub">輸 G1 後<br>奪冠機率</div>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:.7rem;color:var(--text2);line-height:1.55;border-top:1px solid rgba(255,255,255,.07);padding-top:.5rem">' +
          'G1、G2、G5、G7 夢想家主場（台中）；G3、G4、G6 ' + opp.short + '主場（新莊）。贏 G1 可守住主場節奏，落後 0-1 則需在客場扳平。' +
        '</div>' +
      '</div>';

    // ── 路徑分佈 ──
    html += '<div class="pred-paths">';
    html += '<div class="pred-path-title" style="color:var(--accent)">夢想家奪冠路徑　合計 ' + fPct + '%</div>';
    ['4-0','4-1','4-2','4-3'].forEach(function (lbl, i) {
      var v = (paths.f[i] * 100).toFixed(0);
      var bw = maxP > 0 ? (paths.f[i] * 100 / maxP * 100).toFixed(1) : 0;
      html +=
        '<div class="pred-path-row">' +
          '<div class="pred-path-label">夢 ' + lbl + '</div>' +
          '<div class="pred-path-bar-bg">' +
            '<div class="pred-path-bar-fill" style="width:' + bw + '%;background:rgba(0,229,255,.75)"></div>' +
          '</div>' +
          '<div class="pred-path-val" style="color:var(--accent)">' + v + '%</div>' +
        '</div>';
    });
    html += '<div class="pred-path-title" style="color:var(--opp-color);margin-top:.65rem">' + opp.short + ' 奪冠路徑　合計 ' + oPct + '%</div>';
    ['4-0','4-1','4-2','4-3'].forEach(function (lbl, i) {
      var v = (paths.k[i] * 100).toFixed(0);
      var bw = maxP > 0 ? (paths.k[i] * 100 / maxP * 100).toFixed(1) : 0;
      html +=
        '<div class="pred-path-row">' +
          '<div class="pred-path-label">' + opp.short + ' ' + lbl + '</div>' +
          '<div class="pred-path-bar-bg">' +
            '<div class="pred-path-bar-fill" style="width:' + bw + '%;background:rgba(var(--opp-rgb),.75)"></div>' +
          '</div>' +
          '<div class="pred-path-val" style="color:var(--opp-color)">' + v + '%</div>' +
        '</div>';
    });
    html += '</div>';

    // ── 說明 ──
    html +=
      '<div class="pred-note" style="margin-bottom:.85rem">' +
        'Net Rating 差距 ' + (netDiff >= 0 ? '+' : '') + netDiff.toFixed(1) +
        '，H2H ' + wins + '勝' + (h2h.length - wins) + '敗。' +
        '主場勝率 ' + Math.round(pH * 100) + '%・客場 ' + Math.round(pA * 100) + '%。Monte Carlo 6萬次模擬。僅供參考。' +
      '</div>';

    // ── 優劣因子 ──
    html += '<div class="pred-factors" id="pred-factors"></div>';
    card.innerHTML = html;

    var factors = [
      { name: '整體效率 NetRtg', fVal: fm.netrtg, oVal: opp.netrtg, higherBetter: true,  fmt: function (v) { return (v >= 0 ? '+' : '') + v; } },
      { name: '進攻效率 ORtg',   fVal: fm.ortg,   oVal: opp.ortg,   higherBetter: true,  fmt: function (v) { return v; } },
      { name: '防守效率 DRtg',   fVal: fm.drtg,   oVal: opp.drtg,   higherBetter: false, fmt: function (v) { return v; } },
      { name: '主場勝率',        fVal: fm.home.win_rate, oVal: opp.home.win_rate, higherBetter: true, fmt: pct },
      { name: '例行賽 H2H',      fVal: wins, oVal: h2h.length - wins, higherBetter: true, fmt: function (v) { return v + 'W'; } }
    ];
    var fcont = document.getElementById('pred-factors');
    factors.forEach(function (f) {
      var fBetter = f.higherBetter ? f.fVal > f.oVal : f.fVal < f.oVal;
      var tie = f.fVal === f.oVal;
      var edgeCls = tie ? 'edge-tie' : (fBetter ? 'edge-f' : 'edge-o');
      var edgeLabel = tie ? '平手' : (fBetter ? '夢想家 ▲' : opp.short + ' ▲');
      var el = document.createElement('div');
      el.className = 'factor-card';
      el.innerHTML =
        '<div class="factor-name">' + f.name + '</div>' +
        '<div style="font-size:.78rem;color:var(--text2);margin-bottom:.15rem">夢 ' + f.fmt(f.fVal) + '　vs　' + opp.short + ' ' + f.fmt(f.oVal) + '</div>' +
        '<div class="factor-edge ' + edgeCls + '">' + edgeLabel + '</div>';
      fcont.appendChild(el);
    });

    // 觸發路徑 bar 動畫
    animateBars('.pred-path-bar-fill');
  }

  /* ── Bar 動畫：渲染後用 rAF 觸發 transition ── */
  function animateBars(selector) {
    var els = document.querySelectorAll(selector);
    // 先存目標寬度，歸零，下一 frame 還原
    var targets = [];
    els.forEach(function (el) {
      targets.push({ el: el, w: el.style.width });
      el.style.width = '0%';
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        targets.forEach(function (t) { t.el.style.width = t.w; });
      });
    });
  }

  /* ── Click-to-lock for MHU rows and factor cards ── */
  function bindLocks() {
    document.addEventListener('click', function (e) {
      var mhu = e.target.closest('.mhu-row');
      if (mhu) { _lock(mhu, mhu.closest('.mhu-panel'), '.mhu-row'); return; }
      var fc = e.target.closest('.factor-card');
      if (fc) { _lock(fc, fc.closest('.pred-factors'), '.factor-card'); return; }
    });
  }

  function _lock(el, scope, sel) {
    var was = el.classList.contains('locked');
    if (scope) scope.querySelectorAll(sel + '.locked').forEach(function (x) { x.classList.remove('locked'); });
    if (!was) el.classList.add('locked');
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
