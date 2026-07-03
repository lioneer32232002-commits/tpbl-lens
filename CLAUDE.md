# TPBL-Lens — Claude Code 工作規範

## 語言（強制）
所有輸出一律**繁體中文**：對話回覆、TodoWrite 內容、AskUserQuestion 的問題與選項、派給 subagent 的 prompt。程式碼、shell 指令、技術名詞可保持英文。禁止簡體中文、日文、韓文。

## 規則裁決順位
**本檔 ＞ docs/ 專門檔 ＞ 專案記憶（memory）**。發現任兩處說法矛盾時：先查實際狀態（檔案內容、git log、`.claude/settings.json`），查得到就當場修正過時的那份並註明日期；查不到就問使用者。**不要默默挑一個採信。** 修正仍受 `docs/agents/maintenance.md` 權限分級約束——要改的若是政策段或判準本文，先問使用者。

## 部署流程（2026-07-03 政策）
```bash
python build.py                    # 重新產生 dist/（內含 compute_champ_todate 與 OG 圖）
git add data/ dist/ <改到的原始檔>  # dist/ 必須 commit——GitHub 整合部署的是 repo 內的 dist/
git commit -m "..."
git push origin master             # 直接做，不需確認
# ↓ 只有要「立即生效」才跑，且跑之前必須先向使用者確認
npx wrangler pages deploy dist --project-name tpbl-lens --commit-message=deploy --commit-dirty=true
```
- **push 免確認；wrangler deploy 要先確認**（對外立即生效的動作）。使用者該次對話已明說「直接部署」則不用再問。
- `dist/` 是 build 產物：不要手動改、不要整檔讀。
- 目前常態是直接在 master 開發；若在 worktree 分支，先回 master merge 再走上面流程。

## 路由表（動手前先讀對應檔）
| 情境 | 讀這個 |
|------|--------|
| 「換季」「進季後賽」「進冠軍賽」「GN 打完了」 | `docs/SEASON_WORKFLOW.md`（Playbook A/B/C） |
| 碰 data/*.json、公式（PPP/USG/TS）、H2H、球員標記 | `docs/DATA_RULES.md` |
| 要派 subagent、選模型、決定任務要不要拆 | `docs/agents/dispatch.md` |
| 拿不定主意：升級？算完成？該問人？該換路？ | `docs/agents/judgment.md` |
| 派工 prompt 直接套模板 | `docs/agents/templates.md` |
| 想修改 CLAUDE.md、docs/、memory | `docs/agents/maintenance.md` |
| 新 session 開場、或接手中斷的工作 | `docs/agents/letter.md` |

## 關鍵路徑
| 類型 | 路徑 |
|------|------|
| 冠軍頁 | `pages/championship.html` + `js/championship.js` + `data/championship_2526.json` |
| 球隊資料 | `data/{slug}_2526.json`（slug 見 `config.py`） |
| 聯盟資料 | `data/league_2526.json` |
| 比賽原始資料 | `data/games/{game_id}.txt`（gitignored） |
| 本機預覽 | `.claude/launch.json` 已設定（http.server 8765 → dist/），用 preview 工具驗證前端改動 |

## 三條鐵律（每個 session 都適用）
1. **大 JSON 不整檔讀**：先 `python -c "...print(list(d.keys()))"` 看結構，再抽需要的欄位（範例見 `docs/DATA_RULES.md`）。
2. **超過 3 個檔案的搜尋／掃描派 Explore subagent**，主對話只收結論與 `檔案:行號`。
3. **宣稱「完成」前要有證據**：build 實跑過、前端用 preview 驗過、或 fresh-context agent 驗收過。驗收標準見 `docs/agents/judgment.md`。
