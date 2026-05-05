# Hikari 开发计划（整合）

> 本文件整合了所有分散的 PLAN 文档，仅保留未完成的待办事项。
> 已完成的阶段已归档到 `docs/zhs/guides/layer-component-plan.md` 等文档中。

---

## 已归档（全部完成）

| 计划 | 归档位置 |
|------|---------|
| hikari-animation WIT 迁移 | `packages/animation/PLAN.md` |
| Layer 1 基础组件（17 + Divider + Skeleton = 19） | `docs/zhs/guides/layer-component-plan.md` |
| Layer 2 复合组件（11 + Collapse + Calendar + Carousel + Stepper + Timeline + Upload = 18） | 同上 |
| Layer 3 生产级组件（VideoPlayer, AudioPlayer, RichTextEditor, CodeHighlight, MarkdownEditor, UserGuide） | 同上 |
| 虚拟滚动 | `packages/components/src/data/virtual_scroll.rs` |

---

## Phase 4：优化和完善

### 4.1 测试覆盖 ✅

**已完成**：所有组件模块均有测试覆盖，总计 585 个单元测试通过。

| 测试文件 | 状态 |
|---------|------|
| `components/tests/basic_components_tests.rs` | ✅ 已有 |
| `components/tests/feedback_components_tests.rs` | ✅ 已有 |
| `components/tests/feedback_layer2_tests.rs` | ✅ 已有 |
| `components/tests/feedback_remaining_tests.rs` | ✅ 已有 |
| `components/tests/data_components_tests.rs` | ✅ 已有 |
| `components/tests/navigation_components_tests.rs` | ✅ 已有 |
| `components/tests/navigation_extra_tests.rs` | ✅ 已有 |
| `components/tests/collapse_tests.rs` | ✅ 已有 |
| `components/tests/production_components_tests.rs` | ✅ 已有 |
| `components/tests/display_components_tests.rs` | ✅ 已有 |
| `components/tests/entry_components_tests.rs` | ✅ 已有 |
| `components/tests/layout_components_tests.rs` | ✅ 已有（含 Grid/Col/Row/Section/Spacer/Header/Aside/Content/Scrollbar） |
| `e2e/src/tests/basic_components.rs` | ✅ 已有 |
| `e2e/src/tests/data_components.rs` | ✅ 已有 |
| `e2e/src/tests/advanced_components.rs` | ✅ 已有 |
| `e2e/src/tests/form_components.rs` | ✅ 已有 |
| `e2e/src/tests/interactive_test.rs` | ✅ 已有 |
| `e2e/src/tests/ssr_tests.rs` | ✅ 已有 |
| `e2e/src/tests/visual_quality.rs` | ✅ 已有 |

### 4.2 无障碍性（Accessibility） ✅

- [x] ARIA 标签：为 16 个交互组件添加了 ARIA 属性
  - Modal: `role="dialog"`, `aria-modal`, `aria-labelledby`
  - Drawer: `role="dialog"`, `aria-modal`, `aria-labelledby`, close `aria-label`
  - Select: `role="combobox"`, `aria-expanded`, `aria-haspopup`, `role="listbox"`, `role="option"`, `aria-selected`
  - Tooltip: `role="tooltip"`, `aria-describedby`
  - Popover: `aria-haspopup`, `aria-expanded`, `role="dialog"`
  - Toast: `role="alert"`, `aria-live="assertive"`
  - Alert: `role="alert"` / `role="status"`, `aria-live`
  - Switch: `role="switch"`, `aria-checked`, `tabindex="0"`, `aria-disabled`
  - Collapse: `role="button"`, `aria-expanded`, `aria-controls`, `aria-hidden`, `tabindex="0"`
  - Progress: `role="progressbar"`, `aria-valuenow/min/max`
  - IconButton: `aria-label`, `aria-disabled`
  - Input/Textarea: `aria-invalid`, `aria-label`
  - Pagination: `aria-current="page"`, `aria-label`, `aria-disabled`
- [x] 键盘导航：Menu、Tabs、Sidebar 已有键盘支持；Switch 添加 `tabindex`；Collapse 添加 `tabindex`
- [x] 焦点管理：Modal/Drawer 已有 `aria-modal` 支持
- [x] 屏幕阅读器：Toast `role="alert"` + `aria-live`；Alert `role="alert"/"status"`

### 4.3 文档完善 ✅（部分）

- [x] 组件 API 文档：为所有 public 组件添加了 doc comment（display/, feedback/, entry/, production/, layout/, navigation/）
- [ ] 示例代码 / Demo 页面：为每个组件提供可运行的 demo
- [ ] Storybook 集成（如适用）

### 4.4 性能优化 ✅（部分）

- [x] 大列表渲染：优化 virtual_scroll —— 使用轻量 FlatItem 替代完整节点克隆，消除 O(n) ID 查找
- [x] 懒加载：已评估组件级 code splitting 方案（见下方评估报告）
- [x] CSS 优化：
  - 修复 tag.rs 硬编码颜色，改用 CSS 变量
  - 修复 slider.rs 硬编码颜色
  - 提取 pagination_button.rs 重复内联样式为常量
  - 消除 progress.rs 重复 @keyframes

### 4.5 视觉质量 ✅（已完成）

**提交**: `2dabf4ad` + `8533066a`

全面视觉打磨，覆盖 **18 个 SCSS 组件文件**（+1148/-518 行）：

**完全重写 (4 个)**:
| 组件 | 改进 |
|------|------|
| Link | 尺寸/颜色变体、focus/active/visited/disabled 状态、图标支持、ghost 模式 |
| Anchor | FUI 亚克力重设计、ink-line 变体、全部 CSS 变量化 |
| Popover | 方向箭头、fade+scale 入场动画、位置变体、acrylic 背景 |
| Avatar | CSS 变量背景、可点击变体 + glow 光环、状态指示点、group 布局 |

**硬编码颜色消除 (14 个)**: Stepper、NumberInput、Slider、Switch(暗色主题)、Cascader、Divider、Card-vars、Header、Layout、Aside、Tabs、Breadcrumb、Menu、Sidebar

**Bug 修复 (3 个)**: Breadcrumb/Menu 不可见渐变 → 实色；Sidebar active 低对比度 → 白字+glow

---

### 懒加载评估报告 (4.4)

**当前状态**: 单体 WASM 架构，2.4MB bundle，零 code splitting。

**结论**: 技术可行但架构复杂。推荐分阶段实施：

| 阶段 | 方案 | 工期 | 效果 |
|------|------|------|------|
| Phase 1 | 利用已有 Cargo feature flags 排除 production 组件 | 3-5 天 | 立减 200-500KB |
| Phase 2 | 设计 WIT chunk 接口 (`render_page(route) -> vnode`) | 3-5 天 | 为真正 splitting 打基础 |
| Phase 3 | Shell WASM + 懒加载 chunk WASMs + JS 编排器 | 2-3 周 | 初始包减少 50-70% |
| Phase 4 | 共享 runtime 去重、chunk 缓存、预取 | 1 周 | 收尾优化 |

**最大快速收益**: Production 组件（RichTextEditor、VideoPlayer、CodeHighlight）及依赖（pulldown-cmark、chrono、qrcode）占 ~200-400KB，通过已有的 feature flags 即可排除。

---

## 额外发现

以下组件在实现中存在但未在原计划中列出，已自动补充：

| 组件 | 路径 | 分类 |
|------|------|------|
| DatePicker | `basic/date_picker.rs` | Layer 1 |
| FileUpload | `basic/file_upload.rs` | Layer 1 |
| IconButton | `basic/icon_button.rs` | Layer 1 |
| Typography | `basic/typography.rs` | Layer 1 |
| Link | `basic/link.rs` | Layer 1 |
| Textarea | `basic/textarea.rs` | Layer 1 |
| Canvas | `basic/canvas.rs` | Layer 1 |
| Arrow | `basic/arrow.rs` | Layer 1 |
| Background | `basic/background.rs` | Layer 1 |
| Anchor | `navigation/anchor.rs` | Layer 2 |
| Sidebar | `navigation/sidebar.rs` | Layer 2 |
| Popover | `feedback/popover.rs` | Layer 2 |
| Glow | `feedback/glow.rs` | Layer 2 |
| MarkdownEditor | `production/markdown_editor.rs` | Layer 3 |
| AudioPlayer | `production/audio_player.rs` | Layer 3 |
| Tag | `display/tag.rs` | Display |
| Empty | `display/empty.rs` | Display |
| Comment | `display/comment.rs` | Display |
| QRCode | `display/qrcode.rs` | Display |
| DragLayer | `display/drag_layer.rs` | Display |
| ZoomControls | `display/zoom_controls.rs` | Display |
| AutoComplete | `entry/auto_complete.rs` | Entry |
| Cascader | `entry/cascader.rs` | Entry |
| NumberInput | `entry/number_input.rs` | Entry |
| Search | `entry/search.rs` | Entry |
| Transfer | `entry/transfer.rs` | Entry |
| Grid | `layout/grid.rs` | Layout |
| Flex | `layout/flex.rs` | Layout |
| Space | `layout/space.rs` | Layout |
| Section | `layout/section.rs` | Layout |
| AppLayout | `layout/app_layout.rs` | Layout |
| Container | `layout/container.rs` | Layout |
| Header | `layout/header.rs` | Layout |
| Footer | `layout/footer.rs` | Layout |
| Aside | `layout/aside.rs` | Layout |
| Content | `layout/content.rs` | Layout |
| Scrollbar | `layout/scrollbar.rs` | Layout |
