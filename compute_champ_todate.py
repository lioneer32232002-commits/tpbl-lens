# -*- coding: utf-8 -*-
"""計算冠軍戰「系列賽至今」的隊伍 / 球員統計，注入 championship_2526.json。

資料來源：championship_2526.json 的 championship_series 中已開打的場次
（提供 game_id / formosa_home / opp_key），逐場讀取 data/games/{game_id}.txt。

冠軍賽 game 檔特性（與例行賽不同）：
  - 隊伍統計在 teams.total（多數欄位正常，但 won_score/lost_score 已知會損壞，
    全部固定為某一數值），因此「隊伍得分」改由 teams.rounds 四節合算取得。
  - 球員統計只在 players.rounds.{Q}（逐節），需四節合算；players.total 無統計。

注入鍵（以對手 kings 為例）：
  formosa_champ / kings_champ          隊伍至今效率、得分來源、主客場
  formosa_champ_pm / kings_champ_pm    球員每場 Plus/Minus 平均（與 *_hm_* 同格式）
  formosa_champ_ppp / kings_champ_ppp  球員每回合得分 PPP（與 *_ppp_* 同格式）

計算規範（與 CLAUDE.md / process_data.py 一致）：
  隊伍 possessions = FGA - OREB + TO + 0.44*FTA
  球員 PPP（逐場）= PTS / (FGA - OREB + TO + 0.44*FTA)，再取各場平均
  Plus/Minus     = 逐場 plus_minus 之平均
  avg_min        = time_on_court(秒) / 60 之平均
"""
import json
import os

CHAMP_JSON = os.path.join("data", "championship_2526.json")
GAMES_DIR = os.path.join("data", "games")
FORMOSA_ID = 3


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _side(game, team_id):
    return game["home_team"] if game["home_team"]["id"] == team_id else game["away_team"]


def _opp_id(game):
    for t in (game["home_team"], game["away_team"]):
        if t["id"] != FORMOSA_ID:
            return t["id"]
    return None


def _team_poss(t):
    return (_num(t.get("field_goals_attempted"))
            - _num(t.get("offensive_rebounds"))
            + _num(t.get("turnovers"))
            + 0.44 * _num(t.get("free_throws_attempted")))


def _team_score(side):
    """由 teams.rounds 四節合算隊伍得分（total.won_score 已知損壞）。"""
    rounds = side["teams"]["rounds"]
    return sum(_num(rounds[q].get("won_score")) for q in ("1", "2", "3", "4"))


def _player_round_totals(side):
    """合算四節，回傳 {roster_id: {name, pm, score, fga, oreb, to, fta, sec}}"""
    acc = {}
    rounds = side["players"]["rounds"]
    for q in rounds:
        for rid, p in rounds[q].items():
            if "plus_minus" not in p:
                continue
            a = acc.setdefault(rid, {"name": p["name"], "pm": 0, "score": 0,
                                     "fga": 0, "oreb": 0, "to": 0, "fta": 0, "sec": 0})
            a["pm"] += _num(p.get("plus_minus"))
            a["score"] += _num(p.get("score"))
            a["fga"] += _num(p.get("field_goals_attempted"))
            a["oreb"] += _num(p.get("offensive_rebounds"))
            a["to"] += _num(p.get("turnovers"))
            a["fta"] += _num(p.get("free_throws_attempted"))
            a["sec"] += _num(p.get("time_on_court"))
    return acc


def _team_block(games, team_id, is_formosa):
    n = len(games)
    pf = pa = poss_f = poss_a = 0.0
    s_three = s_paint = s_ft = s_total = 0.0
    home = {"gp": 0, "wins": 0, "losses": 0, "pf": 0, "pa": 0}
    away = {"gp": 0, "wins": 0, "losses": 0, "pf": 0, "pa": 0}

    for g, f_home, f_won in games:
        me = _side(g, team_id)
        opp = g["away_team"] if me is g["home_team"] else g["home_team"]
        mt = me["teams"]["total"]
        my_score = _team_score(me)
        op_score = _team_score(opp)
        pf += my_score
        pa += op_score
        poss_f += _team_poss(mt)
        poss_a += _team_poss(opp["teams"]["total"])
        s_three += _num(mt.get("three_pointers_made")) * 3
        s_paint += _num(mt.get("points_in_paint"))
        s_ft += _num(mt.get("free_throws_made"))
        s_total += my_score

        my_home = f_home if is_formosa else (not f_home)
        won = f_won if is_formosa else (not f_won)
        b = home if my_home else away
        b["gp"] += 1
        b["wins"] += 1 if won else 0
        b["losses"] += 0 if won else 1
        b["pf"] += my_score
        b["pa"] += op_score

    ortg = pf / poss_f * 100 if poss_f else 0
    drtg = pa / poss_a * 100 if poss_a else 0
    three = s_three / n
    paint = s_paint / n
    ft = s_ft / n
    total = s_total / n
    mid = max(0.0, total - three - paint - ft)

    def ha(b):
        gp = b["gp"]
        return {
            "gp": gp, "wins": b["wins"], "losses": b["losses"],
            "win_rate": round(b["wins"] / gp, 4) if gp else 0,
            "avg_pts": round(b["pf"] / gp, 1) if gp else 0,
            "avg_opp": round(b["pa"] / gp, 1) if gp else 0,
        }

    return {
        "gp": n,
        "avg_pts": round(pf / n, 2),
        "avg_opp_pts": round(pa / n, 2),
        "ortg": round(ortg, 1),
        "drtg": round(drtg, 1),
        "netrtg": round(ortg - drtg, 1),
        "pace": round((poss_f + poss_a) / 2 / n, 1),
        "scoring": {
            "three": round(three, 1), "mid": round(mid, 1),
            "paint": round(paint, 1), "ft": round(ft, 1),
            "total": round(total, 1),
        },
        "home": ha(home),
        "away": ha(away),
    }


# 系列賽累計上場時間門檻（分鐘）：過濾垃圾時間小樣本造成的失真 PPP/PM
MIN_TOTAL_MINUTES = 12.0


def _player_blocks(games, team_id):
    """回傳 (pm_list, ppp_list)，格式與 *_hm_* / *_ppp_* 相同。

    僅納入整個系列賽累計上場時間 >= MIN_TOTAL_MINUTES 的球員，
    避免如「1.8 分鐘拿 4 分 → PPP 2.13」這類垃圾時間樣本污染排行。
    """
    pm = {}            # name -> list of per-game plus_minus
    mins = {}          # name -> list of per-game minutes
    total_sec = {}     # name -> 累計秒數
    ppp_pts = {}       # name -> 累計得分（pooled 分子）
    ppp_poss = {}      # name -> 累計回合（pooled 分母）
    for g, *_ in games:
        for rid, a in _player_round_totals(_side(g, team_id)).items():
            mn = a["sec"] / 60.0
            if mn <= 0:
                continue
            nm = a["name"]
            total_sec[nm] = total_sec.get(nm, 0) + a["sec"]
            pm.setdefault(nm, []).append(a["pm"])
            mins.setdefault(nm, []).append(mn)
            poss = a["fga"] - a["oreb"] + a["to"] + 0.44 * a["fta"]
            ppp_pts[nm] = ppp_pts.get(nm, 0) + a["score"]
            ppp_poss[nm] = ppp_poss.get(nm, 0) + poss

    def mean(x):
        return sum(x) / len(x) if x else 0

    pm_out = []
    ppp_out = []
    for nm in pm:
        if total_sec.get(nm, 0) / 60.0 < MIN_TOTAL_MINUTES:
            continue  # 累計上場不足，過濾垃圾時間樣本
        gp = len(pm[nm])
        avg_min = round(mean(mins[nm]), 1)
        pm_out.append({"player": nm, "pm": round(mean(pm[nm]), 2),
                       "gp": gp, "avg_min": avg_min})
        # PPP 採 pooled（總分 / 總回合），避免單場小樣本爆發被平均放大
        poss = ppp_poss.get(nm, 0)
        ppp_val = ppp_pts.get(nm, 0) / poss if poss > 0 else 0
        ppp_out.append({"player": nm, "ppp": round(ppp_val, 2),
                        "gp": gp, "avg_min": avg_min})
    pm_out.sort(key=lambda x: -x["pm"])
    ppp_out.sort(key=lambda x: -x["ppp"])
    return pm_out, ppp_out


def main():
    with open(CHAMP_JSON, encoding="utf-8") as f:
        D = json.load(f)

    by_opp = {}
    for gm in D.get("championship_series", []):
        opp_key = gm.get("opp_key")
        gid = gm.get("game_id")
        if not opp_key or not gid:
            continue
        path = os.path.join(GAMES_DIR, f"{gid}.txt")
        if not os.path.exists(path):
            print(f"[champ-todate] 缺少 game 檔 {gid}，略過")
            continue
        with open(path, encoding="utf-8") as gf:
            game = json.load(gf)
        by_opp.setdefault(opp_key, []).append((game, gm["formosa_home"], gm["won"]))

    # 先清掉舊的 champ 鍵（場次可能變動時避免殘留）
    for k in list(D.keys()):
        if k.endswith("_champ") or k.endswith("_champ_pm") or k.endswith("_champ_ppp"):
            del D[k]

    for opp_key, games in by_opp.items():
        oid = _opp_id(games[0][0])
        D["formosa_champ"] = _team_block(games, FORMOSA_ID, True)
        D[opp_key + "_champ"] = _team_block(games, oid, False)
        fpm, fppp = _player_blocks(games, FORMOSA_ID)
        opm, oppp = _player_blocks(games, oid)
        D["formosa_champ_pm"] = fpm
        D["formosa_champ_ppp"] = fppp
        D[opp_key + "_champ_pm"] = opm
        D[opp_key + "_champ_ppp"] = oppp
        fc = D["formosa_champ"]
        print(f"[champ-todate] {opp_key}: {len(games)} 場 "
              f"(夢想家 ORtg {fc['ortg']} / DRtg {fc['drtg']} / Net {fc['netrtg']} "
              f"/ 得分 {fc['avg_pts']} 失分 {fc['avg_opp_pts']})")

    with open(CHAMP_JSON, "w", encoding="utf-8") as f:
        json.dump(D, f, ensure_ascii=False, separators=(",", ":"))
    print("[champ-todate] 已寫回 championship_2526.json")


if __name__ == "__main__":
    main()
