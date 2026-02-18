# Hikari 组件库实现计划

> 完成时间: 2026-02-18
> 状态: **核心功能完成，代码规范待重构** ⚠️

## 执行摘要

通过三轮深度扫描，确认所有组件功能已实现，但存在大量代码规范问题。

### 已完成

- ✅ 59 个组件全部实现
- ✅ 所有组件通过编译和测试
- ✅ 修复了 5 个严重功能 bug (tooltip hover, stepper 类型错误等)
- ✅ stepper.rs 重构为使用 ClassesBuilder

### 发现的代码规范问题

通过第三轮扫描发现以下硬编码问题：

| 问题类型 | 文件数 | 问题数 | 优先级 |
|---------|--------|--------|--------|
| 完全未用 ClassesBuilder | 4 | 39 | 高 |
| 部分硬编码类名 | 15+ | 70+ | 中 |
| 硬编码 style | 12+ | 30+ | 中 |
| 硬编码颜色 | 6+ | 25+ | 中 |

---

## 代码规范问题详情

### 高优先级（完全未用 ClassesBuilder）

| 文件 | 问题数 | 状态 |
|------|--------|------|
| ~~stepper.rs~~ | ~~6~~ | ✅ 已修复 |
| sidebar.rs | 17 | 待重构 |
| carousel.rs | 7 | 待重构 |
| comment.rs | 9 | 待重构 |

### 中优先级（硬编码颜色值）

| 文件 | 硬编码颜色 |
|------|-----------|
| drag.rs | #4fd1c5, #a0aec0 |
| code_highlight.rs | 语法高亮颜色 |
| tag.rs | #0ea5e9 (错误) |

### 低优先级（硬编码类名）

divider.rs, file_upload.rs, form_field.rs, select.rs, checkbox.rs, 
slider.rs, switch.rs, radio_group.rs, badge.rs, button.rs, card.rs, 
date_picker.rs, avatar.rs, breadcrumb.rs, menu.rs, tabs.rs 等共 70+ 处

---

## 已知限制（设计决策）

以下限制是合理的设计决策，不需要修复：

| 组件 | 限制说明 |
|------|---------|
| video/audio_player | 使用原生控件 |
| code_highlight | 依赖外部高亮库 |
| rich_text_editor | 基础实现 |
| date_picker | 原生 date input |
| avatar/image | 动态计算样式用内联 |

---

## 长期重构计划

### Phase 1: 添加缺失的 Class 枚举
- [x] StepperClass
- [ ] CarouselClass
- [ ] CommentClass
- [ ] CollapseClass 完善
- [ ] TreeClass 子类

### Phase 2: 组件重构
- [ ] sidebar.rs
- [ ] carousel.rs
- [ ] comment.rs

### Phase 3: 颜色变量化
- [ ] 创建语法高亮 CSS 变量
- [ ] drag.rs 颜色替换

---

## 提交记录

1. `feat: implement AudioPlayer and UserGuide components`
2. `feat: implement MarkdownEditor, DragLayer components`
3. `feat: complete all planned components`
4. `fix: resolve critical bugs (tooltip, stepper, carousel, calendar)`
5. `fix: add hover state to Tooltip, StyledComponent to Stepper`
6. `refactor: use ClassesBuilder in stepper.rs`

---

## 确认

**所有组件功能已实现并通过测试。代码规范问题（硬编码类名/样式/颜色）已记录，可作为后续重构任务。**
