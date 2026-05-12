import json, os, sys
from datetime import date, datetime
import requests

sys.stdout.reconfigure(encoding="utf-8")

from config import API_BASE, DIVISION_ID, TEAMS, GAMES_DIR, ALLTEAM_FILE, ALLGAME_FILE

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GAMES_DIR    = os.path.join(_BASE_DIR, GAMES_DIR)
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
            if ht_total.get("won_score") is None and ht_total.get("lost_score") is None:
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
    print("  [fetch] allteam_latest.txt updated")


if __name__ == "__main__":
    schedule = load_schedule()
    n = sync_new_games(schedule)
    print(f"New games fetched: {n}")
    update_team_stats()
