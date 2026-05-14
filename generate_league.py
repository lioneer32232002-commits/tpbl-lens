import json, os, sys, datetime, glob as _glob
sys.stdout.reconfigure(encoding="utf-8")
from config import ALLTEAM_FILE, SEASON, SEASON_START, SEASON_END

_BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
ALLTEAM_FILE = os.path.join(_BASE_DIR, ALLTEAM_FILE)


def _load_game_files():
    """Load regular-season game files only (date within SEASON_START..SEASON_END)."""
    game_dir = os.path.join(_BASE_DIR, "data", "games")
    result = []
    skipped = 0
    if not os.path.exists(game_dir):
        return result
    for fn in sorted(_glob.glob(os.path.join(game_dir, "*.txt"))):
        try:
            with open(fn, encoding="utf-8") as f:
                g = json.load(f)
            date_raw = g.get("game_date", "").replace("-", "")
            if date_raw < SEASON_START or date_raw > SEASON_END:
                skipped += 1
                continue
            result.append(g)
        except (json.JSONDecodeError, OSError) as e:
            print(f"[generate_league] skipping {fn}: {e}", file=sys.stderr)
    if skipped:
        print(f"[generate_league] excluded {skipped} non-regular-season game(s)", file=sys.stderr)
    return result


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


def calc_style_clusters(allteam_data):
    teams = []
    for t in allteam_data:
        avg  = t["average_stats"]
        fga  = avg.get("field_goals_attempted",   0) or 0
        oreb = avg.get("offensive_rebounds",       0) or 0
        to_v = avg.get("turnovers",                0) or 0
        fta  = avg.get("free_throws_attempted",    0) or 0
        tpa  = avg.get("three_pointers_attempted", 0) or 0
        pip  = avg.get("points_in_paint",          0) or 0
        pts  = avg.get("won_score",                0) or 0
        ast  = avg.get("assists",                  0) or 0

        pace       = round(fga - oreb + to_v + 0.44 * fta, 1)
        three_rate = round(tpa / fga, 3) if fga > 0 else 0.0
        paint_rate = round(pip / pts, 3) if pts > 0 else 0.0
        ast_to     = round(ast / to_v, 2) if to_v > 0 else 0.0

        teams.append({
            "name": t["team"]["name"],
            "pace": pace, "three_rate": three_rate,
            "paint_rate": paint_rate, "ast_to": ast_to,
        })

    n    = len(teams)
    top  = max(1, n // 3)
    # cluster priority: 三分型 > 禁區型 > 快攻型 > 均衡型
    by_pace  = [x["name"] for x in sorted(teams, key=lambda x: -x["pace"])]
    by_three = [x["name"] for x in sorted(teams, key=lambda x: -x["three_rate"])]
    by_paint = [x["name"] for x in sorted(teams, key=lambda x: -x["paint_rate"])]

    for t in teams:
        pr  = by_pace.index(t["name"])
        thr = by_three.index(t["name"])
        ptr = by_paint.index(t["name"])

        if thr < top and ptr >= top:
            t["cluster"] = "三分型"
        elif ptr < top and thr >= top:
            t["cluster"] = "禁區型"
        elif pr < top and thr >= top and ptr >= top:
            t["cluster"] = "快攻型"
        else:
            t["cluster"] = "均衡型"

    return sorted(teams, key=lambda x: -x["pace"])


def calc_matchup_matrix(game_data):
    from collections import defaultdict
    matrix = defaultdict(lambda: defaultdict(lambda: {"w": 0, "l": 0}))

    for game in game_data:
        home  = game["home_team"]
        away  = game["away_team"]
        home_score = (home["teams"]["total"].get("won_score", 0) or 0)
        away_score = (away["teams"]["total"].get("won_score", 0) or 0)
        hn, an = home["name"], away["name"]

        if home_score > away_score:
            matrix[hn][an]["w"] += 1
            matrix[an][hn]["l"] += 1
        elif away_score > home_score:
            matrix[hn][an]["l"] += 1
            matrix[an][hn]["w"] += 1

    return {k: dict(v) for k, v in matrix.items()}


def calc_pace_trend(game_data):
    from collections import defaultdict
    team_games = defaultdict(list)

    for game in game_data:
        date = game.get("game_date", "") or ""
        for side in ("home_team", "away_team"):
            team  = game[side]
            total = team["teams"]["total"]
            fga   = total.get("field_goals_attempted", 0) or 0
            oreb  = total.get("offensive_rebounds",    0) or 0
            to_v  = total.get("turnovers",             0) or 0
            fta   = total.get("free_throws_attempted", 0) or 0
            pace  = round(fga - oreb + to_v + 0.44 * fta, 1)
            team_games[team["name"]].append((date, pace))

    result = []
    for name in sorted(team_games):
        sorted_games = sorted(team_games[name], key=lambda x: x[0])
        result.append({
            "name": name,
            "data": [{"x": i + 1, "y": g[1]} for i, g in enumerate(sorted_games)],
        })
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


def build_league_json(allteam_data, game_data=None):
    gd = game_data or []
    return {
        "meta":            {"season": SEASON, "generated": datetime.date.today().isoformat()},
        "standings":       _calc_standings(allteam_data),
        "league_rtg":      calc_league_rtg(allteam_data),
        "scoring_sources": calc_scoring_sources(allteam_data),
        "style_clusters":  calc_style_clusters(allteam_data),
        "matchup_matrix":  calc_matchup_matrix(gd),
        "pace_trend":      calc_pace_trend(gd),
    }


def main():
    with open(ALLTEAM_FILE, encoding="utf-8") as f:
        allteam = json.load(f)
    game_data = _load_game_files()
    out = build_league_json(allteam, game_data)
    out_path = os.path.join(_BASE_DIR, "data", "league_2526.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(">>> league_2526.json written")


if __name__ == "__main__":
    main()
