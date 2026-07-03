# 給未來 session 的信

> 寫於 2026-07-03，Fable 5。這封信講三件使用者沒問、但對這個環境最重要的事，以及這套制度最可能的死法。

## 三件最重要的事

### 1. 這個專案的目的是 pitch，不是網站本身
tpbl-lens 是 Adam 拿來向 TPBL 球團（首選夢想家）爭取資料分析工作的作品集。這改變決策的權重：**「拿得出手的品質」＞「功能數量」**；一個錯的數字（球團的人一眼會看出來）比一個醜的版面嚴重十倍。所有公式與資料改動，對照 `docs/DATA_RULES.md` 驗過再出手。日常維運（賽後更新）要維持接近零成本——這是他偏好 one-command workflow 的原因，不要把日常流程弄複雜。

### 2. 最大的技術風險是 `js/championship.js`（約 1800 行 vanilla JS）
git 歷史裡 fix 類 commit 佔了一半以上，多數是前端回歸。commit 391e70c 已記錄共識：**下次大改版或做歷史賽季功能時，重構成 TS＋框架**；在那之前不要提前重構（現在能動就是資產），但也不要再往裡面堆大功能。要堆之前，先觸發那次重構，並用 `templates.md` 的重構模板＋Plan agent 來做。

### 3. 賽季轉換是最容易出錯的時刻
賽季碼 `2526` 硬寫在約 20 處（檔名、config、JS）。換季時**只走 `docs/SEASON_WORKFLOW.md` 的 Playbook A**，不要即興發揮；做完順跑 `maintenance.md` 第五節的制度體檢。冠軍頁 `championship.js` 會依系列賽進度自動切換三種模式，多數情況不需要改 JS——先確認資料，再懷疑程式。

## 這套制度最可能的退化方式（與預防）

1. **CLAUDE.md 又長回去**：每個 session「順手加一條」，半年後回到大雜燴，路由層失效。→ 預防：80 行上限（見 maintenance.md），想加內容先想「這是不是該放進 docs/ 專門檔＋一行路由」。
2. **雙份內容再度分岔**：有人把 DATA_RULES 的公式抄回 CLAUDE.md 或 memory「方便查」，之後只改了一邊。→ 預防：改動前先 Grep 同內容（maintenance.md 第二節）；發現重複就地消滅一份。
3. **制度檔沒人讀**：弱模型跳過路由表直接動手。→ 自我檢查訊號：如果你已經改了三個檔案還沒讀過任何 docs/ 檔，停下來回去讀。
4. **判準教條化**：把「驗證不自驗」套在改一行 CSS 上，token 燒在儀式感。→ dispatch.md 的任務分級（S 級直接做）就是為了擋這個；制度是為了省力，感覺在增加力氣時回頭查分級。

## 交接與待辦（使用者未裁決，動手前先問）

- `.claude/worktrees/` 有 13 個舊 worktree（3000+ 檔案），git 遠端還有約 8 個舊 PR 分支——皆可清理，屬破壞性動作，先問。
- `docs/superpowers/plans/2026-05-12-phase2-frontend.md` 與 `phase3-league-analytics.md` 目前是 untracked（git status 可見），內容是歷史計畫，建議 commit 進 repo 存檔。
- 本制度檔（docs/agents/、DATA_RULES.md、新 CLAUDE.md）撰寫當下尚未 commit——依部署政策 commit＋push 即可（不含 wrangler）。

## 誠實條款：這套制度救不了什麼

拆解、驗證、多樣本評審能補「執行品質」；補不了「模糊題與品味」——視覺好不好看、pitch 有沒有說服力、分析洞見值不值錢。遇到這類題：給選項讓使用者挑、或明說判斷不可靠（judgment.md 第六節）。另外，主對話的模型與 effort 由使用者設定，模型自己換不了——真的需要更強的腦，開口請使用者換模型，不要假裝做得到。
