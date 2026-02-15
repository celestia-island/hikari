# Hikari Development & Maintenance Plan

## Overview

This plan tracks ongoing development, maintenance, and technical debt for the Hikari component library.

---

## Current Status

### Completed
- Type-safe CSS class refactoring (all components now use `UtilityClass` enums)
- Layer 1 & Layer 2 components implementation
- Chinese traditional color palette system
- Animation infrastructure (`AnimationBuilder`)
- **CodeHighlight clipboard fix** (2026-02-12) - Fixed button flickering and implemented real clipboard functionality
- **Checkbox visibility fix** (2026-02-12) - Fixed checkmark icon always visible, simplified state management
- **Checkbox styles compilation fix** (2026-02-12) - Fixed incomplete checkbox.scss in styles/components/ directory, cleaned up unused code
- **Radio component simplification** (2026-02-12) - Removed complex animation code, CSS-only transitions
- **Radio demo simplified** (2026-02-12) - Reduced to 3 options with 3rd disabled
- **Select Detail Modal** (2026-02-12) - Added modal with glow wrapper effect, focus only changes background

### Architecture
```
+------------------------------------------------------------------+
|                      Layer 3: Production Components               |
|  (Video Player, Rich Text Editor, Code Highlighting, Timeline)   |
|                            | depends on                           |
+------------------------------------------------------------------+
|                      Layer 2: Composite Components                |
|       (Menu, Tabs, Table, Tree, Form, Dropdown, Modal)           |
|                            | depends on                           |
+------------------------------------------------------------------+
|                       Layer 1: Basic Components                   |
|        (Button, Input, Card, Badge, Alert, Toast, etc.)          |
+------------------------------------------------------------------+
```

---

## Phase 1: Technical Debt & Maintenance

### 1.1 Empty/Stub Files

| File | Status | Action |
|------|--------|--------|
| `packages/components/src/data/header.rs` | Empty (1 byte) | ✅ Removed (commit a7cc059) |

### 1.2 Hardcoded Configuration Values ✅

Evaluated - All values are properly encapsulated:

| Location | Value | Status |
|----------|-------|--------|
| Responsive breakpoints | `Breakpoint` enum in `hooks.rs` with proper methods | ✅ Well-designed |
| Animation timings | User-configurable via props | ✅ Acceptable |
| Drawer sizes | Internal component constants | ✅ Acceptable |

### 1.3 Dynamic Typing Patterns (Acceptable)

The following `Box<dyn FnMut>` patterns are **intentional and correct** for WASM/JavaScript interop:

| File | Usage | Status |
|------|-------|--------|
| `scrollbar_container.rs` | JS event closures | Acceptable |
| `animation/builder.rs` | Animation callbacks | Acceptable |
| `hooks.rs` | Event listeners | Acceptable |

These are necessary for WASM bindings and don't represent technical debt.

---

## Phase 2: Layer 2 Component Completion ✅

### Missing Components (per layer-component-plan.md)

| Component | Priority | Dependencies | Status |
|-----------|----------|--------------|--------|
| Calendar | Medium | Button, Input, Card | ✅ Completed (2026-02-12) |
| Carousel | Low | Button, Card | Exists in `display/` |
| Collapse | Medium | Button, Card | Exists in `data/` |
| Stepper | Low | Button, Badge | Exists in `navigation/` |
| Timeline | Low | Card, Badge | ✅ Completed (2026-02-12) |
| Upload | Medium | Button, Progress | Exists as FileUpload in `basic/` |

---

## Phase 3: Layer 3 Production Components ✅

### High Priority

| Component | Description | Complexity | Dependencies | Status |
|-----------|-------------|------------|--------------|--------|
| **Code Highlighting** | Syntax highlighting, line numbers, themes | Medium | Card, Tabs, Form | ✅ Completed (2026-02-12), Fixed clipboard (2026-02-12) |
| **Video Player** | Playback controls, subtitles, playlist | High | Card, Button, Form, Menu | ✅ Completed (2026-02-12) |
| **Rich Text Editor** | WYSIWYG/Markdown, plugins | High | Form, Dropdown, Modal, Toolbar | ✅ Completed (2026-02-12) |

### Medium Priority

| Component | Description | Complexity | Dependencies | Status |
|-----------|-------------|------------|--------------|--------|
| **Timeline** | Event timeline, milestones | Medium | Card, Badge, Collapse | ✅ Completed (2026-02-12) |
| **User Guide** | Onboarding tours, feature hints | Medium | Modal, Button, Badge | Not started |

### Low Priority

| Component | Description | Complexity | Dependencies |
|-----------|-------------|------------|--------------|
| **Data Visualization** | Charts, dashboards | High | Card, Tabs, Form |
| **Code Editor** | Full IDE-like editing | High | Card, Tabs, Form, Menu |
| **Instant Messaging** | Chat UI, messages | High | Card, Form, Menu, Badge |

---

## Implementation Sequence

```mermaid
flowchart TD
    subgraph Phase1["Phase 1: Technical Debt"]
        A1[Remove empty header.rs]
        A2[Extract config constants]
    end

    subgraph Phase2["Phase 2: Layer 2 Completion"]
        B1[Calendar component]
        B2[Timeline component]
    end

    subgraph Phase3["Phase 3: Layer 3 Production"]
        C1[Code Highlighting]
        C2[Video Player]
        C3[Rich Text Editor]
    end

    A1 --> A2
    A2 --> B1
    B1 --> B2
    B2 --> C1
    C1 --> C2
    C2 --> C3

    classDef done fill:#90EE90,stroke:#006400,stroke-width:2px
    class A1,A2 done
```

---

## Notes

### Design Principles
1. **Progressive Enhancement** - Build from simple to complex
2. **Composition over Inheritance** - Compose Layer 3 from Layer 2, Layer 2 from Layer 1
3. **Single Responsibility** - Each component does one thing well
4. **Type Safety** - All CSS classes use `UtilityClass` enums

### Conventions
- Component class enums: `{ComponentName}Class` derives `Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize`
- Use `ClassesBuilder` pattern for composing classes
- Keep `.add_raw()` only for user-provided custom classes

---

## Historical: Type-Safe Refactoring (Completed)

The following enums were added during the refactoring to replace raw string literals:

| Phase | Enums Added |
|-------|-------------|
| 1 | `SwitchClass`, `SliderClass`, `SelectClass`, `DatePickerClass`, `FileUploadClass`, `FormFieldClass`, `DividerClass` |
| 2 | `AutoCompleteClass`, `CascaderClass`, `NumberInputClass`, `SearchClass`, `TransferClass` |
| 3 | `SpaceClass` (extended: `BadgeClass`, `ContainerClass`, `GlowClass`, `MenuClass`) |
| 4 | `TagClass`, `DescriptionListClass`, `EmptyClass`, `QRCodeClass` |
| 5 | `AppLayoutClass` |
| 6 | `DrawerClass`, `PopoverClass`, `ProgressClass`, `SkeletonClass`, `SpinClass` |
| 7 | `AnchorClass`, `StepsClass` |

---

## Phase 4: 通用 Popover 组件重构 ✅ 已完成

### 实现总结

#### 完成的工作

1. **重构 Popover 组件** (`feedback/popover.rs`)
   - 新增 `PopoverPositioning` 枚举：支持 Relative（相对定位+碰撞检测）和 Absolute（绝对定位）模式
   - 新增 `PopoverPlacement` 枚举：Bottom, Top, Left, Right
   - 新增 `PopoverAbsolutePosition` 枚举：Center, Fixed
   - 实现 `find_best_placement()` 碰撞检测函数
   - 添加 FUI 风格样式（毛玻璃效果、顶部强调线）

2. **扩展 Menu 组件** (`navigation/menu.rs`)
   - 新增 `MenuContext` 上下文结构
   - 新增 `in_popover` 属性
   - 当 `in_popover: true` 时，MenuItem 自动启用 Glow 光效
   - 新增 `PopoverMenu` CSS 类

3. **删除 Dropdown 组件**
   - 删除 `feedback/dropdown.rs`
   - 删除 `styles/components/dropdown.scss`
   - 从 `feedback/mod.rs` 移除导出
   - 从 `styled.rs` 移除 `DropdownComponent`
   - 从 `styles/index.scss` 移除导入

4. **更新使用场景**
   - `aside_footer.rs`：语言切换改用 Popover + Menu
   - `pagination.rs`：分页跳转改用 Popover

5. **保留 Select 组件的 Portal Dropdown 渲染**（内部实现）

#### 架构时序图

```mermaid
sequenceDiagram
    participant User as 用户
    participant Trigger as 触发按钮
    participant Popover as Popover 组件
    participant Collision as 碰撞检测
    participant Menu as Menu 组件
    participant MenuItem as MenuItem 组件
    participant Glow as Glow 效果

    User->>Trigger: 点击
    Trigger->>Popover: onclick 事件
    Popover->>Popover: open.set(true)
    
    alt Relative 模式
        Popover->>Collision: 获取触发元素位置
        Collision->>Collision: 检查 preferred 方向
        Collision->>Collision: 检查视口边界
        Collision-->>Popover: 返回最佳位置
    else Absolute 模式
        Popover->>Popover: 使用固定位置
    end
    
    Popover->>Menu: 渲染子内容
    Menu->>Menu: 提供 MenuContext { in_popover: true }
    
    loop 每个 MenuItem
        Menu->>MenuItem: 检查 context.glow_enabled
        MenuItem->>Glow: 启用光效包裹
        Glow->>MenuItem: 鼠标跟随光效
    end
    
    User->>Popover: 点击外部
    Popover->>Popover: close_on_click_outside
    Popover->>Popover: open.set(false)
```

#### 变更文件列表

| 文件 | 变更类型 |
|------|----------|
| `packages/components/src/feedback/popover.rs` | 重写 |
| `packages/components/src/feedback/dropdown.rs` | 删除 |
| `packages/components/src/feedback/mod.rs` | 修改 |
| `packages/components/src/navigation/menu.rs` | 修改 |
| `packages/components/src/data/pagination.rs` | 修改 |
| `packages/components/src/styled.rs` | 修改 |
| `packages/components/src/styles/index.scss` | 修改 |
| `packages/components/src/styles/components/dropdown.scss` | 删除 |
| `packages/palette/src/classes/components.rs` | 修改 |
| `examples/website/src/components/aside_footer.rs` | 修改 |

#### Commit

- `35b08a5` feat(components): 重构 Popover 组件，移除 Dropdown 组件
