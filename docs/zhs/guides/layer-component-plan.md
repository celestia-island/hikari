# Layer 分层组件计划：三层次组件体系

## 概述

Hikari 采用三层次组件体系，从基础到复杂逐步构建。Layer 1 提供原子级组件，Layer 2 组合 Layer 1 构建复合组件，Layer 3 基于 Layer 2 实现生产级复杂功能。

## 设计理念

### 核心原则

1. **渐进式增强** - 从简单到复杂
2. **可复用性** - 高层组件可复用低层组件
3. **单一职责** - 每个组件只做一件事
4. **组合优于继承** - 通过组合构建复杂功能

### 职责划分

| Layer | 职责 | 复杂度 | 状态管理 |
|-------|------|--------|---------|
| **Layer 1** | 原子级 UI 元素 | 低 | 局部状态 |
| **Layer 2** | 复合 UI 模式 | 中 | 局部状态 + Context |
| **Layer 3** | 完整业务功能 | 高 | 全局状态 + 复杂逻辑 |

## Layer 1: 基础组件

**定义**：不可再分的原子级 UI 元素

**特点**：单一职责、无复杂状态管理、高度可复用

### 已完成的组件

| 组件 | 路径 | 状态 |
|------|------|------|
| Button | `basic/button.rs` | ✅ |
| Input | `basic/input.rs` | ✅ |
| Card | `basic/card.rs` | ✅ |
| Badge | `basic/badge.rs` | ✅ |
| Alert | `feedback/alert.rs` | ✅ |
| Toast | `feedback/toast.rs` | ✅ |
| Tooltip | `feedback/tooltip.rs` | ✅ |
| Select | `basic/select.rs` | ✅ |
| Checkbox | `basic/checkbox.rs` | ✅ |
| Radio | `basic/radio_group.rs` | ✅ |
| Switch | `basic/switch.rs` | ✅ |
| Avatar | `basic/avatar.rs` | ✅ |
| Image | `basic/image.rs` | ✅ |
| Slider | `basic/slider.rs` | ✅ |
| Progress | `feedback/progress.rs` | ✅ |
| Spin | `feedback/spin.rs` | ✅ |
| FormField | `basic/form_field.rs` | ✅ |

### 待开发

| 组件 | 优先级 | 功能描述 |
|------|--------|---------|
| **Divider** | 低 | 分割线 |
| **Skeleton** | 低 | 骨架屏 |

## Layer 2: 复合组件

**定义**：由多个 Layer 1 组件组合而成的复合组件

**特点**：组合基础组件、有一定的状态管理、提供常见 UI 模式、支持 Context 共享状态

### 已完成的组件

| 组件 | 路径 | 依赖的 Layer 1 | 状态 |
|------|------|---------------|------|
| Menu | `navigation/menu.rs` | Button, Card | ✅ |
| Tabs | `navigation/tabs.rs` | Button | ✅ |
| Breadcrumb | `navigation/breadcrumb.rs` | Button | ✅ |
| Table | `data/table.rs` | Button, Card, Input | ✅ |
| Tree | `data/tree.rs` | Button | ✅ |
| Pagination | `data/pagination.rs` | Button | ✅ |
| Dropdown | `feedback/dropdown.rs` | Button, Menu | ✅ |
| Modal | `feedback/modal.rs` | Card, Button | ✅ |
| Drawer | `feedback/drawer.rs` | Card, Button | ✅ |
| Steps | `navigation/steps.rs` | Button, Badge | ✅ |
| Form | `utils/form.rs` | Input, Select, Checkbox, Radio | ✅ |

### 待开发

| 组件 | 优先级 | 功能描述 | 依赖的 Layer 1 |
|------|--------|---------|---------------|
| **Collapse** | 中 | 可折叠面板 | Button, Card |
| **Upload** | 中 | 文件上传 | Button, Progress |
| **Calendar** | 中 | 日历选择器 | Button, Input |
| **Carousel** | 低 | 轮播图 | Button, Card |
| **Timeline** | 低 | 时间轴 | Card, Badge |

## Layer 3: 生产级组件

**定义**：完整的业务功能，基于 Layer 2 构建

**特点**：复杂状态管理、完整业务逻辑、高性能优化、生产环境验证

### 计划中的组件

| 组件 | 优先级 | 功能描述 | 依赖的 Layer 2 | 复杂度 |
|------|--------|---------|---------------|--------|
| **视频/音频播放器** | 高 | 播放控制、字幕、播放列表 | Card, Button, Form, Menu | 高 |
| **富文本编辑器** | 高 | 富文本编辑、Markdown、插件 | Form, Dropdown, Modal, Toolbar | 高 |
| **代码高亮设施** | 高 | 语法高亮、行号、主题切换 | Card, Tabs, Form | 中 |
| **时间线** | 中 | 事件时间线、里程碑 | Card, Badge, Collapse | 中 |
| **用户引导组件** | 中 | 新手引导、功能介绍、步骤提示 | Modal, Button, Badge | 中 |
| **数据可视化** | 低 | 图表、仪表盘、报表 | Card, Tabs, Form | 高 |

## 开发优先级

| 阶段 | 目标 | 预计时间 |
|------|------|---------|
| 阶段 1 | 完善 Layer 1（Divider、Skeleton） | 1 周 |
| 阶段 2 | 完善 Layer 2（Collapse、Upload、Calendar 等） | 2-3 周 |
| 阶段 3 | 实现 Layer 3（代码高亮、播放器、编辑器等） | 4-6 周 |
| 阶段 4 | 性能优化、文档完善、测试覆盖 | 2-3 周 |

## 技术说明

- **图标系统**：使用 Material Design Icons (MDI)，7000+ 图标
- **路由系统**：使用 Tairitsu 的 Routable derive 宏
- **构建命令**：`just build`（Release）/ `just build-dev`（Debug）/ `just dev`（开发服务器）
