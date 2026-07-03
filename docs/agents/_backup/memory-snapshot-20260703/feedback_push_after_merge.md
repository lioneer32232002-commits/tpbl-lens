---
name: 合併後直接推送並部署
description: 合併 feature branch 回 master 之後，直接 git push 然後執行 wrangler pages deploy，不需要另外詢問
type: feedback
originSessionId: c88304ea-b7fd-4936-acb9-7433f8bac071
---

每次改完功能，立即執行：
1. 在 worktree commit 變更
2. 合併回 master
3. `git push origin master`
4. `npx wrangler pages deploy dist --project-name tpbl-lens`

不需要先問使用者，四步都要做。

**Why:** push 到 GitHub 不會自動觸發 Cloudflare Pages 部署；wrangler deploy 才是真正更新線上網站的步驟。使用者明確說「改完都直接推上去」。

**How to apply:** 任何功能修改完成後，直接走完整流程，不需要等待確認。
