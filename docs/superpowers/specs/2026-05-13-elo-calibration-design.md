# tpbl-lens：Elo 校準模型升級設計文件

**日期**：2026-05-13  
**作者**：Adam Pan + Claude  
**狀態**：已確認，待實作

---

## 1. 背景與目標

現有校準模型（`generate_calibration`）使用純勝率比值：
```
P = team_wr / (team_wr + opp_wr) ± HOME_ADV
```
問題：
- 前幾場因 win rate = 0.5 fallback + clip，出現 0.05 極端預測值
- 只用 W/L 二元訊號，每場資訊量低
- TPBL 常規賽只有 **36 場**，這些問題在小樣本下特別明顯
- 整季 Brier Score 0.247，接近 0.25 的隨機猜基準

**目標**：換成 MOV-adjusted Elo + Pace-adjusted Net Rating，預期 Brier Score 降至 0.18–0.21。

---

## 2. 演算法設計

### 2.1 初始化

| 參數 | 值 | 說明 |
|---|---|---|
| 起始 Elo | 1500 | 全聯盟 7 隊相同 |
| 主場加成 | +65 Elo 分 | 代入公式後約 +10% 勝率 |
| K 值 | 20 | TPBL 7 隊小聯賽適用；NBA 常用 20–32 |

### 2.2 賽前勝率預測

```
P(A 贏 B，A 為主場) = 1 / (1 + 10^((Elo_B - Elo_A - 65) / 400))
A 為客場時：主場加成改加在 B：P = 1 / (1 + 10^((Elo_B + 65 - Elo_A) / 400))
```

### 2.3 賽後 Elo 更新

```python
# Step 1：計算 possessions（每隊各算）
poss_team = fga + 0.44 * fta + to - oreb
poss_opp  = opp_fga + 0.44 * opp_fta + opp_to - opp_oreb

# Step 2：Pace-adjusted Net Rating differential
net_rtg_diff = (team_pts / poss_team - opp_pts / poss_opp) * 100

# Step 3：MOV multiplier（538 風格，log 壓縮 + autocorrect）
elo_diff = elo_winner - elo_loser   # 贏家 - 輸家（已含主客場修正）
mov_mult = log(abs(net_rtg_diff) + 1) * (2.2 / (elo_diff * 0.001 + 2.2))

# Step 4：更新
delta = K * mov_mult * (actual_result - expected_prob)
elo_winner += delta
elo_loser  -= delta
```

`actual_result`：贏 = 1，敗 = 0  
`expected_prob`：贏家在賽前的預期勝率（已含主場加成）

### 2.4 Calibration Walk-forward

- 預測第 i 場時，Elo 由 **前 i-1 場** 的所有比賽結果（全聯盟，不只本隊）建立
- 第 1 場：雙方都是 1500，預測值 ≈ 50% ± 主場加成
- 無 look-ahead bias

---

## 3. 資料來源

所有計算所需欄位均來自現有 `data/games/*.txt`（`teams.total` 節點）：

| 欄位 | 用途 |
|---|---|
| `field_goals_attempted` | FGA → possessions |
| `free_throws_made` / `attempted` | FTA → possessions |
| `turnovers` | TO → possessions |
| `offensive_rebounds` | OREB → possessions |
| `three_pointers_made` | 3PM → eFG% 參考 |
| `won_score` / `lost_score` | 得分 |

不需要新增爬蟲或資料來源。

---

## 4. 修改範圍

| 檔案 | 修改說明 |
|---|---|
| `process_data.py` | 新增 `calc_possessions()`, `compute_elo_calibration()` 取代 `generate_calibration()` |
| `data/calibration_*_2526.json` | 重新生成，新增 `elo_before`, `elo_after`, `net_rtg` 欄位 |
| `js/calibration.js` | 新增 Elo 曲線圖，Brier trend 保留 |
| `pages/calibration.html` | 新增 Elo 趨勢圖的 canvas |

### 4.1 JSON 新欄位（每筆 prediction）

```json
{
  "date": "20251029",
  "opp": "高雄全家海神",
  "is_home": false,
  "predicted_win_prob": 0.4821,
  "actual_win": true,
  "team_score": 99,
  "opp_score": 86,
  "low_sample": false,
  "elo_before": 1498.3,
  "elo_after":  1512.7,
  "net_rtg": 8.4
}
```

### 4.2 summary 新欄位

```json
"summary": {
  "brier_score": 0.198,
  "n_games": 36,
  "games_won": 25,
  "final_elo": 1523.4,
  "calibration_note": "Elo + Pace-adjusted Net Rating；賽前勝率無 look-ahead bias"
}
```

---

## 5. 前端新增：Elo 曲線圖

在現有 Brier trend 圖之後加一張 `chart-elo-trend`：
- X 軸：場次日期
- Y 軸：Elo 分數
- 線條顏色：`var(--accent)` (#00d4ff)
- 標記特殊節點：主要對手比賽（新北特攻、攻城獅）

---

## 6. 不在本次範圍

- 超參數最佳化（K 值、主場加成的 grid search）
- 其他 6 隊的校準頁面（資料重新生成，但頁面不做）
- 和舊模型 A/B 比較圖（設計文件記錄即可，不上線）
- 賽季間 Elo 延續（本季從 1500 重置）

---

## 7. 成功標準

| 指標 | 目前 | 目標 |
|---|---|---|
| Brier Score（夢想家） | 0.247 | ≤ 0.215 |
| 早期場次極端預測（< 0.10 或 > 0.90） | 出現 | 不出現 |
| 第 1 場預測值範圍 | 0.05 | 0.43–0.57 |
