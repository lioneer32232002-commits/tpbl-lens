# Elo Calibration Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the win-rate ratio calibration model with MOV-adjusted Elo + pace-adjusted net rating, targeting Brier Score ≤ 0.215 and eliminating 0.05-floor extremes in early-season predictions.

**Architecture:** Add two pure helper functions (`calc_possessions`, `elo_win_prob`) and one replacement function (`compute_elo_calibration`) to `process_data.py`. The new function maintains a global Elo dict across all 7 teams, updated chronologically for every game, so cross-team information propagates even when the target team has few games. Each prediction records `elo_before`, `elo_after`, and `net_rtg`. Frontend gets a new Elo trend chart alongside the existing Brier trend.

**Tech Stack:** Python 3 (`math`, existing `numpy`), Chart.js (already loaded), no new dependencies.

---

## File Map

| File | Change |
|---|---|
| `process_data.py` | Add `import math`; add `calc_possessions`, `elo_win_prob`, `compute_elo_calibration`; delete `generate_calibration`; update `process_team` call |
| `tests/test_process_data.py` | Add `TestCalcPossessions`, `TestEloWinProb`, `TestComputeEloCalibration` |
| `pages/calibration.html` | Add `<canvas id="chart-elo-trend">` section after brier-trend |
| `js/calibration.js` | Add `renderEloTrend()`; call it in the main fetch chain; update table to show `net_rtg` |

---

## Task 1: `calc_possessions` + `elo_win_prob` helpers

**Files:**
- Modify: `process_data.py` (after the `_mean` function, around line 29)
- Modify: `tests/test_process_data.py` (append new test classes)

- [ ] **Step 1: Write failing tests**

Append to `tests/test_process_data.py`:

```python
class TestCalcPossessions:
    def test_standard_formula(self):
        from process_data import calc_possessions
        # poss = FGA + 0.44*FTA + TO - OREB = 80 + 8.8 + 12 - 10 = 90.8
        total = {
            "field_goals_attempted": 80,
            "free_throws_attempted": 20,
            "turnovers": 12,
            "offensive_rebounds": 10,
        }
        assert calc_possessions(total) == pytest.approx(90.8, abs=0.01)

    def test_missing_keys_default_zero(self):
        from process_data import calc_possessions
        # all missing → poss = 0, clamped to 1.0
        assert calc_possessions({}) == pytest.approx(1.0, abs=0.01)

    def test_floor_at_one(self):
        from process_data import calc_possessions
        # large OREB could push below zero — must stay ≥ 1.0
        total = {"field_goals_attempted": 5, "free_throws_attempted": 0,
                 "turnovers": 0, "offensive_rebounds": 100}
        assert calc_possessions(total) >= 1.0


class TestEloWinProb:
    def test_equal_elo_home_favored(self):
        from process_data import elo_win_prob
        # home +65 Elo bonus → should be > 0.5
        p = elo_win_prob(1500, 1500, home_a=True)
        assert p == pytest.approx(0.5925, abs=0.001)

    def test_equal_elo_away_symmetric(self):
        from process_data import elo_win_prob
        p_home = elo_win_prob(1500, 1500, home_a=True)
        p_away = elo_win_prob(1500, 1500, home_a=False)
        assert p_home + p_away == pytest.approx(1.0, abs=1e-9)

    def test_higher_elo_team_favored(self):
        from process_data import elo_win_prob
        # 1600 vs 1500, both neutral → stronger team wins more often
        p = elo_win_prob(1600, 1500, home_a=False)
        assert p > 0.5

    def test_output_bounded(self):
        from process_data import elo_win_prob
        assert 0.0 < elo_win_prob(2000, 1000, home_a=True) < 1.0
        assert 0.0 < elo_win_prob(1000, 2000, home_a=False) < 1.0
```

- [ ] **Step 2: Run tests to confirm they fail**

```
pytest tests/test_process_data.py::TestCalcPossessions tests/test_process_data.py::TestEloWinProb -v
```

Expected: `ImportError` or `AttributeError` — functions don't exist yet.

- [ ] **Step 3: Add `import math` and both helper functions to `process_data.py`**

Add `import math` to the import block (line 5, after `import json, os, sys, argparse`):

```python
import json, math, os, sys, argparse
```

Add after the `_mean` function (around line 30):

```python
def calc_possessions(total):
    """Estimate possessions: FGA + 0.44*FTA + TO - OREB. Floor at 1.0."""
    fga  = total.get("field_goals_attempted", 0) or 0
    fta  = total.get("free_throws_attempted", 0) or 0
    to   = total.get("turnovers", 0) or 0
    oreb = total.get("offensive_rebounds", 0) or 0
    return max(fga + 0.44 * fta + to - oreb, 1.0)


def elo_win_prob(elo_a, elo_b, home_a=True):
    """P(team A beats team B). home_a=True gives A a +65 Elo home bonus."""
    home_bonus = 65.0 if home_a else -65.0
    return 1.0 / (1.0 + 10 ** ((elo_b - elo_a - home_bonus) / 400))
```

- [ ] **Step 4: Run tests to confirm they pass**

```
pytest tests/test_process_data.py::TestCalcPossessions tests/test_process_data.py::TestEloWinProb -v
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```
git add process_data.py tests/test_process_data.py
git commit -m "feat: add calc_possessions and elo_win_prob helpers"
```

---

## Task 2: `compute_elo_calibration` function

**Files:**
- Modify: `process_data.py` (add function before `generate_calibration`, around line 641)
- Modify: `tests/test_process_data.py` (append `TestComputeEloCalibration`)

- [ ] **Step 1: Write failing tests**

Append to `tests/test_process_data.py`:

```python
class TestComputeEloCalibration:
    """Uses the 2-game fixture: game_9001 (Lions home beat Formosa) +
    game_9002 (Aquas home beat Lions)."""

    def _run(self, team_id, team_name, slug):
        from process_data import compute_elo_calibration, parse_games
        all_gd = _load_games()
        games  = parse_games(all_gd, team_id, team_name)
        return compute_elo_calibration(games, all_gd, team_id, team_name, slug)

    # --- structural checks ---

    def test_returns_required_keys(self):
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        assert {"meta", "summary", "predictions"} == set(out.keys())

    def test_summary_has_final_elo(self):
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        assert "final_elo" in out["summary"]

    def test_prediction_has_elo_fields(self):
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        p = out["predictions"][0]
        assert "elo_before" in p
        assert "elo_after"  in p
        assert "net_rtg"    in p

    # --- Formosa: 1 game in fixture (away, lost) ---

    def test_formosa_one_prediction(self):
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        assert len(out["predictions"]) == 1

    def test_formosa_first_game_not_extreme(self):
        """Elo model must NOT produce 0.05 for first game (old model's failure)."""
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        p = out["predictions"][0]["predicted_win_prob"]
        assert p > 0.30, f"Expected > 0.30, got {p}"
        assert p < 0.60, f"Expected < 0.60, got {p}"

    def test_formosa_first_game_approx_prob(self):
        """Both teams at 1500, Formosa away → ~0.4075."""
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        p = out["predictions"][0]["predicted_win_prob"]
        assert p == pytest.approx(0.4075, abs=0.002)

    def test_formosa_elo_before_is_1500(self):
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        assert out["predictions"][0]["elo_before"] == pytest.approx(1500.0, abs=0.1)

    def test_formosa_low_sample_true_for_first_game(self):
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        assert out["predictions"][0]["low_sample"] is True

    def test_formosa_net_rtg_negative(self):
        """Formosa lost by 7, so net_rtg should be negative."""
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        assert out["predictions"][0]["net_rtg"] < 0

    # --- Lions: 2 games in fixture ---

    def test_lions_two_predictions(self):
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        assert len(out["predictions"]) == 2

    def test_lions_game1_home_prob_above_half(self):
        """Lions home, both at 1500 → should be > 0.50."""
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        assert out["predictions"][0]["predicted_win_prob"] > 0.50

    def test_lions_game2_uses_updated_elo(self):
        """After winning game 1, Lions Elo > 1500; game 2 elo_before should reflect that."""
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        assert out["predictions"][1]["elo_before"] > 1500.0

    def test_brier_score_computed(self):
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        assert 0.0 <= out["summary"]["brier_score"] <= 1.0

    def test_meta_has_model_field(self):
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        assert "model" in out["meta"]
```

- [ ] **Step 2: Run tests to confirm they fail**

```
pytest tests/test_process_data.py::TestComputeEloCalibration -v
```

Expected: `ImportError` — `compute_elo_calibration` doesn't exist yet.

- [ ] **Step 3: Add `compute_elo_calibration` to `process_data.py`**

Insert the following function immediately before `generate_calibration` (around line 641):

```python
def compute_elo_calibration(games, all_game_data, team_id, team_name, slug):
    """
    Walk-forward Elo calibration using all 7 teams' games.
    For each of the target team's games, predict win prob using only
    Elo ratings built from games played strictly before that date.
    MOV signal: pace-adjusted net rating (pts/possessions × 100).
    K=20, home_bonus=65 Elo pts.
    """
    K = 20.0
    ELO_START = 1500.0

    all_sorted = sorted(all_game_data, key=lambda g: g.get("game_date", ""))
    elos = {}          # team_id (int) -> float
    results = []
    target_count = 0   # how many target-team games recorded so far

    for raw in all_sorted:
        date_str = raw.get("game_date", "").replace("-", "")
        ht = raw["home_team"]
        at = raw["away_team"]
        ht_id = ht["id"]
        at_id = at["id"]
        ht_total = ht["teams"]["total"]
        at_total = at["teams"]["total"]

        elo_h = elos.get(ht_id, ELO_START)
        elo_a = elos.get(at_id, ELO_START)
        pred_h = elo_win_prob(elo_h, elo_a, home_a=True)

        is_target = (ht_id == team_id or at_id == team_id)
        if is_target:
            is_home = (ht_id == team_id)
            t_total = ht_total if is_home else at_total
            o_total = at_total if is_home else ht_total
            opp_name = at["name"] if is_home else ht["name"]
            pred_prob = pred_h if is_home else (1.0 - pred_h)
            actual_win = bool(t_total["won_score"] > o_total["won_score"])

            t_poss = calc_possessions(t_total)
            o_poss = calc_possessions(o_total)
            net_rtg = round(
                (t_total["won_score"] / t_poss - o_total["won_score"] / o_poss) * 100, 2
            )

            results.append({
                "date":               date_str,
                "opp":                opp_name,
                "is_home":            is_home,
                "predicted_win_prob": round(pred_prob, 4),
                "actual_win":         actual_win,
                "team_score":         t_total["won_score"],
                "opp_score":          o_total["won_score"],
                "low_sample":         target_count < 4,
                "elo_before":         round(elos.get(team_id, ELO_START), 1),
                "net_rtg":            net_rtg,
            })
            target_count += 1

        # Update Elos for ALL games (not just target team)
        ht_pts = ht_total["won_score"]
        at_pts = at_total["won_score"]
        ht_poss = calc_possessions(ht_total)
        at_poss = calc_possessions(at_total)
        net_rtg_abs = abs((ht_pts / ht_poss - at_pts / at_poss) * 100)

        if ht_pts >= at_pts:  # home wins (or equal, treated as home)
            w_elo, l_elo = elo_h, elo_a
            elo_diff = w_elo - l_elo
            mov_mult = math.log(net_rtg_abs + 1) * (2.2 / (elo_diff * 0.001 + 2.2))
            delta = K * mov_mult * abs(1.0 - pred_h)
            elos[ht_id] = elo_h + delta
            elos[at_id] = elo_a - delta
        else:  # away wins
            w_elo, l_elo = elo_a, elo_h
            elo_diff = w_elo - l_elo
            mov_mult = math.log(net_rtg_abs + 1) * (2.2 / (elo_diff * 0.001 + 2.2))
            delta = K * mov_mult * abs(0.0 - pred_h)
            elos[at_id] = elo_a + delta
            elos[ht_id] = elo_h - delta

        if is_target:
            results[-1]["elo_after"] = round(elos.get(team_id, ELO_START), 1)

    n = len(results)
    brier = (
        sum((r["predicted_win_prob"] - (1 if r["actual_win"] else 0)) ** 2 for r in results) / n
        if n > 0 else 0.0
    )

    return {
        "meta": {
            "team_id":   team_id,
            "team_name": team_name,
            "season":    "2025-26",
            "generated": datetime.date.today().isoformat(),
            "model":     "MOV-adjusted Elo (K=20, home_bonus=65, pace-adjusted net rating)",
        },
        "summary": {
            "brier_score":      round(brier, 4),
            "n_games":          n,
            "games_won":        sum(1 for r in results if r["actual_win"]),
            "final_elo":        round(elos.get(team_id, ELO_START), 1),
            "calibration_note": "Elo + Pace-adjusted Net Rating；賽前勝率無 look-ahead bias",
        },
        "predictions": results,
    }
```

- [ ] **Step 4: Run tests to confirm they pass**

```
pytest tests/test_process_data.py::TestComputeEloCalibration -v
```

Expected: all 14 tests PASS.

- [ ] **Step 5: Run full test suite to check no regressions**

```
pytest tests/ -v
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```
git add process_data.py tests/test_process_data.py
git commit -m "feat: add compute_elo_calibration — MOV-adjusted Elo with pace-adjusted net rating"
```

---

## Task 3: Wire into `process_team`, delete old function, regenerate JSONs

**Files:**
- Modify: `process_data.py` (replace call on line ~867, delete `generate_calibration`)

- [ ] **Step 1: Replace `generate_calibration` call in `process_team`**

Find this block (around line 867):

```python
    cal_output = generate_calibration(games, all_game_data, team_id, name, slug)
```

Replace with:

```python
    cal_output = compute_elo_calibration(games, all_game_data, team_id, name, slug)
```

- [ ] **Step 2: Delete the old `generate_calibration` function**

Remove the entire function body of `generate_calibration` from `process_data.py` (lines ~641–715 in the original file, now shifted). The function starts with:

```python
def generate_calibration(games, all_game_data, team_id, team_name, slug):
```

and ends before `def load_allteam`.

- [ ] **Step 3: Run full test suite**

```
pytest tests/ -v
```

Expected: all tests PASS (no test referenced `generate_calibration` by name).

- [ ] **Step 4: Regenerate all 7 teams' calibration JSONs**

```
python process_data.py --team-id 2
python process_data.py --team-id 3
python process_data.py --team-id 4
python process_data.py --team-id 5
python process_data.py --team-id 6
python process_data.py --team-id 7
python process_data.py --team-id 8
```

For each, check the output line:
```
>>> calibration_formosa_2526.json written (brier=0.XXXX)
```
Verify Formosa's brier < 0.220 (improvement from 0.247).

- [ ] **Step 5: Spot-check Formosa JSON**

Open `data/calibration_formosa_2526.json` and confirm:
- `predictions[0].predicted_win_prob` is between 0.30 and 0.60 (not 0.05)
- `predictions[0].elo_before` = 1500.0
- Each prediction has `elo_after` and `net_rtg` fields
- `summary.final_elo` is present

- [ ] **Step 6: Commit**

```
git add process_data.py data/calibration_*_2526.json
git commit -m "feat: replace generate_calibration with Elo model; regenerate all 7 calibration JSONs"
```

---

## Task 4: Frontend — Elo trend chart

**Files:**
- Modify: `pages/calibration.html`
- Modify: `js/calibration.js`

- [ ] **Step 1: Add Elo trend section to `pages/calibration.html`**

Insert the following block immediately after the `<section id="brier-trend">` block (after line 26):

```html
  <section id="elo-trend">
    <h2>Elo 強度曲線</h2>
    <div class="card chart-wrap"><canvas id="chart-elo-trend" style="max-height:260px"></canvas></div>
  </section>
```

- [ ] **Step 2: Add `renderEloTrend` to `js/calibration.js`**

Add the following function after `renderBrierTrend` (after line 86):

```javascript
function renderEloTrend(predictions, summary) {
  const canvas = document.getElementById('chart-elo-trend');
  if (!canvas || !predictions.length) return;

  const points = predictions.map((p, i) => ({
    x: i + 1,
    y: p.elo_after ?? p.elo_before,
  }));

  const finalElo = summary?.final_elo ?? points[points.length - 1]?.y ?? 1500;

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
```

- [ ] **Step 3: Call `renderEloTrend` in the fetch chain**

In `js/calibration.js`, find the fetch `.then` block (lines 8–14):

```javascript
  .then(data => {
    renderBrierCard(data.summary);
    renderBrierTrend(data.predictions);
    renderCalibrationBins(data.predictions);
    renderCalibrationScatter(data.predictions);
    renderPredictionTable(data.predictions);
  })
```

Replace with:

```javascript
  .then(data => {
    renderBrierCard(data.summary);
    renderBrierTrend(data.predictions);
    renderEloTrend(data.predictions, data.summary);
    renderCalibrationBins(data.predictions);
    renderCalibrationScatter(data.predictions);
    renderPredictionTable(data.predictions);
  })
```

- [ ] **Step 4: Add `net_rtg` column to the predictions table**

In `pages/calibration.html`, find the table header:

```html
            <th>日期</th><th>對手</th><th>主客</th>
            <th>預測勝率</th><th>實際</th><th>比分</th>
```

Replace with:

```html
            <th>日期</th><th>對手</th><th>主客</th>
            <th>預測勝率</th><th>實際</th><th>比分</th><th>Net Rtg</th>
```

- [ ] **Step 5: Update `renderPredictionTable` in `js/calibration.js` to show `net_rtg`**

Find the `renderPredictionTable` function. Locate the line that builds the table row — it will look like:

```javascript
      `<td>${esc(p.team_score)}–${esc(p.opp_score)}</td>`
```

Add one more `<td>` after the score cell:

```javascript
      `<td>${esc(p.team_score)}–${esc(p.opp_score)}</td>` +
      `<td style="color:${(p.net_rtg ?? 0) >= 0 ? 'var(--accent)' : '#f06292'}">${p.net_rtg != null ? (p.net_rtg > 0 ? '+' : '') + p.net_rtg.toFixed(1) : '—'}</td>`
```

- [ ] **Step 6: Build and verify**

```
python build.py
```

Open `dist/formosa/calibration/index.html` in a browser (or `python -m http.server 8000` from `dist/`).

Verify:
- Elo trend chart appears between Brier trend and calibration bins
- Chart shows a line starting near 1500 with a horizontal 1500 baseline
- Table now has a "Net Rtg" column with coloured values
- No console errors

- [ ] **Step 7: Commit**

```
git add pages/calibration.html js/calibration.js
git commit -m "feat: add Elo trend chart and Net Rtg column to calibration page"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Elo with MOV-adjusted K-factor → Task 2 (`compute_elo_calibration`)
- ✅ Pace-adjusted Net Rating → `calc_possessions` in Task 1, used in Task 2
- ✅ Global prior (all teams start 1500) → initialised in Task 2
- ✅ Cross-team Elo updates → all_sorted loop in Task 2
- ✅ `elo_before`, `elo_after`, `net_rtg` JSON fields → Task 2 + Task 3 spot-check
- ✅ `final_elo` in summary → Task 2
- ✅ `model` in meta → Task 2
- ✅ Elo trend chart → Task 4
- ✅ `low_sample` kept for compatibility → Task 2 (`target_count < 4`)
- ✅ Delete old `generate_calibration` → Task 3
- ✅ Brier Score target ≤ 0.215 → verified in Task 3 spot-check

**Placeholder scan:** None found.

**Type consistency:** `calc_possessions` returns `float`, used in Task 2 division — consistent. `elo_win_prob` returns `float`, used as `pred_h` — consistent. `elo_before`/`elo_after` are `round(..., 1)` floats — consistent with `net_rtg` rounding. `renderEloTrend` reads `p.elo_after ?? p.elo_before` — consistent with JSON field names from Task 2.
