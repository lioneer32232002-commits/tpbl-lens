# Harness 診斷報告（2026-07-03，由 Fable 5 撰寫）

> 目的：找出本環境最漏 token、最容易失焦、最容易出錯的前三名，供 `docs/agents/` 其他制度檔引用。
> 讀者：未來的 Opus / Sonnet / Haiku session。

## 第 1 名：規則互相矛盾＋記憶過時（最容易「出錯」）

**證據（2026-07-03 查證）：**
- 部署機制曾同時存在三種說法：CLAUDE.md 說「GitHub→Cloudflare 整合會自動部署」；記憶 `project_deployment.md` 說「push 不會自動部署」＋「settings.json 有 PostToolUse hook 自動 deploy」。實查 `.claude/settings.json` 內容為空 `{}`，hook 不存在。
- 推送政策矛盾：CLAUDE.md 說「推送前先向使用者確認」，記憶說「合併後直接 push 不需確認」。
- CLAUDE.md 寫本機路徑 `C:\Users\User\...`，實際是 `C:\Users\oneda\...`。

**為什麼危險：** 弱模型遇到矛盾不會停下來查證，會隨機採信其中一條（通常是最先讀到的），然後行為在 session 之間不一致。

**修法（已執行＋制度化）：**
1. 已修正兩條記憶檔並在其中留「過時說法勘誤」段。
2. 正式政策（2026-07-03 使用者裁決）：**build→commit→push 直接做；`wrangler pages deploy` 前必須先確認**。
3. 裁決順位寫進 CLAUDE.md：**CLAUDE.md ＞ docs/agents/ ＞ memory**；發現任兩處矛盾時，不要猜——先查實際狀態（檔案、git log、settings.json），查得到就當場修正較舊的那份，查不到就問使用者。

## 第 2 名：CLAUDE.md 把「路由」和「內容」混在一起（最容易「失焦」）

**證據：**
- CLAUDE.md 同時放：語言規定、季節 playbook 路由、完整部署指令、H2H 六場比分表、USG%/PPP 公式、球員標記實作細節。後三者只有特定任務才用得到，卻每個 session 都載入。
- 記憶檔與 CLAUDE.md 內容重疊（部署流程兩邊都寫、team IDs 兩邊都有），一改就會分岔——這正是第 1 名問題的成因。

**為什麼危險：** 每次載入的固定內容越長，弱模型越容易抓錯重點；重複內容必然過時分岔。

**修法（本次執行）：** CLAUDE.md 重寫為「精簡路由層」：只放每次都需要的規則（語言、部署政策、裁決順位）＋指向 docs/ 專門檔的路由表。細節內容各自只存在一個地方（single source of truth），CLAUDE.md 標明去哪裡讀。

## 第 3 名：主對話整檔讀大檔、自己掃 repo（最「漏 token」）

**證據：**
- 本 repo 的 `data/*.json`（球隊賽季資料、league、championship）和 `dist/`（build 產物）都是大檔；`data/games/*.txt` 是逐場 box score。弱模型的慣性是直接 `Read` 整檔確認內容，一次就吃掉數千 token，而且 dist/ 是產物根本不該讀。
- 「找某段邏輯在哪」時，弱模型傾向在主對話連續 Read 多個 js/pages 檔案，把中間過程全留在 context。

**修法（制度化，細節見 `dispatch.md`）：**
1. **大 JSON 不整讀**：先 `python -c "import json;d=json.load(open('data/xxx.json',encoding='utf-8'));print(list(d.keys()))"` 看結構，再只抽需要的欄位。
2. **dist/ 永遠不讀不改**——它是 build.py 的輸出。
3. **超過 3 個檔案的搜尋／掃描一律派 Explore agent**，主對話只收結論與 `檔案:行號`。

## 附註：本環境的既有優勢（不要破壞）

- superpowers plugin 的流程 skill（TDD、debugging、verification-before-completion）對弱模型是加分項，制度檔與其相容、不重複造輪子。
- 記憶機制已在運作且品質不錯（有 Why / How to apply 格式），維護協議（`maintenance.md`）沿用此格式。

## 附錄：repo 盤點摘要（2026-07-03，Explore agent 實查）

- **Python 管線**：`auto_update.py`（GitHub Actions 每日跑）→ `fetch_games.py` → `process_data.py`（838 行，核心計算）→ `generate_league.py` → `build.py`（約 170 行，產 dist/ 全站＋OG 圖）。
- **前端**：`js/championship.js`（約 1700–1800 行，最大最複雜）、`team.js`、`league.js`、`calibration.js`、`common.js`；HTML 容器在 `pages/`，共用片段在 `templates/`。
- **docs/superpowers/plans/ 的 5 份計畫檔是歷史紀錄**（phase1–3、校準、Elo 大多已實作），不是待辦。弱模型不要把它們當成「還沒做的事」去執行。
- **CLAUDE.md 路徑錯誤已確認**：舊版寫 `C:\Users\User\...`，實際為 `C:\Users\oneda\...`（重寫版已修正）。
- **`.claude/worktrees/` 有 13 個舊 worktree**（多數已合併），佔 3000+ 檔案，可清理；清理屬破壞性動作，先問使用者。
- **本機預覽**：`.claude/launch.json` 已設定 `python -m http.server 8765 --directory dist`，改前端後可用 preview 工具驗證。
- git 遠端還留著約 8 個舊 PR 分支未刪。
