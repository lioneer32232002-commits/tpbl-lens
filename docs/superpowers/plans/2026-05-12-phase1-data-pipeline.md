# Phase 1: Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a generalized TPBL data pipeline that fetches game data for all 7 teams, processes each team into a `data/{slug}_2526.json`, and generates `data/league_2526.json`.

**Architecture:** `fetch_games.py` caches raw API game JSON to `data/games/{game_id}.txt`; `process_data.py --team-id N` reads those cached files, runs all statistical analyses, and writes one team JSON; `generate_league.py` reads `allteam_latest.txt` and writes league JSON; `auto_update.py` orchestrates everything in one command.

**Tech Stack:** Python 3.11+, numpy, scipy, requests; pytest for tests; GitHub Actions for cron.

---

## Reference: TPBL Team IDs (2025-26)

| ID | Name | Slug | Full Depth |
|---|---|---|---|
| 2 | 高雄全家海神 | aquas | No |
| 3 | 福爾摩沙夢想家 | formosa | Yes |
| 4 | 新竹御嵿攻城獅 | lions | Yes |
| 5 | 桃園台啤永豐雲豹 | leopards | No |
| 6 | 新北中信特攻 | braves | No |
| 7 | 新北國王 | kings | No |
| 8 | 臺北台新戰神 | warriors | No |

**API base:** `https://api.tpbl.basketball/api`
- `GET games/{id}/stats` → single game box score
- `GET games/stats/teams?division_id=9` → all-team aggregate stats
- Schedule: load from `data/allgame_2526.txt` (bootstrap from lioneers-web copy; see Task 1)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `config.py` | Create | Team IDs, slugs, API constants, season config |
| `fetch_games.py` | Create | API client; cache game files; sync new games |
| `process_data.py` | Create | `--team-id N` → `data/{slug}_2526.json` |
| `generate_league.py` | Create | `allteam_latest.txt` → `data/league_2526.json` |
| `auto_update.py` | Create | Orchestrator: check new → process × 7 → league |
| `requirements.txt` | Create | numpy, scipy, requests, pytest |
| `data/allgame_2526.txt` | Create (bootstrap) | Season schedule (bootstrap from lioneers-web) |
| `data/allteam_latest.txt` | Runtime | Fetched by auto_update; team aggregate stats |
| `data/games/{game_id}.txt` | Runtime | Individual game box scores |
| `data/{slug}_2526.json` | Runtime | Per-team output |
| `data/league_2526.json` | Runtime | League-wide output |
| `.github/workflows/auto-update.yml` | Create | GitHub Actions cron 22:30 nightly |
| `tests/test_config.py` | Create | Smoke-test config constants |
| `tests/test_fetch_games.py` | Create | fetch_games logic (mocked API) |
| `tests/test_process_data.py` | Create | Data-processing functions |
| `tests/test_generate_league.py` | Create | League JSON generation |
| `tests/fixtures/game_sample.json` | Create | Minimal box score for tests |
| `tests/fixtures/allteam_sample.json` | Create | Minimal allteam for tests |

---

## Task 1: Scaffold — config.py + requirements.txt + bootstrap schedule

**Files:**
- Create: `config.py`
- Create: `requirements.txt`
- Create: `data/allgame_2526.txt` (bootstrap copy)
- Create: `tests/__init__.py`
- Create: `tests/test_config.py`

### Steps

- [ ] **Step 1: Write the failing test**

`tests/test_config.py`:
```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import TEAMS, API_BASE, DIVISION_ID, SEASON, TOTAL_GAMES

def test_all_team_ids_present():
    assert set(TEAMS.keys()) == {2, 3, 4, 5, 6, 7, 8}

def test_full_depth_teams():
    full = {tid for tid, t in TEAMS.items() if t["full_depth"]}
    assert full == {3, 4}  # formosa + lions

def test_slugs_are_unique():
    slugs = [t["slug"] for t in TEAMS.values()]
    assert len(slugs) == len(set(slugs))

def test_api_base():
    assert API_BASE == "https://api.tpbl.basketball/api"

def test_division_id():
    assert DIVISION_ID == 9

def test_total_games():
    assert TOTAL_GAMES == 36
```

- [ ] **Step 2: Run test to confirm failure**

```
cd "C:\Users\oneda\OneDrive\02_創作\14_AI TEST\tpbl_lens"
python -m pytest tests/test_config.py -v
```
Expected: `ModuleNotFoundError: No module named 'config'`

- [ ] **Step 3: Create requirements.txt**

`requirements.txt`:
```
numpy>=1.26
scipy>=1.12
requests>=2.31
pytest>=8.0
```

Install: `pip install -r requirements.txt`

- [ ] **Step 4: Create config.py**

`config.py`:
```python
API_BASE    = "https://api.tpbl.basketball/api"
DIVISION_ID = 9
SEASON      = "2025-26"
TOTAL_GAMES = 36
HOME_ADV    = 0.05
MONTE_CARLO_N = 300_000

TEAMS = {
    2: {"name": "高雄全家海神",     "slug": "aquas",    "full_depth": False},
    3: {"name": "福爾摩沙夢想家",   "slug": "formosa",  "full_depth": True},
    4: {"name": "新竹御嵿攻城獅",   "slug": "lions",    "full_depth": True},
    5: {"name": "桃園台啤永豐雲豹", "slug": "leopards", "full_depth": False},
    6: {"name": "新北中信特攻",     "slug": "braves",   "full_depth": False},
    7: {"name": "新北國王",         "slug": "kings",    "full_depth": False},
    8: {"name": "臺北台新戰神",     "slug": "warriors", "full_depth": False},
}

DATA_DIR   = "data"
GAMES_DIR  = "data/games"

ALLTEAM_FILE  = "data/allteam_latest.txt"
ALLGAME_FILE  = "data/allgame_2526.txt"
```

- [ ] **Step 5: Create tests/__init__.py (empty)**

Touch `tests/__init__.py` (empty file).

- [ ] **Step 6: Bootstrap the schedule file**

Copy `allgame_2526.txt` from lioneers-web into `data/`:
```
python -c "
import shutil
shutil.copy(
  r'C:\Users\oneda\OneDrive\02_創作\14_AI TEST\lioneers-web\data\20260402_allgame.txt',
  r'data/allgame_2526.txt'
)
print('copied')
"
```
(Run from `tpbl_lens/` directory.)

- [ ] **Step 7: Run test to confirm pass**

```
python -m pytest tests/test_config.py -v
```
Expected: 6 tests PASS.

- [ ] **Step 8: Commit**

```
git init
git add config.py requirements.txt data/allgame_2526.txt tests/__init__.py tests/test_config.py
git commit -m "feat: project scaffold + config"
```

---

## Task 2: fetch_games.py — API client + game sync

**Files:**
- Create: `fetch_games.py`
- Create: `tests/test_fetch_games.py`

### Steps

- [ ] **Step 1: Write the failing tests**

`tests/test_fetch_games.py`:
```python
import json, os, sys
from unittest.mock import patch
import pytest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# ── helpers ──────────────────────────────────────────────────────────
def _minimal_game_stats(home_id=4, away_id=3, home_score=100, away_score=90):
    return {
        "home_team": {
            "id": home_id, "name": "Team A",
            "teams": {
                "total": {"won_score": home_score, "lost_score": away_score,
                          "field_goals_attempted": 80, "offensive_rebounds": 10,
                          "turnovers": 12, "free_throws_attempted": 20,
                          "free_throws_made": 15, "field_goals_made": 35,
                          "three_pointers_made": 10, "points_in_paint": 30,
                          "fast_break_points": 10, "second_chance_points": 8},
                "rounds": {
                    "1": {"won_score": 28, "lost_score": 22,
                          "field_goals_attempted": 20, "offensive_rebounds": 2,
                          "turnovers": 3, "free_throws_attempted": 5},
                    "2": {"won_score": 25, "lost_score": 23,
                          "field_goals_attempted": 20, "offensive_rebounds": 3,
                          "turnovers": 3, "free_throws_attempted": 4},
                    "3": {"won_score": 26, "lost_score": 24,
                          "field_goals_attempted": 20, "offensive_rebounds": 2,
                          "turnovers": 3, "free_throws_attempted": 5},
                    "4": {"won_score": 21, "lost_score": 21,
                          "field_goals_attempted": 20, "offensive_rebounds": 3,
                          "turnovers": 3, "free_throws_attempted": 6},
                }
            },
            "players": {"total": {
                "1": {"name": "PlayerA", "score": 20, "rebounds": 5, "assists": 3,
                      "steals": 1, "blocks": 0, "turnovers": 2, "plus_minus": 10,
                      "field_goals_percentage": "50.0", "three_pointers_made": 3,
                      "three_pointers_attempted": 6, "free_throws_percentage": "80.0",
                      "efficiency": 18, "tsp": 0.6, "time_on_court": 2400,
                      "field_goals_attempted": 10, "offensive_rebounds": 1,
                      "free_throws_attempted": 5}
            }}
        },
        "away_team": {
            "id": away_id, "name": "Team B",
            "teams": {
                "total": {"won_score": away_score, "lost_score": home_score,
                          "field_goals_attempted": 75, "offensive_rebounds": 8,
                          "turnovers": 14, "free_throws_attempted": 18,
                          "free_throws_made": 12, "field_goals_made": 30,
                          "three_pointers_made": 8, "points_in_paint": 25,
                          "fast_break_points": 8, "second_chance_points": 6},
                "rounds": {
                    "1": {"won_score": 22, "lost_score": 28,
                          "field_goals_attempted": 18, "offensive_rebounds": 2,
                          "turnovers": 3, "free_throws_attempted": 4},
                    "2": {"won_score": 23, "lost_score": 25,
                          "field_goals_attempted": 19, "offensive_rebounds": 2,
                          "turnovers": 4, "free_throws_attempted": 5},
                    "3": {"won_score": 24, "lost_score": 26,
                          "field_goals_attempted": 19, "offensive_rebounds": 2,
                          "turnovers": 3, "free_throws_attempted": 4},
                    "4": {"won_score": 21, "lost_score": 21,
                          "field_goals_attempted": 19, "offensive_rebounds": 2,
                          "turnovers": 4, "free_throws_attempted": 5},
                }
            },
            "players": {"total": {
                "2": {"name": "PlayerB", "score": 18, "rebounds": 7, "assists": 4,
                      "steals": 2, "blocks": 1, "turnovers": 3, "plus_minus": -10,
                      "field_goals_percentage": "45.0", "three_pointers_made": 2,
                      "three_pointers_attempted": 5, "free_throws_percentage": "75.0",
                      "efficiency": 15, "tsp": 0.55, "time_on_court": 2200,
                      "field_goals_attempted": 11, "offensive_rebounds": 2,
                      "free_throws_attempted": 4}
            }}
        }
    }

def _schedule_entry(game_id=9001, game_date="2025-10-26", home_id=4, away_id=3):
    return {"id": game_id, "game_date": game_date,
            "home_team": {"id": home_id}, "away_team": {"id": away_id}}

# ── tests ─────────────────────────────────────────────────────────────
def test_sync_skips_future_games(tmp_path, monkeypatch):
    """Games scheduled after today are not fetched."""
    import fetch_games
    monkeypatch.setattr(fetch_games, "GAMES_DIR", str(tmp_path))
    schedule = [_schedule_entry(game_date="2099-12-31")]
    with patch("fetch_games.api_get") as mock_api:
        count = fetch_games.sync_new_games(schedule)
    assert count == 0
    mock_api.assert_not_called()

def test_sync_skips_already_cached(tmp_path, monkeypatch):
    """Games already on disk are not re-fetched."""
    import fetch_games
    monkeypatch.setattr(fetch_games, "GAMES_DIR", str(tmp_path))
    (tmp_path / "9001.txt").write_text("{}", encoding="utf-8")
    schedule = [_schedule_entry(game_id=9001, game_date="2025-10-26")]
    with patch("fetch_games.api_get") as mock_api:
        count = fetch_games.sync_new_games(schedule)
    assert count == 0
    mock_api.assert_not_called()

def test_sync_downloads_new_game(tmp_path, monkeypatch):
    """A new completed game is fetched, metadata injected, and saved."""
    import fetch_games
    monkeypatch.setattr(fetch_games, "GAMES_DIR", str(tmp_path))
    stats = _minimal_game_stats()
    schedule = [_schedule_entry(game_id=9001, game_date="2025-10-26")]
    with patch("fetch_games.api_get", return_value=stats):
        count = fetch_games.sync_new_games(schedule)
    assert count == 1
    saved = json.loads((tmp_path / "9001.txt").read_text(encoding="utf-8"))
    assert saved["game_id"] == 9001
    assert saved["game_date"] == "2025-10-26"

def test_sync_skips_unknown_team(tmp_path, monkeypatch):
    """Games not involving a known TPBL team are skipped."""
    import fetch_games
    monkeypatch.setattr(fetch_games, "GAMES_DIR", str(tmp_path))
    schedule = [_schedule_entry(home_id=99, away_id=98)]  # unknown teams
    with patch("fetch_games.api_get") as mock_api:
        count = fetch_games.sync_new_games([{
            "id": 9002, "game_date": "2025-10-26",
            "home_team": {"id": 99}, "away_team": {"id": 98}
        }])
    assert count == 0

def test_sync_skips_incomplete_game(tmp_path, monkeypatch):
    """Games with no scores (not yet played) are skipped."""
    import fetch_games
    monkeypatch.setattr(fetch_games, "GAMES_DIR", str(tmp_path))
    stats = _minimal_game_stats(home_score=0, away_score=0)
    stats["home_team"]["teams"]["total"]["won_score"] = None
    stats["home_team"]["teams"]["total"]["lost_score"] = None
    schedule = [_schedule_entry(game_id=9003, game_date="2025-10-26")]
    with patch("fetch_games.api_get", return_value=stats):
        count = fetch_games.sync_new_games(schedule)
    assert count == 0

def test_existing_game_ids(tmp_path, monkeypatch):
    """existing_game_ids() returns set of ints from filenames."""
    import fetch_games
    monkeypatch.setattr(fetch_games, "GAMES_DIR", str(tmp_path))
    (tmp_path / "1234.txt").write_text("{}")
    (tmp_path / "5678.txt").write_text("{}")
    (tmp_path / "not_a_number.txt").write_text("{}")
    ids = fetch_games.existing_game_ids()
    assert ids == {1234, 5678}
```

- [ ] **Step 2: Run test to confirm failure**

```
python -m pytest tests/test_fetch_games.py -v
```
Expected: `ModuleNotFoundError: No module named 'fetch_games'`

- [ ] **Step 3: Create fetch_games.py**

`fetch_games.py`:
```python
import json, os, sys
from datetime import date, datetime
import requests

sys.stdout.reconfigure(encoding="utf-8")

from config import API_BASE, DIVISION_ID, TEAMS, GAMES_DIR, ALLTEAM_FILE, ALLGAME_FILE

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GAMES_DIR = os.path.join(_BASE_DIR, GAMES_DIR)
ALLTEAM_FILE = os.path.join(_BASE_DIR, ALLTEAM_FILE)
ALLGAME_FILE = os.path.join(_BASE_DIR, ALLGAME_FILE)


def api_get(path, timeout=20):
    url = f"{API_BASE}/{path}"
    r = requests.get(url, timeout=timeout)
    r.raise_for_status()
    return r.json()


def load_schedule():
    with open(ALLGAME_FILE, encoding="utf-8") as f:
        return json.load(f)


def existing_game_ids():
    ids = set()
    for fn in os.listdir(GAMES_DIR):
        if fn.endswith(".txt"):
            try:
                ids.add(int(fn.replace(".txt", "")))
            except ValueError:
                pass
    return ids


def sync_new_games(schedule):
    """
    Download stats for all completed games not yet cached locally.
    Returns count of newly downloaded games.
    """
    team_ids = set(TEAMS.keys())
    existing = existing_game_ids()
    today = date.today()
    new_count = 0

    for g in sorted(schedule, key=lambda x: x["game_date"]):
        game_date = datetime.strptime(g["game_date"], "%Y-%m-%d").date()
        if game_date > today:
            continue
        if g["id"] in existing:
            continue
        home_id = g["home_team"]["id"]
        away_id = g["away_team"]["id"]
        if not (home_id in team_ids and away_id in team_ids):
            continue
        try:
            stats = api_get(f"games/{g['id']}/stats")
            if not isinstance(stats, dict):
                continue
            ht_total = stats.get("home_team", {}).get("teams", {}).get("total", {})
            if not ht_total.get("won_score") and not ht_total.get("lost_score"):
                continue
            stats["game_id"] = g["id"]
            stats["game_date"] = g["game_date"]
            out = os.path.join(GAMES_DIR, f"{g['id']}.txt")
            with open(out, "w", encoding="utf-8") as f:
                json.dump(stats, f, ensure_ascii=False, indent=2)
            new_count += 1
        except Exception as e:
            print(f"  [fetch] game {g['id']} failed: {e}")
    return new_count


def update_team_stats():
    """Fetch and overwrite allteam_latest.txt."""
    data = api_get(f"games/stats/teams?division_id={DIVISION_ID}")
    with open(ALLTEAM_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  [fetch] allteam_latest.txt updated")


if __name__ == "__main__":
    schedule = load_schedule()
    n = sync_new_games(schedule)
    print(f"New games fetched: {n}")
    update_team_stats()
```

- [ ] **Step 4: Run tests to confirm pass**

```
python -m pytest tests/test_fetch_games.py -v
```
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```
git add fetch_games.py tests/test_fetch_games.py
git commit -m "feat: add fetch_games API client with sync logic"
```

---

## Task 3: Test fixtures + process_data helpers (pure functions)

**Files:**
- Create: `tests/fixtures/game_sample.json`
- Create: `tests/fixtures/allteam_sample.json`
- Create: `process_data.py` (pure-function helpers only, no CLI yet)

### Steps

- [ ] **Step 1: Create test fixtures**

`tests/fixtures/game_sample.json` — two games, team 4 (lions) plays home vs team 3, then away vs team 2:
```json
[
  {
    "game_id": 9001,
    "game_date": "2025-10-26",
    "home_team": {
      "id": 4, "name": "新竹御嵿攻城獅",
      "teams": {
        "total": {
          "won_score": 95, "lost_score": 88,
          "field_goals_attempted": 80, "offensive_rebounds": 10,
          "turnovers": 12, "free_throws_attempted": 20,
          "free_throws_made": 15, "field_goals_made": 35,
          "three_pointers_made": 10, "points_in_paint": 30,
          "fast_break_points": 10, "second_chance_points": 8
        },
        "rounds": {
          "1": {"won_score": 28, "lost_score": 22, "field_goals_attempted": 20, "offensive_rebounds": 2, "turnovers": 3, "free_throws_attempted": 5},
          "2": {"won_score": 22, "lost_score": 25, "field_goals_attempted": 20, "offensive_rebounds": 3, "turnovers": 3, "free_throws_attempted": 4},
          "3": {"won_score": 24, "lost_score": 20, "field_goals_attempted": 20, "offensive_rebounds": 2, "turnovers": 3, "free_throws_attempted": 5},
          "4": {"won_score": 21, "lost_score": 21, "field_goals_attempted": 20, "offensive_rebounds": 3, "turnovers": 3, "free_throws_attempted": 6}
        }
      },
      "players": {"total": {
        "101": {"name": "林A", "score": 22, "rebounds": 5, "assists": 3,
                "steals": 1, "blocks": 0, "turnovers": 2, "plus_minus": 7,
                "field_goals_percentage": "50.0", "three_pointers_made": 3,
                "three_pointers_attempted": 6, "free_throws_percentage": "80.0",
                "efficiency": 20, "tsp": 0.62, "time_on_court": 2400,
                "field_goals_attempted": 10, "offensive_rebounds": 1,
                "free_throws_attempted": 5},
        "102": {"name": "陳B", "score": 18, "rebounds": 8, "assists": 2,
                "steals": 2, "blocks": 1, "turnovers": 1, "plus_minus": 5,
                "field_goals_percentage": "45.0", "three_pointers_made": 2,
                "three_pointers_attempted": 5, "free_throws_percentage": "75.0",
                "efficiency": 17, "tsp": 0.58, "time_on_court": 2100,
                "field_goals_attempted": 9, "offensive_rebounds": 2,
                "free_throws_attempted": 4}
      }}
    },
    "away_team": {
      "id": 3, "name": "福爾摩沙夢想家",
      "teams": {
        "total": {
          "won_score": 88, "lost_score": 95,
          "field_goals_attempted": 75, "offensive_rebounds": 8,
          "turnovers": 14, "free_throws_attempted": 18,
          "free_throws_made": 12, "field_goals_made": 30,
          "three_pointers_made": 8, "points_in_paint": 25,
          "fast_break_points": 8, "second_chance_points": 6
        },
        "rounds": {
          "1": {"won_score": 22, "lost_score": 28, "field_goals_attempted": 18, "offensive_rebounds": 2, "turnovers": 3, "free_throws_attempted": 4},
          "2": {"won_score": 25, "lost_score": 22, "field_goals_attempted": 19, "offensive_rebounds": 2, "turnovers": 4, "free_throws_attempted": 5},
          "3": {"won_score": 20, "lost_score": 24, "field_goals_attempted": 19, "offensive_rebounds": 2, "turnovers": 3, "free_throws_attempted": 4},
          "4": {"won_score": 21, "lost_score": 21, "field_goals_attempted": 19, "offensive_rebounds": 2, "turnovers": 4, "free_throws_attempted": 5}
        }
      },
      "players": {"total": {
        "201": {"name": "王C", "score": 20, "rebounds": 6, "assists": 5,
                "steals": 2, "blocks": 0, "turnovers": 3, "plus_minus": -7,
                "field_goals_percentage": "48.0", "three_pointers_made": 2,
                "three_pointers_attempted": 6, "free_throws_percentage": "70.0",
                "efficiency": 18, "tsp": 0.59, "time_on_court": 2300,
                "field_goals_attempted": 10, "offensive_rebounds": 1,
                "free_throws_attempted": 4}
      }}
    }
  },
  {
    "game_id": 9002,
    "game_date": "2025-11-02",
    "home_team": {
      "id": 2, "name": "高雄全家海神",
      "teams": {
        "total": {
          "won_score": 102, "lost_score": 90,
          "field_goals_attempted": 78, "offensive_rebounds": 9,
          "turnovers": 11, "free_throws_attempted": 22,
          "free_throws_made": 17, "field_goals_made": 37,
          "three_pointers_made": 11, "points_in_paint": 32,
          "fast_break_points": 12, "second_chance_points": 7
        },
        "rounds": {
          "1": {"won_score": 30, "lost_score": 22, "field_goals_attempted": 20, "offensive_rebounds": 2, "turnovers": 3, "free_throws_attempted": 5},
          "2": {"won_score": 24, "lost_score": 23, "field_goals_attempted": 20, "offensive_rebounds": 2, "turnovers": 3, "free_throws_attempted": 5},
          "3": {"won_score": 26, "lost_score": 22, "field_goals_attempted": 19, "offensive_rebounds": 3, "turnovers": 2, "free_throws_attempted": 6},
          "4": {"won_score": 22, "lost_score": 23, "field_goals_attempted": 19, "offensive_rebounds": 2, "turnovers": 3, "free_throws_attempted": 6}
        }
      },
      "players": {"total": {}}
    },
    "away_team": {
      "id": 4, "name": "新竹御嵿攻城獅",
      "teams": {
        "total": {
          "won_score": 90, "lost_score": 102,
          "field_goals_attempted": 76, "offensive_rebounds": 8,
          "turnovers": 13, "free_throws_attempted": 19,
          "free_throws_made": 14, "field_goals_made": 32,
          "three_pointers_made": 9, "points_in_paint": 28,
          "fast_break_points": 9, "second_chance_points": 5
        },
        "rounds": {
          "1": {"won_score": 22, "lost_score": 30, "field_goals_attempted": 19, "offensive_rebounds": 2, "turnovers": 3, "free_throws_attempted": 4},
          "2": {"won_score": 23, "lost_score": 24, "field_goals_attempted": 19, "offensive_rebounds": 2, "turnovers": 3, "free_throws_attempted": 5},
          "3": {"won_score": 22, "lost_score": 26, "field_goals_attempted": 19, "offensive_rebounds": 2, "turnovers": 4, "free_throws_attempted": 4},
          "4": {"won_score": 23, "lost_score": 22, "field_goals_attempted": 19, "offensive_rebounds": 2, "turnovers": 3, "free_throws_attempted": 6}
        }
      },
      "players": {"total": {
        "101": {"name": "林A", "score": 19, "rebounds": 4, "assists": 2,
                "steals": 0, "blocks": 0, "turnovers": 3, "plus_minus": -12,
                "field_goals_percentage": "44.0", "three_pointers_made": 2,
                "three_pointers_attempted": 7, "free_throws_percentage": "75.0",
                "efficiency": 14, "tsp": 0.55, "time_on_court": 2300,
                "field_goals_attempted": 9, "offensive_rebounds": 1,
                "free_throws_attempted": 4},
        "102": {"name": "陳B", "score": 15, "rebounds": 7, "assists": 1,
                "steals": 1, "blocks": 0, "turnovers": 2, "plus_minus": -5,
                "field_goals_percentage": "40.0", "three_pointers_made": 1,
                "three_pointers_attempted": 4, "free_throws_percentage": "80.0",
                "efficiency": 12, "tsp": 0.52, "time_on_court": 2000,
                "field_goals_attempted": 8, "offensive_rebounds": 1,
                "free_throws_attempted": 3}
      }}
    }
  }
]
```

`tests/fixtures/allteam_sample.json` — 3 teams for league tests:
```json
[
  {
    "team": {"id": 4, "name": "新竹御嵿攻城獅"},
    "game_count": 2,
    "won_game_count": 1,
    "lost_game_count": 1,
    "average_stats": {
      "won_score": 92.5, "lost_score": 95.0,
      "field_goals_attempted": 78.0, "offensive_rebounds": 9.0,
      "turnovers": 12.5, "free_throws_attempted": 19.5,
      "free_throws_made": 14.5, "field_goals_made": 33.5,
      "three_pointers_made": 9.5, "points_in_paint": 29.0
    }
  },
  {
    "team": {"id": 3, "name": "福爾摩沙夢想家"},
    "game_count": 2,
    "won_game_count": 1,
    "lost_game_count": 1,
    "average_stats": {
      "won_score": 96.0, "lost_score": 90.0,
      "field_goals_attempted": 76.0, "offensive_rebounds": 8.5,
      "turnovers": 13.0, "free_throws_attempted": 18.5,
      "free_throws_made": 13.0, "field_goals_made": 32.0,
      "three_pointers_made": 9.0, "points_in_paint": 27.0
    }
  },
  {
    "team": {"id": 2, "name": "高雄全家海神"},
    "game_count": 2,
    "won_game_count": 2,
    "lost_game_count": 0,
    "average_stats": {
      "won_score": 102.0, "lost_score": 89.0,
      "field_goals_attempted": 79.0, "offensive_rebounds": 9.5,
      "turnovers": 11.5, "free_throws_attempted": 22.0,
      "free_throws_made": 17.0, "field_goals_made": 37.0,
      "three_pointers_made": 11.5, "points_in_paint": 32.5
    }
  }
]
```

- [ ] **Step 2: Write tests for process_data helpers**

`tests/test_process_data.py`:
```python
import json, os, sys
import pytest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

def _load_games():
    with open(os.path.join(FIXTURES, "game_sample.json"), encoding="utf-8") as f:
        return json.load(f)

def _load_allteam():
    with open(os.path.join(FIXTURES, "allteam_sample.json"), encoding="utf-8") as f:
        return json.load(f)


class TestParseGames:
    def test_filters_by_team_id(self):
        from process_data import parse_games
        games = parse_games(_load_games(), team_id=4, team_name="新竹御嵿攻城獅")
        assert len(games) == 2  # lions appear in both fixture games

    def test_home_away_flag(self):
        from process_data import parse_games
        games = parse_games(_load_games(), team_id=4, team_name="新竹御嵿攻城獅")
        home_games = [g for g in games if g["is_home"]]
        away_games = [g for g in games if not g["is_home"]]
        assert len(home_games) == 1
        assert len(away_games) == 1

    def test_win_loss_flag(self):
        from process_data import parse_games
        games = parse_games(_load_games(), team_id=4, team_name="新竹御嵿攻城獅")
        wins = [g for g in games if g["won"]]
        losses = [g for g in games if not g["won"]]
        assert len(wins) == 1   # game 9001: 95 > 88
        assert len(losses) == 1  # game 9002: 90 < 102

    def test_game_record_has_required_keys(self):
        from process_data import parse_games
        games = parse_games(_load_games(), team_id=4, team_name="新竹御嵿攻城獅")
        required = {"date", "opp", "team_score", "opp_score", "won",
                    "is_home", "rounds", "opp_rounds",
                    "paint", "fast_break", "second_chance"}
        for g in games:
            assert required.issubset(g.keys()), f"Missing keys in {g}"

    def test_scores_correct(self):
        from process_data import parse_games
        games = sorted(
            parse_games(_load_games(), team_id=4, team_name="新竹御嵿攻城獅"),
            key=lambda g: g["date"]
        )
        assert games[0]["team_score"] == 95
        assert games[0]["opp_score"] == 88
        assert games[1]["team_score"] == 90
        assert games[1]["opp_score"] == 102

    def test_filters_correctly_for_other_team(self):
        from process_data import parse_games
        games = parse_games(_load_games(), team_id=3, team_name="福爾摩沙夢想家")
        assert len(games) == 1  # formosa only in game 9001


class TestCalcVsSummary:
    def test_returns_correct_record(self):
        from process_data import parse_games, calc_vs_summary
        games = parse_games(_load_games(), team_id=4, team_name="新竹御嵿攻城獅")
        vs = calc_vs_summary(games)
        # Lions beat Formosa (game 9001), lost to Aquas (game 9002)
        assert vs["福爾摩沙夢想家"]["w"] == 1
        assert vs["福爾摩沙夢想家"]["l"] == 0
        assert vs["高雄全家海神"]["w"] == 0
        assert vs["高雄全家海神"]["l"] == 1


class TestCalcHomeAway:
    def test_home_win_counted(self):
        from process_data import parse_games, calc_home_away
        games = parse_games(_load_games(), team_id=4, team_name="新竹御嵿攻城獅")
        ha = calc_home_away(games)
        assert ha["home"]["wins"] == 1
        assert ha["home"]["losses"] == 0
        assert ha["away"]["wins"] == 0
        assert ha["away"]["losses"] == 1

    def test_net_score(self):
        from process_data import parse_games, calc_home_away
        games = parse_games(_load_games(), team_id=4, team_name="新竹御嵿攻城獅")
        ha = calc_home_away(games)
        # Home: 95-88 = +7
        assert ha["home"]["net"] == 7.0
        # Away: 90-102 = -12
        assert ha["away"]["net"] == -12.0
```

- [ ] **Step 3: Run tests to confirm failure**

```
python -m pytest tests/test_process_data.py -v
```
Expected: `ModuleNotFoundError: No module named 'process_data'`

- [ ] **Step 4: Create process_data.py with helpers**

`process_data.py` (helpers section — full CLI in Task 4):
```python
"""
TPBL per-team data processor.
Usage: python process_data.py --team-id 3
"""
import json, os, sys, argparse
from collections import defaultdict
import datetime

sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from scipy import stats as sp_stats

from config import TEAMS, TOTAL_GAMES, HOME_ADV, MONTE_CARLO_N, GAMES_DIR, ALLTEAM_FILE

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GAMES_DIR   = os.path.join(_BASE_DIR, GAMES_DIR)
ALLTEAM_FILE = os.path.join(_BASE_DIR, ALLTEAM_FILE)

STAT_KEYS = [
    "score", "rebounds", "assists", "steals", "blocks",
    "turnovers", "plus_minus", "field_goals_percentage",
    "three_pointers_made", "three_pointers_attempted",
    "free_throws_percentage", "efficiency", "tsp", "time_on_court",
]


def _mean(x):
    return round(sum(x) / len(x), 2) if x else 0


def load_game_files(games_dir=None):
    """Return list of parsed dicts from data/games/*.txt."""
    gdir = games_dir or GAMES_DIR
    result = []
    for fn in sorted(os.listdir(gdir)):
        if fn.endswith(".txt"):
            with open(os.path.join(gdir, fn), encoding="utf-8") as f:
                result.append(json.load(f))
    return result


def parse_games(all_game_data, team_id, team_name):
    """
    Filter game data for team_id and return list of game records.

    Each record:
        date, opp, team_score, opp_score, won, is_home,
        rounds, opp_rounds, paint, fast_break, second_chance, ft_made
    """
    games = []
    for d in all_game_data:
        ht = d["home_team"]
        at = d["away_team"]
        if ht["id"] == team_id:
            team, opp_team, is_home = ht, at, True
        elif at["id"] == team_id:
            team, opp_team, is_home = at, ht, False
        else:
            continue

        lt = team["teams"]["total"]
        ot = opp_team["teams"]["total"]
        team_score = lt["won_score"]
        opp_score  = lt["lost_score"]

        rounds_data     = {int(k): v.get("won_score", 0)
                           for k, v in team["teams"]["rounds"].items()}
        opp_rounds_data = {int(k): v.get("won_score", 0)
                           for k, v in opp_team["teams"]["rounds"].items()}

        date_str = d.get("game_date", "")
        if date_str:
            date_str = date_str.replace("-", "")

        games.append({
            "date":          date_str,
            "opp":           opp_team["name"],
            "team_score":    team_score,
            "opp_score":     opp_score,
            "won":           team_score > opp_score,
            "is_home":       is_home,
            "rounds":        rounds_data,
            "opp_rounds":    opp_rounds_data,
            "paint":         lt.get("points_in_paint", 0) or 0,
            "fast_break":    lt.get("fast_break_points", 0) or 0,
            "second_chance": lt.get("second_chance_points", 0) or 0,
            "ft_made":       lt.get("free_throws_made", 0) or 0,
        })
    return games


def calc_vs_summary(games):
    """
    Return dict: {opp_name: {w, l, avg_team, avg_opp}}.
    """
    record = defaultdict(lambda: {"w": 0, "l": 0, "tp": [], "op": []})
    for g in games:
        r = record[g["opp"]]
        if g["won"]:
            r["w"] += 1
        else:
            r["l"] += 1
        r["tp"].append(g["team_score"])
        r["op"].append(g["opp_score"])
    return {
        opp: {
            "w": r["w"], "l": r["l"],
            "avg_team": _mean(r["tp"]), "avg_opp": _mean(r["op"])
        }
        for opp, r in record.items()
    }


def calc_home_away(games):
    """Return {home: {gp,wins,losses,win_rate,avg_pts,avg_opp,net},
                away: {...}}."""
    def _split(gl):
        if not gl:
            return {}
        pts  = [g["team_score"] for g in gl]
        opts = [g["opp_score"]  for g in gl]
        wins = sum(g["won"] for g in gl)
        return {
            "gp":       len(gl),
            "wins":     wins,
            "losses":   len(gl) - wins,
            "win_rate": round(wins / len(gl), 4),
            "avg_pts":  _mean(pts),
            "avg_opp":  _mean(opts),
            "net":      round(_mean(pts) - _mean(opts), 1),
        }
    return {
        "home": _split([g for g in games if g["is_home"]]),
        "away": _split([g for g in games if not g["is_home"]]),
    }


def collect_player_stats(all_game_data, team_id):
    """
    Return (player_vs_opp_pm, player_vs_opp_ppp, player_stats).
    Only used for full_depth teams.
    """
    pm_map  = defaultdict(lambda: defaultdict(list))   # name → opp → [pm]
    ppp_map = defaultdict(lambda: defaultdict(list))   # name → opp → [ppp]
    stats   = defaultdict(lambda: defaultdict(list))   # name → stat → [vals]

    for d in all_game_data:
        ht = d["home_team"]
        at = d["away_team"]
        if ht["id"] == team_id:
            team, opp_team = ht, at
        elif at["id"] == team_id:
            team, opp_team = at, ht
        else:
            continue

        opp_name  = opp_team["name"]
        team_poss = sum(
            float(p.get("field_goals_attempted") or 0)
            + 0.44 * float(p.get("free_throws_attempted") or 0)
            + float(p.get("turnovers") or 0)
            for p in team["players"]["total"].values()
        )

        for p in team["players"]["total"].values():
            pname = p["name"]
            pm    = p.get("plus_minus") or 0
            pm_map[pname][opp_name].append(pm)

            pts  = float(p.get("score") or 0)
            fga  = float(p.get("field_goals_attempted") or 0)
            oreb = float(p.get("offensive_rebounds") or 0)
            to_  = float(p.get("turnovers") or 0)
            fta  = float(p.get("free_throws_attempted") or 0)
            poss = fga - oreb + to_ + 0.44 * fta
            if poss > 0:
                ppp_map[pname][opp_name].append(round(pts / poss, 3))

            if team_poss > 0:
                usg = round((fga + 0.44 * fta + to_) / team_poss * 100, 1)
                stats[pname]["usg"].append(usg)

            for sk in STAT_KEYS:
                v = p.get(sk)
                if v is not None:
                    stats[pname][sk].append(float(v))

    return pm_map, ppp_map, stats


def build_heatmap(pm_map, teams_order):
    """Plus/minus heatmap: sorted by descending mean PM."""
    key_players = [
        p for p, od in pm_map.items()
        if sum(len(v) for v in od.values()) >= 3
    ]
    key_players.sort(
        key=lambda p: -_mean([x for vs in pm_map[p].values() for x in vs])
    )
    result = []
    for pname in key_players:
        row = {"player": pname, "values": {}}
        for opp in teams_order:
            vals = pm_map[pname].get(opp, [])
            row["values"][opp] = _mean(vals) if vals else None
        result.append(row)
    return result


def _ppp_score(v):
    if v >= 1.3: return 3
    if v >= 1.15: return 2
    if v >= 1.0: return 1
    if v >= 0.9: return -1
    if v >= 0.8: return -2
    return -3


def build_ppp_heatmap(ppp_map, teams_order):
    """PPP heatmap: sorted by games played then score."""
    key_players = [
        p for p, od in ppp_map.items()
        if sum(len(v) for v in od.values()) >= 3
    ]
    key_players.sort(key=lambda p: (
        -sum(1 for vs in ppp_map[p].values() for _ in vs),
        -sum(_ppp_score(v) for vs in ppp_map[p].values() for v in vs),
    ))
    result = []
    for pname in key_players:
        row = {"player": pname, "values": {}}
        for opp in teams_order:
            vals = ppp_map[pname].get(opp, [])
            row["values"][opp] = round(_mean(vals), 3) if vals else None
        result.append(row)
    return result


def calc_player_season_avg(player_stats_map):
    """Player season averages for players with >= 3 games."""
    important = [
        "score", "rebounds", "assists", "steals", "blocks",
        "turnovers", "plus_minus", "efficiency", "tsp", "usg",
        "three_pointers_made", "three_pointers_attempted",
    ]
    result = {}
    for pname, stats in player_stats_map.items():
        n = len(stats.get("score", []))
        if n >= 3:
            result[pname] = {
                sk: _mean(stats[sk]) for sk in important if stats.get(sk)
            }
            result[pname]["games"] = n
    return result


def calc_quarter_analysis(games, all_game_data, team_id):
    """Quarter scores and possession data per quarter."""
    def calc_poss(t):
        return round(
            t.get("field_goals_attempted", 0)
            - t.get("offensive_rebounds", 0)
            + t.get("turnovers", 0)
            + 0.44 * t.get("free_throws_attempted", 0), 1
        )

    q_poss = {q: {"team": [], "opp": []} for q in range(1, 5)}

    for d in all_game_data:
        ht, at = d["home_team"], d["away_team"]
        if ht["id"] == team_id:
            team, opp_team = ht, at
        elif at["id"] == team_id:
            team, opp_team = at, ht
        else:
            continue
        for q in range(1, 5):
            tr = team["teams"]["rounds"].get(str(q), {})
            or_ = opp_team["teams"]["rounds"].get(str(q), {})
            if tr and or_:
                q_poss[q]["team"].append(calc_poss(tr))
                q_poss[q]["opp"].append(calc_poss(or_))

    result = {}
    for q in range(1, 5):
        q_team = [g["rounds"].get(q, 0) for g in games if q in g["rounds"]]
        q_opp  = [g["opp_rounds"].get(q, 0) for g in games if q in g["opp_rounds"]]
        pairs  = [(t, o) for t, o in zip(q_team, q_opp)]
        q_wr   = round(sum(1 for t, o in pairs if t > o) / len(pairs), 4) if pairs else 0
        result[f"Q{q}"] = {
            "avg_score":    _mean(q_team),
            "avg_opp":      _mean(q_opp),
            "win_rate":     q_wr,
            "games":        len(pairs),
            "diffs":        [round(t - o, 1) for t, o in pairs],
            "avg_poss":     _mean(q_poss[q]["team"]),
            "avg_opp_poss": _mean(q_poss[q]["opp"]),
        }
    return result


def calc_game_team_stats(all_game_data, team_id):
    """Per-game team-level stats used for ROC + Mann-Whitney + scenario."""
    def calc_poss(t):
        return round(
            t.get("field_goals_attempted", 0)
            - t.get("offensive_rebounds", 0)
            + t.get("turnovers", 0)
            + 0.44 * t.get("free_throws_attempted", 0), 1
        )

    result = []
    for d in all_game_data:
        ht, at = d["home_team"], d["away_team"]
        if ht["id"] == team_id:
            team, opp_team = ht, at
        elif at["id"] == team_id:
            team, opp_team = at, ht
        else:
            continue

        lt = team["teams"]["total"]
        ot = opp_team["teams"]["total"]
        team_score = lt["won_score"]
        opp_score  = lt["lost_score"]

        three_att = lt.get("three_pointers_attempted", 0) or 0
        three_pct = (lt.get("three_pointers_made", 0) / three_att * 100
                     if three_att else 0)
        fg_att = lt.get("field_goals_attempted", 0) or 0
        fg_pct = (lt.get("field_goals_made", 0) / fg_att * 100
                  if fg_att else 0)

        result.append({
            "won":        int(team_score > opp_score),
            "三分命中率": round(three_pct, 1),
            "三分命中數": lt.get("three_pointers_made", 0),
            "整體命中率": round(fg_pct, 1),
            "助攻":       lt.get("assists", 0),
            "失誤數":     lt.get("turnovers", 0),
            "籃板":       lt.get("rebounds", 0),
            "抄截":       lt.get("steals", 0),
            "阻攻":       lt.get("blocks", 0),
            "禁區得分":   lt.get("points_in_paint", 0) or 0,
            "快攻得分":   lt.get("fast_break_points", 0) or 0,
            "lion_poss":  calc_poss(lt),
            "opp_poss":   calc_poss(ot),
        })
    return result


def calc_roc_analysis(game_team_stats):
    """ROC curves + AUC for win-predicting indicators."""
    if len(game_team_stats) < 4:
        return {}

    def _calc_roc(scores, labels, higher_is_better=True):
        if not higher_is_better:
            scores = -scores
        uniq = np.sort(np.unique(scores))
        thresholds = np.sort(np.unique(
            np.concatenate([uniq - 0.001, uniq + 0.001])
        ))[::-1]
        P = labels.sum()
        N_neg = (labels == 0).sum()
        pts = []
        for th in thresholds:
            pred = (scores >= th).astype(int)
            tp = int(((pred == 1) & (labels == 1)).sum())
            fp = int(((pred == 1) & (labels == 0)).sum())
            tpr = tp / P if P else 0
            fpr = fp / N_neg if N_neg else 0
            pts.append((fpr, tpr, float(th if higher_is_better else -th)))
        pts.sort(key=lambda x: x[0])
        dedup = {}
        for fpr, tpr, th in pts:
            key = round(fpr, 4)
            if key not in dedup or tpr > dedup[key][1]:
                dedup[key] = (fpr, tpr, th)
        pts = sorted(dedup.values(), key=lambda x: x[0])
        auc = sum(
            (pts[i+1][0] - pts[i][0]) * (pts[i+1][1] + pts[i][1]) / 2
            for i in range(len(pts) - 1)
        )
        best = max(pts, key=lambda x: x[1] - x[0])
        curve = [{"fpr": round(p[0], 4), "tpr": round(p[1], 4)} for p in pts]
        return curve, round(auc, 4), {
            "fpr": round(best[0], 4), "tpr": round(best[1], 4),
            "threshold": best[2]
        }

    labels = np.array([s["won"] for s in game_team_stats])
    predictors = [
        ("三分命中率", True), ("整體命中率", True), ("阻攻", True),
        ("助攻",       True), ("失誤數",     False), ("三分命中數", True),
    ]
    result = {}
    for key, higher in predictors:
        scores = np.array([s[key] for s in game_team_stats], dtype=float)
        curve, auc_val, best_pt = _calc_roc(scores, labels, higher)
        result[key] = {"curve": curve, "auc": auc_val, "best": best_pt,
                       "threshold": best_pt["threshold"]}
    return result


def calc_mann_whitney(game_team_stats):
    """Mann-Whitney U test: win vs loss differences per indicator."""
    if len(game_team_stats) < 4:
        return []
    won_mask = np.array([s["won"] for s in game_team_stats], dtype=bool)
    stat_keys = [
        "三分命中率", "三分命中數", "整體命中率", "失誤數",
        "助攻", "籃板", "抄截", "阻攻", "禁區得分", "快攻得分",
    ]
    result = []
    for sk in stat_keys:
        values = np.array([s[sk] for s in game_team_stats], dtype=float)
        w_vals = values[won_mask]
        l_vals = values[~won_mask]
        if len(w_vals) < 2 or len(l_vals) < 2:
            continue
        u_stat, p_val = sp_stats.mannwhitneyu(w_vals, l_vals, alternative="two-sided")
        n1, n2 = len(w_vals), len(l_vals)
        r = float(1 - 2 * u_stat / (n1 * n2))
        result.append({
            "stat":          sk,
            "p_value":       round(float(p_val), 4),
            "effect_r":      round(r, 3),
            "significant":   bool(p_val < 0.05),
            "wins_median":   round(float(np.median(w_vals)), 1),
            "losses_median": round(float(np.median(l_vals)), 1),
            "wins_mean":     round(float(w_vals.mean()), 1),
            "losses_mean":   round(float(l_vals.mean()), 1),
            "wins":          [round(float(v), 1) for v in w_vals],
            "losses":        [round(float(v), 1) for v in l_vals],
        })
    return result


def calc_scenario_chart(game_team_stats, games):
    """Four-scenario scoring prediction based on composite performance."""
    if len(game_team_stats) < 4:
        return [], {}

    feat = np.array([
        [s["三分命中率"], s["失誤數"], s["助攻"], s["整體命中率"]]
        for s in game_team_stats
    ], dtype=float)
    team_sc = np.array([g["team_score"] for g in games], dtype=float)
    opp_sc  = np.array([g["opp_score"]  for g in games], dtype=float)
    won_arr = np.array([g["won"]         for g in games])

    mu  = feat.mean(axis=0)
    std = feat.std(axis=0)
    std[std < 1e-9] = 1e-9
    z = (feat - mu) / std
    z[:, 1] *= -1  # TO inverted
    composite = z.mean(axis=1)

    q25, q50, q75 = np.percentile(composite, [25, 50, 75])
    defs = [
        ("Best",  composite >= q75),
        ("Ideal", (composite >= q50) & (composite < q75)),
        ("Fair",  (composite >= q25) & (composite < q50)),
        ("Low",   composite < q25),
    ]
    results = []
    for label, mask in defs:
        n = int(mask.sum())
        ls, os_ = team_sc[mask], opp_sc[mask]
        wr = float(won_arr[mask].mean()) if n > 0 else 0
        grp = feat[mask]
        results.append({
            "label":     label, "n": n,
            "win_rate":  round(wr, 3),
            "lion_mean": round(float(ls.mean()), 1) if n else 0,
            "lion_std":  round(float(ls.std()),  1) if n else 0,
            "opp_mean":  round(float(os_.mean()), 1) if n else 0,
            "opp_std":   round(float(os_.std()),  1) if n else 0,
            "stats": {
                "3P%": round(float(grp[:, 0].mean()), 1) if n else 0,
                "TO":  round(float(grp[:, 1].mean()), 1) if n else 0,
                "AST": round(float(grp[:, 2].mean()), 1) if n else 0,
                "FG%": round(float(grp[:, 3].mean()), 1) if n else 0,
            },
        })

    # Last-game hint
    last_comp = float(composite[-1])
    if   last_comp >= q75: last_label = "Best"
    elif last_comp >= q50: last_label = "Ideal"
    elif last_comp >= q25: last_label = "Fair"
    else:                  last_label = "Low"
    pred = next(r for r in results if r["label"] == last_label)
    last_g = games[-1]
    last_s = game_team_stats[-1]
    last_hint = {
        "date":       last_g["date"],
        "opp":        last_g["opp"],
        "is_home":    last_g["is_home"],
        "won":        bool(last_g["won"]),
        "team_score": last_g["team_score"],
        "opp_score":  last_g["opp_score"],
        "scenario":   last_label,
        "team_pred":  pred["lion_mean"],
        "opp_pred":   pred["opp_mean"],
        "team_diff":  round(last_g["team_score"] - pred["lion_mean"], 1),
        "opp_diff":   round(last_g["opp_score"]  - pred["opp_mean"],  1),
        "actual_stats": {
            "3P%": last_s["三分命中率"],
            "TO":  last_s["失誤數"],
            "AST": last_s["助攻"],
            "FG%": last_s["整體命中率"],
        },
        "pred_stats": pred["stats"],
    }
    return results, last_hint


def calc_simulation(standings_raw, team_name):
    """
    TPBL Monte Carlo simulation (300k runs).
    Returns prob dict for the given team.
    """
    np.random.seed(42)
    N = MONTE_CARLO_N

    team_list  = [t["name"]  for t in standings_raw]
    wins_now   = np.array([t["wins"]  for t in standings_raw], dtype=np.float64)
    games_left = np.array([TOTAL_GAMES - t["gp"] for t in standings_raw], dtype=np.int32)
    wr_arr     = np.array(
        [t["wins"] / t["gp"] if t["gp"] > 0 else 0.5 for t in standings_raw],
        dtype=np.float64,
    )
    rng = np.random.default_rng(42)

    if team_name not in team_list:
        return {}

    team_idx = team_list.index(team_name)

    extra = np.column_stack([
        np.random.binomial(int(gl), float(wr), size=N)
        for gl, wr in zip(games_left, wr_arr)
    ]).astype(np.float64)
    final_wins = wins_now[None, :] + extra  # (N, n_teams)

    def win_prob(wr_a, wr_b, home_a=True):
        base = wr_a / (wr_a + wr_b + 1e-9)
        adj  = base + HOME_ADV if home_a else base - HOME_ADV
        return float(np.clip(adj, 0.05, 0.95))

    def sim_game(ta, tb, home_a=True):
        p = win_prob(wr_arr[team_list.index(ta)],
                     wr_arr[team_list.index(tb)], home_a)
        return rng.random() < p

    def sim_play_in(t4, t5):
        if sim_game(t4, t5, home_a=False): return t4  # g1 at t5 home
        if sim_game(t4, t5, home_a=True):  return t4  # g2 at t4 home
        return t5

    def sim_bo5(th, tl):
        home_seq = [True, True, False, False, True]
        wh = wl = 0
        for home in home_seq:
            if wh == 3 or wl == 3: break
            if sim_game(th, tl, home): wh += 1
            else:                      wl += 1
        return th if wh >= 3 else tl

    def sim_bo7(th, tl):
        home_seq = [True, True, False, False, True, False, True]
        wh = wl = 0
        for home in home_seq:
            if wh == 4 or wl == 4: break
            if sim_game(th, tl, home): wh += 1
            else:                      wl += 1
        return th if wh >= 4 else tl

    c_play_in = c_playoff = c_semi = c_final = c_champ = 0

    for i in range(N):
        fw   = final_wins[i]
        rank = sorted(team_list, key=lambda x: -fw[team_list.index(x)])
        team_r = rank.index(team_name) + 1

        if team_r >= 6:
            continue

        if team_r in (4, 5):
            c_play_in += 1
            winner = sim_play_in(rank[3], rank[4])
            if winner != team_name:
                continue
            c_playoff += 1
        else:
            c_playoff += 1

        challenger = sim_play_in(rank[3], rank[4])

        t1, t2, t3 = rank[0], rank[1], rank[2]
        if team_r == 1:
            sfa = sim_bo5(team_name, challenger)
            sfb = sim_bo5(t2, t3)
        elif team_r == 2:
            sfa = sim_bo5(t1, challenger)
            sfb = sim_bo5(team_name, t3)
        elif team_r == 3:
            sfa = sim_bo5(t1, challenger)
            sfb = sim_bo5(t2, team_name)
        else:
            sfa = sim_bo5(t1, team_name)
            sfb = sim_bo5(t2, t3)

        c_semi += 1
        if team_name not in (sfa, sfb):
            continue

        opp_f = sfb if team_name == sfa else sfa
        lv = fw[team_idx]
        ov = fw[team_list.index(opp_f)]
        th = team_name if lv >= ov else opp_f
        tl = opp_f if th == team_name else team_name
        champ = sim_bo7(th, tl)
        c_final += 1
        if champ == team_name:
            c_champ += 1

    return {
        "prob_play_in": round(c_play_in  / N, 4),
        "prob_playoff": round(c_playoff  / N, 4),
        "prob_semif":   round(c_semi     / N, 4),
        "prob_final":   round(c_final    / N, 4),
        "prob_champ":   round(c_champ    / N, 4),
        "n_simulations": N,
        "rules": {
            "regular_season": "36場（18主18客），前3直接進季後賽",
            "play_in":        "第4 vs 第5，Bo3，第4先獲1勝",
            "semifinal":      "Bo5（5戰3勝），主場分配 2-2-1",
            "championship":   "Bo7（7戰4勝），主場分配 2-2-1-1-1",
        },
    }
```

*(Add the CLI + `process_team()` entry point in Task 4.)*

- [ ] **Step 5: Run tests to confirm pass**

```
python -m pytest tests/test_process_data.py -v
```
Expected: 9 tests PASS.

- [ ] **Step 6: Commit**

```
git add tests/fixtures/ process_data.py tests/test_process_data.py
git commit -m "feat: process_data helpers with TDD fixtures"
```

---

## Task 4: process_data.py — CLI entry point + process_team()

**Files:**
- Modify: `process_data.py` (add CLI + `process_team` + `main`)

### Steps

- [ ] **Step 1: Add process_team() and main() to process_data.py**

Append to the bottom of `process_data.py`:
```python
def load_allteam(allteam_file=None):
    path = allteam_file or ALLTEAM_FILE
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def calc_standings(allteam_data):
    raw = [
        {"name": t["team"]["name"],
         "wins": t["won_game_count"],
         "losses": t["lost_game_count"],
         "gp": t["game_count"]}
        for t in allteam_data
    ]
    return sorted(raw, key=lambda x: -(x["wins"] / x["gp"] if x["gp"] > 0 else 0))


def calc_next_game(allgame_data, team_id, standings_raw, team_wr):
    """Return next_game dict from schedule; empty dict if season over."""
    import datetime as dt_mod
    today = dt_mod.date.today()

    upcoming = sorted(
        [g for g in allgame_data
         if (g["home_team"]["id"] == team_id or g["away_team"]["id"] == team_id)
         and dt_mod.datetime.strptime(g["game_date"], "%Y-%m-%d").date() >= today
         and not g.get("_played", False)],
        key=lambda x: x["game_date"]
    )
    if not upcoming:
        return {}

    g = upcoming[0]
    is_home  = g["home_team"]["id"] == team_id
    opp_team = g["away_team"] if is_home else g["home_team"]
    opp_name = opp_team["name"]

    opp_row  = next((t for t in standings_raw if t["name"] == opp_name), None)
    opp_wr   = (opp_row["wins"] / opp_row["gp"]
                if opp_row and opp_row["gp"] > 0 else 0.5)
    base     = team_wr / (team_wr + opp_wr + 1e-9)
    prob_adj = float(np.clip(base + (HOME_ADV if is_home else -HOME_ADV), 0.05, 0.95))

    weekdays_cn = ["一", "二", "三", "四", "五", "六", "日"]
    dt = dt_mod.datetime.strptime(g["game_date"], "%Y-%m-%d")
    ha = "主場" if is_home else "客場"
    date_label = f"{dt.month}/{dt.day}（{weekdays_cn[dt.weekday()]}）{ha}"

    return {
        "opponent":       opp_name,
        "date":           date_label,
        "is_home":        is_home,
        "win_prob_model": round(base, 4),
        "win_prob_adjusted": round(prob_adj, 4),
    }


def process_team(team_id, games_dir=None, allteam_file=None, allgame_file=None):
    """
    Full pipeline for one team.
    Returns the output dict (also writes data/{slug}_2526.json).
    """
    from config import TEAMS, SEASON, TOTAL_GAMES, ALLGAME_FILE
    import os as _os

    cfg      = TEAMS[team_id]
    slug     = cfg["slug"]
    name     = cfg["name"]
    is_full  = cfg["full_depth"]

    all_game_data = load_game_files(games_dir)
    allteam_data  = load_allteam(allteam_file)

    allgame_path = allgame_file or _os.path.join(_BASE_DIR, ALLGAME_FILE)
    with open(allgame_path, encoding="utf-8") as f:
        allgame_data = json.load(f)

    games          = parse_games(all_game_data, team_id, name)
    vs_summary     = calc_vs_summary(games)
    home_away      = calc_home_away(games)
    standings_raw  = calc_standings(allteam_data)
    quarter        = calc_quarter_analysis(games, all_game_data, team_id)

    # team_stats from allteam (authoritative)
    team_row   = next((t for t in standings_raw if t["name"] == name), None)
    total_wins   = team_row["wins"]   if team_row else sum(g["won"] for g in games)
    total_losses = team_row["losses"] if team_row else sum(not g["won"] for g in games)
    total_gp     = team_row["gp"]     if team_row else len(games)
    games_rem    = TOTAL_GAMES - total_gp
    win_rate     = total_wins / total_gp if total_gp > 0 else 0.5

    # League-wide rtg (needed for standings display)
    from generate_league import calc_league_rtg, calc_scoring_sources
    league_rtg      = calc_league_rtg(allteam_data)
    scoring_sources = calc_scoring_sources(allteam_data)

    # Next game
    next_game = calc_next_game(allgame_data, team_id, standings_raw, win_rate)

    output = {
        "meta": {
            "team_id":        team_id,
            "team_name":      name,
            "season":         SEASON,
            "generated":      datetime.date.today().isoformat(),
            "total_games":    total_gp,
            "games_remaining": games_rem,
        },
        "team_stats": {
            "wins":           total_wins,
            "losses":         total_losses,
            "games_played":   total_gp,
            "games_remaining": games_rem,
            "avg_pts":        _mean([g["team_score"] for g in games]),
            "avg_opp_pts":    _mean([g["opp_score"]  for g in games]),
            "win_rate":       round(win_rate, 4),
        },
        "standings":       standings_raw,
        "league_rtg":      league_rtg,
        "scoring_sources": scoring_sources,
        "games":           games,
        "vs_summary":      vs_summary,
        "home_away":       home_away,
        "quarter_analysis": quarter,
        "next_game":       next_game,
        # full-depth fields (populated below if applicable)
        "heatmap":        [],
        "ppp_heatmap":    [],
        "player_avg":     {},
        "simulation":     {},
        "roc":            {},
        "mann_whitney":   [],
        "scenario_chart": [],
        "last_game_hint": {},
        "playoff_series": {},
    }

    if is_full and len(games) >= 4:
        teams_order = [t["name"] for t in allteam_data if t["team"]["id"] != team_id]
        pm_map, ppp_map, ps_map = collect_player_stats(all_game_data, team_id)
        output["heatmap"]     = build_heatmap(pm_map, teams_order)
        output["ppp_heatmap"] = build_ppp_heatmap(ppp_map, teams_order)
        output["player_avg"]  = calc_player_season_avg(ps_map)
        output["simulation"]  = calc_simulation(standings_raw, name)

        gts = calc_game_team_stats(all_game_data, team_id)
        output["roc"]          = calc_roc_analysis(gts)
        output["mann_whitney"] = calc_mann_whitney(gts)
        sc, hint               = calc_scenario_chart(gts, games)
        output["scenario_chart"] = sc
        output["last_game_hint"] = hint

    out_dir  = _os.path.join(_BASE_DIR, "data")
    out_path = _os.path.join(out_dir, f"{slug}_2526.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f">>> {slug}_2526.json written ({total_wins}W{total_losses}L)")
    return output


def main():
    parser = argparse.ArgumentParser(description="Process TPBL team data")
    parser.add_argument("--team-id", type=int, required=True,
                        choices=list(TEAMS.keys()),
                        help="Team ID (2-8)")
    args = parser.parse_args()
    process_team(args.team_id)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Create generate_league.py stubs (needed for imports in process_team)**

*(Create the minimal version now; full implementation in Task 5.)*

`generate_league.py`:
```python
"""League-wide JSON generator."""
import json, os, sys, datetime
sys.stdout.reconfigure(encoding="utf-8")
from config import ALLTEAM_FILE, SEASON

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALLTEAM_FILE = os.path.join(_BASE_DIR, ALLTEAM_FILE)


def calc_league_rtg(allteam_data):
    result = []
    for t in allteam_data:
        avg  = t["average_stats"]
        fga  = avg.get("field_goals_attempted", 0) or 0
        oreb = avg.get("offensive_rebounds",    0) or 0
        to_v = avg.get("turnovers",             0) or 0
        fta  = avg.get("free_throws_attempted", 0) or 0
        poss = fga - oreb + to_v + 0.44 * fta
        pts  = avg.get("won_score",  0) or 0
        opp  = avg.get("lost_score", 0) or 0
        ortg   = round(pts / poss * 100, 1) if poss > 0 else 0.0
        drtg   = round(opp / poss * 100, 1) if poss > 0 else 0.0
        netrtg = round(ortg - drtg, 1)
        result.append({
            "name":   t["team"]["name"],
            "wins":   t["won_game_count"],
            "losses": t["lost_game_count"],
            "gp":     t["game_count"],
            "ortg":   ortg, "drtg": drtg, "netrtg": netrtg,
        })
    result.sort(key=lambda x: -x["netrtg"])
    return result


def calc_scoring_sources(allteam_data):
    result = []
    for t in allteam_data:
        avg      = t["average_stats"]
        three_pm = avg.get("three_pointers_made", 0) or 0
        fgm      = avg.get("field_goals_made",    0) or 0
        ftm      = avg.get("free_throws_made",    0) or 0
        paint    = avg.get("points_in_paint",     0) or 0
        pts_3    = round(three_pm * 3, 1)
        pts_2    = round((fgm - three_pm) * 2, 1)
        pts_mid  = round(max(0, pts_2 - paint), 1)
        total    = round(avg.get("won_score", 0) or 0, 1)
        result.append({
            "name":  t["team"]["name"],
            "three": pts_3,  "mid": pts_mid,
            "paint": round(paint, 1), "ft": round(ftm, 1),
            "total": total,
        })
    result.sort(key=lambda x: -x["total"])
    return result


def build_league_json(allteam_data):
    return {
        "meta": {"season": SEASON, "generated": datetime.date.today().isoformat()},
        "standings":      _calc_standings(allteam_data),
        "league_rtg":     calc_league_rtg(allteam_data),
        "scoring_sources": calc_scoring_sources(allteam_data),
        "style_clusters": [],    # Phase 3
        "matchup_matrix": {},    # Phase 3
        "pace_trend":     [],    # Phase 3
    }


def _calc_standings(allteam_data):
    raw = [
        {"name": t["team"]["name"],
         "wins": t["won_game_count"],
         "losses": t["lost_game_count"],
         "gp": t["game_count"]}
        for t in allteam_data
    ]
    return sorted(raw, key=lambda x: -(x["wins"] / x["gp"] if x["gp"] > 0 else 0))


def main():
    with open(ALLTEAM_FILE, encoding="utf-8") as f:
        allteam = json.load(f)
    out = build_league_json(allteam)
    out_path = os.path.join(_BASE_DIR, "data", "league_2526.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(">>> league_2526.json written")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Run process_data for team 4 (smoke test)**

First copy the existing lioneers-web game files into `data/games/` using the allgame mapping.
```
python -c "
import sys, json, os, shutil
sys.stdout.reconfigure(encoding='utf-8')
# Load allgame to build date -> game_id map
with open('data/allgame_2526.txt', encoding='utf-8') as f:
    schedule = json.load(f)
date_to_game = {}
for g in schedule:
    date_key = g['game_date'].replace('-', '')
    date_to_game[date_key] = g['id']

src = r'C:\Users\oneda\OneDrive\02_創作\14_AI TEST\lioneers-web\data'
dst = 'data/games'
count = 0
for fn in os.listdir(src):
    if not fn.endswith('.txt'): continue
    date_key = fn.replace('.txt', '')
    if len(date_key) == 4: date_key = '2026' + date_key
    if date_key not in date_to_game: continue
    game_id = date_to_game[date_key]
    with open(os.path.join(src, fn), encoding='utf-8') as f:
        data = json.load(f)
    data['game_id'] = game_id
    data['game_date'] = date_key[:4] + '-' + date_key[4:6] + '-' + date_key[6:]
    out = os.path.join(dst, f'{game_id}.txt')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    count += 1
    print(f'  {fn} → {game_id}.txt')
print(f'Migrated {count} game files.')
"
```

Also copy allteam:
```
python -c "
import shutil
shutil.copy(
  r'C:\Users\oneda\OneDrive\02_創作\14_AI TEST\lioneers-web\data\allteam_latest.txt',
  'data/allteam_latest.txt'
)
print('allteam copied')
"
```

Then run:
```
python process_data.py --team-id 4
```
Expected: `>>> lions_2526.json written (22W14L)` (or current season record)

- [ ] **Step 4: Verify JSON structure**

```python
python -c "
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
with open('data/lions_2526.json', encoding='utf-8') as f:
    d = json.load(f)
print('keys:', list(d.keys()))
print('team_stats:', d['team_stats'])
print('standings count:', len(d['standings']))
print('games count:', len(d['games']))
print('heatmap players:', len(d['heatmap']))
"
```
Expected: all keys present, games count ~36, heatmap has players.

- [ ] **Step 5: Commit**

```
git add process_data.py generate_league.py data/allteam_latest.txt data/games/
git commit -m "feat: process_data CLI + process_team() + migrate game files"
```

---

## Task 5: generate_league.py — tests + league JSON output

**Files:**
- Create: `tests/test_generate_league.py`
- (generate_league.py already created in Task 4)

### Steps

- [ ] **Step 1: Write failing tests**

`tests/test_generate_league.py`:
```python
import json, os, sys
import pytest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

def _load_allteam():
    with open(os.path.join(FIXTURES, "allteam_sample.json"), encoding="utf-8") as f:
        return json.load(f)


def test_calc_league_rtg_sorted_by_netrtg():
    from generate_league import calc_league_rtg
    result = calc_league_rtg(_load_allteam())
    netrtgs = [r["netrtg"] for r in result]
    assert netrtgs == sorted(netrtgs, reverse=True)


def test_calc_league_rtg_all_teams_present():
    from generate_league import calc_league_rtg
    result = calc_league_rtg(_load_allteam())
    names = {r["name"] for r in result}
    assert "新竹御嵿攻城獅" in names
    assert "福爾摩沙夢想家" in names
    assert "高雄全家海神" in names


def test_calc_league_rtg_values():
    """Verify rtg calculation: lions avg 92.5 pts, poss ≈ 80-10+12.5+0.44*19.5"""
    from generate_league import calc_league_rtg
    allteam = _load_allteam()
    result = calc_league_rtg(allteam)
    lions = next(r for r in result if r["name"] == "新竹御嵿攻城獅")
    # poss = 78 - 9 + 12.5 + 0.44*19.5 = 90.08
    # ortg = 92.5 / 90.08 * 100 ≈ 102.7
    assert 95 < lions["ortg"] < 115
    assert lions["netrtg"] == round(lions["ortg"] - lions["drtg"], 1)


def test_calc_scoring_sources_sorted_by_total():
    from generate_league import calc_scoring_sources
    result = calc_scoring_sources(_load_allteam())
    totals = [r["total"] for r in result]
    assert totals == sorted(totals, reverse=True)


def test_calc_scoring_sources_fields():
    from generate_league import calc_scoring_sources
    result = calc_scoring_sources(_load_allteam())
    for r in result:
        assert {"name", "three", "mid", "paint", "ft", "total"}.issubset(r.keys())


def test_build_league_json_structure():
    from generate_league import build_league_json
    out = build_league_json(_load_allteam())
    assert set(out.keys()) >= {"meta", "standings", "league_rtg",
                                "scoring_sources", "style_clusters",
                                "matchup_matrix", "pace_trend"}
    assert out["style_clusters"] == []   # Phase 3 placeholder
    assert out["meta"]["season"] == "2025-26"


def test_standings_sorted_by_win_rate():
    from generate_league import build_league_json
    out = build_league_json(_load_allteam())
    wrs = [
        t["wins"] / t["gp"] if t["gp"] > 0 else 0
        for t in out["standings"]
    ]
    assert wrs == sorted(wrs, reverse=True)
```

- [ ] **Step 2: Run tests to confirm failure**

```
python -m pytest tests/test_generate_league.py -v
```
Expected: FAIL (import errors or assertion errors).

- [ ] **Step 3: Run tests after Task 4 code is in place**

```
python -m pytest tests/test_generate_league.py -v
```
Expected: 7 tests PASS.

If any fail, fix the relevant function in `generate_league.py`.

- [ ] **Step 4: Smoke test generate_league.py end-to-end**

```
python generate_league.py
python -c "
import json, sys
sys.stdout.reconfigure(encoding='utf-8')
with open('data/league_2526.json', encoding='utf-8') as f:
    d = json.load(f)
print('standings:', [t['name'] + ' ' + str(t['wins']) + 'W' for t in d['standings'][:3]])
print('league_rtg top3:', [(r['name'], r['netrtg']) for r in d['league_rtg'][:3]])
"
```
Expected: league_2526.json written with standings and rtg data.

- [ ] **Step 5: Commit**

```
git add generate_league.py tests/test_generate_league.py data/league_2526.json
git commit -m "feat: generate_league.py with tests"
```

---

## Task 6: auto_update.py — orchestrator for all teams

**Files:**
- Create: `auto_update.py`

### Steps

- [ ] **Step 1: Create auto_update.py**

`auto_update.py`:
```python
"""
auto_update.py — TPBL-lens full-league updater.

Usage:
    python auto_update.py          # check + update all teams
    python auto_update.py --dry-run  # check only, no writes
"""
import argparse, json, os, subprocess, sys
from datetime import datetime
sys.stdout.reconfigure(encoding="utf-8")

from config import TEAMS, ALLGAME_FILE, ALLTEAM_FILE
from fetch_games import sync_new_games, update_team_stats, load_schedule

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def run_process_team(team_id, dry_run=False):
    if dry_run:
        log(f"  [dry] would process team_id={team_id}")
        return True
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(
        [sys.executable, os.path.join(_BASE_DIR, "process_data.py"),
         "--team-id", str(team_id)],
        cwd=_BASE_DIR, env=env,
        capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if result.returncode != 0:
        log(f"  [ERROR] process_data.py --team-id {team_id}:\n{result.stderr[-400:]}")
        return False
    log(f"  {result.stdout.strip()}")
    return True


def run_generate_league(dry_run=False):
    if dry_run:
        log("  [dry] would generate league JSON")
        return True
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(
        [sys.executable, os.path.join(_BASE_DIR, "generate_league.py")],
        cwd=_BASE_DIR, env=env,
        capture_output=True, text=True, encoding="utf-8", errors="replace"
    )
    if result.returncode != 0:
        log(f"  [ERROR] generate_league.py:\n{result.stderr[-400:]}")
        return False
    log(f"  {result.stdout.strip()}")
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Check only; do not write files")
    args = parser.parse_args()

    log("=" * 50)
    log("tpbl-lens auto-update started")
    log("=" * 50)

    schedule = load_schedule()

    log("Syncing new game files...")
    new_count = sync_new_games(schedule)
    log(f"  New games fetched: {new_count}")

    log("Updating team aggregate stats...")
    if not args.dry_run:
        try:
            update_team_stats()
        except Exception as e:
            log(f"  [WARN] team stats update failed: {e}")

    if new_count == 0 and not args.dry_run:
        log("No new games. Skipping processing.")
        log("=" * 50)
        log("Done (no changes)")
        log("=" * 50)
        return

    log("Processing all teams...")
    errors = []
    for team_id in sorted(TEAMS.keys()):
        slug = TEAMS[team_id]["slug"]
        log(f"  Processing {slug} (id={team_id})...")
        ok = run_process_team(team_id, args.dry_run)
        if not ok:
            errors.append(team_id)

    log("Generating league JSON...")
    run_generate_league(args.dry_run)

    log("=" * 50)
    if errors:
        log(f"Done with errors: team_ids {errors}")
        sys.exit(1)
    else:
        log("Done — all teams updated successfully")
    log("=" * 50)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Smoke test with --dry-run**

```
python auto_update.py --dry-run
```
Expected output:
```
[HH:MM:SS] tpbl-lens auto-update started
[HH:MM:SS] Syncing new game files...
[HH:MM:SS]   New games fetched: 0
...
[HH:MM:SS] Done — all teams updated successfully
```

- [ ] **Step 3: Run full update**

```
python auto_update.py
```
Expected: all 7 `data/{slug}_2526.json` files updated, `league_2526.json` updated.

- [ ] **Step 4: Commit**

```
git add auto_update.py
git commit -m "feat: auto_update.py orchestrator for all teams"
```

---

## Task 7: GitHub Actions cron

**Files:**
- Create: `.github/workflows/auto-update.yml`

### Steps

- [ ] **Step 1: Create GitHub Actions workflow**

`.github/workflows/auto-update.yml`:
```yaml
name: TPBL-lens Auto Update

on:
  schedule:
    - cron: '30 14 * * *'  # 22:30 CST = 14:30 UTC
  workflow_dispatch:        # manual trigger via GitHub UI

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run auto_update
        run: python auto_update.py
        env:
          PYTHONIOENCODING: utf-8

      - name: Commit & push if changed
        run: |
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/
          git diff --cached --quiet || git commit -m "data: auto-update $(date '+%Y-%m-%d')"
          git push
```

- [ ] **Step 2: Create GitHub repo and push**

```
git remote add origin https://github.com/<your-username>/tpbl-lens.git
git branch -M main
git push -u origin main
```
(Replace `<your-username>` with actual GitHub username.)

- [ ] **Step 3: Verify Actions tab in GitHub**

Go to `https://github.com/<your-username>/tpbl-lens/actions` and trigger workflow manually via "Run workflow". Confirm green checkmark.

- [ ] **Step 4: Commit workflow file**

```
git add .github/workflows/auto-update.yml
git commit -m "ci: add GitHub Actions cron for nightly update at 22:30 CST"
git push
```

---

## Phase 1 Completion Checklist

- [ ] `python -m pytest tests/ -v` → all tests pass
- [ ] `python process_data.py --team-id 3` → `data/formosa_2526.json` written
- [ ] `python process_data.py --team-id 4` → `data/lions_2526.json` written
- [ ] `python auto_update.py` → all 7 JSONs + `league_2526.json` updated
- [ ] `data/lions_2526.json` contains: `heatmap`, `simulation`, `roc`, `mann_whitney` (non-empty)
- [ ] `data/aquas_2526.json` has empty `heatmap: []` and `simulation: {}` (standard depth)
- [ ] `data/league_2526.json` contains: `standings`, `league_rtg`, `scoring_sources`
- [ ] GitHub Actions triggered manually → green

---

## Self-Review

**Spec coverage:**
- ✅ TPBL API 探查 — teams/IDs documented in config; API endpoints in fetch_games.py
- ✅ `process_data.py --team-id N` — Task 3+4
- ✅ `auto_update.py` 全 6/7 隊 — Task 6
- ✅ 每日自動判斷更新 — Task 7 (GitHub Actions)
- ✅ 6 個 `*_2526.json` — process_team() writes `data/{slug}_2526.json`
- ✅ `league_2526.json` — Task 5
- ✅ `team_` prefix (not `lion_`) — `team_score`, `team_stats` used throughout
- ✅ Full depth only for IDs 3 + 4 — `cfg["full_depth"]` gate in process_team()
- ✅ 2025-26 season scope — `SEASON = "2025-26"`, `TOTAL_GAMES = 36`

**No placeholders:** All code blocks are complete and runnable.

**Type consistency:**
- `parse_games()` → `g["team_score"]` (not `lion_score`) ✓
- `calc_home_away()` uses `g["team_score"]` ✓
- `process_team()` reads `g["team_score"]` for avg_pts ✓
- `calc_scenario_chart()` labels use `lion_mean`/`lion_std` in the output dict (renamed from internal variable) — kept for JS compatibility; can be renamed in Phase 2
