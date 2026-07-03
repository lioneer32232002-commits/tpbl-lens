---
name: Cloudflare Pages 部署流程
description: tpbl-lens 透過 wrangler CLI 部署；git push 後由 Claude Code hook 自動觸發
type: project
originSessionId: 239c7de2-148c-4511-a79c-d438e47cd823
---
tpbl-lens 使用 `wrangler pages deploy dist --project-name tpbl-lens` 部署到 Cloudflare Pages，**不是** GitHub 自動部署。

**Why:** 專案沒有 wrangler.toml，Cloudflare Pages 透過 wrangler CLI 直接上傳 dist/ 資料夾。

**Hook 設定（已生效）:** `.claude/settings.json` 中有 PostToolUse hook，偵測到 `git push` 後自動執行 deploy，不需要手動跑指令。hook 為 async，背景執行。

**手動部署備用指令:**
```bash
cd "C:\Users\oneda\OneDrive\02_創作\14_AI TEST\tpbl_lens"
npx wrangler pages deploy dist --project-name tpbl-lens
```
