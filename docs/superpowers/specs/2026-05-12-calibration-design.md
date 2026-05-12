# tpbl-lens Phase 4：校準頁面設計文件

**日期**：2026-05-12  
**作者**：Adam Pan + Claude  
**狀態**：已確認，待實作

---

## 1. 目標與定位

### 目的
`/formosa/calibration` 是一個**面試展示頁**，用來向夢想家球團呈現：「我的 Monte Carlo 預測模型對夢想家每場比賽的賽前勝率預測有多準確。」

### 定位
- **不是球迷頁**：球迷不在乎 Brier score，這頁不適合放在公開導覽
- **不是教練版**：教練版（scouting、戰術建議）因 TPBL 資料粒度不足，不在本次範圍
- **是信任背書**：讓面試官看到模型不是黑盒子，有可驗證的預測紀錄

### 隱藏策略
- `<meta name="robots" content="noindex, nofollow">` — Google 不索引
- 導覽列和夢想家頁面**不加任何連結**指向此頁
- 網址存在（`/formosa/calibration`），但只在面試時主動出示

---

## 2. 範圍

| 項目 | 做 | 不做 |
|---|---|---|
| 校準資料產生 | 全 6 隊都存 | — |
| 校準網頁 | 只做夢想家 | 攻城獅及其他隊 |
| 教練版功能 | — | 本次不做 |

---

## 3. 資料設計

### 3.1 新增檔案：`data/calibration_<team>_2526.json`（六隊各一）

```json
{
  "meta": {
    "team_id": 3,
    "team_name": "福爾摩沙夢想家",
    "season": "2025-26",
    "generated": "2026-05-12"
  },
  "summary": {
    "brier_score": 0.182,
    "n_games": 36,
    "games_won": 22,
    "calibration_note": "每場預測使用該場賽前可用資料，無 look-ahead bias"
  },
  "predictions": [
    {
      "date": "20251025",
      "opp": "新竹御嵿攻城獅",
      "is_home": true,
      "predicted_win_prob": 0.61,
      "actual_win": true,
      "team_score": 95,
      "opp_score": 88
    }
  ]
}
```

### 3.2 Brier Score 定義

```
Brier Score = (1/N) × Σ (predicted_prob - actual_outcome)²
```

- `actual_outcome`：勝 = 1，敗 = 0
- 0 = 完美預測，0.25 = 隨機猜（50% 機率猜每場），越低越好
- 全季 `summary.brier_score` 由 `process_data.py` 計算後直接寫入

---

## 4. 資料管線

### 4.1 `process_data.py` 新增邏輯

新增 `generate_calibration(team_id, games)` 函式，對每場比賽 `i`：

1. 取 `games[:i]`（截止賽前的歷史場次）
2. 用縮減版 Monte Carlo（50,000 次迭代，現有為 300,000）計算本場賽前勝率
3. 記錄 `predicted_win_prob` vs `actual_win`

**前 4 場場次不足問題**：仍然計算並記錄，頁面上以 `low_sample: true` 標記，顯示「樣本數不足，參考用」。

**執行時間估算**：50,000 次 × 36 場 × 6 隊 ≈ 1–2 分鐘，可接受。

### 4.2 `auto_update.py` 整合

每次自動更新一起產生 `calibration_<team>_2526.json`，新賽季加一場即自動補一筆預測紀錄。

---

## 5. 頁面設計 `/formosa/calibration`

### 5.1 版面（由上至下）

```
[NAV — 與其他頁相同]

標題：預測校準紀錄 2025-26
副標：福爾摩沙夢想家｜36 場常規賽

┌─────────────┬──────────────────────────────┐
│  Brier      │  0 = 完美預測                │
│  Score      │  0.25 = 隨機猜               │
│  0.182      │  本模型使用截止賽前資料，無偏差 │
└─────────────┴──────────────────────────────┘

[Brier Score 累積趨勢折線圖]
X 軸：場次日期  Y 軸：累積 Brier score

[Calibration Plot — 分桶圖（主圖）]
X 軸：預測勝率區間（0–10%, 10–20%, …, 90–100%）
Y 軸：該區間內的實際勝率
對角線 = 完美校準基準線

[Calibration Plot — 逐場散點圖]
X 軸：單場預測勝率  Y 軸：0（敗）/ 1（勝）
加移動平均線（窗口 5 場）

[預測紀錄表]
欄位：日期｜對手｜主/客｜預測勝率｜實際結果｜比分
低樣本場次（前 4 場）標注灰色「樣本不足」
```

### 5.2 視覺風格

沿用現有色彩系統（`--bg #0f1923`、`--accent #00d4ff`）。無新色引入。

圖表使用 Chart.js（現有依賴），不引入新函式庫。

### 5.3 `<head>` 特殊處理

```html
<meta name="robots" content="noindex, nofollow">
```

此 meta tag 加在 `pages/calibration.html` 的 `<head>` 裡，**不放進 `_head.html` partial**（不影響其他頁面）。

---

## 6. 新增 / 修改檔案清單

| 檔案 | 動作 | 說明 |
|---|---|---|
| `data/calibration_formosa_2526.json` | 新增（產生） | 夢想家校準資料 |
| `data/calibration_lions_2526.json` | 新增（產生） | 攻城獅校準資料（備用） |
| `data/calibration_<其他四隊>_2526.json` | 新增（產生） | 其他四隊校準資料（備用） |
| `process_data.py` | 修改 | 新增 `generate_calibration()` + Brier score 計算 |
| `auto_update.py` | 修改 | 一起產生 calibration JSON |
| `pages/calibration.html` | 新增 | 校準頁模板（含 noindex meta） |
| `js/calibration.js` | 新增 | 圖表渲染邏輯 |
| `build.py` | 修改 | 新增 formosa calibration 輸出規則 |

---

## 7. 不在本次範圍內

- 教練版（scouting、暫停時機、節次戰術）
- 攻城獅及其他隊的校準**網頁**（資料已存，網頁之後視需求再做）
- 密碼保護或任何登入機制
- 2024-25 賽季歷史校準（只做本季）
