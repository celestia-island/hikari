# Hikari 组件库实现计划

> 更新时间: 2026-02-18 (持续重构)
> 状态: **代码规范重构进行中** 🔧

## 执行摘要

通过持续重构，已完成高优先级组件的 ClassesBuilder 改造。

### 已完成

- ✅ 59 个组件全部实现
- ✅ 所有组件通过编译和测试
- ✅ 修复了 5 个严重功能 bug
- ✅ **重构 4 个高优先级组件使用 ClassesBuilder**

### 重构进度

| 组件 | 问题数 | 状态 |
|------|--------|------|
| stepper.rs | 6 | ✅ 已完成 |
| sidebar.rs | 17 | ✅ 已完成 |
| carousel.rs | 7 | ✅ 已完成 |
| comment.rs | 9 | ✅ 已完成 |

---

## 待处理项

### 中优先级（硬编码颜色值）

| 文件 | 硬编码颜色 | 状态 |
|------|-----------|------|
| drag.rs | #4fd1c5, #a0aec0, rgba(79, 209, 197, 0.8) | 待修复 |
| code_highlight.rs | 语法高亮颜色 (#a5d6ff, #f1fa8c, #d4a5ff 等) | 待修复 |
| tag.rs | #0ea5e9 (success 应为绿色) | 待修复 |

### 低优先级（部分硬编码类名）

以下组件有部分硬编码，可在后续逐步清理：
- divider.rs, file_upload.rs, form_field.rs, select.rs, checkbox.rs
- slider.rs, switch.rs, radio_group.rs, badge.rs, button.rs
- card.rs, date_picker.rs, avatar.rs, breadcrumb.rs, menu.rs, tabs.rs

---

## 已知限制（设计决策）

| 组件 | 限制说明 |
|------|---------|
| video/audio_player | 使用原生控件 |
| code_highlight | 依赖外部高亮库 |
| rich_text_editor | 基础实现 |
| date_picker | 原生 date input |
| avatar/image | 动态计算样式用内联 |

---

## 提交记录

1. `feat: implement AudioPlayer and UserGuide components`
2. `feat: implement MarkdownEditor, DragLayer components`
3. `feat: complete all planned components`
4. `fix: resolve critical bugs (tooltip, stepper, carousel, calendar)`
5. `fix: add hover state to Tooltip, StyledComponent to Stepper`
6. `refactor: use ClassesBuilder in stepper.rs`
7. `refactor: use ClassesBuilder in sidebar, carousel, and comment components`

---

## 下一步

- [ ] 修复 drag.rs 硬编码颜色值
- [ ] 修复 tag.rs success 颜色
- [ ] 创建语法高亮 CSS 变量
