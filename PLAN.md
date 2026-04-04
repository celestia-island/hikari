# Hikari 组件库 1:1 复刻计划（Phase 10: 深度复刻）

> **目标**: 将 hikari-legacy 的全部组件、样式、行为完整复刻到 current (Tairitsu WASI Component 架构)
> — 不仅结构存在，而且渲染输出、交互行为、CSS 样式必须与 legacy 一致
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
| D10 | packages/components/tests/ | **用 tairitsu VNode 方式重写等价测试** ✅ |
| D11 | utils/form/ 验证系统 | **维持不恢复 (D3)** |
| D12 | Website 缺失 demo 页面 | **全部恢复** ✅ |
| D13 | 被删除的 Props 字段 | **不恢复**（经核实：Props 字段实际未丢失，current 是 legacy 的超集） |
| D14 | Legacy docs/ 文档 | **不恢复** |

---

## 已确认的决策

| # | 问题 | 决策 |
|---|------|------|
| Q1 | CSS 变量系统策略 | **方案 B**: 保留三层变量系统，使用 tairitsu palette 系统注入颜色值 |
| Q2 | index.scss 颜色差异 | **回退到 legacy 值**，与 palette 系统生成的 CSS 变量保持一致 |
| Q3 | ThemeProvider 动态主题切换 | **需要且已实现** — set_theme 已正确调用 .set()，use_memo 响应式计算 CSS vars |
| Q4 | Extra Components 交互升级 | **全部升级为完整交互组件** |
| Q5 | Background 动画变量不匹配 | **修复** — 对齐 CSS 变量名 + 恢复主题检测 |
| Q6 | Glow 交互状态系统 | Current 是 legacy 的超集，保留 |
| Q7 | animation/glow.rs | 保留当前位置 `components/feedback/glow.rs`，不需要恢复 animation 包中的版本 |
| Q8 | CSS class name 不一致 | **全部回退到 legacy class 名称** |
| Q9 | styled.rs DividerComponent | **补回** |
| Q10 | i18n 上下文组件 | 委托给 tairitsu_i18n，如需补充在 hikari 侧处理 |

---

## 已完成（Phase 1-9）

### Phase 1-6: 基础复刻 ✅
### Phase 7: Extra Components 渲染层补全 ✅
### Phase 8: 组件测试重写 ✅
### Phase 9: Website 1:1 复刻 ✅
### Clippy 清理 ✅

（详见旧 PLAN.md 记录）

---

## Phase 10: 深度复刻审计发现

以下内容基于 9 个子 Agent 对全部组件的逐行对比分析。

### 10.0 总体评估

| 分类 | 组件数 | 完全一致 | 需修复 | 严重缺失 |
|------|--------|---------|--------|---------|
| Basic Input (button/input/textarea/select/checkbox/radio/switch/slider) | 8+1 | 6 | 3 | 0 |
| Basic Display (arrow/avatar/background/badge/card/divider/image/icon_button/date_picker/canvas/file_upload/form_field) | 12 | 7 | 4 | 1 |
| Data (table/tree/pagination/collapse/cell/column/drag/filter/node*/selection/sort/virtual_scroll) | 16 | 12 | 2 | 2 |
| Display+Entry (calendar/carousel/comment/drag_layer/empty/qrcode/skeleton/tag/timeline/user_guide/zoom_controls/auto_complete/cascader/number_input/search/transfer) | 16 | 11 | 3 | 2 |
| Feedback (alert/drawer/glow/modal/popover/progress/spin/toast/tooltip) | 9 | 4 | 4 | 1 |
| Layout (app_layout/aside/container/content/divider/flex/footer/grid/header/scrollbar/section/space) | 12 | 8 | 2 | 2 |
| Navigation (anchor/breadcrumb/menu/sidebar/stepper/steps/tabs) | 7 | 5 | 2 | 0 |
| Production (audio_player/code_highlight/markdown_editor/rich_text_editor/video_player) | 5 | 3 | 1 | 1 |
| Extra Components (12 个组件) | 12 | 0 | 0 | 12 |
| Node Graph (canvas/connection/history/minimap/node/port/registry/serialization/value/viewport/plugins) | 15 | 3 | 4 | 8 |
| Theme/Animation/i18n Infrastructure | — | 2 | 4 | 3 |

### 10.1 严重问题清单（必须修复）

#### S1. Extra Components 全部为纯数据壳子 [严重]
**影响**: AudioWaveform, CodeHighlighter, Collapsible, CollapsibleCard, DragLayer, DraggableCard, RichTextEditor, Timeline, UserGuide, VideoPlayer, ZoomControls — **全部 12 个组件**

每个组件缺失：
- 所有事件处理器 (onclick, oninput, onkeydown, onmousedown 等)
- 所有 children/Element 插槽
- 所有回调函数 (on_change, on_select, on_zoom_change, on_play, on_pause 等)
- 交互功能（Collapsible 不可展开、DragLayer 不可拖拽、UserGuide 无导航）

#### S2. Node Graph 全套交互缺失 [严重]
**影响**: canvas, connection, node, port, viewport, plugins/input_node

- Canvas: 无键盘快捷键 (Ctrl+Z/Y, 箭头, +/-)、无 undo/redo 逻辑、无 save/load 处理
- Connection: 无 onclick、无 pointer-events:stroke
- Node: 无选中点击、端口无 mousedown 连接发起
- InputNode: 无 oninput（输入值永远不更新）
- Viewport: class name 与 legacy 不一致

#### S3. Background 动画变量不匹配 [严重]
- 动画写入 `--bg-saturation-factor` / `--bg-lightness-factor`
- SCSS 读取 `--bg-color-1` / `--bg-color-2`
- 结果：渐变动画完全无效
- 同时缺少 tairitsu 暗色主题色彩支持

#### S4. Tree 组件不可交互 [严重]
- `on_select` 回调从未被调用
- `on_expand` 回调从未被调用
- `expanded_keys` / `selected_keys` 状态从未被修改
- 点击节点没有任何效果

#### S5. Drag 组件 set_effect_allowed/set_drop_effect 缺失 [中等]
- dragstart 缺少 `data_transfer.set_effect_allowed("move")`
- dragover 明确 stub 了 `set_drop_effect("move")`

#### S6. ScrollbarContainer 结构简化导致不可用 [严重]
- Legacy: 外层 wrapper + 内层 content div（含 `data-custom-scrollbar="content"` + `overflow-y: auto`）
- Current: 单个 div，无内层 content div
- CSS 引用了不存在的子元素

#### S7. FileUpload 文件大小验证完全缺失 [严重]
- `max_size` prop 被接受但从未执行
- drop handler 和 change handler 都不检查文件大小

#### S8. FormField 缺少默认 Valid/Warning 状态消息 [中等]
- Legacy 在 status=Success 时显示 "Valid"，status=Warning 时显示 "Warning"
- Current 在这些情况下不显示任何内容

#### S9. ThemeProvider.set_theme 是 no-op [中等]
- 运行时主题切换完全无效

#### S10. index.scss 颜色值与 legacy 不一致 [中等-视觉]
- `--hi-primary`, `--hi-secondary`, `--hi-accent`, `--hi-success`, `--hi-warning`, `--hi-danger`, `--hi-info`, `--hi-background`, `--hi-text-primary`, `--hi-text-secondary` 等多个颜色值不同
- 明暗主题都有差异

### 10.2 中等问题清单

| # | 组件 | 问题 | 详情 |
|---|------|------|------|
| M1 | Selection | DOM 顺序颠倒 | "全选" checkbox 出现在项目之后而非之前 |
| M2 | SkeletonTable | Header/Body 顺序颠倒 | header 在 body rows 之后渲染 |
| M3 | Transfer | 空状态判断错误 | 使用 unfiltered `items` 而非 `filtered_items` |
| M4 | NumberInput | glow/glow_intensity props 声明但未使用 | props 存在但渲染中不使用 |
| M5 | Card Glow | CSS 变量重命名 | `--hi-glow-color` → `--hi-card-glow`，SCSS 引用不一致 |
| M6 | Modal | 缺少 set_timeout 延迟关闭 | Legacy 用 setTimeout 实现关闭动画，current 直接关闭 |
| M7 | Calendar | CSS 变量重命名 | `--hi-color-primary-glow` → `--hi-glow-button-primary` |
| M8 | Timeline (display) | CSS 变量重命名 | 同 Calendar |
| M9 | Carousel | tokio::sleep → platform::set_timeout | 异步循环改为单次定时器 |
| M10 | QRCode | Canvas → SVG 渲染 | 架构性变化，输出质量可能不同 |
| M11 | Search | Inline dropdown → Portal 系统 | 架构性变化 |
| M12 | Glow opacity 值差异 | dim/soft/bright 的 opacity 值不同 | Legacy: 0.07/0.15/0.30, Current: 0.15/0.30/0.50 |
| M13 | Glow 缺少 Acrylic re-exports | `Glow as Acrylic` 等 re-export 缺失 | |
| M14 | Button 缺少 CSS-only transition class | `.hi-button-css-transitions` 被删除 | |
| M15 | animation/glow.rs | 整个文件在 current 中不存在 | 176 行 Dioxus 组件 |
| M16 | animation/background_animation | 缺少主题检测和状态机集成 | 硬编码 "hikari" 主题 |
| M17 | animation/provider | 不注入 CSS 变量 | Legacy 注入 `--hi-animation-*` 变量 |
| M18 | animation/events | 缺少泛型 on() 方法和节流 | |
| M19 | styled.rs | 缺少 DividerComponent 注册 | |

### 10.3 已确认一致或等价的组件

以下组件经审计确认为 legacy 的超集或完全一致，无需修改：

| 分类 | 组件 | 状态 |
|------|------|------|
| Basic | Arrow, Avatar, Badge, Divider, Image, Checkbox | ✅ 完全一致 |
| Basic | Switch, Slider, RadioGroup, Textarea | ✅ 完全一致 |
| Data | Table, Pagination, PaginationButton, Cell, Column | ✅ 完全一致 |
| Data | Collapse, Filter, Node, NodeArrow, NodeContent, NodeLabel | ✅ 完全一致 |
| Data | Sort, VirtualScroll | ✅ 完全一致 |
| Display | Comment, DragLayer, Empty, Tag | ✅ 完全一致 |
| Display | Carousel, UserGuide, ZoomControls (结构一致) | ✅ 基本一致 |
| Entry | AutoComplete, Cascader | ✅ 完全一致 |
| Layout | Container, Content, Flex, Footer, Section, Space | ✅ 完全一致 |
| Navigation | Anchor, Breadcrumb, Menu, Sidebar, Stepper, Steps | ✅ 完全一致 |
| Production | AudioPlayer, CodeHighlight, MarkdownEditor | ✅ 完全一致 |
| Feedback | Drawer, Spin, Toast | ✅ 完全一致 |
| SCSS | 53 个共享 SCSS 文件中 45 个 byte-for-byte 一致 | ✅ |

### 10.4 Current 的改进（非 legacy 回退项）

以下是 current 比 legacy 更好的地方，复刻时应保留：

| # | 改进 | 详情 |
|---|------|------|
| E1 | RichTextEditor (production) | 有实际 exec_command 调用 vs legacy 的空壳 toolbar |
| E2 | VideoPlayer (production) | 有自定义控件、进度条 vs legacy 仅原生 controls |
| E3 | MarkdownEditor | 更正确的 markdown 解析器（状态机 vs 破碎的 replace） |
| E4 | ProcessorNode | 真正的计算逻辑 vs legacy stub |
| E5 | OutputNode | 真正的值存储 vs legacy stub |
| E6 | Minimap | 真正的节点/连接渲染 vs legacy 仅背景矩形 |
| E7 | Glow 组件 | 更丰富的交互状态系统 |
| E8 | Animation lifecycle | 增强的生命周期管理 |
| E9 | Animation state_machine | 全新 ButtonStateMachine |
| E10 | Grid/Col 响应式 | 新增 span_sm/span_md/span_lg 断点 |
| E11 | Alert size prop | 新增 AlertSize |
| E12 | Modal size prop | 新增 ModalSize |
| E13 | Palette 包 | 完全一致，纯数据无依赖 |

---

## 执行计划（待用户确认后执行）

### Phase 10A: CSS 颜色值回退（依赖 Q1, Q2）
- [ ] 10A-1: `index.scss` 颜色值回退到 legacy 值
- [ ] 10A-2: 检查 `base.scss` 新增的 `--hi-color-black-95`/`--hi-color-white-95` 是否需要保留
- [ ] 10A-3: 如果选择 Q1-A 方案，删除 `foundation.scss` 和所有 `*-vars.scss`，恢复 SCSS 硬编码值
- [ ] 10A-4: 如果选择 Q1-B 方案，将所有 `*-vars.scss` 默认值设为 legacy 硬编码值

### Phase 10B: 组件渲染修复
- [ ] 10B-1: Background 动画变量对齐（`--bg-color-1`/`--bg-color-2` vs `--bg-saturation-factor`/`--bg-lightness-factor`）+ 恢复主题检测
- [ ] 10B-2: Tree 组件 — 恢复 onclick, on_select, on_expand, expanded_keys/selected_keys 状态变更
- [ ] 10B-3: Drag 组件 — 恢复 set_effect_allowed + set_drop_effect
- [ ] 10B-4: ScrollbarContainer — 恢复 wrapper + content 双层结构
- [ ] 10B-5: FileUpload — 恢复文件大小验证
- [ ] 10B-6: FormField — 恢复默认 Valid/Warning 消息
- [ ] 10B-7: Selection — 修复 DOM 顺序
- [ ] 10B-8: SkeletonTable — 修复 header/body 顺序
- [ ] 10B-9: Transfer — 修复空状态判断使用 filtered_items
- [ ] 10B-10: styled.rs — 补回 DividerComponent
- [ ] 10B-11: ZoomControls/Viewport — class name 回退到 legacy 值

### Phase 10C: 基础设施修复（依赖 Q3, Q9）
- [ ] 10C-1: ThemeProvider — 恢复动态主题切换（如 Q3 确认）
- [ ] 10C-2: AnimationProvider — 恢复 CSS 变量注入
- [ ] 10C-3: Animation background_animation — 恢复主题检测 + tairitsu 色彩
- [ ] 10C-4: Animation events — 恢复泛型 on() + 节流
- [ ] 10C-5: Card/Calendar/Timeline — 统一 glow CSS 变量命名

### Phase 10D: Extra Components 交互升级（依赖 Q4）
**仅当 Q4 确认为"升级为完整交互组件"时执行**

- [ ] 10D-1: Collapsible — 添加 onclick toggle + children slot + on_change + aria-hidden + width style
- [ ] 10D-2: CollapsibleCard — 同上（继承 Collapsible 修复）
- [ ] 10D-3: DragLayer — 添加 mousedown/mousemove/mouseup + global overlay + stop_propagation + children + callbacks
- [ ] 10D-4: DraggableCard — 继承 DragLayer 修复
- [ ] 10D-5: Timeline — 添加 onclick expand + extra slot + clickable class + collapsed class
- [ ] 10D-6: UserGuide — 添加 Badge/Button 组件 + 所有 onclick + guide description + 动画
- [ ] 10D-7: ZoomControls — 添加 onclick + onkeydown + on_zoom_change callback + class name 修复
- [ ] 10D-8: CodeHighlighter — 添加 clipboard copy + auto-reset + span wrapper + 正确 class
- [ ] 10D-9: AudioWaveform — 添加 IconButton + Web Audio fallback
- [ ] 10D-10: RichTextEditor — 添加 oninput + exec_command + contenteditable + IconButton
- [ ] 10D-11: VideoPlayer — 添加 IconButton + 原生 controls fallback + fullscreen API

### Phase 10E: Node Graph 交互升级（依赖 Q4）
**仅当 Q4 确认时执行**

- [ ] 10E-1: Canvas — 键盘快捷键 + undo/redo + save/load + minimap click
- [ ] 10E-2: Connection — onclick + pointer-events:stroke
- [ ] 10E-3: Node — 选中点击
- [ ] 10E-4: Port — mousedown 连接发起
- [ ] 10E-5: InputNode — oninput 值更新
- [ ] 10E-6: Viewport — class name 回退 + event handlers

### Phase 10F: i18n 补全（依赖 Q10）
- [ ] 10F-1: 确认 tairitsu_i18n 提供等价 Provider/Switcher
- [ ] 10F-2: 如需补充，在 hikari-i18n 中添加 Provider 和 Switcher 组件

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

## 统计

| 指标 | 值 |
|------|-----|
| 审计组件总数 | ~110 个文件 |
| 完全一致 | ~70 个 |
| 需修复（中等问题） | ~20 个 |
| 严重缺失 | ~20 个 |
| 待确认问题 | 10 个 |
| 总测试数 | 613 (全部通过) |
| Clippy 警告 | 0 (源码) |
