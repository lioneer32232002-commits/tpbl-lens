---
name: Code review process - seal team workflow
description: After each task, group related files and dispatch reviewer subagents per group; captain consolidates and records fix principles; reviewer fixes; captain re-checks
type: feedback
originSessionId: 28d25d19-2758-4ee3-abfd-777d243a8f80
---
每個小任務完成後，立即執行「海豹小隊」審查流程，不要等整個階段做完才審查。

**流程：**
1. 把本次修改的檔案按邏輯分組（例如：config/tests 一組、API client 一組、data processing 一組）
2. 每組派一個 reviewer subagent 去審查：有沒有寫錯、邏輯是否合理
3. 各組 reviewer 回報給隊長（主 session 的 Claude）
4. 隊長整理所有問題，歸納修復原則，並存入 memory
5. 派 subagent 去修復
6. 隊長最後再確認

**Why:** 避免整個專案做完才發現累積一堆小錯誤。早發現早修復，同時把原則記下來讓之後的任務不再犯同樣的錯。

**How to apply:** subagent-driven-development 的每個 task 完成後，在進行 spec review 和 code quality review 之前，先跑這個分組審查流程。
