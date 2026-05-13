// league.js — league overview page

const TEAM_SHORT = {
  '福爾摩沙夢想家': '夢想家', '新竹御嵿攻城獅': '攻城獅',
  '高雄全家海神': '海神', '桃園台啤永豐雲豹': '雲豹',
  '新北中信特攻': '特攻', '新北國王': '國王', '臺北台新戰神': '戰神',
};
const short = n => TEAM_SHORT[n] || n;

const _deferred = [];
let _obs;
function deferChart(el, factory) {
  if (!el) return;
  if (!_obs) {
    _obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const item = _deferred.find(d => d.el === e.target);
        if (item) { item.factory(); _obs.unobserve(e.target); }
      });
    }, { rootMargin: '200px' });
  }
  _deferred.push({ el, factory });
  _obs.observe(el);
}

Chart.defaults.font.family = "'Noto Sans TC', 'Microsoft JhengHei', sans-serif";
Chart.defaults.font.weight = '700';
Chart.defaults.animation.duration = 900;
Chart.defaults.animation.easing = 'easeOutQuart';
Chart.defaults.color = '#8fa3b8';

fetch('/data/league_2526.json', { cache: 'no-store' })
  .then(r => r.json())
  .then(data => {
    renderLeagueStandings(data.standings);
    renderLeagueRtg(data.league_rtg);
    renderLeagueScoring(data.scoring_sources);
    renderTeamCards(data.standings);
    renderStyleClusters(data.style_clusters);
    renderMatchupMatrix(data.matchup_matrix, data.standings);
    renderPaceTrend(data.pace_trend);
  });

function renderLeagueStandings(standings) {
  const tbody = document.getElementById('standings-body');
  if (!tbody || !standings) return;
  let html = '';
  standings.forEach((t, i) => {
    const wr = t.gp > 0 ? (t.wins / t.gp * 100).toFixed(1) + '%' : '—';
    const pillCls = i < 3 ? 'r-in' : i < 5 ? 'r-pi' : 'r-out';
    const cut = i === 2 ? 'playoff-cut' : '';
    html += `<tr class="${cut}">
      <td style="text-align:center"><span class="rank-pill ${pillCls}">${i + 1}</span></td>
      <td>${short(t.name)}</td>
      <td style="text-align:center"><strong>${t.wins}</strong></td>
      <td style="text-align:center">${t.losses}</td>
      <td style="text-align:center">${wr}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function renderLeagueRtg(rtgData) {
  const el = document.getElementById('chart-rtg');
  if (!el || !rtgData) return;
  const axis = '#8fa3b8', grid = 'rgba(255,255,255,0.06)';
  deferChart(el, () => new Chart(el, {
    type: 'bar',
    data: {
      labels: rtgData.map(t => short(t.name)),
      datasets: [
        { label: 'ORtg', data: rtgData.map(t => t.ortg), backgroundColor: 'rgba(0,212,255,0.75)' },
        { label: 'DRtg', data: rtgData.map(t => t.drtg), backgroundColor: 'rgba(240,98,146,0.75)' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      scales: {
        x: { ticks: { color: axis }, grid: { color: grid } },
        y: { ticks: { color: axis }, grid: { color: grid }, title: { display: true, text: '每百回合', color: axis } },
      },
      plugins: { legend: { labels: { color: axis } } }
    }
  }));
}

function renderLeagueScoring(scoringData) {
  const el = document.getElementById('chart-scoring');
  if (!el || !scoringData) return;
  const axis = '#8fa3b8', grid = 'rgba(255,255,255,0.06)';
  // 同色系（深→淺 = 佔比多→少）：禁區 > 三分 > 罰球 > 中距離
  const CATS = [
    { key: 'paint', label: '禁區兩分',   color: 'rgba(0,119,182,0.9)'   },
    { key: 'three', label: '三分球',     color: 'rgba(0,168,210,0.9)'   },
    { key: 'ft',    label: '罰球',       color: 'rgba(72,202,228,0.9)'  },
    { key: 'mid',   label: '中距離兩分', color: 'rgba(144,224,239,0.9)' },
  ];
  deferChart(el, () => new Chart(el, {
    type: 'bar',
    data: {
      labels: scoringData.map(t => short(t.name)),
      datasets: CATS.map(c => ({ label: c.label, data: scoringData.map(t => t[c.key]), backgroundColor: c.color }))
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      indexAxis: 'y',
      scales: {
        x: { stacked: true, ticks: { color: axis }, grid: { color: grid } },
        y: { stacked: true, ticks: { color: axis }, grid: { display: false } }
      },
      plugins: { legend: { labels: { color: axis } } }
    }
  }));
}

function renderTeamCards(standings) {
  const grid = document.getElementById('team-cards-grid');
  if (!grid || !standings) return;
  const ROUTES = {
    '福爾摩沙夢想家': '/formosa/',  '新竹御嵿攻城獅': '/lions/',
    '高雄全家海神':   '/aquas/',    '桃園台啤永豐雲豹': '/leopards/',
    '新北中信特攻':   '/braves/',   '新北國王': '/kings/',
    '臺北台新戰神':   '/warriors/',
  };
  let html = '';
  standings.forEach(t => {
    const href = ROUTES[t.name] || '#';
    const wr = t.gp > 0 ? (t.wins / t.gp * 100).toFixed(0) + '%' : '—';
    const baseStyle = 'display:block;text-decoration:none;color:inherit';
    const extraStyle = href === '#' ? 'opacity:.45;pointer-events:none;' : '';
    const recColor = t.wins > t.losses ? 'var(--accent)' : 'var(--accent2)';
    html += `<a href="${href}" class="vs-card" style="${extraStyle}${baseStyle}">
      <div class="vs-name">${short(t.name)}</div>
      <div class="vs-record" style="color:${recColor}">${t.wins}<span class="sep" style="color:${recColor}">-</span>${t.losses}</div>
      <div class="vs-meta">${wr} 勝率${href !== '#' ? ' →' : ''}</div>
    </a>`;
  });
  grid.innerHTML = html;
}

function renderStyleClusters(clusters) {
  const el = document.getElementById('style-clusters-content');
  if (!el || !clusters || !clusters.length) return;
  let html = '<table class="data-nums"><thead><tr><th>球隊</th><th>節奏</th><th>三分率</th><th>禁區比例</th><th>助攻/失誤</th><th>風格</th></tr></thead><tbody>';
  clusters.forEach(t => {
    html += `<tr>
      <td>${short(t.name)}</td>
      <td>${(+(t.pace ?? 0)).toFixed(1)}</td>
      <td>${((+(t.three_rate ?? 0)) * 100).toFixed(1)}%</td>
      <td>${((+(t.paint_rate ?? 0)) * 100).toFixed(1)}%</td>
      <td>${(+(t.ast_to ?? 0)).toFixed(2)}</td>
      <td><span style="color:var(--accent);font-weight:700">${t.cluster}</span></td>
    </tr>`;
  });
  html += '</tbody></table>';
  el.innerHTML = `<div style="overflow-x:auto">${html}</div>`;
}

function renderMatchupMatrix(matrix, standings) {
  const tableEl = document.getElementById('matchup-table');
  if (!tableEl || !matrix || !standings) return;
  const teams = standings.map(t => t.name);
  let html = '<thead><tr><th style="text-align:left">↓ vs →</th>';
  teams.forEach(t => { html += `<th>${short(t)}</th>`; });
  html += '</tr></thead><tbody>';
  teams.forEach(rowTeam => {
    html += `<tr><td class="hm-name">${short(rowTeam)}</td>`;
    teams.forEach(colTeam => {
      if (rowTeam === colTeam) {
        html += `<td class="hm-cell hm-null">—</td>`;
        return;
      }
      const r = (matrix[rowTeam] || {})[colTeam];
      if (!r) { html += `<td class="hm-cell hm-null">—</td>`; return; }
      const diff = r.w - r.l;
      const cls = diff >= 2 ? 'hm-p2' : diff === 1 ? 'hm-p1'
               : diff === 0 ? 'hm-z'  : diff === -1 ? 'hm-n1' : 'hm-n2';
      html += `<td class="hm-cell ${cls}">${r.w}-${r.l}</td>`;
    });
    html += '</tr>';
  });
  tableEl.innerHTML = html + '</tbody>';
}

const TEAM_COLORS = [
  'rgba(0,212,255,0.9)',   'rgba(240,98,146,0.9)',
  'rgba(100,220,120,0.9)', 'rgba(255,215,0,0.9)',
  'rgba(200,150,255,0.9)', 'rgba(255,180,100,0.9)',
  'rgba(100,200,255,0.9)',
];

// 純 SVG sparkline — 零 Chart.js 開銷，不卡頓
function makePaceSVG(data, yMin, yMax, leagueAvg, color) {
  if (!data || data.length < 2) return `<svg viewBox="0 0 100 40" width="100%" height="48" style="display:block"></svg>`;
  const xs = data.map(p => p.x);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const W = 100, H = 40, pad = 1;
  const px = v => xMax > xMin ? (pad + (v - xMin) / (xMax - xMin) * (W - 2 * pad)).toFixed(2) : (W / 2).toFixed(2);
  const py = v => (H - pad - (v - yMin) / (yMax - yMin) * (H - 2 * pad)).toFixed(2);
  const pts = data.map(p => `${px(p.x)},${py(p.y)}`).join(' ');
  const ptsArr = pts.split(' ');
  const [fx] = ptsArr[0].split(',');
  const [lx] = ptsArr[ptsArr.length - 1].split(',');
  const fillC = color.replace(/[\d.]+\)$/, '0.12)');
  const avgY = py(leagueAvg);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="48" style="display:block">
    <polygon points="${pts} ${lx},${H} ${fx},${H}" fill="${fillC}"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/>
    <line x1="0" y1="${avgY}" x2="${W}" y2="${avgY}" stroke="rgba(255,255,255,0.22)" stroke-width="1" stroke-dasharray="3,3"/>
  </svg>`;
}

function renderPaceTrend(trend) {
  const host = document.getElementById('pace-grid');
  const summary = document.getElementById('pace-summary');
  if (!host || !trend || !trend.length) return;

  const allY = trend.flatMap(t => (t.data || []).map(p => p.y)).filter(v => Number.isFinite(v));
  if (!allY.length) return;
  const yMin = Math.floor(Math.min(...allY) - 1);
  const yMax = Math.ceil(Math.max(...allY) + 1);
  const leagueAvg = allY.reduce((a, v) => a + v, 0) / allY.length;

  const enriched = trend.map((t, i) => {
    const ys = (t.data || []).map(p => p.y).filter(v => Number.isFinite(v));
    const avg = ys.length ? ys.reduce((a, v) => a + v, 0) / ys.length : 0;
    const min = ys.length ? Math.min(...ys) : 0;
    const max = ys.length ? Math.max(...ys) : 0;
    return { ...t, _i: i, avg, min, max };
  }).sort((a, b) => b.avg - a.avg);

  let html = '';
  enriched.forEach(t => {
    const color = TEAM_COLORS[t._i % TEAM_COLORS.length];
    const diff = t.avg - leagueAvg;
    const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1);
    const diffColor = diff >= 0 ? 'var(--accent)' : 'var(--accent2)';
    html += `<div class="pace-card">
      <div class="pace-head">
        <span class="pace-name">${short(t.name)}</span>
        <span class="pace-avg">${t.avg.toFixed(1)}</span>
      </div>
      ${makePaceSVG(t.data, yMin, yMax, leagueAvg, color)}
      <div class="pace-meta">
        <span>區間 ${t.min.toFixed(0)}–${t.max.toFixed(0)}</span>
        <span style="color:${diffColor}">vs 聯盟 ${diffStr}</span>
      </div>
    </div>`;
  });
  host.innerHTML = html;
  if (summary) {
    summary.textContent = `聯盟平均 ${leagueAvg.toFixed(1)} 回合／場 · y 軸 ${yMin}–${yMax}`;
  }
}
