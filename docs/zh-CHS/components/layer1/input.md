# Input 输入框

Input 组件是基础的表单输入组件，支持多种状态和自定义样式。

## 三层级配置

Input 组件支持三层级 CSS 变量配置架构：

- **Layer1 (基础层级)**: 通过主题定义全局默认值
- **Layer2 (组件层级)**: 通过 `input-vars.scss` 定义组件变量
- **Custom (运行时)**: 通过组件属性动态覆盖

## 基础用法

```_hikari_component
pages/components/layer1/input#basic
```

## 禁用状态

输入框可以被禁用，禁用状态下不可编辑。

```_hikari_component
pages/components/layer1/input#disabled
```

## 自定义颜色

通过 Custom 层属性可以动态覆盖输入框颜色。

```rust
Input {
    placeholder: "Custom styled input",
    text_color: Some("#ff0000".to_string()),        // 自定义文字颜色
    border_color: Some("#ff4f00".to_string()),       // 自定义边框颜色
    background_color: Some("rgba(255, 255, 255, 0.1)".to_string()), // 自定义背景颜色
}
```

## CSS 变量覆盖

通过 `css_vars` 属性可以批量覆盖 CSS 变量。

```rust
Input {
    placeholder: "CSS Variables Override",
    css_vars: Some(vec![
        ("--hi-input-radius", "16px".to_string()),
        ("--hi-input-border-color-focus", "#22c55e".to_string()),
        ("--hi-input-shadow-focus", "0 0 0 2px rgba(34, 197, 94, 0.3)".to_string()),
    ]),
}
```

## 动画集成

通过 `animation_id` 属性可以与 AnimationBuilder 集成实现动画效果。

```rust
Input {
    placeholder: "Animated Input",
    animation_id: Some("animated-input".to_string()),
}

// 使用 AnimationBuilder 控制动画
AnimationBuilder::new()
    .style("--hi-input-border-color", "rgb(255, 79, 0)")
    .style("--hi-input-shadow-focus", "0 0 0 2px rgba(255, 79, 0, 0.3)")
    .duration(300)
    .apply_to_element("animated-input");
```

## API

### Input Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| size | 输入框尺寸 | InputSize | Medium |
| disabled | 是否禁用 | bool | false |
| readonly | 是否只读 | bool | false |
| placeholder | 占位文本 | Option\<String\> | None |
| value | 输入值 | Option\<String\> | None |
| input_type | 输入类型 | Option\<String\> | "text" |
| autofocus | 是否自动聚焦 | bool | false |
| class | 自定义 CSS 类 | String | "" |
| prefix_icon | 前缀图标 | Option\<Element\> | None |
| suffix_icon | 后缀图标 | Option\<Element\> | None |
| oninput | 输入回调 | Option\<EventHandler\<String\>\> | None |
| onfocus | 聚焦回调 | Option\<EventHandler\<FocusEvent\>\> | None |
| onblur | 失焦回调 | Option\<EventHandler\<FocusEvent\>\> | None |
| onkeydown | 按键回调 | Option\<EventHandler\<KeyboardEvent\>\> | None |
| glow | 是否启用发光效果 | bool | true |
| glow_blur | 发光模糊强度 | GlowBlur | Medium |
| glow_intensity | 发光强度 | GlowIntensity | Soft |
| glow_color | 发光颜色 | GlowColor | Ghost |
| **Custom 层属性** | | | |
| text_color | 自定义文字颜色 | Option\<String\> | None |
| placeholder_color | 自定义占位符颜色 | Option\<String\> | None |
| border_color | 自定义边框颜色 | Option\<String\> | None |
| background_color | 自定义背景颜色 | Option\<String\> | None |
| animation_id | AnimationBuilder 动画 ID | Option\<String\> | None |
| css_vars | CSS 变量批量覆盖 | Option\<Vec\<(&'static str, String)\>\> | None |

## CSS 变量参考

### Input CSS 变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| --hi-input-text-color | 文字颜色 | var(--hi-color-text-primary) |
| --hi-input-text-color-disabled | 禁用文字颜色 | var(--hi-color-text-disabled) |
| --hi-input-placeholder-color | 占位符颜色 | var(--hi-color-text-secondary) |
| --hi-input-placeholder-opacity | 占位符透明度 | 0.6 |
| --hi-input-bg | 背景颜色 | transparent |
| --hi-input-bg-disabled | 禁用背景 | rgba(255, 255, 255, 0.5) |
| --hi-input-border-color | 边框颜色 | var(--hi-color-border) |
| --hi-input-border-color-focus | 焦点边框颜色 | var(--hi-color-primary) |
| --hi-input-border-color-disabled | 禁用边框颜色 | var(--hi-border-color-disabled) |
| --hi-input-border-color-error | 错误边框颜色 | var(--hi-color-danger) |
| --hi-input-shadow-focus | 焦点阴影 | 0 0 0 2px var(--hi-color-primary) |
| --hi-input-radius | 圆角 | var(--hi-radius-md) |
| --hi-input-padding-x | 水平内边距 | 0.75rem |
| --hi-input-padding-y | 垂直内边距 | 0.5rem |
| --hi-input-font-size | 字体大小 | var(--hi-font-size-sm) |

## 相关文档

- [设计系统概述](../../design-system/overview.md)
- [Layer1 基础层级](../../design-system/layer1.md)
- [Layer2 组件层级](../../design-system/layer2.md)
- [Custom 自定义层级](../../design-system/custom.md)
