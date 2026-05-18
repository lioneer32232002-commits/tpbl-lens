# TPBL-Lens — Claude Code 工作規範

## 語言規定
所有回覆、選項、說明**一律使用繁體中文**。程式碼、shell 指令、技術名詞可保持英文。

---

## 部署流程（一條龍，不可跳步）

修改任何檔案後，必須用以下**單一指令**完成：

```bash
cd "C:\Users\oneda\OneDrive\02_創作\14_AI TEST\tpbl_lens" && git merge claude/magical-snyder-a11061 && python build.py && git add dist/ && (git diff --cached --quiet || git commit -m "build: update dist") && git push origin master && npx wrangler pages deploy dist --project-name tpbl-lens --commit-message=auto-deploy
```

**順序說明**：
1. `git merge` — 合併 worktree 變更到 master
2. `python build.py` — 重新產生 dist/
3. `git add dist/ && git commit` — **必須把新 dist/ commit 進 git**，否則 GitHub 推上去的是舊版
4. `git push` — 推到 GitHub（含正確的 dist/）
5. `wrangler deploy` — 直接部署 dist/ 到 Cloudflare

> ⚠️ 步驟 3 不可省略：dist/ 被 git 追蹤，GitHub 整合會用 repo 內的 dist/ 部署，跳過這步就會看到舊版本。

---

## 關鍵路徑

| 類型 | 路徑 |
|------|------|
| 冠軍頁 HTML | `pages/championship.html` |
| 冠軍頁 JS | `js/championship.js` |
| 冠軍頁資料 | `data/championship_2526.json` |
| 球隊賽季資料 | `data/team_*.json` |
| 比賽原始資料 | `data/games/{game_id}.txt`（JSON 格式） |
| 部署目標 | `dist/`（由 build.py 產生，不要直接手動修改） |

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
