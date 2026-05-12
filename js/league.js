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
      <td><span class="rank-pill ${pillCls}">${i + 1}</span></td>
      <td>${short(t.name)}</td>
      <td><strong>${t.wins}</strong></td><td>${t.losses}</td><td>${wr}</td>
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
        { label: 'ORtg',   data: rtgData.map(t => t.ortg),   backgroundColor: 'rgba(0,212,255,0.75)' },
        { label: 'DRtg',   data: rtgData.map(t => t.drtg),   backgroundColor: 'rgba(255,107,53,0.75)' },
        { label: 'NetRtg', data: rtgData.map(t => t.netrtg), backgroundColor: 'rgba(100,220,120,0.8)', type: 'line', yAxisID: 'yNet', borderColor: '#64dc78', pointRadius: 4 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      scales: {
        x:    { ticks: { color: axis }, grid: { color: grid } },
        y:    { ticks: { color: axis }, grid: { color: grid }, title: { display: true, text: '每百回合', color: axis } },
        yNet: { position: 'right', ticks: { color: '#64dc78' }, grid: { display: false }, title: { display: true, text: 'Net', color: '#64dc78' } }
      },
      plugins: { legend: { labels: { color: axis } } }
    }
  }));
}

function renderLeagueScoring(scoringData) {
  const el = document.getElementById('chart-scoring');
  if (!el || !scoringData) return;
  const axis = '#8fa3b8', grid = 'rgba(255,255,255,0.06)';
  const CATS = [
    { key: 'three', label: '三分球',     color: 'rgba(100,181,246,0.9)' },
    { key: 'paint', label: '禁區兩分',   color: 'rgba(41,182,246,0.9)'  },
    { key: 'mid',   label: '中距離兩分', color: 'rgba(38,166,154,0.9)'  },
    { key: 'ft',    label: '罰球',       color: 'rgba(129,199,132,0.9)' },
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
    html += `<a href="${href}" class="vs-card" style="${extraStyle}${baseStyle}">
      <div style="font-size:.82rem;color:var(--text2);margin-bottom:.4rem">${short(t.name)}</div>
      <div class="vs-record"><span class="w">${t.wins}</span><span style="color:var(--text2)">W </span><span class="l">${t.losses}</span><span style="color:var(--text2)">L</span></div>
      <div style="font-size:.76rem;color:var(--text2);margin-top:.2rem">${wr} 勝率${href !== '#' ? ' →' : ''}</div>
    </a>`;
  });
  grid.innerHTML = html;
}

function renderStyleClusters(clusters) {
  const el = document.getElementById('style-clusters-content');
  if (!el || !clusters || !clusters.length) return;
  let html = '<table><thead><tr><th>球隊</th><th>節奏</th><th>三分率</th><th>禁區比例</th><th>助攻/失誤</th><th>風格</th></tr></thead><tbody>';
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
  el.innerHTML = html;
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
  'rgba(0,212,255,0.9)',   'rgba(255,107,53,0.9)',
  'rgba(100,220,120,0.9)', 'rgba(255,215,0,0.9)',
  'rgba(200,150,255,0.9)', 'rgba(255,180,100,0.9)',
  'rgba(100,200,255,0.9)',
];

function renderPaceTrend(trend) {
  const el = document.getElementById('chart-pace');
  if (!el || !trend || !trend.length) return;
  const axis = '#8fa3b8', grid = 'rgba(255,255,255,0.06)';
  deferChart(el, () => new Chart(el, {
    type: 'line',
    data: {
      datasets: trend.map((t, i) => ({
        label: short(t.name),
        data:  t.data,
        borderColor:     TEAM_COLORS[i % TEAM_COLORS.length],
        backgroundColor: 'transparent',
        pointRadius: 2,
        tension: 0.3,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      parsing: { xAxisKey: 'x', yAxisKey: 'y' },
      scales: {
        x: { type: 'linear', title: { display: true, text: '場次', color: axis }, ticks: { color: axis }, grid: { color: grid } },
        y: { title: { display: true, text: '回合數', color: axis }, ticks: { color: axis }, grid: { color: grid } }
      },
      plugins: { legend: { labels: { color: axis } } }
    }
  }));
}
