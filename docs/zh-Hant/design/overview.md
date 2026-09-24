# 套件架構：hikari-components

Hikari 的元件體系只有一個套件 `hikari-components`：以 `rsx!` 撰寫的渲染元件，連同響應式
hooks、型別化 palette class 與 `StyledComponent` CSS。

> **已退役：`hikari-extra-components`。** 該套件曾在渲染元件之外附帶一套框架無關的*資料模型*
> （`TimelineState`、`ZoomControlsState`、`GuideStep`、節點圖模型等），導致同一概念出現兩個同名
> 型別——例如 `TimelinePosition` 在一個套件裡預設 `Left`、在另一個裡預設 `Alternate`。工作區內
> 已無任何依賴，節點圖模型也只被自測引用，故整包刪除。它曾覆蓋的元件都仍在此處：
> `display::{Timeline, DragLayer, UserGuide, ZoomControls}`、
> `production::{VideoPlayer, RichTextEditor, CodeHighlight}`。
