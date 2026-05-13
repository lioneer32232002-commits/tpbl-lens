// team.js — team detail page

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const team = document.querySelector('main')?.dataset.team;
if (!team) { console.error('[team.js] No team slug found on <main>'); }

fetch(`/data/${team}_2526.json`, { cache: 'no-store' })
  .then(r => r.json())
  .then(data => {
    renderStatsSummary(data.team_stats, data.meta);
    renderStandings(data.standings, data.meta.team_name);
    renderLeagueRtg(data.league_rtg, data.meta.team_name);
    renderVsCards(data.vs_summary);
    renderHomeAway(data.home_away);
    renderPlayerTable(data.player_avg);

    if (data.simulation && data.simulation.prob_playoff != null) {
      document.getElementById('simulation').style.display = '';
      renderSimulation(data.simulation);
    }
    if (data.heatmap && data.heatmap.length) {
      document.getElementById('heatmap').style.display = '';
      renderHeatmap(document.getElementById('heatmap-table'), data.heatmap);
    }
    if (data.ppp_heatmap && data.ppp_heatmap.length) {
      document.getElementById('ppp-heatmap').style.display = '';
      renderPppHeatmap(document.getElementById('ppp-table'), data.ppp_heatmap);
    }
    if (data.player_avg && Object.keys(data.player_avg).length) {
      document.getElementById('usg-ts').style.display = '';
      renderUsgTs(data.player_avg);
    }
    if (data.scenario_chart && data.scenario_chart.length) {
      document.getElementById('scenario').style.display = '';
      renderScenario(data.scenario_chart);
    }
    if (data.quarter_analysis && Object.keys(data.quarter_analysis).length) {
      document.getElementById('quarter').style.display = '';
      renderQuarter(data.quarter_analysis);
    }
    if (data.mann_whitney && data.mann_whitney.length) {
      document.getElementById('mann-whitney').style.display = '';
      renderMannWhitney(data.mann_whitney);
    }
    if (data.roc && Object.keys(data.roc).length) {
      document.getElementById('roc').style.display = '';
      renderRoc(data.roc);
    }
    if (data.last_game_hint && data.last_game_hint.opp) {
      document.getElementById('last-game').style.display = '';
      renderLastGame(data.last_game_hint);
    }
  })
  .catch(err => console.error('[team.js] Failed to load team data:', err));

function renderStatsSummary(ts, meta) {
  const el = document.getElementById('stats-summary-content');
  if (!el || !ts) return;
  const wr = ts.games_played > 0 ? (ts.win_rate * 100).toFixed(1) + '%' : '—';
  el.innerHTML = `
    <div style="display:flex;gap:1.5rem;flex-wrap:wrap;align-items:center">
      <div style="font-size:2rem;font-weight:900;color:var(--accent)">
        ${ts.wins}<span style="font-size:1rem;color:var(--text2)"> 勝</span>
        ${ts.losses}<span style="font-size:1rem;color:var(--text2)"> 敗</span>
      </div>
      <div style="font-size:.9rem;color:var(--text2)">
        <div>勝率 <strong style="color:var(--text)">${wr}</strong></div>
        <div>均得 <strong style="color:var(--text)">${ts.avg_pts}</strong> · 均失 <strong style="color:var(--text)">${ts.avg_opp_pts}</strong></div>
      </div>
      <div style="margin-left:auto;color:var(--text2);font-size:.78rem">更新：${meta.generated ? meta.generated.slice(0, 10) : '—'}</div>
    </div>`;
}

function renderStandings(standings, teamName) {
  const tbody = document.getElementById('standings-body');
  if (!tbody || !standings) return;
  const name = teamName ?? '';
  let html = '';
  standings.forEach((t, i) => {
    const wr = t.gp > 0 ? (t.wins / t.gp * 100).toFixed(1) + '%' : '—';
    const isSelf = t.name === name;
    const pillCls = i < 3 ? 'r-in' : i < 5 ? 'r-pi' : 'r-out';
    const cut = i === 2 ? 'playoff-cut' : '';
    html += `<tr class="${isSelf ? 'highlight' : ''} ${cut}">
      <td style="text-align:center"><span class="rank-pill ${pillCls}">${i + 1}</span></td>
      <td>${esc(short(t.name))}${isSelf ? ' ◀' : ''}</td>
      <td style="text-align:center"><strong style="color:var(--accent)">${t.wins}</strong></td>
      <td style="text-align:center;color:var(--accent2)">${t.losses}</td>
      <td style="text-align:center">${wr}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function renderLeagueRtg(rtgData, teamName) {
  const el = document.getElementById('chart-rtg');
  if (!el || !rtgData) return;
  const axis = '#8fa3b8', grid = 'rgba(255,255,255,0.06)';
  deferChart(el, () => new Chart(el, {
    type: 'bar',
    data: {
      labels: rtgData.map(t => short(t.name)),
      datasets: [
        { label: 'ORtg', data: rtgData.map(t => t.ortg), backgroundColor: rtgData.map(t => t.name === teamName ? 'rgba(0,212,255,0.9)' : 'rgba(0,212,255,0.3)') },
        { label: 'DRtg', data: rtgData.map(t => t.drtg), backgroundColor: rtgData.map(t => t.name === teamName ? 'rgba(240,98,146,0.9)' : 'rgba(240,98,146,0.3)') },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      scales: {
        x: { ticks: { color: axis }, grid: { color: grid } },
        y: { ticks: { color: axis }, grid: { color: grid } }
      },
      plugins: { legend: { labels: { color: axis } } }
    }
  }));
}

function renderVsCards(vs) {
  const grid = document.getElementById('vs-grid');
  if (!grid || !vs) return;
  let html = '';
  Object.entries(vs).forEach(([opp, r]) => {
    const total = r.w + r.l;
    const wr = total > 0 ? (r.w / total * 100).toFixed(0) + '%' : '—';
    const recColor = r.w > r.l ? 'var(--accent)' : 'var(--accent2)';
    html += `<div class="vs-card">
      <div class="vs-name">${esc(short(opp))}</div>
      <div class="vs-record" style="color:${recColor}">${r.w}<span class="sep" style="color:${recColor}">-</span>${r.l}</div>
      <div class="vs-meta">${wr} · 均 ${(+(r.avg_team ?? 0)).toFixed(1)}</div>
    </div>`;
  });
  grid.innerHTML = html;
}

function renderHomeAway(ha) {
  const el = document.getElementById('home-away-content');
  if (!el || !ha) return;
  const row = (label, d) => {
    const winRate = +(d.win_rate ?? 0);
    const avgPts = +(d.avg_pts ?? 0);
    const avgOpp = +(d.avg_opp ?? 0);
    const net = avgPts - avgOpp;
    return `<tr>
      <td><strong>${label}</strong></td>
      <td>${d.gp}<span class="ha-unit"> 場</span></td>
      <td class="ha-wl"><span style="color:var(--accent);font-weight:700">${d.wins}</span><span class="ha-unit"> 勝</span><span class="ha-sep"> </span><span style="color:var(--text2)">${d.losses}</span><span class="ha-unit"> 敗</span></td>
      <td>${(winRate * 100).toFixed(1)}%</td>
      <td>${avgPts.toFixed(1)} / ${avgOpp.toFixed(1)}</td>
      <td style="color:${net >= 0 ? 'var(--accent)' : 'var(--accent2)'}">${net >= 0 ? '+' : ''}${net.toFixed(1)}</td>
    </tr>`;
  };
  el.innerHTML = `<div style="overflow-x:auto"><table class="data-nums">
    <thead><tr><th></th><th>場次</th><th>勝負</th><th>勝率</th><th>均得/失</th><th>淨值</th></tr></thead>
    <tbody>${row('主場', ha.home)}${row('客場', ha.away)}</tbody>
  </table></div>`;
}

function renderPlayerTable(playerAvg) {
  const tbody = document.getElementById('player-tbody');
  if (!tbody || !playerAvg) return;
  let html = '';
  Object.entries(playerAvg)
    .sort((a, b) => (b[1].score || 0) - (a[1].score || 0))
    .forEach(([name, s]) => {
      const pm = +(s.plus_minus ?? 0);
      const pmCls = pm >= 5 ? 'color:var(--accent)' : pm <= -5 ? 'color:var(--accent2)' : 'color:var(--text2)';
      html += `<tr>
        <td>${esc(name)}</td>
        <td>${(+(s.score ?? 0)).toFixed(1)}</td><td>${(+(s.rebounds ?? 0)).toFixed(1)}</td><td>${(+(s.assists ?? 0)).toFixed(1)}</td>
        <td>${(+(s.steals ?? 0)).toFixed(1)}</td><td>${(+(s.blocks ?? 0)).toFixed(1)}</td><td>${(+(s.turnovers ?? 0)).toFixed(1)}</td>
        <td style="${pmCls}">${pm >= 0 ? '+' : ''}${pm.toFixed(1)}</td>
        <td>${(+(s.efficiency ?? 0)).toFixed(1)}</td>
        <td>${(+(s.tsp ?? 0)).toFixed(1)}%</td><td>${(+(s.usg ?? 0)).toFixed(1)}%</td>
        <td style="color:var(--text2)">${s.games}</td>
      </tr>`;
    });
  tbody.innerHTML = html;
}

function renderSimulation(sim) {
  const container = document.getElementById('prob-bars');
  if (!container) return;
  const items = [
    { id: 'pi', prob: sim.prob_play_in,  label: '進挑戰賽（第4/5名）',       cls: '' },
    { id: 'po', prob: sim.prob_playoff,  label: '進季後賽（前3或挑戰賽勝）',  cls: '' },
    { id: 'sf', prob: sim.prob_semif,    label: '打半決賽（Bo5）',            cls: '' },
    { id: 'fi', prob: sim.prob_final,    label: '打總冠軍賽（Bo7）',          cls: '' },
    { id: 'ch', prob: sim.prob_champ,    label: '🏆 拿下總冠軍',             cls: 'bar-ch' },
  ];
  let html = '';
  items.forEach(item => {
    const pct = Math.round((item.prob || 0) * 100);
    html += `<div class="prob-row">
      <label><strong>${item.label}</strong><span class="pct-val">${pct}%</span></label>
      <div class="prob-bar-bg"><div class="prob-bar-fill ${item.cls}" id="pbar-${item.id}" style="width:0%"></div></div>
    </div>`;
  });
  container.innerHTML = html;
  setTimeout(() => {
    items.forEach(item => {
      const el = document.getElementById(`pbar-${item.id}`);
      if (el) el.style.width = Math.round((item.prob || 0) * 100) + '%';
    });
  }, 300);
}

function renderUsgTs(playerAvg) {
  const el = document.getElementById('chart-usg-ts');
  if (!el || !playerAvg) return;
  const entries = Object.entries(playerAvg).filter(([, s]) => s.games >= 5);
  if (!entries.length) return;
  const axis = '#8fa3b8', grid = 'rgba(255,255,255,0.06)';

  // 以 TS% 中位數區分效率高低；高 TS% → 青色（越好越深），低 TS% → 粉色（越差越深）
  const tsSorted = entries.map(([, s]) => s.tsp).slice().sort((a, b) => a - b);
  const mid = Math.floor(tsSorted.length / 2);
  const tsMed = tsSorted.length % 2 ? tsSorted[mid] : (tsSorted[mid - 1] + tsSorted[mid]) / 2;
  const tsSpan = Math.max(tsSorted[tsSorted.length - 1] - tsSorted[0], 1);
  const bgColors = entries.map(([, s]) => {
    const delta = s.tsp - tsMed;
    const intensity = Math.min(Math.abs(delta) / (tsSpan * 0.5), 1);
    const alpha = (0.35 + intensity * 0.6).toFixed(2);
    return delta >= 0 ? `rgba(0,212,255,${alpha})` : `rgba(240,98,146,${alpha})`;
  });

  deferChart(el, () => new Chart(el, {
    type: 'scatter',
    data: {
      datasets: [{
        data: entries.map(([, s]) => ({ x: s.usg, y: s.tsp })),
        backgroundColor: bgColors,
        pointRadius: 7, pointHoverRadius: 10,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const [name] = entries[ctx.dataIndex];
              return `${name}  USG:${ctx.parsed.x.toFixed(1)}%  TS:${ctx.parsed.y.toFixed(1)}%`;
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'USG%', color: axis }, ticks: { color: axis }, grid: { color: grid } },
        y: { title: { display: true, text: 'TS%',  color: axis }, ticks: { color: axis }, grid: { color: grid } }
      }
    }
  }));
}

function renderScenario(scenarioChart) {
  const el = document.getElementById('chart-scenario');
  if (!el || !scenarioChart) return;
  const axis = '#8fa3b8', grid = 'rgba(255,255,255,0.06)';
  deferChart(el, () => new Chart(el, {
    type: 'bar',
    data: {
      labels: scenarioChart.map(s => s.label),
      datasets: [
        { label: '本隊均分', data: scenarioChart.map(s => s.team_mean ?? s.lion_mean), backgroundColor: 'rgba(0,212,255,0.75)' },
        { label: '對手均分', data: scenarioChart.map(s => s.opp_mean), backgroundColor: 'rgba(240,98,146,0.65)' },
        { label: '勝率', data: scenarioChart.map(s => +(s.win_rate * 100).toFixed(1)), type: 'line', yAxisID: 'yWr', borderColor: '#ffd700', backgroundColor: 'transparent', pointRadius: 4 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      scales: {
        x:   { ticks: { color: axis }, grid: { color: grid } },
        y:   { ticks: { color: axis }, grid: { color: grid } },
        yWr: { position: 'right', min: 0, max: 100, ticks: { color: '#ffd700', callback: v => v + '%' }, grid: { display: false } }
      },
      plugins: { legend: { labels: { color: axis } } }
    }
  }));
}

function renderQuarter(qa) {
  const el = document.getElementById('quarter-content');
  if (!el || !qa) return;
  let html = '<table class="data-nums"><thead><tr><th>節次</th><th>均得</th><th>均失</th><th>淨值</th><th>勝率</th></tr></thead><tbody>';
  ['Q1', 'Q2', 'Q3', 'Q4'].forEach(q => {
    const d = qa[q];
    if (!d) return;
    const net = d.avg_score - d.avg_opp;
    html += `<tr>
      <td><strong>${q}</strong></td>
      <td>${d.avg_score.toFixed(1)}</td><td>${d.avg_opp.toFixed(1)}</td>
      <td style="color:${net >= 0 ? 'var(--accent)' : 'var(--accent2)'}">${net >= 0 ? '+' : ''}${net.toFixed(1)}</td>
      <td>${(d.win_rate * 100).toFixed(1)}%</td>
    </tr>`;
  });
  el.innerHTML = `<div style="overflow-x:auto">${html}</tbody></table></div>`;
}

function renderMannWhitney(mw) {
  const barEl = document.getElementById('chart-mw');
  const gridEl = document.getElementById('mw-stat-grid');
  if (!mw || !mw.length) return;
  const axis = '#8fa3b8', grid = 'rgba(255,255,255,0.06)';

  // 依 |r| 由大到小排序
  const sorted = [...mw].sort((a, b) => Math.abs(b.effect_r) - Math.abs(a.effect_r));

  // ── 1. 效應量總覽橫條圖 ──
  if (barEl) {
    const labels = sorted.map(d => {
      const badge = d.significant ? ' ★' : d.p_value < 0.1 ? ' ▲' : '';
      return d.stat + badge;
    });
    const colors = sorted.map(d =>
      d.effect_r > 0 ? 'rgba(0,212,255,0.78)' : 'rgba(240,98,146,0.78)'
    );
    deferChart(barEl, () => new Chart(barEl, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data: sorted.map(d => d.effect_r),
          backgroundColor: colors,
          borderRadius: 3,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const d = sorted[ctx.dataIndex];
                return `r=${d.effect_r.toFixed(3)}  p=${d.p_value.toFixed(4)}  勝/敗中位 ${(+(d.wins_median??0)).toFixed(1)} / ${(+(d.losses_median??0)).toFixed(1)}`;
              }
            }
          },
          annotation: {
            annotations: {
              line03: { type:'line', scaleID:'x', value: 0.3,  borderColor:'rgba(255,255,255,0.2)', borderWidth:1, borderDash:[4,4] },
              linen03: { type:'line', scaleID:'x', value:-0.3, borderColor:'rgba(255,255,255,0.2)', borderWidth:1, borderDash:[4,4] },
              line05: { type:'line', scaleID:'x', value: 0.5,  borderColor:'rgba(255,255,255,0.35)', borderWidth:1, borderDash:[4,4] },
              linen05: { type:'line', scaleID:'x', value:-0.5, borderColor:'rgba(255,255,255,0.35)', borderWidth:1, borderDash:[4,4] },
            }
          }
        },
        scales: {
          x: { min:-1, max:1, ticks:{ color:axis }, grid:{ color:grid }, title:{ display:true, text:'效應量 r', color:axis } },
          y: { ticks:{ color:axis }, grid:{ display:false } }
        }
      }
    }));
  }

  // ── 2. 前 6 指標小卡：點狀圖（個別場次）+ 中位線 ──
  if (!gridEl) return;
  const top6 = sorted.slice(0, 6);
  let html = '';
  top6.forEach((d, i) => {
    const badge = d.significant
      ? '<span class="mw-sig">★ 顯著</span>'
      : d.p_value < 0.1 ? '<span class="mw-trend">▲ 趨勢</span>' : '';
    const rSign = d.effect_r >= 0 ? '+' : '';
    const wMed = (+(d.wins_median ?? 0)).toFixed(1);
    const lMed = (+(d.losses_median ?? 0)).toFixed(1);
    html += `<div class="mw-stat-card">
      <div class="mw-stat-head"><span class="mw-stat-name">${esc(d.stat)}</span>${badge}</div>
      <div class="mw-stat-meta">p = ${d.p_value.toFixed(3)} &nbsp;·&nbsp; r = ${rSign}${d.effect_r.toFixed(2)}</div>
      <div class="mw-canvas-wrap"><canvas data-mw="${i}"></canvas></div>
      <div class="mw-medians">
        <div style="color:#00d4ff">勝中位 ${wMed}</div>
        <div style="color:#f06292">敗中位 ${lMed}</div>
      </div>
    </div>`;
  });
  gridEl.innerHTML = html;

  const mwJitter = (idx, span) =>
    (Math.sin(idx * 13.7) * 0.5 + Math.cos(idx * 7.3) * 0.5) * span;

  const makeMedianPlugin = (wMed, lMed) => ({
    id: 'medLines',
    afterDatasetsDraw(chart) {
      const { ctx, scales } = chart;
      const x0 = scales.x.getPixelForValue(0);
      const x1 = scales.x.getPixelForValue(1);
      const y0 = scales.y.getPixelForValue(wMed);
      const y1 = scales.y.getPixelForValue(lMed);
      [[x0, y0, '#00d4ff'], [x1, y1, '#f06292']].forEach(([x, y, color]) => {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x - 20, y);
        ctx.lineTo(x + 20, y);
        ctx.stroke();
        ctx.restore();
      });
    }
  });

  setTimeout(() => {
    gridEl.querySelectorAll('canvas').forEach(canvas => {
      const i = +canvas.dataset.mw;
      const d = top6[i];
      if (!d) return;
      const wins   = Array.isArray(d.wins)   ? d.wins   : [];
      const losses = Array.isArray(d.losses) ? d.losses : [];
      const wMed   = +(d.wins_median ?? 0);
      const lMed   = +(d.losses_median ?? 0);
      try {
        new Chart(canvas, {
          type: 'scatter',
          plugins: [makeMedianPlugin(wMed, lMed)],
          data: {
            datasets: [
              {
                label: '勝場',
                data: wins.map((y, j) => ({ x: mwJitter(j, 0.14), y })),
                backgroundColor: 'rgba(0,212,255,0.7)',
                borderColor: '#00d4ff', borderWidth: 1,
                pointRadius: 5, pointHoverRadius: 7,
              },
              {
                label: '敗場',
                data: losses.map((y, j) => ({ x: 1 + mwJitter(j + 50, 0.14), y })),
                backgroundColor: 'rgba(240,98,146,0.6)',
                borderColor: '#f06292', borderWidth: 1,
                pointRadius: 5, pointHoverRadius: 7,
              },
            ]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 600 },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: ctx => (ctx.datasetIndex === 0 ? '勝 ' : '敗 ') + ctx.parsed.y.toFixed(1)
                }
              }
            },
            scales: {
              x: {
                type: 'linear', min: -0.5, max: 1.5,
                afterBuildTicks: sc => { sc.ticks = [{ value: 0 }, { value: 1 }]; },
                ticks: { color: axis, font: { size: 11, weight: '700' }, callback: v => v === 0 ? '勝' : '敗' },
                grid: { display: false }, border: { display: false },
              },
              y: {
                ticks: { color: axis, font: { size: 9 }, maxTicksLimit: 5 },
                grid: { color: grid, lineWidth: 0.8 },
              }
            }
          }
        });
      } catch(e) {
        console.warn('[mw-card] chart error canvas', i, e.message);
      }
    });
  }, 0);
}

function renderRoc(roc) {
  const container = document.getElementById('roc-container');
  if (!container || !roc) return;
  const axis = '#8fa3b8', grid = 'rgba(255,255,255,0.06)';
  const palette = ['#00d4ff', '#f06292', '#ffd700', '#80cbc4', '#ce93d8', '#ffb74d', '#a5d6a7', '#90caf9', '#ff8a65', '#bcaaa4'];
  const entries = Object.entries(roc).sort((a, b) => (b[1].auc || 0) - (a[1].auc || 0));

  const card = document.createElement('div');
  card.className = 'card chart-wrap';
  const canvas = document.createElement('canvas');
  canvas.style.maxHeight = '420px';
  card.appendChild(canvas);
  container.innerHTML = '';
  container.appendChild(card);

  const legendList = document.createElement('div');
  legendList.style.cssText = 'margin-top:.75rem;font-size:.78rem;color:var(--text2);display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:.3rem .75rem';
  legendList.innerHTML = entries.map(([stat, d], i) =>
    `<div><span style="display:inline-block;width:10px;height:10px;background:${palette[i % palette.length]};border-radius:2px;margin-right:.4rem;vertical-align:middle"></span>${esc(stat)} · <strong style="color:var(--text)">${d.auc.toFixed(3)}</strong></div>`
  ).join('');
  card.appendChild(legendList);

  deferChart(canvas, () => new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [
        ...entries.map(([stat, d], i) => ({
          label: `${stat} (AUC ${d.auc.toFixed(3)})`,
          data: d.curve.map(p => ({ x: p.fpr, y: p.tpr })),
          borderColor: palette[i % palette.length],
          backgroundColor: 'transparent',
          pointRadius: 0, borderWidth: 2, tension: 0.2,
        })),
        { label: '隨機', data: [{ x: 0, y: 0 }, { x: 1, y: 1 }], borderColor: 'rgba(255,255,255,0.25)', borderDash: [4, 4], pointRadius: 0, borderWidth: 1 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'nearest', intersect: false },
      },
      scales: {
        x: { type: 'linear', min: 0, max: 1, title: { display: true, text: 'FPR', color: axis }, ticks: { color: axis }, grid: { color: grid } },
        y: { type: 'linear', min: 0, max: 1, title: { display: true, text: 'TPR', color: axis }, ticks: { color: axis }, grid: { color: grid } }
      }
    }
  }));
}

function renderLastGame(lg) {
  const el = document.getElementById('last-game-content');
  if (!el || !lg || !lg.opp) return;
  const dateStr = lg.date
    ? `${lg.date.slice(0, 4)}/${lg.date.slice(4, 6)}/${lg.date.slice(6, 8)}`
    : '—';
  const ha = lg.is_home ? '主場' : '客場';
  const result = lg.won ? '<span style="color:var(--accent)">勝</span>' : '<span style="color:var(--accent2)">敗</span>';
  const diff = lg.team_score - lg.opp_score;
  const teamPred = +(lg.team_pred ?? 0);
  const oppPred = +(lg.opp_pred ?? 0);
  const teamDiff = +(lg.team_diff ?? 0);
  const oppDiff = +(lg.opp_diff ?? 0);
  el.innerHTML = `
    <div style="margin-bottom:1rem">
      <div style="color:var(--text2);font-size:.84rem">${dateStr} · ${ha} vs ${esc(short(lg.opp))}</div>
      <div style="font-size:1.5rem;font-weight:900;margin:.3rem 0">
        ${lg.team_score} : ${lg.opp_score} ${result}
        <span style="font-size:.88rem;color:${diff >= 0 ? 'var(--accent)' : 'var(--accent2)'}">(${diff >= 0 ? '+' : ''}${diff})</span>
      </div>
      <div style="font-size:.8rem;color:var(--text2)">情境：${esc(lg.scenario)}</div>
    </div>
    <div style="overflow-x:auto"><table style="font-size:.84rem">
      <thead><tr><th>項目</th><th>預測</th><th>實際</th><th>差值</th></tr></thead>
      <tbody>
        <tr><td>本隊得分</td><td>${teamPred.toFixed(1)}</td><td>${lg.team_score}</td>
          <td style="color:${teamDiff >= 0 ? 'var(--accent)' : 'var(--accent2)'}">${teamDiff >= 0 ? '+' : ''}${teamDiff.toFixed(1)}</td></tr>
        <tr><td>對手得分</td><td>${oppPred.toFixed(1)}</td><td>${lg.opp_score}</td>
          <td style="color:${oppDiff >= 0 ? 'var(--accent)' : 'var(--accent2)'}">${oppDiff >= 0 ? '+' : ''}${oppDiff.toFixed(1)}</td></tr>
      </tbody>
    </table></div>`;
}
