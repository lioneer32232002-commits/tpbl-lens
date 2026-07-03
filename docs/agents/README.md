# docs/agents/ — AI Session 制度檔

寫於 2026-07-03（Fable 5 session），目的：讓之後任何等級的模型都能穩定作業。入口是 CLAUDE.md 的路由表，本目錄不需要每次全部讀，**按需讀對應檔**：

| 檔案 | 內容 | 什麼時候讀 |
|------|------|-----------|
| `dispatch.md` | 任務分級、subagent 選擇、升降級、驗證不自驗 | 要派工或猶豫要不要派工時 |
| `judgment.md` | 六條判斷 rubric（升級/完成/問人/換路/品質/品味），各附正反例 | 拿不定主意時 |
| `templates.md` | 五種派工 prompt 模板（搜尋/實作/重構/研究/審查） | 派工時直接套 |
| `maintenance.md` | 制度檔的改動權限、勘誤格式、精簡時機 | 想改任何制度檔/memory 前 |
| `letter.md` | 專案的真正目的、最大技術風險、退化預防、交接待辦 | 新接手或大改版前 |
| `diagnosis-2026-07.md` | 當時的 harness 三大問題診斷＋repo 盤點 | 背景參考，通常不用讀 |
| `_backup/` | 改制前的 CLAUDE.md 與 memory 快照 | 永遠不改；需要考古時看 |
