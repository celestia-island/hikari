# Animation 動畫系統

高效能的宣告式動畫系統，支援靜態值、動態值、複雜時間線和 30+ 緩動函數。

## 目錄

- [概述](#概述)
- [核心特性](#核心特性)
- [AnimationBuilder 動畫構建器](#animationbuilder-動畫構建器)
- [Tween 補間動畫](#tween-補間動畫)
- [Easing 緩動函數](#easing-緩動函數)
- [Timeline 時間線](#timeline-時間線)
- [Presets 預設動畫](#presets-預設動畫)
- [Spotlight 聚光燈效果](#spotlight-聚光燈效果)
- [Context 動畫上下文](#context-動畫上下文)
- [Style 樣式操作](#style-樣式操作)
- [使用示例](#使用示例)

## 概述

`hikari-animation` 提供了一套完整的動畫解決方案：

- **宣告式 API**：類似 CSS 的流暢語法
- **動態值支援**：執行時期計算的動畫值（如滑鼠跟隨）
- **高效能**：WASM 優化，防抖更新，requestAnimationFrame
- **型別安全**：編譯時檢查 CSS 屬性
- **豐富預設**：淡入淡出、滑動、縮放等常用動畫

## 核心特性

### 1. AnimationBuilder

高級動畫構建器，支援：

- **多元素控制**：同時操作多個 DOM 元素
- **動態值**：基於 AnimationContext 的即時計算
- **自動過渡**：智能的 transition 管理
- **型別安全**：CssProperty 枚舉防止拼寫錯誤

### 2. Tween System

補間動畫系統：

- **數值插值**：平滑的數值過渡
- **自訂緩動**：30+ 內建緩動函數
- **時間控制**：持續時間、延遲控制
- **迭代循環**：支援循環播放

### 3. Easing Functions

豐富的緩動函數庫：

- **Basic**: Linear, EaseIn, EaseOut, EaseInOut
- **Sine**: 正弦緩動
- **Quad**: 二次緩動
- **Cubic**: 三次緩動
- **Quart**: 四次緩動
- **Quint**: 五次緩動
- **Expo**: 指數緩動
- **Circ**: 圓形緩動
- **Back**: 回彈效果
- **Elastic**: 彈性效果
- **Bounce**: 彈跳效果

### 4. Timeline

時間線控制：

- **序列動畫**：按順序播放多個動畫
- **並行動畫**：同時播放多個動畫
- **延遲執行**：精確的時序控制
- **動畫組**：組織複雜動畫序列

### 5. Presets

預設動畫庫：

- **Fade**: 淡入淡出
- **Slide**: 滑動進入/退出
- **Scale**: 縮放動畫
- **Rotate**: 旋轉動畫
- **Flip**: 翻轉動畫
- **Zoom**: 縮放進入/退出

### 6. Spotlight

聚光燈效果：

- **滑鼠跟隨**：發光效果跟隨滑鼠
- **漸變光照**：平滑的徑向漸變
- **效能優化**：防抖更新，節流重繪
- **自動初始化**：掃描並初始化聚光燈元素

## AnimationBuilder 動畫構建器

### 基礎用法

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;
use std::collections::HashMap;

// 建立元素映射
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);

// 應用靜態樣式
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_class("button", "hi-flex")
    .apply();
```

### 動態值動畫

```rust
// 滑鼠跟隨效果
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

### 多元素動畫

```rust
// 同時控制多個元素
let mut elements = HashMap::new();
elements.insert("button".to_string(), button_element);
elements.insert("icon".to_string(), icon_element);

AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Opacity, "0.8")
    .add_style("icon", CssProperty::Transform, "scale(1.1)")
    .add_class("button", "hi-flex")
    .apply();
```

### 過渡動畫

```rust
// 帶過渡的動畫
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::Width, "100px")
    .apply_with_transition("300ms", "ease-in-out");

// 自訂過渡屬性
AnimationBuilder::new(&elements)
    .add_style("button", CssProperty::BackgroundColor, "red")
    .apply_with_transition_custom(
        "300ms",
        "ease-in-out",
        "background-color"
    );
```

### 條件樣式

```rust
// 根據條件應用樣式
let is_active = true;

AnimationBuilder::new(&elements)
    .add_style_if("button", CssProperty::Opacity, "1", is_active)
    .add_style_if("button", CssProperty::Opacity, "0.5", !is_active)
    .apply();
```

## Tween 補間動畫

### 數值插值

```rust
use hikari_animation::tween::{Tween, TweenBuilder};

// 建立補間動畫
let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000) // 1秒
    .easing(hikari_animation::easing::EasingFunction::EaseOutQuad)
    .build();

// 更新動畫
let progress = tween.update(delta_time);
println!("當前值: {}", tween.value()); // 0.0 -> 100.0
```

### 循環動畫

```rust
// 循環播放
let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000)
    .repeat(3) // 重複3次
    .build();

// 無限循環
let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000)
    .repeat_infinite()
    .build();
```

### 往返動畫

```rust
// 往返播放（來回播放）
let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000)
    .yoyo(true) // 啟用往返
    .build();
```

### 延遲執行

```rust
// 延遲後開始動畫
let tween = TweenBuilder::new()
    .from(0.0)
    .to(100.0)
    .duration(1000)
    .delay(500) // 延遲500ms
    .build();
```

## Easing 緩動函數

### 基礎緩動

```rust
use hikari_animation::easing::{EasingFunction, easing};

// 線性（無緩動）
let linear = easing::linear(0.5); // 0.5

// 緩入
let ease_in = easing::ease_in(0.5); // ~0.29

// 緩出
let ease_out = easing::ease_out(0.5); // ~0.71

// 緩入緩出
let ease_in_out = easing::ease_in_out(0.5); // 0.5
```

### Sine 緩動

```rust
// 正弦緩動，柔和自然
let ease_in_sine = easing::ease_in_sine(0.5);
let ease_out_sine = easing::ease_out_sine(0.5);
let ease_in_out_sine = easing::ease_in_out_sine(0.5);
```

### Quad/Cubic/Quart/Quint 緩動

```rust
// 二次緩動
let ease_out_quad = easing::ease_out_quad(0.5);

// 三次緩動
let ease_out_cubic = easing::ease_out_cubic(0.5);

// 四次緩動
let ease_out_quart = easing::ease_out_quart(0.5);

// 五次緩動
let ease_out_quint = easing::ease_out_quint(0.5);
```

### Expo 緩動

```rust
// 指數緩動，加速明顯
let ease_in_expo = easing::ease_in_expo(0.5);
let ease_out_expo = easing::ease_out_expo(0.5);
let ease_in_out_expo = easing::ease_in_out_expo(0.5);
```

### Circ 緩動

```rust
// 圓形緩動，基於圓弧
let ease_in_circ = easing::ease_in_circ(0.5);
let ease_out_circ = easing::ease_out_circ(0.5);
let ease_in_out_circ = easing::ease_in_out_circ(0.5);
```

### Back 緩動

```rust
// 回彈效果，超出範圍後返回
let ease_in_back = easing::ease_in_back(0.5);
let ease_out_back = easing::ease_out_back(0.5);
let ease_in_out_back = easing::ease_in_out_back(0.5);
```

### Elastic 緩動

```rust
// 彈性效果，像彈簧一樣
let ease_in_elastic = easing::ease_in_elastic(0.5);
let ease_out_elastic = easing::ease_out_elastic(0.5);
let ease_in_out_elastic = easing::ease_in_out_elastic(0.5);
```

### Bounce 緩動

```rust
// 彈跳效果，像球落地
let ease_in_bounce = easing::ease_in_bounce(0.5);
let ease_out_bounce = easing::ease_out_bounce(0.5);
let ease_in_out_bounce = easing::ease_in_out_bounce(0.5);
```

## Timeline 時間線

### 序列動畫

```rust
use hikari_animation::timeline::Timeline;

let mut timeline = Timeline::new();

// 按順序添加動畫
timeline.add(|| {
    // 第一個動畫
    AnimationBuilder::new(&elements)
        .add_style("elem1", CssProperty::Opacity, "1")
        .apply_with_transition("300ms", "ease-out");
});

timeline.add(|| {
    // 第二個動畫（在第一個完成後執行）
    AnimationBuilder::new(&elements)
        .add_style("elem2", CssProperty::Opacity, "1")
        .apply_with_transition("300ms", "ease-out");
});

// 播放時間線
timeline.play();
```

### 並行動畫

```rust
// 同時播放多個動畫
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

### 延遲執行

```rust
// 添加延遲
timeline.delay(500); // 延遲500ms

timeline.add(|| {
    // 延遲後執行
    AnimationBuilder::new(&elements)
        .add_style("elem", CssProperty::Opacity, "1")
        .apply();
});
```

## Presets 預設動畫

### Fade 淡入淡出

```rust
use hikari_animation::presets::*;

// 淡入
fade_in(&element, 300);

// 淡出
fade_out(&element, 300);

// 切換顯示狀態
fade_toggle(&element, 300);
```

### Slide 滑動

```rust
// 從左側滑入
slide_in_left(&element, 300);

// 向右滑出
slide_out_right(&element, 300);

// 從底部滑入
slide_in_up(&element, 300);

// 向上滑出
slide_out_up(&element, 300);
```

### Scale 縮放

```rust
// 放大進入
scale_in(&element, 300);

// 縮小退出
scale_out(&element, 300);

// 脈衝動畫
pulse(&element, 300);
```

### 組合動畫

```rust
// 淡入 + 放大
fade_scale_in(&element, 300);

// 淡出 + 縮小
fade_scale_out(&element, 300);

// 滑動 + 淡入
slide_fade_in(&element, 300, "left");
```

## Spotlight 聚光燈效果

### 基礎用法

```rust
use hikari_animation::spotlight;

// 初始化所有聚光燈效果
spotlight::init_spotlights();

// 為特定元素初始化
spotlight::init_spotlight_for_element(&element);

// 更新聚光燈位置
spotlight::update_spotlights();
```

### 自動初始化

在 HTML 中添加 `data-spotlight` 屬性：

```html
<button data-spotlight>Click Me</button>
<div class="card" data-spotlight>
    Card with spotlight effect
</div>
```

然後在 WASM 啟動時呼叫：

```rust
#[wasm_bindgen::prelude::wasm_bindgen(start)]
pub fn init() {
    spotlight::init_spotlights();
}
```

### 滑鼠跟隨

聚光燈效果自動跟隨滑鼠移動：

- **徑向漸變**：從滑鼠位置向外擴散
- **效能優化**：使用 requestAnimationFrame
- **防抖更新**：避免過度重繪
- **自動清理**：元素移除時自動清理

## Context 動畫上下文

### 獲取上下文資訊

```rust
use hikari_animation::AnimationContext;

let ctx = AnimationContext::new();

// 滑鼠位置
let x = ctx.mouse_x();
let y = ctx.mouse_y();

// 元素尺寸
let width = ctx.element_width();
let height = ctx.element_height();

// 滑鼠相對元素的位置
let rel_x = ctx.relative_mouse_x();
let rel_y = ctx.relative_mouse_y();

// 滑鼠到元素中心的距離
let distance = ctx.distance_from_center();

// 滑鼠是否在元素內
let is_inside = ctx.is_mouse_inside();
```

### 動態值計算

```rust
// 基於距離的縮放
AnimationBuilder::new(&elements)
    .add_style_dynamic("card", CssProperty::Transform, |ctx| {
        let distance = ctx.distance_from_center();
        let scale = 1.0 + (distance / 500.0).min(0.3);
        format!("scale({})", scale)
    })
    .apply_with_transition("150ms", "ease-out");

// 基於位置的旋轉
AnimationBuilder::new(&elements)
    .add_style_dynamic("card", CssProperty::Transform, |ctx| {
        let rel_x = ctx.relative_mouse_x();
        let angle = (rel_x / 10.0).min(15.0);
        format!("rotate({}deg)", angle)
    })
    .apply_with_transition("150ms", "ease-out");
```

## Style 樣式操作

### StyleBuilder

```rust
use hikari_animation::style::StyleBuilder;

// 建構樣式字串
let styles = StyleBuilder::new()
    .add("width", "100px")
    .add("height", "100px")
    .add("background-color", "red")
    .build();

// 應用樣式
element.set_attribute("style", &styles).unwrap();
```

### CssProperty 枚舉

```rust
use hikari_animation::style::CssProperty;

// 型別安全的 CSS 屬性
match CssProperty::Width {
    CssProperty::Width => "width",
    CssProperty::Height => "height",
    CssProperty::Opacity => "opacity",
    CssProperty::Transform => "transform",
    CssProperty::BackgroundColor => "background-color",
    // ... 更多屬性
};
```

### 批量操作

```rust
use hikari_animation::style::StyleBuilder;

// 批量設定樣式
StyleBuilder::new()
    .add("width", "100px")
    .add("height", "100px")
    .add("background-color", "red")
    .apply(&element);

// 條件添加
let is_active = true;

StyleBuilder::new()
    .add_if("opacity", "1", is_active)
    .add_if("opacity", "0.5", !is_active)
    .apply(&element);
```

## 使用示例

### 滑鼠跟隨動畫

```rust
use hikari_animation::{AnimationBuilder, AnimationContext};
use hikari_animation::style::CssProperty;

// 元素跟隨滑鼠移動
AnimationBuilder::new(&elements)
    .add_style_dynamic("button", CssProperty::Transform, |ctx| {
        let x = ctx.mouse_x();
        let y = ctx.mouse_y();
        format!("translate({}px, {}px)", x, y)
    })
    .apply_with_transition("150ms", "ease-out");
```

### 懸停效果

```rust
// 滑鼠懸停時的縮放效果
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

### 進入動畫

```rust
use hikari_animation::presets::*;

// 元素載入時的淡入動畫
#[component]
fn MyComponent() -> Element {
    use_effect(|| {
        // 延遲執行，等待 DOM 掛載
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

### 載入動畫

```rust
use hikari_animation::presets::*;

// 脈衝載入動畫
#[component]
fn LoadingSpinner() -> Element {
    use_effect(|| {
        let element = element.clone();
        // 持續脈衝動畫
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

### 序列動畫

```rust
use hikari_animation::timeline::Timeline;

// 複雜的動畫序列
let mut timeline = Timeline::new();

// 步驟1：淡入
timeline.add(|| {
    fade_in(&elem1, 300);
});

// 延遲
timeline.delay(200);

// 步驟2：滑動進入
timeline.add(|| {
    slide_in_left(&elem2, 300);
});

// 步驟3：縮放進入（與步驟2並行）
timeline.add_parallel(|| {
    scale_in(&elem3, 300);
});

// 播放整個序列
timeline.play();
```

## 效能優化

### 防抖更新

```rust
use hikari_animation::AnimationBuilder;

// AnimationBuilder 自動使用防抖
// 避免頻繁的 DOM 更新
AnimationBuilder::new(&elements)
    .add_style_dynamic("elem", CssProperty::Opacity, |ctx| {
        format!("{}", ctx.distance_from_center() / 1000.0)
    })
    .apply_with_transition("150ms", "ease-out");
```

### requestAnimationFrame

所有動畫都使用 `requestAnimationFrame`：

```rust
// 自動使用 rAF 優化
AnimationBuilder::new(&elements)
    .add_style("elem", CssProperty::Opacity, "1")
    .apply_with_transition("300ms", "ease-out");
```

### 最小化重排

- 使用 `transform` 而不是 `top/left`
- 批量 DOM 操作
- 避免讀取佈局屬性

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

## API 參考

### 核心結構

#### `AnimationBuilder`

動畫構建器，用於建立複雜的動畫效果。

```rust
pub struct AnimationBuilder<'a> {
    elements: &'a HashMap<String, Element>,
    styles: HashMap<String, Vec<(CssProperty, DynamicValue)>>,
    classes: HashMap<String, Vec<String>>,
}
```

**方法**：
- `new()` - 建立新的構建器
- `add_style()` - 添加靜態樣式
- `add_style_dynamic()` - 添加動態樣式
- `add_style_if()` - 條件添加樣式
- `add_class()` - 添加 CSS 類
- `apply()` - 應用樣式
- `apply_with_transition()` - 應用樣式並添加過渡
- `apply_with_transition_custom()` - 自訂過渡參數

#### `DynamicValue`

動態值，可以是靜態字串或閉包。

```rust
pub enum DynamicValue {
    Static(String),
    Dynamic(Box<dyn Fn(&AnimationContext) -> String + 'static>),
}
```

#### `AnimationContext`

動畫上下文，提供執行時期資訊。

```rust
pub struct AnimationContext {
    mouse_x: f64,
    mouse_y: f64,
    element: Element,
}
```

**方法**：
- `mouse_x()` - 滑鼠 X 坐標
- `mouse_y()` - 滑鼠 Y 坐標
- `element_width()` - 元素寬度
- `element_height()` - 元素高度
- `relative_mouse_x()` - 相對元素的 X 坐標
- `relative_mouse_y()` - 相對元素的 Y 坐標
- `distance_from_center()` - 到元素中心的距離
- `is_mouse_inside()` - 滑鼠是否在元素內

### 輔助函數

#### `init_spotlights()`

初始化所有聚光燈效果。

```rust
pub fn init_spotlights()
```

#### `init_spotlight_for_element()`

為特定元素初始化聚光燈效果。

```rust
pub fn init_spotlight_for_element(element: &Element)
```

#### `update_spotlights()`

更新所有聚光燈的位置。

```rust
pub fn update_spotlights()
```

## 設計理念

### 宣告式

- **流暢的 API**：鏈式呼叫，易於閱讀
- **組合優先**：小的構建模組合成複雜動畫
- **型別安全**：編譯時檢查所有屬性

### 效能優先

- **WASM 優化**：最小化執行時期開銷
- **防抖更新**：避免過度重繪
- **rAF 整合**：與瀏覽器渲染週期同步

### 開發體驗

- **IDE 支援**：完整的型別提示
- **錯誤處理**：清晰的錯誤訊息
- **除錯友善**：易於追蹤動畫狀態

## 下一步

- [Components 元件](../components/) - 使用動畫的 UI 元件
- [Palette 調色板](./palette.md) - 動畫顏色配置
- [Theme 主題](./theme.md) - 動畫與主題整合
