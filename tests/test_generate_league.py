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


def test_build_league_json_structure():
    from generate_league import build_league_json
    out = build_league_json(_load_allteam())
    assert set(out.keys()) >= {"meta", "standings", "league_rtg",
                                "scoring_sources", "style_clusters",
                                "matchup_matrix", "pace_trend"}
    assert out["style_clusters"] == []
    assert out["matchup_matrix"] == {}
    assert out["pace_trend"] == []
    assert out["meta"]["season"] == "2025-26"


def test_standings_sorted_by_win_rate():
    from generate_league import build_league_json
    out = build_league_json(_load_allteam())
    wrs = [
        t["wins"] / t["gp"] if t["gp"] > 0 else 0
        for t in out["standings"]
    ]
    assert wrs == sorted(wrs, reverse=True)
