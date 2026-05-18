# Championship OG Image Design

**Date:** 2026-05-18  
**Status:** Approved

## Problem

`championship.html` 有 OG 標題和描述，但缺少 `og:image`。分享到 LINE / FB 時只出現文字，沒有預覽圖，點擊率低。

## Goal

產生一張 1200×630 PNG，分享時呈現冠軍戰的對決感與奪冠預測數字，風格與網站一致。

---

## Layout（1200×630）

```
┌──────────────────────────────────────────────────────────┐
│  🏆  TPBL 2025–26 冠軍戰                                  │ ← header bar, h=52
├──────────────────────────────────────────────────────────┤
│                                                          │
│   ●G1  ●G2  ●G3  ●G4  ○G5  ○G6  ○G7                    │ ← 賽程圓點 (7個)
│  5/24 5/26 5/29 5/31 待定 待定 待定                      │
│                                                          │
│  夢想家                              國王               │ ← 隊名
│  福爾摩沙夢想家                      新北國王            │ ← 全名
│                                                          │
│  30%  ████████████▌█████████████████████████  70%       │ ← 對峙長條
│       ←── 30% ───→|←──────── 70% ──────────→           │
│                   ↑ 白色發光分界線                       │
│                                                          │
│              tpbl-lens.pages.dev                         │ ← 底部品牌
└──────────────────────────────────────────────────────────┘
```

---

## Visual Spec

### 顏色
| 用途 | 色碼 |
|------|------|
| 背景 | `#0f1923` → RGB(15,25,35) |
| 卡片背景 | `#1a2a3a` → RGB(26,42,58) |
| 夢想家（青） | `#00e5ff` → RGB(0,229,255) |
| 國王（金） | `#ffd700` → RGB(255,215,0) |
| 主文字 | `#e8edf2` → RGB(232,237,242) |
| 次要文字 | `#8fa3b8` → RGB(143,163,184) |

### Header Bar（y=0..52）
- 背景：`#111e2b`（略深於 bg2）
- 左側：🏆 + "TPBL 2025–26 冠軍戰"，18px bold
- 右側："tpbl-lens.pages.dev"，13px，TEXT2 色

### 賽程圓點（7個，直徑 62px）
- 水平置中，圓點間距 16px，圓點群 y 中心 ≈ 155
- G1、G2（home='f'，夢主場）：fill=青色×15%透明，outline=青色，width=2
- G3、G4（home='o'，客場）：fill=金色×15%透明，outline=金色，width=2
- G5–G7（tbd=True）：fill=白色×3%，outline=白色×20%，width=1，虛線效果（手繪8段）
- 圓點內文字：label（G1…），date（5/24… 或 待定），TEXT2 色

### 中段：隊名 + 數字（y ≈ 220..390）
- 夢想家方（左 1/4 區域，x 中心 ≈ 240）
  - 短名「夢想家」：28px bold，青色，y≈230
  - 全名「福爾摩沙夢想家」：16px，TEXT2，y≈268
- 國王方（右 1/4 區域，x 中心 ≈ 960）
  - 短名「國王」：28px bold，金色，y≈230
  - 全名「新北國王」：16px，TEXT2，y≈268
- 百分比數字（在對峙條上方）
  - "30%"：青色，80px bold，x≈240，y≈295
  - "70%"：金色，80px bold，x≈960，y≈295

### 對峙長條（核心視覺）
- 條高 28px，圓角 14px，y 中心 ≈ 410，左右 margin 各 80px
- 可用寬度：1200 - 160 = 1040px
- 左段（夢想家 30%）：寬 1040×0.3 = 312px，青色填滿，含右發光
- 右段（國王 70%）：寬 1040×0.7 = 728px，金色填滿，含左發光
- 分界線：x=80+312，白色，高 44px（比條高多 8px 上下各 4px），寬 2px，白色外發光（GaussianBlur 疊加）
- 發光實作：在獨立黑底圖層畫白線，GaussianBlur(radius=6)，以 Screen 模式合成

### 底部品牌（y ≈ 580）
- "TPBL-Lens · tpbl-lens.pages.dev"，14px，TEXT2，水平置中

---

## Data Source

從 `data/championship_2526.json` 讀取：
- `formosa.short`、`formosa.name`、`kings.short`、`kings.name`
- `formosa.color`（`#00e5ff`）、`kings.color`（`#ffd700`）
- 奪冠機率複刻 JS 邏輯（hardcode fPct=30, oPct=70，或 build 時計算）

賽程資料 hardcode（與 JS 一致）：
```python
SERIES_GAMES = [
    {'label': 'G1', 'date': '5/24', 'home': 'f', 'tbd': False},
    {'label': 'G2', 'date': '5/26', 'home': 'f', 'tbd': False},
    {'label': 'G3', 'date': '5/29', 'home': 'o', 'tbd': False},
    {'label': 'G4', 'date': '5/31', 'home': 'o', 'tbd': False},
    {'label': 'G5', 'date': '待定',  'home': 'f', 'tbd': True},
    {'label': 'G6', 'date': '待定',  'home': 'o', 'tbd': True},
    {'label': 'G7', 'date': '待定',  'home': 'f', 'tbd': True},
]
```

奪冠機率：`fPct=30, oPct=70`（hardcode，與目前網站一致）

---

## File Changes

| 檔案 | 動作 |
|------|------|
| `generate_og_championship.py` | **新增**：Pillow 圖像產生器 |
| `build.py` | 修改 `_build_og_images()` 加入呼叫 |
| `pages/championship.html` | 加入 `og:image` + `twitter:image` meta tag |

輸出路徑：`dist/og/championship.png`  
OG URL：`https://tpbl-lens.pages.dev/og/championship.png`

---

## Font Strategy

Windows 本機：`msjhbd.ttc`（粗體）、`msjh.ttc`（一般）  
CI / Cloudflare build：優雅降級，`ImageFont.load_default()`

---

## Out of Scope

- 動態產生（依當前系列賽比分更新圓點狀態）
- 其他頁面的 OG 圖
- 響應式或多解析度版本
