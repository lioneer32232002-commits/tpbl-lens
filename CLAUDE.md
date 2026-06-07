# TPBL-Lens — Claude Code 工作規範

## 語言規定
所有回覆、選項、說明**一律使用繁體中文**。程式碼、shell 指令、技術名詞可保持英文。

---

## 賽季階段 Playbook（換季 / 換階段）

完整 SOP 見 **[`docs/SEASON_WORKFLOW.md`](docs/SEASON_WORKFLOW.md)**。使用者用一句話觸發，依該檔對應 Playbook 執行：

| 使用者說 | 動作 |
|----------|------|
| 「建立新賽季」「換季」 | Playbook A — 改年度碼（config + 約 20 處硬寫字串/檔名）、重建資料 |
| 「進季後賽」 | Playbook B — 目前無專屬頁面，先與使用者確認要呈現什麼 |
| 「進冠軍賽」 | Playbook C-1 — 建立 `championship_25xx.json` 賽前資料、調賽程日期 |
| 「GN 打完了 / 更新冠軍頁」 | Playbook C-2 — 抓 game 檔、追加 `championship_series`、build、部署 |

冠軍頁 `championship.js` 依系列賽進度（空 / 進行中 / 任一方≥4勝）**自動切換**賽前預測 → 賽中前瞻 → 冠軍橫幅＋賽後重點，多數情況不需改 JS。

---

## 部署流程

本機工作目錄為 `C:\Users\User\OneDrive\02_創作\14_AI TEST\tpbl_lens`，目前多直接在 `master` 開發。改檔後：

```bash
python build.py
git add data/ dist/ <改到的原始檔>
git commit -m "..."
git push origin master
npx wrangler pages deploy dist --project-name tpbl-lens --commit-message=deploy --commit-dirty=true
```

**重點**：
1. `python build.py` — 重新產生 dist/（內部會跑 compute_champ_todate 與 OG 產生）
2. `git add dist/ && git commit` — **必須把新 dist/ commit 進 git**，否則 GitHub 推上去的是舊版
3. `git push` — 推到 GitHub（GitHub→Cloudflare 整合會自動部署）
4. `wrangler deploy` — 要「立即生效」時的直傳（可選）

> ⚠️ 步驟 2 不可省略：dist/ 被 git 追蹤，GitHub 整合會用 repo 內的 dist/ 部署。
> 註：若是在 worktree 分支（`.claude/worktrees/<branch>`）開發，先回 master `git merge <branch>` 再跑上面流程；直接在 master 改則略過 merge。
> 部署屬對外動作，推送前先向使用者確認。

---

## 關鍵路徑

| 類型 | 路徑 |
|------|------|
| 冠軍頁 HTML | `pages/championship.html` |
| 冠軍頁 JS | `js/championship.js` |
| 冠軍頁資料 | `data/championship_2526.json` |
| 球隊賽季資料 | `data/{slug}_2526.json`（slug：formosa/lions/aquas/leopards/braves/kings/warriors） |
| 聯盟資料 | `data/league_2526.json` |
| 比賽原始資料 | `data/games/{game_id}.txt`（JSON 格式，gitignored） |
| 部署目標 | `dist/`（由 build.py 產生，不要直接手動修改） |
| 換季 / 換階段 SOP | `docs/SEASON_WORKFLOW.md` |

---

## Worktree 工作慣例

- 所有功能開發在 worktree 分支進行（`claude/magical-snyder-a11061` 等）
- worktree 路徑：`.claude/worktrees/<branch-name>/`
- 修改完成 → commit worktree → 到主目錄 merge → push（觸發自動部署）

---

## 資料計算規範

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
直接使用 game file 中的 `tsp` 欄位（API 已計算好）。

---

## 冠軍頁資料來源

`championship_2526.json` 中所有 `h2h_*` 區塊資料**必須來自 6 場 H2H 對戰**：

| Game ID | 日期 | 主客場 | 比數 |
|---------|------|--------|------|
| 1372 | 2025-10-12 | 國王主 | Kings 112 - Formosa 93 |
| 1392 | 2025-11-12 | 國王主 | Kings 94 - Formosa 91 |
| 1431 | 2026-01-17 | 夢想家主 | Formosa 116 - Kings 96 |
| 1439 | 2026-01-31 | 夢想家主 | Formosa 97 - Kings 114 |
| 1468 | 2026-03-27 | 夢想家主 | Formosa 107 - Kings 90 |
| 1487 | 2026-04-24 | 國王主 | Kings 105 - Formosa 99 |

Team IDs: Formosa = 3, Kings = 7

---

## 在籍球員標記

- `active: false` 表示已離隊，**熱力圖顯示為灰色**
- `buildActiveMap()` 讀取 `D.{team}.players`（頂層 players 陣列），不是 h2h 子物件
- 如果球員不在 `players` 陣列，預設視為在籍（undefined !== false = true）
- 離隊球員務必加入頂層 `players` 陣列並設 `active: false`
