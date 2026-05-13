// calibration.js — /formosa/calibration page

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const team = document.querySelector('main')?.dataset.team;

fetch(`/data/calibration_${team}_2526.json`, { cache: 'no-store' })
  .then(r => r.json())
  .then(data => {
    renderBrierCard(data.summary);
    renderBrierTrend(data.predictions);
    renderEloTrend(data.predictions);
    renderCalibrationBins(data.predictions);
    renderCalibrationScatter(data.predictions);
    renderPredictionTable(data.predictions);
  })
  .catch(err => console.error('[calibration.js] Failed to load:', err));

function renderBrierCard(summary) {
  const el = document.getElementById('brier-summary-content');
  if (!el || !summary) return;
  const bs = (summary.brier_score ?? 0).toFixed(3);
  const n  = summary.n_games ?? 0;
  const w  = summary.games_won ?? 0;
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:2rem;flex-wrap:wrap">
      <div style="text-align:center">
        <div style="font-size:2.8rem;font-weight:900;color:var(--accent);line-height:1">${bs}</div>
        <div style="color:var(--text2);font-size:.82rem;margin-top:.3rem">Brier Score</div>
      </div>
      <div style="flex:1;min-width:200px">
        <div style="color:var(--text2);font-size:.87rem;line-height:1.8">
          <div>場次：<strong style="color:var(--text)">${n} 場（${w}勝${n - w}敗）</strong></div>
          <div>0 = 完美預測 &nbsp;|&nbsp; 0.25 = 隨機猜（50/50）</div>
          <div style="margin-top:.5rem;color:var(--text2);font-size:.8rem">${esc(summary.calibration_note)}</div>
        </div>
      </div>
    </div>`;
}

function renderBrierTrend(predictions) {
  const canvas = document.getElementById('chart-brier-trend');
  if (!canvas || !predictions.length) return;

  let cumSum = 0;
  const points = predictions.map((p, i) => {
    const actual = p.actual_win ? 1 : 0;
    cumSum += (p.predicted_win_prob - actual) ** 2;
    return { x: i + 1, y: parseFloat((cumSum / (i + 1)).toFixed(4)) };
  });

  deferChart(canvas, () => {
    new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: '累積 Brier Score',
            data: points,
            borderColor: '#00e5ff',
            backgroundColor: 'rgba(0,229,255,.08)',
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.3,
          },
          {
            label: '隨機猜基準 (0.25)',
            data: points.map(p => ({ x: p.x, y: 0.25 })),
            borderColor: 'rgba(240,98,146,.4)',
            backgroundColor: 'transparent',
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [6, 4],
          },
        ]
      },
      options: {
        parsing: false,
        plugins: { legend: { display: true } },
        scales: {
          x: { type: 'linear', title: { display: true, text: '場次' } },
          y: { min: 0, max: 0.35, title: { display: true, text: 'Brier Score（累積）' } },
        },
      },
    });
  });
}

function renderEloTrend(predictions) {
  const canvas = document.getElementById('chart-elo-trend');
  if (!canvas || !predictions.length) return;

  const points = predictions.map((p, i) => ({
    x: i + 1,
    y: p.elo_after ?? p.elo_before,
  }));

  deferChart(canvas, () => {
    new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Elo 評分',
            data: points,
            borderColor: '#00d4ff',
            backgroundColor: 'rgba(0,212,255,.08)',
            fill: true,
            pointRadius: 3,
            borderWidth: 2,
            tension: 0.3,
          },
          {
            label: '聯盟基準 (1500)',
            data: points.map(p => ({ x: p.x, y: 1500 })),
            borderColor: 'rgba(255,255,255,.2)',
            backgroundColor: 'transparent',
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [6, 4],
          },
        ],
      },
      options: {
        parsing: false,
        plugins: { legend: { display: true } },
        scales: {
          x: { type: 'linear', title: { display: true, text: '場次' } },
          y: { title: { display: true, text: 'Elo 評分' } },
        },
      },
    });
  });
}

function renderCalibrationBins(predictions) {
  const canvas = document.getElementById('chart-bins');
  if (!canvas || !predictions.length) return;

  const binDefs = [
    { label: '0–20%',   min: 0,   max: 0.2  },
    { label: '20–40%',  min: 0.2, max: 0.4  },
    { label: '40–60%',  min: 0.4, max: 0.6  },
    { label: '60–80%',  min: 0.6, max: 0.8  },
    { label: '80–100%', min: 0.8, max: 1.01 },
  ];

  const bins = binDefs.map(b => {
    const inBin = predictions.filter(p =>
      p.predicted_win_prob >= b.min && p.predicted_win_prob < b.max
    );
    const n = inBin.length;
    const wins = inBin.filter(p => p.actual_win).length;
    return {
      label: `${b.label}\n(n=${n})`,
      actualRate: n > 0 ? parseFloat((wins / n * 100).toFixed(1)) : null,
      midPct: parseFloat(((b.min + b.max) / 2 * 100).toFixed(1)),
    };
  });

  deferChart(canvas, () => {
    new Chart(canvas, {
      type: 'bar',
      data: {
        labels: bins.map(b => b.label),
        datasets: [
          {
            label: '實際勝率 (%)',
            data: bins.map(b => b.actualRate),
            backgroundColor: bins.map(b =>
              b.actualRate === null ? 'rgba(255,255,255,.15)'
              : b.actualRate > b.midPct ? 'rgba(0,212,255,.65)'
              : 'rgba(240,98,146,.65)'
            ),
            borderColor: bins.map(b =>
              b.actualRate === null ? 'rgba(255,255,255,.3)'
              : b.actualRate > b.midPct ? '#00d4ff'
              : '#f06292'
            ),
            borderWidth: 1,
          },
          {
            label: '完美校準',
            data: bins.map(b => b.midPct),
            type: 'line',
            borderColor: 'rgba(255,255,255,.3)',
            backgroundColor: 'transparent',
            pointRadius: 4,
            pointBackgroundColor: 'rgba(255,255,255,.5)',
            borderDash: [5, 4],
            borderWidth: 1.5,
          },
        ],
      },
      options: {
        plugins: { legend: { display: true } },
        scales: {
          y: {
            min: 0,
            max: 100,
            title: { display: true, text: '實際勝率 (%)' },
          },
        },
      },
    });
  });
}

function renderCalibrationScatter(predictions) {
  const canvas = document.getElementById('chart-scatter');
  if (!canvas || !predictions.length) return;

  const sorted = [...predictions].sort((a, b) => a.predicted_win_prob - b.predicted_win_prob);

  const winSize = 5;
  const maLine = sorted.map((_, i) => {
    const start = Math.max(0, i - Math.floor(winSize / 2));
    const end   = Math.min(sorted.length, start + winSize);
    const slice = sorted.slice(start, end);
    const avgWin = slice.reduce((s, p) => s + (p.actual_win ? 1 : 0), 0) / slice.length;
    return { x: sorted[i].predicted_win_prob, y: parseFloat(avgWin.toFixed(3)) };
  });

  const scatterData = sorted.map(p => ({
    x: p.predicted_win_prob,
    y: p.actual_win ? 1 : 0,
  }));

  deferChart(canvas, () => {
    new Chart(canvas, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: '實際結果（1=勝, 0=敗）',
            data: scatterData,
            backgroundColor: 'rgba(0,229,255,.5)',
            pointRadius: 5,
          },
          {
            label: '移動平均（窗口 5）',
            data: maLine,
            type: 'line',
            borderColor: '#f06292',
            backgroundColor: 'transparent',
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.4,
          },
          {
            label: '完美校準',
            data: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
            type: 'line',
            borderColor: 'rgba(255,255,255,.2)',
            backgroundColor: 'transparent',
            pointRadius: 0,
            borderDash: [5, 4],
            borderWidth: 1,
          },
        ],
      },
      options: {
        plugins: { legend: { display: true } },
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: 1,
            title: { display: true, text: '預測勝率' },
          },
          y: {
            min: -0.15,
            max: 1.15,
            title: { display: true, text: '實際結果' },
            ticks: {
              stepSize: 1,
              callback: v => v === 0 ? '敗' : v === 1 ? '勝' : '',
            },
          },
        },
      },
    });
  });
}

function renderPredictionTable(predictions) {
  const tbody = document.getElementById('predictions-tbody');
  if (!tbody || !predictions.length) return;

  const fmtDate = d => `${parseInt(d.slice(4, 6))}/${parseInt(d.slice(6, 8))}`;

  let html = '';
  for (const p of predictions) {
    const pct   = (p.predicted_win_prob * 100).toFixed(1) + '%';
    const ha    = p.is_home ? '主' : '客';
    const result = p.actual_win
      ? '<span style="color:var(--accent);font-weight:700">勝</span>'
      : '<span style="color:var(--accent2)">敗</span>';
    const score = `${p.team_score}–${p.opp_score}`;
    const lowNote = p.low_sample
      ? ' <span style="color:var(--text2);font-size:.75rem">(樣本不足)</span>'
      : '';
    html += `<tr${p.low_sample ? ' style="opacity:.6"' : ''}>
      <td>${fmtDate(p.date)}</td>
      <td>${esc(p.opp)}</td>
      <td>${ha}</td>
      <td>${pct}${lowNote}</td>
      <td>${result}</td>
      <td>${score}</td>
      <td style="color:${(p.net_rtg ?? 0) >= 0 ? 'var(--accent)' : '#f06292'}">${p.net_rtg != null ? (p.net_rtg > 0 ? '+' : '') + p.net_rtg.toFixed(1) : '—'}</td>
    </tr>`;
  }
  tbody.innerHTML = html;
}
