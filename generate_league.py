import json, os, sys, datetime
sys.stdout.reconfigure(encoding="utf-8")
from config import ALLTEAM_FILE, SEASON

_BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
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


def _calc_standings(allteam_data):
    raw = [
        {"name": t["team"]["name"],
         "wins": t["won_game_count"],
         "losses": t["lost_game_count"],
         "gp": t["game_count"]}
        for t in allteam_data
    ]
    return sorted(raw, key=lambda x: -(x["wins"] / x["gp"] if x["gp"] > 0 else 0))


def build_league_json(allteam_data):
    return {
        "meta": {"season": SEASON, "generated": datetime.date.today().isoformat()},
        "standings":       _calc_standings(allteam_data),
        "league_rtg":      calc_league_rtg(allteam_data),
        "scoring_sources": calc_scoring_sources(allteam_data),
        "style_clusters":  [],
        "matchup_matrix":  {},
        "pace_trend":      [],
    }


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
