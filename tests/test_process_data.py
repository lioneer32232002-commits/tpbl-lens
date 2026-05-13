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
        # 1600 vs 1500, A is away (home_bonus=-65) → stronger team still favored
        p = elo_win_prob(1600, 1500, home_a=False)
        assert p > 0.5

    def test_output_bounded(self):
        from process_data import elo_win_prob
        assert 0.0 < elo_win_prob(2000, 1000, home_a=True) < 1.0
        assert 0.0 < elo_win_prob(1000, 2000, home_a=False) < 1.0


class TestComputeEloCalibration:
    """Uses the 2-game fixture: game_9001 (Lions home beat Formosa) +
    game_9002 (Aquas home beat Lions)."""

    def _run(self, team_id, team_name, slug):
        from process_data import compute_elo_calibration
        all_gd = _load_games()
        return compute_elo_calibration(all_gd, team_id, team_name, slug)

    # --- structural checks ---

    def test_returns_required_keys(self):
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        assert {"meta", "summary", "predictions"} == set(out.keys())

    def test_summary_has_final_elo(self):
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        assert "final_elo" in out["summary"]

    def test_prediction_has_elo_fields(self):
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        p = out["predictions"][0]
        assert "elo_before" in p
        assert "elo_after"  in p
        assert "net_rtg"    in p

    # --- Formosa: 1 game in fixture (away, lost) ---

    def test_formosa_one_prediction(self):
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        assert len(out["predictions"]) == 1

    def test_formosa_first_game_not_extreme(self):
        """Elo model must NOT produce 0.05 for first game (old model's failure)."""
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        p = out["predictions"][0]["predicted_win_prob"]
        assert p > 0.30, f"Expected > 0.30, got {p}"
        assert p < 0.60, f"Expected < 0.60, got {p}"

    def test_formosa_first_game_approx_prob(self):
        """Both teams at 1500, Formosa away → ~0.4075."""
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        p = out["predictions"][0]["predicted_win_prob"]
        assert p == pytest.approx(0.4075, abs=0.002)

    def test_formosa_elo_before_is_1500(self):
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        assert out["predictions"][0]["elo_before"] == pytest.approx(1500.0, abs=0.1)

    def test_formosa_low_sample_true_for_first_game(self):
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        assert out["predictions"][0]["low_sample"] is True

    def test_formosa_net_rtg_negative(self):
        """Formosa lost by 7, so net_rtg should be negative."""
        out = self._run(3, "福爾摩沙夢想家", "formosa")
        assert out["predictions"][0]["net_rtg"] < 0

    # --- Lions: 2 games in fixture ---

    def test_lions_two_predictions(self):
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        assert len(out["predictions"]) == 2

    def test_lions_game1_home_prob_above_half(self):
        """Lions home, both at 1500 → should be > 0.50."""
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        assert out["predictions"][0]["predicted_win_prob"] > 0.50

    def test_lions_game2_uses_updated_elo(self):
        """After winning game 1, Lions Elo > 1500; game 2 elo_before should reflect that."""
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        assert out["predictions"][1]["elo_before"] > 1500.0

    def test_brier_score_computed(self):
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        assert 0.0 <= out["summary"]["brier_score"] <= 1.0

    def test_meta_has_model_field(self):
        out = self._run(4, "新竹御嵿攻城獅", "lions")
        assert "model" in out["meta"]
