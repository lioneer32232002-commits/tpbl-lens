---
name: 圖表圖例設計原則
description: Chart.js 圖例不用圖示符號，改用彩色文字標籤
type: feedback
originSessionId: c88304ea-b7fd-4936-acb9-7433f8bac071
---
圖例一律用**彩色文字**，不用任何圖示符號（圓圈、方塊、虛線段都不要）。

**Why:** 圖示符號（usePointStyle 的圓圈、預設長形方塊）往往對應不到圖上實際符號，反而造成混淆，也佔版面。文字本身變色就已經傳達意思。

**How to apply:**
1. 所有 Chart.js 圖表設定 `plugins: { legend: { display: false } }`
2. 在 `new Chart(...)` 之後呼叫 `chartLegend(canvas, items)` 插入彩色文字
3. 文字顏色直接用對應 dataset 的 `borderColor` 或 `backgroundColor`

```js
function chartLegend(canvas, items) {
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;flex-wrap:wrap;gap:.3rem 1.2rem;margin-top:.5rem;font-size:.78rem;';
  items.forEach(({ label, color }) => {
    const span = document.createElement('span');
    span.textContent = label;
    span.style.color = color;
    div.appendChild(span);
  });
  canvas.parentNode.insertBefore(div, canvas.nextSibling);
}
```

**文字內容原則：**
- 顏色本身就是說明，不要在文字裡再重複顏色名稱（如「青色 = 低估」→ 改成「低估」就好）
- 形狀描述（虛線、實線）沒辦法靠顏色傳達，可以保留（如「虛線 = 完美校準基準」）
