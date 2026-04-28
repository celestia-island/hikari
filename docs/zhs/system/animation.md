# Animation 动画系统

高性能的声明式动画系统，支持静态值、动态值、复杂时间线和 30+ 缓动函数。

## 目录

- [概述](#概述)
- [核心特性](#核心特性)
- [AnimationBuilder 动画构建器](#animationbuilder-动画构建器)
- [Tween 补间动画](#tween-补间动画)
- [Easing 缓动函数](#easing-缓动函数)
- [Timeline 时间线](#timeline-时间线)
- [Presets 预设动画](#presets-预设动画)
- [Spotlight 聚光灯效果](#spotlight-聚光灯效果)
- [Context 动画上下文](#context-动画上下文)
- [Style 样式操作](#style-样式操作)
- [使用示例](#使用示例)

## 概述

`hikari-animation` 提供了一套完整的动画解决方案：

- **声明式 API**：类似 CSS 的流畅语法
- **动态值支持**：运行时计算的动画值（如鼠标跟随）
- **高性能**：WASM 优化，防抖更新，requestAnimationFrame
- **类型安全**：编译时检查 CSS 属性
- **丰富预设**：淡入淡出、滑动、缩放等常用动画

## 核心特性

### 1. AnimationBuilder

高级动画构建器，支持：

- **多元素控制**：同时操作多个 DOM 元素
- **动态值**：基于 AnimationContext 的实时计算
- **自动过渡**：智能的 transition 管理
- **类型安全**：CssProperty 枚举防止拼写错误

### 2. Tween System

补间动画系统：

- **数值插值**：平滑的数值过渡
- **自定义缓动**：30+ 内置缓动函数
- **时间控制**：持续时间、延迟控制
- **迭代循环**：支持循环播放

### 3. Easing Functions

丰富的缓动函数库：

- **Basic**: Linear, EaseIn, EaseOut, EaseInOut
- **Sine**: 正弦缓动
- **Quad**: 二次缓动
- **Cubic**: 三次缓动
- **Quart**: 四次缓动
- **Quint**: 五次缓动
- **Expo**: 指数缓动
- **Circ**: 圆形缓动
- **Back**: 回弹效果
- **Elastic**: 弹性效果
- **Bounce**: 弹跳效果

### 4. Timeline

时间线控制：

- **序列动画**：按顺序播放多个动画
- **并行动画**：同时播放多个动画
- **延迟执行**：精确的时序控制
- **动画组**：组织复杂动画序列

### 5. Presets

预设动画库：

- **Fade**: 淡入淡出
- **Slide**: 滑动进入/退出
- **Scale**: 缩放动画
- **Rotate**: 旋转动画
- **Flip**: 翻转动画
- **Zoom**: 缩放进入/退出

### 6. Spotlight

聚光灯效果：

- **鼠标跟随**：发光效果跟随鼠标
- **渐变光照**：平滑的径向渐变
- **性能优化**：防抖更新，节流重绘
- **自动初始化**：扫描并初始化聚光灯元素

## AnimationBuilder 动画构建器

### 基础用法

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;
use std::collections::HashMap;

// 创建元素映射
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);

// 应用静态样式
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_class("button", "hi-flex")
    .apply();
```

### 动态值动画

```rust
// 鼠标跟随效果
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

### 多元素动画

```rust
// 同时控制多个元素
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);
elements.insert("icon".to_string(), icon_element);

AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_style("icon", CssProperty::Transform, "scale(1.1)")
    .add_class("button", "hi-flex")
    .apply();
```

### 过渡动画

```rust
// 带过渡的动画
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Width, "100px")
    .apply_with_transition("300ms", "ease-in-out");

// 自定义过渡属性
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::BackgroundColor, "red")
    .apply_with_transition_custom(
        "300ms",
        "ease-in-out",
        "background-color"
    );
```

### 条件样式

```rust
// 根据条件应用样式
let is_active = true;

AnimationBuilder::new(&elements)
    .add_style_if("button", CssProperty::Opacity, "1", is_active)
    .add_style_if("button", CssProperty::Opacity, "0.5", !is_active)
    .apply();
```

## Tween 补间动画

### 数值插值

```rust
use hikari_animation::tween::{Tween, TweenBuilder};

// 创建补间动画
let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000) // 1秒
    .easing(hikari_animation::easing::EasingFunction::EaseOutQuad)
    .build();

// 更新动画
let progress = tween.update(delta_time);
println!("当前值: {}", tween.value()); // 0.0 -> 100.0
```

### 循环动画

```rust
// 循环播放
let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000)
    .repeat(3) // 重复3次
    .build();

// 无限循环
let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000)
    .repeat_infinite()
    .build();
```

### 往返动画

```rust
// 往返播放（来回播放）
let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000)
    .yoyo(true) // 启用往返
    .build();
```

### 延迟执行

```rust
// 延迟后开始动画
let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000)
    .delay(500) // 延迟500ms
    .build();
```

## Easing 缓动函数

### 基础缓动

```rust
use hikari_animation::easing::{EasingFunction, easing};

// 线性（无缓动）
let linear = easing::linear(0.5); // 0.5

// 缸入
let ease_in = easing::ease_in(0.5); // ~0.29

// 缸出
let ease_out = easing::ease_out(0.5); // ~0.71

// 缸入缸出
let ease_in_out = easing::ease_in_out(0.5); // 0.5
```

### Sine 缓动

```rust
// 正弦缓动，柔和自然
let ease_in_sine = easing::ease_in_sine(0.5);
let ease_out_sine = easing::ease_out_sine(0.5);
let ease_in_out_sine = easing::ease_in_out_sine(0.5);
```

### Quad/Cubic/Quart/Quint 缓动

```rust
// 二次缓动
let ease_out_quad = easing::ease_out_quad(0.5);

// 三次缓动
let ease_out_cubic = easing::ease_out_cubic(0.5);

// 四次缓动
let ease_out_quart = easing::ease_out_quart(0.5);

// 五次缓动
let ease_out_quint = easing::ease_out_quint(0.5);
```

### Expo 缓动

```rust
// 指数缓动，加速明显
let ease_in_expo = easing::ease_in_expo(0.5);
let ease_out_expo = easing::ease_out_expo(0.5);
let ease_in_out_expo = easing::ease_in_out_expo(0.5);
```

### Circ 缓动

```rust
// 圆形缓动，基于圆弧
let ease_in_circ = easing::ease_in_circ(0.5);
let ease_out_circ = easing::ease_out_circ(0.5);
let ease_in_out_circ = easing::ease_in_out_circ(0.5);
```

### Back 缓动

```rust
// 回弹效果，超出范围后返回
let ease_in_back = easing::ease_in_back(0.5);
let ease_out_back = easing::ease_out_back(0.5);
let ease_in_out_back = easing::ease_in_out_back(0.5);
```

### Elastic 缓动

```rust
// 弹性效果，像弹簧一样
let ease_in_elastic = easing::ease_in_elastic(0.5);
let ease_out_elastic = easing::ease_out_elastic(0.5);
let ease_in_out_elastic = easing::ease_in_out_elastic(0.5);
```

### Bounce 缓动

```rust
// 弹跳效果，像球落地
let ease_in_bounce = easing::ease_in_bounce(0.5);
let ease_out_bounce = easing::ease_out_bounce(0.5);
let ease_in_out_bounce = easing::ease_in_out_bounce(0.5);
```

## Timeline 时间线

### 序列动画

```rust
use hikari_animation::timeline::Timeline;

let mut timeline = Timeline::new();

// 按顺序添加动画
timeline.add(|| {
    // 第一个动画
    AnimationBuilder::new(&elements)
        .add_style("elem1", CssProperty::Opacity, "1")
        .apply_with_transition("300ms", "ease-out");
});

timeline.add(|| {
    // 第二个动画（在第一个完成后执行）
    AnimationBuilder::new(&elements)
        .add_style("elem2", CssProperty::Opacity, "1")
        .apply_with_transition("300ms", "ease-out");
});

// 播放时间线
timeline.play();
```

### 并行动画

```rust
// 同时播放多个动画
timeline.add_parallel(|| {
    AnimationBuilder::new(&elements)
        .add_style("elem1", CssProperty::Opacity, "1")
        .apply_with_transition("300ms", "ease-out");
});

timeline.add_parallel(|| {
    AnimationBuilder::new(&elements)
        .add_style("elem2", CssProperty::Opacity, "1")
        .apply_with_transition("300ms", "ease-out");
});
```

### 延迟执行

```rust
// 添加延迟
timeline.delay(500); // 延迟500ms

timeline.add(|| {
    // 延迟后执行
    AnimationBuilder::new(&elements)
        .add_style("elem", CssProperty::Opacity, "1")
        .apply();
});
```

## Presets 预设动画

### Fade 淡入淡出

```rust
use hikari_animation::presets::*;

// 淡入
fade_in(&element, 300);

// 淡出
fade_out(&element, 300);

// 切换显示状态
fade_toggle(&element, 300);
```

### Slide 滑动

```rust
// 从左侧滑入
slide_in_left(&element, 300);

// 向右滑出
slide_out_right(&element, 300);

// 从底部滑入
slide_in_up(&element, 300);

// 向上滑出
slide_out_up(&element, 300);
```

### Scale 缩放

```rust
// 放大进入
scale_in(&element, 300);

// 缩小退出
scale_out(&element, 300);

// 脉冲动画
pulse(&element, 300);
```

### 组合动画

```rust
// 淡入 + 放大
fade_scale_in(&element, 300);

// 淡出 + 缩小
fade_scale_out(&element, 300);

// 滑动 + 淡入
slide_fade_in(&element, 300, "left");
```

## Spotlight 聚光灯效果

### 基础用法

```rust
use hikari_animation::spotlight;

// 初始化所有聚光灯效果
spotlight::init_spotlights();

// 为特定元素初始化
spotlight::init_spotlight_for_element(&element);

// 更新聚光灯位置
spotlight::update_spotlights();
```

### 自动初始化

在 HTML 中添加 `data-spotlight` 属性：

```html
<button data-spotlight>Click Me</button>
<div class="card" data-spotlight>
    Card with spotlight effect
</div>
```

然后在 WASM 启动时调用：

```rust
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn init() {
    spotlight::init_spotlights();
}
```

### 鼠标跟随

聚光灯效果自动跟随鼠标移动：

- **径向渐变**：从鼠标位置向外扩散
- **性能优化**：使用 requestAnimationFrame
- **防抖更新**：避免过度重绘
- **自动清理**：元素移除时自动清理

## Context 动画上下文

### 获取上下文信息

```rust
use hikari_animation::AnimationContext;

let ctx = AnimationContext::new();

// 鼠标位置
let x = ctx.mouse_x();
let y = ctx.mouse_y();

// 元素尺寸
let width = ctx.element_width();
let height = ctx.element_height();

// 鼠标相对元素的位置
let rel_x = ctx.relative_mouse_x();
let rel_y = ctx.relative_mouse_y();

// 鼠标到元素中心的距离
let distance = ctx.distance_from_center();

// 鼠标是否在元素内
let is_inside = ctx.is_mouse_inside();
```

### 动态值计算

```rust
// 基于距离的缩放
AnimationBuilder::new(&elements)
    .add_style_dynamic("card", CssProperty::Transform, |ctx| {
        let distance = ctx.distance_from_center();
        let scale = 1.0 + (distance / 500.0).min(0.3);
        format!("scale({})", scale)
    })
    .apply_with_transition("150ms", "ease-out");

// 基于位置的旋转
AnimationBuilder::new(&elements)
    .add_style_dynamic("card", CssProperty::Transform, |ctx| {
        let rel_x = ctx.relative_mouse_x();
        let angle = (rel_x / 10.0).min(15.0);
        format!("rotate({}deg)", angle)
    })
    .apply_with_transition("150ms", "ease-out");
```

## Style 样式操作

### StyleBuilder

```rust
use hikari_animation::style::StyleBuilder;

// 构建样式字符串
let styles = StyleBuilder::new()
    .add("width", "100px")
    .add("height", "100px")
    .add("background-color", "red")
    .build();

// 应用样式
element.set_attribute("style", &styles).unwrap();
```

### CssProperty 枚举

```rust
use hikari_animation::style::CssProperty;

// 类型安全的 CSS 属性
match CssProperty::Width {
    CssProperty::Width => "width",
    CssProperty::Height => "height",
    CssProperty::Opacity => "opacity",
    CssProperty::Transform => "transform",
    CssProperty::BackgroundColor => "background-color",
    // ... 更多属性
};
```

### 批量操作

```rust
use hikari_animation::style::StyleBuilder;

// 批量设置样式
StyleBuilder::new()
    .add("width", "100px")
    .add("height", "100px")
    .add("background-color", "red")
    .apply(&element);

// 条件添加
let is_active = true;

StyleBuilder::new()
    .add_if("opacity", "1", is_active)
    .add_if("opacity", "0.5", !is_active)
    .apply(&element);
```

## 使用示例

### 鼠标跟随动画

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

// 元素跟随鼠标移动
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

### 悬停效果

```rust
// 鼠标悬停时的缩放效果
AnimationBuilder::new(&elements)
    .add_style_dynamic("card", CssProperty::Transform, |ctx| {
        if ctx.is_mouse_inside() {
            "scale(1.05)".to_string()
        } else {
            "scale(1)".to_string()
        }
    })
    .apply_with_transition("200ms", "ease-out");
```

### 进入动画

```rust
use hikari_animation::presets::*;

// 元素加载时的淡入动画
#[component]
fn MyComponent() -> Element {
    use_effect(|| {
        // 延迟执行，等待 DOM 挂载
        setTimeout(|| {
            fade_in(&element, 300);
        }, 100);
        async move {}
    });

    rsx! {
        div { "Content with fade-in animation" }
    }
}
```

### 加载动画

```rust
use hikari_animation::presets::*;

// 脉冲加载动画
#[component]
fn LoadingSpinner() -> Element {
    use_effect(|| {
        let element = element.clone();
        // 持续脉冲动画
        loop {
            pulse(&element, 1000);
            delay(1000).await;
        }
    });

    rsx! {
        div { class: "spinner" }
    }
}
```

### 序列动画

```rust
use hikari_animation::timeline::Timeline;

// 复杂的动画序列
let mut timeline = Timeline::new();

// 步骤1：淡入
timeline.add(|| {
    fade_in(&elem1, 300);
});

// 延迟
timeline.delay(200);

// 步骤2：滑动进入
timeline.add(|| {
    slide_in_left(&elem2, 300);
});

// 步骤3：缩放进入（与步骤2并行）
timeline.add_parallel(|| {
    scale_in(&elem3, 300);
});

// 播放整个序列
timeline.play();
```

## 性能优化

### 防抖更新

```rust
use hikari_animation::AnimationBuilder;

// AnimationBuilder 自动使用防抖
// 避免频繁的 DOM 更新
AnimationBuilder::new(&elements)
    .add_style_dynamic("elem", CssProperty::Opacity, |ctx| {
        format!("{}", ctx.distance_from_center() / 1000.0)
    })
    .apply_with_transition("150ms", "ease-out");
```

### requestAnimationFrame

所有动画都使用 `requestAnimationFrame`：

```rust
// 自动使用 rAF 优化
AnimationBuilder::new(&elements)
    .add_style("elem", CssProperty::Opacity, "1")
    .apply_with_transition("300ms", "ease-out");
```

### 最小化重排

- 使用 `transform` 而不是 `top/left`
- 批量 DOM 操作
- 避免读取布局属性

```rust
// 好的做法
AnimationBuilder::new(&elements)
    .add_style("elem", CssProperty::Transform, "translate(100px, 0)")
    .apply();

// 避免
AnimationBuilder::new(&elements)
    .add_style("elem", CssProperty::Left, "100px")
    .apply();
```

## API 参考

### 核心结构

#### `AnimationBuilder`

动画构建器，用于创建复杂的动画效果。

```rust
pub struct AnimationBuilder<'a> {
    elements: &'a HashMap<String, Element>,
    styles: HashMap<String, Vec<(CssProperty, DynamicValue)>>,
    classes: HashMap<String, Vec<String>>,
}
```

**方法**：
- `new()` - 创建新的构建器
- `add_style()` - 添加静态样式
- `add_style_dynamic()` - 添加动态样式
- `add_style_if()` - 条件添加样式
- `add_class()` - 添加 CSS 类
- `apply()` - 应用样式
- `apply_with_transition()` - 应用样式并添加过渡
- `apply_with_transition_custom()` - 自定义过渡参数

#### `DynamicValue`

动态值，可以是静态字符串或闭包。

```rust
pub enum DynamicValue {
    Static(String),
    Dynamic(Box<dyn Fn(&AnimationContext) -> String + 'static>),
}
```

#### `AnimationContext`

动画上下文，提供运行时信息。

```rust
pub struct AnimationContext {
    mouse_x: f64,
    mouse_y: f64,
    element: Element,
}
```

**方法**：
- `mouse_x()` - 鼠标 X 坐标
- `mouse_y()` - 鼠标 Y 坐标
- `element_width()` - 元素宽度
- `element_height()` - 元素高度
- `relative_mouse_x()` - 相对元素的 X 坐标
- `relative_mouse_y()` - 相对元素的 Y 坐标
- `distance_from_center()` - 到元素中心的距离
- `is_mouse_inside()` - 鼠标是否在元素内

### 辅助函数

#### `init_spotlights()`

初始化所有聚光灯效果。

```rust
pub fn init_spotlights()
```

#### `init_spotlight_for_element()`

为特定元素初始化聚光灯效果。

```rust
pub fn init_spotlight_for_element(element: &Element)
```

#### `update_spotlights()`

更新所有聚光灯的位置。

```rust
pub fn update_spotlights()
```

## 设计理念

### 声明式

- **流畅的 API**：链式调用，易于阅读
- **组合优先**：小的构建块组合成复杂动画
- **类型安全**：编译时检查所有属性

### 性能优先

- **WASM 优化**：最小化运行时开销
- **防抖更新**：避免过度重绘
- **rAF 集成**：与浏览器渲染周期同步

### 开发体验

- **IDE 支持**：完整的类型提示
- **错误处理**：清晰的错误信息
- **调试友好**：易于追踪动画状态

## 下一步

- [Components 组件](../components/) - 使用动画的 UI 组件
- [Palette 调色板](./palette.md) - 动画颜色配置
- [Theme 主题](./theme.md) - 动画与主题集成
