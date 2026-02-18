# Hikari 组件库实现计划

> 更新时间: 2026-02-18 (第三轮扫描)
> 状态: **问题整理中** 🔍

## 第三轮扫描发现的问题

### 高优先级（违反 ClassesBuilder 规范）

| 文件 | 问题 | 数量 |
|------|------|------|
| **stepper.rs** | 完全未使用 ClassesBuilder | 6 处硬编码 |
| **sidebar.rs** | 完全未使用 ClassesBuilder | 17 处硬编码 |
| **carousel.rs** | 未使用 ClassesBuilder | 7 处硬编码 |
| **comment.rs** | 未使用 ClassesBuilder | 9 处硬编码 |

### 高优先级（硬编码颜色值）

| 文件 | 硬编码颜色 |
|------|-----------|
| **drag.rs** | #4fd1c5, #a0aec0, rgba(79, 209, 197, 0.8) |
| **code_highlight.rs** | #a5d6ff, #f1fa8c, #d4a5ff, #6ee7b7, #fca5a5, #ff6b6b |
| **video_player.rs** | #000 |
| **tag.rs** | #0ea5e9 (应为 success 绿色) |

### 中优先级（硬编码类名）

| 文件 | 数量 |
|------|------|
| divider.rs | 8 处 |
| file_upload.rs | 6 处 |
| form_field.rs | 8 处 |
| select.rs | 5 处 |
| checkbox.rs | 5 处 |
| slider.rs | 4 处 |
| switch.rs | 5 处 |
| radio_group.rs | 3 处 |
| badge.rs | 2 处 |
| button.rs | 3 处 |
| card.rs | 4 处 |
| date_picker.rs | 2 处 |
| avatar.rs | 3 处 |
| breadcrumb.rs | 6 处 |
| menu.rs | 10 处 |
| tabs.rs | 8 处 |

### 中优先级（硬编码 style）

| 文件 | 问题 |
|------|------|
| skeleton.rs | 2 处 |
| progress.rs | 3 处 |
| glow.rs | 1 处 |
| drag.rs | 6 处 |
| virtual_scroll.rs | 6 处 |
| pagination_button.rs | 3 处重复 |
| file_upload.rs | 2 处 |
| card.rs | 1 处 |
| slider.rs | 1 处 |
| menu.rs | 2 处 |
| tabs.rs | 1 处 |
| auto_complete.rs | 1 处 |

---

## 修复计划

### 阶段 1：添加缺失的 Class 枚举
- [ ] 添加 StepperClass 到 palette
- [ ] 添加 SidebarClass 到 palette
- [ ] 添加 CarouselClass 到 palette
- [ ] 添加 CommentClass 到 palette
- [ ] 添加 CollapseClass 到 palette
- [ ] 添加 TreeClass 子类

### 阶段 2：重构组件使用 ClassesBuilder
- [ ] stepper.rs
- [ ] sidebar.rs
- [ ] carousel.rs
- [ ] comment.rs

### 阶段 3：替换硬编码颜色为 CSS 变量
- [ ] drag.rs 颜色变量化
- [ ] code_highlight.rs 语法高亮变量化
- [ ] tag.rs 颜色修正

---

## 统计汇总

| 问题类型 | 文件数 | 问题数 |
|---------|--------|--------|
| 完全未用 ClassesBuilder | 4 | 39 |
| 部分硬编码类名 | 15+ | 70+ |
| 硬编码 style | 12+ | 30+ |
| 硬编码颜色 | 6+ | 25+ |
