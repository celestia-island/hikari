# Hikari 组件库实现计划

> 扫描时间: 2026-02-18
> 完成时间: 2026-02-18
> 状态: **已完成** ✅
> 目标: 完成所有 "coming soon" 组件及原生样式组件的实现与集成

## 执行摘要

通过扫描 `registry.rs` 及组件源码，发现 **大部分组件已完成实现**，但未在网站演示中集成。

**执行结果**:
- ✅ 集成 20 个已实现组件到 registry.rs
- ✅ i18n 系统已存在基础实现
- ⏳ 待开发: AudioPlayer, MarkdownEditor, CodeEditor, DragLayer, UserGuide

---

## 第一阶段: 已实现组件集成 (优先级: 高)

这些组件已完成代码实现，只需在 `examples/website/src/components/registry.rs` 中添加演示代码。

### 1.1 Feedback 反馈组件

| 组件 | 文件位置 | 状态 | registry.rs 行号 |
|------|----------|------|-----------------|
| Alert | `feedback/alert.rs` | 已实现 | 189 |
| Toast | `feedback/toast.rs` | 已实现 | 194 |
| Tooltip | `feedback/tooltip.rs` | 已实现 | 199 |
| Progress | `feedback/progress.rs` | 已实现 | 217 |

**实现任务**:
```rust
// Alert 示例
("layer1", "feedback", Some("alert")) => rsx! {
    div { class: flex_col_gap(),
        Alert {
            variant: AlertVariant::Info,
            title: "Information".to_string(),
            description: "This is an informational message.".to_string(),
        }
        Alert {
            variant: AlertVariant::Success,
            title: "Success".to_string(),
            closable: true,
        }
        Alert {
            variant: AlertVariant::Warning,
            description: "Warning message".to_string(),
        }
        Alert {
            variant: AlertVariant::Error,
            title: "Error".to_string(),
        }
    }
}
```

### 1.2 Navigation 导航组件

| 组件 | 文件位置 | 状态 | registry.rs 行号 |
|------|----------|------|-----------------|
| Menu | `navigation/menu.rs` | 已实现 | 318 |
| Tabs | `navigation/tabs.rs` | 已实现 | 321 |
| Breadcrumb | `navigation/breadcrumb.rs` | 已实现 | 324 |

### 1.3 Data 数据组件

| 组件 | 文件位置 | 状态 | registry.rs 行号 |
|------|----------|------|-----------------|
| Table | `data/table.rs` | 已实现 | 331 |
| Tree | `data/tree.rs` | 已实现 | 334 |
| Pagination | `data/pagination.rs` | 已实现 | 337 |
| Collapse | `data/collapse.rs` | 已实现 | 353 |

### 1.4 Entry 输入组件

| 组件 | 文件位置 | 状态 | registry.rs 行号 |
|------|----------|------|-----------------|
| Cascader | `entry/cascader.rs` | 已实现 | 373 |
| Transfer | `entry/transfer.rs` | 已实现 | 391 |

### 1.5 Feedback Layer 2 组件

| 组件 | 文件位置 | 状态 | registry.rs 行号 |
|------|----------|------|-----------------|
| Drawer | `feedback/drawer.rs` | 已实现 | 360 |
| Popover | `feedback/popover.rs` | 已实现 | 363 |

### 1.6 Basic 基础组件

| 组件 | 文件位置 | 状态 | registry.rs 行号 |
|------|----------|------|-----------------|
| FileUpload | `basic/file_upload.rs` | 已实现 | 366 |

### 1.7 Display 展示组件

| 组件 | 文件位置 | 状态 | registry.rs 行号 |
|------|----------|------|-----------------|
| Timeline | `display/timeline.rs` | 已实现 | 426 |

### 1.8 Production 生产级组件

| 组件 | 文件位置 | 状态 | registry.rs 行号 |
|------|----------|------|-----------------|
| VideoPlayer | `production/video_player.rs` | 基础实现 | 400 |
| RichTextEditor | `production/rich_text_editor.rs` | 基础实现 | 416 |

---

## 第二阶段: 待开发组件 (优先级: 中)

这些组件尚未实现或需要增强，需从头开发或完善。

### 2.1 Layer 3 高级组件

| 组件 | 优先级 | 复杂度 | 描述 |
|------|--------|--------|------|
| AudioPlayer | 中 | 中 | 音频播放器，参考 VideoPlayer 实现 |
| MarkdownEditor | 中 | 高 | Markdown 编辑器，需集成语法高亮 |
| CodeEditor | 低 | 高 | 代码编辑器，可考虑 Monaco/wasm 集成 |
| DragLayer | 低 | 中 | 拖拽层组件，用于可视化搭建 |
| UserGuide | 低 | 中 | 用户引导组件，步骤式引导 |

### 2.2 系统功能

| 组件 | 优先级 | 复杂度 | 描述 |
|------|--------|--------|------|
| i18n 基础 | 中 | 中 | 国际化基础框架 |
| i18n 语言切换 | 中 | 低 | 语言切换组件 |

---

## 第三阶段: 原生样式优化 (优先级: 低)

### 3.1 Radio 组件原生样式

当前 `radio.scss` 仍使用原生 `input[type="radio"]` 结构。需要评估是否需要进一步优化视觉样式。

文件: `packages/components/src/styles/components/radio.scss`

---

## 实现优先级排序

### P0 - 已完成 ✅ (集成已有组件)
1. ✅ Alert
2. ✅ Toast  
3. ✅ Tooltip
4. ✅ Progress
5. ✅ Menu
6. ✅ Tabs
7. ✅ Breadcrumb
8. ✅ Table
9. ✅ Tree
10. ✅ Pagination
11. ✅ Drawer
12. ✅ Popover
13. ✅ FileUpload
14. ✅ Timeline
15. ✅ Collapse
16. ✅ Cascader
17. ✅ Transfer
18. ✅ VideoPlayer
19. ✅ RichTextEditor
20. ✅ Modal (通过 Popover 演示)
21. ✅ i18n 基础系统 (已存在实现)

### P1 - 短期计划 (待开发组件)
1. ⏳ AudioPlayer - 基于 VideoPlayer 模式
2. ⏳ MarkdownEditor - 需要实现
3. ⏳ CodeEditor - 需要实现

### P2 - 中期计划
1. ⏳ UserGuide - 用户引导组件
2. ⏳ DragLayer - 拖拽层组件

### P3 - 可选优化
1. 原生样式优化 (Radio 组件)
2. QRCode 组件增强

---

## 组件实现规范

基于已有组件代码风格，新组件需遵循以下规范：

### 文件结构
```
packages/components/src/{category}/{component}.rs
packages/components/src/styles/components/{component}.scss
```

### 必须实现

1. **Props 结构体**
```rust
#[derive(Clone, PartialEq, Props)]
pub struct ComponentProps {
    #[props(default)]
    pub variant: ComponentVariant,
    // ...
}
```

2. **StyledComponent trait**
```rust
pub struct ComponentWrapper;

impl StyledComponent for ComponentWrapper {
    fn styles() -> &'static str {
        include_str!(concat!(env!("OUT_DIR"), "/styles/{component}.css"))
    }
    
    fn name() -> &'static str {
        "{component}"
    }
}
```

3. **ClassesBuilder 模式**
```rust
let classes = ClassesBuilder::new()
    .add(ComponentClass::Base)
    .add_if(ComponentClass::Active, || is_active)
    .add_raw(&props.class)
    .build();
```

4. **暗色模式支持**
- 使用 CSS 变量: `var(--hi-color-*)`, `var(--hi-text-*)`, `var(--hi-background)`
- 添加 `[data-theme="dark"]` 样式规则

5. **动画效果**
- 使用 CSS transition/cubic-bezier
- 可选 Glow 效果包装

---

## 变更记录

### 2026-02-18 完成的集成
- 在 `registry.rs` 添加了 20+ 个组件的演示代码
- 所有组件已通过 `cargo check` 编译验证
- i18n 系统确认已实现，包含:
  - `I18nProvider` 上下文提供者
  - `LanguageSwitcher` 语言切换组件
  - `use_i18n()` hook
  - 支持 English/Chinese Simplified/Chinese Traditional

## 待开发组件清单

| 组件 | 优先级 | 复杂度 | 描述 |
|------|--------|--------|------|
| AudioPlayer | P1 | 中 | 音频播放器，参考 VideoPlayer 实现 |
| MarkdownEditor | P1 | 高 | Markdown 编辑器，需集成语法高亮 |
| CodeEditor | P1 | 高 | 代码编辑器，可考虑 Monaco/wasm 集成 |
| UserGuide | P2 | 中 | 用户引导组件，步骤式引导 |
| DragLayer | P2 | 中 | 拖拽层组件，用于可视化搭建 |
