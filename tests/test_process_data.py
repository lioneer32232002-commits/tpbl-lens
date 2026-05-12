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
