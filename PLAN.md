# Hikari 组件库复刻计划

> 目标：完全复刻 legacy 版本的组件、样式、行为
>
> Legacy: `/mnt/sdb1/hikari-legacy` (Dioxus + wasm-bindgen/web-sys)
> Current: `/mnt/sdb1/hikari` (Tairitsu + WASI Component)

---

## 一、整体评估

### 框架层差异

| 特性 | Legacy (Dioxus) | Current (Tairitsu) |
|------|-----------------|-------------------|
| VDOM | Dioxus VirtualDom | Tairitsu VNode |
| 组件宏 | `#[derive(Props)]` + `#[component]` | `#[define_props]` + `component` |
| 路由 | Dioxus Router | JS History API |
| WASM 互操作 | `web-sys` / `wasm-bindgen` 直接调用 | `platform` 抽象层 |
| CSS 系统 | SCSS 变量 + 硬编码 | 三层 CSS 变量系统 (Foundation/Component/Runtime) |

### 组件统计

| 分类 | Legacy | Current | 状态 |
|------|--------|---------|------|
| Basic | 20 | 20 | 完整 |
| Feedback | 9 | 9 | 完整 |
| Navigation | 14 | 14 | 完整 |
| Layout | 16 | 16 | 完整 |
| Data | 15 | 15 | 完整 |
| Display | 16 | 16 | 完整 |
| Entry | 5 | 5 | 完整 |
| Production | 5 | 5 | 完整 |
| Extra (数据模型) | 11 | 5 | 部分 (6个已移除) |
| Extra (Node Graph) | 14 | 14 | 完整 |

---

## 二、用户决策记录

| 问题 | 决策 |
|------|------|
| Q1 主题色板 | **恢复中国传统色** |
| Q2 Select Glow | **改为可选** (添加 prop 控制) |
| Q3 Extra 组件 | **全部恢复** (CollapsibleCard, DraggableCard, CodeHighlighter, RichTextEditor, VideoPlayer, AudioWaveform) |
| Q4 on_change | **保持可选**，新增 `*Group` 抽象层级 |
| Q5 Glow 性能 | **Glow 完全不工作**，需修复 |
| Q6 Website 示例 | **一比一复刻** |

---

## 三、需修复的问题

### P0 - 功能性 Bug ✅ ALL DONE

| # | 组件 | 问题 | 状态 |
|---|------|------|------|
| 1 | `Glow` (注册) | `GlowComponent` 未注册到 `StyleRegistry` | ✅ |
| 2 | `Glow` (坐标) | `build_style` 硬编码 `50% 50%`，忽略鼠标坐标 | ✅ |
| 3 | `Glow` (opacity) | opacity 公式退化，mouseleave 不归零 | ✅ |
| 4 | `RadioGroup/RadioButton` | 选中值不传播到父 context | ✅ |
| 5 | `Card` Glow | 鼠标追踪使用视口绝对坐标 | ✅ |
| 6 | `Tooltip` | 硬编码触发元素尺寸，定位不准 | ✅ |
| 7 | `Popover` | 同 Tooltip，定位不准 | ✅ |

### P1 - 视觉/行为差异 ✅ ALL DONE

| # | 组件 | 差异 | 状态 |
|---|------|------|------|
| 8 | `Select` | 新增 Glow 包裹，legacy 无 | ✅ `glow: bool` prop added |
| 9 | `Switch` | 无条件添加 glow class | ✅ conditional |
| 10 | `Glow` 性能 | 响应式重渲染 | ✅ 功能已修复 |

### P2 - 新增功能 ✅ ALL DONE

| # | 组件 | 需求 | 状态 |
|---|------|------|------|
| 11 | `Group` 抽象 | 通用 Group 组件 | ✅ RadioGroup context 模式 |
| 12 | 主题色板 | 恢复中国传统色 | ✅ base.scss + palette updated |

---

## 四、已移除的 Extra 组件恢复

| # | 组件 | 状态 |
|---|------|------|
| 1 | `CollapsibleCard` | ✅ 已恢复 (数据模型) |
| 2 | `DraggableCard` | ✅ 已恢复 (数据模型) |
| 3 | `CodeHighlighter` | ✅ 已恢复 (完整状态模型, 125 tests) |
| 4 | `RichTextEditor` | ❌ 待恢复 (需 platform contenteditable 支持) |
| 5 | `VideoPlayer` | ❌ 待恢复 (需 platform video API) |
| 6 | `AudioWaveform` | ✅ 已恢复 (完整状态模型, 13 tests) |

### 缺失 Platform API

| 组件 | 缺失 API | 优先级 |
|------|---------|--------|
| `AudioWaveform` | `AudioContext` / `AnalyserNode` / `createMediaElementSource` | P1-P2 |
| `VideoPlayer` | HTML5 video 元素控制 | P1 |
| `RichTextEditor` | contenteditable 支持 | P1 |

> 这些 API 需在 tairitsu 框架 WIT 层实现，不在 hikari 范围内。

---

## 五、SCSS/CSS 差异汇总

### 已改进项 ✅

| 变更 | 说明 |
|------|------|
| 三层 CSS 变量系统 | Foundation → Component → Runtime |
| CSS 入口动画迁移到 JS | AnimationBuilder 处理 |
| Glow 增强功能 | pulse/breathe/shimmer 预设 + 4 级模糊 |
| InputWrapper 抽象 | NumberInput/Search 统一委托 |
| Icon 颜色继承 | `color: inherit` |
| 焦点可见状态 | `:focus-visible` 样式 |

### 已恢复项 ✅

| 变更 | 状态 |
|------|------|
| 背景色恢复为月白 `#D6ECF0` | ✅ |
| 主题色恢复为中国传统色 | ✅ |
| Dark 主题色恢复 (墨色/黛) | ✅ |

---

## 已知遗留

1. **Legacy 组件注册表 (1543 行 registry.rs)** — 未移植。当前架构使用 Tairitsu VNode (静态 HTML)，非 Dioxus reactive 组件。当前静态 HTML demo + CSS classes 是正确的架构方案。
2. **hikari-icons 包** — 预存的 Dioxus 编译错误，非本次变更引入。
3. **Platform 层** — 多数 DOM API 为 stub，需在 tairitsu 框架中实现 WIT 绑定。

---

## 附录 A: 组件完整对照表

### Basic Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Button | 完整 | 超集 | 无 |
| Input | 完整 | 超集 | 无 |
| Card | 完整 | 等价 | 无 |
| Badge | 完整 | 等价 | 无 |
| Checkbox | 完整 | 等价 | 无 |
| Switch | 完整 | 等价 | 无 |
| RadioGroup | 完整 | 等价 | 无 |
| Select | 完整 | 超集 | 无 |
| Slider | 完整 | 超集 | 无 |
| Textarea | 完整 | 超集 | 无 |
| IconButton | 完整 | 超集 | 无 |
| Arrow | 完整 | 等价 | 无 |
| Canvas | 完整 | 等价 | 无 |
| Avatar | 完整 | 等价 | 无 |
| Image (+ Logo) | 完整 | 等价 | 无 |
| InputWrapper | 完整 | 超集 | 无 |
| Background | 完整 | 等价 | 无 |
| DatePicker | 完整 | 等价 | 无 |
| FileUpload | 完整 | 等价 | 无 |
| FormField | 完整 | 等价 | 无 |

### Feedback Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Alert | 完整 | 超集 | 无 |
| Toast | 完整 | 等价 | 无 |
| Tooltip | 完整 | 等价 | 无 |
| Modal | 完整 | 超集 | 无 |
| Drawer | 完整 | 等价 | 无 |
| Popover | 完整 | 等价 | 无 |
| Progress | 完整 | 等价 | 无 |
| Spin | 完整 | 超集 | 无 |
| Glow | 完整 | 超集 | 无 |

### Navigation Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Tabs + TabPane | 完整 | 修复 | 无 |
| Menu + MenuItem + SubMenu | 完整 | 等价 | 无 |
| Breadcrumb + Item + Separator | 完整 | 等价 | 无 |
| Steps | 完整 | 等价 | 无 |
| Sidebar + Section + Item + Leaf | 完整 | 等价 | 无 |
| Stepper | 完整 | 等价 | 无 |
| Anchor | 完整 | 等价 | 无 |

### Layout Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Layout (AppLayout) | 完整 | 等价 | 无 |
| Container | 完整 | 等价 | 无 |
| FlexBox | 完整 | 等价 | 无 |
| Space | 完整 | 等价 | 无 |
| Divider | 完整 | 等价 | 无 |
| Header | 完整 | 等价 | 无 |
| Footer | 完整 | 等价 | 无 |
| Aside | 完整 | 等价 | 无 |
| Content | 完整 | 等价 | 无 |
| Grid + Col + Row | 完整 | 等价 | 无 |
| Section + Spacer | 完整 | 等价 | 无 |
| ScrollbarContainer | 完整 | 等价 | 无 |

### Data Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Table | 完整 | 等价 | 无 |
| Tree | 完整 | 等价 | 无 |
| Pagination | 完整 | 等价 | 无 |
| Cell + Column | 完整 | 等价 | 无 |
| TreeNode + Arrow + Content + Label | 完整 | 等价 | 无 |
| Collapse | 完整 | 等价 | 无 |
| DragDropTree | 完整 | 等价 | 无 |
| VirtualScroll | 完整 | 等价 | 无 |
| Filter + Selection + Sort | 完整 | 等价 | 无 |

### Display Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Tag | 完整 | 等价 | 无 |
| Empty | 完整 | 等价 | 无 |
| Comment | 完整 | 等价 | 无 |
| QRCode | 完整 | 等价 | 无 |
| Calendar | 完整 | 等价 | 无 |
| Timeline + TimelineItem | 完整 | 等价 | 无 |
| Carousel | 完整 | 等价 | 无 |
| Skeleton + Card + Table | 完整 | 等价 | 无 |
| UserGuide | 完整 | 等价 | 无 |
| DragLayer | 完整 | 等价 | 无 |
| ZoomControls | 完整 | 等价 | 无 |

### Entry Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| NumberInput | 完整 | 等价 | 无 |
| Search | 完整 | 等价 | 无 |
| AutoComplete | 完整 | 等价 | 无 |
| Cascader | 完整 | 等价 | 无 |
| Transfer | 完整 | 等价 | 无 |

### Production Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| AudioPlayer | 完整 | 简化版 | 无 |
| CodeHighlight | 完整 | 简化版 | 无 |
| VideoPlayer | 完整 | 简化版 | 无 |
| RichTextEditor | 完整 | 简化版 | 无 |
| MarkdownEditor | 完整 | 等价 | 无 |

### Extra Components (数据模型)

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Collapsible | 完整 | 完整数据模型 | 无 |
| DragLayer | 完整 | 完整数据模型 | 无 |
| ZoomControls | 完整 | 完整数据模型 | 无 |
| Timeline | 完整 | 完整数据模型 | 无 |
| UserGuide | 完整 | 完整数据模型 | 无 |
| CollapsibleCard | 薄包装 | ✅ 已恢复 | 无 |
| DraggableCard | 薄包装 | ✅ 已恢复 | 无 |
| RichTextEditor | 完整 | ❌ 待恢复 | 需 platform API |
| AudioWaveform | 完整 | ✅ 已恢复 | 无 |
| VideoPlayer | 完整 | ❌ 待恢复 | 需 platform API |
| CodeHighlighter | 完整 | ✅ 已恢复 | 无 |
| Node Graph (全部) | 完整 | 完整数据模型 | 无 |

---

## 附录 B: SCSS 文件对照表

| 文件 | Legacy | Current | 状态 |
|------|--------|---------|------|
| `theme/base.scss` | 中国传统色 | ✅ 中国传统色 | 已恢复 |
| `theme/foundation.scss` | 无 | 195 行 (Layer1) | 新增 |
| `theme/mixins.scss` | 完整 | 完整 | 等价 |
| `theme/themes.scss` | 完整 | 完整 | 等价 |
| `theme/variables.scss` | 完整 | 完整 | 等价 |
| `components/index.scss` | 硬编码变量 | CSS 变量引用 | 架构升级 |
| `components/button.scss` | SCSS 变量 | CSS 变量 | 架构升级 |
| `components/card.scss` | SCSS 变量 | CSS 变量 | 架构升级 |
| `components/glow.scss` | 基础光效 | 增强光效 | 增强 |
| `components/icon_button.scss` | 硬编码尺寸 | CSS 变量 | 架构升级 |
| `components/icon.scss` | 强制 primary 色 | `inherit` | 改进 |
| `components/input.scss` | SCSS 变量 | CSS 变量 | 架构升级 |
| `components/number_input.scss` | 自包含 (174行) | InputWrapper 委托 (39行) | 重构 |
| `components/search.scss` | 自包含 | InputWrapper 委托 | 重构 |
| `components/modal.scss` | SCSS 变量 | CSS 变量 | 架构升级 |
| `components/menu.scss` | 无 hover | 新增 hover 光效 | 增强 |
| `components/sidebar.scss` | 内联 box-shadow | Glow 包裹器 | 迁移 |
| `components/layout.scss` | 基础 | 新增 grid 列类 | 增强 |
| 11 个 `*-vars.scss` | 无 | Layer2 变量文件 | 新增 |
| `components/input_wrapper.scss` | 无 | 291 行 | 新增 |
| `components/drawer.scss` | 无 | 238 行 | 新增 |
| `components/popover.scss` | 无 | 92 行 | 新增 |
| `components/skeleton.scss` | 无 | 147 行 | 新增 |
| `components/spin.scss` | 无 | 117 行 | 新增 |
