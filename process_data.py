"""
TPBL per-team data processor.
Usage: python process_data.py --team-id 3
"""
import json, math, os, sys, argparse
from collections import defaultdict
import datetime

sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
from scipy import stats as sp_stats

from config import TEAMS, TOTAL_GAMES, HOME_ADV, MONTE_CARLO_N, GAMES_DIR, ALLTEAM_FILE

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GAMES_DIR    = os.path.join(_BASE_DIR, GAMES_DIR)
ALLTEAM_FILE = os.path.join(_BASE_DIR, ALLTEAM_FILE)

STAT_KEYS = [
    "score", "rebounds", "assists", "steals", "blocks",
    "turnovers", "plus_minus", "field_goals_percentage",
    "three_pointers_made", "three_pointers_attempted",
    "free_throws_percentage", "efficiency", "tsp", "time_on_court",
]


def _mean(x):
    return round(sum(x) / len(x), 2) if x else 0


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
    """Return dict: {opp_name: {w, l, avg_team, avg_opp}}."""
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
    pm_map  = defaultdict(lambda: defaultdict(list))
    ppp_map = defaultdict(lambda: defaultdict(list))
    stats   = defaultdict(lambda: defaultdict(list))

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
    """Plus/minus heatmap sorted by descending mean PM."""
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
    if v >= 1.3:  return 3
    if v >= 1.15: return 2
    if v >= 1.0:  return 1
    if v >= 0.9:  return -1
    if v >= 0.8:  return -2
    return -3


def build_ppp_heatmap(ppp_map, teams_order):
    """PPP heatmap sorted by games played then composite score."""
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
            tr  = team["teams"]["rounds"].get(str(q), {})
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
    """Per-game team-level stats for ROC + Mann-Whitney + scenario analysis."""
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
        P     = labels.sum()
        N_neg = (labels == 0).sum()
        pts = []
        for th in thresholds:
            pred = (scores >= th).astype(int)
            tp = int(((pred == 1) & (labels == 1)).sum())
            fp = int(((pred == 1) & (labels == 0)).sum())
            tpr = tp / P     if P     else 0
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
    z[:, 1] *= -1  # TO inverted: fewer turnovers is better
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

    last_idx = max(range(len(games)), key=lambda i: games[i]["date"])
    last_comp = float(composite[last_idx])
    if   last_comp >= q75: last_label = "Best"
    elif last_comp >= q50: last_label = "Ideal"
    elif last_comp >= q25: last_label = "Fair"
    else:                  last_label = "Low"
    pred   = next(r for r in results if r["label"] == last_label)
    last_g = games[last_idx]
    last_s = game_team_stats[last_idx]
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
    """TPBL Monte Carlo simulation (300k runs) for a specific team."""
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
    final_wins = wins_now[None, :] + extra

    def win_prob(wr_a, wr_b, home_a=True):
        base = wr_a / (wr_a + wr_b + 1e-9)
        adj  = base + HOME_ADV if home_a else base - HOME_ADV
        return float(np.clip(adj, 0.05, 0.95))

    def sim_game(ta, tb, home_a=True):
        p = win_prob(wr_arr[team_list.index(ta)],
                     wr_arr[team_list.index(tb)], home_a)
        return rng.random() < p

    def sim_play_in(t4, t5):
        if sim_game(t4, t5, home_a=False): return t4
        if sim_game(t4, t5, home_a=True):  return t4
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
        fw     = final_wins[i]
        rank   = sorted(team_list, key=lambda x: -fw[team_list.index(x)])
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
        lv    = fw[team_idx]
        ov    = fw[team_list.index(opp_f)]
        th    = team_name if lv >= ov else opp_f
        tl    = opp_f if th == team_name else team_name
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


def compute_elo_calibration(all_game_data, team_id, team_name, slug):
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
            denom = max(elo_diff * 0.001 + 2.2, 0.1)
            mov_mult = math.log(net_rtg_abs + 1) * (2.2 / denom)
            delta = K * mov_mult * abs(1.0 - pred_h)
            elos[ht_id] = elo_h + delta
            elos[at_id] = elo_a - delta
        else:  # away wins
            w_elo, l_elo = elo_a, elo_h
            elo_diff = w_elo - l_elo
            denom = max(elo_diff * 0.001 + 2.2, 0.1)
            mov_mult = math.log(net_rtg_abs + 1) * (2.2 / denom)
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
         and dt_mod.datetime.strptime(g["game_date"], "%Y-%m-%d").date() >= today],
        key=lambda x: x["game_date"]
    )
    if not upcoming:
        return {}

    g        = upcoming[0]
    is_home  = g["home_team"]["id"] == team_id
    opp_team = g["away_team"] if is_home else g["home_team"]
    opp_name = opp_team["name"]

    opp_row = next((t for t in standings_raw if t["name"] == opp_name), None)
    opp_wr  = (opp_row["wins"] / opp_row["gp"]
               if opp_row and opp_row["gp"] > 0 else 0.5)
    base     = team_wr / (team_wr + opp_wr + 1e-9)
    prob_adj = float(np.clip(base + (HOME_ADV if is_home else -HOME_ADV), 0.05, 0.95))

    weekdays_cn = ["一", "二", "三", "四", "五", "六", "日"]
    dt = dt_mod.datetime.strptime(g["game_date"], "%Y-%m-%d")
    ha = "主場" if is_home else "客場"
    date_label = f"{dt.month}/{dt.day}（{weekdays_cn[dt.weekday()]}）{ha}"

    return {
        "opponent":          opp_name,
        "date":              date_label,
        "is_home":           is_home,
        "win_prob_model":    round(base, 4),
        "win_prob_adjusted": round(prob_adj, 4),
    }


def process_team(team_id, games_dir=None, allteam_file=None, allgame_file=None):
    """Full pipeline for one team. Returns output dict and writes data/{slug}_2526.json."""
    from generate_league import calc_league_rtg, calc_scoring_sources

    cfg     = TEAMS[team_id]
    slug    = cfg["slug"]
    name    = cfg["name"]
    is_full = cfg["full_depth"]

    all_game_data = load_game_files(games_dir)
    allteam_data  = load_allteam(allteam_file)

    _allgame_path = allgame_file or os.path.join(_BASE_DIR, "data", "allgame_2526.txt")
    with open(_allgame_path, encoding="utf-8") as f:
        allgame_data = json.load(f)

    games          = parse_games(all_game_data, team_id, name)
    vs_summary     = calc_vs_summary(games)
    home_away      = calc_home_away(games)
    standings_raw  = calc_standings(allteam_data)
    quarter        = calc_quarter_analysis(games, all_game_data, team_id)
    league_rtg     = calc_league_rtg(allteam_data)
    scoring_src    = calc_scoring_sources(allteam_data)

    team_row     = next((t for t in standings_raw if t["name"] == name), None)
    total_wins   = team_row["wins"]   if team_row else sum(g["won"] for g in games)
    total_losses = team_row["losses"] if team_row else sum(not g["won"] for g in games)
    total_gp     = team_row["gp"]     if team_row else len(games)
    games_rem    = max(0, TOTAL_GAMES - total_gp)
    win_rate     = total_wins / total_gp if total_gp > 0 else 0.5

    next_game = calc_next_game(allgame_data, team_id, standings_raw, win_rate)

    output = {
        "meta": {
            "team_id":         team_id,
            "team_name":       name,
            "season":          "2025-26",
            "generated":       datetime.date.today().isoformat(),
            "total_games":     total_gp,
            "games_remaining": games_rem,
        },
        "team_stats": {
            "wins":            total_wins,
            "losses":          total_losses,
            "games_played":    total_gp,
            "games_remaining": games_rem,
            "avg_pts":         _mean([g["team_score"] for g in games]),
            "avg_opp_pts":     _mean([g["opp_score"]  for g in games]),
            "win_rate":        round(win_rate, 4),
        },
        "standings":        standings_raw,
        "league_rtg":       league_rtg,
        "scoring_sources":  scoring_src,
        "games":            games,
        "vs_summary":       vs_summary,
        "home_away":        home_away,
        "quarter_analysis": quarter,
        "next_game":        next_game,
        "heatmap":          [],
        "ppp_heatmap":      [],
        "player_avg":       {},
        "simulation":       {},
        "roc":              {},
        "mann_whitney":     [],
        "scenario_chart":   [],
        "last_game_hint":   {},
        "playoff_series":   {},
    }

    # 球員賽季均值：所有有比賽的隊伍都產生
    if len(games) >= 1:
        _, _, ps_map = collect_player_stats(all_game_data, team_id)
        output["player_avg"] = calc_player_season_avg(ps_map)

    if is_full and len(games) >= 4:
        teams_order = [t["team"]["name"] for t in allteam_data if t["team"]["id"] != team_id]
        pm_map, ppp_map, _ = collect_player_stats(all_game_data, team_id)
        output["heatmap"]     = build_heatmap(pm_map, teams_order)
        output["ppp_heatmap"] = build_ppp_heatmap(ppp_map, teams_order)
        output["simulation"]  = calc_simulation(standings_raw, name)
        gts                    = calc_game_team_stats(all_game_data, team_id)
        output["roc"]          = calc_roc_analysis(gts)
        output["mann_whitney"] = calc_mann_whitney(gts)
        sc, hint               = calc_scenario_chart(gts, games)
        output["scenario_chart"] = sc
        output["last_game_hint"] = hint

    out_dir  = os.path.join(_BASE_DIR, "data")
    out_path = os.path.join(out_dir, f"{slug}_2526.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f">>> {slug}_2526.json written ({total_wins}W{total_losses}L)")
    cal_output = compute_elo_calibration(all_game_data, team_id, name, slug)
    cal_path = os.path.join(out_dir, f"calibration_{slug}_2526.json")
    with open(cal_path, "w", encoding="utf-8") as f:
        json.dump(cal_output, f, ensure_ascii=False, indent=2)
    print(f">>> calibration_{slug}_2526.json written (brier={cal_output['summary']['brier_score']})")
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
