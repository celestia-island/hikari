# Hikari 组件库迁移计划

> Legacy (Dioxus) → Current (Tairitsu) 实际效果差距分析与修复方案
>
> Legacy 版本位置: `/mnt/sdb1/hikari-legacy` (master 分支)
> 当前版本位置: `/mnt/sdb1/hikari` (dev 分支)

---

## 🔴 严重问题发现（2026-03-26 更新）

### 问题 1: ThemeProvider 未应用 ⚠️

**影响**: 所有 CSS 变量（包括主题色和 glow 颜色）没有被设置

**对比**:

| 文件 | Legacy 版本 | 当前版本 |
|------|-------------|----------|
| `examples/website/src/app.rs` | 使用 `ThemeProvider { palette: "hikari".to_string() }` | ❌ 没有使用 ThemeProvider |

**Legacy 代码**:
```rust
// hikari-legacy/examples/website/src/app.rs
rsx! {
    I18nProviderWrapper {
        ThemeProvider { palette: "hikari".to_string(),
            PortalProvider {
                Router::<Route> {}
            }
        }
    }
}
```

**当前代码**:
```rust
// hikari/examples/website/src/app.rs
VNode::Element(
    VElement::new("div")
        .attr("id", "hikari-app")
        .class("hi-layout hi-layout-light hi-layout-has-sidebar")  // 硬编码类名！
        .child(components::top_nav())
        // ...
)
```

**结果**: CSS 变量如 `--hi-glow-button-primary`、`--hi-primary` 等从未被设置！

---

### 问题 2: Glow 颜色系统错误 ⚠️

**根本原因**: `button_glow_color()` 返回对比色（黑色/白色），而不是主题色本身

**代码分析**:
```rust
// packages/palette/src/themes.rs:64
pub fn button_glow_color(&self, color: &Color) -> String {
    color.glow_contrast_dynamic_rgba()  // 返回 rgba(0,0,0,0.6) 或 rgba(255,255,255,0.7)
}
```

**实际效果**:
- Hikari (白天模式) Primary = 牡丹粉红 (238, 162, 164)
  - 期望 glow: 粉色半透明
  - 实际 glow: `rgba(0, 0, 0, 0.6)` - 黑色半透明！
- Tairitsu (暗黑模式) Primary = 鷃蓝 (20, 74, 116)
  - 期望 glow: 蓝色半透明
  - 实际 glow: `rgba(255, 255, 255, 0.7)` - 白色半透明！

这就是用户看到的"绿不拉几的"效果 - 实际上是灰色/黑色 glow！

---

### 问题 3: 布局结构不一致 ⚠️

**需要对比**: legacy 和当前版本的右侧 body 面板

**待检查项**:
- Sidebar 宽度和样式
- Main content 区域的 padding
- 响应式断点
- Overlay/drawer 行为

---

## 新修复计划

### Phase A: 修复 ThemeProvider 集成

**任务**:
1. 在 `examples/website/src/app.rs` 中添加 ThemeProvider
2. 移除硬编码的 `hi-layout-light` 类名
3. 确保所有 CSS 变量正确生成和应用

**修改文件**:
- `examples/website/src/app.rs`

### Phase B: 修复 Glow 颜色系统

**任务**:
1. 修改 `button_glow_color()` 返回主题色的半透明版本
2. 或者创建新的方法 `button_glow_color_tint()`
3. 更新所有相关 CSS 变量

**修改文件**:
- `packages/palette/src/themes.rs`
- `packages/palette/src/colors/impl_.rs`

### Phase C: 布局对比和修复

**任务**:
1. 对比 legacy 和当前版本的布局结构
2. 修复右侧 body 面板的不一致
3. 验证响应式行为

---

## 之前完成的修复（保留记录）

### Phase 1-7: 组件交互效果修复 ✅

- Glow 组件核心修复
- Glow 包装器组件验证
- Card 内联 Glow 修复
- 交互组件验证
- 数据展示组件验证
- 滚动容器验证

**注意**: 这些修复在没有正确主题颜色的情况下无法完全生效！

---

## 主题色定义（正确）

### Hikari (白天模式)
```rust
primary: 牡丹粉红,    // (238, 162, 164) - 粉红色
secondary: 苍翠,      // (81, 154, 115) - 绿色
background: 月白,     // (214, 236, 240) - 浅白色
```

### Tairitsu (暗黑模式)
```rust
primary: 鷃蓝,        // (20, 74, 116) - 深蓝色
secondary: 姜黄,      // (255, 199, 115) - 黄色
background: 墨色,     // (80, 97, 109) - 深色
```

**问题**: 这些颜色定义是正确的，但因为没有 ThemeProvider，所以从未被应用到 DOM！
