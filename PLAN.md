# Hikari 组件库 1:1 复刻计划 (Phase 2)

> **目标**: 将 hikari-legacy 的全部组件、样式、行为完整复刻到 current (Tairitsu WASI Component 架构)
>
> **Legacy**: `../hikari-legacy` (Dioxus + wasm-bindgen/web-sys)
> **Current**: `/mnt/sdb1/hikari` (Tairitsu + WASI Component)

---

## 用户决策记录

| # | 问题 | 决策 |
|---|------|------|
| D1 | Platform API stubs | 等 tairitsu WIT 成熟后再接入 |
| D2 | Extra 组件渲染层 | **全部补渲染层** |
| D3 | 表单验证系统 | **不恢复** |
| D4 | i18n 系统 | **恢复 Rust 侧 i18n** |
| D5 | CSS 颜色差异 | **全部回退到 legacy 值** |
| D6 | Website 复刻深度 | **完整 1:1 复刻** |
| D7 | CSS 动画回退 | **不使用 CSS 回退，保留 platform API 调用** |
| D8 | packages/icons crate | **不恢复**（icons 功能由其他机制覆盖） |
| D9 | packages/render-service | **不恢复**（由 tairitsu server 基础设施覆盖） |
| D10 | packages/components/tests/ | **用 tairitsu VNode 方式重写等价测试** |
| D11 | utils/form/ 验证系统 | **维持不恢复 (D3)** |
| D12 | Website 缺失 demo 页面 | **全部恢复** |
| D13 | 被删除的 Props 字段 | **不恢复**（经核实：Props 字段实际未丢失，current 是 legacy 的超集） |
| D14 | Legacy docs/ 文档 | **不恢复** |

---

## 审计结论

### Props 字段审计 (D13)

经逐文件对比 10 个组件（background, search, sidebar×4, menu×3, timeline×2, number_input, auto_complete, tag, comment, empty），**Props 字段在 legacy 和 current 间完全一致**。current 甚至添加了新字段（如 `glow`, `glow_intensity`）。行数差异来自：

- `#[derive(Props)]` + `impl Default` 被 `#[define_props]` + `#[default]` 替代
- Doc comments 被精简
- Dioxus API 迁移（`Signal::read()` → `Signal::get()` 等）

**结论：无需恢复任何 Props 字段。**

### 实际差距分类

| 类别 | 描述 | 数量 | 行为 |
|------|------|------|------|
| **A. 平台 API 依赖** | 渲染逻辑依赖 tairitsu 尚未实现的 WIT 接口 | 4 | 添加 `data-*` 属性 + TODO 注释，等 WIT |
| **B. 结构性简化** | render 函数被简化为 stub，但无平台 API 依赖 | 6 | 直接补全渲染逻辑 |
| **C. 测试缺失** | Dioxus rsx! 渲染测试被删除 | 9 | 用 tairitsu VNode 重写 |
| **D. Website 页面缺失** | Demo 页面和组件基础设施文件 | ~30 | 用 tairitsu VNode 重写 |

---

## Phase 7: Extra Components 渲染层补全 ✅

### 7A: 平台 API 依赖类 ✅

| # | 文件 | 状态 |
|---|------|------|
| 1 | `extra/code_highlighter.rs` | ✅ `data-*` 属性 + platform stub |
| 2 | `extra/rich_text_editor.rs` | ✅ `data-command` + `data-contenteditable` |
| 3 | `extra/video_player.rs` | ✅ Fullscreen + progress bar + `data-action` |
| 4 | `extra/audio_waveform.rs` | ✅ 合成波形 fallback |

### 7B: 结构性简化类 ✅

| # | 文件 | 状态 |
|---|------|------|
| 5 | `node_graph/canvas.rs` | ✅ Bezier paths + minimap + undo/redo/save/load controls |
| 6 | `node_graph/node.rs` | ✅ Minimized icon + conditional body + separate ports |
| 7 | `node_graph/plugins/*` | ✅ `render_body()` default method + InputNode override |
| 8 | `extra/video_player.rs` | ✅ Fullscreen button + progress bar |

---

## Phase 8: 组件测试重写 (D10)

将 legacy 的 9 个测试文件（1920 行）从 Dioxus rsx! 迁移到 tairitsu VNode。

| # | Legacy 测试文件 | Legacy 行数 | 测试内容 |
|---|----------------|-----------|---------|
| 1 | `tests/basic_components_tests.rs` | 125 | Button, Input, Checkbox, Radio, Switch, Badge, Card, Divider, Image, FileUpload, Slider, Select, Textarea, DatePicker, Canvas |
| 2 | `tests/collapse_tests.rs` | 76 | Collapse 组件展开/折叠 |
| 3 | `tests/data_components_tests.rs` | 324 | Table, Tree, Pagination, Selection, Sort, Filter, VirtualScroll, Cell, Column, Node, Drag |
| 4 | `tests/feedback_components_tests.rs` | 152 | Alert, Toast, Tooltip, Modal, Progress, Spin, Drawer, Popover |
| 5 | `tests/feedback_layer2_tests.rs` | 268 | Glow, Portal, ScrollbarContainer |
| 6 | `tests/feedback_remaining_tests.rs` | 370 | QRCode, Skeleton, Tag, Timeline, UserGuide, Empty, Comment, ZoomControls |
| 7 | `tests/form_utility_tests.rs` | 153 | FormField, Form state (D3: 不恢复) |
| 8 | `tests/navigation_components_tests.rs` | 444 | Menu, SubMenu, MenuItem, Sidebar, Tabs, Breadcrumb, Anchor, Stepper, Steps |
| 9 | `tests/mod.rs` | 8 | 模块声明 |

#### 实施策略

- **跳过 #7** (form_utility_tests.rs, D3 决策)
- **实际需要重写: 8 个文件, ~1767 行**
- 每个 test 函数从 `rsx! { Component { props } }` 改为 `render_component(ComponentProps { ... })` → 返回 `VNode` → 断言结构
- 利用 current 已有的 `tairitsu_vdom` 断言工具
- 测试应验证：组件能渲染、DOM 结构正确、关键属性存在

#### 任务分解

| Task | 文件 | 估计行数 | 依赖 |
|------|------|---------|------|
| 8-1 | `tests/mod.rs` + `basic_components_tests.rs` | ~125 | 无 |
| 8-2 | `tests/collapse_tests.rs` | ~76 | 无 |
| 8-3 | `tests/data_components_tests.rs` | ~324 | 无 |
| 8-4 | `tests/feedback_components_tests.rs` | ~152 | 无 |
| 8-5 | `tests/feedback_layer2_tests.rs` | ~268 | 无 |
| 8-6 | `tests/feedback_remaining_tests.rs` | ~370 | 无 |
| 8-7 | `tests/navigation_components_tests.rs` | ~444 | 无 |

---

## Phase 9: Website 1:1 复刻 (D12)

### 9A: 缺失的组件基础设施（12 文件, ~4035 行）

这些是 website 使用的共享 UI 组件/工具，需要从 Dioxus 迁移到 tairitsu VNode。

| # | 文件 | 行数 | 描述 | 迁移难度 |
|---|------|------|------|---------|
| 1 | `components/code_block.rs` | 83 | 代码块渲染器（语言标签 + pre/code） | **低** |
| 2 | `components/doc_components.rs` | 101 | Section/PropsTable/ExampleCard 文档辅助组件 | **低** |
| 3 | `components/page_layout.rs` | 103 | DemoSection + PageContainer 布局包装 | **低** |
| 4 | `components/top_nav.rs` | 110 | 顶部导航栏（品牌 + GitHub + 三个 tab） | **中** — 需适配 SPA router |
| 5 | `components/aside_footer.rs` | 447 | 主题切换 + 语言切换（Popover + Menu） | **高** — 依赖 i18n + theme context |
| 6 | `components/layout.rs` | 353 | 主布局（Header + Aside + BreadcrumbNav） | **中** — 需适配 SPA router |
| 7 | `components/sidebar.rs` | 743 | 侧边栏导航（Menu/SubMenu/MenuItem 树） | **高** — 路由高亮 + 滚动保持 |
| 8 | `components/doc_page.rs` | 132 | 动态文档页（fetch markdown → render） | **中** — 需 fetch API |
| 9 | `components/dynamic_markdown.rs` | 69 | 简化版 markdown 渲染器 | **低** |
| 10 | `components/markdown_renderer.rs` | 366 | 完整 Markdown→VDOM 渲染器 (pulldown-cmark) | **中** — 含自定义 code block |
| 11 | `components/sidebar_tree.rs` | 408 | 早期版 Tree 导航（已被 sidebar.rs 替代） | **低** — 可跳过 |
| 12 | `components/registry.rs` | 1,543 | **核心**：组件 demo 注册表 (~150+ demo arms) | **极高** — 需逐个适配 |

### 9B: 缺失的页面文件（~18 文件, ~1,432 行）

| # | 文件 | 行数 | 描述 |
|---|------|------|------|
| 1 | `pages/animation_demo.rs` | 347 | 动画预设演示（glow/neon/tech/transition） |
| 2 | `pages/demos/showcase.rs` | 111 | Demos 总览页（4 张 demo 卡片） |
| 3 | `pages/demos/layer1/form_demo.rs` | 113 | 登录表单 demo |
| 4 | `pages/demos/layer2/dashboard_demo.rs` | 106 | 数据看板 demo |
| 5 | `pages/demos/layer3/video_demo.rs` | 68 | 视频/音频播放器 demo |
| 6 | `pages/demos/mod.rs` | 10 | 模块声明 |
| 7 | `pages/demos/layer1/mod.rs` | 7 | 模块声明 |
| 8 | `pages/demos/layer2/mod.rs` | 7 | 模块声明 |
| 9 | `pages/demos/layer3/mod.rs` | 7 | 模块声明 |
| 10 | `pages/components/layer1/mod.rs` | 5 | 空模块（已迁移到 Markdown 驱动） |
| 11 | `pages/components/layer2/mod.rs` | 7 | Layer2 模块声明 |
| 12 | `pages/components/layer2/overview.rs` | 34 | Layer2 概览页 |
| 13 | `pages/components/layer3/mod.rs` | 7 | Layer3 模块声明 |
| 14 | `pages/components/layer3/overview.rs` | 34 | Layer3 概览页 |
| 15 | `hooks.rs` | 128 | i18n hook 系统（LanguageContext + use_language + use_i18n） |
| 16 | `paths.rs` | 152 | 静态资源路径配置 |
| 17 | `debug_icons.rs` | 59 | 图标调试工具 |
| 18 | `test_icon_debug.rs` | 70 | 图标渲染测试 |

### 9C: Website 迁移策略

#### 关键决策：SPA Router 适配

Legacy 使用 Dioxus Router（~50+ 路由，`/:lang` 前缀）。Current 使用 JS SPA router（所有页面同时渲染，JS 切换 `.is-active`）。

**策略**: 保持 current 的 SPA router 架构，将缺失的页面作为新的 `.hikari-page` div 添加到 `app.rs` 中。

#### 实施顺序

```
9C-1: 基础设施 (Phase 9A 低难度)
  ├─ code_block.rs
  ├─ doc_components.rs
  ├─ page_layout.rs
  └─ dynamic_markdown.rs

9C-2: i18n 基础
  └─ hooks.rs (LanguageContext + use_language/use_i18n)

9C-3: 导航系统
  ├─ top_nav.rs (适配 SPA router)
  ├─ sidebar.rs (适配 SPA router + route 高亮)
  ├─ aside_footer.rs (theme toggle + language switcher)
  └─ layout.rs (Header + Aside + Breadcrumb)

9C-4: 文档系统
  ├─ doc_page.rs (markdown fetch + render)
  ├─ markdown_renderer.rs (pulldown-cmark → VNode)
  └─ paths.rs (静态资源路径)

9C-5: 组件注册表 (最大工作量)
  └─ registry.rs (1,543 行, ~150+ demo arms)

9C-6: 页面恢复
  ├─ animation_demo.rs
  ├─ demos/ (showcase + form_demo + dashboard_demo + video_demo + mod.rs ×4)
  └─ components/ (layer2/layer3 overview + mod.rs ×4)

9C-7: 调试工具
  ├─ debug_icons.rs
  └─ test_icon_debug.rs
```

---

## Phase 10: 验证与收尾

- [ ] `cargo test --workspace` 全部通过
- [ ] `cargo clippy --workspace` 无警告
- [ ] Website 所有页面可访问且渲染正确
- [ ] 所有 SCSS 样式与 legacy 一致
- [ ] 无新增 `unimplemented!()` 或 `todo!()` (除标注 WIT 依赖外)

---

## 已知外部依赖（阻塞项）

| 依赖 | 影响组件 | 状态 |
|------|---------|------|
| tairitsu WIT: clipboard | CodeHighlighter copy | `data-*` hook 已就绪 |
| tairitsu WIT: exec_command | RichTextEditor | `data-command` 已就绪 |
| tairitsu WIT: request_fullscreen | VideoPlayer | `data-action` 已就绪 |
| tairitsu WIT: AudioContext | AudioWaveform | 合成波形 fallback 已就绪 |
| tairitsu WIT: matchMedia | prefers_reduced_motion | 等待 tairitsu |
| tairitsu WIT: ResizeObserver | ScrollbarContainer | 等待 tairitsu |
| tairitsu WIT: MutationObserver | ScrollbarContainer | 等待 tairitsu |
| tairitsu WIT: set_timeout | Modal/Portal 动画 | stub 返回 0 |
| tairitsu WIT: get_bounding_client_rect | Select/Popover/Tooltip | stub 返回 None |
| tairitsu WIT: request_animation_frame | Portal 动画 | stub 为 no-op |
| tairitsu WIT: element_from_point | Dropdown/Popover | stub 返回 None |

---

## 工作量估算

| Phase | 任务数 | 估计行数 | 依赖外部 |
|-------|--------|---------|---------|
| Phase 7A | 4 | ~50 | WIT (已就绪) |
| Phase 7B | 4 | ~400 | 无 |
| Phase 8 | 7 | ~1,767 | 无 |
| Phase 9A | 12 | ~4,035 | 无 |
| Phase 9B | 18 | ~1,432 | 无 |
| **总计** | **45** | **~7,684** | |

---

## 统计

| 指标 | 值 |
|------|-----|
| 需恢复的组件测试文件 | 8 (跳过 1) |
| 需恢复的 website 组件文件 | 12 |
| 需恢复的 website 页面文件 | 18 |
| 需补全的 extra render 函数 | 10 |
| 平台 API 阻塞项 | 11 (已有 data-* fallback) |
| 估计新增/修改行数 | ~7,684 |
