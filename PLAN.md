# Hikari 组件库迁移计划

> Legacy (Dioxus) → Current (Tairitsu) 实际效果差距分析与修复方案
>
> Legacy 版本位置: `/mnt/sdb1/hikari-legacy` (master 分支)
> 当前版本位置: `/mnt/sdb1/hikari` (dev 分支)

---

## ✅ 已完成的修复

### Phase A: ThemeProvider 集成 ✅

**问题**: 当前版本没有使用 ThemeProvider，导致所有 CSS 变量未被设置

**修复**:
- 创建 `examples/website/src/theme.rs` 模块
- 生成主题 CSS 变量并应用到根元素
- 添加 `data-theme` 属性标识当前主题

### Phase B: Glow 颜色系统 ✅

**问题**: `button_glow_color()` 返回对比色而非主题色

**修复**:
```rust
// 修改前
color.glow_contrast_dynamic_rgba()  // rgba(0,0,0,0.6)

// 修改后
color.rgba(0.5)  // 主题色半透明
```

**效果**:
- Hikari Primary (粉红) → 粉红色 glow
- Tairitsu Primary (深蓝) → 深蓝色 glow

### Phase C: 布局结构 ✅

**修复**: 修正 sidebar 内容容器类名
- `hi-aside-content` → `hi-layout-aside-content`

---

## 主题色定义

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

---

## 涉及组件 (24个) - 全部完成

| 组件 | 状态 |
|------|------|
| Button, IconButton, Input, InputWrapper | ✅ |
| Select, Alert, Toast | ✅ |
| Card | ✅ |
| Switch, Checkbox, RadioGroup, Slider | ✅ |
| Badge, Avatar | ✅ |
| Menu, Sidebar, Tabs | ✅ |
| Table, Tree, Tag | ✅ |
| Timeline, Calendar | ✅ |
| Modal, Scrollbar | ✅ |
