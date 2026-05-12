// common.js — shared across all team pages

const TEAM_SHORT = {
  '福爾摩沙夢想家': '夢想家', '新竹御嵿攻城獅': '攻城獅',
  '高雄全家海神': '海神', '桃園台啤永豐雲豹': '雲豹',
  '新北中信特攻': '特攻', '新北國王': '國王', '臺北台新戰神': '戰神',
};
const short = n => TEAM_SHORT[n] || n;

Chart.defaults.font.family = "'Noto Sans TC', 'Microsoft JhengHei', sans-serif";
Chart.defaults.font.weight = '700';
Chart.defaults.animation.duration = 900;
Chart.defaults.animation.easing = 'easeOutQuart';
Chart.defaults.color = '#8fa3b8';

const _deferred = [];
let _obs;
function deferChart(el, factory) {
  if (!el) return;
  if (!_obs) {
    _obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const idx = _deferred.findIndex(d => d.el === e.target);
        if (idx !== -1) {
          _deferred[idx].factory();
          _obs.unobserve(e.target);
          _deferred.splice(idx, 1);
        }
      });
    }, { rootMargin: '200px' });
  }
  _deferred.push({ el, factory });
  _obs.observe(el);
}

function renderHeatmap(tableEl, heatmap) {
  if (!tableEl || !heatmap || !heatmap.length) return;
  const teams = Object.keys(heatmap[0].values);
  const pmScore = v => v >= 8 ? 3 : v >= 3 ? 2 : v > 0 ? 1 : v === 0 ? 0 : v > -3 ? -1 : v > -8 ? -2 : -3;
  const nonNull = r => Object.values(r.values).filter(x => x != null).length;
  const colSum  = r => Object.values(r.values).filter(x => x != null).reduce((a, v) => a + pmScore(v), 0);
  const sorted  = [...heatmap].sort((a, b) => nonNull(b) - nonNull(a) || colSum(b) - colSum(a));

  let html = '<thead><tr><th>球員</th>';
  teams.forEach(t => { html += `<th>${short(t)}</th>`; });
  html += '</tr></thead><tbody>';
  sorted.forEach(row => {
    html += `<tr><td class="hm-name">${row.player}</td>`;
    teams.forEach(t => {
      const v = row.values[t];
      if (v == null) { html += `<td class="hm-cell hm-null">—</td>`; return; }
      const cls = v >= 8 ? 'hm-p3' : v >= 3 ? 'hm-p2' : v > 0 ? 'hm-p1'
                : v === 0 ? 'hm-z' : v > -3 ? 'hm-n1' : v > -8 ? 'hm-n2' : 'hm-n3';
      html += `<td class="hm-cell ${cls}">${v > 0 ? '+' : ''}${v}</td>`;
    });
    html += '</tr>';
  });
  tableEl.innerHTML = html + '</tbody>';
}

function renderPppHeatmap(tableEl, pppData) {
  if (!tableEl || !pppData || !pppData.length) return;
  const teams = Object.keys(pppData[0].values);
  const pppScore = v => v >= 1.3 ? 3 : v >= 1.15 ? 2 : v >= 1.0 ? 1 : v >= 0.9 ? -1 : v >= 0.8 ? -2 : -3;
  const nonNull = r => Object.values(r.values).filter(x => x != null).length;
  const colSum  = r => Object.values(r.values).filter(x => x != null).reduce((a, v) => a + pppScore(v), 0);
  const sorted  = [...pppData].sort((a, b) => nonNull(b) - nonNull(a) || colSum(b) - colSum(a));

  let html = '<thead><tr><th>球員</th>';
  teams.forEach(t => { html += `<th>${short(t)}</th>`; });
  html += '</tr></thead><tbody>';
  sorted.forEach(row => {
    html += `<tr><td class="hm-name">${row.player}</td>`;
    teams.forEach(t => {
      const v = row.values[t];
      if (v == null) { html += `<td class="hm-cell hm-null">—</td>`; return; }
      const cls = v >= 1.3 ? 'hm-p3' : v >= 1.15 ? 'hm-p2' : v >= 1.0 ? 'hm-p1'
                : v >= 0.9 ? 'hm-n1' : v >= 0.8 ? 'hm-n2' : 'hm-n3';
      html += `<td class="hm-cell ${cls}">${v.toFixed(2)}</td>`;
    });
    html += '</tr>';
  });
  tableEl.innerHTML = html + '</tbody>';
}
