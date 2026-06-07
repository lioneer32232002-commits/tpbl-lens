/* championship.js — TPBL 冠軍戰分析頁 */
(function () {
  'use strict';

  var DATA_URL = '/data/championship_2526.json';
  var D = null;
  var currentOpp = null;
  var effChart = null;
  var haChart = null;
  var scenarioChartF = null;
  var scenarioChartK = null;
  var usgChartF = null;
  var usgChartK = null;

  // 得分來源色系（深 → 淺），依佔比高低動態分配
  var SCORE_SHADES = {
    formosa:  ['#004d66', '#0091b8', '#00d4f0', '#80f0ff'],
    opponent: ['#7a5000', '#c88000', '#ffd700', '#ffe980']
  };

  function assignScoringColors(scoring, shades) {
    // 固定順序：三分、中距、禁區、罰球 → 由深到淺
    return [shades[0], shades[1], shades[2], shades[3]];
  }

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
    // 取 H2H 子物件，並補上 metadata
    var fmH2H  = fm['h2h_' + oppKey] || fm;
    var oppH2H = opp['h2h_formosa']  || opp;
    fmH2H.name  = fm.name;  fmH2H.short  = fm.short;  fmH2H.color  = fm.color;
    oppH2H.name = opp.name; oppH2H.short = opp.short; oppH2H.color = opp.color;

    // 冠軍戰至今的隊伍統計（若系列賽已開打就改用它）
    var champF = D.formosa_champ;
    var champO = D[oppKey + '_champ'];
    var hasChamp = !!(champF && champO && champF.gp > 0);
    var effF = hasChamp ? withMeta(champF, fm)  : fmH2H;
    var effO = hasChamp ? withMeta(champO, opp) : oppH2H;
    var srcTag = hasChamp ? ('冠軍戰至今 ' + champF.gp + ' 場') : '雙方對戰 6 場';

    renderHero(fm, opp);
    renderChampTodate(oppKey, opp);
    renderH2H(h2h, opp);
    renderPrediction(effF, effO, h2h, hasChamp);
    renderReview(effF, effO, h2h);
    renderEfficiency(effF, effO);
    renderScoring(effF, effO);
    renderHomeAway(effF, effO);
    renderQuarter(fmH2H, oppH2H, opp);
    renderPlayers(fmH2H, oppH2H);
    renderMHU(fm, opp, oppKey);
    renderScenario(fm, opp, oppKey);
    renderUSGCharts(oppKey, opp);
    renderHeatmaps(fm, opp, oppKey);

    // 依資料來源更新區塊標題
    setSecTitle('efficiency', '每百回合效率比較（' + srcTag + '）');
    setSecTitle('scoring',    '得分來源比較（' + srcTag + '）');
    setSecTitle('home-away',  '主客場優勢（' + srcTag + '）');

    setupCollapsibles();
    setupScrollTriggers();
  }

  /* 更新區塊 h2 標題（保留折疊 caret） */
  function setSecTitle(secId, text) {
    var sec = document.getElementById(secId);
    if (!sec) { return; }
    var h2 = sec.querySelector('h2');
    if (!h2) { return; }
    var caret = h2.querySelector('.collapse-caret');
    h2.textContent = text;
    if (caret) { h2.appendChild(caret); }
  }

  /* 將冠軍戰隊伍 block 套上名稱/顏色/球員等 metadata，供既有渲染函式使用 */
  function withMeta(block, base) {
    var o = {};
    for (var k in block) { if (block.hasOwnProperty(k)) { o[k] = block[k]; } }
    o.name = base.name; o.short = base.short; o.color = base.color;
    o.players = base.players;
    return o;
  }

  /* ① 英雄區塊 */
  function renderHero(fm, opp) {
    // 對決概況區塊已移除，保留函式以免呼叫出錯
    var el;
    el = document.getElementById('hero-opp-fullname'); if (el) el.textContent = opp.name;
    el = document.getElementById('hero-opp-short');    if (el) el.textContent = opp.short;
    el = document.getElementById('hero-record-o');     if (el) el.textContent = opp.wins + ' 勝 ' + opp.losses + ' 敗';
    el = document.getElementById('hero-netrtg-o');
    if (el) {
      var netSign = opp.netrtg >= 0 ? '+' : '';
      el.innerHTML = 'Net Rtg <span style="color:var(--opp-color)">' + netSign + opp.netrtg + '</span>';
    }
  }

  /* ①-b 英雄區塊得分來源 mini bars */
  function renderHeroScoring(fmH2H, oppH2H) {
    var container = document.getElementById('hero-score-src');
    if (!container) { return; }

    function miniBar(scoring, shades, label) {
      var colors = assignScoringColors(scoring, shades);
      var total = scoring.total || 1;
      var cats = [
        { v: scoring.three, c: colors[0], t: '三分' },
        { v: scoring.mid,   c: colors[1], t: '中距' },
        { v: scoring.paint, c: colors[2], t: '禁區' },
        { v: scoring.ft,    c: colors[3], t: '罰球' }
      ];
      var segs = cats.map(function (x) {
        var pct = (x.v / total * 100).toFixed(1);
        return '<div style="width:' + pct + '%;background:' + x.c + ';height:100%;flex-shrink:0" title="' + x.t + ' ' + x.v + '"></div>';
      }).join('');
      return '<div style="display:flex;align-items:center;gap:.4rem">' +
        '<span style="font-size:.62rem;color:var(--text2);width:1rem;text-align:right;flex-shrink:0">' + label + '</span>' +
        '<div style="flex:1;display:flex;height:9px;border-radius:3px;overflow:hidden;gap:1px">' + segs + '</div>' +
        '<span style="font-size:.65rem;color:var(--text2);width:2.5rem;text-align:right;flex-shrink:0">' + total.toFixed(1) + '分</span>' +
        '</div>';
    }

    container.innerHTML =
      '<div style="font-size:.6rem;color:var(--text2);text-align:center;margin-bottom:.4rem;letter-spacing:.04em">得分來源</div>' +
      miniBar(fmH2H.scoring, SCORE_SHADES.formosa, '夢') +
      '<div style="height:.35rem"></div>' +
      miniBar(oppH2H.scoring, SCORE_SHADES.opponent, '王') +
      '<div style="display:flex;justify-content:center;gap:.5rem;margin-top:.4rem">' +
        ['三分','中距','禁區','罰球'].map(function(l) {
          return '<span style="font-size:.55rem;color:var(--text2)">' + l + '</span>';
        }).join('') +
      '</div>';
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
      barRow.innerHTML = '<div class="cmp-bar-f" data-w="' + fPct + '%" style="width:0%"></div>' +
                         '<div class="cmp-bar-o" data-w="' + oPct + '%" style="width:0%"></div>';
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
      var homeLabel = g.formosa_home ? '夢主場' : opp.short + '主場';
      var homeTag = '<span class="h2h-home-tag">' + homeLabel + '</span>';
      var badge = g.won
        ? '<span class="h2h-badge h2h-w">夢勝</span>'
        : '<span class="h2h-badge h2h-l">' + opp.short + '勝</span>';
      var fColor = g.won  ? 'var(--accent)'    : 'var(--text2)';
      var oColor = !g.won ? 'var(--opp-color)' : 'var(--text2)';
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + dateStr + '</td>' +
        '<td style="font-weight:700;color:' + fColor + '">' + g.formosa_score + '</td>' +
        '<td style="color:var(--text2)">:</td>' +
        '<td style="font-weight:700;color:' + oColor + '">' + g.opp_score + '</td>' +
        '<td>' + homeTag + '</td>' +
        '<td>' + badge + '</td>';
      tbody.appendChild(tr);
    });
  }

  /* ④ 得分來源 */
  function renderScoring(fm, opp) {
    var container = document.getElementById('scoring-bars');
    container.innerHTML = '';
    var legendData = [];

    [
      { label: '夢想家', s: fm.scoring,  shades: SCORE_SHADES.formosa },
      { label: opp.short, s: opp.scoring, shades: SCORE_SHADES.opponent }
    ].forEach(function (item) {
      var colors = assignScoringColors(item.s, item.shades);
      var total = item.s.total;
      var threePct = (item.s.three / total * 100).toFixed(1);
      var midPct   = (item.s.mid   / total * 100).toFixed(1);
      var paintPct = (item.s.paint / total * 100).toFixed(1);
      var ftPct    = (100 - +threePct - +midPct - +paintPct).toFixed(1);

      var row = document.createElement('div');
      row.className = 'score-src-row';
      row.innerHTML =
        '<div class="score-src-label">' +
          '<strong>' + item.label + '</strong>' +
          '<span>三分 ' + item.s.three + '　中距 ' + item.s.mid + '　禁區 ' + item.s.paint + '　罰球 ' + item.s.ft + '　共 ' + total + ' 分</span>' +
        '</div>' +
        '<div class="score-src-bar">' +
          '<div style="width:' + threePct + '%;background:' + colors[0] + '" title="三分 ' + item.s.three + '"></div>' +
          '<div style="width:' + midPct   + '%;background:' + colors[1] + '" title="中距 ' + item.s.mid   + '"></div>' +
          '<div style="width:' + paintPct + '%;background:' + colors[2] + '" title="禁區 ' + item.s.paint + '"></div>' +
          '<div style="width:' + ftPct    + '%;background:' + colors[3] + '" title="罰球 ' + item.s.ft    + '"></div>' +
        '</div>';
      container.appendChild(row);
      legendData.push({ label: item.label, colors: colors });
    });

    var legend = document.getElementById('scoring-legend');
    if (legend) {
      var catLabels = ['三分', '中距', '禁區', '罰球'];
      var rows = legendData.map(function (d) {
        var cells = catLabels.map(function (l, i) {
          return '<div style="display:flex;align-items:center;gap:.25rem;font-size:.72rem;color:var(--text2);white-space:nowrap">' +
            '<span class="legend-dot" style="background:' + d.colors[i] + '"></span>' + l +
          '</div>';
        }).join('');
        return '<div style="font-size:.72rem;font-weight:700;color:var(--text2);white-space:nowrap">' + d.label + '</div>' + cells;
      }).join('');
      legend.style.display = 'grid';
      legend.style.gridTemplateColumns = 'auto repeat(4, 1fr)';
      legend.style.gap = '.3rem .6rem';
      legend.style.alignItems = 'center';
      legend.innerHTML = rows;
    }
  }

  /* ⑤ 主客場 */
  function renderHomeAway(fm, opp) {
    var fHomeWR = (fm.home.wins  / (fm.home.wins  + fm.home.losses  || 1) * 100);
    var oHomeWR = (opp.home.wins / (opp.home.wins + opp.home.losses || 1) * 100);
    var fAwayWR = (fm.away.wins  / (fm.away.wins  + fm.away.losses  || 1) * 100);
    var oAwayWR = (opp.away.wins / (opp.away.wins + opp.away.losses || 1) * 100);

    if (haChart) { haChart.destroy(); }
    var ctx = document.getElementById('chart-ha');
    if (!ctx) { return; }
    haChart = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: {
        labels: ['主場', '客場'],
        datasets: [
          { label: '夢想家',
            data: [fHomeWR, fAwayWR],
            backgroundColor: 'rgba(0,229,255,.55)',
            borderColor: 'rgba(0,229,255,.95)',
            borderWidth: 1.5, borderRadius: 6,
            barPercentage: 0.48, categoryPercentage: 0.65 },
          { label: opp.short,
            data: [oHomeWR, oAwayWR],
            backgroundColor: hexToRgba(opp.color, .55),
            borderColor: opp.color,
            borderWidth: 1.5, borderRadius: 6,
            barPercentage: 0.48, categoryPercentage: 0.65 }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function (c) {
                var isHome = c.dataIndex === 0;
                var isFm   = c.datasetIndex === 0;
                var d = isHome ? (isFm ? fm.home : opp.home) : (isFm ? fm.away : opp.away);
                return ' ' + c.dataset.label + '  ' + d.wins + 'W ' + d.losses + 'L  ' +
                  c.raw.toFixed(1) + '%  均分 ' + d.avg_pts.toFixed(1) + '  失分 ' + d.avg_opp.toFixed(1);
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: '#8fa3b8', font: { size: 12 } }, grid: { color: 'rgba(255,255,255,.05)' } },
          y: { min: 0, max: 100,
               ticks: { color: '#8fa3b8', callback: function (v) { return v + '%'; } },
               grid: { color: 'rgba(255,255,255,.05)' },
               title: { display: true, text: '勝率', color: '#8fa3b8', font: { size: 10 } } }
        }
      }
    });

    // 彩色文字圖例
    var prev = ctx.nextElementSibling;
    if (prev && prev.classList.contains('ha-legend')) { prev.parentNode.removeChild(prev); }
    var leg = document.createElement('div');
    leg.className = 'ha-legend';
    leg.innerHTML = '<span style="color:rgba(0,229,255,.95)">夢想家</span>' +
                    '<span style="color:' + opp.color + '">' + opp.short + '</span>';
    ctx.parentNode.insertBefore(leg, ctx.nextSibling);

    // 均分 / 失分對照（4 格）
    var statsEl = document.getElementById('ha-stats');
    if (!statsEl) { return; }
    function haCell(title, fVal, oVal, higherIsBetter) {
      var fBetter = higherIsBetter ? fVal >= oVal : fVal <= oVal;
      return '<div class="ha-stat-cell">' +
        '<div class="ha-stat-title">' + title + '</div>' +
        '<div class="ha-stat-row">' +
          '<span style="color:' + (fBetter ? 'rgba(0,229,255,.95)' : 'var(--text2)') + ';font-weight:' + (fBetter ? '700' : '400') + '">夢 ' + fVal.toFixed(1) + '</span>' +
          '<span style="color:var(--text2);margin:0 .3rem">/</span>' +
          '<span style="color:' + (!fBetter ? opp.color : 'var(--text2)') + ';font-weight:' + (!fBetter ? '700' : '400') + '">' + opp.short + ' ' + oVal.toFixed(1) + '</span>' +
        '</div>' +
      '</div>';
    }
    statsEl.innerHTML =
      '<div class="ha-stat-grid">' +
        haCell('主場 均分', fm.home.avg_pts, opp.home.avg_pts, true) +
        haCell('主場 失分', fm.home.avg_opp, opp.home.avg_opp, false) +
        haCell('客場 均分', fm.away.avg_pts, opp.away.avg_pts, true) +
        haCell('客場 失分', fm.away.avg_opp, opp.away.avg_opp, false) +
      '</div>';
  }

  /* ⑥ 節次分析 */
  function renderQuarter(fm, opp, oppFull) {
    var container = document.getElementById('quarter-grid');
    container.innerHTML = '';
    // H2H quarter 為純數字；例行賽為 {avg_score, win_rate} 物件
    function qScore(q, key) {
      var v = q[key];
      return typeof v === 'object' ? v.avg_score : v;
    }
    function qWR(q, key) {
      var v = q[key];
      return typeof v === 'object' ? pct(v.win_rate) : null;
    }
    ['Q1', 'Q2', 'Q3', 'Q4'].forEach(function (q) {
      var fScore = qScore(fm.quarter, q);
      var oScore = qScore(opp.quarter, q);
      var fBetter = fScore >= oScore;
      var wrText  = qWR(fm.quarter, q);
      var card = document.createElement('div');
      card.className = 'quarter-card';
      card.innerHTML =
        '<div class="quarter-name">' + q + '</div>' +
        '<div class="quarter-scores">' +
          '<div class="quarter-team">' +
            '<div class="quarter-score formosa" style="color:' + (fBetter ? 'var(--accent)' : 'var(--text)') + '">' + fScore.toFixed(1) + '</div>' +
            '<div style="font-size:.65rem;color:var(--text2)">夢想家</div>' +
          '</div>' +
          '<div class="quarter-sep">—</div>' +
          '<div class="quarter-team">' +
            '<div class="quarter-score opponent" style="color:' + (!fBetter ? 'var(--opp-color)' : 'var(--text)') + '">' + oScore.toFixed(1) + '</div>' +
            '<div style="font-size:.65rem;color:var(--text2)">' + opp.short + '</div>' +
          '</div>' +
        '</div>' +
        (wrText ? '<div class="quarter-winrate">夢 節勝率 ' + wrText + '</div>' : '');
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

  /* ⑧ Mann-Whitney 勝負關鍵指標（H2H 對戰場次）*/
  function renderMHU(fm, opp, oppKey) {
    var fmMhu  = D['formosa_h2h_mhu']  || D.formosa_mhu;
    var oppMhu = D[oppKey + '_h2h_mhu'] || D[oppKey + '_mhu'];
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
          '<div class="mhu-stat-name">' + s.stat + (s.sig ? '<span class="mhu-sig-star" style="color:' + item.colorVar + '"> ★</span>' : '') + '</div>' +
          '<div class="mhu-bar-track">' +
            '<div class="mhu-bar-fill" data-w="' + pct + '%" style="width:0%;background:' + fillColor + '"></div>' +
          '</div>' +
          '<div class="mhu-val" style="color:' + (s.sig ? item.colorVar : 'var(--text2)') + '">' +
            (diff >= 0 ? '+' : '') + diff.toFixed(1) +
          '</div>';
        panel.appendChild(row);
      });

      container.appendChild(panel);
    });
  }

  /* ⑨ 情境分析（H2H 對戰場次，各隊各一張） */
  function renderScenario(fm, opp, oppKey) {
    var fmS  = D['formosa_h2h_scenario']   || D.formosa_scenario;
    var oppS = D[oppKey + '_h2h_scenario'] || D[oppKey + '_scenario'];

    // 只保留雙方都有對戰場次的情境
    var idxs = fmS.reduce(function (acc, s, i) {
      if (s.n > 0 && oppS[i] && oppS[i].n > 0) { acc.push(i); }
      return acc;
    }, []);
    var fmF  = idxs.map(function (i) { return fmS[i]; });
    var oppF = idxs.map(function (i) { return oppS[i]; });
    var labels = fmF.map(function (s) { return s.label; });

    // 情境深淺色：Best 最深 → Low 最淺
    var SC_ORDER  = ['Best', 'Ideal', 'Fair', 'Low'];
    var SC_ALPHAS = [0.88, 0.65, 0.42, 0.22];
    function scAlpha(label) {
      var i = SC_ORDER.indexOf(label);
      return i >= 0 ? SC_ALPHAS[i] : 0.55;
    }

    function buildChart(ctx, scenArr, teamColor, teamShort, isFormosa) {
      var barColors   = scenArr.map(function (s) {
        return isFormosa ? 'rgba(0,229,255,' + scAlpha(s.label) + ')' : hexToRgba(teamColor, scAlpha(s.label));
      });
      var borderColors = scenArr.map(function (s) {
        return isFormosa ? 'rgba(0,229,255,.95)' : teamColor;
      });
      var scoreData = scenArr.map(function (s) { return (+s.team_mean).toFixed(1); });
      var winData   = scenArr.map(function (s) { return (s.win_rate * 100).toFixed(1); });
      var lineColor = isFormosa ? 'rgba(0,229,255,.85)' : hexToRgba(teamColor, .85);

      return new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            {
              label: teamShort + ' 場均得分',
              data: scoreData,
              backgroundColor: barColors,
              borderColor: borderColors,
              borderWidth: 1.5,
              borderRadius: 6,
              barPercentage: 0.55,
              categoryPercentage: 0.7,
              yAxisID: 'y'
            },
            {
              label: teamShort + ' 勝率',
              data: winData,
              type: 'line',
              borderColor: lineColor,
              borderDash: [4, 3],
              borderWidth: 2,
              pointBackgroundColor: lineColor,
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: false,
              tension: 0.3,
              yAxisID: 'y2'
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { labels: { color: '#8fa3b8', font: { size: 10 }, boxWidth: 20 } },
            tooltip: {
              mode: 'index', intersect: false,
              callbacks: {
                label: function (c) {
                  if (c.datasetIndex === 0) { return ' 場均得分 ' + c.raw; }
                  return ' 勝率 ' + c.raw + '%';
                }
              }
            }
          },
          scales: {
            x: { ticks: { color: '#8fa3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.05)' } },
            y: {
              position: 'left',
              suggestedMin: 70, suggestedMax: 125,
              ticks: { color: '#8fa3b8', font: { size: 10 } },
              grid: { color: 'rgba(255,255,255,.05)' },
              title: { display: true, text: '場均得分', color: '#8fa3b8', font: { size: 10 } }
            },
            y2: {
              position: 'right', min: 0, max: 100,
              ticks: { color: '#8fa3b8', font: { size: 10 }, callback: function (v) { return v + '%'; } },
              grid: { drawOnChartArea: false },
              title: { display: true, text: '勝率', color: '#8fa3b8', font: { size: 10 } }
            }
          }
        }
      });
    }

    // 夢想家圖
    if (scenarioChartF) { scenarioChartF.destroy(); }
    var ctxF = document.getElementById('chart-scenario-f');
    if (ctxF) { scenarioChartF = buildChart(ctxF, fmF, '#00e5ff', '夢想家', true); }

    // 對手圖
    var oppLbl = document.getElementById('scenario-opp-label');
    if (oppLbl) { oppLbl.textContent = opp.name; oppLbl.style.color = opp.color; }
    if (scenarioChartK) { scenarioChartK.destroy(); }
    var ctxK = document.getElementById('chart-scenario-k');
    if (ctxK) { scenarioChartK = buildChart(ctxK, oppF, opp.color, opp.short, false); }

    // 情境摘要卡片（使用 H2H 真實統計，縮寫點號並排）
    function makeCard(s, clr, isOpp) {
      var st = s.stats || {};
      var a  = scAlpha(s.label);
      var bg     = isOpp ? hexToRgba(clr, a * 0.18) : 'rgba(0,229,255,' + (a * 0.18) + ')';
      var border = isOpp ? hexToRgba(clr, a * 0.45) : 'rgba(0,229,255,' + (a * 0.45) + ')';
      var clrCss = isOpp ? 'var(--opp-color)' : 'var(--accent)';
      function stat(abbr, val) {
        return '<span class="sc-abbr">' + abbr + '</span><span class="sc-val">' + val + '</span>';
      }
      function row(items) {
        return '<div class="sc-row">' +
          items.map(function (it) { return stat(it[0], it[1]); })
               .join('<span class="sc-dot">·</span>') +
        '</div>';
      }
      var threeRow = row([['3P%', st['3P%'] != null ? st['3P%'].toFixed(1) + '%' : '—'],
                          ['3PM', st['3PM'] != null ? st['3PM'].toFixed(1) : '—']]);
      var restRow  = row([['FG%', st['FG%'] != null ? st['FG%'].toFixed(1) + '%' : '—'],
                          ['AST', st['AST'] != null ? st['AST'].toFixed(1) : '—'],
                          ['TO',  st['TO']  != null ? st['TO'].toFixed(1)  : '—']]);
      return '<div class="sc-card" style="border-color:' + border + ';background:' + bg + '">' +
        '<div class="sc-label" style="color:' + clrCss + '">' + s.label + '</div>' +
        threeRow + restRow +
        '<div class="sc-n">' + s.n + ' 場</div>' +
      '</div>';
    }

    var elF = document.getElementById('sc-cards-f');
    var elK = document.getElementById('sc-cards-k');
    if (elF) { elF.innerHTML = '<div class="sc-cards">' + fmF.map(function (s) { return makeCard(s, '#00e5ff', false); }).join('') + '</div>'; }
    if (elK) { elK.innerHTML = '<div class="sc-cards">' + oppF.map(function (s) { return makeCard(s, opp.color, true); }).join('') + '</div>'; }
  }

  /* ⑩ USG% vs TS% 散點圖（H2H，分隊各一張） */
  var USG_TS_THRESHOLD = 50; // TS% < 50% 視為低效，顯示粉色

  function renderUSGCharts(oppKey, opp) {
    var fmPlayers  = (D['h2h_formosa_usg'] || D.formosa_usg).filter(function (p) { return (p.gp || 0) >= 3; });
    var oppPlayers = (D['h2h_' + oppKey + '_usg'] || D[oppKey + '_usg']).filter(function (p) { return (p.gp || 0) >= 3; });

    function toPoint(p) {
      return { x: p.usg, y: p.tsp, r: Math.max(5, p.pts * 0.7), label: p.name, gp: p.gp };
    }
    function splitByEff(arr) {
      var hi = [], lo = [];
      arr.forEach(function (p) {
        (p.tsp >= USG_TS_THRESHOLD ? hi : lo).push(toPoint(p));
      });
      return { hi: hi, lo: lo };
    }

    var tooltipCb = {
      label: function (c) {
        var d = c.raw;
        return d.label + '  USG ' + d.x + '%  TS ' + d.y + '%  (' + d.gp + '場)';
      }
    };
    var scalesBase = {
      x: {
        title: { display: true, text: 'USG%', color: '#8fa3b8', font: { size: 11 } },
        ticks: { color: '#8fa3b8' },
        grid: { color: 'rgba(255,255,255,.05)' }
      },
      y: {
        title: { display: true, text: 'TS%', color: '#8fa3b8', font: { size: 11 } },
        ticks: { color: '#8fa3b8' },
        grid: { color: 'rgba(255,255,255,.05)' },
        suggestedMin: 0, suggestedMax: 100
      }
    };

    function usgLegend(canvasId, teamColor, teamLabel) {
      var canvas = document.getElementById(canvasId);
      if (!canvas) { return; }
      // 移除舊圖例（重繪時避免重複）
      var prev = canvas.nextElementSibling;
      if (prev && prev.classList.contains('usg-legend')) { prev.parentNode.removeChild(prev); }
      var div = document.createElement('div');
      div.className = 'usg-legend';
      div.innerHTML =
        '<span style="color:' + teamColor + '">' + teamLabel + ' 高效（TS≥50%）</span>' +
        '<span style="color:rgba(240,98,146,.95)">低效（TS＜50%）</span>';
      canvas.parentNode.insertBefore(div, canvas.nextSibling);
    }

    function buildUsgChart(canvasId, players, teamLabel, mainBg, mainBorder, teamColor) {
      var split = splitByEff(players);
      var chart = new Chart(document.getElementById(canvasId).getContext('2d'), {
        type: 'bubble',
        data: {
          datasets: [
            { label: teamLabel + ' 高效', data: split.hi,
              backgroundColor: mainBg, borderColor: mainBorder, borderWidth: 1.5 },
            { label: '低效', data: split.lo,
              backgroundColor: 'rgba(240,98,146,.55)', borderColor: 'rgba(240,98,146,.9)', borderWidth: 1.5 }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: tooltipCb }
          },
          scales: scalesBase
        }
      });
      usgLegend(canvasId, teamColor, teamLabel);
      return chart;
    }

    if (usgChartF) { usgChartF.destroy(); }
    usgChartF = buildUsgChart('chart-usg-f', fmPlayers, '夢想家',
      'rgba(0,229,255,.55)', 'rgba(0,229,255,.9)', '#00e5ff');

    if (usgChartK) { usgChartK.destroy(); }
    var oppLbl = document.getElementById('usg-opp-label');
    if (oppLbl) { oppLbl.textContent = opp.short; oppLbl.style.color = opp.color; }
    usgChartK = buildUsgChart('chart-usg-k', oppPlayers, opp.short,
      hexToRgba(opp.color, .5), opp.color, opp.color);
  }

  /* ★ 冠軍戰球員數據・系列賽至今（Plus/Minus + PPP） */
  function renderChampTodate(oppKey, opp) {
    var sec = document.getElementById('champ-todate');
    if (!sec) { return; }
    var fmPM   = D.formosa_champ_pm;
    var oppPM  = D[oppKey + '_champ_pm'];
    var fmPPP  = D.formosa_champ_ppp;
    var oppPPP = D[oppKey + '_champ_ppp'];

    // 系列賽尚未開打 → 隱藏整個區塊
    if (!fmPM || !fmPM.length) { sec.style.display = 'none'; return; }
    sec.style.display = '';

    var n = (D.formosa_champ && D.formosa_champ.gp) || 0;
    setSecTitle('champ-todate', '冠軍戰球員數據・系列賽至今（' + n + ' 場）');

    var fmActive  = buildActiveMap(D.formosa.players);
    var oppActive = buildActiveMap(opp.players);

    renderMiniBar('champ-pm-compare', fmPM, oppPM, D.formosa, opp, 'pm',
      'var(--accent)', 'var(--opp-color)', fmActive, oppActive);
    renderPppGrid('champ-ppp-compare', fmPPP, oppPPP, opp, fmActive, oppActive);
  }

  /* ⑫ Plus/Minus 與 PPP 熱力圖（折疊）*/
  function filterByTime(arr) {
    if (!arr) { return arr; }
    return arr.filter(function (p) { return (p.gp || 0) >= 3; });
  }

  function renderHeatmaps(fm, opp, oppKey) {
    var fmPM  = filterByTime(D['formosa_hm_' + oppKey]);
    var oppPM = filterByTime(D[oppKey + '_hm_formosa']);
    var fmPPP  = filterByTime(D['formosa_ppp_' + oppKey]);
    var oppPPP = filterByTime(D[oppKey + '_ppp_formosa']);

    var fmActive  = buildActiveMap(fm.players);
    var oppActive = buildActiveMap(opp.players);

    renderMiniBar('pm-compare', fmPM, oppPM, fm, opp, 'pm', 'var(--accent)', 'var(--opp-color)', fmActive, oppActive);
    renderPppGrid('ppp-compare', fmPPP, oppPPP, opp, fmActive, oppActive);
  }

  /* PPP 格子：正值才有意義，用色深淺表示高低 */
  function renderPppGrid(containerId, fmData, oppData, opp, fmActive, oppActive) {
    var container = document.getElementById(containerId);
    container.innerHTML = '';

    var fRgb  = '0,229,255';
    var oRgb  = hexToRgb(opp.color);

    [
      { label: '夢想家', data: fmData,  rgb: fRgb,  colorVar: 'var(--accent)',    activeMap: fmActive  || {} },
      { label: opp.short, data: oppData, rgb: oRgb, colorVar: 'var(--opp-color)', activeMap: oppActive || {} }
    ].forEach(function (item) {
      var panel = document.createElement('div');
      panel.style.marginBottom = '1rem';

      var title = document.createElement('div');
      title.className = 'ppp-panel-title';
      title.style.color = item.colorVar;
      title.textContent = item.label;
      panel.appendChild(title);

      if (!item.data || !item.data.length) {
        var empty = document.createElement('div');
        empty.style.cssText = 'font-size:.78rem;color:var(--text2)';
        empty.textContent = '—';
        panel.appendChild(empty);
        container.appendChild(panel);
        return;
      }

      // 計算最大最小值（只算在籍球員）
      var actVals = item.data
        .filter(function (p) { return item.activeMap[p.player] !== false; })
        .map(function (p) { return p.ppp || 0; });
      var maxV = actVals.length ? Math.max.apply(null, actVals) : 1;
      var minV = actVals.length ? Math.min.apply(null, actVals) : 0;
      var range = maxV - minV || 1;

      var grid = document.createElement('div');
      grid.className = 'ppp-grid';

      item.data.forEach(function (p) {
        var isActive = item.activeMap[p.player] !== false;
        var val = p.ppp || 0;
        var norm = isActive ? Math.max(0, Math.min(1, (val - minV) / range)) : 0;
        var alpha = isActive ? (0.12 + norm * 0.73) : 0.07;
        var textAlpha = isActive ? (0.55 + norm * 0.45) : 0.35;

        var cell = document.createElement('div');
        cell.className = 'ppp-cell';
        cell.style.background = 'rgba(' + item.rgb + ',' + alpha.toFixed(2) + ')';
        if (!isActive) { cell.style.opacity = '0.4'; }

        cell.innerHTML =
          '<div class="ppp-cell-name">' + p.player + '</div>' +
          '<div class="ppp-cell-val" style="color:rgba(' + item.rgb + ',' + textAlpha.toFixed(2) + ')">' +
            val.toFixed(2) +
          '</div>';
        grid.appendChild(cell);
      });

      panel.appendChild(grid);
      container.appendChild(panel);
    });
  }

  function buildActiveMap(players) {
    var map = {};
    if (!players) { return map; }
    players.forEach(function (p) {
      map[p.name] = (p.active !== false) && !p.injured;
    });
    return map;
  }

  function renderMiniBar(containerId, fmData, oppData, fm, opp, field, fColor, oColor, fmActive, oppActive) {
    var container = document.getElementById(containerId);
    container.innerHTML = '';

    [
      { label: '夢想家', data: fmData,  color: fColor, activeMap: fmActive  || {} },
      { label: opp.short, data: oppData, color: oColor, activeMap: oppActive || {} }
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
        if (item.activeMap[p.player] === false) { return; }
        var v = Math.abs(p[field] || 0);
        if (v > maxAbs) { maxAbs = v; }
      });

      item.data.forEach(function (p) {
        var isActive = item.activeMap[p.player] !== false;
        var val = p[field] || 0;
        var barPct = maxAbs > 0 ? Math.min(50, Math.abs(val) / maxAbs * 50).toFixed(1) : 0;
        var isPos = val >= 0;

        var fillColor = !isActive ? 'rgba(143,163,184,.35)' : (isPos ? 'rgba(0,229,255,.75)' : 'rgba(240,98,146,.75)');
        var valColor  = !isActive ? 'var(--text2)' : (isPos ? 'var(--accent)' : 'var(--accent2)');

        var row = document.createElement('div');
        row.className = 'mini-bar-row';
        if (!isActive) { row.style.opacity = '0.38'; }
        row.innerHTML =
          '<div class="mini-bar-name">' + p.player +
            (!isActive ? ' <span style="font-size:.58rem;color:var(--text2)">(傷)</span>' : '') +
          '</div>' +
          '<div class="mini-bar-track">' +
            '<div class="mini-bar-axis"></div>' +
            '<div class="mini-bar-fill ' + (isPos ? 'mini-bar-pos' : 'mini-bar-neg') +
              '" data-w="' + barPct + '%" style="width:0%;background:' + fillColor + '"></div>' +
          '</div>' +
          '<div class="mini-bar-val" style="color:' + valColor + '">' +
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
    { label: 'G5', date: '6/2',  home: 'f', tbd: false },
    { label: 'G6', date: '6/4',  home: 'o', tbd: false },
    { label: 'G7', date: '6/6',  home: 'f', tbd: true }
  ];

  /* Monte Carlo 模擬（指定主客場勝率） */
  function simSeries(pHome, pAway, sched, fNeed, kNeed) {
    var N = 300000;
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
    var N = 300000;
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

  /* ⑩·5 預測回顧 — 評估模型賽前機率的準確度（資料驅動，系列賽每加一場自動更新） */
  function renderReview(effF, effO, h2h) {
    var card = document.getElementById('review-card');
    if (!card) { return; }
    var games = (D.championship_series || []).filter(function (g) { return g.opp_key === currentOpp; });
    var oppName = D[currentOpp] ? D[currentOpp].name : '對手';
    var oppShort = D[currentOpp] ? D[currentOpp].short : '對手';

    if (games.length === 0) {
      card.innerHTML = '<div class="rev-intro">系列賽尚未開打，待開賽後此處將自動評估每場賽前預測的準確度。</div>';
      return;
    }

    var netDiff = effF.netrtg - effO.netrtg;
    var h2hWins = h2h.filter(function (g) { return g.won; }).length;
    var h2hWinRate = h2hWins / h2h.length;

    function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

    // 重建「進入第 i 場前」的模型參數（與 renderPrediction 同公式）
    function preGame(i) {
      var fw = 0;
      for (var j = 0; j < i; j++) { if (games[j].won) { fw++; } }
      var fwr = i === 0 ? h2hWinRate : fw / i;
      var netProb  = clamp(0.5 + netDiff * 0.025, 0.18, 0.82);
      var gameProb = clamp(netProb * 0.6 + fwr * 0.4, 0.22, 0.78);
      var pH = Math.min(0.82, gameProb + 0.10);
      var pA = Math.max(0.18, gameProb - 0.10);
      return { pH: pH, pA: pA, fw: fw };
    }

    // 列舉剩餘賽程的系列賽奪冠機率（≤7 場，直接展開）
    function champProb(pH, pA, sched, fNeed, oNeed) {
      var total = 0;
      (function rec(idx, f, o, prob) {
        if (f >= fNeed) { total += prob; return; }
        if (o >= oNeed) { return; }
        var p = sched[idx] === 'h' ? pH : pA;
        rec(idx + 1, f + 1, o, prob * p);
        rec(idx + 1, f, o + 1, prob * (1 - p));
      })(0, 0, 0, 1);
      return total;
    }

    // 逐場：賽前單場夢勝率(fp)、賽前奪冠機率(cp)、實際結果(won)
    var rows = [];
    games.forEach(function (g, i) {
      var pg = preGame(i);
      var home = g.formosa_home;
      var fp = home ? pg.pH : pg.pA;
      var ow = i - pg.fw;
      var cp = champProb(pg.pH, pg.pA, SERIES_SCHEDULE.slice(i), 4 - pg.fw, 4 - ow);
      rows.push({ label: g.game, date: g.date, home: home, fp: fp, cp: cp, won: g.won, fScore: g.formosa_score, oScore: g.opp_score });
    });

    // ── 整體指標 ──
    var n = rows.length;
    var brierSum = 0, logSum = 0, dirHit = 0, dirPicks = 0, absSum = 0;
    var fmFav = 0, fmFavWin = 0, oFav = 0, oFavWin = 0;
    rows.forEach(function (r) {
      var y = r.won ? 1 : 0;
      var p = clamp(r.fp, 1e-6, 1 - 1e-6);
      brierSum += (p - y) * (p - y);
      logSum   += -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
      absSum   += Math.abs(r.fp - y);
      if (Math.abs(r.fp - 0.5) > 1e-9) {
        dirPicks++;
        var pickF = r.fp > 0.5;
        if (pickF === r.won) { dirHit++; }
      }
      if (r.fp > 0.5)      { fmFav++; if (r.won)  { fmFavWin++; } }
      else if (r.fp < 0.5) { oFav++;  if (!r.won) { oFavWin++;  } }
    });
    var brier = brierSum / n;
    var logloss = logSum / n;
    var mae = absSum / n;
    var dirPct = dirPicks ? Math.round(dirHit / dirPicks * 100) : 0;

    // 系列賽是否已分曉、冠軍歸屬
    var fWins = rows.filter(function (r) { return r.won; }).length;
    var oWins = n - fWins;
    var decided = fWins >= 4 || oWins >= 4;
    var formosaChamp = fWins >= 4;
    var finalY = formosaChamp ? 1 : 0;          // 真實冠軍歸屬（夢想家=1）
    var preSeriesCp = rows[0].cp;               // 賽前（G1 前）模型給的夢奪冠機率
    var preFav = preSeriesCp >= 0.5 ? 'formosa' : (preSeriesCp > 0 && preSeriesCp < 0.5 ? 'opp' : 'tie');

    // 奪冠機率最大誤差（相對最終真實結果）— 僅在已分曉時有意義
    var maxErr = 0, maxErrGame = '';
    if (decided) {
      rows.forEach(function (r) {
        var e = Math.abs(r.cp - finalY);
        if (e > maxErr) { maxErr = e; maxErrGame = r.label; }
      });
    }

    function grade(v, goodLt, midLt) { return v < goodLt ? 'rev-grade-good' : (v < midLt ? 'rev-grade-mid' : 'rev-grade-bad'); }

    var html = '';

    // 待補提示
    if (!decided) {
      html += '<div class="rev-pending">系列賽尚未分曉（目前 <strong>夢想家 ' + fWins + ' – ' + oWins + ' ' + oppShort +
        '</strong>）。以下回顧涵蓋已打的 <strong>' + n + ' 場</strong>，G7 數據寫入後將自動補上最終奪冠判定。</div>';
    }

    html += '<div class="rev-intro">評估方式：用與上方預測<strong>完全相同的模型公式</strong>，重建「每場開打前」模型對夢想家的勝率，' +
      '再與實際結果比對。<strong>Brier Score</strong> 與 <strong>Log Loss</strong> 越低代表機率校準越準；' +
      '擲硬幣基準為 Brier 0.250、Log Loss 0.693。</div>';

    // ── 指標卡 ──
    var dirCls = dirPct >= 60 ? 'rev-grade-good' : (dirPct >= 50 ? 'rev-grade-mid' : 'rev-grade-bad');
    html += '<div class="rev-metrics">';
    html += '<div class="rev-metric"><div class="rev-metric-num ' + grade(brier, 0.20, 0.25) + '">' + brier.toFixed(3) + '</div>' +
      '<div class="rev-metric-label">Brier Score</div><div class="rev-metric-sub">擲硬幣 0.250</div></div>';
    html += '<div class="rev-metric"><div class="rev-metric-num ' + grade(logloss, 0.65, 0.693) + '">' + logloss.toFixed(3) + '</div>' +
      '<div class="rev-metric-label">Log Loss</div><div class="rev-metric-sub">擲硬幣 0.693</div></div>';
    html += '<div class="rev-metric"><div class="rev-metric-num ' + dirCls + '">' + dirHit + '/' + dirPicks + '</div>' +
      '<div class="rev-metric-label">單場方向命中</div><div class="rev-metric-sub">' + dirPct + '%</div></div>';
    if (decided) {
      var champErrCls = maxErr < 0.4 ? 'rev-grade-good' : (maxErr < 0.65 ? 'rev-grade-mid' : 'rev-grade-bad');
      html += '<div class="rev-metric"><div class="rev-metric-num ' + champErrCls + '">' + Math.round(maxErr * 100) + '%</div>' +
        '<div class="rev-metric-label">奪冠機率最大誤差</div><div class="rev-metric-sub">' + maxErrGame + ' 賽前</div></div>';
    } else {
      html += '<div class="rev-metric"><div class="rev-metric-num" style="color:var(--text2)">' + Math.round(mae * 100) + '%</div>' +
        '<div class="rev-metric-label">單場平均誤差</div><div class="rev-metric-sub">|機率−結果|</div></div>';
    }
    html += '</div>';

    // ── 逐場對照表 ──
    html += '<div class="rev-section-title">每場賽前預測 vs 實際</div>';
    html += '<div style="overflow-x:auto"><table class="rev-tbl"><thead><tr>' +
      '<th>場次</th><th>主/客</th><th>賽前夢勝率</th><th>實際</th><th>方向</th><th>賽前夢奪冠</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var resTxt = r.won ? ('夢 ' + r.fScore + '–' + r.oScore) : (oppShort + ' ' + r.oScore + '–' + r.fScore);
      var resCls = r.won ? 'rev-hit' : 'rev-miss';
      var pick = Math.abs(r.fp - 0.5) <= 1e-9 ? null : (r.fp > 0.5);
      var hit = pick === null ? null : (pick === r.won);
      var dirTxt = hit === null ? '—' : (hit ? '✓' : '✗');
      var dirCellCls = hit === null ? '' : (hit ? 'rev-hit' : 'rev-miss');
      html += '<tr>' +
        '<td class="rev-game">' + r.label + '</td>' +
        '<td>' + (r.home ? '主' : '客') + '</td>' +
        '<td>' + Math.round(r.fp * 100) + '%</td>' +
        '<td class="' + resCls + '">' + resTxt + '</td>' +
        '<td class="' + dirCellCls + '">' + dirTxt + '</td>' +
        '<td>' + Math.round(r.cp * 100) + '%</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';

    // ── 奪冠機率軌跡 ──
    html += '<div class="rev-section-title">夢想家奪冠機率・賽前軌跡</div>';
    html += '<div class="rev-traj">';
    rows.forEach(function (r) {
      var pct = Math.round(r.cp * 100);
      var col = r.won ? 'rgba(0,229,255,.75)' : 'rgba(var(--opp-rgb),.7)';
      html += '<div class="rev-traj-row">' +
        '<div class="rev-traj-label">' + r.label + ' 賽前</div>' +
        '<div class="rev-traj-bar-bg"><div class="rev-traj-bar-fill" data-w="' + pct + '%" style="width:0%;background:rgba(0,229,255,.7)"></div></div>' +
        '<div class="rev-traj-val" style="color:var(--accent)">' + pct + '%</div>' +
        '</div>';
    });
    if (decided) {
      var champCol = formosaChamp ? 'var(--accent)' : 'var(--opp-color)';
      var champFill = formosaChamp ? 'rgba(0,229,255,.85)' : 'rgba(var(--opp-rgb),.8)';
      html += '<div class="rev-traj-row">' +
        '<div class="rev-traj-label" style="color:' + champCol + ';font-weight:700">最終結果</div>' +
        '<div class="rev-traj-bar-bg"><div class="rev-traj-bar-fill" data-w="100%" style="width:0%;background:' + champFill + '"></div></div>' +
        '<div class="rev-traj-val" style="color:' + champCol + '">' + (formosaChamp ? '奪冠' : '落敗') + '</div>' +
        '</div>';
    }
    html += '</div>';

    // ── 總結 ──
    html += buildReviewVerdict({
      decided: decided, formosaChamp: formosaChamp, fWins: fWins, oWins: oWins,
      brier: brier, logloss: logloss, dirHit: dirHit, dirPicks: dirPicks,
      preSeriesCp: preSeriesCp, preFav: preFav, rows: rows, maxErr: maxErr, maxErrGame: maxErrGame,
      fmFav: fmFav, fmFavWin: fmFavWin, oFav: oFav, oFavWin: oFavWin,
      oppName: oppName, oppShort: oppShort
    });

    card.innerHTML = html;

    // 動畫：軌跡與表格 bar
    requestAnimationFrame(function () {
      card.querySelectorAll('.rev-traj-bar-fill').forEach(function (el) {
        el.style.width = el.getAttribute('data-w');
      });
    });
  }

  /* 預測回顧・文字總結（依系列賽結果動態生成） */
  function buildReviewVerdict(o) {
    var champName = o.formosaChamp ? '福爾摩沙夢想家' : o.oppName;
    var lowest = o.rows.reduce(function (a, b) { return b.cp < a.cp ? b : a; }, o.rows[0]);
    var html = '<div class="rev-verdict">';
    html += '<div class="rev-v-title">總結・模型準不準？</div>';

    if (!o.decided) {
      html += '目前 <strong>' + o.rows.length + '</strong> 場的賽前預測，Brier <strong>' + o.brier.toFixed(3) +
        '</strong>、Log Loss <strong>' + o.logloss.toFixed(3) + '</strong>，' +
        (o.brier < 0.25 ? '優於擲硬幣基準（0.250）' : '與擲硬幣基準（0.250）相當') + '；' +
        '單場方向命中 <strong>' + o.dirHit + '/' + o.dirPicks + '</strong>。' +
        '系列賽走到 <strong>夢想家 ' + o.fWins + ' – ' + o.oWins + ' ' + o.oppShort +
        '</strong>，最終奪冠判定待 G7 數據寫入後自動補完。';
      html += '</div>';
      return html;
    }

    // 已分曉
    var dirRight = o.preFav === (o.formosaChamp ? 'formosa' : 'opp');
    html += '系列賽結果：<strong>' + champName + '</strong>以 ' +
      (o.formosaChamp ? o.fWins + '–' + o.oWins : o.oWins + '–' + o.fWins) + ' 奪冠。';
    html += '賽前（G1 前）模型給夢想家的奪冠機率為 <strong>' + Math.round(o.preSeriesCp * 100) + '%</strong>，' +
      (dirRight ? '方向<strong class="rev-hit">押對</strong>了最終冠軍。' : '方向<strong class="rev-miss">押錯</strong>了——模型較看好' +
        (o.preFav === 'formosa' ? '夢想家' : o.oppShort) + '，實際由' + champName + '奪冠。');
    html += '<br><br>';
    html += '整體校準：Brier <strong>' + o.brier.toFixed(3) + '</strong>（擲硬幣 0.250）、Log Loss <strong>' +
      o.logloss.toFixed(3) + '</strong>（擲硬幣 0.693），' +
      (o.brier < 0.25 ? '<strong class="rev-hit">優於</strong>盲猜' : '<strong class="rev-miss">未勝過</strong>盲猜') +
      '；單場方向命中 <strong>' + o.dirHit + '/' + o.dirPicks + '</strong>。';
    html += '<br><br>';
    // 最大誤差敘事
    html += '最大誤判落在 <strong>' + o.maxErrGame + ' 賽前</strong>：當時模型只給' +
      (o.formosaChamp ? '夢想家' : o.oppShort) + ' <strong>' + Math.round(lowest.cp * 100) + '%</strong> 奪冠機率' +
      (o.formosaChamp ? '（夢想家當時面臨淘汰）' : '') + '，與最終奪冠的事實相差 <strong>' + Math.round(o.maxErr * 100) + '%</strong>。' +
      (o.formosaChamp ? '模型在夢想家背水一戰時明顯低估其韌性——這也是純數據模型難以捕捉的「氣勢」與臨場調整。' :
        '模型多次高估夢想家，' + o.oppShort + '在關鍵場次的執行力超出數據預期。');
    html += '</div>';
    return html;
  }

  /* ⑪ 勝負預測 */
  function renderPrediction(fm, opp, h2h, hasChamp) {
    var card = document.getElementById('pred-card');
    if (!card) { return; }
    card.innerHTML = '';

    // 讀取已打的冠軍賽場次
    var seriesPlayed = (D.championship_series || []).filter(function(g){ return g.opp_key === currentOpp; });
    var fSeriesW = seriesPlayed.filter(function(g){ return g.won; }).length;
    var oSeriesW = seriesPlayed.length - fSeriesW;

    var wins = h2h.filter(function (g) { return g.won; }).length;
    var h2hWinRate = wins / h2h.length;
    // 近況勝率：有冠軍戰資料時改採系列賽當前戰績
    var formWinRate = (hasChamp && seriesPlayed.length > 0)
      ? (fSeriesW / seriesPlayed.length) : h2hWinRate;
    var netDiff = fm.netrtg - opp.netrtg;
    var netProb = Math.min(0.82, Math.max(0.18, 0.5 + netDiff * 0.025));
    var gameProb = Math.min(0.78, Math.max(0.22, netProb * 0.6 + formWinRate * 0.4));
    var HOME_BOOST = 0.10;
    var pH = Math.min(0.82, gameProb + HOME_BOOST);
    var pA = Math.max(0.18, gameProb - HOME_BOOST);

    // 依系列賽現況計算剩餘機率
    var remainSched = SERIES_SCHEDULE.slice(seriesPlayed.length);
    var fNeed = 4 - fSeriesW;
    var oNeed = 4 - oSeriesW;
    var seriesProb = simSeries(pH, pA, remainSched, fNeed, oNeed);
    var fPct = Math.round(seriesProb * 100);
    var oPct = 100 - fPct;

    // 路徑分佈（從剩餘賽程計算）
    var paths = computePaths(pH, pA, remainSched);
    // 補齊路徑（需 pad 到 4 個 bucket，fNeed 決定起始）
    var fPaths = [0,0,0,0], oPaths = [0,0,0,0];
    for (var pi = 0; pi < 4; pi++) {
      fPaths[pi + (4 - fNeed)] = paths.f[pi] || 0;
      oPaths[pi + (4 - oNeed)] = paths.k[pi] || 0;
    }
    var allP = fPaths.concat(oPaths);
    var maxP = Math.max.apply(null, allP.map(function(v){ return v*100; }));

    var html = '';

    // ── 賽程圓點 ──
    html += '<div class="pred-schedule">';
    SERIES_GAMES.forEach(function (g, idx) {
      var played = idx < seriesPlayed.length ? seriesPlayed[idx] : null;
      var cls, tooltip;
      var homeTag = g.home === 'f' ? '夢主場' : opp.short + '主';
      if (played) {
        cls = played.won ? 'result-f' : 'result-o';
        tooltip = g.label + ' ' + g.date + ' ' + (played.won ? '夢 ' + played.formosa_score + '-' + played.opp_score + ' 王' : '王 ' + played.opp_score + '-' + played.formosa_score + ' 夢') + '（' + (played.note || '') + '）';
      } else if (g.tbd) {
        cls = 'tbd';
        tooltip = g.label + ' 如需要';
      } else {
        cls = g.home === 'f' ? 'home-f' : 'home-o';
        tooltip = g.label + ' ' + g.date + ' ' + homeTag;
      }
      var subLabel;
      if (played) {
        subLabel = played.won ? 'D' : 'K';
      } else if (g.tbd) {
        subLabel = '待定';
      } else {
        subLabel = g.date;
      }
      html +=
        '<div class="pred-game-dot ' + cls + '" title="' + tooltip + '">' +
          '<span>' + g.label + '</span>' +
          '<span style="font-size:.5rem;opacity:.8">' + subLabel + '</span>' +
        '</div>';
    });
    html += '</div>';

    // ── 系列賽比分（若已開打）──
    if (seriesPlayed.length > 0) {
      var fLead = fSeriesW > oSeriesW;
      var oLead = oSeriesW > fSeriesW;
      html +=
        '<div style="text-align:center;margin:.6rem 0 .8rem;font-size:.9rem;color:var(--text2)">' +
          '系列賽現況：' +
          '<span style="color:var(--accent);font-weight:700">夢想家 ' + fSeriesW + '</span>' +
          ' – ' +
          '<span style="color:var(--opp-color);font-weight:700">' + oSeriesW + ' ' + opp.short + '</span>' +
          (fLead ? '&nbsp;（夢想家領先）' : oLead ? '&nbsp;（' + opp.short + '領先）' : '&nbsp;（平局）') +
        '</div>';
    }

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

    // ── G1 效應 / G1 結果 ──
    if (seriesPlayed.length === 0) {
      // 賽前：顯示 G1 預測效應
      var schedG2on = SERIES_SCHEDULE.slice(1);
      var afterWin  = simSeries(pH, pA, schedG2on, 3, 4);
      var afterLose = simSeries(pH, pA, schedG2on, 4, 3);
      var g1WinPct   = Math.round(pH * 100);
      var afterWinPct  = Math.round(afterWin  * 100);
      var afterLosePct = Math.round(afterLose * 100);
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
    } else {
      // 賽中：顯示最近一場結果卡
      var latestG = seriesPlayed[seriesPlayed.length - 1];
      var gWon = latestG.won;
      var gFScore = latestG.formosa_score;
      var gOScore = latestG.opp_score;
      var gNote  = latestG.note || '';
      var nextIdx = seriesPlayed.length; // 下一場索引
      var nextG = nextIdx < SERIES_GAMES.length ? SERIES_GAMES[nextIdx] : null;
      html +=
        '<div class="pred-g1-card">' +
          '<div class="pred-g1-title">' + latestG.game + ' 結果（' + latestG.date.slice(4,6) + '/' + latestG.date.slice(6,8) + ' 夢想家' + (latestG.formosa_home ? '主場' : '客場') + '）</div>' +
          '<div style="display:flex;justify-content:center;align-items:center;gap:1.2rem;margin:.6rem 0 .5rem;flex-wrap:wrap">' +
            '<div style="text-align:center">' +
              '<div style="font-size:.7rem;color:var(--text2);margin-bottom:.15rem">福爾摩沙夢想家</div>' +
              '<div style="font-size:2rem;font-weight:900;color:' + (gWon ? 'var(--accent)' : 'var(--text2)') + '">' + gFScore + '</div>' +
            '</div>' +
            '<div style="font-size:1.1rem;color:var(--text2);align-self:center">–</div>' +
            '<div style="text-align:center">' +
              '<div style="font-size:.7rem;color:var(--text2);margin-bottom:.15rem">' + opp.name + '</div>' +
              '<div style="font-size:2rem;font-weight:900;color:' + (!gWon ? 'var(--opp-color)' : 'var(--text2)') + '">' + gOScore + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="text-align:center;font-size:.72rem;color:var(--text2);margin-bottom:.5rem">' + (gNote ? '★ ' + gNote : '') + '</div>' +
          '<div style="border-top:1px solid rgba(255,255,255,.07);padding-top:.5rem;font-size:.7rem;color:var(--text2);line-height:1.55">' +
            (nextG ? '下一場 ' + nextG.label + '（' + nextG.date + ' ' + (nextG.home === 'f' ? '夢想家主場 台中' : opp.short + '主場 新莊') + '）。' : '系列賽結束。') +
            'G1、G2、G5、G7 夢想家主場（台中）；G3、G4、G6 ' + opp.short + '主場（新莊）。' +
          '</div>' +
        '</div>';
    }

    // ── 路徑分佈 ──
    if (seriesPlayed.length === 0) {
      // 賽前：完整路徑分佈
      var paths0 = computePaths(pH, pA, SERIES_SCHEDULE);
      var allP0 = paths0.f.concat(paths0.k).map(function(v){ return v*100; });
      var maxP0 = Math.max.apply(null, allP0);
      html += '<div class="pred-paths">';
      html += '<div class="pred-path-title" style="color:var(--accent)">夢想家奪冠路徑　合計 ' + fPct + '%</div>';
      ['4-0','4-1','4-2','4-3'].forEach(function (lbl, i) {
        var v = (paths0.f[i] * 100).toFixed(0);
        var bw = maxP0 > 0 ? (paths0.f[i] * 100 / maxP0 * 100).toFixed(1) : 0;
        html += '<div class="pred-path-row"><div class="pred-path-label">夢 ' + lbl + '</div>' +
          '<div class="pred-path-bar-bg"><div class="pred-path-bar-fill" data-w="' + bw + '%" style="width:0%;background:rgba(0,229,255,.75)"></div></div>' +
          '<div class="pred-path-val" style="color:var(--accent)">' + v + '%</div></div>';
      });
      html += '<div class="pred-path-title" style="color:var(--opp-color);margin-top:.65rem">' + opp.short + ' 奪冠路徑　合計 ' + oPct + '%</div>';
      ['4-0','4-1','4-2','4-3'].forEach(function (lbl, i) {
        var v = (paths0.k[i] * 100).toFixed(0);
        var bw = maxP0 > 0 ? (paths0.k[i] * 100 / maxP0 * 100).toFixed(1) : 0;
        html += '<div class="pred-path-row"><div class="pred-path-label">' + opp.short + ' ' + lbl + '</div>' +
          '<div class="pred-path-bar-bg"><div class="pred-path-bar-fill" data-w="' + bw + '%" style="width:0%;background:rgba(var(--opp-rgb),.75)"></div></div>' +
          '<div class="pred-path-val" style="color:var(--opp-color)">' + v + '%</div></div>';
      });
      html += '</div>';
    }

    // ── 說明 ──
    var netSrcLabel = hasChamp ? '冠軍戰至今 NetRtg 差距 ' : 'Net Rating 差距 ';
    var formNote = (hasChamp && seriesPlayed.length > 0)
      ? '，冠軍賽 ' + fSeriesW + '-' + oSeriesW + '（例行賽 H2H ' + wins + '勝' + (h2h.length - wins) + '敗）'
      : '，H2H ' + wins + '勝' + (h2h.length - wins) + '敗';
    html +=
      '<div class="pred-note" style="margin-bottom:.85rem">' +
        netSrcLabel + (netDiff >= 0 ? '+' : '') + netDiff.toFixed(1) +
        formNote + '。' +
        '主場勝率 ' + Math.round(pH * 100) + '%・客場 ' + Math.round(pA * 100) + '%。Monte Carlo 30萬次模擬。僅供參考。' +
      '</div>';

    // ── 優劣因子 ──
    html += '<div class="pred-factors" id="pred-factors"></div>';
    card.innerHTML = html;

    var fHomeWR  = fm.home.win_rate  !== undefined ? fm.home.win_rate  : fm.home.wins  / (fm.home.wins  + fm.home.losses  || 1);
    var oHomeWR  = opp.home.win_rate !== undefined ? opp.home.win_rate : opp.home.wins / (opp.home.wins + opp.home.losses || 1);
    var pfx = hasChamp ? '冠軍賽 ' : 'H2H ';
    // 從系列賽場次計算三分命中數與失誤數均值
    var f3pmSum = 0, o3pmSum = 0, ftovSum = 0, otovSum = 0;
    seriesPlayed.forEach(function (g) {
      f3pmSum += (g.formosa_stats && g.formosa_stats['3pm']) || 0;
      o3pmSum += (g.opp_stats    && g.opp_stats['3pm'])    || 0;
      ftovSum += (g.formosa_stats && g.formosa_stats.tov)  || 0;
      otovSum += (g.opp_stats    && g.opp_stats.tov)      || 0;
    });
    var gpN = seriesPlayed.length || 1;
    var f3pmAvg = f3pmSum / gpN, o3pmAvg = o3pmSum / gpN;
    var ftovAvg = ftovSum / gpN, otovAvg = otovSum / gpN;
    var fmt1 = function (v) { return v.toFixed(1); };
    var factors = [
      { name: pfx + 'NetRtg',   fVal: fm.netrtg, oVal: opp.netrtg, higherBetter: true,  fmt: function (v) { return (v >= 0 ? '+' : '') + v; } },
      { name: '進攻效率 ORtg',   fVal: fm.ortg,   oVal: opp.ortg,   higherBetter: true,  fmt: function (v) { return v; } },
      { name: '防守效率 DRtg',   fVal: fm.drtg,   oVal: opp.drtg,   higherBetter: false, fmt: function (v) { return v; } },
      { name: pfx + '主場勝率',  fVal: fHomeWR,   oVal: oHomeWR,    higherBetter: true,  fmt: pct },
      { name: '場均三分命中', fVal: f3pmAvg, oVal: o3pmAvg, higherBetter: true,  fmt: fmt1 },
      { name: '場均失誤',     fVal: ftovAvg, oVal: otovAvg, higherBetter: false, fmt: fmt1 }
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
        '<div style="display:flex;align-items:baseline;gap:.2rem;font-size:.7rem;margin-bottom:.15rem;white-space:nowrap;overflow:hidden">' +
          '<span style="color:var(--accent)">夢&nbsp;' + f.fmt(f.fVal) + '</span>' +
          '<span style="color:var(--text2);font-size:.62rem;flex-shrink:0">vs</span>' +
          '<span style="color:var(--opp-color)">' + opp.short + '&nbsp;' + f.fmt(f.oVal) + '</span>' +
        '</div>' +
        '<div class="factor-edge ' + edgeCls + '">' + edgeLabel + '</div>';
      fcont.appendChild(el);
    });

    renderG1Win(fm, opp, pH, pA);
  }

  /* 系列賽前瞻卡（依系列賽狀況動態切換：最近一場回顧 + 下一場前瞻） */
  function renderG1Win(fm, opp, pH, pA) {
    var card = document.getElementById('g1-pred-card');
    if (!card) { return; }

    var seriesPlayed = (D.championship_series || []).filter(function(g){ return g.opp_key === currentOpp; });

    if (seriesPlayed.length === 0) {
      // ── G1 前：三情境 ──
      var SCENARIOS_G1 = [
        {
          label: '夢想家主動',
          prob: Math.min(0.85, pH + 0.15),
          color: 'var(--accent)',
          border: 'rgba(0,229,255,.45)', bg: 'rgba(0,229,255,.06)', bar: 'rgba(0,229,255,.85)',
          stats: [
            { name: '三分%', val: '≥ 38%',  dir:  1 },
            { name: 'FG%',   val: '≥ 48%',  dir:  1 },
            { name: '助攻',  val: '≥ 20',   dir:  1 },
            { name: '失誤',  val: '≤ 15',   dir:  1 },
            { name: '抄截',  val: '≥ 8',    dir:  1 },
            { name: '禁區',  val: '≥ 45分', dir:  1 }
          ],
          ref: '參照 G1431（116-96）、G1468（107-90）',
          note: '三分手感熱 + 助攻流暢；抄截積極帶動反擊，主場優勢完整釋放。'
        },
        {
          label: '旗鼓相當',
          prob: pH,
          color: 'var(--text)',
          border: 'rgba(255,255,255,.18)', bg: 'rgba(255,255,255,.03)', bar: 'rgba(255,255,255,.5)',
          stats: [
            { name: '三分%', val: '28–37%',  dir:  0 },
            { name: 'FG%',   val: '44–47%',  dir:  0 },
            { name: '助攻',  val: '17–20',   dir:  0 },
            { name: '失誤',  val: '16–20',   dir:  0 },
            { name: '抄截',  val: '6–8',     dir:  0 },
            { name: '禁區',  val: '43–47分', dir:  0 }
          ],
          ref: '模型基準（H2H + NetRtg 加權）',
          note: '各項指標均在平均值附近，勝負取決於臨場細節執行與換人調度。'
        },
        {
          label: '國王逆轉',
          prob: Math.max(0.20, pH - 0.20),
          color: 'var(--accent2)',
          border: 'rgba(240,98,146,.4)', bg: 'rgba(240,98,146,.06)', bar: 'rgba(240,98,146,.85)',
          stats: [
            { name: '三分%', val: '< 28%',  dir: -1 },
            { name: 'FG%',   val: '< 44%',  dir: -1 },
            { name: '助攻',  val: '≤ 17',   dir: -1 },
            { name: '失誤',  val: '≥ 20',   dir: -1 },
            { name: '抄截',  val: '≤ 6',    dir: -1 },
            { name: '禁區',  val: '≤ 43分', dir: -1 }
          ],
          ref: '參照 G1439（97-114 主場失利）',
          note: '進攻低效又混亂時，林書緯持球組織配合禁區壓制足以主導全場。'
        }
      ];
      var html1 =
        '<div style="font-size:.75rem;color:var(--text2);margin-bottom:1rem">' +
          '依 H2H 6 場勝敗場關鍵因子分析（Mann-Whitney），六項顯著指標（p=0.05）' +
          '定義三種對戰情境。基準主場勝率 <strong style="color:var(--text)">' + Math.round(pH * 100) + '%</strong>，各情境依多因子表現組合上下調整。' +
        '</div><div class="sc-cards">';
      SCENARIOS_G1.forEach(function (s) {
        var pct = Math.round(s.prob * 100);
        var grid = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.25rem .35rem;margin-bottom:.55rem">';
        s.stats.forEach(function (st) {
          var vc = st.dir === 1 ? 'var(--accent)' : (st.dir === -1 ? 'var(--accent2)' : 'var(--text2)');
          grid += '<div><div style="font-size:.58rem;color:var(--text2);margin-bottom:.05rem">' + st.name + '</div>' +
            '<div style="font-size:.73rem;font-weight:700;color:' + vc + ';white-space:nowrap">' + st.val + '</div></div>';
        });
        grid += '</div>';
        html1 += '<div class="sc-card" style="border-color:' + s.border + ';background:' + s.bg + '">' +
          '<div class="sc-label" style="color:' + s.color + ';margin-bottom:.5rem">' + s.label + '</div>' +
          grid +
          '<div style="font-size:1.85rem;font-weight:900;line-height:1;margin-bottom:.4rem;color:' + s.color + '">' + pct + '%</div>' +
          '<div class="prob-bar-bg" style="margin-bottom:.45rem"><div class="prob-bar-fill" data-w="' + pct + '%" style="width:0%;background:' + s.bar + '"></div></div>' +
          '<div style="font-size:.63rem;color:var(--text2);opacity:.75;margin-bottom:.22rem">' + s.ref + '</div>' +
          '<div style="font-size:.67rem;color:var(--text2);line-height:1.5">' + s.note + '</div>' +
          '</div>';
      });
      html1 += '</div><div style="font-size:.7rem;color:var(--text2);margin-top:.75rem;line-height:1.6;border-top:1px solid rgba(255,255,255,.07);padding-top:.6rem">' +
        '★ 六項顯著指標（p=0.05）：三分%、整體命中率、助攻、失誤、抄截、禁區得分。籃板（p=0.15）、阻攻（p=0.15）、快攻得分（p=0.15）未列入條件。G1 夢主場台中。僅供參考。' +
        '</div>';
      card.innerHTML = html1;
      return;
    }

    // ── 已打 ≥1 場：最近一場回顧 + 下一場前瞻（依資料動態） ──
    var nextIdx   = seriesPlayed.length;
    var latest    = seriesPlayed[nextIdx - 1];
    var nextSched = nextIdx < SERIES_GAMES.length ? SERIES_GAMES[nextIdx] : null;
    var CN = ['一', '二', '三', '四', '五', '六', '七'];

    var secTitle = document.querySelector('#g1-prediction h2');
    if (secTitle) {
      secTitle.textContent = nextSched
        ? ('第' + CN[nextIdx] + '戰（' + nextSched.label + '）前瞻・三種情境')
        : '系列賽回顧';
    }

    // 最近一場回顧摘要（依 championship_series 資料動態產生）
    var lFs = latest.formosa_stats || {};
    var lOs = latest.opp_stats || {};
    var fmtMD = function (d) { return (+d.slice(4, 6)) + '/' + (+d.slice(6, 8)); };
    var perfLine = function (arr) {
      return (arr || []).map(function (p) {
        return p.name + ' ' + p.pts + '分' + (p.ts_pct != null ? '（TS ' + p.ts_pct + '%）' : '');
      }).join('、');
    };
    var fPerf = perfLine(latest.top_performers && latest.top_performers.formosa);
    var oPerf = perfLine(latest.top_performers && latest.top_performers.opp);
    var reviewSummary =
      '<div style="margin-bottom:1rem;padding:.6rem .8rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:.5rem">' +
        '<div style="font-size:.72rem;font-weight:700;color:var(--text2);margin-bottom:.4rem">' + latest.game + ' 回顧（' + fmtMD(latest.date) + ' ' + (latest.formosa_home ? '台中・夢想家主場' : '新莊・' + opp.short + '主場') + '）</div>' +
        '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:.4rem;align-items:center;font-size:.7rem;margin-bottom:.45rem">' +
          '<div>' +
            '<div style="font-size:.6rem;color:var(--text2)">夢想家</div>' +
            '<div style="font-size:1.4rem;font-weight:900;color:' + (latest.won ? 'var(--accent)' : 'var(--text2)') + '">' + latest.formosa_score + '</div>' +
          '</div>' +
          '<div style="color:var(--text2);font-size:.85rem">–</div>' +
          '<div style="text-align:right">' +
            '<div style="font-size:.6rem;color:var(--text2)">' + opp.short + '</div>' +
            '<div style="font-size:1.4rem;font-weight:900;color:' + (!latest.won ? 'var(--opp-color)' : 'var(--text2)') + '">' + latest.opp_score + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.25rem .5rem;font-size:.65rem;color:var(--text2)">' +
          '<div>夢 FG% <strong style="color:var(--text)">' + lFs.fg_pct + '%</strong>（' + lFs.fg_made + '/' + lFs.fg_att + '）</div>' +
          '<div>' + opp.short + ' FG% <strong style="color:var(--text)">' + lOs.fg_pct + '%</strong>（' + lOs.fg_made + '/' + lOs.fg_att + '）</div>' +
          '<div>夢 3P% <strong style="color:var(--text)">' + lFs['3p_pct'] + '%</strong>（' + lFs['3pm'] + '/' + lFs['3pa'] + '）</div>' +
          '<div>' + opp.short + ' 3P% <strong style="color:var(--text)">' + lOs['3p_pct'] + '%</strong>（' + lOs['3pm'] + '/' + lOs['3pa'] + '）</div>' +
          '<div>夢 助攻 <strong style="color:var(--text)">' + lFs.ast + '</strong>　失誤 <strong style="color:var(--text)">' + lFs.tov + '</strong></div>' +
          '<div>' + opp.short + ' 助攻 <strong style="color:var(--text)">' + lOs.ast + '</strong>　失誤 <strong style="color:var(--text)">' + lOs.tov + '</strong></div>' +
        '</div>' +
        '<div style="margin-top:.35rem;font-size:.65rem;color:var(--accent2)">★ ' + (latest.note || '') +
          (fPerf ? '　夢：' + fPerf : '') + (oPerf ? '；' + opp.short + '：' + oPerf : '') + '</div>' +
      '</div>';

    // 系列賽結束（無下一場）→ 僅顯示回顧
    if (!nextSched) {
      card.innerHTML = '<div style="font-size:.75rem;color:var(--text2);margin-bottom:.75rem">系列賽已結束。</div>' + reviewSummary;
      return;
    }

    var nextHome = nextSched.home === 'f';
    var pBase = nextHome ? pH : pA;
    var fW = seriesPlayed.filter(function (g) { return g.won; }).length;
    var oW = seriesPlayed.length - fW;

    // 下一場前瞻情境：優先採用客製劇本，否則套用通用門檻
    var PREVIEWS = {
      'G4': {
        intro: 'G3 國王主場大勝後 2-1 領先，G4（5/31 新莊）夢想家客場背水一戰，再輸將陷 1-3 絕境。依關鍵因子 + G3 數據定義三種情境。基準客場勝率 <strong style="color:var(--text)">' + Math.round(pBase * 100) + '%</strong>。',
        scenarios: [
          { label: '夢想家扳平 2-2', prob: Math.min(0.75, pBase + 0.08), color: 'var(--accent)',
            border: 'rgba(0,229,255,.45)', bg: 'rgba(0,229,255,.06)', bar: 'rgba(0,229,255,.85)',
            stats: [
              { name: 'FG%', val: '≥ 44%', dir: 1 },
              { name: '三分%', val: '≥ 33%', dir: 1 },
              { name: '限制王三分', val: '< 35%', dir: 1 },
              { name: '助攻', val: '≥ 20', dir: 1 },
              { name: '禁區', val: '≥ 40分', dir: 1 },
              { name: '失誤', val: '≤ 13', dir: 1 }
            ],
            ref: 'G3 FG 32.9% 需大幅修正 + 守住國王外線（G3 13記/43.3%）',
            note: '命中率回升、守住國王三分並打出禁區優勢，夢想家可在客場扳平、奪回 G5 主場主動權。' },
          { label: '旗鼓相當', prob: pBase, color: 'var(--text)',
            border: 'rgba(255,255,255,.18)', bg: 'rgba(255,255,255,.03)', bar: 'rgba(255,255,255,.5)',
            stats: [
              { name: 'FG%', val: '40–44%', dir: 0 },
              { name: '三分%', val: '28–33%', dir: 0 },
              { name: '限制王三分', val: '35–40%', dir: 0 },
              { name: '助攻', val: '17–20', dir: 0 },
              { name: '禁區', val: '36–40分', dir: 0 },
              { name: '失誤', val: '14–17', dir: 0 }
            ],
            ref: '模型基準（客場 + 系列賽落後 1-2）',
            note: '雙方拉鋸，勝負取決臨場執行與板凳貢獻；國王主場氣勢與夢想家求勝意志對撞。' },
          { label: '國王聽牌 3-1', prob: Math.max(0.15, pBase - 0.15), color: 'var(--accent2)',
            border: 'rgba(240,98,146,.4)', bg: 'rgba(240,98,146,.06)', bar: 'rgba(240,98,146,.85)',
            stats: [
              { name: 'FG%', val: '< 40%', dir: -1 },
              { name: '三分%', val: '< 28%', dir: -1 },
              { name: '限制王三分', val: '≥ 40%', dir: -1 },
              { name: '助攻', val: '≤ 17', dir: -1 },
              { name: '禁區', val: '≤ 36分', dir: -1 },
              { name: '失誤', val: '≥ 18', dir: -1 }
            ],
            ref: 'G3 低效重演（FG 32.9%/3P 20.6%）+ 國王外線續熱',
            note: '若 G3 冷手延續又守不住外線，國王 3-1 聽牌，夢想家將被逼到淘汰邊緣。' }
        ],
        footnote: '★ G4 關鍵觀察：夢想家三分回溫（G3 僅 7/34）、限制杰倫（G3 25分5記三分）與林書緯（20分7助攻）、爭取禁區得分。國王 G3 助攻 24 次傳導極順，夢想家防守輪轉是勝負關鍵。僅供參考。'
      },
      'G6': {
        intro: 'G5 夢想家主場 105-69 狂勝 36 分逼出 G6，系列賽 2-3 落後。G6（6/4 新莊）夢想家客場淘汰邊緣，再輸即出局；贏則逼出 G7 回台中。依關鍵因子 + G5 數據定義三種情境。基準客場勝率 <strong style="color:var(--text)">' + Math.round(pBase * 100) + '%</strong>。',
        scenarios: [
          { label: '夢想家逼出 G7', prob: Math.min(0.72, pBase + 0.08), color: 'var(--accent)',
            border: 'rgba(0,229,255,.45)', bg: 'rgba(0,229,255,.06)', bar: 'rgba(0,229,255,.85)',
            stats: [
              { name: 'FG%', val: '≥ 46%', dir: 1 },
              { name: '三分%', val: '≥ 35%', dir: 1 },
              { name: '限制王FG', val: '< 42%', dir: 1 },
              { name: '助攻', val: '≥ 22', dir: 1 },
              { name: '失誤', val: '≤ 15', dir: 1 },
              { name: '抄截', val: '≥ 9', dir: 1 }
            ],
            ref: '延續 G5 火力（FG 50.7%/3P 15記）+ 守國王 FG 38.8%',
            note: '延續 G5 進攻火力與防守壓迫、守住國王命中率，夢想家可在客場逼出 G7 回台中。' },
          { label: '旗鼓相當', prob: pBase, color: 'var(--text)',
            border: 'rgba(255,255,255,.18)', bg: 'rgba(255,255,255,.03)', bar: 'rgba(255,255,255,.5)',
            stats: [
              { name: 'FG%', val: '42–46%', dir: 0 },
              { name: '三分%', val: '30–35%', dir: 0 },
              { name: '限制王FG', val: '42–46%', dir: 0 },
              { name: '助攻', val: '18–22', dir: 0 },
              { name: '失誤', val: '15–18', dir: 0 },
              { name: '抄截', val: '6–9', dir: 0 }
            ],
            ref: '模型基準（客場 + 系列賽落後 2-3）',
            note: '雙方拉鋸，國王主場求封王與夢想家背水一戰對撞，勝負取決臨場執行與板凳貢獻。' },
          { label: '國王封王 4-2', prob: Math.max(0.20, pBase - 0.12), color: 'var(--accent2)',
            border: 'rgba(240,98,146,.4)', bg: 'rgba(240,98,146,.06)', bar: 'rgba(240,98,146,.85)',
            stats: [
              { name: 'FG%', val: '< 42%', dir: -1 },
              { name: '三分%', val: '< 30%', dir: -1 },
              { name: '限制王FG', val: '≥ 46%', dir: -1 },
              { name: '助攻', val: '≤ 18', dir: -1 },
              { name: '失誤', val: '≥ 18', dir: -1 },
              { name: '抄截', val: '≤ 6', dir: -1 }
            ],
            ref: 'G3/G4 低效重演 + 國王主場手感回溫',
            note: '若 G5 火力無法延續、國王主場手感回溫，國王將在新莊 4-2 封王。' }
        ],
        footnote: '★ G6 關鍵觀察：夢想家能否延續 G5 三分手感（15/39）與防守壓迫（逼國王 19 失誤）；國王罰球 G5 僅 10/24、命中率 38.8%，主場能否回穩。沃許本內線單點需要外線支援。僅供參考。'
      }
    };

    var preview = PREVIEWS[nextSched.label];
    if (!preview) {
      // 通用前瞻（尚未客製化的場次，如系列賽後段）
      preview = {
        intro: nextSched.label + '（' + nextSched.date + ' ' + (nextHome ? '台中・夢想家主場' : '新莊・' + opp.short + '主場') + '）。目前系列賽 夢想家 ' + fW + ' – ' + oW + ' ' + opp.short + '。基準' + (nextHome ? '主' : '客') + '場勝率 <strong style="color:var(--text)">' + Math.round(pBase * 100) + '%</strong>。',
        scenarios: [
          { label: '夢想家主動', prob: Math.min(0.82, pBase + 0.12), color: 'var(--accent)',
            border: 'rgba(0,229,255,.45)', bg: 'rgba(0,229,255,.06)', bar: 'rgba(0,229,255,.85)',
            stats: [
              { name: '三分%', val: '≥ 35%', dir: 1 },
              { name: 'FG%', val: '≥ 46%', dir: 1 },
              { name: '助攻', val: '≥ 20', dir: 1 },
              { name: '失誤', val: '≤ 14', dir: 1 },
              { name: '抄截', val: '≥ 8', dir: 1 },
              { name: '禁區', val: '≥ 42分', dir: 1 }
            ],
            ref: '進攻流暢 + 防守端壓制',
            note: '命中率與助攻同步拉高、抄截帶動反擊，夢想家可掌握節奏。' },
          { label: '旗鼓相當', prob: pBase, color: 'var(--text)',
            border: 'rgba(255,255,255,.18)', bg: 'rgba(255,255,255,.03)', bar: 'rgba(255,255,255,.5)',
            stats: [
              { name: '三分%', val: '30–35%', dir: 0 },
              { name: 'FG%', val: '42–46%', dir: 0 },
              { name: '助攻', val: '17–20', dir: 0 },
              { name: '失誤', val: '15–18', dir: 0 },
              { name: '抄截', val: '6–8', dir: 0 },
              { name: '禁區', val: '38–42分', dir: 0 }
            ],
            ref: '模型基準',
            note: '各項指標貼近均值，勝負取決臨場執行與調度。' },
          { label: opp.short + '佔優', prob: Math.max(0.18, pBase - 0.15), color: 'var(--accent2)',
            border: 'rgba(240,98,146,.4)', bg: 'rgba(240,98,146,.06)', bar: 'rgba(240,98,146,.85)',
            stats: [
              { name: '三分%', val: '< 30%', dir: -1 },
              { name: 'FG%', val: '< 42%', dir: -1 },
              { name: '助攻', val: '≤ 17', dir: -1 },
              { name: '失誤', val: '≥ 18', dir: -1 },
              { name: '抄截', val: '≤ 6', dir: -1 },
              { name: '禁區', val: '≤ 38分', dir: -1 }
            ],
            ref: '進攻低效 + 失誤偏高',
            note: '若命中率低迷又失誤增加，' + opp.short + '可主導比賽。' }
        ],
        footnote: '★ ' + nextSched.label + ' 採通用情境門檻；詳細前瞻將於前一場結束後更新。僅供參考。'
      };
    }

    var htmlP =
      '<div style="font-size:.75rem;color:var(--text2);margin-bottom:.75rem">' + preview.intro + '</div>' +
      reviewSummary +
      '<div class="sc-cards">';

    preview.scenarios.forEach(function (s) {
      var pct = Math.round(s.prob * 100);
      var grid = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.25rem .35rem;margin-bottom:.55rem">';
      s.stats.forEach(function (st) {
        var vc = st.dir === 1 ? 'var(--accent)' : (st.dir === -1 ? 'var(--accent2)' : 'var(--text2)');
        grid += '<div><div style="font-size:.58rem;color:var(--text2);margin-bottom:.05rem">' + st.name + '</div>' +
          '<div style="font-size:.73rem;font-weight:700;color:' + vc + ';white-space:nowrap">' + st.val + '</div></div>';
      });
      grid += '</div>';
      htmlP += '<div class="sc-card" style="border-color:' + s.border + ';background:' + s.bg + '">' +
        '<div class="sc-label" style="color:' + s.color + ';margin-bottom:.5rem">' + s.label + '</div>' +
        grid +
        '<div style="font-size:1.85rem;font-weight:900;line-height:1;margin-bottom:.4rem;color:' + s.color + '">' + pct + '%</div>' +
        '<div class="prob-bar-bg" style="margin-bottom:.45rem"><div class="prob-bar-fill" data-w="' + pct + '%" style="width:0%;background:' + s.bar + '"></div></div>' +
        '<div style="font-size:.63rem;color:var(--text2);opacity:.75;margin-bottom:.22rem">' + s.ref + '</div>' +
        '<div style="font-size:.67rem;color:var(--text2);line-height:1.5">' + s.note + '</div>' +
        '</div>';
    });

    htmlP += '</div><div style="font-size:.7rem;color:var(--text2);margin-top:.75rem;line-height:1.6;border-top:1px solid rgba(255,255,255,.07);padding-top:.6rem">' +
      preview.footnote + '</div>';

    card.innerHTML = htmlP;
  }

  /* ── Bar 動畫：讀取 data-w 展開 ── */
  function animateBars(selector, scope) {
    var root = scope || document;
    var els = root.querySelectorAll(selector);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        els.forEach(function (el) {
          el.style.width = el.dataset.w || '0%';
        });
      });
    });
  }

  /* ── Scroll trigger：各區塊進入視口才播動畫 ── */
  function setupScrollTriggers() {
    var configs = [
      { id: 'champ-todate',   sel: '#champ-todate .mini-bar-fill' },
      { id: 'pred-card',      sel: '.pred-path-bar-fill' },
      { id: 'g1-pred-card',   sel: '#g1-pred-card .prob-bar-fill' },
      { id: 'efficiency',     sel: '#efficiency .cmp-bar-f, #efficiency .cmp-bar-o' },
      { id: 'mann-whitney',   sel: '#mann-whitney .mhu-bar-fill' },
      { id: 'extended',       sel: '#extended .mini-bar-fill' },
    ];

    if (!('IntersectionObserver' in window)) {
      // fallback：全部立即觸發
      configs.forEach(function (c) { animateBars(c.sel); });
      return;
    }

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) { return; }
        obs.unobserve(entry.target);
        var id = entry.target.id;
        configs.forEach(function (c) {
          if (c.id === id) { animateBars(c.sel, entry.target); }
        });
      });
    }, { threshold: 0.12 });

    configs.forEach(function (c) {
      var el = document.getElementById(c.id);
      if (el) { obs.observe(el); }
    });
  }

  /* ── 例行賽區塊：點擊標題才展開（預設收合）── */
  var COLLAPSIBLE_IDS = ['h2h', 'quarter', 'mann-whitney', 'scenario', 'players', 'usg-ts', 'extended'];
  function setupCollapsibles() {
    COLLAPSIBLE_IDS.forEach(function (id) {
      var sec = document.getElementById(id);
      if (!sec || sec.dataset.collapsibleInit === '1') { return; }
      var h2 = sec.querySelector('h2');
      if (!h2) { return; }
      sec.dataset.collapsibleInit = '1';
      sec.classList.add('collapsible');

      // h2 之後的所有兄弟元素皆為內容
      var content = [];
      var node = h2.nextElementSibling;
      while (node) { content.push(node); node = node.nextElementSibling; }

      var caret = document.createElement('span');
      caret.className = 'collapse-caret';
      h2.appendChild(caret);

      var collapsed = true;
      function apply() {
        content.forEach(function (el) { el.style.display = collapsed ? 'none' : ''; });
        caret.textContent = collapsed ? '▸ 展開' : '▾ 收合';
        sec.classList.toggle('is-collapsed', collapsed);
      }
      h2.addEventListener('click', function () {
        collapsed = !collapsed;
        apply();
        if (!collapsed) {
          // 展開後補播長條動畫並還原隱藏期間縮放的圖表
          animateBars('.mhu-bar-fill, .mini-bar-fill, .prob-bar-fill, .pred-path-bar-fill, .cmp-bar-f, .cmp-bar-o', sec);
          [scenarioChartF, scenarioChartK, usgChartF, usgChartK].forEach(function (c) {
            if (c) { try { c.resize(); } catch (e) {} }
          });
        }
      });
      apply();
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
