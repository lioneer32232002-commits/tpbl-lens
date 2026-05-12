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
