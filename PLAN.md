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

## 当前阶段：优化和完善（Phase 4）

### 4.1 测试覆盖

**现状**：基础测试文件已存在，需要评估覆盖率和补充：

| 测试文件 | 状态 |
|---------|------|
| `components/tests/basic_components_tests.rs` | ✅ 已有 |
| `components/tests/feedback_components_tests.rs` | ✅ 已有 |
| `components/tests/feedback_layer2_tests.rs` | ✅ 已有 |
| `components/tests/feedback_remaining_tests.rs` | ✅ 已有 |
| `components/tests/data_components_tests.rs` | ✅ 已有 |
| `components/tests/navigation_components_tests.rs` | ✅ 已有 |
| `components/tests/collapse_tests.rs` | ✅ 已有 |
| `e2e/src/tests/basic_components.rs` | ✅ 已有 |
| `e2e/src/tests/data_components.rs` | ✅ 已有 |
| `e2e/src/tests/advanced_components.rs` | ✅ 已有 |
| `e2e/src/tests/form_components.rs` | ✅ 已有 |
| `e2e/src/tests/interactive_test.rs` | ✅ 已有 |
| `e2e/src/tests/ssr_tests.rs` | ✅ 已有 |
| `e2e/src/tests/visual_quality.rs` | ✅ 已有 |

**待办**：
- [ ] 补充 `production/` 组件的测试（VideoPlayer, AudioPlayer, RichTextEditor, CodeHighlight, MarkdownEditor, UserGuide）
- [ ] 补充 `display/` 组件的测试（Calendar, Carousel, Timeline, Skeleton, QRCode, Tag, Empty, Comment）
- [ ] 补充 `entry/` 组件的测试（AutoComplete, Cascader, NumberInput, Search, Transfer）
- [ ] 补充 `layout/` 组件的测试（Divider, Grid, Flex, Space, Section, Header, Footer, Aside, Content, AppLayout, Scrollbar, Container）
- [ ] 补充 `navigation/` 组件的测试（Anchor, Sidebar）

### 4.2 无障碍性（Accessibility）

- [ ] ARIA 标签：为所有交互组件添加 `aria-label`、`aria-describedby`、`aria-expanded` 等属性
- [ ] 键盘导航：确保 Menu、Tabs、Dropdown、Modal、Drawer 等组件支持键盘操作
- [ ] 焦点管理：Modal/Drawer 打开时焦点 trap，关闭时焦点返回触发元素
- [ ] 屏幕阅读器：为 Toast、Alert 等通知组件添加 `role="alert"` / `aria-live`

### 4.3 文档完善

- [ ] 组件 API 文档：为所有 public 组件添加 doc comment
- [ ] 示例代码 / Demo 页面：为每个组件提供可运行的 demo
- [ ] Storybook 集成（如适用）

### 4.4 性能优化

- [ ] 大列表渲染：验证 virtual_scroll 在大数据集下的性能
- [ ] 懒加载：评估组件级 code splitting 方案
- [ ] CSS 优化：审查 style_builder 生成的 CSS，避免冗余

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
