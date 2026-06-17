# Layer2 - 组件层级（Component）

## 概述

Layer2 在 Layer1 的基础上，为每个组件定义特定的 CSS 变量。这些变量控制组件的外观、状态和交互效果。

## 文件位置

```
packages/components/src/styles/components/*-vars.scss
```

例如：
- `button-vars.scss` - Button 组件变量
- `icon-button-vars.scss` - IconButton 组件变量
- `input-vars.scss` - Input 组件变量
- `card-vars.scss` - Card 组件变量
- `modal-vars.scss` - Modal 组件变量

## 变量命名规范

### 基础命名

```scss
--hi-{component}-{property}
```

例如：
```scss
--hi-button-icon-color
--hi-button-radius
--hi-button-bg
```

### 状态命名

```scss
--hi-{component}-{state}-{property}
```

例如：
```scss
--hi-button-hover-bg
--hi-button-active-transform
--hi-input-focus-border-color
--hi-icon-button-disabled-opacity
```

### 尺寸命名

```scss
--hi-{component}-{size}-{property}
```

例如：
```scss
--hi-button-sm-padding-x
--hi-button-lg-font-size
--hi-input-md-height
```

## Button 组件变量

```scss
.hi-button {
  // ============================================
  // 1. 颜色系统
  // ============================================
  
  // 图标颜色
  --hi-button-icon-color: var(--hi-icon-color);
  --hi-button-icon-color-hover: var(--hi-icon-color);
  --hi-button-icon-color-active: var(--hi-icon-color);
  --hi-button-icon-color-disabled: var(--hi-icon-color-disabled);
  
  // 文字颜色
  --hi-button-text-color: var(--hi-color-text-primary);
  --hi-button-text-color-hover: var(--hi-color-text-primary);
  --hi-button-text-color-active: var(--hi-color-text-primary);
  --hi-button-text-color-disabled: var(--hi-color-text-disabled);
  
  // 背景颜色
  --hi-button-bg: transparent;
  --hi-button-bg-hover: var(--hi-color-gray-10);
  --hi-button-bg-active: var(--hi-color-gray-20);
  --hi-button-bg-disabled: transparent;
  
  // 边框颜色
  --hi-button-border-color: var(--hi-color-border);
  --hi-button-border-color-hover: var(--hi-color-border);
  --hi-button-border-color-focus: var(--hi-color-primary);
  
  // ============================================
  // 2. 圆角系统
  // ============================================
  
  --hi-button-radius: var(--hi-radius-md);
  
  // ============================================
  // 3. 动画系统
  // ============================================
  
  --hi-button-duration: var(--hi-duration-fast);
  --hi-button-easing: var(--hi-ease-default);
  --hi-button-transition: all var(--hi-button-duration) var(--hi-button-easing);
  
  // ============================================
  // 4. 间距系统
  // ============================================
  
  --hi-button-padding-x: 1rem;
  --hi-button-padding-y: 0.5rem;
  --hi-button-gap: 0.5rem;
  
  // ============================================
  // 5. 变换系统
  // ============================================
  
  --hi-button-transform: none;
  --hi-button-transform-hover: none;
  --hi-button-transform-active: scale(0.98);
}
```

## IconButton 组件变量

```scss
.hi-icon-button {
  // 图标颜色
  --hi-icon-button-icon-color: var(--hi-icon-color);
  --hi-icon-button-icon-color-hover: var(--hi-icon-color);
  --hi-icon-button-icon-color-disabled: var(--hi-icon-color-disabled);
  
  // 背景颜色
  --hi-icon-button-bg: transparent;
  --hi-icon-button-bg-hover: var(--hi-bg-surface);
  --hi-icon-button-bg-active: var(--hi-bg-surface-dark);
  
  // 尺寸
  --hi-icon-button-size: 40px;
  --hi-icon-button-icon-size: var(--hi-icon-size-sm);
  
  // 圆角
  --hi-icon-button-radius: var(--hi-radius-md);
  
  // 动画
  --hi-icon-button-transition: all var(--hi-duration-fast) var(--hi-ease-default);
  --hi-icon-button-transform-active: scale(0.95);
}
```

## Input 组件变量

```scss
.hi-input {
  // 文字颜色
  --hi-input-text-color: var(--hi-color-text-primary);
  --hi-input-text-color-disabled: var(--hi-color-text-disabled);
  
  // 占位符颜色
  --hi-input-placeholder-color: var(--hi-color-text-secondary);
  --hi-input-placeholder-opacity: 0.6;
  
  // 背景颜色
  --hi-input-bg: transparent;
  --hi-input-bg-disabled: rgba(255, 255, 255, 0.5);
  
  // 边框颜色
  --hi-input-border-color: var(--hi-color-border);
  --hi-input-border-color-focus: var(--hi-color-primary);
  --hi-input-border-color-disabled: var(--hi-border-color-disabled);
  --hi-input-border-color-error: var(--hi-color-danger);
  
  // 阴影
  --hi-input-shadow-focus: 0 0 0 2px var(--hi-color-primary), 0 0 8px var(--hi-glow-color);
  
  // 圆角
  --hi-input-radius: var(--hi-radius-md);
  
  // 间距
  --hi-input-padding-x: 0.75rem;
  --hi-input-padding-y: 0.5rem;
  
  // 排版
  --hi-input-font-size: var(--hi-font-size-sm);
  --hi-input-line-height: 1.5;
}
```

## Card 组件变量

```scss
.hi-card {
  // 文字颜色
  --hi-card-title-color: var(--hi-color-text-primary);
  --hi-card-subtitle-color: var(--hi-color-text-secondary);
  --hi-card-body-color: var(--hi-color-text-primary);
  
  // 背景颜色
  --hi-card-bg: var(--hi-color-surface);
  --hi-card-bg-header: transparent;
  --hi-card-bg-body: transparent;
  --hi-card-bg-footer: transparent;
  
  // 边框颜色
  --hi-card-border-color: rgba(226, 232, 240, 0.8);
  --hi-card-border-color-hover: rgba(59, 130, 246, 0.3);
  
  // 阴影
  --hi-card-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  --hi-card-shadow-hover: 0 4px 12px rgba(0, 0, 0, 0.12);
  
  // 圆角
  --hi-card-radius: var(--hi-radius-lg);
  
  // 间距
  --hi-card-padding: 1.25rem;
  --hi-card-padding-header: 1rem 1.25rem;
  --hi-card-padding-body: 1.25rem;
  --hi-card-padding-footer: 1rem 1.25rem;
}
```

## Modal 组件变量

```scss
.hi-modal {
  // 文字颜色
  --hi-modal-title-color: var(--hi-color-text-primary);
  --hi-modal-body-color: var(--hi-color-text-primary);
  
  // 背景颜色
  --hi-modal-bg: var(--hi-card-bg-light);
  --hi-modal-overlay-bg: var(--hi-overlay-color);
  
  // 边框颜色
  --hi-modal-border-color: var(--hi-color-border);
  
  // 阴影
  --hi-modal-shadow: 0 16px 32px rgba(0, 0, 0, 0.4);
  
  // 圆角
  --hi-modal-radius: var(--hi-radius-xl);
  
  // 动画
  --hi-modal-duration: var(--hi-duration-normal);
  --hi-modal-easing: var(--hi-ease-default);
  --hi-modal-transition: all var(--hi-modal-duration) var(--hi-modal-easing);
  
  // 尺寸
  --hi-modal-max-height: calc(100vh - 2rem);
}
```

## 变体变量

### Primary 变体

```scss
.hi-button-primary {
  --hi-button-bg: var(--hi-color-primary);
  --hi-button-bg-hover: var(--hi-color-primary-dark);
  --hi-button-text-color: var(--hi-color-text-on-primary);
  --hi-button-glow: var(--hi-glow-md);
}
```

### Ghost 变体

```scss
.hi-button-ghost {
  --hi-button-bg: transparent;
  --hi-button-bg-hover: var(--hi-color-gray-10);
  --hi-button-border-color: transparent;
  --hi-button-glow: var(--hi-glow-color);
}
```

### Danger 变体

```scss
.hi-button-danger {
  --hi-button-bg: var(--hi-color-danger);
  --hi-button-bg-hover: var(--hi-color-danger-dark);
  --hi-button-text-color: #ffffff;
  --hi-button-glow: 0 0 16px var(--hi-color-danger);
}
```

## 尺寸变量

```scss
// Small
.hi-button-sm {
  --hi-button-padding-x: 0.75rem;
  --hi-button-padding-y: 0.25rem;
  --hi-button-font-size: var(--hi-font-size-xs);
  --hi-button-icon-size: var(--hi-icon-size-xs);
}

// Medium (默认)
.hi-button-md {
  --hi-button-padding-x: 1rem;
  --hi-button-padding-y: 0.5rem;
  --hi-button-font-size: var(--hi-font-size-sm);
  --hi-button-icon-size: var(--hi-icon-size-sm);
}

// Large
.hi-button-lg {
  --hi-button-padding-x: 1.5rem;
  --hi-button-padding-y: 0.75rem;
  --hi-button-font-size: var(--hi-font-size-base);
  --hi-button-icon-size: var(--hi-icon-size-md);
}
```

## 使用示例

### 在 SCSS 中使用

```scss
.hi-button {
  // 使用 Layer2 变量
  color: var(--hi-button-text-color);
  background: var(--hi-button-bg);
  border-radius: var(--hi-button-radius);
  padding: var(--hi-button-padding-y) var(--hi-button-padding-x);
  
  &:hover {
    color: var(--hi-button-text-color-hover);
    background: var(--hi-button-bg-hover);
  }
}
```

### 在 Rust 中覆盖

```rust
Button {
    variant: ButtonVariant::Primary,
    // 覆盖 Layer2 变量
    icon_color: Some("#ff0000".to_string()),
    text_color: Some("#ffffff".to_string()),
    "Custom Button"
}
```

## 最佳实践

1. **保持变量一致性**：相同类型的组件使用相同的变量命名
2. **引用 Layer1**：Layer2 变量应引用 Layer1 变量，而非硬编码值
3. **状态完整性**：为所有交互状态定义变量
4. **语义化命名**：变量名应清晰表达其用途

## 相关文档

- [设计系统概述](./overview.md)
- [Layer1 基础层级](./layer1.md)
- [Custom 自定义层级](./custom.md)
