# Button 按钮

Button 组件是最基础的用户交互组件，支持多种样式和状态。

按钮用于触发操作或事件，如提交表单、打开对话框、取消操作或执行删除操作。

## 三层级配置

Button 组件支持三层级 CSS 变量配置架构：

- **Layer1 (基础层级)**: 通过主题定义全局默认值
- **Layer2 (组件层级)**: 通过 `button-vars.scss` 定义组件变量
- **Custom (运行时)**: 通过组件属性动态覆盖

```_hikari_component
pages/components/layer1/button#custom-colors
```

## 按钮变体

支持 Primary、Secondary、Ghost、Danger 四种变体。

```_hikari_component
pages/components/layer1/button#variants
```

## 禁用状态

按钮可以被禁用，禁用状态下不可点击。

```_hikari_component
pages/components/layer1/button#disabled
```

## 图标按钮尺寸

图标按钮支持小(24px)、中(32px)、大(40px)三种尺寸。

```_hikari_component
pages/components/layer1/button#icon-sizes
```

## 图标按钮变体

图标按钮支持 Ghost、Primary、Secondary、Danger、Success 五种颜色变体。

```_hikari_component
pages/components/layer1/button#icon-variants
```

## 自定义颜色

通过 Custom 层属性可以动态覆盖按钮颜色。

```rust
Button {
    variant: ButtonVariant::Primary,
    icon_color: Some("#ff0000".to_string()),     // 自定义图标颜色
    text_color: Some("#ffffff".to_string()),     // 自定义文字颜色
    background_color: Some("#ff4f00".to_string()), // 自定义背景颜色
    "Custom Colors"
}
```

## CSS 变量覆盖

通过 `css_vars` 属性可以批量覆盖 CSS 变量。

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

## 动画集成

通过 `animation_id` 属性可以与 AnimationBuilder 集成实现动画效果。

```rust
Button {
    animation_id: Some("animated-button".to_string()),
    "Animated Button"
}

// 使用 AnimationBuilder 控制动画
AnimationBuilder::new()
    .style("--hi-button-bg", "rgb(255, 0, 0)")
    .duration(300)
    .apply_to_element("animated-button");
```

## API

### Button Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| variant | 按钮样式变体 | ButtonVariant | Primary |
| size | 按钮尺寸 | ButtonSize | Medium |
| width | 按钮宽度 | ButtonWidth | Auto |
| disabled | 是否禁用 | bool | false |
| loading | 是否加载中 | bool | false |
| block | 是否块级显示 | bool | false |
| icon | 前缀图标 | Option\<Element\> | None |
| suffix | 后缀图标 | Option\<Element\> | None |
| children | 按钮内容 | Element | - |
| glow | 是否启用发光效果 | bool | true |
| glow_blur | 发光模糊强度 | GlowBlur | Medium |
| glow_intensity | 发光强度 | GlowIntensity | Soft |
| glow_color | 发光颜色 | Option\<GlowColor\> | None |
| **Custom 层属性** | | | |
| icon_color | 自定义图标颜色 | Option\<String\> | None |
| text_color | 自定义文字颜色 | Option\<String\> | None |
| background_color | 自定义背景颜色 | Option\<String\> | None |
| border_color | 自定义边框颜色 | Option\<String\> | None |
| animation_id | AnimationBuilder 动画 ID | Option\<String\> | None |
| css_vars | CSS 变量批量覆盖 | Option\<Vec\<(&'static str, String)\>\> | None |

### IconButton Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| icon | 图标 | MdiIcon | - |
| size | 按钮尺寸 | IconButtonSize | Large |
| variant | 颜色变体 | IconButtonVariant | Ghost |
| glow | 是否启用发光效果 | bool | true |
| glow_blur | 发光模糊强度 | GlowBlur | Medium |
| glow_intensity | 发光强度 | GlowIntensity | Standard |
| glow_color | 发光颜色 | GlowColor | Primary |
| disabled | 是否禁用 | bool | false |
| class | 自定义 CSS 类 | String | "" |
| onclick | 点击回调 | EventHandler\<MouseEvent\> | - |
| **Custom 层属性** | | | |
| icon_color | 自定义图标颜色 | Option\<String\> | None |
| background_color | 自定义背景颜色 | Option\<String\> | None |
| border_radius | 自定义圆角 | Option\<String\> | None |
| animation_id | AnimationBuilder 动画 ID | Option\<String\> | None |
| css_vars | CSS 变量批量覆盖 | Option\<Vec\<(&'static str, String)\>\> | None |

## CSS 变量参考

### Button CSS 变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| --hi-button-icon-color | 图标颜色 | var(--hi-icon-color) |
| --hi-button-text-color | 文字颜色 | var(--hi-color-text-primary) |
| --hi-button-bg | 背景颜色 | transparent |
| --hi-button-bg-hover | 悬停背景 | var(--hi-color-gray-10) |
| --hi-button-border-color | 边框颜色 | var(--hi-color-border) |
| --hi-button-radius | 圆角 | var(--hi-radius-md) |
| --hi-button-padding-x | 水平内边距 | 1rem |
| --hi-button-padding-y | 垂直内边距 | 0.5rem |
| --hi-button-duration | 动画时长 | var(--hi-duration-fast) |

### IconButton CSS 变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| --hi-icon-button-icon-color | 图标颜色 | var(--hi-icon-color) |
| --hi-icon-button-bg | 背景颜色 | transparent |
| --hi-icon-button-bg-hover | 悬停背景 | var(--hi-bg-surface) |
| --hi-icon-button-size | 按钮尺寸 | 40px |
| --hi-icon-button-icon-size | 图标尺寸 | var(--hi-icon-size-sm) |
| --hi-icon-button-radius | 圆角 | var(--hi-radius-md) |

## 相关文档

- [设计系统概述](../../design-system/overview.md)
- [Layer1 基础层级](../../design-system/layer1.md)
- [Layer2 组件层级](../../design-system/layer2.md)
- [Custom 自定义层级](../../design-system/custom.md)
