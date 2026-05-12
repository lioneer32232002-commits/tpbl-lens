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
      <td><span class="rank-pill ${pillCls}">${i + 1}</span></td>
      <td>${esc(short(t.name))}${isSelf ? ' ◀' : ''}</td>
      <td><strong>${t.wins}</strong></td><td>${t.losses}</td><td>${wr}</td>
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
    html += `<div class="vs-card">
      <div class="vs-name">${esc(short(opp))}</div>
      <div class="vs-record"><span class="w">${r.w}</span><span class="sep">-</span><span class="l">${r.l}</span></div>
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
  el.innerHTML = `<div style="overflow-x:auto"><table>
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
  const axis = '#8fa3b8', grid = 'rgba(255,255,255,0.06)';
  deferChart(el, () => new Chart(el, {
    type: 'scatter',
    data: {
      datasets: [{
        data: entries.map(([, s]) => ({ x: s.usg, y: s.tsp })),
        backgroundColor: 'rgba(0,212,255,0.75)',
        pointRadius: 6, pointHoverRadius: 9,
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
  let html = '<table><thead><tr><th>節次</th><th>均得</th><th>均失</th><th>淨值</th><th>勝率</th></tr></thead><tbody>';
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
  const el = document.getElementById('chart-mw');
  if (!el || !mw || !mw.length) return;
  const axis = '#8fa3b8', grid = 'rgba(255,255,255,0.06)';

  const points = mw.map(item => {
    const p = Math.max(+(item.p_value ?? 1), 1e-6);
    return {
      x: +(item.effect_r ?? 0),
      y: -Math.log10(p),
      stat: item.stat,
      p,
      r: +(item.effect_r ?? 0),
      sig: !!item.significant,
      wm: +(item.wins_median ?? 0),
      lm: +(item.losses_median ?? 0),
    };
  });

  deferChart(el, () => new Chart(el, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: '顯著差異',
          data: points.filter(p => p.sig),
          backgroundColor: 'rgba(0,212,255,0.85)',
          borderColor: 'rgba(0,212,255,1)',
          pointRadius: 7, pointHoverRadius: 10,
        },
        {
          label: '未達顯著',
          data: points.filter(p => !p.sig),
          backgroundColor: 'rgba(143,163,184,0.45)',
          borderColor: 'rgba(143,163,184,0.7)',
          pointRadius: 5, pointHoverRadius: 8,
        },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { labels: { color: axis } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const d = ctx.raw;
              return `${d.stat}  r=${d.r.toFixed(3)}  p=${d.p.toFixed(4)}  勝/敗中位 ${d.wm.toFixed(1)} / ${d.lm.toFixed(1)}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: '效應量 r（→ 勝場較高）', color: axis },
          ticks: { color: axis }, grid: { color: grid },
          suggestedMin: -1, suggestedMax: 1,
        },
        y: {
          title: { display: true, text: '−log10(p)（越高越顯著）', color: axis },
          ticks: { color: axis }, grid: { color: grid },
          suggestedMin: 0,
        }
      }
    }
  }));

  // 在點圖下方顯示前幾名標籤摘要
  const labelHost = document.getElementById('mw-labels');
  if (labelHost) {
    const top = [...points].sort((a, b) => b.y - a.y).slice(0, 6);
    labelHost.innerHTML = top.map(d => {
      const color = d.sig ? 'var(--accent)' : 'var(--text2)';
      return `<span style="display:inline-block;margin:.15rem .5rem .15rem 0;font-size:.78rem;color:${color}"><strong>${esc(d.stat)}</strong> r=${d.r.toFixed(2)} · p=${d.p.toFixed(3)}</span>`;
    }).join('');
  }
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
