# TPBL-Lens 賽季流程 Runbook

> 一份「換季 / 換階段」的操作手冊。使用者只要說一句話，依本檔對應的 Playbook 執行即可。
>
> | 使用者說 | 執行 | 章節 |
> |----------|------|------|
> | 「建立新賽季」「換季」 | Playbook A | [新賽季](#playbook-a建立新賽季) |
> | 「進季後賽」「季後賽開始」 | Playbook B | [季後賽](#playbook-b進季後賽) |
> | 「進冠軍賽」「冠軍賽要開始了」 | Playbook C（賽前） | [冠軍賽—賽前](#c1-賽前設定) |
> | 「冠軍賽 GN 打完了」「更新冠軍頁」 | Playbook C（每場） | [冠軍賽—每場賽後](#c2-每場賽後) |
> | 「冠軍戰結束了」 | Playbook C（賽後，多半自動） | [冠軍賽—系列賽結束](#c3-系列賽結束自動) |

---

## 0. Pipeline 速查

```
auto_update.py（主流程，GitHub Actions 每日 22:00 CST 自動跑）
 ├─ fetch_games.sync_new_games()  → data/games/{game_id}.txt（原始比賽 JSON，gitignored）
 ├─ fetch_games.update_team_stats() → data/allteam_latest.txt
 ├─ process_data.py --team-id N × 7 → data/{slug}_2526.json（各隊：統計/H2H/熱力圖/季後賽模擬）
 ├─ generate_league.py → data/league_2526.json（排名/效率/風格分群/節奏）
 └─ build.py → dist/
      ├─ compute_champ_todate.main()  → 注入 championship_2526.json 的 *_champ* 欄位
      ├─ generate_og_pace.py          → dist/og/pace-trend.png
      ├─ generate_og_championship.py  → dist/og/championship.png
      └─ 套 templates 產生 dist/*.html（index / 7 隊 / championship / calibration）
```

- **資料來源 API**：`https://api.tpbl.basketball/api`（見 `config.py`）
- **game_id 慣例**：例行賽是 1xxx，季後賽/冠軍賽是 8xxx。
- **`data/games/` 被 gitignore**：是純本機來源；最終部署的是各 `*_2526.json` / `championship_2526.json`（已 commit）。

---

## 部署（所有 Playbook 結尾共用）

本機工作目錄：`C:\Users\User\OneDrive\02_創作\14_AI TEST\tpbl_lens`（在 `master` 直接開發；CLAUDE.md 舊版指令寫的 worktree 合併與 `C:\Users\oneda` 路徑已過時，忽略）。

```bash
python build.py
git add data/ dist/ <改到的原始檔>
git commit -m "..."
git push origin master
npx wrangler pages deploy dist --project-name tpbl-lens --commit-message=<msg> --commit-dirty=true
```

- `dist/` **有被 git 追蹤**，必須 commit（GitHub→Cloudflare 整合會用 repo 內的 dist/）。
- `git push` 後 GitHub Actions/整合會自動部署；`wrangler` 是要「立即生效」時的直傳。兩者皆可。
- 部署屬對外動作 → 推送前先向使用者確認。

---

## Playbook A：建立新賽季

> **🏗️ 重構決策關卡（換季時先評估，再決定要不要照舊流程做）**
> 換季是動架構的天然時機。若這季打算加「歷史賽季並存」或大批新圖表/功能，**先評估是否趁此重構成 TS + 框架（Vite + React/Svelte/Vue）**，而不是繼續在 `championship.js`(~1600行)、`team.js`(~2600行) 這種 `innerHTML` 字串拼接的單檔巨獸上疊。詳見下方[架構演進](#架構演進--技術債換季時評估)。若這季只是延續同樣呈現、純換年度，照本 Playbook 做即可。

新例行賽開打時。核心：把所有「綁賽季」的設定從舊年度碼改到新年度碼（例 `2025-26`→`2026-27`、檔名 `2526`→`2627`）。

### A1. 核心設定 `config.py`
- `SEASON`（line 3）、`SEASON_START`（line 5）、`SEASON_END`（line 6）、`TOTAL_GAMES`（line 4）
- `DIVISION_ID`（line 2）：新賽季 division 可能改，需向 API 確認
- `TEAMS`（line 10-18）：確認球隊增減與隊名
- `ALLGAME_FILE`（line 24）：`data/allgame_2526.txt` → 新年度碼

### A2. 年度碼字串（找 `2025-26` 與 `2025–26`，注意半形 `-` 與 en-dash `–` 兩種）
- `pages/index.html`：lines 4, 5, 9, 10, 18, 19
- `pages/championship.html`：lines 4, 5, 9, 10, 18
- `pages/team.html`：lines 5, 10, 15（`{{TEAM_NAME}}` 模板）
- `pages/calibration.html`：lines 5, 14
- `build.py`：lines 15-21（7 隊 title）、line 25（championship title）
- `generate_og_championship.py`：line 217（頁首）、line 275（冠軍副標）
- `generate_og_pace.py`：line 199（頁首）

### A3. 資料檔 fetch URL（JS 寫死年度碼）
- `js/team.js:30` `/data/${team}_2526.json`
- `js/league.js:33` `/data/league_2526.json`
- `js/championship.js:5` `/data/championship_2526.json`
- `js/calibration.js:6` `/data/calibration_${team}_2526.json`

### A4. 資料檔重建
- 舊 `data/*_2526.json`、`data/calibration_*_2526.json`、`data/league_2526.json`、`data/allgame_2526.txt`、`data/games/*.txt` 視情況保留或清掉。
- 取得新賽季賽程：放新的 `data/allgame_<新碼>.txt`（格式同舊檔，是 schedule 陣列）。
- 執行 `python auto_update.py --force` 抓資料 + 重建。

### A5. 驗證 + 部署
- `python auto_update.py --dry-run` 檢查設定 → `python build.py` → 本機預覽（見下方「本機預覽」）→ 部署。

> **未來改善建議**（可選，非必要）：A2/A3 共約 20 處硬寫年度碼。可重構為由 `config.SEASON` 衍生（build.py 注入、JS 從資料 meta 讀），讓換季趨近「改一處」。要做再跟使用者確認，屬重構不在本 SOP 預設範圍。

---

## Playbook B：進季後賽

**現況**：專案**沒有專屬季後賽頁面**。季後賽目前只反映在：
- 各隊頁 `prob_playoff`（`process_data.py` 產生，`team.js` 顯示進季後賽機率）
- 總覽頁排名前段的 `playoff-cut` 分界線（`league.js`）
- H2H 對戰若超過 6 場代表含季後賽（`team.js` 會加註說明）

**當使用者說「進季後賽」時**，先釐清要呈現什麼，與使用者確認方向：
- **(a) 沿用冠軍賽機制做季後賽系列頁**：`championship.js` 整套是泛用的「7 戰系列賽」引擎（`active_opponent` + `championship_series` 驅動賽前預測→賽中→賽後）。可複製成季後賽系列頁，但季後賽常有多組系列同時進行，需要設計多系列切換。
- **(b) 只在現有頁面強化季後賽資訊**：突顯季後賽機率、對戰組合。

這塊是「屆時要建」的功能，不是既有流程。先和使用者討論範圍再動工。

---

## Playbook C：冠軍賽

冠軍賽頁 `/championship/` 由 `data/championship_2526.json` 驅動，`championship.js` 依**系列賽進度自動切換**三種狀態，無需改程式：

| 狀態 | 條件 | 置頂 `#prediction` | `#g1-prediction` / `#post-series` |
|------|------|--------------------|-----------------------------------|
| 賽前 | `championship_series` 空 | 奪冠機率預測 + G1 效應 + 路徑分佈 | G1 三情境前瞻 |
| 賽中 | 已打 1~6 場、未達 4 勝 | 機率預測（改用系列賽至今數據） | 最近一場回顧 + 下一場前瞻 |
| 賽後 | 任一方 ≥ 4 勝 | **冠軍橫幅**（隊名+總冠軍+比分+賽程點） | 隱藏前瞻，顯示**賽後重點**（轉折故事+每場戰報） |

關鍵函式（`js/championship.js`）：`renderPrediction`（含 `renderChampionBanner` 早退）、`renderPostSeries`、`renderG1Win`、`buildScheduleDots`。
OG 圖 `generate_og_championship.py`：未分勝負畫機率長條；分勝負畫冠軍慶祝版面（`_draw_crown`）。

### C1. 賽前設定
建立/更新 `data/championship_2526.json`（**手動**維護的區塊）：
- `active_opponent`：對手 key（如 `"kings"`）
- `championship_series`：`[]`（空陣列）
- `formosa` / `<opp>`：兩隊例行賽隊伍 block（含 players、scoring、quarter、home/away…）
- `h2h_<opp>`：例行賽對戰（championship.js 顯示用）
- `<team>_mhu` / `<team>_scenario` / `<team>_usg` / `<team>_hm_*` / `<team>_ppp_*`：下半部例行賽分析區塊
- `h2h_<opp>`（頂層）：交手逐場陣列

調整賽程（每年日期/主客場會變）：
- `js/championship.js` `SERIES_GAMES`（約 line 965-972）：7 場的 `date` 與 `home`（`f`=夢主、`o`=對手主）
- `js/championship.js` `SERIES_SCHEDULE`（約 line 964）：`['h','h','a','a','h','a','h']` 主客場序，須與上面一致
- `generate_og_championship.py` `_SCHED_TEMPLATE`（約 line 28-35）：OG 圖的賽程框架日期

### C2. 每場賽後
使用者說「GN 打完了 / 更新冠軍頁」時（本季 G7 已示範一次，流程如下）：

1. **取得該場 game 檔**：找出 game_id（冠軍賽是 8xxx，依序遞增）。
   `data/games/{id}.txt` 不存在時直接抓 API：
   `GET https://api.tpbl.basketball/api/games/{id}/stats`，加上 `game_id`/`game_date` 後存檔（格式同其他 game 檔）。
2. **冠軍賽 game 檔特性**（與例行賽不同，見 `compute_champ_todate.py` 開頭註解）：
   - 隊伍得分要由 `teams.rounds` 四節**合算**（`teams.total.won_score` 已損壞）
   - 球員統計只在 `players.rounds.{Q}` 逐節，需四節合算（`players.total` 無資料）
3. **追加一筆到 `championship_series`**，欄位比照既有條目：
   `game`(G1..G7)、`game_id`、`date`(YYYYMMDD)、`formosa_score`、`opp_score`、`won`、`formosa_home`、`opp_key`、`note`（一句戰報）、`formosa_stats`、`opp_stats`、`q_scores`、`top_performers`。
4. `python build.py`（內部會跑 `compute_champ_todate` 重算 `*_champ*`，並重生 OG）。
5. 本機預覽驗證 → 部署。

> 頁面會自動把賽程點、系列賽現況、機率、回顧/前瞻、（達 4 勝時）冠軍橫幅與賽後重點更新好，**不需改 JS**。

### C3. 系列賽結束（自動）
任一方達 4 勝後，C2 的最後一次 build 就會讓頁面切到冠軍橫幅 + 賽後重點，OG 也切成冠軍慶祝版。通常**不需額外動作**；若要微調文案，看 `renderChampionBanner` / `renderPostSeries`。

---

## 架構演進 / 技術債（換季時評估）

**定位**：TPBL-Lens 是「全聯盟分析平台」，注定持續長大（更多圖表、歷史賽季）。現行純 vanilla JS 目前可行，但有單檔膨脹風險。

**現況與風險**
- `js/championship.js`(~1600 行)、`js/team.js`(~2600 行) 都用 `innerHTML` 字串拼接整頁，是單檔巨獸，難維護、難測試（同類專案 lioneers-web 已踩過此坑）。
- 換季有約 20 處硬寫年度碼（見 Playbook A）。**多賽季並存**（賽季切換、路由、資料版本）在純 JS + 寫死年度下會很痛——這是最該觸發重構的功能。
- 反面：目前「無 node build、`python build.py` 出靜態檔」的簡單性是資產，部署零摩擦。

**建議**
- **觸發時機**：下次大改版，尤其是要做「歷史賽季」時。**不要賽季中為重構而重構**（拿風險換沒有立即收益）。把它當成有預算、有範圍的計畫項目，請 Claude Code 執行。
- **目標**：TS + 框架（Vite + React/Svelte/Vue），型別安全 + 元件化（chart、heatmap、scenario card 抽成可複用元件）；年度碼由單一設定衍生，支援多季路由。
- **低風險踏腳石**（不一定要一次大爆改，可漸進）：①單檔拆成 ES modules ②加 JSDoc 型別檢查（不改語言先抓型別）③抽共用 chart/component 層 ④build.py 從 `config.SEASON` 注入年度、移除硬寫字串。

---

## 本機預覽（驗證用）

`.claude/launch.json` 已設好靜態伺服器（`python -m http.server 8765 --directory dist`）。用 preview 工具 `preview_start` 名稱 `tpbl-lens`，開 `/championship/` 或 `/`，以 `preview_eval` 讀 DOM、`preview_console_logs` 看錯誤、OG 圖直接 Read `dist/og/championship.png`。

## 計算規範
PPP / USG% / TS% 等定義見 `CLAUDE.md`「資料計算規範」，與 `process_data.py`、`compute_champ_todate.py` 一致。
