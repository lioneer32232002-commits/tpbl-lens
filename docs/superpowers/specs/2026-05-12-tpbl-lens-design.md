# tpbl-lens 全聯盟分析平台 — 設計文件

**日期**：2026-05-12  
**作者**：Adam Pan + Claude  
**狀態**：已確認，待實作

---

## 1. 專案背景與目標

將現有攻城獅單隊粉絲網站（lioneers-web）的分析框架，重構為 TPBL 全聯盟中性分析平台（tpbl-lens）。

**戰略目的**：建立一個可拿去 pitch 夢想家（首選）及其他 TPBL 球隊的作品集，呈現「我做了全聯盟平台，並對貴隊做了最深度的分析」。

**品牌定位**：中性分析師視角，非球迷視角。不掛任何單隊名稱，不用「我們」。

---

## 2. 基本資訊

| 項目 | 值 |
|---|---|
| 品牌名稱 | tpbl-lens |
| 部署網址 | tpbl-lens.pages.dev |
| 本機路徑 | `C:\Users\oneda\OneDrive\02_創作\14_AI TEST\tpbl_lens` |
| Hosting | Cloudflare Pages（新建專案） |
| GitHub repo | 新建 `tpbl-lens`（不動 lioneers-web） |

---

## 3. 架構設計

### 3.1 前端：多頁靜態 HTML + Build 腳本

```
tpbl-lens/
├── templates/
│   ├── _head.html          # <head>、CSS 變數、Chart.js 引用
│   ├── _nav.html           # 導覽列（聯盟總覽 + 6 隊入口）
│   └── _footer.html        # 頁尾
├── pages/
│   ├── index.html          # 聯盟總覽（source template）
│   ├── formosa.html        # 夢想家常規賽
│   ├── formosa_playoffs.html
│   ├── lions.html          # 攻城獅（標準深度）
│   ├── lions_playoffs.html
│   └── ...（其他 4 隊，之後補）
├── build.py                # 注入 partials → 輸出 dist/
├── dist/                   # Cloudflare Pages 部署目標
│   ├── index.html
│   ├── formosa/
│   │   ├── index.html
│   │   └── playoffs/index.html
│   └── lions/
│       └── index.html
├── js/
│   ├── common.js           # 共用渲染函式（heatmap、chart 初始化）
│   ├── team.js             # 單隊頁面邏輯（anchor_team 參數驅動）
│   └── league.js           # 聯盟總覽邏輯
├── data/
│   ├── league_2526.json    # 聯盟總覽資料
│   ├── formosa_2526.json   # 夢想家本季 processed data
│   ├── lions_2526.json     # 攻城獅本季 processed data
│   └── ...
├── process_data.py         # --team-id N → 對應 JSON
├── auto_update.py          # 抓全 6 隊 → process × 6 → build
└── generate-og.py          # --team N → og-image
```

**Build 腳本邏輯**：`build.py` 讀取 `pages/*.html`，將 `{{HEAD}}`、`{{NAV}}`、`{{FOOTER}}` 替換為對應 partial 內容，輸出到 `dist/`。改導覽列只改一個 `_nav.html`，自動套到所有頁面。

**Cloudflare Pages 設定**：
- Build command：留空
- Output directory：`dist`

### 3.2 資料架構

**單隊 JSON（anchor_team 視角）**

所有 key 去除 `lion_` 前綴，改為 `team_`。`process_data.py --team-id N` 跑六次輸出六個 JSON。

```json
{
  "meta": { "team_id": 1, "team_name": "福爾摩沙夢想家", "season": "2025-26", "generated": "..." },
  "team_stats": { "wins": 0, "losses": 0, "games_played": 0, "avg_pts": 0, "avg_opp_pts": 0 },
  "standings": [],
  "league_rtg": [],
  "vs_summary": {},
  "games": [],
  "heatmap": [],
  "ppp_heatmap": [],
  "player_avg": {},
  "simulation": {},
  "roc": {},
  "mann_whitney": [],
  "next_game": {},
  "home_away": {},
  "quarter_analysis": {},
  "last_game_hint": {},
  "scenario_chart": [],
  "playoff_series": {}
}
```

**聯盟總覽 JSON**

```json
{
  "meta": { "season": "2025-26", "generated": "..." },
  "standings": [],
  "league_rtg": [],
  "scoring_sources": [],
  "style_clusters": [],      // Phase 3
  "matchup_matrix": {},      // Phase 3
  "pace_trend": []           // Phase 3
}
```

**歷史資料範圍**：本季（2025-26）+ 上季（2024-25）。2024 年以前暫不納入。

### 3.3 更新流程

```
auto_update.py
  ├─ 呼叫 TPBL API，檢查是否有新比賽結果
  │    → 無新資料：靜默結束
  │    → 有新資料：繼續
  ├─ 抓全 6 隊資料
  ├─ process_data.py --team-id N（× 6）→ data/*.json
  ├─ 輸出 league_2526.json
  ├─ build.py → dist/
  └─ generate-og.py（有季後賽的隊才跑）

GitHub Actions Cron：每天 22:30 跑一次，自動判斷有無新賽事
```

**你的日常操作**：
```bash
python auto_update.py   # 一個指令搞定
git add -A && git commit -m "data: update 0512" && git push
```

---

## 4. 頁面結構

### 4.1 首頁（聯盟總覽）`/`

- 聯盟排名表
- 全聯盟每百回合效率（ORtg / DRtg / Net Rating）
- 各隊得分來源比較（三分 / 中距離 / 禁區 / 罰球）
- 各隊快速入口卡片（→ 各隊常規賽頁）
- Phase 3 新增：風格分群、對戰矩陣熱力圖、節奏趨勢

### 4.2 各隊常規賽頁 `/<team>/`

**標準深度**（全 6 隊）：
- 統計快覽、排名、主客場分析
- 對各隊戰績卡片
- 球員均值表
- 聯盟效率排名（含該隊位置標示）

**完整深度**（夢想家 + 攻城獅）另加：
- 球員 Plus/Minus 熱力圖
- 球員 PPP 熱力圖
- USG% vs TS% 散點圖
- ROC 曲線
- Mann-Whitney 統計
- Monte Carlo 模擬
- 節次分析
- 最新比賽回顧

**夢想家專屬**另加：
- 對位優勢結構分析（從夢想家視角，中性框架）
- 預測校準頁面入口

頁面右上角有「季後賽分析 →」按鈕，進季後賽時啟用，連到 `/<team>/playoffs`。

### 4.3 各隊季後賽頁 `/<team>/playoffs`

- 系列賽進度條（Bo5 / Bo7）
- Monte Carlo 晉級機率
- G 場預測 vs 實際
- 上一場回顧
- USG% vs TS% 散點（季後賽場次）
- 對上對手的完整對位分析

### 4.4 夢想家校準頁 `/formosa/calibration`（Phase 4）

- 預測記錄表（每場賽前預測 vs 實際結果）
- Calibration plot（預測 70% 的場次實際勝率多少）
- Brier score 追蹤
- 說明：使用資料截止時間點的資料做預測，無 look-ahead bias

---

## 5. 視覺設計

### 5.1 色彩系統

| 變數 | 色碼 | 用途 |
|---|---|---|
| `--bg` | `#0f1923` | 頁面底色（深海軍藍） |
| `--bg2` | `#1a2a3a` | 卡片、次要背景 |
| `--bg3` | `#243447` | hover、border |
| `--accent` | `#00d4ff` | 主要強調色（青藍） |
| `--accent2` | `#ff6b35` | 次要強調（橙，用於對比標示） |
| `--text` | `#e8edf2` | 主要文字 |
| `--text2` | `#8fa3b8` | 次要文字、標籤 |

### 5.2 設計原則

- 深色底色（適合數據視覺化，降低眼睛疲勞）
- 完整支援手機版（mobile-first，攻城獅網站為視覺參考基準）
- 資料優先：圖表與表格比文字更重要，版面以數據呈現為主
- 中性語氣：所有文字不偏向任何隊，數據說話

### 5.3 熱力圖色階（沿用現有規則）

深藍（最高）→ 中藍 → 淺藍 → 淡灰 → 深灰 → 珊瑚紅（最低）  
色階對應新配色，不再使用紫色系。

---

## 6. 各隊深度規劃

| 隊伍 | 常規賽深度 | 季後賽頁 | 校準頁 |
|---|---|---|---|
| 福爾摩沙夢想家 | 完整 + 專屬模組 | ✅ | ✅ Phase 4 |
| 新竹御嵿攻城獅 | 完整 | ✅ | ❌ |
| 其他 4 隊 | 標準 | Phase 2 後補 | ❌ |

---

## 7. 實作四階段

| 階段 | 內容 | 產出 |
|---|---|---|
| **Phase 1：資料管線** | TPBL API 探查；`process_data.py` 加 `--team-id`；`auto_update.py` 改成全 6 隊；每日自動判斷更新 | 6 個 `*_2526.json` + `league_2526.json` |
| **Phase 2：架構重構** | 新 repo；`build.py` template 系統；`common.js` 抽出共用邏輯；聯盟總覽頁；夢想家完整頁；攻城獅完整頁 | tpbl-lens 上線，含 2 隊完整 + 總覽 |
| **Phase 3：聯盟層級分析** | 風格分群；對戰矩陣熱力圖；節奏趨勢；其他 4 隊標準頁 | 全 6 隊上線 |
| **Phase 4：校準頁面** | 預測記錄 schema；calibration plot；Brier score；`/formosa/calibration` 頁 | Pitch 殺手鐧上線 |

---

## 8. 不在本設計範圍內

- 使用者帳號 / 登入系統
- 留言 / 互動功能
- 即時比分（靜態網站架構不支援）
- 2023-24 以前歷史資料（之後視需求）
- lioneers-web 退役計畫（待 tpbl-lens 穩定後另議）
