---
name: tpbl-lens project context
description: Key facts about the tpbl-lens TPBL全聯盟分析平台 project — paths, team IDs, API, architecture
type: project
originSessionId: 28d25d19-2758-4ee3-abfd-777d243a8f80
---
tpbl-lens 是從 lioneers-web 重構的全聯盟中性分析平台，以 pitch 夢想家（首選）為目標。

**Why:** 建立作品集：「已做全聯盟平台，並對貴隊做最深度分析」

**How to apply:** 所有實作均在 tpbl_lens 目錄；不動 lioneers-web repo。

## Paths
- Working dir: `C:\Users\oneda\OneDrive\02_創作\14_AI TEST\tpbl_lens`
- lioneers-web (參考用): `C:\Users\oneda\OneDrive\02_創作\14_AI TEST\lioneers-web`
- Design doc: `docs/superpowers/specs/2026-05-12-tpbl-lens-design.md`
- Phase 1 plan: `docs/superpowers/plans/2026-05-12-phase1-data-pipeline.md`

## TPBL Team IDs (2025-26, division_id=9)
| ID | Name | Slug | Full Depth |
|---|---|---|---|
| 2 | 高雄全家海神 | aquas | No |
| 3 | 福爾摩沙夢想家 | formosa | Yes |
| 4 | 新竹御嵿攻城獅 | lions | Yes |
| 5 | 桃園台啤永豐雲豹 | leopards | No |
| 6 | 新北中信特攻 | braves | No |
| 7 | 新北國王 | kings | No |
| 8 | 臺北台新戰神 | warriors | No |

## API
- Base: `https://api.tpbl.basketball/api`
- `GET games/{id}/stats` → game box score
- `GET games/stats/teams?division_id=9` → all-team aggregate
- Schedule bootstrapped from lioneers-web `data/20260402_allgame.txt` → `data/allgame_2526.txt`

## Architecture (Phase 1)
- `config.py` — team IDs, slugs, constants
- `fetch_games.py` — API client, cache to `data/games/{game_id}.txt`
- `process_data.py --team-id N` → `data/{slug}_2526.json`
- `generate_league.py` → `data/league_2526.json`
- `auto_update.py` — orchestrates all 7 teams
- GitHub Actions cron 22:30 CST (14:30 UTC)

## Four Implementation Phases
- Phase 1: 資料管線 ← current
- Phase 2: 架構重構 (build.py template, frontend pages)
- Phase 3: 聯盟層級分析 (clustering, matchup matrix)
- Phase 4: 校準頁面 /formosa/calibration

## Hosting
- Cloudflare Pages: `tpbl-lens.pages.dev`
- GitHub repo: `tpbl-lens` (new, separate from lioneers-web)
- Build command: 留空; Output dir: `dist`
