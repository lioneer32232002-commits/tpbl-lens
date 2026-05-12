# Calibration Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/formosa/calibration` — a hidden page showing how accurately the Monte Carlo model predicted each 夢想家 game, with Brier score and calibration plots. Data pipeline generates calibration JSON for all 6 teams.

**Architecture:** Add `generate_calibration()` to `process_data.py` (auto-runs after `process_team()`); output `data/calibration_<slug>_2526.json` per team. Extend `build.py` to output `dist/formosa/calibration/index.html` from a new `pages/calibration.html` template + `js/calibration.js`.

**Tech Stack:** Python + numpy (existing), Chart.js 4.4 (existing), vanilla JS, static HTML via existing `build.py` injection system.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `process_data.py` | Modify | Add `generate_calibration()` + call in `process_team()` |
| `build.py` | Modify | Add `CAL_PAGES` + calibration build logic |
| `pages/calibration.html` | Create | Page template with noindex meta, section scaffolding |
| `js/calibration.js` | Create | Fetch calibration JSON, render all 4 sections |
| `data/calibration_*_2526.json` | Generated | Output from `process_data.py` |

---

## Task 1: Add `generate_calibration` to `process_data.py`

**Files:**
- Modify: `process_data.py`

- [ ] **Step 1: Add `generate_calibration` function before `process_team`**

Insert this function at line 638 (immediately before `load_allteam`):

```python
def generate_calibration(games, all_game_data, team_id, team_name, slug):
    """
    For each game i, compute pre-game win probability using only
    data from games 0..i-1. No look-ahead bias.
    Win prob formula: same as calc_next_game (team_wr vs opp_wr + HOME_ADV).
    """
    results = []
    for i, game in enumerate(games):
        game_date = game["date"]  # "YYYYMMDD"

        # Team's win rate before game i
        games_before = games[:i]
        team_wins = sum(g["won"] for g in games_before)
        team_gp = len(games_before)
        team_wr = team_wins / team_gp if team_gp > 0 else 0.5

        # Opponent's win rate from all_game_data filtered to dates before game_date
        opp_name = game["opp"]
        opp_wins = 0
        opp_gp = 0
        for gd in all_game_data:
            gd_date = gd.get("game_date", "").replace("-", "")
            if not gd_date or gd_date >= game_date:
                continue
            ht, at = gd["home_team"], gd["away_team"]
            if ht.get("name") == opp_name:
                opp_side = ht
            elif at.get("name") == opp_name:
                opp_side = at
            else:
                continue
            opp_gp += 1
            lt = opp_side["teams"]["total"]
            if lt.get("won_score", 0) > lt.get("lost_score", 0):
                opp_wins += 1

        opp_wr = opp_wins / opp_gp if opp_gp > 0 else 0.5

        base = team_wr / (team_wr + opp_wr + 1e-9)
        prob = float(np.clip(base + (HOME_ADV if game["is_home"] else -HOME_ADV), 0.05, 0.95))

        results.append({
            "date":               game["date"],
            "opp":                opp_name,
            "is_home":            game["is_home"],
            "predicted_win_prob": round(prob, 4),
            "actual_win":         bool(game["won"]),
            "team_score":         game["team_score"],
            "opp_score":          game["opp_score"],
            "low_sample":         team_gp < 4,
        })

    n = len(results)
    brier = (
        sum((r["predicted_win_prob"] - (1 if r["actual_win"] else 0)) ** 2
            for r in results) / n
        if n > 0 else 0.0
    )

    return {
        "meta": {
            "team_id":   team_id,
            "team_name": team_name,
            "season":    "2025-26",
            "generated": datetime.date.today().isoformat(),
        },
        "summary": {
            "brier_score":        round(brier, 4),
            "n_games":            n,
            "games_won":          sum(1 for r in results if r["actual_win"]),
            "calibration_note":   "每場預測使用該場賽前可用資料，無 look-ahead bias",
        },
        "predictions": results,
    }
```

- [ ] **Step 2: Call `generate_calibration` at end of `process_team()`**

In `process_team()`, after line 784 (`print(f">>> {slug}_2526.json written ...")`), add:

```python
    cal_output = generate_calibration(games, all_game_data, team_id, name, slug)
    cal_path = os.path.join(out_dir, f"calibration_{slug}_2526.json")
    with open(cal_path, "w", encoding="utf-8") as f:
        json.dump(cal_output, f, ensure_ascii=False, indent=2)
    print(f">>> calibration_{slug}_2526.json written (brier={cal_output['summary']['brier_score']})")
    return output
```

Remove the existing `return output` line that was there before (it's now moved above).

- [ ] **Step 3: Run for one team to verify**

```
python process_data.py --team-id 3
```

Expected output includes:
```
>>> formosa_2526.json written (22W14L)
>>> calibration_formosa_2526.json written (brier=0.XXXX)
```

Then check the file:
```
python -c "import json; d=json.load(open('data/calibration_formosa_2526.json',encoding='utf-8')); print(d['summary']); print(d['predictions'][0])"
```

Expected: `summary` has `brier_score`, `n_games: 36`. First prediction has `date`, `predicted_win_prob` (should be ~0.5 since no history), `actual_win`.

- [ ] **Step 4: Commit**

```
git add process_data.py
git commit -m "feat: generate_calibration per-game win-prob with no look-ahead bias"
```

---

## Task 2: Update `build.py`

**Files:**
- Modify: `build.py`

- [ ] **Step 1: Add `CAL_PAGES` constant and calibration build logic**

After the `TEAM_PAGES` list (after line 18), add:

```python
CAL_PAGES = [
    {"slug": "formosa", "name": "福爾摩沙夢想家", "title": "夢想家預測校準紀錄｜TPBL-Lens"},
]
```

Inside the `build()` function, after the loop that writes team pages (after the `_write(os.path.join(DIST, t["slug"], "index.html"), content)` call), add:

```python
    cal_src = _read(os.path.join(PAGES, "calibration.html"))
    for t in CAL_PAGES:
        content = inject_partials(cal_src, head, nav, footer)
        content = content.replace("{{TEAM_SLUG}}", t["slug"])
        content = content.replace("{{TEAM_NAME}}", t["name"])
        content = content.replace("{{TEAM_TITLE}}", t["title"])
        _write(os.path.join(DIST, t["slug"], "calibration", "index.html"), content)
```

- [ ] **Step 2: Commit**

```
git add build.py
git commit -m "feat: build.py outputs formosa calibration page"
```

---

## Task 3: Create `pages/calibration.html`

**Files:**
- Create: `pages/calibration.html`

- [ ] **Step 1: Write the template**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <title>{{TEAM_TITLE}}</title>
  <meta name="description" content="{{TEAM_NAME}} 2025-26 預測校準紀錄｜TPBL-Lens">
  <meta name="robots" content="noindex, nofollow">
  {{HEAD}}
</head>
<body>
{{NAV}}
<main data-team="{{TEAM_SLUG}}">

  <section id="cal-header">
    <h1 style="font-size:1.3rem;font-weight:900;color:var(--accent);margin-bottom:.4rem">預測校準紀錄 2025-26</h1>
    <p style="color:var(--text2);font-size:.9rem">{{TEAM_NAME}}｜常規賽</p>
  </section>

  <section id="brier-summary">
    <h2>Brier Score</h2>
    <div id="brier-summary-content" class="card"></div>
  </section>

  <section id="brier-trend">
    <h2>Brier Score 累積趨勢</h2>
    <div class="card chart-wrap"><canvas id="chart-brier-trend" style="max-height:260px"></canvas></div>
  </section>

  <section id="cal-bins">
    <h2>Calibration Plot — 分桶</h2>
    <div class="card chart-wrap"><canvas id="chart-bins" style="max-height:300px"></canvas></div>
  </section>

  <section id="cal-scatter">
    <h2>Calibration Plot — 逐場散點</h2>
    <div class="card chart-wrap"><canvas id="chart-scatter" style="max-height:300px"></canvas></div>
  </section>

  <section id="predictions-table">
    <h2>預測紀錄</h2>
    <div class="card" style="overflow-x:auto">
      <table>
        <thead>
          <tr>
            <th>日期</th><th>對手</th><th>主客</th>
            <th>預測勝率</th><th>實際</th><th>比分</th>
          </tr>
        </thead>
        <tbody id="predictions-tbody"></tbody>
      </table>
    </div>
  </section>

</main>
{{FOOTER}}
<script src="/js/common.js"></script>
<script src="/js/calibration.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```
git add pages/calibration.html
git commit -m "feat: calibration page template with noindex"
```

---

## Task 4: Create `js/calibration.js`

**Files:**
- Create: `js/calibration.js`

- [ ] **Step 1: Write calibration.js**

```js
// calibration.js — /formosa/calibration page

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const team = document.querySelector('main')?.dataset.team;

fetch(`/data/calibration_${team}_2526.json`, { cache: 'no-store' })
  .then(r => r.json())
  .then(data => {
    renderBrierCard(data.summary);
    renderBrierTrend(data.predictions);
    renderCalibrationBins(data.predictions);
    renderCalibrationScatter(data.predictions);
    renderPredictionTable(data.predictions);
  })
  .catch(err => console.error('[calibration.js] Failed to load:', err));

function renderBrierCard(summary) {
  const el = document.getElementById('brier-summary-content');
  if (!el || !summary) return;
  const bs = summary.brier_score.toFixed(3);
  const n  = summary.n_games;
  const w  = summary.games_won;
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
            borderColor: '#00d4ff',
            backgroundColor: 'rgba(0,212,255,.08)',
            fill: true,
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.3,
          },
          {
            label: '隨機猜基準 (0.25)',
            data: points.map(p => ({ x: p.x, y: 0.25 })),
            borderColor: 'rgba(255,107,53,.4)',
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
            backgroundColor: 'rgba(0,212,255,.65)',
            borderColor: '#00d4ff',
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

  const window = 5;
  const maLine = sorted.map((_, i) => {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end   = Math.min(sorted.length, start + window);
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
            backgroundColor: 'rgba(0,212,255,.5)',
            pointRadius: 5,
          },
          {
            label: '移動平均（窗口 5）',
            data: maLine,
            type: 'line',
            borderColor: '#ff6b35',
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
    </tr>`;
  }
  tbody.innerHTML = html;
}
```

- [ ] **Step 2: Commit**

```
git add js/calibration.js
git commit -m "feat: calibration.js — brier card, trend, bins, scatter, table"
```

---

## Task 5: Generate calibration data for all 6 teams and verify

**Files:**
- Generated: `data/calibration_formosa_2526.json`, `data/calibration_lions_2526.json`, etc.

- [ ] **Step 1: Run process_data for all 7 teams**

```
python process_data.py --team-id 2
python process_data.py --team-id 3
python process_data.py --team-id 4
python process_data.py --team-id 5
python process_data.py --team-id 6
python process_data.py --team-id 7
python process_data.py --team-id 8
```

Expected: each run prints `>>> calibration_<slug>_2526.json written (brier=0.XXXX)`.

- [ ] **Step 2: Verify calibration JSON structure**

```
python -c "
import json
d = json.load(open('data/calibration_formosa_2526.json', encoding='utf-8'))
s = d['summary']
p0 = d['predictions'][0]
print('brier:', s['brier_score'], '  n_games:', s['n_games'])
print('first game:', p0['date'], p0['opp'], 'prob:', p0['predicted_win_prob'], 'actual:', p0['actual_win'])
print('low_sample flag on game 0:', p0['low_sample'])
assert s['n_games'] == 36, 'expected 36 games'
assert 0 <= s['brier_score'] <= 0.25, 'brier score out of range'
assert p0['low_sample'] == True, 'first game should be low_sample'
print('OK')
"
```

- [ ] **Step 3: Run build and check output**

```
python build.py
```

Expected output: `[build] dist/ updated`

Check that the calibration page was created:
```
python -c "import os; print(os.path.exists('dist/formosa/calibration/index.html'))"
```

Expected: `True`

Verify noindex tag:
```
python -c "
content = open('dist/formosa/calibration/index.html', encoding='utf-8').read()
assert 'noindex' in content, 'noindex meta missing'
assert 'calibration.js' in content, 'calibration.js not linked'
print('OK')
"
```

- [ ] **Step 4: Commit final**

```
git add data/calibration_*_2526.json
git commit -m "data: calibration predictions all 6 teams 2025-26"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered in task |
|---|---|
| 六隊都存校準資料 | Task 5 — run all 7 team IDs |
| 只做夢想家網頁 | Task 2 `CAL_PAGES` has only formosa |
| noindex meta | Task 3 `pages/calibration.html` |
| 導覽列不加連結 | `_nav.html` unchanged — no links added |
| Brier score 卡片 | Task 4 `renderBrierCard` |
| Brier score 累積趨勢 | Task 4 `renderBrierTrend` |
| Calibration plot 分桶 | Task 4 `renderCalibrationBins` |
| Calibration plot 逐場散點 | Task 4 `renderCalibrationScatter` |
| 預測紀錄表 | Task 4 `renderPredictionTable` |
| 低樣本標注 | `low_sample: true` for games[:4], shown in table |
| 無 look-ahead bias | `games[:i]` + date filter for opponent |
| build.py 整合 | Task 2 |
| auto_update 整合 | `generate_calibration` called inside `process_team()` — runs automatically |

**Placeholder scan:** None found — all steps have complete code.

**Type consistency:**
- `generate_calibration` returns dict with keys `meta`, `summary`, `predictions` — matches what `calibration.js` reads (`data.summary`, `data.predictions`) ✓
- `renderBrierCard(summary)` receives `data.summary` ✓
- `renderBrierTrend(predictions)`, `renderCalibrationBins(predictions)`, `renderCalibrationScatter(predictions)`, `renderPredictionTable(predictions)` all receive `data.predictions` ✓
- `deferChart(canvas, factory)` from `common.js` — correct 2-arg signature ✓
- Canvas IDs in HTML: `chart-brier-trend`, `chart-bins`, `chart-scatter` — match JS getElementById calls ✓
- `data-team="{{TEAM_SLUG}}"` on `<main>` — matches `document.querySelector('main')?.dataset.team` ✓
