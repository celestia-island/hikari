# Custom - 自定义层级（Runtime）

## 概述

Custom 层是三层级架构的最顶层，允许在运行时动态修改组件样式。这一层通过组件属性和 AnimationBuilder 实现，提供了最大的灵活性。

## 实现方式

### 1. 组件属性覆盖

每个支持三层级架构的组件都提供了以下属性：

```rust
#[derive(Props)]
pub struct ComponentProps {
    // 颜色覆盖
    #[props(default)]
    pub icon_color: Option<String>,

    #[props(default)]
    pub text_color: Option<String>,

    #[props(default)]
    pub background_color: Option<String>,

    #[props(default)]
    pub border_color: Option<String>,

    // 动画集成
    #[props(default)]
    pub animation_id: Option<String>,

    // 任意 CSS 变量覆盖
    #[props(default)]
    pub css_vars: Option<Vec<(&'static str, String)>>,
}
```

### 2. AnimationBuilder 集成

通过 `animation_id` 属性与 AnimationBuilder 集成，实现复杂的动画效果。

## 组件属性详解

### icon_color

覆盖组件内图标的颜色。

```rust
Button {
    variant: ButtonVariant::Primary,
    icon: rsx! { Icon { icon: MdiIcon::Heart } },
    icon_color: Some("#ff0000".to_string()),  // 红色图标
    "Like"
}
```

**影响的 CSS 变量：**
```scss
--hi-button-icon-color: #ff0000;
--hi-button-icon-color-hover: #ff0000;
--hi-button-icon-color-active: #ff0000;
```

### text_color

覆盖组件内文字的颜色。

```rust
Button {
    variant: ButtonVariant::Ghost,
    text_color: Some("#3b82f6".to_string()),  // 蓝色文字
    "Click me"
}
```

**影响的 CSS 变量：**
```scss
--hi-button-text-color: #3b82f6;
--hi-button-text-color-hover: #3b82f6;
--hi-button-text-color-active: #3b82f6;
```

### background_color

覆盖组件的背景颜色。

```rust
Button {
    variant: ButtonVariant::Primary,
    background_color: Some("linear-gradient(45deg, #ff4f00, #ff8c00)".to_string()),
    "Gradient Button"
}
```

**影响的 CSS 变量：**
```scss
--hi-button-bg: linear-gradient(45deg, #ff4f00, #ff8c00);
--hi-button-bg-hover: linear-gradient(45deg, #ff4f00, #ff8c00);
```

### border_color

覆盖组件的边框颜色。

```rust
Input {
    border_color: Some("#22c55e".to_string()),  // 绿色边框
    placeholder: "Success input"
}
```

**影响的 CSS 变量：**
```scss
--hi-input-border-color: #22c55e;
--hi-input-border-color-focus: #22c55e;
```

### css_vars

批量设置任意 CSS 变量。

```rust
Button {
    variant: ButtonVariant::Ghost,
    css_vars: Some(vec![
        ("--hi-button-radius", "50px".to_string()),           // 全圆角
        ("--hi-button-bg-hover", "rgba(255, 0, 0, 0.1)".to_string()),  // 红色悬停背景
        ("--hi-button-padding-x", "2rem".to_string()),        // 更宽的内边距
    ]),
    "Custom Style"
}
```

### animation_id

设置动画标识符，用于 AnimationBuilder 控制。

```rust
Button {
    animation_id: Some("my-animated-button".to_string()),
    "Animated Button"
}
```

## AnimationBuilder 集成

### 基本用法

```rust
use hikari_animation::{AnimationBuilder, Easing};

// 创建动画
AnimationBuilder::new()
    .style("--hi-button-bg", "rgb(255, 0, 0)")
    .style("--hi-button-text-color", "rgb(255, 255, 255)")
    .duration(300)
    .easing(Easing::EaseInOut)
    .apply_to_element("my-animated-button");
```

### 颜色过渡

```rust
// 从当前颜色过渡到红色
AnimationBuilder::new()
    .style("--hi-button-bg", "rgb(255, 79, 0)")
    .style("--hi-button-bg-hover", "rgb(204, 63, 0)")
    .duration(500)
    .easing(Easing::EaseOut)
    .apply_to_element("my-button");
```

### 圆角动画

```rust
// 圆角从 8px 过渡到 50px
AnimationBuilder::new()
    .style("--hi-button-radius", "50px")
    .duration(300)
    .easing(Easing::EaseInOut)
    .apply_to_element("round-button");
```

### 变换动画

```rust
// 缩放动画
AnimationBuilder::new()
    .style("transform", "scale(1.1)")
    .duration(200)
    .easing(Easing::EaseOut)
    .apply_to_element("scale-button");

// 旋转动画
AnimationBuilder::new()
    .style("transform", "rotate(180deg)")
    .duration(500)
    .easing(Easing::EaseInOut)
    .apply_to_element("rotate-button");
```

### 组合动画

```rust
// 同时改变多个属性
AnimationBuilder::new()
    .style("--hi-button-bg", "rgb(255, 79, 0)")
    .style("--hi-button-radius", "24px")
    .style("transform", "scale(1.05)")
    .style("box-shadow", "0 8px 16px rgba(255, 79, 0, 0.3)")
    .duration(400)
    .easing(Easing::EaseInOut)
    .apply_to_element("combined-button");
```

## 完整示例

### 主题切换按钮

```rust
use tairitsu_vdom::prelude::*;
use hikari_components::{Button, ButtonVariant};
use hikari_animation::{AnimationBuilder, Easing};

fn ThemeToggleButton() -> Element {
    let mut is_dark = use_signal(|| false);

    rsx! {
        Button {
            variant: ButtonVariant::Primary,
            animation_id: Some("theme-toggle-btn".to_string()),
            onclick: move |_| {
                let new_bg = if is_dark() { "#ffffff" } else { "#1a1a1a" };
                let new_text = if is_dark() { "#1a1a1a" } else { "#ffffff" };

                AnimationBuilder::new()
                    .style("--hi-button-bg", new_bg)
                    .style("--hi-button-text-color", new_text)
                    .duration(300)
                    .easing(Easing::EaseInOut)
                    .apply_to_element("theme-toggle-btn");

                is_dark.set(!is_dark());
            },
            if is_dark() { "🌙 Dark" } else { "☀️ Light" }
        }
    }
}
```

### 渐变动画按钮

```rust
fn GradientButton() -> Element {
    rsx! {
        Button {
            variant: ButtonVariant::Primary,
            animation_id: Some("gradient-btn".to_string()),
            css_vars: Some(vec![
                ("--hi-button-bg", "linear-gradient(45deg, #ff4f00, #ff8c00)".to_string()),
                ("--hi-button-radius", "50px".to_string()),
            ]),
            onmouseenter: move |_| {
                AnimationBuilder::new()
                    .style("--hi-button-bg", "linear-gradient(45deg, #ff8c00, #ff4f00)")
                    .duration(300)
                    .apply_to_element("gradient-btn");
            },
            onmouseleave: move |_| {
                AnimationBuilder::new()
                    .style("--hi-button-bg", "linear-gradient(45deg, #ff4f00, #ff8c00)")
                    .duration(300)
                    .apply_to_element("gradient-btn");
            },
            "Hover me"
        }
    }
}
```

### 脉冲动画按钮

```rust
fn PulseButton() -> Element {
    rsx! {
        Button {
            variant: ButtonVariant::Danger,
            animation_id: Some("pulse-btn".to_string()),
            css_vars: Some(vec![
                ("--hi-button-radius", "50%".to_string()),
            ]),
            icon: rsx! { Icon { icon: MdiIcon::Bell } },
            onclick: move |_| {
                // 脉冲动画
                for i in 0..3 {
                    let delay = i * 200;
                    spawn(async move {
                        async_std::task::sleep(std::time::Duration::from_millis(delay as u64)).await;
                        AnimationBuilder::new()
                            .style("transform", "scale(1.2)")
                            .duration(100)
                            .easing(Easing::EaseOut)
                            .apply_to_element("pulse-btn");

                        async_std::task::sleep(std::time::Duration::from_millis(100)).await;
                        AnimationBuilder::new()
                            .style("transform", "scale(1.0)")
                            .duration(100)
                            .easing(Easing::EaseIn)
                            .apply_to_element("pulse-btn");
                    });
                }
            },
            "Notify"
        }
    }
}
```

## 样式优先级

当多个层级定义同一属性时，优先级从高到低：

```
Custom (运行时) > Layer2 (组件) > Layer1 (基础)
```

```rust
// 示例：优先级演示
Button {
    variant: ButtonVariant::Primary,  // Layer2 设置背景为 primary 色
    background_color: Some("#ff0000".to_string()),  // Custom 覆盖为红色
    // 最终背景色为红色
    "Priority Demo"
}
```

## 性能考虑

### 1. 减少动画属性数量

```rust
// 好：只动画必要的属性
AnimationBuilder::new()
    .style("transform", "scale(1.1)")
    .style("opacity", "0.8")
    .duration(200)
    .apply_to_element("btn");

// 避免：动画过多属性
AnimationBuilder::new()
    .style("width", "200px")
    .style("height", "60px")
    .style("margin", "20px")
    .style("padding", "15px")
    // ... 更多属性
    .apply_to_element("btn");
```

### 2. 使用 GPU 加速属性

```rust
// 好：使用 transform 和 opacity（GPU 加速）
AnimationBuilder::new()
    .style("transform", "translateX(100px) scale(1.1)")
    .style("opacity", "0.8")
    .apply_to_element("btn");

// 避免：使用 left/top（触发重排）
AnimationBuilder::new()
    .style("left", "100px")
    .style("top", "50px")
    .apply_to_element("btn");
```

### 3. 合理设置动画时长

```rust
// 微交互：快速
AnimationBuilder::new()
    .duration(150)  // 快速反馈
    .apply_to_element("btn");

// 状态变化：中等
AnimationBuilder::new()
    .duration(300)  // 可感知但不拖沓
    .apply_to_element("panel");

// 页面过渡：慢速
AnimationBuilder::new()
    .duration(500)  // 让用户看清过渡
    .apply_to_element("page");
```

## 最佳实践

1. **保持一致性**：同一应用中相似交互使用相似的动画
2. **尊重用户偏好**：检测 `prefers-reduced-motion` 设置
3. **提供反馈**：交互后立即提供视觉反馈
4. **避免过度动画**：动画应服务于用户体验，而非炫技

## 相关文档

- [设计系统概述](./overview.md)
- [Layer1 基础层级](./layer1.md)
- [Layer2 组件层级](./layer2.md)
