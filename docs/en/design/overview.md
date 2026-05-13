# Hikari 设计系统概述

## 简介

Hikari 设计系统采用三层级 CSS 变量架构，实现从主题配置到运行时动画的全链路控制。这种架构设计灵感来源于现代设计工具的层级概念，确保了灵活性和可维护性的完美平衡。

## 三层级架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Custom (运行时)                          │
│  AnimationBuilder 动态控制 / 内联样式覆盖 / 运行时属性修改    │
├─────────────────────────────────────────────────────────────┤
│                    Layer2 (组件层级)                        │
│  组件级 CSS 变量覆盖 / 组件特有属性配置 / 状态变体配置        │
├─────────────────────────────────────────────────────────────┤
│                    Layer1 (基础层级)                        │
│  全局 CSS 变量定义 / 所有组件的默认值 / 主题切换支持          │
└─────────────────────────────────────────────────────────────┘
```

### Layer1 - 基础层级（Foundation）

Layer1 是设计系统的基础，定义了全局 CSS 变量，为所有组件提供默认值。

**特点：**
- 定义全局设计令牌（Design Tokens）
- 支持主题切换（亮色/暗色/自定义）
- 提供语义化变量名

**文件位置：** `packages/theme/styles/foundation.scss`

**示例：**
```scss
:root {
  // 颜色系统
  --hi-color-primary: #ff4f00;
  --hi-color-secondary: #3b82f6;
  --hi-color-danger: #ef4444;
  --hi-color-success: #22c55e;
  
  // 圆角系统
  --hi-radius-sm: 4px;
  --hi-radius-md: 8px;
  --hi-radius-lg: 12px;
  
  // 动画系统
  --hi-duration-fast: 150ms;
  --hi-duration-normal: 300ms;
  --hi-duration-slow: 500ms;
}
```

### Layer2 - 组件层级（Component）

Layer2 在 Layer1 的基础上，为每个组件定义特定的变量覆盖和状态配置。

**特点：**
- 组件级变量覆盖
- 状态变体配置（hover/active/disabled/focus）
- 引用 Layer1 变量实现一致性

**文件位置：** `packages/components/src/styles/components/*-vars.scss`

**示例：**
```scss
.hi-button {
  // 引用 Layer1 变量
  --hi-button-icon-color: var(--hi-color-text-primary);
  --hi-button-radius: var(--hi-radius-md);
  
  // 状态变量
  --hi-button-hover-bg: rgba(255, 255, 255, 0.1);
  --hi-button-active-transform: scale(0.98);
}
```

### Custom - 自定义层级（Runtime）

Custom 层允许在运行时动态修改样式，通过组件属性或 AnimationBuilder 实现。

**特点：**
- 运行时动态控制
- AnimationBuilder 动画集成
- 内联样式覆盖

**实现方式：**
1. **组件属性：** 通过 `icon_color`、`text_color` 等属性直接覆盖
2. **CSS 变量：** 通过 `css_vars` 属性批量设置变量
3. **AnimationBuilder：** 通过 `animation_id` 实现动画控制

**示例：**
```rust
Button {
    variant: ButtonVariant::Primary,
    icon_color: Some("#ff0000".to_string()),
    css_vars: Some(vec![
        ("--hi-button-radius", "16px".to_string()),
    ]),
    animation_id: Some("my-button".to_string()),
    "Click me"
}
```

## 设计原则

### 1. 渐进增强

从 Layer1 到 Custom，每一层都是可选的增强：
- 只使用 Layer1 → 获得一致的默认主题
- 添加 Layer2 → 获得组件级定制
- 使用 Custom → 获得运行时灵活性

### 2. 向后兼容

所有层级都保持向后兼容：
- 旧代码继续工作
- 新功能可选启用
- 渐进式迁移

### 3. 性能优先

设计系统考虑了性能影响：
- CSS 变量数量控制（< 500 个）
- GPU 加速动画
- 最小化重绘重排

## 变量命名规范

### Layer1 命名

```scss
--hi-{category}-{property}
```

| 类别 | 示例 |
|------|------|
| 颜色 | `--hi-color-primary` |
| 圆角 | `--hi-radius-md` |
| 动画 | `--hi-duration-normal` |
| 阴影 | `--hi-shadow-sm` |
| 间距 | `--hi-spacing-md` |

### Layer2 命名

```scss
--hi-{component}-{property}
--hi-{component}-{state}-{property}
```

| 类型 | 示例 |
|------|------|
| 基础 | `--hi-button-icon-color` |
| 状态 | `--hi-button-hover-bg` |
| 尺寸 | `--hi-button-padding-x` |

## 快速开始

### 1. 使用默认主题

```rust
Button {
    variant: ButtonVariant::Primary,
    "Default Theme"
}
```

### 2. 自定义颜色

```rust
Button {
    variant: ButtonVariant::Primary,
    icon_color: Some("#ff0000".to_string()),
    text_color: Some("#ffffff".to_string()),
    "Custom Colors"
}
```

### 3. 使用 CSS 变量

```rust
Button {
    variant: ButtonVariant::Ghost,
    css_vars: Some(vec![
        ("--hi-button-radius", "50px".to_string()),
        ("--hi-button-bg-hover", "rgba(255, 0, 0, 0.1)".to_string()),
    ]),
    "CSS Variables"
}
```

### 4. 动画控制

```rust
// 在组件中设置 animation_id
Button {
    animation_id: Some("animated-button".to_string()),
    "Animated"
}

// 使用 AnimationBuilder 控制动画
AnimationBuilder::new()
    .style("--hi-button-bg", "rgb(255, 0, 0)")
    .duration(300)
    .easing(Easing::EaseInOut)
    .apply_to_element("animated-button");
```

## 相关文档

- [Layer1 基础层级](./layer1.md) - 全局变量详细说明
- [Layer2 组件层级](./layer2.md) - 组件变量详细说明
- [Custom 自定义层级](./custom.md) - 运行时控制详细说明
