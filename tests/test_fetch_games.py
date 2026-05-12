import json, os, sys
from unittest.mock import patch
import pytest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

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
