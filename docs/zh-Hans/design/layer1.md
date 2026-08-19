# Layer1 - 基础层级（Foundation）

## 概述

Layer1 是 Hikari 设计系统的基础层级，定义了全局 CSS 变量，为所有组件提供默认值。这些变量是整个设计系统的"单一事实来源"（Single Source of Truth）。

## 文件位置

```
packages/theme/styles/foundation.scss
```

## 变量分类

### 1. 颜色系统

#### 主色调
```scss
:root {
  // 品牌色
  --hi-color-primary: #ff4f00;           // 主色（橙红色）
  --hi-color-primary-light: #ff6b33;     // 主色浅色
  --hi-color-primary-dark: #cc3f00;      // 主色深色

  // 辅助色
  --hi-color-secondary: #3b82f6;         // 辅助色（蓝色）
  --hi-color-secondary-light: #60a5fa;
  --hi-color-secondary-dark: #2563eb;
}
```

#### 语义色
```scss
:root {
  // 状态色
  --hi-color-danger: #ef4444;            // 危险/错误
  --hi-color-warning: #f59e0b;           // 警告
  --hi-color-success: #22c55e;           // 成功
  --hi-color-info: #3b82f6;              // 信息
}
```

#### 文字颜色
```scss
:root {
  --hi-color-text-primary: rgba(0, 0, 0, 0.87);    // 主要文字
  --hi-color-text-secondary: rgba(0, 0, 0, 0.6);   // 次要文字
  --hi-color-text-disabled: rgba(0, 0, 0, 0.38);   // 禁用文字
  --hi-color-text-hint: rgba(0, 0, 0, 0.38);       // 提示文字
}
```

#### 背景颜色
```scss
:root {
  --hi-color-bg-primary: #ffffff;        // 主背景
  --hi-color-bg-secondary: #f5f5f5;      // 次背景
  --hi-color-bg-surface: #ffffff;        // 表面背景
  --hi-color-bg-overlay: rgba(0, 0, 0, 0.5); // 遮罩背景
}
```

#### 边框颜色
```scss
:root {
  --hi-color-border: rgba(0, 0, 0, 0.12);        // 默认边框
  --hi-color-border-light: rgba(0, 0, 0, 0.06);  // 浅边框
  --hi-color-border-focus: var(--hi-color-primary); // 焦点边框
}
```

### 2. 圆角系统

```scss
:root {
  // 基础圆角
  --hi-radius-none: 0;
  --hi-radius-sm: 4px;
  --hi-radius-md: 8px;
  --hi-radius-lg: 12px;
  --hi-radius-xl: 16px;
  --hi-radius-2xl: 24px;
  --hi-radius-full: 9999px;              // 全圆

  // 组件圆角
  --hi-radius-button: var(--hi-radius-md);
  --hi-radius-input: var(--hi-radius-md);
  --hi-radius-card: var(--hi-radius-lg);
  --hi-radius-modal: var(--hi-radius-xl);
}
```

### 3. 动画系统

#### 时长
```scss
:root {
  --hi-duration-instant: 0ms;            // 即时
  --hi-duration-fast: 150ms;             // 快速
  --hi-duration-normal: 300ms;           // 正常
  --hi-duration-slow: 500ms;             // 慢速
  --hi-duration-slower: 800ms;           // 更慢
}
```

#### 缓动函数
```scss
:root {
  --hi-ease-linear: linear;
  --hi-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --hi-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --hi-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --hi-ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
  --hi-ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1);
}
```

### 4. 阴影系统

```scss
:root {
  // 基础阴影
  --hi-shadow-none: none;
  --hi-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --hi-shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --hi-shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --hi-shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);

  // 发光阴影
  --hi-glow-color: rgba(255, 79, 0, 0.3);
  --hi-glow-sm: 0 0 8px var(--hi-glow-color);
  --hi-glow-md: 0 0 16px var(--hi-glow-color);
  --hi-glow-lg: 0 0 24px var(--hi-glow-color);
}
```

### 5. 间距系统

```scss
:root {
  --hi-spacing-0: 0;
  --hi-spacing-1: 0.25rem;               // 4px
  --hi-spacing-2: 0.5rem;                // 8px
  --hi-spacing-3: 0.75rem;               // 12px
  --hi-spacing-4: 1rem;                  // 16px
  --hi-spacing-5: 1.25rem;               // 20px
  --hi-spacing-6: 1.5rem;                // 24px
  --hi-spacing-8: 2rem;                  // 32px
}
```

### 6. 排版系统

```scss
:root {
  // 字体族
  --hi-font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --hi-font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;

  // 字号
  --hi-font-size-xs: 0.75rem;            // 12px
  --hi-font-size-sm: 0.875rem;           // 14px
  --hi-font-size-base: 1rem;             // 16px
  --hi-font-size-lg: 1.125rem;           // 18px
  --hi-font-size-xl: 1.25rem;            // 20px
  --hi-font-size-2xl: 1.5rem;            // 24px

  // 行高
  --hi-line-height-tight: 1.25;
  --hi-line-height-normal: 1.5;
  --hi-line-height-relaxed: 1.75;

  // 字重
  --hi-font-weight-normal: 400;
  --hi-font-weight-medium: 500;
  --hi-font-weight-semibold: 600;
  --hi-font-weight-bold: 700;
}
```

### 7. 图标系统

```scss
:root {
  // 图标尺寸
  --hi-icon-size-xs: 12px;
  --hi-icon-size-sm: 16px;
  --hi-icon-size-md: 20px;
  --hi-icon-size-lg: 24px;
  --hi-icon-size-xl: 32px;

  // 图标颜色
  --hi-icon-color: var(--hi-color-text-primary);
  --hi-icon-color-secondary: var(--hi-color-text-secondary);
  --hi-icon-color-disabled: var(--hi-color-text-disabled);
}
```

### 8. Z-Index 系统（分组区间）

Z 层级遵循**单一注册上下文**模型：每个层级家族独占一个分组区间（band），
区间内成员按 DOM 顺序叠放（浏览器默认行为）；跨组顺序由 token 表统一管理。

```scss
:root {
  /* 0–9      局部 — 组件内部自足叠放（自含堆叠上下文） */
  --z-base: 0;
  --z-above: 1;
  --z-overlay: 2;
  --z-top: 3;

  /* 10–99    内容浮动 — 粘性列、页内提升、小地图 */
  --z-content: 10;
  --z-floating: 50;

  /* 100–199  应用框架 — 页眉、页脚、页眉弹层 */
  --z-header: 100;
  --z-footer: 110;
  --z-header-popup: 150;

  /* 200–899  应用覆盖 — 预留给应用级装饰 */
  /* 900–999  应用 sheet — 抽屉侧栏、底部弹层 */
  --z-sheet: 900;
  --z-sidebar: 900;

  /* 1000–1999 弹出层栈 — 由 usePopupManager 注册分配（1000 + 2n，
   *  栈空归零）。modal / drawer / popover / select 弹层 / 菜单 sheet /
   *  locale 选择器都必须注册；固定层（toast/tooltip/fatal/titlebar）不注册。 */
  --z-modal: 1000;
  --z-modal-base: 1000;
  --z-modal-step: 2;

  /* 固定层（高于弹出层栈，永不注册） */
  --z-toast: 9999;     /* 提示 */
  --z-tooltip: 10000;  /* 气泡提示 */
  /* --z-fatal: 10001    致命页（消费方定义） */
  /* --z-titlebar: 100001 原生标题栏（Tauri） */
  /* --z-breadcrumb: 100002 模态栈面包屑（消费方定义） */
}
```

> 规则：overlay 类组件必须调用 `usePopupManager().register(kind)` 领取
> z 值（落在 1000–1999 区间），严禁硬编码 1000+ 的数值——否则后打开的
> modal（1000+2n）会盖住未注册的弹层。同 band 内多个成员依靠 DOM 顺序
> 自然堆叠，无需手工管理。

## 主题切换

### 亮色主题（默认）

```scss
:root {
  --hi-color-bg-primary: #ffffff;
  --hi-color-text-primary: rgba(0, 0, 0, 0.87);
}
```

### 暗色主题

```scss
[data-theme="dark"] {
  --hi-color-bg-primary: #1a1a1a;
  --hi-color-text-primary: rgba(255, 255, 255, 0.87);
  --hi-color-text-secondary: rgba(255, 255, 255, 0.6);
  --hi-color-border: rgba(255, 255, 255, 0.12);
}
```

### 自定义主题

```scss
[data-theme="custom"] {
  --hi-color-primary: #your-color;
  --hi-color-secondary: #your-color;
  // ... 其他变量
}
```

## 使用示例

### 在 SCSS 中使用

```scss
.my-component {
  color: var(--hi-color-text-primary);
  background: var(--hi-color-bg-surface);
  border-radius: var(--hi-radius-md);
  padding: var(--hi-spacing-4);
  transition: all var(--hi-duration-normal) var(--hi-ease-smooth);

  &:hover {
    box-shadow: var(--hi-shadow-md);
  }
}
```

### 在 Rust 中使用

```rust
// 通过 css_vars 属性覆盖
Button {
    css_vars: Some(vec![
        ("--hi-button-bg", "var(--hi-color-primary)".to_string()),
    ]),
    "Themed Button"
}
```

## 最佳实践

1. **始终使用语义化变量**：使用 `--hi-color-text-primary` 而不是直接使用颜色值
2. **保持一致性**：同一类型的组件使用相同的变量
3. **避免硬编码**：所有设计值都应通过变量定义
4. **主题感知**：使用变量确保主题切换时样式正确更新

## 相关文档

- [设计系统概述](./overview.md)
- [Layer2 组件层级](./layer2.md)
- [Custom 自定义层级](./custom.md)
