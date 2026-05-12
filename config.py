API_BASE    = "https://api.tpbl.basketball/api"
DIVISION_ID = 9
SEASON      = "2025-26"
TOTAL_GAMES = 36
HOME_ADV    = 0.05
MONTE_CARLO_N = 300_000

TEAMS = {
    2: {"name": "高雄全家海神",     "slug": "aquas",    "full_depth": False},
    3: {"name": "福爾摩沙夢想家",   "slug": "formosa",  "full_depth": True},
    4: {"name": "新竹御嵿攻城獅",   "slug": "lions",    "full_depth": True},
    5: {"name": "桃園台啤永豐雲豹", "slug": "leopards", "full_depth": False},
    6: {"name": "新北中信特攻",     "slug": "braves",   "full_depth": False},
    7: {"name": "新北國王",         "slug": "kings",    "full_depth": False},
    8: {"name": "臺北台新戰神",     "slug": "warriors", "full_depth": False},
}

DATA_DIR   = "data"
GAMES_DIR  = "data/games"

ALLTEAM_FILE  = "data/allteam_latest.txt"
ALLGAME_FILE  = "data/allgame_2526.txt"
