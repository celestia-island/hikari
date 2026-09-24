# 包架构：hikari-components

Hikari 的组件体系只有一个包 `hikari-components`：以 `rsx!` 编写的渲染组件，连同响应式
hooks、类型化 palette class 与 `StyledComponent` CSS。

> **已退役：`hikari-extra-components`。** 该包曾在渲染组件之外附带一套框架无关的*数据模型*
> （`TimelineState`、`ZoomControlsState`、`GuideStep`、节点图模型等），导致同一概念出现两个同名
> 类型——例如 `TimelinePosition` 在一个包里默认 `Left`、在另一个包里默认 `Alternate`。工作区内
> 已无任何依赖，节点图模型也只被自测引用，故整包删除。它曾覆盖的组件都仍在此处：
> `display::{Timeline, DragLayer, UserGuide, ZoomControls}`、
> `production::{VideoPlayer, RichTextEditor, CodeHighlight}`。
