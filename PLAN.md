# PLAN.md - 修复输入框自动填充影响 glow wrapper 渲染

## 问题描述

浏览器的自动填充功能会在输入框上添加自己的背景色（通常是黄色或蓝色），这与 glow wrapper 的 `::before` 伪元素叠加，产生实心颜色层，破坏了 FUI 科幻风格设计。

## 根本原因分析

1. **浏览器自动填充伪元素**: Chrome 等浏览器使用 `::-webkit-credentials-auto-fill-button` 等伪类添加自动填充样式
2. **层级冲突**: 自动填充的背景色会透过半透明的 glow wrapper 显示
3. **当前实现**: Input wrapper 使用 `background: var(--hi-color-surface)` + `backdrop-filter: blur(4px)`

## 修复方案

### 方案 1: 覆盖浏览器自动填充样式（推荐）

在 `input.scss` 中添加 CSS 规则，覆盖浏览器自动填充的默认样式。

**重要**: Lightning CSS 会自动添加浏览器前缀，我们只需要写标准 CSS：

```scss
.hi-input {
  // 覆盖浏览器自动填充样式
  // Lightning CSS 会自动添加 -webkit-、-moz- 等前缀
  &:-webkit-autofill,
  &:-webkit-autofill:hover,
  &:-webkit-autofill:focus,
  &:-webkit-autofill:active {
    box-shadow: 0 0 0 1000px var(--hi-color-surface) inset;
    -webkit-text-fill-color: var(--hi-color-text-primary);
    transition: background-color 5000s ease-in-out 0s;
    caret-color: var(--hi-color-text-primary);
  }
}
```

**为什么需要保留 `-webkit-text-fill-color`**:

- 这是 WebKit 特有的属性，标准 CSS 没有替代
- Lightning CSS 不会自动添加这个属性，因为它不属于标准 CSS 规范
- 其他前缀会由 Lightning CSS 自动处理

**优点**:

- ✅ 简单直接
- ✅ 不会影响现有结构
- ✅ 跨浏览器兼容性好
- ✅ Lightning CSS 自动处理大部分前缀

### 方案 2: 使用 autocomplete 属性（不推荐）

在 Input 组件中添加 `autocomplete="off"` 或 `autocomplete="nope"`：

```rust
input {
    autocomplete: "nope",  // 浏览器不识别 "nope"，禁用自动填充
    // ... 其他属性
}
```

**优点**:
- ✅ 彻底禁用自动填充

**缺点**:
- ❌ 用户体验差（失去自动填充便利性）
- ❌ 可能被浏览器忽略
- ❌ 不是推荐的做法

**结论**: 不采用此方案，保留自动填充功能，只修复样式问题。

## 推荐实施计划

**采用方案 1**: 使用 CSS 覆盖自动填充样式

### 实施步骤

**文件**: `packages/components/src/styles/components/input.scss`

1. 在 `.hi-input` 类中添加自动填充样式覆盖
2. 针对 `.hi-input-wrapper .hi-input` 也添加相同规则（确保 wrapper 内的 input 也被覆盖）

### 修改内容

在 `input.scss` 的 `.hi-input` 部分添加：

```scss
.hi-input {
  // ... 现有样式 ...

  // 覆盖浏览器自动填充样式
  &:-webkit-autofill,
  &:-webkit-autofill:hover,
  &:-webkit-autofill:focus,
  &:-webkit-autofill:active {
    box-shadow: 0 0 0 1000px var(--hi-color-surface) inset;
    -webkit-text-fill-color: var(--hi-color-text-primary);
    transition: background-color 5000s ease-in-out 0s;
    caret-color: var(--hi-color-text-primary);
  }
}
```

在 `.hi-input-wrapper .hi-input` 部分也添加相同的规则。

## 优先级

**高优先级** - 影响视觉一致性和用户体验

## 预计影响

- ✅ 改善视觉一致性
- ✅ 保持 FUI 设计风格
- ✅ 保留自动填充功能
- ⚠️ 需要跨浏览器测试

## 涉及文件

1. `packages/components/src/styles/components/input.scss` - 添加自动填充样式覆盖

## 实施状态

- [x] 在 `.hi-input` 中添加自动填充样式覆盖
- [x] 在 `.hi-input-wrapper .hi-input` 中添加自动填充样式覆盖
- [x] 编译并验证 CSS 生成
- [ ] 测试 Chrome 自动填充行为
- [ ] 测试 Firefox 自动填充行为
- [ ] 测试 Safari 自动填充行为

**实施完成**: ✅ CSS 修改已完成并通过编译
