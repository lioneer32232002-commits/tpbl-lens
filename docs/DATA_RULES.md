# TPBL-Lens 資料規範（single source of truth）

> 本檔是資料計算與資料來源的唯一權威版本。CLAUDE.md 只路由到這裡，不要把內容複製回去。
> 修改本檔前先讀 `docs/agents/maintenance.md`。

## 資料計算公式

### PPP（每回合得分）
```
possessions = FGA - OREB + TO + 0.44 × FTA
PPP = PTS / possessions
```
與 `process_data.py` 的 `calc_possessions()` 一致。

### USG%（使用率）
```
per_game_USG = player_poss / team_sum_poss × 100
USG = average of per_game_USG across games
```
`player_poss = FGA + 0.44×FTA + TO`（不減 OREB）
`team_sum_poss` = 全隊所有球員 poss 的加總（non-time-weighted）

### TS%（真實命中率）
```
TS% = PTS / (2 × (FGA + 0.44 × FTA)) × 100
```
直接使用 game file 中的 `tsp` 欄位（API 已計算好），不要自己重算。

## 冠軍頁資料來源（2025-26 賽季）

`championship_2526.json` 中所有 `h2h_*` 區塊資料**必須來自 6 場 H2H 對戰**：

| Game ID | 日期 | 主客場 | 比數 |
|---------|------|--------|------|
| 1372 | 2025-10-12 | 國王主 | Kings 112 - Formosa 93 |
| 1392 | 2025-11-12 | 國王主 | Kings 94 - Formosa 91 |
| 1431 | 2026-01-17 | 夢想家主 | Formosa 116 - Kings 96 |
| 1439 | 2026-01-31 | 夢想家主 | Formosa 97 - Kings 114 |
| 1468 | 2026-03-27 | 夢想家主 | Formosa 107 - Kings 90 |
| 1487 | 2026-04-24 | 國王主 | Kings 105 - Formosa 99 |

Team IDs: Formosa = 3, Kings = 7（全部 7 隊的 ID/slug 對應見 `config.py`）

## 在籍球員標記

- `active: false` 表示已離隊，**熱力圖顯示為灰色**
- `buildActiveMap()` 讀取 `D.{team}.players`（頂層 players 陣列），不是 h2h 子物件
- 如果球員不在 `players` 陣列，預設視為在籍（JS 判斷式是 `p.active !== false`，undefined 會通過判斷、視為在籍）
- 離隊球員務必加入頂層 `players` 陣列並設 `active: false`

## 讀資料檔的正確姿勢（省 token）

- `data/*.json` 都是大檔，**不要整檔 Read**。先看結構再抽欄位：
  ```bash
  python -c "import json;d=json.load(open('data/formosa_2526.json',encoding='utf-8'));print(list(d.keys()))"
  python -c "import json;d=json.load(open('data/championship_2526.json',encoding='utf-8'));print(json.dumps(d['championship_series'],ensure_ascii=False)[:2000])"
  ```
- `data/games/{id}.txt` 是單場 box score（JSON 格式，gitignored），同樣先抽欄位。
- `dist/` 下所有檔案是 build 產物：**永遠不讀、不改**。
