# Hikari 组件库一比一复刻计划

> 目标：完全复刻 legacy 版本的组件、样式、行为
>
> Legacy: `/mnt/sdb1/hikari-legacy` (Dioxus + wasm-bindgen/web-sys)
> Current: `/mnt/sdb1/hikari` (Tairitsu + WASI Component)
>
> 生成时间: 2026-04-02
> 更新时间: 2026-04-02 (用户确认后更新)

---

## 一、整体评估

### 框架层差异（已解决）

| 特性 | Legacy (Dioxus) | Current (Tairitsu) | 状态 |
|------|-----------------|-------------------|------|
| VDOM | Dioxus VirtualDom | Tairitsu VNode | 已适配 |
| 组件宏 | `#[derive(Props)]` + `#[component]` | `#[define_props]` + `component` | 已适配 |
| 路由 | Dioxus Router | JS History API | 已适配 |
| WASM 互操作 | `web-sys` / `wasm-bindgen` 直接调用 | `platform` 抽象层 | 已适配 |
| CSS 系统 | SCSS 变量 + 硬编码 | 三层 CSS 变量系统 (Foundation/Component/Runtime) | 已增强 |

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

### 总结

- **~85% 组件** 功能对等，current 是 legacy 的超集
- **主要差距** 在鼠标追踪精度（Glow/Tooltip/Popover/Card）
- **6 个 extra 组件** 在迁移中被移除（依赖 Web Audio / contenteditable / clipboard API）
- **主题色板** 从中国传统色变更为通用蓝色系（需确认是否回退）

---

## 二、用户决策记录

| 问题 | 决策 |
|------|------|
| Q1 主题色板 | **恢复中国传统色** |
| Q2 Select Glow | **改为可选** (添加 prop 控制) |
| Q3 Extra 组件 | **全部恢复** (CollapsibleCard, DraggableCard, CodeHighlighter, RichTextEditor, VideoPlayer, AudioWaveform)。如遇 platform 层缺失接口，写入 `../tairitsu/PLAN.md` |
| Q4 on_change | **保持可选**，新增 `*Group` 抽象层级用于自动关联相关组件 |
| Q5 Glow 性能 | **Glow 完全不工作**，需修复（见 P0 Bug #1-3） |
| Q6 Website 示例 | **一比一复刻** |

---

## 三、需修复的问题

### P0 - 功能性 Bug（必须修复）

| # | 组件 | 问题 | 修复方案 |
|---|------|------|---------|
| **1** | **`Glow` (3 个 bug)** | **完全不可见** — (a) `GlowComponent` 未注册到 `StyleRegistry`，CSS 从未注入 | `styled.rs` 中添加 `GlowComponent` 到 import 和 register |
| **2** | **`Glow`** | **鼠标不跟随** — `build_style` 硬编码 `50% 50%`，忽略 `mouse_x`/`mouse_y` | 传入实际鼠标坐标，转换为相对百分比 |
| **3** | **`Glow`** | **无 hover/active 反应** — `active_intensity=None` 时 opacity 公式退化为常数 | 修复 opacity 计算逻辑，离开时归零 |
| **4** | `RadioGroup/RadioButton` | `RadioButton.on_change` 不传播到父 `RadioContext`，点击单选按钮不会更新组选中值 | 在 `RadioButton` 的 `handle_change` 中调用 `ctx.on_change` 更新 context |
| **5** | `Card` Glow | 鼠标追踪使用视口绝对坐标而非元素相对百分比，光效偏移 | 使用 `platform::get_element_rect_by_id` 计算相对坐标 |
| **6** | `Tooltip` | 使用硬编码 `100×30` 尺寸代替实际触发元素 rect，定位不准确 | 使用 `platform::get_target_element_from_event` + `get_bounding_rect_by_class_impl` |
| **7** | `Popover` | 同 Tooltip，硬编码触发元素尺寸 | 同 Tooltip 方案 |

### P1 - 视觉/行为差异

| # | 组件 | 差异 | 修复方案 |
|---|------|------|---------|
| 8 | `Select` | Current 新增 Glow 包裹触发器，legacy 无此效果 | 添加 `glow: bool` prop (默认 false) |
| 9 | `Switch` | Current 无条件添加 `hi-switch-glow` class，legacy 无此类 | 改为仅在 glow 启用时添加 |
| 10 | `Glow` 性能 | `use_signal` 响应式每次鼠标移动触发重渲染 | 先修复功能，后续考虑节流优化 |

### P2 - 新增功能

| # | 组件 | 需求 | 修复方案 |
|---|------|------|---------|
| 11 | `Group` 抽象 | 新增通用 Group 组件用于自动关联相关组件 | 参考 legacy RadioGroup 上下文模式，设计可复用的 `GroupProvider` |
| 12 | 主题色板 | 恢复中国传统色色板 | 更新 `base.scss` CSS 变量 + `hikari-palette` Palette 定义 |

---

## 三、主题/色板差异（需确认）

### 当前变更

Legacy 使用**中国传统色**色板：
- Primary: 牡丹粉红 `#EEA2A4`、Secondary: 苍翠 `#519A73`
- Background: 月白 `#D6ECF0`、Surface: 素 `#ECF1F5`

Current 使用**通用蓝紫色系**：
- Primary: 蓝色 `#4a9eff`、Secondary: 紫色 `#8b5cf6`
- Background: 纯白 `#ffffff`、Surface: 浅灰 `#f8fafc`

### 影响范围

此变更影响 `base.scss` 中所有 `:root` 和 `[data-theme="tairitsu"]` 的 CSS 变量定义，以及 `hikari-palette` 中 `Hikari::palette()` 和 `Tairitsu::palette()` 的返回值。

---

## 四、已移除的 Extra 组件恢复计划

以下 6 个组件需全部恢复（用户确认）：

| # | 组件 | 移除原因 | 复刻可行性 | 所需 platform API |
|---|------|---------|-----------|------------------|
| 1 | `CollapsibleCard` | 薄包装 | 可立即恢复 | 无 |
| 2 | `DraggableCard` | 薄包装 | 可立即恢复 | 无 |
| 3 | `CodeHighlighter` | clipboard API | 可恢复 | `platform::copy_to_clipboard` (已有) |
| 4 | `RichTextEditor` | contenteditable API | 需确认 | contenteditable 支持 |
| 5 | `VideoPlayer` | HTML5 video API | 需确认 | video 元素控制 |
| 6 | `AudioWaveform` | Web Audio API | 需确认 | AudioContext/AnalyserNode |

**注意**：如发现 tairitsu platform 层缺少上述接口，需写入 `../tairitsu/PLAN.md`。

### 缺失 Platform API 记录

| 组件 | 缺失 API | 用途 | 优先级 |
|------|---------|------|--------|
| `AudioWaveform` | `AudioContext` (Web Audio API) | 创建音频上下文，用于解码和分析音频 | P1 |
| `AudioWaveform` | `AnalyserNode` (Web Audio API) | 实时频域/时域数据分析，生成波形可视化 | P1 |
| `AudioWaveform` | `createMediaElementSource` | 将 `<audio>` 元素连接到分析图 | P1 |
| `AudioWaveform` | `MediaElementAudioSourceNode` | 桥接 HTML 音频元素与 Web Audio API | P2 |
| `AudioWaveform` | `AudioContext.resume()` | 恢复被浏览器自动挂起的音频上下文 | P2 |

---

## 五、SCSS/CSS 差异汇总

### 已改进项（保持不变）

| 变更 | 说明 |
|------|------|
| 三层 CSS 变量系统 | Foundation → Component → Runtime，比 legacy 更灵活 |
| CSS 入口动画迁移到 JS | `button-fade-in`、`card-fade-in` 等由 AnimationBuilder 处理 |
| Glow 增强功能 | 新增 pulse/breathe/shimmer 预设 + 4 级模糊 |
| InputWrapper 抽象 | NumberInput/Search 统一使用 InputWrapper |
| Icon 颜色继承 | `color: inherit` 替代强制 primary 色，更灵活 |
| 焦点可见状态 | 新增 `:focus-visible` 样式 |

### 需恢复项

| 变更 | Legacy | Current | 操作 |
|------|--------|---------|------|
| 背景色 | 月白 `#D6ECF0` | 纯白 `#ffffff` | 恢复月白 |
| 主题色 | 中国传统色 | 蓝紫色系 | 恢复中国传统色 |
| Dark 主题色 | 靛蓝 `#065279` | 粉色 `#ff6b9d` | 恢复靛蓝 |

---

## 六、实施计划

### Phase 1: Glow 修复 + P0 Bug（最高优先级）

- [ ] **修复 Glow Bug #1**: `styled.rs` 注册 `GlowComponent` 到 `StyleRegistry`
- [ ] **修复 Glow Bug #2**: `glow.rs` `build_style` 传入实际鼠标坐标
- [ ] **修复 Glow Bug #3**: `glow.rs` 修复 opacity 计算（active_intensity=None 时）
- [ ] 修复 RadioGroup/RadioButton 选中值传播
- [ ] 修复 Card Glow 鼠标追踪精度
- [ ] 修复 Tooltip 定位精度
- [ ] 修复 Popover 定位精度

### Phase 2: 主题恢复

- [ ] 恢复 `base.scss` 中的中国传统色 CSS 变量
- [ ] 恢复 `[data-theme="tairitsu"]` dark 主题色
- [ ] 更新 `hikari-palette` 中 `Hikari::palette()` 返回值
- [ ] 更新 `hikari-palette` 中 `Tairitsu::palette()` 返回值
- [ ] 更新 `foundation.scss` 中的基础颜色变量

### Phase 3: P1 行为对齐 + Group 抽象

- [ ] Select 添加 `glow: bool` prop（默认 false）
- [ ] Switch `hi-switch-glow` class 条件化
- [ ] 设计并实现通用 `GroupProvider` 抽象
- [ ] 评估 Glow 性能（节流方案）

### Phase 4: Extra 组件恢复

- [ ] 恢复 `CollapsibleCard`（薄包装，无障碍）
- [ ] 恢复 `DraggableCard`（薄包装，无障碍）
- [ ] 恢复 `CodeHighlighter`（利用 `platform::copy_to_clipboard`）
- [ ] 恢复 `RichTextEditor`（确认 platform contenteditable 支持）
- [ ] 恢复 `VideoPlayer`（确认 platform video API）
- [ ] 恢复 `AudioWaveform`（确认 platform Web Audio API）
- [ ] 如有缺失 platform API，写入 `../tairitsu/PLAN.md`

### Phase 5: Website 示例一比一复刻

- [ ] 复刻 legacy website 组件注册表 (1543 行 registry.rs)
- [ ] 复刻所有 Layer 1 组件 demo（Button, Avatar, Form, Display, Feedback, Switch, Tag, Image, Comment, NumberInput, Search, Empty/Skeleton, FlexBox/Layout）
- [ ] 复刻所有 Layer 2 组件 demo（Navigation, Data, Form, Feedback, Cascader, Transfer, Collapsible, Timeline, QRCode）
- [ ] 复刻所有 Layer 3 组件 demo（Media, Editor, Visualization, ZoomControls）
- [ ] 复刻 System 页面（CSS, Icons, Palette, Animations, i18n）
- [ ] 复刻 Demos 页面（Form, Dashboard, Animation）
- [ ] 确保 9 语言 i18n 支持
- [ ] 确保路由一致性（40+ 路由）

### Phase 6: 验证

- [ ] 运行全量测试
- [ ] 运行 clippy 检查
- [ ] 运行 E2E 测试
- [ ] 视觉回归对比

---

## 七、Glow 组件根因分析

用户反馈 Glow 完全不工作，经调查发现 **3 个 bug**：

### Bug 1 (主因): `GlowComponent` 未注册到 `StyleRegistry`

**位置**: `styled.rs:113-128`

`register_feedback_components()` 导入了 8 个 feedback 组件但**遗漏了 `GlowComponent`**。导致 `GlowComponent::styles()` 从未被调用，`::before` 伪元素**没有任何 CSS**。

**修复**: 在 import 和 register 中添加 `glow::GlowComponent`

### Bug 2: `build_style` 忽略鼠标坐标

**位置**: `glow.rs:232-239`

`onmousemove_handler` 存储了 `event.client_x`/`event.client_y`，但 `build_style` **硬编码 `50% 50%`**，从不读取鼠标坐标。光效永远在元素中心，不会跟随鼠标。

**修复**: 传入 `state.mouse_x`/`state.mouse_y`，转换为相对百分比

### Bug 3: Opacity 公式在 `active_intensity=None` 时退化为常数

**位置**: `glow.rs:261-263`

```rust
current_opacity = base + (active.unwrap_or(base) - base) * level = base + 0 = base
```

opacity 永远等于 `base_opacity`，不随 hover/active 变化。且离开时不归零，光效永久可见。

**修复**: 重写 opacity 计算逻辑，离开时归零，hover 时增强

---

## 附录 A: 组件完整对照表

### Basic Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Button | 完整 | 超集 (新增 CSS vars, animation_id) | 无 |
| Input | 完整 | 超集 (新增 status, CSS vars) | 无 |
| Card | 完整 | 等价 (Glow 追踪精度降级) | P0 修复 |
| Badge | 完整 | 等价 | 无 |
| Checkbox | 完整 | 等价 (on_change 改可选) | P2 评估 |
| Switch | 完整 | 等价 (新增 glow class) | P2 评估 |
| RadioGroup | 完整 | 有 Bug (选中值不传播) | P0 修复 |
| Select | 完整 | 超集 (新增 Glow 包裹) | P2 评估 |
| Slider | 完整 | 超集 (新增 focus-visible) | 无 |
| Textarea | 完整 | 超集 (新增 status) | 无 |
| IconButton | 完整 | 超集 (新增 CSS vars) | 无 |
| Arrow | 完整 | 等价 | 无 |
| Canvas | 完整 | 等价 | 无 |
| Avatar | 完整 | 等价 (ClassesBuilder 重构) | 无 |
| Image (+ Logo) | 完整 | 等价 | 无 |
| InputWrapper | 完整 | 超集 (新增) | 无 |
| Background | 完整 | 等价 | 无 |
| DatePicker | 完整 | 等价 | 无 |
| FileUpload | 完整 | 等价 | 无 |
| FormField | 完整 | 等价 | 无 |

### Feedback Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Alert | 完整 | 超集 (新增 size) | 无 |
| Toast | 完整 | 等价 | 无 |
| Tooltip | 完整 | 定位精度降级 | P0 修复 |
| Modal | 完整 | 超集 (新增 size) | 无 |
| Drawer | 完整 | 等价 | 无 |
| Popover | 完整 | 定位精度降级 | P0 修复 |
| Progress | 完整 | 等价 | 无 |
| Spin | 完整 | 超集 (移除 cfg gate) | 无 |
| Glow | 完整 | 超集 (新增预设/模糊) + 性能回归 | P1 评估 |

### Navigation Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Tabs + TabPane | 完整 | 修复 (TabPane 可点击) | 无 |
| Menu + MenuItem + SubMenu | 完整 | 等价 | 无 |
| Breadcrumb + Item + Separator | 完整 | 等价 | 无 |
| Steps | 完整 | 等价 (重构) | 无 |
| Sidebar + Section + Item + Leaf | 完整 | 等价 | 无 |
| Stepper | 完整 | 等价 | 无 |
| Anchor | 完整 | 等价 | 未详查 |

### Layout Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Layout (AppLayout) | 完整 | 等价 | 未详查 |
| Container | 完整 | 等价 | 未详查 |
| FlexBox | 完整 | 等价 | 未详查 |
| Space | 完整 | 等价 | 未详查 |
| Divider | 完整 | 等价 | 未详查 |
| Header | 完整 | 等价 | 未详查 |
| Footer | 完整 | 等价 | 未详查 |
| Aside | 完整 | 等价 | 未详查 |
| Content | 完整 | 等价 | 未详查 |
| Grid + Col + Row | 完整 | 等价 | 未详查 |
| Section + Spacer | 完整 | 等价 | 未详查 |
| ScrollbarContainer | 完整 | 等价 | 未详查 |

### Data Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Table | 完整 | 等价 | 未详查 |
| Tree | 完整 | 等价 | 未详查 |
| Pagination | 完整 | 等价 | 未详查 |
| Cell + Column | 完整 | 等价 | 未详查 |
| TreeNode + Arrow + Content + Label | 完整 | 等价 | 未详查 |
| Collapse | 完整 | 等价 | 未详查 |
| DragDropTree | 完整 | 等价 | 未详查 |
| VirtualScroll | 完整 | 等价 | 未详查 |
| Filter + Selection + Sort | 完整 | 等价 | 未详查 |

### Display Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Tag | 完整 | 等价 | 未详查 |
| Empty | 完整 | 等价 | 未详查 |
| Comment | 完整 | 等价 | 未详查 |
| QRCode | 完整 | 等价 | 未详查 |
| Calendar | 完整 | 等价 | 未详查 |
| Timeline + TimelineItem | 完整 | 等价 | 未详查 |
| Carousel | 完整 | 等价 | 未详查 |
| Skeleton + Card + Table | 完整 | 等价 | 未详查 |
| UserGuide | 完整 | 等价 | 未详查 |
| DragLayer | 完整 | 等价 | 未详查 |
| ZoomControls | 完整 | 等价 | 未详查 |

### Entry Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| NumberInput | 完整 | 等价 | 未详查 |
| Search | 完整 | 等价 | 未详查 |
| AutoComplete | 完整 | 等价 | 未详查 |
| Cascader | 完整 | 等价 | 未详查 |
| Transfer | 完整 | 等价 | 未详查 |

### Production Components

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| AudioPlayer | 完整 | 简化版 | 未详查 |
| CodeHighlight | 完整 | 简化版 | 未详查 |
| VideoPlayer | 完整 | 简化版 | 未详查 |
| RichTextEditor | 完整 | 简化版 | 未详查 |
| MarkdownEditor | 完整 | 等价 | 未详查 |

### Extra Components (数据模型)

| 组件 | Legacy | Current | 差异 |
|------|--------|---------|------|
| Collapsible | 完整 (390行 SCSS) | 完整数据模型 | 无 |
| DragLayer | 完整 (384行 SCSS) | 完整数据模型 | 无 |
| ZoomControls | 完整 (547行 SCSS) | 完整数据模型 | 无 |
| Timeline | 完整 (382行 SCSS) | 完整数据模型 | 无 |
| UserGuide | 完整 (200行 inline CSS) | 完整数据模型 | 无 |
| CollapsibleCard | 薄包装 | **已移除** | Phase 3 |
| DraggableCard | 薄包装 | **已移除** | Phase 3 |
| RichTextEditor | 完整 (70行 inline CSS) | **已移除** | Phase 3 |
| AudioWaveform | 完整 (95行 inline CSS) | **已移除** | Phase 3 |
| VideoPlayer | 完整 (70行 inline CSS) | **已移除** | Phase 3 |
| CodeHighlighter | 完整 (225行 inline CSS) | **已移除** | Phase 3 |
| Node Graph (全部) | 完整 (14 文件) | 完整数据模型 | 无 |

---

## 附录 B: SCSS 文件对照表

| 文件 | Legacy | Current | 状态 |
|------|--------|---------|------|
| `theme/base.scss` | 中国传统色 | 蓝紫色系 | 需确认 |
| `theme/foundation.scss` | 无 | 195 行 (Layer1) | 新增 |
| `theme/mixins.scss` | 完整 | 完整 | 等价 |
| `theme/themes.scss` | 完整 | 完整 | 等价 |
| `theme/variables.scss` | 完整 | 完整 | 等价 |
| `components/index.scss` | 硬编码变量 | CSS 变量引用 | 架构升级 |
| `components/button.scss` | SCSS 变量 | CSS 变量 | 架构升级 |
| `components/card.scss` | SCSS 变量 | CSS 变量 | 架构升级 |
| `components/glow.scss` | 基础光效 | 增强光效 (预设+模糊) | 增强 |
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
