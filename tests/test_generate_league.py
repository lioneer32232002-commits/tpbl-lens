import json, os, sys
import pytest
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

FIXTURES = os.path.join(os.path.dirname(__file__), "fixtures")

def _load_allteam():
    with open(os.path.join(FIXTURES, "allteam_sample.json"), encoding="utf-8") as f:
        return json.load(f)

def _load_game_sample():
    with open(os.path.join(FIXTURES, "game_sample.json"), encoding="utf-8") as f:
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


def test_calc_league_rtg_netrtg_equals_ortg_minus_drtg():
    from generate_league import calc_league_rtg
    result = calc_league_rtg(_load_allteam())
    for r in result:
        assert r["netrtg"] == round(r["ortg"] - r["drtg"], 1), \
            f"{r['name']}: netrtg mismatch"


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


def test_standings_sorted_by_win_rate():
    from generate_league import build_league_json
    out = build_league_json(_load_allteam())
    wrs = [
        t["wins"] / t["gp"] if t["gp"] > 0 else 0
        for t in out["standings"]
    ]
    assert wrs == sorted(wrs, reverse=True)


def test_build_league_json_structure():
    from generate_league import build_league_json
    out = build_league_json(_load_allteam())   # no game_data
    assert set(out.keys()) >= {"meta", "standings", "league_rtg",
                                "scoring_sources", "style_clusters",
                                "matchup_matrix", "pace_trend"}
    assert len(out["style_clusters"]) == 3
    assert out["matchup_matrix"] == {}
    assert out["pace_trend"] == []
    assert out["meta"]["season"] == "2025-26"


def test_calc_style_clusters_returns_all_teams():
    from generate_league import calc_style_clusters
    result = calc_style_clusters(_load_allteam())
    assert len(result) == 3


def test_calc_style_clusters_has_required_keys():
    from generate_league import calc_style_clusters
    result = calc_style_clusters(_load_allteam())
    required = {"name", "pace", "three_rate", "paint_rate", "ast_to", "cluster"}
    for r in result:
        assert required.issubset(r.keys())


def test_calc_style_clusters_valid_cluster_labels():
    from generate_league import calc_style_clusters
    result = calc_style_clusters(_load_allteam())
    valid = {"快攻型", "三分型", "禁區型", "均衡型"}
    for r in result:
        assert r["cluster"] in valid, f"unexpected cluster: {r['cluster']}"


def test_calc_style_clusters_sorted_by_pace():
    from generate_league import calc_style_clusters
    result = calc_style_clusters(_load_allteam())
    paces = [r["pace"] for r in result]
    assert paces == sorted(paces, reverse=True)


def test_calc_matchup_matrix_records_wins_losses():
    from generate_league import calc_matchup_matrix
    games = _load_game_sample()
    result = calc_matchup_matrix(games)
    lions   = "新竹御嵿攻城獅"
    formosa = "福爾摩沙夢想家"
    aquas   = "高雄全家海神"
    assert result[lions][formosa]["w"] == 1
    assert result[lions][formosa]["l"] == 0
    assert result[formosa][lions]["w"] == 0
    assert result[formosa][lions]["l"] == 1
    assert result[aquas][lions]["w"] == 1
    assert result[lions][aquas]["l"] == 1


def test_calc_matchup_matrix_empty_for_no_games():
    from generate_league import calc_matchup_matrix
    assert calc_matchup_matrix([]) == {}


def test_calc_pace_trend_has_all_teams():
    from generate_league import calc_pace_trend
    result = calc_pace_trend(_load_game_sample())
    names = {t["name"] for t in result}
    assert "新竹御嵿攻城獅" in names
    assert "福爾摩沙夢想家" in names
    assert "高雄全家海神" in names


def test_calc_pace_trend_x_values_sequential():
    from generate_league import calc_pace_trend
    result = calc_pace_trend(_load_game_sample())
    for team in result:
        xs = [p["x"] for p in team["data"]]
        assert xs == list(range(1, len(xs) + 1)), f"{team['name']} x not sequential"


def test_calc_pace_trend_empty_for_no_games():
    from generate_league import calc_pace_trend
    assert calc_pace_trend([]) == []
