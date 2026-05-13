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


class TestCalcPossessions:
    def test_standard_formula(self):
        from process_data import calc_possessions
        # poss = FGA + 0.44*FTA + TO - OREB = 80 + 8.8 + 12 - 10 = 90.8
        total = {
            "field_goals_attempted": 80,
            "free_throws_attempted": 20,
            "turnovers": 12,
            "offensive_rebounds": 10,
        }
        assert calc_possessions(total) == pytest.approx(90.8, abs=0.01)

    def test_missing_keys_default_zero(self):
        from process_data import calc_possessions
        # all missing → poss = 0, clamped to 1.0
        assert calc_possessions({}) == pytest.approx(1.0, abs=0.01)

    def test_floor_at_one(self):
        from process_data import calc_possessions
        # large OREB could push below zero — must stay ≥ 1.0
        total = {"field_goals_attempted": 5, "free_throws_attempted": 0,
                 "turnovers": 0, "offensive_rebounds": 100}
        assert calc_possessions(total) >= 1.0


class TestEloWinProb:
    def test_equal_elo_home_favored(self):
        from process_data import elo_win_prob
        # home +65 Elo bonus → should be > 0.5
        p = elo_win_prob(1500, 1500, home_a=True)
        assert p == pytest.approx(0.5925, abs=0.001)

    def test_equal_elo_away_symmetric(self):
        from process_data import elo_win_prob
        p_home = elo_win_prob(1500, 1500, home_a=True)
        p_away = elo_win_prob(1500, 1500, home_a=False)
        assert p_home + p_away == pytest.approx(1.0, abs=1e-9)

    def test_higher_elo_team_favored(self):
        from process_data import elo_win_prob
        # 1600 vs 1500, both neutral → stronger team wins more often
        p = elo_win_prob(1600, 1500, home_a=False)
        assert p > 0.5

    def test_output_bounded(self):
        from process_data import elo_win_prob
        assert 0.0 < elo_win_prob(2000, 1000, home_a=True) < 1.0
        assert 0.0 < elo_win_prob(1000, 2000, home_a=False) < 1.0
