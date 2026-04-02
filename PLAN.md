# Hikari 组件库 1:1 复刻计划

> **目标**: 将 hikari-legacy 的全部组件、样式、行为完整复刻到 current (Tairitsu WASI Component 架构)
>
> **Legacy**: `/mnt/sdb1/hikari-legacy` (Dioxus + wasm-bindgen/web-sys)
> **Current**: `/mnt/sdb1/hikari` (Tairitsu + WASI Component)

---

## 用户决策记录

| # | 问题 | 决策 |
|---|------|------|
| D1 | Platform API stubs | 等 tairitsu WIT 成熟后再接入，PLAN 中标注依赖 |
| D2 | Extra 组件渲染层 | **全部补渲染层** (所有 extra-component) |
| D3 | 表单验证系统 | **不恢复** (应用层自行处理) |
| D4 | i18n 系统 | **恢复 Rust 侧 i18n** (tairitsu-i18n) |
| D5 | CSS 颜色差异 | **全部回退到 legacy 值** |
| D6 | Website 复刻深度 | **完整 1:1 复刻** |

---

## 一、P0 - Platform API 依赖 (阻塞项)

> 所有依赖 `platform/wit.rs` 的功能需等 tairitsu WIT 成熟。PLAN 中标注每个组件的阻塞状态。

### 1.1 需要的 Platform API 及受影响组件

| API | 当前 stub 行为 | 受影响组件 | 优先级 |
|-----|---------------|-----------|--------|
| `get_bounding_client_rect()` | 返回 None | Select, Popover, Tooltip, Card Glow, Portal positioning | P0 |
| `set_timeout()` | no-op | Modal 关闭动画, Toast 自动消失, CodeHighlighter copy reset | P0 |
| `inner_width()` / `inner_height()` | 返回 1024 | hooks (use_screen_size, use_is_mobile, use_is_desktop) | P0 |
| `on_resize()` | no-op | 响应式布局, 媒体查询 hook | P0 |
| `request_animation_frame()` | no-op | Glow 鼠标追踪, Scrollbar 动画, Canvas 渲染 | P0 |
| `element_from_point()` | 返回 None | Glow 坐标追踪 | P0 |
| `get_target_element_from_event()` | 返回 None | Select/Popover 下拉宽度 | P0 |
| `prefers_dark_mode()` | 返回 false | ThemeProvider 暗色模式检测 | P1 |
| `draw_qrcode_on_canvas_by_id()` | no-op | QRCode 组件 | P1 |
| `exec_command()` / `get_inner_html()` | stub | RichTextEditor | P1 |
| `video_play/pause/seek/set_muted/set_volume()` | stub | VideoPlayer | P1 |
| `create_audio_context/analyser_node_*()` | stub | AudioPlayer, AudioWaveform | P1 |
| `set_content_editable()` / `get_selection_*()` | stub | RichTextEditor | P1 |
| `request_fullscreen()` | stub | VideoPlayer | P2 |

### 1.2 Action

- 为每个 stub 添加 `TODO(tairitsu-wit)` 注释
- 在组件文档中标注 "requires platform API: xxx"
- 非 stub 组件的修复**不阻塞**，可立即进行

---

## 二、P0 - SCSS/CSS 颜色回退

### 2.1 `theme/styles/base.scss` 颜色回退

| 变量 | Current (需改) | Legacy (目标) | 说明 |
|------|---------------|--------------|------|
| `--hi-color-surface` | `#E0F0E9` | `#F0F4F8` | 恢复 cool gray-white |
| `--hi-color-border` | `#C5D5CB` | `#C4D8DA` | 恢复 legacy 边框色 |
| `--hi-color-accent` | `#FFC773` | `#F7B500` | 恢复 amber |
| `--hi-color-warning` | `#FFF143` | `#EED677` | 恢复 soft yellow |
| `--hi-color-info` | `#3b82f6` | `#6ABED6` | 恢复 teal-cyan (魁卵青) |
| `--hi-overlay-color` | `var(--hi-color-black-95)` | `rgba(0,0,0,0.5)` | 恢复 50% 透明度 |
| Dark `--hi-color-background` | `#50616D` | `#0F172A` | 恢复 Slate-900 |
| Dark `--hi-color-surface` | `#4A4266` | `#1E293B` | 恢复 Slate-800 |
| Dark `--hi-overlay-color` | `var(--hi-color-white-95)` | `rgba(255,255,255,0.5)` | 恢复 50% 透明度 |

### 2.2 `theme/styles/foundation.scss` 修正

- `--hi-color-black-95: rgba(0,0,0,0.95)` → 保留但不再用于 overlay
- `--hi-color-white-95: rgba(255,255,255,0.95)` → 保留但不再用于 overlay
- Dark/Light overrides 中的 overlay 值同步回退

### 2.3 组件级 SCSS 修正

| 文件 | 修正内容 |
|------|---------|
| `icon.scss` | `color: inherit` → `color: var(--hi-color-text-primary)` |
| `icon_button.scss` | Ghost variant: `--hi-color-text-secondary` → `--hi-color-text-primary` |
| `icon_button.scss` | 默认尺寸 40px → 28px (`--hi-icon-button-size`) |
| `number_input.scss` | 39行委托版 → 恢复 174行自包含版（含完整按钮样式、dark theme） |
| `button.scss` | 移除 `.hi-button-css-transitions` 删除 — 需恢复 CSS-only transition fallback |
| `sidebar.scss` | 恢复 section header hover 内联 box-shadow glow |

---

## 三、P0 - 组件实现补全

### 3.1 hooks.rs 修复

**文件**: `packages/components/src/hooks.rs`
**问题**: 4个 hooks 全部依赖 platform stub
**方案**: 
- `use_screen_size`: 保留结构，添加 `#[cfg(feature = "native-platform")]` guard，stub 模式下返回合理默认值 + warn 日志
- `use_is_mobile` / `use_is_desktop`: 同上
- `use_media_query`: 同上

### 3.2 scripts/scrollbar_container.rs 恢复

**文件**: `packages/components/src/scripts/scrollbar_container.rs`
**问题**: 1007行 → 22行，全部功能被清空
**方案**: 从 legacy 移植完整实现，替换 web-sys 调用为 platform API
- 动画状态机
- 拖拽滚动
- ResizeObserver / MutationObserver (需 WIT)
- 滚动位置恢复
- 阻塞: `request_animation_frame`, `get_bounding_client_rect`, ResizeObserver

### 3.3 Select 定位修复

**文件**: `packages/components/src/basic/select.rs`
**问题**: `get_target_element_from_event()` 返回 None，下拉宽度不设置
**方案**: 
- 保留 platform API 调用，添加 fallback: 读取 trigger DOM 元素的 `offsetWidth`
- 或使用 CSS `min-width: 100%` 替代 JS 定宽

### 3.4 Popover/Tooltip 定位修复

**文件**: `packages/components/src/feedback/popover.rs`, `tooltip.rs`
**问题**: 同 Select，定位不准
**方案**: 
- 保留 `portal/positioning.rs` 中的智能定位逻辑
- 为 `get_bounding_client_rect` 返回 None 添加 fallback (屏幕居中)
- 添加 CSS `position: fixed` + `transform` 作为备用定位

### 3.5 Modal 关闭动画

**文件**: `packages/components/src/feedback/modal.rs`
**问题**: `set_timeout` 是 no-op，关闭动画不触发
**方案**: 
- 使用 CSS `animation` + `animationend` event 替代 JS timeout
- 或保留 timeout 调用 + CSS class toggle 作为 fallback

### 3.6 QRCode 渲染

**文件**: `packages/components/src/display/qrcode.rs`
**问题**: `draw_qrcode_on_canvas_by_id()` 是 stub
**方案**: 
- 使用 inline SVG 替代 Canvas (不依赖 platform API)
- 或使用 CSS `background-image` + data URI
- 阻塞: 无 (可用纯 CSS/SVG 方案绕过)

### 3.7 Tabs 简化问题

**文件**: `packages/components/src/navigation/tabs.rs`
**问题**: 322行 → 175行，功能大幅简化
**方案**: 对比 legacy，补回：
- TabPane 的 disabled 状态
- closable tab 支持
- tab 滚动 (当 tab 数量溢出时)
- 键盘导航 (左右箭头)

### 3.8 NumberInput 简化问题

**文件**: `packages/components/src/entry/number_input.rs`
**问题**: 318行 → 178行
**方案**: 对比 legacy，补回：
- 完整的步进逻辑 (hold-to-repeat)
- min/max clamp
- precision 控制
- 键盘支持 (上下箭头)

### 3.9 Theme Provider 修复

**文件**: `packages/components/src/theme/provider.rs`
**问题**: `set_theme` callback 是 no-op: `Callback::new(|_| {})`
**方案**: 
- 使用 tairitsu-hooks 的 `provide_context` / `use_context` 实现响应式主题切换
- `set_theme` 应更新 `data-theme` attribute + 重新注入 CSS 变量
- 添加 `TODO(tairitsu-hooks)` 注释直到实现

### 3.10 Style Provider 修复

**文件**: `packages/components/src/theme/style_provider.rs`
**问题**: `use_style()` 返回 `StyleContext::default()`，`try_use_style()` 返回 None
**方案**: 
- 实现 `provide_context` + `use_context` 的 style context
- 保留 `StyleConfig` 和 `use_component_class()` 功能

---

## 四、P0 - Extra Components 渲染层补全

### 4.1 实施原则

- 每个 extra-component 保留现有数据模型 (serde derives, builder patterns, state methods)
- 新增渲染函数，使用 `tairitsu_vdom::VNode` 构建 UI
- 渲染函数签名: `pub fn render_xxx(state: &XxxState, props: XxxProps) -> VNode`
- 所有 `web_sys` 调用替换为 `platform::` API (标注 WIT 依赖)

### 4.2 渲染层补全清单

| # | 组件 | Legacy LOC | 数据模型 LOC | 需新增渲染 | 依赖 Platform API | 优先级 |
|---|------|-----------|-------------|-----------|-----------------|--------|
| 1 | **NodeGraphCanvas** | 613 | 430 | ~200行 SVG canvas | request_animation_frame | **P0** |
| 2 | **UserGuide** | 494 | 386 | ~150行 modal overlay | set_timeout | **P0** |
| 3 | **Timeline** | 289 | 339 | ~100行 items | 无 | **P0** |
| 4 | **DragLayer** | 254 | 388 | ~120行 drag overlay | mouse events | **P1** |
| 5 | **CodeHighlighter** | 530 | 519 | ~120行 (syntax + copy) | clipboard, set_timeout | **P1** |
| 6 | **RichTextEditor** | 289 | 450 | ~100行 toolbar + content | exec_command, get_inner_html | **P1** |
| 7 | **VideoPlayer** | 237 | 425 | ~80行 video + controls | video_play/pause/seek | **P1** |
| 8 | **AudioWaveform** | 399 | 462 | ~120行 canvas + audio | audio_context, analyser | **P1** |
| 9 | **Collapsible** | 139 | 190 | ~80行 toggle + content | 无 | **P2** |
| 10 | **CollapsibleCard** | 93 | 49 | ~60行 (wraps Collapsible) | 无 | **P2** |
| 11 | **DraggableCard** | 104 | 45 | ~70行 (wraps DragLayer) | mouse events | **P2** |
| 12 | **ZoomControls** | 191 | 346 | ~80行 buttons | keyboard events | **P2** |
| 13 | **Node (NodeGraph)** | 309 | 387 | ~80行 (header, ports, body) | 无 | **P1** |
| 14 | **Connection** | 254 | 269 | ~60行 SVG path + marker | 无 | **P1** |
| 15 | **Port** | 76 | 174 | ~40行 (dot, label) | mouse events | **P1** |
| 16 | **Minimap** | 49 | 186 | ~40行 SVG | 无 | **P2** |

### 4.3 Node Graph 特殊处理

NodeGraphCanvas 是最复杂的组件 (legacy 613行)，包含：
- SVG canvas + grid pattern + connections layer + nodes layer
- minimap overlay
- 键盘快捷键 (arrows, Ctrl+Z/Y, +/-, 0)
- undo/redo 应用 HistoryAction 到 state
- save/load handlers
- minimap click-to-pan

**方案**: 
- 数据模型已完整 (NodeGraphState + NodeGraphCanvasConfig + NodeGraphEvent)
- 新增 `render_node_graph_canvas()` 函数
- 键盘事件使用 platform API (标注依赖)
- SVG 渲染使用 VNode (tairitsu 支持)

---

## 五、P0 - Animation Package 修复

### 5.1 需恢复的模块

| 模块 | Legacy | Current | Action |
|------|--------|---------|--------|
| `hooks/animated_value.rs` | 动画值 hook | **已删除** | 用 tairitsu-hooks 重写 |
| `hooks/animation_frame.rs` | requestAnimationFrame hook | **已删除** | 用 tairitsu-hooks 重写 (依赖 WIT) |
| `hooks/continuous.rs` | 连续动画 hook | **已删除** | 用 tairitsu-hooks 重写 |
| `hooks/tween.rs` | 补间动画 hook | **已删除** | 用 tairitsu-hooks 重写 |
| `provider.rs` | AnimationProvider 组件 | **已删除** | 用 tairitsu context 重写 |
| `glow.rs` | Glow 类型 | **已删除** | 评估是否与 components/glow.rs 重复 |
| `lib.rs` transition presets | 10个 CSS 过渡预设函数 | **已删除** | 恢复为纯 CSS class 生成器 |

### 5.2 保留的新增

| 模块 | 说明 |
|------|------|
| `state_machine/button.rs` | Button FSM — 保留 (534行，比 legacy 更完善) |
| `background_animation/` | 背景动画 — 保留 |

---

## 六、P0 - Website 示例 1:1 复刻

### 6.1 Sidebar 恢复

**当前**: 50行扁平链接列表
**目标**: 743行 3层可折叠 Menu (带图标、i18n labels、滚动位置保持)

**方案**:
- 恢复 `components/sidebar.rs` 使用 hikari Menu/SubMenu/MenuItem 组件
- 恢复 `components/sidebar_tree.rs` 路由树结构
- 恢复 `components/aside_footer.rs`
- 使用 tairitsu-i18n keys 替代 Dioxus i18n

### 6.2 App 路由恢复

**当前**: 80行单 VNode，JS toggle `.is-active`
**目标**: 643行 `#[derive(Routable)]` 40+ 路由

**方案**:
- 使用 tairitsu 路由系统 (JS History API bridge) 实现 40+ 路由
- 每个路由 → 对应页面组件
- 恢复 URL-based 语言切换 (`/:lang/...`)
- 恢复 `use_update_language_from_route()` 逻辑

### 6.3 页面 SCSS 恢复

**当前**: 2个 SCSS 文件 (spa.scss, animations.scss)
**目标**: 8个 SCSS 文件

| 文件 | Action |
|------|--------|
| `aside_footer.scss` | 恢复 |
| `code_block.scss` | 恢复 |
| `home.scss` | 恢复 |
| `index.scss` | 恢复 |
| `layout.scss` | 恢复 |
| `markdown_renderer.scss` | 恢复 |
| `pages.scss` | 恢复 |
| `showcase.scss` | 恢复 |

### 6.4 缺失页面恢复

| 页面 | Action |
|------|--------|
| `demos/layer3/video_demo.rs` | 恢复 (从 legacy 移植) |
| `components/layer1/button.rs` 等 12 个 | 恢复为独立路由页面 |
| `components/layer2/navigation.rs` 等 12 个 | 恢复 |
| `components/layer3/media.rs` 等 5 个 | 恢复 |
| `components/layer1/form.rs` | 恢复 |
| 面包屑导航 | 恢复 Breadcrumb 组件在页面中 |
| `page_layout.rs` (DemoSection, PageContainer) | 恢复 |
| `code_block.rs` | 恢复 |
| `registry.rs` | 恢复 |

### 6.5 Animation Demo 恢复

**当前**: 266行静态 CSS class demos
**目标**: 347行交互式 `use_signal` demo

**方案**:
- 恢复 glow/neon/tech/transition 交互控制
- 使用 tairitsu-hooks 的信号系统
- 保留 current 的静态 CSS demos 作为基础层

### 6.6 Rust 侧 i18n 恢复

**方案**:
- 使用 `tairitsu-i18n` crate (已在 Cargo.toml)
- 恢复 9种语言 TOML keys
- 恢复 `I18nProviderWrapper` 组件 (tairitsu VNode 版)
- 恢复 URL-based 语言路由 (`/:lang/...`)
- 恢复 sidebar labels / breadcrumbs / page text 翻译

---

## 七、P1 - 组件细节修复

### 7.1 各组件简化补回

| 组件 | Legacy | Current | 需补回 |
|------|--------|---------|--------|
| `card.rs` | 430 | 330 | CardMedia 的图片加载/错误处理 |
| `background.rs` | 205 | 122 | 渐变动画配置 |
| `file_upload.rs` | 341 | 299 | 拖拽上传 UI 反馈 |
| `spin.rs` | 190 | 147 | 自定义大小/颜色 props |
| `tree.rs` | 172 | 112 | 虚拟滚动集成 |
| `menu.rs` | 470 | 358 | submenu 动画延迟 |
| `sidebar.rs` | 418 | 308 | 折叠/展开过渡动画 |
| `tabs.rs` | 322 | 175 | tab overflow 滚动 + closable |
| `calendar.rs` | 434 | 398 | 日期范围选择 |
| `timeline.rs` (display) | 339 | 231 | 自定义 timeline dot/icon |
| `tag.rs` | 235 | 185 | 标签关闭按钮 + 动画 |
| `empty.rs` | 160 | 127 | 自定义图片/描述 |
| `comment.rs` | 191 | 149 | 嵌套回复 |
| `search.rs` | 367 | 263 | 搜索建议 dropdown 动画 |
| `number_input.rs` | 318 | 178 | hold-to-repeat, precision |
| `auto_complete.rs` | 362 | 326 | 键盘导航高亮 |

### 7.2 Production 组件

| 组件 | 问题 | 方案 |
|------|------|------|
| `audio_player.rs` | 依赖 stub audio API | 保留数据模型，渲染标注 WIT 依赖 |
| `code_highlight.rs` | 简化版 | 对比 legacy 补回语法高亮主题 |
| `video_player.rs` | 依赖 stub video API | 保留数据模型，渲染标注 WIT 依赖 |
| `rich_text_editor.rs` | 依赖 stub exec_command | 保留数据模型，渲染标注 WIT 依赖 |
| `markdown_editor.rs` | 575行 (已扩展) | 对比确认与 legacy 一致 |

---

## 八、P2 - 其他改进

### 8.1 Palette `button_glow_color()` 回退

| 情况 | Current (需改) | Legacy (目标) |
|------|---------------|--------------|
| Pink primary glow | `rgba(238,162,164,0.5)` (pink) | `rgba(0,0,0,0.7)` (black) |
| Deep blue primary glow | `rgba(20,74,116,0.5)` (blue) | `rgba(255,255,255,0.7)` (white) |
| Algorithm | `color.rgba(0.5)` | `color.glow_contrast_dynamic_rgba()` |

### 8.2 lib.rs 恢复

- 恢复 `get_utility_classes()` 函数
- 恢复 `get_complete_bundle()` 函数
- 恢复 feature flag gating (可选)

### 8.3 styled.rs 恢复

- 恢复 doc comments
- 确认 `register_basic_components` 包含所有组件

### 8.4 E2E 扩展

- current 的 e2e 新增了 SSR 测试，保留
- 补回 legacy 的浏览器 debug 工具

---

## 九、实施顺序

### Phase 1: CSS 颜色回退 (无阻塞)
1. `base.scss` 颜色值回退 (9个变量)
2. `foundation.scss` overlay 修正
3. `icon.scss`, `icon_button.scss` 颜色/尺寸回退
4. `number_input.scss` 恢复自包含版本
5. `palette/themes.rs` `button_glow_color()` 回退

### Phase 2: 组件核心修复 (无阻塞)
6. `hooks.rs` 添加 fallback 默认值 + 日志
7. `theme/provider.rs` 实现 set_theme callback
8. `theme/style_provider.rs` 实现 context provider
9. `select.rs` 添加 CSS fallback 定位
10. `popover.rs` / `tooltip.rs` 添加 fallback 居中
11. `modal.rs` CSS animation 替代 JS timeout
12. `qrcode.rs` SVG 替代 Canvas
13. `tabs.rs` 补回 disabled/closable/scroll
14. `number_input.rs` 补回步进/precision/键盘
15. 各组件细节修复 (7.1 节清单)

### Phase 3: Extra Components 渲染层
16. NodeGraph Canvas + Node + Connection + Port 渲染
17. UserGuide 渲染
18. Timeline 渲染
19. DragLayer 渲染
20. CodeHighlighter 渲染
21. RichTextEditor / VideoPlayer / AudioWaveform 渲染
22. Collapsible / CollapsibleCard / DraggableCard / ZoomControls 渲染
23. Minimap 渲染

### Phase 4: Animation Package
24. 恢复 hooks 模块 (animated_value, animation_frame, continuous, tween)
25. 恢复 provider 模块
26. 恢复 transition presets (10个函数)
27. 评估 glow.rs 是否需要恢复

### Phase 5: Website 1:1 复刻
28. 恢复 SCSS 文件 (8个)
29. 恢复 sidebar (3层 Menu + i18n)
30. 恢复 App 路由 (40+ routes)
31. 恢复缺失页面 (video_demo, component docs)
32. 恢复 animation demo (交互式)
33. 恢复 i18n (Rust 侧, 9语言)
34. 恢复面包屑导航
35. 恢复 page_layout / code_block / registry

### Phase 6: Scrollbar + Platform
36. 恢复 scrollbar_container.rs (标注 WIT 依赖)
37. 为所有 platform stub 添加 TODO 注释

---

## 十、风险与阻塞

| 风险 | 影响 | 缓解方案 |
|------|------|---------|
| tairitsu-hooks 的 `provide_context`/`use_context` 不成熟 | Theme/Style/Animation Provider 无法实现 | 降级为全局变量 + CSS class 切换 |
| tairitsu 路由不支持嵌套路由 | Website 40+ 路由无法实现 | 使用 JS History API bridge (current 已有) |
| SVG namespace 渲染 | NodeGraph SVG 可能不正确 | tairitsu VNode 需支持 `xmlns` attribute |
| Event delegation | 鼠标/键盘事件在 WASI 中受限 | 使用 JS bridge 事件转发 |

---

## 附录: 完整组件对照表 (带差距分析)

> "差距" 列: `= ` 功能等价, `+` current 超集, `-` current 缺失, `!` 严重缺失

### Basic (20)

| 组件 | Legacy | Current | 差距 | 需修复 |
|------|--------|---------|------|--------|
| Button | 308 | 238 | `+` | 无 |
| Input | 208 | 230 | `+` | 无 |
| Card | 430 | 330 | `-` | CardMedia 加载处理 |
| Badge | 144 | 128 | `=` | 无 |
| Checkbox | 145 | 120 | `=` | 无 |
| Switch | 377 | 408 | `+` | 无 |
| RadioGroup | 132 | 139 | `=` | 无 |
| Select | 306 | 289 | `!` | 定位 (platform stub) |
| Slider | 210 | 214 | `+` | 无 |
| Textarea | 201 | 174 | `+` | 无 |
| IconButton | 174 | 218 | `+` | 无 |
| Arrow | 113 | 97 | `=` | 无 |
| Canvas | 68 | 52 | `=` | 无 |
| Avatar | 166 | 172 | `=` | 无 |
| Image (+Logo) | 196 | 210 | `=` | 无 |
| InputWrapper | - | 261 | `+` | 无 (新增) |
| Background | 205 | 122 | `-` | 渐变动画 |
| DatePicker | 188 | 194 | `=` | 无 |
| FileUpload | 341 | 299 | `-` | 拖拽反馈 |
| FormField | 169 | 181 | `=` | 无 |

### Feedback (9)

| 组件 | Legacy | Current | 差距 | 需修复 |
|------|--------|---------|------|--------|
| Alert | 161 | 174 | `=` | 无 |
| Toast | 185 | 158 | `!` | setTimeout stub |
| Tooltip | 139 | 127 | `!` | 定位 (platform stub) |
| Modal | 208 | 196 | `!` | setTimeout stub |
| Drawer | 402 | 346 | `=` | 无 |
| Popover | 306 | 287 | `!` | 定位 (platform stub) |
| Progress | 222 | 229 | `=` | 无 |
| Spin | 190 | 147 | `-` | 自定义 props |
| Glow | 225 | 407 | `+` | 无 |

### Navigation (14)

| 组件 | Legacy | Current | 差距 | 需修复 |
|------|--------|---------|------|--------|
| Tabs | 322 | 175 | `!` | 严重简化 |
| Menu | 470 | 358 | `-` | submenu 动画 |
| Breadcrumb | 176 | 149 | `=` | 无 |
| Steps | 327 | 411 | `+` | 无 |
| Sidebar | 418 | 308 | `-` | 折叠动画 |
| Stepper | 231 | 221 | `=` | 无 |
| Anchor | 182 | 140 | `=` | 无 |

### Layout (16)

| 组件 | Legacy | Current | 差距 | 需修复 |
|------|--------|---------|------|--------|
| Layout (AppLayout) | - | - | `=` | 无 |
| Container | - | - | `=` | 无 |
| FlexBox | - | - | `=` | 无 |
| Space | - | - | `=` | 无 |
| Divider | 180 (basic) | - | `=` | 已移到 layout |
| Header/Footer/Aside/Content | - | - | `=` | 无 |
| Grid/Col/Row | - | - | `=` | 无 |
| Section/Spacer | - | - | `=` | 无 |
| ScrollbarContainer | 1007 | 22 | `!` | 需完全恢复 |

### Data (15)

| 组件 | Legacy | Current | 差距 | 需修复 |
|------|--------|---------|------|--------|
| Table | 428 | 373 | `=` | 无 |
| Tree | 172 | 112 | `-` | 虚拟滚动 |
| Pagination | 640 | 740 | `+` | 无 |
| Cell/Column | 590 | 505 | `-` | 细节适配 |
| Collapse | 295 | 286 | `=` | 无 |
| DragDropTree | 296 | 325 | `=` | 无 |
| VirtualScroll | 172 | 168 | `=` | 无 |
| Filter/Selection/Sort | 656 | 746 | `+` | 无 |

### Display (16)

| 组件 | Legacy | Current | 差距 | 需修复 |
|------|--------|---------|------|--------|
| Tag | 235 | 185 | `-` | 关闭按钮 |
| Empty | 160 | 127 | `-` | 自定义内容 |
| Comment | 191 | 149 | `-` | 嵌套回复 |
| QRCode | 199 | 161 | `!` | 渲染 stub |
| Calendar | 434 | 398 | `-` | 日期范围 |
| Timeline | 339 | 231 | `-` | 自定义 dot |
| Carousel | 446 | 468 | `=` | 无 |
| Skeleton | 344 | 405 | `+` | 无 |
| UserGuide | 423 | 420 | `-` | 渲染层 |
| DragLayer | 189 | 168 | `=` | 渲染层 |
| ZoomControls | 211 | 190 | `=` | 渲染层 |

### Entry (5)

| 组件 | Legacy | Current | 差距 | 需修复 |
|------|--------|---------|------|--------|
| NumberInput | 318 | 178 | `!` | 严重简化 |
| Search | 367 | 263 | `-` | 搜索建议动画 |
| AutoComplete | 362 | 326 | `-` | 键盘导航 |
| Cascader | 384 | 377 | `=` | 无 |
| Transfer | 382 | 367 | `=` | 无 |

### Production (5)

| 组件 | Legacy | Current | 差距 | 需修复 |
|------|--------|---------|------|--------|
| AudioPlayer | 249 | 217 | `!` | platform stub |
| CodeHighlight | 345 | 312 | `-` | 主题 |
| VideoPlayer | 114 | 218 | `!` | platform stub |
| RichTextEditor | 169 | 225 | `!` | platform stub |
| MarkdownEditor | 539 | 575 | `+` | 无 |

### Extra (17)

| 组件 | Legacy | Current | 差距 | 需修复 |
|------|--------|---------|------|--------|
| Collapsible | 139 | 190 | `-` | 渲染层 |
| CollapsibleCard | 93 | 49 | `-` | 渲染层 |
| DraggableCard | 104 | 45 | `-` | 渲染层 |
| DragLayer | 254 | 388 | `-` | 渲染层 |
| CodeHighlighter | 530 | 519 | `-` | 渲染层 |
| RichTextEditor | 289 | 450 | `-` | 渲染层 |
| VideoPlayer | 237 | 425 | `-` | 渲染层 |
| AudioWaveform | 399 | 462 | `-` | 渲染层 |
| Timeline | 289 | 339 | `-` | 渲染层 |
| UserGuide | 494 | 386 | `-` | 渲染层 |
| ZoomControls | 191 | 346 | `-` | 渲染层 |
| NodeGraphCanvas | 613 | 430 | `!` | 渲染层 |
| Node | 309 | 387 | `-` | 渲染层 |
| Connection | 254 | 269 | `-` | 渲染层 |
| Port | 76 | 174 | `-` | 渲染层 |
| History | 242 | 242 | `=` | 无 |
| Minimap | 49 | 186 | `-` | 渲染层 |
